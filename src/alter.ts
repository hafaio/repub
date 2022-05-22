import { Readability } from "@mozilla/readability";
import { parse } from "parse5";
import {
  ChildNode as RTChildNode,
  Element as RTElement,
  NodeType,
  treeAdapter,
} from "read-tree";
import { filter } from "./iters";
import { ImageHandling } from "./options";

interface HasAble<T> {
  has(val: T): boolean;
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
  valid: HasAble<string>,
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
    const [href] = filter(getSrcs([node]), (href) => valid.has(href));
    if (
      imageHandling === "strip" ||
      !href ||
      (imageHandling === "filter" && seen.has(href))
    ) {
      return [];
    } else {
      node.src = href;
      seen.add(href);
      return [node];
    }
  } else if (node.tagName === "PICTURE") {
    // picture element, find best source and set pictures source
    const { imageHandling } = options;
    const [href] = filter(getSrcs(node.childNodes), (href) => valid.has(href));
    const [img] = node.childNodes.filter(isImg);
    if (
      imageHandling === "strip" ||
      !href ||
      !img ||
      (imageHandling === "filter" && seen.has(href))
    ) {
      return [];
    } else {
      img.src = encodeURI(href);
      seen.add(href);
      return [img];
    }
  } else {
    // all others
    node.childNodes = node.childNodes.flatMap((child) =>
      walk(child, valid, seen, options)
    );
    return [node];
  }
}

/** update img src's with srcset information */
export async function alter(
  raw: string,
  images: HasAble<string>,
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
  walk(content, images, seen, opts);

  return {
    altered: content.innerHTML,
    title,
    byline,
    seen,
  };
}
