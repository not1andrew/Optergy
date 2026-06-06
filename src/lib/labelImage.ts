/** Environment-independent pixel processing, shared verbatim by the browser and benchmark. */
export interface Pixels {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}
export interface LabelRegions {
  body?: Region;
  consumption: Region[];
  red: Uint8Array;
  starRed?: Uint8Array;
  arc?: Region;
  superArc?: Region;
}

export function rotateQuarterTurn(image: Pixels): Pixels {
  const width = image.height,
    height = image.width,
    data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4,
        to = (x * width + width - 1 - y) * 4;
      data[to] = image.data[from];
      data[to + 1] = image.data[from + 1];
      data[to + 2] = image.data[from + 2];
      data[to + 3] = 255;
    }
  return { data, width, height };
}

/** Rotation with white padding; the inverse mapping avoids gaps in the output. */
export function rotatePixels(image: Pixels, radians: number): Pixels {
  const cos = Math.cos(radians),
    sin = Math.sin(radians);
  const width = Math.ceil(Math.abs(image.width * cos) + Math.abs(image.height * sin));
  const height = Math.ceil(Math.abs(image.height * cos) + Math.abs(image.width * sin));
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2,
        dy = y - height / 2;
      const sx = cos * dx + sin * dy + image.width / 2,
        sy = -sin * dx + cos * dy + image.height / 2;
      if (sx < 0 || sy < 0 || sx >= image.width - 1 || sy >= image.height - 1) continue;
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        fx = sx - x0,
        fy = sy - y0,
        to = (y * width + x) * 4;
      for (let c = 0; c < 3; c++)
        data[to + c] =
          (1 - fy) *
            ((1 - fx) * image.data[(y0 * image.width + x0) * 4 + c] +
              fx * image.data[(y0 * image.width + x0 + 1) * 4 + c]) +
          fy *
            ((1 - fx) * image.data[((y0 + 1) * image.width + x0) * 4 + c] +
              fx * image.data[((y0 + 1) * image.width + x0 + 1) * 4 + c]);
    }
  return { data, width, height };
}

function isRed(r: number, g: number, b: number) {
  return r > 70 && r > g * 1.45 && r > b * 1.35;
}

/** Join hairline cracks in printed regions without filling the much larger star cut-outs. */
function closeCracks(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const filter = (input: Uint8Array, erode: boolean) => {
    const stride = width + 1;
    const integral = new Uint32Array(stride * (height + 1));
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) {
        sum += input[y * width + x];
        integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
      }
    }
    const output = new Uint8Array(input.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - radius),
          x1 = Math.min(width, x + radius + 1);
        const y0 = Math.max(0, y - radius),
          y1 = Math.min(height, y + radius + 1);
        const count =
          integral[y1 * stride + x1] -
          integral[y0 * stride + x1] -
          integral[y1 * stride + x0] +
          integral[y0 * stride + x0];
        output[y * width + x] = Number(erode ? count === (x1 - x0) * (y1 - y0) : count > 0);
      }
    return output;
  };
  return filter(filter(mask, false), true);
}

/** Remove colour competition: red captions become black and the yellow paper becomes white. */
export function prepareLabelText(image: Pixels): Pixels {
  const data = new Uint8ClampedArray(image.data.length);
  for (let p = 0; p < image.width * image.height; p++) {
    const r = image.data[p * 4],
      g = image.data[p * 4 + 1],
      b = image.data[p * 4 + 2];
    const yellow = r > 90 && g > 70 && Math.min(r, g) > b * 1.55 && r < g * 1.85;
    const value = isRed(r, g, b)
      ? 0
      : yellow
        ? 255
        : Math.max(0, Math.min(255, (((r + g + b) / 3 - 40) * 255) / 160));
    data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = value;
    data[p * 4 + 3] = 255;
  }
  return { data, width: image.width, height: image.height };
}

