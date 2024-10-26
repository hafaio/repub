import { EpubOptions } from "./options";

// NOTE in order to pass messages we need to convert ArrayBuffers to strings.
// The most straightforward way is to encode the arrays as 16 bit elements, and
// then convert those to char codes. However, this requires that the arrays
// have an even length (which they aren't guaranteed to). handling this case is
// a little more difficult, but probably more efficient than base64 encoding as
// we do now:
// https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
export interface Message extends EpubOptions {
  mhtml: string;
}
export type Response =
  | { type: "part"; index: number; part: string }
  | { type: "info"; numParts: number; title?: string }
  | { type: "error"; err: string };
