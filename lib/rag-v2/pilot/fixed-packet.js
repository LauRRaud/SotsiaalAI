import fs from 'node:fs/promises';
import { digest, reject } from './contracts.js';

// A signed comparison may replay exact, named packets. No search or embedding is performed.
export async function fixedPacket(config, query) {
  if (!config.fixedPacketFile) return null;
  const stat = await fs.stat(config.fixedPacketFile);
  if (stat.size > 4000000) reject('fixed_packet_file_too_large');
  const manifest = JSON.parse(await fs.readFile(config.fixedPacketFile, 'utf8'));
  if (digest(manifest) !== config.fixedPacketHash || manifest.tenant !== config.tenant) reject('fixed_packet_manifest_mismatch', 403);
  const entry = manifest.cases.find(item => item.question === query.text && item.language === query.language);
  if (!entry || digest(entry.packet) !== entry.packetHash || entry.packet.tenant !== config.tenant
    || entry.packet.generation_id !== config.generationId) reject('fixed_packet_not_approved', 403);
  return entry.packet;
}
