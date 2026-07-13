# A6.1 — Teemaseemne püsiv privaatne tuum: Opus 4.8 tööplaan ja progress

Uuendatud: 14.07.2026
Staatus: **SOLI JÄRELKONTROLL LÄBITUD — HEAKS KIIDETUD**
Teostaja: **Claude Opus 4.8 / Claude Code**
Nõutud effort: **Extra (`xhigh`)**
Järelkontroll: **Sol**
Baas: `main` @ `ef660414`

## 0. Opusele antav põhikäsk

Loe käesolev fail algusest lõpuni ja täida A6.1 vertikaalne lõik siin kirjeldatud piirides.

**Ära jää pärast read-only kaardistust kinnitust ootama.** Kui aktiivne kood ei paljasta allpool loetletud päris blokeerijat, lisa progressipäevikusse `ALUSTATUD` kirje ja jätka automaatselt teostuse, testide ning üleandmiseni.

Ära commit'i, push'i ega deploy'i. Töö lõpus märgi **OPUS VALMIS** ja anna muudatused Solile sõltumatuks järelkontrolliks.

## 1. Mudel ja effort-värav

See töö tehakse mudeliga **Claude Opus 4.8** ja effort-tasemel **Extra (`xhigh`)**.

- Kui sessioon ei ole Opus 4.8 või effort ei ole Extra/xhigh, tuleta kasutajale enne koodimuudatusi meelde see õigeks seada.
- `Max`/`Ultra` ei ole vaikimisi vajalik: A6.1 on teadlikult piiritletud omaniku-privaatne vertikaalne lõik ning Sol teeb järelkontrolli.
- Kõrgemat effort'it küsi ainult siis, kui Etapp 0 tõendab, et töö nõuab O1/O3 arhitektuuri, olemasoleva Kovisiooni andmemudeli ümbertegemist või grupiõiguste uut mudelit. Neid ei tohi vaikimisi A6.1 sisse võtta.

## 2. Autoriteetne arhitektuuriotsus

### O2 valik: variant B

Teemaseeme on **eraldi `TopicSeed` objekt**, mitte `CovisionCase` staatusega DRAFT.

Põhjused:

1. Teemaseemne omaniku privaatne ettevalmistus peab jääma Kovisiooni osalejate vaatest eraldi.
2. Kovisiooni juhtum luuakse alles tulevases teadlikus üleminekus ning sinna liigub ainult kinnitatud üldistus.
3. A6.1 ei muuda olemasoleva Kovisiooni API ega `CovisionCase` semantikat.
4. See võimaldab Teemaseemned pärisandmetele viia enne O1 lõuendi-sidumise otsuse teostamist.

Käesoleva ülesande kasutajale andmine tähendab selle A6.1 otsuse kinnitamist. Opus ei küsi sama valikut uuesti.

### A6.1 piir: privaatne püsivus + teadlik järjekorra-hetktõmmis

A6.1 teeb päriseks ainult järgmise lõigu:

```text
omanik loob kiire seemne
  -> seeme salvestub püsivalt omaniku privaatse DRAFT-kirjena
  -> lehe uuesti avamine taastab kirje serverist
  -> omanik vaatab üldistatud kaardi üle
  -> teadlik kinnitus loob külmutatud jagatava kaardi hetktõmmise
  -> seeme läheb WAITING/ootel olekusse
```

**Oluline:** A6.1-s ei ole veel päris kovisioonigruppi ega organisatsioonilist nähtavusskoopi. WAITING tähendab, et omanik on kaardi järjekorra jaoks kinnitanud; see **ei avalda** seemet automaatselt teistele kasutajatele. UI peab seda ausalt ütlema.

## 3. Tõeallikate järjekord

Kui allikad lahknevad, kehtib:

1. aktiivne kood, Prisma skeem, migratsioonid ja testid;
2. käesolev A6.1 plaan;
3. `Kovisioon/teemaseeme-professionaalne-funktsioon.md` allpool nimetatud osad;
4. Fable platvormiloogika analüüsid;
5. muu ideematerjal.

Fable pole praegu limiidi tõttu kasutatav, kuid olemasolevad Fable-failid on kehtivad lähteallikad. Fable vastust ei oodata.

## 4. Kohustuslik lugemine enne `ALUSTATUD` kirjet

Loe täielikult käesolev fail ning seejärel ainult järgmised asjakohased allikad:

1. `Kovisioon/teemaseeme-professionaalne-funktsioon.md`
   - §4 keskne arhitektuur ja teadlik jagamine;
   - §6 rollid ja õigused;
   - §7 elutsükkel;
   - §9 kiire seemne kohustuslikud väljad;
   - §26 Teemaseemnete leht;
   - §31 andmekaitse ja konfidentsiaalsus;
   - §32.1 `Seed` ja §32.2 `VisibilityProfile`;
   - §34 MVP;
   - §36 vastuvõtukriteeriumid.
2. `docs/platvormi arendus/fable-5-platvormiloogika-max-taiendus.md`
   - §2.4 `/teemaseemned` runtime-leid;
   - §3.2 TopicSeed variant B;
   - §7.1 A6;
   - §8 O1–O3, eriti O2;
   - §9.11 sõltuvuskaart ja soovitatud järjekord;
   - §10.4–10.5 prioriteedid ja otsused.
