import { curatedSymbols, type CuratedSymbol } from "./data/symbols.js";
import { explainSymbol } from "./explain.js";
import { normalizeText, tokenize } from "./sidc.js";
import type { SymbolSearchOptions, SymbolSearchResult } from "./types.js";

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
