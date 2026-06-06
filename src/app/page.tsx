"use client";

import { useState } from "react";
import { CATEGORIES, getCategory } from "@/data/categories";
import { DEFAULT_STATE_CODE, getState, getTariffOffers, STATES } from "@/data/tariffs";
import { costBreakdown } from "@/lib/calc";
import Results from "@/components/Results";
import Scanner from "@/components/Scanner";

export default function Home() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [stateCode, setStateCode] = useState(DEFAULT_STATE_CODE);
  const [offerId, setOfferId] = useState(getTariffOffers(DEFAULT_STATE_CODE)[0].id);
  const [kwhInput, setKwhInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [stars, setStars] = useState<number | undefined>();
  const [showResults, setShowResults] = useState(false);
  const offers = getTariffOffers(stateCode);
  const selected = offers.find(item => item.id === offerId) ?? offers[0];
  const category = getCategory(categoryId)!;
  const state = getState(stateCode);
  const kwh = Number(kwhInput), rate = Number(rateInput);
  const valid = Number.isFinite(kwh) && kwh > 0 && Number.isFinite(rate) && rate > 0;
  const costs = valid ? costBreakdown(kwh, rate, state.co2KgPerKwh) : null;
  return <main>
    <h1>Optergy</h1>
    <p>Compare appliance electricity costs using 2025–26 rates.</p>
    <form onSubmit={event => { event.preventDefault(); if(valid)setShowResults(true); }}>
      <label>Appliance <select value={categoryId} onChange={event => {setCategoryId(event.target.value);setShowResults(false);}}>
        {CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <Scanner categoryId={categoryId} onScanStart={() => {setShowResults(false);setKwhInput("");setStars(undefined);}} onResult={result => {setKwhInput(result.kwhPerYear?.toString() ?? "");setStars(result.stars);setShowResults(false);}} />
      <label>Annual energy (kWh) <input type="number" min="1" value={kwhInput} onChange={event => {setKwhInput(event.target.value);setShowResults(false);}} /></label>
      {stars !== undefined && <p>Energy rating: {stars} stars. Check this against your label.</p>}
      <label>State <select value={stateCode} onChange={event => {
        const next = getTariffOffers(event.target.value)[0];
        setStateCode(event.target.value);setOfferId(next.id);setRateInput(next.tariffCentsPerKwh?.toString() ?? "");setShowResults(false);
      }}>{STATES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label>Region <select value={selected.id} onChange={event => {
        const next=offers.find(item=>item.id===event.target.value)!;
        setOfferId(next.id);setRateInput(next.tariffCentsPerKwh?.toString() ?? "");setShowResults(false);
      }}>{offers.map(item=><option key={item.id} value={item.id}>{item.region}</option>)}</select></label>
      <p>{selected.note} <a href={selected.sourceUrl}>Rate source</a></p>
      <label>Electricity usage rate (c/kWh) <input type="number" min="0.0001" step="any" value={rateInput} onChange={event=>{setRateInput(event.target.value);setShowResults(false);}} /></label>
      <button disabled={!valid}>Calculate</button>
    </form>
    {showResults && costs && <Results category={category} kwhPerYear={kwh} stars={stars} state={state} tariffCentsPerKwh={rate} />}
  </main>;
}
