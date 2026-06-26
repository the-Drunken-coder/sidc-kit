import type { SymbolParts } from "./data/symbols.js";
import { SidcKitError } from "./errors.js";
import type { BuildSidcInput } from "./types.js";

const sidcPattern = /^\d{30}$/;

export function normalizeSidc(sidc: string): string {
  const normalizedSidc = sidc.trim();
  if (!sidcPattern.test(normalizedSidc)) {
    throw new SidcKitError("INVALID_SIDC", "SIDC must be exactly 30 digits.");
  }
  return normalizedSidc;
}

export function getFunctionId(sidc: string): string {
  return sidc.slice(10, 20);
}

export function getSymbolSetCode(sidc: string): string {
  return sidc.slice(4, 6);
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeParts(parts: BuildSidcInput | SymbolParts): Record<string, string> {
  return Object.entries(parts).reduce<Record<string, string>>((normalized, [key, value]) => {
    if (typeof value === "string") {
      normalized[key] = normalizeText(value);
    }
    return normalized;
  }, {});
}
