# VEST-A0 — vestlusaken, hääl ja töövoogude käivitamine: tervikanalüüs

Kuupäev: 2026-07-16 · Autor: Fable 5 (audit-esmalt; rakenduskoodi ei muudetud)

See dokument katab `/vestlus` pinna: vestluse arhitektuur, rollid, sõnumi elutsükkel, RAG-vastuse esitlus, STT/TTS, kriisirada, vestlusest käivitatavad töövood, privaatsus/turve ning UX/ligipääsetavus/keeled. Teiste pindade tervikanalüüse (RAG-QM, RAG elutsükkel, rollivahetaja, Teekond/eelpöördumine, abivahendus/Teenusekaart, Kovisioon, Tööheaolu) siin ei korrata — neid puudutatakse ainult vestluse liidese piirini.

---

## 1. Kontrollitud Git- ja runtime-seis

| Seis | SHA / väärtus | Märkus |
|---|---|---|
| Lokaalne `main` | `890124bd` (AI update 2026-07-15 14:51) | analüüsi baas |
| `origin/main` | `2a63fcd0` | +4 commit'i (RAG P8.0 dokumendid + master-inventuur); vestluse koodi ei puuduta |
| Tootmisserver (`ssh sotsiaalai`, `/home/ubuntu/apps/sotsiaalai`) | `890124bd` | võrdne lokaalse main-iga |
| Töökataloog | määrdunud | commit'imata RV-P0/PanelInfoSlot muudatused (sh `RoleViewSwitcher.jsx`, `ChatBodyView.jsx`, CSS) — need ON analüüsi osa, sest muudavad vestluspinda |
| Repo ajalugu | 60 commit'i, algab `64a24eb4` „hämarikuruumi redisain — puhas algus" | mõlemad allpool leitud pärandvead (L1, L3) on olemas alates esimesest commit'ist |

Runtime: lokaalne dev-server `localhost:3001` (kasutaja töötav protsess; `preview_start` port 3000 põrkus lukufailiga), Postgres `localhost:5432` (13 kasutajat). Lokaalses `.env`-is EI ole `OPENAI_API_KEY`, `STT_SERVER_URL` ega Google TTS võtmeid — see tegi võimalikuks kriisi-kontekstita raja tasuta tõendamise (RAG-teenus ja OpenAI maas). Runtime-kontrollide koond: ptk 1.1; koristus: ptk 1.2.

### 1.1 Runtime-kontrollide koond (22 API-kontrolli + 6 UI-kontrolli)

Sünteetilised kasutajad: `claude.client.vest@example.com` (CLIENT + aktiivne tellimus), `claude.sw.vest@example.com` (SOCIAL_WORKER + aktiivne tellimus); admin = olemasolev `claude.admin@sotsiaal.ai`. Login `LoginTempToken` + NextAuth credentials-callback kaudu; UI-kontroll playwright-core + päris Chrome (brauseripaan ei hüdreeri seda rakendust, vt Kovisioon/HANDOFF-paris-ui-kuvatoendid.md).

