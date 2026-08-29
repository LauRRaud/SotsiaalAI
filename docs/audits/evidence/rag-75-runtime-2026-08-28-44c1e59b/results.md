# Runtime-auditi tulemused

## J01

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 1`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:33:38.828Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd1y1e1005d0hkmm0v6dp4j`
- User message ID: `cmtd1y1e0005c0hkmejrutfio`
- Assistant message ID: `cmtd1y1ee005g0hkm0fc39cn9`
- Exact question:

> Kui tihti toimusid MAPPA kohtumised ning mitu kohtumist toimus Rakveres, Jõhvis ja Narvas?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Kohtumised toimusid vähemalt kord nelja kuu jooksul; Rakvere 5, Jõhvi 7 ja Narva 5.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kogu MAPPA faktivastus jäi andmata; vastus oli deterministlik domeenipiir.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `7275 ms`
- Case verdict: `FAIL`
- Verdict reason: Piisavalt selge sotsiaalvaldkonna faktiküsimus suunati `route`-kihis valele domeenipiirile; nähtav vastus ei käsitlenud küsimust ning allikapaneeli ei olnud.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J21

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 21`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:17:22.340Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd3ih1i00kj0hkm028hqx1c`
- User message ID: `cmtd3ih1h00ki0hkme2hg2g01`
- Assistant message ID: `cmtd3ijfs00kl0hkm5xpx1gjz`
- Exact question:

> Millised olid eakate vägivalla uuringu 10%, 6% ja 2% näidud?

- Exact visible answer:

> Eakate vägivalla käsitluses olid näidud järgmised:
>
> - 10% registreeritud kuriteoohvritest olid 2023. aastal üle 60-aastased – 640 inimest.
> - 6% ohvriabisse pöördunutest olid 2023. aastal üle 60-aastased – 227 inimest.
> - 2% üle 75-aastastest inimestest oli viimase aasta jooksul puutunud kokku kuritegevusega – 100 inimest.
>
> Esimesed kaks näitu pärinevad 2023. aasta registreeritud kuritegude ja ohvriabisse pöördumiste andmetest; 2% näit pärineb 2024. aasta ohvriuuringu käsitlusest.

- Expected claims: 10% = 640 üle 60-aastast kuriteoohvrit; 6% = 227 üle 60-aastast ohvriabisse pöördunut; 2% = 100 üle 75-aastast, kes puutusid viimase aasta jooksul kuritegevusega kokku.
- Observed correct claims: Kõik kolm protsendi–rühma–arvu seost olid olemas; 2023/2024 allikakontekst oli lisaks selgelt eristatud.
- Missing or wrong claims: Puuduvad olulised kõrvalekalded.
- Source button present: `yes`
- Source panel opened: `yes`
- Source panel title: `Vastuste allikad`
- Source cards: `1 — Anu Leps, 2025. Vägivald vanemaealiste vastu vajab tähelepanu. Sotsiaaltöö 1/2025 · lk 1–10 · Vägivalla ennetus`
- Source URLs: `none visible`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; vastus ja nupp ilmusid pärast esmase ootamise aegumist`
- Case verdict: `PASS`
- Verdict reason: Faktivalideerimine läbis kõik kolm protsendi–rühma–arvu seost ühes renderdatud allikas, dokumendiidentiteet oli kõrge usaldusastmega ja allikapaneel avati käsitsi.
- First divergent layer: `none`
- Diagnostic retry: `not_run; canonical sent once`

## J20

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 20`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:15:57.276Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd3gemi00jf0hkmnwazbq17`
- User message ID: `cmtd3gemh00je0hkmo8ss7hov`
- Assistant message ID: `cmtd3gems00ji0hkmccl4o30t`
- Exact question:

> Milliseid seadusemuudatusi käsitleti 2023. aasta kevadel ja suvel ning 2025. aasta jaanuaris?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Erista 2023. aasta kevade ja suve seadusemuudatused 2025. aasta jaanuari muudatustest.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Mõlema aasta muudatused jäid kirjeldamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: Kahe aasta võrdlus jäi `default`-plaani, aastad märgiti ebamääraseks, risk oli `high`, valitud kontekst ei moodustanud nõutud mitme dokumendi võrdlust ja vastus läks domeenipiirile.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J19

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 19`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:14:39.456Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd3epf700j10hkm8sj2eu29`
- User message ID: `cmtd3epf700j00hkm2q7jbvm7`
- Assistant message ID: `cmtd3epfc00j40hkm8lap1h8e`
- Exact question:

> Kui pikk oli inimarengu aruanne, kui palju teadlasi selles osales ja mitu stsenaariumi esitati?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Aruanne oli 380 lehekülge pikk, selles osales 71 teadlast ja esitati 4 stsenaariumi.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kõik kolm inimarengu aruande mõõdikut jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: `specific_research_fact` aktiveerus, kuid eelmise J18 allika täpne vestlusefilter jäi kasutusse; valituks sai „Psüühilise erivajadusega inimese osalus oma eestkostes“, mitte inimarengu aruanne, ja vastus läks domeenipiirile.
- First divergent layer: `retrieval`
- Diagnostic retry: `not_run; canonical sent once`

## J18

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 18`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:12:20.300Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd3bq5800i40hkmr22hkx0r`
- User message ID: `cmtd3bq5800i30hkmblpzwz3d`
- Assistant message ID: `cmtd3brfq00i60hkmg5nktknv`
- Exact question:

> Kui suur oli eestkostetavate osalus igas rühmas ja kokku?

- Exact visible answer:

> Uuringus osales igas rühmas 5 inimest:
>
> - maakohtu kohtunikud – 5
> - erihoolekandeasutuse töötajad – 5
> - kohaliku omavalitsuse sotsiaaltöötajad – 5
>
> Kokku osales 15 inimest.

- Expected claims: Igast rühmast osales 5 eestkostetavat ning kokku 15.
- Observed correct claims: Kõik kolm rühma, iga rühma arv 5 ja kogusumma 15 olid vastuses olemas.
- Missing or wrong claims: Puuduvad olulised kõrvalekalded.
- Source button present: `yes`
- Source panel opened: `yes`
- Source panel title: `Vastuste allikad`
- Source cards: `1 — Erle Eenmaa, 2022. Psüühilise erivajadusega inimese osalus oma eestkostes. Sotsiaaltöö 1/2022 · lk 1–2, 4, 6 · Õigus`; `2 — Kristi Rekand, 2026. Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte · lk 1–2, 7, 37, 41, 44`; `3 — Kristi Rekand, 2026. Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu lühikokkuvõte · lk 2–3`; `4 — Helika Saar, 2016. Kokkuvõte kordusuuringust „Lapse osalemine pereelus”. Sotsiaaltöö 4/2016 · lk 44–49 · Uurimus`
- Source URLs: `none visible`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; vastus ja nupp ilmusid pärast esmase ootamise aegumist`
- Case verdict: `PASS`
- Verdict reason: Vastus sisaldas kõik rühmade arvud ja kogusumma, validator läbis põhjusega `all_claims_in_one_rendered_source` ning allikapaneel näitas vastuseallikatega kooskõlalist tõendit.
- First divergent layer: `none`
- Diagnostic retry: `not_run; canonical sent once`