export function components(
  mask: Uint8Array,
  width: number,
  height: number,
  minimum = 30,
): Region[] {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const regions: Region[] = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || seen[seed]) continue;
    let count = 1,
      area = 0,
      x0 = width,
      x1 = 0,
      y0 = height,
      y1 = 0;
    stack[0] = seed;
    seen[seed] = 1;
    while (count) {
      const p = stack[--count],
        x = p % width,
        y = Math.floor(p / width);
      area++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      const neighbours = [
        x > 0 ? p - 1 : -1,
        x + 1 < width ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y + 1 < height ? p + width : -1,
      ];
      for (const next of neighbours)
        if (next >= 0 && mask[next] && !seen[next]) {
          seen[next] = 1;
          stack[count++] = next;
        }
    }
    if (area >= minimum)
      regions.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, area });
  }
  return regions.sort((a, b) => b.area - a.area);
}

export function findLabelRegions(image: Pixels): LabelRegions {
  const { data, width, height } = image;
  let red: Uint8Array = new Uint8Array(width * height),
    yellow: Uint8Array = new Uint8Array(width * height);
  for (let p = 0; p < red.length; p++) {
    const r = data[p * 4],
      g = data[p * 4 + 1],
      b = data[p * 4 + 2];
    red[p] = Number(isRed(r, g, b));
    yellow[p] = Number(r > 90 && g > 70 && Math.min(r, g) > b * 1.55 && r < g * 1.85);
  }
  const crackRadius = Math.max(1, Math.round(Math.min(width, height) * 0.0025));
  const rawRed = red;
  red = closeCracks(red, width, height, crackRadius);
  yellow = closeCracks(yellow, width, height, crackRadius);
  const body = components(yellow, width, height, width * height * 0.002).find(
    (r) =>
      r.width > width * 0.12 &&
      r.height > height * 0.06 &&
      r.width / r.height > 0.4 &&
      r.width / r.height < 4,
  );
  const redRegions = components(red, width, height, 80);
  let consumption = body
    ? redRegions
        .filter(
          (r) =>
            r.x > body.x &&
            r.x + r.width < body.x + body.width &&
            r.y > body.y &&
            r.y + r.height < body.y + body.height &&
            r.width > body.width * 0.14 &&
            r.height > 12 &&
            r.width / r.height > 1.3 &&
            r.width / r.height < 9 &&
            r.area / (r.width * r.height) > 0.4,
        )
        .sort((a, b) => a.y - b.y)
    : [];
  const largestPanel = Math.max(0, ...consumption.map((r) => r.area));
  consumption = consumption.filter((r) => r.area >= largestPanel * 0.45);
  let arc = body
    ? redRegions.find(
        (r) =>
          r.y + r.height < body.y &&
          r.x >= body.x - body.width * 0.2 &&
          r.x < body.x + body.width &&
          r.width > body.width * 0.14 &&
          r.height > body.width * 0.12,
      )
    : undefined;
  const filledArc = arc;
  const superArc =
    body && filledArc
      ? redRegions.find(
          (r) =>
            r !== filledArc &&
            r.x >= body.x - body.width * 0.15 &&
            r.x + r.width <= body.x + body.width * 1.15 &&
            r.y < filledArc.y - body.width * 0.08 &&
            r.y + r.height < filledArc.y + filledArc.height * 0.25 &&
            r.width > body.width * 0.4 &&
            r.area > body.width * body.width * 0.015,
        )
      : undefined;
  // Preserve precise half-star boundaries when the original arc is intact.
  // Only broken arcs need the repaired mask for the star estimate.
  let starRed = red;
  if (filledArc && !superArc) {
    const original = components(rawRed, width, height, 80).find(
      (r) =>
        r.x >= filledArc.x - 2 &&
        r.y >= filledArc.y - 2 &&
        r.x + r.width <= filledArc.x + filledArc.width + 2 &&
        r.y + r.height <= filledArc.y + filledArc.height + 2 &&
        r.area >= filledArc.area * 0.8 &&
        r.width >= filledArc.width * 0.9 &&
        r.height >= filledArc.height * 0.9,
    );
    if (original) {
      arc = original;
      starRed = rawRed;
    }
  }
  return { body, consumption, red, starRed, arc, superArc };
}

