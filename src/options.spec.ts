import { expect, test } from "bun:test";
import { Storage, defaultOptions, getOptions, setOptions } from "./options";

class MapStorage implements Storage {
  #backing = new Map<string, string>();

  set(vals: Readonly<Record<string, unknown>>): void {
    for (const [k, v] of Object.entries(vals)) {
      this.#backing.set(k, JSON.stringify(v));
    }
  }

  get<K extends string>(
    keys: Readonly<Record<K, unknown>>,
  ): Record<K, unknown> {
    return Object.fromEntries(
      Object.entries(keys).map(([key, def]) => {
        const val = this.#backing.get(key);
        return [key, val ? JSON.parse(val) : def];
      }),
    ) as Record<K, unknown>;
  }

  remove(keys: string[]): void {
    for (const key of keys) {
      this.#backing.delete(key);
    }
  }
}

test("basic", async () => {
  const storage = new MapStorage();

  // default works
  const opts = await getOptions({ storage });
  expect(opts).toEqual({ ...defaultOptions, outputStyle: "download" });

  // updating works
  await setOptions({ deviceToken: "test", margins: 3 }, { storage });
  const newOpts = await getOptions({ storage });
  expect(newOpts).toEqual({
    ...defaultOptions,
    deviceToken: "test",
    margins: 3,
    outputStyle: "download",
  });
});
