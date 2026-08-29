/** Debounce so typing does not send a Nominatim request per keystroke. */
export const ADDRESS_SUGGEST_DEBOUNCE_MS = 500;

/** Skip noisy prefixes like "12 Ex". */
export const ADDRESS_SUGGEST_MIN_CHARS = 6;

export function addressSuggestQuery(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length < ADDRESS_SUGGEST_MIN_CHARS) return null;
  return trimmed;
}
