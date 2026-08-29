# 75 juhtumi autentitud tootmis-RAG-i tulemused

Käimasoleva release'i tulemused on selles failis muutumatud canonical-küsimuste kaupa.
Küsimusi saadetakse ainult manifesti järjekorras; diagnostilisi kordusi 75 nimetajasse ei
lisata.

## J01

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 1`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:31:27.940Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd1vc69004z0hkmxxr4m7xo`
- User message ID: `cmtd1vc68004y0hkm1hwctgt8`
- Assistant message ID: `cmtd1vc6o00520hkm32srlqz8`
- Exact question:

> Kui tihti toimusid MAPPA kohtumised kolmes Virumaa linnas ja mitu kohtumist toimus Rakveres, Jõhvis ning Narvas?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: MAPPA kohtumiste sagedus; Rakvere 5; Jõhvi 7; Narva 5
- Observed correct claims: puuduvad
- Missing or wrong claims: kogu MAPPA vastus puudub; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: piisavalt selge sotsiaalvaldkonna küsimus suunati domain-boundary keeldumisse; ükski oodatud fakt ei jõudnud nähtavasse vastusesse ja faktivärav/allikapaneel ei saanud rakenduda
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J13

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 13`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:09:29.298Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd387bv00gw0hkml8067x4w`
- User message ID: `cmtd387bu00gv0hkmla7euwus`
- Assistant message ID: `cmtd387c200gz0hkmqaccrn3p`
- Exact question:

> Millist vanuserühma 13–18 käsitleti ning mitu probleemi noortel tavaliselt korraga oli?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: vanuserühm 13–18; noortel oli tavaliselt korraga 3–5 probleemi
- Observed correct claims: puuduvad
- Missing or wrong claims: vanuserühm ja probleemide arv puuduvad; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: retrieval leidis täpse käitumisprobleemidega laste artikli, kuid nähtav vastus jäi domain-boundary-keeldumiseks
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J16

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 16`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:16:35.651Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3h80y00ju0hkmw0wqa0c8`
- User message ID: `cmtd3h80x00jt0hkmwgnctcof`
- Assistant message ID: `cmtd3hday00jw0hkm980jhjs8`
- Exact question:

> Mida kirjeldati Saaremaa esimese ja teise COVID-laine ning tervishoiu ja sotsiaalhoolekande lõimimise kohta?

- Exact visible answer:

> Saaremaa kogemuse uuringus käsitleti COVID-19 esimest ja teist lainet kui olukorda, mis mõjutas korraga tervishoidu, sotsiaaltööd, hoolekannet ja inimeste majanduslikku toimetulekut. Esimese laine ajal levis viirus Saaremaal kiiresti ja ulatuslikult, mistõttu tuli sotsiaalabi ning hoolekandeteenuseid nakkusohu tingimustes kiiresti ümber korraldada.
>
> Kirjeldatud peamised mõjud ja õppetunnid olid järgmised:
>
> - Koduhooldus muutus piiratumaks: sageli viidi inimestele toit ja ravimid koduukse või väravani. Tugiisiku-, isikuhooldus- ja isikliku abistaja teenust ei saanud pakkuda tavapärases mahus.
> - Hooldekodudes tekkisid suured riskid, sest töötajaid haigestus ja osa töötajaid kartis nakatumise tõttu teenust osutada.
> - Tervishoiuteenuste kättesaadavus halvenes, sest viiruse leviku tõttu oli arstide külastamine ja muu abi piiratud.
> - Mõnel perel tekkisid toimetulekuraskused ning hajaasustuses suurenesid transpordiprobleemid.
> - Saaremaa Südamekodu ja vallaga koostöös loodi Saaremaa Kriisikodu, kuhu paigutati haiglaravi mittevajavad COVID-19 nakatunud hooldekodukliendid. See aitas kaitsta nii nakatunud inimesi kui ka teiste hooldekodude elanikke ja töötajaid.
> - Toimetulekut toetasid vabatahtlikud, Kaitseliit, meditsiinitöötajad, Kuressaare Ametikool ja kogukond. Korraldati näiteks abivajajate transporti ning kaeti eakate ja laste toiduringe.
> - Kriis tõi esile vajaduse selgete tegevuskavade, riskianalüüside, kriisikommunikatsiooni ja lisatööjõu ning vabatahtlike registri järele. Samuti rõhutati töötajate supervisiooni, psühholoogilise toe, nakkushaiguste alaste teadmiste ja isikukaitsevahendite kasutamise koolituse tähtsust.
>
> Tervishoiu ja sotsiaalhoolekande lõimimist kirjeldati kriitilise vajadusena, sest COVID-19 ei olnud ainult tervishoiukriis, vaid komplekskriis, mis mõjutas ka sotsiaalset toimetulekut ja majandust. Vajalikuks peeti:
>
> - tervishoiu- ja sotsiaalhoolekandeasutuste püsivamat koostöövõrgustikku;
> - kvaliteetse meditsiiniabi tagamist hoolekandeasutustes;
> - tervishoiuteenuste kättesaadavuse säilitamist kriisi ajal;
> - hoolekandeasutuste ruumide ja töökorralduse paindlikkust, et seal saaks vajaduse korral osutada esmatasandi tervishoiuteenuseid;
> - riigi ja kohaliku omavalitsuse tasandi tugevaid kriisiplaane ning selget vastutuse jaotust.
>
> Uuring hõlmas mõlemat lainet ning andmeid koguti 2020. aasta oktoobris ja 2021. aasta aprillis, kuid esitatud katkendid kirjeldavad teise laine konkreetseid sündmusi vähem üksikasjalikult.

