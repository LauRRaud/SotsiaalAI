# RAG-i sõltumatu kvaliteediseire toodanguindeksi ja autentitud vestluse vastu

Kuupäev: 22.08.2026

Mõõteaken: 04:52–06:20 Europe/Tallinn

Testitud commit: `e580be85c76fe3f2be19249198f3d4bc2aed059f`

Paranduskandidaadi järelkontroll: 06:38–07:28 Europe/Tallinn, sama `e580be85` lähte-SHA peal ja toodanguindeksi eraldatud koopial.

Töö laad: toodangu suhtes read-only audit. Korpust, toodanguindeksit, andmebaasi, serveri keskkonda ega toodangukoodi ei muudetud. Isolatsioonis tehti lokaalne paranduskandidaat ja seda mõõdeti ainult loopback-aadressil töötava ajutise RAG-teenuse ning toodanguindeksi koopia vastu. Reindeksit, commit'i, push'i ega deploy'd ei tehtud.

## Kokkuvõte

RAG-i ei saa selle seire põhjal nimetada töökindlaks.

- Otsene toodanguotsing mõõdeti kõigi **75/75** kihilise valimi juhtumi jaoks: **51 PASS, 6 PARTIAL, 18 FAIL**.
- Autentitud `/vestlus` andis algses samas vestluses **50 sisulist vastust**: **21 õiged, 3 osalised, 26 valed**. Seejärel tagastas viis järjestikust laia küsimust `Viga: Liiga palju paringuid. Proovi hiljem uuesti.` ja ülejäänud 20 vestlusjuhtumit jäid teadlikult käivitamata.
- Otsing ja vastamine lahknesid tugevalt: vähemalt mitmes faktijuhtumis leidis otsene otsing kogu õige tõendi, aga vestlus keeldus, segas teise allika arve või jättis tõendi kasutamata. Selged näited on MAPPA, erihooldekodude osakaalud, vabatahtlike seltsilised, seksuaalvägivalla kriisiabikeskused ja Laur Raudsoo.
- Kõigi 50 sisulise vestlusvastuse juures oli ligipääsetavaid allikalinke/-kaarte **0**. Mitme vastuse juures oli nupp `Vastuste allikad`, kuid kontrollitud klõps ei avanud nähtavat allikaloendit. Seetõttu ei olnud kasutajal võimalik väiteid kuvatud allikate vastu kontrollida.
- Sõnastustundlikkus on ulatuslik. Näiteks inimarengu aruande pikk versioon vastati õigesti, lühivariant valesti; lapse eraldamise lühivariandile anti enesekindel vale arv `58 otsust / 72 last / 2023`, kuigi algallika kontrollfakt oli `169 otsust / 2018`.
- Autoripäringud on süsteemselt katki: otsene otsing leidis küsitud autori ainult **3/10** juhul. Seitsmel juhul domineeris vale koondartikkel `Sotsiaaltöö ajakirja kujundanud inimesed`; vestlus vastas valdavalt vale keeldumisega.
- Laias sünteesis tuli küll palju eri pealkirju, kuid mitmel juhul olid enamik neist küsimuse suhtes valed KOV-i määrused või üksikud kõrvalallikad. Pealkirjade arv ei tõenda allikate sisulist mitmekesisust.
- Lokaalne paranduskandidaat parandas autoriraja kontrollvalimis otsingu **10/10**, samuti MAPPA, erihooldekodude, lapse eraldamise, inimarengu aruande ja V03 supervisioonifakti kontrollitud lühivariandid. S02 ajakirjasüntees leidis pärast parandust algse küsimuse ning kahe teise loomuliku sõnastusega mitu sisulist ajakirjaallikat ilma KOV-i määrusteta. See ei ole siiski kogu 75 juhtumi ega autentitud vestluse 10/10 lõppvärav.
- Parandatud autentitud `/vestlus` 75 juhtumi rada jäi teadlikult **NOT_PROVEN**: kasutaja seadis commit'i, push'i ja deploy tingimuseks juba enne avaldamist tõendatud 10/10 tulemuse. Otsingukandidaadi jääkviga katkestas selle värava enne avaldamist; tootmist ei kasutatud ringtõendina.

## Mõõdetud toodanguseis

Mõõtmise alguses ja lõpus kontrolliti seisu käsuga, mitte dokumendi väite järgi.

| kontroll | tulemus |
|---|---|
| eraldatud worktree HEAD | `e580be85c76fe3f2be19249198f3d4bc2aed059f` |
| `origin/main` | sama SHA |
| server `/home/ubuntu/apps/sotsiaalai` | sama SHA, `main`, jälgitud muudatusi 0 |
| RAG health | `ok`, 49 727 vektorlõiku, 6089 registridokumenti |
| teenused | frontend, RAG ja research worker `active` |
| aktiivsed `sotsiaaltoo_articles` registrikirjed | **877** unikaalset aktiivset artikli-ID-d |
| aktiivsed ilma `MÕTISKLUSI` kogumiku 13 kirjeta | **864** |

Lähteülesandes toodud **49 727** lõiku sai kinnituse. Toodud **863** aktiivset Sotsiaaltöö dokumenti ei saanud samal kujul kinnitust: praegune registri read-only loendus andis 877 aktiivset kirjet ja 864 pärast 13 `MÕTISKLUSI` kirje eemaldamist. Seega on 863 ja praeguse registri vahel vähemalt ühe kirje definitsiooni-/seisulahknevus; seda ei peideta ümardamisega.

