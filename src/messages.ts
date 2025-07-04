import { EpubOptions } from "./options";

// NOTE in order to pass messages we need to convert ArrayBuffers to strings.
// The most straightforward way is to encode the arrays as 16 bit elements, and
// then convert those to char codes. However, this requires that the arrays
// have an even length (which they aren't guaranteed to). handling this case is
// a little more difficult, but probably more efficient than base64 encoding as
// we do now:
// https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/

export interface InitMessage {
  type: "info";
  numParts: number;
  options: EpubOptions;
  title?: string;
  author?: string;
  summarize: boolean;
}

export interface InitResponse {
  type: "info";
  numParts: number;
  title?: string;
}

export interface PartMessage {
  type: "part";
  index: number;
  part: string;
}

export interface ErrorMessage {
  type: "error";
  err: string;
}

export type Message = InitMessage | PartMessage;

export type Response = InitResponse | PartMessage | ErrorMessage;

export interface TitleRequest {
  tabId: number;
  title?: string;
  author?: string;
}