## J17

- Prompt origin: `AUDIT_EXACT`
- Batch / turn: `B01 / 17`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:10:56.086Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd39zb400hq0hkmzvdn1cl4`
- User message ID: `cmtd39zb300hp0hkm25seetq8`
- Assistant message ID: `cmtd39zba00ht0hkmszsdf27x`
- Exact question:

> Kui palju lapse perekonnast eraldamise kohtulahendeid analüüsiti ja mis aastal need lahendid tehti?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Analüüsiti 169 kohtulahendit; lahendid tehti 2018. aastal.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kohtulahendite arv ja aasta jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: Küsimus jäi `default`-plaani, kuigi lapse perekonnast eraldamise artikkel oli esimene valitud tulemus; faktivalideerimine puudus ja vastus läks domeenipiirile.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J16

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 16`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:07:43.561Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd35tkp00g20hkm5cl7fg9q`
- User message ID: `cmtd35tko00g10hkmoviugto3`
- Assistant message ID: `cmtd35zid00g90hkmvlg2bi2g`
- Exact question:

> Mida kirjeldati Saaremaa esimese ja teise COVID-laine ning tervishoiu ja sotsiaalhoolekande lõimimise kohta?

- Exact visible answer:

> Saaremaa kogemust käsitlenud 2021. aasta uurimuses vaadeldi sotsiaaltöö ja hoolekande korraldust COVID-19 esimese ja teise laine ajal. Kõige üksikasjalikumalt kirjeldati 2020. aasta esimest lainet, mil viirus levis Saaremaal kiiresti ja ulatuslikult ning tekitas elanikes hirmu ja stressi.
>
> Esimese laine peamised mõjud olid:
>
> - sotsiaalabi osutamine muutus nakkusohu tõttu keeruliseks;
> - koduhooldustöötajate töökoormus suurenes, osa töötajaid haigestus või loobus nakatumishirmu tõttu teenuse osutamisest;
> - koduhooldus piirdus sageli toidu ja ravimite viimisega ukse või väravani;
> - tavapäraselt ei olnud võimalik pakkuda tugiisikuteenust, isikuhooldust ja isikliku abistaja teenust;
> - tervishoiuteenuste kättesaadavus halvenes, sest arstivisiidid ja muud teenused olid viiruse leviku tõttu piiratud;
> - osa peresid sattus toimetulekuraskustesse ning hajaasustuses tekkis probleeme transpordiga.
>
> Olulise lahendusena kirjeldati Saaremaa Kriisikodu loomist 2020. aasta kevadel. Saaremaa Südamekodu ja vallavalitsuse kriisikomisjon korraldasid seal haiglaravi mittevajavate, kuid COVID-positiivsete hooldekoduelanike majutamise. See aitas kaitsta teisi hooldekodusid ja tagada hooldusteenuse jätkumise. Samuti kaasati vabatahtlikke, Kaitseliitu, meditsiinitöötajaid ja Kuressaare Ametikooli.
>
> Tervishoiu ja sotsiaalhoolekande lõimimist käsitleti COVID-19 puhul vajalikuna, sest tegemist ei olnud ainult tervishoiukriisiga, vaid komplekskriisiga, mis mõjutas korraga tervishoidu, sotsiaaltööd, hoolekannet ja majandust. Rõhutati vajadust:
>
> - ajakohastada ja paremini siduda tervishoiu- ning sotsiaalhoolekande korraldus;
> - luua tõhusam koostöövõrgustik, et hoolekandeasutused saaksid kvaliteetset meditsiiniabi;
> - tagada tervishoiuteenuste kättesaadavus ka kriisi ajal;
> - kujundada hoolekandeasutuste ruume ja töökorraldust nii, et seal oleks võimalik osutada esmatasandi tervishoiuteenuseid;
> - koostada selged kriisiplaanid, riskianalüüsid ja teenuste toimepidevuse kavad;
> - parandada kriisikommunikatsiooni ning tugevdada koostööd kohaliku omavalitsuse, kogukonna ja teenuseosutajate vahel.
>
> Saaremaa kogemus näitas, et kriisis muutusid eriti tähtsaks kiire otsustamine, meeskonnatöö, kogukonna kaasamine, vabatahtlike kasutamine ning sotsiaal- ja tervisevaldkonna tihe koostöö. Katkendites ei ole teise COVID-laine eraldi sündmusi ja tulemusi sama üksikasjalikult kirjeldatud kui esimese laine puhul.

- Expected claims: Erista esimese ja teise COVID-laine kirjeldus ning too välja tervishoiu ja sotsiaalhoolekande lõimimise korralduslik soovitus.
- Observed correct claims: Vastus käsitles mõlemat lainet, tõi esile esimese laine mõjud ja Saaremaa Kriisikodu ning andis lõimimise soovitused.
- Missing or wrong claims: Teise laine üksikasjad olid allika enda järgi vähem kirjeldatud; seda piiri vastus nimetas.
- Source button present: `yes`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none visible`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; vastus ja nupp ilmusid pärast esmase ootamise aegumist`
- Case verdict: `PARTIAL`
- Verdict reason: Vastus ja DB-trace olid kooskõlas ning kaks Saaremaa allikat olid vastuseallikateks märgitud, kuid kohustuslikku käsitsi avatud allikapaneeli tõendit ei saanud taastada.
- First divergent layer: `UI`
- Diagnostic retry: `not_run; canonical sent once`

## J15

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 15`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:06:04.226Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd33sw300fl0hkmgs6f4567`
- User message ID: `cmtd33sw200fk0hkm76g2n4e0`
- Assistant message ID: `cmtd33uyr00fn0hkm28yy1l1b`
- Exact question:

> Kui palju töötajaid oli Rakvere käsitluses, kui paljud töötasid lastekaitses ja kui paljud menetlesid toetusi?

- Exact visible answer:

> Rakvere Linnavalitsuse sotsiaalosakonnas töötas 2020. aasta käsitluse järgi kokku 7 inimest:
>
> - lastekaitsespetsialiste: 3;
> - toetuste taotlusi menetlevaid ja inimesi nõustavaid töötajaid: 2.
>
> Ülejäänud olid osakonna juhataja ja sotsiaaltöö peaspetsialist ehk täiskasvanute juhtumikorraldaja.

- Expected claims: Kokku 7 töötajat; 3 lastekaitses ja 2 toetuste menetlemises.
- Observed correct claims: Kõik nõutud arvud ja rollijaotus olid nähtavas vastuses olemas.
- Missing or wrong claims: Puuduvad olulised kõrvalekalded.
- Source button present: `yes`
- Source panel opened: `yes`
- Source panel title: `Vastuste allikad`
- Source cards: `1 — Kersti Suun-Deket, 2020. Sotsiaaltöö Rakvere linnas. Sotsiaaltöö 2/2020 · lk 1–3 · Kohalik omavalitsus`
- Source URLs: `none visible`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; vastus ja nupp ilmusid pärast esmase ootamise aegumist`
- Case verdict: `PASS`
- Verdict reason: Faktivalideerimine läbis põhjusega `all_claims_in_one_rendered_source`, vastuse allikas oli Rakvere 2020 käsitlus ja sama allikakaart avati samast assistendi mullist.
- First divergent layer: `none`
- Diagnostic retry: `not_run; canonical sent once`

