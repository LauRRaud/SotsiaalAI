# Arendusteekaart: SotsiaalAI teadmistemootorist eraldi tooteks

**Versioon:** 0.1  
**Koostatud:** 05.09.2026  
**Otstarve:** ühine suunadokument omanikule, arhitektuuri aruteluks ja Codexi järgmiste tööülesannete piiritlemiseks.

See ei asenda kehtivat M2.2 ülesannet, ADR-e ega repositooriumi aktiivset seisukirjet. M0–M6 tähised säilivad. Teekaart ei anna korraldust kõiki etappe korraga ehitada, käivitada välismudelite päringuid või muuta tootmiskeskkonda. Detailne ülesanne ja vastuvõtt määratakse ühe tööploki kaupa.

## 1. Siht

Arendame oma serveris käitatavat, mudelitest ja kasutajaliidesest eraldatavat teadmistesüsteemi. SotsiaalAI on selle esimene kasutuskoht; hiljem peab sama tuum töötama teise organisatsiooni materjalide ja valdkonnaseadistusega.

Toode peab aitama vastata kolmes ulatuses:

| Ulatus | Näide kasutaja vajadusest | Oodatav käitumine |
| --- | --- | --- |
| Konkreetne teave | Teenuse kontakt, taotlemise samm või artikli seisukoht | Õige allikakoht, aeg ja piirkond; vajalikud tingimused säilivad. |
| Mitme allika ühendamine | Oma sõnadega kirjeldatud mure ja võimalik abi | Seotud teenused ja juhised, teadaolevad erandid, vajaduse korral täpsustusküsimus. |
| Lai süntees | Sotsiaaltöö areng kümne aasta jooksul | Ajaliselt ja temaatiliselt põhjendatud ülevaade, algallikad, vastuolud ja katvuse lüngad. |

Me ei ehita automaatset toetuste määramise ega inimeste õiguste üle otsustamise süsteemi. Esimese toote ülesanne on teabe leidmine, põhjendatud selgitamine ja sobivate järgmiste sammude kirjeldamine.

Põhimõtted: haldaja koondatud materjalid; lõppkasutajalt ei nõuta dokumentide üleslaadimist; eesti, inglise ja vene keele arvestamine; oma hallatav ingest, register, otsing ja seosed; kohustuslike tasuliste RAG-teenuste puudumine. Luna on peamine vastaja, mitte agentide ahela viimane lüli. Tavapärase päringu siht on üks genereeriv kutse. Embedding'u arvutus ja valikuline ingest'i rikastamine on eraldi arvestatud mudelitöö.

## 2. Praegune asukoht

| Osa | Viimane teadaolev seis | Mida see veel ei tõenda? |
| --- | --- | --- |
| M0 — lähteprojekti audit | Dokumenteeritud. | Hilisemate serverimuudatuste kontrolli. |
| M1 — ingest | Näidis-PDF ja JSON töödeldud; raporteeritud 22 läbinud testi. | Kogu materjalikogu, kõigi paigutuste ja failitüüpide kvaliteeti. |
| M2.1 — kohalik otsing | PostgreSQL + Qdrant; 7 ühiktesti ja 11 päristeenuste integratsioonitesti raporteeritud läbinuna. | Testvektorid ei tõenda semantilist otsingukvaliteeti. |
| M2.2 — pärisembedding'u proov | Ülesanne olemas; omaniku sõnul toimub testimine serveris. | Uut tulemuste raportit pole selle kaardi koostamisel üle vaadatud. Valmimist ega tegelikku mudelikasutust ei eeldata. |
| M3–M6 | Kavandatud arendussuunad. | Semantilist sõltuvusgraafi, Luna tervikvastuseid, ajaloolist katvust ega tootmiskõlblikkust pole senise aruandega tõendatud. |

Seis põhineb lisatud arendusdokumentidel ja omaniku teadetel, mitte selles töövoorus tehtud serveriauditil. `verification.json` eristab tehnilisi tulemusi ja tõendamata omadusi [P1]. Aktiivse teostusseisu allikaks jääb projekti `SotsiaalAI.md` S1.0, nagu senised arendusdokumendid määravad [P2].

