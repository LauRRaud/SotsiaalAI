# SotsiaalAI funktsioonide ja UX-i kaardistus

Seis: visuaalne läbivaatus ja õhtune ruumilise UI kontroll 11.07.2026  
Kaardistuse liik: praeguse töötava rakenduse kontroll  
Põhivaated: 1920 × 1080 ning 1536 × 864  

> **Uus lähtekoht alates 11.07.2026:** SotsiaalAI siht ei ole tavapärane lehtede ja vormide süsteem, vaid ruumiline digitaalne keskkond. Käesolev dokument jääb praeguse töötava rakenduse vaatlusena alles, kuid siin kirjeldatud tavapärased lehe- ja töövooparandused ei määra enam tulevase lahenduse vormi. Edasine ümbermõtestamine lähtub dokumendist [SotsiaalAI ruumilise kogemuse lähtekoht](./ruumilise-kogemuse-lahtekoht.md).

Praeguse kaardistuse tähelepanekuid kasutatakse selleks, et tuvastada infokoormus, ebaselged tegevused, katkised ühendused ja kasutaja vajadused. Lahendus võib olla ruum, muutuv stuudio, lennuteekond, otseselt kasutatav lõuend või nende kombinatsioon — mitte tingimata parandatud tavaleht.

Fable 5 platvormiloogika ülevaatuse täpne lähteülesanne on failis [fable-5-platvormi-loogika-brief.md](./fable-5-platvormi-loogika-brief.md). See kaardistus on abimaterjal, mitte aktiivse koodi asendaja.

## Kaardistuse põhimõtted

See dokument põhineb praeguse lokaalse rakenduse visuaalsel ja interaktiivsel kontrollil. Varasemaid auditifaile ei kasutata funktsioonide valmiduse tõendina.

Iga funktsiooni hinnatakse eraldi järgmiste vaadete kaudu:

1. kas kasutaja leiab funktsiooni üles;
2. kas funktsiooni eesmärk on esimesel ekraanil arusaadav;
3. kas kasutaja saab tegevust alustada ilma üleliigse koormuseta;
4. kas töövoog jaguneb jõukohasteks sammudeks;
5. kas funktsioon annab iseseisvalt kasuliku tulemuse;
6. kas järgmised võimalused on soovituslikud, mitte kohustuslikud;
7. kas kasutaja saab valida, milline info liigub järgmisse funktsiooni;
8. kas roll, nähtavus ja jagamine on arusaadavad;
9. kas töövoogu saab pooleli jätta ja hiljem jätkata;
10. kas vaade töötab 16-tollise Full HD ekraani tavapärases kasutuses.

Valmiduse tähised:

- **Avaneb:** vaade laadub ja põhisisu on nähtav.
- **Töövoo alus nähtav:** kasutaja saab tegevust alustada, kuid tulemust ei ole veel lõpuni kontrollitud.
- **Visuaalselt probleemne:** funktsioon on olemas, kuid paigutus või infokoormus takistab kasutamist.
- **Lõpuni kontrollimata:** salvestamist, saatmist, teise rollini jõudmist või muud lõpptulemust ei ole veel tõendatud.
- **Läbitud:** kogu kasutusolukord on eri rollidega algusest lõpuni kontrollitud.

Ükski funktsioon ei saa esimeses ringis tähist **Läbitud**, sest kontrollis ei saadetud vorme, loodud pöördumisi, avaldatud kuulutusi ega jagatud materjale.

## Toote põhimudel

SotsiaalAI ei peaks olema kohustuslik järjestus, kus kasutaja läbib funktsioonid 1–10. Sobiv mudel on vabalt valitavate moodulite võrgustik:

```text
vajadus
  -> kasutaja valitud funktsioon
  -> iseseisev praktiline tulemus
  -> soovi korral soovitatud järgmine võimalus
  -> kasutaja kontrollitud info üleandmine
```

Ühendus tähendab võimalust, mitte kohustust. Kasutaja peab saama funktsiooni avada otse ning kasutada seda ka ilma Teekonda või vestlust läbimata.