Algse 75 juhtumi tootmismõõteakna sees toodang ei muutunud: lõppmõõtmine 22.08.2026 kell 06:20:35 kinnitas sama serveri-, origin- ja worktree-SHA ning sama health-loenduse.

Paranduskandidaadi järelkontrolli ajal tootmine muutus ja see fikseeriti eraldi:

| UTC aeg | vaadeldud seis |
|---|---|
| 03:51:44 | server ja `origin/main` olid liikunud SHA-le `9a458822d26c73f29929c2b3d68e47a4c83d9114` |
| 04:28:32 | server ja `origin/main` olid SHA-l `052db1fa07746b41829ad4057cdcd19f1d9e23fd` |

Vahepealsed commit'id olid `9a458822` (workspace'i ruumidoki/UI muudatus), `8e09478a` (vestluse Realtime-hääleraja sidumine olemasoleva vastuserajaga) ja `052db1fa` (seisudokument). Algne tootmismõõtmine jääb seetõttu commit'i `e580be85` tõendiks. Paranduskandidaat jäi teadlikult samale lähte-SHA-le ning seda ei esitata uue tootmis-SHA autentitud vestluse tõendina.

## Meetod ja hindamisreeglid

Küsimused koostati enne vastuste hindamist kohalike algmaterjalide põhjal kaustast `C:\Users\rauds\sotsiaal.ai\Andmebaas\ajakiri_sotsiaaltoo`, repo failist `docs/sotsiaalhoolekandeseadus.txt` ning kümne mitteajakirja materjali olemasolevast algallikaga seotud kvaliteediväravast. RAG-i vastuseid ei kasutatud kontrollfaktide loomiseks.

Valim:

1. 22 ajakirja faktiküsimust 2016–2026;
2. 8 sama fakti sõnastusvarianti;
3. 10 autoripäringut;
4. 10 laia mitme allika sünteesiküsimust;
5. 15 uuringu, juhendi, töölehe, ametliku infomaterjali või muu mitteajakirja küsimust;
6. 10 KOV-i, teenuse või õigusallika küsimust.

Otsingutaseme PASS eeldas, et õige fakt leidus valitud kontekstis. Ainult õige pealkiri ei olnud piisav. Sünteesiküsimuses hinnati asjakohaste allikate, mitte unikaalsete pealkirjade arvu. `partial=false` on teenuse tehniline lipp, mitte kvaliteedihinne.

Vestlusetaseme õige vastus pidi kasutama kontrollitud tõendit, hoidma arvud ühe allika sees, atribueerima väite õigesti ja võimaldama allika kontrollimist. Vastused saadeti üksteise järel samas vestluses kuni toodangu piiranguni; `Uus vestlus` workaround'i ei kasutatud põhimaatriksi tulemuste parandamiseks.

## Testimaatriks

Lühendid: `P` = PASS/õige, `p` = PARTIAL/osaline, `F` = FAIL/vale, `RL` = rate-limit, `NP` = NOT_PROVEN. Aeg `otsing / esimene tekst / lõpp` millisekundites. `—` tähendab, et täpset mõõdikut ei saanud säilitada; sisu kontrolliti hiljem DOM-ist.

### Ajakirja faktid 2016–2026 (22)

| ID | kontrollfakt / küsimuse tuum | otsing: tulemus, ms | vestlus: tulemus, esimene/lõpp ms | täpne tähelepanek |
|---|---|---:|---:|---|
| J01 | MAPPA sagedus; Rakvere 5, Jõhvi 7, Narva 5 | P, 3121 | F, 14984/15604 | ütles, et sagedust pole; andis Jõhvi 7 ja Rakvere 5, Narva kohta keeldus |
| J02 | erihooldekodud 25% / 45% / 30% | P, 4309 | F, 2946/3824 | vale keeldumine, kuigi otsingus olid kõik kolm arvu |
| J03 | vaimse tervise kriisi tunnused; 112 ja 1220 | P, 793 | P, 2921/3778 | faktid säilisid |
| J04 | Perepesad: Põltsamaa, Türi, Viljandi ja 4 ülesannet | P, 896 | P, 11655/12478 | vastus kattis faktid |
| J05 | taastav õigus: 30/12 ja 60/19 | P, 2051 | P, 4832/5283 | arvud säilisid |
| J06 | teenusmaja 12–30; 12 arengukava; kõik kavatsesid | P, 1278 | P, 3964/4853 | tekstiline viide, kontrollitav allikakaart puudus |
| J07 | vabatahtlikud: 678, 273, 21 600 h, 12, 43 | P, 1584 | F, 11335/13381 | vastus asendas põhinäitajad 300/130-ga; 12 ja 43 jäid |
| J08 | hoolduskoormus 61/26/11/18% | P, 2959 | P, 5827/6527 | hilisem täielik DOM kinnitas lõpu; esmane näiline katkemine oli mõõtja artefakt |
| J09 | kiusamine 33/13/19/7% | P, 2440 | P, 9289/9980 | arvud säilisid |
| J10 | dementsus 150/75; 7–8 h; 2–5 korda | P, 1142 | P, 3313/3793 | faktid säilisid |
| J11 | töötamise toetamise intervjuud: 7; 6 individuaalset + 1 kolmeliikmeline rühm; 3-etapiline temaatiline analüüs | P, 1286 | F, 9972/10837 | segas teise uuringu 17/18 ning ütles 6 intervjuud, neist 5 individuaalset; analüüsimeetod puudus |
| J12 | 2017 igas maakonnas 5 supervisioonikohtumist | P, 2840 | P, 3224/3510 | vastas 5, lisas põhjendatud sihtrühma täpsustuse |
| J13 | noored 13–18; tavaliselt 3–5 probleemi | P, 1783 | p, 3578/4069 | vanus õige, probleemide arv jäeti ütlemata |
| J14 | Saue üle 5800 elaniku; 90% eestkostejuhtumitest kohtusse | P, 3654 | F, 2299/3194 | vale keeldumine |
| J15 | Rakvere 7 töötajat; 3 lastekaitses; 2 toetusi menetlemas | P, 1743 | F, 2841/3909 | vale keeldumine |
| J16 | Saaremaa: esimene ja teine COVID-laine; tervishoiu ja sotsiaalhoolekande lõimimine | F, 988 | p, 35484/36549 | lained õiged, korraldussoovitus puudus; esimese tekstini 35,5 s |
| J17 | 169 lapse eraldamise otsust 2018. aasta juhtumitest | P, 952 | F, 23117/23827 | vale keeldumine |
| J18 | eestkostetavate osalus: 5 igast rühmast, 15 kokku | F, 3487 | F, 7980/10408 | segas EPIKoja teise uuringu 32/42 valimi |
| J19 | inimarengu aruanne 380 lk, 71 teadlast, 4 stsenaariumi | P, 1405 | P, 3821/4351 | faktid säilisid |
| J20 | seadusemuudatused 2023 kevad/suvi ja jaanuar 2025 | F, 1291 | F, 22992/23864 | vale keeldumine |
| J21 | eakate vägivald: 10%/640, 6%/227, 2%/100 | P, 1429 | F, 8873/9523 | vale keeldumine |
| J22 | e-kursuse järelhindamine 6 kuu pärast; osaleja ja tööandja vaade | P, 1428 | F, 6639/7093 | vale keeldumine |

