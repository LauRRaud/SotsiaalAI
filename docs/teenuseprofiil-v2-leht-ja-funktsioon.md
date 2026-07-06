# Teenuseprofiil v2: leht ja funktsioon

## Lühikirjeldus

Teenuseprofiil on teenuseosutaja andmete sisestamise ja haldamise töövaade.

Selle eesmärk ei ole olla ainult avalik iluleht. Teenuseprofiil on SotsiaalAI andmeallikas, mille põhjal saavad töötada:

- Teenusekaart;
- eelpöördumise adressaadi valik;
- teenuseosutaja nähtavus ja kontaktivõimalused;
- assistendi/RAG teadmuskihi soovitused;
- hilisem teenusepõhine suunamine.

Teenuseprofiili täidab teenuseosutaja või rollipõhiselt lubatud kasutaja. Avalikus vaates, Teenusekaardil ja assistendi soovitustes kasutatakse ainult neid andmeid, mis on avaldamiseks sobivad.

## Põhimõte

Teenuseprofiil peab eristama organisatsiooni üldandmeid ja konkreetseid teenuseid.

Organisatsiooni andmed vastavad küsimusele:

> Kes teenust osutab ja kuidas temaga üldiselt ühendust saab?

Teenuse andmed vastavad küsimusele:

> Millist teenust osutatakse, kellele see sobib, kus ja mis tingimustel saab pöörduda?

Teeninduskoha andmed vastavad küsimusele:

> Kus seda teenust füüsiliselt osutatakse ja kas see koht peab Teenusekaardil markerina nähtav olema?

## Lehe struktuur

Teenuseprofiili leht on jagatud viieks selgeks plokiks.

1. Organisatsiooni põhainfo
2. Teenused
3. Teeninduskohad
4. Kontakt ja eelpöördumised
5. Avaldamine

Selline jaotus hoiab ära vana segaduse, kus organisatsiooni põhiinfo all olid korraga organisatsiooni andmed, teenuse kategooriad, sihtrühmad ja keeled.

## 1. Organisatsiooni põhainfo

Organisatsiooni põhainfo kirjeldab teenuseosutajat tervikuna.

Selles plokis on:

- organisatsiooni nimi;
- organisatsiooni tüüp;
- registrikood;
- lühikirjeldus;
- pikem kirjeldus;
- veebileht;
- üldine e-post;
- üldtelefon;
- põhikontakt;
- üldine tegevuspiirkond;
- KOV-id või piirkonnad;
- maakond;
- üldine ligipääsetavuse info;
- ligipääsetavuse täpsustus;
- profiili staatus.

Organisatsiooni põhiinfo all ei ole teenuse kategooriaid, sihtrühmi ega teenuse keeli. Need kuuluvad konkreetse teenuse juurde.

## 2. Teenused

Teenuse plokk on Teenuseprofiili kõige olulisem osa.

Iga teenus kirjeldab ühte konkreetset osutatavat teenust. Teenus võib olla seotud ühe või mitme teeninduskohaga, aga võib olla ka ilma füüsilise teeninduskohata.

Teenuse juures saab määrata:

- teenuse nime;
- teenuse kategooria;
- lühikirjelduse;
- pikema kirjelduse;
- mida teenus sisaldab;
- mida teenus ei sisalda;
- teenuse kategooriad;
- sihtrühmad;
- eluetapi või vanusegrupi;
- kes võib pöörduda;
- vajadused ja olukorrad;
- eluvaldkonnad;
- osutamise viisid;
- teeninduspiirkonna;
- piirkonna tüübi;
- maakonna;
- KOV-id või piirkonnad;
- piirkonna täpsustuse;
- teeninduskohad;
- hinnastuse;
- hinna täpsustuse;
- teenuse osutamise keeled;
- pöördumise keeled;
- suhtlustoe;
- kättesaadavuse;
- kättesaadavuse täpsustuse;
- suunamise või hindamise tingimused;
- vajalikud dokumendid;
- pöördumise tingimused;
- kontaktiviisi;
- teenuse kontaktipäriluse;
- kaardil nähtavuse;
- eelpöördumise vastuvõtu seaded.

### Teenuse kategooriad

Teenuse kategooriad on teenuse taseme valikud.

Näited:

- KOV sotsiaalteenus;
- nõustamine ja juhendamine;
- pere, lapse ja noore tugi;
- puue, rehabilitatsioon ja abivahendid;
- kodune abi ja hooldus;
- toimetulek ja võlanõustamine;
- eluase ja turvalisus;
- transport ja liikumisabi;
- töö, õppimine ja osalemine;
- digi- ja asjaajamisabi;
- muu teenus.

Need valikud aitavad Teenusekaardil filtreerida ja eelpöördumise routingul sobivamat kontakti soovitada.

### Sihtrühmad ja vanusegrupid

Vanusegrupp ja sihtrühm on eraldi mõisted.

Eluetapp või vanusegrupp:

- laps;
- noor;
- tööealine inimene;
- täisealine inimene;
- eakas inimene.

