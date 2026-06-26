import type { SymbolParts } from "./data/symbols.js";

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
