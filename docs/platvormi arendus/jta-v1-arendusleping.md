# ÜLESANNE: `JTA-V1` — juhtumitöö assistent

**Olek:** **`DRAFT`** — ootab omaniku auditit.
**Perekond:** CASEWORK — **P1 jätk + P2**. Ei ole P3 (Meetodipeegel), P4/P5 (kaardid) ega P6
(meetodikataloog).
**Teostus:** üks teema, etapid **E1–E7**. **Töö otse `main`-is** (S11 reegel 1) — harusid ega
worktree-kaustu ei tehta. **Push ja deploy ainult omaniku selgel loal.**
**Kirjeldus („mis asi see on"):** `ideed.md` **ptk 4** (4.2–4.8) — **loe enne E1-e**.
Kõrvale ptk 13 (privaatsusprintsiibid) ja ptk 15 (mida MVP ei sisalda).
**Muu alus:** `juhtum-v1-arendusleping.md` v6 (konteiner, mille peal see seisab) ·
`fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` ptk 10 (paketijaotus) ·
`SotsiaalAI.md` S4.1.

### Versioonilugu

| v | Mis muutus |
|---|---|
| v1 | esimene kuju. Kirjutatud **pärast** `ideed.md` ptk 4 lugemist ja pärast koodi mõõtmist — mitte mälust (JUHTUM-V1 v1 õppetund) |

---

## Miks see leping olemas on

`SotsiaalAI.md` S4.1 kandis juhtumitöö assistendi juures ühte blokeerijat:

> **Mis blokeerib:** üks eeldus — **juhtumi objekt**. Ilma selleta on assistendil laud, aga
> mitte seda, mille ümber laud käib.

**07.08 sai see eeldus täidetud.** JUHTUM-V1 (CASEWORK-P7) ehitas konteineri: `CaseWorkAssist`
koos kliendiviite, järgmise kontakti, STAR-i viite, seoseregistri ja puuduva info loendiga.
Konteiner on koodis ja väravaga peidus.

**Täna on olukord tagurpidi:** on see, mille ümber laud käib, aga lauda ei ole. Juhtumi objekt
on pind, kuhu töötaja peab ise minema ja mille ta peab ise meelde jätma. Assistent on see, mis
teeb temast päeva algusekraani.

---

## Lähteseis — mõõdetud koodist 07.08.2026

| Mõõt | Väärtus | Kust |
|---|---|---|
| `CaseWork*` mudeleid skeemis | **5** | `CaseWorkAssist`, `CaseWorkItem`, `CaseWorkMissingInfo`, `CaseWorkRetentionAudit`, `CaseWorkClientErasureAudit` |
| Teenuskihi faile | **6**, 1221 rida | `lib/casework/` |
| API-marsruute | **8** | `app/api/casework/cases/**` |
| Pindu | **1** | `app/juhtumid/page.jsx` |
| STAR2 ülekande **sõnastik** | **olemas ja kasutamata** | `lib/workspaces/provenance.js` |
| STAR2 ülekande **salvestus** | **0 rida** | — |
| Assistendi laud (ptk 4.3) | **0 rida** | — |
| Kohtumise ettevalmistus (ptk 4.4) | **0 rida** | — |

### Kolm mõõdetud fakti, mis seda lepingut kujundavad

**1. Sõnastik on juba kirjutatud ja ootab keha.** `lib/workspaces/provenance.js` kannab tervet
STAR2 ülekande olekumasinat — `STAR2_TRANSFER_STATE` (6 seisu), `STAR2_REVIEW_KIND`,
`STAR2_TRANSFER_TRANSITIONS`, `canTransitionStar2()`, `isStar2Terminal()`. Faili enda kommentaar
ütleb välja, mis puudu on:

> *„A jump outside the map is illegal (**would be a 409 once the state is persisted in P2**)."*

**E5 ei projekteeri olekumasinat. E5 annab olemasolevale olekumasinale salvestuse.** Teist
sõnastikku ei looda ja `provenance.js`-i ei kopeerita.

**2. O-CW-4 on vastatud teostuse kaudu, mitte otsuse kaudu.** Analüüs küsis: kas ehitada
konteiner `CaseWorkAssist` või adapterid olemasolevate mudelite peale, ja soovitas adaptereid
„kuni tõendatud vajaduseni". **Konteiner on ehitatud.** Küsimus on suletud faktiga — P2
skeemikuju ripub konteineri küljes ja alternatiivi ei kaaluta.

**3. Laua iga sektsioon peale kahe loeb olemasolevat.** Ptk 4.3 loetleb kümme sektsiooni.
Mõõtmine ütleb, kust igaüks tuleb:

| Ptk 4.3 sektsioon | Allikas koodis | Seis |
|---|---|---|
| saabunud eelpöördumised | `listReceivedCaseWork()` | **olemas** |
| tänased vastuvõtud | `PreInquiry` + `nextContactAt` | **olemas** |
| aktiivsed ettevalmistustööd | `listCaseWorkAssists()` `ACTIVE` | **olemas** |
| STAR2-sse kandmist ootavad mustandid | — | **E5** |
| puuduv ja kontrollimist vajav info | `countOpenMissingInfo()`, `listMissingInfo()` | **olemas** |
| järgmised kontaktid | `CaseWorkAssist.nextContactAt` + indeks | **olemas** |
| võrgustikutöö ettevalmistus | `lib/network/share.js` (COLLAB-P4) | **olemas** |
| meetodipeegel | `listPracticeReflectionWorkspaces()` | **olemas** |
| kovisiooni/supervisiooni ettevalmistus | `TopicSeed`, `SupervisionMeeting` | **olemas** |
| STAR2 ülekandmise ajalugu | — | **E6** |

**Kaheksa kümnest on lugemistöö, mitte ehitustöö.** Just seepärast on E1–E2 migratsioonivabad
ja otsustevabad — ja just seepärast käivad nad esimesena.

---

## Otsused, mis omanik langetas 07.08

Kolm küsimust, mis olid lahtised alates CASEWORK-A0-st. `SotsiaalAI.md:727` ütles, et esimest
kahte tuleb küsida koos — küsiti koos.

| Kood | Küsimus | **Vastus 07.08** |
|---|---|---|
| **O-CW-4** | konteiner vs adapterid | *suletud faktiga* — konteiner on ehitatud (JUHTUM-V1) |
| **O-JU-1 + O-CW-2** | juhtumi ja ülekantud mustandi säilitus | **kirjutuskaitse + 12 kuud arhiivis + kustutus** |
| **O-CW-10** | „Kopeeri STAR2 jaoks" auditisügavus | **fakt + väljade loend** (mitte täissnapshot) |

**Ulatuse otsus samal päeval:** üks leping E1–E7, järjestatud nii, et **otsustevaba osa on
ees** ja STAR2-ahel viimane. Põhjus on operatiivne: kui õigusabi kinnitus O-CW-2-le viibib,
jõuab laud ikka valmis ega jää ahela taha ootama.

---

## Piirid — kolm paketti, mida see leping EI neela

JUHTUM-V1 v1 kirjutati kirjeldust lugemata ja oleks alla neelanud terve CASEWORK-P2. Piir
kirjutatakse siin ette, mitte auditi käigus.

| Pakett | Mis | Miks mitte siin |
|---|---|---|
| **P3 Meetodipeegel** | `PracticeReflection` mudel, vahehindamise enum, deidentifitseeritud kovisioonimustand | oma migratsioon, oma otsus (O-CW-3). **E4 privaatne kiht ei ole see mudel** — vt allpool |
| **P5 kaardivaated** | genogramm, ökokaart, võrgustikukaart | leping on eraldi olemas (`t21-casework-vorgustikuvaated-ulesanne.md`), blokeerijad O-CW-7/8/9 |
| **P6 meetodikataloog** | 36 meetodit + valiku-assistent | O-CW-5 = **partner** (ESTA/ülikool), mitte tooteotsus |

### E4 privaatne kiht vs P3 Meetodipeegel — piir, mida ei tohi hägustada

Ptk 4.4 kohtumise märkme kaheksas kiht on *privaatne professionaalne refleksioon*. Ptk 8 kirjeldab
**Meetodipeeglit** kui eraldi mudelit. Need on **kaks eri asja ja E4 ehitab ainult esimese**:

| | E4 privaatne kiht | P3 `PracticeReflection` |
|---|---|---|
| Mis ta on | **kohtumise märkme üks kiht** — tekst | **oma kirje**, meetodi ja vahehindamisega |
| Kuulub | märkmele | töötajale, üle juhtumite |
| Seos | *(P3 tulles)* märkmelt saab refleksiooni **algatada** | `sourceKind`/`sourceId` — **olemasolev väli, uut ei lisata** |

**E4 ei loo `PracticeReflection` rida ega selle eelkäijat.** Kui P3 hiljem tuleb, viitab ta
märkmele olemasoleva `sourceKind`/`sourceId` mustri kaudu — täpselt nagu JUHTUM-V1 leping
(„Tulevased integratsioonipiirid") juba ette näeb.

---

## Mis JTA-V1 on ja ei ole

**On:** sotsiaaltöötaja ja teenuseosutaja **päeva algusekraan juhtumitöö jaoks** — mis on
saabunud, mis ootab, mis on puudu, kellega on järgmine kontakt, mis mustand ootab STAR-i
kandmist. Pluss ühe töö vaade: kohtumise ettevalmistus, kihiline märge, ja mustandi tee
STAR-ini.

**Ei ole:**

- **ametlik juhtumiplaan** — see on STAR-is ja jääb sinna (ptk 4.1)
- **automaatne STAR2-sse saatmine** — V1 tegevus on **„Kopeeri STAR2 jaoks"**, mitte „Saada".
  Ametlik saatmine saab tulla ainult SKA ja TEHIK-uga kokku lepitud liidestuse kaudu (ptk 4.5)
- **kliendiregister** — kliendiotsingut ei ole, klient on JUHTUM-V1 L11 kahe raja mustris
- **teise töötaja vaade** — juhtum on rangelt isiklik ja laud on isiklik. Kaks töötajat on
  üksteise laudadest sama pimedad kui üksteise juhtumitest
- **koormuse mõõdik** — laud ei loenda töötaja tempot, ei näita „mahajäämust" ega jõua ühtegi
  koondisse. Sama arhitektuuriline keeld, mis kehtib tööheaolul
- **AI otsustaja** — assistent struktureerib, pakub küsimusi ja märkab puudujääke. Ta ei määra
  meetodit, ei hinda õigust teenusele ega tee ametlikku hinnangut (ptk 13.3)

---

## Õiguslikud eeldused — märgistatud, mitte tõestatud

JTA-V1 pärib JUHTUM-V1 õigusliku aluse ja **lisab sellele kolm uut isikuandmete kandjat**
(E3 ettevalmistus, E4 märge, E5 mustand). Seda ei esitata koodist mõõdetud faktina.

| # | Väide | Klass |
|---|---|---|
| **Õ1** | `WORKER_DATA_PROCESSING` raamleping katab ka kohtumise ettevalmistuse, märkme ja STAR-i mustandi | `LEGAL_ASSUMPTION` — sama klass ja sama lahtiolek mis JUHTUM-V1 Õ2 |
| **Õ2** | 12-kuuline säilitus on GDPR art. 5(1)(e) mõttes põhjendatud | `OWNER_DECISION` (07.08) — **kinnitada õigusabiga enne aktiveerimist** |
| **Õ3** | Auditisse jääv väljade loend ei ole isikuandmete töötlus, sest ta ei kanna väärtusi | `LEGAL_ASSUMPTION` |

**Sama värav, sama loogika.** JTA-V1 elab `CASEWORK_V1_ENABLED` taga — **uut lippu ei looda.**
Põhjus: assistent ilma juhtumi objektita on mõttetu ja juhtumi objekt ilma assistendita on
poolik; kaks eri lippu tähendaks nelja kombinatsiooni, millest kaks on katkised olekud. Üks
lipp, üks otsus, üks aktiveerimishetk.

---

## Lukustatud otsused

### L1 — Laud on lugeja, mitte teine tõde

Laua koondlugeja **ei salvesta ühtegi rida** ja ei hoia vahemälu. Iga number ja iga rida
tuleb päringu hetkel allikast. Kui allikas muutub, muutub laud; „laua oma seis" ei eksisteeri.

**Miks:** laud, mis hoiab oma koopiat loenduritest, hakkab allikast lahku minema. Esimene kord,
kui laud ütleb „3 puudu" ja juhtum ütleb „2 puudu", ei usu töötaja enam kumbagi.

### L2 — Tühi sektsioon ütleb, MIKS ta tühi on

Ükski laua sektsioon ei kuva vaikset tühja kasti. Kolm eri olekut on kolm eri teksti:

| Olek | Mida kuvatakse |
|---|---|
| allikas on olemas, ridu ei ole | „ühtegi ootel eelpöördumist ei ole" |
| allikas nõuab rolli, mida vaatajal ei ole | „see sektsioon on teenuseosutaja rollile" |
| funktsioon ei ole veel olemas | **sektsiooni EI kuvata üldse** |

**Miks:** tühi kast ja „selle jaoks ei ole veel tööriista" näevad välja ühtemoodi, aga
tähendavad vastupidist. Töötaja, kes näeb tühja „puuduv info" kasti, järeldab et kõik on
korras — kuigi tegelikult ei ole loendit kunagi kogutudki.

### L3 — Laud ei loenda töötajat

Laud kuvab **tööd**, mitte **töötajat**. Keelatud on nimeliselt: mahajäämuse loendur, keskmine
lahendusaeg, „sul on X ülesannet üle tähtaja" punane märgis, võrdlus eelmise perioodiga,
ja igasugune agregaat, mis liigub kellegi teiseni.

**Miks:** ptk 8.8 keeld („ei tohi kasutada töötajate edetabeli ega tulemuslikkuse hindamiseks")
**peab olema arhitektuuris, mitte poliitikas**. Laud on täpselt see koht, kus koormuse mõõdik
tekiks kogemata — sest ta juba loeb kõik allikad kokku.

### L4 — Päritolu on kohustuslik, mitte valikuline

Iga E4 märkme rida ja iga E5 mustandi väli kannab päritolumärgist
`lib/workspaces/provenance.js` kaheksast väärtusest. **Väljakirjutamata rida ei salvestu** —
teenuskiht lükkab tagasi, mitte ei pane vaikeväärtust.

**Vaikeväärtus on keelatud.** Kui tundmatu päritolu saaks vaikimisi `TOOTAJA_TAHELEPANEK`,
muutuks märgis mürarikkaks ja kaotaks tähenduse esimese nädalaga.

**Märgis ei parane ise.** `AI_MUSTAND` → `KLIENDI_KINNITATUD` on **inimese tegu**, mitte
üleminek, mille süsteem teeb. Sama reegel on `provenance.js`-i enda kommentaaris juba kirjas.

### L5 — Kaheksa kihti ei valata kokku

E4 märge kannab ptk 4.4 kaheksat kihti eraldi väljadena, mitte ühe tekstina siltidega:

```
kliendi enda vaade · faktilised asjaolud · töötaja tähelepanek · kontrollimata info
kokkulepped · järgmised sammud · STAR2-sse kantav info · privaatne refleksioon
```

**Ainult kiht „STAR2-sse kantav info" saab jõuda E5 mustandisse.** Ülejäänud seitse ei ole
ekspordiraja peal ja teenuskiht ei paku neile teed sinna.

**Privaatne refleksioon ei lähe STAR2-sse kunagi** (ptk 4.4 lõpurida). See ei ole UI valik —
E6 eksport ei tunne seda välja.

### L6 — STAR2 mustandi olekumasin tuleb `provenance.js`-ist

E5 impordib `STAR2_TRANSFER_STATE`, `STAR2_TRANSFER_TRANSITIONS`, `canTransitionStar2()` ja
`isStar2Terminal()`. **Teist sõnastikku ei kirjutata, väärtusi ei kopeerita ja DB-enum'i ei
tehta** — sama põhjendus, mis on juba `CaseWorkMissingInfo.provenance` juures kirjas.

Ebaseaduslik üleminek annab **409**, mitte 400 — see on olekukonflikt, mitte vigane sisend.
Faili kommentaar näeb selle numbri juba ette.

Kaheksa mustanditüüpi (ptk 4.5) elavad samuti **stringina + validaatorina**, mitte enum'ina:

```
pöördumise kokkuvõte · abivajaduse hindamise mustand · eluvaldkonna kirjeldus
eesmärgi sõnastus · tegevus · vastutaja ja tähtaeg · kohtumise märge · teenuse suunamise alus
```

### L7 — Säilitus (O-JU-1 + O-CW-2): kell käib ainult teadlikust teost

Omaniku vastus on „kirjutuskaitse + 12 kuud arhiivis + kustutus". Selle **jõustamise** kuju on
siin lukus, sest vale kuju kustutaks vaikselt töötaja enda töö.

**Mustandi rada (`CaseWorkDraft`):**

| Samm | Käivitaja | Millal |
|---|---|---|
| kirjutuskaitse | üleminek `ULE_KANTUD`-iks | **kohe**, automaatselt |
| arhiveerimine + kella algus | sama üleminek | **kohe** — `transferredAt` |
| **sisu kustutus** | säilituskell | `transferredAt` + **12 kuud** |

Kustub **mustandi sisu**. Alles jäävad: ülekande fakt, aeg, väljade loend (L8) ja STAR-i
viide, mis elab niikuinii konteineril (`CaseWorkAssist.externalReference`), mitte mustandil.

**Just see ongi varju-registri sulgemine.** Sisu sureb, tõend elab — ja tõend ei ole koopia.

**Juhtumi rada (`CaseWorkAssist`):**

JUHTUM-V1 L14 andis elutsükli `ACTIVE → READ_ONLY → ARCHIVED` ilma automaatikata. JTA-V1 lisab
kella **ainult viimase sammu külge**:

| Reegel | Miks nii |
|---|---|
| **`ARCHIVED` on ja jääb teadlikuks teoks** kohustusliku põhjusega | automaatne arhiveerimine tähendaks, et vaikne juhtum kustub ilma, et keegi otsustaks |
| kell käib **`ARCHIVED`-ist**, mitte viimasest muutmisest | „12 kuud puutumata → kustub" kustutaks pika ja aeglase juhtumitöö, mis ongi valdkonna norm |
| **loendus on juhtumil nähtav** kogu 12 kuu jooksul | — |
| **hoiatus enne kustutust** | teavitus 30 päeva ette, U1 sündmusekihi kaudu |
| **vaikset kustutust ei ole** | — |

**Miks see rida siin nii range on:** juhtum on töötaja **enda** töökorraldus, mitte kliendi
kirje. Automaatne kustutus, millest ta ette teada ei saa, hävitab tema töö — ja erinevalt
STAR-ist ei ole tal kuskilt seda taastada. Säilitusreegel on õige; **vaikne** säilitusreegel
ei ole.

### L8 — „Kopeeri STAR2 jaoks" audit (O-CW-10): fakt + väljade loend

`CaseWorkTransferEvent` salvestab:

| Salvestub | Ei salvestu |
|---|---|
| kes kopeeris (`actorUserId`) | **kopeeritud tekst** |
| millal | väljade **väärtused** |
| millise juhtumi ja mustandi pealt | kliendi nimi ega viide |
| **milliste väljade nimed** kopeeriti | — |
| mustandi tüüp ja seis kopeerimise hetkel | — |

**Miks mitte täissnapshot:** auditikirjed on **append-only** ja seetõttu **ei ulatu ükski
säilitusreegel nendeni**. Täissnapshot tähendaks, et L7 kustutab mustandi sisu 12 kuu pärast,
aga sama sisu elab auditilaua all igavesti. See oleks varju-register, mis on ehitatud täpselt
selle mehhanismi sisse, mis pidi teda ära hoidma.

Sama muster on koodis juba olemas: `CaseWorkClientErasureAudit` kannab kommentaari *„EI SISALDA
kustutatud väärtusi — ei nime, ei välisviidet, ei kuvanime."* L8 on selle laiendus.

### L9 — Kopeerimine ei ole ülekanne

`ULE_KANTUD` seisu paneb **inimene**, mitte kopeerimisnupp. Kopeerimine on lõikelauale
panemine; kas info STAR-i jõudis, teab ainult töötaja, kes seda seal tegi.

**Miks:** kui kopeerimine märgiks automaatselt „üle kantud", käivituks L7 säilituskell hetkest,
mil keegi ainult vaatas — ja mustand kustuks, ilma et ta oleks kuskile jõudnud.

### L10 — Laud ei ava midagi, mida juhtum ei avaks

Laua iga rida on **link olemasolevasse pinda** ja iga päring käib läbi selle allika enda
ligipääsukontrolli. Laud ei tee omaenda `findMany`-t üle juhtumite ega eelpöördumiste.

**Miks:** IDOR 04.08 tekkis täpselt nii — koondvaade tegi oma päringu ja unustas skoobi.
Koondlugeja, mis kutsub `listCaseWorkAssists({ ownerUserId })`, pärib skoobi; koondlugeja, mis
kirjutab oma `prisma.caseWorkAssist.findMany()`, pärib selle vea.

### L11 — Värav on sama, mis JUHTUM-V1-l

`CASEWORK_V1_ENABLED` väljas → laua marsruut vastab `notFound()`-iga, töölaual kaarti ei ole,
API on eristamatu olematust marsruudist. Kogu kontroll käib `guardCaseWorkRequest()` kaudu —
**uut väravafunktsiooni ei kirjutata.**

---

## Lahtised otsused — ükski ei blokeeri ehitust

| Kood | Küsimus | V1 vastus |
|---|---|---|
| **O-JTA-1** | kas laud on oma marsruut (`/toolaud/juhtumitoo`) või töölaua sektsioon | **oma marsruut** — töölaud on juba täis ja laud kannab kümmet sektsiooni |
| **O-JTA-2** | kas kohtumise ettevalmistus on juhtumi küljes või vaba | **juhtumi küljes** (FK) — ilma juhtumita ettevalmistus on jälle konteinerita objekt |
| **O-JTA-3** | mitu ettevalmistust ühe juhtumi kohta | **mitu** — iga kohtumine on oma ettevalmistus |
| **O-CW-3** | refleksiooni ja ametliku dokumentatsiooni piir | **ei ole vaja V1-s** — E4 ehitab märkme kihi, mitte `PracticeReflection` mudeli (vt piir eespool). Otsus jääb P3 ette |

---

## Teostus

### E1 — Laua koondlugeja *(0 migratsiooni, 0 otsust)*

**Fail:** `lib/casework/workbench.js` (uus).

Üks eksport `getCaseWorkbench({ userId, roleState, db })`, mis kutsub olemasolevaid lugejaid ja
paneb kokku kaheksa sektsiooni. **Ühtegi olemasolevat faili ei muudeta.**

| Sektsioon | Kutse |
|---|---|
| saabunud eelpöördumised | `listReceivedCaseWork(userId)` |
| aktiivsed juhtumid | `listCaseWorkAssists({ ownerUserId, retentionState: ACTIVE })` |
| järgmised kontaktid | sama päring, `nextContactAt` järjestuses |
| puuduv info | `listMissingInfo()` + `countOpenMissingInfo()` |
| võrgustikutöö | `lib/network/share.js` lugeja |
| meetodipeegel | `listPracticeReflectionWorkspaces(userId)` |
| kovisioon/supervisioon | `TopicSeed` + `SupervisionMeeting` lugejad |
| *(STAR2 mustandid)* | **E5-s** — kuni selleta sektsiooni **ei ole** (L2) |

**Nõuded:** L1 (ei salvesta) · L3 (ei loenda töötajat) · L10 (ei tee oma `findMany`-t) ·
päringud paralleelselt, üks aeglane allikas ei blokeeri lauda · ühe allika viga annab **selle
sektsiooni** veaoleku, mitte tühja lauda.

**Testileping:** võõra kasutaja andmeid ei jõua ühessegi sektsiooni · iga sektsioon eristab
„tühi" ja „ligipääsuta" · ühe allika erind ei kukuta koondit · rollita kutse annab tühja
tulemuse, mitte erindi.

### E2 — Laua pind *(0 migratsiooni)*

**Failid:** `app/toolaud/juhtumitoo/page.jsx` · `app/api/casework/workbench/route.js` ·
ET/EN/RU tekstid · töölaua kaart (UI-lipu ja rolli taga) · **ⓘ juhend kolmes keeles**.

Juhend ütleb piirid välja, sama kujuga nagu `/juhtumid` oma: laud on isiklik · ei ole
koormuse mõõdik · ei näita kellegi teise tööd · AI ei otsusta.

**Testileping:** värav väljas → `notFound()` · vale roll → 403 · HTML tekstiväljas kuvatakse
tekstina · i18n pariteet kolmes keeles.

### E3 — Kohtumise ettevalmistus *(migratsioon)*

**Mudel:** `CaseWorkMeetingPrep` (`ideed.md` ptk 12 nimi — uut ei leiutata), FK juhtumile,
`onDelete: Cascade`.

Väljad ptk 4.4 järgi: kohtumise eesmärk · täpsustavad küsimused · puuduva info viide · kliendiga
kontrollitavad väited · vajalikud dokumendid · käsitletavad eluvaldkonnad · päevakord · lihtsas
keeles selgitused.

**Nõuded:** kirjutuskaitse pärib juhtumilt (JUHTUM-V1 L14 — `READ_ONLY`/`ARCHIVED` keelab ka
laste muutmise) · täpsustavad küsimused kannavad päritolu (L4) · AI koostatud osa kannab
`AI_MUSTAND` märgist ja seda ei saa vaikselt maha võtta.

### E4 — Kohtumise märge kaheksa kihiga *(migratsioon)*

**Mudel:** `CaseWorkMeetingNote`, FK juhtumile, valikuline FK ettevalmistusele.

**Nõuded:** L5 (kaheksa eraldi välja) · L4 (päritolu ridade tasemel) · privaatne refleksioon ei
ole ekspordirajal · kirjutuskaitse pärib juhtumilt.

**Piir:** ei loo `PracticeReflection` rida ega selle eelkäijat (vt piir eespool).

### E5 — STAR2 mustandi ahel *(migratsioon — CASEWORK-P2 tuum)*

**Mudel:** `CaseWorkDraft` (ptk 12 nimi), FK juhtumile.

Väljad: `draftType` (8 väärtust, string + validaator) · `transferState`
(`provenance.js`-ist, L6) · `reviewKind` · `sourceLabels` (päritolu) · `transferredAt` ·
`archivedAt` · `contentPurgedAt`.

**Nõuded:** L6 (sõnastik imporditakse, ebaseaduslik üleminek = 409) · L7 (kirjutuskaitse +
kell + nähtav loendus) · terminaalsed seisud on terminaalsed ka andmebaasi CHECK-i tasemel ·
**R2 sulgemine:** `AgentArtifact`-ile antakse retention-klass, mis täna puudub.

### E6 — „Kopeeri STAR2 jaoks" + ülekandeajalugu *(migratsioon)*

**Mudel:** `CaseWorkTransferEvent` (ptk 12 nimi), **append-only** — update- ja delete-API-t ei
eksisteeri.

**Nõuded:** L8 (fakt + väljade loend, väärtusi ei salvestu) · L9 (kopeerimine ≠ ülekanne) ·
laua sektsioon „STAR2 ülekandmise ajalugu" lülitub sisse · U1 sündmus
`artifact.external_transfer_marked`.

**Väljundi tekst kannab hoiatust:** kopeeritud plokk algab reaga, et tegemist on ettevalmistava
mustandiga ja ametlik kanne sünnib STAR-is.

### E7 — Tõend

**Sond:** `npm run jta:probe` — päris andmebaasi ja **vähemalt kahe päris sessiooni** vastu,
HTTP kaudu (04.08 IDOR-i õppetund: teenuskihi otsekutse ei tõenda ligipääsupiiri).

Sond tõendab nimeliselt:

1. kaks töötajat on üksteise laudadest pimedad
2. võõra juhtumi ettevalmistus/märge/mustand vastab **„ei leitud"**, mitte „ei tohi"
3. kirjutuskaitstud juhtumi laps ei muutu
4. privaatne refleksioon **ei esine** E6 väljundis üheski vormis
5. auditirida ei sisalda ühtegi kopeeritud väärtust
6. ebaseaduslik üleminek annab 409
7. säilituskell arvutab `ARCHIVED`-ist, mitte `updatedAt`-ist
8. värav väljas → kõik marsruudid 404

**Brauseris päris sessiooniga:** laua avamine · ettevalmistuse koostamine · märkme kaheksa
kihti · mustandi tee `MUSTAND → ULE_KANTUD` · kopeerimine · ajalugu.

---

## Selgelt väljas

Automaatne STAR2 saatmine (ptk 4.8 — vajab SKA + TEHIK liidestust) · `PracticeReflection`
mudel (P3) · genogramm, ökokaart, võrgustikukaart (P5) · meetodikataloog ja meetodi-valiku
assistent (P6) · kliendi tagasiside (ptk 8.6, omaniku otsuse taga) · sekkumispäevik (ptk 8.5) ·
juhtumi üleandmine kolleegile (O-JU-2) · org-koondid refleksiooniandmetest (O-CW-6 vaikekeeld) ·
push, deploy, tootmisandmete lugemine.

---

## Väravad ja DoD

**Enne igat commit'i:** `npm test` · `npm run i18n:check` · eslint muudetud failidel ·
skeemimuudatusel `npm run db:migrate:check`.

**Enne E3/E5/E6 commit'i lisaks:** `npx prisma generate` + dev-serveri restart + **üks päris
päring** — fake-prisma ei valideeri skeemi ja roheline sviit ei tõenda siin midagi.

**DoD:** kõik väravad rohelised · `npm run jta:probe` täies mahus roheline päris andmebaasi
vastu · brauseri läbisõit tehtud · `SotsiaalAI.md` S4.1 ja S5 uuendatud · **värav jääb välja**.

**Migratsioone lisandub kolm või neli** (E3, E4, E5, E6) — iga üks eraldi, mitte kokku
liidetuna. Iga migratsioon lisab isikuandmete kandja ja väärib oma ülevaatust.

## Lõpetamisel

Kanna `SotsiaalAI.md`-sse: mis liikus TEHTUD / POOLIK / TEGEMATA vahel · mis saba jäi lahti ·
mis jäi `NOT_PROVEN` · O-JU-1/O-CW-2/O-CW-10 vastuste kanne S4-sse. **Teostuslugu ei kanta** —
TEHTUD kirjeldus on lõik või kaks sellest, mida funktsioon inimese jaoks teeb.
