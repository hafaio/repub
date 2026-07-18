import type { DeviceScreen, PutOptions } from "rmapi-js";

/** content insets, each a fraction [0, 1] of the page dimension */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** a rasterized page, expected opaque with a white background */
export interface RasterPage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

// a pixel counts as ink below this luma (0 black .. 255 white)
const INK_LUMA = 180;
// a scan line counts as content once this fraction of it is ink; a low noise
// floor so a one-line outdented heading still registers — detached marginal
// marks are dropped by contentEdge, not by this threshold
const LINE_FRAC = 0.005;
// ignore a content run this thin (fraction of the axis) when it sits detached in
// the margin — a rotated watermark, rule, running header, line or page number
const MIN_BLOCK_FRAC = 0.05;
// whitespace narrower than this (fraction of the axis) is bridged, so a cluster
// of thin marginal marks (watermark beside a rule) counts as one detached band
const MIN_GAP_FRAC = 0.02;
// aggregate per-page insets at this percentile; 0.5 = the per-edge median of the
// pages, giving a tight crop near the typical page's content box
const BOX_PERCENTILE = 0.5;
// grow the detected box outward by this fraction of the page — about one text
// line, so the crop isn't flush against the content
const BUFFER_FRAC = 0.015;
// reMarkable's practical customFit zoom range
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

/**
 * scan a content/whitespace profile inward and return the first real content
 * index, skipping thin bands that sit detached in the margin
 *
 * Content runs separated by whitespace narrower than `minGap` are bridged into
 * one run, so a cluster of thin marginal marks (a watermark beside a rule)
 * counts together; a bridged run still shorter than `minBlock` is skipped as a
 * margin artifact. Returns `-1` when there is no substantial content.
 */
function contentEdge(
  content: boolean[],
  minBlock: number,
  minGap: number,
): number {
  const len = content.length;
  let idx = 0;
  while (idx < len && !content[idx]) idx++;
  while (idx < len) {
    const runStart = idx;
    let runEnd = idx;
    while (idx < len) {
      while (idx < len && content[idx]) idx++;
      runEnd = idx;
      const gapStart = idx;
      while (idx < len && !content[idx]) idx++;
      if (idx >= len || idx - gapStart >= minGap) break;
    }
    if (runEnd - runStart >= minBlock) return runStart;
    if (idx >= len) break;
  }
  return -1;
}

function isInk(data: Uint8ClampedArray | Uint8Array, idx: number): boolean {
  return (
    0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]! <
    INK_LUMA
  );
}

function inkRow(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  y: number,
): number {
  let ink = 0;
  for (let x = 0; x < width; x++) {
    if (isInk(data, (y * width + x) * 4)) ink++;
  }
  return ink;
}

/**
 * detect the content bounding box of a rasterized page
 *
 * Two passes: first the row profile fixes the vertical extent (dropping a
 * running header/footer via {@link contentEdge}), then the column profile is
 * taken over only those content rows — so a top-corner header can't pull the
 * horizontal edges — and {@link contentEdge} drops detached marginal marks
 * (watermarks, rules). Returns `null` for a blank page.
 */
export function contentBox({ data, width, height }: RasterPage): Box | null {
  const rowInk = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    rowInk[y] = inkRow(data, width, y);
  }
  const rowContent = Array.from(rowInk, (ink) => ink > width * LINE_FRAC);
  const rowBlock = height * MIN_BLOCK_FRAC;
  const rowGap = height * MIN_GAP_FRAC;
  const top = contentEdge(rowContent, rowBlock, rowGap);
  if (top < 0) return null;
  const bottom = contentEdge([...rowContent].reverse(), rowBlock, rowGap);
  const bottomRow = height - 1 - bottom;

  const colInk = new Uint32Array(width);
  for (let y = top; y <= bottomRow; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const luma =
        0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
      if (luma < INK_LUMA) colInk[x] = colInk[x]! + 1;
    }
  }
  const rowsScanned = bottomRow - top + 1;
  const colContent = Array.from(colInk, (ink) => ink > rowsScanned * LINE_FRAC);
  const colBlock = width * MIN_BLOCK_FRAC;
  const colGap = width * MIN_GAP_FRAC;
  const left = contentEdge(colContent, colBlock, colGap);
  if (left < 0) return null;
  const right = contentEdge([...colContent].reverse(), colBlock, colGap);

  return {
    left: left / width,
    right: right / width,
    top: top / height,
    bottom: bottom / height,
  };
}

