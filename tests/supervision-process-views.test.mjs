// Supervisiooni protsessi laud, jagamise eelvaade ja sulgemise eelvaade: osad,
// read, sildid, reeglid ja lehtede lubadused.
//
// Lehed olid klaaskastid klaaspaneeli sees (sakiriba ja pikk veerg kaarte); nüüd
// on protsess laud sammulaval ning jagamine ja sulgemine väikeste vaadete jadad
// (components/supervision/process). Test hoiab seda, mida silm kergesti ei märka:
// puuduv tõlkevõti, nimeta vaade, toores serveri väärtus ekraanil, ühe vajutusega
// tagasivõtmatu tegu, kadunud privaatsusmärk, katkine otselink, muutunud päring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CLOSE_STEP_KEYS,
  CLOSE_TITLE_MAX,
  CONTRACT_STATUSES,
  MEETING_STATUSES,
  PART,
  PART_KEYS,
  PARTICIPATION_STATUSES,
  PRIVATE_ITEM_KINDS,
  SHARE_AUDIENCE_DEFAULT,
  SHARE_STEP_KEYS,
  SUMMARY_STATUSES,
  TOPIC_AUDIENCES,
  acceptedCount,
  antechamberMode,
  audienceLabel,
  audiencePrivacy,
  cabinetRows,
  closeEffect,
  closeHref,
  closeTitle,
  closureFacts,
  conflictNotice,
  contractStatusLabel,
  contractView,
  markedPart,
  meetingRows,
  meetingStatusLabel,
  meetingsMode,
  meetingsSummary,
  needsContractAcceptance,
  newSummaryChoices,
  newSummaryTitle,
  partFromSearch,
  partHref,
  participantRows,
  participantsLead,
  participationLabel,
  pendingSummaryRows,
  plannedAtInput,
  plannedAtValue,
  privateItemRows,
  privateItemView,
  privateKindLabel,
  privateKindOptions,
  processFacts,
  processHead,
  processPartKeys,
  processParts,
  searchWithPart,
  shareAudienceNames,
  shareBody,
  shareHref,
  shareTitleOf,
  sharedState,
  summariesLead,
  summariesMode,
  summaryDraft,
  summaryRows,
  summaryStatusLabel,
  timeText,
  topicRows,
  versionRows
} from '../components/supervision/process/processRows.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];

const PAGES = {
  process: '../components/supervision/SupervisionProcessPage.jsx',
  share: '../components/supervision/SupervisionSharePage.jsx',
  close: '../components/supervision/SupervisionClosePage.jsx'
};
const PANELS = {
  contract: '../components/supervision/ContractPanel.jsx',
  participants: '../components/supervision/ParticipantsPanel.jsx',
  antechamber: '../components/supervision/EeskamberPanel.jsx',
  topics: '../components/supervision/TopicsPanel.jsx',
  meetings: '../components/supervision/MeetingsPanel.jsx',
  summaries: '../components/supervision/SummariesPanel.jsx',
  cabinet: '../components/supervision/KappPanel.jsx'
};
const VIEWS = {
  bits: '../components/supervision/process/ProcessBits.jsx',
  frame: '../components/supervision/process/ProcessViews.jsx',
  work: '../components/supervision/process/WorkViews.jsx',
  gate: '../components/supervision/process/GateViews.jsx'
};
const MODEL = '../components/supervision/process/processRows.js';
const SOURCES = [
  ...Object.values(PAGES),
  ...Object.values(PANELS),
  ...Object.values(VIEWS),
  MODEL,
  '../components/supervision/process/usePartRequest.js',
  '../components/supervision/process/usePrivateItems.js',
  '../components/supervision/PrivacyBadge.jsx'
];
/* Kommentaarid räägivad vanast lehest; lubadus käib koodi kohta. */
const code = (source) => read(source).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* Sama tõlkija kuju mis lehel (`t(võti, muutujad)`): puuduv võti tuleb tagasi
   võtmena ja kukutab testi, mis ootab sõna. */
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
const NOW = Date.parse('2026-10-09T08:00:00.000Z');
/* Serveri väärtus või tõlkevõti reas tähendab, et ekraanile jõuaks toores kood. */
const RAW = /supervision\.|\b(INVITED|ACCEPTED|DECLINED|WITHDRAWN|SUPERSEDED|PENDING_APPROVAL|APPROVED|DISCARDED|PREP_TOPIC|PRIVATE_NOTE|CLOSING_REFLECTION|SUPERVISOR_ONLY|PLANNED|HELD|CANCELLED|OS_STALE|LAHK|WELLBEING_HANDOFF)\b/;

const CAN_ALL = {
  canEditProcess: true,
  canManageContract: true,
  canInvite: true,
  canPlanMeeting: true,
  canCreateSummary: true,
  canShareTopic: true,
  canApproveSummary: false,
  canLeave: false,
  canManagePrivateItems: true,
  canClose: true,
  canRespondInvite: false
};
const CAN_MEMBER = {
  canEditProcess: false,
  canManageContract: false,
  canInvite: false,
  canPlanMeeting: false,
  canCreateSummary: false,
  canShareTopic: true,
  canApproveSummary: true,
  canLeave: true,
  canManagePrivateItems: true,
  canClose: false,
  canRespondInvite: false
};

