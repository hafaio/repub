import { fromByteArray, toByteArray } from "base64-js";
import { Message, Response } from "./messages";
import { EpubOptions } from "./options";

let num = 0;
let offscreen: null | Promise<void> = null;
let closing: null | Promise<void> = null;

export async function render(
  mhtml: ArrayBuffer,
  opts: EpubOptions,
): Promise<{ epub: ArrayBuffer; title?: string }> {
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

  try {
    const msg: Message = {
      mhtml: fromByteArray(new Uint8Array(mhtml)),
      ...opts,
    };
    const resp: Response = await chrome.runtime.sendMessage(msg);
    if (resp.success) {
      const { epub, title } = resp;
      return { epub: toByteArray(epub), title };
    } else {
      throw new Error(resp.err);
    }
  } finally {
    num--;
    if (num === 0) {
      offscreen = null;
      await (closing = chrome.offscreen.closeDocument());
      closing = null;
    }
  }
}
