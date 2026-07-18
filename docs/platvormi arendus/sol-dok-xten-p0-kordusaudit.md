# DOK-XTEN-P0 kitsas kordusaudit

## Otsus

**PASS** — algses auditis kinnitatud privaatse `agent_document` cross-tenant P0 leke on vahemikus `2a63fcd0..f5d2f7b9` suletud. Pakett võib liikuda integratsioonikorvi.

See oli ainult algse P0 korduskontroll. Dokumentide või RAG-i uut tervikauditit ei tehtud ning paranduskoodi ei muudetud.

## Auditeeritud teostus

- Parandusharu: `codex/documents-rag-cross-tenant-p0-fix`
- Paranduscommit: `f5d2f7b9471c7ddb0a371a627eb8c5baad9cac6d`
- Parent: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c`
- Vahemik: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c..f5d2f7b9471c7ddb0a371a627eb8c5baad9cac6d`
- Algne audit: `codex/documents-cross-tenant-runtime-audit` @ `ade2c2254bc0482731ef58d4c9a3ef0cdcd9a52a`
- Auditiharu: `codex/documents-rag-cross-tenant-p0-reaudit`
- Audit-worktree: `C:\Users\rauds\Desktop\SotsiaalAI-documents-rag-cross-tenant-p0-reaudit`

Kontrollitud vahemikus oli üks commit ja kaheksa faili: neli runtime-/piirifaili, kolm sihttestifaili ning DOK-XTEN-P1 jätkudokument. Auditiväliseid rakendusmuudatusi ei leitud.

## Staatiline piir

### Üldine RAG

`rag-service/search_security.py` ehitab üldotsingule serveris muutmatu `$and` tingimuse:

- `source_type != agent_document`;
- `collection_id != agent_documents`;
- lisaks välistatakse seadistatud `AGENT_RAG_COLLECTION_ID`, kui see erineb vaikimisi väärtusest.

Kliendi `where` kopeeritakse eraldi lisatingimuseks sama `$and` sisse. Klient ei saa serverikeeldu asendada, eemaldada ega `$or`, `doc_id`, `owner_id`, `tenant_id`, `collection_id` või `source_type` abil nõrgendada.

`rag-service/main.py` rakendab tingimuse enne Chroma päringut. Sama `chroma_where` läheb nii `collection.query` dense-rajale kui `_fetch_lexical_candidates` leksikaalradadele. Dense- ja leksikaaltulemuste kokkupanekus on lisaks metadata järelkontroll, mis lükkab privaatkirje tagasi juba siis, kui kas `source_type` või `collection_id` märgib agent-dokumenti.

Kõik kontrollitud põhivestluse ja süvauuringu üldised retrieval-kutsed kasutavad sama `/search` endpoint'i:

- põhivestluse dense/hybrid/BM25 ja fallback: `lib/chat/retrievalOrchestrator.js`;
- süvauuring: `lib/research/pipeline.js`;
- DISTRICT geo-rada laieneb `DISTRICT -> MUNICIPALITY -> NATIONAL`, kuid iga variant kasutab sama kaitstud endpoint'i.

`app/api/research/jobs/route.js` eemaldab kaitseks ka brauseri `collection_ids` sisendist `agent_documents` enne geo-variantide moodustamist. Tegelik turvapiir jääb RAG teenusesse.

### Legacy privaatkirjed

Metadata järelkontroll keelab kirje sõltumatult kummagi privaatmarkeri alusel. Seetõttu jäävad üldotsingust välja ka varasemad `agent_document` chunk'id, millel puudub `owner_id`, `tenant_id` või üks kahest markerist.

Päris Chroma test kinnitas eraldi:

- täieliku privaatkirje;
- `source_type=agent_document`, kuid puuduva collection/owner/tenant metadata;
- `collection_id=agent_documents`, kuid puuduva source/owner/tenant metadata;
- sobivate kliendi `source_type`, `collection_id`, `doc_id`, `owner_id`, `tenant_id` ja `$or` filtrite võimetuse privaatkirjet taas avada.

### Omaniku täppisotsing

`lib/documents/search.js` kasutab eraldi `/search/agent-documents` endpoint'i ning saadab ainult serveris koostatud `doc_ids` loendi. Dokumendid leitakse enne seda rakenduse serveris tingimusega `ownerId: auth.userId`; puuduv või võõras dokument katkestab voo 404-ga.

RAG endpoint'i `AgentDocumentSearchIn` mudel kasutab `extra: forbid`. `owner_id`, `tenant_id`, `collection_id`, `where` ega muu lisapiir ei ole kliendi määrata. Täpne serverifilter nõuab korraga:

- lubatud `doc_id`;
- `source_type=agent_document`;
- seadistatud agent-dokumentide `collection_id`.

Tavaline mitte-admin kasutaja ei saa täppis-endpoint'i üldise `/api/rag/*` proxy kaudu kutsuda; proxy nõuab admin-õigust.

