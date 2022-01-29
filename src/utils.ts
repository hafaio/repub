/**
 * sleep for x milliseconds
 */
export function sleep(timeout: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * assert val with optional error message
 */
export function assert(
  val: unknown,
  msg: string = "internal error"
): asserts val {
  if (!val) {
    throw new Error(msg);
  }
}

/** this could be improved see npm:sanitize-filename */
export function safeFilename(original: string): string {
  // NOTE could use text encoder / decoder to get bytes right for utf-8 encoding
  return original.replace(/[\x00-\x1f\x80-\x9f/?<>\\:*|]/, "_");
}
