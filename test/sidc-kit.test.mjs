import assert from "node:assert/strict";
import test from "node:test";

import {
  SidcKitError,
  buildSidc,
  explainSidc,
  renderSymbol,
  searchSymbols
} from "../dist/index.js";

const infantryPlatoonSidc = "130310001412110000000000000000";
const infantryCompanySidc = "130310001512110000000000000000";
const armorPlatoonSidc = "130310001412050000000000000000";
const artilleryPlatoonSidc = "130310001413030000000000000000";
const reconnaissancePlatoonSidc = "130310001412130000000000000000";
const friendlyAirFighterSidc = "130301000011010400000000000000";
const friendlyAirRotaryWingSidc = "130301000011020000000000000000";
const hostileAirUavSidc = "130601000011030000000000000000";
const friendlySeaDestroyerSidc = "130330000012020300000000000000";
const friendlySeaFrigateSidc = "130330000012020400000000000000";
const neutralMerchantShipSidc = "130430000014010000000000000000";
const hostileSubmarineSidc = "130635000011010000000000000000";
const friendlyUuvSidc = "130335000011040000000000000000";
const friendlyTankSidc = "130315000012020000000000000000";
const friendlyApcSidc = "130315000012010300000000000000";
const friendlyBaseSidc = "130320000012080200000000000000";
const friendlyAirportSidc = "130320000012080300000000000000";
const friendlyCheckpointSidc = "130325000013030000000000000000";
const friendlyWaypointSidc = "130325000013180000000000000000";
const nonCuratedRenderableSidc = "130410001412110000000000000000";
const unknownDimensionFallbackSidc = "000000000000000000000000000000";
const invalidIconFallbackSidc = "999999999999999999999999999999";

const expandedCatalogSidcs = [
  friendlyAirFighterSidc,
  friendlyAirRotaryWingSidc,
  hostileAirUavSidc,
  friendlySeaDestroyerSidc,
  friendlySeaFrigateSidc,
  neutralMerchantShipSidc,
  hostileSubmarineSidc,
  friendlyUuvSidc,
  friendlyTankSidc,
  friendlyApcSidc,
  friendlyBaseSidc,
  friendlyAirportSidc,
  friendlyCheckpointSidc,
  friendlyWaypointSidc
];

test("renderSymbol returns SVG for a known SIDC", () => {
  const result = renderSymbol(infantryPlatoonSidc, { size: 40 });

  assert.equal(result.sidc, infantryPlatoonSidc);
  assert.match(result.svg, /^<svg/);
  assert.match(result.svg, /<\/svg>$/);
  assert.equal(typeof result.anchor?.x, "number");
  assert.equal(typeof result.anchor?.y, "number");
});

test("renderSymbol returns SVG for a non-curated SIDC supported by milsymbol", () => {
  const result = renderSymbol(nonCuratedRenderableSidc, { size: 40 });

  assert.equal(result.sidc, nonCuratedRenderableSidc);
  assert.match(result.svg, /^<svg/);
  assert.match(result.svg, /<\/svg>$/);
});

test("renderSymbol returns SVG for expanded curated SIDCs", () => {
  for (const sidc of expandedCatalogSidcs) {
    const result = renderSymbol(sidc, { size: 40 });

    assert.equal(result.sidc, sidc);
    assert.match(result.svg, /^<svg/);
    assert.match(result.svg, /<\/svg>$/);
  }
});

test("renderSymbol rejects unsupported 30-digit SIDCs instead of returning fallback SVG", () => {
  for (const sidc of [unknownDimensionFallbackSidc, invalidIconFallbackSidc]) {
    assert.throws(
      () => renderSymbol(sidc, { size: 40 }),
      (error) =>
        error instanceof SidcKitError &&
        error.code === "RENDER_FAILED" &&
        error.message.includes(sidc)
    );
  }
});

test("explainSidc returns expected curated parts", () => {
  const result = explainSidc(infantryPlatoonSidc);

  assert.equal(result.coverage, "curated");
  assert.equal(result.name, "Friendly Land Unit Infantry Platoon");
  assert.equal(result.parts.affiliation, "friend");
  assert.equal(result.parts.domain, "land");
  assert.equal(result.parts.entity, "infantry");
  assert.equal(result.parts.echelon, "platoon");
});

