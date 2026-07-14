# Fable 5: Kovisiooni tervikvoo teadmistekaart ja sihtkontroll

Kuupäev: 14.07.2026 (õhtu)
Koostaja: Fable 5
Staatus: **COMPLETE** — kogu määratud sihtkontroll lõpetatud; eraldi piirangud on loetletud peatükis 11.
Ülesanne: teadmistekaardi sihtkontroll — tehniline verifitseerimine aktiivse `main`-i vastu (mitte uus täismahus audit). Rakenduskoodi ei muudetud.
Kontrollitud rada:

```text
Teemaseeme → Kovisiooni sessiooni etapid 1–8 → etapi 8 atomaarne sulgemine
→ Lõpetatud juhtum → järeltegevus või jätkamine → parima praktika kandidaat
→ retsensendi töövoog → avaldamine → RAG-sünk
```

Tõendusastmed: **[KOOD]** staatiliselt loetud · **[TEST]** käivitatud automaattest · **[RUNTIME]** töötava rakenduse API vastu autenditud sessiooniga kontrollitud · **[DB]** andmebaasist otse kinnitatud · **[LAHTINE]** selles keskkonnas ei olnud võimalik kontrollida.

Kontrollikeskkond: `main` @ `80848212` (puhas tööpuu, võrdne `origin/main`-iga); lokaalne dev-server pordil 3000; PostgreSQL `localhost:5432/sotsiaal_ai`; kaks olemasolevat testkontot (`codex.spatial.test@local.invalid` = juhtumi omanik/autor A, `claude.admin@sotsiaal.ai` = retsensent/avaldaja B); sisselogimine repo enda `LoginTempToken` mehhanismiga. RAG-teenuse võtit keskkonnas ei ole (RAG-sünk kontrollitud võtmeta-haruni). Kõik loodud sünteetilised andmed kustutati kontrolli lõpus (ptk 10).

---

## 1. Kokkuvõte

**Kontrollitud rada töötab otsast lõpuni ja on serveris jõustatud kuni avaldamise ning RAG-tööjärjekorra ohutu võtmeta `skipped`-haruni.** Päris RAG-ingest võtmega keskkonnas jäi selle kontrolli ulatusest välja ja on eraldi märgitud peatükis 11. Kõik kaheksa sessioonietappi on ehitatud serveripoolsete väravatega; etapi 8 lõpetamine teeb atomaarse sulgemise, mis ühes tehingus loob üldistatud lõpptulemuse (closure + järeltegevus + omanikupakk + soovi korral praktikakandidaat), muudab seemne olekut ja **kustutab sessiooni detailandmed** (privaatsuse-by-design). Lõpetatud juhtumi elutsükkel (järeltegevus → otsus → jätkuseeme/sulgemine/arhiiv) ja parima praktika retsensendiahel (võimekused → määrangud → 3 rolli heakskiit → avaldamine → versioonisnapshot → RAG-tööjärjekord) töötavad versioonikindlalt. Omaniku-/osalejapiirded pidasid kõigil IDOR-sondidel (ka ADMIN ei möödu). 265/265 sihttesti on rohelised.

