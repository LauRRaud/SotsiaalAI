# Luna vestluse ja RAG-i valmisolek: seis 10.10.2026

Teostus Claude Opus 5.5. Omanik 09.10.2026 õhtul: „kas saame graph rag süsteemi selle ajaga väga heaks? produktsiooni valmis?“, luba kasutada agente ja kulutada testimiseks raha (minu lagi ööks 1,00 USD), soov, et töö iga küsimuse pärast seisma ei jääks. See leht on öö kokkuvõte: mis läks serverisse, mis on mõõdetud ja mis ootab omaniku otsust.

## Lühidalt

- **Vastamine töötab stabiilselt.** Seitsme päeva 236 testpöördest lõppes 234 vastusega; mudeli pakkuja ei tõrkunud kordagi, otsinguplaan ja lõikude valik ei ebaõnnestunud kordagi. Pöörde mediaan on 13,6 sekundit, 95% pööretest alla 23,8 sekundi.
- **Rasked tingimused jõuavad vastusesse.** 30 küsimust, kus vastuse otsustab üks säte (erand, tähtaeg, välistus), küsiti päris vestluse rajal kaks korda ja kuus neist veel kaks korda: 72 pöördest 71-l oli otsustav säte vastuse mudelile antud lõikude hulgas ja vastus viitas sellele.
- **Sel ööl läks serverisse üheksa muudatust** (tabel allpool), nende seas kaks tööriista, millega edaspidi saab tasuta kontrollida: otsingukontroll enne väljalaset ja vestluse tervise aruanne.
- **Paljudele kasutajatele avamiseks ei ole veel valmis.** Takistused ei ole vastuste sisus, vaid asjades, mis on omaniku otsused: seaduste uued redaktsioonid, kes ja mis rahaga vestlust kasutab, varukoopiad, tõrgete sõnastus.
- **Seaduste uued redaktsioonid on serveris alates 10.10.2026 hommikust** (korpus v75, omaniku loal, 0,0223 USD): 31.10.2026 ja 31.12.2026 lõppevate seaduste järgmised redaktsioonid on sees. Lahti on riigilõivuseaduse üks katmata päev (31.10.2026) ja iga-aastased aktid, mille järglasi ei ole veel avaldatud.

## Mis sel ööl serverisse läks

| Otsus | Mis muutus | Kuidas kontrollitud |
|---|---|---|
| [ADR-117](../rag-v2/adr-117-confirmed-reading-day.md) | Leht, mis oma muutmise päeva ei ütle, näitab viimase kinnitatud lugemise päeva („kontrollitud 09.10.2026“) | Päris vestlusaknas allikate paneelil |
| [ADR-118](../rag-v2/adr-118-editor-marks-out-of-answers.md) | Toimetaja märgid („[Remove?]“) ei jõua vastusesse | Ühiktestid |
| [ADR-119](../rag-v2/adr-119-assistants-question-reaches-plan-and-selection.md) | Luna täpsustav küsimus jõuab otsinguplaani ja valikuni, kui inimene vastab lühidalt | 18 päris pööret: kõigis 8 lühivastuses jõudis küsimus kohale |
| [ADR-120](../rag-v2/adr-120-thanks-takes-the-short-route.md) | Tänusõna ei käivita otsingut | 15 päris pööret: 2,2–3,5 s, sõbralik vastus kolmes keeles |
| [ADR-121](../rag-v2/adr-121-directory-does-not-crowd-out-summaries.md) | Tallinna kontaktide kirje ei tõrju abi kokkuvõtteid välja | 63 salvestatud pöörde tasuta kordus: muutus ainult see üks pööre |
| [ADR-122](../rag-v2/adr-122-free-search-gate.md) | Tasuta otsingukontroll enne väljalaset | 33 küsimust; muudetud koodiga 33/33 sama, muutmata koodiga 33/33 sama |
| [ADR-124](../rag-v2/adr-124-acts-that-end-and-the-experiment-at-a-date.md) | Loend aktidest, mille redaktsioon lõpeb; igakuine kehtivuskontroll ei katke enam; graafikatse tulevasel kuupäeval | Päris loendil ja päris indeksil (allpool) |
| [ADR-125](../rag-v2/adr-125-chat-health-report.md) | Vestluse tervise aruanne; mudelikutse ajapiir ei lõpe enam segase veaga | Töötaval väljalaskel, arvud allpool |
| [ADR-126](../rag-v2/adr-126-lost-connection-during-a-turn.md) | Katkenud ühendus pöörde ajal: vestlusaken küsib uuesti ja server ootab vastuse ära | Viga korratud päris vestlusaknas; parandus mõõdetud samas (vaata otsust) |

