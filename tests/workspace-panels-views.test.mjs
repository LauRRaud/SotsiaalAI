// Töölaua paneelid: kutsu osaleja, materjalid ning abisoovid ja abipakkumised.
//
// Kolm lehte olid vanal ühisel kihil (üks pikk vorm, kõrged read, brauseri
// dialoogid); nüüd on need väikeste vaadetena components/stage klotsidel. Test
// hoiab seda, mida silm kergesti ei märka: puuduv tõlkevõti, nimeta vaade,
// toores seis ekraanil, ühe vajutusega tühistamine või maksevalik, muutunud
// päringu keha ja reegel, mis läks serveri omast lahku.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INVITE_PROBLEM_KEYS,
  INVITE_STATE_KEYS,
  INVITE_STATUSES,
  INVITE_VIEW_KEYS,
  PAYMENT_HOST,
  PAYMENT_SELF,
  SPONSORED_ROLE_KEYS,
  effectiveChoice,
  inviteErrorView,
  inviteProblem,
  inviteRows,
  inviteState,
  inviteViewKeys,
  inviteViewStates,
  parseEmails,
  relationshipLabelKey,
  sentenceCase,
  sponsorProblem,
  sponsoredRoleOptions
} from '../components/invite/views/inviteRows.js';
import {
  COMMENT_MAX,
  FILTER_ALL,
  MATERIAL_STATUSES,
  MATERIAL_VIEW_KEYS,
  NOTIFICATION_STATES,
  RETENTION_LAYERS,
  RETENTION_STATES,
  REVIEW_NOTE_MAX,
  REVIEW_TRANSITIONS,
  RIGHTS_BASES,
  UPLOAD_ACCEPT,
  UPLOAD_LIMITS,
  canWithdraw,
  emptyRights,
  fileRows,
  materialSheet,
  materialStatus,
  mineRows,
  notificationText,
  retentionFacts,
  reviewActions,
  rightsBasisOptions,
  rightsPayload,
  rightsReady,
  statusFilterOptions,
  submissionRows,
  submissionSheet,
  uploadProblem
} from '../components/materials/views/materialRows.js';
import { listingCountText, listingGroups, listingKind, listingRows } from '../components/chat/helpListingRows.js';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '../lib/documents/constants.js';
import {
  INVITE_RELATIONSHIP_CLIENT,
  INVITE_RELATIONSHIP_PROFESSIONAL,
  sponsoredRolesForInviteRelationship
} from '../lib/invites/participantTypes.js';
import { getMaterialsFileCountLimit } from '../lib/storageGuardrails.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`../messages/${lang}.json`))]));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const hasWord = (key) => LANGS.filter((lang) => typeof at(catalogs[lang], key) !== 'string' || !at(catalogs[lang], key));
/* Tõlkija nagu lehel: võti ilma sõnata tuleb tagasi võtmena, muutujad pannakse sisse. */
const tOf = (lang) => (key, vars) => {
  const text = at(catalogs[lang], key);
  if (typeof text !== 'string') return key;
  return vars && typeof vars === 'object' ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
};
const t = tOf('et');

const INVITE_PAGE = '../components/invite/InviteModal.jsx';
const INVITE_VIEWS = '../components/invite/views/InviteViews.jsx';
const MATERIALS_PAGE = '../components/materials/MaterialsPage.jsx';
const MATERIALS_ADMIN = '../components/materials/MaterialsAdminSubmissionsPanel.jsx';
const MATERIALS_VIEWS = '../components/materials/views/MaterialsViews.jsx';
const REVIEW_VIEWS = '../components/materials/views/ReviewViews.jsx';
const HELP_PANEL = '../components/chat/HelpListingsPanel.jsx';
const SOURCES = [
  INVITE_PAGE,
  INVITE_VIEWS,
  '../components/invite/views/inviteRows.js',
  MATERIALS_PAGE,
  MATERIALS_ADMIN,
  MATERIALS_VIEWS,
  REVIEW_VIEWS,
  '../components/materials/views/materialRows.js',
  HELP_PANEL,
  '../components/chat/helpListingRows.js'
];

/* --- Kataloog --------------------------------------------------------------- */

test('iga tekstivõti, mille lehed välja kirjutavad, on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    const text = read(source);
    /* `t("võti")` ja ka võtmed, mis seisavad tingimuses või reeglite tabelis (neid i18n:check ei näe). */
    for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)"/g)) keys.add(match[1]);
    for (const match of text.matchAll(/"((?:invite|materials_page|documents\.errors|chat\.help|subscription)\.[a-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 110, `võtmeid leiti ${keys.size}`);
  assert.deepEqual([...keys].filter((key) => hasWord(key).length), []);
});

test('igal vaatel on nimi ja lühinimi, mis mahub kiirmenüüsse', () => {
  for (const lang of LANGS) {
    for (const key of INVITE_VIEW_KEYS) {
      const view = at(catalogs[lang], `invite.views.${key}`);
      assert.ok(view?.title && view?.short, `${lang}: invite.views.${key}`);
      assert.ok(view.short.length <= 18, `${lang}: invite.views.${key}.short`);
    }
    for (const key of MATERIAL_VIEW_KEYS) {
      const view = at(catalogs[lang], `materials_page.views.${key}`);
      assert.ok(view?.title && view?.short, `${lang}: materials_page.views.${key}`);
      assert.ok(view.short.length <= 18, `${lang}: materials_page.views.${key}.short`);
    }
    /* Kuulutuste loendi nimi tuleb kasutajalt: need kaks, mida kiirmenüü näitab. */
    for (const key of ['helpRequests', 'helpOffers']) assert.ok(catalogs[lang].chat.help[key].length <= 18, `${lang}: chat.help.${key}`);
  }
});