Varasem teadmus („etapid 1–4 ehitatud, 5–8 platseholderid; demo-lõuend") on **aegunud** — vana `CovisionSession.jsx` on importimata surnud kood; aktiivne UI on `CovisionWorkspace`, mis töötab päris andmekihiga.

Leiti 2 väikest koodileidu (P3), 1 keskkonnaleid (lahendatud kohapeal) ja 1 keskkonnapiirang — ükski ei katkesta rada ega leki andmeid (ptk 9).

---

## 2. Raja arhitektuurikaart

### 2.1. Andmemudelid (prisma/schema.prisma) **[KOOD]**

| Mudel | Roll rajas | Võtmeväljad |
|---|---|---|
| `TopicSeed` (:1943) | omaniku privaatne ettevalmistus | `status` DRAFT→WAITING→IN_COVISION→FOLLOW_UP→CLOSED; `sharedCardSnapshot` (külmutatud kaart); `ownerConfirmedAt`; `covisionCaseId @unique` |
| `CovisionCase` (:1971) | juhtum | `status` DRAFT/ACTIVE/SUMMARY_READY/CLOSED/ARCHIVED; `anonymityConfirmedAt`; seosed `sessionState`, `closure`, `sourceTopicSeed` |
| `CovisionSessionState` (:2090) | serveri omanduses sessiooniseis | `stage` 1–8, `phase`, **`version` (CAS)**, `caseConfirmedAt`, `settingsConfirmedAt`, paus |
| `CovisionParticipantState` (:2116) | osaleja valmisolek | presentAt / roleConfirmedAt / agreementConfirmedAt / readyAt |
| `CovisionWorkItem` (:2133) | jagatud tööobjektid etapi kaupa | kind/status/visibility, autor-osaleja |
| `CovisionPrivateState` (:2157) | privaatsed mustandid/otsused kasutaja kaupa | `@@unique([sessionId,userId,stage,kind])`; serializer laadib ainult aktiivse vaataja omad |
| `CovisionStageSnapshot` (:2176) | etapi lõpetamise külmutatud tõend | `@@unique([sessionId,stage])`, payload, completedBy |
| `CovisionClosure` (:2197) | üldistatud lõpptulemus | generalizedTitle/workFocus/selectedDirection/nextStep/timeframe/progressMarker; `lifecycleStatus`; `practiceStatus`; `retentionStatus`; **`version` (CAS)**; `continuationTopicSeedId @unique` |
| `CovisionFollowUp` (:2240) | järeltegevused | SCHEDULED/COMPLETED/RESCHEDULED/CANCELLED; tulemusevaljad |
| `CovisionOwnerPackage` (:2268) | omaniku kinnitatud pakk | content JSON (ainult valitud väljad) |
| `EffectivePractice` (:2322) | praktikakandidaat/avaldatud praktika | `status` DRAFT→SUBMITTED→IN_REVIEW→READY_TO_PUBLISH→PUBLISHED (+NEEDS_CHANGES/RE_REVIEW/HIDDEN/ARCHIVED); `version` + `contentVersion` + `publishedVersion`; `ownerConfirmedNoIdentifiers*`; `ragSourceId/ragMetadata`; `sourceClosureId @unique` |
| `PracticeCapability` (:2382) | retsensendivõimekus | REVIEWER/ETHICS/EDITOR/APPROVER; validUntil; grantBasis; revokedAt |
| `EffectivePracticeReviewAssignment` (:2426) | määrang | `@@unique([practiceId,reviewerId,capabilityType,contentVersion])` |
| `EffectivePracticeReview` (:2403) | otsus | APPROVED/NEEDS_CHANGES/DECLINED/CONFLICT + conflictStatus |
| `EffectivePracticeVersion` (:2447) | muutumatu avaldamissnapshot | `@@unique([practiceId,version])`, publicSnapshot, reviewRoles |
| `EffectivePracticeApplication`, `PracticeCapabilityAudit`, `EffectivePracticeAuditEvent` | rakendamiskogemused, võimekuste audit, praktika auditijada | — |

### 2.2. Teenused (lib/) **[KOOD]**

- `topicSeeds.js` (392 r) — omanik-ainult CRUD; `queueTopicSeed` = DRAFT→WAITING atomaarne CAS + kohustuslik `confirmedNoIdentifiers` + külmutatud `sharedCardSnapshot`; idempotentne kordus.
- `covisionSessionShared.js` (939 r) — **kõigi 8 etapi faasikataloog** (`COVISION_STAGE_PHASES`), edasiliikumise rajad (`COVISION_STAGE_PROGRESS_PHASES`), lõpetamisfaasid, etapi tööobjektiliikide whitelist'id, **etapiväravad `gateStageOne..Eight`** + `assertCovisionStageGate` (409 `stage_gate` + `missing[]`).
- `covisionSession.js` (1284 r) — `startCovisionFromTopicSeed` (advisory-lock tehing: case+OWNER-osaleja+session+seed IN_COVISION, idempotentne; :530–603); `applyCovisionSessionAction` (12 actionit; **`pg_advisory_xact_lock` juhtumi kaupa + `bumpSession` updateMany-CAS versioonil**; :1031–1284); `buildServerStageGateState` — **COMPLETE_STAGE tõendid arvutatakse serveris DB-st, kliendi evidence'it ei usaldata** (:826–941); post-sulgemise lukk (`SESSION_STAGE_WORK_COMPLETED`, :1044–1049); `assertCovisionCreator` (ADMIN|SOCIAL_WORKER; :258–262).
- `covisionCompletedCases.js` (962 r) — `createClosureFromStageSnapshotsTx` (:600–688): closure ainult etappide 2/3/7/8 snapshotite whitelist-väljadest + omanikukinnituste kontroll (:524–529); **`purgeSessionDetailTx`** (:551–591): kustutab privaatseisud, tööobjektid, etappide 1–7 snapshotid, sõnumid, osapooled, sammud, riskid, kokkuvõtte, COVISION-kõned; asendab etapi 8 snapshoti markeriga `{stage:8, closureCreated:true}`; tühjendab juhtumi sisuväljad ja asendab pealkirja üldistatuga; juhtum → CLOSED. Elutsükkel: `updateCompletedCaseFollowUp` (complete→DECISION_PENDING; reschedule), `decideCompletedCase` (close / new_follow_up / **continue → uus jätku-TopicSeed DRAFT + CONTINUATION_PENDING + vana seeme CLOSED** / practice_candidate), `archiveCompletedCase`; kõik closure-`version` CAS + advisory lock.
- `effectivePractices.js` (2331 r) — `createPracticeDraftFromClosureTx` (:2221): kandidaat **ainult closure'i üldistatud väljadest**, idempotentne `sourceClosureId` kaudu; `candidateReady` (:184) + `containsDirectIdentifier` (regexid e-post/telefon/isikukood, :206); submit → `assignReviewersTx` (REVIEWER/ETHICS/EDITOR aktiivsete võimekustega, autor välistatud, HIGH-risk 2 eri REVIEWER-it; :255); review nõuab ASSIGNED määrangut sama `contentVersion`-iga + `conflictStatus`; heakskiidulävi 3 rolli (:1343–1351); publish: APPROVER, mitte autor ega allikjuhtumi osaleja, anonüümsuskontroll sama contentVersion, `nextReviewAt` kohustuslik, versioonisnapshot + RAG-guard-job (:1372–1461); `processRagIngest` püsiv retry-job (versioonivalve, superseded-koristus, idempotentne linkimine; :829–939); review-scheduler (advisory lock, REVIEW_DUE/ASSIGNMENT_OVERDUE markerid; :946+).
- `covisionKnowledge.js` — legacy `EffectivePractice→RAG` sünk (PUBLISHED→ingest, peidetud→delete).

### 2.3. API-marsruudid ja lehed **[KOOD]**

- Seemned: `GET/POST /api/topic-seeds`, `PATCH /api/topic-seeds/[id]`, `POST /api/topic-seeds/[id]/queue`, `POST /api/topic-seeds/[id]/covision` — kõik `requireCovisionAuth` taga; start lisaks `assertCovisionCreator`.
- Sessioon: `GET /api/covision/[id]/session`, `POST /api/covision/[id]/session/actions`; varu-sulgemistee `POST /api/covision/[id]/close` (idempotentne; nõuab phase=complete + stage-8 snapshotit).
- Lõpetatud: `GET /api/covision/completed`, `GET /api/covision/completed/[id]`, `PATCH …/follow-up`, `POST …/decision`, `POST …/archive`.
- Praktikad: `GET/POST /api/effective-practices`, `GET/PATCH /api/effective-practices/[id]`, `POST …/[id]/actions` (submit/review/publish/archive/re_review), `…/applications`, `GET/POST …/capabilities` (POST = ainult admin); auth = sama `requireCovisionAuth` (re-export `requireEffectivePracticeAuth`).
- Lehed: `/teemaseemned`, `/kovisioon` (→ `CovisionPage` → **`CovisionWorkspace`**), `/lopetatud-juhtumid` (`CompletedCasesPage`), `/parimad-praktikad` (`EffectivePracticesPage`) — kõigil serveripoolne sessiooni + `canUseCovisionRole` värav (redirect). Vana `CovisionSession.jsx` demo-komponenti ei impordi ükski fail → surnud kood.

---

## 3. Sessioonimasin: 8 etappi **[KOOD + RUNTIME]**

- Faasid on etapi kaupa fikseeritud kataloogis; `SET_PHASE` lubab liikuda ainult mööda edasirada sammu kaupa (`normalizePhaseTransition`, covisionSession.js:204–215) — hüpped → 409 `PHASE_TRANSITION_CONFLICT`.
- `COMPLETE_STAGE` nõuab: payload.stage == sessiooni stage, payload.phase == sessiooni phase == etapi lõpetamisfaas; **tõendid arvutatakse serveris** (jagatud tööobjektid + omaniku privaatseisud + osalejate valmisolek); värav 409 + `missing[]` loendiga; snapshot on unikaalne (topeltlõpetamine → `STAGE_ALREADY_COMPLETED`).
- Väravate sisu (valik): etapp 1 — kõik osalejad present+roll+kokkulepe+valmis, juhtum ja seaded kinnitatud; etapp 2 — jagatud `case_anchor` + omaniku pildi/fookuse kinnitus + privaatsuse ülevaatus (SUMMARY_REVIEWER-i olemasolul tema oma); etapp 6 — kriitilised eeldused lahendatud; etapp 7 — suund+järgmine samm (**ainult omaniku mõjuulatuses**, `actorType=owner`)+ajaraam+edenemismärk+järeltegevus+omaniku kinnitus, mis peab olema **värskem kui viimane muudatus** (`stageSevenOwnerConfirmationIsFresh`, :792–810); etapp 8 — pakk+järeltegevus+üldistamis-/õppimis-/säilitus-/praktikaotsus+lõppkinnitus, otsuste juurde nõutavad tööobjektid (owner_package, group_generalization, practice_candidate_decision).
- Rollid: LEADER (OWNER/CO_MODERATOR) juhib faase/lõpetamist/kutseid; OBSERVER saab ainult kinnitada; kutsumata/ACCEPTED-ta kasutaja ei saa muteerida; omanikku ei saa kutsuda osalejaks; korraga üks `active` tööobjekt etapis.
- Runtime: kogu jada START_SESSION → CONFIRM_SETTINGS → CONFIRM_CASE → CONFIRM_PARTICIPANT → faasid → COMPLETE_STAGE × 8 läbiti versioonidega v0→v95; iga vahe-COMPLETE viis järgmise etapi algfaasi; etapi 8 COMPLETE → `phase="complete"`. **[RUNTIME]**

## 4. Atomaarne sulgemine ja purge **[KOOD + RUNTIME + DB]**

Etapi 8 `COMPLETE_STAGE` kutsub samas advisory-lock tehingus `createClosureFromStageSnapshotsTx`. Tulemus (runtime + DB kinnitus):

- `CovisionClosure`: FOLLOW_UP_PENDING; väljad täpselt etappide 3/8 (workFocus/generalizedTitle) ja 7 (suund/samm/ajaraam/märk/järeltegevus) snapshotitest; `practiceStatus=PRIVATE_DRAFT` (kuna otsus `create_draft`); `retentionStatus=RETAINED_SELECTED_OUTPUT`; järeltegevus SCHEDULED (kuupäev „28.07.2026" parsiti `scheduledFor`-iks); omanikupakk CONFIRMED (ainult 5 valitud välja).
- `EffectivePractice` DRAFT loodi closure'i üldistatud väljadest (autor = juhtumi omanik; `sourceClosureId` unikaalne → idempotentne).
- Seeme → `FOLLOW_UP`.
- **Purge (DB-st kinnitatud):** workItems 0, privateStates 0, snapshotid ainult `{stage:8, closureCreated:true}`, sõnumid / juhtumiosalised (`CovisionParty`) / sammud / riskid / kokkuvõte / kõned 0; juhtumi `summary/anonymizedDescription/centralQuestion=null`, `topics/tags/expectedHelpTypes=[]`, `sourcePreInquiryId=null`, pealkiri = üldistatud pealkiri, staatus CLOSED. Sessiooniosalejad (`CovisionParticipant`) jäävad closure'i õiguste aluseks.
- Sulgemisjärgne suvaline action → 409 `SESSION_STAGE_WORK_COMPLETED`. **[RUNTIME]**

## 5. Lõpetatud juhtumi elutsükkel **[KOOD + RUNTIME]**

- Nähtavus: omanik või closure'i `assignedFollowUpUserId` + ACCEPTED-osaleja (`accessWhere/scopeWhere`); teine kasutaja (ka ADMIN): loend tühi, detail 404. **[RUNTIME]**
- Järeltegevuse lõpetamine: ainult omanik või aktiivne määratud täitja; `expectedVersion` CAS (vale → 409 **[RUNTIME]**); complete → DECISION_PENDING + tulemusevaljad. **[RUNTIME]**
- Otsus „continue": DECISION_PENDING|CONTINUATION_PENDING → loob **jätku-TopicSeed'i** (DRAFT, pealkiri üldistatud pealkirjast, `whyNow` = uus küsimus), closure → CONTINUATION_PENDING, vana seeme → CLOSED; idempotentne (`continuationTopicSeedId` olemasolul ei loo uut). **[RUNTIME]** — seemneloendis olid pärast: algne CLOSED + jätkuseeme DRAFT.
- Otsused „close" (põhjendusega, juhtum+seeme CLOSED), „new_follow_up", „practice_candidate" (idempotentne draft) ja „archive" (ainult CLOSED|CONTINUATION_PENDING pealt) — **[KOOD]**, kaetud testidega (completedCasesService/RouteContract).

## 6. Praktika: retsensendi töövoog → avaldamine → RAG **[KOOD + TEST + RUNTIME]**

Runtime-jada (autor A = SOCIAL_WORKER, retsensent/avaldaja B):

1. Admin GRANT B-le REVIEWER+EDITOR+ETHICS+APPROVER (tähtaeg + alus kohustuslikud) → 4×OK. GRANT/REVOKE on ainult admin; auditikirjed tekkisid.
2. A täiendas kandidaati (conditions+limitations) + `ownerConfirmedNoIdentifiers:true` → version/contentVersion tõusid; sisumuutus nullib anonüümsuskinnituse ja -kontrolli (versioonipõhine leping).
3. A `submit` → SUBMITTED; **3 määrangut** (REVIEWER/EDITOR/ETHICS, contentVersion 2) tekkisid B-le.
4. B `review` APPROVED×3 (`conflictStatus:"NONE"` kohustuslik): REVIEWER→IN_REVIEW, EDITOR→IN_REVIEW, ETHICS→**READY_TO_PUBLISH** (3 rolli lävi; ETHICS täitis ühtlasi anonüümsuskontrolli).
5. Negatiiv: **A `publish` → 403** (SELF_PUBLISH_FORBIDDEN).
6. B `publish` (nextReviewAt 2027-01-15) → **PUBLISHED, publishedVersion=1**; `EffectivePracticeVersion` v1 muutumatu snapshot rollidega [REVIEWER, EDITOR, ETHICS]; auditijada SUBMITTED→3×REVIEW_APPROVED→PUBLISHED; määrangud COMPLETED. **[DB]**
7. RAG: võtmeta keskkonnas `ragMetadata={syncStatus:"skipped", reason:"rag_key_missing", publishedVersion:1}`, `ragSourceId=null`; publish'i loodud guard-job (`RAG_DELETE`, externalRef = deterministlik `effective-practice::<publicId>::v1`) suleti `done`. Võtmega keskkonnas sama tee → `/ingest/text` + püsiv retry (`processRagIngest`: versioonivalve, superseded→delete-koristus, `PUBLISH_LINK_STALE` kaitse) — **[KOOD+TEST]** (`ragIngestRetry.test.js`); päris ingest **[LAHTINE]** (võti puudub).
8. Negatiiv: **A `archive` PUBLISHED pealt → 409** (PUBLISHED_ARCHIVE_REQUIRES_REVIEW); tagasivõtutee on ETHICS-võimekusega `re_review` (→ RAG removal_pending + uus retsensiooniring) **[KOOD]**.

Huvide konflikt: allikjuhtumi osaleja ei saa retsenseerida ilma `conflictStatus=DECLINED`-ita ega olla APPROVER (`sourceCaseParticipantTx`); assignment-repair (P1) parandab autor-retsensendi vastuolud **[KOOD+TEST]**.

## 7. Õiguste piirid (IDOR-sondid) **[RUNTIME]**

| Sond (kasutaja B = ADMIN, mitteosaleja) | Tulemus |
|---|---|
| GET võõra juhtumi sessioon / juhtum | 404 / 404 |
| PATCH võõras seeme; B seemneloend | 404; ainult enda (0) |
| GET võõras closure-loend / detail; PATCH follow-up | tühi / 404 / 404 |
| POST decision võõral closure'il | 404 |
| Autentimata: topic-seeds / covision / completed / effective-practices | 401 kõikjal |
| Kandidaadi detail: võõras ilma määranguta | 404 (`capabilityCanReadCandidate`) **[KOOD]** |

Privaatseisude leke: sessiooni serializer laadib `privateStates` ainult `where:{userId}` (covisionSession.js:352–355) — teise osaleja privaatala ei välju kunagi **[KOOD]**; kaetud `workspaceServerPrivacy.test.js`-ga.

## 8. Testid **[TEST]**

`node --import ./scripts/register-node-test-loader.mjs --test "tests/topicSeeds/**/*.test.js" "tests/covision/**/*.test.js" "tests/effectivePractices/**/*.test.js"` → **265 pass / 0 fail** (~0,9 s). Katvus: sessionMachine/Schema/Service/RouteContract, completedCases (schema/service/route/klient), workspaceServerPrivacy, liveSession, preInquiryCovisionInput, knowledge (RAG-tekst), legacyWriteLifecycle, uiConcurrency; effectivePractices contract/service, assignmentRepair, ragIngestRetry, reviewScheduler, justificationHistory, accountDeletion, deployGate; topicSeeds klient-leping. (NB: glob peab olema `**/*.test.js` — paljas `**` haarab kataloogid ja raporteerib valefaile.)

## 9. Leiud

1. **KOV-ENV-1 (Keskkond — LAHENDATUD kohapeal).** Lokaalne dev-DB oli `main`-ist 6 migratsiooni maas (`wellbeing_covision_handoff`, U3, U8-lite, P1, U4, U1/U2) → mh `GET /api/service-map/entries` 500 ja `User`-update'ide `42703 notificationEmailEnabled`. Rakendasin `npx prisma migrate deploy` → 92/92, „Database schema is up to date"; service-map → 200. Reegel: pärast main-i uuendust jooksuta lokaalis migratsioonid. Kontrollitav rada ise neist migratsioonidest ei sõltunud (kõik voog töötas ka enne).
2. **KOV-P3-1 (P3 — rolliebasümmeetria praktika-autorluses).** `assertCovisionCreator` lubab ADMIN-il olla juhtumi omanik (lib/covisionSession.js:258–262) ja sulgemine loob talle praktikakandidaadi, kuid effective-practices autoriteed nõuavad rolli SOCIAL_WORKER|SERVICE_PROVIDER (lib/effectivePractices.js: createCandidate :1142, updateCandidate :1165, getDetail autoriharu :1213, submit :1223) → **ADMIN-autor saab omaenda kandidaadile 404 ega saa seda esitada**. Runtime-tõend: ADMIN-ina GET kandidaat → 404; sama kasutaja SOCIAL_WORKER-ina → kind:candidate. Mõjutab ainult admin-kontosid (test-/halduskasutus); tavaautoritel probleemi pole. Otsustada: kas ühtlustada (lubada adminile autorivaade) või keelata adminil kovisiooni omanikuks olemine.
3. **KOV-P3-2 (P3 — lehevärava streaming-redirect).** Autentimata `GET /teemaseemned|/kovisioon|/lopetatud-juhtumid|/parimad-praktikad` → HTTP **200**, mille kehas on NEXT_REDIRECT-marker (`/vestlus?login=1`) + lehe staatiline SSR-shell (nupunimed, 0-loendurid; ~400 KB). Andmeid ei leki — kirjed laaditakse ainult autenditud API-dest (401) ja SSR ei sisalda ühtegi kirjet — kuid puhas 307 eeldaks sessioonikontrolli enne esimest flush'i. Tõend: `curl -s /teemaseemned` → size≈406k, `NEXT_REDIRECT|login=1`=5 vastet, „Uus teemaseeme"=3 vastet.
4. **KOV-LIMIT-1 (Keskkonnapiirang — mitte koodileid).** Claude'i brauseripaanis selle rakenduse route-segmentide klient-hüdratsioon ei käivitu (nuppudel puudub `__reactProps`, React-efektid/fetch'id ei jookse, loendurid jäävad SSR-0 olekusse; konsool puhas). Seetõttu piirdus UI-kiht siin SSR-DOM-i ja API-dega; lõuendi visuaalne käitumine on varasemates sessioonides päris brauseris kinnitatud. (Seostub teadaoleva paani-screenshotide timeout-probleemiga ruumi-tausta lehtedel.)
5. **KOV-NOTE-1 (Märkus, mitte leid).** `review`-action nõuab `conflictStatus` välja ka APPROVED puhul (lib/effectivePractices.js:1269–1271) — teadlik lepingudisain (huvide konflikti deklaratsioon on kohustuslik), API-kasutajal lihtsalt teada.

## 10. Sünteetilised andmed ja koristus

Loodud ja **kustutatud**: 1 TopicSeed + 1 jätku-TopicSeed; 1 CovisionCase (+osaleja, sessioon, snapshotid — cascade); 1 CovisionClosure (+2 FollowUp kirjet, OwnerPackage — cascade); 1 EffectivePractice (+3 määrangut, 3 review'd, 1 versioon, auditikirjed — cascade) + 2 DataDeletionJob rida; 4 PracticeCapability + 4 auditikirjet; 7 LoginTempTokenit; NotificationEvent'e ei tekkinud (0). Kasutaja `codex.spatial.test` roll taastati ADMIN-iks (oli kontrolli ajaks SOCIAL_WORKER, et autor-rada oleks realistlik). Jääkide kontroll: seemned/juhtumid/closure'id/praktikad/võimekused = 0. Rakenduskoodi ei muudetud (`git status`: ainult dokumendifailid). Püsiv keskkonna­muudatus: lokaalse DB 6 puuduvat migratsiooni rakendatud (leid 1) — see viib dev-keskkonna main-iga kooskõlla ega ole testandmete jääk.

## 11. Mida see kontroll EI kata

- RAG-i päris ingest/eemaldus võtmega keskkonnas (siin ainult `skipped`-haru + testid); AI-assist (`/api/covision/assist`) sisu; kõned/LiveKit (COVISION-kõnede API on olemas, provider konfigureerimata); mitme päris osaleja samaaegne sessioon (concurrency on kaetud CAS/lock-testidega, mitte mitme brauseriga); UI piksli-/interaktsioonikiht (leid 4); review-scheduler'i ja U1-teavituste käitumine timeriga (P1/U1 auditid katsid need eraldi).

---

*Iga väide viitab failile/reale või on märgitud RUNTIME/DB/TEST tõendiga; runtime-jada täpsed sammud (versioonid v0→v95, staatusekoodid) on selle sessiooni transcriptis. See dokument on teadmistekaardi (fable-5-uue-akna-orientatsioon-ja-teadmistekaart.md, ptk 8) laiendus Kovisiooni tervikvoo kohta.*

---

## KOV-Q1 — Kovisiooni metodoloogiline alus

Kuupäev: 14.07.2026 (hilisõhtu)
Koostaja: Fable 5
Staatus: **COMPLETE** — kõik neli määratud metodoloogilist allikat on täies mahus läbi töötatud.
Ülesanne: vastata ühele küsimusele — **milline on nelja metodoloogilise allika põhjal Kovisiooni tuum, mida digitaalne ja tulevane ruumiline kasutajaliides ei tohi moonutada ega kaotada.** See peatükk on metodoloogiline alusdokument, mitte tehniline audit (see on ptk 1–11) ega ruumilise disaini ettepanek (see tuleb eraldi sammuna).

**Allikad** (kõik loetud täies mahus; viitelühendid kehtivad selles peatükis):

| Lühend | Allikas | Iseloom | Viitamine |
|---|---|---|---|
| **[PJ]** | `Kovisioon – praktiline juhend kolleegidevahelise nõustamise korraldamiseks.pdf` — Erasmus+ INDIVERSO, Josefsheim gGmbH / M. Künemund, august 2017; protsessikirjeldus dr K.-O. Tietze, rakendusskeem R. Zeiler (2012) | lühike praktiline juhend (10 lk), kutseõppe/rehabilitatsiooni kontekst; ainus allikas, mis loetleb eksplitsiitselt meetodi **piirid** | lk nr |
| **[KJ]** | `kovisiooni-juhend.docx` — mahukas 8-peatükiline käsiraamat (olemus ja mõju; juhtideta juhtimine; grupiprotsess; suhtlemiskunst; küsimused; sessiooni juhtimine; 15+ mudelit; kovisioonisüsteem) | kõige põhjalikum ja rangeim coaching-paradigma allikas; autor kirjeldab end ESCÜ presidendiks valitud koolitajana — sisu kattub S. Vesso „Kovisiooni käsiraamatu“ (2020) ainestikuga [TULETIS] | ptk nr (failis pole lk-numbreid) |
| **[LK]** | `Kovisiooni-juhend-lastekaitsetootajatele.pdf` — S. Roots, Sotsiaalkindlustusamet 2025 | sotsiaalvaldkonna (lastekaitse) ametlik juhend, 15 lk, töölehtedega; sihtrühmalt platvormile kõige lähem | lk nr |
| **[BM]** | `Kuidas käib kovisiooni baasmudel.pdf` — A. Kaljakin, allankaljakin.eu | veebiartikkel (5 lk), baasmudeli (incident method) kompaktseim kirjeldus; mainib otse virtuaalset läbiviimist | lk nr |

Märgis **[TULETIS]** tähistab järeldust, mida ükski allikas otse ei ütle (nt AI-võrdlus), kuid mis tuleneb allikate põhimõtetest. Platvormi vasted on nimetatud ainult sidumiseks — nende tehniline seis on tõendatud ptk 1–11 ja seda siin ei korrata.

### Q1.0 Metodoloogiline tuum — invariandid, mida ükski liides ei tohi murda

Nelja allika ühisosa kokku võttes on Kovisiooni tuum **kaksteist invarianti**. Kõik ülejäänud (mudelivalik, etappide arv, ajaraamid, abivahendid) on kokkuleppe küsimus; need kaksteist ei ole.

1. **Struktuur ON meetod, mitte pakend.** Kovisiooni eristab vabast vestlusest just kokkulepitud etapiline struktuur, kus igal etapil on oma aeg ja fookus ([KJ] ptk 6: „Struktuur pole mõeldud osalejate ahistamiseks, vaid eelkõige tõhususe jaoks. Kõige ebatõhusamad on üldse ilma struktuurita arutelud“; [PJ] lk 5; [BM] lk 1). Empiiriline tugi: ainult *struktureeritud* (ametlik) kovisioon seostub parema stressiga toimetulekuga; vaba tööteemaline suhtlus mitte (T. Peiteli 2017 magistritöö viide, [KJ] ptk 8).
2. **Juhtumiomanik on oma loo ja lahenduse ainuekspert.** Grupp laiendab vaatenurki, kuid otsuse teeb ja lahenduse konstrueerib omanik ise; on täiesti aktsepteeritav, et ta ei kasuta ühtegi grupi ideed ([BM] lk 3; [PJ] lk 5, 8; [KJ] ptk 2 ja 6). Ta ei pea midagi õigustama ([PJ] lk 8) ja võib jätta küsimusele vastamata ([KJ] ptk 7).
3. **Nõu ei anta — jagatakse oma kogemust.** Lahendused sõnastatakse vormis „MINA teeksin…“, mitte „Sina peaksid…“ ([KJ] ptk 6; [LK] lk 7; [BM] lk 3). „Kõige suurem lõks kovisioonis on eksperdi rolli lõks“ ([KJ] ptk 4). ([PJ] keelekasutus on siin leebem — vt Q1.11.)
4. **Etapid on eraldatud: uurimine enne lahendusi.** Küsimuste etapis ei tohi peita soovitusi; lahenduste pakkumine enne uurimisfaasi lõppu on protsessiviga, millesse protsessijuht sekkub ([KJ] ptk 6; [PJ] lk 7; [LK] lk 7; [BM] lk 2–3).
5. **Kirjalik-vaikne individuaaltöö enne jagamist.** Küsimused ja lahendused pannakse esmalt vaikides kirja ja alles siis jagatakse — see annab võrdse aja, väldib grupimõtlemist ja tagab, et „ka kõige vaiksem grupiliige saab oma küsimuse esitatud ja lahenduse pakutud“ ([BM] lk 3; [KJ] ptk 6–7). [BM] lk 2 nimetab virtuaalse sessiooni vestlusakent selle otsese ekvivalendina.
6. **Hinnanguvabadus — ka varjatud kujul.** Ettepanekuid ei kommenteerita ega hinnata; hinnanguline on ka grimass, hääletoon, sildistamine, diagnoosimine ja isegi **kiitmine** probleemi jagamise peale ([KJ] ptk 4, R. Boltoni järgi; [LK] lk 3; [BM] lk 3–4). Ainus ette nähtud vastus panusele on „tänan“ ([KJ] ptk 6; [BM] lk 3).
7. **Võrdsus ja roteerumine.** Osalejad on sama hierarhiatasandi kolleegid; juhtimisrollid käivad ringi; püsirollidega grupp „kaotab aja jooksul oma efektiivsuse ja loovuse“ ([PJ] lk 8; [KJ] ptk 1–2; [LK] lk 10). Ülemuse kohalolu ja konkurentsisurve pärsivad avatust ([PJ] lk 9; [KJ] ptk 8).
8. **Vabatahtlikkus ja teadlik pühendumine.** Osalemist ei saa sundida; grupp sõlmib koostöölepingu ja grupikokkulepped, mille iga liige on läbi arutanud ja omaks võtnud ([PJ] lk 9; [KJ] ptk 3; [LK] lk 8, 13).
9. **Konfidentsiaalsus ja kinnine grupp.** Juhtumeid käsitletakse konfidentsiaalselt; grupp on püsiva koosseisuga ja kinnine; külaline ainult siis, kui see sobib kõigile; talletatakse ainult üldistatud jälg (kuupäev, osalejad, tööviis, teemad üldistatult), mitte juhtumi sisu ([PJ] lk 9; [KJ] ptk 3 ja 8, ESCÜ protokollinäide; [LK] lk 8–9).
10. **Refleksioon on võtmetegevus ja õppimine on kahesuunaline.** Sessioon lõpeb alati lõpuringiga, kus **iga** osaleja sõnastab oma õppimise; pärast omaniku kokkuvõtet juhtumit edasi ei lahendata ([KJ] ptk 1 ja 6–7: „Kogemus ilma mõtestamiseta on raiskamine“; [BM] lk 3; [LK] lk 7, 10, 14).
11. **Regulaarsus ja protsessilisus.** Kovisioon on korduv grupiprotsess samade osalejatega, mitte üksiksündmus; järgmisel kohtumisel vaadatakse, „kuidas on vahepeal läinud“ ([KJ] ptk 1 ja 3; [PJ] lk 10: mitte harvem kui 4 nädala tagant; [LK] lk 4, 10).
12. **Selged piirid:** ainult tööalased, omaniku enda reaalsed juhtumid; mitte teraapia, mitte suurte erimeelsuste ega grupisiseste konfliktide lahendamise koht; ei asenda koolitust ega supervisiooni ([PJ] lk 9; [KJ] ptk 1 ja 6).

### Q1.1 Kovisiooni eesmärk ja piirid

**Eesmärk.** Kõik neli allikat defineerivad kovisiooni sama viie tunnusega ([KJ] ptk 1 ja [LK] lk 3 sõna-sõnalt kattuvana): kokkulepitud formaadi alusel, sarnast tööd tegevate professionaalide grupis toimuv, refleksioonile suunatud õppimise protsess, eesmärgiga saada endast teadlikumaks ja leida lahendusi tööga seotud probleemidele ja väljakutsetele. Konkreetsemad sihid: õppida tundma iseennast ja oma reaktsioone, saada teadlikumaks oma tööalasest käitumisest, muuta mittetoimivaid mustreid, tulla paremini toime töösituatsioonidega ([BM] lk 2); emotsionaalne ja professionaalne tugi, läbipõlemise ennetamine, professionaalse mõtlemise areng ([LK] lk 3; [KJ] ptk 1 — kuulumine, võimestamine, eesmärkide tugi); murekoormast vabanemine ([PJ] lk 9).

**Sisulised piirid** (rikkumine muudab tegevuse millekski muuks kui kovisioon):

- **Ainult tööalased juhtumid.** Isiklikud mured ilma ametialase seoseta ei kuulu kovisiooni ([PJ] lk 9).
- **Ainult omaniku enda, reaalsed juhtumid** — juhtunud või lähiajal juhtumas; omanik peab olema olukorraga isiklikult seotud ja siiralt huvitatud ([KJ] ptk 6). Juhtumitüüpe on neli: aktuaalne väljakutse, mineviku õnnestumine, mineviku keeruline olukord, soovitud tulevikuolukord ([KJ] ptk 6) — st ka edukogemus on täisväärtuslik juhtum ([LK] lk 10 soovitab tuua ka kahtlusi ja edulugusid).
- **Mitte teraapia ega ravi.** Osalejad ei ole kvalifitseeritud nõustajad ega terapeudid ega tohi pakkuda ravialast abi; sellised teemad vajavad professionaali või arsti ([PJ] lk 9).
- **Mitte konfliktilahenduse instrument.** Suurte erimeelsuste jaoks tuleb otsida välist abi; grupisiseste suhete, konfliktide ja koostöö teemadega kovisioonis ei tegeleta, sest siis oleksid kõik osalejad ise juhtumiomanikud ehk emotsionaalselt seotud ([PJ] lk 9; [KJ] ptk 1).
- **Ei asenda** ametialast koolitust ([PJ] lk 9) ega teisi arenguvorme — kovisioon *täiendab* neid ([KJ] ptk 3, koostöölepingu näidisprintsiip 4); supervisioonist eristab väljaõppinud juhendaja puudumine (vt Q1.8).
- **Vabatahtlikkus** on eeltingimus, mitte soovitus ([PJ] lk 9; [KJ] ptk 1 ja 3).

### Q1.2 Osalejate rollid ja vastutus

Rollide kataloog on allikates eri detailsusega, kuid sama loogikaga. Kõige täielikum on [KJ] ptk 2, mis eristab **kuut rolli kolmel juhtimistasandil** (kui mõni on läbi rääkimata, „hakkab see grupi tööd segama“):

| Tasand | Roll | Vastutus | Allikad |
|---|---|---|---|
| Süsteem | **Koordinaator** | kovisioonisüsteem organisatsioonis: koolitused, supervisioonid, tugi; ise grupis ei osale | [KJ] ptk 2 |
| Grupp | **Grupijuht** | grupi algatamine, koostööleping, vahekokkuvõtted; kontakt koordinaatoriga | [KJ] ptk 2; [LK] lk 8–9 |
| Kohtumine | **Kohtumise juht** | roteeruv; logistika (ruum, ring, vahendid) + tervikprotsess (päevakava, avaring, ajakava, kokkuvõte) | [KJ] ptk 2–3 |
| Sessioon | **Sessiooni juht / moderaator** | ühe juhtumi arutelu juhtimine kokkulepitud mudeli järgi; aja- ja reeglivalve; turvalise õhkkonna hoidmine; **ei tohi olla juhtumiomanik** | [KJ] ptk 2; [PJ] lk 7–8; [BM] lk 2 |
| Sessioon | **Juhtumiomanik** | toob juhtumi, sõnastab küsimuse, vastab, kuulab, valib lahenduse, teeb kokkuvõtte | kõik neli |
| Sessioon | **Grupiliige / nõustaja** | kuulab, küsib, reflekteerib, jagab oma kogemust; peab kinni kokkulepetest | kõik neli |
| (valikuline) | **Protokollija** | märgib üles pakutud ideed, et omanik saaks keskenduda kuulamisele | ainult [PJ] lk 7–8 |

Vastutuse põhimõtted:

- **Juhtimine on jagatud ja roteeruv.** Kovisioonigrupil pole hierarhilist juhti — „kõik grupi liikmed täidavad kordamööda liidri rolli“ ([KJ] ptk 2); rollid jagatakse enne iga uue juhtumi arutamist ümber ([PJ] lk 8; [LK] lk 10). [KJ] ptk 2 kirjeldab kolme legitiimset juhtimisvormi (täielikult roteeruv; püsiva grupijuhiga; välise juhendajaga alustamine) koos riskide ja maandustega — valik sõltub grupi kogemusest.
- **Kollektiivne vastutus kokkulepete eest.** Iga grupiliige vastutab grupi toimimise eest; juhtimise eest vastutatakse kollektiivselt ([KJ] ptk 3).
- **Protsessijuht on neutraalne.** Grupijuht/sessioonijuht „ei ole ekspert ega probleemilahendaja, vaid neutraalne protsessi juhtija“ ([LK] lk 8); ideaalis ei paku ta ise lahendusi ([PJ] lk 8; [KJ] ptk 2 lubab kaasalöömist ainult siis, kui metoodika on kõigile selge — juhirolli arvelt mitte kunagi). Tema tähtsaim omadus on kohalolek: „roll seisneb rohkem olemises kui tegemises“ ([KJ] ptk 2).
- **Juhtumiomanik „teeb kõik õigesti“** — ta on aktsepteeritud sellisena, nagu ta on; samas ei tohi ka tema võtta grupi suhtes eksperdipositsiooni ega halvustada pakutud ideid ([KJ] ptk 2).
- Platvormi rollivaste: OWNER/CO_MODERATOR (LEADER) ≈ sessioonijuhi funktsioon, osalejad ≈ grupiliikmed. Platvormi OBSERVER-il ja SUMMARY_REVIEWER-il allikates otsest vastet ei ole — lähim on külaline/väline juhendaja, kes on lubatud ainult kõigi nõusolekul ([KJ] ptk 3; [PJ] lk 10). See tähendab: vaatleja lisamine sessioonile on metodoloogiliselt konsensuse-, mitte omaniku otsus.

### Q1.3 Protsessi põhifaasid

Allikad kirjeldavad protsessi **kolmel pesastatud tasandil** ([KJ] ptk 2) — seda kihilisust ei tohi liides kokku suruda:

1. **Grupi tervikprotsess** (kuud–aastad): loomine → eesmärk ja koostööleping → regulaarsed kohtumised → vahehindamised → lõpetamine ([KJ] ptk 2–3, 8; [PJ] lk 10, Zeileri 7-astmeline kasutuselevõtuskeem; [LK] lk 8).
2. **Üks kohtumine** (1,5–3 h): soojendus ja häälestus → avaring „kuidas on vahepeal läinud“ (sh eelmiste juhtumiomanike järelkaja) → juhtumi(te) valik → 1–2 juhtumisessiooni → kohtumise kokkuvõte ([KJ] ptk 3; [LK] lk 4; [BM] lk 2 avaring). Soojendust ei tohi ära jätta — kontakti arvelt aja kokkuhoidmine viib selleni, et „kellelgi pole juhtumeid“ ([KJ] ptk 6).
3. **Üks juhtumisessioon** (45–90 min): siin elavad mudelid.

Juhtumisessiooni **makrofaasid on invariantsed**: minimaalselt **olukord → uurimine → lahendused** ([KJ] ptk 6; [LK] lk 4), täiskujul kuus: olukord, küsimused, mõistmise süvendamine, lahendused, ressursid, õppimine ([KJ] ptk 6). Konkreetne mudel on kokkuleppe küsimus — [KJ] ptk 7 kirjeldab üle kümne mudeli (baasmudel, väljakutse-küsimustega, sokraatiline, ajurünnakuga, kliendi tugevustele suunatud, 10 sammu, konsultantide meeskond, ringlev diskussioon, rollikogemus, juhtumikliinik, kolm edumudelit, Gibbs, mõttekoda, GROW), [LK] lk 5–6 viit; kõik jaotuvad samadesse makrofaasidesse.

**Baasmudel** on kõigi nelja allika ühine tuummudel ja soovitatav alustuspunkt ([LK] lk 5: „Baasmudeliga on hea alustada“). Selle kanooniline kuju ([KJ] ptk 7, 8 etappi; sisult sama [BM] lk 2–3 ja [LK] lk 7):

| # | Etapp | Tuum | Aeg |
|---|---|---|---|
| 1 | Juhtumi kirjeldus ja küsimus | omanik räägib segamatult; sõnastab küsimuse „Kuidas…?“ ja **kirjutab selle nähtavale** | ~10 min |
| 2 | Grupiliikmete küsimused | **vaikides kirjalikult**, 1–2 küsimust; ainult küsimused, mitte varjatud soovitused | 3–5 min |
| 3 | Küsimustele vastamine | omanik vastab lühidalt; teemat ei arendata; korduvküsimustele teist korda ei vastata | ~10 min |
| 4 | Arutelu / refleksiooniring | omanik istub **eemale, kuulab, ei sekku**, teeb märkmeid; grupp avab loo kihte **ühisseisukohta otsimata**, hinnanguid andmata | ~10 min |
| 5 | Lahenduste kirjapanek | vaikides, vormis „MINA …“ | ~5 min |
| 6 | Lahenduste üleandmine | igaüks loeb ette (ka sarnased!) ja annab kirjapandu omanikule; omanik vastab ainult „tänan“ | 5–7 min |
| 7 | Juhtumiomaniku kokkuvõte | taipamised + järgmine samm; „vajan mõtlemisaega“ on täisväärtuslik vastus | 3–5 min |
| 8 | Grupiliikmete kokkuvõte (lõpuring) | iga osaleja oma õppimine; **juhtumit edasi ei lahendata, omanikule ideid ei lisata** | ~10 min |

Lisaetapp **jõustamine/ressursid** („Mina usun, et sa saavutad soovitu, sest …“) on [BM] lk 3 valikuline ja [KJ] ptk 6 sõnaselge soovitus *kõikide* mudelite juurde — platvormi 8-etapilise selgroo etapp 6 („Ressursid ja jõustamine“) on sellega kooskõlas.

Ajaraamid on osa meetodist (kindel ajaraam on baasmudeli tugevus, [BM] lk 3; kestused igas tabelis [PJ] lk 7, [LK] lk 7, [KJ] ptk 7), kuid neid valvab inimene (sessioonijuht), mitte kell iseseisvalt — vt Q1.10.

**Sügavuse kolm taset.** Sama mudel võib töötada kolmel sügavusel: 1) lahendused, 2) eneseteadlikkus, 3) transformatiivne muutus — sügavus sõltub grupi usaldusest ja refleksioonioskustest, mitte tööriistast; algajad alustavad tasemelt 1 ([KJ] ptk 6). Liides ei saa sügavust peale sundida — see kasvab grupiga.