## Rollid ja peamised kasutusolukorrad

### Eluküsimusega pöörduja

Peamised olukorrad:

- soovin lihtsalt vastust või selgitust;
- soovin aru saada, millest alustada;
- soovin leida teenuse või kontakti;
- soovin valmistada ette eelpöördumise;
- soovin mõista või koostada dokumenti;
- soovin esitada abisoovi;
- soovin enda samme privaatselt koos hoida.

Pöörduja vaade peab olema rahulik, juhendatud ja vaba asutusesüsteemi tunnetusest. Üks töövoog ei sobi kõigile ning Teekond ei tohi olla teiste funktsioonide eeltingimus.

### Sotsiaaltöö spetsialist

Peamised olukorrad:

- vaatan saabunud eelpöördumisi;
- valmistun vastuvõtuks või klienditööks;
- koostan või korrastan dokumente;
- arutan juhtumit kovisioonis;
- kasutan privaatset tööheaolu tuge;
- esitan teadmusbaasi täiendava materjali;
- leian Teenusekaardilt kontakti või koostööpartneri.

Spetsialisti vaade peab vähendama kordamist ja tooma esile praeguse tööülesande, mitte näitama kõiki platvormi võimalusi võrdse kaaluga.

### Teenuseosutaja

Peamised olukorrad:

- loon või täiendan teenuseprofiili;
- muudan teenuse Teenusekaardil leitavaks;
- määran pöördumiste vastuvõtuviisid;
- vaatan saabunud eelpöördumisi;
- osalen ühises ruumis;
- avaldan abipakkumise.

Teenuseosutaja esmane seadistus ja igapäevane haldamine peaksid olema kaks erinevat kogemust. Praegune teenuseprofiil ühendab need üheks pikaks vormiks.

## Visuaalselt kontrollitud funktsioonid

### Avaleht ja sisenemine

Seis:

- avaleht avaneb;
- enne põhitegevust kuvatakse jutustav sissejuhatus;
- nähtavad on „Jäta vahele”, „Sisenen” ja põhimenüü;
- „Sisenen” võib sissejuhatuse alguses olla keelatud;
- sisselogitud kasutaja näeb ruumipõhist karussellmenüüd.

Tähelepanekud:

- kasutaja peab enne töövahenditeni jõudmist mõistma mitut järjestikust visuaalset kihti;
- ruumiline kujundus on eristuv, kuid funktsiooni leidmine sõltub karusselli mõistmisest;
- avaleht ei küsi esmalt, mida kasutaja teha soovib;
- otsene „alusta vestlust”, „leia abi” või „ava töölaud” võiks olla kiiremini nähtav.

Staatus: **Avaneb, sisenemisloogika vajab lihtsustamist.**

### Rollipõhine Töölaud

Sotsiaaltöö spetsialisti aktiivses vaates olid nähtavad:

- Teekond;
- Teenusekaart;
- Abisoovid;
- Abipakkumised;
- Dokumendid;
- Koosta dokument;
- Pöördumised;
- Lisa inimene;
- Kovisioon;
- Tööheaolu;
- Materjalid.

Tähelepanekud:

- funktsioonid asuvad ühes horisontaalses karussellis;
- korraga on nähtavad ligikaudu viis kaarti, äärmised osaliselt;
- kaardil on peamiselt ikoon ja nimetus, mitte kasutusolukord või oodatav tulemus;
- funktsioonide rühmitus puudub;
- töölaud on pigem funktsioonikataloog kui „mida mul on vaja täna teha?” töövaade;
- Teekonna, dokumentide, professionaalse toe ja koostööfunktsioonide kaal on visuaalselt sarnane.

Vajalik suund:

- rolli põhiülesanded;
- pooleliolevad tegevused;
- tähelepanu vajavad sündmused;
- kiirtoimingud;
- ülejäänud tööriistad rühmitatult.

Staatus: **Avaneb, kuid informatsiooniarhitektuur vajab rollipõhist ümberkorraldust.**