test('võtmed, mis pannakse kokku väärtusest, on iga võimaliku väärtuse jaoks olemas', () => {
  const missing = [];
  const need = (key) => {
    if (hasWord(key).length) missing.push(key);
  };
  INVITE_PROBLEM_KEYS.forEach(need);
  INVITE_STATE_KEYS.forEach(need);
  Object.values(SPONSORED_ROLE_KEYS).forEach(need);
  ['invite.payer.host', 'invite.payer.self', 'invite.empty', 'invite.views.sent.empty_no_room'].forEach(need);
  for (const type of [INVITE_RELATIONSHIP_CLIENT, INVITE_RELATIONSHIP_PROFESSIONAL]) {
    need(relationshipLabelKey(type));
    for (const role of sponsoredRolesForInviteRelationship(type)) assert.ok(SPONSORED_ROLE_KEYS[role], `rollil ${role} on sõna`);
  }
  for (const status of MATERIAL_STATUSES) need(`materials_page.admin.status.${status}`);
  for (const layer of RETENTION_LAYERS) need(`materials_page.retention.layers.${layer}`);
  for (const state of [...RETENTION_STATES, 'unknown']) need(`materials_page.retention.state.${state.toLowerCase()}`);
  for (const state of [...NOTIFICATION_STATES, 'unknown']) need(`materials_page.admin.notification.${state.toLowerCase()}`);
  for (const basis of RIGHTS_BASES) need(`materials_page.admin.rights.basis.${basis.toLowerCase()}`);
  ['materials_page.comment_placeholder', 'materials_page.comment_placeholder_multiple', 'materials_page.admin.empty', 'materials_page.admin.empty_filtered'].forEach(need);
  /* Tagasivõtmise keeldumised, mille võtme server vastuses annab (lib/materials/lifecycle.js):
     ilma sõnata näeks inimene võtit ennast. */
  const lifecycle = read('../lib/materials/lifecycle.js');
  for (const key of ['materials_page.errors.withdraw_not_allowed', 'materials_page.errors.delete_pending']) {
    assert.ok(lifecycle.includes(`"${key}"`), `server kasutab võtit ${key}`);
    need(key);
  }
  assert.deepEqual(missing, []);
  /* Kohatäitjad, mida leht täidab. */
  for (const lang of LANGS) {
    const messages = catalogs[lang];
    assert.ok(messages.materials_page.views.send.file_help.includes('{count}') && messages.materials_page.views.send.file_help.includes('{size}'), lang);
    assert.ok(messages.materials_page.retention.until_date.includes('{date}'), lang);
    assert.ok(messages.materials_page.admin.notification_attempts.includes('{status}') && messages.materials_page.admin.notification_attempts.includes('{attempts}'), lang);
    assert.ok(messages.materials_page.admin.error_code.includes('{code}') && messages.materials_page.admin.total.includes('{count}'), lang);
    assert.ok(messages.invite.views.send.role_single.includes('{role}') && messages.invite.success_delivery_pending.includes('{emails}'), lang);
  }
});

