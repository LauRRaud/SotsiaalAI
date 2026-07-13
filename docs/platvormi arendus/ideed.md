# SotsiaalAI ideed ja võimalikud arendussuunad

> **Uus platvormiülene lähtekoht alates 11.07.2026:** SotsiaalAI-d käsitletakse ruumilise abi-, töö- ja koostöökeskkonnana, mitte tavapärase veebilehtede kogumina. Ruum, lõuendid, objektid, nende paigutus ja kasutaja liikumine moodustavad kasutajaliidese. Täpsem alus on dokumendis [SotsiaalAI ruumilise kogemuse lähtekoht](./ruumilise-kogemuse-lahtekoht.md). Käesoleva faili varasemad „lehed”, „töölauad” ja „vaated” tuleb edaspidi tõlgendada sisuliste võimekustena, mille ruumiline teostus vajab eraldi ümbermõtestamist.

> **Fable 5 ülevaatuse lähteülesanne:** [Fable 5 platvormiloogika ja funktsioonide seoste brief](./fable-5-platvormi-loogika-brief.md). Fable peab kontrollima esmalt aktiivset koodi; vanad auditifailid ei ole platvormi praeguse seisu tõend.

> **Fable 5 jätkuküsimused:** organisatsiooni- ja meeskonnakihi ning esimese päris piloodi analüüs on talletatud dokumendis [Fable 5 lisavastused: organisatsioonikiht ja esimene piloot](./fable-5-lisavastused-organisatsioon-ja-piloot.md). Need on soovitused, mitte veel kinnitatud tooteotsused.

> **Sõnum ja tulevikuvisioon:** SotsiaalAI vajalikkuse hinnang, slogani „Abi algab selgusest” ettepanek, alternatiivsed sõnumid ja tulevikuvisiooni lõik on talletatud dokumendis [SotsiaalAI sõnum, slogan ja tulevikuvisioon](./sotsiaalai-sonum-slogan-ja-tulevikuvisioon.md).

> **Platvormiülene usaldusmudel:** valdusriba, „Minu jagamised”, jagamiste elutsükkel, AI väljundite päritolu ning avalike turvalisusväidete piirid on koondatud dokumenti [Fable 5: SotsiaalAI platvormiülene usaldusmudel](./fable-5-usaldusmudel.md).

> **Lokaalne interaktiivsus:** kaamera, eestikeelse hääle, OCR-i ja väikeste seadmes töötavate mudelite eraldi lähtekoht on dokumendis [SotsiaalAI lokaalsed mudelid ja multimodaalne interaktiivsus](./lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md).

## 1. Dokumendi eesmärk ja staatus

See dokument koondab arutelu SotsiaalAI olemasolevate võimekuste, nende kontrollimise ning võimalike uute arendussuundade kohta. Siin kirjeldatud uued töölauad, andmemudelid ja töövood on esialgu ideed, mitte automaatselt valmis funktsionaalsus ega kinnitatud arendusülesanne.

Dokumendil on neli eesmärki:

1. säilitada terviklik ülevaade arutatud ideedest;
2. eristada olemasolevaid funktsioone tulevikuvisioonist;
3. näidata, kuidas uued ideed võiksid olemasolevate SotsiaalAI osadega ühenduda;
4. anda alus hilisemaks toote-, privaatsus-, arhitektuuri- ja arendusotsuseks.

Kõik tervise, lastekaitse, vägivalla, riskihindamise, kliendiandmete ja ametliku juhtumimenetlusega seotud ideed vajavad enne tootearendust eraldi sisulist, õiguslikku, andmekaitselist ja turbeanalüüsi.

---

## 2. SotsiaalAI olemasoleva toote tervikpilt

### 2.1. Vestlusaken

Vestlusaken on keskne koht, kus kasutaja saab:

- kirjeldada olukorda oma sõnadega;
- küsida teenuste, toetuste, õiguste või tööpraktika kohta;
- täpsustada võimalikke lahendusi;
- saada võimaluste, seoste ja järgmiste sammude selgitusi;
- valmistada ette tekste;
- näha vastuse aluseks olevaid allikaid;
- kirjeldada olukorda häälega;
- alustada töövooge, näiteks abisoovi, abipakkumist, süvauuringut või dokumendi analüüsi.

### 2.2. SotsiaalAI teadmusbaas

Teadmusbaasi mõte on koondada kontrollitud sotsiaalvaldkonna allikaid:

- õigusaktid;
- juhendid;
- metoodikad;
- kohalike omavalitsuste info;
- kontaktid;
- vormid;
- spetsialistide esitatud ja üle vaadatud materjalid.

Oluline tootelubadus on, et vastused ei pärine suvalistest allikatest, allikate kehtivust kontrollitakse ning kasutaja näeb, millele vastus toetub.

### 2.3. Teekond

Teekond hoiab koos:

- senise olukorra kokkuvõtte;
- seotud teemad;
- puuduva info;
- järgmised sammud;
- kasutaja kinnitatud eesmärgid ja valikud.

Teekond on kasutaja privaatne objekt. Kasutaja otsustab, kas ja milliseid osi ta edasi jagab. Teekonna täissisu, privaatne vestlus ja isiklikud märkmed ei tohiks liikuda spetsialistile automaatselt.

### 2.4. Kontroll ja turvalisus

SotsiaalAI turvalisuse põhielemendid on:

- privaatsuse eelkiht, mis märkab enne saatmist üleliigseid isikuandmeid;
- kasutaja kinnitus enne jagamist või saatmist;
- kiireloomuliste olukordade kontaktide kuvamine, näiteks 112, Lasteabi ja Ohvriabi;
- selge vahe AI mustandi ja inimese kinnitatud teksti vahel;
- audit ja nähtavuspiirid.

### 2.5. Töölaud

Töölaud on rollipõhine tegutsemiskoht:

- pöörduja alustab Teekonda või eelpöördumist;
- spetsialist võtab pöördumisi vastu, kasutab Kovisiooni ja haldab materjale;
- teenuseosutaja haldab teenuseprofiili ning pöördumisi;
- ühised valdkonnad on abisoovid, abipakkumised ja dokumenditöö;
- kiirtoimingutest saab alustada vestlust, avada faile ja vaadata olulisi teavitusi.

### 2.6. Pöördumised ja eelpöördumine

Eelpöördumist saab alustada:

- vestlusest, kus kokkuvõte on juba olemas;
- vormi abil;
- tühjalt lehelt.

Kokkuvõte ja mustand valmivad koos kasutajaga. Pöördumine saadetakse alles pärast kasutaja ülevaatust ja kinnitust. Vastuvõtja näeb saadetud eelinfot oma Töölaual ning vajaduse korral saab avada ühise vestlusruumi.

### 2.7. Abisoovid ja abipakkumised

Kasutaja saab kirjeldada, millist tuge ta vajab, või pakkuda abi. Platvorm aitab sobivaid osapooli kokku viia. Sobituse korral saab avada ühise vestlusruumi. Avaldatud abisoovid ja abipakkumised võivad olla nähtavad Teenusekaardil.

### 2.8. Vestlusruumid

Vestlusruum võimaldab lahendada küsimust koos teiste osapooltega. Ruumi saab kutsuda:

- pöörduja;
- sotsiaaltöö spetsialisti;
- teenuseosutaja;
- kolleegi.

Ruumis võib olla helikõne. Kõne toimub osapoolte nõusolekul ning tootelubaduse järgi seda ei salvestata.

### 2.9. Dokumendi koostamine ja dokumendid

Dokumendi koostamise töövoos saab kasutaja kirjeldada vajaliku taotluse, avalduse või muu dokumendi sisu. AI koostab mustandi, mille kasutaja enne kasutamist üle vaatab.

Dokumentide vaates saab:

- hoida isiklikke faile;
- faili üles laadida;
- faili sisu analüüsida;
- koostada järgmisi samme;
- teha helifailist transkripti;
- vaadata transkript enne kasutamist üle.

### 2.10. Kovisioon

Kovisioon toetab spetsialiste juhtumite kolleegidevahelisel mõtestamisel. Ühine juhtumilõuend aitab hoida koos:

- juhtumi keskse küsimuse;
- olulised asjaolud;
- eri vaatenurgad;
- pimekohad;
- kasutatud meetodid;
- järeldused;
- võimalikud järgmised sammud.

### 2.11. Tööheaolu

Tööheaolu käsitleb spetsialisti heaolu osana sotsiaaltöö kvaliteedist ja kestlikkusest. Funktsioonid võivad hõlmata:

- kiirkontrolli;
- isiklikku ülevaadet;
- raske juhtumi tuge;
- töövägivalla tuge;
- taastumist;
- töö- ja rollipiire;
- alustaja tuge;
- tööprotsesside ja koormuse refleksiooni.

### 2.12. Materjalid

Spetsialist saab esitada juhendeid, metoodikaid ja praktilisi materjale. Materjal peaks jõudma teadmusbaasi alles pärast sisulist või administratiivset ülevaatust.

### 2.13. Teenusekaart ja teenuseprofiil

Teenusekaart koondab kaardivaates:

- kohalike omavalitsuste sotsiaalhoolekande kontaktid;
- teenuseosutajad;
- teenused;
- avaldatud abisoovid;
- avaldatud abipakkumised.

Teenuseosutaja saab hallata teenuseprofiili, et tema teenused oleksid leitavad.

---

## 3. Olemasolevate funktsioonide kontrollimise ideed

### 3.1. Funktsionaalse tõe audit

SotsiaalAI funktsioonide kirjeldus sisaldab tugevaid kasutajalubadusi. Neid tuleks aktiivse koodi, kasutajaliidese ja testide vastu eraldi kontrollida.

Kontrollitavad lubadused on näiteks:

- iga AI vastuse juures kuvatakse sobivad allikad;
- teadmusbaasi allikaid hoitakse ajakohasena;
- Teekond on privaatne;
- midagi ei liigu edasi ilma kasutaja kinnituseta;
- privaatsuse eelkiht märkab üleliigseid isikuandmeid;
- kiireloomulises olukorras kuvatakse õiged kontaktid;
- kõne toimub nõusolekul ja seda ei salvestata;
- spetsialisti materjal jõuab teadmusbaasi alles pärast ülevaatust;
- dokument või transkript vaadatakse enne kasutamist üle;
- rollid näevad ainult neile lubatud funktsioone ja andmeid;
- kustutamisel eemaldatakse ka seotud failid, RAG-i sisu, artifact'id ja ootel töötlused.

Võimalikud auditihinnangud:

- `VERIFIED`;
- `PARTIALLY_VERIFIED`;
- `IMPLEMENTED_NOT_REACHABLE`;
- `UI_ONLY`;
- `BACKEND_ONLY`;
- `DOCUMENTATION_OVERCLAIM`;
- `NOT_FOUND`;
- `NEEDS_RUNTIME_VERIFICATION`.

### 3.2. Läbivate kasutajateekondade audit

Kõige suuremad riskid võivad tekkida funktsioonide ühenduskohtades.

#### Abivajaja teekond

```text
Vestlus
→ Teekonna mustand
→ kasutaja kinnitus
→ salvestatud Teekond
→ eelpöördumise mustand
→ kasutaja kinnitus
→ vastuvõtja Töölaud
→ ühine vestlusruum
```

#### Dokumendi teekond

```text
Vestlus
→ dokumendi mustand
→ kasutaja ülevaatus
→ fail
→ analüüs
→ artifact
→ allalaadimine või jagamine
```

#### Teadmuse lisamise teekond

```text
Spetsialisti materjal
→ üleslaadimine
→ ülevaatus
→ kinnitamine
→ ingest
→ chunk'id
→ retrieval
→ kasutajale kuvatud vastus ja allikas
```

Igas teekonnas tuleb kontrollida info päritolu, kinnitamist, kopeerimist, nähtavust, muutmist, tagasivõtmist ja kustutamist.

### 3.3. Kasutajatüüpide, lisatiitlite ja ligipääsude kontroll

Platvormi praegused kolm põhikasutajatüüpi on:

- eluküsimusega pöörduja;
- sotsiaaltöö spetsialist;
- teenuseosutaja.

Superviisor, ESTA liige, ESTA piirkonna moderaator, KOV osakonna juht ja muud professionaalsed nimetused ei pea olema eraldi kasutajagrupid. Need võivad olla olemasolevale kasutajale lisatavad kontrollitud tiitlid, liikmesused, organisatsiooniseosed ja võimekused. Lisatiitel võib avada mõne uue tööriista või vaate samal Töölaual, kuid ei loo vaikimisi uut kontot ega täiesti eraldi põhiteekonda.

Administraator ja teadmusbaasi ülevaataja on süsteemi haldusõigused, mitte samaväärsed avalikud kasutajapersoonad. Hiljem võib vaja minna esindaja, eestkostja või piiratud ligipääsuga võrgustikuliikme seost, kuid enne uue kasutajatüübi loomist tuleb kontrollida, kas piisab olemasoleva konto ja konkreetse juhtumi vahelisest piiratud õigusega suhtest.

Vajalik on õiguste maatriks, mis eristab:

- põhikasutajatüüpi;
- kontrollitud tiitlit või liikmesust;
- organisatsiooniseost;
- konkreetset serveripoolset võimekust;
- konkreetse ruumi või tööobjekti liikmesust;
- haldusõigust.

Kontrollküsimused:

- kas admin näeb sisu või ainult metainfot;
- kas rolli eelvaade mõjutab ainult UI-d või ka serveriõigusi;
- kas spetsialist näeb eelpöördumise kaudu liiga palju privaatset infot;
- kas vestlusruumi liikmelisus annab ligipääsu päritoluobjektile;
- kas organisatsiooni liikmelisus annab ligipääsu teiste töötajate juhtumitele;
- kas rolli muutmisel või suhte sulgemisel aeguvad vanad õigused ja sessioonid.

### 3.4. RAG-i ja allikate kvaliteediaudit

Kontrollida tuleks:

- aegunud või vastuolulisi allikaid;
- KOV-i ja riiklike teenuste segiajamist;
- olukordi, kus allikas toetab ainult osa vastusest;
- liiga kindlat vastust ebapiisava info korral;
- kontakti, vormi või teenuse kehtivust;
- allikaviite tegelikku vastavust kuvatud väitele;
- vajadust tunnistada ebakindlust või suunata professionaalse abi juurde.

### 3.5. Privaatsuse ja turbe punase meeskonna audit

Fookus võiks olla:

- võõra objekti ID abil andmetele ligipääsemine;
- rolli või organisatsiooni piiri ületamine;
- privaatse vestluse sattumine jagatud kokkuvõttesse;
- dokumentide ja allalaadimiste autoriseerimine;
- kustutatud kasutaja andmete jäägid;
- tundliku info sattumine logidesse või veateadetesse;
- eelpöördumise vale isiku, KOV-i või töötajaga ühendamine;
- võrgustikuliikmele liiga laia ligipääsu andmine.

### 3.6. Muud võimalikud auditid

- usage/admin ja pakettide arvestuse race condition'id, idempotentsus ning migratsioonid;
- production-andmebaasi migratsiooniproov ja taasteplaan;
- plaanide ning aktiivse koodi `spec-to-code` võrdlus;
- koodibaasi lihtsustamise ja dubleerimise kaart;
- Kovisiooni metoodika ning tegeliku töövoo võrdlus;
- kasutajakogemuse pre-mortem;
- testide tegeliku veaavastusvõime audit.

---

## 4. Uus suund: Juhtumitöö assistent STAR2 kõrval

### 4.1. STAR2-st tulenev arhitektuuripööre

STAR2 sisaldab juba ametliku juhtumikorralduse põhituuma: pöördumisi, abivajaduse hindamist, eluvaldkondi, eesmärke, tegevusi, vastutajaid, tähtaegu, staatuseid, teenuseid ja juhtumiplaani täitmise jälgimist. Seetõttu ei tohiks SotsiaalAI luua STAR2 kõrvale teist ametlikku kliendiregistrit või juhtumiplaani.

Rollijaotus:

```text
STAR2
= ametlik menetlus, abivajaduse hindamine, juhtumiplaan,
  teenused, toetused, otsused ja riiklik andmekogu

SotsiaalAI Juhtumitöö assistent
= eelpöördumise ja kohtumise ettevalmistus, puuduva info märkamine,
  mustandite struktureerimine, STAR2 sisestuse ettevalmistus,
  professionaalne refleksioon ja piiratud koostöö
```

### 4.2. Juhtumitöö assistendi eesmärk

Juhtumitöö assistent aitab töötajal korraldada enda jooksvat professionaalset tööd ilma STAR2 ametlikku toimikut dubleerimata. See vastab küsimustele:

- millele järgmisel kohtumisel keskenduda;
- milline info on puudu või kontrollimata;
- milliseid küsimusi kliendile esitada;
- kuidas sõnastada kliendiga eesmärki;
- milline osa vajab dokumenti või registripäringut;
- mida tuleb STAR2-sse dokumenteerida;
- millist meetodit kasutati ja kuidas see töötas;
- kas vaja on Kovisiooni, Supervisiooni või võrgustikutööd.

### 4.3. Juhtumitöö assistendi töölaud

```text
Juhtumitöö assistent
├── saabunud eelpöördumised
├── tänased vastuvõtud
├── aktiivsed ettevalmistustööd
├── STAR2-sse kandmist ootavad mustandid
├── puuduv ja kontrollimist vajav info
├── järgmised kontaktid
├── võrgustikutöö ettevalmistus
├── Meetodipeegel
├── Kovisiooni või Supervisiooni ettevalmistus
└── STAR2 ülekandmise ajalugu
```

### 4.4. Ühe tööprotsessi assistendivaade

#### Praegune fookus

- miks inimene pöördus;
- mida inimene ise soovib;
- mis vajab praegu lahendamist;
- milline on järgmine kontakt;
- mis info on puudu;
- milline mustand ootab STAR2-sse kandmist.

#### Info päritolu

Iga oluline infokild peab olema märgistatud:

- kliendi öeldud;
- kliendi kinnitatud;
- dokumendist;
- teise spetsialisti info;
- töötaja tähelepanek;
- töötaja tõlgendus;
- AI koostatud mustand;
- STAR2-s kontrollitud või ametlikult registreeritud.

#### Kohtumise ettevalmistus

- kohtumise eesmärk;
- täpsustavad küsimused;
- puuduva info loend;
- kliendiga kontrollitavad väited;
- vajalikud dokumendid;
- käsitletavad eluvaldkonnad;
- päevakord;
- lihtsas keeles selgitused kliendile.

#### Kohtumise märkmed

```text
Kliendi enda vaade
Faktilised asjaolud
Töötaja tähelepanek
Kontrollimata info
Kokkulepped
Järgmised sammud
STAR2-sse kantav info
Privaatne professionaalne refleksioon
```

Privaatne professionaalne refleksioon ei lähe STAR2-sse.

### 4.5. STAR2-sse kandmise järjekord

```text
STAR2-sse kandmist ootab

[ ] Pöördumise kokkuvõte
[ ] Abivajaduse hindamise mustand
[ ] Eluvaldkonna kirjeldus
[ ] Eesmärgi sõnastus
[ ] Tegevus
[ ] Vastutaja ja tähtaeg
[ ] Kohtumise märge
[ ] Teenuse suunamise alus
```

Iga elemendi seis võib olla:

- mustand;
- vajab kliendiga kontrollimist;
- vajab dokumenti või registripäringut;
- töötaja kontrollitud;
- valmis STAR2-sse kandmiseks;
- STAR2-sse kantud;
- ei kanta STAR2-sse.

Esimeses versioonis on sobiv tegevus `Kopeeri STAR2 jaoks`, mitte `Saada STAR2-sse`. Ametlik saatmine saab tulla ainult SKA ja TEHIK-uga kokku lepitud liidestuse kaudu.

### 4.6. STAR2 struktuurile vastav mustand

```text
Eluvaldkond
...

Hinnatud vajaduse mustand
...

Võimalik eesmärgi sõnastus
...

Võimalik tegevus
...

Algus ja tähtaeg
...

Vastutaja
...

Info päritolu
Kliendi kinnitus / töötaja hinnang / dokument
```

Töötaja kontrollib iga välja ning otsustab, milline info on ametlikuks kasutamiseks sobiv.

### 4.7. Paralleelse andmebaasi vältimine

Juhtumitöö assistent säilitab eelkõige:

- eelpöördumise algmaterjali;
- töösolevad mustandid;
- puuduva info loendi;
- kohtumise ettevalmistuse;
- STAR2 viitenumbri;
- ülekandmise staatuse;
- professionaalse refleksiooni;
- Kovisiooni ja Supervisiooni üldistatud sisendid.

Pärast STAR2-sse kandmist ei hoita SotsiaalAI-s teist aktiivset ametliku juhtumiplaani koopiat. Ülekantud mustand võib muutuda kirjutuskaitstuks, arhiveeruda või kustuda vastavalt kinnitatud säilitusreeglile.

### 4.8. Tulevane ametlik liidestus

```text
SotsiaalAI mustand
→ töötaja näeb ekspordi eelvaadet
→ töötaja kinnitab iga välja
→ ametlik API saadab andmed STAR2-sse
→ STAR2 tagastab viite ja staatuse
→ SotsiaalAI märgib mustandi ülekantuks
```

STAR2 jääb ka liidestuse korral ametlikuks andmeallikaks.

### 4.9. Ametlikud lähtekohad

