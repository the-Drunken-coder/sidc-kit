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

export type IdentifySymbolOptions = RenderSymbolOptions & {
  limit?: number;
  minConfidence?: number;
};

export type IdentifySymbolEvidence = {
  input: "svg";
  method: "normalized-svg";
  similarity: number;
  exact: boolean;
  notes: string[];
};

export type IdentifySymbolResult = CuratedExplainSidcResult & {
  confidence: number;
  evidence: IdentifySymbolEvidence;
};

export type BuildSidcInput = Partial<Omit<SymbolParts, "standard" | "status" | "symbolSet">> & {
  affiliation: string;
  domain: string;
  entity: string;
};

const sidcPattern = /^\d{30}$/;
const defaultIdentifyMinConfidence = 0.99;
const maxIdentifySvgInputLength = 10_000;
const maxIdentifyFuzzySvgLength = 4_000;
const disambiguatingPartKeys = ["entityType", "entitySubtype", "echelon"] as const;
type DisambiguatingPartKey = (typeof disambiguatingPartKeys)[number];
type SearchFieldGroup = "names" | "aliases" | "parts";
type SearchField = {
  text: string;
  terms: Set<string>;
};
type SearchFields = Record<SearchFieldGroup, SearchField[]>;
type FieldScoreWeights = Record<SearchFieldGroup, number>;

const exactPhraseWeights = {
  names: 100,
  aliases: 90,
  parts: 70
} satisfies FieldScoreWeights;

const exactTokenWeights = {
  names: 12,
  aliases: 10,
  parts: 8
} satisfies FieldScoreWeights;

const relatedTokenWeights = {
  names: 7,
  aliases: 6,
  parts: 5
} satisfies FieldScoreWeights;

const partialTokenWeights = {
  names: 2,
  aliases: 2,
  parts: 1
} satisfies FieldScoreWeights;

const synonymGroups = [
  ["armor", "armour", "armored", "armoured", "tank"],
  ["recon", "reconnaissance"],
  ["arty", "artillery"],
  ["inf", "infantry"]
] as const;
type MilsymbolSymbol = InstanceType<typeof ms.Symbol>;
type EntityParts = Pick<SymbolParts, "entity"> & Partial<Pick<SymbolParts, "entityType" | "entitySubtype">>;

