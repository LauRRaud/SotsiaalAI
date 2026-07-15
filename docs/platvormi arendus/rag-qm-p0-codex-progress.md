# RAG-QM-P0 Codex progress

STATUS: COMPLETE

## Tööaken

- Haru: `codex/rag-qm-p0-baseline`
- Worktree: `C:\Users\rauds\Desktop\SotsiaalAI-rag-qm-p0-baseline`
- Lähtecommit: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c`
- Lähteharu: värskendatud `origin/main`
- P8.0 teostus mainis: jah (`4c3fceb5aeb5ea203e77f749c4dcce24e1ab7c66` on lähtecommiti esivanem)
- P8.0 audit mainis: jah (`0972fdf8a89b848f08d8506526879dcd1aeb9f4d` on lähtecommiti esivanem)
- Alusdokumendi SHA-256 enne ja pärast kopeerimist: `bdba7ce3f17f61620f348b758beb19e7b351ace47c507ef4f87209e236cd32b7`

## Siduv privaatsusleping

Lubatud väljad on Lisa A.1 järgi:

- `ChatLog.event`, `ChatLog.createdAt`, `ChatLog.role`;
- `ChatLog.userId` ainult unikaalse kardinaalsuse arvutamiseks, ilma väärtuse väljundita;
- `rag_trace` loendurid ja lepingubooleanid (`*_count`, `displayed_sources_subset_of_selected`), `query_plan.mode`, `retrieval_trace_level`, `rag_risk_level`, `retrievers_used`, `hybrid_retrieval`;
- `rag_search` sisuta vastearvud, grounding, aastad, riskitase ja režiim; `municipalityMatches` ainult n≥20 agregaadis;
- `chat_no_external_sources.messageLength`;
- `crisis_detected` ja `isCrisis` ainult koondina;
- `ConversationMessage.metadata.rag_trace` ainult metadata-veergu selekteerides, kui see on agregaadi jaoks vajalik.

Keelatud on muu hulgas sõnumi `content`, päringu- ja vastusetekst, `query_plan.topics`, `planner_reason`, kasutajaidentifikaatorid, e-post, nimi, `agent::` identifikaatorid ning source-ID loendite kasutamine loendurite asemel.

### Päriselt selekteeritud väljad

CLI elava andmebaasi päring projitseerib täpselt järgmised väljad; muid JSON-välju ei selekteerita:

- `ChatLog.event`, `ChatLog.createdAt`, `ChatLog.role`;
- `COUNT(DISTINCT ChatLog.userId)` ühe arvuna — ühtegi `userId` väärtust ei tagastata;
- `rag_trace.retrieved_count`, `selected_context_count`, `selected_source_count`, `answer_source_count`, `displayed_source_count`, `filtered_out_source_count`;
- `rag_trace.displayed_sources_subset_of_selected`, `displayed_sources_subset_of_answer`, `package_aware_answering_used`;
- `rag_trace.query_plan.mode`, `retrieval_trace_level`, `rag_risk_level`, `retrievers_used`;
- `rag_trace.hybrid_retrieval.merge_strategy.strategy`, `hybrid_retrieval.channel_counts`;
- `rag_search.ragMatchCount`, `chosenGroupCount`, `retrieversUsed`, `ragRiskLevel`, `queryPlanMode`;
- `chat_no_external_sources.messageLength`, `ragRiskLevel`.

`ConversationMessage` tabelit P0 skript ei päri üldse. Seega ei selekteerita ei selle `metadata`- ega `content`-veergu. `municipalityMatches`, grounding ja aastaväljad jäid samuti kasutamata, sest nõutud P0 mõõdikud on tõendatavad kitsama projektsiooniga.

## Teostuse seis

- Eeltingimused ja isoleeritud worktree: valmis.
- Lisa A ning kogu alusdokument: täielikult loetud.
- Koodi- ja telemeetrialepingu audit: valmis.
- Baseline-CLI `scripts/rag-quality-baseline.mjs` ja paketikäsk `rag:qm:baseline`: valmis.
- JSON-/Markdown-raport, JSON-skeem, väljundvalidaator ja atomaarne paariskirjutaja: valmis.
- Sanitiseeritud fixture ja deterministlik oodatud JSON-/Markdown-raport: valmis.
- A.5 töövihik: 72 `not_run` rida (37 golden + 35 kataloog), päringu- ja vastusetekstita.
- Sihttestid: 28/28.
- Kogu regressioonikomplekt: 1265/1265.

## Päris read-only baasjoon

- Ajavahemik: `2026-06-15T00:00:00.000Z` kuni `2026-07-15T00:00:00.000Z`, algus kaasatud ja lõpp välistatud.
- Allikas: ainult `ChatLog`, staatilised piiritletud `SELECT` päringud.
- Keskkonnaspetsiifiline väljund: `logs/rag-quality-baseline-2026-07-15.json` ja `.md`; `logs/` on gitignore'itud ja kumbki fail ei kuulu commit'i.
- Raporti andmeräsi: `7479e0c939801f1429a06a3061d3503249d8783d9df9460b7e4767c93f18f71e`.
- Avaldatav sündmuseridade koguarv: 41.
- Avaldatavad n≥20 jaotused: sündmuserea roll `SOCIAL_WORKER` 41; päev `2026-07-12` 25.
- Unikaalsed kasutajad, sündmuseliigid, planner'i režiimid, ülejäänud rollid/riskid/retrieverid ning kõik binaarmõõdikute lugejad jäid alla n=20 või puudusid; täpsed arvud ja määrad on raportis `suppressed`/`unavailable` ning väärtus `null`.
- Kriisi täpset arvu ei avaldata. Üksikkasutaja profiili ega rea-tasandi väljundit ei teki.
- `rag_trace` ja `rag_search` planneri-, riski- ning retrieverijaotused hoitakse eraldi; sama päringu kahe sündmuse liitmine ei saa kunstlikult k=20 piiri ületada.

## Sünteetiline aste 2

- Golden-37 täisjooks: `not_run` — localhosti rakendus oli kuulatav, kuid jooksuks nõutud `SOTSIAALAI_SMOKE_COOKIE`/`SMOKE_COOKIE` puudus; autentimisandmeid ei tuletatud ega hangitud kõrvalt.
- Kataloog-35 jooks: `not_run` samal põhjusel.
- Töövihik sisaldab ainult lubatud `golden:<id>` ja `catalog:<nr>` viiteid; 29 CLIENT-rida pärinevad kataloogikihist.
- Mõõtmata `selected_count`, `displayed_count` ja `answer_outcome` on `null`, mitte näiline nulltulemus; `planner_mode` ja märkus on `not_run`.
- Produktsioonivestlusi, SourceFeedback'i juhtumeid ega juhuslikke kasutajateateid ei avatud.

## Kontrollid

- `node --test tests/scripts/ragQualityBaseline.test.js`: 28/28.
- `npm test`: 1265/1265; lähte-main oli 1237/1237, seega lisandus täpselt 28 testi ja varasem testimaht säilis.
- sihitud ESLint uutele skriptidele/testile: 0 viga ja 0 hoiatust.
- kogu `npm run lint`: 0 viga, 358 olemasolevat hoiatust.
- `npm run i18n:check`: ET/EN/RU korras.
- `prisma validate`: skeem korras.
- `db:migrate:check` jäeti ühendusega käivitamata, sest kontrollskript loob ja kustutab ajutise andmebaasi; see oleks vastuolus P0 andmebaasikirjutuse keeluga. Prisma skeemi ega migratsioone ei muudetud.
- fixture'i täis-CLI jooks: JSON ja Markdown genereeriti, valideeriti ja nende kanooniline objekt kattub bait-baidilt oodatud väljundiga.
- päris CLI jooks: exit 0, ainult read-only `SELECT`, gitignore'itud väljund.
- `git diff --check`: korras enne stage'imist; staged-kontroll korratakse enne commit'i.

## Skoobi tõend

- Muudetud on ainult P0 skriptid, paketikäsk, alus-/progressidokument, raportiskeem, töövihik, fixture, oodatud fixture-raportid ja regressioonitestid.
- `master_sources_final.json`, Prisma skeem, migratsioonid, `app/`, `components/`, runtime `lib/`, `rag-service/` ja `eval/golden-rag-v1.json` on lähtecommitiga identsed.
- Koodis puudub `fetch`, ingest-, patch- ja delete-endpoint ning Prisma kirjutusmeetod; andmebaasirajal on ainult `$queryRaw` staatiliste `SELECT` lausetega.
- Telemeetriat, RAG-i sisu, rakenduse käitumist ega scheduler'it ei muudetud. Deploy'd ei tehtud.

## Raporteerimise aus piir

Ämbrijaotus põhineb sünteetilisel valimil; produktsiooni-jaotus kinnitamata (Lisa A.3).

P0 ei tõenda automaatselt COVERAGE_GAP-i, RETRIEVAL_GAP-i ega LIFECYCLE_GAP-i eristust. Need jäävad mõõdetavusaukudeks, kuni olemas on lubatud märgendatud tõend või järgmise paketi instrumentatsioon.

Päris koondid tõendavad ainult sündmuste hulka ning künnise ületanud struktuurseid jaotusi. Need ei tõenda vastuse kvaliteeti, õiget allikat, korpuse katvust, retrieval'i õnnestumist, vastuse outcome'i, allika värskust ega latentsust.

## Auditi fookus ja järgmine pakett

- Audit peab kinnitama, et SQL projektsioon ei laiene `ChatLog.data` tervikobjektile ega `ConversationMessage.content`-ile.
- Audit peab proovima väljundvalidaatorit e-posti, 11-kohalise numbri, `agent::`, identifier-võtmete, query/answer-väljade, `topics`, `planner_reason`, source-ID loendite ja pika vabatekstiga.
- Audit peab kontrollima, et k=19 jääb summutatuks, k=20 avaldub ja numbrilised koondid kasutavad `*_count` välju.
- Järgmine pakett on eraldi otsustatav RAG-QM-P1 viie additiivse instrumentatsiooniväljaga (`trace_id`, `answer_outcome`, kestused, freshness-proxy, `plan_input_hash`). P0 ei lisa neid välju ega seo scheduler'i püsiseisu repo-failiga.
