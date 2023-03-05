use repub::{EpubVersion, FilterType, ImageHandling, ImageOutputFormat, Repub};
use std::str;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
pub struct Epub {
    pub epub: Box<[u8]>,
    pub title: Option<String>,
}

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen]
pub fn render(
    mhtml: &[u8],
    image_handling: &str,
    href_sim_thresh: f64,
    image_brightness: f64,
    filter_links: bool,
    css: &str,
    href_header: bool,
    byline_header: bool,
    cover_header: bool,
) -> Result<Epub, String> {
    let image_handling = match image_handling {
        "strip" => Ok(ImageHandling::Strip),
        "filter" => Ok(ImageHandling::Filter),
        "keep" => Ok(ImageHandling::Keep),
        _ => Err("invalid image handling"),
    }?;
    let repub = Repub {
        include_url: href_header,
        include_title: true,
        include_byline: byline_header,
        include_cover: cover_header,
        strip_links: filter_links,
        href_sim_thresh,
        image_handling,
        image_format: ImageOutputFormat::Jpeg(90),
        css,
        max_width: 1404,
        max_height: 1872,
        filter_type: FilterType::Triangle,
        brighten: image_brightness as f32,
        epub_version: EpubVersion::V30,
    };
    let mhtml_str = str::from_utf8(mhtml).map_err(|_| "invalid utf8")?;
    let mut res = Vec::new();
    let title = repub
        .mhtml_to_epub(mhtml_str, &mut res)
        .map_err(|error| format!("{error}"))?;
    Ok(Epub {
        epub: res.into(),
        title,
    })
}