- [Sotsiaalkindlustusameti STAR-i ülevaade](https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/star) kirjeldab pöördumiste, hindamise, juhtumiplaani, teenuste, tegevuste, dokumentide ja registripäringute ametlikku töövoogu.
- [STAR-i juhtumikorralduse uus tööriist](https://sotsiaalkindlustusamet.ee/uudised/juhtumikorralduse-rakendamiseks-star-uus-tooriist) seob hinnatud vajadused eesmärkide, tegevuste ja vastutajatega.
- [STAR-i strateegia 2026–2030](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-03/Lisa%201_Sotsiaalteenuste%20ja%20-toetuste%20andmeregistri%20strateegia%20aastateks%202026-2030.pdf) näeb STAR-i ametliku tervikliku menetlusplatvormina ning toob riskina välja paralleelsed süsteemid ja liidestuste puudumise.

---

## 5. Võrgustikutöö Juhtumitöö assistendi kõrval

### 5.1. Eesmärk

Võrgustikutöö on Juhtumitöö assistendiga seotud, kuid eraldi nähtavusega koostöökiht. See ei ole STAR2 juhtumiplaani koopia ega anna osalejatele ligipääsu töötaja privaatsele assistendivaatele.

Töölaud võiks sisaldada:

- võrgustiku eesmärki;
- osalejate kaarti;
- rolle ja kontaktkanaleid;
- nõusolekuid ja nähtavuspiire;
- kohtumiste ajakava;
- päevakorda;
- arutelutulemusi;
- kokkuleppeid;
- tegevusi, vastutajaid ja tähtaegu;
- ühist vestlusruumi;
- valitud dokumente;
- järgmist kohtumist või kontrollpunkti.

### 5.2. Info kolm taset

1. **Privaatne juhtumiinfo** – nähtav ainult volitatud juhtumitöötajatele.
2. **Võrgustikuga jagatud kokkuvõte** – nähtav ainult konkreetsele võrgustikule.
3. **Osalejaga seotud ülesanne** – nähtav osalejale ja koordinaatorile.

Võrgustikku kutsumine ei anna automaatselt ligipääsu kogu juhtumile. Vestlusruumi liikmelisus ei anna ligipääsu Juhtumitöö assistendile, Meetodipeeglile, kliendi privaatsele Teekonnale ega STAR2 toimikule.

### 5.3. Esimene vertikaalne lõik

```text
Eelpöördumine või kohtumise tulemus
→ töötaja kaardistab vajaliku võrgustiku
→ klient näeb ja kinnitab jagatava info
→ töötaja leiab Teenusekaardilt võimaliku teenuseosutaja
→ valitud osapoolele saadetakse piiratud kutse
→ avaneb kirjalik või häälpõhine Võrgustikutöö ruum
→ osaleja näeb ainult talle jagatud kokkuvõtet ja kokkulepet
→ töötaja kontrollib tulemuse
→ vajalik ametlik info dokumenteeritakse STAR2-s
```

### 5.4. Osapoolte ühendamine

Juhtumitöö assistent võib aidata:

1. kaardistada olemasolevat võrgustikku;
2. märgata puuduvat rolli või teenust;
3. otsida Teenusekaardilt teenuseosutajaid;
4. valmistada ette eelpöördumise või kontaktisoovi;
5. küsida kliendilt, mida võib jagada;
6. koostada piiratud jagatava kokkuvõtte;
7. kutsuda osapoole Võrgustikutöö ruumi;
8. korraldada kirjaliku või häälpõhise koostöö;
9. valmistada kokkulepped STAR2-sse dokumenteerimiseks.

### 5.5. Võrgustikukaart

```text
Kliendi võrgustik
├── klient
├── lähedased
├── vastutav sotsiaaltöötaja
├── teised KOV spetsialistid
├── teenuseosutajad
├── perearst või muu tervishoiukontakt
├── kool või lasteaed
├── Töötukassa
├── tugiorganisatsioonid
└── muud olulised inimesed
```

Iga osapoole juures võib olla roll, organisatsioon, kontakt, kaasamise eesmärk, jagamispiir, osalemise algus ja lõpp, viimane kontakt ning kokkulepitud tegevus.

### 5.6. Teenuseosutaja kaasamine

Teenuseosutaja võib näha ainult talle jagatud kontaktisoovi, kokkuvõtet, dokumenti, ülesannet või ruumiarutelu. Ta ei näe Meetodipeeglit, Tööheaolu, kliendi privaatset Teekonda, Juhtumitöö assistenti ega STAR2 toimikut.

### 5.7. Perearst ja tervishoiukontakt

SotsiaalAI ei vaja eraldi meditsiinimoodulit. Perearst või muu tervishoiutöötaja võib olla piiratud väline võrgustikuliige.

Esimeses MVP-s võib SotsiaalAI toetada:

- kontaktivajaduse märkimist;
- kliendi kinnitatud küsimuste ettevalmistamist;
- turvalise kontaktisoovi koostamist;
- võrgustikukohtumise kutset;
- piiratud häälruumis osalemist;
- töötaja enda tegevust `võta perearstiga ühendust`.

SotsiaalAI ei loe Terviseportaali, ei hoia ravilugu, ei kuva diagnoose, ei soovita ravi ega muutu perearsti dokumenteerimiskeskkonnaks. Tundlikuma terviseinfo jagamine eeldab eraldi õiguslikku, tehnilist ja partnerlusanalüüsi ning jääb esimesest MVP-st välja.

Terviseandmed on eriliiki isikuandmed ja vajavad tavalisest tugevamat kaitset. Lähtekoht: [Andmekaitse Inspektsiooni terviseandmete juhis](https://www.aki.ee/isikuandmed/kkk/tervishoid).

---

## 6. Professionaalse töö neli tasandit

Süsteemis tasub eristada vähemalt nelja tasandit.

### 6.1. Lähenemisviis

Lähenemisviis kirjeldab vaatenurka, mille kaudu töötaja klienti ja olukorda käsitleb.

Näited:

- isikukeskne;
- lapsekeskne;
- tugevustel põhinev;
- jõustav;
- traumateadlik;
- lahenduskeskne;
- süsteemne või ökoloogiline;
- taastumisele suunatud;
- õigustel põhinev;
- kultuuritundlik;
- kahjude vähendamisele suunatud.

### 6.2. Sotsiaaltöö meetod

Meetod kirjeldab, kuidas töötaja muutust toetab.

Näited:

- juhtumikorraldus;
- motiveeriv intervjueerimine;
- nõustamine;
- kriisisekkumine;
- pere- või võrgustikutöö;
- vahendamine;
- huvikaitse.

### 6.3. Konkreetne töövõte või tegevus

See on päriselt tehtud toiming, näiteks:

- vestlus;
- kodukülastus;
- vaatlus;
- võrgustikukohtumine;
- teenusele suunamine;
- telefonikõne;
- päring;
- tegevuskava koostamine;
- dokumentide läbivaatamine.

### 6.4. Töötaja professionaalne tugimeetod

See ei ole otsene klienditöö, vaid toetab töötaja professionaalset tegutsemist:

- Kovisioon;
- supervisioon;
- eetiline arutelu;
- juhtumiarutelu;
- kriitilise juhtumi järelanalüüs;
- meeskonna refleksioon.

---

## 7. Meetodite ja töövõtete kataloog

### A. Hindamise ja info kogumise meetodid

#### 1. Struktureeritud vestlus

Süstemaatiline info kogumine eri eluvaldkondade kohta. Kirjeldada võiks vestluse osalejaid, käsitletud teemasid, kliendi vaadet, vastuseta küsimusi ning keele-, suhtlus- või usaldustakistusi. Vestlus ei tohiks muutuda ülekuulamiseks.

#### 2. Vaatlus

Vaadeldakse käitumist, suhtlemist, emotsioone, liikumist, igapäevaoskusi, lapse ja vanema suhtlust või keskkonda. Süsteem peab eristama nähtud fakti töötaja tõlgendusest.

#### 3. Kodukülastus

Võimaldab hinnata elutingimusi, turvalisust, pereliikmete suhtlust, igapäevast toimetulekut ja räägitu vastavust tegelikule olukorrale.

#### 4. Dokumentide ja varasema ajaloo läbivaatamine

Hõlmab varasemaid menetlusi, teenuseosutajate hinnanguid, kooli tagasisidet, terviseinfot, tegevuskavasid, kohtulahendeid, pöördumisi ja teateid. Süsteem võiks aidata eristada uut, korduvat, vastuolulist, aegunud ja kontrollimist vajavat infot.

#### 5. Küsimustikud ja skaalad

Salvestada tuleks kasutatud hindamisvahend, kuupäev, tulemus, hindaja ning märge, kas tulemus on lõplik hinnang või üks infoallikas. Võimalikud valdkonnad on toetusvajadus, funktsioneerimine, riskid, lapse heaolu, vanemlik võimekus, vaimne tervis ja sõltuvusriskid.

#### 6. Ajajoone koostamine

Kaardistab olulised sündmused, kriisid, teenuste alguse ja lõpu, elukoha, kooli või töö muutused, suhete muutused ja sümptomite või käitumise arengu.

#### 7. Genogramm

Kaardistab pere struktuuri, põlvkonnad, lähedased ja konfliktsed suhted, lahkuminekud, surmad ning korduvad peremustrid.

#### 8. Ökokaart või võrgustikukaart

Kaardistab kliendi seosed pere, sõprade, kogukonna, kooli, töökoha, spetsialistide ja teenustega. Seos võib olla toetav, nõrk, pingeline, konfliktne, katkenud või puuduv.

#### 9. Kaitse- ja riskitegurite kaardistamine

Kirjeldatakse probleemi suurendavaid ja klienti kaitsvaid tegureid, nende muudetavust, püsivust, sagedust ning mõju. Tugevused ei tohiks jääda riskide varju.

### B. Otsese klienditöö meetodid

#### 10. Individuaalne sotsiaaltöö ehk juhtumitöö

Üks töötaja toetab kliendi konkreetse olukorra lahendamist nõustamise, eesmärkide, praktilise abi, toetuste, oskuste või teenustele suunamise kaudu.

#### 11. Nõustamine

Võimalikud alaliigid on informatiivne nõustamine, sotsiaalnõustamine, toetav vestlus, otsustamist toetav nõustamine ja kriisinõustamine.

#### 12. Motiveeriv intervjueerimine

Sobib ambivalentsuse, katkestamiste või muutuse suhtes kõhkluse korral. Refleksioonis saab käsitleda valmisolekut, muutuse kasu, takistusi, muutusejuttu ning võimalust, et näiline motivatsioonipuudus on hirm, ülekoormus või vähene usaldus.

#### 13. Lahenduskeskne töö

Keskendub soovitud tulevikule, eranditele, väikestele sammudele ja olemasolevatele ressurssidele. Töövõtted võivad olla imeküsimus, skaalaküsimused, erandite otsimine ja järgmise väikese sammu sõnastamine.

#### 14. Tugevustel põhinev ja jõustav töö

Kaardistab oskused, varasemad õnnestumised, toetavad suhted, hakkamasaamise viisid, väärtused ja ressursid. Eesmärk on suurendada kliendi otsustusõigust, osalust ja iseseisvust.

#### 15. Psühhoharidus

Arusaadava info andmine vaimse tervise, lapse arengu, trauma, sõltuvuse, vanemluse, konfliktide, teenuste, õiguste ja kohustuste kohta. See ei ole teraapia.

#### 16. Oskuste õpetamine ja juhendamine

Võib hõlmata eelarvet, pangateenuseid, ametiasutustega suhtlemist, päevakava, kodu korrashoidu, lapse eest hoolitsemist, tööotsingut, sotsiaalseid või digioskusi. Märkida võiks praeguse võimekuse, vajaliku toe taseme ja oskuse ülekandumise pärisellu.

#### 17. Kriisisekkumine

Kasutatakse äkilise, ebastabiilse või turvariskiga olukorra korral. Eesmärk on turvalisus, kaose vähendamine, vältimatu vajaduse lahendamine, tugivõrgustiku aktiveerimine ja lühiajaline plaan.

#### 18. Turvaplaani koostamine

Võib olla vajalik vägivalla, enesevigastamise, suitsiidiriski, lapse väärkohtlemise, agressiooni, kodust lahkumise või ärakasutamise ohu korral. Sisaldab ohumärke, tegevusi, turvalisi kohti, usaldusisikuid, kontakte ja abi kutsumise kokkulepet.

#### 19. Kahjude vähendamine

Eesmärk on vähendada riski, suurendada turvalisust, säilitada kontakt ja kasvatada valmisolekut ka siis, kui probleemkäitumist ei saa kohe lõpetada.

#### 20. Traumateadlik töö

Keskendub turvalisusele, valikuvabadusele, läbipaistvusele, koostööle, kontrollitunde taastamisele ja taastraumatiseerimise vältimisele.

### C. Pere, rühma ja võrgustiku meetodid

#### 21. Peretöö

Käsitleb pere rolle, suhteid, kommunikatsiooni, vastutust, piire, vanemlust ja igapäevast elukorraldust.

#### 22. Vanemlust toetav töö

Toetab lapse vajaduste märkamist, päevakava, eakohaseid piire, emotsionaalset kohalolekut, turvalisust, lapse arvamusega arvestamist ja iseseisvust.

#### 23. Vahendamine ehk mediatsiooniline töö

Toetab osapoolte kuulamist, konflikti sõnastamist, ühiste huvide leidmist ja kokkuleppeid. Seda ei kasutata samal viisil vägivalla või suure võimuerinevuse korral.

#### 24. Rühmatöö

Võib olla tugirühm, vanemlusgrupp, oskuste grupp, taastumisgrupp, kogemusnõustamise rühm või noortegrupp. Hinnata saab osalust, eesmärgi toetust ja turvalisust.

#### 25. Võrgustikutöö

Koordineerib lähedaste, spetsialistide, asutuste ja teenuste tegevust ning vajalikku infovahetust.

#### 26. Võrgustikukohtumine või juhtumikonverents

Kohtumisel lepitakse kokku ühine eesmärk, tegevused, vastutajad, tähtajad, infovahetus ja vahehindamine.

#### 27. Perevõrgustiku koosolek

Kaasab lahenduste loomisse pere, sugulased, olulised inimesed ja kogukonna, mitte ainult spetsialistid.

### D. Abi koordineerimise ja õiguste kaitse meetodid

#### 28. Juhtumikorraldus

Tervikprotsess, mis ühendab hindamise, planeerimise, teenused, võrgustiku, sekkumised, monitoorimise ja vahehindamise.

#### 29. Teenuste vahendamine ja suunamine

Hõlmab teenuse leidmist, kontaktide vahendamist, taotluse või saatekirja toetamist, teenusele jõudmise takistuste vähendamist ja info edastamist. Teenus, suunamine ja enne suunamist kasutatud meetod peavad olema eristatavad.

#### 30. Huvikaitse

Toetab kliendi õiguste mõistmist, vajaduste väljendamist, teenustele ligipääsu, ebaõiglase otsuse vaidlustamist ja asutustega suhtlemisel kuuldud olemist.

#### 31. Juhtumi monitoorimine ja vahehindamine

Kontrollitakse tegevuste toimumist, teenuste käivitumist, eesmärkide edenemist, abivajaduse muutust, uusi riske, kliendi arvamust ning vajadust tegevusplaani muuta.

### E. Keskkonna ja kogukonnaga töötamise meetodid

#### 32. Välitöö ehk outreach

Kontakti loomine inimese loomulikus keskkonnas, näiteks kodus, tänaval, varjupaigas, koolis või kogukonnas. Sobib inimestele, kes ei jõua ise teenustele, ei usalda süsteemi või katkestavad kontakte.

#### 33. Kogukonnatöö

Keskendub kogukonna ressurssidele, tugivõrgustikele, kohalike probleemide kaardistamisele, kaasamisele, ennetusele ja vabatahtlike või kogemusnõustajate kaasamisele.

### F. Professionaalset tööd toetavad meetodid

#### 34. Kovisioon

Kolleegide toel juhtumi mõtestamine, pimekohtade märkamine, kasutatud meetodite hindamine, rollide ja piiride arutamine ning järgmiste sammude leidmine.

#### 35. Supervisioon

Võimaldab käsitleda töötaja ja kliendi suhet, emotsionaalseid reaktsioone, korduvaid töömustreid, professionaalset identiteeti, läbipõlemise riski ja organisatsiooni mõju.

#### 36. Eetiline juhtumiarutelu

Sobib konflikti korral kliendi enesemääramise ja turvalisuse, lapse arvamuse ja parima huvi, konfidentsiaalsuse ja info jagamise, kliendi soovi ja ametikohustuse või nappide ressursside ja suure vajaduse vahel.

---

## 8. Uus suund: Meetodipeegel ehk professionaalse refleksiooni kiht

### 8.1. Põhiidee

SotsiaalAI võiks aidata mõtestada mitte ainult kliendi olukorda, vaid ka töötaja professionaalset valikut:

- millise lähenemisviisi töötaja valis;
- millist meetodit ta kasutas;
- miks ta selle valis;
- milline konkreetne tegevus toimus;
- kuidas klient reageeris;
- mis töötas või ei töötanud;
- kas meetod vastas kliendi vajadusele;
- kas vaja on teistsugust lähenemist;
- kas vaja on Kovisiooni, supervisiooni või eetilist arutelu.

Võimalikud nimetused:

- Meetodipeegel;
- Praktikapeegel;
- Sekkumise refleksioon;
- Tööviisi kaart.

### 8.2. Professionaalse refleksiooni kirje

Minimaalne kirje võiks sisaldada:

- seotud juhtumit;
- lähenemisviisi;
- meetodit;
- tegevust;
- valiku põhjust;
- kliendi eesmärki;
- kliendi vaadet või reaktsiooni;
- töötaja tähelepanekut;
- töötaja tõlgendust;
- mis töötas;
- mis ei töötanud;
- järgmist sammu;
- vajadust professionaalse toe järele;
- nähtavust;
- kasutatud metoodika allikat.

### 8.3. Faktide ja tõlgenduste eristus

Süsteem peab hoidma eraldi:

- töötaja vaadeldud fakti;
- kliendi öeldut;
- teise spetsialisti hinnangut;
- töötaja tõlgendust;
- AI pakutud hüpoteesi;
- inimese kinnitatud järeldust.

AI hüpotees ei tohi muutuda automaatselt ametlikuks juhtumimärkeks.

### 8.4. Meetodi valimise assistent

AI võib pakkuda kaalumiseks:

- võimalikke meetodeid;
- sobivuse põhjuseid;
- olukordi, kus meetod ei pruugi sobida;
- puuduvaid andmeid;
- riske;
- alternatiive;
- refleksiooniküsimusi.

AI ei määra õiget meetodit ega asenda professionaalset otsust.

### 8.5. Sekkumispäevik ja vahehindamine

Ajajoone sündmus võiks sisaldada eesmärki, meetodit, tegevust, fakte, kliendi vaadet, töötaja tõlgendust, kokkulepet ja vahehindamise aega.

Vahehindamise võimalikud tulemused:

- jätkata;
- jätkata kohandatult;
- vajab rohkem aega;
- mõju ei ole veel hinnatav;
- klient ei soovi jätkata;
- väline takistus;
- valida teine lähenemine;
- vajab Kovisiooni;
- vajab supervisiooni;
- vajab eetilist arutelu.

### 8.6. Kliendi tagasiside

Kliendilt võiks küsida:

- kas ta tundis end kuulatuna;
- kas eesmärk oli arusaadav;
- kas ta nõustus järgmise sammuga;
- mida ta pidas kasulikuks;
- mida ta soovib muuta;
- kas ta soovib lisada oma sõnastuses kommentaari.

Töötaja kirjeldatud kliendi reaktsioon ja kliendi enda tagasiside peavad olema eristatavad.

### 8.7. Kovisiooni ettevalmistus

Juhtumist saaks koostada privaatsust arvestava Kovisiooni mustandi:

- keskne küsimus;
- kasutatud lähenemine ja meetod;
- valiku põhjus;
- seni proovitu;
- kliendi reaktsioon;
- töötaja kahtlus või pimekoht;
- eetiline vastuolu;
- kolleegidelt oodatav abi.

Mustand tuleb enne Kovisiooni viimist deidentifitseerida ja töötajal kinnitada.

### 8.8. Praktika arenguvaade

Töötaja võiks näha enda kasutatud meetodeid, korduvaid küsimusi, toe vajadusi ja soovitatavaid õppimisteemasid. Seda ei tohi kasutada lihtsustatud töötajate edetabeli või tulemuslikkuse hindamisena.

---

## 9. Visuaalsed professionaalsed tööriistad

### 9.1. Genogramm

Interaktiivne pere struktuuri ja põlvkondadevaheliste suhete kaart.

### 9.2. Ökokaart

Kliendi seoste kaart pere, lähedaste, kooli, töö, kogukonna, teenuste ja spetsialistidega. Seosele saab määrata tüübi, tugevuse ja suuna.

### 9.3. Professionaalne võrgustikukaart

Näitab:

- kes juhtumiga töötab;
- milline on osaleja roll;
- mida temaga võib jagada;
- milline tegevus on tema vastutada;
- millal toimus viimane kontakt.

Ökokaart kirjeldab kliendi elukeskkonda. Professionaalne võrgustikukaart kirjeldab koordineeritud koostööd. Neid ei tohiks segada.

---

## 10. STAR2 ametlik kliendikirje ja SotsiaalAI piir

### 10.1. Otsus mitte luua paralleelset kliendibaasi

KOV sotsiaaltöötaja ametlik kliendiinfo, abivajaduse hindamine, menetlus, juhtumiplaan, eesmärgid, tegevused, teenused ja otsused kuuluvad STAR2-sse. SotsiaalAI ei loo nende kõrvale teist aktiivset organisatsioonipõhist kliendibaasi.

Topelthoidmise risk:

```text
STAR2: eesmärk on töös, vastutaja A, tähtaeg 31.10
SotsiaalAI: eesmärk on lõpetatud, vastutaja B, tähtaeg muudetud
→ kaks vastuolulist tõde ja topeltdokumenteerimine
```

### 10.2. Mida SotsiaalAI võib minimaalselt hoida

- kliendi enda loodud Teekond;
- kliendi kinnitatud eelpöördumine;
- pöördumise vastuvõtu- ja suhtlusstaatus;
- töötaja töösolev ettevalmistav mustand;
- STAR2 menetluse viitenumber;
- märge, milline mustand on STAR2-sse kantud;
- töötaja privaatne Meetodipeegel;
- deidentifitseeritud Kovisiooni või Supervisiooni sisend;
- piiratud Võrgustikutöö ruumi metadata.

SotsiaalAI ei hoia pärast ülekandmist teist aktiivset ametliku juhtumiplaani koopiat.

### 10.3. Kliendi konto ja KOV-i tööprotsessi suhe

Kliendi SotsiaalAI konto ei anna talle automaatselt ligipääsu STAR2 menetlusele. Kliendi privaatne Teekond ja vestlus jäävad kliendile. KOV-i töötaja näeb ainult kliendi teadlikult saadetud eelpöördumist või muud eraldi kinnitatud jagatavat teksti.

Kliendi ja töötaja seos on pöördumise- või suhtluspõhine, mitte piiramatu ligipääs kummagi poole kõikidele andmetele.

---

## 11. Kliendi eelpöördumine ja sotsiaaltöötaja vastuvõtulaud

### 11.1. Eesmärk

Eelpöördumine valmistab inimese ette KOV sotsiaaltöötaja vastuvõtuks. Vastuvõtulaud valmistab töötaja ette inimese vastuvõtuks. Kohtumisel kontrollitakse info koos üle ning ametlik hindamine ja menetlus jätkuvad vajaduse korral STAR2-s.

```text
Klient mõtestab olukorda SotsiaalAI-s
→ eelpöördumise mustand
→ klient kontrollib jagatavat infot
→ sotsiaaltöötaja vastuvõtulaud
→ täpsustused ja vastuvõtuaeg
→ kohtumine KOV-is
→ töötaja professionaalne hindamine
→ ametlik menetlus STAR2-s
```

### 11.2. Kliendi eelpöördumise sisu

- miks inimene pöördub;
- mis on kõige suurem mure;
- mida inimene ise soovib muuta;
- millist abi ta loodab;
- mida ta on juba proovinud;
- milliseid teenuseid või toetusi ta kasutab;
- kes teda praegu toetavad;
- kas olukord on kiireloomuline;
- milline suhtlusviis sobib;
- kas ta vajab tõlget või ligipääsetavuse kohandust;
- millal ta saab vastuvõtule tulla;
- milliseid dokumente ta soovib teadlikult jagada.

AI võib infot struktureerida, kuid ei määra õigust teenusele, ei tee lõplikku abivajaduse hinnangut ega lisa infot, mida inimene ei ole kinnitanud.

### 11.3. Jagatava versiooni eelvaade

```text
Minu pöördumise põhjus
Olukorra kokkuvõte
Minu enda eesmärk
Mida olen juba proovinud
Olemasolev tugi
Küsimused sotsiaaltöötajale
Kohtumise korraldamiseks vajalik info
```

Kasutaja valib, milliseid osi jagada. Kogu privaatset Teekonda või vestlust ei jagata vaikimisi.

### 11.4. Sotsiaaltöötaja vastuvõtulaud

Töötaja näeb:

- uusi eelpöördumisi;
- saabumise aega;
- inimese kinnitatud põhjust ja kokkuvõtet;
- soovitud kontaktiviisi;
- sobivaid aegu;
- teadlikult lisatud dokumente;
- ohutuse kontrollimist vajavaid signaale;
- puuduvaid küsimusi;
- inimese enda ootust;
- pöördumise seisu.

Võimalikud seisud:

```text
SAABUNUD
ÜLEVAATAMISEL
VAJAB TÄPSUSTUST
KONTAKT VÕETUD
AEG PAKUTUD
VASTUVÕTT KOKKU LEPITUD
AMETLIK MENETLUS ALUSTATUD
STAR2-SSE ÜLE KANTUD
SULETUD
```

### 11.5. Vastuvõtu ajal

Kohtumise ekraanil on kõrvuti inimese kinnitatud eelinfo ja töötaja kohtumise tugi. Töötaja saab kontrollida, kas kokkuvõte on endiselt õige, mida tuleb parandada ning milline info vajab ametlikku kontrolli.

### 11.6. Pärast vastuvõttu

1. töötaja kontrollib kohtumise kokkuvõtte;
2. eristab fakti, inimese väite ja professionaalse hinnangu;
3. koostab STAR2 jaoks sobiva mustandi;
4. kannab vajaliku info STAR2-sse;
5. märgib eelpöördumise juures `STAR2-sse üle kantud`;
6. lisab soovi korral STAR2 menetluse viitenumbri;
7. ametlik menetlus jätkub STAR2-s.

### 11.7. Kolm erinevat kliendi valikut

#### Valmistan kohtumiseks ette

Kõik jääb privaatseks ja KOV ei saa infot.

#### Soovin, et KOV võtaks minuga ühendust

Kasutaja saadab kinnitatud eelpöördumise ning saab vastuvõtmise kinnituse.

#### Soovin esitada ametliku taotluse

SotsiaalAI suunab KOV-i ametlikku kanalisse või võimaldab ametlikku esitamist ainult partner-KOV-iga kokku lepitud protsessis.

### 11.8. Õiguslik piir

KOV-ile saadetud eelpöördumine on vähemalt dokumenteeritav kontakt. Lihtne märge `see ei ole ametlik taotlus` ei pruugi kõrvaldada KOV-i kohustust abi saamiseks pöördunud inimese abivajadus välja selgitada. Eelpöördumise täpne menetluslik staatus, vastuvõtmise kinnitus ja STAR2-sse registreerimise kord tuleb partner-KOV-iga enne pilooti lukustada.

---

## 12. Uuendatud kontseptuaalne andmemudel

```text
PreInquiry
PreInquirySharedVersion
PreInquiryReceipt
PreInquiryStatusEvent

CaseWorkAssist
- ownerUserId
- preInquiryId
- externalSystem: STAR2
- externalReference
- nextContactAt
- retentionState

CaseWorkDraft
- caseWorkAssistId
- draftType
- sourceLabels
- reviewStatus
- transferStatus
- transferredAt

CaseWorkQuestion
CaseWorkMissingInfo
CaseWorkMeetingPrep
CaseWorkTransferEvent

PracticeReflection
- caseWorkAssistId
- sourceDraftId või activityReference
- visibility: PRIVATE

NetworkWorkspace
NetworkParticipant
NetworkSharedItem
NetworkAgreement
NetworkVoiceSession
DisclosureGrant
AuditEvent
```

Andmemudel ei sisalda SotsiaalAI ametlikku `CaseGoal`, `CaseAction` või `CasePlan` koopiat. STAR2-sse kandmiseks valmistatakse ajutine ja kontrollitav mustand. Jagada tuleb konkreetset kinnitatud infokogumit, mitte tervet Juhtumitöö assistenti.

---

## 13. Läbivad privaatsus- ja tooteprintsiibid

### 13.1. Vaikimisi minimaalne nähtavus

- privaatne on vaikeseis;
- jagamine on konkreetne ja eesmärgipõhine;
- ligipääs on seotud rolli, organisatsiooni, juhtumi ja ajaga;
- suhte sulgemisel tuleb aktiivne ligipääs eemaldada;
- säilitamine ja ligipääs ei ole sama asi.

### 13.2. Selge andmete päritolu

Iga oluline väide peaks näitama, kas see pärineb:

- kliendilt;
- töötajalt;
- teiselt spetsialistilt;
- dokumendist;
- hindamisvahendist;
- AI mustandist;
- teadmusbaasi allikast.

### 13.3. AI roll

AI võib:

- aidata struktureerida;
- teha mustandi;
- pakkuda küsimusi;
- näidata võimalikke vaatenurki;
- võrrelda infot;
- märgata vastuolusid;
- aidata reflekteerida.

AI ei tohiks:

- määrata õiget meetodit;
- teha automaatset ametlikku hinnangut;
- otsustada teenusele õiguse üle;
- anda automaatset riskiskoori otsuse alusena;
- muuta hüpoteesi faktiks;
- jagada infot ilma inimese kinnituseta;
- hinnata töötaja kvaliteeti lihtsustatud meetrikaga.

### 13.4. Refleksiooni eri staatused

Igal refleksioonil või märkmel peab olema selge staatus:

- privaatne töömustand;
- professionaalne refleksioon;
- Kovisiooni mustand;
- supervisiooni materjal;
- ametlik juhtumimärge;
- kliendiga jagatav kokkuvõte;
- võrgustikuga jagatav info.

### 13.5. Audit ja elutsükkel

Auditida tuleks vähemalt:

- kes lõi või muutis kirje;
- kes nägi tundlikku infot;
- kes jagas;
- kes kinnitas;
- milline oli jagatud versioon;
- millal ligipääs eemaldati;
- millal andmed üle vaadatakse, arhiveeritakse või kustutatakse.

---

## 14. Soovitatav arendusjärjekord

### Etapp 0. STAR2, KOV-i ja privaatsuspiirid

Lukustada:

- millal eelpöördumine on privaatne mustand, KOV-i kontakt või ametlik taotlus;
- millal KOV peab pöördumise STAR2-s registreerima;
- milline info on ainult ettevalmistav mustand;
- milline info on töötaja privaatne refleksioon;
- kuidas märgitakse info STAR2-sse kantuks;
- kui kaua ülekantud mustandit SotsiaalAI-s hoitakse;
- mida klient näeb ja kinnitab;
- võrgustiku jagamis- ja ligipääsupiirid;
- tervishoiukontakti esimese MVP piirid.

### Etapp 1. Eelpöördumise ja vastuvõtu tervikvoog

- privaatne eelpöördumise ettevalmistus;
- jagatava versiooni eelvaade;
- KOV-ile saatmine;
- vastuvõtmise kinnitus;
- sotsiaaltöötaja vastuvõtulaud;
- täpsustav küsimus;
- vastuvõtuaja pakkumine;
- audit ja säilitamise reeglid.

### Etapp 2. Juhtumitöö assistendi õhuke tuum

- kohtumise ettevalmistus;
- puuduva info loend;
- info päritolu märgistus;
- STAR2 jaoks struktureeritud mustand;
- töötaja kontrollistaatus;
- `Kopeeri STAR2 jaoks`;
- STAR2 viitenumber;
- `STAR2-sse üle kantud` sündmus.

### Etapp 3. Meetodipeegli seos

- tegevuse või kohtumise pealt refleksiooni avamine;
- lähenemisviis ja meetod;
- valiku põhjus;
- kliendi reaktsioon;
- faktide ja tõlgenduste eristus;
- järgmine professionaalne otsus;
- vaikimisi täielikult privaatne nähtavus.

### Etapp 4. Võrgustikutöö piiratud MVP

- võrgustikukaart;
- Teenusekaardilt teenuseosutaja valimine;
- kliendi kinnitatud jagatav kokkuvõte;
- üks piiratud kutsutud osaleja;
- kirjalik ruum;
- salvestamata häälvestlus;
- kokkuleppe mustand STAR2 jaoks;
- perearst ainult piiratud välise kontaktina, ilma meditsiinimoodulita.

### Etapp 5. Kovisiooni, Supervisiooni ja eetilise arutelu seos

- deidentifitseeritud mustand;
- keskne professionaalne küsimus;
- meetodi refleksioon;
- töötaja kinnitatud eksport;
- järelduse valikuline tagasitoomine töötaja privaatsesse refleksiooni.

### Etapp 6. Visuaalsed kaardid ja meetodite teadmusbaas

- genogramm;
- ökokaart;
- professionaalne võrgustikukaart;
- kontrollitud meetodikirjeldused;
- allikad;
- refleksiooniküsimused.

---

## 15. Esimese tervikliku MVP soovitus

Kõige väiksem väärtuslik läbiv töövoog võiks olla:

```text
Klient valmistab privaatse eelpöördumise
→ klient valib ja kinnitab jagatava info
→ KOV sotsiaaltöötaja saab pöördumise vastuvõtulauale
→ töötaja küsib täpsustuse või pakub vastuvõtuaja
→ kohtumisel kontrollitakse eelinfo koos üle
→ Juhtumitöö assistent koostab STAR2 struktuurile vastava mustandi
→ töötaja kontrollib iga osa
→ töötaja kannab vajaliku ametliku info STAR2-sse
→ SotsiaalAI-s märgitakse mustand ülekantuks ja lisatakse STAR2 viide
→ töötaja võib avada eraldi privaatse Meetodipeegli refleksiooni
```

MVP ei peaks veel sisaldama:

- SotsiaalAI ametlikku kliendibaasi;
- STAR2 juhtumiplaani koopiat;
- teenuste ja toetuste määramist;
- automaatset STAR2 saatmist;
- lapse ja esindaja lihtsustatud ligipääsumudelit;
- piiranguteta võrgustikuandmete jagamist;
- tervise infosüsteemi andmeid;
- automaatset riskihinnangut;
- AI tehtud meetodiotsust;
- kogu Teekonna või vestluse jagamist;
- uusi paralleelseid vestlus- või failisüsteeme.

---

## 16. Fable 5 võimalik kasutamine

Piiratud Fable 5 kasutus tasub suunata pikkade sõltuvustega ülesannetele, mitte väikestele UI parandustele.

**11.07.2026 õhtune prioriteediotsus:** esimene Fable 5 kasutus läheb SotsiaalAI praeguse platvormiloogika ja funktsioonidevaheliste seoste ülevaatuseks. Eesmärk ei ole alustada üldisest auditist ega ehitada korraga uusi funktsioone. Fable peab aktiivse koodi põhjal välja selgitama, millised võimekused päriselt töötavad, kus on nende algus ja tulemus, millised üleandmised on olemas ning millised on ainult kasutajaliideses lubatud. Täpne ülesanne ja oodatud väljund on eraldi [Fable 5 brief'is](./fable-5-platvormi-loogika-brief.md).

### Variant A. Funktsionaalse tõe audit

Võrrelda käesoleva dokumendi peatükis 2 toodud funktsioonilubadusi aktiivse koodi, UI, API-de ja testidega. Väljundiks väitepõhine audit, mitte üldine code review.

### Variant B. Usage/admin production-riskide audit

Kontrollida kasutusarvestust, perioode, pakette, override'e, admini õigusi, race condition'e, idempotentsust, webhook'e, kustutamist ja migratsioone.

### Variant C. STAR2 kõrval töötava arhitektuuri kavandamine

Kaardistada olemasolevad Journey, PreInquiry, Room, Invite, Help, Document, ServiceMap, Kovisioon, authz, privacy ja audit süsteemid ning kavandada nende peale:

- eelpöördumise ja vastuvõtu tervikvoog;
- Juhtumitöö assistent;
- STAR2 mustandite ja ülekandmise olekud;
- võrgustikutöö töölaud;
- Meetodipeegel.

Esimene Fable run peaks olema analüüs ja arhitektuur, mitte massiline implementatsioon. Teine run võib ehitada ühe kinnitatud vertikaalse lõigu koos regressioonitestidega.

### Variant D. RAG-i sisuline kvaliteediaudit

Koostada keerulised eestikeelsed testjuhtumid, jälitada vastused algallikateni ning kontrollida ebakindlust, kohaliku ja riikliku info eristust, allikate kehtivust ja viidete vastavust.

### Variant E. Privaatsuse ja õiguste red-team

Kontrollida kogu andmeteekonda:

```text
Vestlus
→ Teekond
→ eelpöördumine
→ KOV-i vastuvõtulaud
→ Juhtumitöö assistendi mustand
→ STAR2 ametlik menetlus
→ võrgustik
→ vestlusruum
→ dokument
→ arhiveerimine ja kustutamine
```

### Fable 5 soovitatav kahe päeva jaotus

1. Esimene päev: arhitektuur või sõltumatu audit, ilma koodi muutmata.
2. Inimese kontroll: kinnitada rollid, piirid, jagamise tähendus ja MVP.
3. Teine päev: üks tõendatud parandus või üks väike täielik vertikaalne lõik.
4. Pärast seda: brauseri-, õiguste-, migratsiooni- ja regressioonikontroll teise tööriista või mudeliga.

---

## 17. Avatud tooteotsused

Enne uue süsteemi ehitamist vajavad vastust vähemalt järgmised küsimused:

1. Millal on SotsiaalAI eelpöördumine privaatne mustand, KOV-i kontakt või ametlik taotlus?
2. Kes on eri andmeliikide vastutav töötleja ja milline on SotsiaalAI roll?
3. Milline minimaalne pöördumis- ja ülekandemetadata võib SotsiaalAI-s pärast STAR2 sisestust alles jääda?
4. Millised andmed on töötaja isiklik refleksioon ja millised ametlik dokumentatsioon?
5. Kuidas klient näeb ja parandab enda kinnitatud eelpöördumise infot?
6. Kuidas käsitletakse kliendi eriarvamust töötaja kokkuvõttega?
7. Kuidas parandatakse valesti saadetud eelpöördumine või valesti jagatud info?
8. Kuidas välditakse sama ametliku info paralleelset säilitamist SotsiaalAI-s ja STAR2-s?
9. Millal võrgustikuliikme ligipääs lõpeb?
10. Kas ja kuidas saab klient jagamise tagasi võtta?
11. Millised ettevalmistavad mustandid jäävad pärast STAR2-sse kandmist alles ning kui kauaks?
12. Milline on lapse, vanema, eestkostja ja esindaja ligipääsumudel?
13. Milliseid meetodeid ja hindamisvahendeid võib platvormis toetada?
14. Kes kinnitab meetodite teadmusbaasi sisu ja selle ajakohasuse?
15. Kas Meetodipeegli andmeid saab kasutada organisatsiooni õppimiseks ning kuidas välditakse töötajate jälgimist?
16. Millised kriisi- ja turvafunktsioonid on ainult suunavad ning millised käivitavad inimese sekkumise?
17. Millised funktsioonid kuuluvad esimesse MVP-sse ja millised jäävad teadlikult hilisemaks?

---

## 18. Kokkuvõttev tootevisioon

Arutatud ideed moodustavad ühe tervikliku professionaalse töö tsükli:

```text
Kliendi privaatne Teekond
→ kliendi kinnitatud eelpöördumine
→ sotsiaaltöötaja vastuvõtulaud
→ Juhtumitöö assistent
→ töötaja kontrollitud STAR2 mustand
→ ametlik menetlus ja juhtumiplaan STAR2-s
→ vajaduse korral piiratud võrgustikutöö
→ Meetodipeegel
→ vajaduse korral Kovisioon, supervisioon või eetiline arutelu
→ kohandatud järgmine tegevus
```

SotsiaalAI võimalik eristuv väärtus ei oleks ainult info leidmine või juhtumite haldamine. Platvorm võiks ühendada:

- kliendi enesemääramise ja privaatse Teekonna;
- spetsialisti juhtumitöö ettevalmistuse STAR2 kõrval;
- kliendi ja töötaja läbipaistva vastuvõtueelse koostöö;
- võrgustiku koordineerimise;
- kontrollitud teadmusbaasi;
- meetodite teadliku valiku;
- professionaalse refleksiooni;
- Kovisiooni ja tööheaolu;
- auditeeritava, minimaalse ja kinnitatud infojagamise.

Arenduse peamine põhimõte peab olema, et rohkem funktsioone ei tähendaks automaatselt rohkem nähtavust või rohkem kogutud andmeid. Iga uus tööriist peab selgelt näitama, kellele info kuulub, kust see pärineb, kes seda näeb, miks seda kasutatakse, millal see üle vaadatakse ja kuidas ligipääs lõpeb.

---

## 19. Tööheaolu täpsustatud tootekontseptsioon

### 19.1. Tööheaolu roll SotsiaalAI-s

Tööheaolu peab jääma sotsiaaltöötaja privaatseks töölauaks. See ei ole klienditöö register, töötaja hindamise vahend ega automaatselt teiste SotsiaalAI funktsioonidega ühendatud andmekiht.

Põhisõnum kasutajale:

> Tööheaolu on sinu privaatne koht, kus märgata koormust, mõtestada tööolukordi ning koostada endale taastumise, toe või töökorralduse järgmised sammud.

Selle juurde peab kuuluma nähtav privaatsusselgitus:

> Sinu isiklikke vastuseid ei näe juht, kolleeg ega organisatsioon. Jagatav tekst tekib ainult siis, kui sa selle ise koostad ja kinnitad.

### 19.2. Kaks kasutusviisi

#### Perioodiline kontroll

Töötaja võib teha Kiirkontrolli endale sobiva sagedusega:

- kord nädalas;
- kord kuus;
- pärast pingelisemat perioodi;
- ainult vajaduse korral.

```text
Kiirkontroll
→ hetke koormus ja ressursid
→ privaatne tulemus
→ üks soovitatud teema
→ soovi korral privaatne tegevus
→ vabatahtlik järgmine kontroll
```

Kasutaja saab valida, kas ja millal ta soovib meeldetuletust. Perioodiline kontroll ei tohi muutuda tööandja kohustuslikuks mõõtmiseks ega töötaja jälgimiseks.

#### Olukorra- või teemapõhine kasutamine

Töötaja avab sobiva tööriista siis, kui tal tekib konkreetne vajadus.

| Olukord | Sobiv tööriist |
|---|---|
| Soovin üldiselt kontrollida, kuidas mul läheb | Kiirkontroll |
| Soovin näha enda varasemaid mustreid | Ülevaade |
| Juhtum jäi mind emotsionaalselt mõjutama | Raske juhtum |
| Kogesin ähvardust, solvamist, jälitamist või vägivalda | Töövägivald |
| Olen kurnatud või vajan taastumisplaani | Taastumine |
| Olen liiga palju tööväliselt kättesaadav | Tööpiirid |
| Tööpäev on pidevalt killustatud | Katkestused |
| Töökorraldus või dokumenteerimine võtab ebamõistlikult palju aega | Tööprotsessid |
| Minult oodatakse midagi, mis ei kuulu minu rolli | Rollipiirid |
| Olen uus või uues ametialases rollis | Alustaja tugi |

### 19.3. Tööheaolu avaleht

Praeguste tööriistakaartide kohal võiks olla kolm selget valikut.

#### Kontrollin üldist tööheaolu

Lühike privaatne Kiirkontroll.

#### Mul on konkreetne tööolukord

Kasutaja valib sobiva teema kümne olemasoleva tööriista seast.

#### Vaatan oma varasemaid märkmeid

Kasutaja avab privaatse Ülevaate, varasemad kontrollid, plaanid ja järelkontrollid.

Kümme olemasolevat tööriista võivad alles jääda eraldi kaartidena, kuid kaardil peab nime kõrval olema üks lühike olukorrakirjeldus, mis aitab aru saada, millal seda kasutada.

### 19.4. Privaatne Ülevaade

Ülevaade võib näidata ainult töötajale endale:

- varasemaid Kiirkontrolle;
- kasutatud tööriistu;
- korduvaid koormustegureid;
- olemasolevaid tööressursse;
- taastumise muutust;
- avatud isiklikke plaane;
- pooleliolevaid kokkuleppeid;
- enda kirjutatud märkmeid;
- vabatahtlikke järgmisi kontrollpunkte.

Ülevaade ei anna diagnoosi ega töötaja väärtustavat üldskoori. Sobiv väljund on kirjeldav muster, näiteks:

> Viimase kuu kolmes kontrollis oled märkinud vähese taastumise ja sagedased katkestused.

### 19.5. Kõigi tööriistade ühine struktuur

Kõik Tööheaolu töövood võiksid kasutada sama rahulikku loogikat:

1. Mis toimub?
2. Kuidas see mind mõjutab?
3. Mida ma praegu vajan?
4. Mida soovin järgmise sammuna teha?
5. Kas ja millal tahan selle juurde tagasi tulla?

Lõpus on valikud:

- salvesta privaatselt;
- salvesta ja määra kontrollkuupäev;
- muuda või kustuta sisestus;
- koosta soovi korral eraldi jagatav mustand.

Vaikimisi tegevus on alati privaatne salvestamine.

### 19.6. Tööheaolu ei dubleeri klienditööd

Raske juhtumi tööriist ei ole kliendi juhtumikaart. Tööheaolus käsitletakse:

- kuidas olukord töötajat mõjutas;
- kas töötaja tunneb end turvaliselt;
- kas juhtum jäi emotsionaalselt koormama;
- millist taastumist on vaja;
- kas on vaja kolleegituge, Kovisiooni või Supervisiooni;
- kas on vaja töökorralduslikku muutust.

Kliendi faktid, teenused, eesmärgid ja ametlikud märkmed kuuluvad vajaduse korral STAR2 ametlikku menetlusse. Tööheaolus kasutatakse ainult töötaja toe jaoks vajalikku üldistatud kirjeldust.

### 19.7. Jagamine on erand, mitte vaikeseis

Tööheaolust võib kasutaja teadlikul valikul koostada:

- juhiga arutelu memo;
- Kovisiooni sisendi;
- Supervisiooni küsimuse;
- abipalve;
- töökorraldusliku ettepaneku;
- rollipiiride kokkuleppe;
- kopeeritava või allalaaditava teksti.

Jagamisel kehtivad järgmised reeglid:

- algne Tööheaolu kirje jääb privaatseks;
- jagamiseks luuakse uus üldistatud tekst;
- kasutaja saab teksti muuta;
- kliendi ja kolmandate isikute andmed eemaldatakse;
- kasutaja vaatab jagatava versiooni üle;
- kasutaja kinnitab jagatava versiooni;
- midagi ei saadeta automaatselt.

### 19.8. Puuduvad ühendavad funktsioonid

Olemasolevate teemade kõrvale ei ole vaja palju uusi kaarte. Rohkem väärtust annavad:

- vabatahtlik järelkontroll;
- varasema plaani jätkamine;
- kõikide privaatsete plaanide ja märkmete ülevaade;
- enda andmete muutmine, allalaadimine ja kustutamine;
- nähtav privaatsusmärgistus;
- ajas muutumise kirjeldamine;
- jagatava mustandi selge eraldamine algsest kirjest;
- valikuline Supervisiooni või Kovisiooni sisendi koostamine.

---

## 20. Tööheaolu anonüümne valdkondlik andmekiht

### 20.1. Kahetasandiline väärtus

Tööheaolul võib olla kaks rangelt eraldatud eesmärki:

1. töötajale privaatne töötoe töölaud;
2. valdkonnale anonüümne töökorralduslik ülevaade.

```text
Privaatne Tööheaolu
→ standardiseeritud näitajate anonüümne koond
→ KOV osakonna juhtimisvaade
→ ESTA valdkondlik analüüs
→ Sotsiaalministeeriumi süsteemne ülevaade
```

Privaatseid vastuseid, vabatekste ja üksiktulemusi sellesse ahelasse ei edastata.

### 20.2. Võimalik nimetus

Valdkondlikku koondit võiks nimetada näiteks:

- Sotsiaaltöö heaolu baromeeter;
- Eesti sotsiaaltöö tööheaolu ülevaade;
- Sotsiaaltöö kestlikkuse baromeeter.

„Sotsiaaltöö kestlikkuse baromeeter” rõhutab, et fookus ei ole ainult inimese enesetundel, vaid töökoormuse, ressursside, toe ja töökorralduse kestlikkusel.

### 20.3. Kolm andmekihti

#### Kiht 1: töötaja privaatne info

SotsiaalAI-sse jäävad:

- isiklikud vastused;
- vabatekstid;
- Raske juhtumi ja Töövägivalla kirjeldused;
- isiklikud plaanid;
- Kovisiooni ja Supervisiooni mustandid;
- täpsed kuupäevad;
- inimese tööheaolu ajalugu.

#### Kiht 2: kasutaja kinnitatud jagamine

Kasutaja võib ise koostada ja kinnitada juhile, Kovisiooni või Supervisiooni mineva üldistatud teksti. Seda ei tohi segada anonüümse statistikaga.

#### Kiht 3: anonüümne koond

Koondisse võivad minna ainult standardiseeritud kategooriad ja piisavalt suurte gruppide statistika.

### 20.4. Võimalikud koondnäitajad

- kõrge töökoormuse osakaal;
- vähese taastumisvõimaluse osakaal;
- sagedaste katkestuste osakaal;
- ebaselgete töö- ja rollipiiride osakaal;
- juhitoe või kolleegitoe puudumise osakaal;
- raske juhtumi järel toe vajaduse osakaal;
- töövägivalla koondsignaal;
- Kovisiooni või Supervisiooni vajaduse osakaal;
- alustajate toe puudujäägid;
- dubleeriva dokumenteerimise ja tööprotsesside probleemid;
- näitajate muutus ajas;
- olemasolevad kaitsvad ressursid ja tugevused.

### 20.5. Mida koondisse ei lisata

- vabatekstid;
- kasutaja ID;
- nimi või e-post;
- kliendiandmed;
- täpsed juhtumikirjeldused;
- täpsed kuupäevad koos harva esineva sündmusega;
- üksiku inimese tulemus;
- väikese grupi detailne tulemus;
- kombinatsioonid, mille abil saab inimese tagasi tuvastada.

### 20.6. Vabatahtlik osalemine ja läbipaistvus

Töötaja peab nägema eraldi:

#### Jääb ainult mulle

- vastused;
- märkmed;
- plaanid;
- mustandid;
- täpne ajalugu.

#### Võib osaleda anonüümses koondis

- töökoormuse kategooria;
- taastumise kategooria;
- toe olemasolu;
- katkestuste sagedus;
- rolliselguse kategooria;
- muud standardiseeritud töökorralduslikud markerid.

Usalduse huvides võiks töötaja valida, kas tema standardiseeritud kirjed osalevad valdkondlikus koondis. Keeldumine ei tohi piirata privaatse Tööheaolu kasutamist.

### 20.7. Anonüümsus ja väikeste gruppide kaitse

Sisemised kasutajaga seostatavad kirjed on isikuandmed ka siis, kui kasutaja nime asemel kasutatakse tehnilist ID-d. Välise koondi saab käsitleda anonüümsena ainult juhul, kui inimese tagasituletamine on praktiliselt ja pöördumatult välistatud.

Vajalikud kaitsed:

- avaldamise minimaalne grupisuurus;
- eristuvate inimeste, mitte kirjete arvestamine;
- väikeste gruppide summutamine;
- täiendav summutamine, et peidetud tulemust ei saaks kogusummast arvutada;
- ohtlike filtrikombinatsioonide keelamine;
- vajaduse korral arvude asemel vahemikud;
- harva esinevate sündmuste eraldi kaitse;
- pikema ajaperioodi kasutamine väikese meeskonna korral.

Praegune tehniline piloodilävi kolm kasutajat ei ole automaatselt sobiv väliseks KOV-i, ESTA või ministeeriumi aruandluseks. Välise raporti lävi tuleb määrata eraldi privaatsusanalüüsi ja piloodi põhjal.

### 20.8. Ametlikud lähtekohad

- [Eesti Sotsiaaltöö Assotsiatsioon](https://www.eswa.ee/) kirjeldab oma eesmärkidena sotsiaaltöötajate kutsealaste huvide esindamist ning sotsiaalpoliitika kujundamisse panustamist.
- [Sotsiaalministeerium](https://www.sm.ee/blogi/tootajate-hea-vaimse-tervise-voti-peitub-heaolu-toetavas-tookorralduses) rõhutab tööheaolu seost koormuse, ressursside, autonoomia, taastumise ja töökorraldusega.
- [Andmekaitse Inspektsiooni mõistete juhis](https://www.aki.ee/isikuandmed/kkk/moisted) rõhutab, et anonüümseks muutmine peab olema pöördumatu.

---

## 21. KOV osakonna igakuine Tööheaolu koond

### 21.1. Eesmärk

KOV sotsiaalosakonna juht võiks saada kord kuus või piisava andmemahu tekkimisel anonüümse töökorraldusliku ülevaate. Raport ei ole töötajate hindamine, vaid sisend töötingimuste parandamiseks.

Raporti nähtav põhisõnum:

> See ülevaade kirjeldab osakonna töötingimuste ja toe mustreid. Seda ei tohi kasutada üksikute töötajate hindamiseks ega tuvastamiseks.

### 21.2. Kuuraporti ülesehitus

#### Andmete piisavus

- periood;
- andmete avaldamiseks piisava valimi staatus;
- kasutatud ühe- või mitmekuuline periood;
- privaatsuse tõttu peidetud näitajad;
- üldine representatiivsuse märkus.

Juht ei näe, kes täitis või kes ei täitnud Tööheaolu tööriistu.

#### Töö nõudmised

- töökoormuse surve;
- emotsionaalselt raskete juhtumite mõju;
- katkestused;
- dubleeriv dokumenteerimine;
- tööväline kättesaadavus;
- rollikonfliktid;
- töövägivalla üldine signaal.

#### Tööressursid

- juhitugi;
- kolleegitugi;
- Kovisiooni kättesaadavus;
- Supervisiooni kättesaadavus;
- asendusvõimalus;
- taastumisaeg;
- rolliselgus;
- töö üle otsustamise võimalus.

#### Muutus ajas

- selle kuu koond;
- viimase kolme kuu libisev muster;
- suund: paraneb, stabiilne või halveneb;
- võrdlus ainult piisava andmemahu korral.

#### Tugevused

Raport peab näitama ka toimivaid ressursse, näiteks tugevat kolleegituge, paranenud taastumisvõimalusi või selgemaid rolle.

#### Tähelepanu vajavad teemad

Raport võiks tuua esile maksimaalselt kolm peamist töökorralduslikku teemat, mitte koostada pikka probleemide nimekirja.

#### Soovitatud juhtimistegevused

Soovitused suunatakse organisatsioonile, mitte töötajale. Näited:

- kaitstud dokumenteerimisaeg;
- teadete ja katkestuste kokkulepe;
- raske juhtumi järel kolleegitoe kord;
- asendamise süsteem;
- rollipiiride arutelu;
- regulaarne Kovisioon või Supervisioon;
- dubleeriva dokumenteerimise vähendamine.

### 21.3. Osakonna tööheaolu tegevusplaan

Juht peab saama koondist luua meeskonnale nähtava tegevusplaani:

- milline teema valitakse;
- millist muudatust proovitakse;
- kes vastutab;
- millal katse algab;
- millal tulemust hinnatakse;
- kuidas töötajatele tagasi raporteeritakse.

Näide:

```text
Probleem: sagedased katkestused ja vähene fookusaeg.
Kokkulepe: teisipäeval ja neljapäeval kell 9–11 on dokumenteerimise fookusaeg.
Erandid: vahetu oht ja seadusest tulenev kiire tegevus.
Katseperiood: üks kuu.
Ülevaatus: järgmise kuukoondi järel.
```

### 21.4. Töötajad näevad sama koondit

Usalduse huvides võiksid osakonna töötajad näha:

- sama anonüümset kuukoondit;
- juhi või meeskonna valitud tegevust;
- tegevuse tähtaega;
- eelmise kokkuleppe tulemust.

```text
Töötajad annavad privaatse sisendi
→ tekib anonüümne koond
→ osakond näeb sama tulemust
→ juht ja meeskond lepivad kokku muudatuse
→ järgmisel perioodil hinnatakse muutust
```

### 21.5. Väikese KOV-i kaitse

Kui osakond on väike, peab süsteem:

- ühe kuu detailnäitajad peitma;
- kasutama kolme või kuue kuu koondit;
- ühendama tulemuse suurema turvalise grupiga;
- näitama ainult üldist signaali;
- jätma harva esinevad sündmused arvuliselt avaldamata;
- vältima rolli, staaži, asukoha ja väikese üksuse kombineerimist.

Kasutajale sobiv teade:

> Selle perioodi kohta ei ole anonüümse osakonnavaate koostamiseks piisavalt osalejaid. Järgmine ülevaade koostatakse pikema perioodi koondina.

### 21.6. Soovitatav aruandlussagedus

| Tase | Sagedus | Eesmärk |
|---|---|---|
| Töötaja privaatne vaade | Alati | Isiklik refleksioon ja tugi |
| Osakonnajuhi koond | Kord kuus või piisava andmemahu tekkimisel | Töökorralduslikud parandused |
| KOV juhtkonna koond | Kord kvartalis | Ressursi- ja juhtimisotsused |
| ESTA valdkondlik ülevaade | Poolaastas või aastas | Valdkondlikud trendid ja huvikaitse |
| Sotsiaalministeeriumi ülevaade | Aastas või kokkulepitud tsüklis | Süsteemsete meetmete kavandamine |

### 21.7. Juhi ligipääsupiirid

KOV juht ei saa:

- avada töötaja profiili Tööheaolu vaates;
- näha individuaalseid Kiirkontrolle;
- näha, kes millise tööriista avas;
- lugeda vabatekste;
- näha üksiku inimese Kovisiooni või Supervisiooni vajadust;
- eksportida kasutajataseme andmeid;
- filtreerida tulemust ühe inimeseni.

---

## 22. Supervisioon eraldi tasuta teenuse ja töölauana

### 22.1. Supervisiooni roll

Supervisioon on eraldi professionaalne teenus, mitte Tööheaolu alamkaart ega Kovisiooni teine nimetus.

| Funktsioon | Eesmärk |
|---|---|
| Tööheaolu | Töötaja privaatne eneserefleksioon ja töötoe plaan |
| Kovisioon | Kolleegidevaheline juhtumite ja professionaalsete küsimuste arutelu |
| Supervisioon | Väljaõppinud superviisori juhitud professionaalne areng ja refleksioon |
| Mentorlus | Praktiline tugi alustajale või uues rollis töötajale |
| Meetodipeegel | Kasutatud lähenemiste ja meetodite professionaalne refleksioon |
| Juhtumikorraldus | Kliendi olukorra, teenuste ja tegevuste koordineerimine |

### 22.2. ESTA roll vajab kokkulepet

ESTA veebist ei ole praegu tuvastatud eraldi avalikku „ESTA ametlike superviisorite registrit”. ESTA-l on superviisoritega seotud tegevusi ning mentorite puhul protsess, kus kontrollitakse sertifikaate ja heakskiidetud inimesed lisatakse andmebaasi.

Seetõttu saab „ESTA poolt kontrollitud superviisori” märget kasutada alles siis, kui ESTA-ga on kokku lepitud:

- kvalifikatsioonikriteeriumid;
- dokumentide kontroll;
- kinnituse kehtivus;
- peatamine ja aegumine;
- eetika- ja kvaliteedinõuded;
- kaebuste käsitlemine;
- vastutuse piirid.

Võimalik lähtekoht: [ESTA mentorite kinnitamise kirjeldus](https://www.eswa.ee/tule-mentoriks/).

### 22.3. Tasuta teenuse põhimõte

Supervisioon on osalejale tasuta. Platvormil ei ole:

- hindu;
- arveid;
- makseid;
- ostukorvi;
- teenusepakette;
- ostetud krediite;
- superviisorite hinnavõrdlust.

Rahastus võib tulla platvormiväliselt ESTA projektist, Sotsiaalministeeriumi programmist, KOV-ide koostööst, strateegilisest partnerlusest või muust avalikust rahastusest.

Tasuta teenuse peamised korraldusprobleemid on võimekus, vabad ajad, ootenimekiri ja õiglane ligipääs, mitte hinnastamine.

### 22.4. Supervisiooni vormid

- individuaalne supervisioon;
- grupisupervisioon;
- meeskonnasupervisioon;
- juhtimissupervisioon;
- avatud temaatiline supervisioonituba;
- ühekordne professionaalne konsultatsioon;
- pikem supervisiooniprotsess.

### 22.5. Neli seotud töölauda

#### Sotsiaaltöötaja Supervisiooni töölaud

- Leia superviisor;
- Alusta supervisiooniruumi;
- Minu aktiivsed ruumid;
- Järgmine häälvestlus;
- Avatud grupisupervisioonid;
- Minu privaatsed ettevalmistused;
- Järgmised sammud;
- Lõpetatud protsessid;
- Ootenimekiri.

#### Superviisori töölaud

- uued ruumitaotlused;
- aktiivsed supervisiooniruumid;
- tänased ja tulevased häälvestlused;
- grupid ja meeskonnad;
- saadavus;
- ootenimekiri;
- osalejate kinnitatud sisendid;
- protsesside lõpetamine;
- profiil ja ESTA kontrollistaatus.

#### ESTA programmi haldus

- superviisorite taotlused;
- sertifikaadid ja kontroll;
- kinnitatud, aeguvad ja peatatud profiilid;
- programmi üldine võimekus;
- piirkondlik ja keeleline katvus;
- ootenimekirja pikkus;
- avatud grupid;
- anonüümne kvaliteeditagasiside;
- kontrollimise audit.

ESTA ei näe supervisioonide sisu.

#### KOV-i piiratud programmivaade

KOV võib näha teenuse kättesaadavust, üldist anonüümset kasutust ja piirkondlikku võimekust. KOV ei näe töötaja teemat, ettevalmistust, märkmeid ega privaatset järelrefleksiooni.

---

## 23. Supervisiooniruum kui keskne töövorm

### 23.1. Kohtumine ei ole keskne objekt

Supervisioon ei pea tähendama ainult aja broneerimist ja videokohtumist. Keskne objekt võib olla püsiv konfidentsiaalne supervisiooniruum, kus töötaja ja superviisor teevad koostööd nii asünkroonselt kui reaalajas.

```text
Töötaja loob supervisiooniruumi
→ sõnastab professionaalse küsimuse
→ superviisor võtab ruumi vastu
→ kirjalik ja visuaalne koostöö
→ vajaduse korral reaalajas häälvestlus
→ ühine refleksioon
→ kokkulepitud järgmine samm
→ järelvaade või uus töötsükkel
```

Ruum võib kesta ühe küsimuse lahendamiseni, mõned nädalad, mitme kohtumise jooksul või püsiva grupiprotsessina.

### 23.2. Supervisiooniruumi loomine

Kasutaja valib:

- konkreetne professionaalne küsimus;
- üldistatud juhtumi refleksioon;
- meetodivaliku refleksioon;
- eetiline dilemma;
- enda reaktsiooni mõtestamine;
- rolli või piiride küsimus;
- pikem arenguprotsess;
- grupisupervisioon.

Broneerimis- või ruumitaotluses ei sisestata kliendi nime ega detailset tuvastatavat juhtumikirjeldust.

### 23.3. Ruumi eesmärk ja kokkulepe

Enne koostöö algust kinnitatakse:

- eesmärk;
- osalejad;
- konfidentsiaalsus;
- suhtlusviis;
- superviisori vastamise raam;
- häälvestluse kasutamine;
- protsessi eeldatav kestus;
- ruumi mittesisestatava info piirid;
- lõpetamise tingimused;
- asjaolu, et Supervisioon ei ole kriisiabi kanal.

### 23.4. Supervisioonilõuend

#### Fookusküsimus

Mida soovin selle supervisiooni kaudu paremini mõista?

#### Üldistatud olukord

- mis toimus;
- milline on kontekst;
- kes on osapooled ilma tuvastatavate andmeteta;
- milline info on kindel;
- milline on töötaja tõlgendus.

#### Professionaalne roll

- mida töötajalt oodati;
- kuidas töötaja enda rolli nägi;
- milline vastutus oli töötajal;
- kus tekkis rollikonflikt.

#### Töötaja reaktsioon

- mida töötaja tundis;
- mida ta märkas enda käitumises;
- mis teda eriti mõjutas;
- milline mõte või tunne kordub.

#### Kasutatud lähenemine ja meetod

- mida prooviti;
- miks see valiti;
- kuidas klient või teine osapool reageeris;
- mis töötas;
- mis ei töötanud;
- milles töötaja kahtleb.

#### Eetiline või professionaalne pinge

- millised väärtused on konfliktis;
- kelle õigused või huvid on mõjutatud;
- mida kardetakse valesti teha;
- millist piiri on raske hoida.

#### Võimalikud vaatenurgad

Töötaja ja superviisor saavad lisada küsimusi, hüpoteese ja alternatiive. Need ei muutu automaatselt ametlikeks hinnanguteks.

#### Järgmine samm

- mida töötaja proovib;
- mida ta teadlikult ei tee;
- mida ta soovib märgata;
- millal tulemust uuesti vaadatakse.

### 23.5. Kirjalik koostöö

Supervisiooniruum võib toetada asünkroonset professionaalset dialoogi:

- töötaja lisab küsimuse;
- superviisor esitab täpsustavaid küsimusi;
- töötaja vastab endale sobival ajal;
- superviisor lisab refleksiooniülesande;
- oluline mõte tõstetakse arutelust lõuendile;
- kokkulepe muudetakse järgmiseks sammuks.

Ruumi juures peab olema nähtav, et superviisor vastab kokkulepitud ajaraamis ega ole pidevalt reaalajas kättesaadav.

### 23.6. Häälvestlus

Ruumis saab alustada või kokkulepitud ajal avada reaalajas häälvestluse. Kõne kõrval on nähtav:

- fookusküsimus;
- ühine lõuend;
- jagatud märkmed;
- refleksiooniküsimused;
- osalejad;
- taimer;
- järgmiste sammude ala.

Häälvestluse põhimõtted:

- osalevad ainult ruumi liikmed;
- kõnet ei salvestata vaikimisi;
- automaatset transkripti ei tehta;
- AI ei kuula ega koosta automaatselt kokkuvõtet;
- osalejad kirjutavad ise, mida soovivad säilitada;
- superviisor ei saa ühepoolselt salvestamist käivitada;
- esimeses MVP-s võib salvestamise täielikult välistada.

### 23.7. Visuaalne valgetahvel

Supervisiooniruumis võib kasutada:

- suhete kaarti;
- rollide kaarti;
- ajajoont;
- üldistatud genogrammi või ökokaarti;
- jõudude ja pingete kaarti;
- väärtuskonflikti skeemi;
- „mida saan mõjutada / mida ei saa mõjutada” vaadet;
- eri osapoolte vaatenurkade kaarti.

Kliendi täielikku juhtumikaarti supervisiooniruumi ei kopeerita.

### 23.8. Refleksioonikaardid

Superviisor saab lisada küsimusi, näiteks:

- Mis sind selles olukorras kõige rohkem puudutab?
- Millist vastutust võtad endale, kuigi see ei pruugi sulle kuuluda?
- Mida klient või teine osapool võib olukorras kogeda?
- Millisele eeldusele sinu tõlgendus toetub?
- Mida oled juba proovinud?
- Mis juhtuks, kui sa midagi ei muudaks?
- Millist professionaalset piiri on raske hoida?
- Mida vajad, et tegutseda rahulikumalt?
- Milline oleks piisavalt hea järgmine samm?

Töötaja saab vastata jagatud ruumis, ainult oma privaatses märkmes või hiljem häälvestluses.

### 23.9. Privaatne ja jagatud ala

| Ala | Nähtavus |
|---|---|
| Töötaja privaatne ettevalmistus | Ainult töötajale |
| Superviisorile kinnitatud sisend | Töötajale ja superviisorile |
| Ühine supervisioonilõuend | Kõigile ruumi liikmetele |
| Töötaja privaatne järelrefleksioon | Ainult töötajale |
| Ühiselt kinnitatud järgmised sammud | Töötajale ja superviisorile |
| Superviisori professionaalsed protsessimärkmed | Ainult superviisorile |
| Tehniline audit | Ainult minimaalne metadata |

### 23.10. Supervisiooniruumi lõpptulemus

Ruum ei lõpe AI koostatud protokolliga. Töötaja saab sõnastada:

- mida ta paremini mõistab;
- mida ta soovib märgata;
- mida ta proovib;
- millist tuge ta vajab;
- millal ta tulemuse uuesti üle vaatab.

Töötaja otsustab, kas järeldus jääb ainult Supervisiooni või kopeeritakse tema privaatsesse Meetodipeeglisse.

### 23.11. Grupi- ja meeskonnaruum

Grupisupervisiooni ruumis võivad olla:

- grupi konfidentsiaalsuskokkulepped;
- teemade esitamine;
- järgmise korra teemade järjekord;
- ühine häälvestlus;
- käe tõstmine ja kõnevoorud;
- deidentifitseeritud juhtumilõuend;
- ühised õpikohad;
- iga osaleja privaatne refleksioon.

Meeskonnasupervisioon keskendub koostööle, rollidele, konfliktidele, töökorraldusele, muutustele, juhtimisele ja ühistele professionaalsetele põhimõtetele. Juht ei näe osalejate privaatseid märkmeid.

### 23.12. Avatud supervisioonitoad

ESTA võib korraldada piiratud osalejate arvuga temaatilisi ruume, näiteks:

- raske juhtumi järel;
- töövägivalla kogemuse järel;
- eetiliste dilemmade teemal;
- alustavatele sotsiaaltöötajatele;
- rollipiiridest võrgustikutöös;
- sotsiaalvaldkonna juhtidele.

Avatud tuba on eelregistreerimisega, kontrollitud superviisori juhitud ja salvestamata.

### 23.13. Võimalik andmemudel

```text
SupervisorProfile
SupervisorVerificationAudit
SupervisionWorkspace
SupervisionParticipant
SupervisionAgreement
SupervisionTopic
SupervisionCanvas
SupervisionCanvasItem
SupervisionDiscussion
SupervisionSharedBrief
SupervisionAction
SupervisionReflection
SupervisionVoiceSession
SupervisionGroup
SupervisionWaitlistEntry
SupervisionFeedback
```

Häälvestluse tehnoloogia võib kasutada olemasolevat ruumitaristut, kuid Supervisiooni õigused, privaatsed alad, superviisori roll ja protsessi elutsükkel peavad kuuluma eraldi Supervisiooni moodulisse.

### 23.14. Supervisiooni esimene MVP

1. Töötaja loob supervisiooniruumi.
2. Töötaja valib kontrollitud superviisori.
3. Superviisor võtab ruumi vastu.
4. Mõlemad kinnitavad konfidentsiaalsuskokkuleppe.
5. Töötaja koostab privaatse sisendi.
6. Töötaja jagab sellest valitud osa.
7. Tekib ühine struktureeritud lõuend.
8. Saab pidada kirjalikku arutelu.
9. Saab alustada salvestamata häälvestlust.
10. Mõlemad saavad lisada ühiseid järgmisi samme.
11. Töötaja saab teha privaatse järelrefleksiooni.
12. Ruumi saab jätta avatuks või lõpetada.
13. Kui vabu superviisoreid ei ole, saab liituda ootenimekirjaga.
14. ESTA näeb ainult programmi võimekuse ja kvaliteedi anonüümset koondit.

---

## 24. Täiendatud tervikpilt

Uute täpsustuste järel on SotsiaalAI professionaalse poole võimalik struktuur:

```text
Spetsialisti Töölaud
├── Pöördumiste vastuvõtt
│   ├── saabunud eelpöördumised
│   ├── vastuvõtuaja korraldamine
│   └── inimese kinnitatud eelinfo
├── Juhtumitöö assistent
│   ├── kohtumise ettevalmistus
│   ├── puuduv ja kontrollimist vajav info
│   ├── STAR2 mustandid ja ülekandmise olekud
│   └── piiratud võrgustikutöö
├── Meetodipeegel
│   ├── lähenemisviis
│   ├── meetod
│   ├── tegevus
│   └── professionaalne refleksioon
├── Tööheaolu
│   ├── perioodiline privaatne kontroll
│   ├── teemapõhised privaatsed tööriistad
│   ├── privaatne Ülevaade
│   └── kasutaja kinnitatud jagatavad mustandid
├── Kovisioon
│   └── kolleegidevaheline professionaalne arutelu
└── Supervisioon
    ├── kontrollitud superviisorid
    ├── individuaalsed ja grupiruumid
    ├── asünkroonne koostöö
    ├── salvestamata häälvestlus
    └── privaatne järelrefleksioon
```

Tööheaolu anonüümne koond moodustab eraldi juhtimis- ja valdkonnakihi:

```text
Töötaja vabatahtlik standardiseeritud sisend
→ anonüümne osakonna koond
→ KOV-i töökorralduslik tegevusplaan
→ suurem ESTA valdkondlik koond
→ Sotsiaalministeeriumi süsteemne ülevaade
```

Peamised piirid:

- Tööheaolu on vaikimisi täielikult privaatne.
- Tööheaolu ei saa automaatset ligipääsu kliendijuhtumitele.
- Supervisioon ei näe automaatselt Tööheaolu, Meetodipeeglit ega Juhtumitöö assistenti.
- KOV juht ei näe individuaalseid Tööheaolu ega Supervisiooni andmeid.
- ESTA kontrollib kokkuleppe korral superviisorite staatust, kuid ei näe supervisioonide sisu.
- Häälvestlusi ei salvestata ega transkribeerita vaikimisi.
- Anonüümsed koondid avaldatakse ainult piisava andmemahu ja tagasituvastamist takistavate reeglite korral.
- Ükski AI mustand, refleksioon ega hüpotees ei muutu automaatselt ametlikuks kirjeks.
- STAR2 jääb ametliku kliendiinfo, hindamise, juhtumiplaani, teenuste ja otsuste allikaks.
- SotsiaalAI ei hoia STAR2 ametlikust juhtumiplaanist teist aktiivset koopiat.

---

## 25. SotsiaalAI ja ESTA strateegiline partnerlus

### 25.1. Partnerluse põhimõte

ESTA ei oleks lihtsalt logo või andmesaaja. Partnerluses vastutaks ESTA kokkulepitud ulatuses erialase kvaliteedi, professionaalse võrgustiku, ekspertide ja valdkondliku tõlgenduse eest. SotsiaalAI vastutaks tehnoloogia, turvalisuse, kasutajakogemuse ja andmete minimaalse töötlemise eest.

```text
SotsiaalAI
= tehnoloogia, turvaline platvorm, töövood ja anonüümne statistiline alus

ESTA
= erialane metoodika, eksperdid, mentorid, superviisorite kontroll,
  eetiline nõustamine ja valdkondlik tõlgendus

KOV-id
= piloot, töökorralduslikud tegevused ja kasutajate tagasiside

Sotsiaalministeerium
= võimalik strateegiline rahastus ja süsteemsete ettepanekute adressaat
```

### 25.2. Võimalikud koostöösuunad

- sotsiaaltöö meetodite ja Meetodipeegli metoodika ülevaatus;
- Kovisiooni professionaalsed piirid;
- Tööheaolu küsimused ja valdkondlik tõlgendus;
- mentorite programm ja digitaalsed mentorlusruumid;
- superviisorite kriteeriumid ja profiilide kontroll;
- eetilise nõustamise kanal;
- teadmusbaasi materjalide sisuline ülevaatus;
- KOV piloodid ja kasutajauuringud;
- sotsiaaltöö kestlikkuse baromeeter;
- ESTA liikmete küsitlused ja seisukohad;
- kutse ja professionaalse arengu ettevalmistav tugi.

### 25.3. Rollijaotus

| Valdkond | SotsiaalAI | ESTA |
|---|---|---|
| Tarkvara ja kasutajakogemus | Vastutab | Nõustab |
| Turve ja tehniline audit | Vastutab | Saab partnerluse ülevaate |
| Professionaalne metoodika | Rakendab | Vaatab kokkulepitud ulatuses üle |
| Teadmusbaasi tehniline haldus | Vastutab | Annab ja kinnitab kokkulepitud sisu |
| Superviisorite kontroll | Pakub tehnilise töövoo | Määrab nõuded ja kinnitab |
| Mentorlus | Pakub tööruumi | Korraldab programmi |
| Eetikaküsimused | Pakub turvalise kanali | Annab professionaalse sisendi |
| Tööheaolu statistika | Anonümiseerib ja koostab | Tõlgendab valdkondlikult |
| KOV piloodid | Pakub platvormi ja tuge | Aitab kaasata ning hinnata |
| Kasutajate privaatandmed | Kaitseb | Ei saa ligipääsu |

### 25.4. Erialase sisu märgistus

Sobivad märgised:

- `Koostöös Eesti Sotsiaaltöö Assotsiatsiooniga`;
- `Metoodika üle vaadanud ESTA ekspert`;
- `ESTA metoodiline materjal`;
- `ESTA poolt kontrollitud superviisori profiil`;
- `Viimati üle vaadatud: kuupäev`.

Vältida tuleb väiteid `ESTA kinnitatud AI` või `ESTA garanteeritud vastus`, sest ESTA saab kontrollida metoodikat ja allikaid, mitte iga tulevast AI vastust.

### 25.5. Ühine juhtimine

Võimalik ühine nõukoda:

- kaks SotsiaalAI esindajat;
- kaks ESTA esindajat;
- praktiseeriv sotsiaaltöötaja;
- KOV sotsiaaljuht;
- andmekaitse või eetika ekspert;
- vajaduse korral Sotsiaalministeeriumi vaatleja.

Nõukoda otsustab funktsioonide ESTA seose, metoodika ülevaatuse ulatuse, märgiste kasutamise, AI vigade käsitlemise, piloodid, koondandmete piirid ja kaebuste menetluse.

### 25.6. Esimene võimalik koostööprojekt

**Sotsiaaltöötaja professionaalse toe digipiloot** võiks sisaldada:

1. privaatset Tööheaolu ja anonüümset osakonnakoondit;
2. ESTA mentorite või superviisorite digitaalseid tööruume;
3. Meetodipeegli ja eetilise arutelu piiratud katsetust;
4. mõne KOV-i kasutajapilooti;
5. privaatsus- ja turbearuannet;
6. ESTA valdkondlikku hinnangut;
7. ettepanekut järgmise etapi rahastamiseks või laiendamiseks.

### 25.7. Ametlikud lähtekohad

- [ESTA organisatsioon](https://www.eswa.ee/organisatsioon/) kirjeldab sotsiaaltöötajate ühendamist, kutsealaste huvide esindamist ja sotsiaalpoliitika kujundamisse panustamist.
- [ESTA kutseandmine](https://www.eswa.ee/kutse-andmine/) näitab ESTA olemasolevat professionaalse kvaliteedi rolli.
- [ESTA mentorlus](https://eswa.ee/mentorlus/) on olemasolev Sotsiaalministeeriumi strateegilise partnerluse toel loodud professionaalse toe suund.
- [ESTA eetikakomisjon](https://www.eswa.ee/eetikakomisjon/) toetab töötajaid kutsetöös tekkivate eetiliste dilemmade korral.
- [ESTA Nipinurk](https://www.eswa.ee/nipinurk/) käsitleb enesehoidu, professionaalseid piire ja AI kasutamist sotsiaaltöös.

---

## 26. ESTA liikme partnerpakett ja ühe euro mudel

### 26.1. Põhimudel

Kui kontrollitud ESTA liige kasutab tasulist SotsiaalAI paketti, suunab SotsiaalAI iga aktiivse liikmekuu eest ühe euro ESTA-le. Kasutaja kuutasu selle tõttu ei suurene ning tal avaneb ESTA liikmeala.

Partneritasu arvestatakse ainult siis, kui:

- ESTA liikmestaatus on kontrollitud;
- kasutajal on aktiivne tasuline SotsiaalAI pakett;
- kuu makse on laekunud;
- makset ei ole täielikult tagastatud;
- sama liikme eest ei arvestata samal kuul mitu eurot.

Aastapaketi korral jagatakse arvestus aktiivsete kuude vahel. Tööandja või KOV-i makstud konto võib samuti arvestuda, kui konkreetne kasutaja on aktiivne ja kontrollitud ESTA liige.

### 26.2. Läbipaistvus kasutajale

Sobiv sõnastus:

> Oled ESTA liige? Kinnita liikmestaatus ja saad ligipääsu ESTA liikmealale. Sinu paketi hinnast suunab SotsiaalAI iga aktiivse kuu eest ühe euro Eesti Sotsiaaltöö Assotsiatsiooni professionaalsete tugitegevuste arendamisse. Sinu kuutasu sellest ei suurene.

### 26.3. Liikmestaatuse kontroll

Eelistatud lahendus on minimaalsete andmetega ESTA kinnituskood, liikme identifikaator või tulevane ESTA autentimisühendus. ESTA tagastab ainult aktiivsuse ja kehtivuse, mitte täieliku liikmeprofiili.

SotsiaalAI võib salvestada:

```text
estaMembershipStatus
estaMembershipVerifiedAt
estaMembershipValidUntil
estaVerificationReference
estaRegionId
estaBenefitsEnabled
```

SotsiaalAI ei vaja liikmemaksude ajalugu, ESTA täielikku liikmekaarti ega teiste liikmete nimekirja.

### 26.4. Liikmelisuse lõppemine

- SotsiaalAI põhikonto jätkub;
- ESTA liikmeala uusi tegevusi ei saa alustada;
- kasutaja säilitab ligipääsu enda varem loodud andmetele;
- pooleliolevat professionaalset protsessi ei katkestata järsult;
- kasutaja saab liikmestaatuse uuesti kinnitada;
- uue partneritasu arvestamine lõpeb.

### 26.5. ESTA liikmeala võimalik sisu

```text
ESTA liikmeala
├── ESTA uudised ja sündmused
├── ESTA üldfoorum
├── Minu piirkond
├── Teemakogukonnad
├── Kontrollitud metoodikad
├── Mentorlus
├── Supervisioon
├── Eetiline nõustamine
├── Koolitused ja õpitoad
├── Kutse ja professionaalne areng
├── ESTA materjalid
└── Küsitlused ja valdkondlikud seisukohad
```

### 26.6. Eksklusiivsed funktsioonid

- ESTA ekspertide üle vaadatud meetodite süvamaterjalid;
- professionaalsed liikmeruumid;
- ESTA mentorlusruumid;
- kokkulepitud Supervisiooni võimalused;
- eetilise pöördumise struktureeritud kanal;
- liikmete koolitused ja õppematerjalid;
- kutse ettevalmistavad kontrollnimekirjad;
- ESTA küsitlused ja seisukohtade arutelud;
- varajane ligipääs professionaalsetele pilootfunktsioonidele.

Põhilist ohutusinfot, privaatsuskaitset, inimese õigust enda andmeid näha või kustutada ning kliendi põhilisi funktsioone ei tohi liikmelisuse taha lukustada.

### 26.7. Lepingus lahendatavad küsimused

- aktiivse liikmekuu definitsioon;
- aasta- ja tööandjapakettide käsitlus;
- tagasimaksed;
- partneritasu aruanne ja tasumine;
- liikmestaatuse tehniline kontroll;
- andmetöötluse rollid;
- ESTA kaubamärgi kasutamine;
- eksklusiivsete funktsioonide sisu;
- materjalide intellektuaalomand;
- partnerluse lõppemise korral andmete säilimine;
- raamatupidamis- ja maksukäsitlus.

---

## 27. ESTA foorum, piirkonnaruumid ja teemakogukonnad

### 27.1. Kogukonnakihi põhimõte

ESTA liikmeala võib sisaldada üleriigilist professionaalset foorumit ja ametlikule liikmestaatusele tuginevaid piirkonnaruume.

ESTA kuus ametlikku piirkonda:

- Ida-Eesti;
- Kesk-Eesti;
- Lõuna-Eesti;
- Lääne-Eesti;
- Põhja-Eesti;
- Saaremaa.

Allikas: [ESTA organisatsioon ja piirkonnad](https://www.eswa.ee/organisatsioon/).

### 27.2. Üleriigiline ESTA foorum

Foorumis võivad olla:

- ESTA ametlikud teated;
- valdkonna uudised;
- küsimused kolleegidele;
- praktika ja meetodite arutelud;
- seadusemuudatuste arutelud;
- küsitlused;
- koolitused ja sündmused;
- mentorluse ja Supervisiooni info;
- piirkondade olulisemad avalikud postitused;
- koostöövõimalused.

Liige saab postitada, kommenteerida, vastata, märkida teist liiget, lisada faili või lingi, teha küsitluse, jälgida teemat, raporteerida sisu ja avada postitusest salvestamata häälvestluse.

### 27.3. Piirkonnaruum

```text
Minu piirkond
├── piirkonna uudised
├── arutelud
├── sündmused ja kalender
├── häälkohtumised
├── materjalid
├── küsitlused
├── ettepanekud ESTA juhatusele
├── mentorlus ja Supervisioon piirkonnas
└── piirkonna juhatus
```

Piirkonnaruum võimaldab korraldada teemapäevi, arutada kohalikke professionaalseid küsimusi, jagada koolitusi, otsida koostööpartnereid, teha küsitlusi, pidada häälkohtumisi ja valmistada ESTA juhatusele ettepanekuid.

### 27.4. Piirkonnaga ühendamine

```text
Kasutaja kinnitab ESTA liikmestaatuse
→ ESTA tagastab aktiivse staatuse ja piirkonna tunnuse
→ kasutaja lisatakse oma piirkonna ruumi
→ piirkonna juhatus saab vajaduse korral seose üle vaadata
```

Piirkonda ei määrata ainult kasutaja enda suvalise valiku või töökoha aadressi alusel. Muutmine toimub taotluse ja ESTA kinnituse kaudu.

### 27.5. Ligipääsutasemed

#### Kõik kontrollitud ESTA liikmed

- üldfoorum;
- ametlikud teated;
- üleriigilised küsitlused;
- teemakogukonnad;
- sündmused;
- oma piirkonna ruum.

#### Piirkonna liikmed

- piirkonna sisevestlused;
- kohalikud küsitlused;
- piirkondlikud häälkohtumised;
- tööplaani arutelud;
- kohalikud materjalid.

#### Piirkonna juhatus

- ametlikud piirkonnateated;
- sündmuste loomine;
- küsitlused;
- postituste esiletõstmine;
- modereerimine;
- ettepanekute koondamine ESTA juhatusele.

#### ESTA keskne haldur

- üldfoorumi haldus;
- piirkondade ja juhatuse rollide määramine;
- ametlikud teadaanded;
- modereerimisreeglid;
- kaebuste menetlemine;
- liikmestaatuse seose kontrollimine.

### 27.6. Üleriigilised teemakogukonnad

Võimalikud ruumid:

- laste ja perede sotsiaaltöö;
- eakate sotsiaaltöö;
- tööealised;
- puuetega inimesed;
- tervishoiu sotsiaaltöö;
- rehabilitatsioon;
- sõltuvusprobleemid;
- võlanõustamine;
- kodutus;
- kogukonnatöö;
- sotsiaalvaldkonna juhtimine;
- eetika;
- AI sotsiaaltöös;
- Tööheaolu;
- alustavad spetsialistid.

### 27.7. Postituste tüübid

- küsimus kolleegidele;
- praktika jagamine;
- arutelu;
- materjal;
- sündmus;
- küsitlus;
- ettepanek ESTA-le;
- koostööpartneri otsing;
- mentorluse küsimus;
- Supervisiooni või Kovisiooni üldteema;
- ametlik ESTA teade.

### 27.8. Konfidentsiaalne liikmeküsimus

Tundliku professionaalse küsimuse võib avaldada teistele liikmetele anonüümselt, kuid ESTA volitatud moderaator näeb väärkasutuse vältimiseks autorit. Süsteem kontrollib isikuandmeid, kasutaja kinnitab üldistamise ning postitust ei indekseerita avalikult ega kasutata avalikus teadmusbaasis.

Täielikult jälitamatu anonüümsus ei sobi professionaalsesse foorumisse, sest see takistab konfidentsiaalsusrikkumiste ja väärkasutuse menetlemist.

### 27.9. Piirkondlik häälruum

Piirkond või teemakogukond saab avada salvestamata häälruumi:

- kohvihommik;
- seadusemuudatuse arutelu;
- professionaalne küsimuste tund;
- uute liikmete kohtumine;
- tegevusplaani arutelu;
- ekspertkohtumine;
- avatud Kovisioon;
- Tööheaolu teemaring.

Häälruumis võivad olla käe tõstmine, kõnevoor, moderaator, kõrvalvestlus, päevakord, ühised märkmed ja küsitlus.

### 27.10. Piirkondliku ettepaneku teekond

```text
Liige teeb piirkonnaruumis ettepaneku
→ liikmed arutavad
→ piirkonna juhatus koostab memo
→ piirkond kinnitab seisukoha
→ ettepanek liigub ESTA juhatusele
→ ESTA avaldab vastuse või tegevuse
```

Foorumiküsitlus ei ole ametlik üldkoosoleku või piirkonna valimine. Ametlik digitaalne hääletus vajab eraldi isikutuvastust, hääleõiguse kontrolli, kvoorumit, protokolli ja põhikirjaga kooskõla.

### 27.11. Ligipääsumudel

Soovitatav mudel:

- kõik kontrollitud ESTA liikmed saavad tasuta üldfoorumi, oma piirkonna, sündmused ja küsitlused;
- tasulise SotsiaalAI paketi ja kontrollitud ESTA liikmestaatusega avanevad AI-toega professionaalsed süvatööriistad;
- iga aktiivse tasulise liikmekuu eest läheb üks euro ESTA-le.

See teeb kogukonna kättesaadavaks kogu liikmeskonnale ning jätab tasulise väärtuse professionaalsetesse tööriistadesse.

### 27.12. Esimene ESTA kogukonna MVP

1. ESTA liikmestaatuse kontroll.
2. ESTA üldfoorum.
3. Kuus ametlikku piirkonnaruumi.
4. Automaatne ühendamine kinnitatud piirkonnaga.
5. Postitused ja kommentaarid.
6. Failid ja lingid.
7. Sündmused ja osalemise märkimine.
8. Lihtsad küsitlused.
9. Piirkonna juhatuse moderaatoriroll.
10. Ametlikud ESTA teated.
11. Raporteerimine ja modereerimine.
12. Salvestamata piirkondlik häälruum.
13. Mõned üleriigilised teemakogukonnad.
14. Ettepaneku ESTA juhatusele saatmise rada.

---

## 28. Ruumilise kasutuskogemuse õhtune täpsustus 11.07.2026

See peatükk fikseerib pärast ruumilise lähtekoha loomist tehtud praktilised otsused. Need ei kirjelda veel kogu platvormi lõplikku kujundust, kuid annavad uute funktsioonide ja olemasolevate vaadete ümbertegemiseks ühise käitumisreegli.

### 28.1. Praegune katseala

Teemaseemned ja Kovisioon toimivad esimeste täisekraani töölõuendite katsealana. Nende eesmärk ei ole näidata võimalikult palju tabeleid, vorme ja juhtnuppe, vaid proovida, kuidas professionaalne töö saab toimuda ruumis paiknevate objektide ja järjest avanevate tööalade kaudu.

Praeguses rakenduses on katsetatud:

- Teemaseemne kaartide vaba liigutamist;
- kaartide suuruse muutmist paremast alanurgast;
- sama tegevuse klaviatuurialternatiive;
- kaartide esi- ja tagaplaani eristamist;
- jagatud sooja klaasimaterjali;
- täisekraani lõuendit Kovisioonis ja Teemaseemnetes;
- püsivat ruumi juhtpaneeli karusselli ja töövaadete kohal.

See on prototüüpimise alus, mitte otsus muuta iga platvormi objekt vabalt lohistatavaks.

### 28.2. Otsese liigutamise reeglid

Kui kasutaja haarab kaardi liigutamiseks, muutub see aktiivseks tööobjektiks:

- liigutatav kaart tuleb selgelt esiplaanile;
- selle z-järjekord peab olema üheselt mõistetav;
- taustale jääv kaart võib veidi taanduda või muutuda läbipaistvamaks;
- aktiivne kaart ei pea muutuma täiesti läbipaistmatuks;
- taandumine peab säilitama kaardi identiteedi ega tohi tekitada vilkumist;
- kaarti peab saama liigutada kogu tegelikult kasutatava lõuendi ulatuses, ka ülespoole;
- kaart ei tohi pärast liigutamist jääda nii, et oluline tegevus või suuruse muutmise pide muutub kättesaamatuks.

Kaardi asukoht võib olla ainult visuaalne töökorraldus või kanda sisulist tähendust. Need kaks juhtumit tuleb funktsioonis selgelt eristada. Kui asukoht muudab staatust, seost või nähtavust, peab kasutaja saama sellest enne toimingut aru.

### 28.3. Suuruse muutmine

Suuruse muutmine peab olema reaalajas nähtav ja puudutama ainult valitud kaarti. Teised sama rea kaardid ei tohi CSS-i venitusloogika tõttu kaasa kasvada.

Vajalikud piirid:

- minimaalne loetav laius ja kõrgus;
- maksimaalne suurus, mis ei kaota lõuendi kasutatavust;
- nähtav, kuid rahulik suuruse muutmise pide;
- klaviatuuriga väike ja suurem muutmissamm;
- võimalus taastada algne paigutus.

### 28.4. Läbipaistvus, loetavus ja kihid

Ruumiline sügavus ei tohi tekkida teksti loetavuse arvelt.

Kokkulepitud suund:

- aktiivne kaart jääb klaasjaks, kuid selle tekst peab olema selgelt loetav;
- kattumise korral taandub eelkõige alumine kaart;
- esiplaani kaart saab tugevama kohalolu serva, varju ja fookuse kaudu;
- väikesi pealkirju ja vahepealkirju ei kasutata ainult selleks, et rohkem infot ekraanile mahutada;
- tekst ei paikne juhuslikult ilma toetava pinna või kontrastita heleda ja tumeda tausta piiril;
- ühe funktsiooni nupud kasutavad ühist neutraalset kujunduskeelt, mitte mitut konkureerivat aktsentvärvi.

### 28.5. Püsiv ruumi juhtpaneel

Karussellivaates kasutatav ülaservast avanev juhtpaneel on ruumiülene juhtimiskiht. See koondab:

- taustaheli sisse- ja väljalülitamise;
- järgmise taustaloo;
- keele ja ligipääsetavuse;
- ruumi ooterežiimi või väljumise.

Sama komponent on kasutatav karussellis ja ruumi töövaadetes. See ei ilmu avastseeni ega esialgse sissekerimise ajal, sest seal jäävad kasutusse alumised heli juhtnupud ja „Jäta vahele”.

Täisekraani lõuendid peavad reserveerima ülaserva juhtimistsooni. Kovisiooni etapirida, Teemaseemnete navigeerimine ega muu lehe põhisisu ei tohi alata juhtpaneeli alt. Töövaadete kohalik kirjarütm võib olla tavapaneelidest veidi suurem, et professionaalne sisu oleks 16-tollisel ekraanil loetav.

### 28.6. Kiire ja avastuslik liikumine

Karussell, ruumiline liikumine ja objektidega töötamine toetavad avastamist, kuid kogenud kasutaja vajab otseteed. Karusselli täpid võivad areneda visuaalseks kiirmenüüks või ruumiindeksiks, kust saab valida sihtkoha ilma kõiki kaarte läbi kerimata.

Kiirmenüü ei tohi muutuda vana nuppude ruudustiku koopiaks. See peab näitama:

- kus kasutaja parajasti asub;
- millised ruumid või tööalad on lähedal;
- kus on pooleliolev töö või uus sündmus;
- milline sihtkoht on kasutaja rollile tegelikult kättesaadav.

### 28.7. Kontrollitud vaated

Õhtuse muudatuse järel kontrolliti Kovisiooni ja Teemaseemneid vaadetes 1920 × 1080 ning 1536 × 864. Avastseenis jäi ülemine juhtpaneel peidetuks ning alumised heli- ja vahelejätmisjuhikud säilisid. See kontroll tõendab paigutust ja nähtavust, mitte funktsioonide terviklikku äriloogikat või andmete üleandmist.

### 28.8. Kaameraga ruumitöö ja näpistusgrammatika

Sülearvuti ekraani kohal olevat kaamerat võib tulevikus kasutada vabatahtliku ruumilise sisendina. Kaamera eesmärk ei ole inimest hinnata ega salvestada, vaid võimaldada ruumi objektidega käte abil töötamist ja anda liikumisele õrn ruumiline vastus.

Eelistatud põhitoiming on pöidla ja nimetissõrme **näpistus**. Avatud peopesa ei sobi peamiseks käsuks, sest see võib minna segi vasakule või paremale viipamise, käe tõstmise või loomuliku käeliigutusega.

Ühtne näpistusgrammatika:

```text
nimetissõrm suunab ruumilist kursorit
→ näpistus algab
→ sihtobjekt lukustub ja annab valguse või servaga tagasiside
→ väike või olematu liikumine tähendab valimist
→ liikumine üle lävendi tähendab lohistamist
→ sõrmede vabastamine asetab objekti või lõpetab toimingu
```

Võimalikud kasutused:

- lühike näpistus kaardil avab või valib kaardi;
- näpistuse hoidmine ja käe liigutamine lohistab kaarti;
- kaardi nurgapideme näpistamine muudab selle suurust;
- tühja ruumi näpistamine ja külgsuunas vedamine liigutab karusselli või lõuendit;
- ülamenüü pideme näpistamine ja allapoole tõmbamine avab juhtpaneeli;
- ette- või tahapoole liikumine võib anda väga õrna perspektiivi või tuua aktiivse tööobjekti lähemale.

Eraldi vabalt õhus tehtavat vasakule või paremale viipamise käsku ei ole esimeses variandis vaja. Karussell töötab samal põhimõttel nagu puutepind: kasutaja haarab tühjast ruumist ja tõmbab seda soovitud suunas.

Eksimuste vältimiseks:

- näpistus peab püsima lühikese stabiilsusaja, näiteks 100–150 ms;
- lohistamine algab alles pärast visuaalset liikumislävendit;
- objekt näitab enne liikumist, et see on lukustunud;
- kaamera kaotatud jälgimine ei tohi objekti juhuslikult uude kohta asetada;
- jagamist, saatmist, kustutamist, kinnitamist ega muud tundlikku tegevust ei tehta ühe õhužestiga;
- tundliku tegevuse lõplik kinnitamine toimub nähtava nupu ja selge eelvaate kaudu.

Kaamerarežiimi toote- ja privaatsusreeglid:

- kaamera lülitatakse sisse ainult kasutaja teadliku valikuga;
- kaamera kasutus on alati nähtavalt tähistatud ja ühe toiminguga peatav;
- eelistatud töötlus toimub kasutaja seadmes ning videopilti ei saadeta serverisse ega salvestata;
- näo või käe geomeetriat ei kasutata isiku tuvastamiseks;
- näoilmete põhjal ei hinnata emotsiooni, stressi, tööheaolu, motivatsiooni ega usaldusväärsust;
- kaamera puudumine või keelamine ei piira funktsioonide kasutamist;
- kõigil kaameratoimingutel säilib hiire, puute ja klaviatuuri alternatiiv;
- vähendatud liikumise režiimis võib perspektiiviliikumise täielikult välja lülitada.

Esimene sobiv prototüüp on Teemaseemnete eraldi katserežiim:

1. nähtav rahulik sõrmekursor;
2. kaardi näpistamisega valimine;
3. näpistades kaardi lohistamine;
4. nurgapideme abil suuruse muutmine;
5. tühja tausta näpistades lõuendi või karusselli liigutamine;
6. hiire ja klaviatuuriga sama tegevuse paralleelne kontroll.

Tehniline alus võib kasutada brauseri `getUserMedia()` kaameraluba ning seadmes töötavat näo- ja käepunktide tuvastust. Tavakaamera pilgusuuna hinnang sobib kõige rohkem ligikaudse fookuse või valgusvihje jaoks, mitte täpseks valimiseks või kinnitamiseks.

Lähtekohad:

- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Google MediaPipe Vision API](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision)
- [Brown University WebGazer](https://webgazer.cs.brown.edu/)

### 28.9. Lokaalne mudelikiht

SotsiaalAI võib interaktiivsuse jaoks kasutada välise minutipõhise AI-API asemel brauseris, kasutaja seadmes või SotsiaalAI enda serveris töötavaid mudeleid. Täielik tehnoloogiakaart, piirid ja prototüüpimise järjekord on dokumendis [SotsiaalAI lokaalsed mudelid ja multimodaalne interaktiivsus](./lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md).

Soovitatud lokaalne kiht:

```text
MediaPipe
├── käepunktid ja näpistus
└── pea asend ja parallaks

Silero VAD
└── kõne algus ja lõpp

Whisper
└── eestikeelne transkript

väike käsuklassifikaator
└── transkript + aktiivne objekt → ruumiline toiming

Tesseract est
└── eestikeelne OCR

Presidio + Eesti reeglid
└── isikuandmete toetav eelkontroll
```

Kohalik mudel on eelkõige sisendi töötleja ja soovituskiht. See ei asenda kontrollitud teadmusbaasi, allikapõhist vastust ega inimese otsust.

Lokaalse lahenduse kulureegel:

- välise API kasutustasu võib puududa;
- kasutaja seadme või SotsiaalAI serveri arvutuskulu jääb;
- mudeli litsents, allikas ja versioon dokumenteeritakse;
- eestikeelset kvaliteeti hinnatakse oma testkorpusega;
- nõrgema seadme jaoks säilib mudelita põhifunktsioon.

### 28.10. SotsiaalAI häälvestlus

Praegune häälsisestus jääb kontrollitud dikteerimisrežiimiks: kasutaja räägib teksti sisestusvälja, kontrollib tulemust ja vajutab saatmist. Selle kõrvale tuleb kavandada eraldi **häälvestluse režiim**, mis seob olemasolevad osad üheks loomulikuks vestluseks:

```text
kõne
→ automaatne eestikeelne transkript
→ automaatne saatmine pärast kõnevooru lõppu
→ olemasolev RAG ja kontrollitud teadmusbaas
→ tekstivastus koos allikatega
→ automaatne ettelugemine
→ uus kõnevoor
```

Esimeses versioonis ei ole vaja olemasolevat RAG-vestlust ümber ehitada. Lisatakse häälvestluse sessioonikiht, mis juhib mikrofoni, VAD-i, automaatset saatmist, vastuse voogedastust, kõnesünteesi ja vahelerääkimist. Kasutaja näeb olekuid „Kuulan”, „Otsin allikatest”, „Vastan” ja „Peatatud” ning saab alati minna tagasi tekstivestlusse.

Allikad kuvatakse ekraanil, mitte ei loeta URL-idena ette. Hääl ei kinnita tundlikke toiminguid ning toorheli ei säilitata vaikimisi.

Hilisem katse võib kasutada otsest speech-to-speech reaalajaagenti. Sel juhul on SotsiaalAI RAG serveripoolne tööriist, mida agent peab kontrollitud sotsiaalvaldkonna vastuse saamiseks kasutama. Tehniline detail ja arendusjärjekord on dokumendis [SotsiaalAI lokaalsed mudelid ja multimodaalne interaktiivsus](./lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md).

---

## 29. Funktsioonide ühendamise otsustusreegel

SotsiaalAI funktsioonid peavad olema iseseisvalt praktilised, kuid vajaduse korral üksteist täiendavad. Ühendus ei tähenda kohustuslikku rada ega automaatset andmete liikumist.

Iga funktsioonidevaheline ühendus peab vastama kuuele küsimusele:

1. Milline konkreetne tööobjekt või tulemus liigub?
2. Kes algatab üleandmise?
3. Mida kasutaja enne kinnitamist eelvaates näeb?
4. Kas liigub koopia, viide või uus üldistatud mustand?
5. Kes näeb tulemust sihtfunktsioonis?
6. Kas algne privaatne sisu jääb lähtekohta eraldi alles?

Soovitatud üldmuster:

```text
funktsioon annab iseseisva tulemuse
→ süsteem võib pakkuda sobivat järgmist võimalust
→ kasutaja valib, kas jätkata
→ süsteem näitab üleantavat sisu ja sihtkohta
→ kasutaja kinnitab
→ sihtfunktsioon saab minimaalse vajaliku objekti või viite
```

Keelatud vaikemustrid:

- kõik funktsioonid tuleb läbida järjekorras 1–10;
- kogu lähtefunktsiooni sisu kopeeritakse järgmisse moodulisse;
- privaatne refleksioon muutub automaatselt jagatud või ametlikuks kirjeks;
- ühe funktsiooni nupp lubab ühendust, mida API või vastuvõtva rolli vaade tegelikult ei toeta;
- sama ametlik klient, juhtumiplaan või teenuseinfo elab mitmes aktiivses põhiandmebaasis.

Fable 5 ülesanne on kontrollida, millised sellised ühendused on aktiivses koodis päriselt olemas ja millised on praegu ainult tekst, nupp või tulevikuidee.