test('lisatud eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const walk = (node, path, out) => {
    for (const [key, value] of Object.entries(node || {})) {
      if (value && typeof value === 'object') walk(value, `${path}.${key}`, out);
      else out.push([`${path}.${key}`, String(value)]);
    }
    return out;
  };
  const et = catalogs.et;
  const texts = [
    ...walk(et.invite.views, 'invite.views', []),
    ...walk(et.invite.pay, 'invite.pay', []),
    ...walk(et.invite.status, 'invite.status', []),
    ...walk(et.materials_page.views, 'materials_page.views', []),
    ...walk(et.materials_page.retention.state, 'materials_page.retention.state', []),
    ...walk(et.materials_page.admin.rights, 'materials_page.admin.rights', []),
    ...walk(et.materials_page.admin.notification, 'materials_page.admin.notification', []),
    ['invite.success_delivery_pending', et.invite.success_delivery_pending],
    ['invite.revoked', et.invite.revoked],
    ['invite.revoke_confirm', et.invite.revoke_confirm],
    ['chat.help.otherRequests', et.chat.help.otherRequests],
    ['chat.help.otherOffers', et.chat.help.otherOffers]
  ];
  assert.ok(texts.length > 70);
  assert.deepEqual(texts.filter(([, text]) => /[—–"“]/.test(text)).map(([key]) => key), []);
});

/* --- Kutsu osaleja: reeglid -------------------------------------------------- */

test('aadressid loetakse väljalt: koma, semikoolon ja reavahetus eraldavad, kordused jäävad välja', () => {
  assert.deepEqual(parseEmails(' Mari@Example.ee, jaan@example.ee;mari@example.ee\nkati@example.ee '), ['mari@example.ee', 'jaan@example.ee', 'kati@example.ee']);
  assert.deepEqual(parseEmails(''), []);
  assert.deepEqual(parseEmails(null), []);
});

test('ruumi vaade on ainult uue ruumi puhul', () => {
  assert.deepEqual(inviteViewKeys(), ['room', 'who', 'emails', 'send'], 'enne esimest saatmist ei ole ruumi ega kutsete loendit');
  assert.deepEqual(inviteViewKeys({ hasRoom: true }), ['who', 'emails', 'send', 'sent']);
  assert.equal(effectiveChoice(['COLLEAGUE'], ''), 'COLLEAGUE', 'ainus lubatud seos on vaikimisi valitud');
  assert.equal(effectiveChoice(['CLIENT', 'COLLEAGUE'], ''), '');
  assert.equal(effectiveChoice(['CLIENT', 'COLLEAGUE'], 'COLLEAGUE'), 'COLLEAGUE');
  assert.equal(effectiveChoice(['COLLEAGUE'], 'CLIENT'), 'COLLEAGUE', 'keelatud valik ei kehti');
});

test('puuduv asi leitakse vana vormi järjekorras ja vastus ütleb vaate, kus seda parandada', () => {
  const full = { hasRoom: false, relationshipType: 'CLIENT', emails: ['a@b.ee'], roomTitle: 'Ruum', hostName: 'Mari' };
  assert.equal(inviteProblem(full), null);
  assert.deepEqual(inviteProblem({ ...full, relationshipType: '' }), { key: 'invite.error.relationship_required', view: 'who' });
  assert.deepEqual(inviteProblem({ ...full, emails: [] }), { key: 'invite.error.emails_required', view: 'emails' });
  assert.deepEqual(inviteProblem({ ...full, roomTitle: '  ' }), { key: 'invite.room_title_required', view: 'room' });
  assert.deepEqual(inviteProblem({ ...full, hostName: '' }), { key: 'invite.host_name_required', view: 'room' });
  /* Seos kontrollitakse enne aadressi ja aadress enne ruumi, nagu vanal vormil. */
  assert.equal(inviteProblem({ hasRoom: false }).view, 'who');
  assert.equal(inviteProblem({ hasRoom: false, relationshipType: 'CLIENT' }).view, 'emails');
  /* Olemasolevas ruumis ruumi nime ei küsita. */
  assert.equal(inviteProblem({ hasRoom: true, relationshipType: 'CLIENT', emails: ['a@b.ee'] }), null);
  /* Kutsuja tasub: üks aadress, roll, avatud maksmine ja nõusolek, selles järjekorras. */
  const host = { ...full, paymentMode: PAYMENT_HOST, targetRole: 'CLIENT', agreed: true };
  assert.equal(inviteProblem(host), null);
  assert.equal(inviteProblem({ ...host, emails: ['a@b.ee', 'c@d.ee'] }).key, 'invite.error.sponsored_single_email_required');
  assert.deepEqual(inviteProblem({ ...host, targetRole: null }), { key: 'invite.error.sponsor_plan_required', view: 'send' });
  assert.equal(inviteProblem({ ...host, checkoutClosed: true }).key, 'invite.error.checkout_temporarily_disabled');
  assert.equal(inviteProblem({ ...host, agreed: false }).key, 'invite.error.checkout_terms_required');
  /* Sama kutse ilma maksevalikuta neid ei kontrolli. */
  assert.equal(inviteProblem({ ...full, paymentMode: PAYMENT_SELF, emails: ['a@b.ee', 'c@d.ee'] }), null);
});

test('valikut „Tasun tema eest” ei saa teha ilma seoseta ega mitme aadressiga', () => {
  assert.equal(sponsorProblem({ relationshipType: '', emails: [] }).view, 'who');
  assert.deepEqual(sponsorProblem({ relationshipType: 'CLIENT', emails: ['a@b.ee', 'c@d.ee'] }), { key: 'invite.error.sponsored_single_email_required', view: 'emails' });
  assert.equal(sponsorProblem({ relationshipType: 'CLIENT', emails: ['a@b.ee'] }), null);
  assert.equal(sponsorProblem({ relationshipType: 'CLIENT', emails: [] }), null, 'aadress võib olla veel lisamata, nagu vanal vormil');
});

test('serveri keeldumine läheb selle vaate juurde, mille asi see on', () => {
  assert.equal(inviteErrorView('invite.error.relationship_not_allowed'), 'who');
  assert.equal(inviteErrorView('invite.error.invitee_active_subscription'), 'emails');
  assert.equal(inviteErrorView('invite.room_title_required'), 'room');
  assert.equal(inviteErrorView('invite.room_title_required', inviteViewKeys({ hasRoom: true })), 'send', 'ruumi vaadet ei ole, kui ruum on olemas');
  assert.equal(inviteErrorView('invite.error.sponsor_capacity_full'), 'send');
  assert.equal(inviteErrorView(undefined), 'send');
});

test('sammu seis ütleb, mis on täidetud', () => {
  assert.deepEqual(inviteViewStates(), { room: 'empty', who: 'empty', emails: 'empty', send: 'empty', sent: 'empty' });
  assert.equal(inviteViewStates({ roomTitle: 'Ruum' }).room, 'partial');
  assert.deepEqual(
    inviteViewStates({ roomTitle: 'Ruum', hostName: 'Mari', relationshipType: 'CLIENT', emails: ['a@b.ee'], inviteCount: 2 }),
    { room: 'done', who: 'done', emails: 'done', send: 'empty', sent: 'done' }
  );
});

test('kutse seis on sõna, mitte andmebaasi kood, ja tegevused sõltuvad seisust', () => {
  /* Andmebaasi seisude loend (prisma `InviteStatus`) ja lehe oma on samad. */
  const schema = read('../prisma/schema.prisma');
  const block = schema.slice(schema.indexOf('enum InviteStatus {'), schema.indexOf('}', schema.indexOf('enum InviteStatus {')));
  const statuses = block.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean);
  assert.deepEqual([...INVITE_STATUSES].sort(), [...statuses].sort());

  const now = Date.parse('2026-10-09T12:00:00Z');
  const future = '2026-10-16T12:00:00Z';
  const past = '2026-10-01T12:00:00Z';
  assert.deepEqual(inviteState({ status: 'SENT', expiresAt: future }, now), { key: 'invite.status.sent', tone: 'wait', canResend: true, canRevoke: true });
  /* Aegunud kutse on andmebaasis „saadetud", aga uuesti saatmisest server keeldub. */
  assert.deepEqual(inviteState({ status: 'SENT', expiresAt: past }, now), { key: 'invite.status.expired', tone: 'quiet', canResend: false, canRevoke: true });
  assert.equal(inviteState({ status: 'SENT' }, now).canResend, true, 'kehtivuse lõputa kutse on saadetud');
  assert.equal(inviteState({ status: 'ACCEPTED', acceptedBillingSource: 'SELF' }).key, 'invite.status.accepted_self');
  assert.equal(inviteState({ status: 'ACCEPTED', acceptedBillingSource: 'SPONSORED_BY_HOST' }).key, 'invite.status.accepted_sponsored');
  assert.equal(inviteState({ status: 'ACCEPTED' }).key, 'invite.status.accepted');
  assert.equal(inviteState({ status: 'PENDING_PAYMENT' }).key, 'invite.status.pending_payment');
  assert.equal(inviteState({ status: 'SOMETHING_NEW' }).key, 'invite.status.unknown');
  for (const status of statuses) {
    const state = inviteState({ status, expiresAt: future }, now);
    if (status !== 'SENT') assert.equal(state.canResend || state.canRevoke, false, `${status}: tegevusi ei ole`);
  }

  const rows = inviteRows(
    [
      { id: 7, inviteeEmail: 'a@b.ee', status: 'SENT', paymentMode: 'SELF_PAID', expiresAt: future },
      { id: 'x', inviteeEmail: 'c@d.ee', status: 'REVOKED', paymentMode: 'SPONSORED_BY_HOST' },
      { id: 'y', inviteeEmail: 'e@f.ee', status: 'BRAND_NEW' }
    ],
    { t, now }
  );
  assert.deepEqual(rows[0], { id: '7', email: 'a@b.ee', payer: 'Kutsutu teeb tellimuse ise', state: 'Saadetud', tone: 'wait', canResend: true, canRevoke: true });
  assert.equal(rows[1].state, 'Tühistatud');
  assert.equal(rows[1].payer, 'Tasun tema eest');
  for (const row of rows) assert.ok(!/^[A-Z_]+$/.test(row.state) && !row.state.includes('invite.'), `seis on sõna: ${row.state}`);
  assert.deepEqual(inviteRows(null, { t }), []);
});

