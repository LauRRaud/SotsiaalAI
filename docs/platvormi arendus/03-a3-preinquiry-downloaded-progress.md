# A3 — eelpöördumise DOWNLOADED oleku lõpuleviimine: progress

Uuendatud: 14.07.2026
Staatus: **SOLI JÄRELKONTROLL LÄBITUD — HEAKS KIIDETUD**
Teostaja: **Claude Opus 4.8 / Claude Code**
Nõutud effort: **EXTRA (`xhigh`)**
Järelkontroll: **Sol**
Baas: `main` @ `6a8e9fca`

## 0. Effort- ja Fable-märkus

Mudel on Opus 4.8 (õige). Effort-tase ei ole sessioonis tehniliselt nähtav — palun veendu, et see on EXTRA; read-only kaardistus on ohutu, koodimuudatused eeldavad EXTRA-t.

Fable pole limiidi tõttu saadaval — temalt vastust ei oodata; olemasolevad Fable-dokid on kehtivad lähteallikad, **aktiivne kood on tõeallikas**.

## 1. Kohustuslik lugemine (tehtud)

`01-...`, `02-...` progressidokid; aktiivne Prisma skeem (`PreInquiryStatus`); `lib/preInquiries.js` + PreInquiry API-marsruudid; `WorkspaceFeaturePage.jsx`; `tests/preInquiries/*`; Fable 5 analüüsid (ulevaade, max-taiendus).

## 2. Dok-vs-kood erinevus (dokumenteeritud)

- **Fable ülevaade (`fable-5-platvormiloogika-ulevaade.md:156, 252`):** „`DOWNLOADED` on surnud olek — defineeritud (`lib/preInquiries.js`) ja kuvatav (`WorkspaceFeaturePage.jsx`), kuid mitte kunagi määratav (setter puudub)."
- **Fable soovitus (`max-taiendus.md:377`, O4):** variant **(b)** — eemaldada olek UI-st/serialiseeringust (enum jääb). „Võib oodata."
- **Kasutaja otsus (A3, 13.07.2026):** hoopis **(a) — viia DOWNLOADED elutsükkel lõpule** 12 kinnitatud semantika järgi. See asendab Fable vana O4-soovituse. Aktiivne kood kinnitab „surnud olek" seisu → A3 ehitab puuduva setteri + üleminekud + kliendi + testid.

## 3. Aktiivse koodi kaardistus (read-only)

- **Enum** (`schema.prisma`): `PreInquiryStatus = DRAFT, READY, SENT, DOWNLOADED, ARCHIVED`.
- **Autori allalaadimine:** `WorkspaceFeaturePage.handleDownload` (rida ~1465) → `downloadTextFile` (kliendipoolne fail), notice; **serverit ei puuduta** → DOWNLOADED kunagi ei määrata. Nupp rida ~2602 (`actions.download`).
- **Adressaadi allalaadimine:** `handleDownloadReceivedInquiry` (rida ~1511) → fail; globaalset olekut ei muuda (juba korrektne, punkt 8).
- **Staatuse-silt:** `getPreInquiryStatusLabel` (rida ~459) — sisaldab juba „alla laaditud" (DOWNLOADED). (Hard-coded JS-string, mitte JSX → lint ei flag'i; A1 lisas ka i18n `journey.related.pre_inquiry_status.DOWNLOADED`.)
- **Staatuse-loogika server:** `createPreInquiry` (rida ~617) ja `updatePreInquiry` (rida ~788) võtavad staatuse `normalizeEnum(input.status, PRE_INQUIRY_STATUSES, ...)` — klient kontrollib; server ei jõusta üleminekuid. `updatePreInquiry` juba jookseb advisory-lock'i + värske re-lugemise all (A2). `sendExternalPreInquiry` (rida ~925) seab SENT (kontrollib ainult `status === SENT` → DOWNLOADED→SENT töötab). `updatePreInquiryReceiverWorkflow` (rida ~851) = READY/ARCHIVED (adressaadi voog).
- **Marsruudid:** `[id]/route.js` (GET/PATCH), `[id]/send`, `[id]/accept`, `[id]/workflow`, `[id]/room`, `[id]/covision`; **`[id]/downloaded` PUUDUB** → vaja lisada.

