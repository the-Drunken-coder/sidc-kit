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

export type IdentifySymbolResult = ExplainSidcResult & {
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
const disambiguatingPartKeys = ["entityType", "entitySubtype", "echelon"] as const;
type DisambiguatingPartKey = (typeof disambiguatingPartKeys)[number];

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

      const similarity = svgSimilarity(normalizedInput, normalizedCandidate);
      const exact = normalizedInput === normalizedCandidate;
      const confidence = roundConfidence(similarity);

      return {
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
      };
    })
    .filter((result): result is IdentifySymbolResult => result !== undefined && result.confidence >= threshold)
    .sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name))
    .slice(0, cappedLimit);
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
  const dataUrl = /^data:image\/svg\+xml(?:;charset=[^;,]+)?,([\s\S]*)$/i.exec(trimmed);
  if (!dataUrl) {
    return trimmed;
  }

  try {
    return decodeURIComponent(dataUrl[1]);
  } catch {
    return dataUrl[1];
  }
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

function svgSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
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
  return Number(clampConfidence(value).toFixed(4));
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
