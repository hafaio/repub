import {
  Entry,
  GenerationError,
  PutEpubOptions,
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

const registerLock = lock();
let rootState: [Entry[], string, bigint] | undefined;

interface UploadOptions {
  retries?: number;
}

export async function upload(
  epub: ArrayBuffer,
  title: string,
  deviceToken: string,
  options: PutEpubOptions,
  { retries = 2 }: UploadOptions,
): Promise<void> {
  const api = await getApi(deviceToken);
  const entry = await api.putEpub(title, epub, options);
  const gen = await updateRootState(api, entry, retries);
  await api.syncComplete(gen);
}

async function updateRootState(
  api: RemarkableApi,
  entry: Entry,
  retries: number,
): Promise<bigint> {
  await registerLock.acquire();
  try {
    for (; retries > 0; --retries) {
      try {
        let entries, rootHash, generation;
        if (rootState) {
          [entries, rootHash, generation] = rootState;
        } else {
          [rootHash, generation] = await api.getRootHash();
          entries = await api.getEntries(rootHash);
        }
        entries.push(entry);
        const { hash } = await api.putEntries("", entries);
        const newGen = await api.putRootHash(hash, generation);
        rootState = [entries, rootHash, newGen];
        return newGen;
      } catch (ex) {
        if (ex instanceof GenerationError) {
          console.log("failed upload due to generation");
          rootState = undefined;
        } else {
          throw ex;
        }
      }
    }
  } finally {
    registerLock.release();
  }
  throw Error("failed up update remarkable root state");
}
