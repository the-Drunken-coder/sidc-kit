# SIDC Kit

SIDC Kit is a small TypeScript toolkit for working with military Symbol Identification Codes in Node and browser-bundled apps.

It wraps the MIT-licensed [`milsymbol`](https://www.npmjs.com/package/milsymbol) renderer and adds a curated semantic layer for common workflows:

- search for symbols by plain-language terms
- explain known SIDCs into structured parts
- build known SIDCs from structured parts
- render SIDCs to SVG with `milsymbol`
- identify clean `milsymbol` SVG renderings against the curated set

V0 can render syntactically valid 30-digit SIDCs that `milsymbol` supports. Search, build, and reverse lookup intentionally support only a curated set. Explain returns curated semantics when a SIDC is in that set and partial field decomposition for other renderable number SIDCs where `milsymbol` or the curated function-ID table provides a label. It does not claim exhaustive MIL-STD-2525 or STANAG APP-6 semantic coverage.

## Install

Install from npm:

```sh
npm install sidc-kit
```

For local development, clone the repository and install dependencies:

```sh
npm install
```

## Build And Test

```sh
npm run build
npm test
```

## Fixture Generation

For repository development, generated land-unit catalog entries come from `fixtures/curated-land-units.json` and are written into `src/data/catalog/land-units.ts`.

```sh
npm run generate:fixtures
npm run check:fixtures
```

The generator derives number-based MIL-STD-2525D/APP-6D SIDCs from structured land-unit parts, keeps echelon/mobility in digits 9-10 and function ID in digits 11-20, and verifies each generated SIDC renders with the installed `milsymbol` package.

## Usage

### CLI

```sh
sidc-kit search "friendly infantry" --limit 3
sidc-kit search "friendly infantry" --json
sidc-kit explain 130310001412110000000000000000 --json
sidc-kit build --affiliation friend --domain land --entity infantry --echelon platoon
sidc-kit render 130310001412110000000000000000 --size 40 > symbol.svg
```

The CLI wraps the public API without a separate data model. Human defaults use plain text, while `--json` returns JSON for commands and typed JSON errors on stderr. Render size must be between 1 and 4096 pixels.

### TypeScript

```ts
import { buildSidc, explainSidc, identifySymbol, renderSymbol, searchSymbols } from "sidc-kit";

const results = searchSymbols("friendly infantry platoon");

const explanation = explainSidc("130310001412110000000000000000");

const sidc = buildSidc({
  affiliation: "friend",
  domain: "land",
  entity: "infantry",
  echelon: "platoon"
});

const rendered = renderSymbol(sidc, { size: 40 });

const matches = identifySymbol(rendered.svg, { size: 40 });
```

## Browser Bundles

SIDC Kit publishes browser-safe ESM at the package root. Browser and map UI builds should import from `sidc-kit` through a modern bundler:

```ts
import { renderSymbol, searchSymbols } from "sidc-kit";

const match = searchSymbols("friendly infantry platoon")[0];
const marker = renderSymbol(match.sidc, { size: 32 });
```

The package runtime does not import Node built-ins. The test suite verifies browser consumption by bundling the package root with esbuild using `platform: "browser"` defaults and exercising `renderSymbol` and `searchSymbols` from the generated bundle. Since rendering delegates to `milsymbol`, browser bundles include the `milsymbol` renderer unless your app lazy-loads this package.

## API

### `searchSymbols(query, options?)`

Performs deterministic lexical matching over curated names, aliases, and part labels. Exact names, exact aliases, exact parts, and field-specific token matches are weighted predictably, with catalog order used as the tie-breaker. Returns ranked results with `score`, `sidc`, `name`, `aliases`, `parts`, and `coverage`.

Curated search terms include practical abbreviations and regional spellings for supported records, such as `inf`/`infantry`, `arty`/`artillery`, `recon`/`reconnaissance`, and `tank`/`armor`/`armour`.

### `explainSidc(sidc)`

Explains a 30-digit SIDC into a stable JSON-serializable object.

Curated SIDCs return `coverage: "curated"` with `name`, `aliases`, and the curated `parts` object. Non-curated SIDCs that `milsymbol` can validate return `coverage: "partial"` with:

- `parts`: only the interpreted fields
- `fields`: per-field `code`, optional `value`, and `coverage`
- `unknownFields`: field names that were present in the SIDC but not interpreted

Unsupported or malformed SIDCs still fail with typed `SidcKitError` codes such as `INVALID_SIDC` or `UNSUPPORTED_SIDC`.

### `buildSidc(parts)`

Maps known curated part combinations to a SIDC. Unsupported combinations fail with `UNSUPPORTED_COMBINATION` rather than guessing.
Partial combinations that match more than one curated SIDC fail with `AMBIGUOUS_COMBINATION`; add the distinguishing part named in the error, such as `echelon`.

### `renderSymbol(sidc, options?)`

Renders a syntactically valid 30-digit SIDC with `milsymbol` and returns SVG plus anchor and size metadata when available. SIDCs that `milsymbol` cannot validate or render are reported as `RENDER_FAILED`.

### `identifySymbol(input, options?)`

Compares a clean inline SVG string, or a percent-encoded `data:image/svg+xml` URL, against normalized `milsymbol` renderings for the curated fixture set. Returns ranked candidates with `confidence` and `evidence`; exact normalized SVG matches report `confidence: 1`.

The default `minConfidence` is `0.99`, so unrelated or weakly similar SVGs return an empty list rather than a guessed SIDC. Pass a lower `minConfidence` when you want to inspect near matches or ambiguous alternatives.

Reverse lookup v0 is deterministic clean-rendered-input comparison. Oversized SVG input is rejected before fuzzy scoring. It does not recognize screenshots, photos, scanned images, raster PNG/JPEG files, cropped symbols, hand-edited icons, map marker composites, or arbitrary MIL-STD-2525/APP-6 symbols outside the curated set.

## Coverage

Rendering coverage follows the installed `milsymbol` package. The curated semantic set includes common, verified examples across land units, air, sea surface, sea subsurface, land equipment, land installations, and control measures. Examples include infantry platoons and companies, fighter and rotary-wing aircraft, UAVs, destroyers, frigates, merchant ships, submarines, unmanned underwater vehicles, tanks, armored personnel carriers, bases, airports, checkpoints, and waypoints.

Reverse lookup coverage is the same curated set and currently accepts clean SVG renderings only.

Partial decomposition is intentionally limited to affiliation, symbol set, status, domain, echelon, and entity. Entity labels come from function IDs already present in the curated table; unknown function IDs are reported through `unknownFields` instead of guessed. Status is labeled only when it is present or when `milsymbol` exposes a semantic condition label; otherwise status is reported through `unknownFields`.

Image-based reverse lookup is intentionally deferred.

## Changelog

Release history is maintained in [`CHANGELOG.md`](./CHANGELOG.md) and GitHub Releases. The npm package includes `CHANGELOG.md` so published artifacts carry the release history.

## Release Automation

Releases are managed by Release Please. Commits merged to `main` should use Conventional Commit prefixes:

- `fix:` creates a patch release
- `feat:` creates a minor release
- `feat!:` or `fix!:` creates a major release

On `main`, the release workflow opens or updates a release PR that contains the version bump and `CHANGELOG.md`. Merging that release PR creates the GitHub release and publishes the package to npm.

Npm publishing uses trusted publishing with GitHub Actions OIDC. Configure the package on npm with these trusted publisher values:

- owner: `the-Drunken-coder`
- repository: `sidc-kit`
- workflow filename: `release.yml`
- allowed action: `npm publish`

No long-lived `NPM_TOKEN` is required for the release workflow.

If `OPENCODE_API_KEY` is configured as a GitHub Actions secret, the release workflow asks OpenCode to summarize the diff between the new release tag and the previous release tag, then appends that summary to the GitHub release notes. Summary generation is best-effort and does not block npm publishing for normal push releases. Manual `workflow_dispatch` recovery runs still require the existing GitHub release notes to include a `Manual Release Summary`, `Release Diff Summary`, or `OpenCode Diff Summary` heading before publishing. Set the optional repository variable `OPENCODE_MODEL` to override the default `opencode-go/kimi-k2.6` model.
