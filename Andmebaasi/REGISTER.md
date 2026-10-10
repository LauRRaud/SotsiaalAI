# Andmebaasi allikad ja failiregister

Siin on andmebaasi sisendmaterjalid ja nendega seotud metaandmed. Täielik masinloetav faililoend koos SHA-256 kontrollsummadega on [REGISTER.json](REGISTER.json). Mis on serveris RAG-is, näitab jaotis „RAG-i seis: mis on serveris“; lehtede ja kontaktide loend on faili lõpus.

| Kaust | Allikafaile | Faile kokku | Kasutus |
|---|---:|---:|---|
| ajakiri_sotsiaaltoo | 892 | 1784 | 892 artiklit: 849 PDF-i ja 43 HTML-i koos metaandmetega. |
| juhendid_ja_uuringud | 185 | 370 | Unikaalsed PDF-id; JSON säilitab kohaliku ja serveri metaandmevariandid. |
| KOV | 78 | 234 | 78 KOV-i põhipaketti koos metaandmete ja allikaloenditega. |
| kontaktid | 0 | 10 | Kontaktide otsingumaterjal; kattuvus KOV-pakettidega vajab ühendamist. |
| organisatsioonid | 1 | 3 | Ühe organisatsiooni (Astangu) käsitsi koostatud pakett: sisu ja allikad. RAG-is seda paketti ei ole. Organisatsioonide enda veebilehed on RAG-is (vt „RAG-i seis“). |
| oigusaktid | 638 | 652 | XML-aktid, sh eri redaktsioonid ja omavalitsuste teised kehtivad sotsiaalaktid (ADR-058); kehtivus tuleb vastuvõtul kontrollida. Aktide lisadest tuletatud allikad (`lisad/`): kaks tabelit (ADR-050) ja kaksteist omavalitsuse lisa teksti (ADR-053); iga tuletatud allikas nimetab oma akti redaktsiooni. Üks akt on allikas ainult nimetatud paragrahvide ulatuses (registrikirje väli `xml_sections`, ADR-076): `103072026024.xml`, 2026. aasta riigieelarve seaduse § 2; fail ise on Riigi Teataja algfail. |
| teadmised | 0 | 7 | Allikapõhised teadmiskaardid (tingimused, erandid, mõisted ja nende seosed) valitud allikatele; iga fail on seotud oma allika räsiga (ADR-054). |
| register | 0 | 9 | Kavandatud allikate register ja korjatavate veebilehtede nimekirjad (`web_pages.json` ametlikud juhislehed, `web_pages_state_help.json` riigi tasandi abi juhislehed (pension, perehüvitised, elatisabi, perelepitus; ADR-111), `web_pages_state_help_2.json` riigi tasandi abi teine partii (ravikindlustus, kohtusse pöördumine, võlad, pärimine, ohvriabi, puue ja hoolekanne, politsei juhised; ADR-112), `web_pages_state_help_3.json` kolmas partii (riigi õigusabi, täitemenetlus, perekonna- ja pärimisõigus, kuriteoohvri õigused, toe vajadusega õpilane; ADR-115), `web_pages_vendors.json` abivahendite müüjate lehed, `web_pages_organisations.json` puuetega inimeste organisatsioonide lehed koos mustriga, mis pealkirja järgi välja jääb; ADR-095), mitte teadmistekst. Mis müüjate ja organisatsioonide lehtedest RAG-is on, näitab „RAG-i seis“. `newsletter_documents.json` on ajakirja Sotsiaaltöö uudiskirjas viidatud dokumentide loend (ADR-099): pealkiri, väljaandja ametlik aadress ja seis, sh need, mida RAG-is ei ole (ingliskeelsed, tekstikihita, liiga suured, vastuvõtu kinni peetud, arvutabelid). |
| veebilehed | 361 | 722 | Ametlikud juhislehed, korjatud skriptiga `scripts/rag-v2-web-pages.mjs` (ADR-095): lehe sisuosa ilma saidi menüüde ja isikute kontaktideta, metaandmetes aadress, kontrolli kuupäev ja viidatud dokumendid. |
| taastatud_allikad | 0 | 22 | Serveri vanast indeksist taastatud tekst. Enne importi võrrelda põhipakettidega. |

<!-- corpus-state:start (kirjutab scripts/rag-v2-register-corpus.mjs; käsitsi ei muudeta) -->
## RAG-i seis: mis on serveris (korpus v75)

Seis 10.10.2026: serveris töötav RAG (korpus **v75**, indeks `331f9dec`) sisaldab **8 722 dokumenti** (80 948 lõiku). Arvud on loetud korpusest skriptiga `scripts/rag-v2-register-corpus.mjs`; pärast iga korpuse täiendust käivitatakse see uuesti.