/** Protsess superviisori silmade läbi (sama kuju mis `buildMemberDetail`, lib/supervision/serializers.js). */
function supervisorProcess(patch = {}) {
  return {
    id: 'p 1',
    viewerRole: 'SV',
    title: 'Kevadgrupp',
    type: 'GROUP',
    status: 'ACTIVE',
    goal: 'Hoida tööjõudu.\nTeine rida.',
    plannedMeetingCount: 5,
    version: 7,
    supervisorName: 'Mina Ise',
    myParticipation: null,
    activeContract: { id: 'c2', versionNumber: 2, status: 'ACTIVE', activatedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-08-30T10:00:00.000Z', body: 'Kohtume kord kuus.' },
    contractVersions: [
      { id: 'c1', versionNumber: 1, status: 'SUPERSEDED', activatedAt: '2026-08-01T10:00:00.000Z', createdAt: '2026-07-30T10:00:00.000Z' },
      { id: 'c2', versionNumber: 2, status: 'ACTIVE', activatedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-08-30T10:00:00.000Z' },
      { id: 'c3', versionNumber: 3, status: 'DRAFT', activatedAt: null, createdAt: '2026-10-01T10:00:00.000Z' }
    ],
    participants: [
      { id: 'pa1', userId: 'u1', name: 'Mari Maasikas', status: 'ACCEPTED' },
      { id: 'pa2', userId: 'u2', name: 'Jüri Juurikas', status: 'INVITED' },
      { id: 'pa3', userId: 'u3', name: null, status: 'LEFT' },
      { id: 'pa4', userId: 'u4', name: 'Tiit Tamm', status: 'WITHDRAWN' }
    ],
    topics: [
      { id: 't1', authorParticipationId: 'pa1', authorType: 'PARTICIPANT', title: 'Raske juhtum', body: 'Sisu siin', audience: 'SUPERVISOR_ONLY', sourceKind: 'WELLBEING_HANDOFF', status: 'SHARED', sharedAt: '2026-10-02T10:00:00.000Z', version: 0 },
      { id: 't2', authorParticipationId: null, authorType: 'SUPERVISOR', title: '', body: 'Grupi teema sisu', audience: 'PROCESS', sourceKind: 'MANUAL', status: 'SHARED', sharedAt: '2026-10-03T10:00:00.000Z', version: 4 }
    ],
    meetings: [
      { id: 'm1', seq: 1, status: 'HELD', plannedAt: '2026-09-10T12:00:00.000Z', heldAt: '2026-09-10T13:00:00.000Z', note: 'Märge üks', version: 2 },
      { id: 'm2', seq: 2, status: 'PLANNED', plannedAt: '2027-01-10T12:00:00.000Z', heldAt: null, note: null, version: 0 },
      { id: 'm3', seq: 3, status: 'PLANNED', plannedAt: null, heldAt: null, note: '  ', version: 0 }
    ],
    summaries: [
      { id: 's1', kind: 'MEETING', meetingId: 'm1', status: 'APPROVED', body: 'Kinnitatud tekst', approvedAt: '2026-09-20T10:00:00.000Z', version: 3, approvals: [{ participationId: 'pa1' }] },
      { id: 's2', kind: 'FINAL', meetingId: null, status: 'DRAFT', body: 'Mustandi tekst', approvedAt: null, version: 0, approvals: [] }
    ],
    closure: null,
    capabilities: CAN_ALL,
    ...patch
  };
}

/** Sama protsess osaleja silmade läbi: versioonide ajalugu ei ole, mustandeid ei näe. */
function memberProcess(patch = {}) {
  const base = supervisorProcess();
  return {
    ...base,
    viewerRole: 'OS',
    myParticipation: { id: 'pa1', status: 'ACCEPTED', hasAcceptedActiveContract: true },
    contractVersions: [],
    participants: [base.participants[0], base.participants[2]],
    summaries: [
      { id: 's3', kind: 'MEETING', meetingId: 'm2', status: 'PENDING_APPROVAL', body: 'Ootel tekst', approvedAt: null, version: 1, approvals: [] },
      base.summaries[0]
    ],
    capabilities: CAN_MEMBER,
    ...patch
  };
}

const PRIVATE_ITEMS = [
  { id: 'i1', processId: 'p 1', kind: 'PREP_TOPIC', title: 'Raske juhtum', body: 'Pikk sisu', sharedTopicId: 't1', sourceKind: 'WELLBEING_HANDOFF', version: 1 },
  { id: 'i2', processId: 'p 1', kind: 'PRIVATE_NOTE', title: null, body: '  Pealkirjata   märge\nteisel real  ', sharedTopicId: null, sourceKind: 'MANUAL', version: 0 },
  { id: 'i3', processId: 'p 1', kind: 'CLOSING_REFLECTION', title: 'Tagasi võetud', body: 'x', sharedTopicId: 'kadunud', sourceKind: 'MANUAL', version: 5 },
  null,
  { title: 'ilma id-ta' }
];
const READY = { status: 'ready', data: PRIVATE_ITEMS, error: '' };

test('vaadete, hoidjate ja lehtede tekstivõtmed on kataloogis kolmes keeles', () => {
  /* Sõnade alused, mille lõppu läheb serveri väärtus (`contractStatusLabel` jt). */
  const bases = {
    'supervision.process.contract.versionStatus': CONTRACT_STATUSES,
    'supervision.process.participants.status': PARTICIPATION_STATUSES,
    'supervision.process.summaries.status': SUMMARY_STATUSES
  };
  const keys = new Set();
  for (const source of SOURCES) {
    /* Iga sõnena kirjutatud võti, ka see, mis valitakse tingimusega (`t(a ? "x" : "y")`). */
    for (const match of code(source).matchAll(/"(supervision\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 150, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string' && !bases[key]), [], lang);
    for (const [base, values] of Object.entries(bases)) {
      for (const value of values) assert.equal(typeof at(messages, `${base}.${value}`), 'string', `${lang}: ${base}.${value}`);
    }
    const supervision = messages.supervision;
    for (const kind of PRIVATE_ITEM_KINDS) {
      assert.equal(typeof supervision.eeskamber[`kind_${kind}`], 'string', `${lang}: kind_${kind}`);
      assert.equal(typeof supervision.process.antechamber.kindHint[kind], 'string', `${lang}: kindHint.${kind}`);
    }
    for (const audience of TOPIC_AUDIENCES) assert.equal(typeof supervision.share[`audience_${audience}`], 'string', `${lang}: audience_${audience}`);
    for (const word of ['planned', 'held', 'cancelled']) assert.equal(typeof supervision.meetings[word], 'string', `${lang}: meetings.${word}`);
  }
});

test('igal osal ja sammul on nimi ja lühinimi kiirmenüü jaoks', () => {
  const groups = [
    ['supervision.process.views', PART_KEYS, MODEL, 'supervision.process.views.${key}'],
    ['supervision.share.views', SHARE_STEP_KEYS, PAGES.share, 'supervision.share.views.${key}'],
    ['supervision.close.views', CLOSE_STEP_KEYS, PAGES.close, 'supervision.close.views.${key}']
  ];
  for (const [base, keys, source, mark] of groups) {
    assert.ok(read(source).includes(mark), `${source} paneb vaated kokku võtmest ${mark}`);
    for (const lang of LANGS) {
      const views = at(catalog(lang), base);
      assert.deepEqual(Object.keys(views).sort(), [...keys].sort(), `${lang}: ${base} kannab täpselt neid vaateid`);
      for (const key of keys) {
        assert.equal(typeof views[key].title, 'string', `${lang}: ${base}.${key}.title`);
        assert.equal(typeof views[key].short, 'string', `${lang}: ${base}.${key}.short`);
        assert.ok(views[key].short.length <= 18, `${lang}: ${base}.${key}.short mahub kiirmenüüsse (${views[key].short})`);
      }
    }
  }
  for (const lang of LANGS) {
    const process = catalog(lang).supervision.process;
    assert.ok(process.all.length <= 18, `${lang}: process.all mahub kiirmenüüsse`);
    for (const mark of ['{current}', '{total}', '{label}']) assert.ok(process.position.includes(mark), `${lang}: process.position ${mark}`);
    for (const [key, mark] of [
      ['tiles.contractActive', '{n}'],
      ['tiles.contractPending', '{n}'],
      ['tiles.nextMeeting', '{time}'],
      ['tiles.closedOn', '{date}'],
      ['topics.byName', '{name}'],
      ['meetings.noteQuestion', '{n}'],
      ['summaries.meetingN', '{n}'],
      ['meetings.plannedCount', '{count}']
    ]) {
      assert.ok(at(process, key).includes(mark), `${lang}: process.${key} ${mark}`);
    }
    assert.ok(catalog(lang).supervision.close.currentTitle.includes('{title}'), lang);
  }
});

test('serveri väärtuste loendid on skeemiga samad ja igal väärtusel on sõna', () => {
  const schema = read('../prisma/schema.prisma');
  const enumValues = (name) => {
    const body = schema.slice(schema.indexOf(`enum ${name} {`));
    return body.slice(body.indexOf('{') + 1, body.indexOf('}')).split(/\s+/).filter(Boolean);
  };
  assert.deepEqual([...CONTRACT_STATUSES], enumValues('SupervisionContractStatus'));
  assert.deepEqual([...PARTICIPATION_STATUSES], enumValues('SupervisionParticipationStatus'));
  assert.deepEqual([...PRIVATE_ITEM_KINDS], enumValues('SupervisionPrivateItemKind'));
  assert.deepEqual([...TOPIC_AUDIENCES], enumValues('SupervisionTopicAudience'));
  assert.deepEqual([...MEETING_STATUSES], enumValues('SupervisionMeetingStatus'));
  assert.deepEqual([...SUMMARY_STATUSES], enumValues('SupervisionSummaryStatus'));
  assert.equal(SHARE_AUDIENCE_DEFAULT, 'SUPERVISOR_ONLY', 'jagamine algab kitsamast sihtrühmast');

  const labels = [
    [contractStatusLabel, CONTRACT_STATUSES],
    [participationLabel, PARTICIPATION_STATUSES],
    [privateKindLabel, PRIVATE_ITEM_KINDS],
    [audienceLabel, TOPIC_AUDIENCES],
    [meetingStatusLabel, MEETING_STATUSES],
    [summaryStatusLabel, SUMMARY_STATUSES]
  ];
  for (const lang of LANGS) {
    const word = translator(lang);
    for (const [label, values] of labels) {
      for (const value of values) {
        const text = label(value, word);
        assert.ok(text && !RAW.test(text), `${lang}: ${value} → ${text}`);
      }
      /* Tundmatu väärtus annab tühja sildi, mitte koodi ega võtme. */
      for (const unknown of ['SOMETHING_NEW', '', null, undefined]) assert.equal(label(unknown, word), '');
    }
  }
});

test('osad: kelle laual mis on, ankrud ja aadressiriba', () => {
  const sv = supervisorProcess();
  const os = memberProcess();
  const left = memberProcess({ viewerRole: 'LAHK', capabilities: { ...CAN_MEMBER, canLeave: false, canShareTopic: false, canApproveSummary: false, canManagePrivateItems: false } });
  const closed = supervisorProcess({ status: 'CLOSED', capabilities: { canManagePrivateItems: true } });

  assert.deepEqual(processPartKeys(sv), ['protsess', 'kontrakt', 'osalejad', 'eeskamber', 'teemad', 'kohtumised', 'kokkuvotted', 'kapp', 'sulgemine']);
  assert.deepEqual(processPartKeys(os), ['protsess', 'kontrakt', 'osalejad', 'eeskamber', 'teemad', 'kohtumised', 'kokkuvotted', 'kapp', 'lahkumine']);
  /* Lahkunu ei saa sulgeda ega teist korda lahkuda. */
  assert.deepEqual(processPartKeys(left), ['protsess', 'kontrakt', 'osalejad', 'eeskamber', 'teemad', 'kohtumised', 'kokkuvotted', 'kapp']);
  /* Suletud protsess: ees osa „Suletud", jagatud teemad on kustutatud, sulgeda ega lahkuda ei saa. */
  assert.deepEqual(processPartKeys(closed), ['suletud', 'protsess', 'kontrakt', 'osalejad', 'eeskamber', 'kohtumised', 'kokkuvotted', 'kapp']);
  for (const keys of [processPartKeys(sv), processPartKeys(os), processPartKeys(closed)]) {
    for (const key of keys) assert.ok(PART_KEYS.includes(key), key);
  }

  /* Vana lehe viis ankrut jäävad samaks: neid sihivad teavitused ja „Jätka siit". */
  assert.deepEqual([PART.CONTRACT, PART.ANTECHAMBER, PART.MEETINGS, PART.SUMMARIES, PART.CABINET], ['kontrakt', 'eeskamber', 'kohtumised', 'kokkuvotted', 'kapp']);
  const notifications = read('../lib/supervision/notifications.js');
  const linked = [...notifications.matchAll(/\?ala=([a-z]+)/g)].map((match) => match[1]);
  assert.ok(linked.length >= 3, `teavituste ankruid leiti ${linked.length}`);
  for (const anchor of linked) assert.equal(partFromSearch(anchor), anchor, `teavituse ankur ${anchor} avab osa`);
  assert.ok(read('../components/supervision/SupervisionCreatePage.jsx').includes('?ala=kontrakt'), 'uus protsess avaneb kontrakti osas');

  assert.equal(partFromSearch(' Kokkuvotted '), 'kokkuvotted');
  for (const none of ['', null, undefined, 'midagi', 'ala']) assert.equal(partFromSearch(none), '', 'tundmatu ankur tähendab kõigi osade vaadet');
  assert.equal(partFromSearch('sulgemine', processPartKeys(os)), '', 'osa, mida vaatajal ei ole, ei avane');

  assert.equal(partHref('p 1', 'kontrakt'), '/supervisioon/p%201?ala=kontrakt');
  assert.equal(partHref('p 1', ''), '/supervisioon/p%201');
  assert.equal(partHref('p1', PART.SUMMARIES, { summary: 's/1' }), '/supervisioon/p1?ala=kokkuvotted&summary=s%2F1');
  assert.equal(shareHref('p 1', 'i/2'), '/supervisioon/p%201/jaga?item=i%2F2');
  assert.equal(closeHref('p 1'), '/supervisioon/p%201/sulge');

  /* Aadressiriba: osa vahetus kirjutab ankru ümber, kõigi osade vaates ankrut ei ole. */
  assert.equal(searchWithPart('', 'eeskamber'), '?ala=eeskamber');
  assert.equal(searchWithPart('?ala=kontrakt', ''), '');
  assert.equal(searchWithPart('?ala=kokkuvotted&summary=s1', 'kokkuvotted'), '?ala=kokkuvotted&summary=s1');
  assert.equal(searchWithPart('?ala=kokkuvotted&summary=s1', 'kapp'), '?ala=kapp', 'kokkuvõtte otselink kuulub kokkuvõtete osa juurde');
  assert.equal(searchWithPart('?x=1&ala=kontrakt', ''), '?x=1', 'muud päringuosad jäävad puutumata');
  assert.equal(searchWithPart('?ala=kontrakt', 'kontrakt'), '?ala=kontrakt');

  /* Milline osa on ees: lahkumise teade ei võta äsja ette tulnud osa maha. */
  assert.equal(markedPart('', 'kontrakt', true), 'kontrakt');
  assert.equal(markedPart('kontrakt', 'kontrakt', false), '', 'kõigi osade vaade');
  assert.equal(markedPart('eeskamber', 'kontrakt', false), 'eeskamber');
  assert.equal(markedPart(markedPart('kontrakt', 'eeskamber', true), 'kontrakt', false), 'eeskamber');
  assert.equal(markedPart(markedPart('kontrakt', 'kontrakt', false), 'eeskamber', true), 'eeskamber');
});

test('plaadid ütlevad osa seisu sõnadega ja ei näita tooreid väärtusi', () => {
  const titles = (parts) => Object.fromEntries(parts.map((part) => [part.key, part.summary]));
  const sv = processParts({ process: supervisorProcess(), privateItems: READY, t, locale: 'et', now: NOW });
  const svTiles = titles(sv);
  assert.equal(svTiles.protsess, 'Grupp', 'superviisori plaadil ei ole tema enda nime');
  assert.equal(svTiles.kontrakt, 'Kehtib versioon 2');
  assert.equal(svTiles.osalejad, 'Liitunud: 1 · Kutse ootel: 1');
  assert.equal(svTiles.eeskamber, 'Raske juhtum ja teised');
  assert.equal(svTiles.teemad, 'Raske juhtum ja teised');
  assert.ok(svTiles.kohtumised.startsWith('Järgmine: ') && svTiles.kohtumised.includes('2027'), svTiles.kohtumised);
  assert.equal(svTiles.kokkuvotted, 'Mustandeid: 1');
  assert.equal(svTiles.kapp, 'Kontrakt · Kinnitatud kokkuvõtteid: 1');
  assert.equal(svTiles.sulgemine, 'Vaata enne, mis kustub ja mis jääb.');
  for (const part of sv) {
    assert.ok(part.label && part.short && part.short.length <= 18, part.key);
    assert.ok(['done', 'empty'].includes(part.state), part.key);
    assert.ok(!RAW.test(`${part.label} ${part.short} ${part.summary}`), `${part.key}: ${part.summary}`);
  }
  /* Pikk tekst või loend ei tee teisi osi enda kõrguseks; lõpuosad on väikesed. */
  assert.deepEqual(sv.filter((part) => !part.free).map((part) => part.key), ['sulgemine']);

  const stale = processParts({
    process: memberProcess({ viewerRole: 'OS_STALE', myParticipation: { id: 'pa1', status: 'ACCEPTED', hasAcceptedActiveContract: false }, capabilities: { ...CAN_MEMBER, canShareTopic: false, canApproveSummary: false } }),
    privateItems: { status: 'loading', data: [], error: '' },
    t,
    locale: 'et',
    now: NOW
  });
  const staleTiles = titles(stale);
  assert.equal(staleTiles.protsess, 'Grupp · Superviisor: Mina Ise');
  assert.equal(staleTiles.kontrakt, 'Versioon 2 ootab sinu kinnitust');
  assert.equal(staleTiles.eeskamber, 'Laen…', 'plaat ei väida, et eeskamber on tühi, enne kui loend on kohal');
  assert.equal(staleTiles.lahkumine, 'Saad protsessist lahkuda.');
  assert.equal(staleTiles.kokkuvotted, 'Kinnitamisel: 1');

  const os = titles(processParts({ process: memberProcess(), privateItems: { status: 'error', data: [], error: 'Ei leitud.' }, t, locale: 'et', now: NOW }));
  assert.equal(os.kokkuvotted, 'Kokkuvõte ootab sinu kinnitust');
  assert.equal(os.eeskamber, 'Ei leitud.');
  const approvedByMe = memberProcess();
  approvedByMe.summaries = [{ ...approvedByMe.summaries[0], approvals: [{ participationId: 'pa1' }] }];
  assert.equal(titles(processParts({ process: approvedByMe, privateItems: READY, t, locale: 'et', now: NOW })).kokkuvotted, 'Kinnitamisel: 1');

  const empty = titles(
    processParts({
      process: supervisorProcess({ activeContract: null, contractVersions: [], participants: [], topics: [], meetings: [], summaries: [] }),
      privateItems: { status: 'ready', data: [], error: '' },
      t,
      locale: 'et',
      now: NOW
    })
  );
  assert.deepEqual(
    [empty.kontrakt, empty.osalejad, empty.eeskamber, empty.teemad, empty.kohtumised, empty.kokkuvotted, empty.kapp],
    [
      'Aktiivset kontraktiversiooni veel pole.',
      'Osalejaid veel ei ole.',
      'Eeskamber on tühi.',
      'Jagatud teemasid ei ole.',
      'Ühtegi kohtumist pole veel plaanitud.',
      'Kokkuvõtteid pole veel.',
      'Kinnitatud väljundeid pole veel.'
    ]
  );

  const closedProcess = supervisorProcess({
    status: 'CLOSED',
    goal: null,
    topics: [],
    summaries: [supervisorProcess().summaries[0]],
    closure: { closedAt: '2026-10-05T10:00:00.000Z', facts: { meetingsPlanned: 3, meetingsHeld: 1, participantCount: 1, approvedSummaryCount: 1 }, purgeReport: { sharedTopics: 2, draftSummaries: 1, meetingNotes: 1 } },
    capabilities: { canManagePrivateItems: true }
  });
  const closed = titles(processParts({ process: closedProcess, privateItems: READY, t, locale: 'et', now: NOW }));
  assert.ok(closed.suletud.startsWith('Suletud ') && closed.suletud.includes('2026'));
  /* Suletud protsessis ei ole „järgmist" kohtumist. */
  assert.equal(closed.kohtumised, 'Toimunud: 1 · Plaanis: 2');
  assert.equal(meetingsSummary(supervisorProcess({ meetings: [supervisorProcess().meetings[0]] }), { ...context, now: NOW }).summary, 'Toimunud: 1 · Plaanis: 0');

  const facts = closureFacts(closedProcess, context);
  assert.deepEqual(facts.map((fact) => fact.key), ['closedOn', 'purged', 'meetings', 'participants', 'summaries']);
  assert.equal(facts[1].text, 'Kustutati: 2 teemat, 1 mustandit, 1 märget.');
  assert.equal(facts[2].text, 'Toimunud kohtumisi: 1, kirja pandud kohtumisi: 3');
  assert.deepEqual(closureFacts(supervisorProcess(), context), []);
});

test('päis, faktid ja kontrakt: sõnad, eesmärk ja kes saab kinnitada', () => {
  const head = processHead(supervisorProcess(), { t });
  assert.equal(head.title, 'Kevadgrupp');
  assert.deepEqual(head.chips.map((chip) => [chip.key, chip.text, chip.tone]), [['role', 'Superviisor', 'quiet'], ['status', 'Aktiivne', 'ok']]);
  assert.equal(head.chips[0].prefix, 'Sinu roll');
  assert.equal(processHead({ title: '  ', viewerRole: 'UUS', status: 'UUS' }, { t }).title, 'Pealkirjata protsess');
  assert.deepEqual(processHead({ viewerRole: 'UUS', status: 'UUS' }, { t }).chips, []);

  const facts = processFacts(supervisorProcess(), { t });
  assert.deepEqual(facts.map((fact) => fact.key), ['type', 'supervisor', 'status', 'role', 'meetings', 'goal']);
  assert.deepEqual(facts.map((fact) => fact.value).slice(0, 5), ['Grupp', 'Mina Ise', 'Aktiivne', 'Superviisor', '5']);
  assert.equal(facts[5].value, 'Hoida tööjõudu.\nTeine rida.');
  assert.equal(facts[5].long, true);
  assert.equal(processFacts(supervisorProcess({ goal: '  ' }), { t }).at(-1).value, 'Eesmärki ei ole lisatud.');
  /* Sulgemine kustutab eesmärgi: suletud protsess ütleb seda, mitte „lisamata". */
  assert.equal(processFacts(supervisorProcess({ goal: null, status: 'CLOSED' }), { t }).at(-1).value, 'Eesmärk kustutati protsessi sulgemisel.');
  assert.ok(read('../lib/supervision/closure.js').includes('goal: null'), 'server kustutab eesmärgi sulgemisel');
  assert.ok(!RAW.test(JSON.stringify(processFacts({ type: 'PAIR', status: 'ARCHIVED', viewerRole: 'X', plannedMeetingCount: 'palju' }, { t }))));

  /* Kinnitada saab ainult liitunud osaleja, kellel kehtiva versiooni kinnitus puudub. */
  const stale = memberProcess({ viewerRole: 'OS_STALE', myParticipation: { id: 'pa1', status: 'ACCEPTED', hasAcceptedActiveContract: false } });
  assert.equal(needsContractAcceptance(stale), true);
  assert.equal(needsContractAcceptance(memberProcess()), false);
  assert.equal(needsContractAcceptance(supervisorProcess()), false);
  assert.equal(needsContractAcceptance({ ...stale, activeContract: null }), false);
  assert.equal(needsContractAcceptance({ ...stale, status: 'CLOSED' }), false);
  /* Vana leht pakkus kinnitamist ka lahkunule, kelle päringu server tagasi lükkab. */
  assert.equal(needsContractAcceptance({ ...stale, viewerRole: 'LAHK' }), false);
  assert.ok(read('../lib/supervision/service.js').includes('if (![VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE].includes(viewer.role)) throw notFound();'));

  const view = contractView(supervisorProcess(), context);
  assert.equal(view.active.version, 'Versioon 2');
  assert.ok(view.active.since.startsWith('Kehtib alates ') && view.active.since.includes('2026'));
  assert.equal(view.active.body, 'Kohtume kord kuus.');
  assert.deepEqual([view.canManage, view.hasVersions, view.needsAcceptance], [true, true, false]);
  assert.deepEqual([contractView(stale, context).canManage, contractView(stale, context).hasVersions, contractView(stale, context).needsAcceptance], [false, false, true]);
  assert.equal(contractView(supervisorProcess({ activeContract: null }), context).active, null);

  /* Versioonid: uusim ees, seis sõnaga, aktiveerida saab ainult kehtivast uuemat mustandit. */
  const versions = versionRows(
    supervisorProcess({
      contractVersions: [
        { id: 'c1', versionNumber: 1, status: 'DRAFT', createdAt: '2026-07-30T10:00:00.000Z' },
        ...supervisorProcess().contractVersions.slice(1),
        { id: 'cx', versionNumber: 4, status: 'TUNDMATU', createdAt: 'vigane' }
      ]
    }),
    context
  );
  assert.deepEqual(versions.map((row) => [row.id, row.title, row.statusText, row.canActivate]), [
    ['cx', 'Versioon 4', '', false],
    ['c3', 'Versioon 3', 'Mustand', true],
    ['c2', 'Versioon 2', 'Kehtib', false],
    ['c1', 'Versioon 1', 'Mustand', false]
  ]);
  assert.ok(versions[1].date.startsWith('Koostatud ') && versions[2].date.startsWith('Kehtib alates '));
  assert.equal(versions[0].date, '');
  assert.ok(read('../lib/supervision/service.js').includes('CONTRACT_VERSION_NOT_FORWARD'), 'server lubab aktiveerida ainult edasi');
  assert.ok(versionRows(memberProcess({ contractVersions: supervisorProcess().contractVersions }), context).every((row) => !row.canActivate));
  assert.ok(!RAW.test(JSON.stringify(versions)));
});

test('osalejad: seis sõnaga ja kutse tagasivõtmine ainult superviisoril', () => {
  const rows = participantRows(supervisorProcess(), { t });
  assert.deepEqual(rows.map((row) => [row.name, row.statusText, row.tone, row.canWithdraw]), [
    ['Mari Maasikas', 'Liitunud', 'ok', false],
    ['Jüri Juurikas', 'Kutse ootel', 'wait', true],
    ['Nimeta osaleja', 'Lahkus', 'quiet', false],
    ['Tiit Tamm', 'Kutse tagasi võetud', 'quiet', false]
  ]);
  assert.ok(!RAW.test(JSON.stringify(rows)));
  const member = participantRows(memberProcess({ participants: supervisorProcess().participants }), { t });
  assert.ok(member.every((row) => !row.canWithdraw));
  assert.deepEqual(participantRows({ participants: [null, { name: 'x' }, { id: 'p', status: 'UUS' }] }, { t }).map((row) => row.statusText), ['']);
  assert.equal(acceptedCount(supervisorProcess()), 1);
  assert.equal(participantsLead(supervisorProcess({ status: 'CLOSED', capabilities: {} }), t), 'Protsessi osalejad ja saadetud kutsed.');
  assert.equal(participantsLead(memberProcess(), t), 'Näed neid, kes on protsessiga liitunud või sellest lahkunud.');
  /* Tagasi võetud kutse järel ei saa sama inimest uuesti kutsuda: tekst lubab ainult seda, mida server teeb. */
  const service = read('../lib/supervision/service.js');
  assert.ok(service.includes('if (existing) throw conflict("supervision.errors.conflict", "PARTICIPATION_EXISTS");'));
  assert.ok(service.includes('CANNOT_INVITE_SELF') && service.includes('INVITE_ROLE_NOT_ALLOWED'));
});

test('eeskamber: read, jagamise seis ja see, mida avatud kirjega teha saab', () => {
  const process = supervisorProcess();
  const rows = privateItemRows(PRIVATE_ITEMS, process, { t });
  assert.deepEqual(rows.map((row) => [row.id, row.title, row.kindText, row.shared, row.sharedText]), [
    ['i1', 'Raske juhtum', 'Teema ettevalmistus', 'shared', 'Jagatud'],
    ['i2', 'Pealkirjata märge teisel real', 'Privaatne märge', '', ''],
    ['i3', 'Tagasi võetud', 'Lõpurefleksioon', 'withdrawn', 'Jagamine tagasi võetud']
  ]);
  assert.ok(!RAW.test(JSON.stringify(rows)));
  assert.deepEqual(privateItemRows(null, process, { t }), []);

  /* Kirje, mille jagatud teemat vaataja enam ei näe, on tagasi võetud; suletud protsessis seda ei järeldata. */
  assert.equal(sharedState(PRIVATE_ITEMS[2], process), 'withdrawn');
  assert.equal(sharedState(PRIVATE_ITEMS[2], { ...process, status: 'CLOSED', topics: [] }), 'shared');
  assert.equal(sharedState(PRIVATE_ITEMS[1], process), '');

  const shared = privateItemView(PRIVATE_ITEMS[0], process, { t });
  assert.equal(shared.heading, 'Raske juhtum');
  assert.equal(shared.body, 'Pikk sisu');
  assert.equal(shared.version, 1);
  assert.equal(shared.fromWellbeing, 'Toodud tööheaolust');
  assert.deepEqual([shared.canWrite, shared.canShare, shared.withdrawnNote], [true, false, '']);
  const plain = privateItemView(PRIVATE_ITEMS[1], process, { t });
  assert.deepEqual([plain.heading, plain.fromWellbeing, plain.canShare], ['', '', true]);
  /* Sisu jääb täpselt selliseks, nagu see kirjutati (reavahed, tühikud). */
  assert.equal(plain.body, PRIVATE_ITEMS[1].body);
  const withdrawn = privateItemView(PRIVATE_ITEMS[2], process, { t });
  assert.equal(withdrawn.canShare, false, 'tagasi võetud jagamise järel server uut jagamist ei luba');
  assert.equal(withdrawn.withdrawnNote, 'Selle kirje jagamine võeti tagasi. Sama kirjet ei saa uuesti jagada.');
  const topics = read('../lib/supervision/topics.js');
  assert.ok(topics.includes('if (freshSourceItem.sharedTopicId) throw conflict("supervision.errors.conflict", "ALREADY_SHARED");'));
  /* Kes ei saa jagada (kinnitamata osaleja, lahkunu), ei näe jagamise nuppu; lugeda saab ka lahkunu. */
  const stale = memberProcess({ capabilities: { ...CAN_MEMBER, canShareTopic: false } });
  assert.equal(privateItemView(PRIVATE_ITEMS[1], stale, { t }).canShare, false);
  const left = memberProcess({ capabilities: { ...CAN_MEMBER, canManagePrivateItems: false, canShareTopic: false } });
  assert.deepEqual([privateItemView(PRIVATE_ITEMS[1], left, { t }).canWrite, privateItemView(PRIVATE_ITEMS[1], left, { t }).canShare], [false, false]);
  assert.equal(privateItemView(null, process, { t }), null);
  assert.equal(privateItemView({ title: 'ilma id-ta' }, process, { t }), null);

  /* Uue mustandi liigid on kaardid nime ja selgitusega, mitte rippvalik. */
  const kinds = privateKindOptions(t);
  assert.deepEqual(kinds.map((kind) => kind.value), [...PRIVATE_ITEM_KINDS]);
  assert.deepEqual(kinds.map((kind) => kind.label), ['Teema ettevalmistus', 'Privaatne märge', 'Lõpurefleksioon']);
  assert.ok(kinds.every((kind) => kind.description && !RAW.test(kind.description) && kind.description !== kind.label));

  /* Mida osa näitab: kadunud kirje ja õiguseta vorm ei jää tühja vaatena ette. */
  assert.equal(antechamberMode({ mode: 'new', canWrite: true, hasItem: false, hasEditing: false }), 'new');
  assert.equal(antechamberMode({ mode: 'write', canWrite: true, hasItem: false, hasEditing: false }), 'write');
  assert.equal(antechamberMode({ mode: 'write', canWrite: false, hasItem: true, hasEditing: false }), 'list');
  assert.equal(antechamberMode({ mode: 'new', canWrite: false, hasItem: false, hasEditing: false }), 'list');
  assert.equal(antechamberMode({ mode: 'item', canWrite: true, hasItem: false, hasEditing: false }), 'list');
  assert.equal(antechamberMode({ mode: 'edit', canWrite: true, hasItem: true, hasEditing: true }), 'edit');
  assert.equal(antechamberMode({ mode: 'edit', canWrite: true, hasItem: true, hasEditing: false }), 'item');
  assert.equal(antechamberMode({ mode: 'edit', canWrite: false, hasItem: true, hasEditing: true }), 'item');
  assert.equal(antechamberMode({ mode: 'list', canWrite: true, hasItem: true, hasEditing: false }), 'list');
});

test('jagatud teemad: kes näeb, kes jagas ja kes saab tagasi võtta', () => {
  const sv = topicRows(supervisorProcess(), context);
  assert.deepEqual(sv.map((row) => [row.id, row.title, row.audienceText, row.privacy.scope, row.privacy.count, row.canWithdraw, row.version]), [
    ['t1', 'Raske juhtum', 'Ainult superviisorile', 'supervisor', 0, false, 0],
    ['t2', 'Grupi teema sisu', 'Kõigile osalejatele', 'process', 1, true, 4]
  ]);
  assert.ok(sv[0].sub.startsWith('Jagas Mari Maasikas · Jagatud ') && sv[0].sub.includes('2026'));
  assert.ok(sv[1].sub.startsWith('Sinu jagatud · '));
  assert.equal(sv[0].fromWellbeing, 'Toodud tööheaolust');
  assert.equal(sv[1].fromWellbeing, '');
  assert.equal(sv[0].body, 'Sisu siin');

  const os = topicRows(memberProcess(), context);
  assert.deepEqual(os.map((row) => [row.canWithdraw, row.sub.split(' · ')[0]]), [[true, 'Sinu jagatud'], [false, 'Jagas superviisor']]);
  /* Teise osaleja teemat tagasi võtta ei saa; suletud protsessis ei saa keegi. */
  const other = topicRows(memberProcess({ myParticipation: { id: 'pa9', status: 'ACCEPTED', hasAcceptedActiveContract: true } }), context);
  assert.deepEqual(other.map((row) => row.canWithdraw), [false, false]);
  assert.ok(topicRows({ ...supervisorProcess(), status: 'CLOSED' }, context).every((row) => !row.canWithdraw));
  const odd = topicRows(supervisorProcess({ topics: [{ id: 'x', authorType: 'DELETED', audience: 'UUS', body: 'b' }, { id: 'y', authorType: 'PARTICIPANT', authorParticipationId: 'pa3', audience: 'PROCESS', body: 'c' }, null] }), context);
  assert.deepEqual(odd.map((row) => [row.audienceText, row.sub, row.canWithdraw]), [['', 'Jagajat ei ole enam teada', false], ['Kõigile osalejatele', 'Jagas osaleja', false]]);
  assert.ok(!RAW.test(JSON.stringify([...sv, ...os, ...odd])));

  assert.deepEqual(audiencePrivacy(supervisorProcess(), 'PROCESS'), { scope: 'process', count: 1 });
  assert.deepEqual(audiencePrivacy(supervisorProcess(), 'SUPERVISOR_ONLY'), { scope: 'supervisor', count: 0 });

  /* Nähtavuse reegel on serveris; siin joonistatakse ainult see, mis vastusega tuli. */
  const serializers = read('../lib/supervision/serializers.js');
  assert.ok(serializers.includes('if (topic.status !== "SHARED") return false;') && serializers.includes('topic.authorParticipationId === participation.id'));
  const panel = code(PANELS.topics);
  assert.ok(panel.includes('`/api/supervision/topics/${encodeURIComponent(topicId)}/withdraw`') && panel.includes('body: { expectedVersion: topic.version }'));
  assert.ok(read('../lib/supervision/topics.js').includes('assertAllowedKeys(input, ["expectedVersion"]);'));
});

test('kohtumised: read, toimunu on lõplik ja aeg läheb päringusse õigel kujul', () => {
  const rows = meetingRows(supervisorProcess(), context);
  assert.deepEqual(rows.map((row) => [row.id, row.title, row.statusText, row.tone, row.hasNote, row.canMarkHeld, row.canEditNote, row.version]), [
    ['m1', 'Kohtumine 1', 'Toimunud', 'ok', true, false, true, 2],
    ['m2', 'Kohtumine 2', 'Planeeritud', 'wait', false, true, true, 0],
    ['m3', 'Kohtumine 3', 'Planeeritud', 'wait', false, true, true, 0]
  ]);
  assert.equal(rows[0].sub, rows[0].held, 'toimunud kohtumise real on toimumise aeg');
  assert.equal(rows[1].sub, rows[1].planned);
  assert.equal(rows[2].sub, 'Aeg määramata');
  assert.equal(rows[0].note, 'Märge üks');
  assert.ok(meetingRows(memberProcess(), context).every((row) => !row.canMarkHeld && !row.canEditNote));
  assert.ok(!RAW.test(JSON.stringify(rows)));
  assert.ok(read('../lib/supervision/meetings.js').includes('MEETING_HELD_FINAL'), 'server ei pööra toimunut tagasi');

  assert.ok(timeText('2026-09-10T12:00:00.000Z', 'et').includes('2026'));
  for (const bad of ['', null, undefined, 'vigane']) assert.equal(timeText(bad, 'et'), '');

  assert.deepEqual(plannedAtValue(''), { ok: true, value: null });
  assert.deepEqual(plannedAtValue('   '), { ok: true, value: null });
  assert.deepEqual(plannedAtValue('2026-10-12T14:30'), { ok: true, value: new Date('2026-10-12T14:30').toISOString() });
  /* Loetamatu aeg öeldakse välja; vana leht andis selle `toISOString()`-ile, mis viskab. */
  assert.deepEqual(plannedAtValue('homme'), { ok: false, value: null });

  /* Kavandatud kohtumise aega saab muuta ja kohtumise tühistada; tühistatud kohtumist toimunuks ei märgita. */
  assert.deepEqual(rows.map((row) => row.canChange), [false, true, true]);
  const cancelled = meetingRows({ ...supervisorProcess(), meetings: [{ id: 'm9', seq: 9, status: 'CANCELLED', plannedAt: '2026-11-05T12:30:00.000Z', version: 1 }] }, context)[0];
  assert.deepEqual([cancelled.canChange, cancelled.canMarkHeld, cancelled.statusText], [false, false, 'Tühistatud']);
  assert.equal(plannedAtInput(new Date('2026-11-05T14:30').toISOString()), '2026-11-05T14:30');
  assert.equal(plannedAtInput(null), '');
  assert.equal(plannedAtInput('homme'), '');
  assert.equal(meetingsMode({ mode: 'time', canPlan: true, hasMeeting: true, canChange: true }), 'time');
  assert.equal(meetingsMode({ mode: 'time', canPlan: true, hasMeeting: true, canChange: false }), 'meeting');
  assert.equal(meetingsMode({ mode: 'time', canPlan: true, hasMeeting: false, canChange: true }), 'list');
  assert.equal(meetingsMode({ mode: 'plan', canPlan: true, hasMeeting: false }), 'plan');
  assert.equal(meetingsMode({ mode: 'plan', canPlan: false, hasMeeting: false }), 'list');
  assert.equal(meetingsMode({ mode: 'meeting', canPlan: false, hasMeeting: true }), 'meeting');
  assert.equal(meetingsMode({ mode: 'meeting', canPlan: true, hasMeeting: false }), 'list');
  assert.equal(meetingsMode({ mode: 'note', canPlan: true, hasMeeting: true }), 'note');
  assert.equal(meetingsMode({ mode: 'note', canPlan: false, hasMeeting: true }), 'meeting');

  const panel = code(PANELS.meetings);
  assert.ok(panel.includes('body: { plannedAt: time.value }'));
  assert.ok(panel.includes('body: { status: "HELD", expectedVersion: meeting.version }'));
  assert.ok(panel.includes('body: { note: noteDraft.trim() || null, expectedVersion: opened.version }'));
});

test('kokkuvõtted: seis, privaatsusmärk ja tegevused rolli järgi', () => {
  const sv = summaryRows(supervisorProcess(), context);
  assert.deepEqual(sv.map((row) => [row.id, row.title, row.statusText, row.tone, row.privacy]), [
    ['s1', 'Kohtumise 1 kokkuvõte', 'Kinnitatud', 'ok', 'persistent'],
    ['s2', 'Lõpukokkuvõte', 'Mustand', 'quiet', 'draft']
  ]);
  assert.deepEqual(sv.map((row) => [row.canEdit, row.canSubmit, row.canDiscard, row.canApprove]), [[false, false, false, false], [true, true, true, false]]);
  assert.equal(sv[1].discardKind, 'draft');
  assert.ok(sv[0].meta.startsWith('Kinnitatud ') && sv[0].meta.includes('2026'));
  assert.equal(sv[1].version, 0);

  const os = summaryRows(memberProcess(), context);
  assert.deepEqual([os[0].statusText, os[0].tone, os[0].privacy, os[0].waiting], ['Ootab 0/1 kinnitust', 'wait', '', 'Ootab 0/1 kinnitust']);
  assert.deepEqual([os[0].canApprove, os[0].approvedByMe, os[0].canEdit, os[0].canDiscard], [true, false, false, false]);
  /* Kes on juba kinnitanud, ei näe kinnitamise nuppu teist korda. */
  const approved = memberProcess();
  approved.summaries = [{ ...approved.summaries[0], approvals: [{ participationId: 'pa1' }] }];
  const mine = summaryRows(approved, context)[0];
  assert.deepEqual([mine.canApprove, mine.approvedByMe, mine.statusText], [false, true, 'Ootab 1/1 kinnitust']);
  /* Kinnitamata kontraktiga osaleja ei kinnita (server: 409). */
  assert.equal(summaryRows(memberProcess({ capabilities: { ...CAN_MEMBER, canApproveSummary: false } }), context)[0].canApprove, false);
  /* Superviisor saab kinnitamist ootava kokkuvõtte kõrvale jätta, muuta mitte. */
  const pending = summaryRows(supervisorProcess({ summaries: memberProcess().summaries }), context)[0];
  assert.deepEqual([pending.canEdit, pending.canSubmit, pending.canDiscard, pending.discardKind, pending.canApprove], [false, false, true, 'pending', false]);
  const odd = summaryRows(supervisorProcess({ summaries: [{ id: 'x', kind: 'MEETING', meetingId: 'kadunud', status: 'UUS', body: null }, null] }), context);
  assert.deepEqual(odd.map((row) => [row.title, row.statusText, row.privacy, row.body]), [['Kohtumise kokkuvõte', '', '', '']]);
  assert.ok(!RAW.test(JSON.stringify([...sv, ...os, ...odd, mine, pending])));

  assert.equal(summariesLead(supervisorProcess(), t), 'Mustandit näed ainult sina. Kinnitamisele saadetud kokkuvõtet näevad liitunud osalejad.');
  assert.equal(summariesLead(memberProcess(), t), 'Kokkuvõte on kinnitatud siis, kui kõik liitunud osalejad on selle kinnitanud.');
  assert.equal(summariesLead(supervisorProcess({ status: 'CLOSED' }), t), '');

  /* Uus kokkuvõte: hõivatud liiki ja kohtumist ei pakuta (server lubab ühe lõpukokkuvõtte ja ühe kohtumise kohta). */
  const choices = newSummaryChoices(supervisorProcess(), { t });
  assert.deepEqual(choices.kinds, [{ value: 'MEETING', label: 'Kohtumise kokkuvõte' }]);
  assert.deepEqual(choices.meetings, [{ value: 'm2', label: 'Kohtumine 2' }, { value: 'm3', label: 'Kohtumine 3' }]);
  assert.equal(choices.any, true);
  const fresh = newSummaryChoices(supervisorProcess({ summaries: [] }), { t });
  assert.deepEqual(fresh.kinds.map((kind) => kind.value), ['FINAL', 'MEETING']);
  assert.equal(fresh.meetings.length, 3);
  const full = newSummaryChoices(supervisorProcess({ meetings: [supervisorProcess().meetings[0]] }), { t });
  assert.deepEqual([full.kinds, full.meetings, full.any], [[], [], false]);
  assert.deepEqual(newSummaryChoices(supervisorProcess({ summaries: [], meetings: [] }), { t }).kinds.map((kind) => kind.value), ['FINAL']);
  const summaries = read('../lib/supervision/summaries.js');
  assert.ok(summaries.includes('SUMMARY_EXISTS_FOR_MEETING') && summaries.includes('FINAL_SUMMARY_EXISTS'));

  assert.deepEqual(summaryDraft({ kind: 'FINAL', meetingId: 'm1', body: '  Tekst \n' }), { kind: 'FINAL', body: 'Tekst' });
  assert.deepEqual(summaryDraft({ kind: 'MEETING', meetingId: 'm2', body: 'Tekst' }), { kind: 'MEETING', meetingId: 'm2', body: 'Tekst' });
  for (const missing of [{ kind: 'MEETING', meetingId: '', body: 'x' }, { kind: 'FINAL', body: '   ' }, { kind: '', body: 'x' }, { kind: 'MUU', body: 'x' }]) {
    assert.equal(summaryDraft(missing), null);
  }

  assert.equal(newSummaryTitle(supervisorProcess(), { kind: 'FINAL', meetingId: '' }, t), 'Lõpukokkuvõte');
  assert.equal(newSummaryTitle(supervisorProcess(), { kind: 'MEETING', meetingId: 'm2' }, t), 'Kohtumise 2 kokkuvõte');
  for (const open of [{ kind: 'MEETING', meetingId: '' }, { kind: '', meetingId: 'm2' }, { kind: 'MUU', meetingId: 'm2' }]) {
    assert.equal(newSummaryTitle(supervisorProcess(), open, t), '', 'valik on pooleli');
  }

  assert.equal(summariesMode({ mode: 'new', canCreate: true, anyChoice: true, hasSummary: false, canEdit: false, hasEditing: false }), 'new');
  /* Teksti vaade eeldab tehtud valikut: muidu jääb ette valik. */
  assert.equal(summariesMode({ mode: 'write', canCreate: true, anyChoice: true, hasTarget: true, hasSummary: false, canEdit: false, hasEditing: false }), 'write');
  assert.equal(summariesMode({ mode: 'write', canCreate: true, anyChoice: true, hasTarget: false, hasSummary: false, canEdit: false, hasEditing: false }), 'new');
  assert.equal(summariesMode({ mode: 'write', canCreate: false, anyChoice: true, hasTarget: true, hasSummary: false, canEdit: false, hasEditing: false }), 'list');
  assert.equal(summariesMode({ mode: 'new', canCreate: true, anyChoice: false, hasSummary: false, canEdit: false, hasEditing: false }), 'list');
  assert.equal(summariesMode({ mode: 'new', canCreate: false, anyChoice: true, hasSummary: false, canEdit: false, hasEditing: false }), 'list');
  assert.equal(summariesMode({ mode: 'summary', canCreate: false, anyChoice: false, hasSummary: false, canEdit: false, hasEditing: false }), 'list');
  assert.equal(summariesMode({ mode: 'edit', canCreate: true, anyChoice: true, hasSummary: true, canEdit: true, hasEditing: true }), 'edit');
  /* Mustand, mis saadeti vahepeal kinnitamisele, ei jää muutmise vormina ette. */
  assert.equal(summariesMode({ mode: 'edit', canCreate: true, anyChoice: true, hasSummary: true, canEdit: false, hasEditing: true }), 'summary');

  const cabinet = cabinetRows(supervisorProcess(), context);
  assert.deepEqual(cabinet.map((row) => [row.id, row.title, row.body]), [['contract', 'Kinnitatud kontrakt', 'Kohtume kord kuus.'], ['summary-s1', 'Kohtumise 1 kokkuvõte', 'Kinnitatud tekst']]);
  assert.equal(cabinet[0].meta, 'Versioon 2');
  assert.ok(cabinet[1].meta.startsWith('Kinnitatud '));
  assert.deepEqual(cabinetRows(supervisorProcess({ activeContract: null, summaries: [supervisorProcess().summaries[1]] }), context), []);
});

test('jagamine: eelvaade näitab täpselt seda, mis päringusse läheb', () => {
  const item = { id: 'i2', title: null, body: `${'a'.repeat(150)}\n${'b'.repeat(150)}`, sharedTopicId: null };
  assert.equal(shareTitleOf(item), item.body.slice(0, 200), 'pealkirjata kirjel on pealkiri sisu algus');
  assert.equal(shareTitleOf({ ...item, title: 'Oma pealkiri' }), 'Oma pealkiri');
  assert.equal(shareTitleOf(null), '');
  const body = shareBody({ ...item, title: 'Oma pealkiri' }, 'PROCESS');
  assert.deepEqual(body, { title: 'Oma pealkiri', body: item.body, audience: 'PROCESS', sourcePrivateItemId: 'i2' });
  /* Päringu väljad on täpselt serveri lubatud väljad: lisaväli annaks 400. */
  const allowed = read('../lib/supervision/topics.js').match(/assertAllowedKeys\(input, \[([^\]]+)\]\);\s*const \{ process \} = await requireTopicAuthor/);
  assert.ok(allowed, 'jagamise lubatud väljad on teenuses kirjas');
  assert.deepEqual(Object.keys(body).sort(), [...allowed[1].matchAll(/"(\w+)"/g)].map((match) => match[1]).sort());

  assert.deepEqual(shareAudienceNames(supervisorProcess(), 'SUPERVISOR_ONLY'), ['Mina Ise']);
  /* Kõigile jagades näevad liitunud osalejad: mitte kutsutud, lahkunud ega nimeta. */
  assert.deepEqual(shareAudienceNames(supervisorProcess(), 'PROCESS'), ['Mina Ise', 'Mari Maasikas']);
  assert.deepEqual(shareAudienceNames(null, 'PROCESS'), []);
  assert.deepEqual(shareAudienceNames({ participants: [] }, 'SUPERVISOR_ONLY'), []);

  const page = code(PAGES.share);
  assert.ok(page.includes('body: shareBody(item, audience)'), 'päringu keha tuleb samast kohast mis eelvaade');
  assert.ok(page.includes('const shareTitle = useMemo(() => shareTitleOf(item), [item]);'));
  assert.ok(page.includes('useState(SHARE_AUDIENCE_DEFAULT)'));
  /* Kinnitamata kontrakt on OMA olek, mitte „proovi uuesti". */
  assert.match(page, /payload\?\.messageKey === "supervision\.errors\.contract_not_accepted"\) \{\s*setNotReady\(true\);\s*return;/);
  assert.ok(page.includes('if (!detail.payload?.process?.capabilities?.canShareTopic) setNotReady(true);'));
  /* Juba jagatud kirje eelvaadet ei näidata; pärast jagamist avaneb jagatud teemade osa. */
  assert.ok(page.includes('} else if (item.sharedTopicId) {') && page.includes('supervision.share.alreadyShared'));
  assert.ok(page.includes('router.push(partHref(processId, PART.TOPICS));'));
  assert.ok(page.includes('partHref(processId, PART.ANTECHAMBER)') && page.includes('partHref(processId, PART.CONTRACT)'));
  /* Värava kaks astet: jagamine käib läbi kahe vajutusega nupu. */
  const gate = code(VIEWS.gate);
  assert.equal(gate.split('onShare').length - 1, 2, 'jagamise päringule viib ainult kinnitatud vajutus');
  assert.ok(gate.includes('onConfirm={onShare}'));
});

test('sulgemine: loend, takistused ja päring', () => {
  const preview = {
    canClose: true,
    pendingSummaryIds: [],
    willDelete: { sharedTopics: 2, draftSummaries: 1, meetingNotes: 3 },
    willKeep: { approvedSummaries: 1, meetings: 4, contractVersions: 3, contractAcceptances: 2, auditEvents: 9, closureFacts: true, privateItems: true, personalOutcomes: 2 }
  };
  const effect = closeEffect(preview, { t });
  assert.deepEqual(effect.deleted.map((row) => row.text), ['Jagatud teemad: 2', 'Kokkuvõtete mustandid: 1', 'Kohtumiste töömärkmed: 3']);
  assert.deepEqual(effect.kept.map((row) => row.text), [
    'Kinnitatud kokkuvõtted: 1',
    'Kohtumiste faktid: 4',
    'Kontraktiversioonid: 3',
    'Kontraktikinnitused: 2',
    'Sisuvaba auditijälg: 9 sündmust',
    'Sulgemiskirje ja koondfaktid',
    'Sinu privaatne eeskamber',
    'Isiklikud püsiväljundid: 2'
  ]);
  /* Eelvaate iga arv on loendis: ükski serveri väli ei jää näitamata. */
  assert.deepEqual(effect.deleted.map((row) => row.key).sort(), Object.keys(preview.willDelete).sort());
  assert.deepEqual(effect.kept.map((row) => row.key).sort(), Object.keys(preview.willKeep).sort());
  const serverPreview = read('../lib/supervision/closure.js');
  for (const key of [...Object.keys(preview.willDelete), ...Object.keys(preview.willKeep)]) assert.ok(serverPreview.includes(`${key}:`), `server annab välja ${key}`);
  const blank = closeEffect(null, { t });
  assert.ok(blank.deleted.every((row) => row.text.endsWith(': 0')) && !/undefined|NaN/.test(JSON.stringify(blank)));

  const rows = pendingSummaryRows(['s3', 'tundmatu', null], { processId: 'p 1', process: memberProcess(), t });
  assert.deepEqual(rows.map((row) => [row.id, row.title, row.href]), [
    ['s3', 'Kohtumise 2 kokkuvõte', '/supervisioon/p%201?ala=kokkuvotted&summary=s3'],
    ['tundmatu', 'Kinnitamist ootav kokkuvõte', '/supervisioon/p%201?ala=kokkuvotted&summary=tundmatu']
  ]);
  /* Protsessi päring võis ebaõnnestuda: read tulevad ikka. */
  assert.equal(pendingSummaryRows(['s3'], { processId: 'p1', process: null, t })[0].title, 'Kinnitamist ootav kokkuvõte');
  assert.deepEqual(pendingSummaryRows(undefined, { processId: 'p1', t }), []);

  assert.deepEqual(closeTitle('  Grupp 2026 '), { ok: true, title: 'Grupp 2026' });
  assert.deepEqual(closeTitle('   '), { ok: false, title: '' });
  assert.deepEqual(closeTitle(undefined), { ok: false, title: '' });
  assert.equal(CLOSE_TITLE_MAX, 200);
  assert.ok(serverPreview.includes('normalizeText(input?.generalizedTitle, { required: true, max: 200, field: "generalized_title" })'));

  const page = code(PAGES.close);
  assert.ok(page.includes('body: { expectedVersion: process.version, generalizedTitle: title.title }'));
  assert.ok(serverPreview.includes('assertAllowedKeys(input, ["expectedVersion", "generalizedTitle"]);'));
  /* Puuduv pealkiri viib pealkirja sammu juurde, mitte ei jäta nuppu halliks. */
  assert.match(page, /if \(!title\.ok\) \{\s*setChecked\(true\);\s*setView\("title"\);\s*return;\s*\}/);
  assert.ok(page.includes('payload?.messageKey === "supervision.errors.already_closed"'));
  assert.match(page, /payload\?\.messageKey === "supervision\.errors\.pending_summaries"\) \{\s*await load\(\);\s*setMessage\(t\("supervision\.close\.pendingBlock"\)\);/);
  assert.ok(page.includes('if (previewResult.payload?.preview?.alreadyClosed) router.replace(closedHref);'));
  assert.ok(page.includes('} else if (!preview.canClose) {'), 'kes sulgeda ei saa, näeb ainult loendit');
  assert.ok(page.includes('pendingRows.length ? "supervision.close.pendingBlock" : "supervision.close.onlySupervisor"'));
  const gate = code(VIEWS.gate);
  assert.equal(gate.split('onClose').length - 1, 2, 'sulgemise päringule viib ainult kinnitatud vajutus');
  assert.ok(gate.includes('onConfirm={onClose}') && gate.includes('consequence={t("supervision.close.consequence")}'));
  assert.ok(gate.includes('data-kind="deleted"') || gate.includes('column("deleted"'), 'kaks eristatud tulpa');
});

test('409: põhjus öeldakse välja, kui see ei ole kellegi teise muudatus', () => {
  assert.equal(conflictNotice({ messageKey: 'supervision.errors.already_closed' }, t), 'Protsess on juba suletud.');
  assert.equal(conflictNotice({ messageKey: 'supervision.errors.contract_not_accepted' }, t), 'Enne jätkamist kinnita kehtiv kontraktiversioon.');
  for (const other of [{ messageKey: 'supervision.errors.stale_version' }, { messageKey: 'supervision.errors.conflict' }, { messageKey: 'midagi.muud' }, {}, null, undefined]) {
    assert.equal(conflictNotice(other, t), 'Keegi muutis seda vahepeal. Laen uuesti.');
  }
});

test('tagasivõtmatu tegu küsib teist vajutust ja tagajärg on nupu kõrval', () => {
  const bits = code(VIEWS.bits);
  /* Topeltklõps ja all hoitud klahv ei läbi mõlemat astet. */
  assert.ok(bits.includes('if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();'));
  assert.ok(bits.includes('const MIN_GAP_MS = 400;') && bits.includes('if (!press.settled()) return;'));
  assert.match(bits, /if \(!armed\) \{\s*press\.arm\(name, consequence\);\s*return;\s*\}/);
  /* Keelatud nupp nullib kinnituse ootuse; vaate sisu vahetus samuti. */
  assert.ok(bits.includes('if (disabled && armed) disarm();'));
  assert.match(bits, /useEffect\(\(\) => \{\s*disarm\(\);\s*\}, \[disarm, resetKey\]\);/);
  /* Fookus ei lähe pärast sisu vahetust teise tagasivõtmatu teo nupule. */
  assert.ok(bits.includes('data-danger="true"') && bits.includes(':not([data-danger])'));

  /* Iga tagasivõtmatu tegu jõuab päringuni ainult kinnitatud vajutuse kaudu. */
  const destructive = [
    [VIEWS.frame, 'onActivate', 'supervision.process.contract.activateConsequence'],
    [VIEWS.frame, 'onWithdraw', 'supervision.process.participants.withdrawConsequence'],
    [VIEWS.frame, 'onLeave', 'supervision.leave.confirmHint'],
    [VIEWS.work, 'onDelete', 'supervision.process.antechamber.deleteConsequence'],
    [VIEWS.work, 'onWithdraw', 'supervision.process.topics.withdrawConsequence'],
    [VIEWS.work, 'onMarkHeld', 'supervision.process.meetings.heldConsequence'],
    [VIEWS.work, 'onDiscard', 'supervision.process.summaries.discardConsequencePending'],
    [VIEWS.work, 'onSubmit', 'supervision.process.summaries.submitConsequence'],
    [VIEWS.work, 'onApprove', 'supervision.process.summaries.approveConsequence']
  ];
  for (const [source, handler, consequence] of destructive) {
    const text = code(source);
    const confirmed = [...text.matchAll(new RegExp(`onConfirm=\\{(\\(\\) => )?${handler}[(}]`, 'g'))];
    assert.ok(confirmed.length >= 1, `${source}: ${handler} on kahe vajutusega nupu taga`);
    /* Käsitlejat nimetatakse ainult vaate parameetrites ja kinnituse sees: mujal seda ei kutsuta ega anta edasi.
       (`onSubmit=` on vormi enda omadus, mitte see käsitleja.) */
    const uses = text.split(new RegExp(`\\b${handler}\\b(?!=)`)).length - 1;
    const declared = text.split(new RegExp(`(?<!onConfirm=)[,{]\\s*${handler}\\s*(?=[,}])`)).length - 1;
    assert.equal(uses - declared, confirmed.length, `${source}: ${handler} jõuab päringuni ainult kinnitatud vajutusest`);
    assert.ok(text.includes(`"${consequence}"`), `${source}: ${handler} tagajärg on öeldud`);
  }
  /* Tagajärg seisab tegevusrea teates nupu kõrval. */
  for (const source of [VIEWS.frame, VIEWS.work, VIEWS.gate]) assert.ok(code(source).includes('note={press.note || note}'), source);
  for (const source of SOURCES) assert.ok(!code(source).includes('window.confirm'), `${source}: brauseri küsimusakent ei kasutata`);

  /* Tekstid lubavad ainult seda, mida server teeb. */
  const summaries = read('../lib/supervision/summaries.js');
  assert.ok(summaries.includes('supervisionSummaryApproval.deleteMany') && summaries.includes('if (fresh.status !== "DRAFT") throw conflict("supervision.errors.conflict", "SUMMARY_NOT_DRAFT");'));
  assert.ok(read('../lib/supervision/service.js').includes('data: { status: "SUPERSEDED" }'));
});

test('lehed on sammulaval: ei teist klaaskasti, ei status-rolli, ei toorest ankrut', () => {
  for (const source of SOURCES) {
    const text = code(source);
    assert.ok(!text.includes('role="status"'), `${source}: teated ei kasuta status-rolli (ühine kiht joonistab selle kastina)`);
    assert.ok(!text.includes('SupervisionPage.module.css'), `${source}: vana kest (klaaskast paneeli sees) ei ole kasutusel`);
    assert.ok(!text.includes('SubpageHeader'), `${source}: lehe pealkirja paneelis ei korrata`);
    assert.ok(!/<(Button|a)\b[^>]*\b(as="a"|href=)/.test(text), `${source}: toores ankur laadiks kogu rakenduse uuesti`);
    assert.ok(!text.includes('<Dropdown'), `${source}: valikud on lahtrites, mitte rippvalikus`);
    assert.ok(!/<textarea\b/.test(text), `${source}: tekstiväli on TextAreaField`);
    assert.ok(!/disabled=\{[^}]*\}\s*(onChange|value)=/.test(text) && !/<(Input|TextAreaField|ChoiceRow)\b[^>]*\bdisabled/.test(text), `${source}: välju päringu ajaks ei keelata`);
  }
  assert.ok(!fs.existsSync(new URL('../components/supervision/SupervisionPage.module.css', import.meta.url)), 'vana kesta fail on kustutatud');
  for (const source of Object.values(VIEWS)) {
    const text = code(source);
    assert.ok(!text.includes('supervisionRequest') && !text.includes('fetch('), `${source}: vaade ainult joonistab`);
  }
  assert.ok(!code(MODEL).includes('react'), 'read ja reeglid on failis ilma JSX-ita');

  const page = read(PAGES.process);
  const lines = (text) => text.split(/\r?\n/).map((line) => line.trim());
  assert.ok(lines(page).includes('parts'), 'laud annab lavale `parts`');
  assert.ok(page.includes('startWide={openIndex < 0}'), 'laud avaneb kõigi osade vaates, kui tee osa ei nimeta');
  assert.ok(page.includes('initialIndex={Math.max(0, openIndex)}') && page.includes('activeKey={openIndex >= 0 ? part : undefined}'));
  assert.ok(page.includes('const urlPart = partFromSearch(searchParams.get("ala"));') && page.includes('const [part, setPart] = useState(urlPart);'));
  assert.ok(page.includes('window.history.replaceState(null, ""'), 'osa vahetus ei tee ajalookirjet');
  assert.ok(page.includes('<PartMark name={step.key} active={Boolean(flight?.isActive)} onChange={markPart} />'));
  /* Kutsutu näeb kutset, mitte lauda. */
  assert.match(page, /if \(!desk\) \{\s*return <SupervisionInvitedCard onDone=\{load\} process=\{process\} \/>;/);
  /* Värskendus, mis ei õnnestu, ei viska laualt välja. */
  assert.ok(page.includes('if (loadedRef.current && status !== 401 && status !== 404) {'));
  /* Otselink ja värskendus jõuavad kokkuvõtete osani; läige on ainult ees oleval osal. */
  assert.ok(page.includes('selectedSummaryId={summaryId}') && page.includes('active={Boolean(flight?.isActive)}'));
  assert.ok(page.includes('const glow = flight?.isActive !== false;'));
  assert.ok(page.includes('<EeskamberPanel process={process} items={privateItems} glow={glow} />'), 'eeskambri loend jõuab osani');
  assert.ok(page.includes('router.push(closeHref(processId))') && page.includes('router.push(outcomeHref(outcomeId))') && page.includes('router.push(SUPERVISION_HOME_HREF)'));

  const summaries = read(PANELS.summaries);
  assert.ok(summaries.includes('if (!active || closed) return undefined;') && summaries.includes('document.visibilityState !== "visible"'));
  assert.ok(summaries.includes('linkedRef.current === selectedSummaryId'), 'otselingi kokkuvõte avatakse üks kord');

  for (const key of ['share', 'close']) {
    const text = read(PAGES[key]);
    assert.ok(text.includes('<StepFlight') && !lines(text).includes('parts'), `${key}: jada on sammud, mitte laua osad`);
  }
  /* Mudeli märgid jõuavad vaatesse: vaade loeb välju, mille read annavad. */
  const work = code(VIEWS.work);
  for (const field of ['kind.description', 'draftTitle', 'row.sharedText', 'row.kindText', 'item.withdrawnNote', 'item.fromWellbeing', 'item.canShare', 'topic.privacy.scope', 'row.privacy.scope', 'topic.canWithdraw', 'meeting.canMarkHeld', 'meeting.canEditNote', 'row.hasNote', 'summary.approvedByMe', 'summary.canApprove', 'summary.privacy', 'row.privacy', 'summary.discardKind']) {
    assert.ok(work.includes(field), `töövaated loevad välja ${field}`);
  }
  const frame = code(VIEWS.frame);
  for (const field of ['row.canActivate', 'row.canWithdraw', 'row.statusText', 'view.needsAcceptance', 'view.active.since', 'row.meta']) {
    assert.ok(frame.includes(field), `raami vaated loevad välja ${field}`);
  }
  assert.ok(code(VIEWS.bits).includes('row.sub'), 'rea teine rida (kes jagas, millal toimus) jõuab reale');
});

test('privaatsusmärk on püsielement igas vaates, mis kannab sisu', () => {
  const badge = read('../components/supervision/PrivacyBadge.jsx');
  for (const scope of ['private', 'draft', 'supervisor', 'process', 'persistent', 'invited']) {
    assert.ok(badge.includes(`scope === "${scope}"`) && badge.includes(`data-privacy="${scope}"`), `märk ${scope}`);
  }
  assert.ok(badge.includes('t("supervision.summaries.draftOnlyYou")') && badge.includes('t("supervision.privacy.seenByProcess", { count })'));
  const css = read('../components/supervision/PrivacyBadge.module.css');
  for (const name of ['.privacy {', '.privacyPrivate {', '.privacyShared {', '.privacyPersistent {']) assert.ok(css.includes(name), name);

  const work = read(VIEWS.work);
  /* Eeskamber: loendi kohal, IGA rea juures ja avatud kirjes. */
  assert.ok(work.split('<PrivacyBadge scope="private" />').length - 1 >= 3);
  assert.ok(work.includes('<PrivacyBadge scope={topic.privacy.scope} count={topic.privacy.count} />'));
  assert.ok(work.includes('<PrivacyBadge scope={row.privacy.scope} count={row.privacy.count} />'));
  assert.ok(work.includes('<PrivacyBadge scope="process" count={privacyCount} />'));
  assert.ok(work.includes('<PrivacyBadge scope="draft" />') && work.includes('<PrivacyBadge scope={summary.privacy} />') && work.includes('<PrivacyBadge scope={row.privacy} />'));
  const frame = read(VIEWS.frame);
  assert.ok(frame.split('<PrivacyBadge scope="persistent" />').length - 1 >= 3, 'kapi loend, kapi tekst ja sulgemise osa');
  assert.ok(read(VIEWS.gate).includes('<PrivacyBadge scope={privacy.scope} count={privacy.count} />'));

  /* Eeskambri loend tuleb omaette päringust ja ainult liikmele; protsessi vastusesse see ei jõua. */
  const hook = read('../components/supervision/process/usePrivateItems.js');
  assert.ok(hook.includes('/private-items`') && hook.includes('if (!enabled) return undefined;'));
  assert.ok(read(PAGES.process).includes('const privateItems = usePrivateItems(processId, t, desk);'));
  const antechamber = read(PANELS.antechamber);
  assert.ok(antechamber.includes('expectedVersion: editing.version'), 'eeskambri kirje salvestatakse versiooniga');
  /* Versioonikonflikt: tekst jääb vormi ja värske versioon tuleb kaasa. */
  assert.ok(antechamber.includes('{ ...current, version: fresh.version }') && antechamber.includes('supervision.process.antechamber.conflictKept'));
});

test('päringud on samad, mis enne', () => {
  const contract = code(PANELS.contract);
  assert.ok(contract.includes('`${base}/contract-versions`, { body: { body } }'));
  assert.ok(contract.includes('/activate`, {') && contract.includes('body: { expectedVersion: process.version }'));
  assert.ok(contract.includes('`${base}/contract-acceptance`, { body: { contractVersionId: process.activeContract?.id || "" } }'));
  const participants = code(PANELS.participants);
  assert.ok(participants.includes('/invites`, { body: { userId } }') && participants.includes('/withdraw-invite`)'));
  const antechamber = code(PANELS.antechamber);
  assert.ok(antechamber.includes('body: { kind: draft.kind, title: draft.title.trim() || null, body }'));
  assert.ok(antechamber.includes('{ method: "PATCH", body: { title: editing.title.trim() || null, body, expectedVersion: editing.version } }'));
  assert.ok(antechamber.includes('{ method: "DELETE" }'));
  const summaries = code(PANELS.summaries);
  assert.ok(summaries.includes('/summaries`, { body: payload }'));
  assert.ok(summaries.includes('body: { body, expectedVersion: opened.version }') && summaries.includes('body: { expectedVersion: summary.version }'));
  assert.ok(summaries.includes('/approve`)') && summaries.includes('{ method: "DELETE" }'));
  const page = code(PAGES.process);
  assert.ok(page.includes('`/api/supervision/participations/${encodeURIComponent(participationId)}/leave`'));
  assert.ok(page.includes('supervisionRequest("/api/supervision/outcomes"'));
  /* Üks päring korraga ja 409 läheb lehele, mitte osa veateateks. */
  const request = code('../components/supervision/process/usePartRequest.js');
  assert.ok(request.includes('if (running.current) return false;') && request.includes('await onConflict?.(payload);') && request.includes('await onReload?.();'));
});

test('kujundus on komponendi kõrval ja klassinimedega', () => {
  for (const file of ['../components/supervision/process/process.module.css', '../components/supervision/PrivacyBadge.module.css']) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...css.matchAll(/(^|[}{])\s*([^{}@]+?)\s*\{/g)].map((match) => match[2].trim()).filter(Boolean);
    assert.ok(selectors.length >= 4, `${file}: valijaid leiti ${selectors.length}`);
    const bareTag = /(^|[\s>+~,(])(h[1-6]|p|ul|ol|li|dl|dt|dd|a|div|span|section|article|form|label|input|textarea|button)(?=$|[\s>+~,.:[)])/;
    assert.deepEqual(selectors.filter((selector) => bareTag.test(selector.replace(/:global\(html\.theme-light\)/g, ''))), [], file);
  }
  const css = read('../components/supervision/process/process.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
  /* Lehe kest on ainult paigutus: klaaspind on juba paneel. */
  const shell = css.slice(css.indexOf('.shell {'), css.indexOf('}', css.indexOf('.shell {')));
  for (const surface of ['background', 'backdrop-filter', 'box-shadow', 'border', 'padding']) {
    assert.ok(!shell.includes(surface), `kestal ei ole omadust ${surface}`);
  }
  /* Iga vaadetes kasutatud klass on moodulis olemas (kirjaviga jätaks elemendi kujunduseta). */
  const defined = new Set([...css.matchAll(/\.([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]));
  for (const source of [...Object.values(VIEWS), ...Object.values(PAGES)]) {
    for (const match of read(source).matchAll(/\bstyles\.([A-Za-z0-9]+)/g)) assert.ok(defined.has(match[1]), `${source}: klass ${match[1]} on moodulis`);
  }
});

test('eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const supervision = catalog('et').supervision;
  const texts = [];
  (function collect(node, path) {
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') collect(value, `${path}.${key}`);
      else texts.push([`${path}.${key}`, String(value)]);
    }
  })({ process: supervision.process, share: supervision.share, close: supervision.close, privacy: supervision.privacy, leave: supervision.leave, kapp: supervision.kapp }, 'supervision');
  assert.ok(texts.length > 150, `tekste leiti ${texts.length}`);
  assert.deepEqual(texts.filter(([, text]) => /[—–"]/.test(text)).map(([key]) => key), []);
});
