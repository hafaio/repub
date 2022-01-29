import { Readability } from "@mozilla/readability";
import {
  ReadabilityOptions,
  SummarizedError,
  SummarizedMessage,
} from "./interfaces";
import { assert } from "./utils";

/** take options from script to minimize race conditions */
export function readabilityScript({
  charThreshold,
}: ReadabilityOptions): SummarizedMessage | SummarizedError {
  try {
    const doc = document.cloneNode(true) as Document;
    const readable = new Readability(doc, { charThreshold }).parse();
    assert(readable !== null, "couldn't summarize document");
    return { status: "success", ...readable };
  } catch (ex) {
    return { status: "error", content: `${ex}` };
  }
}
