# SotsiaalAI RAG tegevuskava

Seis: 2026-06-13
Omanik: Laur + Claude
Seotud: `docs/internal/rag-audit.md` (tehniline audit ja tehtud tööde logi)

**Lühiseis 2026-06-13:** Graph-lite (rada C) on VALMIS ja PRODUKTSIOONIS —
C1 aktiveeritud, C2 graafi-kanal (eraldi tag-otsing + kvoot + mode-gate +
munitsipaliteedi-matcher) deploytud ja flag `RAG_GRAPH_CHANNEL_ENABLED=1` sees,
live-probe kinnitatud. Eval 37/37 graaf sees = väljas. Tehtud ka A1/A2, B0–B2,
embedding sub-batching. JÄRGMINE PÄRIS-AVATUD SAMM: 0-allika parandussiht
(üldine teemaküsimus ilma allika-vihjeta kuvab 0 allikat — vt allpool).
Ülejäänud lahtine: B3–B5 ingest, C3/C4 (tulevik), graafi-viimistlus.

## JÄTKA SIIT (käsiraamat uuele sessioonile)

See sektsioon on mõeldud külmstardiks: suvaline uus sessioon (ka teine konto)
peab siit lugema, mis on tehtud ja mis on järgmine samm. Uuenda seda sektsiooni
iga etapi lõpus.

**Tehtud (kronoloogiliselt, commitid git logis):**

1. Platvormi live smoke + trace checker PASS (2026-06-10; audit).
2. Metaandmete backfill 5547 patch'i + kureeritud 43 (A1) — augud 0.
3. B0: EPIKoja eestkoste-uuringu 2 PDF-i andmebaasis.
4. A2: golden eval v1 (`eval/golden-rag-v1.json`, 25 küsimust) + baseline 19/25
   (`reports/golden-eval-baseline-2026-06-11.json`).
5. C1: graph-lite faas 1 kood (Prisma mudelid ILMA migratsioonita, `lib/rag/graph/`,
   `npm run rag:graph:plan` → 78 valda, 4046 entiteeti, 9385 seost). Aktiveerimine
   (migrate + deploy) on eraldi kinnitatav samm.
6. Eval FAIL-ide likvideerimine (3 osa): kriisituvastus laiendatud (safety.js),
   tööleht-signaal planneris, omaosalus/tasu → `national_service_benefit` route,
   overview kuvab reply-kattuvusega valitud allikad, üldsõnaline follow-up kuvab
   allikad suhtelise reply-kattuvuse lävega. Vahetulemus 22/25; kolmanda osa
   järel oodatud 25/25 (kinnita kordusjooksuga).

7. Eval FAIL-id likvideeritud, lõppjooks **25/25 PASS**
   (`reports/golden-eval-final-2026-06-11.json`). Kõik kuus baseline-leidu suletud:
   kriisituvastus, tööleht-discovery, omaosalus-routing, overview recall,
   follow-up recall, sõnastusootused.
8. Serveri intsident 2026-06-11 õhtul: katkestatud deploy-build jättis `.next`
   pooliku, frontend crash-loopis, server läks OOM-thrash'i (swap puudus).
   Lahendus: reboot + **2G swapfile (püsiv, /etc/fstab)** + nice-build.
   Õppetunnid kirjas DEPLOY sektsioonis.

9. B1 partii 1 (2026-06-11 õhtu): 6 covid-aegset kirjet langetatud low-prioriteediks
   (omaniku otsus), seejärel 10 high-priority PDF-i ingest: **8 sisse (608 chunk'i:
   Õiguskantsleri abivajava lapse juhend, AKI andmekaitsejuhendid, pereõendus,
   karjäärispetsialistid, õpilase tugi, laagrite vaimne tervis, gripijuhend),
   2 surnud linki** (Terviseameti URL-id 404 → master-listis `needs_review`).
   Otsing leiab uued dokumendid; +2 eval-küsimust (27 kokku), mõlemad PASS.
   Andmebaasis nüüd 5665 dokumenti / 28220 vektorit.

**Pooleli / järgmine samm:**

- RADA B (korpuse kasv) VALMIS 2026-06-12: B1 high 32 PDF + B2 medium 129 PDF ingestitud.
  DB 5818 dok / 46044 vektorit (algas 5655/27393). Eval 29/29 PASS peale kasvu
  (1 transient, 1 ankur-ootus robustseks tehtud). ~20 dokumenti needs_review:
  surnud lingid, OCR-vajavad voldikud, embed-limiidi suured raportid.