Sihtrühmad:

- puudega inimene;
- psüühilise erivajadusega inimene;
- intellektipuudega inimene;
- vaimse tervise murega inimene;
- toimetulekuraskustes inimene;
- eluasemeraskustes inimene;
- võlgadega inimene;
- sõltuvusprobleemiga inimene;
- vägivalla või kriisiolukorra kogemusega inimene;
- hooldaja või lähedane;
- lapsevanem;
- pere;
- eestkostja;
- töötu või tööotsija;
- sotsiaalselt isoleeritud inimene;
- muu sihtrühm.

“Erivajadus” ei ole vanusegrupp. See on vajaduse või sihtrühma tunnus ning peab olema teenuse sihtrühma tasemel täpsemalt sõnastatud.

### Chip-valikud

Teenuse kategooriad, sihtrühmad, vajadused, eluvaldkonnad, keeled ja muud valitavad rühmad on chip-valikud.

Need peavad:

- olema ligipääsetavad `button` elemendid;
- kasutama `aria-pressed` olekut;
- muutma valimisel selgelt visuaalset olekut;
- näitama valitud olekut linnukese või aktiivse märgiga;
- kuvama grupi all kokkuvõtte “Valitud: ...”;
- salvestuma teenuse taseme väljale;
- taastuma pärast lehe laadimist salvestatud profiili järgi.

## 3. Teeninduskohad

Teeninduskoht on füüsiline asukoht, mille põhjal saab Teenusekaardile tekkida marker.

Teeninduskoha juures saab määrata:

- nimetuse;
- aadressi;
- telefoni;
- e-posti;
- veebilehe;
- lahtiolekuajad;
- kas koht on Teenusekaardil nähtav.

Teeninduskoht vajab kaardil kuvamiseks päris aadressi. Kasutaja ei sisesta koordinaate käsitsi. Aadressi kirjutamisel pakub süsteem ametlikke aadressivasteid ning marker tekib ainult siis, kui asukoht on usaldusväärselt leitav või kinnitatud.

Teenuse juures saab valida ainult päriselt lisatud teeninduskohti. Kui teeninduskohti ei ole, kuvatakse juhis:

> Lisa esmalt teeninduskoht, kui soovid teenust kaardil kuvada.

Teenus ei pea alati olema seotud füüsilise teeninduskohaga. Teenus võib olla leitav nimekirjas ilma markerita, kui seda osutatakse:

- veebis;
- telefoni teel;
- inimese kodus;
- piirkondlikult.

## 4. Kontakt ja eelpöördumised

Kontaktiplokk kirjeldab, kuidas Teenuseprofiili kaudu saab kontakti võtta või eelpöördumist koostada.

Teenuseprofiilis eristatakse kolme kontakti taset:

1. teenuse kontakt;
2. teeninduskoha kontakt;
3. organisatsiooni põhikontakt.

Eelpöördumise või Teenusekaardi kontakti valikul kasutatakse prioriteeti:

1. kui teenusel on eraldi kontakt, kasuta seda;
2. kui teenusel eraldi kontakti ei ole, aga seotud teeninduskohal on kontakt, kasuta teeninduskoha kontakti;
3. kui kumbagi ei ole, kasuta organisatsiooni põhikontakti.

Teenuse juures saab valida:

- kasuta organisatsiooni põhikontakti;
- määra teenusele eraldi kontakt.

Kui teenus kasutab organisatsiooni põhikontakti, ei kuvata teenuse sees liigseid kontaktivälju.

### Eelpöördumise seaded

Teenuseosutaja saab määrata:

- kas võtab vastu SotsiaalAI siseseid eelpöördumisi;
- kas lubab e-kirja koostamist.

Sõnastus “e-posti mustand” ei ole kasutajale piisavalt selge. Sobivam sõnastus on:

> Lubab e-kirja koostamist.

Selgitus:

> Kasutaja saab koostada e-kirja eelvaate, mille ta vaatab enne saatmist üle.

Midagi ei saadeta automaatselt.

## 5. Avaldamine

Avaldamise plokk ei ole sisuväljade täitmise koht. See on kontrollkiht.

Avaldamise plokk näitab:

- kas profiil on avaldamata, ülevaatusel, avaldatud või peidetud;
- kas profiil on Teenusekaardil nähtav;
- kas assistent võib avaldatud teenuseid soovitada;
- kas vähemalt üks teenus on avaldatav;
- kas vähemalt üks teeninduskoht on kaardil nähtav ja aadressiga;
- kas kontakt on olemas.

Kui tingimused ei ole täidetud, kuvatakse konkreetne põhjus.

Näited:

- Muuda profiili staatus avaldatuks, kui soovid seda avalikus vaates kuvada.
- Teenusekaardi nähtavus on välja lülitatud.
- Lisa vähemalt üks avaldatav teenus.
- Lisa teeninduskoht koos aadressiga, kui soovid kaardimarkerit.
- Lisa üldine e-post või telefon.
- Assistent ei soovita neid teenuseid enne eraldi loa andmist.

