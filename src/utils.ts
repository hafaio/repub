/**
 * sleep for x milliseconds
 */
export function sleep(timeout: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * timeout after x milliseconds
 */
export async function timeout<T>(
  prom: Promise<T>,
  timeout: number,
  msg: string = "timeout"
): Promise<T> {
  return await Promise.race([
    prom,
    sleep(timeout).then(() => {
      throw new Error(msg);
    }),
  ]);
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

/** edit distance between two strings */
export function levenshtein(left: string, right: string): number {
  if (left.length > right.length) {
    [left, right] = [right, left];
  }
  const lchars = [...left];
  const rchars = [...right];

  let dists = [...Array(lchars.length + 1).keys()];
  for (const [i, rc] of rchars.entries()) {
    const next = [i + 1];
    for (const [j, lc] of lchars.entries()) {
      next.push(
        rc === lc ? dists[j]! : Math.min(dists[j]!, dists[j + 1]!, next[j]!) + 1
      );
    }
    dists = next;
  }
  return dists[dists.length - 1]!;
}
