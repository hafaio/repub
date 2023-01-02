import { MhtmlFile, parseMhtml } from "mhtml-stream";
import { assert } from "./utils";

export interface Asset {
  readonly href: string;
  readonly content: Uint8Array;
  readonly contentType: string;
}

const decoder = new TextDecoder();

export interface ParsedWebpage {
  readonly href: string;
  readonly title?: string;
  readonly content: string;
  readonly assets: AsyncIterableIterator<Asset>;
}

async function* asIterable(
  stream: ReadableStream<ArrayBuffer>
): AsyncIterableIterator<ArrayBuffer> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function parseMhtmlStream(
  stream: ReadableStream<ArrayBuffer>
): Promise<ParsedWebpage> {
  // init
  const files = parseMhtml(asIterable(stream))[Symbol.asyncIterator]();
  let done: boolean | undefined, value: MhtmlFile;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ({ done, value } = await files.next());
  assert(!done, "no header file in mhtml");
  const title = value.headers.get("Subject") || undefined;
  const locate = value.headers.get("Snapshot-Content-Location");
  assert(locate !== null, "no location url in html");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ({ done, value } = await files.next());
  assert(!done, "no content file in mhtml");
  assert(
    value.headers.get("Content-Location") === locate,
    "content file location didn't match header location"
  );
  assert(
    value.headers.get("Content-Type") === "text/html",
    "content file wasn't an html file"
  );

  const domString = decoder.decode(value.content);

  async function* getAssets(): AsyncIterableIterator<Asset> {
    for await (const { headers, content } of files) {
      const href = headers.get("Content-Location");
      const contentType = headers.get("Content-Type");
      if (href && contentType) {
        yield {
          href,
          content,
          contentType,
        };
      }
    }
  }

  return {
    href: locate,
    title,
    content: domString,
    assets: getAssets(),
  };
}
