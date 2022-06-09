export async function progress(tabId: number, prog: number): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({
      tabId,
      color: "#000000",
    }),
    chrome.action.setBadgeText({
      tabId,
      text: `${(prog * 100).toFixed(0)}%`,
    }),
  ]);
}

export async function stop(tabId: number) {
  await chrome.action.setBadgeText({ tabId, text: "" });
}
