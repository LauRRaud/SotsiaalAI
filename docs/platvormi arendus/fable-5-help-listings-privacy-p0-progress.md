# P0 turvapakett — help-listing privaatsuslekked (V1 + V2 + HELP-P0a avalik projektsioon)

STATUS: COMPLETE

Progressidokument turvapaketile, mis sulgeb tõestatud privaatsuslekked abivahenduse kuulutustes. Algne V1/V2 teostus sulges võtme- ja staatusetaseme lekke, kuid sõltumatu audit `2f9323a6` leidis avaliku projektsiooni ristvälja-lekke ning sisemise KOV-ID lekke. HELP-P0a parandab ainult need kaks integratsiooni blokeerivat leidu. V3–V10, nõusolekuvoog, markerite CSS, kujundus ja uus funktsionaalsus jäävad välistatuks.

## 0. HELP-P0a järelparandus

| Väli | Väärtus |
|---|---|
| Paranduse lähtepunkt | `3479a4477865694fb1a6520583ba2131d55e856d` |
| Haru | `codex/help-listings-privacy-p0a-public-projection` |
| Audit | `codex/help-listings-privacy-p0-audit` @ `2f9323a6f4b61110e31048e7f9eb9ec9ac123b99` |
| HELP-P0-01 | parandatud: avalik tekst ei loe salvestatud vabateksti fallback'e |
| HELP-P0-02 | parandatud: avalik väljund ei sisalda `municipalityId`/`municipalityIds` väärtusi |

Ühine `toPublicHelpListingProjection` koostab avaliku title/description/summary väärtuse ainult kontrollitud kategooria-, KOV-, abi tüübi-, ajavormi- ja sihtrühmaandmetest. See ei loe `title`, `description`, `structuredSummary`, `roleLabel`, `beneficiaryLabel`, `urgency`, `providerScopeOrConditions`, `skillsOrBackground`, `rawPlace`, `conditions`, `serviceArea`, persisted `needTags` ega muid salvestatud vabateksti fallback'e. Sama projektsiooni kasutavad avalik detail, globaalne loend, Teenusekaart ning vestluse `browseResults` enne workflow vastuse ja metadata loomist.

Omanikuprojektsioon, matching'u sisemine sisend, salvestusmudel, staatuspiirid, PATCH/DELETE õigused ja 401/403/404 leping jäid muutmata. Prisma skeemi ega migratsiooni ei lisatud.

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
  - staatus = `OPEN` → **fail-closed avalik projektsioon** (`toPublicHelpListingDetailView` delegeerib `toPublicHelpListingProjection`-ile): allowlist-põhine, EI loe salvestatud vabateksti ega kanna `rawPlace`-i, täpset aadressiteksti, `beneficiaryLabel`/`urgency`/`providerScopeOrConditions`/`skillsOrBackground`-i, `editable*`-välju, `structuredSummary`-t, `municipalityId`/`primaryCategoryId`-d ega `mapEntry` objekti;
- **autentimata** kasutaja saab route'i tasemel **401** (olemasolev `requireUser`); peer-kuulutuse detail ei muutu avalikuks;
- ADMIN säilitab olemasoleva **kustutamisõiguse** (DELETE-käsitleja jõustab eraldi) — GET ei anna talle uut **lugemisõigust** mitteavalikule sisule.

### Globaalne loend (`GET /api/help/listings?scope=global`)

Fail-closed OPEN-põrand kahel tasandil (andmebaasipäring + serialiseerimine):

