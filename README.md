# SIDC Kit

SIDC Kit is a small Node-focused TypeScript toolkit for working with military Symbol Identification Codes.

It wraps the MIT-licensed [`milsymbol`](https://www.npmjs.com/package/milsymbol) renderer and adds a curated semantic layer for common workflows:

- search for symbols by plain-language terms
- explain known SIDCs into structured parts
- build known SIDCs from structured parts
- render SIDCs to SVG with `milsymbol`
- identify clean `milsymbol` SVG renderings against the curated set

V0 can render syntactically valid 30-digit SIDCs that `milsymbol` supports. Search, explain, build, and reverse lookup intentionally support only a tiny curated set and do not claim exhaustive MIL-STD-2525 or STANAG APP-6 semantic coverage.

## Install

Install from npm after the first release is published:

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

## Usage

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

## API

### `searchSymbols(query, options?)`

Performs deterministic lexical matching over curated names, aliases, and part labels. Returns ranked results with `score`, `sidc`, `name`, `aliases`, `parts`, and `coverage`.

### `explainSidc(sidc)`

Explains a curated 30-digit SIDC into a stable JSON-serializable object. Unknown but syntactically valid SIDCs fail with `UNSUPPORTED_SIDC`.

### `buildSidc(parts)`

Maps known curated part combinations to a SIDC. Unsupported combinations fail with `UNSUPPORTED_COMBINATION` rather than guessing.
Partial combinations that match more than one curated SIDC fail with `AMBIGUOUS_COMBINATION`; add the distinguishing part named in the error, such as `echelon`.

### `renderSymbol(sidc, options?)`

Renders a syntactically valid 30-digit SIDC with `milsymbol` and returns SVG plus anchor and size metadata when available. SIDCs that `milsymbol` cannot validate or render are reported as `RENDER_FAILED`.

### `identifySymbol(input, options?)`

Compares a clean inline SVG string, or a percent-encoded `data:image/svg+xml` URL, against normalized `milsymbol` renderings for the curated fixture set. Returns ranked candidates with `confidence` and `evidence`; exact normalized SVG matches report `confidence: 1`.

The default `minConfidence` is `0.99`, so unrelated or weakly similar SVGs return an empty list rather than a guessed SIDC. Pass a lower `minConfidence` when you want to inspect near matches or ambiguous alternatives.

Reverse lookup v0 is deterministic clean-rendered-input comparison. It does not recognize screenshots, photos, scanned images, raster PNG/JPEG files, cropped symbols, hand-edited icons, map marker composites, or arbitrary MIL-STD-2525/APP-6 symbols outside the curated set.

## Coverage

Rendering coverage follows the installed `milsymbol` package. The curated semantic set includes a few common land-unit examples such as friendly infantry platoon, hostile infantry platoon, armor platoon, artillery platoon, reconnaissance platoon, and infantry company.
Reverse lookup coverage is the same curated set and currently accepts clean SVG renderings only.

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
