# ÜLESANNE: `JTA-V1` — juhtumitöö assistent

**Olek:** **E1–E2 TEHTUD** (E2 08.08, brauseris tõendatud).
**E3–E5 `READY_TO_ASSIGN` — roheline tuli omaniku viiendalt auditilt 08.08 (v6).**
**E6–E7 `READY_TO_ASSIGN`, aga nende lõplik lukk ootab O-JTA-5 vastust** (vt „Lahtine otsus").
**23 lukustatud otsust, 8 etappi, 4 migratsiooni.**
**Perekond:** CASEWORK — **P1 jätk + P2**. Ei ole P3 (Meetodipeegel), P4/P5 (kaardid) ega P6
(meetodikataloog).
**Teostus:** üks teema, etapid **E1–E8**. **Töö otse `main`-is** (S11 reegel 1) — harusid ega
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
| **v2** | **omaniku audit — 6 blokeerivat + 6 täpsustust.** Kandvad muutused: (a) E3–E6 said täieliku teostuslepingu `teenus → API → pind → värav → valideerimine → testid`; (b) laua sektsioonid said **ühe kanoonilise tabeli** (L12) — kaks vastuolulist loendit kadusid; (c) **säilituse jõustamine sai oma etapi E7**, varem oli otsus ilma mehhanismita; (d) **L6 parandatud — SQL CHECK ei oska olekuüleminekut**, jõustab tingimuslik update; (e) **L8 parandatud — v1 väide „säilitusreegel ei ulatu auditini" oli vale** ja vastuolus sellega, et audit ripub kustuva juhtumi küljes; (f) päritolu sai **normaliseeritud kuju** (L4), varem oleks kaheksa tekstivälja lepingut täitnud ja L4 rikkunud |
| **v3** | **omaniku teine audit — 1 blokeeriv + 4 täpsustust.** (a) **KELLA VIGA:** v2 hoiatus kirjutas `CaseWorkRetentionAudit`-i uue `toState = ARCHIVED` rea, mis nihutas kustutuse 12 → 23 kuuni. Parandatud kahes kohas — kell otsib **päris üleminekut** ja hoiatus **ei kirjuta auditisse üldse** (L17); (b) **E3 regressioon taastatud** — v2 refaktor kaotas kogemata päritolu-, `AI_MUSTAND`- ja puuduva info nõuded; (c) L5 sõnastus lepitatud O-JTA-4-ga; (d) **`markTransferred` tehingupiir lukus** (L18); (e) hoiatus on **30 päeva**, mitte 11 kuud |
| **v5** | **omaniku neljas audit — esimene, mis vaatas KOODI, mitte lepingut.** Kaks P0-d ja kolm leidu valminud E1-s: (a) **`estonianDayBounds()` sõltus serveri ajavööndist** — kommentaar ütles „Europe/Tallinn", arvutus kasutas serveri lokaalset parsingut ja päeva lõpuks `+24 h`. UTC-serveris nihkus Eesti päev suvel 3 tundi ja DST-päevad (23 h / 25 h) olid valed mõlemas vööndis; (b) **lapse kirjutuskaitses oli võistlus** — `requireActiveCase()` oli EELKONTROLL, mitte jõustaja, ja `transitionRetention()` mahtus kontrolli ja kirjutuse vahele. Mõlemad vead olid nähtamatud arendusmasinal, mille vöönd on juhtumisi `Europe/Tallinn`. Lisandusid **L20** (deskriptor) ja **L21** (lapse kirjutuse atomaarsus) |
| **v4** | **omaniku kolmas audit — 1 blokeeriv + 2 täpsustust.** (a) **KAKS TEED `ULE_KANTUD`-ini:** v3 L18 lubas garantiid, mille E5 avalik `POST …/transition` oleks ümbert läbi lasknud — mustand oleks jõudnud `ULE_KANTUD`-i **ilma auditireata** ja säilituskell oleks hakanud käima tõendita ülekande peal. Kolm kihti, üks tee (L19); (b) `confirm-provenance` marsruut oli **nimetatud, aga API-loendist puudu**; (c) **prep-i väljad said oma tabeli** — üks jäme `provenance` terve ettevalmistuse peal ei suutnud väljendada „`agenda` = töötaja, `plainLanguageNotes` = AI", kuigi leping ise ütleb „AI koostatud **osa**". **Staatus kinnitatud.** |
| **v6** | **omaniku viies audit — 2 uut otsust, 1 uus lukk, 1 dokumendiparandus. E2–E5 said rohelise tule.** (a) **`COPIED_FOR_STAR2` auditil puudus idempotentsusvõti** — L16 kirjeldas ausalt juhtu „lõikelaud õnnestus, audit ebaõnnestus", aga mitte selle **teist serva**: kui klient ei tea, kas `POST` jõudis kohale, teeb ta korduse ja tekib **kaks auditirida ühe päris kopeerimise kohta**. `markTransferred` oli kaitstud tingimusliku siirdega (L6/L18), `recordCopyEvent` **ei olnud millegagi** — append-only ilma võtmeta. Uus **L22**; (b) **arhiveerimine käivitab 12 kuu kella, aga UI ei ütle seda tegemise hetkel** — olemasolev `casework.page.retention_hint` ütleb ainult „ühesuunaline, tagasiteed ei ole". 30 päeva hoiatus on aus, aga saabub siis, kui otsust enam muuta ei saa. Uus **L23**; (c) **O-JTA-5 — hüljatud töömaterjali säilitus**: L7 jätab `MUSTAND` ja `EI_KANTA` teadlikult kellata, aga Õ2 12-kuuline reegel katab ainult **ülekantud** sisu. Aastaid aktiivne juhtum hoiab aastaid vana ettevalmistavat teksti. **See on eraldi andmeminimeerimise küsimus, mitte Õ2 alamhulk**; (d) pealkiri „Lahtised otsused — ükski ei blokeeri ehitust" oli eksitav, sest O-JTA-1…4 kandsid juba V1 vastuseid — teostaja jaoks tähendab „lahtine" tavaliselt „sul ei ole õigust valida". Ümber nimetatud |

**Neli minu enda viga on selles ahelas parandatud, mitte lünka.** L6 lubas andmebaasi CHECK-ilt
garantiid, mida `CHECK` anda ei saa. L8 väitis, et säilitusreegel ei ulatu auditikirjeteni, aga
audit rippus juhtumi küljes, mis säilitusreegli lõpus kustub. v2 hoiatusmehhanism nullis kella,
mida ta pidi teenindama. **Ja v3 L18 lubas ainsat teed `ULE_KANTUD`-ini samal ajal, kui E5 hoidis
teist ust lahti.**

Muster on läbi nelja versiooni sama: **iga kord, kui leping ütles „garantii", aga jõustaja jäi
nimetamata, oli garantii katki.** Just seepärast kannab iga etapp nüüd rida
`teenus → API → pind → värav → valideerimine → testid` ja iga L-otsus nimetab, **kes** teda
jõustab.

**v5 näitas sama mustri teist poolt: jõustaja võib olla nimetatud ja ikkagi vale kohas.** L14
ütles, et kirjutuskeeld laieneb lastele, ja teostus tegi kontrolli — ainult et kirjutuse EES,
mitte SEES. Kommentaar `estonianDayBounds()` kohal ütles „Europe/Tallinn" ja arvutus mõõtis
serveri vööndit. **Kaks korda oli kood täpselt nii kirjutatud, nagu leping nõudis, ja ikkagi
vale.** Sellepärast lisandus v5-ga tõendamise reegel: iga selline garantii vajab testi, mis
**kukub vana teostuse peal** — mitte ainult testi, mis uuel roheline on.

**v6 näitas kolmandat kuju: garantii oli õige, aga ainult ühe servajuhu kohta.** L16 kirjeldas
täpselt ja ausalt, mis juhtub, kui audit ebaõnnestub — ja jättis kirjeldamata, mis juhtub, kui
klient **ei tea**, kas ta ebaõnnestus. Sama kuju kannab L23: „ühesuunaline, tagasiteed ei ole"
on tõsi, aga ta ei ütle, **mis kell käima hakkab**. Reegel, mis siit tuleb: iga koht, kus leping
kirjeldab tõrget, peab kirjeldama ka **korduse** ja **kasutaja teadmatuse** — need on eri asjad
ja ainult üks neist oli kirjas.

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
| Pindu | **1** | `app/juhtumid/page.jsx` — **detailvaadet ei ole** |
| STAR2 ülekande **sõnastik** | **olemas ja kasutamata** | `lib/workspaces/provenance.js` |
| STAR2 ülekande **salvestus** | **0 rida** | — |
| Assistendi laud (ptk 4.3) | **0 rida** | — |
| Kohtumise ettevalmistus (ptk 4.4) | **0 rida** | — |

### Neli mõõdetud fakti, mis seda lepingut kujundavad

**1. Sõnastik on juba kirjutatud ja ootab keha.** `lib/workspaces/provenance.js` kannab tervet
STAR2 ülekande olekumasinat — `STAR2_TRANSFER_STATE` (6 seisu), `STAR2_REVIEW_KIND`,
`STAR2_TRANSFER_TRANSITIONS`, `canTransitionStar2()`, `isStar2Terminal()`. Faili enda kommentaar
ütleb välja, mis puudu on:

> *„A jump outside the map is illegal (**would be a 409 once the state is persisted in P2**)."*

**E5 ei projekteeri olekumasinat. E5 annab olemasolevale olekumasinale salvestuse.**

**2. Tingimuslik update on juba majamuster.** `updateCaseWorkAssist()` ja `transitionRetention()`
kannavad mõlemad kommentaari, mis ütleb reegli välja: *„TINGIMUSLIK UPDATE, mitte
loe-kontrolli-kirjuta… Vahepeal tehtud retention-siire peab kirjutuse tapma, mitte kaotama."*
**E5 olekusiire kasutab sama mustrit** — uut ei leiutata (vt L6).

**3. O-CW-4 on vastatud teostuse kaudu.** Analüüs küsis: konteiner või adapterid, ja soovitas
adaptereid „kuni tõendatud vajaduseni". **Konteiner on ehitatud.** Küsimus on suletud faktiga.

**4. Kaks laua allikat ei ole täna loetavad selles kujus, mida laud vajab.** Mõõdetud:

| Laua vajadus | Olemasolev lugeja | Miks ei kõlba |
|---|---|---|
| järgmised kontaktid, ajajärjestuses | `listCaseWorkAssists()` | sordib `updatedAt DESC`; indeks `[ownerUserId, nextContactAt]` **on olemas ja lugejata** |
| puuduv info üle juhtumite | `countOpenMissingInfo()`, `listMissingInfo()` | mõlemad võtavad `caseWorkAssistId` — üle juhtumite oleks N+1 |

**Mõlemale tuleb uus lugeja OMANIKU-MOODULISSE**, mitte lauda (L10).

---

## Otsused, mis omanik langetas 07.08

| Kood | Küsimus | **Vastus** |
|---|---|---|
| **O-CW-4** | konteiner vs adapterid | *suletud faktiga* — konteiner on ehitatud |
| **O-JU-1 + O-CW-2** | juhtumi ja ülekantud mustandi säilitus | **kirjutuskaitse + 12 kuud arhiivis + kustutus** |
| **O-CW-10** | „Kopeeri STAR2 jaoks" auditisügavus | **fakt + väljade loend** (mitte täissnapshot) |

**Ulatuse otsus:** üks leping, järjestatud nii, et **otsustevaba osa on ees** ja STAR2-ahel
viimane. Kui õigusabi kinnitus O-CW-2-le viibib, jõuab laud ikka valmis.

---

## Piirid — kolm paketti, mida see leping EI neela

| Pakett | Mis | Miks mitte siin |
|---|---|---|
| **P3 Meetodipeegel** | `PracticeReflection` mudel, vahehindamise enum | oma migratsioon, oma otsus (O-CW-3) |
| **P5 kaardivaated** | genogramm, ökokaart, võrgustikukaart | leping eraldi olemas, blokeerijad O-CW-7/8/9 |
| **P6 meetodikataloog** | 36 meetodit + valiku-assistent | O-CW-5 = **partner**, mitte tooteotsus |

### E4 privaatne kiht vs P3 Meetodipeegel

Ptk 4.4 kohtumise märkme kaheksas kiht on *privaatne professionaalne refleksioon*. Ptk 8 kirjeldab
**Meetodipeeglit** kui eraldi mudelit. **E4 ehitab ainult esimese.**

| | E4 privaatne kiht | P3 `PracticeReflection` |
|---|---|---|
| Mis ta on | **märkme üks kiht** — normaliseeritud rida | **oma kirje**, meetodi ja vahehindamisega |
| Kuulub | märkmele | töötajale, üle juhtumite |
| Seos | *(P3 tulles)* märkmelt saab refleksiooni **algatada** | `sourceKind`/`sourceId` — **olemasolev väli** |

---

## Mis JTA-V1 on ja ei ole

**On:** sotsiaaltöötaja ja teenuseosutaja **päeva algusekraan juhtumitöö jaoks**, pluss ühe töö
vaade: kohtumise ettevalmistus, kihiline märge, mustandi tee STAR-ini.

**Ei ole:** ametlik juhtumiplaan (see on STAR-is) · automaatne STAR2-sse saatmine (V1 tegevus on
**„Kopeeri STAR2 jaoks"**) · kliendiregister · teise töötaja vaade · **koormuse mõõdik** ·
AI otsustaja (struktureerib ja küsib, ei määra meetodit ega hinda õigust teenusele).

---

## Õiguslikud eeldused — märgistatud, mitte tõestatud

| # | Väide | Klass |
|---|---|---|
| **Õ1** | `WORKER_DATA_PROCESSING` raamleping katab ka ettevalmistuse, märkme ja mustandi | `LEGAL_ASSUMPTION` |
| **Õ2** | 12-kuuline säilitus on GDPR art. 5(1)(e) mõttes põhjendatud | `OWNER_DECISION` (07.08) — **kinnitada õigusabiga enne aktiveerimist** |
| **Õ3** | Auditisse jääv väljade **loend** ei kanna isikuandmete sisu | `LEGAL_ASSUMPTION`. **NB:** auditirida ise on isikuandmetega seotud töötaja ja juhtumi kaudu — vt L8 |

**Sama värav:** `CASEWORK_V1_ENABLED` — **uut lippu ei looda.**

---

## Lukustatud otsused

### L1 — Laud on lugeja, mitte teine tõde

Koondlugeja **ei salvesta ühtegi rida** ja ei hoia vahemälu. Kui allikas muutub, muutub laud;
„laua oma seis" ei eksisteeri.

### L2 — Tühi sektsioon ütleb, MIKS ta tühi on

| Olek | Mida kuvatakse |
|---|---|
| `EMPTY` — allikas olemas, ridu ei ole | „ühtegi ootel eelpöördumist ei ole" |
| `FORBIDDEN` — allikas nõuab rolli, mida vaatajal ei ole | „see sektsioon on teenuseosutaja rollile" |
| `TIMEOUT` — allikas ei vastanud tähtajaks (L13) | „ei õnnestunud laadida, proovi uuesti" |
| `ERROR` — allikas viskas erindi | sama tekst mis `TIMEOUT`, logi kannab põhjust |
| *funktsiooni ei ole veel olemas* | **sektsiooni EI kuvata üldse** (L12 tabel) |

Tühi kast ja „selle jaoks ei ole veel tööriista" näevad ühesugused välja, aga tähendavad
vastupidist.

### L3 — Laud ei loenda töötajat

Keelatud nimeliselt: mahajäämuse loendur · keskmine lahendusaeg · „X ülesannet üle tähtaja"
punane märgis · võrdlus eelmise perioodiga · igasugune agregaat, mis liigub kellegi teiseni.

Ptk 8.8 keeld peab olema **arhitektuuris, mitte poliitikas** — ja laud on täpselt see koht, kus
koormuse mõõdik tekiks kogemata, sest ta juba loeb kõik allikad kokku.

### L4 — Päritolu on normaliseeritud rida, mitte tekstivälja kõrvalveerg

**v2 parandus.** v1 nõudis, et „iga rida kannab päritolu", aga jättis andmekuju lahti — kaheksa
`Text` välja oleks lepingu kirjatähte täitnud ja L4 sisu rikkunud, sest ühe välja kohta üks
päritolu ei ütle midagi selle sees oleva kolme lõigu kohta.

**Kuju on lukus ja ta on normaliseeritud:**

| Kandja | Laps | Päritolu asub |
|---|---|---|
| `CaseWorkMeetingPrep` | `CaseWorkMeetingPrepField` · `CaseWorkQuestion` | **iga välja ja iga küsimuse real**, `NOT NULL` |
| `CaseWorkMeetingNote` | `CaseWorkMeetingNoteEntry` | **iga kirje real**, `NOT NULL` |
| `CaseWorkDraft` | `CaseWorkDraftField` | **iga välja real**, `NOT NULL` |

**Kolm kandjat, üks muster (v4).** Ettevalmistus, märge ja mustand käituvad ühtemoodi ja seda
ei otsustata igaühe juures eraldi. **Vanem ei kanna teksti üldse** — ta on konteiner, kogu sisu
elab lastes. Kolm tagajärge, mis kõik on soovitud:

1. **L4 muutub skeemi faktiks**, mitte teenuskihi kombeks — päritoluta rida ei mahu tabelisse
2. **L5 kihipiir on andmebaasis** — `layer` on lapse veerg, mitte vanema väljanimi
3. **L7 sisu kustutus on `deleteMany` laste peal** — vanem jääb alles koos `contentPurgedAt`-iga,
   seega ükski viide temale ei jää rippuma (vt L8)

**Vaikeväärtus on keelatud.** Tundmatu päritolu ei muutu vaikselt `TOOTAJA_TAHELEPANEK`-uks —
teenuskiht lükkab tagasi. **Märgis ei parane ise:** `AI_MUSTAND` → `KLIENDI_KINNITATUD` on
inimese tegu, mitte üleminek, mille süsteem teeb.

### L5 — Kaheksa kihti ei valata kokku

`CaseWorkMeetingNoteEntry.layer` kannab ptk 4.4 kaheksat väärtust (string + validaator, mitte
DB-enum — sama põhjendus mis `provenance`-il):

```
KLIENDI_VAADE · FAKTID · TOOTAJA_TAHELEPANEK · KONTROLLIMATA
KOKKULEPPED · JARGMISED_SAMMUD · STAR2_KANTAV · PRIVAATNE_REFLEKSIOON
```

**Täpne sõnastus (v3 — v1/v2 kuju luges vastuolus O-JTA-4-ga):** *E4 märkme kihtidest jõuab E5
mustandisse ainult `STAR2_KANTAV`. Mustandi võib E5-s luua ka **iseseisvalt, ilma ühegi märketa**,
ja siis kannavad tema väljad oma päritolu `CaseWorkDraftField.provenance`-is.*

Kaks väidet ei ole vastuolus: L5 piirab **teed märkmest mustandisse**, O-JTA-4 lubab **mustandit
ilma märketa**. Ptk 4.5 kaheksa elementi ei eelda kohtumist — „teenuse suunamise alus" võib
sündida ilma ühegi kohtumiseta.

Ülejäänud seitse kihti ei ole ekspordirajal ja teenuskiht ei paku neile teed sinna.
**`PRIVAATNE_REFLEKSIOON` ei lähe STAR2-sse kunagi** — E6 eksport ei tunne seda väärtust ja E8
sond tõendab selle nimeliselt.

### L6 — Olekusiirde jõustab tingimuslik update, MITTE andmebaasi CHECK

**v2 parandus — v1 väide oli tehniliselt vale.** v1 ütles „terminaalsed seisud on terminaalsed
ka andmebaasi CHECK-i tasemel". SQL `CHECK` näeb **rea uut väärtust**, mitte seda, millisest
seisust sinna jõuti. `CHECK` ei suuda väljendada „`ULE_KANTUD` → mitte kunagi `MUSTAND`".

Töö on jaotatud kahe mehhanismi vahel:

| Mehhanism | Mida ta jõustab |
|---|---|
| **DB CHECK** | et `transferState` on lubatud **väärtus** ja et `MUSTAND`-il ei ole `transferredAt`-i |
| **Tingimuslik update teenuskihis** | et **üleminek** on lubatud |

```
UPDATE ... WHERE id = ? AND caseWorkAssistId = ? AND transferState = <expectedFrom>
0 rida muudetud → 409
```

`expectedFrom` tuleb kutsest, mitte eelnevast lugemisest. See lahendab korraga kaks asja:
ebaseaduslik üleminek annab 409, **ja** kaks samaaegset päringut, mis mõlemad lugesid sama vana
seisu ja mõlemad läbisid `canTransitionStar2()`, ei saa mõlemad õnnestuda.

**Muster on majas olemas** — `transitionRetention()` teeb täpselt seda ja kannab põhjenduse
kommentaaris. `canTransitionStar2()` jääb **eelkontrolliks**, mis annab ausa veateate; ta ei ole
jõustaja.

Kaheksa mustanditüüpi (ptk 4.5) elavad stringina + validaatorina:

```
POORDUMISE_KOKKUVOTE · ABIVAJADUSE_HINDAMINE · ELUVALDKONNA_KIRJELDUS · EESMARGI_SONASTUS
TEGEVUS · VASTUTAJA_JA_TAHTAEG · KOHTUMISE_MARGE · TEENUSE_SUUNAMISE_ALUS
```

### L7 — Säilitus (O-JU-1 + O-CW-2): kell käib ainult teadlikust teost

**Mustandi rada:**

| Samm | Käivitaja | Millal |
|---|---|---|
| kirjutuskaitse | üleminek `ULE_KANTUD`-iks | **kohe**, samas tehingus |
| kella algus | sama üleminek | `transferredAt` |
| **sisu kustutus** | säilitustöö (E7) | `transferredAt` + **12 kuud** |

Kustub **sisu** — `CaseWorkDraftField` read. Alles jääb mustandi rida koos `contentPurgedAt`-iga,
ülekande fakt, väljade loend (L8) ja STAR-i viide, mis elab konteineril, mitte mustandil.

**Just see ongi varju-registri sulgemine.** Sisu sureb, tõend elab — ja tõend ei ole koopia.

**Mustand, mida kunagi üle ei kanta** (`MUSTAND`, `EI_KANTA`) ei saa oma kella ja **see on
tahtlik**: ettevalmistav mustand on töötaja töömaterjal, mitte STAR-i koopia. Ta kustub koos
juhtumiga (L15 kaskaad), mitte enne.

> **v6 aus piirang (omaniku viies audit).** See otsus lahendab varju-registri probleemi, aga
> **ei ole andmeminimeerimise vastus**. Juhtum ise kustub 12 kuud pärast `ARCHIVED`-it; juhtum,
> mis püsib aastaid `ACTIVE` või `READ_ONLY`, hoiab **aastaid** vana ettevalmistavat teksti,
> milles on kliendi sisu. Õ2 kinnitus katab **ülekantud** sisu 12 kuu reeglit ja see küsimus
> jääb tema alt välja. Vastus on **O-JTA-5** ja ta **blokeerib E7 lõpliku luku**, mitte E2–E6
> ehitust.

**Juhtumi rada:**

| Reegel | Miks nii |
|---|---|
| **`ARCHIVED` on ja jääb teadlikuks teoks** kohustusliku põhjusega | automaatne arhiveerimine tähendaks, et vaikne juhtum kustub ilma otsuseta |
| kell käib **päris üleminekust `ARCHIVED`-i** (L17), mitte `updatedAt`-ist | „12 kuud puutumata → kustub" tapaks pika ja aeglase juhtumitöö, mis ongi valdkonna norm |
| **loendus on juhtumil nähtav** kogu 12 kuu jooksul | — |
| **hoiatus 30 päeva ette** — `warningAt = deletionAt − 30 päeva` | **v3 parandus:** v2 rakendas „`ARCHIVED` + 11 kuud", mis ei ole sama asi. Kalendrikuu on 28–31 päeva ja lubadus oli antud päevades — lubadus ja teostus peavad olema identsed |
| **vaikset kustutust ei ole** | — |

Juhtum on töötaja **enda** töökorraldus, mitte kliendi kirje. Automaatne kustutus, millest ta
ette teada ei saa, hävitab tema töö — ja erinevalt STAR-ist ei ole tal seda kuskilt taastada.

**Jõustamine on E7 ja tal on oma DoD.** Otsus ilma mehhanismita ei ole säilitusreegel.

### L8 — Ülekandeaudit: fakt + väljade loend, ja tema eluiga on juhtumi eluiga

**v2 parandus — v1 väide „säilitusreegel ei ulatu nendeni" oli vale** ja vastuolus iseendaga:
audit rippus juhtumi küljes, mis säilitusreegli lõpus kustub.

**Aus sõnastus:** audit elab üle **mustandi sisu**, mitte üle **juhtumi**. Kui juhtum kustub,
kustub kõik — ja just see teeb kustutuse päris kustutuseks.

`CaseWorkTransferEvent` salvestab:

| Salvestub | Ei salvestu |
|---|---|
| `kind` — `COPIED_FOR_STAR2` või `MARKED_AS_TRANSFERRED` (L9) | **kopeeritud tekst** |
| kes (`actorUserId`), millal | väljade **väärtused** |
| juhtumi ja mustandi id | kliendi nimi ega viide |
| **milliste väljade `fieldKey`-d** kopeeriti | — |
| mustandi tüüp ja seis kopeerimise hetkel | — |

**FK-semantika on lukus** (v1 jättis selle lahti):

| Viide | `onDelete` | Miks |
|---|---|---|
| `caseWorkAssistId` | **`Cascade`** | sama muster mis `CaseWorkRetentionAudit`-il ja `CaseWorkClientErasureAudit`-il. Juhtumi kustutus peab olema **täielik** |
| `draftId` | **`Cascade`** | ei jää kunagi rippuma, sest **mustandi rida ei kustu sisu purge'imisel** (L7) — kustuvad ainult `CaseWorkDraftField` read |
| `actorUserId` | **FK-ta `String`** | sama muster mis `DataAuditLog`-il: auditirida ei tohi kaduda kasutaja kustutamisest |

**Miks mitte täissnapshot:** auditikirjed on append-only ja neil ei ole oma säilituskella.
Täissnapshot tähendaks, et L7 kustutab mustandi sisu 12 kuu pärast, aga sama sisu elab auditi
all kuni juhtumi lõpuni. See oleks varju-register, ehitatud selle mehhanismi sisse, mis pidi
teda ära hoidma.

**Õ3 aus piirang:** auditirida **on** isikuandmetega seotud — töötaja kaudu kindlasti, juhtumi
identifikaatori kaudu potentsiaalselt. Väide ei ole „see ei ole isikuandmed", vaid „see ei kanna
kliendi **sisu**". Just seepärast on tema eluiga seotud juhtumi elueaga, mitte igavene.

### L9 — Kopeerimine ei ole ülekanne, ja need on kaks eri sündmust

`ULE_KANTUD` seisu paneb **inimene**, mitte kopeerimisnupp.

| Tegu | `CaseWorkTransferEvent.kind` | U1 sündmus |
|---|---|---|
| „Kopeeri STAR2 jaoks" | `COPIED_FOR_STAR2` | **ei ole** |
| „Märgi üle kantuks" | `MARKED_AS_TRANSFERRED` | `casework.draft.external_transfer_marked` |

**v2 parandus:** v1 tekitas ühe sündmuse `artifact.external_transfer_marked` etapis, kus
realiseeriti kopeerimine — audit oleks võinud väita „üle kantud", kui info läks ainult
lõikelauale. Kaks eri fakti, kaks eri nime.

Kui kopeerimine märgiks automaatselt „üle kantud", käivituks L7 säilituskell hetkest, mil keegi
ainult vaatas, ja mustand kustuks, ilma et ta oleks kuhugi jõudnud.

### L10 — Laud ei tee oma skoopimata päringut

Laua koondlugeja **ei kirjuta ühtegi `prisma.*.findMany()`-t**. Iga sektsioon kutsub omaniku-mooduli
lugejat, mis kannab skoopi juba täna.

**Uute lugejate lisamine omaniku-moodulisse on LUBATUD ja vajalik** (v2 täpsustus — v1 sõnastus
luges nii, nagu oleks keelatud). Kaks tulevad E1-s:

| Uus lugeja | Fail | Miks |
|---|---|---|
| `listUpcomingContacts({ ownerUserId, limit })` | `lib/casework/caseWorkAssist.js` | indeks `[ownerUserId, nextContactAt]` on olemas ja lugejata |
| `countOpenMissingInfoByCase({ ownerUserId, caseIds })` | `lib/casework/caseWorkMissingInfo.js` | üks `groupBy`, mitte N+1 |

**Miks reegel nii on:** IDOR 04.08 tekkis täpselt nii — koondvaade tegi oma päringu ja unustas
skoobi. Lugeja omaniku-moodulis pärib skoobi; lugeja lauas pärib vea.

### L11 — Värav on sama, mis JUHTUM-V1-l

`CASEWORK_V1_ENABLED` väljas → marsruudid vastavad `notFound()`-iga, kaarte ei ole, API on
eristamatu olematust marsruudist. **Kogu kontroll käib `guardCaseWorkRequest()` kaudu** — uut
väravafunktsiooni ei kirjutata.

### L12 — Laua sektsioonid: KANOONILINE TABEL

**v2 parandus.** v1 määras laua kahes kohas erineva kujuga (10 sektsiooni ptk 4.3 loendis, 8
sektsiooni E1-s, „tänased vastuvõtud" kadunud, „aktiivsed ettevalmistustööd" ümber nimetatud).
**See tabel on ainus normatiivne loend.** Kui ptk 4.3 ja see tabel lahknevad, kehtib see tabel.

| # | Sektsioon (ptk 4.3) | Võti | E1 | E3/E4 järel | E5 järel | E6 järel |
|---|---|---|---|---|---|---|
| 1 | saabunud eelpöördumised | `receivedPreInquiries` | ✅ | ✅ | ✅ | ✅ |
| 2 | tänased vastuvõtud | `todaysContacts` | ✅ | ✅ | ✅ | ✅ |
| 3 | aktiivsed ettevalmistustööd | `activePreparations` | ⚠️ | ✅ | ✅ | ✅ |
| 4 | STAR2-sse kandmist ootavad mustandid | `draftsAwaitingTransfer` | ❌ | ❌ | ✅ | ✅ |
| 5 | puuduv ja kontrollimist vajav info | `openMissingInfo` | ✅ | ✅ | ✅ | ✅ |
| 6 | järgmised kontaktid | `upcomingContacts` | ✅ | ✅ | ✅ | ✅ |
| 7 | võrgustikutöö ettevalmistus | `networkPreparation` | ✅ | ✅ | ✅ | ✅ |
| 8 | meetodipeegel | `practiceReflection` | ✅ | ✅ | ✅ | ✅ |
| 9 | kovisiooni/supervisiooni ettevalmistus | `covisionPreparation` | ✅ | ✅ | ✅ | ✅ |
| 10 | STAR2 ülekandmise ajalugu | `transferHistory` | ❌ | ❌ | ❌ | ✅ |

**✅** = kuvatakse · **⚠️** = kuvatakse kitsendatud kujul · **❌** = sektsiooni **ei ole**
(L2 viimane rida — mitte tühi kast).

**Kaks täpsustust, mis v1-s olid vaikimisi ja valed:**

- **#2 „tänased vastuvõtud" ≠ #6 „järgmised kontaktid".** #2 on **täna** toimuv (`nextContactAt`
  tänases Eesti kalendripäevas — sama kuupäevareegel mis A4-l, mitte UTC-hetk). #6 on **eesootav**
  (homme ja edasi, tähtaja järjestuses). Kaks eri küsimust: „mis mul täna on" ja „mis tuleb".
- **#3 „aktiivsed ettevalmistustööd" ≠ „aktiivsed juhtumid".** Ettevalmistustöö on
  `CaseWorkMeetingPrep`, mis sünnib E3-s. **E1-s on sektsioon kitsendatud kujul:** ta kuvab
  `ACTIVE` juhtumeid ja **ütleb välja**, et kohtumise ettevalmistuse tööriista veel ei ole.
  See on `EMPTY`-st erinev olek ja L2 nõuab, et need eristuksid.

### L13 — Aeglane allikas: sektsiooni-tähtaeg, mitte ainult vea-isolatsioon

**v2 parandus.** v1 nõudis korraga „päringud paralleelselt", „üks aeglane allikas ei blokeeri
lauda" ja „ühe allika viga annab selle sektsiooni veaoleku". `Promise.allSettled()` lahendab
ainult viimase — 40 sekundit kestev päring paneb `allSettled`-i 40 sekundiks ootama.

**Lukus:** iga sektsioon on mähitud `Promise.race([lugeja, deadline])`-i.

| Parameeter | Väärtus |
|---|---|
| sektsiooni tähtaeg | **2500 ms**, konstant `WORKBENCH_SECTION_DEADLINE_MS` |
| tähtaja ületus | sektsioon → `TIMEOUT` (L2), laud tuleb ülejäänud sektsioonidega |
| koondlugeja kogukestus | ≤ tähtaeg + koondamine, **sõltumata aeglaseimast allikast** |

Tähtaeg on **testitav**: E1 testileping nõuab, et tahtlikult aeglane fake-lugeja annab
`TIMEOUT`-i ja et koondkutse tagastab enne, kui see lugeja lõpetab.

**Aegunud päringut ei katkestata andmebaasi tasemel** — `Promise.race` jätab ta lõpuni jooksma.
See on teadlik: V1-s ei ole päringu tühistamise taristut ja selle ehitamine on omaette töö.
Tagajärg on aus — aegunud sektsioon ei blokeeri kasutajat, aga koormus jääb.

**v6 saba (omaniku viies audit) — see vajab operatiivset jälgimist, mitte teist mehhanismi.**
Servajuht, mida V1 ei lahenda: kui tähtaeg hakkab **korrapäraselt** täis saama, muutub „kiire
laud" andmebaasi taustakoormuseks — kasutaja saab vastuse 2,5 sekundiga ja server jooksutab
tema taga kümneid hüljatud päringuid. **See ei blokeeri E2-e ja lahendust V1-s ei ehitata**;
E8 sond mõõdab `TIMEOUT`-sektsioonide arvu ära, et number oleks olemas enne kui ta probleem on.
Päringu tühistamine (`AbortSignal` → `pg` `cancel`) on omaette töö ja tema päästik on **mõõdetud
timeout-määr**, mitte oletus.

### L14 — Roll: koondlugeja vaikib, HTTP-piir keeldub

**v2 täpsustus.** v1 ütles E1-s „rollita kutse annab tühja tulemuse" ja E2-s „vale roll → 403".
Mõlemad on õiged, aga eri kihtide kohta, ja seda ei olnud kirjas.

| Kiht | Käitumine | Miks |
|---|---|---|
| **`guardCaseWorkRequest()`** (HTTP) | vale roll → **403**, värav väljas → **404**, autentimata → **401** | ainus turvapiir; olemas ja muutmata |
| **`getCaseWorkbench()`** (koondlugeja) | rollita või tundmatu kutse → **tühjad sektsioonid**, mitte erind | teeki võib kutsuda mujalt; erind sunniks iga kutsuja `try`-sse |
| **üksik sektsioon**, mille allikas nõuab rolli, mida vaatajal ei ole | → `FORBIDDEN` (L2), ülejäänud laud töötab | teenuseosutaja ja sotsiaaltöötaja näevad eri sektsioone |

**Koondlugeja tühi tulemus ei ole turvakontroll ja ei asenda väravat.** Turvapiir on
`guardCaseWorkRequest()` — koondlugeja käitumine on ainult see, et ta ei plahvata.

### L15 — Laste `onDelete` on säilitusmudeli osa, mitte Prisma vaikeväärtus

**v2 parandus** — v1 määras `onDelete` ainult E3-l.

| Laps | Vanem | `onDelete` | Miks |
|---|---|---|---|
| `CaseWorkMeetingPrep` | `CaseWorkAssist` | `Cascade` | juhtumi kustutus on täielik |
| `CaseWorkMeetingPrepField` | `CaseWorkMeetingPrep` | `Cascade` | sisu ei ela üle konteineri |
| `CaseWorkQuestion` | `CaseWorkMeetingPrep` | `Cascade` | küsimus ei ela üle ettevalmistuse |
| `CaseWorkMeetingNote` | `CaseWorkAssist` | `Cascade` | sama |
| `CaseWorkMeetingNoteEntry` | `CaseWorkMeetingNote` | `Cascade` | sisu ei ela üle konteineri |
| `CaseWorkDraft` | `CaseWorkAssist` | `Cascade` | sama |
| `CaseWorkDraftField` | `CaseWorkDraft` | `Cascade` | **ja E7 purge kustutab neid otse** |
| `CaseWorkTransferEvent` | `CaseWorkAssist` | `Cascade` | L8 |
| `CaseWorkTransferEvent` | `CaseWorkDraft` | `Cascade` | L8 — ei jää rippuma, sest mustandi rida ei kustu purge'il |
| `CaseWorkMeetingNote` | `CaseWorkMeetingPrep` *(valikuline)* | **`SetNull`** | ettevalmistuse kustutus ei tohi märget hävitada |

Kui `CaseWorkAssist` peab säilitusreegli lõpus **päriselt kustuma**, ei tohi ükski laps olla
`Restrict` — muidu kustutus lihtsalt ei õnnestu ja säilitusreegel oleks paberil.

### L16 — Kopeerimise audit sünnib PÄRAST õnnestunud lõikelauale kirjutust

**v2 täpsustus.** Audit on L8 järgi tõend. Tõend, mis tekib enne tegu, ei ole tõend.

```
1. server koostab ploki           GET  .../drafts/[draftId]/star2-block
2. klient kirjutab lõikelauale    navigator.clipboard.writeText(...)
3. AINULT õnnestumisel            POST .../drafts/[draftId]/copy-events
```

**Vale järjekord on nimeliselt keelatud:** audit → lõikelaud → brauser keeldub = auditis seisab
kopeerimine, mida ei toimunud.

Kaks tõrget saavad **ausa teate**, mitte vaikuse:

| Tõrge | Mida kasutaja näeb |
|---|---|
| lõikelauale kirjutus ebaõnnestus (luba, kontekst) | „ei õnnestunud kopeerida" + plokk kuvatakse valimiseks |
| lõikelaud õnnestus, audit ebaõnnestus | „**kopeeritud, aga jälge ei õnnestunud salvestada**" |

Teine juhtum on tahtlikult ebamugav: L8 järgi on audit tõend, ja vaikne tõendi kadu on halvem
kui nähtav.

### L17 — `CaseWorkRetentionAudit` kannab AINULT päris üleminekuid

**v3 parandus — see oli v2 blokeeriv viga.** v2 salvestas hoiatuse fakti
`CaseWorkRetentionAudit`-i reana `toState = ARCHIVED`, `reason = "retention_warning_sent"`, ja
kell otsis „viimast rida, kus `toState = ARCHIVED`". Tagajärg oli mõõdetav:

```
0 kuud     päris üleminek READ_ONLY → ARCHIVED
11 kuud    hoiatus kirjutab UUE ARCHIVED-rea      ← kell nullitakse
23 kuud    „ARCHIVED + 12 kuud" saab alles nüüd täis
```

**Hoiatus lükkas kustutust, mida ta pidi ette hoiatama** — ja iga järgmine hoiatus oleks
lükanud uuesti. Viga oli kahekordne, seega on ka parandus kahes kohas:

**1. Audit kannab ainult päris üleminekuid.** `CaseWorkRetentionAudit`-i kirjutab **ainult**
`transitionRetention()`. Ükski taustatöö, hoiatus ega märge sinna rida ei lisa. Rida, mis väidab
olekusiiret, mida ei toimunud, rikub auditi tähenduse — ka siis, kui `reason` seda seletab.

**2. Kell otsib päris üleminekut, mitte viimast rida:**

```
WHERE fromState = 'READ_ONLY' AND toState = 'ARCHIVED'
```

Elutsükkel on ühesuunaline ja `ARCHIVED` on terminaalne (JUHTUM-V1 L14), seega selliseid ridu on
**täpselt üks, igavesti**. See on tugevam invariant kui „viimane" ja ta kehtiks ka siis, kui
keegi tulevikus reeglit 1 rikuks.

**Hoiatuse kordumatus tuleb teavituskihist, mitte auditist.** `createNotificationEvent()` kannab
juba unikaalset `dedupeKey`-d kujul `${type}:${sourceId}:${userId}:${suffix}` ja tagastab
kokkupõrkel `{ created: false }`. Hoiatuse võti on
`casework.case.retention_warning:<caseId>:<ownerId>:v1` — **teine käivitus ei saada teist korda
ja ei kirjuta kuhugi midagi.** Uut mudelit ei teki ja migratsioonide arv jääb neljaks.

### L18 — `markTransferred` on üks tehing

**v3 täpsustus.** E5 `transitionDraft` oli atomaarne, aga E6 `markTransferred` jäi lahti — kaks
halba tulemust olid võimalikud: mustand `ULE_KANTUD` ilma auditireata, või auditirida ilma
olekusiirdeta.

**Ühes DB-tehingus sünnib kolm asja:**

```
1. tingimuslik siire   WHERE transferState = expectedFrom   (0 rida → 409, L6)
2. transferredAt = now()
3. CaseWorkTransferEvent(kind = MARKED_AS_TRANSFERRED)
```

`markTransferred()` **kasutab sama tingimusliku siirde primitiivi** mis `transitionDraft()` —
teist teed `ULE_KANTUD`-ini ei ole.

**U1 sündmus emiteeritakse PÄRAST edukat commit'i**, mitte tehingu sees. Tehingu sees emiteeritud
sündmus jõuaks välja ka siis, kui tehing hiljem tagasi veereb — sama põhjendus, mis kannab
U1-outbox mustrit mujal platvormil.

### L19 — `ULE_KANTUD`-ini viib TÄPSELT ÜKS tee

**v4 parandus — v3 lubas L18-s garantiid, mille E5 avalik marsruut oleks ümbert läbi lasknud.**
L18 ütles „teist teed `ULE_KANTUD`-ini ei ole", aga E5 `POST …/transition` võttis vastu iga
lubatud sihi, sealhulgas `ULE_KANTUD`. Tulemus oleks olnud:

```
transferState = ULE_KANTUD        ✓
transferredAt = <aeg>             ✓
MARKED_AS_TRANSFERRED auditirida  PUUDUB          ← L18 garantii katki
```

Ja sealt edasi oleks L7 säilituskell hakanud käima mustandi peal, millel ei ole ühtegi tõendit,
et keegi selle kunagi kuhugi kandis.

**Kolm kihti, üks tee:**

| Kiht | Roll |
|---|---|
| `transitionDraftStateTx()` | **sisemine primitiiv** — tingimuslik siire tehingu sees. Ei ole avalik eksport |
| `transitionDraft()` | avalik operatsioon **kõigi muude** siirete jaoks. `to = ULE_KANTUD` → **400** |
| `markTransferred()` | **ainus** kasutajaoperatsioon, mis jõuab `ULE_KANTUD`-ini. Primitiiv + auditirida ühes tehingus (L18) |

**Miks 400, mitte vaikne ümbersuunamine `markTransferred`-ile:** kaks operatsiooni tähendavad
kahte eri tegu ja kahte eri tähendust. „Märgi üle kantuks" on avaldus selle kohta, et info on
STAR-is; „vii mustand järgmisse seisu" ei ole. Vaikne ümbersuunamine tekitaks auditirea teo
kohta, mida kasutaja ei teinud.

### L20 — Laud tagastab AINULT kokkulepitud deskriptori

**v5, omaniku neljas audit.** Koondlugeja tagastab ainult sektsioonides kokkulepitud
deskriptor-kuju. **Omaniku-mooduli täisrida ei liigu koondlaua API-sse.** Iga sektsioon
whitelist'ib väljad **nimeliselt**; tundlik või sektsiooni jaoks mittevajalik sisu ei jõua isegi
koondvastusesse.

**Miks nimeline valge nimekiri, mitte „võta rida ja eemalda tundlikud väljad":** kustutusnimekiri
vananeb. Uus veerg mudelis ei lisa end kustutusnimekirja, aga lisab end vastusesse — ja E2 saadab
selle vastuse brauserisse. Valge nimekiri katkeb märgatavalt, must nimekiri vaikselt.

| Sektsioon | Deskriptor |
|---|---|
| `todaysContacts` · `upcomingContacts` | `caseId` · `label` · `nextContactAt` |
| `activePreparations` | sama + `openMissingInfoCount` |
| `openMissingInfo` | `itemId` · `caseId` · `text` · `provenance` · `createdAt` |
| `networkPreparation` | `shareId` · `status` · `updatedAt` |
| `covisionPreparation` | `seedId` · `title` · `status` · `updatedAt` |
| `receivedPreInquiries` · `practiceReflection` | **K1 adapteri oma** — vt allpool |

**Kaks sektsiooni jäävad kaardistamata TEADLIKULT.** Eelpöördumised ja meetodipeegel tulevad K1
adapteritest, mis on juba `assertWorkspaceDescriptor()` läbinud. Teine kaardistus siin tekitaks
teise tõe selle kohta, mis on tööruumi kirje.

**Mis nimeliselt VÄLJA jääb ja miks:** `clientUserId` \ `clientDisplayName` \ `clientExternalRef`
— kliendi identiteet on juba `label`-is lahendatud kujul (L10) ja toorväli annaks sama info
mööda kuvanime reeglist. `preInquiryId` \ `urgentRequestId` \ `externalReference` — juhtumi
sisemised viited, mis seovad ta menetlusega. `summaryText` \ `purpose` \ `sharingBoundary`
(jagamine) ja `whyNow` \ `sharedCardSnapshot` (teemaseeme) — kliendi sisu, mis avaneb objekti
enda vaates, kus lugemine on teadlik tegu.

**Jõustaja on kahepoolne.** Deskriptor lauas ei aita, kui lugeja toob terve rea protsessi mällu:
`listWorkerActionableShares()` kannab **oma `select`-i**. Test kontrollib mõlemat suunda —
istutatud toorväärtused ei tohi vastusesse jõuda, **ja** iga sektsiooni võtmete hulk peab olema
täpselt see, mis siin tabelis, mitte „vähemalt see".

### L21 — Lapse kirjutuskaitse jõustatakse kirjutusega SAMAS atomaarses piiris

**v5, omaniku neljas audit — see oli teine P0.** Lapse kirjutuskaitse jõustatakse kirjutusega
samas atomaarse piiri sees. **Eelnev `ACTIVE` kontroll EI OLE jõustaja.** Vanema `ACTIVE` olek ja
lapse mutatsioon peavad olema seotud nii, et samaaegne retention-siire ja lapse kirjutus ei saa
mõlemad võita.

Vana kuju oli `loe → kontrolli → kirjuta` ja kahe päringu vahele mahtus terve teine tehing:

```
A: requireActiveCase()   → juhtum on ACTIVE
B: transitionRetention() → READ_ONLY (commit)
A: create / update / delete lapsel        ← kirjutuskaitse on juba jõus
```

**Jõustaja on `withActiveCaseLock()`** (`lib/casework/caseWorkAssist.js`): tehing, mille sees
tingimuslik `updateMany` vanema real võtab reataseme luku, ja alles seejärel käib lapse
kirjutus. Samaaegne `transitionRetention()` kas ootab või tapab kirjutuse. **Lukustusjärjekord on
mõlemal rajal sama** — vanem enne last —, seega deadlock'i ei teki.

| | |
|---|---|
| **Vead jäävad eristatavaks** | võõras või olematu juhtum → **404**, oma aga kirjutuskaitstud → **409**. Lisapäring tehakse ainult ebaõnnestumisel |
| **Kõrvalmõju on teadlik ja soovitud** | lukustav update puudutab `@updatedAt`-i, seega lapse lisamine tõstab juhtumi loendis ettepoole. `updatedAt` tähendab „juhtumiga tehti tööd", mitte „vanemrea välja muudeti" |
| **Säilituskell EI sõltu sellest** | L7 järgi käib kell päris üleminekust `ARCHIVED`-isse, mitte `updatedAt`-ist — ja just see teeb ülaltoodud kõrvalmõju ohutuks |

**SEE EI OLE JTA UUS SEMANTIKA.** Invariant on JUHTUM-V1 lepingus L14 real „Atomaarsus" juba
kirjas ja oli seal enne seda lepingut: *„Loe-kontrolli-kirjuta muster ei jõusta L14-t
paralleelsete päringute korral."* Teostus rikkus oma enda reeglit LASTE peal —
`caseWorkMissingInfo.js` ja `caseWorkItem.js`. Parandus kuulub seega mõlemasse lepingusse ja
JUHTUM-V1 v7 kannab sama leiu.

### L22 — `COPIED_FOR_STAR2` kannab idempotentsusvõtme

**v6, omaniku viies audit.** L16 lukustas järjekorra (plokk → lõikelaud → audit) ja kirjeldas
ausalt tõrke, kus audit ei salvestu. **Teine serv jäi katmata:** kui `POST` läheb välja ja vastus
ei jõua tagasi — võrk katkeb, vahekaart suletakse, kasutaja vajutab uuesti —, ei tea klient, kas
rida tekkis. Kordus on siis ainus mõistlik käitumine ja **append-only tabel võtab ta vastu**.

```
kopeerimisi päriselt: 1
auditiridu:           2          ← audit valetab ülespoole
```

**Miks see loeb rohkem kui tavaline duplikaat:** L8 järgi on `CaseWorkTransferEvent` **tõend**.
Tõend, mis loeb ühe teo kaheks, on sama katki nagu tõend, mis teo maha vaikib — ainult vastupidises
suunas, ja hiljem ei ole kummastki võimalik aru saada, kumb juhtus.

| | |
|---|---|
| **Jõustaja** | **unikaalne indeks** `@@unique([draftId, clientActionId])` `CaseWorkTransferEvent`-il — mitte teenuskihi „kas on juba olemas" kontroll, mis on sama loe-kontrolli-kirjuta muster, mille L21 just maha võttis |
| **Võtme sünnikoht** | **klient**, `crypto.randomUUID()`, **enne** lõikelauale kirjutust. Sama tegu = sama võti, ka korduskatsel. Serveris genereeritud võti oleks iga kutse peale uus ja ei kaitseks millegi eest |
| **Kokkupõrge** | **200**, mitte 409 — koos juba olemasoleva auditirea id-ga. Kasutaja tegi ühe teo ja peab nägema ühte tulemust; 409 sunniks liidese seletama viga, mida ei ole |
| **Ulatus** | ainult `COPIED_FOR_STAR2`. `MARKED_AS_TRANSFERRED` on kaitstud tingimusliku siirdega (L18/L19) ja teine kaitse ainult varjaks, kumb töötab |
| **Migratsioon** | **ei lisandu** — `CaseWorkTransferEvent` sünnib E6 migratsioonis 4/4, veerg ja indeks käivad sellega kaasa |

**`clientActionId` on läbipaistmatu string, mitte tähendust kandev väli:** ta ei tohi sisaldada
`fieldKey`-sid, ajatemplit ega midagi, millest saaks sisu tuletada. Formaadikontroll on serveris
(UUID-kuju), sest kliendilt tulnud vaba string on võti, mille kasutaja saab ise valida.

**Veerg on `String?` ja see on tahtlik.** Postgres loeb `NULL`-e unikaalses indeksis
**eristuvateks**, seega `MARKED_AS_TRANSFERRED` read (võti `null`) ei põrka omavahel kokku ja
indeks piirab täpselt seda, mida ta piirama peab. **Kohustuslikkust jõustab teenuskiht `kind`
järgi**, mitte skeem: `COPIED_FOR_STAR2` ilma võtmeta → **400**. Skeemitasemel `NOT NULL` nõuaks
`MARKED_AS_TRANSFERRED`-ile mõttetut võtit ja tekitaks teise koha, kus võtit genereeritakse.

**Kordus ei ole sama, mis teine kopeerimine.** Töötaja **tohib** sama mustandit päriselt kaks
korda kopeerida ja siis peavad tekkima **kaks** rida — sellepärast on võti teo, mitte mustandi
peal. „Üks copy-event mustandi kohta" oleks vale reegel ja kaotaks päris ajaloo.

**Testileping (E6):** sama `clientActionId` kaks korda → **üks rida**, vastus 200 mõlemal ·
kaks eri `clientActionId`-d → **kaks rida** (päris korduskopeerimine) · puuduv või vigase kujuga
`clientActionId` → **400**, rida ei teki · unikaalsust jõustab **indeks** — test kirjutab
teenuskihist mööda ja andmebaas keeldub.

### L23 — Arhiveerimine ütleb kella välja ENNE tegu, mitte 30 päeva enne kustutust

**v6, omaniku viies audit.** L7 lubab kasutajale 30 päeva hoiatust ja E7 jõustab selle. Aga
hoiatus saabub **11 kuud pärast otsust**, mille kohta L17 ütleb, et ta on terminaalne — ja
`ARCHIVED`-ist ei ole JTA tasemel tagasiteed. **Aus hoiatus vales kohas ei ole hoiatus, vaid
teade.**

Mõõdetud olemasolev tekst (`messages/et.json`, võti `casework.page.retention_hint`, kuvatud
`components/casework/CaseWorkDetail.jsx:591` kohal, arhiveerimisnupp sealsamas real 633):

> *„Kirjutuskaitse on ühesuunaline. Tagasiteed ei ole ja põhjus jääb auditisse."*

See on JUHTUM-V1 tekst ja ta oli **oma ajal täielik** — JUHTUM-V1-s ei olnud kella. Kell tuleb
selle lepinguga (L7), seega **teksti võlg on JTA oma, mitte JUHTUM-V1 oma.**

| | |
|---|---|
| **Jõustaja** | E7 lisab arhiveerimise kinnitusdialoogile eraldi võtme `casework.page.archive_clock_warning` ET/EN/RU; `retention_hint` jääb alles ja katab endiselt `READ_ONLY` siirde |
| **Mida tekst peab ütlema** | kolm asja nimeliselt: **(1)** see käivitab 12 kuu kustutuskella · **(2)** kella lõpus kustub **kogu juhtum koos lastega**, mitte ainult sisu · **(3)** seda olekut **ei saa tagasi pöörata** |
| **Kus ta seisab** | arhiveerimise **kinnituse juures**, mitte sektsiooni jaluses. Tekst, mida loetakse pärast vajutust, ei mõjuta otsust |
| **`READ_ONLY` ei saa sama teksti** | tema ei käivita kella (L7) ja vale hoiatus õpetab kasutajat hoiatusi ignoreerima |

**Testileping (E7):** arhiveerimise kinnitus kannab `archive_clock_warning` võtit · võti on
olemas kolmes keeles (`i18n:check`) · `READ_ONLY` siirde kinnitus **ei** kanna seda võtit ·
tekst nimetab kustutuse ulatust („juhtum koos lastega"), mitte ainult mustandi sisu.

---

## V1 vaikeotsused — otsustatud, mitte lahtised

**v6 parandus.** Selle tabeli pealkiri oli „Lahtised otsused — ükski ei blokeeri ehitust", aga
igal real seisis juba V1 vastus. Teostaja jaoks tähendab „lahtine otsus" tavaliselt, et **tal ei
ole õigust valida** — ja siin on täpselt vastupidi: valik on tehtud, ta on lihtsalt tagasipööratav
hilisemas versioonis. Päris lahtine otsus on all eraldi.

| Kood | Küsimus | V1 vastus |
|---|---|---|
| **O-JTA-1** | laud oma marsruudil või töölaua sektsioon | **oma marsruut** — kümme sektsiooni ei mahu kaardile |
| **O-JTA-2** | ettevalmistus juhtumi küljes või vaba | **juhtumi küljes** (FK) |
| **O-JTA-3** | mitu ettevalmistust ühe juhtumi kohta | **mitu** — iga kohtumine on oma |
| **O-JTA-4** | kas mustandi saab luua ilma märketa | **jah** — ptk 4.5 elemendid ei eelda kohtumist |
| **O-CW-3** | refleksiooni ja ametliku dokumentatsiooni piir | **ei ole vaja V1-s** — E4 ehitab märkme kihi, mitte `PracticeReflection` mudeli |

## Lahtine otsus — O-JTA-5, hüljatud töömaterjali säilitus

**v6, omaniku viies audit. See on ainus päris lahtine otsus selles lepingus** ja ta **blokeerib
E7 lõpliku luku**, mitte E2–E6 ehitust.

**Küsimus:** mis juhtub mustandiga, mis jääb `MUSTAND` või `EI_KANTA` seisu ja mida keegi kunagi
üle ei kanna?

**Praegune vastus on „mitte midagi, kuni juhtum kustub"** (L7) ja ta on teadlik. Aga ta on
vastus **varju-registri** küsimusele, mitte **andmeminimeerimise** omale — ja need kaks küsiti
eri kohtades:

| | Katab | Ei kata |
|---|---|---|
| **Õ2 / L7 12 kuud** | `ULE_KANTUD` mustandi sisu | mustand, mida ei kantud |
| **L15 kaskaad** | kõik, kui juhtum kustub | juhtum, mis ei kustu |

Kahe reegli vahele jääb päris juht: **juhtum, mis on aastaid `ACTIVE` või `READ_ONLY`** — ja
pikk aeglane juhtumitöö ongi valdkonna norm, seda ütleb L7 ise põhjenduses. Selles juhtumis
võib istuda kaks aastat vana kohtumise ettevalmistus, milles on kliendi sisu ja mida keegi ei ole
avanud pärast seda kohtumist. **Ta ei ole varju-register — ta on lihtsalt unustatud.**

**Kolm rada, mis on lauas** (ükski ei ole valitud):

| Rada | Kuju | Hind |
|---|---|---|
| **A — jätta nii** | staatus quo; töömaterjal elab juhtumi elu | aus, aga tähendab, et „andmeminimeerimine" ei ole selle funktsiooni kohta öeldav |
| **B — puutumatuse kell** | mustand, mida ei ole N kuud avatud ega muudetud → hoiatus → sisu purge, rida ja fakt jäävad (sama kuju mis L7 ülekantud rajal) | vajab „viimati avatud" jälge, mida täna ei ole — ja **lugemise logimine on ise uus töötlus**, mida see leping mujal väldib. Kui B, siis kell käib `updatedAt`-ist, mitte lugemisest |
| **C — töötaja otsus** | juhtum kannab „arhiveeri töömaterjal" tegu, mis purgeb kandmata mustandite sisu ilma juhtumit arhiveerimata | ei kustuta midagi kellegi selja taga (sama põhimõte mis L7 „vaikset kustutust ei ole"), aga jätab tegemata jätmise korral olukorra samaks mis A |

**Mida see otsus muudab:** E7 saab neljanda töö (rada B) või E3/E5 saab ühe operatsiooni (rada C)
või kumbagi ei tule (rada A). **Migratsioonide arv ei muutu üheski radadest** — `contentPurgedAt`
on mustandil juba olemas (L7) ja B vajab ainult päringutingimust.

**Ettepanek omanikule: rada C.** Ta on ainus, mis ei nõua uut jälge ega uut vaikset kustutust, ja
ta on sama kuju mis platvormi ülejäänud säilitusotsused — inimene teeb teo, süsteem jõustab.
**Aga see on omaniku otsus ja E7 ei lukustu enne teda.**

## Teostus

**Iga etapp kannab sama kuut rida:** `teenus → API → pind → värav → valideerimine → testid`.
Kus mõni neist puudub, on see **välja öeldud**, mitte vaikimisi lahti.

---

### E1 — Laua koondlugeja *(0 migratsiooni, 0 otsust)* — **TEHTUD 08.08**

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/workbench.js` → `getCaseWorkbench({ userId, roleState, db })`. **Uued lugejad** (L10): `listUpcomingContacts()` → `lib/casework/caseWorkAssist.js`; `countOpenMissingInfoByCase()` ja `listOpenMissingInfoForOwner()` → `lib/casework/caseWorkMissingInfo.js`; `listWorkerActionableShares()` → `lib/network/share.js` *(lepinguväline leid: päring elas marsruudi sees ja moodulil ei olnud ühtegi lugejat)*. **Uus jagatud moodul** `lib/time/estonianDay.js` (v5) ja **uus jõustaja** `withActiveCaseLock()` (L21) |
| **API** | *ei ole* — E1 on teegikiht. Marsruut tuleb E2-s |
| **Pind** | *ei ole* |
| **Värav** | `getCaseWorkbench()` ise ei väravata (teek); L14 |
| **Valideerimine** | `userId` tühi → tühjad sektsioonid, mitte erind. Vastus on **deskriptor** (L20), mitte lugeja rida |
| **Testid** | `tests/casework/workbench.test.js` · `tests/time/estonianDay.test.js` |

**Sektsioonid:** L12 tabeli E1-veerg — **7 täit + 1 kitsendatud (`activePreparations`)**.
Sektsioonid #4 ja #10 **puuduvad täielikult**, mitte tühjad.

Iga sektsioon tagastab ühesuguse kuju:

```
{ state: "OK" | "EMPTY" | "FORBIDDEN" | "TIMEOUT" | "ERROR", items: [...], notice: <i18n-võti|null> }
```

**Nõuded:** L1 · L3 · L10 · L13 (2500 ms tähtaeg sektsiooni kohta) · L14 · **L20** · **L21**.

**Testileping:**

1. võõra kasutaja andmeid ei jõua ühessegi sektsiooni
2. iga sektsioon eristab `EMPTY` ja `FORBIDDEN`
3. ühe allika erind → **ainult see** sektsioon `ERROR`, ülejäänud `OK`
4. **tahtlikult aeglane lugeja → `TIMEOUT`**, ja koondkutse tagastab enne tema lõppu
5. rollita kutse → tühjad sektsioonid, **mitte erind**
6. `activePreparations` kannab E1-s `notice`-võtit, mitte `EMPTY`-t
7. `todaysContacts` ja `upcomingContacts` ei kattu — piir on **Eesti kalendripäev**
8. koondlugeja ei kutsu ühtegi `prisma.*`-meetodit otse (staatiline kontroll testis)
9. **(v5, L20)** istutatud toorväärtused ei jõua vastusesse, **ja** iga sektsiooni võtmete hulk on
   **täpselt** L20 tabelist — „vähemalt see" ei kõlba, sest just nii uus veerg vaikselt sisse tuleb
10. **(v5)** erindi teade ei jõua **vastusesse EGA LOGISSE**. Logisse tohib jõuda ainult see, mis
    on sisu poolest konstant: sektsiooni võti, erindi klass, masinloetav kood. `console.error`
    püütakse testis kinni — ainult vastuse kontrollimine jättis selle koha vahele
11. **(v5, L21)** samaaegne retention-siire ja lapse kirjutus: kui siire võidab, siis lapse
    kirjutus **ei õnnestu** ja ridu ei muutu. Kehtib kolmel rajal — lisamine, muutmine, kustutamine

**Eesti kalendripäev on eraldi testileping** (`tests/time/estonianDay.test.js`): tavaline suvepäev ·
tavaline talvepäev · **29.03.2026 = 23 tundi** · **25.10.2026 = 25 tundi** · ja üks, mis vana vea
oleks kohe tabanud — **sama hetk läbi nelja serveri-ajavööndi peab andma identse tulemuse**.

**E1 fikstuuride õppetund:** algne „ei kattu" test kasutas päeva keskel olevaid kontakte, kus
UTC-piir ja Eesti piir annavad SAMA vastuse — seepärast läbis ta ka katkise arvutusega. Piiriread
(`07.08 21:30Z` = 08.08 00:30 Eestis) on nüüd fikstuurides nimeliselt.

---

### E2 — Laua pind *(0 migratsiooni)* — **TEHTUD 08.08**

| | |
|---|---|
| **Teenus** | E1 oma |
| **API** | `GET app/api/casework/workbench/route.js` → `guardCaseWorkRequest(req, { scope: "casework:workbench" })`. **Ainult `GET`** — laud on lugeja (L1) |
| **Pind** | `app/toolaud/juhtumitoo/page.jsx` + `components/casework/CaseWorkbenchShell.jsx` + töölaua kaart `casework_workbench` + **kiirmenüü kirje** `juhtumitoo` (mõlemad UI-lipu ja rolli taga) + **ⓘ juhend ET/EN/RU** (`casework_workbench`, neli osa) |
| **Värav** | L11 — värav väljas → `notFound()`; **API kihis** vale roll → 403 (L14). Pinna rollikontroll on viisakus, mitte värav — vt kuuenda auditi tabel allpool |
| **Valideerimine** | vastus on ainult descriptor-kuju; teenuskihi tekste ei renderdata toorelt |
| **Testid** | `tests/casework/workbenchUi.test.js` (13 lepingut) + `routeContract.test.js` laiendatud |

**ⓘ juhendi viimane osa ütleb piirid välja**, sama kujuga nagu `/juhtumid` oma: laud on isiklik ·
**ei ole koormuse mõõdik** · ei näita kellegi teise tööd · AI ei otsusta.

**Testileping:** värav väljas → kõik 404 · vale roll → 403 · **HTML tekstiväljas kuvatakse
tekstina** (JUHTUM-V1 E6 õppetund) · i18n pariteet kolmes keeles · `notice`-võtmed on kõik
tõlgitud.

**Kaks leidu tulid BRAUSERIST, mitte testidest**, ja mõlemad on nüüd regressioonitestiga lukus:

- **K1 tööruumi pealkiri lekkis tõlkevõtmena.** Laual seisis „workspace.kind.pre_inquiry".
  Sisuta tööruumi adapter (eelpöördumine, meetodipeegel) paneb `title`-ks **tõlkevõtme**, sest
  pealkiri ei tohi kanda kliendi sisu; nimega tööruum (teekond, ruum) paneb sinna **teksti**.
  `t(title, title)` katab mõlemat. **Kuju oli õige, tähendus vale** — ükski kuju-test ei
  saanudki seda näha.
- **Tuletatud aadress oli katkine.** `/vestlus?workspace=${ref.kind}` eeldas, et tööruumi liik
  ja töölaua võti on sama string — `pre_inquiry` vs `pre_inquiries`. Nüüd on nimeline
  `WORKSPACE_ROUTES` kaart ja **test kontrollib, et iga siht on päris leht** (`app/<tee>/page.jsx`).
  Tundmatu liik annab rea **ilma lingita**: katkine link lubab teed, mida ei ole.

**Kolmas leid oli sõnastuses:** „1 lahtist punkti" on eesti keeles vale kääne. Sildi kuju on
nüüd **„lahtisi punkte: N"**, mis on õige iga arvu juures — sama probleem oleks tulnud vene
keeles ja seal veel teravamalt.

**`notice`-võtmete võlg oli E1-st ja ta leiti siin:** koondlugeja saatis välja
`casework.workbench.preparations_not_yet` ja `network_worker_only`, mida **üheski sõnastikus ei
olnud** — E1 oli teegikiht, seega ainus koht, kus see oleks paistnud, oli pind, ja pinda ei
olnud. Test loeb need võtmed nüüd **koondlugeja koodist**, mitte nimekirjast: E3 uus `notice`
läheb punaseks ilma, et keegi testi uuendaks.

**Mõõdetud brauseris päris sessiooniga** (värav ajutiselt sees, andmed sünteetilised ja pärast
kustutatud, kustutus **kontrollitud**): kaheksa sektsiooni kanoonilises järjekorras · `<b>` ja
`<script>` puuduva info tekstis kuvatud **tekstina** (0 loodud elementi) · päritolusilt
„AI mustand" · `activePreparations` `notice` kuvatud **koos ridadega** · teenuseosutajal
`networkPreparation` = `FORBIDDEN` põhjendusega, mitte tühi · kliendile **403** ·
väravaga väljas API **404** `casework.errors.not_found` ja lehe `<title>` **„404"**.

**Aus piirang, mis EI ole E2 oma:** funktsiooni nimi („Juhtumitöö laud") ilmub kliendi
paketti ka väljas väravaga, sest kogu `messages/*.json` saadetakse igale lehele — mõõdetuna
kehtib sama `/juhtumid`-i ja isegi `/` kohta. L11 lubab, et **marsruut** on eristamatu
olematust; ta ei luba, et string ei sõida kaasa. Platvormiülene, mitte selle etapi oma.

#### E2 kuues audit (omanik 08.08) — neli leidu, kolm parandatud, üks mõõdetud

**Kolm parandust:**

- **P1 — sektsiooni oleku semantika oli UI-s fail-open.** Pind valis kuju `items.length` järgi
  ja luges olekut ainult siis, kui ridu EI OLNUD. `FORBIDDEN` või `TIMEOUT` koos ridadega oleks
  **kuvanud read ja oleku vaikides ära visanud**; tundmatu olek langes `EMPTY`-le ehk kasutajale
  öeldi „tööd ei ole" siis, kui laud tegelikult ei teadnud. Server hoiab neid olekuid täna
  tühjana — aga **pind saab HTTP-vastuse ja ei tohi sõltuda sellest, et teine pool end
  korralikult üleval peab.** Otsus kolis JSX-ist välja `components/casework/workbenchView.js`-i,
  sest testijooksja ei teisenda JSX-i ja regex-test oleks kontrollinud koodi kuju, mitte
  käitumist. Uus olek: **`OK` ilma ridadeta on vastuolu**, mitte tühjus. Uus tekst
  `state_invalid` ET/EN/RU. `tests/casework/workbenchView.test.js` — **neli testi üheksast
  kukuvad vana teostuse peal, kontrollitud** (v5 reegel).
- **P1/P2 — sisenavigatsioon käis toore ankruga.** `<a href>` teeb täisdokumendi-navigatsiooni:
  laadib rakenduse uuesti ja viskab ära konteksti, mille pind just üles ehitas. Nüüd `next/link`.
  **Keeleprefiksit siin EI lisata ja see on õige, mitte puudujääk:** `localizePath()` EEMALDAB
  prefiksi („Keep links locale-neutral; language selection is handled via cookie") ja `proxy.js`
  suunab `/et|/ru|/en` teed **308-ga** neutraalsele kujule. Mõõdetud brauseris: URL vahetus
  `/eelpoordumised`-iks ja lehele jäetud JS-marker **elas üle** ehk dokumenti ei laaditud uuesti.
- **P2 — ebaõnnestunud värskendus jättis vana laua ekraanile vaikides.** `load()` ei tühjendanud
  sektsioone ja `refresh` nupp kuvati ainult `ready` seisus — pinnal ei olnud ühtegi teed uuesti
  proovida. Juhtumitöö laual on **vaikiv vana info kõige halvem variant**, sest „ei ole enam
  puuduvat infot" tähendab siin midagi. Valitud: vana laud **jääb**, aga kannab märget
  (`stale_notice`), ja nupp on olemas mõlemas lõppseisus (`retry`). Laua tühjendamine iga
  võrgutõrke peale oleks teine äärmus. Mõõdetud brauseris `fetch`-i tõrkega: error + märge +
  „Proovi uuesti" + andmed alles → klikk taastas seisu.

**Neljas leid oli õige tähelepanek, aga mitte E2 defekt — ja ta on nüüd MÕÕDETUD, mitte
oletatud.** HTML-pind kontrollib ainult väravalippu; rolli kontrollib klient. Mõõtmine
(päris sessioonid, värav sees):

| Roll | `/toolaud/juhtumitoo` | `/api/casework/workbench` | `/juhtumid` (JUHTUM-V1) |
|---|---|---|---|
| `CLIENT` | **200** + „ei ole lubatud" | **403** | **200** |
| `ADMIN` | 200 | **200**, oma tühi skoop | 200 |

Kaks järeldust. **(1)** Pinna 200 on sama, mis JUHTUM-V1 E6-l, ja L14 tabel ütleb ise välja, et
`guardCaseWorkRequest()` on **ainus turvapiir** — pinna rollikontroll on viisakus, mitte värav.
Andmeid pind ise ei kanna. Serveripoolne rollivärav oleks omaette muudatus ja ta kuuluks
**mõlemale** pinnale korraga, mitte ainult lauale; ühe pinna muutmine teeks ühest funktsioonist
kaks reeglit. **(2)** `ADMIN` saab 200, sest `resolveSessionRoleState()` annab administraatorile
`effectiveRole = adminViewRole || "SOCIAL_WORKER"` — see on rollivahetaja mehhanism, mitte
casework'i auk, ja ta kehtib täpselt samamoodi `/api/casework/cases` peal (mõõdetud). **Skoop
jääb `guard.userId` peale**, seega admin näeb oma tühja lauda, mitte kellegi teise oma.

**E2 rea „vale roll → 403" täpsustus:** see käib **API kihi** kohta. Nii oli mõeldud (L14) ja
nüüd on ka kirjas — mitmetimõistetavus oli lepingus, mitte koodis.

---

### E3 — Kohtumise ettevalmistus *(migratsioon 1/4)*

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/caseWorkMeetingPrep.js` — `createMeetingPrep`, `updateMeetingPrep`, `getMeetingPrep`, `listMeetingPreps`, `deleteMeetingPrep`, `setPrepField`, `addQuestion`, `updateQuestion`, `removeQuestion`, **`confirmProvenance`** |
| **API** | **uus** `app/api/casework/cases/[caseId]/meeting-preps/route.js` (`GET`, `POST`) · `.../[prepId]/route.js` (`GET`, `PATCH`, `DELETE`) · `.../[prepId]/fields/route.js` (`PUT`) · `.../[prepId]/questions/route.js` (`GET`, `POST`) · `.../questions/[questionId]/route.js` (`PATCH`, `DELETE`) · **`.../[prepId]/fields/[fieldKey]/confirm-provenance/route.js` (`POST`)** · **`.../questions/[questionId]/confirm-provenance/route.js` (`POST`)** |
| **Pind** | **uus** `app/juhtumid/[caseId]/page.jsx` — juhtumi detailvaade (**täna ei ole**), ettevalmistuse sektsioon |
| **Värav** | `guardCaseWorkRequest()`, scope `casework:meeting-prep` |
| **Valideerimine** | `provenance` ∈ 8 väärtusest **prep-real ja igal küsimusel**; `kind` ∈ 2 |
| **Testid** | `tests/casework/meetingPrep.test.js` + marsruuditest |

**Kolm mudelit** (v3 taastas päritolunõude, **v4 viis prep-i sama mustri alla mis märkme ja
mustandi**):

**`CaseWorkMeetingPrep`** — FK `CaseWorkAssist`, `onDelete: Cascade` (L15). **Tekstita.**
Ainus sisuline väli on `meetingAt` — see on ajahetk, mitte autoritekst, ja päritolu tal ei ole.

**`CaseWorkMeetingPrepField`** — FK prep-ile, `Cascade`. `fieldKey` ∈
`{GOAL, REQUIRED_DOCUMENTS, LIFE_DOMAINS, AGENDA, PLAIN_LANGUAGE_NOTES}` · `text` ·
**`provenance` `NOT NULL`**. `@@unique([meetingPrepId, fieldKey])` — üks rida välja kohta.

**`CaseWorkQuestion`** — `ideed.md` **ptk 12 nimi, uut ei leiutata**. FK prep-ile, `Cascade`.
`kind` ∈ `{CLARIFYING_QUESTION, CLAIM_TO_VERIFY}` · `text` · **`provenance` `NOT NULL`** ·
`ordinal`.

**Miks prep-i väljad said oma tabeli (v4 parandus).** v3 andis tervele ettevalmistusele **ühe**
`provenance` väärtuse. See ei suuda väljendada päris juhtu:

```
goal                → töötaja kirjutas      TOOTAJA_TAHELEPANEK
agenda              → töötaja kirjutas      TOOTAJA_TAHELEPANEK
plainLanguageNotes  → AI koostas            AI_MUSTAND
```

Leping ise ütleb **„AI koostatud osa"**, mitte „AI koostatud ettevalmistus tervikuna" — ja üks
jäme märgis oleks pidanud kogu prep-i `AI_MUSTAND`-iks või kaotanud märgise sealt, kus ta loeb.
Küsimuste juures oli see juba õigesti tehtud; nüüd on kogu prep sama loogika all.

**Kaks välja jäävad V1-s üheks tekstiplokiks** (`requiredDocuments`, `lifeDomains`), kuigi nad on
loendilaadsed. See on teadlik: nad ei kanna eri päritolu ridade kaupa ja loendiks lammutamine
oleks skeemi kasv ilma tõendatud vajaduseta.

**Kolm nõuet, mille v2 refaktor kogemata maha jättis, on tagasi:**

| # | Nõue | Kus ta nüüd elab |
|---|---|---|
| 1 | täpsustavad küsimused kannavad päritolu | `CaseWorkQuestion.provenance`, `NOT NULL` |
| 2 | **AI koostatud osa kannab `AI_MUSTAND` märgist ja seda ei saa vaikselt maha võtta** | `provenance` igal väljal ja igal küsimusel. Märgise muutmine käib **ainult** `confirm-provenance` marsruudi kaudu (vt allpool) — `PATCH` ei puutu `provenance`-i ja saadetud `provenance` väli **eiratakse vaikselt, mitte ei võeta vastu** |
| 3 | puuduva info loend | **read-side**, mitte uus tabel — vt allpool |

**Puuduv info EI kopeerita prep-i.** Prep-i vaade loeb juhtumi enda `CaseWorkMissingInfo` lahtised
punktid (`listMissingInfo`). Koopia oleks teine tõde ja rikuks ptk 4.7 („paralleelset andmebaasi
ei teki") — kaks loendit läheksid esimese lahendamise järel lahku. **Valikut „need 3 punkti
võtan sellel kohtumisel ette" V1-s ei ole** ja see on välja öeldud, mitte vaikimisi kadunud.

**`confirmProvenance({ … , from, to })`** on **oma operatsioon oma marsruudil**, mitte `PATCH`-i
kõrvalmõju. Ta võtab `from` väärtuse ja teeb tingimusliku update'i (sama muster mis L6) — nii ei
saa kaks samaaegset kinnitust teineteist üle kirjutada. **Ainus lubatud suund on `AI_MUSTAND` →
inimese märgis**; tagasiteed masina märgise juurde ei ole, sest see kirjutaks inimese kinnituse
ümber.

**Nõuded:** kirjutuskaitse **pärib juhtumilt** — `READ_ONLY`/`ARCHIVED` keelab ka laste muutmise
(JUHTUM-V1 L14), jõustatud **tingimusliku update'iga** koos vanema seisu tingimusega.

**`DELETE` on olemas** (erinevalt märkmest ja mustandist): ettevalmistus on tulevikuplaan, mitte
tõend. Kustutus on kõva kustutus ja seda ei auditeerita eraldi.

**Testileping:** võõra juhtumi prep → **404, mitte 403** · kirjutuskaitstud juhtumi prep ei
muutu (409) · `caseId`/`prepId` ristkontroll · `DELETE` kaks korda = idempotentne (teine 404) ·
**päritoluta väli ega küsimus ei salvestu** · tundmatu `provenance`, `fieldKey` või `kind` →
400 · **`PATCH` koos `provenance` väljaga ei muuda märgist** · `confirm-provenance` vale
`from`-iga → 409 · **`inimese märgis → AI_MUSTAND` → 400** · prep-i vaade kuvab juhtumi puuduva
info, aga ei salvesta sellest koopiat (kontroll: lahendamine juhtumis muudab prep-i vaadet).

---

### E4 — Kohtumise märge kaheksa kihiga *(migratsioon 2/4)*

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/caseWorkMeetingNote.js` — `createNote`, `getNote`, `listNotes`, `addEntry`, `updateEntry`, `removeEntry` |
| **API** | **uus** `.../[caseId]/meeting-notes/route.js` · `.../[noteId]/route.js` · `.../[noteId]/entries/route.js` · `.../entries/[entryId]/route.js` |
| **Pind** | `app/juhtumid/[caseId]/page.jsx` — märkme sektsioon, kaheksa kihti eraldi |
| **Värav** | `guardCaseWorkRequest()`, scope `casework:meeting-note` |
| **Valideerimine** | `layer` ∈ 8 väärtusest · `provenance` ∈ 8 väärtusest · **mõlemad kohustuslikud** |
| **Testid** | `tests/casework/meetingNote.test.js` + marsruuditest |

**Kaks mudelit** (L4): `CaseWorkMeetingNote` (konteiner, **tekstita**; valikuline FK
`CaseWorkMeetingPrep`-ile `SetNull`) ja `CaseWorkMeetingNoteEntry` (`layer`, `text`,
`provenance`, `ordinal`).

**`DELETE` märkmele puudub teadlikult** — märge on kohtumise jälg. Kirje saab eemaldada
(`removeEntry`), märget mitte. Juhtumi kustutus viib ta kaskaadis.

**Testileping:** tundmatu `layer` → 400 · tundmatu `provenance` → 400 · **päritoluta kirje ei
salvestu** · `PRIVAATNE_REFLEKSIOON` kirje **ei esine** üheski ekspordikujus (kontroll on E6
teenuskihi tasemel, mitte UI-s) · kirjutuskaitse pärib juhtumilt · võõra märkme `entryId` → 404.

**Piir:** ei loo `PracticeReflection` rida ega selle eelkäijat.

---

### E5 — STAR2 mustandi ahel *(migratsioon 3/4 — CASEWORK-P2 tuum)*

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/caseWorkDraft.js` — `createDraft`, `getDraft`, `listDrafts`, `setField`, `removeField`, **`transitionDraft`** |
| **API** | **uus** `.../[caseId]/drafts/route.js` · `.../drafts/[draftId]/route.js` · `.../[draftId]/fields/route.js` · **`.../[draftId]/transition/route.js`** (`POST`) |
| **Pind** | `app/juhtumid/[caseId]/page.jsx` — mustandite sektsioon + olekutee |
| **Värav** | `guardCaseWorkRequest()`, scope `casework:draft` / `casework:draft-transition` |
| **Valideerimine** | `draftType` ∈ 8 · `transferState` ∈ 6 · `provenance` iga välja peal |
| **Testid** | `tests/casework/caseWorkDraft.test.js` + marsruuditest |

**Kaks mudelit** (L4): `CaseWorkDraft` (`draftType`, `transferState`, `reviewKind`,
`transferredAt`, `contentPurgedAt`, **tekstita**) ja `CaseWorkDraftField` (`fieldKey`, `text`,
`provenance`).

**Kaks funktsiooni, üks primitiiv (v4 parandus — vt L19).**

**`transitionDraftStateTx(tx, { … , expectedFrom, to })`** — **sisemine**, ei ole eksporditud
avaliku API-na:

1. `canTransitionStar2(expectedFrom, to)` → **eelkontroll**, annab ausa 400 tundmatu sihi peale
2. **tingimuslik `updateMany`** `WHERE … transferState = expectedFrom` → 0 rida = **409** (L6)
3. `to === ULE_KANTUD` → samas tehingus `transferredAt = now()`

**`transitionDraft({ … })`** — avalik kasutajaoperatsioon. Kutsub primitiivi, **aga
`to = ULE_KANTUD` lükatakse tagasi 400-ga** (`casework.errors.use_mark_transferred`).
`ULE_KANTUD`-ini viib ainult E6 `markTransferred()`, mis loob samas tehingus ka auditirea.

**Kirjutuskaitse:** `ULE_KANTUD` ja `EI_KANTA` on terminaalsed — `setField`/`removeField`
keelduvad **409**-ga.

**DB CHECK-id** (L6 — väärtused, mitte üleminekud): `transferState` lubatud väärtustes ·
`transferredAt IS NOT NULL` ⟺ `transferState = 'ULE_KANTUD'` · `contentPurgedAt IS NOT NULL` →
`transferredAt IS NOT NULL`.

**R2 sulgemine:** `AgentArtifact`-ile antakse retention-klass, mis täna puudub —
`carrierClassForArtifactStatus()` on `provenance.js`-is juba olemas ja jääb ainsaks allikaks.

**Testileping:** ebaseaduslik üleminek → 409 · **kaks samaaegset üleminekut sama `expectedFrom`
pealt → üks 200, teine 409** · terminaalse mustandi väli ei muutu · võõra juhtumi `draftId` →
404 · `MUSTAND`-il ei saa olla `transferredAt` (DB CHECK) · **`POST /transition` `to=ULE_KANTUD`
→ 400, ja `transferState` EI muutu** (L19) · `transitionDraftStateTx` ei ole mooduli avalik
eksport.

*(Test „`ULE_KANTUD` paneb `transferredAt` samas tehingus" **kolis E6-sse** — see on nüüd
`markTransferred`-i omadus, mitte `transitionDraft`-i oma.)*

---

### E6 — „Kopeeri STAR2 jaoks" + ülekandeajalugu *(migratsioon 4/4)*

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/caseWorkTransfer.js` — `buildStar2Block`, `recordCopyEvent`, `markTransferred`, `listTransferEvents` |
| **API** | **uus** `.../drafts/[draftId]/star2-block/route.js` (`GET`) · `.../drafts/[draftId]/copy-events/route.js` (`POST`) · `.../[caseId]/transfer-events/route.js` (`GET`) |
| **Pind** | `app/juhtumid/[caseId]/page.jsx` — kopeerimisnupp + ajalugu; laua sektsioon **#10** lülitub sisse (L12) |
| **Värav** | `guardCaseWorkRequest()`, scope `casework:transfer` |
| **Valideerimine** | `fieldKeys` peavad kuuluma sellele mustandile |
| **Testid** | `tests/casework/caseWorkTransfer.test.js` + marsruuditest |

**Mudel `CaseWorkTransferEvent`** — **append-only**, `kind` ∈ `{COPIED_FOR_STAR2,
MARKED_AS_TRANSFERRED}` (L9), FK-d L8 tabeli järgi. **`update` ja `delete` teenuskihis ei
eksisteeri** ja marsruuti nendeni ei ole. **`clientActionId String?` + `@@unique([draftId,
clientActionId])`** (L22) — `COPIED_FOR_STAR2` kannab võtme kohustuslikult, `MARKED_AS_TRANSFERRED`
jätab ta `null`-iks, sest tema kaitse on tingimuslik siire (L18/L19).

**`buildStar2Block`** koostab teksti `CaseWorkDraftField` ridadest. **Ta ei tunne
`PRIVAATNE_REFLEKSIOON` kihti** — see väärtus ei jõua temani, sest E4 kihid ja E5 väljad on eri
tabelites ja ülekanne käib ainult `STAR2_KANTAV` kaudu.

**Väljundi esimene rida on hoiatus:** tegemist on ettevalmistava mustandiga ja ametlik kanne
sünnib STAR-is.

**Järjekord on L16 järgi:** plokk → lõikelaud → **alles siis** `copy-events`. Auditi tõrge
öeldakse kasutajale välja. **`clientActionId` sünnib L22 järgi enne lõikelauda** — kordus pärast
teadmata tulemusega `POST`-i annab sama võtme ja seega sama rea, mitte teist.

**`markTransferred()` on L18 järgi ÜKS TEHING ja L19 järgi AINUS TEE `ULE_KANTUD`-ini:**
`transitionDraftStateTx()` + `transferredAt` + `MARKED_AS_TRANSFERRED` auditirida — kõik kolm
samas tehingus. **U1 sündmus `casework.draft.external_transfer_marked` emiteeritakse pärast
edukat commit'i**, mitte tehingu sees. Kopeerimine ei emiteeri (L9).

**Testileping:** auditirida **ei sisalda ühtegi välja väärtust** (kontroll: iga
`CaseWorkDraftField.text` ei esine auditireas) · `PRIVAATNE_REFLEKSIOON` ei esine ploki
väljundis · kopeerimine **ei muuda** `transferState`-i · `markTransferred` emiteerib sündmuse,
`recordCopyEvent` mitte · võõra mustandi `fieldKeys` → 400 · transfer-event tabelil ei ole
update/delete rada · **`markTransferred` tehingu tagasiveeremisel ei jää ei olekusiiret ega
auditirida** · **teine `markTransferred` sama `expectedFrom` pealt → 409, teist auditirida ei
teki** · **`markTransferred` paneb `transferState`, `transferredAt` ja auditirea ühes tehingus**
(kolis E5-st, L19) · **ükski `ULE_KANTUD` mustand ei saa eksisteerida ilma
`MARKED_AS_TRANSFERRED` auditireata** — kontroll käib andmete, mitte kutsete tasemel.

**Testileping, L22 osa (v6):** sama `clientActionId` kaks korda → **üks rida**, mõlemal vastus
**200** ja sama auditirea id · kaks eri `clientActionId`-d → **kaks rida**, sest päris
korduskopeerimine on lubatud · `COPIED_FOR_STAR2` ilma võtmeta või vigase kujuga → **400**, rida
ei teki · **unikaalsust jõustab indeks** — test kirjutab teenuskihist mööda otse andmebaasi ja
saab keeldumise · kaks `MARKED_AS_TRANSFERRED` rida `clientActionId = null`-iga **ei põrka**
(`NULL` on Postgresis eristuv) — see test hoiab ära, et keegi teeks veeru hiljem `NOT NULL`-iks.

---

### E7 — Säilituse jõustamine *(0 migratsiooni — mudelid on E3–E6-s)*

**v2 uus etapp.** v1-s oli säilitus otsus ilma mehhanismita: L7 ütles, mis peab juhtuma, aga
keegi ei käivitanud seda ja E7 tõendas ainult kuupäeva arvutamist. **Otsus ilma jõustajata ei
ole säilitusreegel.**

> **v6: E7 on ainus etapp, mis ei lukustu enne omaniku otsust.** **O-JTA-5** (hüljatud
> töömaterjali säilitus) võib lisada siia neljanda töö (rada B) või jätta E7 kuju muutmata
> (rada A/C). E2–E6 on sellest sõltumatud. Lisaks kannab E7 nüüd **L23** tekstivõla — see ei ole
> säilitustöö, vaid arhiveerimise kinnitusdialoogi tekst, ja ta seisab siin, sest kell, millest
> ta räägib, sünnib selles etapis.

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/retention.js` — `findDraftsDueForPurge`, `purgeDraftContent`, `findCasesDueForWarning`, `findCasesDueForDeletion`, `deleteArchivedCase` |
| **Skript** | **uus** `scripts/casework-retention.mjs`, `npm run casework:retention` (+ `:dry`) |
| **API** | *ei ole* — säilitus ei ole kasutaja tegu |
| **Pind** | juhtumi ja mustandi vaates **nähtav loendus** (L7) + **arhiveerimise kinnituse kella-hoiatus** `casework.page.archive_clock_warning` ET/EN/RU (L23) |
| **Värav** | skript austab `CASEWORK_V1_ENABLED`-t: väljas → 0 tööd |
| **Testid** | `tests/casework/retention.test.js` |

**Kolm tööd, üks käivitus:**

| # | Töö | Tingimus | Tulemus |
|---|---|---|---|
| 1 | **mustandi sisu purge** | `transferredAt` + 12 kuud, `contentPurgedAt IS NULL` | `deleteMany` `CaseWorkDraftField` + `contentPurgedAt = now()` **ühes tehingus** |
| 2 | **juhtumi hoiatus** | `archivedAt` + 12 kuud **− 30 päeva** | U1 teavitus `casework.case.retention_warning` |
| 3 | **juhtumi kustutus** | `archivedAt` + 12 kuud | `delete` — kaskaad viib kõik lapsed (L15) |

**`archivedAt` tuleb PÄRIS ÜLEMINEKUST** (L17), mitte viimasest auditireast ega `updatedAt`-ist:

```
CaseWorkRetentionAudit WHERE fromState = 'READ_ONLY' AND toState = 'ARCHIVED'
```

Elutsükkel on ühesuunaline ja terminaalne, seega selliseid ridu on **täpselt üks**.

**Hoiatuse aeg on `deletionAt − 30 päeva`, mitte „11 kuud"** (v3 parandus). L7 lubab kasutajale
30 päeva; kalendrikuu on 28–31 päeva, seega „11 kuud" oleks andnud 28–31-päevase akna sõltuvalt
sellest, millal juhtum arhiveeriti. **Lubadus ja teostus arvutatakse samast valemist.**

**Idempotentsus.** Kõik kolm tööd on kordumatud ja seda **tõendab test, mitte kommentaar**:

- **purge:** `contentPurgedAt IS NULL` on päringutingimus — teine käivitus ei leia rida
- **hoiatus:** kordumatus tuleb **teavituskihist** (L17) — `createNotificationEvent()`
  `dedupeKey = casework.case.retention_warning:<caseId>:<ownerId>:v1` on unikaalne ja
  kokkupõrkel tagastatakse `{ created: false }`. **Säilitustöö ei kirjuta
  `CaseWorkRetentionAudit`-i ühtegi rida** — see oli v2 kella viga (L17)
- **kustutus:** kustutatud rida ei tule järgmises päringus

**Tõrge ja kordus.** Ühe rea tõrge **ei peata partiid** — logitakse ja liigutakse edasi; järgmine
käivitus proovib uuesti, sest tingimus on ikka täidetud. Eraldi retry-taristut ei ehitata.
**Partii suurus on piiratud** (`CASEWORK_RETENTION_BATCH`, vaikimisi 50), et üks käivitus ei
võtaks andmebaasi enda alla.

**Cron-rida valmis kujul**, `flock` sama mustriga mis A4-l:

```
15 3 * * * flock -n /var/lock/sotsiaalai-casework-retention.lock \
  /bin/bash -lc 'cd /home/ubuntu/apps/sotsiaalai && npm run casework:retention' \
  >> /var/log/sotsiaalai/casework-retention.log 2>&1
```

**Testileping — jõustamine, mitte arvutus:**

1. **sisu kustub päriselt** — pärast purge'i on `CaseWorkDraftField` **0 rida**, mustandi rida alles
2. purge ei puuduta mustandit, mille 12 kuud ei ole täis
3. purge ei puuduta mustandit ilma `transferredAt`-ita (`MUSTAND`, `EI_KANTA`)
4. **`CaseWorkTransferEvent` jääb pärast purge'i alles** ja `draftId` ei ripu
5. hoiatus läheb üks kord, mitte igal käivitusel
6. kustutus viib kaskaadis prep-i, küsimused, märkme, kirjed, mustandi, väljad ja transfer-eventid
7. kell arvutatakse **päris üleminekust** (`fromState = READ_ONLY`), mitte viimasest auditireast
8. **säilitustöö ei kirjuta `CaseWorkRetentionAudit`-i ühtegi rida** — L17 kella viga ei saa
   taastekkida (kontroll: auditiridade arv enne ja pärast kolme käivitust on sama)
9. **hoiatuse saatmine ei nihuta kustutuse aega** — pärast hoiatust arvutatud `deletionAt` on
   sama, mis enne (see on v2 vea otsene regressioonitest)
10. värav väljas → skript ei tee ühtegi kirjutust
11. ühe rea tõrge ei peata partiid
12. **(v6, L23)** arhiveerimise kinnitus kannab `archive_clock_warning` võtit, `READ_ONLY` siirde
    kinnitus **ei kanna**; võti on olemas kolmes keeles ja tekst nimetab kustutuse ulatust
    („juhtum koos lastega"), mitte ainult mustandi sisu

---

### E8 — Tõend

**Sond:** `npm run jta:probe` — päris andmebaasi ja **vähemalt kahe päris sessiooni** vastu,
**HTTP kaudu** (04.08 IDOR-i õppetund: teenuskihi otsekutse ei tõenda ligipääsupiiri).

Sond tõendab nimeliselt:

1. kaks töötajat on üksteise laudadest pimedad
2. võõra juhtumi prep / märge / mustand / transfer-event vastab **„ei leitud"**, mitte „ei tohi"
3. kirjutuskaitstud juhtumi laps ei muutu
4. **`PRIVAATNE_REFLEKSIOON` ei esine E6 väljundis üheski vormis**
5. auditirida ei sisalda ühtegi kopeeritud väärtust
6. ebaseaduslik üleminek annab 409
7. **kaks samaaegset üleminekut → üks õnnestub, teine 409**
8. säilituskell arvutatakse `ARCHIVED`-ist
9. **purge kustutab sisu päriselt** (loendus enne ja pärast)
10. kopeerimine ei muuda `transferState`-i
11. värav väljas → kõik marsruudid 404
12. **(v6, L22)** korratud `copy-events` sama `clientActionId`-ga → **üks rida**, ja seda
    kontrollitakse **päris andmebaasist**, mitte vastusest
13. **(v6, L13 saba)** sond **mõõdab ja logib `TIMEOUT`-sektsioonide arvu** päris laua kutsel.
    See ei ole väravanumber vaid **lähtejoon**: päringu tühistamise töö päästik on mõõdetud
    timeout-määr, ja mõõt peab olema olemas enne, kui ta probleem on

**Brauseris päris sessiooniga:** laud · ettevalmistuse koostamine · märkme kaheksa kihti ·
mustandi tee `MUSTAND → ULE_KANTUD` · kopeerimine (sh **lõikelaua tõrke tekst**) · ajalugu.

**Sond koristab enda järelt ja koristust kontrollitakse, mitte ei eeldata** — A4 õppetund
(`ServiceProviderProfile.ownerId` on `SetNull`, seega sünteetilise kasutaja kustutamine jättis
profiili alles).

---

## Selgelt väljas

Automaatne STAR2 saatmine (ptk 4.8) · `PracticeReflection` mudel (P3) · genogramm, ökokaart,
võrgustikukaart (P5) · meetodikataloog ja valiku-assistent (P6) · kliendi tagasiside (ptk 8.6) ·
sekkumispäevik (ptk 8.5) · juhtumi üleandmine kolleegile (O-JU-2) · org-koondid
refleksiooniandmetest (O-CW-6 vaikekeeld) · **päringu tühistamise taristu** (L13) ·
**puuduva info punktide valik ettevalmistuse peale** (E3 — prep loeb juhtumi loendit, koopiat ega
valikutabelit ei teki) · push, deploy, tootmisandmete lugemine.

---

## Väravad ja DoD

**Enne igat commit'i:** `npm test` · `npm run i18n:check` · eslint muudetud failidel ·
skeemimuudatusel `npm run db:migrate:check`.

**Enne E3/E4/E5/E6 commit'i lisaks:** `npx prisma generate` + dev-serveri restart + **üks päris
päring** — fake-prisma ei valideeri skeemi ja roheline sviit ei tõenda siin midagi.

**Migratsioone lisandub täpselt neli:** E3, E4, E5, E6 — **igaüks eraldi**, mitte kokku
liidetuna. Iga migratsioon lisab isikuandmete kandja ja väärib oma ülevaatust. E7 ei lisa
migratsiooni.

**DoD:** kõik väravad rohelised · `npm run jta:probe` täies mahus roheline päris andmebaasi
vastu · `npm run casework:retention:dry` läbi käidud · brauseri läbisõit tehtud ·
`SotsiaalAI.md` S4.1 ja S5 uuendatud · **värav jääb välja**.

## Lõpetamisel

Kanna `SotsiaalAI.md`-sse: mis liikus TEHTUD / POOLIK / TEGEMATA vahel · mis saba jäi lahti ·
mis jäi `NOT_PROVEN` · O-JU-1/O-CW-2/O-CW-10 vastuste kanne S4-sse · **cron-rida S1
„TEGEMATA (ootab omanikku)" nimekirja**, sest säilitustöö vajab serveri cron-tabeli muudatust.
**Teostuslugu ei kanta** — TEHTUD kirjeldus on lõik või kaks sellest, mida funktsioon inimese
jaoks teeb.
