// NOTE in order to pass messages we need to convert ArrayBuffers to strings.
// The most straightforward way is to encode the arrays as 16 bit elements, and
// then convert those to char codes. However, this requires that the arrays
// have an even length (which they aren't guaranteed to). handling this case is
// a little more difficult, but probably more efficient than base64 encoding as
// we do now:
// https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
export type Message = string;
export type Response =
  | { success: true; epub: string; title?: string }
  | { success: false; err: string };
