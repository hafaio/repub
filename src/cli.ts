import { JSDOM } from "jsdom";
import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";
import yargs from "yargs";
import { generate } from "./lib";
import { defaultOptions } from "./options";

// patch global with dom
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.HTMLMetaElement = dom.window.HTMLMetaElement;
global.DocumentType = dom.window.DocumentType;
global.Text = dom.window.Text;
global.HTMLAnchorElement = dom.window.HTMLAnchorElement;
global.HTMLImageElement = dom.window.HTMLImageElement;
global.HTMLPictureElement = dom.window.HTMLPictureElement;
global.Element = dom.window.Element;

void (async () => {
  const args = await yargs(argv.slice(2))
    .scriptName("repub")
    .usage(
      "$0 <mhtml>",
      "execute repub locally, with extra logging and alternate output",
    )
    .positional("mhtml", {
      describe: "the mhtml file to parse",
      type: "string",
    })
    .option("epub-output", {
      alias: "o",
      describe: "where to save the final epub",
      type: "string",
    })
    .option("img-sim-thresh", {
      describe: "how similar image urls need to be to use them",
      type: "number",
      default: defaultOptions.imageHrefSimilarityThreshold,
    })
    .option("img-brightness", {
      describe: "how much to brighten images",
      type: "number",
      default: defaultOptions.imageBrightness,
    })
    .option("image-handling", {
      describe: "how to handle images",
      type: "string",
      default: defaultOptions.imageHandling,
      choices: ["strip", "filter", "keep"] as const,
    })
    .option("filter-links", {
      describe: "filter links from generated results",
      type: "boolean",
      default: defaultOptions.filterLinks,
    })
    .option("rm-css", {
      describe: "use remarkable css",
      type: "boolean",
      default: defaultOptions.rmCss,
    })
    .option("href-header", {
      describe: "add a header with the url",
      type: "boolean",
      default: defaultOptions.hrefHeader,
    })
    .option("byline-header", {
      describe: "add a header with the byline",
      type: "boolean",
      default: defaultOptions.bylineHeader,
    })
    .option("cover-header", {
      describe: "add a header with the cover image",
      type: "boolean",
      default: defaultOptions.coverHeader,
    })
    .option("verbose", {
      alias: "v",
      describe: "verbosity to log information",
      count: true,
    })
    .help()
    .alias("h", "help")
    .required("mhtml")
    .strict().argv;

  const mhtml = await readFile(args.mhtml);

  const { epub, title } = await generate(mhtml, {
    imageHrefSimilarityThreshold: args.imgSimThresh,
    imageBrightness: args.imgBrightness,
    imageHandling: args.imageHandling,
    filterLinks: args.filterLinks,
    rmCss: args.rmCss,
    hrefHeader: args.hrefHeader,
    bylineHeader: args.bylineHeader,
    coverHeader: args.coverHeader,
  });

  if (args.verbose > 0) {
    console.info("title:", title);
  }
  if (args.epubOutput) {
    await writeFile(args.epubOutput, epub);
  }
})();
