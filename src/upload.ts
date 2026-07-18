import {
  GenerationError,
  type PutOptions,
  type RemarkableApi,
  remarkable,
} from "rmapi-js";
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
  uploadHost: string,
  rawHost: string,
): Promise<RemarkableApi> {
  const urlKey = `${authHost}|${uploadHost}|${rawHost}`;
  if (
    cachedApi !== undefined &&
    cachedToken === deviceToken &&
    cachedUrlKey === urlKey
  ) {
    return cachedApi;
  } else {
    const { [CACHE_KEY]: cache } = await chrome.storage.local.get(CACHE_KEY);
    const api = await remarkable(deviceToken, {
      maxCacheSize,
      cache: cache as string,
      authHost,
      uploadHost,
      rawHost,
    });
    // only populate the cache once the api has been built
    cachedToken = deviceToken;
    cachedUrlKey = urlKey;
    cachedApi = api;
    return api;
  }
}

async function uploadBase(
  deviceToken: string,
  authHost: string,
  uploadHost: string,
  rawHost: string,
  put: (api: RemarkableApi) => Promise<unknown>,
): Promise<void> {
  await writeLock.acquire();
  try {
    const api = await getApi(
      deviceToken,
      1_000_000,
      authHost,
      uploadHost,
      rawHost,
    );
    let lastError: GenerationError | undefined;
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
        lastError = ex;
      }
    }
    // every attempt raised a GenerationError; surface it instead of silently
    // reporting success and losing the upload
    throw lastError;
  } finally {
    writeLock.release();
  }
}

async function upload(
  payload: Uint8Array,
  title: string,
  deviceToken: string,
  {
    tags,
    viewBackgroundFilter,
    authHost,
    uploadHost,
    rawHost,
    tokenUrl: _,
    pdfTrimDevice: __,
    ...rest
  }: UploadOptions,
  put: (
    api: RemarkableApi,
    name: string,
    buffer: Uint8Array,
    opts: PutOptions,
  ) => Promise<unknown>,
  extra: Partial<PutOptions> = {},
): Promise<void> {
  const tagList = [
    ...Iterator.from(tags.split(","))
      .map((tag) => tag.trim())
      .filter((tag) => !!tag.length),
  ];
  const opts = {
    ...rest,
    ...extra,
    tags: tagList,
    viewBackgroundFilter: viewBackgroundFilter ?? undefined,
    title,
  };
  await uploadBase(deviceToken, authHost, uploadHost, rawHost, (api) =>
    put(api, title, payload, opts),
  );
}

export function uploadEpub(
  epub: Uint8Array,
  title: string,
  deviceToken: string,
  options: UploadOptions,
): Promise<void> {
  return upload(epub, title, deviceToken, options, (api, name, buffer, opts) =>
    api.putEpub(name, buffer, opts),
  );
}

export function uploadPdf(
  pdf: Uint8Array,
  title: string,
  deviceToken: string,
  options: UploadOptions,
  extra: Partial<PutOptions> = {},
): Promise<void> {
  return upload(
    pdf,
    title,
    deviceToken,
    options,
    (api, name, buffer, opts) => api.putPdf(name, buffer, opts),
    extra,
  );
}