test('makse valik näitab iga rolli hinda ja nupu tekst on tavaline lause', () => {
  const amountOf = (role) => (role === 'CLIENT' ? 5 : 12.5);
  const client = sponsoredRoleOptions(INVITE_RELATIONSHIP_CLIENT, { t, locale: 'et', amountOf });
  assert.equal(client.length, 1);
  assert.equal(client[0].value, 'CLIENT');
  assert.match(client[0].label, /^Eluküsimusega pöörduja · 5,00\s€$/);
  const professional = sponsoredRoleOptions(INVITE_RELATIONSHIP_PROFESSIONAL, { t, locale: 'et', amountOf });
  assert.deepEqual(professional.map((option) => option.value), ['SOCIAL_WORKER', 'SERVICE_PROVIDER']);
  assert.ok(professional.every((option) => option.label.includes('12,50') && !option.label.includes(' - ')));
  assert.equal(sentenceCase('SAADA KUTSE', 'et'), 'Saada kutse');
  assert.equal(sentenceCase('Send invite', 'en'), 'Send invite');
  assert.equal(sentenceCase(t('invite.send'), 'et'), 'Saada kutse');
});

/* --- Kutsu osaleja: lehe lubadused ------------------------------------------ */

test('lause selle kohta, millele kutsutu ligi pääseb, on sõna-sõnalt alles', () => {
  assert.equal(
    catalogs.et.invite.participant.scope,
    'Osaleja saab ligipääsu ainult sellele koostööruumile. Kutse ei anna ligipääsu sinu teistele ruumidele, eravestlustele, dokumentidele ega Teekonnale.'
  );
  const views = read(INVITE_VIEWS);
  const who = views.slice(views.indexOf('export function WhoView'), views.indexOf('export function EmailsView'));
  assert.ok(who.includes('{t("invite.participant.scope")}'), 'lause on valiku vaates');
  assert.ok(who.includes('t("invite.participant.question")'));
});

