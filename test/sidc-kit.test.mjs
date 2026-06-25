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
const nonCuratedRenderableSidc = "130410001412110000000000000000";
const unknownEntitySidc = "130310001400000000000000000000";
const unknownDimensionFallbackSidc = "000000000000000000000000000000";
const invalidIconFallbackSidc = "999999999999999999999999999999";

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
  assert.equal(result.fields.entity.code, "1211000000");
  assert.equal(result.fields.entity.coverage, "curated");
  assert.deepEqual(result.unknownFields, []);
});

test("explainSidc returns partial decomposition for non-curated renderable SIDCs", () => {
  const result = explainSidc(nonCuratedRenderableSidc);

  assert.equal(result.coverage, "partial");
  assert.equal(result.name, undefined);
  assert.deepEqual(result.aliases, []);
  assert.equal(result.parts.affiliation, "neutral");
  assert.equal(result.parts.symbolSet, "land unit");
  assert.equal(result.parts.status, "present");
  assert.equal(result.parts.domain, "land");
  assert.equal(result.parts.entity, "infantry");
  assert.equal(result.parts.echelon, "platoon/detachment");
  assert.deepEqual(result.unknownFields, []);
  assert.deepEqual(result.fields.affiliation, {
    code: "04",
    value: "neutral",
    coverage: "known"
  });
});

test("explainSidc rejects unsupported 30-digit SIDCs with a typed error", () => {
  assert.throws(
    () => explainSidc(unknownDimensionFallbackSidc),
    (error) => error instanceof SidcKitError && error.code === "UNSUPPORTED_SIDC"
  );
});

test("explainSidc marks unknown partial fields instead of guessing", () => {
  const result = explainSidc(unknownEntitySidc);

  assert.equal(result.coverage, "partial");
  assert.equal(result.parts.affiliation, "friend");
  assert.equal(result.parts.domain, "land");
  assert.equal(result.parts.entity, undefined);
  assert.deepEqual(result.unknownFields, ["entity"]);
  assert.deepEqual(result.fields.entity, {
    code: "0000000000",
    coverage: "unknown"
  });
});

test("searchSymbols finds symbols by natural-language alias", () => {
  const results = searchSymbols("friendly infantry platoon");

  assert.ok(results.length > 0);
  assert.equal(results[0].sidc, infantryPlatoonSidc);
  assert.ok(results[0].score > 0);
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
