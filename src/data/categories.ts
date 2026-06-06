export type CapacityUnit = "kg" | "L" | "place settings" | "in" | "kW" | null;

export interface ApplianceCategory {
  id: string;
  label: string;
  emoji: string;
  /** Illustrative comparison only; not a national average or recommendation. */
  typicalKwhPerYear: number;
  maxStars: 6 | 10;
  capacityUnit: CapacityUnit;
  note?: string;
}

export const CATEGORIES: ApplianceCategory[] = [
  {
    id: "fridge",
    label: "Fridge / freezer combo",
    emoji: "🧊",
    typicalKwhPerYear: 420,
    maxStars: 10,
    capacityUnit: "L",
  },
  {
    id: "chest-freezer",
    label: "Chest freezer",
    emoji: "❄️",
    typicalKwhPerYear: 320,
    maxStars: 10,
    capacityUnit: "L",
  },
  {
    id: "washer",
    label: "Washing machine",
    emoji: "🫧",
    typicalKwhPerYear: 380,
    maxStars: 6,
    capacityUnit: "kg",
    note: "Compare the same wash setting and similar capacity. Label consumption assumes the standard test cycle; your washing frequency and temperature change actual use.",
  },
  {
    id: "dryer",
    label: "Clothes dryer",
    emoji: "🌀",
    typicalKwhPerYear: 550,
    maxStars: 10,
    capacityUnit: "kg",
    note: "Dryer label consumption uses a standard number of loads. Compare similar capacities and the same usage basis.",
  },
  {
    id: "dishwasher",
    label: "Dishwasher",
    emoji: "🍽️",
    typicalKwhPerYear: 310,
    maxStars: 6,
    capacityUnit: "place settings",
    note: "Compare similar capacities and the same standard test program. Installation type and dimensions also need checking.",
  },
  {
    id: "tv",
    label: "Television",
    emoji: "📺",
    typicalKwhPerYear: 400,
    maxStars: 10,
    capacityUnit: "in",
  },
  {
    id: "aircon",
    label: "Air conditioner (split system)",
    emoji: "🌡️",
    typicalKwhPerYear: 900,
    maxStars: 10,
    capacityUnit: "kW",
    note: "Zoned Energy Rating Labels have separate climate-zone and heating/cooling figures. Enter the correct annual kWh manually. Automatic alternatives are unavailable until climate and capacity matching are supported.",
  },
  {
    id: "pool-pump",
    label: "Pool pump",
    emoji: "🏊",
    typicalKwhPerYear: 1500,
    maxStars: 10,
    capacityUnit: null,
  },
];

export function getCategory(id: string): ApplianceCategory {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0];
}
