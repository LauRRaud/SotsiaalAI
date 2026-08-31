# Uue allikapõhise küsimustiku kontroll — 31.08.2026

Testitõendid, mitte konkureeriv projektiseisu fail. Aktiivne tööseis on `docs/platvormi arendus/SotsiaalAI.md` S1.0-s.

**Jätkuvoor F04–F08:** viis uut põhiküsimust, esmalt eraldi ja siis järjest samas vestluses: 10 päringut, **1 PASS / 9 FAIL**. See on muutmata baasversiooni tulemus; paranduse järelpäringud lisatakse eraldi. Põhiküsimusi on nüüd kontrollitud 8 ja tegelikke päringuid koos varasema F02 paranduskontrolliga 23. Allpool olev esimese kolme küsimuse tabel on ajalooline, mitte värske koondhinne.

Omaniku 31.08 korraldus: alustada testküsimustega pärast in-app sisselogimist. Kood ja server: `e9669a366b9bec23c3727273415e25211bd4e98b`, build `P-HRrBvKMP_Z2zSmL-mV4`. Esimene plokk on U75-F01 → U75-F02 → U75-F03: esmalt igaüks uues vestluses, seejärel sama järjekord ühes uues vestluses. Küsimusi ei sõnastata ümber ja testi ajal koodi ei muudeta.

Manifest: `C:/Users/rauds/.codex/worktrees/4954/SotsiaalAI/eval/rag-uus75-allikapohine-2026-08-31.json`. Seal on 50/75 põhikirjet; siin ei väideta kogu75 läbimist. Kolme esimese allika ACTIVE seis, aktiivversioon, lõigud ja räsid kontrolliti serverist uuesti 2026-08-31T12:59:02Z. Isolated/sequential tulemused arvestatakse eraldi; kordus ei lisa uut põhiküsimust.

| Küsimus | Eraldi | Järjest | Põhjus |
|---|---|---|---|
| U75-F01 | PASS | PARTIAL | Eraldi mõlemad väited õiged; järjestikuses vastuses puudub kohtu kinnitatud kava detail. |
| U75-F02 | FAIL | FAIL | Mõlemal korral õige artikkel leiti, kuid document_identity_mismatch blokeeris mudelikonteksti; keeldumine õige 40–60% vastuse asemel. |
| U75-F03 | PASS | PASS | Mõlemal korral kolme rühma toimed ja näited õiged; kuvatud küsitud artikkel. |

**Ploki tulemus: 3 põhiküsimust, 6 vastust.** Eraldi 2 PASS / 0 PARTIAL / 1 FAIL; järjest 1 PASS / 1 PARTIAL / 1 FAIL. Kokku 3 PASS / 1 PARTIAL / 2 FAIL. See ei ole kogu50/75 ega Golden37 kvaliteedihinne. F01 erinevus ilmnes mõlemal korral ajaloota esimeses pöördes, mistõttu seda ei saa omistada ajaloo mõjule. F02 keeldumine kordus sama aastarollide veaga; F03 läbis mõlemad korrad. Testiplokis RAG-koodi, registrit ega indeksit ei muudetud.

## U75-F01 — eraldi vestlus

**Küsimus:** Millise eesmärgiga vastandab 2023. aasta artikkel „Võlanõustamise kaks kliendilugu” pankrotimenetlust ja võlgade ümberkujundamist?

**Täisvastus:**

- Pankrotimenetlus – eesmärk on käsitleda olukorda, kus inimene on püsivalt maksejõuetu; tema vara müüakse pankrotivarana võlausaldajate nõuete katteks.
- Võlgade ümberkujundamine – eesmärk on ületada tekkinud makseraskused ja vältida pankrotimenetlust, kujundades võlad kohtu kinnitatava kava alusel ümber. See võib tähendada võlasumma vähendamist, intressimäärade korrigeerimist või paindlikumaid maksetingimusi.

**Hinnang: PASS.** C1 ja C2 täidetud. Lisatud maksetingimuste väide on sama aktiivse artikli teises lõigus; selle SHA256 on `d1327a4c43e3c3b97fa0b3edc0e73635f1a26684671c9820ed11fd82406adb48` (lisakontroll 12:59:50Z). Ei anta konkreetsele lugejale menetlussoovitust ega väideta praeguse õiguse kontrollimist.

**Avatud allikapaneel:** Anna-Liisa Arukask, 2023. Võlanõustamise kaks kliendilugu. Sotsiaaltöö 3/2023 · lk 1–3 · Sotsiaalteenus. Kaasautor Evelyn Eichhorst on registris ja tekstis; kaart kuvab ainult esimest autorit.

**Diagnostika:** `NO_FAILURE_OBSERVED`, validaator `requested_qualitative_slots_validated`, ajaloo sõnumeid 0. Kontekstis, valideeritud toena ja kuvamiseks salvestatuna sama õige source-ID. See tehniline seis ei asenda siin tehtud käsitsi sisuhindamist.

[Täisvastuse, püsiviite, paneeli ja diagnostika JSON](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/isolated-U75-F01.json).

## U75-F02 — eraldi vestlus

**Küsimus:** Millises vahemikus oli Põhja-Pärnumaal mitme kuhjunud võlanõudega inimeste osakaal võlanõustamisele suunatutest aastatel 2019–2022, nagu kirjeldab Anneli Kaljuri 2023. aasta artikkel?

**Täisvastus:** Ma ei saa sellele praegu piisavalt kindlat vastust anda.

**Hinnang: FAIL.** Õige allikatõend on aktiivses artiklis olemas: 2019–2022 võlanõustamisele suunatutest eri aastatel 40–60%, mitte kõigist vallaelanikest. Allikanuppu ega kuvatud allikaid ei olnud.

**Automaatses diagnostikas esimene nähtav tõrge:** dokumendiidentiteedi värav, `document_identity_mismatch`; required=true, matched=false, confidence=low. Otsingus on õige `sotsiaaltoo_pohja-parnumaa-volanoustamiskogemus-2023-3`, kuid selected_context/model_context on tühjad ja vastuse faktivalideerimine ei käivitunud. Ajaloo sõnumeid 0.

**Canonical trace'i ja koodi käsitsi juurpõhjuse kontroll:** vastuse `cmth8zpa80019dckmsccmuyl4` salvestatud trace'is on õige kandidaadi `author_matched=true`, `identity_matched=true`, skoor 74 ning teema- ja sisuteksti kattuvusi kummaski 9. Planner määras ekslikult `document_source_years=["2019","2022"]` ja `evidence_period_years=[]`: mõõtmisperiood sai ilmumisaastateks ning tegelik ilmumisaasta 2023 jäi välja. `lib/chat/questionPlanner.js:1862` võtab allikaaastatest kaks esimest. `lib/chat/retrievalContextAssembler.js:872` nõuab autoripõhiseks lukuks nende aastate kinnitust; trace'i autorikinnituse `promotion_eligible=false`, `matched_document_ids=[]`. Hilisem lukuvärav (`:7274`) muudab lõppidentiteedi sobimatuks ja kontekst jääb tühjaks. Esimene tõendatud lahknevus on seega **aastarollide planeerimine**, mitte puuduv artikkel, autorinime mittesobivus ega mudeli arvutusviga.

