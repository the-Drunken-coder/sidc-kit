import { curatedSymbols, type CuratedSymbol } from "./data/symbols.js";
import { SidcKitError } from "./errors.js";
import { normalizeParts } from "./sidc.js";
import type { BuildSidcInput } from "./types.js";

const disambiguatingPartKeys = ["entityType", "entitySubtype", "echelon"] as const;
type DisambiguatingPartKey = (typeof disambiguatingPartKeys)[number];

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

function buildAmbiguitySuggestion(wanted: Record<string, string>, matches: readonly CuratedSymbol[]): string {
  const helpfulKeys = disambiguatingPartKeys.filter((key) => !wanted[key] && hasVariation(matches, key));
  if (helpfulKeys.length === 0) {
    return "The provided parts are still ambiguous.";
  }

  if (helpfulKeys.length === 1) {
    return `Add ${helpfulKeys[0]}.`;
  }

  return `Add enough distinguishing parts from: ${helpfulKeys.join(", ")}.`;
}

function hasVariation(matches: readonly CuratedSymbol[], key: DisambiguatingPartKey): boolean {
  return new Set(matches.map((match) => normalizeParts(match.parts)[key] ?? "")).size > 1;
}
