export const ACCESS_BUFFER_PRESETS = [0, 5, 10, 15] as const;
export const DEFAULT_ACCESS_BUFFER_MINUTES = 5;
export const MAX_ACCESS_BUFFER_MINUTES = 120;

export function clampAccessBuffer(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_ACCESS_BUFFER_MINUTES;
  return Math.min(MAX_ACCESS_BUFFER_MINUTES, Math.max(0, Math.round(minutes)));
}

export function isAccessBufferPreset(minutes: number): boolean {
  return (ACCESS_BUFFER_PRESETS as readonly number[]).includes(minutes);
}

/** Access allowance applies only when the road leg is known. */
export function accessMinutesForKnownTravel(
  travel: number | null | undefined,
  bufferMinutes: number
): number {
  if (travel == null || !Number.isFinite(travel)) return 0;
  return clampAccessBuffer(bufferMinutes);
}
