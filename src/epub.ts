import { ImageData, ImageMime, render } from "teapub/dist";
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
  author: string;
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
  if (byline) {
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
  components.push(content);

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
