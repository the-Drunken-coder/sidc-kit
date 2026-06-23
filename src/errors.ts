export type SidcKitErrorCode =
  | "INVALID_SIDC"
  | "UNSUPPORTED_SIDC"
  | "UNSUPPORTED_COMBINATION"
  | "AMBIGUOUS_COMBINATION"
  | "RENDER_FAILED";

export class SidcKitError extends Error {
  readonly code: SidcKitErrorCode;

  constructor(code: SidcKitErrorCode, message: string) {
    super(message);
    this.name = "SidcKitError";
    this.code = code;
  }
}
