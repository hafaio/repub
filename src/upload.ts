import {
  Entry,
  formatEntry,
  GenerationError,
  parseEntry,
  PutEpubOptions,
  remarkable,
  RemarkableApi,
  RequestInitLike,
  ResponseLike,
} from "rmapi-js/dist";
import { lock } from "./lock";

interface Epub {
  buffer: Uint8Array;
  title: string;
}

interface UploadState {
  rootHash: string;
  generation: bigint;
  entries: Entry[];
}

/**
 * web workers don't like calling fetch bound to global scope, so we need to
 * wrap the call
 */
async function wrapper(
  url: string,
  init?: RequestInitLike
): Promise<ResponseLike> {
  return await fetch(url, init);
}

const cacheLock = lock();
let cachedToken = "";
let cachedApi: WeakRef<RemarkableApi> | undefined;

async function getApi(deviceToken: string): Promise<RemarkableApi> {
  const existing = cachedApi?.deref();
  if (existing === undefined || cachedToken !== deviceToken) {
    try {
      await cacheLock.acquire();
      cachedToken = deviceToken;
      const api = await remarkable(deviceToken, { fetch: wrapper });
      cachedApi = new WeakRef(api);
      return api;
    } finally {
      cacheLock.release();
    }
  } else {
    return existing;
  }
}

async function getState(api: RemarkableApi): Promise<UploadState> {
  try {
    const { rootHash, generation, entriesStrings } =
      await chrome.storage.local.get([
        "rootHash",
        "generation",
        "entriesStrings",
      ]);
    if (
      typeof rootHash === "string" &&
      typeof generation === "string" &&
      Array.isArray(entriesStrings) &&
      entriesStrings.every((v) => typeof v === "string")
    ) {
      return {
        rootHash,
        generation: BigInt(generation),
        entries: entriesStrings.map(parseEntry),
      };
    }
  } catch (ex) {
    console.error(ex);
  }
  const [rootHash, generation] = await api.getRootHash();
  const entries = await api.getEntries(rootHash);
  return { rootHash, generation, entries };
}

async function setState({
  rootHash,
  generation,
  entries,
}: UploadState): Promise<void> {
  await chrome.storage.local.set({
    rootHash,
    generation: `${generation}`,
    entriesStrings: entries.map((ent) => formatEntry(ent)),
  });
}

async function uploadEntry(
  api: RemarkableApi,
  epubPromise: Promise<Epub>,
  options: PutEpubOptions
): Promise<Entry> {
  const { buffer, title } = await epubPromise;
  return await api.putEpub(title, buffer, options);
}

interface UploadOptions {
  retries?: number;
}

const registerLock = lock();
const entryQueue: [Promise<Entry>, (err?: unknown) => void][] = [];

export async function upload(
  epubPromise: Promise<Epub>,
  deviceToken: string,
  options: PutEpubOptions,
  { retries = 2 }: UploadOptions
): Promise<void> {
  const api = await getApi(deviceToken);
  let complete = null;
  entryQueue.push([
    uploadEntry(api, epubPromise, options),
    (err?: unknown) => {
      complete = err;
    },
  ]);
  try {
    await registerLock.acquire();
    if (complete === null) {
      let { rootHash, generation, entries } = await getState(api);

      const newEntries = [];
      const callbacks = [];
      for (let tryNum = 0; ; ++tryNum) {
        // find any more entries to upload
        let pair;
        while ((pair = entryQueue.pop())) {
          const [prom, callback] = pair;
          newEntries.push(await prom);
          callbacks.push(callback);
          tryNum = 0;
        }
        entries.push(...newEntries);

        try {
          const { hash } = await api.putEntries("", entries);
          const newGen = await api.putRootHash(hash, generation);
          // NOTE we don't strictly need to wait for the cache to write, but we probably should?
          await setState({ rootHash: hash, generation: newGen, entries });
          // mark everything as complete
          for (const callback of callbacks) {
            callback();
          }
          return;
        } catch (ex) {
          if (tryNum < retries && ex instanceof GenerationError) {
            console.log("failed upload due to generation");
            // failed due to generation, resync with remote
            [rootHash, generation] = await api.getRootHash();
            entries = await api.getEntries(rootHash);
          } else {
            // fail everything we tried to upload
            for (const callback of callbacks) {
              callback(ex);
            }
            throw ex;
          }
        }
      }
    } else if (complete === undefined) {
      return;
    } else {
      throw complete;
    }
  } finally {
    registerLock.release();
  }
}
