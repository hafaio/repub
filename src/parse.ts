import { parseMhtml } from "mhtml-stream/dist";
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

// eslint-disable-next-line @typescript-eslint/require-await
async function* asIterable(
  data: ArrayBuffer,
): AsyncIterableIterator<ArrayBuffer> {
  yield data;
}

export async function parse(data: ArrayBuffer): Promise<ParsedWebpage> {
  // init
  const files = parseMhtml(asIterable(data));

  const first = await files.next();
  assert(!first.done, "no header file in mhtml");
  const title = first.value.headers.get("Subject") ?? undefined;
  const locate = first.value.headers.get("Snapshot-Content-Location");
  assert(locate !== null, "no location url in html");
  const second = await files.next();
  assert(!second.done, "no content file in mhtml");
  assert(
    second.value.headers.get("Content-Location") === locate,
    "content file location didn't match header location",
  );
  assert(
    second.value.headers.get("Content-Type") === "text/html",
    "content file wasn't an html file",
  );

  const domString = decoder.decode(second.value.content);

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
