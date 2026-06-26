import type { CuratedSymbol } from "./types.js";

export const seaSubsurfaceSymbols = [
  {
    sidc: "130635000011010000000000000000",
    name: "Hostile Sea Subsurface Submarine",
    aliases: [
      "hostile submarine",
      "enemy submarine",
      "red submarine",
      "sea subsurface submarine"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "sea subsurface",
      affiliation: "hostile",
      status: "present",
      domain: "sea subsurface",
      entity: "submarine"
    }
  },
  {
    sidc: "130335000011040000000000000000",
    name: "Friendly Sea Subsurface Unmanned Underwater Vehicle",
    aliases: [
      "friendly unmanned underwater vehicle",
      "friendly uuv",
      "friend uuv",
      "blue underwater drone"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "sea subsurface",
      affiliation: "friend",
      status: "present",
      domain: "sea subsurface",
      entity: "unmanned underwater vehicle"
    }
  }
] as const satisfies readonly CuratedSymbol[];