## 4. Kinnitatud semantika (kasutaja, autoriteetne spets)

1. `DOWNLOADED` = autor laadis salvestatud eelpöördumise enne saatmist võrguväliseks kasutamiseks alla.
2. Ainult autor võib selle oleku tekitada.
3. Lubatud üleminek: `DRAFT` või `READY` → `DOWNLOADED`.
4. `DOWNLOADED` kirjet võib edasi muuta, kuid **sisuline muutmine → `READY`** (allalaaditud koopia aegunud).
5. Uus allalaadimine → uuesti `DOWNLOADED`.
6. `DOWNLOADED` saatmine lubatud → `SENT`.
7. `SENT`/`ARCHIVED` allalaadimine ei muuda nende olekut.
8. Adressaadi „Laadi eelinfo alla" ei muuda globaalset olekut.
9. Server kontrollib omandit + lubatud üleminekut; võõra kirje olemasolu ei lekitata.
10. Allalaadimise ebaõnnestumisel ei näidata eksitavat `DOWNLOADED`.
11. ET/EN/RU tõlked ilma uue hard-coded tekstita.
12. Testid: kõik üleminekud, kordusallalaadimine, muutmise-järgne READY, SENT/ARCHIVED puutumatus, võõra tõkestus.

## 5. Kavandatav teostus

- **Server (`lib/preInquiries.js`):**
  - Puhtad helperid: `resolvePreInquiryEditStatus({currentStatus, requestedStatus, contentChanged})` (DOWNLOADED + sisumuutus → READY; SENT/ARCHIVED läbi); `preInquiryContentChanged(current, next)` (topic/situation/userEditedDraft/assessmentState võrdlus).
  - `markPreInquiryDownloaded(userId, inquiryId, {db})`: omanikukontroll (visible→null=404 no-leak; author!==userId=403); DRAFT/READY→DOWNLOADED; SENT/ARCHIVED/DOWNLOADED→muutmata.
  - `updatePreInquiry`: fresh-select'i lisada `userEditedDraft`; arvutada lõplik sisu; staatus `resolvePreInquiryEditStatus`-iga (DOWNLOADED-revert).
- **Marsruut:** `POST /api/pre-inquiries/[id]/downloaded`.
- **Klient:** `handleDownload` → pärast edukat faili-allalaadimist (kui `activeInquiryId`) kutsub endpoint'i ja uuendab olekut vastusest (punkt 10: ainult eduka faili järel; endpoint'i vea korral ei näidata DOWNLOADED). `handleDownloadReceivedInquiry` muutmata (punkt 8).
- **Testid:** pure-helperid + `markPreInquiryDownloaded` (fake-db) + updatePreInquiry-revert (integratsioon fake-db-ga).
- **i18n:** uut kasutajateksti eeldatavasti pole vaja (silt + notice olemas); kui lisan, ET/EN/RU.

## 6. Progressipäevik