test('maksevalikut ei saa teha ühe eksinud vajutusega ja kutset ei saada Enter', () => {
  const page = read(INVITE_PAGE);
  const views = read(INVITE_VIEWS);
  /* Valik läheb sisse ainult ühest kohast, kuhu jõuab kinnitusnupu teine vajutus. */
  assert.equal(page.split('setPaymentMode(PAYMENT_HOST)').length - 1, 1);
  const flow = page.slice(page.indexOf('const startSponsoredFlow'), page.indexOf('async function submit'));
  assert.ok(flow.includes('setPaymentMode(PAYMENT_HOST)') && flow.includes('sponsorProblem('));
  assert.ok(page.includes('onChoose: startSponsoredFlow,'));
  const send = views.slice(views.indexOf('export function SendView'), views.indexOf('export function SentView'));
  assert.match(send, /<ConfirmButton[\s\S]*?label=\{t\("invite\.pay\.host"\)\}[\s\S]*?confirmLabel=\{t\("invite\.pay\.confirm"\)\}[\s\S]*?onConfirm=\{pay\.onChoose\}/);
  assert.ok(!send.includes('CheckCard') && !send.includes('OptionCard'), 'maksevalik ei ole märkeruut');
  /* Kinnitusnupp ei lase topeltklõpsu ega all hoitud klahvi teisest astmest läbi. */
  const confirm = read('../components/casework/ConfirmButton.jsx');
  assert.ok(confirm.includes('Date.now() - armedAt.current < MIN_GAP_MS') && confirm.includes('event.repeat'));
  /* Nõusolek ja makse nupp on alles: makse algab alles siis, kui roll on valitud ja nõusolek antud. */
  assert.ok(send.includes('t("invite.sponsored.checkout.agreement")') && send.includes('name="inviteSponsoredConsent"'));
  assert.ok(page.includes('disabled={sponsoredCheckoutDisabled || busy || !effectiveTargetRole || !sponsoredCheckoutAgreed}'));
  /* Kutse on päris e-kiri: saatmine käib ainult nupust, vormi ei ole. */
  for (const source of [page, views]) {
    assert.ok(!/<form\b|<Form\b|onSubmit|type="submit"/.test(source), 'vormi ega saatvat Enterit ei ole');
  }
  assert.equal(page.split('onClick={submit}').length - 1, 2, 'saatmine on kahe nupu taga: saada kutse ja alusta makset');
  assert.ok(views.includes('event.preventDefault();') && views.includes('onEnter?.();'));
});

test('kutse read kannavad oma märgid vaateni', () => {
  const views = read(INVITE_VIEWS);
  const sent = views.slice(views.indexOf('export function SentView'), views.indexOf('export function SignedOutView'));
  /* Iga väli, mida vaade realt loeb, tuleb ridade tegijalt või lehelt. */
  const made = new Set([...Object.keys(inviteRows([{ id: 1, status: 'SENT' }], { t })[0]), 'busy', 'onResend', 'onRevoke']);
  const used = new Set([...sent.matchAll(/\brow\.(\w+)/g)].map((match) => match[1]));
  assert.deepEqual([...used].filter((name) => !made.has(name)), []);
});

/* --- Materjalid: reeglid ----------------------------------------------------- */

test('materjali seisud ja piirid on samad mis serveris', () => {
  const submissions = read('../lib/materials/submissions.js');
  const list = submissions.slice(submissions.indexOf('MATERIAL_SUBMISSION_STATUSES = Object.freeze(['), submissions.indexOf('])'));
  assert.deepEqual([...MATERIAL_STATUSES], [...list.matchAll(/"([a-z]+)"/g)].map((match) => match[1]));
  assert.ok(submissions.includes('const MAX_REVIEW_NOTE_LENGTH = 2_000'));
  assert.equal(REVIEW_NOTE_MAX, 2000);
  assert.ok(read('../lib/materials/server.js').includes('const MAX_COMMENT_LENGTH = 4_000'));
  assert.equal(COMMENT_MAX, 4000);

  /* Ülevaatuse üleminekud. */
  const review = read('../lib/materials/review.js');
  const table = review.slice(review.indexOf('const REVIEW_TRANSITIONS = Object.freeze({'), review.indexOf('})', review.indexOf('const REVIEW_TRANSITIONS')));
  const server = Object.fromEntries(
    [...table.matchAll(/(\w+): new Set\(\[?([^)]*?)\]?\)/g)].map((match) => [match[1], [...match[2].matchAll(/"([a-z]+)"/g)].map((item) => item[1])])
  );
  assert.deepEqual(Object.keys(server), [...MATERIAL_STATUSES]);
  for (const status of MATERIAL_STATUSES) assert.deepEqual([...REVIEW_TRANSITIONS[status]], server[status], status);

  /* Õiguste alused ja teavituse seisud. */
  const policy = read('../lib/materials/ragPolicy.js');
  const bases = policy.slice(policy.indexOf('SHARED_RAG_RIGHTS_BASES = new Set(['), policy.indexOf('])', policy.indexOf('SHARED_RAG_RIGHTS_BASES')));
  assert.deepEqual([...RIGHTS_BASES], [...bases.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]));
  const notifications = read('../lib/materials/notifications.js') + read('../lib/materials/lifecycle.js');
  const states = new Set([...notifications.matchAll(/notificationStatus: (?:retry \? )?"([A-Z]+)"(?: : "([A-Z]+)")?/g)].flatMap((match) => [match[1], match[2]].filter(Boolean)));
  assert.ok(states.size >= 4, `teavituse seise leiti ${states.size}`);
  assert.deepEqual([...states].filter((state) => !NOTIFICATION_STATES.includes(state)), []);

  /* Säilitamise kihi seisud. */
  const retention = read('../lib/materials/retentionPolicy.js') + read('../lib/materials/retention.js') + submissions;
  const layerStates = new Set([...retention.matchAll(/(?:original|derivative|rag)RetentionState(?:: | \|\| )"([A-Z_]+)"/g)].map((match) => match[1]));
  assert.ok(layerStates.size >= 2, `kihi seise leiti ${layerStates.size}`);
  assert.deepEqual([...layerStates].filter((state) => !RETENTION_STATES.includes(state)), []);

  /* Faili valik: tüübid ja piirid tulevad samadest konstantidest, mida server kontrollib. */
  assert.equal(UPLOAD_LIMITS.count, getMaterialsFileCountLimit());
  assert.equal(UPLOAD_LIMITS.sizeMb * 1024 * 1024, MAX_DOCUMENT_SIZE_BYTES);
  assert.equal(UPLOAD_ACCEPT, '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain');
  assert.deepEqual(Object.values(ALLOWED_DOCUMENT_TYPES).flat(), ['.pdf', '.docx', '.txt']);
  for (const lang of LANGS) {
    assert.ok(catalogs[lang].materials_page.errors.file_count_exceeded.includes(String(UPLOAD_LIMITS.count)), `${lang}: failide arvu piir`);
    assert.ok(catalogs[lang].documents.errors.file_too_large.includes(String(UPLOAD_LIMITS.sizeMb)), `${lang}: faili suuruse piir`);
    const help = tOf(lang)('materials_page.views.send.file_help', { count: UPLOAD_LIMITS.count, size: UPLOAD_LIMITS.sizeMb });
    assert.ok(help.includes('PDF') && help.includes('DOCX') && help.includes('TXT') && help.includes('10') && help.includes('25'), lang);
  }
});

