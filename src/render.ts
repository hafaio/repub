import { fromByteArray, toByteArray } from "base64-js";
import { generate } from "./lib";
import { brighten } from "./image";
import { EpubOptions } from "./options";

let num = 0;

export async function render(
  mhtml: ArrayBuffer,
  opts: EpubOptions,
): Promise<{ epub: Uint8Array; title?: string }> {
  console.log('[render] Starting render process');
  num++;
  try {
    console.log('[render] Processing MHTML directly');
    const mhtmlStr = new TextDecoder().decode(new Uint8Array(mhtml).slice(0, 500));
    console.log('[render] First 500 bytes of MHTML:', mhtmlStr);
    
    const bright = (buffer: Uint8Array, mime: string) =>
      brighten(buffer, mime, opts.imageBrightness, false);
    
    const result = await generate(new Uint8Array(mhtml), bright, opts);
    console.log('[render] Successfully processed EPUB');
    return result;
  } catch (error) {
    console.error('[render] Error in render process:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render document: ${errorMessage}`);
  } finally {
    num--;
    console.log('[render] Render process completed');
  }
}
