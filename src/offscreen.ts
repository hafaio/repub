import { fromByteArray, toByteArray } from "base64-js";
import { brighten } from "./image";
import { generate } from "./lib";
import type { Message, Response } from "./messages";
import type { EpubOptions } from "./options";
import { errString } from "./utils";

const MAX_CHUNK_SIZE = 50_000_000;

chrome.runtime.onConnect.addListener((port) => {
  const parts: string[] = [];
  let receivedParts = 0;
  let expectedParts: number | undefined;
  let options: EpubOptions | undefined;
  let initTitle: string | undefined;
  let initAuthor: string | undefined;
  let summarize: boolean | undefined;

  port.onMessage.addListener((message: Message) => {
    if (message.type === "part") {
      parts[message.index] = message.part;
      receivedParts++;
    } else {
      expectedParts = message.numParts;
      options = message.options;
      initTitle = message.title;
      initAuthor = message.author;
      summarize = message.summarize;
    }
    if (
      expectedParts === receivedParts &&
      options !== undefined &&
      summarize !== undefined
    ) {
      const opts = options;
      const mhtml = parts.join("");
      const bright = (buffer: Uint8Array, mime: string) =>
        brighten(buffer, mime, opts.imageBrightness, false, opts.imageShrink);
      (async () => {
        const { epub, title } = await generate(
          toByteArray(mhtml),
          bright,
          opts,
          summarize,
          initTitle,
          initAuthor,
        );
        const encoded = fromByteArray(epub);

        // chunk response to fit in message size
        const chunks: string[] = [];
        for (let start = 0; start < encoded.length; start += MAX_CHUNK_SIZE) {
          chunks.push(encoded.slice(start, start + MAX_CHUNK_SIZE));
        }

        // send info
        const info: Response = {
          type: "info",
          numParts: chunks.length,
          title,
        };
        port.postMessage(info);

        // send parts
        for (const [index, part] of chunks.entries()) {
          const msg: Response = { type: "part", index, part };
          port.postMessage(msg);
        }
      })()
        .catch((ex: unknown) => {
          const resp: Response = {
            type: "error",
            err: errString(ex),
          };
          port.postMessage(resp);
        })
        .finally(() => {
          port.disconnect();
        });
    }
  });
});
