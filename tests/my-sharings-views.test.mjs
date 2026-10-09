// „Minu jagamised": laua osad, read, tekstid ja lehe lubadused.
//
// Leht oli üks pikk veerg kaheteistkümne sektsiooniga; nüüd on see sammulava laud
// (components/sharings/desk). Test hoiab seda, mida silm kergesti ei märka: puuduv
// tõlkevõti, nimeta osa, toores serveri kood ekraanil, ühe vajutusega tagasivõtt või
// otsus, päring, mille keha on vaikselt muutunud, ja märk, mis mudelist vaateni ei jõua.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONFIRMED_ACTIONS,
  CORRECTION_LIMITS,
  OPENING_SECTIONS,
  SECTION_ORDER,
  SECTION_TEXTS,
  SHARE_ERROR_KEYS,
  STATE_WORDS,
  UNAVAILABLE_STATUSES,
  correctionProblem,
  deskLead,
  excerpt,
  mentoringState,
  opensItems,
  preInquiryState,
  shareErrorText,
  sharingParts,
  sharingRows,
  sharingSheet,
  stateWord
} from '../components/sharings/desk/sharingRows.js';
import { SHARING_SECTION_KEYS } from '../lib/sharings/registry.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalogs = new Map();
const catalog = (lang) => {
  if (!catalogs.has(lang)) catalogs.set(lang, JSON.parse(read(`../messages/${lang}.json`)));
  return catalogs.get(lang);
};
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGE = '../components/sharings/MySharingsPage.jsx';
const VIEWS = '../components/sharings/desk/SharingsViews.jsx';
const ROWS = '../components/sharings/desk/sharingRows.js';
const FACTS = '../components/sharings/OwnershipBar.jsx';
const STYLES = '../components/sharings/desk/sharings.module.css';
const SOURCES = [PAGE, VIEWS, ROWS, FACTS];

/* Tõlkija, mis näitab, mis võtmega ja mis muutujatega teksti küsiti. */
const t = (key, vars) => (vars && typeof vars === 'object' ? `[${key} ${Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(' ')}]` : `[${key}]`);
const formatDate = (value) => (value ? `kp:${String(value).slice(0, 10)}` : '[aeg teadmata]');
const formatDay = (value) => (value ? `päev:${String(value).slice(0, 10)}` : '[aeg teadmata]');
const formatMonth = (value) => `kuu:${value}`;
const context = { t, formatDate, formatDay, formatMonth };

/* Päris eestikeelne tõlkija: nii nagu platvormi oma, tagastab puuduva sõna asemel võtme. */
const et = catalog('et');
const tEt = (key, vars) => {
  const value = at(et, key);
  if (typeof value !== 'string') return key;
  return vars && typeof vars === 'object' ? value.replace(/\{(\w+)\}/g, (mark, name) => (name in vars ? String(vars[name]) : mark)) : value;
};
const contextEt = { t: tEt, formatDate, formatDay, formatMonth };

/* Serveri loend failist `prisma/schema.prisma` (kommentaarid välja). */
function schemaEnum(name) {
  const schema = read('../prisma/schema.prisma');
  const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)?.[1];
  assert.ok(body, `enum ${name} on skeemis olemas`);
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
}

const SAMPLES = {
  networkShares: [
    { id: 'n0', status: 'CONFIRMED', summaryText: 'Vana kokkuvõte', purpose: 'Varasem kaasamine', sharingBoundary: 'Ainult teenuse vajadus' },
    {
      id: 'n1',
      status: 'AWAITING_CLIENT',
      awaitingDecision: true,
      summaryText: 'Kokkuvõte, mille üle otsustan',
      purpose: 'Koduteenuse korraldamine',
      sharingBoundary: 'Jagatakse liikumist, mitte tervist',
      participationEndsOn: '2026-12-01T00:00:00.000Z',
      contentHash: 'hash-1'
    }
  ],
  urgentRequests: [
    { id: 'u1', status: 'SENT', situationVerbatim: 'Mul ei ole täna öösel kuhugi minna.', readingTimePromise: 'Loeme kahe tunni jooksul', sentAt: '2026-10-09T10:00:00.000Z', canRecall: true },
    { id: 'u2', status: 'DECLINED', situationVerbatim: 'Teine abipalve', readingTimePromise: '', declineReason: 'Ei ole selle omavalitsuse elanik', sentAt: '2026-10-01T10:00:00.000Z', canRecall: false }
  ],
  preInquiries: [
    { id: 'p1', topic: 'Koduteenus', recipientLabel: 'Tartu Linnavalitsus', deliveryChannel: 'INTERNAL', status: 'SENT', sentAt: '2026-10-08T10:00:00.000Z', updatedAt: '2026-10-08T10:00:00.000Z', canRecall: true, canCorrect: false },
    { id: 'p2', topic: '', recipientLabel: '', deliveryChannel: 'EXTERNAL_EMAIL', status: 'SENT', sentAt: '2026-10-01T10:00:00.000Z', canRecall: false, canCorrect: false },
    { id: 'p3', topic: 'Toetus', recipientLabel: 'Elva vald', deliveryChannel: 'INTERNAL', status: 'READY', sentAt: '2026-09-01T10:00:00.000Z', openedAt: '2026-09-02T10:00:00.000Z', canRecall: false, canCorrect: true }
  ],
  rooms: [
    { id: 'r1', title: 'Pere tugiring', role: 'MEMBER', canLeave: true },
    { id: 'r2', title: '', role: 'OWNER', canLeave: false }
  ],
  invites: [{ id: 'i1', roomTitle: 'Pere tugiring', inviteeEmail: 'kolleeg@example.test', status: 'SENT', expiresAt: '2026-10-20T10:00:00.000Z', canRevoke: true }],
  helpListings: [
    { id: 'h1', kind: 'request', title: 'Vajan abi poes käimisel', status: 'CLOSED', mapVisibility: 'HIDDEN' },
    { id: 'h1', kind: 'offer', title: '', status: 'OPEN', mapVisibility: 'PUBLIC', expiresAt: '2026-11-01T10:00:00.000Z' }
  ],
  mentoringPreparations: [
    { id: 'm1', relationId: 'rel-1', sharedAt: '2026-10-01T10:00:00.000Z', createdAt: '2026-09-30T10:00:00.000Z', canRecall: true },
    { id: 'm2', relationId: null, sharedAt: '2026-10-01T10:00:00.000Z', createdAt: '2026-09-30T10:00:00.000Z', canRecall: false }
  ],
  outgoingNetworkShares: [{ id: 'o1', status: 'AWAITING_CLIENT', recipientLabel: 'Mari Maasikas', participationEndsOn: '2026-12-01T00:00:00.000Z' }],
  wellbeingSupportShares: [{ id: 'w1', status: 'CORRECTED', recipientLabel: '', organizationName: 'Hooldekodu' }],
  serviceReportShares: [{ id: 's1', status: 'OPENED', month: '2026-09', recipientLabel: 'Osakonna juht' }],
  roomSummaries: [{ id: 'rs1', title: '', roomTitle: 'Pere tugiring', sharedAt: '2026-10-05T10:00:00.000Z' }],
  privateRecords: [
    { id: 'f1', privateType: 'FRAMEWORK_ACCEPTANCE', frameworkKey: 'WORKER_DATA_PROCESSING', frameworkVersion: '2026-10-03', createdAt: '2026-10-03T10:00:00.000Z' },
    { id: 'f1', privateType: 'MENTORING_PREPARATION', createdAt: '2026-10-04T10:00:00.000Z' },
    { id: 'f3', privateType: 'FRAMEWORK_ACCEPTANCE', frameworkKey: 'SOMETHING_NEW', createdAt: '2026-10-04T10:00:00.000Z' }
  ]
};

