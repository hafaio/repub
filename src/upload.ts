import { GenerationError, remarkable, RemarkableApi } from "rmapi-js/dist";
import { lock } from "./lock";
import { UploadOptions } from "./options";

const CACHE_KEY = "rmCache";
const writeLock = lock();
let cachedToken = "";
let cachedApi: RemarkableApi | undefined;

async function getApi(
  deviceToken: string,
  maxCacheSize: number,
): Promise<RemarkableApi> {
  if (cachedApi !== undefined && cachedToken === deviceToken) {
    return cachedApi;
  } else {
    cachedToken = deviceToken;
    const { [CACHE_KEY]: cache } = await chrome.storage.local.get(CACHE_KEY);
    const api = await remarkable(deviceToken, {
      maxCacheSize,
      cache: cache as string,
    });
    cachedApi = api;
    return api;
  }
}

export async function upload(
  epub: Uint8Array,
  title: string,
  deviceToken: string,
  { tags, viewBackgroundFilter, ...rest }: UploadOptions,
): Promise<void> {
  const tagList = [
    ...Iterator.from(tags.split(","))
      .map((tag) => tag.trim())
      .filter((tag) => !!tag.length),
  ];
  const opts = {
    ...rest,
    tags: tagList,
    viewBackgroundFilter: viewBackgroundFilter ?? undefined,
  };
  await writeLock.acquire();
  try {
    const api = await getApi(deviceToken, 1_000_000);
    for (let i = 0; i < 3; i++) {
      try {
        await api.putEpub(title, epub, opts);
        const cache = api.dumpCache();
        await chrome.storage.local.set({ [CACHE_KEY]: cache });
        return; // wrote successfully
      } catch (ex) {
        if (!(ex instanceof GenerationError)) {
          throw ex;
        }
      }
    }
  } finally {
    writeLock.release();
  }
}