## J14

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 14`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:04:02.116Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd314sm00ep0hkm19x3ogwb`
- User message ID: `cmtd314sl00eo0hkmq4t194kj`
- Assistant message ID: `cmtd317h500er0hkmv7kwr7g2`
- Exact question:

> Mida öeldi Saue elanike arvu ja eestkostejuhtumite kohtusse jõudmise kohta?

- Exact visible answer:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

- Expected claims: Saue rahvaarv oli üle 5800 ning 90% eestkostejuhtumitest jõudis kohtusse.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Elanike arv ja 90% osakaal jäid kinnitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: Saue asukoht tuvastati, kuid küsimus jäi `default`-plaani; kaheksast valitud allikast ei moodustunud nõutud ühe dokumendi fakti ja valideerimine lõppes `whole_scope_mismatch`-iga.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J13

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 13`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:02:47.873Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2zilk00dx0hkmjvpy1x0c`
- User message ID: `cmtd2zilj00dw0hkm2dicb08s`
- Assistant message ID: `cmtd2zilq00e00hkmz97os57k`
- Exact question:

> Millist vanuserühma noored olid käsitluses 13–18 ning kui palju probleeme neil tavaliselt oli?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Vanuserühm oli 13–18 aastat; tavaliselt 3–5 probleemi.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Vanuserühm ja probleemide arv jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: Küsimus jäi `default`-plaani, sotsiaalne ulatus oli `unknown`, asjakohast noorteartiklit ei valitud ja lõppvastus oli domeenipiir.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J12

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 12`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:01:19.013Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2xlji00d50hkm2hm8n3hu`
- User message ID: `cmtd2xljh00d40hkmdih31orr`
- Assistant message ID: `cmtd2xljr00d80hkm448g1ygg`
- Exact question:

> Mitu rühmasupervisiooni kohtumist kavandati 2017. aastal igas maakonnas?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Igas maakonnas kavandati 5 rühmasupervisiooni kohtumist.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Nõutud arv jäi esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: 2017. aasta küsimus jäi `default`-plaani, aasta tõlgendati ebamäärasena, valitud supervisiooniallikaid oli mitu ja faktivalideerimine/allikate kuvamine puudusid.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J11

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 11`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:59:58.669Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2vxr800cb0hkm19xkecf5`
- User message ID: `cmtd2vxr700ca0hkmzwvsg002`
- Assistant message ID: `cmtd2vxre00ce0hkmw5gu8gc7`
- Exact question:

> Mitu intervjuud tehti töötamise toetamise uuringus ning kuidas need intervjuud jagunesid?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Kokku 7 intervjuud: 6 individuaalset ja 1 kolme osalejaga grupiintervjuu; meetod oli kolmeetapiline temaatiline analüüs.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Intervjuude arv, jaotus ja analüüsimeetod jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: `specific_research_fact` leidis õige töötamise toetamise artikli, kuid sotsiaalse ulatuse tuvastus jäi `unknown`, faktivalideerimine puudus ja lõppvastus oli domeenipiir.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J10

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 10`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:58:48.821Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2ub1g00bv0hkmsxpqe3ku`
- User message ID: `cmtd2ub1f00bu0hkmjg2smtzp`
- Assistant message ID: `cmtd2ub1m00by0hkmk8c3rjb9`
- Exact question:

> Mida näitas artikkel dementsuse kohta une kestuse, päevase uneaja ja kuulmislanguse riski kohta?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 150/75 minuti suhe, tavapärane 7–8 tunni uni ning kuulmislangusega seotud 2–5-kordne risk.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kõik kolm nõutud väiteosa jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus kiiresti, kuid täpset UI mõõtmist ei säilitatud`
- Case verdict: `FAIL`
- Verdict reason: Küsimus läks `default`-plaani, sotsiaalne ulatus jäi `unknown`, valitud dementsuse allikas ei läinud vastuseallikaks ning lõppvastus oli domeenipiir.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J09

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 9`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:57:29.649Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2sr4k00bh0hkm2g3nqifx`
- User message ID: `cmtd2sr4j00bg0hkmmak0r1v2`
- Assistant message ID: `cmtd2sr4p00bk0hkmf7d4j7q3`
- Exact question:

> Millised olid kiusamise uuringus nimetatud neli protsenti?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 33%, 13%, 19% ja 7% koos õige rühma või väitega.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Neli nõutud protsenti jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: Küsimus jõudis küll `specific_research_fact`-plaani ja üks kiusamise artikkel valiti, kuid sotsiaalse ulatuse tuvastus jäi `unknown`, faktivalideerimine ebaõnnestus ning lõppvastus läks `outside_social_scope`-i.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J08

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 8`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:55:51.590Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2qooo00b10hkmggc84vrt`
- User message ID: `cmtd2qoon00b00hkmh1phoqxu`
- Assistant message ID: `cmtd2qozv00b40hkmm7r3i9ja`
- Exact question:

> Millised olid hoolduskoormuse uuringus nimetatud neli osakaalu?

- Exact visible answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Expected claims: 61%, 26%, 11% ja 18% koos õige rühma või tunnusega.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Neli nõutud osakaalu jäid esitamata.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; nähtav vastus ilmus pärast esmase ootamise aegumist`
- Case verdict: `FAIL`
- Verdict reason: Marsruut oli `specific_research_fact`, kuid dokumendiidentiteet ei kinnitunud, valitud konteksti oli 0 ja süsteem andis ebapiisava tõenduse varuvastuse; nõutud osakaalud ning allikapaneel puudusid.
- First divergent layer: `selection`
- Diagnostic retry: `not_run; canonical sent once`

## J07

- Prompt origin: `AUDIT_EXACT`
- Batch / turn: `B01 / 7`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:47:08.741Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2flm500990hkmkdyd1qmo`
- User message ID: `cmtd2flm400980hkm58rf1e4j`
- Assistant message ID: `cmtd2foqf009b0hkm4u9phk7u`
- Exact question:

> Kui palju inimesi ja vabatahtlikke osales ning kui suur oli töötundide, maakondade ja omavalitsuste arv 2018–2020 katseetapis 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust“ järgi?

- Exact visible answer:

> 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust“ järgi toetati novembrist 2018 kuni aprillini 2020 kokku 678 inimest ning tegevusse panustas 273 vabatahtlikku.
>
> Vabatahtlikud panustasid 21 600 tundi ning abi jõudis 12 maakonda ja 43 omavalitsusse.

- Expected claims: 678 inimest, 273 vabatahtlikku, 21 600 töötundi, 12 maakonda ja 43 omavalitsust 2018–2020 katseetapis.
- Observed correct claims: Kõik viis nõutud mõõdikut olid vastuses olemas ja seotud küsitud 2022. aasta artikliga.
- Missing or wrong claims: Puuduvad olulised kõrvalekalded.
- Source button present: `yes`
- Source panel opened: `yes`
- Source panel title: `Vastuste allikad`
- Source cards: `1 — Krista Pegolainen-Saar, 2022. Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust. Sotsiaaltöö 2/2022 · lk 1–5 · Korraldus`
- Source URLs: `none visible`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN; esmane 150 s ootamine aegus, kuid sama vastus ilmus hiljem samasse UI-vestlusse`
- Case verdict: `PASS`
- Verdict reason: Andmebaasi jälg näitas `specific_research_fact` plaani, kõrge usaldusastmega dokumendiidentiteedi vastet, läbivat faktivalideerimist ja sama allika kuvamist; brauseris oli vastus hiljem nähtav ning hoveriga avatud allikapaneel näitas toetavat 2022. aasta artiklit.
- First divergent layer: `none`
- Diagnostic retry: `not_run; canonical sent once`

## J06

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 6`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:45:41.426Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2dhje008t0hkmy12thv43`
- User message ID: `cmtd2dhjd008s0hkms5pr4bb1`
- Assistant message ID: `cmtd2dhjk008w0hkmplhwhady`
- Exact question:

> Mida näitas teenusmajade käsitlus 12–30 kohta, 12 arengukava kohta ja osalejate kavatsuste kohta?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Teenusmajade arvuvahemik 12–30, 12 arengukava ja kõigi osalejate kavatsus jätkata.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kogu teenusmajade faktivastus jäi andmata; vastus oli deterministlik domeenipiir.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `7759 ms`
- Case verdict: `FAIL`
- Verdict reason: Piisavalt selge teenusmajade küsimus jäi `default`-plaani ja lõppvastus läks `outside_social_scope` domeenipiirile.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J05

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 5`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:44:07.570Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd2bi7f00810hkmrjwovb95`
- User message ID: `cmtd2bi7d00800hkmieewqb9x`
- Assistant message ID: `cmtd2bi7m00840hkmy9wmcz40`
- Exact question:

> Kui palju spetsialiste 12 riigist ning kui palju inimesi 19 riigist osalesid taastava õiguse käsitluses?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 30 spetsialisti 12 riigist ning 60 inimest 19 riigist.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kogu taastava õiguse osalusfakt jäi andmata; vastus oli deterministlik domeenipiir.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `7455 ms`
- Case verdict: `FAIL`
- Verdict reason: Kahe arvulise osalusväitega küsimus jäi `default`-plaani ning lõppvastus läks `outside_social_scope` domeenipiirile.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J04

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 4`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:42:39.099Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd29j1g007n0hkmamt2b3o4`
- User message ID: `cmtd29j1f007m0hkmicbt6ofn`
- Assistant message ID: `cmtd29j2c007q0hkmtty776p8`
- Exact question:

> Millistes kohtades tegutsesid Perepesad ning milliseid nelja ülesannet nad täitsid?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Põltsamaa, Türi ja Viljandi ning neli Perepesade ülesannet.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kogu Perepesade faktivastus jäi andmata; vastus oli deterministlik domeenipiir.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `8499 ms`
- Case verdict: `FAIL`
- Verdict reason: Piisavalt selge Perepesade faktiküsimus läks `default`-plaani ja lõppvastus `outside_social_scope` domeenipiirile; allikapaneeli ei olnud.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J03

