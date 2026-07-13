# Opus 4.8 tööplaan ja progress

Uuendatud: 13.07.2026  
Staatus: **HEAKS KIIDETUD — A1 SOLI JÄRELKONTROLL LÄBITUD**  
Teostaja: **Claude Opus 4.8 / Claude Code**  
Nõutud effort: **EXTRA (`xhigh`)**  
Järelkontroll: **Sol**  
Tooteotsused: **kasutaja**

## 1. Selle faili kasutamise reegel

See fail on korraga:

1. Opuse aktiivne lähteülesanne;
2. töö käigus täidetav kontrollnimekiri;
3. append-only progressipäevik;
4. Solile antav üleandmis- ja järelkontrolli alus.

Opus peab faili lugema enne koodi muutmist ning lisama progressipäevikusse sissekande:

- töö alustamisel;
- iga etapi lõpetamisel;
- takistuse või ulatuse muutumise vajaduse tekkimisel;
- enne Solile üleandmist.

Varasemaid progressikirjeid ei kustutata ega kirjutata ümber. Vale või aegunud kirje järel lisatakse uus parandav kirje.

### 1.1. Effort-värav enne töö alustamist

See A1 töö tuleb teha mudeliga **Claude Opus 4.8** ja effort-tasemel **Extra** (`xhigh` Claude Code'is).

Opuse esimene tegevus pärast faili lugemist on effort-taseme kontroll või meeldetuletus:

1. kui Opus näeb, et aktiivne sessioon kasutab `Extra`/`xhigh` taset, märgib ta selle esimesse progressikirjesse;
2. kui aktiivne tase on `High`, `Max`, `Ultra` või ei ole Opusele nähtav, ütleb Opus kasutajale enne koodi muutmist: **„Selle tööplaani nõutud effort on Extra (`xhigh`). Palun muuda effort Extra tasemele ja kinnita, et võin jätkata.”**;
3. enne kasutaja kinnitust võib Opus lugeda plaani ja teha read-only baaskontrolli, kuid ei muuda koodi, skeemi, migratsioone ega teste;
4. pärast kinnitust lisab Opus progressipäevikusse kasutatud mudeli, effort-taseme ja kinnituse ning alustab etappi 0.

`Max` ei ole selle töö jaoks nõutud, sest A1 on piiritletud vertikaalne lõik ja Sol teeb pärast sõltumatu järelkontrolli. Effort-taset ei muudeta töö käigus ilma progressikirje ja põhjenduseta.

## 2. Tõeallikate järjekord

Kui allikad lahknevad, kehtib järgmine järjekord:

1. aktiivne kood, andmeskeem, migratsioonid ja käivitatud testid;
2. käesolev kinnitatud tööplaan;
3. `fable-5-platvormiloogika-max-taiendus.md`;
4. `fable-5-platvormiloogika-ulevaade.md`;
5. ülejäänud kausta kontseptsiooni- ja ideedokumendid.

Dokumentides olevad tehnilised väited on 11.–12.07.2026 hetkeseisud ja võivad aktiivsest koodist maha jääda. Opus ei tohi väidet rakendada enne selle kontrollimist.

### 2.1. Kohustuslik lugemine enne `ALUSTATUD` kirjet

Opus ei pea lugema kogu `docs/platvormi arendus` kausta järjest. Enne töö alustamist loeb ta täielikult käesoleva faili ning seejärel ainult järgmised A1-ga seotud osad:

1. [`fable-5-platvormiloogika-max-taiendus.md`](./fable-5-platvormiloogika-max-taiendus.md)
   - 5.2 — `PreInquiry.sourceJourneyId`;
   - 7.1 — A1 tööpakett;
   - 7.3 — esimese vertikaalse lõigu soovituse seis;
   - 10.2 ja 10.4 — täpsustused ning prioriteedid.
2. [`fable-5-platvormiloogika-ulevaade.md`](./fable-5-platvormiloogika-ulevaade.md)
   - 7.1 — tööobjektide ja üleandmiste ühine muster;
   - 9. peatüki P0.2 — Teekond ↔ eelpöördumine seosekirje;
   - 10. peatükk — soovitatud esimene vertikaalne lõik.
3. [`fable-5-platvormi-loogika-brief.md`](./fable-5-platvormi-loogika-brief.md)
   - 7. peatükk — iga seose tehniline kontroll;
   - 8. peatükk — andme- ja privaatsuspiirid.
4. [`ideed.md`](./ideed.md)
   - 13. peatükk — läbivad privaatsus- ja tooteprintsiibid;
   - 29. peatükk — funktsioonide ühendamise otsustusreegel.
5. [`funktsioonide-ja-ux-kaardistus.md`](./funktsioonide-ja-ux-kaardistus.md)
   - Teekonna osa;
   - eelpöördumise pöörduja ja vastuvõtja osad;
   - „Praegu nähtavad funktsioonidevahelised seosed”;
   - „Järgmine kontrolliring” punktid 1–3.

Pärast lugemist lisab Opus progressipäeviku esimesse kirjesse:

- millised jaotised ta läbi töötas;
- millised väited kontrollis aktiivsest koodist üle;
- millised dokumendiväited olid aegunud, ebatäpsed või juba rakendatud;
- kas mõni vastuolu mõjutab A1 ulatust.

### 2.2. Materjal, mida A1 jaoks ei ole vaja lugeda

Järgmised failid ei kuulu A1 kohustuslikku konteksti ning neid ei kasutata töö ulatuse laiendamiseks:

- `SotsiaalAI_Sol_5_6_arendusplaan_admin_analuutika_kasutajad.docx`;
- `SotsiaalAI_Sol_5_6_P0_P1_kaardistus_ja_migratsiooniplaan.md`;
- `lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md`;
- `ruumilise-kogemuse-lahtekoht.md`;
- `fable-5-lisavastused-organisatsioon-ja-piloot.md`;
- `sotsiaalai-sonum-slogan-ja-tulevikuvisioon.md`.

Kui aktiivne kood tekitab küsimuse, mille vastus võib olla mõnes muus dokumendis, võib Opus teha sealt sihitud otsingu. Ta peab progressipäevikus nimetama faili, loetud jaotise ja põhjuse. Muu dokumendi lugemine ei anna luba uut funktsiooni rakendada.

## 3. Agentide tööjaotus

### Opus

- kaardistab enne muutmist mõjutatud aktiivse koodi;
- rakendab ainult allpool kirjeldatud ülesande;
- lisab või parandab testid;
- käivitab nõutud kontrollid;
- jäädvustab progressi ja annab töö Solile üle.

### Sol

- ei korda Opuse tööd nullist;
- loeb algset ülesannet ja kontrollib diffi baasseisu vastu;
- kontrollib migratsiooni, õigusi, privaatsust, servajuhtumeid ja testide sisukust;
- parandab ainult selged tehnilised vead ning puuduva regressioonikaitse;
- ei tee tooteotsuseid ega laienda ulatust.

### Kasutaja

- otsustab kõik küsimused, mis muudavad andmete tähendust, õigusi, jagamise loogikat või töö ulatust;
- kinnitab järgmise töö alles pärast Soli järelkontrolli.

## 4. Praegune kontrollitud baas

- Soli usage/admini P0–P6 töö on juba repos olemas ja seda ei rakendata uuesti.
- 13.07.2026 läbisid `tests/usage/*.test.js` sihttestid: **42/42**.
- `buildPreInquiryPrefillFromJourney()` annab juba välja `sourceJourneyId` väärtuse.
- `PreInquiry` andmemudelis `sourceJourneyId` praegu puudub.
- `createPreInquiry()` ei salvesta Teekonna viidet.
- Teekonna „Seotud asjad” vaade loeb praegu `Journey.context.linkedPreInquiryIds` väärtusi ega kasuta püsivat relatsiooni.
- Repos võib olla ülesandega mitteseotud pooleliolevaid muudatusi. Neid ei muudeta, ei vormindata, ei stage'ita ega kustutata.

## 5. Aktiivne töö A1

### Nimi

**Teekond → eelpöördumine: püsiv seos, tagasilink ja staatusetagasiside**

### Eesmärk

Kui kasutaja alustab eelpöördumist konkreetsest Teekonnast, säilib seos andmebaasis. Teekonna omanik näeb Teekonna detailvaates seotud eelpöördumise teemat ja staatust ning saab selle avada. Eelpöördumise adressaat ei saa seose kaudu ligipääsu privaatsele Teekonnale ega selle metaandmetele.

### Miks see töö on esimene

- aktiivne kasutajavoog ja eeltäide on juba olemas;
- praegu kaob seos pärast eelpöördumise salvestamist;
- töö lõpetab ühe väikese, kõrge väärtusega vertikaalse lõigu;
- see ei sõltu Kovisiooni, STAR2, organisatsioonikihi ega ESTA tooteotsustest.

## 6. Ulatus

### 6.1. Andmemudel ja migratsioon

- Lisa `PreInquiry` mudelile nullable Teekonna viide.
- Seo viide `Journey` mudeliga nii, et Teekonna kustutamine ei kustuta eelpöördumist; eeldatav käitumine on viite muutumine `null`-iks.
- Lisa päringut toetav indeks.
- Loo uus edasiühilduv Prisma migratsioon. Olemasolevad eelpöördumised jäävad kehtima nullable viitega.
- Ära muuda ega kirjuta ümber varasemaid migratsioone.

### 6.2. Serveripoolne kirjutamine ja õigused

- Salvesta `sourceJourneyId`, kui eelpöördumine luuakse Teekonna eeltäite põhjal.
- Ära usalda kliendi saadetud ID-d: server peab kinnitama, et Teekond kuulub eelpöördumise autorile.
- Puuduv, kustutatud või teisele kasutajale kuuluv Teekond ei tohi tekitada võõra objekti seost.
- Otsusta aktiivse koodi mustrite põhjal, kas vigane viide tagastab `400`, `403` või `404`, ning kata valik testiga. Ära lekita võõra Teekonna olemasolu.
- Eelpöördumise adressaat võib näha talle saadetud eelpöördumist, kuid ei tohi saada Teekonna sisu, pealkirja, kokkuvõtet ega avatavat Teekonna viidet.

### 6.3. Lugemine ja kasutajaliides

- Teekonna detailpäring tagastab ainult omanikule selle Teekonnaga seotud eelpöördumiste minimaalse info: vähemalt `id`, `topic`, `status`, `createdAt` ja `updatedAt`.
- Teekonna „Seotud eelpöördumised” ala kuvab loetava teema, staatuse ja avamistegevuse, mitte ainult toor-ID-d.
- Tühi olek jääb arusaadavaks.
- Kasutajatekstid peavad olema ET/EN/RU sõnumifailides; uut hard-coded kasutajateksti ei lisata.
- Privaatset Teekonda ei märgita jagatuks üksnes sellepärast, et sellest koostati eelpöördumine.

### 6.4. Testid

Lisa vähemalt järgmised regressioonijuhtumid:

1. omanik loob oma Teekonnast seotud eelpöördumise ja seos salvestub;
2. olemasolev Teekonnata eelpöördumine töötab edasi;
3. teise kasutaja Teekonna ID-ga ei saa seost luua ega Teekonna olemasolu tuvastada;
4. adressaat näeb eelpöördumist, kuid ei saa selle kaudu privaatset Teekonda avada ega Teekonna sisu;
5. Teekonna omanik näeb detailvaates ainult selle Teekonna seotud eelpöördumisi;
6. Teekonna kustutamisel jääb eelpöördumine alles ja viide muutub `null`-iks;
7. staatusetagasiside kuvab vähemalt `DRAFT`, `SENT`, `READY` ja `CLOSED` olekud aktiivse enum'i järgi korrektselt;
8. retry või sama vormi korduv esitamine ei tohi vaikimisi luua varjatud topeltseost; olemasolev loomiskäitumine dokumenteeritakse testis või üleandmisriskina.

Kui olemasolev testitaristu ei võimalda mõnda punkti päris andmebaasiga kontrollida, peab Opus selle progressipäevikus ausalt märkima ja lisama tugevaima võimaliku madalama taseme testi. Pelgalt lähtekoodi regulaaravaldisega kontroll ei asenda andme- ja õiguskäitumise testi.

## 7. Vastuvõtukriteeriumid

Töö on Opuse poolt üleandmiseks valmis ainult siis, kui:

- [x] Opus 4.8 `Extra`/`xhigh` effort on enne muutmist kinnitatud ja progressipäevikusse märgitud;
- [x] aktiivne kood ja olemasolevad pooleliolevad muudatused on enne tööd kaardistatud;
- [x] skeem ja uus migratsioon on lisatud;
- [x] Teekonna omandi kontroll toimub serveris;
- [x] seos salvestub eelpöördumise loomisel;
- [x] Teekonna detailvaade näitab seotud eelpöördumiste teemat ja staatust;
- [x] adressaat ei saa ligipääsu privaatsele Teekonnale;
- [x] olemasolevad `sourceJourneyId = null` kirjed töötavad;
- [x] ET/EN/RU sõnumipariteet läbib kontrolli;
- [x] sihttestid läbivad (16/16);
- [x] kogu testikomplekt läbib (`npm test` 741/741);
- [x] lint läbib (0 viga; 384 varasemat hoiatust eristatud, minu failides 0 uut);
- [x] build läbib;
- [x] `git diff --check` läbib;
- [x] progressipäevik ja Soli üleandmine on täidetud;
- [x] deploy'd ei ole tehtud.

## 8. Mitte-eesmärgid

Selle töö käigus ei tehta:

- usage/admini P0–P6 ümberkirjutust;
- ruumide deduplikatsiooni A2;
- Kovisiooni anonüümsusparandust A4;
- teavituskihti või e-kirju A5/U1;
- Kovisiooni andmekihi ja lõuendi sidumist O1/O2;
- organisatsiooni- või meeskonnakihti;
- STAR2 elutsüklit või automaatset liidestust;
- ESTA funktsionaalsust;
- uut kujunduskontseptsiooni ega laia CSS-refaktorit;
- deploy'd, force-push'i ega kõrvaliste failide korrastamist.

Kui töö nõuab mõnda neist, märgi staatus **BLOKEERITUD**, lisa progressikirje ja küsi kasutajalt otsus.

## 9. Eeldatavad mõjutatud kohad

Loend on orientiir, mitte luba kõiki faile muuta:

- `prisma/schema.prisma`;
- uus fail `prisma/migrations/<timestamp>_pre_inquiry_source_journey/migration.sql`;
- `lib/preInquiries.js`;
- Teekonna serveriteenus või `app/api/journeys/[id]/route.js`;
- `components/journey/JourneyDetail.jsx`;
- ET/EN/RU sõnumifailid;
- `tests/journey/` ja `tests/preInquiries/`.

Opus peab enne muutmist leidma aktiivsed tegelikud lugemis- ja kirjutamiskohad. Kui parem lahendus puudutab teisi faile, põhjenda seda progressipäevikus.

## 10. Tööetapid

### Etapp 0 — baas ja disain

- [x] Salvesta `git status --short` ja ülesandega seotud baasdifi ülevaade.
- [x] Kontrolli aktiivset skeemi, loomisteed, Teekonna detail-API-t ja olemasolevaid teste.
- [x] Märgi, kas mõnes mõjutatud failis on enne tööd kasutaja muudatusi. (A1-failides ei ole; pre-existing muudatused on ruumi/docs/asset-failides.)
- [x] Lisa progressikirje valitud relatsiooni-, kustutus- ja autoriseerimiskäitumisega.

### Etapp 1 — andmemudel ja server

- [x] Lisa skeem ja migratsioon.
- [x] Lisa omanikukontrolliga kirjutamine.
- [x] Lisa omaniku skoopi järgiv seotud eelpöördumiste lugemine.
- [x] Lisa serveri- ja andmekihi testid.
- [x] Käivita esimene sihttestide ring ja lisa progressikirje.

### Etapp 2 — kasutajaliides ja tõlked

- [x] Uuenda Teekonna seotud objektide vaadet.
- [x] Lisa ET/EN/RU sõnumid.
- [x] Kontrolli tühi-, laadimis-, vea- ja olemasolevate kirjete olekut.
- [x] Lisa UI/regressioonitestid ning progressikirje.

### Etapp 3 — täielik kontroll

- [x] Käivita sihttestid.
- [x] Käivita `npm test`.
- [x] Käivita `npm run i18n:check`.
- [x] Käivita `npm run lint`.
- [x] Käivita `npm run build`.
- [x] Käivita `git diff --check`.
- [x] Vaata diff käsitsi üle ja eemalda ainult enda tekitatud müra.

### Etapp 4 — üleandmine Solile

- [x] Täida Opuse üleandmisplokk.
- [x] Lisa lõplik progressikirje.
- [x] Ära stage'i ega commit'i kasutaja kõrvalisi muudatusi.
- [x] Anna Solile baasseisu viide ja täpne Opuse muudatuste diff.

## 11. Progressipäevik

Kasutatav vorm:

```text
### YYYY-MM-DD HH:mm Europe/Tallinn — AGENT — STAATUS

- Etapp:
- Mudel ja effort:
- Tehtud:
- Muudetud failid:
- Käivitatud kontrollid ja tulemused:
- Otsused ja põhjendus:
- Risk või takistus:
- Järgmine samm:
```

Lubatud staatused: `ALUSTATUD`, `TÖÖS`, `BLOKEERITUD`, `ETAPP VALMIS`, `OPUS VALMIS`, `SOL KONTROLLIS`, `PARANDUSED VAJALIKUD`, `HEAKS KIIDETUD`.

### 2026-07-13 — CODEX — ETAPP VALMIS

- Etapp: tööplaani loomine.
- Tehtud: aktiivseks esimeseks tööks valiti A1; määrati ulatus, õiguste piirid, testid, vastuvõtukriteeriumid ja Opus → Sol üleandmine.
- Muudetud failid: ainult käesolev tööplaan.
- Käivitatud kontrollid ja tulemused: enne plaani loomist kontrolliti aktiivset Prisma skeemi, eelpöördumise loomisteed, Teekonna eeltäidet, seotud objektide vaadet ja usage-testide baasi.
- Otsused ja põhjendus: töö jääb ühe vertikaalse lõigu piiresse; teisi järjekorra ülesandeid automaatselt ei alustata.
- Risk või takistus: repos on ülesandega mitteseotud pooleliolevaid muudatusi; Opus peab need säilitama ja kattuvuse korral peatuma.
- Järgmine samm: Opus loeb faili, lisab `ALUSTATUD` kirje ja täidab etapi 0.

### 2026-07-13 — CODEX — ETAPP VALMIS

- Etapp: Opuse lugemisraja täpsustamine.
- Tehtud: lisatud kohustuslik A1 lugemisnimekiri konkreetsete dokumentide ja peatükkidega, mittevajaliku materjali loend ning nõue võrrelda loetut aktiivse koodiga.
- Muudetud failid: ainult käesolev tööplaan.
- Käivitatud kontrollid ja tulemused: kontrolliti, et viidatud failid on samas kaustas olemas ja jaotiste nimetused vastavad dokumentidele.
- Otsused ja põhjendus: Opus loeb ainult A1 jaoks vajaliku konteksti; kogu kausta järjest lugemine ei ole nõutud, sest see suurendaks ulatuse hajumise riski.
- Risk või takistus: dokumentide tehnilised väited võivad olla aktiivsest koodist maas; kood jääb tõeallikaks.
- Järgmine samm: Opus loeb kohustuslikud jaotised, dokumenteerib kontrolli `ALUSTATUD` kirjes ja täidab etapi 0.

### 2026-07-13 — CODEX — ETAPP VALMIS

- Etapp: effort-värava lisamine.
- Mudel ja effort: A1 jaoks nõutud Claude Opus 4.8 `Extra`/`xhigh`.
- Tehtud: lisatud kohustus kontrollida või kasutajale meenutada effort-taset enne koodi muutmist; lisatud nõue jäädvustada mudel ja effort progressipäevikus.
- Muudetud failid: ainult käesolev tööplaan.
- Käivitatud kontrollid ja tulemused: kontrolliti, et effort-nõue on nähtav faili päises, alustamisväravas, vastuvõtukriteeriumides ja progressivormis.
- Otsused ja põhjendus: `Extra` on selle piiritletud, kuid migratsiooni ja õigusi puudutava töö sobiv tase; `Max` ei ole Soli sõltumatu järelkontrolli tõttu vajalik.
- Risk või takistus: Opus ei pruugi aktiivset effort-taset tehniliselt näha; sel juhul peab ta enne muudatusi kasutajalt kinnitust küsima.
- Järgmine samm: Opus tuletab vajadusel effort-muudatuse meelde, ootab kinnitust ja lisab seejärel `ALUSTATUD` kirje.

### 2026-07-13 15:30 Europe/Tallinn — OPUS — ALUSTATUD

- Etapp: 0 (baas ja disain) läbitud read-only; algab etapp 1.
- Mudel ja effort: Claude Opus 4.8 (`claude-opus-4-8`), effort **Extra (`xhigh`)** — kasutaja kinnitas 2026-07-13. Effort ei olnud sessioonis tehniliselt nähtav, seega rakendus §1.1.2 värav ja Opus küsis enne muutmist kinnitust.
- Tehtud (read-only kaardistus):
  - Loetud jaotised: kogu käesolev tööplaan; `fable-5-platvormiloogika-max-taiendus.md` (5.2, 7.1, 7.3, 10.2, 10.4 kontekst); `fable-5-platvormiloogika-ulevaade.md` (9. P0.2, 10.); `fable-5-platvormi-loogika-brief.md` (7., 8.); täiendavalt aktiivne kood, mis on A1 tõeallikas.
  - Kaardistatud aktiivne kood: `prisma/schema.prisma` (`PreInquiry` r1706, `Journey` r1096, `PreInquiryStatus` r329, muster `CovisionCase.sourcePreInquiryId` r1754 `onDelete: SetNull`); `lib/preInquiries.js` (`createPreInquiry`, `serializePreInquiry`, `getVisiblePreInquiry`); `lib/journey/preInquiryHandoff.js` (`buildPreInquiryPrefillFromJourney`); `lib/journey/service.js` (`getJourneyForUser` 404-muster); `app/api/journeys/[id]/route.js`, `app/api/journeys/[id]/pre-inquiry-draft/route.js`, `app/api/pre-inquiries/route.js`; `components/journey/JourneyDetail.jsx` (`RelatedObjectsPanel`, fetch GET); `components/workspace/WorkspaceFeaturePage.jsx` (journey-prefill + `handleSave`); `messages/{et,en,ru}.json`; `scripts/check-messages.mjs`; testitaristu (`package.json` `test`, `scripts/register-node-test-loader.mjs`, `tests/usage/service.test.js` fake-Prisma DI-muster).
- Aktiivsest koodist kontrollitud väited:
  - KINNITATUD: `buildPreInquiryPrefillFromJourney()` tagastab juba `sourceJourneyId` (r153).
  - KINNITATUD: `PreInquiry` mudelis `sourceJourneyId` puudub; `createPreInquiry()` ei salvesta Teekonna viidet.
  - KINNITATUD: Journey „Seotud asjad" (`RelatedObjectsPanel`) loeb `context.linkedPreInquiryIds` toor-ID-sid, ei kasuta püsivat relatsiooni.
  - KINNITATUD: `getJourneyForUser` tagastab nii puuduva kui võõra Teekonna korral sama üldise 404 (`journeys.errors.not_found`) — see on „ära lekita olemasolu" muster, mida A1 kirjutuskontroll järgib.
  - KINNITATUD baas: usage/admin P0–P6 juba repos; ei rakendata uuesti.
- Lisaleid (kliendi POST-keha): `components/workspace/WorkspaceFeaturePage.jsx` `handleSave` POST `/api/pre-inquiries` **ei saada** `sourceJourneyId`-d. Seos katkeb juba kliendil, mitte üksnes serveris. A1 vajab seega ka väikest kliendimuudatust: `fromJourney`/prefill'i `sourceJourneyId` edastamine loomisel (ainult POST, mitte PATCH).
- Enum'i lahknevus (dok vs kood): plaani test #7 nimetab `CLOSED`, kuid aktiivne `PreInquiryStatus` = `DRAFT, READY, SENT, DOWNLOADED, ARCHIVED`. `CLOSED` ei kuulu töösse; testid kasutavad aktiivset enum'i (kasutaja kinnitas).
- Muudetud failid: ainult käesolev progressipäevik (kirje lisamine). Koodi, skeemi, migratsioone ega teste veel ei muudetud.
- Käivitatud kontrollid ja tulemused: read-only (`git status`, `git rev-parse`); koodilugemine. Baas: `main` @ `e5fa1c59`. Repos on A1-väliseid commitimata muudatusi (ruumipildid, `app/page.js`, `room.css`, `RoomStage.jsx`, `lib/room-frames.js` jm) — säilitatakse puutumata, ei stage'ita.
- Otsused ja põhjendus:
  1. Relatsioon `PreInquiry.sourceJourneyId → Journey`, `onDelete: SetNull`, nullable + indeks (peegeldab `CovisionCase.sourcePreInquiryId` mustrit). Teekonna kustutamine → viide null-iks, eelpöördumine jääb alles.
  2. Kirjutamine (kasutaja täpsustus): puuduv/tühi ID → tavaline seoseta eelpöördumine; autorile kuuluv Teekond → püsiv seos; puuduv/kustutatud/võõras ID → **üldine 404, eelpöördumist ei looda** (ei vaikset null-i). Ei lekita võõra Teekonna olemasolu.
  3. `serializePreInquiry` EI väljasta `sourceJourneyId`-d → adressaat ega autor ei saa ühisvastuses Teekonna viidet (§6.2). Seotud eelpöördumiste minimaalne info tuleb ainult omaniku-skoobis Journey detailpäringust (§6.3).
  4. Testid: fake-Prisma DI serveriloogika jaoks (ownership → seos/404, seoseta rada, omaniku-skoobis lugemine). onDelete SET NULL kontrollitakse skeemist + migratsiooni SQL-ist eraldi; reaalse DB referentsiaalkäitumise testi see EI asenda (märgitud üleandmisse).
- Risk või takistus: testikeskkonnas puudub reaalne andmebaas → test #6 (kustutuse cascade) kontrollitakse skeemi/SQL-kontraktina, mitte elava DB-ga; puhta DB migratsioonikontroll (`db:migrate:check`) käivitatakse võimalusel, muidu piirang dokumenteeritakse.
- Järgmine samm: etapp 1 — skeem + migratsioon, omanikukontrolliga kirjutamine, omaniku-skoobis lugemine, server-/andmekihi testid, esimene sihttestide ring.

### 2026-07-13 16:10 Europe/Tallinn — OPUS — ETAPP VALMIS

- Etapp: 1 (andmemudel ja server).
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - Skeem: `PreInquiry.sourceJourneyId String?` + `sourceJourney Journey? @relation(... onDelete: SetNull)` + `@@index([sourceJourneyId])`; `Journey.preInquiries PreInquiry[]` tagasi-relatsioon. Ainult 4 sisulist rida (kontrollitud `git diff -w`); `prisma format`-i müra ei jäetud sisse.
  - Migratsioon: `prisma/migrations/20260713153000_pre_inquiry_source_journey/migration.sql` (ADD COLUMN nullable + index + FK `ON DELETE SET NULL ON UPDATE CASCADE`, `CovisionCase_sourcePreInquiryId_fkey` analoog).
  - Server (kirjutamine): `lib/preInquiries.js` — uus eksporditav `resolveSourceJourneyId(userId, id, {db})` (omanikukontroll: puudub→null, oma→id, võõras/puuduv/kustunud→üldine 404); `createPreInquiry` võtab süstitava `{db}`, resolvib seose ja salvestab `sourceJourneyId`. `resolveRecipient` sai süstitava `{db}` (mitte-murdev vaikeväärtus). `serializePreInquiry` EI väljasta `sourceJourneyId`-d → privaatsuspiir.
  - Server (lugemine): `lib/journey/service.js` — `listLinkedPreInquiriesForJourney` (omaniku-skoop `sourceJourneyId`+`authorId`, minimaalne `id/topic/status/createdAt/updatedAt`, ISO ajatemplid) ja `getJourneyDetailForUser` (journey + `linkedPreInquiries`); `getJourneyForUser` sai süstitava `{db}`. GET `app/api/journeys/[id]/route.js` kasutab nüüd `getJourneyDetailForUser`.
- Muudetud failid: `prisma/schema.prisma`, `prisma/migrations/20260713153000_pre_inquiry_source_journey/migration.sql` (uus), `lib/preInquiries.js`, `lib/journey/service.js`, `app/api/journeys/[id]/route.js`, `tests/preInquiries/sourceJourneyLink.test.js` (uus), `tests/journey/linkedPreInquiries.test.js` (uus).
- Käivitatud kontrollid ja tulemused:
  - `npx prisma validate` → valid; `npx prisma generate` → klient genereeritud (7.8.0).
  - `npm run db:migrate:check` → **OK**: kogu 77-migratsiooni ahel rakendus ajutisele localhost-Postgresile, `migrate status` = „schema is up to date" (drift puudub). See on reaalse DB kontroll, et migratsioon vastab skeemile ja FK SET NULL luuakse.
  - Uued sihttestid (`sourceJourneyLink.test.js` + `linkedPreInquiries.test.js`): **16/16 pass**.
- Otsused ja põhjendus: vt ALUSTATUD kirje otsused 1–4; kasutaja täpsustus rakendatud (vigane/võõras ID → üldine 404, mitte vaikne null). Testid = süstitud fake-Prisma serveriloogika + skeemi/SQL-kontraktid; **fake-Prisma EI ole reaalse DB referentsiaalkäitumise test** — cascade (test #6) tugineb `db:migrate:check` reaalsele ahelale + skeemi/SQL-väidetele.
- Risk või takistus: `npm test` ei ühendu DB-ga, seega elavat DELETE→SET NULL käitumist ei jooksutata testikomplektis; kaetud migratsioonikontrolliga (käivitatud, läbis). Test #8: kordusesitus loob eraldi eelpöördumised (olemasolev käitumine, idempotentsuse võtit pole) — dokumenteeritud testis ja siin üleandmisriskina.
- Järgmine samm: etapp 2 — kliendi POST-keha (`sourceJourneyId` saatmine loomisel), Journey detail „Seotud eelpöördumised" UI (teema+staatus+avamine), ET/EN/RU sõnumid.

### 2026-07-13 15:50 Europe/Tallinn — OPUS — ETAPP VALMIS

- Etapp: 2 (kasutajaliides ja tõlked).
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - Klient (loomistee): `components/workspace/WorkspaceFeaturePage.jsx` — uus `journeySourceId` state; seatakse journey-prefill efektis (`prefill.sourceJourneyId || fromJourney`); saadetakse POST-kehas ainult loomisel (`!activeInquiryId && journeySourceId`), PATCH-il mitte; puhastatakse olemasoleva pöördumise avamisel ja pärast õnnestunud loomist. Uus deep-link efekt: `?openInquiry=<id>` avab loenditest õige autoreeritud pöördumise (lint-puhas ref-muster, sõltuvus ainult `inquiries`).
  - Journey detail UI: `components/journey/JourneyDetail.jsx` — „Seotud eelpöördumised" ala loeb nüüd serveripoolset `journey.linkedPreInquiries` (mitte `context.linkedPreInquiryIds` toor-ID-d): kuvab teema, staatuse-sildi ja „Ava" lingi; arusaadav tühi olek. Teised „Seotud asjad" grupid jäid muutmata.
  - Tõlked: `messages/{et,en,ru}.json` — `journey.related`: `open`, `pre_inquiries_empty`, `pre_inquiry_untitled`, `pre_inquiry_status.{DRAFT,READY,SENT,DOWNLOADED,ARCHIVED}` (aktiivne enum). Uut hard-coded kasutajateksti ei lisatud (kõik `t(...)` kaudu).
- Muudetud failid: `components/workspace/WorkspaceFeaturePage.jsx`, `components/journey/JourneyDetail.jsx`, `messages/et.json`, `messages/en.json`, `messages/ru.json`.
- Käivitatud kontrollid ja tulemused: `npm run i18n:check` → en OK, ru OK, „All locales match et"; `npx eslint` muudetud failidele → 0 viga.
- Otsused ja põhjendus: privaatne Teekonda ei märgita jagatuks — link kuvatakse ainult Teekonna omaniku detailvaates, adressaadile mitte (§6.3). „Ava" viib `/eelpoordumised?openInquiry=<id>` → täidab §5 „saab selle avada". Vana `linkedPreInquiryIds` context-grupp eemaldati kuvalt (asendatud püsiva relatsiooniga); kontrollitud, et sellel pole kirjutajaid ega teste.
- Risk või takistus: puudub. `RelatedObjectsPanel` teised grupid (dokumendid, kontaktid jm) jäid A1-välisena muutmata.
- Järgmine samm: etapp 3 — täielik kontroll.

### 2026-07-13 15:56 Europe/Tallinn — OPUS — OPUS VALMIS

- Etapp: 3 (täielik kontroll) + üleandmine.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Käivitatud kontrollid ja tulemused:
  - Sihttestid (`sourceJourneyLink.test.js` + `linkedPreInquiries.test.js`): **16/16 pass**.
  - `npm test` (kogu komplekt): **741/741 pass**.
  - `npm run i18n:check`: **OK** (et=baas, en+ru pariteet).
  - `npm run lint`: **0 viga**, 384 hoiatust — kõik varasemad (hard-coded stringid, unused vars mujal); minu muudetud failides 0 uut hoiatust (eraldi eslint-jooks kinnitas exit 0).
  - `npm run build`: **läbis** (i18n:check + `next build --turbopack`; marsruudid `/teekond/[id]`, `/eelpoordumised` väljastati).
  - `git diff --check`: **puhas**.
  - `npm run db:migrate:check`: **OK** (reaalne localhost-Postgres, 77-migratsiooni ahel, „schema up to date").
  - Runtime-smoke (kasutaja dev-server pordil 3000): `GET /api/journeys/<id>` ja `GET /api/pre-inquiries` autoriseerimata → puhas **401 JSON** (mitte 500) → mu marsruut/importid laadivad korrektselt.
- Diff käsitsi üle vaadatud: ainult A1-failid; pre-existing (ruumipildid, `page.js`, `room.css`, `RoomStage.jsx`, `room-frames.js`, docs/Plaan/output kustutused jm) puutumata, ei stage'itud.
- Risk või takistus: `npm test` ei jooksuta elavat DELETE→SET NULL cascade'i (test #6) — kaetud `db:migrate:check` reaalse ahelaga + skeemi/SQL-kontraktitestidega. Test #8: kordusesitus loob eraldi eelpöördumised (olemasolev käitumine, idempotentsuse võtit pole) — üleandmisrisk.
- Järgmine samm: Sol järelkontroll (§12/§13).

### 2026-07-13 16:05 Europe/Tallinn — OPUS — OPUS VALMIS (täiendus)

- Etapp: 3 järelparandus (ühtsus PATCH-teel).
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud: `updateJourneyForUser` (`lib/journey/service.js`) tagastab nüüd sama kuju mis GET detail — lisab `linkedPreInquiries`. Ilma selleta oleks Teekonna redigeerimine (PATCH → klient `setJourney(payload.journey)`) kaotanud „Seotud eelpöördumised" loendi kuni lehe uuestilaadimiseni. See ei laienda A1 ulatust, vaid hoiab A1 lugemisvaate korrektsena olemasolevatel Teekonna-interaktsioonidel.
- Muudetud failid: `lib/journey/service.js` (sama fail, mis eelnevalt).
- Käivitatud kontrollid ja tulemused (lõplik seis): sihttestid 16/16; `npm test` 741/741; `eslint lib/journey/service.js` 0 viga; `npm run build` „Compiled successfully", exit 0.
- Risk või takistus: puudub uus.
- Järgmine samm: Sol järelkontroll.

### 2026-07-13 19:12 Europe/Tallinn — SOL — HEAKS KIIDETUD

- Etapp: sõltumatu A1 järelkontroll, selgete vigade parandus ja lõppkontroll.
- Tehtud: võrreldud A1 eesmärki baasdifi, skeemi, migratsiooni, serveri õiguste, serializer'i privaatsuspiiri, Journey detailpäringu, kliendivoo ja testidega. Leitud ning parandatud kolm sama avamistee servajuhtumit: uue seoseta pöördumise alustamine puhastab nüüd vana `journeySourceId` väärtuse; `workspaceRole=CLIENT` avab autori koostamisvaate ka spetsialisti kontol; `openInquiry` laeb täpse omaniku pöördumise detailpäringuga ka siis, kui see ei mahu 100 viimase kirje loendisse. Detailpäringu tulemus avatakse ainult siis, kui `authorId` vastab aktiivsele kasutajale.
- Muudetud failid Soli poolt: `components/workspace/WorkspaceFeaturePage.jsx`, `tests/journey/linkedPreInquiries.test.js`, käesolev progressifail.
- Käivitatud kontrollid ja tulemused: A1 sihttestid **19/19**; kogu `npm test` **744/744**; A1 failide ESLint **0 viga** (ainult 27 failis varem olemas olnud hard-coded teksti hoiatust); `i18n:check` OK; production build OK; `db:migrate:check` OK kogu 77 migratsiooni ahelal; `git diff --check` Soli muudetud failidele puhas.
- Otsused ja põhjendus: kasutaja kinnitatud üldine 404 võõrale/puuduvale/kustunud `sourceJourneyId`-le on järjekindel olemasoleva Journey omandimustriga ja ei lekita objekti olemasolu. Nullable FK + `ON DELETE SET NULL`, minimaalne omaniku detailvastus ja `serializePreInquiry` viite mitteavaldamine täidavad A1 andme- ja privaatsuspiiri. React/Next muutus hoiab päringupõhise vaatevaliku kliendipoolses efektis, vältides serveri ja kliendi esmarenderduse lahknevust.
- Risk või takistus: brauseris kinnitati spetsialisti vastuvõtuvaatest `workspaceRole=CLIENT` autori vaatesse lülitumine. Täielikku sisselogitud loomise e2e-d ei saanud jooksutada, sest brauseris puudus aktiivne kasutajaseanss ja seemneandmed. Elavat konkreetse rea `DELETE → SET NULL` operatsiooni ei lisa `npm test`; FK loomine ja täielik migratsiooniahel on reaalse ajutise PostgreSQL andmebaasiga kontrollitud.
- Järgmine samm: A1 võib A1 failide täpse loendi alusel commit'ida. A1-väliseid pooleliolevaid faile ei stage'ita. Järgmist ootejärjekorra tööd ei alustata enne kasutaja valikut.

## 12. Opuse üleandmine Solile

Opus täidab selle osa töö lõpus. Olemasolevaid ridu ei kustutata; vastused lisatakse nende alla.

### Tulemus

- Staatus: **OPUS VALMIS** (ootab Soli järelkontrolli).
- Baasseis/commit: `e5fa1c59df5ce9af607ba7869fef095eba3eface` (haru `main`). Töö on commit'imata (kasutaja otsustab commit'i); repos on ka A1-väliseid pre-existing muudatusi, mida EI tohi kaasata.
- Opuse töö commit või diff: commit'imata working tree. A1 diff (ainult need failid):
  - `prisma/schema.prisma` (+4 rida): `PreInquiry.sourceJourneyId String?`, `sourceJourney Journey? @relation(... onDelete: SetNull)`, `@@index([sourceJourneyId])`, `Journey.preInquiries PreInquiry[]`.
  - `prisma/migrations/20260713153000_pre_inquiry_source_journey/migration.sql` (uus).
  - `lib/preInquiries.js`: `resolveSourceJourneyId` (uus, eksporditud), `createPreInquiry` süstitav `{db}` + seose salvestus, `resolveRecipient` süstitav `{db}`.
  - `lib/journey/service.js`: `listLinkedPreInquiriesForJourney` + `getJourneyDetailForUser` (uued), `getJourneyForUser` süstitav `{db}`.
  - `app/api/journeys/[id]/route.js`: GET kasutab `getJourneyDetailForUser`.
  - `components/journey/JourneyDetail.jsx`: `LinkedPreInquiries` + staatuse-silt, `RelatedObjectsPanel` serveripõhine seotud loend.
  - `components/workspace/WorkspaceFeaturePage.jsx`: `sourceJourneyId` saatmine loomisel + `?openInquiry` deep-link.
  - `messages/{et,en,ru}.json`: `journey.related` uued võtmed.
  - `tests/preInquiries/sourceJourneyLink.test.js` + `tests/journey/linkedPreInquiries.test.js` (uued).
- Migratsiooni mõju: lisab `PreInquiry."sourceJourneyId"` (nullable TEXT) + indeks + FK `Journey(id)` `ON DELETE SET NULL ON UPDATE CASCADE`. Edasiühilduv: olemasolevad eelpöördumised jäävad `sourceJourneyId = NULL`. Varasemaid migratsioone ei muudetud. Kontrollitud `db:migrate:check` reaalse ahelaga (OK, drift puudub).
- Käitumise muutus kasutajale: kui kasutaja alustab eelpöördumist Teekonnast (`?fromJourney=`), salvestub loomisel püsiv seos. Teekonna detailvaate „Seotud eelpöördumised" kuvab seotud pöördumiste teema + staatuse + „Ava" lingi (`?openInquiry=<id>`), toor-ID-de asemel. Tühi olek arusaadav. Muude sisestusteede käitumine ei muutu.
- Õiguste ja privaatsuse kontroll: server kinnitab, et Teekond kuulub autorile (`resolveSourceJourneyId`); võõras/puuduv/kustunud ID → üldine `404` (`journeys.errors.not_found`), eelpöördumist ei looda, olemasolu ei lekitata (`getJourneyForUser` muster). `serializePreInquiry` EI väljasta `sourceJourneyId`-d → adressaat ei saa Teekonna viidet ega sisu. Seotud eelpöördumiste lugemine on kahekordselt skoobitud (`sourceJourneyId` + `authorId`) ja tuleb ainult omaniku Teekonna detailist; kuvatakse ainult `id/topic/status/createdAt/updatedAt`. Privaatset Teekonda ei märgita jagatuks.
- Käivitatud testid: sihttestid 16/16; `npm test` 741/741; `i18n:check` OK; `lint` 0 viga; `build` OK; `git diff --check` puhas; `db:migrate:check` OK; runtime-smoke 401 OK.
- Ebaõnnestunud või vahele jäetud kontrollid: brauseri autoriseeritud e2e (login → Teekond → eelpöördumine → detailvaade) jäi ajamata — nõuab seanssi + seemneandmeid; katmata jäänud osa (elav DELETE→SET NULL cascade) on kaetud `db:migrate:check` reaalse ahelaga + skeemi/SQL-kontraktitestidega. `npm test` ei ühendu DB-ga.
- Teadaolevad riskid:
  1. Test #6 (cascade) tugineb migratsioonikontrollile + skeemi/SQL-kontraktile, mitte `npm test` elavale DB-le (infra piirang, dokumenteeritud).
  2. Test #8: kordusesitus (retry) loob eraldi eelpöördumised — olemasolev loomiskäitumine, idempotentsuse võtit pole; iga üksik pöördumine kannab siiski täpselt üht `sourceJourneyId` skalaari (varjatud topeltseost pole).
  3. `?openInquiry` deep-link avab pöördumise, kui see on `inquiries` loendis (autoreeritud). See on väike A1 lugemistee laiendus, mitte uus voog.
- Küsimused Solile:
  1. Kas 404-poliitika vigasele/võõrale `sourceJourneyId`-le (mitte vaikne null) on soovitud lõplik käitumine? (Kasutaja kinnitas selle Opusele; palun kinnita järelkontrollis.)
  2. Kas soovid täiendavat elava-DB integratsioonitesti cascade'ile eraldi (mitte-`npm test`) käivitusteel?

## 13. Soli järelkontroll

Sol täidab selle osa pärast Opuse üleandmist.

- [x] Võrdle tulemust algse A1 eesmärgi ja vastuvõtukriteeriumidega.
- [x] Kontrolli skeemi ja migratsiooni olemasoleva andmestiku suhtes.
- [x] Kontrolli omandi- ja recipient-piire serveritasemel.
- [x] Kontrolli, et Teekonna viide ei lekiks adressaadile.
- [x] Kontrolli kustutuskäitumist ja nullable pärandkirjeid.
- [x] Hinda testide sisukust ning lisa puuduva regressioonikaitse.
- [x] Käivita vajalikud siht- ja täiskontrollid sõltumatult.
- [x] Paranda ainult selged tehnilised vead.
- [x] Lisa progressipäevikusse lõppstaatus.

### Soli otsus

- Staatus: **SOL KONTROLLIS — lõpetatud**
- Hinnang: **HEAKS KIIDETUD**
- Leitud probleemid: vana `journeySourceId` ei puhastunud uue pöördumise alustamisel; spetsialisti konto ei rakendanud Journey lingi `workspaceRole=CLIENT` autori vaadet; üle 100 kirje vanune seotud pöördumine ei avanenud loendipõhise otsinguga.
- Soli tehtud parandused: kõik kolm servajuhtumit parandatud ning lisatud kolm regressioonitesti; A1 sihttestide arv on nüüd 19.
- Sõltumatult käivitatud kontrollid: sihttestid 19/19, `npm test` 744/744, i18n OK, A1 lint 0 viga, build OK, 77 migratsiooni puhas ahel OK, brauseris autori vaate valik OK.
- Allesjäänud riskid: autoriseeritud täis-e2e ja elava rea cascade-test vajavad eraldi testseanssi/seemneandmeid; praegused serveri-, skeemi-, SQL- ja reaalse migratsiooniahela kontrollid on piisavad A1 merge'iks.
- Merge-soovitus: **jah**, commit'ida ainult A1 üleandmises loetletud failid koos Soli kahe parandatud failiga ja käesoleva progressifailiga; A1-välised muudatused jätta välja.

## 14. Järgmiste tööde ootejärjekord

Neid ei alustata automaatselt. Kasutaja valib järgmise töö pärast A1 Soli järelkontrolli.

1. A2 — ruumi deduplikatsioon `originType/originId` järgi.
2. A4 — eelpöördumine → Kovisioon anonüümsuskinnituse edastamine.
3. A11 — „Parimad praktikad” põhikarussellis ausalt „ehitamisel”.
4. A5/U1-lite — sisemise eelpöördumise saabumise sündmus ja e-kiri.
5. U10 — spetsialisti kinnitatud kohtumise kokkuvõte ühisesse ruumi.
