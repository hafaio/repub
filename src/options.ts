import { JTDSchemaType as JtdSchema } from "ajv/dist/jtd";
import { validate } from "jtd";
import { TextAlignment } from "rmapi-js/dist";

export type { TextAlignment };

type Awaitable<T> = T | Promise<T>;

export interface Storage {
  set(vals: Readonly<Record<string, unknown>>): Awaitable<void>;
  get<K extends string>(
    keys: Readonly<Record<K, unknown>>
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
    keys: Readonly<Record<K, unknown>>
  ): Record<K, unknown> {
    return Object.fromEntries(
      Object.entries(keys).map(([key, def]) => {
        const val = globalThis.localStorage.getItem(key);
        return [key, val === null ? def : JSON.parse(val)];
      })
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

export interface Options {
  deviceToken: string;
  outputStyle: OutputStyle;
  // how we generate the epub
  summarizeCharThreshold: number;
  imageHandling: ImageHandling;
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

const optionsSchema: JtdSchema<Partial<Options>> = {
  optionalProperties: {
    deviceToken: { type: "string" },
    outputStyle: { enum: ["upload", "download"] },
    // how we generate the epub
    summarizeCharThreshold: { type: "int32" },
    imageHandling: { enum: ["strip", "filter", "keep"] },
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
  additionalProperties: true,
};

export const defaultOptions: Options = {
  deviceToken: "",
  outputStyle: "upload",
  // how we generate the epub
  summarizeCharThreshold: 500,
  imageHandling: "filter",
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

export async function getOptions(
  // istanbul ignore next
  {
    storage = globalThis.chrome?.storage?.local ?? mockStorage,
  }: { storage?: Storage } = {}
): Promise<Options> {
  const loaded = await storage.get(defaultOptions);

  // get initial errors and remove corrupted entries
  const initErrors = validate(optionsSchema, loaded);
  for (const {
    instancePath: [key],
  } of initErrors) {
    delete loaded[key as keyof Options];
  }

  const errors = validate(optionsSchema, loaded);
  // the else should never happen
  // istanbul ignore if
  if (errors.length) {
    return defaultOptions;
  } else {
    // validate ensures there's no unknowns in loaded, but TS cann't seem to
    // validate that even with exact optional property types. Not sure why
    // because this works in the playground
    return { ...defaultOptions, ...loaded } as Options;
  }
}

export interface SetOptions {
  (options: Partial<Options>): void;
}

export async function setOptions(
  opts: Partial<Options>,
  // istanbul ignore next
  {
    storage = globalThis.chrome?.storage?.local ?? mockStorage,
  }: { storage?: Storage } = {}
): Promise<void> {
  await storage.set(opts);
}