- RAG ENDA ARENDUS #1 VALMIS 2026-06-12: rag-service embedding sub-batching
  parandus deploytud (rag-service/main.py); 6 suurt uuringuraportit (462-863
  chunki, varem BadRequest) taasingestitud 0 veaga. DB 5824 dok / 50410 vektorit.
  +1 eval (vaesus-statistika, 30 kokku, PASS). Tunable RAG_EMBED_MAX_* env.
- RADA C SEIS 2026-06-12: C1 AKTIVEERITUD (migratsioon rakendatud, graaf Postgresis:
  4046 entiteeti / 9385 seost). C2 kanal ehitatud + testitud + deploytud, env-flag
  VALJAS. Eval-vordlus test-override kaudu: graaf sees 28/30 vs valjas 30/30 —
  comparison-reZiimis graafipäringud lahjendasid §17/§23 tasakaalu. PARANDUS TEHTUD
  (mode-gate: comparison/legal/overview/lookup valistatud), commit ootab deploy +
  kordusvordlust. Kanal lubatakse alles kui eval >= 30/30 graaf sees.
- C2 ITERATSIOON TEHTUD 2026-06-12 (kood+testid lokaalselt, flag VALJAS):
  graafi-kanal jookseb nuud ERALDI otsinguna (mitte primaaride sekka segatud),
  nii et native per-query sugavus jaab puutumata — "native ei kaota kohti" on
  struktuurne, mitte proportsionaalse topK-ga kompenseeritud. Graafi-kvoot:
  `selectGraphChannelSupplement` votab graafiotsingust ainult dokumendid, mida
  native ei leidnud, margistab need (graph_channel_origin / retrieval_channel_graph)
  ja piirab GRAPH_CHANNEL_MAX_DISPLAYED-ga (vaikimisi 3, env RAG_GRAPH_CHANNEL_MAX_SLOTS).
  `graphChannelSearchTopK` annab eraldi otsingule tagasihoidliku eelarve. Trace:
  graph_channel.added_candidate_count. Failid: lib/rag/graph/graphRetrieval.js +
  lib/chat/retrievalContextAssembler.js (eraldi pass peale native alamotsinguid).
  8/8 graafitesti PASS; rag-testid 166/166 (NB: jooksuta `npm test` voi
  `node --import ./scripts/register-node-test-loader.mjs --test ...` — paljas
  `node --test` ei lahenda @/-aliast ja annab valefaili).
- C2 DEPLOY + KORDUSVORDLUS TEHTUD 2026-06-12 (commit f28911df serveris):
  graaf valjas 37/37 PASS (reports/golden-eval-graphoff-2026-06-12.json) ja
  graaf sees 37/37 PASS (reports/golden-eval-graphon-2026-06-12.json, test-
  override RAG_EVAL_GRAPH_TEST=1) — PARITEET KAES, varasem 28/30 vahe suletud.
  Live-probe kinnitas kanali toimimist end-to-end: trace query_plan.graph_channel
  naitas matched_entities 4 / added_query_count 3 / added_candidate_count 3
  (= kvoodi ulempiir). VARAV TAIDETUD: RAG_GRAPH_CHANNEL_ENABLED=1 voib sisse
  lulitada (frontend.env + teenuse restart) — kasutaja otsus.
- MATCHERI LEID (live-probe 2026-06-12): kusimus "Kuusalu valla koduteenuse..."
  matchis Koduteenus-entiteedid tahestiku esimestest valdadest (Alutaguse, Anija,
  Antsla, Elva), MITTE Kuusalust. Pohjused: (1) mitmesonaline "kuusalu vald" ei
  matchi kaandevormi "Kuusalu valla" — prefiks-leevendus on ainult uhesonalistel;
  (2) sama teenusenimi 78 vallas, MAX_MATCHED_ENTITIES=4 loikab tahestiku jargi.
