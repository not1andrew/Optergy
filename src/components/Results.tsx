"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { ApplianceCategory } from "@/data/categories";
import { EMISSIONS_SOURCE_URL, type StateInfo } from "@/data/tariffs";
import type { ProductResponse } from "@/lib/products";
import ApplianceIcon from "@/components/ApplianceIcon";
import {
  buildRecommendations,
  costBreakdown,
  formatAud,
  formatAudPrecise,
  LIFETIME_YEARS,
} from "@/lib/calc";

interface ResultsProps {
  category: ApplianceCategory;
  kwhPerYear: number;
  stars?: number;
  state: StateInfo;
  tariffCentsPerKwh: number;
}

type CatalogState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: ProductResponse };

function EnergyRating({ stars }: { stars: number }) {
  const fullStars = Math.floor(stars);
  const halfStar = stars % 1 !== 0;
  return (
    <span className="energy-rating" aria-label={`Energy rating: ${stars} stars`}>
      <span>Energy rating:</span>
      <span className="energy-rating-icons" aria-hidden="true">
        {"★".repeat(fullStars)}
        {halfStar && <span className="energy-half-star">★</span>}
      </span>
      <span className="energy-rating-value" aria-hidden="true">
        {stars} stars
      </span>
    </span>
  );
}

export default function Results({
  category,
  kwhPerYear,
  stars,
  state,
  tariffCentsPerKwh,
}: ResultsProps) {
  const [catalog, setCatalog] = useState<CatalogState>({ phase: "loading" });
  const [capacityInput, setCapacityInput] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [retry, setRetry] = useState(0);
  const yours = costBreakdown(kwhPerYear, tariffCentsPerKwh, state.co2KgPerKwh);
  const recommendations =
    catalog.phase === "ready"
      ? buildRecommendations(
          kwhPerYear,
          catalog.data.products,
          tariffCentsPerKwh,
          state.co2KgPerKwh,
        )
      : [];
  const capacityValid =
    capacityInput === "" ||
    (Number.isFinite(Number(capacityInput)) &&
      Number(capacityInput) > 0 &&
      Number(capacityInput) <= 10000);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ category: category.id });
    if (minCapacity) query.set("minCapacity", minCapacity);
    fetch("/api/products?" + query, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "The appliance catalog is unavailable. Your running-cost estimate is still shown above.",
          );
        const data: ProductResponse = await response.json();
        if (!controller.signal.aborted) setCatalog({ phase: "ready", data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setCatalog({
            phase: "error",
            message:
              error instanceof Error
                ? error.message
                : "We couldn't load appliances. Please try again.",
          });
      });
    return () => controller.abort();
  }, [category.id, minCapacity, retry]);

  return (
    <div className="results">
      <section className="cost-summary" aria-labelledby="result-title">
        <div className="result-heading">
          <div>
            <p className="eyebrow">YOUR ENERGY, IN PERSPECTIVE</p>
            <h2 id="result-title">Here&apos;s the bigger picture.</h2>
            <p>
              {category.label}
              {stars !== undefined ? " · " + stars + " energy stars" : ""}
            </p>
          </div>
          <ApplianceIcon kind={category.id} />
        </div>
        <div className="cost-stats">
          <div className="cost-stat main-stat">
            <p>Estimated yearly cost</p>
            <strong>
              {formatAudPrecise(yours.annualCost)}
              <span> / year</span>
            </strong>
            <small>
              {kwhPerYear.toLocaleString()} kWh ×{" "}
              {tariffCentsPerKwh.toLocaleString("en-AU", { maximumFractionDigits: 4 })}c (
              {state.code})
            </small>
          </div>
          <div className="cost-stat">
            <p>Over {LIFETIME_YEARS} years</p>
            <strong>{formatAud(yours.lifetimeCost)}</strong>
            <small>Energy only, at a constant usage rate</small>
          </div>
          <div className="cost-stat">
            <p>Estimated yearly emissions</p>
            <strong>
              {Math.round(yours.annualCo2Kg).toLocaleString()}
              <span> kg CO₂e</span>
            </strong>
            <small>Using an indicative {state.code} grid factor</small>
          </div>
        </div>
        <p className="summary-footnote">
          Actual use varies with your settings and habits. The {LIFETIME_YEARS}-year view is a
          comparison period, not a prediction of appliance lifespan.
        </p>
      </section>

      <section className="recommendations" aria-labelledby="recommendations-title">
        <div className="recommendation-heading">
          <div>
            <p className="eyebrow">YOUR NEXT MOVE</p>
            <h2 id="recommendations-title">Is an upgrade worth it?</h2>
            <p>
              Lower-energy options, ordered by the time energy savings take to cover the purchase
              price.
            </p>
          </div>
          <span className="catalog-badge">
            <span /> Sourced appliance catalog
          </span>
        </div>
        {category.capacityUnit && (
          <form
            className="capacity-filter"
            onSubmit={(event) => {
              event.preventDefault();
              if (capacityValid && minCapacity !== capacityInput) {
                setCatalog({ phase: "loading" });
                setMinCapacity(capacityInput);
              }
            }}
          >
            <label className="field" htmlFor="minimum-capacity">
              <span>Minimum capacity</span>
              <div className="input-with-unit">
                <input
                  id="minimum-capacity"
                  type="number"
                  min="0.1"
                  max="10000"
                  step="any"
                  inputMode="decimal"
                  value={capacityInput}
                  onChange={(event) => setCapacityInput(event.target.value)}
                  placeholder="Any size"
                  aria-invalid={!capacityValid}
                  aria-describedby={!capacityValid ? "capacity-error" : undefined}
                />
                <span>{category.capacityUnit}</span>
              </div>
            </label>
            <button type="submit" className="button-secondary" disabled={!capacityValid}>
              Apply filter
            </button>
            <p>
              Choose a size that meets your needs.
              <br />
              Smaller appliances aren&apos;t always a fair comparison.
            </p>
          </form>
        )}
        {!capacityValid && (
          <p className="field-error" id="capacity-error">
            Enter a capacity greater than zero and up to 10,000, or leave it blank for any size.
          </p>
        )}

        {catalog.phase === "loading" && (
          <div className="catalog-message" role="status">
            <span className="loading-dot" /> Checking the appliance catalog…
          </div>
        )}
        {catalog.phase === "error" && (
          <div className="catalog-message error-message" role="alert">
            <p>{catalog.message}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setCatalog({ phase: "loading" });
                setRetry((value) => value + 1);
              }}
            >
              Try again ↗
            </button>
          </div>
        )}
        {catalog.phase === "ready" && (
          <>
            {recommendations.length === 0 ? (
              <div className="catalog-message empty-catalog">
                <span aria-hidden="true">↳</span>
                <div>
                  <h3>
                    {catalog.data.products.length === 0
                      ? "No verified matches for this selection yet."
                      : "No energy savings in these matches."}
                  </h3>
                  <p>
                    {catalog.data.products.length === 0
                      ? "Try a smaller minimum capacity or check the Energy Rating product register. We can still estimate your current running costs."
                      : "None of the matching models in our catalog uses less annual energy. Keeping your appliance may make sense; this catalog doesn't cover the entire market."}
                  </p>
                  <a
                    href="https://reg.energyrating.gov.au/comparator/product_types/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explore the Energy Rating register ↗
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="comparison-count">
                  {recommendations.length} lower-energy option
                  {recommendations.length === 1 ? "" : "s"}
                  {minCapacity ? " · at least " + minCapacity + " " + category.capacityUnit : ""}
                  <span>All prices in AUD</span>
                </p>
                <ol className="product-list">
                  {recommendations.map((rec, index) => (
                    <li className="product-card" key={rec.product.id}>
                      <div className="product-visual">
                        <ApplianceIcon kind={category.id} />
                        {rec.product.imageUrl && (
                          <Image
                            src={rec.product.imageUrl}
                            alt=""
                            width={150}
                            height={180}
                            unoptimized
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                        <span className="product-rank">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="product-info">
                        <p className="product-brand">
                          {rec.product.brand}{" "}
                          <span>
                            · {rec.product.capacity} {rec.product.capacityUnit}
                          </span>
                        </p>
                        <h3>{rec.product.name}</h3>
                        <EnergyRating stars={rec.product.stars} />
                        <p className="product-specs">
                          <span>{rec.product.kwhPerYear.toLocaleString()} kWh / year</span>
                          <span>Model {rec.product.model}</span>
                        </p>
                        <p className="product-price">
                          {formatAud(rec.product.approxPriceAud)}{" "}
                          <span>at {rec.product.retailer}</span>
                        </p>
                        <a
                          className="product-shop"
                          href={rec.product.purchaseUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View appliance <span aria-hidden="true">↗</span>
                        </a>
                        <p className="price-note">
                          Check price &amp; availability with the retailer
                        </p>
                      </div>
                      <div className="product-savings">
                        <p>Energy saving</p>
                        <strong>
                          {formatAudPrecise(rec.annualSaving)}
                          <span> / year</span>
                        </strong>
                        <dl>
                          <div>
                            <dt>Purchase payback</dt>
                            <dd>
                              {rec.paybackYears === null
                                ? "No payback"
                                : rec.paybackYears > 100
                                  ? "Over 100 years"
                                  : rec.paybackYears.toFixed(1) + " years"}
                            </dd>
                          </div>
                          <div>
                            <dt>
                              {rec.netLifetimeSaving >= 0
                                ? LIFETIME_YEARS + "-year net saving"
                                : "Extra cost after " + LIFETIME_YEARS + " years"}
                            </dt>
                            <dd>{formatAud(Math.abs(rec.netLifetimeSaving))}</dd>
                          </div>
                        </dl>
                        <p
                          className={
                            rec.netLifetimeSaving >= 0 ? "payback-note positive" : "payback-note"
                          }
                        >
                          {rec.netLifetimeSaving >= 0
                            ? "Energy savings could cover the purchase within this comparison period."
                            : "Energy savings alone don't cover the purchase within this comparison period."}
                        </p>
                      </div>
                      <details className="product-evidence">
                        <summary>Source &amp; comparison details</summary>
                        <p>{rec.product.energyBasis}</p>
                        <p>
                          <a href={rec.product.specificationUrl} target="_blank" rel="noreferrer">
                            View specification source ↗
                          </a>
                        </p>
                        <p>
                          {formatAud(rec.lifetimeSaving)} in gross energy savings over{" "}
                          {LIFETIME_YEARS} years, less {formatAud(rec.product.approxPriceAud)}{" "}
                          purchase price. Installation, disposal, financing and changes in tariffs
                          are excluded.
                        </p>
                      </details>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <p className="catalog-notice">{catalog.data.notice}</p>
          </>
        )}
        <div className="assumptions">
          <h3>A fair comparison needs a few assumptions.</h3>
          <p>
            These estimates use the annual kWh you confirmed, your selected electricity rate and a
            constant {LIFETIME_YEARS}-year period. Compare similar capacities and test programs. We
            assume your existing appliance has no new purchase cost; replacement costs use the
            listed appliance price. Emissions cover electricity use only. Future prices, repairs,
            water and manufacturing impacts are excluded.
          </p>
          <p>
            {state.emissionsNote}{" "}
            <a href={EMISSIONS_SOURCE_URL} target="_blank" rel="noreferrer">
              National Greenhouse Accounts factors ↗
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
