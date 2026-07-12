# Platvormiloogika ülevaate täiendav kvaliteediülevaade (max)

Kuupäev: 12.07.2026
Täiendatav raport: [fable-5-platvormiloogika-ulevaade.md](./fable-5-platvormiloogika-ulevaade.md) (edaspidi „ülevaade"; jääb muutmata kujul alles)
Lähteülesanne: [fable-5-platvormi-loogika-brief.md](./fable-5-platvormi-loogika-brief.md)

Eesmärk: lisada ülevaate järeldustele tõendusmaterjali (käivitatud testid, töötav rakendus, brauser), täpsustada ebakindlaid sõnastusi ja muuta soovitused teostatavateks arenduspakettideks. Rakenduse koodi selles etapis ei muudetud; loodud sünteetilised testandmed on loetletud ptk 2.5 ja kustutatud.

Tõendusastmete märgistus: **[KOOD]** staatiliselt koodist loetud · **[TEST]** käivitatud automaattest · **[RUNTIME]** töötava rakenduse API vastu kontrollitud · **[BRAUSER]** brauseris kontrollitud · **[LAHTINE]** praegu ei olnud võimalik kontrollida.

## Etappide seis

| Etapp | Sisu | Seis |
|---|---|---|
| 1 | Peajärelduste tõendusregister | **VALMIS** (ptk 1) |
| 2 | Voogude praktiline kontroll (testid, runtime, brauser) | **VALMIS** (ptk 2) |
| 3 | Kovisiooni tervikpilt ja vastavuskaart | **VALMIS** (ptk 3) |
| 4 | Häälvestluse realistlik teostus | **VALMIS** (ptk 4) |
| 5 | Andmemudeli täpsustused | **VALMIS** (ptk 5) |
| 6 | Rollide ja ligipääsude kooskõla | **VALMIS** (ptk 6) |
| 7 | Prioriteetide täpsustamine | **VALMIS** (ptk 7) |
| 8 | Tooteomaniku otsustusmaatriks | **VALMIS** (ptk 8) |
| 9 | Tulevaste funktsioonide arhitektuuriline sobivus | **VALMIS** (ptk 9) |
| 10 | Lõppkokkuvõte (5 osa) + koristuslogi | **VALMIS** (ptk 10) |

---

## 1. Peamiste järelduste tõendusregister

Kontrollikeskkond: lokaalne dev-server (`preview_start` → `next dev`, port 3000), PostgreSQL `localhost:5432/sotsiaal_ai` (töötas), Node v24.18.0. **Oluline piirang:** `.env` sisaldab ainult `DATABASE_URL` + NextAuth + tellimuse lippe; puuduvad `OPENAI_API_KEY`, RAG-teenuse võtmed, `STT_SERVER_URL`, TTS- ja SMTP-seaded. Seega AI-vastuse, RAG-otsingu, kõne- ja e-kirjafunktsioonide **runtime-kontroll ei olnud võimalik** — nende kohta kehtivad koodi- ja testitõendid.

Runtime-kontrollid tehti kahe olemasoleva **testkontoga** (`claude.admin@sotsiaal.ai` — pöördumise autor; `codex.spatial.test@local.invalid` — adressaat), mõlemad `ADMIN`. Sellel on kaks tagajärge, mida register eraldi märgib: (a) tellimusepiirded (`requireSubscription`) jäid admini möödapääsu tõttu runtime'is katmata; (b) puhta `SOCIAL_WORKER`/`CLIENT` rolli käitumine on kontrollitud koodist, mitte sessioonist.

| # | Ülevaate järeldus (asukoht) | Tõendus | Kindlus | Vajalik täpsustus |
|---|---|---|---|---|
| R1 | Pöörduja põhirada „töötab serveris otsast lõpuni" (ptk 1.1, 4.1 A–D) | **[RUNTIME]** kogu ahel läbitud päris serveri vastu: teekonnamustand → salvestus → shareKeys-eeltäide → eelpöördumine (INTERNAL, SENT) → adressaat näeb → accept → vastuvõtutöövoog (märge+checklist) → ühine ruum → sõnum ruumis (staatused ptk 2.3). **[BRAUSER]** Teekond, vastuvõtuvaade ja ruum kuvavad samu andmeid. | kõrge | Lisada kaks piirangut: (1) kontrollitud admin-kontodega — tellimusepiire ei rakendunud; (2) UI-vormi kaudu esitamist ei testitud, ainult API + vaadete kuvamine. |
| R2 | „Kogukonnarada töötab" — sobitus → tasuta ruum (ptk 1.2, 4.1 E) | **[RUNTIME]** `POST /api/help/matches` → 200, match `CONTACTED`, skoor 61, ruum loodud, adressaat näeb ruumi; `origin` väljad korrektsed (`HELP_MATCH` + matchId). **[TEST]** skoorimis- ja töövooloogika (48 testi). | kõrge | Täpsustus: sobituse *sisend* (kuulutuse loomine) käib ainult vestlustöövoo kaudu — `/api/help/listings` toetab ainult GET-i; otsest loomis-API-t ei ole. Lokaalses DB-s puudus abikategooriate külv (`HelpCategory` oli tühi) — värske keskkond vajab `prisma/seed.mjs` käivitamist, muidu on kogu abisoovi funktsioon kasutuskõlbmatu. |
| R3 | Kovisiooni andmekiht on „täielik", UI ei kutsu ühtegi `/api/covision` marsruuti (ptk 1.3) | **[RUNTIME]** juhtumi loomine (`anonymityConfirmed:true` → 201), sõnum (201), kokkuvõte (200) töötavad. **[KOOD]** grep üle `components/` + `app/` (v.a `app/api`): 0 `/api/covision` kutsujat — kordusloendatud. **[BRAUSER]** sisselogitud kasutaja näeb `/kovisioon` lehel demo-juhtumit „Katkendlik kooliskäimine", kuigi andmebaasis oli samal hetkel tema päris juhtum — katkestus on runtime'is tõendatud. | kõrge | „Täielik" vajab pehmendust — vt R4: üks marsruut on defektne; kõnede/sõnavõtusoovide marsruute ei runtime-testitud (LiveKit/mock konfiguratsioonita). |
| R4 | Eelpöördumine → Kovisiooni mustand: „server valmis, UI puudub" (ptk 4.2 tabel, rida 8) | **[RUNTIME] ÜMBER LÜKATUD:** `POST /api/pre-inquiries/[id]/covision` tagastab **alati 400** `covision.errors.anonymityConfirmed_required`. Põhjus: [buildCaseFromPreInquiryDraft](../lib/covision.js) (rida 1023–1038) ei sea `anonymityConfirmed` välja ja [marsruut](../app/api/pre-inquiries/[id]/covision/route.js) (read 31–37) ei edasta seda ka keha­st (kontrollitud: ka `{"anonymityConfirmed":true}` kehaga → 400). `normalizeCaseInput` viskab vea (lib/covision.js:366–368). | kõrge | Õige sõnastus: „marsruut on olemas, kuid praegusel kujul ei saa ükski väljakutse õnnestuda" — surnud ühendus, mitte valmis server. Parandus on väike (edastada kinnitus kehast või lubada kinnituseta DRAFT), aga eeldab tooteotsust, kas mustandi võib luua enne anonüümsuse kinnitust. |
| R5 | Tööheaolu väljundmustand töötab; Kovisiooni üleandmine on ainult navigeerimine (ptk 4.1 F) | **[RUNTIME]** mustandi loomine (`covision_input`) → 201; `PATCH` kinnitus → 200, staatus `ready_to_share`. **[KOOD]** nupp ainult navigeerib (`SupportRequestPanel.jsx:204–208`); Kovisiooni pool ei loe mustandeid. **[TEST]** 90 wellbeing-testi. | kõrge | Peab paika; lisada, et üleandmise sihtpunkt puudub ka andmekihis (ükski Kovisiooni väli ei viita `WellbeingOutputDraft`-ile). |
| R6 | Teekond↔eelpöördumine seos ei salvestu; `sourceJourneyId` kaob (ptk 5.1 p3) | **[RUNTIME] TÕENDATUD AKTIIVSELT:** saatsin loomispäringus kaasa `sourceJourneyId` — vastuses välja ei ole ja tabelis veergu ei ole (server ignoreerib tundmatut välja vaikimisi). | kõrge | Peab paika; nüüd runtime-tõendiga. |
| R7 | Ruumi dedup toimib kirjeldusmarkeri kaudu (ptk 5.1 p2) | **[RUNTIME]** teine `POST /pre-inquiries/[id]/room` tagastas sama ruumi (200). **[KOOD]** otsing käib `description contains "preInquiry:<id>"` järgi, kuigi `originType/originId` salvestatakse samas tehingus. | kõrge | Peab paika. Servajuht (liige on ruumist lahkunud → `leftAt` filter → tekib duplikaat) jäi runtime'is testimata — koodist tuletatav risk. |
| R8 | Rollipiirded on serveris jõustatud (ptk 6.1) | **[RUNTIME]** autentimata: 401 kõigil kontrollitud kaitstud marsruutidel (loend ptk 2.2); ristkasutaja IDOR-sondid: teise kasutaja Teekond → 404; mitteosaleja (isegi ADMIN!) Kovisiooni juhtum → 404; teise kasutaja Tööheaolu mustandiloend → ei leki. **[TEST]** `ci:smoke` OK. | kõrge | Peab paika kontrollitud marsruutidel. Erand-nüanss: `POST /api/chat` valideerib tühja keha **enne** autentimist (tühi keha → 400, korrektne keha → 401) — ohutu, aga ebajärjekindel. |
| R9 | Tööheaolu on ainult SOCIAL_WORKER + tellimus (moodulikaart, ptk 2.2) | **[KOOD]** `canUseWellbeingRole` + `requireSubscription` (`app/api/wellbeing/_shared.js:21–51`). **[TEST]** wellbeing apiContracts. **[RUNTIME]** admin pääses (admini möödapääs on koodis eksplitsiitne). | kõrge | Peab paika; runtime-kontroll puhta SOCIAL_WORKER kontoga jäi tegemata (kontot polnud aktiivse tellimusega). |
| R10 | STT/TTS „töötab (dikteerimine + ettelugemine)" (moodulikaart) | **[KOOD]** marsruudid + kasutusarvestus; **[TEST]** usage routeAdapter. **[RUNTIME]** ainult 401-piir; funktsionaalselt **[LAHTINE]** — võtmeteta keskkonnas tagastaks `api.stt.not_configured` (503). | keskmine | Sõnastada: „kood ja arvestus olemas; vajab võtmetega keskkonnas praktilist kontrolli (eesti keele kvaliteet eraldi teema)". |
| R11 | Parim praktika PUBLISHED → RAG-sünk (ptk 4.1 G) | **[KOOD]** `syncEffectivePracticeToRag` (lib/covision.js:580–659); **[TEST]** RAG-teksti vorming (covision/knowledge.test.js). **[RUNTIME] [LAHTINE]** — RAG-võtmeta läheks `syncStatus: skipped / rag_key_missing` harusse (see haru on koodis olemas ja loetud). | keskmine | Lisada, et võtmeta keskkonnas jääb praktika `ragMetadata.syncStatus=skipped` — käitumine on turvaline, aga sünk vajab RAG-iga keskkonna kontrolli. |
| R12 | „ESTA/Meetodipeegel/Supervisioon: 0 koodivastet" (ptk 2.1, 4.2 read 19–22) | **[KOOD]** grep'id korratud selles kontrollis; Supervisioonil ainult sildid tööheaolu adressaadiloendis. | kõrge | Peab paika. |
| R13 | Kovisiooni/graph-lite tabelid on ainult skeemis (skeemikommentaar) | **[KOOD] TÄPSUSTUS:** migratsioonid on olemas ja loovad tabelid: `20260506123000_add_covision` (8× CREATE TABLE), `20260612080000_rag_graph_lite` (3× CREATE TABLE). Skeemifaili kommentaar „Tables are created by a future migration" (schema.prisma:2560–2565) on **aegunud**. | kõrge | Ülevaade tabeleid ei kahelnud, kuid skeemikommentaar võib lugejat eksitada — väärib koristust (dokumendiviga, mitte koodiviga). |
| R14 | Testide olemasolu = voogude kaetus (ülevaade viitas testikaustadele kui tõendile) | **[TEST]** 456 testi käivitatud, 0 punast — aga kõik on **lib-taseme loogikatestid**; mitte ühtegi HTTP-marsruudi ega DB-integratsiooni testi. `test:e2e` skript viitab Playwrightile, mida repos **ei ole** (config puudub) — surnud skript. | kõrge | Ülevaates tuleks testiviited ümber sõnastada: „loogika on testitud; marsruudi/DB kiht ei ole". |
| R15 | Häälvestlus = „1 uus hook, serverimuudatusi pole vaja" (ptk 8.2) | Süvakontroll ptk 4 (selles failis). Eelvaade: põhiväide „olemasolevad serveri marsruudid piisavad" jääb püsima, aga „1 hook" on alahinnang — puutub ≥4 klientfaili + olekumasina servajuhud (kaja, katkestus, autoplay). | — | Vt ptk 4. |
| R16 | Kandidaat 1 „~85% olemas" (ptk 10) | **[RUNTIME]** ahela serveripool on nüüd läbi käidud; puuduolev on täpselt loetletav (seosekirje, tagasiside, UI-kinnitusvoog, testid). | kõrge | Protsendi asemel kasutada puuduolevate tükkide loendit (ptk 7). |

---

## 2. Voogude praktiline kontroll

### 2.1. Käivitatud testid (täpsed käsud)

Kõik: `node --import ./scripts/register-node-test-loader.mjs --test <globid>` repo juurest; ühtegi faili ei muudetud.

| Globid | Tulemus |
|---|---|
| `tests/journey/** tests/preInquiries/** tests/privacy/**` | 29 pass / 0 fail |
| `tests/help/** tests/serviceMap/** tests/materials/**` | 48 pass / 0 fail |
| `tests/covision/** tests/calls/**` | 30 pass / 0 fail |
| `tests/wellbeing/** tests/workspace/**` | 90 pass / 0 fail |
| `tests/documents/** tests/usage/chatRouteUsage,routeAdapter` | 17 pass / 0 fail |
| `tests/chat/**` | 242 pass / 0 fail |

Kokku **456 pass, 0 fail**. Iseloom: puhas äriloogika (`lib/` impordid), ilma DB/HTTP-kihita — vt R14.

### 2.2. Runtime: autentimata piirid

`npm run ci:smoke` → OK. Curl-sond (meetod, tee → staatus): kõik kaitstud marsruudid 401 (`/api/journeys`, `/api/journeys/draft`, `/api/pre-inquiries`, `/api/pre-inquiries/[id]/room`, `/api/covision`, `/api/covision/effective-practices`, `/api/covision/assist`, `/api/wellbeing/overview`, `/api/help/listings`, `/api/stt`, `/api/tts`, `/api/rooms`, `/api/documents`, `/api/materials`); avalik `/api/service-map/entries` → 200; `/api/chat` tühja kehaga 400 / korrektse kehaga 401 (vt R8).

### 2.3. Runtime: autenditud otsast-lõpuni ahel

Sisselogimine: repo enda `LoginTempToken` mehhanism (`temp_login_token` → `/api/auth/callback/credentials`); kaks paralleelset sessiooni (autor `claude.admin@sotsiaal.ai`, adressaat `codex.spatial.test@local.invalid`; adressaadi `acceptsPreInquiries` lülitati testiks `true` ja taastati pärast).

| Samm | Marsruut | Tulemus |
|---|---|---|
| Teekonnamustand tekstist | `POST /api/journeys/draft` | 200, mustand (reeglipõhine, AI-vaba) |
| Teekonna salvestus | `POST /api/journeys` | 201, pealkiri „kodune abivajadus" |
| Eeltäide Teekonnast | `POST /api/journeys/[id]/pre-inquiry-draft` (`shareKeys:["summary"]`) | 200, prefill + `sourceJourneyId` kaasas |
| Eelpöördumise loomine | `POST /api/pre-inquiries` (INTERNAL adressaat, `status:"SENT"`, **kaasa pandud `sourceJourneyId`**) | 201; `deliveryChannel:INTERNAL`, `recipientOwnerId` täidetud; **`sourceJourneyId` ei salvestunud** (R6) |
| Adressaat näeb | `GET /api/pre-inquiries` (adressaadi sessioon) | 200, kirje loendis |
| Vastuvõtu kinnitus | `POST /api/pre-inquiries/[id]/accept` | 200 → `READY` |
| Vastuvõtja töövoog | `PATCH /api/pre-inquiries/[id]/workflow` (märge + checklist) | 200, salvestus |
| Ühine ruum | `POST /api/pre-inquiries/[id]/room` | 201, ruum 2 liikmega |
| Ruumi dedup | sama marsruut teist korda | 200, **sama ruum** (R7) |
| Adressaadi ruumiloend + sõnum | `GET /api/rooms`; `POST /api/rooms/[id]/messages` | 200; 200 |
| IDOR: võõras Teekond | `GET /api/journeys/[võõras-id]` (adressaadi sessioon) | **404** — omanikupiire peab |
| Kovisiooni juhtum | `POST /api/covision` (`anonymityConfirmed:true`) | 201, staatus `draft` |
| Kovisiooni sõnum + kokkuvõte | `POST /api/covision/[id]/messages`; `POST /api/covision/[id]/summary` | 201; 200 |
| **Eelpöördumisest juhtum** | `POST /api/pre-inquiries/[id]/covision` (nii tühja kui `anonymityConfirmed:true` kehaga) | **400 mõlemal juhul** — vt R4 (uus leid) |
| IDOR: mitteosaleja juhtum | `GET /api/covision/[id]` (teise admini sessioon) | **404** — osalejapiire peab, admin ei möödu |
| Tööheaolu mustand + kinnitus | `POST /api/wellbeing/output-drafts`; `PATCH …/[id]` | 201; 200 → `ready_to_share` |
| IDOR: võõraste mustandite loend | `GET /api/wellbeing/output-drafts` (teine kasutaja) | ei leki (oma loend tühi) |
| Abisobitus → ruum | seemnekirjed DB-sse (kategooria `TRANSPORT`), siis `POST /api/help/matches` | 200; match `CONTACTED`, skoor 61; ruum loodud; `originType:HELP_MATCH`; adressaat näeb ruumi |

### 2.4. Brauserikontroll

Sisselogitud sessioon brauseris (sama temp-tokeni mehhanism). Kontrollitud 1920×1080 ja 1536×864:

- **/kovisioon** — renderdub täisekraani lõuendina; kuvab **demo**-juhtumit („Katkendlik kooliskäimine", Mari Mets, 6 demo-osalejat, „Demo vaade" vaatevahetaja) hoolimata sellest, et sisselogitud kasutajal oli andmebaasis päris juhtum. Konsoolis 0 viga. See on ülevaate „katkestuse" järelduse otsene runtime-tõend.
- **/teemaseemned** — 4 demo-seemet; navigeerimisribal on „Parimad praktikad · **ehitamisel**" (lehe enda sees on staatus ausalt märgitud; karusselli kaart sama ausust ei kanna). „Ava kovisioonis" nupp on olemas (demo-tasemel seos).
- **/teekond** — kuvab E2E-s loodud päris Teekonna („kodune abivajadus", märgis „Privaatne").
- **/eelpoordumised** — vastuvõtuvaade kuvab READY-staatuses pöördumist, tegevused „Märgi vastuvõetuks / Ava vestlusruum", vastuvõtja tööplaani checklist. Nüanss: admini puhul kuvatakse „Saabunud" loendis kõik nähtavad pöördumised (sh enda saadetud) — see on teadlik „Admini testvaade" (`WorkspaceFeaturePage.jsx:936`), tavakasutajal filtreeritakse `recipientOwnerId` järgi (koodist kontrollitud, sessiooniga mitte).
- **/ruum** — E2E-s loodud ruum nähtav (Omanik, 2 liiget, lugemata märk).

Piirang: brauseripaani ekraanipildid aegusid selles keskkonnas korduvalt (30 s timeout), seega paigutuse **piksli-tasemel** kontroll (kattumised, kontrast — funktsioonide-ja-ux-kaardistus.md probleemid 1–7) jäi tegemata; kontroll põhineb lehe tekstil/struktuuril ja konsoolil. See tähendab, et ülevaate ruumilise UI väited jäävad visuaalses osas endise tõendusastmega.

### 2.5. Loodud testandmed ja koristus

Sünteetilised kirjed (kõik loodud selle kontrolli käigus, kustutatud kontrolli lõpus; kustutuslogi ptk 10.6 juures): 1 Journey, 1 PreInquiry, 2 Room (+liikmed/sõnumid), 1 CovisionCase (+sõnum+kokkuvõte), 1 WellbeingOutputDraft, 1 HelpRequest, 1 HelpOffer, 1 HelpMatch, 3 LoginTempToken; `codex.spatial.test` `acceptsPreInquiries` taastatud `false`. Püsiv kõrvalmõju: `HelpCategory` referentsandmed (10 kirjet) külvati repo ametliku seederiga — need on kanoonilised püsiandmed, mida lokaalne keskkond nagunii eeldab (ilma nendeta on abisoovi funktsioon lokaalselt katki), ja need jäetakse alles.

### 2.6. Mida ei olnud võimalik praegu kontrollida

1. AI-vestluse vastus, RAG-otsing ja allikakaardid (võtmed puuduvad) — sh see, kas vestluse „journey" töövoog päriselt AI-ga mustandini jõuab; reeglipõhine `journeys/draft` marsruut töötab.
2. STT/TTS tegelik kvaliteet ja kasutusarvestuse commit-haru (võtmeteta ainult 401/503 piirid).
3. E-kirja saatmine (eelpöördumise EXTERNAL_EMAIL, kutsed, kovisiooni kutsed) — SMTP puudub; kood tagastaks `email_not_configured` (503).
4. Kõnede LiveKit-haru ja salvestuse egress (CALL_PROVIDER puudub → MOCK); kõne-API-de runtime-kontroll jäi tegemata.
5. Heli → transkript → artefakt töövoog runtime'is (transkriptsioon on vaikimisi välja lülitatud; testid katavad valideerimisloogika).
6. Tellimusepiirded sessioonis (mõlemad testkontod on adminid; puhta rolli + aktiivse tellimusega kontot lokaalselt polnud).
7. Piksli-tasemel paigutus kahes resolutsioonis (ekraanipiltide timeout).

---

## 3. Kovisiooni tervikpilt: viie allika vastavuskaart

Võrreldud allikad: (1) lõuend [CovisionSession.jsx](../components/covision/CovisionSession.jsx) — **täpsustus ülevaatele: sisuliselt on ehitatud etapid 1–4; etapid 5–8 renderdavad platseholderi „See etapp on ehitamisel"** (CovisionSession.jsx:3160–3167), etapirada näitab kõiki kaheksat; (2) [TeemaseemnedPage.jsx](../components/teemaseeme/TeemaseemnedPage.jsx) (demo-seemned, lokaalne olek); (3) Prisma mudelid `CovisionCase` + 7 seotud (schema.prisma:1742–1922; tabelid on migreeritud — `20260506123000_add_covision`); (4) `/api/covision/*` marsruudid; (5) spetsifikatsioonid `Kovisioon/` kaustas (visioon + etapid 1–8 + Teemaseeme + „Lõpetatud juhtumid" + „Parimad praktikad").

### 3.1. Vastavuskaart

**A. Otsene vastavus — saab siduda ilma skeemimuudatuseta**

| Mõiste (lõuend/spec) | Andmekiht | Märkus |
|---|---|---|
| Juhtumi pealkiri, üldistatud kirjeldus | `CovisionCase.title`, `anonymizedDescription` | otsene |
| Soovitud tugi (seemne „Soovin") | `expectedHelpTypes[]` | otsene |
| Teemad/sildid | `topics[]`, `tags[]` | otsene |
| Osapooled (ühise pildi „Seotud osapooled") | `CovisionParty` (category/type/label/rollikirjeldus/koostööstaatus) | otsene |
| Sündmused/ajajoon („Aeg / võtmesündmused") | `CovisionJourneyStep` (order, dateLabel, staatus CONFIRMED/NEEDS_CLARIFICATION) | otsene |
| Etapi 3 küsimused; tähelepanekud; riskid/kaitsetegurid; kogemused; järgmised sammud | `CovisionMessage` tüübid QUESTION/OBSERVATION/RISK/PROTECTIVE_FACTOR/EXPERIENCE/NEXT_STEP (+allika-/dokumentatsiooni-/võrgustikumärge) | otsene tüübistik on olemas ja lai |
| Etapi 8 kokkuvõte ja õppimine | `CovisionSummary` 11 tekstivälja (sh `takeaways`, `openQuestions`, `possibleNextSteps`) | tugev vastavus |
| Vaatleja; grupiliige; kokkuvõtte hoidja | `CovisionParticipantRole` OBSERVER / PARTICIPANT / SUMMARY_REVIEWER | otsene-lähedane |
| Hääl kui inimestevaheline vestlus + sõnavõtusoovid (spec §8; „kirjuta enne, räägi siis" voorud) | `CallSession` (contextType COVISION) + `CallSpeakRequest` + mute-marsruudid | taristu olemas, UI puudub; runtime-kontrollimata (provider konfigureerimata) |
| Praktikakandidaadi põhivoog (kandidaat → kontroll → ülevaatus → avaldatud) | `EffectivePractice` DRAFT→ANONYMITY_CHECK→REVIEW→PUBLISHED (+HIDDEN/ARCHIVED) + RAG-sünk | olekuvoog vastab; vt puudused D-osas |

**B. Osaline vastavus — mõiste on olemas, aga tähendus või granulaarsus erineb**

| Mõiste | Kus on nihe | Vajalik täiendus |
|---|---|---|
| Fookusküsimus (lõuendil kinnitatav, olekutega `none/confirmed/temp`, ankurdub etappidesse 5–8) | `centralQuestion` on üks olekuta tekstiväli | kas piisab tekstist + kinnitusajast (`context`-JSON) või lisada olek; väike |
| Ühise pildi plokid „Juba proovitud", „Mis on toiminud / mis mitte" | lähim on `CovisionMessage` EXPERIENCE või `JourneyStep.notes` — semantika hägune | kokkulepe, millisesse tüüpi need kirjed lähevad; ilma selleta tekib vabatekstisupp |
| „Piirangud / takistused" | `CovisionRiskFactor` (RISK) on lähim, aga mitte sama mõiste | kas laiendada FactorType'i või leppida RISK-iga |
| Seemne/juhtumi olekud `ootel / valitud / järelvaates` | `CovisionCaseStatus` DRAFT/ACTIVE/SUMMARY_READY/CLOSED/ARCHIVED — „valitud (kohtumisele)" ja „järelvaates" puuduvad | vt 3.2 (Teemaseemne otsus) ja D „Kohtumine/Järelvaade" |
| Juhtumi tooja / sessiooni juht | OWNER / CO_MODERATOR — nimed ja õigused pole spetsifitseeritud rollidega üks-üheselt | rollide → õiguste maatriks tuleb enne UI-sidumist kokku leppida |
| Anonüümsus | juhtumi tasemel (`anonymityConfirmedAt` + `detectAnonymityIssues`) on olemas; spec nõuab **elemendi tasemel** jagamiskandidaate (Kovisioonipakk) | elemendi-taseme nähtavus vajab uut struktuuri (D) |

**C. Vastuolud (mitte pelgalt puudumine)**

1. **`CovisionVisibility.ORGANIZATION` on surnud väärtus:** kasutajakontol pole organisatsiooniseost (`User` mudelis pole org-välja; `OrganizationAdmin` on RAG-halduse mudel) — väärtust ei saa sisuliselt jõustada. Spec räägib kutsutud osalejate ringist, mitte org-nähtavusest. Soovitus: mitte kasutada ORGANIZATION-it enne, kui org-mõiste päriselt eksisteerib.
2. **Salvestuse vaikeseis:** lõuendi sessiooniseade ütleb „Heli ja video: ei salvestata", andmekiht toetab nõusolekupõhist salvestust COVISION kontekstis (`CallRecording*`). Mitte konflikt, kui seade päriselt juhib käitumist — aga praegu ei juhi miski midagi (seaded on demo).
3. **Kaks sisenemisteed juhtumisse:** spec näeb rada Teemaseeme→Kovisioonipakk→juhtum; koodis on lisaks eelpöördumine→juhtum (defektne, R4). Mõlemad võivad jääda, aga vajavad ÜHIST anonüümsusväravat — praegu on värav loomise hetkel kohustuslik, mis ongi R4 vea põhjus.
4. **Skeemikommentaar vs migratsioonid:** graph-lite kommentaar skeemas väidab tabelite puudumist, ehkki migratsioon on olemas (R13) — dokumendihügieen.

**D. Puuduvad mõisted (ei mudelis ega API-s)**

| Puuduv mõiste | Allikas, mis seda nõuab | Mõju |
|---|---|---|
| **Kohtumine** (osalejad, päevakava, 1–2 juhtumit, avaring järelvaadetega, rotatsioon, koguaeg) | visioon §5.1; lõuendi `meetingElapsed` + „kohtumise aeg" kiip | suurim struktuurne lünk; ilma selleta ei ole „valitud tänaseks" olekul kandjat |
| **Kovisioonipakk** (omaniku privaatne esitlustugi + elemendi-taseme jagamiskandidaadid) | visioon §4.2; Teemaseemne „prep" vaade | privaatsuspiiri kandja; praegu on juhtum osalejatele tervikuna nähtav |
| **Etapi kursor + etapiväravad** (mis etapis; väravatingimused — kvoorum, kokkulepped, pildi kinnitus, privaatsuskontroll) | visioon §12.2; lõuendi `caseConfirmed/settingsConfirmed/pictureConfirmed/privacyChecked/readyCount` | ilma selleta ei saa lõuendit andmekihiga siduda |
| **Kokkulepped + osaleja kinnitused** (8 kokkulepet, N/6 kinnitanud) | lõuendi `AGREEMENTS` + `pState.agreed` | vajab per-osaleja kinnituskirjet |
| **Sessiooni seaded** (ajad, sügavus, toe tase, signaalid, „detailne töömaterjal: ajutine") | lõuendi `SESSION_SETTINGS`; visioon §16.2 viide | „ajutine töömaterjal" on ka säilituspoliitika otsus |
| **Osaleja kohalolu/valmisolek + kvoorum** | lõuendi `pState.status`, „kvoorum täidetud" | `inviteStatus` katab kutse, mitte kohalolu |
| **Järelvaade** (kuupäev, skaala tehtud/osaliselt/…, tähelepanuvajadus) | visioon §5.1 avaring; „Lõpetatud juhtumid" spec (järelvaate kalender) | eraldi kirje või juhtumi väljad |
| **Juhtumiprofiil** (4 liiki: aktuaalne väljakutse / edukogemus / minevikujuhtum / tulevikueesmärk) | visioon §10.1; seemne `kind` | üks enum-väli |
| **Olulisus** (seemne 1–10) | Teemaseemned | üks int-väli |
| **Retsenseerimine** (määratud retsensent; valdkondlik/metoodiline/partnerorg roll; pädevused) | „Parimad praktikad" spec | `EffectivePractice`-l on ainult `reviewedAt`; retsensendi identiteet, määramine ja pädevusregister puuduvad — seotud `UserCapability` otsusega (ptk 5) |
| **Mitmemõõtmelised olekud lõpetatud juhtumil** (säilitamise olek, paki tehniline olek, kandidaadi olek) | „Lõpetatud juhtumid" spec | praegu 1 enum; spec eeldab 3–4 sõltumatut telge |

### 3.2. Kas Teemaseeme = `CovisionCase` DRAFT või eraldi objekt?

**Variant A — seeme on `CovisionCase` staatuses DRAFT (+ lisaväljad `kind`, `importance`, järelvaate väljad).**

- *Kasutajakogemus:* üks järjepidev objekt seemnest kokkuvõtteni; „Ava kovisioonis" on lihtsalt olekumuutus; topeltsisestust pole. Risk: seemnete leht muutub „juhtumite halduseks" ja kaotab kerguse; DRAFT-juhtumid ja päris-mustandid segunevad samas loendis.
- *Andmemudel:* enum vajab kas uusi väärtusi (nt `FOLLOW_UP`) — Postgresis `ALTER TYPE … ADD VALUE` on lihtne, aga **tagasipööramatu** — või lisavälju (`selectedForMeetingAt`, `followUpAt`, `followUpState`). Privaatse ettevalmistuse jaoks tuleb ikkagi luua omaniku-ainuõigusega alamstruktuur (Kovisioonipakk), sest `CovisionCase` on osalejatele tervikuna nähtav → variant A **ei väldi** uut mudelit, kui spec'i privaatsuskiht tõsiselt võtta.
- *Arendus:* väikseim tabelite arv; olemasolev API katab CRUD-i; aga iga seemne-UI muudatus puudutab juhtumi API-t.

**Variant B — eraldi `TopicSeed` objekt, millest ülemineku hetkel luuakse `CovisionCase` (seeme külmub, viide `covisionCaseId`).**

- *Kasutajakogemus:* seemnete leht jääb kergeks (kaardid, olulisus, ootel/valitud/järelvaates); privaatne ettevalmistus elab loomulikult seemne küljes; juhtum algab „puhta" objektina, kuhu jõuab ainult teadlikult jagatu — see on spec'i Kovisioonipaki loogika.
- *Andmemudel:* +1–2 tabelit (`TopicSeed`, hiljem `SeedPrepItem`); üks FK juhtumile; ei puutu olemasolevat Kovisiooni API-t. Duplikaadioht (sama sisu kahes elavas objektis) maandatakse reegliga: pärast juhtumi loomist on seeme kirjutuskaitstud peale järelvaate väljade.
- *Arendus:* rohkem pinda (uus API + UI-sidumine), aga muudatused ei riski olemasoleva Kovisiooni andmekihi semantikaga; Teemaseemnete lehe saab andmestada sõltumata lõuendi sidumise suurest otsusest.

**Soovitus:** variant **B**, kahel põhjusel: (1) spec'i keskne privaatsuslubadus („grupp näeb ainult seda, mida sa ise jagad") vajab elemendi-taseme piiri, mida `CovisionCase` sees on kohmakas hoida; (2) see laseb Teemaseemned päris-andmetele viia **enne** suurt lõuendi-sidumise otsust, väikese ja tagasipööratava sammuna. Variant A jääb mõistlikuks ainult siis, kui tooteomanik lükkab Kovisioonipaki kontseptsiooni edasi ja tahab MVP-d miinimumtabelitega.

### 3.3. Konkreetsed leiud selle etapi käigus

1. `POST /api/pre-inquiries/[id]/covision` on praegu alati-400 (R4). Parandusvariandid: (a) marsruut edastab `body.anonymityConfirmed` → kasutaja peab UI-s kinnitama enne loomist; (b) lubada kinnituseta DRAFT ja nõuda kinnitust enne osalejate kutsumist (värav hiljem). Variant (b) on spec'iga kooskõlas (värav on etapiülene), aga muudab `normalizeCaseInput` lepingut — tooteotsus.
2. Lõuendi etappide 5–8 spetsifikatsioonid on worktree's värskelt täiendatud (git status: etapid 5–7 muudetud, etapp 8 uus) — spec on lõuendist ees; sidumisotsus tasub teha enne etappide 5–8 ehitamist, muidu kasvab demo-võlg.
3. „Parimad praktikad · ehitamisel" märgis on Teemaseemnete alamnavigatsioonis olemas ja aus; karusselli kaart sama selgust ei kanna (ülevaate P0.4 jääb jõusse, leevendus on juba pooleldi olemas).

---

## 4. Häälvestluse realistlik teostus

Kontrollitav väide (ülevaade ptk 8.2): „serveripoolseid muudatusi ei ole vaja — kogu pakett on klientkihi sessiooniloogika … 1 uus hook". Kontrolli tulemus: **serveri osa peab paika, „1 hook" on alahinnang.**

### 4.1. Kontrollitud mehaanika (kood, read)

| Osa | Fakt | Allikas |
|---|---|---|
| Saatmine + voog | `useChatStream.sendMessage` → `POST /api/chat` (`stream:true`), SSE sündmused `meta` (allikad, workflow, `isCrisis`) / `delta` / `done` / `error`; 180 s klienditaimaut; `AbortController` on olemas ja `stop()` katkestab (katkestusteade lisatakse sõnumile) | [useChatStream.js:178–193, 570–888](../components/chat/hooks/useChatStream.js) |
| Topeltvastuse kaitse | `isGeneratingRef` blokeerib paralleelse saatmise (rida 205) | sama |
| Valmimise signaal | **puudub avalik callback** — voog lõpetab `mutateMessage(isStreaming:false)` sisemiselt; automaatseks ettelugemiseks tuleb hook'i lisada nt `onAssistantComplete(finalText, meta)` | sama |
| Mikrofon (dikteerimine) | `useSpeech.handleMic`: ühekordne salvestus (MediaRecorder/WAV), heliraja **sulgemine iga vooru järel**; helitaseme mõõdik on max-taseme jälgija, mitte vaikuseakna tuvastaja | [useSpeech.js:242–443](../components/chat/hooks/useSpeech.js) |
| Kaja/müra seaded | `useSpeech` kasutab `getUserMedia({audio:true})` **ilma** `echoCancellation` lipuvaliketa; repo pretsedent on olemas ruumikõnedes (`echoCancellation:true, noiseSuppression:true` — [useRoomCall.js:119–120, 165–166](../components/rooms/useRoomCall.js)) | kood |
| Ettelugemine | `speakText`: et-lokaal → `POST /api/tts` (kogu heli ühe base64-blobina, **voogedastuseta**), teksti kärbe 4500 tähemärki; en/ru → brauserisüntees; TTS-i `fetch` on **ilma AbortController-ita** (katkestada saab ainult `Audio` elementi) | useSpeech.js:170–216 |
| STT server | `/api/stt`: väline `STT_SERVER_URL` või OpenAI; rate-limit vaikimisi 20/min; kasutusarvestus `STT_SECONDS` reserve→commit/release; **faili kettale ei kirjutata; logisse lähevad ainult pikkused/kestused, mitte tekst ega heli** (kontrollitud kogu marsruudi ulatuses) | [stt/route.js](../app/api/stt/route.js) |
| TTS server | `/api/tts`: rate-limit vaikimisi 30/min; `TTS_CHARS` reserve→commit/release; pikkusepiir 4500 (Google) / 4096 (OpenAI); tagastab terve heli korraga | [tts/route.js:150–280](../app/api/tts/route.js) |
| Kriis | `isCrisis` tuleb SSE `meta` kaudu ja UI seab kriisiriba (`setIsCrisis`) — häälerežiim ei tohi seda varjata | useChatStream.js:783–785 |
| Töövood | abisoovi/dokumendi/teekonna/süvauuringu režiimid ja ruumirežiim käivad `activeWorkflow`/`isRoomMode` kaudu ChatBodys — häälsessioon peab olema lubatud ainult vaikerežiimis | ChatBody.jsx |

### 4.2. Riskikohad ükshaaval

1. **Mikrofoni load ja olek:** luba küsitakse `getUserMedia`-ga; keeldumise haru on olemas (veatekst). Häälsessioon vajab **püsivat** voogu (mitte per-voor avamist) + nähtavat „mikrofon aktiivne" indikaatorit kogu sessiooni ajaks. Praegune per-voor mudel tähendaks igal vooru alguses lühikest lünka ja mõnes brauseris korduvat loaviipa riski.
2. **Kõnevooru lõpetamine:** olemasolev mõõdik ei tee vaikuseakna tuvastust — vaja on kirjutada energia-läve VAD (nt 1,2–1,8 s allpool läve → voor lõppes) + miinimumpikkus + maksimumpikkus. Silero VAD (wasm) on täiendus, mitte eeldus; **eesti keele eripära VAD-i ei mõjuta** (VAD on keeleagnostiline), küll aga mõjutab STT kvaliteeti, mida saab hinnata alles võtmetega keskkonnas (2.6).
3. **TTS-heli sattumine mikrofoni (kõlarid, ilma kõrvaklappideta):** kõige suurem praktiline risk. Leevendused kihiti: (a) `echoCancellation:true` + `noiseSuppression:true` konstraint (pretsedent ruumikõnedes); (b) vaikimisi **pool-dupleks**: `Vastan`-olekus mikrofoni sisendit ei töödelda vooruna, ainult vahelerääkimise lävendina; (c) vahelerääkimise lävi kõrgem kui tavavooru lävi; (d) kui kaja-probleem püsib, pakkuda „vajuta-ja-räägi" varurežiimi. Ilma nende leevendusteta tekib isetriggerduv tsükkel — see on põhjus, miks „1 hook" hinnang oli liiga optimistlik.
4. **Vahelerääkimine + SSE katkestus:** `stop()` on olemas ja töötab (abort → „katkestatud" järelliide). Häälesessioonis tuleb see siduda: kasutaja hääl `Vastan`-olekus → `stopSpeaking()` + `stop()` + uus voor. Märkus: praegune abort-käitumine lisab sõnumisse katkestusteksti — häälerežiimis tuleks see kujundada „katkestasid vastuse" olekuna, mitte veana (UI-tekst, mitte serverimuudatus).
5. **TTS-päringu katkestamine:** `speakText` fetch vajab `AbortController`-it (praegu saab peatada ainult juba mängiva heli); pikk vastus + kärbe 4500 tähemärki tähendab, et pikad vastused vajavad **lausepõhist tükeldamist** (mitu TTS-päringut järjest) — see jääb 30/min limiidi sisse, aga korrutab `TTS_CHARS` kirjeid; alternatiiv on lühem „häälvastuse" kokkuvõte, mis on juba tooteotsus.
6. **Topelt-/hilinenud vastused:** `isGeneratingRef` + üks aktiivne `AbortController` katavad põhijuhu; häälesessioonil lisada „ainult värskeim voor loeb" reegel (vooru järjenumber), et hilinenud STT-vastus ei saadaks vananenud teksti.
7. **Transkripti nähtavus ja parandamine:** automaatsaatmisel kaob dikteerimisrežiimi „kontrolli enne saatmist" omadus — transkript ilmub kasutaja sõnumina (nähtav), aga *eel*kontrolli ei ole. Dokumendi lokaalsed-mudelid.md §7.4 lubab mõlemat („näeb transkripti", „saab parandada olulist terminit") — v1 realistlik lahendus: transkript nähtav, parandus = järgmine kõnevoor või tekstirežiimi lülitus; sõnaosa-täpsusega parandusliides jääb v2-te. See tuleb tooteomanikuga fikseerida (ptk 8, otsus O10).
8. **RAG-allikad:** SSE `meta`/`done` allikad renderduvad tavaliste kaartidena ka häälesessioonis (sama sõnumikomponent) — midagi ehitada pole vaja; ette ei loeta (kinnitatud: `speakText` saab ainult vastuse teksti).
9. **Kriisivastus:** `isCrisis` riba jääb nähtavale; soovitus mitte katkestada ettelugemist, aga kuvada kriisiinfo alati ka tekstina (praegune käitumine seda juba teeb — häälerežiim ei tohi akent sulgeda).
10. **Rate limit ja arvestus:** STT 20/min ja TTS 30/min on vestlustempoks piisavad (1 voor ≈ 1 STT + 1–3 TTS tükki); mõlemad marsruudid teevad reserve→commit/release, idempotentsusvõti on toetatud — häälesessioon peaks võtme igale voorule kaasa andma (kordussaatmiste kaitse).
11. **Vigadest taastumine:** STT 502/503 → tagasi `Kuulan` + veakiip; TTS viga → brauserisünteesi fallback on `speakText`-is juba olemas; võrgukatkestus SSE ajal → abort-haru olemas. Puudu on ainult olekumasina „Vajan täpsustust" haru (tühi/liiga vaikne transkript — praegu `chat.mic.silence` viga on olemas, sobib taaskasutada).
12. **Toorheli mittesäilitamine:** kinnitatud koodist (4.1) — server ei kirjuta heli kuhugi; kliendis elab blob ainult mälus. **[LAHTINE]** väliste teenuste (OpenAI/isemajutatud Whisper) poolne säilituspoliitika on lepinguline, mitte koodiküsimus.
13. **Autoplay-poliitikad:** esimene TTS käivitub kasutaja žestist (sessiooni alustamise klõps); Safari/iOS võib nõuda heli „lahtilukustamist" sessiooni alguses (vaikse puhvri mängimine) — väike, aga vajalik detail.

### 4.3. Parandatud muudatuskaart ja maht

| Fail | Muudatus | Suurus |
|---|---|---|
| `components/chat/hooks/useVoiceSession.js` **(uus)** | olekumasin (Kuulan / Sain aru / Otsin allikatest / Vastan / Peatatud / Vajan täpsustust), VAD-silmus, vooru järjenumbrid, idempotentsusvõtmed, vigade harud | uus, suurim tükk |
| `components/chat/hooks/useSpeech.js` | püsiva vooga režiim (+`echoCancellation`/`noiseSuppression` konstraint), vaikuseakna tuvastus, `speakText` AbortController + lausetükeldus, mõõdiku pausimine `Vastan` ajal | keskmine ümberehitus — praegune per-voor elutsükkel ei sobi sessioonile otse |
| `components/chat/hooks/useChatStream.js` | `onAssistantComplete` / `onAssistantInterrupted` callback'id konfiguratsiooni | väike |
| `components/alalehed/ChatBody.jsx` | häälsessiooni lüliti + olekukiip; lubatud ainult `activeWorkflow==="default" && !isRoomMode`; automaatsaatmine sisendivälja vahele jätmata → otse `sendMessage`; kriisiriba käitumine | keskmine |
| vestluse sisendiriba komponent + `app/styles/chat.css` | nupp, olekukiibid, „mikrofon aktiivne" püsiindikaator | väike |
| `messages/et|en|ru*.json` | ~10–15 uut võtit | väike |
| Server | **kohustuslikke muudatusi ei ole** (kinnitatud); valikulised hilisemad: TTS lausevoo-otspunkt latentsuse vähendamiseks; Silero VAD wasm-vara serveerimine | 0 / valikuline |

**Parandatud hinnang:** 1 uus hook + 4–5 olemasoleva faili muudatust; põhitöö on `useSpeech`-i sessioonirežiim ja kaja/vahelerääkimise häälestus, mitte „ühe hooki lisamine". Realistlik maht koos käsitsi testimisega (kaja kõlaritega, katkestused, eesti STT kvaliteedi esmane mõõtmine võtmetega keskkonnas): **3–6 tööpäeva**; ülevaate suund (ainult klientkiht, olemasolevad marsruudid) jääb kehtima.

---

## 5. Andmemudeli täpsustused

### 5.1. Migratsioonibaasi faktid (uus tõendus)

- Repo kasutab päris migratsioone: **76 migratsiooni** (`prisma/migrations`, lock `postgresql`); lokaalne DB on nendega sünkroonis — `npx prisma migrate status` → „Database schema is up to date!" **[RUNTIME]**
- Kovisiooni tabelid on migreeritud (`20260506123000_add_covision`, 8× CREATE TABLE) ja graph-lite samuti (`20260612080000_rag_graph_lite`) — skeemifaili kommentaar graph-lite „tulevasest migratsioonist" on aegunud (R13).
- Migratsioonihügieeni tööriist on olemas: `scripts/check-clean-migrations.mjs` loob localhostil ajutise andmebaasi ja kontrollib migratsioonide puhast rakendumist — skeemimuudatuste riski hindamisel saab sellele toetuda.
- Pisileiud: `npm run db:push:local` eeldab `.env.local` faili, mida repos ei ole (dokumenteerimata eeldus); `prisma/seed.js` ja `seed.mjs` eksisteerivad mõlemad (segadusoht, mitte viga).

### 5.2. `PreInquiry.sourceJourneyId` — vajalik nüüd; „väike" peab paika järgmiste tingimustega

- Skeem: `sourceJourneyId String?` + relatsioon `Journey`-le `onDelete: SetNull` + `@@index([sourceJourneyId])`; **kaks** mudelit muutuvad (Prisma nõuab vastaspoole `relation`-välja ka `Journey` mudelis). Migratsioon = üks nullable-veerg (Postgresis ilma tabeli ümberkirjutuseta), tagasipööratav (drop column).
- Ajaloolisi seoseid **ei saa** tagantjärele täita — seost pole kunagi salvestatud; aktsepteerida tühjus.
- Kirjutamine: `createPreInquiry` peab välja vastu võtma ja **kontrollima omandit** (`getJourneyForUser`), muidu saaks siduda võõra Teekonna id.
- **Privaatsusnõue serialiseerimisel:** `serializePreInquiry` tagastab praegu kõik väljad nii autorile kui adressaadile — `sourceJourneyId` tohib näidata ainult autorile (adressaadile on see võõra privaatse objekti viide). See on koodimuudatus, mitte ainult skeemimuudatus.
- Kogumaht: 1 migratsioon + ~3 faili (`schema`, `lib/preInquiries.js`, Teekonna detailvaate päring) — endiselt väike.

### 5.3. Ruumi `originType/originId` dedup — kaks sammu, mitte üks

- **Samm 1 (kohe, väike):** [pre-inquiries/[id]/room](../app/api/pre-inquiries/[id]/room/route.js) otsing markerilt üle `originType + originId` peale + liitindeks `@@index([originType, originId])` (praegu on ainult eraldi indeksid, schema:2178–2179). Tavaline indeks, mitte unikaalne — ajaloolisi duplikaate võib olemas olla ja `MANUAL_INVITE` ruumidel on `originId` null.
- **Samm 2 (hiljem, pärast duplikaadiauditit):** kui tahetakse jõustada „üks ruum ühe pöördumise kohta", on vaja **osalist unikaalset indeksit** (`WHERE "originId" IS NOT NULL AND "originType" = 'PRE_INQUIRY'`) — Prisma skeemikeel osalisi indekseid ei toeta, seega raw-SQL migratsioon + kommentaar skeemas. `HELP_MATCH` ruumid unikaalsust ei vaja (1:1 tagab juba `HelpMatch.roomId @unique`).
- Praegune markerikäitumine töötab (runtime: dedup tagastas sama ruumi), st samm 1 on kvaliteedi-, mitte tulekahjuparandus; teadaolev servajuht (liige lahkunud → `leftAt`-filter → uus ruum) jääb ka samm 1-ga alles ja vajab teadlikku reeglit („taasliida lahkunud liige" vs „uus ruum").

### 5.4. `WorkObjectLink` — mitte praegu (kinnitatud, uue põhjendusega)

Polümorfsele lingitabelile ei saa Prismas anda võõrvõtme-terviklust; iga sihttüübi kustutus peaks linke koristama käsitsi ja liituma olemasoleva kustutustaristuga (`DataDeletionJob`, retention-tööd) — see on püsikulu igale uuele objektitüübile. Kuni püsiseoseid on 2–3 (Teekond→eelpöördumine; eelpöördumine→juhtum on juba FK-ga `sourcePreInquiryId`), on otse-FK veerud õigem valik. Üldistada alles siis, kui paare on rohkem ja neil on ühine elutsükli vajadus.

### 5.5. `UserCapability` — mitte enne esimest päris tiitlit; disainimärkmed valmis

Esimene reaalne tarbija ei pruugi olla ESTA (kavandatav partnerlus), vaid **praktikate retsensent** („Parimad praktikad" spec: valdkondlik/metoodiline/partnerorganisatsiooni retsensent + pädevused — ptk 3.1 D). Disainil arvestada: `@@unique([userId, type, organizationRef])` nullitava `organizationRef`-iga lubab Postgresis mitut NULL-rida — kasutada tühistringi vaikeväärtust või osalist unikaalset indeksit; lisada `validUntil` + tagasivõtmise auditikirje. Ükski võimekus ei tohi avada privaatseid andmeruume (kooskõlas briefi ptk 2.1 ja 4 piiridega).

### 5.6. STAR2 `transferStatus` artefakti `metadata` JSON-is — sobib v1-ks

- Ei vaja migratsiooni; Prisma JSON-path filtrid töötavad Postgresis, kasutaja-kohane maht on väike → loendivaated on teostatavad ilma indeksita; GIN-indeks oleks raw-SQL migratsioon, mida v1 ei vaja.
- Piirangud: väärtuste valideerimine jääb rakenduskihti; ülekandeolek ei ole andmebaasis jõustatud invariant. Kui elutsükkel stabiliseerub, tõsta päris veeruks/enumiks.
- Üldreegel edaspidiseks (puudutab ka ptk 3.2 varianti A): Postgresi enum'i laiendamine (`ALTER TYPE … ADD VALUE`) on praktikas tagasipööramatu — ebakindla semantikaga olekud hoida esialgu eraldi väljadena, mitte enum'i laiendusena.

---

## 6. Rollide ja ligipääsude kooskõla

### 6.1. Runtime-kinnitatud piirid (uus tõendus)

| Kontroll | Tulemus |
|---|---|
| Autentimata piirid 14 marsruudil | 401 (ptk 2.2); avalik ainult `service-map/entries` |
| Võõra Teekonna lugemine teise kasutajana | 404 — omanikukontroll toimib |
| Kovisiooni juhtumi lugemine mitteosalejana, **kes on ADMIN** | 404 — `visibleCaseWhere` ei tee admini möödapääsu ([lib/covision.js:715, 742](../lib/covision.js)); admin-õigus avab rolli, mitte võõrad juhtumid |
| Teise kasutaja Tööheaolu mustandiloend | ei leki (rangelt `userId`-skoobis) |
| Ruumi nähtavus/sõnum liikmena | toimib; mitteliikme keeldu selles kontrollis ei testitud (koodis liikmesuskontroll + ruumi-billing on kõigis ruumimarsruutides — `hasRoomBillingAccess` kasutus: `rooms/route.js:135`, `messages/*`, `stream`, `read`, `members`, kõned) |

### 6.2. Tellimusepiirde kaart (uus, süstematiseeritud)

**Tellimusega piiratud (serveris):** vestlus (`/api/chat` — `subscriptionGate`), dokumendid, Tööheaolu, STT/TTS, ruumid sisuliselt (liikme `billingSource` + `HELP_MATCH_FREE` erand + ADMIN erand). **Ainult autentimisega (tellimuseta kasutatavad):** Teekonnad, eelpöördumised (sh loomine, vastuvõtt, ruumi avamine — ruumi sisenemine jääb siiski ruumi-billingu taha), Kovisiooni API, materjalide loend, teenusekaart (avalik). See muster on tõenäoliselt kooskõlas tasuta paketi loogikaga (free-plan migratsioon `20260711150000_free_plan` on olemas), aga **ei ole kusagil eksplitsiitselt fikseeritud** — vt otsus O12 (ptk 8). Ülevaate moodulikaart ütles „sisselogitud + tellimus" ainult vestluse kohta — see oli õige; täiendus lisab tervikpildi.

### 6.3. Admini vaateroll vs tegelik õigus

- `resolveSessionRoleState` muudab ainult **sisu vaaterolli**; õiguste kontrollid käivad `isAdmin`/rolli järgi eraldi — segunemist ei leidnud.
- Admin möödub tellimusest (authz.js:76–81) ja rollipiiretest (`canUseWellbeingRole(admin)`, `requireCovisionRole(admin)`), aga **mitte** omaniku-/osalejapiiretest (runtime-tõend ülal) — õige suund.
- Eelpöördumiste vastuvõtuvaates on adminil teadlik testvaade: „Saabunud" loendis kuvatakse **kõik talle nähtavad** pöördumised, sh enda saadetud ([WorkspaceFeaturePage.jsx:936](../components/workspace/WorkspaceFeaturePage.jsx) + UI-tekst „Admini testvaade"). Tavakasutajal filtreeritakse `recipientOwnerId === currentUserId` (rida 926) — sessiooniga kontrollimata (testkontod olid adminid), koodist üheselt loetav.

### 6.4. Lahknevused kui toote-/arhitektuuriküsimused (mitte vead)

1. **SERVICE_PROVIDER ja Kovisioon:** API lubab (`canUseCovisionRole` — SOCIAL_WORKER, SERVICE_PROVIDER, admin), Töölaud teenuseosutajale Kovisiooni kaarti ei paku (`workspaceDashboardCards.js:159–233`) ja lehe-tase lubab (`app/kovisioon/page.jsx:34` kasutab sama predikaati). Teenuseosutaja, kes teab URL-i, pääseb lõuendile. Otsus O3.
2. **Materjali esitaja ei saa oma faili alla laadida** — allalaadimine on admin-only (`app/api/materials/[id]/download/route.js:24`). Kas teadlik (fail = ülevaatuse omand) või lünk? Väike tooteotsus.
3. **Ruumi `origin*` väljade usaldus:** väärtused tekivad ainult serverikoodis (`buildRoomOrigin` valge nimekiri + pikkusekärped, [lib/rooms/origin.js:28–48](../lib/rooms/origin.js)); ükski API ei võta origin'it kasutaja sisendist — deduplikatsiooni tohib neile ehitada. Kirjeldusse jäävad ajaloolised `preInquiry:<id>` markerid võib jätta rahule (kirjeldus pole enam otsustuskoht pärast 5.3 sammu 1).
4. **Privaatsete andmeruumide üleandmised:** Teekond→eelpöördumine liigub ainult `shareKeys`-valikuline väljavõte (runtime-kinnitus: loodud pöördumine sisaldas ainult eeltäite sisu); Tööheaolu→välja liigub ainult genereeritud üldistus pärast topeltkinnitust (`userReviewed`+`userConfirmed`, runtime 201/200); Kovisiooni juhtumisse viib eelpöördumisest anonüümitud mustand + probleemituvastus (kood; marsruut ise praegu defektne — R4). Automaatset tervikobjekti kopeerimist ei leidnud üheltki rajalt.

---

## 7. Prioriteetide täpsustamine

Uued faktid, mis järjekorda mõjutavad: (1) kandidaat 1 serveripool on runtime-tõendatud — järelejäänu on selgelt piiritletud; (2) R4 defekt tuli juurde (väike parandus, aga vajab mikrootsust anonüümsusvärava kohta); (3) lõuendi etapid 5–8 on platseholderid, spetsifikatsioonid on ees — iga demo peale ehitatud nädal kasvatab sidumise hinda; (4) värske keskkond vajab `prisma/seed.mjs` külvi, muidu abisoovi funktsioon ei tööta (ops-märkus).

### 7.1. Järjekord A — väiksema tehnilise keerukusega (iga samm väike, sõltumatu, tagasipööratav)

| # | Pakett | Sõltuvus | Kui jääb tegemata |
|---|---|---|---|
| A1 | `PreInquiry.sourceJourneyId` + tagasilink Teekonnale (5.2) | — | seosed kaovad edasi; kandidaat 1 jääb poolikuks |
| A2 | Ruumi dedup samm 1: origin-otsing + liitindeks (5.3) | — | markerisõltuvus püsib; duplikaadirisk servajuhtudel |
| A3 | Tupikukoristus: `DOWNLOADED` otsus (O4), „Parimad praktikad" kaardi „ehitamisel"-märgis (O11) | O4, O11 | kasutaja usaldus (nupp lubab, mida pole) |
| A4 | R4 üherealine parandus: marsruut edastab `body.anonymityConfirmed` | mikrootsus (ptk 3.3 variant a/b) | eelpöördumine→Kovisioon jääb surnuks; UI-nupp (O1 järel) poleks võimalik |
| A5 | Sisemise eelpöördumise saabumise e-kiri (O6) | mailer olemas | vastuvõtu SLA sõltub lehe avamisest |
| A6 | Teemaseemnete andmestamine (`TopicSeed`, variant B) | O2 | demo-lõuendi võlg kasvab; kasutajad kaotavad sisestatud seemned |
| A7 | Häälvestlus (4.3 kaart, 3–6 päeva) | O10 | — (sõltumatu väärtus) |
| A8 | Lõuendi ↔ andmekihi sidumine (etapid 1–2 enne 5–8 ehitust) | **O1** (+O3 rolliulatus) | kaksikelu süveneb; iga lõuendi iteratsioon dubleerib tööd |

Eelis: pidev tarne, madal risk, iga samm e2e-testitav. Puudus: spetsialisti suurim nähtav väärtus (päris Kovisioon) jõuab kohale viimasena.

### 7.2. Järjekord B — suurima kasutajaväärtusega enne

| # | Pakett | Sõltuvus | Risk |
|---|---|---|---|
| B1 | O1+O2 otsused → Kovisiooni etappide 1–2 andmestamine (juhtum, osalejad, kokkulepped, väravad minimaalselt) | **O1, O2, O3** | suurim tükk; skeemitäiendused (3.1 D); kui otsused viibivad, seisab kogu rida |
| B2 | Tööheaolu → Kovisioon päris üleandmine (O7) | B1 | — |
| B3 | R4 parandus + „Ava Kovisioonis" nupp vastuvõtuvaatesse | B1 anonüümsusvärav | — |
| B4 | Teavitused (O6) | — | — |
| B5 | A1+A2 (seosekirje, dedup) | — | tehniline võlg püsib seni |
| B6 | Häälvestlus | O10 | — |

Eelis: spetsialistide põhiväärtus varem; sobib, kui tooteomanik saab O1–O3 kohe otsustada. Risk: B1 on ühekorraga suur; ilma otsusteta kukub praktikas tagasi järjekorrale A.

### 7.3. Esimese vertikaalse lõigu soovituse seis

Ülevaate soovitus (kandidaat 1: Vestlus → Teekond → eelpöördumine *lõpetamisena*) **jääb kehtima** ja on nüüd tugevamal alusel: serveripool on runtime'is läbi käidud; puudu on täpselt A1 (seosekirje+tagasiside), UI-kinnitusvoo poleerimine ja e2e-test. Tingimuslik alternatiiv: kui valitakse järjekord B, on esimene lõik „Kovisiooni 1. etapp päris juhtumiga" ja kandidaat 1 tuleb kohe teisena — mõlemal juhul ei tasu kahte lõiku paralleelselt alustada.

---

## 8. Tooteomaniku otsustusmaatriks

Formaat: **variandid → soovitatud lähtekoht → miks → mõju kasutajale → mõju andmemudelile/õigustele → seotud paketid → millal**. ESTA-teemad on kavandatava partnerluse ideed, mitte kinnitatud funktsioonid.

**O1. Kovisiooni lõuendi ja andmekihi sidumine.** Variandid: (a) lõuend olemasoleva andmekihi peale + puuduvad mõisted juurde; (b) uus andmemudel lõuendi järgi; (c) lõuend jääb demoks. → **Soovitus: (a).** Andmekiht on runtime-töökorras (ptk 2.3) ja spec'i mõisted mahuvad skeletile (3.1 A/B); (b) viskaks minema töötava, migreeritud kihi. Kasutajale: päris sessioonid, andmed säilivad. Andmemudel: +etapikursor, väravad, kokkulepped, kohalolu (3.1 D); õigused: rollide→õiguste maatriks (3.1 B). Paketid: A8/B1, B2, B3, „Lõpetatud juhtumid", „Parimad praktikad". **Kohe — blokeerib kõige rohkem.**

**O2. Teemaseeme.** Variandid: (a) `CovisionCase` DRAFT + lisaväljad; (b) eraldi `TopicSeed`, üleminekul juhtum + seemne külmutus. → **Soovitus: (b)** (põhjendus 3.2: elemendi-taseme privaatsus + väiksem risk olemasolevale API-le). Kasutajale: seemnete leht jääb kergeks, privaatne ettevalmistus selge. Andmemudel: +1–2 tabelit, FK juhtumile. Paketid: A6, B1. **Kohe pärast O1 (või koos).**

**O3. Teenuseosutaja Kovisioonis.** Variandid: (a) täisõigus (praegune API); (b) välistada; (c) osaleb ainult kutse alusel, omanikuõigus spetsialistil. → **Soovitus: (c)** — vastab spec'i rollimudelile; nõuab `canUseCovisionRole` jagamist loomis- ja osalusõiguseks. Kasutajale: selge ootus; õigused: väike serverimuudatus. Paketid: A8/B1. **Enne lõuendi avalikustamist; mitte kiireloomuline.**

**O4. Eelpöördumise `DOWNLOADED` rada.** Variandid: (a) ehitada PDF-allalaadimine + olek; (b) eemaldada olek UI-st/serialiseeringust (enum-väärtus jääb — Postgresis kustutamine ebapraktiline). → **Soovitus: (b) praegu**; PDF-eksport on omaette väärtus, mille võib hiljem koos olekuga tagasi tuua. **Võib oodata.**

**O5. STAR2 mustandi elutsükkel.** Variandid: metadata-JSON (5.6) / päris veerg / edasi lükata. → **Soovitus: metadata-JSON v1**, alles pärast ideed.md ptk 17 küsimuste 3, 8, 11 vastuseid; mitte ehitada enne Juhtumitöö assistendi otsuseid. Paketid: STAR_HELPER UI täiendus. **Võib oodata, aga eelneb igasugusele JTA tööle.**

**O6. Teavituskanal.** Variandid: (a) e-kiri; (b) platvormisisene märk; (c) mõlemad. → **Soovitus: (a) kohe, (b) järgmisena** (`dashboardBadges` konks on kaartides olemas). Õigused: ei muutu. Paketid: A5/B4. **Kohe (väike).**

**O7. Tööheaolu → Kovisioon üleandmise vorm.** Variandid: (a) kinnitatud mustand → juhtumi mustandi eeltäide (shareKeys-muster); (b) teadlik copy-paste. → **Soovitus: (a) pärast O1**; liigub ainult kinnitatud üldistus (`ready_to_share`), mitte toorkirje. Andmemudel: valikuline viide mustandile. **Pärast O1.**

**O8. Supervisioon.** Variandid: (a) hoida lähiplaanis; (b) kinnitada, et ei ehitata enne eraldi otsust. → **Soovitus: (b)**; olemasolevad sildid („supervisioon või muu kokkulepitud tugi" adressaadivalikuna) võivad jääda — need viitavad inimesele, mitte moodulile. **Võib oodata.**

**O9. ESTA.** Variandid: (a) alustada ettevalmistust; (b) fikseerida kontseptsioonistaatus, iga tulevane võimekus `UserCapability` + lülitiga, ilma ligipääsuta privaatsetele andmeruumidele. → **Soovitus: (b)** — koodis pole ühtki sõltuvust, midagi ei blokeeri. **Ei ole kiire.**

**O10. Häälvestluse ulatus.** Alaküsimused: ainult eesti keel v1? (soovitus: jah — en/ru kasutavad nagunii brauserisünteesi); transkripti parandamise tase (soovitus: nähtav transkript + parandus järgmise vooruga; sõnataseme redigeerimine v2); STT kvaliteedilävi enne avalikustamist (mõõta võtmetega keskkonnas). Paketid: A7/B6. **Enne häälvestluse arenduse algust.**

**O11. „Parimad praktikad" karussellikaart.** Variandid: peita / märgistada „ehitamisel" / suunata. → **Soovitus: märgistada** — Teemaseemnete alamnavigatsioonis on sama märgis juba olemas, karussell lihtsalt järgi. **Kohe (tühine).**

**O12. (UUS) Tasuta tuuma piir.** Leid 6.2: Teekond, eelpöördumised ja Kovisiooni API on tellimuseta kasutatavad; vestlus/dokumendid/Tööheaolu/kõnefunktsioonid mitte. Variandid: (a) kinnitada see piir teadliku tasuta paketina ja fikseerida; (b) muuta. → **Soovitus: (a) fikseerida kirjalikult** (praegu on piir tuletatav ainult koodist). Mõju: hinnastus, turundus, `requireSubscription` kohad. **Enne avalikku pakendamist; arendust ei blokeeri.**

---

## 9. Tulevaste funktsioonide arhitektuuriline sobivus

Alus: [ideed.md](./ideed.md) kavandid vs selle kontrolli käigus verifitseeritud aktiivne arhitektuur. Iga võimalus on hinnatud üheteistkümnes lõikes (probleem → kasutajatüüp → tiitlivajadus → taaskasutus → uus tööobjekt → privaatsuskihid → ühendused → liikuv objekt → ruumiline kogemus → STAR2 piir → eeldusotsused). Ükski funktsioon ei moodusta kohustuslikku rada — iga üksus peab olema eraldi praktiline; ühendused on kasutaja valikul. **Selles ülesandes midagi ei ehitatud.**

### 9.1. Juhtumitöö assistent (JTA) — ideed ptk 4, 11, 14

- **Probleem:** spetsialisti kohtumise-eelne ja -järgne töökorraldus (mis on puudu, mida küsida, mis ootab STAR2-sse kandmist) elab täna peas ja paberil.
- **Kasutajatüüp:** SOCIAL_WORKER. **Tiitel:** ei vaja — rollipõhine.
- **Taaskasutus (verifitseeritud):** vastuvõtutöövoog on juba pool JTA-d — `receiverNote` + `receiverChecklist` + staatused töötavad runtime'is (ptk 2.3); mustandigeneraator on olemas (`AgentArtifact` tüübid `STAR_HELPER`, `CASE_BRIEF`, `PRE_ASSESSMENT_SUMMARY` + dokreziimi UI); heli→transkript→kokkuvõte kett (`TranscriptionJob`) on andmekihis; privaatsuse eelkontroll (`privacyGuard`) on jagatav.
- **Uus tööobjekt:** kerge `CaseWorkAssist`-laadne „tööprotsessi kaust" (viide eelpöördumisele, järgmine kontakt, puuduva info loend, STAR2 viitenumber) + artefakti `transferStatus` metadata (O5). Ideed ptk 12 täismudelit (CaseWorkQuestion/MeetingPrep/TransferEvent) v1-s ei vaja.
- **Privaatsuskihid:** kogu sisu on töötaja privaatne; kliendile nähtav ainult see, mida klient ise saatis (eelpöördumine); halduslik kiht puudub.
- **Ühendused (kasutaja valikul):** eelpöördumine → JTA kaust (viide, mitte koopia); JTA → dokreziim (STAR2 mustand); JTA → Meetodipeegel; JTA → Kovisiooni üldistatud küsimus (sama muster nagu O7).
- **Liigub:** viited ja kasutaja kinnitatud mustandid; mitte kunagi kliendi Teekond ega toimiku koopia.
- **Ruumiline kogemus:** „tööprotsessi kaust" kui lõuendi püsiobjekt — kohtumise ettevalmistuse kaart liigub vastuvõtuvaatest kohtumise ühisvaatesse (9.7) ja sealt STAR2-mustandi kaardiks; mitte vormileht.
- **STAR2 piir:** ainult mustand + käsitsi „Kopeeri STAR2 jaoks" + viitenumber; pärast ülekandmist kirjutuskaitse (ideed 4.7). Ühtegi `CasePlan` koopiat ei looda.
- **Eeldusotsused:** ideed ptk 17 küsimused 1–4, 8, 11 (eelpöördumise õiguslik staatus, säilitus, refleksiooni piir) + O5. **Rühm 3.**

### 9.2. Meetodipeegel — ideed ptk 8

- **Probleem:** meetodivaliku ja mõju refleksioon ei jõua kuhugi; õppimine kaob.
- **Kasutajatüüp:** SOCIAL_WORKER. **Tiitel:** ei.
- **Taaskasutus:** Tööheaolu privaatkirje muster on otsene šabloon — `WellbeingRecord` (owner-only, JSON-väljad, `visibility:"private"`) ja `WellbeingOutputDraft` kinnitusvoog (`userReviewed`+`userConfirmed`, runtime-tõendatud) katavad sama vajaduse kuju; kovisiooni-mustandi generaator (ideed 8.7) = sama üldistusmuster mis `covision_input`.
- **Uus tööobjekt:** `PracticeReflection` (seotud juhtum/tegevus *valikulise* viitena, lähenemine, meetod, faktid vs tõlgendused eraldi väljadena, visibility ainult PRIVATE).
- **Privaatsuskihid:** rangelt privaatne; ainus väljund on kasutaja kinnitatud deidentifitseeritud Kovisiooni/Supervisiooni sisend; arenguvaade ainult töötajale endale (mitte juhile — ideed 8.8 keeld).
- **Ühendused:** JTA tegevuselt „ava refleksioon"; refleksioonist → Kovisiooni juhtumi mustand (vajab R4 parandust ja O1); vahehindamise tulemus „vajab supervisiooni" → Supervisiooni ruumi taotlus (kui D olemas).
- **Liigub:** ainult üldistatud tekstimustand; algne refleksioon jääb alati alles ja privaatseks.
- **Ruumiline kogemus:** peegel-kaart juhtumi kausta küljes; ajajoon (sekkumispäevik) sama `CovisionJourneyStep`-laadse ribana.
- **STAR2 piir:** refleksioon ei lähe kunagi STAR2-sse (ideed 4.4); AI hüpotees ≠ ametlik märge (13.3).
- **Eeldusotsused:** sisukas alles koos JTA-ga (seotud juhtum); enne vaja otsust ideed 17 k 15 (kas organisatsioon näeb midagi — soovitus: ei). **Rühm 3** (standalone-minivorm ilma juhtumiviiteta oleks tehniliselt rühm 2, aga väärtus on õhuke — mitte alustada sellest).

### 9.3. Võrgustikutöö töölaud ja võrgustikuruum — ideed ptk 5, 12, 14 (etapp 4)

- **Probleem:** mitme osapoole koordineerimine (kes osaleb, mida tohib näha, mis on kokku lepitud) käib täna e-posti ja telefoni teel.
- **Kasutajatüüp:** SOCIAL_WORKER (koordinaator); CLIENT kinnitab jagatava; SERVICE_PROVIDER osaleb kutsutuna. **Tiitel:** ei; osalejaroll on ruumi-tasemel.
- **Taaskasutus (verifitseeritud):** `Room`+`RoomMember`+`Invite` (sh sponsoreeritud kutse ja e-kiri) töötavad; `CallSession.contextType` on laiendatav (`NETWORK`); `ServiceMapEntry` annab osapoolte otsingu; eelpöördumise `resolveRecipient` muster sobib kutse ettevalmistuseks; ruumi `origin*` väljad kannavad seose.
- **Uus tööobjekt:** kaks kriitilist: `NetworkSharedItem` (mida täpselt on jagatud, kellele, mis ajast) ja `NetworkAgreement` (kokkulepe, vastutaja, tähtaeg) — need EI ole RoomMessage'id, sest vajavad elutsüklit; kliendi kinnituse kirje (`DisclosureGrant`) on privaatsuskriitiline uus mõiste.
- **Privaatsuskihid:** kolm taset on ideed 5.2-s selgelt defineeritud (privaatne juhtumiinfo / võrgustikuga jagatud kokkuvõte / osaleja ülesanne) — ruumi liikmelisus EI tohi avada JTA-d, Meetodipeeglit, Teekonda (koodis on see piir juba loomulik, sest need on eri tabelid omanikukontrolliga; runtime IDOR-tõendid ptk 2.3 kinnitavad mustrit).
- **Ühendused:** eelpöördumisest või JTA-st → võrgustiku kaardistus → Teenusekaardilt osaleja → kutse → ruum → kokkuleppe mustand → (käsitsi) STAR2.
- **Liigub:** kliendi kinnitatud piiratud kokkuvõte (mitte juhtum); kokkulepe kui objekt.
- **Ruumiline kogemus:** võrgustikukaart kui lõuend (osapooled kaartidena — sama liigutatavate kaartide grammatika, mida Teemaseemned juba katsetavad); kokkulepped püsiribana.
- **STAR2 piir:** kokkulepped dokumenteeritakse STAR2-s käsitsi; perearst ainult piiratud välise kontaktina, meditsiiniandmeid ei puudutata (5.7).
- **Eeldusotsused:** kliendi nõusoleku mudel (kuidas klient kinnitab jagatava — vajab UI-d ja õiguslikku sõnastust), ligipääsu lõppemise reegel (ideed 17 k 9–10). **Rühm 3.**

### 9.4. Supervisioon + kontrollitud superviisori tiitel — ideed ptk 22–23

- **Probleem:** superviisori juhitud professionaalne areng pole platvormil; Tööheaolu mustandid (`recipientType: supervisor`) tekivad, aga sihtkohta pole.
- **Kasutajatüüp:** SOCIAL_WORKER (osaleja); superviisor = olemasolev kasutaja **lisatiitliga** — esimene päris `UserCapability` tarbija koos praktikate retsensendiga (5.5).
- **Taaskasutus (verifitseeritud):** ruumi+kõne+kutse taristu (Kovisiooni `contextType` pretsedent); „tasuta osalejale" põhimõttel on koodis pretsedent — `HELP_MATCH_FREE` ruumi-billingu erand ([lib/rooms/access.js:21–26](../lib/rooms/access.js)) laieneb loogiliselt `SUPERVISION_FREE`-ks; Tööheaolu väljundmustandid on valmis sisendivorming; „kõnet ei salvestata, AI ei kuula" nõue (23.6) on lihtsalt salvestusfunktsiooni MITTE-lubamine selles kontekstis — vaikimisi käitumine ongi selline.
- **Uus tööobjekt:** `SupervisionSpace` (fookusküsimus, kokkulepe, olek, osalejad) + superviisori profiil/saadavus; ootenimekiri.
- **Privaatsuskihid:** sisu näevad ainult ruumi liikmed; ESTA/KOV näevad kokkuleppe korral ainult programmi koondnäitajaid (22.5) — sama summutusmuster, mis Tööheaolu koondil juba on; „ESTA ei näe sisu" on jõustatav ainult siis, kui halduskiht loeb eraldi statistikatabelit, mitte ruume.
- **Ühendused:** Tööheaolu mustand → ruumi taotlus; Meetodipeegli „vajab supervisiooni" → sama; järelrefleksioon jääb privaatseks.
- **Liigub:** kasutaja kinnitatud üldistatud küsimus; mitte kunagi Tööheaolu toorkirjed.
- **Ruumiline kogemus:** püsiv konfidentsiaalne ruum (23.1) — asünkroonne lõuend + kokkulepitud häälvestlused; sobib sama „ruum + lõuend" grammatikaga nagu Kovisioon.
- **STAR2 piir:** ei puutu.
- **Eeldusotsused:** superviisorite allikas ja kontrollimudel — „ESTA kontrollitud" märge eeldab lepet (22.2, kinnitamata partnerlus); ilma leppeta on võimalik „kutsutud superviisori" piloot (töötaja kutsub oma superviisori ise); tasuta teenuse rahastus (22.3) on väline otsus. **Rühm 3.**

### 9.5. Tööheaolu edasiarendus + KOV-i ja valdkondlikud koondid — ideed ptk 19–21

- **Probleem:** (a) töötaja privaatsete kirjete tervik (plaanid, järelkontroll) on poolik; (b) juhtkond ei näe töökorralduslikku pilti ilma privaatsust rikkumata.
- **Kasutajatüüp:** SOCIAL_WORKER; koondvaade = KOV juhi **võimekus** (`WellbeingPilotViewer` juba täidab seda rolli), mitte uus kasutajatüüp.
- **Taaskasutus (verifitseeritud):** kogu koondimasin on olemas ja testitud — `WellbeingPilotScope/Viewer`, k-anonüümne summutamine (`suppressed`, [aggregate.js:114–146](../lib/wellbeing/aggregate.js)), raportid+eksport (`pilotReport*`, 24 testi). Sisemised täiendused (19.8: plaanide koondvaade, järelkontroll, privaatsusmärgistus, andmete allalaadimine) on olemasolevate tabelite UI-kiht.
- **Uus tööobjekt:** sisemisteks täiendusteks ei ole vaja; valdkondlikuks koondiks eraldi **avaldamiskiht** (perioodi-aken, vahemikud, harvade sündmuste kaitse — 20.7 nõuded on praegusest `minimumGroupSize`-ist rangemad).
- **Privaatsuskihid:** kolm kihti on ideed 20.3-s täpselt see, mis koodis juba eksisteerib (privaatne kirje / kinnitatud mustand / anonüümne koond) — arhitektuurne sobivus on siin kõigist funktsioonidest parim.
- **Ühendused:** privaatne kirje → kinnitatud mustand → Kovisioon/Supervisioon (O7/9.4); standardiseeritud kategooriad → koond (vabatahtlikkuse lüliti `aggregationEligible` on skeemas olemas, schema:1137).
- **Liigub:** ainult standardiseeritud kategooriad; vabatekstid mitte kunagi (20.5).
- **Ruumiline kogemus:** privaatne „ülevaade" kui töötaja oma sein; koond eraldi haldusvaates (mitte samas ruumis).
- **STAR2 piir:** ei puutu.
- **Eeldusotsused:** sisemised täiendused — ei mingeid → **rühm 1**; KOV kuukoond — KOV-pilootlepe + väline avaldamislävi (20.7 ütleb ise, et 3 ei piisa) → **rühm 3**; ESTA/ministeeriumi valdkondlik koond — partnerluslepe → **rühm 3**.

### 9.6. ESTA liikmeala, foorum, piirkonnaruumid, moderaator — ideed ptk 25–27

- **Probleem:** erialane kogukond ja piirkondlik koostöö puudub platvormilt; ESTA-le partnerluse väärtus.
- **Kasutajatüüp:** SOCIAL_WORKER (valdavalt); ESTA liikmesus = kontrollitav **lisavõimekus** samal kontol (brief ptk 2.1 nõue), piirkonna moderaator = teine võimekus; ESTA keskne haldur = halduskiht, mitte persona.
- **Taaskasutus:** üllatavalt vähe — foorum (püsivad teemad, kommentaarid, küsitlused, kinnitatud teated, modereerimine, raporteerimine) on **uus kogukonnakiht**, mida `Room`/`RoomMessage` ei kata (pole teemapuud, pole avalikkust liikmeskonnale, pole modereerimisvooge); taaskasutatavad on ainult salvestamata häälruumid (calls), kutsete/e-posti taristu ja `UserCapability` muster (liikmesus + piirkond + moderaator).
- **Uus tööobjekt:** liikmesuse kontrollikirje (ideed 26.3 väljad — hoida minimaalsena), foorumi postitus/kommentaar/küsitlus/sündmus, piirkonnaruum, moderaatoritoimingud, konfidentsiaalse liikmeküsimuse pseudonüümsus (27.8 — moderaator näeb autorit: vajab teadlikku disaini).
- **Privaatsuskihid:** liikmeala sisu = jagatud liikmeskonnale; piirkonnaruum = piirkonna liikmetele; privaatsete andmeruumidega (Tööheaolu, Teekond, juhtumid) EI ole mingit ühendust — ideed 25.3 rida „Kasutajate privaatandmed: ESTA ei saa ligipääsu" on jõustatav ainult siis, kui liikmeala elab täiesti eraldi tabelites (nii tulebki ehitada).
- **Ühendused:** foorumipostitusest häälruum; teemakogukonnast Kovisiooni üldteema; ühe euro mudel puudutab ainult arveldust (Subscription-kihti), mitte sisu.
- **Liigub:** ainult kasutaja avaldatud postitused; liikmesuse kontrollist ainult staatus+piirkond (mitte liikmeprofiil).
- **Ruumiline kogemus:** piirkonnaruumid sobivad „ruumide" metafooriga; foorum vajab omaette indeksivaadet — see on esimene funktsioon, mis päriselt vajab ruumiindeksit/kiirmenüüd (ideed 28.6).
- **STAR2 piir:** ei puutu; ametlik hääletus jääb välja (27.10).
- **Eeldusotsused:** kirjalik partnerluslepe, liikmesuse kontrolli API, moderatsioonivastutus, ühe euro arveldusleping (26.7) — **kõik välised**. **Rühm 3** (ehitada ei tohi enne lepet; disainida võib).

### 9.7. Spetsialisti kliendi-/juhtumitöö objektid ja kliendiga jagatud tööala — ideed ptk 10.3, 11.5–11.7

- **Probleem:** kohtumisel puudub ühine kontrollitud vaade („mis info on meil mõlemal laual"); kliendi ja töötaja seos on täna ainult pöördumisekirje.
- **Kasutajatüüp:** SOCIAL_WORKER + CLIENT koos. **Tiitel:** ei.
- **Taaskasutus (verifitseeritud):** kõik kolm ehituskivi töötavad — kliendi kinnitatud eelinfo (`PreInquiry` + `sharedJourneyInfo`), vastuvõtja tööplaan (`receiverChecklist`), ühine ruum (`Room` + origin). „Kohtumise ühisvaade" on nende **komposiitvaade**, mitte uus andmeruum: vasakul kliendi kinnitatud eelinfo (mõlemale nähtav), paremal töötaja privaatne ettevalmistus (ainult töötajale).
- **Uus tööobjekt:** v1-s mitte ühtegi; hilisem „püsiv kliendisuhte kaust" = JTA otsus (9.1), mitte eraldi mudel.
- **Privaatsuskihid:** range reegel ideed 10.3-st on juba koodis tõsi — seos on pöördumispõhine, kumbki pool ei näe teise andmeruumi (runtime-tõendatud IDOR-piirid).
- **Ühendused:** eelpöördumine → ühisvaade → (käsitsi) STAR2 → kohtumise kokkuvõtte artefakt kliendile.
- **Liigub:** ainult juba jagatud eelinfo + kohtumisel koos kinnitatud parandused.
- **Ruumiline kogemus:** kahe paneeli laud („inimese kinnitatud eelinfo" kaart + „minu ettevalmistus" kaart kõrvuti) — esimene loomulik kahe rolli ühine ruumikogemus.
- **STAR2 piir:** kliendi kolme valiku mudel (11.7) hoiab piiri; „ametlik taotlus" suunatakse KOV-i kanalisse (ei ehitata enne partner-KOV lepet, 11.8).
- **Eeldusotsused:** kohtumise ühisvaade — ei vaja ühtegi (kõik objektid olemas) → **rühm 2**; ametliku taotluse rada ja püsiv kliendisuhe → rühm 3.

### 9.8. Eestikeelne häälvestlus

Täielik analüüs ptk 4. Kokkuvõte selle raamistiku lõikes: probleem = käed-vabad/ligipääsetav vestlus; kasutajatüüp = kõik kolm; tiitlit ei vaja; taaskasutus = STT/TTS/SSE/kasutusarvestus (kõik olemas); uus tööobjekt = mitte ühtegi (sessioon on kliendipoolne olek); privaatne (transkript = tavaline vestlus); ühendus = olemasolev vestlus + RAG; liigub = tekst; ruumiline kogemus = olekukiibid + allikakaardid ekraanil; STAR2 ei puutu; eeldusotsus = O10 + võtmetega keskkonna kvaliteedimõõt. **Rühm 2 — järgmise prototüübi esikandidaat** (ainus, mille muudatuskaart on juba failipõhiselt olemas, ptk 4.3).

### 9.9. Kaamera, näpistus ja lokaalsete mudelite katserežiimid — ideed ptk 28.8–28.9, lokaalsed-mudelid.md

- **Probleem:** ruumiliste objektide loomulikum juhtimine; pikas plaanis ligipääsetavus ja kohapealne töötlus ilma välise API-ta.
- **Kasutajatüüp:** kõik; vabatahtlik režiim. **Tiitel:** ei.
- **Taaskasutus:** Teemaseemnete kaardilõuend on määratud katseala (liigutamine/suurus juba klaviatuuri-alternatiividega); helimõõdiku muster `useSpeech`-is; privaatsuse eelkontrolli reeglid (`piiFilter`) OCR-i järelkontrolliks.
- **Uus tööobjekt:** ei ühtegi püsivat — katserežiim on UI-kiht; mudelivarad (MediaPipe wasm, hiljem Silero/Tesseract) on staatilised failid.
- **Privaatsuskihid:** videopilt ei lahku seadmest, ei salvestata, ei kasutata isiku/emotsiooni hindamiseks (ideed 28.8 keelud — need on ka meie varasema kontrolli järgi dokumentides järjekindlad).
- **Ühendused:** näpistus + hääl + objekt (lokaalsed-mudelid ptk 5) — alles pärast häälvestlust ja Teemaseemnete andmestamist.
- **Liigub:** ainult UI-sündmused (žestid), mitte andmed.
- **Ruumiline kogemus:** see ONGI ruumilise kogemuse eksperiment; ei tohi asendada klaviatuuri/hiirt (WCAG-nõue on dokumentides fikseeritud).
- **STAR2 piir:** ei puutu. Tundlikke toiminguid žestiga ei kinnitata (28.8).
- **Eeldusotsused:** mitte ühtegi välist; ainult otsus, et see on eksperiment, mitte MVP. **Rühm 2 (eksperiment, mitte tootejoon)** — v.a äratussõna, speech-to-speech ja pilgujuhtimine, mis on **rühm 4**.

### 9.10. Neli rühma (kokkuvõte)

| Rühm | Funktsioonid |
|---|---|
| **1 — olemasoleva loomulik täiendus** | Tööheaolu sisetäiendused (plaanide ülevaade, järelkontroll, privaatsusmärgistus — 9.5); eelpöördumise seisumudeli rikastamine (ideed 11.4 seisud olemasoleva `PreInquiryStatus`/checklisti peale); STAR2 `transferStatus` artefaktidel (O5 järel); R4 parandus + „Ava Kovisioonis" nupp (O1 järel) |
| **2 — sobib järgmiseks prototüübiks** | Eestikeelne häälvestlus (esikandidaat, kaart ptk 4.3); kohtumise ühisvaade (9.7 — null uut andmemudelit); Teemaseemnete andmestamine (`TopicSeed`, O2); kaamera/näpistuse katserežiim Teemaseemnetes (eksperimendi staatuses) |
| **3 — vajab enne toote- või partnerlusotsust** | JTA õhuke tuum (ideed 17 k 1–4, 8, 11 + O5); Meetodipeegel (JTA järel); võrgustikutöö MVP (nõusolekumudel + ligipääsu lõppemise reeglid); Supervisioon (superviisorite allikas; „ESTA kontrollitud" osa eeldab lepet); KOV kuukoond ja valdkondlik baromeeter (avaldamislävi + pilootlepe); ESTA liikmeala/foorum/piirkonnad/moderaator (kirjalik lepe + liikmesuse kontrolli API); ametliku taotluse rada (partner-KOV) |
| **4 — ei ole praegu põhjendatud** | Automaatne STAR2 API-liidestus (enne SKA/TEHIK kokkulepet — ideed 4.8); meditsiiniandmete integratsioon (5.7 välistab); speech-to-speech reaalajasessioon, äratussõna, pilgujuhtimine (lokaalsed-mudelid ptk 14); emotsiooni/stressi tuvastus (dokumentides keelatud); ühe euro arveldusautomaatika enne ESTA lepet; genogramm/ökokaart enne JTA ja võrgustikubaasi (ideed 14 paigutab etappi 6); täielikult anonüümne foorum (27.8 välistab teadlikult) |

### 9.11. Sõltuvuskaart ja soovitatud järjekord

```text
                      O1/O2 (Kovisiooni sidumine + Teemaseeme)
                        │
        ┌───────────────┼──────────────────────┐
        ▼               ▼                      ▼
  Teemaseemnete     Kovisioon päris        R4-fix + „Ava
  andmestamine      andmetega (A8/B1)      Kovisioonis" nupp
  (TopicSeed)           │                      ▲
        │               ├─► Parimad praktikad  │
        ▼               ├─► Tööheaolu→Kovisioon (O7)
  kaamera/näpistuse     └─► Meetodipeegel→Kovisiooni sisend ◄─┐
  katserežiim                                                 │
                                                              │
  Eelpöördumise vastuvõtt (VALMIS, runtime-tõendatud)         │
        │                                                     │
        ▼                                                     │
  Kohtumise ühisvaade (9.7, rühm 2)                           │
        │                                                     │
        ▼         ideed ptk 17 otsused (k 1–4, 8, 11) + O5    │
  JTA õhuke tuum ◄────────────────────────────────────────────┤
        │                                                     │
        ├─► Meetodipeegel (9.2) ──────────────────────────────┘
        └─► Võrgustikutöö MVP (9.3) ◄── kliendi nõusoleku mudel
                                          + ligipääsu lõpp (k 9–10)

  UserCapability (5.5) ◄── esimene tarbija: praktikate retsensent VÕI superviisor
        └─► Supervisioon (9.4) ◄── superviisorite allikas; [ESTA lepe — väline]

  Tööheaolu sisetäiendused (rühm 1) — sõltumatud, kohe tehtavad
        └─► KOV kuukoond ◄── avaldamislävi + pilootlepe ──► valdkondlik baromeeter ◄── [ESTA lepe]

  Häälvestlus (ptk 4.3) ◄── O10 — sõltumatu kõigest ülalolevast

  ESTA liikmeala/foorum (9.6) ◄── [partnerluslepe + kontrolli-API — väline] — eraldi kogukonnakiht
```

**Soovitatud järjekord tulevikufunktsioonidele** (jätkab ptk 7 järjekordi; iga samm on eraldi kasutatav väärtus):

1. Rühm 1 täiendused (Tööheaolu sisetäiendused, seisumudel, R4) — jooksvalt, väikesed.
2. **Häälvestlus** (rühm 2, sõltumatu, kaart olemas) + **kohtumise ühisvaade** (rühm 2, null skeemitööd) — kaks paralleelset väikest prototüüpi.
3. **Teemaseemnete andmestamine** (O2 järel) → Kovisiooni sidumine (O1 järel) → Parimad praktikad → Tööheaolu→Kovisiooni üleandmine.
4. **JTA õhuke tuum** (ideed 17 otsuste järel) → Meetodipeegel.
5. **Võrgustikutöö piiratud MVP** (nõusolekumudeli järel).
6. **Supervisiooni piloot** „kutsutud superviisoriga" (UserCapability järel); ESTA-kontrolli kiht alles leppega.
7. **KOV kuukoond** (piloot-KOV + avaldamislävi) → valdkondlik baromeeter (ESTA leppega).
8. **ESTA liikmeala** — ainult pärast kirjalikku lepet; kuni selleni püsib kontseptsioonina.
9. Kaamera/näpistuse eksperiment — paralleelselt, selgelt „katserežiim" märgisega, mitte tootejoonena.

See järjekord hoiab briefi põhimõtet: ükski samm ei tee teist kohustuslikuks, iga funktsioon annab väärtust eraldi ning ühendused on kasutaja kinnitusega. Ptk 10 järeldused ja prioriteedid jäävad selle peatükiga kooskõlla (rühm 1–2 = ptk 7 järjekordade loomulik jätk).

---

## 10. Lõppkokkuvõte

### 10.1. Järeldused, mille tõendus muutus tugevamaks

1. **Pöörduja rada Teekonnast ühise ruumini töötab** — nüüd täies ahelas runtime-tõendatud (2.3), lisaks brauserivaated (2.4).
2. **Abisobitus loob päriselt ruumi** koos korrektsete origin-väljadega — runtime-tõendatud (2.3 viimane rida).
3. **Kovisiooni katkestus** (töökorras andmekiht + demo-UI) — nüüd tõendatud kolmelt suunalt: API töötab, UI ei kutsu, brauser näitab demot ka siis, kui DB-s on päris juhtum.
4. **Omaniku-/osalejapiirded peavad** — IDOR-sondid 404, sh admini mitte-möödapääs Kovisioonis; Tööheaolu mustandid ei leki.
5. **Üleandmised liigutavad ainult valitud/kinnitatud väljavõtteid** — runtime + kood (6.4 p4); `sourceJourneyId` kadu on aktiivselt tõendatud (R6).
6. **Andmebaasikiht on migratsioonipõhine ja sünkroonis** (5.1) — skeemimuudatuste soovitusi saab usaldada.

### 10.2. Kohad, mille sõnastust tuleb ülevaates täpsustada

1. Rida 8 tabelis 4.2: „server valmis, UI puudub" → **„marsruut olemas, kuid defektne (alati 400)"** — R4.
2. „`/kovisioon` renderdab 8-etapilise lõuendi" → **„etapid 1–4 on ehitatud, 5–8 on platseholderid"** (3.1).
3. Häälvestluse „1 uus hook" → **muudatuskaart 4.3** (1 uus hook + 4–5 faili muudatust; „serverimuudatusi pole vaja" jääb kehtima).
4. STT/TTS „töötab" → **„kood ja kasutusarvestus olemas; praktiline kvaliteedikontroll võtmetega keskkonnas tegemata"** (R10).
5. Testiviited → **„lib-taseme loogikatestid; marsruudi/DB-kihi teste ei ole; `test:e2e` skript on surnud viide"** (R14).
6. Kovisiooni andmekiht „täielik" → **„töökorras (CRUD, sõnumid, kokkuvõte runtime-tõendatud); kõned kontrollimata; üks sisenemistee defektne"** (R3/R4).
7. Kandidaat 1 „~85%" → asendada puuduolevate tükkide loendiga (A1 + UI-kinnitusvoog + e2e-test).

### 10.3. Teemad, mis vajavad veel praktilist kontrolli (lahtised)

1. AI-vastus, RAG-otsing ja allikakaardid päris võtmetega (sh vestluse „journey" töövoo AI-osa).
2. STT/TTS kvaliteet ja kulu eesti keeles; häälvestluse kaja-käitumine päris kõlaritega.
3. E-kirjade saatmine (eelpöördumise EXTERNAL_EMAIL, kutsed) SMTP-ga keskkonnas.
4. Kõned (LiveKit) ja salvestuse nõusolekuahel; heli→transkript→artefakt töövoog.
5. Tellimusepiirded mitte-admin sessiooniga (vajab aktiivse tellimusega testkontot).
6. Piksli-tasemel paigutus 1920×1080 ja 1536×864 (ekraanipiltide tõrge selles keskkonnas; tekst/struktuur/konsool kontrollitud).
7. `EffectivePractice` → RAG päris sünk (võtmeta keskkonnas läheb `skipped` harusse).

### 10.4. Soovitatud prioriteedid

Ülevaate P0–P2 **jääb põhijoontes kehtima**, kolme muudatusega: (1) R4 parandus lisada P0-sse (A4); (2) O1 otsus on veelgi kriitilisem, sest etappide 5–8 spetsifikatsioonid on valmis ja demo peale ehitamine kallineb iga iteratsiooniga; (3) Teemaseemnete andmestamine (variant B) tõuseb P1 algusesse, sest see on väike, tagasipööratav ja ei sõltu suurest sidumisotsusest. Kaks teostusjärjekorda koos sõltuvustega: ptk 7.1–7.2.

### 10.5. Viis kõige olulisemat tooteomaniku otsust

1. **O1** — Kovisiooni sidumise suund (blokeerib A8/B1, B2, B3, uued lehed).
2. **O2** — Teemaseemne objektimudel (blokeerib A6; määrab privaatsuskihi koha).
3. **O3** — teenuseosutaja roll Kovisioonis (määrab lõuendi sihtrühma ja õigusmudeli).
4. **O10** — häälvestluse ulatus ja kvaliteedilävi (enne A7 arendust).
5. **O12** — tasuta tuuma piiri kinnitamine (äri- ja hinnastusselgus; arendust ei blokeeri).

### 10.6. Kontrolli jälg ja koristus

Loodud ja **kustutatud** sünteetilised kirjed (kustutuslogi täpsete arvudega): HelpMatch 1, Room 2 (cascade: liikmed, sõnumid), HelpRequest 1, HelpOffer 1, CovisionCase 1 (cascade: sõnum, kokkuvõte, osalejad), PreInquiry 1, Journey 1, WellbeingOutputDraft 1, LoginTempToken 3; `codex.spatial.test` `acceptsPreInquiries` taastatud `false`; brauserisessioon logiti välja. Püsima jäi ainult `HelpCategory` referentskülv (10 kanoonilist kirjet repo enda seederist — lokaalne keskkond eeldab neid nagunii). Rakenduse koodi ei muudetud; dev-server jäi tööle (`preview_start`, port 3000).

Märkus: selle töö vahepealne visandifail `docs/fable-5-platvormiloogika-max-jarelkontroll.md` asendati viitega käesolevale dokumendile (ülesande sihtfail muutus töö käigus).
