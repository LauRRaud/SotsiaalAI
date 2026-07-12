# Fable 5 lähteülesanne: SotsiaalAI platvormiloogika ja funktsioonide seosed

Kuupäev: 11.07.2026  
Töö liik: aktiivse platvormi analüüs ja arhitektuuriline soovitus  
Esimese töö piir: analüüs, mitte massiline implementatsioon

## 1. Ülesande eesmärk

Vaata üle SotsiaalAI praegune platvormiloogika ja selgita, kuidas olemasolevad funktsioonid päriselt omavahel seotud on ning kuidas need peaksid tulevikus moodustama ühe arusaadava, rollipõhise ja ruumilise keskkonna.

Tulemus peab aitama otsustada:

- millised praegused funktsioonid on iseseisvalt praktilised;
- millised on kasutajaliideses olemas, kuid töövoona poolikud;
- millised funktsioonidevahelised ühendused töötavad päriselt;
- kus nupp või tekst lubab üleandmist, mida API, andmemudel või vastuvõttev roll ei toeta;
- millised uued ühendused annaksid suurima kasutajaväärtuse;
- milliseid funktsioone ei ole praegu mõistlik juurde ehitada;
- milline võiks olla SotsiaalAI moodulite ühine arhitektuur ilma STAR2 dubleerimiseta.

## 2. Allikate järjekord

Kasuta allikaid selles järjekorras:

1. **Aktiivne kood, marsruudid, komponendid, API-d, andmemudelid ja testid.**
2. [SotsiaalAI ideed ja võimalikud arendussuunad](./ideed.md).
3. [SotsiaalAI ruumilise kogemuse lähtekoht](./ruumilise-kogemuse-lahtekoht.md).
4. [SotsiaalAI funktsioonide ja UX-i kaardistus](./funktsioonide-ja-ux-kaardistus.md).
5. [SotsiaalAI lokaalsed mudelid ja multimodaalne interaktiivsus](./lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md).
6. Muud konkreetselt funktsiooniga seotud värsked spetsifikatsioonid, kui aktiivne kood neile viitab.

Ära kasuta `docs/audits` kausta ega vanu raportifaile platvormi praeguse seisu tõendina. Need võivad olla ajalooline taust, kuid nende väited tuleb aktiivsest koodist uuesti kontrollida.

Kui dokument ja kood lähevad vastuollu, kirjelda eraldi:

- mida kood praegu teeb;
- mida dokument kavandab;
- milline tooteotsus on puudu.

### 2.1. ESTA tähendus ja koostöö staatus

**ESTA tähendab selles projektis Eesti Sotsiaaltöö Assotsiatsiooni**, mitte tehnilist süsteemi ega SotsiaalAI kasutajatüüpi. ESTA on SotsiaalAI võimalik tulevane erialane koostööpartner. Ära eelda, et kirjeldatud partnerlus, andmevahetus, liikmesuse kontroll või funktsioonid on juba kokku lepitud või kasutusele võetud.

Arutatud, kuid praegu kavandatavad võimalused on:

- olemasoleva kasutaja ESTA liikmestaatuse kontrollimine;
- ESTA liikmele lisavõimaluste avamine samal SotsiaalAI kontol;
- ESTA üldfoorum, ametlike piirkondade ruumid ja teemakogukonnad;
- ESTA kontrollitud superviisori või moderaatori tiitel;
- professionaalsete materjalide ja metoodika koostöö;
- ainult piisavalt üldistatud ja privaatsust säilitavad valdkondlikud koondid;
- ärimudeli idee, mille järgi võiks üks euro aktiivse ESTA liikme SotsiaalAI kuutasust liikuda ESTA-le ilma kasutaja hinda tõstmata.

Need on toote- ja partnerlusideed, mitte aktiivse koodi nõuded ega tõend olemasolevast kokkuleppest. Analüüsis:

1. märgi iga ESTA-ga seotud osa staatuseks kas aktiivne kood, UI-demo või kontseptsioon;
2. käsitle ESTA liikmesust lisatunnuse ja võimekusena, mitte eraldi põhikasutajagrupina;
3. ära anna ESTA-le liikmesuse tõttu ligipääsu kasutaja privaatsele sisule;
4. ära esita ühe euro mudelit, superviisorite kontrolli ega andmeedastust kinnitatud koostöötingimusena;
5. paku ainult selline tehniline arhitektuur, mida saab hiljem reaalse koostööleppe järgi sisse või välja lülitada.

ESTA ideede täpsem taust on `docs/ideed.md` peatükkides 25–27. Organisatsiooni avalik veeb on [eswa.ee](https://www.eswa.ee/).

## 3. SotsiaalAI põhimudel

SotsiaalAI ei ole kohustuslik jada, kus kõik kasutajad läbivad funktsioonid 1–10. Platvorm on vabalt kasutatavate, kuid üksteist täiendavate võimekuste võrgustik.

```text
kasutaja vajadus
→ kasutaja valitud funktsioon
→ iseseisev praktiline tulemus
→ soovi korral järgmise võimaluse soovitus
→ kasutaja kontrollitud info üleandmine
```

Iga funktsioon peab:

- andma väärtuse ka eraldi kasutades;
- olema avatav otse, kui roll ja õigused seda lubavad;
- soovitama järgmist võimalust ainult siis, kui see on sisuliselt põhjendatud;
- näitama enne jagamist või üleandmist täpselt, mis liigub ja kellele;
- võimaldama tegevuse pooleli jätta ja hiljem jätkata;
- hoidma privaatse, jagatud ja ametliku info selgelt lahus.

## 4. Rollid

### Eluküsimusega pöörduja

Peamised vajadused:

- saada selgust oma olukorras;
- leida teenus, toetus, õigus või kontakt;
- valmistada ette dokument või eelpöördumine;
- hoida oma sammud Teekonnal koos;
- esitada abisoov või abipakkumine;
- jagada ainult enda kinnitatud infot;
- teha koostööd spetsialisti või teenuseosutajaga ühises ruumis.

### Sotsiaaltöö spetsialist

Peamised vajadused:

- võtta vastu eelpöördumisi;
- valmistada kohtumist ja juhtumitööd ette;
- korraldada võrgustikutööd;
- koostada STAR2 jaoks kontrollitud mustandeid ilma paralleelset ametlikku registrit loomata;
- reflekteerida meetodi valikut ja mõju Meetodipeeglis;
- kasutada Kovisiooni, Supervisiooni ja eetilist arutelu;
- kasutada privaatset Tööheaolu tuge;
- leida ja jagada professionaalseid materjale.

### Teenuseosutaja

Peamised vajadused:

- hallata teenuseprofiili;
- olla Teenusekaardil leitav;
- võtta vastu talle suunatud pöördumisi;
- osaleda kutse alusel vestlus- või võrgustikuruumis;
- näha ainult talle teadlikult jagatud infot.

### Lisatiitlid ja võimekused, mitte uued kasutajagrupid

Platvormi kolm praegust põhikasutajatüüpi on:

1. eluküsimusega pöörduja;
2. sotsiaaltöö spetsialist;
3. teenuseosutaja.

KOV osakonna juht, superviisor, ESTA liige, ESTA piirkonna või kogukonna moderaator ja ESTA programmi haldur ei ole vaikimisi uued põhikasutajagrupid. Need on olemasolevale kasutajale lisatavad ning vajaduse korral kontrollitavad tiitlid, liikmesused, organisatsiooniseosed või võimekused. Ühel inimesel võib olla korraga mitu sellist omadust.

Näiteks võib sotsiaaltöö spetsialist saada juurde:

- kontrollitud superviisori tiitli ja õiguse juhtida Supervisiooni ruumi;
- ESTA liikmestaatuse ja ligipääsu ESTA liikmealale;
- ESTA piirkonna moderaatori võimekuse;
- KOV osakonna juhi õiguse näha ainult lubatud koondvaateid.

Lisatiitel võib avada olemasoleval Töölaual mõne uue vaate, ruumi või toimingu, kuid ei eelda automaatselt täiesti uut kontot, põhiteekonda või dubleerivat Töölauda. Uut kasutajatüüpi tuleks kaaluda ainult siis, kui inimese põhieesmärk, andmeruum ja kogu navigeerimisloogika erinevad olemasolevatest kasutajatest sisuliselt.

Platvormi administraator ja teadmusbaasi ülevaataja on süsteemi haldusõigused, mitte avalikud kasutajapersoonad. Ka lisatiitlid ja haldusõigused ei anna vaikimisi ligipääsu töötaja privaatsele Tööheaolule, pöörduja privaatsele Teekonnale ega Supervisiooni sisule. Iga avanev võimalus peab vastama konkreetsele serveripoolsele õigusele, mitte ainult kasutajaliideses kuvatavale tiitlile.

## 5. Analüüsitavad põhivõimekused

| Võimekus | Iseseisev põhiväärtus | Võimalik kontrollitud väljund |
|---|---|---|
| Vestlus | olukorra mõtestamine ja allikatega vastus | kasutaja kinnitatud tööobjekt või mustand |
| Teadmusbaas | kontrollitud valdkonnainfo | viidatud vastus, materjal või juhis |
| Teekond | kasutaja sammude ja valikute privaatne tervik | valitud kokkuvõte eelpöördumiseks |
| Eelpöördumine | vastuvõtu ettevalmistamine | inimese kinnitatud pöördumine |
| Pöördumiste vastuvõtt | saabunud info mõtestamine ja kohtumise ettevalmistus | vastuvõtu järgmine samm või ruum |
| Juhtumitöö assistent | professionaalse töö korraldamine | STAR2 mustand, tegevus või võrgustikukutse |
| Meetodipeegel | meetodi, töövõtte ja mõju refleksioon | privaatne refleksioon või üldistatud kovisiooniküsimus |
| Võrgustikutöö | osapoolte, rollide ja kokkulepete koordineerimine | kutse, kohtumine, kokkulepe või STAR2 mustand |
| Kovisioon | kolleegide struktureeritud juhtumiarutelu | üldistatud järeldus ja järgmised sammud |
| Supervisioon | superviisori juhitud professionaalne areng | jagatud kokkuvõte ja privaatne järelrefleksioon |
| Tööheaolu | töötaja privaatne eneserefleksioon ja toe plaan | privaatne plaan või kasutaja kinnitatud üldistatud toe küsimus |
| Dokumendid | faili hoidmine, analüüs ja mõistmine | kasutaja kontrollitud mustand või järgmine samm |
| Dokumendi koostamine | taotluse või avalduse ettevalmistus | kasutaja üle vaadatud dokument |
| Abisoovid ja abipakkumised | kogukondliku toe kirjeldamine ja sobitamine | avaldatud kirje või ühine ruum |
| Ruumid | kutse alusel koostöö | vestlus, kokkulepped ja jagatud tööobjektid |
| Teenuseprofiil | teenuseosutaja leitav ja ajakohane profiil | avaldatud teenusekirje |
| Teenusekaart | ametliku ja kogukondliku toe leidmine | valitud kontakt, teenus või pöördumine |
| Materjalid | professionaalse materjali esitamine | ülevaatusse saadetud materjal |
| ESTA liikmeala | erialane kogukond ja piirkondlik koostöö | arutelu, sündmus, küsitlus või ettepanek |

Kontrolli iga võimekuse puhul, kas tabelis kirjeldatud väärtus ja väljund on aktiivses koodis päriselt olemas.

## 6. Kontrollitavad funktsioonidevahelised seosed

### Pöörduja võimalik rada

```text
Vestlus
├── võib jääda ainult vastuseks
├── kasutaja valikul Teekond
├── kasutaja valikul dokument
├── kasutaja valikul eelpöördumine
└── kasutaja valikul abisoov või abipakkumine

Teekond
└── valitud kokkuvõte → eelpöördumine

Eelpöördumine
└── sotsiaaltöötaja vastuvõtt
    └── vajaduse korral ühine ruum
```

### Spetsialisti võimalik rada

```text
Saabunud eelpöördumine
→ vastuvõtu ettevalmistus
→ Juhtumitöö assistent
├── võrgustikutöö
├── STAR2 jaoks kontrollitud mustand
├── Meetodipeegel
└── üldistatud küsimus Kovisiooni, Supervisiooni või eetilisse arutellu
```

### Teenuse ja kogukonna rada

```text
Teenuseprofiil → Teenusekaart → pöörduja valitud kontakt või pöördumine

Abisoov + abipakkumine
→ sobitus
→ ühine ruum
→ osapoolte kokkulepitud järgmine samm
```

### Tööheaolu rangelt piiratud rada

```text
Privaatne Tööheaolu kirje
├── jääb privaatseks
├── kasutaja koostab üldistatud Kovisiooni küsimuse
├── kasutaja koostab üldistatud Supervisiooni küsimuse
└── vabatahtlik standardiseeritud osa võib osaleda anonüümses koondis
```

Tööheaolu algset privaatset kirjet ei anta automaatselt ühelegi teisele funktsioonile, juhile, ESTA-le ega tööandjale.

## 7. Iga seose tehniline kontroll

Koosta iga leitud või lubatud ühenduse kohta tabel järgmiste väljadega:

| Väli | Kontrollküsimus |
|---|---|
| Lähtekoht | Milline komponent, marsruut või andmeobjekt algatab? |
| Sihtkoht | Milline roll ja vaade võtab vastu? |
| Käivitaja | Kas kasutaja vajutab, kinnitab, jagab või toimub automaatika? |
| Üleantav objekt | Kas liigub koopia, viide, kokkuvõte, fail või uus mustand? |
| Eelvaade | Kas kasutaja näeb enne kinnitamist täpselt üleantavat sisu? |
| Õigused | Milline serveripoolne kontroll kaitseb sihtkohta? |
| Püsivus | Kas tulemus salvestub andmebaasi või on ainult lokaalne UI olek? |
| Vastuvõtt | Kas sihtroll näeb ja saab tulemust päriselt kasutada? |
| Tagasiside | Kas lähtekoht saab kinnituse saatmise, vastuvõtu või vea kohta? |
| Elutsükkel | Kas objektil on mustand, saadetud, vastu võetud, lõpetatud ja kustutatud olekud? |

Erista vähemalt neli hinnangut:

- **töötab otsast lõpuni;**
- **osaliselt töötab;**
- **ainult kasutajaliides või demoolek;**
- **ainult kontseptsioon.**

## 8. Andme- ja privaatsuspiirid

Analüüs peab säilitama järgmised otsused:

- STAR2 jääb ametliku kliendiinfo, hindamise, juhtumiplaani, teenuste ja otsuste põhisüsteemiks seni, kuni puudub ametlik teistsugune korraldus või liidestus.
- SotsiaalAI ei loo STAR2 ametlikust juhtumiplaanist teist aktiivset koopiat.
- Juhtumitöö assistent võib aidata koostada STAR2 jaoks mustandit ja märkida käsitsi ülekandmise olekut.
- AI loodud hüpotees, soovitus või refleksioon ei muutu automaatselt ametlikuks kirjeks.
- kliendi Teekond, töötaja Meetodipeegel, Tööheaolu ja Supervisiooni privaatne ala on eri andmeruumid;
- jagamine toimub minimaalse vajaliku väljavõtte, mitte terve lähteobjekti kopeerimisega;
- tervishoiu või perearsti kaasamine toimub alguses kutse või minimaalse kokkuvõtte kaudu, mitte eeldatud meditsiiniandmete integratsioonina;
- juht ja ESTA näevad ainult neile selgelt määratud koond- või haldusandmeid, mitte privaatse töö sisu.

Tuvasta aktiivsest koodist kõik kohad, kus need piirid on serveris jõustatud, ainult kasutajaliideses eeldatud või üldse puudu.

## 9. Ruumilise kasutuskogemuse piir

SotsiaalAI tulevane vorm ei ole vana lehtede süsteem ruumitausta peal. Funktsioonide seoste analüüs peab arvestama, et tulemus võib liikuda järgmisse ruumi tööobjektina, mitte ainult lingi või vormiväljana.

Praegused kinnitatud suunad:

- põhinavigatsioon kasutab ruumilist karusselli;
- kogenud kasutaja vajab kiiret ruumiindeksit või otseteed;
- Teemaseemned katsetavad liigutatavaid ja muudetava suurusega kaarte;
- Kovisioon ja Teemaseemned kasutavad täisekraani lõuendit;
- aktiivne objekt tuleb kattumisel esiplaanile;
- taustal olev objekt võib taanduda, aktiivne objekt jääb klaasjaks;
- ruumiülene juhtpaneel avaneb ülaservast karussellis ja töövaadetes;
- juhtpaneeli ei kuvata avastseenis;
- töölõuend reserveerib juhtpaneelile ülemise ohutu tsooni;
- samaaegse info hulka vähendatakse etappideks jagamisega, mitte teksti liiga väikeseks tegemisega;
- kõik lohistatavad ja ruumilised toimingud vajavad klaviatuuri ning vähendatud liikumise alternatiivi.

Tulevane vabatahtlik multimodaalne kiht võib kasutada:

- MediaPipe'i näpistuse ja pea asendi jaoks;
- Silero VAD-i kõne alguse ja lõpu jaoks;
- lokaalselt või isemajutatult töötavat Whisperit eestikeelseks transkriptsiooniks;
- väikest eestikeelset käsuklassifikaatorit ruumi toiminguteks;
- Tesseracti `est` mudelit OCR-iks;
- Eesti reeglitega privaatsuse eelkontrolli.

Fable peab eristama kaht SotsiaalAI häälekasutust:

1. kontrollitud dikteerimine, kus kasutaja kontrollib transkripti ja saadab selle ise;
2. eraldi häälvestluse sessioon, kus kõnevoor saadetakse automaatselt olemasolevasse RAG-i, vastus kuvatakse koos allikatega ja loetakse automaatselt ette.

Häälvestluse esimene mõistlik variant on olemasoleva tekstivestluse ümber loodav ahel `STT → RAG → TTS`, mitte kogu vestlussüsteemi asendamine. Hilisema speech-to-speech prototüübi korral tuleb käsitleda SotsiaalAI RAG-i kohustusliku serveripoolse tööriistana ning hinnata, kuidas vältida kontrollimata allikata vastuseid.

Need on tehnoloogiakandidaadid, mitte aktiivse platvormi valmis funktsioonid. Fable peab eristama seadmes lokaalset, brauseris lokaalset ja SotsiaalAI serveris isemajutatud töötlust ning arvestama, et välise API puudumine ei kõrvalda taristu- ega hoolduskulu.

Ära paku lihtsalt uusi külgmenüüsid, tabeleid ja pikki vormilehti. Seo iga soovitus funktsiooni põhiväärtuse, tööobjekti ja kasutaja ruumilise tegevusega.

## 10. Fable 5 konkreetsed ülesanded

1. Kaardista aktiivse koodi kolm põhikasutajatüüpi, lisatiitlid, võimekused, põhimarsruudid, põhikomponendid, API-d ja andmemudelid. Ära käsitle iga tiitlit automaatselt uue kasutajagrupina.
2. Koosta funktsioonigraaf: sõlmed on võimekused, servad on päriselt olemasolevad või kavandatud üleandmised.
3. Märgi iga serva valmidus: töötab, osaline, UI-demo või kontseptsioon.
4. Leia tupikteed: funktsioon annab tulemuse, kuid kasutaja ei saa sellega midagi edasi teha.
5. Leia näilised ühendused: nupp või tekst lubab tegevust, mida vastuvõttev süsteem ei toeta.
6. Leia dubleerimine: sama mõiste, andmeobjekt või töövoog elab mitmes kohas erineva nime all.
7. Erista funktsioonid, mis peaksid jagama taristut, kuid mitte andmesisu, näiteks Kovisioon, Supervisioon ja muud ruumid.
8. Kontrolli rollide ja serveripoolsete õiguste sümmeetriat.
9. Paku ühine mooduli- ja tööobjektide arhitektuur, mis sobib ruumilise kasutuskogemusega.
10. Prioriseeri parandused enne uute funktsioonide ehitamist.
11. Hinda, millised interaktiivsuse mudelid on mõistlikud brauseris, kasutaja seadmes või SotsiaalAI serveris ning millised ei kuulu esimesse MVP-sse.
12. Kaardista olemasoleva mikrofoni, sõnumi saatmise, RAG-i, vastuse voogedastuse ja ettelugemise komponendid ning kirjelda väikseim muudatuspakett eraldi eestikeelse häälvestluse režiimi loomiseks.

## 11. Oodatud väljund

Koosta üks uus raport, näiteks:

`docs/fable-5-platvormiloogika-ulevaade.md`

Raport peab sisaldama:

1. lühikest juhtkokkuvõtet;
2. aktiivse platvormi rolli- ja moodulikaarti;
3. funktsioonigraafi;
4. ühenduste valmidustabelit;
5. dubleerimiste ja tupikteede loendit koos koodiviidetega;
6. privaatsus- ja õiguste piiri probleeme;
7. soovitatud sihtarhitektuuri;
8. prioriseeritud paranduskava;
9. ühte soovitatud esimest vertikaalset lõiku;
10. eraldi loendit küsimustest, mis vajavad tooteomaniku otsust.

Iga tehniline väide peab viitama praegusele failile, marsruudile, skeemile või testile. Üldise soovituse juures erista fakt, järeldus ja ettepanek.

## 12. Esimese töö mitte-eesmärgid

Esimeses Fable 5 töös ära:

- ehita korraga valmis Juhtumitöö assistenti, Meetodipeeglit või ESTA liikmeala;
- tee kogu rakenduses massilist UI ümberkujundust;
- käsitle vana auditit praeguse tõena;
- muuda andmebaasi skeemi enne sihtarhitektuuri kinnitamist;
- loo automaatset STAR2 integratsiooni;
- kopeeri privaatseid andmeobjekte moodulite vahel;
- nimeta kontseptuaalset funktsiooni valmis funktsiooniks;
- kustuta olemasolevaid kasutaja muudatusi dirty worktree's.

## 13. Soovitatud esimese vertikaalse lõigu hindamine

Analüüsi lõpus võrdle vähemalt järgmisi kandidaate:

1. Vestlus → kasutaja kinnitatud Teekonna objekt → eelpöördumine.
2. Eelpöördumine → sotsiaaltöötaja vastuvõtt → ühine ruum.
3. Juhtumitöö assistent → STAR2 kontrollitud mustand → käsitsi ülekantud olek.
4. Juhtumitöö assistent → Meetodipeegel → üldistatud Kovisiooni küsimus.
5. Tööheaolu → kasutaja kinnitatud üldistatud Supervisiooni või Kovisiooni sisend.

Soovita esimene lõik järgmiste kriteeriumide alusel:

- kasutajaväärtus;
- olemasoleva koodi taaskasutus;
- privaatsusrisk;
- STAR2 dubleerimise oht;
- eri rollide arv;
- testitavus sünteetiliste andmetega;
- sobivus ruumilise kasutuskogemuse prototüübiks.

Esimese Fable töö lõpptulemus on otsustatav kaart ja tegevusjärjekord, mitte võimalikult suur koodimuudatus.