- **Andmebaas:** `listHelpRequests`/`listHelpOffers` ([lib/help/requests.js](../../lib/help/requests.js), [lib/help/offers.js](../../lib/help/offers.js)) arvutavad `ownerScope = (scope === "mine" && userId)`; iga muu skoop → `status = "OPEN"` (+ aegumata), **eirates kliendi `status`-parameetrit**. Route'i globaalne haru ei threadi kliendi `status`-it üldse ja põrandab ka count'id (`globalOpenCountWhere`).
- **Serialiseerimine:** iga mitte-`mine` loend kasutab `toPublicHelpListingProjection` projektsiooni. Salvestatud `description`, `title` ja `roleLabel` ei ole avalikud fallback'id; `description` ja `summary` on kontrollitud struktureeritud siltidest sünteesitud ning `roleLabel` on tühi.
- `scope=mine` (ainus omanikuskoop) säilitab omaniku töövoo: näeb oma kirjeid soovitud staatuses.
- Sama reegel kehtib **identselt** abisoovidele ja abipakkumistele.

### 3.1 Teadlik allika-tasandi lisaparandus (V1/V2 blokeerija)

`buildKeywordSummary` ([lib/help/listingViews.js](../../lib/help/listingViews.js)) põimis `record.rawPlace` avaliku võtmesõna-kokkuvõtte esimeseks tokeniks. Seda kokkuvõtet kasutavad **globaalne loend, avalik detail JA kaart** — seega lekkis omaniku privaatne toorasukoht võõrale kõigil kolmel pinnal. Kuna see on otsene V1/V2 rike (mitteomanik saab `rawPlace`-i), eemaldati `rawPlace` kokkuvõttest **allikast** (fail-closed, mitte pärast serialiseerimist). Üldistatud `municipalityLabel` katab asukohavajaduse; omanik näeb `rawPlace`-i endiselt eraldi väljal. See on ainus muudatus väljaspool kahte route-faili ja on dokumenteeritud siin, sest ilma selleta test 6 ja 14 ei saa rohelised olla.

HELP-P0a laiendab sama allikataseme tõkke kõigile avalikele tarbijatele. Legacy `description`/`roleLabel`/`needTags`/`serviceArea` väärtusi ei usaldata isegi siis, kui algne privaatväli puudub. Help-listing'u avalik Teenusekaart ei väljasta tekstilist `address`/`normalizedAddress` väärtust, sest legacy-kirjes võib see olla kopeeritud otse `rawPlace`-ist; kaardi koordinaadi- ja kujundusloogikat ei muudetud.

## 4. Muudetud / lisatud failid

| Fail | Muudatus |
|---|---|
| `app/api/help/listings/[kind]/[id]/route.js` | **M** — GET delegeerib `loadHelpListingDetailForViewer`-ile; 404-kaardistus; 401 säilib; PATCH/DELETE puutumata |
| `app/api/help/listings/route.js` | **M** — `loadMineListings` → `scope:"mine"`; `loadGlobalListingsWithOwnPinned` → `scope:"global"`, ei threadi kliendi status'it, `globalOpenCountWhere` OPEN-põrand |
| `lib/help/requests.js` | **M** — `listHelpRequests` OPEN-põrand (`ownerScope`) |
| `lib/help/offers.js` | **M** — `listHelpOffers` OPEN-põrand (peegel) |
| `lib/help/listingViews.js` | **M** — uus `toPublicHelpListingDetailView` (allowlist); `rawPlace` eemaldatud `buildKeywordSummary`-st |
| `lib/help/listingViews.js` (HELP-P0a) | **M** — ühine fail-closed `toPublicHelpListingProjection`; ainult kontrollitud struktureeritud avalikud sildid |
| `lib/help/mapEntries.js` (HELP-P0a) | **M** — Teenusekaart kasutab sama projektsiooni; ei väljasta persisted vabateksti ega KOV-ID-sid |
| `lib/help/chatWorkflow.js`, `lib/help/workflowActions.js` (HELP-P0a) | **M** — browse reply ja workflow metadata saavad enne serialiseerimist ainult avaliku allowlist'i |
| `lib/help/requests.js`, `lib/help/offers.js` (HELP-P0a) | **M** — globaalne/skoobita loend kasutab avalikku projektsiooni; `scope=mine` säilitab omanikuprojektsiooni |
| `lib/help/index.js` | **M** — re-export `listingAccess.js` |
| `lib/help/listingAccess.js` | **A** — nähtavusleping: `loadHelpListingDetailForViewer`, `isPublicHelpListingStatus`, `normalizeHelpListingKind`, `HELP_LISTING_PUBLIC_STATUSES` |
| `tests/help/listingPrivacyP0.test.js` | **A** — 18 käitumistesti (päris teenusekiht + faithful fake-prisma) |
| `tests/help/listingPrivacyRouteContract.test.js` | **A** — 8 route-juhtmestuse lepingutesti |
| `tests/help/publicProjectionPrivacyP0a.test.js` | **A** — request/offer ristvälja-markerid detaili, loendi, kaardi, workflow reply/metadata, legacy ja KOV-ID jaoks |
| `docs/platvormi arendus/fable-5-help-listings-privacy-p0-progress.md` | **A** — see dokument |
| `docs/platvormi arendus/fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md` | juba `origin/main`-is @ `890124bd`, bait-identne (SHA-256 `40667c59...`) — audit self-contained |

