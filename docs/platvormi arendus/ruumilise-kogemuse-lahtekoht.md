# SotsiaalAI ruumilise kogemuse lähtekoht

Seis: kontseptuaalne lähtealus, täiendatud 14.07.2026
Ulatus: kogu platvormi tulevane kasutuskogemus  
Staatus: uus lähtekoht edasiseks kaardistamiseks ja arendamiseks

Seotud tehnoloogiadokument: [SotsiaalAI lokaalsed mudelid ja multimodaalne interaktiivsus](./lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md)

## 1. Põhiotsus

SotsiaalAI siht ei ole olla tavapärane veebileht, millele on lisatud ruumitaust, klaaspaneelid ja animatsioonid. SotsiaalAI on ruumiline digitaalne keskkond, kus kasutaja liigub, avab tööalasid, paigutab objekte, loob seoseid ning töötab isiklikel või jagatud lõuenditel.

Ruum ei ole dekoratsioon funktsioonide taga. Ruum, selle objektid, kaugused, pinnad ja liikumine moodustavad kasutajaliidese.

See tähendab, et edasine tootearendus ei alga küsimusest „millise uue lehe teeme?”, vaid küsimustest:

- millises ruumis tegevus toimub;
- milline objekt või lõuend kannab tegevuse sisu;
- mida saab kasutaja ruumis teha, liigutada, ühendada või jagada;
- kuidas liigub kasutaja järgmisse vaatesse või tööetappi;
- mis jääb ruumi alles, kui kasutaja hiljem naaseb;
- milline osa ruumist on privaatne ja milline jagatud.

## 2. Praegune lähteolukord

Praeguses rakenduses on ruumiline identiteet juba nähtav:

- kasutaja siseneb toa- või elutoalaadsesse keskkonda;
- keskne seinapind või maal toimib olulise visuaalse fookusena;
- põhivalikud ja Töölaud liiguvad horisontaalses karussellis;
- klaaspinnad, hägustus, valgus ja sügavus loovad kohalolu;
- sisselogimine ja platvormiga ühendamine mõjuvad ruumis asuvate seadmetena.

Õhtuse prototüüpimise järel on lisandunud ka esimesed otsese ruumitöö katsed:

- Teemaseemnete kaarte saab vabalt liigutada;
- valitud kaardi suurust saab nurgast muuta;
- aktiivne kaart tuleb kattumisel esiplaanile;
- täisekraani Kovisiooni ja Teemaseemnete lõuenditel on ruumiülese juhtpaneeli jaoks eraldi ülemine tsoon;
- sama ülaservast avanev juhtpaneel on kasutatav karussellis ja töövaadetes, kuid mitte avastseenis.

Samas käituvad funktsioonid suuresti veel tavapäraste veebilehtedena:

- ruumi ette avaneb modaal;
- tööriistu esitatakse ühetaoliste kaartidena;
- keerukad funktsioonid muutuvad pikkadeks vormideks või juhtpaneelideks;
- kogu info püütakse näidata ühel ekraanil;
- ruumi mööbel ja pinnad on enamasti taust, mitte kasutatavad objektid;
- ühe funktsiooni tulemust ei saa veel loomulikult ruumi välja tõsta ja järgmises tegevuses kasutada.

Uus lähtekoht ei tähenda, et praegune kujundus tuleb kõrvale heita. Olemasolev ruum, valgus, materjalid ja üldine atmosfäär annavad tugeva aluse. Muutuma peab eelkõige tegevuse loogika.

## 3. Ruumilise keskkonna grammatika

SotsiaalAI vajab ühist ruumilist grammatikat, et erinevad funktsioonid tunduksid ühe keskkonna, mitte eraldi rakenduste kogumina.

### 3.1. Sein

Sein või keskne ekraan on aktiivne tööpind. Seal võib toimuda:

- vestlus;
- dokumendi koostamine ja analüüs;
- juhtumi või Teekonna visualiseerimine;
- kovisiooni ühine töö;
- teenusekaardi avamine;
- kokkuvõtte ja järgmiste sammude vaatamine.

### 3.2. Laud

Laud kannab pooleliolevat tööd. Lauale võib tõsta:

- dokumendi;
- juhtumi või olukorra;
- inimese või osapoole;
- eesmärgi;
- meetodi;
- tegevuse;
- märkme;
- teenuse või abipakkumise.

Laual olev objekt on aktiivses kasutuses. Eseme tõstmine lauale peab muutma selle seost või seisundit, mitte olema üksnes animatsioon.

### 3.3. Kapp või arhiiv

Kapp esindab kasutaja dokumente, materjale ja lõpetatud töid. Kasutaja saab sealt objekti töölauale tuua ning pärast töö lõpetamist tagasi paigutada.

### 3.4. Uks, koridor ja portaal

Uks või portaal viib teise tähendusega ruumi. Näiteks:

- privaatsest tööruumist ühisesse vestlusruumi;
- Tööheaolu ruumi;
- kovisiooni- või supervisiooniruumi;
- ESTA piirkonnaruumi;
- teenuste ja kogukonna alale.

Üleminek peab aitama kasutajal mõista, et muutusid ruum, osalejad, nähtavus või tegevuse eesmärk.

### 3.5. Aken

Aken võib ühendada kasutaja tema isiklikust keskkonnast välise maailmaga:

- Teenusekaart;
- kohalik piirkond;
- kogukondlik abi;
- ESTA piirkonnad ja teemakogukonnad;
- välised koostööpartnerid.

### 3.6. Kaugus, suund ja valgus

Ruumiline paigutus peab kandma tähendust:

- lähedal olev on hetkel oluline või aktiivne;
- kaugemal olev on järgmine võimalus või taustinfo;
- kõrvuti paiknevaid objekte saab võrrelda;
- ühendatud objektidel on sisuline seos;
- valguse muutus võib näidata fookust, privaatsust või ruumi olekut;
- valmis töö võib liikuda aktiivsest alast rahulikku arhiivi.

Värvi või valgust ei kasutata ainsa staatuse kandjana.

## 4. Neli omavahel ühendatavat ruumimudelit

### 4.1. Püsiv SotsiaalAI maja

Püsiv ruumiplaan annab kasutajale orientatsiooni ja ruumilise mälu. Võimalikud alad on:

- fuajee või peamine sisenemisruum;
- isiklik Töölaud;
- vestlusala;
- dokumendiarhiiv;
- Tööheaolu privaatne ruum;
- kovisiooni- ja supervisiooniruumid;
- võrgustikutöö ruum;
- ESTA ja piirkondade kogukonnaalad.

Kasutaja õpib aja jooksul, kus tema asjad asuvad, ega pea iga kord menüüstruktuuri uuesti lugema.

### 4.2. Muutuv stuudio

Üks ruum võib tegevuse järgi ümber kujuneda. Kui kasutaja soovib juhtumit mõtestada, võivad ruumi ilmuda:

- keskne juhtumilõuend;
- ajajoon;
- võrgustikukaart;
- meetodite ala;
- dokumentide tööpind;
- järgmiste sammude ala.

Kasutaja ei pea kõiki töövahendeid korraga nägema. Ruum toob esile selle, mida on praegu vaja.

### 4.3. Ruumiline lennuteekond

Juhendatud tegevus koosneb ruumi sügavusse paigutatud lõuenditest. Kasutaja liigub nende vahel kerimise, klõpsu, klaviatuuri või otsenavigatsiooni abil.

Lennuteekond sobib eriti:

- eelpöördumise ettevalmistamiseks;
- dokumendi koostamiseks;
- tööheaolu eneserefleksiooniks;
- Meetodipeegliks;
- kovisiooni etappideks;
- teenuseprofiili esmaseks loomiseks.

Ühes vaates kuvatakse üks põhiülesanne või selgelt seotud lõuendipaar. Varasemad sammud jäävad alles ning nende juurde saab naasta.

#### Olemasolev flight-efekti prototüübisisend

Staatus: **KANDIDAAT JÄRGMISE RUUMILISE PROTOTÜÜBI JAOKS**, mitte kinnitatud tooteotsus.

Repos on tehniline lähteallikas [`public/room/flight-effect.md`](../../public/room/flight-effect.md). Kirjeldatud lahendus loob kerimisega juhitava lennu läbi eri sügavustele paigutatud 3D-plaanide. Selles on juba arvestatud iOS Safari 3D-lamendamise, jõudluse, piltide eellaadimise, klaviatuurinavigatsiooni, vahelejätmise ja `prefers-reduced-motion` varuvaatega.

