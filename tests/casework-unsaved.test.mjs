// „Minu juhtumid”: kirjutatud tekst ei kao küsimata.
//
// Brauseris kinnitatud vead: avatud ettevalmistuse, märkme ja mustandi pooleli tekst
// kadus sulgemisel, Esc-iga ja loendisse tagasi minnes; ühe osa tegu (seos, puuduva
// info punkt, uus ettevalmistus) kirjutas põhiandmete ja STAR-i viite pooleli väljad
// serveri seisuga üle. Siin on reeglid, mis otsustavad, kas midagi on salvestamata
// (võrdlus salvestatuga, mitte „välja puudutati”), ja see, et juhtumi vaade neid
// kasutab.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { caseFormUnsaved, caseParts, lockedNote } from '../components/casework/caseViews.js';
import { PREP_FIELD_KEYS, canCorrectEntry, draftPurge, draftRows, draftUnsaved, noteUnsaved, prepUnsaved, quoteIsLong } from '../components/casework/sections/sectionRows.js';
import { panelLeaveAllowed, setPanelLeaveGuard, twoPressLeaveGuard } from '../lib/panelLeaveGuard.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const LANGS = ['et', 'en', 'ru'];

test('ettevalmistus: salvestamata on tekst, mis erineb salvestatust, ja pooleli küsimus', () => {
  const prep = { fields: [{ fieldKey: 'GOAL', text: 'Saada selgus teenuse vajaduses.' }] };
  const saved = Object.fromEntries(PREP_FIELD_KEYS.map((key) => [key, key === 'GOAL' ? 'Saada selgus teenuse vajaduses.' : '']));
  assert.equal(prepUnsaved(prep, saved, { text: '', provenance: '' }), false);
  assert.equal(prepUnsaved(prep, { ...saved, GOAL: 'Saada selgus teenuse vajaduses. Lisaks eelarve.' }, null), true);
  assert.equal(prepUnsaved(prep, { ...saved, AGENDA: 'Tutvustus' }, null), true, 'uus, veel salvestamata väli');
  /* Tagasi kirjutatud tekst ja tühikud teksti otstes ei ole muudatus. */
  assert.equal(prepUnsaved(prep, { ...saved, GOAL: '  Saada selgus teenuse vajaduses. ' }, null), false);
  assert.equal(prepUnsaved(prep, { ...saved, AGENDA: '   ' }, null), false);
  /* Salvestatud välja tühjaks kustutamine on muudatus (seda ei saa salvestada, aga tekst on ekraanilt kadunud). */
  assert.equal(prepUnsaved(prep, { ...saved, GOAL: '' }, null), true);
  /* Pooleli küsimus; ainult valitud päritolu ilma tekstita ei ole kirjutatud tekst. */
  assert.equal(prepUnsaved(prep, saved, { text: 'Kas eestkoste on määratud?', provenance: '' }), true);
  assert.equal(prepUnsaved(prep, saved, { text: '', provenance: 'TOOTAJA_TAHELEPANEK' }), false);
  /* Puuduvad andmed ei viska viga. */
  assert.equal(prepUnsaved(null, null, null), false);
});

test('märge: pooleli rida, tagasivõtmise põhjus või parandus on salvestamata tekst', () => {
  assert.equal(noteUnsaved({}, {}), false);
  assert.equal(noteUnsaved({ CLIENT_VIEW: { text: '', provenance: 'KLIENDI_OELDU' } }, { e1: '  ' }), false);
  assert.equal(noteUnsaved({ CLIENT_VIEW: { text: 'Klient soovib', provenance: '' } }, {}), true);
  assert.equal(noteUnsaved({}, { e1: 'Vale kuupäev' }), true);
  assert.equal(noteUnsaved({}, {}, { e1: { text: 'Parandatud lause', reason: '' } }), true);
  assert.equal(noteUnsaved({}, {}, { e1: { text: '', reason: 'kirjaviga' } }), true);
  assert.equal(noteUnsaved({}, {}, { e1: { text: ' ', reason: '' } }), false);
  assert.equal(noteUnsaved(undefined, undefined, undefined), false);
});

