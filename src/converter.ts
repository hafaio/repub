import { isImageMimeType } from "teapub/dist";
import { Converter, TypedImageData } from "./convert";
import { assert } from "./utils";

export interface ConversionOptions {
  maxWidth?: number;
  maxHeight?: number;
  brightness?: number;
  format?: "image/png" | "image/jpeg";
}

export function createConverter({
  maxWidth = 1404,
  maxHeight = 1872,
  brightness = 1,
  format = "image/jpeg",
}: ConversionOptions = {}): Converter {
  return async (
    content: Uint8Array,
    contentType: string
  ): Promise<TypedImageData | null> => {
    try {
      const before = new Blob([content], { type: contentType });
      const img = await createImageBitmap(before);

      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const width = Math.floor(img.width * scale);
      const height = Math.floor(img.height * scale);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      assert(ctx, "couldn't get image context for browser conversion");
      ctx.filter = `brightness(${brightness})`;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      const after = await canvas.convertToBlob({ type: format });
      const array = await after.arrayBuffer();
      return { data: new Uint8Array(array), mime: format };
    } catch (ex) {
      if (isImageMimeType(contentType)) {
        return { data: content, mime: contentType };
      } else {
        return null;
      }
    }
  };
}
