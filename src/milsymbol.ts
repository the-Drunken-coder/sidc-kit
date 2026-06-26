import ms, { type SymbolMetadata } from "milsymbol";

import { SidcKitError, type SidcKitErrorCode } from "./errors.js";
import type { RenderSymbolOptions } from "./types.js";

export type { SymbolMetadata } from "milsymbol";

export type MilsymbolSymbol = InstanceType<typeof ms.Symbol>;

export function createSupportedSymbol(
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

export function normalizeDimension(value: SymbolMetadata["dimension"]): string | undefined {
  if (value === "Ground") {
    return "land";
  }

  return normalizeMetadataLabel(value);
}

export function normalizeMetadataLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === "undefined") {
    return undefined;
  }

  return normalized.toLowerCase();
}