| Mis on RAG-is | Dokumente | Kus on loend |
|---|---:|---|
| Omavalitsuste teenused ja toetused | 3195 | jaotis „Sisufailid“ |
| Taotlusvormid (vastuses antakse lingina) | 872 | jaotis „Sisufailid“ |
| Omavalitsuste kontaktid | 1638 | faili lõpus arvudena omavalitsuste kaupa (nimesid siia ei kirjutata) |
| Ajakirja Sotsiaaltöö artiklid | 892 | jaotis „Sisufailid“ |
| Õigusaktid | 592 | jaotis „Sisufailid“ |
| Juhendid, infomaterjalid ja uuringud | 429 | jaotis „Sisufailid“; väljaandja ametlikult aadressilt lisatud on faili lõpus |
| Ametlikud juhislehed (ametite veebilehed) | 360 | jaotis „Sisufailid“ |
| Puuetega inimeste organisatsioonide lehed | 521 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| Hooldekodude kohamaksumus omavalitsuste kaupa | 79 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| Abivahendite müügi- ja üüripunktid | 93 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| Abivahendite müüjate lehed | 51 | faili lõpus: „RAG-is olevad lehed ja kontaktid“ |
| **Kokku** | **8722** | |

<details><summary>Tehniline jaotus arendajale: kus allikafailid asuvad</summary>

Dokumentide arvud ei võrdu ülal olevate failide arvudega: üks fail võib anda mitu dokumenti (omavalitsuse pakett annab teenuste, vormide ja kontaktide dokumendid). `REGISTER.json` näitab iga allikafaili juures, mitu dokumenti see annab (`corpus_documents`).

| Kaust | Dokumente | Allikaliigid |
|---|---:|---|
| `KOV` | 4498 | kov_service_info 3195, application_form 845, official_contact 431, web_form 17, pdf_form 6, official_form 4 |
| `ajakiri_sotsiaaltoo` | 892 | file 849, web 43 |
| `oigusaktid` | 592 | legal_act 592 |
| `veebilehed` | 361 | web_page 360, research_report 1 |
| `juhendid_ja_uuringud` | 171 | information_material 81, research_report 46, official_guideline 38, policy_analysis 6 |

Koodihoidlas (GitHub) ei ole 2208 dokumendi allikafaile; need on korpuse hoidlas (arvuti `tmp/` kaust ja server):

| Allikas | Dokumente | Millest tehakse | Miks ei ole koodihoidlas |
|---|---:|---|---|
| Omavalitsuste kontaktid ja kontaktikataloogid | 1207 | rakenduse kontaktiregistrist skriptiga `scripts/rag-v2-contact-export.mjs` (ADR-085, ADR-086) | isikute nimed, telefoninumbrid ja e-posti aadressid |
| Hooldekodude kohamaksumuse lehed | 79 | Sotsiaalkindlustusameti hinnaseire tabelist skriptiga `scripts/rag-v2-care-prices.mjs`, iga omavalitsuse kohta üks leht ja üks ülevaade (ADR-104) | hooldekodude telefoninumbrid; leht tehakse tabelist uuesti |
| Abivahendite müügi- ja üüripunktide lehed | 93 | Sotsiaalkindlustusameti kaarditabelist skriptiga `scripts/rag-v2-assistive-points.mjs`, iga omavalitsuse kohta üks leht (ADR-096) | punktide telefoninumbrid; leht tehakse tabelist uuesti |
| Abivahendite müüjate lehed | 51 (18 väljaandjat) | nimekiri `register/web_pages_vendors.json`, korjaja `scripts/rag-v2-web-pages.mjs` (ADR-095) | ettevõtete enda tekstid ja telefoninumbrid |
| Puuetega inimeste organisatsioonide lehed | 521 (43 väljaandjat) | nimekiri `register/web_pages_organisations.json`, korjaja `scripts/rag-v2-web-pages.mjs` ja valik `scripts/rag-v2-web-select.mjs` (ADR-095) | organisatsioonide enda tekstid |
| Uuringud ja juhendid väljaandja ametlikult aadressilt | 257 (30 väljaandjat) | asutuste veebilehtede uuringute ja juhendite loenditest ning ajakirja Sotsiaaltöö uudiskirjas viidatud dokumentidest (`register/newsletter_documents.json`); iga fail on alla laaditud väljaandja ametlikult aadressilt | suured failid; allikas on ametlik aadress |

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

Serveris töötav RAG, korpus v75, 10.10.2026. Siin on loend sellest, mida jaotis „Sisufailid“ ei loetle.

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

### Puuetega inimeste organisatsioonide lehed (521)

| Väljaandja | Pealkiri | Aadress |
|---|---|---|
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
| Eesti Neeruhaigete Liit | Kõik neerudest. | <https://www.neer.ee/> |
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

### Uuringud ja juhendid väljaandja ametlikult aadressilt (257)

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
