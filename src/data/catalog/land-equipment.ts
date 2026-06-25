import type { CuratedSymbol } from "./types.js";

export const landEquipmentSymbols = [
  {
    sidc: "130315000012020000000000000000",
    name: "Friendly Land Equipment Tank",
    aliases: [
      "friendly tank",
      "friend tank",
      "blue tank",
      "land equipment tank"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land equipment",
      affiliation: "friend",
      status: "present",
      domain: "land equipment",
      entity: "tank"
    }
  },
  {
    sidc: "130315000012010300000000000000",
    name: "Friendly Land Equipment Armored Personnel Carrier",
    aliases: [
      "friendly armored personnel carrier",
      "friendly armoured personnel carrier",
      "friend apc",
      "blue apc"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land equipment",
      affiliation: "friend",
      status: "present",
      domain: "land equipment",
      entity: "armored personnel carrier"
    }
  }
] as const satisfies readonly CuratedSymbol[];