- MATCHERI PARANDUS TEHTUD + DEPLOYTUD 2026-06-13 (commit 5c071fec):
  (1) munitsipaliteedi-stem (nimi miinus vald/linn) kaandevormi-sallivusega, et
  "Kuusalus"/"Kuusalu" matchiks ka ilma "vald" sonata; luhikestele stemmidele
  kitsam suffiksi-aken (rae != raekoja); (2) per-valla kov_item-entiteedid
  skoobitakse kusimuses nimetatud / vestlusest kantud valda (matchitud
  MUNICIPALITY-entiteedi kaudu) — ilma vallakontekstita kov_item DROPITAKSE,
  mitte ei lingita tahestiku-valikuga; (3) match uncapped -> scope -> THEN cap,
  et oige vald ei jaaks valja. effectiveMunicipalities antakse lookup'i.
  Live-probe kinnitas: "Kas Kuusalus on koduteenus?" -> municipality:kuusalu_vald
  + kov_item:kuusalu_vald:...:koduteenus (mitte enam Alutaguse/Anija). Failid:
  graphRetrieval.js (municipalityStem/stemRegex/scopeMatchesToMunicipalities/
  resolveMunicipalityIds) + retrievalContextAssembler.js. Testid 15 graafi /
  173 rag PASS.
- KORDUSVORDLUS PARANDUSE JAREL 2026-06-13: graaf valjas 37/37
  (reports/golden-eval-graphoff-2026-06-13.json) ja graaf sees 37/37
  (reports/golden-eval-graphon-2026-06-13.json) — PARITEET PUSIB, matcheri
  parandus ei toonud regressiooni. VARAV ENDISELT TAIDETUD.
- FLAG SISSE LULITATUD 2026-06-13 (deploy 9c2d6e9f): RAG_GRAPH_CHANNEL_ENABLED=1
  /etc/sotsiaalai/frontend.env-is, teenus restartitud. Live-probe ILMA test-
  override'ita kinnitas: "Kas Kuusalus on koduteenus?" -> graph_channel trace's
  (municipality:kuusalu_vald + koduteenus, aq=2, ac=3). GRAAFI-KANAL ON NUUD
  PRODUKTSIOONIS AKTIIVNE. Tagasi keeramiseks: env =0 + restart.
- Edasi (valikuline): per-source UI-margistus (marker katkeb groupMatches juures,
  praegu ainult trace'is); samanimeliste valdade dedupe (haruldane, nt sama stem
  kahel asumil); needs_review URL-id; OCR-rada voldikutele.

**Parandussiht (leitud eval-laiendusel 2026-06-12):** üldine teemaküsimus ilma
allika-vihjeta (nt: Mis on integreeritud teenused?) jääb default-reziimi ja
kuvab 0 allikat, kuigi vastus tuleb RAG-ist. Sama klass mis V2.8 diversity —
vota ette koos C2 iteratsiooniga.

