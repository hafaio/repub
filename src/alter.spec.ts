import { expect, test } from "bun:test";
import { resolveByline } from "./alter";

test("resolveByline() drops a byline that repeats the declared authors", () => {
  const author =
    "Ann Alpha, Ben Bravo, Cara Charlie, Dan Delta, Eve Echo, Fay Foxtrot, Gil Golf, Hal Hotel";
  const byline =
    "Ann Alpha,Ben Bravo,Cara Charlie,Dan Delta,Eve Echo,Fay Foxtrot,Gil Golf,Hal Hotel";
  expect(resolveByline(author, byline)).toBe(author);
});

test("resolveByline() keeps authors only the byline names", () => {
  expect(resolveByline("Jane Doe", "Jane Doe, Bob Roe")).toBe(
    "Jane Doe. Bob Roe",
  );
  expect(resolveByline("Jane Doe, Bob Roe", "Jane Doe, Bob Roe, Sue Lin")).toBe(
    "Jane Doe, Bob Roe. Sue Lin",
  );
});

test("resolveByline() matches names regardless of case or spacing", () => {
  expect(resolveByline("Jane Doe", "JANE  DOE, Bob Roe")).toBe(
    "Jane Doe. Bob Roe",
  );
});

test("resolveByline() keeps an unrelated byline whole", () => {
  expect(resolveByline("Jane Doe", "Bob Roe")).toBe("Jane Doe. Bob Roe");
});

test("resolveByline() never splits the byline itself", () => {
  expect(resolveByline("Jane Doe", "Jane Doe, staff writer")).toBe(
    "Jane Doe. staff writer",
  );
  expect(resolveByline(null, "Doe, Jane")).toBe("Doe, Jane");
});

test("resolveByline() removes longer names before their substrings", () => {
  expect(
    resolveByline("Jane Doe, Jane Doe Smith", "Jane Doe Smith, Bob Roe"),
  ).toBe("Jane Doe, Jane Doe Smith. Bob Roe");
});

test("resolveByline() escapes regex characters in names", () => {
  expect(resolveByline("A. B. Smith Jr.", "A. B. Smith Jr., Bob Roe")).toBe(
    "A. B. Smith Jr.. Bob Roe",
  );
});

test("resolveByline() tidies leftover whitespace and commas", () => {
  expect(resolveByline("Jane Doe", "Jane  Doe ,, , Bob Roe ,")).toBe(
    "Jane Doe. Bob Roe",
  );
});

test("resolveByline() falls back to whichever source exists", () => {
  expect(resolveByline("Jane Doe", undefined)).toBe("Jane Doe");
  expect(resolveByline(null, "Bob Roe")).toBe("Bob Roe");
  expect(resolveByline(null, undefined)).toBeUndefined();
});