### Vestlusaken

Seis:

- vestlus avaneb;
- algussõnum selgitab, et tavaküsimuse saab kirjutada otse;
- nähtavad on dikteerimine, saatmine, ettelugemine ja kopeerimine;
- tööriistamenüüs on Abisoov, Abipakkumine, Süvauuring ja Dokumendi analüüs;
- Abisoovi režiim avas ühe lihtsa juhise ja vabatekstivälja.

Hea muster:

- kasutaja saab alustada oma sõnadega;
- funktsiooni alguses ei näidata pikka vormi;
- aktiivne režiim on nähtav ja lõpetatav.

Kontrollimata:

- vastuse allikad;
- privaatsuse eelkontroll;
- kriisisuunamine;
- dikteerimine;
- tavavestluse üleminek Teekonda või eelpöördumisse;
- Abisoovi kogu koostamis- ja avaldamisvoog.

Staatus: **Töövoo alus nähtav; sobib teiste funktsioonide UX-mustri lähtekohaks.**

### Teekond

Seis:

- pöörduja vaates avaneb „Alusta teekonda”;
- järgmises vaates kuvatakse üks vabatekstiväli;
- juhis lubab olukorda kirjeldada oma sõnadega;
- näidistekst aitab alustamist.

Tähelepanekud:

- algus on lihtsam kui enamikus teistes moodulites;
- Full HD vaates kasutatakse ekraani sisust vähe;
- pealkiri ja osa tekstist võivad paikneda tumeda tausta peal;
- järgmisi etappe ja tulemust ei ole veel kontrollitud.

Ühendus:

- eelpöördumise algusvaates on Teekonnast jätkamise valik;
- valik on ilma konkreetse Teekonnata keelatud ja selgitab, et jätkamine algab Teekonna detailist.

Staatus: **Töövoo alus nähtav, lõpuni kontrollimata.**

### Eelpöördumine — pöörduja

Algusvalikud:

- „Aita mul leida, kelle poole pöörduda”;
- „Mul on kontakt juba olemas”;
- „Jätkan Teekonnast”.

Hea:

- kasutajal on mitu algusviisi;
- Teekond ei ole kohustuslik;
- tekst rõhutab, et eelpöördumine ei ole ametlik hindamine ega otsus.

Probleemid 1920 × 1080 vaates:

- juhendatud töövoog näitab korraga viit sammu, eelinfo ülevaadet, kolme kaardistusviisi, edasiliikumise nuppe ja vestlusala;
- sammude nimetused sulavad visuaalselt kokku;
- esimese otsuse kõrval kuvatakse liiga palju hilisemaid etappe.

Probleemid 1536 × 864 vaates:

- alguskaartide pealkirjad ja kirjeldused jooksevad visuaalselt kokku;
- juhendatud vaates täidab eelinfo ülevaade suure osa esimesest ekraanist;
- peamine tegevus jääb allapoole nähtavat ala;
- kasutaja näeb enne tegutsemist süsteemi struktuuri, mitte enda esimest väikest sammu.

Vajalik suund:

1. vali alustamisviis;
2. kirjelda olukorda;
3. vasta ainult vajalikele täpsustustele;
4. vaata eelinfo eraldi üle;
5. vali adressaat;
6. kinnita jagatav sisu ja saatmine.

Staatus: **Funktsionaalne alus olemas, visuaalselt probleemne, lõpuni kontrollimata.**

### Eelpöördumine — sotsiaaltöö spetsialist

Seis:

- nähtav on platvormil eelpöördumiste vastuvõtmise valik;
- nähtav on saabunud eelpöördumiste ala;
- testkontol ei olnud saabunud pöördumisi;
- vastuvõtu seadistust ei salvestatud.

Tähelepanekud:

- vaade on lihtne, kui andmeid ei ole;
- vastuvõtu seadistus ja igapäevane saabunud töö asuvad samal lehel;
- päris pöördumise kaarti, prioriteeti, olekut ja tegevusi ei ole veel kontrollitud.

