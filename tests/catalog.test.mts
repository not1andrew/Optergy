import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { importProducts, validateProducts } from "../scripts/seed-products.mjs";
import { queryProducts } from "../src/lib/product-db";
import { buildRecommendations, costBreakdown } from "../src/lib/calc";
import { GET } from "../src/app/api/products/route";

const directory = mkdtempSync(join(tmpdir(), "optergy-catalog-"));
const dbPath = join(directory, "products.sqlite");
const seed = JSON.parse(readFileSync("data/products.seed.json", "utf8"));
const products = validateProducts(seed.products);
importProducts(products, dbPath);
after(() => rmSync(directory, { recursive: true, force: true }));

test("SQLite matches category and minimum capacity without leaking categories", () => {
  const washers = queryProducts("washer", 8, dbPath);
  assert.ok(washers.length >= 2);
  assert.ok(washers.every((p) => p.categoryId === "washer" && p.capacity >= 8));
  assert.equal(queryProducts("washer", 30, dbPath).length, 0);
  assert.equal(queryProducts("aircon", 0, dbPath).length, 0);
  assert.equal(queryProducts("washer' OR 1=1 --", 0, dbPath).length, 0);
});

test("repeat imports preserve identity and do not duplicate offers", () => {
  importProducts(products, dbPath);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM offers").get()?.n, products.length);
    assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  } finally {
    db.close();
  }
});

test("invalid imports fail before deactivating the existing catalog", () => {
  assert.throws(() => importProducts([{ ...products[0], kwhPerYear: -1 }], dbPath));
  assert.throws(() => validateProducts([{ ...products[0], purchaseUrl: "javascript:alert(1)" }]));
  assert.throws(() => validateProducts([{ ...products[0], capacityUnit: "L" }]));
  assert.equal(queryProducts("washer", 0, dbPath).length, 3);
});

test("payback uses purchase price and ranking differs from largest energy saving", () => {
  const base = products[0];
  const recommendations = buildRecommendations(
    500,
    [
      { ...base, id: "high-saving", kwhPerYear: 100, approxPriceAud: 2000 },
      { ...base, id: "quick-payback", kwhPerYear: 300, approxPriceAud: 200 },
      { ...base, id: "no-saving", kwhPerYear: 500, approxPriceAud: 100 },
      { ...base, id: "higher-use", kwhPerYear: 700, approxPriceAud: 50 },
    ],
    30,
    0.5,
  );
  assert.deepEqual(
    recommendations.map((item) => item.product.id),
    ["quick-payback", "high-saving"],
  );
  assert.equal(recommendations[0].annualSaving, 60);
  assert.equal(recommendations[0].paybackYears, 200 / 60);
  assert.equal(recommendations[0].lifetimeSaving, 600);
  assert.equal(recommendations[0].netLifetimeSaving, 400);
  assert.equal(recommendations[1].netLifetimeSaving, -800);
  assert.deepEqual(buildRecommendations(500, [base], 0, 0), []);
  assert.equal(costBreakdown(250, 30, 0.5).annualCost, 75);
});

test("API validates filters and exposes source and purchase links", async () => {
  const previous = process.env.OPTERGY_DB_PATH;
  process.env.OPTERGY_DB_PATH = dbPath;
  try {
    const response = await GET(
      new Request("http://localhost/api/products?category=washer&minCapacity=8"),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.products.length, 2);
    assert.ok(
      body.products.every((p: { purchaseUrl: string }) => p.purchaseUrl.startsWith("https://")),
    );
    for (const query of [
      "category=unknown",
      "category=washer&minCapacity=NaN",
      "category=washer&minCapacity=-2",
      "category=washer&minCapacity=",
      "",
    ]) {
      assert.equal((await GET(new Request(`http://localhost/api/products?${query}`))).status, 400);
    }
    assert.equal(
      (await (await GET(new Request("http://localhost/api/products?category=tv"))).json()).products
        .length,
      0,
    );
  } finally {
    if (previous === undefined) delete process.env.OPTERGY_DB_PATH;
    else process.env.OPTERGY_DB_PATH = previous;
  }
});
