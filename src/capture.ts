/** capture the current page */
export async function pageCapture(
  tabId: number,
  { retries = 3 }: { retries?: number } = {},
): Promise<ArrayBuffer> {
  for (; retries; --retries) {
    const blob = await new Promise<Blob | undefined>((resolve) =>
      chrome.pageCapture.saveAsMHTML({ tabId }, resolve),
    );
    if (blob) {
      return await blob.arrayBuffer();
    } else {
      console.warn(chrome.runtime.lastError);
    }
  }
  throw new Error("couldn't fetch page");
}
