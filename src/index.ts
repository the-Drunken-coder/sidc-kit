import ms, { type SymbolMetadata } from "milsymbol";

import { curatedSymbols, type CuratedSymbol, type SymbolParts } from "./data/symbols.js";
import { SidcKitError, type SidcKitErrorCode } from "./errors.js";

export { SidcKitError } from "./errors.js";
export type { CuratedSymbol, SymbolParts } from "./data/symbols.js";

export type RenderSymbolOptions = {
  size?: number;
  fill?: boolean;
  frame?: boolean;
};

export type RenderSymbolResult = {
  sidc: string;
  svg: string;
  anchor?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
};

export type ExplainSidcCoverage = "curated" | "partial";

export type SidcFieldCoverage = "curated" | "known" | "unknown";

export type SidcField = {
  code: string;
  coverage: SidcFieldCoverage;
  value?: string;
};

export type SidcFieldName = "affiliation" | "symbolSet" | "status" | "domain" | "echelon" | "entity";

export type ExplainSidcFields = Record<SidcFieldName, SidcField>;

export type PartialSymbolParts = Partial<SymbolParts>;

type BaseExplainSidcResult = {
  sidc: string;
  aliases: string[];
  fields: ExplainSidcFields;
  unknownFields: SidcFieldName[];
};

export type CuratedExplainSidcResult = BaseExplainSidcResult & {
  name: string;
  parts: SymbolParts;
  coverage: "curated";
};

export type PartialExplainSidcResult = BaseExplainSidcResult & {
  name?: never;
  parts: PartialSymbolParts;
  coverage: "partial";
};

export type ExplainSidcResult = CuratedExplainSidcResult | PartialExplainSidcResult;

export type SymbolSearchOptions = {
  limit?: number;
};

export type SymbolSearchResult = CuratedExplainSidcResult & {
  score: number;
};

export type BuildSidcInput = Partial<Omit<SymbolParts, "standard" | "status" | "symbolSet">> & {
  affiliation: string;
  domain: string;
  entity: string;
};

const sidcPattern = /^\d{30}$/;
const disambiguatingPartKeys = ["entityType", "entitySubtype", "echelon"] as const;
type DisambiguatingPartKey = (typeof disambiguatingPartKeys)[number];
type MilsymbolSymbol = InstanceType<typeof ms.Symbol>;
type EntityParts = Pick<SymbolParts, "entity"> & Partial<Pick<SymbolParts, "entityType" | "entitySubtype">>;

const functionEntityParts = new Map<string, EntityParts>(
  (curatedSymbols as readonly CuratedSymbol[]).map((symbol) => [
    getFunctionId(symbol.sidc),
    {
      entity: symbol.parts.entity,
      ...(symbol.parts.entityType ? { entityType: symbol.parts.entityType } : {}),
      ...(symbol.parts.entitySubtype ? { entitySubtype: symbol.parts.entitySubtype } : {})
    }
  ])
);

