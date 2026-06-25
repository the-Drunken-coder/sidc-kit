import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(rootDir, "dist", "cli.js");
const infantryPlatoonSidc = "130310001412110000000000000000";

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: rootDir,
    encoding: "utf8"
  });
}

test("CLI searches curated symbols with plain text output", () => {
  const result = runCli(["search", "friendly", "infantry", "platoon", "--limit", "1"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, new RegExp(`^${infantryPlatoonSidc}\\tFriendly Land Unit Infantry Platoon\\tscore=\\d+\\n$`));
});

test("CLI explains a curated SIDC as JSON", () => {
  const result = runCli(["explain", infantryPlatoonSidc, "--json"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.sidc, infantryPlatoonSidc);
  assert.equal(parsed.name, "Friendly Land Unit Infantry Platoon");
  assert.equal(parsed.parts.echelon, "platoon");
});

test("CLI builds a curated SIDC from structured options", () => {
  const result = runCli([
    "build",
    "--affiliation",
    "friend",
    "--domain",
    "land",
    "--entity",
    "infantry",
    "--echelon",
    "platoon"
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `${infantryPlatoonSidc}\n`);
});

test("CLI renders SVG to stdout by default", () => {
  const result = runCli(["render", infantryPlatoonSidc, "--size", "32"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^<svg[\s\S]*<\/svg>\n$/);
});

test("CLI returns usage failures with exit code 2", () => {
  const result = runCli(["build", "--affiliation", "friend", "--domain", "land"]);

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^USAGE_ERROR: --entity is required\.\n$/);
});

test("CLI returns typed API failures as JSON when requested", () => {
  const result = runCli(["explain", "not-a-sidc", "--json"]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");

  const parsed = JSON.parse(result.stderr);
  assert.equal(parsed.error.code, "INVALID_SIDC");
  assert.match(parsed.error.message, /30 digits/);
});