**Flight ei tähenda siin tingimata füüsilisest ruumist teise lendamist.** Selle põhikasutus on tavalise pika allapoole keritava lehe asendamine sügavuses vahetuvate sisupindadega: kasutaja kerib järgmise leheosa, tööetapi, tabeli või analüüsipaneeli enda ette ning eelmine taandub. Nii ei pea suur hulk tihedat sisu korraga ühel ekraanil olema.

See on eraldi süsteem ruumi enda kerimisega juhitud pildikaadrite vahetusest. Kausta [`public/room/ruumi pildid`](../../public/room/ruumi%20pildid) referentsid ja `lib/room-frames.js` kuuluvad poolelioleva ruumikontseptsiooni juurde, kus kerimine võib muuta ruumi vaadet või taustakaadrit. Need ei ole flight-efekti valmis disain ega selle kasutamise eeltingimus. Järgmistes ülesannetes käsitletakse neid kahe eraldi prototüübina:

1. **ruumikaadrite teekond** — ruumi enda visuaal ja pildid muutuvad kerides;
2. **flight-sisuteekond** — lehe päris sisupinnad vahetuvad sügavuses ükshaaval.

Flight-mehaanika väike osa on aktiivses `main`-is juba tõestatud: `RoomStage` kasutab ühe tasandi perspektiivi saabumisteekonna tekstipeatuste `translateZ`-liikumiseks. See tõestab tehnilist võtet, kuid ei tähenda, et sisulehtede flight peab elama samas komponendis. Prototüüp peab otsustama, kas vajatakse lehepõhist `FlightStack`-laadset komponenti või olemasoleva loogika jagatud abifunktsioone; samal lehel ei tohi kaks süsteemi korraga kerimist juhtida.

Sobivad võimalikud kasutused:

- pikk töö- või ülevaateleht, mille suured sisublokid avanevad ühekaupa;
- mitu mahukat tabelit või analüüsipaneeli, mida ei ole vaja samal ajal võrrelda;
- juhendatud mitmeastmeline teekond, kus iga sügavusplaan on päris tööetapp, mitte dekoratiivne slaid;
- ühe töövoo järjestikused vaated, näiteks sisend → analüüs → otsus → tulemus;
- tähenduslik üleminek ruumivööndite vahel ainult siis, kui üleminek aitab mõista konteksti või nähtavuse muutust.

Efekti ei kasutata vaikimisi:

- iga kaardikliki või lühikese tavapärase lehevahetuse vahel;
- pika vormi pelgalt animatsiooni sisse peitmiseks — jaotus peab vastama sisulistele osadele;
- olukorras, kus kasutaja peab kiiresti tagasi pöörduma, kriitilist infot leidma või paralleelselt eri andmeid võrdlema;
- privaatsus- või rollipiiri ainsa selgitusena — ruumivahetusega peab kaasnema ka nähtav tekstiline kinnitus, kellele järgmine ala ja selle objektid nähtavad on.

Prototüübi kohustuslikud piirid:

1. iga sisupind peab olema avatav otselingi või ankruga, klaviatuuri ja nähtava sisunavigatsiooniga;
2. brauseri tagasi-edasi liikumine ning poolelioleva töö seis peavad säilima;
3. vähendatud liikumise korral kasutatakse sama sisu lamedat järjestust, mitte tühja või kärbitud varianti;
4. kasutaja näeb alati, milline osa on aktiivne ning mitu osa on ees ja taga;
5. tabeli päis, veerunimed ja tegevused peavad jääma loetavaks ka ülemineku ajal; aktiivseks saab ainult parajasti ees olev pind;
6. mobiilil mõõdetakse enne kasutuselevõttu kaadrisagedust, mälukulu ja piltide dekodeerimise aega;
7. sügavus ja liikumine peavad kandma töövoo tähendust; kui sama tulemus on selgem sakkide, akordioni või rahuliku vahetusega, ei kasutata täislendu.