### Sõnastusvariandid (8)

| ID | küsimus | otsing | vestlus | järeldus |
|---|---|---:|---:|---|
| V01 | „MAPPA kohtumised – kui tihti ja mitu neid kolmes Virumaa linnas oli?” | F, 1585 | F, 8295/9360 | sama viga teise sõnastusega |
| V02 | „Mis olid erihooldekodude kaardistuse kolm protsenti?” | F, täpne aeg ei säilinud | F, 8434/8978 | lühike vorm kukutas sihtlõigu; õige artikkel üksi ei aidanud |
| V03 | „Palju neid supervisioone maakonna kohta tehti?” | P, 604 | F, 4447/5748 | asesõnaline lühivorm sai vale 420/100/4 piirkonda konteksti |
| V04 | „Eakate vägivallauuring: mis olid ... näidud?” | P, 2008 | F, 9982/10900 | vale keeldumine |
| V05 | „E-kursuse järelmõju – millal ja kelle hinnangud?” | P, 2359 | F, 7383/8351 | segas LSV kursuse ja töötukassa uuringu |
| V06 | „Laste eraldamise otsused: arv ja aasta?” | P, 1292 | F, 3642/4130 | enesekindel vale: 58 otsust / 72 last / 2023 |
| V07 | „Inimarengu aruanne: leheküljed, autorite arv ja stsenaariumid?” | P, 2718 | F, 7061/7902 | algküsimus J19 oli õige, lühivariant tõi vale 2014/2015 aruande |
| V08 | „Mis linnades Perepesad olid ja mida need tegid?” | P, 906 | P, 3674/6108 | tuumik õige, lisas hilisemaid asukohti ja palju kõrvalinfot |

### Autoripäringud (10)

Kontrollallikaks olid vastavate artiklite lokaalsed JSON-kirjed ja tekstid. Otsingu PASS nõudis küsitud autori enda artiklit, mitte nime esinemist teda käsitlevas loos.

| ID | autor | otsing | vestlus | tähelepanek |
|---|---|---:|---:|---|
| A01 | Krister Tüllinen | F, 665 | F, —/— | vale koondartikkel domineeris; vestlus ütles, et autorit pole |
| A02 | Maarja Krais-Leosk | P, 630 | P, —/— | leidis vähemalt osa autori teemadest; ajamõõt virtualiseerimise tõttu NP |
| A03 | Kadi Lubi | F, 719 | F, —/— | vale keeldumine; ajamõõt NP |
| A04 | Ave Ungro | F, 638 | F, 4609/4886 | vale keeldumine |
| A05 | Jane Langemets | F, 688 | F, 3464/3912 | vale keeldumine |
| A06 | Liina Lokko | F, 638 | F, 2914/3154 | vale keeldumine |
| A07 | Kadri Kuulpak | P, 676 | P, 3336/5209 | mitu autori lugu, sisuline teemakokkuvõte |
| A08 | Merle Tomberg | F, 732 | F, 3095/3527 | vale keeldumine |
| A09 | Heli Ferschel | F, 702 | F, 3278/3742 | vale keeldumine |
| A10 | Judit Strömpl | P, 703 | P, 3232/4543 | eristas Strömpli enda teksti ja teda intervjueeriva loo autorit |

Seitsmel FAIL-juhul oli esimeste kohtade tüüpiline vaste `Sotsiaaltöö ajakirja kujundanud inimesed`, mitte küsitud autori artikkel. See on süsteemne järjestus-/metaandmeprobleem.

### Lai mitme allika süntees (10)