test('seis ja säilitamine on sõnad, mitte koodid', () => {
  assert.deepEqual(materialStatus('pending', t), { value: 'pending', text: 'Ootel', tone: 'wait' });
  assert.deepEqual(materialStatus('REJECTED', t), { value: 'rejected', text: 'Tagasi lükatud', tone: 'risk' });
  assert.deepEqual(materialStatus('archived', t), { value: '', text: 'Seis teadmata', tone: 'quiet' });

  const facts = retentionFacts(
    {
      original: { state: 'SCHEDULED', until: '2026-10-23T00:00:00.000Z' },
      derivative: { state: 'NOT_PRESENT', until: null },
      rag: { state: 'DELETED', until: '2026-09-01T00:00:00.000Z' }
    },
    { t, locale: 'et' }
  );
  assert.deepEqual(facts.map((fact) => fact.label), ['Originaalfail', 'Sanitiseeritud derivaat', 'RAG-koopia']);
  assert.match(facts[0].value, /^kuni .*2026/);
  assert.equal(facts[1].value, 'ei ole loodud');
  assert.equal(facts[2].value, 'kustutatud', 'kustutatud kiht ei näita vana tähtaega');
  /* Puuduv kirje ja tundmatu seis annavad sõna, mitte koodi ega võtit. */
  const blank = retentionFacts(undefined, { t, locale: 'et' });
  assert.deepEqual(blank.map((fact) => fact.value), ['ei ole loodud', 'ei ole loodud', 'ei ole loodud']);
  assert.equal(retentionFacts({ original: { state: 'ON_HOLD' } }, { t, locale: 'et' })[0].value, 'seis teadmata');
  assert.equal(retentionFacts({ original: { state: 'SCHEDULED' } }, { t, locale: 'et' })[0].value, 'säilitatakse');
  for (const lang of LANGS) {
    for (const fact of retentionFacts({ original: { state: 'SCHEDULED' }, rag: { state: 'WHATEVER' } }, { t: tOf(lang), locale: lang })) {
      assert.ok(!/[A-Z]{3,}_|materials_page\./.test(fact.value), `${lang}: ${fact.value}`);
    }
  }
});

test('minu materjalide rida on madal ja avatud materjal kannab kõike muud', () => {
  const item = {
    id: 'm1',
    originalName: 'juhend.pdf',
    status: 'rejected',
    size: 2048,
    comment: '  Kohaliku omavalitsuse juhend  ',
    createdAt: '2026-10-01T08:30:00.000Z',
    retention: { original: { state: 'SCHEDULED', until: '2026-10-31T00:00:00.000Z' } }
  };
  const [row] = mineRows([item], { t, locale: 'et' });
  assert.deepEqual(Object.keys(row), ['id', 'title', 'state', 'tone', 'date']);
  assert.equal(row.title, 'juhend.pdf');
  assert.equal(row.state, 'Tagasi lükatud');
  assert.ok(row.date);
  assert.deepEqual(mineRows(undefined, { t }), []);

  const sheet = materialSheet(item, { t, locale: 'et' });
  assert.equal(sheet.title, 'juhend.pdf');
  assert.equal(sheet.comment, 'Kohaliku omavalitsuse juhend');
  assert.equal(sheet.downloadHref, '/api/materials/m1/download');
  assert.deepEqual(sheet.facts.map((fact) => fact.key), ['sent', 'size', 'retention-original', 'retention-derivative', 'retention-rag']);
  assert.equal(sheet.facts[1].value, '2 KB');
  assert.equal(sheet.canWithdraw, true);
  /* Tagasi saab võtta ootel või tagasi lükatud materjali, nagu vanal lehel. */
  assert.deepEqual(MATERIAL_STATUSES.filter(canWithdraw), ['pending', 'rejected']);
  assert.equal(materialSheet({ ...item, id: 'a b', status: 'imported' }, { t }).canWithdraw, false);
  /* Administraatori loendis on ka teiste materjalid: võõrast siit tagasi võtta ei pakuta. */
  const foreign = { ...item, submittedByUser: { id: 'u2', email: 'teine@example.test' } };
  assert.equal(materialSheet(foreign, { t, viewerId: 'u1' }).canWithdraw, false);
  assert.equal(materialSheet(foreign, { t, viewerId: 'u2' }).canWithdraw, true);
  assert.equal(materialSheet({ ...item, id: 'a b' }, { t }).downloadHref, '/api/materials/a%20b/download');
});

