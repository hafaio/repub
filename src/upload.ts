import { GenerationError, type RemarkableApi, remarkable } from "rmapi-js/dist";
import { lock } from "./lock";
import type { UploadOptions } from "./options";

const CACHE_KEY = "rmCache";
const writeLock = lock();
let cachedToken = "";
let cachedUrlKey = "";
let cachedApi: RemarkableApi | undefined;

async function getApi(
  deviceToken: string,
  maxCacheSize: number,
  authHost: string,
  syncHost: string,
  uploadHost: string,
  rawHost: string,
): Promise<RemarkableApi> {
  const urlKey = `${authHost}|${syncHost}|${uploadHost}|${rawHost}`;
  if (
    cachedApi !== undefined &&
    cachedToken === deviceToken &&
    cachedUrlKey === urlKey
  ) {
    return cachedApi;
  } else {
    cachedToken = deviceToken;
    cachedUrlKey = urlKey;
    const { [CACHE_KEY]: cache } = await chrome.storage.local.get(CACHE_KEY);
    const api = await remarkable(deviceToken, {
      maxCacheSize,
      cache: cache as string,
      authHost,
      syncHost,
      uploadHost,
      rawHost,
    });
    cachedApi = api;
    return api;
  }
}

async function uploadBase(
  deviceToken: string,
  authHost: string,
  syncHost: string,
  uploadHost: string,
  rawHost: string,
  put: (api: RemarkableApi) => Promise<void>,
): Promise<void> {
  await writeLock.acquire();
  try {
    const api = await getApi(
      deviceToken,
      1_000_000,
      authHost,
      syncHost,
      uploadHost,
      rawHost,
    );
    for (let i = 0; i < 3; i++) {
      try {
        await put(api);
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

export async function uploadEpub(
  epub: Uint8Array,
  title: string,
  deviceToken: string,
  {
    tags,
    viewBackgroundFilter,
    authHost,
    syncHost,
    uploadHost,
    rawHost,
    tokenUrl: _,
    ...rest
  }: UploadOptions,
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
    title,
  };
  await uploadBase(
    deviceToken,
    authHost,
    syncHost,
    uploadHost,
    rawHost,
    async (api: RemarkableApi) => {
      await api.putEpub(title, epub, opts);
    },
  );
}

export async function uploadPdf(
  pdf: Uint8Array,
  title: string,
  deviceToken: string,
  {
    tags,
    viewBackgroundFilter,
    authHost,
    syncHost,
    uploadHost,
    rawHost,
    tokenUrl: _,
    ...rest
  }: UploadOptions,
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
    title,
  };
  await uploadBase(
    deviceToken,
    authHost,
    syncHost,
    uploadHost,
    rawHost,
    async (api) => {
      await api.putPdf(title, pdf, opts);
    },
  );
}
