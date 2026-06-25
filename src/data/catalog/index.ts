import { airSymbols } from "./air.js";
import { controlMeasureSymbols } from "./control-measures.js";
import { landEquipmentSymbols } from "./land-equipment.js";
import { landInstallationSymbols } from "./land-installations.js";
import { landUnitSymbols } from "./land-units.js";
import { seaSubsurfaceSymbols } from "./sea-subsurface.js";
import { seaSurfaceSymbols } from "./sea-surface.js";
import type { CuratedSymbol } from "./types.js";

export type { CuratedSymbol, SymbolParts } from "./types.js";

export const curatedSymbols = [
  ...landUnitSymbols,
  ...airSymbols,
  ...seaSurfaceSymbols,
  ...seaSubsurfaceSymbols,
  ...landEquipmentSymbols,
  ...landInstallationSymbols,
  ...controlMeasureSymbols
] as const satisfies readonly CuratedSymbol[];
