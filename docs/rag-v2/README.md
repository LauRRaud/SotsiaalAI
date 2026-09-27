# RAG v2

SotsiaalAI allikapõhise otsingu ja vestluse dokumentatsioon. Esimene osa kirjeldab 27.09.2026 seisu ja töövoogu. Teine osa loetleb otsused ja aruanded. Kolmas osa on septembri alguse kohaliku sissevõtu ja M2 kasutusjuhend; see kehtib ajaloolise ja kohaliku arenduse osana.

## Praegune seis (27.09.2026)

Seis on kirja pandud 27.09.2026 ~21:15 EEST. Hilisemad muudatused on ADR-ides ja [runbookis](runbook-corpus-increment.md).

### Mis RAG v2 praegu on

- **Korpus.** Tenant `sotsiaalai-corpus`, korpus v32: 6024 dokumenti, 32 746 otsinguühikut. Indeksipõlvkond `search_generation_74ef75…` (salvestusviis `versions-v1`, [ADR-036](adr-036-version-index.md)) on aktiivne alates 27.09.2026 kell 22:37 EEST. Varuks on v30 ja v31; vanemad põlvkonnad on kustutatud.
  - v26 = v25b (5996 dokumenti: 1122 teadmusdokumenti ja 4874 omavalitsuse kirjet) + kaks riiklikku seadust.
  - v27 = v26, kus 61 Riigi Teataja XML-akti on töödeldud puhastatud adapteriga (`source-structure-v26`: muutmismärked välja, `§ 15¹`, kehtetud paragrahvid välja; [ADR-034](adr-034-riigi-teataja-xml-cleanup.md)).
  - v28 = v27, kus 576 omavalitsuse kirjet ilma oma lingita said lingi oma omavalitsuse registreeritud allikaregistrist (`source-structure-v27`); v29 = v28 + kaks SHS-i redaktsiooni ([ADR-035](adr-035-record-links-and-shs-versions.md)).
  - v30 = v29 esimese `versions-v1` põlvkonnana (üks täisehitus, 31 min); v31 = v30 + SHS 2027 ja HMS 2027 (PR #211), esimene muudatusepõhine lisamine: töödeldi 2 dokumenti, indeksi töö 47 s ([ADR-036](adr-036-version-index.md)).
  - v32 = v31 + 17 õigusakti Riigi Teataja praeguse kehtivusega (neid peeti ekslikult kehtivaks) ja 22 järelteksti, sh Riigilõivuseadus 01.08.2026–30.06.2027 ja edasi, Lastekaitseseadus ja SÜS 01.10-st ning Tallinna, Põlva, Kohila, Kehtna jt uued korrad (PR #215, #216). Kogu käik 2 min 43 s, 0,016 USD.
  - Sotsiaalhoolekande seadus (SHS): RT 103062026023 (12.06–30.09.2026), RT 130062026065 (01.10–30.11.2026), RT 111072026120 (01.12–31.12.2026) ja RT 111072026121 (01.01–31.01.2027). Kehtivusreegel valib kuupäeva järgi. Veebruari 2027 tekst tuleb lisada enne 31.01.2027.
  - Haldusmenetluse seadus (HMS): RT 106072023031 (01.01.2024–31.12.2026) ja RT 109072026076 (alates 01.01.2027).
  - Riigilõivuseadus: 01.08–30.10.2026, 01.11–31.12.2026, 01.01–30.06.2027 ja alates 01.07.2027. **31.10.2026 on RT andmetes katmata** (111072026166 lõpeb 30.10, 111072026167 algab 01.11); kontrolli RT enne 31.10 uuesti.
- **Vestlus.** sotsiaal.ai/vestlus vastab sellest korpusest kinnitatud vestlusplaani järgi. Plaan on JSON-fail `/etc/sotsiaalai/` all. Selle koostab ja lülitab sisse `scripts/rag-v2-chat-plan.mjs`. Plaan seob tenant'i, indeksipõlvkonna, otsinguprofiili, juhiste ja otsinguabi versioonid, mudeli, rahalise lae ning koodi räsi (`implementationHash`). 27.09.2026 kell 22:37 sai aktiivseks `/etc/sotsiaalai/m4-corpus-chat-20260927x.json` (id …-1937, v32, `main` `c5f5657d`). Väljalase uuendab plaani ise ([ADR-037](adr-037-release-chat-plan.md)); uus põlvkond vajab uut plaani. Iga `lib/rag-v2` deploy ja iga uus põlvkond vajab uut plaani.
- **Vastuvõtutest.** [27.09.2026 aruanne](../audits/rag-v2-chat-acceptance-2026-09-27.md): 71 küsimust; 50 õiget, 11 osaliselt õiget, 7 põhjendatud vastamata jätmist, 3 tehnilist probleemi, valeks hinnatud vastuseid 0. Parandused on [ADR-031](adr-031-source-level-and-answer-completeness.md)-s.

### Üks vestluspööre

1. **Päringuplaan.** Otsinguabi (`lib/rag-v2/pilot/search-assist.js`) laseb vastusemudelil kirjutada kuni 3 lühikest eestikeelset otsingupäringut ja määrata sõnumi keele. Vastus tuleb selles keeles.
2. **Ühine otsing** `rag-v2/unified-retrieval-1` (`lib/rag-v2/search/unified.js`), konteksti lagi 32 000 tokenit:
   - teadmusrada: profiil `hybrid-estnltk-chat-v1` (`lib/rag-v2/search/profiles.js`), EstNLTK sõnaline kanal ja vektor RRF-iga, vektori kaal 2, 9 seemet, 10 000 tokenit;
   - teadmusraja ulatus ([Codexi kontroll 27.09](../audits/rag-v2-codex-review-2026-09-27.md)):
     - õigusakt jääb ainult redaktsioonis, mis kehtib Eesti tänasel kuupäeval või kasutaja küsitud perioodil (`lib/rag-v2/search/legal-validity.js`; puuduv kuupäev ≠ kehtiv);
     - omavalitsuse enda tekst jääb ainult vestluses nimetatud omavalitsuse kohta; kirillitsas nimi loetakse otsinguabi päringutest;
     - välja jäänu on `evidence.retrieval.scope` all;
   - omavalitsuse kataloog `rag-v2/record-catalogue-2`, 12 000 tokenit; küsimusele lähimad 3 kirjet on täies mahus (`relevant_detail`);
   - kuni 2 perioodirada ajakirjaartiklitele avaldamisaja järgi.
3. **Valik (rerank).** Mudel loeb 30 parimat liidetud kandidaati (`RERANK_POOL`) ja jätab alles kuni 9 lõiku. Plaan ja valik kasutavad `reasoning: low`. Provideri viga jätab liidetud järjestuse ja märgib põhjuse.
   - Riikliku õiguse reserv ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)): 7 riiklikku õigusteksti (`valid_from`, ilma `regions`-ita) otsitakse eraldi samade päringutega. Kuni 6 nende parimat lõiku, ühest aktist kuni 2, lisatakse valija hulga lõppu, kui neid 30 hulgas pole. Valija otsustab, kas need jäävad.
4. **Vastus.** Mudel `gpt-6-luna`, arutlustase `medium`. See on skripti vaikeväärtus ja omaniku otsus 27.09.2026: `low` oli 2,5× kiirem, kuid vastused olid nõrgemad. Juhised on põhijuhis ([ADR-028](adr-028-production-answer-prompt.md)) ja vestlusjuhis; PR #196 järel `m4-grounded-answer-10` ja `m4-grounded-dialogue-9`, PR #197 järel `m4-grounded-answer-11` ja `m4-grounded-dialogue-10` (Luna vastab oma häälega, allikatest ei jutustata; [ADR-031](adr-031-source-level-and-answer-completeness.md)). Server kontrollib viited kanooniliselt enne avaldamist. Allikate paneel näitab ainult viidatud allikaid.