test("explainSidc returns expanded curated parts", () => {
  const merchantShip = explainSidc(neutralMerchantShipSidc);
  assert.equal(merchantShip.coverage, "curated");
  assert.equal(merchantShip.name, "Neutral Sea Surface Merchant Ship");
  assert.equal(merchantShip.parts.affiliation, "neutral");
  assert.equal(merchantShip.parts.symbolSet, "sea surface");
  assert.equal(merchantShip.parts.domain, "sea surface");
  assert.equal(merchantShip.parts.entity, "merchant ship");
  assert.equal(merchantShip.parts.entityType, "general");

  const checkpoint = explainSidc(friendlyCheckpointSidc);
  assert.equal(checkpoint.name, "Friendly Control Measure Checkpoint");
  assert.equal(checkpoint.parts.symbolSet, "control measure");
  assert.equal(checkpoint.parts.domain, "control measure");
  assert.equal(checkpoint.parts.entity, "command and control point");
  assert.equal(checkpoint.parts.entityType, "checkpoint");
});

test("explainSidc remains limited to curated SIDCs", () => {
  assert.throws(
    () => explainSidc(nonCuratedRenderableSidc),
    (error) => error instanceof SidcKitError && error.code === "UNSUPPORTED_SIDC"
  );
});

test("searchSymbols finds symbols by natural-language alias", () => {
  const results = searchSymbols("friendly infantry platoon");

  assert.ok(results.length > 0);
  assert.equal(results[0].sidc, infantryPlatoonSidc);
  assert.ok(results[0].score > 0);
});

test("searchSymbols finds expanded symbols by natural-language aliases", () => {
  assert.equal(searchSymbols("enemy drone")[0]?.sidc, hostileAirUavSidc);
  assert.equal(searchSymbols("surface combatant destroyer")[0]?.sidc, friendlySeaDestroyerSidc);
  assert.equal(searchSymbols("military base")[0]?.sidc, friendlyBaseSidc);
  assert.equal(searchSymbols("control measure waypoint")[0]?.sidc, friendlyWaypointSidc);
});

test("buildSidc creates the expected known SIDC from structured parts", () => {
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land",
      entity: "infantry",
      echelon: "platoon"
    }),
    infantryPlatoonSidc
  );
});

test("buildSidc creates expanded curated SIDCs from structured parts", () => {
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "air",
      entity: "aircraft",
      entityType: "fighter"
    }),
    friendlyAirFighterSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "hostile",
      domain: "air",
      entity: "aircraft",
      entityType: "unmanned aerial vehicle"
    }),
    hostileAirUavSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "sea surface",
      entity: "surface combatant",
      entityType: "frigate"
    }),
    friendlySeaFrigateSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "hostile",
      domain: "sea subsurface",
      entity: "submarine"
    }),
    hostileSubmarineSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land equipment",
      entity: "tank"
    }),
    friendlyTankSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land installation",
      entity: "military infrastructure",
      entityType: "airport"
    }),
    friendlyAirportSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "control measure",
      entity: "command and control point",
      entityType: "checkpoint"
    }),
    friendlyCheckpointSidc
  );
});

test("buildSidc uses the correct field positions for land-unit fixtures", () => {
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land",
      entity: "infantry",
      echelon: "company"
    }),
    infantryCompanySidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land",
      entity: "armor",
      entityType: "tank",
      echelon: "platoon"
    }),
    armorPlatoonSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land",
      entity: "artillery",
      echelon: "platoon"
    }),
    artilleryPlatoonSidc
  );
  assert.equal(
    buildSidc({
      affiliation: "friend",
      domain: "land",
      entity: "reconnaissance",
      echelon: "platoon"
    }),
    reconnaissancePlatoonSidc
  );
});

test("invalid SIDCs produce a useful typed error", () => {
  assert.throws(
    () => explainSidc("not-a-sidc"),
    (error) =>
      error instanceof SidcKitError &&
      error.code === "INVALID_SIDC" &&
      error.message.includes("30 digits")
  );
});

test("unknown build combinations fail explicitly", () => {
  assert.throws(
    () =>
      buildSidc({
        affiliation: "neutral",
        domain: "sea",
        entity: "submarine"
      }),
    (error) => error instanceof SidcKitError && error.code === "UNSUPPORTED_COMBINATION"
  );
});

test("ambiguous build combinations fail explicitly", () => {
  assert.throws(
    () =>
      buildSidc({
        affiliation: "friend",
        domain: "land",
        entity: "infantry"
      }),
    (error) =>
      error instanceof SidcKitError &&
      error.code === "AMBIGUOUS_COMBINATION" &&
      error.message.includes("Add echelon.")
  );
});