test('mustand: pooleli uus väli või parandus, mis erineb salvestatust', () => {
  const draft = { fields: [{ fieldKey: 'olukord', text: 'Elab üksi.' }] };
  const empty = { fieldKey: '', text: '', provenance: '' };
  assert.equal(draftUnsaved(draft, empty, {}), false);
  assert.equal(draftUnsaved(draft, { ...empty, text: 'Vajab abi' }, {}), true);
  assert.equal(draftUnsaved(draft, { ...empty, fieldKey: 'vajadus' }, {}), true);
  assert.equal(draftUnsaved(draft, empty, { olukord: 'Elab üksi. Poeg käib kord nädalas.' }), true);
  /* Sama tekst ja juba eemaldatud välja pooleli parandus ei ole muudatus. */
  assert.equal(draftUnsaved(draft, empty, { olukord: 'Elab üksi.' }), false);
  assert.equal(draftUnsaved(draft, empty, { kadunud: 'tekst' }), false);
  assert.equal(draftUnsaved(null, null, null), false);
});

test('juhtumi vormid: põhiandmed, STAR-i viide ja pooleli kirjutatud read', () => {
  const record = { retentionState: 'ACTIVE', clientDisplayName: 'M. K.', clientExternalRef: null, externalSystem: 'STAR2', externalReference: '12345', nextContactAt: '2026-10-12T07:00:00.000Z' };
  const form = { displayName: 'M. K.', externalRef: '', nextContact: '2026-10-12T10:00', savedNextContact: '2026-10-12T10:00', externalSystem: 'STAR2', externalReference: '12345', missingText: '', linkTargetId: '', retentionReason: '' };
  assert.equal(caseFormUnsaved(record, form), false);
  for (const [key, value] of [['displayName', 'M. Kask'], ['externalRef', 'A-17'], ['nextContact', '2026-10-13T10:00'], ['externalSystem', ''], ['externalReference', '12346'], ['missingText', 'Sissetuleku tõend'], ['linkTargetId', 'cmg1'], ['retentionReason', 'Töö lõppes']]) {
    assert.equal(caseFormUnsaved(record, { ...form, [key]: value }), true, key);
  }
  assert.equal(caseFormUnsaved(record, { ...form, displayName: ' M. K. ', missingText: '   ' }), false);
  /* Juhtumis, mis ei ole aktiivne, välju muuta ei saa: värav ei jää ekslikult peale. */
  assert.equal(caseFormUnsaved({ ...record, retentionState: 'READ_ONLY' }, { ...form, displayName: 'Muu' }), false);
  assert.equal(caseFormUnsaved({ ...record, retentionState: 'ARCHIVED' }, { ...form, retentionReason: 'x' }), false);
  assert.equal(caseFormUnsaved(null, form), false);
});

test('lahkumise värav: esimene lahkumine peetakse kinni ja küsitakse, teine lubatakse', () => {
  let time = 1000;
  let asked = 0;
  let cleared = 0;
  const gate = twoPressLeaveGuard({ onAsk: () => { asked += 1; }, onClear: () => { cleared += 1; }, now: () => time });
  const release = setPanelLeaveGuard(gate);
  assert.equal(panelLeaveAllowed('escape'), false);
  assert.equal(asked, 1);
  time += 100;
  assert.equal(panelLeaveAllowed('escape'), false, 'topeltvajutus ei ole teine vajutus');
  time += 1000;
  assert.equal(panelLeaveAllowed('back'), true);
  assert.ok(cleared >= 1);
  gate.clear();
  release();
  assert.equal(panelLeaveAllowed('escape'), true, 'vabastatud värav ei pea kedagi kinni');
});

test('salvestamata tekstiga lahkumise lause on kataloogis kolmes keeles', () => {
  for (const lang of LANGS) {
    const text = JSON.parse(read(`../messages/${lang}.json`)).casework.page.unsaved_leave;
    assert.ok(typeof text === 'string' && text.length > 20, lang);
  }
});