Järgmise ülesande esimene otsus on seega: **kas prototüüp käsitleb ruumi pildikaadrite muutumist või lehe sisupindade flight-vahetust?** Flight-prototüübi puhul valitakse seejärel üks päris tiheda sisuga leht ning võrreldakse, kas tabelite või etappide ühekaupa sügavuses esitamine on tavalisest pikast lehest arusaadavam.

### 4.4. Vabalt kasutatav lõuend

Lõuend sobib tegevusteks, kus kasutaja loob ise seoseid ja paigutust. Ta saab näiteks:

- asetada sündmusi ajajoonele;
- paigutada inimesi võrgustikukaardile;
- ühendada osapooli teenuste ja tegevustega;
- rühmitada riske, vajadusi, ressursse ja kaitsetegureid;
- võrrelda meetodeid;
- viia tegevusi kavandatud, töös, ootel ja tehtud alade vahel;
- tõsta arutelust olulisi mõtteid ühisele lõuendile.

## 5. Ruumilised tööobjektid

SotsiaalAI funktsioonide ühendamine ei pea toimuma üksnes linkide või nuppude kaudu. Ühendus võib tekkida objekti liigutamisest.

| Objekt | Võimalik ruumiline tegevus | Tähendus |
|---|---|---|
| Dokument | kapist lauale või ühisele lõuendile | dokument võetakse töösse või jagatakse |
| Inimene | võrgustikukaardile lähemale või kaugemale | suhte tugevus, roll või kaasamise vajadus |
| Sündmus | ajajoonele | sündmus seotakse olukorra arenguga |
| Eesmärk | tegevuste kohale või kõrvale | tegevused seotakse eesmärgiga |
| Meetod | juhtumi või vajaduse kõrvale | meetod võetakse kaalumisele või kasutusse |
| Tegevus | ühest olekualast teise | tegevuse staatus muutub |
| Kokkulepe | ühise ruumi seinale | kokkulepe tehakse osalejatele nähtavaks ja kinnitatavaks |
| Teenus | võrdlus- või sobituslauale | teenust hinnatakse vajaduse suhtes |
| Vestluse mõte | vestlusest lõuendile | sõnum muutub püsivaks tööobjektiks |

Otsene liigutamine vajab alati ka klaviatuuri, menüü või muu alternatiivse toimingu võimalust.

### 5.1. Esiplaan, tagaplaan ja objektide suurus

Kui objektid võivad kattuda, peab keskkond näitama üheselt, milline objekt on aktiivne:

- liigutatav või muudetav objekt tuleb esiplaanile;
- tagaplaanil olev objekt võib mõõdukalt taanduda;
- esiplaani objekt ei pea kaotama klaasjat materjali ega muutuma täiesti läbipaistmatuks;
- tekst peab jääma loetavaks nii heleda kui tumeda ruumitausta kohal;
- z-järjekord ei tohi muutuda juhuslikult või ainult DOM-i järjekorra tõttu.

Suuruse muutmine on ruumiline töövõte ainult siis, kui see parandab võrdlemist, mõtestamist või tööala korraldamist. Suuruse muutmine ei tohi olla dekoratiivne kohustus. Igal muudetaval objektil on minimaalsed ja maksimaalsed piirid, taastamisvõimalus ning klaviatuurialternatiiv.

## 6. Vestlus kui ruumi loomise algus

Vestlus ei pea olema eraldi modaal ega lõpp-punkt. Kasutaja võib kirjeldada olukorda ning SotsiaalAI pakub selle põhjal tööruumi ülesehitamist.

Näide:

```text
Kasutaja kirjeldab olukorda
  → SotsiaalAI korrastab teadaoleva info
  → kasutaja kinnitab, mida võib töölauale tõsta
  → ruumi tekivad olukorra kokkuvõte, puuduolevad küsimused,
    võimalik võrgustik, sobivad meetodid ja järgmised sammud
  → kasutaja valib vabalt, millise objektiga edasi töötab
```

Vestlusest välja tõstetud objekt ei liigu automaatselt teise funktsiooni. Kasutaja näeb, mida luuakse, kuhu see paigutatakse ja kellele see nähtavaks muutub.

## 7. Funktsioonide võimalik ruumiline tähendus

### 7.1. Teekond

