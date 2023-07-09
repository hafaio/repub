import { TextAlignment } from "rmapi-js/dist";

export type { TextAlignment };

type Awaitable<T> = T | Promise<T>;

export interface Storage {
  set(vals: Readonly<Record<string, unknown>>): Awaitable<void>;
  get<K extends string>(
    keys: Readonly<Record<K, unknown>>,
  ): Awaitable<Record<K, unknown>>;
  remove(keys: string[]): Awaitable<void>;
}

// istanbul ignore next
const mockStorage: Storage = {
  set(vals: Readonly<Record<string, unknown>>): void {
    for (const [key, val] of Object.entries(vals)) {
      globalThis.localStorage.setItem(key, JSON.stringify(val));
    }
  },
  get<K extends string>(
    keys: Readonly<Record<K, unknown>>,
  ): Record<K, unknown> {
    return Object.fromEntries(
      Object.entries(keys).map(([key, def]) => {
        const val = globalThis.localStorage.getItem(key);
        return [key, val === null ? def : JSON.parse(val)];
      }),
    ) as Record<K, unknown>;
  },
  remove(keys: readonly string[]): void {
    for (const key of keys) {
      globalThis.localStorage.removeItem(key);
    }
  },
};

export type OutputStyle = "upload" | "download";
export type ImageHandling = "strip" | "filter" | "keep";
export type Orientation = "portrait" | "landscape";
export type Cover = "first" | "visited";

/** how we generate the epub */
export interface EpubOptions {
  imageHandling: ImageHandling;
  imageBrightness: number;
  imageHrefSimilarityThreshold: number;
  hrefHeader: boolean;
  bylineHeader: boolean;
  coverHeader: boolean;
  rmCss: boolean;
  filterLinks: boolean;
}

export interface Options extends EpubOptions {
  deviceToken: string;
  outputStyle: OutputStyle;
  // how we upload the epub
  margins: number;
  lineHeight: number;
  textScale: number;
  textAlignment: TextAlignment;
  cover: Cover;
  fontName: string;
  timeout: number;
  // how we download the epub
  downloadAsk: boolean;
}

export const defaultOptions: Options = {
  deviceToken: "",
  outputStyle: "upload",
  // how we generate the epub
  imageHandling: "filter",
  imageHrefSimilarityThreshold: 0.2,
  imageBrightness: 1.25,
  hrefHeader: false,
  bylineHeader: true,
  coverHeader: true,
  rmCss: true,
  filterLinks: true,
  // how we upload the epub
  margins: 180,
  lineHeight: 100,
  textScale: 1,
  textAlignment: "justify",
  cover: "visited",
  fontName: "",
  timeout: 60 * 1000,
  // how we download the epub
  downloadAsk: false,
};

export async function getOptions(
  // istanbul ignore next
  {
    storage = globalThis.chrome?.storage?.local ?? mockStorage,
  }: { storage?: Storage } = {},
): Promise<Options> {
  const loaded = (await storage.get(defaultOptions)) as Partial<Options>;
  return { ...defaultOptions, ...loaded };
}

export interface SetOptions {
  (options: Partial<Options>): void;
}

export async function setOptions(
  opts: Partial<Options>,
  // istanbul ignore next
  {
    storage = globalThis.chrome?.storage?.local ?? mockStorage,
  }: { storage?: Storage } = {},
): Promise<void> {
  await storage.set(opts);
}
