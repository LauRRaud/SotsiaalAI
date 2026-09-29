# ADR-050 — Õigusakti lisa tabel korpusesse: abivahendite loetelu koos piirhindadega

29.09.2026. Teostus Claude Opus 5.5 omaniku otsusel „lisa määruse lisa allikaks“. Järgib [ADR-046](adr-046-cost-conditions.md) leidu.

## Probleem

- Kuuldeaparaadi küsimusele ei öelnud ükski vastus piirhinda (kataloog v4: 0/7 mõõtmist, ADR-046). Allikalünk oli teada: seadmete tabel on määruse lisa, mitte seadusetekst.
- **Lisa oli korpuse sisendis olemas, aga seda ei loetud.** Riigi Teataja XML sisaldab lisa base64-kodeeritud PDF-ina (`oigusakt/lisaViide/.../fail`), `sisu` kõrval. XML-i tekstiadapter loeb ainult `sisu`-t.
  - Sotsiaalkaitseministri määrus nr 74, redaktsioon 01.09.2025–30.09.2026: `oigusaktid/129082025009.xml`, lisa `SOM_m43_lisa.pdf` (16 lk).
  - Sama määrus alates 01.10.2026: `oigusaktid/126092026005.xml`, lisa `SOM_24092026_m37_lisa.pdf` (17 lk).
- Lisa on 18 veeruga tabel. Iga abivahendi kohta on seal:
  - ISO-kood ja nimetus, kasutusaeg, tehingu liik ning koguseline piirlimiit;
  - tasu maksmise kohustuse ülevõtmise piirmäär (% piirhinnast), piirhind (üür kuus / müük) ja ühik;
  - soodustingimuste kriteeriumid, eeldus- ja välistavad koodid, vajaduse tuvastaja ning sobiv spetsialist.
- Näiteks kõrvasisesed kuulmisabivahendid, aktiivsusgrupp I: 90%, piirhind 350,00 (vana) ja 500,00 (uus redaktsioon).

## Otsus

- **Lisa tabel on eraldi tuletatud dokument**, mitte XML-parseri muudatus.
  - Parseri muutmine oleks andnud uue versiooni igale lisaga RT aktile, sh vormide ja kaartidega.
  - Üldine PDF-tabelite lugemine sisestuse ajal oleks olnud habras.
- **Väljavõtja** (`lib/rag-v2/adapters/rt-annex.js`, `rag-v2/rt-annex-table-1`):
  - võtab XML-ist lisa PDF-i ja loeb pdf.js-iga tekstielemendid koos asukohaga;
  - tuvastab veerud päise tekstiplokkidest. Päised on tsentreeritud ja mitmerealised; veerg on päise teksti katkematu x-vahemik;
  - **kontrollib päist:** 18 veergu oodatud nimedega (ainult tähed ja numbrid, nii et reavahe ja poolitus ei loe). Teise kujuga tabel peatab väljavõtte (`annex_table_header_changed`), mitte ei anna vaikselt valesid ridu;
  - alustab uut rida koodist esimeses veerus (ka „06.“ punktiga). Rida jätkub järgmisele lehele kuni uue koodini. Sama joone elemendid rühmitatakse enne (±0,6 ühikut, sest kood võib olla 0,2 madalamal);
  - paigutab lahtri teksti veergu, mille päise sees see algab. Päiste vahele jääv tekst läheb keskpunkti järgi lähimasse veergu, sest kitsad numbriveerud on tsentreeritud;
  - ei ühenda korduvat koodi: „09.30“ on nii rühm kui rida, ja kordus saab ID `09.30-2`.
