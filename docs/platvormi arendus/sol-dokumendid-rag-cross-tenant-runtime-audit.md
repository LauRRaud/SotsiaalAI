# DOKUMENDID/SÜVAUURING — RAG cross-tenant runtime-ristkontroll

## Lõppotsus

**P0_CONFIRMED**

Kasutaja A privaatne `/dokreziim` dokumenditükk jõudis kasutaja B retrieval'i, mudelile antud konteksti ja kasutajale nähtavasse väljundisse. Leke reprodutseerus põhivestluses nii pöörduja (`CLIENT`) kui ka spetsialisti (`SOCIAL_WORKER`) rolliga ning spetsialisti süvauuringu valmisraportis ja tõendites.

See on sõltumatu audit. Leket ei parandatud.

## Auditeeritud lähtekoht ja töökorraldus

- Kontrollitud `origin/main`: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c`.
- Commit'i aeg ja kirjeldus: `2026-07-15T23:53:21+03:00`, `merge: add independent RAG P8.0 audit`.
- Lähteanalüüsi vana võrdluspunkt: `7ae76d5b`.
- Auditiharu: `codex/documents-cross-tenant-runtime-audit`.
- Eraldi worktree: `C:\Users\rauds\Desktop\SotsiaalAI-doc-rag-cross-tenant-audit`.
- Worktree loodi värskelt täpselt ülaltoodud `origin/main` SHA pealt.
- Kasutaja määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI` ei kasutatud ega muudetud.
- Auditicommit: käesolevat raportit sisaldav docs-only commit; selle SHA antakse üle koos push'i tulemusega.

### Relevantse Git-ajaloo kontroll

Käsk `git log --follow 7ae76d5b..origin/main -- <fail>` ei näidanud alltoodud E.3 pinnafailides vahepealseid muudatusi. Seega oli lähteanalüüsi staatiline ahel ka kontrollitud `origin/main`-is endiselt kehtiv.

Kontrollitud pinnafailid:

- `lib/documents/embeddings.js`
- `lib/documents/search.js`
- `lib/documents/generation.js`
- `lib/chat/queryPlanner.js`
- `lib/chat/retrievalContextAssembler.js`
- `lib/research/pipeline.js`
- `rag-service/main.py`
- `app/api/chat/route.js`
- `app/api/research/jobs/route.js`

## Staatilise isolatsiooniahela korduskontroll

1. `lib/documents/generation.js:204` kutsub dokumendimustandi koostamisel `ensureDocumentIndexed`.
2. `lib/documents/embeddings.js:22-69` saadab `/ingest/text` päringu metadata väljadega `source_type: agent_document` ja `collection_id: agent_documents`, kuid ei lisa omaniku-, kasutaja- ega tenant-identifikaatorit.
3. `rag-service/main.py:277-281` normaliseerib puuduva audience'i väärtuseks `BOTH`.
4. `rag-service/main.py:131-132` kasutab ühte püsivat Chroma klienti ja ühte tegelikku kollektsiooni. `collection_id` talletatakse metadata väljana; see ei ole eraldi Chroma kollektsioon ega turvapiir.
5. Põhivestlus koostab `lib/chat/retrievalContextAssembler.js:1174-1186` ainult rollipõhise audience-filtri (`CLIENT/BOTH` või `SOCIAL_WORKER/BOTH`). Omaniku- ega `agent_document` välistust ei lisata.
6. Süvauuringu `lib/research/pipeline.js:430-455` `buildAudienceWhere`/`buildWhereForGeo` lisab samuti ainult audience'i ning soovi korral kliendi antud `collection_id`; omaniku- ega `agent_document` välistust ei ole.
7. RAG `/search` (`rag-service/main.py:4439` edasi) kopeerib päringuga saadud filtrid Chroma where-tingimusse, kuid ei lisa serveris autentitud omaniku- või tenant-piiri.
8. Positiivne omaniku dokumendimustandi otsing on kitsam: `lib/documents/search.js:27-30` piirab päringu `doc_id` ja `collection_id` järgi. See ei kaitse põhivestluse ega süvauuringu üldiseid retrieval-radu.

