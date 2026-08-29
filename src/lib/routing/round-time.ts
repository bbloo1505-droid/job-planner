export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + minutes);
}

export function compareTimes(a: string, b: string): number {
  return timeToMinutes(a) - timeToMinutes(b);
}

export function roundUpToInterval(
  totalMinutes: number,
  interval: 15 | 30
): number {
  const remainder = totalMinutes % interval;
  if (remainder === 0) return totalMinutes;
  return totalMinutes + (interval - remainder);
}

export function roundUpTime(hhmm: string, interval: 15 | 30): string {
  return minutesToTime(roundUpToInterval(timeToMinutes(hhmm), interval));
}

export function formatDisplayTime(hhmm: string): string {
  const minutes = timeToMinutes(hhmm);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}