- Prompt origin: `AUDIT_EXACT`
- Batch / turn: `B01 / 3`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:39:55.806Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd262op006p0hkmam5v1iq5`
- User message ID: `cmtd262oo006o0hkm4055ht0e`
- Assistant message ID: `cmtd2674i006r0hkmzuwd3fwg`
- Exact question:

> Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada, 112 või 1220, 2018. aasta artikli järgi?

- Exact visible answer:

> 2018. aasta artikli järgi on vaimse tervise kriisi tunnused järgmised:
>
> - oht, et inimene võib ennast kahjustada või teha enesetapu;
> - äärmuslik stress, näiteks paanikahoog, äge stressireaktsioon pärast traumeerivat sündmust või tõsine psühhootiline seisund;
> - teiste jaoks tugevalt häiriv käitumine, näiteks agressiivsus või kontakti kaotamine reaalsusega.
>
> Abi saamiseks tuleb helistada:
>
> - 112, kui tegemist on kiiret sekkumist vajava kriisiolukorraga;
> - perearsti nõuandeliinile 1220, kui vajatakse meditsiinilist nõu või olukorra hindamist.
>
> Artiklis rõhutatakse, et õigeaegne arstiabi on oluline, sest abita jäämisel võib probleem süveneda või kujuneda kriisiks.

- Expected claims: Artiklis nimetatud kriisitunnused ning telefoninumbrite 112 ja 1220 eri kasutusolukorrad.
- Observed correct claims: Kriisitunnused ja mõlemad telefoninumbrid olid nähtavas vastuses olemas ning vastus jäi küsitud 2018. aasta artikli piiresse.
- Missing or wrong claims: Puuduvad olulised kõrvalekalded.
- Source button present: `yes`
- Source panel opened: `yes`
- Source panel title: `Vastuste allikad`
- Source cards: `1 — Külli Mäe, 2018. Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?. Sotsiaaltöö 1/2018 · lk 1–5 · Tööalane tugi`
- Source URLs: `none visible`
- UI first text: `null / NOT_PROVEN`
- UI complete: `10383 ms`
- Case verdict: `PASS`
- Verdict reason: Vastus kattis küsimuse, fact validator läbis põhjusega `all_claims_in_one_rendered_source`, valitud ja kuvatud allikas olid samad ning hoveriga avatud allikapaneel näitas toetavat Külli Mäe 2018 artiklit.
- First divergent layer: `none`
- Diagnostic retry: `not_run; canonical sent once`

## J02

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 2`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:36:37.505Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd21wwc005t0hkmmyl3qfpg`
- User message ID: `cmtd21wwb005s0hkmzfa6uy05`
- Assistant message ID: `cmtd21wwi005w0hkmn0mml113`
- Exact question:

> Millised olid erihooldekodude kaardistuse kolm protsenti?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 25%, 45% ja 30% koos õige kolme kategooriaga.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Kogu erihooldekodude faktivastus jäi andmata; vastus oli deterministlik domeenipiir.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN`
- UI complete: `8892 ms`
- Case verdict: `FAIL`
- Verdict reason: Küsimus suunati `specific_research_fact` retrieval-plaani, kuid lõppvastus läks `outside_social_scope` domeenipiirile; nõutud protsendid puudusid ja allikapaneeli ei olnud.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## J22

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 22`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:19:10.438Z`
- Conversation ID: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Turn ID: `cmtd3kiu800lv0hkmn9ffbltk`
- User message ID: `cmtd3kiu700lu0hkmyh42mzbm`
- Assistant message ID: `cmtd3kiue00ly0hkm0qclye9k`
- Exact question:

> Mida näitas e-kursuse järelhindamine kuus kuud pärast kursust ning millised olid osaleja ja tööandja vaated?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Järelhindamine toimus 6 kuu pärast ning vastus peab eristama osaleja ja tööandja vaadet.
- Observed correct claims: Puuduvad.
- Missing or wrong claims: Järelhindamise aeg, osaleja hinnang ja tööandja hinnang jäid vastamata; nähtav vastus oli deterministlik domeenipiir.
- Source button present: `no`
- Source panel opened: `no`
- Source cards: `0`
- Source URLs: `none`
- UI first text: `null / NOT_PROVEN; esimene ooteaken aegus`
- UI complete: `null / NOT_PROVEN; sama turni vastus ilmus hiljem nähtavalt`
- Case verdict: `FAIL`
- Verdict reason: Selge e-kursuse järelhindamise küsimus suunati retrieval-plaani `specific_research_fact`, kuid lõppvastus läks `outside_social_scope` domeenipiirile; nõutud ajaline ja rollipõhine võrdlus puudus ning allikapaneeli ei olnud.
- First divergent layer: `route`
- Diagnostic retry: `not_run; canonical sent once`

## B02 A-ploki vahekokkuvõte

Kõik kümme A-juhtumit lõpetasid authenticated UI-s nähtava vastusega `Vastan ainult sotsiaalvaldkonna küsimustele.` ja DB-s staatusega `COMPLETED`. Ühelgi juhul ei olnud allikanuppu ega allikapaneeli. Kõigis kümnes oli DB trace'is `query_plan.mode=default`, `planner_reason=session_role`, `social_scope=unknown`, `model_call_count=0` ning taastena `outside_social_scope`; juhtumid on seetõttu `FAIL`, esimene lahknevus `route`.

| case_id | autor | retrieved | selected | verdict |
|---|---|---:|---:|---|
| A01 | Krister Tüllinen | 36 | 3 | FAIL |
| A02 | Maarja Krais-Leosk | 36 | 5 | FAIL |
| A03 | Kadi Lubi | 36 | 7 | FAIL |
| A04 | Ave Ungro | 36 | 5 | FAIL |
| A05 | Jane Langemets | 36 | 7 | FAIL |
| A06 | Liina Lokko | 36 | 3 | FAIL |
| A07 | Kadri Kuulpak | 36 | 8 | FAIL |
| A08 | Merle Tomberg | 36 | 3 | FAIL |
| A09 | Heli Ferschel | 31 | 6 | FAIL |
| A10 | Judit Strömpl | 36 | 4 | FAIL |
## B03 S-ploki vahekokkuvõte

