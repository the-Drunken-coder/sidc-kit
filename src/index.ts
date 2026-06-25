import ms from "milsymbol";

import { curatedSymbols, type CuratedSymbol, type SymbolParts } from "./data/symbols.js";
import { SidcKitError } from "./errors.js";

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

export type ExplainSidcResult = {
  sidc: string;
  name: string;
  aliases: string[];
  parts: SymbolParts;
  coverage: "curated";
};

export type SymbolSearchOptions = {
  limit?: number;
};

export type SymbolSearchResult = ExplainSidcResult & {
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

export function renderSymbol(sidc: string, options: RenderSymbolOptions = {}): RenderSymbolResult {
  const normalizedSidc = normalizeSidc(sidc);

  try {
    const symbol = new ms.Symbol(normalizedSidc, options);
    const metadata = symbol.getMetadata();
    if (symbol.isValid() !== true || metadata.dimensionUnknown) {
      throw new SidcKitError("RENDER_FAILED", `milsymbol does not support SIDC ${normalizedSidc}.`);
    }

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
  const symbol = requireCuratedSidc(normalizedSidc);
  return explainSymbol(symbol);
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

function requireCuratedSidc(sidc: string): CuratedSymbol {
  const symbol = curatedSymbols.find((candidate) => candidate.sidc === sidc);
  if (!symbol) {
    throw new SidcKitError("UNSUPPORTED_SIDC", `SIDC ${sidc} is not in the curated V0 fixture set.`);
  }
  return symbol;
}

function explainSymbol(symbol: CuratedSymbol): ExplainSidcResult {
  return {
    sidc: symbol.sidc,
    name: symbol.name,
    aliases: [...symbol.aliases],
    parts: { ...symbol.parts },
    coverage: "curated"
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
