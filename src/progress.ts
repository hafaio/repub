export interface Progress {
  start(): Promise<void>;

  progress(prog: number): Promise<void>;

  stop(): Promise<void>;
}

class ProgressBadge implements Progress {
  #tabId: number;
  #color: string;

  constructor(tabId: number, color: string = "#000000") {
    this.#tabId = tabId;
    this.#color = color;
  }

  async start() {
    await Promise.all([
      chrome.action.disable(this.#tabId),
      chrome.action.setBadgeBackgroundColor({
        color: this.#color,
        tabId: this.#tabId,
      }),
      chrome.action.setBadgeText({ text: "0%", tabId: this.#tabId }),
    ]);
  }

  async progress(prog: number) {
    await chrome.action.setBadgeText({
      text: `${(prog * 100).toFixed(0)}%`,
      tabId: this.#tabId,
    });
  }

  async stop() {
    await Promise.all([
      chrome.action.setBadgeText({ text: "", tabId: this.#tabId }),
      chrome.action.enable(this.#tabId),
    ]);
  }
}

export function progress(tabId: number): Progress {
  return new ProgressBadge(tabId);
}
