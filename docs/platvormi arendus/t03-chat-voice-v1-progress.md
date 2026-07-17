# T03 `CHAT-VOICE-V1` — teostuse progressifail

## Alus ja stack (kohustuslik konfliktimärge)

- **Alus-SHA (T17 lõpp):** `ed95d6aa` — "Complete T17: owner-scoped personal search + plain-language reading aid".
  Kontrollitud: `origin/codex/search-language-v1` = `ed95d6aa` (remote == lokaalne).
- **Worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-chat-voice-v1`, haru `codex/chat-voice-v1` (loodud `origin/codex/search-language-v1` headist).
- **VEST-P0 cherry-pick:** algne `ef01fc42e77511c0a6a931358ef8df3fa722ca9a` → uus `80107cbf` (`cherry-pick -x`).
- **VEST-P0a cherry-pick:** algne `043f0dce5b9c08e5a017f63009b293aa039dc308` → uus `96eef909` (`cherry-pick -x`).

### Konfliktid

Kumbki cherry-pick **ei tekitanud konflikti** — git auto-merge lahendas kattuvad failid
(`messages/{et,en,ru}.json`, `app/api/chat/route.js`, `components/chat/hooks/useChatStream.js`).

### Säilitatud T17/U7 muudatused (kontrollitud pärast merge'i)

- **U7 selge keel (T17):** `messages/*` võtmed `Selge keel`, `Kasuta selge keele režiimi`,
  `Selge keele režiim on sees`, teenuseosutaja `simple_language` — kõik alles.
- **VEST-P0/P0a kriis:** `crisis.notice`, `crisis_no_context`, `crisis_detected` jt — kõik alles.
- **JSON valiidsus:** kõik kolm `messages/*.json` parse'uvad.
- **Testid:** `tests/chat/crisisFailsafe.test.js` + `tests/chat/crisisEmptyProviderFallback.test.js`
  → 16/16 pass baasstacki peal (enne uut tööd).

## Teostuse seis (E1–E5)

- [x] E1 — kriis igas vestluse harus. `detectCrisis` ET jäi muutmata; lisatud EN + RU fail-closed
  regexgrupid (kirillitsa ilma ASCII-`\b`-ta). +2 positiivset (EN/RU) ja +2 negatiivset (EN/RU)
  testiplokki `tests/chat/safety.test.js` (7/7 pass). Kriis voolab `isCrisis` kaudu ühest kohast
  (`requestBootstrap` r290) tava-, abi- ja dokumenditöövoogu (workflowBranchHandlers r83/98/281/296).
  Banner `role="alert"` on olemas (`ChatNotices.jsx` r61), on eraldi determinstlik UI → U7 ei kirjuta
  ega paiguta seda ümber; PLAIN_LANGUAGE_MODE tekst juba lubab "olulised hoiatused jäävad alles".
- [~] E2 — aus pöörde elutsükkel, Stop, Retry. **Server VALMIS + tõendatud (10 testi):**
  `openaiRuntime` võtab `signal` ja katkestab päris provideri voo; `mainResponseHandler` streaming-
  abort katkestab iteratsiooni, vabastab reservatsiooni (mitte commit), EI käivita COMPLETED-finalize'i
  ega püsista täisvastust — salvestab ainult kuvatud osalise `completionStatus: ABORTED`-iga; non-stream
  abort → ABORTED; ERROR/kriis säilib. `persistDone` kirjutab iga lõppseisu markeri (+`retryOf`).
  Uus `lib/chat/turnStatus.js` (`resolveRunStatus`) + `/api/chat/run` eristab COMPLETED/ERROR/ABORTED
  ja stall-guard väldib igavest RUNNING-ut. **Klient VALMIS:** `useChatStream` märgib pöörde
  `completionStatus`-e (COMPLETED/ERROR/ABORTED), pure `resolveRetryTarget` + `retryLast` kordab
  sama viimast kasutajasõnumit ühe pöördena (isGeneratingRef guard topeltkliki/hilise-SSE vastu),
  `retryOf` liigub päringus serverisse (`route` → metadata). `ChatMessageItem` Retry-nupp (ka tühja
  markeri korral) + i18n `chat.error.retry`/`message_too_long` ET/EN/RU. Hüdreerimine kannab
  `completionStatus` üle (`useChatConversationState`). Testid: +2 retry-otsust (kokku 12 E2 testi).
  **Runtime NOT_PROVEN** — brauseri läbiklikk vajab päris/võltsi providerit (sünteetiline keskkond).
- [x] E3 — piirid, vead, töövoo käivitus. **4000-piir:** jagatud `lib/chat/messageLimits.js`;
  `requestBootstrap` jõustab 413 (`chat.error.message_too_long`) ENNE püsistust/providerit; eemaldatud
  vaikne mudeli-kärbe (route `MAX_USER_MESSAGE_CHARS` 1500→4000, slice = ohutu piir); komposeris nähtav
  loendur (`role=status`/`aria-live`, over-limit olek) + over-limit send-guard. **Jagatud predikaat:**
  `isFreeHelpWorkflowEligible` otsustab NII tellimusevärava kui marsruudi — suletud tagauks, kus paljas
  tuvastatud abikavatsus andis tasuta üldise RAG/LLM vastuse; predikaat OR-itud marsruutijasse
  (tasuta ⇒ abivoog, mitte LLM). PII/veasildid on API-võtmed (413 = `messageKey`, klient tõlgib).
  Eelvaade→kinnitus muster puutumata. Testid: freeHelpBoundary (3) + messageLimit (2).
  **Teadlik jääk:** aktiivse abi-oleku + „sisuka küsimuse" bypass võib anda tellijata RAG-i — vajab
  tellimusseisu läbivedu, dokumenteeritud lõpparuandes (väljaspool seda viilu).
- [x] E4 — hääl. **TTS:** proovib serveriteed KÕIGI keelte jaoks (RU/EN ei jää enam vaikselt ainult
  brauserile); brauseri varu tagastab õnnestumise, ebaõnnestumisel aus viga `chat.tts.unavailable`
  (mitte vaikus). **STT:** uus `discardRecording` viskab blobi ära ENNE transkribeerimist (providerit
  ei kutsuta, kuvatakse kinnitatud katkestus), Cancel-nupp salvestus-UI-s; 2,5 min pehme piir +
  hoiatus (`chat.mic.approaching_limit`/`max_duration`), taimerid puhastuvad kõigil radadel (abort/
  error/success/unmount). **Mikrofoni veaseisud** eristatud pure `classifyMicError`-iga: loakeeld /
  seadme puudumine / toe puudumine / tehniline (`chat.mic.permission_denied`/`no_device`/…).
  i18n ET/EN/RU + 2 testi (classifyMicError, piirikonstandid). **Runtime NOT_PROVEN** (päris heli/mikri
  puudub sünteetilises keskkonnas). Väike jääk: `.conv-entry-cancel`/`.conv-char-counter` CSS vormistus.
- [x] E5 — a11y/keeled/jõudlus. **Reduced-motion:** uus `useReducedMotion` ChatMessageItem-is
  eemaldab JS-kirjutusefekti (näitab kogu teksti kohe, teatab „valmis" ikka); sisenemiskaskaad on
  chat.css `@media (prefers-reduced-motion)` all juba neutraliseeritud. **Klaviatuur/SR:** kõik uued
  seisud on päris `<button>`-id aria-label'iga (Retry, Cancel), loendur `role=status`/`aria-live`,
  kriisibänner `role=alert`, katkestus/viga-markerid `role=status`. **Keeled:** kõik uus copy ET/EN/RU
  sümmeetriline (`i18n:check` roheline); U7 selge keel puutumata (ei mõjuta osutaja `simple_language`).
  **PERF-P0:** abort vabastab reservatsiooni (mitte commit), SSE suletakse, taimerid puhastuvad,
  Retry ei dubleeri pööret ega reservatsiooni.

## Verifitseerimine (kõik roheline)

- [x] T03 sihttestid + kogu `tests/chat/**` — **320/320 pass** (uued: safety EN/RU, stopRetryLifecycle,
  freeHelpBoundary, messageLimit, voiceRecording).
- [x] Muudetud failide lint — **0 viga** (ainult varasemad kasutamata-propi hoiatused).
- [x] `npm run i18n:check` — kõik locale'id vastavad et-baasile.
- [x] Prisma validate — skeem valid. **Migrate:check EI vaja** — skeemi ei muudetud
  (completionStatus/retryOf elavad `ConversationMessage.metadata` JSON-is).
- [x] `git diff --check` — puhas.
- [x] Production build — **✓ Compiled successfully** + 54/54 staatilist lehte + route-manifest.
  NB: worktree vajas päris `node_modules`-i (`npm ci`) — junction lõhkus Turbopacki
  (`Symlink node_modules ... points out of the filesystem root`).
- [x] Sünteetiline runtime — tõendatud node:test'iga (deterministlikud provider-stub'id + fake-prisma):
  ET/EN/RU kriis, provider-abort + ABORTED osaline püsistus, retry-otsus, tasuta-abi värav/marsruut,
  4000/413 piir, mikrofonivea/-piiri klassifikaator. **Cleanup: mitte midagi** — ühtki päris
  vestlust/sõnumit/usage't/autentimist ei loodud (fake-prisma). **NOT_PROVEN** = brauseri läbiklikk,
  päris heli/mikker, mobiil, päris OpenAI/TTS/STT võtmed (sünteetiline keskkond, väliskutseid ei tehtud).

## Lõpparuanne koordinaatorile

- **Worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-chat-voice-v1`; **haru:** `codex/chat-voice-v1`
  (push'itud `origin/codex/chat-voice-v1`).
- **T17 alus-SHA:** `ed95d6aa` (= remote). **VEST cherry-pick'id:** `ef01fc42`→`80107cbf`,
  `043f0dce`→`96eef909` (konflikte polnud; T17/U7 + kriisi keeled säilitatud).
- **Lõppcommit/remote SHA:** `f89f2ced`. **Migratsioonid:** puuduvad (skeemi ei muudetud).
- **E1–E5 kokkuvõte:** vt ülal iga etapi rida.
- **Stop'i salvestusleping:** abort → server katkestab provideri (signal), püsistab AINULT kuvatud
  osalise `completionStatus: ABORTED`-iga, vabastab reservatsiooni, EI käivita COMPLETED-finalize'i;
  refresh/hüdreerimine ei too hiljem täisvastust (tõendatud stopRetryLifecycle testis).
- **Kriisierand:** `detectCrisis` ET muutmata; EN/RU fail-closed lisatud; kriis püsib
  tava/abi/dokumenditöövoos ja ERROR/ABORTED radadel; banner `role=alert`; U7 ei kirjuta ümber.
- **Muutmata:** väliseid AI/hääle-kutseid ei tehtud; tootmisandmeid ei puudutatud; `main`, server,
  merge ja deploy on puutumata; põhitööpuud ei muudetud.
- **Teadlik jääk (dokumenteeritud, väljaspool viilu):** (1) aktiivse abi-oleku + „sisuka küsimuse"
  bypass võib anda tellijata RAG-i — vajab tellimusseisu läbivedu bypass'i; (2) `.conv-entry-cancel`/
  `.conv-char-counter` CSS-vormistus; (3) brauseri/heli runtime NOT_PROVEN.