**Tõendipiirang:** lukutõrke lõplik alamkood ei säili nähtavas põhjusteloendis, sest `lib/chat/mainResponseHandler.js:1358` piirab selle 20 esimese põhjusega. Konkreetse hilise lukuraja seos tugineb runtime-väljade ja koodi koostoimele. Automaatne aruanne näitab praegu blokeerivat väravat, mitte kogu seda juurpõhjust. Koodi pole testiploki ajal muudetud; parandatud käitumine on `NOT_PROVEN`.

[Täisvastuse, püsiviite ja diagnostika JSON](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/isolated-U75-F02.json).

## U75-F03 — eraldi vestlus

**Küsimus:** Kuidas eristab 2023. aasta artikkel „Uimastite tarvitamise põhjused ja levimus” stimulantide, depressantide ja empatogeenide toimet? Too iga rühma kohta üks artikli näide.

**Täisvastus:**

- Stimulandid – ergutava toimega; artikli näide on amfetamiin (samuti kokaiin).
- Depressandid – kesknärvisüsteemi pärssiva toimega; artikli näide on GHB (samuti olmekeemia).
- Empatogeenid – suurendavad suhtlemis- ja empaatiavõimet; artikli näide on MDMA ehk ecstasy.

**Hinnang: PASS.** Kõik kolm nõutud väidet koos õigete näidetega. Tarvitamisjuhiseid, annuseid ega ohutuse kinnitust ei lisatud. Avatud allikapaneel: Marin Vaher, 2023. Uimastite tarvitamise põhjused ja levimus. Sotsiaaltöö 2/2023 · lk 1–6 · Vaimne tervis. Ajaloo sõnumeid 0.

[Täisvastuse, allikapaneeli ja diagnostika JSON](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/isolated-U75-F03.json).

## U75-F01 — järjestikuse vestluse esimene küsimus

**Küsimus:** Millise eesmärgiga vastandab 2023. aasta artikkel „Võlanõustamise kaks kliendilugu” pankrotimenetlust ja võlgade ümberkujundamist?

**Täisvastus:** Eesmärgiga vastandab artikkel pankrotimenetlust ja võlgade ümberkujundamist selleks, et näidata erinevaid lahendusi tekkinud makseraskuste ületamiseks: pankrot tähendab püsiva maksejõuetuse tunnistamist ja vara müümist nõuete katteks, võlgade ümberkujundamise eesmärk on aga makseraskustest üle saada ning pankrotimenetlust vältida.

**Hinnang: PARTIAL.** C1 ja mõlemad eesmärgid on õiged; C2 nõutud kohtu kinnitatud kava detail puudub. Allikapaneelis sama õige artikkel. Automaatne tehniline seis on `NO_FAILURE_OBSERVED` ja validaator `requested_qualitative_slots_validated`: need ei tõenda vastuse täielikkust manifesti kõigi nõuete suhtes. See on esimene küsimus tühjas vestluses, `history_message_count=0`; erinevust eraldi vastusest ei saa omistada ajaloo mõjule.

[Täisvastuse, allikapaneeli ja diagnostika JSON](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/sequential-U75-F01.json).

## U75-F02 — sama vestluse teine küsimus

**Küsimus:** Millises vahemikus oli Põhja-Pärnumaal mitme kuhjunud võlanõudega inimeste osakaal võlanõustamisele suunatutest aastatel 2019–2022, nagu kirjeldab Anneli Kaljuri 2023. aasta artikkel?

**Täisvastus:** Ma ei saa sellele praegu piisavalt kindlat vastust anda.

**Hinnang: FAIL.** Sama vale keeldumine nagu eraldi. Õige artikkel on otsingutulemustes, identiteedikontroll blokeerib konteksti (`document_identity_mismatch`), allikanuppu pole. UI-s eelneb F01 küsimus-vastus samas vestluses. Canonical trace kinnitas ka siin valed allikaaastad 2019/2022 ning puuduva 2023. Automaatne `history_message_count=0` loeb mudelisse valitud massiivi, mitte vestluse kogupikkust: route valib iseseisva küsimuse puhul `modelHistory=[]`. Sisend- ja otsinguajaloo eraldi loendurid v1-s puudusid. Null ei tõenda UI ajaloo kadumist ega seda, et küsimused polnud samas vestluses. `carry_previous_source_filter=false`.

[Täisvastuse, püsiviite ja diagnostika JSON](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/sequential-U75-F02.json).

## U75-F03 — sama vestluse kolmas küsimus

**Küsimus:** Kuidas eristab 2023. aasta artikkel „Uimastite tarvitamise põhjused ja levimus” stimulantide, depressantide ja empatogeenide toimet? Too iga rühma kohta üks artikli näide.

**Täisvastus:**

2023. aasta artikkel eristab neid uimastirühmi peamiselt toime järgi:

- Stimulandid – ergutava toimega; näiteks amfetamiin.
- Depressandid – kesknärvisüsteemi pärssiva toimega; näiteks GHB.
- Empatogeenid – suhtlemis- ja empaatiavõimet suurendava toimega; näiteks MDMA ehk ecstasy.

Need jaotused on esitatud artiklis „Uimastite tarvitamise põhjused ja levimus” (Sotsiaaltöö 2/2023).

**Hinnang: PASS.** Kõik kolm nõutud väidet ja näidet õiged. Tarvitamisjuhiseid ega ohutuse kinnitust pole. Avatud allikapaneel: Marin Vaher, 2023. Uimastite tarvitamise põhjused ja levimus. Sotsiaaltöö 2/2023 · lk 1–6 · Vaimne tervis. Diagnostika `NO_FAILURE_OBSERVED`, validaator `all_claims_in_one_rendered_source`. Konteksti lühendamine on diagnostikas nähtav piirang; selle konkreetse vastuse kõik nõutud faktid on siiski õiged.

[Täisvastuse, allikapaneeli ja diagnostika JSON](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/sequential-U75-F03.json).

## Automaataruande kontroll ja diagnoosi piirid

Autenditud serveri in-app vaates tekkis aruandesse 3 kirjet. Pärast kõiki kolme küsimust avas esimese vastuse diagnostikanupp ikka esimese vastuse `message:cmth9539e0028dckmx1bvx37c`, mitte viimast vastust. Klikiti „Laadi aruanne alla (.md)” ja brauser kinnitas download-sündmuse; allalaaditud faili sisu selles in-app kontrollis eraldi ei loetud. [UI kontrolltõend](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/report-ui-check.json).

