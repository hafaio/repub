import { fromByteArray, toByteArray } from "base64-js";
import { brighten } from "./image";
import { generate } from "./lib";
import { Message, Response } from "./messages";
import { errString } from "./utils";

chrome.runtime.onMessage.addListener(
  (
    { mhtml, ...opts }: Message,
    _: unknown,
    sendResponse: (msg: Response) => void,
  ): true => {
    const bright = (buffer: Uint8Array, mime: string) =>
      brighten(buffer, mime, opts.imageBrightness, false);
    generate(toByteArray(mhtml), bright, opts).then(
      ({ epub, title }) =>
        sendResponse({ success: true, epub: fromByteArray(epub), title }),
      (ex) =>
        sendResponse({
          success: false,
          err: errString(ex),
        }),
    );
    return true;
  },
);