/** median of a list — the 0.5 percentile */
export function median(nums: number[]): number {
  return percentile(nums, 0.5);
}

/** grow a box outward by {@link BUFFER_FRAC} on every edge, clamped to the page */
export function bufferBox(box: Box): Box {
  return {
    left: Math.max(0, box.left - BUFFER_FRAC),
    right: Math.max(0, box.right - BUFFER_FRAC),
    top: Math.max(0, box.top - BUFFER_FRAC),
    bottom: Math.max(0, box.bottom - BUFFER_FRAC),
  };
}

/** linear-interpolated percentile (rank = frac·(n−1), numpy default) */
export function percentile(nums: number[], frac: number): number {
  const sorted = [...nums].sort((first, second) => first - second);
  const rank = frac * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low]! + (rank - low) * (sorted[high]! - sorted[low]!);
}

/**
 * aggregate per-page insets into one box — the per-edge {@link BOX_PERCENTILE}
 * (median) across pages, a tight crop around the typical page's content
 */
export function aggregateBoxes(boxes: Box[]): Box {
  return {
    left: percentile(
      boxes.map((box) => box.left),
      BOX_PERCENTILE,
    ),
    right: percentile(
      boxes.map((box) => box.right),
      BOX_PERCENTILE,
    ),
    top: percentile(
      boxes.map((box) => box.top),
      BOX_PERCENTILE,
    ),
    bottom: percentile(
      boxes.map((box) => box.bottom),
      BOX_PERCENTILE,
    ),
  };
}

/**
 * turn a content box into reMarkable `customFit` zoom fields
 *
 * The view has the device aspect ratio; `customZoomScale = screenHeight /
 * viewHeight` in device px, so the view fills the screen height at scale 1 and
 * magnification is linear. The view is centered on the page, shifted only far
 * enough to keep the box inside. Centers and page dims are in the page's own
 * device pixels (`pt * dpi / 72`). Returns `null` for a degenerate box.
 */
export function computeZoom(
  box: Box,
  widthPt: number,
  heightPt: number,
  screen: DeviceScreen,
): Partial<PutOptions> | null {
  const widthFrac = 1 - box.left - box.right;
  const heightFrac = 1 - box.top - box.bottom;
  // reject empty or non-finite boxes — NaN <= 0 is false, so guard positively
  if (!(widthFrac > 0) || !(heightFrac > 0)) return null;

  const landscape = widthPt > heightPt;
  const aspect = landscape
    ? screen.height / screen.width
    : screen.width / screen.height;
  const factor = screen.dpi / 72;
  const pageWidth = widthPt * factor;
  const pageHeight = heightPt * factor;
  const contentWidth = widthFrac * pageWidth;
  const contentHeight = heightFrac * pageHeight;

  // the view has the device aspect and is the smallest such box holding content
  const viewHeight = Math.max(contentHeight, contentWidth / aspect);
  const viewWidth = viewHeight * aspect;
  // customZoomScale = screenHeight / viewHeight (both device px): the view fills
  // the screen height at scale 1, magnification linear. Calibrated on device.
  const screenSpan = landscape ? screen.width : screen.height;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, screenSpan / viewHeight),
  );

  // center the view on the page, shifting only as far as needed to keep the
  // content box inside it
  const contentLeft = box.left * pageWidth;
  const contentRight = (1 - box.right) * pageWidth;
  const contentTop = box.top * pageHeight;
  const contentBottom = (1 - box.bottom) * pageHeight;
  const centerX = Math.min(
    contentLeft + viewWidth / 2,
    Math.max(contentRight - viewWidth / 2, pageWidth / 2),
  );
  const centerY = Math.min(
    contentTop + viewHeight / 2,
    Math.max(contentBottom - viewHeight / 2, pageHeight / 2),
  );

  return {
    zoomMode: "customFit",
    customZoomScale: scale,
    customZoomCenterX: centerX - pageWidth / 2,
    customZoomCenterY: centerY,
    customZoomPageWidth: pageWidth,
    customZoomPageHeight: pageHeight,
    customZoomOrientation: landscape ? "landscape" : "portrait",
  };
}