Automaatne aruanne koondab ühe vestluse salvestatud pöörded. Siinne käsitsi koond seob nelja vestluse kuus vastust testmanifesti nõuetega ja lisab uuritud põhjuse. F02 puhul näitab automaatne aruanne blokeerivat identiteediväravat; aastarollide algviga selgus alles canonical trace'i ja koodi lugedes. F01 PARTIAL näitab, et roheline tehniline valideerimine ei taga kõigi nõutud detailide olemasolu. Seega ei ole tõendatud lubadus „iga küsimuse täpne algpõhjus alati automaatselt teada”.

Järgmise parandusploki kandidaadid: (1) mõõtmisperioodi ja allika ilmumisaasta lahushoidmine; (2) lõpliku lukutõrke põhjuse ning aastarollide piiratud struktureeritud tõendi säilitamine diagnostikas; (3) faktitoe kontrolli eristamine vastuse täielikkuse kontrollist. Need on leiud, mitte selles testiplokis tehtud parandused.

## Omaniku nõutud jäljetäiendus ja järelkontroll

Pärast esimest testiplokki andis omanik uue korralduse: kui tõrke põhjus pole mõistetav, tuleb arendada parem tehniline jälg. Punkt (2) teostati eraldi plokina; RAG-i aastarollide valikut ega vastamise loogikat ei muudetud. Koodirelease `058ad4c39e090ef9652a936383eb48e086dd6ead`, serveribuild `iA_8a6OG9TZwOkJ3JQ0Hv`. 23 UTC sihttesti, scoped ESLint, i18n, diff-check ning Windowsi ja Linuxi build läbisid. Serveri kolm teenust active; vestlus HTTP200, anonüümne diagnostika401; RAG ok, mõlemad indeksid ready ja sama põlvkond. Taastatava artefakti BUILD_ID kattus töötava buildiga. Väljalaske säilitus eemaldas ühe vana current-artefakti ja ühe vana buildilogi; alles kolm.

Sama F02 küsimus esitati samas testvestluses neljandana. **Sisuline vastus endiselt FAIL:** „Ma ei saa sellele praegu piisavalt kindlat vastust anda.” **Jälje loetavus PASS:** uuest „Miks süsteem nii otsustas?” plokist sai koodi lugemata tuvastada:

- planner nõudis allikaaastaid 2019 ja 2022, mõõtmisperioodi aastad jäid tühjaks;
- 2023 märgiti küll allikaaastaks, kuid jäeti lõppvalikust välja;
- õige kandidaadi allikaaasta on 2023 ja nõutud autor kinnitati;
- lõplik põhjus `source_years_unconfirmed`: autor sobis, kuid nõutud aastad ei kinnitunud ja alternatiivne lukutingimus ei lubanud allikat kasutada;
- päringuga saabus 6 ajaloosõnumit; otsingusse valiti 0 ja mudelisse 0. Mõlemal on nähtav teadliku väljajätmise põhjus, mitte oletus puuduva ajaloo kohta.

Automaataruandes on nüüd neli kirjet; värske MD allalaadimissündmus kinnitati. 762 × 699 in-app paneelis keritud põhjuseploki tekst ja väljad olid loetavad, kattumist ei nähtud; eraldi uut mobiilsuuruse kontrolli selles plokis ei tehtud. Algpõhjuse üldine automaatne garantii jääb `NOT_PROVEN` ja puuduvat vana tõendit ei kirjutata tagantjärele juurde.

[Uue päringu täisvastus, nähtav selgitus ja v2 diagnostikatõend](../docs/audits/evidence/rag-uus75-2026-08-31-e9669a36/diagnostics-v2-F02-058ad4c3.json).

## Aastarollide parandus pärast omaniku korraldust „paranda rag süsteem”

F02 esimene lahknevus täpsustati: jagatud leksikaalne normaliseerimine eemaldab kriipsud ja kirjavahemärgid enne aastamainimiste sidumist. Vahemiku 2019–2022 otspunktid kaotavad ühise perioodiseose ning hilisem „artikkel” annab neile allikarolli. Kahe allikaaasta piir jätab seejärel 2023 välja. Piiri ega ranget dokumendilukku ei lõdvendatud.

Üldparandus tuvastab selgesõnalise vahemiku rolli kirjavahemärke säilitavas vaates ja kannab selle mainimise järjekorranumbri abil tagasi olemasolevatele normaliseeritud tekstivahemikele. Andmeperiood säilib ka mitte-episoodilises faktiküsimuses; see ei muuda küsimust kunstlikult episoodiks. Vahetu avaldamisverb või allikapea säilitab tegeliku ilmumisperioodi; ebakindel „aastate …” üksi ei tühista varasemat rollitõlgendust. Diagnostika lubatud meetodiloendisse lisandus `explicit_year_range`, mitte uus vabatekstiväli. Korpust, registrit, indeksit ega faktivalidaatorit ei muudetud.

Arenduse sihttõend: 10 UTC aastarolli testi (sh teise teema ja aastatega sõnastus, õigesse allikasse lukustumine ning vale aasta tagasilükkamine) ja 23 diagnostikatesti (sh parandatud rollide päris producer → canonical → projektsioon). Finite avaldamisverbide ning allikapeaga „aastate … artiklid” negatiivsed juhud lisati sõltumatu ülevaatuse leiu põhjal. Serveri järelkontroll: `NOT_PROVEN` kuni uue väljalaske autenditud küsimused on allpool salvestatud.

F01 varasem `PARTIAL` jääb muutmata. Sama assistendisõnumi canonical trace'i värske kirjutuskaitstud DB-lugemine kinnitas õige allika, 8/8 kontekstitükki, ühe seotud kvalitatiivse nõude ja läbinud vastusekontrolli. Küsimus küsis menetluste eesmärki; vastus kirjeldas neid, kuid manifest nõudis lisaks kohtu kinnitatud kava kui mehhanismi. Üldine faktiplaneerija viga pole selle erinevusega tõendatud. Üht detaili ei kodeeritud kõigisse eesmärgiküsimustesse ega muudetud testmanifesti PASS-i saavutamiseks.

### Vaheväljalase 991bdcd4: aastarollid PASS, vastus veel FAIL

Kood `991bdcd44491a22acef2ef9451c6378b2c5115e1`, serveribuild `YWZ9IJdUPo5MGGEoP-vAr`; kohalik build 34,2 s, serveri build 36,0 s. Mõlemad sõnastused esitati eraldi uutes autenditud in-app vestlustes. Mõlemas kinnitas trace allikaaasta 2023, andmeperioodi 2019/2022, õige allika kõrge kindlusega luku ja mudelikonteksti. Vastus jäi **FAIL**-iks järgmise põhjusega `requested_fact_plan_incomplete`.

[Algse sõnastuse tõend](../docs/audits/evidence/rag-uus75-2026-08-31-991bdcd4/isolated-U75-F02-incomplete-plan.json), [teise sõnastuse tõend](../docs/audits/evidence/rag-uus75-2026-08-31-991bdcd4/isolated-U75-F02-alternate-incomplete-plan.json). Aastaparanduse järel ilmnenud tõrge ei tühista esimest parandust ega tõenda kogu vastamisraja õnnestumist.