- Expected claims: esimese ja teise laine käsitlus; tervishoiu ja sotsiaalhoolekande lõimimise vajadus ja korraldussoovitused
- Observed correct claims: vastus eristas mõlema laine ajaraami, kirjeldas kriisimõju ning tõi välja lõimimise konkreetsed vajadused
- Missing or wrong claims: teise laine sündmuste üksikasjad olid allikakatkendites piiratud ja vastus ütles selle ausalt välja
- Source button present: jah
- Source panel opened: jah
- Source panel title: `Vastuste allikad`
- Source cards: 2 — `Riina Koit, 2021. COVID-19 kriisi mõju sotsiaaltöö ja hoolekande korraldusele. Saaremaa kogemus. Sotsiaaltöö 4/2021 · lk 1–5 · Uurimus`; `Helle Kahm, 2020. Sotsiaalvaldkonna võimalused ja arengud koroonakriisi kevadel. Sotsiaaltöö 4/2020 · lk 1–2, 6–7 · Kogemus`
- Source URLs: puuduvad nähtavad URL-id
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PASS`
- Verdict reason: nähtav vastus kattis oodatud võrdleva ja ajalise sisu ning käsitsi avatud paneel näitas kahte asjakohast Saaremaa allikat
- First divergent layer: `none`
- Diagnostic retry: `not_run`

## J17

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 17`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:17:50.355Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3ityx00kz0hkmi9ky3mou`
- User message ID: `cmtd3ityw00ky0hkmxntwzokb`
- Assistant message ID: `cmtd3itz600l20hkm8jrzy4po`
- Exact question:

> Kui palju lapse eraldamise otsuseid tehti 2018. aasta juhtumites?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 2018. aasta juhtumites tehti 169 lapse eraldamise otsust
- Observed correct claims: puuduvad
- Missing or wrong claims: arv 169 puudub; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: retrieval leidis lapse eraldamise artikli, kuid nähtav vastus jäi domain-boundary-keeldumiseks
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J18

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 18`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:18:50.470Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3k5bw00ld0hkm2m5olv0u`
- User message ID: `cmtd3k5bv00lc0hkmu43lwqoa`
- Assistant message ID: `cmtd3k70500lf0hkmhq3q8k9n`
- Exact question:

> Kui suur oli eestkostetavate osalus igas kolmes rühmas ja kokku eestkostes osalemise uuringus?

- Exact visible answer:

> Uuringus osales igast kolmest rühmast 5 inimest, kokku 15 inimest:
>
> - 5 maakohtu kohtunikku;
> - 5 erihoolekandeasutuse töötajat;
> - 5 kohaliku omavalitsuse sotsiaaltöötajat, kes täidavad eestkosteülesandeid.
>
> Seega ei olnud need 15 osalejat eestkostetavad, vaid eestkostepraktikaga seotud spetsialistid.

- Expected claims: 5 kohtunikku; 5 erihoolekandeasutuse töötajat; 5 KOV-i sotsiaaltöötajat; kokku 15
- Observed correct claims: kõik neli arvu olid õigesti seotud ning vastus parandas küsimuse eksliku eelduse, et osalejad olid eestkostetavad
- Missing or wrong claims: puuduvad
- Source button present: jah
- Source panel opened: jah
- Source panel title: `Vastuste allikad`
- Source cards: 4 — `Kristi Rekand, 2026. Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte · lk 5–7, 14–15, 37, 44, 47`; `Erle Eenmaa, 2022. Psüühilise erivajadusega inimese osalus oma eestkostes. Sotsiaaltöö 1/2022 · lk 4–7 · Õigus`; `Sabina Trankmann, 2024. Eestkostekorralduse kitsaskohad ja võimalused üleminekuks toetatud otsustamisele. Sotsiaaltöö 2/2024 · lk 8 · Analüüs`; `Eesti laste vaimse tervise uuring · lk 9, 58, 60, 77`
- Source URLs: `https://tai.ee/sites/default/files/2025-05/lvtu_lopparuanne_16mai2025.pdf`
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PASS`
- Verdict reason: kõik nõutud arvsuhted olid õiged, faktivalidaator läbis värava ja allikapaneel avanes
- First divergent layer: `none`
- Diagnostic retry: `not_run`

## J19

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 19`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:20:04.213Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3lpil00ma0hkmp35wp9of`
- User message ID: `cmtd3lpik00m90hkmjthgug79`
- Assistant message ID: `cmtd3lpip00md0hkmwjdr5qvr`
- Exact question:

> Mitu lehekülge ja teadlast oli inimarengu aruandes ning mitu stsenaariumi selles esitati?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 380 lehekülge; 71 teadlast; 4 stsenaariumi
- Observed correct claims: puuduvad
- Missing or wrong claims: kõik kolm arvu puuduvad; eelmise pöörde allikafilter hoidis valikus vale eestkosteuuringu
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: konkreetse inimarengu aruande asemel rakendus eelmise pöörde dokumendifilter ja valiti vale uuring; nähtav vastus oli keeldumine
- First divergent layer: `selection`
- Diagnostic retry: `not_run`

## J20

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 20`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:21:06.050Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3n3l400mq0hkmexs1u5aq`
- User message ID: `cmtd3n3l200mp0hkmbrccvhst`
- Assistant message ID: `cmtd3n3w000mt0hkmszd171g5`
- Exact question:

> Millal kirjeldati artiklis sotsiaalvaldkonna seadusemuudatusi 2023. aasta kevadel ja suvel ning 2025. aasta jaanuaris?

- Exact visible answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Expected claims: 2023. aasta kevade, 2023. aasta suve ja 2025. aasta jaanuari seadusemuudatused õigesti ajastatud
- Observed correct claims: puuduvad
- Missing or wrong claims: ükski kolmest ajastatud muudatusest ei jõudnud vastusesse
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: retrieval tõi mitu kandidaati, kuid dokumendiidentiteet jäi ebamääraseks ja ühtegi konteksti ei valitud
- First divergent layer: `selection`
- Diagnostic retry: `not_run`

## J21

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 21`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:22:09.183Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3or5500nd0hkmk98fsaxf`
- User message ID: `cmtd3or5200nc0hkm7kk5sgor`
- Assistant message ID: `cmtd3oswa00nf0hkm4z4brkiu`
- Exact question:

> Millised olid eakate vägivallauuringu 10%, 6% ja 2% näidud koos vastavate arvudega?

- Exact visible answer:

> - 10% ehk 640 inimest olid 2023. aastal registreeritud kuritegude ohvritest üle 60-aastased.
> - 6% ehk 227 inimest olid 2023. aastal ohvriabisse pöördunutest üle 60-aastased.
> - 2% ehk 100 inimest olid viimase ohvriuuringu (2024) järgi üle 75-aastased, kes olid viimase aasta jooksul kuritegevusega kokku puutunud.

- Expected claims: 10% = 640; 6% = 227; 2% = 100; haldus- ja ohvriuuringu näidud eristatud
- Observed correct claims: kõik protsendid, arvud, vanuserühmad ja andmeliigid olid õigesti seotud
- Missing or wrong claims: puuduvad
- Source button present: jah
- Source panel opened: jah, pärast käsitsi kordusklõpsu
- Source panel title: `Vastuste allikad`
- Source cards: 1 — `Anu Leps, 2025. Vägivald vanemaealiste vastu vajab tähelepanu. Sotsiaaltöö 1/2025 · lk 1–10 · Vägivalla ennetus`
- Source URLs: puuduvad nähtavad URL-id
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PASS`
- Verdict reason: kõik kolm arvupaari ja nende tähendused olid õiged, faktivalidaator läbis värava ning allikapaneel avanes
- First divergent layer: `none`
- Diagnostic retry: `not_run`

