import { fromByteArray, toByteArray } from "base64-js";
import { InitMessage, PartMessage, Response } from "./messages";
import { EpubOptions } from "./options";

const MAX_CHUNK_SIZE = 50_000_000;
let num = 0;
let offscreen: null | Promise<void> = null;
let closing: null | Promise<void> = null;

export async function render(
  mhtml: ArrayBuffer,
  opts: EpubOptions,
  title?: string,
  author?: string,
): Promise<{ epub: Uint8Array; title?: string }> {
  await closing;
  num++;
  offscreen ??= chrome.offscreen.createDocument({
    url: "/offscreen.html",
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: "Parse DOM",
  });
  await offscreen;

  // chunk encoded in case it's too large
  const encoded = fromByteArray(new Uint8Array(mhtml));
  const chunks: string[] = [];
  for (let start = 0; start < encoded.length; start += MAX_CHUNK_SIZE) {
    chunks.push(encoded.slice(start, start + MAX_CHUNK_SIZE));
  }
  const initMessage: InitMessage = {
    type: "info",
    numParts: chunks.length,
    options: opts,
    title,
    author,
  };

  try {
    const { parts, title } = await new Promise<{
      parts: string[];
      title?: string;
    }>((resolve, reject) => {
      const parts: string[] = [];
      let receivedParts = 0;
      let expectedParts: number | undefined;
      let title: string | undefined;

      const port = chrome.runtime.connect();
      port.onDisconnect.addListener(() => {
        reject(Error("port disconnected early"));
      });
      port.onMessage.addListener((message: Response) => {
        if (message.type === "part") {
          parts[message.index] = message.part;
          receivedParts++;
        } else if (message.type === "info") {
          expectedParts = message.numParts;
          title = message.title;
        } else {
          reject(Error(message.err));
        }
        if (expectedParts === receivedParts) {
          resolve({ parts, title });
        }
      });

      // post all parts
      port.postMessage(initMessage);
      for (const [index, part] of chunks.entries()) {
        const partMessage: PartMessage = {
          type: "part",
          index,
          part,
        };
        port.postMessage(partMessage);
      }
    });
    return { epub: toByteArray(parts.join("")), title };
  } finally {
    num--;
    if (num === 0) {
      offscreen = null;
      await (closing = chrome.offscreen.closeDocument());
      closing = null;
    }
  }
}
