import { CATEGORIES } from "@/data/categories";
import { queryProducts } from "@/lib/product-db";
import type { ProductResponse } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const rawCapacity = params.get("minCapacity");
  const minCapacity = rawCapacity === null ? 0 : Number(rawCapacity);

  if (!category || !CATEGORIES.some((item) => item.id === category)) {
    return Response.json({ error: "Choose a supported appliance category." }, { status: 400 });
  }
  if (
    (rawCapacity !== null && rawCapacity.trim() === "") ||
    !Number.isFinite(minCapacity) ||
    minCapacity < 0 ||
    minCapacity > 10000
  ) {
    return Response.json(
      { error: "Minimum capacity must be a number between 0 and 10,000." },
      { status: 400 },
    );
  }

  try {
    const products = queryProducts(category, minCapacity);
    const response: ProductResponse = {
      products,
      notice:
        "A small, independently curated catalog, not the whole market. Prices are public listings, not live quotes; confirm price, local stock, dimensions and installation with the retailer. Savings assume the same label test conditions and a constant tariff.",
    };
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Product catalog unavailable", error);
    return Response.json(
      {
        error:
          "The appliance catalog is temporarily unavailable. Your running-cost estimate still works.",
      },
      { status: 503 },
    );
  }
}
