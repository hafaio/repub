// This allows the assets to be reached by chrome
const isProd = process.env.NODE_ENV === "production";
export const assetPrefix = isProd ? "/out" : "/";
export const images = { loader: "custom" };
export const experimental = { forceSwcTransforms: true };
export const output = "export";
