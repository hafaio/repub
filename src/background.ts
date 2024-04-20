import { fromByteArray } from "base64-js";
import { pageCapture } from "./capture";
import { getOptions } from "./options";
import { render } from "./render";
import { getTab } from "./status";
import { upload } from "./upload";
import { safeFilename, sleep } from "./utils";

/**
 * create and upload epub
 */
async function rePub(tabId: number) {
  // get active state for clearing badge with navigation
  const tab = getTab(tabId);
  try {
    await tab.init();

    const { deviceToken, outputStyle, downloadAsk, ...opts } =
      await getOptions();
    await tab.progress(25);

    const mhtml = await pageCapture(tabId);
    await tab.progress(50);

    const { epub, title = "missing title" } = await render(mhtml, opts);
    await tab.progress(75);

    // upload
    if (outputStyle === "download") {
      const base64 = fromByteArray(new Uint8Array(epub));
      await chrome.downloads.download({
        filename: `${safeFilename(title)}.epub`,
        url: `data:application/epub+zip;base64,${base64}`,
        saveAs: downloadAsk,
      });
    } else if (deviceToken) {
      await upload(epub, title, deviceToken, opts, {});
    } else {
      void chrome.runtime.openOptionsPage();
      throw new Error(
        "must be authenticated to upload documents to reMarkable",
      );
    }

    await tab.complete();
  } catch (ex) {
    const msg = ex instanceof Error ? ex.toString() : "unknown error";
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/repub_128.png",
      title: "Conversion to epub failed",
      message: msg,
    });
    await tab.error();
    throw ex;
  } finally {
    // handle clearing the bad if we've navigated

    // NOTE leave progress around to see
    await sleep(500);
    await tab.drop();
  }
}

// watch for clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void rePub(tab.id);
  }
});
