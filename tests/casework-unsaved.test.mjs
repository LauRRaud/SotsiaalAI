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

import { caseFormUnsaved } from '../components/casework/caseViews.js';
import { PREP_FIELD_KEYS, draftUnsaved, noteUnsaved, prepUnsaved } from '../components/casework/sections/sectionRows.js';
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

test('juhtumi vaade: värav on peal ainult salvestamata tekstiga ja osa tegu ei kirjuta vormi üle', () => {
  const detail = read('../components/casework/CaseWorkDetail.jsx');
  /* Värav, akna sulgemise küsimus ja nende mahavõtmine käivad koos. */
  assert.ok(detail.includes('if (!unsaved) return undefined;'));
  assert.ok(detail.includes('const release = setPanelLeaveGuard(gate);') && detail.includes('release();') && detail.includes('gate.clear();'));
  assert.ok(detail.includes('window.addEventListener("beforeunload", beforeUnload);') && detail.includes('window.removeEventListener("beforeunload", beforeUnload);'));
  /* Tagasi loendisse küsib sama väravat ja põhjus on lava kohal. */
  assert.ok(detail.includes('if (leaveGate("back")) onBack?.();'));
  assert.ok(detail.includes('t("casework.page.unsaved_leave", "")'));
  /* Osad saavad värskenduse, mis vormivälju ei puuduta, värava ja teatamise koha. */
  for (const [name, key] of [['MeetingPrepSection', 'prep'], ['MeetingNoteSection', 'notes'], ['DraftSection', 'drafts']]) {
    const tag = new RegExp(`<${name}\\b[^>]*>`).exec(detail)?.[0] || '';
    assert.ok(tag.includes('onChanged={refreshCase}'), `${name}: osa tegu ei laadi vormi uuesti`);
    assert.ok(tag.includes(`onUnsaved={reportUnsaved.${key}}`) && tag.includes('leaveGate={leaveGate}'), name);
  }
  assert.ok(!detail.includes('onChanged={loadCase}'));
  assert.ok(detail.includes('const refreshCase = useCallback(() => loadCase({ form: "none" }), [loadCase]);'));
  assert.ok(detail.includes('if (form === "all" || form === "basics") {') && detail.includes('if (form === "all" || form === "star") {'));
  /* Seos ja puuduva info punkt ei laadi vormi uuesti; elutsükli siire ja kliendiviite kustutus laevad. */
  assert.equal(detail.split('await Promise.all([loadItems(), refreshCase()]);').length - 1, 2);
  assert.equal(detail.split('await Promise.all([loadMissingInfo(), refreshCase()]);').length - 1, 3);
  assert.equal(detail.split('await loadCase();').length - 1, 2, 'siire ja kliendiviite kustutus');

  /* Avatud kirje sulgemine küsib üle ainult siis, kui selles kirjes on salvestamata teksti. */
  for (const file of ['MeetingPrepSection.jsx', 'MeetingNoteSection.jsx', 'DraftSection.jsx']) {
    const source = read(`../components/casework/${file}`);
    assert.ok(source.includes('if (dirty && leaveGate && !leaveGate("close")) return;'), file);
    assert.ok(source.includes('onUnsaved?.(dirty);') && source.includes('useEffect(() => () => onUnsaved?.(false), [onUnsaved]);'), file);
    assert.ok(source.includes('onClick: close }'), `${file}: tagasi loendisse käib värava kaudu`);
  }
  /* Salvestatud välja sama tekst ei ole muudatus: „Salvesta” ei ole pakkumisel. */
  assert.ok(read('../components/casework/MeetingPrepSection.jsx').includes('(!field.saved || text.trim() !== String(field.savedText || "").trim())'));

  for (const lang of LANGS) {
    const text = JSON.parse(read(`../messages/${lang}.json`)).casework.page.unsaved_leave;
    assert.ok(typeof text === 'string' && text.length > 20, lang);
  }
});
