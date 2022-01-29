import { filter } from "./iters";

test("filter()", () => {
  const [first, second] = [...filter([true, false], (v) => v)];
  expect(first).toBe(true);
  expect(second).toBeUndefined();
});
