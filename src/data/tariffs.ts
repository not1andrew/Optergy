/** Regulated residential usage benchmarks for FY2025–26.
 * GST included; daily supply excluded.
 * The 2025–26 DMO is an annual bill cap, NOT a prescribed usage rate.
 */
export const TARIFF_PERIOD = "2025-26" as const;
export const DEFAULT_STATE_CODE = "NSW";

export interface TariffOffer {
  id: string;
  stateCode: string;
  period: typeof TARIFF_PERIOD;
  region: string;
  name: string;
  tariffCentsPerKwh: number | null;
  sourceName: string;
  sourceUrl: string;
  effectiveFrom: string;
  effectiveTo: string;
  note: string;
  basis: "regulated-usage" | "bill-required";
  annualReferenceBillAud?: number;
  annualReferenceKwh?: number;
}

const sources = {
  dmo25:
    "https://www.aer.gov.au/industry/registers/resources/reviews/default-market-offer-prices-2025-26/final-decision",
  vdo25:
    "https://www.esc.vic.gov.au/sites/default/files/documents/Victorian%20Default%20Offer%202025%E2%80%9326%20Determination.pdf",
  qld25: "https://www.qca.org.au/wp-content/uploads/2024/12/final-determination.pdf",
  wa: "https://www.wa.gov.au/organisation/energy-policy-wa/household-electricity-pricing",
  tas25:
    "https://www.economicregulator.tas.gov.au/Documents/25%201415%20Aurora%20Energy%202025%20Standing%20Offer%20Price%20Schedule%202025-26.PDF",
  act: "https://www.icrc.act.gov.au/projects/current-projects/retail-electricity-prices-2024-27",
  nt: "https://www.powerwater.com.au/pricing",
};

function offer(
  stateCode: string,
  id: string,
  region: string,
  name: string,
  rate: number | null,
  sourceName: string,
  sourceUrl: string,
  note: string,
  reference?: [number, number],
): TariffOffer {
  const period = TARIFF_PERIOD;
  const year = 2025;
  return {
    id: `${id}-${period}`,
    stateCode,
    period,
    region,
    name,
    tariffCentsPerKwh: rate,
    sourceName,
    sourceUrl,
    effectiveFrom: `${year}-07-01`,
    effectiveTo: `${year + 1}-06-30`,
    note,
    basis: rate === null ? "bill-required" : "regulated-usage",
    ...(reference
      ? { annualReferenceBillAud: reference[0], annualReferenceKwh: reference[1] }
      : {}),
  };
}

const dmoZones: [string, string, string, number, number][] = [
  ["NSW", "ausgrid", "Ausgrid", 1965, 3900],
  ["NSW", "endeavour", "Endeavour Energy", 2411, 4900],
  ["NSW", "essential", "Essential Energy", 2741, 4600],
  ["QLD", "energex", "Energex · south-east Queensland", 2143, 4600],
  ["SA", "sapn", "SA Power Networks", 2301, 4000],
];
const vicZones: [string, string, number][] = [
  ["citipower", "CitiPower", 27.33],
  ["ausnet", "AusNet Services", 34.77],
  ["jemena", "Jemena", 29.72],
  ["powercor", "Powercor", 30.09],
  ["united", "United Energy", 28.84],
];

export const TARIFF_OFFERS: TariffOffer[] = [
  ...dmoZones.map(([state, id, region, bill, usage]) =>
    offer(
      state,
      id,
      region,
      "Default Market Offer · annual reference bill",
      null,
      "Australian Energy Regulator",
      sources.dmo25,
      "The 2025–26 DMO caps a total annual bill, including supply charges. It does not prescribe a single c/kWh rate. Enter the usage rate from your bill for this period.",
      [bill, usage],
    ),
  ),
  ...vicZones.map(([id, region, rate]) =>
    offer(
      "VIC",
      id,
      region,
      "Victorian Default Offer · flat rate",
      rate,
      "Essential Services Commission",
      sources.vdo25,
      "Domestic general-usage rate from Schedule 1, including GST. Controlled-load and daily supply charges are excluded.",
    ),
  ),
  offer(
    "QLD",
    "regional-qld",
    "Regional Queensland · Ergon network",
    "QCA notified tariff 11",
    32.9725,
    "Queensland Competition Authority",
    sources.qld25,
    "Regulated residential flat rate. Published ex-GST usage rate of 29.975c multiplied by 1.10. Supply charge excluded.",
  ),
  offer(
    "WA",
    "wa-a1-a2",
    "Western Australia · A1 / A2",
    "Government residential tariff",
    32.3719,
    "WA Government · Energy Policy WA",
    sources.wa,
    "Government-set 2025–26 standard residential A1/A2 usage rate under the uniform tariff policy, including GST. WA does not use the AER Default Market Offer.",
  ),
  offer(
    "TAS",
    "tas31",
    "Tasmania · existing tariff 31",
    "Regulated light & power tariff 31",
    29.0535,
    "Tasmanian Economic Regulator",
    sources.tas25,
    "Residential light and power, including GST. Tariff 31 is closed to new connections; existing eligible premises may remain. Excludes separately metered heating.",
  ),
  offer(
    "ACT",
    "act",
    "Australian Capital Territory",
    "ICRC regulated standing offers",
    null,
    "Independent Competition and Regulatory Commission",
    sources.act,
    "The ACT regulates a basket of standing-offer tariffs rather than a universal usage price. Enter your plan’s c/kWh rate; there is no AER Default Market Offer here.",
  ),
  offer(
    "NT",
    "nt-standard",
    "Northern Territory · standard meter",
    "Government electricity pricing order",
    30.0843,
    "NT Government · Power and Water tariff schedule",
    sources.nt,
    "Government-regulated 2025–26 standard domestic rate including GST, as published in the official prior-year comparison. Meter type and usage eligibility matter; check your bill for the January 2026 pricing-order changes.",
  ),
];

export interface StateInfo {
  code: string;
  name: string;
  /** First region's 2025–26 benchmark only. Use getTariffOffers for region selection. */
  tariffCentsPerKwh: number | null;
  co2KgPerKwh: number;
  emissionsNote: string;
}
export const EMISSIONS_SOURCE_URL =
  "https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2026";
export const STATES: StateInfo[] = [
  ["NSW", "New South Wales", 0.6],
  ["VIC", "Victoria", 0.74],
  ["QLD", "Queensland", 0.65],
  ["SA", "South Australia", 0.21],
  ["WA", "Western Australia", 0.45],
  ["TAS", "Tasmania", 0.23],
  ["ACT", "Australian Capital Territory", 0.6],
  ["NT", "Northern Territory", 0.55],
].map(([code, name, factor]) => ({
  code: String(code),
  name: String(name),
  co2KgPerKwh: Number(factor),
  tariffCentsPerKwh: getTariffOffers(String(code))[0]?.tariffCentsPerKwh ?? null,
  emissionsNote: `2026 NGA location-based scope 2 estimate${code === "WA" ? " for the SWIS grid" : code === "NT" ? " for the Darwin–Katherine grid" : ""}; excludes manufacturing and upstream emissions.`,
}));

export function getTariffOffers(stateCode: string): TariffOffer[] {
  return TARIFF_OFFERS.filter((item) => item.stateCode === stateCode);
}

export function getState(code: string): StateInfo {
  return STATES.find((state) => state.code === code) ?? STATES[0];
}