Canonical trace'i kirjutuskaitstud kontroll täpsustas algpõhjuse: küsitud faktiplaan oli täielik ja sisaldas üht `proportion` nõuet; renderdatud tõendi sidumise leping oli `rendered_evidence_mapping_incomplete`, seotud 0/1 ja arvulisi kandidaate 0 (15 tõendifragmenti). Mapper jättis vahemiku 40–60% otsesõnu välja (`qualifier=range`), selle asemel et siduda mõlemad piirid üheks faktiks. See ei olnud puuduva küsimussõna ega puuduva artikli viga.

Jätkuparandus lisab selgesõnalise protsendivahemiku ühe atomaarse kandidaadi ja mõlemat piiri kandva faktilepingu. Vastusekontroll nõuab samas vahemikus mõlemat täpset, samas järjekorras piiri, sama mõõdiku seost ja eraldi kahe arvumainimise sidumist. Üks otspunkt, muutunud või ümberpööratud piirid, eri protsendid, ühikuta arvud, vastuolulised vahemikud ja toetamata ligikaudsus ei läbi. Skalaari taastetee ei tohi vahemikust üksikut arvu genereerida. Küsifraas „millises vahemikus” ei muutu kohustuslikuks teemamärksõnaks; planneri nõude täielikkuse väravat ei nõrgendata.

Diagnostikasse lisandub piiratud faktide sidumise tõend: põhjus, seotud/küsitud faktide ja arvukandidaatide arv ning nõutud/kinnitatud vahemikupiiride arv. Tooreid tõendiväärtusi ega sisu ei lisata projektsiooni. Jätkuparanduse serveritõend on `NOT_PROVEN` kuni järgneva väljalaske käsitsi kontrollini.

### Lõppväljalase dba8e06d: F02 kaks sõnastust eraldi ja järjest — 4/4 PASS

Kood `dba8e06d8cb82f23d9d9aaf100469c88eaea915d`, serveribuild `kDAqeRc59ock3wOuMJUDt`. Lõpliku koodipuu 25 diagnostika- ja 52 asjakohast RAG-sihttesti läbisid `TZ=UTC` all; samuti scoped ESLint, i18n, diff-check ning Windowsi (34,8 s) ja Linuxi (36,0 s) tootmisbuild. [Keskkonna ja taastatava artefakti tõend](../docs/audits/evidence/rag-uus75-2026-08-31-dba8e06d/environment.json): kolm teenust active, vestlus HTTP200, anonüümne diagnostika401, RAG ok; 49 727 vektorit / 6089 registrikirjet / 6073 aktiivset dokumenti, lexical ja lemma ready ning registriga samal põlvkonnal. Korpust, indeksit, skeemi, autentimist ega mudelivalikut ei muudetud. Säilitus eemaldas kummagi selles parandusplokis tehtud väljalaske ajal ühe vana current-artefakti ja ühe vana buildilogi; alles kolm viimast kummastki ning lõppväljalaske taastatava artefakti BUILD_ID kontrolliti.

Käsitsi kontrolliti omaniku autenditud in-app sessioonis esmalt mõlemad sõnastused uutes vestlustes ning seejärel samad kaks küsimust ühes uues vestluses. Kõigil neljal avati päris allikapaneel ja sama vastuse diagnostika. Need on **ühe põhiküsimuse neli kontrollvastust**, mitte neli uut manifestijuhtumit.

| Sõnastus ja režiim | Sisuline vastus, allikas, jälg | Salvestatud tõend |
|---|---|---|
| Algne, eraldi | PASS / PASS / PASS | [Täisvastus ja trace](../docs/audits/evidence/rag-uus75-2026-08-31-dba8e06d/isolated-U75-F02.json) |
| Teine sõnastus, eraldi | PASS / PASS / PASS | [Täisvastus ja trace](../docs/audits/evidence/rag-uus75-2026-08-31-dba8e06d/isolated-U75-F02-alternate.json) |
| Algne, järjest esimene | PASS / PASS / PASS | [Täisvastus ja trace](../docs/audits/evidence/rag-uus75-2026-08-31-dba8e06d/sequential-U75-F02.json) |
| Teine sõnastus, samas vestluses teine | PASS / PASS / PASS | [Täisvastus ja trace](../docs/audits/evidence/rag-uus75-2026-08-31-dba8e06d/sequential-U75-F02-alternate.json) |

Kõik vastused andsid **40–60% võlanõustamisele suunatud inimestest aastatel 2019–2022**, mitte osakaalu kogu valla elanikkonnast. Avatud paneel näitas Anneli Kaljuri „Põhja-Pärnumaa võlanõustamiskogemus”, Sotsiaaltöö 3/2023. Paneeli `lk 1–2` on dokumendisisene leheküljetähis; selle kattumist ajakirja trükilehekülgedega ei väideta. Kõigis jälgedes olid allikaaasta 2023, mõõtmisperiood 2019/2022, kinnitatud õige dokumendilukk, sama allikas valitud/mudeli/valideeritud/väite/vastuse/kuvatud kihis, täielik faktisidumine 1/1 ning ühe vahemikunõudega seotud kaks vastuse arvumainimist. Validaator läbis põhjusega `all_claims_in_one_rendered_source`.

Järjestikuse teise küsimusega saabus 2 ajaloosõnumit; otsingusse ja mudelisse valiti 0, põhjuseks nähtavalt iseseisev konkreetse dokumendi ajaperioodiküsimus. See kinnitab samas vestluses töötamist ja teadlikku ajaloovalikut, **mitte ajalool põhineva viitelise jätkuküsimuse läbimist**.

Automaatkoond näitas kahte kirjet. Esimese vastuse nupp avas ka pärast teist vastust `message:cmthdkdr7002qtzkmg2qe4m6r`; see ei liikunud viimase vastuse peale. MD allalaadimissündmus kinnitati, allalaaditud faili sisu eraldi ei loetud. Uued sidumise ja vahemikupiiride read olid 762 × 699 in-app paneelis kerides loetavad ja kattumiseta; eraldi uut mobiilikontrolli ei tehtud. [Aruande UI-tõend](../docs/audits/evidence/rag-uus75-2026-08-31-dba8e06d/report-ui-check.json).

**Alles jäävad piirid.** F01 varasem PARTIAL jääb muutmata ja F03 ei korratud selle lõpprelease'i vastu. Kogu50/75 ega Golden37 kvaliteet ei ole tõendatud. Automaatne `NO_FAILURE_OBSERVED` ei võrdu sisulise PASS-iga; siinsed hinnangud lisati vastuse ja allika käsitsi võrdluse järel. Üksikvastuse trace'is on release/build/prompt/index-versiooni väljad jätkuvalt puudu ja deklareeritud; selle kontrolliringi väljalase on tõendatud eraldi keskkonnakontrolliga, mitte iseseisvalt täieliku versioonijäljega. Otsingu+konteksti kestused olid 30,572 / 13,785 / 19,151 / 14,394 s (ülaltoodud järjekorras); need ei ole terve vastamise ajad ega jõudluse paranemise tõend. Järgmine töö on teiste manifestijuhtumite väikesed põhjusepõhised plokid, mitte kogu süsteemi automaatne õigsussertifikaat.


