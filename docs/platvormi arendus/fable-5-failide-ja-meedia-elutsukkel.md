# FAILID-A0 — failide ja meedia elutsükli tervikaudit

STATUS: COMPLETE

Alustatud: 2026-07-16. Auditeerija: Claude (Fable 5), read-only; lõpetatud: Codex, 2026-07-17.
Skoobipiirid: EI korrata DOK-XTEN-P0 retrieval'i cross-tenant auditit, RUUM-A0 ärivoogu,
Materjalide/Help/Teekonna/profiili tervikanalüüse, OPS-FINAL-A0 deploy-auditit ega
ekspordi tervikauditit — siin ainult failide loomise/ingest'i/kustutuse elutsükkel.

## 1. Git/main/server seisumaatriks (värskendatud 17.07.2026)

| Kiht | Seis |
|---|---|
| Lokaalne `main` | `0da4185b` (16.07 17:17; 1 ees / **22 taga** origin'ist) |
| `origin/main` | `fe4eb4fa` — sisaldab merge'itud Admin-P0.1, Help-P0 privaatsusparandusi ja **DOK-XTEN P0** (`f5d2f7b9` „isolate private agent documents from general RAG") |
| Tootmisserver | `fe4eb4fa` **= origin/main** (kontrollitud SSH 17.07) → toodangu tõeallikas on origin/main |
| Lokaalne tööpuu | määrdunud (RV-P0 UI + dokumendid) — failide elutsükli kood puhas (`git status`: 0 muudatust `lib/documents|privacy|calls|materials|research|transcription`, failide API-routes) |

Kontrolli täpsustus: `git ls-remote origin refs/heads/main` ja lokaalne remote-ref andsid mõlemad
`fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`; serveri `HEAD`, haru `main` ja puhas tööpuu
andsid sama SHA. Frontend ja RAG olid `active` ning sama release'i protsessid käivitusid
16.07.2026 20:49 EEST; `.next/BUILD_ID=AiSZcEK2rYrhHGxu2kdUh`. Serveris on
`RESEARCH_JOB_MODE=worker`, kuid `sotsiaalai-research-worker.service` on `not-found`/`inactive`.
See on käesolevas auditis runtime-tõend, mitte OPS-FINAL-A0 deploy-audit.

Asjakohane Git-ajalugu: DOK-XTEN-P0 on `origin/main`-i merge'itud (`f5d2f7b9` ja sellele
järgnenud auditiparandused). `origin/main`-i suhtes merge'imata remote-harudest ei leidunud
teist failielutsükli parandust; nähtavad RAG-QM P0/P0a harud on kvaliteedimõõtmise harud ega
muuda all kirjeldatud kasutajafaili elutsüklit. Ühtegi merge'i ega checkout'i ei tehtud.

**Failipinna delta 890124bd→origin/main = ainult 3 faili** (`git diff --stat`):
`lib/documents/search.js` (agent-otsing → eraldi `/search/agent-documents` endpoint, `doc_ids` allow-list 1–50, `extra=forbid`),
`rag-service/main.py` + uus `search_security.py` (üld-`/search` välistab agent_documents kollektsiooni),
`app/api/research/jobs/route.js` (+4 rida: `collection_ids` filtrist eemaldatakse privaatsed agent-kollektsioonid).
Kõik ülejäänud selle auditi loetud failid on 890124bd ja origin/main vahel **identsed** → K1–K18 vastused
kehtivad serveri seisu kohta; sha-orvu leid (allpool) kehtib ka DOK-XTEN-järgses koodis, sest
kustutus käib endiselt ainult praeguse sha `doc_id`-ga ja vana-sha kirjeid ükski rada ei korista.

Tootmise failiseadistus (väärtused, mitte saladused): `DOCS_STORAGE_DIR=/var/lib/sotsiaalai/documents`,
`MATERIALS_STORAGE_DIR=/var/lib/sotsiaalai/materials`, `AGENT_STORAGE_DIR=/var/lib/sotsiaalai/agent`,
`RECORDING_STORAGE_DIR=/var/lib/sotsiaalai/recordings`, `DATA_RETENTION_DAYS=90`,
`LOG_RETENTION_DAYS=90`, `RECORDING_DEFAULT_RETENTION_DAYS=90`, `RAG_SERVER_MAX_MB=25` ja
`TRANSCRIPTION_MAX_FILE_SIZE_MB=25`. `RECORDING_EGRESS_OUTPUT_DIR` pole eraldi määratud, seega
egress ja salvestise lähtefail kasutavad vaikimisi sama recording-kataloogi. Eraldi retention'i
systemd timer'it ega root/ubuntu croni ei leitud; jõustamine on rakenduse laisk/manual rada.

## 2. Kohustuslikud küsimused — lõplikud vastused