### Q1.4 Juhtumi tooja, protsessi juhtija ja grupi ülesanded

**Juhtumiomanik (juhtumi tooja):**

- valmistab juhtumi ette, soovitatavalt kirjalikult (juhtumikirjeldus + toetavad küsimused: miks oluline, kes seotud, mida olen proovinud, mis on mu küsimus) ([KJ] ptk 6 ja 8) — platvormi Teemaseeme on selle ettevalmistuse digitaalne vorm;
- hindab avaringis oma motivatsiooni (nt skaala 1–10) juhtumi valimiseks ([BM] lk 2; [KJ] ptk 6);
- kirjeldab olukorda neutraalselt, lahendusi pakkumata ([LK] lk 7); sõnastab **ise** oma küsimuse — protsessijuhi (või kellegi teise) ümbersõnastus võib tabada valesti ja sulgeda omaniku ([KJ] ptk 6);
- vastab küsimustele lühidalt; võib jätta vastamata, kui vastus on liiga isiklik või pole veel küps ([KJ] ptk 7);
- refleksiooniringis kuulab eemal, sekkumata; lahenduste vastuvõtul tänab igaüht ilma kommenteerimata; kokkuvõttes sõnastab taipamised ja järgmise sammu; järgmisel kohtumisel jagab, kuidas on läinud ([KJ] ptk 3–4, 6; [BM] lk 3).

