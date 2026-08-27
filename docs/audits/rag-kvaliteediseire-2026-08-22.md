# RAG-i sõltumatu kvaliteediseire toodanguindeksi ja autentitud vestluse vastu

Kuupäev: 22.08.2026

> **Jätkuseis:** see fail säilitab algse auditi ajaloolise lähtejoone ja lisab allpool iga deploy-järgse korduse. Brauseris kontrollitud sisulise RAG- ja vestlusloogika baasseis on `815f15f6`; 23.08 jõudlusparanduse runtime-release oli `5796178f`. Kontrollis olid frontend, RAG ja research-worker aktiivsed ning health näitas 49 727 vektorit / 6089 dokumenti. Süsteemikaart on failis [rag-susteem-2026-08-22.md](./rag-susteem-2026-08-22.md).

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
| olemasolev automaattestisviit | **PUUDUB** |
| selle paranduse jaoks loodud ajutised testid | **PUUDUVAD** |
| muudetud JS/JSX failide ESLint | vigu 0; pärast lõppkorrektsiooni hoiatusi 0 |
| Python AST süntaksikontroll | **PASS** |
| `git diff --check` | vigu 0 |
| lokaalne Next.js Webpacki tootmisbuild | **PASS** |
| serveri ametlik Turbopacki tootmisbuild | **PASS**, 35,2 s |

Projektis ei ole praeguses seisus automaatteste. Seetõttu ei esitata siin ajaloolisi testiarve praeguse kandidaadi tõendina. Eeltoodud kontrollid tõendavad ainult ehitatavust ja staatilisi lepinguid, mitte RAG-i sisulist 10/10 töökindlust. Kandidaadi parandatud veaklassid olid sihitud otsinguväravas rohelised, kuid kogu 75 juhtumi otsing ja sama kandidaadi autentitud vastamiskiht olid enne deploy'd endiselt tõendamata.

### Deploy-järgne autentitud `/vestlus` kontroll

Parandus commit'iti, lükati `origin/main`-i ja deploy'ti omaniku hilisema otsese loa alusel. Testitud commit oli `73d381a7febd017bc32d2a8976da60b2b9c9d42a`; sama SHA kinnitati `origin/main`-is ja serveris 22.08.2026 pärast deploy'd. RAG health näitas 49 727 vektorit ja 6089 registridokumenti. Järgmised päringud tehti päris autentitud `/vestlus` aknas järjest samas vestluses, ilma „Uus vestlus” workaround'ita.

Seire ajal liikus `origin/main` ja server hiljem commit'ile `9cad5105fc30d68f1df7bb084f79a59e68b110d7`, mis muutis ainult hääleavatari binaarfaili ja selle ehitusskripti. Alltoodud RAG-tulemused on fikseeritud testitud commit'ile `73d381a7`; uuem commit sisaldab seda esivanemana, kuid selle vastu ei korratud vestluspäringuid rituaalselt.

| juhtum | küsimus | autentitud vastus | lõpptulemus / kestus | hinnang |
|---|---|---|---:|---|
| J17 | „Kui palju lapse perekonnast eraldamise kohtulahendeid analüüsiti ja mis aastal need lahendid tehti?” | `169` kohtulahendit; `2018. aastal` jõustunud maakohtute lõpplahendid | **PASS**, u 41 s | arv ja andmeaasta säilisid, kõrvalrühma arvu 21 ega allika aastat vastusega ei segatud |
| V06 | „Mitu lapse perest eraldamise otsust uuringus vaadeldi ja mis aasta otsused need olid?” | `169`; `2018`; lisaks eristas 2022. aastal kaitstud magistritöö | **PASS**, u 36 s | teine loomulik sõnastus oli samuti õige; viivitus on ebamõistlik |
| J11 | „Mitu intervjuud tehti töötamise toetamise uuringus?” | „allikakatkenditest ei saa ... piisavalt üheselt kinnitada” | **FAIL**, u 22 s | vale keeldumine; kontrollfakt on 7 intervjuud |
| J11 variant | „Kui paljude intervjuude põhjal tehti Elin Küti kirjeldatud töötamise toetamise uuring?” | `17 intervjuud` ja „lisaks kuus tööandjaintervjuud” | **FAIL**, u 23 s | vale kindel vastus; segas teise töövõimeteemalise uuringu arvud Elin Küti 2016. aasta uuringuga |

Selles algses deploy-järgses katses oli allikanupp J17 ja V06 vastuste juures nähtav, kuid kahes brauserikatses ei avanenud kontrollitavat allikapaneeli ega „Ava allikas” linke. Seetõttu jäi nende vastuste kuvatud atribuutika sel hetkel **NOT_PROVEN**, kuigi vastusetekst ise oli õige. Hilisem SHA `7f3aa503` kordus avas mõlema paneeli ja asendab praeguse release'i arvestuses selle ajaloolise seisu.

J11 vea kihiline tõend:

- algallikas `ajakiri_sotsiaaltoo/10-aastat/10-aastat-sotsiaaltood-eestis-puhtand.html` kinnitab seitset poolstruktureeritud intervjuud: kuus individuaalset ja üks kolme osalejaga rühmaintervjuu;
- loomuliku küsimuse otsene `/search` ei toonud Elin Küti 2016. aasta artiklit esimese 12 tulemuse hulka; `partial=false`, otsingu kogukestused olid vastavalt 6284 ms ja 1256 ms;
- täpse autori, aasta ja artikli pealkirjaga kontrollpäring tõi õige dokumendi kohtadele 1–3, kuid see ei ole tavakasutajale vastuvõetav sõnastusnõue;
- autentitud vestluse logis jäid mõlemad päringud `queryPlanMode: default`, `capability: rag_guidance`; sihtallika 2016. aasta ei jõudnud vastuse `contextYears` hulka;
- sama vestluse järgmistes päringutes näitas logi `hasHistory: true`, kuid `answer.history_selection included: false`. See ei tõenda iseenesest vale vastuse põhjust, kuid tõendab, et vestlusjärjepidevus ei jõudnud vastuse koostamisse.

Seega ei ole J11 ühe arvu valideerimisviga. Süsteemne veaklass on loomuliku parafraasi nõrk korje koos faktiküsimuse planner'i valesti klassifitseerimise ja vale kontekstivalikuga; vastuse koostaja muudab selle ühel juhul valeks keeldumiseks ja teisel juhul enesekindlaks allikaseguks.

### J11 põhjusepõhine P0-paranduskandidaat — 22.08 õhtu

Lisaanalüüs kinnitas, et J11 ei vaja küsimuse sõnade asendamist ega ühe vastuse hardcode'i. Eraldatud tööpuus on nüüd rakendatud üldine ühe uuringu faktirada:

1. planner eristab `specific_research_fact` päringud autori-, sünteesi- ja tavapärasest taustapäringust;
2. esimene lisapäring otsib dokumendi identiteeti autori, teema ja allikaliigi järgi, teine sama dokumendi faktipesa järgi;
3. registri autoriankur lubab konservatiivselt eesti nimekäändeid, näiteks `Kütt` ↔ `Küti`, kuid ei tee globaalset hägust isikuotsingut;
4. kontekstivalik lubab arvulise või meetodiväite ainult kindlalt tuvastatud dokumendist; võrdse dokumendikandidaadi korral on tulemus fail-closed ja peab küsima täpsustust, mitte võtma naaberdokumendi arvu;
5. järelvalidaator kontrollib, et vastuse arvud sisalduvad just valitud dokumendi mudelile renderdatud tõendis;
6. trace eristab planner'i, mitme päringu korje, dokumendiidentiteedi, faktisegmendi, konteksti renderduse, mudelikõne ja faktivalidatsiooni ajad ning talletab dokumendivaliku põhjused.

Käsitsi planner-kontrollis läksid mõlemad J11 loomulikud sõnastused uude režiimi; `Millest on Laur Raudsoo kirjutanud?` jäi autoriotsinguks ja lai mitme uuringu küsimus jäi sünteesiks. Muudetud JavaScripti lint, Python AST, `git diff --check`, i18n ja Webpacki produktsioonibuild on rohelised. Ametlik Turbopack-build ei käivitunud eraldatud worktree välise `node_modules`-symlingi tõttu; sama kood kompileerus Webpackiga, TypeScript ja 70 staatilist lehte läbisid.

Seis on siiski **PARTIAL / runtime NOT_PROVEN**: kandidaat on commit'itud ainult kohalikku parandusharusse commit'ina `db20ded0`, kuid seda ei ole push'itud ega deploy'tud ning päris toodanguindeks ega autentitud `/vestlus` ei kasuta seda koodi. 22.08 kell 17:34:34 UTC oli mõõdetud `origin/main` `0970f7b27c60c5e27eab4859d8a6511d995a0730`, serveri HEAD `9cad5105fc30d68f1df7bb084f79a59e68b110d7`; frontend, RAG ja research-worker olid aktiivsed. Allikapaneeli eraldi P0 on endiselt **NOT_PROVEN** ning seda ei maskeerita retrieval'i paranduse osaks.

### J11 lõplik toodangu järelkontroll — 22.08, SHA `735ff837`

Eelmine `runtime NOT_PROVEN` seis on nüüd ajalooline lähtepunkt. Omaniku selge loa alusel push'iti ja deploy'ti põhjusepõhine parandusjada; lõppkontrolli ajal olid `origin/main`, serveri HEAD ja brauseris kasutatud toodang samal SHA-l `735ff8375377071807acb14ea052f47562cefe77`. Frontend, RAG ja research-worker olid aktiivsed; RAG health oli `status=ok`, 49 727 vektorit ja 6089 dokumenti. Korpust ega indeksit selle ploki käigus ei muudetud.

Tõendatud süsteemsed lisapõhjused ja parandused:

1. lühikese küsimuse õige uuringuartikkel sai identiteediskoori 8, kuid kolm sama sõnavaraga sotsiaalhoolekande seaduse paragrahvi said 7; ühe punkti ebamäärasusvärav viskas kogu tõendi ära;
2. `specific_research_fact` dokumendivalik välistab nüüd õigusallika uuringu identiteedi konkurendina, kuid jätab õigusallikate tavapärased otsingurajad muutmata;
3. õige mudelivastus lükati kord tagasi `unsupported_numeric_claim` ja kord `no_numeric_claim` põhjusega, sest tõend või vastus kasutas eesti arvsõnu `seitse`, `kuus`, `üks` numbrikujude asemel;
4. täpne faktivärav normaliseerib nüüd eesti põhiarvsõnad ja käändevormid nii renderdatud tõendis kui ka mudelivastuses. See on üldine arvukuju leping, mitte J11 sõnade erand.

