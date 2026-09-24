# RAG: kõik puuduvad ja vigased kirjed

Koostatud: 2026-08-14T09:23:30.698Z

Kategooriad võivad kattuda. Näiteks katkise lingiga PDF võib olla korraga nii serverist puudu kui ka lokaalselt allalaadimata.
Serveri normaliseeritud eksport ei sisalda source-master päritolu-ID ega last_checked välja. Nende puudumist ekspordis ei käsitleta kinnitatud serveriveana.

## Kokkuvõte

- Serveri dokumente: **5819**
- Kohalik täissisu: **5809**
- Serveris olemas, lokaalselt täiesti puudu: **2**
- Serveris olemas, lokaalselt ainult metaandmed: **8**
- Serveris null sisutükiga: **0 dokumenti / 0 unikaalset allikat**
- PDF allalaadimine ebaõnnestus: **6**
- Sama allikas mitme serveri dokumendi-ID all: **0**
- 323-kirjelisest master-listist serveris puudu: **156** (143 HTML + 13 PDF)
  - HTML: 137 ainult viitena + 6 ingest-kandidaati
  - PDF: 7 ülevaatust vajavat kohalikku faili + 6 ingest-kandidaati, mille allalaadimine ebaõnnestus
- Kohalik sisu olemas, kuid ID ei kattu täpselt: **20**
- Master-listi päritolu-ID pole ekspordist tõendatav: **167**
- Värskus pole ekspordist tõendatav: **167** master-listi vastel
- Toor-HTML arhiivifaile: **0**

## CONFIRMED_MISSING_LOCAL (2, high)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|
| `national-rt-130122025029` | Sotsiaalhoolekande seadus | TEXT | PRESENT | NOT_FOUND | none |
| `kov::maardu-linn::item::maardu_linn_form_sunnitoetuse_avaldus` | Sünnitoetuse avaldus | TEXT | PRESENT | NOT_FOUND | none |

## LOCAL_METADATA_ONLY (8, high)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|
| `kov::maardu-linn::item::maardu_linn_resource_abivahendite_info` | Abivahendite taotlemise info | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_form_eestkoste_taotlus` | Eestkoste seadmise taotlus | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_form_eluruumi_teenuse_taotlus` | Eluruumi teenuse taotlus | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_form_koduteenuse_taotlus` | Koduteenuse taotluse vorm | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_form_lapsehoiutoetuse_taotlus` | Lapsehoiutoetuse taotlus | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_benefit_raske_ja_sugava_puudega_laste_teenuste_toetus` | Raske ja sügava puudega laste toetavad teenused | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_form_sotsiaalteenuse_taotlus` | Sotsiaalteenuse taotlus | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |
| `kov::maardu-linn::item::maardu_linn_form_raske_sugava_puudega_lapse_teenuse_taotlus` | Taotlus raske ja sügava puudega lapsele teenuse osutamiseks | TEXT | PRESENT | LOCAL_METADATA_ONLY | normalized_url_without_local_source_content; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json \| docs/Andmebaas/KOV/maardu-linn/maardu-linn.sources.json |

## SERVER_ZERO_CHUNK_SOURCES (0, high)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|

## PDF_DOWNLOAD_FAILED (6, high)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|
| `tai_tai_aastaaruanne_2025` | TAI aastaaruanne 2025 | pdf | MISSING | DOWNLOAD_FAILED | HTTP 401 |
| `terviseamet_patsiendiohutusjuhtumi_raporteerimise_ja_menetlemise_juhend` | Patsiendiohutusjuhtumi raporteerimise ja menetlemise juhend | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `terviseamet_pohak_i_aasta_kokkuvote` | POHAK I aasta kokkuvõte | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `terviseamet_taiskasvanute_vaktsineerimissoovitused` | Täiskasvanute vaktsineerimissoovitused | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `tootukassa_ska_sotsiaalministeerium_kes_aitab_ja_kuhu_poorduda_kui_vajad_tooealisena_tuge` | Kes aitab ja kuhu pöörduda, kui vajad tööealisena tuge? | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `sotsiaalkindlustusamet_ohvriabi_infomaterjalide_kataloog_2026` | Ohvriabi infomaterjalide kataloog 2026 | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |

## SERVER_DUPLICATE_SOURCE_MATCH (0, medium)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|

