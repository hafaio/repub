/** capture the current page */
export async function pageCapture(
  tabId: number,
  { retries = 3 }: { retries?: number } = {}
): Promise<ReadableStream<ArrayBuffer>> {
  for (; retries; --retries) {
    const blob = await new Promise<Blob | undefined>((resolve) =>
      chrome.pageCapture.saveAsMHTML({ tabId }, resolve)
    );
    if (blob) {
      // typescript is confused because of leaked node types, and there's no
      // way around it
      return blob.stream() as unknown as ReadableStream<ArrayBuffer>;
    } else {
      console.warn(chrome.runtime.lastError);
    }
  }
  throw new Error("couldn't fetch page");
}
