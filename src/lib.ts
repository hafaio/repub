import { alter, closeMatch, exactMatch } from "./alter";
import { ImageData, epub } from "./epub";
import { brighten } from "./image";
import { EpubOptions } from "./options";
import { parse } from "./parse";

const remarkableCss = `
p {
  margin-top: 1em;
  margin-bottom: 1em;
}

ul, ol {
  padding: 1em;
}

ul li, ol li {
  margin-left: 1.5em;
  padding-left: 0.5em;
}

figcaption {
  font-size: 0.5rem;
  font-style: italic;
}`;

export async function generate(
  mhtml: Uint8Array,
  {
    imageHrefSimilarityThreshold,
    imageBrightness,
    imageHandling,
    filterLinks,
    rmCss,
    hrefHeader,
    bylineHeader,
    coverHeader,
  }: EpubOptions,
): Promise<{ epub: Uint8Array; title?: string }> {
  const { href, content, assets } = await parse(mhtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  const images = new Map<string, readonly [string, Uint8Array]>();
  for await (const { href, content, contentType } of assets) {
    if (contentType.startsWith("image/")) {
      images.set(href, [contentType, content]);
    }
  }

  const matcher =
    imageHrefSimilarityThreshold < 1
      ? closeMatch(images, imageHrefSimilarityThreshold)
      : exactMatch(images);
  const { altered, title, byline, cover, seen } = alter(doc, matcher, {
    filterLinks,
    imageHandling,
    summarizeCharThreshold: 0,
  });

  if (cover && coverHeader) {
    seen.add(cover);
  }

  const proms = [];
  for (const href of seen) {
    const [contentType, buff] = images.get(href)!;
    proms.push(
      brighten(buff, contentType, imageBrightness).then(
        ([data, mime]) => [href, data, mime] as const,
        () => undefined,
      ),
    );
  }
  const brightened: Record<string, ImageData> = {};
  for (const res of await Promise.all(proms)) {
    if (res) {
      const [href, data, mime] = res;
      brightened[href] = { data, mime };
    }
  }

  const buffer = await epub({
    title,
    content: altered,
    author: byline,
    images: brightened,
    css: rmCss ? remarkableCss : undefined,
    href: hrefHeader ? href : undefined,
    byline: bylineHeader,
    cover: coverHeader ? cover : undefined,
  });
  return { epub: buffer, title };
}
