import { Readability } from "@mozilla/readability";
import leven from "leven";
import { ImageHandling } from "./options";

/** something that has a `has` method */
export interface HasAble<T> {
  has(val: T): boolean;
}

/** something that has keys */
export interface Keys<T> {
  keys(): Iterable<T>;
}

/** something that finds matches */
export interface Matcher<T> {
  (iter: Iterable<T>): T | undefined;
}

/** only valid if matches exactly, relatively efficient */
export function exactMatch(images: HasAble<string>): Matcher<string> {
  return (hrefs: Iterable<string>): string | undefined => {
    for (const href of hrefs) {
      if (images.has(href)) {
        return href;
      }
    }
  };
}

/**
 * looks for close matches
 *
 * This currently scans all possible urls (slowly) and finds the one with the
 * smallest normalized edit distance in all of the queries.
 *
 * @remarks This currently does raw url matching instead of doing matching
 * based off of the semantics of the url, e.g. putting more emphesis on domain
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
  images: Keys<string>,
  thresh: number,
): Matcher<string> {
  // NOTE this could be better if we actually parsed the hrefs and looked at
  // differences there so that ordering of query parameters wouldn't affect it,
  // etc.
  return (hrefs: Iterable<string>): string | undefined => {
    let match: string | undefined = undefined;
    let score = thresh;
    for (const href of hrefs) {
      for (const test of images.keys()) {
        const dist = leven(href, test) / Math.max(href.length, test.length);
        if (dist < score) {
          score = dist;
          match = test;
        }
      }
    }
    return match;
  };
}

export interface Altered {
  altered: string;
  title: string;
  byline: string;
  cover?: string | undefined;
  seen: Set<string>;
  svgs: Map<string, string>;
}

function* parseSrcset(srcset: string): IterableIterator<string> {
  for (const field of srcset.split(",")) {
    const match = field.match(/\S+/);
    if (!match) continue;
    const [href] = match;
    yield decodeURIComponent(href);
  }
}

function* getSrcs(nodes: Iterable<Node>): IterableIterator<string> {
  for (const node of nodes) {
    if (node instanceof Element) {
      for (const { name, value } of node.attributes) {
        if (name === "src") {
          yield decodeURIComponent(value);
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
}

interface Options extends WalkOptions {
  summarizeCharThreshold: number;
}

class Walker {
  readonly seen = new Set<string>();
  readonly svgs = new Map<string, string>();

  constructor(
    private match: Matcher<string>,
    private options: WalkOptions,
  ) {}

  *#walk(node: Node): IterableIterator<Node> {
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
      // remarkable can't seem to handle inline svgs, so we remap them to
      // "external" svgs
      const serial = new XMLSerializer();
      const rep = `<?xml version="1.0" encoding="utf-8"?>${serial.serializeToString(
        node,
      )}`;
      let url = this.svgs.get(rep);
      if (url === undefined) {
        url = `inlinesvg://${this.svgs.size}.svg`;
        this.svgs.set(rep, url);
      }
      const img = new Image();
      img.src = url;
      yield img;
    } else if (node instanceof HTMLImageElement) {
      // img element, find best src
      const { imageHandling } = this.options;
      const href = this.match(getSrcs([node]));
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
      const href = this.match(getSrcs(node.childNodes));
      let img;
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
        newChildren.push(...this.#walk(child));
      }

      if (
        newChildren.length !== node.childNodes.length ||
        newChildren.some((child, i) => child !== node.childNodes[i])
      ) {
        let child;
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

  walk(node: Node): this {
    for (const _ of this.#walk(node)) {
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
export function alter(
  doc: Document,
  match: Matcher<string>,
  { summarizeCharThreshold, ...opts }: Options,
): Altered {
  const cover = match(coverUrls(doc));

  const res = new Readability<Node>(doc, {
    charThreshold: summarizeCharThreshold,
    allowedVideoRegex: /(?!)/, // nothing matches
    serializer: (v: Node) => v,
  }).parse();
  if (!res) {
    throw new Error("failed to summarize document");
  }
  const { content, title, byline } = res;
  const { seen, svgs } = new Walker(match, opts).walk(content);

  const serial = new XMLSerializer();
  return {
    altered: serial.serializeToString(content),
    title,
    byline,
    cover,
    seen,
    svgs,
  };
}
