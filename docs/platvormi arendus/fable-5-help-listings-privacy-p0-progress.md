# P0 turvapakett — help-listing privaatsuslekete sulgemine (V1 + V2)

STATUS: COMPLETE

Progressidokument turvapaketile, mis sulgeb kaks tõestatud privaatsusleket abivahenduse kuulutustes. Skoop on **ainult V1 ja V2**. V3–V10, nõusolekuvoog, markerite CSS, kujundus ja uus funktsionaalsus on selgelt välistatud (vt §Piirid).

Alusdokument (audit): [`fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md`](fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md) — lekete täpne kooditõend on seal jaotistes A12 (runtime) ja B5 (V1/V2).

---

## 1. Lähtekontekst

| Väli | Väärtus |
|---|---|
| Lähtecommit | `890124bd` (`origin/main`, „AI update 2026-07-15 14:51") |
| Local main == origin/main | jah (`890124bdbef17f899ba15c11c93450ef17875fac`) |
| Haru | `fable/help-listings-privacy-p0` |
| Worktree | `C:/Users/rauds/Desktop/SotsiaalAI-p0` (eraldi; põhitööpuu `C:/Users/rauds/Desktop/SotsiaalAI` puutumata) |
| Sõltuvused | `node_modules` ja `generated/` jagatud põhipuust junction-lingiga; `.env` kopeeritud (mõlemad gitignore'itud) |
| Alusdokumendi SHA-256 | `40667c5969dd026ff5ec99d0a2da7bd4e5dde4104fc80d9bf29d60a99324296d` (allikas == koopia, 78878 baiti, bait-baidilt identne) |

---

## 2. Juurpõhjus

**V1 — Detail-GET ei autoriseeri.** `app/api/help/listings/[kind]/[id]/route.js` `GET` laeb kirje `loadRecord(kind, id)` kaudu ja tagastab `toHelpListingDetailView(record)` **ilma omaniku- ja staatusekontrollita**. `toHelpListingDetailView` on omanikuprojektsioon: sisaldab `rawPlace`, `editable*`, `beneficiaryLabel`, `urgency`, `providerScopeOrConditions`, täpset aadressi/lat-long (PHYSICAL). Tagajärg: iga sisselogitu loeb suvalise ID-ga võõra `DRAFT`/`CLOSED`/`CANCELLED`/`ARCHIVED`/`MATCHED` kirje täissisu.

**V2 — Globaalne loend ei põranda staatust.** `lib/help/requests.js` `listHelpRequests` (ja `offers.js` `listHelpOffers`) lisab `where.status` ainult kui klient annab staatuse; `app/api/help/listings/route.js` `scope=global` haru ei sunni `OPEN`. Tagajärg: globaalne loend tagastab võõraste `DRAFT/CLOSED/CANCELLED/ARCHIVED` kirjeid; `status=DRAFT` laiendab nähtavust.

Mõlemad on runtime-tõendatud alusdokumendi A12-s (B luges A `DRAFT`-i; globaalne loend näitas `Mustand`).

---

## 3. Serveripoolne nähtavusleping (jõustatud)

Leping elab **teenusekihis**, mitte ainult route'is — nii et ükski uus route ega kutsuja ei saa filtrit vahele jätta.

### Detail-GET (`GET /api/help/listings/[kind]/[id]`)

Ainus otsustuskoht on `loadHelpListingDetailForViewer` ([lib/help/listingAccess.js](../../lib/help/listingAccess.js)). Route on õhuke adapter: `outcome === "ok"` → 200, muidu ühetaoline 404.

- kirjet ei leidu → `not_found` → **404**;
- vaataja on **omanik** → omanikuprojektsioon (`toHelpListingDetailView`), **iga staatus** (DRAFT/OPEN/MATCHED/CLOSED/CANCELLED/ARCHIVED);
- vaataja **ei ole omanik** (sh ADMIN, sh — kui route lubaks — anonüümne):
  - staatus ≠ `OPEN` → `not_found` → **404** (ühetaoline; ei paljasta olemasolu ega staatust; ADMIN **ei** saa vaikimisi uut õigust mustandi sisule);
  - staatus = `OPEN` → **fail-closed avalik projektsioon** (`toPublicHelpListingDetailView`): allowlist-põhine, EI kanna `rawPlace`-i, täpset aadressi/koordinaati, `beneficiaryLabel`/`urgency`/`providerScopeOrConditions`/`skillsOrBackground`-i, `editable*`-välju, `structuredSummary`-t, `municipalityId`/`primaryCategoryId`-d ega `mapEntry` objekti;
- **autentimata** kasutaja saab route'i tasemel **401** (olemasolev `requireUser`); peer-kuulutuse detail ei muutu avalikuks;
- ADMIN säilitab olemasoleva **kustutamisõiguse** (DELETE-käsitleja jõustab eraldi) — GET ei anna talle uut **lugemisõigust** mitteavalikule sisule.

### Globaalne loend (`GET /api/help/listings?scope=global`)

Fail-closed OPEN-põrand kahel tasandil (andmebaasipäring + serialiseerimine):

- **Andmebaas:** `listHelpRequests`/`listHelpOffers` ([lib/help/requests.js](../../lib/help/requests.js), [lib/help/offers.js](../../lib/help/offers.js)) arvutavad `ownerScope = (scope === "mine" && userId)`; iga muu skoop → `status = "OPEN"` (+ aegumata), **eirates kliendi `status`-parameetrit**. Route'i globaalne haru ei threadi kliendi `status`-it üldse ja põrandab ka count'id (`globalOpenCountWhere`).
- **Serialiseerimine:** loend kasutab kokkuvõttevaadet `toHelpListingView`, mis ei kanna privaatvälju; `rawPlace` eemaldati ka võtmesõna-kokkuvõttest (vt §3.1).
- `scope=mine` (ainus omanikuskoop) säilitab omaniku töövoo: näeb oma kirjeid soovitud staatuses.
- Sama reegel kehtib **identselt** abisoovidele ja abipakkumistele.

### 3.1 Teadlik allika-tasandi lisaparandus (V1/V2 blokeerija)

`buildKeywordSummary` ([lib/help/listingViews.js](../../lib/help/listingViews.js)) põimis `record.rawPlace` avaliku võtmesõna-kokkuvõtte esimeseks tokeniks. Seda kokkuvõtet kasutavad **globaalne loend, avalik detail JA kaart** — seega lekkis omaniku privaatne toorasukoht võõrale kõigil kolmel pinnal. Kuna see on otsene V1/V2 rike (mitteomanik saab `rawPlace`-i), eemaldati `rawPlace` kokkuvõttest **allikast** (fail-closed, mitte pärast serialiseerimist). Üldistatud `municipalityLabel` katab asukohavajaduse; omanik näeb `rawPlace`-i endiselt eraldi väljal. See on ainus muudatus väljaspool kahte route-faili ja on dokumenteeritud siin, sest ilma selleta test 6 ja 14 ei saa rohelised olla.

## 4. Muudetud / lisatud failid

| Fail | Muudatus |
|---|---|
| `app/api/help/listings/[kind]/[id]/route.js` | **M** — GET delegeerib `loadHelpListingDetailForViewer`-ile; 404-kaardistus; 401 säilib; PATCH/DELETE puutumata |
| `app/api/help/listings/route.js` | **M** — `loadMineListings` → `scope:"mine"`; `loadGlobalListingsWithOwnPinned` → `scope:"global"`, ei threadi kliendi status'it, `globalOpenCountWhere` OPEN-põrand |
| `lib/help/requests.js` | **M** — `listHelpRequests` OPEN-põrand (`ownerScope`) |
| `lib/help/offers.js` | **M** — `listHelpOffers` OPEN-põrand (peegel) |
| `lib/help/listingViews.js` | **M** — uus `toPublicHelpListingDetailView` (allowlist); `rawPlace` eemaldatud `buildKeywordSummary`-st |
| `lib/help/index.js` | **M** — re-export `listingAccess.js` |
| `lib/help/listingAccess.js` | **A** — nähtavusleping: `loadHelpListingDetailForViewer`, `isPublicHelpListingStatus`, `normalizeHelpListingKind`, `HELP_LISTING_PUBLIC_STATUSES` |
| `tests/help/listingPrivacyP0.test.js` | **A** — 18 käitumistesti (päris teenusekiht + faithful fake-prisma) |
| `tests/help/listingPrivacyRouteContract.test.js` | **A** — 8 route-juhtmestuse lepingutesti |
| `docs/platvormi arendus/fable-5-help-listings-privacy-p0-progress.md` | **A** — see dokument |
| `docs/platvormi arendus/fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md` | juba `origin/main`-is @ `890124bd`, bait-identne (SHA-256 `40667c59...`) — audit self-contained |

**Prisma skeem, migratsioonid, CSS, komponendid, V3–V10 failid: MUUTMATA** (kinnitatud `git diff origin/main`).

## 5. Regressioonitestid

26 testi, kõik rohelised. Testid kutsuvad **päris teostust**; fake-prisma AINULT hindab reaalse koodi ehitatud `where`-objekti (ükski test ei ehita `where`-i käsitsi).

Nõutud 17 kaetud: (1) omanik loeb oma DRAFT → lubatud; (2–5, +5b) võõras loeb DRAFT/CLOSED/CANCELLED/ARCHIVED/MATCHED → `not_found`/404; (6) võõras loeb OPEN → lubatud, privaatväljad puuduvad; (7) anonüümne teenusekihis ei saa privaatprojektsiooni + route 401 (lepingutest); (8) ADMIN ei näe võõra DRAFT-i; (9) globaalne staatuseta = ainult OPEN; (10) `status=DRAFT` ei laienda; (11) sama CLOSED/CANCELLED/ARCHIVED; (12) `scope=mine` säilitab töövoo; (13) abisoov == abipakkumine; (14) globaalne loend ei väljasta `rawPlace`/privaatvälju; (15) `not_found` bait-identne (404 kuju ei erista olemasolu); (16) omanikuprojektsioon säilitab redigeerimisvoo; (17) teenusekaart = ainult PUBLISHED. Route-juhtmestuse lepingutestid lukustavad: GET delegeerib lepingule + 404/401; GET ei kasuta enam lekkivat omanikuprojektsiooni; PATCH 403 / DELETE omanik+admin; globaalne skoop sunnib OPEN-põranda.

## 6. Kontrollitulemused

| Kontroll | Tulemus |
|---|---|
| P0 sihttestid (26) | ✅ 26 pass / 0 fail |
| `npm test` (kogu sviit) | ✅ **1248 pass / 0 fail** / 0 skip |
| `eslint .` | ✅ 0 errorit (358 eelnevat warningut mujal; minu failid 0) |
| `npm run i18n:check` | ✅ en/ru match et |
| `next build --turbopack` | ✅ õnnestus (sh `/teenusekaart` + help-API route'id) |
| `git diff --check` | ✅ puhas |
| Prisma skeem/migratsioonid | ✅ muutmata (`git diff origin/main -- prisma/` tühi) |
| Markerite CSS haru | ✅ integreerimata (0 CSS-muudatust) |
| V3–V10 failid | ✅ puutumata |
| Alusdokument bait-identne | ✅ SHA-256 `40667c59...` |
| Deploy/serverimuudatus | ✅ tegemata |

**Isolatsiooni märkus:** worktree oli algul `node_modules`/`generated` junction-lingiga (piisas testidele+lint'ile), kuid Turbopack keeldub sümbol-/junction-lingist väljaspool projektijuurt. Seetõttu tehti isoleeritud `npm ci` (postinstall `prisma generate` taastas `generated/`). Põhitööpuu jäi puutumata (junctionid eemaldati AINULT lingina, sihtmärki mitte).

## 7. Teadlikud piirangud (skoobist väljas)

Ei teostatud (P0 skoop = ainult V1/V2): V3 liit-ID, V4 kuulutuse valik kaardil, V5 popup→eelpöördumine, V6/O1 markerite CSS, V7 i18n, V8 URL-olek, V9 tühiseise, V10/O3 nõusolekuvoog, avaliku kaardi/filtrite ümberkujundus, rate-limit/blokeerimine/moderatsioon, skeem/migratsioon, deploy. Ainus teadlik puudutus väljaspool kaht route-faili on `rawPlace` eemaldamine `buildKeywordSummary`-st (§3.1) — päris V1/V2 turvablokeerija, dokumenteeritud.

## 8. Sõltumatu auditi fookus

Soovitatav sõltumatu kontroll (eraldi audiitorile):
1. **Allowlist täielikkus** — kas `toPublicHelpListingDetailView` allikaväljadest saab tuletada mõne veel katmata omaniku-/mustandivälja (nt tulevikus lisatav väli päריb uut auku). Fail-closed disain peaks hoidma, aga kinnita.
2. **Kokkuvõttevaade** — kas `toHelpListingView` (kasutusel loendis, detailis, kaardil, vestluses) kannab veel mõnda privaatvälja peale `rawPlace`-i (nt `roleLabel` sisu tundlikkus). `roleLabel` jäeti alles kui olemasolev avalik loendiväli — kontrolli, kas see on aktsepteeritav.
3. **Skoobi-põrand** — kas mõni muu kutsuja (väljaspool route'i) kutsub `listHelpRequests`/`listHelpOffers` ilma `scope:"mine"`-ita eeldades mitteavalikke staatuseid. Grep kinnitas: ainult route. Kinnita uuesti.
4. **404 eristamatus** — ajastuspõhine kanal (kas findUnique tehakse enne staatuse-otsust) — praegu tehakse alati findUnique + seejärel otsus; kinnita, et see ei loo mõõdetavat ajavahet olemas/puudub vahel.
5. **Runtime autenditud kontroll** — käivita päris route'i vastu (LoginTempToken, nagu alusdokumendi A12) ja kinnita V1/V2 must-box käitumine üle HTTP.

## 9. Järgmine lubatud pakett

**P1 (katkised ühendused)** alusdokumendi B10 järgi, pärast selle haru sõltumatut auditit ja merge'i:
- **V5** — kaardipopup'i „Alusta pöördumist" → `/eelpoordumised?recipientEntryId=` (API-tugi olemas);
- **V4** — kaardilt „Võta ühendust" kuulutuse valik, kui vastaskuulutusi >1;
- **V7** — puuduvad i18n-võtmed (popup'i abikirje-väljad + ühendusvead).

V3 (liit-ID INTERNAL-marsruut) on samuti turvalähedane (vaikne EXTERNAL_EMAIL-fallback) ja võib P1-ga kaasneda, kui audit seda prioriseerib. **NB:** V3–V10 ja nõusolekuvoog (V10/O3) EI kuulu käesolevasse P0-sse.
