# ÜLESANNE: `JUHTUM-V1` — juhtumi objekt elutsükliga (`CaseWorkAssist`)

**Olek:** `READY_TO_ASSIGN`.
**Perekond:** CASEWORK — **P7**. Ei ole P0/P1 (tehtud) ega P2 (vt piir allpool).
**Teostus:** üks teema, etapid E1–E6, töö otse `main`-is (S11 reegel 1). Migratsioon: jah.
**Kirjeldus („mis asi see on"):** `ideed.md` **ptk 4** (Juhtumitöö assistent) ja **ptk 12**
(kontseptuaalne andmemudel) — **loe mõlemad enne E1-e**.
**Muu alus:** `t21-casework-v1-ulesanne.md` (P0/P1 tehtud) · `SotsiaalAI.md` S4.1.

> **Parandus 06.08.** Selle lepingu esimene versioon kirjutati ilma `ideed.md`-d lugemata ja
> leiutas oma mudeli (`CaseRecord`, `CaseLink`, `CaseOpenItem`) ning oma elutsükli
> (`OPEN → IN_PROGRESS → REVIEW → CLOSED`). Kirjeldus oli olemas ja ta on täpsem: objekt on
> **`CaseWorkAssist`**, elutsükkel istub **mustandi, mitte juhtumi peal**, ja kaks „lahtist
> otsust" olid tegelikult juba otsustatud. See versioon on joondatud kirjeldusega.

---

## Miks see leping nüüd olemas on

Teema seisis alates 03.08 ühe vastamata küsimuse taga: **kui töötaja peab juhtumi seisu ikkagi
kuskil hoidma, kus ta seda täna hoiab?** **Omanik vastas 06.08.2026:**

> „tal on oma documents ja igale kasutajale on ka veidi mahtu tagatud serveris."

Vastus ütleb kaks asja. **Koht on olemas** — juhtumi objekt ei too platvormile uut andmeliiki.
**Struktuuri ei ole** — ja see on mõõdetud.

## Lähteseis — mõõdetud koodist 06.08.2026

| Mõõt | Väärtus |
|---|---|
| Mudeleid skeemis | **166** (`SotsiaalAI.md` väitis 157 — parandatud) |
| `CaseWork*` mudeleid | **0** — ükski ptk 12 nimi ei ole koodis |
| Juhtumi artefakte | 11 tüüpi `AgentArtifactType`-is |
| Töötaja salvestusmaht | SOCIAL_WORKER / SERVICE_PROVIDER 100 MB (`lib/storageGuardrails.js`) |
| Migratsioone | 128 |

**`UserDocument` ja `AgentArtifact` on mõlemad lamedad ja owner-skoobitud.** Indeksid ainult
muutmisaja järgi; kummalgi ei ole ühtki välja, mis viitaks juhtumile või inimesele. **Kaks
`CASE_SUMMARY` artefakti kahe eri inimese kohta erinevad ainult pealkirja tekstis.**

T21 P0 adapter kinnitab seda oma koodis — `listCaseArtifacts` on
`orderBy updatedAt desc, take: 100`. **T21 tegi lameda nimekirja kirjeldatavaks; korrastatuks
ta teda ei teinud.**

Ainus koht, kus täna elab töötaja „järgmine kontakt", on `PreInquiry.nextContactOn` — ühe
pöördumise omadus, mis kaob koos pöördumise menetlemisega.

---

## Piir CASEWORK-P2 vastu (OLULINE — ära neela teist paketti)

`ideed.md` ptk 4.5 kirjeldab **mustandi ülekandeahelat**: kaheksa elementi (pöördumise
kokkuvõte, abivajaduse hindamise mustand, eluvaldkonna kirjeldus, eesmärgi sõnastus, tegevus,
vastutaja ja tähtaeg, kohtumise märge, teenuse suunamise alus), igaüks seitsmes seisus
(*mustand → vajab kliendiga kontrollimist → vajab dokumenti või registripäringut → töötaja
kontrollitud → valmis kandmiseks → kantud → ei kanta*).

**See on CASEWORK-P2 ja ta EI kuulu siia.** T21 leping jättis ta teadlikult välja, sest ta
vajab O-CW-2 (ülekande retention), O-CW-4 (olekute salvestus) ja O-CW-10 (ekspordi
auditisügavus). Need otsused on endiselt lahtised.

**Tööjaotus on seega puhas:**

| Pakett | Mis | Seis |
|---|---|---|
| **P7 (see leping)** | **konteiner** — juhtum, mille külge asjad käivad | otsustevaba |
| P2 | **mustandi ülekandeahel** — 8 elementi × 7 seisu | 3 otsuse taga |

Mustandeid ise hoiab juba `AgentArtifact` (DRAFT/FINAL, 11 tüüpi). **P7 ei loo mustandile
teist keha** — ta annab talle koha, kuhu kuuluda.

---

## Sidumiskaart — mis on tekkinud pärast kirjeldust

`ideed.md` ptk 4 ja 12 on kirjutatud enne 11.07. Vahepeal on platvorm kasvanud ja **kirjeldus
ei tea sellest midagi** — ta ei ole vale, ta on lihtsalt varasem. Need on haakepunktid, mis on
täna päriselt koodis (kontrollitud 06.08), ja see, mida igaüks lepingus muudab.

| # | Mis on vahepeal tekkinud | Mida see siin muudab |
|---|---|---|
| **1** | **K1 tööruumiregister** — `lib/workspaces/registry.js` kannab `WorkspaceKind.CASE_WORK` seisus **RESERVED** | **uus etapp E5.** Register ootab seda objekti; JUHTUM-V1 lülitab ta `SUPPORTED`-iks koos adapteriga |
| **2** | **Kliendi kahe raja muster** (omaniku otsus 04.08) — `ServiceReferral` ja `NetworkShare` kannavad mõlemad `clientUserId?` / `clientDisplayName?` / `clientExternalRef?` / `clientErasedAt?` | **muudab E1.** Leiutatud vabatekstiline `label` asendub platvormi olemasoleva miinimumkujuga |
| **3** | **`UrgentRequest`** (SK-V1, 05.08) — teine sissetulekukanal | ptk 12 tunneb ainult `preInquiryId`; juhtum peab sündima ka kiireloomulisest abipalvest |
| **4** | **`NetworkShare`** (COLLAB-P4, 04.08) — jagamised on ankurdatud `sourcePreInquiryId` külge | juhtum on nende loomulik konteiner; ta laenab ka mustrit „jagamispiir + kohustuslik lõppkuupäev" |
| **5** | **`ServiceReferral` + Teenuspäevik** (`lib/serviceLog/`, 30 moodulit) | ptk 4.5 „teenuse suunamise alus" ei ole enam ainult mustandi element, vaid päris objekt |
| **6** | **A4 tegevusloa märgis** (05.08) | kui juhtum viitab teenusele, on osutaja loaseis kontrollitav — aga ainult `lib/mtr/licenceSignal.js` piiratud kujul: seis jah, kontrolliajalugu ei |

### Kaks seost, mis vajavad suunda, mitte ainult viita

**Kovisioon.** Ptk 4.2 küsib „kas juhtum vajab kovisiooni". Kovisioon on nüüd olemas, aga tema
teemaseeme on **teadlikult deidentifitseeritud**. Seos tohib olla **ühesuunaline**: juhtumist
saab kovisiooni ettevalmistuse algatada, **kovisiooni objektilt ei tohi juhtumile tagasi
viidata** — muidu muutub deidentifitseerimine kosmeetikaks.

**Meetodipeegel.** Seos käib olemasolevast `PracticeReflection.sourceKind`/`sourceId`-st
(L10), mitte uuest võtmest.

### Teadlikud MITTE-seosed (sama tähtsad kui seosed)

| Mis | Miks mitte |
|---|---|
| **Teekond** | kliendi enda lugu, kuulub temale; juhtum on töötaja töökorraldus. Kaks eri objekti, mida ei ühendata |
| **Tööheaolu** | töötaja privaatne ruum. Juhtumiga sidumine muudaks ta koormuse mõõdikuks — täpselt see, mida arhitektuur keelab |
| **A2 kalkulaator** | arvutus käib inimese seadmes ja midagi ei salvestu; seosepunkti ei ole olemas |

---

## Mis JUHTUM-V1 on

`CaseWorkAssist` on **töötaja enda töökorralduse konteiner**: mille ümber see töö käib, mis on
järgmine kontakt, mis on puudu, mis on STAR-i viide, ja mis sellega lõpuks juhtub. Ta seob
kokku selle, mis on juba olemas, ja ei kopeeri ühtegi rida.

## Mis JUHTUM-V1 EI ole

- **Ei ole kliendiregister.** Isikuvälju ei ole: ei nime, isikukoodi, sünniaega, aadressi ega
  terviseandmete lahtrit. Kandev väli on `label` — töötaja enda viide.
- **Ei ole STAR-i vari** (ptk 4.7). Pärast STAR-i kandmist ei hoita teist aktiivset koopiat.
- **Ei ole kliendi vaade.** Kliendi enda lugu on Teekond; klient ei näe juhtumit.
- **Ei ole ülesandesüsteem.** Mitmepoolne „ülesanne vastutajaga" on COLLAB objektiklass 8.
- **Ei ole assistendi töölaud** (ptk 4.3) ega kohtumise ettevalmistus (ptk 4.4) — need on
  järgmine leping ja nad hakkavad seda objekti **lugema**, mitte uuesti looma.

---

## Aus riskilause, mida ei tohi ilustada

**Juhtum kannab isikuandmeid** — ja leping, mis seda eitab, on vale leping. Lepingu eelmine
versioon lahendas selle halvasti: ta pani sinna vabatekstilise `label`-i ja tunnistas ausalt,
et töötaja kirjutab sinna nime. Aus, aga vale — **platvormil on selle jaoks juba kanooniline
kuju** (L11) ja vabatekst oleks olnud kolmas paralleelne viis sama asja teha.

Nüüd on klient esindatud sama mustriga, mis kannab `ServiceReferral`-i ja `NetworkShare`-i:
kas platvormi kasutajana või **miinimumkujul** — kuvanimi võib olla initsiaal või roll, mitte
täisandmestik. See ei kaota riski ära, aga ta teeb temast mõõdetava ja kustutatava
(`clientErasedAt`) suuruse vabatekstiväljas peituva asemel.

Sellepärast kehtib juhtumile sama kaitse, mis kannab täna tööheaolu ja kovisiooni:
serveripoolne omanikupiir, mille alt **ka administraator ei näe sisu**. Õiguslikku alust juurde
ei leiutata: spetsialistil on `WORKER_DATA_PROCESSING` raamleping
(`lib/frameworkAcceptances.js`), mille järgi organisatsioon on vastutav töötleja ja platvorm
volitatud töötleja. **Sama alus, mis kannab täna tema dokumente, kannab ka juhtumi silti** —
juhtum ei laienda töötlust, ta korrastab selle.

---

## Lukustatud otsused (ei avata uuesti)

| # | Otsus | Alus |
|---|---|---|
| L1 | **Nimed tulevad kirjeldusest, mitte leiutatakse.** `CaseWorkAssist`, `CaseWorkMissingInfo` | ptk 12 |
| L2 | **Rangelt omaniku-skoobitud (fail-closed)**; admin ei näe sisu | `ownerUserId` ptk 12; tööheaolu/kovisiooni muster |
| L3 | **Sidumine ei laienda kunagi ligipääsu.** Seos on viit; õigus kontrollitakse alati sihtobjektil | ligipääsupiiri põhireegel |
| L4 | **Siduda saab ainult seda, mida omanik juba näeb** — kontroll serveris | sama |
| L5 | **Päritolusõnastik on olemasolev** `lib/workspaces/provenance.js` (8 väärtust) | ptk 4.4; T21 P0 |
| L6 | **STAR-i viide kuulub objekti külge** (`externalSystem`, `externalReference`) | ptk 12 + ptk 4.7 („STAR2 viitenumbri") — **see ei ole lahtine otsus** |
| L7 | **`retentionState` on väli algusest peale**; kolm väärtust ptk 4.7 järgi: `ACTIVE` · `READ_ONLY` · `ARCHIVED` | ptk 12 + 4.7 |
| L8 | **0 automaatset loomist.** Juhtumi loob alati inimene | muidu tekiks juhtumeid inimestest, keda töötaja pole vaadanudki |
| L9 | **0 U1 sündmust, 0 teavitust V1-s** | ühe inimese privaatne töökorraldus |
| L10 | **Meetodipeegli seos käib olemasolevast `PracticeReflection.sourceKind`/`sourceId`-st** — uut võtit ei lisata | mudel on koodis, seam olemas |
| L11 | **Klienti esindab kahe raja muster, mitte vabatekst.** `clientUserId?` (platvormi kasutaja) VÕI miinimumkuju `clientDisplayName?` (initsiaal või roll) + `clientExternalRef?`; kustutus `clientErasedAt?` | omaniku otsus 04.08; `ServiceReferral` ja `NetworkShare` kannavad juba sama mustrit. Kolmas koopia oleks kolmas tõde |
| L12 | **Kovisiooni seos on ühesuunaline** — juhtumist seemneni jah, seemnest juhtumini mitte | teemaseeme on deidentifitseeritud; tagasiviide tühistaks selle |
| L13 | **K1 register saab adapteri, mitte teise juhtumi mõiste** — `WorkspaceKind.CASE_WORK` `RESERVED → SUPPORTED` | sama käik, mille `ORG_SPACE` tegi (registri kommentaar): üks kanooniline ajajoone- ja auditivõti |

---

## Lahtised otsused — ükski ei blokeeri ehitust

| # | Küsimus | Vaikeväärtus V1-s |
|---|---|---|
| **O-JU-1** | Säilitusreegel: millal `ACTIVE → READ_ONLY → ARCHIVED` ja kas kustub | väli on olemas, **automaatikat ei ole**; siirde teeb inimene. Sama küsimus mis O-CW-2 — küsi koos |
| **O-JU-2** | Kas juhtum on üleantav kolleegile või üksusele | **ei** — rangelt isiklik. Laiendamine on additiivne, kitsendamine ei ole |
| **O-JU-3** | Kas juhtum tekib eelpöördumisest ühe vajutusega | **ei** V1-s (L8 jääb); `preInquiryId` on olemas, nupp mitte |

---

## Teostus

### E1 — `CaseWorkAssist` (konteiner)

Väljad ptk 12 järgi, **pluss sidumiskaardi punkt 2** (kliendi kahe raja muster):

- `id` · `ownerUserId` · `preInquiryId?` · `urgentRequestId?` (sidumiskaart 3) ·
  `clientUserId?` · `clientDisplayName?` · `clientExternalRef?` · `clientErasedAt?` ·
  `externalSystem?` (`STAR2`) · `externalReference?` · `nextContactAt?` ·
  `retentionState` (L7) · `createdAt` · `updatedAt`.
- **`label`-välja ei ole.** Kirjeldus ütles „juhtumi viide" ja lepingu eelmine versioon tegi
  sellest vabateksti. Platvormil on selle jaoks juba kanooniline kuju ja seda ei leiutata
  uuesti — vt L11.
- Teenuskiht `lib/casework/caseWorkAssist.js` — **uus kaust**; `lib/casework/` täna EI OLE
  olemas. Genogrammi leping viitab talle kui olemasolevale — **see viide on aegunud, paranda
  oma raportis.**
- Omanikupiir jõustatud teenuskihis, mitte marsruudis.
- `READ_ONLY` ja `ARCHIVED` keelavad kirjutamise; siire nõuab põhjust ja jääb auditisse.

### E2 — Sidumine olemasolevaga (0 koopiat)

- `CaseWorkItem`: `caseWorkAssistId` · `targetType` · `targetId` · `createdAt`, unikaalne kolmik.
- `targetType` V1-s: `USER_DOCUMENT` · `AGENT_ARTIFACT` · `PRE_INQUIRY` · `FIELD_VISIT` ·
  **`URGENT_REQUEST`** (sidumiskaart 3) · **`NETWORK_SHARE`** (sidumiskaart 4) ·
  **`SERVICE_REFERRAL`** (sidumiskaart 5).
- **L3 ja L4 on testiga lukus, mitte kommentaariga.**
- Sihtobjekti kustutamine ei jäta rippuvat viidet.
- **Mustandi ülekande seisu siia EI salvestata** — see on P2 (vt piir ülal).

### E3 — `CaseWorkMissingInfo`

- `caseWorkAssistId` · `text` · `provenance` (L5 sõnastikust) · `status`
  (`OPEN | RESOLVED | NOT_APPLICABLE`) · `resolvedAt`.
- See on ptk 4.3 „puuduv ja kontrollimist vajav info" ja ptk 4.4 „puuduva info loend" —
  assistent hakkab teda lugema, mitte uuesti looma.

### E4 — K1 tööruumiregistri adapter (sidumiskaart 1)

- `lib/workspaces/adapters/caseWorkAdapter.js` — read-only, omaniku-skoobitud, tagastab
  `WorkspaceDescriptor[]` (muster: `orgSpaceAdapter.js`, `fieldVisitAdapter.js`).
- `registry.js`: `WorkspaceKind.CASE_WORK` `RESERVED → SUPPORTED` koos adapteri nimega.
- **Miks see etapp olemas on:** register kannab `CASE_WORK`-i juba täna reserveeritud kujul.
  `ORG_SPACE` kommentaar registris ütleb, miks see oluline on — reserveeritud võti tähendab, et
  objektil on **üks kanooniline ajajoone- ja auditivõti** (`workspaceKind` + `workspaceId`) ja
  teist paralleelset mõistet ei teki. Kui JUHTUM-V1 selle vahele jätaks, tekiks juhtum, mida
  platvormi enda tööruumikiht ei tunne.
- `SUPPORTED_WORKSPACE_KINDS` muutub — kontrolli, et olemasolevad testid seda arvestavad.

### E5 — Vaade „Minu juhtumid"

- Loend: silt, järgmine kontakt, avatud punktide arv, retention-seis, viimane muudatus.
- Ühe juhtumi vaade: seotud dokumendid ja artefaktid päritolumärgisega, avatud punktid,
  STAR-i viide.
- Keeleregister „mustand / ettevalmistus", **mitte** „menetlus" (T21 R8, sama piir).
- ET/EN/RU pariteet.
- **NB `listCaseArtifacts` on `take: 100` ilma pagineerimiseta** — juhtumivaates kaoks 101.
  artefakt vaikselt. Kas pagineeri või piira päring juhtumi seotud ridadega.

### E6 — Tõend

- **Sond `npm run case:probe` päris andmebaasi vastu.** Fake-prisma ei valideeri skeemi ega
  tõenda ligipääsupiiri (04.08 IDOR-i õppetund).
- Sond tõendab nimeliselt: võõras töötaja ei näe juhtumit · võõra dokumendi sidumine
  keeldub · `READ_ONLY` juhtumi kirjutamine keeldub · kustutus ei jäta rippuvat viidet ·
  sond koristab enda järelt ja **kontrollib koristust**, mitte ei eelda seda (A4 õppetund).
- Kaks päris sessiooni (`ai.specialist.a`, `ai.specialist.b`, PIN `45671234`), eraldi
  küpsisefailid.

---

## Selgelt väljas

Assistendi töölaud (ptk 4.3) · kohtumise ettevalmistus ja märkmete kihid (ptk 4.4) ·
**mustandi ülekandeahel (ptk 4.5 = CASEWORK-P2)** · STAR2 liidestus (ptk 4.8) · genogramm ja
ökokaart (P4/P5) · meetodite kataloog (P6) · sekkumispäevik · juhtumi jagamine võrgustikule ·
teavitused · merge ja deploy.

---

## Nõutud testilepingud

1. **Omanikupiir:** võõras kasutaja saab 0 rida; admin ei näe sisu.
2. **L3 ei laienda:** lingitud võõra objekti lugemine keeldub ka siis, kui viit on
   andmebaasis olemas (kirjuta viit otse, loe API kaudu).
3. **L4 loomine:** võõra `targetId`-ga sidumine → keeldumine, mitte vaikne lisamine.
4. **L7 retention:** `READ_ONLY` ja `ARCHIVED` juhtumi muutmine keeldub; siire nõuab põhjust.
5. **L5 üks sõnastik:** `CaseWorkMissingInfo.provenance` valideeritakse
   `lib/workspaces/provenance.js` vastu; tundmatu väärtus lükatakse tagasi.
6. **Rippuv viit:** sihtobjekti kustutamine eemaldab seose.
7. **P2 piir:** `CaseWorkItem`-il ei ole ülekande- ega ülevaatuse seisu välja.
8. **L11 kliendi muster:** kirje, millel on korraga `clientUserId` ja `clientDisplayName`,
   lükatakse tagasi; `clientErasedAt` peidab miinimumkuju väljad lugemisrajal.
9. **L13 K1:** `CASE_WORK` on `SUPPORTED` ja tal on adapter; adapter on omaniku-skoobitud
   (võõras → tühi) ja tagastab kehtiva `WorkspaceDescriptor`-i.
10. **L12 kovisiooni suund:** juhtumilt seemneni viit on lubatud; seemnelt juhtumile viidet
    ei eksisteeri üheski mudelis ega vastuses.
11. **i18n:** ET/EN/RU pariteet, 0 hard-coded JSX-teksti.

---

## Väravad ja DoD

`npm test` · `npm run i18n:check` · eslint muudetud failidel · `npm run db:migrate:check` ·
`npm run build` · **`npm run case:probe` päris DB vastu**.

**Skeemimuudatuse järel:** `prisma generate` + dev-serveri restart + üks päris päring. Roheline
sviit fake-prismaga ei tõenda siin midagi. Võõra sessiooni dev-server pordil 3000 hoiab vana
Prisma klienti — kasuta `next start -p 3100` retsepti (S11).

**Valmis on siis, kui** E1–E6 on `main`-is, sond on roheline päris andmebaasi vastu, kaks
töötajat on üksteise juhtumitest tõendatult pimedad, P2 piir on testiga lukus, ja
`SotsiaalAI.md` S4.1 rida on liikunud TEGEMATA → TEHTUD.

Merge ja deploy ainult omaniku selgel loal.

---

## Lõpetamisel

Uuenda **ainult** `SotsiaalAI.md`: S4.1 juhtumi objekti ja juhtumitöö assistendi read, S5
„Poolik" juhtumitoe rida, S4.3 CASEWORK perekond. Konkureerivat seisufaili ei looda.
