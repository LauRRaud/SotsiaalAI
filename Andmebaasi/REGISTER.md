# Andmebaasi allikad ja failiregister

Siin on andmebaasi sisendmaterjalid ja nendega seotud metaandmed. Täielik masinloetav faililoend koos SHA-256 kontrollsummadega on [REGISTER.json](REGISTER.json). Mis on serveris RAG-is, näitab jaotis „RAG-i seis: mis on serveris“; lehtede ja kontaktide loend on faili lõpus.

| Kaust | Allikafaile | Faile kokku | Kasutus |
|---|---:|---:|---|
| ajakiri_sotsiaaltoo | 892 | 1784 | 892 artiklit: 849 PDF-i ja 43 HTML-i koos metaandmetega. |
| juhendid_ja_uuringud | 185 | 370 | Unikaalsed PDF-id; JSON säilitab kohaliku ja serveri metaandmevariandid. |
| KOV | 78 | 234 | 78 KOV-i põhipaketti koos metaandmete ja allikaloenditega. |
| kontaktid | 0 | 10 | Kontaktide otsingumaterjal; kattuvus KOV-pakettidega vajab ühendamist. |
| organisatsioonid | 1 | 3 | Ühe organisatsiooni (Astangu) käsitsi koostatud pakett: sisu ja allikad. RAG-is seda paketti ei ole. Organisatsioonide enda veebilehed on RAG-is (vt „RAG-i seis“). |
| oigusaktid | 640 | 654 | XML-aktid, sh eri redaktsioonid ja omavalitsuste teised kehtivad sotsiaalaktid (ADR-058); kehtivus tuleb vastuvõtul kontrollida. Aktide lisadest tuletatud allikad (`lisad/`): kaks tabelit (ADR-050) ja kaksteist omavalitsuse lisa teksti (ADR-053); iga tuletatud allikas nimetab oma akti redaktsiooni. Üks akt on allikas ainult nimetatud paragrahvide ulatuses (registrikirje väli `xml_sections`, ADR-076): `103072026024.xml`, 2026. aasta riigieelarve seaduse § 2; fail ise on Riigi Teataja algfail. |
| teadmised | 0 | 7 | Allikapõhised teadmiskaardid (tingimused, erandid, mõisted ja nende seosed) valitud allikatele; iga fail on seotud oma allika räsiga (ADR-054). |
| register | 0 | 9 | Kavandatud allikate register ja korjatavate veebilehtede nimekirjad (`web_pages.json` ametlikud juhislehed, `web_pages_state_help.json` riigi tasandi abi juhislehed (pension, perehüvitised, elatisabi, perelepitus; ADR-111), `web_pages_state_help_2.json` riigi tasandi abi teine partii (ravikindlustus, kohtusse pöördumine, võlad, pärimine, ohvriabi, puue ja hoolekanne, politsei juhised; ADR-112), `web_pages_state_help_3.json` kolmas partii (riigi õigusabi, täitemenetlus, perekonna- ja pärimisõigus, kuriteoohvri õigused, toe vajadusega õpilane; ADR-115), `web_pages_vendors.json` abivahendite müüjate lehed, `web_pages_organisations.json` puuetega inimeste organisatsioonide lehed koos mustriga, mis pealkirja järgi välja jääb; ADR-095), mitte teadmistekst. Mis müüjate ja organisatsioonide lehtedest RAG-is on, näitab „RAG-i seis“. `newsletter_documents.json` on ajakirja Sotsiaaltöö uudiskirjas viidatud dokumentide loend (ADR-099): pealkiri, väljaandja ametlik aadress ja seis, sh need, mida RAG-is ei ole (ingliskeelsed, tekstikihita, liiga suured, vastuvõtu kinni peetud, arvutabelid). |
| veebilehed | 361 | 722 | Ametlikud juhislehed, korjatud skriptiga `scripts/rag-v2-web-pages.mjs` (ADR-095): lehe sisuosa ilma saidi menüüde ja isikute kontaktideta, metaandmetes aadress, kontrolli kuupäev ja viidatud dokumendid. |
| taastatud_allikad | 0 | 22 | Serveri vanast indeksist taastatud tekst. Enne importi võrrelda põhipakettidega. |

<!-- corpus-state:start (kirjutab scripts/rag-v2-register-corpus.mjs; käsitsi ei muudeta) -->
## RAG-i seis: mis on serveris (korpus v84)

Seis 11.10.2026: serveris töötav RAG (korpus **v84**, indeks `74de5ca3`) sisaldab **10 569 dokumenti** (93 401 lõiku). Arvud on loetud korpusest skriptiga `scripts/rag-v2-register-corpus.mjs`; pärast iga korpuse täiendust käivitatakse see uuesti.

| Mis on RAG-is | Dokumente | Kus on loend |
|---|---:|---|
| Omavalitsuste teenused ja toetused | 3195 | jaotis „Sisufailid“ |
| Taotlusvormid (vastuses antakse lingina) | 872 | jaotis „Sisufailid“ |
| Omavalitsuste kontaktid | 1638 | faili lõpus arvudena omavalitsuste kaupa (nimesid siia ei kirjutata) |
| Ajakirja Sotsiaaltöö artiklid | 892 | jaotis „Sisufailid“ |
| Õigusaktid | 594 | jaotis „Sisufailid“ |
| Juhendid, infomaterjalid ja uuringud | 436 | jaotis „Sisufailid“; väljaandja ametlikult aadressilt lisatud on faili lõpus |
| Ametlikud juhislehed (ametite veebilehed) | 1587 | jaotis „Sisufailid“; väljaandja ametlikult aadressilt lisatud on faili lõpus |
| Organisatsioonide enda lehed (puuetega inimeste organisatsioonid, toidupank, sotsiaaltöö assotsiatsioon, kriisi- ja vaimse tervise ühingud) | 1132 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| Hooldekodude kohamaksumus omavalitsuste kaupa | 79 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| Abivahendite müügi- ja üüripunktid | 93 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| Abivahendite müüjate lehed | 51 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| **Kokku** | **10569** | |

<details><summary>Tehniline jaotus arendajale: kus allikafailid asuvad</summary>

Dokumentide arvud ei võrdu ülal olevate failide arvudega: üks fail võib anda mitu dokumenti (omavalitsuse pakett annab teenuste, vormide ja kontaktide dokumendid). `REGISTER.json` näitab iga allikafaili juures, mitu dokumenti see annab (`corpus_documents`).

| Kaust | Dokumente | Allikaliigid |
|---|---:|---|
| `KOV` | 4498 | kov_service_info 3195, application_form 845, official_contact 431, web_form 17, pdf_form 6, official_form 4 |
| `ajakiri_sotsiaaltoo` | 892 | file 849, web 43 |
| `oigusaktid` | 594 | legal_act 594 |
| `veebilehed` | 361 | web_page 360, research_report 1 |
| `juhendid_ja_uuringud` | 171 | information_material 81, research_report 46, official_guideline 38, policy_analysis 6 |

Koodihoidlas (GitHub) ei ole 4053 dokumendi allikafaile; need on korpuse hoidlas (arvuti `tmp/` kaust ja server):

| Allikas | Dokumente | Millest tehakse | Miks ei ole koodihoidlas |
|---|---:|---|---|
| Omavalitsuste kontaktid ja kontaktikataloogid | 1207 | rakenduse kontaktiregistrist skriptiga `scripts/rag-v2-contact-export.mjs` (ADR-085, ADR-086) | isikute nimed, telefoninumbrid ja e-posti aadressid |
| Hooldekodude kohamaksumuse lehed | 79 | Sotsiaalkindlustusameti hinnaseire tabelist skriptiga `scripts/rag-v2-care-prices.mjs`, iga omavalitsuse kohta üks leht ja üks ülevaade (ADR-104) | hooldekodude telefoninumbrid; leht tehakse tabelist uuesti |
| Abivahendite müügi- ja üüripunktide lehed | 93 | Sotsiaalkindlustusameti kaarditabelist skriptiga `scripts/rag-v2-assistive-points.mjs`, iga omavalitsuse kohta üks leht (ADR-096) | punktide telefoninumbrid; leht tehakse tabelist uuesti |
| Abivahendite müüjate lehed | 51 (18 väljaandjat) | nimekiri `register/web_pages_vendors.json`, korjaja `scripts/rag-v2-web-pages.mjs` (ADR-095) | ettevõtete enda tekstid ja telefoninumbrid |
| Organisatsioonide enda lehed (puuetega inimeste organisatsioonid, toidupank, sotsiaaltöö assotsiatsioon, kriisi- ja vaimse tervise ühingud) | 1132 (68 väljaandjat) | nimekirjad `register/web_pages_organisations.json`, `register/web_pages_associations.json` ja `register/web_pages_associations_2.json` ning nimekirjade `register/web_pages_coverage_1.json` ja `_2.json` organisatsioonid, korjaja `scripts/rag-v2-web-pages.mjs` ja valik `scripts/rag-v2-web-select.mjs` (ADR-095, ADR-137, ADR-140) | organisatsioonide enda tekstid |
| Asutuste juhislehed, valitud reegliga | 1227 (13 väljaandjat) | nimekirjad `register/web_pages_coverage_1.json`, `register/web_pages_coverage_2.json` ja `register/web_pages_coverage_3.json` (õigusabi lehe toimetatud artiklid), korjaja `scripts/rag-v2-web-pages.mjs` ja valik `scripts/rag-v2-web-select.mjs` (ADR-137, ADR-143), ning `register/web_pages_tootukassa.json` (Töötukassa lehed 11.10.2026 brauserikorjest, ADR-146) | valik võtab lehest välja isikut nimetavad lõigud; repos olevate lehtede igakuine uuendus asendaks sellise koopia lugeja omaga |
| Uuringud ja juhendid väljaandja ametlikult aadressilt | 264 (33 väljaandjat) | asutuste veebilehtede uuringute ja juhendite loenditest ning ajakirja Sotsiaaltöö uudiskirjas viidatud dokumentidest (`register/newsletter_documents.json`); iga fail on alla laaditud väljaandja ametlikult aadressilt | suured failid; allikas on ametlik aadress |

Koodihoidla allikafailid, mida RAG-is ei ole (61):

- `juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est.pdf`
- `juhendid_ja_uuringud/epikoda_uro_puuetega_inimeste_oiguste_konventsioon_ja_fakultatiivpro.pdf`
- `juhendid_ja_uuringud/oiguskantsler_lapse_oigused.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_evaluation_of_the_impact_of_the_marac_networking_model.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_rus.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_ua.pdf`
- `juhendid_ja_uuringud/tarkvanem_tooleht_rahunemispaus.pdf`
- `juhendid_ja_uuringud/tarkvanem_tooleht_suhtekonto.pdf`
- `juhendid_ja_uuringud/vordoigusvolinik_arvamus_toovoimetuslehe_teemal.pdf`
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025-124cbc105c.pdf`
- `organisatsioonid/astangu.json`
- `oigusaktid/401112019012.xml`
- `oigusaktid/402022024018.xml`
- `oigusaktid/402062023117.xml`
- `oigusaktid/403042025006.xml`
- `oigusaktid/403042025042.xml`
- `oigusaktid/403102019005.xml`
- `oigusaktid/404052016003.xml`
- `oigusaktid/404122020026.xml`
- `oigusaktid/405022022004.xml`
- `oigusaktid/405042018002.xml`
- `oigusaktid/405042025021.xml`
- `oigusaktid/406022026039.xml`
- `oigusaktid/406032025001.xml`
- `oigusaktid/406062023011.xml`
- `oigusaktid/406102021036.xml`
- `oigusaktid/407052021021.xml`
- `oigusaktid/409052018051.xml`
- `oigusaktid/410042018010.xml`
- `oigusaktid/412062018006.xml`
- `oigusaktid/416022022003.xml`
- `oigusaktid/418112020001.xml`
- `oigusaktid/418122021013.xml`
- `oigusaktid/420112024006.xml`
- `oigusaktid/421062023039.xml`
- `oigusaktid/423112023018.xml`
- `oigusaktid/425032026041.xml`
- `oigusaktid/425042025025.xml`
- `oigusaktid/425092025018.xml`
- `oigusaktid/428042022001.xml`
- `oigusaktid/429082017013.xml`
- `oigusaktid/429122020017.xml`
- `oigusaktid/429122022021.xml`
- `oigusaktid/107052025017-0c660ae84a.xml`
- `oigusaktid/109042026003-c32621b97f.xml`
- `oigusaktid/129082025009-2df81da69b.xml`
- `oigusaktid/130122025036-cb751d4e16.xml`
- `oigusaktid/131122024023-ebfb6d1124.xml`
- `oigusaktid/410092025031-4add815064.xml`
- `oigusaktid/410092025033-4e1a686799.xml`
- `oigusaktid/412042025007-d607c4383a.xml`
- `oigusaktid/412042025015-cc7e755330.xml`
- `oigusaktid/413022026026-16d4366028.xml`
- `oigusaktid/425042025047-0a444c65d3.xml`
- `oigusaktid/426022025038-f9529b7eb7.xml`
- `oigusaktid/428122024033-efb23621fc.xml`
- `oigusaktid/130062026103.xml`

</details>
<!-- corpus-state:end -->

## Kasutamine

- `source`: sisufail, millele tuleb rakendada vastava allikatüübi vastuvõtt ja metaandmete teisendus.
- `metadata` ja `source_register`: sisufaili kirjeldus ning päritolu, mitte eraldi ingest.
- `reference_lookup`: kontaktimaterjal, mille kattuvused tuleb enne ühendamist lahendada.
- `review_source`: taastatud varasem tekst, mida ei tohi automaatselt põhipaketi kõrvale topelt importida.

20 Maardu vana serverikirjet ei vastanud kohaliku põhipaketi ID-dele; nende tekst säilib taastatud allikates. Seal säilivad ka Tallinna lisakirje ja vana SHS-i indeksi tekst. Kastre metaandmete ning põhipaketi erinevus säilib algsetes metaandmetes ja vajab vastuvõtul võrdlust.

## Arhiiv

[Varasem kaustatervik](../Arhiiv/Andmebaasi_2026-09-07/Andmebaasi/) säilitab algsed failid, duplikaadid, täisnumbrid, aruanded ja juhised. [Serveri tekstitaaste](../Arhiiv/Andmebaasi_2026-09-07/server-text-corpus-reference-20260907.json) säilitab 5011 varasema tekstikirje lõigud; see ei ole algne HTML ega automaatse ingesti sisend. Arhiivi ei indekseerita.

## Sisufailid

| Allikas | Fail |
|---|---|
| Eessõna | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_01_eessona.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_01_eessona.pdf>) |
| Lastekaitse juhtumikorraldusest sotsiaalteenuste ja -toetuste andmeregistris | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_02_lastekaitse_juhtumikorraldusest_sotsiaalteenuste_ja.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_02_lastekaitse_juhtumikorraldusest_sotsiaalteenuste_ja.pdf>) |
| Supervisiooniteenus kohalike omavalitsuste sotsiaaltöötajatele | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_03_supervisiooniteenus_kohalike_omavalitsuste_sotsiaalt.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_03_supervisiooniteenus_kohalike_omavalitsuste_sotsiaalt.pdf>) |
| Abivahendite teenus muutub paindlikumaks ja inimesele kättesaadavamaks | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_04_abivahendite_teenus_muutub_paindlikumaks_ja_inimesel.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_04_abivahendite_teenus_muutub_paindlikumaks_ja_inimesel.pdf>) |
| Uuest abivahendi korraldusest abivahendi ettevõtte silmade läbi | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_05_uuest_abivahendi_korraldusest_abivahendi_ettevotte_s.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_05_uuest_abivahendi_korraldusest_abivahendi_ettevotte_s.pdf>) |
| Töövõimereform: töövõime hindamine uutmoodi | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_06_toovoimereform_toovoime_hindamine_uutmoodi.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_06_toovoimereform_toovoime_hindamine_uutmoodi.pdf>) |
| Töövõimetoetuse maksmise tingimused | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_07_toovoimetoetuse_maksmise_tingimused.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_07_toovoimetoetuse_maksmise_tingimused.pdf>) |
| Deinstitutsionaliseerimine kui kogukonnapõhine teenuste osutamine abivajadusega inimestele | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_08_deinstitutsionaliseerimine_kui_kogukonnapohine_teenu.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_08_deinstitutsionaliseerimine_kui_kogukonnapohine_teenu.pdf>) |
| Erihoolekande taristu arendamine | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_09_erihoolekande_taristu_arendamine.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_09_erihoolekande_taristu_arendamine.pdf>) |
| Isiklik eelarve ja otsetoetused Ühendkuningriigis ja Soomes | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_10_isiklik_eelarve_ja_otsetoetused_uhendkuningriigis_ja.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_10_isiklik_eelarve_ja_otsetoetused_uhendkuningriigis_ja.pdf>) |
| Asutusest iseseisvasse ellu Tapa ja Imastu näitel | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_11_asutusest_iseseisvasse_ellu_tapa_ja_imastu_naitel.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_11_asutusest_iseseisvasse_ellu_tapa_ja_imastu_naitel.pdf>) |
| SA Autistika sai alguse elulisest vajadusest | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_12_sa_autistika_sai_alguse_elulisest_vajadusest.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_12_sa_autistika_sai_alguse_elulisest_vajadusest.pdf>) |
| Seltsidaami teenus Viljandis | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_13_seltsidaami_teenus_viljandis.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_13_seltsidaami_teenus_viljandis.pdf>) |
| Omastehooldaja asendusteenus Tallinnas | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_14_omastehooldaja_asendusteenus_tallinnas.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_14_omastehooldaja_asendusteenus_tallinnas.pdf>) |
| Eakate perehooldusteenus Soomes | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_15_eakate_perehooldusteenus_soomes.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_15_eakate_perehooldusteenus_soomes.pdf>) |
| Katarina Seeherr | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_16_katarina_seeherr.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_16_katarina_seeherr.pdf>) |
| SOS Lasteküla kogemus saatjata alaealistega | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_17_sos_lastekula_kogemus_saatjata_alaealistega.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_17_sos_lastekula_kogemus_saatjata_alaealistega.pdf>) |
| Euroopa integratsioonipoliitikate peegeldus immigrandi taustaga noorte täiskasvanute elulugudes | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_18_euroopa_integratsioonipoliitikate_peegeldus_immigran.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_18_euroopa_integratsioonipoliitikate_peegeldus_immigran.pdf>) |
| Kuni surm meid lahutab: naiste tõlgendused paarisuhtevägivalla riski ja ohvristumise teguritest ning toimetulekuviisidest | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_19_kuni_surm_meid_lahutab_naiste_tolgendused_paarisuhte.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_19_kuni_surm_meid_lahutab_naiste_tolgendused_paarisuhte.pdf>) |
| Kommentaar | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_20_kommentaar.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_20_kommentaar.pdf>) |
| Perevägivallast politseiniku pilgu läbi | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_21_perevagivallast_politseiniku_pilgu_labi.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_21_perevagivallast_politseiniku_pilgu_labi.pdf>) |
| Sotsiaaltöö valdkonnas käivitub tööjõu ja oskuste vajaduse prognoosisüsteem OSKA | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_22_sotsiaaltoo_valdkonnas_kaivitub_toojou_ja_oskuste_va.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_22_sotsiaaltoo_valdkonnas_kaivitub_toojou_ja_oskuste_va.pdf>) |
| Sotsiaaltöö kiirabi valdkonnas | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_23_sotsiaaltoo_kiirabi_valdkonnas.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_23_sotsiaaltoo_kiirabi_valdkonnas.pdf>) |
| Alkoholipoliitika kohalikul tasandil – pilootprojekti esmased õppetunnid ja tulemused | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_24_alkoholipoliitika_kohalikul_tasandil_pilootprojekti.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_24_alkoholipoliitika_kohalikul_tasandil_pilootprojekti.pdf>) |
| Paberkottide valmistamine Tallinna Sotsiaaltöö Keskuses | [ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_25_paberkottide_valmistamine_tallinna_sotsiaaltoo_keskuses.pdf](<ajakiri_sotsiaaltoo/16-1/2016_1_artikkel_25_paberkottide_valmistamine_tallinna_sotsiaaltoo_keskuses.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_01_eessona.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_01_eessona.pdf>) |
| Hoolekandeteenuste arendamise esimene avatud taotlusvoor | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_02_hoolekandeteenuste_arendamise_esimene_avatud_taotlus.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_02_hoolekandeteenuste_arendamise_esimene_avatud_taotlus.pdf>) |
| Maakondlikud arenduskeskused analüüsisid hoolekandeteenuste arendamise võimalusi | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_03_maakondlikud_arenduskeskused_analuusisid_hoolekandet.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_03_maakondlikud_arenduskeskused_analuusisid_hoolekandet.pdf>) |
| Sotsiaalteenused ja -toetused sotsiaalhoolekande seaduse valguses | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_04_sotsiaalteenused_ja_toetused_sotsiaalhoolekande_sead.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_04_sotsiaalteenused_ja_toetused_sotsiaalhoolekande_sead.pdf>) |
| Paljuräägitud ja -oodatud elatisabi | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_05_paljuraagitud_ja_oodatud_elatisabi.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_05_paljuraagitud_ja_oodatud_elatisabi.pdf>) |
| Kiili valla sotsiaaltöötajad – meeskonnatöö musternäidis | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_06_kiili_valla_sotsiaaltootajad_meeskonnatoo_musternaid.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_06_kiili_valla_sotsiaaltootajad_meeskonnatoo_musternaid.pdf>) |
| Vabatahtlike kaasamisvõimalused sotsiaalvaldkonnas | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_07_vabatahtlike_kaasamisvoimalused_sotsiaalvaldkonnas.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_07_vabatahtlike_kaasamisvoimalused_sotsiaalvaldkonnas.pdf>) |
| Elukvaliteedi mõõtmine eri tüüpi toetatud eluasemeteenuste puhul | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_08_elukvaliteedi_mootmine_eri_tuupi_toetatud_eluasemete.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_08_elukvaliteedi_mootmine_eri_tuupi_toetatud_eluasemete.pdf>) |
| Rahvusvaheline lapsendamine Eestist Ameerikasse protsessis osalejate kogemuste põhjal | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_09_rahvusvaheline_lapsendamine_eestist_ameerikasse_prot.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_09_rahvusvaheline_lapsendamine_eestist_ameerikasse_prot.pdf>) |
| Soome sotsiaaltöös ja sotsiaaltöö koolituses on toimumas suured muutused | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_10_soome_sotsiaaltoos_ja_sotsiaaltoo_koolituses_on_toim.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_10_soome_sotsiaaltoos_ja_sotsiaaltoo_koolituses_on_toim.pdf>) |
| Sotsiaaltöö tudengi arvamus ideaalsest sotsiaaltööst | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_11_sotsiaaltoo_tudengi_arvamus_ideaalsest_sotsiaaltoost.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_11_sotsiaaltoo_tudengi_arvamus_ideaalsest_sotsiaaltoost.pdf>) |
| Üksildus kui sotsiaalne probleem | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_12_uksildus_kui_sotsiaalne_probleem.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_12_uksildus_kui_sotsiaalne_probleem.pdf>) |
| Narratiivteraapia kliinilises ja rakenduslikus sotsiaaltöös positiivse kehakuvandi kujunemise näitel teismelistel ja noorukitel | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_13_narratiivteraapia_kliinilises_ja_rakenduslikus_sotsi.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_13_narratiivteraapia_kliinilises_ja_rakenduslikus_sotsi.pdf>) |
| Mida räägivad SHARE tulemused Eesti nn hallist alast | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_14_mida_raagivad_share_tulemused_eesti_nn_hallist_alast.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_14_mida_raagivad_share_tulemused_eesti_nn_hallist_alast.pdf>) |
| Vanemate mõju õpilaste narkootikumide tarvitamisele Eestis | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_15_vanemate_moju_opilaste_narkootikumide_tarvitamisele.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_15_vanemate_moju_opilaste_narkootikumide_tarvitamisele.pdf>) |
| Jalatalla programm noortele, kes ei tööta ega õpi | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_16_jalatalla_programm_noortele_kes_ei_toota_ega_opi.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_16_jalatalla_programm_noortele_kes_ei_toota_ega_opi.pdf>) |
| Hakkame parandama asendushoolduse kvaliteeti | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_17_hakkame_parandama_asendushoolduse_kvaliteeti_enelis.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_17_hakkame_parandama_asendushoolduse_kvaliteeti_enelis.pdf>) |
| Rajaleidja keskus aitab leida suuna lapsel, noorel, lapsevanemal ja spetsialistil | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_18_rajaleidja_keskus_aitab_leida_suuna_lapsel_noorel_la.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_18_rajaleidja_keskus_aitab_leida_suuna_lapsel_noorel_la.pdf>) |
| Saaremaa eakad saavad ELVI kaudu suhelda ja spetsialistilt nõu küsida | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_19_saaremaa_eakad_saavad_elvi_kaudu_suhelda.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_19_saaremaa_eakad_saavad_elvi_kaudu_suhelda.pdf>) |
| Sotsiaaltöö õppekavad ja vastuvõtt 2016. aastal | [ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_20_sotsiaaltoo_oppekavad_ja_vastuvott_2016.pdf](<ajakiri_sotsiaaltoo/16-2/2016_2_artikkel_20_sotsiaaltoo_oppekavad_ja_vastuvott_2016.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_01_eessona.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_01_eessona.pdf>) |
| Deinstitutsionaliseerimine ja normaalsus- printsiip karistuse täideviimise praktikas | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_02_deinstitutsionaliseerimine_ja_normaalsus_printsiip_k.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_02_deinstitutsionaliseerimine_ja_normaalsus_printsiip_k.pdf>) |
| Töö vangi ja kriminaalhooldusalusega | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_03_too_vangi_ja_kriminaalhooldusalusega.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_03_too_vangi_ja_kriminaalhooldusalusega.pdf>) |
| Seksuaalkurjategijate kohtlemine karistuse kandmise ajal | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_04_seksuaalkurjategijate_kohtlemine_karistuse_kandmise.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_04_seksuaalkurjategijate_kohtlemine_karistuse_kandmise.pdf>) |
| Uimastisõltlaste rehabilitatsioon vanglasüsteemis | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_05_uimastisoltlaste_rehabilitatsioon_vanglasusteemis.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_05_uimastisoltlaste_rehabilitatsioon_vanglasusteemis.pdf>) |
| Väljast suletud, seest avatud: retsidiivsuse vähendamine noortele mõeldud kinniste asutuste abil | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_06_valjast_suletud_seest_avatud_retsidiivsuse_vahendami.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_06_valjast_suletud_seest_avatud_retsidiivsuse_vahendami.pdf>) |
| Tugiisik, majutusteenus ja nõustamine aitavad endistel vangidel kuritegevusest irduda | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_07_tugiisik_majutusteenus_ja_noustamine_aitavad_endiste.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_07_tugiisik_majutusteenus_ja_noustamine_aitavad_endiste.pdf>) |
| MAPPA loob koostööks paremad võimalused | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_08_mappa_loob_koostooks_paremad_voimalused.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_08_mappa_loob_koostooks_paremad_voimalused.pdf>) |
| Üldkasulik töö ja ootused koostööpartneritele | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_09_uldkasulik_too_ja_ootused_koostoopartneritele.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_09_uldkasulik_too_ja_ootused_koostoopartneritele.pdf>) |
| Mitmedimensiooniline pereteraapia õigusrikkumisi toime pannud lastele ja noortele | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_10_mitmedimensiooniline_pereteraapia_oigusrikkumisi_toi.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_10_mitmedimensiooniline_pereteraapia_oigusrikkumisi_toi.pdf>) |
| MDFT rakendamine vanglas nõuab erilisi oskusi | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_11_mdft_rakendamine_vanglas_nouab_erilisi_oskusi.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_11_mdft_rakendamine_vanglas_nouab_erilisi_oskusi.pdf>) |
| Maris Mõttus: „Positiivseid muutusi tuleb märgata ja julgustada” | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_12_maris_mottus_positiivseid_muutusi_tuleb_margata_ja_j.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_12_maris_mottus_positiivseid_muutusi_tuleb_margata_ja_j.pdf>) |
| Kuriteoennetus – kas kohaliku omavalitsuse mure? | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_13_kuriteoennetus_kas_kohaliku_omavalitsuse_mure.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_13_kuriteoennetus_kas_kohaliku_omavalitsuse_mure.pdf>) |
| „Murdepunkt” on noortele toeks | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_14_murdepunkt_on_noortele_toeks.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_14_murdepunkt_on_noortele_toeks.pdf>) |
| Vajaduspõhise peretoetuse rakendumisest | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_15_vajaduspohise_peretoetuse_rakendumisest.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_15_vajaduspohise_peretoetuse_rakendumisest.pdf>) |
| Juhtumikorraldus lastekaitsetöös: praktikutelt praktikutele | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_16_juhtumikorraldus_lastekaitsetoos_praktikutelt_prakti.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_16_juhtumikorraldus_lastekaitsetoos_praktikutelt_prakti.pdf>) |
| Riik teeb oma õue korda: kuidas mõjutab heaolu arengukava sotsiaaltööd ja hoolekannet? | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_17_riik_teeb_oma_oue_korda_kuidas_mojutab_heaolu_arengu.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_17_riik_teeb_oma_oue_korda_kuidas_mojutab_heaolu_arengu.pdf>) |
| Sotsiaaltöötajate tööalase toetuse kogemused | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_18_sotsiaaltootajate_tooalase_toetuse_kogemused.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_18_sotsiaaltootajate_tooalase_toetuse_kogemused.pdf>) |
| Kogukond ja sotsiaalne kaasatus | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_19_kogukond_ja_sotsiaalne_kaasatus.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_19_kogukond_ja_sotsiaalne_kaasatus.pdf>) |
| Kas Eestis on noorel liikumispuudega mehel võimalik iseseisvalt elada? | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_20_kas_eestis_on_noorel_liikumispuudega_mehel_voimalik.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_20_kas_eestis_on_noorel_liikumispuudega_mehel_voimalik.pdf>) |
| Hollandi sotsiaaltöö liigub detsentraliseerimise suunas | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_21_hollandi_sotsiaaltoo_liigub_detsentraliseerimise_suu.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_21_hollandi_sotsiaaltoo_liigub_detsentraliseerimise_suu.pdf>) |
| Vanemaealise ühiskonna vajaduste rahuldamise eeldus on pädevad spetsialistid | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_22_vanemaealise_uhiskonna_vajaduste_rahuldamise_eeldus.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_22_vanemaealise_uhiskonna_vajaduste_rahuldamise_eeldus.pdf>) |
| Hoolivad kogukonnad – Rõuge, Haanja ja Varstu | [ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_23_hoolivad_kogukonnad_rouge_haanja_ja_varstu.pdf](<ajakiri_sotsiaaltoo/16-3/2016_3_artikkel_23_hoolivad_kogukonnad_rouge_haanja_ja_varstu.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_01_eessona.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_01_eessona.pdf>) |
| Maie Salum: „Laps mõistab tundeid paremini kui sõnu” | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_02_maie_salum_laps_moistab_tundeid_paremini_kui_sonu.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_02_maie_salum_laps_moistab_tundeid_paremini_kui_sonu.pdf>) |
| „Nagu mänguasjad oleksime, et kes kelle oma on” – lapsed räägivad asenduskodus elamisest | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_03_nagu_manguasjad_oleksime_et_kes_kelle_oma_on_lapsed.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_03_nagu_manguasjad_oleksime_et_kes_kelle_oma_on_lapsed.pdf>) |
| Asenduskodulapse identiteedi kujunemise toetamine elulootöö meetodil | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_04_asenduskodulapse_identiteedi_kujunemise_toetamine_el.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_04_asenduskodulapse_identiteedi_kujunemise_toetamine_el.pdf>) |
| ÜRO lapse õiguste konventsiooni täiendavast aruandest | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_05_uro_lapse_oiguste_konventsiooni_taiendavast_aruandes.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_05_uro_lapse_oiguste_konventsiooni_taiendavast_aruandes.pdf>) |
| Kas elu koos emaga vanglas võib olla lapse parimates huvides? | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_06_kas_elu_koos_emaga_vanglas_voib_olla_lapse_parimates.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_06_kas_elu_koos_emaga_vanglas_voib_olla_lapse_parimates.pdf>) |
| Lastekaitsetöötaja õigus siseneda valdusesse ning kasutada selleks politsei abi | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_07_lastekaitsetootaja_oigus_siseneda_valdusesse_ning_ka.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_07_lastekaitsetootaja_oigus_siseneda_valdusesse_ning_ka.pdf>) |
| Kokkuvõte kordusuuringust „Lapse osalemine pereelus” | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_08_kokkuvote_kordusuuringust_lapse_osalemine_pereelus.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_08_kokkuvote_kordusuuringust_lapse_osalemine_pereelus.pdf>) |
| Abivajava lapse ja pere hindamine lastekaitsetöös: Harjumaa lastekaitsetöötajate mõtteid ja arvamusi kliendi kaasamisest | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_09_abivajava_lapse_ja_pere_hindamine_lastekaitsetoos_ha.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_09_abivajava_lapse_ja_pere_hindamine_lastekaitsetoos_ha.pdf>) |
| Lapse abivajaduse hindamisest lastekaitseseadus kontekstis Jõgevamaa näitel | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_10_lapse_abivajaduse_hindamisest_lastekaitseseadus_kont.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_10_lapse_abivajaduse_hindamisest_lastekaitseseadus_kont.pdf>) |
| Enesekindlamad ja iseseisvamad noored: kuidas kaasata erivajadusega noori noorsootöösse? | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_11_enesekindlamad_ja_iseseisvamad_noored_kuidas_kaasata.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_11_enesekindlamad_ja_iseseisvamad_noored_kuidas_kaasata.pdf>) |
| Integreeritud teenused laste vaimse tervise toetamiseks: ennetus, varajane märkamine ja õigeaegne abi | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_12_integreeritud_teenused_laste_vaimse_tervise_toetamis.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_12_integreeritud_teenused_laste_vaimse_tervise_toetamis.pdf>) |
| Õigusrikkumise toime pannud lapse abistamine | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_13_oigusrikkumise_toime_pannud_lapse_abistamine.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_13_oigusrikkumise_toime_pannud_lapse_abistamine.pdf>) |
| Tulemuslikum ja lapsesõbralikum õigussüsteem: laste mõjutamise põhimõtted ja võimalused | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_14_tulemuslikum_ja_lapsesobralikum_oigussusteem_laste_m.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_14_tulemuslikum_ja_lapsesobralikum_oigussusteem_laste_m.pdf>) |
| Seksuaalkäitumisprobleemidega ning teisi kahjustava seksuaalkäitumisega lapsed ja noored kui abivajajad | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_15_seksuaalkaitumisprobleemidega_ning_teisi_kahjustava.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_15_seksuaalkaitumisprobleemidega_ning_teisi_kahjustava.pdf>) |
| Rehabilitatsioonitöö Viru vangla noorteüksuses | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_16_rehabilitatsioonitoo_viru_vangla_noorteuksuses.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_16_rehabilitatsioonitoo_viru_vangla_noorteuksuses.pdf>) |
| Sotsiaalkindlustusamet: muudame teenused läbipaistvamaks ja mugavamaks | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_17_sotsiaalkindlustusamet_muudame_teenused_labipaistvam.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_17_sotsiaalkindlustusamet_muudame_teenused_labipaistvam.pdf>) |
| Sotsiaaltöö ja sotsiaaltööharidusega seotud päevakajalised teemad Ühendkuningriigis | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_18_sotsiaaltoo_ja_sotsiaaltooharidusega_seotud_paevakaj.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_18_sotsiaaltoo_ja_sotsiaaltooharidusega_seotud_paevakaj.pdf>) |
| Kuidas lahendada koolivägivalla probleemi | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_19_kuidas_lahendada_koolivagivalla_probleemi.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_19_kuidas_lahendada_koolivagivalla_probleemi.pdf>) |
| Lapse õigused alaealiste õigusemõistmise süsteemides Eestis ja Euroopa Liidus | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_20_lapse_oigused_alaealiste_oigusemoistmise_susteemides.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_20_lapse_oigused_alaealiste_oigusemoistmise_susteemides.pdf>) |
| Juhend asenduskodudes lastevastase vägivalla ennetamiseks ja vähendamiseks | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_21_juhend_asenduskodudes_lastevastase_vagivalla_ennetam.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_21_juhend_asenduskodudes_lastevastase_vagivalla_ennetam.pdf>) |
| Lapse õiguste elluviimine asendushoolduses – valdkonna spetsialistide koolitus | [ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_22_lapse_oiguste_elluviimine_asendushoolduses_valdkonna.pdf](<ajakiri_sotsiaaltoo/16-4/2016_4_artikkel_22_lapse_oiguste_elluviimine_asendushoolduses_valdkonna.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_01_eessona.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_01_eessona.pdf>) |
| Heaolu arengukava muudab sotsiaalsektorit | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_02_heaolu_arengukava_muudab_sotsiaalsektorit.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_02_heaolu_arengukava_muudab_sotsiaalsektorit.pdf>) |
| Koostöös HEA tegemine | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_03_koostoos_hea_tegemine.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_03_koostoos_hea_tegemine.pdf>) |
| Heaolu arengukava toetab koostööd, eesmärkide elluviimist ja õppimist | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_04_heaolu_arengukava_toetab_koostood_eesmarkide_elluvii.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_04_heaolu_arengukava_toetab_koostood_eesmarkide_elluvii.pdf>) |
| Regionaalareng ja sotsiaalne kaitse Eestis: seosed ja vastastikused mõjud | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_05_regionaalareng_ja_sotsiaalne_kaitse_eestis_seosed_ja.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_05_regionaalareng_ja_sotsiaalne_kaitse_eestis_seosed_ja.pdf>) |
| Eesti ainus kestlik ressurss on töötav inimene | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_06_eesti_ainus_kestlik_ressurss_on_tootav_inimene.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_06_eesti_ainus_kestlik_ressurss_on_tootav_inimene.pdf>) |
| Töötaja tervis on töökeskkonna nägu | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_07_tootaja_tervis_on_tookeskkonna_nagu.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_07_tootaja_tervis_on_tookeskkonna_nagu.pdf>) |
| OSKA uurib, milliseid oskusi vajab tuleviku tööturg | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_08_oska_uurib_milliseid_oskusi_vajab_tuleviku_tooturg.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_08_oska_uurib_milliseid_oskusi_vajab_tuleviku_tooturg.pdf>) |
| Pensionisüsteem jätkusuutlikuks | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_09_pensionisusteem_jatkusuutlikuks.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_09_pensionisusteem_jatkusuutlikuks.pdf>) |
| Vaesuse leevendamine peaks olema prioriteetne tegevus | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_10_vaesuse_leevendamine_peaks_olema_prioriteetne_tegevu.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_10_vaesuse_leevendamine_peaks_olema_prioriteetne_tegevu.pdf>) |
| Toetuste ja hüvitiste mõju majanduslikule toimetulekule | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_11_toetuste_ja_huvitiste_moju_majanduslikule_toimetulek.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_11_toetuste_ja_huvitiste_moju_majanduslikule_toimetulek.pdf>) |
| Ligipääsetavusega täieliku kaasatuse saavutamine | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_12_ligipaasetavusega_taieliku_kaasatuse_saavutamine.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_12_ligipaasetavusega_taieliku_kaasatuse_saavutamine.pdf>) |
| Kvaliteetne sotsiaalteenus on isikukeskne | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_13_kvaliteetne_sotsiaalteenus_on_isikukeskne.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_13_kvaliteetne_sotsiaalteenus_on_isikukeskne.pdf>) |
| Muudatused rehabilitatsioonisüsteemis: kuidas tuua vajalikud teenused õigel ajal õige inimeseni? | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_14_muudatused_rehabilitatsioonisusteemis_kuidas_tuua_va.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_14_muudatused_rehabilitatsioonisusteemis_kuidas_tuua_va.pdf>) |
| Sotsiaalselt investeeriv riik. Kuidas ja miks peaks omastehooldusesse investeerima? | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_15_sotsiaalselt_investeeriv_riik_kuidas_ja_miks_peaks_o.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_15_sotsiaalselt_investeeriv_riik_kuidas_ja_miks_peaks_o.pdf>) |
| Omastehooldus kui Eesti hoolekandesüsteemi vundament | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_16_omastehooldus_kui_eesti_hoolekandesusteemi_vundament.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_16_omastehooldus_kui_eesti_hoolekandesusteemi_vundament.pdf>) |
| Hoolduskoormuse vähendamise rakkerühm on kokku kutsutud süsteemsete muutuste saavutamiseks | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_17_hoolduskoormuse_vahendamise_rakkeruhm_on_kokku_kutsu.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_17_hoolduskoormuse_vahendamise_rakkeruhm_on_kokku_kutsu.pdf>) |
| Eesti vanemaealiste potentsiaali tuleb targalt toetada | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_18_eesti_vanemaealiste_potentsiaali_tuleb_targalt_toeta.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_18_eesti_vanemaealiste_potentsiaali_tuleb_targalt_toeta.pdf>) |
| Külliki Bode: „Kõik inimesed vajavad võimalusi eneseteostuseks” | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_19_kulliki_bode_koik_inimesed_vajavad_voimalusi_enesete.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_19_kulliki_bode_koik_inimesed_vajavad_voimalusi_enesete.pdf>) |
| Soolise võrdõiguslikkuse küsimused | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_20_soolise_vordoiguslikkuse_kusimused.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_20_soolise_vordoiguslikkuse_kusimused.pdf>) |
| Võrdsetest võimalustest ei saa enam mööda vaadata | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_21_vordsetest_voimalustest_ei_saa_enam_mooda_vaadata.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_21_vordsetest_voimalustest_ei_saa_enam_mooda_vaadata.pdf>) |
| Millistel tingimustel kasutab heaolu arengukava sotsiaalse ettevõtluse potentsiaali? | [ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_22_millistel_tingimustel_kasutab_heaolu_arengukava_sots.pdf](<ajakiri_sotsiaaltoo/16-eri/2016_eri_artikkel_22_millistel_tingimustel_kasutab_heaolu_arengukava_sots.pdf>) |
| Kuidas muuta asendushoolduse noorte siirdumine iseseisvasse ellu sujuvamaks | [ajakiri_sotsiaaltoo/17-1/2017_1_Part13.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part13.pdf>) |
| Deinstitutsionaliseerimine annab tõuke kogukonnatööle | [ajakiri_sotsiaaltoo/17-1/2017_1_Part9.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part9.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/17-1/2017_1_Part1.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part1.pdf>) |
| Veerandsada aastat südamega töötamist. Aarike hooldekeskuse juhataja Elle Ott | [ajakiri_sotsiaaltoo/17-1/2017_1_Part7.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part7.pdf>) |
| Haldusreformist ja sotsiaalteenustest Hiiumaa näitel | [ajakiri_sotsiaaltoo/17-1/2017_1_Part4.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part4.pdf>) |
| Head praktikad toetavad sotsiaalset kaasatust ja kestlikke kogukondi | [ajakiri_sotsiaaltoo/17-1/2017_1_Part8.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part8.pdf>) |
| Päevakajalised küsimused sotsiaaltöö praktikas ja sotsiaaltöö hariduses Itaalias | [ajakiri_sotsiaaltoo/17-1/2017_1_Part21.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part21.pdf>) |
| Trepist üles või alla. Eesti vajab tulemuslikumat kodutuse poliitikat | [ajakiri_sotsiaaltoo/17-1/2017_1_Part12.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part12.pdf>) |
| Kogukonna kaasamisest Vändra näitel | [ajakiri_sotsiaaltoo/17-1/2017_1_Part10.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part10.pdf>) |
| Sotsiaaltöö professioon, tööjõu vajadus ja ressurss | [ajakiri_sotsiaaltoo/17-1/2017_1_Part16.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part16.pdf>) |
| Kohalike omavalitsuste ühinemise vajadused ja võimalused sotsiaalteenuse osutamisel | [ajakiri_sotsiaaltoo/17-1/2017_1_Part2.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part2.pdf>) |
| Kohaliku omavalitsuse väljakutsed sotsiaalteenuste osutamisel | [ajakiri_sotsiaaltoo/17-1/2017_1_Part5.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part5.pdf>) |
| Maapiirkondade elamufondi probleemidega kaasnevad sotsiaalsed kitsaskohad | [ajakiri_sotsiaaltoo/17-1/2017_1_Part14.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part14.pdf>) |
| Mahajäetud majast saab keskus erivajadustega inimestele ja eakatele | [ajakiri_sotsiaaltoo/17-1/2017_1_Part22.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part22.pdf>) |
| Millest juhindub sotsiaaltöötaja oma praktikas | [ajakiri_sotsiaaltoo/17-1/2017_1_Part19.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part19.pdf>) |
| Ministeerium toetab sotsiaaltöö tegijaid | [ajakiri_sotsiaaltoo/17-1/2017_1_Part18.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part18.pdf>) |
| Tööjõu vajadus sotsiaaltöö valdkonnas kasvab demograafiliste muutuste tõttu | [ajakiri_sotsiaaltoo/17-1/2017_1_Part15.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part15.pdf>) |
| Tööturg vajab tarku valdkonna suunajaid ja visiooniloojaid | [ajakiri_sotsiaaltoo/17-1/2017_1_Part17.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part17.pdf>) |
| Sotsiaaltransporditeenuse arendamisest | [ajakiri_sotsiaaltoo/17-1/2017_1_Part6.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part6.pdf>) |
| Kooli kõrvalt tööl või töö kõrvalt koolis | [ajakiri_sotsiaaltoo/17-1/2017_1_Part20.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part20.pdf>) |
| Sotsiaaltöö korralduse kogemus ühinenud kohaliku omavalitsuse üksuses | [ajakiri_sotsiaaltoo/17-1/2017_1_Part3.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part3.pdf>) |
| Vaimse tervise strateegia 2016–2025 sõnastab valdkonna prioriteedid | [ajakiri_sotsiaaltoo/17-1/2017_1_Part11.pdf](<ajakiri_sotsiaaltoo/17-1/2017_1_Part11.pdf>) |
| Abivajaja omaosalus sotsiaalteenuse eest tasumisel | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part14.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part14.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part2.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part2.pdf>) |
| Eesti eesistumine aitab luua kaasavat ja kestlikku Euroopat | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part13.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part13.pdf>) |
| Epp Klooster: sotsiaaltööharidus ja sotsiaaltööga tegelemine muudab inimese sallivamaks | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part3.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part3.pdf>) |
| Erihoolekande teenussüsteemi arendamine teenuse disaini toel | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part21.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part21.pdf>) |
| Hästi toimiv lastekaitse kohalikul tasandil on saavutatav koostöös | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part16.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part16.pdf>) |
| Iga inimese jaoks on kuskil õige amet | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part6.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part6.pdf>) |
| Juhtumipõhine lähenemine perelepitusele | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part18.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part18.pdf>) |
| Julgus aitab edu saavutada | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part8.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part8.pdf>) |
| Koos kainema ja tervema Eesti poole | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part19.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part19.pdf>) |
| Kiriku tehtav sotsiaaltöö keskendub inimeste võimestamisele | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part23.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part23.pdf>) |
| Kõige ilusam ja raskem töö | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part4.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part4.pdf>) |
| Kool õpetas sotsiaalpedagoogilist mõtteviisi | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part11.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part11.pdf>) |
| Minu teekond sotsiaaltööni ja sealt edasi | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part7.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part7.pdf>) |
| Ülevaatlikult piiriülesest lastekaitsetööst | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part17.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part17.pdf>) |
| Sotsiaalpedagoogika peaks aitama inimesel avaneda | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part12.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part12.pdf>) |
| Sotsiaaltöö võlu on võimaluste rohkuses | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part5.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part5.pdf>) |
| Kuhu on maetud sotsiaaltöötaja kullapada? | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part25.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part25.pdf>) |
| Sotsiaaltöötaja suunab tähelepanu lahendustele ja võimalustele | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part9.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part9.pdf>) |
| Suurte erihooldekodude ümberkorraldamine on hoolikalt läbimõeldud protsess | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part20.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part20.pdf>) |
| Näiteid hoolekandeteenuste arendamise esimese avatud taotlusvooru projektidest | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part22.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part22.pdf>) |
| Töö noortega on tähtsamast tähtsam | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part26.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part26.pdf>) |
| Töö vabatahtlikuna toetas eneseleidmist | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part10.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part10.pdf>) |
| Sotsiaaltöö suundumused Tšehhi Vabariigis | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part24.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part24.pdf>) |
| Võileivapõlvkond – kes nad on ja kuidas neil läheb | [ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part15.pdf](<ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part15.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part2.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part2.pdf>) |
| Hanna-Stiina Heinmets, Jelena Leibur, Anu Varep: Hospiits on koht surmani elamiseks, mitte suremiseks | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part16.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part16.pdf>) |
| Interprofessionaalne meeskonnatöö: uus teema sotsiaaltöö praktikas ja uurimustes | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part10.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part10.pdf>) |
| Isikuandmete edastamisest ametialases koostöös | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part11.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part11.pdf>) |
| Kogukonnas peitub võimalus ja ressurss | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part18.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part18.pdf>) |
| Kohalike omavalitsuste sotsiaalvaldkonna prioriteedid vabatahtliku ühinemise kontekstis | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part5.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part5.pdf>) |
| Lastekaitsetöötajate tõlgendused lapsevanemaks olemisest | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part19.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part19.pdf>) |
| Leedu sotsiaaltöö areng ja sotsiaaltöötajate hariduse aktuaalsed küsimused | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part21.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part21.pdf>) |
| MARAC – võrgustikupõhine mudel lähisuhtevägivalla juhtumite korraldamiseks | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part13.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part13.pdf>) |
| Marianne Leis: meie ametis on kõige tähtsamad koostöö ja suhtlemine | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part3.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part3.pdf>) |
| Mida teed, ESÜS? | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part22.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part22.pdf>) |
| Miks on vaja asendushooldust muuta? | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part6.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part6.pdf>) |
| Mitmekesisusest ja novembris Eestis toimuvast mitmekesisuse lepete foorumist | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part8.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part8.pdf>) |
| Noorsootöö võrgustikud kohalikes omavalitsustes | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part20.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part20.pdf>) |
| Võrgustikutööst Tallinna Perekeskuse pereteenistuses | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part15.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part15.pdf>) |
| Uue töövõime hindamise süsteemi esimesed tulemused | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part4.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part4.pdf>) |
| Töövõimereform õnnestub koostöös | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part12.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part12.pdf>) |
| Uus toetus üksi elavatele pensionäridele | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part7.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part7.pdf>) |
| Vaimse tervise probleemidega noorte, neid toetavate spetsialistide ja tööandjate kogemused noorte töölerakendumisel | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part17.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part17.pdf>) |
| Võrgustikutöö | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part9.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part9.pdf>) |
| Võrgustikutöö pagulasperega Padise vallas | [ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part14.pdf](<ajakiri_sotsiaaltoo/17-3/Sotsiaaltoo_2017_3_veebi_uus_link_Part14.pdf>) |
| Aktuaalsed teemad Saksamaa sotsiaaltöö poliitikas, hariduses ja kutsetegevuses | [ajakiri_sotsiaaltoo/17-4/Aktuaalsed teemad Saksamaa sotsiaaltöö poliitikas, hariduses ja kutsetegevuses.pdf](<ajakiri_sotsiaaltoo/17-4/Aktuaalsed teemad Saksamaa sotsiaaltöö poliitikas, hariduses ja kutsetegevuses.pdf>) |
| Anu Hall otsib ja leiab häid lahendusi | [ajakiri_sotsiaaltoo/17-4/Anu Hall otsib ja leiab häid lahendusi.pdf](<ajakiri_sotsiaaltoo/17-4/Anu Hall otsib ja leiab häid lahendusi.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/17-4/Eessõna .pdf](<ajakiri_sotsiaaltoo/17-4/Eessõna .pdf>) |
| Hoolduskoormuse vähendamise esmased abinõud | [ajakiri_sotsiaaltoo/17-4/Hoolduskoormuse vähendamise esmased abinõud.pdf](<ajakiri_sotsiaaltoo/17-4/Hoolduskoormuse vähendamise esmased abinõud.pdf>) |
| Huvikaitse kui üks sotsiaaltöö tegemise viis Eesti puuetega inimeste kodade näitel | [ajakiri_sotsiaaltoo/17-4/Huvikaitse kui üks sotsiaaltöö tegemise viis Eesti puuetega inimeste kodade näitel.pdf](<ajakiri_sotsiaaltoo/17-4/Huvikaitse kui üks sotsiaaltöö tegemise viis Eesti puuetega inimeste kodade näitel.pdf>) |
| Info- ja kommunikatsioonitehnoloogia kasutamine sotsiaaltöös | [ajakiri_sotsiaaltoo/17-4/Info- ja kommunikatsioonitehnoloogia kasutamise sotsiaaltöös.pdf](<ajakiri_sotsiaaltoo/17-4/Info- ja kommunikatsioonitehnoloogia kasutamise sotsiaaltöös.pdf>) |
| Inimeste teadlikkus vaimse tervise säilitamisest ja psüühikahäiretest | [ajakiri_sotsiaaltoo/17-4/Inimeste teadlikkus vaimse tervise säilitamisest ja psüühikahäiretest.pdf](<ajakiri_sotsiaaltoo/17-4/Inimeste teadlikkus vaimse tervise säilitamisest ja psüühikahäiretest.pdf>) |
| Kliendist kodanikuks ehk personaalne taastumine vaimse tervise valdkonnas | [ajakiri_sotsiaaltoo/17-4/Kliendist kodanikuks ehk personaalne taastumine vaimse tervise valdkonnas.pdf](<ajakiri_sotsiaaltoo/17-4/Kliendist kodanikuks ehk personaalne taastumine vaimse tervise valdkonnas.pdf>) |
| Kogemused Kreekast ja Guatemalast | [ajakiri_sotsiaaltoo/17-4/Kogemused Kreekast ja Guatemalast.pdf](<ajakiri_sotsiaaltoo/17-4/Kogemused Kreekast ja Guatemalast.pdf>) |
| Kovisioon – hea võimalus, kuidas toetada sotsiaalvaldkonna töötajaid | [ajakiri_sotsiaaltoo/17-4/Kovisioon - hea võimalus, kuidas toetada sotsiaalvaldkonna töötajaid.pdf](<ajakiri_sotsiaaltoo/17-4/Kovisioon - hea võimalus, kuidas toetada sotsiaalvaldkonna töötajaid.pdf>) |
| Lapse heaolu hindamise käsiraamatust | [ajakiri_sotsiaaltoo/17-4/Lapse heaolu hindamise käsiraamatust.pdf](<ajakiri_sotsiaaltoo/17-4/Lapse heaolu hindamise käsiraamatust.pdf>) |
| Omavalitsustes tehtav töö pagulastega Tartu näitel | [ajakiri_sotsiaaltoo/17-4/Omavalitsustes tehtav töö pagulastega Tartu näitel.pdf](<ajakiri_sotsiaaltoo/17-4/Omavalitsustes tehtav töö pagulastega Tartu näitel.pdf>) |
| Pikaajalise hoolduse olukord Eestis ja riigi väljakutsed omastehooldajate koormuse vähendamisel | [ajakiri_sotsiaaltoo/17-4/Pikaajalise hoolduse olukord Eestis ja riigi väljakutsed omastehooldajate koormuse vähendamisel.pdf](<ajakiri_sotsiaaltoo/17-4/Pikaajalise hoolduse olukord Eestis ja riigi väljakutsed omastehooldajate koormuse vähendamisel.pdf>) |
| Pikaajalise hoolduse praegused probleemid ja võimalikud lahendused | [ajakiri_sotsiaaltoo/17-4/Pikaajalise hoolduse praegused probleemid ja võimalikud lahendused.pdf](<ajakiri_sotsiaaltoo/17-4/Pikaajalise hoolduse praegused probleemid ja võimalikud lahendused.pdf>) |
| Sotsiaalne innovatsioon – kellele ja kuidas? | [ajakiri_sotsiaaltoo/17-4/Sotsiaalne innovatsioon - kellele ja kuidas_.pdf](<ajakiri_sotsiaaltoo/17-4/Sotsiaalne innovatsioon - kellele ja kuidas_.pdf>) |
| Tõenduspõhine praktika ja selle rakendamine | [ajakiri_sotsiaaltoo/17-4/Tõenduspõhine praktika ja selle rakendamine.pdf](<ajakiri_sotsiaaltoo/17-4/Tõenduspõhine praktika ja selle rakendamine.pdf>) |
| Milline on tuleviku töö? | [ajakiri_sotsiaaltoo/17-4/Milline on tuleviku töö_.pdf](<ajakiri_sotsiaaltoo/17-4/Milline on tuleviku töö_.pdf>) |
| Uued lahendused heaolutalgutelt | [ajakiri_sotsiaaltoo/17-4/Uued lahendused heaolutalgutelt.pdf](<ajakiri_sotsiaaltoo/17-4/Uued lahendused heaolutalgutelt.pdf>) |
| Vabatahtlikkuse põhimõte üldhooldusteenuse osutamisel | [ajakiri_sotsiaaltoo/17-4/Vabatahtlikkuse põhimõte üldhooldusteenuse osutamisel.pdf](<ajakiri_sotsiaaltoo/17-4/Vabatahtlikkuse põhimõte üldhooldusteenuse osutamisel.pdf>) |
| Mis mõjutab vanemisega kohanemist? | [ajakiri_sotsiaaltoo/17-4/Mis mõjutab vanemisega kohanemist_.pdf](<ajakiri_sotsiaaltoo/17-4/Mis mõjutab vanemisega kohanemist_.pdf>) |
| Võimaluste kohvik võimalikuks | [ajakiri_sotsiaaltoo/17-4/Võimaluste kohvik võimalikuks.pdf](<ajakiri_sotsiaaltoo/17-4/Võimaluste kohvik võimalikuks.pdf>) |
| Anne Daniel-Karlsen – pühendunud perevägivallas kannatanud laste aitamisele | [ajakiri_sotsiaaltoo/18-1/Part3_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part3_155619647682_ST1_2018_link.pdf>) |
| Kultuuriliselt mitmekesine sotsiaaltööõpe Antwerpenis | [ajakiri_sotsiaaltoo/18-1/Part22_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part22_155619647682_ST1_2018_link.pdf>) |
| Deinstitutsionaliseerimine | [ajakiri_sotsiaaltoo/18-1/Part5_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part5_155619647682_ST1_2018_link.pdf>) |
| Dementsusega inimeste ja omastehooldajate vajadused | [ajakiri_sotsiaaltoo/18-1/Part10_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part10_155619647682_ST1_2018_link.pdf>) |
| Aasta 2018 algab hoolekandes muutuste tuules | [ajakiri_sotsiaaltoo/18-1/Part2_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part2_155619647682_ST1_2018_link.pdf>) |
| Omavalitsuse eestkostel oleva lapse elatisraha. Nõuda seda või mitte? | [ajakiri_sotsiaaltoo/18-1/Part13_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part13_155619647682_ST1_2018_link.pdf>) |
| HopeHolders: alati on lootust | [ajakiri_sotsiaaltoo/18-1/Part23_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part23_155619647682_ST1_2018_link.pdf>) |
| Miks ja kuidas kaasata sotsiaalteenuse arendamisel ja analüüsimisel kliente ja teisi olulisi osalisi? | [ajakiri_sotsiaaltoo/18-1/Part14_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part14_155619647682_ST1_2018_link.pdf>) |
| Muudatused asendushoolduse korralduses | [ajakiri_sotsiaaltoo/18-1/Part7_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part7_155619647682_ST1_2018_link.pdf>) |
| Naiste tugikeskuse teenuse arendamine | [ajakiri_sotsiaaltoo/18-1/Part15_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part15_155619647682_ST1_2018_link.pdf>) |
| NASW juhtumikorralduse standardite analüüs | [ajakiri_sotsiaaltoo/18-1/Part18_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part18_155619647682_ST1_2018_link.pdf>) |
| PRIDE eelkoolituse ning perevanema ja kasvataja baaskoolituse arendamine | [ajakiri_sotsiaaltoo/18-1/Part16_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part16_155619647682_ST1_2018_link.pdf>) |
| Probleemkohad kohalikes sotsiaalteenuste määrustes | [ajakiri_sotsiaaltoo/18-1/Part11_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part11_155619647682_ST1_2018_link.pdf>) |
| Aktuaalsed teemad Saksamaa sotsiaaltöö poliitikas, hariduses ja kutsetegevuses II | [ajakiri_sotsiaaltoo/18-1/Part20_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part20_155619647682_ST1_2018_link.pdf>) |
| Sotsiaalsem Euroopa sai Eesti eesistumise ajal märgilise pitseri | [ajakiri_sotsiaaltoo/18-1/Part4_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part4_155619647682_ST1_2018_link.pdf>) |
| Sotsiaalteenuste kvaliteedijuhised ja EQUASS kvaliteedijuhtimissüsteemi uus metoodika | [ajakiri_sotsiaaltoo/18-1/Part8_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part8_155619647682_ST1_2018_link.pdf>) |
| Sotsiaaltöötaja kutse taotlemisest | [ajakiri_sotsiaaltoo/18-1/Part19_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part19_155619647682_ST1_2018_link.pdf>) |
| Töötamise toetamine toimetulekutoetuse kaudu | [ajakiri_sotsiaaltoo/18-1/Part9_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part9_155619647682_ST1_2018_link.pdf>) |
| Mida on õppida Hollandi kohtumääruse alusel osutatavatest tugevdatud järelevalvega teenustest? | [ajakiri_sotsiaaltoo/18-1/Part17_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part17_155619647682_ST1_2018_link.pdf>) |
| Ülalpidamiskohustus eaka pereliikme seisukohast | [ajakiri_sotsiaaltoo/18-1/Part12_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part12_155619647682_ST1_2018_link.pdf>) |
| Kuidas anda vaimse tervise probleemide korral töökohal esmaabi? | [ajakiri_sotsiaaltoo/18-1/Part21_155619647682_ST1_2018_link.pdf](<ajakiri_sotsiaaltoo/18-1/Part21_155619647682_ST1_2018_link.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part2.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part2.pdf>) |
| Erihoolekandes on nii muresid kui ka rõõmustavaid arenguid | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part9.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part9.pdf>) |
| Haavatavus | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part16.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part16.pdf>) |
| Inimese väärtus | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part22.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part22.pdf>) |
| Sotsiaalne õiglus ja inimväärikus inimõigusalastes dokumentides | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part4.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part4.pdf>) |
| Inimväärikus ja sotsiaalne õiglus | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part15.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part15.pdf>) |
| Erihoolekande- ja rehabilitatsiooniteenused intellektipuudega inimeste eluilmas | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part19.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part19.pdf>) |
| Isikukeskse erihoolekande teenusmudel kaheksas omavalitsuses | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part10.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part10.pdf>) |
| Marina Runno: „Koostegutsemine annab palju jõudu ja kogemusi” | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part3.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part3.pdf>) |
| Mitu võtit teiste siseilma: empaatilised võimed ja koostöö | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part18.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part18.pdf>) |
| Kõik noodid on õiged: muusikateraapia võimalustest erivajadusega inimestele | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part21.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part21.pdf>) |
| Patsienditestament aitab arvestada inimese ravialaste soovidega | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part14.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part14.pdf>) |
| Põnevad ideed töövõime mõttetalgutelt | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part23.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part23.pdf>) |
| Puudega laste perede teenuste kasutamine ja nende vajadus | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part7.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part7.pdf>) |
| Sotsiaalministeerium: kitsaskohad on meile teada, otsime aktiivselt toimivaid lahendusi | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part6.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part6.pdf>) |
| Sotsiaaltöö praktika kui intersubjektiivne protsess | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part17.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part17.pdf>) |
| Spirituaalsus kui ressurss inimeste taastumisel ja rehabilitatsioonis | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part20.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part20.pdf>) |
| Väljaspool kodu osutatav üldhooldusteenus | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part11.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part11.pdf>) |
| Uued võimalused mitmekülgse abivajadusega lastele | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part8.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part8.pdf>) |
| Väärikas elu hooldekodus algab inimlikkusest ja hoolimisest | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part12.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part12.pdf>) |
| Valmis variraport „Puuetega inimeste eluolu Eestis” | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part5.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part5.pdf>) |
| Võlgniku ja võlausaldaja vastanduvate huvide tasakaal täitemenetluses | [ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part13.pdf](<ajakiri_sotsiaaltoo/18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part13.pdf>) |
| Aiandusteraapia parandab inimese tegevusvõimet | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part18.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part18.pdf>) |
| Andmekaitsespetsialist aitab muuta teenused turvaliseks ja usaldusväärseks | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part12.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part12.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part2.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part2.pdf>) |
| Haldusreform andis Elva sotsiaaltööle uue hingamise | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part7.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part7.pdf>) |
| Mida ootab sotsiaaltöö tudeng oma esimeselt erialaselt töökohalt? | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part19.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part19.pdf>) |
| Väikesest suureks – kas jõult või mõistuselt? 2017. a haldusterritoriaalse reformi mõju omavalitsuste hoolekandele | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part4.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part4.pdf>) |
| Hariduslike erivajadustega laste toetamine: muudatused põhikooli- ja gümnaasiumiseaduses | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part11.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part11.pdf>) |
| Hiiumaa: meretagune ühinemine tõi sotsiaaltöötajad kokku | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part6.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part6.pdf>) |
| Sotsiaaltöö ühinenud Jõgeva vallas | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part8.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part8.pdf>) |
| Kohalikud omavalitsused ja sotsiaalse kaitse rahastamine | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part5.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part5.pdf>) |
| Millist sotsiaalteenuste korraldust soovivad töötajad Lääne-Harju vallas | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part14.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part14.pdf>) |
| Maasotsiaaltöötajad räägivad oma tööst ja endast selle töö tegijana | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part13.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part13.pdf>) |
| Maavanema haldusjärelevalve toimetulekutoetuse üle kohalikus omavalitsuses | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part15.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part15.pdf>) |
| Rahvusvahelised lastekaitsejuhtumid Sotsiaalkindlustusameti praktikas | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part17.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part17.pdf>) |
| Haldusreform Rapla vallas | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part9.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part9.pdf>) |
| Riho Rahuoja: „Sotsiaalsed probleemid on olemas ja need vajavad meie tähelepanu!” | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part3.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part3.pdf>) |
| Tugevustele suunatud mõtteviis: pere kaasamist toetav lähenemine | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part16.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part16.pdf>) |
| Uued algatused hoolekandes | [ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part10.pdf](<ajakiri_sotsiaaltoo/18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part10.pdf>) |
| Aeg sisuliseks sotsiaaltööks | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part2.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part2.pdf>) |
| 130 aastat Anton Makarenko sünnist | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part20.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part20.pdf>) |
| Erivajadusega inimeste poliitika põhimõtete, teenuste ja toetuste ajakohastamise kava | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part6.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part6.pdf>) |
| Info- ja kommunikatsioonitehnoloogia võimalused sotsiaaltöös | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part19.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part19.pdf>) |
| Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part10.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part10.pdf>) |
| Kinnise lasteasutuse teenus | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part11.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part11.pdf>) |
| Laste esindajate suutlikkus toetada lapse osalemist menetlustes | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part17.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part17.pdf>) |
| Eesti elanike arvamus lastekaitsetööst ja meedia roll selle kuvandi kujunemisel | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part15.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part15.pdf>) |
| Mehed garaažis ehk CoMe Strong projekt | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part18.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part18.pdf>) |
| Miks ei kuule sotsiaaltöötajate häält? | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part21.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part21.pdf>) |
| Noored on vahel üllatunud, kui nende vastu huvi tuntakse | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part13.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part13.pdf>) |
| NULA ühiskondlike algatuste inkubaator | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part22.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part22.pdf>) |
| Riikliku ohvriabi arenguvajadused ohvriabitöötajate hinnangul | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part14.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part14.pdf>) |
| Pikaajaline hooldus seisab muutuste lävel | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part5.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part5.pdf>) |
| Pille Vaiksaar: eesmärk on, et lapsed saaksid meie juurest lahkudes eluga paremini hakkama | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part3.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part3.pdf>) |
| Poliitika suuna muutumine Eesti sotsiaalhoolekandes: viimase saja aasta kogemus | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part4.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part4.pdf>) |
| Saaremaal on ühinemisega saadud arenguvõimalused hästi ära kasutatud | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part7.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part7.pdf>) |
| Sotsiaalteenuste tutvustamisest linna ja valla kodulehel | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part9.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part9.pdf>) |
| Sotsiaaltöö haldusreformijärgses Tori vallas | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part8.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part8.pdf>) |
| Tähelepanu nõudvad probleemid Tartu Ülikooli Pärnu kolledži sotsiaaltöö tudengite silme läbi | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part16.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part16.pdf>) |
| Võrgustikukoostöö kohalikus omavalitsuses | [ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part12.pdf](<ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part12.pdf>) |
| Regina Lind: 20 aastat ajakirjaga Sotsiaaltöö | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part5.pdf>) |
| Sotsiaaltöö juubelinumbri eessõna | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part2.pdf>) |
| Sotsiaaltöö ajakirja kujundanud inimesed | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part4.pdf>) |
| Ajakiri Sotsiaaltöö – Laur Raudsoo vaade ajakirja arengule | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part3.pdf>) |
| Ajakirja Sotsiaaltöö kroonika | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part20ajakiri.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part20ajakiri.pdf>) |
| Ajakirja Sotsiaaltöö olemus (järg) | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part8.pdf>) |
| Ajakirja Sotsiaaltöö olemus | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part7.pdf>) |
| Esimesi sotsiaaltöö ajakirju maailmas: Fliegende Blätter aus dem Rauhen Hause zu Horn bei Hamburg | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part9.pdf>) |
| ESTA on Eesti sotsiaaltöötaja nägu | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part19.pdf>) |
| Kuidas jääda sotsiaaltöötajaks erialadevahelises koostöös? | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part16.pdf>) |
| Kuidas jätkata sotsiaaltööga pärast haldusreformi? | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part12.pdf>) |
| Kuidas luua paremaid suhteid kogukonnas? | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part14.pdf>) |
| Mary Richmond ja sada aastat teaduslikku sotsiaaltööd: „Social Diagnosis”, 1917 | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part10.pdf>) |
| Nähtus „mitte minu tagahoovis” kogukonna arengu seisukohast | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part15.pdf>) |
| Pilte ajakirja juubeliseminarilt | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part6.pdf>) |
| Sotsiaaltöö identiteedi põhilised komponendid | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part17.pdf>) |
| Kuidas paremini kaitsta sotsiaaltöötajate huve ja neid toetada? | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part18.pdf>) |
| Milline võiks olla tulevikus Eesti sotsiaaltöö ja sotsiaaltöötaja? | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part11.pdf>) |
| Vaeste hoolekandest sotsiaalhoolekandeks | [ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/18-eri/ST_eri_2018_web_link_Part13.pdf>) |
| Benita Kodu kogemus: kvaliteedi tagamine sotsiaal- ja tervishoiuvaldkonna organisatsioonis | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part10.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part10.pdf>) |
| Dementsus – meie kõigi ühine väljakutse | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part5.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part5.pdf>) |
| Irina Kalde: Iga klient ja iga töötaja on meil tähtsad | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part3.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part3.pdf>) |
| Koolitus „Koostöös lapse heaks” toetab kohalikke koostöövõrgustikke | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part20.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part20.pdf>) |
| Kui praktikast kasvab välja arendusvajadus. Teenuseosutaja vaade innovatsioonile ja riiklikule bürokraatiamasinale | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part12.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part12.pdf>) |
| Kuidas mõõta teenuste osutamise taset kohalikus omavalitsuses? Metoodika katsetamisest täiskasvanute sotsiaalhoolekandelise abi näitel | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part7.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part7.pdf>) |
| Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part15.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part15.pdf>) |
| Paikkonna tervisedendus pärast reformi | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part16.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part16.pdf>) |
| Samm-sammult kvaliteetsema teenusekorralduseni erihoolekande näitel | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part8.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part8.pdf>) |
| Lastemajateenus seksuaalselt väärkoheldud lastele | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part13.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part13.pdf>) |
| Sotsiaalala töötaja enesehoid ja teadveloleku oskuste kasutamine | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part18.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part18.pdf>) |
| Sotsiaalkaitse uue aasta väljakutsed ja tulevik valimiste valguses | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part4.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part4.pdf>) |
| Sotsiaalteenuste kvaliteedi arendamine Tallinna Vaimse Tervise Keskuses | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part9.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part9.pdf>) |
| Sotsiaaltöö keerukus ja kvaliteet muutuvas maailmas | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part2.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part2.pdf>) |
| Mõne omapäraga sotsiaaltöö Maardu linnas | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part14.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part14.pdf>) |
| Sotsiaaltööst – naerdes läbi pisarate | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part19.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part19.pdf>) |
| Sotsiaaltranspordi katseprojekt | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part6.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part6.pdf>) |
| Kas toetatud elamise teenus toetab enesemääramisõigust? | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part17.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part17.pdf>) |
| Väljaspool kodu osutatava üldhooldus- ja turvakoduteenuse pakkujatel on 2020. aastast vaja tegevusluba | [ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part11.pdf](<ajakiri_sotsiaaltoo/19-1/Sotsiaaltoo_nr1_2019_veeb_link_Part11.pdf>) |
| Kuidas MTÜ Ambla Kihelkonna Tugiteenused oma kliente toetab | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part9.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part9.pdf>) |
| Erihoolekande muutused ja kogukonda sulandumine | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part2.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part2.pdf>) |
| Eesti esimene kogukonnapõhine erihoolekandeküla autistidele | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019autistidele105.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019autistidele105.pdf>) |
| Häkaton kui koosloomel põhinev tööriist uudsete teenuste arendamisel | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part4.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part4.pdf>) |
| Kuidas naabritega hästi läbi saada? | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part8.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part8.pdf>) |
| Lähisuhtevägivalda kogenud naiste toetamine: vägivaldsest suhtest lahkumise ja sinna tagasipöördumise põhjused | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part14.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part14.pdf>) |
| Lihtsamalt ja kiiremini erihoolekandeteenusele | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part5.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part5.pdf>) |
| Mari-Liis Veski: mind on alati huvitanud inimeste elukäik | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part3.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part3.pdf>) |
| Mitmepalgeline üksildus SHARE vanemaealiste uuringu andmetel | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part17.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part17.pdf>) |
| Õiguskantsleri ametkonna tegevusest puuetega inimeste õiguste konventsiooni rakendamisel | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part7.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part7.pdf>) |
| Püsivaesus ja vaesus konkreetsel ajahetkel | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part16.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part16.pdf>) |
| Puuetega inimeste sotsiaalse rehabilitatsiooni vajaduse eelhindamine ja rehabilitatsiooniteenuste sisu kujundamine Eestis | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part11.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part11.pdf>) |
| Tugiisiku programm SÜTIK narkootikume tarvitavatele inimestele | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part10.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part10.pdf>) |
| Teekond institutsioonist personaalse taastumise poole | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part12.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part12.pdf>) |
| Tegevusjuhendaja versus hooldustöötaja | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part20.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part20.pdf>) |
| Toimetulekutoetuste määramisest ja maksmisest kohalikes omavalitsustes | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part6.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part6.pdf>) |
| Tugitoolist tegudeni ehk kuidas arendada enese ja teiste tegutsemistahet | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part19.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part19.pdf>) |
| Ülimitmekesisus – uus mõiste sotsiaaltöös | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part18.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part18.pdf>) |
| Väärikas vananemine: eri vanuses inimeste ootused ja tõlgendused | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part15.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part15.pdf>) |
| Vaimse tervise probleemiga inimeste elu pärast elukohavahetust | [ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part13.pdf](<ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part13.pdf>) |
| Aasta parimad lastekaitsetöötajad: laste ja peredeni peaks abi jõudma kiiremini | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part3.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part3.pdf>) |
| Enamikul Eesti lastest läheb hästi | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part2.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part2.pdf>) |
| Integreeritud teenused – kellele ja milleks? | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part17.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part17.pdf>) |
| Jõelähtme – aja lugu elab siin | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part20.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part20.pdf>) |
| Kinnise lasteasutuse asemel tugevdatud toetuse teenus | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part16.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part16.pdf>) |
| Kolmes omavalitsuses avati kogukondlikud ennetus- ja peretöökeskused | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part23.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part23.pdf>) |
| Kunstiteraapia annab lapsele võimaluse väljendada end turvalisel viisil | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part21.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part21.pdf>) |
| Lapse õigus osaleda abivajaduse hindamises: kuidas lastekaitsetöötajad seda tõlgendavad? | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part7.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part7.pdf>) |
| Lapse õiguste ja osalusõigusega seotud teadlikkus, hoiakud ning kogemused laste ja täiskasvanute pilgu läbi | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part4.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part4.pdf>) |
| Lapse õiguste kaitse suhtluskorra kohtulahendite täitmisel | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part11.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part11.pdf>) |
| Lapseröövi ja elatisega seotud küsimused – fookuses on Soome | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part12.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part12.pdf>) |
| Lapsesõbralik lastekaitse – lastekaitsetöötajate vaade | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part9.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part9.pdf>) |
| Lapsesõbralik menetlus. Lapse õigused vanemate vahelistes hooldus- ja suhtlusõiguse vaidlustes | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part10.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part10.pdf>) |
| Perevägivalda tunnistanud laps kui abivajav laps | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part15.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part15.pdf>) |
| Laste väärkohtlemise märkamine ja abi osutamine tervishoius | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part14.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part14.pdf>) |
| Linnupesa-hooldus kui lapsekeskne lähenemine jagatud hooldusõiguse korral | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part13.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part13.pdf>) |
| Miks on keelatud lapse kehaline karistamine? | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part5.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part5.pdf>) |
| Raske ja sügava puudega lastele suunatud tugiisiku- ja lapsehoiuteenus | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part18.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part18.pdf>) |
| Üksinda otsustamine lastekaitse sotsiaaltöös: miks tuleb lapse parima huvi põhimõtte rakendamisel partneritega aru pidada | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part8.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part8.pdf>) |
| Üleilmne laste heaolukonverents Tartus | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part22.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part22.pdf>) |
| Vanemluskoolitused aitavad last ja lapsevanemat | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part6.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part6.pdf>) |
| Võru linna sotsiaaltöö korralduse mured ja rõõmud | [ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part19.pdf](<ajakiri_sotsiaaltoo/19-3/ST3_2019_veeb_link_Part19.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part2.pdf>) |
| Eetikapõhimõtted sotsiaaltöös. Global Social Work Statement of Ethical Principles (IASSW 2018) | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part18.pdf>) |
| Mida õppida hoolduse koordinatsiooni pilootprojektist | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part5.pdf>) |
| Ida-Virumaa sotsiaalteenuste arendamist toetav projekt | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part10.pdf>) |
| Juhendmaterjal aitab tuvastada inimkaubanduse ohvreid ja osutada neile abi | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part12.pdf>) |
| Katseprojekt kinnitas hoolduse koordineerimise vajalikkust | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part6.pdf>) |
| Kuidas vastata inimese pöördumisele | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part11.pdf>) |
| Omastehooldus. Perekonna ja ühiskonna liit? | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part15.pdf>) |
| Omavalitsuste jaoks loodud nõustamisüksus | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part7.pdf>) |
| Pikaajalise hoolduse süsteemi tuleb Eestis muuta | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part4.pdf>) |
| Professionaalne sotsiaaltöö noores, järjest keerulisemas uusliberaalses ühiskonnas | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part17.pdf>) |
| Puude või muu erivajadusega inimese oht sattuda inimkaubanduse ohvriks | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part13.pdf>) |
| Rita Kerdmann: sõltuvusega täidetakse tühimikke elus | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part3.pdf>) |
| Sotsiaalprobleemidega seotud väljakutsed kiirabi töös | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part16.pdf>) |
| Sotsiaaltöö Peipsimaa pealinnas ja Mustvee vallas | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part8.pdf>) |
| Sotsiaaltöötajate sügiskooli arvamuskorje tulemustest | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part19.pdf>) |
| Tõenduspõhine kiusamise ennetamine koolides – milleks ja kuidas? | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part14.pdf>) |
| Vabatahtlike seltsiliste roll hoolekandeteenuste täiendamisel | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part9.pdf>) |
| Vähendame puudega laste nimel bürokraatiat | [ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part20.pdf](<ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part20.pdf>) |
| Avatud dialoog: võimalus muudatusteks vaimse tervise valdkonnas | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part9.pdf>) |
| CARe metoodika kui kõikehõlmav rehabilitatsioonikäsitlus | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part5.pdf>) |
| CARe metoodika rakendamine Eesti Töötukassas | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part6.pdf>) |
| Coaching ehk mõttetreening personaalse taastumise toetuseks | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part11.pdf>) |
| Hea lugeja! | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part2.pdf>) |
| Helen Cyrus: Mõttetreening aitab näha võimalusi ja valikuid | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part10.pdf>) |
| Vaimse tervise kogemuslugude jagamine: täisealiste noorte perspektiiv | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part7.pdf>) |
| Kogemusnõustaja töö ja kogemuslugu kui töövahend | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part8.pdf>) |
| Kriisikaart kui võimalus vaimse tervise kriise ennetada ja juhtida | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part13.pdf>) |
| Kuressaare Hoolekanne ja selle uuendusmeelne meeskond | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part19.pdf>) |
| Mida pakub taastumiskolledžite liikumine? | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part16.pdf>) |
| Ohumärkide plaan ja kriisikaart vaimse tervise raskustega inimestele | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part12.pdf>) |
| Personaalne taastumine ja perekond | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part15.pdf>) |
| Psüühikahäirega lapsevanemad ootavad usaldust ja toetust | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part14.pdf>) |
| QualityRights – WHO algatus inimõiguste edendamiseks | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part18.pdf>) |
| Sotsiaalabi piirid – inimeste õigused ja KOV kohustused | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part17.pdf>) |
| Teekond hooliva kogukonnani | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part20.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part20.pdf>) |
| Taastumist ja toimevõimekust toetav töö vaimse tervise valdkonnas | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part4.pdf>) |
| Taastumise ekspert Triin Vana: kui näeme ainult probleeme, siis jäävad parimad lahendused leidmata | [ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part3.pdf>) |
| Abistavad digilahendused – tuleviku hooldustöö võti | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part24.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part24.pdf>) |
| Asendushooldusperes elava lapse identiteediõigus | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part12.pdf>) |
| Asenduskodus või perekodus elava lapse suhtlus bioloogilise vanemaga | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part11.pdf>) |
| Dementsusega edukalt elamise eelduseks on kaasav ühiskond | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part23.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part23.pdf>) |
| Eesliinil hooldustöötaja Elgi enda pärast ei pelga | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part8.pdf>) |
| Head ajakirja Sotsiaaltöö lugejad! | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part2.pdf>) |
| Hooldustöö eeldab soovi teiste eest hoolitseda | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part3.pdf>) |
| Inspireerivaid mõtteid Dubrovnikust | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part17.pdf>) |
| Isiklik mugavusala | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part7.pdf>) |
| Kogukondade arendamine ja sotsiaalne heaolu – uus magistriõppekava Tartu Ülikooli ühiskonnateaduste instituudis | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part18.pdf>) |
| Kriisiaeg on pannud otsima uusi lahendusi | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part26.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part26.pdf>) |
| Kuidas on rakendunud muudatused asendus- ja järelhooldusteenuse valdkonnas? | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part10.pdf>) |
| Malcolm Payne ja Hans van Ewijk: hea sotsiaaltöötaja põhiomadus on visadus | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part16.pdf>) |
| Pilguheit kohalikule sotsiaaltööle ja sotsiaalpoliitikale | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part15.pdf>) |
| Psühhosotsiaalne kriisiabi eriolukorras | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part9.pdf>) |
| Sotsiaalala töötajad kriisi keskmes | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part5.pdf>) |
| Sotsiaaltöötaja sotsiaalne töö füüsilise eraldatuse tingimustes | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part4.pdf>) |
| Sotsiaaltöö Rakvere linnas | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part13.pdf>) |
| Sotsiaaltöötaja kutsestandardid uues kuues | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part14.pdf>) |
| Kogemusi lastekaitsetöötajate supervisioonist | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part19.pdf>) |
| Sotsiaalne transport Eestis ühiskondliku ja eraelu sidujana | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part20.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part20.pdf>) |
| Lapse hääl lastekaitsetöös – laste osalemiskogemused | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part21.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part21.pdf>) |
| Tallinna Sotsiaaltöö Keskuse klientide analüüs | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part22.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part22.pdf>) |
| Tehnilised abilahendused Koeru Hooldekeskuses | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part25.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part25.pdf>) |
| Üheskoos tuleme kriisiga toime | [ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/20-2/ST2_2020_web_link_Part6.pdf>) |
| Allakäigutrepist üles – ühisel nõul ja ühisel jõul | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part13.pdf>) |
| COVID kui võimaluste aken pikaajalise hoolduse reformile | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part5.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part2.pdf>) |
| Eestis on nüüd spetsiaalselt dementsusega inimestele ehitatud kodu | [ajakiri_sotsiaaltoo/20-3/160855457024_Sotsiaaltoo_3_2020_web_link_Part21.pdf](<ajakiri_sotsiaaltoo/20-3/160855457024_Sotsiaaltoo_3_2020_web_link_Part21.pdf>) |
| Elude päästmine võrgustikutöös MARACi abil | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part10.pdf>) |
| Insuldipatsiendi raviteekond muutub sujuvamaks | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part8.pdf>) |
| Integreeritud tugiteenused lastele – esimene tagasiside pilootprojektile | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part12.pdf>) |
| Kelle poole pöördub abi saamiseks Eesti 100-aastane? | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part20.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part20.pdf>) |
| Kuidas liigume edasi RFK metoodikaga? | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part16.pdf>) |
| Lastekaitsetöö COVID-19 pandeemia ajal Eestis | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part18.pdf>) |
| Laste ja noorte ennetav abistamine | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part11.pdf>) |
| Lipusüsteem – juhend laste ja noorte seksuaalkäitumise hindamiseks ja sellele reageerimiseks | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part17.pdf>) |
| Noorte osaluse ja koostöö toetamise kogemused Tallinna noorsootöös | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part14.pdf>) |
| Pilootprojekt PAIK – koostöö patsiendi heaks | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part9.pdf>) |
| Rahvusvaheline funktsioneerimisvõime klassifikatsioon | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part15.pdf>) |
| Teekond inimesekeskse teenusepakkumise suunas | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part6.pdf>) |
| Töövõimereformi võimalused ja kitsaskohad | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part19.pdf>) |
| Uue ohvriabi seaduse poole | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part4.pdf>) |
| Väino Maasalu: „Püüan olla eeskujuks kogukonnas ja oma lastele” | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part3.pdf>) |
| Valdkondade lõimimise head kogemused Elva vallas | [ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/20-3/Sotsiaaltoo_3_2020_web_link_Part7.pdf>) |
| EESSÕNA – Taastav õigus keskendub kahju heastamisele | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part2.pdf>) |
| Eetika köielkõnd sotsiaalteadustes | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part16.pdf>) |
| Ennetava sekkumise mõjuanalüüsi võimalusi SPIN-programmi näitel | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part14.pdf>) |
| Ennetustöö korraldus uuenenud tervise- ja heaoluprofiili abil | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part13.pdf>) |
| Eva Üprus: tugiisiku töö mõte on inimesi inspireerida | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part3.pdf>) |
| Jane Addams ja sotsiaalne settlement | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part17.pdf>) |
| Kas taastavale õigusele on kohta, kui seksuaalne kuritarvitamine toimub perekonnas? | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part9.pdf>) |
| Konfliktivahendus, taastav nõupidamine ja vabatahtlike töö | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part6.pdf>) |
| Miks sobib taastav õigus noortele? | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part5.pdf>) |
| Personaalne peegeldus taastava õiguse võimalustele kinnipidamisasutustes | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part7.pdf>) |
| Praktika ja teooria seosed sotsiaaltöös | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part15.pdf>) |
| Sotsiaalvaldkonna võimalused ja arengud koroonakriisi kevadel | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part11.pdf>) |
| Taastavast õigusest praktikuilt praktikutele | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part12.pdf>) |
| Taastav õigus ja lähisuhtevägivald | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part8.pdf>) |
| Taastav õigus ja COVID-19 | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part10.pdf>) |
| Õigusemõistmise kaks paradigmat ja sotsiaaltöö väärtused | [ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part4.pdf>) |
| Anu-Lii Jürman: elus tuleb pakkumised vastu võtta õigel ajal | [ajakiri_sotsiaaltoo/21-1/artikkel_2_persoon_anu-lii_jurman_korrigeeritud.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_2_persoon_anu-lii_jurman_korrigeeritud.pdf>) |
| Eakad on Türi vallas kogukonna väärtuslik ja hoitud osa | [ajakiri_sotsiaaltoo/21-1/artikkel_4_eakad_on_tyri_vallas.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_4_eakad_on_tyri_vallas.pdf>) |
| EESSÕNA | [ajakiri_sotsiaaltoo/21-1/artikkel_1_eessona.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_1_eessona.pdf>) |
| Eesti inimeste toetamine majandusliku olukorra muutumisel | [ajakiri_sotsiaaltoo/21-1/artikkel_3_eesti_inimeste_toetamine.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_3_eesti_inimeste_toetamine.pdf>) |
| Hea sotsiaaltöötaja on hästi hoitud | [ajakiri_sotsiaaltoo/21-1/artikkel_13_hea_sotsiaaltootaja.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_13_hea_sotsiaaltootaja.pdf>) |
| Hiiumaa Sotsiaalkeskuse kiire areng ja uued proovikivid | [ajakiri_sotsiaaltoo/21-1/artikkel_5_hiiu_sotsiaalkeskus.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_5_hiiu_sotsiaalkeskus.pdf>) |
| Jututajad aitavad leevendada üksildust | [ajakiri_sotsiaaltoo/21-1/artikkel_15_jututajad.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_15_jututajad.pdf>) |
| Koduteenuse korraldamise probleeme kohalikes omavalitsustes | [ajakiri_sotsiaaltoo/21-1/artikkel_6_koduteenuse_korraldamine.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_6_koduteenuse_korraldamine.pdf>) |
| Kohalike sotsiaalteenuste ja sotsiaaltoetuste kättesaadavus | [ajakiri_sotsiaaltoo/21-1/artikkel_10_kohalike_teenuste_kattesaadavus.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_10_kohalike_teenuste_kattesaadavus.pdf>) |
| Lastekaitsetööga kokku puutunud laste ja lähedaste vaade lastekaitsetööle Eestis | [ajakiri_sotsiaaltoo/21-1/artikkel_11_lastekaitsetoo_vaade.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_11_lastekaitsetoo_vaade.pdf>) |
| Miks me vajame erialase ettevalmistusega hooldustöötajaid? | [ajakiri_sotsiaaltoo/21-1/artikkel_9_hooldustoootajad.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_9_hooldustoootajad.pdf>) |
| Pikaajaline hooldus Sloveenias: probleemid ja tulevikusuunad | [ajakiri_sotsiaaltoo/21-1/artikkel_12_pikaajaline_hooldus_sloveenias.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_12_pikaajaline_hooldus_sloveenias.pdf>) |
| Uusi teadmisi võlanõustamise koolituselt | [ajakiri_sotsiaaltoo/21-1/artikkel_7_volanoustamise_koolitus.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_7_volanoustamise_koolitus.pdf>) |
| Vabatahtlike kaasamise mudeli rakendamine hoolekandes | [ajakiri_sotsiaaltoo/21-1/artikkel_8_vabatahtlike_kaasamine.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_8_vabatahtlike_kaasamine.pdf>) |
| Vaktsineerimine aitab vältida nakatumist | [ajakiri_sotsiaaltoo/21-1/artikkel_14_vaktsineerimine.pdf](<ajakiri_sotsiaaltoo/21-1/artikkel_14_vaktsineerimine.pdf>) |
| Arenguprogramm „Pöördepunkt” andis hoogu sotsiaalteenuste arendamisele Ida-Virumaal | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part10.pdf>) |
| COVID-19 mõjust sotsiaaltöö valdkonna tööjõu ja oskuste vajadusele | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part20.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part20.pdf>) |
| Distantsõppe korraldus HEV-õpilastele Keila Koolis | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part12.pdf>) |
| EESSÕNA | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part2.pdf>) |
| Eestkoste laste eestkostjate narratiivides | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part15.pdf>) |
| Heaolu arengukava 2023–2030 | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part4.pdf>) |
| Integreeritud tugiteenused lastele – ülevaade projekti tulemustest | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part5.pdf>) |
| Kogumishäire on enamat kui lihtsalt hamsterlus | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part18.pdf>) |
| Kuidas leida tuge sotsiaaltöö teooriatest? Praktiku vaatenurk | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part14.pdf>) |
| Lapsendamise ja hooldusperre paigutamise seiresüsteem | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part6.pdf>) |
| Nähtamatu nähtavaks: pagulaste igapäevaelu mõtestamine visuaalsete meetoditega | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part16.pdf>) |
| Pere lahendusring annab põhivastutuse tagasi perele | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part8.pdf>) |
| Riskihindamine – tuleviku prognoosimise vahend ja juhtumikorralduse alus | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part9.pdf>) |
| Sotsiaalpedagoogika tulevik on helge | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part19.pdf>) |
| Sotsiaalvaldkonnast mitmes vaates | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part11.pdf>) |
| TAI suunab tervislikke valikuid teaduspõhiselt | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part7.pdf>) |
| Elu lastele ja noortele pühendanud Tiina Kivirüüt: missioonitunne peab olema! | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part3.pdf>) |
| Tähelepanekutest sotsiaalvaldkonnas andmekaitse inspektsiooni juristi pilgu läbi | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part13.pdf>) |
| Ubuntu: mina olen, sest meie oleme | [ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/21-2/Sotsiaaltoo_2_2021_web_link_Part17.pdf>) |
| Aasta sotsiaaltöötaja – päikeseliselt soe Johanna Hollo | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part3.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part3.pdf>) |
| Aeg on rääkida professionaalsusest sotsiaaltöös | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part13.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part13.pdf>) |
| Areng töötajate toetamise ja taristu abil | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part8.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part8.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part2.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part2.pdf>) |
| Emotsioonid ja lühilood sotsiaaltöö praktikas ja hariduses | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part14.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part14.pdf>) |
| Hooldekodu elanike autonoomiaga arvestamine kolme hooldekodu näitel | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part11.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part11.pdf>) |
| Hoolduse katkestamine hooldusperedes – lastekaitsetöötajate ja eksperdi vaatenurk | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part10.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part10.pdf>) |
| Interdistsiplinaarsed loovmeetodid sotsiaaltöös (virtuaalne konverents tudengilt‑tudengile) | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part18.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part18.pdf>) |
| Kanep – mis on mis? | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part19.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part19.pdf>) |
| Kuidas ajakirjanikuga suheldes ellu jääda? | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part12.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part12.pdf>) |
| Kõik väärtuslik on haavatav | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part16.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part16.pdf>) |
| Ma ei ole üksnes klient. Uuenduslik vaatenurk sotsiaaltöö õpetamisele ja teadmiste koosloome | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part17.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part17.pdf>) |
| Pagulaste vaimne tervis vajab rohkem tähelepanu | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part20.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part20.pdf>) |
| Pikk ja täisväärtuslik elu Tartu linnas | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part7.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part7.pdf>) |
| Riikliku perelepitusteenuse väljaarendamine | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part4.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part4.pdf>) |
| Sotsiaaltöötajate säilenõtkuse suurendamine | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part15.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part15.pdf>) |
| Tegevuspiiranguga inimeste toimetulekut kodus tuleb toetada senisest rohkem | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part9.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part9.pdf>) |
| Tegevustest pikaajalise hoolduse vallas | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part5.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part5.pdf>) |
| Tunnustus | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part21.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part21.pdf>) |
| Vanemaealiste teenusemaja kontseptsiooni lühitutvustus | [ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part6.pdf](<ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part6.pdf>) |
| COVID-19 kriisi mõju sotsiaaltöö ja hoolekande korraldusele. Saaremaa kogemus | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part14.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part14.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part2.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part2.pdf>) |
| Elutöö auhind ei anna õigust loorberitele puhkama jääda | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part3.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part3.pdf>) |
| Kaasava hariduse esilekerkimine, areng ja praegune olukord Norras | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part17.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part17.pdf>) |
| Kinnise lasteasutuse teenusele suunatud noorte toetamine mitteformaalse õppega | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part16.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part16.pdf>) |
| Erihoolekande isikukesksele teenusemudelile ülemineku mõjuanalüüs | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part5.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part5.pdf>) |
| Lastekaitse ja andmekaitse – mõned olulised tähelepanekud | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part9.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part9.pdf>) |
| Lõimitud ja mitmekülgne sotsiaaltöö Viljandis | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part8.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part8.pdf>) |
| Nähtamatud barjäärid: uimastisõltuvus ja probleemid praktikas | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part19.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part19.pdf>) |
| Omavalitsused peavad rohkem märkama eakate sotsiaalseid probleeme | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part6.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part6.pdf>) |
| Pandeemia on aidanud mõista, kui olulised me inimestena üksteisele oleme | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part12.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part12.pdf>) |
| Perekodus elavad lapsed soovivad teada, kes nad on ja kust nad tulevad | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part15.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part15.pdf>) |
| Peresotsiaaltöö Läti sotsiaalametis – uue metoodika tutvustus | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part18.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part18.pdf>) |
| Pühendumus ja professionaalsus sotsiaaltöös | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part10.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part10.pdf>) |
| Rakvere valla sotsiaaltöös luuakse uusi võimalusi | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part7.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part7.pdf>) |
| Sotsiaaltöö hädaolukorra, eetika ja digiteerimise kolmnurgas | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part11.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part11.pdf>) |
| Teenuseosutajad püüavad teha kõik, et toetada kliente muutunud olukorras | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part13.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part13.pdf>) |
| Terviklik abi kodu lähedalt – isikukeskne erihoolekanne omavalitsustes | [ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part4.pdf](<ajakiri_sotsiaaltoo/21-4/Sotsiaaltoo_4_2021_web_Part4.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_1_eessona.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_1_eessona.pdf>) |
| Erihoolekanne ja sotsiaalne rehabilitatsioon | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_8_erihoolekanne_rehabilitatsioon.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_8_erihoolekanne_rehabilitatsioon.pdf>) |
| Inimõigusharidus sotsiaaltöös | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_11_inimoigusharidus.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_11_inimoigusharidus.pdf>) |
| Kommentaarid artiklile „Inimõigusharidus sotsiaaltöös“ | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_12_kommentaarid.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_12_kommentaarid.pdf>) |
| Kunstiteraapilise grupitöö sobivus ja mõju vanemaealise lähedase hooldaja hoolduskoormuse ja üldise stressitaseme vähendamisel | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_16_kunstiteraapiline_grupitoo.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_16_kunstiteraapiline_grupitoo.pdf>) |
| Lastekaitsetöötaja vajab süvendatud teadmisi perevägivalla märkamisest | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_14_lastekaitsetootaja_perevagivald.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_14_lastekaitsetootaja_perevagivald.pdf>) |
| Pandeemia mõju laste vaimsele tervisele ja kuidas neid toetada. 1. osa | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_15_pandeemia_laste_vaimne_tervis.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_15_pandeemia_laste_vaimne_tervis.pdf>) |
| Psüühilise erivajadusega inimese osalus oma eestkostes | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_13_psuuhiline_osalus_eestkoste.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_13_psuuhiline_osalus_eestkoste.pdf>) |
| Puude raskusastme tuvastamisest lastel, ent mitte ainult | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_5_puude_raskusaste_lastel.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_5_puude_raskusaste_lastel.pdf>) |
| Rahvusvahelise funktsioneerimisvõime klassifikatsiooni kasutamine tööalases rehabilitatsioonis | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_9_rfk_toealane_rehabilitatsioon.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_9_rfk_toealane_rehabilitatsioon.pdf>) |
| Sigrid Petoffer: „Ohvrirolli võib kergesti kinni jääda.“ | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_2_persoon.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_2_persoon.pdf>) |
| Sotsiaaltöö Rõuge vallas on nagu pusle kokkupanek | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_4_rouge_valla_pusle.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_4_rouge_valla_pusle.pdf>) |
| Vana inimene igatseb koju tagasi | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_6_vana_inimene_igatseb_koju.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_6_vana_inimene_igatseb_koju.pdf>) |
| Vanemahüvitiste ja lapsepuhkuste uus kord | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_7_vanemahuvitised.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_7_vanemahuvitised.pdf>) |
| Värske OSKA uuringu kohaselt on sotsiaaltöövaldkonnas endiselt vaja tööjõudu juurde | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_3_oska_uuring.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_3_oska_uuring.pdf>) |
| Õigus tervisele | [ajakiri_sotsiaaltoo/22-1/2022_artikkel_10_oigus_tervisele.pdf](<ajakiri_sotsiaaltoo/22-1/2022_artikkel_10_oigus_tervisele.pdf>) |
| Aitamisele pühendatud elu | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_2_persoon.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_2_persoon.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_1_eessona.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_1_eessona.pdf>) |
| Ei või koroona pärast koduväravastki välja minna. Pandeemia mõju noorte vaimsele tervisele ja kuidas neid toetada | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_12_noorte_vaimne_tervis.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_12_noorte_vaimne_tervis.pdf>) |
| Isikliku abistaja teenuse reguleerimine kohaliku omavalitsuse õigusaktides | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_11_isikliku_abistaja_teenus.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_11_isikliku_abistaja_teenus.pdf>) |
| Keskkond on inimese põhivajadus | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_7_Kairiin Nuudi.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_7_Kairiin Nuudi.pdf>) |
| Lastekülast kogukonda, armastav hoolitsus ja lapse osalusel põhinev lapsekesksus – kolm võistlevat heaoludiskursust asenduskodus | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_13_asenduskodude_heaolu.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_13_asenduskodude_heaolu.pdf>) |
| Liikumispuudega naiste raseduse, sünnituse ja sünnitusjärgse aja kogemused ning väljakutsed | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_14_liikumispuudega_naised.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_14_liikumispuudega_naised.pdf>) |
| Lääne-Harju vallas on esikohal inimene ja tema keskkond | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_9_laane_harju_vald.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_9_laane_harju_vald.pdf>) |
| Magistriõppekava „Inimesekeskne sotsiaalne innovatsioon“ | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_15_inimesekeskne_innovatsioon.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_15_inimesekeskne_innovatsioon.pdf>) |
| Marju Selja mälestuseks | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_16_in_memoriam_marju_selja_95_98.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_16_in_memoriam_marju_selja_95_98.pdf>) |
| Mõeldes sotsiaaltööpäevale | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_8_moeldes_sotsiaaltoopaevale.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_8_moeldes_sotsiaaltoopaevale.pdf>) |
| Riiklik perelepitusteenus | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_4_perelepitusteenus.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_4_perelepitusteenus.pdf>) |
| Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_5_seltsilised.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_5_seltsilised.pdf>) |
| Sotsiaalhoolekande seaduse ja teiste seaduste muutmise seadus toob uuendusi | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_3_korraldus.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_3_korraldus.pdf>) |
| Sotsiaaltöötajatel on sõjapõgenike abistamisel käed-jalad tööd täis | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_10_sojapogenike_abistamine.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_10_sojapogenike_abistamine.pdf>) |
| Ökosotsiaaltöö juhatab teed jätkusuutlikumasse tulevikku | [ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_6_okosotsiaaltoo.pdf](<ajakiri_sotsiaaltoo/22-2/2022_2_artikkel_6_okosotsiaaltoo.pdf>) |
| Käo Tugikeskus – inimnäoline asutus Tallinnas | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_10_kao_tugikeskus.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_10_kao_tugikeskus.pdf>) |
| Perepesa toetab laste ja perede heaolu | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_11_perepesa.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_11_perepesa.pdf>) |
| Kinnise lasteasutuse teenus Hiiumaa sotsiaalkeskuse noortekodus | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_12_kinnine_lasteasutus.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_12_kinnine_lasteasutus.pdf>) |
| Koduhooldus – lahendus riigile, elanikule ja tööturule | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_13_koduhooldus.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_13_koduhooldus.pdf>) |
| Teenused ja majad ehk teenusmajad | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_14_teenusmajad.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_14_teenusmajad.pdf>) |
| Traumateadlik elulootöö asendushooldusel kasvavate laste identiteedi toetamiseks | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_15_traumateadlik_elulootoo.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_15_traumateadlik_elulootoo.pdf>) |
| Mobiilne noorsootöö aitab jõuda keerulistes oludes noorteni | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_16_mobiilne_noorsootoo.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_16_mobiilne_noorsootoo.pdf>) |
| Dementsusega inimeste omastehooldajate võimestamine tugigruppide abil | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_17_omastehooldajate_voimestamine.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_17_omastehooldajate_voimestamine.pdf>) |
| Mis viis otsuseni ametist lahkuda? Lastekaitsetöötajate kogemuslood | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_18_ametist_lahkumine.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_18_ametist_lahkumine.pdf>) |
| Ole iseenda terapeut! | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_19_ole_iseenda_terapeut.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_19_ole_iseenda_terapeut.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_1_eessona.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_1_eessona.pdf>) |
| Imbi Ivask: „Laste usaldust on raske pälvida, aga sellest oleneb kõik.” | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_2_persoon_Kristina Traks.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_2_persoon_Kristina Traks.pdf>) |
| Võlanõustamisteenuse arendamisest | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_3_korraldus.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_3_korraldus.pdf>) |
| Kohila valla kogemus isikukeskse erihoolekande mudeli rakendamisel | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_4_kohila_projekt.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_4_kohila_projekt.pdf>) |
| Kommentaar | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_5_kommentaar.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_5_kommentaar.pdf>) |
| Sotsiaaltranspordi ühise korraldusmudeli katsetamine Pärnumaal | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_6_sotsiaaltransport.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_6_sotsiaaltransport.pdf>) |
| Kommentaar | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_7_kommentaar_ruut_kurves.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_7_kommentaar_ruut_kurves.pdf>) |
| Töötukassa ja omavalitsuste koostööprojekt – ühiselt jõuab kaugemale | [ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_8_koostooprojekt.pdf](<ajakiri_sotsiaaltoo/22-3/2022_3_artikkel_8_koostooprojekt.pdf>) |
| Lapse perekonnast eraldamine vaimse tervise probleemiga vanemalt | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_15_lapse_eraldamine.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_15_lapse_eraldamine.pdf>) |
| NEET-staatuses noored teenuste ja programmide võrgusilmas | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_16_neet_noored.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_16_neet_noored.pdf>) |
| Kuidas mõista lapse osalusõigust lastekaitsetöös? | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_17_lapse_osalus.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_17_lapse_osalus.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_1_eessona.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_1_eessona.pdf>) |
| Noortesõbralikus Muhu vallas unistatakse suurelt | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_3_muhu.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_3_muhu.pdf>) |
| Üheksa kiiret kuud südamelinnas Paides | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_4_paide.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_4_paide.pdf>) |
| Piret Talur: oleme kõik võrdsed võrdsete seas | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_2_persoon_Kadri Kuulpak.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_2_persoon_Kadri Kuulpak.pdf>) |
| Puude raskusastme tuvastamine ja töövõime hindamine nõustamisteenuse praktika põhjal | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_10_puude_raskusaste.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_10_puude_raskusaste.pdf>) |
| Ligipääsetavus – kelle jaoks? | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_11_ligipaasetavus.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_11_ligipaasetavus.pdf>) |
| Õppejõud Alison McInnes: maailma sotsiaaltöötajatel on palju ühiseid probleeme | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_12_alison_mcinnes.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_12_alison_mcinnes.pdf>) |
| Aafrika kogemus sotsiaaltööst pagulaste ja sisserännanutega | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_13_aafrika.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_13_aafrika.pdf>) |
| Erialadevahelisest koostööst mitmesse süsteemi hõlmatud laste ja perede toetamisel | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_14_erialadevaheline.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_14_erialadevaheline.pdf>) |
| Pagulane – täiesti tavaline inimene erakordsetes oludes | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_6_pagulane.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_6_pagulane.pdf>) |
| Tööjõupuuduse leevendamiseks pikaajalises hoolduses on vaja strateegilist ja paindlikku käsitlust | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_7_toopuudus.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_7_toopuudus.pdf>) |
| Sotsiaalkaitsekulude arvestuspõhimõtete ühtlustamisest kohalikes omavalitsustes | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_8_sotsiaalkaitsekulud.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_8_sotsiaalkaitsekulud.pdf>) |
| Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi? | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_9_abivajadus.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_9_abivajadus.pdf>) |
| Ukraina pagulasperede sotsiaalpsühholoogiline kohanemine Eestis | [ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_5_ukraina.pdf](<ajakiri_sotsiaaltoo/22-4/2022_4_artikkel_5_ukraina.pdf>) |
| Akadeemilise sotsiaaltöökoolituse kujunemine Tallinna Ülikoolis: retrospektiivne vaade | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part3.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part3.pdf>) |
| Anne Tiko: „Õpetades tulevasi sotsiaaltöötajaid õppisin ise väga palju” | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part4.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part4.pdf>) |
| Bakalaureuseõpe aitab mõista inimest ja ühiskonda | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part11.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part11.pdf>) |
| Sotsiaaltöö doktoriõppe tulevikuvaade | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part8.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part8.pdf>) |
| Doktoritöö uurimus kui sotsiaaltöö teadmusloome | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part13.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part13.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part2.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part2.pdf>) |
| Sotsiaaltöö esimeses lennus õppinud Kristiina Salong ja Indrek Juss: „Meid koolitati olema maailmamuutjad” | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part5.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part5.pdf>) |
| Karmen Toros: „Sotsiaaltöö eriala püsib tugevana ja areneb” | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part6.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part6.pdf>) |
| Sotsiaaltöö magistriõpe annab teadmiste ja oskuste kõrval ka võimekuse teha koostööd | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part9.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part9.pdf>) |
| Sotsiaaltöö õppimisest ja õpetamisest Tallinna Ülikoolis | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part7.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part7.pdf>) |
| Sotsiaalpedagoogika ja lastekaitse magistriõppe keskmes on lapse huvid | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part10.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part10.pdf>) |
| Sotsiaaltöötaja kui etnograaf: kogukonnatööst sotsiaaltöö tudengitega | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part12.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part12.pdf>) |
| Empaatia ja uudishimu ning muutustega kaasas käimise soov. Vilistlaste meenutused ja mõtted tulevikust | [ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part14.pdf](<ajakiri_sotsiaaltoo/22-eri/Sotsiaaltoo-ERINUMBER_2022_Part14.pdf>) |
| Suure hoolduskoormusega inimesed vajavad täiendavat abi | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part10.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part10.pdf>) |
| Pikaajalised toimetulekutoetuse saajad vajavad rohkem tuge | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part11.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part11.pdf>) |
| Eetikakoodeks on sotsiaalvaldkonna professionaalne kompass. Intervjuu eetikakomitee liikmetega | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part12.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part12.pdf>) |
| Erialaajakirja roll Eesti sotsiaaltöös | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part13.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part13.pdf>) |
| Avatud Dialoog laste sotsiaalses rehabilitatsioonis | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part14.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part14.pdf>) |
| Projektis osalevate meeskondade kogemused | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part15.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part15.pdf>) |
| Ebakindluse tolereerimine | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part16.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part16.pdf>) |
| Haavatavus kui tugevus | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part17.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part17.pdf>) |
| Per Isdal: töö inimestega muudab meid inimestena | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part18.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part18.pdf>) |
| Raamatu tutvustus: „Aitamise hind“ | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part19.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part19.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part2.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part2.pdf>) |
| E-raamat „Avatud Dialoog“ | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part20.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part20.pdf>) |
| Monika Salumaa: tõeliselt igav, kui kõik oleksid ühe näo ja teoga | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part3.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part3.pdf>) |
| Hooldekodude rahastamise põhimõtted muutuvad | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part4.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part4.pdf>) |
| Lapse abivajaduse eelhindamise arendus STAR-is | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part5.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part5.pdf>) |
| Kas klaas on pooltühi või pooltäis? | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part6.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part6.pdf>) |
| Põltsamaal osatakse ühise eesmärgi nimel seljad kokku panna | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part7.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part7.pdf>) |
| Kas Ukraina sõjapõgenikud on Eestis kogukond? | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part8.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part8.pdf>) |
| Kommentaar: ukrainlaste kogukond Võrus areneb alles | [ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part9.pdf](<ajakiri_sotsiaaltoo/23-1/Sotsiaaltoo_1_2023_web_Part9.pdf>) |
| Sidus kogukond kui vabatahtlike ja avaliku sektori koostöö võti | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part11.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part11.pdf>) |
| Kogukonna tugi uussisserändajate kohanemisel ja lõimumisel | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part12.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part12.pdf>) |
| Praktikakogukond – mis ja milleks? | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part13.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part13.pdf>) |
| Elanikkonnakaitse – üksi võime olla tugevad, kuid kogukonnas oleme võimsamad! | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part14.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part14.pdf>) |
| Tegevusjuhendajad kui kogukonnas taastumise toetajad | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part15.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part15.pdf>) |
| Kogukondade arendamise ja sotsiaalse heaolu õppekava Tartu Ülikoolis. Mida, miks ja kellele õpetatakse? | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part16.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part16.pdf>) |
| Tulge õppima kogukonnatööd vananevas ühiskonnas | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part17.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part17.pdf>) |
| Inimõiguste tähendus sotsiaaltöös | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part18.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part18.pdf>) |
| Millist tuge vajavad harvikhaigusega last kasvatavad pered? | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part19.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part19.pdf>) |
| Värske inimarengu aruanne: vaimset heaolu loob igapäevane elukeskkond | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part20.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part20.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part2.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part2.pdf>) |
| Tunnustamine innustab aasta parima omavalitsuse sotsiaaltöötajaid | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part3.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part3.pdf>) |
| Heaolu arengukava eesmärk on tagada, et kõik Eesti inimesed on hoitud | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part4.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part4.pdf>) |
| Sotsiaalvaldkonna tööjõud, pädevus ja väärtustamine | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part5.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part5.pdf>) |
| Kuidas plaanitakse toetada laste ja perede heaolu? | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part6.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part6.pdf>) |
| Uus ohvriabi seadus avab ukse suuremale hulgale abivajajatele | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part7.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part7.pdf>) |
| Sotsiaalkindlustusameti tugi lastekaitsetöötajatele | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part8.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part8.pdf>) |
| Kohtla-Järve sotsiaaltöös on palju erinevaid tahke | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part9.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part9.pdf>) |
| Uimastite tarvitamise põhjused ja levimus | [ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part10.pdf](<ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part10.pdf>) |
| Võlanõustajate liit ühendab ala asjatundjad | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part11.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part11.pdf>) |
| Võlanõustamise kaks kliendilugu | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part12.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part12.pdf>) |
| Põhja-Pärnumaa võlanõustamiskogemus | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part13.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part13.pdf>) |
| Valikud uue ja vana vahel – kilde Euroopa Liidu „uute liikmesriikide“ perepoliitikast (I) | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part14.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part14.pdf>) |
| Sisserändajatega töötamisel on abiks kultuuriline kompetentsus | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part15.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part15.pdf>) |
| Klientide vägivalda tundnud lastekaitsetöötajate kogemused | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part16.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part16.pdf>) |
| Kellele ja milleks on vaja ennetuse teadusnõukogu? | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part17.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part17.pdf>) |
| Ilmus eestikeelne elulooraamat asendushooldusel ja lapsendatud lastele | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part18.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part18.pdf>) |
| Asta Kiitam: sotsiaaltöö on kultuuri küsimus | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part19.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part19.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part2.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part2.pdf>) |
| Koolituse ja teenuste arendaja Marju Medar: „Sotsiaaltööl pole piire!“ | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part3.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part3.pdf>) |
| Sotsiaalministeerium otsib koos partneritega võimalusi laste heaolu suurendamiseks | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part4.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part4.pdf>) |
| Tööturumeetmete seadus muudab selgemaks töötukassast abi saamise võimalused | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part5.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part5.pdf>) |
| Väärikas hoolekanne ennetab ja väldib väärkohtlemist | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part6.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part6.pdf>) |
| Koduteenuse osutamine ja Pärnu linna teised head kogemused | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part7.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part7.pdf>) |
| Kadrina sotsiaaltöös on võetud suund ennetusele | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part8.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part8.pdf>) |
| Haabersti sotsiaaltöötajad toetavad abivajajaid ja püüavad vastu pidada | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part9.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part9.pdf>) |
| Saatjata alaealised välismaalased on riigile uus proovikivi | [ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part10.pdf](<ajakiri_sotsiaaltoo/23-3/Sotsiaaltoo_3_2023_web_Part10.pdf>) |
| Rehabilitatsiooniteenus teenuseosutaja pilguga | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part17.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part17.pdf>) |
| Keila teraapiakeskuses arendatakse teenuseid koos kogukonnaga | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part18.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part18.pdf>) |
| Tugiisik aitab kokku viia uimasteid tarvitava inimese ja tervishoiuteenused | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part19.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part19.pdf>) |
| Perearst Diana Ingerainen: „Integratsioon on usu küsimus“ | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part11.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part11.pdf>) |
| Millist tuge vajab vähihaige õpilane koolis? | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part12.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part12.pdf>) |
| Ühiskonnas tõrjutute kriisikogemused: õppetunnid koroonapandeemiast | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part13.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part13.pdf>) |
| PAIK teenuse rakendamine paneb tervishoiu- ja sotsiaalvaldkonna osalised meeskonnana tööle | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part14.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part14.pdf>) |
| Raviteekonna jätkumine väljaspool haigla seinu | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part15.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part15.pdf>) |
| Nooresõbralik ja kogukonnateadlik „Ringist välja“ võrgustikutöö | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part16.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part16.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part2.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part2.pdf>) |
| Lea Kõre: „Haigla sotsiaaltöötaja seob sotsiaal- ja tervishoiuvaldkonda“ | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part3.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part3.pdf>) |
| SA Viljandi haigla hoolekandekeskuse juht Kairi Nool: „Kõigil peab olema hea!“ | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part4.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part4.pdf>) |
| Hoolduskoordinatsiooni projektis jätkatakse maakondlike võrgustikega | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part5.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part5.pdf>) |
| Rehabilitatsiooniteenused peaksid olema vajaduse järgi kättesaadavad ja rohkem seotud tervishoiuvaldkonnaga | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part6.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part6.pdf>) |
| Kuidas jõuaksime järgmisele tasemele tuge vajavate inimeste abistamisel? | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part7.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part7.pdf>) |
| Rahvusvahelise funktsioneerimisvõime klassifikatsiooni valdkonnaülene rakendamine | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part8.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part8.pdf>) |
| Mis juhtuks, kui meditsiini- ja sotsiaalvaldkonna terminoloogias tehtaks koostööd? | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part9.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part9.pdf>) |
| Sotsiaaltöötaja aitab rasketel ravikuuridel vastu pidada | [ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part10.pdf](<ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part10.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part2.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part2.pdf>) |
| Kersti Suun-Deket: „Sotsiaaltöö on nagu rätsepaülikonna õmblemine“ | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part3.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part3.pdf>) |
| Mis on olnud ja mis ootab ees erihoolekandes | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part4.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part4.pdf>) |
| Koduteenuste korralduses on parandamisruumi | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part5.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part5.pdf>) |
| Narva sotsiaaltöös keskendutakse teenuste kvaliteedile ja koostööle | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part6.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part6.pdf>) |
| Sotsiaaltöötaja üks ülesanne on edendada igaühe enesemääramisõigust | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part7.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part7.pdf>) |
| Rollide tähendus sotsiaaltöös | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part8.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part8.pdf>) |
| Töö sõltuvushäirete keskuses tähendab kuulamist, mõistmist ja motiveerimist | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part9.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part9.pdf>) |
| Quo vadis, tõendus? | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part10.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part10.pdf>) |
| Inimese tervikkäsitlus: taastumise põhimõtted ja CARe metoodika | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part11.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part11.pdf>) |
| Kogemused kui sotsiaaltöö teadmiste oluline allikas | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part12.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part12.pdf>) |
| Kogemusteadmised sotsiaaltöö kõrghariduses | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part13.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part13.pdf>) |
| Ella Kirsipuu elu kutse: emade- ja lastekaitse ning naisliikumise edendamine | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part14.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part14.pdf>) |
| Valikud uue ja vana vahel – kilde Euroopa Liidu „uute liikmesriikide“ perepoliitikast (II) | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part15.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part15.pdf>) |
| Raamatud toeks kasuvanematele ja lastega töötavatele spetsialistidele | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part16.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part16.pdf>) |
| Sotsiaalpedagoogika | [ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part17.pdf](<ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part17.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part2.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part2.pdf>) |
| Elutööpreemia laureaat Kai Rannastu: „Üksi sotsiaaltööd ei tee!“ | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part3.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part3.pdf>) |
| Tallinna Lastekodu – laste kodu, kus töötamine on eluviis | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part4.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part4.pdf>) |
| Kujundame tuge vajavale lapsele ja perele algusest peale toetatud teekonna | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part5.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part5.pdf>) |
| Laste ja perede heaolu suurendavad seadusemuudatused | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part6.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part6.pdf>) |
| Alusharidusseadus toob muudatusi lastehoidudele ja lasteaedadele | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part7.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part7.pdf>) |
| Eestkostekorralduse kitsaskohad ja võimalused üleminekuks toetatud otsustamisele | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part15.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part15.pdf>) |
| Kiusamise levimus Eesti noorte seas ja sellega seotud tegurid | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part17.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part17.pdf>) |
| Arendame koos valmisolekut kriisiolukordadeks | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part12.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part12.pdf>) |
| Laste tugisüsteemi areng Saaremaa vallas | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part8.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part8.pdf>) |
| Peretoetaja saab ühendada lapse hooldus- ja sünnipere | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part16.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part16.pdf>) |
| Teekond riikliku perelepitusteenuseni ja sealt edasi | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part10.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part10.pdf>) |
| Sotsiaaltööuurimuse eetika | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part18.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part18.pdf>) |
| Kujundades pädevaid spetsialiste: Tallinna ülikooli sotsiaalkaitse suuna õppekavade uuendused | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part19.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part19.pdf>) |
| Tsiviil-sõjalisest koostööst kriisi ajal | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part13.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part13.pdf>) |
| Tugiteenused harvikhaigusega lastele vajavad suuremat tähelepanu | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part9.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part9.pdf>) |
| Vahetult inimese kõrval olles ei saa jätta probleeme lahendamata | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part14.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part14.pdf>) |
| Vormsil on sotsiaaltöö kindlasti kogukondlik | [ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part11.pdf](<ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part11.pdf>) |
| Intiimsuse ja seksuaalsuse käsitlus üldhooldusteenusel | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part14.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part14.pdf>) |
| „Nad on ju vanad, mis seksuaalsusest me siin enam räägime?!“ Eakate seksuaalse eneseteostuse võimalused hooldekodudes | [ajakiri_sotsiaaltoo/24-3/nad-on-ju-vanad-eakate-seksuaalne-eneseteostus-hooldekodudes-2024-3.html](<ajakiri_sotsiaaltoo/24-3/nad-on-ju-vanad-eakate-seksuaalne-eneseteostus-hooldekodudes-2024-3.html>) |
| Eessõna | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part2.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part2.pdf>) |
| Hooldajad Enn ja Marge panevad hooldekodu elanikud isegi tantsima | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part3.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part3.pdf>) |
| Kuidas riik toetab dementsusega inimesi ja nende lähedasi? | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part4.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part4.pdf>) |
| Viljandi haigla mälukliinik – terviklik raviteekond mäluhaigustega inimeste heaks | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part5.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part5.pdf>) |
| Dementsusega inimestele võrdsemate võimaluste loomisel on tähtis nii teavitustöö kui ka huvikaitse | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part6.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part6.pdf>) |
| Dementsussõbralikkuse kujundamine Eestis ja mujal | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part7.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part7.pdf>) |
| Inimesest lähtuv tegevuse planeerimine aitab mäluhäire korral tähendusrikkalt elada | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part8.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part8.pdf>) |
| Dementsusega inimesi toetavad kohandatud keskkond ja abivahendid | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part9.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part9.pdf>) |
| Hoolekanne peab olema asjatundlik ja osavõtlik. Intervjuu Rini Blankersiga | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part10.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part10.pdf>) |
| Hooldekodud annavad endast parima, et dementsusega inimestega kohaneda. Vestlusring | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part11.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part11.pdf>) |
| Dementsusega inimeste toetamisel tuleb olla avatud uute lahenduste leidmisele | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part12.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part12.pdf>) |
| Lähedasi kaasates saame hoolekandeasutuse elanikke koos toetada | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part13.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part13.pdf>) |
| Enesejuhtimine ja enesehoid sotsiaaltöös | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part15.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part15.pdf>) |
| Kuidas saab tööandja edendada hoolekandetöötajate heaolu? | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part16.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part16.pdf>) |
| Dementsuse valdkonna arenguprogramm aitab parandada teenuse kvaliteeti | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part17.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part17.pdf>) |
| Dementsuse kompetentsikeskus toetab lähedasi ja spetsialiste | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part18.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part18.pdf>) |
| Uus omastehoolduse infopunkt nõustab ja pakub abi | [ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part182.pdf](<ajakiri_sotsiaaltoo/24-3/sotsiaaltoo_3_2024_web_Part182.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part2.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part2.pdf>) |
| Kogu hingest töötades ei tohi iseennast kaotada | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part3.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part3.pdf>) |
| Kanepi vallas on sotsiaaltöötaja eelkõige kogukonna liige | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part4.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part4.pdf>) |
| Töötingimused on sotsiaal- ja lastekaitsetöötajate heaolu põhiküsimus | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part5.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part5.pdf>) |
| Sotsiaaltöö spetsialistide enesehoiu arusaamad ja kogemused | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part6.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part6.pdf>) |
| Köielkõnd ja habras motivatsioon: täiskasvanud õppija ja sotsiaalpedagoogiline töö täiskasvanute gümnaasiumites | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part7.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part7.pdf>) |
| Hädaohus oleva lapse abistamine lastekaitsetöötaja vaates | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part8.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part8.pdf>) |
| Lasteabi tulemuslikkus oleneb koostöö kvaliteedist | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part9.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part9.pdf>) |
| Lähisuhtevägivald ja ohvriabi võimalused | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part10.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part10.pdf>) |
| Juhtumikorraldusmudel „Turvalisuse märgid“ – uus tööriist Eesti lastekaitsetöös | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part11.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part11.pdf>) |
| Taastav käsitlusviis loob suhteid ja muudab ühiskonda sidusamaks | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part12.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part12.pdf>) |
| Tähenduslikke kogukondlikke sidemeid otsimas. Vaimse tervise raskustega inimesed kaasuurijatena | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part13.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part13.pdf>) |
| Sõna võim – väärtustav keelekasutus sotsiaalvaldkonna töös | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part14.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part14.pdf>) |
| Erik Allardti heaoluteooria kasutamine Tallinna ülikooli sotsiaalkaitse suuna magistritöödes | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part15.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part15.pdf>) |
| Sotsiaaltöö professiooni kujunemise kolm sammast: praktika, erialaharidus ja uurimistöö | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part16.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part16.pdf>) |
| Lapse haavatavusel on suhete nägu | [ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part171.pdf](<ajakiri_sotsiaaltoo/24-4/sotsiaaltoo_4_2024_web_Part171.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/25-1/Eessõna 1_2025 _ Tervise Arengu Instituut.pdf](<ajakiri_sotsiaaltoo/25-1/Eessõna 1_2025 _ Tervise Arengu Instituut.pdf>) |
| Kas vanus määrab meie võimalused? Vanuseline diskrimineerimine tööl ja ühiskonnas | [ajakiri_sotsiaaltoo/25-1/1_2025_vanuseline diskrimineerimine.pdf](<ajakiri_sotsiaaltoo/25-1/1_2025_vanuseline diskrimineerimine.pdf>) |
| Kagu-Eesti arenguprogramm innustas omavalitsusi arendama hoolekandeteenuseid | [ajakiri_sotsiaaltoo/25-1/Kagu-Eesti arenguprogramm innustas omavalitsusi arendama hoolekandeteenuseid_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Kagu-Eesti arenguprogramm innustas omavalitsusi arendama hoolekandeteenuseid_1_2025.pdf>) |
| Eriline ja samasugune ühekorraga – Taiwani sotsiaalsüsteemiga tutvumise kogemus | [ajakiri_sotsiaaltoo/25-1/Eriline ja samasugune ühekorraga – Taiwani sotsiaalsüsteemiga tutvumise kogemus_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Eriline ja samasugune ühekorraga – Taiwani sotsiaalsüsteemiga tutvumise kogemus_1_2025.pdf>) |
| Johannes Mihkelsoni keskus ootab naisi tööturul hakkamasaamist hõlbustavale koolitusele | [ajakiri_sotsiaaltoo/25-1/Johannes Mihkelsoni keskus ootab naisi tööturul hakkamasaamist hõlbustavale koolitusele_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Johannes Mihkelsoni keskus ootab naisi tööturul hakkamasaamist hõlbustavale koolitusele_1_2025.pdf>) |
| Marelle Erlenheim: mulle meeldib, kui saan kasulik olla | [ajakiri_sotsiaaltoo/25-1/Marelle Erlenheim_mulle meeldib, kui saan kasulik olla_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Marelle Erlenheim_mulle meeldib, kui saan kasulik olla_1_2025.pdf>) |
| Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule | [ajakiri_sotsiaaltoo/25-1/Kas sotsiaalabi on (turva)võrk või hüppelaud_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Kas sotsiaalabi on (turva)võrk või hüppelaud_1_2025.pdf>) |
| Koosloome ja koostöö Kagu-Eesti sotsiaalvaldkonna arenguprogrammis | [ajakiri_sotsiaaltoo/25-1/Koosloome ja koostöö Kagu-Eesti sotsiaalvaldkonna arenguprogrammis_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Koosloome ja koostöö Kagu-Eesti sotsiaalvaldkonna arenguprogrammis_1_2025.pdf>) |
| Kuidas vallast saab puudesõbralik vald? | [ajakiri_sotsiaaltoo/25-1/Kuidas vallast saab puudesõbralik vald_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Kuidas vallast saab puudesõbralik vald_1_2025.pdf>) |
| Lapse õigus kasvada peres: suhetel põhinevad lapse õigused asendushooldusel | [ajakiri_sotsiaaltoo/25-1/Lapse õigus kasvada peres_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Lapse õigus kasvada peres_1_2025.pdf>) |
| Solidaarsusele tuginev sotsiaalne jätkusuutlikkus: lõimitud käsitlus kutselises sotsiaaltöös ja sotsiaalpoliitikas | [ajakiri_sotsiaaltoo/25-1/Solidaarsusele tuginev sotsiaalne jätkusuutlikkus_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Solidaarsusele tuginev sotsiaalne jätkusuutlikkus_1_2025.pdf>) |
| Miks on tervise ebavõrdsust süvendavaid otsuseid nii lihtne teha? | [ajakiri_sotsiaaltoo/25-1/Miks on tervise ebavõrdsust süvendavaid otsuseid nii lihtne teha_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Miks on tervise ebavõrdsust süvendavaid otsuseid nii lihtne teha_1_2025.pdf>) |
| Miks on vaja vähendada ebavõrdsust ja kuidas seda teha? | [ajakiri_sotsiaaltoo/25-1/Miks on vaja vähendada ebavõrdsust ja kuidas seda teha_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Miks on vaja vähendada ebavõrdsust ja kuidas seda teha_1_2025.pdf>) |
| Rahvastiku tervis muutuste ja kriiside kontekstis: tervise ebavõrdsuse mustrid ja murekohad | [ajakiri_sotsiaaltoo/25-1/Rahvastiku tervis muutuste ja kriiside kontekstis_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Rahvastiku tervis muutuste ja kriiside kontekstis_1_2025.pdf>) |
| Võlanõustamisteenus aastatel 2018–2023 | [ajakiri_sotsiaaltoo/25-1/Võlanõustamisteenus aastatel 2018–2023_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Võlanõustamisteenus aastatel 2018–2023_1_2025.pdf>) |
| Stigma ja reformid: alaealiste kinnipidamise keeruline küsimus Eestis | [ajakiri_sotsiaaltoo/25-1/Stigma ja reformid_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Stigma ja reformid_1_2025.pdf>) |
| Ukraina põgenikest naiste kogemused – kuidas toetada Eestis täisväärtusliku elu ülesehitamist? | [ajakiri_sotsiaaltoo/25-1/Ukraina põgenikest naiste kogemused – kuidas toetada Eestis täisväärtusliku elu ülesehitamist_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Ukraina põgenikest naiste kogemused – kuidas toetada Eestis täisväärtusliku elu ülesehitamist_1_2025.pdf>) |
| Ukraina sõjapõgenike elu Eesti lühiajalistes majutustes | [ajakiri_sotsiaaltoo/25-1/Ukraina sõjapõgenike elu Eesti lühiajalistes majutustes_1_2021.pdf](<ajakiri_sotsiaaltoo/25-1/Ukraina sõjapõgenike elu Eesti lühiajalistes majutustes_1_2021.pdf>) |
| Ühised hetked ja üksteiselt õppimine: kuidas eri põlvkonnad koos heaolu loovad | [ajakiri_sotsiaaltoo/25-1/Ühised hetked ja üksteiselt õppimine_kuidas eri põlvkonnad koos heaolu loovad_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Ühised hetked ja üksteiselt õppimine_kuidas eri põlvkonnad koos heaolu loovad_1_2025.pdf>) |
| Õigus saada sotsiaalteenuseid võrdsetel alustel | [ajakiri_sotsiaaltoo/25-1/Õigus saada sotsiaalteenuseid võrdsetel alustel_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Õigus saada sotsiaalteenuseid võrdsetel alustel_1_2025.pdf>) |
| Vägivald vanemaealiste vastu vajab tähelepanu | [ajakiri_sotsiaaltoo/25-1/Vägivald vanemaealiste vastu vajab tähelepanu_1_2025.pdf](<ajakiri_sotsiaaltoo/25-1/Vägivald vanemaealiste vastu vajab tähelepanu_1_2025.pdf>) |
| Eessõna 2/2025 | [ajakiri_sotsiaaltoo/25-2/Eessõna 2_2025 _ Tervise Arengu Instituut.pdf](<ajakiri_sotsiaaltoo/25-2/Eessõna 2_2025 _ Tervise Arengu Instituut.pdf>) |
| Lemme Haldre: laste mõistmist oleks rohkem vaja | [ajakiri_sotsiaaltoo/25-2/Lemme Haldre_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Lemme Haldre_2_2025.pdf>) |
| Mälestuseks. Inimlike väärtuste järgija Riho Rahuoja | [ajakiri_sotsiaaltoo/25-2/Riho_mälestusteks_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Riho_mälestusteks_2_2025.pdf>) |
| Eesmärk on parandada tervishoiu ja sotsiaalvaldkonna koostööd | [ajakiri_sotsiaaltoo/25-2/Eesmärk on parandada tervishoiu ja sotsiaalvaldkonna koostööd_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Eesmärk on parandada tervishoiu ja sotsiaalvaldkonna koostööd_2_2025.pdf>) |
| Vaimse tervise teenused kodu lähedal – omavalitsuse täiendav tugi oma inimestele | [ajakiri_sotsiaaltoo/25-2/Vaimse tervise teenused kodu lähedal – omavalitsuse täiendav tugi oma inimestele_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Vaimse tervise teenused kodu lähedal – omavalitsuse täiendav tugi oma inimestele_2_2025.pdf>) |
| Abi kasutajal on õigused, aga kas ka kohustused? | [ajakiri_sotsiaaltoo/25-2/Abi kasutajal on õigused, aga kas ka kohustused_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Abi kasutajal on õigused, aga kas ka kohustused_2_2025.pdf>) |
| Kohalikud omavalitsused kannavad hoolt elanike vaimse tervise eest | [ajakiri_sotsiaaltoo/25-2/Kohalikud omavalitsused kannavad hoolt elanike vaimse tervise eest_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Kohalikud omavalitsused kannavad hoolt elanike vaimse tervise eest_2_2025.pdf>) |
| Hea töö ei sünni Excelis – lastekaitsetöötajad ootavad järelevalvelt selgust ja tuge | [ajakiri_sotsiaaltoo/25-2/Hea töö ei sünni Excelis – lastekaitsetöötajad ootavad järelevalvelt selgust ja tuge_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Hea töö ei sünni Excelis – lastekaitsetöötajad ootavad järelevalvelt selgust ja tuge_2_2025.pdf>) |
| Kohustus osutada sotsiaalteenuseid võrdsetel alustel | [ajakiri_sotsiaaltoo/25-2/Kohustus osutada sotsiaalteenuseid võrdsetel alustel_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Kohustus osutada sotsiaalteenuseid võrdsetel alustel_2_2025.pdf>) |
| Tallinna erihoolekande ja rehabilitatsiooni keskus järgib väärtusi ja loob võimalusi | [ajakiri_sotsiaaltoo/25-2/Tallinna erihoolekande ja rehabilitatsiooni keskus järgib väärtusi ja loob võimalusi_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Tallinna erihoolekande ja rehabilitatsiooni keskus järgib väärtusi ja loob võimalusi_2_2025.pdf>) |
| Uus hindamismeetod aitab saada lapse kahjustavast seksuaalkäitumisest laiema pildi | [ajakiri_sotsiaaltoo/25-2/Uus hindamismeetod aitab saada lapse kahjustavast seksuaalkäitumisest laiema pildi_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Uus hindamismeetod aitab saada lapse kahjustavast seksuaalkäitumisest laiema pildi_2_2025.pdf>) |
| Tervisealane kirjaoskus – kuidas jõuda tervise võrdsuseni? | [ajakiri_sotsiaaltoo/25-2/Tervisealane kirjaoskus – kuidas jõuda tervise võrdsuseni_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Tervisealane kirjaoskus – kuidas jõuda tervise võrdsuseni_2_2025.pdf>) |
| Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid | [ajakiri_sotsiaaltoo/25-2/Tehisintellekt sotsiaaltöös_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Tehisintellekt sotsiaaltöös_2_2025.pdf>) |
| Sotsiaalvaldkonna terminoloogiatööst ja terminitest | [ajakiri_sotsiaaltoo/25-2/Sotsiaalvaldkonna terminoloogiatööst ja terminitest_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Sotsiaalvaldkonna terminoloogiatööst ja terminitest_2_2025.pdf>) |
| Funktsioneerimisvõimega seotud terviseandmeid tasub koguda ühtsetel alustel | [ajakiri_sotsiaaltoo/25-2/Funktsioneerimisvõimega seotud terviseandmeid tasub koguda ühtsetel alustel_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Funktsioneerimisvõimega seotud terviseandmeid tasub koguda ühtsetel alustel_2_2025.pdf>) |
| Lastega töötavad spetsialistid saavad lapse muresid märgata varakult | [ajakiri_sotsiaaltoo/25-2/Lastega töötavad spetsialistid saavad lapse muresid märgata varakult_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Lastega töötavad spetsialistid saavad lapse muresid märgata varakult_2_2025.pdf>) |
| Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is | [ajakiri_sotsiaaltoo/25-2/Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is_2_2025.pdf>) |
| Tööampsu abil tööturule | [ajakiri_sotsiaaltoo/25-2/Tööampsu abil tööturule_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Tööampsu abil tööturule_2_2025.pdf>) |
| Tervishoiu ja sotsiaalvaldkonna kvalifikatsiooninõudeid ja väljaõpet saab hinnata ühtse metoodikaga | [ajakiri_sotsiaaltoo/25-2/Tervishoiu ja sotsiaalvaldkonna kvalifikatsiooninõudeid ja väljaõpet saab hinnata ühtse metoodikaga_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Tervishoiu ja sotsiaalvaldkonna kvalifikatsiooninõudeid ja väljaõpet saab hinnata ühtse metoodikaga_2_2025.pdf>) |
| Kopsuvähi patsiendi teekonnast andmeanalüüsi põhjal | [ajakiri_sotsiaaltoo/25-2/Kopsuvähi patsiendi teekonnast andmeanalüüsi põhjal_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Kopsuvähi patsiendi teekonnast andmeanalüüsi põhjal_2_2025.pdf>) |
| Sünnitusosakondade sulgemise tõttu tõuseb esiplaanile tervishoiu ja sotsiaaltöö koostöövajadus | [ajakiri_sotsiaaltoo/25-2/Sünnitusosakondade sulgemise tõttu tõuseb esiplaanile tervishoiu ja sotsiaaltöö koostöövajadus_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Sünnitusosakondade sulgemise tõttu tõuseb esiplaanile tervishoiu ja sotsiaaltöö koostöövajadus_2_2025.pdf>) |
| Sotsiaaltöö aastal 2050. Unistus sotsiaalkiirabist | [ajakiri_sotsiaaltoo/25-2/Sotsiaaltöö aastal 2050. Unistus sotsiaalkiirabist_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Sotsiaaltöö aastal 2050. Unistus sotsiaalkiirabist_2_2025.pdf>) |
| Uus juhend: laste ja vanaduspensioniealiste puude raskusastme tuvastamine | [ajakiri_sotsiaaltoo/25-2/Uus juhend_ laste ja vanaduspensioniealiste puude raskusastme tuvastamine_2_2025.pdf](<ajakiri_sotsiaaltoo/25-2/Uus juhend_ laste ja vanaduspensioniealiste puude raskusastme tuvastamine_2_2025.pdf>) |
| Dementsuse ennetamise tõenduspõhised soovitused ja perearsti kogemused | [ajakiri_sotsiaaltoo/25-3/6web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/6web_sotsiaaltoo_3-2025.pdf>) |
| Dementsuse valdkonna ümberkujundamine. Kas Šotimaa inimkeskne vaatenurk võib inspireerida muutust Eestis? | [ajakiri_sotsiaaltoo/25-3/9web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/9web_sotsiaaltoo_3-2025.pdf>) |
| Dementsusega inimesed peaksid olema ühiskonnas kaua tegusad | [ajakiri_sotsiaaltoo/25-3/7web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/7web_sotsiaaltoo_3-2025.pdf>) |
| Dementsusega inimestele parima abi pakkumises ollakse poolel teel | [ajakiri_sotsiaaltoo/25-3/1web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/1web_sotsiaaltoo_3-2025.pdf>) |
| Eesti hoolekandeasutuste liit seisab teenuste kvaliteedi ja valdkonna maine eest | [ajakiri_sotsiaaltoo/25-3/12web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/12web_sotsiaaltoo_3-2025.pdf>) |
| Haapsalus on koduteenus palju arenenud ja vajab palju veel arendamist | [ajakiri_sotsiaaltoo/25-3/2web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/2web_sotsiaaltoo_3-2025.pdf>) |
| Hoolekande tulevik on professionaalsete hooldustöötajate päralt | [ajakiri_sotsiaaltoo/25-3/11web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/11web_sotsiaaltoo_3-2025.pdf>) |
| Isikukeskne (eri)hoolekanne: paindliku rahastusega toetus kogukonna keskel | [ajakiri_sotsiaaltoo/25-3/8web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/8web_sotsiaaltoo_3-2025.pdf>) |
| Kaasata ja olla kaasatud: kaasatava vaade | [ajakiri_sotsiaaltoo/25-3/14web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/14web_sotsiaaltoo_3-2025.pdf>) |
| Kuidas saab sotsiaaltöötaja toetada väärkohtlemist kogenud vanemaealist? | [ajakiri_sotsiaaltoo/25-3/15web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/15web_sotsiaaltoo_3-2025.pdf>) |
| Mäluhäiretega inimeste toetamisest isikuabini – koduteenus Keilas | [ajakiri_sotsiaaltoo/25-3/3web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/3web_sotsiaaltoo_3-2025.pdf>) |
| Õigus loomupärasele väärikusele, otsustusõigusele ja „häälele“ inimõiguste vaatenurgast | [ajakiri_sotsiaaltoo/25-3/5web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/5web_sotsiaaltoo_3-2025.pdf>) |
| Õppivate hooldustöötajate vaade hoolekandesektori paindliku töö võimalustele | [ajakiri_sotsiaaltoo/25-3/16web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/16web_sotsiaaltoo_3-2025.pdf>) |
| Toimetulek dementsusega vananevas ühiskonnas Jaapani näitel | [ajakiri_sotsiaaltoo/25-3/10web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/10web_sotsiaaltoo_3-2025.pdf>) |
| Vajadustest lähtuv hool ja abi igas kodus | [ajakiri_sotsiaaltoo/25-3/4web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/4web_sotsiaaltoo_3-2025.pdf>) |
| Võim ja vastastikkus abistavates suhetes | [ajakiri_sotsiaaltoo/25-3/13web_sotsiaaltoo_3-2025.pdf](<ajakiri_sotsiaaltoo/25-3/13web_sotsiaaltoo_3-2025.pdf>) |
| Eessõna 4/2025 | [ajakiri_sotsiaaltoo/25-4/Eessõna4_2025.pdf](<ajakiri_sotsiaaltoo/25-4/Eessõna4_2025.pdf>) |
| Eesti kristlike sotsiaalteenuste kontseptsioonid | [ajakiri_sotsiaaltoo/25-4/Eesti kristlike sotsiaalteenuste kontseptsioonid.pdf](<ajakiri_sotsiaaltoo/25-4/Eesti kristlike sotsiaalteenuste kontseptsioonid.pdf>) |
| Kanepipoliitika varjatud tagajärjed: sotsiaaltöö pilk legaliseerimisele | [ajakiri_sotsiaaltoo/25-4/Kanepipoliitika varjatud tagajärjed_sotsiaaltöö pilk legaliseerimisele.pdf](<ajakiri_sotsiaaltoo/25-4/Kanepipoliitika varjatud tagajärjed_sotsiaaltöö pilk legaliseerimisele.pdf>) |
| Laste võõrandamine vanemast Eestis: kolm asjaolu, mida on vaja kiiresti muuta | [ajakiri_sotsiaaltoo/25-4/Laste võõrandamine vanemast Eestis_kolm asjaolu, mida on vaja kiiresti muuta.pdf](<ajakiri_sotsiaaltoo/25-4/Laste võõrandamine vanemast Eestis_kolm asjaolu, mida on vaja kiiresti muuta.pdf>) |
| Lastekaitsetöötajate ühing on ellu kutsutud tugeva ja jätkusuutliku lastekaitsetöö heaks | [ajakiri_sotsiaaltoo/25-4/Lastekaitsetöötajate ühing on ellu kutsutud tugeva ja jätkusuutliku lastekaitsetöö heaks.pdf](<ajakiri_sotsiaaltoo/25-4/Lastekaitsetöötajate ühing on ellu kutsutud tugeva ja jätkusuutliku lastekaitsetöö heaks.pdf>) |
| Mida tähendavad toimetulekutoetuse määramise muudatused kohalikele omavalitsustele ja sotsiaaltöötajatele? | [ajakiri_sotsiaaltoo/25-4/Mida tähendavad toimetulekutoetuse määramise muudatused kohalikele omavalitsustele ja sotsiaaltöötajatele.pdf](<ajakiri_sotsiaaltoo/25-4/Mida tähendavad toimetulekutoetuse määramise muudatused kohalikele omavalitsustele ja sotsiaaltöötajatele.pdf>) |
| Mobiilsed tervishoiuteenused aitavad hoida maapiirkondade elujõulisust ja võrdset ligipääsu tervishoiule | [ajakiri_sotsiaaltoo/25-4/Mobiilsed tervishoiuteenused aitavad hoida maapiirkondade elujõulisust ja võrdset ligipääsu tervishoiule.pdf](<ajakiri_sotsiaaltoo/25-4/Mobiilsed tervishoiuteenused aitavad hoida maapiirkondade elujõulisust ja võrdset ligipääsu tervishoiule.pdf>) |
| Prostitutsiooni tegelikkus ja illusioon: traumateadlik vaatenurk | [ajakiri_sotsiaaltoo/25-4/Prostitutsiooni tegelikkus ja illusioon_traumateadlik vaatenurk.pdf](<ajakiri_sotsiaaltoo/25-4/Prostitutsiooni tegelikkus ja illusioon_traumateadlik vaatenurk.pdf>) |
| Rahvusvaheline töövarjutamine hoolekandes annab kogemusi ja muudab mõtte- ning tegutsemisviisi! | [ajakiri_sotsiaaltoo/25-4/Rahvusvaheline töövarjutamine hoolekandes annab kogemusi ja muudab mõtte-ning tegutsemisviisi.pdf](<ajakiri_sotsiaaltoo/25-4/Rahvusvaheline töövarjutamine hoolekandes annab kogemusi ja muudab mõtte-ning tegutsemisviisi.pdf>) |
| Sekkumisprogramm „Cool Kids“ pakub tuge ärevushäire riskiga lastele ja nende vanematele | [ajakiri_sotsiaaltoo/25-4/Sekkumisprogramm „Cool Kids“ pakub tuge ärevushäire riskiga lastele ja nende vanematele.pdf](<ajakiri_sotsiaaltoo/25-4/Sekkumisprogramm „Cool Kids“ pakub tuge ärevushäire riskiga lastele ja nende vanematele.pdf>) |
| Sotsiaalkiirabi vajalikkus Eestis: ajakohane lahendus kiirabisüsteemi ülekoormusele | [ajakiri_sotsiaaltoo/25-4/Sotsiaalkiirabi vajalikkus Eestis_ajakohane lahendus kiirabisüsteemi ülekoormusele.pdf](<ajakiri_sotsiaaltoo/25-4/Sotsiaalkiirabi vajalikkus Eestis_ajakohane lahendus kiirabisüsteemi ülekoormusele.pdf>) |
| Sotsiaaltöö on aastal 2050 rohkem nähtav ja toetab ühiskonna sidusust | [ajakiri_sotsiaaltoo/25-4/Sotsiaaltöö on aastal 2050 rohkem nähtav ja toetab ühiskonna sidusust.pdf](<ajakiri_sotsiaaltoo/25-4/Sotsiaaltöö on aastal 2050 rohkem nähtav ja toetab ühiskonna sidusust.pdf>) |
| Sotsiaaltöö roll ühiskonnas aastal 2050. Rohkem vanemaealisi hooldusperesid | [ajakiri_sotsiaaltoo/25-4/Sotsiaaltöö roll ühiskonnas aastal 2050. Rohkem vanemaealisi hooldusperesid.pdf](<ajakiri_sotsiaaltoo/25-4/Sotsiaaltöö roll ühiskonnas aastal 2050. Rohkem vanemaealisi hooldusperesid.pdf>) |
| Taastava õiguse rakendamise võimalused ja kogemused | [ajakiri_sotsiaaltoo/25-4/Taastava õiguse rakendamise võimalused ja kogemused.pdf](<ajakiri_sotsiaaltoo/25-4/Taastava õiguse rakendamise võimalused ja kogemused.pdf>) |
| Töötaja saab edaspidi töötuskindlustusest suurema kaitse | [ajakiri_sotsiaaltoo/25-4/Töötaja saab edaspidi töötuskindlustusest suurema kaitse.pdf](<ajakiri_sotsiaaltoo/25-4/Töötaja saab edaspidi töötuskindlustusest suurema kaitse.pdf>) |
| Usalduse kunst: Lastemaja koolitab spetsialiste last kuulama ja mõistma | [ajakiri_sotsiaaltoo/25-4/Usalduse kunst_Lastemaja koolitab spetsialiste last kuulama ja mõistma.pdf](<ajakiri_sotsiaaltoo/25-4/Usalduse kunst_Lastemaja koolitab spetsialiste last kuulama ja mõistma.pdf>) |
| Vägivalla katkestamine algab põhjustest, mitte tagajärgedest | [ajakiri_sotsiaaltoo/25-4/Vägivalla katkestamine algab põhjustest, mitte tagajärgedest.pdf](<ajakiri_sotsiaaltoo/25-4/Vägivalla katkestamine algab põhjustest, mitte tagajärgedest.pdf>) |
| Vaimse tervise spetsialistide vahetusprogramm Barcelonas | [ajakiri_sotsiaaltoo/25-4/Vaimse tervise spetsialistide vahetusprogramm Barcelonas.pdf](<ajakiri_sotsiaaltoo/25-4/Vaimse tervise spetsialistide vahetusprogramm Barcelonas.pdf>) |
| Vanemaealised liikluses: kas meedia toetab või takistab? | [ajakiri_sotsiaaltoo/25-4/Vanemaealised liikluses_kas meedia toetab või takistab.pdf](<ajakiri_sotsiaaltoo/25-4/Vanemaealised liikluses_kas meedia toetab või takistab.pdf>) |
| Vanemlusprogramm „Triple P Beebi“ pakub tuge uutele lapsevanematele | [ajakiri_sotsiaaltoo/25-4/Vanemlusprogramm „Triple P Beebi“ pakub tuge uutele lapsevanematele.pdf](<ajakiri_sotsiaaltoo/25-4/Vanemlusprogramm „Triple P Beebi“ pakub tuge uutele lapsevanematele.pdf>) |
| Eessõna | [ajakiri_sotsiaaltoo/26-1/eessona.html](<ajakiri_sotsiaaltoo/26-1/eessona.html>) |
| Erasmus+ LOCUS projekt Eestis | [ajakiri_sotsiaaltoo/26-1/erasmus-locus-projekt-eestis-ingrid-sindi-kommentaar.html](<ajakiri_sotsiaaltoo/26-1/erasmus-locus-projekt-eestis-ingrid-sindi-kommentaar.html>) |
| Kuuluvustunne ja naabruskonna solidaarsus. Uued teadmised projektist LOCUS | [ajakiri_sotsiaaltoo/26-1/kuuluvustunne-ja-naabruskonna-solidaarsus-locus-pohiartikkel.html](<ajakiri_sotsiaaltoo/26-1/kuuluvustunne-ja-naabruskonna-solidaarsus-locus-pohiartikkel.html>) |
| Mis tähendus on kohal? Kriitiline vaade solidaarsusele ja kuuluvusele Sillamäe näitel | [ajakiri_sotsiaaltoo/26-1/mis-tahendus-on-kohal-kriitiline-vaade-solidaarsusele-ja-kuuluvusele-sillamae-na.html](<ajakiri_sotsiaaltoo/26-1/mis-tahendus-on-kohal-kriitiline-vaade-solidaarsusele-ja-kuuluvusele-sillamae-na.html>) |
| Omavalitsuse sotsiaaltöö „monopol“ ja selle varjatud hind | [ajakiri_sotsiaaltoo/26-1/omavalitsuse-sotsiaaltoo-monopol-ja-selle-varjatud-hind.html](<ajakiri_sotsiaaltoo/26-1/omavalitsuse-sotsiaaltoo-monopol-ja-selle-varjatud-hind.html>) |
| Planeedi käekäigust hooliv solidaarsus ja sotsiaaltöö kolmanda modernsuse ajastul. Analüütiline vaade nüüdisajale | [ajakiri_sotsiaaltoo/26-1/planeedi-kaekaigust-hooliv-solidaarsus-ja-sotsiaaltoo-kolmanda-modernsuse-ajastu.html](<ajakiri_sotsiaaltoo/26-1/planeedi-kaekaigust-hooliv-solidaarsus-ja-sotsiaaltoo-kolmanda-modernsuse-ajastu.html>) |
| Solidaarsus ja kogukondlik koostöö kerksuse suurendamiseks | [ajakiri_sotsiaaltoo/26-1/solidaarsus-ja-kogukondlik-koostoo-kerksuse-suurendamiseks.html](<ajakiri_sotsiaaltoo/26-1/solidaarsus-ja-kogukondlik-koostoo-kerksuse-suurendamiseks.html>) |
| Solidaarsus kasuvanemluses – kooskõlastatud vastutus lapse heaolu eest | [ajakiri_sotsiaaltoo/26-1/solidaarsus-kasuvanemluses-kooskolastatud-vastutus-lapse-heaolu-eest.html](<ajakiri_sotsiaaltoo/26-1/solidaarsus-kasuvanemluses-kooskolastatud-vastutus-lapse-heaolu-eest.html>) |
| Solidaarsus kui sotsiaaltöö erialahariduse, uurimise ja praktika raamistik | [ajakiri_sotsiaaltoo/26-1/solidaarsus-kui-sotsiaaltoo-erialahariduse-uurimise-ja-praktika-raamistik.html](<ajakiri_sotsiaaltoo/26-1/solidaarsus-kui-sotsiaaltoo-erialahariduse-uurimise-ja-praktika-raamistik.html>) |
| Solidaarsus sotsiaaltöös lastekaitse vaatenurgast | [ajakiri_sotsiaaltoo/26-1/solidaarsus-sotsiaaltoos-lastekaitse-vaatenurgast.html](<ajakiri_sotsiaaltoo/26-1/solidaarsus-sotsiaaltoos-lastekaitse-vaatenurgast.html>) |
| Solidaarsus vaimses tervises tähendab individuaalset kogemust ja kollektiivset vastutust | [ajakiri_sotsiaaltoo/26-1/solidaarsus-vaimses-tervises-tahendab-individuaalset-kogemust-ja-kollektiivset-v.html](<ajakiri_sotsiaaltoo/26-1/solidaarsus-vaimses-tervises-tahendab-individuaalset-kogemust-ja-kollektiivset-v.html>) |
| Solidaarsuse alused ja vormid | [ajakiri_sotsiaaltoo/26-1/solidaarsuse-alused-ja-vormid.html](<ajakiri_sotsiaaltoo/26-1/solidaarsuse-alused-ja-vormid.html>) |
| Solidaarsusest ja sotsiaalpedagoogikast | [ajakiri_sotsiaaltoo/26-1/solidaarsusest-ja-sotsiaalpedagoogikast.html](<ajakiri_sotsiaaltoo/26-1/solidaarsusest-ja-sotsiaalpedagoogikast.html>) |
| Eessõna | [ajakiri_sotsiaaltoo/26-2/eessona.html](<ajakiri_sotsiaaltoo/26-2/eessona.html>) |
| Eestkostjal on lisaks asjaajamisele palju muid ülesandeid | [ajakiri_sotsiaaltoo/26-2/eestkostjal-on-lisaks-asjaajamisele-palju-muid-ulesandeid.html](<ajakiri_sotsiaaltoo/26-2/eestkostjal-on-lisaks-asjaajamisele-palju-muid-ulesandeid.html>) |
| Elva perekeskus: laste ja noorte hea käekäik on kogukonna ühine südameasi | [ajakiri_sotsiaaltoo/26-2/elva-perekeskus-laste-ja-noorte-hea-kaekaik-on-kogukonna-uhine-sudameasi.html](<ajakiri_sotsiaaltoo/26-2/elva-perekeskus-laste-ja-noorte-hea-kaekaik-on-kogukonna-uhine-sudameasi.html>) |
| Hooliv ja uuendusmeelne Viljandi vald tegutseb elanike kestva heaolu nimel | [ajakiri_sotsiaaltoo/26-2/hooliv-ja-uuendusmeelne-viljandi-vald-tegutseb-elanike-kestva-heaolu-nimel.html](<ajakiri_sotsiaaltoo/26-2/hooliv-ja-uuendusmeelne-viljandi-vald-tegutseb-elanike-kestva-heaolu-nimel.html>) |
| Judit Strömpli põnev teekond sotsiaaltöö uurija ja õpetajana | [ajakiri_sotsiaaltoo/26-2/judit-strompli-ponev-teekond-sotsiaaltoo-uurija-ja-opetajana.html](<ajakiri_sotsiaaltoo/26-2/judit-strompli-ponev-teekond-sotsiaaltoo-uurija-ja-opetajana.html>) |
| Kas oleme valmis päriselt rääkima töötajate turvalisusest sotsiaaltöös? | [ajakiri_sotsiaaltoo/26-2/kas-oleme-valmis-pariselt-raakima-tootajate-turvalisusest-sotsiaaltoos.html](<ajakiri_sotsiaaltoo/26-2/kas-oleme-valmis-pariselt-raakima-tootajate-turvalisusest-sotsiaaltoos.html>) |
| KLAT kui viimane abinõu peab olema turvaline ja tekitama muutust | [ajakiri_sotsiaaltoo/26-2/klat-kui-viimane-abinou-peab-olema-turvaline-ja-tekitama-muutust.html](<ajakiri_sotsiaaltoo/26-2/klat-kui-viimane-abinou-peab-olema-turvaline-ja-tekitama-muutust.html>) |
| Mentorlus aitab kaasa sotsiaalvaldkonna juhtide arengule ja enesehoiule | [ajakiri_sotsiaaltoo/26-2/mentorlus-aitab-kaasa-sotsiaalvaldkonna-juhtide-arengule-ja-enesehoiule.html](<ajakiri_sotsiaaltoo/26-2/mentorlus-aitab-kaasa-sotsiaalvaldkonna-juhtide-arengule-ja-enesehoiule.html>) |
| Mida näitab 2025. aasta elanikkonnaküsitlus tegevuspiirangute, hooldusvajaduse ja teenuseni jõudmise kohta? | [ajakiri_sotsiaaltoo/26-2/mida-naitab-2025-aasta-elanikkonnakusitlus-tegevuspiirangute-hooldusvajaduse-ja-.html](<ajakiri_sotsiaaltoo/26-2/mida-naitab-2025-aasta-elanikkonnakusitlus-tegevuspiirangute-hooldusvajaduse-ja-.html>) |
| Mida oleme ühe aastaga õppinud mudeli „Turvalisuse märgid“ rakendamisest Eesti lastekaitses? | [ajakiri_sotsiaaltoo/26-2/mida-oleme-uhe-aastaga-oppinud-mudeli-turvalisuse-margid-rakendamisest-eesti-las.html](<ajakiri_sotsiaaltoo/26-2/mida-oleme-uhe-aastaga-oppinud-mudeli-turvalisuse-margid-rakendamisest-eesti-las.html>) |
| Mida saame õppida eaka abivajaja arvel rikastunud sotsiaaltöötaja juhtumist? | [ajakiri_sotsiaaltoo/26-2/mida-saame-oppida-eaka-abivajaja-arvel-rikastunud-sotsiaaltootaja-juhtumist.html](<ajakiri_sotsiaaltoo/26-2/mida-saame-oppida-eaka-abivajaja-arvel-rikastunud-sotsiaaltootaja-juhtumist.html>) |
| Narva-Jõesuu linnas on inimkesksus tulemusliku sotsiaaltöö nurgakivi | [ajakiri_sotsiaaltoo/26-2/narva-joesuu-linnas-on-inimkesksus-tulemusliku-sotsiaaltoo-nurgakivi.html](<ajakiri_sotsiaaltoo/26-2/narva-joesuu-linnas-on-inimkesksus-tulemusliku-sotsiaaltoo-nurgakivi.html>) |
| Psüühikahäirega inimeste toetus- ja eestkostesüsteem vajab põhjalikku ümbermõtestamist | [ajakiri_sotsiaaltoo/26-2/psuuhikahairega-inimeste-toetus-ja-eestkostesusteem-vajab-pohjalikku-umbermotest.html](<ajakiri_sotsiaaltoo/26-2/psuuhikahairega-inimeste-toetus-ja-eestkostesusteem-vajab-pohjalikku-umbermotest.html>) |
| Rehabilitatsioonisüsteemi muudatused on samm inimesekesksema abi suunas | [ajakiri_sotsiaaltoo/26-2/rehabilitatsioonisusteemi-muudatused-on-samm-inimesekesksema-abi-suunas.html](<ajakiri_sotsiaaltoo/26-2/rehabilitatsioonisusteemi-muudatused-on-samm-inimesekesksema-abi-suunas.html>) |
| Safe box'i idee on abiks lastega töötavale spetsialistile | [ajakiri_sotsiaaltoo/26-2/safe-box-i-idee-on-abiks-lastega-tootavale-spetsialistile.html](<ajakiri_sotsiaaltoo/26-2/safe-box-i-idee-on-abiks-lastega-tootavale-spetsialistile.html>) |
| Seadusemuudatus muudab lastekaitse juhtumikorralduse sihipärasemaks | [ajakiri_sotsiaaltoo/26-2/seadusemuudatus-muudab-lastekaitse-juhtumikorralduse-sihiparasemaks.html](<ajakiri_sotsiaaltoo/26-2/seadusemuudatus-muudab-lastekaitse-juhtumikorralduse-sihiparasemaks.html>) |
| Sotsiaalkiirabi või pigem sotsiaal- ja kriisiabi? Soome kogemus | [ajakiri_sotsiaaltoo/26-2/sotsiaalkiirabi-voi-pigem-sotsiaal-ja-kriisiabi-soome-kogemus.html](<ajakiri_sotsiaaltoo/26-2/sotsiaalkiirabi-voi-pigem-sotsiaal-ja-kriisiabi-soome-kogemus.html>) |
| Sotsiaalvaldkonna spetsialistide võimestamine sillutab teed kvaliteetsemate teenusteni | [ajakiri_sotsiaaltoo/26-2/sotsiaalvaldkonna-spetsialistide-voimestamine-sillutab-teed-kvaliteetsemate-teen.html](<ajakiri_sotsiaaltoo/26-2/sotsiaalvaldkonna-spetsialistide-voimestamine-sillutab-teed-kvaliteetsemate-teen.html>) |
| Täisealiste puudega inimeste puude tuvastamise ja toetuste ning hüvede võimaliku nüüdisajastamise uuring | [ajakiri_sotsiaaltoo/26-2/taisealiste-puudega-inimeste-puude-tuvastamise-ja-toetuste-ning-huvede-voimaliku.html](<ajakiri_sotsiaaltoo/26-2/taisealiste-puudega-inimeste-puude-tuvastamise-ja-toetuste-ning-huvede-voimaliku.html>) |
| Täiskasvanute erimeelsused ei tohi varjutada lapse heaolu | [ajakiri_sotsiaaltoo/26-2/taiskasvanute-erimeelsused-ei-tohi-varjutada-lapse-heaolu.html](<ajakiri_sotsiaaltoo/26-2/taiskasvanute-erimeelsused-ei-tohi-varjutada-lapse-heaolu.html>) |
| Toevajadusega noore teekond tööturule Astangu kutserehabilitatsiooni keskuse näitel | [ajakiri_sotsiaaltoo/26-2/toevajadusega-noore-teekond-tooturule-astangu-kutserehabilitatsiooni-keskuse-nai.html](<ajakiri_sotsiaaltoo/26-2/toevajadusega-noore-teekond-tooturule-astangu-kutserehabilitatsiooni-keskuse-nai.html>) |
| Tugev sotsiaaltöö algab hoitud inimestest. Uued tööalase toe võimalused | [ajakiri_sotsiaaltoo/26-2/tugev-sotsiaaltoo-algab-hoitud-inimestest-uued-tooalase-toe-voimalused.html](<ajakiri_sotsiaaltoo/26-2/tugev-sotsiaaltoo-algab-hoitud-inimestest-uued-tooalase-toe-voimalused.html>) |
| „Turvalisuse märgid“ Tallinnas: muutus, mis ei mahu ainult ühte aastasse | [ajakiri_sotsiaaltoo/26-2/turvalisuse-margid-tallinnas-muutus-mis-ei-mahu-ainult-uhte-aastasse.html](<ajakiri_sotsiaaltoo/26-2/turvalisuse-margid-tallinnas-muutus-mis-ei-mahu-ainult-uhte-aastasse.html>) |
| „Turvalisuse märkide“ rakendamine Saue vallas: teekond ühtsema käsitluse suunas | [ajakiri_sotsiaaltoo/26-2/turvalisuse-markide-rakendamine-saue-vallas-teekond-uhtsema-kasitluse-suunas.html](<ajakiri_sotsiaaltoo/26-2/turvalisuse-markide-rakendamine-saue-vallas-teekond-uhtsema-kasitluse-suunas.html>) |
| Üksildus ja noored tänapäeva kogukondades | [ajakiri_sotsiaaltoo/26-2/uksildus-ja-noored-tanapaeva-kogukondades.html](<ajakiri_sotsiaaltoo/26-2/uksildus-ja-noored-tanapaeva-kogukondades.html>) |
| Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele | [ajakiri_sotsiaaltoo/26-2/uus-e-kursus-pakub-tuge-sotsiaalvaldkonna-koolitajatele.html](<ajakiri_sotsiaaltoo/26-2/uus-e-kursus-pakub-tuge-sotsiaalvaldkonna-koolitajatele.html>) |
| Vaigistamise kultuur lapsepõlves seksuaalselt väärkoheldud naiste kogemuste põhjal | [ajakiri_sotsiaaltoo/26-2/vaigistamise-kultuur-lapsepolves-seksuaalselt-vaarkoheldud-naiste-kogemuste-pohj.html](<ajakiri_sotsiaaltoo/26-2/vaigistamise-kultuur-lapsepolves-seksuaalselt-vaarkoheldud-naiste-kogemuste-pohj.html>) |
| Valmisolek on hoolimine. Sotsiaalvaldkond liigub jõudsalt kriisivalmiduse suunas | [ajakiri_sotsiaaltoo/26-2/valmisolek-on-hoolimine-sotsiaalvaldkond-liigub-joudsalt-kriisivalmiduse-suunas.html](<ajakiri_sotsiaaltoo/26-2/valmisolek-on-hoolimine-sotsiaalvaldkond-liigub-joudsalt-kriisivalmiduse-suunas.html>) |
| VESTA projekt Ida-Virumaal: 2025. aasta kaheksa kuud uuenduslikku koostööd tervishoiu- ja sotsiaalvaldkonnas | [ajakiri_sotsiaaltoo/26-2/vesta-projekt-ida-virumaal-2025-aasta-kaheksa-kuud-uuenduslikku-koostood-tervish.html](<ajakiri_sotsiaaltoo/26-2/vesta-projekt-ida-virumaal-2025-aasta-kaheksa-kuud-uuenduslikku-koostood-tervish.html>) |
| Hea sotsiaaltöötaja on tark inimene | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part4.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part4.pdf>) |
| Normatiivse professionaliseerumise väljakutsed | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part7.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part7.pdf>) |
| Oma praktika kujundamine. Sotsiaaltöötaja on oma ala meister | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part8.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part8.pdf>) |
| Puudega inimene kui kodanik ja tema õigused | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part11.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part11.pdf>) |
| Sidemeid loov elukutse | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part10.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part10.pdf>) |
| Sotsiaaltöö kui abistava elukutse eetilised alused | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part9.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part9.pdf>) |
| Sotsiaaltöö teadmus | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part6.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part6.pdf>) |
| Sotsiaaltöö tulevik | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part15.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part15.pdf>) |
| Sotsiaaltöötaja kodanikuühiskonnas | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part5.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part5.pdf>) |
| Sotsiaaltöötajate juhtimine | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part12.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part12.pdf>) |
| Teadmusloome sotsiaaltöös | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part13.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part13.pdf>) |
| Vajadus uurivate sotsiaaltöötajate järele | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part14.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part14.pdf>) |
| Viidatud allikad | [ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part16.pdf](<ajakiri_sotsiaaltoo/MÕTISKLUSI/147573713462_motisklusi_sotsiaaltoost_link_Part16.pdf>) |
| Hoolekande- ja tervishoiuasutuste tuleohutus | [juhendid_ja_uuringud/paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf.pdf](<juhendid_ja_uuringud/paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf.pdf>) |
| Koolilaste ja noorte vaimne tervis | [juhendid_ja_uuringud/peaasi_ee_koolilaste_ja_noorte_vaimne_tervis.pdf](<juhendid_ja_uuringud/peaasi_ee_koolilaste_ja_noorte_vaimne_tervis.pdf>) |
| sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est | [juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est.pdf>) |
| TÖÖLEHT: Abiküsimused vestluseks algkoolilapsega | [juhendid_ja_uuringud/tarkvanem_tooleht_abikusimused_vestluseks_algkoolilapsega.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_abikusimused_vestluseks_algkoolilapsega.pdf>) |
| Õpitulemuste vähendamine, asendamine ja kohustusliku õppeaine õppimisest vabastamine | [juhendid_ja_uuringud/harno_opitulemuste_vahendamine_asendamine_ja_kohustusliku_oppeaine.pdf](<juhendid_ja_uuringud/harno_opitulemuste_vahendamine_asendamine_ja_kohustusliku_oppeaine.pdf>) |
| Isikuandmed sotsiaalhoolekande- ja tervishoiusektoris | [juhendid_ja_uuringud/aki_isikuandmed_sotsiaalhoolekande_ja_tervishoiusektoris.pdf](<juhendid_ja_uuringud/aki_isikuandmed_sotsiaalhoolekande_ja_tervishoiusektoris.pdf>) |
| Isikuandmete töötleja üldjuhend | [juhendid_ja_uuringud/aki_isikuandmete_tootleja_uldjuhend.pdf](<juhendid_ja_uuringud/aki_isikuandmete_tootleja_uldjuhend.pdf>) |
| TTO-de kasutatavate kliendisuhtluskeskkondade seire kokkuvõte ja soovitused | [juhendid_ja_uuringud/aki_tto_de_kasutatavate_kliendisuhtluskeskkondade_seire_kokkuvot.pdf](<juhendid_ja_uuringud/aki_tto_de_kasutatavate_kliendisuhtluskeskkondade_seire_kokkuvot.pdf>) |
| Erivajaduste alase teadlikkuse tõstmine | [juhendid_ja_uuringud/astangu_erivajaduste_alase_teadlikkuse_tostmine.pdf](<juhendid_ja_uuringud/astangu_erivajaduste_alase_teadlikkuse_tostmine.pdf>) |
| astangu_harjutuste_kogu | [juhendid_ja_uuringud/astangu_harjutuste_kogu.pdf](<juhendid_ja_uuringud/astangu_harjutuste_kogu.pdf>) |
| Hindamisvahendi käsiraamat | [juhendid_ja_uuringud/astangu_hindamisvahendi_kasiraamat.pdf](<juhendid_ja_uuringud/astangu_hindamisvahendi_kasiraamat.pdf>) |
| Kriisi ennetamine | [juhendid_ja_uuringud/astangu_kriisi_ennetamine.pdf](<juhendid_ja_uuringud/astangu_kriisi_ennetamine.pdf>) |
| Metoodiline abimaterjal kutsealase ettevalmistuse, väljaõppe ja töölerakendumise toetamiseks coaching’u kaudu | [juhendid_ja_uuringud/astangu_metoodiline_abimaterjal_kutsealase_ettevalmistuse_valjaoppe_.pdf](<juhendid_ja_uuringud/astangu_metoodiline_abimaterjal_kutsealase_ettevalmistuse_valjaoppe_.pdf>) |
| Supervisioon | [juhendid_ja_uuringud/astangu_supervisioon.pdf](<juhendid_ja_uuringud/astangu_supervisioon.pdf>) |
| Tööandjate nõustamine ja toetamine | [juhendid_ja_uuringud/astangu_tooandjate_noustamine_ja_toetamine.pdf](<juhendid_ja_uuringud/astangu_tooandjate_noustamine_ja_toetamine.pdf>) |
| EPIKoja arengukava 2025–2030 | [juhendid_ja_uuringud/epikoda_epikoja_arengukava_2025_2030.pdf](<juhendid_ja_uuringud/epikoda_epikoja_arengukava_2025_2030.pdf>) |
| Giidi töö käsiraamat – põhimõtted ja soovitused | [juhendid_ja_uuringud/epikoda_giidi_too_kasiraamat_pohimotted_ja_soovitused.pdf](<juhendid_ja_uuringud/epikoda_giidi_too_kasiraamat_pohimotted_ja_soovitused.pdf>) |
| Heade praktikate kogumik | [juhendid_ja_uuringud/epikoda_heade_praktikate_kogumik.pdf](<juhendid_ja_uuringud/epikoda_heade_praktikate_kogumik.pdf>) |
| Puudega inimeste toimetulek kriisiajal – miniuuringu kokkuvõte | [juhendid_ja_uuringud/epikoda_puudega_inimeste_toimetulek_kriisiajal_miniuuringu_kokkuvote.pdf](<juhendid_ja_uuringud/epikoda_puudega_inimeste_toimetulek_kriisiajal_miniuuringu_kokkuvote.pdf>) |
| Teekond erilise lapse kõrval | [juhendid_ja_uuringud/epikoda_teekond_erilise_lapse_korval.pdf](<juhendid_ja_uuringud/epikoda_teekond_erilise_lapse_korval.pdf>) |
| ÜRO puuetega inimeste õiguste konventsioon ja fakultatiivprotokoll | [juhendid_ja_uuringud/epikoda_uro_puuetega_inimeste_oiguste_konventsioon_ja_fakultatiivpro.pdf](<juhendid_ja_uuringud/epikoda_uro_puuetega_inimeste_oiguste_konventsioon_ja_fakultatiivpro.pdf>) |
| 4 sammu märkamiseks ja sekkumiseks õpetajale | [juhendid_ja_uuringud/harno_4_sammu_markamiseks_ja_sekkumiseks_opetajale.pdf](<juhendid_ja_uuringud/harno_4_sammu_markamiseks_ja_sekkumiseks_opetajale.pdf>) |
| Erinevate õppijate toetamine õpetaja ja tugispetsialisti koostöös | [juhendid_ja_uuringud/harno_erinevate_oppijate_toetamine_opetaja_ja_tugispetsialisti_koo.pdf](<juhendid_ja_uuringud/harno_erinevate_oppijate_toetamine_opetaja_ja_tugispetsialisti_koo.pdf>) |
| Juhendmaterjal õpilase toetamiseks koolis | [juhendid_ja_uuringud/harno_juhendmaterjal_opilase_toetamiseks_koolis.pdf](<juhendid_ja_uuringud/harno_juhendmaterjal_opilase_toetamiseks_koolis.pdf>) |
| Juhend laagritele ja malevatele: vaimse tervise nõuanded | [juhendid_ja_uuringud/harno_juhend_laagritele_ja_malevatele_vaimse_tervise_nouanded.pdf](<juhendid_ja_uuringud/harno_juhend_laagritele_ja_malevatele_vaimse_tervise_nouanded.pdf>) |
| Koolitöötajad jms toetav süsteemne lähenemine | [juhendid_ja_uuringud/harno_koolitootajad_jms_toetav_susteemne_lahenemine.pdf](<juhendid_ja_uuringud/harno_koolitootajad_jms_toetav_susteemne_lahenemine.pdf>) |
| Kutseõppeasutuste veebilehtede ja haridusinfoportaali analüüs | [juhendid_ja_uuringud/harno_kutseoppeasutuste_veebilehtede_ja_haridusinfoportaali_analuu.pdf](<juhendid_ja_uuringud/harno_kutseoppeasutuste_veebilehtede_ja_haridusinfoportaali_analuu.pdf>) |
| Õpilase individuaalsuse arvestamine võimetekohase õppe tagamisel | [juhendid_ja_uuringud/harno_opilase_individuaalsuse_arvestamine_voimetekohase_oppe_tagam.pdf](<juhendid_ja_uuringud/harno_opilase_individuaalsuse_arvestamine_voimetekohase_oppe_tagam.pdf>) |
| Õpilase toetamine koolis (varasem versioon) | [juhendid_ja_uuringud/harno_opilase_toetamine_koolis_varasem_versioon.pdf](<juhendid_ja_uuringud/harno_opilase_toetamine_koolis_varasem_versioon.pdf>) |
| Õppekeelest erineva emakeelega õpilane koolis | [juhendid_ja_uuringud/harno_oppekeelest_erineva_emakeelega_opilane_koolis.pdf](<juhendid_ja_uuringud/harno_oppekeelest_erineva_emakeelega_opilane_koolis.pdf>) |
| Soovitused kiusamise vältimiseks koolis | [juhendid_ja_uuringud/harno_soovitused_kiusamise_valtimiseks_koolis.pdf](<juhendid_ja_uuringud/harno_soovitused_kiusamise_valtimiseks_koolis.pdf>) |
| Lapse osalemise põhimõtted | [juhendid_ja_uuringud/lastekaitse_liit_lapse_osalemise_pohimotted.pdf](<juhendid_ja_uuringud/lastekaitse_liit_lapse_osalemise_pohimotted.pdf>) |
| Lapse osalusõiguse rakendamise juhend | [juhendid_ja_uuringud/lastekaitse_liit_lapse_osalusoiguse_rakendamise_juhend.pdf](<juhendid_ja_uuringud/lastekaitse_liit_lapse_osalusoiguse_rakendamise_juhend.pdf>) |
| “Mina olen enda oma” juhendmaterjal õpetajale ja lapsevanemale | [juhendid_ja_uuringud/lastekaitse_liit_mina_olen_enda_oma_juhendmaterjal_opetajale_ja_lapsevanemale.pdf](<juhendid_ja_uuringud/lastekaitse_liit_mina_olen_enda_oma_juhendmaterjal_opetajale_ja_lapsevanemale.pdf>) |
| Mul on õigus 2025 | [juhendid_ja_uuringud/lastekaitse_liit_mul_on_oigus_2025.pdf](<juhendid_ja_uuringud/lastekaitse_liit_mul_on_oigus_2025.pdf>) |
| Uuring “Lapse heaolu hindamine” | [juhendid_ja_uuringud/lastekaitse_liit_uuring_lapse_heaolu_hindamine.pdf](<juhendid_ja_uuringud/lastekaitse_liit_uuring_lapse_heaolu_hindamine.pdf>) |
| 2025. aasta tegevuse ülevaade: puuetega inimeste õigused | [juhendid_ja_uuringud/oiguskantsler_2025_aasta_tegevuse_ulevaade_puuetega_inimeste_oigused.pdf](<juhendid_ja_uuringud/oiguskantsler_2025_aasta_tegevuse_ulevaade_puuetega_inimeste_oigused.pdf>) |
| Juhend: abivajavast lapsest teatamine ja andmekaitse | [juhendid_ja_uuringud/oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse.pdf](<juhendid_ja_uuringud/oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse.pdf>) |
| Lapse õigused | [juhendid_ja_uuringud/oiguskantsler_lapse_oigused.pdf](<juhendid_ja_uuringud/oiguskantsler_lapse_oigused.pdf>) |
| Puuetega inimeste õigused kriisis | [juhendid_ja_uuringud/oiguskantsler_puuetega_inimeste_oigused_kriisis.pdf](<juhendid_ja_uuringud/oiguskantsler_puuetega_inimeste_oigused_kriisis.pdf>) |
| Võrdne kohtlemine | [juhendid_ja_uuringud/oiguskantsler_vordne_kohtlemine.pdf](<juhendid_ja_uuringud/oiguskantsler_vordne_kohtlemine.pdf>) |
| OSKA sotsiaaltöö uuringu lühiversioon 2021 | [juhendid_ja_uuringud/oska_oska_sotsiaaltoo_uuringu_luhiversioon_2021.pdf](<juhendid_ja_uuringud/oska_oska_sotsiaaltoo_uuringu_luhiversioon_2021.pdf>) |
| OSKA sotsiaaltöö uuringu olulisemad tulemused | [juhendid_ja_uuringud/oska_oska_sotsiaaltoo_uuringu_olulisemad_tulemused.pdf](<juhendid_ja_uuringud/oska_oska_sotsiaaltoo_uuringu_olulisemad_tulemused.pdf>) |
| OSKA sotsiaaltöö uuringu terviktekst 2021 | [juhendid_ja_uuringud/oska_oska_sotsiaaltoo_uuringu_terviktekst_2021.pdf](<juhendid_ja_uuringud/oska_oska_sotsiaaltoo_uuringu_terviktekst_2021.pdf>) |
| Sotsiaaltöö seirearuanne 2025 | [juhendid_ja_uuringud/oska_sotsiaaltoo_seirearuanne_2025.pdf](<juhendid_ja_uuringud/oska_sotsiaaltoo_seirearuanne_2025.pdf>) |
| Ehituslike tuleohutusnõuete kokkuvõte | [juhendid_ja_uuringud/paasteamet_ehituslike_tuleohutusnouete_kokkuvote.pdf](<juhendid_ja_uuringud/paasteamet_ehituslike_tuleohutusnouete_kokkuvote.pdf>) |
| Enesekontrolli tuleohutusaruanne | [juhendid_ja_uuringud/paasteamet_enesekontrolli_tuleohutusaruanne.pdf](<juhendid_ja_uuringud/paasteamet_enesekontrolli_tuleohutusaruanne.pdf>) |
| Evakuatsioonijuhi koolitusmaterjal | [juhendid_ja_uuringud/paasteamet_evakuatsioonijuhi_koolitusmaterjal.pdf](<juhendid_ja_uuringud/paasteamet_evakuatsioonijuhi_koolitusmaterjal.pdf>) |
| Haiglate ja hooldekodude projekteerimise juhis | [juhendid_ja_uuringud/paasteamet_haiglate_ja_hooldekodude_projekteerimise_juhis.pdf](<juhendid_ja_uuringud/paasteamet_haiglate_ja_hooldekodude_projekteerimise_juhis.pdf>) |
| Juhendmaterjal praktilise väljaõppe läbiviimiseks haiglas ja hooldekodus | [juhendid_ja_uuringud/paasteamet_juhendmaterjal_praktilise_valjaoppe_labiviimiseks_haiglas_ja.pdf](<juhendid_ja_uuringud/paasteamet_juhendmaterjal_praktilise_valjaoppe_labiviimiseks_haiglas_ja.pdf>) |
| Päästeameti meelespea kohalikule omavalitsusele | [juhendid_ja_uuringud/paasteamet_paasteameti_meelespea_kohalikule_omavalitsusele.pdf](<juhendid_ja_uuringud/paasteamet_paasteameti_meelespea_kohalikule_omavalitsusele.pdf>) |
| Päästevõrgustiku strateegia aastani 2025 | [juhendid_ja_uuringud/paasteamet_paastevorgustiku_strateegia_aastani_2025.pdf](<juhendid_ja_uuringud/paasteamet_paastevorgustiku_strateegia_aastani_2025.pdf>) |
| Tuleohutuse infohommik: mida iga hoolekandeasutus peab teadma? | [juhendid_ja_uuringud/paasteamet_tuleohutuse_infohommik_mida_iga_hoolekandeasutus_peab_teadma.pdf](<juhendid_ja_uuringud/paasteamet_tuleohutuse_infohommik_mida_iga_hoolekandeasutus_peab_teadma.pdf>) |
| Tuleohutuskonsultandi koolitusmaterjal | [juhendid_ja_uuringud/paasteamet_tuleohutuskonsultandi_koolitusmaterjal.pdf](<juhendid_ja_uuringud/paasteamet_tuleohutuskonsultandi_koolitusmaterjal.pdf>) |
| Tuleohutuspaigaldised ja päästevahendid haiglates/hooldekodudes | [juhendid_ja_uuringud/paasteamet_tuleohutuspaigaldised_ja_paastevahendid_haiglates_hooldekodu.pdf](<juhendid_ja_uuringud/paasteamet_tuleohutuspaigaldised_ja_paastevahendid_haiglates_hooldekodu.pdf>) |
| Peaasi.ee Haridus | [juhendid_ja_uuringud/peaasi_ee_peaasi_ee_haridus.pdf](<juhendid_ja_uuringud/peaasi_ee_peaasi_ee_haridus.pdf>) |
| Stigma (8.–12. klass) | [juhendid_ja_uuringud/peaasi_ee_stigma_8_12_klass.pdf](<juhendid_ja_uuringud/peaasi_ee_stigma_8_12_klass.pdf>) |
| Vaimse tervise hoidmine (4.–7. klass) | [juhendid_ja_uuringud/peaasi_ee_vaimse_tervise_hoidmine_4_7_klass.pdf](<juhendid_ja_uuringud/peaasi_ee_vaimse_tervise_hoidmine_4_7_klass.pdf>) |
| Vaimse tervise hoidmine (8.–12. klass) | [juhendid_ja_uuringud/peaasi_ee_vaimse_tervise_hoidmine_8_12_klass.pdf](<juhendid_ja_uuringud/peaasi_ee_vaimse_tervise_hoidmine_8_12_klass.pdf>) |
| Räägime Lastest logiraamat tööks peredega: 0–1-aastane laps | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_tooks_peredega_0_1_aastane_laps.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_tooks_peredega_0_1_aastane_laps.pdf>) |
| Räägime Lastest logiraamat tööks peredega: 1–5-aastane laps | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_tooks_peredega_1_5_aastane_laps.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_tooks_peredega_1_5_aastane_laps.pdf>) |
| Räägime Lastest logiraamat tööks peredega: 5–12-aastane laps | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_tooks_peredega_5_12_aastane_laps.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_tooks_peredega_5_12_aastane_laps.pdf>) |
| Räägime Lastest logiraamat vanematele: 0–1-aastane laps | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_0_1_aastane_laps.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_0_1_aastane_laps.pdf>) |
| Räägime Lastest logiraamat vanematele: 12–18-aastane noor | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_12_18_aastane_noor.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_12_18_aastane_noor.pdf>) |
| Räägime Lastest logiraamat vanematele: 1–5-aastane laps | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_1_5_aastane_laps.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_1_5_aastane_laps.pdf>) |
| Räägime Lastest logiraamat vanematele: 5–12-aastane laps | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_5_12_aastane_laps.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_5_12_aastane_laps.pdf>) |
| Räägime Lastest logiraamat vanematele: lapseootel pere | [juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_lapseootel_pere.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_logiraamat_vanematele_lapseootel_pere.pdf>) |
| Räägime Lastest praktikutele: 12–18-aastaste lastega perede nõustamiseks | [juhendid_ja_uuringud/peaasi_raagime_lastest_praktikutele_12_18_aastaste_lastega_perede_n.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_praktikutele_12_18_aastaste_lastega_perede_n.pdf>) |
| Räägime Lastest praktikutele: 1–5-aastaste lastega perede nõustamiseks | [juhendid_ja_uuringud/peaasi_raagime_lastest_praktikutele_1_5_aastaste_lastega_perede_nou.pdf](<juhendid_ja_uuringud/peaasi_raagime_lastest_praktikutele_1_5_aastaste_lastega_perede_nou.pdf>) |
| Kohaliku omavalitsuse poolt isikult ja/või perekonnalt sotsiaalteenuste eest tasu nõudmine | [juhendid_ja_uuringud/praxis_centar_kohaliku_omavalitsuse_poolt_isikult_ja_voi_perekonnalt_sotsi.pdf](<juhendid_ja_uuringud/praxis_centar_kohaliku_omavalitsuse_poolt_isikult_ja_voi_perekonnalt_sotsi.pdf>) |
| Lapsendamise ja hooldusperre paigutamise järgne hindamine / lõpparuanne | [juhendid_ja_uuringud/praxis_centar_lapsendamise_ja_hooldusperre_paigutamise_jargne_hindamine_lo.pdf](<juhendid_ja_uuringud/praxis_centar_lapsendamise_ja_hooldusperre_paigutamise_jargne_hindamine_lo.pdf>) |
| Puudega lastega perede toimetuleku ja vajaduste uuring | [juhendid_ja_uuringud/praxis_centar_puudega_lastega_perede_toimetuleku_ja_vajaduste_uuring.pdf](<juhendid_ja_uuringud/praxis_centar_puudega_lastega_perede_toimetuleku_ja_vajaduste_uuring.pdf>) |
| Raviresistentse ja suitsiidse depressiooni levimus ning majanduslik mõju | [juhendid_ja_uuringud/praxis_centar_raviresistentse_ja_suitsiidse_depressiooni_levimus_ning_maja.pdf](<juhendid_ja_uuringud/praxis_centar_raviresistentse_ja_suitsiidse_depressiooni_levimus_ning_maja.pdf>) |
| SKA ja KOVid – lõppraport | [juhendid_ja_uuringud/praxis_centar_ska_ja_kovid_loppraport.pdf](<juhendid_ja_uuringud/praxis_centar_ska_ja_kovid_loppraport.pdf>) |
| Sotsiaalne innovatsioon pikaajalises hoolduses | [juhendid_ja_uuringud/praxis_centar_sotsiaalne_innovatsioon_pikaajalises_hoolduses.pdf](<juhendid_ja_uuringud/praxis_centar_sotsiaalne_innovatsioon_pikaajalises_hoolduses.pdf>) |
| Täiskasvanud erivajadusega inimeste abivajaduse hindamine ja teenuste osutamine | [juhendid_ja_uuringud/praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja.pdf](<juhendid_ja_uuringud/praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja.pdf>) |
| Täiskasvanud erivajadusega inimeste abivajaduse hindamine ja teenuste osutamine – lühikokkuvõte | [juhendid_ja_uuringud/praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja_2.pdf](<juhendid_ja_uuringud/praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja_2.pdf>) |
| Terviseseisundist või puudest tingitud erivajadustega noorte siirdumine koolist tööle | [juhendid_ja_uuringud/praxis_centar_terviseseisundist_voi_puudest_tingitud_erivajadustega_noorte.pdf](<juhendid_ja_uuringud/praxis_centar_terviseseisundist_voi_puudest_tingitud_erivajadustega_noorte.pdf>) |
| Töövõime toetamise süsteemi loomise ja juurutamise makromajandusliku mõju hindamine – metoodikaraport | [juhendid_ja_uuringud/praxis_centar_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja.pdf](<juhendid_ja_uuringud/praxis_centar_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja.pdf>) |
| Vanemaealiste ja eakate toimetuleku uuring 2015 | [juhendid_ja_uuringud/praxis_centar_vanemaealiste_ja_eakate_toimetuleku_uuring_2015.pdf](<juhendid_ja_uuringud/praxis_centar_vanemaealiste_ja_eakate_toimetuleku_uuring_2015.pdf>) |
| Haridusliku erivajadusega noorte kutseõpingute ja tööturule jõudmise toetamine | [juhendid_ja_uuringud/riigikontroll_haridusliku_erivajadusega_noorte_kutseopingute_ja_tooturule_.pdf](<juhendid_ja_uuringud/riigikontroll_haridusliku_erivajadusega_noorte_kutseopingute_ja_tooturule_.pdf>) |
| Koduteenuste korraldus | [juhendid_ja_uuringud/riigikontroll_koduteenuste_korraldus.pdf](<juhendid_ja_uuringud/riigikontroll_koduteenuste_korraldus.pdf>) |
| Omavalitsuste tegevus erivajadustega inimeste toetamisel | [juhendid_ja_uuringud/riigikontroll_omavalitsuste_tegevus_erivajadustega_inimeste_toetamisel.pdf](<juhendid_ja_uuringud/riigikontroll_omavalitsuste_tegevus_erivajadustega_inimeste_toetamisel.pdf>) |
| Toimetulekutoetuse kui riikliku sotsiaalabi korraldus | [juhendid_ja_uuringud/riigikontroll_toimetulekutoetuse_kui_riikliku_sotsiaalabi_korraldus.pdf](<juhendid_ja_uuringud/riigikontroll_toimetulekutoetuse_kui_riikliku_sotsiaalabi_korraldus.pdf>) |
| Töövõime vähenemise ennetamine | [juhendid_ja_uuringud/riigikontroll_toovoime_vahenemise_ennetamine.pdf](<juhendid_ja_uuringud/riigikontroll_toovoime_vahenemise_ennetamine.pdf>) |
| Ülevaade erihoolekandeteenuste kättesaadavusest | [juhendid_ja_uuringud/riigikontroll_ulevaade_erihoolekandeteenuste_kattesaadavusest.pdf](<juhendid_ja_uuringud/riigikontroll_ulevaade_erihoolekandeteenuste_kattesaadavusest.pdf>) |
| Abivahendite teatmik 2025 | [juhendid_ja_uuringud/sotsiaalkindlustusamet_abivahendite_teatmik_2025.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_abivahendite_teatmik_2025.pdf>) |
| Eesti elanikkonna teadlikkuse uuring soopõhise vägivalla ja inimkaubanduse valdkonnas | [juhendid_ja_uuringud/sotsiaalkindlustusamet_eesti_elanikkonna_teadlikkuse_uuring_soopohise_vagivalla_ja_.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_eesti_elanikkonna_teadlikkuse_uuring_soopohise_vagivalla_ja_.pdf>) |
| Elanikkonna hoiakud ja teadlikkus perevägivallast | [juhendid_ja_uuringud/sotsiaalkindlustusamet_elanikkonna_hoiakud_ja_teadlikkus_perevagivallast.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_elanikkonna_hoiakud_ja_teadlikkus_perevagivallast.pdf>) |
| Evaluation of the impact of the MARAC networking model | [juhendid_ja_uuringud/sotsiaalkindlustusamet_evaluation_of_the_impact_of_the_marac_networking_model.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_evaluation_of_the_impact_of_the_marac_networking_model.pdf>) |
| Hoolekandeteenuste kvaliteedi juhendmaterjal | [juhendid_ja_uuringud/sotsiaalkindlustusamet_hoolekandeteenuste_kvaliteedi_juhendmaterjal.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_hoolekandeteenuste_kvaliteedi_juhendmaterjal.pdf>) |
| Juhendmaterjal kübervägivallast ohvritega töötavatele spetsialistidele | [juhendid_ja_uuringud/sotsiaalkindlustusamet_juhendmaterjal_kubervagivallast_ohvritega_tootavatele_spetsi.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_juhendmaterjal_kubervagivallast_ohvritega_tootavatele_spetsi.pdf>) |
| Lapse heaolu hindamise käsiraamat | [juhendid_ja_uuringud/sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat.pdf>) |
| MARAC-i juhendmaterjal | [juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_juhendmaterjal.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_juhendmaterjal.pdf>) |
| MARAC-i mudeli juhend KOV lastekaitsele | [juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_mudeli_juhend_kov_lastekaitsele.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_mudeli_juhend_kov_lastekaitsele.pdf>) |
| MARAC-i teavitusleht | [juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_teavitusleht.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_teavitusleht.pdf>) |
| MARAC-i võrgustiku mudeli mõju hindamine. Lõppraport | [juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_vorgustiku_mudeli_moju_hindamine_loppraport.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_marac_i_vorgustiku_mudeli_moju_hindamine_loppraport.pdf>) |
| Naiste tugikeskuse teenuse kvaliteedijuhis | [juhendid_ja_uuringud/sotsiaalkindlustusamet_naiste_tugikeskuse_teenuse_kvaliteedijuhis.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_naiste_tugikeskuse_teenuse_kvaliteedijuhis.pdf>) |
| Naiste tugikeskuste 2021. aasta kogemusuuringu aruanne | [juhendid_ja_uuringud/sotsiaalkindlustusamet_naiste_tugikeskuste_2021_aasta_kogemusuuringu_aruanne.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_naiste_tugikeskuste_2021_aasta_kogemusuuringu_aruanne.pdf>) |
| Perevägivalla toimepanijatele suunatud programmide Euroopa standardid | [juhendid_ja_uuringud/sotsiaalkindlustusamet_perevagivalla_toimepanijatele_suunatud_programmide_euroopa_s.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_perevagivalla_toimepanijatele_suunatud_programmide_euroopa_s.pdf>) |
| sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025 | [juhendid_ja_uuringud/sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025.pdf>) |
| Rehabilitatsiooni teenuseosutajate infopäeva materjal | [juhendid_ja_uuringud/sotsiaalkindlustusamet_rehabilitatsiooni_teenuseosutajate_infopaeva_materjal.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_rehabilitatsiooni_teenuseosutajate_infopaeva_materjal.pdf>) |
| Riskihindamine lähisuhtevägivalla juhtumites – tervishoiutöötajatele | [juhendid_ja_uuringud/sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota.pdf>) |
| sotsiaalkindlustusamet_rus | [juhendid_ja_uuringud/sotsiaalkindlustusamet_rus.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_rus.pdf>) |
| sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin | [juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin.pdf>) |
| sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend | [juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend.pdf>) |
| sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng | [juhendid_ja_uuringud/sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng.pdf>) |
| Teadlikkus tugiteenuste olemasolust pere- ja seksuaalvägivalla ning inimkaubanduse ohvritele | [juhendid_ja_uuringud/sotsiaalkindlustusamet_teadlikkus_tugiteenuste_olemasolust_pere_ja_seksuaalvagivall.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_teadlikkus_tugiteenuste_olemasolust_pere_ja_seksuaalvagivall.pdf>) |
| sotsiaalkindlustusamet_ua | [juhendid_ja_uuringud/sotsiaalkindlustusamet_ua.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_ua.pdf>) |
| Inimkaubanduse ennetamine: metodoloogia tööks noortega | [juhendid_ja_uuringud/sotsiaalministeerium_inimkaubanduse_ennetamine_metodoloogia_tooks_noortega.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_inimkaubanduse_ennetamine_metodoloogia_tooks_noortega.pdf>) |
| Inimkaubanduse teemal koolitamine: praktilised soovitused | [juhendid_ja_uuringud/sotsiaalministeerium_inimkaubanduse_teemal_koolitamine_praktilised_soovitused.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_inimkaubanduse_teemal_koolitamine_praktilised_soovitused.pdf>) |
| Ligipääsetavuse kulu-tulu analüüs. Lõpparuanne | [juhendid_ja_uuringud/sotsiaalministeerium_ligipaasetavuse_kulu_tulu_analuus_lopparuanne.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_ligipaasetavuse_kulu_tulu_analuus_lopparuanne.pdf>) |
| Puude-toetus ja lisa-toetus 2025. aastal | [juhendid_ja_uuringud/sotsiaalministeerium_puude_toetus_ja_lisa_toetus_2025_aastal.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_puude_toetus_ja_lisa_toetus_2025_aastal.pdf>) |
| Puuetega inimeste ja nende pereliikmete hoolduskoormuse uuring 2009 | [juhendid_ja_uuringud/sotsiaalministeerium_puuetega_inimeste_ja_nende_pereliikmete_hoolduskoormuse_uuri.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_puuetega_inimeste_ja_nende_pereliikmete_hoolduskoormuse_uuri.pdf>) |
| Puuetega inimeste töötamist toetavad meetmed | [juhendid_ja_uuringud/sotsiaalministeerium_puuetega_inimeste_tootamist_toetavad_meetmed.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_puuetega_inimeste_tootamist_toetavad_meetmed.pdf>) |
| Seksuaalvägivalla levimus ja hoiakud Eestis | [juhendid_ja_uuringud/sotsiaalministeerium_seksuaalvagivalla_levimus_ja_hoiakud_eestis.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_seksuaalvagivalla_levimus_ja_hoiakud_eestis.pdf>) |
| Soolise võrdõiguslikkuse monitooring 2021: Lähisuhtevägivald | [juhendid_ja_uuringud/sotsiaalministeerium_soolise_vordoiguslikkuse_monitooring_2021_lahisuhtevagivald.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_soolise_vordoiguslikkuse_monitooring_2021_lahisuhtevagivald.pdf>) |
| Sotsiaalhoolekande programm 2024–2027 | [juhendid_ja_uuringud/sotsiaalministeerium_sotsiaalhoolekande_programm_2024_2027.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_sotsiaalhoolekande_programm_2024_2027.pdf>) |
| Transpordi ja tehiskeskkonna ligipääsetavuse analüüs | [juhendid_ja_uuringud/sotsiaalministeerium_transpordi_ja_tehiskeskkonna_ligipaasetavuse_analuus.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_transpordi_ja_tehiskeskkonna_ligipaasetavuse_analuus.pdf>) |
| Uuring täisealiste puudega inimeste puude tuvastamise, abivajaduse hindamise ja toetamise süsteemist | [juhendid_ja_uuringud/sotsiaalministeerium_uuring_taisealiste_puudega_inimeste_puude_tuvastamise_abivaj.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_uuring_taisealiste_puudega_inimeste_puude_tuvastamise_abivaj.pdf>) |
| Vägivald ja naiste tervis | [juhendid_ja_uuringud/sotsiaalministeerium_vagivald_ja_naiste_tervis.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_vagivald_ja_naiste_tervis.pdf>) |
| Vägivald lähisuhtes: selle põhjused ja võimalikud lahendused | [juhendid_ja_uuringud/sotsiaalministeerium_vagivald_lahisuhtes_selle_pohjused_ja_voimalikud_lahendused.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_vagivald_lahisuhtes_selle_pohjused_ja_voimalikud_lahendused.pdf>) |
| Vägivalla mõju naiste tervisele | [juhendid_ja_uuringud/sotsiaalministeerium_vagivalla_moju_naiste_tervisele.pdf](<juhendid_ja_uuringud/sotsiaalministeerium_vagivalla_moju_naiste_tervisele.pdf>) |
| Eesti Statistika Kvartalikiri 2/2018 | [juhendid_ja_uuringud/statistikaamet_eesti_statistika_kvartalikiri_2_2018.pdf](<juhendid_ja_uuringud/statistikaamet_eesti_statistika_kvartalikiri_2_2018.pdf>) |
| Lapse heaolu mõõtmise käsitlus | [juhendid_ja_uuringud/statistikaamet_lapse_heaolu_mootmise_kasitlus.pdf](<juhendid_ja_uuringud/statistikaamet_lapse_heaolu_mootmise_kasitlus.pdf>) |
| Laste subjektiivne heaolu kohalikus ja rahvusvahelises vaates | [juhendid_ja_uuringud/statistikaamet_laste_subjektiivne_heaolu_kohalikus_ja_rahvusvahelises_vaate.pdf](<juhendid_ja_uuringud/statistikaamet_laste_subjektiivne_heaolu_kohalikus_ja_rahvusvahelises_vaate.pdf>) |
| Puudega inimeste sotsiaalne lõimumine | [juhendid_ja_uuringud/statistikaamet_puudega_inimeste_sotsiaalne_loimumine.pdf](<juhendid_ja_uuringud/statistikaamet_puudega_inimeste_sotsiaalne_loimumine.pdf>) |
| Sotsiaaltrendid 6 | [juhendid_ja_uuringud/statistikaamet_sotsiaaltrendid_6.pdf](<juhendid_ja_uuringud/statistikaamet_sotsiaaltrendid_6.pdf>) |
| Sotsiaaltrendid 7 | [juhendid_ja_uuringud/statistikaamet_sotsiaaltrendid_7.pdf](<juhendid_ja_uuringud/statistikaamet_sotsiaaltrendid_7.pdf>) |
| Vaesus Eestis | [juhendid_ja_uuringud/statistikaamet_vaesus_eestis.pdf](<juhendid_ja_uuringud/statistikaamet_vaesus_eestis.pdf>) |
| Eesti laste vaimse tervise uuring | [juhendid_ja_uuringud/tai_eesti_laste_vaimse_tervise_uuring.pdf](<juhendid_ja_uuringud/tai_eesti_laste_vaimse_tervise_uuring.pdf>) |
| Eesti täiskasvanud rahvastiku uimastite tarvitamise uuring 2023 | [juhendid_ja_uuringud/tai_eesti_taiskasvanud_rahvastiku_uimastite_tarvitamise_uuring_2.pdf](<juhendid_ja_uuringud/tai_eesti_taiskasvanud_rahvastiku_uimastite_tarvitamise_uuring_2.pdf>) |
| ESPAD 2024: uimastite tarvitamine koolinoorte seas | [juhendid_ja_uuringud/tai_espad_2024_uimastite_tarvitamine_koolinoorte_seas.pdf](<juhendid_ja_uuringud/tai_espad_2024_uimastite_tarvitamine_koolinoorte_seas.pdf>) |
| Narkootikumide tarvitamise olukord Eestis 2023 | [juhendid_ja_uuringud/tai_narkootikumide_tarvitamise_olukord_eestis_2023.pdf](<juhendid_ja_uuringud/tai_narkootikumide_tarvitamise_olukord_eestis_2023.pdf>) |
| TAI arengukava 2025–2028 | [juhendid_ja_uuringud/tai_tai_arengukava_2025_2028.pdf](<juhendid_ja_uuringud/tai_tai_arengukava_2025_2028.pdf>) |
| Infomaterjal beebivanematele kodu kohandamiseks lapse esimesel eluaastal | [juhendid_ja_uuringud/tarkvanem_infomaterjal_beebivanematele_kodu_kohandamiseks_lapse_esimes.pdf](<juhendid_ja_uuringud/tarkvanem_infomaterjal_beebivanematele_kodu_kohandamiseks_lapse_esimes.pdf>) |
| Kuidas märgata, et noor tarvitab e-sigaretti, nikotiinipatja või huuletubakat? | [juhendid_ja_uuringud/tarkvanem_kuidas_margata_et_noor_tarvitab_e_sigaretti_nikotiinipatja_v.pdf](<juhendid_ja_uuringud/tarkvanem_kuidas_margata_et_noor_tarvitab_e_sigaretti_nikotiinipatja_v.pdf>) |
| Sünnitusjärgne depressioon | [juhendid_ja_uuringud/tarkvanem_sunnitusjargne_depressioon.pdf](<juhendid_ja_uuringud/tarkvanem_sunnitusjargne_depressioon.pdf>) |
| TÖÖLEHT: Abiküsimused vestluseks lasteaialapsega | [juhendid_ja_uuringud/tarkvanem_tooleht_abikusimused_vestluseks_lasteaialapsega.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_abikusimused_vestluseks_lasteaialapsega.pdf>) |
| TÖÖLEHT: Abiküsimused vestluseks teismelisega | [juhendid_ja_uuringud/tarkvanem_tooleht_abikusimused_vestluseks_teismelisega.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_abikusimused_vestluseks_teismelisega.pdf>) |
| TÖÖLEHT: Kuidas anda lapsele korraldusi? | [juhendid_ja_uuringud/tarkvanem_tooleht_kuidas_anda_lapsele_korraldusi.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_kuidas_anda_lapsele_korraldusi.pdf>) |
| TÖÖLEHT: Kuidas sa ennast tunned? | [juhendid_ja_uuringud/tarkvanem_tooleht_kuidas_sa_ennast_tunned.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_kuidas_sa_ennast_tunned.pdf>) |
| TÖÖLEHT: Lapse tunnustamine | [juhendid_ja_uuringud/tarkvanem_tooleht_lapse_tunnustamine.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_lapse_tunnustamine.pdf>) |
| TÖÖLEHT: Märka ja tunnusta positiivset käitumist | [juhendid_ja_uuringud/tarkvanem_tooleht_marka_ja_tunnusta_positiivset_kaitumist.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_marka_ja_tunnusta_positiivset_kaitumist.pdf>) |
| tarkvanem_tooleht_rahunemispaus | [juhendid_ja_uuringud/tarkvanem_tooleht_rahunemispaus.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_rahunemispaus.pdf>) |
| TÖÖLEHT: Suhtekonto | [juhendid_ja_uuringud/tarkvanem_tooleht_suhtekonto.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_suhtekonto.pdf>) |
| TÖÖLEHT: Tugevate tunnetega toimetulek | [juhendid_ja_uuringud/tarkvanem_tooleht_tugevate_tunnetega_toimetulek.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_tugevate_tunnetega_toimetulek.pdf>) |
| Väikelastega perede koduohutuse hindamise ankeet kodukülastusi läbiviivale spetsialistile | [juhendid_ja_uuringud/tarkvanem_vaikelastega_perede_koduohutuse_hindamise_ankeet_kodukulastu.pdf](<juhendid_ja_uuringud/tarkvanem_vaikelastega_perede_koduohutuse_hindamise_ankeet_kodukulastu.pdf>) |
| Gripivastase vaktsineerimise läbiviimise juhend 2025 | [juhendid_ja_uuringud/terviseamet_gripivastase_vaktsineerimise_labiviimise_juhend_2025.pdf](<juhendid_ja_uuringud/terviseamet_gripivastase_vaktsineerimise_labiviimise_juhend_2025.pdf>) |
| terviseamet_hoolekandeasutuste_tegevusjuhis_covid_19_tingimustes | [juhendid_ja_uuringud/terviseamet_hoolekandeasutuste_tegevusjuhis_covid_19_tingimustes.pdf](<juhendid_ja_uuringud/terviseamet_hoolekandeasutuste_tegevusjuhis_covid_19_tingimustes.pdf>) |
| terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_j | [juhendid_ja_uuringud/terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_j.pdf](<juhendid_ja_uuringud/terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_j.pdf>) |
| terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_m | [juhendid_ja_uuringud/terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_m.pdf](<juhendid_ja_uuringud/terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_m.pdf>) |
| Kokkuvõte 2022. aasta kohta: haridus- ja sotsiaalasutuste tervisekaitse järelevalve | [juhendid_ja_uuringud/terviseamet_kokkuvote_2022_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi.pdf](<juhendid_ja_uuringud/terviseamet_kokkuvote_2022_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi.pdf>) |
| Kokkuvõte 2024. aasta kohta: haridus- ja sotsiaalasutuste tervisekaitse järelevalve | [juhendid_ja_uuringud/terviseamet_kokkuvote_2024_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi.pdf](<juhendid_ja_uuringud/terviseamet_kokkuvote_2024_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi.pdf>) |
| terviseamet_nakkushaiguste_ennetamise_ja_torjealane_tegevusjuhend_hoolde | [juhendid_ja_uuringud/terviseamet_nakkushaiguste_ennetamise_ja_torjealane_tegevusjuhend_hoolde.pdf](<juhendid_ja_uuringud/terviseamet_nakkushaiguste_ennetamise_ja_torjealane_tegevusjuhend_hoolde.pdf>) |
| Ärevushäire käsitlus esmatasandil – kliinilise auditi kokkuvõte | [juhendid_ja_uuringud/tervisekassa_arevushaire_kasitlus_esmatasandil_kliinilise_auditi_kokkuvot.pdf](<juhendid_ja_uuringud/tervisekassa_arevushaire_kasitlus_esmatasandil_kliinilise_auditi_kokkuvot.pdf>) |
| Esmatasandi tervishoiu arengumudel lähima 10 aasta perspektiivis | [juhendid_ja_uuringud/tervisekassa_esmatasandi_tervishoiu_arengumudel_lahima_10_aasta_perspekti.pdf](<juhendid_ja_uuringud/tervisekassa_esmatasandi_tervishoiu_arengumudel_lahima_10_aasta_perspekti.pdf>) |
| Pereõenduse tegevusjuhend | [juhendid_ja_uuringud/tervisekassa_pereoenduse_tegevusjuhend.pdf](<juhendid_ja_uuringud/tervisekassa_pereoenduse_tegevusjuhend.pdf>) |
| tervisekassa_pikk_covid_esmatasandil_kasitlusjuhend | [juhendid_ja_uuringud/tervisekassa_pikk_covid_esmatasandil_kasitlusjuhend.pdf](<juhendid_ja_uuringud/tervisekassa_pikk_covid_esmatasandil_kasitlusjuhend.pdf>) |
| tervisekassa_pikk_covid_patsiendijuhend | [juhendid_ja_uuringud/tervisekassa_pikk_covid_patsiendijuhend.pdf](<juhendid_ja_uuringud/tervisekassa_pikk_covid_patsiendijuhend.pdf>) |
| Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste? | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_kes_aitab_ja_kuhu_poorduda_kui_sul_on_tuvastatud_puude_rasku.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_kes_aitab_ja_kuhu_poorduda_kui_sul_on_tuvastatud_puude_rasku.pdf>) |
| Puude raskusastme tuvastamise ja töövõime hindamise taotlus – tööealine | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_puude_raskusastme_tuvastamise_ja_toovoime_hindamise_taotlus_.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_puude_raskusastme_tuvastamise_ja_toovoime_hindamise_taotlus_.pdf>) |
| STAR strateegia 2026–2030 | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_star_strateegia_2026_2030.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_star_strateegia_2026_2030.pdf>) |
| STAR strateegia tegevused 2026–2029 | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_star_strateegia_tegevused_2026_2029.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_star_strateegia_tegevused_2026_2029.pdf>) |
| Teadlikkus ja hoiakud vähenenud töövõimega inimeste ning töövõimereformi teemal | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_teadlikkus_ja_hoiakud_vahenenud_toovoimega_inimeste_ning_too.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_teadlikkus_ja_hoiakud_vahenenud_toovoimega_inimeste_ning_too.pdf>) |
| Tööandjate hoiakud vähenenud töövõimega inimeste töötamise suhtes | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_tooandjate_hoiakud_vahenenud_toovoimega_inimeste_tootamise_s.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_tooandjate_hoiakud_vahenenud_toovoimega_inimeste_tootamise_s.pdf>) |
| Töövõime toetamise skeemi loomise ja juurutamise vahehindamise lõpparuanne | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami.pdf>) |
| Töövõime toetamise skeemi loomise ja juurutamise vahehindamise infoleht | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami_2.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami_2.pdf>) |
| Töövõime toetamise süsteemi loomise ja juurutamise makromajandusliku mõju hindamine | [juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja.pdf](<juhendid_ja_uuringud/tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja.pdf>) |
| Arvamus töövõimetuslehe teemal | [juhendid_ja_uuringud/vordoigusvolinik_arvamus_toovoimetuslehe_teemal.pdf](<juhendid_ja_uuringud/vordoigusvolinik_arvamus_toovoimetuslehe_teemal.pdf>) |
| Juhendmaterjal karjäärispetsialistidele | [juhendid_ja_uuringud/vordoigusvolinik_juhendmaterjal_karjaarispetsialistidele.pdf](<juhendid_ja_uuringud/vordoigusvolinik_juhendmaterjal_karjaarispetsialistidele.pdf>) |
| Võin olla puudega – laste piltsõnastik puuetest | [juhendid_ja_uuringud/vordoigusvolinik_voin_olla_puudega_laste_piltsonastik_puuetest.pdf](<juhendid_ja_uuringud/vordoigusvolinik_voin_olla_puudega_laste_piltsonastik_puuetest.pdf>) |
| Voliniku poole pöördumiste statistika 2021 | [juhendid_ja_uuringud/vordoigusvolinik_voliniku_poole_poordumiste_statistika_2021.pdf](<juhendid_ja_uuringud/vordoigusvolinik_voliniku_poole_poordumiste_statistika_2021.pdf>) |
| Võrdõiguslikkus Eestis 2024 | [juhendid_ja_uuringud/vordoigusvolinik_vordoiguslikkus_eestis_2024.pdf](<juhendid_ja_uuringud/vordoigusvolinik_vordoiguslikkus_eestis_2024.pdf>) |
| Кризисные центры помощи жертвам сексуального насилия (RUS) | [juhendid_ja_uuringud/sotsiaalkindlustusamet_rus.ocr.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_rus.ocr.pdf>) |
| Seksuaaliväkivallan kriisikeskukset (FIN) | [juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin.ocr.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin.ocr.pdf>) |
| Seksuaalsest ahistamisest vaba ööelu juhend | [juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend.ocr.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend.ocr.pdf>) |
| Seksuaalvägivalla kriisiabikeskusi tutvustav voldik (EST) | [juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est.ocr.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est.ocr.pdf>) |
| Sexual Assault Crisis Centre (ENG) | [juhendid_ja_uuringud/sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng.ocr.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng.ocr.pdf>) |
| Кризові центри допомоги жертвам сексуального насильства (UA) | [juhendid_ja_uuringud/sotsiaalkindlustusamet_ua.ocr.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_ua.ocr.pdf>) |
| TÖÖLEHT: Rahunemispaus | [juhendid_ja_uuringud/tarkvanem_tooleht_rahunemispaus.ocr.pdf](<juhendid_ja_uuringud/tarkvanem_tooleht_rahunemispaus.ocr.pdf>) |
| Puue ja hoolekanne — SKA aastaraamatu PDF-osa 2025 | [juhendid_ja_uuringud/sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025-124cbc105c.pdf](<juhendid_ja_uuringud/sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025-124cbc105c.pdf>) |
| Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte | [juhendid_ja_uuringud/Taisealiste-psuuhikahairega-inimeste-sh-eestkostetavate-uuringu-kokkuvote-2026.pdf](<juhendid_ja_uuringud/Taisealiste-psuuhikahairega-inimeste-sh-eestkostetavate-uuringu-kokkuvote-2026.pdf>) |
| Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu lühikokkuvõte | [juhendid_ja_uuringud/Taisealiste-psuuhikahairega-inimeste-sh-eestkostetavate-uuringu-luhikokkuvote-2026-1.pdf](<juhendid_ja_uuringud/Taisealiste-psuuhikahairega-inimeste-sh-eestkostetavate-uuringu-luhikokkuvote-2026-1.pdf>) |
| Terviseprobleemiga laste ja nende perede toetamise hea tava | [juhendid_ja_uuringud/Terviseprobleemiga laste ja nende perede toetamise hea tava 12.122025_VEEB.pdf](<juhendid_ja_uuringud/Terviseprobleemiga laste ja nende perede toetamise hea tava 12.122025_VEEB.pdf>) |
| Alutaguse vald | [KOV/alutaguse-vald/alutaguse-vald.json](<KOV/alutaguse-vald/alutaguse-vald.json>) |
| Anija vald | [KOV/anija-vald/anija-vald.json](<KOV/anija-vald/anija-vald.json>) |
| Antsla vald | [KOV/antsla-vald/antsla-vald.json](<KOV/antsla-vald/antsla-vald.json>) |
| Elva vald | [KOV/elva-vald/elva-vald.json](<KOV/elva-vald/elva-vald.json>) |
| Häädemeeste vald | [KOV/haademeeste-vald/haademeeste-vald.json](<KOV/haademeeste-vald/haademeeste-vald.json>) |
| Haapsalu linn | [KOV/haapsalu-linn/haapsalu-linn.json](<KOV/haapsalu-linn/haapsalu-linn.json>) |
| Haljala vald | [KOV/haljala-vald/haljala-vald.json](<KOV/haljala-vald/haljala-vald.json>) |
| Harku vald | [KOV/harku-vald/harku-vald.json](<KOV/harku-vald/harku-vald.json>) |
| Hiiumaa vald | [KOV/hiiumaa-vald/hiiumaa-vald.json](<KOV/hiiumaa-vald/hiiumaa-vald.json>) |
| Järva vald | [KOV/jarva-vald/jarva-vald.json](<KOV/jarva-vald/jarva-vald.json>) |
| Jõelähtme vald | [KOV/joelahtme-vald/joelahtme-vald.json](<KOV/joelahtme-vald/joelahtme-vald.json>) |
| Jõgeva vald | [KOV/jogeva-vald/jogeva-vald.json](<KOV/jogeva-vald/jogeva-vald.json>) |
| Jõhvi vald | [KOV/johvi-vald/johvi-vald.json](<KOV/johvi-vald/johvi-vald.json>) |
| Kadrina vald | [KOV/kadrina-vald/kadrina-vald.json](<KOV/kadrina-vald/kadrina-vald.json>) |
| Kambja vald | [KOV/kambja-vald/kambja-vald.json](<KOV/kambja-vald/kambja-vald.json>) |
| Kanepi vald | [KOV/kanepi-vald/kanepi-vald.json](<KOV/kanepi-vald/kanepi-vald.json>) |
| Kastre vald | [KOV/kastre-vald/kastre-vald.json](<KOV/kastre-vald/kastre-vald.json>) |
| Kehtna vald | [KOV/kehtna-vald/kehtna-vald.json](<KOV/kehtna-vald/kehtna-vald.json>) |
| Keila linn | [KOV/keila-linn/keila-linn.json](<KOV/keila-linn/keila-linn.json>) |
| Kihnu vald | [KOV/kihnu-vald/kihnu-vald.json](<KOV/kihnu-vald/kihnu-vald.json>) |
| Kiili vald | [KOV/kiili-vald/kiili-vald.json](<KOV/kiili-vald/kiili-vald.json>) |
| Kohila vald | [KOV/kohila-vald/kohila-vald.json](<KOV/kohila-vald/kohila-vald.json>) |
| Kohtla-Järve linn | [KOV/kohtla-jarve-linn/kohtla-jarve-linn.json](<KOV/kohtla-jarve-linn/kohtla-jarve-linn.json>) |
| Kose vald | [KOV/kose-vald/kose-vald.json](<KOV/kose-vald/kose-vald.json>) |
| kov_kontaktid_loplik.json | [kontaktid/kov_kontaktid_loplik.json](<kontaktid/kov_kontaktid_loplik.json>) |
| Kuusalu vald | [KOV/kuusalu-vald/kuusalu-vald.json](<KOV/kuusalu-vald/kuusalu-vald.json>) |
| Lääne-Harju vald | [KOV/laane-harju-vald/laane-harju-vald.json](<KOV/laane-harju-vald/laane-harju-vald.json>) |
| Lääne-Nigula vald | [KOV/laane-nigula-vald/laane-nigula-vald.json](<KOV/laane-nigula-vald/laane-nigula-vald.json>) |
| Lääneranna vald | [KOV/laaneranna-vald/laaneranna-vald.json](<KOV/laaneranna-vald/laaneranna-vald.json>) |
| Loksa linn | [KOV/loksa-linn/loksa-linn.json](<KOV/loksa-linn/loksa-linn.json>) |
| haabersti_kontaktid_koond.json | [kontaktid/LOV/haabersti_kontaktid_koond.json](<kontaktid/LOV/haabersti_kontaktid_koond.json>) |
| kesklinn_kontaktid_koond.json | [kontaktid/LOV/kesklinn_kontaktid_koond.json](<kontaktid/LOV/kesklinn_kontaktid_koond.json>) |
| kristiine_kontaktid_koond.json | [kontaktid/LOV/kristiine_kontaktid_koond.json](<kontaktid/LOV/kristiine_kontaktid_koond.json>) |
| lasnamae_kontaktid_koond.json | [kontaktid/LOV/lasnamae_kontaktid_koond.json](<kontaktid/LOV/lasnamae_kontaktid_koond.json>) |
| mustamae_kontaktid_koond.json | [kontaktid/LOV/mustamae_kontaktid_koond.json](<kontaktid/LOV/mustamae_kontaktid_koond.json>) |
| nomme_kontaktid_koond.json | [kontaktid/LOV/nomme_kontaktid_koond.json](<kontaktid/LOV/nomme_kontaktid_koond.json>) |
| pirita_kontaktid_koond.json | [kontaktid/LOV/pirita_kontaktid_koond.json](<kontaktid/LOV/pirita_kontaktid_koond.json>) |
| pohja_tallinn_kontaktid_koond.json | [kontaktid/LOV/pohja_tallinn_kontaktid_koond.json](<kontaktid/LOV/pohja_tallinn_kontaktid_koond.json>) |
| Lüganuse vald | [KOV/luganuse-vald/luganuse-vald.json](<KOV/luganuse-vald/luganuse-vald.json>) |
| Luunja vald | [KOV/luunja-vald/luunja-vald.json](<KOV/luunja-vald/luunja-vald.json>) |
| Maardu linn | [KOV/maardu-linn/maardu-linn.json](<KOV/maardu-linn/maardu-linn.json>) |
| Märjamaa vald | [KOV/marjamaa-vald/marjamaa-vald.json](<KOV/marjamaa-vald/marjamaa-vald.json>) |
| Muhu vald | [KOV/muhu-vald/muhu-vald.json](<KOV/muhu-vald/muhu-vald.json>) |
| Mulgi vald | [KOV/mulgi-vald/mulgi-vald.json](<KOV/mulgi-vald/mulgi-vald.json>) |
| Mustvee vald | [KOV/mustvee-vald/mustvee-vald.json](<KOV/mustvee-vald/mustvee-vald.json>) |
| Narva-Jõesuu linn | [KOV/narva-joesuu-linn/narva-joesuu-linn.json](<KOV/narva-joesuu-linn/narva-joesuu-linn.json>) |
| Narva linn | [KOV/narva-linn/narva-linn.json](<KOV/narva-linn/narva-linn.json>) |
| Nõo vald | [KOV/noo-vald/noo-vald.json](<KOV/noo-vald/noo-vald.json>) |
| Otepää vald | [KOV/otepaa-vald/otepaa-vald.json](<KOV/otepaa-vald/otepaa-vald.json>) |
| Paide linn | [KOV/paide-linn/paide-linn.json](<KOV/paide-linn/paide-linn.json>) |
| Pärnu linn | [KOV/parnu-linn/parnu-linn.json](<KOV/parnu-linn/parnu-linn.json>) |
| Peipsiääre vald | [KOV/peipsiaare-vald/peipsiaare-vald.json](<KOV/peipsiaare-vald/peipsiaare-vald.json>) |
| Põhja-Pärnumaa vald | [KOV/pohja-parnumaa-vald/pohja-parnumaa-vald.json](<KOV/pohja-parnumaa-vald/pohja-parnumaa-vald.json>) |
| Põhja-Sakala vald | [KOV/pohja-sakala-vald/pohja-sakala-vald.json](<KOV/pohja-sakala-vald/pohja-sakala-vald.json>) |
| Põltsamaa vald | [KOV/poltsamaa-vald/poltsamaa-vald.json](<KOV/poltsamaa-vald/poltsamaa-vald.json>) |
| Põlva vald | [KOV/polva-vald/polva-vald.json](<KOV/polva-vald/polva-vald.json>) |
| Raasiku vald | [KOV/raasiku-vald/raasiku-vald.json](<KOV/raasiku-vald/raasiku-vald.json>) |
| Rae vald | [KOV/rae-vald/rae-vald.json](<KOV/rae-vald/rae-vald.json>) |
| Rakvere linn | [KOV/rakvere-linn/rakvere-linn.json](<KOV/rakvere-linn/rakvere-linn.json>) |
| Rakvere vald | [KOV/rakvere-vald/rakvere-vald.json](<KOV/rakvere-vald/rakvere-vald.json>) |
| Räpina vald | [KOV/rapina-vald/rapina-vald.json](<KOV/rapina-vald/rapina-vald.json>) |
| Rapla vald | [KOV/rapla-vald/rapla-vald.json](<KOV/rapla-vald/rapla-vald.json>) |
| Rõuge vald | [KOV/rouge-vald/rouge-vald.json](<KOV/rouge-vald/rouge-vald.json>) |
| Ruhnu vald | [KOV/ruhnu-vald/ruhnu-vald.json](<KOV/ruhnu-vald/ruhnu-vald.json>) |
| Saarde vald | [KOV/saarde-vald/saarde-vald.json](<KOV/saarde-vald/saarde-vald.json>) |
| Saaremaa vald | [KOV/saaremaa-vald/saaremaa-vald.json](<KOV/saaremaa-vald/saaremaa-vald.json>) |
| Saku vald | [KOV/saku-vald/saku-vald.json](<KOV/saku-vald/saku-vald.json>) |
| Saue vald | [KOV/saue-vald/saue-vald.json](<KOV/saue-vald/saue-vald.json>) |
| Setomaa vald | [KOV/setomaa-vald/setomaa-vald.json](<KOV/setomaa-vald/setomaa-vald.json>) |
| Sillamäe linn | [KOV/sillamae-linn/sillamae-linn.json](<KOV/sillamae-linn/sillamae-linn.json>) |
| Tallinna linn | [KOV/tallinn/tallinn.json](<KOV/tallinn/tallinn.json>) |
| Tapa vald | [KOV/tapa-vald/tapa-vald.json](<KOV/tapa-vald/tapa-vald.json>) |
| Tartu linn | [KOV/tartu-linn/tartu-linn.json](<KOV/tartu-linn/tartu-linn.json>) |
| Tartu vald | [KOV/tartu-vald/tartu-vald.json](<KOV/tartu-vald/tartu-vald.json>) |
| Tori vald | [KOV/tori-vald/tori-vald.json](<KOV/tori-vald/tori-vald.json>) |
| Tõrva vald | [KOV/torva-vald/torva-vald.json](<KOV/torva-vald/torva-vald.json>) |
| Türi vald | [KOV/turi-vald/turi-vald.json](<KOV/turi-vald/turi-vald.json>) |
| Väike-Maarja vald | [KOV/vaike-maarja-vald/vaike-maarja-vald.json](<KOV/vaike-maarja-vald/vaike-maarja-vald.json>) |
| Valga vald | [KOV/valga-vald/valga-vald.json](<KOV/valga-vald/valga-vald.json>) |
| Viimsi vald | [KOV/viimsi-vald/viimsi-vald.json](<KOV/viimsi-vald/viimsi-vald.json>) |
| Viljandi linn | [KOV/viljandi-linn/viljandi-linn.json](<KOV/viljandi-linn/viljandi-linn.json>) |
| Viljandi vald | [KOV/viljandi-vald/viljandi-vald.json](<KOV/viljandi-vald/viljandi-vald.json>) |
| Vinni vald | [KOV/vinni-vald/vinni-vald.json](<KOV/vinni-vald/vinni-vald.json>) |
| Viru-Nigula vald | [KOV/viru-nigula-vald/viru-nigula-vald.json](<KOV/viru-nigula-vald/viru-nigula-vald.json>) |
| Vormsi vald | [KOV/vormsi-vald/vormsi-vald.json](<KOV/vormsi-vald/vormsi-vald.json>) |
| Võru linn | [KOV/voru-linn/voru-linn.json](<KOV/voru-linn/voru-linn.json>) |
| Võru vald | [KOV/voru-vald/voru-vald.json](<KOV/voru-vald/voru-vald.json>) |
| astangu.json | [organisatsioonid/astangu.json](<organisatsioonid/astangu.json>) |
| 401112019012.xml | [oigusaktid/401112019012.xml](<oigusaktid/401112019012.xml>) |
| 402022024018.xml | [oigusaktid/402022024018.xml](<oigusaktid/402022024018.xml>) |
| 402062023117.xml | [oigusaktid/402062023117.xml](<oigusaktid/402062023117.xml>) |
| 403042024076.xml | [oigusaktid/403042024076.xml](<oigusaktid/403042024076.xml>) |
| 403042025006.xml | [oigusaktid/403042025006.xml](<oigusaktid/403042025006.xml>) |
| 403042025040.xml | [oigusaktid/403042025040.xml](<oigusaktid/403042025040.xml>) |
| 403042025042.xml | [oigusaktid/403042025042.xml](<oigusaktid/403042025042.xml>) |
| 403052025002.xml | [oigusaktid/403052025002.xml](<oigusaktid/403052025002.xml>) |
| 403102019005.xml | [oigusaktid/403102019005.xml](<oigusaktid/403102019005.xml>) |
| 404022026032.xml | [oigusaktid/404022026032.xml](<oigusaktid/404022026032.xml>) |
| 404052016003.xml | [oigusaktid/404052016003.xml](<oigusaktid/404052016003.xml>) |
| 404072025017.xml | [oigusaktid/404072025017.xml](<oigusaktid/404072025017.xml>) |
| 404122020026.xml | [oigusaktid/404122020026.xml](<oigusaktid/404122020026.xml>) |
| 405022022004.xml | [oigusaktid/405022022004.xml](<oigusaktid/405022022004.xml>) |
| 405042018002.xml | [oigusaktid/405042018002.xml](<oigusaktid/405042018002.xml>) |
| 405042024007.xml | [oigusaktid/405042024007.xml](<oigusaktid/405042024007.xml>) |
| 405042025014.xml | [oigusaktid/405042025014.xml](<oigusaktid/405042025014.xml>) |
| 405042025021.xml | [oigusaktid/405042025021.xml](<oigusaktid/405042025021.xml>) |
| 406022025035.xml | [oigusaktid/406022025035.xml](<oigusaktid/406022025035.xml>) |
| 406022026039.xml | [oigusaktid/406022026039.xml](<oigusaktid/406022026039.xml>) |
| 406032025001.xml | [oigusaktid/406032025001.xml](<oigusaktid/406032025001.xml>) |
| 406062023011.xml | [oigusaktid/406062023011.xml](<oigusaktid/406062023011.xml>) |
| 406062023041.xml | [oigusaktid/406062023041.xml](<oigusaktid/406062023041.xml>) |
| 406102021036.xml | [oigusaktid/406102021036.xml](<oigusaktid/406102021036.xml>) |
| 406112024020.xml | [oigusaktid/406112024020.xml](<oigusaktid/406112024020.xml>) |
| 406122024017.xml | [oigusaktid/406122024017.xml](<oigusaktid/406122024017.xml>) |
| 407012022005.xml | [oigusaktid/407012022005.xml](<oigusaktid/407012022005.xml>) |
| 407032025024.xml | [oigusaktid/407032025024.xml](<oigusaktid/407032025024.xml>) |
| 407042026033.xml | [oigusaktid/407042026033.xml](<oigusaktid/407042026033.xml>) |
| 407052021021.xml | [oigusaktid/407052021021.xml](<oigusaktid/407052021021.xml>) |
| 409052018051.xml | [oigusaktid/409052018051.xml](<oigusaktid/409052018051.xml>) |
| 410032026002.xml | [oigusaktid/410032026002.xml](<oigusaktid/410032026002.xml>) |
| 410042018010.xml | [oigusaktid/410042018010.xml](<oigusaktid/410042018010.xml>) |
| 410042021014.xml | [oigusaktid/410042021014.xml](<oigusaktid/410042021014.xml>) |
| 411042018011.xml | [oigusaktid/411042018011.xml](<oigusaktid/411042018011.xml>) |
| 411102025024.xml | [oigusaktid/411102025024.xml](<oigusaktid/411102025024.xml>) |
| 412042025007.xml | [oigusaktid/412042025007.xml](<oigusaktid/412042025007.xml>) |
| 412062018006.xml | [oigusaktid/412062018006.xml](<oigusaktid/412062018006.xml>) |
| 412092023017.xml | [oigusaktid/412092023017.xml](<oigusaktid/412092023017.xml>) |
| 412122024021.xml | [oigusaktid/412122024021.xml](<oigusaktid/412122024021.xml>) |
| 416022022003.xml | [oigusaktid/416022022003.xml](<oigusaktid/416022022003.xml>) |
| 417072025017.xml | [oigusaktid/417072025017.xml](<oigusaktid/417072025017.xml>) |
| 417092025023.xml | [oigusaktid/417092025023.xml](<oigusaktid/417092025023.xml>) |
| 417092025025.xml | [oigusaktid/417092025025.xml](<oigusaktid/417092025025.xml>) |
| 418032026007.xml | [oigusaktid/418032026007.xml](<oigusaktid/418032026007.xml>) |
| 418112020001.xml | [oigusaktid/418112020001.xml](<oigusaktid/418112020001.xml>) |
| 418122021013.xml | [oigusaktid/418122021013.xml](<oigusaktid/418122021013.xml>) |
| 419052023006.xml | [oigusaktid/419052023006.xml](<oigusaktid/419052023006.xml>) |
| 420112024006.xml | [oigusaktid/420112024006.xml](<oigusaktid/420112024006.xml>) |
| 421062023039.xml | [oigusaktid/421062023039.xml](<oigusaktid/421062023039.xml>) |
| 422032022006.xml | [oigusaktid/422032022006.xml](<oigusaktid/422032022006.xml>) |
| 423012026003.xml | [oigusaktid/423012026003.xml](<oigusaktid/423012026003.xml>) |
| 423052025002.xml | [oigusaktid/423052025002.xml](<oigusaktid/423052025002.xml>) |
| 423112023018.xml | [oigusaktid/423112023018.xml](<oigusaktid/423112023018.xml>) |
| 423122025040.xml | [oigusaktid/423122025040.xml](<oigusaktid/423122025040.xml>) |
| 424042026003.xml | [oigusaktid/424042026003.xml](<oigusaktid/424042026003.xml>) |
| 425032026040.xml | [oigusaktid/425032026040.xml](<oigusaktid/425032026040.xml>) |
| 425032026041.xml | [oigusaktid/425032026041.xml](<oigusaktid/425032026041.xml>) |
| 425042025025.xml | [oigusaktid/425042025025.xml](<oigusaktid/425042025025.xml>) |
| 425092025018.xml | [oigusaktid/425092025018.xml](<oigusaktid/425092025018.xml>) |
| 426032025019.xml | [oigusaktid/426032025019.xml](<oigusaktid/426032025019.xml>) |
| 426052023059.xml | [oigusaktid/426052023059.xml](<oigusaktid/426052023059.xml>) |
| 428042022001.xml | [oigusaktid/428042022001.xml](<oigusaktid/428042022001.xml>) |
| 428062025051.xml | [oigusaktid/428062025051.xml](<oigusaktid/428062025051.xml>) |
| 428102025016.xml | [oigusaktid/428102025016.xml](<oigusaktid/428102025016.xml>) |
| 428122024013.xml | [oigusaktid/428122024013.xml](<oigusaktid/428122024013.xml>) |
| 428122024131.xml | [oigusaktid/428122024131.xml](<oigusaktid/428122024131.xml>) |
| 429032018015.xml | [oigusaktid/429032018015.xml](<oigusaktid/429032018015.xml>) |
| 429032025041.xml | [oigusaktid/429032025041.xml](<oigusaktid/429032025041.xml>) |
| 429052024010.xml | [oigusaktid/429052024010.xml](<oigusaktid/429052024010.xml>) |
| 429082017013.xml | [oigusaktid/429082017013.xml](<oigusaktid/429082017013.xml>) |
| 429122020017.xml | [oigusaktid/429122020017.xml](<oigusaktid/429122020017.xml>) |
| 429122022021.xml | [oigusaktid/429122022021.xml](<oigusaktid/429122022021.xml>) |
| 430042025039.xml | [oigusaktid/430042025039.xml](<oigusaktid/430042025039.xml>) |
| 431052025006.xml | [oigusaktid/431052025006.xml](<oigusaktid/431052025006.xml>) |
| 431082024012.xml | [oigusaktid/431082024012.xml](<oigusaktid/431082024012.xml>) |
| 431122019067.xml | [oigusaktid/431122019067.xml](<oigusaktid/431122019067.xml>) |
| 431122024038.xml | [oigusaktid/431122024038.xml](<oigusaktid/431122024038.xml>) |
| 431122025034.xml | [oigusaktid/431122025034.xml](<oigusaktid/431122025034.xml>) |
| 107052025017.xml | [oigusaktid/107052025017.xml](<oigusaktid/107052025017.xml>) |
| 109042026003.xml | [oigusaktid/109042026003.xml](<oigusaktid/109042026003.xml>) |
| 129082025009.xml | [oigusaktid/129082025009.xml](<oigusaktid/129082025009.xml>) |
| 130122025036.xml | [oigusaktid/130122025036.xml](<oigusaktid/130122025036.xml>) |
| 131122024023.xml | [oigusaktid/131122024023.xml](<oigusaktid/131122024023.xml>) |
| 103062026023.xml | [oigusaktid/103062026023.xml](<oigusaktid/103062026023.xml>) |
| 111072026120.xml | [oigusaktid/111072026120.xml](<oigusaktid/111072026120.xml>) |
| 111072026121.xml | [oigusaktid/111072026121.xml](<oigusaktid/111072026121.xml>) |
| 111072026122.xml | [oigusaktid/111072026122.xml](<oigusaktid/111072026122.xml>) |
| 111072026123.xml | [oigusaktid/111072026123.xml](<oigusaktid/111072026123.xml>) |
| 109072026076.xml | [oigusaktid/109072026076.xml](<oigusaktid/109072026076.xml>) |
| 111072026166.xml | [oigusaktid/111072026166.xml](<oigusaktid/111072026166.xml>) |
| 111072026167.xml | [oigusaktid/111072026167.xml](<oigusaktid/111072026167.xml>) |
| 111072026168.xml | [oigusaktid/111072026168.xml](<oigusaktid/111072026168.xml>) |
| 111072026169.xml | [oigusaktid/111072026169.xml](<oigusaktid/111072026169.xml>) |
| 130062026031.xml | [oigusaktid/130062026031.xml](<oigusaktid/130062026031.xml>) |
| 111072026042.xml | [oigusaktid/111072026042.xml](<oigusaktid/111072026042.xml>) |
| 111072026043.xml | [oigusaktid/111072026043.xml](<oigusaktid/111072026043.xml>) |
| 126092026005.xml | [oigusaktid/126092026005.xml](<oigusaktid/126092026005.xml>) |
| 129082025009-abivahendite-loetelu.json | [oigusaktid/lisad/129082025009-abivahendite-loetelu.json](<oigusaktid/lisad/129082025009-abivahendite-loetelu.json>) |
| 129082025009-abivahendite-loetelu.meta.json | [oigusaktid/lisad/129082025009-abivahendite-loetelu.meta.json](<oigusaktid/lisad/129082025009-abivahendite-loetelu.meta.json>) |
| 126092026005-abivahendite-loetelu.json | [oigusaktid/lisad/126092026005-abivahendite-loetelu.json](<oigusaktid/lisad/126092026005-abivahendite-loetelu.json>) |
| 126092026005-abivahendite-loetelu.meta.json | [oigusaktid/lisad/126092026005-abivahendite-loetelu.meta.json](<oigusaktid/lisad/126092026005-abivahendite-loetelu.meta.json>) |
| 404072025017-lisa.json | [oigusaktid/lisad/404072025017-lisa.json](<oigusaktid/lisad/404072025017-lisa.json>) |
| 404072025017-lisa.meta.json | [oigusaktid/lisad/404072025017-lisa.meta.json](<oigusaktid/lisad/404072025017-lisa.meta.json>) |
| 403042025042-lisa.json | [oigusaktid/lisad/403042025042-lisa.json](<oigusaktid/lisad/403042025042-lisa.json>) |
| 403042025042-lisa.meta.json | [oigusaktid/lisad/403042025042-lisa.meta.json](<oigusaktid/lisad/403042025042-lisa.meta.json>) |
| 430042026009-lisa.json | [oigusaktid/lisad/430042026009-lisa.json](<oigusaktid/lisad/430042026009-lisa.json>) |
| 430042026009-lisa.meta.json | [oigusaktid/lisad/430042026009-lisa.meta.json](<oigusaktid/lisad/430042026009-lisa.meta.json>) |
| 430062026035-lisa.json | [oigusaktid/lisad/430062026035-lisa.json](<oigusaktid/lisad/430062026035-lisa.json>) |
| 430062026035-lisa.meta.json | [oigusaktid/lisad/430062026035-lisa.meta.json](<oigusaktid/lisad/430062026035-lisa.meta.json>) |
| 429012026051-lisa.json | [oigusaktid/lisad/429012026051-lisa.json](<oigusaktid/lisad/429012026051-lisa.json>) |
| 429012026051-lisa.meta.json | [oigusaktid/lisad/429012026051-lisa.meta.json](<oigusaktid/lisad/429012026051-lisa.meta.json>) |
| 419052023006-lisa.json | [oigusaktid/lisad/419052023006-lisa.json](<oigusaktid/lisad/419052023006-lisa.json>) |
| 419052023006-lisa.meta.json | [oigusaktid/lisad/419052023006-lisa.meta.json](<oigusaktid/lisad/419052023006-lisa.meta.json>) |
| 411042018011-lisa-1.json | [oigusaktid/lisad/411042018011-lisa-1.json](<oigusaktid/lisad/411042018011-lisa-1.json>) |
| 411042018011-lisa-1.meta.json | [oigusaktid/lisad/411042018011-lisa-1.meta.json](<oigusaktid/lisad/411042018011-lisa-1.meta.json>) |
| 411042018011-lisa-2.json | [oigusaktid/lisad/411042018011-lisa-2.json](<oigusaktid/lisad/411042018011-lisa-2.json>) |
| 411042018011-lisa-2.meta.json | [oigusaktid/lisad/411042018011-lisa-2.meta.json](<oigusaktid/lisad/411042018011-lisa-2.meta.json>) |
| 404052016003-lisa-1.json | [oigusaktid/lisad/404052016003-lisa-1.json](<oigusaktid/lisad/404052016003-lisa-1.json>) |
| 404052016003-lisa-1.meta.json | [oigusaktid/lisad/404052016003-lisa-1.meta.json](<oigusaktid/lisad/404052016003-lisa-1.meta.json>) |
| 404052016003-lisa-2.json | [oigusaktid/lisad/404052016003-lisa-2.json](<oigusaktid/lisad/404052016003-lisa-2.json>) |
| 404052016003-lisa-2.meta.json | [oigusaktid/lisad/404052016003-lisa-2.meta.json](<oigusaktid/lisad/404052016003-lisa-2.meta.json>) |
| 404052016003-lisa-3.json | [oigusaktid/lisad/404052016003-lisa-3.json](<oigusaktid/lisad/404052016003-lisa-3.json>) |
| 404052016003-lisa-3.meta.json | [oigusaktid/lisad/404052016003-lisa-3.meta.json](<oigusaktid/lisad/404052016003-lisa-3.meta.json>) |
| 407052021021-lisa.json | [oigusaktid/lisad/407052021021-lisa.json](<oigusaktid/lisad/407052021021-lisa.json>) |
| 407052021021-lisa.meta.json | [oigusaktid/lisad/407052021021-lisa.meta.json](<oigusaktid/lisad/407052021021-lisa.meta.json>) |
| 103062026023.knowledge.json | [teadmised/103062026023.knowledge.json](<teadmised/103062026023.knowledge.json>) |
| 106072023031.knowledge.json | [teadmised/106072023031.knowledge.json](<teadmised/106072023031.knowledge.json>) |
| 126092026005.knowledge.json | [teadmised/126092026005.knowledge.json](<teadmised/126092026005.knowledge.json>) |
| 129082025009.knowledge.json | [teadmised/129082025009.knowledge.json](<teadmised/129082025009.knowledge.json>) |
| 130062026065.knowledge.json | [teadmised/130062026065.knowledge.json](<teadmised/130062026065.knowledge.json>) |
| 404072025017-lisa.knowledge.json | [teadmised/404072025017-lisa.knowledge.json](<teadmised/404072025017-lisa.knowledge.json>) |
| 404072025017.knowledge.json | [teadmised/404072025017.knowledge.json](<teadmised/404072025017.knowledge.json>) |
| 405092026051.xml | [oigusaktid/405092026051.xml](<oigusaktid/405092026051.xml>) |
| 426092026047.xml | [oigusaktid/426092026047.xml](<oigusaktid/426092026047.xml>) |
| 418082026033.xml | [oigusaktid/418082026033.xml](<oigusaktid/418082026033.xml>) |
| 427052026038.xml | [oigusaktid/427052026038.xml](<oigusaktid/427052026038.xml>) |
| 430062026040.xml | [oigusaktid/430062026040.xml](<oigusaktid/430062026040.xml>) |
| 430062026041.xml | [oigusaktid/430062026041.xml](<oigusaktid/430062026041.xml>) |
| 427052026031.xml | [oigusaktid/427052026031.xml](<oigusaktid/427052026031.xml>) |
| 423052026004.xml | [oigusaktid/423052026004.xml](<oigusaktid/423052026004.xml>) |
| 417062026033.xml | [oigusaktid/417062026033.xml](<oigusaktid/417062026033.xml>) |
| 411062026102.xml | [oigusaktid/411062026102.xml](<oigusaktid/411062026102.xml>) |
| 419062026027.xml | [oigusaktid/419062026027.xml](<oigusaktid/419062026027.xml>) |
| 426052026009.xml | [oigusaktid/426052026009.xml](<oigusaktid/426052026009.xml>) |
| 429082026027.xml | [oigusaktid/429082026027.xml](<oigusaktid/429082026027.xml>) |
| 430042026009.xml | [oigusaktid/430042026009.xml](<oigusaktid/430042026009.xml>) |
| 429092026004.xml | [oigusaktid/429092026004.xml](<oigusaktid/429092026004.xml>) |
| 401072025023.xml | [oigusaktid/401072025023.xml](<oigusaktid/401072025023.xml>) |
| 403032026033.xml | [oigusaktid/403032026033.xml](<oigusaktid/403032026033.xml>) |
| 403072026037.xml | [oigusaktid/403072026037.xml](<oigusaktid/403072026037.xml>) |
| 404032025051.xml | [oigusaktid/404032025051.xml](<oigusaktid/404032025051.xml>) |
| 404072025051.xml | [oigusaktid/404072025051.xml](<oigusaktid/404072025051.xml>) |
| 404072026045.xml | [oigusaktid/404072026045.xml](<oigusaktid/404072026045.xml>) |
| 404092025018.xml | [oigusaktid/404092025018.xml](<oigusaktid/404092025018.xml>) |
| 404092026056.xml | [oigusaktid/404092026056.xml](<oigusaktid/404092026056.xml>) |
| 405092026058.xml | [oigusaktid/405092026058.xml](<oigusaktid/405092026058.xml>) |
| 406022026002.xml | [oigusaktid/406022026002.xml](<oigusaktid/406022026002.xml>) |
| 407052026045.xml | [oigusaktid/407052026045.xml](<oigusaktid/407052026045.xml>) |
| 408072026002.xml | [oigusaktid/408072026002.xml](<oigusaktid/408072026002.xml>) |
| 408092026007.xml | [oigusaktid/408092026007.xml](<oigusaktid/408092026007.xml>) |
| 409052026032.xml | [oigusaktid/409052026032.xml](<oigusaktid/409052026032.xml>) |
| 410092024005.xml | [oigusaktid/410092024005.xml](<oigusaktid/410092024005.xml>) |
| 411062026104.xml | [oigusaktid/411062026104.xml](<oigusaktid/411062026104.xml>) |
| 411062026105.xml | [oigusaktid/411062026105.xml](<oigusaktid/411062026105.xml>) |
| 419082025017.xml | [oigusaktid/419082025017.xml](<oigusaktid/419082025017.xml>) |
| 421032026022.xml | [oigusaktid/421032026022.xml](<oigusaktid/421032026022.xml>) |
| 421062024005.xml | [oigusaktid/421062024005.xml](<oigusaktid/421062024005.xml>) |
| 425042025021.xml | [oigusaktid/425042025021.xml](<oigusaktid/425042025021.xml>) |
| 425042025028.xml | [oigusaktid/425042025028.xml](<oigusaktid/425042025028.xml>) |
| 426022026027.xml | [oigusaktid/426022026027.xml](<oigusaktid/426022026027.xml>) |
| 426022026044.xml | [oigusaktid/426022026044.xml](<oigusaktid/426022026044.xml>) |
| 426032026011.xml | [oigusaktid/426032026011.xml](<oigusaktid/426032026011.xml>) |
| 426052026014.xml | [oigusaktid/426052026014.xml](<oigusaktid/426052026014.xml>) |
| 426062026017.xml | [oigusaktid/426062026017.xml](<oigusaktid/426062026017.xml>) |
| 426062026018.xml | [oigusaktid/426062026018.xml](<oigusaktid/426062026018.xml>) |
| 427052026006.xml | [oigusaktid/427052026006.xml](<oigusaktid/427052026006.xml>) |
| 427062025029.xml | [oigusaktid/427062025029.xml](<oigusaktid/427062025029.xml>) |
| 429012026051.xml | [oigusaktid/429012026051.xml](<oigusaktid/429012026051.xml>) |
| 430042025034.xml | [oigusaktid/430042025034.xml](<oigusaktid/430042025034.xml>) |
| 430062026035.xml | [oigusaktid/430062026035.xml](<oigusaktid/430062026035.xml>) |
| 430092026027.xml | [oigusaktid/430092026027.xml](<oigusaktid/430092026027.xml>) |
| 431032026012.xml | [oigusaktid/431032026012.xml](<oigusaktid/431032026012.xml>) |
| 420052026012.xml | [oigusaktid/420052026012.xml](<oigusaktid/420052026012.xml>) |
| 425032026014.xml | [oigusaktid/425032026014.xml](<oigusaktid/425032026014.xml>) |
| 430092026046.xml | [oigusaktid/430092026046.xml](<oigusaktid/430092026046.xml>) |
| 401022018004.xml | [oigusaktid/401022018004.xml](<oigusaktid/401022018004.xml>) |
| 401022025014.xml | [oigusaktid/401022025014.xml](<oigusaktid/401022025014.xml>) |
| 401042021025.xml | [oigusaktid/401042021025.xml](<oigusaktid/401042021025.xml>) |
| 401042022005.xml | [oigusaktid/401042022005.xml](<oigusaktid/401042022005.xml>) |
| 401042026014.xml | [oigusaktid/401042026014.xml](<oigusaktid/401042026014.xml>) |
| 401092026014.xml | [oigusaktid/401092026014.xml](<oigusaktid/401092026014.xml>) |
| 401102022027.xml | [oigusaktid/401102022027.xml](<oigusaktid/401102022027.xml>) |
| 401102025005.xml | [oigusaktid/401102025005.xml](<oigusaktid/401102025005.xml>) |
| 401112022037.xml | [oigusaktid/401112022037.xml](<oigusaktid/401112022037.xml>) |
| 401112023018.xml | [oigusaktid/401112023018.xml](<oigusaktid/401112023018.xml>) |
| 401122018004.xml | [oigusaktid/401122018004.xml](<oigusaktid/401122018004.xml>) |
| 402032022007.xml | [oigusaktid/402032022007.xml](<oigusaktid/402032022007.xml>) |
| 402032024005.xml | [oigusaktid/402032024005.xml](<oigusaktid/402032024005.xml>) |
| 402052019031.xml | [oigusaktid/402052019031.xml](<oigusaktid/402052019031.xml>) |
| 402072013031.xml | [oigusaktid/402072013031.xml](<oigusaktid/402072013031.xml>) |
| 402072019013.xml | [oigusaktid/402072019013.xml](<oigusaktid/402072019013.xml>) |
| 402092020003.xml | [oigusaktid/402092020003.xml](<oigusaktid/402092020003.xml>) |
| 402092026035.xml | [oigusaktid/402092026035.xml](<oigusaktid/402092026035.xml>) |
| 402092026040.xml | [oigusaktid/402092026040.xml](<oigusaktid/402092026040.xml>) |
| 402092026041.xml | [oigusaktid/402092026041.xml](<oigusaktid/402092026041.xml>) |
| 402112022023.xml | [oigusaktid/402112022023.xml](<oigusaktid/402112022023.xml>) |
| 402122022033.xml | [oigusaktid/402122022033.xml](<oigusaktid/402122022033.xml>) |
| 403022018026.xml | [oigusaktid/403022018026.xml](<oigusaktid/403022018026.xml>) |
| 403022018028.xml | [oigusaktid/403022018028.xml](<oigusaktid/403022018028.xml>) |
| 403022026011.xml | [oigusaktid/403022026011.xml](<oigusaktid/403022026011.xml>) |
| 403022026027.xml | [oigusaktid/403022026027.xml](<oigusaktid/403022026027.xml>) |
| 403032022006.xml | [oigusaktid/403032022006.xml](<oigusaktid/403032022006.xml>) |
| 403032026029.xml | [oigusaktid/403032026029.xml](<oigusaktid/403032026029.xml>) |
| 403032026034.xml | [oigusaktid/403032026034.xml](<oigusaktid/403032026034.xml>) |
| 403052019008.xml | [oigusaktid/403052019008.xml](<oigusaktid/403052019008.xml>) |
| 403052024057.xml | [oigusaktid/403052024057.xml](<oigusaktid/403052024057.xml>) |
| 403062021002.xml | [oigusaktid/403062021002.xml](<oigusaktid/403062021002.xml>) |
| 403062026004.xml | [oigusaktid/403062026004.xml](<oigusaktid/403062026004.xml>) |
| 403072018058.xml | [oigusaktid/403072018058.xml](<oigusaktid/403072018058.xml>) |
| 403072021011.xml | [oigusaktid/403072021011.xml](<oigusaktid/403072021011.xml>) |
| 403072026036.xml | [oigusaktid/403072026036.xml](<oigusaktid/403072026036.xml>) |
| 403102019029.xml | [oigusaktid/403102019029.xml](<oigusaktid/403102019029.xml>) |
| 403102024033.xml | [oigusaktid/403102024033.xml](<oigusaktid/403102024033.xml>) |
| 404032020018.xml | [oigusaktid/404032020018.xml](<oigusaktid/404032020018.xml>) |
| 404032020029.xml | [oigusaktid/404032020029.xml](<oigusaktid/404032020029.xml>) |
| 404032025019.xml | [oigusaktid/404032025019.xml](<oigusaktid/404032025019.xml>) |
| 404032026003.xml | [oigusaktid/404032026003.xml](<oigusaktid/404032026003.xml>) |
| 404032026007.xml | [oigusaktid/404032026007.xml](<oigusaktid/404032026007.xml>) |
| 404042019017.xml | [oigusaktid/404042019017.xml](<oigusaktid/404042019017.xml>) |
| 404042023011.xml | [oigusaktid/404042023011.xml](<oigusaktid/404042023011.xml>) |
| 404042025018.xml | [oigusaktid/404042025018.xml](<oigusaktid/404042025018.xml>) |
| 404042025021.xml | [oigusaktid/404042025021.xml](<oigusaktid/404042025021.xml>) |
| 404052021007.xml | [oigusaktid/404052021007.xml](<oigusaktid/404052021007.xml>) |
| 404052021010.xml | [oigusaktid/404052021010.xml](<oigusaktid/404052021010.xml>) |
| 404062020013.xml | [oigusaktid/404062020013.xml](<oigusaktid/404062020013.xml>) |
| 404062020015.xml | [oigusaktid/404062020015.xml](<oigusaktid/404062020015.xml>) |
| 404062024005.xml | [oigusaktid/404062024005.xml](<oigusaktid/404062024005.xml>) |
| 404072017029.xml | [oigusaktid/404072017029.xml](<oigusaktid/404072017029.xml>) |
| 404072023029.xml | [oigusaktid/404072023029.xml](<oigusaktid/404072023029.xml>) |
| 404072026017.xml | [oigusaktid/404072026017.xml](<oigusaktid/404072026017.xml>) |
| 404072026030.xml | [oigusaktid/404072026030.xml](<oigusaktid/404072026030.xml>) |
| 404082026004.xml | [oigusaktid/404082026004.xml](<oigusaktid/404082026004.xml>) |
| 404082026007.xml | [oigusaktid/404082026007.xml](<oigusaktid/404082026007.xml>) |
| 404082026008.xml | [oigusaktid/404082026008.xml](<oigusaktid/404082026008.xml>) |
| 404092020028.xml | [oigusaktid/404092020028.xml](<oigusaktid/404092020028.xml>) |
| 404112022007.xml | [oigusaktid/404112022007.xml](<oigusaktid/404112022007.xml>) |
| 404122019013.xml | [oigusaktid/404122019013.xml](<oigusaktid/404122019013.xml>) |
| 404122024053.xml | [oigusaktid/404122024053.xml](<oigusaktid/404122024053.xml>) |
| 404122024054.xml | [oigusaktid/404122024054.xml](<oigusaktid/404122024054.xml>) |
| 405012018022.xml | [oigusaktid/405012018022.xml](<oigusaktid/405012018022.xml>) |
| 405022021014.xml | [oigusaktid/405022021014.xml](<oigusaktid/405022021014.xml>) |
| 405032016008.xml | [oigusaktid/405032016008.xml](<oigusaktid/405032016008.xml>) |
| 405032016022.xml | [oigusaktid/405032016022.xml](<oigusaktid/405032016022.xml>) |
| 405032020039.xml | [oigusaktid/405032020039.xml](<oigusaktid/405032020039.xml>) |
| 405032022002.xml | [oigusaktid/405032022002.xml](<oigusaktid/405032022002.xml>) |
| 405042019006.xml | [oigusaktid/405042019006.xml](<oigusaktid/405042019006.xml>) |
| 405042025015.xml | [oigusaktid/405042025015.xml](<oigusaktid/405042025015.xml>) |
| 405052021007.xml | [oigusaktid/405052021007.xml](<oigusaktid/405052021007.xml>) |
| 405062018013.xml | [oigusaktid/405062018013.xml](<oigusaktid/405062018013.xml>) |
| 405062018016.xml | [oigusaktid/405062018016.xml](<oigusaktid/405062018016.xml>) |
| 405062021001.xml | [oigusaktid/405062021001.xml](<oigusaktid/405062021001.xml>) |
| 405062026026.xml | [oigusaktid/405062026026.xml](<oigusaktid/405062026026.xml>) |
| 405072019006.xml | [oigusaktid/405072019006.xml](<oigusaktid/405072019006.xml>) |
| 405072022009.xml | [oigusaktid/405072022009.xml](<oigusaktid/405072022009.xml>) |
| 405072022012.xml | [oigusaktid/405072022012.xml](<oigusaktid/405072022012.xml>) |
| 405072023015.xml | [oigusaktid/405072023015.xml](<oigusaktid/405072023015.xml>) |
| 405092024015.xml | [oigusaktid/405092024015.xml](<oigusaktid/405092024015.xml>) |
| 405092026029.xml | [oigusaktid/405092026029.xml](<oigusaktid/405092026029.xml>) |
| 405102023039.xml | [oigusaktid/405102023039.xml](<oigusaktid/405102023039.xml>) |
| 405122023020.xml | [oigusaktid/405122023020.xml](<oigusaktid/405122023020.xml>) |
| 406012021005.xml | [oigusaktid/406012021005.xml](<oigusaktid/406012021005.xml>) |
| 406032018074.xml | [oigusaktid/406032018074.xml](<oigusaktid/406032018074.xml>) |
| 406042016051.xml | [oigusaktid/406042016051.xml](<oigusaktid/406042016051.xml>) |
| 406042023002.xml | [oigusaktid/406042023002.xml](<oigusaktid/406042023002.xml>) |
| 406062018004.xml | [oigusaktid/406062018004.xml](<oigusaktid/406062018004.xml>) |
| 406062023013.xml | [oigusaktid/406062023013.xml](<oigusaktid/406062023013.xml>) |
| 406062023034.xml | [oigusaktid/406062023034.xml](<oigusaktid/406062023034.xml>) |
| 406062025017.xml | [oigusaktid/406062025017.xml](<oigusaktid/406062025017.xml>) |
| 406062025039.xml | [oigusaktid/406062025039.xml](<oigusaktid/406062025039.xml>) |
| 406062026010.xml | [oigusaktid/406062026010.xml](<oigusaktid/406062026010.xml>) |
| 406072021008.xml | [oigusaktid/406072021008.xml](<oigusaktid/406072021008.xml>) |
| 406072023029.xml | [oigusaktid/406072023029.xml](<oigusaktid/406072023029.xml>) |
| 406112020010.xml | [oigusaktid/406112020010.xml](<oigusaktid/406112020010.xml>) |
| 406112020055.xml | [oigusaktid/406112020055.xml](<oigusaktid/406112020055.xml>) |
| 406122022001.xml | [oigusaktid/406122022001.xml](<oigusaktid/406122022001.xml>) |
| 406122024018.xml | [oigusaktid/406122024018.xml](<oigusaktid/406122024018.xml>) |
| 407022026012.xml | [oigusaktid/407022026012.xml](<oigusaktid/407022026012.xml>) |
| 407032018009.xml | [oigusaktid/407032018009.xml](<oigusaktid/407032018009.xml>) |
| 407032018053.xml | [oigusaktid/407032018053.xml](<oigusaktid/407032018053.xml>) |
| 407032019045.xml | [oigusaktid/407032019045.xml](<oigusaktid/407032019045.xml>) |
| 407032026007.xml | [oigusaktid/407032026007.xml](<oigusaktid/407032026007.xml>) |
| 407032026009.xml | [oigusaktid/407032026009.xml](<oigusaktid/407032026009.xml>) |
| 407042022010.xml | [oigusaktid/407042022010.xml](<oigusaktid/407042022010.xml>) |
| 407052026014.xml | [oigusaktid/407052026014.xml](<oigusaktid/407052026014.xml>) |
| 407062016009.xml | [oigusaktid/407062016009.xml](<oigusaktid/407062016009.xml>) |
| 407072023039.xml | [oigusaktid/407072023039.xml](<oigusaktid/407072023039.xml>) |
| 407072023065.xml | [oigusaktid/407072023065.xml](<oigusaktid/407072023065.xml>) |
| 407112018026.xml | [oigusaktid/407112018026.xml](<oigusaktid/407112018026.xml>) |
| 407112019020.xml | [oigusaktid/407112019020.xml](<oigusaktid/407112019020.xml>) |
| 408012019034.xml | [oigusaktid/408012019034.xml](<oigusaktid/408012019034.xml>) |
| 408042025030.xml | [oigusaktid/408042025030.xml](<oigusaktid/408042025030.xml>) |
| 408052019023.xml | [oigusaktid/408052019023.xml](<oigusaktid/408052019023.xml>) |
| 408052020014.xml | [oigusaktid/408052020014.xml](<oigusaktid/408052020014.xml>) |
| 408052026031.xml | [oigusaktid/408052026031.xml](<oigusaktid/408052026031.xml>) |
| 408062016007.xml | [oigusaktid/408062016007.xml](<oigusaktid/408062016007.xml>) |
| 408072023033.xml | [oigusaktid/408072023033.xml](<oigusaktid/408072023033.xml>) |
| 408092021001.xml | [oigusaktid/408092021001.xml](<oigusaktid/408092021001.xml>) |
| 408122018009.xml | [oigusaktid/408122018009.xml](<oigusaktid/408122018009.xml>) |
| 408122023043.xml | [oigusaktid/408122023043.xml](<oigusaktid/408122023043.xml>) |
| 409012019038.xml | [oigusaktid/409012019038.xml](<oigusaktid/409012019038.xml>) |
| 409032019010.xml | [oigusaktid/409032019010.xml](<oigusaktid/409032019010.xml>) |
| 409042020001.xml | [oigusaktid/409042020001.xml](<oigusaktid/409042020001.xml>) |
| 409052018014.xml | [oigusaktid/409052018014.xml](<oigusaktid/409052018014.xml>) |
| 409052024010.xml | [oigusaktid/409052024010.xml](<oigusaktid/409052024010.xml>) |
| 409072022022.xml | [oigusaktid/409072022022.xml](<oigusaktid/409072022022.xml>) |
| 409092025010.xml | [oigusaktid/409092025010.xml](<oigusaktid/409092025010.xml>) |
| 409092026025.xml | [oigusaktid/409092026025.xml](<oigusaktid/409092026025.xml>) |
| 410022018020.xml | [oigusaktid/410022018020.xml](<oigusaktid/410022018020.xml>) |
| 410022018021.xml | [oigusaktid/410022018021.xml](<oigusaktid/410022018021.xml>) |
| 410022018023.xml | [oigusaktid/410022018023.xml](<oigusaktid/410022018023.xml>) |
| 410042021025.xml | [oigusaktid/410042021025.xml](<oigusaktid/410042021025.xml>) |
| 410042026001.xml | [oigusaktid/410042026001.xml](<oigusaktid/410042026001.xml>) |
| 410042026002.xml | [oigusaktid/410042026002.xml](<oigusaktid/410042026002.xml>) |
| 410042026021.xml | [oigusaktid/410042026021.xml](<oigusaktid/410042026021.xml>) |
| 410042026026.xml | [oigusaktid/410042026026.xml](<oigusaktid/410042026026.xml>) |
| 410112020018.xml | [oigusaktid/410112020018.xml](<oigusaktid/410112020018.xml>) |
| 410122019018.xml | [oigusaktid/410122019018.xml](<oigusaktid/410122019018.xml>) |
| 411022020017.xml | [oigusaktid/411022020017.xml](<oigusaktid/411022020017.xml>) |
| 411042023021.xml | [oigusaktid/411042023021.xml](<oigusaktid/411042023021.xml>) |
| 411062025004.xml | [oigusaktid/411062025004.xml](<oigusaktid/411062025004.xml>) |
| 411062026049.xml | [oigusaktid/411062026049.xml](<oigusaktid/411062026049.xml>) |
| 411062026097.xml | [oigusaktid/411062026097.xml](<oigusaktid/411062026097.xml>) |
| 411072018061.xml | [oigusaktid/411072018061.xml](<oigusaktid/411072018061.xml>) |
| 411102023010.xml | [oigusaktid/411102023010.xml](<oigusaktid/411102023010.xml>) |
| 411102024013.xml | [oigusaktid/411102024013.xml](<oigusaktid/411102024013.xml>) |
| 411122019019.xml | [oigusaktid/411122019019.xml](<oigusaktid/411122019019.xml>) |
| 411122019020.xml | [oigusaktid/411122019020.xml](<oigusaktid/411122019020.xml>) |
| 411122021016.xml | [oigusaktid/411122021016.xml](<oigusaktid/411122021016.xml>) |
| 412012024001.xml | [oigusaktid/412012024001.xml](<oigusaktid/412012024001.xml>) |
| 412052026001.xml | [oigusaktid/412052026001.xml](<oigusaktid/412052026001.xml>) |
| 412052026002.xml | [oigusaktid/412052026002.xml](<oigusaktid/412052026002.xml>) |
| 412062018101.xml | [oigusaktid/412062018101.xml](<oigusaktid/412062018101.xml>) |
| 412072019007.xml | [oigusaktid/412072019007.xml](<oigusaktid/412072019007.xml>) |
| 412092026007.xml | [oigusaktid/412092026007.xml](<oigusaktid/412092026007.xml>) |
| 412092026022.xml | [oigusaktid/412092026022.xml](<oigusaktid/412092026022.xml>) |
| 412112025001.xml | [oigusaktid/412112025001.xml](<oigusaktid/412112025001.xml>) |
| 413022018039.xml | [oigusaktid/413022018039.xml](<oigusaktid/413022018039.xml>) |
| 413022026009.xml | [oigusaktid/413022026009.xml](<oigusaktid/413022026009.xml>) |
| 413022026022.xml | [oigusaktid/413022026022.xml](<oigusaktid/413022026022.xml>) |
| 413022026025.xml | [oigusaktid/413022026025.xml](<oigusaktid/413022026025.xml>) |
| 413032026004.xml | [oigusaktid/413032026004.xml](<oigusaktid/413032026004.xml>) |
| 413062023003.xml | [oigusaktid/413062023003.xml](<oigusaktid/413062023003.xml>) |
| 413062023005.xml | [oigusaktid/413062023005.xml](<oigusaktid/413062023005.xml>) |
| 413082019003.xml | [oigusaktid/413082019003.xml](<oigusaktid/413082019003.xml>) |
| 413122019002.xml | [oigusaktid/413122019002.xml](<oigusaktid/413122019002.xml>) |
| 414032026010.xml | [oigusaktid/414032026010.xml](<oigusaktid/414032026010.xml>) |
| 414042016056.xml | [oigusaktid/414042016056.xml](<oigusaktid/414042016056.xml>) |
| 414082025006.xml | [oigusaktid/414082025006.xml](<oigusaktid/414082025006.xml>) |
| 414092023003.xml | [oigusaktid/414092023003.xml](<oigusaktid/414092023003.xml>) |
| 415082017002.xml | [oigusaktid/415082017002.xml](<oigusaktid/415082017002.xml>) |
| 415102025025.xml | [oigusaktid/415102025025.xml](<oigusaktid/415102025025.xml>) |
| 416062021007.xml | [oigusaktid/416062021007.xml](<oigusaktid/416062021007.xml>) |
| 416062026001.xml | [oigusaktid/416062026001.xml](<oigusaktid/416062026001.xml>) |
| 416082023001.xml | [oigusaktid/416082023001.xml](<oigusaktid/416082023001.xml>) |
| 416122022004.xml | [oigusaktid/416122022004.xml](<oigusaktid/416122022004.xml>) |
| 416122025002.xml | [oigusaktid/416122025002.xml](<oigusaktid/416122025002.xml>) |
| 417032016009.xml | [oigusaktid/417032016009.xml](<oigusaktid/417032016009.xml>) |
| 417032026006.xml | [oigusaktid/417032026006.xml](<oigusaktid/417032026006.xml>) |
| 417032026018.xml | [oigusaktid/417032026018.xml](<oigusaktid/417032026018.xml>) |
| 417052025003.xml | [oigusaktid/417052025003.xml](<oigusaktid/417052025003.xml>) |
| 417062020030.xml | [oigusaktid/417062020030.xml](<oigusaktid/417062020030.xml>) |
| 417062026002.xml | [oigusaktid/417062026002.xml](<oigusaktid/417062026002.xml>) |
| 417072025018.xml | [oigusaktid/417072025018.xml](<oigusaktid/417072025018.xml>) |
| 418022025005.xml | [oigusaktid/418022025005.xml](<oigusaktid/418022025005.xml>) |
| 418022025010.xml | [oigusaktid/418022025010.xml](<oigusaktid/418022025010.xml>) |
| 418032020005.xml | [oigusaktid/418032020005.xml](<oigusaktid/418032020005.xml>) |
| 418042013003.xml | [oigusaktid/418042013003.xml](<oigusaktid/418042013003.xml>) |
| 418042019010.xml | [oigusaktid/418042019010.xml](<oigusaktid/418042019010.xml>) |
| 418042024003.xml | [oigusaktid/418042024003.xml](<oigusaktid/418042024003.xml>) |
| 418052018020.xml | [oigusaktid/418052018020.xml](<oigusaktid/418052018020.xml>) |
| 418092021014.xml | [oigusaktid/418092021014.xml](<oigusaktid/418092021014.xml>) |
| 418102018023.xml | [oigusaktid/418102018023.xml](<oigusaktid/418102018023.xml>) |
| 418102024020.xml | [oigusaktid/418102024020.xml](<oigusaktid/418102024020.xml>) |
| 418102024021.xml | [oigusaktid/418102024021.xml](<oigusaktid/418102024021.xml>) |
| 418122025015.xml | [oigusaktid/418122025015.xml](<oigusaktid/418122025015.xml>) |
| 419022022015.xml | [oigusaktid/419022022015.xml](<oigusaktid/419022022015.xml>) |
| 419062026010.xml | [oigusaktid/419062026010.xml](<oigusaktid/419062026010.xml>) |
| 419062026028.xml | [oigusaktid/419062026028.xml](<oigusaktid/419062026028.xml>) |
| 420022026019.xml | [oigusaktid/420022026019.xml](<oigusaktid/420022026019.xml>) |
| 420032018009.xml | [oigusaktid/420032018009.xml](<oigusaktid/420032018009.xml>) |
| 420032026005.xml | [oigusaktid/420032026005.xml](<oigusaktid/420032026005.xml>) |
| 420032026008.xml | [oigusaktid/420032026008.xml](<oigusaktid/420032026008.xml>) |
| 420042023002.xml | [oigusaktid/420042023002.xml](<oigusaktid/420042023002.xml>) |
| 420052026011.xml | [oigusaktid/420052026011.xml](<oigusaktid/420052026011.xml>) |
| 420062023006.xml | [oigusaktid/420062023006.xml](<oigusaktid/420062023006.xml>) |
| 420062023010.xml | [oigusaktid/420062023010.xml](<oigusaktid/420062023010.xml>) |
| 420062023026.xml | [oigusaktid/420062023026.xml](<oigusaktid/420062023026.xml>) |
| 420062023029.xml | [oigusaktid/420062023029.xml](<oigusaktid/420062023029.xml>) |
| 420102018036.xml | [oigusaktid/420102018036.xml](<oigusaktid/420102018036.xml>) |
| 420102021026.xml | [oigusaktid/420102021026.xml](<oigusaktid/420102021026.xml>) |
| 420112024005.xml | [oigusaktid/420112024005.xml](<oigusaktid/420112024005.xml>) |
| 420122017017.xml | [oigusaktid/420122017017.xml](<oigusaktid/420122017017.xml>) |
| 421032018021.xml | [oigusaktid/421032018021.xml](<oigusaktid/421032018021.xml>) |
| 421052025024.xml | [oigusaktid/421052025024.xml](<oigusaktid/421052025024.xml>) |
| 421052025025.xml | [oigusaktid/421052025025.xml](<oigusaktid/421052025025.xml>) |
| 421062023034.xml | [oigusaktid/421062023034.xml](<oigusaktid/421062023034.xml>) |
| 421102022016.xml | [oigusaktid/421102022016.xml](<oigusaktid/421102022016.xml>) |
| 421102025032.xml | [oigusaktid/421102025032.xml](<oigusaktid/421102025032.xml>) |
| 421112025002.xml | [oigusaktid/421112025002.xml](<oigusaktid/421112025002.xml>) |
| 421112025003.xml | [oigusaktid/421112025003.xml](<oigusaktid/421112025003.xml>) |
| 421112025004.xml | [oigusaktid/421112025004.xml](<oigusaktid/421112025004.xml>) |
| 421112025005.xml | [oigusaktid/421112025005.xml](<oigusaktid/421112025005.xml>) |
| 421112025006.xml | [oigusaktid/421112025006.xml](<oigusaktid/421112025006.xml>) |
| 421112025007.xml | [oigusaktid/421112025007.xml](<oigusaktid/421112025007.xml>) |
| 421112025008.xml | [oigusaktid/421112025008.xml](<oigusaktid/421112025008.xml>) |
| 421112025009.xml | [oigusaktid/421112025009.xml](<oigusaktid/421112025009.xml>) |
| 421112025010.xml | [oigusaktid/421112025010.xml](<oigusaktid/421112025010.xml>) |
| 421122018052.xml | [oigusaktid/421122018052.xml](<oigusaktid/421122018052.xml>) |
| 421122022030.xml | [oigusaktid/421122022030.xml](<oigusaktid/421122022030.xml>) |
| 421122024030.xml | [oigusaktid/421122024030.xml](<oigusaktid/421122024030.xml>) |
| 422012022033.xml | [oigusaktid/422012022033.xml](<oigusaktid/422012022033.xml>) |
| 422012026010.xml | [oigusaktid/422012026010.xml](<oigusaktid/422012026010.xml>) |
| 422032022002.xml | [oigusaktid/422032022002.xml](<oigusaktid/422032022002.xml>) |
| 422032022003.xml | [oigusaktid/422032022003.xml](<oigusaktid/422032022003.xml>) |
| 422052018007.xml | [oigusaktid/422052018007.xml](<oigusaktid/422052018007.xml>) |
| 422052018057.xml | [oigusaktid/422052018057.xml](<oigusaktid/422052018057.xml>) |
| 422052026003.xml | [oigusaktid/422052026003.xml](<oigusaktid/422052026003.xml>) |
| 422062018014.xml | [oigusaktid/422062018014.xml](<oigusaktid/422062018014.xml>) |
| 422062018017.xml | [oigusaktid/422062018017.xml](<oigusaktid/422062018017.xml>) |
| 422062022003.xml | [oigusaktid/422062022003.xml](<oigusaktid/422062022003.xml>) |
| 422062022021.xml | [oigusaktid/422062022021.xml](<oigusaktid/422062022021.xml>) |
| 422062023024.xml | [oigusaktid/422062023024.xml](<oigusaktid/422062023024.xml>) |
| 422062023029.xml | [oigusaktid/422062023029.xml](<oigusaktid/422062023029.xml>) |
| 422082026015.xml | [oigusaktid/422082026015.xml](<oigusaktid/422082026015.xml>) |
| 422082026016.xml | [oigusaktid/422082026016.xml](<oigusaktid/422082026016.xml>) |
| 422082026017.xml | [oigusaktid/422082026017.xml](<oigusaktid/422082026017.xml>) |
| 422102024004.xml | [oigusaktid/422102024004.xml](<oigusaktid/422102024004.xml>) |
| 423022018022.xml | [oigusaktid/423022018022.xml](<oigusaktid/423022018022.xml>) |
| 423022022015.xml | [oigusaktid/423022022015.xml](<oigusaktid/423022022015.xml>) |
| 423042019003.xml | [oigusaktid/423042019003.xml](<oigusaktid/423042019003.xml>) |
| 423052025004.xml | [oigusaktid/423052025004.xml](<oigusaktid/423052025004.xml>) |
| 423092026006.xml | [oigusaktid/423092026006.xml](<oigusaktid/423092026006.xml>) |
| 423102018014.xml | [oigusaktid/423102018014.xml](<oigusaktid/423102018014.xml>) |
| 423122020009.xml | [oigusaktid/423122020009.xml](<oigusaktid/423122020009.xml>) |
| 423122022049.xml | [oigusaktid/423122022049.xml](<oigusaktid/423122022049.xml>) |
| 424052022003.xml | [oigusaktid/424052022003.xml](<oigusaktid/424052022003.xml>) |
| 424052024012.xml | [oigusaktid/424052024012.xml](<oigusaktid/424052024012.xml>) |
| 424052024020.xml | [oigusaktid/424052024020.xml](<oigusaktid/424052024020.xml>) |
| 424052024031.xml | [oigusaktid/424052024031.xml](<oigusaktid/424052024031.xml>) |
| 424092022025.xml | [oigusaktid/424092022025.xml](<oigusaktid/424092022025.xml>) |
| 424102024007.xml | [oigusaktid/424102024007.xml](<oigusaktid/424102024007.xml>) |
| 425032026038.xml | [oigusaktid/425032026038.xml](<oigusaktid/425032026038.xml>) |
| 425042026003.xml | [oigusaktid/425042026003.xml](<oigusaktid/425042026003.xml>) |
| 425072013012.xml | [oigusaktid/425072013012.xml](<oigusaktid/425072013012.xml>) |
| 425072025017.xml | [oigusaktid/425072025017.xml](<oigusaktid/425072025017.xml>) |
| 425092025019.xml | [oigusaktid/425092025019.xml](<oigusaktid/425092025019.xml>) |
| 426012024044.xml | [oigusaktid/426012024044.xml](<oigusaktid/426012024044.xml>) |
| 426022026022.xml | [oigusaktid/426022026022.xml](<oigusaktid/426022026022.xml>) |
| 426022026028.xml | [oigusaktid/426022026028.xml](<oigusaktid/426022026028.xml>) |
| 426022026040.xml | [oigusaktid/426022026040.xml](<oigusaktid/426022026040.xml>) |
| 426022026057.xml | [oigusaktid/426022026057.xml](<oigusaktid/426022026057.xml>) |
| 426032025026.xml | [oigusaktid/426032025026.xml](<oigusaktid/426032025026.xml>) |
| 426072022006.xml | [oigusaktid/426072022006.xml](<oigusaktid/426072022006.xml>) |
| 426092019002.xml | [oigusaktid/426092019002.xml](<oigusaktid/426092019002.xml>) |
| 426102018018.xml | [oigusaktid/426102018018.xml](<oigusaktid/426102018018.xml>) |
| 426102018041.xml | [oigusaktid/426102018041.xml](<oigusaktid/426102018041.xml>) |
| 427022018027.xml | [oigusaktid/427022018027.xml](<oigusaktid/427022018027.xml>) |
| 427022018029.xml | [oigusaktid/427022018029.xml](<oigusaktid/427022018029.xml>) |
| 427022018030.xml | [oigusaktid/427022018030.xml](<oigusaktid/427022018030.xml>) |
| 427052026003.xml | [oigusaktid/427052026003.xml](<oigusaktid/427052026003.xml>) |
| 427062023003.xml | [oigusaktid/427062023003.xml](<oigusaktid/427062023003.xml>) |
| 427062023004.xml | [oigusaktid/427062023004.xml](<oigusaktid/427062023004.xml>) |
| 427062023005.xml | [oigusaktid/427062023005.xml](<oigusaktid/427062023005.xml>) |
| 427062023038.xml | [oigusaktid/427062023038.xml](<oigusaktid/427062023038.xml>) |
| 427062023046.xml | [oigusaktid/427062023046.xml](<oigusaktid/427062023046.xml>) |
| 427062025043.xml | [oigusaktid/427062025043.xml](<oigusaktid/427062025043.xml>) |
| 427102023015.xml | [oigusaktid/427102023015.xml](<oigusaktid/427102023015.xml>) |
| 427112024036.xml | [oigusaktid/427112024036.xml](<oigusaktid/427112024036.xml>) |
| 427122022007.xml | [oigusaktid/427122022007.xml](<oigusaktid/427122022007.xml>) |
| 427122022020.xml | [oigusaktid/427122022020.xml](<oigusaktid/427122022020.xml>) |
| 428042018077.xml | [oigusaktid/428042018077.xml](<oigusaktid/428042018077.xml>) |
| 428042018078.xml | [oigusaktid/428042018078.xml](<oigusaktid/428042018078.xml>) |
| 428042018115.xml | [oigusaktid/428042018115.xml](<oigusaktid/428042018115.xml>) |
| 428052022003.xml | [oigusaktid/428052022003.xml](<oigusaktid/428052022003.xml>) |
| 428062022038.xml | [oigusaktid/428062022038.xml](<oigusaktid/428062022038.xml>) |
| 428062022065.xml | [oigusaktid/428062022065.xml](<oigusaktid/428062022065.xml>) |
| 428062022104.xml | [oigusaktid/428062022104.xml](<oigusaktid/428062022104.xml>) |
| 428062023019.xml | [oigusaktid/428062023019.xml](<oigusaktid/428062023019.xml>) |
| 428062023021.xml | [oigusaktid/428062023021.xml](<oigusaktid/428062023021.xml>) |
| 428062023028.xml | [oigusaktid/428062023028.xml](<oigusaktid/428062023028.xml>) |
| 428062023052.xml | [oigusaktid/428062023052.xml](<oigusaktid/428062023052.xml>) |
| 428062025012.xml | [oigusaktid/428062025012.xml](<oigusaktid/428062025012.xml>) |
| 428062025028.xml | [oigusaktid/428062025028.xml](<oigusaktid/428062025028.xml>) |
| 428092021013.xml | [oigusaktid/428092021013.xml](<oigusaktid/428092021013.xml>) |
| 428092023023.xml | [oigusaktid/428092023023.xml](<oigusaktid/428092023023.xml>) |
| 428092024024.xml | [oigusaktid/428092024024.xml](<oigusaktid/428092024024.xml>) |
| 428122019021.xml | [oigusaktid/428122019021.xml](<oigusaktid/428122019021.xml>) |
| 428122024029.xml | [oigusaktid/428122024029.xml](<oigusaktid/428122024029.xml>) |
| 428122024108.xml | [oigusaktid/428122024108.xml](<oigusaktid/428122024108.xml>) |
| 428122024114.xml | [oigusaktid/428122024114.xml](<oigusaktid/428122024114.xml>) |
| 428122024119.xml | [oigusaktid/428122024119.xml](<oigusaktid/428122024119.xml>) |
| 428122024126.xml | [oigusaktid/428122024126.xml](<oigusaktid/428122024126.xml>) |
| 429012022009.xml | [oigusaktid/429012022009.xml](<oigusaktid/429012022009.xml>) |
| 429012026055.xml | [oigusaktid/429012026055.xml](<oigusaktid/429012026055.xml>) |
| 429022024017.xml | [oigusaktid/429022024017.xml](<oigusaktid/429022024017.xml>) |
| 429032016079.xml | [oigusaktid/429032016079.xml](<oigusaktid/429032016079.xml>) |
| 429032017003.xml | [oigusaktid/429032017003.xml](<oigusaktid/429032017003.xml>) |
| 429032025035.xml | [oigusaktid/429032025035.xml](<oigusaktid/429032025035.xml>) |
| 429032025042.xml | [oigusaktid/429032025042.xml](<oigusaktid/429032025042.xml>) |
| 429032025043.xml | [oigusaktid/429032025043.xml](<oigusaktid/429032025043.xml>) |
| 429052021008.xml | [oigusaktid/429052021008.xml](<oigusaktid/429052021008.xml>) |
| 429062024036.xml | [oigusaktid/429062024036.xml](<oigusaktid/429062024036.xml>) |
| 429082026013.xml | [oigusaktid/429082026013.xml](<oigusaktid/429082026013.xml>) |
| 429082026018.xml | [oigusaktid/429082026018.xml](<oigusaktid/429082026018.xml>) |
| 429082026022.xml | [oigusaktid/429082026022.xml](<oigusaktid/429082026022.xml>) |
| 429092026005.xml | [oigusaktid/429092026005.xml](<oigusaktid/429092026005.xml>) |
| 429092026006.xml | [oigusaktid/429092026006.xml](<oigusaktid/429092026006.xml>) |
| 429092026008.xml | [oigusaktid/429092026008.xml](<oigusaktid/429092026008.xml>) |
| 429092026009.xml | [oigusaktid/429092026009.xml](<oigusaktid/429092026009.xml>) |
| 429092026011.xml | [oigusaktid/429092026011.xml](<oigusaktid/429092026011.xml>) |
| 429092026012.xml | [oigusaktid/429092026012.xml](<oigusaktid/429092026012.xml>) |
| 429092026013.xml | [oigusaktid/429092026013.xml](<oigusaktid/429092026013.xml>) |
| 429092026014.xml | [oigusaktid/429092026014.xml](<oigusaktid/429092026014.xml>) |
| 429092026016.xml | [oigusaktid/429092026016.xml](<oigusaktid/429092026016.xml>) |
| 429092026017.xml | [oigusaktid/429092026017.xml](<oigusaktid/429092026017.xml>) |
| 429092026018.xml | [oigusaktid/429092026018.xml](<oigusaktid/429092026018.xml>) |
| 429092026019.xml | [oigusaktid/429092026019.xml](<oigusaktid/429092026019.xml>) |
| 429102022045.xml | [oigusaktid/429102022045.xml](<oigusaktid/429102022045.xml>) |
| 429112024036.xml | [oigusaktid/429112024036.xml](<oigusaktid/429112024036.xml>) |
| 429122018040.xml | [oigusaktid/429122018040.xml](<oigusaktid/429122018040.xml>) |
| 429122022083.xml | [oigusaktid/429122022083.xml](<oigusaktid/429122022083.xml>) |
| 430042021057.xml | [oigusaktid/430042021057.xml](<oigusaktid/430042021057.xml>) |
| 430062026013.xml | [oigusaktid/430062026013.xml](<oigusaktid/430062026013.xml>) |
| 430082018017.xml | [oigusaktid/430082018017.xml](<oigusaktid/430082018017.xml>) |
| 430092026038.xml | [oigusaktid/430092026038.xml](<oigusaktid/430092026038.xml>) |
| 430092026042.xml | [oigusaktid/430092026042.xml](<oigusaktid/430092026042.xml>) |
| 430102024015.xml | [oigusaktid/430102024015.xml](<oigusaktid/430102024015.xml>) |
| 430102024016.xml | [oigusaktid/430102024016.xml](<oigusaktid/430102024016.xml>) |
| 430122023007.xml | [oigusaktid/430122023007.xml](<oigusaktid/430122023007.xml>) |
| 431012020008.xml | [oigusaktid/431012020008.xml](<oigusaktid/431012020008.xml>) |
| 431012026006.xml | [oigusaktid/431012026006.xml](<oigusaktid/431012026006.xml>) |
| 431032026010.xml | [oigusaktid/431032026010.xml](<oigusaktid/431032026010.xml>) |
| 431052023009.xml | [oigusaktid/431052023009.xml](<oigusaktid/431052023009.xml>) |
| 431052023012.xml | [oigusaktid/431052023012.xml](<oigusaktid/431052023012.xml>) |
| 431102023034.xml | [oigusaktid/431102023034.xml](<oigusaktid/431102023034.xml>) |
| 431122019023.xml | [oigusaktid/431122019023.xml](<oigusaktid/431122019023.xml>) |
| 431122020021.xml | [oigusaktid/431122020021.xml](<oigusaktid/431122020021.xml>) |
| 431122020086.xml | [oigusaktid/431122020086.xml](<oigusaktid/431122020086.xml>) |
| 431122022054.xml | [oigusaktid/431122022054.xml](<oigusaktid/431122022054.xml>) |
| 431122024005.xml | [oigusaktid/431122024005.xml](<oigusaktid/431122024005.xml>) |
| 431122025011.xml | [oigusaktid/431122025011.xml](<oigusaktid/431122025011.xml>) |
| 401102026040.xml | [oigusaktid/401102026040.xml](<oigusaktid/401102026040.xml>) |
| 403032018117.xml | [oigusaktid/403032018117.xml](<oigusaktid/403032018117.xml>) |
| 423022022027.xml | [oigusaktid/423022022027.xml](<oigusaktid/423022022027.xml>) |
| 423122025041.xml | [oigusaktid/423122025041.xml](<oigusaktid/423122025041.xml>) |
| 426062026007.xml | [oigusaktid/426062026007.xml](<oigusaktid/426062026007.xml>) |
| 427052026019.xml | [oigusaktid/427052026019.xml](<oigusaktid/427052026019.xml>) |
| 401022025031.xml | [oigusaktid/401022025031.xml](<oigusaktid/401022025031.xml>) |
| 402042026016.xml | [oigusaktid/402042026016.xml](<oigusaktid/402042026016.xml>) |
| 404092025028.xml | [oigusaktid/404092025028.xml](<oigusaktid/404092025028.xml>) |
| 406062026037.xml | [oigusaktid/406062026037.xml](<oigusaktid/406062026037.xml>) |
| 406122024002.xml | [oigusaktid/406122024002.xml](<oigusaktid/406122024002.xml>) |
| 407022026044.xml | [oigusaktid/407022026044.xml](<oigusaktid/407022026044.xml>) |
| 408022019008.xml | [oigusaktid/408022019008.xml](<oigusaktid/408022019008.xml>) |
| 408112018042.xml | [oigusaktid/408112018042.xml](<oigusaktid/408112018042.xml>) |
| 411062026014.xml | [oigusaktid/411062026014.xml](<oigusaktid/411062026014.xml>) |
| 411062026015.xml | [oigusaktid/411062026015.xml](<oigusaktid/411062026015.xml>) |
| 411122015006.xml | [oigusaktid/411122015006.xml](<oigusaktid/411122015006.xml>) |
| 424032026005.xml | [oigusaktid/424032026005.xml](<oigusaktid/424032026005.xml>) |
| 426022021006.xml | [oigusaktid/426022021006.xml](<oigusaktid/426022021006.xml>) |
| 426022026039.xml | [oigusaktid/426022026039.xml](<oigusaktid/426022026039.xml>) |
| 428122024034.xml | [oigusaktid/428122024034.xml](<oigusaktid/428122024034.xml>) |
| 429012026053.xml | [oigusaktid/429012026053.xml](<oigusaktid/429012026053.xml>) |
| 429032016271.xml | [oigusaktid/429032016271.xml](<oigusaktid/429032016271.xml>) |
| 430012026034.xml | [oigusaktid/430012026034.xml](<oigusaktid/430012026034.xml>) |
| 403102026022.xml | [oigusaktid/403102026022.xml](<oigusaktid/403102026022.xml>) |
| 103072026024.xml | [oigusaktid/103072026024.xml](<oigusaktid/103072026024.xml>) |
| 130062026020.xml | [oigusaktid/130062026020.xml](<oigusaktid/130062026020.xml>) |
| 130062026021.xml | [oigusaktid/130062026021.xml](<oigusaktid/130062026021.xml>) |
| 103062026067.xml | [oigusaktid/103062026067.xml](<oigusaktid/103062026067.xml>) |
| 103072026006.xml | [oigusaktid/103072026006.xml](<oigusaktid/103072026006.xml>) |
| 103072026035.xml | [oigusaktid/103072026035.xml](<oigusaktid/103072026035.xml>) |
| 109072026017.xml | [oigusaktid/109072026017.xml](<oigusaktid/109072026017.xml>) |
| 109072026028.xml | [oigusaktid/109072026028.xml](<oigusaktid/109072026028.xml>) |
| 109072026046.xml | [oigusaktid/109072026046.xml](<oigusaktid/109072026046.xml>) |
| 111072026059.xml | [oigusaktid/111072026059.xml](<oigusaktid/111072026059.xml>) |
| 111072026061.xml | [oigusaktid/111072026061.xml](<oigusaktid/111072026061.xml>) |
| 111072026066.xml | [oigusaktid/111072026066.xml](<oigusaktid/111072026066.xml>) |
| 111072026097.xml | [oigusaktid/111072026097.xml](<oigusaktid/111072026097.xml>) |
| 114032025014.xml | [oigusaktid/114032025014.xml](<oigusaktid/114032025014.xml>) |
| 114032025019.xml | [oigusaktid/114032025019.xml](<oigusaktid/114032025019.xml>) |
| 114032025025.xml | [oigusaktid/114032025025.xml](<oigusaktid/114032025025.xml>) |
| 120062026021.xml | [oigusaktid/120062026021.xml](<oigusaktid/120062026021.xml>) |
| 130062026001.xml | [oigusaktid/130062026001.xml](<oigusaktid/130062026001.xml>) |
| 130062026009.xml | [oigusaktid/130062026009.xml](<oigusaktid/130062026009.xml>) |
| 130062026028.xml | [oigusaktid/130062026028.xml](<oigusaktid/130062026028.xml>) |
| 130062026034.xml | [oigusaktid/130062026034.xml](<oigusaktid/130062026034.xml>) |
| 130062026038.xml | [oigusaktid/130062026038.xml](<oigusaktid/130062026038.xml>) |
| 130062026040.xml | [oigusaktid/130062026040.xml](<oigusaktid/130062026040.xml>) |
| 130062026052.xml | [oigusaktid/130062026052.xml](<oigusaktid/130062026052.xml>) |
| 130062026102.xml | [oigusaktid/130062026102.xml](<oigusaktid/130062026102.xml>) |
| 130062026103.xml | [oigusaktid/130062026103.xml](<oigusaktid/130062026103.xml>) |
| 130062026132.xml | [oigusaktid/130062026132.xml](<oigusaktid/130062026132.xml>) |
| 131032022015.xml | [oigusaktid/131032022015.xml](<oigusaktid/131032022015.xml>) |
| 131122024024.xml | [oigusaktid/131122024024.xml](<oigusaktid/131122024024.xml>) |
| 131122024048.xml | [oigusaktid/131122024048.xml](<oigusaktid/131122024048.xml>) |
| 103062026035.xml | [oigusaktid/103062026035.xml](<oigusaktid/103062026035.xml>) |
| 109072026055.xml | [oigusaktid/109072026055.xml](<oigusaktid/109072026055.xml>) |
| 111072026078.xml | [oigusaktid/111072026078.xml](<oigusaktid/111072026078.xml>) |
| 103072026007.xml | [oigusaktid/103072026007.xml](<oigusaktid/103072026007.xml>) |
| 103072026008.xml | [oigusaktid/103072026008.xml](<oigusaktid/103072026008.xml>) |
| 103072026036.xml | [oigusaktid/103072026036.xml](<oigusaktid/103072026036.xml>) |
| 109072026018.xml | [oigusaktid/109072026018.xml](<oigusaktid/109072026018.xml>) |
| 109072026029.xml | [oigusaktid/109072026029.xml](<oigusaktid/109072026029.xml>) |
| 109072026077.xml | [oigusaktid/109072026077.xml](<oigusaktid/109072026077.xml>) |
| 111072026062.xml | [oigusaktid/111072026062.xml](<oigusaktid/111072026062.xml>) |
| 111072026067.xml | [oigusaktid/111072026067.xml](<oigusaktid/111072026067.xml>) |
| 111072026079.xml | [oigusaktid/111072026079.xml](<oigusaktid/111072026079.xml>) |
| 111072026080.xml | [oigusaktid/111072026080.xml](<oigusaktid/111072026080.xml>) |
| 111072026090.xml | [oigusaktid/111072026090.xml](<oigusaktid/111072026090.xml>) |
| 111072026091.xml | [oigusaktid/111072026091.xml](<oigusaktid/111072026091.xml>) |
| 111072026098.xml | [oigusaktid/111072026098.xml](<oigusaktid/111072026098.xml>) |
| 111072026099.xml | [oigusaktid/111072026099.xml](<oigusaktid/111072026099.xml>) |
| 111072026102.xml | [oigusaktid/111072026102.xml](<oigusaktid/111072026102.xml>) |
| 111072026103.xml | [oigusaktid/111072026103.xml](<oigusaktid/111072026103.xml>) |
| 111072026145.xml | [oigusaktid/111072026145.xml](<oigusaktid/111072026145.xml>) |
| 111072026146.xml | [oigusaktid/111072026146.xml](<oigusaktid/111072026146.xml>) |
| 111072026160.xml | [oigusaktid/111072026160.xml](<oigusaktid/111072026160.xml>) |
| 130062026010.xml | [oigusaktid/130062026010.xml](<oigusaktid/130062026010.xml>) |
| 130062026029.xml | [oigusaktid/130062026029.xml](<oigusaktid/130062026029.xml>) |
| 130062026035.xml | [oigusaktid/130062026035.xml](<oigusaktid/130062026035.xml>) |
| 130062026039.xml | [oigusaktid/130062026039.xml](<oigusaktid/130062026039.xml>) |
| 130062026041.xml | [oigusaktid/130062026041.xml](<oigusaktid/130062026041.xml>) |
| 130062026133.xml | [oigusaktid/130062026133.xml](<oigusaktid/130062026133.xml>) |
| 408102026010.xml | [oigusaktid/408102026010.xml](<oigusaktid/408102026010.xml>) |
| 111072026158.xml | [oigusaktid/111072026158.xml](<oigusaktid/111072026158.xml>) |
| 120062026018.xml | [oigusaktid/120062026018.xml](<oigusaktid/120062026018.xml>) |
| 403072026003.xml | [oigusaktid/403072026003.xml](<oigusaktid/403072026003.xml>) |
| 130062026065.xml | [oigusaktid/130062026065.xml](<oigusaktid/130062026065.xml>) |
| 106072023031.xml | [oigusaktid/106072023031.xml](<oigusaktid/106072023031.xml>) |
| 410092025031.xml | [oigusaktid/410092025031.xml](<oigusaktid/410092025031.xml>) |
| 410092025033.xml | [oigusaktid/410092025033.xml](<oigusaktid/410092025033.xml>) |
| 412042025015.xml | [oigusaktid/412042025015.xml](<oigusaktid/412042025015.xml>) |
| 413022026026.xml | [oigusaktid/413022026026.xml](<oigusaktid/413022026026.xml>) |
| 425042025047.xml | [oigusaktid/425042025047.xml](<oigusaktid/425042025047.xml>) |
| 426022025038.xml | [oigusaktid/426022025038.xml](<oigusaktid/426022025038.xml>) |
| 428122024033.xml | [oigusaktid/428122024033.xml](<oigusaktid/428122024033.xml>) |
| 107052025017-0c660ae84a.xml | [oigusaktid/107052025017-0c660ae84a.xml](<oigusaktid/107052025017-0c660ae84a.xml>) |
| 109042026003-c32621b97f.xml | [oigusaktid/109042026003-c32621b97f.xml](<oigusaktid/109042026003-c32621b97f.xml>) |
| 129082025009-2df81da69b.xml | [oigusaktid/129082025009-2df81da69b.xml](<oigusaktid/129082025009-2df81da69b.xml>) |
| 130122025036-cb751d4e16.xml | [oigusaktid/130122025036-cb751d4e16.xml](<oigusaktid/130122025036-cb751d4e16.xml>) |
| 131122024023-ebfb6d1124.xml | [oigusaktid/131122024023-ebfb6d1124.xml](<oigusaktid/131122024023-ebfb6d1124.xml>) |
| 410092025031-4add815064.xml | [oigusaktid/410092025031-4add815064.xml](<oigusaktid/410092025031-4add815064.xml>) |
| 410092025033-4e1a686799.xml | [oigusaktid/410092025033-4e1a686799.xml](<oigusaktid/410092025033-4e1a686799.xml>) |
| 412042025007-d607c4383a.xml | [oigusaktid/412042025007-d607c4383a.xml](<oigusaktid/412042025007-d607c4383a.xml>) |
| 412042025015-cc7e755330.xml | [oigusaktid/412042025015-cc7e755330.xml](<oigusaktid/412042025015-cc7e755330.xml>) |
| 413022026026-16d4366028.xml | [oigusaktid/413022026026-16d4366028.xml](<oigusaktid/413022026026-16d4366028.xml>) |
| 425042025047-0a444c65d3.xml | [oigusaktid/425042025047-0a444c65d3.xml](<oigusaktid/425042025047-0a444c65d3.xml>) |
| 426022025038-f9529b7eb7.xml | [oigusaktid/426022025038-f9529b7eb7.xml](<oigusaktid/426022025038-f9529b7eb7.xml>) |
| 428122024033-efb23621fc.xml | [oigusaktid/428122024033-efb23621fc.xml](<oigusaktid/428122024033-efb23621fc.xml>) |
| Sotsiaalhoolekande seadus | [taastatud_allikad/national-rt-130122025029.json](<taastatud_allikad/national-rt-130122025029.json>) |
| Isikliku abistaja teenus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_service_isikliku_abistaja_teenus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_service_isikliku_abistaja_teenus.json>) |
| Puudega inimese sõiduki parkimiskaardi väljastamine | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_service_parkimiskaardi_valjastamine.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_service_parkimiskaardi_valjastamine.json>) |
| Raske ja sügava puudega laste toetavad teenused | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_benefit_raske_ja_sugava_puudega_laste_teenuste_toetus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_benefit_raske_ja_sugava_puudega_laste_teenuste_toetus.json>) |
| Abivahendite taotlemise info | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_resource_abivahendite_info.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_resource_abivahendite_info.json>) |
| Olga Jevdokimova | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_olga_jevdokimova.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_olga_jevdokimova.json>) |
| Karina Neimla-Nikiforova | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_karina_neimla_nikiforova.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_karina_neimla_nikiforova.json>) |
| Natalja Fjodorova | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_natalja_fjodorova.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_natalja_fjodorova.json>) |
| Marina Keizo | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_marina_keizo.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_marina_keizo.json>) |
| Jelena Afonova | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_jelena_afonova.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_jelena_afonova.json>) |
| Jekaterina Djomina | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_jekaterina_djomina.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_jekaterina_djomina.json>) |
| Tatjana Chaus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_tatjana_chaus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_tatjana_chaus.json>) |
| Viktoria Danilova | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_viktoria_danilova.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_viktoria_danilova.json>) |
| Natalja Tuulik | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_natalja_tuulik.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_contact_natalja_tuulik.json>) |
| Sotsiaalteenuse taotlus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_sotsiaalteenuse_taotlus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_sotsiaalteenuse_taotlus.json>) |
| Koduteenuse taotluse vorm | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_koduteenuse_taotlus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_koduteenuse_taotlus.json>) |
| Eluruumi teenuse taotlus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_eluruumi_teenuse_taotlus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_eluruumi_teenuse_taotlus.json>) |
| Eestkoste seadmise taotlus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_eestkoste_taotlus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_eestkoste_taotlus.json>) |
| Taotlus raske ja sügava puudega lapsele teenuse osutamiseks | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_raske_sugava_puudega_lapse_teenuse_taotlus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_raske_sugava_puudega_lapse_teenuse_taotlus.json>) |
| Sünnitoetuse avaldus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_sunnitoetuse_avaldus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_sunnitoetuse_avaldus.json>) |
| Lapsehoiutoetuse taotlus | [taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_lapsehoiutoetuse_taotlus.json](<taastatud_allikad/kov__maardu-linn__item__maardu_linn_form_lapsehoiutoetuse_taotlus.json>) |
| Tallinna linn sotsiaalteenused ja toetused | [taastatud_allikad/kov-tallinn.json](<taastatud_allikad/kov-tallinn.json>) |
| Kaebus isikuandmete kaitse asjas | [veebilehed/andmekaitse-inspektsioon/andmekaitse_inspektsioon_aki_kaebus_isikuandmete_kaitse_asjas.html](<veebilehed/andmekaitse-inspektsioon/andmekaitse_inspektsioon_aki_kaebus_isikuandmete_kaitse_asjas.html>) |
| Nõusolek | [veebilehed/andmekaitse-inspektsioon/andmekaitse_inspektsioon_aki_nousolek.html](<veebilehed/andmekaitse-inspektsioon/andmekaitse_inspektsioon_aki_nousolek.html>) |
| Dokumentide esitamise nõuded | [veebilehed/eesti-kohtud/kohus_dokumendid_ja_vormid_dokumentide_esitamise_nouded.html](<veebilehed/eesti-kohtud/kohus_dokumendid_ja_vormid_dokumentide_esitamise_nouded.html>) |
| Dokumendid ja vormid | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_dokumendid_ja_vormid.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_dokumendid_ja_vormid.html>) |
| Halduskohtumenetlus | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_halduskohtumenetlus.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_halduskohtumenetlus.html>) |
| Kriminaalmenetlus | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_kriminaalmenetlus.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_kriminaalmenetlus.html>) |
| Kuidas kohtuga ühendust võtta? | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_kuidas_kohtuga_uhendust_votta.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_kuidas_kohtuga_uhendust_votta.html>) |
| Meelespea kohtumajja saabudes | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_meelespea_kohtumajja_saabudes.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_meelespea_kohtumajja_saabudes.html>) |
| Menetluskulud ja menetlusabi | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_menetluskulud_ja_menetlusabi.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_menetluskulud_ja_menetlusabi.html>) |
| Millega erinevad kohtud tegelevad? | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_millega_erinevad_kohtud_tegelevad.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_millega_erinevad_kohtud_tegelevad.html>) |
| Sõnaseletusraamat | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_sonaseletusraamat.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_sonaseletusraamat.html>) |
| Tsiviilkohtumenetlus | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_tsiviilkohtumenetlus.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_tsiviilkohtumenetlus.html>) |
| Väärteomenetlus | [veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_vaarteomenetlus.html](<veebilehed/eesti-kohtud/kohus_kohtusse_poordujale_vaarteomenetlus.html>) |
| Info kannatanule | [veebilehed/eesti-kohtud/kohus_kriminaalmenetlus_info_kannatanule.html](<veebilehed/eesti-kohtud/kohus_kriminaalmenetlus_info_kannatanule.html>) |
| Info tunnistajale | [veebilehed/eesti-kohtud/kohus_kriminaalmenetlus_info_tunnistajale.html](<veebilehed/eesti-kohtud/kohus_kriminaalmenetlus_info_tunnistajale.html>) |
| Riigilõivu tasumine ja tagastamine | [veebilehed/eesti-kohtud/kohus_menetluskulud_ja_menetlusabi_riigiloivu_tasumine_ja_tagastamine.html](<veebilehed/eesti-kohtud/kohus_menetluskulud_ja_menetlusabi_riigiloivu_tasumine_ja_tagastamine.html>) |
| Maksekäsu kiirmenetlus | [veebilehed/eesti-kohtud/kohus_tsiviilkohtumenetlus_maksekasu_kiirmenetlus.html](<veebilehed/eesti-kohtud/kohus_tsiviilkohtumenetlus_maksekasu_kiirmenetlus.html>) |
| Veebikeskkondade ja e-teenuste ligipääsetavus | [veebilehed/eesti-puuetega-inimeste-koda/eesti_puuetega_inimeste_koda_epikoda_digiligipaasetavus.html](<veebilehed/eesti-puuetega-inimeste-koda/eesti_puuetega_inimeste_koda_epikoda_digiligipaasetavus.html>) |
| Kooliväline nõustamismeeskond | [veebilehed/haridus-ja-noorteamet-rajaleidja/rajaleidja_kvm.html](<veebilehed/haridus-ja-noorteamet-rajaleidja/rajaleidja_kvm.html>) |
| Eesti lasteaedade ja koolide toimimine ja põhimõtted | [veebilehed/haridus-ja-noorteamet/harno_eesti_lasteaedade_ja_koolide_toimimine_ja_pohimotted.html](<veebilehed/haridus-ja-noorteamet/harno_eesti_lasteaedade_ja_koolide_toimimine_ja_pohimotted.html>) |
| Kaasav haridus | [veebilehed/haridus-ja-noorteamet/harno_kaasav_haridus.html](<veebilehed/haridus-ja-noorteamet/harno_kaasav_haridus.html>) |
| Lapsevanema tugi lapsele | [veebilehed/haridus-ja-noorteamet/harno_lapsevanema_tugi_lapsele.html](<veebilehed/haridus-ja-noorteamet/harno_lapsevanema_tugi_lapsele.html>) |
| Alusharidus | [veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_alusharidus.html](<veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_alusharidus.html>) |
| Õppimiskohustus | [veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_oppimiskohustus.html](<veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_oppimiskohustus.html>) |
| Põhiharidus | [veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_pohiharidus.html](<veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_pohiharidus.html>) |
| Toe vajadusega õpilased: õppekorraldus ja tugiteenused | [veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_toe_vajadusega_opilased.html](<veebilehed/haridus-ja-teadusministeerium/hm_alus_pohi_ja_keskharidus_toe_vajadusega_opilased.html>) |
| Advokaat | [veebilehed/justiits-ja-digiministeerium/just_elukutsed_advokaat.html](<veebilehed/justiits-ja-digiministeerium/just_elukutsed_advokaat.html>) |
| Kohtutäitur | [veebilehed/justiits-ja-digiministeerium/just_elukutsed_kohtutaitur.html](<veebilehed/justiits-ja-digiministeerium/just_elukutsed_kohtutaitur.html>) |
| Notar | [veebilehed/justiits-ja-digiministeerium/just_elukutsed_notar.html](<veebilehed/justiits-ja-digiministeerium/just_elukutsed_notar.html>) |
| Pankrotihaldur | [veebilehed/justiits-ja-digiministeerium/just_elukutsed_pankrotihaldur.html](<veebilehed/justiits-ja-digiministeerium/just_elukutsed_pankrotihaldur.html>) |
| Andmekaitse ja isikuandmete vastutustundliku töötlemise põhimõtted | [veebilehed/justiits-ja-digiministeerium/just_haldusoigus_andmekaitse.html](<veebilehed/justiits-ja-digiministeerium/just_haldusoigus_andmekaitse.html>) |
| Avalik teave | [veebilehed/justiits-ja-digiministeerium/just_haldusoigus_avalik_teave.html](<veebilehed/justiits-ja-digiministeerium/just_haldusoigus_avalik_teave.html>) |
| Halduskorraldus- ja menetlus | [veebilehed/justiits-ja-digiministeerium/just_haldusoigus_halduskorraldus_ja_menetlus.html](<veebilehed/justiits-ja-digiministeerium/just_haldusoigus_halduskorraldus_ja_menetlus.html>) |
| Alternatiivkaristused | [veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_alternatiivkaristused.html](<veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_alternatiivkaristused.html>) |
| Inimkaubandus | [veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_inimkaubandus.html](<veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_inimkaubandus.html>) |
| Perevägivald | [veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_perevagivald.html](<veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_perevagivald.html>) |
| Seksuaalne väärkohtlemine | [veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_seksuaalne_vaarkohtlemine.html](<veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_seksuaalne_vaarkohtlemine.html>) |
| Vangla ja kriminaalhooldus | [veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_vangla_ja_kriminaalhooldus.html](<veebilehed/justiits-ja-digiministeerium/just_kuritegevus_ja_selle_ennetus_vangla_ja_kriminaalhooldus.html>) |
| Lapsesõbralik menetlus | [veebilehed/justiits-ja-digiministeerium/just_lapsed_ja_noored_lapsesobralik_menetlus.html](<veebilehed/justiits-ja-digiministeerium/just_lapsed_ja_noored_lapsesobralik_menetlus.html>) |
| Nooresõbralik õigussüsteem | [veebilehed/justiits-ja-digiministeerium/just_lapsed_ja_noored_nooresobralik_oigussusteem.html](<veebilehed/justiits-ja-digiministeerium/just_lapsed_ja_noored_nooresobralik_oigussusteem.html>) |
| Maksejõuetus | [veebilehed/justiits-ja-digiministeerium/just_maksejouetus.html](<veebilehed/justiits-ja-digiministeerium/just_maksejouetus.html>) |
| Taastav õigus | [veebilehed/justiits-ja-digiministeerium/just_ohvrite_toetamine_kahjude_heastamine_ja_taastav_oigus.html](<veebilehed/justiits-ja-digiministeerium/just_ohvrite_toetamine_kahjude_heastamine_ja_taastav_oigus.html>) |
| Kuriteoohvrite õigused | [veebilehed/justiits-ja-digiministeerium/just_ohvrite_toetamine_kuriteoohvrite_oigused.html](<veebilehed/justiits-ja-digiministeerium/just_ohvrite_toetamine_kuriteoohvrite_oigused.html>) |
| Lähenemiskeeld | [veebilehed/justiits-ja-digiministeerium/just_ohvrite_toetamine_lahenemiskeeld.html](<veebilehed/justiits-ja-digiministeerium/just_ohvrite_toetamine_lahenemiskeeld.html>) |
| Õigusnõu erivajadustega inimestele | [veebilehed/justiits-ja-digiministeerium/just_oigusabi_oigusnou_erivajadustega_inimestele.html](<veebilehed/justiits-ja-digiministeerium/just_oigusabi_oigusnou_erivajadustega_inimestele.html>) |
| Õigusabi | [veebilehed/justiits-ja-digiministeerium/just_oigusabi_riigi_toetatud_oigusabi.html](<veebilehed/justiits-ja-digiministeerium/just_oigusabi_riigi_toetatud_oigusabi.html>) |
| Tasuta õigusnõu eakatele | [veebilehed/justiits-ja-digiministeerium/just_oigusabi_tasuta_oigusnou_eakatele.html](<veebilehed/justiits-ja-digiministeerium/just_oigusabi_tasuta_oigusnou_eakatele.html>) |
| Pärimisregister | [veebilehed/justiits-ja-digiministeerium/just_registrid_parimisregister.html](<veebilehed/justiits-ja-digiministeerium/just_registrid_parimisregister.html>) |
| Täitmisregister | [veebilehed/justiits-ja-digiministeerium/just_registrid_taitmisregister.html](<veebilehed/justiits-ja-digiministeerium/just_registrid_taitmisregister.html>) |
| Täitemenetlus | [veebilehed/justiits-ja-digiministeerium/just_tsiviilmenetlus_taitemenetlus.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviilmenetlus_taitemenetlus.html>) |
| Tsiviilkohtumenetlus | [veebilehed/justiits-ja-digiministeerium/just_tsiviilmenetlus_tsiviilkohtumenetlus.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviilmenetlus_tsiviilkohtumenetlus.html>) |
| Miinimumelatis | [veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_miinimumelatise_muutmine.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_miinimumelatise_muutmine.html>) |
| Pärimisõigus | [veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_parimisoigus.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_parimisoigus.html>) |
| Perekonnaõigus | [veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_perekonnaoigus.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_perekonnaoigus.html>) |
| Tsiviilõiguse üldalused | [veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_tsiviiloiguse_uldalused.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_tsiviiloiguse_uldalused.html>) |
| Võlaõigus | [veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_volaoigus.html](<veebilehed/justiits-ja-digiministeerium/just_tsiviiloigus_volaoigus.html>) |
| Elatisevõlgnik ja pankrotimenetlus | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_elatisevolgnik_ja_pankrotimenetlus.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_elatisevolgnik_ja_pankrotimenetlus.html>) |
| Elatisabi taotlemine | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_elatisvolgnevused_elatisabi_taotlemine.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_elatisvolgnevused_elatisabi_taotlemine.html>) |
| KKK | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kkk.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kkk.html>) |
| Elatise nõudmine | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_elatisvolgnevused.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_elatisvolgnevused.html>) |
| Kaebuse esitamine | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_kaebuse_esitamine.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_kaebuse_esitamine.html>) |
| Nõuete aegumisest | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_nouete_aegumisest.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_nouete_aegumisest.html>) |
| Täitemenetlusest | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_taitemenetlusest.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_taitemenetlusest.html>) |
| Töötasu arestimise skeem | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_tootasu_arestimise_skeem.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kohtutaiturid_tootasu_arestimise_skeem.html>) |
| Kuidas elatisenõuet täitmisele esitada | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kuidas_elatisenouet_taitmisele_esitada.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_kuidas_elatisenouet_taitmisele_esitada.html>) |
| Mida kujutab endast pärandvara pankrot? | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_mida_kujutab_endast_parandvara_pankrot.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_mida_kujutab_endast_parandvara_pankrot.html>) |
| Hüvitised töötajatele | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_pankrotihaldurid_huvitised_tootajatele.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_pankrotihaldurid_huvitised_tootajatele.html>) |
| Suhtluskordade praktikast | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_suhtluskordade_praktika.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_suhtluskordade_praktika.html>) |
| Täite- ja pankrotimenetluse aegsest elatisabist | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_taite_ja_pankrotimenetluse_aegsest_elatisabist.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_taite_ja_pankrotimenetluse_aegsest_elatisabist.html>) |
| Kohtutäituri tasud | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_tasud.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_tasud.html>) |
| Töötaja võimalused töötasu sissenõudmiseks püsivalt maksejõuetult ühingult | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_tootaja_voimalused_tootasu_sissenoudmiseks_pusivalt_maksejouetult_uhingult.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_tootaja_voimalused_tootasu_sissenoudmiseks_pusivalt_maksejouetult_uhingult.html>) |
| Usaldusisiku roll füüsilise isiku maksejõuetus-menetluses | [veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_usaldusisiku_roll_fuusilise_isiku_maksejouetusmenetluses.html](<veebilehed/kohtutaiturite-ja-pankrotihaldurite-koda/kpk_usaldusisiku_roll_fuusilise_isiku_maksejouetusmenetluses.html>) |
| Ametitoimingud – notariaalsed teenused ühes kohas | [veebilehed/notarite-koda/notar_ametitoimingud.html](<veebilehed/notarite-koda/notar_ametitoimingud.html>) |
| Kaugtõestamine | [veebilehed/notarite-koda/notar_ametitoimingud_kaugtoestamine.html](<veebilehed/notarite-koda/notar_ametitoimingud_kaugtoestamine.html>) |
| Kinnisvaratoimingud | [veebilehed/notarite-koda/notar_ametitoimingud_kinnisvaratoimingud.html](<veebilehed/notarite-koda/notar_ametitoimingud_kinnisvaratoimingud.html>) |
| Notari tasu arvestamine | [veebilehed/notarite-koda/notar_ametitoimingud_notari_tasu_arvestamine.html](<veebilehed/notarite-koda/notar_ametitoimingud_notari_tasu_arvestamine.html>) |
| Pärimistoimingud | [veebilehed/notarite-koda/notar_ametitoimingud_parimistoimingud.html](<veebilehed/notarite-koda/notar_ametitoimingud_parimistoimingud.html>) |
| Perekonnaõiguslikud toimingud | [veebilehed/notarite-koda/notar_ametitoimingud_perekonnaoiguslikud_toimingud.html](<veebilehed/notarite-koda/notar_ametitoimingud_perekonnaoiguslikud_toimingud.html>) |
| Abieluvararegister | [veebilehed/notarite-koda/notar_registrid_abieluvararegister.html](<veebilehed/notarite-koda/notar_registrid_abieluvararegister.html>) |
| Pärimisregister | [veebilehed/notarite-koda/notar_registrid_parimisregister.html](<veebilehed/notarite-koda/notar_registrid_parimisregister.html>) |
| Lisainfo | [veebilehed/notarite-koda/parimine_lisainfo.html](<veebilehed/notarite-koda/parimine_lisainfo.html>) |
| Notaritasud | [veebilehed/notarite-koda/parimine_notaritasud.html](<veebilehed/notarite-koda/parimine_notaritasud.html>) |
| Pärandamine | [veebilehed/notarite-koda/parimine_parandamine.html](<veebilehed/notarite-koda/parimine_parandamine.html>) |
| Pärandamine | [veebilehed/notarite-koda/parimine_parandamine_esemete_parandamine.html](<veebilehed/notarite-koda/parimine_parandamine_esemete_parandamine.html>) |
| Pärandamine | [veebilehed/notarite-koda/parimine_parandamine_testament_parimisleping.html](<veebilehed/notarite-koda/parimine_parandamine_testament_parimisleping.html>) |
| Pärimine | [veebilehed/notarite-koda/parimine_parimine_kes_parib.html](<veebilehed/notarite-koda/parimine_parimine_kes_parib.html>) |
| Pärimine | [veebilehed/notarite-koda/parimine_parimine_mida_parib.html](<veebilehed/notarite-koda/parimine_parimine_mida_parib.html>) |
| Pärimine | [veebilehed/notarite-koda/parimine_parimine_parimise_protsess.html](<veebilehed/notarite-koda/parimine_parimine_parimise_protsess.html>) |
| Avaldus õiguskantslerile | [veebilehed/oiguskantsler/oiguskantsler_avaldus_oiguskantslerile.html](<veebilehed/oiguskantsler/oiguskantsler_avaldus_oiguskantslerile.html>) |
| Tuleohutusnõuded | [veebilehed/paasteamet/paasteamet_paasteamet_tuleohutusnouded.html](<veebilehed/paasteamet/paasteamet_paasteamet_tuleohutusnouded.html>) |
| Eksinud ja teadmata kadunud | [veebilehed/politsei-ja-piirivalveamet/ppa_eksinud_ja_teadmata_kadunud_loodusesse_minnes.html](<veebilehed/politsei-ja-piirivalveamet/ppa_eksinud_ja_teadmata_kadunud_loodusesse_minnes.html>) |
| Eksinud ja teadmata kadunud | [veebilehed/politsei-ja-piirivalveamet/ppa_eksinud_ja_teadmata_kadunud_politseitoo_abivajajate_otsingutel.html](<veebilehed/politsei-ja-piirivalveamet/ppa_eksinud_ja_teadmata_kadunud_politseitoo_abivajajate_otsingutel.html>) |
| Eksinud ja teadmata kadunud | [veebilehed/politsei-ja-piirivalveamet/ppa_eksinud_ja_teadmata_kadunud_vabatahtlike_kaasamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_eksinud_ja_teadmata_kadunud_vabatahtlike_kaasamine.html>) |
| Politseile süüteo avalduse esitamine | [veebilehed/politsei-ja-piirivalveamet/ppa_et_avaldus_politseile.html](<veebilehed/politsei-ja-piirivalveamet/ppa_et_avaldus_politseile.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ajutine_kaitse_ukraina_kodanikele_ja_nende_pereliikmetele.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ajutine_kaitse_ukraina_kodanikele_ja_nende_pereliikmetele.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ajutise_kaitse_pikendamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ajutise_kaitse_pikendamine.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_olukord_piiril.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_olukord_piiril.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_politsei_kodulehel_vaheneb_venekeelne_sisu.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_politsei_kodulehel_vaheneb_venekeelne_sisu.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_rahvusvahelise_kaitse_pikendamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_rahvusvahelise_kaitse_pikendamine.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_rahvusvahelise_kaitse_taotlemine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_rahvusvahelise_kaitse_taotlemine.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ukraina_kodanike_viibimisoiguse_ajutine_pikendamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ukraina_kodanike_viibimisoiguse_ajutine_pikendamine.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ukraina_sojapogenike_eestis_olemise_voimalused.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_ukraina_sojapogenike_eestis_olemise_voimalused.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_venemaa_ei_luba_ukraina_kodanikel_siseneda_venemaale.html](<veebilehed/politsei-ja-piirivalveamet/ppa_info_seoses_ukraina_sojaga_venemaa_ei_luba_ukraina_kodanikel_siseneda_venemaale.html>) |
| Isikut tõendava dokumendi taotlemine liikumisvõimetule inimesele | [veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_kattesaamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_kattesaamine.html>) |
| Isikut tõendava dokumendi taotlemine liikumisvõimetule inimesele | [veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumis_ja_allkirjavoimetule_inimese_dok.html](<veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumis_ja_allkirjavoimetule_inimese_dok.html>) |
| Isikut tõendava dokumendi taotlemine liikumisvõimetule inimesele | [veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumisvoimetule_inimesele_elamisloakaar.html](<veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumisvoimetule_inimesele_elamisloakaar.html>) |
| Isikut tõendava dokumendi taotlemine liikumisvõimetule inimesele | [veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumisvoimetule_inimesele_id_kaardi_tao.html](<veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumisvoimetule_inimesele_id_kaardi_tao.html>) |
| Isikut tõendava dokumendi taotlemine liikumisvõimetule inimesele | [veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumisvoimetule_inimesele_pin_koodide_t.html](<veebilehed/politsei-ja-piirivalveamet/ppa_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele_liikumisvoimetule_inimesele_pin_koodide_t.html>) |
| Eksinud ja teadmata kadunud | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_eksinud_ja_teadmata_kadunud.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_eksinud_ja_teadmata_kadunud.html>) |
| Info seoses sõjaga Ukrainas | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_info_seoses_ukraina_sojaga.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_info_seoses_ukraina_sojaga.html>) |
| Isikut tõendava dokumendi taotlemine liikumisvõimetule inimesele | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_isikut_toendava_dokumendi_taotlemine_liikumisvoimetule_inimesele.html>) |
| Kaitse ennast kelmide eest | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_kaitse_ennast_kelmide_eest.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_kaitse_ennast_kelmide_eest.html>) |
| Laste seksuaalne väärkohtlemine veebis | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_laste_seksuaalne_vaeaerkohtlemine_veebis.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_laste_seksuaalne_vaeaerkohtlemine_veebis.html>) |
| Politseile avalduse esitamine | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_politseile_avalduse_esitamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_politseile_avalduse_esitamine.html>) |
| Rahvusvaheline kaitse | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_rahvusvaheline_kaitse.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_rahvusvaheline_kaitse.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_juhend_taga_enda_ja_oma_laste_turvalisus.html](<veebilehed/politsei-ja-piirivalveamet/ppa_juhend_taga_enda_ja_oma_laste_turvalisus.html>) |
| Kaitse ennast kelmide eest | [veebilehed/politsei-ja-piirivalveamet/ppa_kaitse_ennast_kelmide_eest_kelmuse_tuubid_mis_eestis_tana_ringlevad.html](<veebilehed/politsei-ja-piirivalveamet/ppa_kaitse_ennast_kelmide_eest_kelmuse_tuubid_mis_eestis_tana_ringlevad.html>) |
| Kaitse ennast kelmide eest | [veebilehed/politsei-ja-piirivalveamet/ppa_kaitse_ennast_kelmide_eest_kuhu_poorduda.html](<veebilehed/politsei-ja-piirivalveamet/ppa_kaitse_ennast_kelmide_eest_kuhu_poorduda.html>) |
| Kaitse ennast kelmide eest | [veebilehed/politsei-ja-piirivalveamet/ppa_kaitse_ennast_kelmide_eest_teavita_petulehest.html](<veebilehed/politsei-ja-piirivalveamet/ppa_kaitse_ennast_kelmide_eest_teavita_petulehest.html>) |
| Laste seksuaalne väärkohtlemine veebis | [veebilehed/politsei-ja-piirivalveamet/ppa_laste_seksuaalne_vaeaerkohtlemine_veebis_digipadevuse_materjalid.html](<veebilehed/politsei-ja-piirivalveamet/ppa_laste_seksuaalne_vaeaerkohtlemine_veebis_digipadevuse_materjalid.html>) |
| Politseile avalduse esitamine | [veebilehed/politsei-ja-piirivalveamet/ppa_politseile_avalduse_esitamine_avalduse_esitamine_e_postiga.html](<veebilehed/politsei-ja-piirivalveamet/ppa_politseile_avalduse_esitamine_avalduse_esitamine_e_postiga.html>) |
| Politseile avalduse esitamine | [veebilehed/politsei-ja-piirivalveamet/ppa_politseile_avalduse_esitamine_avalduse_esitamine_postiga.html](<veebilehed/politsei-ja-piirivalveamet/ppa_politseile_avalduse_esitamine_avalduse_esitamine_postiga.html>) |
| Rahvusvaheline kaitse | [veebilehed/politsei-ja-piirivalveamet/ppa_rahvusvaheline_kaitse_elamisloa_pikendamine.html](<veebilehed/politsei-ja-piirivalveamet/ppa_rahvusvaheline_kaitse_elamisloa_pikendamine.html>) |
| Rahvusvaheline kaitse | [veebilehed/politsei-ja-piirivalveamet/ppa_rahvusvaheline_kaitse_kasulikud_kontaktid.html](<veebilehed/politsei-ja-piirivalveamet/ppa_rahvusvaheline_kaitse_kasulikud_kontaktid.html>) |
| Rahvusvaheline kaitse | [veebilehed/politsei-ja-piirivalveamet/ppa_rahvusvaheline_kaitse_kasulikud_materjalid.html](<veebilehed/politsei-ja-piirivalveamet/ppa_rahvusvaheline_kaitse_kasulikud_materjalid.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_autosoit.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_autosoit.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_digiturvalisus.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_digiturvalisus.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_kodus.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_kodus.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_kuidas_saab_noor_valtida_pahandustesse_sattumist.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_kuidas_saab_noor_valtida_pahandustesse_sattumist.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_nouanded_vanematele_laste_turvalisuse_tagamiseks.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_nouanded_vanematele_laste_turvalisuse_tagamiseks.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_ohutus_avalikus_kohas.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_ohutus_avalikus_kohas.html>) |
| Taga enda ja oma laste turvalisus | [veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_taksosoit_ja_uhistransport.html](<veebilehed/politsei-ja-piirivalveamet/ppa_taga_enda_ja_oma_laste_turvalisus_taksosoit_ja_uhistransport.html>) |
| Ahistav jälitamine | [veebilehed/sotsiaalkindlustusamet/palunabi_et_ahistav_jalitamine.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_ahistav_jalitamine.html>) |
| Emotsionaalne tugi | [veebilehed/sotsiaalkindlustusamet/palunabi_et_emotsionaalne_tugi.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_emotsionaalne_tugi.html>) |
| Inimkaubandus | [veebilehed/sotsiaalkindlustusamet/palunabi_et_inimkaubandus.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_inimkaubandus.html>) |
| Inimkaubandus | [veebilehed/sotsiaalkindlustusamet/palunabi_et_inimkaubandus_0.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_inimkaubandus_0.html>) |
| Kohtinguvägivald | [veebilehed/sotsiaalkindlustusamet/palunabi_et_kohtinguvagivald.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_kohtinguvagivald.html>) |
| Kriis | [veebilehed/sotsiaalkindlustusamet/palunabi_et_kriis.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_kriis.html>) |
| Kriisijuhtumid | [veebilehed/sotsiaalkindlustusamet/palunabi_et_kriisijuhtumid.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_kriisijuhtumid.html>) |
| Kuriteoohvri hüvitis | [veebilehed/sotsiaalkindlustusamet/palunabi_et_kuriteoohvri_huvitis.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_kuriteoohvri_huvitis.html>) |
| Lapse väärkohtlemine | [veebilehed/sotsiaalkindlustusamet/palunabi_et_lastevastane_vagivald.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_lastevastane_vagivald.html>) |
| Mis juhtus? | [veebilehed/sotsiaalkindlustusamet/palunabi_et_mis_juhtus.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_mis_juhtus.html>) |
| Naiste tugikeskused | [veebilehed/sotsiaalkindlustusamet/palunabi_et_naiste_tugikeskused.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_naiste_tugikeskused.html>) |
| Naistevastane vägivald | [veebilehed/sotsiaalkindlustusamet/palunabi_et_naistevastane_vagivald.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_naistevastane_vagivald.html>) |
| Ohvriabi | [veebilehed/sotsiaalkindlustusamet/palunabi_et_ohvriabi.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_ohvriabi.html>) |
| Ohvriabist | [veebilehed/sotsiaalkindlustusamet/palunabi_et_ohvriabist.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_ohvriabist.html>) |
| Perevägivald ja lähisuhtevägivald | [veebilehed/sotsiaalkindlustusamet/palunabi_et_perevagivald_ja_lahisuhtevagivald.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_perevagivald_ja_lahisuhtevagivald.html>) |
| Psühhosotsiaalne kriisiabi | [veebilehed/sotsiaalkindlustusamet/palunabi_et_psuhhosotsiaalne_kriisiabi.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_psuhhosotsiaalne_kriisiabi.html>) |
| Seksuaalne ahistamine ööelus | [veebilehed/sotsiaalkindlustusamet/palunabi_et_seksuaalne_ahistamine_ooelus.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_seksuaalne_ahistamine_ooelus.html>) |
| Seksuaalvägivald | [veebilehed/sotsiaalkindlustusamet/palunabi_et_seksuaalvagivald.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_seksuaalvagivald.html>) |
| Seksuaalvägivalla kriisiabi | [veebilehed/sotsiaalkindlustusamet/palunabi_et_seksuaalvagivalla_kriisiabi.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_seksuaalvagivalla_kriisiabi.html>) |
| Taastav õigus | [veebilehed/sotsiaalkindlustusamet/palunabi_et_taastav_oigus.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_taastav_oigus.html>) |
| Traumast taastumist toetav vaimse tervise abi | [veebilehed/sotsiaalkindlustusamet/palunabi_et_traumast_taastumist_toetav_vaimse_tervise_abi.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_traumast_taastumist_toetav_vaimse_tervise_abi.html>) |
| Vaenukuritegu | [veebilehed/sotsiaalkindlustusamet/palunabi_et_vaenukuritegu.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_vaenukuritegu.html>) |
| Vägivalla märkajale | [veebilehed/sotsiaalkindlustusamet/palunabi_et_vagivalla_pealtnagijale.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_vagivalla_pealtnagijale.html>) |
| Vägivallast loobumise toetamine | [veebilehed/sotsiaalkindlustusamet/palunabi_et_vagivallast_loobumise_toetamine.html](<veebilehed/sotsiaalkindlustusamet/palunabi_et_vagivallast_loobumise_toetamine.html>) |
| Rahvusvaheline kaitse | [veebilehed/sotsiaalkindlustusamet/ska_abi_pogenikule_rahvusvahelise_kaitse_taotlemine.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_pogenikule_rahvusvahelise_kaitse_taotlemine.html>) |
| Saatjata alaealised välismaalased | [veebilehed/sotsiaalkindlustusamet/ska_abi_pogenikule_saatjata_alaealised_valismaalased.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_pogenikule_saatjata_alaealised_valismaalased.html>) |
| Tõlketeenus rahvusvahelise ja ajutise kaitse saajale | [veebilehed/sotsiaalkindlustusamet/ska_abi_pogenikule_tolketeenus_rahvusvahelise_ja_ajutise_kaitse_saajale.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_pogenikule_tolketeenus_rahvusvahelise_ja_ajutise_kaitse_saajale.html>) |
| Kuriteoohvri hüvitis | [veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_kuriteoohvri_huvitis.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_kuriteoohvri_huvitis.html>) |
| Lähisuhtevägivald | [veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_lahisuhtevagivald.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_lahisuhtevagivald.html>) |
| Ohvriabi kriisitelefon 116 006 | [veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_ohvriabi_kriisitelefon_116006.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_ohvriabi_kriisitelefon_116006.html>) |
| Traumast taastumist toetav vaimse tervise abi | [veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_traumast_taastumist_toetav_vaimse_tervise_abi.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_traumast_taastumist_toetav_vaimse_tervise_abi.html>) |
| Tugi vägivallast loobumiseks | [veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_tugi_vagivallast_loobumiseks.html](<veebilehed/sotsiaalkindlustusamet/ska_abi_vagivalla_ohvrile_tugi_vagivallast_loobumiseks.html>) |
| Abi põgenikule | [veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_abi_pogenikule.html](<veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_abi_pogenikule.html>) |
| Abi vägivalla ohvritele | [veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_abi_vagivalla_ohvrile.html](<veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_abi_vagivalla_ohvrile.html>) |
| Asendushooldus ja kasuvanemlus | [veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_asendushooldus_ja_kasuvanemlus.html](<veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_asendushooldus_ja_kasuvanemlus.html>) |
| Laste ja perede abistamine | [veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_laste_ja_perede_abistamine.html](<veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_laste_ja_perede_abistamine.html>) |
| Vaimne tervis kriisis | [veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_vaimne_tervis_kriisis.html](<veebilehed/sotsiaalkindlustusamet/ska_abivajav_laps_ja_taiskasvanu_vaimne_tervis_kriisis.html>) |
| Abivõimalused seksuaalvägivalla üleelanule | [veebilehed/sotsiaalkindlustusamet/ska_abivoimalused_seksuaalvagivalla_uleelanule.html](<veebilehed/sotsiaalkindlustusamet/ska_abivoimalused_seksuaalvagivalla_uleelanule.html>) |
| Hoolduspere vanemaks saamine | [veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_hoolduspereks_saamine.html](<veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_hoolduspereks_saamine.html>) |
| Kasuperede toetamine | [veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_kasuperede_toetamine.html](<veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_kasuperede_toetamine.html>) |
| Lapsendamine | [veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_lapsendamine.html](<veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_lapsendamine.html>) |
| Lapsendatu päritoluandmete otsimine | [veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_lapsendatu_paritoluandmete_otsimine.html](<veebilehed/sotsiaalkindlustusamet/ska_asendushooldus_ja_kasuvanemlus_lapsendatu_paritoluandmete_otsimine.html>) |
| Erihoolekandeteenused | [veebilehed/sotsiaalkindlustusamet/ska_erihoolekanne_erihoolekandeteenused.html](<veebilehed/sotsiaalkindlustusamet/ska_erihoolekanne_erihoolekandeteenused.html>) |
| Isikukeskse erihoolekande teenusmudel kohalikus omavalitsuses | [veebilehed/sotsiaalkindlustusamet/ska_erihoolekanne_isikukeskse_erihoolekande_teenusmudel.html](<veebilehed/sotsiaalkindlustusamet/ska_erihoolekanne_isikukeskse_erihoolekande_teenusmudel.html>) |
| Inimkaubandus | [veebilehed/sotsiaalkindlustusamet/ska_inimkaubandus.html](<veebilehed/sotsiaalkindlustusamet/ska_inimkaubandus.html>) |
| Kui laps vajab rohkem tuge | [veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_kui_laps_vajab_rohkem_tuge.html](<veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_kui_laps_vajab_rohkem_tuge.html>) |
| Lapsevanemate toetamine | [veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_lapsevanemate_toetamine.html](<veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_lapsevanemate_toetamine.html>) |
| Lastemaja | [veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_lastemaja.html](<veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_lastemaja.html>) |
| Täisealise abivajaja toetamine | [veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_taisealise_abivajaja_toetamine.html](<veebilehed/sotsiaalkindlustusamet/ska_laste_ja_perede_abistamine_taisealise_abivajaja_toetamine.html>) |
| II samba pensionikindlustusmaksed ERGO ja SEB klientidele | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_ii_samba.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_ii_samba.html>) |
| Kahjuhüvitis | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_kahjuhuvitis_tooonnetuse.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_kahjuhuvitis_tooonnetuse.html>) |
| Olümpiavõitja toetus | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_olumpiavoitja_riiklik.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_olumpiavoitja_riiklik.html>) |
| Represseeritu toetus | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_represseeritu_toetused.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_represseeritu_toetused.html>) |
| Tagasipöörduja toetus | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_tagasipoorduja_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_tagasipoorduja_toetus.html>) |
| Sotsiaaltoetus Tšornobõli AEJ avarii likvideerijale | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_toetus_tsornoboli_aej.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_toetus_tsornoboli_aej.html>) |
| Üksi elava pensionäri toetus | [veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_uksi_elava_pensionari.html](<veebilehed/sotsiaalkindlustusamet/ska_muud_pensioniga_seotud_huvitised_ja_toetused_uksi_elava_pensionari.html>) |
| Naiste tugikeskused | [veebilehed/sotsiaalkindlustusamet/ska_naiste_tugikeskused.html](<veebilehed/sotsiaalkindlustusamet/ska_naiste_tugikeskused.html>) |
| Ohvriabi | [veebilehed/sotsiaalkindlustusamet/ska_ohvriabi.html](<veebilehed/sotsiaalkindlustusamet/ska_ohvriabi.html>) |
| Ohvriabi lihtsas keeles | [veebilehed/sotsiaalkindlustusamet/ska_ohvriabi_lihtsas_keeles.html](<veebilehed/sotsiaalkindlustusamet/ska_ohvriabi_lihtsas_keeles.html>) |
| Muud pensioniga seotud hüvitised ja toetused | [veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_muud_pensioniga_seotud_huvitised_ja_toetused.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_muud_pensioniga_seotud_huvitised_ja_toetused.html>) |
| Pension välismaal ja välisriigi pension Eestis | [veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pension_valismaal_ja_valisriigi_pension_eestis.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pension_valismaal_ja_valisriigi_pension_eestis.html>) |
| Pensioni liigid | [veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pensioni_liigid.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pensioni_liigid.html>) |
| Pensioni suurus | [veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pensioni_suurus.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pensioni_suurus.html>) |
| Pensioniks valmistumine | [veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pensioniks_valmistumine.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_ja_seotud_huvitised_pensioniks_valmistumine.html>) |
| Elusolekutõend | [veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_elusolekutoend.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_elusolekutoend.html>) |
| Euroopa Liidu pensionid ja lepinguriigid | [veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_euroopa_liidu_pensionid.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_euroopa_liidu_pensionid.html>) |
| Pensioni maksmine välisriiki | [veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_pensioni_maksmine.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_pensioni_maksmine.html>) |
| Pensioni saamine välisriigist | [veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_pensioni_saamine.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_pensioni_saamine.html>) |
| Tõendite taotlemine | [veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_toendite_taotlemine.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_toendite_taotlemine.html>) |
| Välispensioni ja rahvapensioni määra vahe | [veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_valispensioni_ja.html](<veebilehed/sotsiaalkindlustusamet/ska_pension_valismaal_ja_valisriigi_pension_eestis_valispensioni_ja.html>) |
| Edasilükatud vanaduspension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_edasilukatud_vanaduspension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_edasilukatud_vanaduspension.html>) |
| Eripensionid, kutsealade ja ametikohtade sooduspensionid | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_eripensionid.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_eripensionid.html>) |
| Paindlik pension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_paindlik_pension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_paindlik_pension.html>) |
| Rahvapension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_rahvapension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_rahvapension.html>) |
| Soodustingimustel vanaduspension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_soodustingimustel_vanaduspension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_soodustingimustel_vanaduspension.html>) |
| Toitjakaotuspension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_toitjakaotuspension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_toitjakaotuspension.html>) |
| Vanaduspension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_vanaduspension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_liigid_vanaduspension.html>) |
| Laste kasvatamine ja pension | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_laste_kasvatamine_ja_pension.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_laste_kasvatamine_ja_pension.html>) |
| Pensioni indekseerimine ja ümberarvutamine | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensioni_indekseerimine_ja_umberarvutus.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensioni_indekseerimine_ja_umberarvutus.html>) |
| Pensioni suuruse arvutamine | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensioni_suuruse_arvutamine.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensioni_suuruse_arvutamine.html>) |
| Hüvitiste, toetuste ja pensionide tulumaksustamine | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensioni_tulumaksustamine.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensioni_tulumaksustamine.html>) |
| Pensionide, toetuste ja hüvitiste määrad | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensionide_toetuste_ja_huvitiste_maarad.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensionide_toetuste_ja_huvitiste_maarad.html>) |
| Pensionilisad | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensionilisad.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_pensionilisad.html>) |
| Töötamine pensioni saamise ajal | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_tootamine_pensioni_saamise_ajal.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_suurus_tootamine_pensioni_saamise_ajal.html>) |
| Pensioni peatamine ja jätkamine | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensioni_peatamine_ja_jatkamine.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensioni_peatamine_ja_jatkamine.html>) |
| Pensioniavalduse esitamine | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensioniavalduse_esitamine.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensioniavalduse_esitamine.html>) |
| Pensioniiga | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensioniiga.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensioniiga.html>) |
| Pensionistaaž | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensionistaaz.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensionistaaz.html>) |
| Pensionitunnistus | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensionitunnistus.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_pensionitunnistus.html>) |
| Pensioni taotlemisel vajalikud dokumendid | [veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_taotlemiseks_vajalikud_dokumendid.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioni_taotlemine_taotlemiseks_vajalikud_dokumendid.html>) |
| Eesti pensionisüsteem | [veebilehed/sotsiaalkindlustusamet/ska_pensioniks_valmistumine_eesti_pensionisusteem.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioniks_valmistumine_eesti_pensionisusteem.html>) |
| Pensioni planeerimine | [veebilehed/sotsiaalkindlustusamet/ska_pensioniks_valmistumine_pensioni_planeerimine.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioniks_valmistumine_pensioni_planeerimine.html>) |
| Tööraamat | [veebilehed/sotsiaalkindlustusamet/ska_pensioniks_valmistumine_tooraamatu_esitamine.html](<veebilehed/sotsiaalkindlustusamet/ska_pensioniks_valmistumine_tooraamatu_esitamine.html>) |
| Elatisabi | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_elatisabi.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_elatisabi.html>) |
| Lisapuhkepäevad | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_lisapuhkepaevad.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_lisapuhkepaevad.html>) |
| Perehüvitiste ülevaade | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_perehuvitiste_ulevaade.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_perehuvitiste_ulevaade.html>) |
| Perekondlikud olukorrad | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_perekondlikud_olukorrad.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_perekondlikud_olukorrad.html>) |
| Peretoetused | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_peretoetused.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_peretoetused.html>) |
| Sotsiaalkindlustus Euroopa Liidus | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_sotsiaalkindlustus_valismaal_ja_valismaalt_tulijatele.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_sotsiaalkindlustus_valismaal_ja_valismaalt_tulijatele.html>) |
| Toetused ja hüvitised Ukraina põgenikele | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_toetused_huvitised_ukraina_pogenikele.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitised_ja_muud_toetused_toetused_huvitised_ukraina_pogenikele.html>) |
| Ema vanemahüvitis ja emapuhkus | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_ema_vanemahuvitis_ja_emapuhkus.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_ema_vanemahuvitis_ja_emapuhkus.html>) |
| Isa vanemahüvitis ja isapuhkus | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_isa_vanemahuvitis_ja_isapuhkus.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_isa_vanemahuvitis_ja_isapuhkus.html>) |
| Jagatav vanemahüvitis ja vanemapuhkus | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_jagatav_vanemahuvitis_ja_vanemapuhkus.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_jagatav_vanemahuvitis_ja_vanemapuhkus.html>) |
| Lapsendaja vanemahüvitis ja lapsendajapuhkus | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_lapsendaja_vanemahuvitis_ja_lapsendajapuhkus.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_lapsendaja_vanemahuvitis_ja_lapsendajapuhkus.html>) |
| Lapsepuhkus ja puudega lapse vanema lapsepuhkus | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_lapsepuhkus.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_lapsepuhkus.html>) |
| Perehüvitiste määrad | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_perehuvitiste_maarad_ja_maksmine.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_perehuvitiste_maarad_ja_maksmine.html>) |
| Perehüvitistest loobumine | [veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_perehuvitistest_loobumine.html](<veebilehed/sotsiaalkindlustusamet/ska_perehuvitiste_ulevaade_perehuvitistest_loobumine.html>) |
| Laps ei ela koos oma vanematega | [veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_laps_ei_ela_koos_oma_vanematega.html](<veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_laps_ei_ela_koos_oma_vanematega.html>) |
| Lapse vanemad ei ela enam koos | [veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_lapse_vanemad_ei_ela_koos.html](<veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_lapse_vanemad_ei_ela_koos.html>) |
| Puudega vanem | [veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_lapse_vanemal_puue.html](<veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_lapse_vanemal_puue.html>) |
| Peres kasvavad koos mitme eri vanema lapsed | [veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_peres_kasvavad_koos_mitme_eri_vanema_lapsed.html](<veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_peres_kasvavad_koos_mitme_eri_vanema_lapsed.html>) |
| Puudega laps | [veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_peres_puudega_laps.html](<veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_peres_puudega_laps.html>) |
| Varakult lahkunud laps | [veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_varakult_lahkunud_laps.html](<veebilehed/sotsiaalkindlustusamet/ska_perekondlikud_olukorrad_varakult_lahkunud_laps.html>) |
| Perelepitus | [veebilehed/sotsiaalkindlustusamet/ska_perelepitus.html](<veebilehed/sotsiaalkindlustusamet/ska_perelepitus.html>) |
| Ajateenija lapse toetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_ajateenija_lapse_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_ajateenija_lapse_toetus.html>) |
| Eestkostetava toetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_eestkostetava_lapse_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_eestkostetava_lapse_toetus.html>) |
| Lapsendamistoetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_lapsendamistoetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_lapsendamistoetus.html>) |
| Lapsetoetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_lapsetoetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_lapsetoetus.html>) |
| Lasterikka pere toetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_lasterikka_pere_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_lasterikka_pere_toetus.html>) |
| Mitmike toetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_mitmike_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_mitmike_toetus.html>) |
| Sünnitoetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_sunnitoetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_sunnitoetus.html>) |
| Toitjakaotustoetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_toitjakaotustoetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_toitjakaotustoetus.html>) |
| Üksikvanema lapse toetus | [veebilehed/sotsiaalkindlustusamet/ska_peretoetused_uksikvanema_lapse_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_peretoetused_uksikvanema_lapse_toetus.html>) |
| Pensionide, toetuste ja hüvitiste väljamaksmine | [veebilehed/sotsiaalkindlustusamet/ska_praktiline_teave_pensionide_toetuste_ja_huvitiste_valjamaksmine.html](<veebilehed/sotsiaalkindlustusamet/ska_praktiline_teave_pensionide_toetuste_ja_huvitiste_valjamaksmine.html>) |
| Lapse puude raskusastme tuvastamine | [veebilehed/sotsiaalkindlustusamet/ska_puude_raskusastme_tuvastamine_lapse_puude_raskusastme_tuvastamine.html](<veebilehed/sotsiaalkindlustusamet/ska_puude_raskusastme_tuvastamine_lapse_puude_raskusastme_tuvastamine.html>) |
| Vanaduspensioniealise puude raskusastme tuvastamine | [veebilehed/sotsiaalkindlustusamet/ska_puude_raskusastme_tuvastamine_vanaduspensioniealise_puude_raskusastme.html](<veebilehed/sotsiaalkindlustusamet/ska_puude_raskusastme_tuvastamine_vanaduspensioniealise_puude_raskusastme.html>) |
| Erihoolekanne | [veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_erihoolekanne.html](<veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_erihoolekanne.html>) |
| Puude raskusastme tuvastamine | [veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_puude_raskusastme_tuvastamine.html](<veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_puude_raskusastme_tuvastamine.html>) |
| Sotsiaalse rehabilitatsiooni teenus | [veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_sotsiaalne_rehabilitatsioon.html](<veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_sotsiaalne_rehabilitatsioon.html>) |
| Toetused puudega inimestele | [veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_toetused_puudega_inimestele.html](<veebilehed/sotsiaalkindlustusamet/ska_puue_ja_hoolekanne_toetused_puudega_inimestele.html>) |
| Kogumispensioni täiendavad sissemaksed | [veebilehed/sotsiaalkindlustusamet/ska_ravi_ja_pensionikindlustus_kogumispensioni_taiendavad_sissemaksed.html](<veebilehed/sotsiaalkindlustusamet/ska_ravi_ja_pensionikindlustus_kogumispensioni_taiendavad_sissemaksed.html>) |
| Seksuaalvägivalla ohvrile | [veebilehed/sotsiaalkindlustusamet/ska_seksuaalvagivalla_ohvrite_kriisiabi.html](<veebilehed/sotsiaalkindlustusamet/ska_seksuaalvagivalla_ohvrite_kriisiabi.html>) |
| Perehüvitised Euroopa Liidus | [veebilehed/sotsiaalkindlustusamet/ska_sotsiaalkindlustus_valismaal_ja_valismaalt_tulijatele_perehuvitised.html](<veebilehed/sotsiaalkindlustusamet/ska_sotsiaalkindlustus_valismaal_ja_valismaalt_tulijatele_perehuvitised.html>) |
| Väljastpoolt Euroopa Liitu tulijate perehüvitised | [veebilehed/sotsiaalkindlustusamet/ska_sotsiaalkindlustus_valismaal_ja_valismaalt_tulijatele_valjastpoolt.html](<veebilehed/sotsiaalkindlustusamet/ska_sotsiaalkindlustus_valismaal_ja_valismaalt_tulijatele_valjastpoolt.html>) |
| Laste sotsiaalne rehabilitatsioon | [veebilehed/sotsiaalkindlustusamet/ska_sotsiaalne_rehabilitatsioon_laste_sotsiaalne_rehabilitatsioon.html](<veebilehed/sotsiaalkindlustusamet/ska_sotsiaalne_rehabilitatsioon_laste_sotsiaalne_rehabilitatsioon.html>) |
| Rehabilitatsiooniteenuse reform | [veebilehed/sotsiaalkindlustusamet/ska_sotsiaalne_rehabilitatsioon_rehabilitatsiooniteenuse_reform.html](<veebilehed/sotsiaalkindlustusamet/ska_sotsiaalne_rehabilitatsioon_rehabilitatsiooniteenuse_reform.html>) |
| Sotsiaalse rehabilitatsiooni teenus tööealistele ja pensioniealistele | [veebilehed/sotsiaalkindlustusamet/ska_sotsiaalne_rehabilitatsioon_too_ja_pensioniealiste_sotsiaalne_rehabilitatsioon.html](<veebilehed/sotsiaalkindlustusamet/ska_sotsiaalne_rehabilitatsioon_too_ja_pensioniealiste_sotsiaalne_rehabilitatsioon.html>) |
| Juhtkoer vaegnägijale | [veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_juhtkoer_vaegnagijale.html](<veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_juhtkoer_vaegnagijale.html>) |
| Kaugtõlge | [veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_kaugtolge.html](<veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_kaugtolge.html>) |
| Kirjutustõlge | [veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_kirjutustolge.html](<veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_kirjutustolge.html>) |
| Parkimiskaart | [veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_parkimiskaart.html](<veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_parkimiskaart.html>) |
| Puudega laste tugiteenused | [veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_puudega_lapse_tugiteenused.html](<veebilehed/sotsiaalkindlustusamet/ska_toetavad_teenused_puudega_lapse_tugiteenused.html>) |
| Perehüvitised Ukraina põgenikele | [veebilehed/sotsiaalkindlustusamet/ska_toetused_huvitised_ukraina_pogenikele_perehuvitised_ukraina.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_huvitised_ukraina_pogenikele_perehuvitised_ukraina.html>) |
| Harvikhaigusega lapse toetus | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_harvikhaigusega_lapse_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_harvikhaigusega_lapse_toetus.html>) |
| Õppelaenu kustutamine | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_oppelaenu_kustutamine.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_oppelaenu_kustutamine.html>) |
| Õppetoetus | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_oppetoetus.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_oppetoetus.html>) |
| Puudega lapse toetus | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_puudega_lapse_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_puudega_lapse_toetus.html>) |
| Puudega vanaduspensioniealise inimese toetus | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_puudega_vanaduspensioniealise_inimese_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_puudega_vanaduspensioniealise_inimese_toetus.html>) |
| Puudega vanema toetus | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_puudega_vanema_toetus.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_puudega_vanema_toetus.html>) |
| Täienduskoolitustoetus | [veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_taienduskoolitustoetus.html](<veebilehed/sotsiaalkindlustusamet/ska_toetused_puudega_inimestele_taienduskoolitustoetus.html>) |
| Vaide esitamine | [veebilehed/sotsiaalkindlustusamet/ska_vaie.html](<veebilehed/sotsiaalkindlustusamet/ska_vaie.html>) |
| Ohvriabi emotsionaalse toe telefon 116123 | [veebilehed/sotsiaalkindlustusamet/ska_vaimne_tervis_kriisis_emotsionaalse_toe_telefon_116123.html](<veebilehed/sotsiaalkindlustusamet/ska_vaimne_tervis_kriisis_emotsionaalse_toe_telefon_116123.html>) |
| Psühhosotsiaalne kriisiabi | [veebilehed/sotsiaalkindlustusamet/ska_vaimne_tervis_kriisis_psuhhosotsiaalne_kriisiabi.html](<veebilehed/sotsiaalkindlustusamet/ska_vaimne_tervis_kriisis_psuhhosotsiaalne_kriisiabi.html>) |
| Vaimse tervise videonõustamine | [veebilehed/sotsiaalkindlustusamet/ska_vaimne_tervis_kriisis_vaimse_tervise_videonoustamine.html](<veebilehed/sotsiaalkindlustusamet/ska_vaimne_tervis_kriisis_vaimse_tervise_videonoustamine.html>) |
| Sotsiaalkindlustusameti 2024. aasta järelevalves: rohkem rikkumisi, aga ka häid näiteid | [veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_2024_jarelevalve_kokkuvote.html](<veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_2024_jarelevalve_kokkuvote.html>) |
| Abivahendi ettevõttele | [veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_abivahendi_ettevottele.html](<veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_abivahendi_ettevottele.html>) |
| Abivahendi vajajale | [veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_abivahendi_vajajale.html](<veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_abivahendi_vajajale.html>) |
| Sotsiaalteenuste järelevalve | [veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_sotsiaalteenuste_jarelevalve.html](<veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_ska_sotsiaalteenuste_jarelevalve.html>) |
| Väljaspool kodu osutatav üldhooldusteenus | [veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_uldhooldusteenus_kov_noustamine_jarelevalve_raam.html](<veebilehed/sotsiaalkindlustusamet/sotsiaalkindlustusamet_uldhooldusteenus_kov_noustamine_jarelevalve_raam.html>) |
| Elatisabi | [veebilehed/sotsiaalministeerium/sm_elatisabi.html](<veebilehed/sotsiaalministeerium/sm_elatisabi.html>) |
| Perehüvitised ja vanemapuhkused | [veebilehed/sotsiaalministeerium/sm_lapsed_ja_pered_perehuvitised_ja_vanemapuhkused.html](<veebilehed/sotsiaalministeerium/sm_lapsed_ja_pered_perehuvitised_ja_vanemapuhkused.html>) |
| Pension | [veebilehed/sotsiaalministeerium/sm_pension.html](<veebilehed/sotsiaalministeerium/sm_pension.html>) |
| Sooduspensionid | [veebilehed/sotsiaalministeerium/sm_pension_sooduspensionid.html](<veebilehed/sotsiaalministeerium/sm_pension_sooduspensionid.html>) |
| Õendus ja ämmaemandus | [veebilehed/sotsiaalministeerium/sm_ravi_ja_tervise_taastamine_oendus_ja_ammaemandusabi.html](<veebilehed/sotsiaalministeerium/sm_ravi_ja_tervise_taastamine_oendus_ja_ammaemandusabi.html>) |
| Töötus- ja ravikindlustushüvitised | [veebilehed/sotsiaalministeerium/sm_tootus_ja_ravikindlustushuvitised.html](<veebilehed/sotsiaalministeerium/sm_tootus_ja_ravikindlustushuvitised.html>) |
| Vanemahüvitis | [veebilehed/sotsiaalministeerium/sm_vanemahuvitis.html](<veebilehed/sotsiaalministeerium/sm_vanemahuvitis.html>) |
| Ligipääsetavus füüsilisele keskkonnale | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--ligipaasetavuse-parandamine--ligipaasetavus-fuusilisele-keskkonnale.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--ligipaasetavuse-parandamine--ligipaasetavus-fuusilisele-keskkonnale.html>) |
| Mis on erivajadus? | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-erivajadus.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-erivajadus.html>) |
| Mis on ligipääsetavus? | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-ligipaasetavus.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-ligipaasetavus.html>) |
| Mis on lihtne keel? | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-lihtne-keel.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-lihtne-keel.html>) |
| Mis on puue? | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-puue.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-puue.html>) |
| Mis on veebi ligipääsetavus? | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-veebi-ligipaasetavus.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted--mis-veebi-ligipaasetavus.html>) |
| Ligipääsetavus | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--aluspohimotted.html>) |
| Ligipääsetavuse rakkerühm | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--olukord-ja-valjakutsed--ligipaasetavuse-rakkeruhm.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--olukord-ja-valjakutsed--ligipaasetavuse-rakkeruhm.html>) |
| Minuomavalitsus ja LIPS | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--olukord-ja-valjakutsed--minuomavalitsus-ja-lips.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--olukord-ja-valjakutsed--minuomavalitsus-ja-lips.html>) |
| ÜRO puuetega inimeste õiguste konventsiooni täitmise variraport | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--olukord-ja-valjakutsed--uro-puuetega-inimeste-oiguste-k-4c86dbcf622c.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--olukord-ja-valjakutsed--uro-puuetega-inimeste-oiguste-k-4c86dbcf622c.html>) |
| Intellektipuue | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--intellektipuue.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--intellektipuue.html>) |
| Kuulmispuue | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--kuulmispuue.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--kuulmispuue.html>) |
| Liikumispuue | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--liikumispuue.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--liikumispuue.html>) |
| Nägemispuue | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--nagemispuue.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--nagemispuue.html>) |
| Universaalne disain ja kaasav disain | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--universaalne-disain-ja-kaasav-disain.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted--universaalne-disain-ja-kaasav-disain.html>) |
| Põhimõisted | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--mis-see--pohimoisted.html>) |
| Aktid | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--oigusaktid--aktid.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--oigusaktid--aktid.html>) |
| Euroopa Parlamendi ja Nõukogu määrused | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--oigusaktid--uro--euroopa-parlamendi-ja-noukogu-maarused.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--oigusaktid--uro--euroopa-parlamendi-ja-noukogu-maarused.html>) |
| ÜRO puuetega inimeste õiguste konventsioon | [veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--oigusaktid--uro--uro-puuetega-inimeste-oiguste-konventsioon.html](<veebilehed/sotsiaalministeeriumi-kompetentsikeskus/4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus--oigusaktid--uro--uro-puuetega-inimeste-oiguste-konventsioon.html>) |
| Infomaterjalid hoolekandeasutustele | [veebilehed/terviseamet/terviseamet_terviseamet_infomaterjalid_hoolekandeasutustele.html](<veebilehed/terviseamet/terviseamet_terviseamet_infomaterjalid_hoolekandeasutustele.html>) |
| Sotsiaalasutuste järelevalve | [veebilehed/terviseamet/terviseamet_terviseamet_sotsiaalasutuste_jarelevalve.html](<veebilehed/terviseamet/terviseamet_terviseamet_sotsiaalasutuste_jarelevalve.html>) |
| Tervishoid koolis | [veebilehed/tervisekassa/tek_arsti_ja_oendusabi_tervishoid_koolis.html](<veebilehed/tervisekassa/tek_arsti_ja_oendusabi_tervishoid_koolis.html>) |
| Tervishoiuteenused | [veebilehed/tervisekassa/tek_arsti_ja_oendusabi_tervishoiuteenused.html](<veebilehed/tervisekassa/tek_arsti_ja_oendusabi_tervishoiuteenused.html>) |
| Vaktsiinikahjude hüvitamine Eestis toimunud vaktsineerimise korral | [veebilehed/tervisekassa/tek_haigekassa_huvitised_vaktsiinikahjude_huvitamine.html](<veebilehed/tervisekassa/tek_haigekassa_huvitised_vaktsiinikahjude_huvitamine.html>) |
| Kasulikku lugemist | [veebilehed/tervisekassa/tek_hambaravi_kasulikku_lugemist.html](<veebilehed/tervisekassa/tek_hambaravi_kasulikku_lugemist.html>) |
| Laste hambaravi | [veebilehed/tervisekassa/tek_hambaravi_laste_hambaravi.html](<veebilehed/tervisekassa/tek_hambaravi_laste_hambaravi.html>) |
| Täiskasvanute hambaravi | [veebilehed/tervisekassa/tek_hambaravi_taiskasvanute_hambaravi.html](<veebilehed/tervisekassa/tek_hambaravi_taiskasvanute_hambaravi.html>) |
| Ajutise töövõimetuse hüvitise saamise piirangud | [veebilehed/tervisekassa/tek_huvitised_ajutise_toovoimetuse_huvitise_saamise_piirangud.html](<veebilehed/tervisekassa/tek_huvitised_ajutise_toovoimetuse_huvitise_saamise_piirangud.html>) |
| Haigestumine välisriigis | [veebilehed/tervisekassa/tek_huvitised_haigestumine_valisriigis.html](<veebilehed/tervisekassa/tek_huvitised_haigestumine_valisriigis.html>) |
| Haigushüvitis | [veebilehed/tervisekassa/tek_huvitised_haigushuvitis.html](<veebilehed/tervisekassa/tek_huvitised_haigushuvitis.html>) |
| Hooldushüvitis | [veebilehed/tervisekassa/tek_huvitised_hooldushuvitis.html](<veebilehed/tervisekassa/tek_huvitised_hooldushuvitis.html>) |
| Raseda kergemale tööle üle viimine | [veebilehed/tervisekassa/tek_huvitised_raseda_kergemale_toole_ule_viimine.html](<veebilehed/tervisekassa/tek_huvitised_raseda_kergemale_toole_ule_viimine.html>) |
| Ravimite hüvitamine | [veebilehed/tervisekassa/tek_huvitised_ravimite_huvitamine.html](<veebilehed/tervisekassa/tek_huvitised_ravimite_huvitamine.html>) |
| Töötingimuste ajutine kergendamine | [veebilehed/tervisekassa/tek_huvitised_tootingimuste_ajutine_kergendamine.html](<veebilehed/tervisekassa/tek_huvitised_tootingimuste_ajutine_kergendamine.html>) |
| Arsti- ja õendusabi | [veebilehed/tervisekassa/tek_inimesele_arsti_ja_oendusabi.html](<veebilehed/tervisekassa/tek_inimesele_arsti_ja_oendusabi.html>) |
| Avaldused | [veebilehed/tervisekassa/tek_inimesele_avaldused.html](<veebilehed/tervisekassa/tek_inimesele_avaldused.html>) |
| Hambaravi | [veebilehed/tervisekassa/tek_inimesele_hambaravi.html](<veebilehed/tervisekassa/tek_inimesele_hambaravi.html>) |
| Tervisekassa hüvitised | [veebilehed/tervisekassa/tek_inimesele_huvitised.html](<veebilehed/tervisekassa/tek_inimesele_huvitised.html>) |
| Minu andmed: Terviseportaal; Riigiportaal | [veebilehed/tervisekassa/tek_inimesele_minu_andmed_terviseportaal_riigiportaal.html](<veebilehed/tervisekassa/tek_inimesele_minu_andmed_terviseportaal_riigiportaal.html>) |
| Ravikindlustus | [veebilehed/tervisekassa/tek_inimesele_ravikindlustus.html](<veebilehed/tervisekassa/tek_inimesele_ravikindlustus.html>) |
| Ravimid | [veebilehed/tervisekassa/tek_inimesele_ravimid.html](<veebilehed/tervisekassa/tek_inimesele_ravimid.html>) |
| Teenustasud ja omaosalus | [veebilehed/tervisekassa/tek_inimesele_teenustasud_ja_omaosalus.html](<veebilehed/tervisekassa/tek_inimesele_teenustasud_ja_omaosalus.html>) |
| Ukraina sõjapõgenikele | [veebilehed/tervisekassa/tek_inimesele_ukraina_sojapogenikele.html](<veebilehed/tervisekassa/tek_inimesele_ukraina_sojapogenikele.html>) |
| Lastega seotud hüvitised | [veebilehed/tervisekassa/tek_lapse_saamine_ja_lapse_tervis_lastega_seotud_huvitised.html](<veebilehed/tervisekassa/tek_lapse_saamine_ja_lapse_tervis_lastega_seotud_huvitised.html>) |
| Rase | [veebilehed/tervisekassa/tek_lapse_saamine_ja_lapse_tervis_rase.html](<veebilehed/tervisekassa/tek_lapse_saamine_ja_lapse_tervis_rase.html>) |
| Laste ortodontia | [veebilehed/tervisekassa/tek_laste_hambaravi_laste_ortodontia.html](<veebilehed/tervisekassa/tek_laste_hambaravi_laste_ortodontia.html>) |
| Kaebevõimalused ja hüvitamine | [veebilehed/tervisekassa/tek_patsientide_oigused_ja_kaebevoimalused_kaebevoimalused_ja_huvitamine.html](<veebilehed/tervisekassa/tek_patsientide_oigused_ja_kaebevoimalused_kaebevoimalused_ja_huvitamine.html>) |
| Patsientide õigused | [veebilehed/tervisekassa/tek_patsientide_oigused_ja_kaebevoimalused_patsientide_oigused.html](<veebilehed/tervisekassa/tek_patsientide_oigused_ja_kaebevoimalused_patsientide_oigused.html>) |
| Inimesed, kelle eest makstakse või kes ise maksab sotsiaalmaksu | [veebilehed/tervisekassa/tek_ravikindlustus_inimesed_kelle_eest_makstakse_voi_kes_ise_maksab_sotsiaalmaksu.html](<veebilehed/tervisekassa/tek_ravikindlustus_inimesed_kelle_eest_makstakse_voi_kes_ise_maksab_sotsiaalmaksu.html>) |
| Kindlustatuga võrdustatud inimesed | [veebilehed/tervisekassa/tek_ravikindlustus_kindlustatuga_vordustatud_inimesed.html](<veebilehed/tervisekassa/tek_ravikindlustus_kindlustatuga_vordustatud_inimesed.html>) |
| Vabatahtlik ravikindlustus | [veebilehed/tervisekassa/tek_ravikindlustus_vabatahtlik_ravikindlustus.html](<veebilehed/tervisekassa/tek_ravikindlustus_vabatahtlik_ravikindlustus.html>) |
| Digiretsept | [veebilehed/tervisekassa/tek_ravimid_digiretsept.html](<veebilehed/tervisekassa/tek_ravimid_digiretsept.html>) |
| Kehavälise viljastamisega seotud ravimid | [veebilehed/tervisekassa/tek_ravimid_kehavalise_viljastamisega_seotud_ravimid.html](<veebilehed/tervisekassa/tek_ravimid_kehavalise_viljastamisega_seotud_ravimid.html>) |
| Ravimite erandkorras hüvitamine | [veebilehed/tervisekassa/tek_ravimid_ravimite_erandkorras_huvitamine.html](<veebilehed/tervisekassa/tek_ravimid_ravimite_erandkorras_huvitamine.html>) |
| Täiendav ravimi- ja meditsiiniseadmehüvitis | [veebilehed/tervisekassa/tek_ravimid_taiendav_ravimi_ja_meditsiiniseadmehuvitis.html](<veebilehed/tervisekassa/tek_ravimid_taiendav_ravimi_ja_meditsiiniseadmehuvitis.html>) |
| Toimeainepõhine retsept | [veebilehed/tervisekassa/tek_ravimid_toimeainepohine_retsept.html](<veebilehed/tervisekassa/tek_ravimid_toimeainepohine_retsept.html>) |
| Depressiooni raviteekond | [veebilehed/tervisekassa/tek_raviteekondade_arendamine_depressiooni_raviteekond.html](<veebilehed/tervisekassa/tek_raviteekondade_arendamine_depressiooni_raviteekond.html>) |
| Insuldi raviteekond | [veebilehed/tervisekassa/tek_raviteekondade_arendamine_insuldi_raviteekond.html](<veebilehed/tervisekassa/tek_raviteekondade_arendamine_insuldi_raviteekond.html>) |
| Hambaproteeside hüvitis | [veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_hambaproteeside_huvitis.html](<veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_hambaproteeside_huvitis.html>) |
| Hambaravihüvitis | [veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_hambaravihuvitis.html](<veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_hambaravihuvitis.html>) |
| Täiskasvanute ortodontia | [veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_taiskasvanute_ortodontia.html](<veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_taiskasvanute_ortodontia.html>) |
| Tasuta hambaravi | [veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_tasuta_hambaravi.html](<veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_tasuta_hambaravi.html>) |
| Vältimatu hambaravi | [veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_valtimatu_hambaravi.html](<veebilehed/tervisekassa/tek_taiskasvanute_hambaravi_valtimatu_hambaravi.html>) |
| Tallinna kontaktid | [kontaktid/tallinn/tallinn.contacts.json](kontaktid/tallinn/tallinn.contacts.json) |

<!-- corpus-outside:start (kirjutab scripts/rag-v2-register-corpus.mjs; käsitsi ei muudeta) -->
## RAG-is olevad lehed ja kontaktid

Serveris töötav RAG, korpus v84, 11.10.2026. Siin on loend sellest, mida jaotis „Sisufailid“ ei loetle.

### Hooldekodude kohamaksumuse lehed (79)

| Leht |
|---|
| Hooldekodude kohamaksumus Eestis: ülevaade maakondade kaupa |
| Hooldekodude kohamaksumus: Alutaguse vald |
| Hooldekodude kohamaksumus: Anija vald |
| Hooldekodude kohamaksumus: Antsla vald |
| Hooldekodude kohamaksumus: Elva vald |
| Hooldekodude kohamaksumus: Haapsalu linn |
| Hooldekodude kohamaksumus: Haljala vald |
| Hooldekodude kohamaksumus: Harku vald |
| Hooldekodude kohamaksumus: Hiiumaa vald |
| Hooldekodude kohamaksumus: Häädemeeste vald |
| Hooldekodude kohamaksumus: Jõelähtme vald |
| Hooldekodude kohamaksumus: Jõgeva vald |
| Hooldekodude kohamaksumus: Jõhvi vald |
| Hooldekodude kohamaksumus: Järva vald |
| Hooldekodude kohamaksumus: Kadrina vald |
| Hooldekodude kohamaksumus: Kambja vald |
| Hooldekodude kohamaksumus: Kanepi vald |
| Hooldekodude kohamaksumus: Kastre vald |
| Hooldekodude kohamaksumus: Kehtna vald |
| Hooldekodude kohamaksumus: Keila linn |
| Hooldekodude kohamaksumus: Kihnu vald |
| Hooldekodude kohamaksumus: Kiili vald |
| Hooldekodude kohamaksumus: Kohila vald |
| Hooldekodude kohamaksumus: Kohtla-Järve linn |
| Hooldekodude kohamaksumus: Kose vald |
| Hooldekodude kohamaksumus: Kuusalu vald |
| Hooldekodude kohamaksumus: Loksa linn |
| Hooldekodude kohamaksumus: Luunja vald |
| Hooldekodude kohamaksumus: Lääne-Harju vald |
| Hooldekodude kohamaksumus: Lääne-Nigula vald |
| Hooldekodude kohamaksumus: Lääneranna vald |
| Hooldekodude kohamaksumus: Lüganuse vald |
| Hooldekodude kohamaksumus: Maardu linn |
| Hooldekodude kohamaksumus: Muhu vald |
| Hooldekodude kohamaksumus: Mulgi vald |
| Hooldekodude kohamaksumus: Mustvee vald |
| Hooldekodude kohamaksumus: Märjamaa vald |
| Hooldekodude kohamaksumus: Narva linn |
| Hooldekodude kohamaksumus: Narva-Jõesuu linn |
| Hooldekodude kohamaksumus: Nõo vald |
| Hooldekodude kohamaksumus: Otepää vald |
| Hooldekodude kohamaksumus: Paide linn |
| Hooldekodude kohamaksumus: Peipsiääre vald |
| Hooldekodude kohamaksumus: Põhja-Pärnumaa vald |
| Hooldekodude kohamaksumus: Põhja-Sakala vald |
| Hooldekodude kohamaksumus: Põltsamaa vald |
| Hooldekodude kohamaksumus: Põlva vald |
| Hooldekodude kohamaksumus: Pärnu linn |
| Hooldekodude kohamaksumus: Raasiku vald |
| Hooldekodude kohamaksumus: Rae vald |
| Hooldekodude kohamaksumus: Rakvere linn |
| Hooldekodude kohamaksumus: Rakvere vald |
| Hooldekodude kohamaksumus: Rapla vald |
| Hooldekodude kohamaksumus: Ruhnu vald |
| Hooldekodude kohamaksumus: Rõuge vald |
| Hooldekodude kohamaksumus: Räpina vald |
| Hooldekodude kohamaksumus: Saarde vald |
| Hooldekodude kohamaksumus: Saaremaa vald |
| Hooldekodude kohamaksumus: Saku vald |
| Hooldekodude kohamaksumus: Saue vald |
| Hooldekodude kohamaksumus: Setomaa vald |
| Hooldekodude kohamaksumus: Sillamäe linn |
| Hooldekodude kohamaksumus: Tallinna linn |
| Hooldekodude kohamaksumus: Tapa vald |
| Hooldekodude kohamaksumus: Tartu linn |
| Hooldekodude kohamaksumus: Tartu vald |
| Hooldekodude kohamaksumus: Tori vald |
| Hooldekodude kohamaksumus: Tõrva vald |
| Hooldekodude kohamaksumus: Türi vald |
| Hooldekodude kohamaksumus: Valga vald |
| Hooldekodude kohamaksumus: Viimsi vald |
| Hooldekodude kohamaksumus: Viljandi linn |
| Hooldekodude kohamaksumus: Viljandi vald |
| Hooldekodude kohamaksumus: Vinni vald |
| Hooldekodude kohamaksumus: Viru-Nigula vald |
| Hooldekodude kohamaksumus: Vormsi vald |
| Hooldekodude kohamaksumus: Võru linn |
| Hooldekodude kohamaksumus: Võru vald |
| Hooldekodude kohamaksumus: Väike-Maarja vald |

### Abivahendite müügi- ja üüripunktide lehed (93)

| Leht |
|---|
| Abivahendite müügi- ja üüripunktid: Alutaguse vald |
| Abivahendite müügi- ja üüripunktid: Anija vald |
| Abivahendite müügi- ja üüripunktid: Antsla vald |
| Abivahendite müügi- ja üüripunktid: Elva vald |
| Abivahendite müügi- ja üüripunktid: Haapsalu linn |
| Abivahendite müügi- ja üüripunktid: Haljala vald |
| Abivahendite müügi- ja üüripunktid: Harju maakond |
| Abivahendite müügi- ja üüripunktid: Harku vald |
| Abivahendite müügi- ja üüripunktid: Hiiu maakond |
| Abivahendite müügi- ja üüripunktid: Hiiumaa vald |
| Abivahendite müügi- ja üüripunktid: Häädemeeste vald |
| Abivahendite müügi- ja üüripunktid: Ida-Viru maakond |
| Abivahendite müügi- ja üüripunktid: Jõelähtme vald |
| Abivahendite müügi- ja üüripunktid: Jõgeva maakond |
| Abivahendite müügi- ja üüripunktid: Jõgeva vald |
| Abivahendite müügi- ja üüripunktid: Jõhvi vald |
| Abivahendite müügi- ja üüripunktid: Järva maakond |
| Abivahendite müügi- ja üüripunktid: Järva vald |
| Abivahendite müügi- ja üüripunktid: Kadrina vald |
| Abivahendite müügi- ja üüripunktid: Kambja vald |
| Abivahendite müügi- ja üüripunktid: Kanepi vald |
| Abivahendite müügi- ja üüripunktid: Kastre vald |
| Abivahendite müügi- ja üüripunktid: Kehtna vald |
| Abivahendite müügi- ja üüripunktid: Keila linn |
| Abivahendite müügi- ja üüripunktid: Kihnu vald |
| Abivahendite müügi- ja üüripunktid: Kiili vald |
| Abivahendite müügi- ja üüripunktid: Kohila vald |
| Abivahendite müügi- ja üüripunktid: Kohtla-Järve linn |
| Abivahendite müügi- ja üüripunktid: Kose vald |
| Abivahendite müügi- ja üüripunktid: Kuusalu vald |
| Abivahendite müügi- ja üüripunktid: Loksa linn |
| Abivahendite müügi- ja üüripunktid: Luunja vald |
| Abivahendite müügi- ja üüripunktid: Lääne maakond |
| Abivahendite müügi- ja üüripunktid: Lääne-Harju vald |
| Abivahendite müügi- ja üüripunktid: Lääne-Nigula vald |
| Abivahendite müügi- ja üüripunktid: Lääne-Viru maakond |
| Abivahendite müügi- ja üüripunktid: Lääneranna vald |
| Abivahendite müügi- ja üüripunktid: Lüganuse vald |
| Abivahendite müügi- ja üüripunktid: Maardu linn |
| Abivahendite müügi- ja üüripunktid: Muhu vald |
| Abivahendite müügi- ja üüripunktid: Mulgi vald |
| Abivahendite müügi- ja üüripunktid: Mustvee vald |
| Abivahendite müügi- ja üüripunktid: Märjamaa vald |
| Abivahendite müügi- ja üüripunktid: Narva linn |
| Abivahendite müügi- ja üüripunktid: Narva-Jõesuu linn |
| Abivahendite müügi- ja üüripunktid: Nõo vald |
| Abivahendite müügi- ja üüripunktid: Otepää vald |
| Abivahendite müügi- ja üüripunktid: Paide linn |
| Abivahendite müügi- ja üüripunktid: Peipsiääre vald |
| Abivahendite müügi- ja üüripunktid: Põhja-Pärnumaa vald |
| Abivahendite müügi- ja üüripunktid: Põhja-Sakala vald |
| Abivahendite müügi- ja üüripunktid: Põltsamaa vald |
| Abivahendite müügi- ja üüripunktid: Põlva maakond |
| Abivahendite müügi- ja üüripunktid: Põlva vald |
| Abivahendite müügi- ja üüripunktid: Pärnu linn |
| Abivahendite müügi- ja üüripunktid: Pärnu maakond |
| Abivahendite müügi- ja üüripunktid: Raasiku vald |
| Abivahendite müügi- ja üüripunktid: Rae vald |
| Abivahendite müügi- ja üüripunktid: Rakvere linn |
| Abivahendite müügi- ja üüripunktid: Rakvere vald |
| Abivahendite müügi- ja üüripunktid: Rapla maakond |
| Abivahendite müügi- ja üüripunktid: Rapla vald |
| Abivahendite müügi- ja üüripunktid: Ruhnu vald |
| Abivahendite müügi- ja üüripunktid: Rõuge vald |
| Abivahendite müügi- ja üüripunktid: Räpina vald |
| Abivahendite müügi- ja üüripunktid: Saarde vald |
| Abivahendite müügi- ja üüripunktid: Saare maakond |
| Abivahendite müügi- ja üüripunktid: Saaremaa vald |
| Abivahendite müügi- ja üüripunktid: Saku vald |
| Abivahendite müügi- ja üüripunktid: Saue vald |
| Abivahendite müügi- ja üüripunktid: Setomaa vald |
| Abivahendite müügi- ja üüripunktid: Sillamäe linn |
| Abivahendite müügi- ja üüripunktid: Tallinna linn |
| Abivahendite müügi- ja üüripunktid: Tapa vald |
| Abivahendite müügi- ja üüripunktid: Tartu linn |
| Abivahendite müügi- ja üüripunktid: Tartu maakond |
| Abivahendite müügi- ja üüripunktid: Tartu vald |
| Abivahendite müügi- ja üüripunktid: Tori vald |
| Abivahendite müügi- ja üüripunktid: Tõrva vald |
| Abivahendite müügi- ja üüripunktid: Türi vald |
| Abivahendite müügi- ja üüripunktid: Valga maakond |
| Abivahendite müügi- ja üüripunktid: Valga vald |
| Abivahendite müügi- ja üüripunktid: Viimsi vald |
| Abivahendite müügi- ja üüripunktid: Viljandi linn |
| Abivahendite müügi- ja üüripunktid: Viljandi maakond |
| Abivahendite müügi- ja üüripunktid: Viljandi vald |
| Abivahendite müügi- ja üüripunktid: Vinni vald |
| Abivahendite müügi- ja üüripunktid: Viru-Nigula vald |
| Abivahendite müügi- ja üüripunktid: Vormsi vald |
| Abivahendite müügi- ja üüripunktid: Võru linn |
| Abivahendite müügi- ja üüripunktid: Võru maakond |
| Abivahendite müügi- ja üüripunktid: Võru vald |
| Abivahendite müügi- ja üüripunktid: Väike-Maarja vald |

### Abivahendite müüjate lehed (51)

| Väljaandja | Pealkiri | Aadress |
|---|---|---|
| Audiomed | Broneeri kuulmisuuringu aeg | <https://kuulmiseni.ee/> |
| Audiomed | Kuuldeaparaatide ostmine riikliku soodustusega | <https://kuulmiseni.ee/patsientidele/kuuldeaparaatide-ostmine-riikliku-soodustusega> |
| E-ratastoolid | E-ratastoolid | <https://www.e-ratastoolid.eu/> |
| E-ratastoolid | Remont ja hooldus | <https://www.e-ratastoolid.eu/remont-ja-hooldus> |
| Eesti Nägemistervisekeskus | Abivahendid | <https://silmatervis.ee/abivahendid/> |
| Eesti Ortoosikeskus | Eesti Ortoosikeskus | <https://www.ortoosikeskus.ee/> |
| Egero | Ettevõttest | <https://www.invaabivahendid.ee/ettevottest> |
| INVAGO | INVAGO | <https://invago.ee/> |
| INVAGO | LAENUTUS | <https://invago.ee/teenused/laenutus> |
| INVAGO | MEIST | <https://invago.ee/ettevottest> |
| INVAGO | SOODUSTUS | <https://invago.ee/kasulikku/riigisoodustuse-info> |
| INVAGO | TRANSPORT | <https://invago.ee/teenused/transport> |
| Invaru | Invaru toetab | <https://www.invaru.ee/> |
| Invaru | Abivahendi tõend | <https://www.invaru.ee/ee/abivahendi-toend> |
| Invaru | Esindused ja kontaktid | <https://www.invaru.ee/ee/invaru-esindused> |
| Invaru | Ettevõttest | <https://www.invaru.ee/ee/ettevottest> |
| Invaru | Remont | <https://www.invaru.ee/ee/remont> |
| Invaru | Üürimine | <https://www.invaru.ee/ee/abivahendi-uurimine> |
| Invaru | Meil on häid uudiseid! Invaru e-poes saab abivahendeid osta nüüd riikliku soodustusega! | <https://www.invaru.ee/ee/meil-on-haid-uudiseid-invaru-e-poes-saab-abivahendeid-osta-nuud-riikliku-soodustusega> |
| ITAK | ITAK Terviseabivahendid | <https://www.itak.ee/> |
| ITAK | ABIVAHENDITE LAENUTAMINE | <https://www.itak.ee/invaabivahendite-laenutus> |
| ITAK | ABIVAHENDITE REMONT JA HOOLDUS | <https://www.itak.ee/invaabivahendite-remont-ja-hooldus> |
| Jalaexpert | Vastuvõtt | <https://jalaexpert.ee/vastuvott> |
| Jalakabinet | Individuaalsed sisetallad lastele ja täiskasvanutele | <https://jalakabinet.ee/individuaalsed-sisetallad> |
| Jalakabinet | Ortoosid, ravijalanõud, geeltooted, kompressioonsukad ja -sokid | <https://jalakabinet.ee/> |
| Jalakabinet | Soodustused | <https://jalakabinet.ee/soodustused> |
| Kuuldeaparaadid OÜ | Kontakt | <https://kuuldeaparaadid.ee/kontakt> |
| Kuuldeaparaadid OÜ | Naudi enda ümbritsevat keskkonda | <https://kuuldeaparaadid.ee/> |
| Kuulmisrehabilitatsiooni Keskus | Ettevõttest | <https://heakuulmine.ee/ettevottest> |
| Kuulmisrehabilitatsiooni Keskus | Kuuldeaparaadi soetamine riigipoolse toetusega | <https://heakuulmine.ee/kuuldeaparaadi-soetamine-riigipoolse-toetusega> |
| Kuulmisrehabilitatsiooni Keskus | Meie eesmärk on luua maailm, kus kuulmislangus ei piira suhtlemist ega elurõõmu. | <https://heakuulmine.ee/> |
| Kuulmisrehabilitatsiooni Keskus | Teenused | <https://heakuulmine.ee/teenused> |
| Mediq Eesti | Mediq Eesti | <https://mediq.ee/> |
| Mediq Eesti | Mediq Eesti OÜ | <https://mediq.ee/et/meist> |
| Ortopeediakeskus | Kontakt | <https://ortopeediakeskus.ee/> |
| Ortopeediakeskus | Vastuvõtu ajad | <https://ortopeediakeskus.ee/vastuvotu-ajad> |
| Rol-Lift | Firmast/kontakt | <https://www.rol-lift.ee/et/> |
| Silmalaegas | Silmalaegas | <https://silmalaegas.laegas.ee/> |
| Teresa Abivahendikeskus | Teresa Abivahendikeskus | <https://teresa.ee/> |
| Teresa Abivahendikeskus | Ettevõttest | <https://teresa.ee/ettevottest> |
| Teresa Abivahendikeskus | Muretu ja aktiivne igapäev: Kuidas leida sobivad mähkmed ning kasutada riigisoodustust? | <https://teresa.ee/muretu-ja-aktiivne-igapaev-kuidas-leida-sobivad-mahkmed-ning-kasutada-riigisoodustust> |
| Teresa Abivahendikeskus | Rent | <https://teresa.ee/rent> |
| Teresa Abivahendikeskus | Teenused | <https://teresa.ee/teenused/abivahendite-hooldus-ja-remont> |
| Tervise Abi | Tervise Abi | <https://terviseabi.ee/> |
| Tervise Abi | Abivahendite rent | <https://terviseabi.ee/teenused/abivahendite-rent> |
| Tervise Abi | Abivahendite rent | <https://terviseabi.ee/abivahendite-rent> |
| Tervise Abi | Häirenupu täisteenus | <https://terviseabi.ee/hairenupu-taisteenus> |
| Tervise Abi | Kauplused | <https://terviseabi.ee/kauplused> |
| Tervise Abi | Koolitused | <https://terviseabi.ee/teenused/koolitused> |
| Tervise Abi | Kuulmisabivahendid, häiresüsteemid ja lisad | <https://terviseabi.ee/tootekategooria/kuulmisabivahendid/> |
| Tervise Abi | Tallinna sotsiaalvalveteenus | <https://terviseabi.ee/teenused/sotsiaalvalveteenus> |

### Organisatsioonide enda lehed (puuetega inimeste organisatsioonid, toidupank, sotsiaaltöö assotsiatsioon, kriisi- ja vaimse tervise ühingud) (1132)

| Väljaandja | Pealkiri | Aadress |
|---|---|---|
| Al-Anon Eesti | 12 sammu | <https://alanoneesti.wordpress.com/12-sammu> |
| Al-Anon Eesti | 12 traditsiooni | <https://alanoneesti.wordpress.com/12-traditsiooni> |
| Al-Anon Eesti | Alkohoolikute Täiskasvanud Lapsed | <https://alanoneesti.wordpress.com/atl> |
| Al-Anon Eesti | Korduma kippuvad küsimused | <https://alanoneesti.wordpress.com/lood> |
| Al-Anon Eesti | Tutvustus | <https://alanoneesti.wordpress.com/> |
| Anonüümsed Alkohoolikud | 12 sammu | <https://aaestonia.com/mis-on-aa/12-sammu/> |
| Anonüümsed Alkohoolikud | 12 traditsiooni | <https://aaestonia.com/mis-on-aa/12-traditsiooni/> |
| Anonüümsed Alkohoolikud | 15 nõuannet | <https://aaestonia.com/alkoholiprobleem/15-nouannet/> |
| Anonüümsed Alkohoolikud | AA ei ole | <https://aaestonia.com/mis-on-aa/aa-ei-ole/> |
| Anonüümsed Alkohoolikud | AA on | <https://aaestonia.com/mis-on-aa/aa-on/> |
| Anonüümsed Alkohoolikud | AA roll ühiskonnas | <https://aaestonia.com/mis-on-aa/aa-roll-uhiskonnas/> |
| Anonüümsed Alkohoolikud | AA-st lähemalt | <https://aaestonia.com/mis-on-aa/aa-st-lahemalt/> |
| Anonüümsed Alkohoolikud | Alkoholiprobleem? | <https://aaestonia.com/alkoholiprobleem/> |
| Anonüümsed Alkohoolikud | Anonüümsus | <https://aaestonia.com/mis-on-aa/anonuumsus/> |
| Anonüümsed Alkohoolikud | Kas AA on sinu jaoks? | <https://aaestonia.com/alkoholiprobleem/kas-aa-on-sinu-jaoks/> |
| Anonüümsed Alkohoolikud | Kas AA sobib kõigile? | <https://aaestonia.com/alkoholiprobleem/kas-aa-sobib-koigile/> |
| Anonüümsed Alkohoolikud | Korduma kippuvad küsimused | <https://aaestonia.com/mis-on-aa/korduma-kippuvad-kusimused/> |
| Anonüümsed Alkohoolikud | Kuidas AA rühm toimib | <https://aaestonia.com/alkoholiprobleem/kuidas-aa-ruhm-toimib/> |
| Anonüümsed Alkohoolikud | Miks me oleme täna siin | <https://aaestonia.com/alkoholiprobleem/miks-me-oleme-tana-siin/> |
| Anonüümsed Alkohoolikud | Mis anonüümsus tähendab? | <https://aaestonia.com/ajakirjandus/mis-anonuumsus-tahendab/> |
| Anonüümsed Alkohoolikud | Mis on AA? | <https://aaestonia.com/mis-on-aa/> |
| Anonüümsed Alkohoolikud | Sotsiaaltöötajatele | <https://aaestonia.com/ajakirjandus/sotsiaaltootajatele/> |
| Anonüümsed Alkohoolikud | Teavet AA lahtiste koosolekute kohta | <https://aaestonia.com/ajakirjandus/teavet-aa-lahtiste-koosolekute-kohta/> |
| Anonüümsed Alkohoolikud | Tere tulemast! | <https://aaestonia.com/alkoholiprobleem/tere-tulemast/> |
| Anonüümsed Alkohoolikud | Tervishoiutöötajatele | <https://aaestonia.com/ajakirjandus/tervishoiutootajatele/> |
| Anonüümsed Alkohoolikud | Tööandjatele | <https://aaestonia.com/ajakirjandus/tooandjatele/> |
| Convictus Eesti MTÜ | Convictus Eesti MTÜ | <https://www.convictus.ee/> |
| Convictus Eesti MTÜ | HIV ja C-hepatiit kiirtestimine | <https://www.convictus.ee/teenused/hiv-ja-c-hepatiit-kiirtestimine> |
| Convictus Eesti MTÜ | Kahjude vähendaja nõustamine | <https://www.convictus.ee/teenused/kahjude-vahendaja-noustamine> |
| Convictus Eesti MTÜ | Kahjude vähendamise buss | <https://www.convictus.ee/keskused/kahjude-vahendamise-buss> |
| Convictus Eesti MTÜ | Kahjude vähendamise teenus välitööna | <https://www.convictus.ee/teenused/kahjude-vahendamise-teenus-valitoona> |
| Convictus Eesti MTÜ | Kogemusnõustamine | <https://www.convictus.ee/teenused/kogemusnoustamine> |
| Convictus Eesti MTÜ | Kuidas käituda kui näen kasutatud süstalt? | <https://www.convictus.ee/uudised/kuidas-kaituda-kui-naen-kasutatud-sustalt> |
| Convictus Eesti MTÜ | Lastekodu 6 Kahjude Vähendamise Keskus | <https://www.convictus.ee/keskused/lastekodu> |
| Convictus Eesti MTÜ | Leia abi: Kogukond | <https://www.convictus.ee/kogukond> |
| Convictus Eesti MTÜ | Leia abi: Lähedane | <https://www.convictus.ee/lahedane> |
| Convictus Eesti MTÜ | Leia abi: Tarvitajale | <https://www.convictus.ee/tarvitaja> |
| Convictus Eesti MTÜ | Loovteraapia | <https://www.convictus.ee/teenused/loovteraapia> |
| Convictus Eesti MTÜ | Maardu Kahjude Vähendamise Keskus | <https://www.convictus.ee/keskused/maardu> |
| Convictus Eesti MTÜ | Ohtlike jäätmete kogumine | <https://www.convictus.ee/teenused/kasutatud-tarvikute-kogumine> |
| Convictus Eesti MTÜ | Ohutu tarvitamine ja üledooside ennetamine (Naloksoon) | <https://www.convictus.ee/teenused/ohutu-tarvitamine-ja-uledooside-ennetamine-naloksoon> |
| Convictus Eesti MTÜ | Plasti 23 Kahjude Vähendamise Keskus | <https://www.convictus.ee/keskused/plasti> |
| Convictus Eesti MTÜ | Programm SÜTIK | <https://www.convictus.ee/programm-sutik> |
| Convictus Eesti MTÜ | Psühholoogiline nõustamine | <https://www.convictus.ee/teenused/psuhholoogiline-noustamine> |
| Convictus Eesti MTÜ | Päevakeskus | <https://www.convictus.ee/teenused/paevakeskus> |
| Convictus Eesti MTÜ | Rakvere Kahjude Vähendamise Keskus | <https://www.convictus.ee/keskused/rakvere> |
| Convictus Eesti MTÜ | Sitsi 28 Kahjude Vähendamise Keskus | <https://www.convictus.ee/keskused/sitsi> |
| Convictus Eesti MTÜ | Sotsiaalnõustamine | <https://www.convictus.ee/teenused/sotsiaalnoustamine> |
| Convictus Eesti MTÜ | Süstlavahetus ja tarvikute jagamine | <https://www.convictus.ee/teenused/sustlavahetus-ja-tarvikute-jagamine> |
| Convictus Eesti MTÜ | Toidu- ja riideabi | <https://www.convictus.ee/teenused/toidu-ja-riideabi> |
| Convictus Eesti MTÜ | Tugigrupid ja nõustamine vanglates | <https://www.convictus.ee/teenused/tugigrupid-ja-noustamine-vanglates> |
| Convictus Eesti MTÜ | Tugigrupp naistele | <https://www.convictus.ee/teenused/tugigrupp-naistele> |
| Convictus Eesti MTÜ | Tugiisiku nõustamine | <https://www.convictus.ee/teenused/tugiisiku-noustamine> |
| Convictus Eesti MTÜ | Turvaline seksuaalkäitumine | <https://www.convictus.ee/teenused/turvaline-seksuaalkaitumine> |
| Dementsuse Kompetentsikeskus | Dementsuse Kompetentsikeskus | <https://dementsus.ee/dementsuse-kompetentsikeskus> |
| Dementsuse Kompetentsikeskus | Abivahendid | <https://dementsus.ee/abivahendid> |
| Dementsuse Kompetentsikeskus | Dementsus | <https://dementsus.ee/dementsus> |
| Dementsuse Kompetentsikeskus | Dementsus õppekavades | <https://dementsus.ee/dementsus-oppekavades> |
| Dementsuse Kompetentsikeskus | Dementsuse diagnoosimine | <https://dementsus.ee/dementsuse-diagnoosimine> |
| Dementsuse Kompetentsikeskus | Dementsuse Sõprade liikumine | <https://dementsus.ee/dementsuse-soprade-liikumine> |
| Dementsuse Kompetentsikeskus | Dementsuse sümptomid ja staadiumid | <https://dementsus.ee/dementsuse-sumptomid> |
| Dementsuse Kompetentsikeskus | Dementsusesõbralik asutus | <https://dementsus.ee/dementsusesobralik-asutus> |
| Dementsuse Kompetentsikeskus | Dementsusesõbralik ühiskond | <https://dementsus.ee/dementsusesobralik-uhiskond> |
| Dementsuse Kompetentsikeskus | Eneseabi | <https://dementsus.ee/eneseabi> |
| Dementsuse Kompetentsikeskus | Hooldekodu | <https://dementsus.ee/hooldekodu> |
| Dementsuse Kompetentsikeskus | Info ja usaldusliin 644 6440 | <https://dementsus.ee/teenused-2> |
| Dementsuse Kompetentsikeskus | Kadumise ennetamine | <https://dementsus.ee/kadumise-ennetamine> |
| Dementsuse Kompetentsikeskus | Kodu kohandamine | <https://dementsus.ee/kodu-kohandamine> |
| Dementsuse Kompetentsikeskus | Kohaliku omavalitsuse abi | <https://dementsus.ee/kohaliku-omavalitsuse-abi> |
| Dementsuse Kompetentsikeskus | Konverentsid ja seminarid | <https://dementsus.ee/konverentsid-ja-seminarid> |
| Dementsuse Kompetentsikeskus | Korduma kippuvad küsimused | <https://dementsus.ee/korduma-kippuvad-kusimused> |
| Dementsuse Kompetentsikeskus | Koroonaviirus ja dementsus | <https://dementsus.ee/koroonaviirus-ja-dementsus> |
| Dementsuse Kompetentsikeskus | Liikumine | <https://dementsus.ee/liikumine> |
| Dementsuse Kompetentsikeskus | Normaalne vananemine | <https://dementsus.ee/normaalne-vananemine> |
| Dementsuse Kompetentsikeskus | Ohjeldamise alternatiivid | <https://dementsus.ee/ohjeldamise-alternatiivid> |
| Dementsuse Kompetentsikeskus | Oleme Teile abiks ja toeks lahenduste leidmisel | <https://dementsus.ee/> |
| Dementsuse Kompetentsikeskus | Palliatiivne ravi dementsusega inimesele | <https://dementsus.ee/palliatiivne-ravi-dementsusega-inimesele> |
| Dementsuse Kompetentsikeskus | Partnerid | <https://dementsus.ee/partnerid> |
| Dementsuse Kompetentsikeskus | Pöördumatud dementsussündroomid | <https://dementsus.ee/poordumatud-dementsussundroomid> |
| Dementsuse Kompetentsikeskus | Pöörduvad dementsussündroomid | <https://dementsus.ee/poorduvad-dementsussundroomid> |
| Dementsuse Kompetentsikeskus | Rahvusvaheline teadus- ja arendustöö | <https://dementsus.ee/rahvusvaheline-teadus-ja-arendustoo> |
| Dementsuse Kompetentsikeskus | Rehabilitatsiooniteenus | <https://dementsus.ee/rehabilitatsiooniteenus> |
| Dementsuse Kompetentsikeskus | Riietumine | <https://dementsus.ee/riietumine> |
| Dementsuse Kompetentsikeskus | Statistika | <https://dementsus.ee/statistika> |
| Dementsuse Kompetentsikeskus | Suhtlemine dementsusega inimesega | <https://dementsus.ee/suhtlemine-dementsusega-inimesega> |
| Dementsuse Kompetentsikeskus | Teadus- ja arendustööd Eestis | <https://dementsus.ee/teadus-ja-arendustood-eestis> |
| Dementsuse Kompetentsikeskus | Testi ennast | <https://dementsus.ee/testi-ennast> |
| Dementsuse Kompetentsikeskus | Toitumine | <https://dementsus.ee/toitumine> |
| Dementsuse Kompetentsikeskus | Tugigrupid lähedastele | <https://dementsus.ee/tugigrupid-lahedastele> |
| Dementsuse Kompetentsikeskus | Töötamine | <https://dementsus.ee/tootamine> |
| Dementsuse Kompetentsikeskus | Õiguslikud küsimused | <https://dementsus.ee/oiguslikud-kusimused> |
| Eesti Afaasialiit | AFAASIA | <https://afaasia.ee/afaasia> |
| Eesti Afaasialiit | Afaasialiidu suhtlusklubi | <https://afaasia.ee/afaasialiidu-suhtlusklubi> |
| Eesti Afaasialiit | Eesti Afaasialiidu eetikakoodeks | <https://afaasia.ee/organisatsioon/eetikakoodeks> |
| Eesti Afaasialiit | Infolehed | <https://afaasia.ee/organisatsioon/infolehed> |
| Eesti Afaasialiit | Juuni – afaasia teadlikustamise kuu! | <https://afaasia.ee/afaasia/juuni-afaasia-teadlikustamise-kuu> |
| Eesti Afaasialiit | Kust saada abi? | <https://afaasia.ee/afaasia/kust-saada-abi> |
| Eesti Afaasialiit | Mis on afaasia? | <https://afaasia.ee/afaasia/mis-on-afaasia> |
| Eesti Afaasialiit | Nõuandeid suhtlemiseks inimesega, kellel on afaasia. | <https://afaasia.ee/afaasia/nouandeid-suhtlemiseks-inimesega-kellel-on-afaasia> |
| Eesti Afaasialiit | PROJEKTID | <https://afaasia.ee/projektid> |
| Eesti Afaasialiit | TEENUSED/HINNAKIRI | <https://afaasia.ee/teenused-hinnakiri> |
| Eesti Allergialiit | Ajakirjad | <https://allergialiit.ee/ajakirjad> |
| Eesti Allergialiit | Allergia | <https://allergialiit.ee/allergia> |
| Eesti Allergialiit | Allergia ja rasedus | <https://allergialiit.ee/allergia/allergia-ja-rasedus> |
| Eesti Allergialiit | Allergia ja reisimine | <https://allergialiit.ee/allergia/allergia-ja-reisimine> |
| Eesti Allergialiit | Allergiku elukeskkond | <https://allergialiit.ee/allergiku-elukeskkond> |
| Eesti Allergialiit | Allergiku ravi | <https://allergialiit.ee/ravi> |
| Eesti Allergialiit | Artiklid | <https://allergialiit.ee/artiklid> |
| Eesti Allergialiit | Astma | <https://allergialiit.ee/astma> |
| Eesti Allergialiit | Ehted | <https://allergialiit.ee/ehted> |
| Eesti Allergialiit | Inhalaator | <https://allergialiit.ee/ravi/inhalaator> |
| Eesti Allergialiit | Keskkond | <https://allergialiit.ee/keskkond> |
| Eesti Allergialiit | Kodu | <https://allergialiit.ee/kodu> |
| Eesti Allergialiit | Kodukeemia | <https://allergialiit.ee/kodu/kodukeemia> |
| Eesti Allergialiit | Kodukoristus | <https://allergialiit.ee/kodu/kodukoristus> |
| Eesti Allergialiit | Kosmeetika ja hooldusvahendid | <https://allergialiit.ee/kosmeetika> |
| Eesti Allergialiit | Liidust | <https://allergialiit.ee/liidust> |
| Eesti Allergialiit | Liikmed | <https://allergialiit.ee/liidust/liikmed> |
| Eesti Allergialiit | Pesupesemine | <https://allergialiit.ee/kodu/pesupesemine> |
| Eesti Allergialiit | Pollinoos | <https://allergialiit.ee/keskkond/pollinoos> |
| Eesti Allergialiit | Putukad | <https://allergialiit.ee/keskkond/putukad> |
| Eesti Allergialiit | Teabematerjal | <https://allergialiit.ee/teabematerjal> |
| Eesti Allergialiit | Tegevused | <https://allergialiit.ee/liidust/tegevused> |
| Eesti Allergialiit | Viimati lisatud teabematerjalid | <https://allergialiit.ee/> |
| Eesti Allergialiit | Vooditarbed | <https://allergialiit.ee/kodu/vooditarbed> |
| Eesti Allergialiit | Õietolmu seire | <https://allergialiit.ee/oietolmu-seire> |
| Eesti Allergialiit | Õietolmuallergia | <https://allergialiit.ee/keskkond/oietolmuallergia> |
| Eesti Autismiliit | Eesti Autismiliit | <https://www.autismiliit.ee/> |
| Eesti Autismiliit | Artiklid | <https://www.autismiliit.ee/publikatsioon/artikleid> |
| Eesti Autismiliit | Autismispektri häired | <https://www.autismiliit.ee/autismist/autismihairete-spekter> |
| Eesti Autismiliit | Autismist | <https://www.autismiliit.ee/autismist> |
| Eesti Autismiliit | Dokumendid | <https://www.autismiliit.ee/meist/dokumendid> |
| Eesti Autismiliit | Eetilised põhimõtted | <https://www.autismiliit.ee/meist/eetilised-pohimotted> |
| Eesti Autismiliit | Epilepsia | <https://www.autismiliit.ee/autismist/kaasnevaid-probleeme/epilepsia> |
| Eesti Autismiliit | Intellektipuue | <https://www.autismiliit.ee/autismist/kaasnevaid-probleeme/intellektipuue> |
| Eesti Autismiliit | Juhendmaterjale lapsevanematele | <https://www.autismiliit.ee/autismist/lapsevanematele/juhendmaterjale-lapsevanematele> |
| Eesti Autismiliit | Kaasuvad häired ja probleemid | <https://www.autismiliit.ee/autismist/kaasnevaid-probleeme> |
| Eesti Autismiliit | Kuidas saada liikmeks | <https://www.autismiliit.ee/meist/liikmed> |
| Eesti Autismiliit | Lapsevanematele | <https://www.autismiliit.ee/autismist/lapsevanematele> |
| Eesti Autismiliit | Lingid | <https://www.autismiliit.ee/lingid> |
| Eesti Autismiliit | Meist | <https://www.autismiliit.ee/meist> |
| Eesti Autismiliit | Mida teha, kui laps saab ASH diagnoosi? | <https://www.autismiliit.ee/autismist/lapsevanematele/mida-teha-kui-laps-saab-ash-diagnoosi> |
| Eesti Autismiliit | Nõustamisvõimalused | <https://www.autismiliit.ee/autismist/lapsevanematele/noustamisvoimalused> |
| Eesti Autismiliit | Publikatsioon | <https://www.autismiliit.ee/publikatsioon> |
| Eesti Autismiliit | Põhjused | <https://www.autismiliit.ee/autismist/pohjused> |
| Eesti Autismiliit | Teatmikud | <https://www.autismiliit.ee/publikatsioon/teatmikud> |
| Eesti Autismiliit | Tourette´i sündroom | <https://www.autismiliit.ee/autismist/kaasnevaid-probleeme/tourettei-sundroom> |
| Eesti Diabeediliit | Diabeet Eestis | <https://www.diabetes.ee/organisatsioon/diabeet-eestis> |
| Eesti Diabeediliit | Eesti Diabeediliidu struktuur | <https://www.diabetes.ee/organisatsioon/eesti-diabeediliidu-struktuur> |
| Eesti Diabeediliit | I tüübi diabeet | <https://www.diabetes.ee/organisatsioon/i-tueuebi-diabeet> |
| Eesti Diabeediliit | II tüübi diabeet | <https://www.diabetes.ee/organisatsioon/ii-tuubi-diabeet> |
| Eesti Diabeediliit | Kodanikuühenduste eetikakoodeks | <https://www.diabetes.ee/organisatsioon/kodanikuuehenduste-eetikakoodeks> |
| Eesti Diabeediliit | MIS ON DIABEET? | <https://www.diabetes.ee/mis-on-diabeet> |
| Eesti Diabeediliit | Mis on suhkruhaigus? | <https://www.diabetes.ee/organisatsioon/mis-on-suhkruhaigus> |
| Eesti Diabeediliit | Toitumissoovitused diabeetikule | <https://www.diabetes.ee/organisatsioon/toitumissoovitused-diabeetikule> |
| Eesti Hemofiiliaühing | Eesti Hemofiiliaühing | <https://www.hemofiilia.ee/> |
| Eesti Hemofiiliaühing | 7-2-1 | <https://www.hemofiilia.ee/7-2-1> |
| Eesti Hemofiiliaühing | Haiglad Eestis | <https://www.hemofiilia.ee/haiglad-eestis> |
| Eesti Hemofiiliaühing | Infomaterjalid | <https://www.hemofiilia.ee/meist/infomaterjalid> |
| Eesti Hemofiiliaühing | Tegevused | <https://www.hemofiilia.ee/tegevused> |
| Eesti Hemofiiliaühing | Veritsushäiretest | <https://www.hemofiilia.ee/meist/veritsushairetest> |
| Eesti Inimõiguste Keskus | Eesti Inimõiguste Keskus | <https://humanrights.ee/tegevus/keskus/> |
| Eesti Inimõiguste Keskus | Eesti Inimõiguste Keskus ja digitaalõigused | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/eesti-inimoiguste-keskus-ja-digitaaloigused/> |
| Eesti Inimõiguste Keskus | 7 sammu mitmekesisuse ja kaasatuse arendamiseks | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/7-sammu-mitmekesisuse-vaartustamiseks/> |
| Eesti Inimõiguste Keskus | Avaliku arvamuse uuring LGBT teemadel (2026) | <https://humanrights.ee/materjalid/avaliku-arvamuse-uuring-lgbt-teemadel-2026/> |
| Eesti Inimõiguste Keskus | Diskrimineerimise keeld | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/diskrimineerimise-keeld/> |
| Eesti Inimõiguste Keskus | Diskrimineerimise keeld rahvusvahelistes õigusaktides | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/diskrimineerimise-keeld-rahvusvahelistes-oigusaktides/> |
| Eesti Inimõiguste Keskus | Ebaregulaarsed sisserändajad – küsimused ja vastused | <https://humanrights.ee/teemad/pagulased/ebaregulaarsed-sisserandajad/> |
| Eesti Inimõiguste Keskus | Eessõna | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/eessona/> |
| Eesti Inimõiguste Keskus | Eesti elanike hoiakud LGBT teemadel | <https://humanrights.ee/eesti-elanike-hoiakud-lgbt-teemadel/> |
| Eesti Inimõiguste Keskus | Halduskius sõjaväeteenistuses osalemise tõlgendamisel | <https://humanrights.ee/kaasused/halduskius-sojavaeteenistuses-osalemise-tolgendamisel/> |
| Eesti Inimõiguste Keskus | Hea lugeja | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/hea-lugeja/> |
| Eesti Inimõiguste Keskus | Iga klikk loeb, ka sinu andmeid! | <https://humanrights.ee/iga-klikk-loeb-ka-sinu-andmeid/> |
| Eesti Inimõiguste Keskus | Infomaterjal vaenukõne ja -kuritegude kohta | <https://humanrights.ee/materjalid/materjal-vaenu-kohta/> |
| Eesti Inimõiguste Keskus | Inimõigused ja inimõiguste alusväärtused Eesti koolis ja hariduspoliitikas | <https://humanrights.ee/materjalid/inimoigused-ja-inimoiguste-alusvaartused-eesti-koolis-ja-hariduspoliitikas/> |
| Eesti Inimõiguste Keskus | Inimõigused, infoühiskond ja Eesti: esialgne kaardistus | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/> |
| Eesti Inimõiguste Keskus | Inimõigusi edendava projekti või tegevuse kavandamise ja elluviimise juhend | <https://humanrights.ee/materjalid/inimoigushariduse-tegevuste-kavandamise-ja-elluviimise-juhend/> |
| Eesti Inimõiguste Keskus | Inimõiguste hariduse meetodid noorsootöötajatele | <https://humanrights.ee/materjalid/inimoiguste-hariduse-meetodid-noorsootootajatele/> |
| Eesti Inimõiguste Keskus | Inimõiguste kaitsjad | <https://humanrights.ee/teemad/inimoigused-eestis/inimoiguste-kaitsjad/> |
| Eesti Inimõiguste Keskus | Isikuandmete kaitse | <https://humanrights.ee/tegevus/keskus/isikuandmete-kaitse/> |
| Eesti Inimõiguste Keskus | Juhend “Seksuaalse ja soolise ahistamise ennetamine töökohal” | <https://humanrights.ee/materjalid/juhend-seksuaalse-ja-soolise-ahistamise-ennetamine-tookohal/> |
| Eesti Inimõiguste Keskus | Kaardimäng seksuaalse ja soolise mitmekesisusega seotud mõistete kohta | <https://humanrights.ee/materjalid/kaardimang-seksuaalse-ja-soolise-mitmekesisusega-seotud-moistete-kohta/> |
| Eesti Inimõiguste Keskus | Kes vastutab ja mille eest? | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/kes-vastutab-ja-mille-eest/> |
| Eesti Inimõiguste Keskus | Kogunemisvabaduse piiramine avaliku võimu poolt | <https://humanrights.ee/kaasused/kogunemisvabaduse-piiramine-avaliku-voimu-poolt/> |
| Eesti Inimõiguste Keskus | Kokkuvõte lihtsas keeles | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/lihtsas-keeles-kokkuvote/> |
| Eesti Inimõiguste Keskus | Koolitused | <https://humanrights.ee/teemad/mitmekesisus-ja-kaasatus/koolitused/> |
| Eesti Inimõiguste Keskus | Kuidas luua mitmekesisust ja erinevusi väärtustavat ning kaasavat töökeskkonda? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/> |
| Eesti Inimõiguste Keskus | Kuidas luua toetav ja turvaline töökeskkond eri kultuuritaustaga inimestele? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/kuidas-luua-toetav-ja-turvaline-tookeskkond-eri-kultuuritaustaga-inimestele/> |
| Eesti Inimõiguste Keskus | Kuidas luua toetav töökeskkond ATH-ga või autistlikule inimesele? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/kuidas-luua-toetav-tookeskkond-ath-ga-voi-autistlikule-inimesele/> |
| Eesti Inimõiguste Keskus | Kuidas mõõta mitmekesisust ja kaasatust? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/kuidas-moota-mitmekesisust-ja-kaasatust/> |
| Eesti Inimõiguste Keskus | Lahendused ja ideed teadlikkuse tõstmiseks | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/lahendused-ja-ideed-teadlikkuse-tostmiseks/> |
| Eesti Inimõiguste Keskus | LGBT+ inimeste olukord | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/lgbt-inimeste-olukord/> |
| Eesti Inimõiguste Keskus | LGBTI+ filmifestival Festheart | <https://humanrights.ee/kaasused/lgbti-filmifestival-festheart/> |
| Eesti Inimõiguste Keskus | Materjalid | <https://humanrights.ee/materjalid/> |
| Eesti Inimõiguste Keskus | Meedia ja vähemused | <https://humanrights.ee/materjalid/meedia-ja-vahemused/> |
| Eesti Inimõiguste Keskus | Mida teha? | <https://humanrights.ee/teemad/vaen/mida-teha/> |
| Eesti Inimõiguste Keskus | Miks on mitmekesisuse väärtustamine kasulik? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/miks-on-mitmekesisuse-vaartustamine-kasulik/> |
| Eesti Inimõiguste Keskus | Miks on vaja soolist palgalõhet mõõta ja vähendada? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/miks-on-vaja-soolist-palgalohet-moota-ja-vahendada/> |
| Eesti Inimõiguste Keskus | Mis edasi? | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/mis-edasi/> |
| Eesti Inimõiguste Keskus | Mis on ligipääsetavus ja kuidas seda tagada? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/mis-on-ligipaasetavus-ja-kuidas-seda-tagada/> |
| Eesti Inimõiguste Keskus | Mis on mitmekesisus ja kaasatus? | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/mis-on-mitmekesisus-ja-kaasatus/> |
| Eesti Inimõiguste Keskus | Mis on võrdne kohtlemine? | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/mis-on-vordne-kohtlemine/> |
| Eesti Inimõiguste Keskus | Mitmekesisuse arendamise riskid | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/mitmekesisuse-riskid/> |
| Eesti Inimõiguste Keskus | Mitmekesisuse kuu | <https://humanrights.ee/teemad/mitmekesisus-ja-kaasatus/mitmekesisuse-kuu/> |
| Eesti Inimõiguste Keskus | Mitmekesisuse päeva tööriistakast | <https://humanrights.ee/materjalid/mitmekesisuse-paeva-tooriistakast/> |
| Eesti Inimõiguste Keskus | Mitmekesisuse töökoha märgis | <https://humanrights.ee/materjalid/mitmekesisuse-tookoha-margis/> |
| Eesti Inimõiguste Keskus | Nõustamine | <https://humanrights.ee/noustamine/> |
| Eesti Inimõiguste Keskus | Olukord Eestis | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/olukord-eestis/> |
| Eesti Inimõiguste Keskus | Olulised institutsioonid Eestis | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/olulised-institutsioonid-eestis/> |
| Eesti Inimõiguste Keskus | Pagulaste ja varjupaigataotlejate õigused | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/pagulaste-ja-varjupaigataotlejate-oigused/> |
| Eesti Inimõiguste Keskus | Pagulaste palkamine Eesti tööturul | <https://humanrights.ee/materjalid/pagulaste-palkamine-eesti-tooturul/> |
| Eesti Inimõiguste Keskus | Perekonna taasühinemine | <https://humanrights.ee/kaasused/perekonna-taasuhinemine/> |
| Eesti Inimõiguste Keskus | Piinamise, ebainimlikult või alandavalt kohtlemise ja karistamise keeld | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/piinamise-ebainimlikult-voi-alandavalt-kohtlemise-ja-karistamise-keeld/> |
| Eesti Inimõiguste Keskus | Projekt SafeNet | <https://humanrights.ee/teemad/vaen/sotsiaalmeedia/> |
| Eesti Inimõiguste Keskus | Puuetega inimeste olukord | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/puuetega-inimeste-olukord/> |
| Eesti Inimõiguste Keskus | Põhiõigustele avalduva mõju hindamise kontrollnimekiri tehisintellektisüsteemide puhul | <https://humanrights.ee/materjalid/pohioigustele-avalduva-moju-hindamise-kontrollnimekiri-tehisintellektisusteemide-puhul/> |
| Eesti Inimõiguste Keskus | Põimõppekursus “Mitmekesisus ja kaasatus” | <https://humanrights.ee/materjalid/poimoppekursus-mitmekesisus-ja-kaasatus/> |
| Eesti Inimõiguste Keskus | Rahvusvähemused ja lõimumispoliitika | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/rahvusvahemused-ja-loimumispoliitika/> |
| Eesti Inimõiguste Keskus | Saa teadmisi inimõiguste kohta eri teemade ja igapäevaste olukordade kaudu | <https://humanrights.ee/teemad/inimoigused-eestis/inimoiguste-e-giid/> |
| Eesti Inimõiguste Keskus | Sissejuhatus | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/sissejuhatus/> |
| Eesti Inimõiguste Keskus | Sooline võrdsus | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/sooline-vordsus/> |
| Eesti Inimõiguste Keskus | Strateegiline hagelemine | <https://humanrights.ee/teemad/strateegiline-hagelemine/> |
| Eesti Inimõiguste Keskus | Sõbraliku tööandja juhend | <https://humanrights.ee/materjalid/sobraliku-tooandja-juhend/> |
| Eesti Inimõiguste Keskus | Sõnavabadus | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/sonavabadus/> |
| Eesti Inimõiguste Keskus | Taustauuring TI kasutamise mõju kohta põhiõigustele (inglise keeles) | <https://humanrights.ee/materjalid/taustauuring-ti-kasutamise-moju-kohta-pohioigustele-inglise-keeles/> |
| Eesti Inimõiguste Keskus | Teema 1: profileerimine ja riik | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/teema-1-profileerimine-ja-riik/> |
| Eesti Inimõiguste Keskus | Teema 2: Isikuandmete kaitse üldmääruse (GDPR) rakendamine | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/teema-2-isikuandmete-kaitse-uldmaaruse-gdpr-rakendamine/> |
| Eesti Inimõiguste Keskus | Teema 3: Väljendusvabadus internetis | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/teema-3-valjendusvabadus-internetis/> |
| Eesti Inimõiguste Keskus | Teemad | <https://humanrights.ee/teemad/> |
| Eesti Inimõiguste Keskus | Teemade kaardistus | <https://humanrights.ee/materjalid/inimoigused-infouhiskond-ja-eesti-esialgne-kaardistus/teemade-kaardistus/> |
| Eesti Inimõiguste Keskus | Tehisintellekt ja EL põhiõiguste harta (poliitikadokument) | <https://humanrights.ee/materjalid/poliitikadokument/> |
| Eesti Inimõiguste Keskus | Tehisintellektisüsteemide arendamine ja põhiõigused: teadlikkuse tagamise, hindamise ja vastutuse hea tava | <https://humanrights.ee/materjalid/tehisintellektisusteemide-arendamine-ja-pohioigused-teadlikkuse-tagamise-hindamise-ja-vastutuse-hea-tava/> |
| Eesti Inimõiguste Keskus | Turvaline ruum noorsootöös – põhimõtted ja soovitused noorsootöötajatele | <https://humanrights.ee/materjalid/turvaline-ruum-noorsootoos-pohimotted-ja-soovitused-noorsootootajatele/> |
| Eesti Inimõiguste Keskus | Töö- ja pereelu ühitamise parimad praktikad | <https://humanrights.ee/materjalid/too-ja-pereelu-uhitamise-parimad-praktikad/> |
| Eesti Inimõiguste Keskus | Usaldusväärne tööandja ennetab ahistamist ja loob turvalise töökeskkonna | <https://humanrights.ee/materjalid/kuidas-luua-mitmekesisust-ja-erinevusi-vaartustavat-ning-kaasavat-tookeskkonda/usaldusvaarne-tooandja-ennetab-ahistamist-ja-loob-turvalise-tookeskkonna/> |
| Eesti Inimõiguste Keskus | Uuring “Mitmekesisus ja kaasatus tööandjate pilgu läbi” | <https://humanrights.ee/materjalid/uuring-mitmekesisus-ja-kaasatus-tooandjate-pilgu-labi/> |
| Eesti Inimõiguste Keskus | Vaenukõne ja vaenukuriteod | <https://humanrights.ee/teemad/vaen/vaenukone/> |
| Eesti Inimõiguste Keskus | Varjupaigataotlejate ja pagulaste nõustamine | <https://humanrights.ee/teemad/pagulased/varjupaigataotlejate-noustamine/> |
| Eesti Inimõiguste Keskus | Vene pagulaspere lapsendamise kaasus | <https://humanrights.ee/kaasused/pagulaspere-lapsendamise-kaasus/> |
| Eesti Inimõiguste Keskus | Võitlus vaenu vastu | <https://humanrights.ee/teemad/vaen/> |
| Eesti Inimõiguste Keskus | Võrdse kohtlemise käsiraamat | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/> |
| Eesti Inimõiguste Keskus | Võrdse kohtlemise normid ja diskrimineerimise keeld Eesti seadustes | <https://humanrights.ee/materjalid/vordse-kohtlemise-kasiraamat/vordse-kohtlemise-normid-ja-diskrimineerimise-keeld-eesti-seadustes/> |
| Eesti Inimõiguste Keskus | Võrdse kohtlemise võrgustik | <https://humanrights.ee/teemad/vordne-kohtlemine/vordse-kohtlemise-vorgustik/> |
| Eesti Inimõiguste Keskus | Võrdse kohtlemise võrgustik | <https://humanrights.ee/teemad/inimoigused-eestis/vkv/> |
| Eesti Inimõiguste Keskus | Võta ühendust | <https://humanrights.ee/tegevus/keskus/vota-uhendust/> |
| Eesti Inimõiguste Keskus | Õigus perekonna- ja eraelu puutumatusele | <https://humanrights.ee/materjalid/inimoigused-eestis-2026/oigus-perekonna-ja-eraelu-puutumatusele/> |
| Eesti Inimõiguste Keskus | ÜRO inimõiguste ülevaatus | <https://humanrights.ee/uro-inimoiguste-ulevaatus/> |
| Eesti Insuldipatsientide Selts | 10 praktilist ideed insuldist taastumise teekonnal | <https://www.insuldiselts.ee/elu-parast-insulti/10-ideed-insuldist-taastumise-teekonnal> |
| Eesti Insuldipatsientide Selts | 4 olulist A-d | <https://www.insuldiselts.ee/mis-on-insult/4-olulist-a-d> |
| Eesti Insuldipatsientide Selts | Elu pärast insulti | <https://www.insuldiselts.ee/elu-parast-insulti> |
| Eesti Insuldipatsientide Selts | Igapäevaelu ja iseseisvumine | <https://www.insuldiselts.ee/elu-parast-insulti/igapaevaelu-ja-iseseisvumine> |
| Eesti Insuldipatsientide Selts | Insuldi alaliigid | <https://www.insuldiselts.ee/mis-on-insult/insuldi-alaliigid> |
| Eesti Insuldipatsientide Selts | Insuldi riskitegurid | <https://www.insuldiselts.ee/mis-on-insult/insuldi-riskitegurid> |
| Eesti Insuldipatsientide Selts | Insuldi statistika | <https://www.insuldiselts.ee/mis-on-insult/insuldi-statistika> |
| Eesti Insuldipatsientide Selts | Insuldi tagajärjed | <https://www.insuldiselts.ee/mis-on-insult/insuldi-tagajarjed> |
| Eesti Insuldipatsientide Selts | Insuldijärgne rehabilitatsioon | <https://www.insuldiselts.ee/elu-parast-insulti/insuldijargne-rehabilitatsioon> |
| Eesti Insuldipatsientide Selts | Insuldijärgne taastusravi | <https://www.insuldiselts.ee/elu-parast-insulti/insuldijargne-taastusravi> |
| Eesti Insuldipatsientide Selts | Insuldipatsiendi elukorraldus | <https://www.insuldiselts.ee/elu-parast-insulti/insuldipatsiendi-elukorraldus> |
| Eesti Insuldipatsientide Selts | Insuldiseltsi koostööpanus | <https://www.insuldiselts.ee/seltsist/koostoopanus> |
| Eesti Insuldipatsientide Selts | Kodu kohandamine pärast insulti | <https://www.insuldiselts.ee/elu-parast-insulti/kodu-kohandamine-parast-insulti> |
| Eesti Insuldipatsientide Selts | Konverentsid | <https://www.insuldiselts.ee/seltsist/konverentsid> |
| Eesti Insuldipatsientide Selts | Kvalifitseeritud spetsialistid | <https://www.insuldiselts.ee/infomaterjalid/kvalifitseeritud-spetsialistid> |
| Eesti Insuldipatsientide Selts | Mis on insult? | <https://www.insuldiselts.ee/mis-on-insult> |
| Eesti Insuldipatsientide Selts | Mobiilirakendused | <https://www.insuldiselts.ee/infomaterjalid/mobiilirakendused> |
| Eesti Insuldipatsientide Selts | Seltsist | <https://www.insuldiselts.ee/seltsist> |
| Eesti Insuldipatsientide Selts | Taastusravi asutused üle Eesti | <https://www.insuldiselts.ee/infomaterjalid/taastusravi-asutused-ule-eesti> |
| Eesti Insuldipatsientide Selts | Taastusravi koduteenused | <https://www.insuldiselts.ee/elu-parast-insulti/taastusravi-koduteenused> |
| Eesti Insuldipatsientide Selts | Teadus ja uuringud | <https://www.insuldiselts.ee/infomaterjalid/teadus-ja-uuringud> |
| Eesti Insuldipatsientide Selts | Toetame insuldipatsiendi heaolu , positiivset mõtlemist ja taastumisprotsessi . | <https://www.insuldiselts.ee/> |
| Eesti Insuldipatsientide Selts | Toitumine pärast insulti | <https://www.insuldiselts.ee/elu-parast-insulti/toitumine-parast-insulti> |
| Eesti Insuldipatsientide Selts | Tööle naasmine pärast insulti | <https://www.insuldiselts.ee/elu-parast-insulti/toole-naasmine-parast-insulti> |
| Eesti Insuldipatsientide Selts | Uue insuldi vältimine | <https://www.insuldiselts.ee/elu-parast-insulti/uue-insuldi-valtimine> |
| Eesti Insuldipatsientide Selts | Vaimne tervis pärast insulti | <https://www.insuldiselts.ee/elu-parast-insulti/vaimne-tervis-parast-insulti> |
| Eesti Juristide Liit | Jurist aitab | <https://www.juristaitab.ee/et> |
| Eesti Juristide Liit | Nõustamiskohad | <https://www.juristaitab.ee/et/noustamiskohad> |
| Eesti Juristide Liit | Teised õigusnõustajad | <https://www.juristaitab.ee/et/teised-oigusnoustajad> |
| Eesti Kogelejate Ühing | Eesti Kogelejate Ühing | <https://kogelus.ee/> |
| Eesti Kogelejate Ühing | Kõneravi lastele | <https://kogelus.ee/koneravi-lastele> |
| Eesti Kogelejate Ühing | Kõneravi täiskasvanutele | <https://kogelus.ee/koneravi-taiskasvanutele> |
| Eesti Kogelejate Ühing | Mis on kogelus? | <https://kogelus.ee/mis-kogelus> |
| Eesti Kogelejate Ühing | Noorsotöötajatele | <https://kogelus.ee/noorsotootajatele> |
| Eesti Kogelejate Ühing | Soovitused õpetajale | <https://kogelus.ee/soovitused-opetajale> |
| Eesti Kogelejate Ühing | Suurimad projektid | <https://kogelus.ee/projektid/suurimad-projektid> |
| Eesti Kogelejate Ühing | Vabaühenduste eetikakoodeks | <https://kogelus.ee/vabauhenduste-eetikakoodeks> |
| Eesti Kopsuliit | Eesti Kopsuliit | <https://www.kopsuliit.ee/> |
| Eesti Kopsuliit | ALLERGIA | <https://www.kopsuliit.ee/haigused/allergia> |
| Eesti Kopsuliit | ASTMA | <https://www.kopsuliit.ee/haigused/astma> |
| Eesti Kopsuliit | Astma ravi | <https://www.kopsuliit.ee/ravi/astma-ravi> |
| Eesti Kopsuliit | Astma test | <https://www.kopsuliit.ee/kasulik/astma-test> |
| Eesti Kopsuliit | Astu liikmeks | <https://www.kopsuliit.ee/kontakt/astu-liikmeks> |
| Eesti Kopsuliit | EKL trükised | <https://www.kopsuliit.ee/kasulik/ekl-trukised> |
| Eesti Kopsuliit | Fagerströmi Test | <https://www.kopsuliit.ee/kasulik/fagerstromi-test> |
| Eesti Kopsuliit | Haigused | <https://www.kopsuliit.ee/haigused> |
| Eesti Kopsuliit | Hapnikravi | <https://www.kopsuliit.ee/ravi/hapnikravi> |
| Eesti Kopsuliit | INTERSTITSIAARSED KOPSUHAIGUSED | <https://www.kopsuliit.ee/haigused/interstitsiaarsed-kopsuhaigused> |
| Eesti Kopsuliit | KOK | <https://www.kopsuliit.ee/haigused/kok> |
| Eesti Kopsuliit | KOK-test | <https://www.kopsuliit.ee/kasulik/kok-test> |
| Eesti Kopsuliit | KOPSUVÄHK | <https://www.kopsuliit.ee/haigused/kopsuvahk> |
| Eesti Kopsuliit | Muud trükised | <https://www.kopsuliit.ee/kasulik/muud-trukised> |
| Eesti Kopsuliit | OBSTRUKTIIVNE UNEAPNOE | <https://www.kopsuliit.ee/haigused/obstruktiivne-uneapnoe> |
| Eesti Kopsuliit | Organisatsioonist | <https://www.kopsuliit.ee/organisatsioonist/kes-me-oleme> |
| Eesti Kopsuliit | Ravivõimlemine | <https://www.kopsuliit.ee/ravi/-ravivoimlemine> |
| Eesti Kopsuliit | SARKOIDOOS | <https://www.kopsuliit.ee/haigused/sarkoidoos> |
| Eesti Kopsuliit | Struktuur | <https://www.kopsuliit.ee/organisatsioonist/struktuur> |
| Eesti Kopsuliit | Suitsetad? | <https://www.kopsuliit.ee/suitsetad> |
| Eesti Kopsuliit | Terved kopsud | <https://www.kopsuliit.ee/haigused/terved-kopsud> |
| Eesti Kopsuliit | TUBERKULOOS | <https://www.kopsuliit.ee/haigused/tuberkuloos> |
| Eesti Kurtide Liit | EKL | <https://www.ead.ee/kirjakast> |
| Eesti Kurtide Liit | Ettevõtted | <https://www.ead.ee/uhingud-ja-partnerid/ettevotted/eesti-kurtide-liidu-ettevotted> |
| Eesti Kurtide Liit | Kaks lähenemisviisi kurtusele | <https://www.ead.ee/haridus-ja-kultuur/kurtus/kaks-lahenemisviisi-kurtusele> |
| Eesti Kurtide Liit | Missioon ja väärtused | <https://www.ead.ee/organisatsioon/missioon-ja-vaartused/missioon-ja-pohivaartused> |
| Eesti Kurtide Liit | Organisatsioon | <https://www.ead.ee/organisatsioon/kontaktandmed/organisatsiooni-uldandmed> |
| Eesti Kurtide Liit | Organisatsioonid | <https://www.ead.ee/olulised-lingid/oluliste-liikmete-ja-partnerite-lingid> |
| Eesti Kurtide Liit | Ruumide rent | <https://www.ead.ee/organisatsioon/ruumide-rent/eesti-kurtide-liidu-maja-ruumide-rentimise-voimalused> |
| Eesti Kurtide Liit | Tallinna sotsiaalnõustamise teenus | <https://www.ead.ee/uhingud-ja-partnerid/tallinna-sotsiaalnoustamise-teenus/noustamisteenus-tallinna-kurtidele-ja-viipekeelsetele-vaegkuuljatele> |
| Eesti Kurtide Liit | Tallinna viipekeele tõlketeenus | <https://www.ead.ee/uhingud-ja-partnerid/tallinna-viipekeele-tolketeenus/tallinna-viipekeele-tolketeenuse-osutamine-kuulmispuudega-inimestele> |
| Eesti Kurtide Liit | Tõlkekeskused | <https://www.ead.ee/uhingud-ja-partnerid/tolkekeskused/tolkekeskused-ule-eesti> |
| Eesti Kurtide Liit | Viipekeel - iseseisev keel või abikeel? | <https://www.ead.ee/haridus-ja-kultuur/viipekeel/viipekeel-iseseisev-keel-voi-abikeel> |
| Eesti Kurtide Liit | Viipekeele e-sõnastikud | <https://www.ead.ee/haridus-ja-kultuur/viipekeele-e-sonastikud/viipekeele-e-sonastikud> |
| Eesti Kurtide Liit | Õppemeetodid ja tulemused | <https://www.ead.ee/haridus-ja-kultuur/haridus/oppemeetodid-ja-tulemused> |
| Eesti Kurtide Liit | Õppimisvõimalused | <https://www.ead.ee/haridus-ja-kultuur/haridus/oppimisvoimalused> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | EKLVL | <https://www.eklvl.ee/eklvl/liidust/eklvl> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Haridus | <https://www.eklvl.ee/kuulmispuudest/haridus> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Infoleht | <https://www.eklvl.ee/eklvl/infoleht> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Kuulmisabivahendid | <https://www.eklvl.ee/kuulmispuudest/kuulmisabivahendid> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Kuulmispuudega laste õpetamine | <https://www.eklvl.ee/eklvl/projektid/konverentsid/kuulmispuudega-laste-opetamine> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Kuulmispuudest | <https://www.eklvl.ee/kuulmispuudest> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Muud abivahendid | <https://www.eklvl.ee/kuulmispuudest/muud-abivahendid> |
| Eesti Kuulmispuuetega Laste Vanemate Liit | Teatmik puudega laste peredele | <https://www.eklvl.ee/kuulmispuudest/kasulik-info/teatmik-puudega-laste-peredele> |
| Eesti Lasterikaste Perede Liit | Avaliku suhtumise kujundamine | <https://www.lasterikkad.ee/avaliku-suhtumise-kujundamine/> |
| Eesti Lasterikaste Perede Liit | Eetikakoodeks | <https://www.lasterikkad.ee/meist/eetikakoodeks/> |
| Eesti Lasterikaste Perede Liit | Kogemusnoustamine | <https://www.lasterikkad.ee/kogemusnoustamine/> |
| Eesti Lasterikaste Perede Liit | Lääne-Harju Lasterikkad Laenutus | <https://www.lasterikkad.ee/laaneharju/meist/laenutus/> |
| Eesti Lasterikaste Perede Liit | Lääne-Harju Lasterikkad Meie | <https://www.lasterikkad.ee/laaneharju/meist/> |
| Eesti Lasterikaste Perede Liit | Lääne-Viru Lasterikkad Meist | <https://www.lasterikkad.ee/laane-viru/meist/> |
| Eesti Lasterikaste Perede Liit | Noustamine | <https://www.lasterikkad.ee/noustamine/?page_id=508> |
| Eesti Lasterikaste Perede Liit | Noustamine | <https://www.lasterikkad.ee/noustamine/?page_id=506> |
| Eesti Lasterikaste Perede Liit | Noustamine | <https://www.lasterikkad.ee/noustamine/?page_id=151> |
| Eesti Lasterikaste Perede Liit | Noustamine | <https://www.lasterikkad.ee/noustamine/?page_id=163> |
| Eesti Lasterikaste Perede Liit | Noustamine | <https://www.lasterikkad.ee/noustamine/?page_id=165> |
| Eesti Lasterikaste Perede Liit | Noustamine | <https://www.lasterikkad.ee/noustamine/?page_id=4> |
| Eesti Lasterikaste Perede Liit | Peresobralik toitlustusasutus | <https://www.lasterikkad.ee/avaliku-suhtumise-kujundamine/peresobralik-toitlustusasutus/> |
| Eesti Lasterikaste Perede Liit | Peretunde loomine | <https://www.lasterikkad.ee/peretunde-loomine/> |
| Eesti Lasterikaste Perede Liit | Pärnumaa Lasterikkad Meist | <https://www.lasterikkad.ee/parnumaa/meist/> |
| Eesti Lasterikaste Perede Liit | Raplamaa Lasterikkad Meist | <https://www.lasterikkad.ee/raplamaa/meist/> |
| Eesti Lasterikaste Perede Liit | Raplamaa Lasterikkad Peredele | <https://www.lasterikkad.ee/raplamaa/peredele/> |
| Eesti Lasterikaste Perede Liit | Saaremaa Lasterikaste Perede Ühendus Meist | <https://www.lasterikkad.ee/saaremaa/meist/> |
| Eesti Lasterikaste Perede Liit | Saku Valla Lasterikkad Meist | <https://www.lasterikkad.ee/saku/meist/> |
| Eesti Lasterikaste Perede Liit | Samm parema homse nimel | <https://www.lasterikkad.ee/noustamine/> |
| Eesti Lasterikaste Perede Liit | Taotlemise tingimused | <https://www.lasterikkad.ee/taotlemise-tingimused/> |
| Eesti Lasterikaste Perede Liit | Tartu Pereliit Eetikakoodeks | <https://www.lasterikkad.ee/tartumaa/meist/dokumendid/> |
| Eesti Lasterikaste Perede Liit | Tartu Pereliit Meist | <https://www.lasterikkad.ee/tartumaa/meist/> |
| Eesti Lasterikaste Perede Liit | Valgamaa Lasterikaste Perede Ühing Meist | <https://www.lasterikkad.ee/valgamaa/meist/> |
| Eesti Lasterikaste Perede Liit | Viljandimaa Lasterikkad Meist | <https://www.lasterikkad.ee/viljandimaa/meist/> |
| Eesti Lihasehaigete Selts | Eesti Lihasehaigete Selts (ELS) | <https://www.els.ee/> |
| Eesti Lihasehaigete Selts | ELS infolehed | <https://www.els.ee/infolehed> |
| Eesti Lihasehaigete Selts | Kaasnähud | <https://www.els.ee/kaasnahud> |
| Eesti Lihasehaigete Selts | Lihasdüstroofiad | <https://www.els.ee/lihasdustroofiad-2> |
| Eesti Lihasehaigete Selts | Müasteeniline sündroom | <https://www.els.ee/muasteeniline-sundroom> |
| Eesti Lihasehaigete Selts | Müopaatiad | <https://www.els.ee/muopaatiad> |
| Eesti Lihasehaigete Selts | Müotoonia | <https://www.els.ee/muotoonia> |
| Eesti Lihasehaigete Selts | Neuropaatiad | <https://www.els.ee/neuropaatiad> |
| Eesti Lihasehaigete Selts | Perioodiline paralüüs | <https://www.els.ee/perioodiline-paraluus> |
| Eesti Lihasehaigete Selts | Tähetabelid | <https://www.els.ee/tahetabelid> |
| Eesti Liikumispuudega Inimeste Liit | Artiklid ja ettekanded meist | <https://elil.ee/et/varia/artiklid-ja-ettekanded-meist> |
| Eesti Liikumispuudega Inimeste Liit | ELIL eetikakoodeks | <https://elil.ee/et/eesti-liikumispuudega-inimeste-liit/elil-eetikakoodeks> |
| Eesti Liikumispuudega Inimeste Liit | Liikmete listiga liitumine | <https://elil.ee/et/liikmete-listiga-liitumine> |
| Eesti Naiste Varjupaikade Liit | Eetikakoodeks | <https://naisteliin.ee/index.php?id=77> |
| Eesti Naiste Varjupaikade Liit | Eetikakoodeks | <https://www.naisteliin.ee/?id=120> |
| Eesti Naiste Varjupaikade Liit | ENVL | <https://naisteliin.ee/?id=117> |
| Eesti Naiste Varjupaikade Liit | Infomaterjalid | <https://naisteliin.ee/?id=148> |
| Eesti Naiste Varjupaikade Liit | KKK | <https://naisteliin.ee/?id=116> |
| Eesti Naiste Varjupaikade Liit | Meist | <https://naisteliin.ee/index.php?id=28> |
| Eesti Naiste Varjupaikade Liit | Mida teha, kui | <https://www.naisteliin.ee/?id=110> |
| Eesti Naiste Varjupaikade Liit | Naiste tugikeskuste teenused | <https://www.naisteliin.ee/?id=166> |
| Eesti Naiste Varjupaikade Liit | Naistevastase vägivalla ilmingud | <https://naisteliin.ee/index.php?id=108> |
| Eesti Naiste Varjupaikade Liit | Paarisuhtevägivald | <https://www.naisteliin.ee/?id=109> |
| Eesti Naiste Varjupaikade Liit | Teenusekirjeldus | <https://www.naisteliin.ee/?id=139> |
| Eesti Naiste Varjupaikade Liit | Teenusekirjeldus | <https://naisteliin.ee/index.php?id=159> |
| Eesti Naiste Varjupaikade Liit | Tugikeskused | <https://naisteliin.ee/index.php?id=111> |
| Eesti Naiste Varjupaikade Liit | Tugitelefon 1492 | <https://www.naisteliin.ee/?id=115> |
| Eesti Naiste Varjupaikade Liit | Vägivallast | <https://naisteliin.ee/index.php?id=107> |
| Eesti Naiste Varjupaikade Liit | Www.naisteliin.ee | <https://www.naisteliin.ee/?id=1> |
| Eesti Neeruhaigete Liit | Kõik neerudest. | <https://www.neer.ee/> |
| Eesti Pagulasabi | Kontaktid | <https://pagulasabi.ee/et/kontaktid> |
| Eesti Pagulasabi | Majanduslik heaolu | <https://www.pagulasabi.ee/et/majanduslik-heaolu> |
| Eesti Pagulasabi | Märkamatu keeleõpe toetab pagulastaustaga noorte kohanemist | <https://www.pagulasabi.ee/et/markamatu-keeleope-toetab-pagulastaustaga-noorte-kohanemist> |
| Eesti Pagulasabi | Praktiline juhend: kuidas toetada Ukraina noori keeleõppes ja lõimumises | <https://pagulasabi.ee/et/praktiline-juhend-kuidas-toetada-ukraina-noori-keeleoppes-ja-loimumises> |
| Eesti Pagulasabi | Privaatsuspoliitika | <https://pagulasabi.ee/node/499> |
| Eesti Pagulasabi | Sotsiaalne heaolu | <https://www.pagulasabi.ee/et/sotsiaalne-heaolu> |
| Eesti Pagulasabi | Tutvustus | <https://www.pagulasabi.ee/et/tutvustus> |
| Eesti Pagulasabi | Tuult tiibadesse: Keeleõppe ja kohanemise tugi aitab Ukraina noortel oma tulevikku kujundada | <https://pagulasabi.ee/et/tuult-tiibadesse-keeleoppe-ja-kohanemise-tugi-aitab-ukraina-noortel-oma-tulevikku-kujundada> |
| Eesti Pagulasabi | Ukraina noorte toetamine Eestis: keel, kogukond ja tulevikuvõimalused | <https://www.pagulasabi.ee/et/ukraina-noorte-toetamine-eestis-keel-kogukond-ja-tulevikuvoimalused> |
| Eesti Paralümpiakomitee | Eesti Paralümpiakomitee | <https://www.paralympic.ee/> |
| Eesti Paralümpiakomitee | Boccia | <https://www.paralympic.ee/et/spordialad/boccia/2> |
| Eesti Paralümpiakomitee | EPK Dokumendid | <https://www.paralympic.ee/et/epk-dokumendid> |
| Eesti Paralümpiakomitee | I'mPOSSIBLE | <https://www.paralympic.ee/et/impossible> |
| Eesti Paralümpiakomitee | Istevõrkpall | <https://www.paralympic.ee/et/spordialad/istevorkpall/11> |
| Eesti Paralümpiakomitee | Laskmine | <https://www.paralympic.ee/et/spordialad/laskmine/5> |
| Eesti Paralümpiakomitee | Liikmed | <https://www.paralympic.ee/et/liikmed-1> |
| Eesti Paralümpiakomitee | Parajudo | <https://www.paralympic.ee/et/spordialad/parajudo/3> |
| Eesti Paralümpiakomitee | Spordialad | <https://www.paralympic.ee/et/spordialad> |
| Eesti Paralümpiakomitee | Sport | <https://www.paralympic.ee/et/sporditurvalisus> |
| Eesti Patsientide Liit | Abiks arsti juures | <https://patsiendid.ee/patsiendi-oigused/abiks-arsti-juures> |
| Eesti Patsientide Liit | Abiks ravimi ostmisel | <https://patsiendid.ee/patsiendi-oigused/abiks-ravimi-ostmisel> |
| Eesti Patsientide Liit | Korduma kippuvad küsimused: | <https://patsiendid.ee/liikmele/kkk> |
| Eesti Patsientide Liit | Küsi apteekrilt oma ravimite kohta | <https://patsiendid.ee/liikmele/kusi-oma-ravimite-kohta> |
| Eesti Patsientide Liit | Loe lähemalt tervisest: | <https://patsiendid.ee/liikmele/loe-haiguste-kohta> |
| Eesti Patsientide Liit | Olulised nõuandetelefonid | <https://patsiendid.ee/partnerid/nouandetelefonid> |
| Eesti Patsientide Liit | Olulised õigusaktid | <https://patsiendid.ee/patsiendi-oigused/oigusaktid> |
| Eesti Patsientide Liit | Patsiendi ABC | <https://patsiendid.ee/patsiendi-oigused/patsiendi-abc> |
| Eesti Patsientide Liit | Patsiendikesksus | <https://patsiendid.ee/patsiendi-oigused/patsiendikesksus> |
| Eesti Patsientide Liit | Ravimite hüvitamine | <https://patsiendid.ee/patsiendi-oigused/ravimite-huvitamine> |
| Eesti Patsientide Liit | Riiklikud olulised tervishoiusüsteemi lingid: | <https://patsiendid.ee/partnerid/riik> |
| Eesti Patsientide Liit | Ühingu eesmärgid: | <https://patsiendid.ee/meist/eesmargid> |
| Eesti Pimedate Liit | Abivahendid | <https://pimedateliit.ee/abivahendid> |
| Eesti Pimedate Liit | Arvutid ja nutiseadmed | <https://pimedateliit.ee/arvutid-ja-nutiseadmed> |
| Eesti Pimedate Liit | Eesti Pimedate Liidust | <https://pimedateliit.ee/> |
| Eesti Pimedate Liit | Füüsiline ligipääsetavus | <https://pimedateliit.ee/fuusiline-ligipaasetavus> |
| Eesti Pimedate Liit | Haridus | <https://pimedateliit.ee/haridus> |
| Eesti Pimedate Liit | Juhtkoer | <https://pimedateliit.ee/juhtkoer> |
| Eesti Pimedate Liit | Kirjeldustõlge | <https://pimedateliit.ee/kirjeldustolge> |
| Eesti Pimedate Liit | Kuidas kasutada ja alla laadida Zoomi konverentsitarkvara | <https://pimedateliit.ee/kuidas-kasutada-ja-alla-laadida-zoomi-konverentsitarkvara> |
| Eesti Pimedate Liit | Ligipääsetavus veebis | <https://pimedateliit.ee/veebi-ligipaasetavus> |
| Eesti Pimedate Liit | Meililistid | <https://pimedateliit.ee/meililistid> |
| Eesti Pimedate Liit | Meist | <https://pimedateliit.ee/meist> |
| Eesti Pimedate Liit | Muuseumid | <https://pimedateliit.ee/muuseumid> |
| Eesti Pimedate Liit | Nägemispuue | <https://pimedateliit.ee/nagemispuue/> |
| Eesti Pimedate Liit | Otsid abi? | <https://pimedateliit.ee/otsid-abi> |
| Eesti Pimedate Liit | Projekt Minu Enda Elu | <https://pimedateliit.ee/projekt-minu-enda-elu> |
| Eesti Pimedate Liit | Projekteerimisjuhend | <https://pimedateliit.ee/projekteerimisjuhend> |
| Eesti Pimedate Liit | Punktkiri | <https://pimedateliit.ee/punktkiri-2> |
| Eesti Pimedate Liit | Rehabilitatsioon | <https://pimedateliit.ee/rehabilitatsioon> |
| Eesti Pimedate Liit | Televisioon | <https://pimedateliit.ee/televisioon> |
| Eesti Pimekurtide Tugiliit | Definitsioon | <https://www.pimekurdid.ee/lisainfo/pimekurtusest/definitsioon> |
| Eesti Pimekurtide Tugiliit | Dokumendid | <https://www.pimekurdid.ee/organisatsioon/dokumendid> |
| Eesti Pimekurtide Tugiliit | Eesti Pimekurtide Liit | <https://www.pimekurdid.ee/> |
| Eesti Pimekurtide Tugiliit | Hinnakiri | <https://www.pimekurdid.ee/teenused/hinnakiri> |
| Eesti Pimekurtide Tugiliit | Laste arendamine | <https://www.pimekurdid.ee/lisainfo/pimekurtusest/laste-arendamine> |
| Eesti Pimekurtide Tugiliit | Lingid | <https://www.pimekurdid.ee/lisainfo/lingid> |
| Eesti Pimekurtide Tugiliit | Organisatsioon | <https://www.pimekurdid.ee/organisatsioon> |
| Eesti Pimekurtide Tugiliit | Pimekurtusest | <https://www.pimekurdid.ee/lisainfo/pimekurtusest> |
| Eesti Pimekurtide Tugiliit | Rahastamine | <https://www.pimekurdid.ee/organisatsioon/tegevus/rahastamine> |
| Eesti Pimekurtide Tugiliit | Teenused | <https://www.pimekurdid.ee/teenused> |
| Eesti Pimekurtide Tugiliit | Tegevus | <https://www.pimekurdid.ee/organisatsioon/tegevus> |
| Eesti Pimekurtide Tugiliit | Tegevusvaldkonnad | <https://www.pimekurdid.ee/organisatsioon/tegevus/tegevusvaldkonnad> |
| Eesti Psüühikahäiretega Inimeste Lähedaste Liit | Liitu meiega | <https://epill.ee/> |
| Eesti Psüühikahäiretega Inimeste Lähedaste Liit | Psüühikahäiretest | <https://epill.ee/psuuhikahairetest> |
| Eesti Psüühikahäiretega Inimeste Lähedaste Liit | Tegevused | <https://epill.ee/tegevused> |
| Eesti Punane Rist | Elupäästva esmaabi lühikursus | <https://redcross.ee/koolitused/elupaastva-esmaabi-luhikursus> |
| Eesti Punane Rist | Esileht | <https://redcross.ee/> |
| Eesti Punane Rist | Esmaabi põhikoolitus | <https://redcross.ee/koolitused/esmaabi-pohikoolitus-16-h> |
| Eesti Punane Rist | Esmaabi põhikoolitus osaliselt e-õppena | <https://redcross.ee/koolitused/esmaabi-pohikoolitus-osaliselt-e-oppena> |
| Eesti Punane Rist | Esmaabi ringõppus | <https://redcross.ee/esmaabi-ringoppus> |
| Eesti Punane Rist | Esmaabi täiendkoolitus | <https://redcross.ee/koolitused/esmaabi-taiendkoolitus> |
| Eesti Punane Rist | Esmaabikoolitus lastevanematele | <https://redcross.ee/koolitused/esmaabikoolitus-lastevanematele> |
| Eesti Punane Rist | Esmaabiõpetajate põhikoolitus | <https://redcross.ee/koolitused/esmaabikoolitajate-pohikoolitus> |
| Eesti Punane Rist | Esmaabiõpetajate täiendkoolitus | <https://redcross.ee/koolitused/esmaabikoolitajate-taiendkoolitus> |
| Eesti Punane Rist | Koolitused | <https://www.redcross.ee/koolitused> |
| Eesti Punane Rist | Koolitusmaterjalid | <https://redcross.ee/koolitusmaterjalid> |
| Eesti Punane Rist | Korduvad küsimused | <https://redcross.ee/bumerang/KKK> |
| Eesti Punane Rist | Liikumise põhimõtted | <https://redcross.ee/pohimotted> |
| Eesti Punane Rist | Psühholoogiline esmaabi | <https://redcross.ee/psuhholoogiline-esmaabi> |
| Eesti Punane Rist | Psühholoogilise esmaabi koolitus | <https://redcross.ee/koolitused/psuhholoogilise-esmaabi-koolitus> |
| Eesti Punane Rist | Tegevus | <https://redcross.ee/tegevus> |
| Eesti Punane Rist | Telli koolitus ettevõttele | <https://redcross.ee/telli-koolitus-ettevottele> |
| Eesti Punane Rist | Tervise edendamine | <https://redcross.ee/tervise-edendamine> |
| Eesti Punane Rist | Traumateadliku psühholoogilise esmaabi koolitus | <https://redcross.ee/traumateadliku-psuhholoogilise-esmaabi-koolitus> |
| Eesti Punane Rist | Vabatahtlike koolitused | <https://redcross.ee/vabatahtlike-koolitused> |
| Eesti Punane Rist | Väike esmaabiaandja, koolitus lasteaialastele | <https://redcross.ee/koolitused/vaike-esmaabiaandja-koolitus-lasteaialastele> |
| Eesti Puuetega Inimeste Koda | Eesti Puuetega Inimeste Koda | <https://epikoda.ee/> |
| Eesti Puuetega Inimeste Koda | Ametlikud arvamused ja pöördumised | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/ametlikud-arvamused-ja-poordumised> |
| Eesti Puuetega Inimeste Koda | Andmekaitse tingimused | <https://epikoda.ee/vota-uhendust/andmekaitse> |
| Eesti Puuetega Inimeste Koda | Asukoht ja ligipääsetavus | <https://epikoda.ee/vota-uhendust/asukoht> |
| Eesti Puuetega Inimeste Koda | Dokumendid | <https://epikoda.ee/meist/dokumendid> |
| Eesti Puuetega Inimeste Koda | EPIKoja juhtimine | <https://epikoda.ee/meist/epikoja-juhtimine> |
| Eesti Puuetega Inimeste Koda | EPIKoja liikmed | <https://epikoda.ee/epikoja-liikmed> |
| Eesti Puuetega Inimeste Koda | EPIKoja partnerid strateegilises partnerluses | <https://epikoda.ee/tegevusvaldkonnad/strateegiline-partnerlus-2026/huvikaitse-organisatsioonide-ostumenetlus> |
| Eesti Puuetega Inimeste Koda | EPIKoja tutvustus | <https://epikoda.ee/meist/tutvustus> |
| Eesti Puuetega Inimeste Koda | Erivajadusega inimesele | <https://epikoda.ee/sihtgrupid/erivajadusega-inimesele> |
| Eesti Puuetega Inimeste Koda | Huvikaitse | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse> |
| Eesti Puuetega Inimeste Koda | Huvikaitse valdkonnad | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/huvikaitse-valdkonnad> |
| Eesti Puuetega Inimeste Koda | Koolitused | <https://epikoda.ee/tegevusvaldkonnad/koolitused> |
| Eesti Puuetega Inimeste Koda | Lapsevanemale või lähedasele | <https://epikoda.ee/sihtgrupid/lapsevanemale-voi-lahedasele> |
| Eesti Puuetega Inimeste Koda | Ligipääsetavuse teatis | <https://epikoda.ee/vota-uhendust/ligipaasetavuse-teatis> |
| Eesti Puuetega Inimeste Koda | Meist | <https://epikoda.ee/meist> |
| Eesti Puuetega Inimeste Koda | Nõustamine ja õigusabi | <https://epikoda.ee/tegevusvaldkonnad/noustamine> |
| Eesti Puuetega Inimeste Koda | Projektid | <https://epikoda.ee/tegevusvaldkonnad/projektid> |
| Eesti Puuetega Inimeste Koda | Ruumide rent | <https://epikoda.ee/vota-uhendust/ruumide-rent> |
| Eesti Puuetega Inimeste Koda | Sotsiaalkaitse | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/huvikaitse-valdkonnad/sotsiaal> |
| Eesti Puuetega Inimeste Koda | Sotsiaalkaitse | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/huvikaitse-valdkonnad/sotsiaal/materjalid> |
| Eesti Puuetega Inimeste Koda | Strateegiline partnerlus 2026 | <https://epikoda.ee/tegevusvaldkonnad/strateegiline-partnerlus-2026> |
| Eesti Puuetega Inimeste Koda | Tervishoid | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/huvikaitse-valdkonnad/tervishoid/patsiendiharidus> |
| Eesti Puuetega Inimeste Koda | Tervishoid | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/huvikaitse-valdkonnad/tervishoid> |
| Eesti Puuetega Inimeste Koda | Tugirühmad ja kogemusnõustamine | <https://epikoda.ee/tugiruhmad-ja-kogemusnoustamine> |
| Eesti Puuetega Inimeste Koda | Tule liikmeks | <https://epikoda.ee/epikoja-liikmed/tule-liikmeks> |
| Eesti Puuetega Inimeste Koda | Võrdne kohtlemine | <https://epikoda.ee/tegevusvaldkonnad/huvikaitse/huvikaitse-valdkonnad/vordsed-voimalused> |
| Eesti Puuetega Inimeste Koda | Võta ühendust | <https://epikoda.ee/vota-uhendust> |
| Eesti Puuetega Inimeste Koda | Väliskoostöö | <https://epikoda.ee/tegevusvaldkonnad/valiskoostoo> |
| Eesti Puuetega Inimeste Koda | Ühiskonnale | <https://epikoda.ee/sihtgrupid/uhiskonnale> |
| Eesti Puuetega Naiste Ühenduste Liit | COFACE | <https://epnu.ee/koostoo/coface> |
| Eesti Puuetega Naiste Ühenduste Liit | EPNÜL | <https://epnu.ee/meist/organisatsioonist> |
| Eesti Puuetega Naiste Ühenduste Liit | Hea eestkoste tava | <https://epnu.ee/epnuli-hea-eestkoste-tava> |
| Eesti Puuetega Naiste Ühenduste Liit | Tegevused | <https://epnu.ee/koostoo> |
| Eesti Puuetega Naiste Ühenduste Liit | Uuringud ja raportid | <https://epnu.ee/meist/uuringud> |
| Eesti Rahvusraamatukogu | Pimedate raamatukogu | <https://www.rara.ee/meist/rara/pimedate-raamatukogu/> |
| Eesti Reumaliit | Eesti Reumaliit | <https://reumaliit.ee/> |
| Eesti Reumaliit | EESTI REUMALIIT | <https://reumaliit.ee/kes-me-oleme/tutvustus> |
| Eesti Reumaliit | Andmekaitse | <https://reumaliit.ee/kontakt/andmekaitse> |
| Eesti Reumaliit | HUVIKAITSE | <https://reumaliit.ee/mida-me-teeme/huvikaitse> |
| Eesti Reumaliit | Kasulik info | <https://reumaliit.ee/patsiendile/info> |
| Eesti Reumaliit | Koostöö | <https://reumaliit.ee/mida-me-teeme/huvikaitse/koostoo> |
| Eesti Reumaliit | LIITU EESTI REUMALIIDUGA! | <https://reumaliit.ee/kes-me-oleme/astu-liikmeks> |
| Eesti Reumaliit | Reumaatilised haigused | <https://reumaliit.ee/patsiendile/haigused> |
| Eesti Reumaliit | REUMASAADIKUTE KOOLITUSPROGRAMMI PILOOTPROJEKT | <https://reumaliit.ee/mida-me-teeme/reumasaadikud> |
| Eesti Reumaliit | TÖÖGRUPID | <https://reumaliit.ee/mida-me-teeme/huvikaitse/toogrupid> |
| Eesti Reumaliit | TÖÖVÕIME | <https://reumaliit.ee/patsiendile/toovoime> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Diagnoosimine | <https://smk.ee/diagnoosimine> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Kontakt | <https://smk.ee/kontakt> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Liidust | <https://smk.ee/liidust> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Liitumine | <https://smk.ee/liitumine> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Mis on SM | <https://smk.ee/mis-on-sm> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Noorteklubi | <https://smk.ee/noorteklubi> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Rahvusvaheline tegevus | <https://smk.ee/rahvusvaheline-tegevus> |
| Eesti Sclerosis Multiplexi Ühingute Liit | SA Sclerosis multiplexi register | <https://smk.ee/sa-sclerosis-multiplexi-register> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Sümptomid | <https://smk.ee/sumptomid> |
| Eesti Sclerosis Multiplexi Ühingute Liit | Teavitusmaterjalid | <https://smk.ee/teavitusmaterjalid> |
| Eesti Seksuaaltervise Liit | Abort ehk raseduse katkestamine | <https://seksuaaltervis.ee/rasedus-2/abort> |
| Eesti Seksuaaltervise Liit | Ebatõhusad meetodid | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/ebatohusad-meetodid> |
| Eesti Seksuaaltervise Liit | Emakasisene vahend ehk spiraal | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/spiraal> |
| Eesti Seksuaaltervise Liit | HIV ja AIDS | <https://seksuaaltervis.ee/suguhaigused/hiv-ja-aids> |
| Eesti Seksuaaltervise Liit | HPV (Human papillomavirus) ehk inimese papilloomviirus | <https://seksuaaltervis.ee/suguhaigused/hpv-ehk-papilloomviirus> |
| Eesti Seksuaaltervise Liit | Hädaabimeetodid ehk vahekorrajärgsed rasestumisvastased vahendid | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/sos-pill> |
| Eesti Seksuaaltervise Liit | Kondoom | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/kondoom> |
| Eesti Seksuaaltervise Liit | Kontakt | <https://seksuaaltervis.ee/kontakt> |
| Eesti Seksuaaltervise Liit | Küsi nõu | <https://seksuaaltervis.ee/kusi-nou> |
| Eesti Seksuaaltervise Liit | Minipillid | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/minipillid> |
| Eesti Seksuaaltervise Liit | Mis on suguhaigused? | <https://seksuaaltervis.ee/suguhaigused/mis-on-suguhaigused> |
| Eesti Seksuaaltervise Liit | Muud levinumad suguhaigused | <https://seksuaaltervis.ee/suguhaigused/muud-levinumad-suguhaigused> |
| Eesti Seksuaaltervise Liit | Nakatumine | <https://seksuaaltervis.ee/suguhaigused/nakatumine> |
| Eesti Seksuaaltervise Liit | Noorte nõustamiskeskused | <https://seksuaaltervis.ee/noorte-noustamiskeskused> |
| Eesti Seksuaaltervise Liit | Pillid | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/pillid> |
| Eesti Seksuaaltervise Liit | Rasedus | <https://seksuaaltervis.ee/rasedus/mis-on-rasedus> |
| Eesti Seksuaaltervise Liit | Raseduse katkemine | <https://seksuaaltervis.ee/rasedus-2/raseduse-katkemine> |
| Eesti Seksuaaltervise Liit | Rasestumisvastane implantaat | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/rasestumisvastane-implantaat> |
| Eesti Seksuaaltervise Liit | Rasestumisvastane plaaster | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/rasestumisvastane-plaaster> |
| Eesti Seksuaaltervise Liit | Rasestumisvastased meetodid ehk rasestumisvastased vahendid | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/rasestumisvastased-meetodid-ehk-rasestumisvastased-vahendid> |
| Eesti Seksuaaltervise Liit | Seksuaaltervis | <https://seksuaaltervis.ee/> |
| Eesti Seksuaaltervise Liit | Sterilisatsioon | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/sterilisatsioon> |
| Eesti Seksuaaltervise Liit | Sugu | <https://seksuaaltervis.ee/sugu> |
| Eesti Seksuaaltervise Liit | Sünnitus | <https://seksuaaltervis.ee/rasedus-2/sunnitus> |
| Eesti Seksuaaltervise Liit | Süstitav hormonaalne meetod | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/sustitav-hormonaalne-meetod> |
| Eesti Seksuaaltervise Liit | Topeltmeetod | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/topeltmeetod> |
| Eesti Seksuaaltervise Liit | Tuperõngas | <https://seksuaaltervis.ee/rasestumisvastased-vahendid/tuperongas> |
| Eesti Seksuaaltervise Liit | Viljatus | <https://seksuaaltervis.ee/rasedus-2/viljatus> |
| Eesti Sotsiaaltöö Assotsiatsioon | Eetikakäsiraamat \| ESTA | <https://www.eswa.ee/eetikakasiraamat/> |
| Eesti Toidupank | Kellele jagame toiduabi? | <https://www.toidupank.ee/vajad-abi/kellele-jagame-toiduabi> |
| Eesti Toidupank | Millest toiduabi koosneb? | <https://www.toidupank.ee/vajad-abi/millest-toiduabi-koosneb> |
| Eesti Toidupank | Taotle abi | <https://www.toidupank.ee/vajad-abi> |
| Eesti Toidupank | Toiduabi taotlemise info | <https://www.toidupank.ee/vajad-abi/toiduabi-taotlemise-info> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/jogeva> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/rapla> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/tallinn> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/rakvere> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/valga> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/kuressaare> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/tartu> |
| Eesti Toidupank | Vali toidupank | <https://www.toidupank.ee/foodbanks/parnu> |
| Eesti Vaegkuuljate Liit | Aparaadi taotlemine | <https://vaegkuuljad.ee/kuulmisabi/aparaadi-taotlemine> |
| Eesti Vaegkuuljate Liit | Dokumendid | <https://vaegkuuljad.ee/liidust/dokumendid> |
| Eesti Vaegkuuljate Liit | Kirjutustõlketeenus | <https://vaegkuuljad.ee/teenused/kirjutustolketeenus> |
| Eesti Vaegkuuljate Liit | Kogemusnõustamine | <https://vaegkuuljad.ee/teenused/kogemusnoustamine> |
| Eesti Vaegkuuljate Liit | Kontakt | <https://vaegkuuljad.ee/kontakt> |
| Eesti Vaegkuuljate Liit | Koolitused | <https://vaegkuuljad.ee/koolitused> |
| Eesti Vaegkuuljate Liit | Kuulmisbuss | <https://vaegkuuljad.ee/kuulmisabi/kuulmisbuss> |
| Eesti Vaegkuuljate Liit | Kuulmiskeskused | <https://vaegkuuljad.ee/kuulmisabi/kuulmiskeskused> |
| Eesti Vaegkuuljate Liit | Kuulmisklubi | <https://vaegkuuljad.ee/kuulmisklubi> |
| Eesti Vaegkuuljate Liit | Kuulmisnõustaja koolituskava | <https://vaegkuuljad.ee/koolitused/kuulmisnoustaja-koolituskava> |
| Eesti Vaegkuuljate Liit | KÕKU | <https://vaegkuuljad.ee/liidust/koku> |
| Eesti Vaegkuuljate Liit | Liidust | <https://vaegkuuljad.ee/liidust> |
| Eesti Vaegkuuljate Liit | Liikmesühingud | <https://vaegkuuljad.ee/liidust/liikmesuhingud> |
| Eesti Vaegkuuljate Liit | Liitu meiega | <https://vaegkuuljad.ee/liidust/liitu-meiega> |
| Eesti Vaegkuuljate Liit | Lugemist | <https://vaegkuuljad.ee/lugemist> |
| Eesti Vaegkuuljate Liit | Mis on kuulmispuue? | <https://vaegkuuljad.ee/kuulmisabi/mis-on-kuulmispuue> |
| Eesti Vaegkuuljate Liit | Projektid | <https://vaegkuuljad.ee/liidust/projektid> |
| Eesti Vaegkuuljate Liit | Puue ja töövõime | <https://vaegkuuljad.ee/kuulmisabi/puue-ja-toovoime> |
| Eesti Vaegkuuljate Liit | Silmusvõimendi | <https://vaegkuuljad.ee/teenused/silmusvoimendus> |
| Eesti Vaegkuuljate Liit | SMS-112 lühisõnumi teenus | <https://vaegkuuljad.ee/sms-112-luhisonumi-teenus> |
| Eesti Vaegkuuljate Liit | Subtiitrid | <https://vaegkuuljad.ee/kuulmisabi/subtiitrid> |
| Eesti Vaegkuuljate Liit | Sõrmendid | <https://vaegkuuljad.ee/kuulmisabi/sormendid> |
| Eesti Vaegkuuljate Liit | Õppekorralduse alused | <https://vaegkuuljad.ee/koolitused/oppekorralduse-alused> |
| Eesti Vaimupuudega Inimeste Tugiliit | Koos olles oleme tugevad! | <https://vaimukad.ee/> |
| Eesti Vaimupuudega Inimeste Tugiliit | Kunst kõigile | <https://vaimukad.ee/kunst-koigile> |
| Eesti Vaimupuudega Inimeste Tugiliit | Ligipääsetavuse parandamine | <https://vaimukad.ee/ligipaasetavuse-parandamine> |
| Eesti Vaimupuudega Inimeste Tugiliit | Mis on lihtne keel? | <https://vaimukad.ee/mis-on-lihtne-keel> |
| Eesti Vaimupuudega Inimeste Tugiliit | Mis on Tugiliit? | <https://vaimukad.ee/mis-on-tugiliit> |
| Eesti Vaimupuudega Inimeste Tugiliit | Mis on vaimupuue? | <https://vaimukad.ee/mis-on-vaimupuue> |
| Eesti Vaimupuudega Inimeste Tugiliit | MTFD | <https://vaimukad.ee/mtfd> |
| Eesti Vaimupuudega Inimeste Tugiliit | NEGAVATT | <https://vaimukad.ee/meie-kohta/rohevaim-negavati-ii-koht> |
| Eesti Vaimupuudega Inimeste Tugiliit | Operatiivne ekperimentaalõpe õues | <https://vaimukad.ee/operatiivne-ekperimentaalope-oues> |
| Eesti Vaimupuudega Inimeste Tugiliit | Partnerid | <https://vaimukad.ee/projektid> |
| Eesti Vaimupuudega Inimeste Tugiliit | Projektid | <https://vaimukad.ee/projekti-kirjeldus-2> |
| Eesti Vaimupuudega Inimeste Tugiliit | TÖÖANDJAD | <https://vaimukad.ee/tooandjad> |
| Eesti Viipekeeletõlkide Kutseühing | Koolitused | <https://evkty.ee/koolitused> |
| Eesti Viipekeeletõlkide Kutseühing | Kutse andmine | <https://evkty.ee/kutse-omistamine> |
| Eesti Võlanõustajate Liit | Abiotsijale | <https://evnl.ee/abiotsijale/> |
| Eesti Võlanõustajate Liit | Eetikakoodeks | <https://evnl.ee/uhingust/eetikakoodeks/> |
| Eesti Võlanõustajate Liit | Evnl.ee | <https://evnl.ee/> |
| Eesti Võlanõustajate Liit | Rahatarkus | <https://evnl.ee/abiotsijale/rahatarkus/> |
| Eesti Võlanõustajate Liit | Teenuse korraldus | <https://evnl.ee/abiotsijale/teenuse-korraldus/> |
| Eesti Vähiliit | Eesti Vähiliit | <https://cancer.ee/> |
| Eesti Vähiliit | Eesnäärmevähk | <https://cancer.ee/info-vahist/vahipaikmed/eesnaarmevahk> |
| Eesti Vähiliit | Emakakaelavähk | <https://cancer.ee/info-vahist/vahipaikmed/emakakaelavahk> |
| Eesti Vähiliit | Ennetamine | <https://cancer.ee/ennetamine> |
| Eesti Vähiliit | Ettekanded | <https://cancer.ee/teavitusmaterjalid/ettekanded> |
| Eesti Vähiliit | Filmid ja klipid | <https://cancer.ee/teavitusmaterjalid/filmid-ja-klipid> |
| Eesti Vähiliit | Info vähist | <https://cancer.ee/info-vahist> |
| Eesti Vähiliit | Kesknärvisüsteemi kasvajad | <https://cancer.ee/info-vahist/vahipaikmed/kesknarvisusteemi-kasvajad> |
| Eesti Vähiliit | Kopsuvähk | <https://cancer.ee/info-vahist/vahipaikmed/kopsuvahk> |
| Eesti Vähiliit | Kusepõievähk | <https://cancer.ee/info-vahist/vahipaikmed/kusepoievahk> |
| Eesti Vähiliit | Kõhunäärmevähk | <https://cancer.ee/info-vahist/vahipaikmed/kohunaarmevahk> |
| Eesti Vähiliit | Käär- ja pärasoolevähk | <https://cancer.ee/info-vahist/vahipaikmed/kaar-ja-parasoolevahk> |
| Eesti Vähiliit | Lapseea kasvajad | <https://cancer.ee/info-vahist/vahipaikmed/lapseea-kasvajad> |
| Eesti Vähiliit | Maovähk | <https://cancer.ee/info-vahist/vahipaikmed/maovahk> |
| Eesti Vähiliit | Melanoom | <https://cancer.ee/info-vahist/vahipaikmed/melanoom> |
| Eesti Vähiliit | Mis on vähk? | <https://cancer.ee/info-vahist/mis-on-vahk> |
| Eesti Vähiliit | Mobiilne kompuutertomograaf | <https://cancer.ee/ennetamine/vahiliidu-mobiilsed-diagnoosikabinetid/mobiilne-kompuutertomograaft> |
| Eesti Vähiliit | Mobiilne mammograafiakabinet | <https://cancer.ee/ennetamine/vahiliidu-mobiilsed-diagnoosikabinetid/mobiilne-mammograafiakabinet> |
| Eesti Vähiliit | Munandivähk | <https://cancer.ee/info-vahist/vahipaikmed/munandivahk> |
| Eesti Vähiliit | Munasarjavähk | <https://cancer.ee/info-vahist/vahipaikmed/munasarjavahk> |
| Eesti Vähiliit | Nahavähk | <https://cancer.ee/info-vahist/vahipaikmed/nahavahk> |
| Eesti Vähiliit | Neeruvähk | <https://cancer.ee/info-vahist/vahipaikmed/neeruvahk> |
| Eesti Vähiliit | Pea- ja kaelapiirkonna kasvajad | <https://cancer.ee/info-vahist/vahipaikmed/pea-ja-kaelapiirkonna-kasvajad> |
| Eesti Vähiliit | Peensoolevähk | <https://cancer.ee/info-vahist/vahipaikmed/peensoolevahk> |
| Eesti Vähiliit | Rinnavähk | <https://cancer.ee/info-vahist/vahipaikmed/rinnavahk> |
| Eesti Vähiliit | Riskide vähendamine | <https://cancer.ee/ennetamine/riskide-vahendamine> |
| Eesti Vähiliit | Sarkoomid | <https://cancer.ee/info-vahist/vahipaikmed/sarkoomid> |
| Eesti Vähiliit | Teavitusmaterjalid | <https://cancer.ee/teavitusmaterjalid> |
| Eesti Vähiliit | Uuringud | <https://cancer.ee/info-vahist/uuringud> |
| Eesti Vähiliit | Vere- ja lümfisüsteemi kasvajad | <https://cancer.ee/info-vahist/vahipaikmed/vere-ja-lumfisusteemi-kasvajad> |
| Eesti Vähiliit | Vähi avastamine | <https://cancer.ee/info-vahist/vahi-avastamine> |
| Eesti Vähiliit | Vähiliidu mobiilsed diagnoosikabinetid | <https://cancer.ee/ennetamine/vahiliidu-mobiilsed-diagnoosikabinetid> |
| Eesti Vähiliit | Vähipaikmed | <https://cancer.ee/info-vahist/vahipaikmed> |
| Elu dementsusega | Elu dementsusega | <https://eludementsusega.ee/> |
| Elu dementsusega | Armastan aidata | <https://eludementsusega.ee/armastan-aidata> |
| Elu dementsusega | Dementsuse tunnused | <https://eludementsusega.ee/dementsuse-tunnused> |
| Elu dementsusega | Huvikaitse | <https://eludementsusega.ee/huvikaitse> |
| Elu dementsusega | Jaga oma kogemust | <https://eludementsusega.ee/jaga-oma-kogemust> |
| Elu dementsusega | Kuidas Eesti inimesed täna dementsust mõistavad ja mida tuleks muuta, loe kõigest lähemalt SIIT. | <https://eludementsusega.ee/kuidas-eesti-inimesed-tana-dementsust-moistavad-ja-mida-tuleks-muuta-loe-koigest-lahemalt-siit> |
| Elu dementsusega | Liitu meiega | <https://eludementsusega.ee/liitu-meiega> |
| Elu dementsusega | Meist | <https://eludementsusega.ee/mtu-elu-dementsusega> |
| Elu dementsusega | Tark lähedane | <https://eludementsusega.ee/tark-lahedane> |
| Elu dementsusega | Tunne dementsust! | <https://eludementsusega.ee/tunne-dementsust> |
| Hasartmängusõltuvuse Nõustamiskeskus | Hasartmängusõltuvuse Nõustamiskeskus | <https://15410.ee/> |
| Hasartmängusõltuvuse Nõustamiskeskus | Digisõltuvus | <https://15410.ee/digisoltuvus> |
| Hasartmängusõltuvuse Nõustamiskeskus | Digisõltuvuse nõustamine ja psühhoteraapia | <https://15410.ee/noustamiskeskus/digisoltuvuse-noustamine-ja-psuhhoteraapia> |
| Hasartmängusõltuvuse Nõustamiskeskus | Hasartmängusõltuvus | <https://15410.ee/hasartmangusoltuvus> |
| Hasartmängusõltuvuse Nõustamiskeskus | Hasartmängusõltuvuse nõustamine ja psühhoteraapia | <https://15410.ee/noustamiskeskus/hasartmangusoltuvuse-noustamine-ja-psuhhoteraapia> |
| Hasartmängusõltuvuse Nõustamiskeskus | Hinnakiri | <https://15410.ee/hinnakiri> |
| Hasartmängusõltuvuse Nõustamiskeskus | Kontakt | <https://15410.ee/kontakt> |
| Hasartmängusõltuvuse Nõustamiskeskus | Nõustamiskeskus | <https://15410.ee/noustamiskeskus> |
| Hasartmängusõltuvuse Nõustamiskeskus | Testi ennast | <https://15410.ee/digisoltuvus/testi-ennast-arvutisoltuvus> |
| Hasartmängusõltuvuse Nõustamiskeskus | Testi ennast | <https://15410.ee/hasartmangusoltuvus/testi-ennast-hasartmangusoltuvus> |
| Hingehoid | Hingehoid | <https://www.hingehoid.ee/hingehoid> |
| Hingehoid | Hinge hoid | <https://www.hingehoid.ee/> |
| Hingehoid | Hingehoiukeskus | <https://www.hingehoid.ee/hingehoiukeskus> |
| Hingehoid | Hingehoiutelefon | <https://www.hingehoid.ee/hingehoiutelefon> |
| Hingehoid | Kutsestandard | <https://www.hingehoid.ee/hingehoidjale> |
| Hingehoid | KUTSESTANDARD | <https://hingehoid.ee/hingehoidjale/kutsestandard> |
| Hingehoid | Kõrgharidus | <https://www.hingehoid.ee/korgharidus> |
| Hingehoid | Vajan tuge | <https://www.hingehoid.ee/vajad-toetust> |
| Hingehoid | Hingehoidja eetilised põhimõtted | <https://www.hingehoid.ee/hingehoid/hingehoidja-eetilised-pohimotted> |
| Ida-Virumaa Puuetega Inimeste Koda | Igapäevaelu toetamine | <https://erivajadus.ee/teenused/igapaeva-elu-toetamine> |
| Ida-Virumaa Puuetega Inimeste Koda | Isikukeskse erihoolekande teenuse mudeli (ISTE) rakendamine kohalikus omavalitsuses – Jõhvi vallavalitsus | <https://erivajadus.ee/teenused/pilootprojekt-isikukeskse-erihoolekande-teenusmudeli-rakendamine-kohalikus-omavalitsuses-johvi-vallavalitsus> |
| Ida-Virumaa Puuetega Inimeste Koda | Isikukeskse erihoolekande teenuse mudeli (ISTE) rakendamine kohalikus omavalitsuses – Kohtla-Järve linnavalitsus | <https://erivajadus.ee/teenused/pilootprojekt-isikukeskse-erihoolekande-teenusmudeli-rakendamine-kohalikus-omavalitsuses-kohtla-jarve> |
| Ida-Virumaa Puuetega Inimeste Koda | Kasulikud Lingid | <https://erivajadus.ee/hea-teada/kasulikud-lingid> |
| Ida-Virumaa Puuetega Inimeste Koda | Projektid | <https://erivajadus.ee/organisatsioon/projektid/page/2> |
| Ida-Virumaa Puuetega Inimeste Koda | Projektid | <https://erivajadus.ee/organisatsioon/projektid> |
| Ida-Virumaa Puuetega Inimeste Koda | Teenused | <https://erivajadus.ee/teenused> |
| Ida-Virumaa Puuetega Inimeste Koda | Tegevused | <https://erivajadus.ee/organisatsioon/tegevused> |
| Ida-Virumaa Puuetega Inimeste Koda | Toetatud elamine | <https://erivajadus.ee/teenused/toetatud-elamine> |
| Ida-Virumaa Puuetega Inimeste Koda | Üheskoos ületame kõik tõkked | <https://www.erivajadus.ee/> |
| Lääne-Virumaa Puuetega Inimeste Koda | Rahastatud projektid | <https://www.virukoda.ee/Projektid> |
| Lääne-Virumaa Puuetega Inimeste Koda | Ühingust | <https://www.virukoda.ee/Meist> |
| MTÜ Eesti Omastehooldus | Abiks omastehooldajale | <https://omastehooldus.eu/abiks-omastehooldajale> |
| MTÜ Eesti Omastehooldus | Abivahendid | <https://omastehooldus.eu/abivahendid> |
| MTÜ Eesti Omastehooldus | Dokumendid | <https://omastehooldus.eu/dokumendid> |
| MTÜ Eesti Omastehooldus | Omastehoolduse 10 teesi | <https://omastehooldus.eu/omastehoolduse-10-teesi> |
| MTÜ Eesti Omastehooldus | Ühingud ja ametid | <https://omastehooldus.eu/uhingud-ja-ametid> |
| MTÜ Eesti Omastehooldus | Ühingust | <https://omastehooldus.eu/uhingust> |
| MTÜ Eesti Omastehooldus | Üldkontakt | <https://omastehooldus.eu/uldkontakt> |
| MTÜ Eluliin | Eetilise tegutsemise põhimõtted | <https://www.eluliin.ee/eetilise-tegutsemise-pohimotted> |
| MTÜ Eluliin | Emotsionaalse toe telefon | <https://www.eluliin.ee/node/15> |
| MTÜ Eluliin | Harta | <https://www.eluliin.ee/harta> |
| MTÜ Eluliin | Psühholoogiline kriisinõustamine | <https://www.eluliin.ee/psuhholoogiline-kriisinoustamine> |
| MTÜ Eluliin | Tule vabatahtlikuks | <https://www.eluliin.ee/tule-vabatahtlikuks> |
| MTÜ Iseseisev Elu | Eetika | <https://www.iseseisev-elu.ee/iseseisev-elu/eetika> |
| MTÜ Iseseisev Elu | Igapäevaelu toetamise teenus | <https://www.iseseisev-elu.ee/teenused/iet> |
| MTÜ Iseseisev Elu | Igapäevaelu toetamise teenusele saamine ja teenuse lõppemine | <https://www.iseseisev-elu.ee/teenused/iet/iet-teenus> |
| MTÜ Iseseisev Elu | Klientide õigused ja kohustused | <https://www.iseseisev-elu.ee/iseseisev-elu/klientide-oigused-ja-kohustused> |
| MTÜ Iseseisev Elu | Kogukonnas elamise teenus | <https://www.iseseisev-elu.ee/teenused/kogukonnas-elamise-teenus> |
| MTÜ Iseseisev Elu | Meist | <https://www.iseseisev-elu.ee/meist> |
| MTÜ Iseseisev Elu | Projektid | <https://www.iseseisev-elu.ee/projektid> |
| MTÜ Iseseisev Elu | Teenused | <https://www.iseseisev-elu.ee/teenused> |
| MTÜ Iseseisev Elu | Tere tulemast! | <https://www.iseseisev-elu.ee/> |
| MTÜ Iseseisev Elu | Toetatud elamise teenus | <https://www.iseseisev-elu.ee/teenused/elamine> |
| MTÜ Iseseisev Elu | Toetatud elamise teenusele saamine ja teenuse lõppemine | <https://www.iseseisev-elu.ee/teenused/elamine/elamise-teenus> |
| MTÜ Iseseisev Elu | Tooted | <https://www.iseseisev-elu.ee/tooted> |
| MTÜ Iseseisev Elu | Töötamise toetamise teenus | <https://www.iseseisev-elu.ee/teenused/tootamine> |
| MTÜ Iseseisev Elu | Visioon, missioon | <https://www.iseseisev-elu.ee/iseseisev-elu/visioon-missioon> |
| MTÜ Laste ja Noorte Kriisiprogramm | Laager | <https://lastekriis.ee/laagrid/> |
| MTÜ Laste ja Noorte Kriisiprogramm | Lapsele | <https://lastekriis.ee/lapsele/> |
| MTÜ Laste ja Noorte Kriisiprogramm | Spetsialistile | <https://lastekriis.ee/spetsialistile/> |
| MTÜ Laste ja Noorte Kriisiprogramm | Teenused ja hinnakiri | <https://lastekriis.ee/teenused/> |
| MTÜ Laste ja Noorte Kriisiprogramm | Vanemale | <https://lastekriis.ee/vanemale/> |
| MTÜ Lastekaitse Liit | Evidence to Protect – laste turvalisus ja õiguste kaitse digikeskkonnas | <https://www.lastekaitseliit.ee/et/evidence-to-protect-laste-turvalisus-ja-oiguste-kaitse-digikeskkonnas> |
| MTÜ Lastekaitse Liit | Hea nõu lastega peredele | <https://www.lastekaitseliit.ee/et/hea-nou-lastega-peredele> |
| MTÜ Lastekaitse Liit | HEA ON OLLA LAPS! | <https://www.lastekaitseliit.ee/et/hea-on-olla-laps> |
| MTÜ Lastekaitse Liit | Huvihariduse küsitluse tulemused | <https://www.lastekaitseliit.ee/et/huviharidusetulemused> |
| MTÜ Lastekaitse Liit | Koostöövõrgustik laste osaluse edendamiseks Balti- ja Põhjamaades | <https://www.lastekaitseliit.ee/et/koostoovorgustik-laste-osaluse-edendamiseks-balti-ja-pohjamaades> |
| MTÜ Lastekaitse Liit | Korduma kippuvad küsimused | <https://www.lastekaitseliit.ee/et/korduma-kippuvad-kusimused> |
| MTÜ Lastekaitse Liit | Kuhu pöörduda abi saamiseks? | <https://www.lastekaitseliit.ee/et/kuhu-poorduda-abi-saamiseks> |
| MTÜ Lastekaitse Liit | Lapse õigused | <https://www.lastekaitseliit.ee/et/lapse-oigused> |
| MTÜ Lastekaitse Liit | Lapse õiguste ABC | <https://www.lastekaitseliit.ee/et/laste-oiguste-abc> |
| MTÜ Lastekaitse Liit | Lapse õiguste saadikud | <https://www.lastekaitseliit.ee/et/lapse-oiguste-saadikud> |
| MTÜ Lastekaitse Liit | Lastekaitse Liidu Fond | <https://www.lastekaitseliit.ee/et/lastekaitseliit/lastekaitse-liidu-fond> |
| MTÜ Lastekaitse Liit | Meie tegevused | <https://www.lastekaitseliit.ee/et/meie-tegevused> |
| MTÜ Lastekaitse Liit | Meist | <https://www.lastekaitseliit.ee/et/meist> |
| MTÜ Lastekaitse Liit | MTÜ Lastekaitse Liidu üle-eestilise võrgustikutöö arendamine ja liikmeskonna võimendamine | <https://www.lastekaitseliit.ee/et/mtu-lastekaitse-liidu-ule-eestilise-vorgustikutoo-arendamine-ja-liikmeskonna-voimendamine> |
| MTÜ Lastekaitse Liit | Märka oma kodukohta | <https://www.lastekaitseliit.ee/et/marka-oma-kodukohta> |
| MTÜ Lastekaitse Liit | Päevapilt "Hea on olla laps" | <https://www.lastekaitseliit.ee/et/> |
| MTÜ Lastekaitse Liit | Tasuta õigusabi võimalustest | <https://www.lastekaitseliit.ee/et/tasuta-oigusabi-voimalustest> |
| MTÜ Oma Pere | Eestkostja ja hooldusvanem | <https://www.omapere.ee/eestkostja-ja-hooldusvanem/> |
| MTÜ Oma Pere | Lapsendaja | <https://www.omapere.ee/lapsendaja/> |
| MTÜ Oma Pere | Lapsendatu | <https://www.omapere.ee/lapsendatu/> |
| MTÜ Oma Pere | Oleme tugiorganisatsioon lapsendaja- hooldus- ja eestkosteperedele. | <https://www.omapere.ee/> |
| MTÜ Oma Pere | Planeerimata rasedus | <https://www.omapere.ee/planeerimata-rasedus/> |
| MTÜ Oma Pere | Spetsialist | <https://www.omapere.ee/professionaal> |
| MTÜ Oma Pere | Tugiteenused kasuperedele | <https://www.omapere.ee/noustamine/> |
| MTÜ Oma Pere | Viljatusravi teekond | <https://www.omapere.ee/lapsendamist-kaaluv/> |
| MTÜ Pallium | mtü pallium | <https://pallium.ee/palliumist> |
| MTÜ Pallium | HAIGUSEGA TOIMETULEK KODUS | <https://pallium.ee/patsiendile?articleId=5d07e239981dff0c7d7b10c0> |
| MTÜ Pallium | Hospiits | <https://pallium.ee/patsiendile?articleId=5d07e269981dff0c7d7b10c1> |
| MTÜ Pallium | Koduõendusteenus | <https://pallium.ee/patsiendile?articleId=5d07e5b2981dff0c7d7b10c7> |
| MTÜ Pallium | Kõhulahtisus | <https://pallium.ee/patsiendile?articleId=5d0cb1ed981dff0c7d7b10ce> |
| MTÜ Pallium | Meeleoluhäired | <https://pallium.ee/patsiendile?articleId=5ceae222d183377aff11a2e5> |
| MTÜ Pallium | Spetsiifiline kasvajavastane ravi | <https://pallium.ee/patsiendile?articleId=5ceae316d183377aff11a2ec> |
| MTÜ Pallium | Sümptomaatiline ravi | <https://pallium.ee/patsiendile?articleId=5d0cac02981dff0c7d7b10cd> |
| MTÜ Pallium | Taastusravi | <https://pallium.ee/patsiendile?articleId=5ceae237d183377aff11a2e6> |
| MTÜ Pallium | Toetavad teraapiad palliatiivses ravis | <https://pallium.ee/patsiendile?articleId=5ceae032d183377aff11a2e1> |
| MTÜ Pallium | Turvalisuse tagamise ja kadumise ennetamise abivahendid | <https://pallium.ee/patsiendile?articleId=5d07e558981dff0c7d7b10c6> |
| MTÜ Pallium | Õendusabi haiglas | <https://pallium.ee/patsiendile?articleId=5ceae180d183377aff11a2e2> |
| MTÜ Pallium | Õhupuudus | <https://pallium.ee/patsiendile?articleId=5d0cb2fe981dff0c7d7b10cf> |
| MTÜ Peaasjad | Alatoitumine | <https://peaasi.ee/alatoitumine/> |
| MTÜ Peaasjad | Anoreksia | <https://peaasi.ee/anoreksia/> |
| MTÜ Peaasjad | Antidepressandid ja aju | <https://peaasi.ee/antidepressandid-ja-aju/> |
| MTÜ Peaasjad | Antipsühhootikumid ja aju | <https://peaasi.ee/antipsuhhootikumid-ja-aju/> |
| MTÜ Peaasjad | Arvutisõltuvus | <https://peaasi.ee/arvutisoltuvus/> |
| MTÜ Peaasjad | Autismispekter | <https://peaasi.ee/autismispektri-haired/> |
| MTÜ Peaasjad | Avasta oma psühhootiline osa | <https://peaasi.ee/avasta-oma-psuhhootiline-osa/> |
| MTÜ Peaasjad | Bipolaarne häire noorukitel | <https://peaasi.ee/bipolaarne-haire-noorukitel/> |
| MTÜ Peaasjad | Bipolaarse häire ravi | <https://peaasi.ee/bipolaarse-haire-ravi/> |
| MTÜ Peaasjad | Buliimia | <https://peaasi.ee/buliimia/> |
| MTÜ Peaasjad | Depressioon | <https://peaasi.ee/depressioon/> |
| MTÜ Peaasjad | Depressioon ja aju | <https://peaasi.ee/depressioon-ja-aju/> |
| MTÜ Peaasjad | Depressioon töökohal | <https://peaasi.ee/depressioon-tookohal/> |
| MTÜ Peaasjad | Depressiooni ennetamine | <https://peaasi.ee/depressiooni-ennetamine/> |
| MTÜ Peaasjad | Depressiooni võimalikud tagajärjed noorukitel | <https://peaasi.ee/depressiooni-voimalikud-tagajarjed-noorukitel/> |
| MTÜ Peaasjad | Dieedi pidamine | <https://peaasi.ee/dieedi-pidamine/> |
| MTÜ Peaasjad | E-nõustamine | <https://peaasi.ee/e-noustamine/> |
| MTÜ Peaasjad | Emotsionaalsed seisundid | <https://peaasi.ee/emotsionaalsed-seisundid/> |
| MTÜ Peaasjad | Emotsioonid | <https://peaasi.ee/emotsioonid/> |
| MTÜ Peaasjad | Emotsioonide vaoshoidmine | <https://peaasi.ee/emotsioonide-vaoshoidmine/> |
| MTÜ Peaasjad | Emotsioonide väljendumine | <https://peaasi.ee/emotsioonide-valjendumine/> |
| MTÜ Peaasjad | Enesehinnang | <https://peaasi.ee/enesehinnang/> |
| MTÜ Peaasjad | Enesesisendus | <https://peaasi.ee/enesesisendus/> |
| MTÜ Peaasjad | Enesetapp – müüdid ja tegelikkus | <https://peaasi.ee/enesetapp-muudid-ja-tegelikkus/> |
| MTÜ Peaasjad | Enesetapumõtete tunnused | <https://peaasi.ee/enesetapumotete-tunnused/> |
| MTÜ Peaasjad | Enesetapuriski hindamine | <https://peaasi.ee/enesetapuriski-hindamine/> |
| MTÜ Peaasjad | Enesetoetamine | <https://peaasi.ee/enesetoetamine/> |
| MTÜ Peaasjad | Enesevigastamine ja selle põhjused | <https://peaasi.ee/enesevigastamine-ja-selle-pohjused/> |
| MTÜ Peaasjad | Enesevigastamise müüdid ja reaalsus | <https://peaasi.ee/enesevigastamise-muudid-ja-reaalsus/> |
| MTÜ Peaasjad | Enesevigastamise tunnused | <https://peaasi.ee/enesevigastamise-tunnused/> |
| MTÜ Peaasjad | Erinevate emotsioonidega toimetulek | <https://peaasi.ee/erinevate-emotsioonidega-toimetulek-2/> |
| MTÜ Peaasjad | Erinevate emotsioonidega toimetulek | <https://peaasi.ee/erinevate-emotsioonidega-toimetulek/> |
| MTÜ Peaasjad | Harjutus: proovi hirmutavaid olukordi väiksemateks sammudeks teha. Kuidas seda paremini teha? | <https://peaasi.ee/harjutus-hirmud-vaikesteks-sammudeks/> |
| MTÜ Peaasjad | Hea une tehnikad | <https://peaasi.ee/hea-une-tehnikad/> |
| MTÜ Peaasjad | Hooajaline depressioon | <https://peaasi.ee/hooajaline-depressioon/> |
| MTÜ Peaasjad | HÄBIMÄRGISTATUS | <https://peaasi.ee/habimargistatus/> |
| MTÜ Peaasjad | Hädaabi vahendid: vääratusega toimetulek | <https://peaasi.ee/hadaabi-vahendid-vaaratusega-toimetulek/> |
| MTÜ Peaasjad | Hädaabi vahendid: Vääratuste vältimine | <https://peaasi.ee/hadaabi-vahendid-vaaratuste-valtimine/> |
| MTÜ Peaasjad | Internetisuhted | <https://peaasi.ee/internetisuhted/> |
| MTÜ Peaasjad | Juhised suitsiidiennetuseks spetsialistidele | <https://peaasi.ee/juhised-suitsiidiennetuseks-spetsialistidele/> |
| MTÜ Peaasjad | Julgeolek ja vaimne vastupanuvõime | <https://peaasi.ee/julgeolek-ja-vaimne-vastupanuvoime/> |
| MTÜ Peaasjad | Kas seksuaalkäitumise häiret saab diagnoosida moraalsete tõekspidamiste alusel? | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-kas-seksuaalkaitumise-hairet-saab-diagnoosida-moraalsete-toekspidamiste-alusel/> |
| MTÜ Peaasjad | KEHA REAGEERIB | <https://peaasi.ee/keha-reageerib/> |
| MTÜ Peaasjad | Kiindumussuhe | <https://peaasi.ee/kiindumussuhe/> |
| MTÜ Peaasjad | Kiusamine | <https://peaasi.ee/kiusamine/> |
| MTÜ Peaasjad | Kiusamisest vabaks | <https://peaasi.ee/kiusamisest-vabaks/> |
| MTÜ Peaasjad | Kliimamure | <https://peaasi.ee/kliimamure/> |
| MTÜ Peaasjad | Kognitiivne käitumisteraapia | <https://peaasi.ee/kognitiivne-kaitumisteraapia/> |
| MTÜ Peaasjad | Kompulsiivne ületreenimine | <https://peaasi.ee/kompulsiivne-uletreenimine/> |
| MTÜ Peaasjad | Konflikti lahendamine | <https://peaasi.ee/konflikti-lahendamine/> |
| MTÜ Peaasjad | Korduma kippuvad küsimused | <https://peaasi.ee/psuhhoos-kkk/> |
| MTÜ Peaasjad | Korduma kippuvad küsimused | <https://peaasi.ee/korduma-kippuvad-kusimused/> |
| MTÜ Peaasjad | Kriisis vastupanuvõime säilitamine | <https://peaasi.ee/kriisis-vastupanuvoime-sailitamine/> |
| MTÜ Peaasjad | Kui sinu lähedane on võtnud endalt elu. Abimaterjal lähedastele ja nende toetajatele | <https://peaasi.ee/kui-sinu-lahedane-on-votnud-endalt-elu-abimaterjal-lahedastele-ja-nende-toetajatele/> |
| MTÜ Peaasjad | Kuidas aidata enesetapu mõtetega lähedast? | <https://peaasi.ee/kuidas-aidata/> |
| MTÜ Peaasjad | Kuidas aidata kedagi, kes end vigastab? | <https://peaasi.ee/kuidas-aidata-kedagi-kes-end-vigastab/> |
| MTÜ Peaasjad | Kuidas aidata lähedasel ärevusega toime tulla? | <https://peaasi.ee/kuidas-aidata-lahedast-arevusega-toime-tulla/> |
| MTÜ Peaasjad | Kuidas aidata pinge ja ärevusega õpilast? | <https://peaasi.ee/kuidas-aidata-pinge-ja-arevusega-opilast-2/> |
| MTÜ Peaasjad | Kuidas aidata pinge ja ärevusega õpilast? | <https://peaasi.ee/kuidas-aidata-pinge-ja-arevusega-opilast/> |
| MTÜ Peaasjad | Kuidas anda vaimse tervise probleemide korral töökohal esmaabi? | <https://peaasi.ee/kuidas-anda-vaimse-tervise-probleemide-korral-tookohal-esmaabi/> |
| MTÜ Peaasjad | Kuidas arvuti kasutamisele piiri panna? | <https://peaasi.ee/kuidas-arvuti-kasutamisele-piiri-panna/> |
| MTÜ Peaasjad | Kuidas bipolaarset häiret ära tunda? | <https://peaasi.ee/kuidas-bipolaarset-hairet-ara-tunda/> |
| MTÜ Peaasjad | Kuidas end ise aidata? | <https://peaasi.ee/kuidas-oma-kehasse-paremini-suhtuda/> |
| MTÜ Peaasjad | Kuidas ennast aidata? | <https://peaasi.ee/kuidas-ennast-aidata/> |
| MTÜ Peaasjad | Kuidas ennast autismispektriga toimetulekul toetada? | <https://peaasi.ee/kuidas-ennast-autismispektrihairega-toimetulekul-toetada/> |
| MTÜ Peaasjad | Kuidas ennast depressiooni korral aidata? | <https://peaasi.ee/moned-soovitused-ja-nipid-enda-abistamiseks/> |
| MTÜ Peaasjad | Kuidas ennetada? | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-kuidas-ennetada/> |
| MTÜ Peaasjad | Kuidas kiiremini paraneda ja oma tervist hoida? | <https://peaasi.ee/kuidas-kiiremini-paraneda-ja-oma-tervist-hoida/> |
| MTÜ Peaasjad | Kuidas kuulata? | <https://peaasi.ee/kuidas-kuulata/> |
| MTÜ Peaasjad | Kuidas ma ennast bipolaarse häire puhul aidata saan? | <https://peaasi.ee/kuidas-ma-ise-ennast-aidata-saan/> |
| MTÜ Peaasjad | Kuidas mõtlemisest teadlik olemine aitab ärevusega toime tulla? | <https://peaasi.ee/kuidas-kogu-see-motlemise-vark-aitab-mul-arevusega-toime-tulla/> |
| MTÜ Peaasjad | Kuidas olla ✨targem scrollija✨? | <https://peaasi.ee/sotsiaalmeedia/> |
| MTÜ Peaasjad | Kuidas olla hea sõber? | <https://peaasi.ee/kuidas-olla-hea-sober/> |
| MTÜ Peaasjad | Kuidas olla toeks lähedasele, kes on teinud enesetapukatse? | <https://peaasi.ee/kuidas-olla-toeks-lahedasele-kes-on-teinud-enesetapukatse/> |
| MTÜ Peaasjad | Kuidas oma hirmudest ülevaadet saada? | <https://peaasi.ee/kuidas-hirmudest-ulevaadet-saada/> |
| MTÜ Peaasjad | Kuidas oma lähedase või sõbra depressiooni ära tunda? | <https://peaasi.ee/kuidas-oma-lahedase-voi-sobra-depressiooni-ara-tunda/> |
| MTÜ Peaasjad | Kuidas on normaalne süüa? | <https://peaasi.ee/kuidas-on-normaalne-suua/> |
| MTÜ Peaasjad | Kuidas on tervislik süüa? | <https://peaasi.ee/kuidas-on-tervislik-suua/> |
| MTÜ Peaasjad | Kuidas rääkida kolleegiga vaimsest tervisest | <https://peaasi.ee/kuidas-raakida-kolleegiga-vaimsest-tervisest/> |
| MTÜ Peaasjad | KUIDAS RÄÄKIDA LASTELE? | <https://peaasi.ee/kuidas-raakida-lastele/> |
| MTÜ Peaasjad | Kuidas rääkida? | <https://peaasi.ee/kuidas-raakida/> |
| MTÜ Peaasjad | Kuidas saaksin oma uskumused muretsemise kasulikkuse kohta ümber hinnata? | <https://peaasi.ee/mureytmberhindamine/> |
| MTÜ Peaasjad | Kuidas toetada lähedast, kui tal on söömishäire? | <https://peaasi.ee/kuidas-laheneda-soomishairega-inimesele/> |
| MTÜ Peaasjad | Kuidas tähelepanu- ja keskendumisraskustega toime tulla? | <https://peaasi.ee/kuidas-tahelepanu-ja-keskendumisraskustega-toime-tulla/> |
| MTÜ Peaasjad | Kuidas äreval ajal vaimset vastupanuvõimet tugevdada? | <https://peaasi.ee/kuidas-areval-ajal-vaimset-vastupanuvoimet-tugevdada/> |
| MTÜ Peaasjad | Kuidas ärevushäiretega tegeleda | <https://peaasi.ee/kuidas-arevushairetega-tegeleda/> |
| MTÜ Peaasjad | Kus emotsioonid asuvad? | <https://peaasi.ee/kus-emotsioonid-asuvad/> |
| MTÜ Peaasjad | KUST LEIDA ABI JA TUGE? | <https://peaasi.ee/kust-leida-abi-ja-tuge/> |
| MTÜ Peaasjad | Küsi nõustajalt | <https://peaasi.ee/kysi-noustajalt/> |
| MTÜ Peaasjad | Lase mõtetel minna…. | <https://peaasi.ee/lase-motetel-minna/> |
| MTÜ Peaasjad | Laste ja perede heaolu | <https://peaasi.ee/laste-ja-perede-heaolu/> |
| MTÜ Peaasjad | Laste ja perede heaolu toetavad võimalused | <https://peaasi.ee/laste-ja-perede-heaolu-toetavad-voimalused/> |
| MTÜ Peaasjad | Leia üles oma ärev osa! | <https://peaasi.ee/leia-ules-oma-arev-osa/> |
| MTÜ Peaasjad | LEIN JA TRAUMA | <https://peaasi.ee/lein-ja-trauma/> |
| MTÜ Peaasjad | Liigsöömishäire | <https://peaasi.ee/liigsoomishaire/> |
| MTÜ Peaasjad | Lisavõimalused psühhoosi ravis | <https://peaasi.ee/lisavoimalused-psuhhoosi-ravis/> |
| MTÜ Peaasjad | Lõdvestusharjutused | <https://peaasi.ee/lodvestusharjutused/> |
| MTÜ Peaasjad | Lähedastele | <https://peaasi.ee/lahedastele/> |
| MTÜ Peaasjad | Materjal kuidas raakida vanematele oma murest vaimse tervisega | <https://peaasi.ee/materjal-kuidas-raakida-vanematele-oma-murest-vaimse-tervisega/> |
| MTÜ Peaasjad | Materjale | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-materjale/> |
| MTÜ Peaasjad | Meeleolustabilisaatorid ja aju | <https://peaasi.ee/meeleolustabilisaatorid-ja-aju/> |
| MTÜ Peaasjad | Meeste vaimne tervis | <https://peaasi.ee/meeste-vaimne-tervis/> |
| MTÜ Peaasjad | Meestele | <https://peaasi.ee/meestele/> |
| MTÜ Peaasjad | Mehed | <https://peaasi.ee/mehed/> |
| MTÜ Peaasjad | Mida depressiooni korral ette võtta? | <https://peaasi.ee/mida-depressiooni-korral-ette-votta/> |
| MTÜ Peaasjad | Mida ette võtta? | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-mida-ette-votta/> |
| MTÜ Peaasjad | Mida saab teha õpetaja, kui ta märkab õpilase muutunud käitumist? | <https://peaasi.ee/opilase-muutunud-kaitumine/> |
| MTÜ Peaasjad | Mida teha ahistava käitumise korral? | <https://peaasi.ee/seksuaalne-vaarkohtlemine/> |
| MTÜ Peaasjad | Mida teha meeste vaimse tervise heaks? | <https://peaasi.ee/mida-teha-meeste-heaks/> |
| MTÜ Peaasjad | Mida teha, kui mure kliima pärast vaevab? | <https://peaasi.ee/mure-kliima-parast-mida-teha/> |
| MTÜ Peaasjad | Mida teha, kui märkad sotsiaalmeedias surmamõtetega seotud postitusi? | <https://peaasi.ee/mida-teha-kui-markad-sotsiaalmeedias-surmamotetega-seotud-postitusi/> |
| MTÜ Peaasjad | Miks depressioon tekib? | <https://peaasi.ee/miks-depressioon-tekib/> |
| MTÜ Peaasjad | Miks mul sellised mõtted on? | <https://peaasi.ee/miks-mul-sellised-motted-on/> |
| MTÜ Peaasjad | Millal pöörduda spetsialisti poole? | <https://peaasi.ee/millal-poorduda-abi-saama/> |
| MTÜ Peaasjad | Mis eristab kompulsiivset seksuaalkäitumist sõltuvusest? | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-mis-eristab-kompulsiivset-seksuaalkaitumist-soltuvusest/> |
| MTÜ Peaasjad | Mis muudab arvutikasutamise sõltuvuseks? | <https://peaasi.ee/mis-muudab-arvutikasutamise-soltuvuseks/> |
| MTÜ Peaasjad | Mis mõjutab arvutikasutamise sõltuvuseks muutumist? | <https://peaasi.ee/mis-mojutab-arvutikasutamise-soltuvuseks-muutumist/> |
| MTÜ Peaasjad | Mis on aktiivsus- ja tähelepanuhäire? | <https://peaasi.ee/mis-on-aktiivsus-ja-tahelepanuhaire/> |
| MTÜ Peaasjad | Mis on bipolaarne meeleoluhäire? | <https://peaasi.ee/mis-on-bipolaarne-meeleoluhaire/> |
| MTÜ Peaasjad | Mis on isiksushäired? | <https://peaasi.ee/mis-on-isiksushaired/> |
| MTÜ Peaasjad | Mis on kompulsiivne seksuaalkäitumine? | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-mis-on-kompulsiivne-seksuaalkaitumine/> |
| MTÜ Peaasjad | Mis on tähelepanu? | <https://peaasi.ee/mis-on-tahelepanu/> |
| MTÜ Peaasjad | Mis on ärevus? | <https://peaasi.ee/mis-on-arevus/> |
| MTÜ Peaasjad | Mis põhjustab bipolaarse häire teket? | <https://peaasi.ee/mis-pohjustab-bipolaarse-haire-teket/> |
| MTÜ Peaasjad | Muretsemine | <https://peaasi.ee/muretsemine/> |
| MTÜ Peaasjad | Muretsemise müüdid | <https://peaasi.ee/muremyydid/> |
| MTÜ Peaasjad | Mõtlemisvead | <https://peaasi.ee/motlemisvead/> |
| MTÜ Peaasjad | Müüdid | <https://peaasi.ee/ravi-muudid/> |
| MTÜ Peaasjad | Müüdid ja reaalsus | <https://peaasi.ee/muudid-ja-tegelikkus/> |
| MTÜ Peaasjad | Nipid enda aitamiseks | <https://peaasi.ee/nipid-enda-aitamiseks/> |
| MTÜ Peaasjad | Nipid lähedase aitamiseks | <https://peaasi.ee/nipid-lahedase-aitamiseks/> |
| MTÜ Peaasjad | Nõuanded psühhoosi haigestunud inimese lähedasele | <https://peaasi.ee/nouanded-psuhhoosi-haigestunud-inimese-lahedasele/> |
| MTÜ Peaasjad | Nõuanded õpetaja töö kergendamiseks lastega, kel on raskusi keskendumise ja suhtlemisega | <https://peaasi.ee/nouanded-opetajale-keskendumine-suhtlemine/> |
| MTÜ Peaasjad | Nõuanded õpetaja töö kergendamiseks, kui esineb agressiivset käitumist | <https://peaasi.ee/nouanded-opetajale-agressiivsus/> |
| MTÜ Peaasjad | Nõustamine kanepitarvitajatele | <https://peaasi.ee/valik-kanepinoustamine/> |
| MTÜ Peaasjad | Obsessiiv-kompulsiivne häire | <https://peaasi.ee/obsessiiv-kompulsiivne-haire/> |
| MTÜ Peaasjad | Ortoreksia | <https://peaasi.ee/ortoreksia/> |
| MTÜ Peaasjad | Paanikahoog ja paanikahäire – eneseabi | <https://peaasi.ee/paanikahaire-eneseabistrateegiad/> |
| MTÜ Peaasjad | Paanikahäire | <https://peaasi.ee/paanikahaire/> |
| MTÜ Peaasjad | Paanikahäire põhjused | <https://peaasi.ee/paanikahaire-pohjused/> |
| MTÜ Peaasjad | Parema une nõuanded | <https://peaasi.ee/parema-une-nouanded/> |
| MTÜ Peaasjad | Partnerite tasuta nõustamisteenused | <https://peaasi.ee/partnerite-tasuta-noustamisteenused/> |
| MTÜ Peaasjad | Peahea noortenõustamine | <https://peaasi.ee/peahea/> |
| MTÜ Peaasjad | Pealetükkivate mõtete ohjamine | <https://peaasi.ee/pealetukkivate-motete-ohjamine/> |
| MTÜ Peaasjad | Pereteraapia | <https://peaasi.ee/pereteraapia/> |
| MTÜ Peaasjad | Post-traumaatiline stressihäire | <https://peaasi.ee/post-traumaatiline-stressihaire/> |
| MTÜ Peaasjad | Probleemide lahendamine | <https://peaasi.ee/probleemide-lahendamine/> |
| MTÜ Peaasjad | Psühhiaatri juures | <https://peaasi.ee/psuhhiaatri-juures/> |
| MTÜ Peaasjad | Psühhoanalüüs | <https://peaasi.ee/psuhhoanaluus/> |
| MTÜ Peaasjad | Psühhoanalüütiline teraapia | <https://peaasi.ee/psuhhoanaluutiline-teraapia/> |
| MTÜ Peaasjad | Psühholoogi juures | <https://peaasi.ee/psuhholoogi-juures/> |
| MTÜ Peaasjad | Psühholoogiline kriis | <https://peaasi.ee/psuhholoogiline-kriis/> |
| MTÜ Peaasjad | Psühhoos ja aju | <https://peaasi.ee/psuhhoos-ja-aju/> |
| MTÜ Peaasjad | Psühhoosi põhjused | <https://peaasi.ee/psuhhoosi-pohjused/> |
| MTÜ Peaasjad | Psühhoosi ravi ja paranemine | <https://peaasi.ee/psuhhoosi-ravi-ja-paranemine/> |
| MTÜ Peaasjad | Psühhoosi ravi: Psühhoteraapia | <https://peaasi.ee/psuhhoosi-ravi-psuhhoteraapia/> |
| MTÜ Peaasjad | Psühhoosi ravi: Ravimid | <https://peaasi.ee/psuhhoosi-ravi-ravimid/> |
| MTÜ Peaasjad | Psühhoosi sümptomid | <https://peaasi.ee/psuhhoosi-sumptomid/> |
| MTÜ Peaasjad | Psühhootiliste häirete diagnoosid | <https://peaasi.ee/diagnoosid/> |
| MTÜ Peaasjad | Psühhootiliste häirete müüdid ja reaalsus | <https://peaasi.ee/psuhhootiliste-hairete-muudid-ja-reaalsus/> |
| MTÜ Peaasjad | Ravi keskkond | <https://peaasi.ee/ravi-keskkond/> |
| MTÜ Peaasjad | Rõõm | <https://peaasi.ee/roomu-ja-positiivsete-emotsioonide-suurendamine/> |
| MTÜ Peaasjad | Räägi kolleegiga | <https://peaasi.ee/raagi-kolleegiga/> |
| MTÜ Peaasjad | Räägi lapsega | <https://peaasi.ee/raagi-lapsega2/> |
| MTÜ Peaasjad | Räägi lapsevanemaga | <https://peaasi.ee/raagi-lapsevanemaga/> |
| MTÜ Peaasjad | Räägime lapsega leinast | <https://peaasi.ee/raagime-lapsega-leinast/> |
| MTÜ Peaasjad | Räägime Lastest lähenemine peredele | <https://peaasi.ee/raagime-lastest-lapsevanemale/> |
| MTÜ Peaasjad | Räägime rasketel teemadel | <https://peaasi.ee/raagime-rasketel-teemadel/> |
| MTÜ Peaasjad | Saa ebamäärasusega sõbraks | <https://peaasi.ee/saa-ebamaarasusega-sobraks/> |
| MTÜ Peaasjad | Samm 1: Nõiaring | <https://peaasi.ee/samm-1/> |
| MTÜ Peaasjad | Samm 2: Nõiaringi lõhkumine – muutused mõtlemises | <https://peaasi.ee/samm-2/> |
| MTÜ Peaasjad | Samm 3: Nõiaringi lõhkumine – muutused mõtlemises | <https://peaasi.ee/samm-3-noiaringi-lohkumine-muutused-motlemises/> |
| MTÜ Peaasjad | Samm 4: Nõiaringi lõhkumine – tunnetega toimetulek | <https://peaasi.ee/samm-4-noiaringi-lohkumine-tunnetega-toimetulek/> |
| MTÜ Peaasjad | Samm 5: Hea enesetunde säilitamine | <https://peaasi.ee/samm-5-hea-enesetunde-sailitamine/> |
| MTÜ Peaasjad | Sammud depressiooniga tegelemiseks | <https://peaasi.ee/eneseabi-votted-depressiooniga-tegelemiseks/> |
| MTÜ Peaasjad | Seksuaalsus ja vaimne tervis | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis/> |
| MTÜ Peaasjad | Soomishaired sport ja treenerid vol 1 | <https://peaasi.ee/soomishaired-sport-ja-treenerid-vol-1/> |
| MTÜ Peaasjad | Soomishaired sport ja treenerid vol 2 | <https://peaasi.ee/soomishaired-sport-ja-treenerid-vol-2/> |
| MTÜ Peaasjad | Soomishaired sport ja treenerid vol 3 | <https://peaasi.ee/soomishaired-sport-ja-treenerid-vol-3/> |
| MTÜ Peaasjad | SOOVITUSED ENESEHOOLEKS | <https://peaasi.ee/soovitused-enesehooleks/> |
| MTÜ Peaasjad | Soovitused leinaja toetajale | <https://peaasi.ee/soovitused-leinaja-toetajale/> |
| MTÜ Peaasjad | Sotsiaal-emotsionaalne pädevus ja traumat arvestav praktika | <https://peaasi.ee/sotsiaal-emotsionaalne-padevus-ja-traumat-arvestav-praktika/> |
| MTÜ Peaasjad | Sotsiaalfoobia | <https://peaasi.ee/sotsiaalfoobia/> |
| MTÜ Peaasjad | Spetsialistile | <https://peaasi.ee/seksuaalsus-ja-vaimne-tervis-spetsialistile/> |
| MTÜ Peaasjad | Stress | <https://peaasi.ee/stress/> |
| MTÜ Peaasjad | Stressi ja elu väljakutsetega toimetuleku plaan | <https://peaasi.ee/kriisiplaan/> |
| MTÜ Peaasjad | Suhtlemine sotsiaalmeedias | <https://peaasi.ee/sotsiaalmeedia-ohud/> |
| MTÜ Peaasjad | Suitsiid | <https://peaasi.ee/suitsiid/> |
| MTÜ Peaasjad | Sõltuvuste ja sõltuvushäirete abi | <https://peaasi.ee/soltuvuste-ja-soltuvushairete-abi/> |
| MTÜ Peaasjad | Söömishäire ja rasedus | <https://peaasi.ee/soomishaire-ja-rasedus/> |
| MTÜ Peaasjad | Söömishäire või dieet | <https://peaasi.ee/soomishaire-voi-dieet/> |
| MTÜ Peaasjad | Söömishäired | <https://peaasi.ee/soomishaired/> |
| MTÜ Peaasjad | Söömishäirest tervenemine ja tagasilangus | <https://peaasi.ee/soomishairest-tervenemine-ja-tagasilangus/> |
| MTÜ Peaasjad | Söömishäirete müüdid ja reaalsus | <https://peaasi.ee/soomishairete-muudid-ja-reaalsus/> |
| MTÜ Peaasjad | Söömishäirete põhjused | <https://peaasi.ee/soomishairete-pohjused/> |
| MTÜ Peaasjad | Söömishäirete ravi | <https://peaasi.ee/soomishairete-ravi/> |
| MTÜ Peaasjad | Sündmuse käsitlemine | <https://peaasi.ee/juhtunu-kasitlemiseks/> |
| MTÜ Peaasjad | Sünnitusjärgne depressioon | <https://peaasi.ee/sunnitusjargne-depressioon/> |
| MTÜ Peaasjad | Tagasilangus ja seisundi ägenemine | <https://peaasi.ee/tagasilangus-ja-seisundi-agenemine/> |
| MTÜ Peaasjad | Tagasilangused ja vääratused | <https://peaasi.ee/tagasilangused-ja-vaaratused/> |
| MTÜ Peaasjad | Tehnikad rahunemiseks | <https://peaasi.ee/votted-rahunemiseks/> |
| MTÜ Peaasjad | Terviseärevus | <https://peaasi.ee/tervisearevus/> |
| MTÜ Peaasjad | Toimetulek kriisiga | <https://peaasi.ee/toimetulek-kriisiga/> |
| MTÜ Peaasjad | Toimetulek psühholoogilise traumaga | <https://peaasi.ee/toimetulek-psuhholoogilise-traumaga/> |
| MTÜ Peaasjad | Toimetuleku parandamine | <https://peaasi.ee/toimetuleku-parandamine/> |
| MTÜ Peaasjad | Traumaatilised sündmused, surmajuhtumid töökohal või meeskonnaliikmete ja nende pereliikmete seas | <https://peaasi.ee/traumaatilised-sundmused-surmajuhtumid-tookohal-voi-meeskonnaliikmete-ja-nende-pereliikmete-seas/> |
| MTÜ Peaasjad | Tugevad tunded võivad olla hirmutavad | <https://peaasi.ee/tugevad-tunded-voivad-olla-hirmutavad/> |
| MTÜ Peaasjad | TUNNETE KEERISES | <https://peaasi.ee/tunnete-keerises/> |
| MTÜ Peaasjad | Tööle jäämise ja tööle naasmise juhtimine vaimse tervise raskuste korral | <https://peaasi.ee/toole-jaamise-ja-toole-naasmise-juhtimine-vaimse-tervise-raskuste-korral/> |
| MTÜ Peaasjad | Tööstress ja läbipõlemine | <https://peaasi.ee/toostress-ja-labipolemine/> |
| MTÜ Peaasjad | Uni | <https://peaasi.ee/uni/> |
| MTÜ Peaasjad | Vaimne tervis märkamine ja toetamine | <https://peaasi.ee/vaimne-tervis-markamine-ja-toetamine/> |
| MTÜ Peaasjad | Vaimse tervise hea tava töökohal | <https://peaasi.ee/vaimse-tervise-hea-tava-tookohal/> |
| MTÜ Peaasjad | Vaimse tervise hoidmine | <https://peaasi.ee/vaimse-tervise-hoidmine/> |
| MTÜ Peaasjad | Vaimse tervise nõustamise teenused | <https://peaasi.ee/noustamisteenused/> |
| MTÜ Peaasjad | Vaimse tervise teemad ja materjalid õpilastele | <https://peaasi.ee/vaimse-tervise-teemad-ja-materjalid-opilastele/> |
| MTÜ Peaasjad | Vaimse tervise toetamine töökeskkonnas | <https://peaasi.ee/vaimse-tervise-toetamine-tookeskkonnas/> |
| MTÜ Peaasjad | Vaimse tervise tugivõrgustik | <https://peaasi.ee/vaimse-tervise-tugivorgustik/> |
| MTÜ Peaasjad | Vaimse tervise vitamiini saatekiri – vali ja koosta | <https://peaasi.ee/saatekirjad/> |
| MTÜ Peaasjad | Valu vähendamine | <https://peaasi.ee/valu-vahendamine/> |
| MTÜ Peaasjad | Viha ja ärrituvus | <https://peaasi.ee/viha-ja-arrituvus/> |
| MTÜ Peaasjad | Visualiseerimine | <https://peaasi.ee/visualiseerimine/> |
| MTÜ Peaasjad | Väärinfo ja ohutunne | <https://peaasi.ee/vaarinfo-ja-ohutunne/> |
| MTÜ Peaasjad | Õpetaja ja läbipõlemine | <https://peaasi.ee/opetaja-ja-labipolemine/> |
| MTÜ Peaasjad | Ärevus | <https://peaasi.ee/arevushaired/> |
| MTÜ Peaasjad | Ärevus ja aju | <https://peaasi.ee/arevus-ja-aju/> |
| MTÜ Peaasjad | Ärevushäired | <https://peaasi.ee/kui-arevus-hairima-hakkab/> |
| MTÜ Peaasjad | Ärevushäired töökohal | <https://peaasi.ee/arevushaired-tookohal/> |
| MTÜ Peaasjad | Ärevushäirete ravi | <https://peaasi.ee/arevushairete-ravi/> |
| MTÜ Peaasjad | Üksildusest – mida see tähendab ja kuidas sellega paremini toime tulla? | <https://peaasi.ee/uksildusest-mida-see-tahendab-ja-kuidas-sellega-paremini-toime-tulla/> |
| MTÜ Peaasjad | Üldistunud ärevushäire | <https://peaasi.ee/uldistunud-arevushaire/> |
| Naiste Tugi- ja Teabekeskus | Isikuandmete töötlemine Naiste Tugi- ja Teabekeskuses | <https://naistetugi.ee/isikuandmete-tootlemine-naiste-tugi-ja-teabekeskuses> |
| Naiste Tugi- ja Teabekeskus | Naiste Tugi- ja Teabekeskus | <https://naistetugi.ee/abiasutused> |
| Naiste Tugi- ja Teabekeskus | “Miks ta ei lahku” – kaheksa selgitavat sammu | <https://naistetugi.ee/miks-ta-ei-lahku-kaheksa-selgitavat-sammu> |
| Naiste Tugi- ja Teabekeskus | Denim Day ehk teksapäev – 29. aprill | <https://naistetugi.ee/denim-day-ehk-teksapaev-29-aprill> |
| Naiste Tugi- ja Teabekeskus | Eakatevastane vägivald | <https://naistetugi.ee/eakatevastane-vagivald> |
| Naiste Tugi- ja Teabekeskus | Emotsionaalne vägivald | <https://naistetugi.ee/vagivallast/emotsionaalne-vagivald> |
| Naiste Tugi- ja Teabekeskus | Haavatud naisele | <https://naistetugi.ee/haavatud-naisele> |
| Naiste Tugi- ja Teabekeskus | Kaebuste esitamine ja lahendamine | <https://naistetugi.ee/kaebuste-esitamine-ja-lahendamine> |
| Naiste Tugi- ja Teabekeskus | Kes on süüdi ja miks naised ei lahku? | <https://naistetugi.ee/vagivallast/kes-on-suudi-ja-miks-naised-ei-lahku> |
| Naiste Tugi- ja Teabekeskus | Kuidas aidata? | <https://naistetugi.ee/vagivallast/kuidas-aidata> |
| Naiste Tugi- ja Teabekeskus | Kuidas soorollid on seotud perevägivallaga? | <https://naistetugi.ee/kuidas-soorollid-on-seotud-perevagivallaga> |
| Naiste Tugi- ja Teabekeskus | Meist | <https://naistetugi.ee/meist> |
| Naiste Tugi- ja Teabekeskus | Miks paljud vägistamisohvid ei hakka vastu ega hüüa appi | <https://naistetugi.ee/miks-paljud-vagistamisohvid-ei-hakka-vastu-ega-huua-appi> |
| Naiste Tugi- ja Teabekeskus | Ohumärgid | <https://naistetugi.ee/vagivallast/ohumargid> |
| Naiste Tugi- ja Teabekeskus | Perevägivald | <https://naistetugi.ee/vagivallast/perevagivald> |
| Naiste Tugi- ja Teabekeskus | Seksuaalvägivalla ohvrite tugiisikute juhendmaterjal | <https://naistetugi.ee/vagivallast/seksuaalvagivallast/seksuaalvagivalla-ohvrite-tugiisikute-juhendmaterjal> |
| Naiste Tugi- ja Teabekeskus | Seksuaalvägivallast | <https://naistetugi.ee/vagivallast/seksuaalvagivallast> |
| Naiste Tugi- ja Teabekeskus | Teenuste hinnakiri* | <https://naistetugi.ee/teenuste-hinnakiri> |
| Naiste Tugi- ja Teabekeskus | Tugiisikute juhendmaterjal kriminaalmenetlusest | <https://naistetugi.ee/vagivallast/seksuaalvagivallast/tugiisikute-juhendmaterjal-kriminaalmenetlusest> |
| Naiste Tugi- ja Teabekeskus | Täna on 25. november – täna on rahvusvaheline naistevastase vägivalla vastu võitlemise päev! | <https://naistetugi.ee/tana-on-25-november-tana-on-rahvusvaheline-naistevastase-vagivalla-vastu-voitlemise-paev> |
| Naiste Tugi- ja Teabekeskus | Vägivald ja lapsed | <https://naistetugi.ee/vagivallast/vagivald-ja-lapsed> |
| Naiste Tugi- ja Teabekeskus | Vägivalda soodustavad tegurid | <https://naistetugi.ee/vagivallast/vagivalda-soodustavad-tegurid> |
| Naiste Tugi- ja Teabekeskus | Vägivalla tsükliteooria | <https://naistetugi.ee/vagivallast/vagivalla-tsukliteooria> |
| Naiste Tugi- ja Teabekeskus | Vägivallast | <https://naistetugi.ee/vagivallast/vagivallast> |
| Naiste Tugi- ja Teabekeskus | Vägivallast on väljapääs. Pakume Sulle nõu ja abi 24h. | <https://naistetugi.ee/> |
| Naiste Tugi- ja Teabekeskus | Õigusalane info | <https://naistetugi.ee/vagivallast/kasulik-lisalugemine/oigusalane-info> |
| NIRK | NIRK pakub üle Eesti nägemispuudega inimestele järgmisi teenuseid: | <https://www.nirkkeskus.ee/Rehabilitatsiooniteenused> |
| NIRK | Andmekaitse | <https://www.nirkkeskus.ee/Andmekaitse> |
| NIRK | Andmetöötluspõhimõtted | <https://www.nirkkeskus.ee/Andmet%C3%B6%C3%B6tlusp%C3%B5him%C3%B5tted> |
| NIRK | Asukoht | <https://www.nirkkeskus.ee/NIRKist/asukoht> |
| NIRK | Kliendi õigused ja kohustused | <https://www.nirkkeskus.ee/Kliendi_%C3%B5igused_ja_kohustused> |
| NIRK | Koolituste ja konsultatsioonide hinnakiri | <https://www.nirkkeskus.ee/Koolituste_ja_konsultatsioonide_hinnakiri> |
| NIRK | Kuidas tulla | <https://www.nirkkeskus.ee/Kuidas_tulla> |
| NIRK | Nägemispuudega inimeste rehabilitatsioon | <https://www.nirkkeskus.ee/Rehabilitatsioon> |
| NIRK | Teenusele registreerumine | <https://www.nirkkeskus.ee/Teenustele_registreerumine> |
| NIRK | Teenuste kirjeldused | <https://www.nirkkeskus.ee/NIRKist/teenuste_kirjeldused> |
| Põhja-Eesti Pimedate Ühing | Dokumendid | <https://ppy.ee/est/meist/folder1963/dokumendid> |
| Põhja-Eesti Pimedate Ühing | Innovaatilised lahendid nägemispuudega inimestele ettevõtluse arendamisel | <https://ppy.ee/est/meie-tegemised/projektid/innovaatilised-lahendid-nagemispuudega-inimestele-ettevotluse-arendamisel> |
| Põhja-Eesti Pimedate Ühing | Kuidas suhelda nägemispuudega inimesega?Nägemispuudest tingitud suhtlemistakistused. | <https://ppy.ee/est/nagemispuue/kuidas-suhelda-nagemispuudega-inimesega> |
| Põhja-Eesti Pimedate Ühing | Liikmed | <https://ppy.ee/est/meist/folder1963/liikmed> |
| Põhja-Eesti Pimedate Ühing | Missioon ja visioon | <https://ppy.ee/est/meist/folder1963/missioon-ja-visioon> |
| Põhja-Eesti Pimedate Ühing | Nägemispuue | <https://ppy.ee/est/nagemispuue> |
| Põhja-Eesti Pimedate Ühing | Organisatsioon | <https://ppy.ee/est/meist> |
| Põhja-Eesti Pimedate Ühing | Pimedad ja vaegnägijad valmistavad tooteid ja pakuvad teenuseid | <https://ppy.ee/est/meiepakume> |
| Põhja-Eesti Pimedate Ühing | Struktuur ja Töökorraldus | <https://ppy.ee/est/meist/folder1963/struktuur-ja-tookorraldus> |
| Põhja-Eesti Pimedate Ühing | Tulevikuplaanid | <https://ppy.ee/est/meist/tulevik> |
| Pärnumaa Puuetega Inimeste Koda | MTÜ Pärnumaa Puuetega Inimeste Koda | <https://xn--prnukoda-0za.ee/kontakt> |
| Pärnumaa Puuetega Inimeste Koda | Pärnumaa Puuetega Inimeste Koda | <https://xn--prnukoda-0za.ee/> |
| Pärnumaa Puuetega Inimeste Koda | MTÜ PPIK liikmesühingud | <https://xn--prnukoda-0za.ee/liikmesuhingud-2> |
| Saaremaa Puuetega Inimeste Koda | Asukoht | <https://www.saarekoda.ee/7ca6c-about/asukoht> |
| Saaremaa Puuetega Inimeste Koda | Eetikakoodeks | <https://www.saarekoda.ee/dokumendid/eetikakoodeks> |
| Saaremaa Puuetega Inimeste Koda | Erihoolekandeteenused | <https://www.saarekoda.ee/7ca6c-about/teenused/riiklikud-teenused> |
| Saaremaa Puuetega Inimeste Koda | Invatranspordi teenus | <https://www.saarekoda.ee/7ca6c-about/teenused/invatranspordi-teenus> |
| Saaremaa Puuetega Inimeste Koda | Kultuur ja traditsioonid | <https://www.saarekoda.ee/7ca6c-about/kultuur-ja-traditisoonid> |
| Saaremaa Puuetega Inimeste Koda | Projektid 2026 | <https://www.saarekoda.ee/projektid/projektid-2026> |
| Saaremaa Puuetega Inimeste Koda | Sotsiaalse rehabilitatsiooniteenus | <https://www.saarekoda.ee/7ca6c-about/teenused/rehabilitatsioon> |
| Saaremaa Puuetega Inimeste Koda | SPIK TEENUSED | <https://www.saarekoda.ee/7ca6c-about/teenused/spik-teenused> |
| Saaremaa Puuetega Inimeste Koda | Teenused | <https://www.saarekoda.ee/7ca6c-about/teenused> |
| Saaremaa Puuetega Inimeste Koda | Uurimused | <https://www.saarekoda.ee/dokumendid/uurimused> |
| SOS Lasteküla Eesti Ühing | Ennetustöö | <https://sos-lastekyla.ee/ennetustoo/> |
| SOS Lasteküla Eesti Ühing | Grupikodu | <https://sos-lastekyla.ee/meie-too/asendushooldus/grupikodu/grupikodu/> |
| SOS Lasteküla Eesti Ühing | Hoolduspere | <https://sos-lastekyla.ee/meie-too/asendushooldus/hoolduspere/> |
| SOS Lasteküla Eesti Ühing | Info kohaliku omavalitsuse lastekaitsetöötajale | <https://sos-lastekyla.ee/info-kohaliku-omavalitsuse-lastekaitsetootajale/> |
| SOS Lasteküla Eesti Ühing | Järelhooldus | <https://sos-lastekyla.ee/meie-too/jarelhooldus/> |
| SOS Lasteküla Eesti Ühing | Perekodu | <https://sos-lastekyla.ee/meie-too/asendushooldus/perekodu/> |
| SOS Lasteküla Eesti Ühing | Teata abivajavast lapsest | <https://sos-lastekyla.ee/lapse-kaitsmine/> |
| SOS Lasteküla Eesti Ühing | Võta ühendust | <https://sos-lastekyla.ee/vota-uhendust/> |
| Tallinna ja Harjumaa Kurtide Ühing | Tallinna ja Harjumaa Kurtide Ühing | <https://www.thky.ee/> |
| Tallinna ja Harjumaa Kurtide Ühing | Avaleht | <https://www.thky.ee/avaleht> |
| Tallinna ja Harjumaa Kurtide Ühing | Kontakt | <https://www.thky.ee/organisatsioonist/kontakt> |
| Tallinna ja Harjumaa Kurtide Ühing | Lingid | <https://www.thky.ee/lingid/kasulikud-lingid> |
| Tallinna ja Harjumaa Kurtide Ühing | THKÜ eesmärgiks on | <https://www.thky.ee/organisatsioonist/meie-eesm%C3%A4rgid> |
| Tallinna Liikumispuudega Inimeste Ühing | Ühingust | <https://www.tliy.ee/> |
| Tallinna Puuetega Inimeste Koda | Tallinna Puuetega Inimeste Koda | <https://tallinnakoda.ee/> |
| Tallinna Puuetega Inimeste Koda | Avalik internetipunkt | <https://tallinnakoda.ee/avalik-internetipunkt> |
| Tallinna Puuetega Inimeste Koda | Avatud kontoriruum | <https://tallinnakoda.ee/avatud-kontoriruum> |
| Tallinna Puuetega Inimeste Koda | Huvitegevused Tallinna Puuetega Inimeste Kojas 2026. aastal | <https://tallinnakoda.ee/huvitegevused-tallinna-puuetega-inimeste-kojas-2026-aastal> |
| Tallinna Puuetega Inimeste Koda | Liikmesühingud | <https://tallinnakoda.ee/liikmesuhingud> |
| Tallinna Puuetega Inimeste Koda | Meelte aed | <https://tallinnakoda.ee/meelte-aed> |
| Tallinna Puuetega Inimeste Koda | Ruumide rent | <https://tallinnakoda.ee/ruumide-rent> |
| Tallinna Puuetega Inimeste Koda | Tallinna Koja liikmesühingud | <https://tallinnakoda.ee/liikmesuhingud/> |
| Tallinna Puuetega Inimeste Koda | Tegevuskeskus | <https://tallinnakoda.ee/tegevuskeskus> |
| Tallinna Puuetega Inimeste Koda | Võta ühendust! | <https://tallinnakoda.ee/kontakt> |
| Tartu Puuetega Inimeste Koda | Tartu Puuetega Inimeste Koda | <https://tartukoda.ee/> |
| Tartu Puuetega Inimeste Koda | Elva Puuetega Inimeste Ühing | <https://tartukoda.ee/liikmed/elva-puuetega-inimeste-uhing> |
| Tartu Puuetega Inimeste Koda | Kojast | <https://tartukoda.ee/kojast> |
| Tartu Puuetega Inimeste Koda | Kontakt | <https://tartukoda.ee/kontakt> |
| Tartu Puuetega Inimeste Koda | Liigesehaigete Laste Ühing | <https://tartukoda.ee/liikmed/liigesehaigete-laste-uhing> |
| Tartu Puuetega Inimeste Koda | Liikmed | <https://tartukoda.ee/liikmed> |
| Tartu Puuetega Inimeste Koda | Lõuna-Eesti Pimedate Ühing | <https://tartukoda.ee/liikmed/louna-eesti-pimedate-uhing> |
| Tartu Puuetega Inimeste Koda | Lõuna-Eesti Vähiühing | <https://tartukoda.ee/liikmed/louna-eesti-vahiuhing> |
| Tartu Puuetega Inimeste Koda | MTÜ CP & Liitpuudega Inimeste Perede Ühing | <https://tartukoda.ee/liikmed/mtu-cp-ja-liitpuudega-inimeste-perede-uhing> |
| Tartu Puuetega Inimeste Koda | Projektid | <https://tartukoda.ee/projektid> |
| Tartu Puuetega Inimeste Koda | Ropka-Karlova päevakeskus | <https://tartukoda.ee/ropka-karlova-paevakeskus> |
| Tartu Puuetega Inimeste Koda | Ropka-Karlova Päevakeskuse juubeli tähistamine | <https://tartukoda.ee/ropka-karlova-paevakeskuse-juubeli-tahistamine> |
| Tartu Puuetega Inimeste Koda | TARTU ALLERGIA- JA ASTMAÜHENDUS | <https://tartukoda.ee/liikmed/tartu-allergia-ja-astmauhendus> |
| Tartu Puuetega Inimeste Koda | Tartu Autismiühing | <https://tartukoda.ee/liikmed/tartu-autismiuhing> |
| Tartu Puuetega Inimeste Koda | Tartu Diabeetikute Selts | <https://tartukoda.ee/liikmed/tartu-diabeetikute-selts> |
| Tartu Puuetega Inimeste Koda | Tartu Kardioühing | <https://tartukoda.ee/liikmed/tartu-reumauhing> |
| Tartu Puuetega Inimeste Koda | Tartu Parkinsoni Haiguse Selts | <https://tartukoda.ee/liikmed/tartu-parkinsoni-haiguse-selts> |
| Tartu Puuetega Inimeste Koda | TARTU SCLEROSIS MULTIPLEX`I ÜHING | <https://tartukoda.ee/liikmed/tartu-sclerosis-multiplex-uhing> |
| Tartu Puuetega Inimeste Koda | Tartumaa Kurtide Ühing | <https://tartukoda.ee/liikmed/tartumaa-kurtide-uhing> |
| Tartu Puuetega Inimeste Koda | TARTUMAA PUUETEGA LASTE, NOORTE JA NENDE VANEMATE ÜHENDUS | <https://tartukoda.ee/liikmed/tartumaa-puudega-laste-noorte-ja-nende-vanemate-uhendus> |
| Tugiliisu | Erivajadustega Inimeste Toetusühing Tugiliisu | <https://tugiliisu.ee/> |
| Tugiliisu | MEIE ERIPÄRA ehk MIKS JUST TUGILIISU? | <https://tugiliisu.ee/asutus-ja-eesmargid/meie-eripara> |
| Tugiliisu | Tugiliisu KOOLITAB! | <https://tugiliisu.ee/proovikas> |
| Tugiliisu | EETIKA | <https://tugiliisu.ee/asutus-ja-eesmargid/eetilise-tegutsemise-pohimotted> |
| Tugiliisu | Ettepanekute, kiituste ja kaebuste esitamise ja lahendamise kord | <https://tugiliisu.ee/asutus-ja-eesmargid/ettepanekute-kiituste-ja-kaebuste-esitamise-ja-lahendamise-kord> |
| Tugiliisu | IGAPÄEVAELU TOETAMISE TEENUS | <https://tugiliisu.ee/teenused/igapaevaelu-toetamise-teenus> |
| Tugiliisu | Kakumäe Kodu ( KE teenus Kakumäel ) | <https://tugiliisu.ee/teenused/kogukonnas-elamise-teenus/kakumae-kodu> |
| Tugiliisu | KE korter Sõpruse pst 208 | <https://tugiliisu.ee/ke-korter-sopruse-pst-208> |
| Tugiliisu | KOGUKONNAS ELAMISE TEENUS | <https://tugiliisu.ee/teenused/kogukonnas-elamise-teenus> |
| Tugiliisu | KUIDAS SAAN TEENUSELE? | <https://tugiliisu.ee/teenused/kuidas-saab-meie-teenusele> |
| Tugiliisu | KVALITEET | <https://tugiliisu.ee/asutus-ja-eesmargid/meie-kvaliteet> |
| Tugiliisu | MEIST | <https://tugiliisu.ee/asutus-ja-eesmargid> |
| Tugiliisu | TEENUSED | <https://tugiliisu.ee/teenused> |
| Tugiliisu | TOETATUD ELAMISE TEENUS | <https://tugiliisu.ee/teenused/toetatud-elamise-teenus> |
| Tugiliisu | TÖÖTAMISE TOETAMISE TEENUS | <https://tugiliisu.ee/teenused/tootamise-toetamise-teenus> |
| Tugiliisu | Villa Liisu (KE teenus Nõmmel) | <https://tugiliisu.ee/teenused/kogukonnas-elamise-teenus/villa-liisu-ke-teenus-nommel> |
| Tugiliisu | VÄÄRTUSED | <https://tugiliisu.ee/asutus-ja-eesmargid/meie-vaartused> |
| Viipekeeletõlgid OÜ | Hinnakiri aastal 2026 | <https://www.viipekeeletolgid.ee/hinnakiri> |
| Viipekeeletõlgid OÜ | Kirjutustõlketeenus | <https://www.viipekeeletolgid.ee/teenused/kirjutustolketeenus> |
| Viipekeeletõlgid OÜ | Koolitusteenused | <https://www.viipekeeletolgid.ee/teenused/koolitusteenused> |
| Viipekeeletõlgid OÜ | Meist | <https://www.viipekeeletolgid.ee/meist> |
| Viipekeeletõlgid OÜ | Nõustamisteenused | <https://www.viipekeeletolgid.ee/teenused/noustamisteenused> |
| Viipekeeletõlgid OÜ | Tasuta kirjutustõlketeenus | <https://www.viipekeeletolgid.ee/teenused/tasuta-kirjutustolketeenus> |
| Viipekeeletõlgid OÜ | Teenused | <https://www.viipekeeletolgid.ee/teenused> |
| Viipekeeletõlgid OÜ | Tellimuste menetlemise kord | <https://www.viipekeeletolgid.ee/telli-tolk/tellimuste-menetlemise-kord> |
| Viipekeeletõlgid OÜ | Tõlketeenused | <https://www.viipekeeletolgid.ee/teenused/tolketeenuse> |
| Viljandimaa Puuetega Inimeste Nõukoda | VILJANDIMAA PUUETEGA INIMESTE NÕUKODA | <https://viljandipin.eu/> |
| Viljandimaa Puuetega Inimeste Nõukoda | Diabeetikute Selts | <https://viljandipin.eu/diabeetikute-selts> |
| Viljandimaa Puuetega Inimeste Nõukoda | Epilepsia Ühing | <https://viljandipin.eu/epilepsia-uhing> |
| Viljandimaa Puuetega Inimeste Nõukoda | Kontakt | <https://viljandipin.eu/kontakt> |
| Viljandimaa Puuetega Inimeste Nõukoda | Liikmesorganisatsioonid | <https://viljandipin.eu/liikmesorganisatsioonid> |
| Viljandimaa Puuetega Inimeste Nõukoda | Lõuna-Mulgimaa Puuetega Inimeste Ühing | <https://viljandipin.eu/louna-mulgimaa-puuetega-inimeste-uhing> |
| Viljandimaa Puuetega Inimeste Nõukoda | Nõukojast | <https://viljandipin.eu/noukojast> |
| Viljandimaa Puuetega Inimeste Nõukoda | Projektid | <https://viljandipin.eu/projektid> |
| Viljandimaa Puuetega Inimeste Nõukoda | Rahvusvaheline patsiendiohutuse päev | <https://viljandipin.eu/rahvusvaheline-patsiendiohutuse-paev> |
| Viljandimaa Puuetega Inimeste Nõukoda | Trükised | <https://viljandipin.eu/trukised> |
| Võrumaa Puuetega Inimeste Koda | Võrumaa Puuetega Inimeste Koda | <https://www.vorukoda.ee/> |
| Võrumaa Puuetega Inimeste Koda | Kasulikke viiteid | <https://www.vorukoda.ee/kasulikku/kasulikke-viiteid> |
| Võrumaa Puuetega Inimeste Koda | Kasulikku | <https://www.vorukoda.ee/kasulikku> |
| Võrumaa Puuetega Inimeste Koda | Kojast | <https://www.vorukoda.ee/kojast> |
| Võrumaa Puuetega Inimeste Koda | Kontakt | <https://www.vorukoda.ee/kontakt> |
| Võrumaa Puuetega Inimeste Koda | Ligipääsetavus Võru linnas | <https://www.vorukoda.ee/kasulikku/ligipaasetavus-voru-linnas> |
| Võrumaa Puuetega Inimeste Koda | Liikmesühingud | <https://www.vorukoda.ee/kojast/liikmesuhingud> |
| Võrumaa Puuetega Inimeste Koda | PIK ringid | <https://www.vorukoda.ee/tegevused/pik-ringid> |
| Võrumaa Puuetega Inimeste Koda | TASUTA ÕIGUSABI ERIVAJADUSTEGA INIMESTELE | <https://www.vorukoda.ee/tasuta-oigusabi-erivajadustega-inimestele> |

### Asutuste juhislehed, valitud reegliga (1227)

| Väljaandja | Pealkiri | Aadress |
|---|---|---|
| Andmekaitse Inspektsioon | Andmekaitsespetsialist | <https://www.aki.ee/isikuandmed/andmetootlejale/andmekaitsespetsialist> |
| Andmekaitse Inspektsioon | Andmekaitsetingimuste koostamine | <https://www.aki.ee/isikuandmed/andmetootlejale/andmekaitsetingimuste-koostamisest> |
| Andmekaitse Inspektsioon | Andmetega tutvumine | <https://www.aki.ee/isikuandmed/inimese-oigused/isikuandmetega-tutvumine> |
| Andmekaitse Inspektsioon | Andmeturve | <https://www.aki.ee/isikuandmed/andmetootlejale/andmeturve> |
| Andmekaitse Inspektsioon | Andmetöötleja vastutus ja kohustused | <https://www.aki.ee/isikuandmed/andmetootlejale/andmetootleja-vastutus-ja-kohustused> |
| Andmekaitse Inspektsioon | Andmetöötluse põhimõtted | <https://www.aki.ee/isikuandmed/andmetootlejale/andmetootluse-pohimotted> |
| Andmekaitse Inspektsioon | Automatiseeritud otsused ja profiilianalüüs | <https://www.aki.ee/isikuandmed/inimese-oigused/automatiseeritud-otsused-ja-profiilianaluus> |
| Andmekaitse Inspektsioon | Haridus ja lapsed | <https://www.aki.ee/isikuandmed/kkk/haridus-ja-lapsed> |
| Andmekaitse Inspektsioon | Inimese õiguste tagamine | <https://www.aki.ee/isikuandmed/andmetootlejale/inimese-oiguste-tagamine> |
| Andmekaitse Inspektsioon | Isikuandmed uuringutes | <https://www.aki.ee/isikuandmed/andmetootlejale/isikuandmed-uuringutes> |
| Andmekaitse Inspektsioon | Isikuandmete kustutamine | <https://www.aki.ee/isikuandmed/inimese-oigused/isikuandmete-kustutamine> |
| Andmekaitse Inspektsioon | Isikuandmete parandamine | <https://www.aki.ee/isikuandmed/inimese-oigused/isikuandmete-parandamine> |
| Andmekaitse Inspektsioon | Isikuandmete töötleja üldjuhend | <https://www.aki.ee/isikuandmed/juhendid-ja-abimaterjalid/isikuandmete-tootleja-uldjuhend> |
| Andmekaitse Inspektsioon | Isikuandmete töötlemine koolis | <https://www.aki.ee/isikuandmete-tootlemine-koolis> |
| Andmekaitse Inspektsioon | Isikuandmete töötlemine tervishoius | <https://www.aki.ee/isikuandmete-tootlemine-tervishoius> |
| Andmekaitse Inspektsioon | Isikuandmete töötlemine töösuhetes | <https://www.aki.ee/isikuandmed/juhendid-ja-abimaterjalid/isikuandmete-tootlemine-toosuhetes> |
| Andmekaitse Inspektsioon | Isikuandmete töötlemise piiramine | <https://www.aki.ee/isikuandmed/inimese-oigused/isikuandmete-tootlemise-piiramine> |
| Andmekaitse Inspektsioon | Isikuandmete ülekandmine | <https://www.aki.ee/isikuandmed/inimese-oigused/isikuandmete-ulekandmine> |
| Andmekaitse Inspektsioon | Kaamerad | <https://www.aki.ee/isikuandmed/kkk/kaamerad> |
| Andmekaitse Inspektsioon | Maksehäired | <https://www.aki.ee/isikuandmed/kkk/maksehaired> |
| Andmekaitse Inspektsioon | Mõisted | <https://www.aki.ee/isikuandmed/kkk/moisted> |
| Andmekaitse Inspektsioon | Riik | <https://www.aki.ee/isikuandmed/kkk/riik> |
| Andmekaitse Inspektsioon | Teave isikuandmete kasutamise kohta | <https://www.aki.ee/isikuandmed/inimese-oigused/teave-isikuandmete-kasutamise-kohta> |
| Andmekaitse Inspektsioon | Tervishoid | <https://www.aki.ee/isikuandmed/kkk/tervishoid> |
| Andmekaitse Inspektsioon | Töösuhted | <https://www.aki.ee/isikuandmed/kkk/toosuhted> |
| Andmekaitse Inspektsioon | Töötlemise õiguslikud alused | <https://www.aki.ee/isikuandmed/andmetootlejale/tootlemise-oiguslikud-alused> |
| Andmekaitse Inspektsioon | Vastuväidete esitamine | <https://www.aki.ee/isikuandmed/inimese-oigused/vastuvaidete-esitamine> |
| Andmekaitse Inspektsioon | Ühisjuhend: Abivajavast lapsest teatamine ja andmekaitse | <https://www.aki.ee/juhendid/isikuandmed/uhisjuhend-abivajavast-lapsest-teatamine-ja-andmekaitse> |
| Eesti Töötukassa | Abi ja nõustamine koondamisel | <https://www.tootukassa.ee/et/teenused/tooandjatele/abi-ja-noustamine-koondamisel> |
| Eesti Töötukassa | Abiks kandideerijale | <https://www.tootukassa.ee/et/teenused/toootsingud/abiks-kandideerijale> |
| Eesti Töötukassa | Ajutine töötamine arveloleku ajal | <https://www.tootukassa.ee/et/teenused/toootsingud/ajutine-tootamine-arveloleku-ajal> |
| Eesti Töötukassa | Alaealise tööle võtmine | <https://www.tootukassa.ee/et/teenused/tooandjatele/alaealise-toole-votmine> |
| Eesti Töötukassa | Alaealise töötamise toetamine | <https://www.tootukassa.ee/et/teenused/tooandjatele/alaealise-tootamise-toetamine> |
| Eesti Töötukassa | Arengutreening | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/arengutreening> |
| Eesti Töötukassa | Arstivisiit ja hindamise taotluse esitamine | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/arstivisiit-ja-hindamise-taotluse-esitamine> |
| Eesti Töötukassa | Avaldused ja vormid | <https://www.tootukassa.ee/et/otseteed/avaldused-ja-vormid> |
| Eesti Töötukassa | Eksperdiarvamuse koostamine | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/eksperdiarvamuse-koostamine> |
| Eesti Töötukassa | Elektroonilised osavõtuandmed | <https://www.tootukassa.ee/et/artikkel/elektroonilised-osavotuandmed> |
| Eesti Töötukassa | Esindused \| Töötukassa | <https://www.tootukassa.ee/et/kontaktid/esindused> |
| Eesti Töötukassa | Ettevõtluse järelteenused | <https://www.tootukassa.ee/et/teenused/ettevotlusega-alustamine/ettevotluse-jarelteenused> |
| Eesti Töötukassa | Ettevõtlusega alustamine | <https://www.tootukassa.ee/et/teenused/ettevotlusega-alustamine> |
| Eesti Töötukassa | EURES (Euroopa töövahenduse teenused) | <https://www.tootukassa.ee/et/teenused/eures-euroopa-toovahenduse-teenused> |
| Eesti Töötukassa | Euroopa Liit ja töötuskindlustus | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/euroopa-liit-ja-tootuskindlustus> |
| Eesti Töötukassa | Euroopa Liit ja töövõimetoetus | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/euroopa-liit-ja-toovoimetoetus> |
| Eesti Töötukassa | EVAT kasutamine | <https://www.tootukassa.ee/et/teenused/ettevotlusega-alustamine/evat-kasutamine> |
| Eesti Töötukassa | EVAT kasutamise kontroll | <https://www.tootukassa.ee/et/teenused/ettevotlusega-alustamine/evat-kasutamise-kontroll> |
| Eesti Töötukassa | EVAT korduma kippuvad küsimused | <https://www.tootukassa.ee/et/teenused/ettevotlusega-alustamine-sai-taotleda-kuni-31032026/evat-korduma-kippuvad-kusimused> |
| Eesti Töötukassa | Hindamise otsus ja abi töö leidmisel | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/hindamise-otsus-ja-abi-too-leidmisel> |
| Eesti Töötukassa | Juhatus ja nõukogu | <https://www.tootukassa.ee/et/kontaktid/juhatus-ja-noukogu> |
| Eesti Töötukassa | Juhatuse liige | <https://www.tootukassa.ee/et/teenused/toootsingud/juhatuse-liige> |
| Eesti Töötukassa | Karjäär ja koolitamine | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine> |
| Eesti Töötukassa | Karjääri kujundamine | <https://www.tootukassa.ee/et/karjaarikujundajale/karjaarikujundamine> |
| Eesti Töötukassa | Karjäärinõustamine | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/karjaarinoustamine> |
| Eesti Töötukassa | Kollektiivne koondamine | <https://www.tootukassa.ee/et/teenused/tooandjatele/kollektiivne-koondamine> |
| Eesti Töötukassa | Koolitajate otsing | <https://www.tootukassa.ee/et/koolitajad?pageSize=20> |
| Eesti Töötukassa | Koolitused töötavatele inimestele | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/koolitus-tootajale-toota-ja-opi> |
| Eesti Töötukassa | Koolituskaart | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/koolituskaart> |
| Eesti Töötukassa | Koolitustoetus tööandjatele | <https://www.tootukassa.ee/et/teenused/tooandjatele/koolitustoetus-tooandjatele> |
| Eesti Töötukassa | Koolitustoetus tööandjatele muutuste olukorras | <https://www.tootukassa.ee/et/teenused/tooandjatele/koolitustoetus-tooandjatele-muutuste-olukorras> |
| Eesti Töötukassa | Koolitustoetus tööandjatele töötaja digioskuste arendamiseks | <https://www.tootukassa.ee/et/teenused/tooandjatele/koolitustoetus-tooandjatele-tootaja-ikt-oskuste-arendamiseks> |
| Eesti Töötukassa | Koolitustoetus tööandjatele töötaja eesti keele oskuse arendamiseks | <https://www.tootukassa.ee/et/teenused/tooandjatele/koolitustoetus-tooandjatele-tootaja-eesti-keele-oskuse-arendamiseks> |
| Eesti Töötukassa | Koolitustoetus tööandjatele töötaja roheoskuste arendamiseks | <https://www.tootukassa.ee/et/teenused/tooandjatele/koolitustoetus-tooandjatele-tootaja-roheoskuste-arendamiseks> |
| Eesti Töötukassa | Koolitustoetus tööandjatele töötajate värbamiseks | <https://www.tootukassa.ee/et/teenused/tooandjatele/koolitustoetus-tooandjatele-tootajate-varbamiseks> |
| Eesti Töötukassa | Koondamine ja maksejõuetus | <https://www.tootukassa.ee/et/koondamine-ja-maksejouetus> |
| Eesti Töötukassa | Koondamise korral | <https://www.tootukassa.ee/et/teenused/toootsingud/koondamise-korral> |
| Eesti Töötukassa | Koondamishüvitis | <https://www.tootukassa.ee/et/teenused/tooandjatele/koondamishuvitis> |
| Eesti Töötukassa | Koostöökokkulepped töötuna registreeritud kliendiga | <https://www.tootukassa.ee/et/artikkel/koostookokkulepped-tootuna-registreeritud-kliendiga> |
| Eesti Töötukassa | Koostöövõimalused EURES Euroopa tööturuasutuste võrgustikuga | <https://www.tootukassa.ee/et/teenused/partneritele/koostoovoimalused-eures-euroopa-tooturuasutuste-vorgustikuga> |
| Eesti Töötukassa | Koostöövõimalused kogemusnõustajatele | <https://www.tootukassa.ee/et/teenused/partneritele/koostoovoimalused-kogemusnoustajatele> |
| Eesti Töötukassa | Koostöövõimalused koolitusasutustele | <https://www.tootukassa.ee/et/teenused/partneritele/koostoovoimalused-koolitusasutustele> |
| Eesti Töötukassa | Koostöövõimalused nõustamisteenuste osutajatele | <https://www.tootukassa.ee/et/teenused/partneritele/koostoovoimalused-noustamisteenuste-osutajatele> |
| Eesti Töötukassa | Koostöövõimalused tööandjatele | <https://www.tootukassa.ee/et/teenused/partneritele/koostoovoimalused-tooandjatele> |
| Eesti Töötukassa | Koostöövõimalused üldhariduskoolidele | <https://www.tootukassa.ee/et/teenused/partneritele/koostoovoimalused-uldhariduskoolidele> |
| Eesti Töötukassa | Luba välismaalase töölevõtmiseks | <https://www.tootukassa.ee/et/teenused/tooandjatele/luba-valismaalase-toolevotmiseks> |
| Eesti Töötukassa | Maksmise peatamine ja lõpetamine | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/maksmise-peatamine-ja-lopetamine> |
| Eesti Töötukassa | Maksuvaba tulu alates 1. jaanuarist 2026 | <https://www.tootukassa.ee/et/teenused/tooandjatele/maksuvaba-tulu-alates-1-jaanuarist-2026> |
| Eesti Töötukassa | Noorele | <https://www.tootukassa.ee/et/teenused/toootsingud/noorele> |
| Eesti Töötukassa | Nõustamisteenuste osutajad | <https://www.tootukassa.ee/et/noustamisteenused> |
| Eesti Töötukassa | Oskuste arendamine | <https://www.tootukassa.ee/et/karjaarikujundajale/oskuste-arendamine> |
| Eesti Töötukassa | Palgatoetus | <https://www.tootukassa.ee/et/teenused/tooandjatele/palgatoetus> |
| Eesti Töötukassa | Pankrotihüvitis | <https://www.tootukassa.ee/et/teenused/tooandjatele/pankrotihuvitis> |
| Eesti Töötukassa | Partnerite võimalused | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/partnerite-voimalused> |
| Eesti Töötukassa | Pikaajaline haigusleht | <https://www.tootukassa.ee/et/teenused/too-ja-tervis/pikaajaline-haigusleht> |
| Eesti Töötukassa | Proovitöö | <https://www.tootukassa.ee/et/teenused/toootsingud/proovitoo> |
| Eesti Töötukassa | Psühholoogiline ja võlanõustamine | <https://www.tootukassa.ee/et/teenused/toootsingud/psuhholoogiline-ja-volanoustamine> |
| Eesti Töötukassa | Põlevkivisektori töötajale | <https://www.tootukassa.ee/et/teenused/toootsingud/polevkivisektori-tootajale> |
| Eesti Töötukassa | Rahvusvahelise kaitse saaja töötamise toetamine (sai taotleda kuni 31.08.2026) | <https://www.tootukassa.ee/et/teenused/tooandjatele/rahvusvahelise-kaitse-saaja-tootamise-toetamine> |
| Eesti Töötukassa | Ravikindlustus | <https://www.tootukassa.ee/et/teenused/toootsingud/ravikindlustus> |
| Eesti Töötukassa | Seminarid | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/seminarid> |
| Eesti Töötukassa | Sertifikaadi või kutsetunnistuse kulude hüvitamine | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/sertifikaadi-voi-kutsetunnistuse-kulude-huvitamine> |
| Eesti Töötukassa | Sertifikaadi või kutsetunnistuse saamine | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/sertifikaadi-voi-kutsetunnistuse-saamine> |
| Eesti Töötukassa | Sotsiaalmaksu hüvitamine vähenenud töövõimega inimese eest | <https://www.tootukassa.ee/et/teenused/tooandjatele/sotsiaalmaksu-huvitamine-vahenenud-toovoimega-inimese-eest> |
| Eesti Töötukassa | Stipendium | <https://www.tootukassa.ee/et/teenused/toootsingud/stipendium> |
| Eesti Töötukassa | Sõidu- ja majutustoetus | <https://www.tootukassa.ee/et/teenused/toootsingud/soidu-ja-majutustoetus> |
| Eesti Töötukassa | Taotluse esitamine eestkoste või volitusega | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/taotluse-esitamine-eestkoste-voi-volitusega> |
| Eesti Töötukassa | Tasemeõppes osalemise toetus | <https://www.tootukassa.ee/et/teenused/karjaar-ja-koolitamine/tasemeoppes-osalemise-toetus> |
| Eesti Töötukassa | Teiste riikide tööturuasutused | <https://www.tootukassa.ee/et/teenused/eures-euroopa-toovahenduse-teenused/teiste-riikide-tooturuasutused> |
| Eesti Töötukassa | Tervisepiiranguga inimese tööandja nõustamine | <https://www.tootukassa.ee/et/teenused/tooandjatele/tervisepiiranguga-inimese-tooandja-noustamine> |
| Eesti Töötukassa | Tervisepiiranguga inimese töötamise toetamine | <https://www.tootukassa.ee/et/teenused/tooandjatele/tervisepiiranguga-inimese-tootamise-toetamine> |
| Eesti Töötukassa | Toetatavad põhikutsealad | <https://www.tootukassa.ee/et/artikkel/toetatavad-pohikutsealad> |
| Eesti Töötukassa | Toetatud töölerakendamine | <https://www.tootukassa.ee/et/teenused/too-ja-tervis/toetatud-toolerakendamine> |
| Eesti Töötukassa | Toetuse maksmine | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/toetuse-maksmine> |
| Eesti Töötukassa | Toetuse ümberarvutamine suurenenud sissetuleku tõttu | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/toetuse-umberarvutamine-suurenenud-sissetuleku-tottu> |
| Eesti Töötukassa | Tugiisikuga töötamine | <https://www.tootukassa.ee/et/teenused/too-ja-tervis/tugiisikuga-tootamine> |
| Eesti Töötukassa | Töö ja tervis | <https://www.tootukassa.ee/et/teenused/too-ja-tervis> |
| Eesti Töötukassa | Töö ja töötaja Euroopast (EURES) | <https://www.tootukassa.ee/et/teenused/eures-euroopa-toovahenduse-teenused/too-ja-tootaja-euroopast-eures> |
| Eesti Töötukassa | Töö kaotamine | <https://www.tootukassa.ee/et/toootsijale/too-kaotamine> |
| Eesti Töötukassa | Tööalane abivahend | <https://www.tootukassa.ee/et/teenused/too-ja-tervis/tooalane-abivahend> |
| Eesti Töötukassa | Tööalane rehabilitatsioon | <https://www.tootukassa.ee/et/teenused/too-ja-tervis/tooalane-rehabilitatsioon> |
| Eesti Töötukassa | Tööalase rehabilitatsiooni osutajad | <https://www.tootukassa.ee/et/rehabilitatsioon> |
| Eesti Töötukassa | Tööalaste abivahendite ja töökoha kohandamise näited | <https://www.tootukassa.ee/et/artikkel/tooalaste-abivahendite-ja-tookoha-kohandamise-naited> |
| Eesti Töötukassa | Tööampsude KKK | <https://www.tootukassa.ee/et/artikkel/tooampsude-kkk> |
| Eesti Töötukassa | Tööandja tegevus kollektiivsel koondamisel | <https://www.tootukassa.ee/et/teenused/tooandjatele/tooandja-tegevus-kollektiivsel-koondamisel> |
| Eesti Töötukassa | Tööandjatele | <https://www.tootukassa.ee/et/teenused/tooandjatele> |
| Eesti Töötukassa | Töökeskne nõustamine | <https://www.tootukassa.ee/et/teenused/toootsingud/tookeskne-noustamine> |
| Eesti Töötukassa | Töökoha kohandamine | <https://www.tootukassa.ee/et/teenused/too-ja-tervis/tookoha-kohandamine> |
| Eesti Töötukassa | Tööotsingud | <https://www.tootukassa.ee/et/teenused/toootsingud> |
| Eesti Töötukassa | Tööpraktika | <https://www.tootukassa.ee/et/teenused/toootsingud/toopraktika> |
| Eesti Töötukassa | Tööta ja õpi | <https://www.tootukassa.ee/et/toota-ja-opi> |
| Eesti Töötukassa | Töötaja ja muu isik | <https://www.tootukassa.ee/et/teenused/toootsingud/tootaja-ja-muu-isik> |
| Eesti Töötukassa | Töötaja leidmine ja koolitamine | <https://www.tootukassa.ee/et/tootaja-leidmine-ja-koolitamine> |
| Eesti Töötukassa | Töötajate vaba liikumine ja sotsiaalkindlustus | <https://www.tootukassa.ee/et/teenused/eures-euroopa-toovahenduse-teenused/tootajate-vaba-liikumine-ja-sotsiaalkindlustus> |
| Eesti Töötukassa | Töötamine Eestis | <https://www.tootukassa.ee/et/teenused/toootsingud/tootamine-eestis> |
| Eesti Töötukassa | Töötukassa esindused | <https://www.tootukassa.ee/kontaktid/tootukassa-esindused> |
| Eesti Töötukassa | Töötukassast | <https://www.tootukassa.ee/et/tootukassast> |
| Eesti Töötukassa | Töötuna arveloleku lõpetamine | <https://www.tootukassa.ee/et/teenused/toootsingud/tootuna-arveloleku-lopetamine> |
| Eesti Töötukassa | Töötuna registreerimine | <https://www.tootukassa.ee/et/teenused/toootsingud/tootuna-registreerimine> |
| Eesti Töötukassa | Töötushüvitiste maksmise süsteemi muudatuse KKK | <https://www.tootukassa.ee/et/artikkel/tootushuvitiste-maksmise-susteemi-muudatuse-kkk> |
| Eesti Töötukassa | Töötuskindlustushüvitis | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis> |
| Eesti Töötukassa | Töötuskindlustushüvitis laevapere liikmetele | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitis-laevapere-liikmetele> |
| Eesti Töötukassa | Töötuskindlustushüvitis välisriigis tööd otsides | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitis-valisriigis-tood-otsides> |
| Eesti Töötukassa | Töötuskindlustushüvitise arvestamine ja maksmine | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitise-arvestamine-ja-maksmine> |
| Eesti Töötukassa | Töötuskindlustushüvitise korduv taotlemine | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitise-korduv-taotlemine> |
| Eesti Töötukassa | Töötuskindlustushüvitise maksmise lõpetamine enne perioodi lõppu | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitise-maksmise-lopetamine-enne-perioodi-loppu> |
| Eesti Töötukassa | Töötuskindlustushüvitise maksmise periood | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitise-maksmise-periood> |
| Eesti Töötukassa | Töötuskindlustushüvitise perioodi KKK | <https://www.tootukassa.ee/et/artikkel/tootuskindlustushuvitise-perioodi-kkk> |
| Eesti Töötukassa | Töötuskindlustushüvitise suurus ja selle arvutamine | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitise-suurus-ja-selle-arvutamine> |
| Eesti Töötukassa | Töötuskindlustushüvitise taotlemine ja määramine | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustushuvitise-taotlemine-ja-maaramine> |
| Eesti Töötukassa | Töötuskindlustusmakse | <https://www.tootukassa.ee/et/teenused/tooandjatele/tootuskindlustusmakse> |
| Eesti Töötukassa | Töötuskindlustusstaaži arvestamine | <https://www.tootukassa.ee/et/teenused/tootuskindlustushuvitis/tootuskindlustusstaazi-arvestamine> |
| Eesti Töötukassa | Töövahendus | <https://www.tootukassa.ee/et/teenused/tooandjatele/toovahendus> |
| Eesti Töötukassa | Töövõime hindamine | <https://www.tootukassa.ee/et/tervisepiiranguga-inimesele/toovoime-hindamine> |
| Eesti Töötukassa | Töövõime hindamine | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine> |
| Eesti Töötukassa | Töövõime hindamise põhimõtted ja metoodika | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/toovoime-hindamise-pohimotted-ja-metoodika> |
| Eesti Töötukassa | Töövõime hindamise taotlemine välismaal elades | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/toovoime-hindamise-taotlemine-valismaal-elades> |
| Eesti Töötukassa | Töövõime hindamise taotluse esitamine esindaja poolt | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/toovoime-hindamise-taotluse-esitamine-esindaja-poolt> |
| Eesti Töötukassa | Töövõimekaart | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/toovoimekaart> |
| Eesti Töötukassa | Töövõimet hindavad tervishoiuasutused | <https://www.tootukassa.ee/et/teenused/toovoime-hindamine/toovoimet-hindavad-tervishoiuasutused> |
| Eesti Töötukassa | Töövõimetoetus | <https://www.tootukassa.ee/et/teenused/toovoimetoetus> |
| Eesti Töötukassa | Töövõimetoetuse maksmise jätkamine kordushindamisel | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/toovoimetoetuse-maksmise-jatkamine-kordushindamisel> |
| Eesti Töötukassa | Töövõimetoetuse saamise tingimused | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/toovoimetoetuse-saamise-tingimused> |
| Eesti Töötukassa | Töövõimetoetuse suurus | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/toovoimetoetuse-suurus> |
| Eesti Töötukassa | Töövõimetoetuse taotlemine | <https://www.tootukassa.ee/et/tervisepiiranguga-inimesele/toovoimetoetuse-taotlemine> |
| Eesti Töötukassa | Vaide esitamine | <https://www.tootukassa.ee/et/jalus/ametlikku/vaide-esitamine> |
| Eesti Töötukassa | Vanaduspensioniealisele | <https://www.tootukassa.ee/et/teenused/toootsingud/vanaduspensioniealisele> |
| Eesti Töötukassa | Vähese tähtsusega abi | <https://www.tootukassa.ee/et/vahese-tahtsusega-abi-ja-riigiabi> |
| Eesti Töötukassa | Õigus töövõimetoetusele | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/oigus-toovoimetoetusele> |
| Eesti Töötukassa | Üldkontakt | <https://www.tootukassa.ee/et/kontaktid> |
| Eesti Töötukassa | Üleminek töövõimetuspensionilt töövõimetoetusele | <https://www.tootukassa.ee/et/teenused/toovoimetoetus/uleminek-toovoimetuspensionilt-toovoimetoetusele> |
| Haridus- ja Noorteamet (Teeviit) | 10 nippi turvalise kohtingurakenduse kohtumiseks | <https://www.teeviit.ee/10-nippi-turvalisteks-kohtinguteks/> |
| Haridus- ja Noorteamet (Teeviit) | 10 nippi, kuidas hoiduda läbipõlemisest | <https://www.teeviit.ee/10-nippi-kuidas-hoiduda-labipolemisest/> |
| Haridus- ja Noorteamet (Teeviit) | 5 küsimust ja vastust alkoholi kohta | <https://www.teeviit.ee/5-kusimust-ja-vastust-alkoholi-kohta/> |
| Haridus- ja Noorteamet (Teeviit) | 5 tehnikat ärevuse leevendamiseks iseseisvalt | <https://www.teeviit.ee/viis-tehnikat-arevuse-leevendamiseks-iseseisvalt/> |
| Haridus- ja Noorteamet (Teeviit) | Alkoholi- või narkojoobes juhtimine | <https://www.teeviit.ee/alkoholi-voi-narkojoobes-juhtimine/> |
| Haridus- ja Noorteamet (Teeviit) | Asjad, mida pead teadma korgijoogist ja seksuaalvägivallast | <https://www.teeviit.ee/asjad-mida-pead-teadma-korgijoogist-ja-seksuaalvagivallast/> |
| Haridus- ja Noorteamet (Teeviit) | Depressioon – mis see on ja kuidas seda ära tunda? | <https://www.teeviit.ee/depressioon-mis-see-on-ja-kuidas-seda-ara-tunda/> |
| Haridus- ja Noorteamet (Teeviit) | Depressiooniga toimetulek – mõned soovitused enda abistamiseks | <https://www.teeviit.ee/depressiooniga-toimetulek-moned-soovitused-enda-abistamiseks/> |
| Haridus- ja Noorteamet (Teeviit) | Digisõltuvus võib tabada igaüht | <https://www.teeviit.ee/digisoltuvus-voib-tabada-igauht/> |
| Haridus- ja Noorteamet (Teeviit) | E-sigaretid – kuidas tubakatööstus meid oma sõnumitega mõjutab? | <https://www.teeviit.ee/e-sigaretid-kuidas-tubakatoostus-meid-oma-sonumitega-mojutab/> |
| Haridus- ja Noorteamet (Teeviit) | Emotsioonid ja nende väljendumine | <https://www.teeviit.ee/vaimne-tervis-emotsioonid-ja-nende-valjendumine/> |
| Haridus- ja Noorteamet (Teeviit) | Enamlevinud vaimse tervise mured | <https://www.teeviit.ee/enamlevinud-vaimse-tervise-mured/> |
| Haridus- ja Noorteamet (Teeviit) | Energiajookide mõju tervisele – mida peaksid teadma? | <https://www.teeviit.ee/energiajook-ei-erguta/> |
| Haridus- ja Noorteamet (Teeviit) | Enesevigastamine – mida see tegelikult tähendab? | <https://www.teeviit.ee/enesevigastamine-mida-see-tegelikult-tahendab/> |
| Haridus- ja Noorteamet (Teeviit) | Kanepist | <https://www.teeviit.ee/kanepist/> |
| Haridus- ja Noorteamet (Teeviit) | Kool algab, mis seis on su rahaasjadega? | <https://www.teeviit.ee/kool-algab-mis-seis-on-su-rahaasjadega/> |
| Haridus- ja Noorteamet (Teeviit) | Kooli lõpetamine eelarvesõbralikult: kogumispäeviklaste seas on moes taaskasutus | <https://www.teeviit.ee/kooli-lopetamine-eelarvesobralikult/> |
| Haridus- ja Noorteamet (Teeviit) | Korgijoogi hädaabijuhend | <https://www.teeviit.ee/korgijoogi-hadaabijuhend/> |
| Haridus- ja Noorteamet (Teeviit) | Kuhu pöörduda vaimse tervise probleemide korral? | <https://www.teeviit.ee/kuhu-poorduda-vaimse-tervise-probleemide-korral/> |
| Haridus- ja Noorteamet (Teeviit) | Kui on tarvis võtta õppelaenu | <https://www.teeviit.ee/kui-on-tarvis-votta-oppelaenu/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas aidata abivajavat sõpra | <https://www.teeviit.ee/kuidas-aidata-abivajavat-sopra/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas enesekindlalt öelda ei alkoholi joomisele? | <https://www.teeviit.ee/kuidas-enesekindlalt-oelda-ei-alkoholi-joomisele/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas ja millal helistada hädaabinumbrile 112? | <https://www.teeviit.ee/kui-on-oht-elule-helista-hadaabi-numbrile-112/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas kliimaärevusega toime tulla? | <https://www.teeviit.ee/kriis-kriisis-ehk-kliimaarevus/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas küberkiusamist ära tunda? | <https://www.teeviit.ee/kuidas-kuberkiusamist-ara-tunda/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas luua terveid ja turvalisi suhteid oma partneriga? | <https://www.teeviit.ee/kuidas-luua-terveid-ja-turvalisi-suhteid-oma-partneriga/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas olla rahatark? | <https://www.teeviit.ee/kuidas-olla-rahatark/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas oma lähedase või sõbra depressiooni ära tunda? | <https://www.teeviit.ee/kuidas-oma-lahedase-voi-sobra-depressiooni-ara-tunda/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas rääkida lähedastega oma vaimse tervise murest? | <https://www.teeviit.ee/kuidas-raakida-lahedastega-oma-vaimse-tervise-murest/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas tudengina rahaasjadega paremini toime tulla? | <https://www.teeviit.ee/kuidas-tudengina-rahaasjadega-paremini-toime-tulla/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas tulla toime eksamistressiga? | <https://www.teeviit.ee/kuidas-tulla-toime-eksamistressiga/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas tulla toime stressiga? | <https://www.teeviit.ee/kuidas-tulla-toime-stressiga/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas tunda ära kiusamist? | <https://www.teeviit.ee/kuidas-tunda-ara-kiusamist/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas tunda ära seksuaalvägivalda? | <https://www.teeviit.ee/kuidas-tunda-ara-seksuaalvagivalda/> |
| Haridus- ja Noorteamet (Teeviit) | Kuidas valmistuda rahaliselt ootamatusteks ja mil viisil tekitada säästupuhvrit? | <https://www.teeviit.ee/kuidas-valmistuda-rahaliselt-ootamatuteks-ja-mil-viisil-tekitada-saastupuhvrit/> |
| Haridus- ja Noorteamet (Teeviit) | Laste ja noorte õigused ning kohustused | <https://www.teeviit.ee/laste-ja-noorte-oigused-ning-kohustused/> |
| Haridus- ja Noorteamet (Teeviit) | Leinast Lootuseni | <https://www.teeviit.ee/leinast-lootuseni/> |
| Haridus- ja Noorteamet (Teeviit) | Lähisuhtevägivald: mis see on ja kuhu pöörduda? | <https://www.teeviit.ee/lahisuhtevagivald-mis-see-on-ja-kuhu-poorduda/> |
| Haridus- ja Noorteamet (Teeviit) | Mida peaks töölepingu sõlmimisel kindlasti meeles pidama? | <https://www.teeviit.ee/mida-peaks-toolepingu-solmimisel-kindlasti-meeles-pidama/> |
| Haridus- ja Noorteamet (Teeviit) | Mida peaksin teadma laenudest? | <https://www.teeviit.ee/mida-peaksin-teadma-laenudest/> |
| Haridus- ja Noorteamet (Teeviit) | Mida silmas pidada esimese kodu üürimisel? | <https://www.teeviit.ee/mida-silmas-pidada-esimese-kodu-uurimisel/> |
| Haridus- ja Noorteamet (Teeviit) | Mida teha, kui oled sattunud küberkiusamise ohvriks? | <https://www.teeviit.ee/mida-teha-kui-oled-sattunud-kuberkiusamise-ohvriks/> |
| Haridus- ja Noorteamet (Teeviit) | Mida teha, kui su kaaslane või lähedane käitub vägivaldselt? | <https://www.teeviit.ee/mida-teha-kui-su-lahedane-kaitub-vagivaldselt/> |
| Haridus- ja Noorteamet (Teeviit) | Miks ma peaksin igakuise eelarve koostama? | <https://www.teeviit.ee/miks-ma-peaksin-igakuise-eelarve-koostama/> |
| Haridus- ja Noorteamet (Teeviit) | Miks on narkootikumid ohtlikud? | <https://www.teeviit.ee/miks-on-narkootikumid-ohtlikud/> |
| Haridus- ja Noorteamet (Teeviit) | Millega peab arvestama alaealisena töötades? | <https://www.teeviit.ee/millega-peab-arvestama-alaealisena-tootades/> |
| Haridus- ja Noorteamet (Teeviit) | Millist infot pean jagama pangaga, kui võtan laenu? | <https://www.teeviit.ee/millist-infot-pean-jagama-pangaga-kui-votan-laenu/> |
| Haridus- ja Noorteamet (Teeviit) | Mis on inimõigused? | <https://www.teeviit.ee/mis-on-inimoigused/> |
| Haridus- ja Noorteamet (Teeviit) | Mis on rahatarkus? | <https://www.teeviit.ee/mis-on-rahatarkus/> |
| Haridus- ja Noorteamet (Teeviit) | Mis on seksuaalvägivald ja kust saada abi? | <https://www.teeviit.ee/mis-on-seksuaalvagivald-ja-kust-saada-abi/> |
| Haridus- ja Noorteamet (Teeviit) | Mis on vaimne tervis ja vaimne häire? | <https://www.teeviit.ee/mis-on-vaimne-tervis/> |
| Haridus- ja Noorteamet (Teeviit) | Mis on õppimiskohustus ja mida see tähendab pärast 9. klassi? | <https://www.teeviit.ee/mis-on-oppimiskohustus-ja-mida-see-tahendab-parast-9-klassi/> |
| Haridus- ja Noorteamet (Teeviit) | Murrame müüte: vaimne tervis | <https://www.teeviit.ee/murrame-muute-vaimne-tervis/> |
| Haridus- ja Noorteamet (Teeviit) | Nikotiini mõju vaimsele tervisele | <https://www.teeviit.ee/nikotiini-moju-vaimsele-tervisele/> |
| Haridus- ja Noorteamet (Teeviit) | Organiseeritus kui vaimse tervise abivahend – kuidas kasutada Notionit? | <https://www.teeviit.ee/organiseeritus-kui-vaimse-tervise-abivahend/> |
| Haridus- ja Noorteamet (Teeviit) | Praktilised tööriistad sinu vaimse tervise jaoks | <https://www.teeviit.ee/praktilised-tooriistad-sinu-vaimse-tervise-jaoks/> |
| Haridus- ja Noorteamet (Teeviit) | Räägime e-sigaretist | <https://www.teeviit.ee/raagime-e-sigaretist/> |
| Haridus- ja Noorteamet (Teeviit) | Söömishäire – mis, miks ja kuidas? | <https://www.teeviit.ee/soomishaire-mis-miks-ja-kuidas/> |
| Haridus- ja Noorteamet (Teeviit) | Teeviit soovitab nippe: stressivaba õppimine | <https://www.teeviit.ee/teeviit-soovitab-nippe-stressivaba-oppimine/> |
| Haridus- ja Noorteamet (Teeviit) | Turvaliselt suhtlusportaalides | <https://www.teeviit.ee/turvaliselt-suhtlusportaalides/> |
| Haridus- ja Noorteamet (Teeviit) | Vanemlus: töötamine suvepuhkuste perioodil | <https://www.teeviit.ee/vanemlus-tootamine-suvepuhkuste-perioodil/> |
| Haridus- ja Noorteamet (Teeviit) | Ära lase söömishäirel võtta oma elu üle kontrolli | <https://www.teeviit.ee/ara-lase-soomishairel-votta-oma-elu-ule-kontrolli/> |
| Haridus- ja Noorteamet (Teeviit) | Ärevus ja ärevushäired – müüdid ja reaalsus | <https://www.teeviit.ee/arevushairete-muudid-ja-reaalsus/> |
| Haridus- ja Noorteamet (Teeviit) | Ärevuse tunne võib hakata segama igapäevaelu | <https://www.teeviit.ee/arevuse-tunne-voib-hakata-segama-igapaevaelu/> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abielu lahutamine kohtus | <https://www.juristaitab.ee/et/abielu-lahutamine-kohtus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abielu lahutamine notaris | <https://www.juristaitab.ee/et/abielu-lahutamine-notaris> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abielu lahutamine perekonnaseisuasutuses | <https://www.juristaitab.ee/et/abielu-lahutamine-perekonnaseisuasutuses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abielu sõlmimise eeldused | <https://www.juristaitab.ee/et/abielu-solmimise-eeldused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abielu sõlmimise ja lahutamise avaldused | <https://www.juristaitab.ee/et/abielu-solmimise-ja-lahutamise-avaldused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abieluvararegistriga tutvumine ja ärakirjade tellimine | <https://www.juristaitab.ee/et/abieluvararegistriga-tutvumine-ja-arakirjade-tellimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abikaasade varalised õigused | <https://www.juristaitab.ee/et/abikaasade-varalised-oigused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Abikaasade vastastikune testament | <https://www.juristaitab.ee/et/abikaasade-vastastikune-testament-3> |
| Justiits- ja Digiministeerium (Jurist aitab) | Aegumine | <https://www.juristaitab.ee/et/aegumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ametliku dokumendi tunnustamine ja täitmine Euroopa Parlamendi ja nõukogu määruse (EÜ) nr 805/2004 alusel | <https://www.juristaitab.ee/et/ametliku-dokumendi-tunnustamine-ja-taitmine-euroopa-parlamendi-ja-noukogu-maaruse-eu-nr-8052004> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ametliku juriidilise dokumendi tunnustamine ja täitmine Euroopa Nõukogu määruse nr 44/2001 | <https://www.juristaitab.ee/et/ametliku-juriidilise-dokumendi-tunnustamine-ja-taitmine-euroopa-noukogu-maaruse-nr-442001> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ametliku juriidilise dokumendi tunnustamine ja täitmine Euroopa Parlamendi ja Nõukogu määruse nr 1215/2012, | <https://www.juristaitab.ee/et/ametliku-juriidilise-dokumendi-tunnustamine-ja-taitmine-euroopa-parlamendi-ja-noukogu-maaruse-nr-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ametliku juriidilise dokumendi tunnustamine ja täitmine nn. Lugano 2007 konventsioon | <https://www.juristaitab.ee/et/ametliku-juriidilise-dokumendi-tunnustamine-ja-taitmine-nn-lugano-2007-konventsioon> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ametliku juriidilise dokumendi tunnustamine ja täitmine välismaal | <https://www.juristaitab.ee/et/ametliku-juriidilise-dokumendi-tunnustamine-ja-taitmine-valismaal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Asjaajamine Vene Föderatsiooni pädevate asutustega pärast Eesti–Vene õigusabilepingu lõppemist | <https://www.juristaitab.ee/et/asjaajamine-vene-foderatsiooni-padevate-asutustega-parast-eesti-vene-oigusabilepingu-loppemist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Dokumentide legaliseerimiskohustusest | <https://www.juristaitab.ee/et/dokumentide-legaliseerimiskohustusest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Dokumentide vormid piiriüleseks asjaajamiseks | <https://www.juristaitab.ee/et/dokumentide-vormid-piiriuleseks-asjaajamiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Eestkoste alaealise üle | <https://www.juristaitab.ee/et/eestkoste-alaealise-ule> |
| Justiits- ja Digiministeerium (Jurist aitab) | Eestkostja määramine. Kas eestkostja saab määrata ilma eestkostetava nõusolekuta? | <https://www.juristaitab.ee/et/eestkostja-maaramine-kas-eestkostja-saab-maarata-ilma-eestkostetava-nousolekuta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ehitus | <https://www.juristaitab.ee/et/ehitus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ehitusnormid ja -nõuded | <https://www.juristaitab.ee/et/ehitusnormid-ja-nouded> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ei ole saanud maksuteadet? | <https://www.juristaitab.ee/et/ei-ole-saanud-maksuteadet> |
| Justiits- ja Digiministeerium (Jurist aitab) | Elame elukaaslasega vabalt koos juba aastaid. Mis siis juriidilises mõttes muutuks, kui me abielu registreeriksime? Kas midagi muutub ka meie laste suhtes? | <https://www.juristaitab.ee/et/elame-elukaaslasega-vabalt-koos-juba-aastaid-mis-siis-juriidilises-mottes-muutuks-kui-me-abielu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Elatis - hagi või avaldus? Kuhu esitada? | <https://www.juristaitab.ee/et/elatis-hagi-voi-avaldus-kuhu-esitada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Elatisabi taotlemine kohtumenetluse ajal | <https://www.juristaitab.ee/et/elatisabi-taotlemine-kohtumenetluse-ajal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Elatisabi taotlemine täitemenetluse ajal | <https://www.juristaitab.ee/et/elatisabi-taotlemine-taitemenetluse-ajal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Elatisotsuse tunnustamine | <https://www.juristaitab.ee/et/elatisotsuse-tunnustamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Elatisotsuse tunnustamine ja täitemenetlusaegse elatisabi taotlemine kui võlgnik on välisriigis | <https://www.juristaitab.ee/et/elatisotsuse-tunnustamine-ja-taitemenetlusaegse-elatisabi-taotlemine-kui-volgnik-valisriigis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Erilised nõuded kinnisvara müügil | <https://www.juristaitab.ee/et/erilised-nouded-kinnisvara-muugil> |
| Justiits- ja Digiministeerium (Jurist aitab) | Euroopa maksekäsk | <https://www.juristaitab.ee/et/euroopa-maksekask> |
| Justiits- ja Digiministeerium (Jurist aitab) | Füüsilise isiku maksejõuetus | <https://www.juristaitab.ee/et/fuusilise-isiku-maksejouetus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Füüsilise isiku maksejõuetuse seadus | <https://www.juristaitab.ee/et/fuusilise-isiku-maksejouetuse-seadus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Hagile vastamine | <https://www.juristaitab.ee/et/hagile-vastamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Halduskohtusse pöördumine | <https://www.juristaitab.ee/et/halduskohtusse-poordumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kaasomanike kokkuleppe õiguslikud võimalused | <https://www.juristaitab.ee/et/kaasomanike-kokkuleppe-oiguslikud-voimalused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kahju hüvitamise alused | <https://www.juristaitab.ee/et/kahju-huvitamise-alused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kahju hüvitamise erijuhud | <https://www.juristaitab.ee/et/kahju-huvitamise-erijuhud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kahju hüvitamise nõude esitamine | <https://www.juristaitab.ee/et/kahju-huvitamise-noude-esitamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kahju hüvitamise ulatus | <https://www.juristaitab.ee/et/kahju-huvitamise-ulatus-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kahju liigid | <https://www.juristaitab.ee/et/kahju-liigid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas abikaasa võib nõuda ülalpidamise andmist ka tagasiulatuvalt? | <https://www.juristaitab.ee/et/kas-abikaasa-voib-nouda-ulalpidamise-andmist-ka-tagasiulatuvalt> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas abikaasad võivad esitada tuludeklaratsiooni ühiselt? | <https://www.juristaitab.ee/et/kas-abikaasad-voivad-esitada-tuludeklaratsiooni-uhiselt> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas abikaasad võivad sõlmida notariaalse kokkuleppe ülalpidamiseks peale lahutust? | <https://www.juristaitab.ee/et/kas-abikaasad-voivad-solmida-notariaalse-kokkuleppe-ulalpidamiseks-peale-lahutust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas apostillida dokumendi originaal või ärakiri? | <https://www.juristaitab.ee/et/kas-apostillida-dokumendi-originaal-voi-arakiri> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas Eesti kohtutäitur saab minu nõuet täita välisriigis elava/töötava isiku suhtes? | <https://www.juristaitab.ee/et/kas-eesti-kohtutaitur-saab-minu-nouet-taita-valisriigis-elavatootava-isiku-suhtes> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas eestkostja on kohustatud eestkostetavat ülal pidama? | <https://www.juristaitab.ee/et/kas-eestkostja-kohustatud-eestkostetavat-ulal-pidama> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas elatisabi on võimalik saada ka juhul, kui lapsele ei ole elatist kohtu kaudu välja mõistetud? | <https://www.juristaitab.ee/et/kas-elatisabi-voimalik-saada-ka-juhul-kui-lapsele-ei-ole-elatist-kohtu-kaudu-valja-moistetud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas elatisabi saab taotleda, kui võlgnik elab välismaal ning Eestis ei ole võimalik täitemenetlust alustada? | <https://www.juristaitab.ee/et/kas-elatisabi-saab-taotleda-kui-volgnik-elab-valismaal-ning-eestis-ei-ole-voimalik-taitemenetlust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas elatist saab nõuda vanavanemalt (asenduskohustus)? | <https://www.juristaitab.ee/et/kas-elatist-saab-nouda-vanavanemalt-asenduskohustus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas hüpoteegiga koormatud kinnisasja saab müüa, kinkida? | <https://www.juristaitab.ee/et/kas-hupoteegiga-koormatud-kinnisasja-saab-muua-kinkida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas ja millal tulumaksu saab tagasi või tuleb juurde maksta? | <https://www.juristaitab.ee/et/kas-ja-millal-tulumaksu-saab-tagasi-voi-tuleb-juurde-maksta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas kandeavalduse eest pean maksma? | <https://www.juristaitab.ee/et/kas-kandeavalduse-eest-pean-maksma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas katseaeg pikeneb haiguse aja võrra? | <https://www.juristaitab.ee/et/kas-katseaeg-pikeneb-haiguse-aja-vorra> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas kohalikul omavalitsusel on õigus/ kohustus kanda minu taotluse alusel juurdepääsutee valla teederegistrisse? | <https://www.juristaitab.ee/et/kas-kohalikul-omavalitsusel-oigus-kohustus-kanda-minu-taotluse-alusel-juurdepaasutee-valla> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas kohtul on õigus keelduda mind kohustustest vabastamast? | <https://www.juristaitab.ee/et/kas-kohtul-oigus-keelduda-mind-kohustustest-vabastamast> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas kohtutäitur peab vastama minu kirjadele ja e-kirjadele? | <https://www.juristaitab.ee/et/kas-kohtutaitur-peab-vastama-minu-kirjadele-ja-e-kirjadele> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas lapse ema võib nõuda lapse isalt ülalpidamist ka endale? Kui isa kasvatab last, kas tema saab nõuda emalt? | <https://www.juristaitab.ee/et/kas-lapse-ema-voib-nouda-lapse-isalt-ulalpidamist-ka-endale-kui-isa-kasvatab-last-kas-tema-saab> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas lapse võib perekonnast eraldada? Kas võib vanemalt hooldusõiguse täielikult ära võtta? | <https://www.juristaitab.ee/et/kas-lapse-voib-perekonnast-eraldada-kas-voib-vanemalt-hooldusoiguse-taielikult-ara-votta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas legaliseerida dokumendi originaal või ärakiri? | <https://www.juristaitab.ee/et/kas-legaliseerida-dokumendi-originaal-voi-arakiri> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas legaliseeritud dokumendile tuleb lisada tõlge? | <https://www.juristaitab.ee/et/kas-legaliseeritud-dokumendile-tuleb-lisada-tolge> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas lisada apostillitud dokumendile ka tõlge? | <https://www.juristaitab.ee/et/kas-lisada-apostillitud-dokumendile-ka-tolge> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas ma saan Eesti Töötukassalt hüvitist ka siis, kui pankrotimenetlus lõpetatakse raugemise tõttu pankrotti välja kuulutamata? | <https://www.juristaitab.ee/et/kas-ma-saan-eesti-tootukassalt-huvitist-ka-siis-kui-pankrotimenetlus-lopetatakse-raugemise-tottu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas mul on võimalik lahutamise korral abikaasaga omavahel abieluvara jagamise osas kokku leppida? | <https://www.juristaitab.ee/et/kas-mul-voimalik-lahutamise-korral-abikaasaga-omavahel-abieluvara-jagamise-osas-kokku-leppida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas oma isiklike asjade (nt auto) müümisest saadud tulu pealt tuleb maksta tulumaksu? | <https://www.juristaitab.ee/et/kas-oma-isiklike-asjade-nt-auto-muumisest-saadud-tulu-pealt-tuleb-maksta-tulumaksu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas oma maa ja korteri müügi pealt tuleb maksta tulumaksu? | <https://www.juristaitab.ee/et/kas-oma-maa-ja-korteri-muugi-pealt-tuleb-maksta-tulumaksu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas on võimalus valida erinevate hüpoteekide vahel? Mis on ühishüpoteek? | <https://www.juristaitab.ee/et/kas-voimalus-valida-erinevate-hupoteekide-vahel-mis-uhishupoteek> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas pärandist on võimalik loobuda osaliselt või tingimuslikult? | <https://www.juristaitab.ee/et/kas-parandist-voimalik-loobuda-osaliselt-voi-tingimuslikult> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas riigi õigusabi taotlusele tuleb lisada veel mingeid dokumente? | <https://www.juristaitab.ee/et/kas-riigi-oigusabi-taotlusele-tuleb-lisada-veel-mingeid-dokumente> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas riigipoolne elatisabi maksmine tähendab, et elatisvõlgnik enam lapsele elatist maksma ei pea? | <https://www.juristaitab.ee/et/kas-riigipoolne-elatisabi-maksmine-tahendab-et-elatisvolgnik-enam-lapsele-elatist-maksma-ei-pea> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas sissenõudjal on õigus kohtutäiturit vahetada? | <https://www.juristaitab.ee/et/kas-sissenoudjal-oigus-kohtutaiturit-vahetada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas suuline kokkulepe on leping? | <https://www.juristaitab.ee/et/kas-suuline-kokkulepe-leping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas tarbijavaidluste komisjoni poolt tehtud otsuse peale saab edasi kaevata? | <https://www.juristaitab.ee/et/kas-tarbijavaidluste-komisjoni-poolt-tehtud-otsuse-peale-saab-edasi-kaevata> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas tulumaksuga maksustatakse autokompensatsioon? | <https://www.juristaitab.ee/et/kas-tulumaksuga-maksustatakse-autokompensatsioon> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas tulumaksuga maksustatakse välislähetuse päevaraha? | <https://www.juristaitab.ee/et/kas-tulumaksuga-maksustatakse-valislahetuse-paevaraha> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas täitemenetlusaegset elatisabi saab taotleda vaid ühe vanema kohta? | <https://www.juristaitab.ee/et/kas-taitemenetlusaegset-elatisabi-saab-taotleda-vaid-uhe-vanema-kohta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas töövaidluskomisjon/kohus saab töötajat töökohale ennistada või määratakse hüvitis? | <https://www.juristaitab.ee/et/kas-toovaidluskomisjonkohus-saab-tootajat-tookohale-ennistada-voi-maaratakse-huvitis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas vanem võib otsustada last puudutavaid küsimusi või esindada last üksinda? | <https://www.juristaitab.ee/et/kas-vanem-voib-otsustada-last-puudutavaid-kusimusi-voi-esindada-last-uksinda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas vanemad võivad ise elatise osas kokku leppida? | <https://www.juristaitab.ee/et/kas-vanemad-voivad-ise-elatise-osas-kokku-leppida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas vara müügist saadud kasult tuleb maksta tulumaksu? | <https://www.juristaitab.ee/et/kas-vara-muugist-saadud-kasult-tuleb-maksta-tulumaksu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas võib maha arvata eluasemelaenu intresse? | <https://www.juristaitab.ee/et/kas-voib-maha-arvata-eluasemelaenu-intresse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas võib maha arvata koolituskulud? | <https://www.juristaitab.ee/et/kas-voib-maha-arvata-koolituskulud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas võib nõuda abikaasalt endale ülalpidamist, kui abikaasad elavad lahus, aga abielu on lahutamata? | <https://www.juristaitab.ee/et/kas-voib-nouda-abikaasalt-endale-ulalpidamist-kui-abikaasad-elavad-lahus-aga-abielu-lahutamata> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas ühingu asutamise eest on ette nähtud riigilõiv? | <https://www.juristaitab.ee/et/kas-uhingu-asutamise-eest-ette-nahtud-riigiloiv> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kas üüritulult tuleb maksta tulumaksu? | <https://www.juristaitab.ee/et/kas-uuritulult-tuleb-maksta-tulumaksu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kasutuslepingu liigid | <https://www.juristaitab.ee/et/kasutuslepingu-liigid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kasutuslepingu lõpetamine ja vara tagastamine | <https://www.juristaitab.ee/et/kasutuslepingu-lopetamine-ja-vara-tagastamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kasutuslepingu olulised tingimused | <https://www.juristaitab.ee/et/kasutuslepingu-olulised-tingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kasutuslepingu pooled ja nende kohustused | <https://www.juristaitab.ee/et/kasutuslepingu-pooled-ja-nende-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kasutuslepingute eritingimused | <https://www.juristaitab.ee/et/kasutuslepingute-eritingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Katseaeg | <https://www.juristaitab.ee/et/katseaeg> |
| Justiits- ja Digiministeerium (Jurist aitab) | Katseaeg, töölepingu lõpetamine katseajal | <https://www.juristaitab.ee/et/katseaeg-toolepingu-lopetamine-katseajal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kellele ja millal elatist tuleb maksta? | <https://www.juristaitab.ee/et/kellele-ja-millal-elatist-tuleb-maksta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kellele kuulub lapse hooldusõigus? | <https://www.juristaitab.ee/et/kellele-kuulub-lapse-hooldusoigus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kellele kuulub leitud vara? | <https://www.juristaitab.ee/et/kellele-kuulub-leitud-vara> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes esitab avalduse uue omaniku kinnistusraamatusse kandmiseks ja kes teeb kinnistusraamatusse vastava muudatuse? | <https://www.juristaitab.ee/et/kes-esitab-avalduse-uue-omaniku-kinnistusraamatusse-kandmiseks-ja-kes-teeb-kinnistusraamatusse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes kannab menetluskulud maksekäsu kiirmenetluses? | <https://www.juristaitab.ee/et/kes-kannab-menetluskulud-maksekasu-kiirmenetluses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes kehtestab maksumäära? | <https://www.juristaitab.ee/et/kes-kehtestab-maksumaara> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes maksab maamaksu? | <https://www.juristaitab.ee/et/kes-maksab-maamaksu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes menetleb kuritegusid? | <https://www.juristaitab.ee/et/kes-menetleb-kuritegusid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes määrab riigi õigusabi osutava advokaadi? | <https://www.juristaitab.ee/et/kes-maarab-riigi-oigusabi-osutava-advokaadi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on elatise taotleja? | <https://www.juristaitab.ee/et/kes-elatise-taotleja> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on maksekäsu kiirmenetluse poolteks elatise nõudes? | <https://www.juristaitab.ee/et/kes-maksekasu-kiirmenetluse-poolteks-elatise-noudes> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on maksekäsu kiirmenetluses poolteks? | <https://www.juristaitab.ee/et/kes-maksekasu-kiirmenetluses-poolteks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on pankrotihaldur? | <https://www.juristaitab.ee/et/kes-pankrotihaldur> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on pädev allkirja õigsuse kinnitamiseks? | <https://www.juristaitab.ee/et/kes-padev-allkirja-oigsuse-kinnitamiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on pädev dokumendi tõlke õigsuse kinnitamiseks? | <https://www.juristaitab.ee/et/kes-padev-dokumendi-tolke-oigsuse-kinnitamiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on pädev dokumendi ärakirja õigsuse kinnitamiseks? | <https://www.juristaitab.ee/et/kes-padev-dokumendi-arakirja-oigsuse-kinnitamiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on residendist füüsiline isik? | <https://www.juristaitab.ee/et/kes-residendist-fuusiline-isik> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes on usaldusisik? | <https://www.juristaitab.ee/et/kes-usaldusisik> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes otsustab kohustustest vabastamise menetluse algatamise ning millisel juhul ei ole võimalik seda teha? | <https://www.juristaitab.ee/et/kes-otsustab-kohustustest-vabastamise-menetluse-algatamise-ning-millisel-juhul-ei-ole-voimalik-seda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes otsustab lapse elukoha üle? | <https://www.juristaitab.ee/et/kes-otsustab-lapse-elukoha-ule> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes peab maksma kohtutäituri tasu ja muud kulud? | <https://www.juristaitab.ee/et/kes-peab-maksma-kohtutaituri-tasu-ja-muud-kulud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes peab tagama lapse ülalpidamise? | <https://www.juristaitab.ee/et/kes-peab-tagama-lapse-ulalpidamise> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes peavad äriregistrit, mittetulundusühingute ja sihtasutuste registrit, kommertspandiregistrit ning laevakinnistusraamatut? | <https://www.juristaitab.ee/et/kes-peavad-ariregistrit-mittetulundusuhingute-ja-sihtasutuste-registrit-kommertspandiregistrit-ning> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes saab taotleda riigi õigusabi? | <https://www.juristaitab.ee/et/kes-saab-taotleda-riigi-oigusabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes saavad algatada pärimismenetlust? | <https://www.juristaitab.ee/et/kes-saavad-algatada-parimismenetlust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes saavad asutada ühinguid ja füüsilisest isikust ettevõtjat ettevõtjaportaali kaudu? | <https://www.juristaitab.ee/et/kes-saavad-asutada-uhinguid-ja-fuusilisest-isikust-ettevotjat-ettevotjaportaali-kaudu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes teeb kande abieluvararegistrisse? | <https://www.juristaitab.ee/et/kes-teeb-kande-abieluvararegistrisse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kes teostab järelevalvet eestkostja tegevuse üle? | <https://www.juristaitab.ee/et/kes-teostab-jarelevalvet-eestkostja-tegevuse-ule> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kindlustuslepingu liigid | <https://www.juristaitab.ee/et/kindlustuslepingu-liigid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kindlustuslepingu lõpetamine | <https://www.juristaitab.ee/et/kindlustuslepingu-lopetamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kindlustuslepingu olulised tingimused | <https://www.juristaitab.ee/et/kindlustuslepingu-olulised-tingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kindlustuslepingu sõlmimine | <https://www.juristaitab.ee/et/kindlustuslepingu-solmimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kindlustuslepingu vaidluste lahendamine | <https://www.juristaitab.ee/et/kindlustuslepingu-vaidluste-lahendamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kinke maksustamine | <https://www.juristaitab.ee/et/kinke-maksustamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kinkelepingu erijuhud | <https://www.juristaitab.ee/et/kinkelepingu-erijuhud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kinkelepingu olulised tingimused | <https://www.juristaitab.ee/et/kinkelepingu-olulised-tingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kinkelepingu vorminõuded ja sisu | <https://www.juristaitab.ee/et/kinkelepingu-vorminouded-ja-sisu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kinkelepingust taganemine | <https://www.juristaitab.ee/et/kinkelepingust-taganemine-5> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kinnisvara laenu tagatiseks | <https://www.juristaitab.ee/et/kinnisvara-laenu-tagatiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kodune testament | <https://www.juristaitab.ee/et/kodune-testament> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine „Laste ja teiste pereliikmete elatise rahvusvahelise sissenõudmise“ konventsiooni | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-laste-ja-teiste-pereliikmete-elatise-rahvusvahelise-sissenoudmise> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine Euroopa Parlamendi ja Nõukogu määruse nr 805/2004 | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-euroopa-parlamendi-ja-noukogu-maaruse-nr-8052004> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja elatisabi saamine „Laste ja teiste pereliikmete elatise rahvusvahelise sissenõudmise“ konventsiooni | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-elatisabi-saamine-laste-ja-teiste-pereliikmete-elatise-rahvusvahelise> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja elatisabi taotlemine „Ülalpidamiskohustusi käsitlevate otsuste tunnustamise ja täitmise“ konventsiooni | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-elatisabi-taotlemine-ulalpidamiskohustusi-kasitlevate-otsuste> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine "Välisriigist ülalpidamise taotlemise" konventsioon | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-valisriigist-ulalpidamise-taotlemise-konventsioon> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine "Välisriigist ülalpidamise taotlemise" konventsioon ja elatisabi | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-valisriigist-ulalpidamise-taotlemise-konventsioon-ja-elatisabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine „Ülalpidamiskohustusi käsitlevate otsuste tunnustamise ja täitmise” konventsiooni ehk Haagi ülalpidamiskohustuste konventsiooni alusel | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-ulalpidamiskohustusi-kasitlevate-otsuste-tunnustamise-ja> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine Euroopa Nõukogu määruse nr 2201/2003 | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-euroopa-noukogu-maaruse-nr-22012003> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine Euroopa Nõukogu määruse nr 44/2001 | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-euroopa-noukogu-maaruse-nr-442001> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine Euroopa Parlamendi ja Nõukogu määruse nr 1215/2012, | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-euroopa-parlamendi-ja-noukogu-maaruse-nr-12152012> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine ja elatisabi taotlemine Nõukogu määruse nr 4/2009 | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-ja-elatisabi-taotlemine-noukogu-maaruse-nr-42009> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine Nõukogu määruse nr 4/2009 | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-noukogu-maaruse-nr-42009> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtuotsuse tunnustamine ja täitmine välismaal (mh elatis) | <https://www.juristaitab.ee/et/kohtuotsuse-tunnustamine-ja-taitmine-valismaal-mh-elatis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kohtutäitur on arestinud minu sissetulekud, mis ei kuulu seaduse kohaselt arestimisele. Mida teha? | <https://www.juristaitab.ee/et/kohtutaitur-arestinud-minu-sissetulekud-mis-ei-kuulu-seaduse-kohaselt-arestimisele-mida-teha> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kokkulepped kohtumenetluses | <https://www.juristaitab.ee/et/kokkulepped-kohtumenetluses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Korteriomanike õigused ja kohustused | <https://www.juristaitab.ee/et/korteriomanike-oigused-ja-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Korteriühistu juhtimine | <https://www.juristaitab.ee/et/korteriuhistu-juhtimine-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Korteriühistu moodustamine | <https://www.juristaitab.ee/et/korteriuhistu-moodustamine-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Korteriühistu probleemide lahendamine | <https://www.juristaitab.ee/et/korteriuhistu-probleemide-lahendamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Korteriühistu ülesanded ja vastutus | <https://www.juristaitab.ee/et/korteriuhistu-ulesanded-ja-vastutus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuhu esitada maksekäsu kiirmenetluse avaldus? | <https://www.juristaitab.ee/et/kuhu-esitada-maksekasu-kiirmenetluse-avaldus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuhu esitada pankrotiavaldus? | <https://www.juristaitab.ee/et/kuhu-esitada-pankrotiavaldus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuhu ja kellele esitada riigi õigusabi taotlus? | <https://www.juristaitab.ee/et/kuhu-ja-kellele-esitada-riigi-oigusabi-taotlus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuhu ja kui palju tuleb tasuda riigilõivu maksekäsu kiirmenetluse avalduse esitamise eest? | <https://www.juristaitab.ee/et/kuhu-ja-kui-palju-tuleb-tasuda-riigiloivu-maksekasu-kiirmenetluse-avalduse-esitamise-eest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuhu peame vaidluse korral pärandvara jagamiseks pöörduma? | <https://www.juristaitab.ee/et/kuhu-peame-vaidluse-korral-parandvara-jagamiseks-poorduma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui hooldusõigus on ainult ühel vanemal, kas teine saab seda endale nõuda? | <https://www.juristaitab.ee/et/kui-hooldusoigus-ainult-uhel-vanemal-kas-teine-saab-seda-endale-nouda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui kaua kohustustest vabastamise menetlus kestab ja mida tuleb pärast seda teha? | <https://www.juristaitab.ee/et/kui-kaua-kohustustest-vabastamise-menetlus-kestab-ja-mida-tuleb-parast-seda-teha> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui kaua peab ülalpidamist lahutatud abikaasale andma? Kas võib nõuda ka tagasiulatuvalt? | <https://www.juristaitab.ee/et/kui-kaua-peab-ulalpidamist-lahutatud-abikaasale-andma-kas-voib-nouda-ka-tagasiulatuvalt> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui kiiresti on võimalik abielu lahutada? | <https://www.juristaitab.ee/et/kui-kiiresti-voimalik-abielu-lahutada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui kiiresti saab abielluda? | <https://www.juristaitab.ee/et/kui-kiiresti-saab-abielluda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui kiiresti tehakse abieluvararegistrisse kanne? | <https://www.juristaitab.ee/et/kui-kiiresti-tehakse-abieluvararegistrisse-kanne> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui lahutatud abikaasa on tervislikel põhjustel kodune ja ei oma sissetulekut, kas ta saab lahutatud abikaasalt ülalpidamist nõuda? | <https://www.juristaitab.ee/et/kui-lahutatud-abikaasa-tervislikel-pohjustel-kodune-ja-ei-oma-sissetulekut-kas-ta-saab-lahutatud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui ma ei saa suhelda registriga elektrooniliselt, siis kuhu täpselt pean minema? | <https://www.juristaitab.ee/et/kui-ma-ei-saa-suhelda-registriga-elektrooniliselt-siis-kuhu-tapselt-pean-minema> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui olen hakanud esitama ettevõtjaportaalist kandeavaldust ja enne registriosakonnale esitamist on tekkinud küsimused, siis kelle poole saan nende küsimustega pöörduda? | <https://www.juristaitab.ee/et/kui-olen-hakanud-esitama-ettevotjaportaalist-kandeavaldust-ja-enne-registriosakonnale-esitamist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui palju maksab abielu sõlmimine perekonnaseisuametis ja notari juures? | <https://www.juristaitab.ee/et/kui-palju-maksab-abielu-solmimine-perekonnaseisuametis-ja-notari-juures> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui palju maksab abieluvararegistri andmetega tutvumine? | <https://www.juristaitab.ee/et/kui-palju-maksab-abieluvararegistri-andmetega-tutvumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui palju peab lahutatud abikaasale ülalpidamist maksma? | <https://www.juristaitab.ee/et/kui-palju-peab-lahutatud-abikaasale-ulalpidamist-maksma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui palju tuleb tasuda pankrotiavalduse esitamisel riigilõivu? | <https://www.juristaitab.ee/et/kui-palju-tuleb-tasuda-pankrotiavalduse-esitamisel-riigiloivu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui pärijaks on alaealine | <https://www.juristaitab.ee/et/kui-parijaks-alaealine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui registriosakond on teinud mulle puuduste kõrvaldamise määruse, siis mida pean edasi tegema? Kas saan esitada määruskaebuse? | <https://www.juristaitab.ee/et/kui-registriosakond-teinud-mulle-puuduste-korvaldamise-maaruse-siis-mida-pean-edasi-tegema-kas-saan> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui soovin füüsilise isikuna tegeleda ettevõtlusega, kas pean olema sel juhul kantud äriregistrisse? | <https://www.juristaitab.ee/et/kui-soovin-fuusilise-isikuna-tegeleda-ettevotlusega-kas-pean-olema-sel-juhul-kantud-ariregistrisse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui täiendavat maksuvaba tulu lapse ülalpidamise korral tahavad kasutada mõlemad vanemad? | <https://www.juristaitab.ee/et/kui-taiendavat-maksuvaba-tulu-lapse-ulalpidamise-korral-tahavad-kasutada-molemad-vanemad> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui täitemenetlusaegse elatisabi saaja ei soovi enam elatisabi väljamakseid saada, siis kuhu peaks ta avalduse esitama? | <https://www.juristaitab.ee/et/kui-taitemenetlusaegse-elatisabi-saaja-ei-soovi-enam-elatisabi-valjamakseid-saada-siis-kuhu-peaks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui vanema majanduslik seis ei võimalda üldse elatist maksta, kas siis ei saagi elatist nõuda? Aga kui vanemal on palju lapsi? | <https://www.juristaitab.ee/et/kui-vanema-majanduslik-seis-ei-voimalda-uldse-elatist-maksta-kas-siis-ei-saagi-elatist-nouda-aga> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kui vanematevahelist vaidlust ei õnnestu lahendada kokkuleppel | <https://www.juristaitab.ee/et/kui-vanematevahelist-vaidlust-ei-onnestu-lahendada-kokkuleppel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas arvutada vastuväite tähtaega? | <https://www.juristaitab.ee/et/kuidas-arvutada-vastuvaite-tahtaega> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas elatist taotleda Eestis? | <https://www.juristaitab.ee/et/kuidas-elatist-taotleda-eestis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas elatist taotleda teises Euroopa Liidu liikmesriigis? | <https://www.juristaitab.ee/et/kuidas-elatist-taotleda-teises-euroopa-liidu-liikmesriigis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas esitada hagiavaldust kohtusse? | <https://www.juristaitab.ee/et/kuidas-esitada-hagiavaldust-kohtusse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas esitada maksekäsu kiirmenetluse avaldust? | <https://www.juristaitab.ee/et/kuidas-esitada-maksekasu-kiirmenetluse-avaldust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas esitada täitedokument kohtutäiturile täitmiseks? | <https://www.juristaitab.ee/et/kuidas-esitada-taitedokument-kohtutaiturile-taitmiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas ja kuhu ma saan esitada kaebuse kohtutäituri tegevusele? | <https://www.juristaitab.ee/et/kuidas-ja-kuhu-ma-saan-esitada-kaebuse-kohtutaituri-tegevusele-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas ja kuhu ma saan esitada kaebuse kohtutäituri tegevusele? | <https://www.juristaitab.ee/et/kuidas-ja-kuhu-ma-saan-esitada-kaebuse-kohtutaituri-tegevusele> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas jagunevad menetluskulud menetlusabi andmisel? | <https://www.juristaitab.ee/et/kuidas-jagunevad-menetluskulud-menetlusabi-andmisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas kulgeb maksekäsu kiirmenetluse protsess? | <https://www.juristaitab.ee/et/kuidas-kulgeb-maksekasu-kiirmenetluse-protsess> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas kulgeb maksekäsu kiirmenetluse protsess? | <https://www.juristaitab.ee/et/kuidas-kulgeb-maksekasu-kiirmenetluse-protsess-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas kuriteod liigituvad? | <https://www.juristaitab.ee/et/kuidas-kuriteod-liigituvad> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas käituda siis, kui võlgniku suhtes küll täitemenetlus käib, kuid võlgnik on maksnud lapse elatisraha otse? | <https://www.juristaitab.ee/et/kuidas-kaituda-siis-kui-volgniku-suhtes-kull-taitemenetlus-kaib-kuid-volgnik-maksnud-lapse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas lepingut sõlmida? | <https://www.juristaitab.ee/et/kuidas-lepingut-solmida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas ma saan aresti alt vabastatud elatusmiinimumi kasutada? | <https://www.juristaitab.ee/et/kuidas-ma-saan-aresti-alt-vabastatud-elatusmiinimumi-kasutada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas ma saan täitemenetlusaegset elatisabi taotleda siis, kui lapse isa ei ole märgitud lapse sünnitunnistusele? | <https://www.juristaitab.ee/et/kuidas-ma-saan-taitemenetlusaegset-elatisabi-taotleda-siis-kui-lapse-isa-ei-ole-margitud-lapse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas määrata kinnisomandi ulatust? | <https://www.juristaitab.ee/et/kuidas-maarata-kinnisomandi-ulatust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas määratakse elatise suurus? | <https://www.juristaitab.ee/et/kuidas-maaratakse-elatise-suurus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas omand tekib? | <https://www.juristaitab.ee/et/kuidas-omand-tekib> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas on võimalik kinnisasja kinkida? | <https://www.juristaitab.ee/et/kuidas-voimalik-kinnisasja-kinkida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas pärandit vastu võtta? Kas peab tegema kindlaid toiminguid selleks, et pärand vastu võtta? | <https://www.juristaitab.ee/et/kuidas-parandit-vastu-votta-kas-peab-tegema-kindlaid-toiminguid-selleks-et-parand-vastu-votta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas saab hüpoteeki seada? | <https://www.juristaitab.ee/et/kuidas-saab-hupoteeki-seada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas saada kohtumenetluses riigipoolset menetlusabi? | <https://www.juristaitab.ee/et/kuidas-saada-kohtumenetluses-riigipoolset-menetlusabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas saada riigi õigusabi? | <https://www.juristaitab.ee/et/kuidas-saada-riigi-oigusabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas saada teada, kes on pankrotistunud ettevõtte pankrotihaldur? | <https://www.juristaitab.ee/et/kuidas-saada-teada-kes-pankrotistunud-ettevotte-pankrotihaldur> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas saan asutada äriühingu, mittetulundusühingu, sihtasutuse, välismaa äriühingu filiaali või füüsilisest isikust ettevõtja? | <https://www.juristaitab.ee/et/kuidas-saan-asutada-ariuhingu-mittetulundusuhingu-sihtasutuse-valismaa-ariuhingu-filiaali-voi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas servituudid jagunevad ja milline on nende olemus? Mille poolest erineb reaalservituut isiklikust servituudist? | <https://www.juristaitab.ee/et/kuidas-servituudid-jagunevad-ja-milline-nende-olemus-mille-poolest-erineb-reaalservituut-isiklikust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas servituudid tekivad ja lõppevad? Mille poolest erineb servituut võlaõiguslikust lepingust? | <https://www.juristaitab.ee/et/kuidas-servituudid-tekivad-ja-loppevad-mille-poolest-erineb-servituut-volaoiguslikust-lepingust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas taotleda elatislahendi muutmist teises Euroopa Liidu liikmesriigis? | <https://www.juristaitab.ee/et/kuidas-taotleda-elatislahendi-muutmist-teises-euroopa-liidu-liikmesriigis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas teada saada, milline täitur minu suhtes esitatud nõuet täidab? | <https://www.juristaitab.ee/et/kuidas-teada-saada-milline-taitur-minu-suhtes-esitatud-nouet-taidab> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas teavitada pankrotihaldurit enda nõudest? | <https://www.juristaitab.ee/et/kuidas-teavitada-pankrotihaldurit-enda-noudest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas teha testamenti? | <https://www.juristaitab.ee/et/kuidas-teha-testamenti> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas tehakse pärimisregistrisse kandeid? | <https://www.juristaitab.ee/et/kuidas-tehakse-parimisregistrisse-kandeid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas tellida abieluvararegistrist ärakirju? | <https://www.juristaitab.ee/et/kuidas-tellida-abieluvararegistrist-arakirju> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub apostilliga kinnitamine? | <https://www.juristaitab.ee/et/kuidas-toimub-apostilliga-kinnitamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub kohtutäituri tasu ja muude kulude vaidlustamine? | <https://www.juristaitab.ee/et/kuidas-toimub-kohtutaituri-tasu-ja-muude-kulude-vaidlustamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub lapse isaduse tuvastamine? | <https://www.juristaitab.ee/et/kuidas-toimub-lapse-isaduse-tuvastamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub omandamise ja võõrandamise tehingu sõlmimine? | <https://www.juristaitab.ee/et/kuidas-toimub-omandamise-ja-voorandamise-tehingu-solmimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub pärandist loobumine? | <https://www.juristaitab.ee/et/kuidas-toimub-parandist-loobumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub pärimisregistrile päringute esitamine? | <https://www.juristaitab.ee/et/kuidas-toimub-parimisregistrile-paringute-esitamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas toimub testamendi registreerimine? | <https://www.juristaitab.ee/et/kuidas-toimub-testamendi-registreerimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas tuleb ühist hooldusõigust teostada? | <https://www.juristaitab.ee/et/kuidas-tuleb-uhist-hooldusoigust-teostada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas täitemenetlusaegset elatisabi arvutatakse? | <https://www.juristaitab.ee/et/kuidas-taitemenetlusaegset-elatisabi-arvutatakse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas valida oma nõude täitmiseks kohtutäiturit? | <https://www.juristaitab.ee/et/kuidas-valida-oma-noude-taitmiseks-kohtutaiturit> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kuidas vormistada kinnisasja või selle osa kasutusse andmist? | <https://www.juristaitab.ee/et/kuidas-vormistada-kinnisasja-voi-selle-osa-kasutusse-andmist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kus ja kuidas saan tutvuda registriandmetega? | <https://www.juristaitab.ee/et/kus-ja-kuidas-saan-tutvuda-registriandmetega> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kus kohast leiaksin asutamiseks ühingu põhikirja? | <https://www.juristaitab.ee/et/kus-kohast-leiaksin-asutamiseks-uhingu-pohikirja> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kus kohast saan informatsiooni erinõuetega tegevusaladel tegutsemise kohta? | <https://www.juristaitab.ee/et/kus-kohast-saan-informatsiooni-erinouetega-tegevusaladel-tegutsemise-kohta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kus kohast saan rohkem informatsiooni laevade registreerimise kohta? | <https://www.juristaitab.ee/et/kus-kohast-saan-rohkem-informatsiooni-laevade-registreerimise-kohta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kus saab abielu lahutada? | <https://www.juristaitab.ee/et/kus-saab-abielu-lahutada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kus saab abielu sõlmida? | <https://www.juristaitab.ee/et/kus-saab-abielu-solmida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kust ma saan teada, kas ettevõte on pankrotis või eelmenetlus on raugenud pankrotti välja kuulutamata? | <https://www.juristaitab.ee/et/kust-ma-saan-teada-kas-ettevote-pankrotis-voi-eelmenetlus-raugenud-pankrotti-valja-kuulutamata> |
| Justiits- ja Digiministeerium (Jurist aitab) | Kust ma saan teada, kes on määratud pankrotis ettevõtte pankrotihalduriks? | <https://www.juristaitab.ee/et/kust-ma-saan-teada-kes-maaratud-pankrotis-ettevotte-pankrotihalduriks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Lapsele eestkostja määramine ilma vanema õiguste äravõtmiseta | <https://www.juristaitab.ee/et/lapsele-eestkostja-maaramine-ilma-vanema-oiguste-aravotmiseta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Lapsele määratud eestkostja õigused ja kohustused | <https://www.juristaitab.ee/et/lapsele-maaratud-eestkostja-oigused-ja-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Legaliseerimine | <https://www.juristaitab.ee/et/legaliseerimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Lepingu lõpetamine | <https://www.juristaitab.ee/et/lepingu-lopetamine-1> |
| Justiits- ja Digiministeerium (Jurist aitab) | Lepingu täitmine ja vastutus | <https://www.juristaitab.ee/et/lepingu-taitmine-ja-vastutus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Lähenemiskeeld | <https://www.juristaitab.ee/et/lahenemiskeeld> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ma tahaksin kinnitada mingi fakti olemasolu või mitteolemasolu | <https://www.juristaitab.ee/et/ma-tahaksin-kinnitada-mingi-fakti-olemasolu-voi-mitteolemasolu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Maakohtusse pöördumine | <https://www.juristaitab.ee/et/maakohtusse-poordumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Maksekäsu kiirmenetlus lapse elatisnõudes | <https://www.juristaitab.ee/et/maksekasu-kiirmenetlus-lapse-elatisnoudes> |
| Justiits- ja Digiministeerium (Jurist aitab) | Maksekäsu kiirmenetluse avalduste vormid | <https://www.juristaitab.ee/et/maksekasu-kiirmenetluse-avalduste-vormid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Maksekäsu kiirmenetluse muutumine hagimenetluseks | <https://www.juristaitab.ee/et/maksekasu-kiirmenetluse-muutumine-hagimenetluseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Maksekäsu kiirmenetluse muutumine hagimenetluseks | <https://www.juristaitab.ee/et/maksekasu-kiirmenetluse-muutumine-hagimenetluseks-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Maksuvabastused ja – soodustused | <https://www.juristaitab.ee/et/maksuvabastused-ja-soodustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Menetluskulud | <https://www.juristaitab.ee/et/menetluskulud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida arvestatakse minu majandusliku seisundi hindamisel? | <https://www.juristaitab.ee/et/mida-arvestatakse-minu-majandusliku-seisundi-hindamisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida kujutab endast pärandvara inventuur? | <https://www.juristaitab.ee/et/mida-kujutab-endast-parandvara-inventuur> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida peab jälgima lepingute sõlmimisel? | <https://www.juristaitab.ee/et/mida-peab-jalgima-lepingute-solmimisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida peab tegema avaliku dokumendi kasutamiseks välismaal? | <https://www.juristaitab.ee/et/mida-peab-tegema-avaliku-dokumendi-kasutamiseks-valismaal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida peaks vanem teadma lapse vara valitsemisel? | <https://www.juristaitab.ee/et/mida-peaks-vanem-teadma-lapse-vara-valitsemisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida pean tegema juhul, kui olen saanud ärikeelu? | <https://www.juristaitab.ee/et/mida-pean-tegema-juhul-kui-olen-saanud-arikeelu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida pean tegema, kui olen äsja abiellunud ja nime vahetanud ning olen äriregistrisse ühingu juhatuse liikmena kantud vana nimega? | <https://www.juristaitab.ee/et/mida-pean-tegema-kui-olen-asja-abiellunud-ja-nime-vahetanud-ning-olen-ariregistrisse-uhingu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida pean tegema, kui ühingu juhatuse liikmete volitused hakkavad peagi lõppema? | <https://www.juristaitab.ee/et/mida-pean-tegema-kui-uhingu-juhatuse-liikmete-volitused-hakkavad-peagi-loppema> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha kindlustusjuhtumi korral? | <https://www.juristaitab.ee/et/mida-teha-kindlustusjuhtumi-korral> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha kui on olemas jõustunud kohtuotsus elatise nõudes, kuid teine vanem ei täida otsust vabatahtlikult? | <https://www.juristaitab.ee/et/mida-teha-kui-olemas-joustunud-kohtuotsus-elatise-noudes-kuid-teine-vanem-ei-taida-otsust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha kui võlgnik ei täida maksekäsku vabatahtlikult? | <https://www.juristaitab.ee/et/mida-teha-kui-volgnik-ei-taida-maksekasku-vabatahtlikult-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha kui võlgnik ei täida maksekäsku vabatahtlikult? | <https://www.juristaitab.ee/et/mida-teha-kui-volgnik-ei-taida-maksekasku-vabatahtlikult> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha olukorras, kus kohtutäitur ei ole pikema aja jooksul suutnud nõuet sisse nõuda? | <https://www.juristaitab.ee/et/mida-teha-olukorras-kus-kohtutaitur-ei-ole-pikema-aja-jooksul-suutnud-nouet-sisse-nouda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui esitatakse nõue kaasomaniku vara vastu? | <https://www.juristaitab.ee/et/mida-teha-kui-esitatakse-noue-kaasomaniku-vara-vastu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui internetist tellitud kaup ei vasta veebilehel avaldatud kirjeldusele? | <https://www.juristaitab.ee/et/mida-teha-kui-internetist-tellitud-kaup-ei-vasta-veebilehel-avaldatud-kirjeldusele> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui lahuselav vanem ei maksa elatist? | <https://www.juristaitab.ee/et/mida-teha-kui-lahuselav-vanem-ei-maksa-elatist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui lapse heaolu on ohustatud? | <https://www.juristaitab.ee/et/mida-teha-kui-lapse-heaolu-ohustatud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui on olemas jõustunud kohtuotsus elatise nõudes, kuid teine vanem ei täida otsust vabatahtlikult ning ka täitemenetlus ei anna tulemust? | <https://www.juristaitab.ee/et/mida-teha-kui-olemas-joustunud-kohtuotsus-elatise-noudes-kuid-teine-vanem-ei-taida-otsust-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui on õigus ülalpidamist saada, aga lahutatud abikaasa seda vabatahtlikult ei maksa? | <https://www.juristaitab.ee/et/mida-teha-kui-oigus-ulalpidamist-saada-aga-lahutatud-abikaasa-seda-vabatahtlikult-ei-maksa> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui on ühine hooldusõigus, aga vanematel on vaidlus mingis konkreetses last puudutavas küsimuses? | <https://www.juristaitab.ee/et/mida-teha-kui-uhine-hooldusoigus-aga-vanematel-vaidlus-mingis-konkreetses-last-puudutavas-kusimuses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui pean kohtusse pöörduma | <https://www.juristaitab.ee/et/mida-teha-kui-pean-kohtusse-poorduma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui vanemad ei saa/ei taha enam ühist hooldusõigust teostada? | <https://www.juristaitab.ee/et/mida-teha-kui-vanemad-ei-saaei-taha-enam-uhist-hooldusoigust-teostada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui võlad ületavad varasid? | <https://www.juristaitab.ee/et/mida-teha-kui-volad-uletavad-varasid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui võlgniku suhtes on Eestis alustatud elatise sissenõudmise täitemenetlus, kuid võlgnik kolis välisriiki? | <https://www.juristaitab.ee/et/mida-teha-kui-volgniku-suhtes-eestis-alustatud-elatise-sissenoudmise-taitemenetlus-kuid-volgnik> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida teha, kui võlgniku suhtes on välisriigis juba täitemenetlus käimas, kuid võlgnik siiski lapsele elatist ei maksa? | <https://www.juristaitab.ee/et/mida-teha-kui-volgniku-suhtes-valisriigis-juba-taitemenetlus-kaimas-kuid-volgnik-siiski-lapsele> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida tähendab „kasu“ vara müügist? | <https://www.juristaitab.ee/et/mida-tahendab-kasu-vara-muugist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida tähendab „suhtlusõigus“? Mida teha, kui see on vastuolus lapse huvidega? | <https://www.juristaitab.ee/et/mida-tahendab-suhtlusoigus-mida-teha-kui-see-vastuolus-lapse-huvidega> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida tähendab „vanema hooldusõigus“? | <https://www.juristaitab.ee/et/mida-tahendab-vanema-hooldusoigus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida tähendab „vara“, mille müügist saadavalt kasult tuleb maksta tulumaksu? | <https://www.juristaitab.ee/et/mida-tahendab-vara-mille-muugist-saadavalt-kasult-tuleb-maksta-tulumaksu> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida tähendab tulumaksuga maksustamisel „soetamismaksumus“? | <https://www.juristaitab.ee/et/mida-tahendab-tulumaksuga-maksustamisel-soetamismaksumus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida tähendab täiendav maksuvaba tulu lapse ülalpidamise korral? | <https://www.juristaitab.ee/et/mida-tahendab-taiendav-maksuvaba-tulu-lapse-ulalpidamise-korral> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mida võib maksustatavast tulust maha arvata? | <https://www.juristaitab.ee/et/mida-voib-maksustatavast-tulust-maha-arvata> |
| Justiits- ja Digiministeerium (Jurist aitab) | Miks ei ole kohtutäitur minu arvelduskontole elatusmiinimumi jätnud? | <https://www.juristaitab.ee/et/miks-ei-ole-kohtutaitur-minu-arvelduskontole-elatusmiinimumi-jatnud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Miks on vajalik 1-kuuline ooteperiood enne kui elatisabi hakatakse maksma? | <https://www.juristaitab.ee/et/miks-vajalik-1-kuuline-ooteperiood-enne-kui-elatisabi-hakatakse-maksma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal ja kui palju hakkab riik täitemenetlusaegset elatisabi maksma? | <https://www.juristaitab.ee/et/millal-ja-kui-palju-hakkab-riik-taitemenetlusaegset-elatisabi-maksma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal ja kui palju maksta? | <https://www.juristaitab.ee/et/millal-ja-kui-palju-maksta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal ja kuidas esitada tuludeklaratsiooni? | <https://www.juristaitab.ee/et/millal-ja-kuidas-esitada-tuludeklaratsiooni> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal ja kuidas läheb valdus võõrandajalt omandajale üle? | <https://www.juristaitab.ee/et/millal-ja-kuidas-laheb-valdus-voorandajalt-omandajale-ule> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal ja mis tingimustel on võimalik täitemenetluses rakendada võlgniku suhtes sunnimeetmeid (näiteks võlgniku juhtimisõiguse peatamine)? | <https://www.juristaitab.ee/et/millal-ja-mis-tingimustel-voimalik-taitemenetluses-rakendada-volgniku-suhtes-sunnimeetmeid-naiteks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal kinnitab notar allkirja õigsuse? | <https://www.juristaitab.ee/et/millal-kinnitab-notar-allkirja-oigsuse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal kohtutäituri poole pöörduda? | <https://www.juristaitab.ee/et/millal-kohtutaituri-poole-poorduda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal lõpetatakse kohtumenetlusaegse elatisabi maksmine? | <https://www.juristaitab.ee/et/millal-lopetatakse-kohtumenetlusaegse-elatisabi-maksmine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal lõppeb pärandvarale hoiumeetme rakendamine? | <https://www.juristaitab.ee/et/millal-loppeb-parandvarale-hoiumeetme-rakendamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal määratakse lapsele erieestkostja? | <https://www.juristaitab.ee/et/millal-maaratakse-lapsele-erieestkostja> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal on nõutav kaubal kasutusjuhendi olemasolu ja kas müüja vastutab selles sisalduva teabe mittekorrektsuse korral? | <https://www.juristaitab.ee/et/millal-noutav-kaubal-kasutusjuhendi-olemasolu-ja-kas-muuja-vastutab-selles-sisalduva-teabe> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal pärimismenetlus lõpeb? | <https://www.juristaitab.ee/et/millal-parimismenetlus-lopeb> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal saab kinnisvara omandav pool kinnisasja omanikuks? | <https://www.juristaitab.ee/et/millal-saab-kinnisvara-omandav-pool-kinnisasja-omanikuks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millal võib olla tegemist lapse vara ohustamisega? Mis siis juhtub? | <https://www.juristaitab.ee/et/millal-voib-olla-tegemist-lapse-vara-ohustamisega-mis-siis-juhtub> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mille alusel arvutatakse maamaks? | <https://www.juristaitab.ee/et/mille-alusel-arvutatakse-maamaks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mille järgi peaks valima täitemenetlust läbiviiva kohtutäituri? | <https://www.juristaitab.ee/et/mille-jargi-peaks-valima-taitemenetlust-labiviiva-kohtutaituri> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mille poolest erineb omand valdusest? | <https://www.juristaitab.ee/et/mille-poolest-erineb-omand-valdusest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mille poolest erineb töövõtuleping töölepingust? | <https://www.juristaitab.ee/et/mille-poolest-erineb-toovotuleping-toolepingust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milles seisneb avalik-õiguslike kitsenduste olemus? | <https://www.juristaitab.ee/et/milles-seisneb-avalik-oiguslike-kitsenduste-olemus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline dokument kinnitab abielu lahutamist? | <https://www.juristaitab.ee/et/milline-dokument-kinnitab-abielu-lahutamist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline nimi jääb abikaasadele pärast abiellumist? | <https://www.juristaitab.ee/et/milline-nimi-jaab-abikaasadele-parast-abiellumist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline on apostillimise protseduur? | <https://www.juristaitab.ee/et/milline-apostillimise-protseduur> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline on legaliseerimise protseduur? | <https://www.juristaitab.ee/et/milline-legaliseerimise-protseduur> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline on perekonnanimi pärast lahutust? | <https://www.juristaitab.ee/et/milline-perekonnanimi-parast-lahutust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline on ületunnitöö ja öötöö? | <https://www.juristaitab.ee/et/milline-uletunnitoo-ja-ootoo> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milline tulu maksustatakse tulumaksuga? | <https://www.juristaitab.ee/et/milline-tulu-maksustatakse-tulumaksuga> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millise aja jooksul kehtib kaubale või teenusele seadusest tulenev pretensiooni esitamise õigus? | <https://www.juristaitab.ee/et/millise-aja-jooksul-kehtib-kaubale-voi-teenusele-seadusest-tulenev-pretensiooni-esitamise-oigus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millise aja jooksul peab kaupleja tarbija poolt kauba puuduse suhtes esitatud pretensiooni läbi vaatama ning kuidas tuleb pretensioon esitada? | <https://www.juristaitab.ee/et/millise-aja-jooksul-peab-kaupleja-tarbija-poolt-kauba-puuduse-suhtes-esitatud-pretensiooni-labi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millise tähtaja jooksul peab kohtutäitur võlgnikult täitemenetluse läbiviimise raames saadud summad sissenõudjale üle kandma? | <https://www.juristaitab.ee/et/millise-tahtaja-jooksul-peab-kohtutaitur-volgnikult-taitemenetluse-labiviimise-raames-saadud-summad> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised andmed peavad sisalduma maksekäsu kiirmenetluse avalduses lapse elatisnõudes? | <https://www.juristaitab.ee/et/millised-andmed-peavad-sisalduma-maksekasu-kiirmenetluse-avalduses-lapse-elatisnoudes> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised andmed peavad sisalduma maksekäsu kiirmenetluse avalduses? | <https://www.juristaitab.ee/et/millised-andmed-peavad-sisalduma-maksekasu-kiirmenetluse-avalduses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised dokumendid on vajalikud notarisse kaasa võtta, et algatada pärimisprotsess? | <https://www.juristaitab.ee/et/millised-dokumendid-vajalikud-notarisse-kaasa-votta-et-algatada-parimisprotsess> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised dokumendid on vajalikud omandamise ja võõrandamise tehingu sõlmimiseks? | <https://www.juristaitab.ee/et/millised-dokumendid-vajalikud-omandamise-ja-voorandamise-tehingu-solmimiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised dokumendid tuleb esitada abiellumiseks notari juures? | <https://www.juristaitab.ee/et/millised-dokumendid-tuleb-esitada-abiellumiseks-notari-juures> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised dokumendid tuleb esitada abiellumisel perekonnaseisuametis? | <https://www.juristaitab.ee/et/millised-dokumendid-tuleb-esitada-abiellumisel-perekonnaseisuametis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised dokumendid tuleb esitada registriosakonnale ühingu asutamiseks, kandeandmete muutmiseks, muude registrisse sisestatud andmete muutmiseks? | <https://www.juristaitab.ee/et/millised-dokumendid-tuleb-esitada-registriosakonnale-uhingu-asutamiseks-kandeandmete-muutmiseks> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised hüvitised on töölepingu ülesütlemisel? | <https://www.juristaitab.ee/et/millised-huvitised-toolepingu-ulesutlemisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised nõuded kehtivad ostetud asja parandamise või vahetamise suhtes? | <https://www.juristaitab.ee/et/millised-nouded-kehtivad-ostetud-asja-parandamise-voi-vahetamise-suhtes> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on elatisabi saaja kohustused? | <https://www.juristaitab.ee/et/millised-elatisabi-saaja-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on füüsilisele isikule menetlusabi andmise tingimused ja piirangud? | <https://www.juristaitab.ee/et/millised-fuusilisele-isikule-menetlusabi-andmise-tingimused-ja-piirangud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on karistused kuritegude eest? | <https://www.juristaitab.ee/et/millised-karistused-kuritegude-eest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on korteriomandi erisused? | <https://www.juristaitab.ee/et/millised-korteriomandi-erisused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on pankrotihalduri kohustused? | <https://www.juristaitab.ee/et/millised-pankrotihalduri-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on pädevad institutsioonid? | <https://www.juristaitab.ee/et/millised-padevad-institutsioonid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on pärimisega seotud kulutused? | <https://www.juristaitab.ee/et/millised-parimisega-seotud-kulutused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on tarbija õigused lennuki või rongi hilinemisel? | <https://www.juristaitab.ee/et/millised-tarbija-oigused-lennuki-voi-rongi-hilinemisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on teede ja tehnorajatistega seotud kitsendused? | <https://www.juristaitab.ee/et/millised-teede-ja-tehnorajatistega-seotud-kitsendused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on töölepingu kohustuslikud tingimused? | <https://www.juristaitab.ee/et/millised-toolepingu-kohustuslikud-tingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on töölepingu lõpetamise alused? | <https://www.juristaitab.ee/et/millised-toolepingu-lopetamise-alused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised on vee ja veekogudega seotud kitsendused? | <https://www.juristaitab.ee/et/millised-vee-ja-veekogudega-seotud-kitsendused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised tasud on ette nähtud omandamise ja võõrandamise tehingu eest? | <https://www.juristaitab.ee/et/millised-tasud-ette-nahtud-omandamise-ja-voorandamise-tehingu-eest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millised õigused on tarbijal kauba tagastamiseks kataloogist tellimise korral? | <https://www.juristaitab.ee/et/millised-oigused-tarbijal-kauba-tagastamiseks-kataloogist-tellimise-korral> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milliseid dokumente ei saa kinnitada apostilliga? | <https://www.juristaitab.ee/et/milliseid-dokumente-ei-saa-kinnitada-apostilliga> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milliseid dokumente ei saa legaliseerida? | <https://www.juristaitab.ee/et/milliseid-dokumente-ei-saa-legaliseerida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milliseid dokumente kohtutäitur täidab? | <https://www.juristaitab.ee/et/milliseid-dokumente-kohtutaitur-taidab> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milliseid sotsiaalkindlustushüvitisi riik pakub? | <https://www.juristaitab.ee/et/milliseid-sotsiaalkindlustushuvitisi-riik-pakub> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milliseid vaidlusi lahendab tarbijavaidluste komisjon? | <https://www.juristaitab.ee/et/milliseid-vaidlusi-lahendab-tarbijavaidluste-komisjon> |
| Justiits- ja Digiministeerium (Jurist aitab) | Milliseid vaidlusi lahendab Tarbijavaidluste komisjon? | <https://www.juristaitab.ee/et/milliseid-vaidlusi-lahendab-tarbijavaidluste-komisjon-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millisel juhul on pärandi inventuur kohustuslik? | <https://www.juristaitab.ee/et/millisel-juhul-parandi-inventuur-kohustuslik> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millisel juhul peab omanik sallima võõrast tegevust või mõjutusi oma kinnisasja suhtes? Millal kaotab omanik õiguse teostada oma omandit piiranguteta? | <https://www.juristaitab.ee/et/millisel-juhul-peab-omanik-sallima-voorast-tegevust-voi-mojutusi-oma-kinnisasja-suhtes-millal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millises järjekorras täidetakse elatise asjas tekkinud võlgnevused? | <https://www.juristaitab.ee/et/millises-jarjekorras-taidetakse-elatise-asjas-tekkinud-volgnevused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millises ulatuses sissetulekut ei arestita? | <https://www.juristaitab.ee/et/millises-ulatuses-sissetulekut-ei-arestita> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millises ulatuses täiskasvanule eestkoste määratakse? | <https://www.juristaitab.ee/et/millises-ulatuses-taiskasvanule-eestkoste-maaratakse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millises vormis peaks lepingud olema sõlmitud? | <https://www.juristaitab.ee/et/millises-vormis-peaks-lepingud-olema-solmitud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millises vormis sõlmitakse tehingud kinnisasjadega? | <https://www.juristaitab.ee/et/millises-vormis-solmitakse-tehingud-kinnisasjadega> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millist teavet peab reisikorraldaja andma reisijale enne pakettreisilepingu sõlmimist? | <https://www.juristaitab.ee/et/millist-teavet-peab-reisikorraldaja-andma-reisijale-enne-pakettreisilepingu-solmimist> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millistel juhtudel võib kohus menetlusabi andmise tühistada ja mis saab siis menetlusabi taotlenud isiku menetluskuludest? | <https://www.juristaitab.ee/et/millistel-juhtudel-voib-kohus-menetlusabi-andmise-tuhistada-ja-mis-saab-siis-menetlusabi-taotlenud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millistel juhtumitel ei saa lahutatud abikaasa ülalpidamist nõuda? | <https://www.juristaitab.ee/et/millistel-juhtumitel-ei-saa-lahutatud-abikaasa-ulalpidamist-nouda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Millistele nõuetele peab vastama tarbijale müüdav asi? | <https://www.juristaitab.ee/et/millistele-nouetele-peab-vastama-tarbijale-muudav-asi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Minu vastu on algatatud kohtumenetlus | <https://www.juristaitab.ee/et/minu-vastu-algatatud-kohtumenetlus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis ajast alates võib elatist nõuda? | <https://www.juristaitab.ee/et/mis-ajast-alates-voib-elatist-nouda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis hetkest alates võib kohtutäitur täitemenetluses tasu nõuda? | <https://www.juristaitab.ee/et/mis-hetkest-alates-voib-kohtutaitur-taitemenetluses-tasu-nouda> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis juhtub, kui vanem mingil põhjusel ei ole võimeline hooldusõigust teostama? | <https://www.juristaitab.ee/et/mis-juhtub-kui-vanem-mingil-pohjusel-ei-ole-voimeline-hooldusoigust-teostama> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis keeles tuleb riigi õigusabi taotlus esitada? | <https://www.juristaitab.ee/et/mis-keeles-tuleb-riigi-oigusabi-taotlus-esitada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis kuupäeval maksab Sotsiaalkindlustusamet elatisabi? | <https://www.juristaitab.ee/et/mis-kuupaeval-maksab-sotsiaalkindlustusamet-elatisabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis ma edasi tegema pean, kui kohus on teinud määruse, millega on otsustatud algatada kohustustest vabastamise menetlus? | <https://www.juristaitab.ee/et/mis-ma-edasi-tegema-pean-kui-kohus-teinud-maaruse-millega-otsustatud-algatada-kohustustest> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis nõuete puhul ei saa maksekäsu kiirmenetlust kasutada? | <https://www.juristaitab.ee/et/mis-nouete-puhul-ei-saa-maksekasu-kiirmenetlust-kasutada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis oli haldusõigusrikkumine? | <https://www.juristaitab.ee/et/mis-oli-haldusoigusrikkumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on abieluvaraleping? | <https://www.juristaitab.ee/et/mis-abieluvaraleping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on abieluvararegister | <https://www.juristaitab.ee/et/mis-abieluvararegister> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on annak? | <https://www.juristaitab.ee/et/mis-annak> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on avalik dokument? | <https://www.juristaitab.ee/et/mis-avalik-dokument> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on broneerimisleping ja mille poolest erineb see eellepingust? | <https://www.juristaitab.ee/et/mis-broneerimisleping-ja-mille-poolest-erineb-see-eellepingust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on dokumendi ametlik tõlge? | <https://www.juristaitab.ee/et/mis-dokumendi-ametlik-tolge> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on elatis? | <https://www.juristaitab.ee/et/mis-elatis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on elatisabi? | <https://www.juristaitab.ee/et/mis-elatisabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on elatusmiinimum? | <https://www.juristaitab.ee/et/mis-elatusmiinimum> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on hoiatus? Millises vormis see esitatakse? | <https://www.juristaitab.ee/et/mis-hoiatus-millises-vormis-see-esitatakse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on hoiatustrahv? | <https://www.juristaitab.ee/et/mis-hoiatustrahv> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on hoonestusõigus? | <https://www.juristaitab.ee/et/mis-hoonestusoigus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on hüpoteek? | <https://www.juristaitab.ee/et/mis-hupoteek> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kahju hüvitamine? | <https://www.juristaitab.ee/et/mis-kahju-huvitamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kasutusleping? | <https://www.juristaitab.ee/et/mis-kasutusleping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kindlustusleping? | <https://www.juristaitab.ee/et/mis-kindlustusleping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kinkeleping? | <https://www.juristaitab.ee/et/mis-kinkeleping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kinnisasi? | <https://www.juristaitab.ee/et/mis-kinnisasi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kinnistu ning kinnisasi | <https://www.juristaitab.ee/et/mis-kinnistu-ning-kinnisasi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on kuriteod? | <https://www.juristaitab.ee/et/mis-kuriteod> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on makseettepanek ja maksekäsk? | <https://www.juristaitab.ee/et/mis-makseettepanek-ja-maksekask-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on makseettepanek ja maksekäsk? | <https://www.juristaitab.ee/et/mis-makseettepanek-ja-maksekask> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on maksekäsu kiirmenetlus lapse elatisnõudes? | <https://www.juristaitab.ee/et/mis-maksekasu-kiirmenetlus-lapse-elatisnoudes> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on ostu tõendav dokument ning millised nõuded selle suhtes kehtivad? | <https://www.juristaitab.ee/et/mis-ostu-toendav-dokument-ning-millised-nouded-selle-suhtes-kehtivad> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on pankrot? | <https://www.juristaitab.ee/et/mis-pankrot> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on põlvnemine? | <https://www.juristaitab.ee/et/mis-polvnemine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on põlvnemisest tulenev ülalpidamise kohustus ja õigus ning kellele see laieneb? | <https://www.juristaitab.ee/et/mis-polvnemisest-tulenev-ulalpidamise-kohustus-ja-oigus-ning-kellele-see-laieneb> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on pärandvara pankrot? | <https://www.juristaitab.ee/et/mis-parandvara-pankrot> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on pärimisregister? | <https://www.juristaitab.ee/et/mis-parimisregister> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on reaalkoormatise sisuks? Kuidas reaalkoormatis tekib ja lõppeb? | <https://www.juristaitab.ee/et/mis-reaalkoormatise-sisuks-kuidas-reaalkoormatis-tekib-ja-loppeb> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on riigi õigusabi? | <https://www.juristaitab.ee/et/mis-riigi-oigusabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on riigipoolne menetlusabi? | <https://www.juristaitab.ee/et/mis-riigipoolne-menetlusabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on süüteod? | <https://www.juristaitab.ee/et/mis-suuteod> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on süüteod? | <https://www.juristaitab.ee/et/mis-suuteod-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on teenuse osutamise leping? | <https://www.juristaitab.ee/et/mis-teenuse-osutamise-leping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on vabatahtliku täitmise tähtaeg? | <https://www.juristaitab.ee/et/mis-vabatahtliku-taitmise-tahtaeg> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on vallasasi? | <https://www.juristaitab.ee/et/mis-vallasasi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on vara juurdekasvu tasaarvestus? | <https://www.juristaitab.ee/et/mis-vara-juurdekasvu-tasaarvestus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on varalahusus? | <https://www.juristaitab.ee/et/mis-varalahusus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on varaühisus? | <https://www.juristaitab.ee/et/mis-varauhisus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on väärteod? | <https://www.juristaitab.ee/et/mis-vaarteod> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis on ärakirja õigsuse kinnitamine? | <https://www.juristaitab.ee/et/mis-arakirja-oigsuse-kinnitamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis peaks lepingus kirjas olema? | <https://www.juristaitab.ee/et/mis-peaks-lepingus-kirjas-olema> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis saab peale nõudeavalduse esitamist? Kas haldur võtab minuga ühendust? | <https://www.juristaitab.ee/et/mis-saab-peale-noudeavalduse-esitamist-kas-haldur-votab-minuga-uhendust> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis saab siis, kui kohus vabastab mind pankrotimenetluses täitmata jäänud kohustustest? Mis saab nendest võlausaldajatest, kes jätsid esitamata või ei esitanud tähtaegselt pankrotimenetluse jooksul nõudeavaldust? | <https://www.juristaitab.ee/et/mis-saab-siis-kui-kohus-vabastab-mind-pankrotimenetluses-taitmata-jaanud-kohustustest-mis-saab> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis tingimustel saab töötasu vähendada? | <https://www.juristaitab.ee/et/mis-tingimustel-saab-tootasu-vahendada> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mis vahe on kaasomandil ja ühisomandil? Kuidas käib kaasomandi ja ühisomandi valdamine, kasutamine ja käsutamine? | <https://www.juristaitab.ee/et/mis-vahe-kaasomandil-ja-uhisomandil-kuidas-kaib-kaasomandi-ja-uhisomandi-valdamine-kasutamine-ja> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mul on küsimus maksude kohta | <https://www.juristaitab.ee/et/mul-kusimus-maksude-kohta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Mul on küsimus töösuhete kohta | <https://www.juristaitab.ee/et/mul-kusimus-toosuhete-kohta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Muu kohtuotsuse tunnustamine | <https://www.juristaitab.ee/et/muu-kohtuotsuse-tunnustamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müügileping | <https://www.juristaitab.ee/et/muugileping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müügilepingu korral asja üleandmine ja vastuvõtmine | <https://www.juristaitab.ee/et/muugilepingu-korral-asja-uleandmine-ja-vastuvotmine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müügilepingu olulised tingimused | <https://www.juristaitab.ee/et/muugilepingu-olulised-tingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müügilepingu puudused ja garantiid | <https://www.juristaitab.ee/et/muugilepingu-puudused-ja-garantiid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müügilepingu rikkumine ja tagajärjed | <https://www.juristaitab.ee/et/muugilepingu-rikkumine-ja-tagajarjed> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müügilepingu vorm | <https://www.juristaitab.ee/et/muugilepingu-vorm> |
| Justiits- ja Digiministeerium (Jurist aitab) | Müüja ja ostja õigused ja kohustused | <https://www.juristaitab.ee/et/muuja-ja-ostja-oigused-ja-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Nn. Lugano 2007 konventsioon | <https://www.juristaitab.ee/et/nn-lugano-2007-konventsioon> |
| Justiits- ja Digiministeerium (Jurist aitab) | Nn. Lugano 2007 konventsioon ja elatisabi | <https://www.juristaitab.ee/et/nn-lugano-2007-konventsioon-ja-elatisabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Notari tasust vabastamine | <https://www.juristaitab.ee/et/notari-tasust-vabastamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Notariaalne abieluvaraleping | <https://www.juristaitab.ee/et/notariaalne-abieluvaraleping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Notariaalne testament | <https://www.juristaitab.ee/et/notariaalne-testament> |
| Justiits- ja Digiministeerium (Jurist aitab) | Notariaalse elatislepingu tunnistamine Nõukogu määruse nr 4/2009, | <https://www.juristaitab.ee/et/notariaalse-elatislepingu-tunnistamine-noukogu-maaruse-nr-42009> |
| Justiits- ja Digiministeerium (Jurist aitab) | Oleme kaasomanikud ja soovime kaasomandit lõpetada selliselt, et ühest omanikust saab ainuomanik | <https://www.juristaitab.ee/et/oleme-kaasomanikud-ja-soovime-kaasomandit-lopetada-selliselt-et-uhest-omanikust-saab-ainuomanik> |
| Justiits- ja Digiministeerium (Jurist aitab) | Oleme kaasomanikud ning soovime kokku leppida kaasomandi kasutuskorras | <https://www.juristaitab.ee/et/oleme-kaasomanikud-ning-soovime-kokku-leppida-kaasomandi-kasutuskorras> |
| Justiits- ja Digiministeerium (Jurist aitab) | Olen saanud täitmisteate. Mida teha? | <https://www.juristaitab.ee/et/olen-saanud-taitmisteate-mida-teha> |
| Justiits- ja Digiministeerium (Jurist aitab) | Olen võla õigeaegselt tasunud, kuid kohtutäitur algatas minu suhtes täitemenetluse. Mida teha? | <https://www.juristaitab.ee/et/olen-vola-oigeaegselt-tasunud-kuid-kohtutaitur-algatas-minu-suhtes-taitemenetluse-mida-teha> |
| Justiits- ja Digiministeerium (Jurist aitab) | Omakäeline testament | <https://www.juristaitab.ee/et/omakaeline-testament> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ostueesõigus | <https://www.juristaitab.ee/et/ostueesoigus-3> |
| Justiits- ja Digiministeerium (Jurist aitab) | Planeeringud | <https://www.juristaitab.ee/et/planeeringud-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Planeeringud ja ehitus | <https://www.juristaitab.ee/et/planeeringud-ja-ehitus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Puhkus: kestus, liigid, puhkuse andmise kohustus, kompenseerimise võimalikkus | <https://www.juristaitab.ee/et/puhkus-kestus-liigid-puhkuse-andmise-kohustus-kompenseerimise-voimalikkus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Pärandit on vaja pärimismenetluse lõppemiseni hooldada. Kes määrab pärandvara hoiumeetmed, hooldaja ja hooldamise piirid? | <https://www.juristaitab.ee/et/parandit-vaja-parimismenetluse-loppemiseni-hooldada-kes-maarab-parandvara-hoiumeetmed-hooldaja-ja> |
| Justiits- ja Digiministeerium (Jurist aitab) | Pärimisleping | <https://www.juristaitab.ee/et/parimisleping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Pärimisprotsessi algatamine | <https://www.juristaitab.ee/et/parimisprotsessi-algatamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Rahvusvaheline lapserööv | <https://www.juristaitab.ee/et/rahvusvaheline-lapseroov> |
| Justiits- ja Digiministeerium (Jurist aitab) | Rahvusvaheline lapserööv | <https://www.juristaitab.ee/et/rahvusvaheline-lapseroov-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Rahvusvaheline lastekaitse | <https://www.juristaitab.ee/et/rahvusvaheline-lastekaitse> |
| Justiits- ja Digiministeerium (Jurist aitab) | Rahvusvaheline õigusabi | <https://www.juristaitab.ee/et/rahvusvaheline-oigusabi> |
| Justiits- ja Digiministeerium (Jurist aitab) | Riigi õigusabi vormid | <https://www.juristaitab.ee/et/riigi-oigusabi-vormid> |
| Justiits- ja Digiministeerium (Jurist aitab) | Riigilõiv kohtusse pöördumisel | <https://www.juristaitab.ee/et/riigiloiv-kohtusse-poordumisel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Riigilõivu tagastamise taotlemine | <https://www.juristaitab.ee/et/riigiloivu-tagastamise-taotlemine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Saladuse hoidmise kohustus ja konkurentsipiirang | <https://www.juristaitab.ee/et/saladuse-hoidmise-kohustus-ja-konkurentsipiirang> |
| Justiits- ja Digiministeerium (Jurist aitab) | Seadusjärgne pärimine | <https://www.juristaitab.ee/et/seadusjargne-parimine-6> |
| Justiits- ja Digiministeerium (Jurist aitab) | Soovin täitemenetluses tasuda võlga osade kaupa. Kelle poole ma peaks pöörduma? | <https://www.juristaitab.ee/et/soovin-taitemenetluses-tasuda-volga-osade-kaupa-kelle-poole-ma-peaks-poorduma> |
| Justiits- ja Digiministeerium (Jurist aitab) | Soovite esitada enda so füüsilise isiku pankrotiavaldust. Kuidas toimida? | <https://www.juristaitab.ee/et/soovite-esitada-enda-so-fuusilise-isiku-pankrotiavaldust-kuidas-toimida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Soovite esitada ettevõtte vastu pankrotiavaldust. Kuidas toimida? | <https://www.juristaitab.ee/et/soovite-esitada-ettevotte-vastu-pankrotiavaldust-kuidas-toimida> |
| Justiits- ja Digiministeerium (Jurist aitab) | Sundosa saamise õigust. Kellel on õigus sundosale pärimismenetluses? | <https://www.juristaitab.ee/et/sundosa-saamise-oigust-kellel-oigus-sundosale-parimismenetluses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Süütegude ennetamine | <https://www.juristaitab.ee/et/suutegude-ennetamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tagaseljaotsus | <https://www.juristaitab.ee/et/tagaseljaotsus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tarbijakrediit | <https://www.juristaitab.ee/et/tarbijakrediit> |
| Justiits- ja Digiministeerium (Jurist aitab) | Teenuse osutaja ja tellija õigused ja kohustused | <https://www.juristaitab.ee/et/teenuse-osutaja-ja-tellija-oigused-ja-kohustused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Teenuse osutamise lepingu sisu ja tingimused | <https://www.juristaitab.ee/et/teenuse-osutamise-lepingu-sisu-ja-tingimused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tehingud lapse varaga | <https://www.juristaitab.ee/et/tehingud-lapse-varaga> |
| Justiits- ja Digiministeerium (Jurist aitab) | Testamendi hoidmine | <https://www.juristaitab.ee/et/testamendi-hoidmine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Testamendijärgne pärimine | <https://www.juristaitab.ee/et/testamendijargne-parimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tulumaksu tagastuse arestimine | <https://www.juristaitab.ee/et/tulumaksu-tagastuse-arestimine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tunnistajate juuresolekul kinnitatud testament | <https://www.juristaitab.ee/et/tunnistajate-juuresolekul-kinnitatud-testament> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tunnustamine Leedus, Lätis või Poolas õigusabilepingute alusel | <https://www.juristaitab.ee/et/tunnustamine-leedus-latis-voi-poolas-oigusabilepingute-alusel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tunnustamine Ukrainas õigusabilepingute alusel | <https://www.juristaitab.ee/et/tunnustamine-ukrainas-oigusabilepingute-alusel> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tunnustamine Ukrainas õigusabilepingute alusel ning elatisabi taotlemine | <https://www.juristaitab.ee/et/tunnustamine-ukrainas-oigusabilepingute-alusel-ning-elatisabi-taotlemine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Tähtajaline tööleping: tähtaeg, tingimused, lõpetamise alused | <https://www.juristaitab.ee/et/tahtajaline-tooleping-tahtaeg-tingimused-lopetamise-alused> |
| Justiits- ja Digiministeerium (Jurist aitab) | Täiendav maksuvaba tulu vanaduspensionieas | <https://www.juristaitab.ee/et/taiendav-maksuvaba-tulu-vanaduspensionieas> |
| Justiits- ja Digiministeerium (Jurist aitab) | Täisealiste eestkoste | <https://www.juristaitab.ee/et/taisealiste-eestkoste> |
| Justiits- ja Digiministeerium (Jurist aitab) | Täitemenetluse aluseks olevate nõuete aegumine | <https://www.juristaitab.ee/et/taitemenetluse-aluseks-olevate-nouete-aegumine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Töölepingu ülesütlemine töötaja algatusel. Tähtajad ja ülesütlemise vorm | <https://www.juristaitab.ee/et/toolepingu-ulesutlemine-tootaja-algatusel-tahtajad-ja-ulesutlemise-vorm> |
| Justiits- ja Digiministeerium (Jurist aitab) | Töövaidlus | <https://www.juristaitab.ee/et/toovaidlus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Töövaidluste lahendamine töövaidluskomisjonis ja kohtus. Vaidlustamise tähtajad, riigilõiv, edasikaebamine | <https://www.juristaitab.ee/et/toovaidluste-lahendamine-toovaidluskomisjonis-ja-kohtus-vaidlustamise-tahtajad-riigiloiv> |
| Justiits- ja Digiministeerium (Jurist aitab) | Vahekohtuotsuse tunnustamine ja täitmine välismaal | <https://www.juristaitab.ee/et/vahekohtuotsuse-tunnustamine-ja-taitmine-valismaal> |
| Justiits- ja Digiministeerium (Jurist aitab) | Vaidluste lahendamine | <https://www.juristaitab.ee/et/vaidluste-lahendamine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Valdus | <https://www.juristaitab.ee/et/valdus-0> |
| Justiits- ja Digiministeerium (Jurist aitab) | Vanema ja lapse suhte tekkimine ning isaduse kindlakstegemine | <https://www.juristaitab.ee/et/vanema-ja-lapse-suhte-tekkimine-ning-isaduse-kindlakstegemine> |
| Justiits- ja Digiministeerium (Jurist aitab) | Vanemahüvitis | <https://www.juristaitab.ee/et/vanemahuvitis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Varalise vastutuse leping | <https://www.juristaitab.ee/et/varalise-vastutuse-leping> |
| Justiits- ja Digiministeerium (Jurist aitab) | Vastuväide ja selle tähtaeg? | <https://www.juristaitab.ee/et/vastuvaide-ja-selle-tahtaeg> |
| Justiits- ja Digiministeerium (Jurist aitab) | Viivised, leppetrahvid, sissenõudekulud | <https://www.juristaitab.ee/et/viivised-leppetrahvid-sissenoudekulud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Võlgadega pärand - kas pärandist loobuda või pärand vastu võtta? | <https://www.juristaitab.ee/et/volgadega-parand-kas-parandist-loobuda-voi-parand-vastu-votta> |
| Justiits- ja Digiministeerium (Jurist aitab) | Võlgniku põhilised kohustused täitemenetluses | <https://www.juristaitab.ee/et/volgniku-pohilised-kohustused-taitemenetluses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Võlgniku põhilised õigused täitemenetluses | <https://www.juristaitab.ee/et/volgniku-pohilised-oigused-taitemenetluses> |
| Justiits- ja Digiministeerium (Jurist aitab) | Väljaande Ametlikud Teadaanded andmetel on ettevõte pankrotis. Mis ma edasi tegema pean? | <https://www.juristaitab.ee/et/valjaande-ametlikud-teadaanded-andmetel-ettevote-pankrotis-mis-ma-edasi-tegema-pean> |
| Justiits- ja Digiministeerium (Jurist aitab) | Õigusabilepingud | <https://www.juristaitab.ee/et/oigusabilepingud> |
| Justiits- ja Digiministeerium (Jurist aitab) | Õppefilm "Vaidluste lahendamisest kohtus" | <https://www.juristaitab.ee/et/oppefilm-vaidluste-lahendamisest-kohtus> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ülalpidamise ulatus ja viis | <https://www.juristaitab.ee/et/ulalpidamise-ulatus-ja-viis> |
| Justiits- ja Digiministeerium (Jurist aitab) | Ülalpidamiskohustus pärast lahutust seoses ühise lapse hooldamisega | <https://www.juristaitab.ee/et/ulalpidamiskohustus-parast-lahutust-seoses-uhise-lapse-hooldamisega> |
| Põhja-Eesti Regionaalhaigla | Iseseisev statsionaarne õendusabiteenus | <https://www.regionaalhaigla.ee/iseseisev-statsionaarne-oendusabiteenus> |
| Põhja-Eesti Regionaalhaigla | Lähedasele | <https://www.regionaalhaigla.ee/patsiendile/lahedasele> |
| Põhja-Eesti Regionaalhaigla | Palliatiivravi | <https://www.regionaalhaigla.ee/palliatiivravi> |
| Põhja-Eesti Regionaalhaigla | Palliatiivravi keskus | <https://www.regionaalhaigla.ee/palliatiivravi-keskus> |
| Põhja-Eesti Regionaalhaigla | Patsiendi õigused ja kohustused | <https://www.regionaalhaigla.ee/patsiendile/patsiendile/patsiendi-oigused-ja-kohustused> |
| Põhja-Eesti Regionaalhaigla | Õendusabi keskus | <https://www.regionaalhaigla.ee/oendusabi-keskus> |
| Sotsiaalkindlustusamet | 15. juuni on ülemaailmne eakate väärkohtlemise teadvustamise päev | <https://www.palunabi.ee/et/artiklid/15-juuni-ulemaailmne-eakate-vaarkohtlemise-teadvustamise-paev> |
| Sotsiaalkindlustusamet | Abiks spetsialistile | <https://www.lasteabi.ee/et/abiks-spetsialistile> |
| Sotsiaalkindlustusamet | Abivahendi tõendi väljastajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/abivahendi-toendi-valjastajale> |
| Sotsiaalkindlustusamet | Abivajav ja hädaohus olev laps | <https://www.lasteabi.ee/et/abivajav-ja-hadaohus-olev-laps> |
| Sotsiaalkindlustusamet | Armastus ja suhted | <https://www.lasteabi.ee/et/armastus-ja-suhted> |
| Sotsiaalkindlustusamet | Asendushoolduse ja järelhoolduse korraldamine | <https://sotsiaalkindlustusamet.ee/asendushoolduse-ja-jarelhoolduse-korraldamine> |
| Sotsiaalkindlustusamet | Asenduskodu teenuse pakkujale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/asenduskodu-teenuse-pakkujale> |
| Sotsiaalkindlustusamet | E- kursused ohvri abistajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/ohvri-abistajale/e-kursused-ohvri-abistajale> |
| Sotsiaalkindlustusamet | E-kursused | <https://www.palunabi.ee/et/e-kursused> |
| Sotsiaalkindlustusamet | Eaka väärkohtlemine jääb pahatihti nähtamatuks | <https://www.palunabi.ee/et/artiklid/eaka-vaarkohtlemine-jaab-pahatihti-nahtamatuks> |
| Sotsiaalkindlustusamet | Erihoolekandeteenuse osutajale | <https://sotsiaalkindlustusamet.ee/erihoolekandeteenuse-osutajale> |
| Sotsiaalkindlustusamet | Hoolin ja märkan: kuidas lasteabi töötab? | <https://www.lasteabi.ee/et/artiklid/hoolin-ja-markan-kuidas-lasteabi-tootab> |
| Sotsiaalkindlustusamet | Hädaohus oleva täiskasvanud perevägivalla ohvri abistamine (MARAC-i mudel) | <https://sotsiaalkindlustusamet.ee/MARAC> |
| Sotsiaalkindlustusamet | Iga tunne loeb: LGBTQ+ noorte mõistmine ja toetus | <https://www.lasteabi.ee/et/artiklid/iga-tunne-loeb-lgbtq-noorte-moistmine-ja-toetus> |
| Sotsiaalkindlustusamet | Isikukeskse erihoolekande teenuse mudeli (ISTE) rakendamine kohalikus omavalitsuses | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/isikukeskse-erihoolekande> |
| Sotsiaalkindlustusamet | Juhendid, vormid ja täienduskoolitused lastekaitsetöötajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-peredega-tootavale-spetsialistile/juhendid-vormid-ja> |
| Sotsiaalkindlustusamet | Juhtumikorraldus | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-peredega-tootavale-spetsialistile/juhtumikorraldus> |
| Sotsiaalkindlustusamet | Kadunud laste telefon 116 000 | <https://www.lasteabi.ee/et/kadunud-laste-telefon-116-000> |
| Sotsiaalkindlustusamet | Kas sina tead, millise taustaga inimene on palgatud suveks või pikemaks lastega töötama? | <https://www.lasteabi.ee/et/artiklid/kas-sina-tead-millise-taustaga-inimene-palgatud-suveks-voi-pikemaks-lastega-tootama-0> |
| Sotsiaalkindlustusamet | Kasuvanemluse eri tahke avavad „Koduteel“ dokkfilmid | <https://www.lasteabi.ee/et/artiklid/kasuvanemluse-eri-tahke-avavad-koduteel-dokkfilmid> |
| Sotsiaalkindlustusamet | Kelle palkad lastega töötama? | <https://www.lasteabi.ee/et/artiklid/kelle-palkad-lastega-tootama> |
| Sotsiaalkindlustusamet | Kelmuse ohvriks sattudes saab tuge ka ohvriabist | <https://www.palunabi.ee/et/artiklid/kelmuse-ohvriks-sattudes-saab-tuge-ka-ohvriabist> |
| Sotsiaalkindlustusamet | Kes on lastekaitsetöötaja ja miks ta on sulle oluline? | <https://www.lasteabi.ee/et/artiklid/kes-lastekaitsetootaja-ja-miks-ta-sulle-oluline> |
| Sotsiaalkindlustusamet | Kevadväsimus ja viimased koolikuud: kuidas hoida end tasakaalus? | <https://www.lasteabi.ee/et/artiklid/kevadvasimus-ja-viimased-koolikuud-kuidas-hoida-end-tasakaalus> |
| Sotsiaalkindlustusamet | Kinnise lasteasutuse teenus (KLAT) | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-noortega-tootavale-spetsialistile/klat> |
| Sotsiaalkindlustusamet | Kiusamine | <https://www.lasteabi.ee/et/kiusamine> |
| Sotsiaalkindlustusamet | Kiusamine | <https://www.lasteabi.ee/et/kiusamine-lapsevanem> |
| Sotsiaalkindlustusamet | Kohalike omavalitsuste nõustamine | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine> |
| Sotsiaalkindlustusamet | Koolitused ja töötoad | <https://www.lasteabi.ee/et/koolitused-ja-tootoad> |
| Sotsiaalkindlustusamet | Kriisihoolduspere ja erihoolduspere | <https://sotsiaalkindlustusamet.ee/kriisihoolduspere> |
| Sotsiaalkindlustusamet | Kui õppimine on raske... | <https://www.lasteabi.ee/et/artiklid/kui-oppimine-raske> |
| Sotsiaalkindlustusamet | Kuidas aidata last, kellel on mure? | <https://www.lasteabi.ee/et/artiklid/kuidas-aidata-last-kellel-mure> |
| Sotsiaalkindlustusamet | Kuidas koguda tõendusmaterjali kogetud lähisuhtevägivalla kohta? | <https://www.palunabi.ee/et/artiklid/kuidas-koguda-toendusmaterjali-kogetud-lahisuhtevagivalla-kohta> |
| Sotsiaalkindlustusamet | Kuidas olla toeks enesetapumõtetega inimesele? | <https://www.palunabi.ee/et/artiklid/kuidas-olla-toeks-enesetapumotetega-inimesele> |
| Sotsiaalkindlustusamet | Kuidas rääkida noortega vägivallast? | <https://www.palunabi.ee/et/artiklid/kuidas-raakida-noortega-vagivallast> |
| Sotsiaalkindlustusamet | Kuidas sõpra toetada? | <https://www.lasteabi.ee/et/artiklid/kuidas-sopra-toetada> |
| Sotsiaalkindlustusamet | KUULA: vestlused, mis aitavad lähisuhtevägivalla teemast paremini aru saada | <https://www.palunabi.ee/et/artiklid/kuula-vestlused-mis-aitavad-lahisuhtevagivalla-teemast-paremini-aru-saada> |
| Sotsiaalkindlustusamet | Kõik sõbrad ei ole mõeldud selleks, et jääda. | <https://www.lasteabi.ee/et/artiklid/koik-sobrad-ei-ole-moeldud-selleks-et-jaada> |
| Sotsiaalkindlustusamet | Laps kannatab ka siis, kui löögid ei taba teda | <https://www.palunabi.ee/et/artiklid/laps-kannatab-ka-siis-kui-loogid-ei-taba-teda> |
| Sotsiaalkindlustusamet | Lapse arenguetapid | <https://www.lasteabi.ee/et/lapse-arenguetapid> |
| Sotsiaalkindlustusamet | Lapse heaolu hindamine | <https://www.lasteabi.ee/et/spetsialistile> |
| Sotsiaalkindlustusamet | Laste ja peredega töötavale spetsialistile | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-peredega-tootavale-spetsialistile> |
| Sotsiaalkindlustusamet | Laste seksuaalne väärkohtlemine internetis | <https://www.lasteabi.ee/et/laste-seksuaalne-vaarkohtlemine-internetis> |
| Sotsiaalkindlustusamet | Lasteabi 116111 | <https://www.lasteabi.ee/et/lasteabi-116111> |
| Sotsiaalkindlustusamet | Lasteabi 116111 | <https://sotsiaalkindlustusamet.ee/lasteabi-116111> |
| Sotsiaalkindlustusamet | Lasteabi ja Narva lastekaitseosakonna kohtumine | <https://www.lasteabi.ee/et/artiklid/lasteabi-ja-narva-lastekaitseosakonna-kohtumine> |
| Sotsiaalkindlustusamet | Lasteabi Kohtla-Järve Kesklinna Põhikoolis | <https://www.lasteabi.ee/et/artiklid/lasteabi-kohtla-jarve-kesklinna-pohikoolis> |
| Sotsiaalkindlustusamet | Lasteabi nõustamine viipekeeles | <https://www.lasteabi.ee/et/artiklid/lasteabi-noustamine-viipekeeles> |
| Sotsiaalkindlustusamet | Lasteabi nõustamine viipekeeles | <https://www.lasteabi.ee/et/artiklid/lasteabi-noustamine-viipekeeles-0> |
| Sotsiaalkindlustusamet | Lasteabi pakub veebiterapeudi teenust | <https://www.lasteabi.ee/et/artiklid/lasteabi-pakub-veebiterapeudi-teenust> |
| Sotsiaalkindlustusamet | Lasteabi podcast: Hooldusperedesse ei jõua vaid väikelapsed, ka teismelised ootavad kodu ja turvalisust | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-hooldusperedesse-ei-joua-vaid-vaikelapsed-ka-teismelised-ootavad-kodu-ja> |
| Sotsiaalkindlustusamet | Lasteabi podcast: Kas sinu laps oskab enda piire kehtestada? Kas sinu teismeline teab, et „ei“ tähendabki päriselt „ei“? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kas-sinu-laps-oskab-enda-piire-kehtestada-kas-sinu-teismeline-teab-et-ei> |
| Sotsiaalkindlustusamet | Lasteabi podcast: kuidas hoida laste ja noorte vaimset tervist? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kuidas-hoida-laste-ja-noorte-vaimset-tervist> |
| Sotsiaalkindlustusamet | Lasteabi podcast: kuidas kaitsta lapsi sotsiaalmeedia negatiivse mõju eest? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kuidas-kaitsta-lapsi-sotsiaalmeedia-negatiivse-moju-eest> |
| Sotsiaalkindlustusamet | Lasteabi podcast: kuidas saab kool laste vaimset tervist toetada? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kuidas-saab-kool-laste-vaimset-tervist-toetada> |
| Sotsiaalkindlustusamet | Lasteabi podcast: kuidas veeta lastega üks tore suvi? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kuidas-veeta-lastega-uks-tore-suvi> |
| Sotsiaalkindlustusamet | Lasteabi podcast: Kuidas veipimist ennetada? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kuidas-veipimist-ennetada> |
| Sotsiaalkindlustusamet | Lasteabi podcast: Kuigi töö perekodus on emotsionaalselt keeruline, pakub see ka suurt rõõmu | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-kuigi-too-perekodus-emotsionaalselt-keeruline-pakub-see-ka-suurt-roomu> |
| Sotsiaalkindlustusamet | Lasteabi podcast: Mis on turvaline huviharidus? | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-mis-turvaline-huviharidus> |
| Sotsiaalkindlustusamet | Lasteabi podcast: perelepitus aitab peredel hakkama saada ka pärast purunemist | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-perelepitus-aitab-peredel-hakkama-saada-ka-parast-purunemist> |
| Sotsiaalkindlustusamet | Lasteabi podcast: Tüdrukud tarvitavad narkootikume üha enam | <https://www.lasteabi.ee/et/artiklid/lasteabi-podcast-tudrukud-tarvitavad-narkootikume-uha-enam> |
| Sotsiaalkindlustusamet | Lasteabisse pöördumiste arv kasvas aastaga 14,5%. Aina rohkem tuleb teateid õpetajatelt | <https://www.lasteabi.ee/et/artiklid/lasteabisse-poordumiste-arv-kasvas-aastaga-145-aina-rohkem-tuleb-teateid-opetajatelt> |
| Sotsiaalkindlustusamet | Lastekaitsealane ennetustöö | <https://sotsiaalkindlustusamet.ee/lastekaitsealane-ennetus> |
| Sotsiaalkindlustusamet | Lastekaitsealane nõustamine | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-noortega-tootavale-spetsialistile/lastekaitse-noustamine> |
| Sotsiaalkindlustusamet | Lastemaja | <https://www.lasteabi.ee/et/lastemaja> |
| Sotsiaalkindlustusamet | Menetlustähtajad | <https://sotsiaalkindlustusamet.ee/menetlustahtajad> |
| Sotsiaalkindlustusamet | Miks peab kiusamist ennetama ja vähendama? | <https://www.lasteabi.ee/et/artiklid/miks-peab-kiusamist-ennetama-ja-vahendama> |
| Sotsiaalkindlustusamet | Millal lasteabisse pöörduda? | <https://www.lasteabi.ee/et/millal-lasteabisse-poorduda> |
| Sotsiaalkindlustusamet | Mis ei ole kiusamine? | <https://www.lasteabi.ee/et/artiklid/mis-ei-ole-kiusamine> |
| Sotsiaalkindlustusamet | Mis on koolikiusamine? | <https://www.lasteabi.ee/et/artiklid/mis-koolikiusamine> |
| Sotsiaalkindlustusamet | Mis on küberkiusamine? | <https://www.lasteabi.ee/et/artiklid/mis-kuberkiusamine> |
| Sotsiaalkindlustusamet | Mitmedimensiooniline pereteraapia | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-peredega-tootavale-spetsialistile/mitmedimensiooniline> |
| Sotsiaalkindlustusamet | Mul on vastutus | <https://www.lasteabi.ee/et/mul-vastutus> |
| Sotsiaalkindlustusamet | Mul on võimalus | <https://www.lasteabi.ee/et/mul-voimalus> |
| Sotsiaalkindlustusamet | Mul on õigus | <https://www.lasteabi.ee/et/mul-oigus> |
| Sotsiaalkindlustusamet | Noorte toetamine | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/laste-ja-peredega-tootavale-spetsialistile/noorte-toetamine> |
| Sotsiaalkindlustusamet | Noorte toetamine ja järelhooldus | <https://sotsiaalkindlustusamet.ee/abivajav-laps-ja-taiskasvanu/asendushooldus-ja-kasuvanemlus/noorte-toetamine-ja-jarelhooldus> |
| Sotsiaalkindlustusamet | Noortegarantii tugisüsteem | <https://www.lasteabi.ee/et/noortegarantii-tugisusteem> |
| Sotsiaalkindlustusamet | Noortegarantii tugisüsteem | <https://sotsiaalkindlustusamet.ee/ngts> |
| Sotsiaalkindlustusamet | Ohvri abistajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/ohvri-abistajale> |
| Sotsiaalkindlustusamet | Ohvri andmete edastamine sotsiaalkindlustusametile | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/ohvri-abistajale/ohvri-andmete-edastamine> |
| Sotsiaalkindlustusamet | Pensioni taotlemine | <https://sotsiaalkindlustusamet.ee/pensioni-taotlemine> |
| Sotsiaalkindlustusamet | Perekond | <https://www.lasteabi.ee/et/perekond> |
| Sotsiaalkindlustusamet | Perekond | <https://www.lasteabi.ee/et/perekond-0> |
| Sotsiaalkindlustusamet | Perepõhise asendushoolduse tugiteenuste osutajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/perepohise-asendushoolduse-tugiteenuste> |
| Sotsiaalkindlustusamet | Psühholoogiline esmaabi on oskus nagu meditsiiniline esmaabi ning seda võiks osata igaüks | <https://www.palunabi.ee/et/artiklid/psuhholoogiline-esmaabi-oskus-nagu-meditsiiniline-esmaabi-ning-seda-voiks-osata-igauks> |
| Sotsiaalkindlustusamet | Psühholoogilist traumat arvestav praktika | <https://www.palunabi.ee/et/psuhholoogilist-traumat-arvestav-praktika> |
| Sotsiaalkindlustusamet | Puhkusetasu ja keskmise töötasu hüvitamine riigieelarvest | <https://sotsiaalkindlustusamet.ee/puhkusetasu-ja-keskmise-tootasu-huvitamine> |
| Sotsiaalkindlustusamet | Puudega tööealise inimese toetus | <https://sotsiaalkindlustusamet.ee/puudega-tooealise-inimese-toetus> |
| Sotsiaalkindlustusamet | Pühadestress ja selle leevendamine: kuidas toime tulla erinevates eluetappides | <https://www.lasteabi.ee/et/artiklid/puhadestress-ja-selle-leevendamine-kuidas-toime-tulla-erinevates-eluetappides> |
| Sotsiaalkindlustusamet | Rahvusvahelise ja ajutise kaitse saanute tugiisikuteenus | <https://sotsiaalkindlustusamet.ee/rahvusvahelise-ja-ajutise-kaitse-saanute-tugiisikuteenus> |
| Sotsiaalkindlustusamet | Rahvusvahelised peresuhted ja lastekaitse: mida peaks lapsevanemad teadma? | <https://www.lasteabi.ee/et/artiklid/rahvusvahelised-peresuhted-ja-lastekaitse-mida-peaks-lapsevanemad-teadma> |
| Sotsiaalkindlustusamet | Ravikindlustus | <https://sotsiaalkindlustusamet.ee/ravikindlustus> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/rehabilitatsiooniteenuse-osutajale> |
| Sotsiaalkindlustusamet | Riigi abikäsi kuriteoohvrile: rahaline hüvitis | <https://www.palunabi.ee/et/artiklid/riigi-abikasi-kuriteoohvrile-rahaline-huvitis> |
| Sotsiaalkindlustusamet | Saatjata alaealise välismaalase toetamine | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/saatjata-alaealise> |
| Sotsiaalkindlustusamet | Safe box | <https://www.lasteabi.ee/et/safe-box> |
| Sotsiaalkindlustusamet | Seksuaalne kägistamine võib ootamatult lõppeda surmaga | <https://www.palunabi.ee/et/artiklid/seksuaalne-kagistamine-voib-ootamatult-loppeda-surmaga> |
| Sotsiaalkindlustusamet | Seksuaalne väärkohtlemine internetis | <https://www.lasteabi.ee/et/seksuaalne-vaarkohtlemine-internetis> |
| Sotsiaalkindlustusamet | Seksuaalne ärakasutamine: mis see on ja kuidas end kaitsta? | <https://www.lasteabi.ee/et/artiklid/seksuaalne-arakasutamine-mis-see-ja-kuidas-end-kaitsta> |
| Sotsiaalkindlustusamet | Seksuaalsus | <https://www.lasteabi.ee/et/seksuaalsus> |
| Sotsiaalkindlustusamet | Seksuaaltervis | <https://www.lasteabi.ee/et/seksuaaltervis-lapsevanem> |
| Sotsiaalkindlustusamet | Sotsiaalkindlustus välismaal ja välismaalt tulijatele | <https://sotsiaalkindlustusamet.ee/perehuvitised-ja-muud-toetused/sotsiaalkindlustus-valismaal-ja-valismaalt-tulijatele-0> |
| Sotsiaalkindlustusamet | Sotsiaalkindlustusameti tasuta e-kursused kõigile | <https://www.lasteabi.ee/et/artiklid/sotsiaalkindlustusameti-tasuta-e-kursused-koigile> |
| Sotsiaalkindlustusamet | Sotsiaalteenuste kvaliteedijuhised | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/sotsiaalteenuste> |
| Sotsiaalkindlustusamet | Sotsiaalteenuste toimepidevus | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/sotsiaalteenuste-toimepidevus> |
| Sotsiaalkindlustusamet | STAR | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/star> |
| Sotsiaalkindlustusamet | Suhtlus lapsega | <https://www.lasteabi.ee/et/suhtlus-lapsega> |
| Sotsiaalkindlustusamet | Suure hooldus- ja abivajadusega lapse hoiu teenuse osutajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/suure-hooldus-ja-abivajadusega-laste-hoidjale> |
| Sotsiaalkindlustusamet | Suure hooldus- ja abivajadusega laste hoiu teenus | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/suure-hooldus-ja> |
| Sotsiaalkindlustusamet | Sõprus | <https://www.lasteabi.ee/et/soprus> |
| Sotsiaalkindlustusamet | Sõprus | <https://www.lasteabi.ee/et/soprus-0> |
| Sotsiaalkindlustusamet | Taastav õigus | <https://sotsiaalkindlustusamet.ee/taastavoigus> |
| Sotsiaalkindlustusamet | Tahad suvel tööd teha? Tea, millised on sinu õigused! | <https://www.lasteabi.ee/et/artiklid/tahad-suvel-tood-teha-tea-millised-sinu-oigused> |
| Sotsiaalkindlustusamet | Teata abivajavast lapsest | <https://www.lasteabi.ee/et/teata-abivajavast-lapsest> |
| Sotsiaalkindlustusamet | Teenuseosutajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale> |
| Sotsiaalkindlustusamet | Tegevused iseenda toetuseks | <https://www.lasteabi.ee/et/tegevused-iseenda-toetuseks> |
| Sotsiaalkindlustusamet | Toimetulekutoetus | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/toimetulekutoetus> |
| Sotsiaalkindlustusamet | Traumast taastumist toetav vaimse tervise abi | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/traumast-taastumist-toetava-vaimse-tervise-abi> |
| Sotsiaalkindlustusamet | Tugigrupi töö korraldajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/teenuseosutajale/tugigrupi-too-korraldajale> |
| Sotsiaalkindlustusamet | Tunded | <https://www.lasteabi.ee/et/tunded> |
| Sotsiaalkindlustusamet | Turvalisus sotsiaalmeedias ja ekraanivaba aeg | <https://www.lasteabi.ee/et/artiklid/turvalisus-sotsiaalmeedias-ja-ekraanivaba-aeg> |
| Sotsiaalkindlustusamet | Turvalisus spordis ja huvihariduses | <https://www.lasteabi.ee/et/artiklid/turvalisus-spordis-ja-huvihariduses> |
| Sotsiaalkindlustusamet | Tõlketeenus rahvusvahelise kaitse saajale | <https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/tolketeenus-rahvusvahelise> |
| Sotsiaalkindlustusamet | Täienda oma teadmisi e-kursusel „Abivajava lapse märkamine ja abistamine“ | <https://www.lasteabi.ee/et/artiklid/taienda-oma-teadmisi-e-kursusel-abivajava-lapse-markamine-ja-abistamine> |
| Sotsiaalkindlustusamet | Tööealise puude raskusastme tuvastamine | <https://sotsiaalkindlustusamet.ee/tooealise-puude-tuvastamine> |
| Sotsiaalkindlustusamet | Tööriistakast | <https://www.lasteabi.ee/et/tooriistakast> |
| Sotsiaalkindlustusamet | Uus ja lihtne viis abivajavast lapsest teatamiseks | <https://www.lasteabi.ee/et/artiklid/uus-ja-lihtne-viis-abivajavast-lapsest-teatamiseks> |
| Sotsiaalkindlustusamet | Uus vaimse tervise toetamise tööriist: safe box | <https://www.lasteabi.ee/et/artiklid/uus-vaimse-tervise-toetamise-tooriist-safe-box> |
| Sotsiaalkindlustusamet | Vabatahtlik töö ohvriabis | <https://www.palunabi.ee/et/vabatahtlik-too-ohvriabis> |
| Sotsiaalkindlustusamet | Vaimne tervis | <https://www.lasteabi.ee/et/vaimne-tervis> |
| Sotsiaalkindlustusamet | Vaimne tervis | <https://www.lasteabi.ee/et/vaimne-tervis-lapsevanem> |
| Sotsiaalkindlustusamet | Vaimse tervise veebinõustamine aitab saada oma elu parimaks eksperdiks | <https://www.palunabi.ee/et/artiklid/vaimse-tervise-veebinoustamine-aitab-saada-oma-elu-parimaks-eksperdiks> |
| Sotsiaalkindlustusamet | Veebimaailm | <https://www.lasteabi.ee/et/veebimaailm> |
| Sotsiaalkindlustusamet | Vikerraadio Reportertund: Koolistressis noor. Kust saab abi? | <https://www.lasteabi.ee/et/artiklid/vikerraadio-reportertund-koolistressis-noor-kust-saab-abi> |
| Sotsiaalkindlustusamet | Vägivald | <https://www.lasteabi.ee/et/vagivald> |
| Sotsiaalkindlustusamet | Vägivald | <https://www.lasteabi.ee/et/vagivald-lapsevanem> |
| Sotsiaalkindlustusamet | Õppimine | <https://www.lasteabi.ee/et/oppimine> |
| Sotsiaalkindlustusamet | Ära lase end ära kasutada – hoidu kuritegevusele meelitamisest | <https://www.lasteabi.ee/et/artiklid/ara-lase-end-ara-kasutada-hoidu-kuritegevusele-meelitamisest> |
| Sotsiaalkindlustusamet | Üheskoos parema interneti nimel: lasteabi toetab noori digimaailmas | <https://www.lasteabi.ee/et/artiklid/uheskoos-parema-interneti-nimel-lasteabi-toetab-noori-digimaailmas> |
| Sotsiaalministeerium | Abivajav laps | <https://www.sm.ee/lapsed-ja-hoolekanne/lapsed-ja-pered/abivajav-laps> |
| Sotsiaalministeerium | Alkohol | <https://www.sm.ee/alkohol> |
| Sotsiaalministeerium | Annetatud toiduabi jagamine | <https://www.sm.ee/annetatud-toiduabi-jagamine> |
| Sotsiaalministeerium | Asendus- ja järelhooldus | <https://www.sm.ee/lapsed-ja-hoolekanne/lapsed-ja-pered/asendus-ja-jarelhooldus> |
| Sotsiaalministeerium | Dementsus: riskitegurid ja ennetamine | <https://www.sm.ee/dementsus-riskitegurid-ja-ennetamine> |
| Sotsiaalministeerium | Erakorraline abi ja kiirabi | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/ravi-ja-tervise-taastamine/erakorraline-abi-ja-kiirabi> |
| Sotsiaalministeerium | Erivajadusega laste tugisüsteemi reform | <https://www.sm.ee/lapsed-ja-hoolekanne/lapsed-ja-pered/erivajadustega-laste-tugisusteem> |
| Sotsiaalministeerium | Hooldereform | <https://www.sm.ee/hooldereform> |
| Sotsiaalministeerium | Hooldereform ja pikaajaline hooldus | <https://www.sm.ee/hooldereform-ja-pikaajaline-hooldus> |
| Sotsiaalministeerium | Inimkaubandus | <https://www.sm.ee/lapsed-ja-hoolekanne/vagivallaennetus-ja-ohvriabi/inimkaubandus> |
| Sotsiaalministeerium | Kohaliku omavalitsuse sotsiaalteenused ja toetused | <https://www.sm.ee/lapsed-ja-hoolekanne/hoolekanne/kohaliku-omavalitsuse-sotsiaalteenused-ja-toetused> |
| Sotsiaalministeerium | Kuidas rääkida dementsusest austavalt ja kaasavalt | <https://www.sm.ee/kuidas-raakida-dementsusest-austavalt-ja-kaasavalt> |
| Sotsiaalministeerium | Lapse õigused ja heaolu | <https://www.sm.ee/lapsed-ja-hoolekanne/lapsed-ja-pered/lapse-oigused-ja-heaolu> |
| Sotsiaalministeerium | Laste ja perede toetamise KKK | <https://www.sm.ee/laste-ja-perede-toetamise-kkk> |
| Sotsiaalministeerium | Lähisuhte- ja naisevastane vägivald | <https://www.sm.ee/lapsed-ja-hoolekanne/vagivallaennetus-ja-ohvriabi/lahisuhte-ja-naisevastane-vagivald> |
| Sotsiaalministeerium | Naistevastane vägivald | <https://www.sm.ee/naistevastane-vagivald> |
| Sotsiaalministeerium | Narkootikumid | <https://www.sm.ee/narkootikumid> |
| Sotsiaalministeerium | Ohvriabi | <https://www.sm.ee/lapsed-ja-hoolekanne/vagivallaennetus-ja-ohvriabi/ohvriabi> |
| Sotsiaalministeerium | Patsiendi elulõpu tahteavalduse korduma kippuvad küsimused | <https://www.sm.ee/patsiendi-elulopu-tahteavalduse-korduma-kippuvad-kusimused> |
| Sotsiaalministeerium | Pereõde ja -arst | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/ravi-ja-tervise-taastamine/pereode-ja-arst> |
| Sotsiaalministeerium | Puudega ja vähenenud töövõimega inimesele | <https://www.sm.ee/puudega-inimesele-1> |
| Sotsiaalministeerium | Puudega laps | <https://www.sm.ee/lapsed-ja-hoolekanne/lapsed-ja-pered/puudega-laps> |
| Sotsiaalministeerium | Puuetega inimeste võrdne kohtlemine | <https://www.sm.ee/puuetega-inimeste-vordne-kohtlemine> |
| Sotsiaalministeerium | Riigi sotsiaalteenused | <https://www.sm.ee/lapsed-ja-hoolekanne/hoolekanne/riigi-sotsiaalteenused> |
| Sotsiaalministeerium | Seksuaalvägivald | <https://www.sm.ee/lapsed-ja-hoolekanne/vagivallaennetus-ja-ohvriabi/seksuaalvagivald> |
| Sotsiaalministeerium | Terminid/juhendid | <https://www.sm.ee/terminidjuhendid> |
| Sotsiaalministeerium | Tervishoid | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/ravi-ja-tervise-taastamine/tervishoid> |
| Sotsiaalministeerium | Toidu annetamine | <https://www.sm.ee/toiduannetamine> |
| Sotsiaalministeerium | Toiduabi | <https://www.sm.ee/lapsed-ja-hoolekanne/abivajajale/toiduabi> |
| Sotsiaalministeerium | Toimetulekutoetus | <https://www.sm.ee/toimetulekutoetus> |
| Sotsiaalministeerium | Töövahendid ja rakendused patsiendile | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/ravi-ja-tervise-taastamine/toovahendid-ja-rakendused-patsiendile> |
| Sotsiaalministeerium | Vaimse tervise abi | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/vaimne-tervis/vaimse-tervise-abi> |
| Sotsiaalministeerium | Vaimse tervise hoidmine | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/vaimne-tervis/vaimse-tervise-hoidmine> |
| Sotsiaalministeerium | Vaimse tervise ja psühhosotsiaalne tugi kriisides | <https://www.sm.ee/tervise-edendamine-ravi-ja-ravimid/vaimne-tervis/vaimse-tervise-ja-psuhhosotsiaalne-tugi-kriisides> |
| Sotsiaalministeerium | Vanemlus ja elu lastega | <https://www.sm.ee/lapsed-ja-hoolekanne/lapsed-ja-pered/vanemlus-ja-elu-lastega> |
| Sotsiaalministeerium | Üldhooldusteenust pakkuvad hoolekandeasutused | <https://www.sm.ee/uldhooldusteenust-pakkuvad-hoolekandeasutused> |
| Tartu Ülikooli Kliinikum | Alkoholitarvitamise häire | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/alkoholitarvitamise-haire/> |
| Tartu Ülikooli Kliinikum | Dementsus | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/dementsus/> |
| Tartu Ülikooli Kliinikum | Depressioon | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/depressioon/> |
| Tartu Ülikooli Kliinikum | Insuldikoordinaator ja teised toetavad teenused insuldipatsientidele | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/insuldikoordinaator-ja-teised-toetavad-teenused-insuldipatsientidele/> |
| Tartu Ülikooli Kliinikum | Koduse enteraalse toitmise teenus | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/koduse-enteraalse-toitmise-teenus/> |
| Tartu Ülikooli Kliinikum | Lamatised | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/lamatised/> |
| Tartu Ülikooli Kliinikum | Omastehooldus | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/omastehooldus/> |
| Tartu Ülikooli Kliinikum | Palliatiivravi ja hospiits | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/palliatiivravi-ja-hospiits/> |
| Tartu Ülikooli Kliinikum | Patsientide külastamine psühhiaatriakliinikus | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/patsientide-kulastamine-psuhhiaatriakliinikus/> |
| Tartu Ülikooli Kliinikum | Püsiv valu | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/pusiv-valu/> |
| Tartu Ülikooli Kliinikum | Rahustisõltuvus | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/rahustisoltuvus/> |
| Tartu Ülikooli Kliinikum | Sotsiaaltöötaja teenus kliinikumis | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/sotsiaaltootaja-teenus-kliinikumis/> |
| Tartu Ülikooli Kliinikum | Vähktõvega patsiendi hingehoidlik toetamine hematoloogia-onkoloogia kliinikus | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/vahktovega-patsiendi-hingehoidlik-toetamine-hematoloogia-onkoloogia-kliinikus/> |
| Tartu Ülikooli Kliinikum | Üldistunud ärevushäire | <https://www.kliinikum.ee/patsiendiinfo-andmebaas/uldistunud-arevushaire/> |
| Tervise Arengu Instituut | 25 põhjust tubakast ja nikotiinist loobumiseks | <https://www.tubakainfo.ee/miks-suitsetamisest-loobuda/25-pohjust-suitsetamisest-loobumiseks/> |
| Tervise Arengu Instituut | Abivõimalused lastele ja noortele | <https://www.narko.ee/abivoimalused-noortele> |
| Tervise Arengu Instituut | Abivõimalused sõjapõgenikele | <https://www.narko.ee/siit-saad-abi/abivoimalused-sojapogenikele> |
| Tervise Arengu Instituut | Ainejäägiga esemete testimise tulemused | <https://www.narko.ee/kogukond/testimine-tulemused> |
| Tervise Arengu Instituut | Ainete segatarvitamisega kaasnevad riskid | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/ainete-segatarvitamisega-kaasnevad-riskid> |
| Tervise Arengu Instituut | Alfa-PVP | <https://www.narko.ee/ained/alfa-pvp> |
| Tervise Arengu Instituut | Alkohol ja energiajoogid | <https://alkoinfo.ee/et/moju/alkoholi-toime/alkohol-ja-energiajoogid> |
| Tervise Arengu Instituut | Alkohol ja illegaalsed uimastid | <https://alkoinfo.ee/et/moju/alkoholi-toime/alkohol-ja-illegaalsed-uimastid> |
| Tervise Arengu Instituut | Alkohol ja ravimid | <https://alkoinfo.ee/et/moju/alkoholi-toime/alkohol-ja-ravimid> |
| Tervise Arengu Instituut | Alkoholi moju tervisele | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele> |
| Tervise Arengu Instituut | Alkoholi toime | <https://alkoinfo.ee/et/moju/alkoholi-toime> |
| Tervise Arengu Instituut | Alkoholimurgistus ja esmaabi | <https://alkoinfo.ee/et/moju/alkoholi-toime/alkoholimurgistus-ja-esmaabi> |
| Tervise Arengu Instituut | Alkoholiprobleeme alalhoidvad motted | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/alkoholiprobleeme-alalhoidvad-motted> |
| Tervise Arengu Instituut | Alkoholist loobumine | <https://alkoinfo.ee/et/kuidas-vahendada/kas-muutuda-kas-vahendada/eesmargi-seadmine/alkoholist-loobumine> |
| Tervise Arengu Instituut | Alkoholiuhik | <https://alkoinfo.ee/et/millal-vahendada/moodukuse-piires/alkoholiuhik> |
| Tervise Arengu Instituut | Alkovabad joogid | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/alkovabad-joogid> |
| Tervise Arengu Instituut | Amfetamiin | <https://www.narko.ee/ained/amfetamiin> |
| Tervise Arengu Instituut | AUDIT test | <https://alkoinfo.ee/et/millal-vahendada/moodukuse-piires/audit-test> |
| Tervise Arengu Instituut | Ayahuasca | <https://www.narko.ee/ained/ayahuasca-caapi-hoasca-vegetal-yage-mihi-dapa> |
| Tervise Arengu Instituut | Bensodiasepiinid (rahustid) | <https://www.narko.ee/ained/bensodiasepiinid> |
| Tervise Arengu Instituut | Binge drinking ehk purjutamine | <https://alkoinfo.ee/et/millal-vahendada/ule-piiride/binge-drinking-ehk-purjutamine> |
| Tervise Arengu Instituut | E-sigaret | <https://www.tubakainfo.ee/mis-on-sigaretis/e-sigaret/> |
| Tervise Arengu Instituut | Eakad | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/eakad> |
| Tervise Arengu Instituut | Eesmargi seadmine | <https://alkoinfo.ee/et/kuidas-vahendada/kas-muutuda-kas-vahendada/eesmargi-seadmine> |
| Tervise Arengu Instituut | Efedriin | <https://www.narko.ee/ained/efedriin> |
| Tervise Arengu Instituut | Ei utlemine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/ei-utlemine> |
| Tervise Arengu Instituut | Enam levinud uimastid noorte seas | <https://www.narko.ee/noored/noorte-seas-enim-levinud-uimastid> |
| Tervise Arengu Instituut | Enesekehtestamine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/enesekehtestamine> |
| Tervise Arengu Instituut | Fentanüül | <https://www.narko.ee/ained/fentanuul> |
| Tervise Arengu Instituut | Fentsüklidiin | <https://www.narko.ee/ained/pcp> |
| Tervise Arengu Instituut | GHB, GBL | <https://www.narko.ee/ained/ghb> |
| Tervise Arengu Instituut | Heroiin | <https://www.narko.ee/ained/heroiin> |
| Tervise Arengu Instituut | Ibogaiin | <https://www.narko.ee/ained/ibogaiin> |
| Tervise Arengu Instituut | Isotonitaseen | <https://www.narko.ee/ained/isotonitaseen> |
| Tervise Arengu Instituut | Joomissoovi taltsutamine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/joomissoovi-taltsutamine> |
| Tervise Arengu Instituut | Kaassõltuvus – mis see on? | <https://www.narko.ee/lahedased/kaassoltuvus-mis-see-on> |
| Tervise Arengu Instituut | Kahjude vähendamise keskused ohutumaks tarvitamiseks | <https://www.narko.ee/siit-saad-abi/kahjude-vahendamise-keskused-ohutumaks-tarvitamiseks> |
| Tervise Arengu Instituut | Kanep, hašiš | <https://www.narko.ee/ained/kanep_marihuaana_hasis> |
| Tervise Arengu Instituut | Kanepi ohutum tarvitamine | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/kuidas-vahendada-kanepitarvitamise-riske/kanepi-ohutum-tarvitamine> |
| Tervise Arengu Instituut | Kas ma peaksin uimastite tarvitamisest loobuma? | <https://www.narko.ee/tarvitajad/kas-ma-peaksin-uimastite-tarvitamisest-loobuma> |
| Tervise Arengu Instituut | Kas muutuda kas vahendada | <https://alkoinfo.ee/et/kuidas-vahendada/kas-muutuda-kas-vahendada> |
| Tervise Arengu Instituut | Kas sul on probleem | <https://alkoinfo.ee/et/millal-vahendada/kas-sul-on-probleem> |
| Tervise Arengu Instituut | Kas uimastite tarvitajad kujutavad endast ohtu? | <https://www.narko.ee/kogukond/kas-uimastite-tarvitajad-kujutavad-endast-ohtu> |
| Tervise Arengu Instituut | Ketamiin | <https://www.narko.ee/ained/ketamiin> |
| Tervise Arengu Instituut | Khat | <https://www.narko.ee/ained/khat> |
| Tervise Arengu Instituut | Kodeiin | <https://www.narko.ee/ained/kodeiin> |
| Tervise Arengu Instituut | Kokaiin | <https://www.narko.ee/ained/kokaiin> |
| Tervise Arengu Instituut | Korduma kippuvad küsimused | <https://www.narko.ee/kogukond/korduma-kippuvad-kusimused> |
| Tervise Arengu Instituut | Kortermaja elanikule | <https://www.tubakainfo.ee/passiivne-suitsetamine/kortermaja-elanikule/> |
| Tervise Arengu Instituut | Kuhu poorduda | <https://alkoinfo.ee/et/kuidas-vahendada/spetsialisti-abi/kuhu-poorduda> |
| Tervise Arengu Instituut | Kuhu pöörduda, et saada abi tubakast loobumiseks? | <https://www.tubakainfo.ee/kontakt/> |
| Tervise Arengu Instituut | Kui lähedane joob | <https://alkoinfo.ee/et/lahedastele> |
| Tervise Arengu Instituut | Kuidas aidata lahedast | <https://alkoinfo.ee/et/lahedastele/kuidas-aidata-lahedast> |
| Tervise Arengu Instituut | Kuidas aru saada, et lähedane tarvitab uimasteid? | <https://www.narko.ee/lahedased/kuidas-aru-saada-et-lahedane-tarvitab-uimasteid> |
| Tervise Arengu Instituut | Kuidas juua vahem | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem> |
| Tervise Arengu Instituut | Kuidas juua vahem kodus | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/kuidas-juua-vahem-kodus> |
| Tervise Arengu Instituut | Kuidas juua vahem valjas | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/kuidas-juua-vahem-valjas> |
| Tervise Arengu Instituut | Kuidas kujuneb alkoholi noiaring | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/kuidas-kujuneb-alkoholi-noiaring> |
| Tervise Arengu Instituut | Kuidas käituda, kui sinu lähedane tarvitab uimasteid? | <https://www.narko.ee/lahedased/kuidas-kaituda-kui-sinu-lahedane-tarvitab-uimasteid> |
| Tervise Arengu Instituut | Kuidas leida motivatsiooni | <https://alkoinfo.ee/et/kuidas-vahendada/kas-muutuda-kas-vahendada/kuidas-leida-motivatsiooni> |
| Tervise Arengu Instituut | Kuidas mõjutab uimastite tarvitamine lähedasi? | <https://www.narko.ee/lahedased/kuidas-mojutab-uimastite-tarvitamine-lahedasi> |
| Tervise Arengu Instituut | Kuidas puhade ajal alkoholiga mitte liialdada | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/kuidas-puhade-ajal-alkoholiga-mitte-liialdada> |
| Tervise Arengu Instituut | Kuidas saab aidata ennast alkoholisoltlase lahedane | <https://alkoinfo.ee/et/lahedastele/kuidas-saab-aidata-ennast-alkoholisoltlase-lahedane> |
| Tervise Arengu Instituut | Kuidas sotsiaalsele survele vastu astuda? | <https://www.narko.ee/noored/kuidas-sotsiaalsele-survele-vastu-astuda> |
| Tervise Arengu Instituut | Kuidas tagasilangust ennetada ja sellega toime tulla | <https://www.narko.ee/tarvitajad/kuidas-uimastitest-tarvitamisest-vabaneda/kuidas-tagasilangust-ennetada-ja-sellega-toime-tulla> |
| Tervise Arengu Instituut | Kuidas teha vahema alkoga pidu | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/kuidas-teha-vahema-alkoga-pidu> |
| Tervise Arengu Instituut | Kuidas teistelt toetust saada | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/kuidas-teistelt-toetust-saada> |
| Tervise Arengu Instituut | Kuidas tõsta kogukonna turvalisust? | <https://www.narko.ee/kogukond/kuidas-tosta-kogukonna-turvalisust> |
| Tervise Arengu Instituut | Kuidas uimastite tarvitamisest hoiduda | <https://www.narko.ee/noored/nippe-uimastitest-hoidumiseks> |
| Tervise Arengu Instituut | Kuidas uimastite tarvitamisest vabaneda | <https://www.narko.ee/tarvitajad/kuidas-uimastitest-tarvitamisest-vabaneda> |
| Tervise Arengu Instituut | Kuidas vähendada GHB tarvitamise riske | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/kuidas-vahendada-ghb-tarvitamise-riske> |
| Tervise Arengu Instituut | Kuidas vähendada hallutsinogeenide tarvitamise riske | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/kuidas-vahendada-hallutsinogeenide-tarvitamise-riske> |
| Tervise Arengu Instituut | Kuidas vähendada kanepitarvitamise riske | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/kuidas-vahendada-kanepitarvitamise-riske> |
| Tervise Arengu Instituut | Kuidas vähendada tarvitamisega kaasnevaid ohte? | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte> |
| Tervise Arengu Instituut | Kuidas vähendada? | <https://alkoinfo.ee/et/kuidas-vahendada> |
| Tervise Arengu Instituut | Kuidas öelda EI? | <https://www.tubakainfo.ee/dr-suits/kuidas-oelda-ei/> |
| Tervise Arengu Instituut | Kuritarvitamine ja soltuvus | <https://alkoinfo.ee/et/millal-vahendada/ule-piiride/kuritarvitamine-ja-soltuvus> |
| Tervise Arengu Instituut | Kust tulevad „narkomaanid”? | <https://www.narko.ee/kogukond> |
| Tervise Arengu Instituut | Kuumutatavad tubakatooted | <https://www.tubakainfo.ee/mis-on-sigaretis/kuumutatavad-tubakatooted/> |
| Tervise Arengu Instituut | Kärbseseen | <https://www.narko.ee/ained/karbseseen> |
| Tervise Arengu Instituut | Liigtarvitamise astmed | <https://alkoinfo.ee/et/millal-vahendada/ule-piiride/liigtarvitamise-astmed> |
| Tervise Arengu Instituut | Loobu tubakast ja nikotiinist | <https://www.tubakainfo.ee/loobu-suitsetamisest/> |
| Tervise Arengu Instituut | Loobumisplaan | <https://www.tubakainfo.ee/loobu-suitsetamisest/loobumisplaan/> |
| Tervise Arengu Instituut | Loogastumine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-sailitamine/loogastumine> |
| Tervise Arengu Instituut | LSD | <https://www.narko.ee/ained/lsd> |
| Tervise Arengu Instituut | Luulusalvei, salvia | <https://www.narko.ee/ained/luulusalvei-salvia> |
| Tervise Arengu Instituut | Lähedane tarvitab uimasteid | <https://www.narko.ee/lahedased/lahedane-tarvitab-uimasteid> |
| Tervise Arengu Instituut | Maksahaigused | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/maksahaigused> |
| Tervise Arengu Instituut | MDMA, ecstasy | <https://www.narko.ee/ained/mdma-ehk-ecstasy> |
| Tervise Arengu Instituut | Meeldivad tegevused | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/meeldivad-tegevused> |
| Tervise Arengu Instituut | Mehed | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/mehed> |
| Tervise Arengu Instituut | Meskaliin | <https://www.narko.ee/ained/meskaliin> |
| Tervise Arengu Instituut | Metamfetamiin | <https://www.narko.ee/ained/metaamfetamiin> |
| Tervise Arengu Instituut | Metüülfenidaat | <https://www.narko.ee/ained/metuulfenidaat> |
| Tervise Arengu Instituut | Mida teha uimastamis- ja mürgistamiskahtluse korral | <https://www.narko.ee/siit-saad-abi/mida-teha-uimastamis-ja-murgistamiskahtluse-korral> |
| Tervise Arengu Instituut | Mida teha, kui kahtlustad, et sind on uimastatud ja oled langenud seksuaalvägivalla ohvriks | <https://www.narko.ee/siit-saad-abi/mida-teha-kui-kahtlustad-et-sind-on-uimastatud-ja-oled-langenud-seksuaalkuriteo-ohvriks> |
| Tervise Arengu Instituut | Mida teha, kui sõber tarvitab uimasteid? | <https://www.narko.ee/noored/mida-teha-kui-sober-tarvitab-uimasteid> |
| Tervise Arengu Instituut | Miks ja kuidas tekib sõltuvus ning miks on raske sellest vabaneda? | <https://www.narko.ee/narkootikumide-moju-kehale/miks-ja-kuidas-tekib-soltuvus-ning-miks-on-raske-sellest-vabaneda> |
| Tervise Arengu Instituut | Miks on uimastid ohtlikud? | <https://www.narko.ee/noored/miks-on-uimastid-ohtlikud> |
| Tervise Arengu Instituut | Miks tubakatoodetest loobuda? | <https://www.tubakainfo.ee/miks-suitsetamisest-loobuda/> |
| Tervise Arengu Instituut | Miks uimasteid proovitakse | <https://www.narko.ee/noored/uimastite-proovimise-pohjused> |
| Tervise Arengu Instituut | Millal poorduda spetsialisti poole | <https://alkoinfo.ee/et/kuidas-vahendada/spetsialisti-abi/millal-poorduda-spetsialisti-poole> |
| Tervise Arengu Instituut | Millal vähendada? | <https://alkoinfo.ee/et/millal-vahendada> |
| Tervise Arengu Instituut | Milles seisneb alkoholitarvitamise haire ravi | <https://alkoinfo.ee/et/kuidas-vahendada/spetsialisti-abi/milles-seisneb-alkoholitarvitamise-haire-ravi> |
| Tervise Arengu Instituut | Mis on uimastid ja kuidas neid liigitatakse? | <https://www.narko.ee/mis-on-uimastid-ja-kuidas-neid-liigitatakse> |
| Tervise Arengu Instituut | Moju elukvaliteedile | <https://alkoinfo.ee/et/moju/moju-elukvaliteedile> |
| Tervise Arengu Instituut | Moju suhtele | <https://alkoinfo.ee/et/moju/moju-elukvaliteedile/moju-suhtele> |
| Tervise Arengu Instituut | Moodukas alkoholi tarvitamine | <https://alkoinfo.ee/et/millal-vahendada/moodukuse-piires/moodukas-alkoholi-tarvitamine> |
| Tervise Arengu Instituut | Moodukuse piires | <https://alkoinfo.ee/et/millal-vahendada/moodukuse-piires> |
| Tervise Arengu Instituut | Morfiin | <https://www.narko.ee/ained/morfiin> |
| Tervise Arengu Instituut | Motivatsiooni sailitamine rajal pusimine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-sailitamine/motivatsiooni-sailitamine-rajal-pusimine> |
| Tervise Arengu Instituut | Muskaatpähkel | <https://www.narko.ee/ained/muskaatpahkel> |
| Tervise Arengu Instituut | Muutused mida markad kiiresti | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/muutused-mida-markad-kiiresti> |
| Tervise Arengu Instituut | Muutuste elluviimine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine> |
| Tervise Arengu Instituut | Muutuste sailitamine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-sailitamine> |
| Tervise Arengu Instituut | Mõju | <https://alkoinfo.ee/et/moju> |
| Tervise Arengu Instituut | Müüdid | <https://www.narko.ee/muudid> |
| Tervise Arengu Instituut | Naised | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/naised> |
| Tervise Arengu Instituut | Narkootikumide mõju ajule | <https://www.narko.ee/narkootikumide-moju-kehale/kuidas-narkootikumid-mojutavad-aju> |
| Tervise Arengu Instituut | Narkootikumide mõju organismile | <https://www.narko.ee/narkootikumide-moju-kehale> |
| Tervise Arengu Instituut | Narkootikumide tarvitamise ennetamine | <https://www.tai.ee/et/tervis-ja-heaolu/narkootikumide-tarvitamise-ennetamine> |
| Tervise Arengu Instituut | Narkootikumidega seotud seadusandlusest Eestis | <https://www.narko.ee/olukord-eestis/eesti-seadusandlus> |
| Tervise Arengu Instituut | Narkootiliste ja psühhotroopsete ainete andmebaas | <https://www.narko.ee/mis-on-uimastid-ja-kuidas-neid-liigitatakse/narkootiliste-ja-psuhhotroopsete-ainete-andmebaas> |
| Tervise Arengu Instituut | Narkosüütegude märkamine ja neist teavitamine | <https://www.narko.ee/kogukond/narkosuutegude-markamine-ja-neist-teavitamine> |
| Tervise Arengu Instituut | Nikotiini võõrutusnähud | <https://www.tubakainfo.ee/loobu-suitsetamisest/nikotiini-voorutusnahud/> |
| Tervise Arengu Instituut | Nikotiinipadi | <https://www.tubakainfo.ee/mis-on-sigaretis/nikotiinipadi/> |
| Tervise Arengu Instituut | Nitaseenid | <https://www.narko.ee/ained/nitaseenid> |
| Tervise Arengu Instituut | Noored | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/noored> |
| Tervise Arengu Instituut | Nõuanded | <https://www.tubakainfo.ee/passiivne-suitsetamine/nouanded/> |
| Tervise Arengu Instituut | Nõuanded festivalikülastajatele | <https://www.narko.ee/tarvitajad/nouanded-festivalikulastajale> |
| Tervise Arengu Instituut | Nõustamisprogramm kanepitarvitajatele (VALIK programm) | <https://www.narko.ee/siit-saad-abi/noustamisprogramm-kanepitarvitajatele> |
| Tervise Arengu Instituut | Ohutum süstimine | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/ohutum-sustimine> |
| Tervise Arengu Instituut | Olukord Eestis | <https://www.narko.ee/olukord-eestis> |
| Tervise Arengu Instituut | Oma mustrite teadvustamine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/oma-mustrite-teadvustamine> |
| Tervise Arengu Instituut | Oopium | <https://www.narko.ee/ained/oopium> |
| Tervise Arengu Instituut | Pankreatiit | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/pankreatiit> |
| Tervise Arengu Instituut | Passiivne suitsetamine | <https://www.tubakainfo.ee/passiivne-suitsetamine/> |
| Tervise Arengu Instituut | Passiivse suitsetamise ja veipimise ohud | <https://www.tubakainfo.ee/passiivne-suitsetamine/passivsed-tubakatooted/> |
| Tervise Arengu Instituut | Plussid miinused | <https://alkoinfo.ee/et/kuidas-vahendada/kas-muutuda-kas-vahendada/plussid-miinused> |
| Tervise Arengu Instituut | Pohmell | <https://alkoinfo.ee/et/moju/alkoholi-toime/pohmell> |
| Tervise Arengu Instituut | Positiivsed muutused | <https://alkoinfo.ee/et/kuidas-vahendada/kas-muutuda-kas-vahendada/plussid-miinused/positiivsed-muutused> |
| Tervise Arengu Instituut | Probleemi tunnused | <https://alkoinfo.ee/et/millal-vahendada/kas-sul-on-probleem/probleemi-tunnused> |
| Tervise Arengu Instituut | Probleemide lahendamine | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/probleemide-lahendamine> |
| Tervise Arengu Instituut | Programm selge | <https://alkoinfo.ee/et/kuidas-vahendada/programm-selge> |
| Tervise Arengu Instituut | Psilotsübiin (maagilised seened) | <https://www.narko.ee/ained/psilotsubiini-ja-psilotsiini-sisaldavad-seened> |
| Tervise Arengu Instituut | Purjusolek ja joobeastmed | <https://alkoinfo.ee/et/moju/alkoholi-toime/purjusolek-ja-joobeastmed> |
| Tervise Arengu Instituut | Raha | <https://alkoinfo.ee/et/moju/moju-elukvaliteedile/raha> |
| Tervise Arengu Instituut | Rasedus ja imetamine | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/naised/rasedus-ja-imetamine> |
| Tervise Arengu Instituut | Riskantsed situatsioonid | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-elluviimine/riskantsed-situatsioonid> |
| Tervise Arengu Instituut | Sekkumised | <https://www.tai.ee/et/valdkonnad/vaimne-tervis/vaimse-tervise-valdkonna-tegevused/sekkumised> |
| Tervise Arengu Instituut | Seks | <https://alkoinfo.ee/et/moju/moju-elukvaliteedile/seks> |
| Tervise Arengu Instituut | Septembris ei joo | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/septembris-ei-joo> |
| Tervise Arengu Instituut | Siit saad abi | <https://www.narko.ee/siit-saad-abi> |
| Tervise Arengu Instituut | Spetsialisti abi | <https://alkoinfo.ee/et/kuidas-vahendada/spetsialisti-abi> |
| Tervise Arengu Instituut | Sport | <https://alkoinfo.ee/et/moju/moju-elukvaliteedile/sport> |
| Tervise Arengu Instituut | Sudame ja veresoonkond | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/sudame-ja-veresoonkond> |
| Tervise Arengu Instituut | Suitsetamine ja veipimine siseruumides ja välisõhus | <https://www.tubakainfo.ee/passiivne-suitsetamine/kodus-autos-oues/> |
| Tervise Arengu Instituut | Suitsetamise mõju elustiilile ja rahakotile | <https://www.tubakainfo.ee/miks-suitsetamisest-loobuda/suitsetamise-moju-elustiilile-ja-raha-kulu/> |
| Tervise Arengu Instituut | Suitsetamise mõju lastele ja rasedatele | <https://www.tubakainfo.ee/passiivne-suitsetamine/suitsetamise-moju-lastele-ja-rasedatele/> |
| Tervise Arengu Instituut | Suitsetatavad tubakatooted | <https://www.tubakainfo.ee/mis-on-sigaretis/suitsetatavad-tubakatooted/> |
| Tervise Arengu Instituut | Suitsuvabad tubakatooted | <https://www.tubakainfo.ee/mis-on-sigaretis/suitsuvabad-tubakatooted/> |
| Tervise Arengu Instituut | Sõltuvuse teke tubakatoodetest | <https://www.tubakainfo.ee/mis-on-sigaretis/suitsetamise-soltuvuse-teke/> |
| Tervise Arengu Instituut | Sõltuvusravi, sh opioidisõltuvuse asendusravi | <https://www.narko.ee/siit-saad-abi/soltuvusravi-sh-opoiodisoltuvuse-asendusravi> |
| Tervise Arengu Instituut | Sünteetilised opioidid – fentanüülid, nitaseenid, orfiinid | <https://www.narko.ee/ained/sunteetilised-opioidid> |
| Tervise Arengu Instituut | Tagasilangused | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-sailitamine/tagasilangused> |
| Tervise Arengu Instituut | Tasuta sotsiaal- ja õigusabi ning tervishoiuteenused ravikindlustamata inimestele | <https://www.narko.ee/siit-saad-abi/tasuta-sotsiaal-ja-oigusabi> |
| Tervise Arengu Instituut | Tee otsus – loobu nikotiinist! | <https://www.tubakainfo.ee/loobu-suitsetamisest/tee-otsus/> |
| Tervise Arengu Instituut | Tolerants | <https://alkoinfo.ee/et/millal-vahendada/ule-piiride/kuritarvitamine-ja-soltuvus/tolerants> |
| Tervise Arengu Instituut | Top 8 põhjust, miks noored narkootikume tarvitavad | <https://www.narko.ee/noored/top-8-pohjust-miks-noored-narkootikume-tarvitavad-2> |
| Tervise Arengu Instituut | Tsüklorfiin, spirokolrfiin | <https://www.narko.ee/ained/tsuklorfiin> |
| Tervise Arengu Instituut | Tubaka ja ravimite koostarvitamise mõju | <https://www.tubakainfo.ee/mis-on-sigaretis/ravimitega-koosmoju/> |
| Tervise Arengu Instituut | Tubakast ja nikotiinist loobumise nõustamine | <https://www.tubakainfo.ee/loobu-suitsetamisest/noustamiskabinetid/> |
| Tervise Arengu Instituut | Tubakatoodete mõju keskkonnale | <https://www.tubakainfo.ee/miks-suitsetamisest-loobuda/suitsetamise-moju-keskkonnale/> |
| Tervise Arengu Instituut | Tubakatoodete mõju tervisele ja välimusele | <https://www.tubakainfo.ee/miks-suitsetamisest-loobuda/suitsetamise-moju-tervisele/> |
| Tervise Arengu Instituut | Tubakatooted | <https://www.tubakainfo.ee/mis-on-sigaretis/> |
| Tervise Arengu Instituut | Uimasteid tarvitajate inimeste häbimärgistamine | <https://www.narko.ee/kogukond/stigmatiseerimine-ja-selle-moju> |
| Tervise Arengu Instituut | Uimastiga kokku puutunud esemete testimine | <https://www.narko.ee/kogukond/testimine> |
| Tervise Arengu Instituut | Uimastite tarvitamise faasid | <https://www.narko.ee/tarvitajad/uimastite-tarvitamise-faasid> |
| Tervise Arengu Instituut | Uimastite tootmisest ja “puhtusest” | <https://www.narko.ee/uimastite-tootmine-nende-puhtus> |
| Tervise Arengu Instituut | Ule piiride | <https://alkoinfo.ee/et/millal-vahendada/ule-piiride> |
| Tervise Arengu Instituut | Ulevaade statistikast | <https://alkoinfo.ee/et/moju/ulevaade-statistikast> |
| Tervise Arengu Instituut | Unehugieen | <https://alkoinfo.ee/et/kuidas-vahendada/muutuste-sailitamine/unehugieen> |
| Tervise Arengu Instituut | Uued psühhoaktiivsed ained | <https://www.narko.ee/ained/uued-psuhhoaktiivsed-ained> |
| Tervise Arengu Instituut | Vahkkasvajad | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/vahkkasvajad> |
| Tervise Arengu Instituut | Vaimne tervis | <https://alkoinfo.ee/et/moju/alkoholi-moju-tervisele/vaimne-tervis> |
| Tervise Arengu Instituut | Vaimse tervise nõustamine | <https://www.narko.ee/siit-saad-abi/vaimse-tervise-noustamine> |
| Tervise Arengu Instituut | Vannisoolad | <https://www.narko.ee/ained/vannisoolad> |
| Tervise Arengu Instituut | Voorutusnahud | <https://alkoinfo.ee/et/millal-vahendada/ule-piiride/kuritarvitamine-ja-soltuvus/voorutusnahud> |
| Tervise Arengu Instituut | Vota alkoholist puhkust | <https://alkoinfo.ee/et/kuidas-vahendada/kuidas-juua-vahem/vota-alkoholist-puhkust> |
| Tervise Arengu Instituut | Ära alusta! | <https://www.tubakainfo.ee/dr-suits/ara-alusta/> |
| Tervise Arengu Instituut | Üledoosi tunnused ja kuidas aidata | <https://www.narko.ee/tarvitajad/kuidas-vahendada-tarvitamisega-kaasnevaid-ohte/uledoosi-tunnused-ja-kuidas-aidata> |
| Tervisekassa | Alkoholi liigtarvitamine – mis see on ja kust saab abi | <https://www.tervisekassa.ee/infomaterjalid/alkoholi-liigtarvitamine-mis-see-ja-kust-saab-abi> |
| Tervisekassa | Taastusravi | <https://www.tervisekassa.ee/taastusravi> |
| Tervisekassa | Õendusabi | <https://www.tervisekassa.ee/oendusabi> |
| Tervisekassa | Õendusabi hoolekandes | <https://www.tervisekassa.ee/oendusabi-hoolekandes> |
| Tervisekassa | Õendusabi hoolekandes | <https://www.tervisekassa.ee/kkk/oendusabi-hoolekandes> |
| Terviseportaal | Arstiabi | <https://www.terviseportaal.ee/arstiabi> |
| Terviseportaal | Arstiabi ooteajad | <https://www.terviseportaal.ee/arstiabi/arstiabi-ooteajad> |
| Terviseportaal | Eriarstiabi | <https://www.terviseportaal.ee/arstiabi/eriarstiabi> |
| Terviseportaal | Haigushüvitis | <https://www.terviseportaal.ee/huvitised/haigushuvitis> |
| Terviseportaal | Hooldushüvitis | <https://www.terviseportaal.ee/huvitised/hooldushuvitis> |
| Terviseportaal | Hooldusteenus ja hooldekodud | <https://www.terviseportaal.ee/arstiabi/oendusabi/hooldusteenus> |
| Terviseportaal | Hüvitiste võrdlus | <https://www.terviseportaal.ee/huvitised/huvitiste-vordlus> |
| Terviseportaal | Inimene, kelle eest ei maksta sotsiaalmaksu | <https://www.terviseportaal.ee/ravikindlustus/inimene-kelle-eest-ei-maksta-sotsiaalmaksu> |
| Terviseportaal | Inimene, kelle eest makstakse sotsiaalmaksu | <https://www.terviseportaal.ee/ravikindlustus/inimesed-kelle-eest-makstakse-sotsmaksu> |
| Terviseportaal | Kaugteenused eriarstiabis | <https://www.terviseportaal.ee/arstiabi/eriarstiabi/kaugteenused-eriarstiabis> |
| Terviseportaal | Kuhu oma tervisemurega pöörduda | <https://www.terviseportaal.ee/arstiabi/tervisemure> |
| Terviseportaal | Meeleoluhäired ja depressioon | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis/depressioon> |
| Terviseportaal | Perearstiabi | <https://www.terviseportaal.ee/arstiabi/perearstiabi> |
| Terviseportaal | Ravijärjekorrad | <https://www.terviseportaal.ee/arstiabi/arstiabi-ooteajad/ravijarjekorrad> |
| Terviseportaal | Ravikindlustus | <https://www.terviseportaal.ee/ravikindlustus> |
| Terviseportaal | Sinu ohutus on tähtis | <https://www.terviseportaal.ee/arstiabi/sinu-ohutus-on-tahtis> |
| Terviseportaal | Spetsialistid ja abivõimalused | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis/spetsialistid-ja-abivimalused> |
| Terviseportaal | Sõltuvushäired | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis/soltuvushaired> |
| Terviseportaal | Söömishäired | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis/soomishaired> |
| Terviseportaal | Taastusravi | <https://www.terviseportaal.ee/arstiabi/eriarstiabi/taastusravi> |
| Terviseportaal | Teenustasud ja omaosalus | <https://www.terviseportaal.ee/arstiabi/teenustasud-ja-omaosalus> |
| Terviseportaal | Tervishoiuspetsialist | <https://www.terviseportaal.ee/arstiabi/tervishoiuspetsialist> |
| Terviseportaal | Tunnetushäired | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis/tunnetushired> |
| Terviseportaal | Töötamine pika haiguslehe ajal | <https://www.terviseportaal.ee/pikkhaigusleht> |
| Terviseportaal | Töötav inimene | <https://www.terviseportaal.ee/ravikindlustus/ttav-inimene> |
| Terviseportaal | Vabatahtlik kindlustus | <https://www.terviseportaal.ee/ravikindlustus/vabatahtlik-kindlustus> |
| Terviseportaal | Vaimne tervis | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis> |
| Terviseportaal | Õendusabi | <https://www.terviseportaal.ee/arstiabi/oendusabi> |
| Terviseportaal | Ärevushäired | <https://www.terviseportaal.ee/arstiabi/vaimne-tervis/arevushaire> |
| Tööinspektsioon | Ajateenija ja reservväelane | <https://www.tooelu.ee/et/53/ajateenija-ja-reservvaelane> |
| Tööinspektsioon | Alaealise töö- ja puhkeaeg | <https://www.tooelu.ee/et/56/alaealise-too-ja-puhkeaeg> |
| Tööinspektsioon | Alaealise töölevõtmine | <https://www.tooelu.ee/et/54/alaealise-toolevotmine> |
| Tööinspektsioon | Alaealistele sobivad ja mittesobivad tööd | <https://www.tooelu.ee/et/55/alaealistele-sobivad-ja-mittesobivad-tood> |
| Tööinspektsioon | Alla 7-aastaste laste töötamine | <https://www.tooelu.ee/et/1773/alla-7-aastaste-laste-tootamine> |
| Tööinspektsioon | Ametiühingud | <https://www.tooelu.ee/et/49/ametiuhingud> |
| Tööinspektsioon | Euroopa Liidust Eestisse | <https://www.tooelu.ee/et/41/euroopa-liidust-eestisse> |
| Tööinspektsioon | Head töösuhted | <https://www.tooelu.ee/et/65/head-toosuhted> |
| Tööinspektsioon | Hoiatus | <https://www.tooelu.ee/et/32/hoiatus> |
| Tööinspektsioon | Iseenda toetamiseks | <https://www.tooelu.ee/et/314/iseenda-toetamiseks> |
| Tööinspektsioon | Iseseisva otsustuspädevusega töötaja | <https://www.tooelu.ee/et/842/iseseisva-otsustuspadevusega-tootaja> |
| Tööinspektsioon | Kahju hüvitamine | <https://www.tooelu.ee/et/61/kahju-huvitamine> |
| Tööinspektsioon | Kahju hüvitamine tööõnnetuse korral | <https://www.tooelu.ee/et/118/kahju-huvitamine-tooonnetuse-korral> |
| Tööinspektsioon | Katseaeg | <https://www.tooelu.ee/et/13/katseaeg> |
| Tööinspektsioon | Keskmise töötasu arvutamine | <https://www.tooelu.ee/et/176/keskmise-tootasu-arvutamine> |
| Tööinspektsioon | Koolituskulude hüvitamise kokkulepe | <https://www.tooelu.ee/et/799/koolituskulude-huvitamise-kokkulepe> |
| Tööinspektsioon | Kui tööl juhtus õnnetus | <https://www.tooelu.ee/et/116/kui-tool-juhtus-onnetus> |
| Tööinspektsioon | Kutsehaigused ja tööst põhjustatud haigestumised | <https://www.tooelu.ee/et/901/kutsehaigused-ja-toost-pohjustatud-haigestumised> |
| Tööinspektsioon | Käsundusleping | <https://www.tooelu.ee/et/1443/kasundusleping> |
| Tööinspektsioon | Käsunduslepingu sõlmimine alaealisega | <https://www.tooelu.ee/et/1772/kasunduslepingu-solmimine-alaealisega> |
| Tööinspektsioon | Lepingueelsed läbirääkimised | <https://www.tooelu.ee/et/11/lepingueelsed-labiraakimised> |
| Tööinspektsioon | Lõpparve | <https://www.tooelu.ee/et/33/lopparve> |
| Tööinspektsioon | Meeskonna toetamiseks | <https://www.tooelu.ee/et/315/meeskonna-toetamiseks> |
| Tööinspektsioon | Mis on kaugtöö? Millal võib kaugtööd teha? | <https://www.tooelu.ee/et/34/mis-kaugtoo-millal-voib-kaugtood-teha> |
| Tööinspektsioon | Mis on tööõnnetus? | <https://www.tooelu.ee/et/115/mis-tooonnetus> |
| Tööinspektsioon | Muud tasud ja hüved | <https://www.tooelu.ee/et/174/muud-tasud-ja-huved> |
| Tööinspektsioon | Paindliku tööaja kokkulepe | <https://www.tooelu.ee/et/1642/paindliku-tooaja-kokkulepe> |
| Tööinspektsioon | Praktika | <https://www.tooelu.ee/et/39/praktika> |
| Tööinspektsioon | Proovipäev | <https://www.tooelu.ee/et/10/proovipaev> |
| Tööinspektsioon | Psühhosotsiaalsed ohutegurid | <https://www.tooelu.ee/et/67/psuhhosotsiaalsed-ohutegurid> |
| Tööinspektsioon | Puhkeaeg | <https://www.tooelu.ee/et/25/puhkeaeg> |
| Tööinspektsioon | Puhkuse ajakava | <https://www.tooelu.ee/et/27/puhkuse-ajakava> |
| Tööinspektsioon | Puhkuse liigid | <https://www.tooelu.ee/et/26/puhkuse-liigid> |
| Tööinspektsioon | Puhkused lapsevanematele | <https://www.tooelu.ee/et/63/puhkused-lapsevanematele> |
| Tööinspektsioon | Puhkusetasu | <https://www.tooelu.ee/et/28/puhkusetasu> |
| Tööinspektsioon | Renditöö ja töövahendus | <https://www.tooelu.ee/et/40/renditoo-ja-toovahendus> |
| Tööinspektsioon | Saladus ja konkurents | <https://www.tooelu.ee/et/52/saladus-ja-konkurents> |
| Tööinspektsioon | Tööaeg | <https://www.tooelu.ee/et/24/tooaeg> |
| Tööinspektsioon | Tööalane kiusamine | <https://www.tooelu.ee/et/66/tooalane-kiusamine> |
| Tööinspektsioon | Tööalane ärakasutamine | <https://www.tooelu.ee/et/292/tooalane-arakasutamine> |
| Tööinspektsioon | Töökorraldus | <https://www.tooelu.ee/et/8/tookorraldus> |
| Tööinspektsioon | Töölepingu lõppemine | <https://www.tooelu.ee/et/29/toolepingu-loppemine> |
| Tööinspektsioon | Töölepingu lõppemine poolte kokkuleppel | <https://www.tooelu.ee/et/30/toolepingu-loppemine-poolte-kokkuleppel> |
| Tööinspektsioon | Töölepingu muutmine | <https://www.tooelu.ee/et/14/toolepingu-muutmine> |
| Tööinspektsioon | Töölepingu sõlmimine | <https://www.tooelu.ee/et/7/toolepingu-solmimine> |
| Tööinspektsioon | Töölepingu ühepoolne lõpetamine | <https://www.tooelu.ee/et/31/toolepingu-uhepoolne-lopetamine> |
| Tööinspektsioon | Tööstress ja läbipõlemine | <https://www.tooelu.ee/et/68/toostress-ja-labipolemine> |
| Tööinspektsioon | Töötaja privaatsus | <https://www.tooelu.ee/et/69/tootaja-privaatsus> |
| Tööinspektsioon | Töötamine haiguslehe alusel | <https://www.tooelu.ee/et/1229/tootamine-haiguslehe-alusel> |
| Tööinspektsioon | Töötamine pere heaks | <https://www.tooelu.ee/et/37/tootamine-pere-heaks> |
| Tööinspektsioon | Töötamine raseduse ajal | <https://www.tooelu.ee/et/62/tootamine-raseduse-ajal> |
| Tööinspektsioon | Töötamise registreerimine | <https://www.tooelu.ee/et/12/tootamise-registreerimine> |
| Tööinspektsioon | Töötasu | <https://www.tooelu.ee/et/175/tootasu> |
| Tööinspektsioon | Töötukassa teenused | <https://www.tooelu.ee/et/171/tootukassa-teenused> |
| Tööinspektsioon | Töövaidlused | <https://www.tooelu.ee/et/58/toovaidlused> |
| Tööinspektsioon | Töövõtuleping | <https://www.tooelu.ee/et/1442/toovotuleping> |
| Tööinspektsioon | Tüüptingimustega tööleping | <https://www.tooelu.ee/et/9/tuuptingimustega-tooleping> |
| Tööinspektsioon | Ukraina sõjapõgenikud ja töösuhted | <https://www.tooelu.ee/et/392/ukraina-sojapogenikud-ja-toosuhted> |
| Tööinspektsioon | Usaldusisik | <https://www.tooelu.ee/et/48/usaldusisik> |
| Tööinspektsioon | Vabatahtlik töö | <https://www.tooelu.ee/et/38/vabatahtlik-too> |
| Tööinspektsioon | Vaimse tervise esmaabikapp | <https://www.tooelu.ee/et/307/vaimse-tervise-esmaabikapp> |
| Tööinspektsioon | Võrdne kohtlemine | <https://www.tooelu.ee/et/36/vordne-kohtlemine> |
| Tööinspektsioon | Välismaise tööandja juurde tööle minek | <https://www.tooelu.ee/et/47/valismaise-tooandja-juurde-toole-minek> |
| Tööinspektsioon | Väljaspoolt Euroopa Liitu Eestisse | <https://www.tooelu.ee/et/42/valjaspoolt-euroopa-liitu-eestisse> |
| Tööinspektsioon | Ümbrikupalk | <https://www.tooelu.ee/et/20/umbrikupalk> |
| Vanglateenistus | Avavangla | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/vabanemiseks-valmistumine/mis-avavangla> |
| Vanglateenistus | Elektrooniline valve | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/kriminaalhooldus/elektrooniline-valve> |
| Vanglateenistus | Ettevalmistused vabanemiseks | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/vabanemiseks-valmistumine/ettevalmistused-vabanemiseks> |
| Vanglateenistus | Helistamine | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/koned-ja-kokkusaamised-kinnipeetavaga/telefonikoned> |
| Vanglateenistus | Huvitegevused vanglas | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/eneseteostus-vanglas/huvitegevused-vanglas> |
| Vanglateenistus | Igapäevaelu vanglas | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/vanglas-elamine/igapaevaelu-vanglas> |
| Vanglateenistus | Kahjumaksed kannatanule | <https://vanglateenistus.ee/abiks-kannatanule/praktiline-nou/kahjumaksed-kannatanule> |
| Vanglateenistus | Kinnipeetava kaebeõigus | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/kinnipeetava-oigused/kinnipeetava-kaebeoigus> |
| Vanglateenistus | Kirja saatmine | <https://vanglateenistus.ee/karistuse-kandmine-vanglas/suhtlemine-kinnipeetavaga/kirjavahetus-ja-pakid> |
| Vanglateenistus | Kohtumine advokaadi, notari või esindajaga | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/kinnipeetava-oigused/kohtumine-advokaadi-notari-voi-esindajaga> |
| Vanglateenistus | Kui karistust kandva inimese käitumine teeb muret | <https://vanglateenistus.ee/abiks-kannatanule/praktiline-nou/kui-karistust-kandva-inimese-kaitumine-teeb-muret> |
| Vanglateenistus | Kui kinnipeetav vabaneb | <https://vanglateenistus.ee/abiks-kannatanule/karistuse-kandmine/kui-kinnipeetav-vabaneb> |
| Vanglateenistus | Kui lähedane on kriminaalhooldusalune | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/vangistus-lahedase-seisukohast/kui-lahedane-kriminaalhooldusalune> |
| Vanglateenistus | Kui lähedane on vanglas | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/vangistus-lahedase-seisukohast/kui-lahedane-vanglas> |
| Vanglateenistus | Kuidas lapsega rääkida | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/vangistus-lahedase-seisukohast/kuidas-raakida-lapsega-vangistusest> |
| Vanglateenistus | Kust saavad lähedased infot | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/vangistus-lahedase-seisukohast/kust-saavad-lahedased-infot> |
| Vanglateenistus | Lapsevanema vangistus | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/vangistus-lahedase-seisukohast/lapsevanema-vangistus> |
| Vanglateenistus | Lubatud ja keelatud esemed vanglas | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/vanglas-elamine/lubatud-ja-keelatud-esemed-vanglas> |
| Vanglateenistus | Lühiajaline kokkusaamine | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/koned-ja-kokkusaamised-kinnipeetavaga/luhiajaline-kokkusaamine> |
| Vanglateenistus | Lühiajaline väljasõit | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/koned-ja-kokkusaamised-kinnipeetavaga/luhiajaline-valjasoit> |
| Vanglateenistus | Milles seisneb karistuse kandmine | <https://vanglateenistus.ee/abiks-kannatanule/karistuse-kandmine/milles-seisneb-karistuse-kandmine> |
| Vanglateenistus | Mis on kriminaalhooldus? | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/kriminaalhooldus/mis-kriminaalhooldus> |
| Vanglateenistus | Paki saatmine | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/saadetised-kinnipeetavale/paki-saatmine> |
| Vanglateenistus | Pikaajaline kokkusaamine | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/koned-ja-kokkusaamised-kinnipeetavaga/pikaajaline-kokkusaamine> |
| Vanglateenistus | Raha saatmine | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/saadetised-kinnipeetavale/raha-saatmine> |
| Vanglateenistus | Riskihindamine ja hoolduskava | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/kriminaalhooldus/riskihindamine-ja-hoolduskava> |
| Vanglateenistus | Riskihindamine ja individuaalne täitmiskava | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/vanglas-elamine/riskihindamine-ja-individuaalne-taitmiskava> |
| Vanglateenistus | Tervishoiuteenused vanglas | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/vanglas-elamine/tervishoiuteenused-vanglas> |
| Vanglateenistus | Tingimisi ennetähtaegne vabastamine | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/vabanemiseks-valmistumine/ennetahtaegne-vabanemine> |
| Vanglateenistus | Turvalise koostöö raamistik (TUKO) | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/kriminaalhooldus/turvalise-koostoo-raamistik> |
| Vanglateenistus | Töötamine vanglas | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/eneseteostus-vanglas/tootamine-vanglas> |
| Vanglateenistus | Vabanemise teekond | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/vabanemiseks-valmistumine/vabanemise-teekond> |
| Vanglateenistus | Vabatahtlike töö vanglas | <https://vanglateenistus.ee/koostoopartnerile-ja-vabatahtlikule/uldkasulik-too-ja-vabatahtlik-too/vabatahtlike-too-vanglas> |
| Vanglateenistus | Vangistuse etapid | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/vanglas-elamine/vangistuse-etapid> |
| Vanglateenistus | Vangistuseks valmistumine | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/vanglas-elamine/vangistuseks-valmistumine> |
| Vanglateenistus | Videokohtumine | <https://vanglateenistus.ee/abiks-kinnipeetava-lahedastele/koned-ja-kokkusaamised-kinnipeetavaga/videokohtumised> |
| Vanglateenistus | Õppimine vanglas | <https://vanglateenistus.ee/vanglasse-saabumine-ja-elu-vanglas/eneseteostus-vanglas/oppimine-vanglas> |
| Vanglateenistus | Üldkasulik töö | <https://vanglateenistus.ee/vabanemine-ja-kriminaalhooldus/kriminaalhooldus/uldkasulik-too> |
| Vanglateenistus | Üldkasuliku töö partnerile | <https://vanglateenistus.ee/koostoopartnerile-ja-vabatahtlikule/uldkasulik-too-ja-vabatahtlik-too/uldkasuliku-too-partnerile> |

### Uuringud ja juhendid väljaandja ametlikult aadressilt (264)

| Väljaandja | Pealkiri | Aadress |
|---|---|---|
| Arenguseire Keskus | Huvihariduse kättesaadavus Eestis | <https://arenguseire.ee/wp-content/uploads/2025/01/ask_huvihariduse_ka%CC%88ttesaadavus_eestis_a4.pdf> |
| Arenguseire Keskus | Laste heaolu tulevik | <https://arenguseire.ee/wp-content/uploads/2022/04/2022_pikksilm_laste-heaolu_artikkel.pdf> |
| Arenguseire Keskus | Noorte iseseisvus ja otsustusõigus Eestis. Trendid ja stsenaariumid aastani 2050 | <https://arenguseire.ee/wp-content/uploads/2026/06/2026_noorte-iseseisvus-ja-otsustusoigus-eestis_uuring.pdf> |
| Arenguseire Keskus | Noortega seotud riskid ja kaitse sotsiaalmeedias | <https://arenguseire.ee/wp-content/uploads/2026/04/ask_lr-11_noortega-seotud-riskid-ja-kaitse-sotsiaalmeedias_parandatud.pdf> |
| Arenguseire Keskus | Usaldus institutsioonide vastu lähisuhtevägivalla olukordades | <https://arenguseire.ee/wp-content/uploads/2026/03/ask_lr-9_usaldus-institutsioonide-vastu-lsv-olukordades.pdf> |
| Arenguseire Keskus | Vanemaealiste rahalise heaolu stsenaariumid Eestis aastani 2050 | <https://arenguseire.ee/wp-content/uploads/2021/03/arenguseire_keskus_rahaline_heaolu_stsenaariumid-1.pdf> |
| Astangu Kutserehabilitatsiooni Keskus | Juhendmaterjal õpilaste vastuvõtuprotsessi korraldamiseks kutseõppeasutuses | <https://s3-web-1a.tehik.ee/astangu-live-web-prd/s3fs-public/media/Juhendmaterjal%20%C3%B5pilaste%20vastuv%C3%B5tuprotsessi%20korraldamiseks%20kutse%C3%B5ppeasutuses.pdf> |
| Astangu Kutserehabilitatsiooni Keskus | Õppija toevajaduse märkamine ja õppija toetamine kutsekoolis | <https://s3-web-1a.tehik.ee/astangu-live-web-prd/s3fs-public/media/Juhendmaterjal%20-%20oppija%20toevajaduse%20m%C3%A4rkamine%20ja%20oppija%20toetamine%20kutsekoolis.pdf> |
| Balti Uuringute Instituut | Huvihariduse valdkonna töötajaskonna töötingimused. Miniuuring | <https://api.hp.edu.ee/sites/default/files/2024-11/Huvihariduse%20miniuuringu%20aruanne%20BUI2024.pdf> |
| Balti Uuringute Instituut | Kodanikuühiskonna arengukava mõjude vahehindamine | <https://www.ibs.ee/wp-content/uploads/2022/01/2019_kodanikuuhiskonna_arengukava_mojude_vahehindamine.pdf> |
| CALM-EY | Kliimaärevusega toimetuleku käsiraamat noortele ja noorsootöötajatele | <https://calm-ey.eu/wp-content/uploads/2025/07/calmey-handbook-EST_WEB.pdf> |
| Dementsuse Kompetentsikeskus | Hoolekandeasutuses dementsusega inimeste füüsilise keskkonna kohandamise ekspertanalüüs | <https://dementsus.ee/wp-content/uploads/2024/04/Ekspertanalyys_fyysilise_keskkonna_kohandamiseks_EluDementsusega2018.pdf> |
| Dementsuse Kompetentsikeskus | Soovitused dementsusega pereliikme hoolduseks | <https://dementsus.ee/wp-content/uploads/2022/04/Raamat-U.-Linnamagi-M.-Varik-Alzheimeri-tobi-sinu-lahedasel-eesti-keeles.pdf> |
| Dementsuse Kompetentsikeskus | Soovitusi vaimse tervise hoidmiseks väärikas eas | <https://dementsus.ee/wp-content/uploads/2025/04/DKK_Vaimne_tervise_A5_Web_uus.pdf> |
| Dementsuse Kompetentsikeskus | Vabalt ja väärikalt | <https://dementsus.ee/wp-content/uploads/2025/08/Vabalt_vaarikalt_180x250mm_Final_Web_04.07.pdf> |
| Eesti Arst | Empaatia, emotsioonide regulatsiooni ja kaastunde seosed tervishoiutöötajate kaastundeväsimusega | <https://ojs.utlib.ee/index.php/EA/article/download/29713/22958/46846> |
| Eesti Pimedate Liit | Minu enda elu. Nägemispuudega iseseisvasse ellu. Juhendmaterjal nägemispuudega noortele ja hiljuti nägemise kaotanutele | <https://pimedateliit.ee/wp-content/uploads/2022/05/Juhendmaterjal-2022_A45.pdf> |
| Eesti Puuetega Inimeste Koda | Elu erilise lapsega – toimetulek ja vajadused. Uuringu raport | <https://www.epikoda.ee/wp-content/uploads/2018/09/Elu_erilise_lapsega_toimetulek_ja_vajadused_uuringu_kokkuvote.pdf> |
| Eesti Puuetega Inimeste Koda | Puuetega inimeste eluolu Eestis. ÜRO puuetega inimeste õiguste konventsiooni täitmise variraport | <https://epikoda.ee/wp-content/uploads/2025/09/EPIK_variraport_webi.pdf> |
| Eesti Rakendusuuringute Keskus Centar | Tööga seotud sotsiaalkaitsemudelid ja nende sobivus alternatiivsete tööturuarengute korral | <https://centar.ee/pdf/ee/2018_Tooga_seotud_sotsiaalkaitse_mudelid_ja_nende_sobivus_alternatiivsete_tooturuarengute_korral_Eestis.pdf> |
| Eesti Sotsiaaltöö Assotsiatsioon | Sotsiaalvaldkonna töötaja eetikakoodeks | <https://www.eswa.ee/wp-content/uploads/2026/05/sotsiaalvaldkonna-tootaja-koodeks.pdf> |
| Haridus- ja Noorteamet | Noorteinfo käsiraamat | <https://www.teeviit.ee/wp-content/uploads/2025/10/noorteinfo-kasiraamat-2025-1.pdf> |
| Haridus- ja Teadusministeerium | 19–26aastaste noorte noorsootöös osalemise motivatsioon | <https://www.hm.ee/sites/default/files/documents/2022-10/19-26_osalemine_noorsootoos.pdf> |
| Haridus- ja Teadusministeerium | Eesti noortevaldkonna töötajaskonna töötingimused | <https://www.hm.ee/sites/default/files/documents/2024-01/Eesti%20noortevaldkonna%20to%CC%88o%CC%88tajaskonna%20to%CC%88o%CC%88tingimused_2.pdf> |
| Haridus- ja Teadusministeerium | Haprad ühendusteed: õpirajad ja töölerakendumine madalamate tasemete kutseõppes | <https://www.hm.ee/sites/default/files/documents/2026-06/Madalamate%20tasemete%20kutseo%CC%83ppe%20uuring_Praxis_2026_0.pdf> |
| Justiits- ja Digiministeerium | Eesti riiklik suunamismehhanism inimkaubanduse ohvri abistamiseks | <https://www.justdigi.ee/sites/default/files/documents/2026-04/RSM_EST_0.pdf> |
| Justiits- ja Digiministeerium | Eestkoste kohtupsühhiaatriliste ekspertiiside õiguslik analüüs | <https://www.justdigi.ee/sites/default/files/documents/2026-01/Eestkoste%20kohtups%C3%BChhiaatriliste%20ekspertiiside%20%C3%B5iguslik%20anal%C3%BC%C3%BCs.pdf> |
| Justiits- ja Digiministeerium | Ennast või teisi kahjustava seksuaalkäitumisega noorte mõjutamine kriminaaljustiitssüsteemis | <https://www.justdigi.ee/sites/default/files/documents/2022-10/Ennast%20v%c3%b5i%20teisi%20kahjustava%20seksuaalk%c3%a4itumisega%20noorte%20m%c3%b5jutamine%20kriminaaljustiitss%c3%bcsteemis_l%c3%b5pparuanne%202022.pdf> |
| Justiits- ja Digiministeerium | Karistuse mõju. Õigusrikkuja vaade | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/karistuse_moju_loppraport_05.07.pdf> |
| Justiits- ja Digiministeerium | Kuriteoohvrite kaitse ja kohtlemise uuring | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/kuriteoohvrite_kaitse_ja_kohtlemine_pikk_aruanne_0.pdf> |
| Justiits- ja Digiministeerium | Laps perevägivalla pealtnägijana | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/laps_perevagivalla_pealtnagijana_lopparuanne_isbn.pdf> |
| Justiits- ja Digiministeerium | Radikaliseerumise varajane märkamine ja võrgustikutöö. Käsiraamat kohalikele omavalitsustele | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/radikaliseerumine_kov_.pdf> |
| Justiits- ja Digiministeerium | Taasühiskonnastamise tõhustamine | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/taasyhisk_analyys_2022vormil.pdf> |
| Justiits- ja Digiministeerium | Tugiteenus vanglast vabanejatele toetuse andmise tingimuste 2017. aasta vahehindamise aruanne | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/tat_tugiteenus_vanglast_vabanejatele_2017_aasta_vahehindamise_aruanne_1.pdf> |
| Justiits- ja Digiministeerium | Vanemaealiste kuriteoohvrite analüüs | <https://www.justdigi.ee/sites/default/files/documents/2023-09/Vanemaealiste%20kuriteoohvrite%20anal%c3%bc%c3%bcs_l%c3%b5plik.pdf> |
| Justiits- ja Digiministeerium | Vanglate sisekliima uuring | <https://www.kriminaalpoliitika.ee/sites/krimipoliitika/files/elfinder/dokumendid/vanglate_sisekliima_uuring_sugis_2018.pdf> |
| Kantar Emor | Laste internetikasutus ning võimalused internetis toimuva laste seksuaalse väärkohtlemise ennetamiseks | <https://www.emor.ee/wp-content/uploads/2024/04/lopparuanne-ppa-laste-ja-noorte-uuring.pdf> |
| Kuldne Liiga | Vanusesõbralikkuse hindamisvahend ja juhend | <https://liiga.ee/wp-content/uploads/2024/06/Vanusesobralikkuse-hindamisvahend-ja-juhendmaterjal_loplik.pdf> |
| Kuldne Liiga | Vanusesõbraliku ühiskonna põhimõtted Euroopa Liidus, Eestis, Soomes ja Jaapanis | <https://liiga.ee/wp-content/uploads/2022/12/RAKE-_-Vanusesobralik-uhiskond_aruanne_20221124.pdf> |
| Kuldne Liiga | Üks vanem mees | <https://liiga.ee/wp-content/uploads/2024/05/UVM_raport_LOPLIK_29.04.2024_.pdf> |
| Kuldne Liiga | Üksilduse tajumine Eestis | <https://liiga.ee/wp-content/uploads/2022/11/Yksildus2022.Jututaja.TLY_.pdf> |
| Lastekaitse Liit | Laste osaluse toetamine ja kaasamine otsustusprotsessides | <https://arhiiv.lastekaitseliit.ee/wp-content/uploads/2015/10/Laste-osalus-ja-kaasamine-otsustusprotsessidesse.pdf> |
| Lastekaitse Liit | Noorte elukvaliteet Baltimaades. Uuringuaruanne Eesti tulemustest | <https://arhiiv.lastekaitseliit.ee/wp-content/uploads/2019/03/Noorte-elukvaliteedi-uuring-Eesti-2018a.pdf> |
| Maailma Terviseorganisatsioon | Kuidas stressiga toime tulla | <https://iris.who.int/server/api/core/bitstreams/40b1e4ee-e4c3-4e62-8c1c-14514070b9f8/content> |
| Majandus- ja Kommunikatsiooniministeerium | Meeste väikse osakaalu põhjused hariduse, tervise ja heaolu valdkonna õppurite ja töötajate hulgas | <https://mkm.ee/sites/default/files/documents/2024-11/EHW%20L%C3%95PPRAPORT%202024.pdf> |
| Majandus- ja Kommunikatsiooniministeerium | Tööst põhjustatud haiguste ja kutsehaiguste diagnoosimine ja töötamisega seotud tervisekahjude hüvitamine | <https://www.mkm.ee/sites/default/files/documents/2026-05/L%C3%B5ppraport%20.pdf> |
| Mõttekoda Praxis | 8–12-aastaste käitumishäiretega laste vanematele suunatud ennetustegevuste võrdlev analüüs | <https://www.praxis.ee/uploads/2025/02/Ennetustegevuste_v%C3%B5rdlev_anal%C3%BC%C3%BCs-L%C3%B5ppraport.pdf> |
| Mõttekoda Praxis | Abisaaja ja tema lähedaste kaasamine meditsiini- ja hoolduse integreeritud teenuse pakkumisel | <https://www.praxis.ee/uploads/2015/08/Kokkuvo%cc%83te-abisaaja-ja-tema-la%cc%88hedaste-kaasamisest.pdf> |
| Mõttekoda Praxis | Ajutise töötamise mõju töötuna arvelolijate tööturukäitumisele ja majanduslikule toimetulekule | <https://www.praxis.ee/uploads/2025/01/L%C3%B5pparuanne_Praxis_ajutise_t%C3%B6%C3%B6tamise_m%C3%B5ju.pdf> |
| Mõttekoda Praxis | EUROSTUDENT 8 Eesti tulemuste lühiülevaade | <https://www.praxis.ee/uploads/2022/02/EUROSTUDENT8_Lopparuanne.pdf> |
| Mõttekoda Praxis | EUROSTUDENT 9 Eesti tulemuste lühiülevaade | <https://praxis.ee/uploads/2026/05/E9_lo%CC%83pparuanne.pdf> |
| Mõttekoda Praxis | Infoleht vaimse tervise spetsialistidele LGBT+ noortega töötamisel | <https://praxis.ee/uploads/2025/03/LGBTQI_ekspertidele_Praxis_A5_veebi_OK.pdf> |
| Mõttekoda Praxis | Kiusamist ennetavate ja vähendavate sekkumiste tõhusus ning haridusasutuste kogemused nende rakendamisel | <https://www.praxis.ee/uploads/2021/05/Kiusamisennetuse_uuring_lopparuanne_Praxis.pdf> |
| Mõttekoda Praxis | Koolide ja koolieelsete lasteasutuste liikumis- ja toitumissekkumiste uuring | <https://www.praxis.ee/uploads/2025/12/Praxis_ToLi_raport_1-12-2025.pdf> |
| Mõttekoda Praxis | LGBTQI+ noorte vaimse tervise abi ja toe otsimise kogemused | <https://praxis.ee/uploads/2025/04/PAR%20uuringu%20aruanne%20ver1.pdf> |
| Mõttekoda Praxis | Meheks olemise pingeväli: maskuliinsuse normid ja narratiivid Eestis | <https://praxis.ee/uploads/2026/03/Maskuliinsus_raport.pdf> |
| Mõttekoda Praxis | Nutika noorsootöö alaste välismaiste parimate praktikate rakendatavus Eestis | <https://www.praxis.ee/uploads/2023/10/Lopparuanne_nutika-noorsootoo-praktikad_Praxis.pdf> |
| Mõttekoda Praxis | Nähtamatu osa majandusest: mis on tasustamata hooletöö hind? | <https://praxis.ee/uploads/2025/01/Tasustamata_hoolet%C3%B6%C3%B6_hind_aruanne.pdf> |
| Mõttekoda Praxis | Osalustegevusuuringud. Kuidas uurida koos? | <https://www.praxis.ee/uploads/2022/12/Osalustegevusuuringud_Kuidas-uurida-koos_-Kendrali_Valner_2024-1.pdf> |
| Mõttekoda Praxis | Perearstiabi digilahenduste kättesaadavus vanemaealistele | <https://praxis.ee/uploads/2026/01/TP_NOVA_L%C3%B5ppraport.pdf> |
| Mõttekoda Praxis | Programmi „Kohalik areng ja vaesuse vähendamine“ tulemuslikkuse lõpphindamine | <https://www.praxis.ee/uploads/2025/02/L%C3%B5pparuanne.pdf> |
| Mõttekoda Praxis | Sünnitusjärgsete koduvisiitide programmiteooria | <https://www.praxis.ee/uploads/2026/06/2%20-%20Koduvisiitide%20programmiteooria_aruanne.pdf> |
| Mõttekoda Praxis | Toimetulekutoetuse ja võlgnevuse mõju sotsiaal-majanduslikule toimetulekule ning tööturuaktiivsusele | <https://www.praxis.ee/uploads/2021/12/TTT-ja-volgnevuste-moju-uuring_lopparuanne.pdf> |
| Mõttekoda Praxis | Tõsiste käitumisprobleemidega laste teenuste analüüs | <https://www.praxis.ee/uploads/2018/09/kaitumisprob-noored-raport_Praxis2018.pdf> |
| Mõttekoda Praxis | Ukraina sõja tõttu Eestisse asunud naiste kogemused – lühikokkuvõte | <https://www.praxis.ee/uploads/2025/01/Barriers%20to%20a%20fulfilling%20life%20raport%20-%20est.pdf> |
| Mõttekoda Praxis | Võru linna vanemaealiste rahulolu-uuring | <https://praxis.ee/uploads/2025/12/V%C3%B5ru%20linna%20vanemaealiste%20rahuoluuuring.pdf> |
| Riigikogu Toimetised | Eestlaste ettekujutused ühiskonna kihistumisest | <https://rito.riigikogu.ee/wordpress/wp-content/uploads/2026/05/109-120_Uuring-Ra%CC%88mmer.pdf> |
| Riigikogu Toimetised | Kohanemine rahvastiku vananemisega kui rahvastikupoliitika keskne väljakutse | <https://rito.riigikogu.ee/wordpress/wp-content/uploads/2018/12/Kohanemine-rahvastiku-vananemisega-kui-rahvastikupoliitika-keskne-v%C3%A4ljakutse.-Leppik-Abuldaze-Sakkeus-Tambaum.pdf> |
| Riigikogu Toimetised | NEET-olukorras „tublid tüdrukud“ – nähtamatud nii koolis kui ka tugiteenustes | <https://rito.riigikogu.ee/wordpress/wp-content/uploads/2026/05/121-132_Uuring-Beilmann.pdf> |
| Riigikogu Toimetised | Tööga seotud sotsiaalse kaitse riskid Eesti tööturu muutuste taustal | <https://rito.riigikogu.ee/wordpress/wp-content/uploads/2018/12/T%C3%B6%C3%B6ga-seotud-sotsiaalse-kaitse-riskid-Eesti-t%C3%B6%C3%B6turu-muutuste-taustal.-Masso-Laurim%C3%A4e-J%C3%A4rve-Piirits.pdf> |
| Riigikontroll | Eesti tervishoiu suundumused | <https://www.riigikontroll.ee/sites/default/files/documents/2026-03/RVKS_Eesti%20tervishoiu%20suundumused_2022.pdf> |
| Riigikontroll | Hooldereform. Riigikontrolli aruanne Riigikogule | <https://www.riigikontroll.ee/sites/default/files/documents/2025-12/19680_RKTR_6596_2-1.4_2342_003-2.pdf> |
| Riigikontroll | Vastutustundlik ja teadlik laenamine ning tarbijakaitse pangaväliste krediidiandjate tarbimislaenude puhul | <https://www.riigikontroll.ee/sites/default/files/documents/2025-11/17243_RKTR_4562_2-1.4_2305_002-1.pdf> |
| Sisekaitseakadeemia | Kriisikommunikatsiooni käsiraamat | <https://digiriiul.sisekaitse.ee/bitstream/handle/123456789/3776/2026%2004%20SKA%20kriisikommunikatsioon%20WEB%20%281%29.pdf?isAllowed=y&sequence=3&utm> |
| Siseministeerium | Juhtumianalüüs: ametiasutuste tegevus surmaga lõppenud perevägivalla juhtumite lahendamisel | <https://siseministeerium.ee/sites/default/files/documents/2025-06/Ametiasutuste%20tegevus%20surmaga%20lo%CC%83ppenud%20pereva%CC%88givalla%20juhtumite%20lahendamisel%20lo%CC%83pparuanne2%20aprill%202025.pdf> |
| Siseministeerium | Lähisuhtevägivallaga seotud teadmised ja hoiakud päästekorraldajate ja politseinike seas | <https://www.siseministeerium.ee/sites/default/files/documents/2023-09/LO%CC%83PPRAPORT%20%28LSV%29%20RAK.pdf> |
| Siseministeerium | Politseitöös kasutatavate alaealistele õigusrikkujatele suunatud mittekaristuslike sekkumiste teaduspõhisuse ja rakendamise tulemuslikkuse analüüs | <https://siseministeerium.ee/sites/default/files/documents/2025-01/Alaealistele%20%C3%B5igusrikkujatele%20suunatud%20mittekaristuslikud%20sekkumised_0.pdf> |
| Soolise võrdõiguslikkuse ja võrdse kohtlemise volinik | Kuidas luua menopausi- ja üleminekueas inimesi arvestav töökeskkond? | <https://www.volinik.ee/volinik-live-web-prd/s3fs-public/2026-02/kuidas-luua-menopausi-ja-uleminekueas-inimesi-arvestav-tookeskkond_s.pdf> |
| Soolise võrdõiguslikkuse ja võrdse kohtlemise volinik | Kuidas luua transsoolisi inimesi arvestavat töökeskkonda? | <https://www.volinik.ee/volinik-live-web-prd/s3fs-public/2025-05/KUIDAS-LUUA-transsoolisi-inimesi-arvestavat-T%C3%96%C3%96KESKKONDA.pdf> |
| Soolise võrdõiguslikkuse ja võrdse kohtlemise volinik | Milline on riiklike maksutõusude ja eelarvekärbete mõju haavatavas olukorras rühmadele? | <https://www.volinik.ee/volinik-live-web-prd/s3fs-public/2025-06/Praxis_Milline-on-riiklike-maksut%C3%B5usude-ja-eelarvek%C3%A4rbete-m%C3%B5ju-haavatavas-olukorras-r%C3%BChmadele.pdf> |
| Sotsiaalkindlustusamet | Abi- ja toetusvajaduse hindamisvahendi metoodiline juhis 2021 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-11/Abi-%20ja%20toetusvajaduse%20hindamise%20metoodiline%20juhis_01.11.2023.pdf> |
| Sotsiaalkindlustusamet | Abivahendite muudatuste infoleht 01.09.2025 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-10/Infoleht_%20AV-muudatus_01.09.2025.pdf> |
| Sotsiaalkindlustusamet | Asendushooldusel noorte elluastumiskava kontrollnimekiri ja juhendmaterjal | <https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-02/Elluastumiskava%20kontrollnimekiri%20ja%20juhendmaterjal_18.02.2026.pdf> |
| Sotsiaalkindlustusamet | Asendushooldusel täisealiseks saavate noorte toetamine. Juhend asendus- ja järelhooldusteenuse osutajatele | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-06/Asendushooldusel%20t%C3%A4isealiseks%20saavate%20noorte%20toetamine.%20Juhend%20asendus-%20ja%20j%C3%A4relhooldusteenuse%20osutajatele.pdf> |
| Sotsiaalkindlustusamet | Asendushooldusteenuse kvaliteedijuhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/asendushooldusteenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Eesti sotsiaalteenuste kvaliteedijuhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-11/Lisa%201.%20Eesti%20sotsiaalteenuste%20kvaliteedijuhis_12.11.2024.pdf> |
| Sotsiaalkindlustusamet | Elanike teadlikkus ja hoiakud seoses laste vastu suunatud seksuaalvägivalla ennetuse ning abivõimalustega | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-02/Uuring%20elanike%20teadlikkus%20ja%20hoiakud%20seoses%20laste%20seksuaalv%C3%A4givalla%20ennetuse%20ning%20abiv%C3%B5imalustega%202025.pdf> |
| Sotsiaalkindlustusamet | Eluasemekulude piirmäärade kehtestamise juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-08/Eluasemekulude%20piirm%C3%A4%C3%A4rade%20kehtestamise%20juhend%2027.08.26.pdf> |
| Sotsiaalkindlustusamet | Eluruumi tagamise teenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-04/Eluruumi%20tagamise%20teenuse%20juhend%2015.04.2024.pdf> |
| Sotsiaalkindlustusamet | Eluruumi tagamise teenuse kvaliteedijuhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-01/Eluruumi%20tagamise%20teenuse%20kvaliteedijuhis_07.01.2026_0.pdf> |
| Sotsiaalkindlustusamet | Eluruumi tagamise teenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/eluruumi_tagamise_teenus_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Erihoolekandeteenuste kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-03/Erihoolekandeteenuste_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Hindamisvahendi metoodiline juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/hindamisvahendi_metoodiline_juhis_2023-2024.pdf> |
| Sotsiaalkindlustusamet | Hindamisvahendi metoodiline juhis 2025-2026 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-01/Hindamisvahendi%20metoodiline%20juhis_2025-2026.pdf> |
| Sotsiaalkindlustusamet | Hoolduskoormuse hindamise juhis 2023 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-11/Hoolduskoormuse%20hindamise%20juhis%202023.pdf> |
| Sotsiaalkindlustusamet | Hoolduspere kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/hoolduspere_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Isikliku abistaja teenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-07/Isikliku%20abistaja%20teenuse%20juhend_04.07.2024.pdf> |
| Sotsiaalkindlustusamet | Isikliku abistaja teenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/isikliku_abistaja_teenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Juhend „Traumateadlik ja kiindumuspõhine lähenemine töös lastega“ | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Traumateadlik-ja-kiindumispohine-lahenemine-toos-lastega.pdf> |
| Sotsiaalkindlustusamet | Juhend hädaohus oleva lapse perest eraldamiseks ja vanema nõusoleku alusel paigutamiseks | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-04/Juhis%20h%C3%A4daohus%20oleva%20lapse%20perest%20eraldamiseks%20ja%20vanema%20n%C3%B5usoleku%20alusel%20paigutamiseks_03.04.2025.pdf> |
| Sotsiaalkindlustusamet | Juhend lastekaitsetöötajatele lapse üleandmisel ja suhtlemise võimaldamisel täitemenetluses | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Juhis-lastekaitsetootajatele-lapse-uleandmisel-ja-lapsega-suhtlemise-voimaldamisel-taitemenetluses-2025.pdf> |
| Sotsiaalkindlustusamet | Juhend teenuse korraldamiseks esmasesse psühhoosi haigestunutele | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-01/VEEBI%20juhend_srt_teenuse_korraldamine_esmasesse_psuhhoosi_haigestunule%2014.01.2025.pdf> |
| Sotsiaalkindlustusamet | Juhend, kuidas haldusakt vormistada ja põhjendada üldhooldusteenuse näitel mai 2023 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-11/Juhend_kuidas%20haldusakt%20vormistada%20ja%20p%C3%B5hjendada_%C3%BCldhooldusteenuse%20n%C3%A4itel_mai%202023.pdf> |
| Sotsiaalkindlustusamet | Järelhooldusteenuse kvaliteedijuhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/jarelhoolduseteenus_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Keskkonna kohandamise abimaterjal kohaliku omavalitsuse spetsialistidele | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-11/keskonna_kohandamise_abimaterjal_kohaliku_omavalitsuse_spetsialistidele.pdf> |
| Sotsiaalkindlustusamet | Kinnise lasteasutuse teenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/kinnise_lasteasutuse_teenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Koduteenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-06/Koduteenuse%20juhend_18.06.2024.pdf> |
| Sotsiaalkindlustusamet | Koduteenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-08/Koduteenuse%20kvaliteedijuhis%2031.07.2024.pdf> |
| Sotsiaalkindlustusamet | Koduteenuse lihtsustatud kulumudeli juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-05/koduteenuse_lihtsustatud_kulumudeli_juhend.pdf> |
| Sotsiaalkindlustusamet | Koduteenuse teenusedisaini projekti raport | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-05/koduteenuse_teenusedisaini_projekti_raport_2022.pdf> |
| Sotsiaalkindlustusamet | Kolm maja – tööriist lapse kaasamiseks | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/Kolm%20maja.pdf> |
| Sotsiaalkindlustusamet | Koondaruande juhendmaterjal | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-07/Koondaruande%20juhendmaterjal_03.07.2026.pdf> |
| Sotsiaalkindlustusamet | Kovisiooni juhend lastekaitsetöötajatele | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Kovisiooni-juhend-lastekaitsetootajatele.pdf> |
| Sotsiaalkindlustusamet | Kovisiooni juhend. Meelespea | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Kovisiooni-juhend-meelespea.pdf> |
| Sotsiaalkindlustusamet | Lapse küsitlemise käsiraamat | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/lapse_kusitlemise_kasiraamat_2016_0.pdf> |
| Sotsiaalkindlustusamet | Lapse uni ja erisuste märkamine. Juhendmaterjal unevaeguse kui terviseriski hindamiseks | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/lapse_uni_ja_erisuste_markamine_juhendmaterjal_unevaeguse_kui_terviseriski_hindamiseks.pdf> |
| Sotsiaalkindlustusamet | Lapse õiguste ja vanemluse uuring | <https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-07/lapse_oiguste_ja_vanemluse_uuring_2018-praxis.pdf> |
| Sotsiaalkindlustusamet | Lapsega vestlemise meelespea | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Meelespea-lapsega-vestlemiseks.pdf> |
| Sotsiaalkindlustusamet | Lapsehoiuteenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/lapsehoiuteenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Lasteabi tulemuslikkuse uuring | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-10/Lasteabi-tulemuslikkuse-uuring-lopparuanne-16.10.2024.pdf> |
| Sotsiaalkindlustusamet | Lastevastase vägivalla ennetamine ja vähendamine asenduskodudes. Juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-09/Lastevastase%20v%C3%A4givalla%20ennetamine%20ja%20v%C3%A4hendamine%20asenduskodudes.%20Juhend.pdf> |
| Sotsiaalkindlustusamet | Meeleoluhäiretega täiskasvanute rehabilitatsioonijuhise koondaruanne | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Meeleoluh%C3%A4iretega%20t%C3%A4iskasvanute%20rehabilitatsioonijuhise%20koondaruanne.pdf> |
| Sotsiaalkindlustusamet | PACT-i riskihindamise täitmise juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-09/pact_riskihindamise_taitmise_juhend%20%281%29.pdf> |
| Sotsiaalkindlustusamet | Perevägivalla toimepanijatele suunatud riskihindamisvahendite võrdlev analüüs – Eesti ja Euroopa praktika | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-02/Perevagivalla-riskihindamisvahendite-vordlev-analuus_lopparuanne_12022026.pdf> |
| Sotsiaalkindlustusamet | Praktikad väärkohtlemise ennetamiseks huvihariduses ja lapsevanemate hoiakud | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-08/Huvihariduse%20uuringu%20aruanne%20Emor%202026.pdf> |
| Sotsiaalkindlustusamet | Psühholoogiline esmaabi: juhend otsestele abistajatele | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-06/Ps%C3%BChholoogiline%20esmaabi.%20Juhend%20otsestele%20abistajatele.pdf> |
| Sotsiaalkindlustusamet | Psüühilise erivajadusega lapse küsitlemise juhendmaterjal | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/psuuhilise_erivajadusega_laste_kusitlemise_juhendmaterjal._koostaja_kristjan_kask.pdf> |
| Sotsiaalkindlustusamet | Põletikuliste polüartropaatiatega täiskasvanu (M05-M14 RHK-10) rehabilitatsioonijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/P%C3%B5letikuliste%20pol%C3%BCartropaatiatega%20t%C3%A4iskasvanu%20%28M05-M14%20RHK-10%29%20rehabilitatsioonijuhis.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniplaani lisa koostamise juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-09/Rehabilitatsiooniplaani%20lisa%20koostamise%20juhend_SKA_06.09.2024.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Lisa 1. Rehabilitatsioonijuhis meeleoluhäiretega täiskasvanud rehabilitatsiooniteenuse saajale | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Lisa%201.%20Rehabilitatsioonijuhis%20meeleoluh%C3%A4iretega%20t%C3%A4iskasvanud%20rehabilitatsiooniteenuse%20saajale.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Lisa 1. Rehabilitatsioonijuhis skisofreenia ja teiste häiretega täiskasvanud rehabilitatsiooniteenuse saajale | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Lisa%201.%20Rehabilitatsioonijuhis%20skisofreenia%20ja%20teiste%20h%C3%A4iretega%20t%C3%A4iskasvanud%20rehabilitatsiooniteenuse%20saajale.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Lisa 2. Meeleoluhäired. Rehabilitatsioonijuhiste koostamise metoodika | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Lisa%202.%20Meeleoluh%C3%A4ired.%20Rehabilitatsioonijuhiste%20koostamise%20metoodika.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Lisa 2. Rehabilitatsioonijuhiste koostamise metoodika | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Lisa%202.%20Rehabilitatsioonijuhiste%20koostamise%20metoodika.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Lisa 5. Juhise lühiversioon | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Lisa%205.%C2%A0Juhise%20l%C3%BChiversioon.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Lühikokkuvõte soovitustest | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/L%C3%BChikokkuv%C3%B5te%20soovitustest.pdf> |
| Sotsiaalkindlustusamet | Rehabilitatsiooniteenuse osutajatele: Soovituste kokkuvõte | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Meeleoluh%C3%A4irega%20t%C3%A4iskasvanute%20rehabilitatsioonijuhise%20soovituste%20kokkuv%C3%B5te.pdf> |
| Sotsiaalkindlustusamet | Riikliku perelepitusteenuse tulemuslikkuse uuring sotsiaalkindlustusametile | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-10/Riikliku%20perelepitusteenuse%20tulemuslikkuse%20uuringu%20l%C3%B5pparuanne.pdf> |
| Sotsiaalkindlustusamet | Saatjata alaealise välismaalase juhtumikorralduse juhend spetsialistidele | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-09/SAV%20juhis%202026_01.09.pdf> |
| Sotsiaalkindlustusamet | Sisehindamise juhend asenduskoduteenuse osutajale | <https://www.sm.ee/sites/default/files/content-editors/Lapsed_ja_pered/Asendushooldus/sisehindamise_juhised.pdf> |
| Sotsiaalkindlustusamet | Skisofreenia, skisotüüpsete ja luululiste häiretega täiskasvanute rehabilitatsioonijuhise koondaruanne | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Skisofreenia%20ja%20teiste%20h%C3%A4irete%20rehabilitatsioonijuhiste%20koondaruanne.pdf> |
| Sotsiaalkindlustusamet | Sotsiaalse rehabilitatsiooni teenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-11/Sotsiaalse%20rehabilitatsiooni%20teenuse%20kvaliteedijuhis_24.11.2023.pdf> |
| Sotsiaalkindlustusamet | Sotsiaalse rehabilitatsiooni teenuse osutamise juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-07/Sotsiaalse%20rehabilitatsiooni%20teenuse%20osutamise%20juhend_03.07.2026.pdf> |
| Sotsiaalkindlustusamet | Sotsiaaltransporditeenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/Sotsiaaltransporditeenuse%20juhend_2023.pdf> |
| Sotsiaalkindlustusamet | Sotsiaaltransporditeenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/sotsiaaltransporditeenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | STAR kannete juhis 2025-2026 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-01/STAR_kannete%20juhis_2025-2026.pdf> |
| Sotsiaalkindlustusamet | Sünnitusjärgse toe ülevaateuuring | <https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-05/S%C3%BCnnitusj%C3%A4rgse%20toe%20%C3%BClevaateuuring.pdf> |
| Sotsiaalkindlustusamet | Taastava õiguse taskuraamat | <https://sotsiaalkindlustusamet.ee/media/2520/download> |
| Sotsiaalkindlustusamet | Teenuse komponentide andmekogu juhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-01/Teenuse%20komponentide%20andmekogu%20juhis.pdf> |
| Sotsiaalkindlustusamet | Teenuskomponentide andmekogu juhis täitmiseks 2025-2026 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Teenuskomponentide%20andmekogu_juhis_t%C3%A4itmiseks_2025-2026%20%2808.12.2025%29.pdf> |
| Sotsiaalkindlustusamet | Traumast taastumist toetav vaimse tervise abi: Lisa 5. TTTVT teenuse infoleht | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-02/TTTVT%20teenuse%20infoleht_13.02.2026.pdf> |
| Sotsiaalkindlustusamet | Traumateadlik ja kiindumuspõhine lähenemine töös lastega. Meelespea | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/Traumateadlik-ja-kiindumuspohine-lahenemine-toos-lastega-meelespea.pdf> |
| Sotsiaalkindlustusamet | Tugigrupi korraldamise tööriistakast | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-08/1_Tugigrupi%20korraldamise%20t%C3%B6%C3%B6riistakast_0.pdf> |
| Sotsiaalkindlustusamet | Tugigrupi töö korraldajale: Lugemissoovitusi | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-08/7_Lugemissoovitusi_0.pdf> |
| Sotsiaalkindlustusamet | Tugiisiku teenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/tugiisiku_teenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Tugiisikuteenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-07/Tugiisikuteenuse%20juhend_04.07.2024.pdf> |
| Sotsiaalkindlustusamet | Turvakoduteenus lapsele kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/turvakoduteenus_lapsele_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Turvakoduteenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-01/Turvakoduteenus%20t%C3%A4iskasvanule%20kvaliteedijuhis_07.01.2026.pdf> |
| Sotsiaalkindlustusamet | Turvaline sport - infomaterjal lapsele | <https://www.oiguskantsler.ee/sites/default/files/Turvaline%20sport.%20Infomaterjal%20lastele.%2031.05.2023.pdf> |
| Sotsiaalkindlustusamet | Turvaline sport - infomaterjal lapsevanemale | <https://www.oiguskantsler.ee/sites/default/files/Turvaline%20sport.%20Infomaterjal%20lapsevanematele.%2031.05.2023.pdf> |
| Sotsiaalkindlustusamet | Täisealise abi- ja toetusvajaduse hindamise juhend 2025 | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-01/T%C3%A4isealise%20abi-%20ja%20toetusvajaduse%20hindamise%20juhend%202025.pdf> |
| Sotsiaalkindlustusamet | Täisealise isiku hoolduse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-08/T%C3%A4isealise%20isiku%20hooldus%20juhend.pdf> |
| Sotsiaalkindlustusamet | Täisealise isiku hooldusteenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/taisealise_isiku_hooldusteenuse_kvaliteedijuhis_.pdf> |
| Sotsiaalkindlustusamet | Vanemlusprogrammi Imelised aastad 2018. aasta tulemused | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-04/vanemlusprogrammi_imelised_aastad_2018_tulemused.pdf> |
| Sotsiaalkindlustusamet | Varjupaigateenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-01/Varjupaigateenuse%20juhend_07.01.2026.pdf> |
| Sotsiaalkindlustusamet | Varjupaigateenuse kvaliteedijuhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-01/Varjupaigateenuse%20kvaliteedijuhis_07.01.2026.pdf> |
| Sotsiaalkindlustusamet | Võlanõustamisteenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/V%C3%B5lan%C3%B5ustamisteenuse%20juhend_2023.pdf> |
| Sotsiaalkindlustusamet | Võlanõustamisteenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/volanoustamisteenuse_kvaliteedijuhis.pdf> |
| Sotsiaalkindlustusamet | Võlgade aegumise ja täitemenetluse lõpetamise juhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-11/V%C3%B5lgade%20aegumise%20ja%20t%C3%A4itemenetluse%20l%C3%B5petamise%20juhis.pdf> |
| Sotsiaalkindlustusamet | Väljaspool kodu osutatava üldhooldusteenuse juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-07/%C3%9CHT%20juhend%202026.pdf> |
| Sotsiaalkindlustusamet | Väljaspool kodu osutatava üldhooldusteenuse kvaliteedijuhis | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-01/V%C3%A4ljaspool%20kodu%20osutatava%20%C3%BCldhooldusteenuse%20kvaliteedijuhis%202024.pdf> |
| Sotsiaalkindlustusamet | Ökokaart - tööriist lapse lähivõrgustiku ja suhete kaardistamiseks | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/okokaart.pdf> |
| Sotsiaalkindlustusamet | Ööpäevaringset sotsiaalteenust osutavate asutuste kriisiplaani juhend | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-12/%C3%96%C3%B6p%C3%A4evaringset%20sotsiaalteenust%20osutavate%20asutuste%20kriisiplaani%20juhend.pdf> |
| Sotsiaalkindlustusamet | Üldjuhend KOV sotsiaalteenuse korraldamiseks ametnikule | <https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-01/%C3%9Cldjuhend_31.01.pdf> |
| Sotsiaalministeerium | Analüüs lastekaitsetöö ning lastega töötavate spetsialistide baasõppe kohta laste heaolu tagamiseks, väärkohtlemise märkamiseks ja abivajavast lapsest teavitamiseks | <https://www.sm.ee/media/2671/download> |
| Sotsiaalministeerium | Analüüs vanemakande süsteemi parendamiseks. Lõpparuanne | <https://sm.ee/sites/default/files/documents/2025-01/Anal%C3%BC%C3%BCs%20vanemakande%20s%C3%BCsteemi%20parendamiseks_L%C3%B5pparuanne.pdf> |
| Sotsiaalministeerium | Asendushoolduse uuring: TATi tegevuste ja sotsiaalhoolekande seaduse muudatuste mõjude hindamine 2014–2020 | <https://www.sm.ee/media/2610/download> |
| Sotsiaalministeerium | Asendushoolduselt iseseisvasse ellu astuvate noorte uuring. Lõpparuanne | <https://www.sm.ee/media/2234/download> |
| Sotsiaalministeerium | Eesti perepoliitiliste meetmete süsteem 2025 | <https://sm.ee/sites/default/files/documents/2025-12/Eesti%20perepoliitiliste%20meetmete%20s%C3%BCsteem_sotsiaalministeerium2025.pdf> |
| Sotsiaalministeerium | Eestis kasutatavate väheintensiivsete psühholoogiliste sekkumiste ülevaade | <https://www.sm.ee/media/3569/download> |
| Sotsiaalministeerium | Elanikkonna hoolduskoormuse uuring | <https://www.sm.ee/media/2686/download> |
| Sotsiaalministeerium | Elanikkonna tegevuspiirangute ja hooldusvajaduse uuring 2025. Raport | <https://sm.ee/sites/default/files/documents/2026-04/HOV%20uuringu%20raport%202025.pdf> |
| Sotsiaalministeerium | Elatusmiinimum – teel parema toeni puudustkannatavatele inimestele | <https://www.sm.ee/sites/default/files/content-editors/Ministeerium_kontaktid/Uuringu_ja_analuusid/Sotsiaalvaldkond/elatusmiinimum_loppraport.pdf> |
| Sotsiaalministeerium | Ettepanekud valdkondade ülese laste heaolu näidikulaua väljatöötamiseks Eestis Islandi kogemuse näitel | <https://sm.ee/sites/default/files/documents/2024-11/Islandi%20projekti%20anal%C3%BC%C3%BCtiline%20dokument_Nahkur_24.10.2024_OliverNahkur.pdf> |
| Sotsiaalministeerium | Inimese elukaart hõlmav valdkondadeülene üldine heaolu kontseptuaalne mudel Eestis | <https://sm.ee/sites/default/files/documents/2026-05/Inimese%20elukaart%20h%C3%B5lmav%20valdkondade%C3%BClene%20%C3%BCldine%20heaolu%20kontseptuaalne%20mudel%20Eestis.pdf> |
| Sotsiaalministeerium | Isapuhkus ja emaduslõiv | <https://sm.ee/sites/default/files/documents/2025-05/Isapuhkus%20ja%20emadusl%C3%B5iv_Unt%20Aavik%20Taht%202024.pdf> |
| Sotsiaalministeerium | Kas Eesti elanikud saavad endale tervishoiuteenuseid lubada, arvestades nende sissetulekut ja omaosaluskoormust? | <https://www.sm.ee/sites/default/files/documents/2022-06/Kas%20Eesti%20elanikud%20saavad%20endale%20tervishoiuteenuseid%20lubada%2C%20arvestades%20nende%20sissetulekut%20ja%20omaosaluskoormust.pdf> |
| Sotsiaalministeerium | Kodus elavatele dementsusega inimestele ja nende hoolduskoormusega lähedastele suunatud sekkumispraktikate ning tugisüsteemide analüüs. Lõpparuanne | <https://sm.ee/sites/default/files/documents/2026-09/Kodus%20elavatele%20dementsusega%20inimestele%20ja%20nende%20hoolduskoormusega%20l%C3%A4hedastele%20suunatud%20sekkumispraktikate%20ning%20tugis%C3%BCsteemide%20anal%C3%BC%C3%BCs_L%C3%B5pparuanne%202026.pdf> |
| Sotsiaalministeerium | Koduses keskkonnas toimunud kukkumisjuhtumid: praegune korraldus ja võimalikud lahendused | <https://sm.ee/sites/default/files/documents/2026-06/Koduses%20keskkonnas%20toimunud%20kukkumisjuhtumid.pdf> |
| Sotsiaalministeerium | Kohalike omavalitsuste sotsiaalkaitse kulude ja nende kajastamise analüüs | <https://www.sm.ee/media/2612/download> |
| Sotsiaalministeerium | Kohaliku tasandi lastekaitsetöö tulemuslikkuse suurendamine ja jätkusuutlik arendamine | <https://www.sm.ee/sites/default/files/content-editors/Ministeerium_kontaktid/Uuringu_ja_analuusid/Sotsiaalvaldkond/kohaliku_tasandi_lastekaitsetoo_tulemuslikkuse_suurendamine_ja_jatkusuutlik_arendamine.pdf> |
| Sotsiaalministeerium | Lapse peresisese väärkohtlemise väljaselgitamine ja selle mõju hindamine lastekaitsetöös ja last puudutavas tsiviilkohtumenetluses. Lõppraport | <https://sm.ee/sites/default/files/documents/2026-04/Lapse%20peresisene%20v%C3%A4%C3%A4rkohtlemine_Lo%CC%83ppraport_T%C3%9C_2026.pdf> |
| Sotsiaalministeerium | Laste arv ja hõive Eestis (Statistikaamet) | <https://sm.ee/sites/default/files/documents/2025-05/Laste%20arv%20ja%20h%C3%B5ive%20Eestis%20-%20Rootalu%2C%20Levenko%2C%20Vill%20%28Statistikaamet%29.pdf> |
| Sotsiaalministeerium | Laste ja noorte vaimse tervise parandamise ettepanekud. Kokkuvõte | <https://sm.ee/sites/default/files/documents/2025-02/Laste%20ja%20noorte%20vaimse%20tervise%20parandamise%20ettepanekud_kokkuvote.pdf> |
| Sotsiaalministeerium | Laste ja noorte vaimse tervise parandamise ettepanekute raport | <https://www.sm.ee/sites/default/files/documents/2025-02/Laste%20ja%20noorte%20ettepanekute%20raport.pdf> |
| Sotsiaalministeerium | Laste saamise ja toetamise analüüs ja ettepanekud 2025 | <https://sm.ee/sites/default/files/documents/2025-08/Laste%20saamise%20ja%20toetamise_anal%C3%BC%C3%BCs%20ja%20ettepanekud_0.pdf> |
| Sotsiaalministeerium | Laste saamise väärtused | <https://sm.ee/sites/default/files/documents/2025-05/Laste%20saamise%20v%C3%A4%C3%A4rtused%20-%20Kasearu_09.04.pdf> |
| Sotsiaalministeerium | Lastekaitse juhtumikorralduse mudelite võrdlev analüüs | <https://sm.ee/sites/default/files/documents/2024-07/Lastekaitse%20mudelite%20l%C3%B5pparuanne_27.06.2024.pdf> |
| Sotsiaalministeerium | Majanduslik toimetulek ja laste heaolu 2025 | <https://sm.ee/sites/default/files/documents/2025-09/Majanduslik%20toimetulek%20ja%20laste%20heaolu_%202025_0.pdf> |
| Sotsiaalministeerium | Meeste nõustamis- ja tervishoiuteenuste kasutamise uuring | <https://www.sm.ee/media/3347/download> |
| Sotsiaalministeerium | Millisesse perre sünnivad lapsed (Statistikaamet) | <https://sm.ee/sites/default/files/documents/2025-05/Millisesse%20perre%20s%C3%BCnnivad%20lapsed%20-%20Rootalu%2C%20Vill%20%28Statistikaamet%29.pdf> |
| Sotsiaalministeerium | Nügimismeetodite kasutamine soostereotüübivabade karjäärivalikute ja töötingimuste toetamiseks | <https://www.sm.ee/media/2236/download> |
| Sotsiaalministeerium | Palliatiivse ravi korraldus Euroopas fookusega vaimse tervise teenustele ja ettepanekud Eestile | <https://sm.ee/media/3219/download> |
| Sotsiaalministeerium | Pensionisüsteemide rahvusvahelise praktika analüüs | <https://www.sm.ee/media/2462/download> |
| Sotsiaalministeerium | Pensionitarkuse uuring. Lõpparuanne | <https://sm.ee/sites/default/files/documents/2024-12/Pensionitarkuse%20uuring.%20L%C3%B5pparuanne.pdf> |
| Sotsiaalministeerium | Pikaajalise hoolduse teenuseid osutava tööjõu tagamise praktika teistes riikides ja soovitused Eestile | <https://www.sm.ee/media/2669/download> |
| Sotsiaalministeerium | Programmi Kainem ja tervem Eesti vahehindamine | <https://www.sm.ee/media/2297/download> |
| Sotsiaalministeerium | Puude tuvastamise, toetuste ja hüvede kaasajastamise uuringu lõppraport | <https://sm.ee/sites/default/files/documents/2026-03/Puude%20tuvastamise%2C%20toetuste%20ja%20h%C3%BCvede%20kaasajastamise%20uuringu%20l%C3%B5ppraport_1.pdf> |
| Sotsiaalministeerium | Riskihindamise instrumendi väljatöötamine sotsiaalhoolekandelise abivajadusega inimeste tuvastamiseks | <https://www.sm.ee/media/3462/download> |
| Sotsiaalministeerium | Suitsiidse patsiendi käsitlus esmatasandi tervishoius (sh kooli- ja töötervishoid), kiirabis ja erakorralise meditsiini osakondades (SUIPA). Lõppraport | <https://www.sm.ee/media/3070/download> |
| Sotsiaalministeerium | Suundumused sündimuses ja nende seos perehüvitistega | <https://sm.ee/sites/default/files/documents/2025-04/Suundumused%20s%C3%BCndimuses%20ja%20nende%20seos%20pereh%C3%BCvitistega_1.pdf> |
| Sotsiaalministeerium | Sündimuse ja perepoliitika tervikanalüüsi teoreetilise osa kokkuvõte | <https://sm.ee/sites/default/files/documents/2025-08/Tervikanal%C3%BC%C3%BCsi%20teoreetilise%20osa%20kokkuv%C3%B5te.pdf> |
| Sotsiaalministeerium | Teiste riikide praktikate kaardistus ja analüüs komorbiidselt esinevate häiretega isikutele toe pakkumiseks Eestis | <https://www.sm.ee/media/3568/download> |
| Sotsiaalministeerium | Tervise ebavõrdsuse sotsiaalsed põhjused Euroopa Sotsiaaluuringu andmete põhjal | <https://sm.ee/sites/default/files/documents/2025-12/T%C3%9C%20aruanne_%20Tervise%20ebav%C3%B5rdsuse%20sotsiaalsed%20p%C3%B5hjused%20ESSi%20andmete%20p%C3%B5hjal.pdf> |
| Sotsiaalministeerium | Toidukaardi saajate küsitlusuuring. Tulemuste infograafik | <https://www.sm.ee/sites/default/files/documents/2025-06/Toidukaardi%20saajate%20k%C3%BCsitlusuuring%202025%20kokkuvote.pdf> |
| Sotsiaalministeerium | Tõenduspõhiste sekkumiste rakendamisvõimalused koos mõju hindamisega terviseharituse parandamisel Eestis | <https://www.sm.ee/media/2542/download> |
| Sotsiaalministeerium | Täisealiste eestkostekorralduse uuring Eestis | <https://www.sm.ee/media/3584/download> |
| Sotsiaalministeerium | Tänapäevase lastekaitse juhtumikorralduse, andmevahetuse ja e-teenuste analüüs | <https://www.sm.ee/media/2670/download> |
| Sotsiaalministeerium | Ulatusliku psühhosotsiaalse kriisiabi pakkumise analüüs | <https://www.sm.ee/sites/default/files/documents/2025-06/Ulatusliku%20ps%C3%BChhosotsiaalse%20kriisiabi%20pakkumise%20anal%C3%BC%C3%BCs_05.06.2025.pdf> |
| Sotsiaalministeerium | Uuring leibkondliku elatusmiinimumi määramise metoodika väljatöötamiseks | <https://sm.ee/sites/default/files/documents/2026-06/Uuring%20leibkondliku%20elatusmiinimumi%20m%C3%A4%C3%A4ramise%20metoodika%20v%C3%A4ljat%C3%B6%C3%B6tamiseks.pdf> |
| Sotsiaalministeerium | Vabatahtlikud ja vabatahtlikkus Eestis. Hetkeolukord ja tulevikuväljavaated | <https://sm.ee/sites/default/files/documents/2026-04/Vabatahtlikud%20ja%20vabatahtlikkus%20Eestis.%20Hetkeolukord%20ja%20tulevikuv%C3%A4ljavaated.pdf_0.pdf> |
| Sotsiaalministeerium | Vaimse tervise parandamise kogukonna juhend | <https://www.sm.ee/sites/default/files/documents/2023-08/WHO%20vaimse%20tervise%20parandamise%20tegevuskava%20%28mhGAP%29.pdf> |
| Sotsiaalministeerium | Vaimse tervise valdkonna kvalifikatsiooninõuete hindamine – I aruanne, metoodika | <https://www.sm.ee/sites/default/files/documents/2025-04/I%20aruanne_MetoKval%20(Metoodika)%2027.03%20(1).pdf> |
| Sotsiaalministeerium | Vaimse tervise valdkonna kvalifikatsiooninõuete hindamine – II aruanne, metoodika rakendamine | <https://www.sm.ee/sites/default/files/documents/2025-04/II%20aruanne_MetoKval%20(Metoodika%20rakendamine)%2027.03.pdf> |
| Sotsiaalministeerium | Vanemahüvitis ja sündimus | <https://sm.ee/sites/default/files/documents/2025-05/Vanemah%C3%BCvitis%20ja%20s%C3%BCndimus%20-%20Puur%2C%20Abdullayev%20okt%202024.pdf> |
| Sotsiaalministeerium | Vanemahüvitist jagavate perede kogemused (CentAR) | <https://sm.ee/sites/default/files/documents/2025-04/Vanemah%C3%BCvitist%20jagavate%20perede%20kogemused%20%28CentAR%29.pdf> |
| Sotsiaalministeerium | Väikelaste emade töötuna arvelolek lapse isa vanemapuhkuse ajal | <https://sm.ee/sites/default/files/documents/2025-05/V%C3%A4ikelaste%20emade%20t%C3%B6%C3%B6tuna%20arvelolek%20lapse%20isa%20vanemapuhkuse%20ajal_TK_2025.pdf> |
| Sotsiaalministeerium | Välisriikide madala intensiivsusega psühholoogiliste sekkumiste rakendusmudelite analüüs ja soovitused Eestile | <https://www.sm.ee/media/2846/download> |
| Sotsiaalministeerium | Ühtekuuluvuspoliitika hoolekandeteenuste tulemuslikkuse ja mõju hindamine Sotsiaalministeeriumile. Lõpparuanne | <https://www.sm.ee/media/2313/download> |
| Statistikaamet | Mis mõjutab noorte NEET-staatusesse langemist? Analüüsi aruanne | <https://www.stat.ee/sites/default/files/2023-10/Mis%20m%C3%B5jutab%20noorte%20NEET-staatusesse%20langemist_Statistikaameti%20anal%C3%BC%C3%BCs_k%C3%BCljendus%202509.pdf> |
| Targalt Internetis | Võta jutuks. Internet ja laste seksuaalne väärkohtlemine | <https://www.targaltinternetis.ee/wp-content/uploads/2015/12/Vota_jutuks.pdf> |
| Tartu Ülikool | Eesti noorsootöötaja eetikakoodeks | <https://eetika.ee/sites/default/files/2026-06/Noorsoot%C3%B6%C3%B6taja%20eetikakoodeks.pdf> |
| Tartu Ülikool | EU Kids Online’i 2025. aasta uuringu esialgsed tulemused | <https://sisu.ut.ee/wp-content/uploads/sites/289/EUKO-v6rku-summariga-26_02_18.pdf> |
| Tartu Ülikool | EU Kids Online’i Eesti 2018. aasta uuringu esialgsed tulemused | <https://sisu.ut.ee/wp-content/uploads/sites/289/eu_kids_online_eesti_2018_raport.pdf> |
| Tartu Ülikool | Noorte osalus otsustusprotsessides | <https://skytte.ut.ee/sites/default/files/2022-05/lopparuanne_19.03_noorte_osalus_rake.pdf> |
| Tartu Ülikool | Suitsiidimõtete esinemine ja sellega seotud tegurid Eesti 15-aastastel kooliõpilastel aastatel 2006–2022 | <https://dspace.ut.ee/server/api/core/bitstreams/c2947b03-24e3-432d-9d86-d2e653cdb5e6/content> |
| Tartu Ülikool | Tartu linna vanemaealiste uuring | <https://skytte.ut.ee/sites/default/files/2025-01/Tartu_linna_vanemaealiste_uuring_l%C3%B5pparuanne.pdf> |
| Tartu Ülikooli Kliinikum | Insuldipatsiendi infomaterjal: Elu pärast insulti | <https://www.kliinikum.ee/wp-content/uploads/2021/02/kliinikum_insult_web.pdf> |
| Tervise Arengu Instituut | Avaliku sektori esindajate hinnangud vanemluse valdkonnale | <https://tai.ee/sites/default/files/2022-02/Avaliku%20sektori%20esindajate%20hinnangud%20vanelmuse%20valdkonnale_01.2022.pdf> |
| Tervise Arengu Instituut | Dementsusega inimesi toetav õppiv hoolekandeasutus | <https://www.tai.ee/sites/default/files/2024-09/suvekooli_kokkuvote_2024.pdf> |
| Tervise Arengu Instituut | Eesti rahvastiku vaimse tervise uuringu lühikokkuvõte | <https://tai.ee/sites/default/files/2023-03/RVTU_lyhikokkuvote_2023.pdf> |
| Tervise Arengu Instituut | Ennetustegevuse kavandamise, arendamise, kohandamise ja hindamise juhend | <https://tai.ee/sites/default/files/2026-02/tai_ennetustegevus.pdf> |
| Tervise Arengu Instituut | Kanep. Eneseabi töövihik | <https://www.tai.ee/sites/default/files/2022-12/TAI_Kanepi_t%C3%B6%C3%B6vihik_2022_est_online_12.22.pdf> |
| Tervise Arengu Instituut | Kooliõpilaste ennetusprogrammide võrdlev analüüs | <https://www.tai.ee/sites/default/files/2022-05/Koolip%C3%B5histe%20ennetusprogrammide%20v%C3%B5rdlev%20anal%C3%BC%C3%BCs.pdf> |
| Tervise Arengu Instituut | Lapse heaolu ja vaimse tervise hindamisvahendid: spetsialistide vajadused | <https://tai.ee/sites/default/files/2023-01/Lapse%20heaolu%20ja%20vaimse%20tervise%20hindamisvahendid.pdf> |
| Tervise Arengu Instituut | Lapseootel ja väikelaste vanematele suunatud ennetustegevuste võrdlev analüüs | <https://www.tai.ee/sites/default/files/2024-03/Lapseootel_ja_vaikelaste_vanematele_suunatud_ennetustegevuste_analuus_LOPPARUANNE_02-2024.pdf> |
| Tervise Arengu Instituut | Laste ja noorte vaimse tervise ja riskikäitumisega seotud riski- ja kaitsetegurite mõõtevahendid | <https://www.tai.ee/sites/default/files/2022-03/Laste%20ja%20noorte%20vaimse%20tervise%20ja%20riskik%C3%A4itumisega%20seotud%20riski-%20ja%20kaitsetegurite%20m%C3%B5%C3%B5tevahendid_EST.pdf> |
| Tervise Arengu Instituut | Maakondlike tervisenõukogude roll ja potentsiaal | <https://www.tai.ee/sites/default/files/2025-09/tervisenoukogud_raport-24.09.pdf> |
| Tervise Arengu Instituut | Narkootikumide tarvitamise olukord Eestis 2024 | <https://www.tai.ee/sites/default/files/2025-07/uimastitarvitamise_olukord_2024.pdf> |
| Tervise Arengu Instituut | Narkootikumide tarvitamise olukord Eestis 2025 | <https://www.tai.ee/sites/default/files/2026-08/uimastitarvitamise_olukord_2025_18.8.26.pdf> |
| Tervise Arengu Instituut | Noorukite sõeltestimine, lühisekkumine ja ravile suunamine uimastite tarvitamise korral | <https://tai.ee/sites/default/files/2025-09/tai-soeltestimine-veeb_0.pdf> |
| Tervise Arengu Instituut | Nutiseadmete kasutamine: soovitused haridusasutustele, lapsevanematele ja noortele | <https://www.tai.ee/sites/default/files/2025-10/TAI%20Soovitused%20nutiseadmete%20kasutamise%20piiramiseks4.pdf> |
| Tervise Arengu Instituut | Prostitutsiooni kaasatud naiste terviseuuring | <https://www.tai.ee/sites/default/files/2023-09/Prostitutsiooni_kaasatud_naiste_terviseuuring.pdf> |
| Tervise Arengu Instituut | Sissetulekuga seotud ebavõrdsus tervishoiuteenuste kasutamisel ja omaosaluse mõju vaesusriskile | <https://www.tai.ee/sites/default/files/2025-01/ebavordsus_tervisehoiuteenuste_kasutamisel_2024.pdf> |
| Tervise Arengu Instituut | Töö alkoholi liigtarvitava kliendiga. Abiks spetsialistile | <https://www.tai.ee/sites/default/files/2021-03/156526502566_Too_alkoholiliigtarvitava_kliendiga%202019aasta_web_.pdf> |
| Tervise Arengu Instituut | Uimasteid tarvitavatele inimestele suunatud teenuste toimimise ja teenustevahelise koostöö korraldus Eestis ja välisriikides: lõpparuanne | <https://www.tai.ee/sites/default/files/2025-09/uimasteid_tarvitavate_inimeste_teenuste_uuringu_aruanne_0.pdf> |
| Tervise Arengu Instituut | Uimasteid tarvitavatele inimestele suunatud tõenduspõhiste väheintensiivsete psühholoogiliste sekkumiste ülevaade | <https://www.tai.ee/sites/default/files/2025-04/vipsid_lopparuanne.pdf> |
| Tervise Arengu Instituut | Uimastite tarvitamine koolinoorte seas: tubakatoodete, alkoholi ja narkootiliste ainete tarvitamine Eesti 15–16-aastaste õpilaste seas | <https://www.tai.ee/sites/default/files/2025-04/espad_raport_2024_25.04.2025.pdf> |
| Tervise Arengu Instituut | Vanemaealiste vigastused 2016─2020 | <https://www.tai.ee/sites/default/files/2022-01/Vanemaealiste%20vigastused%202016-2020.pdf> |
| Tervise Arengu Instituut | VEPA Käitumisoskuste Mängu rakendamise vahehindamine | <https://www.tai.ee/sites/default/files/2021-03/151721412645_VEPA_vahehindamine_lopparuanne.pdf> |
| Tervisekassa | Alkoholi liigtarvitamine – mis see on ja kust saab abi | <https://tervisekassa.ee/media/337/download?inline> |
| Tervisekassa | Vaevuste leevendamine palliatiivses ravis | <https://tervisekassa.ee/media/388/download?inline> |
| Tervisekassa | Vähem alkoholi. Kas ja kuidas? | <https://tervisekassa.ee/media/321/download?inline> |
| Tervisekassa | Ärevuse töövihik | <https://tervisekassa.ee/media/712/download?inline> |
| Verge Eesti | Sekkumised koolivägivalla ja koolikiusamise korral | <https://www.verge.ee/wp-content/uploads/2023/08/verge_koolikiusjavagivald_A4-3.pdf> |

### Omavalitsuste kontaktid (1638)

Ainult arvud: kontakti pealkiri on isiku nimi ja seda siia ei kirjutata.

| Omavalitsus | Dokumente |
|---|---:|
| Alutaguse vald | 16 |
| Anija vald | 13 |
| Antsla vald | 14 |
| Elva vald | 27 |
| Haapsalu linn | 24 |
| Haljala vald | 10 |
| Harku vald | 21 |
| Hiiumaa vald | 15 |
| Häädemeeste vald | 19 |
| Jõelähtme vald | 15 |
| Jõgeva vald | 32 |
| Jõhvi vald | 36 |
| Järva vald | 18 |
| Kadrina vald | 15 |
| Kambja vald | 18 |
| Kanepi vald | 16 |
| Kastre vald | 20 |
| Kehtna vald | 17 |
| Keila linn | 18 |
| Kihnu vald | 9 |
| Kiili vald | 15 |
| Kohila vald | 8 |
| Kohtla-Järve linn | 37 |
| Kose vald | 11 |
| Kuusalu vald | 16 |
| Loksa linn | 9 |
| Luunja vald | 11 |
| Lääne-Harju vald | 24 |
| Lääne-Nigula vald | 17 |
| Lääneranna vald | 15 |
| Lüganuse vald | 12 |
| Maardu linn | 11 |
| Muhu vald | 5 |
| Mulgi vald | 11 |
| Mustvee vald | 21 |
| Märjamaa vald | 12 |
| Narva linn | 42 |
| Narva-Jõesuu linn | 31 |
| Nõo vald | 13 |
| Otepää vald | 21 |
| Paide linn | 26 |
| Peipsiääre vald | 20 |
| Põhja-Pärnumaa vald | 13 |
| Põhja-Sakala vald | 20 |
| Põltsamaa vald | 13 |
| Põlva vald | 16 |
| Pärnu linn | 62 |
| Raasiku vald | 15 |
| Rae vald | 21 |
| Rakvere linn | 18 |
| Rakvere vald | 16 |
| Rapla vald | 23 |
| Ruhnu vald | 3 |
| Rõuge vald | 23 |
| Räpina vald | 15 |
| Saarde vald | 15 |
| Saaremaa vald | 47 |
| Saku vald | 11 |
| Saue vald | 15 |
| Setomaa vald | 16 |
| Sillamäe linn | 9 |
| Tallinna linn | 133 |
| Tapa vald | 16 |
| Tartu linn | 84 |
| Tartu vald | 13 |
| Tori vald | 22 |
| Tõrva vald | 18 |
| Türi vald | 21 |
| Valga vald | 49 |
| Viimsi vald | 17 |
| Viljandi linn | 25 |
| Viljandi vald | 22 |
| Vinni vald | 18 |
| Viru-Nigula vald | 10 |
| Vormsi vald | 6 |
| Võru linn | 15 |
| Võru vald | 25 |
| Väike-Maarja vald | 12 |
<!-- corpus-outside:end -->