Järeldus: `source_type: agent_document` ega `collection_id: agent_documents` ei ole mitte-omaniku põhivestluse või süvauuringu filtrites välistatud. `collection_id` on metadata, mitte isolatsioonipiir.

## Ohutu runtime-katse

### Eraldatud keskkond

- Next.js rakendus: `127.0.0.1:3107`.
- RAG teenus: `127.0.0.1:8811`.
- Lokaalne OpenAI-ühilduv deterministlik mudeliadapter: `127.0.0.1:8812`.
- Eraldi ajutine PostgreSQL andmebaas: `sotsiaal_ai_cross_tenant_audit_e4b8e525`; rakendati 92 migratsiooni.
- Eraldi ajutine Chroma/RAG salvestus ja kollektsioon `audit_cross_tenant`; katse algas 0 dokumendi ja 0 vektoriga.
- Kasutati päris rakenduse autentimist, API marsruute, `ensureDocumentIndexed` ahelat, RAG teenust, Chroma salvestust, retrieval'i koostamist ja süvauuringu pipeline'i.
- Mudeliadapter kasutas fikseeritud deterministlikku embeddingut ja tagastas markeri ainult siis, kui marker oli mudelisisendis. See hoidis katse täiesti lokaalsena ning tegi mudelikonteksti jõudmise üheselt kontrollitavaks. Retrieval'i piiririke ei sõltu mudeli loomingulisest käitumisest; lisaks tabas väljamõeldud fraasi BM25 kanal.
- Tootmisandmeid, päriskasutajate vestlusi ega tootmisseansi küpsist ei kasutatud.

### Kontod ja dokument

Loodi kaks ainult ajutises andmebaasis eksisteerinud sünteetilist kontot:

- kasutaja A: dokumendi omanik, roll `SOCIAL_WORKER`;
- kasutaja B: võõras kasutaja, esmalt `CLIENT`, seejärel sama katse korduseks `SOCIAL_WORKER`.

Kasutaja A laadis autentitud dokumendi-API kaudu üles täielikult väljamõeldud tekstifaili ja käivitas selle `/dokreziim` mustandivoo kasutatava `POST /api/documents/artifacts/generate` raja kaudu. See kutsus `generateArtifactDraftContent -> ensureDocumentIndexed -> /ingest/text`.

Saladustevabad katseandmed:

- dokument: `Sunteetiline auditidokument 35E6A38F`;
- marker: `ZZTEST-PRIVAATNE-E2E29D5F-AC79-4F00-92B4-230F35E6A38F`;
- väljamõeldud semantiline fraas: `violetne samblikulabori kompass mõõdab kujuteldava järve vaikseid helirõngaid`;
- dokumendi ID: `cmrndk4mu0002g4tsv55jqvc7`;
- RAG `doc_id`: `agent::cmrndk4mu0002g4tsv55jqvc7::59c22ffc774e3303d4c5d5b9ced4999c24069395855c6164399945f3fd159431`.

Dokumendi tekst kinnitas sõnaselgelt, et see ei kirjelda ühtegi päris isikut, asukohta ega juhtumit. Raportis ei avaldata test-PIN-i, sessiooniväärtusi, ühendusstringe ega API võtmeid.

### RAG metadata ja omaniku positiivne rada

Pärast `/dokreziim` rada tagastas RAG dokumendi kohta ühe chunk'i järgmise metadataga:

| Väli | Väärtus |
|---|---|
| `audience` | `BOTH` |
| `audiences` | `CLIENT`, `SOCIAL_WORKER` |
| `source_type` | `agent_document` |
| `collection_id` | `agent_documents` |
| `doc_id` | ülaltoodud `agent::...` ID |
| `original_doc_id` | `cmrndk4mu0002g4tsv55jqvc7` |
| omaniku-/tenant-väli | puudus |

Omaniku kontrollpäring leidis sama chunk'i semantiliselt lähedase fraasiga. Tulemuses olid õige marker, pealkiri, `agent_document`, `agent_documents` ja `BOTH`; kasutati dense- ja BM25-kanalit. See kinnitas, et testdokument oli päriselt indekseeritud ja otsitav.

## Põhivestluse tulemused

### Kasutaja B rolliga `CLIENT`

Autenditud `POST /api/chat` tagastas HTTP 200.

