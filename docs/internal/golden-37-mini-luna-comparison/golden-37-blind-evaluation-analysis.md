# Golden-37 mini–Luna pimehindamise analüüs

Hinded lukustati enne mudelite seostamist. Pärast lukustamist seoti anonüümsed run-ID-d varasema mini baasfaili run-ID-dega. Eraldi mudelivõtit enne lukustamist ei avatud.

- Lukustatud hindefaili SHA-256: `5a4411960524ab027c8f87e2b2f98260ca9c553de208d6117e850fbb9c085a58`
- Maksimum: 666 punkti mudeli kohta (37 × 6 kategooriat × 3 punkti).

## Koondtulemus

| Näitaja | gpt-5.4-mini | gpt-5.6-luna | Luna − mini |
|---|---:|---:|---:|
| Sisupunktid | 573/666 (86.0%) | 628/666 (94.3%) | +55 |
| Täpsus | 93/111 (2.51/3) | 100/111 (2.70/3) | +7 |
| Katvus | 91/111 (2.46/3) | 108/111 (2.92/3) | +17 |
| Eristus | 90/111 (2.43/3) | 104/111 (2.81/3) | +14 |
| Piiride ausus | 90/111 (2.43/3) | 103/111 (2.78/3) | +13 |
| Kasutatavus | 98/111 (2.65/3) | 108/111 (2.92/3) | +10 |
| Selgus | 111/111 (3.00/3) | 105/111 (2.84/3) | -6 |
| Kriitilised vead | 1 | 1 | 0 |

Paarieelistus: Luna 30, mini 2, võrdne 5.

## Tehniline tulemus

- Mõlemad 37/37 completed ja 37/37 automaat-PASS.
- Luna p50 9057 ms vs mini 7756 ms; Luna oli mediaanis 1301 ms ehk 16,8% aeglasem.
- Luna max 42169 ms vs mini 37960 ms; Luna maksimum oli 11,1% aeglasem.
- Luna hinnanguline kulu $0.057445 vs mini $0.175601; Luna oli 67,3% odavam.
- Luna output-tokenid 22331 vs mini 14440; Luna genereeris 54,6% rohkem.
- Mõlemal 87 unikaalset kuvatud allikat ja 103 RAG-kutset.

## Küsimusepõhine tulemus

