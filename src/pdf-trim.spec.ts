import { expect, test } from "bun:test";
import type { DeviceScreen } from "rmapi-js";
import {
  aggregateBoxes,
  type Box,
  bufferBox,
  computeZoom,
  contentBox,
  percentile,
  type RasterPage,
} from "./pdf-trim-math";

// aspect 0.75, dpi 72 so device px == points; 1000px tall so a full page (also
// 1000 tall) sits at scale 1, for exact assertions
const screen: DeviceScreen = {
  name: "test",
  width: 750,
  height: 1000,
  dpi: 72,
};
const zeroBox: Box = { left: 0, right: 0, top: 0, bottom: 0 };

function whitePage(width: number, height: number): RasterPage {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  return { data, width, height };
}

function fillRect(
  page: RasterPage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * page.width + x) * 4;
      page.data[idx] = 0;
      page.data[idx + 1] = 0;
      page.data[idx + 2] = 0;
    }
  }
}

test("contentBox finds the inked rectangle", () => {
  const page = whitePage(100, 100);
  fillRect(page, 20, 30, 79, 69);
  const box = contentBox(page);
  expect(box).not.toBeNull();
  expect(box!.left).toBeCloseTo(0.2);
  expect(box!.right).toBeCloseTo(0.2);
  expect(box!.top).toBeCloseTo(0.3);
  expect(box!.bottom).toBeCloseTo(0.3);
});

test("contentBox ignores a lone page number", () => {
  const page = whitePage(100, 100);
  fillRect(page, 10, 20, 89, 79); // body content
  fillRect(page, 49, 92, 51, 95); // small centered footer number
  const box = contentBox(page);
  // footer is only 3px wide (< 5% of 100px width) so it doesn't extend bottom
  expect(box!.bottom).toBeCloseTo(0.2);
});

test("contentBox skips a detached left-margin watermark", () => {
  const page = whitePage(200, 200);
  fillRect(page, 8, 20, 14, 180); // thin rotated-watermark band near the edge
  fillRect(page, 41, 20, 160, 180); // real body block, past a whitespace gap
  const box = contentBox(page);
  // left edge is the body (~0.205), not the watermark (~0.04)
  expect(box!.left).toBeCloseTo(0.205);
  expect(box!.right).toBeCloseTo(0.195);
});

test("contentBox skips a watermark-plus-rule margin cluster", () => {
  const page = whitePage(200, 200);
  fillRect(page, 8, 20, 11, 180); // rotated watermark band
  fillRect(page, 14, 20, 14, 180); // vertical rule a few px away
  fillRect(page, 41, 20, 160, 180); // real body block past a wider gap
  const box = contentBox(page);
  // the whole thin left cluster is bridged and skipped, so left is the body
  expect(box!.left).toBeCloseTo(0.205);
});

test("contentBox ignores a top-corner header offset from the body", () => {
  const page = whitePage(200, 200);
  fillRect(page, 150, 5, 190, 12); // header top-right, above and right of body
  fillRect(page, 40, 40, 120, 170); // body block
  const box = contentBox(page);
  // header row is dropped, so the column pass runs only over body rows →
  // left/right track the body, not the far-right header
  expect(box!.top).toBeCloseTo(0.2);
  expect(box!.left).toBeCloseTo(0.2);
  expect(box!.right).toBeCloseTo(0.395);
});

test("contentBox returns null for a blank page", () => {
  expect(contentBox(whitePage(50, 50))).toBeNull();
});

test("bufferBox grows the box outward and clamps at the edge", () => {
  const box: Box = { left: 0.1, right: 0.1, top: 0.005, bottom: 0.1 };
  const buffered = bufferBox(box);
  expect(buffered.left).toBeCloseTo(0.085); // 0.1 - BUFFER_FRAC (0.015)
  expect(buffered.right).toBeCloseTo(0.085);
  expect(buffered.top).toBe(0); // 0.005 - 0.015 clamps to 0
  expect(buffered.bottom).toBeCloseTo(0.085);
});

test("percentile interpolates at rank frac*(n-1)", () => {
  expect(percentile([0, 0.1, 0.2, 0.3, 0.4], 0.5)).toBeCloseTo(0.2); // median
  expect(percentile([0, 0.1, 0.2, 0.3, 0.4], 0)).toBeCloseTo(0); // min
  expect(percentile([0, 1, 2, 3], 0.1)).toBeCloseTo(0.3); // 0.1*3 = 0.3
});

test("aggregateBoxes takes the per-edge median across pages", () => {
  const boxes: Box[] = [
    { left: 0.1, right: 0.4, top: 0.1, bottom: 0.3 },
    { left: 0.2, right: 0.5, top: 0.2, bottom: 0.2 },
    { left: 0.3, right: 0.6, top: 0.3, bottom: 0.1 },
  ];
  expect(aggregateBoxes(boxes)).toEqual({
    left: 0.2,
    right: 0.5,
    top: 0.2,
    bottom: 0.2,
  });
});