## J22

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 22`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:24:20.036Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3rbig00nw0hkm339rtu1b`
- User message ID: `cmtd3rbie00nv0hkmktm3tdxw`
- Assistant message ID: `cmtd3rbip00nz0hkmhd3t6nhb`
- Exact question:

> Millal tehti e-kursuse järelhindamine ning kelle vaadet selles võrreldi?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: järelhindamine tehti 6 kuu pärast; võrreldi osaleja ja tööandja vaadet
- Observed correct claims: puuduvad
- Missing or wrong claims: hindamise aeg ja mõlemad vaated puuduvad; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: retrieval tõi kandidaate, kuid sotsiaalvaldkonna signaal jäi tundmatuks ja vastus lõpetati domain-boundary-keeldumisega
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J12

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 12`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:07:51.802Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd360k600gi0hkmm03jp65h`
- User message ID: `cmtd360k600gh0hkmbe9jw3rb`
- Assistant message ID: `cmtd360kh00gl0hkmebqyzpi6`
- Exact question:

> Mitu supervisioonikohtumist toimus 2017. aastal igas maakonnas?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: igas maakonnas 5 supervisioonikohtumist 2017. aastal
- Observed correct claims: puuduvad
- Missing or wrong claims: number 5 puudub ja küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: supervisiooni küsimus jõudis retrieval'i ja kaks asjakohast artiklit olid valitud, kuid vastus jäi domain-boundary-keeldumiseks
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J15

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 15`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:13:58.370Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd3dysw00ik0hkmzg1jw81v`
- User message ID: `cmtd3dysv00ij0hkmuedg3mve`
- Assistant message ID: `cmtd3e0by00im0hkmyeryaaky`
- Exact question:

> Kui palju töötajaid oli Rakvere käsitluses, mitu neist töötas lastekaitses ja mitu menetles toetusi?

- Exact visible answer:

> Rakvere Linnavalitsuse sotsiaalosakonnas töötas 2020. aasta käsitluse järgi 7 inimest:
>
> - 3 lastekaitsespetsialisti;
> - 2 töötajat, kes menetlesid toetuste taotlusi ja nõustasid inimesi.

- Expected claims: 7 töötajat; 3 lastekaitses; 2 toetuste menetlemises
- Observed correct claims: kõik kolm arvu ja rolliseost olid nähtavas vastuses
- Missing or wrong claims: puuduvad
- Source button present: jah
- Source panel opened: jah
- Source panel title: `Vastuste allikad`
- Source cards: 2 — `Kersti Suun-Deket, 2020. Sotsiaaltöö Rakvere linnas. Sotsiaaltöö 2/2020 · lk 1–3 · Kohalik omavalitsus`; `Anneli Saaber, 2021. Rakvere valla sotsiaaltöös luuakse uusi võimalusi. Sotsiaaltöö 4/2021 · lk 1–2 · Kohalik omavalitsus`
- Source URLs: puuduvad nähtavad URL-id
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PASS`
- Verdict reason: nähtav vastus sisaldas kõiki nõutud arve ja rolliseoseid; fact_validation passed=true; kaks sobivat allikat olid jäljes ja käsitsi avatud paneelis
- First divergent layer: `none`
- Diagnostic retry: `not_run`

## J14

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 14`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:10:30.187Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd39erw00ha0hkmert2fxyx`
- User message ID: `cmtd39erv00h90hkmq4f9jt4z`
- Assistant message ID: `cmtd39hj000hc0hkmr18m6zkf`
- Exact question:

> Mida öeldi Saue kohta üle 5800 elaniku ja eestkostejuhtumite kohtusse jõudmise kohta?

- Exact visible answer:

> Saue vallas oli lastekaitsjate arvestuse järgi üle 5800 alla 18-aastase lapse; tööd korraldati pigem perepõhiselt ning ühel lastekaitsespetsialistil oli samal ajal käsil ligi 40 peret.
>
> Kohtu poole pöörduti hooldusõiguse jagamise juhtumites väga sageli: lastekaitsespetsialisti hinnangul jõudis umbes 90% juhtudest kohtusse, kuigi esmalt võiksid vanemad pöörduda nõustamiseks lastekaitsespetsialisti poole. Ühe näitena oli tal aasta jooksul 14 kohtujuhtumit, millest ainult kolmel juhul jõudsid vanemad lastekaitsespetsialisti juures kohtuvälise kokkuleppeni.
>
> See kirjeldus puudutab laste hooldusõiguse vaidlusi, mitte eestkostejuhtumeid kitsas õiguslikus tähenduses.

- Expected claims: Saue kohta üle 5800; 90% kohtusse jõudnud juhtumitest; oodatud eestkostejuhtumite seos
- Observed correct claims: üle 5800 alla 18-aastase lapse; umbes 90% hooldusõiguse jagamise juhtumitest; allikas selgitas eestkoste ja hooldusõiguse erinevust
- Missing or wrong claims: küsimuse „elaniku” ja „eestkostejuhtumi” sõnastus ei saanud allikast kinnitust; vastus korrigeeris mõlemad seosed
- Source button present: jah
- Source panel opened: jah
- Source panel title: `Vastuste allikad`
- Source cards: 1 — `Anne-Ly Sumre, 2019. Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele. Sotsiaaltöö 1/2019 · lk 1–2 · Kohalik omavalitsus`
- Source URLs: puuduvad nähtavad URL-id
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PARTIAL`
- Verdict reason: vastus oli sisuline ja allikaga kooskõlas, kuid ei kinnitanud manifesti sõnastatud elaniku/eestkostejuhtumi väiteid; fact_validation oli null
- First divergent layer: `answer`
- Diagnostic retry: `not_run`

