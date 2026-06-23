# SIDC Kit

SIDC Kit is a small Node-focused TypeScript toolkit for working with military Symbol Identification Codes.

It wraps the MIT-licensed [`milsymbol`](https://www.npmjs.com/package/milsymbol) renderer and adds a curated semantic layer for common workflows:

- search for symbols by plain-language terms
- explain known SIDCs into structured parts
- build known SIDCs from structured parts
- render known SIDCs to SVG

V0 intentionally supports only a tiny curated set of 30-digit SIDCs. It does not claim exhaustive MIL-STD-2525 or STANAG APP-6 coverage.

## Install

This package is private while the V0 API is being validated. Clone the repository and install dependencies locally:

```sh
npm install
```

## Build And Test

```sh
npm run build
npm test
```

## Usage

```ts
import { buildSidc, explainSidc, renderSymbol, searchSymbols } from "sidc-kit";

const results = searchSymbols("friendly infantry platoon");

const explanation = explainSidc("130310001412110000000000000000");

const sidc = buildSidc({
  affiliation: "friend",
  domain: "land",
  entity: "infantry",
  echelon: "platoon"
});

const rendered = renderSymbol(sidc, { size: 40 });
```

## API

### `searchSymbols(query, options?)`

Performs deterministic lexical matching over curated names, aliases, and part labels. Returns ranked results with `score`, `sidc`, `name`, `aliases`, `parts`, and `coverage`.

### `explainSidc(sidc)`

Explains a curated 30-digit SIDC into a stable JSON-serializable object. Unknown but syntactically valid SIDCs fail with `UNSUPPORTED_SIDC`.

### `buildSidc(parts)`

Maps known curated part combinations to a SIDC. Unsupported combinations fail with `UNSUPPORTED_COMBINATION` rather than guessing.
Partial combinations that match more than one curated SIDC fail with `AMBIGUOUS_COMBINATION`; add the distinguishing part named in the error, such as `echelon`.

### `renderSymbol(sidc, options?)`

Renders a curated SIDC with `milsymbol` and returns SVG plus anchor and size metadata when available.

## Coverage

The current curated set includes a few common land-unit examples such as friendly infantry platoon, hostile infantry platoon, armor platoon, artillery platoon, reconnaissance platoon, and infantry company.

Image-based reverse lookup is intentionally deferred.
