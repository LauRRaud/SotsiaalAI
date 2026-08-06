# ÜLESANNE: `JUHTUM-V1` — juhtumi objekt (`CaseWorkAssist`)

**Olek:** `READY_TO_ASSIGN` (v4, omaniku kordusauditi järel).
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
| v3 | **omaniku audit** — 7 blokeerivat vastuolu parandatud, kolm peidetud arhitektuuriotsust lukustatud, tulevased integratsioonid V1 vastuvõtukriteeriumidest välja |
| **v4** | **omaniku kordusaudit** — 5 blokeerivat: rada A kuvanimi (kõik oleksid olnud „Nimetu juhtum"), `authorId ≠ klient`, kliendiviite kustutus vs retention, retention-auditi mudel, aktiveerimisvärav. Lisaks 6 täpsustust (L15 täismudel, L20 DB CHECK-id, stabiilne cursor, K1 pagineerimise piir, `clientExternalRef` vs `externalReference`, aus laienduslause) |

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
| **L17** | **Kliendiviite kustutamine on eraldi operatsioon, lubatud KÕIGIS retention-olekutes** (allpool) |
| **L18** | **Retention-audit on oma kitsas owner-skoobitud mudel**, mitte admini loetav `DataAuditLog` (allpool) |
| **L19** | **Aktiveerimisvärav `CASEWORK_V1_ENABLED`, vaikimisi väljas** — `lib/serviceLog/flags.js` mustri järgi (allpool) |
| **L20** | **Staatilised invariandid on ka DB CHECK-idena**, mitte ainult teenusekihis (allpool) |

### L10 — `caseDisplayLabel(caseWorkAssist, resolvedClientName, t)`

Üks tuletatud funktsioon, mitte salvestatud väli. Järjestus:

1. `clientErasedAt` on määratud → **alati** lokaliseeritud „Kustutatud kliendiviide"
   (võidab kõik ülejäänud);
2. **Rada A: `resolvedClientName`** — lugemise ajal lahendatud kliendi kuvanimi;
3. `clientDisplayName` (rada B miinimumkuju);
4. `clientExternalRef`;
5. lokaliseeritud „Nimetu juhtum".

**Punkt 2 on v3 auditi parandus.** Ilma selleta saaks **iga** rada A juhtum kuvanimeks
„Nimetu juhtum" — L11 nõuab rada A puhul, et `clientDisplayName` ja `clientExternalRef` on
`null`, ja vana signatuur ei näinud `clientUserId`-d üldse. Loendis oleksid kõik platvormi
kasutajaga seotud juhtumid muutunud eristamatuks.

Resolveri reeglid:

- **kliendi nime ei kopeerita `CaseWorkAssist` tabelisse** — kolmandat identiteedivälja ei teki;
- nimi lahendatakse **lugemise ajal** ja **hulgi** (üks päring loendi kohta, mitte N+1);
- lahendus käib **serveripoolse ligipääsukontrolli kaudu**;
- kui kliendi profiil ei ole enam nähtav → **„Nimetu juhtum"**, mitte vana nimi vahemälust;
- **sama resolverit kasutavad kõik pinnad:** loend, detailvaade, `caseWorkAdapter`, valikud,
  otsingutulemused.

### L11 — kliendi kahe raja täielik invariant

| Reegel | Väärtus |
|---|---|
| Rada A | `clientUserId` määratud → `clientDisplayName` ja `clientExternalRef` peavad olema `null` |
| Rada B | `clientDisplayName` ja/või `clientExternalRef` määratud → `clientUserId` peab olema `null` |
| Mõlemad puuduvad | **lubatud** — juhtum võib eksisteerida enne kliendiviite lisamist |
| `clientExternalRef` ilma kuvanimeta | **lubatud** (nt ainult STAR-i number) |
| `clientDisplayName` ilma välisviiteta | **lubatud** |
| `clientErasedAt` | kehtib **mõlemale rajale**; on **süsteemioperatsioon** (L17), mitte vabalt kirjutatav väli |
| Kustutamise semantika | väljad **nullitakse andmebaasis** (`clientUserId`, `clientDisplayName`, `clientExternalRef` → `null`), `clientErasedAt` jääb märkeks. Peitmisest ei piisa |
| API | kustutatud väärtusi ei tagastata **üheski** vastuses, agregaadis ega adapteris |
| **Rada A lisamise õigus** | „kasutaja eksisteerib" **ei ole piisav**. `clientUserId` tohib määrata **ainult** selle juhtumi päritoluobjekti autoriks olevale kasutajale — st inimesele, kes ise saatis omanikule eelpöördumise või abipalve. Kliendiotsingut ega kasutajakataloogi sirvimist V1-s ei ole |
| `clientExternalRef` sisu | **välise kliendi või isiku identifikaator**, MITTE menetluse viide. Menetluse viide elab `externalReference`-is (auditi punkt 8). STAR-i numbrit ei kasutata siin näitena, sest STAR ei anna nende kahe vahel usaldusväärset eristust |

### L12 — päritolu

- `preInquiryId?` ja `urgentRequestId?` on **kanoonilised otseväljad**.
- **Maksimaalselt üks** neist on määratud; mõlemad korraga on keeldumine.
- Päritolu **võib puududa** (L8: juhtumi loob inimene).
- Päritoluobjekt peab kuuluma omaniku nähtavasse skoopi — kontroll serveris.
- **Päritolu määratakse loomisel ja V1-s ei muudeta.**
- Päritoluobjekti kustutamisel → `SetNull`; juhtum säilib.
- **`PRE_INQUIRY` ja `URGENT_REQUEST` EI ole `CaseWorkItem` sihttüübid** — muidu tekiks sama
  seos kahel viisil ja nad võiksid lahku minna.

**Kliendiviidet EI tuletata päritolust automaatselt.** Lepingu v3 ütles, et `authorId` tõstetakse
`clientUserId`-ks. **See oli vale ja mudelifaktid ütlevad, miks** (kontrollitud 06.08):

| Päritolu | Kliendiväli mudelis | Järeldus |
|---|---|---|
| `PreInquiry` | **puudub** — on ainult `authorId` (kirjutaja) + `authorErasedAt` | ei tuletata |
| `UrgentRequest` | **puudub** — on `authorId` (nullable) + `contactName`/`contactPhone` | ei tuletata |

Kummalgi mudelil ei ole välja, mis ütleks „see pöördumine käib inimese X kohta". Pöördumise
võib esitada lähedane, esindaja või teine spetsialist, ja anonüümne rada on lubatud
(`authorId` on mõlemal nullable). **Autor ja klient on eri rollid ning nende samastamine
tekitaks vale inimese seose.**

Seega: päritolu jääb alles, **kliendirada jääb tühjaks**, ja töötaja sisestab vajadusel
viite ise. `clientUserId` määramine on **inimese teadlik valik**, mitte masina järeldus — ja
tema ainus lubatud väärtus on päritoluobjekti autor (L11), sest just seda inimest omanik selle
juhtumi kontekstis juba näeb.

### L14 — retention

| Reegel | Väärtus |
|---|---|
| Vaikeolek | `ACTIVE` |
| Lubatud siirded | **ainult** `ACTIVE → READ_ONLY → ARCHIVED` |
| Tagasisiirded | **ei ole V1-s** |
| Kes | ainult omanik |
| Kuidas | **eraldi privilegeeritud teenuseoperatsioon**, mitte tavaline update |
| Põhjus | kohustuslik, trimmitud, piiratud pikkusega |
| Audit | `CaseWorkRetentionAudit` (L18) — **mitte** `DataAuditLog` |
| `READ_ONLY` ja `ARCHIVED` keelavad | juhtumi väljade muutmise · kliendiviite **muutmise** · seose lisamise ja eemaldamise · `CaseWorkMissingInfo` lisamise, muutmise ja kustutamise |
| **Erand** | **kliendiviite kustutamine (L17) on lubatud KÕIGIS retention-olekutes** — andmesubjekti õigus ei tohi jääda retention-oleku taha kinni |
| `READ_ONLY → ARCHIVED` | lubatud **ainult** retention-operatsiooni kaudu (mitte tavakirjutusena) |
| **Atomaarsus** | kõik aktiivse juhtumi kirjutused käivad tingimusliku update'i või tehinguga, mis õnnestub **ainult tingimusel `retentionState = ACTIVE`**; retention-siire ja auditikirje luuakse **ühes tehingus**. Loe-kontrolli-kirjuta muster ei jõusta L14-t paralleelsete päringute korral |

### L17 — `eraseCaseClientReference()`

Eraldi operatsioon, mitte tavaline update. Auditi punkt 3: kustutamine oli korraga
„süsteemioperatsioon", „kasutusvoog" ja `READ_ONLY` all keelatud.

| Reegel | Väärtus |
|---|---|
| Lubatud olekud | **`ACTIVE`, `READ_ONLY` ja `ARCHIVED`** |
| Teeb ühes tehingus | `clientUserId`, `clientDisplayName`, `clientExternalRef` → `null` |
| `clientErasedAt` | määratakse **serveris** |
| `retentionState` | **ei muutu** |
| Idempotentne | jah — teine kutse ei ole viga |
| Audit | tegija või süsteemne käivitaja · aeg · põhjus. **Kustutatud nime ega välisviite väärtust auditisse ei kirjutata** |
| `clientUserId` FK | `onDelete: SetNull` — **aga sellest üksi EI PIISA**, sest see ei määra `clientErasedAt`-i |
| Konto kustutamine | `lib/privacy/userDeletionOrchestrator.js` rada peab **kutsuma seda operatsiooni**, mitte lootma FK `SetNull`-ile. Sama muster, mis kannab `PreInquiry.authorErasedAt`-i |

### L18 — `CaseWorkRetentionAudit` (uus kitsas mudel)

**Miks mitte olemasolev `DataAuditLog`:** ta on **admini loetav** (kasutusel
`app/api/admin/usage/*` marsruutidel). L2 ütleb, et admin ei näe juhtumi sisu, ja
retention-põhjus **on** juhtumi sisu. Variant A langeb seega ära mõõdetud faktil, mitte
eelistusel.

```
CaseWorkRetentionAudit
- id · caseWorkAssistId · ownerUserId · actorUserId
- fromState · toState · reason · createdAt
```

- `ownerUserId` peab vastama juhtumi omanikule; **ainult omanik loeb, admin saab 0 rida**;
- **append-only** — update- ja delete-API-t ei eksisteeri;
- `reason` on plain text, trimmitud, piiratud pikkusega;
- auditikirje luuakse **samas tehingus** retention-siirdega.

### L15 — `CaseWorkItem` on typed-FK

`PreInquiry` skeemikommentaar ütleb platvormi reegli välja: *„iga adressaadi-liik kannab oma
võtit ja oma FK-d, muidu kaob referentsiaalne terviklikkus."* **Polümorfne `targetType +
targetId` rikuks selle** ja tema „ei jää rippuvat viidet" lubadus oleks ainult nii tugev kui
rakenduse kustutusteede kaetus.

**Seega** — mudel tervikuna, mitte vihjena:

```
CaseWorkItem
- id
- caseWorkAssistId        FK → CaseWorkAssist   onDelete: Cascade
- userDocumentId?         FK → UserDocument     onDelete: Cascade
- agentArtifactId?        FK → AgentArtifact    onDelete: Cascade
- fieldVisitId?           FK → FieldVisit       onDelete: Cascade
- createdAt
```

- **`updatedAt` puudub teadlikult** — seos on kas olemas või mitte, teda ei muudeta.
- DB CHECK `casework_item_exactly_one_target`:
  `num_nonnulls(userDocumentId, agentArtifactId, fieldVisitId) = 1`.
- **CHECK luuakse SQL-migratsioonis**, mitte ainult teenusevalideerimises.
- Sihtobjekti `onDelete: Cascade` tähendab, et **garantii tuleb andmebaasist ja kehtib ka
  otse-SQL kustutuse korral**, mitte rakenduse kustutusteede kaetusest.

**`NETWORK_SHARE` ja `SERVICE_REFERRAL` jäävad V1-st välja** (auditi lõppsoovitus: hoida P7
väike). Nende lisamine on **additiivne typed-FK laiendus, mis vajab skeemi, resolveri, teenuse,
UI ja testilepingu täiendamist** — mitte „üks migratsioon + üks CHECK-i rida", nagu v3 ekslikult
lubas.

### L19 — aktiveerimisvärav

Õ2/Õ3 lause „blokeerib nähtavaks lülitamist" ei ole ilma mehhanismita jõustatud: töö käib otse
`main`-is ja omaniku deploy-luba ei tähenda, et andmekaitseanalüüs on valmis.

**Muster on olemas ja dokumenteeritud** — `lib/serviceLog/flags.js`. Korda seda, ära leiuta:

| Lipp | Elu |
|---|---|
| `CASEWORK_V1_ENABLED` | **server**, loetakse päringu ajal — **see on ainus tõde** |
| `NEXT_PUBLIC_CASEWORK_V1_ENABLED` | **UI**, küpsetatakse build'i — **tohib ainult PEITA, mitte avada** |

Sama faili hoiatus kehtib siin sõna-sõnalt: `NEXT_PUBLIC_*` asendatakse bundle'is ehitamise
hetkel, seega tema muutmine serveris ei mõju enne uut build'i; kui pooled lähevad lahku, on
tagajärg alati „nupp on nähtav, API ütleb 404".

- **Vaikimisi `false`.** Kogu väravaloogika käib ühest moodulist läbi (`lib/casework/flags.js`).
- Värav katab: „Minu juhtumid" navigatsiooni · UI-marsruudid · create/update API-d ·
  K1 tööruumiregistri avaliku pinna · otsingu ja valikute pinnad.
- Skeem, teenused ja testid **tohivad olla deploy'tud** väravaga väljas.
- Avamine vajab **kahte**: omaniku selget luba **ja** Õ2/Õ3 andmekaitseanalüüsi kinnitust.

---

## Lahtised otsused — ükski ei blokeeri ehitust

| # | Küsimus | V1 |
|---|---|---|
| **O-JU-1** | Säilitusreegel ja kas juhtum kunagi kustub | väli on olemas, **automaatikat ega kustutust ei ole** (L16). Sama küsimus mis O-CW-2 — küsi koos |
| **O-JU-2** | Kas juhtum on üleantav kolleegile või üksusele | **ei** — rangelt isiklik |
| **O-JU-3** | Kas juhtum tekib päritoluobjektist ühe vajutusega | **ei** (L8 jääb); väljad on olemas, nupp mitte |
| **O-JU-4** | Millisel alusel tohib `clientUserId`-ks määrata kellegi, kes EI ole päritoluobjekti autor (nt klient, kes jõudis töötajani mujalt) | V1-s **ei tohi** (L11). Avanemine vajab kontrollitavat alust — „kasutaja eksisteerib" ei ole alus |

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
- `CaseWorkItem`: L15 mudel + CHECK.
- `CaseWorkRetentionAudit`: L18 mudel, append-only.
- **Indeksid:** `CaseWorkAssist(ownerUserId, updatedAt)` · `(ownerUserId, retentionState,
  updatedAt)` · `(ownerUserId, nextContactAt)` · FK-indeksid `preInquiryId`,
  `urgentRequestId`, `clientUserId` · `CaseWorkItem(caseWorkAssistId, createdAt)` + unikaalne
  `(caseWorkAssistId, userDocumentId)`, `(caseWorkAssistId, agentArtifactId)`,
  `(caseWorkAssistId, fieldVisitId)` · `CaseWorkMissingInfo(caseWorkAssistId, status)` ·
  `CaseWorkRetentionAudit(caseWorkAssistId, createdAt)`.

#### L20 — DB CHECK-id, mitte ainult teenusekiht

Typed-FK juures loeb otse-SQL terviklikkus (L15); **sama põhimõte kehtib ülejäänud
nulli-invariantidele**. Teenusekontroll jääb alles kasutajasõbraliku vea jaoks; CHECK kaitseb
terviklikkust.

```sql
num_nonnulls("preInquiryId", "urgentRequestId") <= 1

NOT ("clientUserId" IS NOT NULL
     AND ("clientDisplayName" IS NOT NULL OR "clientExternalRef" IS NOT NULL))

("externalSystem" IS NULL) = ("externalReference" IS NULL)

"clientErasedAt" IS NULL
  OR ("clientUserId" IS NULL AND "clientDisplayName" IS NULL AND "clientExternalRef" IS NULL)

num_nonnulls("userDocumentId", "agentArtifactId", "fieldVisitId") = 1   -- CaseWorkItem
```

### E2 — Teenuskiht ja ligipääs

`lib/casework/caseWorkAssist.js` — **uus kaust**; `lib/casework/` täna EI OLE olemas
(genogrammi leping viitab talle kui olemasolevale — **see viide on aegunud, paranda raportis**).

Sisaldab: omaniku-skoop (L2) · create / read / update · `caseDisplayLabel()` + hulgi
nimeresolver (L10) · retention-operatsioon koos auditiga ühes tehingus (L14, L18) ·
`eraseCaseClientReference()` (L17) · kõik kirjutuskeelud tingimusliku update'iga (L14
atomaarsus).

`lib/casework/flags.js` — **kogu väravaloogika ühest kohast** (L19), muster
`lib/serviceLog/flags.js`. `lib/privacy/userDeletionOrchestrator.js` rada saab kutse
`eraseCaseClientReference()`-le.

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

**Pagineerimine: adapter järgib olemasolevat K1 tava, mitte JUHTUM-V1 oma.** Mõõdetud 06.08 —
`listWorkspaces(userId, { db })` ei võta pagineerimisparameetrit ja **kõik 12 adapterit
kasutavad kõva `take: 100`/`200`** (`orgSpaceAdapter` 100, `covisionParticipationAdapter` 200
jne). Cursor'i nõudmine adapterilt tähendaks K1 adapterilepingu muutmist üle kogu platvormi —
see on **selgelt väljas** ja jääb teadaolevaks platvormiüleseks piiranguks. Case-adapter võtab
sama `take: 100` ja **JUHTUM-V1 oma pinnad pagineeritakse ise** (E6).

### E6 — Vaade „Minu juhtumid" + tõend

**Värav A — kasutusvood.** Kõik käivad E2 teenuskihi kaudu:

1. juhtumi käsitsi loomine · 2. aktiivse juhtumi põhiandmete muutmine · 3. järgmise kontakti
määramine ja eemaldamine · 4. STAR-i viite lisamine või muutmine · 5. seose lisamine ja
eemaldamine · 6. puuduva info lisamine · 7. puuduva info staatuse muutmine · 8.
retention-siire (L14) · 9. **pagineeritud** juhtumiloend · 10. detailvaade, kus ligipääsmatuid
sihtobjekte ei näidata **ega loendata** · 11. kliendiviite kustutamine (L11).

**Pagineerimine on kohustuslik JUHTUM-V1 oma loenditel** (adapter järgib K1 tava, vt E5).
**Cursor vajab stabiilset sortimisvõtit** — ainult kuupäevast ei piisa, sest mitmel real võib
olla sama ajatempel:

| Loend | Sortimine |
|---|---|
| juhtumid | `updatedAt DESC, id DESC` |
| seosed | `createdAt DESC, id DESC` |
| puuduv info | staatuse kaal, siis `createdAt ASC, id ASC` |

NB `listCaseArtifacts` on `take: 100` ilma pagineerimiseta — juhtumivaade ei tohi sellele
toetuda.

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
sihttüübid · juhtumi kustutamine (L16) · juhtumi üleandmine · **K1 adapterilepingu muutmine
cursor-pagineerimisele** (kogu platvormi ulatuses, vt E5) · **kliendiotsing või
kasutajakataloogi sirvimine** (L11: rada A ainult päritoluobjekti autor) · genogramm ja
ökokaart (P4/P5) · meetodite kataloog (P6) · teavitused · push ja deploy.

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

**Retention ja audit**

12. lubatud on ainult `ACTIVE → READ_ONLY → ARCHIVED`; tagasisiire keeldub
13. `READ_ONLY` keelab ka seoste ja puuduvate punktide muutmise
14. `READ_ONLY → ARCHIVED` ainult retention-operatsiooniga
15. siire ilma põhjuseta keeldub; audit kannab viit välja
16. **kustutus-API-t ei eksisteeri** (L16)
17. **audit on append-only ja owner-skoobitud:** update/delete-API puudub, **admin saab 0 rida**
18. **atomaarsus:** `ACTIVE` juhtumi kirjutus, mis toimub samal ajal retention-siirdega,
    ebaõnnestub — mitte ei kirjuta üle (tingimuslik update, mitte loe-kontrolli-kirjuta)

**Kliendiviite kustutamine (L17)**

19. lubatud `ACTIVE`, `READ_ONLY` **ja** `ARCHIVED` olekus
20. nullib kõik kolm välja ja määrab `clientErasedAt`; `retentionState` ei muutu
21. idempotentne — teine kutse ei ole viga
22. **audit ei sisalda kustutatud nime ega välisviite väärtust**
23. konto kustutamise rada kutsub operatsiooni (FK `SetNull` üksi jätaks `clientErasedAt`
    määramata)

**Kuvanimi (L10)**

24. **rada A juhtum ei kuva „Nimetu juhtum"** — resolveri nimi võidab
25. kustutatud kliendiviide võidab **kõik**, ka rada A resolveri nime
26. kui kliendi profiil ei ole enam nähtav → „Nimetu juhtum", **mitte vana nimi**
27. loendipäring lahendab nimed **hulgi** — N juhtumit ei tekita N päringut
28. sama funktsioon annab sama tulemuse loendis, detailvaates ja adapteris

**Mudel ja terviklikkus**

29. L20 iga DB CHECK eraldi: päritolu ≤ 1 · kliendi rajad · STAR mõlemad-või-kumbki ·
    `clientErasedAt` nullib kõik · `CaseWorkItem` täpselt üks FK
30. sihtobjekti kustutamine eemaldab seose **igal kolmel sihttüübil**
31. `CaseWorkMissingInfo` `status`/`resolvedAt` invariant mõlemas suunas
32. L5 päritolusõnastik: tundmatu väärtus lükatakse tagasi
33. **P2 piir:** `CaseWorkItem`-il ega `CaseWorkAssist`-il ei ole ülekande- ega ülevaatuse
    seisu välja

**Liides, adapter ja värav**

34. L13: `CASE_WORK` on `SUPPORTED`, adapter omaniku-skoobitud, descriptor E5 kuju järgi
35. juhtumiloendi ja seoste pagineerimine **stabiilse cursor-võtmega** (sama ajatempliga read
    ei kordu ega kao)
36. **L19: väravaga väljas ei ole JUHTUM-V1 kasutajale navigeeritav ega API kaudu kasutatav**
37. HTML või skript tekstiväljas kuvatakse tekstina, mitte markup'ina
38. i18n ET/EN/RU pariteet, 0 hard-coded JSX-teksti

**Sond**

39. sond keeldub tootmis- või tundmatu andmebaasi vastu käivitumast

---

## Väravad ja DoD

`npm test` · `npm run i18n:check` · eslint muudetud failidel · `npm run db:migrate:check` ·
`npm run build` · **`npm run case:probe` päris DB vastu**.

**Skeemimuudatuse järel:** `prisma generate` + dev-serveri restart + üks päris päring. Roheline
sviit fake-prismaga ei tõenda siin midagi. Võõra sessiooni dev-server pordil 3000 hoiab vana
Prisma klienti — kasuta `next start -p 3100` retsepti (S11).

**Valmis on siis, kui** E1–E6 on `main`-is, sond on roheline päris andmebaasi vastu, kaks
töötajat on üksteise juhtumitest tõendatult pimedad, P2 piir ja L20 CHECK-id on testiga lukus,
**`CASEWORK_V1_ENABLED` on vaikimisi väljas ja seda tõendab test 36**, ja `SotsiaalAI.md` S4.1
rida on liikunud TEGEMATA → TEHTUD.

**Push ja deploy ainult omaniku selgel loal.** Deploy'da tohib väravaga väljas — funktsiooni
**avamine** vajab kahte eraldi asja: omaniku luba **ja** Õ2/Õ3 andmekaitseanalüüsi kinnitust.

---

## Lõpetamisel

Uuenda **ainult** `SotsiaalAI.md`: S4.1 juhtumi objekti ja assistendi read, S5 „Poolik"
juhtumitoe rida, S4.3 CASEWORK perekond. Konkureerivat seisufaili ei looda.
