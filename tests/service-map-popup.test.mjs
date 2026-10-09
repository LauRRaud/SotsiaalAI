// Teenusekaardi kontaktipaneel (kaardi popup): sõnad, vaate valik ja mahtumise lubadused.
//
// VEAD, mida see test hoiab (kujundusaudit K13 ja selle paranduse ülevaatus):
//  - ligipääsutee väärtuste sõnad (neli rühma) puudusid kataloogist ja varuväärtus
//    oli kood ise, nii et kontakti juures seisis „CHECK_SOURCE" ja „UNKNOWN";
//    võtmed pannakse kokku jooksvalt, seega `i18n:check` neid ei näe;
//  - paneeli kõrgus oli seotud akna, mitte kaardiala kõrgusega, ja kaardi servad
//    lõikasid ta ära; legend kattis paneeli alumise osa koos nuppudega;
//  - Leafleti enda (kihistamata) lõiguveerised kehtisid paneelis, sest platvormi
//    reeglid on kihis;
//  - kaardile anti valmis ehitatud sisu, mille ta jättis meelde: järgmisel
//    avamisel näitas paneel vana kontakti ja loendi nupp ei teinud midagi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SERVICE_MAP_ACCESS_TYPES,
  SERVICE_MAP_DECISION_BY,
  SERVICE_MAP_FIRST_STEPS,
  SERVICE_MAP_SOURCE_STATUSES
} from '../lib/serviceMap/accessPath.js';
import {
  NARROW_MAP_WIDTH,
  POPUP_EDGE_PADDING,
  ZOOM_CONTROL_CLEARANCE,
  accessPathWord,
  addressNamesMunicipality,
  groupPopupView,
  popupDateLocale,
  popupSourceLink,
  popupTopLeftPadding,
  serviceEmailHref,
  servicePhoneHref
} from '../components/workspace/serviceMapPopupRules.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const LANGS = ['et', 'en', 'ru'];
/* Nagu platvormi tõlkefunktsioon: puuduva võtme korral tagastab VÕTME ENDA. */
const translator = (lang) => {
  const data = catalog(lang);
  return (key) => {
    const value = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), data);
    return typeof value === 'string' ? value : key;
  };
};

test('igal ligipääsutee väärtusel on sõna kolmes keeles', () => {
  const groups = {
    firstSteps: SERVICE_MAP_FIRST_STEPS,
    accessTypes: SERVICE_MAP_ACCESS_TYPES,
    decisionByValues: SERVICE_MAP_DECISION_BY,
    sourceStatuses: SERVICE_MAP_SOURCE_STATUSES
  };
  for (const lang of LANGS) {
    const t = translator(lang);
    for (const [group, values] of Object.entries(groups)) {
      for (const value of values) {
        const word = accessPathWord(t, group, value);
        assert.ok(word.trim(), `${lang}: ${group}.${value}`);
        assert.ok(!/^[A-Z_]+$/.test(word) && !word.includes('serviceMap.'), `${lang}: ${group}.${value} ei tohi olla kood ega võti: ${word}`);
      }
    }
    assert.ok(catalog(lang).serviceMap.contactCheckedAt, `${lang}: serviceMap.contactCheckedAt`);
  }
  /* Eesti tekstides ei ole mõttekriipse. */
  assert.ok(!/[—–]/.test(JSON.stringify(catalog('et').serviceMap)));
});

test('sõnata väärtus on „Teadmata", mitte kood ega võti', () => {
  const t = translator('et');
  assert.equal(accessPathWord(t, 'firstSteps', 'CHECK_SOURCE'), 'Vaata ametlikku allikat');
  assert.equal(accessPathWord(t, 'firstSteps', 'check_source'), 'Vaata ametlikku allikat');
  /* Tundmatu väärtus: tõlkefunktsioon tagastab võtme, reegel loeb selle puuduvaks. */
  assert.equal(accessPathWord(t, 'firstSteps', 'SOMETHING_NEW'), 'Teadmata');
  assert.equal(accessPathWord(t, 'tundmatuRühm', 'X'), 'Teadmata');
  assert.equal(accessPathWord(t, 'sourceStatuses', ''), 'Teadmata');
  /* Ilma tõlkefunktsioonita ja täiesti tühja kataloogiga jääb sõna, mitte kood. */
  assert.equal(accessPathWord(null, 'firstSteps', 'CONTACT_KOV'), 'Teadmata');
  assert.equal(accessPathWord((key) => key, 'firstSteps', 'CONTACT_KOV'), 'Teadmata');
});

