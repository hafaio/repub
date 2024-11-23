import { Tabs } from "webextension-polyfill";

declare global {
  namespace browser.tabs {
    function saveAsMHTML(details: { tabId: number }): Promise<ArrayBuffer>;
  }
}
