# SIDC Kit Agent Guidance

Prefer simple, elegant solutions over complex ones.

Apply YAGNI: do not add abstractions, options, dependencies, or feature hooks until a current requirement needs them.

Apply Single-Line Coding Principles: prefer changes that are localized to one obvious line or data entry when practical, and structure tables, fixtures, and mappings so future additions stay easy to review.

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project.

If you encounter something surprising, tell the developer and add the lesson here so future agents do not rediscover the same failure.

- For number-based MIL-STD-2525D/APP-6D SIDCs rendered by `milsymbol`, digits 9-10 are the echelon/mobility field and digits 11-20 are the function ID. Keep curated land-unit fixtures aligned with `milsymbol`'s number-SIDC metadata and land-unit function table.
- Release automation uses Release Please plus npm trusted publishing in `.github/workflows/release.yml`. Keep release-driving commits in Conventional Commit format so version bumps and `CHANGELOG.md` stay automated.
- The release workflow runs on every push to `main`, but `npm publish` only runs when Release Please reports `release_created == true`. A normal `fix:` or `feat:` merge updates or opens a Release Please PR; merging that release PR creates the GitHub release and publishes to npm. Non-release commits such as `chore:` should not publish.
- The first npm publish used a temporary `NPM_TOKEN` bootstrap fallback because `sidc-kit` did not exist on npm yet. Do not keep or reintroduce a token-based publish path now that the package exists; future releases should use npm trusted publishing for `release.yml`. Remove the GitHub `NPM_TOKEN` secret and revoke the npm token after trusted publishing is configured.
- The release workflow optionally uses `OPENCODE_API_KEY` through `scripts/summarize-release-diff.mjs` to append an OpenCode-generated diff summary to GitHub release notes. Keep that step non-blocking so npm publishing is not blocked by LLM availability.
