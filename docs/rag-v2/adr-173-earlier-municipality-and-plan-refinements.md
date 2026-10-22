# ADR-173 — Eelmise pöörde omavalitsus valib sama nimega omavalitsuste vahel. Plaani täpsustused (search-assist-23)

22.10.2026. Teostus Claude Opus 5.5. Lühikese vigade testi F1 leiud (omanik: „tee testküsimustik lühem … küsima neid, kus
olid vead“).

## Leid (F1, 27 pööret)

- **C10 jäi kahe Viljandi vahele.**
  - C01 otsiti Viljandi linnast.
  - C10 „Kellega ma Viljandis esimesena ühendust võtan?“ jäi Viljandi linna ja valla vahele
    (`search_plan_ambiguous_region`).
  - Eelmise pöörde omavalitsus ei osalenud valikus. ADR-157 valib ainult praeguse sõnumi kontrollitud koha järgi.
- **B20–B25 jäid omavalitsuseta.**
  - Plaan andis „Narva linn suunas meile“ seose `works`, aga isikuks pani kliendi („üksikema“).
  - Tööpiirkonnaks loetakse ainult kasutaja `works`-koht, sest „klient töötab Tartus“ ei ole spetsialisti tööpiirkond.
- **Tabasalu ravikindlustus.** T1 ja T2 plaani päring oli „ravikindlustuseta inimesele kohaliku omavalitsuse abi“.
  Kandidaatide sekka ei jõudnud ühtegi lõiku ravikindlustuseta inimese tervishoiust. Valik märkis asjaoluks
  toimetulekuraskuse lõigud.

## Otsus

- **Eelmise pöörde omavalitsus valib (`earlierChoice`).** Kui sama nimi annab kaks omavalitsust ja üks neist on see, kust
  eelmine pööre sama inimese jaoks otsiti (`askedBefore`, `askedPerson`), valitakse see.
  - Kehtib plaani päringute kaudu (`plannedPlaceChoice`, pärast sõnumi enda kohta) ja küsitud mainimise kaudu
    (`questionRegionScope`).
  - Midagi ei valita, kui eelmine omavalitsus ei ole kandidaatide seas või neid on kaks või see oli teise inimese oma.
  - Praeguse sõnumi enda kontrollitud koht otsustab endiselt esimesena.
- **Plaan (search-assist-23):**
  - Kliendi suunanud või teenust tellinud omavalitsus on kasutaja koht (`person "user"`), mitte kliendi oma. Nii öeldakse
    nii kohtade reeglis kui ka teenuseosutaja rollireas.
  - Kirjeldatud asjaolu päring nimetab asjaolu ja seda, mida see ise kaasa toob (näiteks ravikindlustuseta inimese
    tervishoid), mitte küsitud teemat.
- **ADR-169 parandus.** Loetakse 10 lähimat kirjet, mitte 16 (vt ADR-169).

## Kontroll

- **Kohalik (`adr173-check`):**
  - C10-laadne mainimine ja eelmine Viljandi linn annavad `search_plan_region viljandi_linn` (`earlier_question`);
  - ilma eelmiseta, teise inimese või kahe eelmise omavalitsuse korral ei valita midagi;
  - sõnumi oma koht otsustab endiselt esimesena;
  - küsitud mainimise teel tuleb `question_region viljandi_linn`, ilma eelmiseta `question_regions`.
- **ADR-157, 167, 168 ja 171 kontrollid läbisid.**
- **Plaani juhis.** Uued laused on päringu juhises olemas.
- **Serveris.** Õhtune F2 jooks eelregistreeringu järgi (focused_runs.before_F2):
  - B19–B25 4/4 Narva linn;
  - C10 Viljandi linn;
  - Tabasalu ravikindlustuse lõik kandidaatide seas;
  - vastuse sisend väiksem kui F1-s.
