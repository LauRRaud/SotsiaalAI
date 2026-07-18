# EXPORT-A0 — andmete eksport, teisaldatavus ja koostalitlus

Kuupäev: 2026-07-17
Koostaja: Fable 5 (Claude Code)
Iseloom: **read-only tervikaudit.** Rakenduskoodi, Prisma skeemi, migratsioone ega teste ei muudetud; commit'e, push'e, merge'e ega deploy'd ei tehtud.
Kese: mida kasutaja või volitatud spetsialist saab andmetest **kaasa võtta, edasi anda, tõendada ja teises süsteemis kasutada**. Failihoidlate, parserite, pahavarakontrolli ja meedia elutsükli tervikaudit on FAILID-A0-s (`fable-5-failide-ja-meedia-elutsukkel.md`) ja seda siin ei korrata — kasutan selle tulemusi sisendina.

## 0. Edenemistabel

| # | Etapp | Seis |
|---|---|---|
| 1 | Git-seis: lokaalne, origin/main, ajalugu | TEHTUD |
| 2 | Tootmisserveri release'i kontroll (SSH) | TEHTUD |
| 3 | Olemasolevate analüüsidokumentide sidumine | TEHTUD |
| 4 | Ekspordimaastiku kaart (kõik rajad koodis) | TEHTUD |
| 5 | 12 pinna maatriksid | TEHTUD |
| 6 | Riskikontroll (IDOR, CSV, failinimed, eksitavad rajad jm) | TEHTUD |
| 7 | Formaadi- ja koostalitlusmaatriks | TEHTUD |
| 8 | Kustutamise–retention'i–ekspordi järjestus | TEHTUD |
| 9 | P0–P3 leiud, säilitamist väärt lahendused, paketistus | TEHTUD |
| 10 | Otsuste eristus (tooteomanik/jurist/tehniline) + esimene pakett | TEHTUD |
| 11 | Runtime-kontrollid sünteetiliste kasutajatega | NOT_RUN (piirid ptk 2) |

## 1. Kontrolliseis: git, server, dokumendid

