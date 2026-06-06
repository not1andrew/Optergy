/** Parse annual consumption only when its unit/context is present. Never guess from a model or standard number. */
export interface ParsedLabel {
  kwhPerYear?: number;
  stars?: number;
  categoryId?: string;
  capacity?: number;
  confidence?: "high" | "medium" | "low";
  starSource?: "text" | "graphic";
  warnings?: string[];
  needsReview?: boolean;
}

export function plausibleKwh(value: number): boolean {
  return Number.isFinite(value) && value >= 20 && value <= 6000;
}

function hasNonAnnualPeriod(afterUnit: string): boolean {
  const period = afterUnit.match(/^\s*(?:\/|per\b)\s*(.*)/i);
  // Only explicit nonannual units are rejected here; a broken OCR fragment of "per year" is not a unit.
  if (
    period &&
    /^(?:\d+\s*)?(?:days?|weeks?|months?|quarters?|hours?|hrs?|minutes?|mins?|seconds?|secs?|cycles?|washes|wash|loads?)\b/i.test(
      period[1],
    )
  )
    return true;
  return /^\s*(?:daily|weekly|monthly|hourly|quarterly|day|week|month|hour|minute|second|cycle)\b/i.test(
    afterUnit,
  );
}

/** Also used by the image pipeline so a panel number cannot bypass the text parser's unit rejection. */
export function hasNonAnnualEnergyContext(text: string): boolean {
  for (const unit of text.matchAll(/k\s*[wv]{1,2}\s*[hni]\b/gi)) {
    if (hasNonAnnualPeriod(text.slice((unit.index ?? 0) + unit[0].length))) return true;
  }
  return false;
}

export function parseLabelText(rawText: string): ParsedLabel {
  const text = rawText.replace(/\r/g, "").replace(/[−–]/g, "-");
  const result: ParsedLabel = { needsReview: true };
  const unit = "k\\s*[wv]{1,2}\\s*[hni]";
  const number = "(\\d{1,4}(?:,\\d{3})?(?:\\.\\d+)?)";
  const candidates: number[] = [];
  const pattern = new RegExp(`(?<![\\w.])${number}\\s*${unit}\\b`, "gi");
  for (const match of text.matchAll(pattern)) {
    const after = text.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 40,
    );
    const before = text.slice(Math.max(0, (match.index ?? 0) - 45), match.index);
    // A monthly/cycle total needs a usage conversion before it can be treated as annual.
    if (hasNonAnnualPeriod(after)) continue;
    if (
      /(?:cold\s*wash|program\s*time)[^\n]*$/i.test(before) &&
      !/energy\s*consumption/i.test(before)
    )
      continue;
    if (/(?:model|AS\s*\/\s*NZS)\s*[\w-]*\s*$/i.test(before)) continue;
    const value = Number(match[1].replace(/,/g, ""));
    if (plausibleKwh(value)) candidates.push(value);
  }
  if (!candidates.length) {
    const anchored = text.match(
      /energy\s+consumption[\s:]*\n?(?:warm\s+wash\s*)?(\d{2,4})\s*(?:[kK]?[wW][hH]\s*)?(?:per\s+year|\/\s*year)/i,
    );
    if (anchored && plausibleKwh(Number(anchored[1]))) candidates.push(Number(anchored[1]));
  }
  const distinct = [...new Set(candidates)];
  if (distinct.length === 1) {
    result.kwhPerYear = distinct[0];
    result.confidence = "medium";
  } else if (distinct.length > 1) {
    result.warnings = [
      "Several energy figures were found. Enter the annual figure for the program you use.",
    ];
  }
  // Consume the complete numeric token before validating its half-star step; 4.8 must not become 4 or 8.
  const starMatch =
    text.match(/(?:energy\s+)?star\s*rating\s*[:=]?\s*(\d{1,2}(?:\.\d+)?)\b(?!\d|\.\d)/i) ??
    text.match(
      /(?<![\w.])(\d{1,2}(?:\.\d+)?)(?!\d|\.\d)[ \t]*(?:energy[ \t]+)?stars?\b(?!\s+(?:the|more|tl)\b)/i,
    );
  if (starMatch) {
    const stars = Number(starMatch[1]);
    const prefix = text.slice(Math.max(0, (starMatch.index ?? 0) - 35), starMatch.index);
    if (stars >= 1 && stars <= 10 && Number.isInteger(stars * 2) && !/water[^\n]*$/i.test(prefix)) {
      result.stars = stars;
      result.starSource = "text";
    }
  }
  if (/clothes\s*dryer|tumble\s*dryer|heat\s*pump\s*dryer/i.test(text)) result.categoryId = "dryer";
  else if (/clothes\s*washer|washing\s*machine/i.test(text)) result.categoryId = "washer";
  else if (/dish\s*washer/i.test(text)) result.categoryId = "dishwasher";
  else if (/refrigerator|fridge|freezer/i.test(text)) result.categoryId = "fridge";
  else if (/television/i.test(text)) result.categoryId = "tv";
  const capacity = text.match(
    /(?:load\s*capacity|rated\s*capacity)\s*[:=]?\s*(\d{1,3}(?:\.\d)?)\s*(?:kg|litres|l\b|place)/i,
  );
  if (capacity) result.capacity = Number(capacity[1]);
  return result;
}
