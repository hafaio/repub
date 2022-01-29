import { alter } from "./alter";

async function* toAsyncIterable<T>(
  iter: Iterable<T>
): AsyncIterableIterator<T> {
  yield* iter;
}

test("noop", async () => {
  const content = `<img alt="noop" src="test.png">`;
  const { altered, images } = await alter(
    content,
    toAsyncIterable([
      {
        href: "test.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe(content);
  const [image] = images;
  expect(image?.href).toBe("test.png");
});

test("strips", async () => {
  const content = `<img alt="noop" src="test.png">`;
  const { altered, images } = await alter(
    content,
    toAsyncIterable([
      {
        href: "test.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "strip", filterLinks: false }
  );
  expect(altered).toBe("");
  expect(images).toHaveLength(0);
});

test("filters", async () => {
  const content = `<img alt="noop" src="test.png"><img src="test.png">`;
  const { altered, images } = await alter(
    content,
    toAsyncIterable([
      {
        href: "test.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "filter", filterLinks: false }
  );
  expect(altered).toBe(`<img alt="noop" src="test.png">`);
  const [image] = images;
  expect(image?.href).toBe("test.png");
});

test("srcset remapping", async () => {
  const { altered, images } = await alter(
    `<img src="missing.png" srcset="small.png 600w, medium.png 1024w, large.png 2048w">`,
    toAsyncIterable([
      {
        href: "medium.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe(
    `<img src="medium.png" srcset="small.png 600w, medium.png 1024w, large.png 2048w">`
  );
  const [image] = images;
  expect(image?.href).toBe("medium.png");
});

test("srcset remapping no src", async () => {
  const { altered, images } = await alter(
    `<img srcset="small.png 600w, medium.png 1024w, large.png 2048w">`,
    toAsyncIterable([
      {
        href: "large.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe(
    `<img srcset="small.png 600w, medium.png 1024w, large.png 2048w" src="large.png">`
  );
  const [image] = images;
  expect(image?.href).toBe("large.png");
});

test("invlaid srcset", async () => {
  const { altered } = await alter(`<img srcset="">`, toAsyncIterable([]), {
    imageHandling: "keep",
    filterLinks: false,
  });
  expect(altered).toBe("");
});

test("filters missing images", async () => {
  const { altered } = await alter(
    `<img src="small.png">`,
    toAsyncIterable([
      {
        href: "small.png",
        content: new Uint8Array(0),
        contentType: "text/html", // not an image
      },
    ]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe("");
});

test("picture removing", async () => {
  const { altered } = await alter(
    `<picture><!--comment--><img src="missing.png"></picture>`,
    toAsyncIterable([]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe("");
});

test("picture stripping", async () => {
  const { altered } = await alter(
    `<picture><img src="large.png"></picture>`,
    toAsyncIterable([
      {
        href: "large.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "strip", filterLinks: false }
  );
  expect(altered).toBe("");
});

test("picture filtering", async () => {
  const { altered, images } = await alter(
    `<img src="large.png"><picture><img alt="inner" src="large.png"></picture>`,
    toAsyncIterable([
      {
        href: "large.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "filter", filterLinks: false }
  );
  expect(altered).toBe(`<img src="large.png">`);
  const [image] = images;
  expect(image?.href).toBe("large.png");
});

test("picture invalid", async () => {
  const { altered } = await alter(
    `<picture><source srcset="large.png 2048w"></picture>`,
    toAsyncIterable([
      {
        href: "large.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe("");
});

test("picture remapping", async () => {
  const { altered, images } = await alter(
    `<picture>
      <source srcset="small.png 600w, medium.png 1024w, large.png 2048w">
      <img src="missing.png">
    </picture>`,
    toAsyncIterable([
      {
        href: "large.png",
        content: new Uint8Array(0),
        contentType: "image/png",
      },
    ]),
    { imageHandling: "keep", filterLinks: false }
  );
  expect(altered).toBe(`<img src="large.png">`);
  const [image] = images;
  expect(image?.href).toBe("large.png");
});

test("link filtering", async () => {
  const { altered } = await alter(
    `<p>here is a <a href="#">link</a> for you</p>`,
    toAsyncIterable([]),
    { imageHandling: "keep", filterLinks: true }
  );
  expect(altered).toBe(`<p>here is a link for you</p>`);
});

test("link filtering", async () => {
  const { altered } = await alter(
    `<p>here is a <a href="#">link</a> for you</p>`,
    toAsyncIterable([]),
    { imageHandling: "keep", filterLinks: true }
  );
  expect(altered).toBe(`<p>here is a link for you</p>`);
});