**Protsessi juhtija (sessioonijuht/moderaator):**

- tuletab enne igat etappi meelde selle eesmärgi ja reeglid („töösisend“) ([KJ] ptk 6);
- valvab aega ja mudelist kinnipidamist; sekkub kohe, kui ilmneb protsessi mittetoetav käitumine (hinnang, nõuanne küsimuse kujul, vaidlus, „agatamine“), kokkulepitud viisil (märk, sõna) ja ise hinnanguid andmata — „Ole vait!“ asemel „Aitäh, annan sõnajärje edasi“ ([KJ] ptk 2–3, 6);
- hoiab võrdset osalust ja hirmuvaba õhkkonda; loeb sessiooni lõpus rituaalid lõpuni (tänamised, lõpuring) ([KJ] ptk 6; [LK] lk 9);
- valmistab ette vahendid ja visuaalid (küsimus nähtaval, ideed kõigile näha) ([KJ] ptk 6);
- [PJ] lk 7 lisab: juhib meetodi valikut võtmeküsimuse jaoks ja langetab otsuse „kõikide osaliste heakskiidul“.

**Grupp (grupiliikmed):**

- annavad omanikule täieliku tähelepanu; kuulavad ka seda, mida ei öelda ([KJ] ptk 4 ja 7);
- kirjutavad küsimused ja lahendused vaikides valmis; loevad kõik ette, ka korduvad ([KJ] ptk 6);
- refleksiooniringis avavad loo eri kihte üksteise tähelepanekutele toetudes, ühisseisukohta otsimata; arvestavad, et info on paratamatult poolik, ja see on aktsepteeritud tööseisund ([KJ] ptk 6);
- jagavad lahendusi ainult „MINA …“ vormis ja oma kogemuse piirest; lõpuringis sõnastavad oma õppimise ([KJ] ptk 6–7);
- vastutavad ühiselt kokkulepete toimimise ja üksteise reeglipärase käitumise toetamise eest ([KJ] ptk 3).

