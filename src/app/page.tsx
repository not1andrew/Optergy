"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Scanner, { ScanResult } from "@/components/Scanner";
import Results from "@/components/Results";
import ApplianceIcon from "@/components/ApplianceIcon";
import { CATEGORIES, getCategory } from "@/data/categories";
import { DEFAULT_STATE_CODE, getState, getTariffOffers, STATES } from "@/data/tariffs";

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

function StepTitle({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="step-heading">
      <span className="step-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [kwhInput, setKwhInput] = useState("");
  const [starsInput, setStarsInput] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState(DEFAULT_STATE_CODE);
  const initialOffer = getTariffOffers(DEFAULT_STATE_CODE)[0];
  const [offerId, setOfferId] = useState(initialOffer?.id ?? "");
  const [tariffInput, setTariffInput] = useState(initialOffer?.tariffCentsPerKwh?.toString() ?? "");
  const [showResults, setShowResults] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const category = categoryId ? getCategory(categoryId) : null;
  const state = getState(stateCode);
  const offers = getTariffOffers(stateCode);
  const offer = offers.find((item) => item.id === offerId) ?? offers[0];
  const kwh = Number(kwhInput);
  const stars = starsInput === "" ? undefined : Number(starsInput);
  const tariff = Number(tariffInput);
  const starsValid =
    stars === undefined ||
    (Number.isFinite(stars) &&
      stars >= 0.5 &&
      stars <= (category?.maxStars ?? 10) &&
      stars * 2 === Math.round(stars * 2));
  const inputsValid =
    category !== null &&
    Number.isFinite(kwh) &&
    kwh > 0 &&
    Number.isFinite(tariff) &&
    tariff > 0 &&
    starsValid;

  const onScanStart = useCallback(() => {
    setShowResults(false);
    setKwhInput("");
    setStarsInput("");
    setScanNote(null);
  }, []);

  const onScan = useCallback((result: ScanResult) => {
    setShowResults(false);
    setKwhInput(result.kwhPerYear?.toString() ?? "");
    setStarsInput(result.stars?.toString() ?? "");
    setScanNote(
      result.kwhPerYear === undefined
        ? "We couldn't confidently identify annual energy use. Enter the kWh figure from your energy label below, or try a closer photo."
        : "Found " +
            result.kwhPerYear +
            " kWh/year" +
            (result.stars !== undefined
              ? " and " + result.stars + " stars"
              : "; the star rating needs a manual check") +
            ". Check both values against your label before calculating.",
    );
  }, []);

  useEffect(() => {
    if (showResults) {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showResults]);

  const changeLocation = (nextState: string) => {
    const next = getTariffOffers(nextState)[0];
    setStateCode(nextState);
    setOfferId(next?.id ?? "");
    setTariffInput(next?.tariffCentsPerKwh?.toString() ?? "");
    setShowResults(false);
  };

  return (
    <div className="site-shell">
      <a className="skip-link" href="#calculator">
        Skip to calculator
      </a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Optergy home">
          <span className="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 28 28" fill="none">
              <path d="M16 3 6 16h8l-2 9 10-14h-8l2-8Z" fill="currentColor" />
            </svg>
          </span>
          optergy<span className="wordmark-dot">.</span>
        </Link>
        <a className="header-link" href="#how-it-works">
          A little label literacy <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> LESS ENERGY. MORE POSSIBILITY.
            </p>
            <h1 id="hero-title">
              Small label.
              <br />
              <em>Big picture.</em>
            </h1>
            <p className="hero-description">
              Turn your appliance&apos;s energy label into dollars and sense. See what it costs to
              run, and whether a more efficient one adds up.
            </p>
            <a href="#calculator" className="hero-link">
              Let&apos;s read your label <Arrow />
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <div className="illustration-caption caption-top">A little information</div>
            <div className="label-illustration">
              <div className="label-stars">
                ★ ★ ★ ★ <span>★ ★</span>
              </div>
              <div className="label-title">
                ENERGY
                <br />
                RATING
              </div>
              <div className="label-line" />
              <p>Energy consumption</p>
              <strong>
                240 <span>kWh / year</span>
              </strong>
              <div className="label-lines">
                <i />
                <i />
                <i />
              </div>
              <span className="example-caption">Illustrative label</span>
            </div>
            <div className="cost-sticker">
              <span>See the whole cost</span>
              <strong>
                today &amp; tomorrow <span>↗</span>
              </strong>
            </div>
            <div className="illustration-caption caption-bottom">can make a big difference.</div>
          </div>
        </section>

        <div className="workflow-strip" aria-label="How Optergy works">
          <span>
            <b>01</b> Read your label
          </span>
          <i />
          <span>
            <b>02</b> Set your electricity rate
          </span>
          <i />
          <span>
            <b>03</b> Find your next move
          </span>
        </div>

        <div className="workspace" id="calculator">
          <form
            className="calculator"
            onSubmit={(event) => {
              event.preventDefault();
              if (inputsValid) setShowResults(true);
            }}
          >
            <section className="form-section category-section">
              <StepTitle
                number="01"
                title="Meet your appliance"
                detail="Choose the type you want to check."
              />
              <div className="category-grid" role="group" aria-label="Appliance type">
                {CATEGORIES.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={categoryId === item.id}
                    className={"category-button" + (categoryId === item.id ? " is-selected" : "")}
                    onClick={() => {
                      setCategoryId(item.id);
                      setKwhInput("");
                      setStarsInput("");
                      setScanNote(null);
                      setShowResults(false);
                    }}
                  >
                    <ApplianceIcon kind={item.id} />
                    <span>{item.label}</span>
                    <span className="selected-check" aria-hidden="true">
                      ✓
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {category ? (
              <>
                <section className="form-section">
                  <StepTitle
                    number="02"
                    title="A photo is a good start"
                    detail="Scan your energy label, then check the numbers below."
                  />
                  {category.note && <p className="notice notice-warm">{category.note}</p>}
                  <Scanner
                    key={category.id}
                    categoryId={category.id}
                    onScanStart={onScanStart}
                    onResult={onScan}
                  />
                  {scanNote && (
                    <p className="notice scan-note" role="status">
                      {scanNote}
                    </p>
                  )}
                  <div className="manual-divider">
                    <span>or enter your label details</span>
                  </div>
                  <div className="field-grid">
                    <label className="field">
                      <span>
                        Annual energy use <small>Required</small>
                      </span>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          name="energy"
                          min="0.1"
                          step="any"
                          inputMode="decimal"
                          required
                          value={kwhInput}
                          onChange={(event) => {
                            setKwhInput(event.target.value);
                            setShowResults(false);
                          }}
                          placeholder="e.g. 240"
                          aria-describedby="energy-help"
                        />
                        <span>kWh / year</span>
                      </div>
                    </label>
                    <label className="field">
                      <span>
                        Energy star rating <small>Optional</small>
                      </span>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          name="stars"
                          min="0.5"
                          max={category.maxStars}
                          step="0.5"
                          inputMode="decimal"
                          value={starsInput}
                          onChange={(event) => {
                            setStarsInput(event.target.value);
                            setShowResults(false);
                          }}
                          placeholder={"0.5–" + category.maxStars}
                          aria-invalid={!starsValid}
                        />
                        <span>stars</span>
                      </div>
                    </label>
                  </div>
                  <p className="field-help" id="energy-help">
                    Use the number next to kWh on the energy label. Water litres, model numbers and
                    capacity are different measurements.
                  </p>
                  {!starsValid && (
                    <p className="field-error">
                      Enter a star rating from 0.5 to {category.maxStars}, in half-star steps, or
                      leave it blank.
                    </p>
                  )}
                </section>

                <section className="form-section">
                  <StepTitle
                    number="03"
                    title="Put a price on your power"
                    detail="Use a 2025–26 regulated benchmark or your bill's usage rate."
                  />
                  <div className="field-grid">
                    <label className="field field-full">
                      <span>State or territory</span>
                      <select
                        value={stateCode}
                        onChange={(event) => changeLocation(event.target.value)}
                      >
                        {STATES.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {offers.length > 1 && (
                      <label className="field field-full">
                        <span>Electricity network / region</span>
                        <select
                          value={offer?.id ?? ""}
                          onChange={(event) => {
                            const next = offers.find((item) => item.id === event.target.value);
                            setOfferId(event.target.value);
                            setTariffInput(next?.tariffCentsPerKwh?.toString() ?? "");
                            setShowResults(false);
                          }}
                        >
                          {offers.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.region}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      <span>
                        Electricity usage rate <small>Editable</small>
                      </span>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          name="tariff"
                          min="0.01"
                          step="any"
                          inputMode="decimal"
                          required
                          value={tariffInput}
                          onChange={(event) => {
                            setTariffInput(event.target.value);
                            setShowResults(false);
                          }}
                          placeholder="From your bill"
                          aria-describedby="tariff-help"
                        />
                        <span>c / kWh</span>
                      </div>
                    </label>
                    <p className="rate-tip">
                      Look for the <strong>usage charge</strong> on your bill. Daily supply charges
                      don&apos;t change when you swap an appliance.
                    </p>
                  </div>
                  {offer && (
                    <div className="tariff-source" id="tariff-help">
                      <p>
                        <span className="source-dot" />
                        {offer.name}
                      </p>
                      <p>{offer.note}</p>
                      {offer.annualReferenceBillAud !== undefined && (
                        <p>
                          Published annual reference bill: $
                          {offer.annualReferenceBillAud.toLocaleString()} at{" "}
                          {offer.annualReferenceKwh?.toLocaleString()} kWh. This includes supply
                          charges and cannot be used as an appliance usage rate.
                        </p>
                      )}
                      <a href={offer.sourceUrl} target="_blank" rel="noreferrer">
                        {offer.sourceName} <span aria-hidden="true">↗</span>
                      </a>
                      <span>
                        {" "}
                        · {offer.effectiveFrom} to {offer.effectiveTo}
                      </span>
                    </div>
                  )}
                </section>

                <div className="calculate-action">
                  <button
                    className="button-primary calculate-button"
                    type="submit"
                    disabled={!inputsValid}
                  >
                    Confirm &amp; calculate <Arrow />
                  </button>
                  <p>
                    {inputsValid
                      ? "By calculating, you confirm these numbers match your label."
                      : "Enter annual energy use and an electricity rate to continue."}
                  </p>
                </div>
              </>
            ) : (
              <div className="getting-started">
                <span aria-hidden="true">↳</span>
                <p>
                  <strong>A clearer view starts here.</strong>
                  <br />
                  Choose an appliance above to scan a label or enter its details.
                </p>
              </div>
            )}
          </form>

          <aside className="guide-rail" id="how-it-works">
            <div className="guide-card">
              <p className="eyebrow">THE LABEL, EXPLAINED</p>
              <h2>
                Two numbers.
                <br />A better decision.
              </h2>
              <div className="guide-item">
                <span className="guide-symbol" aria-hidden="true">
                  ★
                </span>
                <div>
                  <h3>Stars show efficiency</h3>
                  <p>
                    More stars means better efficiency. Compare appliances of a similar type and
                    capacity.
                  </p>
                </div>
              </div>
              <div className="guide-item">
                <span className="guide-symbol kwh-symbol" aria-hidden="true">
                  kWh
                </span>
                <div>
                  <h3>kWh shows energy use</h3>
                  <p>
                    This is the number we use to estimate your running costs under the label&apos;s
                    test conditions.
                  </p>
                </div>
              </div>
              <a
                href="https://www.energyrating.gov.au/consumer-information/understand-energy-rating-label"
                target="_blank"
                rel="noreferrer"
              >
                Get to know the label <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="photo-tip">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <path d="M7 11h5l2-4h8l2 4h5v18H7z" />
                <circle cx="18" cy="20" r="5" />
                <path d="M3 7V3h5m20 0h5v4M3 29v4h5m20 0h5v-4" />
              </svg>
              <h3>Give your label its close-up</h3>
              <p>
                Fill the photo with the whole energy label. Shoot straight-on in even light and keep
                the kWh number sharp.
              </p>
              <span>Photos are processed in your browser.</span>
            </div>
            <p className="keep-note">
              The greenest upgrade can be keeping what you have. We&apos;ll show the savings and
              purchase cost so you can decide.
            </p>
          </aside>
        </div>

        {showResults && inputsValid && category && (
          <div
            ref={resultRef}
            className="results-region"
            tabIndex={-1}
            aria-label="Your energy cost results"
          >
            <Results
              category={category}
              kwhPerYear={kwh}
              stars={stars}
              state={state}
              tariffCentsPerKwh={tariff}
            />
          </div>
        )}
      </main>

      <footer className="site-footer">
        <Link className="footer-brand" href="/">
          optergy.
        </Link>
        <p>
          A little clarity for a lower-energy home.
          <br />
          <span>Australian energy labels · Built for an energy hackathon</span>
        </p>
        <a href="https://www.energyrating.gov.au" target="_blank" rel="noreferrer">
          Energy Rating Australia ↗
        </a>
      </footer>
    </div>
  );
}
