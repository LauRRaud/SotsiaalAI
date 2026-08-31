# Uue allikapõhise küsimustiku kontroll — 31.08.2026

Testitõendid, mitte konkureeriv projektiseisu fail. Aktiivne tööseis on `docs/platvormi arendus/SotsiaalAI.md` S1.0-s.

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