**C2 järgmine iteratsioon (Lauri idee 2026-06-12) [VALMIS — deploytud f28911df,
kordusvõrdlus 37/37 vs 37/37, värav täidetud]:** native kandidaadid ei kaota kohti — lahendatud
eraldi graafiotsinguga (native topK puutumata) + graafi-kvoot valikus (graph-
kanali chunkidel ülempiir 3 kohta, märgistus graph_channel_origin /
retrieval_channel_graph). Koos mode-gate'iga annab see "kõrvuti täiendamise".
Seejärel kordusvõrdlus eval'iga ja 2-3 graafi-spetsiifilist eval-küsimust
(vormid+kontaktid, mitme-hüppelised). JÄÄK pärast deployd: per-source UI-
märgistus (marker katkeb groupMatches juures, praegu ainult trace'is).

**Käsud, mida vajad:**

```text
# golden eval (vajab sisselogitud sessiooni küpsist brauserist)
$env:SOTSIAALAI_SMOKE_BASE_URL = "https://sotsiaal.ai"
$env:SOTSIAALAI_SMOKE_COOKIE  = "__Secure-next-auth.session-token=<token>"
npm run rag:eval:golden -- --json reports/golden-eval-<kuupäev>.json

# master-listi PDF-ingest (jooksuta serveris: ssh sotsiaalai, app kataloogis,
# env laetud: set -a; . /etc/sotsiaalai/frontend.env; set +a)
npm run knowledge:source-master:plan  -- --priority high --limit 10
npm run knowledge:source-master:ingest -- --priority high --limit 10 --skip-existing

# metaandmete seis / backfill / graafiplaan
npm run rag:backfill:metadata           (dry-run)
npm run rag:graph:plan -- --json reports/rag-graph-plan.json

# DEPLOY — Lauri otsekasklus (repo juurest):
AI -m "muudatuste kirjeldus"
# AI = scripts/ai-deploy.mjs: git add -A + commit + push + npm run deploy:server
# (deploy:server: serveris git pull, prisma migrate deploy, build, teenuste restart).
# Lipud: --skip-deploy (ainult commit+push), --skip-build (ilma frontendi buildita).
# Kiire tavaliselt seetottu, et serveri .next cache on soe.
#
# Kasiraja variant (kui tahad ise sammhaaval):
#   git add . ; git commit -m "..." ; git push origin main
#   ssh sotsiaalai ; cd /home/ubuntu/apps/sotsiaalai ; git pull ; npm run build
#   sudo systemctl restart sotsiaalai-frontend.service
# rag-service restart ainult siis, kui rag-service/main.py muutus.
#
# NB automatiseeringule: kui jooksutad deploy'd taustal/timeout'iga, anna
# vahemalt 25 min — katkestatud build jatab .next pooleli ja frontend laheb
# crash-loopi (juhtus 2026-06-11). Eelista nohup-lahtihaagitud kaivitust.
```

**Püsireeglid:** vt "Püsivad guardrail'id" all; lühidalt — kõik uus flag'i taha,
deploy/migrate ainult kasutaja teadmisel, eval kasvab koos korpusega, iga partii
järel commit + push + selle sektsiooni uuendus.

**Mudeli soovitus (Fable 5 reasoning effort):**

- `medium` — rutiinne töö: ingest-partiid (B1/B2), eval/smoke jooksud, deploy'd,
  skriptid olemasoleva mustri järgi, raportid, dokumentatsioon.
- `high` — peen diagnostika ja disain: mitme kihi koosmõju bugid (nt atributsiooni/
  ranking'u loogika), graph-lite arhitektuur (C1 aktiveerimine, C2 otsingukanal),
  V2.8 diversity tuning, LLM-planneri eksperiment (C3), riskantne runtime-muudatus
  legal-exact'i või KOV-radade lähedal.

## Tehtud vundament (vt audit)

- V1.1–V2.7A runtime-tööd valmis; platvormi live smoke + trace checker PASS (2026-06-10).
- Metaandmete backfill valmis (2026-06-11): 5547 patch'i, `collection_id` augud 0, KOV `content_hash` täidetud; rag-service'is on nüüd `patch-meta` endpoint ja `rag:backfill:metadata` tööriist.
- `master_sources_final.json` taastatud (323 allikat, sh 180 PDF-linki, 39 high priority). Andmebaasis 5657 dokumenti; master-listi PDF-idest sees 4, puudu 176.

## Rada A — kvaliteet (järjekorras)

- **A1. Kureeritud mini-backfill (43 dokumenti).** 7 puuduvat `authority`, 33 `source_status=unknown`, 1 `last_checked`, 2 artikli URL-i. Üheselt tuletatavad rakendatakse patch-meta kaudu, kahtlased jäävad raportisse ettepanekutega.
- **A2. Golden eval v1 (25 küsimust).** Kaks dimensiooni: režiim × korpuse perekond. Jaotus: KOV 4, SHS/RT legal 3, ajakiri Sotsiaaltöö 4, ingest'itud PDF-id 4, organisatsioonid 2, eluolukord/võrdlus 4, piirijuhud 4. Komplekt JSON-ina repos + runner, mis jooksutab `/api/chat` vastu ja võrdleb: õige režiim, kohustuslikud/keelatud kuvatud allikad, vastuse sisunõuded. Tulemus = baseline-skoor.
- **A3. V2.8 diversity tuning.** AINULT kui eval näitab, et laiad küsimused kasutavad korpust liiga kitsalt. 2026-06-10 smoke blokeerivat probleemi ei näidanud.

**Põhireegel:** eval (A2) peab olemas olema enne suuri ingest-laineid ja arhitektuurimuudatusi — muidu pole võrdlusbaasi.

## Rada B — materjali ingest (partiidena, iga partii järel eval)

- **B0. 2 eestkoste-uuringu PDF-i** (`Andmebaasi/uuringud ja juhendid/Taisealiste-psuuhikahairega-...-2026*.pdf`). Metadata-JSON-id samale mustrile nagu hea tava 2025 failil, ingest `knowledge:folder:ingest` kaudu. Väike, võib teha enne A2 — annab eval'ile kohe küsimused.
- **B1. Master-listi high-priority PDF-id (39).** `knowledge:source-master:ingest -- --priority high` partiidena (~10 kaupa), iga partii: validaator → pisteline kontroll → 1–2 uut eval-küsimust → eval roheline enne järgmist partiid.
- **B2. Medium-priority PDF-id (141).** Sama muster, suuremad partiid, kui B1 kogemus on puhas.
- **B3. Ajakirjaartiklid master-listist (11).** Olemasolev journal-torustik (`rag:ingest:ajakiri`).
- **B4. Organisatsioonikorje automatiseerimine (60 orgi).** Skript, mis teeb `organisatsiooni_korje_task_starters.md` töö programselt: lehed alla, LLM-API ekstraktsioon, 4 tuumfaili, `organization:validate`, ebakindel → `needs_review` (inimkontroll). Alustada A-prioriteedi organisatsioonidest. EI mingit käsitsi ChatGPT-vestlustööd.
- **B5. HTML/teemalehed (50).** Valikuliselt `/ingest/url` kaudu, alustades kõrgeima väärtusega lehtedest.
- **Registrid (16) jäävad `referenced_only`** — RAG-i ei lähe.

**Reeglid:** enne uut allikat dedupe-kontroll master-listi vastu (`normalized_url`); `--skip-existing` alati peal; ükski partii ei lähe sisse ilma validaatorita; eval kasvab koos korpusega (iga partii lisab küsimusi).

## Rada C — arhitektuur (paralleelne, feature flag'ide taga)

- **C1. Graph-lite faas 1.** Prisma mudelid (RagEntity, RagRelation, RagChunkEntity) + deterministlik ingest KOV kanoonilistest failidest, RT struktuurist ja organisatsiooniprofiilidest. Entity-tüübid: SERVICE, BENEFIT, LAW, LEGAL_SECTION, MUNICIPALITY, ORGANIZATION (roles-atribuudiga), FORM, CONTACT_POINT, TARGET_GROUP. Lubatud kolmikud (domain/range) valideeritakse insertil. DEADLINE/ELIGIBILITY_CRITERION ei ole sõlmed, vaid serva atribuudid. Kood + migratsioon + testid lokaalselt; deploy/migrate ainult kokkuleppel.
- **C2. Graph-otsingukanal + debug-võrdlus.** Uus kanal `retrievalOrchestrator`-is flag'i taga (`RAG_GRAPH_CHANNEL_ENABLED=0` vaikimisi); vana vs uue pipeline'i kõrvutamise tööriist; mõõtmine golden eval'iga. Sisselülitamine ainult siis, kui eval-skoor ei lange.
- **C3. LLM-planner eksperiment.** Deterministlik `questionPlanner` jääb; LLM-versioon flag'i taha; eval võrdleb.
- **C4. Graph-lite faas 2.** LLM-ekstraktsioon artiklitest (NEED, RISK_SIGNAL, WORKFLOW, ESCALATES_TO jne), kõik `review_needed` staatusega; riski-/kriisiseosed alati inimkontrolliga.

## Soovitatav järjekord

```text
1. A1  mini-backfill                      (väike, kohe)
2. B0  2 uuringu-PDF-i sisse              (väike, kohe)
3. A2  golden eval v1 + baseline          (võtmesamm)
4. C1  graph-lite faas 1                  (paralleelselt A2-ga võimalik)
5. B1  high-priority PDF-id partiidena    (eval valvab)
6. C2  graph-kanal + võrdlus              (vajab A2 + C1)
7. B2-B5 ülejäänud ingest                 (jooksvalt)
8. A3/C3/C4 vastavalt eval-tulemustele
```

## Püsivad guardrail'id

- Olemasolev RAG ja Chroma collection jäävad puutumata; uus alati flag'i taha; vaikimisi vana pipeline.
- Deploy ja prisma migrate ainult kasutaja teadmisel.
- Legal exact ja KOV/SourcePackage rajad on kaitstud regressioonidega enne iga muudatust.
- Iga seos graph-kihis kannab evidence-viidet (chunk/source); ilma selleta seost ei looda.
- Audit (`rag-audit.md`) uueneb iga tööpaketi järel; see roadmap uueneb, kui etapp valmib või järjekord muutub.