Staatus: **Vastuvõtuvaade avaneb, rollidevaheline voog kontrollimata.**

### Eelpöördumine — teenuseosutaja

Seis:

- vaade selgitab, et vastuvõtukanalid määratakse teenuseprofiilis;
- nähtav on saabunud eelpöördumiste ala;
- testkontol ei olnud saabunud pöördumisi.

Staatus: **Vastuvõtuvaade avaneb, teenuseprofiili ja eelpöördumise ühendus lõpuni kontrollimata.**

### Abisoovid ja abipakkumised

Seis:

- Abisoovide töölaud/loend avaneb;
- tühjas olekus kuvatakse „Aktiivseid abisoove veel ei ole”;
- uue abisoovi alustamise nuppu tühjas olekus ei ole;
- uue abisoovi algus asub vestluse tööriistamenüüs;
- Abisoovi vestlusrežiim algab lihtsa vabatekstijuhisega.

Peamine katkestus:

- töölaud näitab tulemust, kuid ei suuna kasutajat tegevust looma;
- kasutaja peab teadma, et uus abisoov algab vestluse plussmenüüst.

Vajalik ühendus:

- tühjas olekus „Koosta abisoov”;
- olemasoleva loendi juures „Uus abisoov”;
- pärast avaldamist selge staatus, sobitused ja ruumi avamise võimalus.

Kontrollimata:

- mustandi koostamine;
- privaatsuskontroll;
- avaldamine;
- Teenusekaardil kuvamine;
- sobitamine;
- sobituse põhjal ruumi loomine.

Staatus: **Algus ja loend eraldi olemas, nendevaheline UX-ühendus nõrk, lõppvoog kontrollimata.**

### Vestlusruumid

Seis:

- Ruumide vaade avaneb;
- testkontol ruume ei olnud;
- tühjas olekus kuvatakse juhis „Grupivestluse jaoks lisa vestlusesse inimene”.

Probleem:

- tühjas olekus ei ole otsest nuppu inimese lisamiseks või ruumi loomiseks;
- kasutaja peab ise teadma, kust „Lisa inimene” leida;
- tegelikku ruumi, sõnumeid, kutseid ega helikõnet ei ole kontrollitud.

Staatus: **Tühi ülevaade avaneb, põhitöövoog kontrollimata.**

### Teenusekaart

Seis:

- kaart laadub;
- nähtavad on märksõna ja piirkonna otsing;
- liikideks saab valida KOV-i, teenused ning abisoovid ja pakkumised;
- kaart kasutab suurt tööala ja sobib Full HD vaatesse paremini kui kitsad vormipaneelid.

Tähelepanek:

- URL-is pöörduja eelvaadet taotledes näitas rollivalik ühes kontrollis endiselt sotsiaaltöö spetsialisti aktiivsena;
- vaja kontrollida, kas see on admini eelvaate eripära või rolliseisundi viga.

Kontrollimata:

- otsingu tulemus;
- markeri detail;
- kontaktivõtt;
- Teekonna kontekst;
- Teenusekaardilt eelpöördumisse või ruumi liikumine.

Staatus: **Avaneb ja kaart laadub, tegevusvood kontrollimata.**

### Teenuseprofiil

Seis:

- põhainfo väljad on olemas;
- lisada saab teenuseid ja teeninduskohti;
- määrata saab eelpöördumise kanalid;
- määrata saab Teenusekaardi ja assistendi nähtavuse;
- kuvatakse avaldamise kontrollnimekiri.

Probleem:

- kõik teemad on ühel pikal keritaval vormil;
- esmane seadistus ja hilisem haldamine ei ole eristatud;
- kasutajale näidatakse enne põhivaliku lõpetamist kõiki avaldamise tingimusi;
- 16-tollisel ekraanil on korraga nähtav ainult väike osa vormist.

Vajalik suund:

1. organisatsiooni põhiseadistus;
2. esimese teenuse lisamine;
3. teeninduskoht või tegevuspiirkond;
4. kontakt ja pöördumise viis;
5. eelvaade;
6. avaldamine;
7. hilisem haldusvaade teenuste ja asukohtade kaupa.

