import {
  Attribute,
  ChildNode,
  DocumentFragment,
  Element,
  Node,
  parseFragment,
  serialize,
} from "parse5";
import { filter } from "./iters";
import { ImageHandling } from "./options";
import { Asset } from "./parse";

export interface Altered {
  altered: string;
  images: Asset[];
}

function* parseSrcset(srcset: string): IterableIterator<string> {
  for (const field of srcset.split(",")) {
    const match = field.match(/\S+/);
    if (!match) continue;
    const [href] = match;
    yield decodeURIComponent(href!);
  }
}

function* getSrcs(nodes: Iterable<Node>): Iterable<string> {
  for (const node of nodes) {
    if ("tagName" in node) {
      for (const { name, value } of node.attrs) {
        if (name === "src") {
          yield decodeURIComponent(value);
        } else if (name === "srcset") {
          yield* parseSrcset(value);
        }
      }
    }
  }
}

function isImg(node: Node): node is Element {
  return "tagName" in node && node.tagName === "img";
}

function updateAttr(attrs: Attribute[], name: string, value: string): void {
  let modified = false;
  for (const attr of attrs) {
    if (attr.name === name) {
      attr.value = value;
      modified = true;
      break;
    }
  }
  if (!modified) {
    attrs.push({ name, value });
  }
}

interface Options {
  filterLinks: boolean;
  imageHandling: ImageHandling;
}

function walk(
  node: ChildNode | DocumentFragment,
  valid: Map<string, unknown>,
  seen: Set<string>,
  options: Options
): ChildNode[] {
  if ("tagName" in node) {
    // elements
    const { filterLinks, imageHandling } = options;
    if (node.tagName === "a" && filterLinks) {
      // remove link leaving just children
      return node.childNodes;
    } else if (node.tagName === "img") {
      // img element, find best src
      const [href] = filter(getSrcs([node]), (href) => valid.has(href));
      if (
        imageHandling === "strip" ||
        !href ||
        (imageHandling === "filter" && seen.has(href))
      ) {
        return [];
      } else {
        updateAttr(node.attrs, "src", href);
        seen.add(href);
        return [node];
      }
    } else if (node.tagName === "picture") {
      // picture element, find best source and set pictures source
      const [href] = filter(getSrcs(node.childNodes), (href) =>
        valid.has(href)
      );
      const [img] = node.childNodes.filter(isImg);
      if (
        imageHandling === "strip" ||
        !href ||
        !img ||
        (imageHandling === "filter" && seen.has(href))
      ) {
        return [];
      } else {
        updateAttr(img.attrs, "src", encodeURI(href));
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
  } else if (node.nodeName === "#comment" || node.nodeName === "#text") {
    // preserve these these
    return [node];
  } else {
    // doc or fragment or element: iterate over children
    node.childNodes = node.childNodes.flatMap((child) =>
      walk(child, valid, seen, options)
    );
    // not a child node, so "filtered"
    return [];
  }
}

/** update img src's with srcset information */
export async function alter(
  content: string,
  assets: AsyncIterable<Asset>,
  options: Options
): Promise<Altered> {
  const images = new Map<string, Asset>();
  for await (const asset of assets) {
    const { href, contentType } = asset;
    if (contentType.startsWith("image/")) {
      images.set(href, asset);
    }
  }

  // all seen hrefs
  const parsed = parseFragment(content);
  const seen = new Set<string>();
  walk(parsed, images, seen, options);

  return {
    altered: serialize(parsed),
    images: [...seen].map((href) => images.get(href)!),
  };
}
