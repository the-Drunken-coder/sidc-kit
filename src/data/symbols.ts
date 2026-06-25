export type SymbolParts = {
  standard: "MIL-STD-2525D/APP-6D";
  symbolSet: string;
  affiliation: string;
  status: string;
  domain: string;
  entity: string;
  entityType?: string;
  entitySubtype?: string;
  echelon?: string;
};

export type CuratedSymbol = {
  sidc: string;
  name: string;
  aliases: readonly string[];
  parts: SymbolParts;
};

export const curatedSymbols = [
  {
    sidc: "130310001412110000000000000000",
    name: "Friendly Land Unit Infantry Platoon",
    aliases: [
      "friendly infantry platoon",
      "friend infantry platoon",
      "blue infantry platoon",
      "land infantry platoon"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land unit",
      affiliation: "friend",
      status: "present",
      domain: "land",
      entity: "infantry",
      echelon: "platoon"
    }
  },
  {
    sidc: "130310001512110000000000000000",
    name: "Friendly Land Unit Infantry Company",
    aliases: [
      "friendly infantry company",
      "friend infantry company",
      "blue infantry company",
      "land infantry company"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land unit",
      affiliation: "friend",
      status: "present",
      domain: "land",
      entity: "infantry",
      echelon: "company"
    }
  },
  {
    sidc: "130610001412110000000000000000",
    name: "Hostile Land Unit Infantry Platoon",
    aliases: [
      "hostile infantry platoon",
      "enemy infantry platoon",
      "red infantry platoon",
      "land infantry platoon hostile"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land unit",
      affiliation: "hostile",
      status: "present",
      domain: "land",
      entity: "infantry",
      echelon: "platoon"
    }
  },
  {
    sidc: "130310001412050000000000000000",
    name: "Friendly Land Unit Armor Platoon",
    aliases: [
      "friendly armor platoon",
      "friendly armoured platoon",
      "friend tank platoon",
      "blue armor platoon"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land unit",
      affiliation: "friend",
      status: "present",
      domain: "land",
      entity: "armor",
      entityType: "tank",
      echelon: "platoon"
    }
  },
  {
    sidc: "130310001413030000000000000000",
    name: "Friendly Land Unit Artillery Platoon",
    aliases: [
      "friendly artillery platoon",
      "friend field artillery platoon",
      "blue artillery platoon",
      "land artillery platoon"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land unit",
      affiliation: "friend",
      status: "present",
      domain: "land",
      entity: "artillery",
      echelon: "platoon"
    }
  },
  {
    sidc: "130310001412130000000000000000",
    name: "Friendly Land Unit Reconnaissance Platoon",
    aliases: [
      "friendly reconnaissance platoon",
      "friend recon platoon",
      "blue reconnaissance platoon",
      "land recon platoon"
    ],
    parts: {
      standard: "MIL-STD-2525D/APP-6D",
      symbolSet: "land unit",
      affiliation: "friend",
      status: "present",
      domain: "land",
      entity: "reconnaissance",
      echelon: "platoon"
    }
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