Staatus: **Funktsionaalne vorm olemas, UX vajab etapiviisilist ümberkujundamist.**

### Dokumendid

Ühes vaates paiknevad:

- faili üleslaadimine;
- dokumendi liigi määramine;
- dokumentide loend ja filtrid;
- dokumentide valimine koostamiseks;
- agendi tulemused.

Probleem:

- kasutaja näeb korraga mitut erinevat ülesannet;
- üleslaadimine domineerib ka siis, kui kasutaja soovib ainult olemasolevat faili leida;
- filtrite hulgas on palju tehnilisi dokumendiliike;
- loend ja agendi tulemused jäävad pika lehe alumisse ossa.

Vajalik suund:

- eraldi kiirtoimingud „Laadi üles”, „Analüüsi”, „Koosta dokument”;
- põhivaates failide ja pooleliolevate tulemuste ülevaade;
- kontekstipõhised filtrid, mitte kõik liigid korraga.

Staatus: **Avaneb, faili- ja tulemuste töövood kontrollimata, UX liiga koondatud.**

### Dokumendi koostamine

Ühes vaates paiknevad:

- mall;
- väljundi tüüp;
- helifaili/transkriptsiooni töövoog;
- vastuse sihtrühm;
- toon, keel ja pikkus;
- valitud dokumendid;
- agendivestlus;
- praegune mustand.

Leitud probleemid:

- valikuid on enne esimese juhise andmist liiga palju;
- „Juhtumikokkuvõte” kuvatakse väljundi tüüpides kaks korda;
- helifaili töövoog on nähtav ka siis, kui kasutaja ei ole helifaili valinud;
- uuele lehele liikumisel säilis vähemalt ühes kontrollis eelmine kerimisasend ja pealkiri jäi ekraani ülaservast ära lõigatuks;
- koostamist ei saa alustada ilma Dokumentidest valitud failita, kuigi avalik kirjeldus võib jätta mulje, et piisab vajaduse kirjeldamisest.

Vajalik suund:

1. „Mida soovid koostada?”;
2. „Millest lähtume?” — kirjeldus, fail, mall, helifail või muu funktsiooni väljund;
3. vajalikud vormistusvalikud;
4. agendivestlus;
5. mustandi ülevaatus;
6. kinnitamine ja salvestamine.

Staatus: **Töövoo komponendid olemas, visuaalselt ja sisuliselt ülekoormatud, tulemus kontrollimata.**

### Kovisioon

Seis:

- avaneb täisekraanivaates;
- nähtav on kaheksaetapiline protsess;
- nähtavad on osalejad, rollid, juhtum, kokkulepped, sessiooni seaded ja juhtnupud;
- kontrollis kasutati demoandmetega sessiooni.

1920 × 1080 tähelepanekud:

- korraga on liiga palju protsessiinfot;
- parempoolne alustamise ala oli osaliselt ekraani servas;
- vasaku külje tekst oli taustal nõrga kontrastiga;
- peamine järgmine tegevus konkureerib paljude kontrollide ja staatustega.

1536 × 864 tähelepanekud:

- kolm põhiala mahuvad ekraanile, kuid tekst muutub väikeseks;
- vasakul ja paremal on eraldi keritavad alad;
- kogu kaheksaetapiline rida võtab märkimisväärse osa kõrgusest;
- kasutaja peab jälgima korraga osalejaid, juhtumit, kokkuleppeid ja seadeid.

Vajalik suund:

- igas etapis üks peamine tööala;
- osalejate ja seadete kokkuvõte vajadusel avatavas külgpaneelis;
- etappide rida kompaktsemaks;
- peamine tegevus alati selgelt nähtav;
- demo ja päris sessiooni eristus selgemaks.

Kontrollimata:

- sessiooni loomine;
- osalejate kutsumine;
- eri rollide valmisolek;
- etappide läbimine;
- helikõne;
- kokkuvõte ja praktika salvestamine.

