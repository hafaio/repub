import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import { type DeviceModel, deviceScreens, type PutOptions } from "rmapi-js";
import {
  aggregateBoxes,
  type Box,
  bufferBox,
  computeZoom,
  contentBox,
  median,
} from "./pdf-trim-math";

// sample at most this many pages, evenly spaced, to bound analysis time
const MAX_PAGES = 32;
// render the long side to roughly this many pixels; enough to locate margins
const TARGET_PX = 1000;
// give up on a wedged pdf.js worker so the upload falls back to no trim
const LOAD_TIMEOUT_MS = 20_000;

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("pdf analysis timed out")), ms);
  });
}

let workerReady = false;
function ensureWorker(): void {
  if (!workerReady) {
    // ./pdf.worker.js is emitted next to options.js by its own bun build entry
    // (see the export:bundle script); loading from our own origin keeps the
    // default MV3 CSP happy
    GlobalWorkerOptions.workerPort = new Worker(
      new URL("./pdf.worker.js", import.meta.url),
      { type: "module" },
    );
    workerReady = true;
  }
}

function samplePages(numPages: number): number[] {
  if (numPages <= MAX_PAGES) {
    return Array.from({ length: numPages }, (_, idx) => idx + 1);
  }
  return Array.from({ length: MAX_PAGES }, (_, idx) =>
    Math.round(1 + (idx * (numPages - 1)) / (MAX_PAGES - 1)),
  );
}

/**
 * detect predominantly-white PDF margins and return `customFit` zoom options
 *
 * Rasterizes a sample of pages, takes the median content box, and fits it to the
 * selected device (see {@link computeZoom}). Returns an empty object when nothing
 * useful is found so the caller can upload without a zoom.
 */
export async function analyzePdfMargins(
  pdf: Uint8Array,
  device: DeviceModel,
): Promise<Partial<PutOptions>> {
  ensureWorker();
  const loadingTask = getDocument({
    // pdf.js takes ownership of the buffer, so hand it a copy
    data: pdf.slice(),
    useWorkerFetch: false,
    useWasm: false,
  });
  const doc = await Promise.race([
    loadingTask.promise,
    rejectAfter(LOAD_TIMEOUT_MS),
  ]);
  try {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("could not get a 2d context for pdf analysis");

    const boxes: Box[] = [];
    const widths: number[] = [];
    const heights: number[] = [];
    for (const pageNum of samplePages(doc.numPages)) {
      try {
        const page = await doc.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: TARGET_PX / Math.max(base.width, base.height),
        });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({
          canvas: null,
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
          background: "white",
        }).promise;
        const box = contentBox(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
        );
        page.cleanup();
        if (box) {
          boxes.push(box);
          widths.push(base.width);
          heights.push(base.height);
        }
      } catch (ex) {
        console.warn(`pdf trim: skipping page ${pageNum}`, ex);
      }
    }

    if (!boxes.length) {
      console.warn("pdf trim: no content detected; uploading without a crop");
      return {};
    }
    const box = bufferBox(aggregateBoxes(boxes));
    const widthPt = median(widths);
    const heightPt = median(heights);
    return computeZoom(box, widthPt, heightPt, deviceScreens[device]) ?? {};
  } finally {
    await loadingTask.destroy();
  }
}