## 3. Põhiteekond ja vahetulemused

**Töökindel ingest → sisuliselt hinnatud otsing → tingimusi säilitavad seosed → Luna vastused → laiad ja ajalised ülevaated → hallatav teenus → sama toode teise kliendi juures.**

Turve, andmekvaliteet, testimine ja käitamine kulgevad kogu teekonnaga paralleelselt. Etapi number ei tähenda, et selle ettevalmistus peab ootama kõigi eelmiste etappide lõppu.

| Etapp | Põhieesmärk | Käegakatsutav väljund | Edasiliikumise alus |
| --- | --- | --- | --- |
| **M2.2: pärisotsing** | Näidata, mida tegelikud embedding'ud lisavad. | Märksõna-, vektor-, hübriid- ja struktuuriga otsingu võrdlus; kompaktne vastamiskontekst täieliku auditi kõrval. | Vajalik algtekst jõuab konteksti; vead ja kulud on küsimuste kaupa nähtavad. Üks artikkel jääb kitsaks prooviks. |
| **M1/M2 laiendamine** | Vältida ühe näidise järgi optimeeritud süsteemi. | Esinduslik, lubatud kasutusega materjalivalim: artiklid, juhendid, teenused, kontaktid, eri piirkonnad ja versioonid. | Parseri, metaandmete ja otsingu toimimine on hinnatud ka muul materjalil; avastatud piirangud on kirjeldatud. |
| **M3: sisuline sõltuvuskiht** | Kaasata määravad tingimused ja erandid. | Allikatega põhjendatud seosed; päringupõhine piiratud läbimine; puuduvate ja vastuoluliste sõltuvuste käsitlus. | Kauges lõigus või teises dokumendis olev tingimus jõuab paketti; puuduva teadmise korral ei teeselda täielikkust. |
| **M4: vastamine ja allikavaade** | Teha toimiv tervik SotsiaalAI sees. | Luna adapter, vastuseosade viited, täpsustusküsimused, piiratud vestluskontekst, autentimine ja allikate avamise õigused. | Vastuse õigsus, tingimuste säilimine, kasulikkus ja viidete tugi on kontrollitud; rolli- ja isikusegaduse katsed läbivad. |
| **M5: ajaline ja kogu korpuse rada** | Ühendada paljude dokumentide teadmine. | Teema- ja perioodikatvus, allikatega ülevaated, oluliste muutuste põhjendused ning lünkade esitamine. | Üldistus toetub mitmele sobivale allikale; varasemat ja hilisemat seisu ei segata. Kümnendi võimekus vajab kümnendit katvat materjali. |
| **M6: käitamine ja piloot** | Muuta teostus hallatavaks teenuseks. | Haldus, uuendused, taastamine, kustutamine, piiratud juurutus, koormus- ja kulumõõtmised ning eraldatavuse kontroll. | Reaalsed taastamis- ja õiguskatsed, nähtavad tõrked ning kokkulepitud piloodiulatus. Vajalik miinimum valmib enne päriskasutust. |
| **Tootestamine pärast esimest kontrollitud pilooti** | Tõendada ülekantavus ja kliendiväärtus. | Teise kliendi kasutuselevõtt, valdkonnaprofiil, dokumenteeritud liides, kasutustingimused, toe ja hinna mudel. | Teist klienti ei teenindata tuuma kopeerides ja ümber kirjutades; kasutuselevõtu- ja halduskulu on teada. |

M1/M2 laiendamine on olemasoleva aluse arendamine, mitte uus kohustuslik alamprojektide ahel. Tootestamine on suunasiht; selle detailne tööülesanne ei ole veel kinnitatud.

## 4. Kuidas etappe sisuliselt arendame?

### M2.2: kõigepealt tõendatud otsing, mitte uus arhitektuur

Jätkame olemasoleva PostgreSQL-i leksikaalse kanali, Qdranti ja tulemuste ühendamisega. Pärisvektorite proov ning kompaktse konteksti loomine on juba kehtivas ülesandes. Testipäringute algtekstiline ootus peab olema järjestajast sõltumatu. Tühja tõendi ja teenusetõrke eristamine säilib [P3, P5].

