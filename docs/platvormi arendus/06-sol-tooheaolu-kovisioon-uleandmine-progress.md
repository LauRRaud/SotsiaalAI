# 06 — Sol: Tööheaolu kinnitatud sisend → päris Kovisioon

> **Staatus:** SOL VALMIS — teostus commit'itud; Opuse sõltumatu järelkontroll on järgmine kvaliteedivärav
>
> **Mudel / effort:** Sol 5.6, Väga kõrge (tegelik kasutatud tase; mitte Ultra)
>
> **Alus:** `main` @ `e99bb716` (`Docs: add Opus review handoff for Kovisioon package`)
>
> **Alustatud:** 2026-07-14 06:14 EEST
>
> **Põhiroll:** **spetsialist (`SOCIAL_WORKER`)**; `ADMIN` jääb olemasoleva tööriistavärava tehniliseks erandiks. Pöörduja ja teenuseosutaja ei saa seda voogu kasutada.
>
> **Teostuse commit:** `9a46192b` (`Wellbeing: hand off confirmed drafts to Covision`)
>
> **Deploy:** ei kuulu sellesse töösse ja seda ei tehtud.

## 1. Miks just see töö

See on Fable'i auditi **B2/O7**: olemasoleva Tööheaolu kinnitatud `covision_input` mustandi päris üleandmine olemasolevasse Kovisiooni. See ei ole uus eraldiseisev moodul.

Praegune katkestus:

1. spetsialist saab Tööheaolus luua privaatse sisendi;
2. server viib selle olekusse `ready_to_share`;
3. UI nupp avab vaid üldise `/kovisioon` lehe;
4. kinnitatud tekstist ei teki juhtumit, sessiooni ega lähteviidet.

Valik on kõrge mõjuga, sest Kovisiooni päris andmestik ja sessioonivoo eeldused on nüüd valmis. Suurematest alternatiividest on JTA endiselt õigus- ja tooteotsuste taga ning häälvestlus vajab päris heliteenuste otsuseid. Pöörduja U3/U12 usalduspakett jääb järgmise tugeva terviklõiguna ootele.

## 2. Kohustuslikult loetud alus

- `docs/platvormi arendus/fable-5-platvormiloogika-ulevaade.md` — B2 tupik ja prioriteet.
- `docs/platvormi arendus/fable-5-platvormiloogika-max-taiendus.md` — O7 soovitatud üleandmine: liigub ainult kasutaja kinnitatud üldistus.
- `docs/platvormi arendus/05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md` — valmis Kovisiooni serveriseis ja privaatsuspiirid.
- `components/wellbeing/SupportRequestPanel.jsx` — aktiivne kliendivoog.
- `lib/wellbeing/supportDrafts.js` ja Tööheaolu API värav — aktiivne mustandi loomine/kinnitamine.
- `lib/covisionSession.js`, `lib/covision.js`, Kovisiooni skeem ja testid — olemasoleva juhtumi, osalise ja sessiooni leping.
- `prisma/schema.prisma` — `WellbeingOutputDraft`, `TopicSeed`, `CovisionCase` ja nende seosed.

## 3. Lukustatud tulemus

Valmis vertikaal peab tegema ühe teadliku nupuvajutusega järgmist:

1. võtta serverist omaniku **salvestatud lõplik** `editedText` (või selle puudumisel `generatedText`);
2. kontrollida, et mustand on `covision_input` + `covision` + `ready_to_share`, mõlemad eelnevad kinnitused on tõesed;
3. nõuda värsket `expectedUpdatedAt` sõrmejälge ja eraldi `confirmedNoIdentifiers: true` kinnitust;
4. luua samas advisory-lock'iga tehingus privaatne Kovisiooni juhtum, omaniku aktsepteeritud osalus, etapi 1 sessioon ja osalise sessiooniseis;
5. seostada mustand loodud juhtumiga 1:1 ning märkida üleandmise aeg;
6. tagastada loodud juhtum ja avada `/kovisioon?case=<id>`;
7. kordus- ja paralleelpäring peab tagastama sama juhtumi, mitte looma duplikaati.

Kinnitatud tekst on alguses ainult **omaniku privaatne `casePrefill`**. Server ei loo automaatselt jagatud etapi 2 `case_anchor` tööobjekti: see täidaks jagamisvärava enne Kovisiooni enda privaatsusrituaali. Omanik saab eeltäite etapis 2 üle vaadata ja jagab selle tavapärase `SUBMIT_WORK_ITEM` toiminguga.

