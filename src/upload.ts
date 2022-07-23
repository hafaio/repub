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
import { timeout as asyncTimeout } from "./utils";

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

async function getState(
  apiPromise: Promise<RemarkableApi>
): Promise<UploadState> {
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
  const api = await apiPromise;
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
  apiPromise: Promise<RemarkableApi>,
  epubPromise: Promise<Epub>,
  options: PutEpubOptions
): Promise<Entry> {
  const [api, { buffer, title }] = await Promise.all([apiPromise, epubPromise]);
  return await api.putEpub(title, buffer, options);
}

// TODO ideally we'd save information between calls so that we're not creating
// a new api and root hash each time, but reusing the last one that worked.
// However, I can't think of a clever way to transition that state without
// either using a ttl cache dependency, or manually clearing the cache when I
// detect that the lock is no longer locked, which seems really inellegant.
async function singleUpload(
  epubPromise: Promise<Epub>,
  deviceToken: string,
  options: PutEpubOptions,
  retries = 2
): Promise<void> {
  const apiPromise = remarkable(deviceToken, { fetch: wrapper });
  const [api, entry, state] = await Promise.all([
    apiPromise,
    uploadEntry(apiPromise, epubPromise, options),
    getState(apiPromise),
  ]);
  let { rootHash, generation, entries } = state;

  for (let tryNum = 0; ; ++tryNum) {
    try {
      entries.push(entry);
      const { hash } = await api.putEntries("", entries);
      const newGen = await api.putRootHash(hash, generation);
      await api.syncComplete();
      // NOTE we don't strictly need to wait for the cache to write, but we probably should?
      await setState({ rootHash: hash, generation: newGen, entries });
      return;
    } catch (ex) {
      if (tryNum < retries && ex instanceof GenerationError) {
        console.log("failed upload due to generation");
        // failed due to generation, resync with remote
        [rootHash, generation] = await api.getRootHash();
        entries = await api.getEntries(rootHash);
      } else {
        throw ex;
      }
    }
  }
}

interface UploadOptions {
  retries?: number;
  timeout: number;
}

const uploadLock = lock();

// TODO instead of doing a singel upload at a time, everything should upload
// individually and then this should just tontinnously try and update the root
// hash
export async function upload(
  epubPromise: Promise<Epub>,
  deviceToken: string,
  options: PutEpubOptions,
  { retries = 2, timeout }: UploadOptions
): Promise<void> {
  try {
    // TODO since we only upload one at a time, we could update the status
    // badge to indicate paused, but that might be tricky from an api
    // perspective, and might create confusion for users
    await uploadLock.acquire();
    await asyncTimeout(
      singleUpload(epubPromise, deviceToken, options, retries),
      timeout,
      "timed out uploading"
    );
  } finally {
    uploadLock.release();
  }
}
