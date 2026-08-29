# RAG 75 varasemate FAIL/PARTIAL juhtumite tootmiskorduse tulemused

- Runtime SHA: `e1a8eea4ebcc6dcb6a20caa40cbdb0ca418454f5`
- Valim: viimase 75-jooksu 34 `PARTIAL`/`FAIL` juhtumit
- Run started at UTC: `2026-08-29T08:15:30.442Z`
- Run ended at UTC: `2026-08-29T08:51:36.980Z`
- Meetod: autentitud tootmisvestlus, viis uut teemavestlust, küsimused ükshaaval kasutajaliideses
- Trace: exact `ChatTurn` USER→ASSISTANT paarid read-only andmebaasist; UI allikapaneel eraldi käsitsi avatud
- Tulemus: PASS 3, PARTIAL 4, FAIL 27, NOT_PROVEN 0
- Allikapaneel avanes: 17 / 34

## Koond

| ID | Eelmine | Uus | Allikapaneel | Esimene lahknev kiht | Lühjus |
|---|---|---|---|---|---|
| J03 | PARTIAL | PASS | JAH | — | Kõik kriisitunnused ning 112 ja 1220 on õigesti esitatud 2018. aasta artikli allikaga. |
| J04 | PARTIAL | FAIL | JAH | retrieval | Ei nimetanud Perepesade linnu ega nelja ülesannet. |
| J05 | FAIL | FAIL | EI | retrieval | Ei vastanud ühelegi küsitud arvuseosele. |
| J07 | PARTIAL | FAIL | EI | retrieval | Ei esitanud ühtegi viiest küsitud näitajast. |
| J08 | FAIL | FAIL | EI | retrieval | Ei esitanud nelja küsitud osakaalu. |
| J09 | PARTIAL | FAIL | JAH | generation | Küsis tarbetut täpsustust ega esitanud nelja protsenti. |
| J11 | FAIL | FAIL | EI | retrieval | Ei vastanud intervjuude arvu, jaotust ega analüüsi. |
| J12 | PARTIAL | FAIL | JAH | context | Ei kinnitanud viit lepingus kavandatud kohtumist. |
| J13 | PARTIAL | PARTIAL | JAH | context | Vanuserühm 13–18 on õige, kuid tavapärane 3–5 probleemi jäi vastamata. |
| J14 | FAIL | PASS | JAH | — | Üle 5800 lapse, umbes 90%, 14 kohtujuhtumit ja kolm kohtuvälist kokkulepet on õigesti seotud. |
| J18 | FAIL | FAIL | EI | identity | Ei esitanud kolme viieliikmelist praktikute rühma ega koguarvu 15. |
| J20 | FAIL | FAIL | EI | retrieval | Ei sidunud seadusemuudatusi kolme küsitud ajaga. |
| J22 | PARTIAL | FAIL | JAH | retrieval | Ei vastanud kuue kuu ega osaleja ja tööandja vaadete kohta. |
| V01 | FAIL | FAIL | EI | retrieval | Ei vastanud kohtumiste sagedust ega linnade arve 5/7/5. |
| V03 | PARTIAL | FAIL | JAH | context | Ei kasutanud sama vestluse J12 konteksti ega vastanud viis. |
| V04 | FAIL | FAIL | JAH | generation | Andis 22/41/13, mitte oodatud 10%=640, 6%=227 ja 2%=100. |
| V05 | PARTIAL | FAIL | JAH | identity | Ei vastanud kuue kuu ega osaleja ja tööandja hinnangute kohta. |
| V06 | FAIL | FAIL | EI | identity | Ei vastanud 169 otsust ega aastat 2018. |
| A01 | FAIL | PARTIAL | JAH | generation | Leidis ühe kinnitatud oma artikli ja teemad, kuid jättis täieliku autoriloendi kinnitamata. |
| A02 | FAIL | FAIL | EI | identity | Ei leidnud autori enda artikleid ega teemasid. |
| A03 | FAIL | FAIL | EI | validation | Ei leidnud autori enda artikleid ega teemasid. |
| A04 | PARTIAL | PARTIAL | JAH | generation | Leidis ühe oma artikli ja teemad, kuid jättis täieliku autoriloendi kinnitamata. |
| A05 | PARTIAL | FAIL | EI | validation | Ei leidnud autori enda artikleid ega teemasid. |
| A06 | FAIL | FAIL | EI | identity | Ei leidnud autori enda artikleid ega teemasid. |
| A07 | FAIL | FAIL | EI | validation | Ei leidnud autori enda artikleid ega teemasid. |
| A08 | PARTIAL | FAIL | EI | validation | Ei leidnud Merle Tombergi enda artikleid ega teemasid. |
| A10 | FAIL | FAIL | EI | identity | Ei leidnud Judit Strömpli enda artikleid ega teemasid. |
| S08 | FAIL | PARTIAL | JAH | attribution | Vastus oli sisukas, kuid kuvas laia sünteesi jaoks ainult ühe allika. |
| M01 | FAIL | FAIL | EI | identity | Ei vastanud uuringu meetodi, aja ega 42 osaleja kohta. |
| M02 | PARTIAL | FAIL | JAH | identity | Kasutas üldist arengukava ega vastanud Tallinnale antud soovitustele. |
| M07 | FAIL | FAIL | JAH | identity | Ei leidnud Tarkvanema vestlustöölehte ega vastanud kasutamise kohta. |
| K01 | PARTIAL | PASS | JAH | — | Andis Kuusalu taotlemise korra, § 6 sisu ja ametlikud KOV/õigusallikad. |
| K02 | PARTIAL | FAIL | EI | generation | Ei vastanud Narva linna koduteenuse taotlemise korra kohta. |
| K05 | PARTIAL | FAIL | JAH | context | Ei vastanud Tartu sotsiaaltranspordi tingimuste ega kasutamise korra kohta. |

## Võrdlus

- PASS-iks paranesid: J03, J14 ja K01.
- FAIL-ist PARTIAL-iks paranesid: A01 ja S08.
- PARTIAL-iks jäid: J13 ja A04.
- Ülejäänud 27 juhtumit on FAIL; neist osa langes varasemast PARTIAL-ist FAIL-i, sest käesolevas korduses ei vastatud enam küsimuse tuumale.
- Autoriplokk ei ole üldiselt parandatud: A01 ja A04 leidsid ühe õige oma artikli, A02, A03, A05, A06, A07, A08 ja A10 ei andnud autorivastust.
- Trace näitab A03, A05, A07 ja A08 puhul, et autorirada leidis materjali, kuid arvufaktide validaator blokeeris autorikokkuvõtte bibliograafiliste või eri allikate arvude segunemise tõttu.
- V04 valis endiselt õigest artiklist vale arvurühma: 22% / 41% / 13%, mitte 10%=640 / 6%=227 / 2%=100.
- K02 leidis ja valis õige Narva koduteenuse allika, kuid genereeritud toetamata arvud käivitasid validaatori ning kasutajale jäi üldine keeldumine.
- S08 valis kaks õiget Saaremaa artiklit, kuid vastuse/allika atribuutika jättis neist paneeli ainult ühe.

## Trace’i lahknevuste koond

- attribution: 1
- context: 4
- generation: 5
- identity: 9
- retrieval: 8
- validation: 4

## Juhtumid

### J03