Staatus: **Mahukas kasutajaliides olemas, päris koostöövoog kontrollimata, UX vajab fookuse vähendamist.**

### Tööheaolu

Avavaates on kümme võrdse kaaluga tööriista:

- Kiirkontroll;
- Ülevaade;
- Raske juhtum;
- Töövägivald;
- Taastumine;
- Tööpiirid;
- Katkestused;
- Tööprotsessid;
- Rollipiirid;
- Alustaja tugi.

Tähelepanekud:

- Full HD vaates on korraga nähtavad ligikaudu kuus kaarti;
- kaardid näitavad peamiselt teema nime, mitte olukorda, milles neid kasutada;
- kasutaja peab ise teadma, milline tööriist sobib;
- privaatsuse põhimõte ei ole avavaates esile toodud.

Kiirkontrolli vaade näitab korraga:

- kuut töö nõudmise valikut;
- viit tööressursi valikut;
- kolme riskimärki;
- praktilist väljundit;
- salvestamist;
- toe küsimise valikuid.

Probleem:

- „kiirkontroll” mõjub pika küsimustikuna;
- kasutaja näeb tulemust enne, kui on teadlikult vastanud;
- vaikimisi valitud keskmised väärtused annavad kohe kollase signaali;
- väljund ja järgmised funktsioonid asuvad samal pikal lehel.

Vajalik suund:

1. „Mis tõi sind täna siia?”;
2. sobiva tööriista soovitus;
3. 2–4 küsimust korraga;
4. eraldi kokkuvõte;
5. üks soovitatud järgmine väike samm;
6. valik jätta privaatseks või koostada kasutaja kontrollitud jagatav mustand.

Staatus: **Sisuline tööriistakomplekt olemas, UX küsimustikupõhine, salvestamine kontrollimata.**

### Materjalid

Seis:

- kasutaja saab valida faili;
- lisada saab lühikese selgituse;
- olemas on „Saada materjal”.

Puuduv või kontrollimata:

- toetatud failivormide ja piirangute selgitus põhivaates;
- ülevaatuse protsessi selgitus;
- kasutaja varasemate esitatud materjalide loend;
- olek „saadetud / ülevaatusel / vastu võetud / tagasi lükatud”;
- jõudmine teadmusbaasi.

Staatus: **Lihtne saatmisvorm avaneb, kogu materjali elutsükkel kontrollimata.**

## 11.07.2026 õhtune ruumilise UI kontroll

Pärast esimest kaardistust muudeti Kovisiooni ja Teemaseemnete esitlust ning ruumiülest navigeerimist. Need muudatused on aktiivses rakenduses visuaalselt kontrollitud, kuid ei tõenda veel funktsioonide andmevoogude või äriloogika valmidust.

### Teemaseemnete lõuend

- seemnekaarte saab liigutada kuue punktiga pidemest;
- valitud kaardi suurust saab muuta paremast alanurgast;
- liigutatav kaart tõuseb esiplaanile;
- kattumisel taandub alumine kaart, aktiivne kaart jääb klaasjaks;
- iga kaart hoiab oma suurust ega venita teisi sama rea kaarte;
- liigutamisel ja suuruse muutmisel on klaviatuurialternatiivid;
- paigutuse saab algseisu taastada;
- pealkirju, vahepealkirju ja kaarditeksti suurendati;
- kaartide ja nuppude toon viidi karusselliga samasse neutraalsesse sooja kujunduskeelde.

### Kovisiooni ja Teemaseemnete täisekraani töövaade

- mõlemad avanevad täisekraani lõuendina, mitte väikese keskse paneelina;
- sisu kohal on ruumiülese juhtpaneeli jaoks reserveeritud ohutu tsoon;
- kohalikku väikest ja mikro-kirja suurendati mõõdukalt;
- põhisisu algab ekraani ülaservast allpool;
- 1536 × 864 vaates mahub Kovisiooni alumine juhtimisala vaatesse;
- Teemaseemnete kaardiala jääb oma keritavasse tööpiirkonda.

