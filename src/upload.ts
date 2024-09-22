import {
  remarkable,
  RemarkableApi,
  RequestInitLike,
  ResponseLike,
} from "rmapi-js/dist";
import { lock } from "./lock";

/**
 * web workers don't like calling fetch bound to global scope, so we need to
 * wrap the call
 */
async function wrapper(
  url: string,
  init?: RequestInitLike,
): Promise<ResponseLike> {
  return await fetch(url, init);
}

const cacheLock = lock();
let cachedToken = "";
let cachedApi: RemarkableApi | undefined;

async function getApi(deviceToken: string): Promise<RemarkableApi> {
  if (cachedApi !== undefined && cachedToken === deviceToken) {
    return cachedApi;
  } else {
    try {
      await cacheLock.acquire();
      cachedToken = deviceToken;
      const api = await remarkable(deviceToken, { fetch: wrapper });
      cachedApi = api;
      return api;
    } finally {
      cacheLock.release();
    }
  }
}

export async function upload(
  epub: Uint8Array,
  title: string,
  deviceToken: string,
): Promise<void> {
  const api = await getApi(deviceToken);
  await api.uploadEpub(title, epub.buffer as ArrayBuffer);
}