Pärast ühe artikli proovi lisame päris segavaid dokumente, teistsuguseid sõnastusi ning uusi allikakohti. Eesti, inglise ja vene keele tulemused esitatakse eraldi; ühe küsimuse tõlked ei ole kolm sõltumatut olukorda. Uus lemmatiseerija või ümberjärjestaja lisandub ainult mõõdetud puudujäägi korral, mitte teekaardi olemasolu tõttu.

### Materjalivalim kasvab koos võimekusega

| Arendatav võime | Järgmine vajalik materjal |
| --- | --- |
| Ingest ja esmane otsing | Praegune artikkel ning erineva paigutusega pärisartiklid. |
| Tingimused ja praktiline abi | Teenusekirjeldus, seotud juhend või määrus, erand ja kontakt; vähemalt mõni eristatav piirkond. |
| Aeg ja uuendamine | Sama allika muutunud versioonid ning lisanduv dokument, mis muudab varasemat järeldust. |
| Ajalooline süntees | Kogu soovitud perioodi esindavad artiklid ja asjakohased ametlikud materjalid. |
| Ülekantav toode | Teise organisatsiooni tegelikud materjalid, küsimused ja õigused. |

Olemasolevaid metafailide kasulikke andmeid säilitame koos päritoluga. Tervet korpust ei korrastata pimesi ühe näidise reeglite järgi. Veebilehed, mitmeveerulised PDF-id, tabelid ja vormid lisanduvad vajalike adapterite ning pärisnäidiste kontrollidega. OCR pole automaatne lisakiht: seda kaalutakse tekstikihita materjali tegeliku vajaduse korral. Haldaja võib materjale alguses jätkuvalt importida; automaatne piiratud allikajälgimine lisandub hiljem vajaduspõhiselt.

### M3: väike kontrollitav graaf enne suurt automaatset graafi

Eristame teksti struktuuri, otsinguabi ja kohustuslikke sisulisi sõltuvusi. Praegu teostatud struktuurne naabrilaiendus ei ole veel teenuste eelduste ega erandite graaf [P3].

Alustame kontrollitud väikese sõltuvuste kogumiga. See eristab kahte katset: kas graafi kasutamine aitab siis, kui seosed on õiged, ning kas seoste automaatne eraldamine on piisavalt täpne. Keelemudelit võib kasutada valikulisel ingest'i rikastamisel; tulemused salvestatakse koos allika ja kontrolliseisuga.

Graafi eesmärk pole käsitleda kõiki arutlevaid artikleid jäikade reeglitena. Kohustuslikku erandit ei eemaldata üksnes madala otsingusarnasuse tõttu. Teadmata asjaolu ei võrdu täitmata tingimusega. Puudulik graaf ei tõenda kõigi tingimuste kontrollimist; vajaduse korral antakse osaline või tingimuslik vastus.

### M4: esimene päriselt kasutatav SotsiaalAI tervik

Luna saab kompaktse allikapõhise konteksti. Täielikud tehnilised identifikaatorid, indeksisammud ja räsid jäävad kohalikku auditisse. Vastuses kasutatud viide lahendatakse tegelikuks allikakohaks, mitte mudeli väljamõeldud aadressiks.

Tavapärane küsimus ei käivita agentide ahelat. Täpsustusküsimuse võib Luna anda sama vastuse osana. Kontaktide, arvude ja tähtaegade puhul eelistame kontrollitud andmevälju. Puuduv isikuandmestik piirab kohaldatavuse järeldust, mitte automaatselt kogu kasuliku üldinfo andmist.

Vestlusmälu esimene ulatus on asjakohane ajalugu ja kontrollitav kontekst: kelle olukorrast räägitakse, mida kasutaja ütles ning mida ta parandas. Assistendi oletus ei muutu kasutajafaktiks. Pikaajaline profiil ei ole esimese tervikversiooni nõue. Kliendi saadetud ajalugu ega roll ei asenda serveri õiguskontrolli [P6].

Luna täpne API-identifikaator kontrollitakse ühendamisel tegelikust seadistusest ja lubatud proovist; projektis olev nimekuju ei ole saadavuse tõend [P6].