3. Aktiivne kood:
   - `components/teemaseeme/TeemaseemnedPage.jsx` täielikult;
   - `app/teemaseemned/page.jsx`;
   - `app/styles/teemaseeme.css` ainult muutmise vajaduse korral;
   - `prisma/schema.prisma`: `User`, `CovisionCase` ja seotud enum'id;
   - `lib/covision.js`: `canUseCovisionRole`, `requireCovisionRole`, nähtavus- ja omandimustrid;
   - `lib/covisionApi.js`;
   - olemasolevad lähedased API-/service-/fake-Prisma testimustrid.
4. Senised progressidokid:
   - `01-opus-jarjekord-a2-u10-progress.md` ainult kehtiva tööviisi ja kõrvaliste failide piiride jaoks;
   - `03-a3-preinquiry-downloaded-progress.md` ainult versioonikindla teadliku tegevuse ja Opus -> Sol üleandmise mustri jaoks.

Kogu `docs/platvormi arendus` kausta järjest lugemine ei ole vajalik ega tohi laiendada skoopi.

## 5. Etapp 0 — read-only kaardistus

Enne muutmist:

- kinnita `HEAD`, haru ja `origin/main`;
- loetle worktree muudatused;
- märgi selgelt A6.1-välised kasutaja failid;
- kontrolli, et `/teemaseemned` kasutab praegu `DEMO_SEEDS` + lokaalset Reacti olekut;
- kontrolli, et kasutajal puudub päris organisatsiooni-/kovisioonigrupi seos, millega saaks globaalset WAITING-loendit turvaliselt skoopida;
- kontrolli migratsioonide ja testitaristu aktiivset mustrit;
- kirjuta progressipäevikusse dok-vs-kood erinevused.

Seejärel **jätka automaatselt**, kui ei ilmne §13 blokeerijat.

## 6. Andmemudel ja migratsioon

Loo minimaalne eraldi `TopicSeed` andmemudel. Täpsed Prisma nimed võib sobitada repo stiiliga, kuid mudel peab kandma vähemalt:

- `id`;
- `ownerId` + `User` relatsioon `onDelete: Cascade`;
- üldistatud `title`;
- `contextType`;
- `caseType`;
- `whyNow`;
- `requestedSupport[]`;
- `importance` (1–10 või null pooleliolevas mustandis);
- `safetyGate` või samaväärne serveris valideeritud sobivuskontrolli tulemus;
- `status` vähemalt kanoniseeritud DRAFT ja WAITING tähendusega;
- külmutatud `sharedCardSnapshot` (JSON sobib A6.1 jaoks);
- `ownerConfirmedAt`/`sharedAt` või samaväärsed auditiajad;
- `createdAt`, `updatedAt`;
- omaniku ja oleku järgi vajalikud indeksid.

Elutsükli tulevased olekud võib modelleerida ainult siis, kui need tulevad otse lukustatud §7 elutsüklist ega lisa käesolevasse töösse uusi üleminekuid. A6.1 rakendab ainult DRAFT -> WAITING.

Ära lisa veel:

- `CovisionCase` FK-d või juhtumiks konverteerimist;
- organisatsiooni/grupi FK-d;
- `SeedPrepItem` alammodelle;
- kohtumise, järelvaate või praktikakandidaadi tabeleid;
- demoandmete DB-seedi.

Migratsioon peab olema edasiühilduv ja olemasolevaid kirjeid mitte mõjutama. Käivita Prisma valideerimine/generate ning päris migratsiooniahela kontroll.

## 7. Server ja õigused

Loo teemaseemnete service-kiht, eelistatult `lib/topicSeeds.js`, db-süstega testitavaks.

### 7.1. Ligipääs

- Kasuta sama rolliväravat, mida aktiivne `/teemaseemned` leht praegu kasutab (`SOCIAL_WORKER`, `SERVICE_PROVIDER`, admin), ilma O3 lahendamata.
- Autentimata: 401.
- Vale roll: 403.
- Tavakasutaja ja admin näevad A6.1-s ainult enda seemneid; admin ei saa vaikimisi privaatset sisu lugeda.
- Võõras või puuduv seeme annab sama üldise 404.
- `ownerId`, auditiajad, staatus ja jagatud hetktõmmis ei ole kliendi vabalt määratavad.

### 7.2. API minimaalne pind

Loo selge minimaalne API, näiteks:

- `GET /api/topic-seeds` — omaniku seemnete loend;
- `POST /api/topic-seeds` — omaniku privaatse DRAFT-i loomine;
- `GET/PATCH /api/topic-seeds/[id]` ainult siis, kui aktiivne UI seda A6.1-s päriselt vajab;
- `POST /api/topic-seeds/[id]/queue` — omaniku teadlik DRAFT -> WAITING tegevus ja jagatava kaardi hetktõmmise külmutamine.

Ära ühenda uut API-d `/api/covision` alla.

### 7.3. Loomise valideerimine

- Server normaliseerib väljad ja jõustab pikkuse/loendipiirid.
- DRAFT võib olla pooleli; kiire seemne „Loo Teemaseeme” tegevus peab nõudma §9 kohustuslikke välju.
- Pealkiri maksimaalselt 80 tähemärki.
- `importance` ainult täisarv 1–10 või null mustandis.
- `contextType`, `caseType`, `requestedSupport` ja `safetyGate` tulevad serveri whitelist'idest.
- Klient ei saa POST/PATCH kaudu ise WAITING või muud tulevast olekut vermida.