| tase | lühike loomulik küsimus | Elin Küti nimega variant |
|---|---|---|
| otsene RAG | õige dokument kohtadel 2–3, faktilõik olemas, `bm25 + registry_fact`, `partial=false`, 6645 ms | õige dokument kohtadel 4–5, täpne seitsme intervjuu lõik, `bm25 + author_match`, `partial=false`, 4334 ms |
| autentitud `/vestlus`, sama vestlus | **PASS** — 7 poolstruktureeritud intervjuud, 6 individuaalset ja 1 kolme osalejaga grupiintervjuu; osalejate lause kinnitati algallikast | **PASS** — 7 poolstruktureeritud intervjuud, 6 individuaalset ja 1 kolme osalejaga grupiintervjuu |
| esimene sisuline tekst / lõpp | 18 719 / 19 897 ms | 9942 / 11 143 ms |
| dokumendi- ja faktijälg | identiteet `high`; õigusallikad `source_compatible=false`; `passed=true`, `all_claims_in_one_rendered_source`, väited 7/6/1/3 | valitud ja kuvatud allika ID-d võrdsed; üks allikas |
| kuvatud allikas | Elin Kütt, 2016, „Sotsiaaltöötajate tööalase toetuse kogemused”, Sotsiaaltöö 3/2016, lk 64–68, Uurimus | sama toetav allikas |

Brauseri semantiline klõps ei liiguta platvormi custom-hiire nähtavat noolt; see tekitas varasemas kuvatõmmises näilise möödaklõpsu. Kursori SVG tipp ja `mousemove`-ankur on koodis mõlemad `(0,0)`, seega kalibreerimisviga ei tõendatud. Omaniku käsitsi avatud allikapaneel ja praeguse vastuse serverisse talletatud `displayed_source_ids`/`sources` kinnitasid sama Elin Küti allikakaardi sisulise viite.

### J17/V06 atribuutika ja sõnastustundlikkuse lõppkontroll — SHA `7f3aa503`

J17 ja V06 kontroll algas commit'il `d29571bd`, mille RAG-loogika alus oli `735ff837`. J17 vastas õigesti `169 / 2018` ja selle allikapaneel avanes, kuid V06 loomulik variant keeldus 18 036 ms järel valesti. Otsene `/search` oli samal ajal `partial=false`, õige Merli Lauri artikkel kohtadel 1–8 ning koguaeg 14 506 ms. Trace näitas, et planner valis õigesti `specific_research_fact`, kuid dokumendiidentiteet kuulutati ühepunktilise `9 : 8` skoorivahe tõttu ebamääraseks: ainult esimesel kandidaadil oli vähemalt kahe teematermini pealkirjaankur, teisel oli üks pealkirjavaste ja ülejäänud kattuvus meta-/teematekstis.

Viga kordus teise sõnastusega „Laste eraldamise otsused: arv ja aasta?”. See läks ekslikult üldrajale, mudel koostas arvud `21 / 2022 / 3 / 18` ning faktivalidaator peatas need `unsupported_numeric_claim` otsusega; kasutajale jõudis 16 830 ms järel vale keeldumine. Seega olid eraldi tõendatud planner'i kompaktse faktikuju auk ning liiga jäik dokumendiidentiteedi ebamäärasusvärav.

Parandus ei sisalda lapse eraldamise sõnu ega vastuse arve. Üldine kompaktne `teema: faktipesa + faktipesa` kuju läheb ühe uuringu faktirajale ainult siis, kui teemas on vähemalt kaks sisuterminit, faktiosas vähemalt kaks eri faktipesa ning küsimus ei ole õigus-, KOV-, teenuse- ega toetuspäring. Ühepunktiline identiteedivahe loetakse piisavaks ainult siis, kui esimesel kandidaadil on vähemalt kahe teematermini unikaalne pealkirjaedu; kahe võrdselt ankurdatud dokumendi konflikt jääb fail-closed.

Ajutine deterministlik sihtkontroll oli vana käitumisega 2/4 punane ja pärast parandust 4/4 roheline; see kontrollis lisaks, et autori-, sünteesi-, õigus- ja KOV-rada ei neeldu faktirežiimi ning päris kahe pealkirja viik jääb ebamääraseks. Vastavalt repo praegusele töökorrale ajutine testifail eemaldati. JavaScripti lint ja `git diff --check` läbisid, lokaalne Webpacki tootmisbuild kompileeris TypeScripti ja 70 lehte ning serveri ametlik Turbopack-build läbis 36,0 sekundiga. Korpust, indeksit, andmebaasi ega serveri konfiguratsiooni ei muudetud.

Commit `7f3aa503fe5f54a92d4b9c04cf017e8987decae3` push'iti ja deploy'ti omaniku varasema selge loa alusel 22.08 kell 19:05 UTC. `origin/main`, server ja autentitud brauser olid järelkontrollis samal SHA-l; kolm teenust olid aktiivsed, `/vestlus` vastas 200 ning RAG health oli 49 727 vektorit / 6089 dokumenti.

| juhtum | autentitud vastus samas vestluses | esimene tekst / lõpp | planner, tõend ja kuvatud allikas | seis |
|---|---|---:|---|---|
| V06 loomulik | `169` kohtulahendit; `2018` | 25 202 / 26 718 ms | `specific_research_fact`; identiteet `high`; faktivalidaator `all_claims_in_one_rendered_source`; üks valitud ja kuvatud Merli Lauri 2022 artikkel | **DONE** |
| V06 kompaktne | `169`; `2018`; artikli `2022` eristati õigesti | 25 534 / 27 092 ms | `compact_single_research_fact_shape`; identiteet `high`; sama ühe allika faktivärav ja avatud paneel | **DONE** |
| J17 | `169`; `2018. aastal jõustunud maakohtute lõpplahendid` | 15 935 / 17 492 ms | faktivalidaator läbis; valitud=kuvatud; avatud paneelis üks sama Merli Lauri artikkel | **DONE** |

Kõigi kolme vastuse allikapaneel avati ning `Escape` sulges dialoogi ja taastas fookuse vastuse allikanupule. See tõendab põhilise klaviatuuritee, mitte JAWS-i ega kogu paneeli ligipääsetavust. Kaartide bibliograafiline sisu oli õige, kuid leheküljenumbrite järjekord oli endiselt sorteerimata. V06 trace'i `year_mode=not_requested` on observability-ebakõla, sest `claim_values` sisaldas 2018 ja 2022 ning mõlemad kontrolliti samast allikast; see ei muutnud nende vastuste sisulist tulemust.

### Parafraasiploki järelkontroll ja uued süsteemsed veaklassid — SHA `771795e2`

Pärast `7f3aa503` vahefinišit tehti kolm eraldatud üldparandust: `faf6ff14` normaliseeris kuvatud leheküljeviited ja allikadialoogi fookuspiiri, `3c53611f` lahutas andmeaasta allika ilmumisaastast ning tugevdas hõreda teemaankru dokumendiidentiteeti, `771795e2` eristas kestuse kalendriaastast ja lõpetas mitme faktipesa käsitlemise ühe koguarvuna. Korpust, indeksit, andmebaasi ega serveri keskkonda ei muudetud.

Parandused ei ole küsimusepõhised: koodis ei ole erihooldekodu protsente, e-kursuse kuue kuu vastust ega vanemaealiste arve. Püsiv regressioonikomplekt kontrollib planner'it, uuringudokumendi identiteeti, aasta rolli, ühe renderdatud allika arvukatvust, arvsõnade normaliseerimist, valitud ja kuvatud source ID võrdsust ning leheküljevahemikke. Esimese ploki neli uut kontrolli olid vana käitumisega 4/19 punased; teise ploki neli uut kontrolli olid vana käitumisega 4/23 punased. Parandatud puul läbis `npm run test:rag-regression` 23/23 kontrolli.

Kõik alltoodud vestluspäringud tehti samas jätkuvas autentitud `/vestlus` vestluses, ilma „Uus vestlus” workaround'ita. PASS nõudis õiget fakti ning seda toetavat kuvatud allikat; pealkirjavaste üksi ei lugenud.

| juhtum | otsene RAG / kontekst | autentitud vastus ja aeg | kuvatud allikas | lõppseis |
|---|---|---|---|---|
| V01 MAPPA | **PASS**, varasem sama indeksi sihtmõõtmine 1549 ms; lõigus olid nelja kuu intervall ja Rakvere/Jõhvi/Narva 5/7/5 | **PASS**, lõpp u 20,3 s | MAPPA väiteid toetav ajakirjaallikas | **DONE** |
| V02 erihooldekodud | **PASS**, 2899 ms; sama artikli lõigus 25% / 45% / 30% | **PASS**, 31,2 s; teine loomulik vorm 22,3 s, mõlemad 25% kergem teenus / 45% ööpäevaringne juhendamine / 30% pidev hooldus | „Suurte erihooldekodude ümberkorraldamine on hoolikalt läbimõeldud protsess” | **DONE** |
| V03 supervisioon | **PASS**, 5167 ms; 2017, igas maakonnas viis kohtumist | **PASS**, esimene tekst u 8,5 s, lõpp u 9,1 s | vastuse arvu ja eraldi 2020 tausta toetavad allikad | **DONE** |
| V04 vanemaealiste vägivald, lühivorm | **FAIL** viimasel SHA-l: õige 2025 artikkel ei jõudnud viie rühmitatud kandidaadi sekka | **FAIL**, vale keeldumine 15 970 / 15 990 ms | puudus | **FAIL** |
| V04 vanemaealiste vägivald, pikk vorm | õige Anu Lepsi 2025 artikkel valiti | **FAIL**, 30 810 / 30 820 ms: 10% = 640 ja 6% = 227 olid õiged, kuid `2% (n=100)` tõlgendati valesti „100 inimese valim, 2 inimest” | õige Anu Lepsi artikkel, kuid vastus ei järginud tõendi arvude rolle | **FAIL** |
| V05 e-kursuse järelmõju | **PASS**: õige Marina Vaino artikkel, identiteet `high`, kestus ei muutunud aastanõudeks | **PASS**, 14 350 / 14 370 ms; pikem loomulik vorm 26 690 / 26 700 ms: kuus kuud, osaleja ja tööandja | Marina Vaino, 2026, „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” | **DONE** |
| V06 lapse eraldamine | **PASS**, 5648 ms; 169 / 2018 | **PASS**, korduses u 39 s; varasemad kaks vormi 26 718 ja 27 092 ms | üks Merli Lauri 2022 artikkel, andmeaasta 2018 säilis | **DONE** |
| V07 inimarengu aruanne | **PASS**, õiges lõigus 380 lehekülge, 71 autorit ja stsenaariumid | **PASS**, lõpp u 25,9 s | Merike Sisaski 2023 artikkel | **DONE** |
| V08 Perepesad | **PASS**, algses otseses mõõtmises 906 ms | **PASS**, esimene tekst u 5,1 s, lõpp u 7,4 s; 2022 asukohad ja hilisemad lisandused eristati | kaks vastuse ajakihti toetavat allikat | **DONE** |

Parafraasiploki tulemus on seega **7/8 algset juhtumit end-to-end PASS**. V02 ja V05 parandused on mõlemad kahe sõnastusega reprodutseeritud. V04 on endiselt FAIL ning näitab kahte eri kihti:

1. **korje/kandidaatide recall:** protsendiankrutega lühiküsimus ei too õiget dokumenti faktisüvaotsingu kandidaatideni;
2. **vastuse koostamine ja faktivalidatsioon:** õige tõendi korral kontrollitakse praegu arvutokeneid, kuid mitte struktureeritud seost `protsent + n + sihtrühm + aasta`. Seetõttu läbis semantiliselt vale, kuid samad arvud sisaldav vastus värava.

V04 ei ole metaandmeviga ning seda ei parandata küsimuse sõnade või ühe vastuse hardcode'iga. Järgmine põhjusepõhine P0 on arvuliste tõendituplite (`protsent`, `n`, sihtrühm, mõõdik, aeg) ekstraheerimine ja sama rollijaotuse nõudmine vastuses; eraldi tuleb parandada numbriliste ankrutega lühiküsimuse kandidaatide recall.

### V04 põhjusepõhine P0-parandus ja lõppkontroll — SHA `66355272`

V04 parandati ilma korpust, indeksit, andmebaasi või serveri keskkonda muutmata. Tõendatud veaahelas oli neli järjestikust kihti: liitsõna „vägivallauuring” üldine „uuring” neelas teematermini; õige dokumendi tuvastamise järel ei otsitud kõiki arvulisi ankruid dokumendi seest; sama artikli muud protsendid rahuldasid ekslikult kolme küsitud protsendi katvuse; lõpuks käsitles vastuse koostaja kuju `2% (n=100)` 100-liikmelise valimina ja faktivalidaator ei märganud järgmisse lausesse viidud tuletist „2 inimest”.

Commit'ide `f41143dd`, `913350af`, `db9aaa71`, `908d1a07`, `0b7104b6` ja `66355272` üldised parandused eristavad teemaankrut üldisest dokumendiliigist, teevad kõrge kindlusega tuvastatud dokumendis arvulise järelotsingu, nõuavad just küsimuses nimetatud protsente, seovad `X% (n=Y)` protsendi ja loenduse üheks rollipaariks, keelavad `X% × Y` uue arvu tuletamise ka järgmises lauses ning rakendavad faktiväravat ka lühikesele protsendiküsimusele. Koodis ei ole V04 vastust ega Anu Lepsi nime hardcode'itud.

Lõppkontroll tehti samas jätkuvas autentitud vestluses ilma „Uus vestlus” workaround'ita:

| sõnastus | vastus | esimene tekst / lõpp | trace ja allikas | seis |
|---|---|---:|---|---|
| `Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?` | 10% = 640 üle 60-aastast kuriteoohvrit; 6% = 227 üle 60-aastast ohvriabisse pöördunut; 2% = 100 üle 75-aastast, kes puutusid viimase aasta jooksul kuritegevusega kokku; haldusandmed ja ohvriuuring eristati | 36 269 / 36 289 ms | faktivärav `all_claims_in_one_rendered_source`; valitud = kuvatud Anu Lepsi ja Lenne Indovi 2025 artikkel | **PARTIAL** |
| pikk loomulik vorm | 2023: 10% = 640 ja 6% = 227; 2024. aasta ohvriuuring: 2% = 100 | 33 376 / 33 395 ms | sama faktivärav ja sama valitud/kuvatud allika ID | **PARTIAL** |

Mõlemas lõppvastuses olid faktid ja arvude rollid õiged ning andmebaasi trace kinnitas sama valitud ja kuvatud source ID-d. Vastuse allikanupp oli nähtav ja aktiivne, kuid automatiseeritud hiireklõpsuga ei tekkinud kontrollitavat paneeli (`panelTitleCount=0`) ka korduskatsel. Seetõttu ei tõsteta V04 rangelt DONE-iks: **otsing leidis ja vestlus vastas õigesti, allikapaneeli UI on selle juhtumi jaoks NOT_PROVEN**. JAWS jäi samuti mõõtmata.

Püsiv RAG-regressioonikomplekt läbis lõppkoodil 38/38, muudetud failide lint, i18n, `git diff --check`, lokaalne Webpacki tootmisbuild ja serveri ametlik Turbopack-build olid rohelised. Server, `origin/main` ja kohalik HEAD olid SHA-l `663552723`; frontend, RAG ja research-worker olid aktiivsed ning health jäi 49 727 vektori / 6089 dokumendi peale. Vastuste 33–36 sekundit on endiselt ebamõistlik viivitus, mitte kvaliteedivõit.

### 10/10 avaldamisvärav

| värava osa | seis | põhjus |
|---|---|---|
| paranduskandidaadi kogu 75 juhtumi otsene otsing | **NOT_PROVEN** | parandatud veaklasside sihtjuhtumid on otsingukihis rohelised, kuid kogu muutumatu `66355272` 75/75 kordus on tegemata |
| deploy-järgne sama vestluse kontroll | **PARTIAL** | parafraasiploki 8/8 vastused on sisuliselt õiged, kuid V04 allikapaneeli UI ja teised plokid on tõendamata |
| allikaloendi päris brauserikäitumine | **PARTIAL** | varasemate faktivastuste paneelid, Escape ja fookuse taastamine töötasid; V04 paneel ei avanenud automatiseeritud katses, JAWS ning kõik vastusetüübid on mõõtmata |
| püsiv RAG-regressioonikomplekt | **TEHTUD, piiratud** | 38/38 PASS; kaitseb tõendatud planner'i, identiteedi, arvufakti ja atribuutika lepinguid, mitte mudeli kogu sisulist käitumist |
| commit | **TEHTUD** | testitud RAG-loogika SHA `66355272`; omaniku otsene luba |
| push | **TEHTUD** | `origin/main` = `66355272` |
| deploy | **TEHTUD** | serveri HEAD = `66355272`; frontend, RAG ja research worker aktiivsed; health 49 727 / 6089 |

Järeldus: V04 varem tõendatud enesekindel semantiline arvuviga oli kahe sõnastusega sisuliselt suletud; allikapaneeli, jõudluse ja autoriploki järgnev kontroll on allpool.

### 23.08 jätk — allikapaneel, jõudlus, autorivärav ja vestluse puhver

Kõik siinsed päringud tehti samas jätkuvas autentitud `/vestlus` vestluses ilma „Uus vestlus” workaround'ita. Lõppkoodi SHA on `815f15f6`; korpust, indeksit, andmebaasi ega serveri keskkonda ei muudetud.

**Allikapaneel.** Sõnumimulli hover või aktiveerimine toob tegevusnupud nähtavale. Varem puudu jäänud V04 tõend ei olnud vigane source-objekt ega Reacti paneeli state: mulli aktiveerimise ja seejärel allikanupu vajutamise järel avanes paneel. Paneeli nähtav lühisilt oli `Anu Leps, 2025. Vägivald vanemaealiste vastu vajab tähelepanu`; sama Anu Lepsi ja Lenne Indovi artikli source ID oli trace'is valitud, vastuse aluseks ja kuvatud allikaks. V04 faktivalidaator läbis `exact_numeric_fact_v2` värava ning vastus säilitas 10%/640 ja 6%/227 kui 2023. aasta haldusandmed ning 2%/100 kui 2024. aasta ohvriuuringu tulemuse. V04 on seega **DONE**. Ilma mulli eelneva aktiveerimiseta peidetud tegevusrea nupu automatiseeritud klõps paneeli ei avanud; see on interaktsioonitee eripära, mitte puuduva allika tõend.

**Jõudlus.** Etapilogimine eristab päris seinakella aega paralleelsete alampäringute summast. Kontrollitud täisdeploy järel võttis esimese lihtsa autoripäringu retrieval 9935 ms, millest dense-otsing 7837 ms; vahetu soe kordus langes retrieval'is 1922 ms ja dense'is 229 ms-ni. Ühe tulemusega naiivne startup-päring ei soojendanud toodangu `n_results=64` rada piisavalt. Lõplik käivitusaegne soojendus loeb ühe olemasoleva embedding'u ning teeb sama mahuga üld- ja dokumendifiltriga Chroma kontrollpäringud enne teenuse ready-olekut. Pärast seda võttis esimene deploy-järgne autoripäring brauseris 7095 ms, retrieval 2433 ms ja dense 263 ms; järgmised A/B retrieval'id olid 1848 ja 1700 ms. Praktiline külma retrieval'i siht kuni 5 s ja sooja siht kuni 2,5 s on selles mõõtejadas täidetud.

V04 on sellest eraldi kuue tõendipäringu fanout: lõpliku ohutu release'i kordus võttis brauseris 15 696 ms, retrieval 10 491 ms, mudel 3900 ms ja faktivalidaator 8 ms. Kuue päringu korraga käivitamise katse suurendas Chroma/SQLite'i konkurentsi: retrieval halvenes 17 056 ms-ni, dense-alampäringute summa 41 810 ms-ni ja brauser 21 702 ms-ni. Katse võeti tagasi commit'is `5796178f`. Järgmine V04 jõudlusparandus peab vähendama dubleerivat tööd või kasutama päris batch'i; sama protsessi Chroma päringute paralleelsust lihtsalt ei suurendata.

**Autorivärav.** Loomulikus küsimuses tuvastatud täisnimi läheb autorite metaandmevälja täpsesse otsingusse, mitte chunki vabateksti nimevasteks. Planner annab selle raja ettepoole üldisest semantilisest otsingust. Maarja nime valesti kõrge riskiga õigusrajale saatnud liiga lai `maar*` regulaaravaldis asendati päris määra-nimisõna piiratud käänetega. Kümne algallikast koostatud juhtumi lõppseis:

| juhtum | autor | kontrollitud teema | vastus + allikapaneel |
|---|---|---|---|
| A01 | Krister Tüllinen | deinstitutsionaliseerimine, vangla taasühiskonnastamine | **PASS** |
| A02 | Maarja Krais-Leosk | pikaajaline hooldus, erihoolekanne, harvikhaigusega pered | **PASS** |
| A03 | Kadi Lubi | tervise- ja sotsiaaltöö koostöö, eetika, tervisekirjaoskus | **PASS** |
| A04 | Ave Roots | COVID-19 tööjõu- ja oskustemuutus | **PASS** |
| A05 | Jane Sokk | erihoolekanne, rehabilitatsioon ja Käo keskus | **PASS** |
| A06 | Liina Kriisk | rehabilitatsiooniteenus ja võrgustikutöö | **PASS** |
| A07 | Kadri Soo | elukutsed, lastekaitse ja hoolduspraktika | **PASS** |
| A08 | Merle Kriisa | kristlikud sotsiaalteenused, kvaliteet ja vaimne tervis | **PASS** |
| A09 | Heli Raudla | eestkoste ja kohaliku omavalitsuse nõustamine | **PASS** |
| A10 | Judit Strömpl | õigused, uurimiseetika ja taastav õigus | **PASS** |

Kõigil kümnel juhul vastas sisuline kokkuvõte küsitud autori materjalidele ja avatud allikapaneel näitas toetavaid autoriharu dokumente. Kaasautorlusega kirje nähtav lühisilt võib näidata ainult esimest autorit; valiku aluseks olev metadata author-väli ja source-objekt säilitasid täpse autorivaste. See on **10/10 ainult autoriplokis**, mitte kogu RAG-i hinnang.