Esimene kasutatav versioon valmib M4 ja piloodiks vajaliku M6 miinimumi koosmõjul, mitte pärast kõigi tulevikuideede teostamist.

### M5: kümne aasta ülevaade on eraldi vastamisrada

Moodustame dokumendiregistri põhjal perioodide ja teemade katvuse. Ülevaated aitavad leida alusmaterjali, kuid olulised muutuseväited seotakse algallikatega. Kokkuvõttest peab saama liikuda tagasi algteksti juurde; otsing peab pääsema ka kokkuvõttes märkamata jäänud materjalini.

Eristame arutelu, ettepanekut, katsetust, kehtestamist, rakendamist ja hinnatud tulemust. Ühe teema sagedasem kajastamine ajakirjas ei muutu ilma lisatõendita väiteks praktika üldise leviku kohta. Puuduv aasta on katvuse lünk, mitte tõend muutuste puudumisest.

Microsoft GraphRAG-i globaalotsing on võrdlusallikas: see kasutab kogukonnakokkuvõtteid ja mitmeetapilist vastamist [V1]. Meie ei võta tervet töövoogu automaatselt üle. Alustame piisava eeltöötluse ning piiratud lõppkontekstiga; keerukas süntees võib vajada eraldi eelarvestatud lisatööd. See ei muuda lisakutseid kõigi päringute vaikekuluks.

### M6: haldus ja tootmiskõlblikkus kasvavad paralleelselt

Haldaja peab nägema, millised allikad on imporditud, vigased, ülevaatust vajavad või aegunud, ning kuidas konkreetne vastus nendega seostub. Alustame olemasolevast töötlusaruandest ja lisame vajaliku haldusliidese.

Allikamuudatus peab uuendama seotud andmeid. Ka uus dokument võib muuta vana vastuse puudulikuks, kuigi vana viidatud tekst ei muutunud. Mõõdame nii aegunud tulemuste riski kui ka tarbetu ümbertöötluse mahtu. Alguses võib uuendamine olla konservatiivselt laiem; selektiivne optimeerimine lisandub pärast korrektsuse tõendamist.

Päriskasutuse eeldused on serveripoolne autentimine, organisatsioonide eraldatus, allikavaate õigused, logide ja mälu andmehoidmise piirid, materjalide kasutuse ja välismudelitesse saatmise poliitika, varundusest taastamine ning kokkulepitud kustutamine. Qdranti teenusevõti üksi ei asenda rakenduse kasutajaõigusi. Selle ise majutatava versiooni turvaseadistus tuleb eraldi läbi teha [V2].

Allikad on andmed, mitte käivitatavad juhised. M4 ja piloodi testides kontrollime ka dokumenti peidetud käske ning andmete lubamatut väljastamist; OWASP kirjeldab sellist kaudset juhisesüsti riski [V3]. Juhendtekst mudelile üksi ei ole täielik kaitse.

Koormuskatsed mõõdavad otsingut ja genereerimist eraldi, samuti külma/sooja vahemälu ning samaaegseid päringuid. Serverisse kopeerimine või ühe käsu õnnestumine ei võrdu tootmisvastuvõtuga.

## 5. Millal midagi kasutusse või müüki anda?

| Väljalase | Mida võib näidata või lubada? | Piir |
| --- | --- | --- |
| **Arendaja otsinguproov: M2.2** | Pärisküsimuse leitud algtekstid, võrdlusrajad, kasutus ja vead. | Ei ole veel lõppkasutajale valmis nõustaja. |
| **Sisemine tervikproov: M3 baaskiht + M4** | Piiratud materjaliga Luna vastused ja allikavaade. | Ainult nimetatud ulatuses hinnatud funktsioonid; ligipääs ja vajalik M6 miinimum peavad olema valmis. |
| **Kontrollitud SotsiaalAI piloot** | Valitud teemade ja kasutajatega päriskasutus. | Enne avaldamist kvaliteedi-, turbe-, taastamise ja vastutuspiiride kontroll. |
| **Teise kliendi tasuline piloot** | Selgelt määratud vajadus, materjalid ja teenusetase. | Ei müüda veel testimata ajaloolist, keelelist või valdkondlikku võimekust. |
| **Korduvkasutatav toode** | Dokumenteeritud kasutuselevõtt, versioonid, tugi ja kvaliteedihindamine. | Hooldus ning mudelivahetuste regressioonikontroll jätkuvad. |