test('rühma paneelis on ees loend või üks kontakt', () => {
  const group = { id: 'coord:58.3:26.69', entries: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  /* Valikut ei ole või valitud on mujal: loend. */
  assert.deepEqual(groupPopupView(group, ''), { view: 'list', entry: null });
  assert.deepEqual(groupPopupView(group, 'mujal'), { view: 'list', entry: null });
  /* Valitud kontakt on ees. */
  assert.deepEqual(groupPopupView(group, 'b'), { view: 'contact', entry: { id: 'b' } });
  /* Pärast „tagasi" on ees loend, kuigi valik püsib; teise rühma märge ei mõju. */
  assert.equal(groupPopupView(group, 'b', group.id).view, 'list');
  assert.equal(groupPopupView(group, 'b', 'coord:teine').view, 'contact');
  assert.equal(groupPopupView(null, 'b').view, 'list');
});

test('telefon, e-post, piirkond ja allikalink', () => {
  assert.equal(servicePhoneHref('+372 5550 0001'), 'tel:+37255500001');
  assert.equal(servicePhoneHref('612 3456'), 'tel:6123456');
  assert.equal(servicePhoneHref('(+372) 612 3456'), 'tel:+3726123456');
  /* Kaks numbrit järjest: esimene, mitte kaks kokku liidetuna. */
  assert.equal(servicePhoneHref('6123456 5123456'), 'tel:6123456');
  assert.equal(servicePhoneHref('6123456, 5123456'), 'tel:6123456');
  assert.equal(servicePhoneHref('+372 6123456 (üldtelefon)'), 'tel:+3726123456');
  assert.equal(servicePhoneHref('kokkuleppel'), '');
  assert.equal(servicePhoneHref(''), '');
  assert.equal(serviceEmailHref(' vald@example.test '), 'mailto:vald@example.test');
  assert.equal(serviceEmailHref('ei ole aadress'), '');

  assert.equal(addressNamesMunicipality({ address: 'Pargi 2, Ülenurme alevik, Kambja vald', municipalityName: 'Kambja vald' }), true);
  assert.equal(addressNamesMunicipality({ address: 'Pargi 2, Ülenurme', municipalityName: 'Kambja vald' }), false);
  assert.equal(addressNamesMunicipality({ address: '', municipalityName: 'Kambja vald' }), false);

  /* Allikalink on tegevuste reas ainult siis, kui plokki ei ole ja see ei korda veebilehte. */
  assert.equal(popupSourceLink({ accessShown: false, sourceUrl: 'https://a.test/x', websiteUrl: 'https://a.test/' }), 'https://a.test/x');
  assert.equal(popupSourceLink({ accessShown: false, sourceUrl: 'https://a.test/', websiteUrl: 'https://a.test/' }), '');
  assert.equal(popupSourceLink({ accessShown: true, sourceUrl: 'https://a.test/x', websiteUrl: '' }), '');
  assert.equal(popupSourceLink({}), '');

  assert.equal(popupDateLocale('et'), 'et-EE');
  assert.equal(popupDateLocale('en'), 'en-GB');
  assert.equal(popupDateLocale('ru-RU'), 'ru-RU');
  assert.equal(popupDateLocale(undefined), 'et-EE');
});

test('paneeli vaba äär: laial kaardil suumi nuppudest paremal, kitsal kaardil servani', () => {
  assert.deepEqual(popupTopLeftPadding(1362), [ZOOM_CONTROL_CLEARANCE, POPUP_EDGE_PADDING]);
  assert.deepEqual(popupTopLeftPadding(NARROW_MAP_WIDTH), [ZOOM_CONTROL_CLEARANCE, POPUP_EDGE_PADDING]);
  assert.deepEqual(popupTopLeftPadding(NARROW_MAP_WIDTH - 1), [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]);
  assert.deepEqual(popupTopLeftPadding(348), [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]);
  /* Mõõduta kaart (veel laadimata): kitsam, ohutum äär. */
  assert.deepEqual(popupTopLeftPadding(undefined), [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]);
  /* Suumi nupud ulatuvad 44 px-ni; vaba äär peab neist üle ulatuma. */
  assert.ok(ZOOM_CONTROL_CLEARANCE > 44);
});

test('komponent: kaart ehitab paneeli alati seotud funktsiooniga', () => {
  const source = read('../components/workspace/ServiceMapLeaflet.jsx');
  /* Valmis sõlme kaardile ei anta (kaart jätaks selle meelde). */
  assert.ok(!source.includes('setPopupContent('), 'paneeli sisu uuendatakse `update()` kaudu');
  assert.ok(source.includes('popup.update();'));
  /* Vaate vahetus käib komponendi kaudu, mitte paneeli sees. */
  assert.ok(source.includes('view.onBack?.(shown.entry.id);'));
  assert.ok(source.includes('if (opened.id === selectedEntryId) view.onReopen?.(opened.id);'));
  assert.ok(!source.includes('listView.hidden'), 'paneel ei vaheta vaadet kohapeal ilma kaardita');
  /* Uus valik toob kontakti ette; sama valiku kordus vaadet ei muuda. */
  assert.match(source, /if \(lastSelectedRef\.current !== selectedEntryId\) \{\s*lastSelectedRef\.current = selectedEntryId;\s*groupListRef\.current = "";/);
  /* Sisuta ligipääsutee plokki ei joonistata. */
  assert.ok(source.includes('if (!hasDetails && !isHealthContact) return null;'));
  /* Vaba äär loetakse kaardi laiusest iga ehituse eel. */
  assert.ok(source.includes('popup.options.autoPanPaddingTopLeft = popupTopLeftPadding(mapRef.current?.getSize?.().x);'));
  assert.ok(source.includes('autoPanPaddingBottomRight: [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]'));
  assert.ok(source.includes('className={`service-map-leaflet-shell ${styles.shell}`}'));
  /* Leht ja kaart kasutavad sama telefoni reeglit ning kaart saab lehe keele. */
  const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
  assert.ok(!page.includes('function serviceMapPhoneHref('));
  assert.ok(page.includes('import { servicePhoneHref } from "@/components/workspace/serviceMapPopupRules";'));
  assert.match(page, /<ServiceMapLeaflet[^>]*locale=\{locale\}/s);
});

test('kujundus: paneel mahub kaardialasse, legend ja suumi nupud ei kata seda', () => {
  const css = read('../app/styles/workspace.css');
  const moduleCss = read('../components/workspace/ServiceMapLeaflet.module.css');
  /* Kõrgus ja laius tulevad kaardiala mõõtudest; valem arvestab sama vaba äärega. */
  assert.match(css, /\.service-map-canvas \{[^}]*container-type: size;/s);
  assert.ok(css.includes('max-height: min(65vh, 32rem, calc(100cqh - 1.3rem - 46px));'));
  assert.equal(css.split("min(24rem, calc(100cqw - 3.4rem))").length - 1, 2);
  assert.equal(POPUP_EDGE_PADDING, 10, 'valem 46 px = raam 4 + nool 20 + 2 × vaba äär 10 + varu 2');
  /* Vana brauseri varu on omaette plokis (kaks deklaratsiooni samas reeglis ehitust üle ei ela). */
  const fallback = css.slice(css.indexOf('@supports not (height: 1cqh)'));
  assert.ok(fallback.includes('max-height: min(65vh, 32rem);'));
  assert.equal(fallback.split('calc(100vw - 3rem)').length - 1, 2);
  /* Legend peidab end avatud paneeli ajaks. */
  assert.match(css, /\.service-map-leaflet-shell:has\(\.leaflet-popup\) \.service-map-leaflet__legend \{\s*visibility: hidden;/);
  /* Kitsal kaardil peidetakse suumi nupud avatud paneeli ajaks; piir on sama mis reeglis. */
  assert.match(moduleCss, /@container \(max-width: 479\.98px\) \{\s*\.shell:has\(:global\(\.leaflet-popup\)\) :global\(\.leaflet-control-zoom\) \{\s*visibility: hidden;/);
  assert.equal(NARROW_MAP_WIDTH, 480);
  /* Kihistamata moodul võidab Leafleti lõiguveerised. */
  assert.match(moduleCss, /\.shell :global\(\.leaflet-popup-content\) p,[^{]*\{\s*margin: 0;/s);
});
