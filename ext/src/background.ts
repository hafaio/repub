import { fromByteArray } from "base64-js";
import { default as init, render } from "repub-bind/repub_bind";
import { pageCapture } from "./capture";
import { getOptions, ImageHandling } from "./options";
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
async function fetchEpub({
  tabId,
  imageHandling,
  imageHrefSimilarityThreshold,
  imageBrightness,
  filterLinks,
  css,
  hrefHeader,
  bylineHeader,
  coverHeader,
}: {
  tabId: number;
  imageHandling: ImageHandling;
  imageHrefSimilarityThreshold: number;
  imageBrightness: number;
  filterLinks: boolean;
  css: string | undefined;
  hrefHeader: boolean;
  bylineHeader: boolean;
  coverHeader: boolean;
}): Promise<{ buffer: Uint8Array; title: string }> {
  await chrome.action.setBadgeText({
    tabId,
    text: "25%",
  });

  const mhtml = await pageCapture(tabId);
  await chrome.action.setBadgeText({
    tabId,
    text: "50%",
  });

  // necessary for render to work with web format
  await init();
  let epub, title, res;
  try {
    res = render(
      new Uint8Array(mhtml),
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      filterLinks,
      css ?? "",
      hrefHeader,
      bylineHeader,
      coverHeader
    );
    ({ epub, title } = res);
  } finally {
    res?.free();
  }

  await chrome.action.setBadgeText({
    tabId,
    text: "75%",
  });
  return { buffer: epub, title: title ?? "missing title" };
}

const remarkableCss = `
p {
  margin-top: 1em;
  margin-bottom: 1em;
}

ul, ol {
  padding: 1em;
}

ul li, ol li {
  margin-left: 1.5em;
  padding-left: 0.5em;
}

figcaption {
  font-size: 0.5rem;
  font-style: italic;
}`;

/**
 * create and upload epub
 */
async function rePub(tabId: number) {
  let title: string | undefined;
  try {
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: "#000000",
    });
    await chrome.action.setBadgeText({
      tabId,
      text: "0%",
    });

    const {
      deviceToken,
      outputStyle,
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      hrefHeader,
      bylineHeader,
      coverHeader,
      rmCss,
      filterLinks,
      ...rmOptions
    } = await getOptions();

    // NOTE we don't resolve the promise here so that it can be used elsewhere
    const epubPromise = fetchEpub({
      tabId,
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      hrefHeader,
      bylineHeader,
      coverHeader,
      filterLinks,
      css: rmCss ? remarkableCss : undefined,
    }).then((epub) => {
      // set title for use in error;
      title = epub.title;
      return epub;
    });

    // upload
    if (outputStyle === "download") {
      const { buffer, title } = await epubPromise;
      await chrome.downloads.download({
        filename: `${safeFilename(title)}.epub`,
        url: `data:application/epub+zip;base64,${fromByteArray(buffer)}`,
      });
    } else if (deviceToken) {
      await upload(epubPromise, deviceToken, rmOptions, {});
    } else {
      chrome.runtime.openOptionsPage();
      throw new Error(
        "must be authenticated to upload documents to reMarkable"
      );
    }

    await chrome.action.setBadgeText({
      tabId,
      text: "100%",
    });
    // NOTE leave progress around to see
    await sleep(500);
  } catch (ex) {
    const msg = ex instanceof Error ? ex.toString() : "unknown error";
    console.error("problem creating epub", title, msg);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/repub_128.png",
      title: "Conversion to epub failed",
      message: title ? `${title} - ${msg}` : msg,
    });
  } finally {
    await chrome.action.setBadgeText({
      tabId,
      text: "",
    });
  }
}

// watch for clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void rePub(tab.id);
  }
});
