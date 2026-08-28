# SotsiaalAI autentitud tootmis-RAG-i 75 juhtumi manifest

Selle manifesti esimene versioon külmutati enne esimese canonical-küsimuse saatmist.
`PROMPT_DERIVED_FROM_CORE` on neutraalne täislause algmaatriksi küsimuse tuuma põhjal;
see ei ole allikasõnastuse ajalooline canonical-küsimus. Hilisem algallikakontroll parandas
J06, J12, J14 ja J18 eksitava ground truth'i; varasema runtime'i tulemusi ega jälgi ei
kirjutatud ümber ning parandatud küsimusi ei ole veel uuesti käivitatud.

## Release'i piir

- local_head: `6e486d1bdef0f6131679a44d3c76b82a06a776d1`
- origin_main_head: `6e486d1bdef0f6131679a44d3c76b82a06a776d1`
- server_checkout_head: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- server_checkout_clean: `true`
- active_frontend_artifact: `frontend-current-20260828T133845Z-44c1e59b.tar.gz`
- runtime_code_sha: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- rag_health: `ok=true; vectors=49727; documents=6089`
- original_fts_ready: `true; chunks=49727; active_documents=6073; generation=9eacd751e8bed4fca4bd35518009ed417b3fe444367712834aa19e0b2647e97c`
- lemma_fts_ready: `true; chunks=49727; active_documents=6073; generation=9eacd751e8bed4fca4bd35518009ed417b3fe444367712834aa19e0b2647e97c`
- run_started_at_utc: `2026-08-28T14:27:36.6001893Z`
- manifest_sha256: `f577bad561d659519fe54d5a51186ccc3c3345bf7af6f490a5013437815b6ecd` (SHA-256 of the canonical manifest with this field blank)

## Batch schedule

| batch_id | turns | case_ids |
|---|---:|---|
| B01 | 1–30 | J01–J22, V01–V08 |
| B02 | 1–10 | A01–A10 |
| B03 | 1–10 | S01–S10 |
| B04 | 1–15 | M01–M10, N11–N15 |
| B05 | 1–10 | K01–K10 |

## Frozen cases

### Testiklassid

Testiklass kirjeldab juhtumi peamist tõendamiskoormust, mitte küsimuse teemavaldkonda.

- `natural_retrieval`: kasutaja loomulik sisuküsimus, mille edu eeldab õige allika või allikakomplekti leidmist.
- `relation_binding`: mitu arvu, kategooriat või ajasuhet tuleb siduda ühe allika õigete mõistetega; üksiku arvu leidmisest ei piisa.
- `validation_adversarial`: sõnastus koormab teadlikult allikaidentiteedi, ajaloolise/praeguse ulatuse, avaldamis- ja tõendiaasta, kavandatud/toimunud tegevuse või autoriteetse allika piiri.

| test_class | case_ids | count |
|---|---|---:|
| natural_retrieval | J01, J04, J11, J16, V01, V08, A01–A10, S02–S05, S07–S10, M02–M09, K03 | 33 |
| relation_binding | J02, J05, J07–J10, J13–J15, J18, J19, J21, V02, V04, V07, M01, M10, N14 | 18 |
| validation_adversarial | J03, J06, J12, J17, J20, J22, V03, V05, V06, S01, S06, N11–N13, N15, K01, K02, K04–K10 | 24 |

### Tõendikihtide leping

- `server_runtime_trace` on serveri sama pöörde toorjälg enne andmebaasiprojektsiooni.
- `database_message_projection` on assistendi sõnumi metaandmetesse talletatud projektsioon; see peab viitama lähtekihile `server_runtime_trace`.
- `audit_normalization` on tuletatud auditiartefakt ja peab nimetama, millisest kihist ta loodi; ta ei ole serveri toorjälg.
- `ui_observation` on eraldi nähtava kasutajaliidese tõend (vastus, kuvatud allikad ja avatud allikapaneel), mida ei tohi tuletada üksnes serveri- või DB-jäljest.

Selle jooksu `traces.jsonl` on ajalooline normaliseeritud auditiartefakt, mitte muutmata serveri toorväljund. Faili ega varasemaid `results*.md` tulemusi paranduste käigus ümber ei kirjutata.