### 2026-07-13 20:49 Europe/Tallinn — OPUS — ALUSTATUD
- Etapp: read-only kaardistus valmis; algab teostus.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`) — sama kinnitatud sessioon.
- Tehtud: kohustuslik lugemine; kaardistatud DOWNLOADED „surnud olek", download-teed (autor/adressaat), staatuse-loogika, marsruudid; tuvastatud dok-vs-kood erinevus (Fable O4 (b) vs kasutaja (a)).
- Otsused: ehitada täielik DOWNLOADED elutsükkel 12 semantika järgi; server jõustab üleminekud; puhtad helperid testitavuseks.
- Järgmine samm: server (helperid + markPreInquiryDownloaded + updatePreInquiry-revert), endpoint, klient, testid, kontrollid.

### 2026-07-14 00:20 Europe/Tallinn — OPUS — TEOSTATUD
- Etapp: teostus + kogu kontrollipakett valmis. **Commit'imata** — ootab Soli järelkontrolli.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).

**Server (`lib/preInquiries.js`):**
- `preInquiryContentChanged(current, next)` (`:579`) — võrdleb ainult allalaaditavat sisu: `topic`, `situation`, `userEditedDraft`, `assessmentState` (JSON). `generatedDraft` on tuletatud → EI võrrelda (allalaadimine kasutab `assessmentExportText || userEditedDraft`).
- `resolvePreInquiryEditStatus({currentStatus, requestedStatus, contentChanged})` (`:597`) — SENT/ARCHIVED taotlus läbi (semantika #6); DOWNLOADED + sisumuutus → READY (semantika #4), muutuseta → DOWNLOADED; muidu requestedStatus (senine käitumine).
- `markPreInquiryDownloaded(userId, inquiryId, {db=prisma})` (`:612`) — omanikukontroll `getVisiblePreInquiry` kaudu: nähtamatu kirje → 404 (`api.common.not_found`, ei lekita olemasolu, semantika #9); nähtav aga mitte-autor → 403 (`api.common.forbidden`, semantika #2); status ≠ DRAFT/READY (SENT/ARCHIVED/juba DOWNLOADED) → serialiseeritud **muutmata** (semantika #5, #7); muidu update → DOWNLOADED (semantika #3).
- `updatePreInquiry` (`:874`): lisatud `finalTopic/finalSituation/finalGeneratedDraft/finalUserEditedDraft/finalAssessmentState`; staatus arvutatakse `resolvePreInquiryEditStatus`-iga värske DB-kirje (`fresh.*`) vs lõpliku sisu võrdlusest — endiselt advisory-lock + värske re-lugemise all (A2). `userEditedDraft` lisatud värske-selekti. Saatmisel DOWNLOADED→SENT: `arrival.previousStatus = DOWNLOADED ≠ SENT` → saabumis-e-kiri vallandub korrektselt.

**Marsruut:** `app/api/pre-inquiries/[id]/downloaded/route.js` — `POST` → `markPreInquiryDownloaded`; 401 autentimata; catch mapib `status < 500` `error.message`-iga (403/404 võtmed), muidu 500 `pre_inquiries.errors.save_failed` (`safeError`-logiga).

**Klient (`WorkspaceFeaturePage.jsx`):** `handleDownload` → `async`; alles pärast eduka `downloadTextFile` (semantika #10) ja kui `activeInquiryId`, POST endpoint'ile ning `setInquiries` uuendus vastusest; võrgu-/serveriviga on vaikne (olek jääb muutmata → ei näidata eksitavat DOWNLOADED). `handleDownloadReceivedInquiry` (adressaat) **muutmata** (semantika #8).

**i18n:** uut kasutajateksti ei lisatud — staatuse-silt (`getPreInquiryStatusLabel` + `journey.related.pre_inquiry_status.DOWNLOADED`, A1) ja notice olid olemas; veavõtmed (`api.common.*`, `pre_inquiries.errors.save_failed`) olemas ET/EN/RU. (semantika #11)

**Testid (`tests/preInquiries/downloadedLifecycle.test.js`, 14 tk):**
- `resolvePreInquiryEditStatus`: DOWNLOADED+muutus→READY, +muutuseta→DOWNLOADED, SENT/ARCHIVED läbi, mitte-DOWNLOADED→requested.
- `preInquiryContentChanged`: topic/situation/userEditedDraft/assessmentState muutuse tuvastus + null-samaväärsus.
- `markPreInquiryDownloaded` (fake-db): DRAFT→DOWNLOADED, READY→DOWNLOADED, DOWNLOADED-kordus = no-op update, SENT/ARCHIVED muutmata, adressaat (mitte-autor) → 403, võõras → 404.
- `updatePreInquiry` (integratsioon fake-db): DOWNLOADED + sisumuutus → READY; DOWNLOADED + muutuseta → DOWNLOADED. (semantika #12: kõik üleminekud, kordus, revert, puutumatus, võõra tõke kaetud.)

**Kontrollipakett (kõik roheline):**
- Sihitud testid: 14/14 ✔.
- `npm test`: **802/802** ✔.
- `npm run i18n:check`: OK (en/ru ↔ et pariteet).
- eslint (muudetud failid): **0 viga**, 27 olemasolevat hoiatust (ükski minu muudatuste ridadel).
- `npm run build`: „Compiled successfully"; marsruut `/api/pre-inquiries/[id]/downloaded` registreeritud.
- `git diff --check`: puhas (ainult LF/CRLF hoiatused).
- Runtime-smoke: `POST /api/pre-inquiries/:id/downloaded` autentimata → **401** `api.common.unauthorized` (auth jõustub enne DB-d).

- Otsused: server on tõeallikas (Fable dokk kirjeldas „surnud olekut" — nüüd elutsükkel lõpule viidud); `generatedDraft` teadlikult sisuvõrdlusest väljas.
- Järgmine samm: **Soli sõltumatu järelkontroll**. Enne seda EI commit'i/push'i/deploy'i.
- Muudetud failid: `lib/preInquiries.js`, `app/api/pre-inquiries/[id]/downloaded/route.js` (uus), `components/workspace/WorkspaceFeaturePage.jsx`, `tests/preInquiries/downloadedLifecycle.test.js` (uus), see progressidokk.

### 2026-07-14 01:45 Europe/Tallinn — OPUS — PARANDUSRING 1 (Sol järelkontroll)
- Etapp: Sol EI kiitnud heaks; 5 punkti + 4 P1 parandatud. **Commit'imata** — ootab uut Soli kontrolli.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).

**Sol P1-d (algne seis):**
- P1 `WorkspaceFeaturePage.jsx:1465–1475` — salvestamata redaktoriversioon märgiti allalaadituks (endpoint kutsuti alati, kui `activeInquiryId`).
- P1 `WorkspaceFeaturePage.jsx:2686–2687` — loendi „Laadi alla" ei märkinud olekut üldse (otse `downloadTextFile`).
- P1 `lib/preInquiries.js:612–633` — märkimine võis paralleelse muudatuse üle kirjutada (lukk/versioonivalve puudus).
- P1 `lib/preInquiries.js:852–881` — PATCH sai `status: DOWNLOADED` abil oleku ise tekitada.

**Parandused (5 punkti):**

1. **DOWNLOADED = ainult tegelik salvestatud versiooni allalaadimine.**
   - Loendi „Laadi alla" → uus `handleDownloadSavedInquiry` (`WorkspaceFeaturePage.jsx`): laadib salvestatud snapshot'i kanoonilise teksti + märgib sama versioonikindla vooga.
   - Redaktori `handleDownload`: kui `content !== buildPreInquiryDownloadContent(saved)` (salvestamata muudatused) → laadib faili, aga **ei kutsu** endpoint'i; ainult täpsel vastavusel märgib, saates `expectedUpdatedAt = saved.updatedAt`.
   - Adressaadi `handleDownloadReceivedInquiry` puutumata (semantika #8) — endpoint'i ei kutsu.

2. **Versioonikindel märkimine.** `markPreInquiryDownloaded(userId, id, {expectedUpdatedAt, db})` (`lib/preInquiries.js`) jookseb nüüd **sama `withPreInquiryRoomLock`** all nagu `updatePreInquiry`. Omanik + olek + `updatedAt` loetakse **värskelt luku all samas transaktsioonis**; kui DRAFT/READY kirje `updatedAt` ≠ kliendi `expectedUpdatedAt` → **üldine 409** (`download_conflict`), olekut ei muudeta. Determinism: muudatus-enne-märkimist → stale 409; märkimine-enne-muudatust → hilisem sisumuutus viib `resolvePreInquiryEditStatus`-iga READY-sse. Omanikukontroll (404 no-leak / 403) jääb luku ETTE.

3. **PATCH-kõrvatee suletud.** `resolvePreInquiryEditStatus`: mis tahes ei-DOWNLOADED olekust `requestedStatus = DOWNLOADED` **ignoreeritakse** (jääb praeguseks olekuks). DRAFT/READY → DOWNLOADED on võimalik AINULT endpoint'i kaudu. (Saatmine/arhiveerimine võidab endiselt; DOWNLOADED + sisumuutus → READY.)

4. **Üks kanooniline allalaaditav sisu.** Uus puhas helper `buildPreInquiryDownloadContent(inquiry)` (`lib/preInquiriesQuestionnaire.js`) ehitab snapshot'ist täpselt failiteksti (`buildPreInquiryAssessmentExportText` ümbris). Kasutusel **redaktoris** (`assessmentExportText`), **loendis** ja **serveri sisumuutuse kontrollis** (`preInquiryContentChanged` võrdleb nüüd renderdatud teksti, mitte käsitsi valitud välju). Seega loevad KÕIK failis nähtavad väljad, sh **adressaadi nimi** (`Adressaat:`) → DOWNLOADED kirje adressaadi muutus → READY.

**Marsruut:** loeb `expectedUpdatedAt` POST-kehast; kasutab whitelistitud `publicErrorStatus`/`publicErrorMessageKey` (mitte suvalist `error.message`'t); 409 `download_conflict` mapitakse selgelt (võtme regex `api.*`/`documents.*` seda ei kata) generic-sõnumina.

**i18n:** lisatud `pre_inquiries.errors.download_conflict` ET/EN/RU (üldine „muutus vahepeal" sõnum).

**Testid (`downloadedLifecycle.test.js`, 22 tk):** kõik 5 pure-loogika juhtu (sh side-channel + kanooniline sisu adressaadiga); `buildPreInquiryDownloadContent` (identne=sama, muudetud=erinev — kliendi mark/skip alus); `markPreInquiryDownloaded` omand/üleminek + versioon (match→märgib, stale→409 muutmata); `updatePreInquiry` revert + adressaadi-muutus→READY + PATCH-side-channel; determinism mark-before-edit. **Sol punkt 5 kaetud;** puhtserveri/pure testides ei ole DOM-harnessi → loendi-endpoint-kutse ja adressaadi-mittekutse on kaetud jagatud helperi + kliendi-koodi ülevaatuse + runtime-smoke'iga.

**Kontrollipakett (kõik roheline):** sihitud 22/22 ✔; `npm test` **810/810** ✔; `i18n:check` OK; eslint (muudetud) **0 viga** (27 olemasolevat hoiatust, ükski uus); `npm run build` „Compiled successfully", marsruut registreeritud; `git diff --check` puhas; runtime-smoke `POST …/downloaded` (kehaga) autentimata → **401**.

- Muudetud failid (parandusring): `lib/preInquiries.js`, `lib/preInquiriesQuestionnaire.js`, `app/api/pre-inquiries/[id]/downloaded/route.js`, `components/workspace/WorkspaceFeaturePage.jsx`, `tests/preInquiries/downloadedLifecycle.test.js`, `messages/{et,en,ru}.json`, see dokk.
- Järgmine samm: **Soli uus järelkontroll**. Enne seda EI commit'i/push'i/deploy'i.

### 2026-07-14 02:40 Europe/Tallinn — OPUS — PARANDUSRING 2 (Sol järelkontroll)
- Etapp: Sol kinnitas parandusringi 1 kliendivood/kanoonilise sisu/luku/sisumuutuse kontrolli õigeks; 3 väikest serverilepingu parandust. **Commit'imata** — ootab uut Soli kontrolli.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).

**Sol P1/P2 (algne seis):**
- P1 `lib/preInquiries.js:670–679` — versioonikontroll oli endiselt VALIKULINE (`expectedUpdatedAt != null &&` → puuduva fingerprint'iga DRAFT/READY → DOWNLOADED läks ikka läbi).
- P2 `lib/preInquiries.js:604–615` — vigane PATCH `status: DOWNLOADED` sai eduka 200 (resolver ainult säilitas oleku; polnud „üleminek lükatakse tagasi").

**Parandused:**

1. **`expectedUpdatedAt` kohustuslikuks DRAFT/READY → DOWNLOADED üleminekul.** `markPreInquiryDownloaded` luku all: eemaldatud `expectedUpdatedAt != null` tingimus — nüüd `sameUpdatedAtFingerprint(fresh.updatedAt, expectedUpdatedAt)` peab kehtima. Puuduv / `null` / vigane kuupäev / aegunud → üldine **409** `pre_inquiries.errors.download_conflict`; olekut ega `updatedAt`-i ei muudeta. SENT/ARCHIVED/DOWNLOADED no-op jääb muutmata (endpoint neid ei muuda; versioonivalve käib alles pärast no-op-tagastust). (`sameUpdatedAtFingerprint` tagastab `false` juba `null`/undefined/`NaN` korral → üks tingimus katab kõik.)

2. **PATCH `status: DOWNLOADED` sõnaselgelt tagasi lükatud.** `updatePreInquiry` luku all, kohe pärast `requestedStatus` normaliseerimist: `requestedStatus === "DOWNLOADED"` → kontrollitud **400** `api.common.invalid_request` (whitelistitud võti, olemas ET/EN/RU:2615), enne mis tahes DB-update'i, sõltumata praegusest olekust. DOWNLOADED tekib/käsitletakse AINULT downloaded-endpoint'i kaudu. (`resolvePreInquiryEditStatus` säilitab defensiivse coerce'i pure-tasandil, kuid updatePreInquiry ei jõua sinna DOWNLOADED-taotlusega — vise on esmane leping.)

3. **Kliendi source-contract regressioonitestid** (uus `tests/preInquiries/downloadedClientContract.test.js`) — kuna DOM-harnessi pole, loevad komponendi lähtekoodi ja kinnitavad ühenduse: loendinupp → `handleDownloadSavedInquiry(inquiry)`; `markSavedInquiryDownloaded` POST `/downloaded` koos `expectedUpdatedAt`-iga; mõlemad autori-download'id suunavad märkimise läbi `markSavedInquiryDownloaded`; `handleDownloadReceivedInquiry` EI kutsu märkimist ega `/downloaded`-i (#8).

**Testimuudatused:** senised DRAFT/READY → DOWNLOADED testid saadavad nüüd `SNAPSHOT_AT`; lisatud „fingerprint on MANDATORY" (puudub/null/vigane → 409, 0 update'i); PATCH-test ootab nüüd **400** + `db.updates.length === 0` (mitte ainult DRAFT-i jäämist). i18n uut võtit ei vajanud (kasutati olemasolevat `api.common.invalid_request`).

**Kontrollipakett (kõik roheline):** A3 sihitud **27/27** ✔ (`downloadedLifecycle` 23 + `downloadedClientContract` 4); `npm test` **815/815** ✔; `i18n:check` OK; eslint (muudetud) **0 viga** (27 olemasolevat hoiatust, ükski uus); `npm run build` „Compiled successfully"; `git diff --check` puhas.

- Muudetud failid (parandusring 2): `lib/preInquiries.js`, `tests/preInquiries/downloadedLifecycle.test.js`, `tests/preInquiries/downloadedClientContract.test.js` (uus), see dokk. (Marsruut/klient/i18n parandusringist 1 muutmata.)
- Järgmine samm: **Soli uus järelkontroll**. Enne seda EI commit'i/push'i/deploy'i.

### 2026-07-14 03:05 Europe/Tallinn — OPUS — SOLI JÄRELKONTROLL LÄBITUD — HEAKS KIIDETUD
- Etapp: Sol kiitis A3 (parandusringid 1 + 2) HEAKS. Töö on **LÕPETATUD**.
- Kinnitatud: 12 semantikat + Soli 2 parandusringi (versioonikindel märkimine kohustusliku fingerprint'iga, PATCH-kõrvatee 400-ga suletud, kanooniline allalaaditav sisu kõigi nähtavate väljadega, kliendi source-contract testid).
- Kontrollipakett (heakskiidu hetkel): A3 sihitud 27/27; `npm test` 815/815; `i18n:check` OK; eslint 0 viga; `npm run build` OK; `git diff --check` puhas.
- Commit: selektiivselt A3 failid + A2 progressidoki lõpetav sissekanne; pealkiri „A3: Complete pre-inquiry downloaded lifecycle (Sol HEAKS KIIDETUD)"; push `main`. Deploy'd EI tehta. Kõrvalised ruumifailid (`public/room/frame-*.webp`, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs`) jäid stage'imata.
