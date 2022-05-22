/**
 * A script to help dbug websites
 *
 * This takes an mhtml file as input, and pull out the summarized version, as well as the found an unfound images to help understand why images are included or not.
 *
 * @packageDocumentation
 */
/* eslint no-console: off */
import { readFile } from "node:fs/promises";
import { argv } from "node:process";
import { ReadableStream } from "node:stream/web";
import { alter } from "./alter";
import { Asset, parseMhtmlStream } from "./parse";

const [, , mhtml] = argv;
if (!mhtml) {
  console.error("first argument must be an mhtml file to debug");
} else {
  const buff = await readFile(mhtml);
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(buff);
      controller.close();
    },
  });
  const { content, assets } = await parseMhtmlStream(stream);
  const imageMap = new Map<string, Asset>();
  for await (const asset of assets) {
    const { href, contentType } = asset;
    if (contentType.startsWith("image/")) {
      imageMap.set(href, asset);
    }
  }
  const checked = new Set<string>();
  const { seen } = await alter(
    content,
    {
      has: (href: string): boolean => checked.add(href) && imageMap.has(href),
    },
    {
      summarizeCharThreshold: 0,
      filterLinks: false,
      imageHandling: "keep",
    }
  );
  console.log("mhtml images", [...imageMap.keys()]);
  console.log("checked images", [...checked]);
  console.log("matched images", [...seen]);
}