| # | Küsimus | Vastus (seis) |
|---|---|---|
| K1 | Kas server kontrollib päris failitüüpi või ainult laiendit/MIME-headerit? | **Ebaühtlane.** Kasutajadokumendid ja materjalid kontrollivad PDF-i `%PDF-`, DOCX-i ainult `PK`-ZIP-allkirja ja teksti juhtbaite (`lib/documents/server.js:237–271`, `lib/materials/server.js`). Audio kontrollib konteinerisignatuure, kuid `audio/mpeg` või `.mp3` lubab tundmatu sisu läbi (`audioWorkflow.js:79–107`; runtime'is tõendatud). Chat-analyze ja RAG eelistavad deklareeritud MIME-i (`analyzeFileConfig.js`, `rag-service/main.py:775–783,3263–3279`), seega ei ole maagiline kontroll fail-closed. Kohtumise kokkuvõtte 12 MB audio kontrollib MIME-i, mitte signatuuri. KOV adminifailidel on laiend + NUL/semantiline tekstivalideerimine; organisatsiooni attachment'il ainult laiend. |
| K2 | Millised mahu-, arvu- ja päevapiirid on serveris jõustatud? | Dokumendid 25 MB/fail, 12 upload'i/min, loend 50, rollipõhine kogukvoot ja 100 MB/päev; materjalid 25 MB/fail, max 10/päring, 8 päringut/15 min ja 100 MB/päev; chat-analyze prod 25 MB; audio-source prod 25 MB; meeting-summary audio 12 MB; KOV adminifail 12 MB; organisatsiooni adminifail 16 MB. Artefaktisisu max 120 000 märki ja max 10 lähtefaili. Transkripti/meeting-summary genereeritud `UserDocument`-ile ei tehta enne kirjutust eraldi storage-kvoodi kontrolli (F-10). |
| K3 | Kas failinimi võib põhjustada path traversal'i / header injection'i / ohtliku allalaadimisnime? | Kasutaja-, materjali-, KOV-, organisatsiooni- ja recording-storage kasutavad UUID/basename'i ning root-valvet; download sanitiseerib ohtlikud märgid + ASCII/RFC5987 nime. **Erand:** API-key taga RAG `/upload` ja `/ingest/file` annavad `fileName` otse `d / file_name` rajale ilma `_sanitize_filename`-ita (`main.py:3324–3328,3624–3636`); teenus kuulab prod localhost'il, kuid sisekliendi/key kompromissi korral on path-escape võimalik (F-12). |
| K4 | Kas ZIP/PDF/DOCX konteiner võib põhjustada decompression bomb'i? | **Jah, lisakaitse on vajalik.** DOCX-mallil on 512 kirje ja keskregistris deklareeritud 16 MB piir (`docxExport.js:228–278`), kuid `inflateRawSync` järel tegelikku lahtipakitud mahtu ei võrrelda; seega pole see täielik bomb-kaitse. Üleslaaditud DOCX on ainult „ükskõik milline PK-ZIP" ja RAG `docx2txt.process` lahtipakib ilma entry-/ratio-/uncompressed-piirita. PDF-il on ainult 25 MB sisendipiir, mitte lehe-, objekti-, CPU- ega lahtipakitud voo piir. |
| K5 | Kas toimub viiruse-/aktiivsisu-/pahatahtliku dokumendi kontroll? | **Ei.** ClamAV/malware/aktiivsisu skannerit ega parseri sandbox'i ei ole. `attachment` + `nosniff` vähendab brauseris käivitamist, kuid ei kaitse serveriparserit. Malli eksport kirjutab kõik muud ZIP-kirjed muutmata tagasi ja asendab vaid `word/document.xml`; välisviited, embedded-objektid/custom XML jäävad alles. Vajalikud O-F1/O-F2 otsused ptk 10. |
| K6 | Kus failid füüsiliselt asuvad? | (1) `/var/lib/sotsiaalai/documents/uploads` + alamad `kov/` ja `organizations/`; (2) `/var/lib/sotsiaalai/materials/uploads`; (3) `/var/lib/sotsiaalai/recordings` egress/lähtefailid; (4) `/var/lib/sotsiaalai/agent/meeting-summary-jobs/*.json` ja võimalikud `.tmp`; (5) RAG `RAG_STORAGE_DIR`: Chroma, `registry.json`, ja `/ingest/file|upload` puhul `docs/<sha1(doc_id)[:12]>/toorfail`; (6) PostgreSQL: `UserDocument.content`, `AgentArtifact.content`, `ResearchJob.payload/result`, meta- ja auditikirjed. Chat-efemeerne fail ning PDF/DOCX eksport on mälus. |
| K7 | Kas omaniku-/tenant-piir kontrollitakse igal read/download/delete/process rajal? | Kasutajadokument, audio, transkript, artefakt, research job ja meeting-summary job kontrollivad omanikku; room-share nõuab omanikku, spetsialisti/admini rolli ja FINAL `MEETING_SUMMARY`; materjale loeb/laeb alla/kustutab ainult admin, kuid üleslaadijal pole oma haldusrada. KOV/organisatsioon failid nõuavad vastavat adminisessiooni. DOK-XTEN-P0 retrieval-piir on eraldi auditis ja siin ei korratud. |
| K8 | Kas võõras ID annab faili/metadata/download'i/staatuse? | Sisu ei anta. Dokumentide põhiteel on siiski 404/403 erinevus: olemasolev võõras ID jõuab pärast `findUnique` omanikuasserti 403-ni (olemasolu-oraakel, F-14). Room-share kasutab `findFirst({id,ownerId})` ja ühtlast 404-t — säilitamist väärt muster. Tootmiskasutajate ID-dega runtime-katset safeguard'i tõttu ei tehtud. |
| K9 | Kas download-päised on privaatsed ja ohutud? | **Jah kontrollitud pindadel.** Dokument, materjal, KOV ja organisatsioon kasutavad jagatud `buildDownloadHeaders`: `Cache-Control: no-store, no-cache, must-revalidate`, `nosniff`, `Pragma/Expires`, `attachment`, ASCII-fallback + RFC5987 UTF-8. Header-runtime test läbis. Artefakti in-memory download kasutab samuti attachment-vastust; koostalitluse tervikaudit jäi skoobist välja. |
| K10 | Millised failid on ajutised ja kas need kustuvad kõigil radadel? | Chat `/analyze` töötleb raw faili mälus ega indekseeri; tootmise markeritest kinnitas seda ptk 5. Toortekst/chunks jõuavad kliendile ja võivad mõjutada hiljem salvestatavat chat-vastust, kuid raw faili ei salvestata. Ekspordid on mälubufferid. Egress-allikas kustub ainult eduka finalize'i järel; timeout/stop-failure jätab selle alles. Meeting-summary job kasutab atomaarse JSON-write'i `.tmp` faili, kuid crash-`.tmp` ja restardieelne terminal-JSON ei kuulu sweep'i. |
| K11 | Mis juhtub, kui DB-kirje tekib, aga fail/RAG ebaõnnestub? | Üksik dokumendikustutus kustutab DB rea enne faili; faili/RAG ebaõnnestumise korral tagastab route ikkagi 200 ja jätab FAILED `DataDeletionJob`-i. Automaatne 6 h retention-sweep proovib uuesti ainult `USER_DELETE` töid, muud fail/RAG tööd vajavad admini käsitsi retry't. Materjali/adminifaili delete on file-first: DB-tõrge jätab rea puuduvale failile. Adminifaili upload'i hiline sync-tõrge võib pärast DB update'i catch'is uue faili kustutada, jättes DB rea puuduvale failile. |
| K12 | Mis juhtub, kui fail/RAG tekib, aga DB katkeb? | Dokumendi, materjali ja audio-source upload püüavad tavavea korral uue faili kustutada, kuid protsessicrash kirjutuse ja DB-create'i vahel jätab orvu. Transcribe kirjutab TXT-faili enne `UserDocument.create` ja selle catch ei kustuta faili. Transcript PATCH kirjutab faili enne DB SHA/content update'i. Recording stop on egress-stop → copy → `UserDocument.create` → `CallRecordingFile.update` → request-update ilma kompensatsioonita. KOV/org upload'i asendus võib jätta vana faili orvuks või uue DB viite katkeda. |
| K13 | Kas konto/dokumendi/salvestuse/materjali kustutus eemaldab kõik koopiad? | **Osaliselt.** Konto sihtpäring on `userDocument.findMany({where:{ownerId}})` ilma `kind` filtrita (`userDeletion.js:19–34`), seega katab staatiliselt kõik kaheksa `UserDocument.kind` väärtust, lisaks materjalid ja artefaktid; kasutaja kustub fail-closed alles pärast RAG+fail edu. Katmata jäävad vana-SHA RAG ID-d, meeting-summary job JSON-id, egress-orvud ja DB-ta kettaridad. Üksik dokumendikustutus pole fail-closed (K11). Lähteartefakti kustutamine ei eemalda ruumi kopeeritud `RoomMessage.content`-i; autori konto kustutus eemaldab sõnumi FK Cascade tõttu. |
| K14 | Kas tekivad orvufailid/orvud RAG-is/nähtamatud transkriptid? | **Jah:** kõik K12 crash-aknad; egress-timeout; aktiivse nõusoleku tagasivõtu elus egress; vana-SHA `agent::<id>::<oldSha>` vektor; meeting-summary `.json/.tmp`; admin upload'i asendus; materjali file-first delete; transkriptsiooni samaaegsed duplikaadid. Puudub üldine ketas↔DB↔RAG reconciler või scheduled orphan-sweep. `DataDeletionJob` katab ainult instrumenteeritud kustutusrajad, mitte crash-orbe. |
| K15 | Kas audio+transkriptsioon järgivad nõusolekut retry/partial-failure radadel? | Start nõuab kõigi aktiivsete osalejate `CONSENTED` olekut ja kovisioonis on salvestus keelatud. **P0:** ACTIVE päring kuulub `OPEN_RECORDING_STATUSES` hulka; `WITHDRAWN`/`DECLINED` muudab requesti `DECLINED`-iks, kuid ei kutsu `stopRecording`; `cancelRecordingRequest` teeb ACTIVE requesti `STOPPED`-iks samuti egress-stopita. Seejärel tavaline stop enam ei tööta, sest nõuab ACTIVE olekut. Transkriptsioon on järjestikusel retry'l idempotentne, kuid puudub konkurentsi unikaalsus ja failikirjutuse kompensatsioon. |
| K16 | Kas logidesse/vigadesse/auditisse satub failisisu/nimi/heli/privaatne tekst? | Sisu/heli rakenduse tavakonsolisse ei logita ja `safeError` redigeerib tundlikke välju. **Parandus varasemale vastusele:** `auditShared` konsoolipayload sisaldab ainult tehnilisi välju, mitte `title/originalName`; nimi jõuab siiski `DocumentAudit.meta` DB-sse. Materjali teavituskiri sisaldab üleslaadija identiteeti, kommentaari ja algseid failinimesid; STT saadab algse failinime OpenAI File objektile. RAG cost-logis on `doc_id`, mitte failisisu. Tegelikke tootmisloge ei loetud. |
| K17 | Kas genereeritud artefakti uus versioon asendab/dubleerib/säilitab vana? | `POST /artifacts` loob iga salvestuse uue DRAFT rea; sama DRAFT-i `PATCH` kirjutab sisu kohapeal üle, FINAL on muutmatu. UI `workspaceVersions` on ainult Reacti mälus (limiidiga) ja kaob reload'il; DB-s immutable versioonitabelit pole. Uus generate+save või transcript-summary POST loob uue `AgentArtifact`, mistõttu read kuhjuvad kuni üksikkustutuse, konto kustutuse või 90p sweep'ini. Artefakti PDF/DOCX on hetkeline download, mitte uus püsifail. |
| K18 | Kas retention koodis vs õigustekstis vs tegelik kustutus kattuvad? | **Ei täielikult.** Prod env ja põhireegel on 90p, kuid sweep käivitub ainult laisalt/manualselt, protsessimälus 6 h throttliga; timer/cron puudub, seega „kuni 90 päeva" pole hard deadline. `CallRecordingFile.retentionUntil`-i retention ei loe: audio kustub `UserDocument.updatedAt` järgi ja recording-file rida võib jääda `AVAILABLE` olekus `createdDocumentId=null`. `MaterialSubmission`, adminifailid, egress-orvud ja meeting-summary job snapshots pole 90p sweep'is. ResearchJob terminal-read 14p kustub samuti laisalt. Värske artefakt lükkab seotud dokumendi kustutust edasi, kuid „lühiajaliselt" pole mõõdetud. |

## 3. Kanooniline failiregister

| Liik / kandja | Loomise pind | Kanooniline püsikoht | Omanik / piir | RAG / kõrvalkoopia | Retention ja kustutus |
|---|---|---|---|---|---|
| Kasutaja dokumendid: `TEMPLATE`, `MATERIAL`, `OTHER` | `/api/documents` upload; meeting-summary output kasutab `MATERIAL` | `DOCS_STORAGE_DIR/uploads/<uuid>.<ext>` + `UserDocument` meta; tekstil võib olla `content` | `ownerId`; kõik kasutajarajad owner-checkiga | laisk `agent::<documentId>::<sha256>` `agent_documents` kollektsioonis, kui dokumenti artefakti jaoks kasutatakse | üksik delete, konto delete, 90p `updatedAt` sweep; värske artefaktiseos lükkab sweep'i |
| Kasutaja audioallikas: `UPLOADED_AUDIO_SOURCE` | `/api/documents/audio-sources` | sama uploads + `UserDocument` | uploader | vaikimisi `agentAllowed=false`; STT-provider saab audio | üksik/konto/90p nagu muu UserDocument |
| Kõnesalvestis: `CALL_AUDIO_RECORDING` | LiveKit egress + `stopRecording` finalize | egress `/recordings/<safe>.ogg` → koopia uploads + `UserDocument`; `CallRecordingFile` hoiab egress/meta viidet | ainult requesti algataja `ownerId`; kõigil osalejatel on nõusolekukirje | ei indekseerita | `retentionUntil` kirjutatakse, kuid ei jõustata; UserDocument 90p/account delete; egress-orvud katmata |
| Transkriptid: `CALL_TRANSCRIPT`, `AUDIO_TRANSCRIPT` | `/documents/[id]/transcribe` | TXT uploads + sama tekst `UserDocument.content`; `TranscriptionJob` | lähteaudio omanik | `agentAllowed=true`, laisk SHA-põhine RAG | üksik/konto/90p; lähteaudio kustutus teeb `sourceDocumentId=null`, transkript jääb |
| Transkripti kokkuvõte | `/documents/[id]/summary` | `AgentArtifact` DB-s, mitte eraldi fail; enum `TRANSCRIPT_SUMMARY` on olemas, kuid see route ei loo selle kind'iga UserDocumenti | transkripti omanik | artefakti allikaseos transkriptile | uus POST loob uue artefakti; artifact delete/account/90p |
| Materjalide failid | `/api/materials` | `MATERIALS_STORAGE_DIR/uploads/<uuid>.<ext>` + `MaterialSubmission` | submitter seos; sisu ainult adminile | automaatset RAG ingest'i pole; `imported` on review-olek | admini üksikkustutus või konto delete; retention-sweep puudub |
| Vestluse efemeerne fail | `/api/chat/analyze-file` → RAG `/analyze` | raw fail ainult Next/RAG mälus; fullText/chunks kliendi olekus ja chat requestis | aktiivne kasutaja/request | **ei indekseerita**, registry/Chroma ei muutu | requesti lõpp/klienti reload; sellest loodud user/assistant chat-sisu järgib vestluse retention'it |
| Uurimistöö sisend/väljund | `/api/research/jobs` | füüsilist faili pole; `ResearchJob.payload` (query/fookus/geo) ja `result` JSON; `persist=true` korral koopia `ConversationMessage`-tes | `userId`; üks aktiivne job/kasutaja | loeb lubatud RAG allikaid, kuid oma tulemust ei indekseeri | terminal-job vaikimisi 14p laisk DB sweep; vestluskoopia 90p; konto FK Cascade |
| Meeting-summary async töö | `/api/documents/meeting-summary/jobs` | audio ainult tööprotsessi mälus; job snapshot `AGENT_STORAGE_DIR/meeting-summary-jobs/<id>.json`; lõpptulemus UserDocument (`MATERIAL`) | snapshotis `userId`, API owner-check | output UserDocument võib hiljem indekseeruda | live terminal-job 30 min; restardijärgne JSON ja `.tmp` võivad jääda tähtajatult; konto kustutus ei sihi kataloogi |
| `AgentArtifact` | generate/save/refine/summary | `AgentArtifact.content` PostgreSQL-is; source-linkid DB-s | `ownerId`; FINAL room-share spetsialisti/admini rolliga | source-dokumendid võivad RAG-i minna, artefakt ise mitte | üksik delete, konto Cascade, 90p `updatedAt`; DRAFT PATCH asendab, uued salvestused kuhjuvad |
| Jagatud meeting-summary koopia | room-message POST `summaryArtifactId` | sõltumatu `RoomMessage.content` | ruumi liikmed; koopia autor | pole seost algartefaktiga ega RAG-iga | lähteartefakti delete ei revoke'i; autori konto delete eemaldab sõnumi Cascade'iga; room retention 90p laisk |
| Admini KOV lähtefailid | admin KOV file API, 7 fikseeritud rolli | `DOCS_STORAGE_DIR/kov/<slug>/<uuid>.<ext>` + `MunicipalityKovAdminFile`; üks rida rolli kohta, `version++` | KOV admin | RAG `/ingest/text`, deterministlik KOV doc ID; raw lähtefail RAG-i ei kopeeru | asendus/delete manual; retention puudub; lähtefaili delete ei kustuta juba ingestitud vektorit |
| Admini organisatsiooni lähtefailid | admin organization file API; 4 core + attachment | `DOCS_STORAGE_DIR/organizations/<slug>/<uuid>.<ext>` + `OrganizationAdminFile`; core asendub, attachment'id kuhjuvad | organization admin | core `rag.md` `/ingest/text`; attachment ei ingest'ita automaatselt | asendus/delete manual; retention puudub; file delete ei kustuta RAG doc'i |
| RAG-i otse-uploaditud lähtefail | võtmega `/upload` või `/ingest/file` | `RAG_STORAGE_DIR/docs/<sha1(doc_id)[:12]>/<fileName>` + `registry.json` + Chroma | API-key / admin-taseme sisepind, mitte user-owner mudel | sama doc ID vektorid asendatakse | `/documents/{doc_id}` delete püüab vektori/registry/raw kustutada, kuid neelab üksikvead ja tagastab `ok`; retention puudub |
| Genereeritud download/eksport | artefakti PDF/DOCX ja muud in-memory eksportijad | serveris mälubuffer; brauseri allalaaditud koopia on platvormi kontrolli alt väljas | kutsuja owner-check | pole | requesti lõpp; välise koopia kustutust ei saa platvorm jõustada; koostalitluse tervikaudit oli skoobist väljas |
| Ajutised failid | DOCX `NamedTemporaryFile`, meeting job `.tmp`, egress partial, testimarkerid | OS temp / agent / recording katalog | protsess | pole | DOCX temp contextiga; job `.tmp` ja egress partial pole sweep'itud; auditi testitemp koristati nullini |

## 4. Elutsükli analüüs pindade kaupa

### 4.1 Kasutajadokumendid, audioallikad ja transkriptid

- **Loomine/valideerimine.** Dokumendi/materjali upload lahendab whitelistitud laiendi+MIME-i, kontrollib raw
  signatuuri, suurust, rate/daily/storage-kvooti ning kirjutab UUID-nimega faili. Audioallikas teeb samu
  quota/rate kontrolle ja konteinerisignatuuri, välja arvatud MP3 bypass. Transkriptsioon kontrollib ownerit,
  subscription'it ja STT seadistust, kuid genereeritud TXT storage-kvooti ei prognoosi.
- **Asukoht/omand.** `UserDocument.ownerId` on kanooniline tenant-piir; `storagePath` on suhteline ja
  `resolveAbsoluteDocumentPath` lubab ainult uploads-root'i. Tekstipõhistel tuletistel on sisu nii failis kui
  `content` väljal. Lähteviide on `onDelete:SetNull`, seega tuletis võib lähte kustutuse järel õiguspäraselt
  iseseisvana alles jääda.
- **Töötlus/versioonid/RAG.** RAG ID sisaldab praegust SHA-d. Transcript PATCH kirjutab sama faili ja muudab
  SHA-d, kuid vana ID-d ei kustuta. Kaks samaaegset transcribe-requesti võivad mõlemad „latest transcript"
  puudumise järel oma dokumendi luua, sest DB uniqueness/CAS puudub.
- **Jagamine/download.** Download on `attachment`, `no-store`, `nosniff`, ohutu UTF-8/ASCII nimega. Otsest
  UserDocument→teine kasutaja jagamisobjekti ei ole. Meeting summary jagamisel kopeeritakse FINAL artefakti
  tekst room message'isse; source delete/revoke ei ulatu koopiani.
- **Kustutus/retention/retry.** Retention ja konto kustutus on fail-closed; üksik delete ei ole. Konto sihtpäring
  haarab kõik `DocumentKind` väärtused. Instrumenteeritud kustutustel on `DataDeletionJob`, kuid ainult konto
  tööd retry'takse automaatselt. Üldist ketas↔DB↔RAG võrdlust pole.

### 4.2 Materjalide failid

- **Upload.** Autenditud kasutaja saab max 10 PDF/DOCX/TXT faili korraga; failid kirjutatakse järjest ja
  `MaterialSubmission` read luuakse ühe Prisma transaction'iga. Tavavea catch eemaldab selles requestis
  teadaolevad failid, protsessicrash võib jätta orvud.
- **Omand/jagamine.** `submittedByUserId` säilib, kuid uploaderil pole list/download/delete API-t; admin loeb,
  laeb alla, märgib review/imported ja kustutab. Teavituskiri saadab adminile failinimed, comment'i ja uploaderi.
- **Kustutus/retention.** Admin delete kustutab faili enne DB-rida; DB tõrke jaoks puudub deletion-job.
  Account-delete koristab submitteri kõik failid fail-closed. 90 päeva sweep `MaterialSubmission`-i ei hõlma.

### 4.3 Vestluse efemeerne fail

- **Töötlus.** Next loeb multipart `File`, kontrollib requesti MIME/extension whitelist'i ja 25 MB piiri ning
  saadab raw faili localhost RAG `/analyze`-sse. RAG loeb kogu faili mällu, usaldab deklareeritud MIME-i,
  parsib ja tagastab `preview`, `fullText`, `chunks`; registry/Chroma kirjutust selle endpoint'i koodis pole.
- **Katkestus/retry.** Next timeout vabastab usage reservation'i; RAG parser ei kontrolli kliendi disconnect'i,
  seega võib töö serveris timeout'i järel lõpuni joosta. Raw fail ei jää kettale, kuid chunks ja nende põhjal
  loodud chat-vastus võivad jõuda 90p vestlusajalukku. See eristus peab olema privaatsustekstis selge.

### 4.4 Uurimistööd

- **Loomine/asukoht.** Jobi query ja normaliseeritud parameetrid lähevad `ResearchJob.payload` JSON-i, report,
  evidence ja sources `result` JSON-i; füüsilist sisend-/väljundfaili pole. Owner-check on `userId`-ga.
- **Töötlus/retry.** Worker claim/lease on durable, default max 3 katset; cancel märgib DB oleku ja pipeline
  kontrollib cancellation'it etappide vahel. `persist=true` kirjutab query/reporti ka vestlusse; persistence
  helperi viga ei takista jobi `done` olekut, seega kaks kandjat võivad lahkneda.
- **Retention/runtime.** Terminal-read kustub 14p pärast ainult job-store tegevuse käivitatud tunnise laisa
  sweep'iga. Tootmises on worker-mode, kuid worker unit puudub; uued jobid võivad jääda queued. Konto kustutus
  eemaldab DB read FK Cascade'iga. Worker-protsessi tegelik alternatiivne käitus väljaspool systemd-d on
  `not_proven`.

### 4.5 Kõnesalvestised ja nõusolek

- **Start.** Kõik aktiivsed osalejad peavad nõustuma. Placeholder märgitakse PROCESSING, siis käivitatakse
  LiveKit egress, alles seejärel salvestatakse `egressId` ja request ACTIVE. Crash pärast egress-starti, kuid enne
  DB update'i võib jätta elusa halvasti jälgitava egressi.
- **Stop/finalize.** Jada on egress-stop → kuni 15 s stabiilsuse ootus → source read → uploads copy → source
  unlink → `UserDocument` → `CallRecordingFile` → request. Transaction'i/kompensatsiooni pole; iga piir jätab
  erineva partial-state'i. Timeout'i catch märgib FAILED, kuid ei kustuta source'i ega paku finalize retry't.
- **Nõusoleku tagasivõtt.** ACTIVE on consent/cancel päringu lubatud olek; request muudetakse enne tegelikku
  stoppi DECLINED/STOPPED-iks ning egressi ei peatata. Järgnev stop lükkub `recording_not_active`-ga tagasi.
- **Retention/omand.** Audio UserDocument kuulub requesti algatajale, mitte kõigile nõustunutele.
  `retentionUntil` on meta, mitte sweep'i tingimus. See, kellel on hilisem ligipääsu-/kustutusõigus ja kas
  tagasivõtt kustutab juba salvestatud osa, vajab O-F6 otsust; kohene egress-stop ei vaja otsust.

### 4.6 Meeting-summary job ja genereeritud fail

- Audio (max 12 MB) on ainult live `jobs` Map-i payload'is ja OpenAI STT sisendis; persisted JSON ei sisalda
  audiobufferit, kuid sisaldab `userId`, result summary't ja document metadata't. Kirjutus on temp+rename.
- Sweep käib ainult sama protsessi `jobs` Map-i terminal-kirjete üle. Pärast restarti kettal olev terminal-JSON
  Map-i ei laeta ega vanuse järgi kustutata; `.tmp` faile list ei näe. Stale active job märgitakse erroriks ainult
  siis, kui konkreetset snapshot'i või aktiivsete tööde arvu küsitakse, ja JSON jääb alles.
- Edukas lõpp loob `MATERIAL` UserDocumenti ning writer koristab tavaveal faili; enne output'i pole storage-kvoodi
  kontrolli. Konto kustutus eemaldab output UserDocumenti, kuid ei enumereeri job-kataloogi.

### 4.7 AgentArtifact ja room-share

- Generate võib elada salvestamata UI state'is; POST loob DRAFT rea. Refine loob uue sisu, kuid salvestamisel
  PATCH asendab sama DRAFT-i. FINAL-i ei saa muuta. UI versiooniajalugu on ainult mälus; eraldi immutable DB
  versioon puudub. Uus generate+save ning iga transcript-summary POST loob uue rea.
- PDF/DOCX luuakse download-requestis mällu. Malli puhul asendatakse `word/document.xml`, ülejäänud archive
  säilib; see on vormingu säilivuse tugevus ja aktiivsisu risk ühtaegu.
- Room-share loeb ainult owneri FINAL MEETING_SUMMARY sisu ja loob uue `RoomMessage` rea ilma artifactId-ta.
  Seetõttu source artifact delete ei revoke'i koopiat. `RoomMessage.author` on `onDelete:Cascade`, seega autori
  konto kustutamine eemaldab tehnilise kandja; teise osapoole platvormivälised koopiad ei ole kontrollitavad.
  O-TK9 A/B/C piiri siin ei korrata: see leid täpsustab ainult RUUM-VIS-A0 dokumendirea kandjat.

### 4.8 Admini/RAG-i lähtefailid

- KOV-failidel on UUID path, laiendi-, NUL- ja skeemi/semantika kontroll; üks rida rolli kohta ja `version++`.
  Organization core-fail asendub, attachment'id kuhjuvad; PDF/DOCX attachment'i sisu/magic'ut ei kontrollita.
- Upload kirjutab ja valideerib uue faili, muudab DB viite, kustutab vana ning alles siis syncib parent-state'i.
  Hiline tõrge käivitab catch'i, mis kustutab uue faili ka siis, kui DB juba sellele osutab. Crash pärast DB
  update'i ja enne vana delete'i jätab vana faili. Delete on file-first ilma deletion-jobita.
- Ingest kasutab deterministlikku doc ID-d ja RAG `_replace_document_vectors`, seega sama ID re-ingest asendab
  vektorid. Lähtefaili kustutus ei kutsu RAG delete'i; vanad vektorid jäävad kuni re-ingest/resetini.
- RAG `/upload` ja JSON `/ingest/file` võtavad API-key taga `fileName` väärtuse `_process_ingest_file`-i ilma
  `_sanitize_filename`-ita ning teevad `d / file_name`; pind kuulab localhost'il, kuid sisekliendi kompromissi
  korral on path-escape võimalik (F-12). RAG delete neelab Chroma/raw/dir kustutusvead ja tagastab `ok`.

### 4.9 Orvude avastamine ja koristamine

Praegu on olemas üksikute instrumenteeritud kustutuste `DataDeletionJob`, admini käsitsi retry API ja konto
kustutuse automaatne retry. Puuduvad: uploads/materials/recordings/agent/RAG raw kataloogide DB-võrdlus,
vana-SHA RAG ID-de leidmine, `CallRecordingFile`↔`UserDocument` tervikluskontroll, egressi aktiivsete tööde
reconciliation, meeting-summary `.json/.tmp` sweep ning adminifailide dangling/orphan kontroll. Seega ei saa
orvude arvu tootmises tõendada ilma kasutajafaile või storage listingut puutumata; safeguard'i tõttu seda ei tehtud.

## 5. Runtime-kontrollid

Kõik katsed kasutasid sünteetilist sisu; tootmiskasutajate failinimesid, sisu, DB-ridu ega logisid ei loetud.

| Kontroll | Tulemus | Koristus |
|---|---|---|
| `recordingStorage`, audio signature, download-header, materjal ja privacy deletion sihttestid | 13/13 pass. Kinnitas egress-faili stabiilsusootuse, WebM reject/accept'i, headeri UTF-8/ASCII ohutuse ning konto cleanup'i fail-closed retry mustri | testide `mkdtemp` kataloogid eemaldati `finally`-s |
| Kõneteenuse testikomplekt | 18/18 pass. Olemasolev suite katab consent-before-start, audio-only egressi, normaalse stop/finalize ja egress-stop failure; **ei sisalda ACTIVE withdrawal/cancel testi**, mis vastab F-01 katmata rajale | ainult in-memory fake Prisma/egress; jääke pole |
| Sünteetiline kasvav `synthetic-growing.ogg` | `waitForReadableStableFile` timeout; fail eksisteeris timeout'i järel — K10/K14 egress-jääk runtime'is tõendatud | lokaalne temp-root eemaldati; `cleaned=true` |
| Sünteetiline mitteaudio `marker.mp3` | `assertAudioSignature(..., "audio/mpeg", "marker.mp3")` ei visanud viga — K1/F-10 bypass runtime'is tõendatud | ainult mälubuffer |
| Tootmise localhost RAG `/analyze`, marker `FAILIDA0SYNTHETICMARKER17` | `ok=true`, marker tagastati, `mimeType=text/plain`, 1 chunk. Health enne/pärast: registry documents `5824→5824`, vectors `50410→50410`; kood ja marker kinnitavad mitteindekseerimise | trap eemaldas `/tmp/failid-a0-*`; järelkontrollis 0 kataloogi; DB/RAG kirjet ega kasutajat ei loodud |
| Konto kustutuse sünteetiline Chroma-tõrge→retry | Esimesel katsel konto jäi alles, fail eemaldus ja RAG jäi; retry järel konto/chat/RAG kõik 0 — orchestratori fail-closed omadus tõendatud | sünteetiline fail ja temp-kataloog eemaldati |

Testiserverit ega lisaprotsessi ei käivitatud; kasutati olemasolevat localhost RAG teenust. Sünteetilisi kasutajaid
ei loodud, sest omandi/kind-katte sai tõendada koodist ja live kasutaja/DB loomine pole selle read-only auditi jaoks
vajalik. Seetõttu polnud kasutaja- ega DB-cleanup'i objekte; failid, RAG markerid, temp-kataloogid ja protsessid on nullis.

## 6. Leiud P0–P3

| ID | Pri | Leid ja täpne tõend | Mõju |
|---|---|---|---|
| F-01 | **P0** | ACTIVE recording kuulub `OPEN_RECORDING_STATUSES` hulka (`lib/calls/service.js:18`); `respondToRecordingConsent` uuendab consent'i ja `updateRecordingReadiness` requesti DECLINED-iks (`580–645`, `478–486`) ilma egress-stopita. `cancelRecordingRequest` teeb sama ACTIVE requestiga STOPPED (`648–670`). Ainus tegelik stop on `stopRecording:835–905`, mis nõuab ACTIVE olekut. Prod-is `LIVEKIT_EGRESS_ENABLED=true`. | Nõusoleku tagasivõtu järel võib audio salvestamine jätkuda; tavaline stop on olekumuutuse tõttu blokeeritud; egress ja partial-fail võivad jääda. |
| F-02 | **P1** | RAG ID on `agent::<id>::<sha256>` (`lib/documents/embeddings.js:7–24`). Transcript PATCH muudab sama dokumendi SHA-d; ingest loob uue ID, kuid delete/account/retention arvutab ainult praeguse SHA (`lib/privacy/documentDeletion.js:7–12`). | Vana teksti vektorid võivad jääda pärast muutmist ja hilisemat kustutust; fail↔DB↔RAG terviklus pole tagatud. DOK-XTEN eraldab tenant'i, kuid ei korista vana SHA-d. |
| F-03 | **P1** | Meeting-summary snapshot sisaldab `userId` ja `result` (`meetingSummaryJobs.js:68–81`) ning jääb agent-kettale. Sweep enumereerib ainult live `jobs` Map-i (`205–213`); restardijärgseid terminal-JSON-e ega `.tmp` faile ei sweebi. Account deletion ei enumereeri agent-kataloogi. | Tundlik kokkuvõte võib pärast 30 min lubadust ja konto kustutust tähtajatult kettale jääda. |
| F-04 | **P1** | Recording start/stop on mitme välise ja DB sammu jada ilma transaction/kompensatsioonita (`service.js:774–823,850–905`); finalize timeout ei kustuta source'i. `CallRecordingFile.retentionUntil` kirjutatakse, kuid `retention.js:325–393` valib ainult `UserDocument.updatedAt`; FK `createdDocumentId` on SetNull. | Elus/untracked egress, kettakoopiad ilma DB-ta ja `AVAILABLE` recording-meta puuduvale dokumendile; recording võib ületada oma retentionUntil'i. |
| F-05 | **P1** | Upload-DOCX kontrollib ainult `PK`; RAG `docx2txt.process`-il puudub entry/ratio/uncompressed/CPU piir (`rag-service/main.py:972–981`). PDF parseril puuduvad struktuuripiirid. Malli 512/16 MB guard usaldab deklareeritud uncompressed size'i ja ei kontrolli `inflateRawSync` tulemit (`docxExport.js:228–278`); aktiivsisu ei scrub'ita. | Autenditud upload võib põhjustada mälu/CPU DoS-i või tuua pahatahtliku konteineri serveriparserisse/allalaaditavasse väljundisse. |
| F-06 | **P1** | Prod 90p väärtused on olemas, kuid `maybeRunRetentionCleanup` on protsessimälus laisk 6 h throttle (`retention.js:467–490`) ja timer/cron puudub. Materjalid, adminifailid, egress ja agent snapshotid pole põhisweep'is. | „Kuni 90 päeva" pole tähtaeg; madala liikluse/seisaku korral võivad andmed jääda määramata ajaks. |
| F-07 | **P1** | Üksik delete ignoreerib RAG delete tulemust, kustutab DB rea enne faili ja `deleteDocumentRecordAndFile` neelab file error'i (`app/api/documents/[id]/route.js:348–415`, `deleteDocumentRecord.js`). Generic FAILED file/RAG töid retention ei retry, ainult USER_DELETE töid (`retention.js:90–116`). | API teatab kasutajale kustutuse edu, kuigi fail/vektor võib alles olla kuni admini käsitsi tegevuseni. Privaatsustekst ütleb küll „käivitatakse", kuid puudub kasutajale pending staatus/SLA. |
| F-08 | **P1** | Prod `RESEARCH_JOB_MODE=worker`, kuid `sotsiaalai-research-worker.service` on `not-found`/`inactive`; job DB mudel ja lease/retry eeldavad workerit (`scripts/research-worker.mjs`, `jobStore.js:486–572`). | Uurimistöö sisend võib jääda queued ning säilida ilma väljundita; alternatiivne worker pole tõendatud. |
| F-09 | **P2** | Dokumendi/materjali/audio upload, transcribe, recording ja admin upload sisaldavad file↔DB crash-aknaid; üldist orphan reconcilerit pole (ptk 4.9). | Kettaruumi, privaatsuse ja tervikluse aeglane triiv; tavacatch ei kata SIGKILL/power loss'i. |
| F-10 | **P2** | MP3 tundmatu sisu bypass on `audioWorkflow.js:100–102` ja runtime'is tõendatud. Transcribe'il puudub genereeritud storage quota, file-create catch-cleanup ning concurrent uniqueness; meeting output'il samuti quota check puudub. | Valet tüüpi sisu STT-sse, duplikaadid/orvud ja kvoodi ületus. |
| F-11 | **P2** | `MaterialSubmission`-il pole retention-sweep'i ega uploaderi self-delete rada; admin delete on file-first. Teavituskiri egressib uploaderi, comment'i ja algsed failinimed. | Materjal võib jääda konto elueaks/administratiivse otsuseni; kustutus võib tekitada dangling DB rea; metadata jagamise alus ja retention pole selged. |
| F-12 | **P2** | KOV/org upload'i DB-update→old-delete→sync catch võib uue, juba DB-s viidatud faili kustutada; crash võib vana faili orphan'iks jätta. Source delete ei kustuta RAG doc'i. RAG `/upload|ingest/file` kasutab `d / file_name` sanitiseerimata (`main.py:3324–3328,3624–3636`) localhost+API-key taga. | Adminifaili DB/file/RAG lahknemine ja sisekliendi kompromissi korral path-escape risk. |
| F-13 | **P2** | `DocumentAudit.meta` säilitab `title/originalName`; console-minimaalne payload neid ei sisalda (`lib/documents/audit.js`, `auditShared.js`). Materjali mail ja OpenAI STT File nimi kannavad algset failinime. | Failinimes olev isikuinfo liigub lisakandjatesse, kuigi õigustekst lubab auditites peamiselt tehnilisi metaandmeid. |
| F-14 | **P3** | Document route teeb `findUnique` ja alles siis `assertOwnedByUser`, andes võõra olemasoleva ID korral 403, puuduva korral 404. | Ressursi olemasolu oraakel; sisu ei leki. |
| F-15 | **P3** | `AgentArtifact` DRAFT PATCH asendab sisu; UI `workspaceVersions` on mälus (`AgentModePage.jsx:187,204–229`); uued POST-id ja summary loovad read juurde. | Kasutaja nähtav „versiooniajalugu" pole püsiv; vanad eraldi artefaktid kuhjuvad kuni retention'ini. |
| F-16 | **P3** | Privacy ütleb ajutine chat-fail ei lähe püsivasse teeki; tehniliselt raw fail ei lähegi, kuid fullText/chunks'i põhjal loodud user/assistant sõnum võib vestlusse püsida. | Sõnastus võib jätta mulje, et failist tuletatud sisu samuti ei säili. |

## 7. Tugevad kohad

Tulevases ühises failikihis tuleb säilitada järgmised olemasolevad mustrid:

1. UUID-põhine storage name, whitelistitud laiend ja root'i `path.resolve`/prefix-valve; kasutaja nimi on ainult meta.
2. `attachment` + `no-store/no-cache/must-revalidate` + `nosniff` ning eraldi ASCII ja RFC5987 `filename*`.
3. Owneriga `findFirst({id,ownerId})` nagu meeting-summary share'is, et võõras ja puuduv oleksid mõlemad 404.
4. Konto kustutuse **fail-closed** orkestreerimine: konto ei kustu enne iga teadaoleva faili ja RAG viite edu;
   kõigi `UserDocument.kind` väärtuste katmine ühe owner-päringuga.
5. Durable `DataDeletionJob`, piiratud audit ja `safeError`; laiendada automaatset retry'd, mitte loobuda registrist.
6. RAG `doc_id` deterministlikkus ja `_replace_document_vectors` sama ID puhul; uues kihis peab ID olema stabiilne
   ning versioon eraldi, et vana SHA-d saaks atomaarse asendusega kustutada.
7. Chat `/analyze` eraldi mitteindekseeriv endpoint; tootmise marker kinnitas registry/vector muutumatust.
8. Artefakti FINAL immutability, room-share owner+role+FINAL kontroll ja privaatsuse eelkontroll enne sõnumikoopiat.
9. KOV/admin failide semantiline valideerimine enne ingest'i ning source SHA/version metadata.
10. Temp+rename job-snapshot kirjutamisel; täiendada seda startup+sweep-koristusega.

## 8. Vastuolud dokumentide ja koodi vahel

| Leping / tekst | Koodi/runtime tegelikkus | Järeldus |
|---|---|---|
| Privacy 7.5 ja terms: dokumendid/agendi tulemused „üldjuhul kuni 90 päeva viimasest muutmisest" | 90p cutoff on olemas, kuid sweep laisk; värske artifact-link lükkab dokumenti määramata „lühiajaliselt"; timer puudub | Tähtaeg pole jõustatud ega mõõdetav; retention-leping vajab scheduler+SLA-d või täpsemat sõnastust |
| Privacy 7.6: kustutamisel eemaldatakse aktiivhaldusest ja käivitatakse faili/RAG kustutus, tehniline job võib jääda | Üksik delete teeb tõesti nii, kuid annab 200 ka jäägi korral ning generic job vajab käsitsi admin retry't | Tekst pole sõnasõnalt vale, kuid kasutaja ei näe pending olekut ja järelkäsitluse SLA puudub |
| Privacy 7.7 / raamleping 14: konto kustutab seotud rakenduse andmed ja failid tehniliselt toetatud ulatuses | Kõik UserDocument kind'id, materjalid ja artefaktid on kaetud; vana-SHA RAG, agent job JSON, egress ja crash-orvud pole | „Seotud aktiivsed andmed" pole failiregistri mõttes täielik; erandid tuleb kas koristada või lepingus nimetada |
| Privacy 7.8 / raamleping: backup/log jääk „lühiajaliselt" vastavalt ops/provider configile | Backup/proxy/journald/provider retention'i ei tõendatud; selle auditi serverikontroll leidis ainult app retention'i | `not_proven`; enne konkreetse tähtaja lubamist vaja OPS/infra tõendit, ilma OPS-FINAL-A0 kordamata |
| Privacy 7.9: DocumentAudit on üldjuhul 90p ja peamiselt tehniline metadata | Audit meta sisaldab kasutaja title/originalName; sweep on 90p laisk | Failinimi võib olla sisuline isikuinfo, mistõttu ei vasta alati „peamiselt tehnilise" ootusele |
| Privacy 4.5 / terms: vestluse ajutist faili ei lisata püsivasse dokumentide teeki | Raw fail on efemeerne; sellest tuletatud tekst/prompt/vastus võib minna ConversationMessage'i | Vajab raw-faili ja tuletatud vestlussisu selget eristust |
| Nõusolekut saab hiljem tagasi võtta | ACTIVE withdrawal muudab ainult DB oleku ega peata egressi | Otsene P0 vastuolu funktsiooni tegeliku toimimisega |
| Recording `retentionUntil` ja env 90p | sweep ei loe `retentionUntil`; `CallRecordingFile` võib jääda dangling meta kandjaks | Rakenduslik retention-leping on sisemiselt vastuolus |
| Materjalidele ja admini lähtefailidele puudub eraldi avalik retention | Koodis pole nende automaatset retention'i | Vajab andmekategooria ja tähtaja otsust; „üldised tööandmed 90p" pole piisavalt ühemõtteline |
| Uurimistöö on privaatsuspoliitikas tööandmete hulgas | `ResearchJob` terminal-read 14p, persistitud vestluskoopia 90p; prod worker puudub | Kaks eri kandjat/tähtaega ja queued-state vajavad dokumenteerimist |

RUUM-VIS-A0 avatud dokumendirea uus tõend: FINAL `MEETING_SUMMARY` jagamisel luuakse sõltumatu
`RoomMessage.content`; lähteartefakti kustutus ei eemalda ega revoke'i seda, kuid autori konto kustutus eemaldab
sõnumi `RoomMessage.author onDelete:Cascade` tõttu (ja room owneri konto korral võib kaduda kogu room). O-TK9
A/B/C kandjaotsus jääb eraldi piiriks; siinne tõend ei lahenda ega korda eelpöördumise kandjat.

## 9. Paketistus FAILID-P0…P3 + esimene otsuseta pakett

### FAILID-P0 — nõusoleku kohene tehniline jõustamine

- **P0.1 (esimene, otsuseta ja rakendusvalmis): ACTIVE withdrawal/cancel egress-stop + temp cleanup.**
  Muuta `lib/calls/service.js` nii, et ACTIVE requesti `WITHDRAWN`, `DECLINED` või cancel ei tohi esmalt
  requesti mitteaktiivseks muuta. Need rajad peavad kutsuma üht idempotentset abort-funktsiooni, mis:
  (1) claimib praeguse ACTIVE requesti ühe korra; (2) peatab egressi; (3) ei loo partial audio
  `UserDocument`-i; (4) eemaldab selle requesti egress-source/partial-faili; (5) märgib file/requesti STOPPED
  või tõrkel FAILED; (6) kirjutab minimaalse auditi. Lisada `recordingStorage`-sse path-guarditud
  `deletePartialRecordingFile(fileName)`.
- Muudetavad failid: `lib/calls/service.js`, `lib/calls/recordingStorage.js`,
  `tests/calls/service.test.js`, `tests/calls/recordingStorage.test.js`; route'i ega Prisma muutust pole vaja.
- Acceptance: ACTIVE withdrawal ja cancel kutsuvad fake egress-stop'i täpselt ühe korra; teine sama request on
  idempotentne; file source puudub; uut UserDocumenti ei teki; stop/cleanup tõrge jätab FAILED + audititava
  state'i; normaalse consent→start→stop testid jäävad roheliseks.
- See pakett ei otsusta juba edukalt lõpetatud/lubatud salvestise õiguslikku retention'it; ta sulgeb ainult
  tõendatud elusa nõusoleku- ja egressilekke.

### FAILID-P1 — terviklus, retention ja parserikaitse

- **P1.1:** stabiilne document RAG key või version manifest; SHA muutmisel vana ID delete enne uue publish'i;
  üksik delete peab tagastama pending/202 või olema fail-closed; generic deletion-job auto-retry + mõõdikud.
- **P1.2:** sõltumatu scheduled retention worker/timer; `retentionUntil` jõustamine; meeting-summary startup
  reconciliation + `.json/.tmp` sweep; egress ja `CallRecordingFile` dangling cleanup.
- **P1.3:** DOCX/PDF parseri isoleeritud worker, timeout/memory limit, ZIP entry/ratio/actual-uncompressed piir,
  aktiivsisu/external relationship policy ja vajadusel AV-skann.
- **P1.4:** research-worker unit/health/queue-age alert ning terminal-job sweep scheduler; see on rakenduspakett,
  mitte käesolevas auditis deploy.

### FAILID-P2 — crash-aknad, admin/material/audio ja metadata

- **P2.1:** ühine atomic file-create helper (`temp → DB intent → rename/commit`) ja kataloogi reconciler
  documents/materials/audio/transcript/admin pindadele.
- **P2.2:** transcribe uniqueness/CAS, output quota, DB-failure file cleanup; MP3 magic fail-closed.
- **P2.3:** MaterialSubmission retention + uploaderi delete/status; file/DB delete deletion-jobiga; maili
  failinime/comment'i minimeerimine.
- **P2.4:** admin source replace/delete kompensatsioon, source delete→RAG reset/invalidate, org attachment magic;
  RAG raw ingest `_sanitize_filename` + root assertion.
- **P2.5:** DocumentAudit title/originalName eemaldamine või explicit põhjendatud/minimeeritud väli ja retention;
  providerile saadetava failinime pseudonüümimine.

### FAILID-P3 — oraakel, artefaktivisioon ja lepingute selgus

- **P3.1:** kõik owner-resource read ühtlase `findFirst({id,ownerId})` 404 mustriga.
- **P3.2:** otsus O-F7 järgi kas püsiv immutable artifact-version või UI teksti muutmine „sessiooni ajaloooks";
  duplicate summary idempotency.
- **P3.3:** privacy/terms tekstis raw efemeerse faili ja sellest tuletatud püsiva chat-sisu eristus ning
  kustutuse pending/SLA kuvamine.

## 10. Otsused (tooteomanik/privaatsus/retention)

| ID | Otsustaja | Blokeeriv küsimus / valikud | Soovitus |
|---|---|---|---|
| O-F1 | Turve + taristu | Kas kõik user/admin DOCX/PDF läbivad AV/skanneri või ainult riskipõhised pinnad? | Vähemalt kõik parserisse/teisele kasutajale jõudvad upload'id; fail-closed kuni skann valmis |
| O-F2 | Turve + tooteomanik | Kas mall-DOCX-ist tohib säilitada external rels, embedded objekte, custom XML-i? | Eemalda välisviited/embedded aktiivsisu või luba ainult kontrollitud organisatsioonimallile |
| O-F3 | Retention + privacy | Siduvad tähtajad iga kandja jaoks: UserDocument kind'id, MaterialSubmission, AgentArtifact, ResearchJob, meeting job snapshot, egress, admin sources, audit/deletion jobs | Üks versioonitud retention-matrix; `up to` tähtajal scheduler-SLA + grace ≤24 h |
| O-F4 | Taristu | Scheduler: systemd timer, eraldi worker või job queue; kes omab retry'd/alerti? | Üks durable retention/orphan worker koos health/last-success/queue-age alertidega |
| O-F5 | Privacy + tooteomanik | Kas materjali admin-mail võib sisaldada comment'i ja algseid failinimesid; kui kaua mail säilib? | Pseudonüümne submission ID + link adminivaatesse, mitte PII failinimi/comment e-kirjas |
| O-F6 | Privacy + tooteomanik | Kõnesalvestise omanik/osalejate ligipääs; tagasivõtu mõju juba kogutud osale; retention alguspunkt | Kohene stop alati; varasema osa säilitamine/kustutus dokumenteerida eraldi õigusliku aluse järgi |
| O-F7 | Tooteomanik | Kas `AgentArtifact` vajab püsivat immutable versiooniajalugu või piisab viimasest DRAFT-ist + eraldi FINAL-idest? | Kui UI ütleb „versiooniajalugu", tee püsiv; muidu nimeta sessiooni ajalooks ja ära luba reload-püsivust |
| O-F8 | Privacy + tooteomanik | Kas roomi kopeeritud meeting summary peab source delete'i järel säilima, revoke'uma või saama eraldi kustutuskäsu? | Tee koopia kandja UI-s selgeks ja lisa saatja delete/revoke vastavalt roomi andmekohustusele |
| O-F9 | Privacy/legal | Kas failinimi on DocumentAudit'is vajalik ja milline on erandlik retention? | Vaikimisi ära salvesta; hoia type/size/id, vajadusel eraldi redigeeritud display-name |
| O-F10 | Taristu + privacy | Backup/journald/proxy/provider tegelikud tähtajad ja kustutuse tõend | Inventar + konfiguratsioonitõend; seni märgi avalikus tekstis konkreetne tähtaeg `not_proven` |
| O-F11 | Tooteomanik + retention | Materjali uploaderi self-delete ja admini review vajaduse konflikt | Luba delete enne importi; pärast importi kas revoke/request-delete koos nähtava staatusega |
| O-F12 | Product/architecture | O-TK9 A/B/C saadetud eelpöördumise kandja ning selle seos room/document koopiatega | Jääb O-TK9 otsuseks; FAILID-A0 annab ainult room summary koopia fakti |

P0.1 ei sõltu neist otsustest. P1.1 vana-SHA cleanup, MP3 fail-closed ja path sanitization on samuti
tehniliselt otsuseta; AV-toode, täpsed retention-tähtajad, varasema audio saatus ja jagatud koopia revoke
vajavad ülaltoodud otsuseid.

## 11. not_run / not_proven / safeguard-piirid

### `not_run`

- Tootmiskasutaja dokumentide list/download/delete/transcribe ega võõra ID 403/404 test — oleks nõudnud päris
  kasutajaressursi puutumist; owner-piir hinnati staatiliselt.
- LiveKit päris salvestuse start/withdraw/cancel — võiks luua päris audio/egressi; P0 rada tõendati koodi ja
  sünteetilise storage-timeoutiga. Olemasolev fake-service suite ei kata withdrawal'i.
- Tootmise konto kustutus kõigi kaheksa DocumentKind'i fixture'iga — read-only ja cleanup-risk; kind-kate
  tõendati `where:{ownerId}` päringust, generic fail-closed retry sünteetiliselt.
- Pahatahtlik ZIP/PDF bomb või aktiivsisu käivitamine — DoS/turvarisk. Kaitse puudumine tõendati koodist;
  ainult benign TXT markerit parsiti.
- Admin KOV/org upload/replace/delete ja RAG delete tootmises — muudaks kanoonilisi adminallikaid.
- Retention force-run, DataDeletionJob admin retry, research job loomine ja worker käivitamine tootmises —
  muudaks DB/runtime state'i.
- Backup, proxy, journald ja provider-log kustutustest — OPS-FINAL-A0/infra skoop; logide sisu ei loetud.
- Täielik eksport/koostalitlus ja DOK-XTEN cross-tenant retrieval — kasutaja määratud skoobist väljas.

### `not_proven`

- Tootmise olemasolevate orvude arv ketta, DB ja RAG vahel; katalooge ei listitud safeguard'i tõttu.
- Kas research-worker töötab mõne systemd-välise supervisoriga; unit puudub ja eraldi protsessiinventuuri/deploy
  auditit ei tehtud. Tõendatud on ainult `RESEARCH_JOB_MODE=worker` + unit `not-found/inactive`.
- Tegelik backup/journald/proxy/OpenAI/e-posti retention ja kustutuse SLA.
- Parseriteekide kõik CVE-d ja nende OS-level resource limits; dependency/security audit oli eraldi skoop.
- Platvormivälised allalaaditud või roomiliikme kopeeritud dokumendid; tehniliselt ei saa neid pärast jagamist
  platvormilt kustutada.
- Kas mõni vana RAG SHA-orb juba eksisteerib; koodirada on tõendatud, production registry sisu ei loetud.
- `CallRecordingFile.retentionUntil` ja UserDocument `updatedAt` tegelikud ajaloolised lahknevused; prod DB-d ei loetud.

### Safeguard'i tõttu teadlikult lugemata

- `/var/lib/sotsiaalai/documents`, `/materials`, `/recordings`, `/agent` failinimed ja sisu;
- RAG `registry.json` dokumendikirjed, vektorite sisu ja toorfailide nimed (loeti ainult health aggregate);
- production PostgreSQL UserDocument/MaterialSubmission/ResearchJob/Recording/DeletionJob read;
- application/journald/proxy/e-posti logis olevad kasutajanimed, failinimed või payload'id;
- kasutaja määrdunud failidele ei kirjutatud; õigusteksti asjakohased read kontrolliti read-only ja kinnitati
  eraldi `origin/main` versiooni vastu. Rakenduskoodi tõend võeti Git tõeallikast ja puhtast vastavast
  checkout-versioonist.

### Auditijälg ja lõpp

- Muudeti ainult seda olemasolevat auditifaili; rakenduskoodi, Prisma skeemi, migratsioone ega teisi dokumente
  ei muudetud. Commit/push/merge/deploy ei tehtud.
- Runtime'i sünteetilised failid ja temp-kataloogid: 0; sünteetilised kasutajad/DB-read/RAG kirjed: 0;
  käivitatud testiserverid/protsessid: 0.
- Kõik varasemad pooleliolevad märgendid on asendatud lõpliku vastuse või
  `not_run/not_proven` kirjega.

STATUS: COMPLETE