**Vestluse mälu ja prompt cache.** Iga saatmine teeb uue Responses API päringu ja uue RAG-otsingu. Täielik uus autoriküsimus vahetab teemat iseseisvalt; lähiajalugu lisatakse ainult kontekstist sõltuvale lühikesele jätkuküsimusele. Stabiilne süsteemiprompt on nüüd eraldi eksplitsiitses cache-prefix'is, dünaamiline RAG-kontekst mitte. Toodangulogis kirjutas esimene päring 1896 cache-tokenit ning järgmised sama kasutaja/rolli/keele/kriisirežiimi päringud lugesid 1896 tokenit ja kirjutasid 0; seega töötab puhver tõendatult, kuid ei külmuta teemat ega taaskasuta vana RAG-vastust.

**Nummerdus.** Markdowni järjestatud loendi jätkumine pärast pesastatud täpploendit säilitab nüüd iga `<ol>`-segmendi algusnumbri. A07 ja A10 salvestatud vastustes olid kolm artiklit semantiliselt `1, 2, 3`; brauser renderdas järgnevad segmendid `start="2"` ja `start="3"`, mitte `1, 1, 1`.

AGENTS.md uue korra järgi automaatteste ei loodud ega käivitatud. Muudetud koodifailide lint, i18n, `git diff --check` ja muutumatu lõppkoodi tootmisbuild olid rohelised; runtime-tõend on käsitsi autentitud brauserirada.

**Serveriressursid.** RAM-i ei suurendatud. Deploy-build peatab hooldusväravas frontend'i, RAG-i ja research-workeri ning hoiab frontend'i runtime-maskiga väljas kuni valmis artefaktini; build'i ajal oli nii 5,3 GiB mälu saadaval. See vähendab varem tõendatud hosti OOM-riski, kus uvicorn oli kasvanud umbes 3,38 GiB anonüümse RSS-ni. Omaniku säilitusotsuse järel eemaldati kõik aegunud frontend- ja RAG-backup'id, vana RAG-puu, Playwrighti cache, build-cache'id ning tõendatud paketi-, audit- ja hotfix-jäägid; juurketta kasutus langes 96%-lt 57%-ni ja vaba ruum kasvas umbes 2 GiB-lt 21 GiB-ni. Alles on üks terviklikult kontrollitud 1,4 GiB RAG-snapshot ning üks värske kontrollitud andmekoopia iga muutuvat serveriandmestikku kasutava lehe kohta. Journal on piiratud 512 MiB / 14 päevaga ja PM2 logidel on seitsme päeva rotatsioon. Deploy kustutab pärast edu eelmise release'i ajutise rollback-artefakti ja npm-, Prisma- ning `.next` build-cache'i; alles jäävad üks kontrollitud aktiivse SHA frontend-artefakt ja uusim build-logi. Madala koormuse kontrollis oli 6,8 GiB RAM-ist 3,8 GiB saadaval; `vm.swappiness=10` vähendab aktiivse rakendusmälu enneaegset swap'i viimist. Korpust, aktiivset indeksit ega serveri env-i ei muudetud.

## Prioriteedid ja järgmised põhjusepõhised parandused

1. **P0 – V04 kuue tõendipäringu fanout.** Külmkäivitus on suletud; V04 allesjäänud 10,49 s retrieval vajab päringusisese dubleerimise või batch'imise põhjusepõhist parandust. Chroma/SQLite'i sama protsessi paralleelsust ei suurendata, sest mõõdetud katse aeglustas vastust.
2. **P0 – ülejäänud 54 juhtumi release-värav.** Jätkata sidusate plokkidena samas autentitud vestluses ja samal muutumatul SHA-l; mõõtmata juhtumid jäävad `NOT_PROVEN`.
3. **P0 – sama vestluse rate-limit runtime-lahknevus.** Logida tegelik scope, limit, window, remaining ja `Retry-After` ilma kasutaja/IP väärtust avaldamata; kinnitada, miks 60 s vaikeaken ei taastunud vähemalt seitsme minuti jooksul.
4. **P1 – faktipäringu parafraasimaatriks.** Korrata vähemalt pika, lühikese ja teise sõnavaraga küsimusega üle kõigi parandatud faktiklasside.
5. **P1 – laia sünteesi päris mitmekesisus.** Kinnitada kümne sünteesiküsimuse peal, et konteksti valik ja lõppvastus säilitavad mitu teemakohast dokumenti, mitte mitu sama dokumendi lõiku.
6. **P1 – ajaloo mõju nähtavaks ja piiratud.** Logida, milline varasem tekst embeditavasse päringusse lisati; lühike küsimus ei tohi automaatselt saada põhjendamata vana saba.
7. **P2 – loenduse definitsioon.** Selgitada 863 vs 877/864; valida üks kanoniline aktiivse ajakirjaartikli definitsioon ja teha health/registry raportis nähtavaks.

Üksikküsimuse hardcode ei lahenda ühtegi neist klassidest.

## Algse auditi mõõtmisvalmidus: DONE / PARTIAL / NOT_PROVEN

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

### Ajaloolise release'i end-to-end värav — SHA `815f15f6`

| seis | arv | tähendus |
|---|---:|---|
| DONE | **21/75** | varasemad kümme DONE juhtumit, V04 ning kümme autorijuhtumit läbisid õige tõendi, vastuse ja toetava avatud allikapaneeli värava |
| PARTIAL | **0/75** | V04 allikapaneel ja autoriploki vastamiskiht on nüüd tõendatud; ühtegi pooleldi mõõdetud juhtumit praeguses release-arvestuses ei ole |
| FAIL | **0/75** | lõpp-SHA-l ei ole praeguse kordusploki sees alles tõendatud valet vastust; see ei tähenda, et mõõtmata juhtumid oleksid õiged |
| NOT_PROVEN | **54/75** | ülejäänud juhtumite lõpp-SHA otsingu- ja autentitud vestluskordus puudub |

`DONE + PARTIAL + FAIL + NOT_PROVEN = 75`. FAIL hoitakse eraldi, et tõendatud valet vastust ei peidetaks PARTIAL-i ega NOT_PROVEN-i sisse. Need arvud ei ole töökindluse protsent.

Omaniku tõstatatud Laur Raudsoo reprodutseerimiskatse ei kuulu 75 põhijuhtumi hulka ja on tabelis eraldi. Nii ei paisuta lisakontroll põhimaatriksi nimetajat.

## Jääkriskid

- täpne UI-s kasutatud kontekstilõik ja kärpekoht ei ole kasutajale nähtav;
- J11/J17 ning parafraasiploki PASS-vastuste allikad on kontrollitud, kuid ülejäänud vastuste väitepõhine atribuutika on mõõtmata;
- aktiivsete ajakirjadokumentide kanoniline arv on lahendamata;
- uue vestluse taastumiskatse ei tõenda algse pika vestluse töökindlust;
- KOV-i kontaktid, tasud ja taotlemisviisid on ajas muutuvad ning vajavad eraldi värskuseväravat;
- `partial=false` ja roheline health ei kata sisulist katvust;
- ajalooline kitsas RAG-regressioonikomplekt ei ole uue AGENTS.md korra järgi praegune värav; selles jätkus automaatteste ei loodud ega käivitatud;
- J11 kaks vormi on lõpp-SHA-l rohelised, kuid see ei tõenda teisi parafraasi-, arvusõna- ega dokumendiklasside kombinatsioone;
- faktivastuste u 3–16 sekundi hajuvus ja V04 kuue päringu 10,49-sekundiline retrieval on kasutatavusrisk; startup-soojenduse üks kontrolljada ei tõenda p50/p95 stabiilsust.

## Võrdlusmaterjalid

Kontrolliti ka omaniku viidatud faile `rag-leidude-uuskontroll-2026-08-22.md` ja `rag-otsingu-jaakaugud-2026-08-22.md`. Neid kasutati hüpoteeside ja koodiviidete võrdluseks, mitte uute küsimuste kontrollvastusteks. Käesolev runtime-seire kinnitas nende põhiteesidest sõnastustundlikkuse, õige artikli/vale lõigu, laia raja vähese katvuse, autorimeta nõrkuse, ajaloo lahjenduse ja nähtamatu kontekstikärpe praktilise mõju. Samal ajal korrigeerib käesolev raport varasema `autenditud /vestlus NOT_PROVEN` staatuse 50 tegeliku sisulise vastuse võrra.

### 23.08 FTS5 release'i autentitud sihtkordus — SHA-d `914e1452` ja `da2c79c4`

Kontroll jätkus samas autentitud vestluses ilma „Uus vestlus” workaround'ita. FTS5-järgse üheksa juhtumi esmane plokk andis kuus PASS-i ja kolm viga: V06 täpne uuringufakt, Kadri Soo autorirada ning KOV-i järel esitatud sõltumatu üldküsimus. Omaniku eraldi brauseris ilmnes lisaks Lauri liitküsimuse nimeparseri viga. Need ei olnud üks FTS5 veaklass: V06 põhjus oli dokumendiidentiteedi järjestus, üldküsimusel ajaloo KOV-scope, Lauril asesõnafraasi valinud parser ning Kadri puhul praeguse registri author-meta puudujääk.

SHA `914e1452` järelkontroll:

| juhtum | vastus | brauseri lõppaeg | trace | avatud allikas | seis |
|---|---|---:|---|---|---|
| Laur Raudsoo liitküsimus | isik ja kirjutatud teemad õigesti | 15 022 ms | `person_source_lookup`, nimi `Laur Raudsoo`, retrieval 9457 ms | 5 toetavat autoriharu kaarti | **PASS** |
| üldine eaka koduabi kohe Kuusalu järel | üldine koduteenus, KOV-saba puudus | 12 330 ms | `life_situation_guidance`, municipality ID puudus, retrieval 8465 ms | SHS § 18, § 17 ja § 26 | **PASS** |
| V06 loomulik sõnastus | `169 / 2018` | 18 198 ms | `specific_research_fact`, identiteet `high`, retrieval 16 748 ms | Merli Lauri 2022 artikkel | **PASS** |

See on sihtploki **3/3**, mitte kogu 75 juhtumi kordus. Kumulatiivne ajalooline arvestus jääb **DONE 21/75 · NOT_PROVEN 54/75**; `914e1452_end_to_end_revalidated` ei ole 21/75. Kadri Soo A07 ajalooline PASS ei tõenda praeguse registri täpset author-meta rada: käesolevas mõõtmises oli täpseid author-ridu 0 ning nimi esines ainult chunk'ide sisus. A07 jääb allika/meta kooskõla lahendamiseni praeguse release'i jaoks avatuks.

Lisakontroll `Mida sätestab Kuusalu valla koduteenuse määruse § 6?` andis 3416 ms-ga vale keeldumise: planner valis `municipality_service_benefit_list` ja kuvas ainult teenuselehe. Sama aktiivse korpuse otsene täppisfilter `kov_regulation + kov_legal + kuusalu_vald + paragraph_number=6` tagastas ühe õige „§ 6 Koduteenus” lõigu, `partial=false`, `degraded=false`. Tõendatud põhjus oli määruse tuvastaja puuduv käändevorm „määruse”, mitte FTS5 puuduv katvus.

