import { buildFreshServiceMapContactWhere } from '../../serviceMap/contactFreshnessProjection.js';
import { boundContactMatches, readVerifiedMunicipalContact, validContactBinding } from './verified-municipal-contact.js';
import { SETTLEMENTS } from './settlement-data.js';
import { LOCATION_ALIAS_ENTRIES } from '../../help/locationAliases.js';
import { settlementRows } from '../pilot/settlements.js';

const FRESH_RULE_MS = 5000;

/** SotsiaalAI adapter. Only public municipality labels and the existing
 * per-contact verification policy participate; no user/profile data is read. */
export function municipalDirectoryAdapter(db, { clock = Date.now } = {}) {
  // ADR-085: a turn decides every contact of its municipality (Tallinn: over a hundred), and each decision read the
  // freshness rule anew: the latest check's record, about 10 ms and a large document each time. The rule changes only
  // when a contact check is recorded, so one reading serves the decisions of the next few seconds; each decision still
  // reads its own register row live.
  let rule = null, readAt = 0, settlements = null;
  const freshRule = () => {
    if (!rule || clock() - readAt > FRESH_RULE_MS) { readAt = clock(); rule = buildFreshServiceMapContactWhere(db).catch(error => { rule = null; throw error; }); }
    return rule;
  };
  // The adapters are handed over one by one (runtimeAdapters takes loadRegions and loadSettlements apart), so neither
  // reads the other through "this".
  const loadRegions = async () => {
    const rows = await db.municipality.findMany({ where: { isActive: true }, orderBy: { slug: 'asc' },
      select: { slug: true, baseName: true, displayName: true } });
    return rows.map(row => ({ region: row.slug.replaceAll('-', '_'), names: [...new Set([row.displayName, row.baseName].filter(Boolean))] }));
  };
  return {
    loadRegions,
    // ADR-103: the settlements of the active municipalities. The official units (settlement-data.js, built from the
    // Land Board's file) and the help flow's own place names (a district of Tallinn or Tartu, a village); the latter
    // decide where both know a name. Public place names only; the rows are built once for a set of municipalities.
    async loadSettlements() {
      const regions = await loadRegions(), signature = regions.map(row => row.region).join('|');
      if (settlements?.signature !== signature) {
        const byName = new Map(regions.flatMap(row => row.names.map(name => [name, row.region])));
        settlements = { signature, rows: settlementRows(SETTLEMENTS, LOCATION_ALIAS_ENTRIES.filter(alias => byName.has(alias.municipalityDisplayName))
          .map(alias => ({ place: alias.place, region: byName.get(alias.municipalityDisplayName) })), regions) };
      }
      return settlements.rows;
    },
    async authorizeContact({ record }) {
      if (record.bindings !== undefined) {
        const binding = record.bindings?.service_map?.value;
        if (!validContactBinding(binding, record)) return false;
        const row = await readVerifiedMunicipalContact(db, { entryId: binding.entry_id, region: record.region, fresh: await freshRule() });
        return !!row && boundContactMatches(row, record, binding);
      }
      // A package contact is usable only when its stable source identity and
      // exact values still match the currently published, verified register row.
      const where = await freshRule();
      const rows = await db.serviceMapEntry.findMany({ where: { AND: [where, { sourceDocId: { in: record.aliases },
        municipality: { is: { isActive: true, slug: record.region.replaceAll('_', '-') } } }] }, take: 2,
      select: { title: true, phone: true, email: true, sourceUrl: true } });
      if (rows.length !== 1) return false;
      const row = rows[0];
      if (!record.fields.name || record.fields.name.value !== row.title) return false;
      return [['phone', row.phone], ['email', row.email], ['official_url', row.sourceUrl]]
        .every(([field, value]) => !record.fields[field] || record.fields[field].value === value);
    },
  };
}
