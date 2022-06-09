import { fromByteArray } from "base64-js";
import { alter, closeMatch, exactMatch } from "./alter";
import { pageCapture } from "./capture";
import { convert } from "./convert";
import { createConverter } from "./converter";
import { epub } from "./epub";
import { getOptions, ImageHandling } from "./options";
import { Asset, parseMhtmlStream } from "./parse";
import { progress, stop } from "./progress";
import { upload } from "./upload";
import { safeFilename, sleep, timeout } from "./utils";

async function fetchEpub({
  tabId,
  summarizeCharThreshold,
  imageHandling,
  imageHrefSimilarityThreshold,
  imageBrightness,
  filterLinks,
  css,
  hrefHeader,
}: {
  tabId: number;
  summarizeCharThreshold: number;
  imageHandling: ImageHandling;
  imageHrefSimilarityThreshold: number;
  imageBrightness: number;
  filterLinks: boolean;
  css: string | undefined;
  hrefHeader: boolean;
}): Promise<{ buffer: Uint8Array; title: string }> {
  // capture page
  const stream = await pageCapture(tabId);
  await progress(tabId, 0.2);

  // parse components out of mhtml
  const { content, href, title, assets } = await parseMhtmlStream(stream);
  await progress(tabId, 0.3);

  // get all images
  const imageMap = new Map<string, Asset>();
  for await (const asset of assets) {
    const { href, contentType } = asset;
    if (contentType.startsWith("image/")) {
      imageMap.set(href, asset);
    }
  }
  await progress(tabId, 0.4);

  // alter page by parsing out images
  const matcher =
    imageHrefSimilarityThreshold <= 0
      ? exactMatch(imageMap)
      : closeMatch(imageMap, imageHrefSimilarityThreshold);
  const {
    altered,
    title: parsedTitle,
    byline,
    seen,
  } = await alter(content, matcher, {
    imageHandling,
    filterLinks,
    summarizeCharThreshold,
  });
  const images = [...seen].map((href) => imageMap.get(href)!);
  await progress(tabId, 0.5);

  // convert epub unfriendly images
  const converted = await convert(
    images,
    createConverter({ brightness: imageBrightness })
  );
  await progress(tabId, 0.6);

  // convert to an epub
  const finalTitle = parsedTitle ?? title;
  const buffer = await timeout(
    epub({
      title: finalTitle,
      content: altered,
      author: byline,
      images: converted,
      css,
      href: hrefHeader ? href : undefined,
      missingImage: imageHandling === "keep" ? "ignore" : "remove",
    }),
    10000,
    "timeout uploading epub"
  );

  await progress(tabId, 0.8);
  return { buffer, title: finalTitle };
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

// workhorse
async function rePub(tabId: number) {
  try {
    const {
      deviceToken,
      outputStyle,
      summarizeCharThreshold,
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      hrefHeader,
      rmCss,
      filterLinks,
      ...rmOptions
    } = await getOptions();

    const epubPromise = fetchEpub({
      tabId,
      summarizeCharThreshold,
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      hrefHeader,
      filterLinks,
      css: rmCss ? remarkableCss : undefined,
    });

    // upload
    if (outputStyle === "download") {
      const { buffer, title } = await epubPromise;
      await chrome.downloads.download({
        filename: `${safeFilename(title)}.epub`,
        url: `data:application/epub+zip;base64,${fromByteArray(buffer)}`,
      });
    } else if (deviceToken) {
      await upload(epubPromise, deviceToken, rmOptions);
    } else {
      await chrome.runtime.openOptionsPage();
      throw new Error(
        "must be authenticated to upload documents to reMarkable"
      );
    }
    await progress(tabId, 1);
    // NOTE leave progress around to see
    await sleep(500);
  } catch (ex) {
    console.error("problem creating epub", ex);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/repub_128.png",
      title: "Conversion to epub failed",
      message: `${ex}`,
    });
  } finally {
    await stop(tabId);
  }
}

// watch for clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void rePub(tab.id);
  }
});
