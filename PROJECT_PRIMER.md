# SIDC Kit Primer

## Project

This project is a JavaScript/TypeScript toolkit for working with military Symbol Identification Codes (SIDCs). It should make MIL-STD-2525 and STANAG APP-6 symbols easier to search, explain, build, render, and eventually identify from images.

The likely package name is `sidc-kit`.

## Core Principle

Simple elegant solutions are always superior to complex ones.

Prefer a small, well-designed layer over a large custom implementation. Do not rebuild a renderer unless the existing renderer becomes a proven blocker.

## Current Direction

Build on top of the MIT-licensed `milsymbol` package rather than forking it first.

`milsymbol` should be treated as the rendering engine. This project should add the semantic layer that `milsymbol` does not cleanly expose:

- natural-language search over symbols
- SIDC explanation and decomposition
- SIDC construction helpers
- aliases and normalized names for LLM/tool lookup
- a cleaner public API for common workflows
- optional reverse lookup from an icon image to likely SIDC candidates

Forking `milsymbol` is a last resort, not the starting point. Only consider it if package exports, private tables, rendering bugs, or stability requirements make a wrapper genuinely awkward.

## Product Shape

The package should optimize for these workflows:

```ts
searchSymbols("friendly infantry platoon");
explainSidc("130310001412110000000000000000");
buildSidc({
  affiliation: "friend",
  domain: "land",
  entity: "infantry",
  echelon: "platoon",
});
renderSymbol("130310001412110000000000000000");
identifySymbol(imageInput);
```

`identifySymbol` should return ranked candidates with confidence, not pretend every icon has one exact answer. Multiple SIDCs can render identically or nearly identically depending on visible fields, modifiers, and rendering style.

## Data Model Guidance

Do not model the project as a flat list of every possible full SIDC. SIDCs are compositional. Prefer structured records that describe the parts:

- standard and version
- symbol set
- affiliation
- status
- domain/dimension
- entity
- entity type/subtype
- modifier 1
- modifier 2
- echelon or mobility
- frame or icon behavior
- aliases and search terms

Generated indexes are fine, but the canonical source should remain structured enough to explain why a code means what it means.

## API Design

Favor boring, predictable APIs:

- pure functions where possible
- explicit inputs and outputs
- no hidden network calls
- no global mutable state except where required by `milsymbol`
- stable JSON-serializable result objects
- TypeScript types for public APIs

Good results should include both machine-friendly fields and human-readable labels.

Example result shape:

```ts
type SymbolSearchResult = {
  sidc: string;
  name: string;
  aliases: string[];
  score: number;
  parts: {
    affiliation?: string;
    symbolSet?: string;
    entity?: string;
    echelon?: string;
  };
};
```

## Dependency Stance

Keep dependencies minimal.

Use `milsymbol` for rendering. Add search, fuzzy matching, or image-processing dependencies only when they clearly improve the package and are isolated behind small adapters.

For early versions, prefer simple lexical search and deterministic generated fixtures before introducing embeddings, machine learning, or heavy computer vision.

## Reverse Lookup Guidance

Reverse lookup should start with generated canonical fixtures:

1. Generate normalized SVG/PNG images from known SIDCs.
2. Normalize incoming images for size, padding, colors, and stroke width.
3. Compare against known renderings.
4. Return ranked candidates with evidence.

Do not overpromise screenshot or arbitrary-photo recognition in the first version. Clean rendered icons are the practical first target.

## Quality Bar

Before changing behavior, add or update small focused tests.

Important tests:

- known SIDC explains into expected parts
- natural-language aliases find expected symbols
- builder creates valid SIDCs for common examples
- renderer wrapper returns SVG and anchor metadata
- invalid SIDCs return useful errors
- reverse lookup returns ranked candidates, not false certainty

Use fixtures for a small set of canonical examples before scaling to broad standards coverage.

## Documentation

Documentation should make the toolkit useful quickly:

- explain what SIDC means
- show common examples
- separate rendering from semantic lookup
- document standards coverage honestly
- document ambiguous reverse matches clearly
- include the `milsymbol` MIT notice when bundling or redistributing substantial parts

## Non-Goals For Early Versions

- full custom MIL-STD renderer
- perfect OCR or screenshot recognition
- exhaustive UI app
- unverifiable standards-compliance claims
- large dependency stack
- clever abstractions before the first useful API exists

## Working Style

When adding features, choose the smallest implementation that proves the API shape. Prefer clear generated data and tests over complex runtime discovery.

If a problem can be solved with a small typed table, do that before adding a parser or model. If a generated artifact is needed, keep the generator checked in and make regeneration deterministic.
