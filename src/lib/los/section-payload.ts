/** Section bodies are stored in ApplicationSectionState.errorsJson until URLA normalization. */

const BODY_KEY = "__sectionBody";

export function encodeSectionPayload(body: unknown): string {
  return JSON.stringify({ [BODY_KEY]: body });
}

export function decodeSectionPayload(errorsJson: string): unknown | null {
  try {
    const parsed = JSON.parse(errorsJson) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && BODY_KEY in parsed) {
      return parsed[BODY_KEY];
    }
  } catch {
    // ignore invalid json
  }
  return null;
}