## J11

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 11`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:05:37.149Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd33buz00f70hkmuj7k6rg0`
- User message ID: `cmtd33bux00f60hkmbkzrdsgx`
- Assistant message ID: `cmtd33bv700fa0hkmzta1l6j7`
- Exact question:

> Kui palju oli töötamise toetamise intervjuusid, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 7 intervjuud; 6 individuaalset; 1 kolmeliikmeline rühm; kolmeetapiline temaatiline analüüs
- Observed correct claims: puuduvad
- Missing or wrong claims: kõik oodatud intervjuude, vestluste ja analüüsi faktid puuduvad
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: töötamise toetamise küsimus suunati küll spetsiifilise faktina retrieval'i, kuid küsimuseplaan jäi social_scope=unknown, sobivat dokumenti ei valitud ja vastus jäi domain-boundary-keeldumiseks
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J10

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 10`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:03:53.652Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd30ur800eb0hkm65kt7ve1`
- User message ID: `cmtd30ur700ea0hkmdcr9qw5s`
- Assistant message ID: `cmtd30urn00ee0hkmw6a99b56`
- Exact question:

> Mida näitas artikkel dementsusega inimese kohta 150 ja 75 minuti, 7–8 tunni une ning kuulmislanguse 2–5-kordse riski kohta?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 150 ja 75 minutit; 7–8 tundi und; kuulmislanguse 2–5-kordne risk ning õiged seosed
- Observed correct claims: puuduvad
- Missing or wrong claims: kõik nõutud dementsuseartikli väited puuduvad; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: dementsuse faktiküsimus jõudis retrieval'i ja sobiv artikkel oli valitud, kuid nähtav vastus jäi domain-boundary-keeldumiseks
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J09

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 9`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:02:14.381Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd2yrbm00dj0hkmyulq5dcc`
- User message ID: `cmtd2yrbl00di0hkm8o8ap298`
- Assistant message ID: `cmtd2yrbr00dm0hkm7ympv6lh`
- Exact question:

> Millised olid kiusamist kirjeldanud neli protsenti?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 33%; 13%; 19%; 7% ning protsentide õiged seosed
- Observed correct claims: puuduvad
- Missing or wrong claims: kõik neli protsenti ja seosed puuduvad; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: kiusamise faktiküsimus jõudis retrieval'i ja sobiv artikkel oli valitud, kuid nähtav vastus jäi domain-boundary-keeldumiseks
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J08

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 8`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T15:00:37.836Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd2wu6y00cr0hkmrhrhr5y8`
- User message ID: `cmtd2wu6x00cq0hkmnsu0qf67`
- Assistant message ID: `cmtd2wujv00cu0hkm65wyqv5m`
- Exact question:

> Millised olid hoolduskoormuse uuringus neli küsitud osakaalu?

- Exact visible answer:

> Ma ei saa sellele praegu piisavalt kindlat vastust anda.

- Expected claims: 61%; 26%; 11%; 18% ning iga protsendi õige nähtus
- Observed correct claims: puuduvad
- Missing or wrong claims: kõik neli osakaalu ja nende seosed puuduvad; sobivat dokumenti ei identifitseeritud
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: küsimus suunati küll spetsiifilise faktina retrieval'i, kuid valitud konteksti ei tekkinud, dokumendiidentiteet jäi madalaks ja vastus oli ebakindluse-fallback
- First divergent layer: `selection`
- Diagnostic retry: `not_run`

## J07

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 7`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:53:49.588Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd2ob7d00aj0hkmlbhiz3vu`
- User message ID: `cmtd2ob7c00ai0hkmhbz17tam`
- Assistant message ID: `cmtd2odin00al0hkmhy5dtu3x`
- Exact question:

> Kui palju inimesi sai teenust, mitu vabatahtlikku osales, mitu töötundi tehti ning mitmes maakonnas ja omavalitsuses tegutseti 2018–2020 katseetapis 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust” järgi?

- Exact visible answer:

> 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust” järgi toetati katseetapis novembrist 2018 kuni aprillini 2020:
>
> - 678 inimest;
> - osales 273 vabatahtlikku;
> - panustati 21 600 töötundi;
> - tegevus jõudis 12 maakonda ja 43 omavalitsusse.