**Prisma skeem, migratsioonid, CSS, komponendid, V3–V10 failid: MUUTMATA** (kinnitatud `git diff origin/main`).

## 5. Regressioonitestid

Algsed 26 testi ja viis HELP-P0a testi on kõik rohelised: **31 pass / 0 fail**. Testid kutsuvad **päris teostust**; fake-prisma AINULT hindab reaalse koodi ehitatud `where`-objekti (ükski test ei ehita `where`-i käsitsi).

Nõutud 17 kaetud: (1) omanik loeb oma DRAFT → lubatud; (2–5, +5b) võõras loeb DRAFT/CLOSED/CANCELLED/ARCHIVED/MATCHED → `not_found`/404; (6) võõras loeb OPEN → lubatud, privaatväljad puuduvad; (7) anonüümne teenusekihis ei saa privaatprojektsiooni + route 401 (lepingutest); (8) ADMIN ei näe võõra DRAFT-i; (9) globaalne staatuseta = ainult OPEN; (10) `status=DRAFT` ei laienda; (11) sama CLOSED/CANCELLED/ARCHIVED; (12) `scope=mine` säilitab töövoo; (13) abisoov == abipakkumine; (14) globaalne loend ei väljasta `rawPlace`/privaatvälju; (15) `not_found` bait-identne (404 kuju ei erista olemasolu); (16) omanikuprojektsioon säilitab redigeerimisvoo; (17) teenusekaart = ainult PUBLISHED. Route-juhtmestuse lepingutestid lukustavad: GET delegeerib lepingule + 404/401; GET ei kasuta enam lekkivat omanikuprojektsiooni; PATCH 403 / DELETE omanik+admin; globaalne skoop sunnib OPEN-põranda.

## 6. Kontrollitulemused

