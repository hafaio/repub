import { readabilityScript } from "../content/content-readability";
import { ReadabilityOptions, Summarized } from "./interfaces";

export function readability(
  tabId: number,
  options: ReadabilityOptions
): Promise<Summarized> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: readabilityScript,
        args: [options],
      },
      ([result]) => {
        const { status, ...res } = result!.result;
        if (status === "success") {
          resolve(res);
        } else {
          reject(new Error(`error in script: ${res.content}`));
        }
      }
    );
  });
}