| ID | teema | otsing: hinnang, ms, asjakohased allikad | algse vestluse tulemus |
|---|---|---|---|
| S01 | deinstitutsionaliseerimine ja kogukonnahooldus 2017–2026 | p, 2479; 2016–2018 artiklid, aga ka valed SHS/KOV read; 2026 puudus | RL |
| S02 | töötajate turvalisuse probleemid ja lahendused | F, 2212; üks 2026 artikkel domineeris, kõrval peamiselt teemavälised allikad | RL |
| S03 | vabatahtlike roll ja tulemused | F, 2027; ainult üks otseselt teemakohane artikkel | RL |
| S04 | hoolduskoormuse vähendamise lahendused | F, 1779; üks 2017 artikkel + valdavalt KOV määrused | RL |
| S05 | vaimse tervise kriisi märkamine ja abi | F, 1814; üks 2018 artikkel + valdavalt KOV teenusesätted | RL |
| S06 | lapse osalusõigus | P, 1535; 6 sisuliselt seotud allikat 2016–2025 | NP algses vestluses |
| S07 | taastava õiguse rakendusviisid | P, 1985; 6 teemakohast artiklit | NP |
| S08 | Saaremaa COVID ja kriisivalmidus | p, 2297; mitu teemakohast artiklit, lisaks kaks valet KOV sätet | NP |
| S09 | digilahendused ja tehisaru | F, 1831; küsimusele vastavad artiklid puudusid, KOV määrused domineerisid | NP |
| S10 | supervisioon, mentorlus ja heaolu | P, 2291; vähemalt 6 teemakohast allikat | NP |

Kasutaja avas hiljem ise `Uus vestlus`. Taastumiskatses S06-R tuli vastus 6804/13877 ms, kuid kasutaja märkis selle õigesti valeks. Vastus nimetas 2025. aasta eraldi juhendit Sotsiaaltöö artiklite sünteesi sees, segas allikatüüpe ning esitas mitu laia üldistust ilma kontrollitava allikaloendita. Seda ei loetud põhimaatriksis edukaks ega kasutatud algse sama-vestluse nõude asendusena.

### Mitteajakirja materjalid (15)

| ID | allikas / teema | otsing | vestlus |
|---|---|---:|---:|
| M01 | EPIKoda uuringu meetod, aeg ja 42 osalejat | P, 5051 | P, 8840/11068 |
| M02 | EPIKoda soovitused Tallinnale | P, 3354 | P, 7322/9344 |
| M03 | terviseprobleemiga laste perede hea tava | P, 3715 | P, 5626/6919 |
| M04 | tuleohutus hoolekandeasutuses | P, 5449 | p, 11010/13294; evakueerimisega alustamine jäi välja |
| M05 | õpilase vahetu või kodune oht | P, 760 | P, 2354/6126 |
| M06 | seksuaalvägivalla kriisiabikeskused | P, 2690 | F, 10510/11176; vale keeldumine |
| M07 | Tarkvanema vestlustööleht | P, 2243 | P, 15474/16036 |
| M08 | õpitulemuste vähendamine/asendamine/vabastamine | P, 2832 | P, 5947/10160 |
| M09 | abivajavast lapsest teatamine ja anonüümsus | P, 3422 | P, 6931/8961 |
| M10 | OSKA hooldustöötajate arvud | P, 1739 | P, 7714/8953 |
| N11 | SHS § 15 hindamine ja abiotsus | F, 3199; valed samanimelised § 15 alamkirjed ees | NP |
| N12 | SHS § 17 koduteenuse eesmärk ja toimingud | p, 2608; sisuliselt samad KOV sätted, riiklik säte ei olnud tipus | NP |
| N13 | SHS § 20 üldhooldusteenus | p, 3405; riiklik säte alles 5. kohal | NP |
| N14 | SHS § 21 hooldusplaan: 30 päeva ja poolaasta | P, 3235 | NP |
| N15 | SHS § 22 hooldustöötaja 3 ettevalmistusviisi | P, 1156 | NP |

### KOV, teenus ja õigusallikas (10; eraldi rada)

| ID | küsimus | otsing | vestlus |
|---|---|---:|---:|
| K01 | Kuusalu koduteenuse taotlemine ja § 6 | P, 2203 | NP |
| K02 | Narva koduteenuse taotlemine | p, 1683; Narva-Jõesuu määrus hõivas kohad 1–3, Narva koond alles 6. | NP |
| K03 | koduteenus vs tugiisikuteenus | P, 1473; SHS § 17 ja § 23 vastavalt 1. ja 3. | NP |
| K04 | Luunja teenuste ja toetuste loend | P, 1360 | NP |
| K05 | Tartu sotsiaaltransport | p, 920; üldine teenuseleht, Tartu atribuutika polnud tulemuspealkirjas kinnitatud | NP |
| K06 | Järva valla vaimse tervise teenus | P, 996 | NP |
| K07 | SHS § 15 hindamiskohustus ja otsus | P, 1984 | NP |
| K08 | SHS § 17 koduteenus | P, 985 | NP |
| K09 | SHS § 23 tugiisikuteenus | P, 973 | NP |
| K10 | SHS § 27 isiklik abistaja | P, 943 | NP |

Kõigi otsingute tehniline `partial` lipp oli `false`, sealhulgas sisuliselt ebaõnnestunud otsingutel. Seega ei ole `partial=false` usaldusväärne kvaliteedisignaal.

## Ajamõõdikud