Lisaks: ametlike juhislehtede igakuine värskendus on ajakavas (1. ja 3. kuupäeval, [ADR-116](../rag-v2/adr-116-official-pages-monthly-refresh.md)).

**Ehitatud, kuid kasutusele võtmata:** seadusesätte silt õiguslõigu juures ([ADR-123](../rag-v2/adr-123-provision-label-for-legal-passages.md)). Mõõtmine näitas, et Luna ei nimeta vastustes paragrahve (234 salvestatud vastusest ühes), nii et silt lahendaks viga, mida vastustes ei ole.

## Mõõdetud seis

**Vestluse tervis (tasuta aruanne töötaval väljalaskel, 7 päeva, üks testkonto):**

| | |
|---|---:|
| Pöördeid | 236 |
| Lõpetatud vastusega | 234 |
| Peatatud (auditipaketi piir, parandatud 06.10) | 1 |
| Vastus tagasi lükatud | 1 |
| Mudeli pakkuja tõrkeid | 0 |
| Otsinguplaan või valik ebaõnnestus | 0 |
| Valik ei jätnud ühtki lõiku | 1 |
| Vastuse liik: täielik / osaline / täpsustav küsimus | 100 / 132 / 2 |
| Pööre: mediaan / 95% | 13,6 s / 23,8 s |
| Esimene tekst ekraanil: mediaan / 95% | 11,1 s / 16,5 s |

**Rasked tingimused päris vestluse rajal (tasuline, 72 pööret, 0,2735 USD):** kolme kataloogi 30 küsimust, igaüks kaks korda, ja kuus neist veel kaks korda; pöörduja rollis, töötaval väljalaskel ja korpusel v74.

| | |
|---|---:|
| Pöördeid / vigu | 72 / 0 |
| Otsustav säte tõendite hulgas | 71 / 72 |
| Vastus viitab lõigule, kus säte on | 71 / 72 |
| Küsimusi, kus see õnnestus igal korral | 29 / 30 |
| Pöördeid, kus sätte lõik oli valitud kandidaatide seas / kus selle tõi (ka) otsingu lisasamm | 60 / 13 |
| Lisasammu liik 12 korduspöördes, kus see salvestati: akti enda viide / viide teise akti / teadmiskaart | 4 / 1 / 0 |
| Vastuse liik: täielik / osaline | 23 / 49 |
| Pöörde mediaan (esimesed 60) | 19,0 s |

Üks küsimus (riigi rahastatud toetatud elamine alkoholisõltuvuse korral) sai otsustava sätte kolmel korral neljast: selle sätte lõik ei ole otsingu kandidaatide seas ja jõuab tõenditesse ainult siis, kui valitud lõik sellele viitab. Teadmiskaart ei toonud otsustavat lõiku üheski pöördes, kus lisasammu liik salvestati.

See mõõt on automaatne: ta näitab, et õige lõik jõudis mudelini ja sellele viidati, mitte seda, kas vastuse sõnastus on õige. Sõnastus loeti eraldi (järgmine lõik). Sama graafiprofiil **ilma valikumudelita** leiab täna 24 tingimust 30-st (02.10.2026, poole väiksema korpusega, 28). Vahe näitab, et suuremas korpuses teeb töö ära mudeli kirjutatud otsinguplaan ja mudeli tehtud valik, mitte liidetud järjestus üksi. Tulemused küsimuse kaupa: [tõendite kaust](evidence/readiness-2026-10-10/).

**Vastuste sõnastus, loetud seaduse vastu (10.10.2026 hommikul, tasuta: agendid lugesid, iga kahtlast vastust luges teine lugeja uuesti):** samad 72 vastust.