Kõik M5 ajaloolised võimalused ei pea valmima enne esimest kitsalt piiritletud tasulist pilooti. SotsiaalAI kümneaastase ülevaate eesmärk jääb siiski eraldi vastuvõetavaks võimekuseks, mitte kaob esimese müügi järel teekaardilt.

Potentsiaalsete klientide vajaduste, materjalide ja maksevalmiduse uurimine võib alata M3/M4 ajal. Esialgu ei ehita universaalset turuplatsi ega keerukat arveldusportaali. Teise kliendi katse peab näitama, kas sama tuum on päriselt kohandatav ja milline on kasutuselevõtu kogukulu.

## 6. Oma tehniline eristus ja tulevikuarendus

Meie arendushüpotees on **ühine allika- ja sõltuvuste andmemudel**, mis seob teadmise ettevalmistamise, päringupõhise tõendusmaterjali valiku, vastuse piirangud ning hilisema uuendamise. Hüpotees ei võrdu väitega maailma esimesest lahendusest ega garanteeritud patenteeritavusest.

Uurime eraldi kolme mõju:

| Hüpotees | Võrdlus |
| --- | --- |
| Kohustuslike sõltuvuste kaasamine vähendab määravaid väljajätteid. | Sama tugev hübriidotsing koos sõltuvuskihiga ja ilma, võrreldava vastamise määra ning eelarve juures. |
| Küsimuse olulisi osi kattev kontekst vähendab kordusi ilma olulisi piiranguid kaotamata. | Sama mudel ja korpus; mõõdame lõppvastust, mitte ainult tokenite vähenemist. |
| Sõltuvuste kasutamine uuendamisel vähendab kordustööd ilma aegunud tulemusi suurendamata. | Konservatiivne uuendusbaas, muudetud ja lisandunud allikad, mõõdetud töö ja vead. |

Hiljem võib lisanduda mõjuindeks: milline teadmata asjaolu või puuduv allikas võiks vastuse mõnd osa muuta? Seda kasutaksime sihitud otsingu või täpsustuse valimiseks. See ei ole praeguse M2.2 lisatingimus ega eelda agente.

Kui keerukam mehhanism ei anna mõõdetavat eelist, jätame tootesse lihtsama variandi. Tuuma ei seo ühe keelemudeli, embedding-mudeli või andmebaasi erivorminguga. Uus indeks ehitatakse säilitatud allikatest kõrvuti vanaga; vahetus toimub võrdlustulemuse alusel. Qdranti asendamine või eraldi graafiandmebaasi lisamine pole omaette eesmärk.

## 7. Läbivad kvaliteedi- ja arendusreeglid

| Mõõde | Mida jälgime? |
| --- | --- |
| **Õigsus ja täielikkus** | Vale väide ja määrav väljajäte eraldi; vajalik info algallikas, otsingukontekstis ja lõppvastuses. |
| **Kasulikkus** | Täielikud ja osalised kasulikud vastused, põhjendamatud keeldumised ning tarbetud täpsustused. |
| **Viited ja värskus** | Viite olemasolu kõrval selle tegelik tugi, õige versioon ja lubatud ligipääs. |
| **Keeled ja vestlus** | ET/EN/RU eraldi; kasutaja parandused, isikute eristamine ning teemavahetus. |
| **Kiirus ja kogukulu** | Otsingu ja vastuse ajad, hiljem mediaan ning p95 koormuse all; embedding, genereerimine, eeltöötlus, taristu ja inimese kontrolltöö. |
| **Käitamine ja ülekantavus** | Katkestused, taastamine, kustutamine, teise kliendi juurutamise töö ning hoolduskoormus. |

Hindamiskogu kasvab materjalidega. Osa pärisjuhtumeid hoitakse häälestusest eraldi. Sünteetilised rikkekatsed kontrollivad mehhanisme, mitte ei asenda päriskorpuse kvaliteeditõendit. Kasutaja meeldimine ei muutu automaatselt uueks valdkonnafaktiks.