## Andmeloogika

Teenuseprofiil kasutab v2 mõistes kolme põhiobjekti:

- `ServiceProviderProfile`;
- `ServiceProviderService`;
- `ServiceProviderLocation`.

Nende vahel on seos:

- üks profiil võib sisaldada mitut teenust;
- üks profiil võib sisaldada mitut teeninduskohta;
- üks teenus võib olla seotud mitme teeninduskohaga;
- üks teeninduskoht võib olla seotud mitme teenusega;
- mõnel teenusel ei pruugi olla füüsilist teeninduskohta.

Teenuse ja teeninduskoha seos on vajalik, et Teenusekaart ei näitaks markerit “teenusena”, vaid päris teeninduskohana, mille juures on näha seal osutatavad teenused.

## Seos Teenusekaardiga

Teenusekaart kasutab Teenuseprofiilist:

- organisatsiooni nime;
- organisatsiooni kirjeldust;
- teenuse nime ja kirjeldust;
- teenuse kategooriaid;
- sihtrühmi;
- vanusegruppe;
- vajaduse silte;
- eluvaldkondi;
- osutamise viise;
- teeninduspiirkonda;
- teeninduskoha aadressi;
- teenuse ja teeninduskoha seost;
- kontaktandmeid;
- eelpöördumise seadeid.

Teenusekaardi marker tekib teeninduskoha põhjal, mitte teenuse enda põhjal.

Avalikus vaates ei tohi Teenusekaart kuvada mustandeid, peidetud profiile ega avaldamata teenuseid.

## Seos eelpöördumisega

Eelpöördumine kasutab Teenuseprofiili kahel viisil.

Esiteks aitab Teenuseprofiil leida sobivat adressaati:

- piirkonna järgi;
- teenuse kategooria järgi;
- sihtrühma järgi;
- vajaduse ja eluvaldkonna järgi;
- teenuse osutamise viisi järgi;
- pöördumise keelte järgi;
- suunamise tingimuste järgi.

Teiseks annab Teenuseprofiil eelpöördumisele kontaktikonteksti:

- kellele pöördumine läheb;
- kas tegemist on platvormisisese vastuvõtuga;
- kas saab koostada e-kirja eelvaate;
- milline kontakt on prioriteetne;
- kas teenus võib vajada KOV, SKA või spetsialisti hindamist, otsust või suunamist.

Eelpöördumine ei tähenda teenuse automaatset taotlemist ega teenuse määramist.

## Seos RAG/assistendiga

Teenuseprofiilist võib tekkida AI teadmuskirje ainult siis, kui:

- profiil on avaldatud;
- teenus on avaldatav;
- teenuseosutaja on lubanud assistendil avaldatud teenuseid soovitada.

Assistent ei tohi aktiivselt soovitada mustandeid, peidetud profiile ega ülevaatusel olevaid teenuseid.

Assistendi vastuses peab olema selge, kui info pärineb teenuseosutaja enda profiilist.

## Salvestamise põhimõte

Teenuse taseme valikud salvestuvad teenuse külge, mitte organisatsiooni üldinfo külge.

See puudutab eriti:

- kategooriaid;
- sihtrühmi;
- vanusegruppe;
- vajadusi;
- eluvaldkondi;
- keeli;
- osutamise viise;
- suunamise tingimusi.

Organisatsiooni vana `serviceCategories`, `targetGroups` ja `languages` loogika ei tohi enam olla peamine kasutaja sisestuskoht.

## Funktsiooni MVP eesmärk

Teenuseprofiil v2 on valmis MVP tasemel siis, kui:

1. teenuseosutaja saab sisestada organisatsiooni üldinfo;
2. teenuseosutaja saab lisada konkreetseid teenuseid;
3. teenuseosutaja saab lisada päris teeninduskohti;
4. teenus saab olla seotud päris teeninduskohaga;
5. teenus saab olla leitav ka ilma füüsilise teeninduskohata;
6. teenuse kategooriad, sihtrühmad, vajadused, eluvaldkonnad ja keeled on teenuse taseme valikud;
7. kontaktipärilus on arusaadav;
8. avaldamise kontroll näitab selgelt, mis on puudu;
9. Teenusekaart saab kasutada profiili andmeid ilma vana organisatsioonitaseme segaduseta;
10. eelpöördumise routing kasutab teenuse taseme välju;
11. assistent kasutab ainult avaldatud ja lubatud teenuseandmeid.

## Mitte teha selles etapis

Selles etapis ei ole vaja ehitada:

- eraldi avalikku turunduslikku teenuseosutaja lehte;
- teenuse taotlemise süsteemi;
- automaatset teenuse määramist;
- automaatset e-kirja saatmist;
- Teekonna jagamise süvaloogiikat;
- uut vestlusruumi detailvaadet.

Teenuseprofiil v2 peab praegu muutuma kvaliteetseks andmeallikaks Teenusekaardi, eelpöördumise ja assistendi jaoks.