export function cropPixels(
  image: Pixels,
  region: Pick<Region, "x" | "y" | "width" | "height">,
  scale = 1,
): Pixels {
  const x0 = Math.max(0, Math.floor(region.x)),
    y0 = Math.max(0, Math.floor(region.y));
  const sourceWidth = Math.min(image.width - x0, Math.ceil(region.width)),
    sourceHeight = Math.min(image.height - y0, Math.ceil(region.height));
  const width = Math.max(1, Math.round(sourceWidth * scale)),
    height = Math.max(1, Math.round(sourceHeight * scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const from =
        ((y0 + Math.min(sourceHeight - 1, Math.floor(y / scale))) * image.width +
          x0 +
          Math.min(sourceWidth - 1, Math.floor(x / scale))) *
        4;
      const to = (y * width + x) * 4;
      data[to] = image.data[from];
      data[to + 1] = image.data[from + 1];
      data[to + 2] = image.data[from + 2];
      data[to + 3] = 255;
    }
  return { data, width, height };
}

function linearFit(points: Array<[number, number]>): [number, number] {
  const n = points.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  return [slope, (sy - slope * sx) / (n || 1)];
}

export function estimateLabelTilt(image: Pixels, regions: LabelRegions): number {
  const panel = [...regions.consumption].sort((a, b) => b.area - a.area)[0];
  if (!panel) return 0;
  const top: Array<[number, number]> = [],
    bottom: Array<[number, number]> = [];
  for (let x = Math.ceil(panel.x + panel.width * 0.3); x < panel.x + panel.width * 0.7; x++) {
    let first = -1,
      last = -1;
    for (let y = panel.y; y < panel.y + panel.height; y++)
      if (regions.red[y * image.width + x]) {
        if (first < 0) first = y;
        last = y;
      }
    if (last - first > panel.height * 0.25) {
      top.push([x, first]);
      bottom.push([x, last]);
    }
  }
  const topSlope = linearFit(top)[0],
    bottomSlope = linearFit(bottom)[0];
  // Converging edges indicate perspective, not a simple camera roll. Keep local rectification in that case.
  if (Math.abs(topSlope - bottomSlope) > 0.035) return 0;
  return Math.atan((topSlope + bottomSlope) / 2);
}

/** Flatten a red consumption panel, reverse white-on-red digits and remove its small program heading. */
export function prepareConsumption(image: Pixels, region: Region, red: Uint8Array): Pixels {
  const top: Array<[number, number]> = [],
    bottom: Array<[number, number]> = [];
  for (let x = Math.ceil(region.x + region.width * 0.15); x < region.x + region.width * 0.85; x++) {
    let first = -1,
      last = -1;
    for (let y = region.y; y < region.y + region.height; y++)
      if (red[y * image.width + x]) {
        if (first < 0) first = y;
        last = y;
      }
    if (last - first > region.height * 0.35) {
      top.push([x, first]);
      bottom.push([x, last]);
    }
  }
  const [mt, bt] = linearFit(top),
    [mb, bb] = linearFit(bottom);
  const width = 800,
    height = Math.max(100, Math.round((width * region.height) / region.width));
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sx = region.x + (x / width) * (region.width - 1);
      const sy = mt * sx + bt + (y / height) * (mb * sx + bb - (mt * sx + bt));
      const p =
        (Math.max(0, Math.min(image.height - 1, Math.round(sy))) * image.width +
          Math.max(0, Math.min(image.width - 1, Math.round(sx)))) *
        4;
      const r = image.data[p],
        g = image.data[p + 1],
        b = image.data[p + 2];
      const black =
        Math.min(r, g, b) > 60 &&
        Math.max(r, g, b) / Math.max(1, Math.min(r, g, b)) < 1.65 &&
        y > height * 0.025 &&
        y < height * 0.975 &&
        x > width * 0.03 &&
        x < width * 0.97;
      ink[y * width + x] = Number(black);
    }
  const glyphs = components(ink, width, height, 35).filter(
    (r) => r.height > height * 0.27 && r.height < height * 0.98 && r.width < width * 0.32,
  );
  const keep = new Uint8Array(ink.length);
  for (const glyph of glyphs)
    for (let y = glyph.y; y < glyph.y + glyph.height; y++)
      for (let x = glyph.x; x < glyph.x + glyph.width; x++)
        keep[y * width + x] = ink[y * width + x];
  for (let p = 0; p < keep.length; p++)
    if (keep[p]) data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 0;
  return { data, width, height };
}

