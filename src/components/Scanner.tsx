"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { recogniseLabel, type LabelScan } from "@/lib/labelOcr";
export type ScanResult = LabelScan;
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
        const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
        let pixels:ImageData;
        try {
          const canvas=document.createElement("canvas");
          const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
          canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
          const context=canvas.getContext("2d");
          if(!context)throw Error("Could not open photo");
          context.fillStyle="white";context.fillRect(0,0,canvas.width,canvas.height);
          context.drawImage(bitmap,0,0,canvas.width,canvas.height);
          pixels=context.getImageData(0,0,canvas.width,canvas.height);
        } finally { bitmap.close(); }
        const result=await recogniseLabel(pixels,worker,async pixels=>{
          const canvas=document.createElement("canvas");canvas.width=pixels.width;canvas.height=pixels.height;
          const context=canvas.getContext("2d");
          if(!context)throw Error("Could not prepare label");
          const frame=context.createImageData(pixels.width,pixels.height);frame.data.set(pixels.data);context.putImageData(frame,0,0);
          return canvas;
        });
        onResult(result);
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