**Lokaalne seis (17.07.2026):** `main` @ `0da4185b` („AI update 2026-07-16"). Töökoopia määrdunud failid on CSS/registreerimisvoo ja dokumentatsiooni omad — ükski ei puuduta ekspordipinda.

**origin/main:** `fe4eb4fa` („merge: integrate Admin P0.1 safety gates and independent audit"). Lokaalne main on **1 ees / 22 taga**. 22 puuduvat commit'i = Help P0 privaatsusparandused, Admin P0.1 väravad, DOK-XTEN P0 ja RAG-P8.0 inventuur (kõik varasemate auditite tulemid).

**Tootmisserver:** `ssh sotsiaalai`, `/home/ubuntu/apps/sotsiaalai` @ `fe4eb4fa`; `sotsiaalai-frontend.service` ja `sotsiaalai-rag.service` mõlemad `active`. **Server = origin/main.**

**Main vs server kehtivus:** `git diff --name-only main..origin/main` ei sisalda ühtegi selle auditi tuumafaili (`app/api/chat/export/`, `app/api/documents/**/download/`, `app/api/materials/[id]/download/`, `app/api/wellbeing/**/aggregate/`, `app/api/profile/`, `app/api/pre-inquiries/`, `lib/chat/exportDocument.js`, `lib/documents/pdfExport.js|docxExport.js|server.js`, `lib/privacy/userDeletion.js`, `lib/wellbeing/aggregateExport.js|pilotReportExport.js`). Diff puudutab ekspordi naabrusest ainult `app/api/help/listings/**` ja `lib/help/**` (Help P0 avalik projektsioon — ainult origin'is/serveris). Järeldus: **kõik siinsed ekspordituuma leiud kehtivad ühtviisi lokaalse main'i, origin/main'i JA serveri kohta**; Help-pindade kohta kehtib origin/serveri (rangem) seis.

**Sisenddokumendid (ei korrata, viidatakse):**
- FAILID-A0 (`fable-5-failide-ja-meedia-elutsukkel.md`) — K7 (omanikupiir igal download-rajal), K8 (404/403 oraakel, leid F-14), K9 (download-päised turvalised, runtime-testitud), K5 (DOCX-malli eksport kirjutab muud ZIP-kirjed muutmata tagasi).
- O-TK9 (`fable-5-teekond-o-tk9-sent-retention-otsus.md`) — SENT-eelpöördumise hävimine autori kustutusel; otsus tooteomanikul lahtine.
- A3 (`03-a3-preinquiry-downloaded-progress.md`) — eelpöördumise DOWNLOADED-elutsükkel, CAS-versiooniturvalisus.
- K1-U1 (`fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md`) — ptk 7.11: `account.data_export_ready [TULEVIK]` on juba planeeritud U1 sündmusklass.
- Help P0 auditid (ainult origin/main: `fable-5-help-listings-privacy-p0-progress.md` + Sol auditid) — kuulutuste avalik projektsioon.
- Tööheaolu, Teekond/eelpöördumine, ruumi audit (`docs/ruum-audit.md`), maksed, admini analüütika — vastavad A0-dokumendid.

## 2. Metoodika ja piirid

- Staatiline koodianalüüs main'i töökoopias + git-diff kehtivuskontroll origin/main'i suhtes + serveri release'i kinnitus SSH kaudu.
- **Runtime-kontrollid: NOT_RUN.** Põhjendus: (a) FAILID-A0 on download-päised, omanikupiirid ja kustutuse retry juba runtime-tõendanud (13/13 sihttesti); (b) O-TK9/A3 on eelpöördumise kustutus- ja allalaadimiselutsükli sünteetiliste kasutajatega läbi käinud; (c) siinse auditi ainuomased runtime-küsimused (nt PDF-i märgimoondus, CSV sisu) on kooditasandil üheselt tuletatavad. Ausalt lahtised runtime-piirid on loetletud ptk 16 Sol/Codexi ülesandes.
- **NOT_READ — SAFEGUARD: ei rakendunud.** Ükski loetud fail ega käsk safeguard'i ei käivitanud.
- Päris kasutajate sisu ei loetud; serverist loeti ainult git-commit ja teenuste staatus.

## 3. Praeguse ekspordimaastiku kaart

Kõik leitud rajad, millega andmed platvormilt **failina või masinloetavalt välja** liiguvad:

| Rada | Mis väljub | Formaat | Kes käivitab | Kus |
|---|---|---|---|---|
| `GET /api/chat/export?convId&messageId&format` | üks ASSISTANT-sõnum (töövoo väljund) | PDF või `.doc` (HTML) | omanik | main+server |
| `GET /api/documents/[id]/download` | kasutaja üleslaaditud originaalfail | originaal-MIME | omanik | main+server |
| `GET /api/documents/artifacts/[id]/download?format` | kinnitatud artefakt (juhtumikokkuvõte, tegevuskava, koosoleku kokkuvõte jne) | DOCX (päris) või PDF | omanik | main+server |
| `GET /api/materials/[id]/download` | kasutaja esitatud RAG-materjal | originaal-MIME | **ainult admin** | main+server |
| Eelpöördumise „Laadi alla" / „Laadi eelinfo alla" | kanooniline pöördumistekst | `.txt` (kliendipoolne Blob) | autor / adressaat | main+server |
| `POST /api/pre-inquiries/[id]/downloaded` | (marker, mitte fail) — DOWNLOADED-staatus CAS-iga | JSON | autor | main+server |
| `GET /api/wellbeing/pilot/aggregate?format=` | k-anonüümsed koondmõõdikud | JSON / CSV / HTML-raport / XLSX | piloodi volitatud vaataja | main+server |
| `GET /api/admin/wellbeing/aggregate?format=` | koondmõõdikud | JSON / CSV | admin | main+server |
| `GET /api/admin/rag/kov|organizations/.../download` | KOV/organisatsiooni RAG-failid | originaal-MIME | vastav admin | main+server |
| `public/legal/*` staatilised failid | raamleping (.asice DigiDoc, .docx et/en/ru), hinnastus (.xlsx), kontseptsioon (.txt), hindamine (.pdf) | staatiline | igaüks (autentimata) | main+server |
| Raamlepingu kinnituse kirje | süsteemi loodud kinnitusdokument Dokumentides | dokumendina allalaaditav | spetsialist ise | main+server |
| Koosoleku kokkuvõtte room-share | FINAL `MEETING_SUMMARY` artefakti sisu ruumisõnumina | ruumisõnum (mitte fail) | omanik-spetsialist | main+server |
| JSON API-d (vestlused, teekond, jagamised, teavitused, profiil, abi) | ekraanivaated | JSON (mitte eksport-toode) | omanik | main+server |

**Mida EI OLE ühelgi kujul:** konto tervikandmekoopia; terve vestluse eksport; Teekonna enda allalaadimine; Tööheaolu individuaalsete kirjete väljavõte; kovisiooni/praktikate väljund; ruumisõnumite/salvestiste väljund; teavituste/auditijälje koopia; admini analüütika CSV; arvete/kviitungite väljavõte.

## 4. Pindade analüüs

Maatriksiveerud igal pinnal: olemasolu → kelle andmed → käivitaja → serveripoolne kontroll → formaat → loetavus (inim/masin) → metaandmed/päritolu → täielikkus → jagatud vs privaatne eristus → teisaldatavus → auditijälg → main/server/haru seis.

### 4.1. Konto omaniku koopia kõigist enda andmetest

| Veerg | Seis |
|---|---|
| Olemas? | **EI.** Ei endpointi, UI-d ega dokumenteeritud käsiprotsessi. |
| Lubadus | Privaatsuspoliitika §8 (`messages/et.json`, `privacy.section8.items`) lubab: „Õigus küsida ligipääsu enda andmetele ja saada neist koopia" JA „Õigus saada andmed ülekantavas vormis" (GDPR art 15 ja 20). |
| Tulevik | K1-U1 doc ptk 7.11 planeerib U1 sündmuse `account.data_export_ready [TULEVIK]` — teavituskiht on ette nähtud, ekspordimootorit ei ole kavandatud üheski dokumendis. |
| main/server/haru | Puudub kõikjal. |

See on auditi keskne leid **E-1 (P1)**: õiguslik lubadus on avaldatud, toode ei paku rada ja sisemist protsessi pole kirjeldatud. GDPR lubab täita taotluse käsitsi 30 päevaga, aga ka käsiprotsess (kes, millest, mis vormingus koostab) on defineerimata — ning konto kustutamine on kohene ja pöördumatu (ptk 4.11), st kasutaja saab endalt võtta võimaluse koopiat üldse saada.

### 4.2. Vestluste eksport

| Veerg | Seis |
|---|---|
| Olemas | `GET /api/chat/export` ([route.js](../../app/api/chat/export/route.js)) — **ainult üks ASSISTANT-sõnum** (`convId`+`messageId`), formaadid `pdf`/`word`. Lingid genereerib server ise töövoo-vastuste juurde (`lib/chat/responseFinalizer.js:91`). Terve vestluse eksporti ei ole; vestluse ajalugu on loetav ainult JSON-API-st (`/api/chat/conversations/[id]/messages`). |
| Kelle andmed | AI-vastus kasutaja enda vestluses (võib sisaldada kasutaja sisendist tuletatut). |
| Käivitaja | omanik (sessioon). |
| Serverikontroll | `conversation.userId !== auth.userId → 403`; arhiveeritud vestlus → 404; ainult `role: "ASSISTANT"`; rate-limit (30/min). |
| Formaat | PDF (oma minimalistlik generaator) või `.doc` = **HTML-mähis** `application/msword` sisuga (`lib/chat/exportDocument.js:198–216`), mitte päris DOCX. |
| Loetavus | inimloetav; masinloetavus puudub (PDF/HTML). |
| Metaandmed | **Ei säili midagi**: ei vestluse ID-d, kuupäeva, mudelit ega allikaid — ainult pealkiri + tekst. |
| Täielikkus | osaline (üks sõnum; kasutaja enda küsimused ei ekspordi kunagi). |
| Teisaldatavus | nõrk (PDF-i märgipiirang, vt E-2; .doc avaneb Wordis hoiatusega). |
| Auditijälg | **PUUDUB** — erinevalt dokumentidest (document.downloaded) ei logi chat-eksport midagi. |
| main/server | identne (diff tühi). |

**E-2 (P1): PDF-generaator on Latin-1-piiranguga.** `lib/chat/exportDocument.js:25` laseb läbi ainult koodid 32–255; kõik muu asendub `?`-ga. Tagajärjed: eesti š/ž (šokk, žest, garaaž…) moonduvad; **kogu kirillitsa muutub `??????`-ks** — RU-lokaadi kasutaja PDF on kasutuskõlbmatu. Ja kuna `lib/documents/pdfExport.js:1` **taaskasutab sama funktsiooni**, kehtib sama viga KÕIGILE artefakti-PDF-idele (juhtumikokkuvõtted, tegevuskavad, koosolekute kokkuvõtted). `.doc`/DOCX-rajad on UTF-8 ja korras. See on „eksitav eksport": UI pakub PDF-i, mille sisu moondub vaikimisi ja hoiatuseta.

### 4.3. Dokumendid, artefaktid ja genereeritud PDF/DOCX

| Veerg | Üleslaaditud dokument | Genereeritud artefakt |
|---|---|---|
| Olemas | `GET /api/documents/[id]/download` | `GET /api/documents/artifacts/[id]/download?format=docx|pdf` |
| Kelle andmed | omaniku fail | omaniku artefakt (võib tugineda allikdokumentidele) |
| Käivitaja | omanik | omanik |
| Serverikontroll | `assertOwnedByUser`; rate-limit; NB 404/403 oraakel (FAILID F-14) | `assertOwnedByUser` + **värav `status===FINAL && approvedAt`, muidu 409** |
| Formaat | originaal-MIME | päris DOCX (oma XML-ehitus, malli korral asendatakse ainult `word/document.xml` — FAILID K5) või PDF (Latin-1 piiranguga, E-2) |
| Metaandmed/päritolu | originaalfail muutmata (hea) | **osaline provenance failis sees**: tüüp, kinnituskuupäev, allikdokumentide loend (`pdfExport.js:41–56`, `docxExport.js:86–115`); artefakti ID-d/versiooni failis EI ole |
| Täielikkus | täielik | sisu täielik; versiooniajalugu (refine-sammud) ei ekspordi |
| Jagatud vs privaatne | ainult enda omad | room-share on eraldi tegevus (4.7) |
| Auditijälg | `document.downloaded` | `artifact.downloaded` (kasutaja, formaat, allikate arv) |
| main/server | identne | identne |

See on platvormi **kõige küpsem ekspordipind** — värav, auditijälg, provenance ja ühtsed download-päised (`buildDownloadHeaders`: no-store, nosniff, ASCII-fallback + RFC5987 UTF-8 nimi; runtime-testitud FAILID K9, `tests/documents/downloadHeaders.test.js`).

### 4.4. Teekond ja eelpöördumised

| Veerg | Seis |
|---|---|
| Teekond ise | **Eksporti EI OLE.** `GET /api/journeys/[id]` on omaniku-JSON ekraanile; Teekonna vastuseid saab kaasa ainult kaudselt — eelpöördumise teksti sees. |
| Eelpöördumise allalaadimine | Kliendipoolne kanooniline `.txt` (`WorkspaceFeaturePage.jsx:486–493`): autor laadib mustandi/salvestatu, adressaat laadib eelinfo („Laadi eelinfo alla"). Sama kanoonilise teksti ehitaja mõlemal — allalaaditu ja salvestatu ei saa lahkneda (A3). |
| Versiooniturvalisus | Autor markeerib salvestatud kirje DOWNLOADED-iks `expectedUpdatedAt` CAS-iga; vananenud hetktõmmis → üldsõnaline 409 (`downloaded/route.js:41–55`). **Parim versioonileping kogu platvormil.** |
| Serverikontroll | omanik + lubatud üleminekud; võõra kirje olemasolu ei leki (404 vs 403 ühtlustatud). |
| Metaandmed failis | `.txt` failinimi on ainult `slug.txt` (teema), **ilma kuupäeva, ID ja versioonita**; faili sisust ei saa hiljem tõendada, millise versiooniga oli tegu — tõendusväärtus elab ainult serveri DOWNLOADED-margis. |
| Jagatud vs privaatne | jagatud väljavõte (`sharedJourneyInfo`) on külmutatud saatmishetkel; teadaolev kitsendus: `shareKeys` austab täna ainult `assistiveDevices`'t (Teekonna A0 leid — ei korda). |
| Üleantavus | `.txt` on inimloetav ja e-postiga edasiantav; masinloetavust ega skeemi pole. |
| Kustutusrisk | O-TK9: autori konto kustutus hävitab ka SENT-kirjad koos adressaadi töömärkmetega; adressaadi ainus kaitse on **ennetav** eelinfo allalaadimine. Otsus lahtine (variant B soovitatud). |
| main/server | identne. |

### 4.5. Tööheaolu: individuaalne ja koond

| Veerg | Individuaalne | Privaatselt summeeritud koond |
|---|---|---|
| Olemas | **EI** — kiirkontrollid, taastumine, piirid jm elavad ainult ekraanivaadetes (JSON API-d) | JAH: `GET /api/wellbeing/pilot/aggregate` (JSON/CSV/HTML-raport/XLSX) + `GET /api/admin/wellbeing/aggregate` (JSON/CSV) |
| Kelle andmed | kasutaja enda | rollirühma koond, `WELLBEING_MIN_GROUP_SIZE` (vaikimisi 3) alune rühm peidetakse; `exportEligible` lipp real |
| Käivitaja | — | piloodi volitatud vaataja (`resolveWellbeingPilotAccess` + filtripiirang) / admin |
| Serverikontroll | — | pilot-scope + lubatud rollirühmad; admin `assertAdmin` |
| Formaat/loetavus | — | CSV+JSON masinloetavad; HTML/XLSX inimloetavad raportid; HTML on korrektselt escape'itud (`pilotReportExport.js:104–113`) |
| Metaandmed | — | filtrid ja privaatsusteade raportis sees; perioodid kaasas |
| Eristus | — | kooskõlas ideed.md §21 põhimõttega: KOV-juht EI SAA kasutajataseme andmeid eksportida |
| main/server | — | identne |

**E-6 (P2):** töötaja enda Tööheaolu kirjetel pole mingit väljavõtterada — see on tundlik isiklik ajalugu, mille „kaasavõtmine" töökohavahetusel on põhjendatud kasutajaootus, ja see peab olema osa tulevasest andmekoopiast (E-1 lahendus katab).

### 4.6. Kovisioon, praktikad ja kohtumise väljundid

- **Eksporti ei ole üheski vormis.** Kovisiooni juhtumid, etapid, otsused, lõpetatud juhtumite arhiiv ja praktika-retsensioonid elavad JSON-API-des ekraani jaoks (`/api/covision/**`, `/api/effective-practices/**`).
- Ainus väljundikanal on kaudne: kovisiooni tulemusest võib saada dokumendiartefakt (nt `case_brief`, `transcript_summary`), mis liigub 4.3 rada pidi.
- Ideed.md Etapp 5 näeb ette „töötaja kinnitatud ekspordi" (deidentifitseeritud mustand → supervisioon) — **ainult visioon, koodis pole midagi**.
- Praktikate puhul on konto kustutusel scrub/delete-loogika (`effectivePracticeAccountCleanup`), st jagatud praktika võib jääda anonüümituna alles — aga autor ei saa oma panusest koopiat.
- main/server: identne (kovisiooni failid diff'is ei muutu).

### 4.7. Ruumid, kohtumised, salvestised ja kokkuvõtted

| Veerg | Seis |
|---|---|
| Ruumisõnumid | JSON API ekraanile; **eksporti/allalaadimist ei ole**. |
| Kõnesalvestised | Nõusoleku-elutsükkel on olemas (request/consent/start/stop/withdraw rajad), kuid **ühtegi playback- ega download-rada pole** (`app/api/rooms/**` all puudub); salvestusfunktsioon ise on `RECORDING_ENABLED` värava taga (ruumi auditi ptk 12/20: väravad korda ENNE sisselülitamist). Väljund on teadlikult ehitamata — see on õige järjekord. |
| Koosoleku kokkuvõte | Genereeritakse artefaktiks (`transcript_summary` / `MEETING_SUMMARY`) → eksport 4.3 rada pidi (DOCX/PDF). |
| Room-share | `MeetingSummaryRoomShare.jsx` postitab FINAL kokkuvõtte **sisu ruumisõnumina** (`/api/rooms/[roomId]/messages`); FAILID K7: nõuab omanikku + spetsialisti/admini rolli + FINAL `MEETING_SUMMARY`. NB see on jagamine, mitte eksport — ruumiliikmed ei saa faili, vaid sõnumiteksti, ja sellel pole tagasivõtmise/versiooni sidet artefaktiga. |
| main/server | identne. |

### 4.8. Teenusekaart, abisoovid ja abipakkumised

- Kasutajale kuuluvad andmed (teenuseprofiil, kuulutused, sobitused) on **ainult JSON-API-des** (`/api/service-provider/profile`, `/api/help/listings/**`, `/api/help/matches`); faili-eksporti pole.
- Omandikontrollid: Help P0 (origin/main + server) viis kuulutused avalikule projektsioonile — võõrale näidatav väli on serveris valitud, mitte kliendis filtreeritud. V1/V2 lekked parandatud (mälu: Help P0 3479a447+56b70fe2+fb451593, serveris 16.07).
- Lahtised V3–V6 (liit-ID, kaart võtab suvalise kuulutuse jm) on Teenusekaardi A0-s — ei korda.
- Ekspordi vaates: kui kasutaja tahab oma kuulutused/soovid kaasa võtta (nt teise omavalitsuse süsteemi), pole tal midagi peale ekraanilt kopeerimise. Kuulub E-1 andmekoopia katvusse.

### 4.9. Profiil, nõusolekud, jagamised, auditijäljed, teavitused

| Andmehulk | Vaade olemas? | Koopia/eksport? |
|---|---|---|
| Profiil + usaldatud seadmed | `GET /api/profile` (JSON) | ei |
| Nõusolekud (raamleping) | kinnituse kirje süsteemidokumendina Dokumentides | **JAH — allalaaditav** (ainus „nõusoleku-tõend", mis failina väljub; hea muster) |
| Jagamised (U12 „Minu jagamised") | `GET /api/my-sharings` (JSON koondvaade) | ei |
| Auditijälg (`DataAuditLog`) | kasutajal **vaadet ei ole üldse**; adminil deletion-jobs vaade | ei |
| Teavitused (`NotificationEvent`) | `GET /api/notifications` (limit ≤ 100) | ei; ajalugu praktikas kärbitud |
| Tellimus/maksed | `GET /api/subscription` (JSON) | arve/kviitungi väljavõtet rakenduses ei ole (Maksekeskuse kanal; MAKSED-A0 skoop) |

`DataAuditLog` säilitab `actorUserId`/`targetUserId` stringidena ilma FK-ta (schema:1416–1431) — auditijälg elab konto kustutuse üle (õige valik vastutuse mõttes), aga kasutajal pole kunagi olnud võimalust näha, mida tema kohta on logitud. GDPR art 15 mõttes kuulub ka see „ligipääsu" alla — jurist peab piiritlema (ptk 14).

### 4.10. Administraatori raportid ja ekspordid

| Rada | Formaat | Kontroll | Auditijälg |
|---|---|---|---|
| `/api/admin/wellbeing/aggregate?format=csv` | CSV/JSON | `assertAdmin` | ei logi eksporti |
| `/api/admin/rag/kov|organizations/.../download` | originaalfail | vastav adminisessioon | FAILID K7 järgi kaetud |
| `/api/materials/[id]/download` | originaalfail | `assertAdmin` | `FILE_DOWNLOAD_ADMIN` DataAudit — **parim admin-jälg** |
| `/api/admin/analytics/*`, `/api/admin/usage/*` | ainult JSON ekraanile | `assertAdmin` (+ Admin P0.1 väravad origin'is) | dashboard näitab allalaadimiste loendureid, aga analüütika enda CSV-d pole |
| `/api/admin/usage/deletion-jobs` | JSON | admin | kustutustööde järelevalve — hea |

Tähelepanek: admini CSV-eksport (wellbeing) **ei jäta auditijälge**, samas admini failiallalaadimine (materials) jätab. Ühtlustada (EXPORT-P2).

### 4.11. Konto kustutamine, retention ja eksport — järjestus

Tänane järjestus (`app/api/profile/route.js:377–447` + `lib/privacy/userDeletion.js`):

1. `DELETE /api/profile` nõuab kehtivat PIN-i (kui on) — **muud kinnitusakent/ooteaega ei ole**.
2. Transaktsioonis: `dataDeletionJob(USER_DELETE, PENDING)` + `accessSuspendedAt` + `sessionVersion++` + kõigi sessioonide kustutus. Kasutaja on lukus **kohe**.
3. Sünkroonselt: RAG-viidete kustutus, failide kustutus (dokumendid, materjalid), ChatLog'ide kustutus, praktikate scrub, lõpuks kasutajarea kustutus → skeemikaskaadid (vestlused `onDelete: Cascade` schema:1205, eelpöördumised O-TK9 järgi, jne).
4. Ebaõnnestumisel: job FAILED + retry-rada (`retryUserPrivacyDeletion`), admini deletion-jobs vaade; fail-closed (FAILID runtime-tõendatud).
5. Audit igal sammul (`USER_DELETE_SELF/ADMIN/PENDING/DONE`), kiri „konto kustutatud" e-postiga.

**Puudub täielikult:** (a) „laadi enne koopia alla" samm või isegi viide; (b) ooteaeg/taganemisaken (grace period); (c) ekspordi-enne-kustutust järjekorraline seos — sest eksporti ennast pole (E-1). Terms §12 hoiatab üldsõnaliselt ligipääsu kaotusest. Kombinatsioon „lubatud koopia puudub + kustutus on kohene ja pöördumatu + SENT-kirjad hävivad ka adressaadil (O-TK9)" on selle auditi teravaim tootejärjestuse viga: **E-5 (P2)**.

Retention-küljed: `Conversation.expiresAt` (schema:1198) võimaldab vestluste aegumist; eelpöördumise SENT-retention on O-TK9 otsustusleht; auditilogid ja kustutusjäljed säilivad kustutuse järel (õige). Ekspordi ja retention'i vahel pole ühtegi lepingut („andmed, mis aeguvad X päevaga, peavad olema koopias kättesaadavad enne Y") — see kuulub tulevase kanoonilise ekspordi lepingusse (ptk 11).

### 4.12. K1 tööruumide ja U1 sündmuste ekspordileping (tulevik)

Praegu koodis pole kumbagi (K1-U1-A0: variant A leping + adapterid; U1 = DomainEvent outbox). Ekspordi vaatest annavad need kaks täpselt puuduoleva selgroo:

- **K1 tööruumi descriptor** = ühtne vastus küsimusele „millised tööpinnad ja artefaktid kasutajal on" — kanoonilise andmekoopia **sisukord**. Kui iga K1-leppega pind deklareerib `exportables` (mis üksused, mis formaadis, mis omanikupiiriga), saab andmekoopia koostada adapterite kaudu ilma supertabelita — sama põhimõte, mille K1-U1-A0 valis (leping, EI supertabelit).
- **U1 sündmused** = ekspordi elutsükli teavitus ja auditijälg: `account.data_export_requested` → `account.data_export_ready [TULEVIK — juba planeeritud ptk 7.11]` → `account.data_export_downloaded`, dedupe jobId kaudu, TRANSACTIONAL e-post (ainus kohustusliku e-posti perekond — sinna andmekoopia teade sobib).
- Järjestusleping: kustutustaotlus peab kontrollima lahtist eksporditööd (ja vastupidi) — U1 outbox annab selleks loomuliku oleku.

## 5. Riskikontroll

| Risk (lähteülesandest) | Seis | Tõend |
|---|---|---|
| Teise kasutaja andmete eksport (IDOR) | **Kaetud** kõigil leitud radadel: chat-eksport 403, dokumendid/artefaktid `assertOwnedByUser`, materjalid admin-only, agregaadid scope'itud. FAILID K7/K8 runtime-kinnitus. Jääkriks: dokumentide 404/403 olemasolu-oraakel (F-14, teada). | ptk 4.2–4.10 |
| Adressaadi/partneri andmete liigne kaasamine | Eelpöördumise eelinfo on külmutatud jagamis-snapshot; teada kitsendus shareKeys≈assistiveDevices (Teekonna A0). Room-share paneb kokkuvõtte sisu kõigile ruumiliikmetele nähtavaks — omanik otsustab, väravaks FINAL-staatus. | 4.4, 4.7 |
| Kustutatud/tagasivõetud jagamise sisu ekspordis | Recall enne avamist on CAS-idega (A3/U12 testid); adressaadi „Laadi eelinfo" PÄRAST recall'i on runtime-kontrollimata → Sol nimekirjas. | 4.4, ptk 16 |
| CSV valemisüst | `csvCell` (aggregateExport.js:11–15) tsiteerib, aga EI neutraliseeri `= + - @` prefiksit. Tänane sisu = süsteemsed mõõdikuvõtmed+numbrid → praktiline risk madal, aga leping puudub ja iga tulevane vabatekstiväli aktiveerib riski. XLSX-raport ehitab lahtrid inlineStr-tekstina (ohutu); HTML-raport on escape'itud. | E-8 (P3) |
| Vabateksti/süsteemi-ID-de/metadata liigne avaldamine | Chat-PDF/doc ei sisalda ID-sid (pigem liiga vähe metaandmeid kui liiga palju); artefaktifailides tüüp+kuupäev+allikapealkirjad — mõistlik; JSON API-d tagastavad süsteemi-ID-sid ekraani tarbeks (normaalne, mitte eksport). | 4.2–4.3 |
| Ebaturvalised failinimed ja vahemälupäised | **Korras kontrollitud radadel**: jagatud `buildDownloadHeaders` (no-store, nosniff, attachment, ASCII+RFC5987), chat-ekspordi `sanitizeFileBase` whitelist. FAILID K9 runtime-tõend. Staatilised `public/legal/*` on autentimata ja cache'itavad — sisu on avalikud lepingud, aktsepteeritav, aga kinnitada teadlikult (ptk 14). | 4.3, 3 |
| Eksport lubab rohkem kui annab | **E-1**: privaatsuspoliitika lubab koopiat ja ülekantavust, toode ei paku. Kõige suurem lubaduse-teostuse lõhe. | 4.1 |
| UI näitab, server ei suuda koostada | Artefaktid: UI-värav + serveri 409 enne FINAL/approve'i — hea. **PDF on vastupidine juht: server „suudab", aga väljund moondub** (E-2) — funktsionaalselt sama viga kasutaja silmis. | 4.2 |
| Kustutamine enne andmekoopiat | **E-5**: kohene pöördumatu kustutus, koopiavõimalust pole; O-TK9 võimendab (adressaadi kaotus). | 4.11 |
| Väljund pole hiljem tõendatav (päritolu/versioon) | Parim: A3 DOWNLOADED CAS + artefakti auditilogi. Halvim: chat-eksport (jälg puudub, failis pole ID-d), eelpöördumise .txt (failis pole versiooni). Ühtegi krüptograafilist/manifest-tõendit pole üheski väljundis. | 4.2, 4.4 |

## 6. Formaadi- ja koostalitlusmaatriks

| Formaat | Kus kasutusel | Masinloetav | Roll ja hinnang |
|---|---|---|---|
| JSON | kõik ekraani-API-d; wellbeing agregaat | jah | ainus masinloetav väljund; pole kusagil positsioneeritud „ekspordina" (skeemita, versioonita) |
| CSV | wellbeing agregaadid (2 rada) | jah | kitsalt koondmõõdikud; valemisüsti-leping puudub |
| XLSX | wellbeing piloodiraport; staatiline hinnastus | osaliselt | raport-, mitte andmevahetusformaat |
| PDF | chat-töövooväljund; artefaktid | ei | **defektne generaator (Latin-1)** — E-2 |
| DOCX (päris) | artefaktid (+ malli-merge); staatilised raamlepingud | osaliselt | parim inimformaat; malli-merge jätab võõra ZIP-i sisu alles (FAILID K5) |
| `.doc` (HTML) | chat-töövooväljund „Word" | ei | töötav trikk, aga vale MIME-lubadus; pikas plaanis asendada päris DOCX-iga |
| `.txt` | eelpöördumine (klient); kontseptsioon | ei | inimloetav, hea „võta kaasa paberile" rada; ilma metaandmeteta |
| `.asice` (DigiDoc) | raamleping public/legal | jah (konteinerina) | ainus allkirjastatud/tõendatav formaat platvormil — ja see on staatiline sisendfail, mitte väljund |
| HTML | wellbeing raport (inline) | ei | escape'itud; inline-serveerimine nõuab, et vabatekst ei satuks kunagi raportisse ilma uue auditita |

**Kanooniline kasutaja andmekoopia formaat: puudub.** Soovituslik siht (ptk 11): üks ZIP, milles (a) `manifest.json` — skeemiversioon, genereerimisaeg, kasutaja-ID, iga kirje päritolu ja ajatemplid; (b) iga pind masinloetava JSON-ina (NDJSON suurte hulkade puhul); (c) inimloetavad kaaslased (olemasolevad DOCX/PDF/txt generaatorid) samas kaustapuus; (d) failid originaalkujul. See taaskasutab kõik täna töötavad generaatorid.

**Masinloetavuse kandidaadid järjekorras:** vestlused (sõnumid+ajad+roll), Teekond (vastused+versioonid), eelpöördumised (kanooniline tekst + staatusmasin), dokumendimetaandmed (sha256 on juba olemas!), Tööheaolu kirjed, jagamiste/nõusolekute register, teavitused.

**Üleandmine ESTA-le / omavalitsusele / teisele süsteemile ilma otseliidestuseta:** õige muster on „allkirjastatud pakett, mitte API": (1) kasutaja/spetsialist genereerib skeemiversiooniga JSON+DOCX paketi; (2) platvorm lisab manifesti ja (tulevikus) räsi/allkirja; (3) üleandmine käib olemasolevaid kanaleid pidi (e-post, DigiDoc, dokumendihaldus). Eeltingimus on ainult skeemi+versiooni+päritolu leping — mitte liides. ESTA on mentorite andmebaas (SUP-A0!), mitte andmete vastuvõtja — supervisiooni kontekstis liigub pakett pigem superviisorile kui ESTA-le kui organisatsioonile.

**Versiooni/skeemi/päritolu lepingut vajavad väljad:** artefakti ID+versioon+approvedAt (failis sees), eelpöördumise ID+updatedAt (txt-päises), vestlusekspordi convId+messageId+aeg, koondraporti filtrid+min-group-väärtus (juba osaliselt sees), manifesti skeemiversioon.

**Nelja väljundiliigi eristus** (praegu segunenud, tulevikus eraldi lepingud):
1. *Kasutaja enda andmekoopia* — kõik, omanikule, täielik, masinloetav (puudub, E-1);
2. *Spetsialisti tööväljund* — artefaktid DOCX/PDF (olemas, küpseim);
3. *Jagatud koostööpakett* — eelpöördumise eelinfo, room-share, tulevane „töötaja kinnitatud eksport" (osaline, ilma paketi-lepinguta);
4. *Administraatori raport* — agregaadid k-anonüümsusega (olemas, auditijälg puudu).

## 7. Omandi-, õiguste- ja privaatsusmaatriks (koond)

| Pind | Kelle andmed | Käivitaja | Õiguskontroll serveris | Privaatne/jagatud eristus |
|---|---|---|---|---|
| Chat-eksport | omanik (AI-vastus) | omanik | userId-võrdlus, ASSISTANT-only | ainult privaatne |
| Dokumendi download | omanik | omanik | assertOwnedByUser | ainult privaatne |
| Artefakti download | omanik (+allikaviited) | omanik | owner + FINAL-värav | privaatne; room-share eraldi teadlik akt |
| Materjali download | esitaja andmed | **admin** | assertAdmin + DataAudit | esitaja ise EI pääse ligi (FAILID leid) |
| Eelpöördumise txt | autori sisu (+adressaadi vaates jagatud snapshot) | autor / adressaat | omanik/adressaat + CAS | jagatud osa külmutatud saatmishetkel |
| Wellbeing agregaat | rühm (k≥3) | volitatud vaataja / admin | pilot-scope / assertAdmin | üksikisik tuletamatu (min-group + exportEligible) |
| Admin RAG failid | organisatsioon/KOV | vastav admin | admin-sessioon | — |
| public/legal | platvormi enda dokumendid | igaüks | puudub (teadlikult avalik) | — |

## 8. P0–P3 leiud

**P0 — puudub.** Ükski leid ei ole aktiivne andmeleke ega võõra andmete eksport.

| ID | P | Leid | Tõend | Mõju |
|---|---|---|---|---|
| E-1 | **P1** | GDPR andmekoopia/teisaldatavuse rada puudub, kuigi privaatsuspoliitika §8 seda lubab; ka sisemine käsiprotsess on defineerimata | `privacy.section8.items` (et.json); `app/api` täisinventuur ptk 3; K1-U1 ptk 7.11 ainult [TULEVIK] | õiguslik lubadus täitmata; koos E-5-ga pöördumatu andmekadu |
| E-2 | **P1** | Kõik PDF-väljundid (chat + KÕIK artefaktid) moondavad š/ž → `?` ja kogu kirillitsa → `?`; kasutajat ei hoiatata | `lib/chat/exportDocument.js:25` (kood 32–255); `lib/documents/pdfExport.js:1` taaskasutab | RU-kasutaja PDF kasutuskõlbmatu; ET-tekst moondub; eksitav eksport |
| E-3 | P2 | Chat-„Word" on HTML `.doc` (`application/msword`), mitte DOCX; artefaktidel on päris DOCX-generaator olemas, aga chat-rada seda ei kasuta | `exportDocument.js:198–216` vs `docxExport.js` | koostalitlus/arhiiviväärtus; Wordi hoiatusdialoog |
| E-4 | P2 | Chat-eksport ei jäta auditijälge; admini wellbeing-CSV samuti mitte (dokumendid/artefaktid/materjalid jätavad) | `chat/export/route.js` (logi puudub) vs `logDocumentsAudit`/`FILE_DOWNLOAD_ADMIN` | tõendusrada ebaühtlane |
| E-5 | P2 | Konto kustutus on kohene ja pöördumatu ilma koopiapakkumise või ooteajata; võimendub O-TK9 SENT-hävimisega | `profile/route.js:377–447`, `userDeletion.js:203–225` | kasutaja saab jäädavalt kaotada andmed, mille koopiat lubadus ette näeb |
| E-6 | P2 | Tööheaolu individuaalsetel kirjetel pole ühtegi väljavõtterada | `app/api/wellbeing/**` inventuur | tundlik isiklik ajalugu lukus ekraanil |
| E-7 | P2 | Terve vestluse eksporti pole (ainult üksik töövoo-vastus); kasutaja pool dialoogist ei ekspordi kunagi | `chat/export` ainus rada, `responseFinalizer.js:91` | „vestluste eksport" ootus täitmata |
| E-8 | P3 | `csvCell` ilma valemisüsti-neutraliseerimiseta (praegu süsteemsed väärtused) | `aggregateExport.js:11–15` | tulevikukindlus |
| E-9 | P3 | Eelpöördumise `.txt` failinimi/sisu ilma ID, kuupäeva ja versioonita — hilisem tõendamine võimatu failist endast | `WorkspaceFeaturePage.jsx:483` | tõendusväärtus ainult serveripoolses margis |
| E-10 | P3 | Materjali esitaja ei saa oma esitatud faili koopiat (admin-only) — FAILID-A0 leid, siin ekspordi vaates | `materials/[id]/download` assertAdmin | kasutaja andmed, mida ta ei saa kaasa |
| E-11 | P3 | Kasutajal pole vaadet ega koopiat oma auditijäljest ega teavituste täisajaloost (limit 100) | schema:1416; `notifications/route.js:35` | art 15 ulatuse küsimus (jurist) |
| E-12 | P3 | Dokumendi-download'i 404/403 olemasolu-oraakel (F-14 kordusviide ekspordi kontekstis; room-share `findFirst`-muster on õige) | FAILID-A0 K8 | madal |

## 9. Hästi töötavad lahendused, mida säilitada

1. **Jagatud `buildDownloadHeaders`** (`lib/documents/server.js:346–355`): no-store + nosniff + attachment + ASCII-fallback + RFC5987 — ja seda kasutavad dokumendid, materjalid, KOV/org failid ühtemoodi; runtime-testitud.
2. **Artefakti FINAL+approvedAt värav** (409 enne kinnitamata väljundit) — „UI ei luba rohkem kui server annab" etalonmuster.
3. **Artefaktifailide sisene provenance** (tüüp, kinnituskuupäev, allikdokumentide loend mõlemas formaadis).
4. **A3 DOWNLOADED CAS-leping** (`expectedUpdatedAt` → üldsõnaline 409) — versiooniturvaline allalaadimismarker, mida tasub üldistada.
5. **k-anonüümsus koondväljundites** (min-group 3, `exportEligible`, HTML escape'itud, KOV-juht ei saa kasutajataset) — kooskõlas ideed.md §21 keeluga.
6. **Kustutuse fail-closed orkestratsioon** auditi, retry ja admini järelevalvevaatega; auditilogi FK-vaba ellujäämine.
7. **Raamlepingu kinnituse kirje süsteemidokumendina** — nõusolek, mis on kasutajale endale failina kättesaadav; ainus omataoline ja õige suund.
8. **Rate-limit kõigil download-radadel** ühtse env-lepinguga.

## 10. Puuduvad, katkised ja eksitavad rajad

**Puuduvad:** konto andmekoopia (E-1); terve vestluse eksport (E-7); Teekonna, Tööheaolu individuaal-, kovisiooni, ruumisõnumite, teavituste, auditijälje, kuulutuste väljavõtted; arved; admini analüütika CSV; salvestise väljund (teadlikult — värav enne).

**Katkised:** PDF-generaatori märgimoondus (E-2) — ainus päriselt katkine väljund.

**Eksitavad:** privaatsuspoliitika §8 lubadus ilma rajata (E-1); „Word-dokument", mis on HTML (E-3); PDF-nupp, mis RU-sisu puhul annab `??????` ilma hoiatuseta (E-2).

## 11. Tulevane kanooniline ekspordiarhitektuur

1. **Üks ekspordimootor, mitte N nuppu.** `DataExportJob` (analoogne `DataDeletionJob`-ile, sama admini järelevalvemuster): taotlus → taustatöö kogub pinnad → ZIP artefaktihoidlasse → U1 `account.data_export_ready` (juba planeeritud klass) → allalaadimine aegub X päevaga → `account.data_export_downloaded`.
2. **Paketi struktuur:** `manifest.json` (skeemiversioon, aeg, kasutaja, sisukord, iga osa kirjete arv ja ajavahemik, tulevikus räsi) + pinnakaustad: iga pind JSON (masinloetav) + olemasolevate generaatorite inimloetavad kaaslased + originaalfailid (sha256 manifesti).
3. **Katvus K1 lepingu kaudu:** iga K1-adapteriga pind deklareerib `exportables` — andmekoopia täielikkus muutub lepinguliseks, mitte „kes mäletas lisada". Kuni K1 pole, käib katvus käsitsi registrina (EXPORT-P1 defineerib esimese registri).
4. **Järjestusleping kustutusega:** kustutustaotlus kontrollib lahtist ekspordijobi (ja pakub selle käivitamist); ooteaeg on tooteotsus O-E1.
5. **Neli väljundiliiki** (ptk 6 lõpp) saavad igaüks oma lepingu; jagatud koostööpakett (eelpöördumine, tulevane supervisiooni-üleandmine) saab manifesti+versiooni nagu andmekoopiagi.
6. **PDF-i alus korda enne mahulaiendust:** kas UTF-8 võimekas generaator (fondi-embedding) või PDF-i taandamine „ainult ladina põhikiri" hoiatusega — otsus O-E3.

## 12. Seos K1, U1, ESTA, professionaalse koostöö ja tulevaste ruumidega

- **K1**: descriptor = andmekoopia sisukord; `exportables` deklaratsioon lisada K1-lepingu vertikaali JUBA esimesse iteratsiooni (eelpöördumise staatus on K1 vertikaal — ja eelpöördumisel on juba täna parim allalaadimisleping, st loomulik esimene `exportables` näide).
- **U1**: ekspordi elutsükkel on puhas sündmusperekond `account.*` sees; `data_export_ready` on ptk 7.11-s juba ette nähtud TRANSACTIONAL-klassiga; lisada `requested`/`downloaded` samasse perekonda; dedupe jobId.
- **ESTA/omavalitsus/professionaalne koostöö**: mitte API, vaid allkirjastatav pakett (ptk 6); DigiDoc `.asice` on platvormil juba sissetuleva poole formaat — sama konteiner sobib väljuva koostööpaketi allkirjastamiseks; supervisiooni V0 (SUP-A0) ja kovisiooni „töötaja kinnitatud eksport" (ideed.md Etapp 5) on selle paketi esimesed tarbijad.
- **Tulevased ruumid/salvestised**: salvestise väljund tuleb projekteerida koos retention-kellaga (ruumi audit ptk 12: kahe kella retention) — osalejate nõusolekukiht on juba olemas, väljundileping (kes saab, mis vormis, mis ajaks) on O-E4 tooteotsus.

## 13. Paketistus EXPORT-P0…P4

| Pakett | Sisu | Sõltuvused |
|---|---|---|
| **EXPORT-P0** | PDF-i märgitoe parandus või aus taandumine: (a) UTF-8 fondiga generaator VÕI (b) `.doc`/DOCX vaikeformaadiks + PDF-nupu hoiatus/peitmine mitteladina sisul; + chat-ekspordi auditilogi (E-2, E-4 tehniline pool) | pole — vt ptk 15 |
| **EXPORT-P1** | Andmekoopia MVP: `DataExportJob` + pindade register v1 (profiil, vestlused JSON, dokumendid+artefaktid, eelpöördumised, Tööheaolu individuaal, jagamised, nõusolekud) + manifest.json + U1-eelne lihtteavitus | O-E1 (ulatus/ooteaeg), O-E2 (auditijälje kaasatus — jurist) |
| **EXPORT-P2** | Ekspordi auditijälje ühtlustus (admini CSV-d, agregaadid), csvCell valemisüsti-kaitse, eelpöördumise .txt päis (ID+aeg+versioon), materjali esitaja oma-koopia rada | E-8, E-9, E-10; toote-otsuseid ei vaja peale materjali-raja kinnituse |
| **EXPORT-P3** | Kustutuse-eelne koopiaportaal: DELETE-voo vahesamm „laadi koopia / jätka", ooteaja tugi, seos O-TK9 valitud variandiga | EXPORT-P1 + O-E1 + O-TK9 |
| **EXPORT-P4** | Koostööpaketi leping (versioon+manifest+allkirjavalmidus) supervisiooni/kovisiooni üleandmiseks; K1 `exportables` deklaratsioon | K1-P0, SUP-V0 seis, O-E5 |

## 14. Otsused

**Tooteomanik:**
- O-E1: andmekoopia ulatus ja SLA (mis pinnad MVP-s; kas taotlus→valmis on tunnid või „kuni 30 päeva"); kas kustutusele tuleb ooteaeg ja kui pikk.
- O-E4: salvestiste väljundileping (kes, mis vormis, mis aja jooksul) — ENNE `RECORDING_ENABLED=true`.
- O-E5: koostööpaketi esimene tarbija (supervisioon vs kovisioon vs KOV-eelpöördumine).
- O-TK9 (olemasolev, kordusviide): SENT-kirjade saatus autori kustutusel — mõjutab otseselt, mida adressaadi „kaasavõetav" sisaldab.

**Jurist:**
- O-E2: kas art 15 koopia peab sisaldama auditijälge ja teavitusi kasutaja kohta; kuidas piiritleda kolmandate isikute andmed (adressaadi märkmed, ruumisõnumid teistelt) kasutaja koopiast.
- O-E6: kas privaatsuspoliitika §8 vajab vahepealset täpsustust („koopia väljastatakse taotlusel aadressilt X, kuni Y päeva"), kuni toode rada ei paku — praegune tekst lubab rohkem, kui ükski protsess täidab.
- O-E7: staatiliste `public/legal` failide (sh hinnastus-XLSX, kontseptsiooni-txt) avalikkuse teadlik kinnitus.

**Tehnilised (ei vaja toote- ega õigusotsust):**
- PDF-generaatori UTF-8 võimekus või aus taandumine (EXPORT-P0);
- chat-ekspordi ja admini CSV auditilogi;
- csvCell `=+-@` neutraliseerimine;
- eelpöördumise .txt metaandmete päis;
- `.doc` → päris DOCX chat-rajal (docxExport on juba olemas, taaskasutatav).

## 15. Esimene rakendusvalmis pakett (ilma lahtiste otsusteta): EXPORT-P0

Sisu, mis ei sõltu ühestki O-E/O-TK otsusest:

1. **Chat-ekspordi auditilogi**: lisa `logDocumentsAudit`-analoog (või DataAudit kirje `CHAT_EXPORT`) `app/api/chat/export/route.js` õnnestunud harule — muster on artefakti-rajal olemas.
2. **`.doc` asendus päris DOCX-iga**: `createWordBufferFromText` asemel `docxExport`-i lihtvariant (sisu on sama tekst; generaator on repo-s olemas ja testitud). MIME muutub korrektseks, Wordi hoiatus kaob.
3. **PDF-i märgikontroll**: enne `createPdfBufferFromText` väljakutset kontrolli, kas sisu sisaldab >Latin-1 märke; kui jah, tagasta 409 selge i18n-veateatega („PDF ei toeta seda sisu, kasuta Wordi") — see on aus taandumine, mis EI sulge hilisemat UTF-8-generaatori otsust, aga lõpetab vaikiva moonduse kohe. (Täielik UTF-8-generaator jäägu eraldi otsuseks, sest fondi-embedding on suurem töö.)
4. **csvCell valemisüsti-kaitse** (`'`-prefiks juhtmärkidele) + regressioonitest.
5. Testid: kolm uut sihttesti (audit-kirje olemasolu; DOCX MIME/avatavus; mitteladina sisu 409) + olemasolevate `downloadHeaders`/`aggregateExport` testide roheline hoidmine (`npm test`, elava DB-ta — test-infra mälu järgi).

Ei puuduta skeemi, migratsioone ega ühtegi lahtist otsust; kõik muudatused on olemasolevate mustrite taaskasutus.

## 16. Jätkamisülesanne Sol/Codexile

**Ülesanne EXPORT-P0 (rakendus):** teosta ptk 15 viis punkti harus `codex/export-p0-pdf-docx-audit`; ära muuda `lib/documents/docxExport.js` malli-merge käitumist (FAILID K5 riskid lahendatakse eraldi O-F1/O-F2 all); jooksuta `npm test` + `npm run i18n:check` (uued veateate-võtmed kolmes keeles, et-baas pariteet).

**Runtime-kontrollid, mis jäid selles auditis NOT_RUN (sünteetiliste kasutajatega, korista kõik):**
1. Adressaadi „Laadi eelinfo alla" käitumine PÄRAST autori recall'i ja PÄRAST autori konto kustutust (oodatav: mõlemal juhul rada puudub/404; seos O-TK9-ga).
2. Chat-ekspordi võõra `convId` 403 ja arhiveeritud vestluse 404 elav kinnitus (staatiliselt üheselt, aga tõendada).
3. Wellbeing pilot-agregaadi `format=xlsx`/`report-html` tegelik avanemine Excelis/brauseris (inlineStr ohutus, escape).
4. PDF-moonduse tõendus: genereeri artefakt kirillitsa sisuga ja ava väljund (E-2 demonstratsioon tooteomanikule).
5. `public/legal/*` failide cache-päised toodangus (`curl -I`), kinnitamaks et sinna ei satu kunagi isikustatud sisu sama mustri all.

**Failid, mida safeguard'i tõttu ei loetud: ei ole** (safeguard ei rakendunud ühelgi rajal).

## Jätkamispunkt

- Audit COMPLETE; järgmine tegevus = EXPORT-P0 (ptk 15) Sol/Codexile — ei vaja ühtegi lahtist otsust.
- Tooteomanikule otsustuspakett: O-E1 (andmekoopia ulatus + kustutuse ooteaeg), O-E4 (salvestise väljund enne RECORDING_ENABLED), O-E5 (koostööpaketi esimene tarbija); juristile O-E2/O-E6/O-E7 (ptk 14).
- EXPORT-P1 (andmekoopia MVP) võib disainida paralleelselt O-E1 ootamisega: `DataExportJob` skeleton + pindade register on otsustest sõltumatud; U1 `account.data_export_ready` klass on K1-U1 dokis juba defineeritud.
- Seos teiste liinidega: K1-P0 vertikaal (eelpöördumise staatus) on loomulik koht esimesele `exportables` deklaratsioonile; O-TK9 otsus tuleb enne EXPORT-P3.
- Kontrolli-jälg: lokaalne main 0da4185b (1 ees / 22 taga), origin/main = server = fe4eb4fa; ekspordituuma failid main==origin (diff tühi); Help-pinnad origin'i seisuga.

STATUS: COMPLETE
