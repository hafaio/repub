import { isImageMimeType } from "teapub/dist";
import { Converter, TypedImageData } from "./convert";
import { assert } from "./utils";

export interface ConversionOptions {
  size: readonly [number, number] | null;
  format: "image/png" | "image/jpeg";
}

function convertOriginal(img: ImageBitmap): OffscreenCanvas {
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  assert(ctx, "couldn't get image context for browser conversion");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function convertSized(
  img: ImageBitmap,
  maxSize: readonly [number, number]
): OffscreenCanvas {
  const [rmWidth, rmHeight] = maxSize;
  const scale = Math.min(rmWidth / img.width, rmHeight / img.height, 1);
  const width = Math.floor(img.width * scale);
  const height = Math.floor(img.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  assert(ctx, "couldn't get image context for browser conversion");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export function createConverter({
  size,
  format,
}: ConversionOptions): Converter {
  const conv = size
    ? (img: ImageBitmap) => convertSized(img, size)
    : convertOriginal;

  return async (
    content: Uint8Array,
    contentType: string
  ): Promise<TypedImageData | null> => {
    if (!size && isImageMimeType(contentType)) {
      return { data: content, mime: contentType };
    }
    try {
      const before = new Blob([content], { type: contentType });
      const img = await createImageBitmap(before);
      const canvas = conv(img);
      const after = await canvas.convertToBlob({ type: format });
      const array = await after.arrayBuffer();
      const data = new Uint8Array(array);
      return { data, mime: format };
    } catch (ex) {
      console.warn("problem converting:", ex);
      if (isImageMimeType(contentType)) {
        return { data: content, mime: contentType };
      } else {
        return null;
      }
    }
  };
}