### Q1.5 Küsimise, kuulamise, refleksiooni ja tagasiside põhimõtted

**Küsimine** ([KJ] ptk 5–6; [BM] lk 1):

- avatud küsimused on meetodi mootor — „ei anta nõu, vaid toetatakse arengut avatud küsimuste kaudu“ ([BM] lk 1);
- omaniku küsimus algab „KUIDAS…?“; „KAS…?“ ei sobi (grupp ei saa võtta omaniku eest vastutust) ja „MIKS ta nii käitus?“ ei sobi (otsitakse omaniku tegutsemisruumi, mitte teiste motiive) ([KJ] ptk 6);
- üks küsimus korraga; küsimusse ei peideta soovitust („Oled sa mõelnud, et võiksid…?“ on ettepanek, mitte küsimus) ([KJ] ptk 5–6);
- kirjalik sõnastamine enne esitamist teeb küsimuse täpsemaks ja maandab emotsioone ([KJ] ptk 6);
- hääletoon ja pehmendajad eristavad uurimist ülekuulamisest; omanik on ringis üksinda ja läheb järskude küsimuste peale kaitsesse ([KJ] ptk 5);
- skaalaküsimused (1–10) täpsustavad motivatsiooni, pühendumist ja edenemist ([KJ] ptk 5; [BM] lk 2);
- faktiküsimustest sügavamale viivad uurivad küsimused (olukord → omanik ise → lahendused; Diltsi tasandid keskkonnast missioonini) ([KJ] ptk 5).