## Jätkuvoor F04–F08 — muutmata baas, 5 uut küsimust ja 10 päringut

Omaniku „jätka” alusel võeti järgmised viis manifestikirjet algses sõnastuses. Esmalt igaüks nähtavalt tühjas uues vestluses, seejärel F04 → F05 → F06 → F07 → F08 ühes uues vestluses. Nende kümne päringu ajal koodi ega korpust ei muudetud. Värskelt mõõdetud local/origin/server HEAD `5074b5e03f9fa7708b6ad3db9f8bb9ca243c8d08`, töötav kood `dba8e06d`, BUILD_ID `kDAqeRc59ock3wOuMJUDt`. Kolm teenust active; RAG 49 727 vektorit, 6089 registrikirjet, 6073 aktiivset dokumenti; lexical/lemma ready ja samal põlvkonnal. [Keskkond](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/environment.json).

Kõigi viie artikli ACTIVE seis, täpne aktiivversioon ja vajaliku lähtekatkendi SHA256 kontrolliti serveri allikateenuse kaudu. [Allikakontroll](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/source-verification.json). [Külmutatud küsimused ja kriteeriumid](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/manifest.json), algmanifesti SHA256 `683449f7ac618e7cdf47b99d0f778d7a8cc30a1a0afe0aeaa36b41f53e85fd2e`. Manifesti 50 kirjet ei võrdu eesmärgiks seatud 75 valmis või läbitud küsimusega.

| Juhtum | Eraldi | Järjest | Esimene tõendatud lahknevus |
|---|---|---|---|
| F04 Eesti/EL-i üksi elavate eakate osakaalud | FAIL | FAIL | Kaks nimega võrdlusrühma planeeriti üheks arvuks; 2017 vaatlus sai 2019 kõrval allikaaastaks. Õige allikas oli kontekstis, kuid arvud seostamata 0/1. |
| F05 36% tähendus ja WHO uuringu aeg | FAIL | FAIL | Teadaoleva protsendi tähendust otsiti tundmatu arvuna; uuringu aja nõue sai üldise tekstiseose. Autori/viite sõnad sattusid sisuankruteks. |
| F06 alkoholipoliitika piloodi jaotus ja omavalitsused | FAIL | FAIL | Kvalitatiivne 2/2 sidumine valis jaotuse asemel testostu vanusekontrolli ja nimede asemel pealkirja/byline'i. Vastusekontroll leidis puuduva esimese nõude. |
| F07 Tartu rändekava leibkonnad/inimesed | FAIL | FAIL | Täpse autori ainus teemakohane kandidaat ei saanud lukku, sest puudus eraldi pealkiri või ilmumisaasta; vaatluse 2017 ei ole ilmumisaasta luba. |
| F08 eluase/rehabilitatsioon | PASS | FAIL | Sama renderdatud konteksti korral erinev vastusekontroll. Leping seob järjekorra asemel üldisi ülevaatesõnu; allikat kirjeldav „mida võrreldakse” sai lisaküsimuseks. |

Kõigi üheksa keeldumise puhul puudus allikanupp. F04/F05/F06 ja järjestikune F08: „Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.” F07 mõlemad: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.” Täisvastused, püsiviited, ajad ja diagnostika säilivad iga küsimuse failis:

| Juhtum | Eraldi täistõend | Järjest täistõend |
|---|---|---|
| F04 | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/isolated-U75-F04.json) | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/sequential-U75-F04.json) |
| F05 | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/isolated-U75-F05.json) | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/sequential-U75-F05.json) |
| F06 | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/isolated-U75-F06.json) | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/sequential-U75-F06.json) |
| F07 | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/isolated-U75-F07.json) | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/sequential-U75-F07.json) |
| F08 | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/isolated-U75-F08.json) | [JSON](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/sequential-U75-F08.json) |

F08 eraldi vastus kirjeldas õigesti astmelise mudeli rehabilitatsioon → eluase ja eluasemepõhise mudeli eluase → järgnev/samaaegne rehabilitatsioon ning tugiteenused. Avatud paneel: Jüri Kõre, 2017, „Trepist üles või alla. Eesti vajab tulemuslikumat kodutuse poliitikat”, Sotsiaaltöö 1/2017, lk 39–55. Väited kontrolliti ka artikli täiendavatest aktiivsetest lõikudest. Kõigi kaasautorite kuvamist ega trükilehekülgede sõltumatut vastavust selle kontrolliga ei tõendata.

### Ajaloo mõju ja automaatkoondi kontroll

F08 eraldi ja järjest renderdatud konteksti SHA256 on identne: `6ca16a57c461f083404f4e2a6be8aa45eefece2e86fb7a12529c017f13772de5`; kõik kaheksa mudelile renderdatud kehaspanni kattuvad. Mõlemal valitud mudeli- ja otsinguajalugu 0; järjest saabus 8 sõnumit ja need jäeti explicit_current_document tõttu välja. Seega ei põhjenda siin ebaõnnestumist varasema vestlusteksti lisamine mudelile. See ei tõenda täielikku prompt'i identiteeti ega välista muud mudeli varieeruvust. F07 järjest valis otsingusse 6 ajaloosõnumit, mudelisse 0; kõigi juhtumite kohta ei tehta ühist ajaloo puudumise väidet.

Koondis nähtus viis tegelikku kirjet (mitte valiku placeholder). Esimese vastuse nupp avas pärast viiendat ikka `message:cmthedz3n006ztzkmk5xvk7jj`. MD allalaadimissündmus kinnitati; allalaaditud faili sisu eraldi ei loetud. [UI-tõend](../docs/audits/evidence/rag-uus75-2026-08-31-batch2-5074b5e0/report-ui-check.json).

### Põhjusepõhised paranduspiirid

F04 üldparandus eraldab kaks selgesõnaliselt nimetatud võrdlusrühma, seob iga arvu oma nimega ja lubab ainult selle pere sees küsimusest erinevat tõendi järjekorda. Sama nimega või sildita arvud, vahetatud arvud ning vastuolulised tõendid ei läbi. Sulgudes alamrühmi ei asendata põhirühma osakaaluga. Kümnendkoma ja aastaarvu järgarvupunkt ei katkesta arvusuhte kohalikku teksti. Selge „näitaja/osakaal … aasta kohta” on vaatlus, mitte kaugema artikli ilmumisaasta. Luku ega üldise faktitoe lävendeid ei lõdvendata.

