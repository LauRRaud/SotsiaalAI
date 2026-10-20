import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// DATA-04 fixture in the isolated local database: one new synthetic CLIENT with a Journey, two steps, a private draft
// and an inquiry sent to the local synthetic specialist, created through the same service functions as on 14.10.
const root = process.argv[2];
assert.match(process.env.DATABASE_URL || '', /\/sol_proof_20261020_local(\?|$)/, 'Only the isolated local database is allowed');
const {prisma} = await import(pathToFileURL(root + '/lib/prisma.js'));
const journey = await import(pathToFileURL(root + '/lib/journey/service.js'));
const steps = await import(pathToFileURL(root + '/lib/journey/steps.js'));
const inquiries = await import(pathToFileURL(root + '/lib/preInquiries.js'));
const SPECIALIST = 'cmv7uufv50003u3kmxjmb35yj';
const marker = 'SOL DATA04 PRIVATE ' + crypto.randomBytes(4).toString('hex');
try {
  const specialist = await prisma.user.findUnique({where: {id: SPECIALIST}, select: {email: true, acceptsPreInquiries: true, isAdmin: true}});
  assert.ok(specialist && specialist.email.endsWith('@example.invalid') && specialist.acceptsPreInquiries && !specialist.isAdmin);
  const plan = await prisma.planDefinition.findFirst({where: {role: 'CLIENT', active: true, key: {not: 'free'}}, select: {id: true, key: true}});
  const email = `sol-proof-20261020-data04-${crypto.randomBytes(3).toString('hex')}@example.invalid`;
  const user = await prisma.user.create({data: {email, emailVerified: new Date(), role: 'CLIENT', isAdmin: false, notificationEmailEnabled: false,
    profile: {create: {firstName: 'SOL TEST', lastName: 'Kustutatav'}},
    subscriptions: {create: {status: 'ACTIVE', plan: plan.key, planDefinitionId: plan.id, billingMode: 'ONE_OFF', validUntil: new Date(Date.now() + 86400000)}}},
    select: {id: true}});
  const j = await journey.createJourneyForUser(user.id, {clientActionId: crypto.randomUUID(), title: 'SOL TEST: kustutatav Teekond', summary: 'Sünteetiline olukord kustutuskatseks.',
    primaryPath: 'PRE_INQUIRY', domains: ['digitaalne toimetulek'], context: {personWish: marker}}, {db: prisma});
  for (const title of ['Esimene samm', 'Teine samm']) await steps.createJourneyStep(user.id, j.id, {clientActionId: crypto.randomUUID(), title, doer: 'Mina', dueOn: '2026-10-30'}, {db: prisma});
  const draft = await inquiries.createPreInquiry(user.id, {clientActionId: crypto.randomUUID(), topic: 'SOL TEST mustand', situation: marker + ' mustand', status: 'DRAFT'}, {db: prisma});
  const toSend = await inquiries.createPreInquiry(user.id, {clientActionId: crypto.randomUUID(), sourceJourneyId: j.id, topic: 'SOL TEST saadetud', situation: marker + ' saadetud',
    selectedRecipientEmail: specialist.email, selectedRecipientName: 'SOL TEST Spetsialist', status: 'DRAFT'}, {db: prisma});
  const sent = await inquiries.updatePreInquiry(user.id, toSend.id, {status: 'SENT', expectedUpdatedAt: toSend.updatedAt}, {db: prisma});
  const seen = await inquiries.getVisiblePreInquiry(SPECIALIST, sent.id, {db: prisma});
  const out = {userId: user.id, email, marker, journeyId: j.id, draftId: draft.id, sentId: sent.id, sentStatus: sent.status, deliveryChannel: sent.deliveryChannel, specialistSeesIt: Boolean(seen?.situation?.includes(marker))};
  fs.writeFileSync('local-data04-fixture.json', JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
} finally { await prisma.$disconnect(); }