**Kuulamine** ([KJ] ptk 4):

- väline kuulamine (fookus rääkijal, „tühi valge leht“) vs sisemine kuulamine (fookus iseendal) — kovisioon eeldab esimest;
- kuulatakse ka „sõnadetagust maailma“: keelekasutus, üldistused („alati“, „mitte kunagi“), valikute puudumise keel („pean“), piiravad uskumused;
- R. Boltoni kolm oskusrühma: tähelepanu väljendamine (kehahoiak, silmside, segajate vältimine — 85% suhtlusest on mitteverbaalne), jälgimisoskused (ukseavajad, väikesed julgustused, *vähesed* küsimused, tähelepanelik vaikimine), peegeldamisoskused (ümbersõnastamine, tunnete ja tähenduse peegeldamine, kokkuvõtlik peegeldamine);
- vaikus on tööriist, mitte tühimik: „Vaikuse vägi. Vaikus annab ruumi refleksioonile“ ([KJ] ptk 5); kui kõik töötavad individuaalselt, siis on vaikus ([KJ] ptk 6).

**Refleksioon:**

- refleksioon on kovisiooni võtmetegevus ja õppimise mehhanism ([KJ] ptk 1); grupp on „õppimise labor“ ja „heureka-hetkede labor“ ([KJ] ptk 1);
- refleksiooniring ilma omanikuta on baasmudeli sügavaim element: metatasandile minek, loo kihtide avamine, ühisseisukoha teadlik vältimine ([KJ] ptk 6–7; [BM] lk 3);
- individuaalne refleksioon on protsessi osa enne kohtumist (juhtumi valik), kohtumise ajal (märkmed) ja pärast (päevik, refleksioonileht pärast igat kohtumist) ([KJ] ptk 4; [LK] lk 10, 14);
- refleksiooni süvendamise raamistikud: õpieesmärgid (SMART), Petersoni „neli suunda“ ja „kuus ajaraamistikku“, Korthageni-Vasalose sibulamudel ([KJ] ptk 4).

**Tagasiside:**

- tagasiside on peegeldus ja kogemuse jagamine, mitte hinnang; hinnangulisuse neli varjatud vormi — kritiseerimine (ka mittesõnaline), sildistamine, diagnoosipanek, **kiitmine** probleemi peale — kõik kahjustavad ([KJ] ptk 4);
- jõustav tagasiside on suunatud omaniku tugevustele ja ressurssidele („Miks ma usun, et ta saavutab soovitu“) ([KJ] ptk 6; [BM] lk 3);
- protsessijuhile antakse tagasisidet ainult siis, kui ta seda soovib; tagasiside peab tegema saaja tugevamaks, mitte nõrgemaks ([KJ] ptk 3);
- negatiivse hinnangu hind on konkreetne: inimene ei julge enam avaldada arvamust ja järgmisel korral väheneb valmisolek osaleda ([BM] lk 4; [LK] lk 3 halva praktika näide).

### Q1.6 Turvalisuse, konfidentsiaalsuse ja nõusoleku piirid

- **Turvalisus luuakse teadlikult ja selle eest võetakse vastutus** — see ei teki iseenesest: selged rollid, ühiselt sõnastatud kokkulepped, hinnanguvabadus, võrdsus ([KJ] ptk 4; [LK] lk 8–9). Usaldus kasvab samm-sammult; mida suurem avatus, seda suurem haavatavuse risk, mistõttu reeglid on kaitsemehhanism ([KJ] ptk 4).
- **Konfidentsiaalsus on absoluutne baaskokkulepe** ([PJ] lk 9: „Loomulikult käsitletakse juhtumeid konfidentsiaalselt“; [LK] lk 8; [KJ] ptk 3 ja 8). Selle **tähendus tuleb grupis lahti rääkida** — ühele tähendab see nimede mittemainimist, teisele et „juhtumid jäävad 100% nende seinte vahele“ ([KJ] ptk 3). Kirjalik jälg on üldistatud: ESCÜ protokollinäites kuupäev, kestus, kohalolijad, tööviis ja teemad „üldistatult“ — mitte juhtumi sisu ([KJ] ptk 8).
- **Kinnine grupp.** Koosseis on püsiv; külalise kutsumine peab teenima grupi eesmärke ja sobima kõigile — kui üks liige tunneb end külalise tõttu ebamugavalt, tuleb kutsumisest loobuda ([KJ] ptk 3). Väline juhendaja/nõustaja on ajutine tugi, mitte püsiosaleja ([PJ] lk 10; [KJ] ptk 2).
- **Hierarhia- ja konkurentsivaba ruum.** Ülemuste kohalolu võib avatust pärssida; konkurentsisurve mõjub konfidentsiaalsele õhustikule halvasti ([PJ] lk 9); konkurentsikultuuris kovisioon ideoloogiliselt ei tööta ([KJ] ptk 8).
- **Nõusolek on mitmekihiline:** osalemine on vabatahtlik; pühendumine (kohalolek, nt 80–100%) lepitakse kokku ([KJ] ptk 3); tundlike juhtumite käsitlemise kord lepitakse kokku ette ([LK] lk 8); rolli kandmiseks küsitakse nõusolekut ([KJ] ptk 7, rollikogemuse mudel); omanik kontrollib ise, kui sügavale ta läheb — tal on õigus vastamata jätta ja protsess peab seda taluma ([KJ] ptk 7).
- **Kolmandate isikute kaitse.** Allikad käsitlevad konfidentsiaalsust eeskätt grupisisese saladusena; klientide anonüümimine juhtumi esitamisel on neis kaudne (tundlike juhtumite kord [LK] lk 8; üldistatud protokoll [KJ] ptk 8). Platvormi kohustuslik anonüümsuskinnitus enne jagamist on seega allikate vaimu range digitaalne tugevdus, mitte moonutus — digikeskkonnas, kus kirjalik jälg tekib paratamatult, muutub see kohustuslikuks kaitsekihiks [TULETIS].

### Q1.7 Tegevused, mis vajavad inimese teadlikku kinnitust

Allikatest tuletatav kinnituste kaart (platvormi olemasolev vaste sulgudes; see loend on metodoloogiline nõue, mitte tehniline spetsifikatsioon):

1. **Grupiga liitumine ja formaadile pühendumine** — vabatahtlik, kokkuleppega ([PJ] lk 9; [KJ] ptk 3). *(Vaste: kutse vastuvõtt, ACCEPTED-osalus.)*
2. **Grupikokkulepete ja koostöölepingu omaksvõtt** — iga liige arutab läbi ja nõustub; kokkulepe pole kehtiv, kui see on kellegi eest „ära täidetud“ ([KJ] ptk 3). *(Vaste: agreementConfirmedAt; kokkulepete sisu peab jääma grupi loodavaks, mitte süsteemi etteantuks.)*
3. **Rolli vastuvõtt igaks sessiooniks** — sh eksplitsiitne nõusolek rollimudelites rolli kanda ([PJ] lk 7; [KJ] ptk 7). *(Vaste: roleConfirmedAt.)*
4. **Juhtumi toomine ja jagamise ulatus** — omanik otsustab, mida ja kui palju avada; enne jagamist kontrollib, et lugu on jagamiskõlblik (tundlike juhtumite kord, [LK] lk 8). *(Vaste: seemne jagamisjärjekorda panek kohustusliku anonüümsuskinnitusega.)*
5. **Juhtumi valik sessiooniks** — motivatsiooni enesehindamine skaalal või eelnev kokkulepe; valik on inimeste, mitte algoritmi otsus ([BM] lk 2; [KJ] ptk 6).
6. **Küsimuse sõnastus** — ainult omanik ise; teiste (sh süsteemi) ümbersõnastus vajab tema kinnitust ([KJ] ptk 6).
7. **Etapi lõpetamine ja edasiliikumine** — protsessijuhi/grupi teadlik otsus, mitte taimeri või süsteemi automaatne käik; 10 sammu mudelis otsustab omanik, millal uurimisest „on küllalt“ ([KJ] ptk 6–7). *(Vaste: COMPLETE_STAGE on LEADER-i tegevus serveriväravatega.)*
8. **Lahenduse valik ja järgmine samm** — ainult omanik; „vajan mõtlemisaega“ on lubatud lõpptulemus ([KJ] ptk 6–7; [BM] lk 3; [PJ] lk 5). *(Vaste: etapi 7 omanikukinnitus, mis peab olema muudatustest värskem.)*
9. **Mis juhtumist säilib** — üldistatud jälg on kokkuleppe küsimus; kõik sisulisem kui üldistatud kokkuvõte vajab omaniku (ja grupi) otsust ([KJ] ptk 8). *(Vaste: omanikupakk CONFIRMED; detailide purge.)*
10. **Loo viimine grupist välja** — igasugune taaskasutus väljaspool gruppi (nt õppematerjaliks/praktikaks üldistamine) ületab konfidentsiaalsuspiiri ja vajab teadlikku, sisu nägevat kinnitust ([PJ] lk 9 + [KJ] ptk 3 ja 8 koosmõju) [TULETIS]. *(Vaste: praktikakandidaadi otsus sulgemisel + anonüümsuskinnitused + retsensiooniahel.)*
11. **Külalise/vaatleja lisamine** — kõigi liikmete sobivus, mitte ainult omaniku ([KJ] ptk 3).
12. **Tagasiside protsessijuhile** — ainult tema enda soovil ([KJ] ptk 3).
13. **Salvestamine/talletamine üldse** — allikad eeldavad vaikimisi, et arutelu sisu ei talletata sõna-sõnalt; iga püsiv jälg (sh transkriptsioon) vajaks kõigi osalejate eraldi nõusolekut [TULETIS konfidentsiaalsuspõhimõttest]. *(Vaste: platvormi nõusolekupõhine salvestusmuster; kovisiooni detailide kustutus sulgemisel.)*

### Q1.8 Mis eristab kovisiooni koosolekust, juhtumiarutelust ja AI-vestlusest

