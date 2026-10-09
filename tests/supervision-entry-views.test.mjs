// Supervisiooni avalehed (laud, uus protsess, kutse, isiklik pakk): read, sildid,
// kontrollid ja lehe lubadused.
//
// Lehed olid klaaskastid klaaspaneeli sees; nüüd on need vaadetena sammulaval
// (components/supervision/entry). Test hoiab seda, mida silm kergesti ei märka:
// puuduv tõlkevõti, nimeta vaade, toores kood ekraanil, ühe vajutusega
// keeldumine, vale selgitus loomise keeldumise peale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CREATE_STEP_KEYS,
  HOME_PART_KEYS,
  INVITED_STEP_KEYS,
  PROCESS_STATUSES,
  PROCESS_TYPES,
  SUMMARY_KINDS,
  VIEWER_ROLES,
  createDraft,
  dayText,
  excerpt,
  hasSummaries,
  isGrantRequired,
  outcomeHref,
  outcomeRows,
  packParts,
  parseMeetingCount,
  processHref,
  processRows,
  roleLabel,
  splitProcesses,
  statusLabel,
  tileSummary,
  typeLabel
} from '../components/supervision/entry/entryRows.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];

const PAGES = {
  home: '../components/supervision/SupervisionHomePage.jsx',
  create: '../components/supervision/SupervisionCreatePage.jsx',
  invited: '../components/supervision/SupervisionInvitedCard.jsx',
  outcome: '../components/supervision/SupervisionOutcomePage.jsx',
  outcomeList: '../components/supervision/SupervisionOutcomeListPage.jsx'
};
const VIEWS = [
  '../components/supervision/entry/EntryBits.jsx',
  '../components/supervision/entry/HomeViews.jsx',
  '../components/supervision/entry/CreateViews.jsx',
  '../components/supervision/entry/InvitedViews.jsx',
  '../components/supervision/entry/OutcomeViews.jsx'
];
const SOURCES = [
  ...Object.values(PAGES),
  ...VIEWS,
  '../components/supervision/entry/entryRows.js',
  '../components/supervision/entry/useSupervisionLoad.js'
];

/* Sama tõlkija kuju mis lehel (`t(võti, muutujad)`), eestikeelse kataloogi peal:
   puuduv võti tuleb tagasi võtmena ja kukutab testi, mis ootab sõna. */
function translator(lang) {
  const messages = catalog(lang);
  return (key, vars) => {
    const text = at(messages, key);
    if (typeof text !== 'string') return key;
    return vars && typeof vars === 'object' ? text.replace(/\{(\w+)\}/g, (mark, name) => (vars[name] != null ? String(vars[name]) : mark)) : text;
  };
}
const t = translator('et');
const context = { t, locale: 'et' };