### 7.4. Teadlik järjekorda lisamine

DRAFT -> WAITING toimub ainult eraldi queue-tegevuse kaudu:

- omanik kinnitab sõnaselgelt jagatava üldistuse;
- server ehitab jagatava hetktõmmise ainult lubatud üldistatud väljadest;
- privaatne tulevane ettevalmistus ei tohi hetktõmmisesse sattuda;
- tegevus peab olema versioonikindel: klient saadab `expectedUpdatedAt` või samaväärse fingerprint'i, server kontrollib seda atomaarse kirjutuse osana;
- puuduv, vigane või aegunud fingerprint -> üldine 409, olek ja snapshot ei muutu;
- korduskutse peab olema idempotentne või andma kontrollitud konflikti, mitte looma uut objekti;
- üldistus ei muutu teistele nähtavaks, sest A6.1-s pole veel turvalist grupiskoopi.

Kasuta olemasolevat anonüümsuse/privaatsuse kontrolli seal, kus see sobib, kuid ära ehita uut AI-põhist anonüümimist. Vähemalt peavad UI ja server nõudma teadlikku kinnitust, et jagatav kaart ei sisalda nime, isikukoodi, täpset aadressi ega muud otsest identifikaatorit.

## 8. Kliendi sidumine

Muuda `TeemaseemnedPage.jsx` pärisandmeid kasutama, säilitades olemasoleva ruumilise kaardivaate ja kaardi liigutamise/suuruse lokaalse UI-oleku.

Kohustuslik:

- tootmisvaade ei kasuta enam `DEMO_SEEDS`-i tõeallikana;
- lehe avamisel laaditakse omaniku seemned API-st;
- „Salvesta mustand” ja „Loo Teemaseeme” kirjutavad serverisse;
- serveri vastus, mitte kohalik `nextSeedId`, määrab id/oleku;
- „Lisa kovisioonijärjekorda” kutsub teadlikku queue-endpoint'i koos versioonifingerprint'iga;
- võrgu-/serverivea korral ei näidata eksitavat salvestuse ega WAITING edukust;
- filtrid ja loendurid põhinevad serverist saadud omanikuandmetel;
- lehe taaslaadimine säilitab loodud seemne;
- demo-teiste kasutajate kaarte ei näidata pärisandmetena.

### Aus UI A6.1-s

Praegune tekst väidab, et grupp näeb järjekorda lisatud seemet. A6.1-s pole veel grupiskoopi. Muuda ainult vajalik tekst ausaks:

- järjekorda lisamine kinnitab ja külmutab üldistuse;
- see ei jaga seda veel teiste kasutajatega;
- grupile nähtavus tekib tulevases Kovisiooni grupi/kohtumise sidumises.

Ära kujunda lehte ümber ega tee üldist CSS-refaktorit. Uus kasutajatekst peab olema ET/EN/RU tõlgetes; olemasoleva lehe kogu ajaloolise hard-coded teksti tõlkimine ei kuulu A6.1-sse.

## 9. Testid

Lisa vähemalt järgmised regressioonid:

### 9.1. Service/API

1. lubatud roll loob enda DRAFT-i;
2. kliendi `ownerId` ja `status` sisend ei saa omandit/olekut võltsida;
3. pooleliolev mustand on lubatud ainult mustandina;
4. täieliku kiire seemne väljad normaliseeritakse ja valideeritakse;
5. vigane kontekst/liik/tugi/olulisus lükatakse tagasi;
6. omanik näeb oma loendit;
7. võõras kasutaja ei näe ega muuda seemet; võõras ja puuduv -> sama 404;
8. admin ei saa vaikimisi teise kasutaja privaatset seemet lugeda;
9. DRAFT -> WAITING ainult queue-endpoint'i ja sõnaselge kinnitusega;
10. jagatud snapshot sisaldab ainult lubatud üldistatud välju;
11. puuduv/vigane/aegunud fingerprint -> 409, 0 staatuse/snapshot'i kirjutust;
12. õige fingerprint -> WAITING + auditiaeg + snapshot;
13. tavaline create/update ei saa WAITING-olekut vermida;
14. kordusqueue on deterministlik;
15. autentimata 401 ja vale roll 403.

### 9.2. Prisma/migratsioon

- mudel, relatsioonid, indeksid ja migratsiooni SQL on kaetud skeemi-/kontraktitestiga;
- puhas migratsiooniahel läbib `db:migrate:check`;
- olemasolev DB ei vaja andmete backfill'i.

### 9.3. Klient

Repo olemasoleva testistiili järgi kata vähemalt:

- `DEMO_SEEDS` ei ole enam tootmisandmete tõeallikas;
- leht GET-ib `/api/topic-seeds`;
- create/save kasutab serverit;
- queue saadab `expectedUpdatedAt` ja teadliku kinnituse;
- eduolek tuleb ainult eduka vastuse järel;
- lokaalne kaardipaigutus ei lähe serveri domeeniandmetesse;
- uued i18n-võtmed on ET/EN/RU-s.

Kui brauseri autenditud e2e pole teostatav, märgi see ausalt; ära nimeta source-contract testi e2e-ks.

## 10. Kontrollipakett

Enne `OPUS VALMIS` kirjet käivita:

- A6.1 sihttestid;
- kogu `npm test`;
- `npm run i18n:check`;
- ESLint kõigil muudetud koodifailidel;
- `npx prisma validate`;
- `npx prisma generate`;
- `npm run db:migrate:check`;
- `npm run build`;
- `git diff --check`;
- vähemalt autentimata runtime-smoke uutele marsruutidele (oodatud 401 JSON).

Kui mõni kontroll ebaõnnestub varem olemas olnud A6.1-välisel põhjusel, tõenda baseline-võrdlusega, ära peida seda.

## 11. Vastuvõtukriteeriumid

A6.1 on Opuse poolt üleandmiseks valmis ainult siis, kui:

- päris kasutaja loodud seeme säilib lehe taaslaadimisel;
- ükski demo-kaart ei esine päris kasutajaandmena;
- privaatne DRAFT on ainult omanikule nähtav;
- teadlik queue-tegevus külmutab versioonikindla üldistatud snapshot'i;
- WAITING ei tee seemet veel teistele kasutajatele nähtavaks;
- server jõustab rolli, omandi, valideerimise ja ülemineku;
- võõra objekti olemasolu ei leki;
- Kovisiooni olemasolev andmekiht ja API jäävad muutmata;
- kõik §10 kontrollid on rohelised või ausalt baseline'iga dokumenteeritud;
- progressidokk sisaldab täpset üleandmist Solile;
- commit/push/deploy pole tehtud.

## 12. Mitte-eesmärgid

A6.1-s ei tehta:

- O1 lõuendi ja andmekihi sidumist;
- O3 teenuseosutaja lõplikku õigusemudelit;
- TopicSeed -> CovisionCase konverteerimist;
- päris grupi-/organisatsiooni-/kohtumise järjekorda;
- teiste kasutajate WAITING seemnete lugemist;
- Kovisioonipaki detailmudeleid;
- privaatse ettevalmistuse täisandmestamist;
- järelvaadet, sulgemist ega praktikakandidaati;
- Parimate praktikate lehte;
- Teemaseemnete täis-i18n refaktorit;
- üldist visuaalset ümberkujundust;
- ruumipiltide, imagegen-väljundite ega kaadriskripti muudatusi;
- deploy'd.

## 13. Päris blokeerijad, mille korral peatuda

Opus peatub ja küsib kasutajalt ainult siis, kui:

1. aktiivne skeem sisaldab juba teist TopicSeed-laadset püsimudelit, mille dubleerimine oleks ohtlik;
2. A6.1 owner-only API-d ei saa teha ilma olemasoleva Kovisiooni API lepingut lõhkumata;
3. migratsiooniahel on enne A6.1 muudatusi katki ja baseline-kontroll tõendab seda;
4. worktree's on kasutaja commitimata muudatusi samades A6.1 sihtfailides ning neid ei saa turvaliselt säilitada;
5. ülesande täitmine nõuaks teiste kasutajate nähtavuse jaoks uut grupi-/organisatsioonimudelit.

Sellisel juhul ära improviseeri. Lisa progressipäevikusse tõendid, täpne blocker ja minimaalne otsus, mida kasutajalt vajad.

## 14. Worktree ja git-piir

Baasplaani loomisel on teada A6.1-välised pooleliolevad failid:

- `public/room/frame-*.webp` kustutused;
- `output/imagegen/room-walk-v8-natural-2026-07-13/**`;
- `output/imagegen/room-walk-v9-locked-2026-07-13/**`;
- `scripts/build-room-locked-frames.mjs`.

Neid ei tohi muuta, taastada, kustutada, stage'ida ega commit'ida. Kui worktree on muutunud, kaardista uus seis ja säilita kõik A6.1-väline puutumata.

## 15. Tööetapid

### Etapp 0 — kaardistus

- [x] Mudel/effort kinnitatud.
- [x] Kohustuslik lugemine tehtud.
- [x] Baas ja worktree jäädvustatud.
- [x] Dok-vs-kood lahknevused kirjas.
- [x] Päris blokeerijat ei ole või see on dokumenteeritud.

### Etapp 1 — mudel ja server

- [x] TopicSeed skeem + migratsioon.
- [x] Service-kiht ja serializer.
- [x] Omaniku list/create minimaalsed marsruudid.
- [x] Versioonikindel queue-tegevus + snapshot.
- [x] Õigused/privaatsus serveris.

### Etapp 2 — klient

- [x] Demo tõeallikas eemaldatud.
- [x] Serverist laadimine ja salvestamine.
- [x] Teadlik queue-voog.
- [x] Aus A6.1 jagamistekst.
- [x] Vajalik ET/EN/RU.

### Etapp 3 — testid ja kontroll

- [x] §9 regressioonid.
- [x] §10 kontrollipakett.
- [x] Diff käsitsi üle vaadatud.

### Etapp 4 — üleandmine

- [x] Progressipäevik täidetud.
- [x] Muudetud failide täpne loend.
- [x] Riskid ja teadlikult edasilükatu.
- [x] Märge **OPUS VALMIS — ootab Soli järelkontrolli**.
- [x] Midagi pole commit'itud/push'itud/deploy'itud.

## 16. Progressipäevik

Varasemaid kirjeid ei muudeta ega kustutata. Iga uus kirje kasutab vormi:

```md
### YYYY-MM-DD HH:mm Europe/Tallinn — OPUS/SOL — STAATUS

- Etapp:
- Mudel ja effort:
- Loetud/kontrollitud:
- Tehtud:
- Dok-vs-kood erinevused:
- Otsused ja põhjendus:
- Käivitatud kontrollid ja tulemused:
- Risk või takistus:
- Järgmine samm:
```

### 2026-07-14 — CODEX — TÖÖPLAAN VALMIS

- Etapp: järgmise Opusele sobiva vertikaalse lõigu valik ja A6.1 tööplaan.
- Mudel ja effort: Claude Opus 4.8, Extra (`xhigh`).
- Loetud/kontrollitud: senised Opus/Sol progressid; Fable A6/O2/prioriteedid; aktiivne `TeemaseemnedPage.jsx`, lehe rollivärav, Kovisiooni õigusemustrid, Prisma `User`/`CovisionCase`; Teemaseemne spec'i arhitektuur, elutsükkel, kiire seeme, andmekaitse, mudel, MVP ja vastuvõtukriteeriumid.
- Tehtud: valitud A6.1 — eraldi TopicSeed omaniku-privaatne püsiv tuum + teadliku queue-snapshot'i vertikaalne lõik; määratud serveri-, kliendi-, õiguse-, migratsiooni- ja testipiirid.
- Dok-vs-kood erinevused: `/teemaseemned` on praegu 4 demo-seemne ja lokaalse Reacti olekuga; päris grupi-/organisatsiooniskoop puudub; seetõttu ei tohi A6.1 WAITING seemneid teistele avaldada ega väita, et grupp neid juba näeb.
- Otsused ja põhjendus: O2 variant B (eraldi TopicSeed) kaitseb privaatset ettevalmistust ja ei sõltu O1 Kovisiooni sidumisest. Esimene lõik on owner-only, sest aktiivses `User` mudelis puudub turvaline organisatsiooni-/grupiseos.
- Käivitatud kontrollid ja tulemused: read-only dokumentide/koodi/skeemi kaardistus; `main` baas `ef660414`; teadaolevad A6.1-välised ruumifailid säilitatakse.
- Risk või takistus: grupi tegelik nähtavus ja TopicSeed -> CovisionCase üleminek vajavad hiljem O1/O3 ning kohtumise/grupi kandjat; need pole A6.1 blockerid.
- Järgmine samm: kasutaja annab selle faili Opusele; Opus alustab Etapp 0 kaardistusega ja jätkab automaatselt teostuseni.

### 2026-07-14 04:10 Europe/Tallinn — OPUS — ALUSTATUD

- Etapp: Etapp 0 (read-only kaardistus) läbitud; algab Etapp 1 (mudel + server).
- Mudel ja effort: Claude Opus 4.8, Extra (`xhigh`) — kinnitatud sessioon.
- Loetud/kontrollitud: käesolev plaan täielikult; spec §9 (kohustuslikud kiire-seemne väljad), §9.2/§9.3/§9.5 valikute kaanon; `TeemaseemnedPage.jsx` (täielikult), `app/teemaseemned/page.jsx`, `lib/covision.js` (`canUseCovisionRole`/`requireCovisionRole`, õigus/nähtavusmustrid), `lib/covisionApi.js` (auth + veakäsitlus), Prisma `User`/`PreInquiry`/`CovisionCase` stiil + enum'id, i18n kliendimehhanism (`useI18n` + `readText`), migratsiooni-SQL stiil, `db:migrate:check` (loob värske temp-DB localhost'is).
- Tehtud: kaardistus + otsused; kirjutan nüüd TopicSeed mudeli, migratsiooni, `lib/topicSeeds.js` teenusekihi, API-marsruudid, kliendi sidumise, i18n ja testid.
- Dok-vs-kood erinevused:
  - `/teemaseemned` kasutab praegu 4 `DEMO_SEEDS` + lokaalset Reacti olekut; `DEMO_USER` on väljamõeldud kasutaja; kogu tekst on hard-coded ET (i18n puudub). → A6.1 eemaldab DEMO tõeallikana, laadib serverist, uus/muudetud tekst läheb i18n-i (ülejäänud ajalooline tekst jääb, §12 non-goal).
  - Kliendi olekud `valitud`/`jarelvaates`/`toos`/`suletud` ja kaardinupud „Ava kovisioonis" on demo-põhised; A6.1 pärisandmed on ainult DRAFT/WAITING (kliendis `mustand`/`ootel`).
  - Kliendi „support" on praegu ET-label-massiiv; server vajab stabiilset whitelisti → toon võtmed (`understanding`, `perspectives`, …) ja kliendis key→label kaart.
  - Praegune UI väidab „Grupp näeb…" — A6.1-s pole grupiskoopi, tekst muudetakse ausaks (queue kinnitab+külmutab, EI jaga veel).
  - `User`-il puudub organisatsiooni-/grupi-FK → globaalset WAITING-loendit ei saa turvaliselt skoopida → owner-only (plaani otsus kinnitatud, mitte blokeerija).
