# SotsiaalAI platvormi suur plaan: Teenusekaart kui järgmine siduv arendusetapp

Seis: 2026-06-03  
Staatus: arendusplaan ja mõisteline lähtealus

## Lühihinnang

Plaan on õiges suunas. Selle tugevus on see, et Teenusekaart ei ole käsitletud ainult kaardina, vaid siduva andme- ja tegevuskihina pöörduja, KOV kontaktide, teenuseosutajate, eelpöördumise ja hilisema AI soovitamise vahel.

Kõige olulisemad otsused, mida selle plaani järgi hoida:

- vestlus on vaikimisi RAG-põhine infonõustamine, mitte töövoogude automaatne käivitaja;
- Teekond jääb esialgu pöörduja privaatseks tööruumiks;
- eelpöördumine on esimene kasutaja kinnitatud jagatav algkontakt;
- ruumid on jätkusuhtluseks, mitte esmaseks pöördumiseks;
- dokumendi koostamine on eraldi juhendatud töövoog, mitte vestluse `+` menüü kiirtegevus;
- Teenusekaart on praegu kõige mõistlikum järgmine siduv arendusetapp.

## 1. Üldine arendusidee

SotsiaalAI ei ole üksikute tööriistade kogum. Platvorm peab moodustama seotud töövoogude süsteemi kolme kasutajagrupi jaoks:

1. Pöörduja
2. Sotsiaaltöö spetsialist
3. Teenuseosutaja

Põhiloogika:

- pöörduja on keskne kasutaja, kelle olukorrast ja vajadusest teekond algab;
- sotsiaaltöö spetsialist ja teenuseosutaja on toetavad osapooled, kes saavad parema eelinfo, vastuvõtu töövaate ja võimaluse platvormis edasi suhelda;
- SotsiaalAI assistent aitab infot leida, olukorda sõnastada, sobivaid kontakte leida, mustandeid koostada ja töövooge käivitada;
- kasutaja kontrollib alati, mida salvestatakse, kellele midagi saadetakse ja mida jagatakse.

Peamine töövoog pöörduja vaates:

```text
Pöörduja kirjeldab olukorda
-> saab infot vestluses RAG-andmebaasi põhjal
-> vajadusel salvestab info Teekonda
-> leiab Teenusekaardilt sobiva KOV kontakti, lastekaitse kontakti või teenuseosutaja
-> koostab Eelpöördumise
-> vastuvõtja näeb seda Pöördumiste vastuvõtus
-> vajadusel avatakse Ruum vestluse lehel jätkusuhtluseks
```

## 2. Rollide üldine loogika

### 2.1 Pöörduja

Pöörduja jaoks peab platvorm vastama küsimusele:

> Mida ma saan oma olukorras järgmisena teha?

Pöörduja saab:

- küsida vestluses infot;
- kirjeldada oma olukorda;
- salvestada privaatse Teekonna;
- avada Teenusekaardi;
- koostada Eelpöördumise;
- luua Abisoovi;
- vaadata Abipakkumisi;
- koostada dokumente eraldi dokumendi koostamise töövoos;
- analüüsida dokumente vestluse kiirtegevusena;
- jätkata suhtlust Ruumides, kui kontakt on loodud.

Oluline: vestluse leht ei peaks vaikimisi töövooge automaatselt käivitama. Vaba küsimus tähendab üldjuhul infopäringut ja peaks minema RAG-vastamisse. Töövoog algab kasutaja selgest valikust, CTA-st või ühemõttelisest käsust.

### 2.2 Sotsiaaltöö spetsialist

Sotsiaaltöö spetsialist vajab töövooge, mis aitavad:

- vastu võtta eelpöördumisi;
- kasutada eelkaardistuse kokkuvõtet;
- koostada dokumente;
- analüüsida dokumente;
- kasutada teenusekaarti kontaktide ja teenuseosutajate leidmiseks;
- teha kovisiooni;
- hallata materjale;
- avada vajadusel Ruum jätkusuhtluseks.

Spetsialisti töölaud võib sisaldada tööalaseid kaarte nagu:

- Abisoovid
- Abipakkumised
- Dokumendid
- Dokumendi koostamine
- Pöördumised
- Lisa inimene
- Kovisioon
- Tööheaolu
- Materjalid
- Teenusekaart

### 2.3 Teenuseosutaja

Teenuseosutaja jaoks on keskne küsimus:

> Kuidas minu teenused on leitavad ja kuidas pöördumised minuni jõuavad?

Teenuseosutaja saab:

- täita Teenuseprofiili;
- lisada teenuseid;
- lisada teeninduskohti;
- määrata kontaktid, keeled, sihtrühmad ja piirkonnad;
- lubada või keelata eelpöördumisi;
- kuvada teenused Teenusekaardil;
- vastu võtta pöördumisi;
- vajadusel avada Ruum;
- luua ja hallata Abipakkumisi;
- hallata dokumente ja materjale.

Teenuseosutaja töölaud võib sisaldada:

- Teenuseprofiil
- Teenusekaart
- Pöördumised
- Abisoovid
- Abipakkumised
- Dokumendid
- Dokumendi koostamine
- Materjalid
- Lisa inimene

## 3. Funktsioonide mõisteline jaotus

### Vestlus

Vestlus on infoküsimuste, RAG-nõustamise ja suunamise koht.

Vestluses saab kasutaja küsida näiteks:

- "Mida teha, kui vajan koduteenust?"
- "Kuhu pöörduda hoolduskoormuse tõttu?"
- "Mis vormi või avaldust on vaja?"
- "Kas selle kohta on KOV juhend?"

Vestluse vastus peaks kasutama RAG-andmebaasi, allikaid, juhendeid, vorme, KOV infot ja teenusekirjeldusi.

Vestlus ei peaks vaikimisi koostama dokumenti ega saatma pöördumist.

Vestluse vastuse lõpus võib pakkuda CTA-sid:

- Ava Teenusekaart
- Koosta Eelpöördumine
- Ava dokumendi koostamine
- Salvesta Teekonda
- Kasuta seda vormi

### Vestluse `+` menüü

Vestluse `+` menüüs peaksid olema kiirtegevused, mitte kogu platvormi arhitektuur.

Soovituslikud tegusõnad:

- Loo Abisoov
- Loo Abipakkumine
- Tee Süvauuring
- Analüüsi dokumenti

"Koosta dokument" ei peaks olema `+` menüüs, sest dokumendi koostamine on eraldi juhendatud töövoog/leht.

### Teekond

Teekond on pöörduja privaatne kokkuvõtte- ja suunamiskiht.

Teekond ei ole automaatselt jagatav pöördumine ega ametlik hindamine.

Teekonda saab kasutada:

- olukorra privaatselt salvestamiseks;
- puuduoleva info märkimiseks;
- järgmiste sammude hoidmiseks;
- eelpöördumise eeltäitmiseks;
- teenusekaardi avamiseks eelfiltriga.

Teekonna info ei lähe KOV-ile, teenuseosutajale ega spetsialistile enne kasutaja kinnitust.

### Eelpöördumine

Eelpöördumine on jagatav algkontakt.

Eelpöördumise eesmärk:

- aidata inimesel olukord arusaadavalt kokku võtta;
- koguda vajalik eelinfo;
- leida sobiv adressaat;
- koostada pöördumise mustand;
- lasta kasutajal enne saatmist kõik üle vaadata.

Eelpöördumine ei ole ametlik abivajaduse hindamine ega teenuse määramise otsus.

Eelpöördumise alustamisel peab kasutaja ise valima raja:

1. Kirjeldan olukorda oma sõnadega
2. Lühem eelkaardistus
3. Põhjalikum eelkaardistus

Ära määra vaikimisi rada. Kasutaja valib ise, kui palju ta soovib infot anda.

### Pöördumiste vastuvõtt

Pöördumiste vastuvõtt on vastuvõtja töövaade.

Seda kasutavad:

- KOV sotsiaaltöö spetsialist;
- lastekaitsetöötaja;
- teenuseosutaja;
- muu rollipõhiselt lubatud vastuvõtja.

Vastuvõtja saab:

- vaadata pöördumise kokkuvõtet;
- vaadata kasutaja kinnitatud mustandit;
- kontrollida nõusolekut või pöördumise alust;
- hinnata kiireloomulisust;
- märkida täpsustamist vajava info;
- valida järgmise sammu;
- vastata või avada Ruum.

### Ruumid

Ruumid on jätkusuhtluse koht.

Ruum ei ole esimene pöördumise samm. Ruum tekib tavaliselt pärast seda, kui:

- eelpöördumine on saadetud;
- vastuvõtja on selle vastu võtnud;
- osapooled soovivad platvormis edasi suhelda.

Ruumid asuvad vestluse lehe parempoolses rail'is nimega "Ruumid".

Ruumid ei pea olema töölaua põhikaart.

## 4. Praegune arenduse fookus: Teenusekaart

Hetkel on fookus Teenusekaardil.

Teenusekaart on järgmine siduv arendusetapp, sest see ühendab:

- pöörduja vajaduse;
- KOV kontaktid;
- teenuseosutajate profiilid;
- teeninduskohad;
- eelpöördumise adressaadi valiku;
- hilisema AI soovitamise.

Teenusekaart ei ole ainult kaart. See on kontaktide, teenuste ja pöördumise suundade leidmise kiht.

## 5. Teenusekaardi eesmärk

Teenusekaart peab aitama kasutajal leida:

1. KOV sotsiaalhoolekande kontakt
2. KOV lastekaitse või lapse heaolu kontakt
3. teenuseosutaja
4. konkreetne teenus
5. teeninduskoht
6. sobiv pöördumise või kontakti võtmise võimalus

Teenusekaart peab toetama nii kaardivaadet kui ka nimekirja-/otsinguvaadet.

Oluline: mitte kõik teenused ei tekita kaardimarkerit. Kui teenus toimub veebis, telefoni teel, inimese kodus või piirkondlikult, võib see olla leitav otsingus ja nimekirjas, aga mitte konkreetse markerina.

## 6. Teenusekaardi andmeallikad

Teenusekaart peab kasutama kahte põhilist andmeallikat.

### 6.1 KOV sotsiaalvaldkonna kontaktid

Need ei tule teenuseosutaja profiilist. Need tulevad SotsiaalAI hallatavast struktureeritud KOV andmekihist.

Näited:

- KOV sotsiaalosakond
- KOV sotsiaalhoolekande üldkontakt
- KOV lastekaitse või lapse heaolu kontakt
- muu KOV sotsiaalvaldkonna pöördumiskoht

KOV kontaktikirjel peaks olema:

- tüüp
- KOV nimi
- maakond
- aadress
- telefon
- e-post
- veebileht
- kirjeldus
- allikas
- kontrollimise kuupäev
- staatus
- geokoodi seis
- kaardil nähtavus

### 6.2 Teenuseosutajate avaldatud teenuseprofiilid

Need tulevad `SERVICE_PROVIDER` rollis kasutaja täidetud Teenuseprofiilist.

Teenuseprofiilis on:

- teenuseosutaja põhiinfo;
- teenused;
- teeninduskohad;
- kontaktid;
- keeled;
- sihtrühmad;
- vajadusvaldkonnad;
- pöördumise seaded;
- avaldamise staatus.

Teenusekaart peab kasutama eelkõige teenuse taseme andmeid, mitte ainult organisatsiooni üldkirjeldust.

## 7. Teenuseprofiili ja Teenusekaardi seos

Teenuseprofiil on andmete sisestamise ja haldamise koht. Teenusekaart on nende andmete kuvamise, otsimise ja kasutamise koht.

Teenuseosutaja täidab Teenuseprofiilis:

- organisatsiooni üldandmed;
- teenused;
- teeninduskohad;
- kontaktid;
- keeled;
- piirkonnad;
- sihtrühmad;
- eelpöördumise seaded.

Teenusekaart kasutab sealt:

- teeninduskoha aadressi markeri jaoks;
- teenuse infot otsingu ja filtrite jaoks;
- organisatsiooni infot popupi ja profiilivaate jaoks;
- kontaktinfot ühenduse võtmiseks;
- eelpöördumise seadeid CTA-de kuvamiseks.

Oluline:

- Teenusekaardi marker ei ole teenus ise. Marker on teeninduskoht.
- Ühes teeninduskohas võib olla mitu teenust.
- Üks teenus võib olla seotud mitme teeninduskohaga.
- Mõnel teenusel ei ole füüsilist teeninduskohta.

## 8. Teenusekaardi markeriloogika

Marker tekib teeninduskoha aadressi põhjal, kui:

- teenuseosutaja profiil on avaldatud;
- teeninduskoht on märgitud kaardil nähtavaks;
- aadress on süsteemi poolt leitud või kinnitatud;
- teeninduskoht on seotud vähemalt ühe avaldatud teenusega.

Kasutaja ei sisesta koordinaate. Süsteem leiab koordinaadid aadressi põhjal.

Kui aadressi ei saa kindlalt leida, markerit ei avaldata või kirje jääb ülevaatust vajavasse olekusse.

## 9. Teenusekaardi otsing ja filtrid

Teenusekaart peab toetama otsingut:

- nime järgi;
- kirjelduse järgi;
- aadressi järgi;
- KOV-i järgi;
- maakonna järgi;
- teenuse kategooria järgi;
- sihtrühma järgi;
- eluetapi/vanusegrupi järgi;
- vajaduse või olukorra järgi;
- eluvaldkonna järgi;
- keele järgi;
- teeninduspiirkonna järgi;
- eelpöördumise võimaluse järgi.

Filtrid peavad kasutama teenuse taseme andmeid:

- teenuse kategooria;
- sihtrühmad;
- eluetapp / vanusegrupp;
- vajadused ja olukorrad;
- eluvaldkonnad;
- teeninduspiirkond;
- teenuse osutamise keeled;
- pöördumiste vastuvõtmise keeled;
- eelpöördumise lubatavus;
- KOV/SKA suunamise vajadus.

## 10. Teenusekaardi popup

Markerile vajutades peab avanema selge infokast.

### KOV kontakti puhul kuva

- KOV nimi
- kontakti tüüp: sotsiaalhoolekanne / lastekaitse / üldkontakt
- aadress
- telefon
- e-post
- veebileht
- lühike selgitus, milleks see kontakt sobib
- nupp "Koosta eelpöördumine"
- vajadusel "Ava veebileht" või "Kopeeri kontakt"

### Teenuseosutaja puhul kuva

- teenuseosutaja nimi
- teeninduskoha nimi
- aadress
- selles asukohas seotud teenused
- teenuse kategooriad
- sihtrühmad
- teeninduspiirkond
- kontakt
- nupp "Vaata profiili"
- kui lubatud, nupp "Koosta eelpöördumine"
- kui platvormisisene vastuvõtt on lubatud, näita seda selgelt
- kui ainult väline e-post või kontakt on võimalik, näita seda samuti selgelt

## 11. Teenusekaardi nimekirjavaade

Teenusekaart ei tohiks sõltuda ainult markeritest.

Lisaks kaardile peab olema nimekirjavaade.

Nimekirjas saab kuvada ka:

- veebiteenuseid;
- telefoniteenuseid;
- piirkondlikke teenuseid;
- teenuseid, millel puudub täpne teeninduskoha aadress;
- KOV kontakte, mille aadress vajab ülevaatust, kui see on admini või sisemise ülevaate vaates lubatud.

Tavakasutaja avalikus vaates näita ainult avaldatud ja kasutamiseks sobivaid kirjeid.

## 12. Eelpöördumise seos Teenusekaardiga

Teenusekaart ei peaks lõppema ainult kontaktandmete kuvamisega. Teenusekaardilt peab saama liikuda eelpöördumisse.

Eelpöördumise adressaadiks võib olla:

- KOV sotsiaalhoolekande kontakt;
- KOV lastekaitse kontakt;
- teenuseosutaja;
- konkreetne teenus;
- teeninduskoht;
- teenuse eraldi kontakt;
- organisatsiooni põhikontakt.

Kui kasutaja vajutab "Koosta eelpöördumine", peab eelpöördumise töövoog saama kaasa:

- valitud `ServiceMapEntry`;
- valitud teenus, kui olemas;
- valitud teeninduskoht, kui olemas;
- kontaktandmed;
- teenuse kategooria;
- sihtrühm;
- võimalik pöördumise kanal;
- suunamise tingimused.

Midagi ei saadeta automaatselt.

Kasutaja peab enne saatmist nägema:

- kellele pöördumine läheb;
- millist infot jagatakse;
- kas tegemist on platvormisisese pöördumisega või e-kirja mustandiga;
- kas teenus võib vajada KOV, SKA või muu asutuse hindamist/otsust/suunamist.

## 13. Eelpöördumise küsimustiku seos Teenusekaardiga

Eelpöördumise küsimustik annab kontaktisoovituse jaoks konteksti.

Küsimustik aitab tuvastada:

- kelle kohta pöördumine käib;
- piirkond või KOV;
- kiireloomulisus;
- nõusolek või pöördumise alus;
- eluvaldkonnad;
- sihtrühmad;
- vajadused ja olukorrad;
- olemasolev abi;
- inimese enda soov.

Seda infot kasutatakse Teenusekaardi andmetest sobiva KOV kontakti või teenuseosutaja leidmiseks.

Oluline: eelpöördumise küsimustik ei otsusta teenust. See annab ainult kontaktisoovituse ja mustandi koostamise sisendi.

## 14. KOV, teenuseosutaja ja spetsialisti suunamine

Teenusekaart peab suutma eristada pöördumise suunda.

### KOV sotsiaalhoolekanne

Sobib, kui teema puudutab:

- täisealise inimese toimetulekut;
- koduteenust;
- hooldusvajadust;
- üldhooldust;
- toetusi;
- eluaset;
- hoolduskoormust;
- sotsiaaltransporti;
- ametlikku abivajaduse väljaselgitamist.

### KOV lastekaitse

Sobib, kui teema puudutab:

- last;
- pere olukorda;
- lapse heaolu;
- lapse turvalisust;
- lapse erivajadust;
- kooli või lasteaia muret;
- vanemluse raskusi.

### Teenuseosutaja

Sobib, kui inimene tahab:

- küsida teenuse kohta lisainfot;
- uurida, kas teenus sobib;
- teada saada tingimusi, hinda, järjekorda või vastuvõttu;
- pöörduda konkreetse teenuseosutaja poole.

Teenuseosutaja puhul peab süsteem olema ettevaatlik. Ära ütle, et inimene saab kindlasti teenuse. Kasuta sõnastust:

- võib olla asjakohane kontakt;
- võib olla mõistlik küsida lisainfot;
- teenusele pääsemine võib vajada KOV/SKA/spetsialisti otsust või suunamist;
- tingimused vajavad täpsustamist.

## 15. Teenusekaardi seos AI/RAG teadmuskihiga

Avaldatud teenuseprofiilid ja teenused peaksid muutuma assistendile leitavaks.

Assistendi jaoks peaks olema võimalik kasutada metadata't:

- `source_type: service_provider_profile`
- `providerProfileId`
- `serviceId`
- `serviceMapEntryId`
- `organizationName`
- `serviceName`
- `serviceCategories`
- `targetGroups`
- `ageGroups`
- `needTags`
- `lifeDomains`
- `municipalityIds`
- `county`
- `serviceAreaMunicipalityIds`
- `deliveryModes`
- `acceptsPreInquiries`
- `referralRequirements`
- `source_status`

Oluline:

- mustandeid, peidetud profiile ja ülevaatusel olevaid teenuseid ei tohi assistent aktiivselt soovitada;
- kui teenus peidetakse või profiil muutub, peab teadmuskirje uuenema või muutuma mitteaktiivseks;
- assistendi vastuses peab olema selge, kui info pärineb teenuseosutaja enda profiilist.