**Kovisioon vs tavaline koosolek / vaba arutelu.** [KJ] ptk 6 kirjeldab „niisama arutamise“ anatoomiat: etapid toimuvad juhuslikus järjekorras, räägitakse läbisegi, üks pakub kohe lahendust, teine lisab oma loo — paralleelsed monoloogid ilma fookuseta; jõutakse rääkida probleemist, aga mitte lahendusteni, mis toodab abitust; reegleid (sh konfidentsiaalsust) pole, mistõttu pool tundi hiljem võib kohvinurgas kõlada „Tead, mis ma kuulsin…“. Kovisioonis on etapid eraldatud, igal etapil oma aeg ja fookus, kõik saavad võrdselt ruumi ja kehtivad kokkulepped. Grupijuht ei luba arutelul muutuda „jututoaks“ ([LK] lk 9); vaba mõttevahetuse „refleksioon refleksioonile“ ohtu ohjab päevakava ([KJ] ptk 3).

**Kovisioon vs (ametlik) juhtumiarutelu/võrgustikukohtumine.** Kovisiooni tulemus ei ole otsus, menetlustoiming ega juhtumiplaan — see on juhtumiomaniku *õppimine ja järgmine samm*, mille ta ise valib. Omanik ei pea midagi õigustama ([PJ] lk 8); teda ei hinnata; arutelu käib teadlikult pooliku info tingimustes ja see on aktsepteeritud ([KJ] ptk 6). Fookus on tooja professionaalsel arengul, mitte kliendijuhtumi ametlikul lahendamisel — kliendi teemad kuuluvad ametlikesse kanalitesse (platvormi kontekstis: STAR2 jääb ametlikuks registriks; kovisioon ei tooda ametlikku kirjet).

**Kovisioon vs supervisioon/mentorlus.** Supervisiooni juhib alati väljaõppega superviisor, kes disainib protsessi kohapeal ja töötab ka grupi suhete, rollide ja kvaliteediteemadega; mentor on ekspert, kes jagab „mida ja kuidas teha“. Kovisioonis on kõik võrdsed, protsessi juhitakse kordamööda kokkulepitud mudeli järgi ja eksperdiroll jääb juhtumiomanikule ([PJ] lk 6; [KJ] ptk 1).

**Kovisioon vs AI-vestlus** [TULETIS — allikad AI-d ei käsitle; järeldused nende põhimõtetest]:

- AI-vestluse loomulik muster — küsid ja saad vastuse — on kovisiooni terminites *eksperdilõks puhtal kujul*: „lihtsalt nõu andmisest pole kasu, ent kui sa küsitled inimest ja suunad teda lahendust otsima, siis loob see palju suurema eelduse muutuseks“ ([KJ] ptk 1, neuroteaduse alapeatükk); „edukas muutusealgatus peab olema inimese enda oma“ ([KJ] ptk 1).
- Kovisiooni väärtus tekib **mitme sõltumatu inimperspektiivi** kõrvutamisest (iga liige kirjutab vaikides ise, grupimõtlemist välditakse — [KJ] ptk 7) ja **elavast grupist**: kuulumine, õlatunne, võimestumine, vastastikune õppimine ([KJ] ptk 1). Üks vastaja — ka väga hea — ei ole grupp; tal pole isiklikku professionaalset kogemust, mida „MINA teeksin“ vormis panustada, ega õppimist, mida lõpuringis jagada.
- Kovisioon on *aeglustatud* protsess (vaikus, kirjutamine, kuulamisjärjekord), sest aeglus ongi taipamiste mehhanism; AI-vestlus optimeerib vastuse kiirust. Need on vastandlikud disainisihid.
- Sellest ei järeldu, et AI-l pole platvormil kohta — vaid et tema legitiimne koht on protsessi *teenindamine* (logistika, meeldetuletused, etapijuhiste esitamine, kasutaja enda sõnade mustandituge), mitte arutelus osalemine, küsimuste-lahenduste genereerimine ega omaniku eest kokkuvõtete tegemine. See ühtib platvormi püsireegliga „AI teeb ainult mustandeid; inimene kinnitab“, kuid kovisiooni sees on latt kõrgemal: sisuline panus peab tulema inimestelt (vt Q1.10).

### Q1.9 Metodoloogilised põhimõtted, mis peavad digitaalses kasutajaliideses nähtavad olema

Allikad ütlevad korduvalt, et meetod töötab ainult siis, kui osalejad *näevad ja teavad*, kus nad protsessis on ja mis reeglid parasjagu kehtivad. Digitaalne liides peab seega tegema nähtavaks (mitte ainult jõustama serveris):

1. **Aktiivne etapp ja faas + selle etapi „töösisend“** — mida praegu tehakse, mida tohib ja mida (veel) ei tohi (nt „praegu ainult küsimused, lahenduste jaoks on oma etapp“) ([KJ] ptk 6; [LK] lk 7). Sessioonijuhi etapi-meeldetuletus on allikais inimese ülesanne; liides võib seda toetada, mitte asendada.
2. **Rollid selles sessioonis** — kes on juhtumiomanik, kes juhib protsessi, kes on grupiliikmed; rollid määratakse enne algust ja on kõigile teada ([PJ] lk 7–8; [LK] lk 5).
3. **Juhtumiomaniku küsimus püsivalt nähtaval** — digitaalne ekvivalent A4-lehele markeriga kirjutatud ja seinale pandud küsimusele; kui küsimus pole silme ees, kaob grupi fookus ([KJ] ptk 6, sh näide, kus grupp hakkas arutama töötaja vallandamist, kuigi omanik küsis juhtimise kohta). *(Vaste: case_anchor-tüüpi tööobjekt.)*
4. **Etappide ajaraamid** — soovitusliku raamina, mida inimene juhib ([BM] lk 3; [LK] lk 7).
5. **Vaikne-kirjalik individuaalfaas** — liides peab eristama „igaüks kirjutab privaatselt“ seisundit „jagame ja loeme ette“ seisundist; privaatne mustand ei tohi enne jagamishetke kellelegi paista ([KJ] ptk 6–7; [BM] lk 2–3). *(Vaste: CovisionPrivateState, mille serializer laadib ainult vaataja omad.)*
6. **„MINA …“ vorm lahendustel** — sisendiväli/juhis, mis kannab vormi ette ([KJ] ptk 6; [LK] lk 7).
7. **Hinnanguvaba tsoon** — teiste panuste peal ei tohi olla hindamis- ega reaktsioonimehhanisme (meeldimised, emotikonid, skoorid); ainus ette nähtud vastus on „tänan“ ([KJ] ptk 4 ja 6). Tavapärane sotsiaal-UI muster oleks siin otsene metodoloogia rikkumine.
8. **Refleksiooniringi eristaatus** — omanik on kohal ja kuuleb kõike, kuid ei saa sekkuda; grupp ei saa teda kõnetada; nähtav peab olema ka reegel „ühisseisukohta ei otsita“ ([KJ] ptk 6; [BM] lk 3).
9. **Grupi kokkulepped kättesaadavad ja meeldetuletatavad** — kokkulepped on grupi enda loodud tekst, mille juurde protsessijuht saab sekkumisel viidata ([KJ] ptk 3; [LK] lk 8, 13).
10. **Kinnisus ja konfidentsiaalsus nähtavana** — kes on ruumis, kes näeb, mis jälg jääb (üldistatud kokkuvõte) ja mis kustub ([KJ] ptk 8; [LK] lk 13: „valin sobiva füüsilise või digitaalse ruumi“ — digitaalne ruum on allikas endas ette nähtud).
11. **Lõpetamise rituaalid** — omaniku kokkuvõte, tänamine, lõpuring, ja pärast lõpuringi juhtumi *suletus* („juhtumit edasi ei lahendata“) peab olema liideses lõplik seisund, mitte soovitus ([KJ] ptk 7; [BM] lk 3). *(Vaste: sulgemisjärgne actioni-lukk.)*
12. **Järelkaja järgmisel kohtumisel** — „kuidas on vahepeal läinud“ on protsessi osa, mitte lisafunktsioon ([KJ] ptk 3–4). *(Vaste: järeltegevus/FollowUp ja Lõpetatud juhtumid.)*
13. **Ettevalmistuse koht** — omaniku kirjalik ettevalmistus enne sessiooni ([KJ] ptk 6 ja 8) ning iga osaleja individuaalne refleksioon enne/järel ([LK] lk 10, 14). *(Vaste: Teemaseeme; refleksioonileht on kontseptsioonina katmata — see on tähelepanek, mitte auditileid.)*

### Q1.10 Mida ei tohi automatiseerida, kiirendada ega muuta pelgaks vormitäitmiseks

1. **Omaniku küsimuse sõnastamist.** Isegi inimesest sessioonijuhi ümbersõnastus võib olla vale ja panna omaniku kaitsesse ([KJ] ptk 6) — AI eeltäide oleks sama vea automatiseeritud vorm. AI võib pakkuda tuge ainult omaniku enda sõnade peegeldamisena ja tulemus vajab tema kinnitust.
2. **Küsimuste, lahenduste ja peegelduste genereerimist.** Panuste väärtus on selles, et need on *konkreetsete kolleegide isiklik professionaalne kogemus* („mida MINA teeksin“) — genereeritud sisu ei kanna vastutust ega kogemust ja õõnestab „kingituse“ loogikat ([KJ] ptk 2 ja 6). ([KJ] ptk 7 „väljakutse küsimustega mudel“ näitab, et *valmis küsimuste pank*, millest inimesed valivad ja mida nad kohandavad, on legitiimne abivahend — valiku ja esitamise teeb inimene.)
3. **Jõustamist ja tagasisidet.** „Mina usun, et sa saavutad soovitu, sest…“ on väärtuslik ainult inimeselt tulles ([BM] lk 3; [KJ] ptk 6).
4. **Omaniku kokkuvõtet ja taipamisi.** Taipamine peab tulema seestpoolt, „mitte etteantud valmis järeldusena“ ([KJ] ptk 1); süsteemi genereeritud „kokkuvõte sinu õppimisest“ oleks meetodi tuuma otsene moonutus.
5. **Etappide läbimist ja tempot.** Taimer võib olla nähtav, kuid etappi ei lõpeta kell ega süsteem — selle otsustab inimene, kui etapi sisu on täidetud ([KJ] ptk 6–7). Vaikuse- ja kirjutamisminutid ei ole „ooteaeg“, mida optimeerida; need on meetodi tööosa („Kui on vaikus, siis on vaikus“, [KJ] ptk 6). Kiirendamine kontakti arvelt viib selleni, et „kellelgi pole juhtumeid“ ([KJ] ptk 6).
6. **Kinnitusi.** Iga Q1.7 kinnitus peab kandma sisulist otsust; kui kinnitused muutuvad läbiklikitavateks linnukesteks, kaob kokkulepete kaitsev jõud — kokkulepete *sõlmimise protsess* on sama oluline kui nende sisu ([KJ] ptk 3). Liides peab hoidma kinnitused harvad, tähenduslikud ja tagajärgedega seotud, mitte lisama neid igale sammule [TULETIS].
7. **Juhtumi ja juhtumiomaniku valikut.** Motivatsiooniskaala on enesehinnang; süsteem ei järjesta ega vali inimeste eest ([BM] lk 2; [KJ] ptk 6).
8. **Grupikokkulepete sisu.** Näidised on lubatud lähtekohad ([KJ] ptk 3 näidislepingud), kuid kokkulepped peab grupp ise sõnastama ja tähenduseni lahti rääkima — etteantud, muutmatu „reeglileht“ oleks vormitäide.
9. **Osaluse ja „edu“ mõõtmist.** Edetabelid, kiiruse/aktiivsuse skoorid, võrdlusstatistika osalejate või gruppide vahel tooksid sisse konkurentsisurve, mis on allikais otsesõnu kahjulik ([PJ] lk 9; [KJ] ptk 8). Ka automaatne „konstruktiivsuse“ hindamine oleks hinnangu andmise automatiseerimine — keelatud tsoonis.
10. **Sisu talletamist vaikimisi.** Vaikeseis on kustumine ja üldistatud jälg; sõnasõnaline salvestus/transkriptsioon ainult kõigi teadlikul nõusolekul ([KJ] ptk 8; Q1.7 p 13). *(Platvormi purge-sulgemine on selle põhimõttega kooskõlas.)*
11. **Kohaloleku fiktsiooni.** „Present“ ei tohi tähendada „aken on lahti“ — kohalolek on allikais teadlik seisund (mobiilid välja, [KJ] ptk 8; kohalolu kui sessioonijuhi tähtsaim omadus, [KJ] ptk 2). Valmisoleku kinnitus peab jääma inimese teadlikuks tegevuseks.