- Otsused ja põhjendus: O2 variant B — eraldi `TopicSeed` mudel + `TopicSeedStatus {DRAFT, WAITING}`; teenusekiht DI-mustris (`{db=prisma}`) nagu `preInquiries.js`; queue on versioonikindel (kohustuslik `expectedUpdatedAt` + teadlik „ei sisalda tuvastajaid" kinnitus) nagu A3; `sharedCardSnapshot` sisaldab ainult üldistatud välju; API eraldi `/api/topic-seeds` all (Kovisiooni API puutumata); rollivärav = `requireCovisionRole` (admin läbib värava, kuid näeb ainult enda seemneid).
- Käivitatud kontrollid ja tulemused: `HEAD=ef660414`, haru `main`, `origin/main=ef660414` (sünkroonis); worktree ainult kõrvalised ruumifailid + see dokk; §13 blokeerijaid ei tuvastatud.
- Risk või takistus: puudub blokeerija; risk = kliendi ulatuslik, kuid mehaaniline ümbersidumine (demo → server) — kaetakse source-contract + service-testidega.
- Järgmine samm: TopicSeed skeem + migratsioon, seejärel teenusekiht ja marsruudid.

### 2026-07-14 05:30 Europe/Tallinn — OPUS — OPUS VALMIS

- Etapp: Etapid 1–3 valmis (mudel + server, klient, testid + kontrollid). **Commit'imata** — ootab Soli järelkontrolli.
- Mudel ja effort: Claude Opus 4.8, Extra (`xhigh`).
- Loetud/kontrollitud: vt ALUSTATUD kirje; lisaks `covisionShared` normaliseerijad, `covisionApi.requireCovisionAuth`, migratsioon-DDL näited (`TEXT[]`), i18n `t(key, fallback)` allkiri.
- Tehtud:
  - **Andmemudel:** `TopicSeed` (eraldi mudel, O2 variant B) + enum `TopicSeedStatus {DRAFT, WAITING}`; `User.topicSeeds` back-relation `onDelete: Cascade`; migratsioon `20260714040000_topic_seed` (uus enum + tabel + 3 indeksit + FK; ei muuda olemasolevaid tabeleid). `prisma validate`/`generate` OK; `db:migrate:check` OK (80 migratsiooni värskes temp-DB-s).
  - **Server:** `lib/topicSeeds.js` (DI): whitelistid (context/case/support/gate), `serializeTopicSeed`, `listTopicSeeds`, `getVisibleTopicSeed` (owner-only, no-leak), `createTopicSeed` (staatus ALATI DRAFT), `queueTopicSeed` (owner-only; nõuab täielikku kiiret seemet + `confirmedNoIdentifiers`; versioonikindel `expectedUpdatedAt` atomaarse `updateMany`-tingimusega; puuduv/vigane/aegunud → generic 409; idempotentne kordus; snapshot AINULT üldistatud väljadest).
  - **API:** `GET/POST /api/topic-seeds`, `POST /api/topic-seeds/[id]/queue`; `requireCovisionAuth` rollivärav (401/403); kontrollitud veavõtmed (mitte suvaline `error.message`; 500 = generic + logi). `/api/covision` puutumata.
  - **Klient:** `TeemaseemnedPage.jsx` — DEMO_SEEDS eemaldatud tõeallikana; seemned laaditakse GET-iga; „Salvesta mustand"/„Loo Teemaseeme" POST-ivad; server määrab id/oleku; „Lisa kovisioonijärjekorda" kutsub queue-endpoint'i `expectedUpdatedAt` + teadliku „ei sisalda tuvastajaid" checkbox'iga; vea/võrgu korral ei näidata eksitavat edu; support = stabiilsed võtmed (key→label kliendis); DEMO_USER asendatud päris kasutaja nimega (`owner` prop `page.jsx`-ist); ruumiline kaardipaigutus jääb lokaalseks (ei lähe domeeniandmetesse).
  - **Aus UI:** intro/queue/eelvaade/detail tekst muudetud — kinnitamine külmutab, EI jaga veel teistele; grupinähtavus hilisemas sidumises. Uus tekst ET/EN/RU (`topic_seeds.*`); ajalooline hard-coded tekst jäetud (§12).
  - **Testid:** `tests/topicSeeds/topicSeedsService.test.js` (16), `topicSeedsSchema.test.js` (4), `topicSeedsClientContract.test.js` (7) = 27.
- Dok-vs-kood erinevused: vt ALUSTATUD. Täiendav: `lib/covision.js` on `server-only` → rollivärava (`requireCovisionRole`) unit-testi ei saa node:test-i importida; 401/403 on kaetud marsruudi source-contract testiga + runtime-smoke'iga.
- Otsused ja põhjendus: queue kasutab optimistlikku lukustust (tingimuslik `updateMany` `updatedAt`-il) `$transaction`/advisory-lock'i asemel — A6.1-s pole eraldi edit-teed, seega ainus võistlus on queue-vs-queue (idempotentne); see rahuldab „atomaarne kirjutus" nõuet ilma üleliigse lukuta. `safetyGate` „cannot_wait" pole whitelistis (klient blokeerib niikuinii).
- Käivitatud kontrollid ja tulemused: A6.1 sihttestid 27/27 ✔; `npm test` 842/842 ✔; `i18n:check` OK; eslint (muudetud) 0 viga (71 olemasolevat „hardcoded string" hoiatust `TeemaseemnedPage.jsx`-is — §12 non-goal, ükski MINU uus tekst pole flag'itud); `prisma validate` OK; `prisma generate` OK; `db:migrate:check` OK; `npm run build` „Compiled successfully" (mõlemad marsruudid registreeritud); `git diff --check` puhas; runtime-smoke `GET/POST /api/topic-seeds` + `POST …/queue` autentimata → **401** `api.common.unauthorized`.
- Risk või takistus: puudub. Autenditud brauseri-e2e pole aetud (login puudub keskkonnas) — kaetud source-contract + 401-smoke'iga; ausalt märgitud, EI nimetata e2e-ks.
- Järgmine samm: Soli sõltumatu järelkontroll. Enne seda EI commit'i/push'i/deploy'i.

## 17. Opuse üleandmine Solile

**Tulemus ja kasutajavoog:** omanik (SOCIAL_WORKER/SERVICE_PROVIDER/admin) avab `/teemaseemned` → leht laadib tema päris seemned serverist (mitte demo). Loob kiire seemne (või salvestab poolelioleva mustandi) → salvestub püsivalt privaatse DRAFT-ina; lehe taaslaadimine taastab kirje serverist. Kaardil „Lisa kovisioonijärjekorda" → kinnitab teadlikult (checkbox „ei sisalda tuvastajaid") → server külmutab üldistatud `sharedCardSnapshot` ja seeme läheb WAITING. WAITING **ei tee** seemet teistele nähtavaks (grupiskoopi pole veel); UI ütleb seda ausalt.

**Baasseis/HEAD:** `main` @ `ef660414` (commit'imata; töö selle peal).

**Uued failid:**
- `lib/topicSeeds.js` (teenusekiht, DI)
- `app/api/topic-seeds/route.js` (GET list + POST create)
- `app/api/topic-seeds/[id]/queue/route.js` (POST queue)
- `prisma/migrations/20260714040000_topic_seed/migration.sql`
- `tests/topicSeeds/topicSeedsService.test.js`, `topicSeedsSchema.test.js`, `topicSeedsClientContract.test.js`

**Muudetud failid:**
- `prisma/schema.prisma` (`TopicSeedStatus` enum, `TopicSeed` mudel, `User.topicSeeds`)
- `components/teemaseeme/TeemaseemnedPage.jsx` (demo → server, aus UI, i18n uued stringid)
- `app/teemaseemned/page.jsx` (edastab päris `owner` nime)
- `messages/{et,en,ru}.json` (`topic_seeds.*` namespace)
- `docs/platvormi arendus/04-...` (see dokk)

**Skeem + migratsioon:** eraldi `TopicSeed` mudel (id, ownerId→User `onDelete: Cascade`, title, contextType, caseType, whyNow, requestedSupport[], importance, safetyGate, status `@default(DRAFT)`, sharedCardSnapshot Json, ownerConfirmedAt, sharedAt, createdAt, updatedAt; indeksid `[ownerId, updatedAt]`, `[status]`, `[createdAt]`). Migratsioon loob ainult uue enum'i + tabeli + FK — olemasolevaid tabeleid ei muuda, backfill'i pole vaja. `db:migrate:check` roheline.

**Õigused ja privaatsuspiir:** rollivärav = `requireCovisionAuth`→`requireCovisionRole` (autentimata 401, vale roll 403). Omanik näeb ja muudab ainult enda seemneid; admin (teise userId-na) ei loe vaikimisi võõrast → sama generic 404. `ownerId`/staatus/auditiajad/snapshot on serveri kontrollida (klient ei vermi WAITING-ut ega omandit). Jagatav snapshot sisaldab AINULT üldistatud kaardivälju (title, contextType, caseType, whyNow, requestedSupport, importance, frozenAt) — mitte ownerId'd ega privaatset `safetyGate`'i.

**Testid ja kontrollid:** A6.1 sihttestid **27/27**; `npm test` **842/842**; `i18n:check` OK; eslint (muudetud) **0 viga** (71 olemasolevat hardcoded-string hoiatust — §12 non-goal); `prisma validate` OK; `prisma generate` OK; `db:migrate:check` OK; `npm run build` OK (marsruudid registreeritud); `git diff --check` puhas; runtime-smoke 3 marsruuti autentimata → **401**.

**Ausalt ajamata:** autenditud brauseri-e2e (login puudub keskkonnas) — asendatud source-contract testide + 401 runtime-smoke'iga; EI ole e2e.

**Kõrvalised worktree failid (puutumata, stage'imata):** `public/room/frame-*.webp` kustutused, `output/imagegen/room-walk-v8-natural-2026-07-13/**`, `output/imagegen/room-walk-v9-locked-2026-07-13/**`, `scripts/build-room-locked-frames.mjs`.

**Teadlikult edasi lükatud (A6.2/O1/O3):** privaatse ettevalmistuse täisandmestamine (prep-vaade jääb kohatäiteks); TopicSeed→CovisionCase üleminek; päris grupi-/organisatsiooni-/kohtumise järjekord ja teiste WAITING seemnete nähtavus; O1 lõuendisidumine; O3 teenuseosutaja õigusemudel; Teemaseemnete täis-i18n; Parimate praktikate leht.

**Kinnitus: commit / push / deploy on TEGEMATA.**

## 18. Soli järelkontroll

Sol kontrollib vähemalt:

- [x] O2 variant B on päriselt eraldi mudel; `CovisionCase` leping ei muutunud.
- [x] Demoandmed ei esine kasutaja pärisandmetena.
- [x] Owner-only lugemine/kirjutamine ja no-leak 404 toimivad.
- [x] Admin ei näe vaikimisi võõrast privaatset sisu.
- [x] DRAFT -> WAITING toimub ainult teadliku, versioonikindla queue-tegevusega.
- [x] Snapshot on külmutatud ja sisaldab ainult lubatud üldistatud välju.
- [x] WAITING ei avaldu veel teistele kasutajatele.
- [x] UI tekst ei luba olemasolematut grupijagamist.
- [x] Migratsioon on puhas ja tagasipööratav mõistlikus ulatuses.
- [x] Testid tõendavad serverilepingut, mitte ainult lähtekoodi stringe.
- [x] Kõrvalised ruumifailid jäid puutumata.
- [x] Build, testid, i18n, lint, migratsiooniahel ja diff-check on sõltumatult kontrollitud.

### Soli otsus

**HEAKS KIIDETUD — A6.1 kooditee ja kontrollipakett vastavad pärast Soli parandusringi tööplaanile. Järelkontrolli lõpetamise hetkel olid commit/push/deploy tegemata.**

### 2026-07-14 — SOL — PARANDUSRING JA LÕPPKONTROLL VALMIS

- Etapp: sõltumatu järelkontroll, sihitud parandusring, koondkontroll ja teine read-only diff-review.
- Mudel ja effort: Sol 5.6; React/Next.js parandustes rakendati Verceli Reacti töövõtteid. Opuse algne teostus: Opus 4.8 Extra (`xhigh`).
- Loetud/kontrollitud: kogu A6.1 diff, tööplaan ja üleandmine; `TopicSeed` skeem/migratsioon; teenus ja kolm API-marsruuti; kliendi GET/POST/PATCH/queue voog; ET/EN/RU; neli TopicSeed testifaili; worktree piirid. Kaks sõltumatut read-only review'd ei leidnud lõppversioonist P1/P2 koodiviga.
- Soli esmases review's leitud ja parandatud:
  - „Salvestan mustandi ja väljun” salvestab nüüd päriselt ning lahkub ainult eduka vastuse järel;
  - pooleliolev DRAFT avaneb kadudeta samas kiire seemne vormis ja salvestub owner-only `PATCH /api/topic-seeds/[id]` kaudu;
  - PATCH on kohustusliku `expectedUpdatedAt` fingerprint'iga atomaarne; PATCH ja queue kasutavad sama `id + ownerId + DRAFT + updatedAt` tingimust, seega võidab täpselt üks;
  - malformed/null/array JSON ja valed JSON-tüübid annavad kontrollitud 400; segatud vigane `requestedSupport` ei lähe enam vaikides läbi;
  - avalikuks lähevad ainult whitelistitud veavõti + staatus, mitte suvaline `error.message`;
  - `requestedSupport @default([])` on skeemis migratsiooniga kooskõlas;
  - WAITING-kaart ja detail loevad ainult külmutatud `sharedCardSnapshot`-i, mitte live-välju;
  - create/edit ja queue vead on aktiivses vaates nähtavad; 409 säilitab vormi/modaali ja pakub värskendamist;
  - hiline GET ei kirjuta edukat POST/PATCH/queue tulemust üle; kõik päringud saadavad aktiivse `x-ui-locale`;
  - puudulik DRAFT ei ava queue-kinnitust, vaid suunab esmalt seemet täiendama;
  - käsitsi lõppreview's leitud võimatu share-error tingimus parandati ja kinnitati regressiooniga.
- Uus API/fail: `app/api/topic-seeds/[id]/route.js` (owner-only PATCH). Uus testifail: `tests/topicSeeds/topicSeedsServerContract.test.js`. Ülejäänud A6.1 faililoend on §17-s.
- Käivitatud kontrollid ja tulemused:
  - A6.1 sihttestid **51/51**;
  - `npm test` **866/866**;
  - `npm run i18n:check` OK;
  - scoped ESLint **0 viga** (64 ajaloolist hard-coded-string hoiatust, vähenenud Opuse 71-lt; täis-i18n on §12 non-goal);
  - `npx prisma validate` ja `npx prisma generate` OK;
  - `npm run db:migrate:check` OK: 80 migratsiooni värskes temp-DB-s;
  - eraldi migreeritud temp-DB -> `schema.prisma` diff ei sisaldanud ühtki `TopicSeed` muudatust (repo üldises diffs on A6.1-väliseid varasemaid lahknevusi);
  - `npm run build` OK, uus PATCH-marsruut registreeritud;
  - `git diff --check` puhas;
  - runtime-smoke: GET/POST collection, PATCH item ja POST queue autentimata -> **401** eestikeelse kontrollitud JSON-iga;
  - `requireCovisionRole` käitumistest: autentimata 401, CLIENT 403, SOCIAL_WORKER/SERVICE_PROVIDER lubatud.
- Jääkrisk: autenditud brauseri-e2e puudub; kliendiregressioonid on repo taristu tõttu valdavalt source-contract testid, mitte mountitud DOM-testid. See on dokumenteeritud ega blokeeri A6.1.
- A6.1-välised failid, mida ei tohi A6.1 commit'i lisada: `app/styles/covision.css`, `app/styles/panel.css`, `components/covision/CovisionSession.jsx`, `components/room/PanelFrame.jsx`; lisaks §14 ruumikaadrid, imagegen-väljundid ja `scripts/build-room-locked-frames.mjs`.
- Järgmine samm: soovi korral stage'i/commit'i/push'i ainult §17 A6.1 failid koos uue PATCH-marsruudi ja server-contract testiga. Deploy on eraldi otsus.
