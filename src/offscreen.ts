import { fromByteArray, toByteArray } from "base64-js";
import { generate } from "./lib";
import { Message, Response } from "./messages";
import { errString } from "./utils";

chrome.runtime.onMessage.addListener(
  (
    { mhtml, ...opts }: Message,
    _: unknown,
    sendResponse: (msg: Response) => void,
  ): true => {
    generate(toByteArray(mhtml), opts).then(
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
