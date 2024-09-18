class Tab {
  #tabId: number;
  nav: boolean = false;
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
    } finally {
      // ignore
    }
  }

  async progress(perc: number): Promise<void> {
    try {
      await chrome.action.setBadgeText({
        tabId: this.#tabId,
        text: `${perc.toFixed()}%`,
      });
    } finally {
      // ignore
    }
  }

  async complete(message: string): Promise<void> {
    try {
      await chrome.action.setBadgeText({
        tabId: this.#tabId,
        text: message,
      });
    } finally {
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
    } finally {
      // ignore
    }
  }

  async drop(): Promise<void> {
    this.count -= 1;
    if (!this.count) {
      activeTabs.delete(this.#tabId);
      if (this.nav) {
        await chrome.action.setBadgeText({
          tabId: this.#tabId,
          text: "",
        });
      }
    }
  }
}

// store active state for navigation
const activeTabs = new Map<number, Tab>();

export function getTab(tabId: number): Tab {
  const tab = activeTabs.get(tabId);
  if (tab) {
    tab.nav = false;
    tab.count += 1;
    return tab;
  } else {
    const newTab = new Tab(tabId);
    activeTabs.set(tabId, newTab);
    return newTab;
  }
}

// watch for navigation
chrome.webNavigation.onBeforeNavigate.addListener(
  ({ tabId, parentDocumentId }) => {
    if (parentDocumentId === undefined) {
      // only care about root navigation
      const active = activeTabs.get(tabId);
      if (active) {
        active.nav = true;
      } else {
        void chrome.action.setBadgeText({
          tabId,
          text: "",
        });
      }
    }
  },
);
