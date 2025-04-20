// store active state for navigation
const activeTabs = new Map<number, Tab>();

class Tab {
  #tabId: number;
  nav: boolean = false;
  precount: number = 1;
  count: number = 1;

  constructor(tabId: number) {
    this.#tabId = tabId;
  }

  async init(): Promise<void> {
    try {
      await chrome.action.setBadgeBackgroundColor({
        tabId: this.#tabId,
        color: "#000000",
      });
      await chrome.action.setBadgeText({
        tabId: this.#tabId,
        text: "0%",
      });
    } catch {
      // ignore
    }
  }

  async progress(perc: number): Promise<void> {
    try {
      await chrome.action.setBadgeText({
        tabId: this.#tabId,
        text: `${perc.toFixed()}%`,
      });
    } catch {
      // ignore
    }
  }

  async complete(message: string): Promise<void> {
    try {
      await chrome.action.setBadgeText({
        tabId: this.#tabId,
        text: message,
      });
    } catch {
      // ignore
    }
  }

  async error(): Promise<void> {
    try {
      await Promise.all([
        chrome.action.setBadgeText({
          tabId: this.#tabId,
          text: "err",
        }),
        chrome.action.setBadgeBackgroundColor({
          tabId: this.#tabId,
          color: "#d62626",
        }),
      ]);
    } catch {
      // ignore
    }
  }

  async done(): Promise<void> {
    this.precount -= 1;
    if (!this.precount && this.nav) {
      try {
        await chrome.action.setBadgeText({
          tabId: this.#tabId,
          text: "",
        });
      } catch {
        // ignore
      }
    }
  }

  async drop(): Promise<void> {
    this.count -= 1;
    if (!this.count) {
      activeTabs.delete(this.#tabId);
      if (this.nav) {
        try {
          await chrome.action.setBadgeText({
            tabId: this.#tabId,
            text: "",
          });
        } catch {
          // ignore
        }
      }
    }
  }
}

export function getTab(tabId: number): Tab {
  const tab = activeTabs.get(tabId);
  if (tab) {
    tab.nav = false;
    tab.count += 1;
    tab.precount += 1;
    return tab;
  } else {
    const newTab = new Tab(tabId);
    activeTabs.set(tabId, newTab);
    return newTab;
  }
}

// watch for navigation
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId === 0) {
    // only care about root navigation
    const active = activeTabs.get(tabId);
    if (active?.precount) {
      active.nav = true;
    } else {
      chrome.action
        .setBadgeText({
          tabId,
          text: "",
        })
        .catch((ex: unknown) => {
          const message = ex instanceof Error ? ex.message : "unknown error";
          console.error(`error setting badge text: ${message}`);
        });
    }
  }
});
