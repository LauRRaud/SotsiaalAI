# FAILID-A0 — failide ja meedia elutsükli tervikaudit

STATUS: IN PROGRESS (täidetakse jooksvalt; kui audit katkeb, on senised vastused all olemas)

Alustatud: 2026-07-16. Auditeerija: Claude (Fable 5), read-only.
Skoobipiirid: EI korrata DOK-XTEN-P0 retrieval'i cross-tenant auditit, RUUM-A0 ärivoogu,
Materjalide/Help/Teekonna/profiili tervikanalüüse, OPS-FINAL-A0 deploy-auditit ega
ekspordi tervikauditit — siin ainult failide loomise/ingest'i/kustutuse elutsükkel.

## 1. Git/main/server seisumaatriks (kontrollitud 16.07.2026)

| Kiht | Seis |
|---|---|
| Lokaalne `main` | `890124bd` |
| `origin/main` | `2a63fcd0` = main +4 commit'i, **kõik RAG-P8 dokumendid** — failikoodi ei puuduta |
| Tootmisserver | `890124bd` **= main**, serveri tööpuu puhas (0 määrdunud faili) |
| Lokaalne tööpuu | määrdunud: commit'imata **RV-P0** (rollilüliti UI) + dokumendid — ei puuduta failide elutsükli koodi (`lib/documents`, `lib/privacy`, `lib/calls`, API-routed on puhtad; kontrollitud `git status` väljundist) |

Järeldus: failikihi leiud kehtivad üheaegselt main'i ja toodangu kohta.

## 2. Kohustuslikud küsimused — jooksvad vastused