### 3.1 Privaatsusleping

- Kliendi saadetud juhtumiteksti ei usaldata; sisu loetakse värskelt DB-st.
- Toor-Tööheaolu kirjet (`sourceRecordId`, skoorid, riskimarkerite lähteandmed) ei loeta ega kopeerita.
- Kovisiooni liigub ainult spetsialisti eelvaadatud ja kinnitatud üldistus.
- Võõras ja puuduv mustand annavad sama üldise 404.
- Pöörduja/teenuseosutaja saavad 403; tellimuseta spetsialist 402 olemasoleva värava kaudu.
- Avalik Kovisiooni payload ei väljasta lähte-mustandi ID-d ega Tööheaolu privaatseid välju.
- Suvalist `error.message` väärtust API-s ei avaldata: lubatud on ainult kontrollitud avalikud võtmed.
- Üleandmise tõrge veeretab tagasi kogu juhtumi, osalise, sessiooni ja seose loomise.
- Mustandi kinnitamine ja Kovisiooni üleandmine kasutavad sama `wellbeingOutputDraft:<id>` advisory-lock'i; kumbki ei saa vana snapshot'i põhjal teist üle kirjutada.
- Aktsepteeritud kutsutu ei näe omaniku `casePrefill` teksti; see väljastatakse ainult owner-rollile.

## 4. Teostusplaan ja hetkeseis

- [x] **Etapp 0 — rollide ja Fable'i auditi võrdlus.** Valitud spetsialist + B2/O7.
- [x] **Etapp 0 — aktiivse tupiku kontroll.** Kinnitatud mustand lõpeb pelga navigeerimisega.
- [x] **Etapp 0 — jätkamiskindel progressidokk loodud enne koodimuudatusi.**
- [x] **Etapp 1 — lõplik serveri- ja skeemileping.** 1:1 seos, ajatempel, idempotentsus; ankur jääb owner-private eeltäiteks.
- [x] **Etapp 2 — Prisma skeem + edasiühilduv migratsioon.** Nullable `covisionCaseId`/`handedOffAt`, unique FK `SET NULL`; backfill puudub.
- [x] **Etapp 3 — atomaarne serveriteenus.** Owner-only, versioonikindel, advisory-lock, rollback, idempotentsus ja serveripoolne tuvastajate kontroll.
- [x] **Etapp 4 — API.** Uus `POST /api/wellbeing/output-drafts/[id]/covision` olemasoleva rolli- ja tellimusvärava taga ning allowlistitud vead.
- [x] **Etapp 5 — klient + ET/EN/RU.** Teadlik lisakinnitus, kinnitamata lokaalsete muudatuste tõke, laadimis-/veaolek, täpse juhtumi avamine.
- [x] **Etapp 6 — testid.** Skeem, teenus, marsruut, kliendileping, privaatsus, sama mustandi versioonikindel salvestus ja paralleelsus; lõplik sihttulemus 48/48.
- [x] **Etapp 7 — sõltumatu järelkontroll.** Server/andmemudel, turva/privaatsus ja React/UI eraldi lugejatega; kõik P1/P2 leiud parandatud.
- [x] **Etapp 8 — täiskontroll.** Sihitud testid, `npm test`, i18n, lint, Prisma, migratsioon, build, diff-check ja runtime-smoke.
- [x] **Etapp 9 — lõpetamine.** Progressidoki lõppüleandmine, täpne commit ja Opuse ülevaatusjuhis; push tehakse koos selle lõppdokumendiga.

## 5. Kavandatav failiskoop

| Ala | Kavandatud failid |
|---|---|
| Skeem | `prisma/schema.prisma`, uus migratsioon |
| Server | `lib/wellbeing/supportDrafts.js` või eraldi kitsas üleandmisteenus; vajadusel jagatud Kovisiooni loomise helper |
| API | `app/api/wellbeing/output-drafts/[id]/covision/route.js` |
| Klient | `components/wellbeing/SupportRequestPanel.jsx` |
| Tekstid | `messages/et.json`, `messages/en.json`, `messages/ru.json` |
| Testid | uued sihttestid `tests/wellbeing/` all + vajalikud lepingutestid |

## 6. Kohustuslikud regressioonid

