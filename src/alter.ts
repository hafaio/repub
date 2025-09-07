import { Readability } from "@mozilla/readability";
import leven from "leven";
import type { ImageMime } from "./epub";
import type { ImageHandling } from "./options";

/** a generic "file" */
export interface MimeData {
  readonly data: Uint8Array;
  readonly mime: string;
}

/** something that finds matches */
export type UrlMatcher = (
  iter: Iterable<string>,
) => [string, MimeData] | undefined;

/** only valid if matches exactly, relatively efficient */
export function exactMatch(assetData: Map<string, MimeData>): UrlMatcher {
  return (hrefs: Iterable<string>): [string, MimeData] | undefined => {
    for (const href of hrefs) {
      const data = assetData.get(href);
      if (data) {
        return [href, data];
      }
    }
  };
}

// eslint-disable-next-line spellcheck/spell-checker
/**
 * looks for close matches
 *
 * This currently scans all possible urls (slowly) and finds the one with the
 * smallest normalized edit distance in all of the queries.
 *
 * @remarks This currently does raw url matching instead of doing matching
 * based off of the semantics of the url, e.g. putting more emphasis on domain
 * over the rest of the url, or ignoring ordering of parameters. It's not clear
 * how much this advanced similarity is necessary.
 *
 * @param thresh - the normalized edit distance threshold. 0 indicates a
 * complete match (for which this function will be inefficient). 1 indicates
 * anything matches and so it will always select an image.
 */
// NOTE this seems only necessary due to this bug:
// https://bugs.chromium.org/p/chromium/issues/detail?id=1323522
export function closeMatch(
  assetData: Map<string, MimeData>,
  thresh: number,
): UrlMatcher {
  /* NOTE this could be better if we actually parsed the hrefs and looked at
   * differences there so that ordering of query parameters wouldn't affect it,
   * etc. */
  return (hrefs: Iterable<string>): [string, MimeData] | undefined => {
    let match: [string, MimeData] | undefined;
    let score = thresh;
    for (const href of hrefs) {
      for (const [test, val] of assetData) {
        const dist = leven(href, test) / Math.max(href.length, test.length);
        if (dist < score) {
          score = dist;
          match = [test, val];
        }
      }
    }
    return match;
  };
}

export interface Altered {
  altered: string;
  title: string;
  byline?: string;
  cover?: string | undefined;
  seen: Set<string>;
  images: [string, Uint8Array, ImageMime][];
}

function* parseSrcset(srcset: string): IterableIterator<string> {
  for (const field of srcset.split(",")) {
    const match = /\S+/.exec(field);
    if (!match) continue;
    const [href] = match;
    yield href;
  }
}

function* getSrcs(nodes: Iterable<Node>): IterableIterator<string> {
  for (const node of nodes) {
    if (node instanceof Element) {
      for (const { name, value } of node.attributes) {
        if (name === "src") {
          yield value;
        } else if (name === "srcset") {
          yield* parseSrcset(value);
        }
      }
    }
  }
}

interface WalkOptions {
  filterLinks: boolean;
  imageHandling: ImageHandling;
  convertTables: boolean;
  rotateTables: boolean;
  tableResolution: number;
  tableCss: string;
}

interface Options extends WalkOptions {
  summarizeCharThreshold: number;
  authorByline: boolean;
  filterIframes: boolean;
}

class Walker {
  readonly seen = new Set<string>();
  readonly svgs = new Map<string, string>();
  readonly pngs: [string, Uint8Array][] = [];

  constructor(
    private match: UrlMatcher,
    private options: WalkOptions,
  ) {}

  async *#walk(node: Node): AsyncIterableIterator<Node> {
    // istanbul ignore if
    if (node instanceof DocumentType) {
      // <!doctype ...> node should never actually find
      throw new Error("internal error: should never get a doctype element");
    } else if (node instanceof Text) {
      // preserve these these
      yield node;
    } else if (node instanceof HTMLAnchorElement && this.options.filterLinks) {
      // remove link leaving just children
      for (const child of node.childNodes) {
        yield* this.#walk(child);
      }
    } else if (node instanceof SVGElement) {
      /* remarkable can't seem to handle inline svgs, so we remap them to
       * "external" svgs */
      const serial = new XMLSerializer();
      const encoded = serial.serializeToString(node);
      const rep = `<?xml version="1.0" encoding="utf-8"?>${encoded}`;
      let url = this.svgs.get(rep);
      if (url === undefined) {
        // eslint-disable-next-line spellcheck/spell-checker
        url = `inlinesvg://${this.svgs.size}.svg`;
        this.svgs.set(rep, url);
      }
      const img = new Image();
      img.src = url;
      yield img;
    } else if (node instanceof HTMLTableElement && this.options.convertTables) {
      const div = document.createElement("div");
      document.body.appendChild(div);
      // we attach a shadow dom to prevent styles from affecting rendering
      const shadow = div.attachShadow({ mode: "closed" }); // ultimately make closed?

      const style = document.createElement("style");
      style.innerHTML = `
table {
  font-size: initial;
  font-family: sans-serif;
}
    
${this.options.tableCss}`;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      shadow.appendChild(svg);
      svg.appendChild(style);
      const fo = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "foreignObject",
      );
      fo.setAttribute("width", "100%");
      fo.setAttribute("height", "100%");
      svg.appendChild(fo);
      const xhtmldiv = document.createElement("div");
      fo.appendChild(xhtmldiv);
      xhtmldiv.appendChild(node);
      const { width, height } = node.getBoundingClientRect();
      document.body.removeChild(div);

      svg.setAttribute("width", width.toFixed());
      svg.setAttribute("height", height.toFixed());

