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

export function renderSymbol(sidc: string, options: RenderSymbolOptions = {}): RenderSymbolResult {
  const normalizedSidc = normalizeSidc(sidc);
  requireCuratedSidc(normalizedSidc);

  try {
    const symbol = new ms.Symbol(normalizedSidc, options);
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
      `Multiple curated SIDCs match affiliation=${parts.affiliation}, domain=${parts.domain}, entity=${parts.entity}. Add more parts such as echelon.`
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
