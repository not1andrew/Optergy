import assert from "node:assert/strict";
import { parseLabelText } from "../src/lib/labelParser";
import { recogniseLabel } from "../src/lib/labelOcr";
import { PSM, type Worker } from "tesseract.js";

const cases: Array<{ name: string; text: string; kwh?: number; stars?: number }> = [
  {
    name: "annual value and decimal stars",
    text: "ENERGY RATING\n4.5 stars\nEnergy consumption\n365\nkWh per year",
    kwh: 365,
    stars: 4.5,
  },
  { name: "OCR double-v unit", text: "Energy consumption 512 kVVh per year", kwh: 512 },
  {
    name: "OCR final unit letter",
    text: "ENERGY\nRATING\n208\nkwn per year 8 star",
    kwh: 208,
    stars: 8,
  },
  {
    name: "model does not override labelled consumption",
    text: "model X-2000, energy consumption 290 kWh",
    kwh: 290,
  },
  {
    name: "standard number is not energy",
    text: "Energy consumption\nkWh per year\nAS/NZS 2442.2",
  },
  { name: "model number is not energy", text: "BOSCH WAE22464AU 1100 rpm 7 kg AS/NZS 2040.2" },
  {
    name: "program minutes are not energy",
    text: "Energy consumption\nkWh per year\nProgram Time 123 min",
  },
  {
    name: "other standalone numbers are not energy",
    text: "2026 model 480 litres 240 volts 1100 rpm",
  },
  { name: "unrelated yearly number", text: "Warranty offer 365 per year" },
  { name: "no-number text", text: "No readable figure here" },
  { name: "comma thousands", text: "Energy consumption 1,234 kWh per year", kwh: 1234 },
  { name: "decimal annual figure", text: "Energy consumption 125.5 kWh per year", kwh: 125.5 },
  { name: "cycle label is not annual", text: "Energy consumption 250 kWh per 100 cycles" },
  { name: "daily label is not annual", text: "Energy consumption 150 kWh per day" },
  { name: "per-cycle figure is not annual", text: "Energy consumption 50 kWh/cycle" },
  {
    name: "conflicting annual readings require review",
    text: "Energy consumption 265 kWh per year\nEnergy consumption 315 kWh per year",
  },
  {
    name: "repeated same figure is not a conflict",
    text: "Energy consumption 265 kWh per year\n265 kWh per year",
    kwh: 265,
  },
  { name: "explicit star heading", text: "Energy star rating: 3.5", stars: 3.5 },
  { name: "water stars are not energy stars", text: "Water rating 4 stars, 73 litres per wash" },
  { name: "invalid star range", text: "15 stars" },
  {
    name: "star scale numerals are not the rating",
    text: "ENERGY RATING 1 2 3 4 5 6\nThe more stars the more energy efficient",
  },
  { name: "model immediately beside unit rejected", text: "Model ABC315 kWh per year" },
  {
    name: "implausibly large annual figure rejected",
    text: "Energy consumption 9000 kWh per year",
  },
  {
    name: "unit lost but heading and year survive",
    text: "Energy consumption\n315\nWh per year",
    kwh: 315,
  },
  { name: "monthly figure is not annual", text: "Energy consumption 250 kWh per month" },
  { name: "weekly slash figure is not annual", text: "Energy consumption 250 kWh / week" },
  { name: "hourly figure is not annual", text: "Energy consumption 250 kWh per hour" },
  { name: "adverbial period is not annual", text: "Energy consumption 250 kWh monthly" },
  { name: "per-annum figure is annual", text: "Energy consumption 250 kWh per annum", kwh: 250 },
  { name: "invalid decimal after star heading", text: "Energy star rating 4.8" },
  { name: "invalid decimal before stars", text: "4.8 stars" },
  { name: "fraction is not a trailing integer star", text: ".8 stars" },
  { name: "malformed decimal is not partial star", text: "4.5.8 stars" },
  {
    name: "half-star heading with sentence punctuation",
    text: "Energy star rating: 4.5.",
    stars: 4.5,
  },
  {
    name: "crack mistaken for number above star slogan",
    text: "ENERGY RATING\n2\n\nstars tl\nmore\nenergy efficient",
  },
  { name: "number next to explanatory slogan", text: "2 stars the more energy efficient" },
];
for (const test of cases) {
  const parsed = parseLabelText(test.text);
  assert.equal(parsed.kwhPerYear, test.kwh, `${test.name}: kWh`);
  assert.equal(parsed.stars, test.stars, `${test.name}: stars`);
  assert.equal(parsed.needsReview, true, `${test.name}: review required`);
}
const appliance = parseLabelText(
  "Fisher & Paykel Clothes Dryer Model DE7060\nLoad capacity 7.0 kg\nEnergy consumption 315 kWh per year",
);
assert.equal(appliance.categoryId, "dryer");
assert.equal(appliance.capacity, 7);

// The OCR orchestration must not replace a rejected monthly figure with an isolated red-panel number.
const width = 200,
  height = 300,
  data = new Uint8ClampedArray(width * height * 4).fill(255);
function rectangle(x0: number, y0: number, w: number, h: number, colour: [number, number, number]) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      for (let channel = 0; channel < 3; channel++)
        data[(y * width + x) * 4 + channel] = colour[channel];
}
rectangle(20, 140, 160, 130, [245, 210, 20]);
rectangle(65, 195, 70, 24, [230, 40, 20]);
rectangle(20, 40, 80, 60, [230, 40, 20]);
let segmentation: PSM = PSM.AUTO;
let context = "Energy consumption 250 kWh per month";
const panelText = "250\n";
const worker = {
  setParameters: async (parameters: { tessedit_pageseg_mode?: PSM }) => {
    if (parameters.tessedit_pageseg_mode) segmentation = parameters.tessedit_pageseg_mode;
  },
  recognize: async () => ({
    data: {
      text: segmentation === PSM.SINGLE_LINE || segmentation === PSM.RAW_LINE ? panelText : context,
      confidence: 95,
    },
  }),
} as unknown as Worker;
for (const period of ["per month", "/ week", "per 100 cycles"]) {
  context = `Energy consumption 250 kWh ${period}`;
  const result = await recogniseLabel({ data, width, height }, worker, async () => "test-fixture");
  assert.equal(result.kwhPerYear, undefined, `Panel OCR must not override ${period} rejection`);
}

console.log(
  `${cases.length} adversarial parser cases, category/capacity extraction and 3 pipeline guard cases passed. Run npm run benchmark:ocr for the actual photo pipeline.`,
);