## Sihttestid

| Kontroll | Tulemus |
|---|---:|
| `tests/rag/agentDocumentIsolation.test.js` | 4/4 PASS |
| `rag-service/test_search_security.py` | 5/5 PASS |
| `rag-service/test_search_security_chroma.py`, Chroma 1.3.4 | 3/3 PASS |

Kogu täissviiti, build'i ja kogu linti ei korratud, sest nõutud sihtkontrollid läbisid ning vahemikus ei olnud auditivälist muudatust.

## Uue markeriga runtime-katse

Katse tehti päris rakenduse autentimise, dokumentide upload/PATCH/generate/delete API-de, Next.js põhivestluse, süvauuringu pipeline'i, RAG teenuse ja püsiva Chroma abil. OpenAI asemel kasutati ainult lokaalset deterministlikku adapterit, mis salvestas iga embeddingu ja mudelikutse kohta ainult markeri olemasolu ning sisendi räsi.

- Run ID: `violetnekask`
- Marker: `ZZTEST-PRIVAATNE-VIOLETNE-KASK-HELIKUMA`
- Sünteetiline otsingufraas: `violetne samblikulabori kompass mõõdab kujuteldava järve vaikseid helirõngaid`
- Ajutine rakendus/RAG/mudeliadapter: `127.0.0.1:3107/8811/8812`
- Ajutine PostgreSQL andmebaas ja roll ning eraldi tühi Chroma kollektsioon
- Kaks sünteetilist kontot: dokumendi omanik ja võõras kasutaja
- Tootmisandmeid, tootmisküpsist ega välist mudeliteenust ei kasutatud

### Tulemus

| Kontrollpunkt | Tulemus |
|---|---|
| Omaniku `/search/agent-documents` | 1 tulemus; täpne marker leitud |
| Täppisendpoint koos võõra owner/tenant/collection/where lisaväljadega | HTTP 422; marker puudus |
| Mitte-admin kasutaja katse täppisrada `/api/rag/*` kaudu avada | HTTP 403; marker puudus |
| Üldine dense | 0 tulemust; marker puudus |
| Üldine BM25 | 0 tulemust; marker puudus |
| Üldine hybrid | 0 tulemust; marker puudus |
| Üldine fallback | 0 tulemust; marker puudus |
| Pahatahtlikud kliendifiltrid | 0 tulemust; marker puudus |
| Võõras `CLIENT` põhivestlus | `retrieved_count=0`, `selected_context_count=0`, nähtav marker puudus |
| Võõras `SOCIAL_WORKER` põhivestlus | `retrieved_count=0`, `selected_context_count=0`, nähtav marker puudus |
| `SOCIAL_WORKER` süvauuring | `done`; 3 geo retrieval-päringut; marker puudus |
| Süvauuringu mudelikontekst | markeri tabamusi 0 |
| Süvauuringu raport | marker puudus |
| Süvauuringu tõendid | 0; marker puudus |
| Süvauuringu allikad | 0; marker puudus |
| Kõik mudeliadapteri kutsed pärast omaniku kontrolli | 6 kutset; markeri tabamusi 0 |

Algse auditi lekkeahel — võõras retrieval-kandidaat, valitud mudelikontekst ja nähtav vastus/raport/tõend/allikas — andis korduskatses kõigis nõutud punktides nulltulemuse.

## Kustutamine ja nulljäägid

Omaniku autentitud dokumendi DELETE järel:

- markeripäringu tulemused: 0;
- RAG dokumendid/vektorid: 0/0;
- `UserDocument` read: 0;
- salvestatud lähtefailid: 0.

Pärast sünteetiliste kontode eemaldamist olid järgmised katsespetsiifilised loendurid kõik 0: kasutajad, sessioonid, dokumendid, artefaktid, dokumendiauditid, vestlused, uurimistööd, usage bucket/reservation/event read, subscription'id, ChatLog ja DataAuditLog.

Lõplik keskkonnakontroll:

| Ressurss | Jääk |
|---|---:|
| kuulajad portidel 3107 / 8811 / 8812 | 0 / 0 / 0 |
| auditikonteiner | 0 |
| ajutine PostgreSQL andmebaas | 0 |
| ajutine PostgreSQL roll | 0 |
| ajutine `.env.local` | 0 |
| runtime-, RAG- ja agent-failide kaust | 0 |
| `.next`, genereeritud Prisma klient ja ajutine `node_modules` link | 0 |

## Lõppjäreldus

Kordusaudit ei leidnud algse P0 jaoks staatilist ega runtime-möödapääsu. Turvapiir rakendub enne retrieval'i ja mudelikutset, mitte attribution'i, allikakaardi või prompti kihis.

**PASS — algne P0 on suletud ja pakett võib liikuda integratsioonikorvi.**

Merge'i ega deploy'd ei tehtud.
