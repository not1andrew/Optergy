import assert from "node:assert/strict";
import { test } from "node:test";
import { STATES, TARIFF_OFFERS, TARIFF_PERIOD, getTariffOffers } from "../src/data/tariffs";
import { costBreakdown } from "../src/lib/calc";

test("every state uses only sourced 2025–26 offers", () => {
  assert.equal(new Set(TARIFF_OFFERS.map((offer) => offer.id)).size, TARIFF_OFFERS.length);
  assert.equal(TARIFF_PERIOD, "2025-26");
  for (const state of STATES) {
    const offers = getTariffOffers(state.code);
    assert.ok(offers.length > 0, state.code);
    for (const offer of offers) {
      assert.equal(new URL(offer.sourceUrl).protocol, "https:");
      assert.ok(offer.effectiveFrom < offer.effectiveTo);
      assert.equal(offer.period, "2025-26");
      assert.equal(offer.effectiveFrom, "2025-07-01");
      assert.equal(offer.effectiveTo, "2026-06-30");
      assert.equal(offer.basis === "bill-required", offer.tariffCentsPerKwh === null);
      if (offer.tariffCentsPerKwh !== null)
        assert.ok(offer.tariffCentsPerKwh > 0 && offer.tariffCentsPerKwh < 100);
    }
  }
});

test("2025 DMO annual bill caps never become fake appliance usage rates", () => {
  const dmo = TARIFF_OFFERS.filter(
    (offer) => offer.period === "2025-26" && offer.sourceName === "Australian Energy Regulator",
  );
  assert.equal(dmo.length, 5);
  assert.ok(dmo.every((offer) => offer.tariffCentsPerKwh === null));
  assert.equal(dmo.find((offer) => offer.id.startsWith("ausgrid"))?.annualReferenceBillAud, 1965);
  assert.equal(getTariffOffers("ACT")[0].tariffCentsPerKwh, null);
});

test("regional tariffs and GST conversion affect only usage cost", () => {
  const qld = getTariffOffers("QLD").find((offer) => offer.id.startsWith("regional"))!;
  assert.equal(qld.tariffCentsPerKwh, 32.9725);
  assert.ok(Math.abs(qld.tariffCentsPerKwh! - 29.975 * 1.1) < 1e-9);
  const wa = getTariffOffers("WA")[0];
  const cost = costBreakdown(315, wa.tariffCentsPerKwh!, 0.5);
  assert.ok(Math.abs(cost.annualCost - 101.971485) < 1e-8);
  assert.equal(cost.lifetimeCost, cost.annualCost * 10);
  assert.equal(getTariffOffers("VIC").length, 5);
  assert.equal(getTariffOffers("NSW").length, 3);
});