      const serial = new XMLSerializer();
      const render = new Image();
      await new Promise((resolve) => {
        render.addEventListener("load", resolve);
        render.src = `data:image/svg+xml,${serial.serializeToString(svg)}`;
      });

      const canvasWidth = width * this.options.tableResolution;
      const canvasHeight = height * this.options.tableResolution;
      const rotate = this.options.rotateTables && width > height;
      const canvas = new OffscreenCanvas(
        rotate ? canvasHeight : canvasWidth,
        rotate ? canvasWidth : canvasHeight,
      );
      const ctx = canvas.getContext("2d")!;
      if (rotate) {
        ctx.translate(canvasHeight / 2, canvasWidth / 2);
        ctx.rotate(-Math.PI / 2);
      } else {
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
      }
      ctx.drawImage(
        render,
        -canvasWidth / 2,
        -canvasHeight / 2,
        canvasWidth,
        canvasHeight,
      );

      const blob = await canvas.convertToBlob({ type: "image/png" });
      const bytes = await blob.arrayBuffer();

      // eslint-disable-next-line spellcheck/spell-checker
      const url = `tableimage://${this.pngs.length}.png`;
      this.pngs.push([url, new Uint8Array(bytes)]);

      const img = new Image();
      img.src = url;
      yield img;
    } else if (node instanceof HTMLIFrameElement) {
      const match = this.match([node.src]);
      if (match) {
        const [, { data, mime }] = match;
        const decoder = new TextDecoder();
        const parser = new DOMParser();
        if (mime !== "text/html") throw new Error("unexpected mime");
        const contents = parser.parseFromString(decoder.decode(data), mime);
        for (const child of contents.body.childNodes) {
          yield* this.#walk(child);
        }
      }
    } else if (node instanceof HTMLImageElement) {
      // img element, find best src
      const { imageHandling } = this.options;
      const [href] = this.match(getSrcs([node])) ?? [];
      if (imageHandling === "strip") {
        // noop
      } else if (!href) {
        console.warn("no src match found for", node);
      } else if (imageHandling !== "filter" || !this.seen.has(href)) {
        node.src = href;
        this.seen.add(href);
        yield node;
      }
    } else if (node instanceof HTMLPictureElement) {
      // picture element, find best source and set pictures source
      const { imageHandling } = this.options;
      const [href] = this.match(getSrcs(node.childNodes)) ?? [];
      let img: HTMLImageElement | undefined;
      for (const child of node.childNodes) {
        if (child instanceof HTMLImageElement) {
          img = child;
          break;
        }
      }
      if (imageHandling === "strip") {
        // no op
      } else if (!href) {
        console.warn("no src match found for", node);
      } else if (!img) {
        console.warn("no img inside picture element", node);
      } else if (imageHandling !== "filter" || !this.seen.has(href)) {
        img.src = href;
        this.seen.add(href);
        yield img;
      }
    } else {
      // all others
      const newChildren = [];
      for (const child of node.childNodes) {
        for await (const walked of this.#walk(child)) {
          newChildren.push(walked);
        }
      }

      if (
        newChildren.length !== node.childNodes.length ||
        newChildren.some((child, i) => child !== node.childNodes[i])
      ) {
        let child: Node | null;
        while ((child = node.firstChild)) {
          node.removeChild(child);
        }
        for (const child of newChildren) {
          node.appendChild(child);
        }
      }

      yield node;
    }
  }

  async walk(node: Node): Promise<this> {
    for await (const _ of this.#walk(node)) {
      void _;
    }
    return this;
  }
}

function* coverUrls(doc: Document): IterableIterator<string> {
  const coverMeta = doc.querySelectorAll(
    `meta[property="og:image"], meta[property="og:image:url"], meta[property="twitter:image"]`,
  );
  for (const meta of coverMeta) {
    if (meta instanceof HTMLMetaElement) {
      yield meta.content;
    }
  }
}

/** update img src's with srcset information */
export async function alter(
  doc: Document,
  match: UrlMatcher,
  { summarizeCharThreshold, authorByline, filterIframes, ...opts }: Options,
  summarize: boolean = true,
): Promise<Altered> {
  const [cover] = match(coverUrls(doc)) ?? [];
  const allowedVideoRegex = filterIframes ? /(?!)/ : /(?:)/;
  const articleAuthor = doc.querySelector(`meta[property="article:author"]`);
  const author =
    authorByline && articleAuthor instanceof HTMLMetaElement
      ? articleAuthor.content
      : null;

  const res = summarize
    ? new Readability<Node>(doc, {
        charThreshold: summarizeCharThreshold,
        allowedVideoRegex,
        serializer: (v: Node) => v,
      }).parse()
    : { content: doc.body, title: undefined, byline: undefined };
  if (!res) {
    throw new Error("failed to summarize document");
  }
  const { content, title, byline } = res;
  if (content == null) {
    throw new Error("failed to summarize document content");
  }
  const { seen, svgs, pngs } = await new Walker(match, opts).walk(content);
  const images: [string, Uint8Array, ImageMime][] = [];
  const enc = new TextEncoder();
  for (const [data, url] of svgs) {
    images.push([url, enc.encode(data), "image/svg+xml"]);
  }
  for (const [url, data] of pngs) {
    images.push([url, data, "image/png"]);
  }

  const serial = new XMLSerializer();
  return {
    altered: serial.serializeToString(content),
    title: title ?? "unknown title",
    byline:
      author && byline && author !== byline
        ? `${author}. ${byline}`
        : (author ?? byline ?? undefined),
    cover,
    seen,
    images,
  };
}
