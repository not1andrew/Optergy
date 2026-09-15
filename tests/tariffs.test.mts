import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_STATE_CODE,
  STATES,
  TARIFF_OFFERS,
  TARIFF_PERIOD,
  getTariffOffer,
} from "../src/data/tariffs";
import { costBreakdown } from "../src/lib/calc";

test("every state and territory has exactly one sourced 2026-27 usage rate", () => {
  assert.equal(TARIFF_PERIOD, "2026-27");
  assert.equal(TARIFF_OFFERS.length, STATES.length);
  assert.equal(new Set(TARIFF_OFFERS.map((offer) => offer.id)).size, TARIFF_OFFERS.length);
  for (const state of STATES) {
    const offers = TARIFF_OFFERS.filter((offer) => offer.stateCode === state.code);
    assert.equal(offers.length, 1, state.code);
    const [offer] = offers;
    assert.equal(new URL(offer.sourceUrl).protocol, "https:");
    assert.equal(offer.period, "2026-27");
    assert.equal(offer.effectiveFrom, "2026-07-01");
    assert.equal(offer.effectiveTo, "2027-06-30");
    assert.ok(offer.tariffCentsPerKwh > 0 && offer.tariffCentsPerKwh < 100, state.code);
  }
});

test("rates match the published 2026-27 figures, GST included", () => {
  const expected: Record<string, number> = {
    NSW: 33.1372,
    VIC: 25.96,
    QLD: 27.9744,
    SA: 41.9103,
    WA: 33.2621,
    TAS: 27.9538,
    ACT: 36.9536,
    NT: 31.6788,
  };
  for (const [code, rate] of Object.entries(expected))
    assert.equal(getTariffOffer(code).tariffCentsPerKwh, rate, code);
  assert.ok(Math.abs(getTariffOffer("ACT").tariffCentsPerKwh - 33.5942 * 1.1) < 1e-4);
  assert.ok(Math.abs(getTariffOffer("NT").tariffCentsPerKwh - 28.7989 * 1.1) < 1e-4);
});

test("unknown states fall back to the default state's rate", () => {
  assert.equal(getTariffOffer("XX"), getTariffOffer(DEFAULT_STATE_CODE));
});

test("the usage rate affects only usage cost", () => {
  const wa = getTariffOffer("WA");
  const cost = costBreakdown(315, wa.tariffCentsPerKwh, 0.5);
  assert.ok(Math.abs(cost.annualCost - (315 * 33.2621) / 100) < 1e-9);
  assert.equal(cost.lifetimeCost, cost.annualCost * 10);
});
