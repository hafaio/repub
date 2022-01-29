import { ImageData, MissingImage, render } from "teapub/dist";

export async function epub({
  title,
  content,
  author,
  images,
  css,
  uid,
  href,
  missingImage,
}: {
  title: string;
  content: string;
  author: string;
  images: Record<string, ImageData>;
  css: string | undefined;
  uid?: string;
  href?: string;
  missingImage: MissingImage;
}): Promise<Uint8Array> {
  const prefix = href ? `<a href="${href}">${href}</a>` : "";
  return await render({
    title,
    author,
    sections: [{ title, content: `${prefix}<h1>${title}</h1>${content}` }],
    images,
    css,
    uid,
    missingImage,
  });
}
