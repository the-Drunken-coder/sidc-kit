import type { CuratedSymbol } from "./types.js";

export const controlMeasureSymbols = [
  {
    sidc: "130325000013030000000000000000",
    name: "Friendly Control Measure Checkpoint",
    aliases: [
      "friendly checkpoint",
      "friend checkpoint",
      "blue checkpoint",
      "control measure checkpoint"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "control measure",
      affiliation: "friend",
      status: "present",
      domain: "control measure",
      entity: "command and control point",
      entityType: "checkpoint"
    }
  },
  {
    sidc: "130325000013180000000000000000",
    name: "Friendly Control Measure Waypoint",
    aliases: [
      "friendly waypoint",
      "friend waypoint",
      "blue waypoint",
      "control measure waypoint"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "control measure",
      affiliation: "friend",
      status: "present",
      domain: "control measure",
      entity: "command and control point",
      entityType: "waypoint"
    }
  }
] as const satisfies readonly CuratedSymbol[];
