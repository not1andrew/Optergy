"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
import type { LabelScan } from "@/lib/labelOcr";
import type { Pixels } from "@/lib/labelImage";

export type ScanResult = LabelScan;
interface ScannerProps {
  onResult: (result: ScanResult) => void;
  onScanStart?: () => void;
  categoryId?: string;
}
type ScanState =
  | { phase: "idle" }
  | { phase: "camera-starting" }
  | { phase: "camera" }
  | { phase: "ocr"; progress: number }
  | { phase: "error"; message: string };

async function decodePhoto(source: Blob | HTMLCanvasElement): Promise<Pixels> {
  const bitmap =
    source instanceof HTMLCanvasElement
      ? source
      : await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Your browser could not open this image.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    if (bitmap instanceof ImageBitmap) bitmap.close();
  }
}

async function encodePixels(pixels: Pixels): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  const frame = context.createImageData(pixels.width, pixels.height);
  frame.data.set(pixels.data);
  context.putImageData(frame, 0, 0);
  return canvas;
}

export default function Scanner({ onResult, onScanStart, categoryId }: ScannerProps) {
  const [state, setState] = useState<ScanState>({ phase: "idle" });
  const [preview, setPreview] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const runRef = useRef(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);
  const cancelScan = useCallback(() => {
    runRef.current++;
    const worker = workerRef.current;
    workerRef.current = null;
    void worker?.terminate();
    setState({ phase: "idle" });
  }, []);
  useEffect(
    () => () => {
      runRef.current++;
      stopCamera();
      void workerRef.current?.terminate();
    },
    [stopCamera],
  );
  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    if (state.phase !== "camera" || !videoRef.current) return;
    let active = true;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      if (active) {
        stopCamera();
        setState({
          phase: "error",
          message: "The camera opened but its preview could not play. Try again or upload a photo.",
        });
      }
    });
    return () => {
      active = false;
    };
  }, [state.phase, stopCamera]);

  const runOcr = useCallback(
    async (source: Blob | HTMLCanvasElement) => {
      const run = ++runRef.current;
      onScanStart?.();
      stopCamera();
      setWarnings([]);
      setState({ phase: "ocr", progress: 0 });
      if (source instanceof Blob && source.size > 25 * 1024 * 1024) {
        setState({ phase: "error", message: "Choose a photo smaller than 25 MB." });
        return;
      }
      setPreview(
        source instanceof HTMLCanvasElement
          ? source.toDataURL("image/jpeg", 0.85)
          : URL.createObjectURL(source),
      );
      let worker: Worker | undefined;
      try {
        const pixels = await decodePhoto(source);
        const [{ createWorker }, { recogniseLabel }] = await Promise.all([
          import("tesseract.js"),
          import("@/lib/labelOcr"),
        ]);
        if (run !== runRef.current) return;
        worker = await createWorker("eng", undefined, {
          langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int",
        });
        if (run !== runRef.current) {
          await worker.terminate();
          return;
        }
        workerRef.current = worker;
        const result = await recogniseLabel(pixels, worker, encodePixels, (progress) => {
          if (run === runRef.current) setState({ phase: "ocr", progress });
        });
        if (run !== runRef.current) return;
        if (categoryId && result.categoryId && result.categoryId !== categoryId)
          result.warnings = [
            ...(result.warnings ?? []),
            "The appliance type on the label may differ from your selection. Check it before comparing.",
          ];
        setWarnings(result.warnings ?? []);
        onResult(result);
        setState({ phase: "idle" });
      } catch (error) {
        if (run === runRef.current)
          setState({
            phase: "error",
            message:
              error instanceof Error && /image|decode|bitmap/i.test(error.message)
                ? "This image could not be opened. Try a JPG, PNG or WebP photo."
                : "The label reader could not start. Check your connection for the first scan, or enter the figures below.",
          });
      } finally {
        if (workerRef.current === worker) {
          workerRef.current = null;
          await worker?.terminate();
        }
      }
    },
    [onResult, onScanStart, categoryId, stopCamera],
  );

  const startCamera = useCallback(async () => {
    const run = ++runRef.current;
    setCameraReady(false);
    setWarnings([]);
    setState({ phase: "camera-starting" });
    try {
      if (!window.isSecureContext)
        throw new Error("Camera needs HTTPS or localhost. Upload a photo on this connection.");
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("This browser does not support camera access. Upload a photo instead.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      if (run !== runRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setState({ phase: "camera" });
    } catch (error) {
      if (run !== runRef.current) return;
      const name = error instanceof Error ? error.name : "";
      const message =
        name === "NotAllowedError"
          ? "Camera permission was not granted. Allow camera access in your browser, or upload a photo."
          : name === "NotFoundError"
            ? "No camera was found. Connect a camera or upload a photo."
            : name === "NotReadableError"
              ? "The camera is busy or unavailable. Close other camera apps and try again, or upload a photo."
              : error instanceof Error && name === "Error"
                ? error.message
                : "Camera unavailable. Upload a photo or enter the label figures below.";
      setState({ phase: "error", message });
    }
  }, []);
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      stopCamera();
      setState({
        phase: "error",
        message: "Your browser could not capture the frame. Upload a photo instead.",
      });
      return;
    }
    context.drawImage(video, 0, 0);
    void runOcr(canvas);
  }, [runOcr, stopCamera]);

  return (
    <div className="scanner">
      {state.phase === "camera-starting" && (
        <div className="scanner-status" role="status">
          <p>Opening your camera… Allow access when your browser asks.</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              runRef.current++;
              stopCamera();
              setState({ phase: "idle" });
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {state.phase === "camera" && (
        <div className="scanner-camera">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            aria-label="Live camera preview"
            onCanPlay={() => setCameraReady(true)}
            onWaiting={() => setCameraReady(false)}
            onError={() => {
              stopCamera();
              setState({
                phase: "error",
                message: "The camera preview stopped. Try again or upload a photo.",
              });
            }}
          />
          <p>
            {cameraReady
              ? "Keep the whole label and stars in view, hold steady, then capture. The photo is scanned after capture."
              : "Waiting for a clear camera frame…"}
          </p>
          <div className="scanner-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={!cameraReady}
              onClick={capture}
            >
              Capture label
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                stopCamera();
                setState({ phase: "idle" });
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {preview && state.phase !== "camera" && (
        <figure className="scanner-preview">
          {/* User-selected local photo: keep it visible for checking extracted values. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your energy label, for checking the recognised figures" />
        </figure>
      )}
      {state.phase === "ocr" && (
        <div className="scanner-status" role="status" aria-live="polite">
          <p>
            {state.progress < 0.3
              ? "Finding the label and reading its text…"
              : state.progress < 0.65
                ? "Reading the consumption panel…"
                : "Checking numbers and stars…"}
          </p>
          <div
            className="scanner-progress"
            role="progressbar"
            aria-label="Reading label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
          >
            <span style={{ width: `${Math.max(5, Math.round(state.progress * 100))}%` }} />
          </div>
          <button type="button" className="button button-secondary" onClick={cancelScan}>
            Cancel scan
          </button>
        </div>
      )}
      {state.phase === "error" && (
        <p className="scanner-status" role="alert">
          {state.message}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="scanner-warnings" aria-live="polite">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {(state.phase === "idle" || state.phase === "error") && (
        <div className="scanner-dropzone">
          <div className="scanner-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? "Try another photo" : "Upload a label"}
            </button>
            <button type="button" className="button button-secondary" onClick={startCamera}>
              Use camera
            </button>
          </div>
          <p>
            JPG, PNG or WebP · up to 25 MB. Include the whole label and avoid glare. Your photo is
            processed on this device.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="scanner-file"
            hidden
            aria-label="Choose an energy label photo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void runOcr(file);
            }}
          />
        </div>
      )}
    </div>
  );
}
