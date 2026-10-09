// Teenusekaardi kontaktipaneel (kaardi popup): sõnad ja mahtumise lubadused.
//
// VEAD, mida see test hoiab (kujundusaudit K13):
//  - ligipääsutee väärtuste sõnad (neli rühma) puudusid kataloogist ja varuväärtus
//    oli kood ise, nii et kontakti juures seisis „CHECK_SOURCE" ja „UNKNOWN";
//    võtmed pannakse kokku jooksvalt, seega `i18n:check` neid ei näe;
//  - paneeli kõrgus oli seotud akna, mitte kaardiala kõrgusega, ja kaardi servad
//    lõikasid ta ära; legend kattis paneeli alumise osa koos nuppudega;
//  - Leafleti enda (kihistamata) lõiguveerised kehtisid paneelis, sest platvormi
//    reeglid on kihis.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SERVICE_MAP_ACCESS_TYPES,
  SERVICE_MAP_DECISION_BY,
  SERVICE_MAP_FIRST_STEPS,
  SERVICE_MAP_SOURCE_STATUSES
} from '../lib/serviceMap/accessPath.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const LANGS = ['et', 'en', 'ru'];

test('igal ligipääsutee väärtusel on sõna kolmes keeles', () => {
  const groups = {
    firstSteps: SERVICE_MAP_FIRST_STEPS,
    accessTypes: SERVICE_MAP_ACCESS_TYPES,
    decisionByValues: SERVICE_MAP_DECISION_BY,
    sourceStatuses: SERVICE_MAP_SOURCE_STATUSES
  };
  for (const lang of LANGS) {
    const words = catalog(lang).serviceMap.accessPath;
    for (const [group, values] of Object.entries(groups)) {
      for (const value of values) {
        const word = words?.[group]?.[value];
        assert.ok(typeof word === 'string' && word.trim(), `${lang}: serviceMap.accessPath.${group}.${value}`);
        assert.ok(!/^[A-Z_]+$/.test(word), `${lang}: ${group}.${value} ei tohi olla kood ise`);
      }
    }
    assert.ok(catalog(lang).serviceMap.contactCheckedAt, `${lang}: serviceMap.contactCheckedAt`);
  }
  /* Eesti tekstides ei ole mõttekriipse. */
  const et = JSON.stringify(catalog('et').serviceMap);
  assert.ok(!/[—–]/.test(et));
});

test('sisemist koodi ekraanile ei lasta ja sisuta plokki ei joonistata', () => {
  const source = read('../components/workspace/ServiceMapLeaflet.jsx');
  /* Varuväärtus ei ole enam kood ise. */
  assert.ok(!source.includes('`serviceMap.accessPath.${group}.${normalized}`, normalized)'));
  assert.ok(source.includes('readText(t, "serviceMap.accessPath.unknownShort", "Teadmata")'));
  /* Kui ligipääsutee kohta ei ole midagi teada, plokki ei ole. */
  assert.ok(source.includes('if (!hasDetails && !isHealthContact) return null;'));
  /* Rühmas on üks vaade korraga ja „tagasi" toob loendi tagasi. */
  assert.ok(source.includes('listView.hidden = true;'));
  assert.ok(source.includes('listView.hidden = false;'));
  /* Sama kontakti saab pärast „tagasi" uuesti avada. */
  assert.ok(source.includes('if (opened.id === selectedEntryId) showDetail(opened, { focus: true });'));
});

test('paneel mahub kaardialasse ja legend ei kata seda', () => {
  const source = read('../components/workspace/ServiceMapLeaflet.jsx');
  const css = read('../app/styles/workspace.css');
  const moduleCss = read('../components/workspace/ServiceMapLeaflet.module.css');
  /* Kõrgus ja laius tulevad kaardiala mõõtudest. */
  assert.match(css, /\.service-map-canvas \{[^}]*container-type: size;/s);
  assert.ok(css.includes('max-height: min(65vh, 32rem, calc(100cqh - 1.3rem - 46px));'));
  assert.equal(css.split('calc(100cqw - 3.4rem)').length - 1, 2);
  /* Vaba äär on väike ja sama, millega kõrguse valem arvestab (2 × 10 px). */
  assert.ok(source.includes('const POPUP_EDGE_PADDING = 10;'));
  assert.ok(source.includes('autoPanPaddingTopLeft: [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]'));
  assert.ok(source.includes('autoPanPaddingBottomRight: [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]'));
  /* Legend peidab end avatud paneeli ajaks. */
  assert.match(css, /\.service-map-leaflet-shell:has\(\.leaflet-popup\) \.service-map-leaflet__legend \{\s*visibility: hidden;/);
  /* Kihistamata moodul võidab Leafleti lõiguveerised; kest kannab mooduli klassi. */
  assert.match(moduleCss, /\.shell :global\(\.leaflet-popup-content\) p,[^{]*\{\s*margin: 0;/s);
  assert.ok(source.includes('className={`service-map-leaflet-shell ${styles.shell}`}'));
});