Teekond on ruumiline kaart kasutaja olukorrast, senistest sammudest, seotud teemadest ja võimalikest järgmistest suundadest. See ei ole kohustuslik järjestus ega kõigi funktsioonide eeltingimus.

### 7.2. Juhtumitöö assistent

Juhtumitöö assistent on muutuv professionaalne tööruum. Seal saavad kõrvuti eksisteerida olukorra pilt, ajajoon, võrgustik, eesmärgid, tegevused, dokumendid ja refleksioon. Ametlikku süsteemi sisestatav kokkuvõte on üks ruumist saadav tulemus, mitte kogu ruumi eesmärk.

### 7.3. Meetodipeegel

Meetodipeeglis saab kõrvuti asetada:

- kliendi vajaduse;
- valitud lähenemisviisi ja meetodi;
- tehtud töövõtte;
- kliendi reaktsiooni;
- selle, mis töötas või ei töötanud;
- võimalikud teistsugused lähenemised.

Meetodit võib käsitleda vaatenurga või „läätsena”, mille kaudu juhtumit uuesti vaadata.

### 7.4. Võrgustikutöö

Võrgustikutöö toimub ühisel lõuendil, kuhu paigutatakse osapooled, suhted, rollid, kokkulepped, tähtajad ja infopiirid. Ruumi kutsumine ei anna automaatselt ligipääsu kogu juhtumile.

### 7.5. Kovisioon ja supervisioon

Osalejad töötavad ühise laua ja lõuendite ümber. Juhtum, kokkulepped, refleksioon ja järgmised sammud ei pea olema korraga ühel juhtpaneelil. Protsessi etapid võivad paikneda ruumi eri osades ning kaamera või fookus liigub koos tööga.

### 7.6. Tööheaolu

Tööheaolu on töötaja privaatne ruum. See võib muutuda vastavalt sellele, mis töötaja sinna tõi: raske juhtum, töövägivald, taastumine, tööpiirid, rollipiirid või alustaja vajadus. Individuaalseid sissekandeid ei seota automaatselt teiste tööfunktsioonidega.

### 7.7. Dokumendid

Dokumendid paiknevad arhiivis ja muutuvad lauale tõstes aktiivseteks tööobjektideks. Dokumenti saab viia analüüsi, koostamise, võrdlemise või jagamise lõuendile.

### 7.8. Teenusekaart ja kogukond

Teenusekaart võib olla isiklikust ruumist avanev vaade välisele toele. Teenused, abisoovid, abipakkumised, ESTA piirkonnad ja koostööpartnerid ei pea olema üks pikk loend, vaid ruumiliselt uuritavad piirkonnad ja seosed.

## 8. Rollid samas maailmas

Kõik rollid kasutavad sama ruumilist keelt, kuid nende ruumid ja esile tõstetud objektid erinevad.

### Eluküsimusega pöörduja

- rahulik ja vähese koormusega isiklik ruum;
- vestlus, Teekond, eelpöördumine, dokumendid ja toe leidmine;
- väikesed juhendatud sammud;
- selge kontroll jagamise üle.

### Sotsiaaltöö spetsialist

- professionaalne stuudio;
- juhtumitöö, Meetodipeegel, võrgustik, dokumendid ja vastuvõetud pöördumised;
- privaatne Tööheaolu ruum;
- ühised kovisiooni- ja supervisiooniruumid.

### Teenuseosutaja

- teenuseprofiili ja pöördumiste tööala;
- teenuste, asukohtade ja vastuvõtuinfo haldamine;
- kutse alusel osalemine jagatud võrgustiku- või vestlusruumis;
- ligipääs ainult talle jagatud objektidele.

## 9. Navigeerimine ilma vana menüüsüsteemita

Ruumiline liikumine ei tohi muuta funktsioonide leidmist aeglaseks. Keskkond vajab vähemalt kahte paralleelset navigeerimisviisi:

1. avastuslik liikumine ruumis;
2. kiire otseliikumine kogenud kasutajale.

Võimalikud lahendused:

- ruumi minikaart;
- klikitavad tähised või „tähtkuju”;
- käsklus- või otsingupaneel;
- „Kõik tööriistad” ruumiindeks;
- viimati kasutatud ruumid;
- poolelioleva töö otsene jätkamine;
- püsivad otseteed kriitilisteks tegevusteks.

