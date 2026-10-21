import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// 21.10 checks of the fixes A1-A3 in the isolated local copy (code = the fix worktree, database sol_proof_20261020_local),
// through the same service functions the routes call. Synthetic accounts only; the arrival e-mail uses a recording
// transport and the specialist's e-mail preference is restored afterwards.
const [root, out] = process.argv.slice(2);
assert.match(process.env.DATABASE_URL || '', /\/sol_proof_20261020_local(\?|$)/, 'Only the isolated local database is allowed');
const {prisma} = await import(pathToFileURL(root + '/lib/prisma.js'));
const inquiries = await import(pathToFileURL(root + '/lib/preInquiries.js'));
const share = await import(pathToFileURL(root + '/lib/network/share.js'));
const {preInquirySenderState} = await import(pathToFileURL(root + '/lib/preInquirySenderState.js'));
const CLIENT = 'cmv7uufuo0000u3kmo9ausfgt', SPECIALIST = 'cmv7uufv50003u3kmxjmb35yj', PROVIDER = 'cmv7uufvh0006u3kmo6mc5zrr';
const checks = [], add = (case_id, variant_id, status, actual) => checks.push({case_id, variant_id, status, evidence_mode: 'CURRENT_FIXTURE', entrypoint: 'service functions of the fix worktree code in the isolated local copy', actual});
const errorKey = async fn => { try { await fn(); return null; } catch (error) { return error?.message || String(error); } };
const specialist = await prisma.user.findUnique({where: {id: SPECIALIST}, select: {email: true, notificationEmailEnabled: true, isAdmin: true}});
assert.ok(specialist.email.endsWith('@example.invalid') && !specialist.isAdmin, 'not the synthetic specialist');
const originalPreference = specialist.notificationEmailEnabled;
try {
  // A1: a pre-inquiry the specialist has accepted (READY) can be shared to the network; an archived one cannot.
  const draft = await inquiries.createPreInquiry(CLIENT, {clientActionId: crypto.randomUUID(), topic: 'SOL TEST jagamine pärast vastuvõttu',
    situation: 'Sünteetiline olukord võrgustikujagamise kontrolliks.', selectedRecipientEmail: specialist.email, selectedRecipientName: 'SOL TEST Spetsialist', status: 'DRAFT'}, {db: prisma});
  const sent = await inquiries.updatePreInquiry(CLIENT, draft.id, {status: 'SENT', expectedUpdatedAt: draft.updatedAt}, {db: prisma});
  const accepted = await inquiries.acceptPreInquiry(SPECIALIST, sent.id, {db: prisma});
  const endsOn = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const fields = {summaryText: 'SOL TEST üldistatud kokkuvõte.', purpose: 'SOL TEST kontroll.', sharingBoundary: 'Ainult see kokkuvõte.', participationEndsOn: endsOn};
  let created = null;
  const readyError = await errorKey(async () => { created = await share.createNetworkShare({prisma, workerId: SPECIALIST, sourcePreInquiryId: sent.id, recipientUserId: PROVIDER, ...fields}); });
  add('FLOW-08', 'network_share_from_accepted_ready_source', !readyError && created?.status ? 'PASS' : 'FAIL',
    {sourceStatus: accepted.status, error: readyError, shareStatus: created?.status ?? null, before20_10: 'network_share.source_inactive (server-baseline.json)'});
  const clientView = await inquiries.getVisiblePreInquiry(CLIENT, sent.id, {db: prisma});
  const personalState = preInquirySenderState(clientView).key;
  const fresh = await prisma.preInquiry.findUnique({where: {id: sent.id}, select: {updatedAt: true}});
  await inquiries.updatePreInquiryReceiverWorkflow(SPECIALIST, sent.id, {status: 'ARCHIVED', expectedUpdatedAt: fresh.updatedAt}, {db: prisma});
  const archivedError = await errorKey(() => share.createNetworkShare({prisma, workerId: SPECIALIST, sourcePreInquiryId: sent.id, recipientUserId: PROVIDER, ...fields}));
  add('FLOW-08', 'network_share_refused_from_archived_source', archivedError === 'network_share.source_inactive' ? 'PASS' : 'FAIL', {error: archivedError});

  // A2: the arrival e-mail follows the account's e-mail preference and stops before the transport.
  const calls = [];
  const mailer = {sendMail: async message => { calls.push({to: message.to, subject: message.subject, text: message.text}); return {}; }};
  const send = () => inquiries.sendInternalPreInquiryArrivalEmail(SPECIALIST, {db: prisma, mailer, from: 'sol-test@example.invalid', resolveUrl: () => 'http://localhost:3002'});
  await prisma.user.update({where: {id: SPECIALIST}, data: {notificationEmailEnabled: false}});
  const off = await send();
  const callsWhenOff = calls.length;
  await prisma.user.update({where: {id: SPECIALIST}, data: {notificationEmailEnabled: null}});
  const unset = await send();
  const callsWhenUnset = calls.length;
  await prisma.user.update({where: {id: SPECIALIST}, data: {notificationEmailEnabled: true}});
  const on = await send();
  add('OPS-04', 'arrival_email_respects_disabled_preference', off.reason === 'email_disabled' && callsWhenOff === 0 ? 'PASS' : 'FAIL', {result: off, transportCalls: callsWhenOff});
  add('OPS-04', 'arrival_email_unset_preference_treated_as_off', unset.reason === 'email_disabled' && callsWhenUnset === 0 ? 'PASS' : 'FAIL', {result: unset, transportCalls: callsWhenUnset, rule: 'same as optional notifications (lib/notifications.js: only true sends)'});
  const neutral = calls[0] && !/SOL TEST|Sünteetiline/.test(calls[0].subject + calls[0].text);
  add('OPS-04', 'arrival_email_sent_neutral_when_enabled', on.sent === true && calls.length === 1 && neutral ? 'PASS' : 'FAIL', {result: {sent: on.sent}, transportCalls: calls.length, subject: calls[0]?.subject ?? null, contentFree: neutral});

  // A3: the author sees "accepted" for a personal recipient that accepted, "opened" when an organisation only opened.
  add('FLOW-01', 'personal_recipient_accept_shows_accepted', personalState === 'accepted' ? 'PASS' : 'FAIL', {senderState: personalState});
  const orgOpened = await prisma.preInquiry.findFirst({where: {recipientOrganizationId: {not: null}, openedAt: {not: null}, recalledAt: null, sentAt: {not: null}}, orderBy: {openedAt: 'desc'}, select: {id: true, authorId: true}});
  const items = orgOpened ? await prisma.organizationInboxItem.findMany({where: {sourceType: 'PRE_INQUIRY', sourceId: orgOpened.id}, select: {status: true}}) : [];
  const orgView = orgOpened ? await inquiries.getVisiblePreInquiry(orgOpened.authorId, orgOpened.id, {db: prisma}) : null;
  const orgState = orgView ? preInquirySenderState(orgView).key : null;
  add('FLOW-01', 'organisation_open_shows_opened_not_accepted', orgState === 'opened' ? 'PASS' : 'FAIL', {inquiry: orgOpened?.id ?? null, inboxStatuses: items.map(item => item.status), senderState: orgState, before20_10: 'accepted ("vastu võetud")'});
} finally {
  await prisma.user.update({where: {id: SPECIALIST}, data: {notificationEmailEnabled: originalPreference}});
  fs.writeFileSync(out, JSON.stringify({runId: 'sol-proof-20261014-01', checkpointDate: '2026-10-21', environment: 'isolated local copy, code = fix worktree on origin/main 311375cc with the 21.10 fixes, database sol_proof_20261020_local', checks, restoredPreference: originalPreference}, null, 2) + '\n');
  await prisma.$disconnect();
}
console.log(JSON.stringify(checks.map(c => `${c.variant_id}:${c.status}`)));
