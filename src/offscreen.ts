import { fromByteArray, toByteArray } from "base64-js";
import { default as init, render as rend } from "../pkg/repub_bind";
import { Message, Response } from "./messages";
import { getOptions } from "./options";
import { errString } from "./utils";

const ini = (async () => await init())();

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

export async function render(
  mhtml: Uint8Array
): Promise<{ epub: Uint8Array; title?: string }> {
  const [
    {
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      filterLinks,
      rmCss,
      hrefHeader,
      bylineHeader,
      coverHeader,
    },
  ] = await Promise.all([getOptions(), ini]);

  let res;
  try {
    const { epub, title } = (res = rend(
      mhtml,
      imageHandling,
      imageHrefSimilarityThreshold,
      imageBrightness,
      filterLinks,
      rmCss ? remarkableCss : "",
      hrefHeader,
      bylineHeader,
      coverHeader
    ));
    return { epub, title };
  } finally {
    res?.free();
  }
}

chrome.runtime.onMessage.addListener(
  (msg: Message, _: unknown, sendResponse: (msg: Response) => void): true => {
    render(toByteArray(msg)).then(
      ({ epub, title }) =>
        sendResponse({ success: true, epub: fromByteArray(epub), title }),
      (ex) =>
        sendResponse({
          success: false,
          err: errString(ex),
        })
    );
    return true;
  }
);
