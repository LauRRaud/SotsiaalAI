# PERF-COST-A0 — jõudluse, kasutuskulu ja skaleeruvuse tervikaudit

**Kuupäev:** 2026-07-17 · **Autor:** Fable 5 (read-only audit) · **Ulatus:** kogu platvorm, voopõhine
**Baasseisud:** origin/main = **fe4eb4fa** (= serveri release, SSH-kontroll 17.07 hommikul) · lokaalne main = 0da4185b (1 pushimata docs/CSS-commit ees, **22 commit'i taga** origin/main-ist) · töökataloogis commit'imata CSS/register-muudatused (perf-mõjuta)

> Selle dokumendi väited on märgitud seisuga: **[MAIN]** = origin/main kood, **[LOKAALNE]** = ainult lokaalses töökataloogis, **[SERVER]** = tootmisserveri runtime-kontroll 17.07, **[TULEVIK]** = analüüsitud, aga teostamata plaan. Kui märget pole, kehtib [MAIN] ja on identne lokaalse töökataloogiga (22 vahepealset commit'i puudutasid Help/Admin/RAG-privaatsust ja dokumente, mitte siinseid kulurada-faile — kontrollitud `git diff --stat main origin/main`).

---

## 0. Edenemistabel

| # | Ülesande osa | Seis |
|---|---|---|
| 1 | Baasseisud: origin/main, lokaalne git, serveri release | TEHTUD (fe4eb4fa mõlemas; lokaalne 1 ees / 22 taga) |
| 2 | Serveri read-only ülevaade (protsessid, timerid, ketas, mälu, DB) | TEHTUD |
| 3 | Next.js API-route'ide serveritöö (chat, rooms, research, stt/tts, admin) | TEHTUD |
| 4 | Kliendipoolne renderdus, polling, bundle | TEHTUD (bundle-mõõtmine `not_run`) |
| 5 | PostgreSQL: indeksid, pagineerimine, N+1, JSON-väljad | TEHTUD |
| 6 | Vestluse/RAG/süvauuringu/agent-dokumentide kulurajad | TEHTUD |
| 7 | OpenAI kutsed, tokenid, retry, Stopi tegelik mõju | TEHTUD |
| 8 | Embedding / dense+BM25 / re-ingest kulu | TEHTUD (ingest-detailrada osaliselt, vt not_run) |
| 9 | STT/TTS serverikulu | TEHTUD |
| 10 | Failide upload/parsimine/eksport/salvestus | TEHTUD (toetub FAILID-A0 + EXPORT-A0 tõenditele) |
| 11 | Ruumid, SSE, polling, kõne, salvestus | TEHTUD |
| 12 | Teavitused, reconciler'id, timer'id, kattuv töö | TEHTUD |
| 13 | Admin-analüütika koondpäringud | TEHTUD |
| 14 | Välised teenused ja kulukohad (e-post, storage, LiveKit, Maksekeskus) | TEHTUD |
| 15 | Limiidid vs tegelik kulu; tasuta rajad | TEHTUD |
| 16 | K1/U1 tulevikumõju; kasvustsenaariumid | TEHTUD |
| 17 | Leiud P0–P3, paketid, otsused, jätkamispunkt | TEHTUD |

Runtime-kontrollid piirdusid **read-only** SSH-vaatlusega (protsessid, timerid, unit-failid, DB tabelimahud, nginx-grep). Koormusteste, tasulisi väliskutseid ega kasutajasisu lugemist ei tehtud.

---

## 1. Praeguse jõudlus- ja kulumaastiku kaart

### 1.1 Füüsiline maastik [SERVER]

Üks VPS (6,8 GB RAM, 48 GB ketast, load ~0.00, swap 2 GB) on **jagatud masin**, kus sotsiaal.ai kõrval elavad veel vähemalt kolm muud Next-rakendust ja kogu taristukiht:

| Protsess | Port | RSS (17.07) | Roll |
|---|---|---|---|
| next-server v16.2.10 (systemd `sotsiaalai-frontend`) | 3000 | ~390 MB | sotsiaal.ai frontend + kõik API-route'id |
| uvicorn `sotsiaalai-rag` (1 worker) | 8000 | **~1 003 MB** | RAG-teenus: Chroma + BM25 + OpenAI embeddings |
| next-server v16.2.4 | 3010 | ~200 MB | muu sait (beyondframes vhost) |
| next-server v16.2.9 | 3020 | ~334 MB | muu sait |
| next-server v15.5.9 | 3030 | ~187 MB | muu sait (vana Next 15!) |
| livekit-server | 7880/7881/5349 | ~52 MB | isehostitud SFU (kõned) |
| livekit-egress (docker) | 7980 | ~19 MB | salvestus-egress (praktiliselt jõude: recordings-kaust 244 KB) |
| postgres 16 (shared_buffers 128 MB, work_mem 4 MB, max_conn 100) | 5432 | ~30+ MB | KÕIGI saitide DB-d (sotsiaal_ai, avasta, beyondframes, raio) |
| redis | 6379 | väike | roomStream pub/sub + LiveKit |
| nginx | 80/443/8080 | väike | reverse proxy; sotsiaal.ai vhost: `proxy_buffering off`, `proxy_read_timeout 300s` |

**Tähtis kontekst:** sotsiaal_ai andmebaas on **40 MB**, ChatLog'is 14 elusrida (9,9 MB tabel = varasema `analytics/reset`'i + retention'i jääkbloat), 1 tellimus, 8 vestlussõnumit. **Platvormil pole veel sisulist tootmiskoormust** — kõik allpool olevad skaleerumisleiud on ettevaatavad, mitte tänane valu. See on auditi kõige ausam lähtefakt.

### 1.2 Taustatööde maastik [SERVER]

| Timer/teenus | Sagedus | Tegelik käitumine 17.07 |
|---|---|---|
| `sotsiaalai-notifications.timer` → `npm run notifications:dispatch` | iga 5 min (`OnUnitActiveSec=5min`) | töötab; tühikäigutsükkel ~1 s, `{"created":0,"sent":0,…}` — odav |
| `sotsiaalai-practice-reviews.timer` | 1×/päev (~03:18) | töötab |
| `sotsiaalai-service-availability.timer` | 1×/päev (~04:14) | töötab |
| `sotsiaalai-research-worker.service` | — | **PUUDUB** (unit not found; deploy-skript restarcib ainult "kui olemas") |
| tellimuste uuendus (`payments:renewals`) | — | **EI OLE KUNAGI AJASTATUD** — ei timerit, ei crontabi (ubuntu + root tühjad, /etc/cron.d ainult certbot/sysstat) |
| makse-alertid (`payments:alerts:dispatch`) | — | samuti ajastamata |
| retention-sweep | — | timerit pole; jookseb **laisalt request-rajas** (vt L8; kattub FAILID F-06-ga) |

### 1.3 Väliste kutsete maastik [MAIN]

Kõik OpenAI kutsed käivad läbi väheste kitsaskohtade — see on hea:

- **Vestlus:** `lib/chat/openaiRuntime.js` — Responses API, mudel `gpt-5.4-mini` (env `OPENAI_MODEL`), stream + mitte-stream; kasutus logitakse `openai_usage` sündmusena.
- **Dokumendid/artefaktid:** `lib/documents/generation.js` (4 `responses.create` kutsekohtа — üks LLM-kutse genereerimis-/refine-sammu kohta), `meetingSummaryJobs.js` (STT `gpt-4o-mini-transcribe` + kokkuvõte mini-mudeliga).
- **Süvauuring:** `lib/research/pipeline.js` — planner + süntees, profiilipõhised eelarved (light: 120 s / 1200 tok; standard: 300 s / 2200 tok; alampäringud 3/5, RAG topK 3/4). Ainuke rada, kus AbortController on korrektselt läbi viidud.
- **STT:** `app/api/stt/route.js` — `gpt-4o-mini-transcribe`, max 12 MB, rate-limit 20/min.
- **TTS:** `app/api/tts/route.js` — `gpt-4o-mini-tts` VÕI Google Cloud TTS (klient cache'itud), rate-limit 30/min.
- **Embeddings:** ainult rag-service (`text-embedding-3-large`) — nii ingest'il kui **igal otsingul** (1 kutse / search-päring).
- **Help-töövoo ekstraktor:** `gpt-5.4-nano` (`lib/help/aiExtraction.js`).
- **E-post:** SMTP `lib/mailer.js` kaudu; kolm paralleelset saatmisrada (konveier + otsekirjad + availability-reminder) — K1-U1 analüüsi U1-A4 kinnitatud.
- **Maksekeskus:** init/webhook/renewals (MAKSED-A0 kaetud; siin ainult ajastuse leid L3).

Mudelite hindu selles dokumendis **ei arvutata** (hinnakiri pole auditist verifitseeritav); kulule viidatakse suhteliselt: nano < mini ≪ suured; embedding-kutsed on tokenihinnalt marginaalsed, aga **latentsuselt** mitte.

---

## 2. Voopõhine latentsuse ja kulu maatriks

### Tabel A — käivitaja, töö ja latentsus

| Voog | Käivitaja | API / taustatöö | DB-päringud (suurusjärk) | Välised kutsed | Kordus/retry | Kasutaja latentsus |
|---|---|---|---|---|---|---|
| **V1 Vestlus (RAG+stream)** | kasutaja sõnum | `POST /api/chat` (SSE) | ~25–40: bootstrap+auth, usage reserve×2 (~9 päringut tk), persist, 3–8 ChatLog-eventi | 1× mini-LLM (stream) + 1–15× RAG `/search` (igaüks = 1 embedding + 1 mirror-POST→ChatLog) | usage-tx retry 3×(P2002/2034); RAG optional-etapid neelavad vead; **LLM-il retry'd pole** | esimese deltani = RAG-etappide summa + LLM TTFB; halvim rada kümneid sek (L6) |
| **V2 Dokumenditöövoog vestluses** | kasutaja intent | sama route, document-branch | nagu V1 + artefakti persist | 1× mini-LLM / samm | idem | sekundid–kümned sek |
| **V3 Failianalüüs** | üleslaaditud fail vestluses | `POST /api/chat/analyze-file` | FILE_ANALYZE reserve/commit + doc-read | 1× mini-LLM (chunk'itud kontekst; CHAT_DOC_CONTEXT_* piirid) | idem | sekundid |
| **V4 Süvauuring** | kasutaja käivitab | `POST /api/research/jobs` + SSE `/stream`; inline-mode: queueMicrotask samas protsessis; worker-mode: eraldi teenus | job-CRUD + iga snapshot-poll 1 päring / 2,5 s / klient | planner-LLM + N×RAG + süntees-LLM (profiilipiirid) | pipeline'is throwIfAborted + timeoutid; **poll'idel kestuspiiri pole** | light ≤2 min, standard ≤5 min; serveris praegu: **∞ ootamine** (L1) |
| **V5 STT** | mikrofon/heli | `POST /api/stt` | reserve/commit STT_SECONDS + cost-event | 1× transcribe-kutse | rate-limit 20/min; duration-põhine commit | ~heli pikkus + võrk |
| **V6 TTS** | ette lugemine | `POST /api/tts` | reserve/commit TTS_CHARS + cost-event | 1× TTS (OpenAI või GCP) | rate-limit 30/min | sekundid |
| **V7 Ruumisõnum** | liige kirjutab | `POST …/messages`; levitus Redis pub/sub → SSE | insert + liikmete kontroll; SSE-ühendus: **3 SELECT / 20 s / klient** (recheck) + hb 15 s | — | kliendi fallback-poll 3 s kui SSE maas; algpoll kuni SSE avaneb | <100 ms saatja→saaja (pub/sub) |
| **V8 Kõne (LiveKit)** | liige alustab | calls/start→join; SFU samas masinas | call-session CRUD | LiveKit lokaalne; egress ainult kui RECORDING_ENABLED=true (praegu false; covision hardcode false) | — | WebRTC; CPU jagatud teiste äppidega |
| **V9 Faili üleslaadimine/parsimine** | kasutaja fail | `POST /api/documents` (25 MB piir); transkriptsioon 50 MB | STORAGE_BYTES kontroll + doc insert (sisu tekstina DB-s, fail kettal `storagePath`) | parse in-request (pdf-parse jm; FAILID K4: dekompressioonipiirid osalised → CPU-risk); STT vajadusel | — | sekundid; suurtel PDF-idel CPU-piik |
| **V10 Eksport** | kasutaja laeb alla | chat/export, documents/…/download, artifacts/…/download | read + audit | PDF/DOCX genereeritakse in-request (EXPORT-A0: kõik PDF-id Latin-1) | — | sekundid |
| **V11 Teavituskonveier** | timer 5 min | `notification-job.mjs` → reconciler + delivery | tühikäigul ~10 SELECT; delivery batch ≤40 kirja/tsükkel | SMTP sendMail / kiri | timing-safe job-key; retry-väljad NotificationEventil | — (taust) |
| **V12 Admin-analüütika** | admin avab | summary (68 prisma-kutset), ai-costs, users | ai-costs: **piiramata findMany** perioodi event'idele + 2. findMany + subs/users lookup | — | — | kasvab andmemahuga lineaarselt |
| **V13 RAG ingest/re-ingest** | admin | admin/rag/* → rag-service /ingest/* | registri-CRUD | embedding-batch'id (≤2048 sisendit/kutse, sub-batch pakkimine) | quota/ratelimit-vead pinnale; re-ingest = täiskulu uuesti | admin ootab; single-worker blokeerib otsinguid (L10) |
| **V14 Maksed** | kasutaja/webhook | subscription/init, callback, webhook | payment CRUD; webhook idempotentne (MAKSED ✔) | Maksekeskus | renewal: uus providerPaymentId/katse; retry-ajakava 1/3/5 p | — |
| **V15 Retention-sweep** | esimene chat-conversations päring pärast 6 h | inline `maybeRunRetentionCleanup` | ~25 tabelit deleteMany + dokumentide kaupa N+1 | — | in-memory throttle (instantsi-/restardipõhine) | selle ühe kasutaja päring maksab sweep'i kinni |

### Tabel B — ressursid, raha, kaitsed, mõõdetavus, risk

| Voog | CPU/mälu/storage/egress | Otsene rahaline kulu | Limiit/kaitse | Mõõdetavus | Skaleerumisrisk | Seis |
|---|---|---|---|---|---|---|
| V1 | Node CPU madal (stream-passthrough); RAG-teenuse CPU+RAM; ChatLog kasv ~5–10 rida/sõnum | mini-LLM väljund (~≤ paar tuhat tok) + N× embedding (marginaalne) | rate-limit 24 POST/min; history 8×800; ctx 6000 chars; CHAT_ASSISTANT_REPLY + RAG_SEARCH kvoodid | openai_usage + openai_stream_timing + rag_trace + rag_cost_usage — **hea**; aga 90 p pärast kustub (L5) | RAG-fanout × samaaegsus → single-worker järjekord (L6+L10); Stop ei säästa (L2) | [MAIN]=[SERVER] |
| V2/V3 | nagu V1 | 1 LLM-kutse/samm | DOCUMENT_GENERATE 2–8/näd; FILE_ANALYZE 4–20/näd | openai_usage stage'idega | madal | [MAIN] |
| V4 | inline-mode seob Next-protsessi ~2–5 min | 2+ LLM + N×embedding / run | DEEP_RESEARCH_RUN 2–12/kuu; ACTIVE_JOB_LIMIT=1; profiili aja-/tokenipiirid — **disain hea** | metrics job-kirjes + research_request event | **L1: reservatsioonileke + töötlemata jobid serveris** | [SERVER] katki; [MAIN] inline töötab |
| V5/V6 | heli mälus (≤12 MB) request'i ajal | sekundi-/märgipõhine | kvoodid + rate-limit — **eeskujulik** | tts/stt_cost_usage eventid | madal | [MAIN] |
| V7 | SSE-ühendus ~0 CPU; recheck-SELECT'id | — | liikmesus+billing recheck 20 s | — (ühenduste arvu ei mõõdeta) | L9: recheck+poll kasv; Redis pub/sub ise skaleerub hästi | [MAIN] |
| V8 | SFU CPU jagatud masinas; egress jõude | — (isehostitud) | RECORDING_ENABLED värav (ruum-audit ptk 20 nõuab lisaväravaid enne sisselülitust) | LiveKit logid | kõnede arv × jagatud CPU | [SERVER] |
| V9 | parse-CPU in-request; ketas kasvab failidega; tekst DB-s | STT kui heli | 25/50 MB piirid; STORAGE_BYTES LIFETIME kvoot | DocumentAudit + cost-eventid | FAILID K4 dekompressioon-CPU | [MAIN] |
| V10 | PDF-gen CPU in-request | — | auth + omanikukontroll | audit | suured ekspordid = CPU-piigid | [MAIN] |
| V11 | ~1 s / 5 min | SMTP kirjad | batch 40; dedupe; timing-safe key | job-JSON logis | e-kirjade maht kasvab lineaarselt, batch kaitseb | [SERVER] tõendatud |
| V12 | mälu: kõik perioodi eventid korraga JS-is | — | admin-gate (P0.1 gate'id origin/main'is) | — | L7: findMany piiramata | [MAIN] |
| V13 | embedding-batch + Chroma kirjutus; 1 GB RSS baas | embedding-tokenid (re-ingest = täishind uuesti) | API-key; batch-piirid | rag_cost_usage (ingest stage) | L10 | [MAIN]+[SERVER] |
| V14 | — | Maksekeskuse teenustasud | webhook idempotentne; renewal retry-ajakava | payment-eventid ChatLog'is (7 a retention) | **L3: renewals ajastamata** | [SERVER] |
| V15 | deleteMany-purse iga ~6 h | — | throttle | counters tagastatakse, aga kuhu? (kutsuja ei logi) | L8 | [MAIN] |

---

## 3. Väliste teenuste ja taustatööde register

| Teenus/töö | Kasutuskohad | Kulumudel | Väravad | Märkus |
|---|---|---|---|---|
| OpenAI Responses (`gpt-5.4-mini`) | chat, dokumendid, meeting-summary, research | tokenipõhine | kvoodid (ptk 4) + rate-limitid | üks mudel kõigeks — lihtne, prognoositav |
| OpenAI `gpt-5.4-nano` | help-ekstraktor | tokenipõhine, väike | help-workflow ise | |
| OpenAI embeddings (`text-embedding-3-large`) | rag-service ingest + **iga otsing** | tokenipõhine, väike; latentsus arvestatav | RAG_SEARCH kvoot node-poolel | query-embedding'ut ei cache'ita (TE2) |
| OpenAI STT/TTS (`gpt-4o-mini-transcribe/tts`) | /api/stt, /api/tts, meeting-summary | sekundi-/märgipõhine | kvoodid + rate-limitid | TTS-il ka GCP-alternatiiv |
| Google Cloud TTS | /api/tts (env-valik) | märgipõhine | sama | klient cache'itud protsessis |
| SMTP (mailer) | teavituskonveier + otsekirjad + availability-reminder + auth + admin bulk | kirja kohta | konveieril batch 40 + dedupe; bulk-email'il P0.1 gate'id [MAIN] | 3 paralleelset saatesüsteemi (U1-A4) |
| Maksekeskus | init/callback/webhook/renewals | teenustasu | idempotentne webhook | renewals ajastamata (L3) |
| LiveKit (isehostitud) + egress | ruumi-/covision-kõned | serveri CPU/RAM; egress → ketas | RECORDING_ENABLED=false | egress-konteiner jookseb jõude 24/7 (RAM ~19 MB — talutav) |
| Redis | roomStream pub/sub, LiveKit | — | — | ka SSE multi-instance-valmidus ✔ |
| Postgres 16 (lokaalne) | kõik | ketas/RAM jagatud | retention-klassid | 4 eri projekti DB-d samas klastris |
| systemd timerid | notifications 5 min; practice-reviews, service-availability 1×päev | — | timing-safe job-key'd | renewals/alerts/retention PUUDUVAD |
| In-process taustatööd | meetingSummaryJobs (Map+setInterval), research inline, jobStore sweep'id, tts/gcp klient | Next-protsessi RAM | TTL-id olemas | restart kaotab; multi-instance dubleeriks (L11) |

---

## 4. Limiitide ja tegeliku kulukäitumise võrdlus

Plaanid (`lib/usage/planSeeds.js`, [MAIN]):

| Metric | Tasuta | Pöörduja 7,99 € | Spetsialist 14,99 € | Teenuseosutaja 19,99 € | Admin |
|---|---|---|---|---|---|
| CHAT_ASSISTANT_REPLY / kuu | **0 (õigusi pole)** | 150 (soft 120) | 360 | 750 | 5000 |
| DOCUMENT_GENERATE / näd | 0 | 2 | 4 | 8 | 200 |
| DOCUMENT_REFINE / näd | 0 | 6 | 12 | 24 | 600 |
| FILE_ANALYZE / näd | 0 | 4 | 10 | 20 | 500 |
| DEEP_RESEARCH_RUN / kuu | 0 | 2 | 6 | 12 | 100 |
| RAG_SEARCH / kuu | 0 | 2000 | 5000 | 10 000 | 50 000 |
| STT s / kuu | 0 | 900 | 3600 | 7200 | 36 000 |
| TTS märki / kuu | 0 | 50 000 | 150 000 | 300 000 | 1 M |
| STORAGE_BYTES (eluaegne) | 0 | 50 MB | 100 MB | 150 MB | 10 GB |

**Vastavushinnang:**

1. **Tasuta rada EI võimalda tasulist RAG-i/LLM-i.** `resolveEntitlement` viskab `USAGE_NOT_ENTITLED`, kui aktiivset tellimust/override'i pole (`lib/usage/service.js:174-179`); free-plaanil entitlemente pole. Ruumi-SSE-l on eraldi billing-recheck. ✔ Vastus auditi küsimusele: tasuta täis-RAG-i auku ei leidnud.
2. **Limiidiühik vs serverikulu on mõistlikus vastavuses** seal, kus ühik = kutse (chat, document, research) või füüsiline suurus (STT-sekund, TTS-märk, storage-bait). **Erand: RAG_SEARCH** — kvoot loetakse 1× sõnumi kohta (`onBeforeRag`), aga tegelik töö on 1–15 `/search`-kutset (6 etappi × mitu päringut). Kasutaja "2000 otsingut" võib tähendada kuni ~20 000 tegelikku otsingukutset. Kulu on väike, aga **limiit ei mõõda seda, mida ta väidab mõõtvat**.
3. **Katkestatud/ebaõnnestunud/tühjad vastused arvestuses:**
   - LLM-i viga enne lõppu → release (`chat_stream_failed`) ✔;
   - tühi stream → fallback-tekst + **commit** (kasutaja "kulutab" ühiku sisutühja vastuse eest — teadlik valik? vt otsus T1);
   - **kasutaja Stop / tab kinni → töö jookseb lõpuni ja commit'itakse** (L2) — kulu ja limiit kuluvad, kasutaja ei näe vastust (see persistitakse siiski vestlusse);
   - research interrupted (15 min stale) → **ei commit'i ega release'i → reserveering jääb igavesti kinni** (L1/L4). `remaining = hard − used − reserved`, seega leke vähendab kuueelarvet püsivalt; kliendil (2/kuu) piisab 2 luhtunud katsest kuu lukustamiseks.
4. **Usage-süsteemi tuum on tugev:** BigInt-täpsus, atomaarne raw-UPDATE invariantidega, idempotency-key mõlemal suunal, UsageEvent-pearaamat, tx-retry P2002/P2034 peale. See on platvormi parim kaitsemuster.

---

## 5. Mõõdetavuse ja observability lüngad

1. **Kuluajalugu elab ainult ChatLog'is ja kustub.** `LOG_RETENTION_DAYS` vaikimisi = üld-90 p (`lib/retention.js:26-28`), aga ai-costs lubab küsida kuni 180 p (`MAX_PERIOD_DAYS=180`) — vaade näitab vaikides poolikut ajalugu. `admin/analytics/reset` kustutab kogu ChatLog'i (`reset/route.js:52`); origin/main'is on see nüüd ohtlike tegevuste gate'i taga (Admin P0.1, `lib/admin/dangerousAnalyticsActions.js` [MAIN], lokaalses mainis veel pole), aga gate ei muuda fakti, et **kuluajaloo ainus koopia on kustutatav logi**. Serveri ChatLog (14 rida, 9,9 MB bloat) näitab, et reset on juba käinud.
2. **Puudub püsiv agregaat** (päev × kasutaja × stage), mida retention ei puutuks — iga kuluaruanne loeb toorridu.
3. **SSE-ühenduste arvu, RAG-etappide arvu sõnumi kohta ja rag-service'i järjekorrapikkust ei mõõdeta.** rag_trace annab sisu-, mitte koormuspilti; `openai_stream_timing` on olemas (hea!), aga RAG-etappide koondaega sõnumi kohta ei salvestata.
4. **Retention-sweep'i tulemus ei jõua kuhugi** — `runRetentionCleanup` tagastab counters, kutsuja ignoreerib; timerit ega raportit pole (kattub FAILID F-06).
5. **Deploy ei hoiata**, kui `RESEARCH_JOB_MODE=worker`, aga worker-unit'i pole (deploy-server.mjs restarcib tingimuslikult ja vaikib).
6. **pg-tasand:** pg_stat_statements/bloat/VACUUM-seisu ei vaadatud (not_run) — praeguse 40 MB juures ebaoluline, kasvades vajalik.

---

## 6. Leiud P0–P3

Iga leid: **[tase] · seis · tõendid**. Ei dubleeri RAG-QM/MAKSED/VEST/ADMIN/FAILID/EXPORT leide — viitan neile.

### L1 · P0 · Süvauuring toodangus: töötlemata jobid + kvoodileke [SERVER]+[MAIN]
Serveris `RESEARCH_JOB_MODE=worker` (FAILID-A0 rida 23), aga `sotsiaalai-research-worker.service` **puudub** (systemctl: not found; ainult inline-käivitus `route.js:246-254` jääb worker-mode'is vahele). Tagajärjed:
- job jääb `queued`; 15 min pärast märgib `markStaleActiveJobsInterrupted` (`lib/research/jobStore.js:101-116`) selle `error`'iks **otse updateMany'ga, kutsumata `settleResearchUsage`'t** → DEEP_RESEARCH_RUN reservatsioon jääb RESERVED-olekusse igaveseks (release-rada `jobStore.js:162-181` on olemas, aga seda ei läbita);
- ootamise ajal pollivad **nii** server-SSE (`stream/route.js:151-172`, 1 DB-päring / 2,5 s, kestuspiirita) **kui** klient (`useChatStream.js:387-390`, REST-poll 2,5 s) — topeltpoll kuni kasutaja loobub;
- `ACTIVE_JOB_LIMIT=1` vabaneb küll 15 min pärast, aga iga katse põletab kvoodiühiku (klient: 2/kuu).
**Mõju:** funktsioon on maksval kasutajal katki JA lukustab tema kuueelarve. Rahaline kulu OpenAI-le = 0 (tööd ei tehta), kahju on toote- ja limiidipoolne.

### L2 · P1 · Stop/katkestus ei peata AI-tööd ega kulu [MAIN]
`streamOpenAI` ei võta abort-signaali (`openaiRuntime.js:60-96` — `client.responses.stream(payload)` signalita); `req.signal` abort-listener seab ainult `clientGone=true` (`mainResponseHandler.js:872-878`); `for await` tarbib voo lõpuni, `finalizeStreamReply` **commit'ib usage** (rida 834) ja persistib täisvastuse. Sama kehtib tabi sulgemisel. VEST-A0 nimetas seda Stop-illusiooniks (UI-vaade, pakett VEST-P2); siinne lisatõend: **ka kulu- ja limiidiarvestus jookseb alati täismahus**. Mahajäetud vestlused = 100% OpenAI-kulu ilma lugejata.

### L3 · P1 (ops) · Tellimuste uuendus ja makse-alertid pole kunagi ajastatud [SERVER]
`scripts/subscription-renewals.mjs` + `POST /api/jobs/subscription-renewals` on olemas ja MAKSED-A0 kirjeldab rada "[cron] POST …" — aga serveris pole ei timerit ega crontabi (17.07: `crontab -l` mõlemal tühi; /etc/cron.d ainult certbot/e2scrub/sysstat; timers-loendis 3 sotsiaalai-timerit). Sama `payment-alert-dispatch`. Praegu 1 tellimus DB-s → pole veel valus, aga esimene päris-tellimus **ei uuene kunagi** ja läheb vaikselt PAST_DUE→CANCELED alles siis, kui keegi jobi käsitsi käivitab (või mitte kunagi). Seos MAKSED L-05-ga (stuck-INITIATED reconciliation puudub) — mõlemad on "keegi-ei-käivita" klassi ops-leiud.

### L4 · P1 · UsageReservation'i reaper puudub; expiresAt ei seata kunagi [MAIN]
`service.js:291` salvestab `expiresAt: input.expiresAt || null`; `lib/usage/routeAdapter.js` ei sea seda üheski rajas (grep: 0 vastet); indeks `@@index([status, expiresAt])` on skeemis valmis, aga **ükski töö ei vabasta aegunud RESERVED-kirjeid** (retention.js ei puutu usage-tabeleid; scripts/, app/api/jobs/, internal/ — 0 vastet). Iga settle'imata rada (L1; protsessi restart commit'i eel; tapetud ühendus enne finalizet mitte-stream-rajal) vähendab püsivalt kasutaja `remaining`'ut. Leke on vaikne ja kumulatiivne.

### L5 · P1 · Kuluajalugu kustub / on kustutatav ilma agregaadita [MAIN]
Vt ptk 5 p 1–2. Tõendid: `retention.js:221-247` (chatLog deleteMany logCutoff + payment-eventide eraldi pikem klass), `ai-costs/route.js:19-20,587-600`, `reset/route.js:52`. Auditi küsimusele "kas logide kustutamine muudab kuluajaloo eksitavalt nulliks" — **jah**, nii retention kui reset teevad seda; 7-aastase klassiga on kaitstud ainult payment-eventid.

### L6 · P2 · RAG-otsingu kordistaja ilma sõnumiülese eelarveta [MAIN]
Üks sõnum võib läbida kuni 6 otsinguetappi (`retrievalContextAssembler.js:1409-1630`: primary → national-fallback → background-scope → KOV-regulation → graph-channel → temporal-fill aastate kaupa `Promise.allSettled`), igaühes 1–N päringut (worker-pool 3; `searchRagQueries` dedupe ✔). Iga `/search` [rag-service] = 1 sünkroonne OpenAI-embedding (`main.py:4517`) + Chroma + leksikaalne skoor + **sünkroonne kulu-mirror POST node'i** (`main.py:697-773`) samas latentsusrajas. Kutsepõhised timeoutid (12 s / 18 s) on olemas, aga **sõnumiülest max-kutsete arvu ega koond-tähtaega pole** — halvim rada = kümneid sekundeid enne LLM-i esimest deltat, ja iga etapp lisab ChatLog-ridu. Kvoot loeb seda kõike 1 RAG_SEARCH-iks (ptk 4 p 2).

### L7 · P2 · Admin-kuluvaade loeb piiramata hulga ridu mällu [MAIN]
`ai-costs/route.js:587-613`: kaks `findMany`'t ilma `take`'ta üle kuni 180 p event'ide (koos `data` JSON-iga), agregeerimine JS-is; +subs/users lookup. Sõsarvaated: summary = 68 prisma-kutset (bounded: count/groupBy/take 1000). Praegu tühi DB → ok; kasvades esimesena valutav admin-leht. (ADMIN-A0 M2 "vaikiv 500-lagi" on eraldi, users-vaate leid — ei dubleeri.)

### L8 · P2 · Retention-sweep on laisk, request-rajas ja N+1 [MAIN]
Käivitub ainult chat-conversations route'ides (`routeServerUtils.js:42-44`, `conversations/route.js:106`), in-memory 6 h throttle (`retention.js:467-492`) — restart/instants nullib; kui keegi vestlusloendit ei ava, ei koristata üldse. Sweep ise: ~25 deleteMany + dokumentide loop-is ükshaaval `deleteMany({id})` (`retention.js:382`). Üks juhuslik kasutaja maksab latentsusega kinni kogu koristuse. (FAILID F-06 = sama juurleid; siin kinnitus + N+1 detail. Parandus kuulub kokku L3 timeri-teemaga: retention väärib oma timerit.)

### L9 · P2 · Ruumi-SSE taustapäringud + poll-fallback [MAIN]
Iga SSE-ühendus teeb 20 s intervalliga täieliku accessi-recheck'i = 3 SELECT-i (room, roomMember, subscription — `stream/route.js:52-93,156-167`). Klient käivitab lisaks 3 s polli enne SSE avanemist ja alati, kui SSE katkeb (`useRoomMessages.js:34,126,181` — poll peatub alles `es.onopen`-is). 100 samaaegset vaatajat ≈ 900 SELECT/min ainuüksi recheck'ideks. Redis pub/sub ise on õige ja multi-instance-valmis.

### L10 · P2 · RAG-teenus: 1 uvicorn-worker, sünk-endpointid, 1 GB RSS [SERVER]+[MAIN]
`--workers 1` (ps-kontroll); `def search` (sünk) → anyio threadpool; ingest ja otsing jagavad sama protsessi (GIL) ja mälu (Chroma PersistentClient ~1 GB juba tühja-DB seisus). Iga otsing ootab embedding-võrgukutset. Keskmise koormuse stsenaariumis (ptk 8) muutub see esimeseks pudelikaelaks. Mirror-POST (L6) võimendab.

### L11 · P3 · In-process taustatööd Next-serveri sees [MAIN]
meetingSummaryJobs: moodulitaseme `setInterval` + in-memory Map (heli kuni 12 MB mälus — FAILID kinnitatud), persist-peegel olemas; research inline-mode: `queueMicrotask` request-protsessis; jobStore omad sweep-intervallid. Ühe instantsi ja praeguse mahu juures OK (sellepärast P3), aga iga restart katkestab ja mitu instantsi dubleeriks — K1/U1 outbox-suund (variant B) on õige koht see klass korrastada.

### L12 · P3 · Telemetria kirjutusmaht sõnumi kohta [MAIN]
`logEvent` = 1 INSERT (`lib/chat/logger.js:6`); tüüpsõnum kirjutab openai_usage + openai_stream_timing + rag_trace-emissiooni + N× rag_cost_usage (iga /search-mirror) + plaani/vea-eventid ≈ 5–10+ rida. Praegu marginaalne; kasvul lineaarne nii mahus kui ai-costs-vaate ajas. Lahendus (agregaat/sämpling) alles pärast mõõtmist — mitte enne.

**Viidatud, mitte dubleeritud:** VEST-L3 kursor-500 (P1, 1-realine), VEST kriisirada P0; FAILID K4 dekompressioon-CPU, F-06; ADMIN M1 (bulk-email token replay) ja M2 (500-lagi); EXPORT E-1/E-2; MAKSED L-05, L-11.

---

## 7. Hästi töötavad kaitsed ja mustrid (ära lõhu)

1. **Usage-pearaamat** — reserve→commit/release, idempotency, BigInt, atomaarsed invariandid, sündmuslogi (`lib/usage/service.js`). Platvormi kuluarvestuse selgroog.
2. **Kihiline sisendipiiramine chat'is** — rate-limitid, ajaloo/konteksti char-eelarved env-nuppudega (`chat/route.js:35-50`), MAX_USER_MESSAGE_CHARS lõikamine mudelisse.
3. **Voogedastuse hügieen** — delta-koaleerimine (28–96 tähemärki / ≥120 ms), keepalive 15 s, `openai_stream_timing` telemeetria TTFB-ga.
4. **Redis pub/sub ruumidele** + nginx `proxy_buffering off` — SSE on õigesti torustatud otsast lõpuni.
5. **Cursor-pagineerimine `take+1` mustriga** kõigis kontrollitud loendites (conversations 30/100, messages 50/100, room-messages 50) — "kas suured loendid laaditakse korraga?" → ei.
6. **Research-profiilide eelarved** (aeg, tokenid, alampäringud, RAG-kontekst) + korrektne AbortController-rada pipeline'is — parim katkestusdisain repos; L2 parandus saab siit mustri võtta.
7. **RAG optsionaalsete etappide vea-eraldus** — background/regulation/graph/temporal ebaõnnestuvad vaikselt ilma põhivastust tapmata.
8. **Teavituskonveier** — batch 40, dedupe, retry-väljad, timing-safe job-key, tõendatud 1 s tühikäik.
9. **Indeksid on läbi mõeldud** — hot-tabelitel ([roomId,createdAt], [conversationId,createdAt], NotificationEventi kolmik, UsageEventi neli) + isegi tulevase reaperi [status,expiresAt].
10. **Retention on klassipõhine** (üld 90 p / logid / makse 7 a) — probleem on ainult käivitusmehhanismis, mitte mudelis.
11. **STT/TTS väravad** — suurus, kestus, rate-limit, kvoot, kulu-event — täiskomplekt.
12. **Admin ohtlike tegevuste gate'id** [MAIN] (P0.1) — reset jm destruktiivsed teed pole enam ühe kliki kaugusel.

---

## 8. Skaleerumisstsenaariumid

**S — praegune → ~50 aktiivset kasutajat (≤5 samaaegset):** kõik peab vastu. Ainsad päriselt katkised asjad on funktsionaalsed: L1 (research), L3 (renewals). RAM-varu 4,1 GB, DB 40 MB, load 0. Tegevus: PERF-P0 + ops-timerid, ei midagi arhitektuurset.

**M — ~500 registreeritut, ~50 samaaegset, ~10 paralleelset vestlust + mõni ruum/kõne:** esimesena valutab **RAG-teenus** (L6×L10): 10 samaaegset sõnumit × keskmiselt ~4–8 otsingukutset × (embedding-võrgulatentsus + mirror-POST) ühes Python-protsessis → järjekord, chat-TTFB kasvab sekunditesse. Teisena ruumi-SSE recheck'id (L9) ja ChatLog-i kasv (~10⁴–10⁵ rida/p → ai-costs vaade sekunditesse, L7). Postgres (128 MB shared_buffers) kannatab veel; LiveKit-kõned hakkavad CPU pärast konkureerima. Tegevus: PERF-P2 (fanout-eelarve), P4 (SSE/poll), P5 (uvicorn workers/mirror async), P3 (kuluagregaat).

**L — 5000+ kasutajat, sajad samaaegsed:** jagatud 6,8 GB masin ei ole enam õige koht — vajalik on eraldamine (järjekorras: RAG-teenus omale masinale VÕI Postgres välja; LiveKit eraldi, kui kõned on päris kasutuses), taustatööde viimine queue-põhiseks (U1 outbox annab raami), telemetria agregaat + sämpling, embedding-cache või lokaalne embedding, ja alles siis vektoribaasi valik (Chroma vs pgvector) mõõtmiste pealt. Täpsemaid numbreid ilma koormustestita ei esita — see oleks põhjendamata täpsus.

---

## 9. Mida MITTE optimeerida (praegu)

1. **Notification-timeri sagedust** (5 min / ~1 s tühikäik) — odav ja tõendatult töökindel; U1 projektor tuleb samasse rütmi.
2. **Admin-summary 68 päringut** — harv, bounded, admin-only; L7 (ai-costs findMany) on ainus admin-optimeerimine, mida teha.
3. **SSE → WebSocket migratsiooni** — SSE + Redis pub/sub on õige; probleem on ainult recheck-päringute kaal (P4), mitte transport.
4. **Chroma → pgvector** — enne M-taseme koormuse mõõtmist pole andmeid otsuseks.
5. **Prisma → raw SQL üldiselt** — usage-teenuse raw-tuum on juba seal, kus vaja.
6. **Vastuste cache'imist / mudeli downgrade'i** — kvaliteedirisk ilma tõendatud kulusurveta; RAG-QM baasjoon on enne ees.
7. **Bundle-mikrooptimeerimist** — enne `npm run analyze` mõõtmist (not_run) pole sihtmärki; SessionProvider on juba polling-vaba, raske sõltuvus on ainult livekit-client.
8. **Teiste portide (3010/3020/3030) Next-protsesse** — need on teised saidid, mitte sotsiaal.ai praak; neid tohib ainult RAM-eelarvena arvestada (O3).
9. **Postgres'i tuning'ut** (shared_buffers jm) — 40 MB andmete juures müra.
10. **ChatLog-i kirjutuste vähendamist** (L12) — enne kuluagregaadi (P3) olemasolu kaotaks sämpling just selle nähtavuse, mida praegu ehitame.

---

## 10. Paketistus PERF-P0…P6

| Pakett | Sisu | Sõltuvused/otsused |
|---|---|---|
| **PERF-P0 — reservatsioonide elutsükkel + research-valvekoer** (esimene, otsustevaba — ptk 12) | (a) `markStaleActiveJobsInterrupted` → settle release; (b) routeAdapter seab `expiresAt` + retention/timer vabastab aegunud RESERVED; (c) research-SSE dbPoll'i ja kliendi persistence-polli ülempiir; (d) deploy/env hoiatus worker-mode+unit-puudumise kohta | — |
| **PERF-P1 — Stop = stop** | abort-signaal `streamOpenAI`-sse + OpenAI stream.abort; usage-reegel: abort enne 1. deltat = release, pärast = commit; SSE 'aborted' sündmus | VEST-P2-ga koos (salvestusleping = otsus T1) |
| **PERF-P2 — RAG-raja eelarve** | sõnumiülene max-search-count + koond-deadline assembleris; mirror-POST taustale (fire-and-forget/puhver rag-service'is); telemetriasse search_count + rag_total_ms | — (väärtused env-nuppudena) |
| **PERF-P3 — kulu-observability püsivus** | päevane agregaattabel (kasutaja×stage×mudel) enne 90 p kustumist; ai-costs → aggregate-päringud + hoiatus kui periood > retention; reset ei puutu agregaati | T4 (kui pikk ajalugu on nõue) |
| **PERF-P4 — SSE/poll koormusprofiil** | rooms recheck 20 s→konfigureeritav + 1 kergem päring (join/cache); kliendi poll-fallback backoff; SSE-ühenduste arvu telemeetria | — |
| **PERF-P5 — ops-pakett** | renewals+alerts+retention timerid serverisse (unit-failid repossе!); uvicorn workers/threads ülevaatus; jagatud masina RAM/CPU eelarvedokument | O1–O3 |
| **PERF-P6 — telemetria maht** | ChatLog sämpling/agregaat + VACUUM/bloat kontroll | alles pärast P3 + mõõtmist |

---

## 11. Otsused

**Tooteotsused:**
- **T1.** Stop-lepingu salvestusreegel: kas katkestatud vastus salvestatakse poolikuna, visatakse ära või märgitakse? (= VEST O-V3; blokeerib P1 lõpuvormi, mitte tehnilist algust). Ühtlasi: kas tühi-stream-fallback peab kvooti kulutama?
- **T2.** Kas tasuta plaan jääb 0-õigustega (praegune seis) või saab proovikvoodi? Mõjutab kulu­prognoosi otseselt.
- **T3.** Research'i ootel-UX: mida kasutaja näeb, kui job on queued (praegu: lõputu ootus) — teade + katkestusnupp + kvooditagastus?
- **T4.** Kui pikk kuluajalugu on äriliselt nõutav (90 p? 13 kuud? 7 a nagu maksetel)? Määrab P3 agregaadi kuju.

**Tehnilised otsused:**
- **TE1.** `RESEARCH_JOB_MODE` serveris: kas taastada worker-unit (repo alla!) või lülitada inline'ile (lihtsam, aga seob Next-protsessi ~5 min) — kuni otsuseta on funktsioon katki.
- **TE2.** Query-embedding'u taaskasutus/cache sama sõnumi etappide vahel (6 etappi embeddivad lähedasi stringe) — kuulub P2 juurde, vajab rag-service'i liidese otsust.
- **TE3.** Taustatööde standard: U1 outbox-variant B on juba valitud — kinnitada, et meetingSummary/research liiguvad samasse raami (mitte uus kolmas mehhanism).
- **TE4.** Vektoribaasi horisont (Chroma vs pgvector) — otsustada alles M-taseme mõõtmiste pealt (vt "mida mitte optimeerida").

**Ops-otsused:**
- **O1.** Timerite register + unit-failid repos (notifications on ainus, mille definitsioon elab ainult serveris — sama kehtib puuduvatele renewals/alerts/retention timeritele). Kes omab serveri-timerite elutsüklit?
- **O2.** Masina eraldusplaan kasvu puhuks: mis lahkub esimesena (RAG-teenus või Postgres)?
- **O3.** Jagatud masina RAM/CPU eelarve: 3 muud Next-saiti (~720 MB RSS) + LiveKit — kinnitada, et need tohivad sotsiaal.ai kõrval elada ja kelle arvel.
- **O4.** nginx `proxy_read_timeout 300s` on SSE-le piisav ainult tänu 15 s heartbeat'idele — dokumenteerida, et heartbeat-intervalli ei tohi tõsta üle selle.

---

## 12. Esimene rakendusvalmis pakett: PERF-P0 (otsustevaba)

Neli puhastehnilisеt parandust, ei muuda ühtki toodet/UX-i nähtavat lepingut peale vigade kadumise:

1. **`lib/research/jobStore.js`** — `markStaleActiveJobsInterrupted()`: enne/pärast `updateMany`'t leia mõjutatud jobid ja kutsu igaühele `settleResearchUsage(job, "release", "research_interrupted")`. (Väike võistlusaken on aktsepteeritav — release on idempotentne.)
2. **`lib/usage/routeAdapter.js` + `lib/retention.js`** — reserveerimisel sea `expiresAt` (nt scope-kaardist: chat 15 min, document/research 24 h — väärtused env-nuppudena, vaikeväärtused koodis); retention-sweep'i lisa samm: `usageReservation` WHERE status=RESERVED AND expiresAt < now → release sama teenuse kaudu (mitte raw-delete!). Indeks on juba olemas.
3. **`app/api/research/jobs/[id]/stream/route.js` + `components/chat/hooks/useChatStream.js`** — dbPoll'ile ja persistence-pollile maksimaalne kestus (nt 15 min = ACTIVE_JOB_STALE_MS), mille järel emit error + sulge.
4. **`scripts/deploy-server.mjs` + `scripts/check-env.mjs`** — kui `RESEARCH_JOB_MODE=worker` ja unit-fail puudub, kirjuta selge hoiatus (deploy ei tohi vaikida).

Testid: node:test + süstitud fake-prisma (vt test-infra mälu: elavat DB-d ei kasutata); jobStore'i settle-rajale ja reaperile kummalegi vähemalt 2 testi (release toimub; idempotentne kordus ei viska).

**Teostusjärjekorra soovitus:** PERF-P0 → (ops) renewals/alerts timer koos O1-ga → PERF-P1 koos VEST-P2-ga → PERF-P2/P3 paralleelselt → P4/P5 kasvu järgi.

---

## 13. Jätkamisülesanne Terra/Sol/Codexile

```
ÜLESANNE: PERF-P0 — reservatsioonide elutsükkel + research-valvekoer
Loe: docs/platvormi arendus/fable-5-joudlus-kulu-ja-skaleeruvus.md (ptk 6 L1/L4, ptk 12)
Muuda AINULT: lib/research/jobStore.js; lib/usage/routeAdapter.js; lib/retention.js;
app/api/research/jobs/[id]/stream/route.js; components/chat/hooks/useChatStream.js;
scripts/deploy-server.mjs; scripts/check-env.mjs; + testid tests/usage/, tests/research/
Keelatud: skeem/migratsioonid; usage/service.js leping; UI-tekstid peale error-event'i;
RESEARCH_JOB_MODE väärtuse muutmine (see on TE1 otsus).
DoD: npm test roheline; fake-prisma testid settle+reaper mõlemale; env:check hoiatus
worker-mode+unit-puudumisel; käitumine inline-mode'is muutumatu.
```

Eraldi kontrollid, mida Terra/Sol peab tegema seal, kus mina ei saanud või ei tohtinud (vt ka ptk 14):
1. `rag-service` /analyze ja /ingest/url radade kulupiirid runtime'is (stub-võtmega lokaalselt);
2. LiveKit-kõne tegelik CPU-profiil jagatud masinas (1 testkõne, mitte koormustest);
3. `npm run analyze` bundle-mõõtmine (eriti livekit-client'i ja register-flight'i mõju);
4. Postgres VACUUM/bloat seis (ChatLog 9,9 MB / 14 rida) — kas autovacuum katab;
5. serveri `RESEARCH_JOB_MODE` tegeliku väärtuse kinnitus (env-faili ei loetud — FAILID-A0 väide vajab TE1 otsuse eel kinnitust nt `systemctl show-environment`-laadse read-only võttega või koodihoiatuse kaudu).

---

## 14. NOT_READ — SAFEGUARD ja not_run

**NOT_READ — SAFEGUARD:** ei esinenud — ükski fail ega käsk ei käivitanud safeguard'i.

**Teadlikult lugemata (reegli, mitte safeguard'i tõttu):**
- `/etc/sotsiaalai/frontend.env` sisu (saladused) — sh `RESEARCH_JOB_MODE` tegelik väärtus (toetun FAILID-A0 tõendile);
- päris kasutajate sisu: ChatLog.data, ConversationMessage.content jm sisuveerud (lugesin ainult ridade arvu/tabelimahtu);
- nginx vhost-failide täissisu (ainult sihitud grep-väljavõtted: proxy_pass/proxy_buffering/timeout).

**not_run (mõõtmised, mida read-only audit ei teinud):**
- koormus-/paralleelsustest (keelatud tootmisele; lokaalset ei püstitatud);
- tasulised väliskutsed (OpenAI/STT/TTS/e-post/Maksekeskus/LiveKit-egress) — 0 kutset tehtud;
- `npm run analyze` (bundle-suurused);
- lokaalse dev-serveri latentsusmõõtmine (chat TTFB, RAG-etappide ajad) — soovitatav teha PERF-P2 eelselt sünteetiliste andmetega;
- pg_stat_statements / bloat / autovacuum analüüs;
- rag-service'i /analyze ja graph-alamsüsteemi süvarada;
- OpenAI tegelik arveldusajalugu (pole auditile kättesaadav);
- Playwright-runtime kontrollid (varasemad VEST/RV retseptid olemas, polnud vaja — kõik siinsed leiud on koodi+serveri-seisu tõenditega).

---

## Jätkamispunkt

- **Järgmine tehniline samm:** PERF-P0 (ptk 12–13; otsustevaba, failinimekiri ja DoD antud).
- **Järgmine ops-samm:** O1 — renewals/alerts(/retention) timerite lisamine + timerite unit-failid repossе (koos MAKSED L-05 kontekstiga).
- **Blokeerivad otsused enne järgmisi pakette:** TE1 (research mode), T1 (Stop-salvestusleping; koos VEST-P2), T4 (kuluajaloo horisont; enne PERF-P3 lõppvormi).
- **Selle dokumendi seos:** kasutab sisendina RAG-QM / MAKSED-A0 / VEST-A0 / ADMIN-A0 / FAILID-A0 / EXPORT-A0 / K1-U1 / ruum-audit tõendeid; ei korda nende leide, viitab neile ptk 6 lõpus.

STATUS: COMPLETE