API-tasand (21/22 PASS; 1 FAIL oli ootuspärane leid):
- CLIENT login, tervitus („Tere! Mis küsimusega saan aidata?"), SSE-leping (meta→delta→done), vestluste loend, **kursor-pagineerimine → HTTP 500** (L3), STT värav 503 `api.stt.not_configured`, TTS värav 503 `api.tts.not_configured`, võõra vestluse lugemine 403, võõra convId hõivamine 409, oma vestluse kustutus 204 + `notFound:true`, view-role PUT 403 (fail-closed).
- SOCIAL_WORKER login + rollipõhine tervitus („Tere! Mis teemaga saan aidata?").
- ADMIN login; vaikimisi effectiveRole=SOCIAL_WORKER tervitus; `PUT /api/profile/view-role {viewRole:"CLIENT"}` → sama sessiooniga CLIENT-tervitus (admini eelvaade mõjutab vestlust); admin vestleb ilma tellimuseta (`subActive:false`).
- Kriis: `appi` → 502 (OpenAI võti puudub; vt L1c); **kriis + allikavajadus + 0 vastet** (`Kus saab toetust zzqqxyzw vallas? Mind ähvardab vägivald`) → HTTP 200, `isCrisis:true`, **`reply:""`, `answer:""`** (L1a). Pärast kriisipööret `run`-olek `RUNNING`, `isCrisisPersisted:false` (L1b).
- ChatLog-jälg: `chat_request` (ainult messageLength, sõnumiteksti EI logita), `crisis_detected`, `rag_error` (RAG maas; sisaldab `conversation_id`), `rag_search`, `no_context`, `rag_trace` (ILMA convId-ta), `openai_error`.

UI-tasand (päris Chrome, CLIENT):
- `/vestlus` hüdreerub; ruumiline sisenemine `data-entry="idle"` (Räägi + Kirjuta); mikrofon lubatud (`subActive` → `voiceEnabled`).
- Kriisisõnum läbi päris komposeri → assistendi mull „**Vabandust, ma ei saanud praegu vastust koostada.**" ja **`[role=alert]` bännereid DOM-is 0** (L1b runtime-tõend; kuvatõmmis tehtud, sünteetiline).

### 1.2 Koristustulemus

Kustutatud ja üle kontrollitud (kõik loendurid 0): 2 sünteetilist kasutajat (kaskaadiga 3 vestlust sh UI-loodud, sõnumid, 2 tellimust, nende login-tokenid), admini 1 login-token, 30 sünteetiliste kasutajate ChatLog-rida, 2 admini testiaknas tekkinud ChatLog-rida. Olemasolevaid test-kasutajaid (`claude.test.176002@…`, `claude.otp.demo@…`) ei puudutatud. Admini view-role küpsis elas ainult testi mälusiseses küpsisepurgis. Kasutaja dev-serverit (PID 26844) ei peatatud. Prod-serveril tehti ainult `git rev-parse` (read-only).

---

## 2. Tänane arhitektuur

### 2.1 Kihid

```
/vestlus (app/vestlus/page.js, SSR-kest)
 ├─ ConversationDrawer + ChatSidebar        — vestluste/ruumide loend, kustutus
 └─ ChatBody (components/alalehed/ChatBody.jsx, 2780 rida — orkestraator)
     ├─ hookid: useChatConversationState (convId + sessionStorage + server-hüdratsioon)
     │          useChatStream (saatmine, SSE, katkestus, süvauuring)
     │          useSpeech (STT/TTS), useChatAnalysisController (failianalüüs)
     │          useChatRoomMode (ruumirežiim, 3s polling), useConversationSources
     ├─ ChatBodyView (renderkiht) → ChatTopNotices (kriis/vead), ConversationView,
     │   ChatComposer, ChatSourcesPanel, ChatAnalysisPanel, WorkspacePanel,
     │   RoleViewSwitcher (admin), HelpListingsPanel/SelectedListingContext
     └─ ChatMessageItem (sõnumimull: markdown, kuula/kopeeri/allikad)

API: /api/chat (POST, põhivoog) · /api/chat/run (GET, hüdratsioon)
     /api/chat/conversations (+/[id], +/[id]/messages) · /api/chat/export
     /api/chat/analyze-file (üleslaadimine→RAG /analyze) · /api/stt · /api/tts
     /api/research/jobs (süvauuring) · /api/privacy/check (PII eelkontroll)

Serverituum (lib/chat/): requestBootstrap (auth+valideerimine+kriis+töövoovalik)
 → workflowBranchHandlers (dokumendi/abi haru) → retrievalContextAssembler (RAG)
 → orchestrationPolicy → mainResponseHandler (OpenAI stream + SSE + persist)
 → persistence (Conversation/ConversationMessage) + logger (ChatLog)
```

### 2.2 Kolm olekukihti

| Kiht | Sisu | Viide |
|---|---|---|
| **Brauser** | `convId` (sessionStorage, kliendi genereeritud UUID), sõnumite koopia (sessionStorage, 160 sõnumit / 80 000 tm), render-limiit, empty-intro nähtus, help-töövoo seis (viimase AI-sõnumi `workflow.help`), journey-draft (AINULT React-state), üleslaaditud faili chunk'id (ephemeral) | useChatConversationState.js:4–68,101–144; ChatBody.jsx:399 |
| **Server (püsiv)** | `Conversation` (userId, role CLIENT\|SOCIAL_WORKER, title, summary, TTL 90p `expiresAt`, soft-delete `archivedAt`, surnud `isPinned`), `ConversationMessage` (content piiramata, metadata: sources/displayed_sources/rag_trace/attachments/cards/**isCrisis**/workflow/orchestration), `ChatLog` (event+userId+data, retention 90p), `AgentArtifact` (dok-töövoo väljund) | prisma/schema.prisma:1191–1212,1332–1346,1402–1414 |
| **Server (tuletatud)** | `run`-olek COMPLETED/RUNNING/IDLE viimase sõnumi rollist; help/doc töövooseis viimase assistendi-sõnumi metadata'st | app/api/chat/run/route.js:210–217 |

Vestluse loomine: klient genereerib UUID (ChatBody.jsx:84–89; ChatSidebar.jsx:12–15 `conv-<uuid>`), server aktsepteerib `isPlausibleChatId` piires ja kaitseb hõivamise eest (POST /api/chat/conversations 409 võõra ID puhul, runtime-tõendatud; persistInit vaikib võõra ID puhul — vastus tuleb, aga ei salvestu, lib/chat/persistence.js:58).

Jätkamine: `hydrateFromServer` (useChatConversationState.js:321–456) tõmbab `run` GET-ist kuni 200 sõnumit ja asendab lokaalse seisu; kohalikke sõnumeid kaitseb heuristika `shouldPreserveLocalMessages` (streaming/8s-mutatsiooniaken). Fookuse/visibility-vahetusel värskendus (2,5s throttle).

Kustutamine: soft-delete (`archivedAt`+`expiresAt=now`), füüsiline kustutus retention-sweep'iga (lib/retention.js:204); kasutaja kustutus kaskaadib vestlused (schema onDelete: Cascade).

Git-ajaloo märkus: repo on 12.06.2026 „puhta algusena" üle toodud; vestlusmoodul on tugevalt modulariseeritud (39 lib/chat faili) — see on teadlik arhitektuur. Kaks allpool dokumenteeritud viga (L1 kriisi-fallback, L3 kursor) on pärandjäägid, mis eksisteerivad esimesest commit'ist saati; `Conversation.isPinned` on skeemijääk ilma ühegi kirjutajata (ainus lugeja on loendi sort).

---

## 3. Rollide ja õiguste kaart

Rolli lahendamine on ÜHES kohas: `resolveSessionRoleState` (lib/authz.js:29–42) — admin saab `effectiveRole` küpsisest `sotsiaalai_admin_view_role` (vaikimisi SOCIAL_WORKER), tavakasutajal normaliseeritud pärisroll. `/api/chat`, `/api/stt`, `/api/tts`, `/api/chat/analyze-file` ja conversations-loend kasutavad kõik sedasama resolverit — vestluspind on siin järjepidevam kui documents/materials API-d (vt rollivahetaja analüüsi K1).

| Võime | Pöörduja (CLIENT) | Spetsialist (SW) | Teenuseosutaja (SP) | Päris admin | Admini S/P/T eelvaade |
|---|---|---|---|---|---|
| Vestlus (RAG) | ✔ tellimusega | ✔ tellimusega | ✔ tellimusega | ✔ ilma tellimuseta | ✔ (admini õigustega, vaate-rolliga) |
| Vastuse pikkus (max_output_tokens) | 900 | 1200 | 900 (CLIENT-eelarve) | 1200 (SW vaikimisi) | vaate-rolli järgi |
| Süsteemiprompti register | CLIENT | SOCIAL_WORKER | DEFAULT | SW vaikimisi | vaate-rolli järgi |
| Vestluse kirje `role` veerg | CLIENT | SOCIAL_WORKER | SOCIAL_WORKER (normaliseeritakse!) | valitav/eelvaate järgi | eelvaate järgi |
| Hääl (STT/TTS) | ✔ tellimusega | ✔ tellimusega | ✔ tellimusega | ✔ | ✔ (voiceEnabled kasutab PÄRIS isAdmin-i) |
| Abitöövood (abisoov/abipakkumine) | ✔ TASUTA | ✔ TASUTA | ✔ TASUTA | ✔ | ✔ |
| Süvauuring, dok-töövood, failianalüüs | ✔ tellimusega (dok-limiit 2 allikat) | ✔ (limiit 10) | ✔ | ✔ | ✔ |
| Ruumivestlus | liikmesuse järgi | liikmesuse järgi | liikmesuse järgi | **möödapääs liikmesusest** (requestBootstrap.js:211) | sama möödapääs |

Tõendid: promptBuilder.js:13–36 (token-eelarved), systemPrompts/et.js:47–64 (rollihääled), conversationRoles.js:1–6 (SP→SW normaliseerimine kirjetes), subscriptionGate.js (tasuta abi-intendid), workflowBranchHandlers.js:299–301 (dok-limiit rollist).

Runtime-tõendatud: rollipõhine tervitus erineb (CLIENT „küsimusega" / SW „teemaga"); admini eelvaade CLIENT annab CLIENT-tervituse sama sessiooniga; CLIENT ei saa view-role'i seada (403).

Kitsaskohad:
- **UI ja serveri kooskõla on hea** põhirajal (sama resolver), aga kliendipoolne `useEffectiveRole` pole jagatud kontekst — vestluses rolli vahetades jääb ChatBody kohatäide vanaks kuni refreshini (teada RV-P1 jääk).
- **Vaate-eelvaade „valetab" kahes väikeses kohas:** (a) `voiceEnabled = isAdmin || subActive` (ChatBody.jsx:382) — admin näeb CLIENT-vaates mikrofoni ka siis, kui päris CLIENT tellimuseta seda ei näeks; (b) ruumi liikmesuse möödapääs kehtib ka eelvaates. Õiguste möödapääsu pole (eelvaade ainult LAIENDAB admini enda õigusi, mitte ei anna teiste andmeid).
- SP-rolli vestlused salvestuvad `role=SOCIAL_WORKER` all — SP külgriba filter `role=CLIENT|SOCIAL_WORKER` kaudu need paistavad SW-loendis; teadlik lihtsustus, aga dokumenteerimata.

---

## 4. Sõnumi elutsükkel

### 4.1 Põhivoog (töötab hästi)

1. **Saatmine:** ChatComposer → privaatsuse eelkontroll `POST /api/privacy/check` (409 → modal: Muudan / Saada maskeeritult / Saada siiski) → `sendMessage` (useChatStream.js:195) → `POST /api/chat {stream:true, persist:true, convId, uiLocale, chatMode, helpWorkflowState, ephemeralChunks…}`.
2. **Topeltsaatmise kaitsed (3 kihti):** `submitInFlightRef` + 400ms `primaryActionHandledAtRef` (ChatComposer.jsx:691–750) + `isGeneratingRef` värav hookis (useChatStream.js:206). Enter saadab, Shift+Enter reavahetus; saatmisel tühjeneb mustand, ebaõnnestumisel taastatakse (restoreDraft).
3. **Voogedastus:** server SSE `meta` (sources/workflow/isCrisis) → `delta` (28–96 tm partiid, ≥120ms intervall) → `done` (attachments/cards/lõplikud allikad); keepalive iga 15s. Klient uuendab mulli `startTransition`-iga. Runtime-tõendatud leping.
4. **Salvestus:** `persistInit` (kasutajasõnum + vestluse loomine/tiitel) enne genereerimist; `persistDone` (assistendi sõnum + metadata) transaktsioonis pärast; `summary` uueneb; TTL pikeneb.
5. **Jätkamine/refresh:** hüdratsioon serverist (ptk 2.2) taastab teksti, allikad, attachments, cards, workflow-seisu ja isCrisis'e (kui see salvestus — vt L1b).
6. **Kustutus:** üksik (ikoon + ModalConfirm), valik ja „kustuta kõik" külgribas; server soft-delete; `sotsiaalai:conversations-deleted` sündmus vahetab aktiivse vestluse uueks.

### 4.2 Servad ja rikked

| Stsenaarium | Tegelik käitumine | Hinnang |
|---|---|---|
| Katkesta (Stop) | Klient abordib fetch'i, mull saab „(katkestatud)" liite; **server EI katkesta OpenAI genereerimist ega salvestust** — `clientGone` vaigistab ainult enqueue (mainResponseHandler.js:872–878, 917–930); täisvastus salvestub, kulu tekib, refresh toob täisvastuse „tagasi" | L5, eksitav UI |
| Retry | Puudub. Vea korral jääb veatekst assistendi mulli; mustand taastatakse ainult siis, kui saatmine ise ebaõnnestus (mitte voo katkemisel) — kasutaja tipib uuesti | L11 |
| Topeltklikk saatmisel | Kaitstud (3 kihti) | OK |
| Refresh voo ajal | Klient kaotab voo; server lõpetab ja salvestab; hüdratsioon toob täisvastuse. Kliendi jaoks „vastus ilmus iseenesest" | OK-ish (L5 kõrvalmõju) |
| Võrgukatkestus | fetch reject → veatekst mulli; server salvestab ikkagi täisvastuse (sama mis Stop) | L5 |
| Serveri timeout | Klient 180s taimer → abort; SSE keepalive hoiab proxy't; OpenAI-poolset max-kestust pole | OK-ish |
| Tühi vastus | `EMPTY_STREAM_REPLY_FALLBACK` serveris; kliendis `chat.error.no_answer` | OK |
| Katkine/osaline voog | `error`-sündmus → `chat.error.stream_failed`; partial tekst jääb mulli | OK |
| Provider-viga (võti/kvoot) | Mitte-stream: 502 `chat.error.openai_request_failed`; stream: error-event; **`persistDone({status:"ERROR"})` EI loo assistendi sõnumit → vestlus jääb `RUNNING` olekusse** (runtime-tõendatud) | L11 |
| Sõnum >1500 tm | Vaikselt kärbitakse MUDELI jaoks 1500 peale (route.js:50,368); täistekst salvestub DB-sse; sisendil pikkusepiiri pole (4022 tm läks läbi, runtime) | L6 |
| Turn-limiit | 50 kasutajasõnumit vestluse kohta → 429 `chat_session_turns` (guardrails.js) | OK |
| Rate-limit | POST 24/min kasutaja+IP; 429 → `Retry-After` kuvatakse | OK |
| Mobiil | visualViewport-klaviatuurikäsitlus (ChatBody.jsx:585–870), kompaktne rail, 3-realine komposer; põhjalik | OK |
| DB maas | conversations GET tagastab `degraded` tühja loendi (mitte 500); run GET 503 | OK |

### 4.3 Süvauuring (deep research)

Eraldi elutsükkel: `POST /api/research/jobs` → SSE `/stream` (status/progress/result/error) + 2,5s persistents-polling varukanalina + `DELETE` katkestuseks (useChatStream.js:251–547). Jobi omandikontroll serveris (403). Katkestus SIIN toimib päriselt (server tühistab jobi) — kontrast põhivestluse Stop'iga.

---

## 5. RAG-vastuse ja allikate esitlus

Teadmuskorpuse kvaliteeti siin ei hinnatud (RAG-QM katab); allpool ainult vestluspinna leping.

- **Kuvamine:** allikad tulevad `meta`/`done` kaudu ja/või sõnumi metadata'st; sõnumi juures nupp „Allikad" (ainult kui sel sõnumil on allikaid), paneel ChatSourcesPanel — kaks skoopi: „viimane vastus" / „kogu vestlus" (loendustega tabidena).
- **Allikas vs AI järeldus:** vastuse tekst ei tsiteeri allikaid inline; eristus käib allikapaneeli + attribution-metadata kaudu (`displayed_sources`, `attribution_decisions`, `rag_trace` salvestuvad sõnumi metadata'sse — persistence.js:170–201). Süsteemiprompt keelab „allikates öeldakse"-stiili ja nõuab loomulikku piirangusõnastust (systemPrompts/et.js:19–25).
- **Allikate puudumine:** kaks eri rada — (a) `noContext` fallback-tekst rollipõhiselt („Ma ei leidnud praegu täpset vastust…", runtime-tõendatud 134 tm) kui allikaid OODATI aga ei leitud; (b) `CONVERSATIONAL_CONTEXT` sildiga tavaline vastus kui allikaid polnudki vaja (retrievalContextAssembler.js:1750–1758). Kasutajale eristus ei paista — teadlik disain.
- **Usaldus/värskus:** iga allikas kannab `source_freshness` (fresh/stale/historical/inactive/unknown; 180p vaikelävi) ja hoiatust (`chat.sources.warning_expired/stale/historical/inactive`), kontrollkuupäeva („Kontrollitud {date}" / „Kontrolliaeg teadmata") — sourceTrust.js:41–92 + ChatSourcesPanel.jsx:226–239. Kasutaja saab allika kohta raporteerida (aegunud/vale sisu/katkine link/vale allikas/muu → `POST /api/source-feedback`, staatusega „avatud/lahendatud").
- **Katkised lingid:** eraldi kontrolli kuvamisel pole; ainult raporteerimisvoog + freshness-hoiatused. URL-id avanevad `target=_blank rel=noreferrer`.
- **KOV-ulatus:** omavalitsuseta KOV-küsimusel lisatakse süsteemikäsk MUNICIPALITY_CLARIFICATION_REQUIRED (üldvastus + ÜKS täpsustav küsimus, ilma KOV-spetsiifiliste kontaktideta) — systemPrompts/et.js:87–100.
- **Kasutaja dokumendid:** üleslaaditud fail → `USER DOCUMENT` kontekst; allikakirjes `(uploaded document)` + failinimi; vestlusesse EI salvestata faili sisu (ainult vastus).
- **Klaviatuur/ekraanilugeja:** allikapaneel on korrektne dialoog — `role=dialog aria-modal`, fookuslõks, Esc, fookuse tagastus avajale (ChatSourcesPanel.jsx:51–99). Hoiatused `role=status`.
- **ET/EN/RU:** kõik `chat.sources.*` võtmed kolmes keeles olemas (467-võtmeline pariteedikontroll puhas).

Puudujääk esitluses: `renderInlineMarkdown` STRIPIB rasvase kirja märgid (`**` eemaldatakse, mitte ei renderdata) — mudel toodab rõhutusi, kasutaja neid ei näe (ChatMessageItem.jsx:52–58; L16).

---

## 6. Hääl: STT ja TTS (vestlusaken; ruumikõne ja Kovisiooni kõne on eraldi süsteemid, siin ei käsitleta)

### 6.1 Voog

- **STT:** mikrofoninupp / „Räägi" (ruumiline sisenemine) → `getUserMedia` → MediaRecorder (webm/mp4/ogg; WAV-fallback ScriptProcessor'iga) + helitugevuse mõõtja → stop → blob → `POST /api/stt` (FormData, locale) → tekst LISATAKSE komposerisse (kasutaja saab enne saatmist muuta — hea leping, useSpeech.js:242–285).
- **Server:** auth 401 → tellimus 402 → rate-limit 20/min → konfig (väline STT_SERVER_URL VÕI OpenAI `gpt-4o-mini-transcribe`) → max 12MB, mime-allowlist; heli EI säilitata (läheb otse pakkujale); ChatLog saab `stt_request`/`stt_cost_usage` (pikkused, kestus, MITTE sisu). Runtime: 503 `api.stt.not_configured` (võtmeid pole lokaalis).
- **TTS:** sõnumi „Loe ette" nupp / viimase vastuse ettelugemine → ET: `POST /api/tts` (Google `et-EE-Standard-A`, fallback OpenAI `alloy`) → base64 MP3 → `Audio.play()`; **RU/EN: AINULT brauseri speechSynthesis** (useSpeech.js:178–183), kuigi server toetab `ru-RU-Standard-D`/`en-US-Standard-C`. Piir 4500 tm (kärbitakse kliendis vaikselt). Sama nupp = toggle (peatab); üks esitus korraga (uus katkestab vana).

### 6.2 Seisundid ja piirid

| Aspekt | Käitumine | Hinnang |
|---|---|---|
| Loa küsimine | brauseri prompt; keeldumine → üldine `chat.mic.cannot_start` (NotAllowedError eristamata) | L17 |
| Salvestuse tühistamine | PUUDUB — stop transkribeeribALATI (kulu + üllatus) | L9 |
| Kestuspiir | kliendis puudub (taimer ainult kuvab); serveris kaudselt 12MB | L9 |
| Vaikusetuvastus | <3,5 keskmine amplituud + >500ms → `chat.mic.silence`, STT-kutset ei tehta | hea |
| Transkriptsiooni viga/timeout | veateade `role=alert` ribana; tekst ei kao (komposer puutumata) | OK |
| Brauseri toe puudumine | `chat.mic.unsupported`; TTS-il RU/EN hääle puudumisel VAIKNE ebaõnnestumine (utterance lihtsalt ei kõla / vale keel) | L8 |
| Ligipääsetavus | mikrofoninupp aria-label start/stop + data-recording olekud; salvestusriba `role=status aria-live=polite` + Stopp-nupp; „Loe ette" aria-label + data-speaking | hea |
| Tellimuseta kasutaja | nupp `disabled` ILMA selgituseta (voiceEnabled=false; title jääb „Alusta dikteerimist") | L17 |
| Privaatsus | heli ei säilitata; transkript muutub tavaliseks sõnumiks (sama elutsükkel); ChatLog sisuta | hea |
| ET/EN/RU | UI-tekstid täielikud; STT locale=UI keel (mitte automaat) — teises keeles rääkimine võib transkribeeruda valesti; TTS häälevalik ET-le serveripõhine, RU/EN seadmesõltuv | L8/väike |
| Mobiil | MediaRecorder mime-fallback'id (mp4 Safari); puutealad komposeri süsteemis | OK |

Ruumiline sisenemine (spatialEntry, ChatComposer.jsx:479–627): värske vestlus algab kahe suure valikuga „Räägi"/„Kirjuta"; salvestusseisund taimeriga; dikteerimise järel tekst joonele. Runtime-tõendatud (`data-entry="idle"`, mõlemad nupud DOM-is).

---

## 7. Kriisi- ja ohutusrada

### 7.1 Kavandatud rada

1. `detectCrisis` regex (lib/chat/safety.js:8–21): enesetapp/enesevigastus, elu mõttetus, vahetu oht, veritsemine/teadvusetus, (lähisuhte)vägivald/ähvardamine, lapse väärkohtlemine, „appi".
2. `isCrisis` → süsteemiprompti kriisirida („vasta väga lühidalt; ütle, et helistaks esmalt 112; kuni 2 ohutussammu" — systemPrompts/et.js:43–45, sama EN/RU) + `crisis_detected` ChatLog-event + `meta.isCrisis` kliendile.
3. Klient: `setIsCrisis(true)` → ChatTopNotices bänner `role=alert`: „Vahetu ohu korral helista 112. … 116 111 … 116 006." (kolmes keeles olemas, messages/*).
4. Vastus salvestub `metadata.isCrisis=true`-ga → hüdratsioon taastab bänneri.

### 7.2 Kus rada PÄRISELT katkeb (runtime-tõendatud)

**(a) Kriis + allikaid ei leitud → tühi vastus.** `noContextReply: isCrisis ? L.crisisNoCtx : L.noContext` (app/api/chat/route.js:383), aga `langStrings` EI defineeri `crisisNoCtx` võtit (promptBuilder.js:148–199 — on ainult `crisis`, mida keegi ei kasuta) → `undefined` → `buildImmediateChatResponse` default `reply=""` → kasutajale kuvatakse **„Vabandust, ma ei saanud praegu vastust koostada."** Runtime: `isCrisis:true, reply:"", answer:""`. Kriisijuhis (112) vastusesse EI jõua. Haru on reaalne: kriisisõnum, mis sisaldab teenuse/toetuse-vajadust ja mille vasted jäävad alla läve (või RAG-teenus on maas).

**(b) Bänner kustub kohe.** Tühja vastusega `persistDone` EI loo assistendi sõnumit (persistence.js:169 `if (finalText)`) → `run` GET `isCrisis:false` → voo lõpus käivituv `requestConversationsRefresh` → `hydrateFromServer` → `setIsCrisis(serverCrisis=false)` (useChatConversationState.js:350–352) **kirjutab elava kriisiseisu üle**. UI-runtime: pärast kriisipööret `[role=alert]` DOM-is puudub. Sama mehhanism kustutab bänneri ka F5 järel provider-vea stsenaariumis.

**(c) Vea korral bännerit ei tekigi.** 502/stream-error teel klient ei kutsu `setIsCrisis(true)` (useChatStream error-haru) — kriisis kasutaja + rike = ainult veateade. Runtime: `appi` → 502, banner 0.

**(d) Aktiivses töövoos kriis ignoreeritakse.** Dokumendi- ja abitöövoo harudes on `isCrisis: false` kõvakodeeritud (workflowBranchHandlers.js:82,276,341,468,537) — kriisisõnum keset abisoovi vormistamist ei käivita bännerit ega kriisiprompti.

**(e) Detektor on ükskeelne.** Kõik mustrid on eesti keeles; RU/EN kriisisõnum (nt „я хочу умереть", "I want to kill myself") EI käivita rada, kuigi RU/EN bänneritekstid on tõlgitud ja UI on kolmkeelne.

### 7.3 Ülejäänud kontrollid

- **Valekäivitus:** regex on lai (nt „appi" üksi; „vägivald" mis tahes kontekstis, ka professionaali tööalane küsimus „kuidas dokumenteerida vägivalla juhtumit" saab kriisibänneri). Bänner on informatiivne, mitte blokeeriv — vestlus jätkub; talutav, aga SW-rollis müra.
- **Vestlus ei kao:** kriis ei katkesta ega kustuta midagi (ainult prompt+bänner+logi). ✔
- **Salvestus:** kriisisõnum salvestub nagu iga sõnum (sisu DB-s); ChatLog saab `crisis_detected` (userId, roll, hadRagContext — ILMA sisuta) ja `chat_request.isCrisis`. Sisu logidesse ei leki. ✔
- **Admin näeb:** ChatLog-analüütika kriisifiltrid on admin-vaadetes olemas (messages `admin.analytics.*crisis*` võtmed); eraldi kriisitöölauda/eskalatsiooni pole — ainult logi.
- **Välist kõrvalmõju pole:** hädaabikontakte, e-kirju ega teavitusi kriis ei saada (kontrollitud: `crisis` ei esine notification/email teedes). UI ei luba midagi, mida server ei tee — pigem vastupidi (lubadused täitmata, vt a–d).

---

## 8. Vestlusest käivitatavad töövood

Käivitajad: komposeri tööriistamenüü (+), Töölaud (WorkspacePanel, `?workspace=`), URL-süvalingid (`?workflow=`, `?roomId=`), töövoo-kaardid vastustes (`workflow` metadata), külgriba.

| Töövoog | Käivitus | Kaasa liikuvad andmed | Eelvaade/nõusolek | Serveripoolne kontroll | Tagasivõetavus | UI≙server? |
|---|---|---|---|---|---|---|
| **Abisoov/abipakkumine** (chat-töövoog) | menüü „Abisoov"/„Abipakkumine"; URL `?workflow=help_request&category=&municipalityName=&fromJourney=&share=`; vaba tekst (intent-detektor) | AINULT kasutaja selle voo sõnumid; URL-prefill (kategooria, KOV; `fromJourney` ID extraNotes'is) | samm-sammuline mustand → eelvaade → „salvesta" kinnitus; PII-värav sunnib avalikus voos maskeerima (send_original keelatud) | intent/step whitelist (workflowState.js); kuulutuse CRUD/omandiküsimused = abivahenduse analüüsi V1/V2 skoop | kuulutust saab muuta/kustutada (HelpListingsPanel) | ✔ (vestlussisu EI liigu kuulutusse peale kasutaja kirjutatu) |
| **Kuulutuste sirvimine + ühendamine** | Töölaud/menüü paneelid (`help_requests/help_offers`) | — | valik + „ühenda" → `POST /api/help/matches` → ruumi-link | matchi loogika serveris | ruum jääb; matchi tühistamine = abivahenduse skoop | ✔ |
| **Süvauuring** | menüü „Süvauuring" | päringutekst + convId (persist) | režiimisilt komposeril; tulemus vestlusesse | jobi omandikontroll (403), tellimus | jobi saab katkestada (DELETE) | ✔ |
| **Dokumendianalüüs (üleslaadimine)** | kirjaklamber / menüü | fail → RAG /analyze → chunk'id BRAUSERIS; iga sõnumiga kaasa (ephemeralChunks) | eelvaade paneelis; „ephemeral" privaatsusmärge API-vastuses | mime/suuruse valideerimine; SSRF-kaitse (ainult lokaalne RAG-host) | faili saab eemaldada (chunk'id kaovad) | ✔ |
| **Dokumendi koostamine (dok-töövoog)** | vestluses loomulik keel / `chatMode:document`; Töölaud „Dokumendi koostamine" (/dokreziim) | vestlusest kogutud ülesandepüstitus + (soovi korral) üleslaaditud materjal | samm-sammuline kinnitus enne genereerimist | AgentArtifact DRAFT omanikuga; CLIENT-il 2 allika limiit | artefakt kustutatav dok-pinnal | ✔ (artefakt EI seostu convId-ga skeemis — ainult observability-logis) |
| **Teekond** | Töölaud „Teekond" (embedded, admini eelvaates roleOverride=CLIENT); `?workflow=journey` vestlusrežiim | vestlusrežiimis: kasutaja jutt → `POST /api/journeys/draft` (AI mustand) → „salvesta" → `POST /api/journeys` | mustand kuvatakse TÄIELIKULT vestluses + privaatsusmärge („ei salvestata enne kinnitust"); salvestus AINULT käsuga | journeys API omandikontroll (Teekonna analüüsi skoop) | Teekond kustutatav oma pinnal; vestluse draft kaob ka refreshiga (L13) | ✔, aga draft-olek habras |
| **Eelpöördumine** | Töölaud „Eelpöördumised" (embedded leht) | vestlusest EI liigu midagi automaatselt | oma pinna leping | eelpöördumise analüüsi skoop | — | ✔ |
| **Ruum** | külgriba „Grupid"; kuulutuse ühendamine; `?roomId=` | ruumis kirjutatu; „Saada ka assistendile" lüliti (vaikimisi VÄLJAS, help-match ruumis keelatud) — AI-vastus salvestub RoomMessage'ina KÕIGILE nähtavalt | ruumi päritolu-teade + privaatsusmärge („privaatset vestlust ei jagata") | liikmesuskontroll (v.a admin); sõnumi-API ruumi enda kontroll | ruumist saab lahkuda (ruumide skoop) | ✔ |
| **Kovisioon / Tööheaolu / Teenusekaart / Materjalid / Teenuseprofiil** | Töölaud → täisleht (push) või embedded | ei midagi vestlusest | oma pindade leping | oma analüüside skoop | — | ✔ |
| **Kutse (grupivestlus)** | Töölaud „Lisa inimene" | — | InviteModal | invites API | kutse tagasivõetav | ✔ |

Läbivad tähelepanekud:
- **Jagamata vestlussisu EI liigu ühessegi töövoosse automaatselt** — see on vestluspinna kõige tugevam privaatsusomadus (kinnitatud kood + ruumi/Journey privaatsusmärked ChatNotices.jsx:21–37).
- Töövoo-režiimid on komposeril selgelt sildistatud (režiimirida + ikoon; „×" väljub režiimist), empty-intro selgitab režiimi. Kasutaja teab, millal ta AI-ga räägib ja millal vormistab päris objekti (salvestuskinnitused).
- Ainus „vaikselt kaasa liikuv" asi: help-prefill `fromJourney:<id>; share:<võtmed>` extraNotes-stringina (ChatBody.jsx:125–150) — sisu ei sisalda, ainult ID; shareKeys-illusioon on Teekonna analüüsi P0 skoop.

---

## 9. Privaatsus ja turvalisus

| Kontroll | Seis | Tõend |
|---|---|---|
| Omandipiir | Kõik lugemis-/kirjutusteed kontrollivad `userId`-d serveris: run GET 403, messages 403, export 403/404, DELETE ainult oma, persistInit/persistDone vaikiv omandikontroll | runtime 403/409/204 + persistence.js:58,167 |
| ID-de äraarvatavus | convId = kliendi UUID (128-bit) + `isPlausibleChatId` + hõivamiskaitse 409; nõrgim lüli on kasutaja ise valitav ID (min 8 tm) — lühikese käsitsi-ID võõras EI saa üle võtta, aga võib „broneerida" olemasolu-oraakliga (L14, madal) | conversations/route.js:309–317 |
| Cross-tenant / kasutajavahetus | sessionStorage võtmed kasutaja+rolli+keele kaupa; server igal juhul userId järgi; teise kasutaja vestlust hüdratsioon ei too (403) | useChatConversationState.js:101–105 |
| Kustutamine | soft-delete → retention hard-delete; konto kustutus kaskaadib vestlused+sõnumid; ChatLog-read (userId-ga) EI kaskaadu kasutajaga — kustuvad 90p retentioniga | schema:1205; retention.js:204,221 |
| ChatLog | Sõnumite SISU ei logita (messageLength; STT/TTS pikkused; rag_trace ID-d) — runtime-kinnitatud 30 real; `redactObject` lisakaitse; retention 90p; `rag_trace` convId-ta (L15) | logger.js; runtime ptk 1.1 |
| Prompt injection | Ajalugu (8×800 tm) ja RAG-kontekst lähevad mudelile; tööriistakäivitusi mudelil POLE (töövood käivituvad deterministlike intent/state-masinatega, mitte mudeli otsusega) — injektsioon saab mõjutada ainult vastuse teksti, mitte tegevusi | requestBootstrap.js:31–67; workflowModeRouting.js |
| Klient-serveri usalduspiir | Klient saadab `history` (mudeli kontekst — kasutaja saab „võltsida" ainult iseenda konteksti), `helpWorkflowState` (normaliseeritakse whitelist'iga; ID-de omandikontroll on help-API-de skoop), `role` parameetrit EI usaldata (server lahendab ise) | requestBootstrap.js:196–232 |
| Failid | analüüs on mööduv (chunk'id brauseris; serveris ei säilitata); RAG /analyze ainult lokaalhostile (SSRF-kaitse `ALLOW_EXTERNAL_RAG` taga); mime+suurus valideeritud | analyze-file/route.js:40–107 |
| Kolmanda isiku andmed | PII-värav (email/telefon/isikukood/aadress, +OpenAI-filter) 2-astmeline: klient enne saatmist + server bootstrap'is (409); avalikes voogudes originaal keelatud; privaatses lubatud teadliku valikuga | privacyGuard.js:39–124 |
| Kriisiandmed | sisu ei logita; `crisis_detected` userId-ga (analüütika vajadus vs minimeerimine = tooteotsus O-V6) | ptk 7.3 |
| Admini nähtavus | admin EI näe teiste vestlusi ühegi vestlus-API kaudu (userId-piir kehtib ka adminile); admin näeb ChatLog-analüütikat (sisuta) | conversations/run route'id |
| Eksport | ainult OMA vestluse ASSISTENDI sõnum, auth+ratelimit; failinimi saniteeritud | export/route.js:99–127 |
| Tellimusepiir | **auk:** tasuta abi-intent avab ka ÜLDVASTUSE (L7) | subscriptionGate.js:28 vs workflowModeRouting.js:9–18 |
| UI kui ainus kaitse | ei leidnud kohta, kus server poleks lõplik piir (v.a L7 ärimudel) | — |

---

## 10. UX, ligipääsetavus ja ET/EN/RU

- **Hierarhia ja seisundid:** empty-intro kirjutusefektiga (režiimipõhine tekst), „Mõtlen"-olek (`data-thinking`), voogedastuse kursor, „näita vanemaid" (+25 kaupa, kerimispositsioon säilib), „hüppa lõppu" nupp, laadimisskeletid külgribas, tühiseisud (vestlusi pole / otsinguvasteta), veabännerid `role=alert`.
- **Fookus ja klaviatuur:** Enter/Shift+Enter; kerimisala `tabIndex=0` + nooled/PageUp/Down/Home/End/Space (ConversationView.jsx:181–222); tööriistamenüü Esc + väliklikk + fookuse tagastus; allikapaneeli fookuslõks; sr-only label komposeri väljal.
- **Ekraanilugeja:** sõnumid `role=article` + sr-only autor („Assistent:"/„Sina:"); vestlusala `aria-live=polite aria-busy` (voog teatatakse pärast valmimist); salvestus `role=status`; kriis/vead `role=alert`; režiimisilt sr-only tekstiga.
- **Kontrast/teemad:** hc-režiimi tugi (`data-contrast`), teemasignatuuri jälgija (MutationObserver); värvide audit = CSS-kampaaniate skoop.
- **Reduced motion:** kuulutustepaneeli sulgemisanimatsioon austab `prefs.reduceMotion` (ChatBody.jsx:1556); kirjutusefekt ja sisenemis-kaskaad EI kontrolli reduce-motion'it JS-poolel (CSS-i medias osaliselt; kirjutusefekt 18ms/tm jookseb alati) — väike võlg.
- **Mobiil:** visualViewport-klaviatuuripaigutus, kompaktne ülariba, 15 vestlust lehe kohta, puutealad; topeltklikk-guard back-nupul.
- **Pikad sisud:** sõnumid renderdatakse täies pikkuses (80k tm sessionStorage-kärbe); pikad allikaloendid keritavas paneelis skoopide kaupa.
- **Keeled:** 467 `chat.*`/seotud võtme pariteet ET/EN/RU TÄIUSLIK (skriptiga kontrollitud: 0 puuduvat, 0 tühja, 0 tõlkimata). Erandid: (a) PII-hoiatus + leidude sildid tulevad serverist eesti keeles (L10); (b) kriisidetektor ainult ET (L2); (c) `pickReplyLang` eelistab ALATI UI-keelt — vene keeles kirjutav kasutaja ET-liideses saab ET-vastuse (teadlik valik? → O-V5 kõrval märkus); (d) RU/EN TTS kvaliteedierinevus (L8).
- **Selge keel:** noContext-fallback juhendab järgmist sammu („lisa vald või linn; isikukoodi pole vaja"); privaatsusmodal selgitab valikuid; režiimid sildistatud.

---

## 11. Mis töötab hästi

1. **Omandi- ja rollipiir on serveris ja järjepidev** — kõik vestlus-API-d käivad läbi sama `resolveSessionRoleState`/`requireChatUser` ahela; runtime 403/409/204/402 kõik korrektsed; admini eelvaade fail-closed (klient 403).
2. **SSE-leping ja topeltsaatmise kaitsed** — meta/delta/done + keepalive; kolm kihti kliendis; mustandi taastamine; deterministlik tervitus ilma mudelita.
3. **Privaatsuskihid** — kaheastmeline PII-värav (avalikus voos maskeerimine sunnitud), sisuta ChatLog (runtime-kinnitatud), mööduv failianalüüs, SSRF-kaitse, „jagamata vestlussisu ei liigu töövoogudesse".
4. **Allikate usalduskiht** — freshness/hoiatused/kontrollkuupäev/raporteerimine + korrektne dialoog-ligipääsetavus; attribution-metadata persisteerub.
5. **i18n distsipliin** — 467 võtme täielik pariteet kolmes keeles (lint-värav töötab).
6. **Töövoogude käivitus on nõusolekupõhine** — mustand→eelvaade→kinnitus muster (abisoov, journey, dokument); režiimid selgelt sildistatud; ruumi AI-edastus vaikimisi väljas.
7. **Mobiiliklaviatuuri käsitlus** — visualViewport-heuristikad on põhjalikud ja kaitstud (baseline/jitter/settle).
8. **Elutsükli servad kaetud** — turn-limit, rate-limit + Retry-After, degraded-DB režiim, tühja voo fallback, vaikusetuvastus STT-s.

---

## 12. Leiud ja prioriteedid

Vorming: tunnus · raskus · roll/töövoog · tõend · viide · risk · minimaalne parandus · sõltuvused.

### P0 — kinnitatud kriisiraja defektid

**VEST-L1 · Kriisivastus ja -bänner kaovad just siis, kui neid vaja on · P0 · kõik rollid, põhivestlus · RUNTIME**
- Tõend: ptk 1.1/7.2 — (a) kriis+0 allikat → `reply:""` → UI „Vabandust, ma ei saanud praegu vastust koostada"; (b) `[role=alert]` = 0 pärast pööret (hüdratsioon kirjutab üle); (c) 502 teel bännerit ei teki.
- Viited: app/api/chat/route.js:383 (`L.crisisNoCtx` — defineerimata võti); lib/chat/promptBuilder.js:148–199; lib/chat/persistence.js:169; components/chat/hooks/useChatConversationState.js:350–352; components/chat/hooks/useChatStream.js (error-harud).
- Risk: kriisis inimene (ET-muster) ei saa 112/116111/116006 juhist; olukord halveneb rikke ajal (just siis, kui RAG/LLM maas).
- Minimaalne parandus: (1) defineeri `crisisNoCtx` 3 keeles (112+116111+116006 sisuga) ja kasuta seda; (2) salvesta ka fallback-vastus assistendi sõnumina `isCrisis:true` metadata'ga; (3) ära lase hüdratsioonil aktiivse pöörde kriisiseisu `true→false` alandada; (4) sea kriisiseis ka veaharudes (bootstrap teadis juba enne mudelit).
- Sõltuvused: O-V1 (ametlik tekst).

**VEST-L2 · Kriisidetektor on ainult eestikeelne · P0 · RU/EN kasutajad · staatiline (regex), kaudne runtime**
- Viide: lib/chat/safety.js:8–21. Risk: venekeelne kriisisõnum ei käivita MIDAGI (prompt, bänner, logi), kuigi RU-bännertekst on olemas. Minimaalne parandus: RU/EN mustrikomplekt + testid; pikem tee (klassifikaator) = O-V2. Sõltuvused: O-V2.

**VEST-L4 · Aktiivses dok-/abitöövoos kriis ignoreeritakse · P0(kriisikategooria)/P1 · töövoo-kasutajad · staatiline**
- Viide: lib/chat/workflowBranchHandlers.js:82,276,341,468,537 (`isCrisis: false` kõvakodeeritud, bootstrap'i väärtus visatakse ära). Risk: kriisisõnum keset abisoovi vormistamist → tavaline vormiküsimus vastu. Minimaalne parandus: anna bootstrap'i `isCrisis` läbi finalizeReply/buildResponse kutsetesse (bänner + metadata; töövoo loogikat ei muuda). Sõltuvused: —.

### P1 — katkine funktsioon / vale piir

**VEST-L3 · Vestluste loendi kursor-pagineerimine → HTTP 500 · P1 · kõik rollid, külgriba · RUNTIME**
- Viide: app/api/chat/conversations/route.js:71 — `parseCursor` kutsub `isPlausibleConversationId`, importitud on `isPlausibleChatId` → ReferenceError. Runtime: 500, tühi keha.
- Risk: „Veel"-nupp katki >30 vestlusega (mobiilis >15); „Kustuta kõik" katki >100 vestlusega (fetchAllConversationIds pagineerib) — kustutab vaikselt ainult esimese lehe. Pärandviga repo algusest (`git log -S`).
- Minimaalne parandus: 1 identifikaator (kasuta `isPlausibleChatId`) + regressioonitest kursoriga. Sõltuvused: —.

**VEST-L7 · Tellimuseta kasutaja saab tasuta üldvastuse abi-intent mustriga · P1/P2 (kulupiir) · CLIENT · staatiline, kood-tõestatav**
- Viide: lib/chat/subscriptionGate.js:28 (`detectedHelpIntent` vabastab) vs lib/chat/workflowModeRouting.js:9–18 (detected-intent ÜKSI ei suuna abitöövoosse) → sõnum „otsin abi lapsehoiuga" läheb tellimuseta täis-RAG+LLM rajale.
- Risk: ärimudeli/kulupiiri leke (mitte andmeleke). Minimaalne parandus: vabasta tellimusest AINULT siis, kui sama tingimus ka marsruudib abitöövoosse (jaga üks predikaat). Sõltuvused: O-V4.

### P2 — eksitav UI / oluline UX-võlg

**VEST-L5 · Stop ei peata serverit; täisvastus salvestub ja „naaseb" · P2 · kõik · staatiline + runtime-kaudne**
- Viide: lib/chat/mainResponseHandler.js:872–878 (abort ainult vaigistab enqueue), 917–930 (iteratsioon + finalize jätkuvad). Risk: LLM-kulu jookseb edasi; kasutaja nähtu ja salvestatu lahknevad (refresh toob „katkestatud" vastuse täiskujul). Parandus: abort-signaalil katkesta OpenAI-iteratsioon; salvesta osaline märkega VÕI ära salvesta (O-V3). Sõltuvused: O-V3.

**VEST-L6 · Sõnum kärbitakse mudelile 1500 tm peale vaikselt; sisendipiiri pole · P2 · kõik · runtime (4022 tm läks läbi)**
- Viide: app/api/chat/route.js:50,368. Risk: kasutaja arvab, et AI luges kogu kirja; DB paisub (content piiramata). Parandus: UI-piir + loendur + serveri 413; või tõsta mudelipiiri teadlikult. Sõltuvused: O-V5.

**VEST-L11 · Retry puudub; vea/katkestuse järel serveriseis `RUNNING` · P2 · kõik · runtime**
- Viide: persistDone ERROR-haru ei loo midagi (persistence.js:140–232); run/route.js:210–217 tuletab RUNNING. Parandus: „Proovi uuesti" afford viimase kasutajasõnumi kordamiseks + ERROR-turn'i markeerimine (nt metadata) et olek ei jääks rippu. Sõltuvused: —.

**VEST-L8 · RU/EN TTS ainult brauserihäälega; vaikne ebaõnnestumine · P2 · RU/EN kasutajad · staatiline**
- Viide: components/chat/hooks/useSpeech.js:178–183 vs app/api/tts/route.js:38–43 (server toetab ru/en hääli). Parandus: kasuta server-TTS-i kõigis keeltes (fallback brauserile) + veateade kui hääl puudub. Sõltuvused: O-V7 (kulu).

**VEST-L9 · Salvestust ei saa tühistada; kestuspiir puudub · P2 · hääle kasutajad · staatiline**
- Viide: useSpeech.js:287–301 (stop → alati transkribeerimine), WAV-fallback puhverdab kogu heli mällu (ScriptProcessor, deprecated). Parandus: Tühista-nupp (viska blob ära), pehme kestuslimiit (nt 2–3 min + hoiatus), kaalu WAV-fallback'i eemaldamist. Sõltuvused: —.

**VEST-L10 · PII-hoiatus ja leidude sildid serverist ainult eesti keeles · P2 · RU/EN · staatiline**
- Viide: lib/privacy/piiFilter.js:5–23 (label'id), :136–141 (hoiatus); privacyGuard 409 payload kuvatakse otse. Parandus: võtmepõhine tõlge (messages/*) payload-tekstide asemel. Sõltuvused: —.

**VEST-L17 · Mikrofon disabled selgituseta; loakeeldumine üldine · P2/P3 · tellimuseta + esmakasutajad · staatiline + UI-runtime**
- Viide: ChatComposer.jsx:914 (`disabled={!voiceEnabled}`), useSpeech.js:431–441. Parandus: tooltip/teade „vajab tellimust"; eristada NotAllowedError („luba mikrofon brauseris"). Sõltuvused: —.

### P3 — väiksem võlg / nüansid

- **VEST-L12** `Conversation.isPinned` surnud väli (kirjutajat pole; ainus lugeja sort) — kustuta või ehita kinnitamine. `git log -S` kinnitab: kirjutajat pole kunagi olnud.
- **VEST-L13** Journey-vestlusrežiimi draft ainult React-state's — refresh kaotab `sourceText` konteksti; sõnumid näivad vestlusena, aga ei persisteeru (`/api/chat` ei osale). Seos Teekonna „olek pole URL-is" juurveaga.
- **VEST-L14** convId hõivamise 409 = olemasolu-oraakel (UUID-de puhul praktiline risk ~0; lühikeste käsitsi-ID-de puhul teoreetiline).
- **VEST-L15** `rag_trace` ChatLogis convId-ta (rag_error'il on) — RAG-QM baasjoone teema, siin kinnitus.
- **VEST-L16** `**rasvane**` strippitakse vastustest (ChatMessageItem.jsx:52–58) — rõhutus kaob.
- **VEST-L18** Kirjutusefekt/kaskaad ei austa reduce-motion'it JS-tasandil (empty-intro 18ms/tm).
- **VEST-L19** `pickReplyLang` = alati UI-keel; sõnumikeel ignoreeritakse (RU kasutaja ET-liideses saab ET vastuse) — kas teadlik? (O-V5 kõrvalotsus)
- **VEST-L20** Admini eelvaates `voiceEnabled` kasutab päris `isAdmin`-i — eelvaade näitab mikrofoni, mida CLIENT tellimuseta ei näeks (kosmeetiline eelvaate-ebatäpsus).

---

## 13. Soovitatud sihtmudel

1. **Kriis kui esimese klassi deterministlik rada.** Kriisivastus EI tohi sõltuda RAG-i ega LLM-i õnnestumisest: tuvastuse hetkel on garanteeritud (a) fikseeritud juhistekst (112/116111/116006, 3 keeles) vastusena või vastuse ees, (b) püsiv bänner kuni pöörde selge lõpuni (mitte hüdratsiooni meelevallas), (c) sama käitumine kõigis harudes (töövood, vead, timeout), (d) tuvastus vähemalt kolmes keeles. Logisse minimaalne jälg (praegune tase on hea).
2. **Aus elutsükkel.** Stop = serveri katkestus + selge salvestusleping; iga lõppseis (valmis/katkestatud/viga) on nii kliendis kui DB-s üheselt esindatud (mitte igavene RUNNING); retry on nupp, mitte käsitsi kordustippimine.
3. **Hääl võrdseks kolmes keeles.** Üks TTS-rada (server esmane, brauser varu), STT-l tühistamine ja kestuspiir; puuetega kasutajale selgitatud olekud.
4. **Nähtavad piirid.** Sõnumipikkus, turn-limit ja tellimusepiir kuvatakse enne vastu jooksmist; tasuta/tasulise raja predikaat on ÜKS jagatud funktsioon väravas ja marsruuteris.
5. **Vestlus kui töövoogude neutraalne käivitusplats** (praegune tugevus): jagamine ainult kinnitusega; režiimisildid; „mis salvestub" on igas režiimis ühe lausega öeldud.

---

## 14. Paketid VEST-P0 … VEST-P4

Analüüsidokumendi valmimine EI tähenda ühegi paketi valmimist; iga pakett on eraldi auditeeritav.

| Pakett | Sisu (leiud) | Iseloom | Eeldused |
|---|---|---|---|
| **VEST-P0 Kriisiraja parandus** | L1a+L1b+L1c+L4 | ainult kinnitatud kriisiparandused; väike, failipõhine | O-V1 tekst (vaikeversioon pakutud ptk 15) |
| **VEST-P1 Mitmekeelne kriisituvastus** | L2 | regex-komplekt RU/EN + testkorpus | O-V2 |
| **VEST-P2 Elutsükli ausus** | L3 (kursor-fix, kohe tehtav) + L11 (retry + ERROR-olek) + L5 (stop=stop) | L3 on 1-realine + test; L5 vajab salvestuslepingu otsust | O-V3 (ainult L5 osa) |
| **VEST-P3 Hääle võrdsus** | L8 + L9 + L17 | kliendi-hookid + i18n; server valmis | O-V7 (ainult L8 kulu) |
| **VEST-P4 Piirid ja puhastus** | L6 + L7 + L10 + L12 + L16 (+L14/L15 märkmed) | väravad, i18n, skeemipuhastus (isPinned vajab migratsiooni → eraldi otsustada) | O-V4, O-V5 |

---

## 15. Täpne järgmine Sol/Codexi pakett: VEST-P0 (rakendusvalmis)

**Eesmärk:** kriisis kasutaja saab ALATI kriisijuhise ja bänner püsib; töövoo-harud ei kustuta kriisisignaali.

**Failid (ainult need):**
1. `lib/chat/promptBuilder.js` — lisa `langStrings`'i igasse keelde `crisisNoCtx` (vaiketekst allpool; serverT-võtmena `chat.fallback.crisis_no_context`).
2. `messages/et.json`, `messages/en.json`, `messages/ru.json` — uus võti `chat.fallback.crisis_no_context` (NB: tõlkefailide muutmine on siin paketi OSA, mitte keelatud skoop — lint nõuab kolmekeelset pariteeti).
3. `app/api/chat/route.js` — rida 383 jääb samaks (võti nüüd olemas); kontrolli, et greeting-haru kriisi ei varjuta (praegu `greeting && !isCrisis` — OK).
4. `lib/chat/persistence.js` — `persistDone`: kui `finalText` on tühi JA `isCrisis`, salvesta assistendi sõnum crisis-fallback tekstiga (`metadata.isCrisis=true`); ära muuda muud tühja-vastuse käitumist.
5. `lib/chat/workflowBranchHandlers.js` — võta `isCrisis` parameetrina vastu (route.js edastab bootstrap'i väärtuse) ja anna läbi `finalizeReply`+`buildResponse` kutsetesse (5 kohta); töövoo sisuloogikat EI muudeta.
6. `components/chat/hooks/useChatConversationState.js` — hüdratsioon EI alanda `isCrisis` true→false, kui viimane lokaalne pööre on kriisiga ja server pole seda pööret veel näinud (nt: alanda ainult siis, kui serveri sõnumiloend sisaldab lokaalse viimase kasutajasõnumi järgset assistendi vastust).
7. `components/chat/hooks/useChatStream.js` — vea-harudes (`!res.ok`, catch): kui saatmiseelne bootstrap-tulem pole teada, siis vähemalt ÄRA nulli olemasolevat kriisiseisu (praegune `setIsCrisis(false)` saatmise alguses + vea korral taastamata = kustutab); lihtsaim leping: kriisiseisu langetab ainult uus edukas mitte-kriisi vastus või vestluse vahetus.

**Vaiketekst (O-V1 kinnitamiseni, ET; EN/RU tõlgitakse samas struktuuris):**
> „Kui sa oled otseses ohus või mõtled enesevigastamisele, helista kohe 112. Lapsi ja peresid puudutav mure: lasteabi 116 111 (ööpäevaringne, tasuta). Vägivalla või kuriteo ohvrile: ohvriabi 116 006. Kui saad, ütle mulle oma vald või linn — otsin sulle lähima abi kontaktid."

**Testid (node:test, fake-prisma mustriga; ELAVAT DB-d EI kasutata):**
- `langStrings('et'|'en'|'ru').crisisNoCtx` on mittetühi ja sisaldab „112".
- `persistDone` tühja `finalText` + `isCrisis:true` → loob assistendi sõnumi `metadata.isCrisis===true`.
- `handleHelpWorkflowBranch`/`handleDocumentWorkflowBranch` süstitud depsidega: `isCrisis:true` sisend → `buildImmediateChatResponse` sai `isCrisis:true`.
- Route-tasandi teست: kriis + tühi kontekst → vastuse `reply` mittetühi ja `isCrisis:true` (bootstrap/retrieval mockitud).
- Regressioon: mitte-kriisi tühi kontekst → endine `noContext` tekst.

**Vastuvõtukriteeriumid:**
1. Runtime (lokaalne, RAG/LLM maas): kriis+allikavajadus sõnum → HTTP 200, vastuse tekst sisaldab 112; UI-s `[role=alert]` bänner PÜSIB pärast voo lõppu ja pärast F5.
2. Dok-töövoos saadetud kriisisõnum → bänner kuvatakse (töövoo vastus ise muutumatu).
3. 502-simulatsioonis (võti puudub) → bänner kuvatakse (kliendi seis bootstrap-metast või säilitamisreeglist).
4. `npm test` 100%; `npm run i18n:check` puhas; lint puhas.
5. Mitte-kriisi vestluste käitumine bitihaaval sama (snapshot-testid noContext/greeting harudele).

**Keelatud skoobilaiendused:** detectCrisis regexi muutmine (see on VEST-P1), Stop/katkestuse käitumine (VEST-P2), kursor-fix (VEST-P2, kuigi 1-realine — hoia pakett puhas), UI-komponentide ümberdisain, skeem/migratsioonid, RAG-loogika.

---

## 16. Tooteomaniku otsused

| # | Küsimus | Kontekst | Vaikimisi soovitus |
|---|---|---|---|
| O-V1 | Kriisi-fallback ametlik tekst 3 keeles (kas 116 111 ja 116 006 jäävad; kes kinnitab numbrid?) | L1 parandus vajab teksti | ptk 15 vaiketekst |
| O-V2 | Kriisituvastuse keeled ja meetod: RU/EN regex kohe; kas hiljem mudel-klassifikaator? valepositiivide talutavus (nt SW tööalased sõnumid) | L2; regex on odav, klassifikaator täpsem | regex kohe, klassifikaator RAG-QM baasjoone järel |
| O-V3 | Stop-leping: katkesta server + salvesta osaline märkega „katkestatud" VÕI ära salvesta üldse? | L5; mõjutab kulu ja ajalugu | katkesta + salvesta osaline märkega |
| O-V4 | Kas tellimuseta abi-intent peab saama üldvastuse asemel suunatud pakkumise („alusta abisoovi töövoogu / telli")? | L7 kulupiir | jah: värav ja marsruuter ühele predikaadile |
| O-V5 | Sõnumi maksimaalne pikkus kasutajale (praegu mudel näeb 1500 tm) + kas vastuse keel = UI keel jääb? | L6, L19 | UI-piir 4000 tm loenduriga; mudelipiir tõsta ~4000-le; replyLang jätta UI-põhiseks, dokumenteerida |
| O-V6 | Kriisisündmuse logi ulatus (praegu userId+event, sisuta) ja säilitus (90p) — kas vajab eraldi režiimi? | privaatsus vs analüütika | jätta praegune, dokumenteerida |
| O-V7 | RU/EN server-TTS sisselülitamine (Google'i kulu) vs brauseripõhine | L8 | server-TTS kõigile keeltele |

---

## 17. Lõpphinnang

Vestlusaken on arhitektuurilt küps: rollid ja omandipiir on serveris ühe resolveri taga (runtime-tõendatud), voogedastuse ja topeltsaatmise leping on korralik, privaatsuskihid (PII-värav, sisuta logid, mööduv failianalüüs, nõusolekupõhised töövood) on läbimõeldud ning i18n-distsipliin eeskujulik. Töövoogude käivitamine vestlusest on tugevaim osa — jagamata vestlussisu ei liigu kuhugi automaatselt ja iga režiim on sildistatud.

Kriitiline nõrkus on **kriisirada**, mis on praegu pigem lubadus kui garantii: neli sõltumatut katkekohta (defineerimata fallback-võti, mittepüsiv bänner, veaharude vaikus, töövooharude kõvakodeeritud `false`) tähendavad, et just kõige haavatavamal hetkel võib kasutaja saada „Vabandust, ma ei saanud vastust koostada" — see on runtime'is läbi päris UI tõendatud, mitte teoreetiline. Parandus on väike ja failipõhine (VEST-P0, rakendusvalmis ptk 15). Teine reaalselt katkine asi on külgriba pagineerimine (1-realine pärandviga, 500). Ülejäänu on juhitav UX- ja piirivõlg (Stop-illusioon, vaikne kärpimine, hääle keelte ebavõrdsus, tellimusevärava predikaadilõhe), millele on selged paketid ja otsusekohad.

Rakenduskoodi, Prisma skeemi, migratsioone, teste ega tõlkefaile selle analüüsi käigus ei muudetud; midagi ei commit'itud, push'itud, merge'itud ega deploy'tud; kõik sünteetilised runtime-kirjed on kustutatud (ptk 1.2).

STATUS: COMPLETE
