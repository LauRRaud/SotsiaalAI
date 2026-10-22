# ADR-180 — „Mis paragrahv seda ütleb?“ vastatakse eelmise vastuse tõenditest, ilma uue otsinguta

23.10.2026. Teostus Claude Opus 5.5.

## Leid

- Omanik küsis ADR-179 järel jätkuküsimuse „Mis paragrahvid?“ ja nägi kogu ootevaadet uuesti: plaan kirjutas otsingu
  „Harku valla koduteenus eakale õiguslik alus paragrahv“, otsing leidis 20 allikat ja valik luges need.
- Omanik: „eelmise vastuse allikad on juba ju olemas“. Pakkumise peale (vasta eelmise vastuse allikatest ilma uue
  otsinguta): „jah, see ka võimalik“.
- Eelmise vastuse pakis on iga tsiteeritud õigusakti lõik koos sättega (`legal_place`). Sama sätet näitab ka paneel
  „Allikad“.
- ADR-179 järel ei nimeta vastus sätet enam küsimata, seega tuleb see küsimus tihemini.

## Otsus

- **Tuvastus (`provision-followup.js`, `loneProvisionQuestion`).** Kitsas ja deterministlik, nagu tervitus ja tänu
  (`greeting.js`). Terve sõnum peab vastama kõigile tingimustele:
  - kuni 10 sõna ja kuni 80 märki;
  - vähemalt üks sõna nimetab sätet, õiguslikku alust või seadust (eesti, inglise või vene keeles, terved sõnavormid,
    mitte tüved: „alustada“ ei ole „alus“);
  - iga teine sõna on küsisõna, tagasiviide („seda“, „need“), ütlemise tegusõna või viisakus.

  Üks muu sõna teeb sellest uue päringu, näiteks „Mis seadus ütleb lapsetoetuse kohta?“ või „Mida ütleb SHS § 133 lg 5?“.
- **Tingimused.**
  - Sõnum jätkab vestlust lühikese tee loaga (`shortRoute`: dialoog, otsinguabi ja ühtne otsing).
  - Eelmise vastuse audit-rida on alles, tema pakk on terve (`model_context`, mitte `lean`) ja vastus tsiteeris
    vähemalt üht õigusakti lõiku (`citedLegalSources`).
  - Pakk läbib praeguse indeksi vastu viidete kontrolli (`checkReferences`). Muidu läheb pööre tavateed.
- **Tee.** Ei tehta plaani, vektorit, otsingut ega valikut. Pööre võtab eelmise vastuse paki ja vastusemudel kirjutab
  sellest. Küsimus palub sätet, seega nimetab vastus selle (ADR-179) ja esimene lause ütleb küsitu.
  - Pöörde kirjes on `searchAssist.previousEvidence` (eelmise pöörde id ja tsiteeritud õigusaktide viited).
  - Admini jäljes on `plan.previousEvidence`. Tervisearuanne loeb need teeks `previous_evidence`.
- **Ootevaade.** Samm `chosen` koos lipuga `previous: true` ja tsiteeritud aktide pealkirjadega. Pealkiri on
  „Vaatan eelmise vastuse allikaid…“, siis „Kirjutan vastust…“.

## Mõju

- Sellisel pöördel jäävad ära plaan (umbes 2–4 s), vektor, otsing ja valik (umbes 4–8 s). Vastusekutse on sama suur kui
  eelmisel pöördel.
- Paneel „Allikad“ näitab sama paki allikaid; kasutatuks on märgitud need, mida see vastus tsiteerib.

## Kontroll

- **Kohalikult:**
  - tuvastus: 14 jah-näidet ja 10 ei-näidet (sh „Mis paragrahv ütleb, et vald peab mulle korteri andma?“, „Kust
    alustada?“, „Это нормально?“);
  - `citedLegalSources` arvestab ainult `legal_place`-iga lõike;
  - ootevaate pealkiri;
  - eslint ja i18n.
- **Serveris (omanik):** „Kas Harku vallas on koduteenus eakale?“ ja siis „Mis paragrahv seda ütleb?“. Teine vastus
  peab tulema kiiresti, ilma kaardi ja otsinguta, ja nimetama sätte esimeses lauses.