Release `da2c79c4` järel vastas sama autentitud küsimus 6401 ms-ga õigesti § 6 eesmärgi, abitoimingute sisu ja personaalse hoolduskava kohta. Planner ja legal lookup olid `explicit_paragraph`, municipality ID `kuusalu_vald`, valitud allikaid 1 ja kuvatud allikaid 1 ning ID-d kattusid. Avatud paneel näitas toetavat „Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus” kaarti. Release-jada mõõdetud sihtkontroll on seega **4/4 PASS**, kuid see ei ole kogu 75 juhtumi kordus.

### 23.08 ET/RU/EN keeleproov — kitsas autorirada PASS, üldvärav `NOT_PROVEN`

Autentitud küsimus `Кто такой Лаур Раудсоо и о чём он писал?` tõendas, et mitmekeelne embedding üksi ei moodusta mitmekeelset RAG-i. Brauseri lõppaeg oli 5332 ms; planner jäi `default` režiimi, `person_name` puudus, dense andis 36 kandidaati, BM25 0, kuvatud allikaid 0 ning vastus tuli eestikeelse `uiLocale` tõttu eesti keeles.

SHA `e0e240cf` lisas esmalt privaatsust säilitava keeleplaani shadow-mõõtmise. Sama venekeelne autoriküsimus jäi päris planner'is üldrežiimi, kuid shadow-plaan tuvastas `person_source_lookup`; 36 retrieval-kandidaadist valiti 7, kuid kuvatud allikaid oli 0. See eristas vea põhjuse: mitmekeelne dense-recall oli olemas, ent täpne autoriplaan, eestikeelne leksikaalne päring ja atribuutika ei aktiveerunud.

SHA `2f0318c4` aktiveeris ainult konservatiivse RU/EN täisnimega autoriraja. Ingliskeelne `Who is Laur Raudsoo and what has he written?` vastas inglise keeles 13,60 sekundiga; planner oli `person_source_lookup`, retrieval'i keel eesti, retrieval 3964 ms ning valitud ja kuvatud source-ID komplektis oli sama viis allikat. Venekeelne `Что писал Лаур Раудсоо о пожилых людях?` vastas vene keeles 13,19 sekundiga ja leidis õige Maardu näite, kuid kuvas viis sama autori allikat — sisuline vastus oli toetatud, ent teemakohane atribuutika liiga lai.

SHA `c9672a05` lisas runtime-only kontrollitud teematüvede kitsenduse nii valitud kontekstile kui kuvatud allikatele. Sama venekeelne küsimus vastas 12,45 sekundiga AI-sotsiaaltöö ja Padise näidetega. Trace näitas `person_source_lookup`, `query=ru`, `retrieval=et`, `answer=ru`, nelja kontrollitud teematermini kasutust, 19 retrieval-kandidaati ning sama kolme valitud ja kuvatud source-ID-d. Avatud paneelis olid Maardu 2019, „Tehisintellekt sotsiaaltöös” 2025 ja Padise 2017: kaks kaarti toetasid vastuses nimetatud näiteid ning Maardu kaart oli küsimuse teemaga seotud täiendav autorallikas. Lõpppäring oli restartijärgselt külm: retrieval 7934 ms ja mudel 3316 ms; enne viimast deploy'd mõõdetud soe sama rada oli retrieval'is 1512 ms.

Kitsas RU/EN autorirada on seega **PASS**, sh vastuse keel, valitud/kuvatud ID võrdsus ja venekeelse vastuse avatud allikapaneel. Kogu ET/RU/EN värav jääb **NOT_PROVEN**: üldine tõlkekiht, sünteesi-, KOV-, õigus-, arvufakti-, segakeele- ja jätkuküsimused ning samatähenduslike küsimuste source/chunk-pariteet on mõõtmata. Küsimuse ega kanoniseeritud retrieval-päringu teksti trace'i ei lisatud. Need lisakontrollid ei kuulu 75 eestikeelse põhijuhtumi hulka ega muuda arvestust **DONE 21/75 · NOT_PROVEN 54/75**.

### 23.08 kitsa mitmekeelse autoriraja jätkuvärav — RAG-loogika `243da993`

Jätkumaatriks eristas keele, nime, teema, kaasautori ja atribuutika veaklassid. SHA `ab267fd5` lõpetas pärisnime täpitähe järgi vale ET-tuvastuse, tundis ära kirillitsas ja ladina tähtedega vene küsimuse, säilitas `ё`/`ö` nimeidentiteedi, toetas kaasautorit ja lühikest autorijätku ning viis planeeritud vastusekeele mudeli ja fallback'ini. SHA `599e89dc` piiras teaduseetika ja kaasautori tõendi vastavust. SHA `243da993` nõuab kontrollitud teemas eristavat tüve, nii et üldine `laps` või `sotsiaaltoo` ei kuva enam teist sama autorikomplektiga, kuid küsimuse otsest teemat mittetoetavat allikat.

Viimase SHA vastu vastas vene kaasautoriküsimus õigesti 11,453 sekundiga ning valitud ja kuvatud tõend oli üks ja sama Ingrid Sindi 2016 artikkel. Ingliskeelne üldine Kadi Lubi küsimus vastas 5,614 sekundiga; neli valitud ja kuvatud allikat kattusid ning avatud paneeli neli kaarti toetasid vastuses loetletud töid. Keelelepingut kontrolliti kolme eraldi UI/küsimuse kombinatsiooniga: `interface=ru, query=et, answer=et`; `interface=en, query=ru, answer=ru`; ning inglise UI-ga venekeelne küsimus koos eestikeelse vastuse korraldusega andis `answer=et`, põhjus `explicit_turn_instruction`. Viimases väravas filtreeriti kahest valitud allikast üks otseselt toetav allikas kuvamiseks; see ei ole valitud/kuvatud komplekti võrdsuse juhtum.

Kõik kontrollid tehti olemasolevas autentitud vestluses, „Uus vestlus” workaround'ita. Konto UI taastati eesti keelde. Kogu 14 juhtumi plokki ei korratud pärast viimast kitsast muudatust tervikuna; mõjutatud juhtumid korrati põhjuse järel. Seetõttu on `243da993` kitsa autoriraja mõjutatud sihtvärav **PASS**, üldine mitmekeelne RAG **NOT_PROVEN** ning eestikeelne põhimaatriks endiselt **DONE 21/75 · NOT_PROVEN 54/75**. Automaatteste ei loodud ega käivitatud.

### 25.08 autentitud sihtkordus — Laur, V04, M10 ja M07

| värav | vastus | retrieval / kontekst | kuvatud tõend | seis |
|---|---|---|---|---|
| Laur Raudsoo jätkloetelu | täpselt kuus õiget pealkirja, kõrvalisi 0 | üks piiratud päring; valitud 6 | kuvatud 6; hover-paneelis kõik kuus | **PASS, lisavärav väljaspool 75 maatriksit** |
| V04 Leps/Indov | 10%=640, 6%=227 (2023) ja 2%=100 (2024) | faktivalidaator PASS | õige Lepsi/Indovi artikkel | **PASS, sihtkordus** |
| M10 OSKA 2025 | 16%, 18%, 68%, 95 koolitust, u 1750 osalejat | üks päring; üks täpne aruanne; retrieval 20 248 ms; esimene tekst 3337 ms | üks sama OSKA PDF hover-paneelis | **PASS, jõudlus PARTIAL** |
| M07 Tarkvanema tööleht enne parandust | ainult vestluse algus; järelkäitumine ekslikult „kinnitamata” | õige fail oli esikohal, kuid 1430 märgist renderdati 693 ja lisati üheksa kõrvalallikat | kolm töölehte | **FAIL — kontekstikärbe** |
| M07 release `f9b6fdd4` | avatud küsimused; kuula, ole kohal, hoidu hinnangutest | üks päring; üks valitud fail; 1182 + 248 märki tervikuna, `truncated=false`; retrieval 4587 ms | üks õige algkoolilapse tööleht | **PASS** |

M07 paranduse leping on üldine: see ei sisalda Tarkvanema oodatud vastust ega küsimusepõhist arvu, vaid eristab nimepidi küsitud dokumendijuhise üldisest materjalide avastusrajast. M10 arvud kinnitab allikapõhine validaator; oodatud arve ei lisatud prompti ega korpusesse. Kumulatiivset ajaloolist arvestust ei suurendata sihtkorduste võrra ilma ülejäänud release'i kontrollimata: **DONE 21/75 · NOT_PROVEN 54/75**.

### 25.08 canonical 75 aktiivse release'i kordus — koodirelease `49b76109`

Canonical nimetaja on täpselt J01–J22, V01–V08, A01–A10, S01–S10, M01–M10, N11–N15 ja K01–K10 ehk 75 juhtumit. DONE loetakse ainult viimasel muutumatul koodirelease'il, kui õige vastus, valitud kontekst, vastust toetav kuvatud allikas, hoveriga avatav „Vastuste allikad” paneel ja trace on kõik tõendatud. Varasema release'i 21/75 ajaloolist koondit ega eraldi sihtkordusi ei kanta sellesse arvestusse automaatselt.

J02 lähte-SHA `8f506014` esimene loomulik sõnastus läks `default` režiimi, valis sama vestluse varasema Eenmaa eestkosteartikli ning ei kuvanud allikaid; õige Ainsaare/Ojasuu artikkel oli retrieval-kandidaatides olemas. Teine sõnastus ilma aastanumbrita jäi samuti `default` režiimi ja üks retrieval-päring aegus 30 sekundiga. Võrdlev töötav sõnastus, milles oli „osakaal” ja `2/2017`, aktiveeris `specific_research_fact` raja. Põhjus oli seega kahes üldises sõnavarapiiris: planner ei tundnud arvuküsimusena väljendit „kui suur osa” ega allikaliigina „kirjutis”; pärast planner'i parandust jäi sama väljend veel arvufakti validaatori sissepääsust välja. Commit'id `3b40cb9d` ja `49b76109` laiendavad neid üldisi lepinguid, mitte konkreetset küsimust, artiklit, autorit ega protsente.

Lõppkordus tehti pärast deploy'd ja sama brauseriakna värskendamist samas autentitud vestluses:

| ID | kontrollvastus | esimene tekst / valmis | trace | hover-allikapaneel | seis |
|---|---|---:|---|---|---|
| J01 | vähemalt kord nelja kuu jooksul; Rakvere 5, Jõhvi 7, Narva 5 | 28 213 / 29 339 ms | `specific_research_fact`; identiteet `high`; selected = answer = displayed = Krista Schönbergi 2016 MAPPA artikkel; validator `all_claims_in_one_rendered_source`; retrieval 22 515 ms, model 2137 ms, validation 52 ms | avanes; üks vastust toetav MAPPA kaart | **DONE** |
| J02 | ligi 25% kergem teenus, 45% ööpäevaringne juhendamine, u 30% pidevad hooldustoimingud | 7877 / 8945 ms | `specific_research_fact` v2.5; identiteet `high`; selected = answer = displayed = Ainsaare/Ojasuu 2017 artikkel; `exact_numeric_fact_v5` PASS; retrieval 5760 ms, model 1386 ms, validation 19 ms | avanes; üks vastust toetav Ainsaare/Ojasuu kaart | **DONE** |