Jäljetäiendus säilitab iga kvalitatiivse nõude kohta kontrollitud vastuseüksuste arvu, sobivate kandidaatide arvu, omistamise/seosekonflikti ning esimese tagasilükkava kontrolli loendurid. Lubatud põhjused eristavad puuduvat seost, ajaväärtust, arvu, tõendiankrut, tegevuse-objekti seost, sisupayload'i ja vastuseosade arvu. Valitud tõendifragmendi SHA256 võimaldab kontrollida, kas valiti üldse vastatav sisu. See ei salvesta mudelimustandit, allikateksti ega ankrusõnu. Loendurid kirjeldavad järjestikuste kontrollide esimest tagasilükkamist, mitte kõigi järgnevate kontrollide iseseisvat tulemust. Puuduv vana tõend jääb puuduvaks.

**Teised vead ei ole selle plokiga parandatud.** F05 vajab protsendi tõlgenduse tüübitud ühiku, vanuse, populatsiooni ja sageduse sidumist ning uuringuperioodi eristamist bibliograafilisest aastast. F06/F08 vajavad jaotuse, kõigi nimetatud osaliste ning järjekorra/polaarsuse sisulist sidumist; pealkirja ja viitesaba sõnad ei tohi olla küsitud faktid. F07 autori lukk peab lisaks unikaalsele autori kinnitusele nõudma sõltumatut sisuteksti teemakattuvust enne trusted-ID tugevdamist; lihtsalt tingimuse eemaldamine lubaks sama autori vale teema. Leibkonna/inimeste kaks loendust ja jaotuse sisu vajavad eraldi järelkontrolli.

Kitsas puhas helper-katse tõendas kvalitatiivse vana kontrolli puudust: „kõigepealt rehabilitatsioon, seejärel eluase” allika puhul läbis ka ümberpööratud järjekord. See ei ole uus kasutajavestluse päring ega uus manifestijuhtum. Samuti ei piisa F05 puhul paljast arvude olemasolust: käsitsi koostatud üldine kvalitatiivne leping lubas protsendi asemel sama arvu inimesi või vanuse asemel eurosid. Neid riske ei parandata lävendite lõdvendamise ega allikaspetsiifilise sõnade tabeliga.

Arenduse varasem värav: 27 diagnostika-, 8 nimetatud võrdlusrühma ja 17 seotud kvalitatiivse lepingu testi ning 66 sihitud planneri/aasta/arvu/vastuse regressiooni läbisid UTC-s (118 testi; varasem 115 loendus ei sisaldanud kolme viimast vanuse/nime kontrolli). Järgnev lõppvärav on eraldi allpool; ükski sihttest ei ole serverivastuse tõend.

### Omaniku analüüsi P0/P1 esimene teostus — kohalik, mitte väljalase

31.08.2026 kell 20:55 Europe/Tallinn kontrollitud kohalik ja `origin/main` HEAD on jätkuvalt `5074b5e03f9fa7708b6ad3db9f8bb9ca243c8d08`; tööpuus on nimeliselt piiritletud commit'imata muudatused. Selle etapi jooksul ei tehtud commit'i, push'i, deploy'd, andmebaasimigratsiooni ega uusi pärisvestluse küsimusi. Serveri varasem F04–F08 hinnang jääb muutmata.

- Katsekirje tekib enne allikaotsingut, mitte alles vastuse salvestamisel. Katse nummerdus, küsimuse/vastuse seosed ja lease säilivad eraldi tabelis. Kvoodikeeld jätab katsekirje, kuid ei kirjuta USER-sõnumit.
- Omandifence rakendub enne sõnumit, kokkuvõtet ja kasutusarvestust. Retry ei või töötada sama vestluse uuema pöörde kõrval. Katse/ChatTurn terminalseis ja kasutuse settlement on üks tehing; ainult RESERVED kasutust vabastatakse, juba tasutud otsingut ei pöörata tagasi. Nähtava osalise voo senine commit-poliitika säilib ka markeri salvestustõrke korral.
- Request'i lõpetamine peatab südamelöögi; aegunud katseid koristab olemasolev research-worker. Reaper kontrollib expiry luku all uuesti ega lõpeta uut katset või vabasta tema reservatsiooni.
- Koond loeb ka vastuseta ja varasemaid katseid. Põhjused on ET/EN/RU-s seletatud. Algpõhjus jääb `UNKNOWN`, kuni on päris tõend; semantiline õigsus `NOT_PROVEN` ja inimhinnang `NOT_REVIEWED`.
- Tegeliku mudelisisendi/sätete räsid, kutse kaupa mudelinimed ja kompileeritud build-ID aitavad eristada sama konteksti erinevaid kutseid. Toor-prompt'i, mustandit ega uut allikateksti ei salvestata sellesse katseprojektsiooni. Indeksi/registri versiooni tootja ning täpne replay pole veel valmis.
- Algse küsimuse nõuete eraldi shadow näitab piiratud reeglitega tuntud protsendi tähenduse, aja ja järjekorra erinevust ning päris algtekstivahemikke. See ei muuda otsingut, prompt'i ega validaatorit ja ei ole täielik kanooniline nõuete mudel. F05/F08 tootmisparanduseks seda ei loeta.

Kontroll: 194 RAG-sihttesti läbisid ühes UTC jooksus; seejärel lisati kaks katseprojektsiooni regressiooni ja korrati muutunud pinna 49 testi, kõik PASS (196 eri testi). Scoped ESLint, i18n ja `git diff --check` PASS; `prisma validate` ning kliendi genereerimine PASS; tootmisbuild PASS, kompileerimine 33,8 s. Build hoiatab kohaliku e-posti transpordi puudumisest; RAG-i ega e-posti runtime'i see build ei tõenda. Next.js-i juhise järgi jäid omandi/replay kontrollid kuluka töö ette ja katse olek päringupõhiseks, mitte jagatud moodulimuutujaks.

**PARTIAL, mitte kogu RAG DONE.** F04 on lokaalselt üldreeglina parandatud ja sihttestitud, serveris `NOT_PROVEN`. F05 protsendi/populatsiooni/vanuse/sageduse ja viidatud uuringuperioodi sidumine, F06 jaotuse päris sisu, F07 autori+teema valik ning F08 kahe lähenemise suunatud järjekord on lahtised. Nende üldlävendeid pole jälje parandamiseks lõdvendatud. Kogu75/Golden37 ei ole siin uuesti käivitatud.

Enne uut serverikoodi tuleb rakendada lisav migratsioon `20260831203000_rag_attempt_lifecycle`. Runtime'i käsitsivärav: (1) edukas küsimus ja ID-ga MD-rida; (2) sama võtme replay ja katkestatud kordus; (3) nähtava osalise versus puhverdatud katkestuse kasutus; (4) otsingutõrge enne vastust; (5) worker/reaper aegumine ja vana kirjutaja keeld; (6) admin+owner/arhiveeritud piir; (7) F04 kaks sõnastust eraldi ja samas vestluses koos allikapaneeliga. Päris DB rollback, paralleelsus, protsessi katkemine ja nimetatud UI-rajad on hetkel `runtime: not_run`. Migratsioon ei kustuta vana andmestikku; tagasipöördumisel saab taastada vana rakenduskoodi ning jätta uue tabeli tõendite säilitamiseks alles.