| Kontroll | Tulemus |
|---|---|
| P0 + P0a sihttestid | ✅ **31 pass / 0 fail** (algsed 26 + 5 uut) |
| Help/Teenusekaart/vestlus regressioonid | ✅ **44 pass / 0 fail** |
| `npm test` (kogu sviit) | ✅ **1253 pass / 0 fail** / 0 skip |
| `eslint .` | ✅ 0 errorit (358 eelnevat warningut mujal; minu failid 0) |
| `npm run i18n:check` | ✅ en/ru match et |
| `next build --turbopack` | ✅ õnnestus (sh `/teenusekaart` + help-API route'id) |
| `git diff --check` | ✅ puhas |
| `npx prisma validate` | ✅ schema valid |
| `npm run db:migrate:check` | ✅ 92 migratsiooni ajutisse DB-sse; DB eemaldatud |
| Prisma skeem/migratsioonid | ✅ muutmata (`git diff 3479a447 -- prisma/` tühi) |
| Markerite CSS haru | ✅ integreerimata (0 CSS-muudatust) |
| V3–V10 failid | ✅ puutumata |
| Alusdokument bait-identne | ✅ SHA-256 `40667c59...` |
| Deploy/serverimuudatus | ✅ tegemata |

### 6.1 Autenditud HTTP-smoke

Lõplik runtime-run `helpp0amrnkgh67` kasutas eraldi ajutist PostgreSQL-andmebaasi, päris NextAuth `LoginTempToken` sessioone ja kolme `example.invalid` sünteetilist kasutajat. Request'i markerid olid `REQ_BENEFICIARY_helpp0amrnkgh67`, `REQ_URGENCY_helpp0amrnkgh67`, `REQ_SKILLS_helpp0amrnkgh67`, `REQ_RAW_PLACE_helpp0amrnkgh67`; offer'i markerid `OFF_PROVIDER_SCOPE_helpp0amrnkgh67`, `OFF_SKILLS_helpp0amrnkgh67`, `OFF_RAW_PLACE_helpp0amrnkgh67`.

- omanikud said oma request/offer detailist kõik vastavad markerid (HTTP 200);
- võõra request/offer detail, globaalne request/offer loend ja Teenusekaardi kaks help-kirjet andsid markeritabamusi 0;
- `municipalityId`/`municipalityIds` võtme- ja väärtusetabamusi oli kõigil avalikel pindadel 0;
- pärast kustutamist: kasutajad 0, login-tokenid 0, sessioonid 0, request'id 0, offer'id 0, kaardikirjed 0, match'id 0, sünteetiline KOV/kategooria/sihtrühm 0;
- server peatati ja ajutine andmebaas eemaldati.

**Isolatsiooni märkus:** worktree oli algul `node_modules`/`generated` junction-lingiga (piisas testidele+lint'ile), kuid Turbopack keeldub sümbol-/junction-lingist väljaspool projektijuurt. Seetõttu tehti isoleeritud `npm ci` (postinstall `prisma generate` taastas `generated/`). Põhitööpuu jäi puutumata (junctionid eemaldati AINULT lingina, sihtmärki mitte).

## 7. Teadlikud piirangud (skoobist väljas)

Ei teostatud: V3 liit-ID, V4 kuulutuse valik kaardil, V5 popup→eelpöördumine, V6/O1 markerite CSS, V7 i18n, V8 URL-olek, V9 tühiseise, V10/O3 nõusolekuvoog, avaliku kaardi/filtrite ümberkujundus, rate-limit/blokeerimine/moderatsioon, skeem/migratsioon ega deploy. HELP-P0a puudutab ainult auditis tõendatud avalikke projektsiooniteid: detail, globaalne loend, Teenusekaart ja vestluse browse-workflow.

## 8. Sõltumatu kordusauditi fookus

Algne Help-auditi Sol kontrollib pärast push'i ainult vahemikku `3479a447..<HELP-P0a commit>`. Teostaja ei anna enda parandusele auditihinnangut. Kordusaudit peaks kinnitama ühise projektsiooni kasutuse detailis, globaalloendis, Teenusekaardil ja workflow `browseResults`-is ning kordama request/offer markereid ja KOV-ID negatiivkontrolli.

## 9. Järgmine lubatud pakett

**P1 (katkised ühendused)** alusdokumendi B10 järgi, pärast selle haru sõltumatut auditit ja merge'i:
- **V5** — kaardipopup'i „Alusta pöördumist" → `/eelpoordumised?recipientEntryId=` (API-tugi olemas);
- **V4** — kaardilt „Võta ühendust" kuulutuse valik, kui vastaskuulutusi >1;
- **V7** — puuduvad i18n-võtmed (popup'i abikirje-väljad + ühendusvead).

V3 (liit-ID INTERNAL-marsruut) on samuti turvalähedane (vaikne EXTERNAL_EMAIL-fallback) ja võib P1-ga kaasneda, kui audit seda prioriseerib. **NB:** V3–V10 ja nõusolekuvoog (V10/O3) EI kuulu käesolevasse P0-sse.