const functionEntityParts = new Map<string, EntityParts>(
  (curatedSymbols as readonly CuratedSymbol[]).map((symbol) => [
    buildFunctionEntityKey(symbol.parts.symbolSet, getFunctionId(symbol.sidc)),
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
  if (limit === 0) {
    return [];
  }
  const normalizedQuery = normalizeText(query);

  return curatedSymbols
    .map((symbol, index) => {
      const score = scoreSymbol(symbol, terms, normalizedQuery);
      return {
        index,
        result: {
          ...explainSymbol(symbol),
          score
        }
      };
    })
    .filter(({ result }) => result.score > 0)
    .sort((left, right) => right.result.score - left.result.score || left.index - right.index)
    .map(({ result }) => result)
    .slice(0, limit);
}

export function identifySymbol(input: string, options: IdentifySymbolOptions = {}): IdentifySymbolResult[] {
  const normalizedInput = normalizeSvgInput(input);
  if (!normalizedInput) {
    return [];
  }

  const { limit = curatedSymbols.length, minConfidence = defaultIdentifyMinConfidence, ...renderOptions } = options;
  const cappedLimit = Math.max(0, limit);
  const threshold = clampConfidence(minConfidence);

  return curatedSymbols
    .map((symbol) => {
      const normalizedCandidate = normalizeSvgInput(renderSymbol(symbol.sidc, renderOptions).svg);
      if (!normalizedCandidate) {
        return undefined;
      }

      const similarity = svgSimilarity(normalizedInput, normalizedCandidate, threshold);
      const exact = normalizedInput === normalizedCandidate;
      if (similarity === undefined || similarity < threshold) {
        return undefined;
      }

      const confidence = roundConfidence(similarity);

      return {
        similarity,
        result: {
          ...explainSymbol(symbol),
          confidence,
          evidence: {
            input: "svg" as const,
            method: "normalized-svg" as const,
            similarity: confidence,
            exact,
            notes: [
              exact
                ? "Input SVG matches this curated milsymbol rendering after normalization."
                : "Input SVG is only similar to this curated milsymbol rendering."
            ]
          }
        }
      };
    })
    .filter((candidate): candidate is { similarity: number; result: IdentifySymbolResult } => candidate !== undefined)
    .sort((left, right) => right.similarity - left.similarity || left.result.name.localeCompare(right.result.name))
    .slice(0, cappedLimit)
    .map((candidate) => candidate.result);
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

function normalizeSvgInput(input: string): string | undefined {
  const normalized = decodeInlineSvgDataUrl(input)
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  if (normalized.length > maxIdentifySvgInputLength) {
    return undefined;
  }

  if (!/^<svg(?:\s|>)/i.test(normalized)) {
    return undefined;
  }

  return normalized
    .replace(/>\s+</g, "><")
    .replace(/\s+\/>/g, "/>")
    .replace(/\s+>/g, ">")
    .replace(/\s*=\s*/g, "=")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function decodeInlineSvgDataUrl(input: string): string {
  const trimmed = input.trim();
  const dataUrl = /^data:image\/svg\+xml(?:;[^,]+)*,([\s\S]*)$/i.exec(trimmed);
  if (!dataUrl) {
    return trimmed;
  }

  try {
    return decodeURIComponent(dataUrl[1]);
  } catch {
    return dataUrl[1];
  }
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
  const parts = buildPartialParts(sidc, metadata);
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

function scoreSymbol(symbol: CuratedSymbol, queryTerms: readonly string[], normalizedQuery: string): number {
  const fields = buildSearchFields(symbol);

  return (
    scoreExactPhrase(normalizedQuery, fields) +
    queryTerms.reduce((score, term) => score + scoreQueryTerm(term, fields), 0)
  );
}

function buildSearchFields(symbol: CuratedSymbol): SearchFields {
  const partValues = Object.values(symbol.parts).filter((value): value is string => typeof value === "string");

  return {
    names: [toSearchField(symbol.name)],
    aliases: symbol.aliases.map(toSearchField),
    parts: partValues.map(toSearchField)
  };
}

function toSearchField(value: string): SearchField {
  return {
    text: normalizeText(value),
    terms: new Set(tokenize(value))
  };
}

function scoreExactPhrase(query: string, fields: SearchFields): number {
  return scoreFieldPhrase(query, fields.names, exactPhraseWeights.names) +
    scoreFieldPhrase(query, fields.aliases, exactPhraseWeights.aliases) +
    scoreFieldPhrase(query, fields.parts, exactPhraseWeights.parts);
}

function scoreFieldPhrase(query: string, fields: readonly SearchField[], weight: number): number {
  return fields.some((field) => field.text === query) ? weight : 0;
}

function scoreQueryTerm(term: string, fields: SearchFields): number {
  const exactScore = scoreTerm(term, fields, exactTokenWeights);
  const relatedScore = scoreRelatedTerms(term, fields);
  const partialScore = exactScore > 0 ? 0 : scorePartialTerm(term, fields);

  return exactScore + relatedScore + partialScore;
}

function scoreRelatedTerms(term: string, fields: SearchFields): number {
  const relatedTerms = expandTerm(term).filter((candidate) => candidate !== term);
  if (relatedTerms.length === 0) {
    return 0;
  }

  return Math.max(0, ...relatedTerms.map((relatedTerm) => scoreTerm(relatedTerm, fields, relatedTokenWeights)));
}

function expandTerm(term: string): string[] {
  const group = synonymGroups.find((terms) => (terms as readonly string[]).includes(term));
  return group ? [...group] : [term];
}

function scoreTerm(term: string, fields: SearchFields, weights: FieldScoreWeights): number {
  return scoreFieldTerm(term, fields.names, weights.names) +
    scoreFieldTerm(term, fields.aliases, weights.aliases) +
    scoreFieldTerm(term, fields.parts, weights.parts);
}

function scoreFieldTerm(term: string, fields: readonly SearchField[], weight: number): number {
  return fields.some((field) => field.terms.has(term)) ? weight : 0;
}

function scorePartialTerm(term: string, fields: SearchFields): number {
  if (term.length < 3) {
    return 0;
  }

  return scorePartialFieldTerm(term, fields.names, partialTokenWeights.names) +
    scorePartialFieldTerm(term, fields.aliases, partialTokenWeights.aliases) +
    scorePartialFieldTerm(term, fields.parts, partialTokenWeights.parts);
}

function scorePartialFieldTerm(term: string, fields: readonly SearchField[], weight: number): number {
  return fields.some((field) => field.text.includes(term)) ? weight : 0;
}

function svgSimilarity(left: string, right: string, minSimilarity: number): number | undefined {
  if (left === right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }
  if (maxLength > maxIdentifyFuzzySvgLength) {
    return undefined;
  }

  const lengthSimilarity = 1 - Math.abs(left.length - right.length) / maxLength;
  if (lengthSimilarity < minSimilarity) {
    return lengthSimilarity;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left.charCodeAt(leftIndex - 1) === right.charCodeAt(rightIndex - 1) ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return defaultIdentifyMinConfidence;
  }

  return Math.max(0, Math.min(1, value));
}

function roundConfidence(value: number): number {
  return Number(clampConfidence(value).toFixed(6));
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    if (symbol.isValid() !== true || metadata.dimensionUnknown) {
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

function buildPartialParts(sidc: string, metadata: SymbolMetadata): PartialSymbolParts {
  const domain = normalizeDimension(metadata.dimension);
  const symbolSet = getSymbolSetLabel(domain, metadata);
  const entityParts = symbolSet
    ? functionEntityParts.get(buildFunctionEntityKey(symbolSet, metadata.functionid))
    : undefined;
  const affiliation = normalizeMetadataLabel(metadata.affiliation);
  const status = getStatusLabel(sidc.slice(6, 7), metadata);
  const echelon = normalizeMetadataLabel(metadata.echelon);
  const parts: PartialSymbolParts = {};

  if (symbolSet) {
    parts.symbolSet = symbolSet;
  }
  if (affiliation) {
    parts.affiliation = affiliation;
  }
  if (status) {
    parts.status = status;
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
    affiliation: buildField(sidc.slice(3, 4), parts.affiliation, knownCoverage),
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

function buildFunctionEntityKey(symbolSet: string, functionId: string): string {
  return `${symbolSet}:${functionId}`;
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

function getStatusLabel(statusCode: string, metadata: SymbolMetadata): string | undefined {
  const condition = normalizeMetadataLabel(metadata.condition);
  if (condition) {
    return condition;
  }

  if (statusCode === "0") {
    return "present";
  }

  return undefined;
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