- [x] owner + korrektne kinnitatud mustand → üks privaatne juhtum;
- [x] kasutatakse `editedText` väärtust; selle puudumisel `generatedText`;
- [x] kliendi võltsitud tekst ja toor-kirje ei liigu juhtumisse;
- [x] puuduv/võõras ID → sama 404 ja null kirjutust;
- [x] vale `outputType`, `recipientType`, olek või kinnitus → 400/409 ja null kirjutust;
- [x] puuduv/vigane/aegunud `expectedUpdatedAt` → 409 ja null kirjutust;
- [x] puuduv `confirmedNoIdentifiers` → 400 ja null kirjutust;
- [x] kordusnupp ja juhitud paralleelpäring → üks juhtum;
- [x] tehingu keskel tekkinud viga → täielik rollback;
- [x] loodud juhtumil on owner-participant + etapi 1 sessioon + participant-state;
- [x] anonüümsuspiir: serialiseeritud Kovisioon ei sisalda lähte-mustandi ID-d;
- [x] klient kutsub uut endpoint'i sõrmejäljega ja avab täpselt `/kovisioon?case=<id>`;
- [x] vale roll/tellimus peatub enne teenuse kutset.

## 7. Tööpäevik

### 2026-07-14 06:14 EEST — valik ja kaardistus

- Võrreldi kolme rolli: pöörduja (U3/U12), spetsialist (B2/O7), teenuseosutaja (U4).
- Valiti spetsialisti B2/O7, sest see on kõige keerukam kõrge väärtusega töö, mille eeldused on valmis ja mille saab ilma välise teenuse või uue poliitikaotsuseta lõpuni ehitada.
- Kontrolliti aktiivset koodi: `ready_to_share` tekib; nupp ainult navigeerib; skeemis puudub 1:1 seos.
- Kasutaja kõrvalised ruumipiltide kustutused ja imagegen/script failid on väljaspool skoopi ning neid ei stage'ita.

### 2026-07-14 06:34 EEST — täisvertikaali esimene teostus

- Lisatud `WellbeingOutputDraft.covisionCaseId @unique`, `handedOffAt`, tagasiside ja edasiühilduv `20260714203000_wellbeing_covision_handoff` migratsioon.
- Lisatud jagatud `wellbeingOutputDraft:<id>` advisory-lock. Ka olemasolev mustandi kinnitamine kasutab nüüd sama lukku, värsket DB-kirjet, kohustuslikku `expectedUpdatedAt` sõrmejälge ja lõplikku CAS-i.
- Lisatud `startCovisionFromWellbeingDraft`: range owner-select ei loe `sourceRecordId` ega `WellbeingRecord` kirjet; kontrollib rolli, olekut, privaatsust, kahte eelnevat kinnitust, eraldi tuvastajate kinnitust ja serveripoolset tuvastajate detektorit.
- Sama tehing loob PRIVATE/ACTIVE juhtumi neutraalse pealkirjaga, OWNER+ACCEPTED osalise, etapi 1 sessiooni, participant-state'i ja omaniku privaatse etapi 2 eeltäite. Shared `case_anchor` jääb teadliku Kovisiooni toimingu taha.
- UI saadab ainult `{ expectedUpdatedAt, confirmedNoIdentifiers }`, ei saada teksti ega lähte-ID-d ning avab ainult serveri tagastatud `/kovisioon?case=<id>`.
- Kinnitatud teksti lokaalne muutmine peidab üleandmise ja nõuab uut serverikinnitust.
- ET/EN/RU pariteet lisatud.
- Sihitud teenuse-, privaatsus-, skeemi-, migratsiooni-, marsruudi- ja kliendilepingutestid: **40/40** roheline. Lisatud mõlemad deterministlikud järjestused: confirm→handoff ja handoff→confirm.
- Vahekontroll: muudetud failide ESLint 0 viga; `i18n:check` OK; `prisma validate` OK.

### 2026-07-14 — serveri sõltumatu järelkontroll

- P0/P1 leide ei olnud.
- Parandatud kaks P2 andmekvaliteedi leidu: kanooniline abivõti on `next_step` (mitte `next_steps`) ning püsipealkiri on locale-neutraalne pärisnimi `Kovisioon`, mitte kõigile keeltele salvestuv eestikeelne lause.

### 2026-07-14 — turva/privaatsuse sõltumatu järelkontroll