### F05 jätkuparandus — teadaolev protsent ja seotud uuringuperiood, kohalik

31.08.2026 jätkukorralduse alguses mõõdeti kohalik HEAD, `origin/main` ja serveri `/home/ubuntu/apps/sotsiaalai` HEAD: kõik `5074b5e03f9fa7708b6ad3db9f8bb9ca243c8d08`. Kohalikus main-puus säilitati varasemad commit'imata parandused ja omaniku analüüsifailid. See jätk ei andnud uut deploy/migratsiooni luba; serverit ei muudetud.

Algne F05 tõrge korrati puhta tegeliku planneriga: esimene nõue oli `proportion`, teine `text_relation`, mõlemale kandus `36%` ja sisutermidesse jäid `ele/laksi`. Aktiivse allika GET-lugemine kinnitas chunk'i `:1:b7abbfc4:version:43de31c44f854388bec58459b199e226` SHA-256 `d042283c6e6f337b35b9deab7329ad9cc5f0d87c0d0cf3adbe97aa3a8f149171`. UTF-16 vahemik `[585,895)` sisaldab WHO 2021/2022 uuringu 16% maailmanoorte väidet ning eraldi Eesti küsitletud 15-aastaste tüdrukute igapäevase või enamiku ajast tuntud üksilduse 36% väidet. Mõlema viide on Cosma jt 2023; viiteaasta ei ole uuringuaeg. Katkendi SHA-256 `a5c795d3e2bc48bf8cabc2f650db4f033c2d42b1bcfb6db77d312ef5e3fab046` on sihttestis lukustatud.

Teostus ja kontrollitav ulatus:

- Tootmise kanoonilises nõueteskeemis on etteantud protsendi tähendus ja viidatud uuringuperiood eraldi tüübitud nõuded; ei kasutata shadow't ega testi vastusevõtit. Autor jääb dokumendiidentiteeti, mitte sisutõendi terminiks. Klauslid ei päri üksteise protsente.
- Üks ühine piiratud parser kinnitab allikast populatsiooni/vanuse ühiku, küsitletute tingimuse, nähtuse ja sageduse ning kontrollib sama payload'i vastuses. Ebamäärast või toetamata sõnastust ei kinnitata üldise märksõnakatte abil. Konstruktsioonitugi on piiratud eestikeelsete selgete nimetaja- ja rühmalausetega, mitte kõigi parafraaside garantii.
- Uuringuaeg sõltub kinnitatud tähenduspropositsioonist. Sama protsendiga muu uuring, teine viide, bibliograafiaaasta ja mitmetähenduslik periood ei täida seda nõuet. Nõuete vastupidine järjekord säilib; ühe lause kaks selget faktiväidet saavad eraldi aatomiteks.
- Kontrolliti väärat sugu, vanust, vanuseühikut, protsendi asemel inimeste arvu, nähtust, sagedust/„või” seost, negatsiooni, riiki ja nimetajat; eraldi predikaatidest laenatud sagedust; kahte vastuolulist body't ning vastuolulise body kõrvale lisatud puhast koopiat; õige lause taha lisatud valet väidet. Sama reegel kontrollib ka teist protsenti, vanust, sihtrühma ja nähtust, mitte ainult F05 arve.
- Vastuses eristatakse kontrollimatut payload'i, populatsiooni/vanuse, nähtuse, sageduse ja uuringuperioodi viga ning vastuolulist lisaväidet. Tõendikonflikt säilib põhjuse ja nõuete indeksitena ka kanoonilises projektsioonis. Toor-payload'i, nimetajat ja allikateksti püsijälge ei lisatud.

Kontroll: **160/160 seotud UTC-sihttesti PASS**, neist uues `known-value-contracts.test.mjs` 17 testi; scoped ESLint, i18n ja `git diff --check` PASS. Lõpliku tootmiskoodi build PASS, kompileerimine 34,1 s, build-ID `bdf431eb-7541-4bad-96a8-6a284e437e26`. Pärast build'i täpsustati ainult dokumentatsiooni ja viitekonflikti sihttesti sisendit, et test jõuaks päris viiteväravani; 17 F05 testi läbisid uuesti. Tootmiskoodi ei muudetud. Kohaliku e-posti transpordi puudumise senine hoiatus säilis; see ei ole RAG-runtime'i tõend. Prisma skeemi ega migratsiooni selles jätkus ei muudetud. Lõpus uuesti loetud kohalik/origin/server HEAD püsis `5074b5e03f9fa7708b6ad3db9f8bb9ca243c8d08`.

**PARTIAL kogu RAG-i suhtes; F05 kohalik producer–consumer leping on sihttestitud, serverivastus `NOT_PROVEN`.** Uusi chat/search/model-päringuid tehti **0**; serveri allikate GET-lugemised ei ole testküsimused. Varasemad F04–F08 kümme vastust jäävad 1 PASS / 9 FAIL; neid pole kohalike testidega ümber hinnatud. F06 vajab rolli-arvu-jaotuse ja täieliku liikmeloetelu ühist lepingut; F07 sõltumatut autor+sisuteema kinnitust enne trusted-ID tugevdamist ning loenduste sidumist; F08 võrdluslausete õiget subjekti ja suunatud/samaaegse järjekorra lepingut. Nende parandamiseks ei eemaldatud praegust dokumendilukku ega nõrgendatud üldisi kontrollilävendeid. Katsete migratsioon ning autenditud küsimus/vastus/allikapaneel/aruande kontroll jäävad väljalaske käsitsiväravaks.

### F06 jaotuse/loetelu paranduse kohalik tõend — 31.08.2026

**PARTIAL: teostatud ja sihttestitud parandustööpuus, mitte integreeritud ega avaldatud.** Omaniku „ok” kinnitas repair-a fast-forward-sünkroniseerimise; see ei olnud main-integratsiooni, push'i, deploy ega migratsiooni luba. Mõõdetud main'i ja repair-a HEAD on mõlemal `5074b5e03f9fa7708b6ad3db9f8bb9ca243c8d08`. Main'i varasema P0/F04/F05 33 nimelist koodifaili kopeeriti sõltuvusbaasina parandustööpuusse; lõpu SHA-256 võrdlus kinnitas main'is 33/33 muutmata faili. Käesoleva ploki rakenduskood on ainult `C:/Users/rauds/Desktop/SotsiaalAI-repair-a`; ametlikke dokumente uuendati nende senises main-asukohas.

