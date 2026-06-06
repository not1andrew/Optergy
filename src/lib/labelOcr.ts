import type { ImageLike, Worker } from "tesseract.js";
import { PSM } from "tesseract.js";
import {
  countDigitGroups,
  cropPixels,
  estimateGraphicStars,
  estimateLabelTilt,
  findLabelRegions,
  normaliseExposure,
  prepareConsumption,
  prepareLabelText,
  rotatePixels,
  rotateQuarterTurn,
  type Pixels,
} from "./labelImage";
import {
  hasNonAnnualEnergyContext,
  parseLabelText,
  plausibleKwh,
  type ParsedLabel,
} from "./labelParser";

export interface LabelScan extends ParsedLabel {
  rawText: string;
}
export type PixelEncoder = (pixels: Pixels) => Promise<ImageLike>;
function hasAnnualContext(text: string): boolean {
  // Cracks often introduce punctuation or one extra glyph in "per". Keep the
  // actual unit and year on the same short line; never relax nonannual rejection.
  return (
    !hasNonAnnualEnergyContext(text) &&
    /energy\s*[cCsS][oO0][nN][sS][uU][mM][pP][tT][iI][oO0][nN]|k\s*[wv]{1,2}\s*h[^\d\n]{0,16}\byear\b/i.test(
      text,
    )
  );
}

