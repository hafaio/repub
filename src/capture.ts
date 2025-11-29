/** capture the current page */
export async function pageCapture(
  tabId: number,
  { retries = 3 }: { retries?: number } = {},
): Promise<ArrayBuffer> {
  for (; retries; --retries) {
    try {
      // NOTE this occasionally returns null, or throws an error for not being
      // available, both of these are transient, so we just retry
      const blob = await chrome.pageCapture.saveAsMHTML({ tabId });
      if (blob) {
        return await blob.arrayBuffer();
      } else {
        console.warn(chrome.runtime.lastError);
      }
    } catch (ex) {
      console.warn(ex);
    }
  }
  throw new Error("couldn't fetch page");
}
