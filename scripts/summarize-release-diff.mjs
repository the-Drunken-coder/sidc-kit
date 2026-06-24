import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const tagName = process.env.RELEASE_TAG_NAME;
const openCodeApiKey = process.env.OPENCODE_API_KEY;
const model = process.env.OPENCODE_MODEL || "opencode/kimi-k2.6";
const contextPath = ".release-diff-context.md";
const outputPath = "opencode-release-summary.md";
const maxPatchBytes = 120_000;

if (!tagName) {
  console.error("No release tag was provided; cannot generate OpenCode release summary.");
  process.exit(1);
}

if (!openCodeApiKey) {
  console.error("OPENCODE_API_KEY is not configured; cannot generate OpenCode release summary.");
  process.exit(1);
}

/**
 * Runs a git command and returns trimmed stdout.
 */
function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Runs a git command that may validly fail for first-release history.
 */
function optionalGit(args) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

const previousTag = optionalGit(["describe", "--tags", "--abbrev=0", `${tagName}^`]);
const baseRef = previousTag || git(["rev-list", "--max-parents=0", tagName]);
const range = `${baseRef}..${tagName}`;
const diffStat = optionalGit(["diff", "--stat", range]);
const nameStatus = optionalGit(["diff", "--name-status", range]);
const commits = optionalGit(["log", "--oneline", "--no-decorate", range]);
const patch = optionalGit(["diff", "--no-ext-diff", "--unified=40", range, "--", ".", ":(exclude)package-lock.json"]);
const truncatedPatch =
  Buffer.byteLength(patch, "utf8") > maxPatchBytes
    ? `${Buffer.from(patch).subarray(0, maxPatchBytes).toString("utf8")}\n\n[Diff truncated at ${maxPatchBytes} bytes.]`
    : patch;

writeFileSync(
  contextPath,
  [
    `# Release Diff Context`,
    ``,
    `Current tag: ${tagName}`,
    `Previous tag: ${previousTag || "(none; comparing from initial commit)"}`,
    `Compared range: ${range}`,
    ``,
    `## Commits`,
    commits || "(none)",
    ``,
    `## Changed Files`,
    nameStatus || "(none)",
    ``,
    `## Diff Stat`,
    diffStat || "(none)",
    ``,
    `## Patch`,
    "```diff",
    truncatedPatch || "(none)",
    "```",
    ""
  ].join("\n")
);

const prompt = [
  "Summarize this release diff for maintainers and npm users.",
  "Use concise Markdown.",
  "Focus on user-visible changes, migration notes, packaging changes, and risks.",
  "Do not invent changes that are not supported by the attached diff context.",
  "Do not include secrets, token values, or operational speculation.",
  "Return only the summary body."
].join(" ");

const result = spawnSync(
  "npx",
  ["-y", "opencode-ai@1.17.9", "run", prompt, "--pure", "--model", model, "--file", contextPath],
  {
    encoding: "utf8",
    env: process.env,
    killSignal: "SIGTERM",
    timeout: 120_000
  }
);

if (result.error?.code === "ETIMEDOUT") {
  console.error("OpenCode summary generation timed out.");
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "OpenCode summary generation failed.");
  process.exit(result.status ?? 1);
}

const summary = result.stdout.trim();
if (!summary) {
  console.error("OpenCode returned an empty summary.");
  process.exit(1);
}

writeFileSync(outputPath, `${summary}\n`);
console.log(`Wrote OpenCode release summary to ${outputPath}.`);
