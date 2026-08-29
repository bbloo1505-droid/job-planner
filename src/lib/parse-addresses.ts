export function parseAddressLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*\d.)-]+/, "").trim())
    .filter((line) => line.length > 0);
}
