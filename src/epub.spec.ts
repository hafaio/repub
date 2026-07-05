import { expect, test } from "bun:test";
import JSZip from "jszip";
import { epub } from "./epub";

async function sectionXhtml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const name = Object.keys(zip.files).find((file) =>
    file.endsWith("section_0.xhtml"),
  );
  if (!name) throw new Error("no section in generated epub");
  return await zip.files[name]!.async("string");
}

test("epub() keeps escaped markup in article text as text", async () => {
  // XMLSerializer output for a paragraph whose literal text is
  // `<div>x</div> & more`; the entities are already escaped once.
  const content = "<p>&lt;div&gt;x&lt;/div&gt; &amp; more</p>";
  const xhtml = await sectionXhtml(
    await epub({ title: "t", content, images: new Map(), css: undefined }),
  );
  // the `<div>` must survive as text, not be revived into a real element
  expect(xhtml).toContain("&lt;div>x&lt;/div>");
  expect(xhtml).not.toContain("<div>x</div>");
});