Praegune viimase muutumatu koodirelease'i koond:

| seis | arv |
|---|---:|
| DONE | **2/75** |
| PARTIAL | **0/75** |
| FAIL | **0/75** |
| NOT_PROVEN | **73/75** |

Koodirelease'i eelväravad olid i18n, kahe muudetud faili ESLint, `git diff --check` ja tootmisbuild; automaatteste ega test-, smoke-, probe-, benchmark- või E2E-faile ei loodud ega käivitatud. Korpust, Chroma/FTS5 indeksit, andmebaasi, mudelit, prompt'i, top-k väärtusi, fusion'i kaale, timeout'e ega serveri env-i ei muudetud. Kontrolli hetkel olid kohalik HEAD, `origin/main` ja puhas server SHA-l `49b761094f1ae80f486d13ddae682d0bea2ab72d`; kolm teenust olid aktiivsed, `/vestlus` vastas 200, health oli `ok=true` 49 727 vektori / 6089 dokumendiga ja FTS5 `ready=true` 49 727 lõigu / 6073 aktiivse registridokumendiga. Kontaktikontrolli timer oli aktiivne, viimane service-result `success` ja järgmine käik 30.08.2026.

### 25.08 J03 jätk — koodirelease `caf15cf8`

J03 kaks esmast sõnastust paljastasid ühe üldise põhjuse. Kontaktikanalite võrdlusküsimus läks vaikimisi MMR-rada, õige 2018. aasta artikkel jäi kärbitud sekundaarallikaks ning teised kriisijuhendid panid vastusesse eri allikate telefoninumbreid. Üks vastus peatati põhjusega `unsupported_numeric_claim` ja teine põhjusega `cross_source_numeric_mix`. Release `caf15cf8` valib nüüd ainult kontaktikanali semantilise tunnuse ning vähemalt kahe küsimuses nimetatud 3–8-kohalise koodi korral ühe järjestatud allikagrupi, mis sisaldab kõiki koode. Küsimust, numbreid, vastust ega artiklit koodi ei lisatud ning validaatorit ei lõdvendatud.

Canonical maatriksiküsimus nimetab selgelt 2018. aasta vaimse tervise esmaabi artiklit. Selle kontrollvastus saabus 28 613 ms-ga, valis ja kuvas ainult `sotsiaaltoo_vaimse-tervise-esmaabi-toole-2018`, säilitas õiged kriisitunnused ning telefoninumbrid 112 ja 1220. `exact_numeric_fact_v5` läbis põhjusega `all_claims_in_one_rendered_source`; dokumendiidentiteet oli `high`, selected = answer = displayed, retrieval oli 25 918 ms, model 1941 ms ja validation 15 ms. Vestlusemulli hoveri järel avanes ühe toetava kaardiga „Vastuste allikad” paneel.

Kaks üldise tänase kriisinõuna kõlanud sõnastust ei ole canonical ajaloolise publikatsioonifakti asendus. Ühes neist valiti õige 1144-märgiline tõend tervikuna ja faktivalidaator läbis, kuid atribuutika peitis ajaloolise artikli põhjusega `historical_source_not_current_evidence`; teises ei tekkinud range dokumendiidentiteedi/faktivalidaatori lepingut ja sama riskipiir peitis allika. Neid tulemusi ei loeta PASS-iks ning high-risk ajaloolise allika poliitikat ei nõrgendatud.

Praegune viimase muutumatu koodirelease'i koond:

| seis | arv |
|---|---:|
| DONE | **1/75** |
| PARTIAL | **0/75** |
| FAIL | **0/75** |
| NOT_PROVEN | **74/75** |

J01 ja J02 jäid release'i `49b76109` ajalooliseks tõendiks ega kandu automaatselt `caf15cf8` arvestusse. Automaatteste ega test-, smoke-, probe-, benchmark- või E2E-faile ei loodud ega käivitatud; korpust, indeksit, DB-d ega env-i ei muudetud.

### 25.08 J04–J11 release-eelne põhjuskaart — lähte-release `caf15cf8`

J04–J11 canonical plokk mõõdeti samas autentitud vestluses. J06, J08 ja J09 läbisid lähte-release'il vastuse, trace'i ning hoveriga avatud toetava allikapaneeli värava, kuid need tulemused on järgmise koodirelease'i järel ajaloolised ja tuleb üle korrata. J04, J05, J07, J10 ja J11 andsid sõnastustundlikud vead, mis reprodutseeriti enne koodimuudatust vähemalt kahe sõnastusega.

| ID | lähte-release'i tulemus | mõõdetud põhjus | release-eelne üldparandus | seis |
|---|---|---|---|---|
| J04 | canonical 23 593 / 24 951 ms: kolm omavalitsust õiged, ainult 1/4 põhiülesannet; allikapaneelil õige Perepesa artikkel. Artiklit ja aastat nimetanud variant 12 988 / 14 250 ms: täielik 4/4 | allikata nimega loeteluküsimus jäi MMR-i; õige 2019 artikkel oli teine ja sellest renderdati ainult kaks 547–548 märgi pikkust alguskatkendit | konservatiivne nimeankru, vähemalt kahe loendiarvu ja loeteluküsimuse kuju suunatakse ühe dokumendi faktirajale; oleviku-, KOV-, õigus- ja avastuspäringud on välistatud | **FAIL lähte-release'il; uus runtime NOT_PROVEN** |
| J05 | canonical 6648 ms ja parafraas 7158 ms: mõlemad palusid ekslikult valda või linna täpsustada; sama küsimus verbiga „oli” vastas 30 spetsialisti / 12 riiki ning 60 inimest / 19 riiki | arvuküsimus koos sõnaga „spetsialist” liigitas ajaloolise osalemisfakti KOV-i kontaktinimekirjaks | ET/EN/RU arv + osalemisverb välistab kontaktiraja, välja arvatud selge olevikuviide | **FAIL lähte-release'il; uus runtime NOT_PROVEN** |
| J07 | canonical 25 688 ms ja parafraas 26 613 / 26 786 ms: mõlemad vale keeldumine | sündmusperiood `2018–2020` muutus ekslikult allikate publikatsiooniaastateks; õige 2022 artikkel oli neljas ja ainult kaks 322-märgist alguskatkendit jõudsid konteksti; validaator peatas allikate arvusegu | piiritletud episood + aastavahemik + vähemalt kolm mõõdikupesa suunatakse ühe dokumendi faktirajale; aastavahemik märgitakse tõendiepisoodiks, kuid aastate kaupa/võrdluse/trendi rajad jäävad alles | **FAIL lähte-release'il; uus runtime NOT_PROVEN** |
| J10 | canonical 30 365 / 30 565 ms ja teine pikk sõnastus 40 666 / 40 666 ms: mõlemad kinnitasid ainult 150/75 minutit, kuid mitte 7–8 tunni und ega kuulmislanguse 2–5-kordset riski. Lühem otsene variant 9449 / 10 161 ms oli täielik | õige 2025 artikkel valiti, kuid kümnekohalise teematerminite loendi täitsid küsimuse grammatika ja paljas aastaarv enne `kuulmislangus`-ankrut; 12 tõendikehast renderdati esimesed 8 | paljas arv ja üldised küsimuse liimsõnad eemaldatakse ainult dokumendi teematerminitest; aasta jääb eraldi faktiterminiks | **PARTIAL lähte-release'il; uus runtime NOT_PROVEN** |
| J11 | canonical 12 641 ms ja teine sõnastus 26 065 ms: mõlemad vale värskete KOV-kontaktide keeldumine | õige Elin Küti artikkel valiti ja kuvati, kuid `artikli` ei sobinud allikavihje mustriga `artikkel…`; `sotsiaaltöötajate` käivitas seejärel eksliku kontaktivalidaatori `contact_inventory_unavailable` | eesti `artikl…` käändetüvi ja `kirjutis…` loetakse sõltumatu ajaloolise allika vihjeks | **FAIL lähte-release'il; uus runtime NOT_PROVEN** |

J11 kontrollvastus on seitse poolstruktureeritud intervjuud, neist kuus individuaalset ja üks kolme osalejaga grupiintervjuu, ning kolmeetapiline temaatiline analüüs. J07 kontrollarvud on 678 inimest, 273 vabatahtlikku, 21 600 tundi, 12 maakonda ja 43 omavalitsust. Ühtegi neist küsimustest, vastustest, nimedest ega arvudest koodi ei lisatud. Korpust, indeksit, DB-d, env-i, globaalseid top-k väärtusi, fusion'i kaale, mudelit, prompt'i ega timeout'e ei muudetud. Automaatteste ega test-, smoke-, probe-, benchmark- või E2E-faile ei loodud ega käivitatud. Enne deploy'd ja muutumatu release'i kordust on kogu uue ploki runtime ausalt **NOT_PROVEN**.

### 26.08 shadow-v2 ja structured contract'ide sihtkordus — release `77a30a3d`

Release `77a30a3d1551b369a01537d987c7ff25fbd25c88` kordus tehti pärast uue `.next` build'i ja
frontendiprotsessi tegelikku käivitamist. Esimene deploy-katse oli jõudnud ainult Git-pullini;
serveri vana build ning v4 trace ei olnud v5 koodi runtime-tõend. Täielik kordusdeploy lõpetas
build'i, migratsioonieelkontrolli, migratsiooniraja ja kolme teenuse restardi. Kontrollis kattusid
kohalik HEAD, `origin/main` ja puhas server; `/vestlus` vastas 200 ning RAG health oli `ok=true`
49 727 vektori / 6089 registrikirjega, FTS5 `ready=true` ja 6073 aktiivse registridokumendiga.

| ID | kontrollvastus | esimene tekst / valmis | trace | hover-allikapaneel | seis |
|---|---|---:|---|---|---|
| J08 canonical | 61%, 26%, 11%, 18%; küsimata 2%/3% puudusid | 13 299 / 16 505 ms | `requested_metric_contract_v1`, `bounded_evidence_subject_peer_alignment_v5`, 4/4; retrieval 10 503 ms, model 2140 ms, `exact_numeric_fact_v5` PASS; selected = answer = displayed | üks Vaike Vainu 2023 artikkel | **DONE** |
| J08 artikliankruga A | sama 61/26/11/18 | 16 825 / 19 994 ms | mapping v5, 4/4, validator PASS; selected = answer = displayed | üks sama Vaike Vainu artikkel | **PASS parafraas** |
| J08 artikliankruga B | sama 61/26/11/18 | 12 160 / 15 250 ms | mapping v5, 4/4, validator PASS; selected = answer = displayed | üks sama Vaike Vainu artikkel | **PASS parafraas** |
| J18 A | 5 kohtunikku, 5 erihoolekandeasutuse töötajat, 5 KOV-i sotsiaaltöötajat; kokku 15 | brauseriaeg mõõtja virtualiseerumisvea tõttu `NOT_PROVEN` | `uniform_participant_relation_v4`, retrieval 5264 ms, model 1066 ms, validator PASS; selected = answer = displayed | üks Erle Eenmaa 2022 artikkel | **PARTIAL** |
| J18 B | iga rühm 5, kogu valim 15 | brauseriaeg mõõtja virtualiseerumisvea tõttu `NOT_PROVEN` | sama relation-contract; retrieval 5286 ms, model 1454 ms, validator PASS; selected = answer = displayed | üks sama Eenmaa artikkel | **PARTIAL** |
| J07 canonical | 678 inimest, 273 vabatahtlikku, 21 600 töötundi, 12 maakonda, 43 omavalitsust | 12 871 / 16 055 ms | `period_role=evidence_episode`, `evidence_period_years=[2018,2020]`, high identity; retrieval 9389 ms, model 1744 ms, validator PASS; selected = answer = displayed | üks Krista Pagolainen-Saare 2022 artikkel | **DONE** |