| # | Küsimus | Vastus (seis) |
|---|---|---|
| K1 | Kas server kontrollib päris failitüüpi või ainult laiendit/MIME-headerit? | **Dokumendid: PÄRIS SISU** — `assertMimeMatchesBuffer` (`lib/documents/server.js:257`) kontrollib maagilisi baite: `%PDF-`, ZIP `PK..` allkiri (docx), tekstil juhtbaidiskaneering; kutsutakse `writeUploadedFile` sees enne kirjutust. Laiend+MIME lisaks ristkontrollitud whitelist'iga (`resolveAllowedMimeType`). NB: docx=„suvaline zip" tasemel; sügavam zip-sisu kontroll ainult malliteel (K4). Teised pinnad: uurimisel |
| K2 | Millised mahu-, arvu- ja päevapiirid on serveris jõustatud? | Dokumendid: 25MB/fail (`constants.js:4`, 413); rollipõhine salvestuskvoot + päevane üleslaadimiskvoot (`storageGuardrails` — väärtused allpool); upload-rate 12/min/kasutaja (`route.js:31`); loend max 50. Teised pinnad: uurimisel |
| K3 | Kas failinimi võib põhjustada path traversal'i / header injection'i / ohtliku allalaadimisnime? | **EI (dokumendid):** kettal AINULT `uploads/<uuid><whitelist-laiend≤10>` (`getStoredDocumentPath`, server.js:280); absoluutraja valve `startsWith(uploadsRoot)` (`resolveAbsoluteDocumentPath:286`); allalaadimisel `sanitizeTextFilename` eemaldab `/\?%*:|"<>` (sh jutumärgi → header-injection blokitud) + ASCII-fallback + RFC5987 UTF-8 (`buildDownloadHeaders:346`) |
| K4 | Kas ZIP/PDF/DOCX konteiner võib põhjustada decompression bomb'i? | DOCX-mall: **kaitse olemas** — max 512 zip-kirjet, 16MB lahtipakituna (`constants.js:7–8`; jõustuskoht docxExport'is, kontrollitud allpool). Üleslaaditud docx: sisu ei pakita Next'is lahti (ainult PK-allkirja kontroll); lahtipakkimine toimub RAG-teenuses tekstieralduseks — python-docx/pypdf piirid = MAX_MB enne parsimist; eraldi zip-bomb valvet RAG-is EI ole (leid F-P3 klass) |
| K5 | Kas toimub viiruse-/aktiivsisu-/pahatahtliku dokumendi kontroll? | **EI** — viirusetõrjet/aktiivsisu skaneerimist ei ole üheski kihis (grep: 0 clamav/virus/scan vastet). Leevendajad: range tüübi-whitelist (pdf/docx/txt), maagiliste baitide kontroll, allalaadimisel `attachment`+`nosniff` (brauser ei käivita), failid serveeritakse ainult omanikule tagasi. → tooteotsus O-F (kas AV-skann on nõutav) |
| K6 | Kus failid füüsiliselt asuvad? | **3 kohta + DB:** (1) Next ketas `DOCS_STORAGE_DIR/uploads/<uuid><ext>` (prod-is env KOHUSTUSLIK, muidu throw; dev `tmp/documents`) — kasutajadokumendid, salvestised (.ogg), genereeritud tekstifailid; (2) **RAG-teenuse oma ladu** `STORAGE_DIR/docs/<sha1(doc_id)[:12]>/` — admin-ingest'i toorfailid + Chroma vektorid + registry.json; (3) egress-vaheladu `RECORDING_EGRESS_OUTPUT_DIR` (LiveKit kirjutab, finalize kopeerib uploads'i ja KUSTUTAB allika, `recordingStorage.js:135`); transkriptid/kokkuvõtted = **DB sees** (`UserDocument.content`) + failikoopia; AgentArtifact sisu = DB (`MAX_ARTIFACT_CONTENT_LENGTH 120k`) |
| K7 | Kas omaniku-/tenant-piir kontrollitakse igal read/download/delete/process rajal? | Dokumendid: **JAH** — GET/PATCH/DELETE/download/transcribe kõik `findUnique` → `assertOwnedByUser` (`lib/documents/access.js`, string-võrdlus ownerId). NB järjekord: 404 enne omanikukontrolli → võõras kehtiv ID saab 403 (olemasolu-oraakel, P3). Teised pinnad kontrollitakse allpool |
| K8 | Kas võõras ID annab faili/metadata/download'i/staatuse? | Dokumentidel staatiliselt EI (K7); vastus 403 ≠ 404 lekitab ID olemasolu (P3). Runtime-tõend ptk 5. Materjalid/uurimine/salvestised: allpool |
| K9 | Kas download-päised on privaatsed ja ohutud? | **JAH (dokumendid):** kõik vastused `Cache-Control: no-store, no-cache, must-revalidate` + `X-Content-Type-Options: nosniff` + `Pragma/Expires` (`server.js:23`); `Content-Disposition: attachment` ASCII-fallback (mitte-ASCII→`_`, jutumärgid/kaldkriipsud eemaldatud) + RFC5987 `filename*` (`downloadHeaders.js`, `server.js:346`) |
| K10 | Millised failid on ajutised ja kas need kustuvad kõigil radadel? | (a) **Vestluse failianalüüs on TÕELISELT efemeerne**: Next EI kirjuta kettale — multipart voogedastatakse RAG `/analyze`'sse, mis töötab AINULT mälus (`rag-service/main.py:3249` „Ephemeral analyze (no persistence)"), tekst/chunks tagastatakse kliendile; `ephemeralChunks` elavad kliendi olekus ja saadetakse chat-päringu kehas, serveris kasutatakse per-request kontekstina (`requestBootstrap.js:183`), DB-sse ei salvestata (schema: 0 vastet). Katkestus/viga → usage release, jälgi ei jää. (b) Egress-salvestise vahefail: kustutatakse pärast kopeerimist; kui finalize EBAÕNNESTUB (nt timeout enne stabiilsust), vahefail JÄÄB egress-kataloogi (orvurada, K14). (c) DOCX/PDF genereerimine: mälus (kontrollitud allpool) |
| K11 | Mis juhtub, kui DB-kirje tekib, aga fail/RAG ebaõnnestub? | Upload: fail kirjutatakse ENNE DB-d; kui DB `create` ebaõnnestub → catch kustutab faili (`app/api/documents/route.js:324`) ✅. RAG-ingest toimub LAISALT kasutamisel (`ensureDocumentIndexed` artefakti genereerimisel), mitte upload'il → ingesti ebaõnnestumine = viga kasutajale, DB-kirje jääb terveks, RAG-i ei jää poolikut (ingest on idempotentne sha-võrdlusega) ✅ |
| K12 | Mis juhtub, kui fail/RAG tekib, aga DB katkeb? | Upload'i crash-aken kirjutuse ja `create` vahel → **orv kettal ilma DB-kirjeta** (kitsas aken; jälgimata — ainus kate oleks kataloogi-vs-DB võrdlusskript, mida pole). Transkripti PATCH kirjutab faili ENNE DB-update'i (`[id]/route.js:238`) → katkemisel fail uue sisuga, DB vana sha-ga (ebakõla, madal mõju). Retention/kustutusrajad on fail-closed: DB-rida kustub AINULT pärast õnnestunud RAG+faili kustutust (`retention.js:381 continue`; `userDeletionOrchestrator.js:42`) ✅ |
| K13 | Kas konto/dokumendi/salvestuse/materjali kustutus eemaldab kõik koopiad? | Dokument (üksik): RAG + fail + DB, fail-closed (`[id]/route.js:348–410`) ✅. Konto: `userDeletionOrchestrator` käib läbi dokumendid (RAG+fail) + materjalifailid + artefaktid, ja **kustutab User-i AINULT kui 0 failtõrget** (`userDeletionOrchestrator.js:42`) ✅. **Aga:** konto-koristuse sihtloend katab `UserDocument` + `MaterialSubmission` + `AgentArtifact` — helisalvestised on `UserDocument` (kind=CALL_AUDIO_RECORDING), seega KAETUD, kui neil on `ownerId`. Transkriptid+kokkuvõtted = samuti UserDocument ✅. Vaja kinnitada runtime'is, et sihtpäring haarab kõik kind'id (allpool) |
| K14 | Kas tekivad orvufailid/orvud RAG-is/nähtamatud transkriptid? | **Jah, mitu kitsast rada:** (a) upload'i crash kirjutuse ja DB `create` vahel → orv kettal (K12); (b) **egress-vahefail jääb `RECORDING_EGRESS_OUTPUT_DIR`-i, kui finalize ei jõua faili stabiilseks lugeda** (timeout `waitForReadableStableFile`); (c) **nõusoleku tagasivõtt aktiivse lindistuse ajal** märgib päringu DECLINED-iks, aga EI kutsu egress-stop'i ega koristust → egress-protsess + poolik vahefail jäävad koristamata (leid F-P1, all); (d) RAG-orb: kui faili/DB kustutus õnnestub aga RAG DELETE ebaõnnestub, luuakse `DataDeletionJob` staatusega FAILED, mille retention-sweep proovib uuesti (`retention.js:90`) → taastuv, mitte püsiorb ✅ |
| K15 | Kas audio+transkriptsioon järgivad nõusolekut retry/partial-failure radadel? | Lindistuse START nõuab, et **kõigil aktiivsetel osalejatel** on CONSENTED (`allRequiredConsentsPresent`, `service.js:710`) ✅; kovisiooni-kontekstis lindistus üldse keelatud ✅. **Nõrkus:** tagasivõtt keset ACTIVE lindistust ei jõusta tegelikku peatamist (F-P1). Transkriptsioon: idempotentne (olemasolev taaskasutatakse, `transcribe/route.js:156`); vea korral `failTranscriptionJob` + audit, transkriptidokumenti ei looda; osaümbekirjutust pole (kirjuta fail → alles siis DB-create) |
| K16 | Kas logidesse/vigadesse/auditisse satub failisisu/nimi/heli/privaatne tekst? | Sisu/heli: **ei**. `safeError` maskeerib. **Aga failinimi JÄRJEKINDLALT auditis:** `logDocumentsAudit` kirjutab `originalName` + `title` DocumentAudit-tabelisse ja `console.info`-sse (`audit.js`, kutsutud upload/download/delete juures) — kasutaja pandud failinimi võib sisaldada isikuandmeid (nt „Mari Maasikas juhtum.pdf"). Privaatsusleid F-P2. Analyze-file: privacy.ephemeral märgend, sisu ei logita ✅ |
| K17 | Kas genereeritud artefakti uus versioon asendab/dubleerib/säilitab vana? | uurimisel (artefaktid allpool) |
| K18 | Kas retention koodis vs õigustekstis vs tegelik kustutus kattuvad? | Kood: üldretention `DATA_RETENTION_DAYS` vaikimisi **90p** (`retention.js:18`), salvestised `RECORDING_DEFAULT_RETENTION_DAYS` **90p** (`recordingStorage.js:117`), maksed 7a. Sweep intervall 6h, jookseb laisalt esimese autendtud päringu peal (`maybeRunRetentionCleanup`). Õigustekstide vs koodi vaste = AVALIK-A0 skoop; siin ainult kood. **NB:** dokument kustub retention'is AINULT kui pole seotud värske artefaktiga (`templateArtifacts`/`sourceArtifactLinks` none) — st aktiivselt kasutatavat ei kustutata 90p pärast ✅ |

## 3. Kanooniline failiregister

(täidetakse liikide kaupa: dokumendid, materjalid, vestluse ajutised failid, uurimistööd,
kõnesalvestised+transkriptid, admin-RAG failid, genereeritud artefaktid, eksport)

## 4. Elutsükli analüüs pindade kaupa

(täidetakse)

## 5. Runtime-kontrollid

(plaanitud; sünteetilised kasutajad + markerfailid, koristus nullini)

## 6. Leiud P0–P3

(täidetakse jooksvalt)

## 7. Tugevad kohad

(täidetakse jooksvalt)

## 8. Vastuolud dokumentide ja koodi vahel

(täidetakse)

## 9. Paketistus FAILID-P0…P3 + esimene otsuseta pakett

(täidetakse)

## 10. Otsused (tooteomanik/privaatsus/retention)

(täidetakse)

## 11. not_run / not_proven / safeguard-piirid

(täidetakse)
