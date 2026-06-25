#!/usr/bin/env node
import {
  SidcKitError,
  buildSidc,
  explainSidc,
  renderSymbol,
  searchSymbols,
  type BuildSidcInput,
  type RenderSymbolOptions
} from "./index.js";

type OptionSpec = {
  kind: "flag" | "value";
};

type ParsedArgs = {
  positionals: string[];
  options: Map<string, string | true>;
};

class UsageError extends Error {
  readonly code = "USAGE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

const commonOptions = {
  help: { kind: "flag" },
  json: { kind: "flag" }
} satisfies Record<string, OptionSpec>;

const helpText = `Usage:
  sidc-kit search <query...> [--limit <n>] [--json]
  sidc-kit explain <sidc> [--json]
  sidc-kit render <sidc> [--size <px>] [--fill|--no-fill] [--frame|--no-frame] [--json]
  sidc-kit build --affiliation <value> --domain <value> --entity <value> [--entity-type <value>] [--entity-subtype <value>] [--echelon <value>] [--json]

Commands:
  search    Search curated symbols by plain-language terms.
  explain   Explain a curated SIDC into structured parts.
  render    Render any milsymbol-supported 30-digit SIDC to SVG.
  build     Build a curated SIDC from structured parts.
`;

export function run(argv: readonly string[]): number {
  const wantsJson = argv.includes("--json");

  try {
    if (argv.length === 0) {
      throw new UsageError("Missing command. Run sidc-kit --help for usage.");
    }

    const [command, ...rest] = argv;
    if (command === "--help" || command === "-h") {
      writeOutput(helpText);
      return 0;
    }

    switch (command) {
      case "search":
        return runSearch(rest);
      case "explain":
        return runExplain(rest);
      case "render":
        return runRender(rest);
      case "build":
        return runBuild(rest);
      default:
        throw new UsageError(`Unknown command: ${command}`);
    }
  } catch (error) {
    reportError(error, wantsJson);
    return error instanceof UsageError ? 2 : 1;
  }
}

function runSearch(args: readonly string[]): number {
  const parsed = parseArgs(args, {
    ...commonOptions,
    limit: { kind: "value" }
  });
  if (hasFlag(parsed, "help")) {
    writeOutput("Usage: sidc-kit search <query...> [--limit <n>] [--json]\n");
    return 0;
  }
  if (parsed.positionals.length === 0) {
    throw new UsageError("search requires one or more query terms.");
  }

  const limitValue = getOptionalValue(parsed, "limit");
  const results = searchSymbols(parsed.positionals.join(" "), {
    ...(limitValue === undefined ? {} : { limit: parseNonNegativeInteger(limitValue, "limit") })
  });

  if (hasFlag(parsed, "json")) {
    writeJson(results);
    return 0;
  }

  writeOutput(results.map((result) => `${result.sidc}\t${result.name}\tscore=${result.score}`).join("\n"));
  if (results.length > 0) {
    writeOutput("\n");
  }
  return 0;
}

function runExplain(args: readonly string[]): number {
  const parsed = parseArgs(args, commonOptions);
  if (hasFlag(parsed, "help")) {
    writeOutput("Usage: sidc-kit explain <sidc> [--json]\n");
    return 0;
  }
  if (parsed.positionals.length !== 1) {
    throw new UsageError("explain requires exactly one SIDC.");
  }

  const result = explainSidc(parsed.positionals[0]);
  if (hasFlag(parsed, "json")) {
    writeJson(result);
    return 0;
  }

  writeOutput(`${result.name}\n`);
  writeOutput(`SIDC: ${result.sidc}\n`);
  writeOutput(`Coverage: ${result.coverage}\n`);
  writeOutput("Parts:\n");
  for (const [key, value] of Object.entries(result.parts)) {
    writeOutput(`  ${key}: ${value}\n`);
  }
  return 0;
}

function runRender(args: readonly string[]): number {
  const parsed = parseArgs(args, {
    ...commonOptions,
    fill: { kind: "flag" },
    frame: { kind: "flag" },
    "no-fill": { kind: "flag" },
    "no-frame": { kind: "flag" },
    size: { kind: "value" }
  });
  if (hasFlag(parsed, "help")) {
    writeOutput("Usage: sidc-kit render <sidc> [--size <px>] [--fill|--no-fill] [--frame|--no-frame] [--json]\n");
    return 0;
  }
  if (parsed.positionals.length !== 1) {
    throw new UsageError("render requires exactly one SIDC.");
  }
  if (hasFlag(parsed, "fill") && hasFlag(parsed, "no-fill")) {
    throw new UsageError("render accepts only one of --fill or --no-fill.");
  }
  if (hasFlag(parsed, "frame") && hasFlag(parsed, "no-frame")) {
    throw new UsageError("render accepts only one of --frame or --no-frame.");
  }

  const options: RenderSymbolOptions = {};
  const size = getOptionalValue(parsed, "size");
  if (size !== undefined) {
    options.size = parsePositiveInteger(size, "size");
  }
  if (hasFlag(parsed, "fill")) {
    options.fill = true;
  }
  if (hasFlag(parsed, "no-fill")) {
    options.fill = false;
  }
  if (hasFlag(parsed, "frame")) {
    options.frame = true;
  }
  if (hasFlag(parsed, "no-frame")) {
    options.frame = false;
  }

  const result = renderSymbol(parsed.positionals[0], options);
  if (hasFlag(parsed, "json")) {
    writeJson(result);
    return 0;
  }

  writeOutput(`${result.svg}\n`);
  return 0;
}

function runBuild(args: readonly string[]): number {
  const parsed = parseArgs(args, {
    ...commonOptions,
    affiliation: { kind: "value" },
    domain: { kind: "value" },
    echelon: { kind: "value" },
    entity: { kind: "value" },
    "entity-subtype": { kind: "value" },
    "entity-type": { kind: "value" }
  });
  if (hasFlag(parsed, "help")) {
    writeOutput(
      "Usage: sidc-kit build --affiliation <value> --domain <value> --entity <value> [--entity-type <value>] [--entity-subtype <value>] [--echelon <value>] [--json]\n"
    );
    return 0;
  }
  if (parsed.positionals.length > 0) {
    throw new UsageError("build accepts options only; pass parts with --affiliation, --domain, and --entity.");
  }

  const input: BuildSidcInput = {
    affiliation: getRequiredValue(parsed, "affiliation"),
    domain: getRequiredValue(parsed, "domain"),
    entity: getRequiredValue(parsed, "entity")
  };
  const echelon = getOptionalValue(parsed, "echelon");
  const entityType = getOptionalValue(parsed, "entity-type");
  const entitySubtype = getOptionalValue(parsed, "entity-subtype");
  if (echelon !== undefined) {
    input.echelon = echelon;
  }
  if (entityType !== undefined) {
    input.entityType = entityType;
  }
  if (entitySubtype !== undefined) {
    input.entitySubtype = entitySubtype;
  }

  const sidc = buildSidc(input);
  if (hasFlag(parsed, "json")) {
    writeJson({ sidc });
    return 0;
  }

  writeOutput(`${sidc}\n`);
  return 0;
}

function parseArgs(args: readonly string[], specs: Record<string, OptionSpec>): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string | true>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      positionals.push(...args.slice(index + 1));
      break;
    }

    if (arg === "-h") {
      setOption(options, "help", true);
      continue;
    }

    if (!arg.startsWith("--")) {
      if (arg.startsWith("-")) {
        throw new UsageError(`Unknown option: ${arg}`);
      }
      positionals.push(arg);
      continue;
    }

    const { name, inlineValue } = splitOption(arg);
    const spec = specs[name];
    if (!spec) {
      throw new UsageError(`Unknown option: --${name}`);
    }

    if (spec.kind === "flag") {
      if (inlineValue !== undefined) {
        throw new UsageError(`--${name} does not take a value.`);
      }
      setOption(options, name, true);
      continue;
    }

    if (inlineValue !== undefined) {
      setOption(options, name, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (next === undefined || next.startsWith("-")) {
      throw new UsageError(`--${name} requires a value.`);
    }
    setOption(options, name, next);
    index += 1;
  }

  return { positionals, options };
}