- Batch conversation: `conv-e095a20d-c472-4b2b-83e0-fefd82adc79f`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Kõik kümme canonical küsimust saadeti ükshaaval authenticated `/vestlus` vestluses ja kõik kümme DB assistant-sõnumit olid `COMPLETED`.

| case_id | tulemus | retrieved / selected | query-plan | allikapaneel | esimene lahknevus |
|---|---|---:|---|---|---|
| S01 | PARTIAL | 36 / 3 | default; professional_or_method_frame; in_scope | avatud; 3 kaarti | generation |
| S02 | PASS | 39 / 14 | overview_synthesis; broad_issue_or_overview_question; in_scope | avatud; 14 kaarti | none |
| S03 | FAIL | 24 / 1 | default; session_role; unknown | nuppu ei olnud | route |
| S04 | PASS | 36 / 6 | default; professional_or_method_frame; in_scope | avatud; 6 kaarti | none |
| S05 | PASS | 36 / 2 | default; professional_or_method_frame; in_scope | avatud; 2 kaarti | none |
| S06 | PARTIAL | 36 / 4 | default; professional_or_method_frame; in_scope | nuppu ei olnud | UI |
| S07 | PASS | 36 / 3 | default; professional_or_method_frame; in_scope | avatud; 3 kaarti | none |
| S08 | PASS | 36 / 2 | default; professional_or_method_frame; in_scope | avatud; 2 kaarti | none |
| S09 | PASS | 39 / 14 | overview_synthesis; professional_or_method_frame; in_scope | avatud; 14 kaarti | none |
| S10 | PASS | 36 / 5 | default; professional_or_method_frame; in_scope | avatud; 5 kaarti | none |

### S01

- Exact question: `Kuidas arenesid deinstitutsionaliseerimine ja kogukonnahooldus Eestis aastatel 2017–2026 Sotsiaaltöö artiklite põhjal?`
- Messages: user `cmtd4ixv300s50hkmmq1oza7e`; assistant `cmtd4j6h300s80hkmlq7g5vsa`.
- Answer was a coherent synthesis of 2016–2018, and explicitly said that 2019–2026 was not confirmed. Because the requested range was 2017–2026, this is `PARTIAL`, not PASS.
- DB selected/answer/displayed IDs were the three matching deinstitutionalisation/community-care articles. The source panel opened manually and showed Katrin Tsuiman (2016), Jüri Kõre (2018), and Valter Parve (2017).
- First divergent layer: `generation` (requested later-year coverage was not answered despite the retrieved context containing a 2019 candidate).

### S02

- Exact question: `Milliseid töötajate turvalisuse probleeme ja lahendusi kirjeldavad Sotsiaaltöö artiklid?`
- Messages: user `cmtd4owxb00sm0hkmfqstcpgj`; assistant `cmtd4p3gj00sp0hkm4150xaop`.
- Answer covered physical and verbal aggression, psychosocial load, organisational responsibility, peer support, professional organisation, and explicit limits on technical safety details.
- DB selected, answer, and displayed sets matched at 14 source IDs. The manually opened panel contained 14 cards; key visible cards included the 2026 worker-safety article, the 2022 Alison McInnes interview, and the 2018 ESÜS article. Three “Ava allikas” URLs were also observed and recorded in the trace.
- Verdict: `PASS`.

### S03

- Exact question: `Milline oli vabatahtlike roll ja millised tulemused nende tegevusega kaasnesid?`
- Messages: user `cmtd4qvl300t40hkmxb87q81x`; assistant `cmtd4qvla00t80hkmvndj7jv5`.
- Visible answer was exactly `Vastan ainult sotsiaalvaldkonna küsimustele.`
- Trace showed `mode=default`, `planner_reason=session_role`, `social_scope=unknown`, `model_ms=0`, and deterministic `outside_social_scope` recovery. No source control appeared.
- Verdict: `FAIL`; first divergent layer: `route`.

### S04

- Exact question: `Milliseid lahendusi kirjeldavad Sotsiaaltöö artiklid hoolduskoormuse vähendamiseks?`
- Messages: user `cmtd4r1c500ti0hkmid22h0uk`; assistant `cmtd4r8cn00tl0hkmejtvylvi`.
- Answer covered flexible day/week care, dementia-friendly services and environments, social-health coordination, public financing, respite and work-life measures, caregiver wellbeing, and community/volunteer support.
- Selected, answer, and displayed IDs matched. The manually opened panel showed six relevant cards, including the 2017 primary care-burden articles, the 2019 family-care article, and the 2023 additional-support article.
- Verdict: `PASS`.

### S05

- Exact question: `Kuidas märgata vaimse tervise kriisi ja millist abi kirjeldavad Sotsiaaltöö artiklid?`
- Messages: user `cmtd4s2b200ty0hkmjjbidrpq`; assistant `cmtd4s84v00u10hkmkagwx3lw`.
- Answer covered warning signs, a crisis plan/card, psychosocial crisis assistance, four support levels, social/healthcare and victim-support routes, and a limitation on confirming the current official crisis-card procedure.
- Two selected, answer, and displayed source IDs matched. The manually opened panel showed Helen Alton (2020) and Eveli Lilleoja (2020).
- Verdict: `PASS`.

### S06

- Exact question: `Kuidas käsitlevad Sotsiaaltöö artiklid lapse osalusõigust?`
- Messages: user `cmtd4srj100ue0hkm4q4bo884`; assistant `cmtd4swyd00uh0hkmixbn6iyq`.
- Answer was a coherent discussion of Article 12, best interests, meaningful participation, child-centred assessment, barriers, and feedback to the child.
- DB selected four relevant source IDs, but `answer_source_ids=[]` and `displayed_source_ids=[]`; no source control or panel appeared in the UI. Verdict is therefore `PARTIAL`, with first divergent layer `UI`.

### S07

