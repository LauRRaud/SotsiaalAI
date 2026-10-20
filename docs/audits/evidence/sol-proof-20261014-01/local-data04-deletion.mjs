import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// DATA-04 in the isolated local database only: count every row that still points to a synthetic user, run the real
// account deletion (the same function DELETE /api/profile calls), and count again. Fields come from schema.prisma:
// every relation to User with its foreign key, every other String field named ...userId / ...UserId, and email fields.
const [root, mode, userId] = process.argv.slice(2);
assert.ok(['scan', 'delete'].includes(mode) && userId);
assert.match(process.env.DATABASE_URL || '', /\/sol_proof_20261020_local(\?|$)/, 'Only the isolated local database is allowed');
const {prisma} = await import(pathToFileURL(root + '/lib/prisma.js'));
const schema = fs.readFileSync(root + '/prisma/schema.prisma', 'utf8');
const targets = [];
for (const [, model, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  for (const line of body.split('\n')) {
    const m = line.trim().match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
    if (!m || m[1].startsWith('@@')) continue;
    const [, name, type, list, , rest] = m;
    if (type === 'User' && !list) {
      const fk = rest.match(/fields:\s*\[(\w+)\]/)?.[1];
      if (fk) targets.push({model, field: fk, kind: 'relation', onDelete: rest.match(/onDelete:\s*(\w+)/)?.[1] || 'default'});
    } else if (type === 'String' && /(^userId$|UserId$|^userId)/.test(name) && !targets.some(t => t.model === model && t.field === name)) {
      targets.push({model, field: name, kind: 'soft', onDelete: null});
    } else if (type === 'String' && /email/i.test(name) && model !== 'User') {
      targets.push({model, field: name, kind: 'email', onDelete: null});
    }
  }
}
const delegate = model => prisma[model[0].toLowerCase() + model.slice(1)];
async function scan(email) {
  const found = [];
  for (const t of targets) {
    if (t.kind === 'relation' && targets.some(o => o !== t && o.model === t.model && o.field === t.field && o.kind === 'soft')) continue;
    const value = t.kind === 'email' ? email : userId;
    if (!value) continue;
    let count;
    try { count = await delegate(t.model).count({where: {[t.field]: value}}); } catch (e) { found.push({...t, error: String(e.message).slice(0, 120)}); continue; }
    if (count) found.push({...t, count});
  }
  return found;
}
const out = {mode, userId, fieldsScanned: targets.length};
try {
  const user = await prisma.user.findUnique({where: {id: userId}, select: {email: true, isAdmin: true}});
  if (user) { assert.match(user.email, /@example\.invalid$/); assert.equal(user.isAdmin, false); }
  const email = user?.email || process.argv[5] || null;
  out.userExists = Boolean(user);
  out.before = await scan(email);
  if (mode === 'delete') {
    const {deleteUserWithPrivacyCleanup} = await import(pathToFileURL(root + '/lib/privacy/userDeletion.js'));
    try { out.deletion = await deleteUserWithPrivacyCleanup({actorUserId: userId, targetUserId: userId, reason: 'sol_proof_data04_local'}); }
    catch (e) { out.deletion = {thrown: true, status: e.status ?? null, code: e.code ?? null, message: String(e.message).slice(0, 200)}; }
    out.userExistsAfter = Boolean(await prisma.user.findUnique({where: {id: userId}, select: {id: true}}));
    out.after = await scan(email);
    out.deletionJobs = await prisma.dataDeletionJob.findMany({where: {targetUserId: userId}, select: {status: true, action: true, attempts: true, lastError: true}});
  }
  console.log(JSON.stringify(out));
} finally { await prisma.$disconnect(); }