function splitOption(arg: string): { name: string; inlineValue?: string } {
  const withoutPrefix = arg.slice(2);
  const separator = withoutPrefix.indexOf("=");
  if (separator === -1) {
    return { name: withoutPrefix };
  }

  return {
    name: withoutPrefix.slice(0, separator),
    inlineValue: withoutPrefix.slice(separator + 1)
  };
}

function setOption(options: Map<string, string | true>, name: string, value: string | true): void {
  if (options.has(name)) {
    throw new UsageError(`Option --${name} was provided more than once.`);
  }
  options.set(name, value);
}

function hasFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.options.get(name) === true;
}

function getRequiredValue(parsed: ParsedArgs, name: string): string {
  const value = getOptionalValue(parsed, name);
  if (value === undefined) {
    throw new UsageError(`--${name} is required.`);
  }
  return value;
}

function getOptionalValue(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.options.get(name);
  if (value === undefined) {
    return undefined;
  }
  if (value === true) {
    throw new UsageError(`--${name} requires a value.`);
  }
  if (value.trim() === "") {
    throw new UsageError(`--${name} cannot be empty.`);
  }
  return value;
}

function parseNonNegativeInteger(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new UsageError(`--${name} must be a non-negative integer.`);
  }
  return Number(value);
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = parseNonNegativeInteger(value, name);
  if (parsed === 0) {
    throw new UsageError(`--${name} must be greater than zero.`);
  }
  return parsed;
}

function writeJson(value: unknown): void {
  writeOutput(`${JSON.stringify(value, null, 2)}\n`);
}

function writeOutput(value: string): void {
  process.stdout.write(value);
}

function reportError(error: unknown, wantsJson: boolean): void {
  const code = error instanceof SidcKitError || error instanceof UsageError ? error.code : "UNEXPECTED_ERROR";
  const message = error instanceof Error ? error.message : String(error);

  if (wantsJson) {
    process.stderr.write(`${JSON.stringify({ error: { code, message } }, null, 2)}\n`);
    return;
  }

  process.stderr.write(`${code}: ${message}\n`);
}

process.exitCode = run(process.argv.slice(2));
