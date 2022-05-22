// eslint no-console: off
import { fromByteArray } from "base64-js";
import { alter } from "./alter";
import { convert } from "./convert";
import { createConverter } from "./converter";
import { epub } from "./epub";
import { getOptions, ImageHandling } from "./options";
import { Asset, parseMhtmlStream } from "./parse";
import { Progress, progress } from "./progress";
import { upload } from "./upload";
import { safeFilename, sleep } from "./utils";

async function fetchEpub({
  prog,
  tabId,
  summarizeCharThreshold,
  imageHandling,
  imageBrightness,
  filterLinks,
  css,
  hrefHeader,
}: {
  prog: Progress;
  tabId: number;
  summarizeCharThreshold: number;
  imageHandling: ImageHandling;
  imageBrightness: number;
  filterLinks: boolean;
  css: string | undefined;
  hrefHeader: boolean;
}): Promise<{ buffer: Uint8Array; title: string }> {
  await prog.progress(0.1);

  // capture page
  // NOTE due to a bug in chromium this is less than ideal:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1323522
  const blob = await new Promise<Blob>((resolve) =>
    // @ts-expect-error typing says ArrayBuffer, but actually blob
    chrome.pageCapture.saveAsMHTML({ tabId }, resolve)
  );
  await prog.progress(0.2);

  // parse components out of mhtml
  // @ts-expect-error typescript is confused because of leaked node types, and there's no way around it
  const stream: ReadableStream<ArrayBuffer> = blob.stream();
  const { content, href, title, assets } = await parseMhtmlStream(stream);
  await prog.progress(0.3);

  // get all images
  const imageMap = new Map<string, Asset>();
  for await (const asset of assets) {
    const { href, contentType } = asset;
    if (contentType.startsWith("image/")) {
      imageMap.set(href, asset);
    }
  }
  await prog.progress(0.4);

  // alter page by parsing out images
  const {
    altered,
    title: parsedTitle,
    byline,
    seen,
  } = await alter(content, imageMap, {
    imageHandling,
    filterLinks,
    summarizeCharThreshold,
  });
  const images = [...seen].map((href) => imageMap.get(href)!);
  await prog.progress(0.5);

  // convert epub unfriendly images
  const converted = await convert(
    images,
    createConverter({ brightness: imageBrightness })
  );
  await prog.progress(0.6);

  // convert to an epub
  const finalTitle = parsedTitle ?? title;
  const buffer = await epub({
    title: finalTitle,
    content: altered,
    author: byline,
    images: converted,
    css,
    href: hrefHeader ? href : undefined,
    missingImage: imageHandling === "keep" ? "ignore" : "remove",
  });

  await prog.progress(0.8);
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
  const prog = progress(tabId);
  try {
    await prog.start();

    const {
      deviceToken,
      outputStyle,
      summarizeCharThreshold,
      imageHandling,
      imageBrightness,
      hrefHeader,
      rmCss,
      filterLinks,
      ...rmOptions
    } = await getOptions();

    const epubPromise = fetchEpub({
      prog,
      tabId,
      summarizeCharThreshold,
      imageHandling,
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
    await prog.progress(1);
    // NOTE leave progress around to see
    await sleep(200);
  } catch (ex) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/repub_128.png",
      title: "Conversion to epub failed",
      message: `${ex}`,
    });
  } finally {
    await prog.stop();
  }
}

// watch for clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void rePub(tab.id);
  }
});
