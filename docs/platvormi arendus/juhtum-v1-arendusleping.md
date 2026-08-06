# ÜLESANNE: `JUHTUM-V1` — juhtumi objekt elutsükliga

**Olek:** `READY_TO_ASSIGN` — ükski otsus ei blokeeri ehitust. Lahtised otsused (O-JU-1…5) on
kirjas koos konservatiivse vaikeväärtusega, mille alt nad **avanevad lülitiga, mitte
ümberehitusega**.
**Perekond:** CASEWORK (P0–P6 on hõivatud; see on **CASEWORK-P7**).
**Teostus:** üks teema, etapid E1–E6, töö otse `main`-is (S11 reegel 1).
**Alus:** `SotsiaalAI.md` S4.1 „Juhtumi objekt elutsükliga" + „Juhtumitöö assistent" ·
`t21-casework-v1-ulesanne.md` (P0/P1 = jagatud päritolusõnastik ja adapterid, toodangus) ·
`fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md`.

---

## Miks see leping nüüd olemas on

Teema seisis alates 03.08 ühe vastamata küsimuse taga: **kui töötaja peab juhtumi seisu
ikkagi kuskil hoidma, kus ta seda täna hoiab?** Ilma vastuseta ei saanud otsustada, kas
juhtumi objekt lahendab päris probleemi või ehitab paralleelse kliendiregistri, mida platvormi
esimene „EI" keelab.

**Omanik vastas 06.08.2026:**

> „tal on oma documents ja igale kasutajale on ka veidi mahtu tagatud serveris."

See vastus on lepingu vundament ja ta ütleb kaks asja korraga. **Esiteks: koht on olemas** —
töötaja EI hoia juhtumi seisu STAR-is ega paberil, vaid platvormil, oma failides. Seega
juhtumi objekt ei too platvormile uut andmeliiki; ta annab struktuuri sellele, mis on juba
siin. **Teiseks: struktuuri ei ole** — ja see on mõõdetav, mitte arvamus.

---

## Lähteseis — mõõdetud koodist 06.08.2026

| Mõõt | Väärtus |
|---|---|
| Mudeleid skeemis | **166** (`SotsiaalAI.md` väidab 157 — aegunud) |
| Neist juhtumi objekti | **0** — `Case`, `CaseRecord`, `EcoMap`, `Method`, `InterventionLog` puuduvad; ainus `*Case` on `CovisionCase` (kovisiooni juhtumiarutelu, eri asi) |
| Juhtumi artefakte | 11 tüüpi `AgentArtifactType`-is (`CASE_SUMMARY`, `CASE_BRIEF`, `ACTION_PLAN`, `STAR_HELPER`, `PRE_ASSESSMENT_SUMMARY`, …) |
| Töötaja salvestusmaht | CLIENT 50 MB · SOCIAL_WORKER / SERVICE_PROVIDER 100 MB · päevane üleslaadimine 100 MB (`lib/storageGuardrails.js`) |
| Migratsioone | 128 |

**`UserDocument` on lame nimekiri.** Indeksid on `[ownerId, updatedAt]`,
`[ownerId, kind, updatedAt]`, `[ownerId, agentAllowed, updatedAt]`. Ainus struktuur terves
mudelis on `sourceDocumentId` — tuletusahel (originaal → kokkuvõte). Kausta, sildi, kliendi
ega juhtumi välja ei ole.

**`AgentArtifact` on sama lame.** Indeksid `[ownerId, type, updatedAt]` ja
`[ownerId, status, updatedAt]`; `status` on `DRAFT | FINAL` ja mitte midagi muud. **Kaks
`CASE_SUMMARY` artefakti kahe eri inimese kohta erinevad ainult pealkirja tekstis.**

**Sellest järeldub lepingu üks lause.** Platvorm oskab täna öelda, *millised* juhtumidokumendid
töötajal on. Ta ei oska öelda, **millisesse juhtumisse nad kuuluvad, kas juhtum on lahti või
kinni, mis on järgmine samm ja mis on puudu.** Neljakümne kliendiga töötaja jaoks on tänane
juhtumitugi üks ajaliselt järjestatud failiriba.