- Leiti üks P1: whitespace-only nähtav versioon oleks võinud kinnituse järel varjatult vana genereeritud teksti kasutada. Kinnitamine keelab nüüd tühja ja üle 4000 märgi teksti; regressioon katab kogu confirm→handoff ahela.
- Korduskontroll: P0/P1 blockereid ei jäänud. Owner/no-leak, roll/tellimus, raw-andmete mittelugemine, privaatne eeltäide, veafilter, lock + CAS + rollback + idempotentsus ja FK kustutamissemantika said eraldi kinnituse.

### 2026-07-14 — React/UI sõltumatu järelkontroll ja parandusring

- Teksti iga sisuline muutmine nullib nüüd `userReviewed`, `userConfirmed` ja Kovisiooni tuvastajate lisakinnituse; jagamisvärav nõuab uut kinnitust.
- Mustandi korduv salvestamine ei loo enam uusi ridu. Lisatud owner-scoped `PUT`, mis uuendab sama mustandit värske `expectedUpdatedAt` sõrmejäljega, kasutab sama advisory-lock'i ning viib muutunud kinnitatud mustandi turvaliselt tagasi `draft` olekusse.
- Ülevaate memo salvestab nüüd kasutaja tegeliku parandatud `memoText` väärtuse, mitte algset serveriteksti; 409 juhis ei luba ekslikku automaatset taastamist.
- Kovisiooni loomise ajal on kõik sama paneeli mutatsioonid ühe `isBusy` värava taga.
- Omaniku etapi 2 eeltäide avaneb vaikimisi privaatses režiimis. Hilisem prefill-värskendus ei kirjuta üle kasutaja teksti ega tema valitud jagamisrežiimi.
- Kolme toevaliku pealkirjad viidi ET/EN/RU sõnastikku.

### 2026-07-14 — lõppkontroll

- Sihitud testid **48/48**; sõltumatu turvapakett **74/74** ja React/UI auditipakett **70/70** olid rohelised.
- Kogu `npm test`: **1070/1070**.
- `i18n:check`: ET alus, EN/RU pariteet OK.
- Muudetud failide ESLint: **0 viga**; kogu repo lint: **0 viga, 359 varasemat hoiatust**.
- `prisma validate` ja `prisma generate`: OK.
- `db:migrate:check`: **87 migratsiooni**, uus migratsioon rakendus päris ajutises PostgreSQL andmebaasis, drift puudub.
- `npm run build`: Next.js 16.2.10, compiled successfully; uus `PUT` ja Kovisiooni handoff marsruut registreeritud.
- `git diff --check`: puhas (ainult Windowsi LF→CRLF teavitus).
- Runtime-smoke: autentimata `PUT /api/wellbeing/output-drafts/[id]` ja `POST .../[id]/covision` tagastasid mõlemad kontrollitud **401 `api.common.unauthorized`**; kontrollserver peatati ja port vabastati.

## 8. Jätkamiskoht (uuenda iga olulise sammu järel)

**Hetk:** teostus, kolm sõltumatut järelkontrolli ja kogu kontrollipakett on valmis. Teostuse commit on `9a46192b`. Deploy'd ei ole tehtud.

**Järgmine konkreetne samm:** Opus loeb selle dokumendi ja teeb §9 järgi sõltumatu järelkontrolli commit'ile `9a46192b`. Ta ei tee deploy'd ega sega kõrvalisi ruumifaile auditisse.

**Ära tee jätkamisel:** ära stage'i `public/room/frame-*.webp`, `output/imagegen/**` ega `scripts/build-room-locked-frames.mjs`; ära deploy.

## 9. Opuse hilisem järelkontroll

Pärast Soli lõppkontrolli peab Opus vaatama üle kogu selle töö, keskendudes:

1. Tööheaolu privaatse lähteinfo ja Kovisiooni jagatava sisu piirile;
2. advisory-lock'i, versioonikontrolli, idempotentsuse ja rollback'i tõele;
3. rolli/tellimuse/owner-only väravatele ning no-leak 404-le;
4. sellele, et Kovisiooni loodud sessioon vastab olemasoleva TopicSeed-voo invariandile;
5. kliendi topeltklõpsu, aegunud mustandi ja tõrkeoleku ausale UX-ile.

Opus ei tohi auditit lugeda pelgalt testide kinnitamisena: ta peab jälgima vähemalt kahte konkureerivat järjestust ja proovima leida tee, millega toor-Tööheaolu andmed või lähte-ID lekivad osalejale.
