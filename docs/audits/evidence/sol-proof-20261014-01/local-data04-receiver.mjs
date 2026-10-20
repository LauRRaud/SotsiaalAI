import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// DATA-04 receiver side after the author's account deletion: what the synthetic specialist still sees of the sent inquiry.
const root = process.argv[2];
assert.match(process.env.DATABASE_URL || '', /\/sol_proof_20261020_local(\?|$)/);
const {prisma} = await import(pathToFileURL(root + '/lib/prisma.js'));
const inquiries = await import(pathToFileURL(root + '/lib/preInquiries.js'));
const fx = JSON.parse(fs.readFileSync('local-data04-fixture.json', 'utf8'));
try {
  const row = await prisma.preInquiry.findUnique({where: {id: fx.sentId}});
  const draft = await prisma.preInquiry.findUnique({where: {id: fx.draftId}, select: {id: true}});
  const seen = await inquiries.getVisiblePreInquiry('cmv7uufv50003u3kmxjmb35yj', fx.sentId, {db: prisma});
  const pick = o => o && Object.fromEntries(Object.entries(o).filter(([k, v]) => /status|erase|anonym|author|situation|topic|deleted|redact|withdraw|sourceJourney/i.test(k)).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 80) : v]));
  console.log(JSON.stringify({draftExists: Boolean(draft), row: pick(row), receiverView: pick(seen), receiverSeesRecord: Boolean(seen)}));
} finally { await prisma.$disconnect(); }
