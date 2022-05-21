import { fromByteArray } from "base64-js";
import { remarkable, RequestInitLike, ResponseLike } from "rmapi-js/dist";
import { alter } from "./alter";
import { convert } from "./convert";
import { createConverter } from "./converter";
import { epub } from "./epub";
import { getOptions, ImageHandling } from "./options";
import { parseMhtmlStream } from "./parse";
import { Progress, progress } from "./progress";
import { readability } from "./readability";
import { safeFilename, sleep } from "./utils";

/**
 * web workers don't like calling fetch bound to global scope, so we need to
 * wrap the call
 */
async function wrapper(
  url: string,
  init?: RequestInitLike
): Promise<ResponseLike> {
  return await fetch(url, init);
}

async function fetchEpub({
  prog,
  tabId,
  summarizeCharThreshold,
  imageHandling,
  filterLinks,
  css,
  hrefHeader,
}: {
  prog: Progress;
  tabId: number;
  summarizeCharThreshold: number;
  imageHandling: ImageHandling;
  filterLinks: boolean;
  css: string | undefined;
  hrefHeader: boolean;
}): Promise<{ buffer: Uint8Array; title: string }> {
  await prog.progress(0.1);

  // capture page
  // NOTE due to a bug in chromium we use a content script to extract the
  // summarized html, and saveAsMHTML to extract all the resources. This
  // isn't too bad since we need to run readability in a content script
  // anyway, but its still not ideal. This does present a race condition
  // though, which isn't great...
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1323522
  const [blob, { content, title: parsedTitle, byline }] = await Promise.all([
    new Promise<Blob>((resolve) =>
      // @ts-expect-error typing says ArrayBuffer, but actually blob
      chrome.pageCapture.saveAsMHTML({ tabId }, resolve)
    ),
    readability(tabId, { charThreshold: summarizeCharThreshold }),
  ]);
  await prog.progress(0.2);

  // parse components out of mhtml
  // @ts-expect-error typescript is confused because of leaked node types, and there's no way around it
  const stream: ReadableStream<ArrayBuffer> = blob.stream();
  const { href, title, assets } = await parseMhtmlStream(stream);
  await prog.progress(0.3);

  // alter page by parsing out images
  const { altered, images } = await alter(content, assets, {
    imageHandling,
    filterLinks,
  });
  await prog.progress(0.4);

  // convert epub unfriendly images
  const converted = await convert(images, createConverter());
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
      const [{ buffer, title }, api] = await Promise.all([
        epubPromise,
        remarkable(deviceToken, { fetch: wrapper }),
      ]);
      await api.putEpub(title, buffer, rmOptions);
    } else {
      await chrome.runtime.openOptionsPage();
      throw new Error(
        "must be authenticated to upload documents to reMarkable"
      );
    }
    await prog.progress(1);
    // NOTE leave progress around to see
    await sleep(100);
  } catch (ex) {
    console.error(ex);
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
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) {
    console.error("tab had no id");
  } else {
    void rePub(tab.id);
  }
});
