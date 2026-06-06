import { mkdir, access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
export const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz";
export const MODEL_DIRECTORY = ".cache/tesseract";
export interface OnlineFixture {
  file: string;
  category: string;
  kwh: number;
  stars: number;
  source: string;
  url: string;
  notes: string;
}
export async function onlineFixtures(): Promise<OnlineFixture[]> {
  return JSON.parse(await readFile("tests/fixtures/labels/official/manifest.json", "utf8"));
}
async function downloadMissing(url: string, destination: string) {
  try {
    await access(destination);
    return;
  } catch {}
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch OCR fixture (${response.status}): ${url}`);
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}
export async function prepareFixtures() {
  await mkdir(MODEL_DIRECTORY, { recursive: true });
  await mkdir(".cache/ocr", { recursive: true });
  await downloadMissing(MODEL_URL, path.join(MODEL_DIRECTORY, "eng.traineddata.gz"));
  const fixtures = await onlineFixtures();
  for (const fixture of fixtures)
    await downloadMissing(fixture.url, path.join("tests/fixtures/labels/official", fixture.file));
  return fixtures;
}
