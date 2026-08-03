# gpt-5.4-mini vs gpt-5.6-luna Golden-37 tehniline võrdlus

Küsimustik: Golden-37, SHA-256 `3a47407ce93fbf9fc7cdb33f9f2e3bcc05b0ad0bef788e184e03580b4df50089`. Rubriigi SHA-256 `414b9102b12171b8f41f9c23c0305224bac95c53a5887caf9170b7b3eefb1f4d`. Mõlemal poolel 37 fikseeritud küsimust samas järjestuses.

Luna jooks tehti eraldatud loopback-only protsessis tootmise HEAD-il `13cfe8605e5ce705b8b4c973a39c389b09e5ac58`. Tootmise frontend-, RAG-, env-, prompt-, korpuse- ega retrieval-seadeid ei muudetud. Kandidaatkomplekt erineb mini baasist mudeli, reasoning effort'i ja output-lae poolest; see ei ole ainult mudelinime isoleeritud A/B.

## Tulemus

| Näitaja | mini baas | Luna kandidaat | Luna − mini |
|---|---:|---:|---:|
| completed | 37/37 | 37/37 | 0 |
| technical retry | 0 | 0 | 0 |
| automaat-PASS | 37/37 | 37/37 | 0 |
| latentsus p50 ms | 7756 | 9057 | +1301 |
| latentsus max ms | 37 960 | 42 169 | +4209 |
| output-tokenid kokku | 14 440 | 22 331 | +7891 |
| reasoning-tokenid kokku | 1993 | 3653 | +1660 |
| output-cap tabamused | 0 | 0 | 0 |
| vastusemudeli hinnanguline kulu USD | 0.175601 | 0.057445 | −0,118156 |
| kuvatud unikaalsed allikad kokku | 87 | 87 | 0 |
| RAG failure | 0 | 0 | 0 |

Mini konfiguratsioon: `historical harness did not persist observed model`, low/medium/1100. Luna tegelikult vaadeldud konfiguratsioon: `gpt-5.6-luna`, medium/medium/3000.
Luna: incomplete 0, response puudus 0, technical failure 0, retrieval failure 0, stream failure 0.
Luna RAG timinguid 103; abort 0; non-ok 0; journald kolm etappi 103/103; duplikaate 0; komponentide vaste 103/103.
Luna retrieval-komponentajast embedding 2,56% ja retrieval 97,44%. Eelarved: 12000 ms=25, 18000 ms=78.
Luna nullallikaga juhud: `edge_inflected_tugiisikuteenusel`, `edge_crisis`, `edge_no_corpus_answer_v2`. Kuvatavate allikate duplikaadiga juhud: `kov_kuusalu_koduteenus`, `kov_kuusalu_vormid`, `kov_leakage_guard_narva`, `graph_kov_vormid_kontaktid`.

Mõlemal mudelil oli 103 `text-embedding-3-large` päringut ja 5130
embeddingu sisendtokenit. Fikseeritud hinnasnapshoti $0.13 / 1M tokeni järgi
lisandub kummalegi $0.0006669. Vastusemudeli ja query-embeddingu koondkulu on
seega mini puhul $0.1762683 ning Luna puhul $0.05811222. EKP 31.07.2026
referentskursiga 1 EUR = 1.1485 USD vastab see 37 küsimuse kohta ligikaudu
€0.1535 ja €0.0506-le, ühe küsimuse kohta €0.00415 ja €0.00137-le
ning 1000 samalaadse küsimuse projektsioonina €4.15 ja €1.37-le.

## Otsustusvärav

Tehniline värav on läbitud. 74 vastuse pimehinded lukustati enne
mudelivõtmega seostamist ja sõltumatu mudel-hindaja paarisanalüüs andis mini
tulemuseks 573/666 ning Luna tulemuseks 628/666. See ei ole päris inimese
hinnang. Luna võitis 30 paari, mini 2 ja 5 paari jäid viiki; mõlemal oli üks
kriitiline viga. Mudelivahetuse release-värav on sisuliselt läbitud, kuid enne
Luna canary't tuleb parandada ühine Harku allikavastavuse viga ja kinnitada
range no-corpus käitumine.

## Kõik individuaalsed jooksud

