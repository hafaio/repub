import { fromByteArray } from "base64-js";
import { pageCapture } from "./capture";
import { EpubOptions, getOptions } from "./options";
import { render } from "./render";
import { upload } from "./upload";
import { safeFilename, sleep } from "./utils";

/**
 * fetch an epub from the current page
 *
 * Update status while progressing.
 *
 * NOTE this is a separate function because both the upload and download paths
 * use it slightly differently.
 */
async function fetchEpub(
  tabId: number,
  opts: EpubOptions,
): Promise<{ epub: ArrayBuffer; title: string }> {
  await chrome.action.setBadgeText({
    tabId,
    text: "25%",
  });

  const mhtml = await pageCapture(tabId);
  await chrome.action.setBadgeText({
    tabId,
    text: "50%",
  });

  const { epub, title } = await render(mhtml, opts);
  await chrome.action.setBadgeText({
    tabId,
    text: "75%",
  });
  return { epub, title: title ?? "missing title" };
}

/**
 * create and upload epub
 */
async function rePub(tabId: number) {
  try {
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: "#000000",
    });
    await chrome.action.setBadgeText({
      tabId,
      text: "0%",
    });

    const { deviceToken, outputStyle, downloadAsk, ...rest } =
      await getOptions();

    // NOTE we don't resolve the promise here so that it can be used elsewhere
    const epubPromise = fetchEpub(tabId, rest);

    // upload
    if (outputStyle === "download") {
      const { epub, title } = await epubPromise;
      const base64 = fromByteArray(new Uint8Array(epub));
      await chrome.downloads.download({
        filename: `${safeFilename(title)}.epub`,
        url: `data:application/epub+zip;base64,${base64}`,
        saveAs: downloadAsk,
      });
    } else if (deviceToken) {
      await upload(epubPromise, deviceToken, rest, {});
    } else {
      chrome.runtime.openOptionsPage();
      throw new Error(
        "must be authenticated to upload documents to reMarkable",
      );
    }

    await chrome.action.setBadgeText({
      tabId,
      text: "100%",
    });
    // NOTE leave progress around to see
    await sleep(500);
    await chrome.action.setBadgeText({
      tabId,
      text: "",
    });
  } catch (ex) {
    const msg = ex instanceof Error ? ex.toString() : "unknown error";
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/repub_128.png",
      title: "Conversion to epub failed",
      message: msg,
    });
    await Promise.all([
      chrome.action.setBadgeText({
        tabId,
        text: "err",
      }),
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: "#ff0000",
      }),
    ]);
    throw ex;
  }
}

// watch for clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void rePub(tab.id);
  }
});
