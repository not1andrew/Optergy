"use client";

import { useEffect, useState } from "react";
import type { ApplianceCategory } from "@/data/categories";
import type { StateInfo } from "@/data/tariffs";
import type { ProductResponse } from "@/lib/products";
import { buildRecommendations, costBreakdown, formatAudPrecise } from "@/lib/calc";

export default function Results({category,kwhPerYear,stars,state,tariffCentsPerKwh}: {
  category: ApplianceCategory; kwhPerYear:number; stars?:number; state:StateInfo; tariffCentsPerKwh:number;
}) {
  const [catalog,setCatalog]=useState<ProductResponse | null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/products?category="+encodeURIComponent(category.id),{signal:controller.signal})
      .then(response=>{if(!response.ok)throw Error("Catalog unavailable");return response.json();})
      .then(data=>{if(!controller.signal.aborted)setCatalog(data);})
      .catch(error=>{if(!controller.signal.aborted)setError(String(error));});
    return ()=>controller.abort();
  },[category.id]);
  const cost=costBreakdown(kwhPerYear,tariffCentsPerKwh,state.co2KgPerKwh);
  const recommendations=buildRecommendations(kwhPerYear,catalog?.products??[],tariffCentsPerKwh,state.co2KgPerKwh);
  return <section>
    <h2>{category.label}: running costs</h2>
    {stars!==undefined && <p>Energy rating: {stars} stars</p>}
    <p>{formatAudPrecise(cost.annualCost)} per year; {formatAudPrecise(cost.lifetimeCost)} over ten years.</p>
    <h3>Lower-energy alternatives</h3>
    {error && <p role="alert">{error}</p>}
    <ol>{recommendations.map(rec=><li key={rec.product.id}>
      <a href={rec.product.purchaseUrl}>{rec.product.name}</a>: {rec.product.kwhPerYear} kWh/year; energy rating: {rec.product.stars} stars.
      <p>{formatAudPrecise(rec.annualSaving)} yearly saving; payback {rec.paybackYears?.toFixed(1)} years.</p>
    </li>)}</ol>
    <p>{catalog?.notice}</p>
  </section>;
}
