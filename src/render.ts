import { fromByteArray, toByteArray } from "base64-js";
import type { InitMessage, PartMessage, Response } from "./messages";
import type { EpubOptions } from "./options";

const MAX_CHUNK_SIZE = 50_000_000;
let ensuring: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  // share one in-flight check so concurrent renders don't both create; the
  // hasDocument guard also covers a document that outlived the service worker
  ensuring ??= (async () => {
    if (!(await chrome.offscreen.hasDocument())) {
      await chrome.offscreen.createDocument({
        url: "/offscreen.html",
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: "Parse DOM",
      });
    }
  })().finally(() => {
    ensuring = null;
  });
  await ensuring;
}

export async function render(
  mhtml: ArrayBuffer,
  opts: EpubOptions,
  title?: string,
  author?: string,
  summarize: boolean = true,
): Promise<{ epub: Uint8Array; title?: string }> {
  await ensureOffscreen();

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
    summarize,
  };

  const { parts, title: parsedTitle } = await new Promise<{
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
  return { epub: toByteArray(parts.join("")), title: parsedTitle };
}
