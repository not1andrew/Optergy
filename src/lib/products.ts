import type { CapacityUnit } from "../data/categories";

/** Public catalog record. Prices and availability are sourced listings, not a live feed. */
export interface EfficientProduct {
  id: string;
  categoryId: string;
  name: string;
  model: string;
  brand: string;
  stars: number;
  kwhPerYear: number;
  approxPriceAud: number;
  capacity: number;
  capacityUnit: CapacityUnit;
  purchaseUrl: string;
  specificationUrl: string;
  imageUrl?: string;
  retailer: string;
  energyBasis: string;
}

export interface ProductResponse {
  products: EfficientProduct[];
  notice: string;
}
