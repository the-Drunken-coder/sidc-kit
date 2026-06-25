#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ms from "milsymbol";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourcePath = path.join(repoRoot, "fixtures", "curated-land-units.json");
const targetPath = path.join(repoRoot, "src", "data", "symbols.ts");

const STANDARD = "MIL-STD-2525D/APP-6D";
const SYMBOL_SET = "land unit";
const STATUS = "present";
const DOMAIN = "land";

const VERSION_CODE = "13";
const CONTEXT_CODE = "0";
const SYMBOL_SET_CODE = "10";
const STATUS_CODE = "0";
const HEADQUARTERS_TASK_FORCE_DUMMY_CODE = "0";
const UNUSED_MODIFIER_FIELDS = "0000000000";

const ECHELON_START = 8;
const ECHELON_END = 10;
const FUNCTION_ID_START = 10;
const FUNCTION_ID_END = 20;

const affiliationCodes = {
  friend: "3",
  hostile: "6"
};

const echelonCodes = {
  platoon: "14",
  company: "15"
};

const landUnitFunctionIds = {
  infantry: "1211000000",
  "armor:tank": "1205000000",
  artillery: "1303000000",
  reconnaissance: "1213000000"
};

const mode = parseMode(process.argv.slice(2));

const sourceRecords = await readSourceRecords();
const generatedSymbols = sourceRecords.map(toGeneratedSymbol);
validateGeneratedSymbols(generatedSymbols);

const generatedFile = renderSymbolsFile(generatedSymbols);

if (mode === "check") {
  const currentFile = await fs.readFile(targetPath, "utf8");
  if (normalizeLineEndings(currentFile) !== generatedFile) {
    throw new Error(`${path.relative(repoRoot, targetPath)} is out of date. Run npm run generate:fixtures.`);
  }
} else {
  await fs.writeFile(targetPath, generatedFile);
}

function parseMode(args) {
  if (args.length === 0) {
    return "write";
  }

  if (args.length === 1 && args[0] === "--check") {
    return "check";
  }

  throw new Error("Usage: node scripts/generate-curated-fixtures.mjs [--check]");
}

async function readSourceRecords() {
  const rawSource = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(rawSource);

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.relative(repoRoot, sourcePath)} must contain a JSON array.`);
  }

  return parsed.map((record, index) => normalizeSourceRecord(record, index));
}

function normalizeSourceRecord(record, index) {
  const location = `fixture ${index + 1}`;
  if (!isRecord(record)) {
    throw new Error(`${location} must be an object.`);
  }

  const aliases = readAliases(record.aliases, `${location}.aliases`);
  const sourceParts = record.parts;
  if (!isRecord(sourceParts)) {
    throw new Error(`${location}.parts must be an object.`);
  }

  const parts = {
    standard: STANDARD,
    symbolSet: SYMBOL_SET,
    affiliation: readString(sourceParts.affiliation, `${location}.parts.affiliation`),
    status: STATUS,
    domain: DOMAIN,
    entity: readString(sourceParts.entity, `${location}.parts.entity`),
    ...readOptionalPart(sourceParts, "entityType", `${location}.parts.entityType`),
    ...readOptionalPart(sourceParts, "entitySubtype", `${location}.parts.entitySubtype`),
    echelon: readString(sourceParts.echelon, `${location}.parts.echelon`)
  };

  return {
    name: readString(record.name, `${location}.name`),
    aliases,
    parts
  };
}

function readAliases(value, location) {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array.`);
  }

  const aliases = value.map((alias, index) => readString(alias, `${location}[${index}]`));
  if (new Set(aliases).size !== aliases.length) {
    throw new Error(`${location} must not contain duplicate aliases.`);
  }

  return aliases;
}

function readOptionalPart(sourceParts, key, location) {
  if (!(key in sourceParts)) {
    return {};
  }

  return {
    [key]: readString(sourceParts[key], location)
  };
}

