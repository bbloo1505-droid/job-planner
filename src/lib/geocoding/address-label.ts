const STATE_AND_POSTCODE =
  /,?\s*(?:QLD|NSW|VIC|TAS|WA|SA|ACT|NT|Queensland|New South Wales|Victoria|Tasmania|Western Australia|South Australia|Australian Capital Territory|Northern Territory)\s*\d{0,4}\s*$/i;

export function streetAndSuburbLabel(job: {
  address: string;
  suburb?: string;
  resolvedDisplayAddress?: string;
}): string {
  return streetAndSuburbFromDisplay(
    job.resolvedDisplayAddress ?? job.address,
    job.suburb
  );
}

export function streetAndSuburbFromDisplay(
  display: string,
  suburb?: string
): string {
  const cleaned = stripStateAndPostcode(display);
  if (cleaned) return cleaned;
  const place = suburb?.trim();
  if (place) return place;
  return display.replace(/\s+/g, " ").trim() || "Address";
}

export function addressRegionSuffix(display: string): string | null {
  const full = display.replace(/\s+/g, " ").trim();
  const heading = stripStateAndPostcode(full);
  if (!heading || heading === full) return null;
  const suffix = full.slice(heading.length).replace(/^,?\s*/, "").trim();
  return suffix || null;
}

function stripStateAndPostcode(value: string): string {
  let next = value.replace(/\s+/g, " ").trim();
  next = next.replace(/,?\s*Australia\s*$/i, "").trim();
  next = next.replace(STATE_AND_POSTCODE, "").trim();
  next = next.replace(/\s+\d{4}\s*$/, "").trim();
  return next;
}