- Otsese otsingu teenuseaeg oli mõõdetud juhtumites ligikaudu **604–5449 ms**. Kõige aeglasem oli tuleohutuse materjal 5449 ms.
- Esimese 20 autentitud juhtumi esimene tekst saabus **2354–15474 ms** ja lõppvastus **3778–16036 ms**.
- J16 esimene tekst saabus alles **35 484 ms** ja lõppvastus 36 549 ms: tehnilist timeout'i ei kuvatud, kuid viivitus on kasutaja jaoks ebamõistlik.
- J17 ja J20 esimese tekstini kulus vastavalt 23 117 ja 22 992 ms.
- Kolme autoripäringu A01–A03 täpsed UI-ajad on NOT_PROVEN: pika vestluse DOM virtualiseeris vanu artikleid ning esimene mõõtja kasutas ekslikult artiklite arvu. Vastuste sisu loeti hiljem täielikust DOM-ist; ajamõõdikuid ei tuletatud kellaaja siltidest.
- Pärast 50 sisulist vastust sai algne vestlus püsiva `Liiga palju paringuid` vea. Viimane edukas serveri `request.start` oli 06:11:48. Viga püsis ka pärast eraldi 55-sekundilist pausi ning 06:19 kontrolli, kuigi juurutatud koodi vaikimisi piir on 24 POST-i / 60 s ja protsessi nähtavas keskkonnas polnud `CHAT_RATE_LIMIT_*` ülekirjutust. Täpne runtime-juurpõhjus jäi NOT_PROVEN.

## Valed vastused ja veaklassid

### 1. Vale kindel vastus

- V06: `58 lapse perest eraldamise otsust`, `72 last`, `2023`; kontrollfakt oli 169 otsust 2018. aasta juhtumitest.
- J07: 678 inimese ja 273 vabatahtliku asemel rääkis vastus 300 kavandatud inimesest ja 130 osalejast.
- J18: 5+5+5 valimi asemel anti teise EPIKoja uuringu 32/42 arvud.

### 2. Vale keeldumine / „materjali pole”

J02, J14, J15, J17, J20, J21, J22, M06 ja enamik autoripäringuid keeldusid, kuigi otsene otsing või kohalik algallikas kinnitas vajaliku tõendi. See klass on kasutajale ohtlikum kui nähtav otsinguviga, sest tekitab vale mulje korpuse puudulikkusest.

### 3. Õige allikas, vale või puuduv lõik

V02 erihooldekodude lühiküsimus tõi õige artikli, kuid mitte 25/45/30% sihtlõiku. J16 ja J20 tõid õige dokumendi osi, kuid mitte kõiki küsitud fakte. Õige pealkiri ei olnud edu.

### 4. Õige otsing, vestlus jätab tõendi kasutamata

J01, J02, J07 ja M06 läbisid otsese faktivärava täielikult, kuid vestlus vastas valesti. Lisajuhtum `Kes on Laur Raudsoo?` on eriti selge:

- otsene otsing: 792 ms, `partial=false`; 1. kohal 2025 tehisintellekti artikkel, 2. kohal 2018 ajakirja arengu lugu, lisaks 2017, 2018 ja 2019 autorsus;
- vestlus: taandas isiku üksnes 2018. aasta tegevtoimetaja rollile ja juubeliloole;
- kohalik algtekst toetab ajaloolist tegevtoimetaja rolli, kuid ei toeta seda kui ammendavat vastust küsimusele „kes on”; otsing ise sisaldas uuemat ja mitmekesisemat tõendit.

See on kontekstivaliku/vastuse koostamise, mitte korpuse puudumise viga.

### 5. Vale või puuduv atribuutika

Kõigi 50 sisulise vastuse juures puudusid ligipääsetavad allikalingid. S06-R nimetas eraldi 2025 juhendit Sotsiaaltöö artiklite sünteesis, märkimata selgelt allikatüübi vahet. Laur Raudsoo vastus muutis ühe ajaloolise rolli isiku tänaseks identiteediks.

### 6. Ühe allika domineerimine laias sünteesis

S02–S05 otsingutes hõivas üks teemakohane artikkel mitu kohta ning ülejäänud tulemused olid valdavalt juhuslikud KOV määrused. Unikaalsete pealkirjade arv 8–12 varjas seda, et sisulisi allikaid oli 1. S09 digilahenduste/tehisaru küsimuses puudus teemakohane artiklikogum sootuks.

### 7. Timeout, partial ja viivitus

RAG teenuse `partial` jäi alati vääraks (`false`) ka sisulise katvuse puudumisel. J16 ületas esimese tekstini 35 s. Algne vestlus jäi pärast 50 vastust püsivasse rate-limit olekusse. Tehnilise lipu roheline seis ei kajasta ühtegi neist.

### 8. Sõnastustundlikkus

Veaklass reprodutseeriti vähemalt kahe sõnastusega:

- MAPPA: J01 ja V01 mõlemad valed;
- erihooldekodud: J02 ja V02 mõlemad valed, lühivariandis kadus sihtlõik;
- supervisioon: J12 õige, V03 vale;
- eakate vägivald: J21 ja V04 valed;
- e-kursuse järelmõju: J22 ja V05 valed;
- lapse eraldamise otsused: J17 keeldus, V06 andis enesekindla vale;
- inimarengu aruanne: J19 õige, V07 vale.

## Kihiline juurpõhjuse diagnoos

### Korje / indeks

