# Opus 4.8 — ootejärjekord A2–U10: tööplaan ja progress

Uuendatud: 13.07.2026
Staatus: **SOLI JÄRELKONTROLL LÄBITUD — HEAKS KIIDETUD PARANDUSTEGA**
Teostaja: **Claude Opus 4.8 / Claude Code**
Nõutud effort: **EXTRA (`xhigh`)**
Järelkontroll: **Sol**
Tooteotsused: **kasutaja**

## 0. Kasutamise reegel

Sama muster nagu A1 (`00-opus-4-8-tooplaan-ja-progress.md`): see fail on korraga lähteülesanne, töö käigus täidetav kontrollnimekiri, append-only progressipäevik ning Solile antav üleandmisalus. Varasemaid kirjeid ei kustutata; parandus lisatakse uue kirjena. Tõeallikate järjekord: aktiivne kood/skeem/migratsioonid/testid → käesolev plaan → A1 plaan → fable-5 dokumendid.

Baas käesoleva partii alguses: `main` @ `b366fe2a` (A1 heaks kiidetud + push'itud).

## 1. Partii ülesanded (kasutaja valik 13.07.2026)

1. **A2** — ruumi deduplikatsioon `originType/originId` järgi.
2. **A4** — eelpöördumine → Kovisioon anonüümsuskinnituse edastamine.
3. **A11** — „Parimad praktikad" põhikarussellis ausalt „ehitamisel".
4. **A5/U1-lite** — sisemise eelpöördumise saabumise sündmus ja e-kiri.
5. **U10** — spetsialisti kinnitatud kohtumise kokkuvõte ühisesse ruumi.

Iga lõik tehakse eraldi vertikaalse lõiguna A1-distsipliiniga (kaardistus → skoop → teostus → testid → kontrollid → progress → Soli üleandmine). Päris tooteotsused (eriti A4/A5/U10 privaatsus) küsitakse kasutajalt, mitte ei pakuta vaikeväärtust.

## 2. A2 — ruumi deduplikatsioon originType/originId järgi

### Skoop (kasutaja kinnitatud 13.07.2026)
- Pre-pöördumise ruumi loomistee (`app/api/pre-inquiries/[id]/room/route.js`) dedup viia `(originType, originId)` peale, hapra `description`-teksti-markeri (`preInquiry:<id>`) asemel.
- Lisada **tavaline liitindeks** `@@index([originType, originId])` (mitte DB-unique).
- **Mitte** lisada DB-unikaalsuskitsendust praegu; rakendustaseme lahendust **ei** nimetata absoluutseks garantiiks. DB osaline unikaalsus jäetakse eraldi hilisemaks sammuks pärast olemasolevate duplikaatide auditit (vt „Edasilükatud").
- Help-match ja käsitsi-kutse ei kuulu A2-sse: help-match dedup'ib juba `HelpMatch` unikaalsuse (`requestId_offerId`) + `roomId` viite kaudu; käsitsi-kutse loob teadlikult uue ruumi.

### Aktiivsest koodist kontrollitud
- `Room` mudelil on juba `originType`/`originId`/`originLabel`/`originMeta` + eraldi indeksid `@@index([originType])`, `@@index([originId])`.
- Pre-pöördumise ruum juba kirjutab `originType` (PRE_INQUIRY / SERVICE_PROVIDER_INQUIRY) ja `originId = inquiry.id` (`buildRoomOrigin`) → **origin-põhine dedup on tagasiühilduv olemasolevate ruumidega, backfill'i pole vaja**.
- `preInquiry:<id>` markerit loeb ainult see üks route; mujal keegi ei sõltu.
- Praegune dedup on user-membership-skoobiga (`members some userId leftAt null`) — säilitatakse (autoriseerimisgarantii).

### Edasilükatud (eraldi hilisem samm, kasutaja soov)
- DB osaline unikaalsus `(originType, originId)` (ainult mitte-null originId, singleton-origin-tüübid) pärast produktsiooni duplikaatide auditit.

### Progressipäevik

#### 2026-07-13 16:54 Europe/Tallinn — OPUS — ALUSTATUD
- Etapp: A2 kaardistus valmis; algab teostus.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`) — sama kinnitatud sessioon.
- Tehtud: kaardistatud kõik ruumi-loomiskohad (`pre-inquiries/[id]/room`, `lib/help/matches.js`, `invites`, `invites/sponsored/init`); kohalik DB (4 ruumi, kõik originType=NULL, 0 dubleeringut); marker-lugejate otsing (ainult sama route).
- Otsus: rakendustaseme dedup (originType, originId) + liitindeks; DB-unique edasi lükatud (kasutaja kinnitus).
- Järgmine samm: skeem+migratsioon (liitindeks), testitav helper `ensureRoomForPreInquiry`, route, testid, kontrollid.

#### 2026-07-13 17:01 Europe/Tallinn — OPUS — ETAPP VALMIS / OPUS VALMIS (A2)
- Etapp: A2 teostus + kontrollid.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - Skeem: `Room` liitindeks `@@index([originType, originId])` (mitte-unikaalne); olemasolevad üksikindeksid alles.
  - Migratsioon: `prisma/migrations/20260713170000_room_origin_composite_index/migration.sql` (`CREATE INDEX Room_originType_originId_idx`).
  - Uus testitav helper `lib/rooms/preInquiryRoom.js`: `ensureRoomForPreInquiry({userId, inquiry, participantIds}, {db})` — transaktsioon + Postgres advisory-lock (`pg_advisory_xact_lock(hashtext('preInquiryRoom:'+id))`) concurrent-open serialiseerimiseks; dedup `originType IN (PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY) AND originId = inquiry.id`, membership-skoobiga; tagastab `{room, created}`. + `preInquiryRoomOriginType`, `buildPreInquiryRoomTitle`.
  - Route `app/api/pre-inquiries/[id]/room/route.js`: kasutab helperit; hapar `description`-marker enam dedup'iks ei kasuta (marker jääb kirja tagasiühilduvuseks, aga ei loeta); staatuse-bump ainult uue ruumi loomisel; vastus `created ? 201 : 200`.
- Muudetud/uued failid: `prisma/schema.prisma`, `prisma/migrations/20260713170000_room_origin_composite_index/migration.sql` (uus), `lib/rooms/preInquiryRoom.js` (uus), `app/api/pre-inquiries/[id]/room/route.js`, `tests/rooms/preInquiryRoomDedup.test.js` (uus).
- Käivitatud kontrollid: `prisma validate` OK; `prisma generate` OK; `db:migrate:check` **OK** (78 migratsiooni, drift puudub, reaalne localhost-Postgres); A2-testid **7/7**; `npm test` **751/751**; `eslint` muudetud failid 0 viga; `npm run build` „Compiled successfully"; `git diff --check` puhas; advisory-lock SQL valideeritud otse reaalse Postgresi vastu.
- Tagasiühilduvus: olemasolevad pre-pöördumise ruumid kannavad juba `originId=inquiry.id` → origin-dedup leiab need ilma backfill'ita.
- Otsused/põhjendus: kasutaja valik — rakendustaseme dedup + liitindeks, EI DB-unique. Advisory-lock annab app-level race-turvalisuse; **ei ole absoluutne DB-garantii** (kaks eri protsessi/instantsi jagavad sama Postgres advisory-lock ruumi, seega praktikas turvaline, kuid mitte skeemikitsendus).
- Risk/takistus: elavat autoriseeritud „ava ruum" e2e-d (kaks platvormi-kasutajat + inquiry) ei jooksutatud; kaetud helperi ühiktestide + build + advisory-lock/indeks reaalse DB kontrolliga.
- **Edasilükatud (jälgitav follow-up):** DB osaline unikaalsus `(originType, originId)` mitte-null originId singleton-tüüpidele pärast produktsiooni duplikaatide auditit (spawn_task loodud).
- Järgmine samm: A4 — eelpöördumine → Kovisioon anonüümsuskinnituse edastamine.

## 3. A4 — eelpöördumine → Kovisioon anonüümsuskinnituse edastamine

### Skoop (kasutaja kinnitatud variant (a), 13.07.2026)
- `POST /api/pre-inquiries/[id]/covision` oli **alati-400** (R4): ehitas drafti ilma `anonymityConfirmed`-ita, `normalizeCaseInput` nõuab seda.
- Parandus = **variant (a)**: marsruut edastab `body.anonymityConfirmed` (range boolean `=== true`). Juhtum luuakse ainult sõnaselge kinnitusega; kinnituseta → olemasolev 400 `covision.errors.anonymityConfirmed_required`. `normalizeCaseInput` leping säilib.
- Kliendil polnud endist kutsujat (UI-nupp = O1-järgne) → **skoop puhtalt marsruut + testitav loogika**, UI väljaspool.

### Progressipäevik

#### 2026-07-13 17:21 Europe/Tallinn — OPUS — ETAPP VALMIS / OPUS VALMIS (A4)
- Etapp: A4 teostus + kontrollid.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - Uus puhas helper `buildPreInquiryCovisionCaseInput(draft, body)` — koostab `createCovisionCase` sisendi, edastab `anonymityConfirmed: body?.anonymityConfirmed === true`, `participants: []`, lubab body-l pealkirja/keskküsimuse üle kirjutada.
  - Testitavuse tõttu tõstetud `buildCaseFromPreInquiryDraft` + uus helper **`lib/covision.js` → `lib/covisionShared.js`** (server-only-vaba moodul; `lib/covision.js` impordib `server-only`-tainti kaudu ja pole test-imporditav). `lib/covision.js` re-ekspordib mõlemad → `@/lib/covision` import-pind muutumatu. Koristatud tekkinud kasutamata `buildAnonymizedDraft` import + `MAX_SHORT_TEXT_LENGTH` konstant.
  - Marsruut `app/api/pre-inquiries/[id]/covision/route.js`: kasutab `buildPreInquiryCovisionCaseInput(draft, body)`; tagastab endiselt `anonymityIssues`.
- Muudetud/uued failid: `lib/covisionShared.js`, `lib/covision.js`, `app/api/pre-inquiries/[id]/covision/route.js`, `tests/covision/preInquiryCovisionInput.test.js` (uus).
- Käivitatud kontrollid: A4-testid **6/6**; covision shared testid 5/5; `npm test` **757/757**; `eslint` muudetud failid 0 viga (pärast import-koristust); `npm run build` „Compiled successfully"; `git diff --check` puhas; runtime-smoke `POST /api/pre-inquiries/x/covision` autoriseerimata → puhas **401 JSON** (re-export-ahel laadib).
- Otsused/põhjendus: variant (a) (kasutaja valik) — privaatsusohutu, juhtumit ei teki ilma sõnaselge kinnituseta; range `=== true` väldib truthy-coercion'it. Puhaste funktsioonide viimine covisionShared'i = testitavus ilma server-only tõketa.
- Risk/takistus: elavat autoriseeritud e2e-d (spetsialist + eelpöördumine → juhtum) ei jooksutatud (nõuab seanssi + andmeid); kaetud puhta-funktsiooni ühiktestide + build + runtime-smoke'iga. Skeemimuudatust A4 ei vajanud.
- Järgmine samm: A11 — „Parimad praktikad" põhikarussellis ausalt „ehitamisel".

## 4. A11 — „Parimad praktikad" põhikarussellis ausalt „ehitamisel"

### Skoop
- Aus „· ehitamisel" märgis oli olemas Teemaseemnete alamnavis, aga põhikarusselli (`RoomStage` kovisiooni komplekt) „Parimad praktikad" kaart seda ei kandnud ja **navigeeris eksitavalt `/kovisioon`-i** (kus on eraldi „Kovisiooni ruum" kaart). Tooteotsust polnud vaja — ülesanne on ausus.

### Progressipäevik

#### 2026-07-13 17:32 Europe/Tallinn — OPUS — ETAPP VALMIS / OPUS VALMIS (A11)
- Etapp: A11 teostus + kontrollid.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - `components/glass/GlassCard.jsx`: valikuline `badge` prop → renderdab `<span class="gc-card-badge">` (tagasiühilduv; olemasolevad kaardid ilma badge'ita muutumatud).
  - `components/room/GlassCarousel.jsx`: edastab `badge={item.badge}` + `item.comingSoon` korral `data-coming-soon="1"`, `aria-disabled="true"`, `title`.
  - `components/room/RoomStage.jsx`: kovisiooni „praktikad" kaardilt eemaldatud `href` (ei navigeeri eksitavalt), lisatud `comingSoon:true`, `badge:"ehitamisel"`, `comingSoonHint`. Kaart jääb keritavaks (pöördub keskele), kuid selekteerimisel `handleSelect` no-op (pole href/action).
  - `app/styles/carousel.css`: `.gc-card-badge` (pill, --font-ui, tokenid), `.gc-card[data-coming-soon="1"]{cursor:default}`, badge lisatud ignitsiooni fade-reeglitesse (süttib koos kaardisisuga). Additiivne, ilma !important-ita.
  - ET/EN/RU: `room.kovision_practices_building` + `..._building_hint`.
- Muudetud failid: `components/glass/GlassCard.jsx`, `components/room/GlassCarousel.jsx`, `components/room/RoomStage.jsx`, `app/styles/carousel.css`, `messages/{et,en,ru}.json`.
- Käivitatud kontrollid: `i18n:check` OK (pariteet); `eslint` muudetud failid 0 viga (3 varasemat `<img>` hoiatust RoomStage'is, mitte minu); `npm test` **757/757**; `npm run build` „Compiled successfully"; `git diff --check` puhas; brauseris (dev-server): konsoolis 0 viga, karusell renderdab (9 kaarti), `.gc-card-badge` CSS aktiivne (getComputedStyle: 999px pill, uppercase, --font-ui) — kinnitab renderdus + stiil.
- Otsused/põhjendus: `aria-disabled` (mitte `disabled`), et kaart jääks karusellis keritavaks, kuid ei navigeeriks; href eemaldatud, et ei eksitaks `/kovisioon`-i (ausus). Badge = sama selgus mis alamnavis.
- Risk/takistus: autenditud vaate visuaal (tegelik „Parimad praktikad" kaart kovisiooni hub'is) nõuab login + ruumi-navigatsiooni; kaetud DOM/CSS-kontrolli + koodiraja + build'iga. CSS on additiivne, !important-budjetti ei mõjuta.
- Järgmine samm: A5/U1-lite — sisemise eelpöördumise saabumise sündmus ja e-kiri.

## 5. A5/U1-lite — sisemise eelpöördumise saabumise sündmus ja e-kiri

### Skoop (kasutaja kinnitatud e-kirja sisu, 13.07.2026)
- Praegu: autor näeb staatust, aga sisemise eelpöördumise adressaat saab teada ainult lehte avades — eraldi saabumisteavitust POLE (SLA sõltub lehe avamisest).
- A5-lite: kui sisemine eelpöördumine **saadetakse (staatus → SENT INTERNAL-kanalil)** platvormi-adressaadile, saadetakse talle **saabumise-e-kiri**.
- **E-kirja sisu (kasutaja valik): ainult teavitus + link** — „Sulle saabus uus eelpöördumine SotsiaalAI-s. Logi sisse, et see üle vaadata: <link>". EI sisalda teemat, olukorda ega sisu. Adressaat loeb sisu ainult platvormil sisse logituna.
- Nõusolek: olemasolev `acceptsPreInquiries` opt-in (INTERNAL-kohaletoimetamise eeldus). Eraldi e-kirja-lüliti = edasilükatud (vt „Edasilükatud").

### Edasilükatud
- Per-kasutaja e-kirja-teavituste lüliti (eraldi eelistus) ja täielik märguandekiht (U1 full).
- E-kirja lokaliseerimine (praegu eesti keeles, nagu olemasolevad platvormi e-kirjad `sendExternalPreInquiry` / covision-kutsed).

### Progressipäevik

#### 2026-07-13 18:10 Europe/Tallinn — OPUS — ETAPP VALMIS / OPUS VALMIS (A5)
- Etapp: A5/U1-lite teostus + kontrollid.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud (`lib/preInquiries.js`):
  - `shouldSendInternalArrival({previousStatus, nextStatus, deliveryChannel, recipientOwnerId})` — puhas päästiku-predikaat: käivitub ainult INTERNAL + `nextStatus===SENT` + `previousStatus!==SENT` + recipientOwnerId olemas. Idempotentne (üleminek üks kord; SENT-järgne redigeerimine on niikuinii keelatud).
  - `buildInternalArrivalEmail({baseUrl})` — puhas teavitus-e-kirja koostur (subject + text + html), **ainult link, ilma sisuta** (võtab ainult baseUrl'i, seega ei saa struktuurselt sisu lekitada).
  - `sendInternalPreInquiryArrivalEmail(recipientOwnerId, {db, mailer, resolveUrl, from})` — süstitav; toob adressaadi e-posti `User.email`-ist, saadab teavituse; jätab vahele kui saatja/adressaadi-e-post puudub (`{sent:false, reason}`). `dispatchInternalArrivalEmail` = best-effort fire-and-forget (`.catch` → log; ebaõnnestunud teavitus ei riku salvestust).
  - Ühendatud `createPreInquiry` (previousStatus null) ja `updatePreInquiry` (previousStatus = existing.status) lõppu.
- Muudetud/uued failid: `lib/preInquiries.js`, `tests/preInquiries/internalArrivalEmail.test.js` (uus).
- Käivitatud kontrollid: A5-testid **8/8** (predikaat + no-content koostur + DI send-helper); `npm test` **765/765**; `eslint` 0 viga; `npm run build` „Compiled successfully"; `git diff --check` puhas.
- Otsused/põhjendus: teavitus+link (kasutaja valik) — tundlik sisu ei lahku platvormilt e-postiga. Päästik SENT-üleminekul (mitte loomisel), sest SENT on autori sõnaselge saatmistegevus; enne seda on mustand. Idempotentsus üleminekuvärava kaudu (sentAt't ei muudetud, hoiab A5 minimaalse). Best-effort: teavitus ei blokeeri salvestust.
- Risk/takistus: elavat autoriseeritud „saada sisemiselt → e-kiri" e2e-d ei jooksutatud (nõuab kahte kasutajat + SMTP/mock); kaetud DI ühiktestide + build'iga. Dev-keskkonnas mailer on mock (logib). Per-kasutaja opt-out lükatud edasi (nõusolek = acceptsPreInquiries).
- Järgmine samm: U10 — spetsialisti kinnitatud kohtumise kokkuvõte ühisesse ruumi.

## 6. U10 — spetsialisti kinnitatud kohtumise kokkuvõte ühisesse ruumi

### Skoop (kasutaja valik: server-ühendus + minimaalne UI, 13.07.2026)
- Dokumendi kirjeldus: „puudu on täpselt üks ühendus: artefakt → ühine ruum." MEETING_SUMMARY artefakt (audience=client juba olemas) jääb spetsialisti dokreziimi; U10 = viia kinnitatud kokkuvõte ühisesse ruumi.
- **Server:** ruumisõnumite POST (`/api/rooms/[roomId]/messages`) võtab valikulise `summaryArtifactId`; kui antud, resolvitakse kinnitatud (FINAL) MEETING_SUMMARY sisu (omand + tüüp + FINAL väravad) ja postitatakse ruumi sõnumina, taaskasutades olemasolevat ligipääsu/privaatsust/rate-limiti/broadcast'i. **Uut õigustemudelit ega tööobjekti ei lisatud.**
- **Minimaalne UI:** ArtifactDetailPage FINAL MEETING_SUMMARY korral „Jaga kokkuvõte ühisesse ruumi" (ruumivalik + nupp).
- **Pöörduja kinnitus = valikuline v1** (dok soovitus): kohustuslikku kinnitust ei lisatud (vajaks uut tööobjekti); pöörduja saab vastata tavalise ruumisõnumiga („sain aru"/„parandus").
- Piir (dok): jagatakse ainult spetsialisti kinnitatud kokkuvõte; ei tohi saada ametlikuks protokolliks (STAR2 piir).

### Edasilükatud
- Eristav renderdus („seinal" / kokkuvõtte-märgis ruumis) — vajaks RoomMessage skeemimarkeri; jäetud.
- Pöörduja „sain aru/parandus" nupud (praegu = tavaline vastussõnum).

### Progressipäevik

#### 2026-07-13 18:28 Europe/Tallinn — OPUS — ETAPP VALMIS / OPUS VALMIS (U10)
- Etapp: U10 teostus + kontrollid.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - Uus testitav teenus `lib/rooms/meetingSummaryShare.js`: `resolveConfirmedMeetingSummaryContent(userId, artifactId, {db})` — väravad: omand (võõras/puuduv → üldine 404, ei lekita), tüüp MEETING_SUMMARY (400), FINAL (409), mittetühi sisu (400).
  - Marsruut `app/api/rooms/[roomId]/messages/route.js`: POST võtab `summaryArtifactId`; resolvib sisu, edastab olemasolevasse privaatsus/rate-limit/create/broadcast torusse.
  - UI: uus `components/documents/MeetingSummaryRoomShare.jsx` (ruumide laadimine, valik, POST `summaryArtifactId`); lisatud `ArtifactDetailPage`-i FINAL MEETING_SUMMARY harusse.
  - ET/EN/RU: `documents.meeting_summary_share.*`.
- Muudetud/uued failid: `lib/rooms/meetingSummaryShare.js` (uus), `app/api/rooms/[roomId]/messages/route.js`, `components/documents/MeetingSummaryRoomShare.jsx` (uus), `components/documents/ArtifactDetailPage.jsx`, `messages/{et,en,ru}.json`, `tests/rooms/meetingSummaryShare.test.js` (uus).
- Käivitatud kontrollid: U10-testid **6/6**; `npm test` **771/771**; `i18n:check` OK; `eslint` muudetud failid 0 viga; `npm run build` „Compiled successfully"; `git diff --check` puhas; runtime-smoke `POST /api/rooms/x/messages {summaryArtifactId}` autoriseerimata → puhas **401 JSON** (uus import/loogika laadib).
- Otsused/põhjendus: laiendasin olemasolevat messages POST-i (mitte uut endpointi) → taaskasutab kogu ligipääsu/privaatsuse/broadcast'i, „üks ühendus". FINAL-värav = ainult kinnitatud kokkuvõte jagatakse. Ilma skeemimuudatuseta (RoomMessage jääb muutumatuks; sisu = kokkuvõte).
- Risk/takistus: autenditud e2e (spetsialist jagab → pöörduja näeb ruumis) nõuab FINAL MEETING_SUMMARY artefakti + ruumi + kahte kasutajat; kaetud resolveri ühiktestide + build + endpoint-smoke'iga. Eristav renderdus + pöörduja kinnitus-nupud edasi lükatud.

## 7. Partii kokkuvõte (A2, A4, A11, A5/U1-lite, U10)

Kõik viis ootejärjekorra tööd **OPUS VALMIS**, ootavad Soli järelkontrolli.

| Töö | Sisu | Migratsioon | Testid | Otsus |
|---|---|---|---|---|
| A2 | Ruumi dedup (originType, originId) + liitindeks; app-level advisory-lock | jah (liitindeks) | 7 | rakendustase (DB-unique edasi lükatud) |
| A4 | Eelpöördumine → Kovisioon `anonymityConfirmed` edastamine | ei | 6 | variant (a) |
| A11 | „Parimad praktikad" karussellikaart ausalt „ehitamisel" | ei | (UI, DOM/CSS-kontroll) | — |
| A5/U1-lite | Sisemise eelpöördumise saabumise e-kiri (teavitus+link) | ei | 8 | teavitus+link |
| U10 | Kinnitatud MEETING_SUMMARY → ruumi sõnumina + minimaalne UI | ei | 6 | server+minimaalne UI, kinnitus valikuline |

Lõppkontrollid partii lõpus: `npm test` **771/771**, `i18n:check` OK, `lint` 0 viga, `npm run build` OK, `git diff --check` puhas, `db:migrate:check` OK (A2 liitindeks). Baas: `main` @ `b366fe2a`. Commit'imata (kasutaja otsustab). Edasilükatud: A2 DB osaline unikaalsus (spawn_task); A5 per-kasutaja e-kirja opt-out; U10 eristav renderdus + kinnitus-nupud.

## 8. Soli sõltumatu järelkontroll

#### 2026-07-13 21:44 Europe/Tallinn — SOL — HEAKS KIIDETUD PARANDUSTEGA

- Kontrollitud Opuse partii tegelikku diffi baasi `main @ b366fe2a` suhtes, serveri õiguste ja privaatsuse piire, A2 võistlusolukorda, A4 sisendilepingut, A11 käitumist ning A5/U10 teostust.
- **A2:** rakendustaseme deduplikatsioon, PostgreSQL advisory-lock ja `(originType, originId)` liitindeks vastavad kinnitatud skoobile. DB osaline UNIQUE jäi teadlikult edasi lükatuks; seetõttu ei käsitleta lahendust DB-taseme absoluutse garantiina.
- **A4:** `anonymityConfirmed` edastatakse rangelt ainult väärtuse `true` korral ja olemasolev anonüümsuskinnituse värav jääb kehtima. Lisaparandust ei vajanud.
- **A11:** lisatud püsivad regressioonitestid, mis kontrollivad `comingSoon` märgistust, puuduva `href`-i lepingut, `aria-disabled` olekut ja badge'i renderdust. Kaart ei vii enam eksitavalt aktiivsesse funktsiooni.
- **A5 parandatud:** saabumisteavituse dispatch ei ole enam serverless-keskkonnas katkeda võiv fire-and-forget. Mõlemad SENT-ülemineku kohad ootavad saatmiskatse lõpuni; saatmisviga jääb endiselt best-effort korras salvestust mitte blokeerivaks. Lisatud saatmisvea ja awaited-dispatch'i testid.
- **U10 parandatud:** jagamine on serveris lubatud ainult `SOCIAL_WORKER`, `SERVICE_PROVIDER` ja `ADMIN` rollidele; kliendi roll saab 403. Marsruut aktsepteerib ainult dokumenteeritud `summaryArtifactId` välja. UI peidab tegevuse sobimatule rollile, pakub ainult vähemalt kahe liikmega ruume, ei eelvali ruumi ning nõuab teadlikku valikut. FINAL-kokkuvõtte sõnaselge jagamine edastab olemasolevale privaatsusväravale `send_original` otsuse; serveri omandi-, tüübi-, staatuse-, liikmelisuse- ja privaatsuskontrollid jäävad alles.

### Soli sõltumatud kontrollid pärast parandusi

- Partii sihttestid: **33/33**.
- Kogu `npm test`: **777/777**.
- `npm run i18n:check`: **OK** (ET/EN/RU pariteet).
- Kogu `npm run lint`: **0 viga, 384 varasemat hoiatust**; partii parandused ei lisanud uusi hoiatusi.
- `npm run build`: **Compiled successfully**.
- `npm run db:migrate:check`: **OK**, ajutises reaalses PostgreSQL andmebaasis rakendusid kõik **78 migratsiooni**, skeem oli ajakohane ja kontrollandmebaas eemaldati.
- `git diff --check`: partii failides puhas.

### Alles jäävad piirid ja commit'i märkus

- Autenditud kahe kasutajaga brauseri-e2e-d ei tehtud, sest kontrollitud testseanssi ja seemneandmeid ei olnud. Serveriväravad on kaetud ühiktestide, ehituse ja marsruutide laadimiskontrolliga.
- A5-l puudub endiselt durable outbox ja kasutajapõhine e-kirja opt-out; U10 ei loo artefakti ja ruumisõnumi vahele püsivat seost ega takista sama kokkuvõtte korduvat jagamist. Need ei kuulu kinnitatud minimaalsesse skoopi.
- Töökataloogis on lisaks sellele partiile ruumipiltide, `room.css`, `room-frames.js`, pildigeneraatori ja `RoomStage.jsx` muid pooleliolevaid muudatusi. Sol ei hinnanud neid selle partii osana. Ühe suure commit'i korral lähevad need kaasa ainult siis, kui kasutaja seda teadlikult soovib.

**Soli otsus:** A2, A4, A11, A5/U1-lite ja U10 partii on pärast ülaltoodud parandusi **HEAKS KIIDETUD**. Partii võib commit'ida ja push'ida; deploy ei kuulu sellesse üleandmisse.
