# ÜLESANNE: `JTA-V1` — juhtumitöö assistent

**Olek:** **`READY_TO_ASSIGN`** — kinnitatud omaniku kolmanda auditiga 07.08 (v4).
**19 lukustatud otsust, 8 etappi, 4 migratsiooni.**
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
| **v4** | **omaniku kolmas audit — 1 blokeeriv + 2 täpsustust.** (a) **KAKS TEED `ULE_KANTUD`-ini:** v3 L18 lubas garantiid, mille E5 avalik `POST …/transition` oleks ümbert läbi lasknud — mustand oleks jõudnud `ULE_KANTUD`-i **ilma auditireata** ja säilituskell oleks hakanud käima tõendita ülekande peal. Kolm kihti, üks tee (L19); (b) `confirm-provenance` marsruut oli **nimetatud, aga API-loendist puudu**; (c) **prep-i väljad said oma tabeli** — üks jäme `provenance` terve ettevalmistuse peal ei suutnud väljendada „`agenda` = töötaja, `plainLanguageNotes` = AI", kuigi leping ise ütleb „AI koostatud **osa**". **Staatus kinnitatud.** |

**Neli minu enda viga on selles ahelas parandatud, mitte lünka.** L6 lubas andmebaasi CHECK-ilt
garantiid, mida `CHECK` anda ei saa. L8 väitis, et säilitusreegel ei ulatu auditikirjeteni, aga
audit rippus juhtumi küljes, mis säilitusreegli lõpus kustub. v2 hoiatusmehhanism nullis kella,
mida ta pidi teenindama. **Ja v3 L18 lubas ainsat teed `ULE_KANTUD`-ini samal ajal, kui E5 hoidis
teist ust lahti.**

Muster on läbi nelja versiooni sama: **iga kord, kui leping ütles „garantii", aga jõustaja jäi
nimetamata, oli garantii katki.** Just seepärast kannab iga etapp nüüd rida
`teenus → API → pind → värav → valideerimine → testid` ja iga L-otsus nimetab, **kes** teda
jõustab.

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

---

## Lahtised otsused — ükski ei blokeeri ehitust

| Kood | Küsimus | V1 vastus |
|---|---|---|
| **O-JTA-1** | laud oma marsruudil või töölaua sektsioon | **oma marsruut** — kümme sektsiooni ei mahu kaardile |
| **O-JTA-2** | ettevalmistus juhtumi küljes või vaba | **juhtumi küljes** (FK) |
| **O-JTA-3** | mitu ettevalmistust ühe juhtumi kohta | **mitu** — iga kohtumine on oma |
| **O-JTA-4** | kas mustandi saab luua ilma märketa | **jah** — ptk 4.5 elemendid ei eelda kohtumist |
| **O-CW-3** | refleksiooni ja ametliku dokumentatsiooni piir | **ei ole vaja V1-s** — E4 ehitab märkme kihi, mitte `PracticeReflection` mudeli |

---

## Teostus

**Iga etapp kannab sama kuut rida:** `teenus → API → pind → värav → valideerimine → testid`.
Kus mõni neist puudub, on see **välja öeldud**, mitte vaikimisi lahti.

---

