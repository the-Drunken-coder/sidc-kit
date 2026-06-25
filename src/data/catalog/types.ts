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