- Indeks on kättesaadav ja mahult stabiilne, kuid aktiivsete ajakirjakirjete loendus ei ühti dokumenteeritud 863-ga.
- Vana prefiksiga vektorid, artiklitaseme korduv ankur ja dokumenditaseme autorimeta vähendavad lõikude ning autorite eristatavust. Varasema 98 leiu koodiuuskontrolli järgi on `author-attached-at-document-level-only`, `prefix-kills-intra-article-discrimination` ja reindeksi artiklisegmenteerimist lõhkuv rada endiselt olemas või osaliselt alles.
- Reindeks ei ole selle auditi soovitus „kohe teha”: olemasolev üldine reindex-rada võib ajakirjanumbri artiklipiirid kaotada. Vajalik on eraldi, taastatav `ingest_articles`-põhine plaan.

### Planner / päringu koostamine

- Lühikesed ja asesõnalised küsimused lähevad teise harru. J19→V07 ja J12→V03 näitavad, et sama fakt ei ole parafraasistabiilne.
- Juurutatud kood liidab kontekstisõltuvaks peetud lühikesele pöördele varasemat vestlusajalugu. Pikas 50-pöördelises testis on see süsteemne mürategur, mitte kasutaja workaround'i vajadus.
- Lai küsimus seab `journal_chunks_per_document=3` ning jätab kitsale faktipäringule mõeldud dokumendisisese katvuseharu välja. See vastab S02–S05 ühe-allika dominantsile.

### Järjestus

- Autoripäringu nime esimene sõna ei saa nimeüksuse heuristikas sama kaalu; leksikaalne ja title-match rada tõstsid seitse korda sama koondartikli küsitud autori enda teksti ette.
- KOV-is on kohanime kollisioon: `Narva` küsimuse ette tulid `Narva-Jõesuu` sätted.
- Laiades küsimustes tekitas pealkirja/BM25 rada palju vormiliselt kattuvaid, kuid sisuliselt valesid KOV määrusi.

### Kontekstivalik

- Otsese värava PASS ja vestluse FAIL tõendab, et kogu `/search` tulemuste hulgas olev tõend ei jõua tingimata mudeli kasutatavasse konteksti.
- Koodiuuskontroll kinnitab endiselt `budget-break-not-continue`, piiratud kehade arvu, katkestatud prefiksi eemaldamise ja snippeti dedupe'i riske. Need on vaadeldud tõendi kaotusega kooskõlas; ühe konkreetse vastuse täpset kärpekohta ei saanud praegusest UI-st tõendada.
- Sünteesis valitud aastate/allikate arv ja päriselt konteksti mahtunud aastad võivad erineda. Serverilogis nähtud juhtumil olid valitud aastad mitmekesised, `contextYears` aga ainult `[2026]`.

### Vastuse koostamine

- Mudel asendas puuduva sihtlõigu kõrvalallika arvudega (J07, J18) või keeldus hoolimata olemasolevast tõendist.
- Puudub toimiv enne-vastust katvusvärav, mis nõuaks küsitud arvude pärinemist samast teemakohasest allikarühmast.
- Allikate UI ei võimalda kasutajal kontrollida, millised rühmad tegelikult vastusesse jõudsid.

## Paranduskandidaadi järelkontroll

Paranduskandidaat loodi ainult eraldatud worktree's. Python RAG-teenuse kandidaat töötas serveris ajutises kaustas, ainult `127.0.0.1:8011` peal ja toodanguindeksi read-only testkoopiaga. Toodangu RAG jäi pordile 8000 ning tema protsessi, faile, indeksit ja keskkonda ei muudetud.

Järelmõõtmise lõpus peatati kandidaat ja kustutati ainult seire jaoks loodud serveri ajutine kaust koos 2,7 GB indeksikoopiaga; samuti eemaldati kohalik ajutine indeksikoopia ja testisõltuvuste kaust. Need koopiad ei ole taastatavad, kuid nende algallikas ehk toodanguindeks jäi puutumata.

Kandidaadis tehti üldised, mitte üksikküsimuse järgi hardcode'itud parandused:

- eraldi `person_source_lookup` plaan, täpne autorimeta kanal ja autorluse eelistamine nime mainimisele;
- lühikese faktipäringu tiitliankur, aktiivse versiooni filter ja sama dokumendi lõikude sügavam valik;
- arvulise faktikuju märge ning ühe allikarühma arvukatvuse kontroll;
- sünteesi kompaktsem kontekstipakkimine ja dokumendimitmekesisuse säilitamine;
- vana sünteetilise prefiksi eemaldamine nii, et sama artikli eri lõigud ei variseks dedupe'is üheks;
- vestluse vaikimisi seansipiir 50 → 200, eraldi piiratud keskkonnaülekirjutusega;
- iga vastuse oma semantiline `<details>` allikaloend päris linkidega.

### Kandidaadi otsene RAG-järelmõõtmine

See tabel ei asenda algset 75/75 toodangumaatriksit. See kontrollib parandatud veaklasse täpselt sama indeksi koopia vastu. PASS nõudis endiselt faktiga lõiku, mitte ainult õiget pealkirja.