Kiirindeks ei pea olema vana nuppudega ruudustik. See võib olla ruumi kaart, korruseplaan või sihtkohtade visuaalne loend.

### 9.1. Ruumiülene juhtpaneel

Ruum vajab väikest püsivat juhtimiskihti, mis ei sõltu parajasti avatud funktsioonist. Praegune katsevariant avaneb ekraani ülaservast ning koondab heli, ligipääsetavuse ja ruumist väljumise.

Juhtpaneeli reeglid:

- sama komponent ja samad olekud töötavad karussellis ja alalehtedel;
- avastseenis seda ei kuvata, sest seal on eraldi alumised heli- ja vahelejätmisjuhikud;
- suletud paneeli nähtamatu hover-ala ei tohi blokeerida lehe navigatsiooni;
- täisekraani töölõuend jätab juhtpaneeli alla teadliku ohutu tsooni;
- modaalid ja kriitilised teated paiknevad juhtpaneelist kõrgemal kihil;
- klaviatuur, fookus, hiir ja puuteseade peavad kõik võimaldama paneeli avada ja sulgeda.

### 9.2. Töövaate ülemine ohutu tsoon

Täisekraani lõuend ei alga päris ekraani ülaservast, kui seal elab ruumi juhtpaneel. Kovisiooni etapirida, Teemaseemnete funktsiooninavigatsioon ja tulevaste lõuendite esmased tegevused paigutatakse juhtimistsoonist allapoole.

Ohutu tsoon ei ole tühi dekoratiivne päis. See eristab ruumiülest juhtimist konkreetse funktsiooni tööst ning väldib olukorda, kus hover-ala katab lingid või etapid. 16-tollisel ekraanil peab põhisisu jääma samal ajal nähtavaks ja loetavaks; vajaduse korral vähendatakse samaaegsete paneelide hulka, mitte teksti suurust.

### 9.3. Kaamera kui vabatahtlik ruumiline sisend

Sülearvuti kaamera võib toetada ruumiobjektide valimist ja liigutamist, kuid see ei ole funktsioonide kasutamise eeltingimus. Kaamerarežiim on eraldi teadlikult käivitatav sisendiviis ning selle peamine käsk on pöidla ja nimetissõrme näpistus.

Näpistusgrammatika:

- nimetissõrm juhib nähtavat ruumikursorit;
- lühike stabiilne näpistus valib objekti;
- hoitud näpistus ja käe liikumine lohistavad objekti;
- kaardi nurgapideme näpistamine muudab suurust;
- tühja ruumi näpistamine ja vedamine liigutab lõuendit või karusselli;
- ülamenüü pideme näpistamine ja alla tõmbamine avab juhtpaneeli;
- sõrmede vabastamine lõpetab lohistamise.

Avatud peopesa ei ole vaikimisi käsk, sest see võib minna segi viipe või loomuliku käeliigutusega. Samuti ei kasutata eraldi ebamäärast õhus viipamist, kui sama tegevus on võimalik ruumi või objekti näpistades ja vedades.

Kaamera sisend peab järgima järgmisi piire:

- kaamera käivitub ainult kasutaja loal;
- töötlemine toimub võimaluse korral lokaalselt;
- pilti ei salvestata ega saadeta vaikimisi serverisse;
- jälgimist ei kasutata isikutuvastuseks ega inimese seisundi hindamiseks;
- ükski žest ei saada, jaga, kustuta ega kinnita tundlikku sisu;
- jälgimise katkemine jätab objekti turvalisse viimasesse kinnitatud olekusse;
- sama tegevus on alati võimalik hiire, puute või klaviatuuriga;
- vähendatud liikumise korral saab kaamera parallaksi ja ruumilise nihke välja lülitada.

Tavakaamera sobib esimeses etapis paremini pea asendi, käepunktide ja näpistuse tuvastamiseks kui täpseks pilguga juhtimiseks. Pilgusuunda võib kasutada ainult ligikaudse fookuse või valgusvihjena, mitte otsuse või klõpsu tegemiseks.

### 9.4. Eesti hääl ruumilise sisendina