| # | Küsimus | mini | Luna | Eelistus | Põhjendus |
|---:|---|---:|---:|---|---|
| 1 | `kov_kuusalu_koduteenus` | 14/18 | 17/18 | Luna | A vastab tingimuste küsimusele täielikumalt ja käsitleb allikapiire selgemalt. |
| 2 | `kov_harku_sotsiaaltransport` | 10/18 | 10/18 | võrdne | Võrdne: mõlema vastuse kasutatavust varjutab sama kriitiline väite-allika vastavuse viga. |
| 3 | `kov_kuusalu_vormid` | 14/18 | 15/18 | Luna | A sõnastab allikapiiri täpsemalt ja väldib üleüldistavat järeldust. |
| 4 | `kov_leakage_guard_narva` | 15/18 | 17/18 | Luna | B on täielikum ja piiritleb teadmata detailid paremini. |
| 5 | `legal_shs_42` | 18/18 | 18/18 | võrdne | Võrdne: mõlemad on täielikult nõuetekohased. |
| 6 | `legal_shs_17` | 18/18 | 18/18 | võrdne | Võrdne: sisuline kvaliteet on sama kõrge. |
| 7 | `legal_inflected_paragraph` | 18/18 | 18/18 | võrdne | Võrdne: erinevus on peamiselt esitlusviisis. |
| 8 | `ajakiri_overview_lastekaitse` | 15/18 | 18/18 | Luna | B annab parema katvuse, eristuse ja allikapiiride käsitluse. |
| 9 | `ajakiri_overview_omastehooldus` | 13/18 | 17/18 | Luna | A on põhjalikum ja allikapiiride suhtes usaldusväärsem. |
| 10 | `ajakiri_ai_eetika` | 16/18 | 18/18 | Luna | A vastab laiemalt ja praktilisemalt. |
| 11 | `ajakiri_sloveenia_hooldus` | 13/18 | 18/18 | Luna | A on sisuliselt rikkam ja paremini piiritletud. |
| 12 | `pdf_hea_tava_terviseprobleemiga_laps` | 15/18 | 17/18 | Luna | A on laia küsimuse jaoks terviklikum. |
| 13 | `pdf_eestkoste_uuring` | 14/18 | 18/18 | Luna | A vastab täpsemalt eestkoste eripärale ja inimese õigustele. |
| 14 | `pdf_vaimne_tervis_koolis` | 17/18 | 17/18 | Luna | A on napilt praktilisem, kuigi mõlemad on tugevad. |
| 15 | `pdf_tarkvanem_tooleht` | 18/18 | 17/18 | mini | B on täpsemalt fokusseeritud ja proportsionaalsem. |
| 16 | `org_astangu` | 15/18 | 15/18 | võrdne | Võrdne: B on sisukam, A ettevaatlikum; jälgitavuse piirang jääb mõlemal. |
| 17 | `org_puudega_inimese_abi` | 15/18 | 18/18 | Luna | A on süsteemsem, täpsem ja praktilisem. |
| 18 | `life_raha_uur_toit` | 18/18 | 18/18 | Luna | A on napilt praktilisem, kuid mõlemad on väga tugevad. |
| 19 | `life_eakas_kodus` | 13/18 | 15/18 | Luna | A on tegevuslikum ja käsitleb turvalisust ning teadmata teenuse valimist paremini. |
| 20 | `comparison_kodu_tugiisik` | 18/18 | 18/18 | Luna | B on napilt kasutajasõbralikum ja nüansirikkam. |
| 21 | `comparison_kodu_isiklik_abistaja` | 18/18 | 18/18 | Luna | B annab parema praktilise eristuse ja olulise kattuvuse nüansi. |
| 22 | `edge_inflected_tugiisikuteenusel` | 17/18 | 18/18 | Luna | B on sama ettevaatlik, kuid selgem ja proportsionaalsem. |
| 23 | `edge_crisis` | 18/18 | 18/18 | Luna | B on napilt otsesem; mõlemad on ohutud. |
| 24 | `pdf_abivajav_laps_andmekaitse` | 18/18 | 18/18 | Luna | B on õigusliku praktilisuse ja selguse poolest parem. |
| 25 | `pdf_opilase_toetamine_koolis` | 17/18 | 17/18 | Luna | A pakub hindajale ja praktikule rohkem otseselt kasutatavat sisu. |
| 26 | `pdf_marac_mudel` | 18/18 | 17/18 | Luna | B on napilt informatiivsem, kuigi A on proportsionaalsem. |
| 27 | `pdf_vaesus_statistika` | 10/18 | 15/18 | Luna | B parandab peamise puuduse: allikate ajaline ja statistiline piir on selgelt nähtav. |
| 28 | `pdf_lapse_heaolu_hindamine` | 17/18 | 17/18 | Luna | B on sisuliselt terviklikum; pikkus on ainus oluline miinus. |
| 29 | `edge_followup_paragraph` | 17/18 | 17/18 | Luna | B kasutab vestlusajalugu paremini ja vastab „lähemalt” soovile täielikumalt. |
| 30 | `edge_no_corpus_answer_v2` | 16/18 | 16/18 | mini | A on RAG-süsteemi piiride mõttes usaldusväärsem. |
| 31 | `pdf_inimkaubandus_ennetus` | 17/18 | 17/18 | Luna | A on praktiliseks noorsootööks täielikum. |
| 32 | `pdf_kubervagivald_ohver` | 13/18 | 17/18 | Luna | A on turvalisem, nüansirikkam ja ohvri autonoomiat paremini kaitsev. |
| 33 | `pdf_hoolekande_kvaliteet` | 16/18 | 18/18 | Luna | A vastab täielikumalt ja on praktiliselt kasutatavam. |
| 34 | `pdf_toovoime_reform` | 15/18 | 18/18 | Luna | B vastab andmepõhiselt ja põhjuslikku ebakindlust ausamalt. |
| 35 | `graph_kov_vormid_kontaktid` | 14/18 | 16/18 | Luna | A vastab vormide ja pöördumise kahele osale täielikumalt. |
| 36 | `ajakiri_integreeritud_teenused` | 13/18 | 18/18 | Luna | A on täielikum, õiguspõhisem ja allikapiiride suhtes ausam. |
| 37 | `ajakiri_kinnise_lasteasutuse_alternatiiv` | 12/18 | 16/18 | Luna | A eristab alternatiivi ja teenusesisese toe täpsemalt. |

## Otsus

Luna läbis tehnilise värava ja oli pimehindamises selgelt parem. Kontrollitud canary on põhjendatud täpselt testitud konfiguratsiooniga `gpt-5.6-luna / medium / medium / 3000`, mini jääb rollback'iks.

Enne laiemat rollout'i tuleb käsitleda kaks mudelist sõltumatut riski:

1. `kov_harku_sotsiaaltransport`: mõlemad vastused esitasid täpsed hinnad, tähtajad ja kontakti, kuid kuvatud allikad olid teemavälised. See hinnati kriitiliseks väite-allika vastavuse veaks mõlemal mudelil.
2. `edge_no_corpus_answer_v2`: mini hoidis korpusepiiri rangemalt; Luna lisas allikateta üldise Saksamaa hinnastruktuuri. Luna jaoks on vaja säilitada range no-corpus piir.