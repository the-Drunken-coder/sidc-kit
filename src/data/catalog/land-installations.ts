import type { CuratedSymbol } from "./types.js";

export const landInstallationSymbols = [
  {
    sidc: "130320000012080200000000000000",
    name: "Friendly Land Installation Base",
    aliases: [
      "friendly base",
      "friendly military base",
      "friend base",
      "blue military base"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land installation",
      affiliation: "friend",
      status: "present",
      domain: "land installation",
      entity: "military infrastructure",
      entityType: "base"
    }
  },
  {
    sidc: "130320000012080300000000000000",
    name: "Friendly Land Installation Airport",
    aliases: [
      "friendly airport",
      "friendly airfield",
      "friend airport",
      "land installation airport"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land installation",
      affiliation: "friend",
      status: "present",
      domain: "land installation",
      entity: "military infrastructure",
      entityType: "airport"
    }
  }
] as const satisfies readonly CuratedSymbol[];