/** Shared scan orchestration: isolate the label, OCR context, then rectify the actual consumption panel. */
export async function recogniseLabel(
  image: Pixels,
  worker: Worker,
  encode: PixelEncoder,
  onProgress: (progress: number) => void = () => {},
): Promise<LabelScan> {
  let regions = findLabelRegions(image);
  if (!regions.arc || !regions.consumption.length) {
    let rotated = image;
    const score = (r: typeof regions) =>
      Number(!!r.body) + Number(!!r.arc) * 2 + Number(!!r.consumption.length) * 3;
    for (let turn = 0; turn < 3; turn++) {
      rotated = rotateQuarterTurn(rotated);
      const candidate = findLabelRegions(rotated);
      if (score(candidate) > score(regions)) {
        regions = candidate;
        image = rotated;
      }
      if (score(regions) === 6) break;
    }
  }
  const beforeDeskew = image,
    regionsBeforeDeskew = regions;
  const tilt = estimateLabelTilt(image, regions);
  if (Math.abs(tilt) > 0.05 && Math.abs(tilt) < 0.5) {
    const upright = rotatePixels(image, -tilt);
    const corrected = findLabelRegions(upright);
    if (corrected.body && corrected.consumption.length) {
      image = upright;
      regions = corrected;
    }
  }
  const body = regions.body;
  const topMargin = regions.superArc ? 1.25 : 0.95;
  const label = body
    ? cropPixels(image, {
        x: body.x - 8,
        y: Math.max(0, body.y - body.width * topMargin),
        width: body.width + 16,
        height: body.height + body.width * topMargin + 16,
      })
    : image;
  const source = await encode(prepareLabelText(label));
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    tessedit_char_whitelist: "",
    user_defined_dpi: "300",
  });
  const first = (await worker.recognize(source, { rotateAuto: true })).data;
  onProgress(0.3);
  let rawText = first.text;
  let parsed = parseLabelText(rawText);
  const panelValues: number[] = [];
  const panelTexts: string[] = [];
  let incompletePanel = false;
  for (const panel of regions.consumption) {
    const prepared = prepareConsumption(image, panel, regions.red);
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "0123456789",
    });
    const digitImage = await encode(prepared);
    let digits = (await worker.recognize(digitImage)).data;
    const glyphCount = countDigitGroups(prepared);
    const complete = (text: string) =>
      glyphCount < 2 || glyphCount > 4 || text.trim().length === glyphCount;
    if (!complete(digits.text)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE });
      const retry = (await worker.recognize(digitImage)).data;
      if (complete(retry.text)) digits = retry;
    }
    panelTexts.push(digits.text.trim());
    if (!complete(digits.text)) incompletePanel = true;
    const value = Number(digits.text.replace(/\s/g, ""));
    if (/^\d{2,4}$/.test(digits.text.trim()) && plausibleKwh(value) && complete(digits.text)) {
      let accepted = digits.confidence >= 35;
      if (!accepted) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE });
        const retry = (await worker.recognize(digitImage)).data;
        accepted = retry.text.trim() === digits.text.trim() && retry.confidence >= 35;
      }
      if (accepted) panelValues.push(value);
    }
  }
  onProgress(0.65);
  // Retry layout after preprocessing rather than stopping on any vaguely plausible number.
  if (
    parsed.kwhPerYear === undefined ||
    !/energy\s*consumption|k\s*w\s*h\s*per\s*year/i.test(rawText)
  ) {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "",
    });
    const second = (await worker.recognize(source, { rotateAuto: true })).data.text;
    rawText += "\n" + second;
    parsed = parseLabelText(rawText);
  }
  // Heavy contrast helps faded red captions but can remove tiny text: retain a colour fallback.
  if (!hasAnnualContext(rawText)) {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "",
    });
    rawText += "\n" + (await worker.recognize(await encode(label), { rotateAuto: true })).data.text;
    parsed = parseLabelText(rawText);
  }
  if (!hasAnnualContext(rawText) && image !== beforeDeskew && regionsBeforeDeskew.body) {
    const originalBody = regionsBeforeDeskew.body;
    const originalLabel = cropPixels(beforeDeskew, {
      x: originalBody.x - 8,
      y: Math.max(0, originalBody.y - originalBody.width * 0.95),
      width: originalBody.width + 16,
      height: originalBody.height + originalBody.width * 0.95 + 16,
    });
    rawText +=
      "\n" + (await worker.recognize(await encode(originalLabel), { rotateAuto: true })).data.text;
    parsed = parseLabelText(rawText);
  }
  // A cracked old label can destroy full-page segmentation. Read the caption and unit
  // immediately around the detected panel at a larger scale, retaining period checks.
  if (!hasAnnualContext(rawText) && regions.consumption.length === 1) {
    const panel = regions.consumption[0];
    const caption = cropPixels(
      image,
      {
        x: panel.x - panel.width * 0.55,
        y: panel.y - panel.height * 0.85,
        width: panel.width * 2.1,
        height: panel.height * 3.2,
      },
      2,
    );
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "",
    });
    rawText += "\n" + (await worker.recognize(await encode(normaliseExposure(caption)))).data.text;
    parsed = parseLabelText(rawText);
  }
  const hasContext = hasAnnualContext(rawText);
  if (hasContext && !panelValues.length && image !== beforeDeskew) {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "0123456789",
    });
    for (const panel of regionsBeforeDeskew.consumption) {
      const prepared = prepareConsumption(beforeDeskew, panel, regionsBeforeDeskew.red);
      const data = (await worker.recognize(await encode(prepared))).data;
      panelTexts.push("before rotation: " + data.text.trim());
      const value = Number(data.text.trim());
      const groups = countDigitGroups(prepared);
      const complete = groups < 2 || groups > 4 || data.text.trim().length === groups;
      if (!complete) incompletePanel = true;
      if (
        /^\d{2,4}$/.test(data.text.trim()) &&
        plausibleKwh(value) &&
        data.confidence >= 35 &&
        complete
      )
        panelValues.push(value);
    }
  }
  const distinct = [...new Set(panelValues)];
  const warnings = [...(parsed.warnings ?? [])];
  if (hasNonAnnualEnergyContext(rawText))
    warnings.push(
      "This label includes a nonannual energy figure. Use a clearly marked kWh per year figure.",
    );
  if (hasContext && distinct.length === 1) {
    if (parsed.kwhPerYear !== undefined && parsed.kwhPerYear !== distinct[0])
      warnings.push(
        "The text and number scans disagree. Check the large annual kWh figure on the label.",
      );
    parsed.kwhPerYear = distinct[0];
    parsed.confidence = warnings.length ? "low" : "high";
  } else if (distinct.length > 1) {
    parsed.kwhPerYear = undefined;
    warnings.push(
      "Multiple consumption panels detected. Enter the annual figure for your chosen program.",
    );
  }
  if (!distinct.length && incompletePanel) {
    parsed.kwhPerYear = undefined;
    parsed.confidence = "low";
    warnings.push(
      "Part of the consumption number is damaged or missing from the scan. Check every digit on the label.",
    );
  }
  if (parsed.stars === undefined && hasContext) {
    parsed.stars =
      estimateGraphicStars(image, regions) ??
      estimateGraphicStars(beforeDeskew, regionsBeforeDeskew);
    if (parsed.stars !== undefined) parsed.starSource = "graphic";
  }
  if (parsed.kwhPerYear === undefined)
    warnings.push(
      "The annual kWh figure could not be read safely. Enter it from the label or try a closer photo.",
    );
  if (parsed.stars === undefined)
    warnings.push("Check the star arc and enter the rating if it was not detected.");
  else if (parsed.starSource === "graphic")
    warnings.push("Star rating estimated from the red arc. Please check it against the label.");
  onProgress(1);
  return {
    ...parsed,
    needsReview: true,
    warnings,
    rawText:
      rawText +
      (panelTexts.length ? "\n[Consumption panel OCR: " + panelTexts.join("; ") + "]" : ""),
  };
}
