import { chunkSection, keepsSuperscripts } from './legal-references.js';
import { actProvisions } from './version-comparison.js';

// ADR-123 (10.10.2026): which provision of its act a legal passage is. A section of a Riigi Teataja act that is cut into
// several passages carries "§ N" only in its first one, and a passage that begins inside a long subsection has not even
// that subsection's number. The heading path names the section, but only the search and the selection read it; the
// answer model's context has the text and a positional source path. So for the target of a pointer ("§ 133 lõigetes 5
// ja 6", which ADR-068 adds on purpose) the model had to guess which passage was meant and which provision it was
// citing. The place is read from the bundle alone, with no model and the same for every query: the section from the
// passage's heading path, as the cross-references read it (chunkSection), and the numbered subsections whose text the
// passage holds from the section's own text, as the version comparison reads them (actProvisions), so a label here and
// a provision named there are the same reading. Points are not named: the label stops at the subsection.
const RAISED = '⁰¹²³⁴⁵⁶⁷⁸⁹', NUMBER = new RegExp(`^\\d+[${RAISED}]*$`, 'u');
// A section's key ("15^1", legal-references.js) as the act shows its number ("15¹").
const shown = key => key.replace(/\^(\d+)$/u, (_, digits) => [...digits].map(digit => RAISED[digit]).join(''));
// A registered source read by subsection or by point (ADR-082, ADR-083) has no section text to read the subsections
// from: its unit is one subsection, which starts with its own number ("(7)": read so, the State Budget Act's § 2 lg 7 is
// two passages and the second has no number), or one point, whose subsection's opening words close the heading path
// ("… > § 2. Seadustest tulenevate määrade ja piirsummade kehtestamine > (5) Sotsiaalhoolekande seaduse alusel
// kehtestatavad määrad on järgmised:").
const OWN_NUMBER = new RegExp(`^\\((\\d+[${RAISED}]*)\\)\\s*(?:\\n|$)`, 'u'), LEAD_NUMBER = new RegExp(`^\\((\\d+[${RAISED}]*)\\)\\s`, 'u');

/**
 * A passage's place in its act: { section, subsections }, both as the act shows its numbers ("133", "15¹"; "5", "2¹").
 * subsections: the section's numbered subsections of whose text the passage holds a part, in the act's order; empty for
 * a section without them, for a passage that holds only the section's heading, and where they cannot be read (numbers
 * that repeat inside the section are a quoted provision's). Null for a passage of anything but a Riigi Teataja act
 * whose text keeps its superscripts (a plain "§ 131" of an older reader or a PDF may be § 13¹), for one outside a
 * section, and where the section's own text names another number than the heading path.
 */
export function legalPlace(bundle, chunk) {
  const key = keepsSuperscripts(bundle?.version) ? chunkSection(chunk) : null;
  if (!key) return null;
  const place = { section: shown(key), subsections: [] }, locations = chunk.source_locations || [], unitId = locations[0]?.source_unit_id;
  const unit = typeof unitId === 'string' && locations.every(location => location.source_unit_id === unitId) ? (bundle.source_units || []).find(item => item.id === unitId) : null;
  if (typeof unit?.raw_text !== 'string') return place;
  const provisions = actProvisions({ source_units: [unit] });
  if (!provisions.length) {
    // Text that stands in no section (the preamble, a division's own words) has no place, whatever its heading path holds.
    if (!/\/paragrahv\[\d+\]/u.test(unit.locator?.path ?? '')) return null;
    const heading = chunk.retrieval_text.slice(0, chunk.retrieval_mapping?.prefix_length ?? 0).split('\n')[0];
    const own = unit.raw_text.match(OWN_NUMBER) ?? heading.split(' > ').at(-1).match(LEAD_NUMBER);
    return own ? { ...place, subsections: [own[1]] } : place;
  }
  if (provisions.some(provision => provision.section !== place.section)) return null;
  // A subsection's text begins after its number: a passage that ends with the number alone holds none of it (as
  // provisionChunks and the amendment notes read it). A subsection that is its number alone is held where that stands.
  const parts = provisions.filter(provision => provision.label.includes(' lg ')).map(({ label, start, end }) => {
    const number = label.split(' lg ')[1], after = start + number.length + 2, text = unit.raw_text.slice(after, end).search(/\S/u);
    return { number, from: text < 0 ? start : after + text, end };
  });
  const held = parts.flatMap((part, index) => (locations.some(location => location.start < part.end && location.end > part.from) ? [index] : []));
  // The label names a run ("lg 5–7"): subsections that do not stand side by side are not named at all.
  return held.length && held.at(-1) - held[0] + 1 === held.length ? { ...place, subsections: held.map(index => parts[index].number) } : place;
}

/** The place as an act is cited: "§ 133", "§ 133 lg 5", "§ 133 lg 5–7" (every subsection from the first to the last
 *  the passage holds). Null for anything that is no such place, so an entry stored without one projects as before. */
export function provisionLabel(place) {
  const { section, subsections } = place || {};
  if (!Array.isArray(subsections) || ![section, ...subsections].every(number => typeof number === 'string' && NUMBER.test(number))) return null;
  const first = subsections[0], last = subsections.at(-1);
  return `§ ${section}${first ? ` lg ${first}${last === first ? '' : `–${last}`}` : ''}`;
}
