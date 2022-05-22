/* eslint no-console: off */
import { pnpPlugin } from "@yarnpkg/esbuild-plugin-pnp";
import chalk from "chalk";
import { build } from "esbuild";
import ignorePlugin from "esbuild-plugin-ignore";
import { stat } from "node:fs/promises";
import { parse } from "node:path";
import { performance } from "perf_hooks";

const start = performance.now();

async function wrapper(options) {
  const res = await build(options);
  const { outfile } = options;
  const { size } = await stat(outfile);
  const { dir, base } = parse(outfile);
  console.log(
    chalk.white(`\n  ${dir}/`) + chalk.bold(`${base}`),
    chalk.cyan(` ${(size / 1024).toFixed(1)}kb`)
  );
  return res;
}

const config = {
  plugins: [
    ignorePlugin([
      { resourceRegExp: /^util$/ },
      { resourceRegExp: /^buffer$/ },
      { resourceRegExp: /^stream$/ },
      { resourceRegExp: /^events$/ },
    ]),
    pnpPlugin(),
  ],
  bundle: true,
  minify: true,
};

await Promise.all([
  // debug script
  wrapper({
    ...config,
    format: "esm",
    platform: "node",
    entryPoints: ["src/debug.ts"],
    outfile: "scripts/debug.mjs",
  }),
  // background script
  wrapper({
    ...config,
    entryPoints: ["src/background.ts"],
    outfile: "background.js",
  }),
]);

const elapsed = Math.round(performance.now() - start);
console.log("\n⚡", chalk.green(`Done in ${elapsed}ms`));
