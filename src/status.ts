class Tab {
  #tabId: number;
  nav: boolean = false;
  count: number = 1;

  constructor(tabId: number) {
    this.#tabId = tabId;
  }

  async init(): Promise<void> {
    try {
      await browser.action.setBadgeBackgroundColor({
        tabId: this.#tabId,
        color: "#000000",
      });
      await browser.action.setBadgeText({
        tabId: this.#tabId,
        text: "0%",
      });
    } finally {
      // ignore
    }
  }

  async progress(perc: number): Promise<void> {
    try {
      await browser.action.setBadgeText({
        tabId: this.#tabId,
        text: `${perc.toFixed()}%`,
      });
    } finally {
      // ignore
    }
  }

  async complete(message: string): Promise<void> {
    try {
      await browser.action.setBadgeText({
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
        browser.action.setBadgeText({
          tabId: this.#tabId,
          text: "err",
        }),
        browser.action.setBadgeBackgroundColor({
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
        await browser.action.setBadgeText({
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
browser.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId === 0) { // frameId 0 indicates it's the main frame
      const active = activeTabs.get(details.tabId);
      if (active) {
        active.nav = true;
      } else {
        void browser.action.setBadgeText({
          tabId: details.tabId,
          text: "",
        });
      }
    }
  },
  { url: [{ schemes: ["http", "https"] }] }
);