### Q1.11 Allikate omavahelised erinevused ja vastuolud

1. **Nõuandmise lubatavus — ainus sisuline paradigmaerinevus.** [PJ] (Tietze/Zeileri saksa „kollegiale Fallberatung“ traditsioon) kasutab läbivalt sõnu „nõustajad“ ja „nõuanded“ ning lubab meetodina ka „hea nõu“ ja „tegevuste soovitused“ (lk 7–8); [KJ] ja [BM] (coaching-traditsioon) keelavad nõu andmise põhimõtteliselt — nõuandmine on „juhtumiomaniku rumalamale positsioonile asetamine“ ([KJ] ptk 4) — ja nõuavad „MINA teeksin“ vormi; [LK] on vahepealne (lk 3 kasutegurites „anda ja saada praktilisi lahendusideid“, kuid lk 3 halva praktika näide hukkamõistab „konkreetsete soovituste andmise“ ja lk 7 tabel kasutab „Mina teeksin…“ vormi). **Ühisosa, mis lahendab vastuolu:** ka [PJ] järgi austavad nõustajad omaniku vaatenurka, pakuvad võimalikult *erinevaid* lahendusi ja omanikul on „vabad käed“ (lk 5, 8); üheski allikas ei kommenteerita ega hinnata ettepanekuid ja otsus jääb omanikule. Platvormil on põhjendatud järgida rangemat ([KJ]/[BM]) vormi, sest see kaitseb ka nõrgema grupikultuuri korral — leebem vorm on rangema alamhulk, vastupidi mitte.
2. **Etappide arv ja liigendus.** [PJ] 6 etappi (sh eraldi „meetodi valik“); [LK] 5-etapiline struktuur (tabelis 6 rida); [BM] 6 etappi + valikuline võimestamine; [KJ] baasmudel 8 etappi ja teised mudelid 5–10. Vastuolu pole: kõik jagunevad makrofaasidesse olukord → uurimine → lahendused (+ õppimine), mida [KJ] ptk 6 ja [LK] lk 4 ütlevad otse. Platvormi 8-etapiline selgroog kattub [KJ] baasmudeli liigendusega ja mahutab teiste allikate lühemad mudelid; metodoloogiliselt oluline on, et kasutatav mudel oleks grupile *nähtav ja kokkulepitud*, mitte varjatud töövoog.
3. **Juhtumiomaniku valik.** [BM] lk 2: avaringi motivatsiooniskaala (kõige motiveeritum saab fookuse); [KJ] ptk 6 ja [LK] lk 4: nii eelnev kokkulepe kui kohapealne valik (hääletus, skaala, arutelu) on võrdväärsed, kord fikseeritakse koostöölepingus. Platvormi jagamisjärjekord teostab „eelneva kokkuleppe“ variandi; skaalapõhine kohapealne valik on allikais sama legitiimne.
4. **Protsessijuhi kaasalöömine sisus.** [PJ] lk 8: moderaator ideaalis ei anna nõu; [LK] lk 9: grupijuht on ka „küsimuste küsija“; [KJ] ptk 2: sessioonijuht võib sisutöös osaleda ainult siis, kui metoodika on kõigil selge, ja juhiroll on alati esmane. Kergelt erinevad rõhud, mitte vastuolu.
5. **Grupi koosseis.** [PJ] lk 6 lubab eri valdkondade spetsialiste (soovitavalt sama hierarhiatasand); [KJ] ptk 1 ja [LK] lk 3 rõhutavad sama valdkonna / sarnase rolli gruppi. Ühine miinimum: võrdne positsioon ja samalaadsed töökogemused.
6. **Protokollija ja kirjalik jälg.** Ainult [PJ]-l on protokollija roll (lk 7–8, ideede üleskirjutajana omaniku heaks); [KJ] ptk 8 näeb ette üldistatud protokolli kvaliteedisüsteemi jaoks; [LK] ja [BM] kirjalikku jälge ei nõua (sedelid antakse omanikule kaasa). Konsensus: kirjapandu kuulub omanikule, püsiv jälg on üldistatud.
7. **Suurus ja kestus (väike hajuvus).** Grupp: 6–10 ([PJ] lk 10), 5–7 „hästi töötav“ / 4–8 ([KJ] ptk 1 ja 8), 4–8 ([LK] lk 4). Juhtum: 45–60 min ([PJ] lk 10), ~60 min ([BM] etappide summa), kuni 90 min ([LK] lk 4), 1,5–2 h sessioon ([KJ] ptk 8). Praktiline konsensus: 4–8 inimest, üks juhtum 45–90 min.
8. **Terminoloogia.** „Grupijuht“, „moderaator“, „sessioonijuht“ ja „kohtumise juht“ tähistavad allikates osalt sama, osalt eri rolle — [KJ] ptk 2 neljatasandiline eristus on kõige täpsem ja sobib platvormi mõistekaardi aluseks; teiste allikate „grupijuht/moderaator“ katab tavaliselt korraga kohtumise ja sessiooni juhi funktsiooni.
9. **Autorlus ja staatus.** [KJ] on isiklikus toonis käsiraamat (kogemuslood, ESCÜ näited), [LK] riigiasutuse ametlik juhend (mis viitab kirjanduses Vesso töödele), [PJ] EL-projekti tõlkematerjal (viitab Wikipediale ja saksa allikatele), [BM] koolitaja turundusartikkel. Sisulises tuumas nad ei vastandu; usaldusjärjekord detailiküsimustes: [KJ] (sügavaim) → [LK] (valdkondlik ametlik) → [PJ] → [BM].

### Q1.12 Kokkuvõte: mõõdupuu edasisele disainile

Iga tulevane kovisiooni-liidese otsus (sh ruumiline) tuleb kontrollida Q1.0 kaheteistkümne invariandi vastu; Q1.9 loetleb, mis peab olema *nähtav*, Q1.10 selle, mida ei tohi *automatiseerida*, ja Q1.7 kinnitused, mis peavad jääma *inimese teadlikeks otsusteks*. Kõige suurem digitaalse keskkonna spetsiifiline risk ei ole allikate järgi mitte funktsiooni puudumine, vaid harjumuspäraste UI-mustrite (reaktsioonid, soovitused, autotäide, kiirus- ja aktiivsusmõõdikud, automaatsed kokkuvõtted, vaikimisi talletamine) märkamatu sissetung, millest igaüks rikub mõnd invarianti. Ruumilise disaini ettepanekuid selles peatükis teadlikult ei tehta.

### Q1.13 Avatud metodoloogia-tooteotsused

1. **KOV-Q1-DEC-1 — grupi ja kohtumise elutsükli ulatus.** Allikad käsitlevad kolme pesastatud tasandit: püsiva grupi tervikprotsess, üks kohtumine ning üks juhtumisessioon. Aktiivne platvorm katab peamiselt juhtumisessiooni. Otsustada tuleb, kas tulevane Kovisiooni toode hõlmab ka grupi koostöölepingut, püsivat koosseisu, regulaarseid kohtumisi, avaringi „kuidas on vahepeal läinud“ ja grupi lõpetamist või jääb teadlikult üksiksessiooni tööriistaks. Ruumiline disain ei tohi kujutada neid tasandeid valmis funktsioonidena enne otsust.
2. **KOV-Q1-DEC-2 — OBSERVER-i metodoloogiline alus.** Allikates pole platvormi OBSERVER-rollile otsest vastet. Lähim analoog on külaline või ajutine väline juhendaja, kelle lisamine eeldab kogu grupi sobivust ja konsensust. Otsustada tuleb, kas OBSERVER eemaldada/ümber nimetada või muuta tema lisamine kõigi aktiivsete osalejate teadlikku nõusolekut nõudvaks tegevuseks.
3. **KOV-Q1-DEC-3 — nõuandmise paradigma.** Allikate ainus sisuline paradigmaerinevus on nõuannete lubatavus. KOV-Q1 soovitab lukustada rangema coaching-vormi: „Sina peaksid“ nõuande asemel jagab iga osaleja oma kogemust vormis „MINA teeksin“. See soovitus vajab enne lõpliku sisestus- ja juhendikeele kinnitamist teadlikku tooteotsust.

*Peatükk KOV-Q1 lisatud 14.07.2026 hilisõhtul; põhineb ainult neljal loetletud allikal (loetud täies mahus) ja seob need platvormi olemasolevate mõistetega ilma koodi muutmata ja ptk 1–11 tehnilist sihtkontrolli kordamata.*
