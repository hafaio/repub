import type { TitleRequest } from "./messages";

const title = document.getElementById("title-input")! as HTMLInputElement;
const author = document.getElementById("author-input")! as HTMLInputElement;
const button = document.getElementById("submit")! as HTMLButtonElement;
const error = document.getElementById("error")! as HTMLSpanElement;

button.addEventListener("click", () => {
  button.disabled = true;
  error.innerText = "";
  chrome.tabs
    .query({
      active: true,
      currentWindow: true,
    })
    .then(
      async ([tab]) => {
        try {
          const msg: TitleRequest = {
            tabId: tab!.id!,
            title: title.value.trim() || undefined,
            author: author.value.trim() || undefined,
          };
          await chrome.runtime.sendMessage(msg);
          window.close();
        } finally {
          button.disabled = false;
        }
      },
      (ex: unknown) => {
        const message = ex instanceof Error ? ex.message : "unknown error";
        error.innerText = `error getting tab: ${message}`;
        button.disabled = false;
      },
    );
});
