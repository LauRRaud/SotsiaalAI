import { buildFreshServiceMapContactWhere } from '../../serviceMap/contactFreshnessProjection.js';
import { boundContactMatches, readVerifiedMunicipalContact, validContactBinding } from './verified-municipal-contact.js';

/** SotsiaalAI adapter. Only public municipality labels and the existing
 * per-contact verification policy participate; no user/profile data is read. */
export function municipalDirectoryAdapter(db) {
  return {
    async loadRegions() {
      const rows = await db.municipality.findMany({ where: { isActive: true }, orderBy: { slug: 'asc' },
        select: { slug: true, baseName: true, displayName: true } });
      return rows.map(row => ({ region: row.slug.replaceAll('-', '_'), names: [...new Set([row.displayName, row.baseName].filter(Boolean))] }));
    },
    async authorizeContact({ record }) {
      if (record.bindings !== undefined) {
        const binding = record.bindings?.service_map?.value;
        if (!validContactBinding(binding, record)) return false;
        const row = await readVerifiedMunicipalContact(db, { entryId: binding.entry_id, region: record.region });
        return !!row && boundContactMatches(row, record, binding);
      }
      // A package contact is usable only when its stable source identity and
      // exact values still match the currently published, verified register row.
      const where = await buildFreshServiceMapContactWhere(db);
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