- **Tuletatud allikas** (`scripts/rag-v2-rt-annex.mjs` → `Andmebaasi/oigusaktid/lisad/<akt>-abivahendite-loetelu.json` ja `.meta.json`):
  - esimene kirje on lisa pealkiri ja veergude nimed;
  - iga tabelirida on kirje: kood ja nimetus, rühmatee („22 … > 22.06 Kuulmisabivahendid > 22.06.12 …“) ning iga täidetud veerg kujul „veeru nimi: väärtus“ ja lisa lehekülg. Veeru nimed on akti enda päised; üks lähtetrükiviga „oleme“ on parandatud „olema“-ks.
  - Metaandmed:
    - `source_type: legal_act`, riiklik;
    - akti väljaandja, kehtivus ja avaldamiskuupäev XML-ist;
    - RT aadress;
    - `rt_annex`: XML-i tee ja räsi, akti viide, lisa failinimi ja PDF-i räsi, väljavõtja versioon, ridade ja lehtede arv.
- **Sisestusel kontrollib registriadapter päritolu uuesti** (`registered-source.js`):
  - XML on registris sama räsiga allikas;
  - lisa on selles sama räsiga;
  - dokumendi akti viide ja kehtivus on XML-i omad;
  - tüüp on `legal_act`.

  Iga kõrvalekalle peatab sisestuse (`rt_annex_*`).
- **Kehtivus pärib akti oma:**
  - vana redaktsiooni lisa kehtib 01.09.2025–30.09.2026;
  - uue redaktsiooni lisal on avatud lõpp, sest XML-is lõppu pole (`normalize.js`, allikas `riigi_teataja_xml_annex`). Seda kontrollib registriadapter.
  - Nii valib otsingu kehtivusreegel (ADR-032, ADR-042) õige lisa päeva järgi. 30.09 on vana piirhind, 01.10-st uus.
- **Olemasolevad allikad ei muutu.** Töötluskoodi silte ei tõstetud:
  - sama sisend vana ja uue koodiga (kolm RT akti, üks KOV kirje, üks PDF-juhend) andis sama kimbu, erines ainult `ingested_at`;
  - uuendati ainult sõrmejälge (`processing-implementation.json`).

## Piirid

- Väljavõtja tunneb ainult abivahendite loetelu tabelit. Teine lisa vajab oma veerukirjeldust (`ANNEX_TABLES`) ja ülevaatust.
- Väljavõte on korratav: test võrdleb registris olevat tuletatud faili värske väljavõttega baitide kaupa. Sisuline õigsus on kontrollitud veergude väärtuste auditiga, mitte iga rea käsitsi võrdlusega PDF-iga.
  - Kõigis 652 reas on lühiveergudes ainult oodatud väärtused (nt tehingu liik M, Ü või „M / Ü“; ühik tk, paar, summa).
  - Hinnaveerus on arv või allika enda märkus („erandi taotluse alusel“).
- Kogu lisa rida on üks kirje. Pikad kriteeriumid jäävad samasse kirjesse, lõigustaja jagab vajadusel.
- Kui RT avaldab määrusele uue redaktsiooni, tuleb selle lisa samamoodi välja võtta ja registrisse lisada. Kehtivuse kuukontroll (ADR-038) vaatab XML-akte, mitte tuletatud lisasid.

## Kontroll

- `tests/rag-v2-rt-annex.test.mjs`:
  - registris olevad tuletatud failid on täpselt väljavõtja väljund mõlemast registreeritud XML-ist;
  - võtmeread: kuulmisabivahendi piirhind ja määr õiges veerus, üüri veerg tühi;
  - „200,00 erandi taotluse alusel“ jääb müügi veergu;
  - „06“ ja „27“ saavad nime, „09.30-2“, ja vana redaktsiooni 22.06.15 nimi jääb oma reale;
  - registriadapter lükkab tagasi vale PDF-i räsi, failinime, kehtivuse, tüübi, registreerimata XML-i ja puuduva akti viite;
  - päris sisestus annab uue redaktsiooni lisale avatud lõpu ja vanale 30.09.2026. Pealkiri leitakse tekstist ning tükis on „Piirhind (müük): 500,00“.
- `npm test`, ESLint ja `git diff --check`.
- Serveris: indeksi põlvkond, käsitsi plaan ja kuuldeaparaadi stsenaarium (tulemus allpool, kui olemas).