test('salvestatud kirje parandus: uus tekst, mis erineb salvestatust, ja kohustuslik põhjus', () => {
  const saved = 'Klient elab üksi.';
  assert.equal(canCorrectEntry({ text: 'Klient elab koos pojaga.', saved, reason: 'Eksisin kirjutades' }), true);
  assert.equal(canCorrectEntry({ text: 'Klient elab koos pojaga.', saved, reason: '   ' }), false, 'põhjuseta parandust ei saadeta');
  assert.equal(canCorrectEntry({ text: saved, saved, reason: 'põhjus' }), false, 'sama tekst ei ole parandus');
  assert.equal(canCorrectEntry({ text: ` ${saved} `, saved, reason: 'põhjus' }), false);
  assert.equal(canCorrectEntry({ text: '  ', saved, reason: 'põhjus' }), false, 'tühjaks ei parandata: selleks on tagasivõtmine');
  assert.equal(canCorrectEntry({}), false);

  /* Server nõuab põhjust ja hoiab eelmise teksti alles: marsruut on olemas ja seda siin ei muudetud. */
  const route = read('../app/api/casework/cases/[caseId]/meeting-notes/[noteId]/entries/[entryId]/route.js');
  assert.ok(route.includes('export async function PATCH') && route.includes('reason: body?.reason') && !route.includes('export async function DELETE'));

  for (const lang of LANGS) {
    const note = JSON.parse(read(`../messages/${lang}.json`)).casework.note;
    for (const key of ['correct_entry', 'correct_text', 'correct_reason', 'save_correction', 'correct_hint']) {
      assert.ok(typeof note[key] === 'string' && note[key], `${lang}: ${key}`);
    }
  }
});

test('arhiveeritud juhtumit ei saa STAR2 jaoks kopeerida: server keeldub', () => {
  /* Server: READ_ONLY on kopeerimisele lubatud, ARCHIVED annab 409. */
  const server = read('../lib/casework/caseWorkTransfer.js');
  assert.ok(server.includes('if (caseWork.retentionState === RETENTION_STATE.ARCHIVED) {'));
});

test('kustutatud sisuga mustand: uut välja ei lisata ja lause ütleb õige põhjuse', () => {
  assert.equal(draftPurge({ contentPurgedAt: null }), null);
  assert.equal(draftPurge(null), null);
  /* Töötaja arhiveeris töömaterjali ise: ei säilitustähtaega ega alles jäänud ülekande fakti. */
  assert.deepEqual(draftPurge({ contentPurgedAt: '2026-10-01T08:00:00.000Z', contentPurgeReason: 'WORKER_ARCHIVED_WORKING_MATERIAL' }), {
    chipKey: 'casework.prep.purged_chip', noteKey: 'casework.transfer.content_archived'
  });
  /* Säilitustähtaeg pärast ülekannet (ja vana rida, millel põhjust ei ole). */
  const retention = { chipKey: 'casework.draft.purged_chip_retention', noteKey: 'casework.transfer.content_purged' };
  assert.deepEqual(draftPurge({ contentPurgedAt: '2026-10-01T08:00:00.000Z', contentPurgeReason: 'RETENTION_AFTER_TRANSFER' }), retention);
  assert.deepEqual(draftPurge({ contentPurgedAt: '2026-10-01T08:00:00.000Z' }), retention);
  /* Põhjuste loend on sama mis teenuskihis. */
  const reasons = /export const PURGE_REASON = Object\.freeze\(\{([^}]*)\}\)/.exec(read('../lib/casework/retention.js'))?.[1] || '';
  assert.deepEqual([...reasons.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]).sort(), ['RETENTION_AFTER_TRANSFER', 'WORKER_ARCHIVED_WORKING_MATERIAL']);

  /* Server: põhjus tuleb vastusega ja kustutatud sisuga mustand ei võta uut välja (409 oma võtmega). */
  const service = read('../lib/casework/caseWorkDraft.js');
  assert.ok(service.includes('contentPurgeReason: true,'));
  assert.ok(service.includes('if (draft.contentPurgedAt) throw conflict("casework.errors.draft_content_purged");'));
  assert.ok(service.includes('select: { id: true, transferState: true, contentPurgedAt: true }'));
  assert.ok(service.indexOf('assertDraftContentKept(draft);') > service.indexOf('export async function setField'));
  /* Põhjuse laused on kataloogis kolmes keeles. */
  for (const lang of LANGS) {
    const words = JSON.parse(read(`../messages/${lang}.json`)).casework;
    assert.ok(words.errors.draft_content_purged && words.transfer.content_archived && words.draft.purged_chip_retention, lang);
    assert.notEqual(words.transfer.content_archived, words.transfer.content_purged, lang);
  }
});

