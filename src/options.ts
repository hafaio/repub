type Awaitable<T> = T | Promise<T>;

export interface Storage {
  set(vals: Readonly<Record<string, unknown>>): Awaitable<void>;
  get<K extends string>(
    keys: Readonly<Record<K, unknown>>,
  ): Awaitable<Record<K, unknown>>;
  remove(keys: string[]): Awaitable<void>;
}

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
  imageShrink: boolean;
  imageHrefSimilarityThreshold: number;
  hrefHeader: boolean;
  bylineHeader: boolean;
  coverHeader: boolean;
  rmCss: boolean;
  codeCss: boolean;
  tabCss: boolean;
  filterLinks: boolean;
  filterIframes: boolean;
  authorByline: boolean;
  convertTables: boolean;
  rotateTables: boolean;
  tableResolution: number;
}

export interface UploadOptions {
  coverPageNumber: number;
  fontName: string;
  margins: number;
  textScale: number;
  lineHeight: number;
  tags: string;
  textAlignment: "left" | "justify";
  // eslint-disable-next-line spellcheck/spell-checker
  viewBackgroundFilter: "off" | "fullpage" | null;
  legacyUpload: boolean;
}

export interface Options extends EpubOptions, UploadOptions {
  deviceToken: string;
  outputStyle: OutputStyle;
  // how we download the epub
  downloadAsk: boolean;
  // did we notify about remarkable breaking
  didNotify: boolean;
  // if to prompt for title
  promptTitle: boolean;
}

export const defaultOptions: Options = {
  deviceToken: "",
  outputStyle: "upload",
  // how we download the epub
  downloadAsk: false,
  // did we notify about remarkable breaking in 2024
  didNotify: false,
  // ---- //
  // Epub //
  // ---- //
  imageHandling: "filter",
  imageHrefSimilarityThreshold: 0.2,
  imageBrightness: 1,
  imageShrink: true,
  hrefHeader: false,
  bylineHeader: true,
  coverHeader: true,
  rmCss: true,
  codeCss: true,
  tabCss: true,
  filterLinks: true,
  filterIframes: true,
  authorByline: true,
  convertTables: false,
  rotateTables: false,
  tableResolution: 1,
  // ------ //
  // Upload //
  // ------ //
  coverPageNumber: -1,
  // eslint-disable-next-line spellcheck/spell-checker
  fontName: "EB Garamond",
  margins: 125,
  textScale: 1,
  lineHeight: 100,
  tags: "",
  textAlignment: "justify",
  viewBackgroundFilter: null,
  promptTitle: false,
  legacyUpload: true,
};

export async function getOptions({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  storage = globalThis.chrome?.storage?.local ?? mockStorage,
}: {
  storage?: Storage;
} = {}): Promise<Options> {
  const loaded = await storage.get(defaultOptions);
  return loaded as Options;
}

export type SetOptions = (options: Partial<Options>) => void;

export async function setOptions(
  opts: Partial<Options>,
  {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    storage = globalThis.chrome?.storage?.local ?? mockStorage,
  }: { storage?: Storage } = {},
): Promise<void> {
  await storage.set(opts);
}