Versioonid 27.09.2026:

- PR #195 (`40ddeed4`): ajaloo laadimine ~6× kiirem, vestluse piiri teade.
- PR #196 (`164fc720`, serveris 27.09): `m4-grounded-dialogue-9`, kriisiriba ja allikavaate link algallikale; otsinguabi jääb `rag-v2/search-assist-2`.
- PR #197 (`claude/rag-v2-answer-voice`, avatud 27.09): vastuse oma hääl, `m4-grounded-answer-11` ja `m4-grounded-dialogue-10`.
- PR #199 (`68b4c378`, serveris 27.09 12:31): riikliku õiguse reserv valikus ja vana vestluse jätk pärast plaani uuendust ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)). Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20260927l.json` (id …-0932). Elav B9 tsiteeris SÜS-i ja HMS-i.
- PR #201 (`5b09e80e`): allikate soojendus serveri käivitusel (`instrumentation.js`, [ADR-033](adr-033-warm-up-at-server-start.md)). Esimene pööre pärast taaskäivitust 42,7 s → 14–23 s.
- PR #202 (`d3302061`): Riigi Teataja XML-i puhastus, töötlussilt `source-structure-v26`; korpus v27 ([ADR-034](adr-034-riigi-teataja-xml-cleanup.md)).
- PR #205 (`f0a8e8ab`): õigusakt ainult küsitud kuupäeval kehtivas redaktsioonis, omavalitsuse tekst ainult nimetatud omavalitsuse kohta ([Codexi kontroll](../audits/rag-v2-codex-review-2026-09-27.md)); `m4-grounded-dialogue-11`.
- PR #207 (`818daf07`): allikaregistri lingid lingita omavalitsuse kirjetele; PR #208 (`2769c706`): SHS-i kehtivad redaktsioonid registris ([ADR-035](adr-035-record-links-and-shs-versions.md)).
- PR #203 (`6085b84e`): plokk, mis lõpeb oma viidete kordusega („… tuvastatud. S1, S2“), avaldatakse; enne lükati terve vastus tagasi (vastuvõtutest B7, `inline_answer_reference`).
- `rag-v2/search-assist-3` on katse harus `claude/rag-v2-answer-quality` ja tootmisse ei lähe. 52 küsimuse komplektis v26 peal (48 vastatavat) oli search-assist-2 tulemus: kõik ankrud 34, vähemalt üks ankur 44, õige dokument 45. search-assist-3 tulemus: 32, 43 ja 46. -3 kaotas ankruid ajakirjaküsimustel. Failid: `tmp/rag-v2-dev-2026-09-27/assist-main-v26.json` ja `assist-quality-v26.json`.

### Andmevoog

```text
Andmebaasi/ + Andmebaasi/REGISTER.json
  -> sissevõtupartiid (scripts/rag-v2-ingest-batch.mjs)
  -> kohalik korpusehoidla (tmp/rag-v2-corpus-store-v25)
  -> hoidla koopia serverisse
  -> embedding'ute ost serveris (scripts/rag-v2-corpus-embeddings.mjs)
  -> indeksipõlvkond PostgreSQL-is ja Qdrantis (scripts/rag-v2-index-batch.mjs)
  -> vestlusplaan (scripts/rag-v2-chat-plan.mjs)
```

1. **Allikad.** Algfailid on Gitis `Andmebaasi/` all. `Andmebaasi/REGISTER.json` kirjeldab iga faili: kategooria, roll, sha256 ja ülevaatuse seis. v26 seaduste XML-id ja registrikirjed on harus `claude/rag-v2-national-laws` (27.09 push'imata).
2. **Sissevõtt kohalikult.** `scripts/rag-v2-ingest-batch.mjs`: valik, `--mode plan`, `run`, `review`, täidetud ülevaatus, `publish`. Avaldamine loob kohalikus hoidlas uue muutumatu põlvkonna. Partii järjekord vajab kohalikku PostgreSQL-i (`scripts/rag-v2-local.mjs up`). Mudelikutseid pole.
   - Töötluskoodi muutus nõuab uusi töötlussilte (`scripts/rag-v2-processing-fingerprint.mjs`) ja uut sissevõttu. Vektorid on seotud sisendi räsiga, seega ostetakse ainult muutunud sisendid.
3. **Koopia serverisse.** Hoidla (v26: 4,8 GB) kopeeritakse serveri töökausta `/home/ubuntu/rag-v2-work/rag-v2-v25`. Serveri koopia jääb alles, sest ilma selleta ei saa uuesti indekseerida. **Mitte rakenduse kausta** (`/home/ubuntu/apps/sotsiaalai/tmp/` jms): Next.js build loeb ka `tmp/`-i ja 27.09.2026 aegus deploy selle tõttu kaks korda.
4. **Embedding'ute ost.** `scripts/rag-v2-corpus-embeddings.mjs --mode plan` koos `--reuse <varasem usage-kaust>` arvestab ainult uued sisendid. v26: 408 uut, 29 145 taaskasutatud, 0,024 USD.
   - Ost (`--mode execute`) vajab omaniku loakirjet, sama `--reuse` väärtust ja uut `--output` kausta. Ilma `--reuse`-ta ei vasta plaan baseline'ile ja midagi ei osteta.
5. **Indeks.** `scripts/rag-v2-index-batch.mjs --mode plan`, siis `--mode run` iga vajaliku `--vectors` kaustaga. v26 import võttis ~33 min ja kontroll ~10 min. Uus põlvkond saab aktiivseks alles pärast kontrolli.
6. **Vestlusplaan.** Plaan on seotud põlvkonna ID-ga. Uue indeksi aktiveerimine peatab vestluse, kuni plaan on uuesti ehitatud.

Täpsed käsud, lõksud ja kontrollid on [runbookis](runbook-corpus-increment.md).

### Pärast deploy'd

PR-id liidetakse ja paigaldatakse automaatselt pärast quality-gate'i. Käsitsi deploy'd ei tehta.

Plaan kannab koodi räsi, mille arvutab `implementationManifest()` (`lib/rag-v2/pilot/provenance.js`). Räsi katab muu hulgas `lib/rag-v2/**`, `lib/chat/m4Pilot*.js`, vestluse kasutajaliidese failid, `app/chat-source/page.jsx` ja `messages/*.json`. Kui väljalase muudab mõnda neist, ei anna vana plaan uusi vastuseid (`implementation_approval_mismatch`). Alates [ADR-037](adr-037-release-chat-plan.md)-st uuendab deploy plaani ise: sama kinnituse ulatus ja indeksipõlvkond, uue koodi räsi. Kontroll käib mudelikutseta enne põhiandmebaasi migratsiooni. Kui ükski plaan uue koodiga ei läbi, taastub eelmine väljalase koos oma plaaniga.

Uue indeksipõlvkonna, eelarve või mudeli jaoks ehita plaan serveris rakenduse juurkaustas käsitsi:

```sh
sudo -n node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \
  scripts/rag-v2-chat-plan.mjs --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v1 --reasoning medium \
  --template /etc/sotsiaalai/m4-luna6-20260923.json --out /etc/sotsiaalai/<uus-unikaalne-nimi>.json --budget-usd 4 --basis "..." --activate
sudo -n chown root:ubuntu <out>; sudo -n systemctl restart sotsiaalai-frontend
```

- `--out` peab olema uus fail `/etc/sotsiaalai/` all. Olemasolevat faili üle ei kirjutata.
- `--activate` varundab `rag.env`-i ja seab `M4_PILOT_ENABLED`, `M4_PILOT_CONFIG` ja `RAG_V2_ESTNLTK_IDLE_MS=3600000`.
- Plaani ID-s on minutitempel. Iga plaan saab oma kulupäeviku.
- Vestluse ajalugu filtreeritakse plaani `configHash` järgi. Pärast ümberehitust vanemad pöörded peituvad, kuid ei kustu. Sellise vestluse järgmine sõnum alustab uue teema ka valikuga „Jätkan sama teemat“ ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)).
- Pärast taaskäivitust soojendab server kirjeteta allikad mällu (1124 allikat, ~4,7 min), riiklikud õigustekstid esimesena. Soojendus algab serveri käivitusel (`instrumentation.js`, [ADR-033](adr-033-warm-up-at-server-start.md)), mitte esimesel küsimusel. Logis: `[rag-v2] start warm-up started`, siis `[rag-v2] warmed … sources`.