- Batch / turn: `R-B01` / 1
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte3xlom000d27kmlidlkc56`
- User / assistant message ID: `cmte3xlok000c27kml3k5i03w` / `cmte3xnv5000f27kmqhptni9b`
- Sent at UTC: `2026-08-29T08:16:54.210Z`
- Exact question:

> Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada 2018. aasta artikli järgi?

- Exact answer:

> 2018. aasta artikli „Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?“ järgi on vaimse tervise kriisi tunnused järgmised:
>
> - oht, et inimene võib ennast kahjustada, näiteks üritada ennast vigastada või teha enesetappu ravimite või muude ainetega;
> - äärmuslik stress, näiteks paanikahoog, äge stressireaktsioon traumaatilisele sündmusele või tõsine psühhootiline seisund;
> - inimese käitumine on teiste jaoks tugevalt häiriv, näiteks esineb agressiivsus või sideme kaotamine reaalsusega.
>
> Sellises kriisiolukorras tuleb abi saamiseks helistada:
>
> - 112;
> - perearsti nõuandeliinile 1220.
>
> Artiklis rõhutatakse, et kriisiabi tuleb kasutada kuni olukorra lahenemiseni või asjakohase professionaalse abi saamiseni.

- Selected context IDs: sotsiaaltoo_vaimse-tervise-esmaabi-toole-2018
- Displayed sources: Külli Mäe, 2018. Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?. Sotsiaaltöö 1/2018 · lk 1–5 · Tööalane tugi
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Külli Mäe, 2018. Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?. Sotsiaaltöö 1/2018 · lk 1–5 · Tööalane tugi Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2018","112","1220"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":2747,"selected_document_id":"sotsiaaltoo-1-2018-vaimse-tervise-esmaabi-toole-2018","supporting_source_id":"sotsiaaltoo_vaimse-tervise-esmaabi-toole-2018","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":76,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":["1220"],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":true,"document_identity_required":true,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"high","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PASS**
- Reason: Kõik kriisitunnused ning 112 ja 1220 on õigesti esitatud 2018. aasta artikli allikaga.
- First divergent layer: —

### J04

- Batch / turn: `R-B01` / 2
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte3zs8j000u27kmfktnuhs9`
- User / assistant message ID: `cmte3zs8i000t27km695ymuzz` / `cmte3zthh000w27kmd4u429ce`
- Sent at UTC: `2026-08-29T08:18:48.207Z`
- Exact question:

> Millistes linnades tegutsesid Perepesad ja millised neli ülesannet neil olid?

- Exact answer:

> Kasutatud materjal ei kinnita, millistes linnades Perepesad tegutsesid ega millised olid nende neli ülesannet; vastamiseks on vaja Perepesade projekti või seda kirjeldava artikli teksti.

- Selected context IDs: sotsiaaltoo_sotsiaaltoo-erinumber-2016-artikkel-22-millistel-tingimustel-kasutab-heaolu-arengukava-sotsiaalse-e
- Displayed sources: Rasmus Pedanik, 2016. Millistel tingimustel kasutab heaolu arengukava sotsiaalse ettevõtluse potentsiaali?. Sotsiaaltöö erinumber 2016 · lk 78–82 · Kodanikuühiskond
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Rasmus Pedanik, 2016. Millistel tingimustel kasutab heaolu arengukava sotsiaalse ettevõtluse potentsiaali?. Sotsiaaltöö erinumber 2016 · lk 78–82 · Kodanikuühiskond Teata allika veast
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei nimetanud Perepesade linnu ega nelja ülesannet.
- First divergent layer: retrieval

### J05

- Batch / turn: `R-B01` / 3
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte40tpp001a27kmzgh31yvz`
- User / assistant message ID: `cmte40tpo001927kmbtd2crul` / `cmte40v3g001c27kmvall2so1`
- Sent at UTC: `2026-08-29T08:19:34.938Z`
- Exact question:

> Milliseid kahte taastava õiguse näitajat kirjeldati arvudega 30 ja 12 ning milliseid näitajaid arvudega 60 ja 19?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_personaalne-peegeldus-taastava-oiguse-voimalustele-kinnipidamisasutustes-2020-4, sotsiaaltoo_taastav-oigus-ja-lahisuhtevagivald-2020-4
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"unsupported_numeric_claim","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["30","12","60","19"],"source_count":2,"whole_scope_checked":false,"buffered_response_ms":1777,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":27,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":["12","60"],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei vastanud ühelegi küsitud arvuseosele.
- First divergent layer: retrieval

### J07

- Batch / turn: `R-B01` / 4
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte41tfd001v27kmbv2a22m8`
- User / assistant message ID: `cmte41tfc001u27kmfmdffez2` / `cmte41vj1001x27km174ytz5r`
- Sent at UTC: `2026-08-29T08:20:15.578Z`
- Exact question:

> Kui palju inimesi sai teenust, mitu vabatahtlikku osales, mitu töötundi tehti ning mitmes maakonnas ja omavalitsuses tegutseti 2018–2020 katseetapis 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust” järgi?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_kov-valjakutsed-teenused-2017-1
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"unsupported_numeric_claim","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["2022","2018","2020"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":2703,"selected_document_id":"sotsiaaltoo-1-2017-kov-valjakutsed-teenused-2017-1","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":1,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":["2022","2018","2020"],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":true,"document_identity_required":true,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"high","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei esitanud ühtegi viiest küsitud näitajast.
- First divergent layer: retrieval

### J08

- Batch / turn: `R-B01` / 5
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte42h1v002b27km55ylvu9m`
- User / assistant message ID: `cmte42h1u002a27km8c7q86wn` / `cmte42hcd002e27km5etqo8un`
- Sent at UTC: `2026-08-29T08:20:54.673Z`
- Exact question:

> Millised olid hoolduskoormuse uuringus neli küsitud osakaalu?

- Exact answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Selected context IDs: —
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei esitanud nelja küsitud osakaalu.
- First divergent layer: retrieval

### J09

- Batch / turn: `R-B01` / 6
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte43blj002p27kmjj72h0u9`
- User / assistant message ID: `cmte43bli002o27kmsf8yxjax` / `cmte43i86002r27km48hgk4ke`
- Sent at UTC: `2026-08-29T08:21:32.795Z`
- Exact question:

> Millised olid kiusamist kirjeldanud neli protsenti?

- Exact answer:

> Millise tunnuse või joonisega seotud nelja protsendinäitajat te mõtlete?

