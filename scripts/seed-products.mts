import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { CATEGORIES } from "../src/data/categories";
import type { EfficientProduct } from "../src/lib/products";

export function validateProducts(input: unknown): EfficientProduct[] {
  if (!Array.isArray(input) || input.length === 0)
    throw new Error("The import must contain a non-empty products array.");
  const ids = new Set<string>();
  return input.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Invalid product record.");
    const product = value as EfficientProduct;
    const category = CATEGORIES.find((item) => item.id === product.categoryId);
    if (!category || product.capacityUnit !== category.capacityUnit)
      throw new Error("Unknown category or mismatched capacity unit.");
    for (const key of ["id", "name", "model", "brand", "retailer", "energyBasis"] as const) {
      if (typeof product[key] !== "string" || !product[key].trim())
        throw new Error(`Missing ${key}.`);
    }
    if (!/^[a-z0-9-]+$/.test(product.id) || ids.has(product.id))
      throw new Error(`Invalid or duplicate product id: ${product.id}`);
    ids.add(product.id);
    for (const key of ["capacity", "kwhPerYear", "approxPriceAud"] as const) {
      if (!Number.isFinite(product[key]) || product[key] <= 0)
        throw new Error(`Invalid ${key} for ${product.id}.`);
    }
    if (
      !Number.isFinite(product.stars) ||
      product.stars <= 0 ||
      product.stars > category.maxStars ||
      (product.stars * 2) % 1 !== 0
    ) {
      throw new Error(`Invalid energy star rating for ${product.id}.`);
    }
    for (const key of ["purchaseUrl", "specificationUrl", "imageUrl"] as const) {
      if (key === "imageUrl" && !product[key]) continue;
      const url = new URL(product[key]!);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error(`Invalid ${key}.`);
    }
    return product;
  });
}

/** Validated, transactional import. Records absent from the import become inactive. */
export function importProducts(products: EfficientProduct[], dbPath: string) {
  validateProducts(products);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, category_id TEXT NOT NULL, name TEXT NOT NULL,
        model TEXT NOT NULL, brand TEXT NOT NULL, stars REAL NOT NULL CHECK (stars > 0 AND stars <= 10),
        kwh_per_year REAL NOT NULL CHECK (kwh_per_year > 0), capacity REAL NOT NULL CHECK (capacity > 0),
        capacity_unit TEXT, specification_url TEXT NOT NULL, image_url TEXT,
        energy_basis TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
        retailer TEXT NOT NULL, price_aud REAL NOT NULL CHECK (price_aud > 0),
        purchase_url TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1,
        UNIQUE(product_id, retailer)
      );
      CREATE INDEX IF NOT EXISTS products_category_capacity ON products(category_id, capacity, active);
      CREATE INDEX IF NOT EXISTS offers_product ON offers(product_id, available);
      PRAGMA user_version = 1;
      BEGIN IMMEDIATE;
      UPDATE products SET active = 0;
    `);
    const upsert = db.prepare(`INSERT INTO products
      (id, category_id, name, model, brand, stars, kwh_per_year, capacity, capacity_unit,
       specification_url, image_url, energy_basis, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name,
        model=excluded.model, brand=excluded.brand, stars=excluded.stars,
        kwh_per_year=excluded.kwh_per_year, capacity=excluded.capacity,
        capacity_unit=excluded.capacity_unit, specification_url=excluded.specification_url,
        image_url=excluded.image_url, energy_basis=excluded.energy_basis,
        active=1`);
    const offer = db.prepare(`INSERT INTO offers (product_id, retailer, price_aud, purchase_url)
      VALUES (?, ?, ?, ?) ON CONFLICT(product_id, retailer)
      DO UPDATE SET price_aud=excluded.price_aud, purchase_url=excluded.purchase_url, available=1`);
    for (const p of products) {
      upsert.run(
        p.id,
        p.categoryId,
        p.name,
        p.model,
        p.brand,
        p.stars,
        p.kwhPerYear,
        p.capacity,
        p.capacityUnit,
        p.specificationUrl,
        p.imageUrl ?? null,
        p.energyBasis,
      );
      offer.run(p.id, p.retailer, p.approxPriceAud, p.purchaseUrl);
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* No open transaction if schema creation failed. */
    }
    throw error;
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = resolve(process.argv[2] ?? "data/products.seed.json");
  const destination = resolve(
    process.argv[3] ?? process.env.OPTERGY_DB_PATH ?? "data/products.sqlite",
  );
  const payload = JSON.parse(readFileSync(source, "utf8"));
  if (payload.version !== 1) throw new Error("Unsupported catalog import version.");
  const products = validateProducts(payload.products);
  importProducts(products, destination);
  console.log(`Imported ${products.length} verified product records into ${destination}`);
}