test('vaadete ja lehtede tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Ainult täielikud võtmed: mallisõnega kokku pandud võtmed kontrollivad järgmised testid. */
    for (const match of read(source).matchAll(/\bt\(\s*"(supervision\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 50, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks', () => {
  const groups = [
    ['supervision.home.views', HOME_PART_KEYS, PAGES.home, 'HOME_PART_KEYS'],
    ['supervision.create.views', CREATE_STEP_KEYS, PAGES.create, 'CREATE_STEP_KEYS'],
    ['supervision.invited.views', INVITED_STEP_KEYS, PAGES.invited, 'INVITED_STEP_KEYS'],
    ['supervision.outcome.views', ['contract', 'final', 'meeting', 'meetingNth'], '../components/supervision/entry/entryRows.js', 'supervision.outcome.views.']
  ];
  for (const [base, keys, source, mark] of groups) {
    assert.ok(read(source).includes(mark), `${source} paneb vaated kokku loendist ${mark}`);
    for (const lang of LANGS) {
      const views = at(catalog(lang), base);
      for (const key of keys) {
        assert.equal(typeof views?.[key]?.title, 'string', `${lang}: ${base}.${key}.title`);
        assert.equal(typeof views?.[key]?.short, 'string', `${lang}: ${base}.${key}.short`);
        /* Pikim võimalik kuju: kohatäitjate asemel kolmekohalised arvud. */
        const short = views[key].short.replace(/\{\w+\}/g, '100');
        assert.ok(short.length <= 18, `${lang}: ${base}.${key}.short mahub kiirmenüüsse (${short})`);
      }
    }
  }
  for (const lang of LANGS) {
    const supervision = catalog(lang).supervision;
    for (const area of ['home', 'outcome']) {
      assert.ok(supervision[area].all.length <= 18, `${lang}: ${area}.all mahub kiirmenüüsse`);
      for (const mark of ['{current}', '{total}', '{label}']) assert.ok(supervision[area].position.includes(mark), `${lang}: ${area}.position ${mark}`);
    }
    for (const mark of ['{n}', '{total}']) {
      assert.ok(supervision.outcome.views.meetingNth.title.includes(mark), `${lang}: meetingNth.title ${mark}`);
      assert.ok(supervision.outcome.views.meetingNth.short.includes(mark), `${lang}: meetingNth.short ${mark}`);
    }
    assert.ok(supervision.home.supervisor.includes('{name}') && supervision.outcome.approvedOn.includes('{date}') && supervision.invited.acceptHint.includes('{n}'), lang);
  }
});

test('serveri väärtustel on sõna kataloogis ja loendid on serveriga samad', () => {
  const schema = read('../prisma/schema.prisma');
  const enumValues = (name) => {
    const body = schema.slice(schema.indexOf(`enum ${name} {`));
    return body.slice(body.indexOf('{') + 1, body.indexOf('}')).split(/\s+/).filter(Boolean);
  };
  assert.deepEqual([...PROCESS_STATUSES], enumValues('SupervisionProcessStatus'));
  assert.deepEqual([...PROCESS_TYPES], enumValues('SupervisionProcessType'));
  assert.deepEqual([...SUMMARY_KINDS], enumValues('SupervisionSummaryKind'));
  /* Teenuskihti ei impordita (ta toob Prisma kliendi): loeme rollid failist. */
  const serializers = read('../lib/supervision/serializers.js');
  const rolesBlock = serializers.slice(serializers.indexOf('VIEWER_ROLES'), serializers.indexOf('});', serializers.indexOf('VIEWER_ROLES')));
  const serverRoles = [...rolesBlock.matchAll(/^\s*([A-Z_]+):\s*"([A-Z_]+)"/gm)].map((match) => match[2]);
  assert.ok(serverRoles.length >= 4, `serveri rolle leiti ${serverRoles.length}`);
  assert.deepEqual([...VIEWER_ROLES].sort(), serverRoles.sort());

  for (const lang of LANGS) {
    const supervision = catalog(lang).supervision;
    for (const role of VIEWER_ROLES) assert.equal(typeof supervision.roles[role], 'string', `${lang}: roles.${role}`);
    for (const status of PROCESS_STATUSES) assert.equal(typeof supervision.status[status], 'string', `${lang}: status.${status}`);
    for (const type of PROCESS_TYPES) assert.equal(typeof supervision.type[type], 'string', `${lang}: type.${type}`);
    assert.equal(typeof supervision.summaries.final, 'string', `${lang}: summaries.final`);
    assert.equal(typeof supervision.summaries.meeting, 'string', `${lang}: summaries.meeting`);
  }
});

test('tundmatu roll, seis ega tüüp ei jõua ekraanile toore koodina', () => {
  assert.equal(roleLabel('SV', t), 'Superviisor');
  assert.equal(statusLabel('ACTIVE', t), 'Aktiivne');
  assert.equal(typeLabel('GROUP', t), 'Grupp');
  for (const label of [roleLabel, statusLabel, typeLabel]) {
    assert.equal(label('SOMETHING_NEW', t), '');
    assert.equal(label(undefined, t), '');
    assert.equal(label(null, t), '');
  }
  const [row] = processRows([{ id: 'p1', title: 'Protsess', viewerRole: 'NEW_ROLE', status: 'ARCHIVED', type: 'PAIR' }], context);
  assert.deepEqual(row.chips, []);
  assert.equal(row.sub, '');
  assert.ok(!/NEW_ROLE|ARCHIVED|PAIR|supervision\./.test(JSON.stringify(row)), 'real ei ole koodi ega tõlkevõtit');
});

test('kutsed on protsessidest eraldi ja rida kannab pealkirja, märke ja teed', () => {
  const list = [
    { id: 'a 1', title: 'Kevadgrupp', type: 'GROUP', status: 'ACTIVE', viewerRole: 'SV', supervisorName: 'Mina Ise', lastActivityAt: '2026-10-03T10:00:00.000Z' },
    { id: 'b2', title: 'Sügisgrupp', type: 'GROUP', status: 'DRAFT', viewerRole: 'KUT', supervisorName: 'Mari Maasikas', lastActivityAt: 'vigane' },
    { id: 'c3', title: '  ', type: 'INDIVIDUAL', status: 'CLOSED', viewerRole: 'LAHK', supervisorName: 'Jüri Juurikas', lastActivityAt: null },
    null,
    { title: 'ilma id-ta' }
  ];
  const { mine, invites } = splitProcesses(list);
  assert.deepEqual(mine.map((row) => row.id), ['a 1', 'c3']);
  assert.deepEqual(invites.map((row) => row.id), ['b2']);
  assert.deepEqual(splitProcesses(null), { mine: [], invites: [] });

  const [own, left] = processRows(mine, context);
  assert.equal(own.href, '/supervisioon/a%201');
  assert.equal(own.href, processHref('a 1'));
  assert.equal(own.title, 'Kevadgrupp');
  /* Superviisori real ei ole tema enda nime: roll on märgil. */
  assert.equal(own.sub, 'Grupp');
  assert.deepEqual(own.chips.map((chip) => [chip.key, chip.text, chip.tone]), [['role', 'Superviisor', 'quiet'], ['status', 'Aktiivne', 'ok']]);
  assert.equal(own.chips[0].prefix, 'Sinu roll');
  assert.equal(own.date, dayText('2026-10-03T10:00:00.000Z', 'et'));
  assert.ok(own.date.includes('2026'));

  assert.equal(left.title, 'Pealkirjata protsess');
  assert.equal(left.sub, 'Individuaalne · Superviisor: Jüri Juurikas');
  assert.deepEqual(left.chips.map((chip) => chip.text), ['Lahkunud', 'Suletud']);
  assert.equal(left.date, '');

  const [invite] = processRows(invites, context);
  /* Kutse real on üks märk (ootab vastust); protsessi seis ei ole kutsutu asi. */
  assert.deepEqual(invite.chips.map((chip) => [chip.text, chip.tone]), [['Kutsutud', 'wait']]);
  assert.equal(invite.sub, 'Grupp · Superviisor: Mari Maasikas');
  /* Vigane kuupäev annab tühja sõne, mitte vea ega teksti „Invalid Date". */
  assert.equal(invite.date, '');
  assert.deepEqual(processRows(undefined, context), []);
});

test('pakkide read viivad pakki ja laua plaat näitab esimest rida, mitte ridade arvu', () => {
  const rows = outcomeRows(
    [
      { id: 'o/1', processTitleGeneralized: 'Grupisupervisioon 2026', createdAt: '2026-09-30T12:00:00.000Z' },
      { id: 'o2', processTitleGeneralized: '', createdAt: 'x' },
      null
    ],
    context
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].href, '/supervisioon/valjundid/o%2F1');
  assert.equal(rows[0].href, outcomeHref('o/1'));
  assert.ok(rows[0].date.includes('2026'));
  assert.equal(rows[1].title, 'Pealkirjata pakk');
  assert.equal(rows[1].date, '');
  assert.deepEqual(outcomeRows({}, context), []);

  assert.equal(tileSummary({ rows: [], emptyText: 'Vastamata kutseid ei ole.' }), 'Vastamata kutseid ei ole.');
  assert.equal(tileSummary({ rows: rows.slice(0, 1), moreText: 'ja teised' }), 'Grupisupervisioon 2026');
  const many = tileSummary({ rows: [{ title: 'Kevadgrupp' }, { title: 'B' }, { title: 'C' }], moreText: 'ja teised' });
  assert.equal(many, 'Kevadgrupp ja teised');
  assert.ok(!/\d/.test(many), 'plaadil ei ole loendurit');
});

test('kohtumiste arv: tühi väli on viis, loetamatu või piirist väljas arv on viga', () => {
  assert.deepEqual(parseMeetingCount(''), { ok: true, value: 5 });
  assert.deepEqual(parseMeetingCount('   '), { ok: true, value: 5 });
  assert.deepEqual(parseMeetingCount(undefined), { ok: true, value: 5 });
  assert.deepEqual(parseMeetingCount(' 7 '), { ok: true, value: 7 });
  assert.deepEqual(parseMeetingCount('1'), { ok: true, value: 1 });
  assert.deepEqual(parseMeetingCount('100'), { ok: true, value: 100 });
  assert.deepEqual(parseMeetingCount(12), { ok: true, value: 12 });
  for (const bad of ['0', '101', '150', '2.5', '2,5', '-3', '1e2', 'viis', '0x10', '1000']) {
    assert.equal(parseMeetingCount(bad).ok, false, bad);
  }
});

test('loomine: puuduv tüüp või pealkiri viib õige sammu juurde ja päringu keha on puhas', () => {
  const full = { type: 'GROUP', title: '  Kevadgrupp ', goal: '  ', plannedMeetingCount: '' };
  assert.deepEqual(createDraft(full), {
    ok: true,
    problems: { type: false, title: false, meetings: false },
    firstProblemStep: '',
    payload: { type: 'GROUP', title: 'Kevadgrupp', goal: null, plannedMeetingCount: 5 }
  });
  assert.equal(createDraft({ ...full, goal: ' Hoida tööjõudu \n' }).payload.goal, 'Hoida tööjõudu');
  assert.equal(createDraft({ ...full, plannedMeetingCount: '12' }).payload.plannedMeetingCount, 12);

  /* Tüüpi ei valita inimese eest: valimata tüüp ei muutu vaikimisi individuaalseks. */
  const noType = createDraft({ ...full, type: '' });
  assert.equal(noType.ok, false);
  assert.equal(noType.payload, null);
  assert.equal(noType.firstProblemStep, 'type');
  assert.equal(createDraft({ ...full, type: 'PAIR' }).firstProblemStep, 'type');

  /* Tühikutest pealkiri on puuduv pealkiri. */
  const noTitle = createDraft({ ...full, title: '   ' });
  assert.deepEqual(noTitle.problems, { type: false, title: true, meetings: false });
  assert.equal(noTitle.firstProblemStep, 'title');
  assert.equal(createDraft({ ...full, plannedMeetingCount: '0' }).firstProblemStep, 'title');
  assert.equal(createDraft(undefined).firstProblemStep, 'type');
  for (const step of ['type', 'title']) assert.ok(CREATE_STEP_KEYS.includes(step));

  const page = read(PAGES.create);
  assert.ok(page.includes('useState({ type: "", title: "", goal: "", plannedMeetingCount: "5" })'), 'vorm algab valimata tüübiga');
  assert.ok(page.includes('setView(draft.firstProblemStep)'), 'puuduse korral viiakse inimene selle sammu juurde');
  assert.ok(page.includes('?ala=kontrakt'), 'uus protsess avaneb kontrakti alal');
});

test('superviisori õiguse selgitus tuleb ainult õiguse puudumise peale', () => {
  assert.equal(isGrantRequired({ status: 403, payload: { messageKey: 'supervision.errors.grant_required' } }), true);
  /* Vale roll on samuti 403, aga administraator siin ei aita. */
  assert.equal(isGrantRequired({ status: 403, payload: { messageKey: 'supervision.errors.role_forbidden' } }), false);
  assert.equal(isGrantRequired({ status: 403, payload: {} }), false);
  assert.equal(isGrantRequired({ status: 400, payload: { messageKey: 'supervision.errors.grant_required' } }), false);
  assert.equal(isGrantRequired({ status: 403, payload: null }), false);
  const grants = read('../lib/supervision/grants.js');
  assert.ok(grants.includes('forbidden("supervision.errors.grant_required"'), 'server annab õiguse puudumise selle võtmega');
});

test('paki osad: kontrakt ja iga kokkuvõte omaette, järjekord pakis ja mitte ühtegi tooret liiki', () => {
  const outcome = {
    content: {
      lastAcceptedContractBody: 'Kohtume kord kuus.\nKonfidentsiaalsus kehtib.',
      approvedSummaries: [
        { kind: 'MEETING', meetingId: 'm1', body: 'Esimene kohtumine.', approvedAt: '2026-06-01T09:00:00.000Z' },
        { kind: 'MEETING', meetingId: 'm2', body: '   ', approvedAt: null },
        { kind: 'MEETING', meetingId: 'm3', body: 'Kolmas kohtumine.', approvedAt: 'vigane' },
        { kind: 'FINAL', meetingId: null, body: 'Lõpetasime.', approvedAt: '2026-09-30T09:00:00.000Z' },
        null
      ],
      facts: { meetingsPlanned: 5 }
    }
  };
  const parts = packParts(outcome, context);
  assert.deepEqual(parts.map((part) => part.key), ['contract', 'summary-0', 'summary-1', 'summary-2']);
  assert.deepEqual(parts.map((part) => part.kind), ['contract', 'meeting', 'meeting', 'final']);
  assert.deepEqual(parts.map((part) => part.label), ['Kinnitatud kontrakt', 'Kohtumise kokkuvõte (1/2)', 'Kohtumise kokkuvõte (2/2)', 'Lõpukokkuvõte']);
  assert.deepEqual(parts.map((part) => part.short), ['Kontrakt', 'Kokkuvõte 1/2', 'Kokkuvõte 2/2', 'Lõpukokkuvõte']);
  /* Vaate nime paneelil ei korrata: osal ei ole märki, mis ütleks sama mis kiirmenüü. */
  for (const part of parts) assert.equal('chip' in part, false);
  assert.equal(parts[0].body, outcome.content.lastAcceptedContractBody);
  assert.equal(parts[0].summary, 'Kohtume kord kuus. Konfidentsiaalsus kehtib.');
  assert.ok(parts[1].meta.startsWith('Kinnitatud ') && parts[1].meta.includes('2026'));
  assert.equal(parts[2].meta, '');
  assert.equal(parts[2].summary, 'Kolmas kohtumine.');
  for (const part of parts) {
    assert.equal(part.free, true);
    assert.equal(part.state, 'done');
    assert.ok(part.short.length <= 18, part.short);
    assert.ok(!/MEETING|FINAL|supervision\./.test(`${part.label} ${part.short} ${part.meta}`), 'toorest liiki ega võtit ei ole');
  }
  assert.equal(hasSummaries(parts), true);

  /* Üks kohtumise kokkuvõte ei vaja järjekorranumbrit. */
  const single = packParts({ content: { approvedSummaries: [{ kind: 'MEETING', body: 'Ainus.' }] } }, context);
  assert.deepEqual(single.map((part) => [part.label, part.short]), [['Kohtumise kokkuvõte', 'Kokkuvõte']]);

  const onlyContract = packParts({ content: { lastAcceptedContractBody: 'Tekst', approvedSummaries: {} } }, context);
  assert.deepEqual(onlyContract.map((part) => part.key), ['contract']);
  assert.equal(hasSummaries(onlyContract), false);
  for (const empty of [null, {}, { content: null }, { content: 'tekst' }, { content: { lastAcceptedContractBody: '  ', approvedSummaries: [] } }]) {
    assert.deepEqual(packParts(empty, context), []);
  }
  assert.equal(excerpt('a  b\n\nc'), 'a b c');
  assert.ok(excerpt('x'.repeat(300)).length <= 111);
});

test('keeldumine küsib teist vajutust ja kinnitus jääb ette', () => {
  const card = read(PAGES.invited);
  assert.ok(card.includes('onClick: () => (confirming ? respond("decline") : armConfirm())'), 'keeldumine kahe vajutusega');
  assert.equal(card.split('respond("decline")').length - 1, 1, 'keeldumise päringule viib ainult kinnitatud vajutus');
  /* Pärast keeldumist protsessi uuesti ei laeta: server vastaks 404 ja kinnitus kaoks. */
  assert.match(card, /if \(action === "decline"\) \{\s*setDeclined\(true\);\s*return;\s*\}/);
  assert.ok(card.includes('supervision.invited.declineConfirm') && card.includes('supervision.invited.declineHint'));
  /* Aegunud kontraktiversioon: värske tekst laetakse ja kinnitaja viiakse selle juurde. */
  assert.match(card, /if \(isConflict\(status\)\) \{[\s\S]*?setView\("contract"\);[\s\S]*?await onDone\?\.\(\);/);
});

test('lehed on sammulaval: ei teist klaaskasti, ei status-rolli, ei toorest ankrut', () => {
  /* Kommentaarid räägivad vanast lehest; lubadus käib koodi kohta. */
  const code = (source) => read(source).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const source of [...Object.values(PAGES), ...VIEWS]) {
    const text = code(source);
    assert.ok(!text.includes('role="status"'), `${source}: teated ei kasuta status-rolli (ühine kiht joonistab selle kastina)`);
    assert.ok(!text.includes('SupervisionPage.module.css'), `${source}: vana kest (klaaskast paneeli sees) ei ole kasutusel`);
    assert.ok(!text.includes('SubpageHeader'), `${source}: lehe pealkirja paneelis ei korrata`);
    assert.ok(!/<(Button|a)\b[^>]*\b(as="a"|href=)/.test(text), `${source}: toores ankur laadiks kogu rakenduse uuesti`);
    assert.ok(!text.includes('<Dropdown'), `${source}: valikud on lahtrites, mitte rippvalikus`);
  }
  for (const source of VIEWS) {
    const text = code(source);
    assert.ok(!text.includes('supervisionRequest') && !text.includes('fetch('), `${source}: vaade ainult joonistab`);
  }

  const home = read(PAGES.home);
  const lines = (text) => text.split(/\r?\n/).map((line) => line.trim());
  assert.ok(lines(home).includes('parts'), 'laud annab lavale `parts`');
  assert.ok(home.includes('startWide={!openPart}'), 'laud avaneb kõigi osade vaates, kui tee osa ei nimeta');
  assert.ok(!home.includes('supervision.common.loading")}</p>'), 'laud ei oota päringut: iga osa näitab oma laadimist ise');
  assert.ok(read(PAGES.outcomeList).includes('initialPart="outcomes"'), 'pakkide tee avab sama laua pakkide osas');

  const outcome = read(PAGES.outcome);
  assert.ok(lines(outcome).includes('parts') && lines(outcome).includes('startWide'), 'pakk avaneb sisukorrana');
  /* Pakk on külmutatud koopia: lehel ei ole ühtegi kirjutavat päringut. */
  assert.ok(!/method:\s*["'](POST|PUT|PATCH|DELETE)/.test(outcome));
  assert.ok(!/method:\s*["'](POST|PUT|PATCH|DELETE)/.test(home));

  /* Privaatsusmärk on püsielement igas vaates, mis kannab sisu. */
  assert.ok(read('../components/supervision/entry/OutcomeViews.jsx').split('<PrivacyBadge scope="private" />').length - 1 >= 2);
  assert.ok(read('../components/supervision/entry/HomeViews.jsx').includes('<PrivacyBadge scope="private" />'));
  assert.ok(read('../components/supervision/entry/InvitedViews.jsx').includes('<PrivacyBadge scope="invited" />'));
});

test('kujundus on komponendi kõrval ja klassinimedega', () => {
  const css = read('../components/supervision/entry/entry.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(^|[}{])\s*([^{}@]+?)\s*\{/g)].map((match) => match[2].trim()).filter(Boolean);
  assert.ok(selectors.length > 30, `valijaid leiti ${selectors.length}`);
  const bareTag = /(^|[\s>+~,(])(h[1-6]|p|ul|ol|li|dl|dt|dd|a|div|span|section|article|form|label|input|textarea|button)(?=$|[\s>+~,.:[)])/;
  assert.deepEqual(selectors.filter((selector) => bareTag.test(selector.replace(/:global\(html\.theme-light\)/g, ''))), []);
  /* Lehe kest on ainult paigutus: klaaspind on juba paneel. */
  const shell = css.slice(css.indexOf('.shell {'), css.indexOf('}', css.indexOf('.shell {')));
  for (const surface of ['background', 'backdrop-filter', 'box-shadow', 'border', 'padding']) {
    assert.ok(!shell.includes(surface), `kestal ei ole omadust ${surface}`);
  }
});