- Selected context IDs: sotsiaaltoo_kiusamise-levimus-eesti-noorte-seas-ja-sellega-seotud-tegurid-2024-2
- Displayed sources: Jaanika Piksööt, 2024. Kiusamise levimus Eesti noorte seas ja sellega seotud tegurid. Sotsiaaltöö 2/2024 · lk 2–6 · Uurimus
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Jaanika Piksööt, 2024. Kiusamise levimus Eesti noorte seas ja sellega seotud tegurid. Sotsiaaltöö 2/2024 · lk 2–6 · Uurimus Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["4"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":8579,"supporting_source_id":"sotsiaaltoo_kiusamise-levimus-eesti-noorte-seas-ja-sellega-seotud-tegurid-2024-2","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":18,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Küsis tarbetut täpsustust ega esitanud nelja protsenti.
- First divergent layer: generation

### J11

- Batch / turn: `R-B01` / 7
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte44b12003727kmokd8z2u7`
- User / assistant message ID: `cmte44b11003627kmzbyqovby` / `cmte44cww003927kmb6ym8oxh`
- Sent at UTC: `2026-08-29T08:22:15.419Z`
- Exact question:

> Kui palju oli töötamise toetamise intervjuusid, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_kovisioon-hea-voimalus-toetada-sotsiaalvaldkonna-tootajaid-2017
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"requested_metric_slot_missing","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":[],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":2429,"selected_document_id":"sotsiaaltoo-4-2017-kovisioon-hea-voimalus-toetada-sotsiaalvaldkonna-tootajaid-2017","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":3,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":true,"document_identity_required":true,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":1,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"high","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":true,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":true}
- Verdict: **FAIL**
- Reason: Ei vastanud intervjuude arvu, jaotust ega analüüsi.
- First divergent layer: retrieval

### J12

- Batch / turn: `R-B01` / 8
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte453z5003n27kmeysl401o`
- User / assistant message ID: `cmte453z4003m27kme414piae` / `cmte4565e003p27kmxhseo96m`
- Sent at UTC: `2026-08-29T08:22:54.431Z`
- Exact question:

> Mitu KOV-i sotsiaaltöötajate rühmasupervisiooni kohtumist pidi 2017. aastal lepingu järgi toimuma igas maakonnas?

- Exact answer:

> Kinnitatud katkendid ei näita, mitu rühmasupervisiooni kohtumist pidi 2017. aastal lepingu järgi igas maakonnas toimuma. Selleks oleks vaja lepingu või hanketingimuste vastavat sätet.

- Selected context IDs: sotsiaaltoo_sotsiaaltoo-1-2016-artikkel-03-supervisiooniteenus-kohalike-omavalitsuste-sotsi, sotsiaaltoo_kovisioon-hea-voimalus-toetada-sotsiaalvaldkonna-tootajaid-2017, sotsiaaltoo_sotsiaalabi-piirid-ja-kov-kohustused-2020-1, sotsiaaltoo_kov-uhinemine-teenused-2017-1, sotsiaaltoo_jogeva-vald-sotsiaaltoo-2018
- Displayed sources: Signe Vesso, 2017. Kovisioon – hea võimalus, kuidas toetada sotsiaalvaldkonna töötajaid. Sotsiaaltöö 4/2017 · lk 1–4 · Tööalane tugi
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Signe Vesso, 2017. Kovisioon – hea võimalus, kuidas toetada sotsiaalvaldkonna töötajaid. Sotsiaaltöö 4/2017 · lk 1–4 · Tööalane tugi Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2017"],"source_count":5,"whole_scope_checked":false,"buffered_response_ms":2797,"supporting_source_id":"sotsiaaltoo_kovisioon-hea-voimalus-toetada-sotsiaalvaldkonna-tootajaid-2017","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":6,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei kinnitanud viit lepingus kavandatud kohtumist.
- First divergent layer: context

### J13

- Batch / turn: `R-B01` / 9
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte463g5004327km6yxr4anp`
- User / assistant message ID: `cmte463g4004227kmnk5q3l62` / `cmte4650m004527kmt1asp7nl`
- Sent at UTC: `2026-08-29T08:23:36.560Z`
- Exact question:

> Millist vanuserühma 13–18 käsitleti ning mitu probleemi noortel tavaliselt korraga oli?

- Exact answer:

> Käsitleti tõsistesse raskustesse sattunud 13–18-aastaseid noori, kellel oli suur risk probleemse käitumise jätkumiseks täiskasvanueas. Uuringus ei määratud, mitu probleemi noortel tavaliselt korraga esines; küll aga oli kõigil uuritud noortel üks või mitu psühhiaatrilist diagnoosi ning nendega võisid kaasneda koolist puudumine, uimastite tarvitamine, enesevigastamine ja õigusrikkumised.

- Selected context IDs: sotsiaaltoo_kaitumisprobleemidega-lapsed-peaksid-abi-saama-enne-kui-asjad-vaga-hulluks-lahevad-2018
- Displayed sources: Laur Raudsoo, 2018. Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad. Sotsiaaltöö 4/2018 · lk 2–4, 6 · Intervjuu
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Laur Raudsoo, 2018. Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad. Sotsiaaltöö 4/2018 · lk 2–4, 6 · Intervjuu Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["13","18","1"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":1988,"supporting_source_id":"sotsiaaltoo_kaitumisprobleemidega-lapsed-peaksid-abi-saama-enne-kui-asjad-vaga-hulluks-lahevad-2018","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":15,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PARTIAL**
- Reason: Vanuserühm 13–18 on õige, kuid tavapärane 3–5 probleemi jäi vastamata.
- First divergent layer: context

### J14

- Batch / turn: `R-B01` / 10
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte46xdn004j27km8ybzty2m`
- User / assistant message ID: `cmte46xdi004i27km4v5728ta` / `cmte46z7d004l27kmlhjvzxuh`
- Sent at UTC: `2026-08-29T08:24:18.693Z`
- Exact question:

> Mida öeldi Saue valla alla 18-aastaste laste arvu ja vanemate hooldusõiguse vaidlustes kohtusse pöördumise kohta?

- Exact answer:

> 2019. aasta intervjuus öeldi, et Saue vallas oli alla 18-aastaseid lapsi üle 5800; lastekaitsjad pidasid arvestust pigem perede kui laste arvu järgi.
>
> Vanemate hooldusõiguse vaidlustes märkis lastekaitsespetsialist Signe Algma, et tema hinnangul pöördusid vanemad umbes 90% juhtudest kohtusse, kuigi enne võiks tulla lastekaitsespetsialisti juurde nõustamisele. Kohtusse jõudnud juhtumid olid sageli juba teravad ning samal aastal oli tal 14 kohtujuhtumit, millest ainult kolmel juhul jõudsid vanemad lastekaitsespetsialisti juures kohtuvälise kokkuleppeni. Perelepitus ei tähendanud vanemate kokkujäämise propageerimist, vaid nende aitamist saavutada laste huvides toimiv koostöö ja suhtlus.

- Selected context IDs: sotsiaaltoo_lastekaitsjad-ja-omavahel-sodivad-vanemad-2019, sotsiaaltoo_aasta-parimad-lastekaitsetootajad-2019, sotsiaaltoo_lapsesobralik-menetlus-hooldus-ja-suhtlusoigus-2019
- Displayed sources: Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–3 · Kohalik omavalitsus
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–3 · Kohalik omavalitsus Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2019","18","5800","90","14","3"],"source_count":3,"whole_scope_checked":true,"buffered_response_ms":2334,"supporting_source_id":"sotsiaaltoo_lastekaitsjad-ja-omavahel-sodivad-vanemad-2019","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":28,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":["5800"],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PASS**
- Reason: Üle 5800 lapse, umbes 90%, 14 kohtujuhtumit ja kolm kohtuvälist kokkulepet on õigesti seotud.
- First divergent layer: —

### J18

- Batch / turn: `R-B01` / 11
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte47spr005127kmigvup9cp`
- User / assistant message ID: `cmte47spq005027kmakwuhnpq` / `cmte47ufh005327kmsnlvxpa6`
- Sent at UTC: `2026-08-29T08:25:00.408Z`
- Exact question:

> Kui palju osalejaid oli eestkostes osalemise uuringu igas kolmes praktikute rühmas ja kokku?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"unsupported_numeric_claim","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["3"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":2206,"selected_document_id":"epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":1,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":["3"],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":true,"document_identity_required":true,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"high","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei esitanud kolme viieliikmelist praktikute rühma ega koguarvu 15.
- First divergent layer: identity

### J20

- Batch / turn: `R-B01` / 12
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte48kcn005h27kmcs47z5sy`
- User / assistant message ID: `cmte48kcm005g27km24rr3v00` / `cmte48knn005k27kmmvt7lfo4`
- Sent at UTC: `2026-08-29T08:25:39.632Z`
- Exact question:

> Millal kirjeldati artiklis sotsiaalvaldkonna seadusemuudatusi 2023. aasta kevadel ja suvel ning 2025. aasta jaanuaris?

- Exact answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Selected context IDs: —
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei sidunud seadusemuudatusi kolme küsitud ajaga.
- First divergent layer: retrieval

### J22

- Batch / turn: `R-B01` / 13
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte49h01005x27kmthblhwby`
- User / assistant message ID: `cmte49h00005w27kmcrk4gf3y` / `cmte49icp005z27km8ndmesc8`
- Sent at UTC: `2026-08-29T08:26:19.497Z`
- Exact question:

> Millal tehti e-kursuse järelhindamine ning kelle vaadet selles võrreldi?

- Exact answer:

> Kasutatud materjalid ei kinnita, millal e-kursuse järelhindamine tehti ega kelle vaateid võrreldi. Palun täpsustage e-kursuse või seda käsitleva artikli nimi.

- Selected context IDs: sotsiaaltoo_lastekaitsjad-ja-omavahel-sodivad-vanemad-2019, sotsiaaltoo_kaitumisprobleemidega-lapsed-peaksid-abi-saama-enne-kui-asjad-vaga-hulluks-lahevad-2018, sotsiaaltoo_mone-omapara-sotsiaaltoo-maardu-linnas-2019
- Displayed sources: Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–3 · Kohalik omavalitsus; Laur Raudsoo, 2018. Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad. Sotsiaaltöö 4/2018 · lk 1–6 · Intervjuu
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–3 · Kohalik omavalitsus Teata allika veast Laur Raudsoo, 2018. Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad. Sotsiaaltöö 4/2018 · lk 1–6 · Intervjuu Teata allika veast
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei vastanud kuue kuu ega osaleja ja tööandja vaadete kohta.
- First divergent layer: retrieval

### V01

- Batch / turn: `R-B01` / 14
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte4acvo006f27kmfl0o5dly`
- User / assistant message ID: `cmte4acvn006e27kmq2pq284k` / `cmte4adzv006h27km5o7a43s9`
- Sent at UTC: `2026-08-29T08:27:00.940Z`
- Exact question:

> MAPPA kohtumised – kui tihti ja mitu neid kolmes Virumaa linnas oli?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_lastekaitsjad-ja-omavahel-sodivad-vanemad-2019, sotsiaaltoo_kaitumisprobleemidega-lapsed-peaksid-abi-saama-enne-kui-asjad-vaga-hulluks-lahevad-2018, sotsiaaltoo_loimitud-ja-mitmekulgne-sotsiaaltoo-viljandis-2021-4
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"whole_scope_mismatch","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["3"],"source_count":3,"whole_scope_checked":false,"buffered_response_ms":1431,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":8,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei vastanud kohtumiste sagedust ega linnade arve 5/7/5.
- First divergent layer: retrieval

### V03

- Batch / turn: `R-B01` / 15
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte4b8ds006x27kmzz221vbx`
- User / assistant message ID: `cmte4b8dr006w27kmexulyca8` / `cmte4b9to006z27kmplizcuia`
- Sent at UTC: `2026-08-29T08:27:38.655Z`
- Exact question:

> Palju neid supervisioone maakonna kohta tehti?

- Exact answer:

> Kasutatud korpus ei kinnita, mitu supervisiooni maakonna kohta tehti. Millise artikli või uuringu supervisioonidest te küsite?

- Selected context IDs: sotsiaaltoo_lastekaitsjad-ja-omavahel-sodivad-vanemad-2019, sotsiaaltoo_kaitumisprobleemidega-lapsed-peaksid-abi-saama-enne-kui-asjad-vaga-hulluks-lahevad-2018, sotsiaaltoo_mone-omapara-sotsiaaltoo-maardu-linnas-2019
- Displayed sources: Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–3 · Kohalik omavalitsus
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–3 · Kohalik omavalitsus Teata allika veast
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei kasutanud sama vestluse J12 konteksti ega vastanud viis.
- First divergent layer: context

### V04

- Batch / turn: `R-B01` / 16
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte4c0x5007d27kmsf1iaepo`
- User / assistant message ID: `cmte4c0x3007c27kmap1got3f` / `cmte4c252007f27kmyr1a00y9`
- Sent at UTC: `2026-08-29T08:28:20.418Z`
- Exact question:

> Eakate vägivallauuring: mis olid kolm näitu?

- Exact answer:

> 2023. aastal registreeritud kuritegude vähemalt 65-aastastest ohvritest:
>
> - 22% oli kogenud kehalist väärkohtlemist;
> - 41% oli langenud kelmuse ohvriks;
> - 13% oli langenud varguse ohvriks.
>
> Need näitajad pärinevad Justiitsministeeriumi 2024. aasta vanemaealiste kuriteoohvrite analüüsist.

- Selected context IDs: sotsiaalministeerium_seksuaalvagivalla_levimus_ja_hoiakud_eestis, sotsiaalkindlustusamet_eesti_elanikkonna_teadlikkuse_uuring_soopohise_vagivalla_ja_, sotsiaaltoo_vagivald-vanemaealiste-vastu-vajab-tahelepanu-2025-1, sotsiaalministeerium_vagivald_ja_naiste_tervis, sotsiaaltoo_sotsiaaltoo-1-2016-artikkel-21-perev-givallast-politseiniku-pilgu-l-bi
- Displayed sources: Anu Leps, 2025. Vägivald vanemaealiste vastu vajab tähelepanu. Sotsiaaltöö 1/2025 · lk 3–4, 6–9 · Vägivalla ennetus
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Anu Leps, 2025. Vägivald vanemaealiste vastu vajab tähelepanu. Sotsiaaltöö 1/2025 · lk 3–4, 6–9 · Vägivalla ennetus Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2023","65","22","41","13","2024"],"source_count":5,"whole_scope_checked":false,"buffered_response_ms":1555,"supporting_source_id":"sotsiaaltoo_vagivald-vanemaealiste-vastu-vajab-tahelepanu-2025-1","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":24,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Andis 22/41/13, mitte oodatud 10%=640, 6%=227 ja 2%=100.
- First divergent layer: generation

### V05

- Batch / turn: `R-B01` / 17
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte4cxsw007t27kmp732oby9`
- User / assistant message ID: `cmte4cxsv007s27km1we7e48p` / `cmte4d3to007v27kmmmckrjw0`
- Sent at UTC: `2026-08-29T08:29:02.481Z`
- Exact question:

> E-kursuse järelmõju – millal ja kelle hinnangud?

- Exact answer:

> 2026. aasta käsitlus kirjeldab e-kursuse sihtrühma ja sisu, kuid ei täpsusta, millal selle järelmõju hinnatakse ega kelle hinnangutele hindamine tugineb.
>
> Kinnitamata jäid hindamise aeg ning hindajate rühm – näiteks õppijad, koolitajad või tööandjad.

- Selected context IDs: sotsiaaltoo_sotsiaaltoo-4-2016-artikkel-04-asenduskodulapse-identiteedi-kujunemise-toetamin, astangu_erivajaduste_alase_teadlikkuse_tostmine, tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja, sotsiaaltoo_uus-e-kursus-pakub-tuge-sotsiaalvaldkonna-koolitajatele-2026, sotsiaalkindlustusamet_marac_i_vorgustiku_mudeli_moju_hindamine_loppraport
- Displayed sources: Ingrid Sindi, 2016. Asenduskodulapse identiteedi kujunemise toetamine elulootöö meetodil. Sotsiaaltöö 4/2016 · lk 21–31 · Eelretsenseeritud artiklid
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Ingrid Sindi, 2016. Asenduskodulapse identiteedi kujunemise toetamine elulootöö meetodil. Sotsiaaltöö 4/2016 · lk 21–31 · Eelretsenseeritud artiklid Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2026"],"source_count":5,"whole_scope_checked":false,"buffered_response_ms":7786,"supporting_source_id":"sotsiaaltoo_sotsiaaltoo-4-2016-artikkel-04-asenduskodulapse-identiteedi-kujunemise-toetamin","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":13,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei vastanud kuue kuu ega osaleja ja tööandja hinnangute kohta.
- First divergent layer: identity

### V06

- Batch / turn: `R-B01` / 18
- Conversation ID: `1d63311b-3621-4873-9c6a-a55e3053b287`
- Turn ID: `cmte4dw1o008927km6z7plvf2`
- User / assistant message ID: `cmte4dw1n008827kmx8tbg1bt` / `cmte4dxyw008b27kmjx3oewgo`
- Sent at UTC: `2026-08-29T08:29:44.702Z`
- Exact question:

> Laste eraldamise otsused: arv ja aasta?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_lapse-perekonnast-eraldamine-vaimse-tervise-probleemiga-vanemalt-2022-4, sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"unsupported_numeric_claim","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["33","2022"],"source_count":2,"whole_scope_checked":false,"buffered_response_ms":2481,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":8,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":["33"],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei vastanud 169 otsust ega aastat 2018.
- First divergent layer: identity

### A01

- Batch / turn: `R-B02` / 1
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4f8cr008q27kmqrpfbcob`
- User / assistant message ID: `cmte4f8cq008p27kmpqbalune` / `cmte4fare008s27kmikj2gf1b`
- Sent at UTC: `2026-08-29T08:30:51.214Z`
- Exact question:

> Milliseid teemasid käsitlevad Krister Tüllineni enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Krister Tüllineni enda autorlusega on kinnitatud artikkel „Taasühiskonnastamine vanglas” ajakirja Sotsiaaltöö 2016. aasta 3. numbris. Artiklis käsitletakse:
>
> - deinstitutsionaliseerimist ja normaalsusprintsiipi karistuse täideviimisel;
> - vangistuse kogukondlikke alternatiive;
> - institutsionaalse karistuse ehk vangistuse ja kogukondliku karistuse ehk kriminaalhoolduse erinevust;
> - vanglate minimaalse sekkumise põhimõtet ning kinnipeetavate suurema vastutuse kujundamist;
> - vangistuse, elektroonilise järelevalve ja kriminaalhoolduse rolli taasühiskonnastamisel.
>
> Kõigi Tüllineni enda artiklite teemade loetlemiseks jäi kinnitamata tema täielik autorlusega artiklite nimekiri.

- Selected context IDs: sotsiaaltoo_sotsiaaltoo-3-2016-artikkel-02-deinstitutsionaliseerimine-ja-normaalsus-printsi
- Displayed sources: Krister Tüllinen, 2016. Deinstitutsionaliseerimine ja normaalsus- printsiip karistuse täideviimise praktikas. Sotsiaaltöö 3/2016 · lk 3–8 · Taasühiskonnastamine vanglas
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Krister Tüllinen, 2016. Deinstitutsionaliseerimine ja normaalsus- printsiip karistuse täideviimise praktikas. Sotsiaaltöö 3/2016 · lk 3–8 · Taasühiskonnastamine vanglas Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2016","3"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":3105,"supporting_source_id":"sotsiaaltoo_sotsiaaltoo-3-2016-artikkel-02-deinstitutsionaliseerimine-ja-normaalsus-printsi","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":true,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":18,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":1,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PARTIAL**
- Reason: Leidis ühe kinnitatud oma artikli ja teemad, kuid jättis täieliku autoriloendi kinnitamata.
- First divergent layer: generation

### A02

- Batch / turn: `R-B02` / 2
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4gc2r009727km39oijp5g`
- User / assistant message ID: `cmte4gc2q009627kmlbh5125e` / `cmte4gcfo009a27kmvpabuvyu`
- Sent at UTC: `2026-08-29T08:31:42.070Z`
- Exact question:

> Milliseid teemasid käsitlevad Maarja Krais-Leoski enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Selected context IDs: —
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei leidnud autori enda artikleid ega teemasid.
- First divergent layer: identity

### A03

- Batch / turn: `R-B02` / 3
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4h49w009m27kmoefq4qgo`
- User / assistant message ID: `cmte4h49u009l27kmdkv6j9kp` / `cmte4h70k009o27kml6w70c2a`
- Sent at UTC: `2026-08-29T08:32:19.245Z`
- Exact question:

> Milliseid teemasid käsitlevad Kadi Lubi enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_sunnitusosakondade-sulgemise-tottu-tervishoiu-ja-sotsiaaltoo-koostoovajadus-2025-2, sotsiaaltoo_tervisealane-kirjaoskus-kuidas-jouda-tervise-vordsuseni-2025-2, sotsiaaltoo_liikumispuudega-naiste-raseduse-sunnituse-ja-sunnitusjargse-aja-kogemused-ning-valjakutsed-2022-2, sotsiaaltoo_eetika-koielkond-sotsiaalteadustes-2020-4
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"cross_source_numeric_mix","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["2025","2020","2025","2022"],"source_count":4,"whole_scope_checked":false,"buffered_response_ms":3539,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":true,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":4,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":4,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei leidnud autori enda artikleid ega teemasid.
- First divergent layer: validation

### A04

- Batch / turn: `R-B02` / 4
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4hwv300a327km1mjedklo`
- User / assistant message ID: `cmte4hwv200a227kmyi6bdmn1` / `cmte4hyud00a527km0sd937x8`
- Sent at UTC: `2026-08-29T08:32:56.031Z`
- Exact question:

> Milliseid teemasid käsitlevad Ave Ungro enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ave Ungro on koos Rain Leomaga kirjutanud artikli „COVID-19 mõjust sotsiaaltöö valdkonna tööjõu ja oskuste vajadusele“ (2021).
>
> Artiklis käsitletakse:
> - COVID-19 kriisi mõju sotsiaaltöö töökorraldusele;
> - sotsiaaltöö valdkonna tööhõive ja tööjõuvajaduse muutusi;
> - töötajate muutunud oskuste vajadust;
> - kriisist tingitud täiendusõppe ja koolitusvajadust;
> - seda, kuidas sotsiaaltöö asutused pidid töökorraldust ümber planeerima.
>
> Teiste Ave Ungro enda artiklite teemad ei ole kinnitatud.

- Selected context IDs: sotsiaaltoo_covid-19-mojust-sotsiaaltoo-valdkonna-toojou-ja-oskuste-vajadusele-2021-2
- Displayed sources: Ave Ungro, 2021. COVID-19 mõjust sotsiaaltöö valdkonna tööjõu ja oskuste vajadusele. Sotsiaaltöö 2/2021 · lk 1–2 · Analüüs
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Ave Ungro, 2021. COVID-19 mõjust sotsiaaltöö valdkonna tööjõu ja oskuste vajadusele. Sotsiaaltöö 2/2021 · lk 1–2 · Analüüs Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["19","2021","19"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":2553,"supporting_source_id":"sotsiaaltoo_covid-19-mojust-sotsiaaltoo-valdkonna-toojou-ja-oskuste-vajadusele-2021-2","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":true,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":6,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":1,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PARTIAL**
- Reason: Leidis ühe oma artikli ja teemad, kuid jättis täieliku autoriloendi kinnitamata.
- First divergent layer: generation

### A05

- Batch / turn: `R-B02` / 5
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4iubm00ak27kmb84ulic4`
- User / assistant message ID: `cmte4iubm00aj27kmf0jokbay` / `cmte4ixva00am27km7h39ta56`
- Sent at UTC: `2026-08-29T08:33:39.362Z`
- Exact question:

> Milliseid teemasid käsitlevad Jane Langemetsa enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_tallinna-erihoolekande-ja-rehabilitatsiooni-keskus-jargib-vaartusi-ja-loob-voimalusi-2025-2, sotsiaaltoo_kao-tugikeskus-inimnaoline-teenus-2022-3
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"cross_source_numeric_mix","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["2022","2025"],"source_count":2,"whole_scope_checked":false,"buffered_response_ms":4585,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":true,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":2,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":2,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei leidnud autori enda artikleid ega teemasid.
- First divergent layer: validation

### A06

- Batch / turn: `R-B02` / 6
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4jnsy00b127kmwt8p29ld`
- User / assistant message ID: `cmte4jnsx00b027kmzdefxka0` / `cmte4jo1w00b427kmy6st0mmq`
- Sent at UTC: `2026-08-29T08:34:17.329Z`
- Exact question:

> Milliseid teemasid käsitlevad Liina Lokko enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Selected context IDs: —
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei leidnud autori enda artikleid ega teemasid.
- First divergent layer: identity

### A07

- Batch / turn: `R-B02` / 7
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4kpy100bg27kmkz5y6z6j`
- User / assistant message ID: `cmte4kpy000bf27kmqpy7httq` / `cmte4kspe00bi27kmhfmk8gtp`
- Sent at UTC: `2026-08-29T08:35:06.630Z`
- Exact question:

> Milliseid teemasid käsitlevad Kadri Kuulpaki enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_anne-tiko-intervjuu-2022-eri, sotsiaaltoo_lea-kore-haigla-sotsiaaltootaja-seob-sotsiaal-ja-tervishoiuvaldkonda-2023-4, sotsiaaltoo_tunnustamine-innustab-aasta-parima-omavalitsuse-sotsiaaltootajaid-2023-2, sotsiaaltoo_judit-strompli-ponev-teekond-sotsiaaltoo-uurija-ja-opetajana-2026, sotsiaaltoo_koolituse-ja-teenuste-arendaja-marju-medar-sotsiaaltool-pole-piire-2023-3, sotsiaaltoo_elut-preemia-laureaat-kai-rannastu-uksi-sotsiaaltood-ei-tee-2024-2, sotsiaaltoo_kersti-suun-deket-sotsiaaltoo-on-nagu-ratsepaulikonna-omblemine-2024-1, sotsiaaltoo_monika-salumaa-toeliselt-igav-kui-koik-oleksid-uhe-nao-ja-teoga-2023-1, sotsiaaltoo_dementsusega-inimestele-parima-abi-pakkumises-ollakse-poolel-teel-2025-3, sotsiaaltoo_piret-talur-persoon-2022-4
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"cross_source_numeric_mix","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["30","2022","2023","2023","2026","2023","2024","2024","2023","2025","2022"],"source_count":10,"whole_scope_checked":false,"buffered_response_ms":3560,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":true,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":9,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":18,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei leidnud autori enda artikleid ega teemasid.
- First divergent layer: validation

### A08

- Batch / turn: `R-B02` / 8
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4lii600bx27kmmgp5njeg`
- User / assistant message ID: `cmte4lii500bw27kmmarxts9k` / `cmte4ll3t00bz27kmz0q9vje2`
- Sent at UTC: `2026-08-29T08:35:44.171Z`
- Exact question:

> Milliseid teemasid käsitlevad Merle Tombergi enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: sotsiaaltoo_eesti-kristlike-sotsiaalteenuste-kontseptsioonid-2025-4, sotsiaaltoo_sotsiaalteenuste-kvaliteedi-arendamine-tallinna-vaimse-tervise-keskuses-2019
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"cross_source_numeric_mix","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["2019","2025"],"source_count":2,"whole_scope_checked":false,"buffered_response_ms":3359,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":true,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":4,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":2,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei leidnud Merle Tombergi enda artikleid ega teemasid.
- First divergent layer: validation

### A10

- Batch / turn: `R-B02` / 9
- Conversation ID: `conv-15e48bd5-66ef-4a7f-832a-a3096af8d572`
- Turn ID: `cmte4mc0200ce27kme82qiozo`
- User / assistant message ID: `cmte4mc0100cd27km17oe6bno` / `cmte4mca300ch27kmc0z35hl4`
- Sent at UTC: `2026-08-29T08:36:21.554Z`
- Exact question:

> Milliseid teemasid käsitlevad Judit Strömpli enda artiklid ajakirjas Sotsiaaltöö?

- Exact answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Selected context IDs: —
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei leidnud Judit Strömpli enda artikleid ega teemasid.
- First divergent layer: identity

### S08

- Batch / turn: `R-B03` / 1
- Conversation ID: `conv-4dc132be-d8df-4a4f-8518-d127c77752cb`
- Turn ID: `cmte4ntez00cs27kmetvaefsg`
- User / assistant message ID: `cmte4ntey00cr27km8j8l1ay9` / `cmte4ny3e00cu27kmwvedw0ot`
- Sent at UTC: `2026-08-29T08:37:31.285Z`
- Exact question:

> Mida kirjeldavad Sotsiaaltöö artiklid Saaremaa COVID-kogemuse ja kriisivalmiduse kohta?

- Exact answer:

> Sotsiaaltöö artiklid kirjeldavad Saaremaa COVID-19-kogemust kui olukorda, kus kohalik omavalitsus ja sotsiaalvaldkond pidid väga kiiresti ümber korraldama nii töö kui ka teenuste osutamise. Kriisivalmiduse keskmes olid selge kriisiplaan, kiire otsustamine, töötajate koostöö, toimiv kommunikatsioon ning tervishoiu ja sotsiaalhoolekande tihedam lõimimine.
>
> Saaremaa kogemuse põhijooned:
>
> - 2020. aasta kevadel rakendati Saaremaal piiranguid ja asutuste töökorraldust varakult. Kohalik omavalitsus moodustas kriisikomisjoni ning sotsiaaltöö ja hoolekanne korraldati üldjoontes ühe-kahe nädala jooksul ümber.
> - Koduhooldustöötajate töökoormus suurenes, samal ajal haigestus töötajaid ja osa neist kartis nakatumise tõttu teenust osutada. Eriolukorras piirdus koduhooldus sageli toidu ja ravimite viimisega ukse või väravani; tavapäraselt ei olnud võimalik osutada ka tugiisikuteenust, isikuhooldust ja isikliku abistaja teenust.
> - Hajaasustusega piirkondades tekkis raskusi transpordi ja teenuste kättesaadavusega. Samas selgus, et telefoni- ja veebipõhine asjaajamine ning töökoosolekud võivad vähendada sõidukulu ja ajakulu.
> - Oluliseks näiteks oli Saaremaa Kriisikodu loomine 2020. aasta kevadel. Saaremaa Südamekodu ja valla kriisikomisjon korraldasid seal haiglaravi mittevajanud COVID-iga nakatunud hooldekoduelanike majutamise, aidates kaitsta teisi hoolekandeasutusi ja tagada nende töö jätkumise.
> - Kriisis suurenes vabatahtlike roll. Käivitati eakatele suunatud seltsidaami abi, õpilaste vabatahtlik tegevus ja üksinda elavate eakatega suhtlemine.
> - Artiklid rõhutavad, et digilahendused ei asenda paljude abivajajate jaoks otsest inimlikku kontakti. Usalduslik suhe oma piirkonna sotsiaaltöötajaga jäi kriisis oluliseks.
>
> Kriisivalmiduse õppetunnid:
>
> 1. Kriisi tuleb käsitleda kompleksse kriisina, mis mõjutab korraga tervishoidu, sotsiaaltööd, hoolekannet ja majandust.
> 2. KOV-il peab olema selge kriisiplaan, ajakohane riskianalüüs, tegevusjuhised ja kindel vastutuse jaotus.
> 3. Töötajate ettevalmistusse tuleks lisada tervishoiu algteadmised, nakkushaiguste leviku põhialused, isikukaitsevahendite kasutamine ning kriisi- ja riskianalüüs.
> 4. Pärast kriisi tuleb kogemus läbi arutada ja dokumenteerida. Saaremaal täiendati ametijuhendeid, lisati nakkushaiguse korral tegutsemise juhised, korraldati isikukaitsevahendite koolitusi ja supervisioone ning tagati töötajatele kovisioon ja psühholoogiline abi.
> 5. Kriisis on määravad koostöö ja kogukonna sidusus. Saaremaa puhul aitasid toime tulla kohalike töötajate kogemus, kogukonna toetus, vabatahtlikud, meditsiinipersonal ja organisatsioonide ühine tegutsemine.
>
> 2020. aasta artikkel „Üheskoos tuleme kriisiga toime“ kajastab eeskätt kriisi vahetut algust ja töötajate pinget. 2021. aasta uurimus „COVID-19 kriisi mõju sotsiaaltöö ja hoolekande korraldusele. Saaremaa kogemus“ lisab sellele intervjuudel põhineva analüüsi ning konkreetsed soovitused KOV-idele ja sotsiaaltöö õppekavade arendamiseks.

- Selected context IDs: sotsiaaltoo_covid-19-kriisi-moju-sotsiaaltoo-ja-hoolekande-korraldusele-saaremaa-kogemus-2021-4, sotsiaaltoo_uheskoos-tuleme-kriisiga-toime-2020-2
- Displayed sources: Riina Koit, 2021. COVID-19 kriisi mõju sotsiaaltöö ja hoolekande korraldusele. Saaremaa kogemus. Sotsiaaltöö 4/2021 · lk 1–5 · Uurimus
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Riina Koit, 2021. COVID-19 kriisi mõju sotsiaaltöö ja hoolekande korraldusele. Saaremaa kogemus. Sotsiaaltöö 4/2021 · lk 1–5 · Uurimus Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["19","2020","1","2","2020","2020","2021","19"],"source_count":2,"whole_scope_checked":false,"buffered_response_ms":6029,"supporting_source_id":"sotsiaaltoo_covid-19-kriisi-moju-sotsiaaltoo-ja-hoolekande-korraldusele-saaremaa-kogemus-2021-4","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":34,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PARTIAL**
- Reason: Vastus oli sisukas, kuid kuvas laia sünteesi jaoks ainult ühe allika.
- First divergent layer: attribution

### M01

- Batch / turn: `R-B04` / 1
- Conversation ID: `conv-0ebd2030-6183-4611-8720-fa5417c84945`
- Turn ID: `cmte4pmze00d827kmmk1mwqw6`
- User / assistant message ID: `cmte4pmzd00d727kmzd2ff214` / `cmte4pnal00db27kmapq4rk4d`
- Sent at UTC: `2026-08-29T08:38:55.291Z`
- Exact question:

> Milline oli EPIKoja uuringu meetod, millal uuring tehti ja kui palju osalejaid selles oli?

- Exact answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Selected context IDs: —
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei vastanud uuringu meetodi, aja ega 42 osaleja kohta.
- First divergent layer: identity

### M02

- Batch / turn: `R-B04` / 2
- Conversation ID: `conv-0ebd2030-6183-4611-8720-fa5417c84945`
- Turn ID: `cmte4qhyl00dn27km8jyd4y5l`
- User / assistant message ID: `cmte4qhyk00dm27km3k2l4als` / `cmte4qjmg00dp27kmsvrlq62n`
- Sent at UTC: `2026-08-29T08:39:34.505Z`
- Exact question:

> Milliseid soovitusi andis EPIKoda Tallinnale?

- Exact answer:

> EPIKoja arengukava 2025–2030 ei sisalda esitatud katkendi põhjal Tallinnale eraldi suunatud soovitusi. Kinnitatud on üldisemad eesmärgid:
>
> - arendada EPIKoja ja liikmesorganisatsioonide eestvedajate ning liikmete pädevust õigus-, sotsiaal-, tervishoiu-, töö- ja haridusvaldkonnas;
> - tugevdada EPIKoda avatud, professionaalse ja jätkusuutliku võrgustikuorganisatsioonina;
> - kasutada piiratud ressursse võimalikult otstarbekalt;
> - hinnata tulemusi aruandluse ja ekspertide hinnangute abil.
>
> Tallinna kohta eraldi soovituste loetelu vajaks konkreetset Tallinna käsitlevat EPIKoja dokumenti või selle peatükki.

- Selected context IDs: epikoda_giidi_too_kasiraamat_pohimotted_ja_soovitused, sotsiaaltoo_ajakirja-juubel-inimeste-tutvustused-2018, sotsiaaltoo_mitte-minu-tagahoovis-kogukonna-arengu-seisukohast-2018, sotsiaaltoo_tuleviku-eesti-sotsiaaltoo-ja-sotsiaaltootaja-2018, sm-terviseprobleemiga-laste-perede-hea-tava-2025, epikoda_epikoja_arengukava_2025_2030
- Displayed sources: EPIKoja arengukava 2025–2030 · lk 12, 15
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad EPIKoja arengukava 2025–2030 · lk 12, 15 Ava allikas Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["2025","2030"],"source_count":6,"whole_scope_checked":false,"buffered_response_ms":2138,"supporting_source_id":"epikoda_epikoja_arengukava_2025_2030","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":8,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Kasutas üldist arengukava ega vastanud Tallinnale antud soovitustele.
- First divergent layer: identity

### M07

- Batch / turn: `R-B04` / 3
- Conversation ID: `conv-0ebd2030-6183-4611-8720-fa5417c84945`
- Turn ID: `cmte4rrg500e427km5s1swnkl`
- User / assistant message ID: `cmte4rrg200e327kmbuw6n9wb` / `cmte4rt5r00e627kmdxnw6gjd`
- Sent at UTC: `2026-08-29T08:40:21.499Z`
- Exact question:

> Milles seisneb Tarkvanema vestlustööleht ja kuidas seda kasutada?

- Exact answer:

> Kinnitatud teabest ei selgu, milles Tarkvanema vestlustööleht seisneb ega kuidas seda kasutada. Vastamiseks on vaja Tarkvanema vestlustöölehe enda juhendit või veebilehe täpset aadressi; kas saad selle dokumendi või lingi lisada?

- Selected context IDs: epikoda_epikoja_arengukava_2025_2030, epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026, praxis_centar_puudega_lastega_perede_toimetuleku_ja_vajaduste_uuring, oska_oska_sotsiaaltoo_uuringu_terviktekst_2021, praxis_centar_vanemaealiste_ja_eakate_toimetuleku_uuring_2015, sotsiaalministeerium_uuring_taisealiste_puudega_inimeste_puude_tuvastamise_abivaj
- Displayed sources: OSKA sotsiaaltöö uuringu terviktekst 2021 · lk 30
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad OSKA sotsiaaltöö uuringu terviktekst 2021 · lk 30 Ava allikas Teata allika veast
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei leidnud Tarkvanema vestlustöölehte ega vastanud kasutamise kohta.
- First divergent layer: identity

### K01

- Batch / turn: `R-B05` / 1
- Conversation ID: `conv-956db30f-3e77-44f3-8825-ac5d719f1897`
- Turn ID: `cmte4stm500ep27kmva2056tq`
- User / assistant message ID: `cmte4stm200eo27km4ubqgs4l` / `cmte4swy000er27kmcrk5mhc7`
- Sent at UTC: `2026-08-29T08:41:17.465Z`
- Exact question:

> Kuidas taotleda Kuusalu vallas koduteenust ja mida sätestab selle kohta § 6?

- Exact answer:

> Kuusalu vallas saab koduteenust taotleda, esitades avalduse Kuusalu Vallavalitsuse sotsiaalteenistusele kas SPOKU kaudu või paberil. Pärast avalduse esitamist hinnatakse inimese abivajadust ja toimetulekut kodustes tingimustes.
>
> § 6 „Koduteenus“ sätestab, et teenuse eesmärk on tagada täisealise inimese iseseisev ja turvaline toimetulek kodus ning säilitada või parandada tema elukvaliteeti. Koduteenust osutatakse inimesele, kes ei suuda terviseseisundi, tegevusvõime või elukeskkonna tõttu vajalikke toiminguid kõrvalabita teha.
>
> Teenuse raames võib abi hõlmata näiteks:
>
> - teabe edastamist ja asjaajamist;
> - arstiabi korraldamist ning ravimite ja abivahenditega varustamist;
> - toiduainete ja majapidamistarvete hankimist;
> - koduseid töid, sealhulgas kütmist ning kütte ja vee toomist;
> - enesehooldust, sealhulgas pesemise korraldamist;
> - eluruumi korrastamist;
> - muid kokkulepitud tegevusi, mis toetavad inimese iseseisvat toimetulekut.
>
> § 6 kohaselt osutatakse teenust iga inimese jaoks koostatud personaalse hoolduskava alusel. Kuusalu valla teenuselehel on sihtrühmana kirjeldatud vallaelanikke, kes vajavad igapäevatoimingutes teiste inimeste abi; abivajadus võib olla seotud näiteks liikumis-, nägemis- või mäluprobleemidega.
>
> Taotluse saab esitada Kuusalu valla koduteenuse lehel: https://www.kuusalu.ee/koduteenus
> Õiguslik alus: Kuusalu valla „Sotsiaalhoolekandelise abi andmise kord“, § 6 „Koduteenus“: https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv
>
> Kasutatud allikad ei kinnita koduteenuse konkreetset kontaktisikut ega taotlusvormi linki piisavalt.

- Selected context IDs: kov-rt-kuusalu-vald|paragraph-6|Koduteenus, kov_kuusalu_vald_item_kuusalu_vald_service_koduteenus
- Displayed sources: Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus · Koduteenus
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Kuusalu vald. Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus · Koduteenus. kehtiv kohalik õigusakt Ava allikas Teata allika veast
- Fact validation: {"passed":true,"reason":"all_claims_in_one_rendered_source","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"year_mode":"not_requested","claim_values":["6","6","6","406062023041"],"source_count":2,"whole_scope_checked":false,"buffered_response_ms":4272,"supporting_source_id":"kov-rt-kuusalu-vald\|paragraph-6\|Koduteenus","missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":5,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":[],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **PASS**
- Reason: Andis Kuusalu taotlemise korra, § 6 sisu ja ametlikud KOV/õigusallikad.
- First divergent layer: —

### K02

- Batch / turn: `R-B05` / 2
- Conversation ID: `conv-956db30f-3e77-44f3-8825-ac5d719f1897`
- Turn ID: `cmte4tqqx00f927kmjb32xbw4`
- User / assistant message ID: `cmte4tqqv00f827km92jwp1ef` / `cmte4tt0y00fb27km5c8mpz9u`
- Sent at UTC: `2026-08-29T08:42:02.074Z`
- Exact question:

> Kuidas taotleda Narva linnas koduteenust?

- Exact answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Selected context IDs: kov_narva_linn_item_narva_linn_service_koduteenus
- Displayed sources: —
- Source button / panel: EI / EI
- Source panel text: —
- Fact validation: {"passed":false,"reason":"unsupported_numeric_claim","enabled":true,"version":"exact_numeric_fact_v6","buffered":true,"claim_values":["10","5","9.00","12.00","13.00","16.00"],"source_count":1,"whole_scope_checked":false,"buffered_response_ms":2919,"missing_contact_names":[],"supporting_source_ids":[],"author_corpus_complete":false,"author_corpus_required":false,"temporal_missing_years":[],"validation_duration_ms":4,"contact_monitor_checked":false,"contact_role_count_seen":[],"temporal_claim_bindings":[],"observed_category_values":[],"unexpected_contact_items":[],"unsupported_claim_values":["5","9.00","12.00","13.00","16.00"],"category_relation_checked":false,"contact_inventory_checked":false,"document_identity_matched":false,"document_identity_required":false,"mismatched_category_labels":[],"contact_role_count_expected":[],"requested_metric_slot_count":0,"unsupported_category_labels":[],"author_corpus_document_count":0,"contact_check_cadence_claims":[],"contact_inventory_total_seen":[],"document_identity_confidence":"not_required","contact_email_relation_checked":false,"contact_phone_relation_checked":false,"requested_metric_slot_bindings":[],"temporal_supplemental_bindings":[],"contact_check_cadence_validated":false,"unsupported_contact_date_values":[],"contact_inventory_total_expected":[],"temporal_supplemental_source_ids":[],"unsupported_contact_email_values":[],"unsupported_contact_phone_values":[],"requested_metric_contract_checked":false,"unsupported_contact_check_cadences":[],"unsupported_contact_role_relations":[],"unsupported_contact_email_relations":[],"unsupported_contact_phone_relations":[],"requested_fact_slot_contract_checked":false}
- Verdict: **FAIL**
- Reason: Ei vastanud Narva linna koduteenuse taotlemise korra kohta.
- First divergent layer: generation

### K05

- Batch / turn: `R-B05` / 3
- Conversation ID: `conv-956db30f-3e77-44f3-8825-ac5d719f1897`
- Turn ID: `cmte4upr300fw27kmxt0yaa3p`
- User / assistant message ID: `cmte4upr200fv27kmmzpepod0` / `cmte4urqp00g027km7ase1su3`
- Sent at UTC: `2026-08-29T08:42:41.255Z`
- Exact question:

> Millistel tingimustel ja kuidas saab Tartu sotsiaaltransporti kasutada?

- Exact answer:

> Kasutatud materjalid ei kinnita piisavalt Tartu sotsiaaltranspordi kasutamise tingimusi ega taotlemise korda. Vastamiseks on vaja Tartu linna sotsiaaltranspordi ametlikku teenusekirjeldust, kus on kirjas sihtrühm, teenuse taotlemine, kasutamise tingimused, võimalik tasu ja kontaktid.

- Selected context IDs: sotsiaaltoo_sotsiaaltoo-erinumber-2016-artikkel-22-millistel-tingimustel-kasutab-heaolu-arengukava-sotsiaalse-e, kov_tartu_linn_item_tartu_linn_service_ajutine_hooldusteenus_hoolekandeasutuses, kov-rt-tartu-vald|paragraph-89|Toimetulekutoetus, sotsiaaltoo_uhinenud-kov-kogemus-2017-1
- Displayed sources: Ajutine hooldusteenus hoolekandeasutuses · Teenused; Rasmus Pedanik, 2016. Millistel tingimustel kasutab heaolu arengukava sotsiaalse ettevõtluse potentsiaali?. Sotsiaaltöö erinumber 2016 · lk 78–82 · Kodanikuühiskond
- Source button / panel: JAH / JAH
- Source panel text: Vastuste allikad Tartu linn. Ajutine hooldusteenus hoolekandeasutuses · Teenused. kehtiv teenuseinfo Ava allikas Teata allika veast Rasmus Pedanik, 2016. Millistel tingimustel kasutab heaolu arengukava sotsiaalse ettevõtluse potentsiaali?. Sotsiaaltöö erinumber 2016 · lk 78–82 · Kodanikuühiskond Teata allika veast
- Fact validation: —
- Verdict: **FAIL**
- Reason: Ei vastanud Tartu sotsiaaltranspordi tingimuste ega kasutamise korra kohta.
- First divergent layer: context
