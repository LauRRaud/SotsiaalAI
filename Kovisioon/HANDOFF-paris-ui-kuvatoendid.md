# HANDOFF: päris-UI kuvatõendid (Kovisiooni 8 etappi + 2 lehte)

Seis: 15.07.2026 — **kuvatõmmiseid VEEL EI OLE**; kogu tehniline luure on TEHTUD ja kontrollitud koodist. See fail on täielik retsept, millega järgmine aken saab töö kohe lõpule viia ilma koodi uuesti lugemata.

Eesmärk: teha aktiivse `main`-i PÄRIS kasutajaliidese kuvatõmmised (PNG-mockupid selles kaustas on kavatsus, mitte tegelik seis) ja salvestada need siia kausta:
`paris-ui-etapp-1.png … paris-ui-etapp-8.png`, `paris-ui-lopetatud-juhtumid.png`, `paris-ui-parimad-praktikad.png`.

## Miks mitte brauseripaan

- KOV-LIMIT-1 (teadmistekaart ptk 9): paanis selle rakenduse klient-hüdratsioon EI käivitu → lehed jääks SSR-0 seisu.
- Mälu: paani screenshotid ruumitaustaga lehtedel timeout'ivad.
- → Kasuta **playwright-core + installitud Chrome**: `require('playwright-core')` TÖÖTAB (repo devDeps: @playwright/test); Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`; launch `chromium.launch({ channel: 'chrome', headless: true })`, viewport 1600×900, locale 'et-EE'. Kui Galaxy WebGL-taust on mustaks jäänud → proovi `headless: false`.
- Dev-server AINULT `preview_start` config'iga `next-dev` (CLAUDE.md; port 3000). Ära kasuta Bash `npm run dev`.

## Autentimine (kontrollitud koodist)

- `LoginTempToken` (schema:1380): { userId, tokenHash (unique), requiresOtp:false, expiresAt } — loo rida otse DB-sse; `hashOpaqueToken` = **paljas sha256 hex** (lib/auth/pin-login.js:82–87), saladust pole.
- Sisselogimine: `GET /api/auth/csrf` → `POST /api/auth/callback/credentials` (form: `csrfToken`, `temp_login_token`) → session-cookie. NextAuth authorize (auth.js:182–231) märgib tokeni `usedAt` — **iga login-kontekst vajab OMA tokenit** (vaja 2–3: draiver-omanik, playwright-omanik, [draiver-B]).
- Playwrightis: `context.request` jagab küpsisejarre brauserikontekstiga → tee csrf+callback läbi `context.request`, siis `page.goto` on sisse logitud.
- Prisma skriptist: klient genereeritud kausta `generated/prisma` (schema generator output; lib/prisma.js impordib `../generated/prisma/client.ts`) → jooksuta draiver **`npx tsx`**-iga ja impordi `lib/prisma.js` (nagu eelmise sessiooni e2e). DATABASE_URL on `.env`-is (localhost:5432/sotsiaal_ai).

## Kontod

- Omanik: `codex.spatial.test@local.invalid` — praegu ADMIN; **sea shoot'i ajaks role='SOCIAL_WORKER'** (canUseCovisionRole lubab SOCIAL_WORKER|SERVICE_PROVIDER|admin; lehe värav lib/covision.js:433). Soovi korral realismiks firstName='Mari' (User.firstName, schema ~:755). **Taasta pärast mõlemad!**
- B (valikuline 2. osaleja): `claude.admin@sotsiaal.ai` (ADMIN → lubatud). Üks osaleja on väravate jaoks piisav; B annab rikkama rollipaneeli.

## Rada seemnest juhtumini

1. `POST /api/topic-seeds` — kohustuslikud: title≤80; contextType∈ adult|child|family|couple|network|other; caseType∈ current|success|past|future; whyNow≤300; requestedSupport[]⊆ understanding|perspectives|role|boundaries|network|method|ethics|paths|next_step|success_learning|other; importance 1–10; safetyGate∈ no_immediate_risk|risk_unknown|intervention_started|risk_assessed.
2. `POST /api/topic-seeds/{id}/queue` body `{ "confirmedNoIdentifiers": true }` (kohustuslik).
3. `POST /api/topic-seeds/{id}/covision` body `{}` → vastuses covisionCaseId.
4. UI: **`/kovisioon?case=<covisionCaseId>`** (CovisionWorkspace loeb `?case=`; components/covision/CovisionWorkspace.jsx:199). Lehed: `/lopetatud-juhtumid`, `/parimad-praktikad`.

## Sessiooni API

- `GET /api/covision/{id}/session` → `{ ok, ...session }` (sh `version`, `stage`, `phase`).
- `POST /api/covision/{id}/session/actions` body `{ action, expectedVersion, payload }`. Iga õnnestunud action tõstab versiooni 1 võrra; vastus sisaldab uut sessiooni.
- Actionid (lib/covisionSession.js:1065–1240): START_SESSION (leader); CONFIRM_SETTINGS (leader, ainult stage 1, üks kord, ENNE agreement/ready kinnitusi); CONFIRM_CASE (ainult OWNER); CONFIRM_PARTICIPANT `{present:true, roleConfirmed:true, agreementConfirmed:true, ready:true}` (ready nõuab role+agreement olemasolu); INVITE_PARTICIPANT (leader; omanikku EI saa kutsuda); SET_PHASE `{phase}` — **ainult sama või JÄRGMINE** faas COVISION_STAGE_PROGRESS_PHASES rajal (hüpe/tagasi → 409); SUBMIT_WORK_ITEM `{kind, status, content, sourceLabel?, order?}` (visibility sunnitakse 'shared'; korraga max 1 'active'); SAVE_PRIVATE_STATE `{kind, content}` (upsert kind'i kaupa); UPDATE_WORK_ITEM; COMPLETE_STAGE `{stage, phase, expectedVersion, evidence:{}}` — stage==session.stage JA phase==session.phase==lõpetamisfaas; tõendid arvutab server ise; PAUSE/RESUME.

## Lõpetamisfaasid (COMPLETE_STAGE phase-väärtus)

1 ready_to_open_case · 2 ready_to_explore · 3 ready_to_continue · 4 ready_for_possibilities · 5 ready_for_resources · 6 ready_for_selection · 7 case_work_completed · 8 final_review

Edasiliikumise faasirajad (SET_PHASE ükshaaval läbi): lib/covisionSessionShared.js:125–165 (COVISION_STAGE_PROGRESS_PHASES). Etapi N lõpetamine viib etapi N+1 ESIMESSE faasi automaatselt.

## Väravanõuded etapi kaupa (mida draiver peab looma ENNE COMPLETE_STAGE)

Kõik "owner private" = SAVE_PRIVATE_STATE omanikuna antud kind'iga; boolean-lipud loetakse content'i võtmetest (firstContentValue).

- **1:** kõik ACCEPTED osalejad present+role+agreement+ready; CONFIRM_CASE; CONFIRM_SETTINGS. (Järjekord: START_SESSION → CONFIRM_SETTINGS → CONFIRM_CASE → CONFIRM_PARTICIPANT.)
- **2:** shared work item kind='case_anchor' (+ rikkuseks: person_perspective, prior_action, described_outcome, worker_observation, worker_interpretation, desired_change — lubatud kinds vt STAGE_WORK_OBJECT_KINDS[2], shared.js:188–207); owner private: `{ownerPictureConfirmed:true}`, `{ownerFocusConfirmed:true}`, `{privacyReviewed:true}` (privacyReviewed loeb omanikult, kui SUMMARY_REVIEWER-it pole).
- **3:** shared kind='question' (content nt `{question:"…", text:"…"}` — **text-võti oluline**, closure workFocus loeb stage-3 question/open_question tekstist); owner `{ownerEnough:true}`.
- **4:** shared kind='reflection'; owner `{ownerReady:true}`.
- **5:** shared kind='possibility' (tee 4–5 tk, status 'shared'); ÜKSKI item ei tohi olla status 'active'; owner `{ownerResonanceReady:true}`.
- **6:** shared kind∈ resource|supporting_condition|required_condition (+ barrier; critical_prerequisite AINULT koos content.resolutionStatus∈ satisfied|check_step|blocks_path|not_applicable|resolved); ei ühtegi 'active'; owner `{impactReviewed:true}` ja `{ownerReady:true}`.
- **7 (owner private, TÄPSED kujud testist sessionService.test.js:904–929):**
  - kind 'selected_direction': `{selectedDirection:"…"}`
  - kind 'next_step': `{nextStep:{text:"…", actorType:"owner", withinOwnerInfluence:true}, timeframe:"2026-07-24"}` (timeframe võib olla siin)
  - kind 'progress_marker': `{progressMarker:"…"}`
  - kind 'follow_up': `{followUp:{when:"2026-07-24", responsibleParty:"owner", channel:"platform"}, ownerConfirmed:true}` — **salvesta VIIMASENA** (värskuskontroll: follow_up.updatedAt ≥ teiste 7-kindide updatedAt; iga hilisem muudatus nullib kinnituse).
- **8:** owner private lipud: `{packageConfirmed:true}`, `{followUpConfirmed:true}`, `{generalizationDecision:"completed"}`, `{learningDecision:"completed"}`, `{retentionDecision:"retain"}`, `{practiceDecision:"create_draft"}`, `{ownerFinalConfirmed:true}`; shared work itemid: kind='owner_package' (status 'owner_confirmed'), kind='group_generalization' (content.text → saab closure'i üldistatud PEALKIRJAKS), kind='practice_candidate_decision' (status nt 'shared'). Lubatud kinds: owner_package, learning_note, process_reflection, group_generalization, topic_seed_follow_up, retention_decision, practice_candidate_decision.
- Countable statused (värav loeb): shared_draft, ready, queued, shared, completed, answered, open, owner_confirmed, resolved, not_applicable, parked, closed.
- **Etapi 8 COMPLETE teeb atomaarse sulgemise + PURGE** (detailid kustuvad, case→CLOSED, seeme→FOLLOW_UP, tekib CovisionClosure+FollowUp+OwnerPackage+EffectivePractice DRAFT). Seega **iga etapi kuvatõmmis tuleb teha ENNE selle etapi COMPLETE'i** (lõpetamisfaasis, kui sisu + kinnitused on koos ja CTA aktiivne).

## Skripti skelett (üks tsx-orkestraator, nt scratchpadis)

1. Loe .env; impordi lib/prisma.js (tsx). Salvesta originaalid: omaniku {role, firstName} → restore-fail.
2. Sea omanik SOCIAL_WORKER (+nimi); mint 2–3 LoginTempTokenit (sha256).
3. Node-fetch cookie-jar login (draiver) + playwright context login.
4. Seeme (sisu à la mockup: pealkiri "Katkendlik kooliskäimine", context 'child', caseType 'current', whyNow, support ['role','next_step'], importance 8, safetyGate 'no_immediate_risk') → queue → covision start.
5. Tsükkel etapp 1..8: draiveri actionid (ülal) → SET_PHASE'id lõpetamisfaasini → `page.goto('/kovisioon?case=ID')` + wait (nt selektor `.cvw-` klassid / networkidle) → screenshot `paris-ui-etapp-N.png` → COMPLETE_STAGE.
6. Pärast 8: goto `/lopetatud-juhtumid` → screenshot; goto `/parimad-praktikad` → screenshot (kandidaat on "Minu kandidaadid" vaates; vajadusel kliki tab — päris Chrome'is hüdratsioon töötab).
7. **Kontrolli pilte Read-tööriistaga** (kas hüdratsioon toimus: nimed, loendurid ≠ 0, taust olemas).
8. Koristus (eelmise sessiooni muster, teadmistekaart ptk 10): kustuta EffectivePractice (draft), CovisionClosure (cascade: followUps, ownerPackage), CovisionCase (cascade: participants, session, snapshotid), TopicSeed(id), LoginTempTokenid, meie ID-dega DataDeletionJob read kui tekkisid; taasta kasutaja role (ADMIN) + firstName.

## Lõksud

- Tokenid on ühekordsed; CONFIRM_SETTINGS enne agreement/ready; COMPLETE payload.phase peab võrduma hetkefaasiga; SET_PHASE ei luba hüpata; 5.–6. etapis ei tohi 'active' itemit jääda; follow_up-kinnitus viimasena; omanikku ei saa kutsuda osalejaks; expectedVersion käib igas actionis kaasa (võta GET-ist või eelmise vastuse versioonist).
- Kuvatõmmised → SEE kaust; ära pane repo juurde ega scratchpadi.
- Pärast valmimist: lisa teadmistekaardi KOV-Q2 algusse 1 rida, et päris-UI tõendid on olemas (failinimed), ja too välja peamised erinevused mockupitest.
