export const TARIFF_PERIOD = "2026-27" as const;
export const DEFAULT_STATE_CODE = "NSW";

export interface TariffOffer {
  id: string;
  stateCode: string;
  period: typeof TARIFF_PERIOD;
  network: string;
  name: string;
  tariffCentsPerKwh: number;
  sourceName: string;
  sourceUrl: string;
  effectiveFrom: string;
  effectiveTo: string;
  note: string;
}

const AER_DMO_2026_27 =
  "https://www.aer.gov.au/system/files/2026-05/AER%20-%20Final%20determination%20-%20Default%20market%20offer%202026%E2%80%9327.pdf";

function offer(
  stateCode: string,
  network: string,
  name: string,
  tariffCentsPerKwh: number,
  sourceName: string,
  sourceUrl: string,
  note: string,
): TariffOffer {
  return {
    id: `${stateCode.toLowerCase()}-${TARIFF_PERIOD}`,
    stateCode,
    period: TARIFF_PERIOD,
    network,
    name,
    tariffCentsPerKwh,
    sourceName,
    sourceUrl,
    effectiveFrom: "2026-07-01",
    effectiveTo: "2027-06-30",
    note,
  };
}

const dmoNote = (network: string) =>
  `The AER's cap on standing-offer usage charges in the ${network} area, including GST. Big retailers' standing offers sit at this cap. Daily supply charges are excluded.`;

export const TARIFF_OFFERS: TariffOffer[] = [
  offer(
    "NSW",
    "Ausgrid",
    "Default Market Offer usage cap, Ausgrid",
    33.1372,
    "Australian Energy Regulator",
    AER_DMO_2026_27,
    dmoNote("Ausgrid (Sydney)"),
  ),
  offer(
    "VIC",
    "CitiPower",
    "Victorian Default Offer, CitiPower",
    25.96,
    "Essential Services Commission",
    "https://www.esc.vic.gov.au/sites/default/files/documents/Victorian%20Default%20Offer%202026-27%20Price%20Determination.pdf",
    "Domestic flat-rate usage charge for inner Melbourne, including GST. Other Victorian networks range from 27.35c to 31.98c. Daily supply charges are excluded.",
  ),
  offer(
    "QLD",
    "Energex",
    "Default Market Offer usage cap, Energex",
    27.9744,
    "Australian Energy Regulator",
    AER_DMO_2026_27,
    dmoNote("Energex (south-east Queensland)"),
  ),
  offer(
    "SA",
    "SA Power Networks",
    "Default Market Offer usage cap, SA Power Networks",
    41.9103,
    "Australian Energy Regulator",
    AER_DMO_2026_27,
    dmoNote("SA Power Networks"),
  ),
  offer(
    "WA",
    "Synergy",
    "Synergy Home Plan (A1)",
    33.2621,
    "Synergy",
    "https://www.synergy.net.au/at_home/home_plan_a1_tariff.xhtml",
    "Government-set standard residential rate, including GST. Daily supply charges are excluded.",
  ),
  offer(
    "TAS",
    "TasNetworks",
    "Aurora Energy residential light and power (Tariff 31)",
    27.9538,
    "Aurora Energy",
    "https://auroraenergy.com.au/sites/default/files/2026-06/Aurora-Energy-2026-27-Standing-Offer-Tariff-Schedule.pdf",
    "Regulated rate most existing homes are on, including GST. Tariff 31 is closed to new connections; the new flat Tariff 32 is 24.75c. Daily supply charges are excluded.",
  ),
  offer(
    "ACT",
    "Evoenergy",
    "ActewAGL Home standing offer",
    36.9536,
    "ActewAGL",
    "https://www.actewagl.com.au/-/media/files/plan-pricing/2026/act-standard-electricity-prices-july-2026.pdf",
    "Standing-offer usage charge set under the ICRC's 2026-27 pricing decision, including GST. Daily supply charges are excluded.",
  ),
  offer(
    "NT",
    "Power and Water",
    "Domestic standard meter tariff",
    31.6788,
    "Power and Water Corporation",
    "https://www.powerwater.com.au/tariffs",
    "Government-regulated domestic rate, including GST. Daily supply charges are excluded.",
  ),
];

export interface StateInfo {
  code: string;
  name: string;
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
  emissionsNote: `2026 NGA location-based scope 2 estimate${code === "WA" ? " for the SWIS grid" : code === "NT" ? " for the Darwin–Katherine grid" : ""}; excludes manufacturing and upstream emissions.`,
}));

export function getTariffOffer(stateCode: string): TariffOffer {
  return (
    TARIFF_OFFERS.find((item) => item.stateCode === stateCode) ??
    TARIFF_OFFERS.find((item) => item.stateCode === DEFAULT_STATE_CODE)!
  );
}

export function getState(code: string): StateInfo {
  return STATES.find((state) => state.code === code) ?? STATES[0];
}
