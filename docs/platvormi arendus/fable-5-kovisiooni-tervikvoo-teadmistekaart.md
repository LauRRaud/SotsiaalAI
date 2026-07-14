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