test('faili valik: liiga palju või liiga suur fail öeldakse enne saatmist', () => {
  const file = (name, size = 10) => ({ name, size });
  assert.equal(uploadProblem([]), '');
  assert.equal(uploadProblem([file('a.pdf'), file('b.txt')]), '');
  assert.equal(uploadProblem(Array.from({ length: UPLOAD_LIMITS.count }, (_, index) => file(`${index}.pdf`))), '');
  assert.equal(uploadProblem(Array.from({ length: UPLOAD_LIMITS.count + 1 }, (_, index) => file(`${index}.pdf`))), 'materials_page.errors.file_count_exceeded');
  assert.equal(uploadProblem([file('suur.pdf', MAX_DOCUMENT_SIZE_BYTES + 1)]), 'documents.errors.file_too_large');
  assert.equal(uploadProblem([file('piiril.pdf', MAX_DOCUMENT_SIZE_BYTES)]), '');
  assert.deepEqual(fileRows([file('a.pdf', 2048), file('a.pdf', 2048)]), [
    { key: '0:a.pdf', name: 'a.pdf', size: '2 KB' },
    { key: '1:a.pdf', name: 'a.pdf', size: '2 KB' }
  ]);
});

test('ülevaatus: tegevus on lubatud ainult siis, kui server üleminekuga nõustub', () => {
  assert.deepEqual(reviewActions('pending'), { canReview: true, canReject: true, canImport: false });
  assert.deepEqual(reviewActions('reviewed'), { canReview: false, canReject: true, canImport: true });
  assert.deepEqual(reviewActions('rejected'), { canReview: true, canReject: false, canImport: false });
  assert.deepEqual(reviewActions('imported'), { canReview: false, canReject: false, canImport: false });
  assert.deepEqual(reviewActions('???'), { canReview: false, canReject: false, canImport: false });

  const options = statusFilterOptions(t);
  assert.deepEqual(options.map((option) => option.value), [FILTER_ALL, ...MATERIAL_STATUSES]);
  assert.equal(new Set(options.map((option) => option.value)).size, options.length);
  assert.ok(options.every((option) => option.value && option.label));

  const item = {
    id: 's1',
    originalName: 'uuring.docx',
    status: 'reviewed',
    size: 5 * 1024 * 1024,
    comment: '',
    createdAt: '2026-10-02T09:00:00.000Z',
    reviewedAt: '2026-10-03T10:00:00.000Z',
    reviewedBy: 'admin@example.ee',
    reviewNote: 'Sobib.',
    reviewRevision: 2,
    submittedByUser: { id: 'u1', email: 'mari@example.ee' },
    notification: { status: 'RETRY', attempts: 2, lastErrorCode: 'smtp_timeout' }
  };
  const [row] = submissionRows([item], { t, locale: 'et' });
  assert.deepEqual(Object.keys(row), ['id', 'title', 'sub', 'state', 'tone', 'date']);
  assert.equal(row.sub, 'mari@example.ee');
  assert.equal(row.state, 'Üle vaadatud');

  const sheet = submissionSheet(item, { t, locale: 'et' });
  assert.deepEqual(sheet.facts.map((fact) => fact.key), ['sent', 'size', 'submitter', 'review', 'retention-original', 'retention-derivative', 'retention-rag', 'notification']);
  assert.match(sheet.facts[3].value, / · admin@example\.ee$/);
  assert.equal(sheet.facts.at(-1).value, 'proovitakse uuesti, katseid 2 (veakood smtp_timeout)');
  assert.equal(sheet.reviewNote, 'Sobib.');
  assert.equal(sheet.comment, '');
  assert.equal(sheet.previewHref, '/api/materials/s1/preview');
  assert.equal(sheet.canImport, true);
  /* Ilma saatja, ülevaatuse ja teavituseta materjalil neid ridu ei ole. */
  assert.deepEqual(
    submissionSheet({ id: 's2', status: 'pending', createdAt: '2026-10-02T09:00:00.000Z' }, { t, locale: 'et' }).facts.map((fact) => fact.key),
    ['sent', 'size', 'retention-original', 'retention-derivative', 'retention-rag']
  );
  /* Loetamatu või puuduv kuupäev ei jäta ritta tühja nimetust. */
  assert.deepEqual(
    submissionSheet({ id: 's3', status: 'pending' }, { t, locale: 'et' }).facts.map((fact) => fact.key),
    ['size', 'retention-original', 'retention-derivative', 'retention-rag']
  );
  assert.equal(notificationText(null, t), '');
  assert.equal(notificationText({ status: 'SENT', attempts: 1 }, t), 'saadetud, katseid 1');
  assert.equal(notificationText({ status: 'QUEUED_SOMEHOW', attempts: 0 }, t), 'seis teadmata, katseid 0');
});

