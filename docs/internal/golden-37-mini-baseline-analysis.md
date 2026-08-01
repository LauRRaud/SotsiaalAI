# gpt-5.4-mini Golden-37 tehniline baasraport

Jooksuaken: 2026-08-01T10:05:46.355Z kuni 2026-08-01T10:15:23.856Z. Tootmise kood: `13cfe8605e5ce705b8b4c973a39c389b09e5ac58`.

Konfiguratsioon: `gpt-5.4-mini`, reasoning `low`, verbosity `medium`, `max_output_tokens=1100`, prompt-tokeni audit väljas. Küsimustik: Golden-37, SHA-256 `3a47407ce93fbf9fc7cdb33f9f2e3bcc05b0ad0bef788e184e03580b4df50089`.

## Tehniline tulemus

- Algsed jooksud: 37; technical retry: 0.
- Olekud: completed=37.
- Olemasoleva Golden-runner'i automaattulemus: 37/37 PASS; FAIL 0.
- Latentsus: p50 7756 ms; max 37 960 ms.
- Output-tokenid: p50 391; max 709; API järgi 1100-tokeni lagi tabatud 0 korral.
- Tokenid kokku: input 159 476, cached 13 312, output 14 440, reasoning 1993, non-reasoning output 12 447, total 173 916.
- Hinnasnapshoti järgi hinnanguline kogukulu $0.175601; keskmine $0.004746 päringu kohta.
- Vastus puudus 0; incomplete 0; tehniline viga 0; retrieval failure 0; stream failure 0.
- Null toorallikaga vastuseid 3; null kuvatud allikaga vastuseid 3; kuvatud massiivi duplikaatkirjeid 4.
- Null kuvatud allikaga küsimused: `edge_inflected_tugiisikuteenusel`, `edge_crisis`, `edge_no_corpus_answer_v2`.
- Kuvatava massiivi koguarv erines unikaalsete allikate arvust: `kov_kuusalu_koduteenus`, `kov_kuusalu_vormid`, `kov_leakage_guard_narva`, `graph_kov_vormid_kontaktid`.

Automaatsed substring-, mode- ja kuvatud allika kontrollid ei ole subjektiivne sisukvaliteedi otsus. Täielik inimhindamine tehakse mudelinimeta blind-paketiga ja fikseeritud hindamisvormiga.
Olemasolev Golden-runner kasutab `stream:false`; seetõttu on `stream_done_received=null` ja SSE `done` ei ole selle jooksu kohaldatav kontroll. Vastus ning kuvatud allikad salvestati eval-artefakti, mitte püsivasse kasutajavestlusse (`persist:false`).

## RAG ja observability

- RAG käivitus 37/37 vastuses; RAG failure 0.
- Retrieval-timinguid kokku 103; abort 0; non-ok 0.
- Üle 10 000 ms retrieval-kutseid 51; oma timingus märgitud laeni või üle selle 0.
- Timingute eelarved: 12000 ms=25, 18000 ms=78. Native `rag_search` 12 000 ms ridu 19.
- Journald: täpselt kolm etappi 103/103; duplikaate 0; embedding/retrieval komponendid klapivad ±2 ms 103/103.
- Range search_total range klapib ±2 ms 80/103; journal-total miinus response-total delta p50 0 ms, max 23 ms.
- Komponentajast embedding 2,60% ja retrieval 97,40%.

Overview/multi-query rada kasutab olemasolevas tootmiskoodis 18 000 ms alamotsingu eelarvet, native `rag_search` vaikimisi eelarve on 12 000 ms. Selle jooksuga ei muudetud kumbagi. Mitme alamotsingu korral jagab üks loogiline request-ID mitut `upstream_stage` väärtust; korrektne journald'i korrelatsioon kasutab seetõttu paari `request_id + upstream_stage`. Mõne `search_total` logirea väike positiivne delta tekib pärast response'i timingute koostamist tehtavast endpointi lõpetamistööst; embedding ja retrieval komponendid klapivad eraldi.

## Individuaalsed tehnilised jooksud