| # | question_id | mini ms | Luna ms | Δ ms | mini output | Luna output | mini uniq src | Luna uniq src | mini auto | Luna auto |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | `kov_kuusalu_koduteenus` | 4541 | 6823 | +2282 | 326 | 757 | 2 | 2 | PASS | PASS |
| 2 | `kov_harku_sotsiaaltransport` | 13 375 | 15 614 | +2239 | 436 | 616 | 3 | 3 | PASS | PASS |
| 3 | `kov_kuusalu_vormid` | 3813 | 5207 | +1394 | 266 | 369 | 2 | 2 | PASS | PASS |
| 4 | `kov_leakage_guard_narva` | 4405 | 5841 | +1436 | 386 | 625 | 1 | 1 | PASS | PASS |
| 5 | `legal_shs_42` | 2678 | 3280 | +602 | 167 | 127 | 1 | 1 | PASS | PASS |
| 6 | `legal_shs_17` | 2743 | 2834 | +91 | 268 | 228 | 1 | 1 | PASS | PASS |
| 7 | `legal_inflected_paragraph` | 3204 | 3776 | +572 | 323 | 245 | 1 | 1 | PASS | PASS |
| 8 | `ajakiri_overview_lastekaitse` | 35 578 | 33 599 | −1979 | 630 | 1128 | 4 | 4 | PASS | PASS |
| 9 | `ajakiri_overview_omastehooldus` | 30 260 | 34 685 | +4425 | 409 | 577 | 4 | 4 | PASS | PASS |
| 10 | `ajakiri_ai_eetika` | 6868 | 9586 | +2718 | 250 | 330 | 1 | 1 | PASS | PASS |
| 11 | `ajakiri_sloveenia_hooldus` | 7640 | 9057 | +1417 | 311 | 606 | 5 | 5 | PASS | PASS |
| 12 | `pdf_hea_tava_terviseprobleemiga_laps` | 37 960 | 40 804 | +2844 | 709 | 1259 | 4 | 4 | PASS | PASS |
| 13 | `pdf_eestkoste_uuring` | 35 400 | 42 169 | +6769 | 533 | 746 | 4 | 4 | PASS | PASS |
| 14 | `pdf_vaimne_tervis_koolis` | 18 063 | 20 069 | +2006 | 502 | 657 | 5 | 5 | PASS | PASS |
| 15 | `pdf_tarkvanem_tooleht` | 16 958 | 18 086 | +1128 | 233 | 281 | 5 | 5 | PASS | PASS |
| 16 | `org_astangu` | 17 049 | 18 439 | +1390 | 358 | 449 | 2 | 2 | PASS | PASS |
| 17 | `org_puudega_inimese_abi` | 18 362 | 20 340 | +1978 | 586 | 852 | 4 | 4 | PASS | PASS |
| 18 | `life_raha_uur_toit` | 21 014 | 23 590 | +2576 | 341 | 445 | 2 | 2 | PASS | PASS |
| 19 | `life_eakas_kodus` | 23 899 | 22 527 | −1372 | 281 | 420 | 1 | 1 | PASS | PASS |
| 20 | `comparison_kodu_tugiisik` | 23 566 | 24 432 | +866 | 447 | 597 | 2 | 2 | PASS | PASS |
| 21 | `comparison_kodu_isiklik_abistaja` | 21 854 | 25 336 | +3482 | 496 | 803 | 3 | 3 | PASS | PASS |
| 22 | `edge_inflected_tugiisikuteenusel` | 6486 | 6773 | +287 | 259 | 181 | 0 | 0 | PASS | PASS |
| 23 | `edge_crisis` | 5823 | 6126 | +303 | 93 | 136 | 0 | 0 | PASS | PASS |
| 24 | `pdf_abivajav_laps_andmekaitse` | 6898 | 7351 | +453 | 309 | 395 | 2 | 2 | PASS | PASS |
| 25 | `pdf_opilase_toetamine_koolis` | 17 855 | 18 588 | +733 | 573 | 857 | 4 | 4 | PASS | PASS |
| 26 | `pdf_marac_mudel` | 7756 | 8556 | +800 | 555 | 621 | 2 | 2 | PASS | PASS |
| 27 | `pdf_vaesus_statistika` | 7675 | 7643 | −32 | 420 | 495 | 4 | 4 | PASS | PASS |
| 28 | `pdf_lapse_heaolu_hindamine` | 7802 | 12 728 | +4926 | 518 | 1766 | 2 | 2 | PASS | PASS |
| 29 | `edge_followup_paragraph` | 7075 | 8806 | +1731 | 406 | 819 | 1 | 1 | PASS | PASS |
| 30 | `edge_no_corpus_answer_v2` | 6163 | 7106 | +943 | 164 | 301 | 0 | 0 | PASS | PASS |
| 31 | `pdf_inimkaubandus_ennetus` | 11 176 | 10 312 | −864 | 391 | 1044 | 1 | 1 | PASS | PASS |
| 32 | `pdf_kubervagivald_ohver` | 8269 | 10 013 | +1744 | 527 | 934 | 1 | 1 | PASS | PASS |
| 33 | `pdf_hoolekande_kvaliteet` | 7484 | 7141 | −343 | 392 | 478 | 1 | 1 | PASS | PASS |
| 34 | `pdf_toovoime_reform` | 7880 | 8628 | +748 | 417 | 694 | 4 | 4 | PASS | PASS |
| 35 | `graph_kov_vormid_kontaktid` | 5530 | 4990 | −540 | 490 | 504 | 2 | 2 | PASS | PASS |
| 36 | `ajakiri_integreeritud_teenused` | 7708 | 8050 | +342 | 325 | 544 | 4 | 4 | PASS | PASS |
| 37 | `ajakiri_kinnise_lasteasutuse_alternatiiv` | 7609 | 7851 | +242 | 343 | 445 | 2 | 2 | PASS | PASS |