Ainus koht, kus täna elab töötaja „järgmine samm", on `PreInquiry.nextContactOn`
(vastuvõtulaud). See on ühe pöördumise, mitte juhtumi omadus, ja ta kaob, kui pöördumine on
menetletud.

---

## Mis JUHTUM-V1 on

**Juhtum on õhuke selgroog töötaja enda töökorralduse jaoks: silt, elutsükkel, järgmine samm,
puuduva info loend — ja viited sellele, mis on juba olemas.** Ta ei kopeeri ühtegi rida
dokumendist ega artefaktist; ta ütleb, et need kuuluvad kokku.

## Mis JUHTUM-V1 EI ole

- **Ei ole kliendiregister.** Juhtumil ei ole isikuvälju: ei nime, isikukoodi, sünniaega,
  aadressi, diagnoosi ega terviseandmete lahtrit. Kandev väli on `label` — **töötaja enda
  viide**, mille sisu valib tema (võib olla „Perekond T., 3 last" või „STAR 12345").
- **Ei ole STAR-i vari.** Ametlik kandja ei teki platvormil kunagi. Pärast STAR-i kandmist
  muutub ülekantud mustand kirjutuskaitstuks — teist aktiivset koopiat ei hoita.
- **Ei ole kliendi vaade.** Juhtum on töötaja töökorraldus; kliendi enda lugu on Teekond ja
  need kaks ei ole sama objekt. Klient ei näe juhtumit ega tea tema olemasolust.
- **Ei ole ülesandesüsteem.** Mitmepoolne „ülesanne vastutajaga" on COLLAB objektiklass 8
  (dubleerimiskeeld). Juhtumi `nextAction` on ühe töötaja enda märge iseendale.
- **Ei ole assistent.** Assistent (S4.1) ehitatakse SELLE peale, eraldi lepinguga.

---

## Aus riskilause, mida ei tohi ilustada

`label` on vabatekst ja praktikas kirjutab töötaja sinna inimese nime. **Juhtum kannab
isikuandmeid ka siis, kui skeemis ei ole ühtegi isikuvälja** — ja leping, mis seda eitab, on
vale leping.

Sellepärast kehtib juhtumile sama kaitse, mis kannab täna tööheaolu ja kovisiooni:
serveripoolne omanikupiir, mille alt **ka administraator ei näe sisu**, ning säilitusaeg, mis
algab sulgemisest. Õiguslik alus on olemas ja teda ei leiutata siin juurde: spetsialistil on
`WORKER_DATA_PROCESSING` raamleping (`lib/frameworkAcceptances.js`), mille järgi organisatsioon
on vastutav töötleja ja platvorm volitatud töötleja. **Sama alus, mis kannab täna tema
dokumente, kannab ka juhtumi silti** — juhtum ei laienda töötlust, ta korrastab selle.

---

## Lukustatud otsused (ei avata uuesti)

| # | Otsus | Miks |
|---|---|---|
| L1 | **Juhtum on rangelt omaniku-skoobitud (fail-closed).** Ligipääs käib `ownerUserId` järgi, admin ei näe sisu | sama muster mis tööheaolu ja kovisioon; laiendamine (üksus, üleandmine) on **additiivne** ja tuleb O-JU-3 all, mitte enne |
| L2 | **Sidumine ei laienda kunagi ligipääsu.** `CaseLink` on viit; õigus kontrollitakse alati sihtobjektil, mitte lingil | muidu muutub juhtum ligipääsu-augu masinaks: „lingin võõra dokumendi ja näen teda" |
| L3 | **Siduda saab ainult seda, mida omanik juba näeb.** Sidumise loomine kontrollib sihtobjekti omandit serveris | sama põhjus |
| L4 | **Päritolusõnastik on olemasolev** `lib/workspaces/provenance.js` (8 väärtust, CASEWORK-P0). Uut ei looda | T21 õppetund: FIELD lõi teise sõnastiku ja seda tuli tagasi konsolideerida |
| L5 | **Sulgemine nõuab põhjust** ja suletud juhtum on kirjutuskaitstud | „vaikselt kadunud juhtum" on sama viga mis vaikiv tõrge mujal platvormil |
| L6 | **Juhtum ei emiteeri U1 sündmusi V1-s** ega saada ühtegi teavitust | ta on ühe inimese privaatne töökorraldus; teavitus tähendaks teist osapoolt |
| L7 | **0 automaatset juhtumi loomist.** Juhtumi loob alati inimene | automaatne loomine eelpöördumisest tekitaks juhtumeid inimestest, keda töötaja ei ole veel vaadanud |

