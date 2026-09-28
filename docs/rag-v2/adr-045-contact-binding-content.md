# ADR-045 — Kontaktiekspordi sidumine sisu, mitte kontrolliaja järgi

28.09.2026. Teostus Claude Opus 5.5. Codexi soovitatud variant B ([audit §14](../audits/rag-v2-codex-review-2026-09-27.md#14-pr-ide-236240-järelkontroll-2809), [vestluste hindamise kontaktileid](../audits/rag-v2-conversation-eval-2026-09-28.md#omavalitsuse-kontaktid-kataloog-ei-anna-ühtegi-kontaktisikut)). Täiendab [ADR-017](adr-017-verified-contact-export.md).

## Probleem

- **Vestlus ei anna ühtegi omavalitsuse kontaktisikut.** 808 paketikontaktist ei läbi kontrolli ükski, sest paketi ID ja registrikirje vahel puudub seos. Paketikontaktidel pole ka telefoni ega e-posti.
- **ADR-017 ekspordi sidumine oleks aegunud nädalaga.**
  - Seos (`registry_binding`, versioon 1) võrdles registri `checkedAt`-i otse ja hoidis seda ka projektsiooni räsis.
  - Iganädalane kontaktikontroll kirjutab kinnitatud kirjete `checkedAt`-i üle. Nii tühistas iga uus kontroll muutumata kontakti ekspordi.
- **Eksport oleks loonud teise dokumendi sama aliasega.**
  - Eksport kirjutas `source_type: 'municipal_contact'`, paketikontaktidel on `official_contact`.
  - Dokumendi identiteet tuleb tenant'ist, allikaliigist ja `canonical_item_id`-st, seega oleks eksport olnud uus dokument.
  - Kaks sama aliasega kirjet peatavad omavalitsuse kataloogi (`ambiguous_record_identity`).

## Otsus

- **Seose versioon 2** (`sotsiaalai/verified-contact-binding-2`) seob registrikirje ID, revisjoni ja sisu räsi (`content_sha256`). Sisu räsi arvutatakse ID-st, revisjonist, päritolust, omavalitsusest, nimest, telefonist, e-postist, ametlikust URL-ist ning registri tüübist ja kirjeldusest, ilma kontrolliajata.
  - Kirjelduses on registri roll: „Roll: … Osakond: …“.
  - `checked_at` jääb seosesse ja kirjesse ajaloona: kontroll, mida eksport luges.
- **Roll tuleb registrist** (Codex 28.09: teenuserolli muutus peab seose lõpetama).
  - Eksport kannab registri kirjeldusest loetud rolli ja osakonda, kui kirjeldus on kujul „Roll: … Osakond: …“. Paketi vana rolli ei kanta.
  - Seose kontroll nõuab, et kirje roll ja osakond vastaksid registrile täpselt.
  - Uus roll lõpetab seose nagu uus telefoninumber, ka ilma revisjoni tõstmata.
- **Jooksev kontroll jääb samaks:** `readVerifiedMunicipalContact` ehk registri värskusreegel.
  - Kontrollitud kirje tohib olla kuni 90 päeva vana, sama revisjoni ja kontrollajaga.
  - Kirje peab olema avaldatud, ilma eemaldamismärketa, lubatud päritoluga, ametliku URL-iga ja aktiivse omavalitsuse all.
  - Otsing, vastuse saatmine ja taastamine kordavad seda nagu seni.
  - Muutumatu kontakti uus kontroll hoiab ekspordi kehtivana.
  - Iga muutus kehtetustab ekspordi: nimi, telefon, e-post, URL, revisjon, omavalitsus, päritolu või kirje ID; samuti aegumine või eemaldamine.
- **Versiooni 1 seosed jäävad loetavaks oma vana reegliga** (sama kontrolliaeg). Uus eksport kirjutab versiooni 2.
- **Eksport hoiab paketi `source_type`-i** (vaikimisi `municipal_contact`). Nii jääb dokumendi identiteet samaks ja avaldamine asendab paketikontakti versiooni, nagu ADR-017 eeldas.
- **Ekspordi ajal kordub kontroll sisu järgi.** Samal ajal toimunud uus kontroll ei ole muutus.

## Kontroll

- **`tests/rag-v2-contact-binding.test.mjs`** (uus, andmebaasita):
  - Codexi sond, kus liigub ainult kontrolliaeg: seos jääb kehtima;
  - kümme sisu, rolli või identiteedi muutust kehtetustavad seose;
  - kirje peab kandma registri rolli, mitte paketi vana rolli;
  - rolli loetakse ainult kujust „Roll: … Osakond: …“;
  - võltsitud räsi või kirje kontrolliaeg ei seo;
  - versioon 1 vajab endiselt sama kontrolliaega.
- **`tests/rag-v2-structured-records.integration.test.mjs`**, päris PostgreSQL, Qdrant, Prisma register ja EstNLTK, 9/9:
  - sama revisjoni ja sisu uus kontroll hoiab ekspordi;
  - eksport kannab registri rolli; uus roll lõpetab seose ja endine roll taastab selle;
  - muudetud telefon ilma revisjonita, uus revisjon ja ekspordi ajal eemaldatud kirje kehtetustavad nagu seni;
  - paketikontakt ja selle eksport on sama dokument (`batch_document_conflict`).
- `npm test` läbis.

## Mis jääb operaatorile

- **Vastendus vajab ülevaatust enne eksporti.** Nime järgi automaatset avaldamist see otsus ei luba. Ametlik allikas ja kontakti sobivus teenusega kontrollitakse.
- **Kandidaadid on serveris** (`rag-v2-work/eval-files/contact-candidates-2026-09-28.json`, mitte repos): 384 ühest nimevastet 60 omavalitsuses, 20 mitmest ja 404 vasteta.
- **Ülevaatetabel on serveris** (`rag-v2-work/eval-files/contact-review-2026-09-28/`, mitte repos, sest seal on nimed).
  - Iga rea kohta on seal:
    - paketikontakt (nimi, roll, osakond);
    - registrikirje (ID, olek, tüüp, roll, osakond, telefoni ja e-posti olemasolu);
    - mõlemad ametlikud lehed;
    - kontaktile viitavad teenused;
    - ettepanek ja sobivuse põhjendus;
    - tühjad veerud operaatori otsuse ja märkuse jaoks.
  - Ettepanek ei ole otsus. „Ettepanek: lisada“ on ainult siis, kui roll kattub, ametlik leht on sama või sama omavalitsuse domeenis, registris on telefon või e-post ja vähemalt üks teenus viitab kontaktile. Muu on „kontrolli“, koos põhjusega.
  - Tulemus: 139 „ettepanek: lisada“ ja 245 „kontrolli“. Kõik 384 registrikirjet on praegu kontrollitud ja ükski paketifail pole pärast indekseerimist muutunud.
  - Harku on eraldi (`review-harku_vald.csv`, `mapping-draft-harku_vald.json`): 7 ettepanekut ja 1 „kontrolli“, sest ükski teenus ei viita sellele kontaktile.
  - Ülejäänud on kuni 100-realistes vastenduse mustandites (`mapping-draft-1…4.json`).
- **Kogu rada Harku andmetega, kohalik katse 28.09.**
  - Kasutati päris Harku paketti ja 8 kontrollitud registrikirjet. Need kopeeriti kohalikku eraldatud testiandmebaasi ja kustutati pärast katset.
  - Rada:
    1. eksport: 8 kontakti, seos 2, `official_contact`, igaühel roll, telefon ja e-post;
    2. partii: 62 kirjet ilma takistusteta, paketikontaktide asemel eksporditud kontaktid;
    3. indeks eraldi katsetenant'is näidisvektoritega;
    4. Harku kataloog, kui fookuses on Toidupank.
  - Kataloog andis sotsiaalhoolekandespetsialisti koos nime, rolli, osakonna, telefoni, e-posti ja ametliku lehega. Just seda küsis vestlus „Kellele ma saan helistada?“.
  - Kontrollid:
    - iganädalase kontrolli järel oli 8/8 lubatud;
    - muudetud telefoniga või muudetud rolliga kontakt kukkus välja (7/8);
    - taastamise järel oli taas 8/8.
  - Tootmises ei muudetud midagi ja mudelikutseid ei tehtud.
- **Järjekord pärast ülevaatust:**
  1. eksport (`scripts/rag-v2-contact-export.mjs`, kuni 100 kontakti korraga);
  2. partii ülevaatus ja avaldamine;
  3. indeksi uus põlvkond;
  4. uus vestlusplaan.