test('õiguste vorm: import avaneb, kui kõik on täidetud, ja päringu keha on sama mis enne', () => {
  const form = emptyRights();
  assert.equal(rightsReady(form), false);
  const filled = { authorName: 'A. Autor', rightsHolder: 'MTÜ', rightsBasis: 'OPEN_LICENSE', rightsEvidence: 'CC BY 4.0, leht 2', confirmed: true };
  assert.equal(rightsReady(filled), true);
  assert.equal(rightsReady({ ...filled, confirmed: false }), false);
  assert.equal(rightsReady({ ...filled, rightsBasis: 'ANYTHING' }), false);
  assert.equal(rightsReady({ ...filled, authorName: '   ' }), false);
  assert.deepEqual(rightsPayload(filled), {
    authorName: 'A. Autor',
    rightsHolder: 'MTÜ',
    rightsBasis: 'OPEN_LICENSE',
    rightsEvidence: 'CC BY 4.0, leht 2',
    clientCaseMaterial: false,
    confidential: false,
    containsPersonalData: false
  });
  assert.deepEqual(rightsBasisOptions(t).map((option) => option.value), [...RIGHTS_BASES]);
  assert.ok(rightsBasisOptions(t).every((option) => !/[A-Z]_[A-Z]/.test(option.label)));
});

/* --- Materjalid: lehe lubadused --------------------------------------------- */

test('materjalide loendi read kannavad oma märgid vaateni', () => {
  const views = read(MATERIALS_VIEWS);
  /* Iga väli, mida loendi rida vaates loeb, tuleb ridade tegijalt või lehelt. */
  const rows = views.slice(views.indexOf('export function Rows'), views.indexOf('export function MineListView'));
  const made = new Set([...Object.keys(submissionRows([{ id: 1 }], { t })[0]), ...Object.keys(mineRows([{ id: 1 }], { t })[0]), 'onOpen']);
  assert.deepEqual([...new Set([...rows.matchAll(/\brow\.(\w+)/g)].map((match) => match[1]))].filter((name) => !made.has(name)), []);
});

/* --- Abisoovid ja abipakkumised ---------------------------------------------- */

const ui = {
  helpOffers: 'Abipakkumised',
  myHelpRequests: 'Minu abisoovid',
  myHelpOffers: 'Minu abipakkumised',
  ownListing: 'Minu kuulutus',
  listingSingular: 'kuulutus',
  listingPlural: 'kuulutust'
};

test('kuulutuste read: minu omad enne, rühma pealkiri ainult siis, kui mõlemad rühmad on olemas', () => {
  const items = [
    { kind: 'request', id: 'a', title: 'Abisoov: Koduabi - Tartu linn', summary: 'Koduabi, Tartu linn', status: 'MATCHED', statusLabel: 'Ühendatud', isOwn: false },
    { kind: 'request', id: 'b', title: 'Abisoov: Transport', summary: '', status: 'OPEN', statusLabel: 'Aktiivne', isOwn: true },
    { kind: 'request', id: 'c', title: 'Abisoov: Nõustamine', summary: 'Nõustamine' }
  ];
  const rows = listingRows(items, ui);
  assert.equal(rows[0].key, 'request-a');
  assert.deepEqual(rows[0].chips, [{ key: 'status', text: 'Ühendatud', tone: 'quiet' }]);
  assert.deepEqual(rows[1].chips.map((chip) => chip.text), ['Minu kuulutus'], 'avatud kuulutuste loendis „Aktiivne" igal real ei seisa');
  assert.deepEqual(rows[2].chips, []);
  assert.equal(rows[1].item, items[1], 'rida kannab kuulutust, mille avamise tegevus saab');

  const groups = listingGroups(rows, { kind: 'request', ui, othersLabel: 'Teiste abisoovid' });
  assert.deepEqual(groups.map((group) => [group.key, group.label, group.rows.map((row) => row.key)]), [
    ['own', 'Minu abisoovid', ['request-b']],
    ['others', 'Teiste abisoovid', ['request-a', 'request-c']]
  ]);
  /* Ainult üks rühm: pealkirja ei ole (minu kuulutuse märk real ütleb sama). */
  assert.deepEqual(listingGroups(rows.filter((row) => row.own), { kind: 'request', ui, othersLabel: 'x' }), [{ key: 'own', label: '', rows: [rows[1]] }]);
  assert.deepEqual(listingGroups(rows.filter((row) => !row.own), { kind: 'offer', ui, othersLabel: 'x' }).map((group) => group.label), ['']);
  assert.equal(listingGroups(listingRows([{ kind: 'offer', id: 1, isOwn: true }, { kind: 'offer', id: 2 }], ui), { kind: 'offer', ui, othersLabel: 'Teiste abipakkumised' })[0].label, 'Minu abipakkumised');
  assert.deepEqual(listingGroups([], { ui }), []);
  assert.deepEqual(listingRows(null, ui), []);
});

test('loendi liik ja kuulutuste arv', () => {
  assert.equal(listingKind({ items: [{ kind: 'offer' }], ui }), 'offer');
  assert.equal(listingKind({ items: [{ kind: 'request' }], infoId: 'help_offers', ui }), 'request', 'ridade liik otsustab');
  assert.equal(listingKind({ items: [], infoId: 'help_offers', ui }), 'offer');
  assert.equal(listingKind({ items: [], title: 'Abipakkumised', ui }), 'offer');
  assert.equal(listingKind({ items: [], title: 'Abisoovid', ui }), 'request');
  assert.equal(listingKind(), 'request');

  assert.equal(listingCountText(3, { ui }), '3 kuulutust');
  assert.equal(listingCountText(1, { ui }), '1 kuulutus');
  assert.equal(listingCountText(0, { ui }), '', 'tühja loendi kohta ütleb tühja loendi tekst');
  assert.equal(listingCountText(10, { ui, complete: false }), '', 'laaditud ridade arv ei ole koguarv, kui loendil on järg');
});

/* --- Kest: töölaua paneel ja üldfailid ---------------------------------------- */
