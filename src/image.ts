const maxWidth = 1620;
const maxHeight = 2160;

const fact = maxWidth * maxHeight;

export async function brighten(
  buffer: Uint8Array,
  mime: string,
  brightness: number,
  grayscale: boolean,
): Promise<readonly [Uint8Array, "image/png" | "image/svg+xml"]> {
  if (mime === "image/svg+xml") {
    // don't alter svgs
    return [buffer, mime] as const;
  }

  // get into a bitmap
  const blob = new Blob([buffer], { type: mime });
  const bitmap = await createImageBitmap(blob);

  // scale down
  const heightFact = bitmap.height * maxWidth;
  const widthFact = bitmap.width * maxHeight;

  let width, height;
  if (fact > heightFact && fact > widthFact) {
    ({ width, height } = bitmap);
  } else if (widthFact > heightFact) {
    width = maxWidth;
    height = heightFact / bitmap.width;
  } else {
    height = maxHeight;
    width = widthFact / bitmap.height;
  }

  // create canvas, write to it, and brighten it
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  /* eslint-disable spellcheck/spell-checker */
  ctx.filter = `
  brightness(${brightness * 100}%)
  grayscale(${+grayscale * 100}%)`;
  /* eslint-enable spellcheck/spell-checker */
  ctx.drawImage(bitmap, 0, 0, width, height);

  // export result
  const type = "image/png";
  const result = await canvas.convertToBlob({ type });
  const buff = await result.arrayBuffer();
  return [new Uint8Array(buff), type];
}
