export const JOB_TYPES = [
  "ACM Survey",
  "Hazmat Survey",
  "Site Inspection",
  "Air Monitoring",
  "Reinspection",
  "Sampling",
  "Survey",
] as const;

export type ParsedQuickEntry = {
  raw: string;
  time?: string;
  title?: string;
  address: string;
};

const COLON_TIME =
  /\b(\d{1,2})[.:](\d{2})\s*(am|pm)?\b/i;
const MERIDIEM_TIME = /\b(\d{1,2})\s*(am|pm)\b/i;

function toHHmm(hourRaw: number, minute: number, meridiem?: string): string | undefined {
  if (!Number.isFinite(hourRaw) || hourRaw < 0 || hourRaw > 23) return undefined;
  if (minute < 0 || minute > 59) return undefined;

  let hour = hourRaw;
  const period = meridiem?.toLowerCase();
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  if (!period && hourRaw > 23) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractTime(text: string): { time?: string; rest: string } {
  const colon = text.match(COLON_TIME);
  if (colon && colon.index !== undefined) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    const time = toHHmm(hour, minute, colon[3]);
    if (time) {
      const rest = `${text.slice(0, colon.index)} ${text.slice(colon.index + colon[0].length)}`;
      return { time, rest: rest.replace(/\s+/g, " ").trim() };
    }
  }

  const meridiem = text.match(MERIDIEM_TIME);
  if (meridiem && meridiem.index !== undefined) {
    const hour = Number(meridiem[1]);
    const time = toHHmm(hour, 0, meridiem[2]);
    if (time) {
      const rest = `${text.slice(0, meridiem.index)} ${text.slice(meridiem.index + meridiem[0].length)}`;
      return { time, rest: rest.replace(/\s+/g, " ").trim() };
    }
  }

  return { rest: text.trim() };
}

function extractTitle(text: string): { title?: string; rest: string } {
  const normalised = text.trim();
  if (!normalised) return { rest: "" };
  const lower = normalised.toLowerCase();
  const found = [...JOB_TYPES].sort((a, b) => b.length - a.length).find((type) =>
    lower.includes(type.toLowerCase())
  );
  if (!found) return { rest: normalised };
  const index = lower.indexOf(found.toLowerCase());
  const rest = `${normalised.slice(0, index)} ${normalised.slice(index + found.length)}`
    .replace(/\s+/g, " ")
    .trim();
  return { title: found, rest };
}

/**
 * Deterministic quick-entry parser. No AI.
 * Examples: "Nambour 10am ACM Survey", "123 Example St Nambour 10:30", "Gympie 8am"
 */
export function parseQuickEntry(text: string): ParsedQuickEntry {
  const raw = text.trim();
  if (!raw) return { raw: "", address: "" };

  const timed = extractTime(raw);
  const titled = extractTitle(timed.rest);
  const address = titled.rest || raw;

  return {
    raw,
    time: timed.time,
    title: titled.title,
    address,
  };
}