Eestikeelne hääl võib täiendada ruumilist valikut:

```text
kasutaja valib näpistuse, hiire või klaviatuuriga objekti
→ vajutab mikrofoni
→ ütleb eestikeelse tegevuse
→ süsteem näitab transkripti ja tõlgendust
→ ohutu tegevus rakendub või küsitakse kinnitust
```

Häälrežiimid on eristatavad:

- häälkäsklus;
- aktiivse välja dikteerimine;
- vestlus SotsiaalAI-ga;
- teiste inimestega häälruum.

Vestlus SotsiaalAI-ga jaguneb omakorda kaheks kasutusviisiks:

- **dikteerimine** – kõne lisatakse sisestusväljale ning kasutaja kontrollib ja saadab selle ise;
- **häälvestlus** – süsteem tuvastab kõnevooru lõpu, saadab küsimuse automaatselt olemasolevasse RAG-vestlusse ja loeb allikapõhise vastuse automaatselt ette.

Häälvestlus on ruumis eraldi teadlikult käivitatav seisund, mitte vestlusakna mikrofoni varjatud uus käitumine. Ruum muudab olekut koos kõnevooruga: „Kuulan” → „Otsin allikatest” → „Vastan”. Kasutaja uus kõne peatab AI ettelugemise, kuid tekstivastus ja allikakaardid jäävad nähtavaks. Nii võib kogemus tunduda vahetu ilma RAG-i, allikate ja kasutaja kontrolli kaotamata.

Eesti keele käsutuvastus arvestab käändeid, sünonüüme, poolelijäänud lauseid ja erialatermineid. Käsu mõistmiseks ei pea kõnet esmalt inglise keelde tõlkima.

Mikrofon on vaikimisi väljas. Esimene variant kasutab vajuta-ja-räägi loogikat, mitte pidevat taustal kuulamist. Hääl ei saada, jaga, kustuta ega kinnita tundlikku tegevust ilma nähtava eelvaate ja tavapärase kinnitamiseta.

Otsest speech-to-speech reaalajaagenti käsitletakse hilisema prototüübina. Ka siis jääb SotsiaalAI teadmusbaas eraldi serveripoolseks tööriistaks ning allikapõhine vastamine ei tohi muutuda mudeli kontrollimata üldvestluseks.

### 9.5. Lokaalne mudel kui ruumi meeleorgan

Ruumiline liides võib kasutada väikseid lokaalseid mudeleid sisendi tõlgendamiseks:

- MediaPipe käe- ja peapunktide jaoks;
- Silero VAD kõne alguse ja lõpu jaoks;
- Whisper eestikeelse transkriptsiooni jaoks;
- väikest klassifikaatorit eestikeelse käsu kavatsuseks;
- Tesseracti eestikeelse dokumenditeksti jaoks;
- Eesti reeglitega privaatsuse eelkihti.

Need mudelid ei vastuta sotsiaaltöö sisulise otsuse või õigusliku vastuse eest. Nad muudavad inimese tegevuse ruumile arusaadavaks ning annavad kasutajale enne toimingut tagasiside.

### 9.6. Avakuva „Selguse väli”

Avakuva keskne liikumisidee on hajusa info muutumine selguseks. Vähesed valgusosakesed kogunevad kõigepealt lauseks „Kõik algab selgusest”. Kui kasutaja liigub sõnale „SISENEN”, lahustub lause osakestest aeglaselt pöörlevaks ringiks, mis tähistab ruumi läve. Pärast ringi valmimist hakkavad selle eri kohtadest valitud osakesed lühikeste ebakorrapäraste vahedega ükshaaval kergelt kaarduvaid radu mööda keskpunkti liikuma ja kaovad sinna jõudes. Stardid on piisavalt tihedad, et sissevool oleks selgelt tajutav, kuid iga osake liigub eraldi; osakesed ei ilmu hoveri ajal ringile tagasi ega jää keskosas tiirlema. Nii ei ole efekt ainult dekoratsioon, vaid jutustab platvormi põhiideest — hajusast infost saab selgus ja selgusest järgmine samm.

