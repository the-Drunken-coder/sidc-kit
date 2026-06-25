import type { CuratedSymbol } from "./types.js";

export const airSymbols = [
  {
    sidc: "130301000011010400000000000000",
    name: "Friendly Air Fighter Aircraft",
    aliases: [
      "friendly fighter",
      "friendly fighter aircraft",
      "friend fighter jet",
      "blue fighter aircraft"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "air",
      affiliation: "friend",
      status: "present",
      domain: "air",
      entity: "aircraft",
      entityType: "fighter"
    }
  },
  {
    sidc: "130301000011020000000000000000",
    name: "Friendly Air Rotary-Wing Aircraft",
    aliases: [
      "friendly rotary wing aircraft",
      "friendly helicopter",
      "friend helicopter",
      "blue rotary wing aircraft"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "air",
      affiliation: "friend",
      status: "present",
      domain: "air",
      entity: "aircraft",
      entityType: "rotary wing"
    }
  },
  {
    sidc: "130601000011030000000000000000",
    name: "Hostile Air Unmanned Aerial Vehicle",
    aliases: [
      "hostile uav",
      "enemy uav",
      "enemy drone",
      "red unmanned aerial vehicle"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "air",
      affiliation: "hostile",
      status: "present",
      domain: "air",
      entity: "aircraft",
      entityType: "unmanned aerial vehicle"
    }
  }
] as const satisfies readonly CuratedSymbol[];