function readString(value, location) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${location} must be a non-empty trimmed string.`);
  }

  return value;
}

function toGeneratedSymbol(sourceRecord) {
  const { sidc, echelonCode, functionId } = buildNumberSidc(sourceRecord.parts);
  const symbol = {
    sidc,
    name: sourceRecord.name,
    aliases: sourceRecord.aliases,
    parts: sourceRecord.parts
  };

  validateRenderedSymbol(symbol, { echelonCode, functionId });
  return symbol;
}

function buildNumberSidc(parts) {
  const affiliationCode = requireCode(affiliationCodes, parts.affiliation, "affiliation", parts.affiliation);
  const echelonCode = requireCode(echelonCodes, parts.echelon, "echelon", parts.echelon);
  const functionKey = [parts.entity, parts.entityType, parts.entitySubtype].filter(Boolean).join(":");
  const functionId = requireCode(landUnitFunctionIds, functionKey, "land-unit function ID", functionKey);

  const sidc =
    VERSION_CODE +
    CONTEXT_CODE +
    affiliationCode +
    SYMBOL_SET_CODE +
    STATUS_CODE +
    HEADQUARTERS_TASK_FORCE_DUMMY_CODE +
    echelonCode +
    functionId +
    UNUSED_MODIFIER_FIELDS;

  if (!/^\d{30}$/.test(sidc)) {
    throw new Error(`Generated SIDC ${sidc} must be exactly 30 digits.`);
  }

  if (sidc.slice(ECHELON_START, ECHELON_END) !== echelonCode) {
    throw new Error(`Generated SIDC ${sidc} must keep echelon/mobility in digits 9-10.`);
  }

  if (sidc.slice(FUNCTION_ID_START, FUNCTION_ID_END) !== functionId) {
    throw new Error(`Generated SIDC ${sidc} must keep function ID in digits 11-20.`);
  }

  return { sidc, echelonCode, functionId };
}

function requireCode(codes, key, label, value) {
  const code = codes[key];
  if (code) {
    return code;
  }

  throw new Error(`No ${label} code is configured for ${value}.`);
}

function validateRenderedSymbol(symbol, expected) {
  const rendered = new ms.Symbol(symbol.sidc, { size: 40 });
  const metadata = rendered.getMetadata();

  if (rendered.isValid() !== true || metadata.dimensionUnknown === true) {
    throw new Error(`milsymbol does not support generated SIDC ${symbol.sidc} (${symbol.name}).`);
  }

  if (metadata.numberSIDC !== true) {
    throw new Error(`milsymbol did not treat generated SIDC ${symbol.sidc} as a number SIDC.`);
  }

  if (metadata.functionid !== expected.functionId) {
    throw new Error(
      `milsymbol read function ID ${String(metadata.functionid)} for ${symbol.sidc}; expected ${expected.functionId}.`
    );
  }

  if (symbol.sidc.slice(ECHELON_START, ECHELON_END) !== expected.echelonCode) {
    throw new Error(`Generated SIDC ${symbol.sidc} changed the expected echelon field.`);
  }

  const svg = rendered.asSVG();
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) {
    throw new Error(`milsymbol rendered unexpected SVG output for ${symbol.sidc}.`);
  }
}

function validateGeneratedSymbols(symbols) {
  const sidcs = new Set();
  const names = new Set();
  const aliases = new Set();
  for (const symbol of symbols) {
    if (sidcs.has(symbol.sidc)) {
      throw new Error(`Duplicate generated SIDC ${symbol.sidc}.`);
    }
    sidcs.add(symbol.sidc);

    if (names.has(symbol.name)) {
      throw new Error(`Duplicate fixture name ${symbol.name}.`);
    }
    names.add(symbol.name);

    for (const alias of symbol.aliases) {
      const normalizedAlias = alias.toLowerCase();
      if (aliases.has(normalizedAlias)) {
        throw new Error(`Duplicate fixture alias ${alias}.`);
      }
      aliases.add(normalizedAlias);
    }
  }
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function renderSymbolsFile(symbols) {
  return `// Generated by scripts/generate-curated-fixtures.mjs from fixtures/curated-land-units.json.
// Run npm run generate:fixtures after editing fixture source.

export type SymbolParts = {
  standard: "MIL-STD-2525D/APP-6D";
  symbolSet: string;
  affiliation: string;
  status: string;
  domain: string;
  entity: string;
  entityType?: string;
  entitySubtype?: string;
  echelon?: string;
};

export type CuratedSymbol = {
  sidc: string;
  name: string;
  aliases: readonly string[];
  parts: SymbolParts;
};

export const curatedSymbols = ${renderSymbols(symbols)} as const satisfies readonly CuratedSymbol[];
`;
}

function renderSymbols(symbols) {
  return `[
${symbols.map(renderSymbol).join(",\n")}
]`;
}

function renderSymbol(symbol) {
  return `  {
    sidc: ${quote(symbol.sidc)},
    name: ${quote(symbol.name)},
    aliases: ${renderStringArray(symbol.aliases, 4)},
    parts: {
${renderPartLines(symbol.parts)}
    }
  }`;
}

function renderStringArray(values, indent) {
  const spaces = " ".repeat(indent);
  return `[
${values.map((value) => `${spaces}  ${quote(value)}`).join(",\n")}
${spaces}]`;
}

function renderPartLines(parts) {
  const partEntries = [
    ["standard", parts.standard],
    ["symbolSet", parts.symbolSet],
    ["affiliation", parts.affiliation],
    ["status", parts.status],
    ["domain", parts.domain],
    ["entity", parts.entity],
    ...(parts.entityType ? [["entityType", parts.entityType]] : []),
    ...(parts.entitySubtype ? [["entitySubtype", parts.entitySubtype]] : []),
    ["echelon", parts.echelon]
  ];

  return partEntries.map(([key, value]) => `      ${key}: ${quote(value)}`).join(",\n");
}

function quote(value) {
  return JSON.stringify(value);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
