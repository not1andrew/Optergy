"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Scanner, { ScanResult } from "@/components/Scanner";
import Results from "@/components/Results";
import ApplianceIcon from "@/components/ApplianceIcon";
import ExternalIcon from "@/components/ExternalIcon";
import { CATEGORIES, getCategory } from "@/data/categories";
import { DEFAULT_STATE_CODE, getState, getTariffOffer, STATES } from "@/data/tariffs";
import { costBreakdown, formatAud } from "@/lib/calc";

const EXAMPLE_LABEL_KWH = 241;
const exampleYearlyCost = costBreakdown(
  EXAMPLE_LABEL_KWH,
  getTariffOffer(DEFAULT_STATE_CODE).tariffCentsPerKwh,
  0,
).annualCost;

function StepTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="step-heading">
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
    </div>
  );
}

export default function Home() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [kwhInput, setKwhInput] = useState("");
  const [starsInput, setStarsInput] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState(DEFAULT_STATE_CODE);
  const [tariffInput, setTariffInput] = useState(
    getTariffOffer(DEFAULT_STATE_CODE).tariffCentsPerKwh.toString(),
  );
  const [showResults, setShowResults] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const category = categoryId ? getCategory(categoryId) : null;
  const state = getState(stateCode);
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

  const currentStep = showResults && inputsValid ? 3 : category && kwh > 0 ? 2 : 1;

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
    setStateCode(nextState);
    setTariffInput(getTariffOffer(nextState).tariffCentsPerKwh.toString());
    setShowResults(false);
  };

  return (
    <div className="site-shell">
      <a className="skip-link" href="#calculator">
        Skip to calculator
      </a>
      <header className="site-header container">
        <nav className="nav-pill" aria-label="Optergy">
          <Link className="wordmark" href="/" aria-label="Optergy home">
            <span className="brand-symbol" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none">
                <path d="M16 3 6 16h8l-2 9 10-14h-8l2-8Z" fill="currentColor" />
              </svg>
            </span>
            <span>
              optergy<span className="wordmark-dot">.</span>
            </span>
          </Link>
          <a className="header-link" href="#how-it-works">
            A little label literacy
          </a>
        </nav>
      </header>

      <main>
        <section className="hero container" aria-labelledby="hero-title">
          <div className="stage-text">
            <h1 id="hero-title">
              Small label.
              <br />
              Big picture.
            </h1>
            <p className="lead hero-description">
              Turn your energy label into running costs and upgrade payback.
            </p>
            <a href="#calculator" className="button button-primary hero-link">
              Let&apos;s read your label
            </a>
          </div>
          <figure className="hero-photo">
            <div className="hero-photo-frame">
              <Image
                src="/labels/dryer-label.png"
                width={308}
                height={500}
                priority
                alt="Energy rating label for a clothes dryer: 3.5 stars and 241 kWh per year"
              />
            </div>
            <figcaption className="reading-tag">
              <span className="reading-figure">
                {formatAud(exampleYearlyCost)} <span>a year to run</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="workflow-band" aria-label="How Optergy works">
          <ol className="workflow-steps container">
            {["Read your label", "Set your electricity rate", "Find your next move"].map(
              (label, index) => (
                <li key={label} aria-current={currentStep === index + 1 ? "step" : undefined}>
                  {label}
                </li>
              ),
            )}
          </ol>
        </section>

        <div className="workspace container" id="calculator">
          <form
            className="calculator"
            onSubmit={(event) => {
              event.preventDefault();
              if (inputsValid) setShowResults(true);
            }}
          >
            <section className="form-section category-section">
              <StepTitle title="Meet your appliance" detail="Choose the type you want to check." />
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
                  </button>
                ))}
              </div>
            </section>

            {category ? (
              <>
                <section className="form-section">
                  <StepTitle
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
                          placeholder={"0.5 to " + category.maxStars}
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
                  <StepTitle title="Put a price on your power" />
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
                  <p className="field-help" id="tariff-help">
                    Using an indicative rate for {state.name}.
                  </p>
                </section>

                <div className="calculate-action">
                  <button
                    className="button button-primary calculate-button"
                    type="submit"
                    disabled={!inputsValid}
                  >
                    Confirm &amp; calculate
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
              <h2>Reading the label</h2>
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
                Get to know the label
                <ExternalIcon />
              </a>
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
        <div className="container footer-inner">
          <Link className="footer-brand" href="/">
            optergy<span className="wordmark-dot">.</span>
          </Link>
          <div className="footer-notes">
            <p>A little clarity for a lower-energy home.</p>
            <p className="footer-meta">Australian energy labels</p>
          </div>
          <a href="https://www.energyrating.gov.au" target="_blank" rel="noreferrer">
            Energy Rating Australia
            <ExternalIcon />
          </a>
        </div>
      </footer>
    </div>
  );
}
