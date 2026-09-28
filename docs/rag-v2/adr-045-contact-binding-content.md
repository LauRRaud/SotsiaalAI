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

- **Seose versioon 2** (`sotsiaalai/verified-contact-binding-2`) seob registrikirje ID, revisjoni ja sisu räsi (`content_sha256`). Sisu räsi arvutatakse ID-st, revisjonist, päritolust, omavalitsusest, nimest, telefonist, e-postist ja ametlikust URL-ist, ilma kontrolliajata.
  - `checked_at` jääb seosesse ja kirjesse ajaloona: kontroll, mida eksport luges.
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
  - kaheksa sisu või identiteedi muutust kehtetustavad seose;
  - võltsitud räsi või kirje kontrolliaeg ei seo;
  - versioon 1 vajab endiselt sama kontrolliaega.
- **`tests/rag-v2-structured-records.integration.test.mjs`**, päris PostgreSQL, Qdrant, Prisma register ja EstNLTK, 9/9:
  - sama revisjoni ja sisu uus kontroll hoiab ekspordi;
  - muudetud telefon ilma revisjonita, uus revisjon ja ekspordi ajal eemaldatud kirje kehtetustavad nagu seni;
  - paketikontakt ja selle eksport on sama dokument (`batch_document_conflict`).
- `npm test` läbis.

## Mis jääb operaatorile

- **Vastendus vajab ülevaatust enne eksporti.** Nime järgi automaatset avaldamist see otsus ei luba. Ametlik allikas ja kontakti sobivus teenusega kontrollitakse.
- **Kandidaadid on serveris** (`rag-v2-work/eval-files/contact-candidates-2026-09-28.json`, mitte repos): 384 ühest nimevastet 60 omavalitsuses, 20 mitmest ja 404 vasteta.
- **Järjekord pärast ülevaatust:**
  1. eksport (`scripts/rag-v2-contact-export.mjs`, kuni 100 kontakti korraga);
  2. partii ülevaatus ja avaldamine;
  3. indeksi uus põlvkond;
  4. uus vestlusplaan.