- Exact question: `Milliseid taastava õiguse rakendusviise kirjeldavad Sotsiaaltöö artiklid?`
- Messages: user `cmtd4tct300uu0hkmybylg99q`; assistant `cmtd4tixt00ux0hkmx3rjyy8s`.
- Answer covered mediation, restorative conversations and circles, preventive/community use, police work, alternatives in criminal proceedings, family group conferences, probation/prisons, and closed child institutions.
- Three selected, answer, and displayed IDs matched. The manually opened panel showed the 2025 implementation article and two 2020 practice articles.
- Verdict: `PASS`.

### S08

- Exact question: `Mida näitavad Sotsiaaltöö artiklid Saaremaa COVID-kogemuse ja kriisivalmiduse kohta?`
- Messages: user `cmtd4u2xw00vb0hkmopdkjc9q`; assistant `cmtd4uosf00ve0hkmbi98w8a0`.
- Answer covered crisis planning, flexible service continuity, Saaremaa Kriisikodu, health/social-care integration, volunteers and community, and worker support; it bounded the conclusion to the 2020–2021 experience and did not claim the current 2026 state.
- Two selected, answer, and displayed IDs matched. The manually opened panel showed Riina Koit (2021) and Anneli Tõru (2020).
- Verdict: `PASS`.

### S09

- Exact question: `Kuidas on Sotsiaaltöö artiklites käsitletud digilahendusi ja tehisaru?`
- Messages: user `cmtd4vzhe00vs0hkmvl7h4l84`; assistant `cmtd4w4va00vv0hkmbz9fnk05`.
- Answer distinguished digital tools in education and crisis-time work from the more cautious AI discussion focused on confidentiality, data protection, and trust; it explicitly did not claim concrete AI use in casework or service provision.
- DB selected, answer, and displayed sets matched at 14 IDs. The manually opened panel contained 14 cards, including Ingrid Sindi (2022), Kadri Kuulpak’s Judit Strömpl interview (2026), and Riina Koit (2021); the visible “Ava allikas” URL was recorded.
- Verdict: `PASS`.

### S10

- Exact question: `Mida kirjeldavad Sotsiaaltöö artiklid supervisiooni, mentorluse ja tööheaolu kohta?`
- Messages: user `cmtd4wkcp00w80hkm89bk0ano`; assistant `cmtd4wqna00wb0hkmz48pd4lo`.
- Answer distinguished supervision, mentoring, role clarity, professional identity, burnout prevention, and state/organisational support. It also reported the historical supervision percentages and bounded them to the cited 2016 discussion.
- Five selected, answer, and displayed IDs matched. The manually opened panel showed the 2026 mentoring article, the 2016 supervision article, and three supporting cards.
- Verdict: `PASS`.
## B04 M/N-ploki vahekokkuvõte

- Batch conversation: `conv-9118dff9-3d77-420c-abe5-96127d9e811b`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- M01–M10 ja N11–N15 saadeti ükshaaval authenticated `/vestlus` vestluses; kõik 15 DB assistant-sõnumit olid `COMPLETED`.

| case_id | tulemus | retrieved / selected | query-plan | allikapaneel | esimene lahknevus |
|---|---|---:|---|---|---|
| M01 | FAIL | 48 / 0 | specific_research_fact; singular_research_source_and_fact_shape; unknown | nuppu ei olnud | route |
| M02 | FAIL | 12 / 8 | default; session_role; unknown | nuppu ei olnud | route |
| M03 | FAIL | 7 / 2 | overview_synthesis; session_role; unknown | nuppu ei olnud | route |
| M04 | PASS | 36 / 7 | default; session_role; in_scope | avatud; 7 kaarti | none |
| M05 | FAIL | 35 / 5 | default; session_role; unknown | nuppu ei olnud | route |
| M06 | FAIL | 22 / 8 | default; session_role; unknown | nuppu ei olnud | route |
| M07 | FAIL | 36 / 6 | default; session_role; unknown | nuppu ei olnud | route |
| M08 | FAIL | 35 / 4 | default; session_role; unknown | nuppu ei olnud | route |
| M09 | FAIL | 14 / 4 | default; session_role; in_scope | nuppu ei olnud | validation |
| M10 | FAIL | 36 / 5 | default; session_role; unknown | nuppu ei olnud | route |
| N11 | PASS | 8 / 2 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 2 kaarti | none |
| N12 | PASS | 1 / 1 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 1 kaart | none |
| N13 | PASS | 1 / 1 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 1 kaart | none |
| N14 | PARTIAL | 1 / 1 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | nupp leiti, paneel ei avanenud | UI |
| N15 | PASS | 3 / 3 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 3 kaarti | none |

### M-plokk

- M01, M02, M03, M05, M06, M07, M08 ja M10 andsid nähtava deterministliku vastuse `Vastan ainult sotsiaalvaldkonna küsimustele.`, kuigi retriever leidis vastavaid dokumente või kandidaate. Nende esimene lahknevus oli `route`.
- M04 andis tuleohutusmaterjali põhjal kasutatava juhise: häirekoha kontroll, 112, evakuatsiooni alustamine ning massilise ja etapiviisilise evakuatsiooni eristus. Selected/answer/displayed ID-d kattusid ja paneel avati. Paneelis oli kuue tuleohutusallika kõrval ka üks varasem Saaremaa COVID-allikas; see on allikamüra, kuid ei muutnud vastuse põhisisu.
- M09 jõudis `in_scope` rajale ja tegi mudelikutsungi, kuid `fact_validation`/recovery kandis põhjuseks `missing_requested_year` ning tagastas vale, arvu-ulatuse-aasta keeldumise. See ei vastanud abivajavast lapsest teatamise ja anonüümsuse küsimusele; esimene lahknevus on `validation`.

### N-plokk

- N11 vastas § 15 abivajaduse tervikliku hindamise ja sellele järgneva abi korraldamise kohta ning märkis ausalt, et esitatud väljavõte ei kinnita lõike 4 täielikku sisu. Paneel näitas § 15 kahte seotud allikat.
- N12, N13 ja N15 vastasid vastavalt koduteenuse, üldhooldusteenuse ja hooldustöötajaks ettevalmistumise põhinõuetele; õigusallika paneel avanes.
- N14 sisaldas täpselt nõutud 30 päeva ja vähemalt poolaasta ülevaatamise nõudeid ning õigusallikas oli DB-s seotud, kuid allikapaneeli käsitsi avamine ebaõnnestus. Seetõttu `PARTIAL`, mitte PASS.