J08 tõendab requested-scope veaklassi sulgemist, mitte kogu numeric RAG-i. Contract tuletatakse
ainult lõplikult renderdatud tõendist ja seda kasutatakse generaatori piiramiseks; olemasolev
validator jääb sõltumatuks lõppväravaks. J18 tõendab kitsast osalejarühma/koguarvu relation'i;
asutuste katvusarve ei käsitleta osalejate arvuna ega lisata küsimata vastusesse. FAIL-i korral
on `displayed_sources=[]`, kuid selected context säilib trace'is.

Praeguse SHA range maatriksivaade on **DONE 2/75 · PARTIAL 1/75 · NOT_PROVEN 72/75**.
Ajalooline koond jääb **DONE 21/75 · NOT_PROVEN 54/75**. Ülejäänud juhtumeid ei kanta sellele
SHA-le üle. Typed temporal retrieval, author/year/history precedence, legal/KOV exact retrieval,
terviklik supporting→displayed atribuutika, `FINAL_SHA`, kogu 75 täisring ja ettevalmistamata
juhuküsimused on endiselt tegemata.

### 26.08 typed aastarolli runtime-järelkontroll — release `6a7f0534`

Pärast release'i `6a7f0534b4f7562d6e99be0b9b6e462ca2e28883` deploy'd kontrolliti sama
autentitud vestluse shadow-v2 radu. Planneri aastamainimised säilitasid mainimise identiteedi:
`2023. aasta artikkel` märgiti `document_source_year`-iks ja `2022. aasta uuring`
`evidence_year`-iks. Projektsioon `document_source_years` sisaldas ainult `2023`-e; uuringu
aasta ei läinud enam dokumendi avaldamisaasta filtrisse.

J08 samas variandis olid requested-slotid täielikud: 4 unikaalset `proportion`-slotti,
`recognized_clause_count=3`, `emitted_slot_count=4`, `complete=true`, `input_form=original`.
Renderdatud tõendi slotikaardistus oli siiski `mapped_slot_count=0`, mistõttu generaator lisas
küsimata 2%/3%. Olemasolev fail-closed validaator peatas vastuse; see on järgmise
`requested_metric_contract`-i stabiliseerimisploki diagnoos, mitte slotiekstraktori PASS.

J03 täpne ajaloolise artikli küsimus andis sisuliselt õige kriisitunnuste ning 112/1220 vastuse
ja valis õige 2018. aasta dokumendi, kuid allikapaneel jäi kuvamata, sest atribuutika otsustas
`historical_source_not_current_evidence`. Seda ei loeta PASS-iks. Seevastu Vaike Vainu 2023
küsimuse juures kontrolliti hoveriga avatavat „Vastuste allikad” paneeli ja õige toetav
allikakaart oli nähtav.

Selle release'i range aktiivne maatriksivaade on **DONE 0/75 · PARTIAL 0/75 · NOT_PROVEN
75/75**. Ajalooline koond jääb **DONE 21/75 · NOT_PROVEN 54/75**; varasemate SHA-de PASS-e ei
kanta uuele release'ile üle. Kontrollhetkel olid kohalik HEAD, `origin/main` ja serveri
checkout samal SHA-l, frontend/RAG/research-worker aktiivsed, `/vestlus` HTTP 200, RAG health
`ok=true` ning kontaktikontrolli timer aktiivne ja viimase teenuse tulemus `success`. Järgmine
plokk on requested-metric mapping lõplikult renderdatud tõendil; typed temporal promotion,
author/year/history precedence, legal/KOV exact retrieval ja supporting→displayed atribuutika
on jätkuvalt `NOT_PROVEN` või osalised.

### 26.08 J08 v6 tõendikeha-/lauseulatuse kordus — release `d62f11d6`

Pärast `20d876630` märgivahemiku ja `daf0e8dd` kandidaatide säilitamise parandusi jäi J08
canonical veel `rendered_evidence_mapping_incomplete` olekusse. Juurpõhjus ei olnud retrieval
ega validator: koordineeritud riskirühmade peer-väärtused pidid endiselt olema samas PDF-i
fragmendis, kuigi pehme `�` eraldaja võis ühe tõendilause poolitada. Commit `d62f11d6` säilitab
renderdatud tõendikeha ning lauseulatuse; peeri võib siduda üle pehme eraldaja ainult samas
kehas, samas lauseulatuses, sama sulgussügavusega ja 640 märgi sees. Muud arvud, mudel,
validator, top-k, fusion, korpus ja indeks jäid muutmata.

Täieliku deploy järel (esimene katkestatud artefaktikäik ei olnud runtime-tõend) kattusid kohalik
HEAD, `origin/main` ja server SHA-l `d62f11d6`; kolm teenust olid aktiivsed. Sama autentitud
vestluse canonical andis ainult 61% / 26% / 11% / 18%. Trace oli v6 4/4, validator PASS ning
selected = answer = displayed sisaldas üht Vaike Vainu 2023 artiklit; hoveri järel avanes
„Vastuste allikad” paneel ühe sama kaardiga. Selge artikliankruga küsiv B-parafraas läbis sama
värava ja andis samuti ainult 61/26/11/18. B trace: retrieval 9695 ms, model 4510 ms,
validation 72 ms; käsitsi esimese teksti ja lõppaja mõõt jäi `NOT_PROVEN`.

Nimisõnaline loeteluvariant („millised neli osakaalu …”) ei loonud requested-slot'e ning
contract ei aktiveerunud; see jäi puuduliku vastusega üheks eraldi planneri sõnastuspiiriks.
Seda ei loeta J08 canonicali ümberlükkeks ega parandata küsimusepõhise erandiga, kuid üldine
nimisõnaliste slotiloendite katvus on `NOT_PROVEN`. Aktiivse SHA range maatriksivaade on
**DONE 1/75 · PARTIAL 0/75 · NOT_PROVEN 74/75**; ajalooline koond jääb
**DONE 21/75 · NOT_PROVEN 54/75**.

### 26.08 production temporal-värav — release `33c0a255`

Täielik deploy viidi lõpuni pärast fast-forward'i `main`-i, `origin/main`-i ja serveri
checkout'i samale SHA-le `33c0a25535204e0b59c891d275b7c851766a3e7a`. Aktiivne frontend-artifakt
oli `/home/ubuntu/apps/sotsiaalai-deploy-backups/frontend-current-20260826T101126Z-33c0a255.tar.gz`
ja build-ID `h3m-8k4N_u0JX4Z5raMui`; frontend, RAG ja research-worker olid aktiivsed,
`/vestlus` vastas 200 ning RAG health oli `ok=true`, FTS5 `ready=true` (49 727 lõiku,
6073 aktiivset registridokumenti). Automaatteste, probe'e, smoke- ega E2E-radu ei loodud
ega käivitatud.

Kasutati kuut uut autentitud brauserikontrolli. Trace'i täielikke planneri- ja
fact-validation-välju tavakasutaja vastuse-/run-API ei väljasta; allpool on seepärast
eristatud nähtav vastus, hoveriga avatud allikakaart ja `NOT_PROVEN` trace-väli.

| sentinel | täpne tulemus | allikapaneel / trace | seis |
|---|---|---|---|
| mixed source/evidence year — „Vaike Vainu 2023. aasta artikli järgi: kui suur osa hooldajatest vajab 2022. aasta uuringu kohaselt täiendavat abi, kui suur osa vajab mõne tegevuse juures palju abi ning kui suur osa hooldajatest kuulub suure ja keskmise abivajadusega riskirühma?” | 61%, 26%, 11%, 18%; vastus sisaldas ainult nelja küsitud osakaalu | hoveriga avanes üks Vaike Vainu 2023 kaart; nähtav vastus oli õige, kuid `document_source_years`, `evidence_years`, `requested_metric_contract=4/4` ja validator PASS ei olnud user-API-st loetavad | **PARTIAL / trace NOT_PROVEN** |
| J03 ajalooline 2018 küsimus — „Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada, 112 või 1220, 2018. aasta artikli järgi?” | sisuliselt õige vastus, 112 ja 1220 | hoveriga ei ilmunud allikanuppu; API kinnitas `sources=[]`, `displayed_sources=[]`; varasem põhjus on `historical_source_not_current_evidence`, seega `current_evidence_scope=source_bounded` ei ole runtime'is tõendatud | **FAIL allikaväravas / temporal NOT_PROVEN** |
| J07 ekraanipildi täpne sõnastus — „Kui palju inimesi ja vabatahtlikke osales ning kui suur oli töötundide, maakondade ja omavalitsuste arv 2018–2020 katseetapis 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust“ järgi?” | keeldumine: „Kasutatud allikakatkenditest ei saa … piisavalt üheselt kinnitada.” | hoveriga allikanuppu ei tekkinud; sama dokumendi mõõdikud saadi lähedase, kuid selgema slotisõnastusega, mis andis 678 / 273 / 21 600 / 12 / 43; sellel variandil avanes hoveriga üks Krista Pegolainen-Saare 2022 kaart | **FAIL sõnastustundlikus retrieval/evidence-rajas** |
| J07 selge mõõdikukontroll — „2022. aasta artikli … järgi: mitu inimest sai teenust, mitu vabatahtlikku osales, mitu töötundi tehti ning mitmes maakonnas ja mitmes omavalitsuses tegutseti 2018–2020 katseetapis?” | 678, 273, 21 600, 12, 43 | hoveriga avanes üks toetav Krista Pegolainen-Saare 2022 kaart; API-s `sources` ja `displayed_sources` kattusid; `period_role=evidence_episode` ja faktivalidaatori PASS-i täielik trace jäi user-API-st `NOT_PROVEN` | **PASS nähtava vastuse/allika piires; trace PARTIAL** |
| publication-year — „Mis aastal avaldati Erle Eenmaa artikkel „Psüühilise erivajadusega inimese osalus oma eestkostes“?” | 2022 | hoveriga avanes üks Erle Eenmaa 2022 kaart; `requested_year_role=publication_year`, `temporal_decision_source=typed_temporal_contract` ja `temporal_year_mode=publication_year` ei olnud user-API-st loetavad | **PASS nähtava vastuse/allika piires; typed trace NOT_PROVEN** |
| vene evidence-year — täpne küsimus „В каком году проводилось исследование о нагрузке по уходу?” | vastas 2009, mitte Vaike Vainu 2022 uuringu aasta | allikanuppu ei ilmunud; sama küsimus koos Vaike Vainu 2023 artikliankruga vastas 2022, kuid ka sellel ei olnud kasutajale kuvatavat allikakaarti; `requested_year_role=evidence_year` ei olnud tõendatav | **FAIL ankurdeta RU-rada; anchored variant NOT_PROVEN** |
| explicit current — „Milline on praegu kehtiv erihoolekandeteenuste õiguslik alus Eestis?” | sisuliselt õige tänane SHS-vastus | vastus ei toonud hoveriga allikanuppu; `current_evidence_scope=current` ja `current_status_decision_source=typed_temporal_contract` ei olnud user-API-st loetavad, seega downstream-allika puudumist ei nimetata automaatselt temporal-veaks | **NOT_PROVEN typed trace; nähtav vastus sisuliselt õige** |