const sectionsFrom = (data, ctx = context, statuses = {}) =>
  Object.fromEntries(SECTION_ORDER.map((key) => [key, { rows: sharingRows(key, data[key] || [], ctx), status: statuses[key] || (data[key]?.length ? 'READY' : 'EMPTY') }]));

function tableKeys() {
  const keys = new Set();
  for (const texts of Object.values(SECTION_TEXTS)) for (const key of Object.values(texts)) keys.add(key);
  for (const words of Object.values(STATE_WORDS)) for (const entry of Object.values(words)) keys.add(entry.key);
  for (const words of Object.values(CONFIRMED_ACTIONS)) for (const key of Object.values(words)) keys.add(key);
  for (const key of Object.values(SHARE_ERROR_KEYS)) keys.add(key);
  keys.add(correctionProblem({ situation: '', text: 'x' }));
  keys.add(correctionProblem({ situation: 'x', text: '' }));
  return keys;
}

function literalKeys() {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Ainult täielikud võtmed: tabelist tulevad võtmed kontrollib `tableKeys`. */
    for (const match of read(source).matchAll(/\bt\(\s*(?:[a-zA-Z.?! =]+\?\s*)?"([a-z_]+(?:\.[A-Za-z0-9_]+)+)"/g)) keys.add(match[1]);
    for (const match of read(source).matchAll(/[?:]\s*"((?:my_sharings|urgent|auth|pre_inquiries)\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  return keys;
}

test('iga tekstivõti, mida leht, vaated ja read kasutavad, on kataloogis kolmes keeles', () => {
  const keys = new Set([...literalKeys(), ...tableKeys()]);
  assert.ok(keys.size > 120, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string' || !at(messages, key).trim()), [], lang);
  }
  /* Kohatäitjad on kõigis keeltes samad (muidu jääks `{date}` ekraanile). */
  const marks = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of keys) {
    for (const lang of ['en', 'ru']) assert.deepEqual(marks(at(catalog(lang), key)), marks(at(et, key)), `${lang}: ${key}`);
  }
});

test('laual on täpselt serveri osad ja igal osal on nimi, lühinimi, selgitus ja tühjuse lause', () => {
  assert.deepEqual([...SECTION_ORDER].sort(), [...SHARING_SECTION_KEYS].sort());
  assert.deepEqual(Object.keys(SECTION_TEXTS).sort(), [...SECTION_ORDER].sort());
  /* Lehe enda tühi seis katab samad osad: muidu jääks osa vastusest välja. */
  const page = read(PAGE);
  const empty = page.slice(page.indexOf('const EMPTY_SHARINGS'), page.indexOf('});', page.indexOf('const EMPTY_SHARINGS')));
  assert.deepEqual([...empty.matchAll(/^\s+([A-Za-z]+): \[\]/gm)].map((match) => match[1]).sort(), [...SECTION_ORDER].sort());
  /* Otsust ootavad ettepanekud on laual esimesed. */
  assert.equal(SECTION_ORDER[0], 'networkShares');
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const key of SECTION_ORDER) {
      const texts = SECTION_TEXTS[key];
      for (const part of ['title', 'short', 'help', 'empty']) assert.equal(typeof at(messages, texts[part]), 'string', `${lang}: ${key}.${part}`);
      assert.ok(at(messages, texts.short).length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse (${at(messages, texts.short)})`);
    }
    for (const mark of ['{current}', '{total}', '{label}']) assert.ok(messages.my_sharings.views.position.includes(mark), `${lang}: ${mark}`);
    assert.ok(messages.my_sharings.views.all.length <= 18, `${lang}: laia vaate nimi mahub kiirmenüüsse`);
  }
});

test('lisatud eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const added = [];
  const walk = (node) => (typeof node === 'string' ? added.push(node) : Object.values(node).forEach(walk));
  walk(et.my_sharings.views);
  added.push(et.my_sharings.status.closed, et.my_sharings.status.cancelled);
  assert.ok(added.length >= 30, `tekste leiti ${added.length}`);
  for (const value of added) assert.equal(/[—–"]/.test(value), false, value);
});

test('seisude loendid on samad mis serveris', () => {
  const upper = (kind) => Object.keys(STATE_WORDS[kind]).sort();
  assert.deepEqual(upper('incomingShare'), schemaEnum('NetworkShareStatus').sort());
  assert.deepEqual(upper('outgoingShare'), schemaEnum('NetworkShareStatus').sort());
  assert.deepEqual(upper('urgent'), schemaEnum('UrgentRequestStatus').sort());
  assert.deepEqual(upper('supportShare'), schemaEnum('WellbeingSupportShareStatus').sort());
  assert.deepEqual(upper('roomRole'), schemaEnum('RoomRole').sort());
  /* Mustandit server abikirjete hulka ei anna; ettevalmistuses aruannet samuti mitte. */
  assert.deepEqual(upper('help'), schemaEnum('HelpRecordStatus').filter((status) => status !== 'DRAFT').sort());
  assert.deepEqual(upper('reportShare'), schemaEnum('ServiceReportShareStatus').filter((status) => status !== 'PREPARING').sort());
  /* Saadetud eelpöördumine: olekud, mis saadetud real olla saavad, ja kaks väljadest tulevat seisu. */
  const sent = schemaEnum('PreInquiryStatus').filter((status) => !['DRAFT', 'DOWNLOADED'].includes(status));
  assert.deepEqual(upper('preInquiry'), [...sent, 'RECALLED', 'SUPERSEDED'].sort());
  /* Server annab siia ainult kehtivad kutsed. */
  const loader = read('../lib/mySharings.js');
  assert.match(loader, /status: \{ in: \["PENDING_PAYMENT", "SENT"\] \}/);
  assert.deepEqual(upper('invite'), ['PENDING_PAYMENT', 'SENT']);
  for (const status of upper('invite')) assert.ok(schemaEnum('InviteStatus').includes(status), status);
  /* Abikirje kaardinähtavus: serveri loend failist (teenuskiht toob andmebaasi kaasa). */
  const map = read('../lib/help/mapEntries.js');
  const block = map.slice(map.indexOf('HELP_MAP_VISIBILITY = Object.freeze({'), map.indexOf('});', map.indexOf('HELP_MAP_VISIBILITY = Object.freeze({')));
  const visibility = [...block.matchAll(/^\s+([A-Z_]+): "/gm)].map((match) => match[1]).sort();
  assert.ok(visibility.length >= 6, `kaardinähtavusi leiti ${visibility.length}`);
  assert.deepEqual(upper('helpMap'), visibility);
  assert.deepEqual([...UNAVAILABLE_STATUSES].sort(), ['TIMEOUT', 'UNAVAILABLE']);
  assert.match(loader, /UNAVAILABLE: "UNAVAILABLE",\s+TIMEOUT: "TIMEOUT"/);
});

test('tundmatu kood ega puuduv sõna ei jõua ekraanile toore koodi ega võtmena', () => {
  for (const kind of Object.keys(STATE_WORDS)) {
    assert.deepEqual(stateWord(kind, 'SOMETHING_NEW', t), { text: '', tone: 'quiet' }, kind);
    assert.equal(stateWord(kind, null, t).text, '', kind);
    /* Tõlkija, mis tagastab puuduva sõna asemel võtme (nagu platvormi oma). */
    for (const code of Object.keys(STATE_WORDS[kind])) assert.equal(stateWord(kind, code, (key) => key).text, '', `${kind}.${code}`);
  }
  assert.equal(stateWord('noSuchKind', 'SENT', t).text, '');
  assert.equal(stateWord('urgent', 'sent', t).text, '[urgent.status.SENT]');
  assert.equal(preInquiryState({ status: 'SENT', recalledAt: '2026-10-01' }), 'RECALLED');
  assert.equal(preInquiryState({ status: 'READY', supersededById: 'p9' }), 'SUPERSEDED');
  assert.equal(preInquiryState({ status: 'ready' }), 'READY');
  assert.equal(preInquiryState({}), 'SENT');
  assert.equal(mentoringState({ sharedAt: 'x', openedAt: 'y', recalledAt: 'z' }), 'RECALLED');
  assert.equal(mentoringState({ sharedAt: 'x', openedAt: 'y' }), 'OPENED');
  assert.equal(mentoringState({ sharedAt: 'x' }), 'SHARED');
  assert.equal(mentoringState({}), 'PRIVATE');

  /* Päris kataloogiga: üheski reas ega avatud kirjes ei ole serveri koodi ega võtit. */
  const leaked = [];
  const scan = (label, node) => {
    if (typeof node === 'string') {
      if (/\b[A-Z]{3,}_[A-Z_]+\b/.test(node) || /^(my_sharings|urgent|network_share|org|auth)\./.test(node) || /\b(AWAITING_CLIENT|CORRECTED|OPENED|CLOSED|SENT|OPEN|READY)\b/.test(node)) leaked.push(`${label}: ${node}`);
    } else if (node && typeof node === 'object') Object.entries(node).forEach(([name, value]) => (['key', 'id', 'can', 'tone'].includes(name) ? null : scan(`${label}.${name}`, value)));
  };
  for (const key of SECTION_ORDER) {
    SAMPLES[key].forEach((item) => scan(key, sharingSheet(key, item, contextEt)));
    scan(key, sharingRows(key, [{ ...SAMPLES[key][0], status: 'SOMETHING_NEW', role: 'SOMETHING_NEW', mapVisibility: 'SOMETHING_NEW', kind: 'something_new' }], contextEt)
      .map(({ key: _key, id: _id, ...row }) => row));
  }
  assert.deepEqual(leaked, []);
  /* Raamistiku sisemine võti ja kuu toores kuju ei ole pealkirjas ega ajas. */
  const privateRows = sharingRows('privateRecords', SAMPLES.privateRecords, contextEt);
  assert.deepEqual(privateRows.map((row) => row.title), [et.auth.register.worker_framework_title, et.my_sharings.mentoring.item_title, et.my_sharings.labels.private_record]);
  assert.equal(sharingRows('serviceReportShares', SAMPLES.serviceReportShares, context)[0].time, 'kuu:2026-09');
});

test('avatava osa rida kannab pealkirja, seisu ja „kes näeb"; otsust ootav rida on märgitud', () => {
  assert.deepEqual([...OPENING_SECTIONS].sort(), ['invites', 'mentoringPreparations', 'networkShares', 'preInquiries', 'rooms', 'urgentRequests']);
  for (const key of SECTION_ORDER) {
    const rows = sharingRows(key, SAMPLES[key], context);
    assert.equal(rows.length, SAMPLES[key].length, key);
    assert.equal(new Set(rows.map((row) => row.key)).size, rows.length, `${key}: võtmed on erinevad ka sama id korral`);
    for (const row of rows) {
      assert.ok(row.title && row.id, `${key}: pealkiri ja id`);
      if (opensItems(key)) assert.ok(row.sub, `${key}: avataval real on rida pealkirja all`);
      /* Kirjel, mida ei avata, on kolm fakti real endal. */
      else assert.ok(row.facts?.visibility && row.facts.origin && row.facts.validity, `${key}: kolm fakti real`);
    }
  }
  const [older, waiting] = sharingRows('networkShares', SAMPLES.networkShares, context);
  assert.equal(waiting.attention, true);
  assert.equal(waiting.chip, '[my_sharings.labels.awaiting_your_decision]');
  assert.equal(waiting.tone, 'wait');
  assert.equal(waiting.sub, 'Koduteenuse korraldamine');
  assert.equal(older.attention, false);
  assert.equal(older.chip, '[my_sharings.share_status.CONFIRMED]');

  const [internal, external, opened] = sharingRows('preInquiries', SAMPLES.preInquiries, context);
  assert.equal(internal.title, 'Koduteenus');
  assert.equal(internal.sub, '[my_sharings.ownership.shared_with name=Tartu Linnavalitsus]');
  assert.equal(internal.sub, internal.facts.visibility);
  assert.equal(internal.facts.validity, '[my_sharings.ownership.until_recall]');
  /* Väline e-kiri on eraldi märgitud ja adressaadita kirje ütleb seda sõnaga. */
  assert.equal(external.title, '[my_sharings.labels.unknown_recipient]');
  assert.equal(external.facts.visibility, '[my_sharings.ownership.external_email name=[my_sharings.labels.unknown_recipient]]');
  assert.equal(external.facts.validity, '[my_sharings.ownership.external_final]');
  assert.equal(opened.facts.validity, '[my_sharings.ownership.opened date=kp:2026-09-02]');
  assert.equal(opened.chip, '[my_sharings.status.ready]');

  const [member, owner] = sharingRows('rooms', SAMPLES.rooms, context);
  assert.equal(member.chip, '[my_sharings.labels.room_member]');
  assert.equal(member.facts.validity, '[my_sharings.ownership.active]');
  assert.equal(owner.chip, '[my_sharings.labels.room_owner]');
  assert.equal(owner.facts.validity, '[my_sharings.ownership.owner]');
  assert.equal(owner.title, '[my_sharings.sections.rooms]');

  const [invite] = sharingRows('invites', SAMPLES.invites, context);
  assert.equal(invite.time, invite.facts.validity);
  /* Avatud kutses on aegumine faktina: märkide real seda ei korrata. */
  assert.equal(sharingSheet('invites', SAMPLES.invites[0], context).time, '');
  assert.equal(invite.facts.visibility, '[my_sharings.ownership.invite_recipient name=kolleeg@example.test]');

  /* Töötaja enda saadetud jagamine: seis töötaja vaatest, mitte „ootab sinu otsust". */
  assert.equal(sharingRows('outgoingNetworkShares', SAMPLES.outgoingNetworkShares, context)[0].chip, '[network_share.status.AWAITING_CLIENT]');
  assert.equal(sharingRows('outgoingNetworkShares', SAMPLES.outgoingNetworkShares, contextEt)[0].chip, et.network_share.status.AWAITING_CLIENT);
  /* Kaasamise lõpp on kuupäev (`@db.Date`): kellaaega selle kõrval ei näidata. */
  assert.match(read('../prisma/schema.prisma'), /participationEndsOn\s+DateTime\s+@db\.Date/);
  assert.equal(sharingRows('outgoingNetworkShares', SAMPLES.outgoingNetworkShares, context)[0].facts.validity, '[my_sharings.ownership.expires date=päev:2026-12-01]');
  assert.equal(sharingRows('wellbeingSupportShares', SAMPLES.wellbeingSupportShares, context)[0].title, 'Hooldekodu');

  const [request, offer] = sharingRows('helpListings', SAMPLES.helpListings, context);
  assert.deepEqual([request.key, offer.key], ['request:h1', 'offer:h1']);
  assert.equal(request.kind, '[my_sharings.labels.request]');
  assert.equal(request.chip, '[my_sharings.status.closed]');
  assert.equal(request.facts.visibility, '[my_sharings.ownership.help_map_hidden]');
  assert.equal(offer.title, '[my_sharings.labels.offer]');
  /* Pealkirjata kirjel on liik pealkirjas: märgina seda ei korrata. */
  assert.equal(offer.kind, '');
  assert.equal(offer.facts.validity, '[my_sharings.ownership.expires date=kp:2026-11-01]');
  /* Puuduv kaardiseis loeb nagu enne: vajab parandamist, ei ole avalik. */
  assert.equal(sharingRows('helpListings', [{ id: 'h9', kind: 'offer', status: 'OPEN' }], context)[0].facts.visibility, '[my_sharings.ownership.help_map_out_of_sync]');
  /* Tundmatu liigiga ja pealkirjata abikirje ei jää nimeta ega trüki liigi koodi. */
  assert.equal(sharingRows('helpListings', [{ id: 'h8', kind: 'something_new', status: 'OPEN' }], context)[0].title, '[my_sharings.sections.help]');

  assert.deepEqual(sharingRows('noSuchSection', [{ id: 'x' }], context), []);
  assert.deepEqual(sharingRows('rooms', null, context), []);
  assert.equal(excerpt('  esimene\n\nteine   kolmas '), 'esimene teine kolmas');
  assert.ok(excerpt('a'.repeat(300)).length <= 121);
});

test('avatud kirje: jagatav tekst, sildiga laused, märkused ja see, mida kirjega teha saab', () => {
  const share = sharingSheet('networkShares', SAMPLES.networkShares[1], context);
  assert.equal(share.text, 'Kokkuvõte, mille üle otsustan');
  assert.deepEqual(share.details.map((detail) => detail.key), ['purpose', 'boundary', 'ends']);
  /* Jagamispiir on avatud kirjes alati näha. */
  assert.equal(share.details[1].value, 'Jagatakse liikumist, mitte tervist');
  assert.equal(share.details[2].value, 'päev:2026-12-01');
  assert.equal(share.can.decide, true);
  /* Otsuse juures seisab sama lause mis osa loendi kohal: kes küsib ja et otsustab inimene ise. */
  assert.equal(share.lead, '[my_sharings.section_help.network_shares]');
  assert.equal(sharingSheet('rooms', SAMPLES.rooms[0], context).lead, '');
  assert.equal(sharingSheet('networkShares', SAMPLES.networkShares[0], context).can.decide, false);

  const urgent = sharingSheet('urgentRequests', SAMPLES.urgentRequests[0], context);
  assert.equal(urgent.text, 'Mul ei ole täna öösel kuhugi minna.');
  assert.equal(urgent.can.recallUrgent, true);
  assert.equal(urgent.hint, '[urgent.sent.recall_hint]');
  const declined = sharingSheet('urgentRequests', SAMPLES.urgentRequests[1], context);
  assert.deepEqual(declined.details.map((detail) => detail.key), ['decline']);
  assert.equal(declined.details[0].value, 'Ei ole selle omavalitsuse elanik');
  assert.equal(declined.can.recallUrgent, false);
  assert.equal(declined.hint, '');

  const sent = sharingSheet('preInquiries', SAMPLES.preInquiries[0], context);
  /* Tagasivõtu piir seisab iga avatud eelpöördumise juures. */
  assert.deepEqual(sent.notes, ['[my_sharings.notice.memory]']);
  assert.deepEqual([sent.can.recall, sent.can.correct], [true, false]);
  const openedSheet = sharingSheet('preInquiries', SAMPLES.preInquiries[2], context);
  assert.deepEqual([openedSheet.can.recall, openedSheet.can.correct], [false, true]);
  assert.ok(sent.facts.visibility && sent.facts.origin && sent.facts.validity);

  assert.equal(sharingSheet('rooms', SAMPLES.rooms[0], context).can.leave, true);
  assert.equal(sharingSheet('rooms', SAMPLES.rooms[1], context).can.leave, false);
  assert.equal(sharingSheet('invites', SAMPLES.invites[0], context).can.revoke, true);

  const withRelation = sharingSheet('mentoringPreparations', SAMPLES.mentoringPreparations[0], context);
  assert.deepEqual([withRelation.can.mentoringRecall, withRelation.can.relationId], [true, 'rel-1']);
  assert.deepEqual(withRelation.notes, []);
  /* Suhte viiteta jagatud ettevalmistus: tagasivõttu ei ole ja leht ütleb, miks. */
  const stranded = sharingSheet('mentoringPreparations', SAMPLES.mentoringPreparations[1], context);
  assert.deepEqual([stranded.can.mentoringRecall, stranded.can.relationId], [false, '']);
  assert.deepEqual(stranded.notes, ['[my_sharings.mentoring.action_unavailable]']);

  /* Osa, mille kirjet ei avata, ei luba ühtegi tegevust. */
  for (const key of SECTION_ORDER.filter((section) => !opensItems(section))) {
    const sheet = sharingSheet(key, SAMPLES[key][0], context);
    assert.ok(Object.values(sheet.can).every((value) => !value), key);
  }
  assert.equal(sharingSheet('noSuchSection', { id: 'x' }, context), null);
});

test('laua plaat ütleb sõnadega, mis osas ootab; otsust ootav osa on märgitud ka siis, kui see rida ei ole esimene', () => {
  const sections = sectionsFrom(SAMPLES);
  const parts = sharingParts({ t, sections });
  assert.deepEqual(parts.map((part) => part.key), [...SECTION_ORDER]);
  const byKey = Object.fromEntries(parts.map((part) => [part.key, part]));

  assert.equal(byKey.networkShares.attention, true);
  assert.equal(byKey.networkShares.flag, '[my_sharings.labels.awaiting_your_decision]');
  assert.equal(byKey.networkShares.state, 'done');
  /* Plaat näitab otsust ootavat rida (loendis teine) ega korda selle seisu. */
  assert.equal(byKey.networkShares.summary, '[my_sharings.labels.share_incoming] [my_sharings.views.more]');

  assert.equal(byKey.preInquiries.summary, 'Koduteenus ([my_sharings.status.sent]) [my_sharings.views.more]');
  assert.equal(byKey.invites.summary, 'Pere tugiring ([my_sharings.status.sent])');
  assert.equal(byKey.roomSummaries.summary, 'Pere tugiring');
  for (const part of parts.filter((item) => item.key !== 'networkShares')) {
    assert.deepEqual([part.attention, part.flag, part.state], [false, '', 'partial'], part.key);
    assert.equal(part.free, true);
  }
  /* Ridade arvu plaadil ei ole. */
  const plain = sharingParts({ t: tEt, sections: sectionsFrom({ rooms: SAMPLES.rooms, invites: [] }, contextEt) });
  for (const part of plain) assert.equal(/\d/.test(part.summary), false, part.summary);

  /* Tühi osa ütleb, et kirjeid ei ole; laadimata osa ütleb põhjuse, mitte „ei ole". */
  const empty = sharingParts({ t, sections: sectionsFrom({}, context, { rooms: 'UNAVAILABLE', invites: 'TIMEOUT' }) });
  const emptyByKey = Object.fromEntries(empty.map((part) => [part.key, part]));
  assert.equal(emptyByKey.preInquiries.summary, '[my_sharings.empty.pre_inquiries]');
  assert.equal(emptyByKey.mentoringPreparations.summary, '[my_sharings.mentoring.empty]');
  assert.equal(emptyByKey.rooms.summary, '[my_sharings.views.tile_unavailable]');
  assert.equal(emptyByKey.invites.summary, '[my_sharings.views.tile_timeout]');
  assert.ok(empty.every((part) => part.state === 'empty' && !part.attention));
  assert.equal(sharingParts({ t, sections: undefined }).length, SECTION_ORDER.length);
});

test('lause laua kohal: otsust ootav ettepanek; „jagamisi ei ole" ainult siis, kui kõik osad laadisid ja on tühjad', () => {
  const full = sectionsFrom(SAMPLES);
  assert.deepEqual(deskLead({ t, parts: sharingParts({ t, sections: full }), sections: full }), { key: 'attention', text: '[my_sharings.views.attention]' });
  const none = sectionsFrom({});
  assert.deepEqual(deskLead({ t, parts: sharingParts({ t, sections: none }), sections: none }), { key: 'empty', text: '[my_sharings.empty_all]' });
  const broken = sectionsFrom({}, context, { rooms: 'TIMEOUT' });
  assert.equal(deskLead({ t, parts: sharingParts({ t, sections: broken }), sections: broken }), null);
  const some = sectionsFrom({ rooms: SAMPLES.rooms });
  assert.equal(deskLead({ t, parts: sharingParts({ t, sections: some }), sections: some }), null);
});

test('parandus ja otsuse viga: tühi parandus ei lähe teele ja veakood ei jõua ekraanile', () => {
  assert.equal(correctionProblem({ situation: '   ', text: 'tekst' }), 'pre_inquiries.errors.situation_required');
  assert.equal(correctionProblem({ situation: 'olukord', text: '' }), 'pre_inquiries.errors.correction_required');
  assert.equal(correctionProblem({ topic: '', situation: 'olukord', text: 'tekst' }), '');
  /* Samad laused ja piirid, mis serveril. */
  const route = read('../app/api/pre-inquiries/[id]/corrections/route.js');
  assert.ok(route.includes('"pre_inquiries.errors.situation_required"') && route.includes('"pre_inquiries.errors.correction_required"'));
  const service = read('../lib/preInquiries.js');
  assert.match(service, /MAX_SHORT_TEXT_LENGTH = 1_000;/);
  assert.match(service, /MAX_TEXT_LENGTH = 12_000;/);
  assert.deepEqual({ ...CORRECTION_LIMITS }, { topic: 1000, situation: 12000, text: 12000 });

  assert.equal(shareErrorText('network_share.content_changed', t), '[my_sharings.share_errors.content_changed]');
  assert.equal(shareErrorText(' network_share.not_awaiting_client ', tEt), et.my_sharings.share_errors.not_awaiting_client);
  for (const foreign of ['network_share.code_that_does_not_exist', 'relation "NetworkShare" does not exist', 'my_sharings.share_errors.content_changed', '', null, undefined, 42]) {
    assert.equal(shareErrorText(foreign, t), '', String(foreign));
  }
  /* Tõlkija, mis tagastab võtme, ei lase võtit ekraanile. */
  assert.equal(shareErrorText('network_share.not_found', (key) => key), '');
});

test('iga otsus, tagasivõtt ja lahkumine küsib teist vajutust ja tagajärg seisab nupu kõrval', () => {
  const page = read(PAGE);
  const views = read(VIEWS);
  assert.deepEqual(Object.keys(CONFIRMED_ACTIONS).sort(), ['leave', 'mentoringRecall', 'recall', 'revoke', 'shareConfirm', 'shareDecline', 'urgentRecall']);
  /* Tagajärje lause on neljal vanal tegevusel sama, mis varem kinnitusaknas. */
  assert.equal(CONFIRMED_ACTIONS.recall.consequence, 'my_sharings.confirm.recall');
  assert.equal(CONFIRMED_ACTIONS.revoke.consequence, 'my_sharings.confirm.revoke');
  assert.equal(CONFIRMED_ACTIONS.leave.consequence, 'my_sharings.confirm.leave');
  assert.equal(CONFIRMED_ACTIONS.mentoringRecall.consequence, 'my_sharings.confirm.mentoringRecall');
  for (const lang of LANGS) {
    for (const [name, words] of Object.entries(CONFIRMED_ACTIONS)) {
      assert.notEqual(at(catalog(lang), words.armed), at(catalog(lang), words.label), `${lang}: ${name} nupu sõnad muutuvad teise vajutuse ajaks`);
    }
  }

  /* Muutev päring käivitub ainult `twoPress`-i teise vajutuse pealt. */
  const lines = page.split(/\r?\n/);
  const calls = lines.filter((line) => /\b(decideNetworkShare|recallUrgentRequest|runAction)\(/.test(line) && !/useCallback/.test(line));
  assert.equal(calls.length, 7, calls.join('\n'));
  for (const line of calls) assert.ok(line.includes('twoPress('), line.trim());
  for (const name of Object.keys(CONFIRMED_ACTIONS)) assert.ok(page.includes(`"${name}", () => void `), `${name} käib läbi twoPress-i`);
  const twoPress = page.slice(page.indexOf('const twoPress ='), page.indexOf('function renderItem'));
  assert.ok(twoPress.includes('if (!armed) return armConfirm(key);'), 'esimene vajutus ainult küsib');
  assert.ok(twoPress.includes('Date.now() - armedAt.current < CONFIRM_MIN_GAP_MS'), 'topeltklõps ei ole kinnitus');
  assert.ok(twoPress.includes('note: armed ? t(words.consequence) : ""'), 'tagajärg tuleb nupu kõrvale');
  assert.match(page, /const CONFIRM_MIN_GAP_MS = 400;/);
  /* All hoitud klahv ei vajuta sama nuppu teist korda. */
  assert.ok(views.includes('event.repeat') && views.includes('onKeyDown={ignoreKeyRepeat}'));
  assert.ok(views.includes('{confirm.note || confirm.hint}'), 'lause on nupu kõrval');
  /* Viga seisab tegevuste juures (vaate sisu lõpus), mitte pika teksti kohal. */
  const item = views.slice(views.indexOf('export function ItemView'), views.indexOf('export function CorrectionView'));
  assert.ok(item.indexOf('<ViewError text={error} />') > item.indexOf('{confirm.note || confirm.hint}'), 'viga on kinnitusrea all');
  assert.equal([...views.matchAll(/<ViewError text=\{error\} \/>/g)].length, 4);
  /* Kinnitusakent enam ei ole; pärast tegevust läheb fookus teatele, mitte järgmise kirje nupule. */
  for (const source of SOURCES) assert.ok(!read(source).includes('ModalConfirm'), source);
  assert.ok(page.includes('noticeRef.current?.focus();'), 'teade saab fookuse ja keritakse nähtavale');
  assert.ok(views.includes('node.querySelector("[data-step-heading]")'));
});

test('päringud on samad mis enne: aadress, keha, päised ja lukk', () => {
  const page = read(PAGE);
  for (const piece of [
    'fetch("/api/my-sharings", { cache: "no-store", signal })',
    '`/api/my-sharings?section=${encodeURIComponent(section)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`',
    '`/api/urgent-requests/${encodeURIComponent(request.id)}/recall`',
    'body: "{}"',
    '`/api/network-shares/${encodeURIComponent(share.id)}/decision`',
    '"Idempotency-Key": crypto.randomUUID()',
    'body: JSON.stringify({ decision, expectedContentHash: share.contentHash || null })',
    '`/api/pre-inquiries/${encodeURIComponent(item.id)}/recall`',
    'body: { expectedUpdatedAt: item.updatedAt }',
    '`/api/invites/${encodeURIComponent(item.id)}/revoke`',
    '`/api/mentoring/relations/${encodeURIComponent(item.relationId)}/preparation`',
    'body: { action: "recall", noteId: item.id }',
    '`/api/rooms/${encodeURIComponent(item.id)}/leave`',
    '`/api/pre-inquiries/${encodeURIComponent(correction.id)}/corrections`',
    'userEditedDraft: correction.text,',
    'privacyDecision',
    'headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" }',
    'if (response.status === 409 || response.status === 428) await loadSharings({ preserveData: true });',
    'if (action.kind === "mentoringRecall" && response.status === 409) {',
    'await loadSharings({ preserveData: true, section: "mentoringPreparations" });',
    'void sendCorrection({ action: "use_redacted" })',
    'privacyPrompt.allowOriginal ? () => void sendCorrection({ action: "send_original" }) : null',
    'reloadSection(section, { cursor: paging.nextCursor, append: true })',
    '`/mentorlus/suhe/${can.relationId}`'
  ]) {
    assert.ok(page.includes(piece), piece);
  }
  /* Iga muutev rada lukustab end: teist päringut samal ajal teele ei lähe. */
  assert.equal([...page.matchAll(/mutationInFlightRef\.current\) return;/g)].length, 4);
  assert.equal([...page.matchAll(/method: "POST"/g)].length, 4);
  /* Lehekülgede lisamine ei korda juba olemasolevat rida. */
  assert.ok(page.includes('items.filter((item) => !current[key].some((existing) => existing.id === item.id))'));
});

test('leht on sammulaval: lai vaade esimesena, ei pealkirja, ei status-rolli; mudeli märgid jõuavad vaateni', () => {
  const page = read(PAGE);
  const views = read(VIEWS);
  assert.ok(page.includes('startWide'), 'leht avaneb kõigi osade vaates');
  assert.ok(page.split(/\r?\n/).some((line) => line.trim() === 'parts'), 'osad ei ole sammud');
  assert.ok(page.includes('all: t("my_sharings.views.all")') && page.includes('t("my_sharings.views.position", { current, total, label })'));
  /* Lehe nimi on kiirmenüüs: nähtavat pealkirja ega oma tagasi-nuppu ei ole. */
  assert.ok(views.includes('<h1 className="sr-only">{title}</h1>'));
  for (const source of SOURCES) {
    const text = read(source);
    assert.ok(!text.includes('role="status"'), `${source}: teated ei kasuta status-rolli`);
    assert.ok(!text.includes('SubpageHeader') && !text.includes('feature-page'), source);
    assert.ok(!text.includes('dangerouslySetInnerHTML'), source);
    assert.ok(!text.includes('<main'), `${source}: lehel ei ole teist main-elementi`);
  }
  /* Osa read ja laua osad lähevad vaatele koos kõigega, mida mudel neile annab. */
  assert.match(page, /sections\[section\]\.rows\.map\(\(row\) => \(\{\s+\.\.\.row,/);
  assert.match(page, /parts\.map\(\(part\) => \(\{\s+\.\.\.part,/);
  assert.ok(page.includes('part.flag ? <TileSummary flag={part.flag} text={part.summary} /> : part.summary'));
  assert.ok(views.includes('data-attention={row.attention ? "1" : undefined}'));
  assert.ok(views.includes('<OwnershipBar labels={factLabels} {...row.facts} />') && views.includes('<OwnershipBar labels={factLabels} {...sheet.facts} />'));
  /* Viga ja põhinupu helk on ainult ees oleval osal (lava hoiab kõiki osi elus). */
  assert.ok(page.includes('const active = flight?.isActive !== false;'));
  assert.ok(page.includes('const error = active ? actionError : "";'));
  assert.equal([...views.matchAll(/variant="primary"/g)].length, 1);
  assert.ok(views.includes('variant="primary" glow={glow}') && views.includes('glow={button.primary ? glow : false}'));
  /* Paranduse välju saatmise ajaks ei lukustata. */
  const form = views.slice(views.indexOf('export function CorrectionView'), views.indexOf('export function PrivacyView'));
  assert.ok(!form.includes('disabled'), 'paranduse vormis ei ole lukustatud välja');
  /* Kuupäevaväli vormindatakse ilma kellaajata ja jõuab ridade ehitajani. */
  assert.ok(page.includes('{ dateStyle: "medium", timeZone: "UTC" }') && page.includes('({ t, formatDate, formatDay, formatMonth })'));
  /* Osa kaupa laadimine: laadimata osa uus katse ja järgmine lehekülg. */
  assert.ok(page.includes('busy: loadingSection') && page.includes('onRetry: () => void reloadSection(section)'));
  assert.ok(page.includes('{ note: t("my_sharings.views.truncated") }'));
});

test('kujundus on komponendi kõrval, klassinimedega ja platvormi värvimuutujatega', () => {
  const css = read(STYLES);
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((rule) => rule.split('{')[0].trim())
    .filter((selector) => selector && !selector.startsWith('@'));
  assert.ok(selectors.length > 40, `reegleid leiti ${selectors.length}`);
  for (const selector of selectors) {
    for (const part of selector.split(',')) {
      /* Iga valija algab klassiga; paljaid silte (`section`, `p`, `dl`) ei ole. */
      assert.match(part.trim(), /^\.[a-zA-Z]/, part.trim());
      assert.equal(/(^|[\s>+~])(?!composes)[a-z]+[a-z0-9]*(\s|$|[.:[>+~])/.test(part.trim().replace(/:[a-z-]+(\([^)]*\))?/g, '')), false, part.trim());
    }
  }
  assert.ok(!css.includes('!important'), 'jõuga värvi ei suruta (hele teema)');
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), false, 'kõik värvid tulevad muutujatest');
  /* Vana kujundusfail on kadunud ja üldfailides selle lehe reegleid ei ole. */
  assert.equal(fs.existsSync(new URL('../components/sharings/MySharingsPage.module.css', import.meta.url)), false);
  for (const file of fs.readdirSync(new URL('../app/styles/', import.meta.url)).filter((name) => name.endsWith('.css'))) {
    assert.equal(/sharings|ownershipBar/i.test(read(`../app/styles/${file}`)), false, file);
  }
  assert.ok(read(FACTS).includes('./desk/sharings.module.css'));
});