---

## Lahtised otsused — ükski ei blokeeri ehitust

Iga rida kannab vaikeväärtust, mille alt ehitatakse. Vaikeväärtus on konservatiivne: teda saab
hiljem **avada**, mitte tagasi võtta.

| # | Küsimus | Vaikeväärtus V1-s | Mis muutub, kui otsus tuleb |
|---|---|---|---|
| **O-JU-1** | Säilitusaeg pärast sulgemist | kirjeid **ei kustutata automaatselt**; suletud juhtum jääb omanikule nähtavaks ja kustutatavaks | lisandub retention-töö, väli on juba olemas (`closedAt`) |
| **O-JU-2** | Kas juhtum tohib kanda eraldi kliendiviite välja (nt STAR-i number) | **ei** — ainult vabatekstiline `label` | additiivne väli + eraldi kuvamine |
| **O-JU-3** | Kas juhtum on üleantav üksusele või kolleegile | **ei** — rangelt isiklik | omanikuvahetuse rada + auditijälg (muster olemas: `ROOM_OWNERSHIP_TRANSFERRED`) |
| **O-JU-4** | Kas suletud juhtum läheb meetodipeeglisse | **ei** automaatselt; töötaja viib ise | seos `lib/reflection/` kirjega |
| **O-JU-5** | Kas juhtumil on tähtaja-meeldetuletus | **ei** — `nextActionAt` on kuupäev vaates, mitte teavitus | L6 avaneb koos sellega |

---

## Teostus

### E1 — Selgroog: mudel ja elutsükkel

- `CaseRecord`: `id` · `ownerUserId` · `label` · `status` · `openedAt` · `closedAt` ·
  `closeReason` · `nextActionAt` · `nextActionNote` · `createdAt` · `updatedAt`.
- Elutsükkel (S4.1: juhtum → plaan → tegevused → ülevaatus → sulgemine):
  `OPEN → IN_PROGRESS → REVIEW → CLOSED`. Siirded on ühesuunalised, v.a `CLOSED → IN_PROGRESS`
  (taasavamine), mis nõuab põhjust ja jääb auditisse.
- Teenuskiht `lib/casework/caseRecord.js` — **uus kaust**; `lib/casework/` täna EI OLE olemas
  (genogrammi leping viitab talle kui olemasolevale — see viide on aegunud, paranda oma
  raportis).
- Omanikupiir jõustatud teenuskihis, mitte marsruudis.

### E2 — Sidumine olemasolevaga (0 koopiat)

- `CaseLink`: `caseId` · `targetType` · `targetId` · `createdAt`, unikaalne kolmik.
- `targetType` V1-s: `USER_DOCUMENT` · `AGENT_ARTIFACT` · `PRE_INQUIRY` · `FIELD_VISIT`.
- L2 ja L3 on **testiga lukus**, mitte kommentaariga.
- Sihtobjekti kustutamine ei jäta rippuvat linki.

### E3 — Puuduv info ja järgmine samm

- `CaseOpenItem`: `caseId` · `text` · `provenance` (L4 sõnastikust) · `status`
  (`OPEN | RESOLVED | NOT_APPLICABLE`) · `resolvedAt`.
- See on täpselt see, mida S4.1 assistent nimetab „puuduva ja kontrollimist vajava info
  loendiks" — assistent hakkab teda lugema, mitte uuesti looma.

### E4 — Väravad ja sulgemine

- Sulgemine: kohustuslik `closeReason`, `closedAt`, kirje muutub kirjutuskaitstuks (L5).
- Suletud juhtumi all ei saa luua uut linki ega avatud punkti.
- Taasavamine on eraldi toiming oma põhjusega.

