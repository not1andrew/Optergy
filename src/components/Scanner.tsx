"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { parseLabelText, type ParsedLabel } from "@/lib/labelParser";
export type ScanResult = ParsedLabel & { rawText: string };
export default function Scanner({onResult,onScanStart}: {
  onResult:(result:ScanResult)=>void; onScanStart?:()=>void; categoryId?:string;
}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function scan(file:File) {
    setBusy(true);setError("");onScanStart?.();
    try {
      const worker=await createWorker("eng");
      try {
        const {data}=await worker.recognize(file);
        onResult({...parseLabelText(data.text),rawText:data.text});
      } finally {await worker.terminate();}
    } catch(error) {
      setError(error instanceof Error?error.message:"Could not read label");
    } finally {setBusy(false);}
  }
  return <div>
    <label>Label photo <input type="file" accept="image/*" disabled={busy} onChange={event=>{
      const file=event.target.files?.[0];if(file)void scan(file);
    }} /></label>
    {busy && <p role="status">Reading label…</p>}
    {error && <p role="alert">{error}</p>}
    <p>Check the detected values against your label.</p>
  </div>;
}