| juhtum / klass | tulemus | mõõdetud tõend |
|---|---|---|
| A01–A10 autoripäringud | **10/10 PASS** | kõigil juhtudel jõudis täpse autorimeta vaste ettepoole; valed mainimis- ja juubeliloo vasted ei tõrjunud autori enda artiklit valitud autorikontekstist välja |
| Laur Raudsoo | **PASS** | esile tulid Laur Raudsoo enda 2025., 2019., 2018. ja 2017. aasta allikad; varasem vale „2018 tegevtoimetaja” koondvastus ei ole enam otsingukonteksti ainus alus |
| V01 MAPPA | **PASS**, 1549 ms | valitud lõik sisaldas `vähemalt kord nelja kuu jooksul`, Rakvere 5, Jõhvi 7 ja Narva 5 |
| V02 erihooldekodud | **PASS**, 2899 ms | valitud sama artikli lõik sisaldas 25%, 45% ja 30%; `partial=false` |
| V06 lapse eraldamine | **PASS**, 5648 ms | valitud lõik nr 7 sisaldas `169` ja `2018`; vale 58/72/2023 allikas ei olnud ees |
| V07 inimarengu aruanne | **PASS** | õige 2023. aasta Merike Sisaski artikli valitud lõigud sisaldasid 380 lehekülge, 71 autorit ja tulevikustsenaariume |
| V03 supervisioon | **PASS**, 5167 ms | 2017. aasta `Ministeerium toetab` artikkel oli esimene; valitud lõik nr 2 sisaldas aastat, iga maakonda ja viit rühmasupervisiooni kohtumist; kanalid `bm25` + `registry_fact`, `partial=false` |
| S02 töötajate turvalisuse süntees | **PASS sihitud otsinguväravas**, 2426 ms | esimese kaheksa sees olid neli sisulist dokumenti: 2026 töötajate turvalisus, 2024 töötingimused, 2023 klientide vägivald ja 2018 töötajate huvid/toetus; KOV-i määrusi ei olnud, `partial=false` |
| S02 sõnastusvariant 1: „eri lugudes … kaitsest, vägivallast ja tööheaolust” | **PASS**, 621 ms | samad neli sisulist allikat esimese 13 seas; teistsugune allikasõna ja teematerminid ei viinud planner'it vaikimisi ega KOV-i rajale |
| S02 sõnastusvariant 2: „mitme … teksti põhjal … ohutusest, riskidest ja toest” | **PASS**, 732 ms | esimese kümne sees olid 2026 turvalisus, 2024 töötingimused, 2023 SKA tugi, 2016 tööalane toetus ja 2018 huvid/toetus; `partial=false` |

V03 kontrollfakt kinnitati algallikast `17-1/ministeerium-toetab-2017-1.json`: 2017. aastal kavandati igas maakonnas viis rühmasupervisiooni kohtumist. Algne FAIL oli korje/järjestuse, mitte ebaselge kontrollvastuse ega puuduva metaandme viga. S02 kaks lisavarianti olid enne üldist päringuklassi parandust punased; seega ei põhine tulemus ühe kontrollküsimuse sõnade hardcode'imisel.

### Kandidaadi automaatkontroll ja selle piir

| kontroll | tulemus |
|---|---:|
| RAG leksikaalse korje ja järjestuse sihttestid | **48/48 PASS** |
| vestluse planner'i, otsingu, konteksti, atribuutika, allikaloendi, U8 ja 75-pöörde sihttestid | **186/186 PASS** |
| muudetud JS/JSX failide ESLint | vigu 0; pärast lõppkorrektsiooni hoiatusi 0 |
| `git diff --check` | vigu 0; ainult Windowsi rea-lõpu informatiivsed hoiatused |
| kogu olemasolev 4931 testi sviit | **NOT_RUN** |

Rohelised 234 sihttesti tõendavad konkreetseid koodilepinguid, mitte RAG-i sisulist 10/10 töökindlust. Täissviiti ei kasutatud sisukvaliteedi asendustõendina. Kandidaadi parandatud veaklassid on sihitud otsinguväravas rohelised, kuid kogu 75 juhtumi otsing ja sama kandidaadi autentitud vastamiskiht on endiselt tõendamata.

### 10/10 avaldamisvärav

| värava osa | seis | põhjus |
|---|---|---|
| paranduskandidaadi kogu 75 juhtumi otsene otsing | **NOT_PROVEN** | parandatud veaklasside 16 põhijuhtumit on otsingukihis rohelised, kuid kogu muutumatu kandidaadi 75/75 kordus on tegemata |
| paranduskandidaadi 75 juhtumit samas autentitud vestluses | **NOT_PROVEN** | kandidaati ei deploy'tud ning sama vestluse patched runtime'i ei asendatud tootmisega |
| allikaloendi päris brauserikäitumine kandidaadis | **PARTIAL** | semantiline renderdus ja lingid on testitud, kuid autentitud deploy-järgne brauserirada puudub |
| commit | **EI TEHTUD** | 10/10 eeltingimus ei täitunud |
| push | **EI TEHTUD** | 10/10 eeltingimus ei täitunud |
| deploy | **EI TEHTUD** | 10/10 eeltingimus ei täitunud |

Järeldus: paranduskandidaat lahendab mitu tõendatud veaklassi, kuid kogu RAG-süsteemi hinne ei ole 10/10. Kandidaadi avaldamine oleks kasutaja seatud värava rikkumine.

## Prioriteedid ja järgmised põhjusepõhised parandused