| # | question_id | status | latency ms | input | cached | output | reasoning | cap | sources | displayed uniq | RAG calls | max RAG ms | auto |
|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|
| 1 | `kov_kuusalu_koduteenus` | completed | 4541 | 6766 | 0 | 326 | 82 | ei | 3 | 2 | 5 | 704 | PASS |
| 2 | `kov_harku_sotsiaaltransport` | completed | 13 375 | 8690 | 1792 | 436 | 35 | ei | 3 | 3 | 7 | 9176 | PASS |
| 3 | `kov_kuusalu_vormid` | completed | 3813 | 6757 | 1792 | 266 | 45 | ei | 3 | 2 | 5 | 691 | PASS |
| 4 | `kov_leakage_guard_narva` | completed | 4405 | 8828 | 0 | 386 | 162 | ei | 2 | 1 | 4 | 611 | PASS |
| 5 | `legal_shs_42` | completed | 2678 | 2404 | 0 | 167 | 20 | ei | 1 | 1 | 1 | 917 | PASS |
| 6 | `legal_shs_17` | completed | 2743 | 2512 | 2304 | 268 | 22 | ei | 1 | 1 | 1 | 957 | PASS |
| 7 | `legal_inflected_paragraph` | completed | 3204 | 2809 | 0 | 323 | 20 | ei | 1 | 1 | 1 | 895 | PASS |
| 8 | `ajakiri_overview_lastekaitse` | completed | 35 578 | 4340 | 3840 | 630 | 17 | ei | 4 | 4 | 7 | 13 825 | PASS |
| 9 | `ajakiri_overview_omastehooldus` | completed | 30 260 | 3889 | 0 | 409 | 33 | ei | 4 | 4 | 6 | 14 383 | PASS |
| 10 | `ajakiri_ai_eetika` | completed | 6868 | 3795 | 0 | 250 | 17 | ei | 1 | 1 | 1 | 4884 | PASS |
| 11 | `ajakiri_sloveenia_hooldus` | completed | 7640 | 3563 | 0 | 311 | 43 | ei | 5 | 5 | 1 | 5326 | PASS |
| 12 | `pdf_hea_tava_terviseprobleemiga_laps` | completed | 37 960 | 4217 | 0 | 709 | 36 | ei | 4 | 4 | 7 | 15 365 | PASS |
| 13 | `pdf_eestkoste_uuring` | completed | 35 400 | 4281 | 0 | 533 | 17 | ei | 4 | 4 | 7 | 14 106 | PASS |
| 14 | `pdf_vaimne_tervis_koolis` | completed | 18 063 | 4410 | 0 | 502 | 29 | ei | 5 | 5 | 3 | 14 591 | PASS |
| 15 | `pdf_tarkvanem_tooleht` | completed | 16 958 | 4351 | 0 | 233 | 36 | ei | 5 | 5 | 3 | 15 112 | PASS |
| 16 | `org_astangu` | completed | 17 049 | 3943 | 0 | 358 | 113 | ei | 2 | 2 | 3 | 14 709 | PASS |
| 17 | `org_puudega_inimese_abi` | completed | 18 362 | 4373 | 0 | 586 | 59 | ei | 4 | 4 | 3 | 15 216 | PASS |
| 18 | `life_raha_uur_toit` | completed | 21 014 | 3942 | 0 | 341 | 53 | ei | 2 | 2 | 4 | 15 825 | PASS |
| 19 | `life_eakas_kodus` | completed | 23 899 | 4290 | 0 | 281 | 72 | ei | 1 | 1 | 4 | 17 164 | PASS |
| 20 | `comparison_kodu_tugiisik` | completed | 23 566 | 3877 | 1792 | 447 | 14 | ei | 2 | 2 | 4 | 16 243 | PASS |
| 21 | `comparison_kodu_isiklik_abistaja` | completed | 21 854 | 3575 | 0 | 496 | 16 | ei | 3 | 3 | 4 | 16 743 | PASS |
| 22 | `edge_inflected_tugiisikuteenusel` | completed | 6486 | 4152 | 0 | 259 | 110 | ei | 0 | 0 | 1 | 4554 | PASS |
| 23 | `edge_crisis` | completed | 5823 | 4282 | 0 | 93 | 30 | ei | 0 | 0 | 1 | 4485 | PASS |
| 24 | `pdf_abivajav_laps_andmekaitse` | completed | 6898 | 2910 | 0 | 309 | 61 | ei | 2 | 2 | 1 | 4732 | PASS |
| 25 | `pdf_opilase_toetamine_koolis` | completed | 17 855 | 4292 | 0 | 573 | 103 | ei | 4 | 4 | 3 | 14 967 | PASS |
| 26 | `pdf_marac_mudel` | completed | 7756 | 3975 | 0 | 555 | 45 | ei | 2 | 2 | 1 | 4846 | PASS |
| 27 | `pdf_vaesus_statistika` | completed | 7675 | 4238 | 0 | 420 | 41 | ei | 4 | 4 | 1 | 4629 | PASS |
| 28 | `pdf_lapse_heaolu_hindamine` | completed | 7802 | 3798 | 0 | 518 | 16 | ei | 2 | 2 | 1 | 4896 | PASS |
| 29 | `edge_followup_paragraph` | completed | 7075 | 4011 | 1792 | 406 | 28 | ei | 1 | 1 | 1 | 4836 | PASS |
| 30 | `edge_no_corpus_answer_v2` | completed | 6163 | 4095 | 0 | 164 | 86 | ei | 0 | 0 | 1 | 4726 | PASS |
| 31 | `pdf_inimkaubandus_ennetus` | completed | 11 176 | 2955 | 0 | 391 | 35 | ei | 1 | 1 | 1 | 5908 | PASS |
| 32 | `pdf_kubervagivald_ohver` | completed | 8269 | 2962 | 0 | 527 | 54 | ei | 1 | 1 | 1 | 4952 | PASS |
| 33 | `pdf_hoolekande_kvaliteet` | completed | 7484 | 3770 | 0 | 392 | 164 | ei | 1 | 1 | 1 | 5085 | PASS |
| 34 | `pdf_toovoime_reform` | completed | 7880 | 4100 | 0 | 417 | 25 | ei | 4 | 4 | 1 | 4848 | PASS |
| 35 | `graph_kov_vormid_kontaktid` | completed | 5530 | 6764 | 0 | 490 | 116 | ei | 3 | 2 | 5 | 802 | PASS |
| 36 | `ajakiri_integreeritud_teenused` | completed | 7708 | 3906 | 0 | 325 | 66 | ei | 4 | 4 | 1 | 5202 | PASS |
| 37 | `ajakiri_kinnise_lasteasutuse_alternatiiv` | completed | 7609 | 3654 | 0 | 343 | 72 | ei | 2 | 2 | 1 | 5037 | PASS |

## Artefaktid

- `full-technical-runs.json` — tehnilised väljad ja automaatkontrollid;
- `full-automatic-results.json` — olemasoleva Golden-runner'i kontrollid;
- `full-blind-packet.json` — vastused ja kuvatud allikate kontrollitud metaandmed ilma mudelinimeta;
- `full-blind-key.json` — eraldi run-ID/mudeli konfiguratsioonivõti;
- `preflight.json` — sessiooni, hashide, konfiguratsiooni ja korpuseankrute kontroll.