### Kus mis asub

| Mis | Kus |
| --- | --- |
| Sissevõtu tuum | `lib/rag-v2/` (`ingestion.js`, `parser.js`, `chunking.js`, `ingest-batch.js`, `ingest-publication.js`); KOV-adapterid `lib/rag-v2/adapters/` |
| Otsing | `lib/rag-v2/search/` (`postgres.js`, `qdrant.js`, `estnltk.js`, `profiles.js`, `retrieval.js`, `unified.js`, `structured-record-source.js`) |
| Vestluse tuum | `lib/rag-v2/pilot/` (`config.js`, `dialogue.js`, `search-assist.js`, `contracts.js`, `retrieval.js`, `provenance.js`) |
| HTTP ja kasutajaliides | `lib/chat/m4PilotServer.js`, `lib/chat/m4PilotClientContract.js`, `lib/chat/m4PilotIntent.js`; `app/vestlus/page.js`, `app/chat-source/page.jsx`, `components/alalehed/chat/` |
| CLI-d | `scripts/rag-v2-*.mjs` |
| Testid | `tests/rag-v2-*.test.mjs`; integratsioonitestid vajavad kohalikku PostgreSQL-i ja Qdranti |
| Otsused | see kaust, vt [dokumentide kaart](#dokumentide-kaart) |
| Allikad | `Andmebaasi/` ja `Andmebaasi/REGISTER.json` (Gitis) |
| Kohalik töö (`tmp/`, Gitis pole) | hoidla `tmp/rag-v2-corpus-store-v25` (vana pea varu `tmp/rag-v2-corpus-store-v25-backup-20260927`), partiid `tmp/rag-v2-corpus-batches-v26/`, indeksipoliitika `tmp/rag-v2-corpus-index-v26/policy.json` |
| Serveri töökaust | `/home/ubuntu/rag-v2-work/rag-v2-v25` (enne 27.09 `/home/ubuntu/apps/sotsiaalai/tmp/rag-v2-v25`): `run-v26.sh`, hoidla koopia `tmp/rag-v2-corpus-store-v25`, ostud ja vektorid `tmp/rag-v2-corpus-embeddings/usage/` |
| Serveri seadistus | `/etc/sotsiaalai/rag.env` (RAG v2 ühendused ja lülitid), `/etc/sotsiaalai/frontend.env`, vestlusplaanid `/etc/sotsiaalai/*.json`; SSH alias `sotsiaalai` |
| Serveri abiskriptid | rakenduse juurkaustast: `tmp/turn-status.mjs`, `tmp/chat-spend.mjs`, `tmp/restore-time.mjs`; hindamisetapid (sümlingid rakendusele, oma `lib`) `/home/ubuntu/rag-v2-work/eval-*`, tulemused `/home/ubuntu/rag-v2-work/eval-files/` |
| Arendustööriistad | `tmp/rag-v2-dev-2026-09-27/`: `law-check.mjs` (valitud allikad küsimuse kohta), `replay.mjs` (vastuse kordus salvestatud pööretel), `assist-eval-v26.mjs` (52 küsimust), `run-v26.sh`, `make-approval-v26.mjs`, `job.mjs`, `sizes.mjs`; seis `FACTS.md` ja `HANDOFF.md` |

### Lahtised tööd (27.09.2026)

- BM25 sõnaline järjestus ([ADR-029](adr-029-lexical-ranking-at-corpus-scale.md)) on ettepanek, tegemata.
- Tehtud 27.09 ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)): HMS jõuab vaidlustamise küsimusel valijani riikliku õiguse reservi kaudu (B9 sai HMS-i kahel jooksul kolmest); vana vestluse „Jätkan sama teemat“ ei anna pärast plaani uuendust enam `context_unavailable` viga.
- Vestluse kiirus: esimese pöörde külm allikakontroll (27.09 B9 ~45 s) on [ADR-033](adr-033-warm-up-at-server-start.md)-ga serveri käivitusel. Vastuse mudel (~10 s, `medium`) jääb põrandaks; vastuse voogedastus on tegemata.
- Tehtud 27.09: XML-i toores `<sup>` ja muutmismärked ([ADR-034](adr-034-riigi-teataja-xml-cleanup.md), korpus v27); B7 vastuse lõpus korduvad viited (PR #203).
- **Muudatusepõhine indekseerimine** ([ADR-036](adr-036-version-index.md)): serveris kasutusel alates v30; v32 lisas 39 dokumenti 2 min 43 s-ga. Avatud: mahupiir 60 000 tekstiosa põlvkonna kohta (mõõta ja tõsta), vestluse automaatne üleminek uuele põlvkonnale (tooteotsus), lisamise taustatöö.
- **Õigusaktide kehtivuse kontroll** ([ADR-038](adr-038-law-validity-check.md)): RT muudab kehtivusaegu pärast allalaadimist (27.09 oli 17 indekseeritud akti aegunud).
  - GitHub Actions võrdleb aktiivse korpuse akte RT-ga iga kuu 25. kuupäeval. Leiud lähevad ühte issue'sse.
  - Esimene jooks 27.09 leidis 2 muutust, mõlemad juba teada: RLS-i 31.10.2026 lünk ja SHS-i 2027. aasta redaktsioonid alates 01.02.
  - Manifest tehakse uuesti iga korpuse avaldamisel (runbook, samm 10).
- **Õigusaktide aastavahetus:**
  - SHS on kaetud kuni 31.01.2027 ja HMS alates 2027 (v31).
  - RLS on kaetud kuni 2027. aastani (v32), välja arvatud 31.10.2026. Selle päeva teksti pole RT avaldanud.
  - SHS-i veebruari tekst tuleb lisada enne 31.01.2027, muidu jääb see kehtivusreegli tõttu tõendist välja.
- Tallinna hooldajatoetuse kirje ja korra vastuolu (aruanne 3.3), E3.2 „tädi vajab sama“ (isikute eraldatus, omaniku otsus).
- Kirjete töötlus v26 (kontakti-ID-d indeksitekstist välja) ja kasutajapõhine hõivatuse värav enne mitme kasutaja kasutust.
- Dialoogistsenaariumide integratsioonitest vajab v25 kirjeüksuste vektoreid.

## Dokumentide kaart

### Otsused (ADR)

- [ADR-001](adr-001-local-ingestion.md) (05.09.2026, M1): eraldatav Node ESM tuum `lib/rag-v2`, PDF.js lapsprotsessis ja privaatne failihoidla. Andmemudel (`SourceAsset`, `DocumentVersion`, `SourceSpan`, `Chunk`) säilitab päritolu ja täpsed allikakohad.
- [ADR-002](adr-002-local-hybrid-search.md) (05.09.2026, M2.1): kohalik hübriidotsing eraldi PostgreSQL-i ja Qdranti compose-projektis, Prisma migratsioonid eraldi andmebaasile, muutumatud põlvkonnad, 8191-tokenine sisendipiir ja testvektorid.
- [ADR-003](adr-003-approved-embedding-pilot.md) (05.09.2026, M2.2): kompaktne mudelikontekst (`modelProjection()`, `reference_map`) ja omaniku loaga piiratud pärisembedding'u piloot: manifest, loakirje ja kulupäevik.
- [ADR-004](adr-004-multi-source-evaluation.md) (05.09.2026, M2): mitme allika kvaliteedikatse väikesel päriskorpusel. Ankrud on ainult hindajas, küsimused jagunevad arendus- ja kontrollosaks, vektoreid taaskasutatakse ainult kontrollitud ledger'ist.
- [ADR-005](adr-005-ranked-first-profiles.md) (05.09.2026, M2.3): versioonitud kontekstiprofiilid, kus põhileiud on eelisjärjekorras (`lib/rag-v2/search/profiles.js`). Naabrid saavad ainult vaba mahtu.
- [ADR-006](adr-006-private-http-pilot.md) (06.09.2026, M4): piiratud HTTP-sisepiloot. Serveri plaan (`M4_PILOT_ENABLED`, `M4_PILOT_CONFIG`), nimelised kasutajad, `M4PilotTurn` ja `M4PilotLedger`, Luna Responses API adapter ja kanooniline viitekontroll.
- [ADR-007](adr-007-source-dependencies.md) (07.09.2026, M3): valikulisest `metadata.knowledge` sisendist tehakse allikasse ankurdatud väited ja sõltuvused. Sõltuvusprofiil toob sihtväite teksti kaasa. Seis on `source_anchored_unreviewed`.
- [ADR-008](adr-008-source-knowledge-preparation.md) (07.09.2026, M3): haldaja koostab mudeliga väidete ja seoste mustandi. Valik salvestub uue muutumatu dokumendiversioonina.
- [ADR-009](adr-009-corpus-rebuild.md) (07.09.2026): kogu `Andmebaasi/` uus ingest. Algfailid jäävad, uus tuletatud andmekiht tekib nende kõrvale.
- [ADR-010](adr-010-source-structure-and-chunking.md) (07.09.2026): allika struktuur, metaandmed ja tekstiosad. Algfail on muutumatu, allikakoht on ühine PDF-ile, HTML-ile, XML-ile ja JSON-ile, tükeldus järgib struktuuri, vormingu tähendus on adapteris.
- [ADR-011](adr-011-resumable-intake-and-language-search.md) (23.09.2026): jätkatav sissevõtupartii PostgreSQL-is (`planIngestBatch`) ja ET/EN/RU tüvesid kasutav tekstiotsingu indeks. Tõend: [adr-011-local-evidence.json](adr-011-local-evidence.json).
- [ADR-012](adr-012-resumable-indexing.md) (23.09.2026): jätkatav indekseerimine (`planIndexJob`). Plaan on külmutatud, töö käib väikeste portsjonitena, poolik põlvkond ei asenda aktiivset.
- [ADR-013](adr-013-selective-retrieval.md) (23.09.2026): valikuline allikalaadimine. Põlvkonnas on dokumentide loend `rag-v2/retrieval-directory-1`; päring laeb ainult kandidaatide allikad.
- [ADR-014](adr-014-estnltk-retrieval.md) (23.09.2026): EstNLTK leksikaalne leping `pg-estnltk175-et-snowball311-en-ru-v1` päringus ja indeksis. Uute plaanide vaikeprofiil on `hybrid-estnltk-dependencies-v1`.
- [ADR-015](adr-015-opus-review-followup.md) (23.09.2026): KOV-i metaandmete tähendus (pealkiri, kuupäevad, `regions`), piirkonnafilter, vestluspäring ja lugemismaht pärast Opuse ülevaatust.
- [ADR-016](adr-016-structured-municipal-dialogue.md) (23.09.2026): struktureeritud KOV-kataloog (`StructuredRecordSource`, `rag-v2/structured-record-1`) on vestluse tõend. Kirjed on terviklikud, mitte top-k.
- [ADR-017](adr-017-verified-contact-export.md) (23.09.2026): kontrollitud kontaktiregistri kirjest saab uus muutumatu JSON-allikas (`prepareMunicipalContactExport()`).
- [ADR-018](adr-018-quoted-dialogue-state.md) (23.09.2026): vestluse seis (`dialogue_state`) tuleb samast vastusekutsest. Faktid kannavad kasutaja tsitaati, parandus asendab varasema kirje.
- [ADR-019](adr-019-unified-retrieval-and-periods.md) (23.09.2026): ühine tõendivalik. Teadmised, KOV-kataloog ja kuni kaks perioodi on ühes paketis ja ühes vastusekutses.
- [ADR-020](adr-020-municipality-scope-bibliography-periods.md) (24.09.2026): omavalitsus tuvastatakse kanoonilise nime järgi, artikli bibliograafia saab aasta, ajakirja, numbri ja leheküljed, perioodifilter kasutab aastat (`rag-v2/retrieval-directory-3`).
- [ADR-021](adr-021-compact-municipal-catalogue.md) (24.09.2026): kompaktne ja kohanduv KOV-kataloog `rag-v2/record-catalogue-2`: täisvaade, pealkirjade vaade või märgitud osaline loend.
- [ADR-022](adr-022-vector-weighted-hybrid-profile.md) (24.09.2026): RRF-i kanalikaalud on päringu parameeter. Profiil `hybrid-estnltk-vector2-dependencies-v1` annab vektorile kaalu 2.
- [ADR-023](adr-023-question-ranked-municipal-catalogue.md) (24.09.2026): KOV-kataloog järjestatakse küsimuse järgi. Asjakohasemad kirjed saavad kokkuvõtte.
- [ADR-024](adr-024-query-stopwords.md) (24.09.2026): päringu üldsõnad (`rag-v2/query-stopwords-1`). Kataloogis alati sees, põhiotsingus mõõdetud ja välja lülitatud.
- [ADR-025](adr-025-compact-record-model-context.md) (24.09.2026): KOV-kataloogi kompaktne mudelivaade. Auditipakett jääb täielikuks.
- [ADR-026](adr-026-semantic-municipal-catalogue.md) (24.09.2026): KOV-kataloogi järjestab pöörde päringuvektor, kui see on olemas. RRF lükati kataloogis tagasi.
- [ADR-027](adr-027-multi-source-retention.md) (24.09.2026): dokumendipiirang ja vektori lisakoht lükati tagasi. Soovitus on vektor ×2 ja 6 seemet; otsingu valikukood ei muutunud.
- [ADR-028](adr-028-production-answer-prompt.md) (24.09.2026): tootmise vastusjuhis `m4-grounded-answer-10`. `rag.env` on RAG v2 seadistusfail. Deploy kontrollib plaani värskust.
- [ADR-029](adr-029-lexical-ranking-at-corpus-scale.md) (25.09.2026, ettepanek): sõnaline järjestus korpuse mahul, soovitus on BM25 termitabel PostgreSQL-is koos keelepõhiste tüvedega. BM25 on tegemata; vestluse kiirem sõnaline järjestus (lihtne `ts_rank`, PR #187) ja üks ühendatud sõnaline päring (PR #193) tulid ADR-030 käigus.
- [ADR-030](adr-030-chat-retrieval-at-corpus-scale.md) (27.09.2026): vestlus kogu korpusel. Kirje tõend on väljavõte, kaardid on saledad, profiil on `hybrid-estnltk-chat-v1`, otsinguabi teeb plaani ja valiku, vestlusplaani teeb `scripts/rag-v2-chat-plan.mjs`. Lisaks kiirus ja ajaloo laadimine.
- [ADR-031](adr-031-source-level-and-answer-completeness.md) (27.09.2026): allika tase ja vastuse terviklikkus. Korpus v26 (SHS, HMS), `m4-grounded-dialogue-9`, kriisiriba, allikavaate link algallikale ja vastuse oma hääl (`m4-grounded-answer-11`). `rag-v2/search-assist-3` jääb katseks.
- [ADR-032](adr-032-national-law-reserve-and-plan-restart.md) (27.09.2026): riikliku õiguse reserv valiku kandidaatides (`poolReserve`, 6 kohta, aktist kuni 2) ja „Jätkan sama teemat“ pärast vestlusplaani uuendust alustab uue teema.
- [ADR-033](adr-033-warm-up-at-server-start.md) (27.09.2026): teadmusallikate soojendus algab serveri käivitusel (`instrumentation.js` → `warmPilotAtStart()`), riiklikud õigustekstid esimesena; `preflight` jääb varuks.
- [ADR-034](adr-034-riigi-teataja-xml-cleanup.md) (27.09.2026): Riigi Teataja XML-i puhastus (`source-structure-v26`) ja korpus v27; uuesti sisestati ainult 61 XML-akti, vektoreid osteti 1359 (0,075 USD).
- [ADR-035](adr-035-record-links-and-shs-versions.md) (27.09.2026): allikaregistri lingid 576 lingita KOV-kirjele (korpus v28, ost 0) ja SHS-i kehtivad redaktsioonid 12.06–30.09 ning 01.12–31.12.2026 (korpus v29, 0,006 USD); kontrollikuupäeva juhis v12 lükati mõõtmise järel tagasi.
- [ADR-037](adr-037-release-chat-plan.md) (27.09.2026): väljalase ja vestlusplaan lähevad käiku koos. Deploy uuendab aegunud plaani uuele koodile (sama kinnituse ulatus), kontrollib seda mudelikutseta enne põhimigratsiooni ja taastab ebaõnnestumisel eelmise koodi koos plaaniga.
- [ADR-036](adr-036-version-index.md) (27.09.2026): muudatusepõhine indekseerimine. Tekstiosad ja punktid kuuluvad dokumendiversioonile ja otsinguseadistusele (`versions-v1`); uus põlvkond töötleb ainult uued või muutunud versioonid ja loetleb ülejäänud.
- [ADR-038](adr-038-law-validity-check.md) (27.09.2026): õigusaktide kehtivuse igakuine kontroll Riigi Teataja vastu. Kontroll võrdleb akti-ID-sid ja kehtivusi, vaatab kõik redaktsioonid ja kehtetuks tunnistamise märked ning teatab lüngad ja kattuvused päeva täpsusega. Leiud lähevad issue'sse, päringu tõrge teeb töö punaseks.

### Runbook ja aruanded

- [runbook-corpus-increment.md](runbook-corpus-increment.md): korpuse täiendamine allikast vestlusplaanini, koos käskude ja lõksudega.
- [Vestluse vastuvõtutest 27.09.2026](../audits/rag-v2-chat-acceptance-2026-09-27.md): 71 küsimust kasutajaliideses. ADR-031 järgib selle parandusi 2, 4 ja 6.
- [Codexi kontrolli leiud 27.09.2026](../audits/rag-v2-codex-review-2026-09-27.md): õigusaktide kehtivus, omavalitsuse ulatus ja v26/v27 fikseeritud sisendiga võrdlus (`scripts/rag-v2-generation-compare.mjs`).
- [repository-audit.md](repository-audit.md): M0 repositooriumi kaart (05.09.2026).
- [dialogue-scenarios-2026-09-24.md](dialogue-scenarios-2026-09-24.md): vestluskäigu stsenaariumid (24.09.2026).
- `journal-*`, `ingest-runtime-snapshot-2026-09-07.json`, `m1-source-acceptance-2026-09-08.json`, `release-integration-2026-09-08.json`, `server-corpus-comparison-2026-09-07.json`: 07.–08.09.2026 mõõtmis- ja võrdlusfailid.
- Teised RAG v2 auditid: `docs/audits/rag-v2-*.md`.

## Kohalik sissevõtt ja M2 (september 2026, ajalooline kasutusjuhend)

See osa oli varem faili pealkirja „Kohaliku RAG v2 sissevõtu kasutamine“ all. See kirjeldab septembri alguse kohalikku sissevõtu CLI-d ning M2 katseid. Käsud kehtivad kohaliku arenduse jaoks. Korpuse praegune töövoog on ülal ja runbookis.

See CLI võtab ühe haldaja PDF-i ja JSON-metaandmed vastu ilma väliste mudelikutseteta. Tehniline kaart: [M0 audit](repository-audit.md); andme- ja avaldamisleping: [ADR-001](adr-001-local-ingestion.md); tüübid: `lib/rag-v2/types.d.ts`; käitusaegne valideerimine: `lib/rag-v2/contracts.js`. Aktiivne seis asub ainult [SotsiaalAI.md](../platvormi%20arendus/SotsiaalAI.md) S1.0-s.

### Käivitamine

Node 24 ja `npm ci` repositooriumi lukufaili põhjal. Järgmine PowerShelli käsk on põhikausta `SotsiaalAI` jaoks. Sama CLI läbis näidise sissevõtu parandustööpuus enne koodi muutmata integreerimist `main`-i. Sisendeid ei pea teise tööpuusse kopeerima.

```powershell
node scripts/rag-v2-ingest.mjs --input-root 'docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs' --metadata sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos.json --tenant sotsiaalai-development --store tmp/rag-v2-sample --development-only
```

`--input-root`, `--metadata`, `--tenant`, `--store` ja `--development-only` on kohustuslikud. `source_path` metaandmetes lahendatakse ainult lubatud sisendjuure sees; absoluutne tee, `..` ja juurest väljuv sümbollink/junction lükatakse tagasi. UTF-8 failinimed on toetatud. Väljavõtete HTML ja JSON võivad sisaldada kogu algteksti: hoia `--store` privaatses, Gitist ignoreeritud kataloogis (siin `tmp/`), mitte `public/` all.

`--profile FILE.json` lubab teise deklaratiivse valdkonnaprofiili. Profiili kuju: `id`, `version`, valikulised `months`, `categoryLabels`, `assetReviews`. Profiil ei sisalda käivitatavat koodi. `--config FILE.json` lubab muuta piiranguid, näiteks `{"chunkMaxChars":1800,"maxPages":100}`. Vaikeväärtused on `DEFAULT_CONFIG`-is; tundmatud valikud ja toetamata töötlusversioonid annavad vea. OCR ja keelemudeliga rikastamine puuduvad.

Väljundkonsool näitab ainult töö tunnuseid, mahtusid, hoiatuste koode ning väljundkausta. Vead ei väljasta lähtefaili sisu. CLI tagastab vea korral väljumiskoodi 1. `--development-only` kirjeldab selle kohaliku töö kasutuspiiri; see ei loo avaldamisluba ega anna kasutajale platvormi admini õigusi.

### Väljundi lugemine

`<store>/tenant_<hash>/active.json` on aktiivse põlvkonna manifest. Selle `documents` kaart viitab `versions/version_<hash>/` muutmatutele versioonidele:

| Fail | Sisu |
| --- | --- |
| `original.pdf`, `metadata.json` | Sisendite täpsed muutmata baidid |
| `bundle.json` | Dokumendi-, versiooni-, õiguste-, tekstielementide-, leheteksti-, allikakoha-, lõigu-, peatüki-, tekstiosa- ja seosteregister |
| `provenance.json` | Normaliseeritud väljade masinloetav päritolukaart |
| `spans.json` | PDF-lehed, täpsed tekstivahemikud ja koordinaadid |
| `chunks.json` | Alg- ja otsingutekst, allikakohad, peatükk, naabrid ning embedding-sisendi räsi |
| `report.html` | Kohalik inimloetav ülevaade koos PDF-lehe linkidega |
| `manifest.json` | Kõigi versioonifailide SHA-256 kontrollsummad |

`jobs/<attempt>.json` eristab `received`, `validated`, `parsed`, `staged`, `published`, `failed`. Kordusimport võib juba kontrollitud versiooni taaskasutada ilma parserita. `usable_with_warnings` on sisulise kvaliteedi seis, mis ei võrdu töö avaldamisoleku ega kõigi väidete kinnitamisega.

### Taaskäivitamine ja taastamine

Tavalise vea järel paranda sisend ja käivita sama käsk uuesti. Aktiivset manifesti ei muudeta enne kõigi uue versiooni osade valmimist. Vanad versioonid säilivad, et varem antud viide ei muutuks vaikselt uueks tekstiks. Kustutamise/säilituse ning kliendi ligipääsu tühistamise API lisandub enne pärisandmetega ühendamist.

Kui protsess katkestati jõuga ja CLI ütleb `catalog_busy`, kontrolli täpsest tenant-kaustast `writer.lock` faili PID-d ning kinnita operatsioonisüsteemist, et vastav töö enam ei käi. Alles siis eemalda **see üks** lukufail; ära lõpeta tundmatut protsessi ega kustuta aktiivset registrit. `staging-*` orvud ei kuulu aktiivsesse kogusse ja võivad kuni eraldi hoolduseni alles jääda. Algallikaid ega versioone taastamiseks üle ei kirjutata.

Enne hoidla failitaseme varundamist peata selle CLI kirjutused ja kopeeri **kogu** tenant-kaust privaatsesse asukohta. Taastamisel säilita versioonid, originaalid, manifest ja tööjäljed koos. Kontrolli taastatud versioonide räsid `loadVersion()` abil enne kasutamist. See on M1 lokaalne protseduur; päris varundus-taastamiskatse ja tootmise reindekseerimine on M6 vastuvõtuväravad ning selle tööga `NOT_PROVEN`.

### Sihttestid ja tõendi piir

```powershell
$env:TZ = 'UTC'
$env:RAG_V2_INPUT_ROOT = 'C:/Users/rauds/Desktop/Sotsiaal.ee/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs'
node --test tests/rag-v2-ingest.test.mjs
```

Testifail katab paketi I-01…I-15 ning konkreetseid M1 riske: duplikaadikonflikt, versiooniviited, muutumatu embedding-sisend, teise profiili eraldatus, registri/versiooni rikkumine, piirangud, failitee junction ja päisega sama sisuteksti säilimine. Päris PDF-i testid vajavad ülaltoodud sisendjuurt; selle puudumisel on need ausalt `skip`, mitte roheline artiklitõend. Sünteetilised parserinäited on testikoodis eraldi ning neid ei lisata näidisartiklisse ega päriskorpusse. Test teeb oma ajutisse kausta sissevõtud ja koristab ainult selle kausta.

PDF lk 1, 3, 5, 8, 12 ja 13 renderdati ning vaadati üle: pealkiri/kuupäev, neli põhialapealkirja ja suletud „Viidatud allikad” ala vastavad ingest'i kasutatud alustele. Üks artikkel ei tõenda teiste failitüüpide, tabelite, OCR-i, semantilise graafi, mitmekeelse otsingu ega kümne aasta korpuse kvaliteeti.

Väike staatiline värav:

```powershell
npx eslint lib/rag-v2/contracts.js lib/rag-v2/pdf-worker.js lib/rag-v2/parser.js lib/rag-v2/normalize.js lib/rag-v2/catalog.js lib/rag-v2/ingestion.js scripts/rag-v2-ingest.mjs tests/rag-v2-ingest.test.mjs
git diff --check
```

Peatüki lõpus kasutatakse projekti tavalist `npm run build` käsku (sisaldab `i18n:check`). Prisma valideerimist pole selle ploki tõttu vaja, sest skeemi ega migratsioone ei muudeta. Autenditud admini-, kasutaja-, privaatsus- ja DB-radu see test ei tõenda ega asenda admini käsitsi RAG-enesetesti.

### M2.1: kohalik PostgreSQL + Qdrant

[ADR-002](adr-002-local-hybrid-search.md) kirjeldab põlvkondi, õigusi, tokenipiiri, kanaleid ja tõendi piire. Otsingutuuma kood on `lib/rag-v2/search/`; HTTP-otsing, chat ja admini enesetesti `retired` olek jäävad selle plokiga muutmata.

Docker peab töötama. Järgmised käsud on käivitatud põhikaustas:

```powershell
node scripts/rag-v2-local.mjs up
node scripts/rag-v2-local.mjs migrate
node scripts/rag-v2-local.mjs validate
```

`up` loob eraldi `sotsiaalai-rag-v2` compose-projekti, teenused ja andmeköited. PostgreSQL 16.15 kuulab ainult `127.0.0.1:55432`, Qdrant 1.19.1 ainult `127.0.0.1:56333`. Pildid on digestiga lukustatud ja konteinerid käivituvad pärast masina taaskäivitust uuesti. Qdranti uuendatakse ühe alamversiooni kaupa (1.15 → 1.16 → 1.17 → 1.18 → 1.19), iga sammu järel kontrollitakse kogusid ja punktide arvu. Paroolid/võti genereeritakse kohalikku ignoreeritud `tmp/rag-v2-services/` kausta; neid ei lisata Gitti. `migrate` kasutab Prisma eraldi kohalikku konfiguratsiooni ega loe platvormi `DATABASE_URL` väärtust. `stop` peatab ainult need teenused ja säilitab köited. Olemasoleva platvormi konteinerid jäävad puutumata.

Kohalik usaldatud poliitikafail kirjeldab eksplitsiitselt tenant'i, operaatorit ja lubatud dokumendi-ID-sid. Näidise jaoks on kasutatud `tmp/rag-v2-services/sample-policy.json`:

```json
{
  "tenants": {
    "sotsiaalai-development": {
      "operator": ["document_a360b102f9ca757e85023f68a1b0c87606f9a1f2c059e0e5743665b0b2e4274b"]
    }
  }
}
```

See on kohaliku arendusoperaatori luba, mitte veebikasutaja autentimine ega materjali välisele mudeliteenusele saatmise luba. Loendi tühjendamine tühistab selle operaatori ligipääsu; päring loeb poliitika uuesti vahetult enne tõenduspaketi tagastamist. Teise tenant'i tunnus ei anna ligipääsu.

Indekseeri M1 aktiivne lubatud versioonipilt ja tee päring:

```powershell
node scripts/rag-v2-search.mjs --mode index --tenant sotsiaalai-development --subject operator --store tmp/rag-v2-sample --policy tmp/rag-v2-services/sample-policy.json --development-only
node scripts/rag-v2-search.mjs --mode retrieve --tenant sotsiaalai-development --subject operator --policy tmp/rag-v2-services/sample-policy.json --query OTT --language et --output tmp/rag-v2-query --development-only
```

CLI väljastab tunnused, loendused ja ajamõõtmised; algtekst läheb ainult privaatsesse `evidence.json` ja `evidence.html` faili. `--graph` lisab piiratud struktuurse naabrilaienduse. Täpsemad eelarve-, piirkonna- ja ajafiltrid on tuuma `retrieve()` liideses (`types.d.ts`); need ei ole selle CLI vaikimisi oletused. Päringu väljund on tõenduspakett, mitte mudeli koostatud vastus. Teenuste versioonid, platvorm ja `measured_query_runs=1` salvestatakse paketi mõõtmistesse. Üks mõõtmine ei ole p95 ega koormustest.

`--connections FILE.json` saab määrata teise kohaliku ühendusfaili, kuid adapter aktsepteerib endiselt ainult ülaltoodud määratud sihtkohti. Tõrge ei tohi suunata päringut avalikku või tootmisteenusesse. CLI `retrieve` kirjutab ainult `tmp/` alla.

Katkestatud indeksit saab sama `--mode index` käsuga jätkata. Vana aktiivne põlvkond säilib kuni kõigi uute andmete kontrollini. `superseded_index_job` tähendab, et uuem töö on juba registreeritud; vana töö ei aktiveeru selle asemel. Vanu PostgreSQL-i põlvkondi, Qdranti kollektsioone ega M1 versioone ei kustutata automaatselt. Lokaalse hoolduse korral peata indekseerijad/pärijad ning võrdle kõigepealt iga tenant'i `rag_v2_head.active_id` väärtust; aktiivset ega pooleliolevat põlvkonda ei kustutata. Käesolev plokk ei paku üldist kustutuskäsku ega tõenda tootmise retention'it.

M2.1 sihttestid kasutavad olemasolevat Node'i testikäivitajat:

```powershell
$env:TZ = 'UTC'
$env:RAG_V2_INPUT_ROOT = 'C:/Users/rauds/Desktop/Sotsiaal.ee/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs'
node --test tests/rag-v2-ingest.test.mjs
node --test tests/rag-v2-search.test.mjs tests/rag-v2-search.integration.test.mjs
```

Integratsioonitesti nimi tähendab päris PostgreSQL-i ja Qdranti. Ühendusfaili, teenuse või näidis-PDF-i puudumisel see test ebaõnnestub; neid ei asendata rohelise mock-tulemuse või vaikse skip'iga. Teenuseadaptrite võrku lubatakse ainult määratud kahele kohalikule pordile. Ühiktestide võrk on keelatud. Sünteetilised aiandus-/eksitusdokumendid kasutavad eraldi juhuslikke testtenant'e ning koristatakse pärast jooksu, säilitades operaatori näidise.

Testid katavad failiregistri/DB võrdsust, tegelikke kanalifiltreid, katkestust ja taaskäivitust, vana töö hilist aktiveerimist, päringu ajal uue dokumendiversiooni avaldamist, õiguste tühistamist, vektorruumi/tokenipiire, Unicode'i, RRF-i, tsitaatide kanoonilist lahendamist, piiratud graafilaiendust, ET/EN/RU `simple` tokenizer'it, teenusetõrke olekuid ning rikutud põlvkonna/allika/Qdranti viite tõrjumist. R-01 ja R-04 kontrollivad leksikaalset allikakohta ja bibliograafiat; R-02/R-03 semantilist ja mitmekeelset rada kontrolliti hiljem piiratud M2.2 pärispiloodis. API-võtme olemasolu ei käivita testides mudelikutset.

M2.1 staatiline värav ja peatüki build:

```powershell
npx eslint lib/rag-v2/search/*.js lib/rag-v2/parser.js lib/rag-v2/pdf-worker.js scripts/rag-v2-search.mjs scripts/rag-v2-local.mjs scripts/rag-v2-evaluation-plan.mjs tests/rag-v2-search.test.mjs tests/rag-v2-search.integration.test.mjs prisma/rag-v2/prisma.config.mjs
node scripts/rag-v2-local.mjs validate
git diff --check
npm run build
```

### M2.2 prooviplaani valmistamine ilma väliskutseteta

```powershell
node scripts/rag-v2-evaluation-plan.mjs --store tmp/rag-v2-sample --tenant sotsiaalai-development --subject operator --policy tmp/rag-v2-services/sample-policy.json --output tmp/rag-v2-query/m2-2-plan.json
```

`tests/evaluation/rag-v2-queries.json` sisaldab seitset pärisartikli küsimust (sh OTT-i ja dokumenteerimise ET/EN/RU perekonnad) ning kaht praeguses korpuses vastuseta küsimust. Oodatud allikakohti määravad artikli PDF-räsi, leht ja algteksti fraas, mitte praeguse järjestaja tulemused. Plaan lahendab need konkreetseteks SourceSpan ID-deks. Sünteetiliste õiguste-/mehaanikatestide tähendus ei kandu pärisartikli kvaliteedihinnanguks.

Plaan arvestab `text-embedding-3-large`, 3072 mõõdet, iga sisendi tegelikke tokeneid, külma vahemälu ja ühte katset sisendi kohta, ilma korduskatseteta. Genereerivaid kutseid on 0. Valikuline `--prices FILE.json` võtab `input_per_million`, `currency` ja `version` väljad; hinnata on rahaline kulu **teadmata**, mitte null. Hinnang ei ole omaniku kinnitatud kulupiir. Enne päris M2.2 käivitust peab omanik kinnitama nii plaanis nimetatud materjalide saatmise välisele teenusele kui ka konkreetse kulupiiri. Selle plaani generaatoris pole välist mudeliadapterit ega käivituskäsku.

### M2.2 ehitus, audit ja piiratud piloot

[ADR-003](adr-003-approved-embedding-pilot.md) määrab täieliku auditi, kompaktse mudelikonteksti, struktuurse rolli ning loa-/kulupäeviku lepingu. Varasem ettevalmistusgeneraator jääb alles; päriskatse eraldi käsk on `scripts/rag-v2-pilot.mjs`.

Vaikimisi tehakse **ainult kuivjooks**:

```powershell
node scripts/rag-v2-pilot.mjs
```

Vaikesisendid on M1 näidishoidla, `sample-policy.json`, vana `m2-2-plan.json`, `evidence.json` ning muutmata üheksa küsimusega fail. Kuivjooks võrdleb kõiki sisendiräsisid ja tokeniarve algse plaaniga ning kirjutab privaatsesse `tmp/rag-v2-m2-2/` kausta väljasaatmismanifesti, ankrurühmad, säilitatud vana auditi, konteksti enne/pärast võrdluse ja kompaktse näidise. API-võtit ei nõuta ja väliskutseid ei tehta.

Päriskatse vajab omaniku tegeliku kinnituse alusel koostatud `rag-v2/pilot-approval-1` loakirjet ja värskelt kontrollitud hinnakirjet. Need on privaatsed käitusfailid, mitte Gitti lisatavad mallid. Võtit ei kirjutata loakirjesse ega käsureale; see loetakse `OPENAI_API_KEY` keskkonnamuutujast (või kohalikust `.env.local` failist).

```powershell
node scripts/rag-v2-pilot.mjs --execute --approval tmp/rag-v2-m2-2/approval.json --price tmp/rag-v2-m2-2/price.json
```

Omanik kinnitas 05.09 vestluses olemasoleva 16 tekstiosa + 9 küsimuse plaani, kuni 25 katset, kuni 12 420 sisendtokenit ja kuni 0,05 USD, automaatsete korduste ning Luna kutseteta. Sama vestlus lubas GitHubi kaudu serveri uuendamise ja katse serveris. See tekst dokumenteerib antud loa ulatust; käivitus kontrollib lisaks konkreetse manifesti räsi, tegelikku loakirjet, praegust poliitikat ja hinda. Uus tekst, mudel või ulatus ei päri seda luba.

`usage/pilot_<hash>/ledger.json` säilitab sama manifesti katsete, tokenite ja nanodollarite reserveeringud ka protsessi taaskäivitamisel. `unknown` või alles `reserved` kirje järel automaatset uut katset ei tehta. Edukad vektorifailid kontrollitakse räsiga üle. Päevikut, vektorifaile ega `pilot.lock` lukku ei kustutata limiidi lähtestamiseks; mahajäänud luku puhul kontrollitakse enne ainult selle töö PID-d. Materjali õiguse muutus kontrollitakse enne iga väliskutset.

Pärast kõigi 25 sisendi edukat salvestamist indekseeritakse vektorid PostgreSQL-i/Qdranti eraldi `real` põlvkonda. Nelja meetodi 36 võrdlusrida kasutavad samu salvestatud päringuvektoreid. Leksikaalne rada ei loe päringuvektorit. `pilot-results.json` ja `pilot-report.html` esimene tulemus säilib; kordus ei kirjuta seda üle ega tee uusi embedding-kutseid. Halb tulemus raporteeritakse juhtumina, kuldmärgendeid ei muudeta selle varjamiseks.

Kontrollid:

```powershell
$env:TZ = 'UTC'
$env:RAG_V2_INPUT_ROOT = 'C:/Users/rauds/Desktop/Sotsiaal.ee/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs'
node --test tests/rag-v2-ingest.test.mjs tests/rag-v2-search.test.mjs tests/rag-v2-search.integration.test.mjs tests/rag-v2-pilot.test.mjs
npx eslint lib/rag-v2/search/*.js scripts/rag-v2-pilot.mjs tests/rag-v2-pilot.test.mjs tests/rag-v2-search.integration.test.mjs
git diff --check
npm run build
```

Tavalised testid kasutavad välise transpordi asendust, kuid PostgreSQL/Qdrant integratsioon on päris. API-kulu arvestatakse ainult eraldi lubatud käivitusel. M2.2 lisas olemasolevale integratsioonitestile 3072-mõõtmelise transpordifikstuuri, nelja raja võrdluse ja tegeliku Qdranti vektorisisu rikkumise kontrolli. Testtranspordiga tulemus ei saa semantilise kvaliteedi kinnitust.

#### 05.09 piiratud pärispiloodi tulemus

Serveris tehtud kinnitatud piloot kasutas 16 muutmata tekstiosa ja 9 küsimust. Kõik 25 `text-embedding-3-large` katset õnnestusid ühe saatmisega sisendi kohta; lokaalne ja API raporteeritud tokeniarv oli 12 420 ning hinnaga 0,13 USD miljoni sisendtokeni kohta oli arvestuslik kulu 0,001614600 USD. Genereerivaid ja Luna kutseid oli 0. Korduskäivitus kasutas räsiga kontrollitud salvestatud vektoreid ning tegi 0 uut API-katset.

Kuue ET/EN/RU sisuküsimuse nõutud allikakohad olid hübriidraja lõppkontekstis 6/6 ja top-1-s 6/6, pärisvektorraja lõppkontekstis 6/6 ning leksikaalses rajas 4/6. Struktuurne laiendus käivitus 9/9, kuid selle eraldi kvaliteedilisa ei ole selle valimiga tõendatud. Lõplik M0–M2.2 komplekt koos turvaparandustega läbis kohalikult ja serveris 57 testi, 0 vea ning 0 skip'iga. Täielik ulatus, turvaauditi leiud ja piirid on [M0–M2.2 auditis](../audits/rag-v2-m2-2-audit-2026-09-05.md).

Serveri käitus kasutab sama koodi GitHubist. Kohalikud algmaterjalid ja privaatsed loakirjed/väljundid viiakse serveri privaatsesse `tmp/` hoidlasse eraldi; neid ei avaldata Git-repositooriumis. Serveri `OPENAI_API_KEY` jääb `/etc/sotsiaalai/frontend.env` seadistusse. Uued konteinerid on seotud ainult loopback-portidega; olemasolev platvormi andmebaas jäi eraldi. Vana RAG-i/research-worker'i teenused on `inactive/disabled` ning frontendi unit ei sõltu neist enam. Rakenduse chat ja käsitsi enesetest jäävad M4 ühenduseni ausalt `retired` olekusse.

### M2 mitme allika järelkatse

[ADR-004](adr-004-multi-source-evaluation.md) kirjeldab hindaja ja vektorite taaskasutuse piiri. Valitud korpus, küsimused, arendus-/kontrolljaotus ning ankrurühmad on `tests/evaluation/multi-source/` all; alg-PDF-e sinna ei kopeerita. Korpuse JSON ei anna väljasaatmisluba.

05.09 kohaliku ettevalmistuse tegelikud arvud, parserileid ja privaatsed artefaktid on [mitme allika ettevalmistuse auditis](../audits/rag-v2-multi-source-preparation-2026-09-05.md).

Iga kuivjooks kasutab uut privaatset väljundkausta. `--reuse` viitab varasema lõpetatud piloodi ledger'i kaustale, mille manifest, kirjed ja vektorifailid kontrollitakse enne taaskasutuse arvestamist.

```powershell
node scripts/rag-v2-multi-source.mjs `
  --output tmp/rag-v2-multi-source/preparation-1 `
  --reuse <verified-ledger-directory> `
  --price <current-verified-price.json>
```

`--mechanics` indekseerib samad pärisallikad deterministlike testvektoritega päris kohalikku PostgreSQL-i/Qdranti ja genereerib kõik neli raportirada. See kontroll ei tõenda semantilist kvaliteeti ega tee väliskutseid. PDF-i tekstikihi NUL-glüüf asendatakse enne püsistamist nähtava `U+FFFD` märgiga, algne parseri item-kiht jäetakse bundle'ist välja ning raport saab `pdf_nul_replaced` hoiatuse.

Pärisjooksu kululegeri juur on alati `tmp/rag-v2-multi-source/usage`; `--output` muudab ainult immutable raportikausta. Sama manifesti uus raportikaust ei lähtesta katsete, tokenite ega kulu arvestust.

Pärisjooks vajab kuivjooksu muutumatut `evaluation-plan.json` faili, täpselt selle egress-manifesti kinnitavat `rag-v2/pilot-approval-1` loakirjet ja käivituse hetkel kehtivat hinnakirjet:

```powershell
node scripts/rag-v2-multi-source.mjs `
  --output tmp/rag-v2-multi-source/run-1 `
  --reuse <verified-ledger-directory> `
  --price <current-verified-price.json> `
  --baseline <evaluation-plan.json> `
  --approval <approved-manifest.json> `
  --execute
```

Kui üks räsi, allikaversioon, küsimus, taaskasutuskviitung, mudel või limiit muutub, lükkab käivitus baseline'i tagasi enne saatmist. Ankrud ja vastatavuse sildid ei kuulu egress-manifesti ega päringu filtritesse.

05.09 pärisjooks lõpetas 73/73 uut embedding-katset 23 554 tokeni ja 0,003062020 USD arvestusliku kuluga. Pärisvektori rada sai vajaliku täieliku sisutoe 15/18, hübriid 13/18, struktuurirada 11/18 ja leksikaalne 7/18 juhtumis. Fikseeritud püsilegeri järelkordus tegi 0 API-kutset. Juhtumid, regressioon ja järgmise paranduse piir on [mitme allika auditis](../audits/rag-v2-multi-source-preparation-2026-09-05.md).