1. **P0 – faktikatvuse värav enne vastust.** Arvuküsimuse vastus tohib kasutada arve ainult samast teemakohasest allikarühmast; puuduva katvuse korral ei tohi kõrvalaruande protsente asendada.
2. **P0 – allikate kuvamine tööle.** Iga sisuline väide peab olema seotud nähtava, avatava allikakaardiga. Nupu olemasolu ilma avaneva sisuta ei ole atribuutika.
3. **P0 – sama vestluse rate-limit runtime-lahknevus.** Logida tegelik scope, limit, window, remaining ja `Retry-After` ilma kasutaja/IP väärtust avaldamata; kinnitada, miks 60 s vaikeaken ei taastunud vähemalt seitsme minuti jooksul.
4. **P1 – autoripäringu autentitud vastamisvärav.** Otsingu 10/10 sihtvalim on roheline; kinnitada nüüd, et vastuse koostamine kasutab autorimeta tõendit ega taanda inimest vale koondartikli rolliks.
5. **P1 – faktipäringu parafraasimaatriks.** Dokumendisisene järelotsing ja registrikirjelduse ankur on sihttestis olemas; korrata vähemalt pika, lühikese ja teise sõnavaraga küsimusega üle kõigi parandatud faktiklasside.
6. **P1 – laia sünteesi päris mitmekesisus.** S02 otsing on kolme sõnastusega roheline; kinnitada kogu kümne sünteesiküsimuse peal, et konteksti valik ja lõppvastus säilitavad mitu teemakohast dokumenti, mitte mitu sama dokumendi lõiku.
7. **P1 – ajaloo mõju nähtavaks ja piiratud.** Logida, milline varasem tekst embeditavasse päringusse lisati; lühike küsimus ei tohi automaatselt saada kuue vana pöörde 4200-märgilist saba.
8. **P2 – loenduse definitsioon.** Selgitada 863 vs 877/864; valida üks kanoniline aktiivse ajakirjaartikli definitsioon ja teha health/registry raportis nähtavaks.
9. **P2 – parafraasipaarid evali põhiosaks.** Iga fakt vähemalt pikk, lühike ja käändeline variant; edu mõõta sihtlõigu ja vastuse, mitte pealkirja järgi.

Üksikküsimuse hardcode ei lahenda ühtegi neist klassidest.

## DONE / PARTIAL / NOT_PROVEN

Need arvud kirjeldavad **mõõtmise valmidust**, mitte RAG-i kvaliteediprotsenti.

| seis | arv | tähendus |
|---|---:|---|
| DONE | **50/75** | mõlemad tasemed mõõdeti algses samas autentitud vestluses; neist ainult 21 olid end-to-end õiged |
| PARTIAL | **5/75** | otsing mõõdeti, vestluskatse tehti, kuid toodang tagastas ainult rate-limit vea |
| NOT_PROVEN | **20/75** | otsing mõõdeti, autentitud vestlus jäeti püsiva piirangu tõttu teadlikult käivitamata |

Kvaliteedi lõppvaade eraldi:

| kiht | õige/PASS | osaline | vale/FAIL | piirang või tegemata |
|---|---:|---:|---:|---:|
| otsene otsing | 51 | 6 | 18 | 0 |
| autentitud vestlus | 21 | 3 | 26 | 25 |

Seega on tõendatud vaid **21 end-to-end õiget juhtumit 75-st**, kuid seda arvu ei tohi kasutada väitena „RAG on 28% töökindel”: 25 juhtumi vastamiskiht on tõendamata, valim on sihipäraselt kihiline, kategooriate raskus erineb ning sama vestluse pikkus paljastas eraldi planner'i ja rate-limit riskid.

Paranduskandidaadi lõppvärav eraldi:

| seis | arv | tähendus |
|---|---:|---|
| DONE | **0/75** | ühtegi juhtumit ei loeta paranduskandidaadi end-to-end DONE-ks enne sama kandidaadi autentitud vestluse mõõtmist |
| PARTIAL | **16/75** | A01–A10, V01, V02, V03, V06, V07 ja S02 mõõdeti paranduskandidaadi otsingukihis ning kõik 16 läbisid sihitud värava; autentitud vastamiskiht on endiselt tõendamata |
| NOT_PROVEN | **59/75** | paranduskandidaadi täielik otsingu kordus ja kogu autentitud vastamiskiht jäid tõendamata |

Omaniku tõstatatud Laur Raudsoo reprodutseerimiskatse ei kuulu 75 põhijuhtumi hulka ja on tabelis eraldi. Nii ei paisuta lisakontroll põhimaatriksi nimetajat.

## Jääkriskid

- täpne UI-s kasutatud kontekstilõik ja kärpekoht ei ole kasutajale nähtav;
- allikakaartide puudumise tõttu ei saa eristada mudeli väidet ja tõendatud allikaväidet;
- aktiivsete ajakirjadokumentide kanoniline arv on lahendamata;
- uue vestluse taastumiskatse ei tõenda algse pika vestluse töökindlust;
- KOV-i kontaktid, tasud ja taotlemisviisid on ajas muutuvad ning vajavad eraldi värskuseväravat;
- `partial=false` ja roheline health ei kata sisulist katvust;
- kogu 4931 testi sviiti ei jooksutatud auditi read-only etapis; pärast V03 ja S02 süsteemsete paranduste sihtväravate läbimist jäi lokaalne kandidaat enne omaniku eraldi deploy-luba avaldamata. 234 rohelist sihttesti ega otsingu PASS ei tõenda veel autentitud vestluse sisulist töökindlust.

## Võrdlusmaterjalid

Kontrolliti ka omaniku viidatud faile `rag-leidude-uuskontroll-2026-08-22.md` ja `rag-otsingu-jaakaugud-2026-08-22.md`. Neid kasutati hüpoteeside ja koodiviidete võrdluseks, mitte uute küsimuste kontrollvastusteks. Käesolev runtime-seire kinnitas nende põhiteesidest sõnastustundlikkuse, õige artikli/vale lõigu, laia raja vähese katvuse, autorimeta nõrkuse, ajaloo lahjenduse ja nähtamatu kontekstikärpe praktilise mõju. Samal ajal korrigeerib käesolev raport varasema `autenditud /vestlus NOT_PROVEN` staatuse 50 tegeliku sisulise vastuse võrra.
