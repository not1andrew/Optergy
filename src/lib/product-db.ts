import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type { EfficientProduct } from "./products";

export function catalogPath(): string {
  return process.env.OPTERGY_DB_PATH ?? join(process.cwd(), "data", "products.sqlite");
}

/** Opens a shipped catalog read-only: API requests never seed or alter production data. */
export function queryProducts(
  categoryId: string,
  minCapacity = 0,
  path = catalogPath(),
): EfficientProduct[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `
      SELECT p.id, p.category_id AS categoryId, p.name, p.model, p.brand,
        p.stars, p.kwh_per_year AS kwhPerYear, o.price_aud AS approxPriceAud,
        p.capacity, p.capacity_unit AS capacityUnit, o.purchase_url AS purchaseUrl,
        p.specification_url AS specificationUrl, p.image_url AS imageUrl,
        o.retailer,
        p.energy_basis AS energyBasis
      FROM products p JOIN offers o ON o.product_id = p.id
      WHERE p.category_id = ? AND p.capacity >= ? AND p.active = 1
        AND o.id = (
          SELECT id FROM offers WHERE product_id = p.id AND available = 1
          ORDER BY price_aud ASC, id ASC LIMIT 1
        )
      ORDER BY p.kwh_per_year ASC, o.price_aud ASC, p.id ASC
    `,
      )
      .all(categoryId, minCapacity);
    return rows.map((row) => ({
      ...row,
      imageUrl: row.imageUrl ?? undefined,
    })) as unknown as EfficientProduct[];
  } finally {
    db.close();
  }
}
