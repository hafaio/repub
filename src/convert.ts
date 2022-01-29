import { ImageData, ImageMime } from "teapub/dist";
import { Asset } from "./parse";

export interface TypedImageData extends ImageData {
  readonly mime: ImageMime;
}

export interface Converter {
  (image: Uint8Array, contentType: string): Promise<TypedImageData | null>;
}

function isConverted(
  res: [string, TypedImageData | null]
): res is [string, TypedImageData] {
  const [, dat] = res;
  return dat !== null;
}

export async function convert(
  assets: Iterable<Asset>,
  converter: Converter
): Promise<Record<string, TypedImageData>> {
  const imagePromises: Promise<[string, TypedImageData | null]>[] = [];
  for (const { href, content, contentType } of assets) {
    if (contentType.startsWith("image/")) {
      imagePromises.push(
        converter(content, contentType).then((res) => [href, res])
      );
    }
  }
  const images = await Promise.all(imagePromises);
  return Object.fromEntries(images.filter(isConverted));
}