### E1 — Laua koondlugeja *(0 migratsiooni, 0 otsust)*

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/workbench.js` → `getCaseWorkbench({ userId, roleState, db })`. **Uued lugejad** (L10): `listUpcomingContacts()` → `lib/casework/caseWorkAssist.js`; `countOpenMissingInfoByCase()` ja `listOpenMissingInfoForOwner()` → `lib/casework/caseWorkMissingInfo.js` |
| **API** | *ei ole* — E1 on teegikiht. Marsruut tuleb E2-s |
| **Pind** | *ei ole* |
| **Värav** | `getCaseWorkbench()` ise ei väravata (teek); L14 |
| **Valideerimine** | `userId` tühi → tühjad sektsioonid, mitte erind |
| **Testid** | `tests/casework/workbench.test.js` |

**Sektsioonid:** L12 tabeli E1-veerg — **7 täit + 1 kitsendatud (`activePreparations`)**.
Sektsioonid #4 ja #10 **puuduvad täielikult**, mitte tühjad.

Iga sektsioon tagastab ühesuguse kuju:

```
{ state: "OK" | "EMPTY" | "FORBIDDEN" | "TIMEOUT" | "ERROR", items: [...], notice: <i18n-võti|null> }
```

**Nõuded:** L1 · L3 · L10 · L13 (2500 ms tähtaeg sektsiooni kohta) · L14.

**Testileping:**

1. võõra kasutaja andmeid ei jõua ühessegi sektsiooni
2. iga sektsioon eristab `EMPTY` ja `FORBIDDEN`
3. ühe allika erind → **ainult see** sektsioon `ERROR`, ülejäänud `OK`
4. **tahtlikult aeglane lugeja → `TIMEOUT`**, ja koondkutse tagastab enne tema lõppu
5. rollita kutse → tühjad sektsioonid, **mitte erind**
6. `activePreparations` kannab E1-s `notice`-võtit, mitte `EMPTY`-t
7. `todaysContacts` ja `upcomingContacts` ei kattu — piir on **Eesti kalendripäev**
8. koondlugeja ei kutsu ühtegi `prisma.*`-meetodit otse (staatiline kontroll testis)

---

### E2 — Laua pind *(0 migratsiooni)*

| | |
|---|---|
| **Teenus** | E1 oma |
| **API** | **uus** `GET app/api/casework/workbench/route.js` → `guardCaseWorkRequest(req, { scope: "casework:workbench" })` |
| **Pind** | **uus** `app/toolaud/juhtumitoo/page.jsx` + töölaua kaart (UI-lipu ja rolli taga) + **ⓘ juhend ET/EN/RU** |
| **Värav** | L11 — värav väljas → `notFound()`; vale roll → 403 (L14) |
| **Valideerimine** | vastus on ainult descriptor-kuju; teenuskihi tekste ei renderdata toorelt |
| **Testid** | marsruuditest + i18n pariteet |

**ⓘ juhendi viimane osa ütleb piirid välja**, sama kujuga nagu `/juhtumid` oma: laud on isiklik ·
**ei ole koormuse mõõdik** · ei näita kellegi teise tööd · AI ei otsusta.

**Testileping:** värav väljas → kõik 404 · vale roll → 403 · **HTML tekstiväljas kuvatakse
tekstina** (JUHTUM-V1 E6 õppetund) · i18n pariteet kolmes keeles · `notice`-võtmed on kõik
tõlgitud.

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
eksisteeri** ja marsruuti nendeni ei ole.

**`buildStar2Block`** koostab teksti `CaseWorkDraftField` ridadest. **Ta ei tunne
`PRIVAATNE_REFLEKSIOON` kihti** — see väärtus ei jõua temani, sest E4 kihid ja E5 väljad on eri
tabelites ja ülekanne käib ainult `STAR2_KANTAV` kaudu.

**Väljundi esimene rida on hoiatus:** tegemist on ettevalmistava mustandiga ja ametlik kanne
sünnib STAR-is.

**Järjekord on L16 järgi:** plokk → lõikelaud → **alles siis** `copy-events`. Auditi tõrge
öeldakse kasutajale välja.

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

---

### E7 — Säilituse jõustamine *(0 migratsiooni — mudelid on E3–E6-s)*

**v2 uus etapp.** v1-s oli säilitus otsus ilma mehhanismita: L7 ütles, mis peab juhtuma, aga
keegi ei käivitanud seda ja E7 tõendas ainult kuupäeva arvutamist. **Otsus ilma jõustajata ei
ole säilitusreegel.**

| | |
|---|---|
| **Teenus** | **uus** `lib/casework/retention.js` — `findDraftsDueForPurge`, `purgeDraftContent`, `findCasesDueForWarning`, `findCasesDueForDeletion`, `deleteArchivedCase` |
| **Skript** | **uus** `scripts/casework-retention.mjs`, `npm run casework:retention` (+ `:dry`) |
| **API** | *ei ole* — säilitus ei ole kasutaja tegu |
| **Pind** | juhtumi ja mustandi vaates **nähtav loendus** (L7) |
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