test("computeZoom shows a full page at scale screenHeight/pageHeight", () => {
  // the view fills the screen height, so a page as tall as the screen is scale 1
  const zoom = computeZoom(zeroBox, 750, 1000, screen);
  expect(zoom).not.toBeNull();
  expect(zoom!.customZoomScale).toBeCloseTo(1);
  expect(zoom!.customZoomCenterX).toBeCloseTo(0);
  expect(zoom!.customZoomCenterY).toBeCloseTo(500);
  expect(zoom!.customZoomPageWidth).toBeCloseTo(750);
  expect(zoom!.customZoomPageHeight).toBeCloseTo(1000);
  expect(zoom!.customZoomOrientation).toBe("portrait");
});

test("computeZoom scale is linear in the shown height fraction", () => {
  // a centered box showing half the page in each dimension → view is half the
  // page height, so scale doubles vs the full page
  const half: Box = { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25 };
  const zoom = computeZoom(half, 750, 1000, screen);
  expect(zoom!.customZoomScale).toBeCloseTo(2);
  expect(zoom!.customZoomCenterX).toBeCloseTo(0);
  expect(zoom!.customZoomCenterY).toBeCloseTo(500);
});

test("computeZoom binds on width for content wider than the device", () => {
  // wide, short box: content aspect > device → width binds, view height is
  // driven by contentWidth/aspect (1000), not contentHeight (200)
  const box: Box = { left: 0, right: 0, top: 0.4, bottom: 0.4 };
  const zoom = computeZoom(box, 750, 1000, screen);
  expect(zoom!.customZoomScale).toBeCloseTo(1); // screenHeight 1000 / viewHeight 1000
});

test("computeZoom view always contains the content box", () => {
  const box: Box = { left: 0.4, right: 0.05, top: 0.1, bottom: 0.1 };
  const zoom = computeZoom(box, 750, 1000, screen);
  const pageW = zoom!.customZoomPageWidth!;
  const pageH = zoom!.customZoomPageHeight!;
  const viewH = screen.height / zoom!.customZoomScale!; // reconstruct view (device px)
  const viewW = viewH * (screen.width / screen.height);
  const cx = pageW / 2 + zoom!.customZoomCenterX!;
  const cy = zoom!.customZoomCenterY!;
  expect(cx - viewW / 2).toBeLessThanOrEqual(box.left * pageW + 1e-6);
  expect(cx + viewW / 2).toBeGreaterThanOrEqual((1 - box.right) * pageW - 1e-6);
  expect(cy - viewH / 2).toBeLessThanOrEqual(box.top * pageH + 1e-6);
  expect(cy + viewH / 2).toBeGreaterThanOrEqual(
    (1 - box.bottom) * pageH - 1e-6,
  );
});

test("computeZoom keeps the view page-centered when the box fits", () => {
  // a mildly off-center box still fits a page-centered view → no offset
  const box: Box = { left: 0.3, right: 0.1, top: 0.1, bottom: 0.1 };
  const zoom = computeZoom(box, 750, 1000, screen);
  expect(zoom!.customZoomCenterX).toBeCloseTo(0);
});

test("computeZoom shifts the view only to keep a far box inside", () => {
  // content pinned to the right edge → a page-centered view can't hold it, so
  // the view shifts right (positive offset)
  const box: Box = { left: 0.5, right: 0, top: 0.1, bottom: 0.1 };
  const zoom = computeZoom(box, 750, 1000, screen);
  expect(zoom!.customZoomCenterX!).toBeGreaterThan(0);
});

test("computeZoom flips orientation for a landscape page", () => {
  const zoom = computeZoom(zeroBox, 1000, 750, screen);
  expect(zoom!.customZoomOrientation).toBe("landscape");
});

test("computeZoom returns null for a degenerate box", () => {
  const box: Box = { left: 0.6, right: 0.6, top: 0.1, bottom: 0.1 };
  expect(computeZoom(box, 750, 1000, screen)).toBeNull();
});

test("computeZoom scales absolute fields by device dpi", () => {
  // same physical screen at 2x resolution: scale unchanged, pixels doubled
  const hi: DeviceScreen = { name: "hi", width: 1500, height: 2000, dpi: 144 };
  const lo = computeZoom(zeroBox, 750, 1000, screen);
  const zoom = computeZoom(zeroBox, 750, 1000, hi);
  // same on-screen fit (scale), but pixel-space fields double with dpi
  expect(zoom!.customZoomScale).toBeCloseTo(lo!.customZoomScale!);
  expect(zoom!.customZoomPageHeight).toBeCloseTo(2 * lo!.customZoomPageHeight!);
  expect(zoom!.customZoomCenterY).toBeCloseTo(2 * lo!.customZoomCenterY!);
});