Suur SotsiaalAI sõnamärk tõuseb avakuvale alt ning jääb kompositsiooni alumiseks ruumiankruks. „SISENEN” ise on rahulik tekstiline lävi, mitte klaasnupp. Vähendatud liikumise korral jäävad samad tähendused alles staatilise teksti ja selge sisenemistoiminguna.

## 10. Liikumise ja ligipääsetavuse piirid

Ruumiline keskkond peab olema kasutatav ka siis, kui kasutaja ei soovi või ei saa animatsioonidega liikuda.

Põhimõtted:

- animatsioon on katkestatav;
- kaamera ei liigu teksti sisestamise ajal ootamatult;
- kasutaja saab alati tagasi ja edasi liikuda;
- ruumi seis ja pooleliolev töö säilivad;
- kõik olulised seisundid on avatavad otselingiga;
- klaviatuuriga saab teha samu sisulisi tegevusi nagu hiire või lohistamisega;
- fookus on nähtav;
- puutealad on piisavalt suured;
- `prefers-reduced-motion` korral kasutatakse rahulikku või lamedamat ruumivarianti;
- kiireloomulise abi teekond ei sõltu animatsiooni läbimisest;
- kasutaja saab vajaduse korral valida vähendatud ruumilisuse või kiire töörežiimi.

Ligipääsetav variant ei ole eraldi vana veebileht, vaid sama ruumilise struktuuri teine esitlusviis.

## 11. Edasise kaardistuse küsimused

Iga olemasoleva või kavandatava funktsiooni puhul vastatakse edaspidi vähemalt järgmistele küsimustele:

1. Mis on selle funktsiooni ruumiline metafoor?
2. Kas see on eraldi ruum, muutuv tööala, lennuteekond või vabalt kasutatav lõuend?
3. Mis on kasutaja põhiobjekt selles ruumis?
4. Millist ühte tegevust peab kasutaja kohe mõistma?
5. Mida saab ta liigutada, ühendada, võrrelda või jagada?
6. Milline tähendus on objekti asukohal?
7. Milline info jääb ruumi tagasi tulles alles?
8. Kuidas jõuab kasutaja sinna avastuslikult ja kuidas otseteega?
9. Kellega saab ruumi või üksikut objekti jagada?
10. Kuidas töötab sama tegevus klaviatuuri ja vähendatud liikumisega?
11. Milline on ruumist saadav praktiline tulemus?
12. Kuidas saab tulemust kasutaja kinnitusel järgmises ruumis kasutada?

## 12. Esimene prototüüpimise suund

Esimest prototüüpi ei ole mõistlik teha kogu platvormist korraga. Sobiv katseala on funktsioon, mille praegune pikk vorm või juhtpaneel näitab selgelt ruumilise lähenemise väärtust.

Tugevad kandidaadid:

- **Kovisioon:** 8 etappi saab muuta järjest avanevateks ühistöö aladeks;
- **Teemaseemned:** praegune liigutatavate ja muudetava suurusega kaartide katse võimaldab hinnata otsese ruumitöö kasu ja piire;
- **Teemaseemnete kaamerarežiim:** eraldi vabatahtlik prototüüp saab võrrelda näpistamisega valimist, lohistamist ja suuruse muutmist hiire-klaviatuuri variandiga;
- **eelpöördumine:** pikk sisestusvoog saab muutuda rahulikuks lõuendite teekonnaks;
- **Tööheaolu:** küsimustikust saab olukorrast lähtuv privaatne refleksiooniruum;
- **Meetodipeegel:** ruumiline võrdlemine ja objektide paigutamine on funktsiooni sisuline osa.

Prototüüp peab tõendama vähemalt nelja asja:

1. kasutaja saab aru, kuhu ta sattus ja mida teha;
2. ruumiline tegevus on sisuliselt kasulikum kui vormi täitmine;
3. kasutaja leiab vajaduse korral kiiresti järgmise või varasema ala;
4. sama tegevus on võimalik vähendatud liikumise ja klaviatuuriga.

## 13. Kokkuvõttev tootelause

**SotsiaalAI ei ole sotsiaalvaldkonna funktsioonidega veebileht, vaid ruumiline abi-, töö- ja koostöökeskkond, kus vestlusest võivad kasutaja kontrolli all saada tööobjektid, objektidest seosed ning seostest järgmised sammud.**