| | Vastuseid |
|---|---:|
| Ütleb otsustava tingimuse õigesti | 58 |
| Osaliselt (tingimus on olemas, kuid nõrgendatud või järeldus tegemata) | 8 |
| Jätab otsustava tingimuse välja | 3 |
| Ütleb seadusele vastupidist | 3 |
| Neist eksitavad inimesele, kes vastuse järgi tegutseb | 6 |

Õige lõik oli kõigil neil juhtudel mudeli ees; viga on lugemises. Kolm selget viga: üür emalt (viidatud sätte juurde loetakse tingimus, mida seal ei ole; vale mõlemal korral), sõjaseisukorra 14 päeva (kolm nädalat loeti lühemaks kui 14 päeva) ja eriolukorra tähtaeg (anti tavaline 7 päeva).

**Kiire ja põhjalik mõtlemisaste samadel küsimustel (tasuline, omaniku loal, 0,0970 USD):** kümme küsimust, mille kiire vastus ei olnud õige, küsiti kaks korda põhjalikuma astmega ja loeti samamoodi.

| | Kiire (26 vastust) | Põhjalik (20 vastust) |
|---|---:|---:|
| Õige | 13 | 13 |
| Osaliselt | 7 | 6 |
| Jätab tingimuse välja | 3 | 0 |
| Ütleb seadusele vastupidist | 3 | 1 |
| Pöörde mediaan | 19 s | 46 s |
| Hind pöörde kohta | 0,0039 USD | 0,0048 USD |

Põhjalik aste eksib raskete seadusküsimuste puhul selgelt harvem (1 vale 20-st, kiirel 6 vale 26-st), kuid pööre on 2,4 korda pikem. Võrdlus on kiire astme kahjuks kallutatud: küsimused valiti selle järgi, kus kiire eksis, ja ülejäänud 20 küsimusel põhjalikku ei mõõdetud. Üks viga (üür emalt) jäi mõlemas. Valim on väike. Vaikimisi astme valik rolli kaupa on omaniku otsus.

**Otsing (tasuta otsingukontroll, 33 kindlat küsimust):** kaks võrdlust lähteseisuga, üks muudetud ja üks muutmata koodiga, mõlemas 33/33 sama. Kontroll on kasutatav enne iga otsingut puudutavat väljalaset.

**Seaduste kehtivus tulevastel kuupäevadel:** vaata järgmist jaotist.

**Koormus:** mitme kasutajaga korraga ei ole vestlust mõõdetud. Sel ööl jooksis serveris korraga kaks rasket tasuta mõõtmist ja üks päris pööre; vektoriandmebaasi päringud ületasid siis 30 sekundi piiri ja üks mõõtmine katkes. Need mõõtmised on vestluse pöördest palju raskemad, kuid see näitab, et 4 tuuma ja 10 GB mäluga serveril on piir lähedal.

## Seadused, mille redaktsioon lõpeb

Otsing hoiab seadusest ainult seda redaktsiooni, mis küsitud päeval kehtib. Kui korpuses oleva redaktsiooni kehtivus lõpeb ja järgmist ei ole sisse võetud, kaob seadus sel päeval vaikselt vastustest.

| Viimane päev | Riigi akte | Omavalitsuse akte |
|---|---:|---:|
| 30.10.2026 | 1 (riigilõivuseadus, üheks päevaks) | 0 |
| 31.10.2026 | 3 (kriminaalmenetluse seadustik, riigi õigusabi seadus, riigihangete seadus) | 0 |
| 30.11.2026 | 1 (avaliku teabe seadus) | 0 |
| 31.12.2026 | 13 | 5 |

**Mõõdetud tulevaste kuupäevade seisuga (tasuta, [ADR-124](../rag-v2/adr-124-acts-that-end-and-the-experiment-at-a-date.md)):** 30 raske tingimusega küsimust graafiprofiiliga, ilma valikumudelita. Otsustav säte jõudis tõendite hulka 10.10.2026 seisuga 24 küsimusel, 01.11.2026 seisuga 24 ja 01.01.2027 seisuga 23 küsimusel. Lõppevad seadused neid küsimusi ei puuduta (kataloog neid seadusi ei kata); üks tingimus kaob, kui sotsiaalhoolekande seaduse teadmiskaardid 30.11.2026 lõpevad (mõõdetud 01.01.2027 seisuga).