### Ruumiülene ülemine juhtpaneel

- sama juhtpaneel töötab karussellis ja alalehtedel;
- see sisaldab heli, järgmise loo, ligipääsetavuse ja ooterežiimi toiminguid;
- alalehtedel paikneb see põhisisust kõrgemal eraldi kihis;
- suletud juhtpaneeli hover-ala vähendati, et see ei blokeeriks navigeerimist;
- avastseenis on juhtpaneel peidetud;
- avastseeni alumised heli- ja „Jäta vahele” juhikud säilisid.

Kontrollitud vaated: **1920 × 1080 ja 1536 × 864**. Brauserikonsoolis ei ilmnenud kontrolli ajal uusi vigu.

### Mida see kontroll ei tõenda

- Teemaseemne salvestamist püsivasse andmebaasi;
- seemne üleandmist Kovisiooni teisele kasutajale;
- Kovisiooni kõigi kaheksa etapi andmete säilimist ja rollidevahelist sünkroonsust;
- juhtpaneeli kõigi toimingute täielikku regressioonikaitset kõigil marsruutidel;
- kaartide paigutuse püsivat säilimist eri seadmete vahel.

## Praegu nähtavad funktsioonidevahelised seosed

| Lähtekoht | Järgmine funktsioon | Praegune nähtavus | Kontrolli seis |
|---|---|---|---|
| Vestlus | Abisoov | Tööriistamenüü | Algus avaneb |
| Vestlus | Abipakkumine | Tööriistamenüü | Veel avamata |
| Vestlus | Süvauuring | Tööriistamenüü | Veel avamata |
| Vestlus | Dokumendi analüüs | Tööriistamenüü | Veel avamata |
| Teekond | Eelpöördumine | Eelpöördumise algusviis viitab konkreetsele Teekonnale | Üleandmine kontrollimata |
| Eelpöördumine | Spetsialisti vastuvõtt | Eri rollivaated olemas | Saatmine ja vastuvõtt kontrollimata |
| Eelpöördumine | Teenuseosutaja vastuvõtt | Eri rollivaade olemas | Saatmine ja vastuvõtt kontrollimata |
| Dokumendid | Dokumendi koostamine | Valik ja nupp olemas | Ilma testfailita kontrollimata |
| Tööheaolu | Kovisioon | Kiirkontrollis kovisiooni sisendi valik | Mustand ja vastuvõtt kontrollimata |
| Abisoov | Loend | Vestlusrežiim ja eraldi loend olemas | Avaldamine kontrollimata |
| Abisoov + abipakkumine | Ruum | Avalikus kirjelduses lubatud | Sobitamine kontrollimata |
| Ruumid | Lisa inimene | Tühi olek annab tekstilise juhise | Otsene tegevus puudub |
| Teenuseprofiil | Teenusekaart | Avaldamise valikud ja kontrollnimekiri olemas | Avaldamine kontrollimata |

## Kõrge prioriteediga UX-probleemid

### 1. Eelpöördumise 1536 × 864 paigutus

Alguskaartide tekst ja viie sammu navigeerimine jooksevad kokku. Juhendatud töövoo põhitegevus jääb eelinfo ploki alla. See mõjutab otseselt 16-tollise Full HD sülearvuti tavakasutust.

### 2. Liiga palju samaaegset infot

Kõige selgemalt nähtav:

- eelpöördumise juhendatud vaates;
- dokumendi koostamises;
- tööheaolu Kiirkontrollis;
- kovisiooni alustamisetapis;
- teenuseprofiilis.

Õhtune seis: **Kovisiooni ja Teemaseemnete ülaserva paigutust parandati ning kirjarütmi suurendati; sisuline infokoormus vajab endiselt etappide kaupa ümbermõtestamist.**

### 3. Tühjad olekud ei paku tegevust

Näited:

- Abisoovid: puudub „Koosta abisoov”;
- Ruumid: puudub „Lisa inimene” või „Loo ruum”;
- saabunud eelpöördumised: järgmist sammu ei saa hinnata, kui loend on tühi.

