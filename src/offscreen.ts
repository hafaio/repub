import { brighten } from "./image";
import { generate } from "./lib";
import { Message, Response } from "./messages";
import { errString } from "./utils";
import { fromByteArray, toByteArray } from "base64-js";

browser.runtime.onMessage.addListener(
  (
    message: Message,
    _sender,
    sendResponse: (response: Response) => void,
  ): true => {
    const bright = (buffer: Uint8Array, mime: string) =>
      brighten(buffer, mime, message.imageBrightness, false);
    
    generate(toByteArray(message.mhtml), bright, message).then(
      ({ epub, title }) => {
        sendResponse({ success: true, epub: fromByteArray(epub), title });
      },
      (ex: unknown) => {
        sendResponse({
          success: false,
          err: errString(ex),
        });
      },
    );
    return true;
  },
);
