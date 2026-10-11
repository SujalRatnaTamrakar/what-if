/**
 * mobile/src/lib/tags.ts — client-side topic tags for feed filters.
 * The contract has a single category ("shade"); these tags are derived from
 * the proposal's own title + place text so Transit / Streets / Parks filters
 * work without a backend change.
 */
export type Topic = "transit" | "streets" | "parks";

const RULES: Record<Topic, RegExp> = {
  transit: /\b(bus|stop|station|marta|transit|train|rail|metro|shelter|stops?)\b/i,
  streets: /\b(street|st\.?|ave(nue)?|road|rd\.?|blvd|boulevard|crossing|crosswalk|sidewalk|intersection|lane|corner|dr\.?|drive)\b/i,
  parks: /\b(park|playground|garden|green|trail|plaza|square|field|beltline)\b/i,
};

export function topicsFor(item: { title: string; placeLabel: string }): Topic[] {
  const text = `${item.title} ${item.placeLabel}`;
  return (Object.keys(RULES) as Topic[]).filter((t) => RULES[t].test(text));
}
