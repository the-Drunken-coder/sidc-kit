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
    sidc: "130310001412120000000000000000",
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
    sidc: "130310001713110000000000000000",
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
    sidc: "130310001513110000000000000000",
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
    sidc: "130310001313110000000000000000",
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
  }
] as const satisfies readonly CuratedSymbol[];
