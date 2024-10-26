import { fromByteArray, toByteArray } from "base64-js";
import { brighten } from "./image";
import { generate } from "./lib";
import { Message, Response } from "./messages";
import { errString } from "./utils";

const MAX_CHUNK_SIZE = 50_000_000;

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(({ mhtml, ...opts }: Message) => {
    const bright = (buffer: Uint8Array, mime: string) =>
      brighten(buffer, mime, opts.imageBrightness, false);
    (async () => {
      const { epub, title } = await generate(toByteArray(mhtml), bright, opts);
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
    //
  });
});
