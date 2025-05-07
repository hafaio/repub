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
  msg: string = "timeout",
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
  msg: string = "internal error",
): asserts val {
  if (!val) {
    throw new Error(msg);
  }
}

/** this could be improved see npm:sanitize-filename */
export function safeFilename(original: string): string {
  return (
    original
      // remove control characters
      .replace(/\p{C}/gu, "")
      // replace separators with spaces
      .replace(/\p{Z}/gu, " ")
      // replace problematic characters with underscores
      .replace(/[\\/:*?"<>|]/g, "_")
  );
}

export function errString(err: unknown): string {
  if (err === null) {
    return "null error";
  } else if (err === undefined) {
    return "undefined error";
  } else if (typeof err === "function") {
    return `function error: ${err.name}`;
  } else if (typeof err === "string") {
    return err;
  } else if (err instanceof Error) {
    return err.toString();
  } else {
    return "unknown object error";
  }
}
