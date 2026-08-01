# Golden-37 mini baasjoone freeze

Staatus: **fikseeritud enne esimest baasvastust**.

## Fikseeritud artefaktid

| Artefakt | Tee | SHA-256 | Päritolucommit |
|---|---|---|---|
| küsimustik | `eval/golden-rag-v1.json` | `3a47407ce93fbf9fc7cdb33f9f2e3bcc05b0ad0bef788e184e03580b4df50089` | `64a24eb4a2fc406fb6eb7ae938511f88259a8921` |
| olemasolev runner | `scripts/run-golden-eval.mjs` | `2a6d231f75e536bbdf187dc68b1618e063f278dddf46ed397981fbde055a5a32` | `64a24eb4a2fc406fb6eb7ae938511f88259a8921` |
| olemasolev põhirubriik | `docs/internal/luna-rag-blind-test-key.md` | `45cf2c7a4a289da7b4d258e76910db8b6a1874894c5684266ce64614e1ecf5bb` | `d068c519b5c87ca68f85c3f3beb24b44c6ccd71c` |
| normaliseeritud hindamisvorm | `docs/internal/golden-37-mini-evaluation-form.md` | `414b9102b12171b8f41f9c23c0305224bac95c53a5887caf9170b7b3eefb1f4d` | käesolev branch |

Faili kirjeldus ütleb ajalooliselt „25”, kuid tegelik ja runner’i poolt loetud massiiv sisaldab 37 unikaalse ID-ga kaasust. Baasjoone nimi on seetõttu **Golden-37**. Eraldi `tests/fixtures/rag-golden-set.json` 20-kaasuseline skeemifixtuur ei ole selle live-jooksu küsimustik.

## Küsimuste fikseeritud järjestus

1. `kov_kuusalu_koduteenus`
2. `kov_harku_sotsiaaltransport`
3. `kov_kuusalu_vormid`
4. `kov_leakage_guard_narva`
5. `legal_shs_42`
6. `legal_shs_17`
7. `legal_inflected_paragraph`
8. `ajakiri_overview_lastekaitse`
9. `ajakiri_overview_omastehooldus`
10. `ajakiri_ai_eetika`
11. `ajakiri_sloveenia_hooldus`
12. `pdf_hea_tava_terviseprobleemiga_laps`
13. `pdf_eestkoste_uuring`
14. `pdf_vaimne_tervis_koolis`
15. `pdf_tarkvanem_tooleht`
16. `org_astangu`
17. `org_puudega_inimese_abi`
18. `life_raha_uur_toit`
19. `life_eakas_kodus`
20. `comparison_kodu_tugiisik`
21. `comparison_kodu_isiklik_abistaja`
22. `edge_inflected_tugiisikuteenusel`
23. `edge_crisis`
24. `pdf_abivajav_laps_andmekaitse`
25. `pdf_opilase_toetamine_koolis`
26. `pdf_marac_mudel`
27. `pdf_vaesus_statistika`
28. `pdf_lapse_heaolu_hindamine`
29. `edge_followup_paragraph`
30. `edge_no_corpus_answer_v2`
31. `pdf_inimkaubandus_ennetus`
32. `pdf_kubervagivald_ohver`
33. `pdf_hoolekande_kvaliteet`
34. `pdf_toovoime_reform`
35. `graph_kov_vormid_kontaktid`
36. `ajakiri_integreeritud_teenused`
37. `ajakiri_kinnise_lasteasutuse_alternatiiv`

Kõik kaasused kasutavad olemasoleva runner’i vaikimisi `SOCIAL_WORKER` rolli. `edge_followup_paragraph` on ainus mitmevooruline kaasus: sellele antakse küsimustikus fikseeritud kahe sõnumiga ajalugu. Ülejäänud kaasused käivitatakse eraldi uue, `persist:false` vestlusena.

`edge_no_corpus_answer_v2` on tahtlik korpusevälise küsimuse kontroll: oodatud on aus piirang, mitte väljamõeldud Saksamaa hind. Muude kaasuste explicit `displayed_must_include` allikaankrud kontrollitakse enne jooksu tootmise `/documents` registri vastu; paragrahviankrud kontrollitakse täiendavalt RAG-service’i täpse `national_law` paragrahviotsinguga, sest dokumendiregistris on seadus ühe koondpealkirja all. Küsimuste teksti, rolli, ajalugu ega järjestust pärast vastuste nägemist ei muudeta.

## Fikseeritud tootmisbaas

```text
model = gpt-5.4-mini
reasoning = low
verbosity = medium
max_output_tokens = 1100
CHAT_PROMPT_TOKEN_AUDIT = 0
retrieval timeout = 12000 ms
```

Smoke-kaasused on enne tulemuste nägemist fikseeritud: lihtsam `legal_shs_17` ja keerukam mitme allikaga `ajakiri_overview_lastekaitse`. Mõlemad korratakse hiljem Golden-37 täisjooksus.

Jooks on järjestikune (`concurrency=1`) ning päringute vahe on kaks sekundit. Tehnilise vea puhul on lubatud üks eraldi `technical_retry`; incomplete, nõrka, nullallikaga edukat või aeglast edukat vastust ei korrata.
