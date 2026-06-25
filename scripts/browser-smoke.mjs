import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as esbuild from "esbuild";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokeDir = path.join(repoRoot, ".tmp", "browser-smoke");
const entryPath = path.join(smokeDir, "entry.mjs");
const bundlePath = path.join(smokeDir, "bundle.mjs");
const expectedSidc = "130310001412110000000000000000";

const entrySource = `
import { renderSymbol, searchSymbols } from "sidc-kit";

const expectedSidc = ${JSON.stringify(expectedSidc)};
const results = searchSymbols("friendly infantry platoon");
if (results[0]?.sidc !== expectedSidc) {
  throw new Error("searchSymbols did not return the expected infantry platoon SIDC.");
}

const rendered = renderSymbol(expectedSidc, { size: 40 });
if (rendered.sidc !== expectedSidc || !rendered.svg.startsWith("<svg") || !rendered.svg.endsWith("</svg>")) {
  throw new Error("renderSymbol did not return a valid SVG payload.");
}

export const smokeResult = {
  sidc: rendered.sidc,
  searchCount: results.length,
  svgLength: rendered.svg.length
};
`;

await rm(smokeDir, { recursive: true, force: true });
await mkdir(smokeDir, { recursive: true });

try {
  await writeFile(entryPath, entrySource);

  await esbuild.build({
    absWorkingDir: repoRoot,
    bundle: true,
    entryPoints: [entryPath],
    format: "esm",
    logLevel: "silent",
    outfile: bundlePath,
    platform: "browser",
    target: "es2022"
  });

  const { smokeResult } = await import(pathToFileURL(bundlePath).href);
  if (smokeResult?.sidc !== expectedSidc || smokeResult.searchCount < 1 || smokeResult.svgLength < 100) {
    throw new Error("Bundled browser smoke result was incomplete.");
  }

  const bundleStats = await stat(bundlePath);
  console.log(
    `Browser bundle smoke passed: esbuild platform=browser defaults bundled ${bundleStats.size} bytes and exercised renderSymbol/searchSymbols.`
  );
} finally {
  await rm(smokeDir, { recursive: true, force: true });
}