Järeldus: mixed-year, J07 selge mõõdikuküsimus ja publication-year vastus töötasid nähtava
vastuse ning avatud allikakaardi tasemel. Kaks ekraanipildil olevat juhtumit ei ole sama klassi:
J03 leidis õige sisu, kuid ajalooline source-attribution peitis allika; J07 täpne loomulik
sõnastus ei jõudnud sama evidence/metric-katteni, kuigi lähedane selgem variant jõudis. Vene
ankurdeta aasta küsimus näitab lisaks, et evidence-year sõltub endiselt valitud allikaskoopist.
`33c0a255` temporal production-closure'i ei märgita valmisolevaks ning author/year/history
precedence'i tööd ei alustata enne nende tulemuste omaniku järgmist otsust. Enne ametlikku
mixed-year kontrolli käivitati üks liiga lai prooviküsimus, mis andis 45%/31%; seda ei loeta
üheks kuuest sentinelist.

### 26.08 bounded-episode koordinatsiooni runtime-värav — release `db119fa2`

Pärast commit'i `db119fa237447baa66a9782d2a0efa90429abcd0` fast-forward'i, `origin/main` push'i ja
täielikku production-deploy'd kattusid kohalik `main`, `origin/main` ja serveri `main` sama SHA-ga.
Frontend-artifakt oli `frontend-current-20260826T112937Z-db119fa2.tar.gz`, build-ID
`pJ8sPbS1iDBEGfxvHiu5S`; frontend, RAG ja research-worker olid aktiivsed, `/vestlus` vastas 200 ning
RAG health oli `ok=true`, FTS5 `ready=true` (49 727 lõiku, 6073 aktiivset registridokumenti).
Automaatteste, probe'e, smoke- ega E2E-radu ei loodud ega käivitatud.

Kõik kolm küsimust saadeti eraldi autentitud tühjas vestluses. Allikakaart avati vastusemulli hoveri
järel, kui vastusel oli „Vastuste allikad” nupp.

| sentinel | planner / trace | nähtav vastus | allikapaneel | seis |
|---|---|---|---|---|
| J07 täpne varem failing-sõnastus | `query_plan.mode=specific_research_fact`; `bounded_episode_metric_fact=true`; `period_role=evidence_episode`; `evidence_period_years=[2018,2020]`; viis metric-slot'i; document identity `matched=true`, `confidence=high`; fact-validation `passed=true` | 678 inimest, 273 vabatahtlikku, 21 600 töötundi, 12 maakonda, 43 omavalitsust | hoveriga avanes üks Krista Pegolainen-Saar 2022 kaart; selected/supporting/displayed ID kattusid | **PASS** |
| J07 varasem passing-sõnastus | `query_plan.mode=temporal`; küsimuse planner `specific_research_fact`, kuid `bounded_episode_metric_fact=false`; `query_count=6`; document identity `required=true`, `matched=false`, `confidence=low`; fact-validation `passed=false`, `reason=document_identity_unconfirmed` | keeldumine: „Kasutatud allikakatkenditest ei saa küsitud arvu, ulatust ja aastat piisavalt üheselt kinnitada.” | nuppu ei kuvatud; `displayed_source_ids=[]`; selected contextis 8 allikat, sh õige 2022 dokument | **FAIL — sõnastustundlik temporal-route / identity** |
| Tavaline 2018–2020 aastavõrdlus | `query_plan.mode=temporal`; `period_role=breakdown`; `bounded_episode_metric_fact=false` (`not_applicable`); `breakdown_years=[2018,2019,2020]`; `temporal_query_contract=temporal_query_contract_v1`; `query_order=temporal_year_queries`; `selection_strategy=temporal_year_coverage` | keeldumine; fact-validation `passed=false`, `reason=cross_source_numeric_mix` | nuppu ei kuvatud; `displayed_source_ids=[]`; selected contextis 8 allikat | **PASS — temporal route / production-closure READY; fact-validation eraldi** |

Esimene sentinel kinnitab uue koordinatsioonivärava tootmisrajal. Teine valis temporal-route'i,
ei ankurdunud dokumendile ja jäi õigesti fail-closed. Kolmas jäi nõutud temporal/multi-year rajale
ning bounded-episode ei aktiveerunud, kuid mitme allika numbriseos blokeeris vastuse. Kuna 2. ja 3.
kontrolli vastus jäi `cross_source_numeric_mix` tõttu fail-closed, kuid temporal route ise on
serveri run-trace'iga kinnitatud. Temporal production-closure on seega **READY**; `cross_source_numeric_mix`
on eraldi evidence/fact-validation veaklass. Eelmise täpse J07 allikapaneeli avanemise `NOT_PROVEN`
on UI/source observability piir, mitte temporal blocker. Tõendiks on PostgreSQL `rag_search`
`cmta1aeo2001jqukm3ijroq03` (2026-08-26 11:52:04.802 UTC) ja paariline `rag_trace`
`cmta1ahvt001nqukm0wwi15qf` (11:52:08.969 UTC); release'i kood-SHA oli `7c4b1c3aeab4079043d0e8b8752d58b9a84851e7`.

### 27.08 viie runtime-veaklassi sihtvärav — koodirelease `3303466a`, seis PARTIAL

Lähte-release `97f47673` reprodutseeris J08 puuduva `26%`, lühikese J18 identity-vea, kaks
KOV-kontaktirajale eksinud töötajaküsimust, temporal `cross_source_numeric_mix` keeldumise ja
J03 puuduva kuvatud allika. Esimene parandusrelease `47f490b1` parandas J18 ning KOV-i piirid;
sama vestluse järeltrace paljastas J08 koordineeritud ühismäärangu ja iseseisvate küsimuste
history-lekke. Lõplik `3303466a8affc74fc3bdce45f4da34fca8928129` lisas nende kahe põhjuse
paranduse ilma küsimuse vastuseid või protsente hardcode'imata ning ilma fail-closed validaatorit
lõdvendamata. Allpool on iga sentineli tegelik SHA-põhine runtime-seis; varasema release'i PASS-i
ei kanta viimasele SHA-le üle.

| sentinel | nähtav vastus | trace / allikapaneel | lõppseis |
|---|---|---|---|
| J08 canonical | `61% / 26% / 11% / 18%`, küsimata arve ei lisatud | requested-slot 4/4, validator PASS; üks Vaike Vainu 2023 allikas valitud ja kuvatud | **PASS** |
| J18 lühike `Erle Eenmaa + 2022 + artikkel` | release'il `47f490b1` kolm sihtrühma × 5, kokku 15 | täpne current-turn metadata-confirmation sidus ühe Eenmaa 2022 `document_id`; pärast shared retrieval/history muudatust ei korratud | **PASS `47f490b1`; `3303466a` NOT_PROVEN** |
| omavalitsustes töötavate sotsiaaltöötajate tugi | runtime'il `3303466a` sisuline juhtumipõhise nõustamise, võrgustikutöö ja supervisiooni vastus | mode `default`; RAG käivitus; kontaktikontekst puudus ja kontaktide arv oli 0; 2/2 vastust toetavat/kuvatud allikat | **PASS `3303466a`** |
| lastekaitsetöötajate toetamine | runtime'il `3303466a` sisuline lapse heaolu hindamise vastus | mode `default`; RAG käivitus; kontaktikontekst puudus ja kontaktide arv oli 0; 2/2 vastust toetavat/kuvatud allikat | **PASS `3303466a`** |
| Rakvere päris kontaktiküsimus | release'il `47f490b1` kaks nime ja telefoniread | kontaktiregistri rada säilis; pärast shared retrieval/history muudatust ei korratud | **PASS `47f490b1`; `3303466a` NOT_PROVEN** |
| seltsiliste 2018/2019/2020 trend | kontrollitud üldkeeldumine | current-only temporal `[2018,2019,2020]`; valitud/renderdatud tõendis puudus kvalifitseeruv 2020 rida, top-level validator `cross_source_numeric_mix`, binding `temporal_year_value_not_answered`, `displayed_sources=[]` | **PARTIAL: ohutus PASS, trend NOT_PROVEN** |
| J03 kriisitunnused ja 112/1220 | sisuliselt õige vastus | validator PASS; avatud paneelis Külli Mäe 2018 artikkel | **PASS** |

Mitmeaastase küsimuse algallikas tõendab ainult 2018–2020 koondperioodi, mitte kolme aastapunkti.
Seetõttu ei muudeta selle kontrollitud keeldumist vastuseveaks: parandus tõendab, et vale ajaloo-
ja allikaseos ei lähe kasutajale ning tulevane õigesti seotud `year + value + source_id` rida saab
läbida. Täpse aastatrendi jaoks vajalik võrreldav tõend on selles valimis `NOT_PROVEN`.

Esimene kontrolliplokk tehti autentitud vestluses `d688c823-e383-4c5b-b394-6c64333683c5`.
Kaks KOV-i küsimust korrati lõplikul runtime'il värskes autentitud vestluses
`085619d0-ab1b-4cfd-a24f-da13eb2b8137`; nende sõnumi- ja trace-ID-d on süsteemiauditi §45.2-s.
Runtime-kontrolli hetkel kattusid kood, server ja aktiivne frontend-artifakt SHA-l `3303466a`;
kolm teenust olid aktiivsed, `/vestlus` vastas 200 ning RAG,
originaal-FTS ja lemma-FTS olid valmis. Scoped lint, süntaksikontroll, diff-kontroll, i18n ja
tootmisbuild olid rohelised. Automaatteste, probe'e, smoke-, benchmark- ega E2E-radu ei loodud
ega käivitatud. Runtime'il `3303466a` on kinnitatud J08, mõlemad KOV-i sisuküsimused ja J03;
J18, päris kontaktiregressioon ning sisuline kolmeaastane trend jäävad selle SHA suhtes
`NOT_PROVEN`. Seda sihtväravat ei kanta üle kogu 75 juhtumi ringile: 75/75 ja kõik mõõtmata
variandid jäävad `NOT_PROVEN`.
