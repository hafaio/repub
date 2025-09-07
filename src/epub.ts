import { type ImageData, type ImageMime, render } from "teapub/dist";
export type { ImageData, ImageMime };

export async function epub({
  title,
  content,
  author,
  images,
  css,
  uid,
  href,
  byline = false,
  cover,
}: {
  title: string;
  content: string;
  author?: string;
  images: Map<string, ImageData>;
  css: string | undefined;
  uid?: string;
  href?: string;
  byline?: boolean;
  cover?: string;
}): Promise<Uint8Array> {
  const components = [];
  if (href) {
    components.push('<a href="', href, '">', href, "</a>");
  }
  components.push("<h1>", title, "</h1>");
  if (byline && author) {
    components.push(
      '<address style="font-style: italic">',
      author,
      "</address>",
    );
  }
  if (cover) {
    components.push(
      `<div style="margin-top: 1em"><img src="`,
      cover,
      `"/></div>`,
    );
  }
  // NOTE we shouldn't have to do this unescape here, but empirically we do...
  components.push(
    content
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'"),
  );

  return await render({
    title,
    author,
    sections: [{ title, content: components.join("") }],
    images,
    css,
    uid,
    missingImage: "remove",
  });
}