| Kontrollpunkt | Tulemus |
|---|---|
| Võõras chunk retrieval'i kandidaatides | **LEKKIS** — `retrieved_count: 1` |
| Võõras chunk valitud mudelikontekstis | **LEKKIS** — `selected_context_count: 1`; detailis omaniku RAG ID, pealkiri, markeriga `body_preview`, `source_type: agent_document`, `collection_id: agent_documents` |
| Mudeliadapteri sisend | **LEKKIS** — `/v1/responses` auditilogis `marker_present: true`, `title_present: true` |
| Kasutajale nähtav vastus | **LEKKIS** — vastus sisaldas täpset markerit |
| Allikakaart | Ei kuvatud; attribution kiht peitis allika põhjusega `insufficient_evidence_strength` / `unrecognized_source_type` |

Allikakaardi peitmine ei ole turvapiir: privaatne sisu oli juba retrieval'is, mudelikontekstis ja nähtavas vastuses.

### Kasutaja B rolliga `SOCIAL_WORKER`

Sama konto roll muudeti ajutises andmebaasis spetsialistiks ja autentitud päring korrati. Tulemus oli sama:

- `retrieved_count: 1`;
- `selected_context_count: 1`;
- valitud konteksti detail sisaldas omaniku pealkirja ja markerit;
- vastus sisaldas täpset markerit;
- allikakaart peideti attribution-kihis, kuid sisu oli juba kasutajale avaldatud.

**Põhivestluse otsus: P0_CONFIRMED mõlemas rollis.**

## Süvauuringu tulemused

Süvauuring käivitati lokaalselt päris `POST /api/research/jobs` ja `GET /api/research/jobs/{id}` radade kaudu kasutaja B `SOCIAL_WORKER` sessiooniga. Töö lõpetas olekus `done`.

| Kontrollpunkt | Tulemus |
|---|---|
| Võõras chunk retrieval'is | **LEKKIS** — `evidence_count: 1`; kaks retrieval-päringut, 0 ebaõnnestumist |
| Mudelikontekst | **LEKKIS** — `research_report` mudelikutse auditilogis `marker_present: true`, `title_present: true` |
| Valmisraport | **LEKKIS** — kokkuvõte ja põhileid sisaldasid täpset markerit |
| Tõendid | **LEKKIS** — `E1` sisaldas omaniku RAG `docId`, chunk ID-d, dokumendi pealkirja ja markeriga täistekstikatkendit |
| Kasutajale nähtav allikas | **LEKKIS** — allikaloendis kuvati omaniku dokumendi pealkiri |

**Süvauuringu otsus: P0_CONFIRMED.**

## Sõltumatult käivitatud testid

Käsk:

`node --import ./scripts/register-node-test-loader.mjs --test <tests/documents/*.test.js + tests/privacy/*.test.js>`

Tulemus:

- failirühmad: `tests/documents` ja `tests/privacy`;
- testifaile: 4;
- teste: 16;
- läbis: 16;
- ebaõnnestus: 0;
- vahele jäeti: 0.

Olemasolevad testid läbisid, kuid need ei kata kinnitatud cross-tenant runtime-ahelat. Audit ei usaldanud ainult teste: põhivestlus ja süvauuring reprodutseeriti kahe autentitud sünteetilise kontoga.

## Leiud P0–P3

| ID | Raskus | Leid | Tõend ja mõju |
|---|---|---|---|
| RAG-XTEN-01 | **P0** | Privaatne agent-dokument on ilma omaniku-/tenant-piirita jagatud RAG-is ning sobitub mõlema rolli `BOTH` filtriga. | Võõra konto retrieval, mudelikontekst ja nähtav vastus lekkisid põhivestluses; süvauuringu raport, tõend ja allikas lekkisid samuti. |
| — | P1 | Täiendavat eraldiseisvat P1 leidu ei avastatud. | Lähteanalüüsi P1/P0-kandidaat tõsteti runtime-tõendiga P0-ks. |
| — | P2 | Täiendavat eraldiseisvat P2 leidu ei avastatud. | Allikakaardi peitmine põhivestluses ei vähenda P0 raskust ega moodusta eraldi leidu. |
| — | P3 | Täiendavat eraldiseisvat P3 leidu ei avastatud. | Audit oli kitsalt E.3 runtime-kinnituse ulatuses. |