Piirarvud lepitakse kokku vastava katse eel pärast baasvariandi mõõtmist. Praegu ei lubata 100% õigsust, universaalset alla-sekundilist vastust ega kindlat kuutasu. Suur keeldumiste arv ei tohi parandada näiliselt õigsusmõõdikut.

Iga tööploki vastuvõtus eristame: **tehniliselt teostatud**, **sisuliselt hinnatud** ja **kasutusse lubatud**. Raport nimetab tegeliku keskkonna, koodiseisu, pass/fail/skip tulemused, muutused ning lahendamata piirangud. Uus etapp ei tähenda automaatselt uut raamistikku ega olemasoleva töö ümberkirjutamist.

## 8. Vahetu järg

Praegu jätkub serveris M2.2 olemasoleva ülesande järgi. Tulemuste põhjal valime vajalikud otsinguparandused ning järgmise materjalivalimi. Seejärel koostatakse M3 esimese kontrollitud sõltuvuskihi konkreetne ülesanne; M4 ühenduskohti ja piloodi turbenõudeid saab samal ajal ette valmistada.

Tähtaegu ei tuletata käesolevast teekaardist. Ühe näidise edu ei ennusta usaldusväärselt kogu materjalikogu korrastamise või piloodi töömahtu. Järgmise ploki ajahinnang tehakse tegeliku sisendi ja valmisoleku järgi.

**Siht ei ole kõige suurem graaf ega kõige rohkem AI-kutseid. Siht on teadmistesüsteem, mis leiab vajaliku info, säilitab otsustavad tingimused, teeb allikalise aluse kontrollitavaks ja on sama tuumaga kasutatav järgmise kliendi juures.**

## Alused ja piirid

### Projekti materjalid

- **[P1]** `verification.json`, M2.1 kontrollikirje: testid ja tõendamata omadused. Vestluses lisatud fail; selles töövoorus teste uuesti ei käivitatud.
- **[P2]** `README.md` M2.1 lisaga (vestluses `README(1).md`): ingest, kohalikud teenused, õiguste piir ja prooviplaan.
- **[P3]** `adr-002-local-hybrid-search.md`: andme- ja otsinguleping, testvektorid, struktuurne laiendus, põlvkonnad ning HTTP-piirang.
- **[P4]** `CODEX_RAG_GRAPH_LAHTEULESANNE.md`, v0.1: algsed M0–M6 etapid; `adr-001-local-ingestion.md` uuendatud versioon: tuuma eraldatus ja ingest'i piirid.
- **[P5]** `CODEX_M2_2_PARIS_EMBEDDING_JA_HINDAMINE_v0_3.md`: kehtiv M2.2 ülesanne. Teekaart ei asenda selle lubasid ega tööpiire.
- **[P6]** `repository-audit.md`, M0: vestluse, autentimise, allikavaate ja mudeli tegelikud ühenduskohad auditi ajal.
- Omaniku viimase teate järgi testitakse serveris. Uut serveri tulemuste raportit selle kaardi koostamisel ei olnud.

### Kontrollitud välised tehnilised orientiirid (05.09.2026)

- **[V1]** Microsoft GraphRAG, Global Search. `https://microsoft.github.io/graphrag/query/global_search/` — kogukonnakokkuvõtted ning map-reduce-vastamine. Võrdlusallikas, mitte kohustuslik tervikraamistik.
- **[V2]** Qdrant, Security & Access Control. `https://qdrant.tech/documentation/security/` — ise majutatava teenuse turvameetmed vajavad eraldi seadistamist. Allikas ei ole juhis praegusi teenuseversioone automaatselt uuendada.
- **[V3]** OWASP Gen AI Security Project, LLM01:2025 Prompt Injection. `https://genai.owasp.org/llmrisk/llm01-prompt-injection/` — otsese ja kaudse juhisesüsti riskid ning mitmekihilise kaitse vajadus.

Edasine tööjärjestus, piloodi ulatus, toote eristumise hüpoteesid ja ärilised vahetulemused on käesoleva kaardi ettepanekud, mitte allikatest järeldatud olemasolevad tooteomadused.
