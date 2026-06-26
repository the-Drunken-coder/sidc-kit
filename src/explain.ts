import { curatedSymbols, type CuratedSymbol, type SymbolParts } from "./data/symbols.js";
import {
  createSupportedSymbol,
  normalizeDimension,
  normalizeMetadataLabel,
  type SymbolMetadata
} from "./milsymbol.js";
import { getFunctionId, getSymbolSetCode, normalizeSidc } from "./sidc.js";
import type {
  CuratedExplainSidcResult,
  ExplainSidcFields,
  ExplainSidcResult,
  PartialExplainSidcResult,
  PartialSymbolParts,
  SidcField,
  SidcFieldCoverage,
  SidcFieldName
} from "./types.js";

type CatalogSymbolSetLabels = Pick<SymbolParts, "symbolSet" | "domain">;
type EntityParts = Pick<SymbolParts, "entity"> & Partial<Pick<SymbolParts, "entityType" | "entitySubtype">>;

const typedCuratedSymbols: readonly CuratedSymbol[] = curatedSymbols;

const curatedSymbolsBySidc = new Map<string, CuratedSymbol>(
  typedCuratedSymbols.map((symbol) => [symbol.sidc, symbol])
);

const catalogSymbolSetLabelsByCode = new Map<string, CatalogSymbolSetLabels>(
  typedCuratedSymbols.map((symbol) => [
    getSymbolSetCode(symbol.sidc),
    {
      symbolSet: symbol.parts.symbolSet,
      domain: symbol.parts.domain
    }
  ])
);

const functionEntityParts = new Map<string, EntityParts>(
  typedCuratedSymbols.map((symbol) => [
    buildFunctionEntityKey(symbol.parts.symbolSet, getFunctionId(symbol.sidc)),
    {
      entity: symbol.parts.entity,
      ...(symbol.parts.entityType ? { entityType: symbol.parts.entityType } : {}),
      ...(symbol.parts.entitySubtype ? { entitySubtype: symbol.parts.entitySubtype } : {})
    }
  ])
);

export function explainSidc(sidc: string): ExplainSidcResult {
  const normalizedSidc = normalizeSidc(sidc);
  const symbol = findCuratedSidc(normalizedSidc);
  if (symbol) {
    return explainSymbol(symbol);
  }

  const { metadata } = createSupportedSymbol(normalizedSidc, {}, "UNSUPPORTED_SIDC", "explain");
  return explainPartialSidc(normalizedSidc, metadata);
}

export function explainSymbol(symbol: CuratedSymbol): CuratedExplainSidcResult {
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

function findCuratedSidc(sidc: string): CuratedSymbol | undefined {
  return curatedSymbolsBySidc.get(sidc);
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

function buildPartialParts(sidc: string, metadata: SymbolMetadata): PartialSymbolParts {
  const catalogLabels = catalogSymbolSetLabelsByCode.get(getSymbolSetCode(sidc));
  const domain = catalogLabels?.domain ?? normalizeDimension(metadata.dimension);
  const symbolSet = catalogLabels?.symbolSet ?? getSymbolSetLabel(domain, metadata);
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
