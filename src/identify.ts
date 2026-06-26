import { curatedSymbols } from "./data/symbols.js";
import { explainSymbol } from "./explain.js";
import { renderSymbol } from "./render.js";
import type { IdentifySymbolOptions, IdentifySymbolResult } from "./types.js";

const defaultIdentifyMinConfidence = 0.99;
const maxIdentifySvgInputLength = 10_000;
const maxIdentifyFuzzySvgLength = 4_000;
const maxIdentifyFuzzyDistanceCells = 500_000;
const maxIdentifyCandidateRenderSize = 4096;

export function identifySymbol(input: string, options: IdentifySymbolOptions = {}): IdentifySymbolResult[] {
  const normalizedInput = normalizeSvgInput(input);
  if (!normalizedInput) {
    return [];
  }

  const { limit = curatedSymbols.length, minConfidence = defaultIdentifyMinConfidence, ...renderOptions } = options;
  const cappedLimit = Math.max(0, limit);
  const threshold = clampConfidence(minConfidence);
  if (cappedLimit === 0) {
    return [];
  }
  if (!hasSafeCandidateRenderOptions(renderOptions)) {
    return [];
  }

  return curatedSymbols
    .map((symbol) => {
      const normalizedCandidate = normalizeSvgInput(renderSymbol(symbol.sidc, renderOptions).svg);
      if (!normalizedCandidate) {
        return undefined;
      }

      const similarity = svgSimilarity(normalizedInput, normalizedCandidate, threshold);
      const exact = normalizedInput === normalizedCandidate;
      if (similarity === undefined || similarity < threshold) {
        return undefined;
      }

      const confidence = roundConfidence(similarity);

      return {
        similarity,
        result: {
          ...explainSymbol(symbol),
          confidence,
          evidence: {
            input: "svg" as const,
            method: "normalized-svg" as const,
            similarity: confidence,
            exact,
            notes: [
              exact
                ? "Input SVG matches this curated milsymbol rendering after normalization."
                : "Input SVG is only similar to this curated milsymbol rendering."
            ]
          }
        }
      };
    })
    .filter((candidate): candidate is { similarity: number; result: IdentifySymbolResult } => candidate !== undefined)
    .sort((left, right) => right.similarity - left.similarity || left.result.name.localeCompare(right.result.name))
    .slice(0, cappedLimit)
    .map((candidate) => candidate.result);
}

function hasSafeCandidateRenderOptions(options: Pick<IdentifySymbolOptions, "fill" | "frame" | "size">): boolean {
  return options.size === undefined ||
    (Number.isFinite(options.size) && options.size > 0 && options.size <= maxIdentifyCandidateRenderSize);
}

function normalizeSvgInput(input: string): string | undefined {
  const normalized = decodeInlineSvgDataUrl(input)
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  if (normalized.length > maxIdentifySvgInputLength) {
    return undefined;
  }

  if (!/^<svg(?:\s|>)/i.test(normalized)) {
    return undefined;
  }

  return normalized
    .replace(/>\s+</g, "><")
    .replace(/\s+\/>/g, "/>")
    .replace(/\s+>/g, ">")
    .replace(/\s*=\s*/g, "=")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function decodeInlineSvgDataUrl(input: string): string {
  const trimmed = input.trim();
  const dataUrl = /^data:image\/svg\+xml(?:;[^,]+)*,([\s\S]*)$/i.exec(trimmed);
  if (!dataUrl) {
    return trimmed;
  }

  try {
    return decodeURIComponent(dataUrl[1]);
  } catch {
    return dataUrl[1];
  }
}

function svgSimilarity(left: string, right: string, minSimilarity: number): number | undefined {
  if (left === right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }
  if (maxLength > maxIdentifyFuzzySvgLength) {
    return undefined;
  }
  if (left.length * right.length > maxIdentifyFuzzyDistanceCells) {
    return undefined;
  }

  const lengthSimilarity = 1 - Math.abs(left.length - right.length) / maxLength;
  if (lengthSimilarity < minSimilarity) {
    return lengthSimilarity;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left.charCodeAt(leftIndex - 1) === right.charCodeAt(rightIndex - 1) ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return defaultIdentifyMinConfidence;
  }

  return Math.max(0, Math.min(1, value));
}

function roundConfidence(value: number): number {
  return Number(clampConfidence(value).toFixed(6));
}
