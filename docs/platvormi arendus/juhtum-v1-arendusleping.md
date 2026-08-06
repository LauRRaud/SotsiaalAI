# ÜLESANNE: `JUHTUM-V1` — juhtumi objekt (`CaseWorkAssist`)

**Olek:** `READY_TO_ASSIGN` (v3, omaniku auditi järel).
**Perekond:** CASEWORK — **P7**. Ei ole P0/P1 (tehtud) ega P2 (vt piir allpool).
**Teostus:** üks teema, etapid E1–E6. **Töö otse `main`-is** (S11 reegel 1) — harusid ega
worktree-kaustu ei tehta. **Push ja deploy ainult omaniku selgel loal**; merge'imist selles
mudelis ei toimu.
**Kirjeldus („mis asi see on"):** `ideed.md` **ptk 12** + **ptk 4** — loe mõlemad enne E1-e.
**Muu alus:** `t21-casework-v1-ulesanne.md` (P0/P1 tehtud) · `SotsiaalAI.md` S4.1.

### Versioonilugu

| v | Mis muutus |
|---|---|
| v1 | kirjutatud `ideed.md`-d lugemata — leiutas `CaseRecord`/`CaseLink`/`CaseOpenItem` ja juhtumi peal oleva elutsükli |
| v2 | joondatud kirjeldusega: objekt on `CaseWorkAssist`, elutsükkel on **mustandi** peal (= CASEWORK-P2) |
| **v3** | **omaniku audit** — 7 blokeerivat vastuolu parandatud, kolm peidetud arhitektuuriotsust lukustatud, tulevased integratsioonid V1 vastuvõtukriteeriumidest välja |

---

## Miks see leping olemas on

**Omanik vastas 06.08.2026** küsimusele, mis hoidis teemat kinni alates 03.08 („kus töötaja
juhtumi seisu täna hoiab?"):

> „tal on oma documents ja igale kasutajale on ka veidi mahtu tagatud serveris."

**Koht on olemas** — juhtumi objekt ei too platvormile uut andmeliiki. **Struktuuri ei ole** —
ja see on mõõdetud.

## Lähteseis — mõõdetud koodist 06.08.2026

| Mõõt | Väärtus |
|---|---|
| Mudeleid skeemis | **166** |
| `CaseWork*` mudeleid | **0** — ükski ptk 12 nimi ei ole koodis |
| Migratsioone | 128 |

`UserDocument` ja `AgentArtifact` on mõlemad **lamedad ja owner-skoobitud**, indekseeritud
ainult muutmisaja järgi; kummalgi ei ole ühtki välja, mis viitaks juhtumile või inimesele.
**Kaks `CASE_SUMMARY` artefakti kahe eri inimese kohta erinevad ainult pealkirja tekstis.**
T21 P0 adapter kinnitab: `listCaseArtifacts` on `orderBy updatedAt desc, take: 100`.

---

## Piir CASEWORK-P2 vastu (ära neela teist paketti)

`ideed.md` ptk 4.5 kirjeldab **mustandi ülekandeahelat**: 8 elementi × 7 seisu (*mustand →
vajab kliendiga kontrollimist → vajab dokumenti → töötaja kontrollitud → valmis kandmiseks →
kantud → ei kanta*). **See on CASEWORK-P2**, ta vajab O-CW-2/4/10 ja ta ei kuulu siia.

| Pakett | Mis | Seis |
|---|---|---|
| **P7 (see leping)** | **konteiner** — juhtum, mille külge asjad käivad | otsustevaba |
| P2 | mustandi ülekandeahel | 3 otsuse taga |

Mustandeid hoiab juba `AgentArtifact`. **P7 ei loo mustandile teist keha.**

---

## Sidumiskaart — mis on tekkinud pärast kirjeldust

`ideed.md` ptk 4 ja 12 on kirjutatud enne 11.07. Vahepeal kasvanud osa jaguneb **kaheks** ja
seda vahet ei tohi hägustada: mis on V1 sees, ja mis on tuleviku piirang.

### V1 sees

| # | Mis | Mida muudab |
|---|---|---|
| 1 | **K1 tööruumiregister** — `WorkspaceKind.CASE_WORK` on **RESERVED** | E5 lülitab ta `SUPPORTED`-iks koos adapteriga (L13) |
| 2 | **Kliendi kahe raja muster** (omaniku otsus 04.08; `ServiceReferral`, `NetworkShare`) | E1 kliendiviide (L11) |
| 3 | **`UrgentRequest`** (SK-V1) | teine päritolukanal (L14) |
| 4 | **Typed-FK põhimõte** — `PreInquiry` skeemikommentaar: *„adressaadiväljad on teadlikult eraldi, mitte üks polümorfne `recipientId`… muidu kaob referentsiaalne terviklikkus"* | **E3 seosemudel on typed-FK, mitte polümorfne** (L15) |

### Tulevased integratsioonipiirid — EI ole V1 vastuvõtukriteeriumid

Need on arhitektuurilised piirangud, mis kehtivad päeval, mil vastav voog ehitatakse. **V1 ei
ehita neist ühtegi ja testileping neid ei kontrolli.**

| Mis | Piirang, mis siis kehtib |
|---|---|
| **Kovisioon** | seos on **ühesuunaline**: juhtumist saab seemne algatada, seemnelt juhtumile viidet ei tohi tekkida — teemaseeme on deidentifitseeritud ja tagasiviide tühistaks selle |
| **Meetodipeegel** | seos käib olemasolevast `PracticeReflection.sourceKind`/`sourceId`-st, uut võtit ei lisata |
| **A4 tegevusloa märgis** | juhtumivaates tohib kuvada ainult `lib/mtr/licenceSignal.js` piiratud signaali — seis jah, kontrolliajalugu ja veakoodid ei |

### Teadlikud MITTE-seosed

| Mis | Miks mitte |
|---|---|
| **Teekond** | kliendi enda lugu, kuulub temale; juhtum on töötaja töökorraldus |
| **Tööheaolu** | sidumine muudaks ta koormuse mõõdikuks — arhitektuur keelab |
| **A2 kalkulaator** | arvutus käib seadmes, midagi ei salvestu; seosepunkti ei ole |

---

## Mis JUHTUM-V1 on ja ei ole

**On:** töötaja enda töökorralduse konteiner — mille ümber töö käib, mis on järgmine kontakt,
mis on puudu, mis on STAR-i viide, ja mis kirjega lõpuks juhtub. Seob olemasolevat, ei kopeeri.

**Ei ole:** kliendiregister (isikuvälju ei ole; klient on L11 mustris) · STAR-i vari (ptk 4.7) ·
kliendi vaade (see on Teekond) · ülesandesüsteem (COLLAB objektiklass 8) · assistendi töölaud
(ptk 4.3) ega kohtumise ettevalmistus (ptk 4.4) — need on järgmine leping ja nad **loevad**
seda objekti.

---

## Õiguslikud eeldused — märgistatud, mitte tõestatud

Auditi punkt 17 on õige: allolev **ei tulene skeemi ega salvestusmahu mõõtmisest** ja seda ei
esitata koodist mõõdetud faktina. Struktureeritud konteiner teeb andmed leitavamaks ja
seostatavamaks ning võib töötlusriski muuta ka siis, kui andmekategooriad olid dokumentides
juba olemas.

| # | Väide | Klass |
|---|---|---|
| **Õ1** | Töötaja hoiab juhtumi seisu täna oma dokumentides ja talle tagatud mahus | `OWNER_DECISION` (06.08) |
| **Õ2** | Töötlust kannab olemasolev `WORKER_DATA_PROCESSING` raamleping: organisatsioon vastutav, platvorm volitatud töötleja | `LEGAL_ASSUMPTION` — **vajab andmekaitseanalüüsi kinnitust enne avalikku aktiveerimist** |
| **Õ3** | Konteiner „ei laienda töötlust, vaid korrastab selle" | `LEGAL_ASSUMPTION` — sama analüüsi osa; **ei ole tehniline järeldus** |

Õ2 ja Õ3 **ei blokeeri ehitust** (osa II ptk 4: värav kehtib aktiveerimisele). Nad blokeerivad
funktsiooni nähtavaks lülitamist päris kasutajatele.

---

## Lukustatud otsused

| # | Otsus |
|---|---|
| L1 | **Nimed tulevad kirjeldusest:** `CaseWorkAssist`, `CaseWorkMissingInfo` (ptk 12) |
| L2 | **Rangelt omaniku-skoobitud, fail-closed**; admin ei näe sisu. Piir on **teenuskihis**, marsruut seda ei dubleeri |
| L3 | **Seos ei laienda kunagi ligipääsu** — õigus kontrollitakse alati sihtobjektil |
| L4 | **Siduda saab ainult seda, mida omanik juba näeb** — kontroll serveris |
| L5 | **Päritolusõnastik on olemasolev** `lib/workspaces/provenance.js` |
| L6 | **STAR-i viide kuulub objekti külge** (ptk 12 + 4.7) |
| L7 | **`retentionState` on väli algusest peale:** `ACTIVE` · `READ_ONLY` · `ARCHIVED` |
| L8 | **0 automaatset loomist.** Juhtumi loob alati inimene |
| L9 | **0 U1 sündmust, 0 teavitust V1-s** |
| **L10** | **`label`-välja EI OLE.** Kuvanimi on **tuletatud funktsioon** `caseDisplayLabel()` (allpool) ja teda kasutavad KÕIK pinnad: loend, detailvaade, `caseWorkAdapter`, valikud, otsingutulemused |
| **L11** | **Klient: kaks rada, täielik invariant** (allpool) |
| **L12** | **Päritolu on kanooniline otseväli, mitte üldseos** (allpool) |
| **L13** | **K1 register saab adapteri, mitte teise juhtumi mõiste** — `CASE_WORK` `RESERVED → SUPPORTED` |
| **L14** | **Retention on privilegeeritud operatsioon oma graafiga** (allpool) |
| **L15** | **`CaseWorkItem` on typed-FK, MITTE polümorfne** (allpool) |
| **L16** | **V1-s ei ole juhtumi kustutamist** — ei API-s ega liideses, kuni O-JU-1 on otsustatud |

### L10 — `caseDisplayLabel(caseWorkAssist, t)`

Üks tuletatud funktsioon, mitte salvestatud väli. Järjestus:

1. `clientErasedAt` on määratud → **alati** lokaliseeritud „Kustutatud kliendiviide"
   (võidab kõik ülejäänud);
2. `clientDisplayName` (miinimumkuju);
3. `clientExternalRef`;
4. lokaliseeritud „Nimetu juhtum".

Kolmas identiteediväli andmebaasi **ei teki**. Funktsioon elab teenuskihis ja teda katab test.

### L11 — kliendi kahe raja täielik invariant

| Reegel | Väärtus |
|---|---|
| Rada A | `clientUserId` määratud → `clientDisplayName` ja `clientExternalRef` peavad olema `null` |
| Rada B | `clientDisplayName` ja/või `clientExternalRef` määratud → `clientUserId` peab olema `null` |
| Mõlemad puuduvad | **lubatud** — juhtum võib eksisteerida enne kliendiviite lisamist |
| `clientExternalRef` ilma kuvanimeta | **lubatud** (nt ainult STAR-i number) |
| `clientDisplayName` ilma välisviiteta | **lubatud** |
| `clientErasedAt` | kehtib **mõlemale rajale**; on **süsteemioperatsioon**, mitte vabalt kirjutatav väli |
| Kustutamise semantika | väljad **nullitakse andmebaasis** (`clientUserId`, `clientDisplayName`, `clientExternalRef` → `null`), `clientErasedAt` jääb märkeks. Peitmisest ei piisa |
| API | kustutatud väärtusi ei tagastata **üheski** vastuses, agregaadis ega adapteris |
| Rada A lisamise õigus | „kasutaja eksisteerib" **ei ole piisav** — `clientUserId` tohib määrata ainult siis, kui see inimene on omanikuga juba seotud päritoluobjekti kaudu (vt L12) |

### L12 — päritolu

- `preInquiryId?` ja `urgentRequestId?` on **kanoonilised otseväljad**.
- **Maksimaalselt üks** neist on määratud; mõlemad korraga on keeldumine.
- Päritolu **võib puududa** (L8: juhtumi loob inimene).
- Päritoluobjekt peab kuuluma omaniku nähtavasse skoopi — kontroll serveris.
- **Päritolu määratakse loomisel ja V1-s ei muudeta.**
- Päritoluobjekti kustutamisel → `SetNull`; juhtum säilib.
- **`PRE_INQUIRY` ja `URGENT_REQUEST` EI ole `CaseWorkItem` sihttüübid** — muidu tekiks sama
  seos kahel viisil ja nad võiksid lahku minna.
- **Kliendiviide tuletatakse päritolust ja külmutatakse loomisel** (auditi punkt 9): kui
  päritoluobjektil on `authorId`, saab `clientUserId` selle väärtuse ja on V1-s
  muutmatu. Ilma päritoluta juhtumil täidab töötaja rada B käsitsi. **Vaba B-raja kirjutamine
  A-rajaga päritolu peale on keeldumine, mitte hoiatus.**

### L14 — retention

| Reegel | Väärtus |
|---|---|
| Vaikeolek | `ACTIVE` |
| Lubatud siirded | **ainult** `ACTIVE → READ_ONLY → ARCHIVED` |
| Tagasisiirded | **ei ole V1-s** |
| Kes | ainult omanik |
| Kuidas | **eraldi privilegeeritud teenuseoperatsioon**, mitte tavaline update |
| Põhjus | kohustuslik, trimmitud, piiratud pikkusega |
| Audit | tegija · aeg · vana olek · uus olek · põhjus. **Ei lähe üldlogidesse ega admini nähtavasse sisusse** (L2) |
| `READ_ONLY` ja `ARCHIVED` keelavad | juhtumi väljade muutmise · kliendiviite muutmise · seose lisamise ja eemaldamise · `CaseWorkMissingInfo` lisamise, muutmise ja kustutamise |
| `READ_ONLY → ARCHIVED` | lubatud **ainult** retention-operatsiooni kaudu (mitte tavakirjutusena) |

### L15 — `CaseWorkItem` on typed-FK

`PreInquiry` skeemikommentaar ütleb platvormi reegli välja: *„iga adressaadi-liik kannab oma
võtit ja oma FK-d, muidu kaob referentsiaalne terviklikkus."* **Polümorfne `targetType +
targetId` rikuks selle** ja tema „ei jää rippuvat viidet" lubadus oleks ainult nii tugev kui
rakenduse kustutusteede kaetus.

**Seega:** `CaseWorkItem` kannab kolme **nullable typed-FK-d** ja andmebaasi CHECK-i, et
**täpselt üks** on määratud:

| V1 sihttüüp | Väli |
|---|---|
| dokument | `userDocumentId?` |
| artefakt | `agentArtifactId?` |
| välitöökäik | `fieldVisitId?` |

Kõik kolm on `onDelete: Cascade` — **garantii tuleb andmebaasist ja kehtib ka otse-SQL
kustutuse korral**, mitte rakenduse kustutusteede kaetusest.

**`NETWORK_SHARE` ja `SERVICE_REFERRAL` jäävad V1-st välja** (auditi lõppsoovitus: hoida P7
väike). Nende lisamine on üks migratsioon + üks CHECK-i rida.

---

## Lahtised otsused — ükski ei blokeeri ehitust

| # | Küsimus | V1 |
|---|---|---|
| **O-JU-1** | Säilitusreegel ja kas juhtum kunagi kustub | väli on olemas, **automaatikat ega kustutust ei ole** (L16). Sama küsimus mis O-CW-2 — küsi koos |
| **O-JU-2** | Kas juhtum on üleantav kolleegile või üksusele | **ei** — rangelt isiklik |
| **O-JU-3** | Kas juhtum tekib päritoluobjektist ühe vajutusega | **ei** (L8 jääb); väljad on olemas, nupp mitte |

---

## Teostus

### E1 — Skeem ja invariandid

`CaseWorkAssist`: `id` · `ownerUserId` · `preInquiryId?` · `urgentRequestId?` ·
`clientUserId?` · `clientDisplayName?` · `clientExternalRef?` · `clientErasedAt?` ·
`externalSystem?` · `externalReference?` · `nextContactAt?` · `retentionState` ·
`createdAt` · `updatedAt`.

- **STAR-i invariant:** `externalSystem` ja `externalReference` on **mõlemad või kumbki**;
  V1-s lubatud süsteem on ainult `STAR2`; viide trimmitakse ja on piiratud pikkusega. Sama
  viide **tohib** olla mitmel sama omaniku juhtumil (juhtumeid võib olla mitu ühe STAR-i
  menetluse kohta) — dubleerimist ei blokeerita, aga see ei muuda `retentionState`-i
  automaatselt (ptk 4.7 „ei hoita teist aktiivset koopiat" käib **mustandi**, mitte konteineri
  kohta, ja jõustub P2-s).
- `CaseWorkMissingInfo`: `id` · `caseWorkAssistId` · `text` · `provenance` · `status`
  (`OPEN` vaikimisi) · `resolvedAt?` · `createdAt` · `updatedAt`.
  **Invariant:** `OPEN` → `resolvedAt = null`; `RESOLVED`/`NOT_APPLICABLE` → `resolvedAt`
  määratakse **serveris**; tagasi `OPEN` nullib `resolvedAt`. `text` on plain text, trimmitud,
  piiratud pikkusega; sorteerimine `status`, siis `createdAt`.
- `CaseWorkItem`: L15 typed-FK-d + CHECK.
- **Indeksid:** `CaseWorkAssist(ownerUserId, updatedAt)` · `(ownerUserId, retentionState,
  updatedAt)` · `(ownerUserId, nextContactAt)` · FK-indeksid `preInquiryId`,
  `urgentRequestId`, `clientUserId` · `CaseWorkItem(caseWorkAssistId, createdAt)` + unikaalne
  `(caseWorkAssistId, userDocumentId)`, `(caseWorkAssistId, agentArtifactId)`,
  `(caseWorkAssistId, fieldVisitId)` · `CaseWorkMissingInfo(caseWorkAssistId, status)`.

### E2 — Teenuskiht ja ligipääs

`lib/casework/caseWorkAssist.js` — **uus kaust**; `lib/casework/` täna EI OLE olemas
(genogrammi leping viitab talle kui olemasolevale — **see viide on aegunud, paranda raportis**).

Sisaldab: omaniku-skoop (L2) · create / read / update · `caseDisplayLabel()` (L10) ·
retention-operatsioon (L14) · kliendiviite kustutamine (L11) · kõik kirjutuskeelud · audit.

### E3 — Seoseregister

`CaseWorkItem` link / unlink / read; ligipääsu kontroll **igal lugemisel** (L3, L4);
`onDelete: Cascade` katab kustutuse. Ligipääsmatu seos ei tohi mõjutada vastuse ridu ega
**arve** — vt testileping 11.

### E4 — Puuduv info

Mudel E1-st; staatuse invariant; retention-piir (L14); avatud punktide agregatsioon
(agregaat ei tohi lugeda ligipääsmatuid ridu).

### E5 — K1 adapter

`lib/workspaces/adapters/caseWorkAdapter.js` (muster: `orgSpaceAdapter.js`,
`fieldVisitAdapter.js`); `registry.js` `CASE_WORK` `RESERVED → SUPPORTED`.

**Descriptor on lepingus määratud, mitte arendaja valik:**

| Väli | Väärtus |
|---|---|
| `workspaceId` | `CaseWorkAssist.id` |
| pealkiri | **`caseDisplayLabel()`** (L10) — sama funktsioon mis liideses |
| kuupäev | `updatedAt` |
| `nextContactAt` | **descriptorisse EI lähe** — ta on juhtumi sisu, mitte tööruumi metaandmed |

Descriptor ei kanna ühtegi muud isikuandmete välja ega tohi sattuda üldisesse auditisse või
logisse. `SUPPORTED_WORKSPACE_KINDS` muutub — kontrolli olemasolevaid teste.

### E6 — Vaade „Minu juhtumid" + tõend

**Värav A — kasutusvood.** Kõik käivad E2 teenuskihi kaudu:

1. juhtumi käsitsi loomine · 2. aktiivse juhtumi põhiandmete muutmine · 3. järgmise kontakti
määramine ja eemaldamine · 4. STAR-i viite lisamine või muutmine · 5. seose lisamine ja
eemaldamine · 6. puuduva info lisamine · 7. puuduva info staatuse muutmine · 8.
retention-siire (L14) · 9. **pagineeritud** juhtumiloend · 10. detailvaade, kus ligipääsmatuid
sihtobjekte ei näidata **ega loendata** · 11. kliendiviite kustutamine (L11).

**Pagineerimine on kohustuslik kõigil kasvavatel loenditel:** juhtumiloend · ühe juhtumi
seosed · puuduva info loend · adapteri descriptorid. Igal on selge piir, sorteerimine ja
cursor. NB `listCaseArtifacts` on `take: 100` ilma pagineerimiseta — juhtumivaade ei tohi
sellele toetuda.

Keeleregister „mustand / ettevalmistus", **mitte** „menetlus" (T21 R8). ET/EN/RU pariteet.

**Värav B — sond `npm run case:probe` päris andmebaasi vastu.** Fake-prisma ei valideeri skeemi
ega tõenda ligipääsupiiri (04.08 IDOR-i õppetund).

- **Keskkonnavärav: korda `scripts/mtr-licence-probe.mjs:47–53` mustrit** — `DATABASE_URL`
  hostinimi peab olema lokaalne ja `NODE_ENV !== "production"`, muidu keeldub; möödapääs ainult
  nimelise env-lipuga.
- Kasutajad ja PIN **env-muutujatest või dokumenteeritud fixture'ist**, mitte skripti sisse
  kirjutatuna. PIN-i ei logita. Küpsisefailid ajutisse kataloogi, **ei commit'ita**.
- Koristab enda järelt **ka vea korral** ja **kontrollib koristust**, mitte ei eelda seda
  (A4 õppetund).
- Kaks päris sessiooni, eraldi küpsisefailid.

---

## Selgelt väljas

Assistendi töölaud (ptk 4.3) · kohtumise ettevalmistus (ptk 4.4) · **mustandi ülekandeahel
(P2)** · STAR2 liidestus (ptk 4.8) · **kovisiooni ettevalmistuse algatamine** · **meetodipeegli
kasutusvoog** · **A4 märgise kuvamine juhtumivaates** · `NETWORK_SHARE` ja `SERVICE_REFERRAL`
sihttüübid · juhtumi kustutamine (L16) · juhtumi üleandmine · genogramm ja ökokaart (P4/P5) ·
meetodite kataloog (P6) · teavitused · push ja deploy.

---

## Testilepingud

**Ligipääs ja skoop**

1. võõras kasutaja saab 0 rida; admin ei näe sisu
2. seos ei laienda: võõra sihtobjekti lugemine keeldub ka siis, kui rida on andmebaasis
3. võõra sihtobjektiga sidumine → keeldumine, mitte vaikne lisamine
4. **ligipääsmatu seos ei mõjuta vastuse ridu ega agregaatide arve** ega leki `targetId`,
   tüübi või olemasoluna

**Klient ja päritolu**

5. L11 kõik lubatud ja keelatud kombinatsioonid
6. `clientErasedAt` järel on väljad `null` ja kustutatud väärtus ei leki adapteris, loendis
   ega detailvastuses
7. mõlemat päritolu korraga ei saa määrata
8. päritoluobjekt peab olema omaniku nähtavas skoobis
9. päritoluga juhtumil ei saa kirjutada B-raja kliendiviidet
10. päritolu ei ole `CaseWorkItem` sihttüübina olemas
11. päritoluobjekti kustutamine → `SetNull`, juhtum säilib

**Retention**

12. lubatud on ainult `ACTIVE → READ_ONLY → ARCHIVED`; tagasisiire keeldub
13. `READ_ONLY` keelab ka seoste ja puuduvate punktide muutmise
14. `READ_ONLY → ARCHIVED` ainult retention-operatsiooniga
15. siire ilma põhjuseta keeldub; audit kannab viit välja
16. **kustutus-API-t ei eksisteeri** (L16)

**Mudel ja terviklikkus**

17. L10 `caseDisplayLabel()` järjestus, sh kustutatud kliendiviite ülimuslikkus
18. `CaseWorkItem` CHECK: null või mitu FK-d korraga → keeldumine
19. sihtobjekti kustutamine eemaldab seose **igal kolmel sihttüübil**
20. `CaseWorkMissingInfo` `status`/`resolvedAt` invariant mõlemas suunas
21. STAR-i väljad mõlemad-või-mitte-kumbki; ainult `STAR2`
22. L5 päritolusõnastik: tundmatu väärtus lükatakse tagasi
23. **P2 piir:** `CaseWorkItem`-il ega `CaseWorkAssist`-il ei ole ülekande- ega ülevaatuse
    seisu välja

**Liides ja adapter**

24. L13: `CASE_WORK` on `SUPPORTED`, adapter omaniku-skoobitud, descriptor E5 kuju järgi
25. juhtumiloendi ja juhtumi seoste pagineerimine
26. HTML või skript tekstiväljas kuvatakse tekstina, mitte markup'ina
27. i18n ET/EN/RU pariteet, 0 hard-coded JSX-teksti

**Sond**

28. sond keeldub tootmis- või tundmatu andmebaasi vastu käivitumast

---

## Väravad ja DoD

`npm test` · `npm run i18n:check` · eslint muudetud failidel · `npm run db:migrate:check` ·
`npm run build` · **`npm run case:probe` päris DB vastu**.

**Skeemimuudatuse järel:** `prisma generate` + dev-serveri restart + üks päris päring. Roheline
sviit fake-prismaga ei tõenda siin midagi. Võõra sessiooni dev-server pordil 3000 hoiab vana
Prisma klienti — kasuta `next start -p 3100` retsepti (S11).

**Valmis on siis, kui** E1–E6 on `main`-is, sond on roheline päris andmebaasi vastu, kaks
töötajat on üksteise juhtumitest tõendatult pimedad, P2 piir ja L15 CHECK on testiga lukus,
ja `SotsiaalAI.md` S4.1 rida on liikunud TEGEMATA → TEHTUD.

**Push ja deploy ainult omaniku selgel loal.** Funktsiooni nähtavaks lülitamine päris
kasutajatele on lisaks Õ2/Õ3 taga.

---

## Lõpetamisel

Uuenda **ainult** `SotsiaalAI.md`: S4.1 juhtumi objekti ja assistendi read, S5 „Poolik"
juhtumitoe rida, S4.3 CASEWORK perekond. Konkureerivat seisufaili ei looda.