**Tehtud 10.10.2026 hommikul (korpus v75):** 27 puuduvat redaktsiooni (19 seaduse 26 teksti ja Kadrina valla kord, 5440 lõiku) on serveris. Osta tuli 291 vektorit, **0,0223 USD**; indeksis on 80 948 lõiku 100 000-st ja ketast 20 GB vaba. Tabeli read 31.10, 30.11 ja 31.12 on sellega kaetud, välja arvatud riigilõivuseaduse üks päev ja 2026. aasta riigieelarve seadus.

**Edaspidi:** igakuine kontroll (25. kuupäeval) kirjutab nüüd oma teatesse ka loendi aktidest, mille redaktsioon lõpeb 90 päeva jooksul. Uusi redaktsioone see sisse ei too.

## Mis ootab omaniku otsust

### 1. Seaduste uued redaktsioonid (enne 31.10.2026)

- ~~Kas ostan ettevalmistatud 27 redaktsiooni?~~ Ostetud 10.10.2026 omaniku loal (0,0223 USD).
- Kas uute redaktsioonide sissevõtt saab alalise igakuise sammu oma rahalaega? Seaduste redaktsioonid on suured ja abivahendite värskenduse 0,10 USD kuus neid ei kata.
- Sotsiaalhoolekande seaduse teadmiskaardid on redaktsioonil, mis kehtib 30.11.2026-ni. Järgmisel redaktsioonil kaarte ei ole. Valikud: lasta neil lõppeda, teha uued (tasuline mudelitöö) või kanda olemasolevad üle seal, kus sätte sõnastus ei muutunud. Mõõtmine: ilma valikumudelita maksab kaartide lõpp ühe tingimuse 30-st; päris vestluse rajal ei toonud kaart otsustavat lõiku üheski pöördes, kus see salvestati. Soovitus: lasta lõppeda.

### 2. Kes ja mis rahaga vestlust kasutab

- **Vestlusplaan lubab praegu ühe konto.** Iga teine sisseloginud kasutaja saab vastuse, et teenus on suletud. Kellele ja millal avada (kõik sisseloginud, ainult tellijad, valitud rollid)?
- **Teenuse rahaloendur on eluaegne, mitte perioodi kaupa:** 4 USD plaani kohta ja umbes 1000 täispööret; uus loendur algab ainult korpuse täiendusega. Praegu kulunud 0,0051 USD. Kui see täis saab, näeb kasutaja teadet „Liiga palju päringuid“ või „vastuse kontroll ebaõnnestus“, mis kumbki ei ole tõsi. Vaja on otsust: kui suur eelarve mis perioodiks, mis juhtub, kui see otsa saab, ja mis sõnastus siis ekraanile tuleb.
- **Tasuta paketis ei ole vestluse kuluõigust:** tellimuseta kasutaja pööre katkeb pärast esimest sammu teatega „keelatud“. Kas tasuta kasutaja saab mõne pöörde?
- **Korraga saab töös olla kolm pööret kogu teenuse peale**, neljas saab keeldumise („liiga palju päringuid“), mitte järjekorda. Kasutaja kohta 12 pööret minutis. Suuremat piiri ei ole koormuse all proovitud.
- **Keegi ei saa teadet**, kui eelarve hakkab otsa saama või pakkuja vead kasvavad. Tervise aruanne näitab seda, kui see käivitada.

### 3. Varukoopiad

Rahaloendur, kulutõendid, vestlused ja kinnitatud märgid on ainult serveri andmebaasides; plaanifailid ja keskkonnafailid ainult serveri kaustas `/etc/sotsiaalai`. Teist koopiat ei ole ja ajastatud varundust ei ole. See on teada ja edasi lükatud, kuid enne päris kasutajaid peab see olemas olema.

### 4. Tõrked ja nende sõnastus

