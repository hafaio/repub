import { alter } from "./alter";

/** generate content that will pass through readability */
function wrap(elements: string, title: string = "Title"): string {
  return `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
    </head>
    <body>
      <p>Irure Lorem sit minim velit veniam do amet ut laboris. Ut veniam nulla minim sunt. Ut non nisi et veniam consequat dolor enim consequat enim ex laborum laborum exercitation. Ullamco exercitation commodo officia incididunt nostrud in deserunt.</p>
      ${elements}
      <p>Ea ad reprehenderit in mollit est ipsum elit. Dolore dolor quis proident excepteur nulla nulla elit aute. Irure duis esse deserunt exercitation minim magna eu cupidatat adipisicing mollit nisi nostrud dolor. Dolor consequat eu est ea consectetur magna enim ea id elit aliquip duis do. Et ad fugiat id sunt cupidatat ex excepteur amet duis laborum tempor proident eiusmod occaecat. Magna ea minim consequat aliqua cupidatat deserunt eiusmod. Ipsum veniam sunt anim officia est.</p>
    </body>
  </html>
  `;
}

const opts = {
  imageHandling: "keep",
  filterLinks: false,
  summarizeCharThreshold: 0,
} as const;

test("noop", async () => {
  const content = `<img id="important" alt="noop" src="test.png"/>`;
  const { altered, seen } = await alter(
    wrap(content),
    new Set(["test.png"]),
    opts
  );
  expect(altered).toContain(content);
  const [image] = seen;
  expect(image).toBe("test.png");
});

test("strips", async () => {
  const content = `<img alt="noop" src="test.png">`;
  const { altered, seen } = await alter(wrap(content), new Set(["test.png"]), {
    ...opts,
    imageHandling: "strip",
  });
  expect(altered).not.toContain("img");
  expect(seen.size).toBe(0);
});

test("filters", async () => {
  const content = `<img alt="noop" src="test.png"><img alt="filter" src="test.png">`;
  const { altered, seen } = await alter(wrap(content), new Set(["test.png"]), {
    ...opts,
    imageHandling: "filter",
  });
  expect(altered).toContain(`<img alt="noop"`);
  expect(altered).not.toContain(`<img alt="filter"`);
  const [image] = seen;
  expect(image).toBe("test.png");
});

test("srcset remapping", async () => {
  const content = `<img src="missing.png" srcset="small.png 600w, medium.png 1024w, large.png 2048w">`;
  const { altered, seen } = await alter(
    wrap(content),
    new Set(["medium.png"]),
    opts
  );
  expect(altered).toContain(
    `<img src="medium.png" srcset="small.png 600w, medium.png 1024w, large.png 2048w"/>`
  );
  const [image] = seen;
  expect(image).toBe("medium.png");
});

test("srcset remapping no src", async () => {
  const content = `<img srcset="small.png 600w, medium.png 1024w, large.png 2048w">`;
  const { altered, seen } = await alter(
    wrap(content),
    new Set(["large.png"]),
    opts
  );
  expect(altered).toContain(
    `<img srcset="small.png 600w, medium.png 1024w, large.png 2048w" src="large.png"/>`
  );
  const [image] = seen;
  expect(image).toBe("large.png");
});

test("invlaid srcset", async () => {
  const { altered } = await alter(wrap(`<img srcset="">`), new Set(), opts);
  expect(altered).not.toContain("img");
});

test("picture removing", async () => {
  const { altered } = await alter(
    wrap(`<picture><!--comment--><img src="missing.png"></picture>`),
    new Set(),
    opts
  );
  expect(altered).not.toContain("picture");
  expect(altered).not.toContain("img");
  expect(altered).not.toContain("comment");
});

test("picture stripping", async () => {
  const { altered } = await alter(
    wrap(`<picture><img src="large.png"></picture>`),
    new Set(["large.png"]),
    { ...opts, imageHandling: "strip" }
  );
  expect(altered).not.toContain("img");
  expect(altered).not.toContain("picture");
});

test("picture filtering", async () => {
  const { altered, seen } = await alter(
    wrap(
      `<img src="large.png"><picture><img alt="inner" src="large.png"></picture>`
    ),
    new Set(["large.png"]),
    { ...opts, imageHandling: "filter" }
  );
  expect(altered).toContain(`<img src="large.png"/>`);
  expect(altered).not.toContain("picture");
  const [image] = seen;
  expect(image).toBe("large.png");
});

test("picture invalid", async () => {
  const { altered } = await alter(
    wrap(`<picture><source srcset="large.png 2048w"></picture>`),
    new Set(["large.png"]),
    opts
  );
  expect(altered).not.toContain("picture");
  expect(altered).not.toContain("source");
});

test("picture remapping", async () => {
  const { altered, seen } = await alter(
    wrap(`<picture>
      <source srcset="small.png 600w, medium.png 1024w, large.png 2048w">
      <img src="missing.png">
    </picture>`),
    new Set(["large.png"]),
    opts
  );
  expect(altered).toContain(`<img src="large.png"/>`);
  expect(altered).not.toContain("picture");
  expect(altered).not.toContain("source");
  const [image] = seen;
  expect(image).toBe("large.png");
});

test("link filtering", async () => {
  const { altered } = await alter(
    wrap(`<p>here is a <a href="#">link</a> for you</p>`),
    new Set(),
    { ...opts, filterLinks: true }
  );
  expect(altered).toContain(`<p>here is a link for you</p>`);
});

test("parse failure", async () => {
  await expect(
    alter(`<!doctype html><html></html>`, new Set(), { ...opts })
  ).rejects.toThrow("failed to summarize document");
});
