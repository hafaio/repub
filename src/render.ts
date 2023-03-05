import { default as init, Epub, render as rend } from "../pkg/repub_bind";

const ini = (async () => await init())();

export async function render(
  mhtml: Uint8Array,
  image_handling: string,
  href_sim_thresh: number,
  image_brightness: number,
  filter_links: boolean,
  css: string,
  href_header: boolean,
  byline_header: boolean,
  cover_header: boolean
): Promise<Epub> {
  await ini;
  return rend(
    mhtml,
    image_handling,
    href_sim_thresh,
    image_brightness,
    filter_links,
    css,
    href_header,
    byline_header,
    cover_header
  );
}