- **„Osaline“ vastus ilma piiranguta** lükatakse tagasi pärast seda, kui tekst oli ekraanil ja makstud. Soovitus: lubada see avaldada tavalise vastusena; ükski lause ei muutu ja silti põhivestluses ei näidata.
- **Pakkuja viga enne vastust (429 või 5xx):** kas kutse võib sama reservi all ühe korra uuesti saata? Praegu ei korrata midagi.
- **Tundmatu lõpuga pööre:** sama tekst samas vestluses annab sama surnud pöörde (võti püsib vähemalt 24 tundi), et teist tasulist kutset ei tekiks. Kas inimene võib sama küsimuse uuesti saata (hind: kuni üks pööre korduse kohta)?
- **Vastus, mis katkes pikkuse piiril (8192 tokenit):** kas näidata oma teksti ja nuppu „Proovi uuesti“ või avaldada valmis plokid märkusega?
- **Kui vastuse etapp ebaõnnestub pärast makstud otsingut:** kas näidata leitud allikate loendit ilma väideteta?
- Uute tõrketekstide sõnastus eesti, inglise ja vene keeles.

### 5. Säilitus ja avamise plaan

- Praegune arendusplaan ei anna pöördeandmetele ega vestlustele lõppu. Avamise plaan (`opening`: pöörde read 7 päeva, vestlused 90 päeva) on olemas, kuid päris lehel proovimata. Avaldatud 90 päeva reegel praeguse plaaniga ei kehti.
- Üldine säilituskoristus käivitub ainult siis, kui teatud päringud saabuvad; ajastit sellel ei ole.
- Vestluse kustutamine külgribal arhiveerib selle; sõnumid jäävad alles kuni koristuseni.

### 6. Sisu õigused

Iga allikas kannab korpuses silti „ainult arenduseks“. Kood laseb selle sildiga teenindada ka teisi kasutajaid, kuid silt ise ütleb muud. Vaja on otsust, kas korpust võib sellisena maksvatele kasutajatele näidata ja kas mõni allikas vajab oma tingimusi.

### 7. Käitus

- Korpuse täiendus ja igakuised värskendused taaskäivitavad teenuse; selle aja jooksul vestlus keeldub. Mis kellaajal ja kas teatega?
- Väljalase peatab ainsa protsessi ja käivitab uue: lahtise vooga pööre lõpeb vana koodiga, vahepeal saabunud päringud ebaõnnestuvad.

## Mida soovitan, selles järjekorras

1. ~~Osta seaduste redaktsioonid~~ (tehtud 10.10.2026). Otsusta, kas uute redaktsioonide sissevõtt saab alalise igakuise sammu.
2. **Lülita sisse öine krüptitud varundus** (varukoopiate hoidla on olemas).
3. **Proovi avamise plaani testkontoga:** säilitus, tühjaks jäänud read, vestluste 90 päeva.
4. **Otsusta eelarve ja selle sõnastus** enne teise konto lisamist: praegune loendur lõpeb vale teatega.
5. **Väike koormuskatse:** kolm kuni viis pööret korraga, enne kui piiri tõsta.
6. Tõrgete sõnastus ja „osaline“ vastus: väikesed muudatused, mis vajavad ainult otsust.

## Kulu

Mudelikutsed sel õhtul ja ööl plaani hindades: täpsustava küsimuse kontroll 0,0809 USD ja tänusõna kontroll 0,0390 USD (eraldi lubadega); öö loa all Tallinna vastuste võrdlus 0,0659 USD, sätte sildi võrdlus 0,1316 USD ja raskete tingimuste kontroll 0,2735 USD (60 ja 12 pööret) ja päris vestlusakna pöörded 0,0173 USD. **Öö loa all kokku 0,4883 USD 1,00-st.** Tegelik arve OpenAI vaates on varasema kogemuse järgi mitu korda väiksem.

## Kontrollimata

- Mitu kasutajat korraga; avamise plaan päris lehel; varundusest taastamine.
- Spetsialisti rolli vastused samadele rasketele küsimustele.
- Omavalitsuse aktide uued redaktsioonid 01.01.2027 (viis akti): Riigi Teatajas ei pruugi neid veel olla.
