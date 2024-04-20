import { Readability } from "@mozilla/readability";
import leven from "leven";
import { ImageHandling } from "./options";

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
  authorByline: boolean;
  filterIframes: boolean;
}

class Walker {
  readonly seen = new Set<string>();
  readonly svgs = new Map<string, string>();

  constructor(
    private match: UrlMatcher,
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
      /* remarkable can't seem to handle inline svgs, so we remap them to
       * "external" svgs */
      const serial = new XMLSerializer();
      const rep = `<?xml version="1.0" encoding="utf-8"?>${serial.serializeToString(
        node,
      )}`;
      let url = this.svgs.get(rep);
      if (url === undefined) {
        // eslint-disable-next-line spellcheck/spell-checker
        url = `inlinesvg://${this.svgs.size}.svg`;
        this.svgs.set(rep, url);
      }
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
  match: UrlMatcher,
  { summarizeCharThreshold, authorByline, filterIframes, ...opts }: Options,
): Altered {
  const [cover] = match(coverUrls(doc)) ?? [];
  const allowedVideoRegex = filterIframes ? /(?!)/ : /(?:)/;
  const articleAuthor = doc.querySelector(`meta[property="article:author"]`);
  const author =
    authorByline && articleAuthor instanceof HTMLMetaElement
      ? articleAuthor.content
      : null;

  const res = new Readability<Node>(doc, {
    charThreshold: summarizeCharThreshold,
    allowedVideoRegex,
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
    byline: author ?? byline,
    cover,
    seen,
    svgs,
  };
}
