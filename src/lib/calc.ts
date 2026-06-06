import type { EfficientProduct } from "./products";

export const LIFETIME_YEARS = 10;

export interface CostBreakdown {
  annualKwh: number;
  annualCost: number;
  lifetimeCost: number;
  annualCo2Kg: number;
}

export function costBreakdown(
  annualKwh: number,
  tariffCentsPerKwh: number,
  co2KgPerKwh: number,
): CostBreakdown {
  const annualCost = (annualKwh * tariffCentsPerKwh) / 100;
  return {
    annualKwh,
    annualCost,
    lifetimeCost: annualCost * LIFETIME_YEARS,
    annualCo2Kg: annualKwh * co2KgPerKwh,
  };
}

export interface Recommendation {
  product: EfficientProduct;
  annualSaving: number;
  lifetimeSaving: number;
  /** Ten-year energy savings less the complete replacement purchase price. */
  netLifetimeSaving: number;
  co2SavingKgPerYear: number;
  /** Years for energy savings to cover the purchase price; null if no saving. */
  paybackYears: number | null;
}

export function buildRecommendations(
  currentKwh: number,
  alternatives: EfficientProduct[],
  tariffCentsPerKwh: number,
  co2KgPerKwh: number,
): Recommendation[] {
  return alternatives
    .map((product) => {
      const kwhSaved = currentKwh - product.kwhPerYear;
      const annualSaving = (kwhSaved * tariffCentsPerKwh) / 100;
      return {
        product,
        annualSaving,
        lifetimeSaving: annualSaving * LIFETIME_YEARS,
        netLifetimeSaving: annualSaving * LIFETIME_YEARS - product.approxPriceAud,
        co2SavingKgPerYear: kwhSaved * co2KgPerKwh,
        paybackYears: annualSaving > 0 ? product.approxPriceAud / annualSaving : null,
      };
    })
    .filter((r) => r.annualSaving > 0)
    .sort(
      (a, b) =>
        (a.paybackYears ?? Infinity) - (b.paybackYears ?? Infinity) ||
        b.annualSaving - a.annualSaving ||
        a.product.id.localeCompare(b.product.id),
    );
}

export function formatAud(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAudPrecise(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(amount);
}
