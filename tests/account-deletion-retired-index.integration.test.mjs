// Konto kustutamine ja säilitusaja pühkimine siis, kui vana otsinguindeks on välja lülitatud.
//
// Vana indeks lülitati välja 05.09.2026 (`lib/documents/ragService.js`): dokumendi eemaldamine
// indeksist vastab sellest ajast alati „ei õnnestunud". Konto kustutamine ja säilitusaja
// pühkimine lugesid seda takistuseks: dokumendi fail kustutati, aga konto ega dokumendi rida
// ei kustunud kunagi.
//
// Käivita tööpuu juurest, mille `.env` näitab isoleeritud proovibaasi (localhost, …_probe):
//   node --import ./scripts/register-node-source-loader.mjs --test tests/account-deletion-retired-index.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as dotenv from 'dotenv';

if (!process.env.DATABASE_URL && fs.existsSync('.env')) dotenv.config({ path: '.env', quiet: true });
const url = new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated DATABASE_URL (localhost, …_probe) required');
}
/* Alles pärast kontrolli: need moodulid kasutavad rakenduse ühist andmebaasiklienti. */
const { prisma } = await import('../lib/prisma.js');
const { deleteUserWithPrivacyCleanup } = await import('../lib/privacy/userDeletion.js');
const { deleteDocumentRagReference } = await import('../lib/privacy/documentDeletion.js');
const { resolveAbsoluteDocumentPath } = await import('../lib/documents/server.js');
test.after(() => prisma.$disconnect());

async function userWithDocument(tag, name) {
  const user = await prisma.user.create({
    data: { email: `ad-${tag}-${name}@example.invalid`, role: 'CLIENT', profile: { create: { firstName: name, lastName: 'Proov' } } }
  });
  const storagePath = `uploads/ad-${tag}-${name}.txt`;
  const absolute = resolveAbsoluteDocumentPath(storagePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, 'proovifail');
  const document = await prisma.userDocument.create({
    data: { ownerId: user.id, title: 'Proovidokument', originalName: 'proov.txt', mime: 'text/plain', size: 10, sha256: 'a'.repeat(64), storagePath }
  });
  return { user, document, absolute };
}

test('konto kustutamine jõuab lõpuni ka siis, kui vana otsinguindeks on välja lülitatud', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const { user, document, absolute } = await userWithDocument(tag, 'lahkuja');
  t.after(async () => {
    fs.rmSync(absolute, { force: true });
    await prisma.dataDeletionJob.deleteMany({ where: { OR: [{ targetUserId: user.id }, { resourceId: { in: [user.id, document.id] } }] } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  /* Indeksist eemaldamine ei saa praegu õnnestuda: see jääb kirja ootel kohustusena ja ütleb, miks. */
  const rag = await deleteDocumentRagReference({ document, actorUserId: user.id, targetUserId: user.id });
  assert.equal(rag.ok, false);
  assert.equal(rag.pending, true);
  assert.equal(rag.retired, true);
  const pendingJob = await prisma.dataDeletionJob.findFirst({ where: { resourceId: document.id, action: 'RAG_DELETE' }, orderBy: { createdAt: 'desc' } });
  assert.ok(pendingJob.externalRef, 'ootel töö kannab indeksi viidet, mille järgi vana indeksit hiljem puhastada');
  assert.equal(pendingJob.status, 'failed');

  const result = await deleteUserWithPrivacyCleanup({ actorUserId: user.id, targetUserId: user.id, reason: 'proov' });

  /* SÜDA: konto ja dokument on päriselt kustutatud, mitte igaveseks „ootel". */
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(await prisma.user.count({ where: { id: user.id } }), 0);
  assert.equal(await prisma.userDocument.count({ where: { id: document.id } }), 0);
  assert.equal(fs.existsSync(absolute), false);
  /* Konto kustutamise töö on tehtud; indeksi kohustus jääb alles ja nähtavaks. */
  const accountJob = await prisma.dataDeletionJob.findFirst({ where: { resourceId: user.id, action: 'USER_DELETE' } });
  assert.equal(accountJob.status, 'done');
  assert.ok(await prisma.dataDeletionJob.count({ where: { resourceId: document.id, action: 'RAG_DELETE', status: 'failed', externalRef: { not: null } } }) >= 1);
});
