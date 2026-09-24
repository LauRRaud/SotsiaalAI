# Andmebaasi allikad ja failiregister

Siin on andmebaasi sisendmaterjalid ja nendega seotud metaandmed. Täielik masinloetav faililoend koos SHA-256 kontrollsummadega on [REGISTER.json](REGISTER.json).

| Kaust | Allikafaile | Faile kokku | Kasutus |
|---|---:|---:|---|
| ajakiri_sotsiaaltoo | 892 | 1784 | 892 artiklit: 849 PDF-i ja 43 HTML-i koos metaandmetega. |
| juhendid_ja_uuringud | 185 | 370 | Unikaalsed PDF-id; JSON säilitab kohaliku ja serveri metaandmevariandid. |
| KOV | 78 | 234 | 78 KOV-i põhipaketti koos metaandmete ja allikaloenditega. |
| kontaktid | 0 | 10 | Kontaktide otsingumaterjal; kattuvus KOV-pakettidega vajab ühendamist. |
| organisatsioonid | 1 | 3 | Organisatsiooni korjatud sisu ja allikad. |
| oigusaktid | 104 | 104 | XML-aktid, sh eri redaktsioonid; kehtivus tuleb vastuvõtul kontrollida. |
| register | 0 | 2 | Kavandatud allikate register, mitte teadmistekst. |
| taastatud_allikad | 0 | 22 | Serveri vanast indeksist taastatud tekst. Enne importi võrrelda põhipakettidega. |

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
| Tallinna kontaktid | [kontaktid/tallinn/tallinn.contacts.json](kontaktid/tallinn/tallinn.contacts.json) |
