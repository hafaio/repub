import { Readability } from "@mozilla/readability";
import { parse } from "parse5";
import {
  ChildNode as RTChildNode,
  Element as RTElement,
  NodeType,
  treeAdapter,
} from "read-tree";
import { ImageHandling } from "./options";
import { levenshtein } from "./utils";

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
  thresh: number
): Matcher<string> {
  // NOTE this could be better if we actually parsed the hrefs and looked at
  // differences there so that ordering of query parameters wouldn't affect it,
  // etc.
  return (hrefs: Iterable<string>): string | undefined => {
    let match: string | undefined = undefined;
    let score = thresh;
    for (const href of hrefs) {
      for (const test of images.keys()) {
        const dist =
          levenshtein(href, test) / Math.max(href.length, test.length);
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
  seen: Set<string>;
}

function* parseSrcset(srcset: string): IterableIterator<string> {
  for (const field of srcset.split(",")) {
    const match = field.match(/\S+/);
    if (!match) continue;
    const [href] = match;
    yield decodeURIComponent(href!);
  }
}

function* getSrcs(nodes: Iterable<RTChildNode>): IterableIterator<string> {
  for (const node of nodes) {
    if (node.nodeType === NodeType.Element) {
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

function isImg(node: RTChildNode): node is RTElement {
  return node.nodeType === NodeType.Element && node.tagName === "IMG";
}

interface WalkOptions {
  filterLinks: boolean;
  imageHandling: ImageHandling;
}

interface Options extends WalkOptions {
  summarizeCharThreshold: number;
}

function walk(
  node: RTChildNode,
  match: Matcher<string>,
  seen: Set<string>,
  options: WalkOptions
): RTChildNode[] {
  // istanbul ignore if
  if (node.nodeType === NodeType.DocumentType) {
    // <!doctype ...> node should never actually find
    throw new Error("internal error: should never get a doctype element");
  } else if (
    node.nodeType === NodeType.Comment ||
    node.nodeType === NodeType.Text
  ) {
    // preserve these these
    return [node];
  } else if (node.tagName === "A" && options.filterLinks) {
    // remove link leaving just children
    return node.childNodes;
  } else if (node.tagName === "IMG") {
    // img element, find best src
    const { imageHandling } = options;
    const href = match(getSrcs([node]));
    if (imageHandling === "strip") {
      return [];
    } else if (!href) {
      console.warn("no src match found for", node);
      return [];
    } else if (imageHandling === "filter" && seen.has(href)) {
      return [];
    } else {
      node.src = href;
      seen.add(href);
      return [node];
    }
  } else if (node.tagName === "PICTURE") {
    // picture element, find best source and set pictures source
    const { imageHandling } = options;
    const href = match(getSrcs(node.childNodes));
    const [img] = node.childNodes.filter(isImg);
    if (imageHandling === "strip") {
      return [];
    } else if (!href) {
      console.warn("no src match found for", node);
      return [];
    } else if (!img) {
      console.warn("no img inside picture element", node);
      return [];
    } else if (imageHandling === "filter" && seen.has(href)) {
      return [];
    } else {
      img.src = encodeURI(href);
      seen.add(href);
      return [img];
    }
  } else {
    // all others
    node.childNodes = node.childNodes.flatMap((child) =>
      walk(child, match, seen, options)
    );
    return [node];
  }
}

/** update img src's with srcset information */
export async function alter(
  raw: string,
  match: Matcher<string>,
  { summarizeCharThreshold, ...opts }: Options
): Promise<Altered> {
  // all seen hrefs
  const doc = parse(raw, { treeAdapter });
  const res = new Readability<RTElement>(doc as unknown as Document, {
    charThreshold: summarizeCharThreshold,
    serializer: (v: Node) => v as unknown as RTElement,
  }).parse();
  if (!res) {
    throw new Error("failed to summarize document");
  }
  const { content, title, byline } = res;
  const seen = new Set<string>();
  walk(content, match, seen, opts);

  return {
    altered: content.innerHTML,
    title,
    byline,
    seen,
  };
}
