import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { recogniseLabel, type LabelScan } from "../src/lib/labelOcr";
import type { Pixels } from "../src/lib/labelImage";
import { prepareFixtures, MODEL_DIRECTORY, MODEL_URL } from "./ocr-fixtures.mjs";

const fixtures = await prepareFixtures();
const worker = await createWorker("eng", undefined, {
  langPath: MODEL_DIRECTORY,
  cachePath: MODEL_DIRECTORY,
});
const encode = async (p: Pixels) =>
  sharp(Buffer.from(p.data), { raw: { width: p.width, height: p.height, channels: 4 } })
    .png()
    .toBuffer();
interface Row {
  file: string;
  group: string;
  angle: number;
  variant?: string;
  expectedKwh: number;
  expectedStars: number;
  parsed: LabelScan;
  ms: number;
  sha256: string;
}
const rows: Row[] = [];
const agedOnly = process.argv.includes("--aged-only");
async function scan(
  file: string,
  group: string,
  kwh: number,
  stars: number,
  angle = 0,
  variant?: string,
  brightness = 1,
  saturation = 1,
) {
  const bytes = await readFile(file),
    start = performance.now();
  const maxDimension = group === "supplied" || group === "aged-variants" ? 1600 : 1200;
  const { data, info } = await sharp(bytes)
    .autoOrient()
    .flatten({ background: "white" })
    .rotate(angle, { background: "white" })
    .modulate({ brightness, saturation })
    .resize({ width: maxDimension, height: maxDimension, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const parsed = await recogniseLabel(
    { data, width: info.width, height: info.height },
    worker,
    encode,
  );
  const row = {
    file,
    group,
    angle,
    variant,
    expectedKwh: kwh,
    expectedStars: stars,
    parsed,
    ms: Math.round(performance.now() - start),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  rows.push(row);
  console.log(
    `${parsed.kwhPerYear === kwh && parsed.stars === stars ? "PASS" : "REVIEW"} ${group}: ${file} (${variant ?? angle + "°"}) → ${parsed.kwhPerYear ?? "unread"} kWh, ${parsed.stars ?? "unread"} stars`,
  );
}
try {
  const photos: Array<{ file: string; kwh: number; stars: number }> = JSON.parse(
    await readFile("tests/fixtures/labels/phone/manifest.json", "utf8"),
  );
  if (!agedOnly) {
    for (const photo of photos)
      await scan(`tests/fixtures/labels/phone/${photo.file}`, "supplied", photo.kwh, photo.stars);
    for (const fixture of fixtures)
      await scan(
        `tests/fixtures/labels/official/${fixture.file}`,
        "official",
        fixture.kwh,
        fixture.stars,
      );
    for (const fixture of fixtures)
      for (const angle of [-12, 12, 90])
        await scan(
          `tests/fixtures/labels/official/${fixture.file}`,
          "rotation",
          fixture.kwh,
          fixture.stars,
          angle,
        );
  }
  const aged = photos.find((photo) => photo.file === "sample3.jpg")!;
  for (const [variant, angle, brightness, saturation] of [
    ["roll-left", -8, 1, 1],
    ["roll-right", 8, 1, 1],
    ["quarter-turn", 90, 1, 1],
    ["dim-light", 0, 0.8, 1],
    ["faded-ink", 0, 1, 0.6],
    ["faded-dim", 0, 0.85, 0.7],
  ] as const)
    await scan(
      `tests/fixtures/labels/phone/${aged.file}`,
      "aged-variants",
      aged.kwh,
      aged.stars,
      angle,
      variant,
      brightness,
      saturation,
    );
} finally {
  await worker.terminate();
}
const summary = Object.fromEntries(
  ["supplied", "official", "rotation", "aged-variants"].map((group) => {
    const subset = rows.filter((row) => row.group === group);
    return [
      group,
      {
        total: subset.length,
        kwhCorrect: subset.filter((row) => row.parsed.kwhPerYear === row.expectedKwh).length,
        starsCorrect: subset.filter((row) => row.parsed.stars === row.expectedStars).length,
        kwhWrong: subset.filter(
          (row) => row.parsed.kwhPerYear !== undefined && row.parsed.kwhPerYear !== row.expectedKwh,
        ).length,
        starsWrong: subset.filter(
          (row) => row.parsed.stars !== undefined && row.parsed.stars !== row.expectedStars,
        ).length,
      },
    ];
  }),
);
await writeFile(
  `.cache/ocr/${agedOnly ? "aged-experiment" : "benchmark"}.json`,
  JSON.stringify(
    {
      model: MODEL_URL,
      engine: "tesseract.js 7",
      notes:
        "Development/tuning corpus, not independent held-out accuracy. Rotations and faded/dim variants are synthetic derivatives of the annotated originals.",
      summary,
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(summary, null, 2));
if (
  rows.some(
    (row) => row.parsed.kwhPerYear !== row.expectedKwh || row.parsed.stars !== row.expectedStars,
  )
)
  process.exitCode = 1;