## 16. Praegune arendusjärjekord

Ära ehita korraga kogu platvormi ümber.

### Etapp 1: Teenusekaardi andmeloogika ülevaatus

Kontrolli:

- `ServiceMapEntry` mudelit;
- KOV kontaktide impordi ja avaldamise loogikat;
- teenuseosutaja profiilist `ServiceMapEntry` loomise loogikat;
- geokoodi staatuseid;
- kaardil kuvamise tingimusi;
- praegust popupi;
- eelpöördumise `recipientEntryId` seost;
- kas kaardikirje saab siduda konkreetse teenuse ja teeninduskohaga.

### Etapp 2: Teenusekaardi UI parandamine

Paranda:

- otsing;
- filtrid;
- markerite popup;
- nimekirjavaade;
- KOV kontaktide ja teenuseosutajate eristus;
- "Koosta eelpöördumine" CTA;
- "Vaata profiili" CTA;
- kaardita teenuste leitavus nimekirjas.

### Etapp 3: Teenuseprofiili v2 ettevalmistus

Teenusekaart vajab hiljem paremat Teenuseprofiili andmestikku.

Ära tee seda korraga lõpuni, aga planeeri seosed nii, et hiljem oleks võimalik:

- eraldi teenused;
- eraldi teeninduskohad;
- teenuse ja teeninduskoha many-to-many seos;
- teenusepõhine kontakt;
- teenusepõhine keel;
- teenusepõhine eelpöördumise seade.

### Etapp 4: Eelpöördumise seose tugevdamine

Teenusekaardilt alustatud eelpöördumine peab kandma kaasa:

- valitud kontakti;
- valitud teenuse;
- valitud teeninduskoha;
- sobiva pöördumise kanali;
- suunamise tingimused.

### Etapp 5: Vastuvõtt ja Ruumid

Kui pöördumine liigub platvormisiseselt, peab vastuvõtja seda nägema Pöördumiste vastuvõtus.

Vastuvõtja saab:

- pöördumise vastu võtta;
- küsida täpsustust;
- märkida järgmise sammu;
- vajadusel avada Ruum.

## 17. Mitte teha praegu

Ära tee praegu:

- töölaudade kaartide ümberpaigutamist;
- Teekonna jagamise süvaehitust;
- uut vestlusruumi detaillehte;
- kovisiooni süvaehitust;
- dokumendi koostamise suurt ümbertegemist;
- automaatset töövoo käivitamist vestluses;
- teenusekaardist teenuse "taotlemise" süsteemi.

Teenusekaart peab praegu saama heaks leidmise, filtreerimise ja eelpöördumisele suunamise kihiks.

## 18. Acceptance criteria

Töö on õnnestunud, kui:

1. Teenusekaart kuvab eraldi KOV kontakte ja teenuseosutajaid.
2. KOV sotsiaalhoolekande ja lastekaitse kontaktid on eristatavad.
3. Teenuseosutaja marker tekib teeninduskoha aadressi põhjal.
4. Markeril kuvatakse selgelt seotud teenused.
5. Kaardil ja nimekirjas saab otsida teenuse, kategooria, sihtrühma, vajaduse ja piirkonna järgi.
6. Teenusekaardil on CTA "Koosta eelpöördumine".
7. Eelpöördumine saab kaasa valitud kontakti või teenuse konteksti.
8. Teenus, millel puudub füüsiline aadress, saab olla leitav nimekirjas.
9. Teenusekaart ei kuva mustandeid ega avaldamata teenuseid.
10. Teenusekaart ei riku olemasolevat KOV kontaktide kuvamist.
11. Eelpöördumise olemasolev töövoog ei lähe katki.
12. Kasutajale jääb alati kontroll: midagi ei saadeta automaatselt.
13. UI jääb SotsiaalAI praeguse visuaalse stiiliga kooskõlla.
14. Arendus loob aluse Teenuseprofiil v2 hilisemaks sidumiseks.