### E5 — Vaade „Minu juhtumid"

- Loend: silt, seis, järgmine samm, avatud punktide arv, viimane muudatus.
- Ühe juhtumi vaade: seotud dokumendid ja artefaktid päritolumärgisega, avatud punktid,
  elutsükli nupud.
- Keeleregister on „mustand / ettevalmistus", **mitte** „menetlus" ega „ametlik esitamine"
  (T21 R8, sama piir).
- ET/EN/RU pariteet; `npm run i18n:check` roheline.

### E6 — Tõend

- **Sond `npm run case:probe` päris andmebaasi vastu.** Fake-prisma ei valideeri skeemi ega
  tõenda ligipääsupiiri — see on 04.08 IDOR-i õppetund ja seda ei korrata.
- Sond tõendab nimeliselt: võõras töötaja ei näe juhtumit · võõra dokumendi sidumine
  keeldub · suletud juhtumi kirjutamine keeldub · kustutus ei jäta rippuvat linki ·
  sond koristab ENDA järelt ja **kontrollib koristust**, mitte ei eelda seda (A4 õppetund).
- Kaks päris sessiooni (`ai.specialist.a`, `ai.specialist.b`, PIN `45671234`), eraldi
  küpsisefailid.

---

## Selgelt väljas

Juhtumitöö assistent ja tema töölaud · STAR2 olekurada ja „Kopeeri STAR2 jaoks" (CASEWORK-P2,
vajab O-CW-2/4/10) · genogramm ja ökokaart (P4/P5, oma leping) · meetodite kataloog (P6) ·
sekkumispäevik · juhtumi jagamine võrgustikule · teavitused · merge ja deploy.

---

## Nõutud testilepingud

1. **Omanikupiir:** võõras kasutaja saab juhtumile 0 rida; admin ei näe sisu.
2. **L2 sidumine ei laienda:** lingitud võõra objekti lugemine keeldub ka siis, kui link on
   andmebaasis olemas (kirjuta link otse, siis loe API kaudu).
3. **L3 sidumise loomine:** võõra `targetId`-ga sidumine → keeldumine, mitte vaikne lisamine.
4. **L5 sulgemine:** suletud juhtumi muutmine keeldub; sulgemine ilma põhjuseta keeldub.
5. **Elutsükkel:** lubamatu siire keeldub; taasavamine nõuab põhjust.
6. **L4 üks sõnastik:** `CaseOpenItem.provenance` valideeritakse `lib/workspaces/provenance.js`
   vastu; tundmatu väärtus lükatakse tagasi.
7. **Rippuv link:** sihtobjekti kustutamine eemaldab lingi.
8. **i18n:** ET/EN/RU pariteet, 0 hard-coded JSX-teksti.

---

## Väravad ja DoD

`npm test` · `npm run i18n:check` · eslint muudetud failidel · `npm run db:migrate:check`
(skeemimuudatus — **kohustuslik**) · `npm run build` · **`npm run case:probe` päris DB vastu**.

**Skeemimuudatuse järel:** `prisma generate` + dev-serveri restart + üks päris päring. Roheline
sviit fake-prismaga ei tõenda siin midagi. Kui pordil 3000 käib võõra sessiooni dev-server,
hoiab ta vana Prisma klienti — kasuta `next start -p 3100` retsepti (S11).

**Valmis on siis, kui** E1–E6 on `main`-is, sond on roheline päris andmebaasi vastu, kaks
töötajat on üksteise juhtumitest tõendatult pimedad, ja `SotsiaalAI.md` S4.1 rida „Juhtumi
objekt elutsükliga" on liikunud TEGEMATA → TEHTUD koos sellega, mis jäi lahtiseks.

Merge ja deploy ainult omaniku selgel loal.

---

## Lõpetamisel

Uuenda **ainult** `SotsiaalAI.md`: S4.1 juhtumi objekti ja juhtumitöö assistendi read (viimane
saab uue blokeerija-lause: „objekt on olemas, assistent vajab oma lepingut"), S5 „Poolik"
juhtumitoe rida, S4.3 paketiperekond CASEWORK. Konkureerivat seisufaili ei looda.
