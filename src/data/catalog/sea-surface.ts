import type { CuratedSymbol } from "./types.js";

export const seaSurfaceSymbols = [
  {
    sidc: "130330000012020300000000000000",
    name: "Friendly Sea Surface Destroyer",
    aliases: [
      "friendly destroyer",
      "friend destroyer",
      "blue destroyer",
      "surface combatant destroyer"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "sea surface",
      affiliation: "friend",
      status: "present",
      domain: "sea surface",
      entity: "surface combatant",
      entityType: "destroyer"
    }
  },
  {
    sidc: "130330000012020400000000000000",
    name: "Friendly Sea Surface Frigate",
    aliases: [
      "friendly frigate",
      "friend frigate",
      "blue frigate",
      "surface combatant frigate"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "sea surface",
      affiliation: "friend",
      status: "present",
      domain: "sea surface",
      entity: "surface combatant",
      entityType: "frigate"
    }
  },
  {
    sidc: "130430000014010000000000000000",
    name: "Neutral Sea Surface Merchant Ship",
    aliases: [
      "neutral merchant ship",
      "merchant ship general",
      "sea surface merchant ship",
      "civilian merchant ship"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "sea surface",
      affiliation: "neutral",
      status: "present",
      domain: "sea surface",
      entity: "merchant ship",
      entityType: "general"
    }
  }
] as const satisfies readonly CuratedSymbol[];