### Operatiivne märkus

Uue B04 vestluse loomise esimesel katsel jäi UI vana B03 vestluse peale ning üks M01 küsimus saadeti kogemata B03 vestlusesse kell 19:09 kohaliku aja järgi. See lisakäik on B03 kümne manifestijuhtumi tulemustest välja jäetud; õige B04 vestlus alustati kohe pärast seda ning selle 15 küsimust on eraldi tõendatud.

## B01 V-ploki vahekokkuvõte

- Batch conversation: `conv-0e749a44-dc95-49bf-b510-34ed4f372fef`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- V01–V08 saadeti ükshaaval samas authenticated `/vestlus` vestluses; kõik kaheksa DB assistant-sõnumit olid `COMPLETED`.

| case_id | tulemus | retrieved / selected | query-plan | allikapaneel | esimene lahknevus |
|---|---|---:|---|---|---|
| V01 | FAIL | 23 / 2 | default; session_role; unknown | nuppu ei olnud | route |
| V02 | FAIL | 49 / 1 | specific_research_fact; singular_research_source_and_fact_shape; unknown | nuppu ei olnud | route |
| V03 | FAIL | 21 / 2 | default; session_role; unknown | nuppu ei olnud | route |
| V04 | PASS | 80 / 1 | specific_research_fact; named_enumerated_research_fact_shape; in_scope | avatud; 1 kaart | none |
| V05 | FAIL | 47 / 1 | specific_research_fact; singular_research_source_and_fact_shape; unknown | nuppu ei olnud | route |
| V06 | FAIL | 59 / 1 | specific_research_fact; compact_single_research_fact_shape; unknown | nuppu ei olnud | route |
| V07 | FAIL | 46 / 1 | specific_research_fact; singular_research_source_and_fact_shape; unknown | nuppu ei olnud | route |
| V08 | FAIL | 17 / 2 | default; session_role; unknown | nuppu ei olnud | route |

- V01–V03 ja V05–V08 andsid nähtava vastuse `Vastan ainult sotsiaalvaldkonna küsimustele.`. V01 ja V03 valisid vale eakate vägivalla/kuriteoennetuse konteksti; V02 valis õige erihooldekodude allika, V05 õige e-kursuse allika ja V07 õige inimarengu allika, kuid route-kihi domeenipiir takistas vastamist. V06 valis vale lastekaitseallika ja V08 kaks seotud Perepesa-allikat.
- V04 vastas õigesti: 10% = 640, 6% = 227 ja 2% = 100 koos õigete sihtrühmade/mõõdikutega. DB selected/answer/displayed ID kattus ning käsitsi avatud paneel näitas Anu Lepsi 2025. aasta artiklit.
- V-ploki tulemus: `PASS=1, FAIL=7`.

## B05 K-ploki vahekokkuvõte

- Batch conversation: `conv-7f8a159a-a18f-4066-85cc-ffb7e372f5cd`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- K01–K10 saadeti ükshaaval authenticated `/vestlus` vestluses; kõik kümme DB assistant-sõnumit olid `COMPLETED`.

| case_id | tulemus | retrieved / selected | query-plan | allikapaneel | esimene lahknevus |
|---|---|---:|---|---|---|
| K01 | PASS | 31 / 2 | municipality_service_benefit; explicit_law_or_paragraph_reference; in_scope | avatud; 2 kaarti | none |
| K02 | PASS | 38 / 1 | municipality_service_benefit; session_role; in_scope | avatud; 1 kaart | none |
| K03 | PASS | 10 / 8 | comparison; comparison_question; in_scope | avatud; 6 kaarti | none |
| K04 | PASS | 58 / 30 | municipality_service_benefit_list; session_role; in_scope | avatud; 29 kaarti | none |
| K05 | FAIL | 0 / 0 | default; session_role; in_scope | nuppu ei olnud | retrieval |
| K06 | PASS | 16 / 8 | municipality_service_benefit_list; session_role; in_scope | avatud; 1 kaart | none |
| K07 | FAIL | 8 / 3 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | nuppu ei olnud | validation |
| K08 | PASS | 1 / 1 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 1 kaart | none |
| K09 | PASS | 1 / 1 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 1 kaart | none |
| K10 | PASS | 1 / 1 | explicit_paragraph; explicit_law_or_paragraph_reference; in_scope | avatud; 1 kaart | none |

- K01 vastas Kuusalu taotlemisele, 10 tööpäevale ja § 6 sisule; DB-s olid Kuusalu määruse § 6 ja teenusekirje, paneel avanes.
- K02 vastas Narva kirjalikule taotlusele, abivajaduse hindamisele ja kümne tööpäeva otsusele. DB allikas oli Narva teenusekirje; UI kaardi pealkiri oli üldine `Koduteenus · Teenused`, kuid attribution oli õige.
- K03 eristas koduteenust ja tugiisikuteenust ning paneel näitas kuut SHS-i allikat.
- K04 loetles Luunja toetused ja teenused. DB valis 30 kirjet, sh seitse kontaktikirjet; paneel näitas 29 kaarti. Kontaktikirjete müra on kvaliteedimärkus, mitte vastuse põhivea põhjus.
- K05 oli selgelt in-scope, kuid retrieval andis 0 kinnitatud tulemust ja vastus jäi `Ma ei saa sellele praegu piisavalt kindlat vastust anda.` fallback'iks.
- K06 tuvastas Järva vaimse tervise teenuse ning K08–K10 vastasid vastavalt SHS § 17, § 23 ja § 27 sisule; täpsed teenuse-/õigusallikad olid paneelis nähtavad.
- K07 küsis § 15 kohta ilma aastata, kuid validation kandis `missing_requested_year` põhjuse ja tagastas vale arvu-ulatuse-aasta keeldumise.
- K-ploki tulemus: `PASS=8, FAIL=2`.
