# Mõõtmise andmepakett

`eval-data-2026-09-24.tar.gz` (6,8 MB) sisaldab andmeid, mida `scripts/rag-v2-query-variants.mjs` vajab 05.09 ja holdout-2 tabelite kordamiseks ilma tasuliste kutseteta:

- 05.09 vastu võetud korpuse kaheksa versiooni: bundle'id ja allika-PDF-id täpselt sellisena, millest salvestatud vektorid arvutati. Praegune kood tükeldaks samu PDF-e teisiti (vt ADR analüüs §11), seepärast ei saa neid `docs/` PDF-idest uuesti luua.
- Salvestatud päris korpusevektorid (`text-embedding-3-large`, 3072) ja holdout-2 30 päringuvektorit.

```bash
node scripts/rag-v2-eval-data.mjs unpack
node scripts/rag-v2-query-variants.mjs --set 05-09 --set holdout-2 --query-vectors tmp/rag-v2-multi-source/holdout-2-query-vectors.json
```

`unpack` kontrollib arhiivi ja iga lahtipakitud faili SHA-256 räsi (`eval-data-2026-09-24.manifest.json`).

Lisaks andmetele on vaja kohalikku Postgres'i (`tmp/rag-v2-services/connections.json`, `scripts/rag-v2-local.mjs`) ja EstNLTK keskkonda (`RAG_V2_ESTNLTK_PYTHON`, `lib/rag-v2/search/estnltk-requirements.txt`).
