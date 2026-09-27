# ADR-038 — Õigusaktide kehtivuse igakuine kontroll Riigi Teataja vastu

27.09.2026. Teostus Claude Opus 5.5. Järgib Codexi #217 järelkontrolli ([aruanne, jaotis 7](../audits/rag-v2-codex-review-2026-09-27.md#7-pr-217-eelarveparanduse-järelkontroll)). Omaniku otsus samal päeval: kontroll käib kord kuus, mitte iga päev.

## Probleem

- Riigi Teataja (RT) muudab teksti kehtivusaega ka pärast seda, kui oleme selle alla laadinud. Terviktekst suletakse, kui avaldatakse uus redaktsioon või akt, mis selle asendab.
  - 27.09 oli 17 indekseeritud akti tegelikult lõppenud ([PR #215](https://github.com/LauRRaud/SotsiaalAI/pull/215)).
  - Vestlus kohtles neid kehtivana, sest kehtivusreegel ([ADR-031](adr-031-source-level-and-answer-completeness.md)) kasutab indekseerimise ajal salvestatud kuupäevi.
- Riigilõivuseaduse (RLS) tekstide vahel on RT andmetes auk: `111072026166` lõpeb 30.10.2026 ja `111072026167` algab 01.11.2026. 31.10 kohta RT teksti ei avalda. Sama on ametlikes XML-ides.
- Senine kontroll oli töökausta käsitsi skript:
  - see ei jooksnud ise;
  - see ei vaadanud kõiki otsingutulemuse lehti;
  - see ei eristanud ebaõnnestunud päringut muutumata allikast.

## Otsus

### Manifest

- Fail `docs/rag-v2/legal-acts-in-index.json` loetleb õigusaktid, mida aktiivne korpus kasutab. Selle teeb `scripts/rag-v2-law-validity.mjs manifest`.
- Hõlmatud on kõik Riigi Teataja XML-id, mis on nii hoidla aktiivses peas kui ka indeksi poliitikas.
- Iga akti kohta on kirjas:
  - dokument ja selle versioon;
  - RT akti ID (`globaalID`) ja tervikteksti grupp (`terviktekstiGrupiID`);
  - pealkiri, väljaandja ja piirkonnad;
  - kehtivusaeg, millega tekst indekseeriti.
- Manifest tehakse uuesti iga korpuse avaldamisel ([runbook, samm 10](runbook-corpus-increment.md#10-kontroll-ja-koristus)). 27.09 seis: 87 akti 64 grupis, korpus v32.

### Kontroll

Kontroll (`check`) loeb ainult avalikke andmeid ja ei muuda midagi. Iga grupi kohta vaatab ta järgmist.

- **Indekseeritud aktid:** iga akti praegune kehtivus RT XML-ist. Kui see erineb indekseeritud kehtivusest, on leid `validity_changed`.
- **Grupi redaktsioonid:** kõik avaldatud redaktsioonid otsingu-API-st.
  - Leid `missing_version`: redaktsioon kehtib tänasest kuni 400 päeva ette, aga korpuses seda pole.
- **Lüngad ja kattuvused** tänasest kuni 400 päeva ette, päeva täpsusega (näiteks RLS-i 31.10.2026):
  - RT avaldatud redaktsioonides: `riigi_teataja_gap` ja `riigi_teataja_overlap`;
  - korpuses indekseeritud kehtivusega: `corpus_gap` ja `corpus_overlap`. Aegunud lõppkuupäev tuleb siin nähtavale kattuvusena.
- **Kehtetuks tunnistamine.** RT avaldab siis viimase „redaktsiooni“, millel pole teksti: `<sisu/>` on tühi, märge on „Kehtetu“ ja viide näitab kehtetuks tunnistanud akti.
  - Grupp lõpeb sellele eelneval päeval.
  - Kui kehtetuks tunnistanud akt on korpuses, tuleb aruandesse märkus (`replaced_in_corpus`).
  - Kui seda akti korpuses pole, vajab asi ülevaatust (`group_repealed`).
- **Grupp, mis lõpeb järglaseta** 400 päeva jooksul või viimase 180 päeva jooksul, vajab ülevaatust (`group_ends`).
  - Kontroll näitab ka sama väljaandja sotsiaalvaldkonna akte, mis algavad 3 päeva enne kuni 10 päeva pärast grupi lõppu (`replacement_candidate`, lõigete arvuga).
  - Need on ainult kandidaadid. Nende hulgas võib olla ka tühi kehtetuks tunnistamise märge. Korpusesse lisab need inimene.

### Riigi Teataja otsingu eripärad

- **Lehed ei ole stabiilsed.** Sama päring annab igal korral uue järjekorra. 27.09 kordas 521 tulemuse teine leht 20 akti esimeselt lehelt ja jättis 20 akti välja.
  - Kontroll küsib lehti uuesti (kuni 8 korda), kuni erinevate aktide arv jõuab API teatatud koguarvuni (`kokku`).
  - Kui see arv kätte ei tule, märgitakse tõrge `incomplete_results`.
- **Täispealkirjaga otsing ei leia kõiki omavalitsuste akte**, näiteks Tallinna „Sotsiaalteenuste osutamise tingimused ja kord“. Seepärast otsitakse gruppi selles järjekorras:
  1. väljaandja ja pealkirja esimese sõnaga;
  2. väljaandja ja täispealkirjaga;
  3. ainult täispealkirjaga.

### Aruanne

- Kontroll kirjutab failid `law-validity-<päev>.json` ja `law-validity-<päev>.md`.
- Grupi olek on üks neist:
  - `unchanged`: muutust ei ole;
  - `changed`: on leide;
  - `review`: vajab ülevaatust;
  - `fetch_failed`: päringu tõrge. Selleks loetakse päringut, mis ei õnnestunud kolme katsega, puuduvat akti XML-i (404) ja mittetäielikku otsingut.
- Tõrkega grupp ei saa kunagi olekut `unchanged`.
- Väljumiskood on 0, kui muutusi pole, 10, kui on leide või ülevaatust, ja 20, kui mõni päring ebaõnnestus.

### Ajastus ja teavitus

- `.github/workflows/rag-v2-law-validity.yml` jookseb iga kuu 25. kuupäeval kell 04:15 UTC. Omanik otsustas: kord kuus. 25. kuupäevast jääb enne kuuvahetuse jõustumisi aega.
- Kontrolli saab käivitada ka käsitsi (`workflow_dispatch`).
- Kui on leide, ülevaatust või tõrge, avatakse issue „RAG v2: õigusaktide kehtivus Riigi Teatajas“. Kui see on juba avatud, lisatakse sellele kommentaar. Mõlemal juhul mainitakse omanikku ja lisatakse Markdown-aruanne.
- Puhas kontroll sulgeb issue.
- Päringu tõrge (exit 20) või käivitusviga teeb töö punaseks.
- Aruanne on töö artefakt ja säilib 90 päeva.

### Avaldamine jääb samaks

- Kontroll ei lae ega indekseeri midagi ise.
- Valikuga `--download DIR` laaditakse puuduvate redaktsioonide XML-id kausta DIR. Edasi lähevad need tavalist rada pidi: register, sisestus, ost ja indeks ([runbook](runbook-corpus-increment.md), sammud 1–9).
- Ostu kinnitab endiselt inimene.

## Esimene jooks (27.09.2026, korpus v32)

- Kontrollis 64 gruppi 1 min 29 s jooksul. Tulemus: 62 muutumata, 2 muutunud, 0 päringutõrget.
- **RLS:** `riigi_teataja_gap` ja `corpus_gap` 31.10.2026. RT pole selle päeva teksti avaldanud. Järgmine kontroll on 25.10.
- **SHS:** korpusest puuduvad `111072026122` (01.02–31.03.2027) ja `111072026123` (01.04–31.12.2027). Veebruari tekst tuleb lisada enne 31.01.2027.
- **Põlva, Kehtna ja Kohila** vanad korrad on kehtetuks tunnistatud. Kehtetuks tunnistanud aktid on korpuses (`426052026009`, `403072026003`, `429082026027`), nii et aruandes on nende kohta märkused.
- Tööriista esimene versioon ei küsinud lehti uuesti ega tundnud kehtetuks tunnistamise märget ära. See andis 14 otsingumööda, 3 näilist kattuvust ja 3 näilist puuduvat redaktsiooni. Need olid tööriista vead, mitte korpuse omad. Parandatud versioon annab ülaltoodud tulemuse.

## Kontroll

`tests/rag-v2-law-validity.test.mjs` on osa `npm test`-ist ega kasuta võrku. See kontrollib:

- **katvust:** RLS-i üks katmata päev, enne tänast alanud lünk, aegunud lõppkuupäev kattuvusena ning lõpp horisondi sees ja selle taga;
- **grupi analüüsi:** muutunud kehtivus, puuduvad redaktsioonid, lõppev grupp koos kandidaatidega, korpuses olev asendaja (märkus, mitte ülevaatus), kehtetuks tunnistamise märge ning otsingu kaks korda antud sama akt;
- **käsurida kohaliku RT asendaja vastu,** mis annab otsingu tulemused igal päringul uues järjekorras:
  - muutumata allikas annab exit 0;
  - RLS-i 31.10 lünk annab exit 10 ja kirjutab aruanded;
  - 520 tulemust kahel lehel leitakse kõik;
  - korpuses oleva aktiga kehtetuks tunnistatud grupp on märkus;
  - 503 ja lehed, mis kunagi kokku ei tule, annavad `fetch_failed` ja exit 20.

## Piirid

- Manifest on gitis. Kui korpus avaldatakse ilma manifesti uuendamata, kontrollib töö eelmist seisu.
- Kontrollitakse ainult Riigi Teataja XML-e. Juhendeid, KOV-i kirjeid ja teisi allikaid see ei hõlma.
- Täiesti uusi akte, mis ei jätka ühtki indekseeritud gruppi, leiab kontroll ainult lõppeva grupi asendajate kaudu. Uusi teemasid see ei otsi.
- Muutmisakti ilma grupita (Haljala `423012026003`) kontrollitakse ainult akti enda kehtivuse järgi.
- Vaadatakse 400 päeva ette. SHS-i 2028. ja 2029. aasta redaktsioonid jäävad sellest välja.
- RT otsingu-API käitumine võib muutuda. Mittetäielik tulemus annab siis tõrke, mitte vaikse möödalaskmise.
