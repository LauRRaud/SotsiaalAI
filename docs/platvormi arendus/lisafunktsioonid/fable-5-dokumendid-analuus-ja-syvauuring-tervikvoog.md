# Fable 5 — Dokumendid, dokumendianalüüs ja süvauuring: tervikvoo teadmistekaart

* `STATUS: COMPLETE`
* Kontrollimise kuupäev: 2026-07-15
* Aktiivne haru: `main`, commit `7ae76d5b` (2026-07-14 23:52 +0300, "docs: lisa Kovisiooni metodoloogiline alus")
* Viimane lõpetatud etapp: etapp 8 — LÕPPRAPORT (peatükid 1–19) kirjutatud; kõik neli voogu, kustutusahel, usaldusmudel ja P0–P3 leiud dokumenteeritud
* Täpne jätkamispunkt: vt peatükk 19. Kaart valmis; ainus lahtine tegevus on P1 lekke runtime-kinnitus töötava RAG-i ja kahe sünteetilise kontoga (kood puutumata, ükski parandus tegemata — kõik ETTEPANEK).
* Peamine leid: **P1 (P0-kandidaat) — RAG cross-tenant lekkevektor** (`/dokreziim` agent-dokument → jagatud RAG audience „BOTH" → võõra kasutaja süvauuringu/vestluse vastuses; ptk E.3, 11).

---

> **Lugemisjuhis.** Peatükid 1–19 (LÕPPRAPORT) on juhtkondlik kokkuvõte. Peatükid A–F on kooditõendatud lähtematerjal (voog A dokumendi koostamine, B analüüs, C heli/transkript, D süvauuring, E kustutus/privaatsus, F runtime). Väidete märgised: **FAKT** (koodi/testi/runtime'iga tõendatud), **VASTUOLU** (lubadus ≠ käitumine), **LEID** (tõendatud viga/leke), **ETTEPANEK**, **TOOTEOTSUS**, **KESKKONNAPIIRANG**.

---

# LÕPPRAPORT

## 1. Juhtkokkuvõte

SotsiaalAI dokumendivaldkond koosneb **neljast tehniliselt küpsest, kuid omavahel nõrgalt seotud rajast**: dokumendi koostamine (AgentArtifact DRAFT→FINAL, DOCX/PDF), dokumendianalüüs (efemeerne vestluskontekst), heli→transkript→kokkuvõte, ja süvauuring (RAG-põhine taustatöö). Iga rada üksinda töötab ja on serveris õigustega kaitstud. Peamine probleem ei ole üksikfunktsioonides, vaid **terviklikkuses ja usaldusmudelis**.

Kolm juhtjäreldust:

1. **„Dokumendid" ei ole terviklik isiklik failiruum, vaid nelja eri töövoo väljundite juhuslik kogum.** Analüüs pole objekt (ei leia hiljem), süvauuringu tulemus elab vestluses (mitte dokumentides), mustandil pole versiooni ega „ava uuesti" teed, ja algfail vs eraldatud tekst vs AI-analüüs vs AI-mustand vs kinnitatud dokument ei ole kasutajale ühtse elutsüklina esitatud. Kasutaja peab ise teadma, kus iga asi „elab".

2. **Üks P1-privaatsusleid (P0-kandidaat): `/dokreziim`-is mustandiks kasutatud privaatne dokument indekseeritakse jagatud RAG-kollektsiooni audience'iga „BOTH" ja võib pinnale tulla teise kasutaja süvauuringu või põhivestluse vastuses** — mitte-omaniku retrieval-rajad (süvauuring, vestlus) filtreerivad ainult audience'i järgi, ilma omaniku- või collection-piireta. Ahel on staatiliselt tõendatud ja audience-eeldus programmiliselt reprodutseeritud (ptk E.3, F).

3. **Mitu kasutajale antud lubadust on osalised või valesti suunatud:** ideed.md lubab „Dokumentide vaates saab faili sisu analüüsida" — tegelikult analüüsi `/documents`-il ei ole (VASTUOLU); Teekonna „Lisa dokument analüüsiks" viib CLIENT-i `/dokreziim`-i, kus analüüsi pole (LEID, katkine ühendus); süvauuring on produktsioonis vaikimisi env-lipu taga (KESKKONNAPIIRANG); `/dokreziim` genereeritud mustand kaob salvestamata lahkumisel, kuigi kuluüksus on juba võetud (LEID).

Positiivne: õigused on serveris jõustatud, PII-redaktsioon ja privaatsuse eelkontroll töötavad, kustutusahel (dokument→fail→RAG→audit) ja konto kustutus on fail-safe, süvauuringul on eksplitsiitne tõendi- ja kindlusmudel. Ükski tuvastatud viga ei ole rakenduskoodi katkine funktsioon — need on tervikvoo-, usaldus- ja ühendusprobleemid.

**Ei muutnud koodi, skeemi ega migratsioone; ei commit'inud ega deploy'inud** (vastavalt korraldusele).

## 2. Aktiivse funktsionaalsuse kaart

FAKT, `main` @ `7ae76d5b`:

- **Dokumendi koostamine:** `POST /api/documents/artifacts/generate` (transientne mustand), `POST /api/documents/artifacts` (püsiv DRAFT), `refine`, `[id]/approve` (→FINAL), `[id]/download` (DOCX/PDF), PATCH/DELETE. 11 artefakti-tüüpi, mallitugi placeholderitega. Vestlusesisene slot-filling voog (`runDocumentChatWorkflow`).
- **Dokumendianalüüs:** `POST /api/chat/analyze-file` → RAG `/analyze` → efemeerne (chunks+preview+fullText, ei salvestata). Vestluse `ephemeralChunks` kontekst; `combineSources` lüliti (ainult dok / dok+teadmusbaas).
- **Heli/transkript:** `POST /api/documents/[id]/transcribe` (sünkroonne STT, TranscriptionJob), `[id]/summary` (→TRANSCRIPT_SUMMARY artefakt), `meeting-summary/jobs` (dikteeritud kokkuvõte, job+snapshot), `audio-sources`, `audio-select`. Transkript kasutaja-muudetav (PATCH content).
- **Süvauuring:** `POST /api/research/jobs`, `[id]` (GET/DELETE), `[id]/stream` (SSE). ResearchJob DB-püsiv, inline/worker-režiim, planeerija→RAG-otsing→süntees, tõend+kindlus+lüngad, rag_only.
- **Kustutus/privaatsus:** retention-cleanup (90 p), konto kustutus (fail-safe), DataAuditLog/DataDeletionJob, PII-guard.

## 3. Rollide ja õiguste kaart

| Toiming | CLIENT | SOCIAL_WORKER | SERVICE_PROVIDER | ADMIN |
|---|---|---|---|---|
| Faili üleslaadimine | ✅ (2 vestluses) | ✅ (10) | ✅ | ✅ |
| Dokumendianalüüs (vestlus) | ✅ | ✅ | ✅ | ✅ |
| Dokumendi koostamine | ✅ `/dokreziim` (suunatud) | ✅ `/documents`+`/dokreziim` | ✅ | ✅ |
| Transkriptsioon | ✅ | ✅ | ✅ | ✅ |
| Süvauuring | ✅ 2/kuu | ✅ 6/kuu | ✅ 12/kuu | ✅ 100/kuu |
| `/documents` leht | ⛔ (→`/dokreziim`) | ✅ | ✅ | ✅ |

Kõik marsruudid: sessioon + **aktiivne tellimus** kohustuslik (`requireDocumentUser`→`requireSubscription`); dokumenditöö on tervikuna tasulise paketi taga. Omanikupiire igal objektil, serveris jõustatud. FAKT.

**Ebasümmeetriad (LEID):** (a) dokumendi/artefakti võõra ID → **403** (olemasolu-oraakel), erinevalt kovisiooni 404-mustrist; (b) transkript ja meeting-summary dokument saavad `agentAllowed: true` automaatselt, üleslaaditud fail `false` — kasutajale nähtamatu; (c) `getResearchDailyLimit` (3/5) on surnud kood — tegelik piir on kuupõhine entitlement.

## 4. Nelja tervikvoo kaart

- **A. Koostamine:** Vestlus/Töölaud → liik+eesmärk → allikas (kirjeldus/fail/mall/heli) → AI-mustand → kasutaja muudatus → kinnitus → FINAL → DOCX/PDF / hilisem avamine. Detail ptk A.
- **B. Analüüs:** Fail → efemeerne tekstieraldus → vestluse selgitus/riskid/sammud → järelküsimused (uus reastus) → (sild) koostamine. Detail ptk B.
- **C. Heli:** Heli-allikas → transkriptsioon → kasutaja parandus (PATCH) → kokkuvõte/artefakt → allalaadimine/kustutus. Detail ptk C.
- **D. Süvauuring:** Vestluses käivitus → planeerija→RAG→süntees → SSE-edenemine → tõend+kindlus+lüngad → vestlusesse püsiv raport. Detail ptk D.

## 5. Iga voo katkestuskohad (koond)

- **A:** genereeritud mustand kaob salvestamata lahkumisel (kulu võetud); UX-ülekoormus; vestlusmustand vs töölaud kaks „kodu"; FINAL = tupik ilma versioonita. (A.4)
- **B:** analüüs pole objekt (ei leia/jaga/jätka); `/documents`-il pole „Analüüsi"; Teekond→analüüs viib valesse kohta; väike kontekstieelarve → lünklik pikkade dokumentide analüüs ilma hoiatuseta. (B.4)
- **C:** `TRANSCRIPTION_ENABLED` sõltuv; transcribe sünkroonne (proxy-timeout risk); heli→transkript provenance katkeb heli kustutamisel vaikselt; meeting-summary JSON-jääk. (C.4)
- **D:** soft-nav tühistab uuringu (hard-refresh ei tühista) — ebajärjekindel; peidetud ulatuse-valikud; produktsioonis env-lipu taga; tulemus = tupik (ei saa dokumendiks). (D.4–D.5)

## 6. Andmete ja tööobjektide elutsükkel

Vt ptk E.1 tabel. Lühidalt: fail (90 p / käsitsi, täielik kustutus), analüüsitekst (0 — efemeerne), transkript (nagu fail), AgentArtifact DRAFT/FINAL (90 p updatedAt), meeting-summary JSON (TTL-sweep), ResearchJob (14 p) + raport vestluses (90 p), RAG-vektorid (kuni dokumendi kustutuseni). **Puuduv lüli:** AgentArtifact FINAL-il pole „uus versioon"/„ava mustandina" — elutsükkel lõpeb kinnitusega; kliendi muudatus pärast kinnitust = nullist uus. ETTEPANEK.

## 7. Kasutajale nähtava lubaduse ja serveri tegeliku käitumise võrdlus

| Lubadus (dok/UI) | Server | Hinnang |
|---|---|---|
| „Dokumentide vaates saab faili sisu analüüsida" (ideed §2.9) | `/documents` ei kutsu analyze; analüüs elab vestluses | **VASTUOLU** |
| Teekonna „Lisa dokument analüüsiks" | viib `/documents`→CLIENT `/dokreziim` (koostamine, mitte analüüs) | **LEID** (katkine ühendus) |
| „AI teeb mustandeid; inimene kinnitab" | DRAFT→approve→FINAL, FINAL muutumatu | **FAKT** ✅ |
| „Transkript vaadatakse enne kasutamist üle" | PATCH content + reviewedAt jälg | **FAKT** ✅ |
| „Midagi ei liigu ilma kinnituseta" | koostamine JAH-väravaga; approve käsitsi | **FAKT** ✅ |
| „Kustutamisel eemaldatakse failid, RAG, artefaktid, ootel tööd" | dokument+fail+RAG+audit; konto fail-safe | **FAKT** ✅ (v.a meeting-summary JSON-jääk, P3) |
| „Süvauuring [MAIN] töötab" | kood main-is; prod `RESEARCH_API_ENABLED` vaikimisi väljas | **KESKKONNAPIIRANG** |
| Privaatne on vaikeseis, ei leki teisele | agent-dok RAG audience „BOTH" mitte-omaniku otsingus | **LEID P1** (E.3) |

## 8. Privaatsus-, säilitus- ja kustutusahel

Terviklik ja fail-safe (ptk E.1–E.2): retention kustutab dokumendi alles pärast RAG+faili õnnestumist ja säilitab artefakt-seosega dokumendid; konto kustutus katkeb, kui väline kustutus ebaõnnestub (jääb ootele). Auditijälg (DataAuditLog/DataDeletionJob) säilib. **Kaks jääki:** (P1) agent-dok RAG-leke enne kustutust/aegumist (E.3); (P3) meeting-summary JSON-snapshotid väljaspool kustutusahelat.

## 9. Dokumendi päritolu, versiooni ja kinnituse usaldusmudel

- **Päritolu:** `AgentArtifactSourceDocument` (allikadokumendid), `templateId`, retrieval-metaandmed auditis — hea. AGA vestlusest loodud mustandil allikaid EI seota (agentDocuments=[]); heli kustutamisel transkripti provenance katkeb (SetNull). Osaline.
- **Versioon:** puudub — pole versiooniajalugu ega FINAL→uus-versioon. DRAFT on muudetav ilma diff'ita.
- **Kinnitus:** DRAFT→FINAL selge, idempotentne, FINAL muutumatu. Tugev.
- **Eristus (algfail / eraldatud tekst / AI-analüüs / AI-mustand / kinnitatud):** tehniliselt eri mudelid (UserDocument.kind, efemeerne, AgentArtifact.status), aga kasutajale ÜHTSE valdusriba/päritolumärgisena EI esitata (usaldusmudeli siht ptk-teadmistekaardist on siin täitmata). ETTEPANEK.

## 10. Süvauuringu kvaliteedi-, allika- ja ebakindlusmudel

FAKT: allikad ainult RAG-teadmusbaas (`rag_only`, avatud veebi ei kasutata); iga leid viitab tõenditele (E#) + kindlus high/medium/low; eraldi lüngad (sh geo-laiendus, osaline otsinguviga) ja järgmised sammud; 0-tõendi ja tühja-sünteesi ausad fallback-raportid. Platvormi tugevaim ebakindluse käsitlus. **Piirang:** kvaliteet sõltub teadmusbaasi katvusest; ulatuse/fookuse/geo valikud on olemas API-s, aga UI ei paku neid → kasutaja ei saa uuringut suunata.

## 11. Tõendatud vead ja vastuolud (P0–P3)

- **P1 (P0-kandidaat) — RAG cross-tenant leke:** agent-dok audience „BOTH" jagatud kollektsioonis; süvauuring + põhivestlus filtreerivad ainult audience'i järgi → võõra kasutaja vastuses võib pinnale tulla privaatse dokumendi tükk. Ahel staatiliselt tõendatud + audience programmiliselt reprodutseeritud. Vajab runtime-kinnitust/parandust. (E.3, F)
- **P2 — Teekond→„analüüsiks" katkine sihtkoht:** CLIENT suunatakse koostamisse, mitte analüüsi. (B.3)
- **P2 — genereeritud mustand kaob salvestamata lahkumisel**, kulu juba commit'itud. (A.2)
- **P2 — analüüs pole objekt** → ei leia/jaga/jätka (osalt TOOTEOTSUS: efemeerne privaatsus?). (B.4)
- **P2 — süvauuring soft-nav'il tühistub**, hard-refresh'il mitte — ebajärjekindel katkestustaluvus. (D.4)
- **P3 — 403 olemasolu-oraakel** dokumendi/artefakti võõra ID puhul (vs kovisiooni 404). (A.3/E.4)
- **P3 — meeting-summary JSON-jääk** väljaspool kustutusahelat. (C.4/E.2)
- **P3 — provenance katkeb vaikselt** heli kustutamisel; `agentAllowed` automaatika nähtamatu. (C.3)
- **P3 — surnud kood:** `getResearchDailyLimit`. (D.5)
- **VASTUOLU — dokumendianalüüs `/documents`-il lubatud, puudub.** (B.2)
- **KESKKONNAPIIRANG — süvauuring prod vaikimisi väljas** (`RESEARCH_API_ENABLED`).

## 12. Peidetud või kasutamata valmis võimekused

- **Süvauuringu ulatuse-mootor** (`profile light/standard`, `focus[]`, `geo` NATIONAL/MUNICIPALITY/DISTRICT + autolaiendus, `collection_ids`, `output_style`) on API-s täielikult olemas, aga vestluse UI ei saada ÜHTEGI neist. Suur kasutamata väärtus.
- **Worker-režiim** süvauuringule (`RESEARCH_JOB_MODE=worker` + lease/heartbeat/retry) valmis, aga inline on vaikeseis.
- **Malli-placeholderid** DOCX-ekspordis (5 välja) — vähekasutatud.
- **`combineSources`** analüüsis (dok vs dok+teadmusbaas) — olemas, UI-s vähe esil.

## 13. Puuduvad funktsioonid ja seni märkamata vajadused

- **Ühtne „isiklik failiruum"**: üks koht, kus algfail, analüüs, transkript, mustand, kinnitatud dokument ja uuringutulemus on sama elutsükli ja päritolumärgisega. Täna neid ei ühenda miski.
- **Analüüs kui salvestatav objekt** (valikuliselt): „salvesta see analüüs", et hiljem leida/jätkata/jagada — praegu efemeerne.
- **„Selgita ametlikku kirja" sisenemiskoht** koos selge-keele vastusega (U7 on [HARUL]).
- **Dokumendi versioonimine / FINAL→uus versioon**.
- **Uuring→dokument sild** (raportist artefakt).
- **Salvestatud dokumendi kohta küsimuste esitamine** (püsiv fail + vestlus praegu lahus).
- **Kasutajale nähtav RAG-kasutuse/privaatsuse selgitus** `/dokreziim`-is (et dokument läheb jagatud indeksisse).

## 14. Soovitatud ühtne tootemudel

„**Minu dokumendid** = üks isiklik failiruum, kus igal objektil on nähtav päritolu, olek ja privaatsuspiir." Objekti-tüübid ühes loendis: Algfail · Transkript · Analüüs (salvestatud) · Mustand · Kinnitatud · Uuringutulemus. Iga objekt kannab valdusriba: KES NÄEB / PÄRITOLU / OLEK / KEHTIVUS. Töövood (koostamine/analüüs/heli/uuring) on selle ruumi sissepääsud, mitte eraldi „lehed" oma väljundiloendiga. See viib dokumendivaldkonna kooskõlla platvormi põhimudeli punktiga 1 (ruumiline abi-/töökeskkond) ja usaldusmudeliga (privaatne vaikeseis, nähtav päritolu).

## 15. Soovitatud UX- ja ruumiline hierarhia

1. **Sisenemine küsimusest, mitte valikutest:** „Mida soovid teha?" (mõista dokumenti / koostada / transkribeerida / uurida) → alles siis vormistusvalikud (kinnitab UX-kaardistuse suunda A ja B jaoks).
2. **Analüüs saab „Salvesta" toimingu** ja ilmub failiruumi objektina; „Analüüsi" kiirtoiming ka `/documents`-il.
3. **Süvauuringule oma püsiv „uuringuleht"** (artefaktina, mis talub soft-nav'i) + ulatuse/geo valikud nähtavaks; töö jätkub navigeerimisel.
4. **Mustandi elutsükkel nähtavaks:** DRAFT/FINAL märgis, „ava uuesti"/„uus versioon".
5. **Päritolu- ja privaatsusriba** igal dokumendil (eriti „see fail läheb jagatud otsingusse, kui kasutad koostamisel").

## 16. Teostusjärjekord (väikesed sõltumatud paketid)

1. **P1 leke sulgeda** (kõige kiirem, sõltumatu): agent-dokumentide väljajätt kõigis mitte-omaniku RAG-radades (süvauuring `buildWhereForGeo` + põhivestluse `searchFilters` lisavad `source_type $nin [agent_document]` VÕI agent-dok eraldi kollektsiooni). + runtime-regressioontest „võõra agent-dok ei tule vastusesse". **P0/P1.**
2. **Teekond→analüüs sihtkoht parandada** (CLIENT → vestluse analüüsirada, mitte `/dokreziim`). Väike. **P2.**
3. **Genereeritud mustandi kadu:** kas auto-salvestus DRAFT-ina või selge „salvestamata" hoiatus + kulu-release. Väike. **P2.**
4. **Süvauuring soft-nav'il ellu jätta** (ära DELETE unmount'il; taasühendu jobiga). Väike–keskmine. **P2.**
5. **Meeting-summary JSON kustutusahelasse** (dok/konto kustutusel). Väike. **P3.**
6. **403→404 ühtlustus** dokumendi/artefakti marsruutidel. Väike. **P3.**
7. **UX-pakett:** „Mida soovid teha?" sisenemine + analüüsi „Salvesta" + päritolumärgis. Keskmine. Tootesuund.
8. **Uuringu ulatuse-UI** (peidetud võimekus nähtavaks). Keskmine.

## 17. Tooteomaniku otsust vajavad küsimused (TOOTEOTSUS)

1. **Kas analüüs peaks jääma efemeerseks** (privaatsuseelis) või saama valikuliselt salvestatavaks objektiks? (Määrab B-voo tuleviku.)
2. **Kas agent-dokumendid tohivad üldse jagatud teadmusbaasi rikastada** (nt anonüümistatult), või peavad olema rangelt omaniku-privaatsed? (Määrab P1-paranduse kuju: väljajätt vs eraldi kollektsioon.)
3. **Kas süvauuring lülitatakse produktsioonis sisse** ja millise kuulimiidiga; kas ulatuse-valikud avatakse kasutajale?
4. **Kas FINAL-dokument vajab versioonimist / „ava uuesti"** või jääb kinnitus lõplikuks (uus = nullist)?
5. **Kas „selgita ametlikku kirja" saab teadliku sisenemiskoha** ja seotakse U7 selge keelega?
6. **Kas `/documents` ja `/dokreziim` ühendatakse üheks failiruumiks** (ptk 14) või jäävad eraldi?

## 18. Käivitatud testid ja runtime-tõendid

- `node --test tests/documents/* tests/privacy/*` → **16/16 pass** (audioWorkflow, downloadHeaders, transcriptSummaryPrompt, privacyGuard).
- **E.3 audience-ahela programmiline reproduktsioon:** agent-dok ingest → „BOTH"; süvauuringu/vestluse audience-filter → MATCH mõlemas rollis.
- Kõik voo-väited staatiliselt tõendatud `main` @ `7ae76d5b` (marsruudid, lib, Prisma-skeem, komponendid, rag-service).
- **KESKKONNAPIIRANG:** autenditud brauseri-e2e polnud võimalik (liivakast ≠ kasutaja võrk; localhost:3000/8000 kättesaamatu; ükski Chrome pole ühendatud). Vt ptk F.

## 19. Täpne jätkamispunkt järgmisele aknale

Kaart on **COMPLETE**. Järgmise akna jaoks avatud (prioriteedi järjekorras):

1. **Kinnita P1 leke runtime'is:** töötava RAG + kahe sünteetilise kontoga — kasutaja A indekseerib `/dokreziim`-is äratuntava markeriga dokumendi (nt „ZZTEST-PRIVAATNE-<uuid>"), kasutaja B teeb süvauuringu/vestluse semantiliselt lähedase päringu → kontrolli, kas marker pinnale tuleb. Kui jah → **P0** ja rakenda ptk 16 pakett 1.
2. Kontrolli prod `RESEARCH_API_ENABLED` ja `TRANSCRIPTION_ENABLED` tegelikku seisu (ops).
3. Vii ptk 17 otsused tooteomanikuni; nende põhjal vali ptk 16 pakettide järjekord.
4. Kood puutumata (korralduse kohaselt) — ükski parandus pole veel tehtud; kõik on ETTEPANEK/teostuspakett.

---

*(Allpool: kooditõendatud lähtepeatükid A–F.)*

## A. Voog A: dokumendi koostamine — kooditõendatud kaart

Kontrollitud `main` @ `7ae76d5b` (14.07.2026). Kõik alljärgnev on FAKT, kui pole märgitud teisiti.

### A.1. Sisenemiskohad (kolm eraldi rada, üks salvestusmudel)

1. **Vestlus (`/vestlus`)** — lukustatud slot-filling voog (`lib/chat/documentOrchestration.js` → `runDocumentChatWorkflow`): liik → sihtrühm/toon/keel → eelvaade → kasutaja JAH-kinnitus → `readyToGenerate` → `lib/chat/workflowBranchHandlers.js:396` loob `AgentArtifact` (status `DRAFT`) ja vastus sisaldab mustandi täisteksti + viidet. Tühistamine („katkesta") ja taasalustamine on sisse ehitatud (`detectDocumentSwitchIntent`). PII eemaldatakse enne AI-d (`redactPersonalData` generation.js:263, 291, 687).
2. **Dokumendi töölaud (`/dokreziim`, `AgentModePage`)** — täisvorm: väljundi tüüp (11 `AGENT_ARTIFACT_TYPE` väärtust), valitud dokumendid (max 10; CLIENT-il 2), mall (TEMPLATE-liigiga dokument), helifaili rada, toon/keel/pikkus/sihtrühm; genereerimine `POST /api/documents/artifacts/generate`.
3. **Dokumentide leht (`/documents`, ainult mitte-CLIENT)** — loend + üleslaadimine + artefaktide loend + detailivaade. CLIENT suunatakse `/documents` pealt alati `/dokreziim`-i (app/documents/page.js:36–38).

### A.2. Elutsükkel serveris

- **Genereerimine on kaheastmeline:** `POST /api/documents/artifacts/generate` tagastab AINULT transientse mustandi (`isTransient: true, id: null`) — DB-sse EI salvestata. Püsivaks saab mustand alles siis, kui UI kutsub `POST /api/documents/artifacts` (loob `AgentArtifact DRAFT` + `AgentArtifactSourceDocument` read) või PATCH-ib olemasolevat. AgentModePage teeb seda salvestusnupu kaudu (AgentModePage.jsx:1451–1460). **LEID (P2, kadumisrisk):** kui kasutaja genereerib `/dokreziim`-is mustandi ja lahkub lehelt ilma salvestamata, kaob tulemus jäljetult — kasutuslimiit (`DOCUMENT_GENERATE`) on aga juba kulutatud ja commit-itud (generate/route.js:196).
- **Vestlusest loodud mustand** salvestatakse seevastu KOHE (workflowBranchHandlers.js:396) — kaks rada käituvad erinevalt.
- **DRAFT:** muudetav (PATCH title/content/templateId), refine (`POST /api/documents/artifacts/refine` — päris AI-parandusring, mitte stub; vana agent-artifacts-flow.md väide „refine stub" on AEGUNUD), kustutatav, EI ole allalaaditav (`canDownload: false`).
- **FINAL:** `POST /api/documents/artifacts/[id]/approve` → status FINAL + `approvedAt`; korduv approve on idempotentne (`artifact.approve_redundant` audit). FINAL on muutumatu (PATCH → `assertDraftArtifactEditable` → 409), kuid kustutatav. Alla saab laadida DOCX ja PDF (render-on-demand Postgresist; mall placeholderitega `{{TITLE}} {{APPROVED_AT}} {{ARTIFACT_TYPE}} {{CONTENT_BLOCK}} {{SOURCES_BLOCK}}`, vigase malli korral fallback standardmallile).
- **Versioonimist ei ole:** FINAL-ist ei saa teha uut versiooni ega „ava uuesti mustandina" — ainus tee on uus genereerimine nullist. Elutsükkel lõpeb FINAL-iga (vt ptk „elutsükkel" hilisemas koondis). ETTEPANEK-kandidaat.
- **Päritolu:** `AgentArtifactSourceDocument` join-tabel (traceability), `templateId`, retrieval-metaandmed auditis (`artifact.created` + retrievalMode/chunksUsed/fallbackReason). Vestlusest loodud mustandil allikadokumente EI seota (agentDocuments=[] — chat-voog ei päri `/documents` valikuid; allikaks on vestluse enda tekst või efemeersed tükid).

### A.3. Õigused, piirid, kaitsed

- Kõik dokumendi- ja artefakti-API-d nõuavad sessiooni + AKTIIVSET TELLIMUST (`requireDocumentUser` → `requireSubscription`; lib/documents/server.js:98–134). Dokumenditöö on tervikuna tasulise paketi taga (kooskõlas O12 piiriga).
- Omanikukontroll igal objektil; artefaktidel võõra ID → 404 (`findOwnedArtifact` where ownerId). **LEID (P3, ebasümmeetria):** dokumentidel GET/PATCH/DELETE `/api/documents/[id]` võõra ID → 403 (`assertOwnedByUser` viskab 403; route tõlgib „api.common.forbidden"), mitte 404 — olemasolu-oraakel + erineb kovisiooni 404-mustrist. Sama 403-muster on transcribe/summary marsruutidel.
- Genereerimise sisendil privaatsuse eelkontroll (`evaluateTextPrivacy` → 409 + kinnitusdialoog; generate/route.js:91–98). Evidence/materjal läbib PII-redaktsiooni enne OpenAI-d.
- Kvoodid: salvestusruum rollipõhine (`getStorageQuotaBytes`), päevane üleslaadimiskvoot, faili max 25 MB, mustandi max 120 000 tm, rate-limitid igal marsruudil; kasutusarvestus reserve→commit/release idempotentsusvõtmega.
- Failitüübid: ainult PDF/DOCX/TXT + magic-byte kontroll (`assertMimeMatchesBuffer`). `agentAllowed` on vaikimisi false; agent tohib kasutada ainult `agentAllowed=true` dokumente (jõustatud serveris, generate/create mõlemas). NB: `/dokreziim` üleslaadimine lülitab `agentAllowed` kohe PATCH-iga sisse (AgentModePage.jsx:830) — kasutaja jaoks vaikne.

### A.4. Voo katkestuskohad (A)

1. **Genereeritud transientne mustand kaob salvestamata lahkumisel** (P2, vt A.2).
2. **UX-koormus:** kõik valikud korraga ühes vaates (kinnitab varasema UX-kaardistuse leidu; suund „1. mida? 2. millest? 3. vormistus" on teostamata) — VASTUOLU kasutajaootusega „piisab kirjeldamisest": `/dokreziim` nõuab allikadokumenti või helifaili rada; AINULT kirjeldusest saab dokumendi teha vestluse kaudu, mitte töölaualt. (UI täpsustus vajab runtime-kontrolli.)
3. **Vestlusmustand vs töölaud:** vestluses loodud DRAFT ilmub CLIENT-ile `/dokreziim` tulemustes, SOCIAL_WORKER-ile `/documents` artefaktides — kaks eri „kodu" sama objektitüübi jaoks; kasutajale nähtav loogika sõltub rollist (agent-artifacts-flow.md overlay kirjeldus kehtib koodis).
4. FINAL-i järel puudub jätkutee (uus versioon / paranda) — tupik, v.a uus genereerimine.
5. Artefaktil puudub „kasuta ruumis/jaga" rada, v.a MEETING_SUMMARY→ruum (U10) eraldi mehhanism.

## B. Voog B: dokumendianalüüs — kooditõendatud kaart

### B.1. Tegelik arhitektuur: analüüs on EFEMEERNE vestluskontekst, mitte objekt

- Sisenemiskoht: vestluse kirjaklamber + tööriistamenüü kirje „Dokumendi analüüs" (`chat.tools.document_analysis`, ChatComposer.jsx:870). Fail → `POST /api/chat/analyze-file` → RAG-teenuse `/analyze` (rag-service/main.py:3250) → AINULT tekstieraldus (PDF/DOCX/TXT/HTML): `chunks[] + preview(8000) + fullText`. **Midagi ei salvestata ega indekseerita** — vastus kannab `privacy.ephemeral: true` (analyze-file/route.js:253–256). FAKT.
- „Analüüs" (selgitus, riskid, tähtajad, järgmised sammud) tekib alles vestluse vastustes: kliendi hoitud `ephemeralChunks` saadetakse iga sõnumiga kaasa ja server ehitab neist konteksti (`buildEphemeralDocContext`, lib/chat/requestContext.js:74). Kasutaja saab küsida järelküsimusi — iga küsimus reastab tükid uuesti päringu märksõnade järgi. `combineSources` lüliti: ainult dokument VÕI dokument + teadmusbaas (RAG).
- Piirid: CLIENT 2 faili / SOCIAL_WORKER 10 faili vestluses (useChatAnalysisController.js:35); max MB RAG-teenuse konfigist; kasutusarvestus `FILE_ANALYZE` (reserve→commit; ebaõnnestumisel release). Tellimus kohustuslik.
- **Kontekstieelarve on väike (FAKT, kvaliteedipiirang):** CLIENT max 4 tükki / ~1800 tm, SOCIAL_WORKER max 6 tükki / ~2600 tm vastuse kohta (requestContext.js:56–71). Pika ametliku otsuse „analüüs" põhineb igal käigul murdosal dokumendist; tervikanalüüsi ega süstemaatilist riskide/tähtaegade eraldust ei garanteerita. Kasutajale seda piirangut ei kommunikeerita.

### B.2. Mida kasutaja hiljem üles leiab

- Vestluse SÕNUMID (küsimused + AI vastused) püsivad vestlusajaloos kuni vestluse TTL-ini (CONVERSATION_TTL_DAYS=90) või kustutamiseni. FAIL ise ja väljavõte EI säili kuskil; analüüsi kui objekti ei eksisteeri. Lehe sulgemine kaotab tükid → uue sessiooni järelküsimused sama faili kohta nõuavad uut üleslaadimist (uus FILE_ANALYZE kulu).
- VASTUOLU (kasutajaootus vs tegelikkus): ideed.md §2.9 lubab „Dokumentide vaates saab faili sisu analüüsida" — tegelikkuses `/documents` lehel analüüsi-tegevust EI OLE (DocumentsPage.jsx fetch-kaart: list/upload/patch/delete/artifacts; ei ühtegi analyze-kutset). Salvestatud dokumendi kohta EI SAA küsimusi küsida üheski vaates — püsiv fail ja efemeerne analüüs on kaks ühendamata maailma. Ainus sild: `/dokreziim` koostamine kasutab salvestatud faile RAG-otsinguga (see on koostamine, mitte selgitav analüüs).

### B.3. Ametliku kirja/otsuse selgitamise rada

- Teadlikku „selgita ametlikku kirja" sisenemiskohta EI OLE (kinnitab avastamata-vajaduste ptk 1.1 seisu; U7 selge keel on [HARUL], mitte main-is).
- **LEID (P2, katkine ühendus):** Teekonna teenuse-järjepidevuse plokk pakub tegevust „Lisa dokument analüüsiks", mis viib `/documents` (JourneyDetail.jsx:676, 1309) — aga CLIENT suunatakse `/documents`-ilt ALATI `/dokreziim`-i (dokumendi koostamine; app/documents/page.js:36–38), kus analüüsi ei ole. Lubadus ja sihtkoht ei kattu; CLIENT-i tegelik analüüsirada (vestluse kirjaklamber) jääb leidmata.
- Otsusest arusaamise küsimus „mida failist leiti vs mida AI järeldas": eristust toetab ainult üleslaadimispaneeli „Dokumendi tekst" eelvaade (fullText nähtav); AI vastuse sees leid/järeldus/ebakindlus süstemaatiliselt ei eristu (vestluse üldprompt, mitte analüüsi-spetsiifiline struktuur).

### B.4. Voo katkestuskohad (B)

1. Analüüs pole objekt → ei leia hiljem, ei saa jagada, ei saa jätkata (P2 tooteotsuse kandidaat: kas see ongi taotluslik „efemeerne privaatsus"?). Privaatsuseelis on reaalne: fail ei jää serverisse.
2. Teekond→„analüüsiks" viib valesse kohta (P2, B.3).
3. `/documents`-il pole „Analüüsi" kiirtoimingut (UX-kaardistuse soovitud suund teostamata; SOCIAL_WORKER peab teadma, et analüüs elab vestluses).
4. Analüüs→koostamine sild on olemas ainult vestlusesisese voo kaudu (`sourceMode: existing_material` kasutab efemeerseid tükke koostamisel — workflowBranchHandlers.js:306–316); `/dokreziim` EI näe vestluse üleslaadimisi (agent-artifacts-flow overlay kehtib).
5. Väike kontekstieelarve (B.1) — pikkade dokumentide puhul vastus võib olla lünklik, ilma hoiatuseta.

## C. Voog C: helifail ja transkript — kooditõendatud kaart

### C.1. Kaks eraldi heli-rada

1. **Helifail → transkript → kokkuvõte (dokumendipõhine):** heli-allikas on UserDocument (`CALL_AUDIO_RECORDING` = kõnesalvestus nõusolekuga; `UPLOADED_AUDIO_SOURCE` = üleslaetud helifail; max 50 MB, magic-byte kontroll `assertAudioSignature`). `POST /api/documents/[id]/transcribe` → sünkroonne STT (`TRANSCRIPTION_ENABLED` env-lüliti; provider openai/mock; TranscriptionJob kirje QUEUED→RUNNING→DONE/FAILED) → uus UserDocument (kind `CALL_TRANSCRIPT`/`AUDIO_TRANSCRIPT`, `agentAllowed: true` AUTOMAATSELT, content DB-s + .txt failina, metadata provider/model/language). Kui transkript on juba olemas → idempotentne taaskasutus (`transcription_reused`).
2. **Dikteeritud koosolekukokkuvõte (jobipõhine):** `POST /api/documents/meeting-summary/jobs` (max 12 MB audio) → in-memory job + JSON-snapshot kettal (`AGENT_STORAGE_DIR/meeting-summary-jobs/`; snapshot EI sisalda audiot — toPersistedJob jätab payloadi välja, meetingSummaryJobs.js:68–82) → STT → AI-kokkuvõte → UserDocument (kind `MATERIAL`, `agentAllowed: true`). 1 aktiivne job kasutaja kohta; stale-job katkestus; kasutusarvestus STT+DOCUMENT eraldi commit/release.

### C.2. Ülevaatus ja parandamine (inimene kinnitab)

- Transkripti sisu on kasutaja poolt MUUDETAV: `PATCH /api/documents/[id]` lubab `content` muutmist ainult transkripti-liikidel; muudatus kirjutab faili üle ja lisab metadata `reviewedAt + reviewedByUserId` (route.js:228–258) + audit `document.transcript_updated`. See ON „kasutaja ülevaatuse" tehniline jälg. FAKT.
- Kokkuvõte transkriptist: `POST /api/documents/[id]/summary` → range tõetruudus-prompt (9-osaline struktuur; „Transkriptist ei selgu."; pikal transkriptil vahekokkuvõtted) → tulemus on `AgentArtifact` tüübiga `TRANSCRIPT_SUMMARY` (DRAFT; allikaviide transkriptile; metadata sourceTranscript/sourceAudio). Edasi kehtib voo A elutsükkel (kinnita → FINAL → DOCX/PDF).
- Transkriptist saab teha ka mis tahes muu artefakti (`/dokreziim` valib transkripti allikaks; audit `document.transcript_used_for_draft`).

### C.3. Leitavus, allalaadimine, kustutamine

- `GET /api/documents/audio-sources` — heliallikad + viimane transkript koos; `/dokreziim` helitöövoog kasutab seda; `audio-select` logib valiku.
- Transkript on nähtav dokumentide loendis (content serialiseeritakse transkripti-liikide puhul), alla laaditav originaalfailina (`/api/documents/[id]/download`); kustutatav nagu iga dokument.
- **Seose-nüanss (FAKT):** heli kustutamisel transkript JÄÄB alles (`sourceDocumentId` → SetNull) — provenance-viide kaob vaikselt; transkripti metadata (`sourceAudioDocumentId`) jääb rippuma. Vastupidi: transkripti kustutamine jätab heli alles (ootuspärane). TranscriptionJob kustub heliga kaskaadis (source Cascade), aga transcript-viitega SetNull.
- Kõnesalvestusel (`CALL_AUDIO_RECORDING`) on lisaks `retentionUntil` (CallRecordingFile) — eraldi säilitusahel, käsitletud varasemas kõnede auditis; siin ei korrata.

### C.4. Voo katkestuskohad (C)

1. `TRANSCRIPTION_ENABLED=false` → 503 „transcription_not_configured": kas produktsioonis on lüliti sees, EI OLE koodist tõendatav — KESKKONNAPIIRANG; UI peab piiret arusaadavalt näitama (runtime-kontroll).
2. Transkriptsioon on sünkroonne HTTP-päring (pikk helifail → pikk päring → proxy-timeout'i risk); meeting-summary on job, transcribe EI ole — kaks eri töökindlusmustrit.
3. Heli→transkript provenance katkeb heli kustutamisel vaikselt (C.3) — kasutajale ei selgitata.
4. Meeting-summary job-snapshot (kokkuvõtte tekst `result` sees) elab kettal kuni TTL-koristuseni ka pärast seda, kui kasutaja on loodud dokumendi kustutanud — P3 andmejääk (mitte DB, vaid JSON-fail).
5. Transkripti `agentAllowed: true` vaikimisi (üleslaaditud failidel false) — ebasümmeetria, mida kasutajale ei näidata.

## D. Voog D: süvauuring — kooditõendatud kaart

### D.1. Käivitamine ja ulatus

- Ainus sisenemiskoht: vestluse tööriistamenüü „Süvauuring" (`chat.tools.deep_research`); ainult 1:1 vestluses (ruumis blokeeritud nii UI-s kui serveris — `roomId → 400 research.error.room_not_supported`). Käivitus: kasutaja kirjutab küsimuse → `POST /api/research/jobs` `{query, convId, persist: true, uiLocale}` (useChatStream.js:324–335).
- **Peidetud võimekused (FAKT):** API toetab `profile: light|standard`, `focus[]` (max 8), `geo` (NATIONAL/MUNICIPALITY/DISTRICT + automaatne laiendamine kitsalt riigi tasemele koos lünka-märkega), `collection_ids` (max 3), `output_style (SOCIAL_WORKER|CLIENT)` — vestluse UI EI saada ühtegi neist; kõik jooksevad vaikeväärtustega (standard-profiil, geo ALL, output rollist). Ulatuse/eesmärgi täpsustamise UI puudub. KASUTAMATA VALMIS VÕIMEKUS.
- Erinevus tavavestlusest enne käivitamist: kasutajale nähtav ainult režiiminupp + jooksvad staatused; selgitust „mitu minutit, ainult teadmusbaas, 1 korraga, kuulimiit" enne käivitamist koodis ei leidu (runtime kinnitada). Ajaeelarve: standard 300 s, light 120 s (lib/research/settings.js).

### D.2. Töö tegemine ja edenemine

- Job on DB-püsiv (`ResearchJob`; elab üle protsessi restardi), 1 aktiivne job kasutaja kohta (nii loenduskontroll kui P2002 unikaalsuspiire), inline-režiim (`queueMicrotask` samas protsessis) VÕI worker-režiim (`RESEARCH_JOB_MODE=worker` + `scripts/research-worker.mjs`; lease+heartbeat+max 3 katset+stale-interrupt; security.md kinnitab research workeri produktsioonis systemd teenusena).
- Torustik: planeerija (JSON-plaan alaküsimustega) → tõendite kogumine (RAG `/search` alaküsimuste kaupa, konkurentsus, dedup, allika-diversiteedi piir, geo-laiendus) → süntees (JSON-skeem findings+confidence+evidence_refs) → normaliseerimine → raporti tekst. **Allikad on AINULT RAG-teadmusbaas (`sources: "rag_only"`)** — avatud veebi ei kasutata. Kui tõendeid 0 → aus „tõendeid ei leitud" raport koos järgmiste sammudega; kui süntees tühi → tõendipõhine fallback-raport.
- Edenemine kasutajale: SSE `planning → retrieving → synthesizing` (3 etappi) + persistents-poll iga 2,5 s. Kui job pole selle protsessi mälus (nt worker-režiim), annab stream ainult keepalive + lõppseisu (vahefaase mitte) — FAKT.

### D.3. Allikad, tõendid, ebakindlus

- Iga tõend kannab metaandmeid: docId/articleId/chunkId, pealkiri, autorid, aasta, ajakiri, lk-vahemik, source_path/URL. Raportis: iga leid (finding) viitab tõenditele `E#` ja kannab kindlusastet high/medium/low; eraldi „lüngad" (gaps; sh geo-laiendamise ja osalise otsinguvea märked) ja „järgmised sammud". Vastuse allikad lähevad vestlusesse tavaallikakaartidena (`toConversationSources`). See on platvormi kõige eksplitsiitsem ebakindlusmudel. FAKT.

### D.4. Katkestamine, taasavamine, säilimine

- Tulemuse püsivus: valmimisel kirjutatakse raport + allikad VESTLUSESSE (`persistInit/persistAppend/persistDone`) — see on püsiv koopia (kuni vestluse TTL 90 p / kustutamiseni). `ResearchJob` rida ise kustub 14 päeva pärast lõppu (`RESEARCH_DB_JOB_RETENTION_MS`); mälu-snapshot 30 min.
- Tühistamine: stop-nupp → `DELETE /api/research/jobs/[id]` → abort + usage release. Toimiv.
- **LEID (P2): vestluslehelt lahkumine TÜHISTAB töö.** `useChatStream.stop()` kutsub DELETE aktiivsele jobile ja ChatBody unmount-efekt kutsub `stop()` (ChatBody.jsx:2417–2421); ka uue vestluse alustamine / režiimivahetus (`startFreshConversation`, `activateInfoMode(stopActiveRun)`) tühistab. St 2–5-minutiline uuring ei ela üle tavalist SPA-navigeerimist — „katkestamise talumine" on ainult kõva-refreshi juhus (unload ei jõua DELETE-t saata → job jätkab serveris ja tulemus ilmub hiljem vestlusesse). Käitumine on seega EBAJÄRJEKINDEL: soft-nav = kaotus, hard-refresh = ellujäämine.
- Taasavamine: eraldi „uuringu lehte" ei ole; taasavamine = vestluse avamine. Kui job lõpetas pärast hard-refreshi, on raport vestluses järgmisel laadimisel. Kui kasutaja navigeeris ära (cancel), jääb vestlusesse kasutaja küsimus + „tühistatud" (või mitte midagi), usage tagastatakse.

### D.5. Piirid ja lubadused

- Tellimus kohustuslik; kuulimiidid planSeeds: CLIENT 2/kuu, SOCIAL_WORKER 6/kuu, SERVICE_PROVIDER 12/kuu (lib/usage/planSeeds.js:30–70; guardrails.js päevalimiiti 3/5 EI kasutata kusagil — surnud kood). Rate-limit 12 POST/min.
- **KESKKONNAPIIRANG/VASTUOLU-risk:** `RESEARCH_API_ENABLED` vaikimisi VÄLJAS produktsioonis (route.js:21–24: tühja väärtuse korral lubatud ainult non-production). Teadmistekaart ütleb „Süvauuring [MAIN] töötab" — kood on main-is, aga produktsioonis töötab AINULT siis, kui env-lipp on seatud. Kohapealt ei saa tõendada; runtime/ops kinnitada.
- Tulemuse edasikasutus: raport on vestluse sõnum — seda saab kopeerida, kuid ühtegi „tee raportist dokument/artefakt/uuring→koostamine" ühendust EI OLE (tupiktee; ETTEPANEK-kandidaat).

## E. Kustutusahel, säilitus ja privaatsus (kõiki nelja voogu läbiv)

### E.1. Objektide elutsükkel ja säilitus

| Tööobjekt | Mudel/asukoht | Säilitus | Kustutusahel |
|---|---|---|---|
| Üleslaaditud fail | UserDocument + storagePath fail | 90 p (DATA_RETENTION_DAYS) või käsitsi | DB + fail + RAG-viide + audit (täielik) |
| Failist eraldatud tekst (analüüs) | EI SALVESTATA (efemeerne, RAG `/analyze`) | 0 (ei püsi) | pole vaja |
| Analüüsi vestlus | Conversation/sõnumid | 90 p (CONVERSATION_TTL_DAYS) | vestluse cleanup |
| Transkript | UserDocument (CALL_/AUDIO_TRANSCRIPT) | 90 p / käsitsi | nagu fail |
| AI-mustand | AgentArtifact DRAFT | 90 p (updatedAt) / käsitsi | agentArtifact.delete + audit |
| Kinnitatud dokument | AgentArtifact FINAL | 90 p (updatedAt) / käsitsi | sama |
| Meeting-summary job | JSON kettal (AGENT_STORAGE_DIR) + UserDocument | job: TTL-sweep; doc: 90 p | doc kustub; **JSON-snapshot NB** |
| Süvauuringu tulemus | ResearchJob.result + vestlus | job: 14 p; vestlus: 90 p | job cascade; vestlus cleanup |
| RAG-vektorid (agent-dok) | jagatud Chroma-kollektsioon | kuni dok kustub/aegub | dok kustutamisel `deleteDocumentRagReference` |

Retention-cleanup (lib/retention.js) kustutab aegunud dokumendid koos RAG-viite ja failiga; kustutab enne dokumenti alati RAG-i ja faili ning ainult mõlema õnnestumisel DB-rea (fail-safe). Aegunud dokumenti EI kustutata, kui sellel on värske artefakt-seos (source/template) — provenance-kaitse. FAKT.

### E.2. Konto kustutamine

`runUserDeletionCleanup` (userDeletionOrchestrator.js): iga dokumendi RAG-viide + fail kustutatakse ENNE kasutaja kustutust; ükskõik millise ebaõnnestumisel katkeb kasutaja kustutus (jääb ootele, kordamisele — kooskõlas security.md). ResearchJob, AgentArtifact, Conversation kustuvad kaskaadis (`onDelete: Cascade`). `DataAuditLog`/`DataDeletionJob` jäävad auditijäljena. FAKT. **Jääk (P3):** meeting-summary JSON-snapshotid (`AGENT_STORAGE_DIR/meeting-summary-jobs/*.json`, sisaldavad kokkuvõtte teksti `result`-väljas) EI ole konto kustutuse ega dokumendikustutuse ahelas — need eemaldab ainult TTL-sweep; kontojärgne jääk kuni sweepini.

### E.3. LEID (P1, P0-kandidaat) — RAG cross-tenant lekkevektor süvauuringus ja põhivestluses

**Väide:** kasutaja privaatsest dokumendist pärit tekst võib ilmuda TEISE kasutaja süvauuringu raportisse või põhivestluse vastusesse allikaviitena.

**Kooditõend (staatiline ahel):**

1. Kõik RAG-sisu elab ÜHES jagatud Chroma-kollektsioonis (`rag-service/main.py:132`, üks globaalne `collection`); `collection_id` on ainult metaväli, mitte eraldi kollektsioon.
2. `/dokreziim` dokumendimustandi genereerimine indekseerib valitud `agentAllowed` dokumendid sellesse jagatud kollektsiooni (`ensureDocumentIndexed` → `/ingest/text`, embeddings.js:22–82). Metaandmetes EI määrata `audience` → server normaliseerib puuduva väärtuse väärtuseks **"BOTH"** (`normalize_audience(None)` → `["CLIENT","SOCIAL_WORKER"]` → "BOTH"; main.py:259–281). (NB: efemeerne `/analyze` rada EI indekseeri — see on ohutu.)
3. Süvauuring otsib RAG-ist filtriga, mis sisaldab AINULT `audience`-i (+ valikuline geo/collection, mida UI ei saada): `buildWhereForGeo` → `buildAudienceWhere` (pipeline.js:434–483). CLIENT-päring → `audience $in [CLIENT, BOTH]`; SOCIAL_WORKER → `[SOCIAL_WORKER, BOTH]`. **Puudub omanikupiire, puudub `source_type`/`collection_id` väljajätt.** → audience "BOTH" agent-dokument VASTAB mõlemale filtrile.
4. Sama kehtib PÕHIVESTLUSE retrieval'ile: `searchFilters` tuletatakse `audienceFilter`-ist (queryPlanner.js:1064; audience $in […,BOTH]) ilma `source_type`/omaniku piireta (retrievalContextAssembler.js:1174).
5. `/search` (main.py:4439) ei lisa vaikimisi ühtegi omaniku- ega source_type-väljajättu; `_compose_chroma_where` võtab filtrid nagu on.
6. Vastandtõend (mis TÖÖTAB): dokumendimustandi enda retrieval `searchDocumentChunks` (search.js:27–33) piirab korrektselt `doc_id $in [omaniku valitud] + collection_id: agent_documents` — seega mustandi koostamine ise EI leki. Leke puudutab AINULT teisi retrieval-radu (süvauuring, põhivestlus), mis agent-dokumente välja ei filtreeri.

**Mõju:** sotsiaaltöötaja koostab `/dokreziim`-is mustandi kliendi üleslaaditud hindamisaktist/kirjast (eriti tundlik isikuandmete kogum) → dokumendi tükid püsivad jagatud RAG-is (kuni kustutamise/90 p aegumiseni) → teine kasutaja esitab semantiliselt lähedase süvauuringu- või vestlusküsimuse → tükk võib pinnale tulla allikakaardil (pealkiri = dokumendi pealkiri, tekst = tüki sisu).

**Reachability-tingimused ja leevendused (ausalt):**
- Nõuab, et dokument oleks `/dokreziim` mustandivoos indekseeritud (mitte pelgalt üles laaditud ega efemeerselt analüüsitud).
- Nõuab semantilist sarnasust päringuga ja sama audience-klassi.
- Süvauuring on produktsioonis vaikimisi VÄLJAS (`RESEARCH_API_ENABLED`), seega selle haru praktiline aktiivsus sõltub env-lipust — KESKKONNAPIIRANG. Põhivestluse haru on aga alati aktiivne.
- RAG-viide kustub dokumendi kustutamisel/aegumisel, seega aken on ajaliselt piiratud (≤90 p).

**Raskusaste:** märgin **P1** (tervikahel staatiliselt tõendatud, tundlik andmekategooria, põhivestlus alati aktiivne), **P0-kandidaat** juhul kui runtime kinnitab, et agent-dokumendi tükk päriselt pinnale tuleb võõra kasutaja vastuses. Vajab runtime-tõendust ja/või koodiparandust (agent-dokumentide `source_type`/collection väljajätt kõigis mitte-omaniku retrieval-radades, või agent-dokumentidele eraldi Chroma-kollektsioon).

### E.4. Muud privaatsustähelepanekud (nelja voo lõikes)

- **VASTUOLU (P3):** dokumendi/artefakti võõra ID pöördumine annab 403 (olemasolu-oraakel), samas kui kovisioon annab läbivalt 404 (max-täienduse muster). Väike infoleke + ebajärjekindlus. (documents/[id] route, transcribe, summary → 403.)
- Analüüs on efemeerne = privaatsuseelis (fail ei jää serverisse), aga samas tähendab, et „mida failist leiti" ei ole hiljem auditeeritav.
- Generation/refine sisend läbib PII-redaktsiooni ja privaatsuse eelkontrolli (409-kinnitus) enne AI-d. FAKT.
- Logimine minimeeritud (safeError, dokumendiaudit ilma nime/sisuta) — kooskõlas security.md.
- Süvauuringu raport kirjutatakse vestlusesse; kui uuring käivitati vestluses, on tulemus seotud selle vestluse privaatsuspiiriga (1:1, ruumis blokeeritud) — OK.

## F. Runtime-kontroll: tehtu ja piirangud

**KESKKONNAPIIRANG:** täielikku autenditud brauseri-e2e-d (fail üles → analüüs → mustand → kinnitus → allalaadimine → süvauuring → kustutus → võõra fail-closed) EI olnud võimalik teha:
- selle akna Linux-liivakast on kasutaja masinast eraldi võrgus — `localhost:3000` (Next dev) ja `127.0.0.1:8000` (RAG) EI ole liivakastist kättesaadavad (mõlemad `curl` → ühenduseta);
- ühtegi Chrome'i brauserit ei ole kontoga ühendatud (`list_connected_browsers` → []), seega kasutaja päris sessiooni ei saanud juhtida;
- varasem orientatsioon märkis, et selle rakenduse route-segmentide klient-hüdratsioon brauseripaanis ei käivitu — UI-kihi visuaalne e2e jääb päris sessioonidele.

**Mida siin-keskkonnas siiski tõendasin (sandbox-tasandi runtime):**
1. **Sihttestid rohelised:** `node --test tests/documents/* tests/privacy/*` → 16/16 pass (audioWorkflow, downloadHeaders, transcriptSummaryPrompt, privacyGuard). Kinnitab heli-/transkripti-nimetuste, allalaadimispäiste, transkriptikokkuvõtte-prompti ja PII-guardi käitumise.
2. **E.3 lekke-eelduse programmiline reprodutseerimine:** kordasin `rag-service` `normalize_audience` loogikat — agent-dokumendi indekseerimine ilma audience'ita → `"BOTH"`; süvauuringu/vestluse `audience $in [CLIENT,BOTH]` JA `[SOCIAL_WORKER,BOTH]` → mõlemad MATCH. See tõendab lekke-ahela eelduse (mitte veel tervikpinnaletuleku võõra kasutaja vastuses — see nõuab töötavat RAG-i).
3. Kõik voo-väited on tõendatud aktiivse `main` @ `7ae76d5b` koodi, skeemi ja marsruutide vastu (staatiline verifitseerimine).

**Testandmeid ega ajutisi faile ei loodud kasutaja süsteemi; ligipääsutõendeid ei kasutatud.**
