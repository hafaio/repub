import { parseMhtml } from "mhtml-stream/dist";
import { assert } from "./utils";

export interface Asset {
  readonly href: string;
  readonly content: Uint8Array;
  readonly contentType: string;
  readonly contentId: string | null;
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
  data: Uint8Array,
): AsyncIterableIterator<Uint8Array> {
  yield data;
}

export async function parse(data: Uint8Array): Promise<ParsedWebpage> {
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
  
  // Check Content-Type more flexibly to allow charset parameter
  const contentType = second.value.headers.get("Content-Type");
  assert(
    contentType?.startsWith("text/html"),
    "content file wasn't an html file",
  );

  const domString = decoder.decode(second.value.content);

  async function* getAssets(): AsyncIterableIterator<Asset> {
    for await (const { headers, content } of files) {
      const href = headers.get("Content-Location");
      const contentType = headers.get("Content-Type");
      const contentId = headers.get("Content-ID");
      if (href && contentType) {
        yield {
          href,
          content,
          contentType,
          contentId,
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
