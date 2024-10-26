import { fromByteArray, toByteArray } from "base64-js";
import { Message, Response } from "./messages";
import { EpubOptions } from "./options";

let num = 0;
let offscreen: null | Promise<void> = null;
let closing: null | Promise<void> = null;

export async function render(
  mhtml: ArrayBuffer,
  opts: EpubOptions,
): Promise<{ epub: Uint8Array; title?: string }> {
  await closing;
  num++;
  if (offscreen === null) {
    offscreen = chrome.offscreen.createDocument({
      url: "/offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Parse DOM",
    });
  }
  await offscreen;
  const msg: Message = {
    mhtml: fromByteArray(new Uint8Array(mhtml)),
    ...opts,
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
          console.log(message.index);
          if (expectedParts === receivedParts) {
            resolve({ parts, title });
          }
        } else if (message.type === "info") {
          expectedParts = message.numParts;
          title = message.title;
          if (expectedParts === receivedParts) {
            resolve({ parts, title });
          }
        } else {
          reject(Error(message.err));
        }
      });
      port.postMessage(msg);
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
