import { readFile } from "node:fs/promises";
import { ReadableStream } from "node:stream/web";

export function openAsStream(path: string): ReadableStream {
  // this is a hack because for some reason yarn pnp isn't loading experimental
  // node features
  return new ReadableStream({
    async start(controller) {
      const buff = await readFile(path);
      controller.enqueue(buff);
      controller.close();
    },
  });
}