test('juhtum, mis ei ole aktiivne, ütleb oma seisu kohta tõtt', () => {
  const words = JSON.parse(read('../messages/et.json'));
  const t = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), words) ?? '';
  /* Lause on seisu järgi: kirjutuskaitstud juhtumis saab veel kopeerida, arhiveeritud juhtumis mitte. */
  assert.equal(lockedNote('ACTIVE', t), '');
  assert.match(lockedNote('READ_ONLY', t), /^Kirjutuskaitstud: .*kopeerida/);
  assert.match(lockedNote('ARCHIVED', t), /^Arhiveeritud: /);
  assert.ok(!/kopeeri/.test(lockedNote('ARCHIVED', t)));
  for (const lang of LANGS) {
    const page = JSON.parse(read(`../messages/${lang}.json`)).casework.page;
    assert.ok(page.read_only_notice && page.archived_notice && page.read_only_notice !== page.archived_notice, lang);
  }

  /* Esimene plaat ei näita lõppenud töö järgmist kontakti (sama reegel mis loendi real). */
  const context = { t, locale: 'et' };
  const base = { clientDisplayName: 'M. K.', nextContactAt: '2026-09-28T06:30:00.000Z' };
  const tile = (retentionState) => caseParts({ record: { ...base, retentionState }, counts: { items: 0, openMissingInfo: 0 }, ...context }).find((part) => part.key === 'basics');
  assert.match(tile('ACTIVE').summary, /28\.09/);
  for (const state of ['READ_ONLY', 'ARCHIVED']) assert.equal(tile(state).summary, undefined, `${state}: plaat ei näita kontakti ega ütle, et see on määramata`);

  /* Kustutatud sisuga ettevalmistuse lause ei kutsu alustama uut seal, kus seda teha ei saa. */
  for (const lang of LANGS) {
    const prep = JSON.parse(read(`../messages/${lang}.json`)).casework.prep;
    assert.ok(!/Alusta uus|start a new|начните нов/i.test(prep.content_purged), lang);
    assert.ok(prep.cannot_empty, lang);
  }
  /* Privaatse kihi lause ei luba kirjete tõstmist, mida lehel ei ole. */
  assert.ok(!/tõsta/.test(words.casework.note.private_locked_hint) && /STAR2/.test(words.casework.note.private_locked_hint));
  assert.equal(words.api.common.rate_limited, 'Liiga palju päringuid. Proovi hiljem uuesti.');
});

test('vaated mahuvad: pikk tsiteeritud tekst avaneb kohapeal ja ajalugu on kahe kirje kaupa', () => {
  assert.equal(quoteIsLong('Lühike tekst.'), false);
  assert.equal(quoteIsLong('a'.repeat(141)), true);
  assert.equal(quoteIsLong('üks\nkaks\nkolm'), true, 'mitmerealine tekst');
  assert.equal(quoteIsLong(null), false);
  /* Kustutatud sisuga element on loendis tühjast eristatav. */
  const rows = draftRows([{ id: 'd1', draftType: 'TEGEVUS', transferState: 'MUSTAND', contentPurgedAt: '2026-10-01T08:00:00.000Z', contentPurgeReason: 'WORKER_ARCHIVED_WORKING_MATERIAL' }, { id: 'd2', draftType: 'TEGEVUS', transferState: 'MUSTAND' }], { t: (key) => key });
  assert.deepEqual(rows.map((row) => row.purgedText), ['casework.prep.purged_chip', '']);
  for (const lang of LANGS) {
    const page = JSON.parse(read(`../messages/${lang}.json`)).casework.page;
    assert.ok(page.show_all_text && page.show_less_text, lang);
  }
});

test('ettevalmistuse kohtumise aega saab seada ja muuta ka pärast alustamist', () => {
  const route = read('../app/api/casework/cases/[caseId]/meeting-preps/[prepId]/route.js');
  assert.ok(route.includes('export async function PATCH') && route.includes('meetingAt: body?.meetingAt ?? null'));
  for (const lang of LANGS) {
    assert.ok(JSON.parse(read(`../messages/${lang}.json`)).casework.prep.save_time, lang);
  }
});