## Minimaalne paranduste pakett

Rakenduskoodi selles auditis ei muudeta. Soovitatav minimaalne paranduspiir on:

1. Välista `source_type: agent_document` (ja kaitseks ka `collection_id: agent_documents`) serveripoolselt kõigist mitte-omaniku põhivestluse ja süvauuringu retrieval-radadest.
2. Kui agent-dokumendi omanikuotsing peab säilima, lisa igale chunk'ile muutmatu omaniku-/tenant-ID ning seo `/search` filter serveris autentitud kasutaja identiteediga; klient ei tohi tenant-filtrit valida ega eemaldada.
3. Eelistatult paiguta privaatne agent-dokument eraldi füüsilisse RAG kollektsiooni või tenant-partitsiooni. Praegune `collection_id` metadata ei ole isolatsioon.
4. Rakenda sama kohustuslik piir igale fallback-, dense-, BM25-, hybrid- ja süvauuringu geo-variandile.
5. Lisa runtime-regressioonid vähemalt kombinatsioonidele `CLIENT` ja `SOCIAL_WORKER` × põhivestlus ja süvauuring. Test peab tõendama 0 retrieval-kandidaati, 0 mudelikonteksti leket ja 0 nähtavat markerit.
6. Korda sõltumatu audit uue sünteetilise markeriga ning kontrolli ka kustutusahelat.

Pelgalt attribution-/allikakaardi filter või mudeliprompt ei ole parandus, sest andmepiir peab katkema enne retrieval'i ja mudelikutset.

## Kohustuslik koristus ja nulljäägid

Dokument kustutati esmalt autentitud omaniku `DELETE /api/documents/{id}` raja kaudu. Seejärel andis markeripäring 0 tulemust ning RAG tervisekontroll näitas 0 dokumenti ja 0 vektorit. Fail ei olnud ajutises salvestusruumis enam olemas.

Enne kasutajate eemaldamist olid pärast dokumendi API-kustutust katsespetsiifilised read muu hulgas: 2 kasutajat, 2 sessiooni, 3 dokumendiauditi rida, 2 ResearchJob'i, 4 usage bucket'it, 9 usage reservation'it, 18 usage event'i, 2 subscription'it, 22 ChatLog'i ja 2 DataAuditLog'i. Kõik eemaldati.

Järelkontroll:

| Klass / ressurss | Jääk |
|---|---:|
| sünteetilised kasutajad | 0 |
| Session | 0 |
| LoginTempToken | 0 |
| EmailOtpCode | 0 |
| TrustedDevice | 0 |
| UserDocument ja fail | 0 |
| AgentArtifact | 0 |
| AgentArtifactSourceDocument | 0 |
| DocumentAudit | 0 |
| Conversation | 0 |
| ConversationMessage | 0 |
| ResearchJob | 0 |
| UsageBucket / UsageReservation / UsageEvent | 0 / 0 / 0 |
| Subscription | 0 |
| ChatLog | 0 |
| DataAuditLog | 0 |
| VerificationToken | 0 |
| RAG markeripäringu vasted | 0 |
| RAG dokumendid / vektorid | 0 / 0 |
| ajutine PostgreSQL andmebaas | 0 (andmebaas eemaldatud) |
| ajutised RAG-, mudeli- ja lähtefailid | 0 (kataloogid eemaldatud) |
| auditikonteinerid | 0 |
| kuulajad portidel 3107 / 8811 / 8812 | 0 / 0 / 0 |

## Muutmatus ja keelatud tegevused

- Rakenduskoodi ei muudetud.
- Prisma skeemi ega migratsioone ei muudetud.
- Enne raporti lisamist oli audit-worktree puhas ja `HEAD` võrdus täpselt kontrollitud `origin/main` SHA-ga.
- Auditiharule lisatakse ainult see dokumentatsioonifail.
- Kasutaja määrdunud põhitööpuud ei muudetud.
- Merge'i ei tehtud.
- Deploy'd ei tehtud.
- Ühtegi tootmisandmetele suunatud päringut ei tehtud.

STATUS: COMPLETE