Esimene kõrvalekalle korrati kahe tegeliku plannerisisendiga: „kuidas jaotati” oli `text_relation`, „kuidas jagunesid” `distribution`; nimeloetelu nõudis ainult kahte elementi. Avaliku kohaliku Toobali allika `2016_1_artikkel_24_alkoholipoliitika_kohalikul_tasandil_pilootprojekti.txt` SHA-256 on `597185822e45b24f68aa1b9acf25a717b38d95e971cd772ab3e1f7361ae269ed`. Algteksti UTF-16 [970,1196) seob 6 omavalitsust, 3 sekkumisomavalitsust ja 3 kontrollomavalitsust ning Kuressaare/Põltsamaa linna ja Põlva valla. Kontrollrühma nimesid ei avalikustata. Kohalikke offset'e ei omistatud serveri chunk'ile; serveriallikat selles jätkus uuesti ei loetud.

Paranduse kontrollitud ulatus:

- Planneri kaks sõnastust ja küsimuse vastupidine klauslijärjekord loovad õiged eraldi nõuded. Kinnitatud arvud, rollid, tegevuse polaarsus, täielik liikmehulk ja linna/valla tüüp pärinevad allikast, mitte allikaspetsiifilisest runtime-vastusevõtmest.
- Tõendi tootja, täpse fragmendi/versiooni/UTF-16 locator'i kontroll, deterministlik vastus ja tavapärane faktivalidaator kasutavad sama tüübitud payload'i. Algne täistekst säilib parseri kontrollis ka siis, kui kuvamiseks kärbitud lõik kaotaks tingimusliku raami.
- Loetelu puudumine või näiteloetelu annab ainult iseseisvalt toetatud jaotuse koos piiranguga. `passed=false` ei kirjutata ümber tõeks: `response_decision` lubab üksnes kontrollitud täpse teksti, katmata nõuded jäävad nähtavaks. Recovery ei kustuta toetatud osa ja nii allikapaneeli kui koondjälje toe ID-d säilivad.
- Vastunäited kontrollivad valet summat, rühma/polaarsuse vahetust, eitavat küsimust, tingimuslikku või tagasilükatud allikaväidet ka üle reavahetuse, teise projekti populatsiooni, duplikaati, valet kohatüüpi, liigset/välist vastuseväidet, puuduvat või erinevat versiooni/staatust ning võltsitud vahemikku või fragmendiräsi. Ühine 120 märgi algus ei tohi enam peita hilisemat vastuolu.
- Kõrge kindlusega dokumendilukk, uurimis-/ajakirjaallika liik ja valdkonna/ajakohasuse piir jäävad jõusse. Diagnoosi püsiprojektsioon ei lisa nimeloetelusid ega toorallikateksti; automaatne sisuline õigsus ja algpõhjus jäävad `NOT_PROVEN`.

Kontroll: **76/76 sihttesti PASS UTC-s** — 21 F06 `group-fact-contracts.test.mjs`, 17 F05, 8 F04, 27 diagnostika testi ning eraldi nimefiltriga 3 olemasolevat konteksti/kaaneteksti regressiooni. Tegeliku handleri kitsas test kontrollis täieliku ja osalise vastuse JSON-i/SSE-d ning sama teksti/allikate jõudmist süstitud salvestajale; providerikutseid 0. See on sõltuvustega sihttest, mitte autenditud vestluse ega päris DB tõend. Scoped ESLint, i18n ja `git diff --check` PASS. Tootmisbuild PASS, kompileerimine 46 s, build-ID `a034e3d5-a9fb-48e3-ae23-9dec195128b9`. Säilis kohaliku e-posti transpordi puudumise hoiatus. F06 ei muutnud Prisma skeemi ega migratsioone; tööpuus nähtav katsete migratsioon kuulub varasemasse muutmata baasi.

F06 nimeline koodipiir: `groupFactSemantics.js`, `groupFactContract.js`, `responsePolicy.js`; olemasolevad `questionPlanner.js`, `ragContext.js`, `retrievalContextAssembler.js`, `factContract.js`, `mainResponseHandler.js`, `conversationalRecovery.js`, `sourceAttribution.js`, `ragDiagnostics.js`; ET/EN/RU `stage_status.PARTIAL` tõlge ning üks uus sihttestifail. Baasi ülejäänud katse-, kasutus-, migratsiooni- ega P0/F04/F05 faile ei tohi F06 muudatusena ümber nimetada.

**Lahtine:** piiratud grammatika ei taga kõigi sõnastuste/loendite/seoste mõistmist ega terve dokumendi konfliktide avastamist. Tagastatud versiooni locator ei tõenda registri aktiivversiooni sõltumatut uuesti kontrolli avaldamisel. Main-integratsioon, katsete migratsioon, päris DB konkurents/rollback, F06 kaks sõnastust eraldi ja samas vestluses, avatud allikapaneel ning värske diagnostika/Markdown on `NOT_PROVEN` / `runtime: not_run`. Selles jätkus uusi serveri chat/search/model-päringuid **0**; varasem manifest jääb **1 PASS / 9 FAIL**, mitte kohalike testidega parandatud tulemuseks. Pärast omaniku lubatud integratsiooni ja väljalaske väravat jätkub F07 autorivalik/loendused, seejärel F08 suunatud järjekord.

### Kohalik main-integratsioon ja järelkontroll

Omaniku „vii maini ja testi” järel on baas P0/F04/F05 commit'is `d4b31e9a1` ja F06 delta commit'is `32e25ad2b`. Integratsioon toimus fast-forward'iga; enne rebase'i kontrolliti kahe 33-faililise baaspuu võrdsust ning pärast rebase'i kogu valideeritud Git-puu samasust. Integreeriti 40 unikaalset koodifaili, mitte kõrvalisi analüüse või ajaloolist tõendikausta. Paketti ei push'itud ega deploy'tud.

Main'is läbivad **98/98 sihttesti UTC-s**: F04/F05/F06/diagnostika 73, nõuete shadow 4, katsete elutsükkel 18 ning eraldi nimefiltriga 3 olemasolevat konteksti/kaaneteksti kaitset. Elutsüklitesti esimene import katkestati `server-only` kaitse tõttu; korrektne käsk `node --conditions=react-server --import ./scripts/register-node-source-loader.mjs --test tests/rag/attempt-lifecycle.test.mjs` läbis 18/18, kaitset ega rakenduskoodi ei lõdvendatud. Prisma validate, i18n ja diff-check PASS. Varasem scoped ESLint ja F06 build `a034e3d5-a9fb-48e3-ae23-9dec195128b9` käivad sama muutumatu koodipuu kohta; uut build'i pelga integratsioonimehaanika pärast ei tehtud. Main-kausta vana .next build ei ole selle F06 käitustõend.

Kohaliku DB host oli `localhost`; read-only süsteemikataloog näitas `ChatTurn` tabelit, kuid mitte `RagAttempt` tabelit. Autenditud uue katseraja test eeldab seega varasemat migratsiooni ja värske Prisma kliendiga protsessi. Neid muudatusi ei tehtud; pärisvestluse ning serveri kontroll on `runtime: not_run`. Uusi serveri küsimusi **0**. Omanik andis lisaks korralduse jätkata arendusega: järgmine sidus teema on F07 autor+body-teema kinnitus ja teosevalik.