- Expected claims: 678 inimest; 273 vabatahtlikku; 21 600 töötundi; 12 maakonda; 43 omavalitsust; 2018–2020 periood
- Observed correct claims: kõik oodatud arvud, ühikud ja periood olid nähtavas vastuses
- Missing or wrong claims: puuduvad
- Source button present: jah
- Source panel opened: jah
- Source panel title: `Vastuste allikad`
- Source cards: 1 — `Krista Pegolainen-Saar, 2022. Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust. Sotsiaaltöö 2/2022 · lk 1–4 · Korraldus`
- Source URLs: puuduvad nähtavad URL-id
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PASS`
- Verdict reason: nähtav vastus sisaldas kõiki nõutud arvulisi väiteid; sama 2022. aasta artikkel oli dokumendiidentiteedi järgi valitud, faktivärav oli `passed=true` ning allikapaneel avanes õige allikaga
- First divergent layer: `none`
- Diagnostic retry: `not_run`

## J06

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 6`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:49:42.199Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd2ilsn00a30hkm8l5dd4h2`
- User message ID: `cmtd2ilsn00a20hkmne2pxnld`
- Assistant message ID: `cmtd2ilst00a60hkmqup1xipv`
- Exact question:

> Mida kirjeldas teenusmaja käsitlus seoses 12–30-aastastega, 12 arengukavaga ja osalejate kavatsustega?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 12–30-aastaste sihtrühm; 12 arengukava; osalejate kavatsused
- Observed correct claims: puuduvad
- Missing or wrong claims: kogu teenusmaja käsitluse vastus puudub; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: teenusmaja küsimus jõudis retrieval'i ja õige teenusmaja artikkel oli valitud kontekstis, kuid nähtav vastus jäi domain-boundary-keeldumiseks ning oodatud faktid ei jõudnud kasutajani
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J05

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 5`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:47:51.920Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd2gazw009p0hkm8v6cctgt`
- User message ID: `cmtd2gazv009o0hkmmsqlx5dh`
- Assistant message ID: `cmtd2gb02009s0hkmvq3n76d9`
- Exact question:

> Milliseid kahte taastava õiguse näitajat kirjeldati arvudega 30 ja 12 ning milliseid näitajaid arvudega 60 ja 19?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: arvude 30 ja 12 ning 60 ja 19 tähendus ja õiged seosed
- Observed correct claims: puuduvad
- Missing or wrong claims: mõlema näitajarühma sisu puudub; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: taastava õiguse küsimus jõudis retrieval'i, kuid nähtav vastus jäi domain-boundary-keeldumiseks ja oodatud numbrisuhted ei jõudnud kasutajani
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J04

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 4`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:45:09.891Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd2crgy008f0hkma4e6wcbx`
- User message ID: `cmtd2crgx008e0hkmup31l4he`
- Assistant message ID: `cmtd2crh8008i0hkmduirghrd`
- Exact question:

> Millistes linnades tegutsesid Perepesad ja millised neli ülesannet neil olid?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: Perepesade linnad ja neli ülesannet
- Observed correct claims: puuduvad
- Missing or wrong claims: kogu vastus puudub; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: Perepesade küsimus jõudis retrieval'i, kuid nähtav vastus jäi domain-boundary-keeldumiseks ning oodatud linnad ja ülesanded ei jõudnud kasutajani
- First divergent layer: `route`
- Diagnostic retry: `not_run`

## J03

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 3`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:41:22.232Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd27x5g00770hkmgy2iqmos`
- User message ID: `cmtd27x5f00760hkmj9ylvd1w`
- Assistant message ID: `cmtd27yxn00790hkmhi5m5rzp`
- Exact question:

> Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada 2018. aasta artikli järgi?

- Exact visible answer:

> 2018. aasta artikli järgi võivad vaimse tervise kriisile viidata:
>
> - oht, et inimene kahjustab ennast, näiteks üritab end vigastada või teha enesetappu ravimite või mürgiste ainetega;
> - äärmuslik stress, näiteks paanikahoog, äge stressireaktsioon pärast traumeerivat sündmust või tõsine psühhootiline seisund;
> - teiste jaoks tugevalt häiriv käitumine, näiteks agressiivsus või kontakti kaotamine reaalsusega.
>
> Sellises olukorras soovitatakse helistada hädaabinumbrile 112 või perearsti nõuandeliinile 1220.

- Expected claims: vaimse tervise kriisi tunnused; 112; 1220; 2018. aasta allikas
- Observed correct claims: kolm kriisitunnuste rühma ning 112 ja 1220 olid nähtavas vastuses; õige Külli Mäe 2018 allikas oli paneelis
- Missing or wrong claims: DB trace'i `fact_validation` oli `null`, mistõttu kohustuslikku valideerimisväravat ei saa PASS-ina tõendada
- Source button present: jah
- Source panel opened: jah
- Source panel title: `Vastuste allikad`
- Source cards: 1 — `Külli Mäe, 2018. Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?. Sotsiaaltöö 1/2018 · lk 1–5 · Tööalane tugi`
- Source URLs: puuduvad nähtavad URL-id
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `PARTIAL`
- Verdict reason: nähtav vastus, valitud allikas ja käsitsi avatud paneel olid sisuliselt õiged, kuid nõutud `fact_validation=PASS` ei olnud taastatavas assistendi trace'is olemas
- First divergent layer: `validation`
- Diagnostic retry: `not_run`

## J02

- Prompt origin: `PROMPT_DERIVED_FROM_CORE`
- Batch / turn: `B01 / 2`
- Runtime SHA: `44c1e59b5986a7346f0f391f268d59a94da5b8be`
- Sent at UTC: `2026-08-28T14:38:06.647Z`
- Conversation ID: `7d428af8-df08-496b-9d1d-2439b433f270`
- Turn ID: `cmtd23wyy00690hkmw05gwdr5`
- User message ID: `cmtd23wyx00680hkm56z9v0xw`
- Assistant message ID: `cmtd23wz6006c0hkme4w3ak7k`
- Exact question:

> Millised kolm protsenti kirjeldasid erihooldekodude kaardistuse tulemusi?

- Exact visible answer:

> Vastan ainult sotsiaalvaldkonna küsimustele.

- Expected claims: 25%, 45%, 30% ja nende tähendus
- Observed correct claims: puuduvad
- Missing or wrong claims: kõik kolm protsenti ja nende tähendus puuduvad; küsimus märgiti ekslikult sotsiaalvaldkonnast väljapoole
- Source button present: ei
- Source panel opened: ei; nuppu ei olnud
- Source cards: 0
- Source URLs: puuduvad
- UI first text: `null / NOT_PROVEN`
- UI complete: `null / NOT_PROVEN`
- Case verdict: `FAIL`
- Verdict reason: konkreetne erihooldekodude kaardistuse küsimus jõudis küll retrieval'i ja kõrge identiteedikindlusega dokumendini, kuid nähtav vastus jäi domain-boundary keeldumiseks; nõutud faktivastus ja allikapaneel puudusid
- First divergent layer: `route`
- Diagnostic retry: `not_run`
