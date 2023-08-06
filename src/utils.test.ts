import { performance } from "node:perf_hooks";
import { assert, errString, safeFilename, sleep, timeout } from "./utils";

test("sleep()", async () => {
  const first = performance.now();
  await sleep(10);
  const expected = performance.now() - first;

  const second = performance.now();
  await Promise.all([sleep(10), sleep(10)]);
  const actual = performance.now() - second;
  expect(Math.abs(expected - actual)).toBeLessThan(Math.max(expected, actual));
});

test("timeout()", async () => {
  expect(await timeout(sleep(1), 10)).toBeUndefined();
  await expect(timeout(sleep(10), 1)).rejects.toThrow("timeout");
});

test("safeFilename()", () => {
  expect(safeFilename("simple.png")).toBe("simple.png");
  expect(safeFilename("L.A. info.png")).toBe("L.A. info.png");
  expect(
    safeFilename("KI: Führen uns Algorithmen ins posttheoretische Zeitalter?"),
  ).toBe("KI_ F%C3%BChren uns Algorithmen ins posttheoretische Zeitalter_");
});

test("assert()", () => {
  assert(true);
  expect(() => assert(false)).toThrow("internal error");
  expect(() => assert(false, "custom")).toThrow("custom");
});

test("errString()", () => {
  expect(errString("err")).toBe("err");
  expect(errString(null)).toBe("null error");
  expect(errString(undefined)).toBe("undefined error");
  expect(errString(() => undefined)).toBe("function error: ");
  expect(errString(new Error("custom error"))).toBe("Error: custom error");
  expect(errString({})).toBe("unknown object error");
});
