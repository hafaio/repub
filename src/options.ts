import { TextAlignment } from "rmapi-js/dist";
import { JtdSchema, validate } from "./validate";

export type { TextAlignment };

const mockStorage = {
  async set(vals: Readonly<Record<string, unknown>>): Promise<void> {
    for (const [key, val] of Object.entries(vals)) {
      globalThis.localStorage.setItem(key, JSON.stringify(val));
    }
  },
  async get<K extends string>(
    keys: Readonly<Record<K, unknown>>
  ): Promise<Record<K, unknown>> {
    return Object.fromEntries(
      Object.entries(keys).map(([key, def]) => {
        const val = globalThis.localStorage.getItem(key);
        return [key, val === null ? def : JSON.parse(val)];
      })
    ) as Record<K, unknown>;
  },
  async remove(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      globalThis.localStorage.removeItem(key);
    }
  },
};

const storage = globalThis.chrome?.storage?.local ?? mockStorage;

export type OutputStyle = "upload" | "download";
export type ImageHandling = "strip" | "filter" | "keep";
export type ImageSize = "original" | "large" | "small";
export type ImageFormat = "image/png" | "image/jpeg";
export type Orientation = "portrait" | "landscape";
export type Cover = "first" | "visited";

export interface Options {
  deviceToken: string;
  outputStyle: OutputStyle;
  // how we generate the epub
  summarizeCharThreshold: number;
  imageHandling: ImageHandling;
  imageSize: number[] | null;
  imageFormat: ImageFormat;
  hrefHeader: boolean;
  rmCss: boolean;
  filterLinks: boolean;
  // how we upload the epub
  margins: number;
  lineHeight: number;
  textScale: number;
  textAlignment: TextAlignment;
  cover: Cover;
  fontName: string;
}

const optionsSchema: JtdSchema<Options> = {
  properties: {
    deviceToken: { type: "string" },
    outputStyle: { enum: ["upload", "download"] },
    // how we generate the epub
    summarizeCharThreshold: { type: "int32" },
    imageHandling: { enum: ["strip", "filter", "keep"] },
    imageSize: { elements: { type: "int32" }, nullable: true },
    imageFormat: { enum: ["image/png", "image/jpeg"] },
    hrefHeader: { type: "boolean" },
    rmCss: { type: "boolean" },
    filterLinks: { type: "boolean" },
    // how we upload the epub
    margins: { type: "int32" },
    lineHeight: { type: "int32" },
    textScale: { type: "float64" },
    textAlignment: { enum: ["left", "justify"] },
    cover: { enum: ["first", "visited"] },
    fontName: { type: "string" },
  },
};

export const defaultOptions: Options = {
  deviceToken: "",
  outputStyle: "upload",
  // how we generate the epub
  summarizeCharThreshold: 500,
  imageHandling: "filter",
  imageSize: [1404, 1872],
  imageFormat: "image/jpeg",
  hrefHeader: false,
  rmCss: true,
  filterLinks: true,
  // how we upload the epub
  margins: 180,
  lineHeight: 100,
  textScale: 1,
  textAlignment: "justify",
  cover: "visited",
  fontName: "",
};

export async function getOptions({
  fail = true,
}: { fail?: boolean } = {}): Promise<Options> {
  const loaded = await storage.get(defaultOptions);
  try {
    validate(optionsSchema, loaded);
    return loaded;
  } catch (ex) {
    if (fail) {
      throw ex;
    } else {
      return defaultOptions;
    }
  }
}

export interface SetOptions {
  (options: Partial<Options>): void;
}

export async function setOptions(opts: Partial<Options>): Promise<void> {
  await storage.set(opts);
}
