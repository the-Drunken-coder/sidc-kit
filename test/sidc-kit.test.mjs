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

test("renderSymbol returns SVG for a known SIDC", () => {
  const result = renderSymbol(infantryPlatoonSidc, { size: 40 });

  assert.equal(result.sidc, infantryPlatoonSidc);
  assert.match(result.svg, /^<svg/);
  assert.match(result.svg, /<\/svg>$/);
  assert.equal(typeof result.anchor?.x, "number");
  assert.equal(typeof result.anchor?.y, "number");
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
    (error) => error instanceof SidcKitError && error.code === "AMBIGUOUS_COMBINATION"
  );
});