## MASTER_MISSING_FROM_SERVER (156, info)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|
| `eesti_puuetega_inimeste_koda_eesti_puuetega_inimeste_koda_epikoda` | Eesti Puuetega Inimeste Koda (EPIKoda) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `eesti_puuetega_inimeste_koda_epikoja_liikmed` | EPIKoja liikmed | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `eesti_puuetega_inimeste_koda_epikoja_vorgustiku_kontaktid` | EPIKoja võrgustiku kontaktid | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `1_katusorganisatsioonid_ja_kojad_tallinna_puuetega_inimeste_koda` | Tallinna Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `1_katusorganisatsioonid_ja_kojad_tallinna_koja_liikmesuhingud` | Tallinna Koja liikmesühingud | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `1_katusorganisatsioonid_ja_kojad_eesti_puuetega_inimeste_fond` | Eesti Puuetega Inimeste Fond | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_tartu_puuetega_inimeste_koda` | Tartu Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_parnumaa_puuetega_inimeste_koda` | Pärnumaa Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_ida_virumaa_puuetega_inimeste_koda` | Ida-Virumaa Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_laane_virumaa_puuetega_inimeste_koda` | Lääne-Virumaa Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_saaremaa_puuetega_inimeste_koda` | Saaremaa Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_viljandimaa_puuetega_inimeste_noukoda` | Viljandimaa Puuetega Inimeste Nõukoda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_vorumaa_puuetega_inimeste_koda` | Võrumaa Puuetega Inimeste Koda | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `maakondlikud_kojad_polvamaa_puuetega_inimeste_koda_kataloogileht` | Põlvamaa Puuetega Inimeste Koda (kataloogileht) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_eesti_pimedate_liit` | Eesti Pimedate Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_epl_liikmesuhingud` | EPL liikmesühingud | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_pohja_eesti_pimedate_uhing` | Põhja-Eesti Pimedate Ühing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_ppu_infoleht_kuukiir` | PPÜ infoleht "Kuukiir" | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_eesti_pimekurtide_tugiliit` | Eesti Pimekurtide Tugiliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_pimedate_raamatukogu_rara` | Pimedate raamatukogu (RaRa) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_tallinna_noustamine_nagemispuudega_inimesele` | Tallinna nõustamine nägemispuudega inimesele | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_nirk` | NIRK | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_epl_teemaleht_nagemispuue` | EPL teemaleht „Nägemispuue” | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemispuue_ja_liitpuue_sotsiaalministeeriumi_kompetentsikeskus_eesti_pimedate_liit` | Sotsiaalministeeriumi kompetentsikeskus: Eesti Pimedate Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_eesti_kurtide_liit` | Eesti Kurtide Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_tallinna_ja_harjumaa_kurtide_uhing` | Tallinna ja Harjumaa Kurtide Ühing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_eesti_vaegkuuljate_liit` | Eesti Vaegkuuljate Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_evl_liidust` | EVL „Liidust” | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_eesti_kuulmispuuetega_laste_vanemate_liit` | Eesti Kuulmispuuetega Laste Vanemate Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_eesti_viipekeeletolkide_kutseuhing` | Eesti Viipekeeletõlkide Kutseühing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmispuue_kurtus_ja_viipekeel_viipekeeletolgid_ou` | Viipekeeletõlgid OÜ | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `liikumispuue_ja_iseseisev_elu_eesti_liikumispuudega_inimeste_liit` | Eesti Liikumispuudega Inimeste Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `liikumispuue_ja_iseseisev_elu_tallinna_liikumispuudega_inimeste_uhing` | Tallinna Liikumispuudega Inimeste Ühing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `liikumispuue_ja_iseseisev_elu_mtu_iseseisev_elu` | MTÜ Iseseisev Elu | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `liikumispuue_ja_iseseisev_elu_eesti_paralumpiakomitee` | Eesti Paralümpiakomitee | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__vaimukad_eesti_vaimupuudega_inimeste_tugiliit` | Vaimukad / Eesti Vaimupuudega Inimeste Tugiliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__tugiliisu` | Tugiliisu | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__eesti_autismiliit` | Eesti Autismiliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__pohja_eesti_autismi_liit` | Põhja-Eesti Autismi Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__eppil` | EPPiL | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__dementsuse_kompetentsikeskus` | Dementsuse Kompetentsikeskus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__elu_dementsusega` | Elu dementsusega | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__eesti_puuetega_naiste_uhenduste_liit` | Eesti Puuetega Naiste Ühenduste Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `intellekti_autismi_psuuhikahairete__eesti_aspergerite_autistide_liidu_vana_wordpress_kanal` | Eesti Aspergerite / Autistide liidu vana WordPress-kanal | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kone_ja_kommunikatsioonihaired_eesti_afaasialiit` | Eesti Afaasialiit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kone_ja_kommunikatsioonihaired_eesti_kogelejate_uhing` | Eesti Kogelejate Ühing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_sclerosis_multiplexi_uhingute_liit` | Eesti Sclerosis Multiplexi Ühingute Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_parkinsoniliit` | Eesti Parkinsoniliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_insuldipatsientide_selts` | Eesti Insuldipatsientide Selts | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_hemofiiliauhing` | Eesti Hemofiiliaühing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_lihasehaigete_selts` | Eesti Lihasehaigete Selts | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_allergialiit` | Eesti Allergialiit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_diabeediliit` | Eesti Diabeediliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_reumaliit` | Eesti Reumaliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_kopsuliit` | Eesti Kopsuliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_vahiliit` | Eesti Vähiliit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_neeruhaigete_liit` | Eesti Neeruhaigete Liit | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_pohja_eesti_neeruhaigete_selts_facebook` | Põhja-Eesti Neeruhaigete Selts (Facebook) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_eesti_epilepsialiit_ajalooline_registripohine_viide` | Eesti Epilepsialiit (ajalooline / registripõhine viide) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `neuroloogilised_ja_kroonilised_seis_epilepsiaga_inimeste_tugigrupp_facebook` | Epilepsiaga inimeste tugigrupp (Facebook) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_abivahendi_vajajale` | SKA: Abivahendi vajajale | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_abivahendite_otsimootor` | SKA abivahendite otsimootor | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_abivahendi_ettevottele` | SKA: Abivahendi ettevõttele | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `riiklik_info_ja_otsingud_msa_abivahendite_jaemuujate_otsing` | MSA abivahendite jaemüüjate otsing | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_invaru` | Invaru | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_itak` | ITAK | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_teresa_abivahendikeskus` | Teresa Abivahendikeskus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_tervise_abi` | Tervise Abi | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_egero_invaabivahendid` | Egero / Invaabivahendid | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_invago` | INVAGO | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `uldised_pakkujad_rol_lift` | Rol-Lift | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemisabivahendid_silmalaegas` | Silmalaegas | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `nagemisabivahendid_eesti_nagemistervisekeskus_abivahendid` | Eesti Nägemistervisekeskus / abivahendid | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmisabivahendid_kuulmisrehabilitatsiooni_keskus` | Kuulmisrehabilitatsiooni Keskus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmisabivahendid_audiomed_kuulmiskeskus` | Audiomed kuulmiskeskus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmisabivahendid_kuuldeaparaadid_ou` | Kuuldeaparaadid OÜ | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `kuulmisabivahendid_tervise_abi_kuulmisabivahendid` | Tervise Abi / kuulmisabivahendid | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_itak_remont_ja_hooldus` | ITAK remont ja hooldus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_e_ratastoolid` | E-ratastoolid | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_ortopeediakeskus` | Ortopeediakeskus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_ortopeediakeskus_abivahendite_taotlemine` | Ortopeediakeskus / abivahendite taotlemine | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_eesti_ortoosikeskus` | Eesti Ortoosikeskus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_jalaexpert` | Jalaexpert | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_jalakabinet` | Jalakabinet | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `remont_hooldus_ortoosid_mediq_eesti` | Mediq Eesti | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `4_ligipaasetavus_eesti_ee_ligipaasetavuse_juhis` | eesti.ee ligipääsetavuse juhis | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `4_ligipaasetavus_sotsiaalministeeriumi_kompetentsikeskus_ligipaasetavus` | Sotsiaalministeeriumi kompetentsikeskus / ligipääsetavus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `4_ligipaasetavus_mis_on_ligipaasetavus` | Mis on ligipääsetavus? | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `4_ligipaasetavus_ligipaasetavuse_tagamine_sotsiaalkaitse_ja_sotsiaalse_kaasat` | Ligipääsetavuse tagamine sotsiaalkaitse ja sotsiaalse kaasatuse valdkonnas | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tervise_arengu_instituut_tai_ligipaasetavus_kelle_jaoks` | TAI: Ligipääsetavus – kelle jaoks? | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `eesti_puuetega_inimeste_koda_epikoda_digiligipaasetavus` | EPIKoda: digiligipääsetavus | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_teenusepakkujad` | SKA teenusepakkujad | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_teenuskohad` | SKA teenuskohad | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_rehabilitatsiooniteenuste_osutajatele` | Rehabilitatsiooniteenuste osutajatele | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_erihoolekandeteenuse_osutajale` | Erihoolekandeteenuse osutajale | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_mtr` | MTR | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_ttja_teade_mtr_kohta` | TTJA teade MTR kohta | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_riha_mtr_kirje` | RIHA MTR kirje | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_andmed_eesti_ee_mtr_andmestik` | andmed.eesti.ee / MTR andmestik | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_medre` | Medre | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_eesti_ee_erihoolekandeteenuse_osutaja_tegevusluba` | eesti.ee / erihoolekandeteenuse osutaja tegevusluba | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `terviseamet_terviseamet_tervishoiutootajale` | Terviseamet / tervishoiutöötajale | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `terviseamet_tervishoiutootajate_registreerimine` | Tervishoiutöötajate registreerimine | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `terviseamet_tegevusload_tervishoiuteenuse_osutamiseks` | Tegevusload tervishoiuteenuse osutamiseks | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tervisekassa_tervisekassa_tervishoiuteenuste_osutajad` | Tervisekassa / tervishoiuteenuste osutajad | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_e_ariregister` | e-Äriregister | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `registrid_rik_e_ariregistri_portaal` | RIK / e-äriregistri portaal | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_sotsiaalteenuste_jarelevalve` | SKA sotsiaalteenuste järelevalve | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_uldhooldusteenus_kov_noustamine_jarelevalve_raam` | Üldhooldusteenus (KOV nõustamine + järelevalve raam) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalkindlustusamet_ska_2024_jarelevalve_kokkuvote` | SKA 2024 järelevalve kokkuvõte | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `terviseamet_terviseamet_sotsiaalasutuste_jarelevalve` | Terviseamet / sotsiaalasutuste järelevalve | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `terviseamet_terviseamet_erihoolekandeteenused` | Terviseamet / erihoolekandeteenused | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `terviseamet_terviseamet_infomaterjalid_hoolekandeasutustele` | Terviseamet / infomaterjalid hoolekandeasutustele | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `paasteamet_paasteamet_tuleohutusnouded` | Päästeamet / tuleohutusnõuded | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `6_kvaliteet_jarelevalve_ja_ohutus_riigi_teataja_ehitisele_esitatavad_tuleohutusnouded` | Riigi Teataja / ehitisele esitatavad tuleohutusnõuded | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `oiguskantsler_avaldus_oiguskantslerile` | Avaldus õiguskantslerile | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `andmekaitse_inspektsioon_aki_kaebus_isikuandmete_kaitse_asjas` | AKI kaebus isikuandmete kaitse asjas | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `andmekaitse_inspektsioon_aki_nousolek` | AKI nõusolek | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `riigikontroll_riigikontrolli_auditileht_hoolekande_audit` | Riigikontrolli auditileht (hoolekande audit) | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `8_markused_puhastamisel_kopsuliidu_puhul_kasutas_fail_aadressi_kuid_kontrollitav_ja_` | Kopsuliidu puhul kasutas fail aadressi `, kuid kontrollitav ja toimiv kuju oli `https://www.kopsuliit.ee/`. | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `8_markused_puhastamisel_kopsuliidu_puhul_kasutas_fail_aadressi_https_kopsuliit_ee_ku` | Kopsuliidu puhul kasutas fail aadressi `https://kopsuliit.ee/`, kuid kontrollitav ja toimiv kuju oli `. | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `8_markused_puhastamisel_parnumaa_koja_puhul_kasutasin_toimivat_punycode_kuju` | Pärnumaa koja puhul kasutasin toimivat punycode-kuju `. | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_tai_aastaaruanne_2025` | TAI aastaaruanne 2025 | pdf | MISSING | DOWNLOAD_FAILED | HTTP 401 |
| `tartu_ulikooli_repositoorium_sotsiaaltootajad_raagivad_sotsiaaltoo_praktika_muutumisest` | Sotsiaaltöötajad räägivad sotsiaaltöö praktika muutumisest | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tartu_ulikooli_repositoorium_info_ja_kommunikatsioonitehnoloogia_kasutamine_sotsiaaltoos` | Info- ja kommunikatsioonitehnoloogia kasutamine sotsiaaltöös | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tartu_ulikooli_repositoorium_lastekaitsetootajate_tolgendused` | Lastekaitsetöötajate tõlgendused ... | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tartu_ulikooli_repositoorium_lastekaitsetooga_kokku_puutunud_laste_ja_lahedaste_vaade_las` | Lastekaitsetööga kokku puutunud laste ja lähedaste vaade lastekaitsetööle Eestis | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tartu_ulikooli_repositoorium_sotsiaaltootajate_voimu_kasutus_ja_piirangud_sotsiaaltoo_pra` | Sotsiaaltöötajate võimu kasutus ja piirangud sotsiaaltöö praktikas | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tartu_ulikooli_repositoorium_kogukonna_kaasamine_olulistesse_kogukonda_puudutavatesse_ots` | Kogukonna kaasamine olulistesse kogukonda puudutavatesse otsustesse | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tartu_ulikooli_repositoorium_fotod_kui_toetav_vahend_sotsiaaltoos` | Fotod kui toetav vahend sotsiaaltöös | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `taltechi_digikogu_labipolemise_teemaline_too` | Läbipõlemise teemaline töö | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `taltechi_digikogu_taiendav_taltechi_too` | Täiendav TalTechi töö | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_sotsiaaltoo_1_2025` | Sotsiaaltöö 1/2025 | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_sotsiaaltoo_2_2025` | Sotsiaaltöö 2/2025 | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_sotsiaaltoo_2_2022` | Sotsiaaltöö 2/2022 | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_sotsiaaltoo_4_2019` | Sotsiaaltöö 4/2019 | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_ajakirja_sotsiaaltoo_tutvustus_arhiiv` | Ajakirja Sotsiaaltöö tutvustus / arhiiv | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tai_dea_valjaande_leht` | DEA väljaande leht | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tervisekassa_vaevuste_leevendamine_palliatiivses_ravis` | Vaevuste leevendamine palliatiivses ravis | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tervisekassa_pikk_covid_patsiendijuhend` | Pikk COVID patsiendijuhend | pdf | MISSING | LOCAL_FILE_EXISTS |  |
| `tervisekassa_pikk_covid_esmatasandil_kasitlusjuhend` | Pikk COVID esmatasandil: käsitlusjuhend | pdf | MISSING | LOCAL_FILE_EXISTS |  |
| `terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_j` | Infektsioonikontrollialase toimepidevuse ja riskijuhtimise juhendmaterjal hoolekandeasutustele | pdf | MISSING | LOCAL_FILE_EXISTS |  |
| `terviseamet_infektsioonikontrollialase_toimepidevuse_ja_riskijuhtimise_m` | Infektsioonikontrollialase toimepidevuse ja riskijuhtimise metoodika | pdf | MISSING | LOCAL_FILE_EXISTS |  |
| `terviseamet_nakkushaiguste_ennetamise_ja_torjealane_tegevusjuhend_hoolde` | Nakkushaiguste ennetamise ja tõrjealane tegevusjuhend hooldekodudele | pdf | MISSING | LOCAL_FILE_EXISTS |  |
| `terviseamet_hoolekandeasutuste_tegevusjuhis_covid_19_tingimustes` | Hoolekandeasutuste tegevusjuhis COVID-19 tingimustes | pdf | MISSING | LOCAL_FILE_EXISTS |  |
| `terviseamet_patsiendiohutusjuhtumi_raporteerimise_ja_menetlemise_juhend` | Patsiendiohutusjuhtumi raporteerimise ja menetlemise juhend | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `terviseamet_pohak_i_aasta_kokkuvote` | POHAK I aasta kokkuvõte | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `terviseamet_taiskasvanute_vaktsineerimissoovitused` | Täiskasvanute vaktsineerimissoovitused | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `tootukassa_ska_sotsiaalministeerium_toovoime_hindamise_metoodika` | Töövõime hindamise metoodika | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tootukassa_ska_sotsiaalministeerium_toovoime_hindamine` | Töövõime hindamine | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `tootukassa_ska_sotsiaalministeerium_kes_aitab_ja_kuhu_poorduda_kui_vajad_tooealisena_tuge` | Kes aitab ja kuhu pöörduda, kui vajad tööealisena tuge? | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `sotsiaalkindlustusamet_ohvriabi_infomaterjalide_kataloog_2026` | Ohvriabi infomaterjalide kataloog 2026 | pdf | MISSING | DOWNLOAD_FAILED | HTTP 404 |
| `sotsiaalkindlustusamet_sotsiaalse_rehabilitatsiooni_teenuse_osutamise_juhend` | Sotsiaalse rehabilitatsiooni teenuse osutamise juhend | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalministeerium_puude_raskusastme_tuvastamine_ja_toovoime_hindamine` | Puude raskusastme tuvastamine ja töövõime hindamine | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `sotsiaalministeerium_ohvriabi_susteemi_arendamine` | Ohvriabi süsteemi arendamine | html | MISSING | NO_RAW_HTML_SNAPSHOT |  |
| `astangu_harjutuste_kogu` | Harjutuste kogu | pdf | MISSING | LOCAL_FILE_EXISTS |  |

## ID_DRIFT_STRONG_CONTENT_MATCH (20, medium)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|
| `sotsiaaltoo-2-2024-elut-preemia-laureaat-kai-rannastu-uksi-sotsiaaltood-ei-tee-2024-2` | Elutööpreemia laureaat Kai Rannastu: „Üksi sotsiaaltööd ei tee!“ | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/24-2/Sotsiaaltoo_2_2024_web_Part3.pdf \| docs/Andmebaas/ajakiri_sotsiaaltoo/24-2/sotsiaaltoo-2-2024-artikkel-02-kai_rannastu.json |
| `sotsiaaltoo-4-2020-ennetava-sekkumise-mojuanal-si-voimalusi-spin-programmi-naitel-2020-4` | Ennetava sekkumise mõjuanalüüsi võimalusi SPIN-programmi näitel | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/20-4/Ennetava_sekkumise_mõjuanalüüsi.json \| docs/Andmebaas/ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part14.pdf |
| `sotsiaaltoo-3-2021-interdistsiplinaarsed-loovmeetodid-sotsiaalt-s-virtuaalne-konverents-tudengilt-tudengile` | Interdistsiplinaarsed loovmeetodid sotsiaaltöös (virtuaalne konverents tudengilt‑tudengile) | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/21-3/Interdistsiplinaarsed_loovmeetodid_sotsiaaltöös.json \| docs/Andmebaas/ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part17.pdf |
| `kov::maardu-linn::item::maardu_linn_service_isikliku_abistaja_teenus` | Isikliku abistaja teenus | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json |
| `kov::maardu-linn::item::maardu_linn_contact_jekaterina_djomina` | Jekaterina Djomina | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `kov::maardu-linn::item::maardu_linn_contact_jelena_afonova` | Jelena Afonova | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `sotsiaaltoo-3-2021-kanep-mis-on-mis` | Kanep – mis on mis? | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/21-3/Kanep_–_mis.json \| docs/Andmebaas/ajakiri_sotsiaaltoo/21-3/Sotsiaaltoo_3_2021_web_link_Part18.pdf |
| `kov::maardu-linn::item::maardu_linn_contact_karina_neimla_nikiforova` | Karina Neimla-Nikiforova | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `kov::maardu-linn::item::maardu_linn_contact_marina_keizo` | Marina Keizo | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `sotsiaaltoo-4-2023-mis-juhtuks-kui-meditsiini-ja-sotsiaalvaldkonna-terminoloogias-tehtaks-koosto-d-2023-4` | Mis juhtuks, kui meditsiini- ja sotsiaalvaldkonna terminoloogias tehtaks koostööd? | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/23-4/Sotsiaaltoo_4_2023_web_Part9.pdf \| docs/Andmebaas/ajakiri_sotsiaaltoo/23-4/sotsiaaltoo-4-2023_artikkel_8_meditsiini_ja_sotsiaalvaldkonna_terminoloogia.json |
| `kov::maardu-linn::item::maardu_linn_contact_natalja_fjodorova` | Natalja Fjodorova | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `kov::maardu-linn::item::maardu_linn_contact_natalja_tuulik` | Natalja Tuulik | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `kov::maardu-linn::item::maardu_linn_contact_olga_jevdokimova` | Olga Jevdokimova | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `sotsiaaltoo-4-2018-pille-vaiksaar-eesm-rk-on-et-lapsed-saaksid-meie-juurest-lahkudes-eluga-paremini-hakkama-2018` | Pille Vaiksaar: eesmärk on, et lapsed saaksid meie juurest lahkudes eluga paremini hakkama | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part3.pdf \| docs/Andmebaas/ajakiri_sotsiaaltoo/18-4/pille-vaiksaar-persoon-2018.json |
| `kov::maardu-linn::item::maardu_linn_service_parkimiskaardi_valjastamine` | Puudega inimese sõiduki parkimiskaardi väljastamine | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/maardu-linn/maardu-linn.json |
| `sotsiaaltoo-2-2023-sotsiaalvaldkonna-toojo-ud-padevus-ja-vaartustamine-2023-2` | Sotsiaalvaldkonna tööjõud, pädevus ja väärtustamine | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/23-2/Sotsiaaltoo_2_2023_web_par_Part5.pdf \| docs/Andmebaas/ajakiri_sotsiaaltoo/23-2/sotsiaaltoo-2-2023_artikkel_4_sotsiaalvaldkonna_toojoud.json |
| `kov::maardu-linn::item::maardu_linn_contact_tatjana_chaus` | Tatjana Chaus | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |
| `sotsiaaltoo-2-2019-tegevusjuhendaja-vs-hooldusto-taja-2019` | Tegevusjuhendaja versus hooldustöötaja | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part20.pdf \| docs/Andmebaas/ajakiri_sotsiaaltoo/19-2/tegevusjuhendaja-vs-hooldustoötaja-2019.json |
| `sotsiaaltoo-1-2024-valikud-uu-ja-vana-vahel-kilde-euroopa-liidu-uute-liikmesriikide-perepoliitikast-ii-2024-1` | Valikud uue ja vana vahel – kilde Euroopa Liidu „uute liikmesriikide“ perepoliitikast (II) | FILE | PRESENT | LOCAL_ORIGINAL_TITLE | unique_journal_title; docs/Andmebaas/ajakiri_sotsiaaltoo/24-1/Sotsiaaltoo_1_2024_web_Part15.pdf \| docs/Andmebaas/ajakiri_sotsiaaltoo/24-1/sotsiaaltoo-1-2024-artikkel-15-perepoliitika_ii.json |
| `kov::maardu-linn::item::maardu_linn_contact_viktoria_danilova` | Viktoria Danilova | TEXT | PRESENT | LOCAL_STRUCTURED_URL_TITLE | kov_normalized_url_and_title; docs/Andmebaas/KOV/kov_kontaktid_loplik.json |

## SOURCE_MASTER_IDENTITY_NOT_PROVEN_IN_EXPORT (167, not_proven)

| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |
|---|---|---|---|---|---|
| `paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf` | Hoolekande- ja tervishoiuasutuste tuleohutus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf |
| `paasteamet_tuleohutuspaigaldised_ja_paastevahendid_haiglates_hooldekodu` | Tuleohutuspaigaldised ja päästevahendid haiglates/hooldekodudes | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_tuleohutuspaigaldised_ja_paastevahendid_haiglates_hooldekodu |
| `oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse` | Juhend: abivajavast lapsest teatamine ja andmekaitse | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse |
| `oiguskantsler_2025_aasta_tegevuse_ulevaade_puuetega_inimeste_oigused` | 2025. aasta tegevuse ülevaade: puuetega inimeste õigused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oiguskantsler_2025_aasta_tegevuse_ulevaade_puuetega_inimeste_oigused |
| `oiguskantsler_puuetega_inimeste_oigused_kriisis` | Puuetega inimeste õigused kriisis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oiguskantsler_puuetega_inimeste_oigused_kriisis |
| `oiguskantsler_lapse_oigused` | Lapse õigused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oiguskantsler_lapse_oigused |
| `oiguskantsler_vordne_kohtlemine` | Võrdne kohtlemine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oiguskantsler_vordne_kohtlemine |
| `aki_isikuandmed_sotsiaalhoolekande_ja_tervishoiusektoris` | Isikuandmed sotsiaalhoolekande- ja tervishoiusektoris | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: aki_isikuandmed_sotsiaalhoolekande_ja_tervishoiusektoris |
| `aki_isikuandmete_tootleja_uldjuhend` | Isikuandmete töötleja üldjuhend | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: aki_isikuandmete_tootleja_uldjuhend |
| `aki_tto_de_kasutatavate_kliendisuhtluskeskkondade_seire_kokkuvot` | TTO-de kasutatavate kliendisuhtluskeskkondade seire kokkuvõte ja soovitused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: aki_tto_de_kasutatavate_kliendisuhtluskeskkondade_seire_kokkuvot |
| `tai_eesti_laste_vaimse_tervise_uuring` | Eesti laste vaimse tervise uuring | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tai_eesti_laste_vaimse_tervise_uuring |
| `tai_espad_2024_uimastite_tarvitamine_koolinoorte_seas` | ESPAD 2024: uimastite tarvitamine koolinoorte seas | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tai_espad_2024_uimastite_tarvitamine_koolinoorte_seas |
| `tai_eesti_taiskasvanud_rahvastiku_uimastite_tarvitamise_uuring_2` | Eesti täiskasvanud rahvastiku uimastite tarvitamise uuring 2023 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tai_eesti_taiskasvanud_rahvastiku_uimastite_tarvitamise_uuring_2 |
| `tai_narkootikumide_tarvitamise_olukord_eestis_2023` | Narkootikumide tarvitamise olukord Eestis 2023 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tai_narkootikumide_tarvitamise_olukord_eestis_2023 |
| `tai_tai_arengukava_2025_2028` | TAI arengukava 2025–2028 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tai_tai_arengukava_2025_2028 |
| `statistikaamet_lapse_heaolu_mootmise_kasitlus` | Lapse heaolu mõõtmise käsitlus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_lapse_heaolu_mootmise_kasitlus |
| `statistikaamet_laste_subjektiivne_heaolu_kohalikus_ja_rahvusvahelises_vaate` | Laste subjektiivne heaolu kohalikus ja rahvusvahelises vaates | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_laste_subjektiivne_heaolu_kohalikus_ja_rahvusvahelises_vaate |
| `statistikaamet_puudega_inimeste_sotsiaalne_loimumine` | Puudega inimeste sotsiaalne lõimumine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_puudega_inimeste_sotsiaalne_loimumine |
| `statistikaamet_sotsiaaltrendid_6` | Sotsiaaltrendid 6 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_sotsiaaltrendid_6 |
| `statistikaamet_sotsiaaltrendid_7` | Sotsiaaltrendid 7 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_sotsiaaltrendid_7 |
| `statistikaamet_vaesus_eestis` | Vaesus Eestis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_vaesus_eestis |
| `statistikaamet_eesti_statistika_kvartalikiri_2_2018` | Eesti Statistika Kvartalikiri 2/2018 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: statistikaamet_eesti_statistika_kvartalikiri_2_2018 |
| `oska_sotsiaaltoo_seirearuanne_2025` | Sotsiaaltöö seirearuanne 2025 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oska_sotsiaaltoo_seirearuanne_2025 |
| `oska_oska_sotsiaaltoo_uuringu_terviktekst_2021` | OSKA sotsiaaltöö uuringu terviktekst 2021 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oska_oska_sotsiaaltoo_uuringu_terviktekst_2021 |
| `oska_oska_sotsiaaltoo_uuringu_luhiversioon_2021` | OSKA sotsiaaltöö uuringu lühiversioon 2021 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oska_oska_sotsiaaltoo_uuringu_luhiversioon_2021 |
| `oska_oska_sotsiaaltoo_uuringu_olulisemad_tulemused` | OSKA sotsiaaltöö uuringu olulisemad tulemused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: oska_oska_sotsiaaltoo_uuringu_olulisemad_tulemused |
| `tervisekassa_pereoenduse_tegevusjuhend` | Pereõenduse tegevusjuhend | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tervisekassa_pereoenduse_tegevusjuhend |
| `tervisekassa_esmatasandi_tervishoiu_arengumudel_lahima_10_aasta_perspekti` | Esmatasandi tervishoiu arengumudel lähima 10 aasta perspektiivis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tervisekassa_esmatasandi_tervishoiu_arengumudel_lahima_10_aasta_perspekti |
| `tervisekassa_arevushaire_kasitlus_esmatasandil_kliinilise_auditi_kokkuvot` | Ärevushäire käsitlus esmatasandil – kliinilise auditi kokkuvõte | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tervisekassa_arevushaire_kasitlus_esmatasandil_kliinilise_auditi_kokkuvot |
| `terviseamet_kokkuvote_2024_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi` | Kokkuvõte 2024. aasta kohta: haridus- ja sotsiaalasutuste tervisekaitse järelevalve | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: terviseamet_kokkuvote_2024_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi |
| `terviseamet_kokkuvote_2022_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi` | Kokkuvõte 2022. aasta kohta: haridus- ja sotsiaalasutuste tervisekaitse järelevalve | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: terviseamet_kokkuvote_2022_aasta_kohta_haridus_ja_sotsiaalasutuste_tervi |
| `terviseamet_gripivastase_vaktsineerimise_labiviimise_juhend_2025` | Gripivastase vaktsineerimise läbiviimise juhend 2025 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: terviseamet_gripivastase_vaktsineerimise_labiviimise_juhend_2025 |
| `riigikontroll_omavalitsuste_tegevus_erivajadustega_inimeste_toetamisel` | Omavalitsuste tegevus erivajadustega inimeste toetamisel | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: riigikontroll_omavalitsuste_tegevus_erivajadustega_inimeste_toetamisel |
| `riigikontroll_ulevaade_erihoolekandeteenuste_kattesaadavusest` | Ülevaade erihoolekandeteenuste kättesaadavusest | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: riigikontroll_ulevaade_erihoolekandeteenuste_kattesaadavusest |
| `riigikontroll_koduteenuste_korraldus` | Koduteenuste korraldus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: riigikontroll_koduteenuste_korraldus |
| `riigikontroll_toimetulekutoetuse_kui_riikliku_sotsiaalabi_korraldus` | Toimetulekutoetuse kui riikliku sotsiaalabi korraldus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: riigikontroll_toimetulekutoetuse_kui_riikliku_sotsiaalabi_korraldus |
| `riigikontroll_haridusliku_erivajadusega_noorte_kutseopingute_ja_tooturule_` | Haridusliku erivajadusega noorte kutseõpingute ja tööturule jõudmise toetamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: riigikontroll_haridusliku_erivajadusega_noorte_kutseopingute_ja_tooturule_ |
| `riigikontroll_toovoime_vahenemise_ennetamine` | Töövõime vähenemise ennetamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: riigikontroll_toovoime_vahenemise_ennetamine |
| `vordoigusvolinik_vordoiguslikkus_eestis_2024` | Võrdõiguslikkus Eestis 2024 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: vordoigusvolinik_vordoiguslikkus_eestis_2024 |
| `vordoigusvolinik_voin_olla_puudega_laste_piltsonastik_puuetest` | Võin olla puudega – laste piltsõnastik puuetest | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: vordoigusvolinik_voin_olla_puudega_laste_piltsonastik_puuetest |
| `vordoigusvolinik_juhendmaterjal_karjaarispetsialistidele` | Juhendmaterjal karjäärispetsialistidele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: vordoigusvolinik_juhendmaterjal_karjaarispetsialistidele |
| `vordoigusvolinik_voliniku_poole_poordumiste_statistika_2021` | Voliniku poole pöördumiste statistika 2021 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: vordoigusvolinik_voliniku_poole_poordumiste_statistika_2021 |
| `vordoigusvolinik_arvamus_toovoimetuslehe_teemal` | Arvamus töövõimetuslehe teemal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: vordoigusvolinik_arvamus_toovoimetuslehe_teemal |
| `tootukassa_ska_sotsiaalministeerium_puude_raskusastme_tuvastamise_ja_toovoime_hindamise_taotlus_` | Puude raskusastme tuvastamise ja töövõime hindamise taotlus – tööealine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_puude_raskusastme_tuvastamise_ja_toovoime_hindamise_taotlus_ |
| `tootukassa_ska_sotsiaalministeerium_kes_aitab_ja_kuhu_poorduda_kui_sul_on_tuvastatud_puude_rasku` | Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste? | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_kes_aitab_ja_kuhu_poorduda_kui_sul_on_tuvastatud_puude_rasku |
| `tootukassa_ska_sotsiaalministeerium_star_strateegia_2026_2030` | STAR strateegia 2026–2030 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_star_strateegia_2026_2030 |
| `tootukassa_ska_sotsiaalministeerium_star_strateegia_tegevused_2026_2029` | STAR strateegia tegevused 2026–2029 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_star_strateegia_tegevused_2026_2029 |
| `tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami` | Töövõime toetamise skeemi loomise ja juurutamise vahehindamise lõpparuanne | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami |
| `tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami_2` | Töövõime toetamise skeemi loomise ja juurutamise vahehindamise infoleht | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami_2 |
| `tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja` | Töövõime toetamise süsteemi loomise ja juurutamise makromajandusliku mõju hindamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja |
| `tootukassa_ska_sotsiaalministeerium_tooandjate_hoiakud_vahenenud_toovoimega_inimeste_tootamise_s` | Tööandjate hoiakud vähenenud töövõimega inimeste töötamise suhtes | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_tooandjate_hoiakud_vahenenud_toovoimega_inimeste_tootamise_s |
| `tootukassa_ska_sotsiaalministeerium_teadlikkus_ja_hoiakud_vahenenud_toovoimega_inimeste_ning_too` | Teadlikkus ja hoiakud vähenenud töövõimega inimeste ning töövõimereformi teemal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tootukassa_ska_sotsiaalministeerium_teadlikkus_ja_hoiakud_vahenenud_toovoimega_inimeste_ning_too |
| `harno_juhendmaterjal_opilase_toetamiseks_koolis` | Juhendmaterjal õpilase toetamiseks koolis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_juhendmaterjal_opilase_toetamiseks_koolis |
| `harno_opilase_toetamine_koolis_varasem_versioon` | Õpilase toetamine koolis (varasem versioon) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_opilase_toetamine_koolis_varasem_versioon |
| `harno_koolitootajad_jms_toetav_susteemne_lahenemine` | Koolitöötajad jms toetav süsteemne lähenemine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_koolitootajad_jms_toetav_susteemne_lahenemine |
| `harno_opitulemuste_vahendamine_asendamine_ja_kohustusliku_oppeaine` | Õpitulemuste vähendamine, asendamine ja kohustusliku õppeaine õppimisest vabastamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_opitulemuste_vahendamine_asendamine_ja_kohustusliku_oppeaine |
| `harno_erinevate_oppijate_toetamine_opetaja_ja_tugispetsialisti_koo` | Erinevate õppijate toetamine õpetaja ja tugispetsialisti koostöös | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_erinevate_oppijate_toetamine_opetaja_ja_tugispetsialisti_koo |
| `harno_opilase_individuaalsuse_arvestamine_voimetekohase_oppe_tagam` | Õpilase individuaalsuse arvestamine võimetekohase õppe tagamisel | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_opilase_individuaalsuse_arvestamine_voimetekohase_oppe_tagam |
| `harno_4_sammu_markamiseks_ja_sekkumiseks_opetajale` | 4 sammu märkamiseks ja sekkumiseks õpetajale | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_4_sammu_markamiseks_ja_sekkumiseks_opetajale |
| `harno_juhend_laagritele_ja_malevatele_vaimse_tervise_nouanded` | Juhend laagritele ja malevatele: vaimse tervise nõuanded | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_juhend_laagritele_ja_malevatele_vaimse_tervise_nouanded |
| `harno_soovitused_kiusamise_valtimiseks_koolis` | Soovitused kiusamise vältimiseks koolis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_soovitused_kiusamise_valtimiseks_koolis |
| `harno_kutseoppeasutuste_veebilehtede_ja_haridusinfoportaali_analuu` | Kutseõppeasutuste veebilehtede ja haridusinfoportaali analüüs | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_kutseoppeasutuste_veebilehtede_ja_haridusinfoportaali_analuu |
| `harno_oppekeelest_erineva_emakeelega_opilane_koolis` | Õppekeelest erineva emakeelega õpilane koolis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: harno_oppekeelest_erineva_emakeelega_opilane_koolis |
| `paasteamet_tuleohutuse_infohommik_mida_iga_hoolekandeasutus_peab_teadma` | Tuleohutuse infohommik: mida iga hoolekandeasutus peab teadma? | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_tuleohutuse_infohommik_mida_iga_hoolekandeasutus_peab_teadma |
| `paasteamet_haiglate_ja_hooldekodude_projekteerimise_juhis` | Haiglate ja hooldekodude projekteerimise juhis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_haiglate_ja_hooldekodude_projekteerimise_juhis |
| `paasteamet_evakuatsioonijuhi_koolitusmaterjal` | Evakuatsioonijuhi koolitusmaterjal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_evakuatsioonijuhi_koolitusmaterjal |
| `paasteamet_juhendmaterjal_praktilise_valjaoppe_labiviimiseks_haiglas_ja` | Juhendmaterjal praktilise väljaõppe läbiviimiseks haiglas ja hooldekodus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_juhendmaterjal_praktilise_valjaoppe_labiviimiseks_haiglas_ja |
| `paasteamet_paasteameti_meelespea_kohalikule_omavalitsusele` | Päästeameti meelespea kohalikule omavalitsusele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_paasteameti_meelespea_kohalikule_omavalitsusele |
| `paasteamet_paastevorgustiku_strateegia_aastani_2025` | Päästevõrgustiku strateegia aastani 2025 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_paastevorgustiku_strateegia_aastani_2025 |
| `paasteamet_ehituslike_tuleohutusnouete_kokkuvote` | Ehituslike tuleohutusnõuete kokkuvõte | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_ehituslike_tuleohutusnouete_kokkuvote |
| `paasteamet_tuleohutuskonsultandi_koolitusmaterjal` | Tuleohutuskonsultandi koolitusmaterjal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_tuleohutuskonsultandi_koolitusmaterjal |
| `paasteamet_enesekontrolli_tuleohutusaruanne` | Enesekontrolli tuleohutusaruanne | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: paasteamet_enesekontrolli_tuleohutusaruanne |
| `peaasi_ee_koolilaste_ja_noorte_vaimne_tervis` | Koolilaste ja noorte vaimne tervis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_ee_koolilaste_ja_noorte_vaimne_tervis |
| `peaasi_ee_vaimse_tervise_hoidmine_4_7_klass` | Vaimse tervise hoidmine (4.–7. klass) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_ee_vaimse_tervise_hoidmine_4_7_klass |
| `peaasi_ee_vaimse_tervise_hoidmine_8_12_klass` | Vaimse tervise hoidmine (8.–12. klass) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_ee_vaimse_tervise_hoidmine_8_12_klass |
| `peaasi_ee_stigma_8_12_klass` | Stigma (8.–12. klass) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_ee_stigma_8_12_klass |
| `peaasi_ee_peaasi_ee_haridus` | Peaasi.ee Haridus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_ee_peaasi_ee_haridus |
| `praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja` | Täiskasvanud erivajadusega inimeste abivajaduse hindamine ja teenuste osutamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja |
| `praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja_2` | Täiskasvanud erivajadusega inimeste abivajaduse hindamine ja teenuste osutamine – lühikokkuvõte | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja_2 |
| `praxis_centar_sotsiaalne_innovatsioon_pikaajalises_hoolduses` | Sotsiaalne innovatsioon pikaajalises hoolduses | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_sotsiaalne_innovatsioon_pikaajalises_hoolduses |
| `praxis_centar_vanemaealiste_ja_eakate_toimetuleku_uuring_2015` | Vanemaealiste ja eakate toimetuleku uuring 2015 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_vanemaealiste_ja_eakate_toimetuleku_uuring_2015 |
| `praxis_centar_terviseseisundist_voi_puudest_tingitud_erivajadustega_noorte` | Terviseseisundist või puudest tingitud erivajadustega noorte siirdumine koolist tööle | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_terviseseisundist_voi_puudest_tingitud_erivajadustega_noorte |
| `praxis_centar_lapsendamise_ja_hooldusperre_paigutamise_jargne_hindamine_lo` | Lapsendamise ja hooldusperre paigutamise järgne hindamine / lõpparuanne | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_lapsendamise_ja_hooldusperre_paigutamise_jargne_hindamine_lo |
| `praxis_centar_kohaliku_omavalitsuse_poolt_isikult_ja_voi_perekonnalt_sotsi` | Kohaliku omavalitsuse poolt isikult ja/või perekonnalt sotsiaalteenuste eest tasu nõudmine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_kohaliku_omavalitsuse_poolt_isikult_ja_voi_perekonnalt_sotsi |
| `praxis_centar_ska_ja_kovid_loppraport` | SKA ja KOVid – lõppraport | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_ska_ja_kovid_loppraport |
| `praxis_centar_puudega_lastega_perede_toimetuleku_ja_vajaduste_uuring` | Puudega lastega perede toimetuleku ja vajaduste uuring | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_puudega_lastega_perede_toimetuleku_ja_vajaduste_uuring |
| `praxis_centar_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja` | Töövõime toetamise süsteemi loomise ja juurutamise makromajandusliku mõju hindamine – metoodikaraport | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja |
| `praxis_centar_raviresistentse_ja_suitsiidse_depressiooni_levimus_ning_maja` | Raviresistentse ja suitsiidse depressiooni levimus ning majanduslik mõju | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: praxis_centar_raviresistentse_ja_suitsiidse_depressiooni_levimus_ning_maja |
| `sotsiaalkindlustusamet_naiste_tugikeskuse_teenuse_kvaliteedijuhis` | Naiste tugikeskuse teenuse kvaliteedijuhis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_naiste_tugikeskuse_teenuse_kvaliteedijuhis |
| `sotsiaalkindlustusamet_naiste_tugikeskuste_2021_aasta_kogemusuuringu_aruanne` | Naiste tugikeskuste 2021. aasta kogemusuuringu aruanne | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_naiste_tugikeskuste_2021_aasta_kogemusuuringu_aruanne |
| `sotsiaalkindlustusamet_juhendmaterjal_kubervagivallast_ohvritega_tootavatele_spetsi` | Juhendmaterjal kübervägivallast ohvritega töötavatele spetsialistidele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_juhendmaterjal_kubervagivallast_ohvritega_tootavatele_spetsi |
| `sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota` | Riskihindamine lähisuhtevägivalla juhtumites – tervishoiutöötajatele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota |
| `sotsiaalkindlustusamet_perevagivalla_toimepanijatele_suunatud_programmide_euroopa_s` | Perevägivalla toimepanijatele suunatud programmide Euroopa standardid | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_perevagivalla_toimepanijatele_suunatud_programmide_euroopa_s |
| `sotsiaalkindlustusamet_marac_i_juhendmaterjal` | MARAC-i juhendmaterjal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_marac_i_juhendmaterjal |
| `sotsiaalkindlustusamet_marac_i_teavitusleht` | MARAC-i teavitusleht | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_marac_i_teavitusleht |
| `sotsiaalkindlustusamet_marac_i_vorgustiku_mudeli_moju_hindamine_loppraport` | MARAC-i võrgustiku mudeli mõju hindamine. Lõppraport | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_marac_i_vorgustiku_mudeli_moju_hindamine_loppraport |
| `sotsiaalkindlustusamet_evaluation_of_the_impact_of_the_marac_networking_model` | Evaluation of the impact of the MARAC networking model | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_evaluation_of_the_impact_of_the_marac_networking_model |
| `sotsiaalkindlustusamet_marac_i_mudeli_juhend_kov_lastekaitsele` | MARAC-i mudeli juhend KOV lastekaitsele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_marac_i_mudeli_juhend_kov_lastekaitsele |
| `sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est` | Seksuaalvägivalla kriisiabikeskusi tutvustav voldik (EST) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est |
| `sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng` | Sexual Assault Crisis Centre (ENG) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_sexual_assault_crisis_centre_eng |
| `sotsiaalkindlustusamet_rus` | Кризисные центры помощи жертвам сексуального насилия (RUS) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_rus |
| `sotsiaalkindlustusamet_ua` | Кризові центри допомоги жертвам сексуального насильства (UA) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_ua |
| `sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin` | Seksuaaliväkivallan kriisikeskukset (FIN) | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_seksuaalivakivallan_kriisikeskukset_fin |
| `sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend` | Seksuaalsest ahistamisest vaba ööelu juhend | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_seksuaalsest_ahistamisest_vaba_ooelu_juhend |
| `sotsiaalkindlustusamet_eesti_elanikkonna_teadlikkuse_uuring_soopohise_vagivalla_ja_` | Eesti elanikkonna teadlikkuse uuring soopõhise vägivalla ja inimkaubanduse valdkonnas | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_eesti_elanikkonna_teadlikkuse_uuring_soopohise_vagivalla_ja_ |
| `sotsiaalkindlustusamet_elanikkonna_hoiakud_ja_teadlikkus_perevagivallast` | Elanikkonna hoiakud ja teadlikkus perevägivallast | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_elanikkonna_hoiakud_ja_teadlikkus_perevagivallast |
| `sotsiaalkindlustusamet_teadlikkus_tugiteenuste_olemasolust_pere_ja_seksuaalvagivall` | Teadlikkus tugiteenuste olemasolust pere- ja seksuaalvägivalla ning inimkaubanduse ohvritele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_teadlikkus_tugiteenuste_olemasolust_pere_ja_seksuaalvagivall |
| `sotsiaalkindlustusamet_hoolekandeteenuste_kvaliteedi_juhendmaterjal` | Hoolekandeteenuste kvaliteedi juhendmaterjal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_hoolekandeteenuste_kvaliteedi_juhendmaterjal |
| `sotsiaalkindlustusamet_abivahendite_teatmik_2025` | Abivahendite teatmik 2025 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_abivahendite_teatmik_2025 |
| `sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025` | Puue ja hoolekanne — SKA aastaraamatu PDF-osa 2025 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025 |
| `sotsiaalkindlustusamet_rehabilitatsiooni_teenuseosutajate_infopaeva_materjal` | Rehabilitatsiooni teenuseosutajate infopäeva materjal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_rehabilitatsiooni_teenuseosutajate_infopaeva_materjal |
| `sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat` | Lapse heaolu hindamise käsiraamat | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat |
| `sotsiaalministeerium_puude_toetus_ja_lisa_toetus_2025_aastal` | Puude-toetus ja lisa-toetus 2025. aastal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_puude_toetus_ja_lisa_toetus_2025_aastal |
| `sotsiaalministeerium_ligipaasetavuse_kulu_tulu_analuus_lopparuanne` | Ligipääsetavuse kulu-tulu analüüs. Lõpparuanne | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_ligipaasetavuse_kulu_tulu_analuus_lopparuanne |
| `sotsiaalministeerium_transpordi_ja_tehiskeskkonna_ligipaasetavuse_analuus` | Transpordi ja tehiskeskkonna ligipääsetavuse analüüs | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_transpordi_ja_tehiskeskkonna_ligipaasetavuse_analuus |
| `sotsiaalministeerium_sotsiaalhoolekande_programm_2024_2027` | Sotsiaalhoolekande programm 2024–2027 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_sotsiaalhoolekande_programm_2024_2027 |
| `sotsiaalministeerium_uuring_taisealiste_puudega_inimeste_puude_tuvastamise_abivaj` | Uuring täisealiste puudega inimeste puude tuvastamise, abivajaduse hindamise ja toetamise süsteemist | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_uuring_taisealiste_puudega_inimeste_puude_tuvastamise_abivaj |
| `sotsiaalministeerium_soolise_vordoiguslikkuse_monitooring_2021_lahisuhtevagivald` | Soolise võrdõiguslikkuse monitooring 2021: Lähisuhtevägivald | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_soolise_vordoiguslikkuse_monitooring_2021_lahisuhtevagivald |
| `sotsiaalministeerium_inimkaubanduse_ennetamine_metodoloogia_tooks_noortega` | Inimkaubanduse ennetamine: metodoloogia tööks noortega | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_inimkaubanduse_ennetamine_metodoloogia_tooks_noortega |
| `sotsiaalministeerium_inimkaubanduse_teemal_koolitamine_praktilised_soovitused` | Inimkaubanduse teemal koolitamine: praktilised soovitused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_inimkaubanduse_teemal_koolitamine_praktilised_soovitused |
| `sotsiaalministeerium_puuetega_inimeste_tootamist_toetavad_meetmed` | Puuetega inimeste töötamist toetavad meetmed | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_puuetega_inimeste_tootamist_toetavad_meetmed |
| `sotsiaalministeerium_puuetega_inimeste_ja_nende_pereliikmete_hoolduskoormuse_uuri` | Puuetega inimeste ja nende pereliikmete hoolduskoormuse uuring 2009 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_puuetega_inimeste_ja_nende_pereliikmete_hoolduskoormuse_uuri |
| `sotsiaalministeerium_vagivald_ja_naiste_tervis` | Vägivald ja naiste tervis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_vagivald_ja_naiste_tervis |
| `sotsiaalministeerium_vagivalla_moju_naiste_tervisele` | Vägivalla mõju naiste tervisele | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_vagivalla_moju_naiste_tervisele |
| `sotsiaalministeerium_vagivald_lahisuhtes_selle_pohjused_ja_voimalikud_lahendused` | Vägivald lähisuhtes: selle põhjused ja võimalikud lahendused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_vagivald_lahisuhtes_selle_pohjused_ja_voimalikud_lahendused |
| `sotsiaalministeerium_seksuaalvagivalla_levimus_ja_hoiakud_eestis` | Seksuaalvägivalla levimus ja hoiakud Eestis | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: sotsiaalministeerium_seksuaalvagivalla_levimus_ja_hoiakud_eestis |
| `epikoda_uro_puuetega_inimeste_oiguste_konventsioon_ja_fakultatiivpro` | ÜRO puuetega inimeste õiguste konventsioon ja fakultatiivprotokoll | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: epikoda_uro_puuetega_inimeste_oiguste_konventsioon_ja_fakultatiivpro |
| `epikoda_teekond_erilise_lapse_korval` | Teekond erilise lapse kõrval | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: epikoda_teekond_erilise_lapse_korval |
| `epikoda_epikoja_arengukava_2025_2030` | EPIKoja arengukava 2025–2030 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: epikoda_epikoja_arengukava_2025_2030 |
| `epikoda_giidi_too_kasiraamat_pohimotted_ja_soovitused` | Giidi töö käsiraamat – põhimõtted ja soovitused | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: epikoda_giidi_too_kasiraamat_pohimotted_ja_soovitused |
| `epikoda_heade_praktikate_kogumik` | Heade praktikate kogumik | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: epikoda_heade_praktikate_kogumik |
| `epikoda_puudega_inimeste_toimetulek_kriisiajal_miniuuringu_kokkuvote` | Puudega inimeste toimetulek kriisiajal – miniuuringu kokkuvõte | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: epikoda_puudega_inimeste_toimetulek_kriisiajal_miniuuringu_kokkuvote |
| `astangu_erivajaduste_alase_teadlikkuse_tostmine` | Erivajaduste alase teadlikkuse tõstmine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: astangu_erivajaduste_alase_teadlikkuse_tostmine |
| `astangu_metoodiline_abimaterjal_kutsealase_ettevalmistuse_valjaoppe_` | Metoodiline abimaterjal kutsealase ettevalmistuse, väljaõppe ja töölerakendumise toetamiseks coaching’u kaudu | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: astangu_metoodiline_abimaterjal_kutsealase_ettevalmistuse_valjaoppe_ |
| `astangu_tooandjate_noustamine_ja_toetamine` | Tööandjate nõustamine ja toetamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: astangu_tooandjate_noustamine_ja_toetamine |
| `astangu_kriisi_ennetamine` | Kriisi ennetamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: astangu_kriisi_ennetamine |
| `astangu_supervisioon` | Supervisioon | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: astangu_supervisioon |
| `astangu_hindamisvahendi_kasiraamat` | Hindamisvahendi käsiraamat | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: astangu_hindamisvahendi_kasiraamat |
| `lastekaitse_liit_lapse_osalusoiguse_rakendamise_juhend` | Lapse osalusõiguse rakendamise juhend | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: lastekaitse_liit_lapse_osalusoiguse_rakendamise_juhend |
| `lastekaitse_liit_lapse_osalemise_pohimotted` | Lapse osalemise põhimõtted | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: lastekaitse_liit_lapse_osalemise_pohimotted |
| `lastekaitse_liit_mul_on_oigus_2025` | Mul on õigus 2025 | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: lastekaitse_liit_mul_on_oigus_2025 |
| `lastekaitse_liit_mina_olen_enda_oma_juhendmaterjal_opetajale_ja_lapsevanemale` | “Mina olen enda oma” juhendmaterjal õpetajale ja lapsevanemale | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: lastekaitse_liit_mina_olen_enda_oma_juhendmaterjal_opetajale_ja_lapsevanemale |
| `lastekaitse_liit_uuring_lapse_heaolu_hindamine` | Uuring “Lapse heaolu hindamine” | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: lastekaitse_liit_uuring_lapse_heaolu_hindamine |
| `peaasi_raagime_lastest_logiraamat_vanematele_lapseootel_pere` | Räägime Lastest logiraamat vanematele: lapseootel pere | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_vanematele_lapseootel_pere |
| `peaasi_raagime_lastest_logiraamat_vanematele_0_1_aastane_laps` | Räägime Lastest logiraamat vanematele: 0–1-aastane laps | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_vanematele_0_1_aastane_laps |
| `peaasi_raagime_lastest_logiraamat_vanematele_1_5_aastane_laps` | Räägime Lastest logiraamat vanematele: 1–5-aastane laps | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_vanematele_1_5_aastane_laps |
| `peaasi_raagime_lastest_logiraamat_vanematele_5_12_aastane_laps` | Räägime Lastest logiraamat vanematele: 5–12-aastane laps | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_vanematele_5_12_aastane_laps |
| `peaasi_raagime_lastest_logiraamat_vanematele_12_18_aastane_noor` | Räägime Lastest logiraamat vanematele: 12–18-aastane noor | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_vanematele_12_18_aastane_noor |
| `peaasi_raagime_lastest_logiraamat_tooks_peredega_0_1_aastane_laps` | Räägime Lastest logiraamat tööks peredega: 0–1-aastane laps | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_tooks_peredega_0_1_aastane_laps |
| `peaasi_raagime_lastest_logiraamat_tooks_peredega_1_5_aastane_laps` | Räägime Lastest logiraamat tööks peredega: 1–5-aastane laps | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_tooks_peredega_1_5_aastane_laps |
| `peaasi_raagime_lastest_logiraamat_tooks_peredega_5_12_aastane_laps` | Räägime Lastest logiraamat tööks peredega: 5–12-aastane laps | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_logiraamat_tooks_peredega_5_12_aastane_laps |
| `peaasi_raagime_lastest_praktikutele_1_5_aastaste_lastega_perede_nou` | Räägime Lastest praktikutele: 1–5-aastaste lastega perede nõustamiseks | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_praktikutele_1_5_aastaste_lastega_perede_nou |
| `peaasi_raagime_lastest_praktikutele_12_18_aastaste_lastega_perede_n` | Räägime Lastest praktikutele: 12–18-aastaste lastega perede nõustamiseks | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: peaasi_raagime_lastest_praktikutele_12_18_aastaste_lastega_perede_n |
| `tarkvanem_tooleht_suhtekonto` | TÖÖLEHT: Suhtekonto | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_suhtekonto |
| `tarkvanem_tooleht_rahunemispaus` | TÖÖLEHT: Rahunemispaus | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_rahunemispaus |
| `tarkvanem_tooleht_kuidas_anda_lapsele_korraldusi` | TÖÖLEHT: Kuidas anda lapsele korraldusi? | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_kuidas_anda_lapsele_korraldusi |
| `tarkvanem_infomaterjal_beebivanematele_kodu_kohandamiseks_lapse_esimes` | Infomaterjal beebivanematele kodu kohandamiseks lapse esimesel eluaastal | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_infomaterjal_beebivanematele_kodu_kohandamiseks_lapse_esimes |
| `tarkvanem_vaikelastega_perede_koduohutuse_hindamise_ankeet_kodukulastu` | Väikelastega perede koduohutuse hindamise ankeet kodukülastusi läbiviivale spetsialistile | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_vaikelastega_perede_koduohutuse_hindamise_ankeet_kodukulastu |
| `tarkvanem_kuidas_margata_et_noor_tarvitab_e_sigaretti_nikotiinipatja_v` | Kuidas märgata, et noor tarvitab e-sigaretti, nikotiinipatja või huuletubakat? | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_kuidas_margata_et_noor_tarvitab_e_sigaretti_nikotiinipatja_v |
| `tarkvanem_sunnitusjargne_depressioon` | Sünnitusjärgne depressioon | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_sunnitusjargne_depressioon |
| `tarkvanem_tooleht_kuidas_sa_ennast_tunned` | TÖÖLEHT: Kuidas sa ennast tunned? | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_kuidas_sa_ennast_tunned |
| `tarkvanem_tooleht_lapse_tunnustamine` | TÖÖLEHT: Lapse tunnustamine | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_lapse_tunnustamine |
| `tarkvanem_tooleht_marka_ja_tunnusta_positiivset_kaitumist` | TÖÖLEHT: Märka ja tunnusta positiivset käitumist | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_marka_ja_tunnusta_positiivset_kaitumist |
| `tarkvanem_tooleht_tugevate_tunnetega_toimetulek` | TÖÖLEHT: Tugevate tunnetega toimetulek | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_tugevate_tunnetega_toimetulek |
| `tarkvanem_tooleht_abikusimused_vestluseks_lasteaialapsega` | TÖÖLEHT: Abiküsimused vestluseks lasteaialapsega | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_abikusimused_vestluseks_lasteaialapsega |
| `tarkvanem_tooleht_abikusimused_vestluseks_algkoolilapsega` | TÖÖLEHT: Abiküsimused vestluseks algkoolilapsega | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_abikusimused_vestluseks_algkoolilapsega |
| `tarkvanem_tooleht_abikusimused_vestluseks_teismelisega` | TÖÖLEHT: Abiküsimused vestluseks teismelisega | pdf | IDENTITY_FIELD_ABSENT_FROM_EXPORT | LOCAL_FILE_EXISTS | server docs: tarkvanem_tooleht_abikusimused_vestluseks_teismelisega |
