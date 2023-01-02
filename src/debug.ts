/**
 * A script to help dbug websites
 *
 * This takes an mhtml file as input, and pull out the summarized version, as well as the found an unfound images to help understand why images are included or not.
 *
 * @packageDocumentation
 */
import { readFile } from "node:fs/promises";
import { argv } from "node:process";
import { ReadableStream } from "node:stream/web";
import { alter, Matcher } from "./alter";
import { parseMhtmlStream } from "./parse";
import { levenshtein } from "./utils";

const [, , mhtml] = argv;
if (!mhtml) {
  console.error("first argument must be an mhtml file to debug");
} else {
  const buff = await readFile(mhtml);
  const stream = new ReadableStream<ArrayBuffer>({
    start(controller) {
      controller.enqueue(buff);
      controller.close();
    },
  });
  // @ts-expect-error some weird incompatability between node and chrome types
  const { content, assets } = await parseMhtmlStream(stream);
  const images = new Set<string>();
  for await (const { href, contentType } of assets) {
    if (contentType.startsWith("image/")) {
      images.add(href);
    }
  }

  console.log("All Images");
  console.log("==========");
  for (const href of images) {
    console.log(">", href);
  }
  console.log();

  const matcher: Matcher<string> = (
    hrefs: Iterable<string>
  ): string | undefined => {
    console.log("Beginning Match");
    console.log("---------------");
    let match: string | undefined = undefined;
    let score = 1;
    for (const href of hrefs) {
      let innerMatch: string | undefined = undefined;
      let innerScore = 1;
      for (const test of images) {
        const dist =
          levenshtein(href, test) / Math.max(href.length, test.length);
        if (dist < innerScore) {
          innerScore = dist;
          innerMatch = test;
        }
      }
      console.log(
        "> Best match for",
        href,
        "was",
        innerMatch,
        "with score",
        innerScore
      );
      if (innerScore < score) {
        score = innerScore;
        match = innerMatch;
      }
    }
    console.log(">>> selected", match, "with score", score);
    console.log();
    return match;
  };

  const { seen } = alter(content, matcher, {
    summarizeCharThreshold: 0,
    filterLinks: false,
    imageHandling: "keep",
  });

  console.log("Final Images");
  console.log("============");
  for (const href of seen) {
    console.log(">", href);
  }
  console.log();
}