/** Estimate the filled sector of the standard six-star semicircle. Always a reviewable estimate. */
function countFilledStars(image: Pixels, red: Uint8Array, arc: Region, labelWidth: number): number {
  const localWidth = arc.width + 4,
    localHeight = arc.height + 4;
  const white = new Uint8Array(localWidth * localHeight);
  for (let y = 0; y < localHeight; y++)
    for (let x = 0; x < localWidth; x++) {
      const sx = arc.x + x - 2,
        sy = arc.y + y - 2;
      if (sx >= 0 && sx < image.width && sy >= 0 && sy < image.height)
        white[y * localWidth + x] = 1 - red[sy * image.width + sx];
    }
  const holes = components(white, localWidth, localHeight, 20).filter(
    (r) =>
      r.width > labelWidth * 0.025 &&
      r.width < labelWidth * 0.22 &&
      r.height > labelWidth * 0.025 &&
      r.height < labelWidth * 0.23 &&
      r.width / r.height > 0.45 &&
      r.width / r.height < 1.7,
  );
  let fullStars = 0;
  for (const hole of holes) {
    let surrounding = 0,
      total = 0;
    for (let y = Math.max(0, hole.y - 2); y < Math.min(localHeight, hole.y + hole.height + 2); y++)
      for (
        let x = Math.max(0, hole.x - 2);
        x < Math.min(localWidth, hole.x + hole.width + 2);
        x++
      ) {
        surrounding += 1 - white[y * localWidth + x];
        total++;
      }
    if (surrounding / total > 0.38) fullStars++;
  }
  return fullStars;
}

export function estimateGraphicStars(image: Pixels, regions: LabelRegions): number | undefined {
  const { body, arc, superArc } = regions;
  const red = regions.starRed ?? regions.red;
  if (!body || !arc) return undefined;
  const fullStars = countFilledStars(image, red, arc, body.width);
  if (superArc) {
    const extra = countFilledStars(image, red, superArc, body.width);
    return fullStars === 6 && extra >= 1 && extra <= 4 ? 6 + extra : undefined;
  }
  const left = body.x,
    right = body.x + body.width;
  let top = arc.y;
  const bottom = arc.y + arc.height - 1;
  let minX = left;
  for (let y = Math.max(0, Math.floor(arc.y - body.width * 0.5)); y < bottom; y++) {
    let count = 0;
    for (
      let x = Math.max(0, Math.floor(left - body.width * 0.08));
      x < Math.min(image.width, right + body.width * 0.08);
      x++
    )
      if (red[y * image.width + x]) count++;
    if (count > body.width * 0.035) {
      top = y;
      break;
    }
  }
  const lowerRed: number[] = [];
  for (let y = Math.max(top, bottom - 6); y <= bottom; y++)
    for (
      let x = Math.max(0, Math.floor(left - body.width * 0.1));
      x < Math.min(image.width, right + body.width * 0.1);
      x++
    )
      if (red[y * image.width + x]) lowerRed.push(x);
  if (lowerRed.length) minX = Math.min(...lowerRed);
  const maxX = right + (left - minX);
  const cx = (minX + maxX) / 2,
    rx = (maxX - minX) / 2,
    ry = bottom - top;
  if (ry < rx * 0.45 || ry > rx * 1.55) return undefined;
  let lastFilled = 0;
  for (let degree = 2; degree < 178; degree++) {
    const theta = ((180 - degree) * Math.PI) / 180;
    let filled = 0,
      samples = 0;
    for (let radius = 0.61; radius <= 0.96; radius += 0.025) {
      const x = Math.round(cx + Math.cos(theta) * rx * radius),
        y = Math.round(bottom - Math.sin(theta) * ry * radius);
      if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
        filled += red[y * image.width + x];
        samples++;
      }
    }
    if (filled / Math.max(1, samples) > 0.5) lastFilled = degree;
  }
  const estimate = (lastFilled / 180) * 6;
  const rounded = Math.round(estimate * 2) / 2;
  // Cracks can open the enclosed white stars, making hole counts too small.
  if (regions.starRed === regions.red && rounded >= 1 && rounded <= 6) return rounded;
  if (fullStars >= 1 && fullStars <= 6) return rounded === fullStars + 0.5 ? rounded : fullStars;
  return rounded >= 1 && rounded <= 6 ? rounded : undefined;
}