export function renderSymbol(sidc: string, options: RenderSymbolOptions = {}): RenderSymbolResult {
  const normalizedSidc = normalizeSidc(sidc);

  try {
    const { symbol } = createSupportedSymbol(normalizedSidc, options, "RENDER_FAILED", "render");

    const svg = symbol.asSVG();
    const anchor = toPoint(symbol.getAnchor?.());
    const size = toSize(symbol.getSize?.());

    return {
      sidc: normalizedSidc,
      svg,
      ...(anchor ? { anchor } : {}),
      ...(size ? { size } : {})
    };
  } catch (error) {
    if (error instanceof SidcKitError) {
      throw error;
    }

    throw new SidcKitError(
      "RENDER_FAILED",
      `Failed to render SIDC ${normalizedSidc}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function explainSidc(sidc: string): ExplainSidcResult {
  const normalizedSidc = normalizeSidc(sidc);
  const symbol = findCuratedSidc(normalizedSidc);
  if (symbol) {
    return explainSymbol(symbol);
  }

  const { metadata } = createSupportedSymbol(normalizedSidc, {}, "UNSUPPORTED_SIDC", "explain");
  return explainPartialSidc(normalizedSidc, metadata);
}

export function searchSymbols(query: string, options: SymbolSearchOptions = {}): SymbolSearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return [];
  }

  const limit = Math.max(0, options.limit ?? curatedSymbols.length);

  return curatedSymbols
    .map((symbol) => {
      const score = scoreSymbol(symbol, terms);
      return {
        ...explainSymbol(symbol),
        score
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, limit);
}

export function buildSidc(parts: BuildSidcInput): string {
  const wanted = normalizeParts(parts);
  const matches = curatedSymbols.filter((candidate) => {
    const candidateParts = normalizeParts(candidate.parts);
    return Object.entries(wanted).every(([key, value]) => candidateParts[key] === value);
  });

  if (matches.length === 0) {
    throw new SidcKitError(
      "UNSUPPORTED_COMBINATION",
      `No curated SIDC matches affiliation=${parts.affiliation}, domain=${parts.domain}, entity=${parts.entity}${
        parts.echelon ? `, echelon=${parts.echelon}` : ""
      }.`
    );
  }

  if (matches.length > 1) {
    throw new SidcKitError(
      "AMBIGUOUS_COMBINATION",
      `Multiple curated SIDCs match affiliation=${parts.affiliation}, domain=${parts.domain}, entity=${parts.entity}. ${buildAmbiguitySuggestion(
        wanted,
        matches
      )}`
    );
  }

  return matches[0].sidc;
}

function normalizeSidc(sidc: string): string {
  const normalizedSidc = sidc.trim();
  if (!sidcPattern.test(normalizedSidc)) {
    throw new SidcKitError("INVALID_SIDC", "SIDC must be exactly 30 digits.");
  }
  return normalizedSidc;
}

function findCuratedSidc(sidc: string): CuratedSymbol | undefined {
  return curatedSymbols.find((candidate) => candidate.sidc === sidc);
}

function explainSymbol(symbol: CuratedSymbol): CuratedExplainSidcResult {
  const fields = buildFields(symbol.sidc, symbol.parts, "curated");
  return {
    sidc: symbol.sidc,
    name: symbol.name,
    aliases: [...symbol.aliases],
    parts: { ...symbol.parts },
    coverage: "curated",
    fields,
    unknownFields: getUnknownFields(fields)
  };
}

function explainPartialSidc(sidc: string, metadata: SymbolMetadata): PartialExplainSidcResult {
  const parts = buildPartialParts(metadata);
  const fields = buildFields(sidc, parts, "known");

  return {
    sidc,
    aliases: [],
    parts,
    coverage: "partial",
    fields,
    unknownFields: getUnknownFields(fields)
  };
}

function scoreSymbol(symbol: CuratedSymbol, queryTerms: readonly string[]): number {
  const fields = [
    symbol.name,
    ...symbol.aliases,
    ...Object.values(symbol.parts).filter((value): value is string => typeof value === "string")
  ];
  const exactText = fields.join(" ").toLowerCase();
  const fieldTerms = new Set(fields.flatMap(tokenize));

  return queryTerms.reduce((score, term) => {
    if (fieldTerms.has(term)) {
      return score + 3;
    }
    if (exactText.includes(term)) {
      return score + 1;
    }
    return score;
  }, 0);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeParts(parts: BuildSidcInput | SymbolParts): Record<string, string> {
  return Object.entries(parts).reduce<Record<string, string>>((normalized, [key, value]) => {
    if (typeof value === "string") {
      normalized[key] = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }
    return normalized;
  }, {});
}

function buildAmbiguitySuggestion(wanted: Record<string, string>, matches: readonly CuratedSymbol[]): string {
  const helpfulKeys = disambiguatingPartKeys.filter((key) => !wanted[key] && hasVariation(matches, key));
  if (helpfulKeys.length === 0) {
    return "The provided parts are still ambiguous.";
  }

  return `Add ${formatPartList(helpfulKeys)}.`;
}

function hasVariation(matches: readonly CuratedSymbol[], key: DisambiguatingPartKey): boolean {
  return new Set(matches.map((match) => normalizeParts(match.parts)[key] ?? "")).size > 1;
}

function formatPartList(parts: readonly string[]): string {
  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[0]} or ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")}, or ${parts[parts.length - 1]}`;
}

function createSupportedSymbol(
  sidc: string,
  options: RenderSymbolOptions,
  failureCode: SidcKitErrorCode,
  action: "explain" | "render"
): { symbol: MilsymbolSymbol; metadata: SymbolMetadata } {
  try {
    const symbol = new ms.Symbol(sidc, options);
    const metadata = symbol.getMetadata();
    if (symbol.isValid() !== true || metadata.numberSIDC !== true || metadata.dimensionUnknown) {
      throw new SidcKitError(failureCode, `milsymbol does not support SIDC ${sidc}.`);
    }

    return { symbol, metadata };
  } catch (error) {
    if (error instanceof SidcKitError) {
      throw error;
    }

    throw new SidcKitError(
      failureCode,
      `Failed to ${action} SIDC ${sidc}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function buildPartialParts(metadata: SymbolMetadata): PartialSymbolParts {
  const domain = normalizeDimension(metadata.dimension);
  const entityParts = functionEntityParts.get(metadata.functionid);
  const symbolSet = getSymbolSetLabel(domain, metadata);
  const affiliation = normalizeMetadataLabel(metadata.affiliation);
  const echelon = normalizeMetadataLabel(metadata.echelon);
  const parts: PartialSymbolParts = {
    status: getStatusLabel(metadata)
  };

  if (symbolSet) {
    parts.symbolSet = symbolSet;
  }
  if (affiliation) {
    parts.affiliation = affiliation;
  }
  if (domain) {
    parts.domain = domain;
  }
  if (entityParts) {
    Object.assign(parts, entityParts);
  }
  if (echelon) {
    parts.echelon = echelon;
  }

  return parts;
}

function buildFields(
  sidc: string,
  parts: PartialSymbolParts,
  knownCoverage: Exclude<SidcFieldCoverage, "unknown">
): ExplainSidcFields {
  return {
    affiliation: buildField(sidc.slice(2, 4), parts.affiliation, knownCoverage),
    symbolSet: buildField(sidc.slice(4, 6), parts.symbolSet, knownCoverage),
    status: buildField(sidc.slice(6, 7), parts.status, knownCoverage),
    domain: buildField(sidc.slice(4, 6), parts.domain, knownCoverage),
    echelon: buildField(sidc.slice(8, 10), parts.echelon, knownCoverage),
    entity: buildField(getFunctionId(sidc), parts.entity, knownCoverage)
  };
}

function buildField(
  code: string,
  value: string | undefined,
  knownCoverage: Exclude<SidcFieldCoverage, "unknown">
): SidcField {
  if (!value) {
    return {
      code,
      coverage: "unknown"
    };
  }

  return {
    code,
    value,
    coverage: knownCoverage
  };
}

function getUnknownFields(fields: ExplainSidcFields): SidcFieldName[] {
  return Object.entries(fields)
    .filter(([, field]) => field.coverage === "unknown")
    .map(([fieldName]) => fieldName as SidcFieldName);
}

function getFunctionId(sidc: string): string {
  return sidc.slice(10, 20);
}

function getSymbolSetLabel(domain: string | undefined, metadata: SymbolMetadata): string | undefined {
  if (!domain) {
    return undefined;
  }

  if (metadata.unit === true) {
    return `${domain} unit`;
  }

  if (metadata.installation === true) {
    return `${domain} installation`;
  }

  if (metadata.activity === true) {
    return `${domain} activity`;
  }

  return undefined;
}

function getStatusLabel(metadata: SymbolMetadata): string {
  return (
    normalizeMetadataLabel(metadata.notpresent) ??
    normalizeMetadataLabel(metadata.condition) ??
    "present"
  );
}

function normalizeDimension(value: SymbolMetadata["dimension"]): string | undefined {
  if (value === "Ground") {
    return "land";
  }

  return normalizeMetadataLabel(value);
}

function normalizeMetadataLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === "undefined") {
    return undefined;
  }

  return normalized.toLowerCase();
}

function toPoint(value: unknown): RenderSymbolResult["anchor"] {
  if (!isObject(value)) {
    return undefined;
  }

  const x = value.x;
  const y = value.y;
  if (typeof x === "number" && typeof y === "number") {
    return { x, y };
  }

  return undefined;
}

function toSize(value: unknown): RenderSymbolResult["size"] {
  if (!isObject(value)) {
    return undefined;
  }

  const width = value.width;
  const height = value.height;
  if (typeof width === "number" && typeof height === "number") {
    return { width, height };
  }

  return undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