### 4. Töölaud on pikk horisontaalne funktsioonikataloog

Funktsioonid ei ole jaotatud rolli eesmärkide või kasutusolukordade järgi. Pooleliolevad tegevused ja tähelepanu vajavad sündmused ei ole esimesel ekraanil eristatavad.

Õhtune seis: **karussell on teadlik ruumiline navigatsioonisuund, kuid vajab kiiret ruumiindeksit ning rollipõhist prioriseerimist. Pelgalt karusselli olemasolu ei lahenda poolelioleva töö nähtavust.**

### 5. Kerimisasendi ja lehe alguse probleem

Dokumendi koostamise vaade avanes vähemalt ühes kontrollis varasema kerimisasendiga ning pealkiri oli ekraanilt osaliselt väljas. Iga uue töövahendi avamisel peab kasutaja jõudma selle selgesse alguspunkti.

### 6. Läbipaistvad pinnad ja taustakontrast

Mitmes vaates liigub tekst üle heleda ja tumeda taustapildi. Sama tekst võib seetõttu olla ühes kohas loetav ja teises nõrk. Eriti mõjutab see kovisiooni külgpaneele ja kitsaid vormivaateid.

Õhtune seis: **Teemaseemnete kaartide pinda, kihistust ja kirjasuurusi parandati ning Kovisiooni põhipaneelid viidi samasse sooja neutraalsesse tooni. Probleem ei ole veel kogu platvormi ulatuses lahendatud.**

### 7. Üleminekute ajal ajutiselt tühi või poolik vaade

Mitmes vaates ilmus sisu pärast 0,4–1,2 sekundit. Ülemineku ajal oli näha tühi paneel, laadimistekst või osaline sõnum. Vaja on ühtset laadimisolekut, mis säilitab paigutuse.

## Head mustrid, mida säilitada ja laiendada

- Vestluse ja Teekonna algus lubavad kasutajal kirjutada oma sõnadega.
- Eelpöördumisel on mitu algusviisi, mitte üks kohustuslik rada.
- Teekonnast jätkamine ei ole ilma kasutaja valikuta automaatne.
- Tööheaolu tekst rõhutab privaatsust ja seda, et midagi ei saadeta automaatselt.
- Teenuseprofiil kuvab enne avaldamist kontrollnimekirja.
- Teenusekaart kasutab laia vaadet ja eristab kirjetüüpe.
- Aktiivse vestlusrežiimi saab lõpetada.

## Järgmine kontrolliring

Järgmises ringis tuleb kasutada ainult sünteetilisi testandmeid ja kontrollida järgmised terviklikud olukorrad:

1. pöörduja loob Teekonna, vaatab kokkuvõtte üle ja jätkab eelpöördumisse;
2. pöörduja koostab eelpöördumise, kinnitab jagatava info ja saadab selle;
3. sotsiaaltöötaja võtab sama pöördumise vastu, muudab olekut ja avab vajadusel ruumi;
4. teenuseosutaja loob minimaalse profiili ja kontrollib Teenusekaardil kuvamist;
5. kasutaja koostab abisoovi, avaldab selle ning kontrollib loendit ja Teenusekaarti;
6. abisoov ja abipakkumine sobitatakse ning osapooled jõuavad ruumi;
7. kasutaja laadib üles sünteetilise faili, analüüsib selle ja koostab mustandi;
8. töötaja täidab Kiirkontrolli, salvestab privaatselt ja koostab kovisiooni sisendi;
9. kaks testkasutajat läbivad kovisiooni või ruumi kutse- ja häälvestluse põhivoo;
10. kõik põhivaated kontrollitakse uuesti 1920 × 1080 ja 1536 × 864 vaates.

Vormi saatmine, andmete salvestamine, kuulutuse avaldamine, kutse saatmine ja ruumi loomine tekitavad lokaalses testandmebaasis uusi kirjeid. Need sammud tehakse eraldi testandmetega ning kontrolli järel dokumenteeritakse, millised testkirjed loodi ja kas need kustutati.