| järjekord | case_id | kategooria | prompt_origin | exact_question | expected_claims | evaluation_type | expected_source_scope | expected_source_ids_or_titles | batch_id | turn_number |
|---:|---|---|---|---|---|---|---|---|---|---:|
| 1 | J01 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Kui tihti toimusid MAPPA kohtumised kolmes Virumaa linnas ja mitu kohtumist toimus Rakveres, Jõhvis ning Narvas? | MAPPA kohtumiste sagedus; Rakvere 5; Jõhvi 7; Narva 5 | exact_fact | single_document | MAPPA käsitlev Sotsiaaltöö artikkel | B01 | 1 |
| 2 | J02 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millised kolm protsenti kirjeldasid erihooldekodude kaardistuse tulemusi? | kolm erihooldekodude kaardistuse protsenti: 25%, 45%, 30% | numeric_relation | single_document | erihooldekodude kaardistuse artikkel | B01 | 2 |
| 3 | J03 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada 2018. aasta artikli järgi? | kriisitunnused; hädaabi 112; nõuandeliin 1220; ajalooline 2018 allikas | guidance_document | single_document | Külli Mäe 2018 vaimse tervise kriisi artikkel | B01 | 3 |
| 4 | J04 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millistes linnades tegutsesid Perepesad ja millised neli ülesannet neil olid? | Põltsamaa; Türi; Viljandi; neli artiklis kirjeldatud põhiülesannet | exact_fact | single_document | Perepesade 2019 artikkel | B01 | 4 |
| 5 | J05 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Milliseid kahte taastava õiguse näitajat kirjeldati arvudega 30 ja 12 ning milliseid näitajaid arvudega 60 ja 19? | 30 ja 12 ühe taastava õiguse juhtumi rühm; 60 ja 19 teise rühm; suhted õigesti seotud | numeric_relation | single_document | taastava õiguse artikkel | B01 | 5 |
| 6 | J06 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Mida kirjeldati vanemaealiste teenusmaja korterite arvu ning omavalitsuste arengukavade ja avamisplaanide kohta? | teenusmajas kavandati 12–30 ühe- või kahetoalist ligipääsetavat korterit; 12 vastanud KOV-i arengukavas oli teenusmaja juba ette nähtud; kõik 16 vastanud KOV-i plaanisid selle lähiaastatel avada | exact_fact | single_document | Tarmo Kurves 2021 „Vanemaealiste teenusemaja kontseptsiooni lühitutvustus” | B01 | 6 |
| 7 | J07 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Kui palju inimesi sai teenust, mitu vabatahtlikku osales, mitu töötundi tehti ning mitmes maakonnas ja omavalitsuses tegutseti 2018–2020 katseetapis 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust” järgi? | 678 inimest; 273 vabatahtlikku; 21600 töötundi; 12 maakonda; 43 omavalitsust; 2018–2020 on tõendatud episoodi periood | numeric_relation | single_document | Krista Pegolainen-Saare 2022 „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust” | B01 | 7 |
| 8 | J08 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millised olid hoolduskoormuse uuringus neli küsitud osakaalu? | 61%; 26%; 11%; 18%; iga protsent õige nähtuse juures | numeric_relation | single_document | Vaike Vainu 2023 hoolduskoormuse artikkel | B01 | 8 |
| 9 | J09 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millised olid kiusamist kirjeldanud neli protsenti? | 33%; 13%; 19%; 7%; protsendid õigesti seotud | numeric_relation | single_document | kiusamise teemaline Sotsiaaltöö artikkel | B01 | 9 |
| 10 | J10 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Mida näitas artikkel dementsusega inimese kohta 150 ja 75 minuti, 7–8 tunni une ning kuulmislanguse 2–5-kordse riski kohta? | 150 ja 75 minutit; 7–8 tundi und; 2–5 korda suurem risk; seosed õiged | numeric_relation | single_document | dementsust käsitlev 2025 artikkel | B01 | 10 |
| 11 | J11 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Kui palju oli töötamise toetamise intervjuusid, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati? | 7 intervjuud; 6 individuaalset; 1 kolmeliikmeline rühm; kolmeetapiline temaatiline analüüs | exact_fact | single_document | töötamise toetamise intervjuude artikkel | B01 | 11 |
| 12 | J12 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Mitu KOV-i sotsiaaltöötajate rühmasupervisiooni kohtumist pidi 2017. aastal lepingu järgi toimuma igas maakonnas? | igas maakonnas pidi toimuma 5 rühmasupervisiooni kohtumist; artikkel kirjeldas kavandatud lepingulist mahtu, mitte juba toimunud kohtumisi | exact_fact | single_document | 2017. aasta supervisiooniartikkel | B01 | 12 |
| 13 | J13 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millist vanuserühma 13–18 käsitleti ning mitu probleemi noortel tavaliselt korraga oli? | vanus 13–18; tavaliselt 3–5 probleemi | numeric_relation | single_document | noori käsitlev Sotsiaaltöö artikkel | B01 | 13 |
| 14 | J14 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Mida öeldi Saue valla alla 18-aastaste laste arvu ja vanemate hooldusõiguse vaidlustes kohtusse pöördumise kohta? | Saue vallas oli üle 5800 kuni 18-aastase lapse; hooldusõiguse jagamise juhtumites pöördusid vanemad 90% juhtudel kohtusse; ühe spetsialisti näites oli 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet | numeric_relation | single_document | Anne-Ly Sumre 2019 „Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele” | B01 | 14 |
| 15 | J15 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Kui palju töötajaid oli Rakvere käsitluses, mitu neist töötas lastekaitses ja mitu menetles toetusi? | 7 töötajat; 3 lastekaitses; 2 toetusi menetlemas | numeric_relation | single_document | Rakvere sotsiaaltöö korralduse artikkel | B01 | 15 |
| 16 | J16 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Mida kirjeldati Saaremaa esimese ja teise COVID-laine ning tervishoiu ja sotsiaalhoolekande lõimimise kohta? | esimene ja teine COVID-laine; tervishoiu ja sotsiaalhoolekande lõimimise korraldussoovitus | comparison_or_temporal | single_document | Saaremaa COVID-i käsitlev artikkel | B01 | 16 |
| 17 | J17 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Kui palju lapse eraldamise otsuseid tehti 2018. aasta juhtumites? | 169 lapse eraldamise otsust; 2018. aasta juhtumid | numeric_relation | single_document | lapse eraldamise otsuseid käsitlev 2018. aasta artikkel | B01 | 17 |
| 18 | J18 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Kui palju osalejaid oli eestkostes osalemise uuringu igas kolmes praktikute rühmas ja kokku? | 5 kohtunikku; 5 erihoolekandeasutuse töötajat; 5 eestkosteülesandeid täitvat KOV-i sotsiaaltöötajat; kokku 15 praktikut, mitte eestkostetavat | numeric_relation | single_document | Erle Eenmaa 2022 „Psüühilise erivajadusega inimese osalus oma eestkostes” | B01 | 18 |
| 19 | J19 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Mitu lehekülge ja teadlast oli inimarengu aruandes ning mitu stsenaariumi selles esitati? | 380 lehekülge; 71 teadlast; 4 stsenaariumi | numeric_relation | single_document | inimarengu aruannet käsitlev artikkel | B01 | 19 |
| 20 | J20 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millal kirjeldati artiklis sotsiaalvaldkonna seadusemuudatusi 2023. aasta kevadel ja suvel ning 2025. aasta jaanuaris? | 2023 kevad; 2023 suvi; 2025 jaanuar; muudatused õigesti ajastatud | comparison_or_temporal | single_document | seadusemuudatusi käsitlev Sotsiaaltöö artikkel | B01 | 20 |
| 21 | J21 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millised olid eakate vägivallauuringu 10%, 6% ja 2% näidud koos vastavate arvudega? | 10% = 640; 6% = 227; 2% = 100; haldus- ja ohvriuuringu näidud eristatud | numeric_relation | single_document | Anu Lepsi ja Lenne Indovi 2025 eakate vägivalla artikkel | B01 | 21 |
| 22 | J22 | Ajakirja faktid | PROMPT_DERIVED_FROM_CORE | Millal tehti e-kursuse järelhindamine ning kelle vaadet selles võrreldi? | järelhindamine 6 kuu pärast; osaleja vaade; tööandja vaade | comparison_or_temporal | single_document | e-kursuse järelhindamise artikkel | B01 | 22 |
| 23 | V01 | Sõnastusvariant | AUDIT_EXACT | MAPPA kohtumised – kui tihti ja mitu neid kolmes Virumaa linnas oli? | MAPPA kohtumiste sagedus; Rakvere 5; Jõhvi 7; Narva 5 | exact_fact | single_document | MAPPA käsitlev Sotsiaaltöö artikkel | B01 | 23 |
| 24 | V02 | Sõnastusvariant | AUDIT_EXACT | Mis olid erihooldekodude kaardistuse kolm protsenti? | kolm protsenti 25%, 45%, 30% õigesti seotud | numeric_relation | single_document | erihooldekodude kaardistuse artikkel | B01 | 24 |
| 25 | V03 | Sõnastusvariant | AUDIT_EXACT | Palju neid supervisioone maakonna kohta tehti? | maakonna kohta 5 supervisioonikohtumist 2017. aastal | exact_fact | single_document | 2017. aasta supervisiooniartikkel | B01 | 25 |
| 26 | V04 | Sõnastusvariant | AUDIT_EXACT | Eakate vägivallauuring: mis olid kolm näitu? | 10% = 640; 6% = 227; 2% = 100; rollid õigesti seotud | numeric_relation | single_document | Anu Lepsi ja Lenne Indovi 2025 eakate vägivalla artikkel | B01 | 26 |
| 27 | V05 | Sõnastusvariant | AUDIT_EXACT | E-kursuse järelmõju – millal ja kelle hinnangud? | järelhindamine 6 kuu pärast; osaleja ja tööandja hinnangud | comparison_or_temporal | single_document | e-kursuse järelhindamise artikkel | B01 | 27 |
| 28 | V06 | Sõnastusvariant | AUDIT_EXACT | Laste eraldamise otsused: arv ja aasta? | 169 otsust; aasta 2018 | numeric_relation | single_document | lapse eraldamise otsuseid käsitlev 2018. aasta artikkel | B01 | 28 |
| 29 | V07 | Sõnastusvariant | AUDIT_EXACT | Inimarengu aruanne: leheküljed, autorite arv ja stsenaariumid? | 380 lehekülge; 71 teadlast; 4 stsenaariumi | numeric_relation | single_document | inimarengu aruannet käsitlev artikkel | B01 | 29 |
| 30 | V08 | Sõnastusvariant | AUDIT_EXACT | Mis linnades Perepesad olid ja mida need tegid? | Perepesade linnad; artiklis kirjeldatud ülesanded; kõrvalinfot ei leiutata | exact_fact | single_document | Perepesade 2019 artikkel | B01 | 30 |
| 31 | A01 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Krister Tüllineni enda artiklid ajakirjas Sotsiaaltöö? | leida Krister Tüllineni enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Krister Tüllineni enda Sotsiaaltöö artiklid | B02 | 1 |
| 32 | A02 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Maarja Krais-Leoski enda artiklid ajakirjas Sotsiaaltöö? | leida Maarja Krais-Leoski enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Maarja Krais-Leoski enda Sotsiaaltöö artiklid | B02 | 2 |
| 33 | A03 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Kadi Lubi enda artiklid ajakirjas Sotsiaaltöö? | leida Kadi Lubi enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Kadi Lubi enda Sotsiaaltöö artiklid | B02 | 3 |
| 34 | A04 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Ave Ungro enda artiklid ajakirjas Sotsiaaltöö? | leida Ave Ungro enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Ave Ungro enda Sotsiaaltöö artiklid | B02 | 4 |
| 35 | A05 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Jane Langemetsa enda artiklid ajakirjas Sotsiaaltöö? | leida Jane Langemetsa enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Jane Langemetsa enda Sotsiaaltöö artiklid | B02 | 5 |
| 36 | A06 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Liina Lokko enda artiklid ajakirjas Sotsiaaltöö? | leida Liina Lokko enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Liina Lokko enda Sotsiaaltöö artiklid | B02 | 6 |
| 37 | A07 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Kadri Kuulpaki enda artiklid ajakirjas Sotsiaaltöö? | leida Kadri Kuulpaki enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Kadri Kuulpaki enda Sotsiaaltöö artiklid | B02 | 7 |
| 38 | A08 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Merle Tombergi enda artiklid ajakirjas Sotsiaaltöö? | leida Merle Tombergi enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Merle Tombergi enda Sotsiaaltöö artiklid | B02 | 8 |
| 39 | A09 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Heli Ferscheli enda artiklid ajakirjas Sotsiaaltöö? | leida Heli Ferscheli enda artiklid; kokkuvõte ainult nende artiklite teemadest | author_discovery | author_metadata | Heli Ferscheli enda Sotsiaaltöö artiklid | B02 | 9 |
| 40 | A10 | Autoripäring | PROMPT_DERIVED_FROM_CORE | Milliseid teemasid käsitlevad Judit Strömpli enda artiklid ajakirjas Sotsiaaltöö? | leida Judit Strömpli enda artiklid; eristada tema enda tekste teda intervjueerivatest lugudest | author_discovery | author_metadata | Judit Strömpli enda Sotsiaaltöö artiklid | B02 | 10 |
| 41 | S01 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Kuidas on deinstitutsionaliseerimine ja kogukonnapõhine hooldus Eesti sotsiaaltöös aastatel 2017–2026 arenenud? | ajavahemiku areng; sisuliselt erinevad ajakirjaallikad; 2026 piirangud ausalt | multi_source_synthesis | multi_document | 2017–2026 deinstitutsionaliseerimise ja kogukonnahoolduse artiklid | B03 | 1 |
| 42 | S02 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Milliseid töötajate turvalisuse probleeme ja lahendusi kirjeldavad Sotsiaaltöö artiklid? | korduvad probleemid; allikapõhised lahendused; eri allikad eristatult | multi_source_synthesis | multi_document | töötajate turvalisuse teemalised Sotsiaaltöö artiklid | B03 | 2 |
| 43 | S03 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Millist rolli ja milliseid tulemusi on vabatahtlikele Sotsiaaltöö artiklites omistatud? | vabatahtlike rollid; tulemused; sisuliselt eri allikate süntees | multi_source_synthesis | multi_document | vabatahtlike rolli ja tulemuste artiklid | B03 | 3 |
| 44 | S04 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Milliseid lahendusi kirjeldavad Sotsiaaltöö artiklid hoolduskoormuse vähendamiseks? | hoolduskoormuse vähendamise lahendused; allikate eristus; piirangud | multi_source_synthesis | multi_document | hoolduskoormuse teemalised Sotsiaaltöö artiklid | B03 | 4 |
| 45 | S05 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Kuidas kirjeldavad Sotsiaaltöö artiklid vaimse tervise kriisi märkamist ja abi? | kriisi märkamise viisid; abi ja suunamine; mitu sisuliselt toetavat allikat | multi_source_synthesis | multi_document | vaimse tervise kriisi ja abi artiklid | B03 | 5 |
| 46 | S06 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Kuidas on lapse osalusõigust Sotsiaaltöö artiklites aastatel 2016–2025 käsitletud? | osalusõiguse korduvad käsitlused; ajavahemiku areng; kuus või enam sisuliselt seotud allikat vaid kui tõend toetab | multi_source_synthesis | multi_document | lapse osalusõiguse artiklid 2016–2025 | B03 | 6 |
| 47 | S07 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Milliseid taastava õiguse rakendusviise Sotsiaaltöö artiklid kirjeldavad? | rakendusviisid; eri artiklite näited; allikate rollid eristatult | multi_source_synthesis | multi_document | taastava õiguse teemalised Sotsiaaltöö artiklid | B03 | 7 |
| 48 | S08 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Mida kirjeldavad Sotsiaaltöö artiklid Saaremaa COVID-kogemuse ja kriisivalmiduse kohta? | Saaremaa COVID-kogemus; kriisivalmiduse lahendused; mitu asjakohast allikat | multi_source_synthesis | multi_document | Saaremaa COVID-i ja kriisivalmiduse artiklid | B03 | 8 |
| 49 | S09 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Milliseid digilahendusi ja tehisaru kasutusi Sotsiaaltöö artiklid kirjeldavad? | digilahenduste ja tehisaru käsitlused; allikate piirid; puuduva tõendi korral aus piir | multi_source_synthesis | multi_document | digilahenduste ja tehisaru teemalised artiklid | B03 | 9 |
| 50 | S10 | Lai süntees | PROMPT_DERIVED_FROM_CORE | Kuidas käsitlevad Sotsiaaltöö artiklid supervisiooni, mentorlust ja töötajate heaolu? | supervisiooni; mentorluse; heaolu seosed; vähemalt mitu sisuliselt asjakohast allikat | multi_source_synthesis | multi_document | supervisiooni, mentorluse ja heaolu artiklid | B03 | 10 |
| 51 | M01 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Milline oli EPIKoja uuringu meetod, millal uuring tehti ja kui palju osalejaid selles oli? | uuringu meetod; uuringu aeg; 42 osalejat | exact_fact | single_document | EPIKoja uuring eestkostest ja toetatud otsustamisest | B04 | 1 |
| 52 | M02 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Milliseid soovitusi andis EPIKoda Tallinnale? | Tallinna suunatud soovitused; soovitused seotuna EPIKoja allikaga | guidance_document | single_document | EPIKoja soovitused Tallinnale | B04 | 2 |
| 53 | M03 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Millist head tava kirjeldati terviseprobleemiga laste perede toetamiseks? | hea tava põhimõtted ja tegevused; allikas õigesti tuvastatud | guidance_document | single_document | terviseprobleemiga laste perede hea tava | B04 | 3 |
| 54 | M04 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Milliseid tuleohutusnõudeid ja tegevusi hoolekandeasutuse evakueerimisel kirjeldati? | hoolekandeasutuse tuleohutus; evakueerimise alustamine; nõuded allikapõhiselt | guidance_document | single_document | Päästeameti „Hoolekande- ja tervishoiuasutuste tuleohutus” | B04 | 4 |
| 55 | M05 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Mida tuleb teha, kui õpilast ähvardab vahetu või kodune oht? | vahetu ohu ja koduse ohu käsitlus; vajalikud tegevused; sobiv juhend | guidance_document | single_document | õpilase vahetut või kodust ohtu käsitlev juhend | B04 | 5 |
| 56 | M06 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Millised seksuaalvägivalla kriisiabikeskused on Eestis ja millist abi need pakuvad? | kriisiabikeskuste loend; pakutava abi kirjeldus; allikapõhisus | guidance_document | multi_document | seksuaalvägivalla kriisiabi materjalid | B04 | 6 |
| 57 | M07 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Milles seisneb Tarkvanema vestlustööleht ja kuidas seda kasutada? | vestlustöölehe eesmärk; kasutamise sammud; allikas õigesti tuvastatud | guidance_document | single_document | Tarkvanema vestlustööleht | B04 | 7 |
| 58 | M08 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Mida tähendavad õpitulemuste vähendamine, asendamine ja õpitulemustest vabastamine? | kolme mõiste eristus; rakenduse tähendus; juhendi allikas | guidance_document | single_document | õpitulemuste vähendamise, asendamise ja vabastamise juhend | B04 | 8 |
| 59 | M09 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Kuidas teatada abivajavast lapsest ja millal võib teataja jääda anonüümseks? | teatamise viis; anonüümsuse tingimused; andmekaitse piirid | guidance_document | single_document | Õiguskantsleri „Juhend: abivajavast lapsest teatamine ja andmekaitse” | B04 | 9 |
| 60 | M10 | Mitteajakirja materjal | PROMPT_DERIVED_FROM_CORE | Milliseid hooldustöötajate arve esitas OSKA? | OSKA hooldustöötajate arvud; arvude tähendus; õige OSKA allikas | exact_fact | single_document | OSKA sotsiaaltöö seirearuanne 2025 | B04 | 10 |
| 61 | N11 | Riiklik õigusallikas | PROMPT_DERIVED_FROM_CORE | Mida sätestab sotsiaalhoolekande seaduse § 15 abivajaduse hindamise ja abiotsuse kohta? | § 15 hindamiskohustus; abiotsus; riiklik seaduse allikas, mitte samanimeline KOV säte | guidance_document | current_authoritative_source | Sotsiaalhoolekande seadus § 15 | B04 | 11 |
| 62 | N12 | Riiklik õigusallikas | PROMPT_DERIVED_FROM_CORE | Mis on sotsiaalhoolekande seaduse § 17 koduteenuse eesmärk ja milliseid toiminguid see hõlmab? | koduteenuse eesmärk; § 17 toimingud; riiklik seaduse allikas | guidance_document | current_authoritative_source | Sotsiaalhoolekande seadus § 17 | B04 | 12 |
| 63 | N13 | Riiklik õigusallikas | PROMPT_DERIVED_FROM_CORE | Mida sätestab sotsiaalhoolekande seaduse § 20 üldhooldusteenuse kohta? | § 20 üldhooldusteenuse sisu ja tingimused; riiklik seaduse allikas | guidance_document | current_authoritative_source | Sotsiaalhoolekande seadus § 20 | B04 | 13 |
| 64 | N14 | Riiklik õigusallikas | PROMPT_DERIVED_FROM_CORE | Mida sätestab sotsiaalhoolekande seaduse § 21 hooldusplaani kohta, sealhulgas 30 päeva ja poolaasta nõuded? | hooldusplaan; 30 päeva; poolaasta; seosed õigesti esitatud | numeric_relation | current_authoritative_source | Sotsiaalhoolekande seadus § 21 | B04 | 14 |
| 65 | N15 | Riiklik õigusallikas | PROMPT_DERIVED_FROM_CORE | Millised kolm ettevalmistusviisi on sotsiaalhoolekande seaduse § 22 järgi hooldustöötajal? | kolm hooldustöötaja ettevalmistusviisi; § 22 riiklik allikas | exact_fact | current_authoritative_source | Sotsiaalhoolekande seadus § 22 | B04 | 15 |
| 66 | K01 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Kuidas taotleda Kuusalu vallas koduteenust ja mida sätestab selle kohta § 6? | Kuusalu taotlemise kord; kohaliku määruse § 6; ametlik KOV-allikas | current_kov | current_authoritative_source | Kuusalu valla koduteenuse kord, § 6 | B05 | 1 |
| 67 | K02 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Kuidas taotleda Narva linnas koduteenust? | Narva linna taotlemise kord; Narva allikas, mitte Narva-Jõesuu | current_kov | current_authoritative_source | Narva linna koduteenuse ametlik kord | B05 | 2 |
| 68 | K03 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Mis vahe on koduteenusel ja tugiisikuteenusel ning millised sotsiaalhoolekande seaduse sätted neid käsitlevad? | koduteenus = § 17; tugiisikuteenus = § 23; teenuste sisuline erinevus | guidance_document | current_authoritative_source | Sotsiaalhoolekande seadus § 17 ja § 23 | B05 | 3 |
| 69 | K04 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Milliseid sotsiaalteenuseid ja toetusi Luunja vald loetleb? | Luunja valla teenuste loend; toetuste loend; ametlik KOV-allikas | current_kov | current_authoritative_source | Luunja valla ametlik teenuste ja toetuste leht | B05 | 4 |
| 70 | K05 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Millistel tingimustel ja kuidas saab Tartu sotsiaaltransporti kasutada? | Tartu sotsiaaltranspordi tingimused; taotlemise või kasutamise kord; Tartu atribuutika | current_kov | current_authoritative_source | Tartu linna ametlik sotsiaaltranspordi leht | B05 | 5 |
| 71 | K06 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Millist vaimse tervise teenust pakub Järva vald? | Järva valla teenus; sihtrühm või kasutamise tingimused vaid allika toel | current_kov | current_authoritative_source | Järva valla ametlik vaimse tervise teenuse leht | B05 | 6 |
| 72 | K07 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Milline on sotsiaalhoolekande seaduse § 15 järgi abivajaduse hindamise kohustus ja otsus? | § 15 hindamiskohustus; abiotsus; riiklik õigusallikas | current_law | current_authoritative_source | Sotsiaalhoolekande seadus § 15 | B05 | 7 |
| 73 | K08 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Mida tähendab sotsiaalhoolekande seaduse § 17 järgi koduteenus? | § 17 koduteenuse eesmärk ja sisu; riiklik õigusallikas | current_law | current_authoritative_source | Sotsiaalhoolekande seadus § 17 | B05 | 8 |
| 74 | K09 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Mida tähendab sotsiaalhoolekande seaduse § 23 järgi tugiisikuteenus? | § 23 tugiisikuteenuse sisu; riiklik õigusallikas | current_law | current_authoritative_source | Sotsiaalhoolekande seadus § 23 | B05 | 9 |
| 75 | K10 | KOV, teenus ja õigus | PROMPT_DERIVED_FROM_CORE | Mida tähendab sotsiaalhoolekande seaduse § 27 järgi isikliku abistaja teenus? | § 27 isikliku abistaja teenuse sisu; riiklik õigusallikas | current_law | current_authoritative_source | Sotsiaalhoolekande seadus § 27 | B05 | 10 |

## Külmutamise kontroll

- ID-de arv: 75
- unikaalseid ID-sid: 75
- kategooriate jaotus: 22 + 8 + 10 + 10 + 10 + 5 + 10 = 75
- küsimustes esinev kolme punkti märk: puudub
- igal real on `prompt_origin`, `batch_id` ja `turn_number`: jah
- testiklasside jaotus: 33 + 18 + 24 = 75; iga case_id kuulub täpselt ühte klassi
