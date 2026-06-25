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

test("CLI module import does not execute the command runner", async () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  const originalStderrWrite = process.stderr.write;
  let stderr = "";

  try {
    process.argv = [process.execPath, "--test"];
    process.exitCode = undefined;
    process.stderr.write = (chunk, ...args) => {
      stderr += String(chunk);
      const callback = args.find((arg) => typeof arg === "function");
      if (callback) {
        callback();
      }
      return true;
    };

    await import(`${new URL("../dist/cli.js", import.meta.url).href}?import-side-effect=${Date.now()}`);

    assert.equal(process.exitCode, undefined);
    assert.equal(stderr, "");
  } finally {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    process.stderr.write = originalStderrWrite;
  }
});

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

test("CLI ignores --json after the positional terminator", () => {
  const result = runCli(["explain", "--", "--json"]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^INVALID_SIDC: SIDC must be exactly 30 digits\.\n$/);
  assert.throws(() => JSON.parse(result.stderr), SyntaxError);
});

test("CLI gives consistent diagnostics for separated negative numeric values", () => {
  const separated = runCli(["search", "infantry", "--limit", "-1"]);
  const inline = runCli(["search", "infantry", "--limit=-1"]);

  assert.equal(separated.status, 2);
  assert.equal(inline.status, 2);
  assert.equal(separated.stdout, "");
  assert.equal(inline.stdout, "");
  assert.equal(separated.stderr, inline.stderr);
  assert.match(separated.stderr, /^USAGE_ERROR: --limit must be a non-negative integer\.\n$/);
});

test("CLI rejects unsafe and oversized integer values", () => {
  const unsafe = runCli(["render", infantryPlatoonSidc, "--size", "999999999999999999999999999999"]);
  const oversized = runCli(["render", infantryPlatoonSidc, "--size", "4097"]);

  assert.equal(unsafe.status, 2);
  assert.equal(unsafe.stdout, "");
  assert.match(unsafe.stderr, /^USAGE_ERROR: --size must be a safe integer\.\n$/);

  assert.equal(oversized.status, 2);
  assert.equal(oversized.stdout, "");
  assert.match(oversized.stderr, /^USAGE_ERROR: --size must be no greater than 4096\.\n$/);
});
