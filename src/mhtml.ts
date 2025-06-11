/* eslint-disable spellcheck/spell-checker */
import { fromByteArray } from "base64-js";
import { v4 as uuidv4 } from "uuid";

async function loadImage(
  url: string,
): Promise<{ url: string; mime: string; content: Uint8Array } | null> {
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`Failed to load image from ${url}: ${response.statusText}`);
    return null;
  }
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return { url, mime: blob.type, content: new Uint8Array(arrayBuffer) };
}

function encodePart(
  content: Uint8Array,
  mime: string,
  url: string,
  boundary: string,
): string[] {
  const encoded = fromByteArray(content);
  const lines = [
    `------MultipartBoundary--${boundary}----`,
    `Content-Type: ${mime}`,
    "Content-Transfer-Encoding: base64",
    `Content-Location: ${url}`,
    "",
  ];
  const chunkSize = 76;
  for (let i = 0; i < encoded.length; i += chunkSize) {
    lines.push(encoded.slice(i, i + chunkSize));
  }
  return lines;
}

export async function toMhtml(
  fileName: string,
  html: string,
  images: string[],
): Promise<Uint8Array> {
  const boundary = uuidv4();

  const lines = [
    "From: <Created by rePub>",
    `Snapshot-Content-Location: ${fileName}`,
    `Subject: ${fileName}`,
    `Date: ${new Date().toDateString()}`,
    "MIME-Version: 1.0",
    "Content-Type: multipart/related;",
    '  type="text/html";',
    `  boundary="----MultipartBoundary--${boundary}----"`,
    "",
    "",
  ];
  const enc = new TextEncoder();
  lines.push(...encodePart(enc.encode(html), "text/html", fileName, boundary));

  // add all images that were linked
  const loaded = await Promise.all(images.map(loadImage));
  for (const { url, mime, content } of loaded.filter((d) => d !== null)) {
    lines.push(...encodePart(content, mime, url, boundary));
  }

  // footer for completion
  lines.push(`------MultipartBoundary--${boundary}------`);
  return enc.encode(lines.join("\r\n"));
}
