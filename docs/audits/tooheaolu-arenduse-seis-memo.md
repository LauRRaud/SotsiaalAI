# Tööheaolu laua arenduse seis

Kuupäev: 26.05.2026  
Staatus: 10 põhifunktsiooni tuum valmis; üheksa salvestatavat töövoogu, Ülevaade, anonüümne koondandmestik, admini koondvaade, KOV-piloodi vaade, püsivad piloodi skoobid, piloodi aruanne, prindivaade, CSV ja XLSX eksport töötavad

## Lühikokkuvõte

Tööheaolu laud on jõudnud esimesest kujunduse ja kontseptsiooni korrastamisest töötava mooduli tuumani. Laual on lukustatud 10 põhifunktsiooni, kujundus on viidud samasse rütmi spetsialisti töölauaga ning kõik 10 kaarti avavad nüüd sisulise vaate.

Kõige olulisem tehtud muudatus on see, et Tööheaolu ei ole enam ainult kaardirida või staatiline alamleht. Kiirkontroll, Taastumine, Tööpiirid, Katkestused, Tööprotsessid, Rollipiirid, Alustaja tugi, Raske juhtum ja Töövägivald loovad standardiseeritud tööheaolu kirjeid, Ülevaade loeb kiirkontrolle tagasi ning toe küsimise lisaplaanist on ehitatud esimene kasutaja kontrollitud jagatava mustandi rada.

## Valmis tehtud osa

### Tööheaolu töölaud

- Tööheaolu kaart on sotsiaaltöötaja töölaual olemas ja avaneb eraldi tööheaolu lauale.
- Tööheaolu laua kaardid kasutavad sama visuaalset loogikat nagu põhitöölaud.
- Kaartidelt eemaldati nähtavad kirjeldavad lühitekstid.
- Iga kaart kuvab ikooni ja pealkirja.
- Lukustatud 10 funktsiooni on esitatud õiges järjekorras:
  - Kiirkontroll
  - Ülevaade
  - Raske juhtum
  - Töövägivald
  - Taastumine
  - Tööpiirid
  - Katkestused
  - Tööprotsessid
  - Rollipiirid
  - Alustaja tugi

### Ikoonid ja toon

- Liiga meditsiinilised ikoonid vahetati töökorralduslikumate ja sotsiaaltöö konteksti sobivamate vastu.
- Töövägivalla ikoon muudeti eristatavaks, et see ei kordaks Tööheaolu logo.
- Tööheaolu üldkaart kasutab sotsiaalse toe märki, mitte meditsiinilist pulssi.

### Kiirkontroll

Kiirkontroll on praegu kõige kaugemale arendatud töövoog.

Valmis on:

- standardväljade vorm töö nõudmiste ja tööressursside kohta;
- riskimärkide ja toe vajaduse valikud;
- roheline/kollane/punane signaaliloogika;
- erireegel, kus kriitiline töömaht koos taastumise puudumisega viib punase signaalini;
- koormustegurite, puuduvate ressursside ja riskimärkide kuvamine;
- soovitatud järgmiste töövoogude loogika;
- privaatne salvestamine andmebaasi.

Kiirkontroll kasutab standardiseeritud välju, mitte ainult vabateksti. See loob aluse hilisemale ülevaatele, koondandmestikule ja eksporditavusele.

### Ülevaade

Ülevaate esimene versioon on valmis.

Valmis on:

- kasutaja enda privaatsete kiirkontrollide lugemine;
- perioodi signaal;
- kiirkontrollide arv;
- roheliste/kollaste/punaste signaalide loendus;
- korduvate koormustegurite ja ressursside koondamine;
- soovitatud järgmiste töövoogude koondamine;
- perioodivalik `Kõik / Nädal / Kuu`, mis piirab koondloogika valitud ajavahemikuga;
- töö nõudmiste, tööressursside ja riskisündmuste eraldi koondplokid;
- juhiga jagatava koondmemo privaatse mustandi salvestamine `WellbeingOutputDraft` kirjena;
- kasutaja ülevaatuse ja kinnituse nõue enne jagatavaks märkimist;
- kinnitus ei saada memo automaatselt juhile ega ühtegi teise kanalisse.

Praegu on Ülevaade esimene koondfunktsioon, mis loeb kõigi salvestatavate tööheaolu töövoogude kirjeid, säilitab kiirkontrollide eraldi arvu, kuvab töövoogude loenduse ja riskimustrid ning loob juhiga jagatava koondmemo. Memo kasutab ainult koondatud markereid ega sisalda üksikute sisestuste vabateksti või toorvälju.

### Taastumine

Taastumise esimene töövoog on valmis.

Valmis on:

- 24-72h taastumisplaani vorm;
- taastumise põhjuse, taastumisvõimaluse, töövõime, toe vajaduse ja kontrollpunkti standardväljad;
- peamiste koormustegurite valik;
- vältimatute, edasilükatavate ja ümberjagatavate ülesannete eristamine;
- signaaliloogika:
  - juhitav;
  - vajab prioriseerimist;
  - vajab töökorralduslikku tuge;
- 24-72h taastumisplaani väljund;
- juhiga arutelu memo väljund;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Taastumine on nüüd esimene Kiirkontrollist edasi liikuv praktiline töökorralduslik töövoog.

### Raske juhtum

Raske juhtumi esimene töövoog on valmis.

Valmis on:

- raske juhtumi standardväljad juhtumi tüübi, vahetu ohu, üldistatud kirjelduse, rolli, koormusteguri ja järelvajaduste kohta;
- signaaliloogika:
  - vahetut ohtu ei ole;
  - vajab tähelepanu;
  - kiire tähelepanu vajalik;
- vahetu ohu või ebaselge ohu korral nähtav ohutustekst;
- 24h järelplaani väljund;
- neutraalne kokkuvõte ilma kliendiandmete automaatse jagamiseta;
- juhiga arutelu memo;
- kovisiooni sisend;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Raske juhtum on nüüd esimene tundlik töövoog, mis kontrollib ohutusteksti, üldistatud kokkuvõtte ja Kovisiooni sisendi loogikat.

### Töövägivald

Töövägivalla esimene töövoog on valmis.

Valmis on:

- töövägivalla standardväljad olukorra liigi, ohu seisu, üldistatud kirjelduse, kanali, dokumenteerimise, töö- ja turvatunde mõju ning järeltegevuse kohta;
- signaaliloogika:
  - vahetut ohtu ei ole;
  - vajab tähelepanu;
  - kiire tähelepanu vajalik;
- ohu jätkumise või ebaselge ohu korral nähtav ohutustekst;
- neutraalne juhtumikirjeldus;
- turvalisuse kokkuleppe sisend;
- juhiga arutelu memo;
- kovisiooni sisend;
- töökorralduse muutmise soovitus;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Töövägivald on nüüd teine tundlik ohutustöövoog. See hoiab eraldi fookuses ohutuse, neutraalse dokumenteerimise ja töökorraldusliku järeltegevuse.

### Tööpiirid

Tööpiiride esimene töövoog on valmis.

Valmis on:

- töövälise kättesaadavuse, pauside, asenduse ja kriisiolukorra erandite vorm;
- piiri selguse, töövälise surve, pauside kaitstuse, asenduse ja erandite standardväljad;
- signaaliloogika:
  - piir on pigem selge;
  - vajab täpsustamist;
  - vajab kokkulepet;
- tööpiiride kokkuleppe mustandi väljund;
- juhiga arutelu memo väljund;
- dokumendi koostamise sisend;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Tööpiirid on nüüd esimene kokkuleppepõhine töökorralduslik töövoog, kuhu Taastumine saab kasutaja edasi suunata.

### Katkestused

Katkestuste esimene töövoog on valmis.

Valmis on:

- katkestuse liigi, sageduse, töö mõju, reageerimisvajaduse, edasilükkamise võimaluse, kokkuleppe osapoole ja taastumismõju standardväljad;
- katkestuste allikate valik;
- dokumenteerimise või süsteemi katkestuse marker;
- signaaliloogika:
  - juhitav;
  - vajab töövoo täpsustamist;
  - vajab ümberkorraldust;
- katkestuste kaardi väljund;
- fookusaja kokkuleppe väljund;
- suhtluskanalite kokkuleppe väljund;
- juhiga arutelu memo;
- soovitatud edasiliikumine tööpiiridesse, tööprotsessidesse, taastumisse ja ülevaatesse;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Katkestused on nüüd esimene tööpäeva killustatust ja suhtluskanalite kokkuleppeid käsitlev töökorralduslik töövoog.

### Tööprotsessid

Tööprotsesside esimene töövoog on valmis.

Valmis on:

- analüüsi fookuse, töövoo kategooriate, ajakulu allikate, vähese väärtusega tegevuste, info liikumise takistuste, pooleli jääva töö ja lihtsustamise vajaduste standardväljad;
- dubleeriva dokumenteerimise, ümberlülitumise koormuse ja tööprotsessi mõju valikud;
- signaaliloogika:
  - töövoog on pigem juhitav;
  - vajab lihtsustamist;
  - vajab töökorralduslikku muutust;
- tööprotsessi kaardi väljund;
- kolme suurima ajaröövli väljund;
- dokumenteerimise lihtsustamise ettepanek;
- info liikumise kokkuvõte;
- töökorralduse arutelu memo;
- soovitatud edasiliikumine Katkestustesse, Tööpiiridesse, Rollipiiridesse ja Ülevaatesse;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Tööprotsessid on nüüd ajaröövlite, dubleerimise ja info liikumise kitsaskohtade töökorralduslik audit.

### Rollipiirid

Rollipiiride esimene töövoog on valmis.

Valmis on:

- ootuse esitaja, oodatava tegevuse, minu rolli, rollist väljapoole jääva tegevuse ja vajaliku vastutuse standardväljad;
- rollikonflikti, kättesaadavuse surve, eetilise keerukuse ja selgituse osapoole valikud;
- partnerile rolliselgituse ja juhiga arutelu vajaduse markerid;
- signaaliloogika:
  - roll on pigem selge;
  - vajab selgitamist;
  - vajab töökorralduslikku või võrgustiku arutelu;
- rollipiiride analüüsi väljund;
- kliendile selgituse väljund;
- partnerile rolliselgituse väljund;
- "mida saan / mida ei saa teha" tekst;
- juhiga memo;
- soovitatud edasiliikumine Tööpiiridesse, Tööprotsessidesse, Katkestustesse, Kovisiooni ja Ülevaatesse;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Rollipiirid on nüüd rollikonflikti, vastutuse nihkumise ja koostööpiiride töökorralduslik selgitusvoog.

### Alustaja tugi

Alustaja toe esimene töövoog on valmis.

Valmis on:

- töökogemuse etapi, rollivaldkonna, ebaselgete teemade, olemasoleva toe, puuduva toe ja toe kiireloomulisuse standardväljad;
- juhtumite, mida ei tohiks üksi kanda, ning kovisiooni vajaduse märkide valikud;
- mentori, juhi ja alustaja tööpiiride kokkuleppe vajaduse markerid;
- signaaliloogika:
  - tugi on pigem olemas;
  - vajab selgemat töötoe plaani;
  - vajab kiiremat toe kokkulepet;
- esimese nädala plaani väljund;
- esimese kuu fookuste väljund;
- 100 päeva töötoe plaan;
- küsimused juhile või mentorile;
- kovisiooni vajaduse kontroll;
- alustaja tööpiiride mustand;
- soovitatud edasiliikumine Rollipiiridesse, Tööprotsessidesse, Tööpiiridesse, Kovisiooni ja Ülevaatesse;
- privaatne salvestamine andmebaasi;
- korduv toe küsimise paneel juhiga memo, kovisiooni sisendi või abipalve mustandiks.

Alustaja tugi on nüüd alustava spetsialisti esimese nädala, esimese kuu ja 100 päeva töötoe plaan.

## Andmemudel ja API

Lisatud on kaks tööheaolu andmemudelit.

### WellbeingRecord

Kasutatakse tööheaolu töövoogude standardiseeritud sisestuste jaoks.

Oluline loogika:

- kirje kuulub kasutajale;
- vaikimisi `visibility = "private"`;
- sisaldab standardvälju, signaali, koormustegureid, ressursse, riskimärke ja soovitatud tegevusi;
- sobib tulevikus anonüümse koondandmestiku aluseks.

### WellbeingOutputDraft

Lisatud lisaplaani järgi kasutaja kontrollitud toe küsimiseks ja jagatavate mustandite jaoks.

Oluline loogika:

- jagatav versioon on eraldi objekt;
- toorandmeid ei jagata;
- mustand on vaikimisi privaatne;
- kasutaja peab teksti üle vaatama;
- kasutaja peab jagatava versiooni kinnitama;
- kinnitamine ei saada midagi automaatselt.

### Anonüümse koondandmestiku alus

Lisatud on esimene sisemine koondandmestiku teenus KOV-piloodi ja hilisema ekspordi jaoks.

Oluline loogika:

- vaikimisi `minimumGroupSize = 3`, et piloot ei muutuks kasutuskõlbmatuks;
- lävi on seadistatav keskkonnamuutujaga `WELLBEING_MIN_GROUP_SIZE`;
- grupisuurust arvestatakse eristuvate kasutajate, mitte kirjete arvu järgi;
- kui kasutajaid on alla läve, ei väljastata töö nõudmiste, ressursside ega riskide detailseid võtmeid;
- piisava valimi korral väljastatakse ainult anonüümsed loendurid ja osakaalud;
- väljund ei sisalda kasutaja ID-sid, vabatekste, standardväljade toorandmeid ega isikuandmeid.
- eksporditeenus valmistab sama andmestiku ette JSON ja CSV kujul;
- admin endpoint `/api/admin/wellbeing/aggregate` tagastab koondandmestiku JSON-ina või `format=csv` korral CSV-na.
- admini tööpind `/admin/wellbeing` kuvab sama koondandmestiku filtrite, miinimumgrupi staatuse, anonüümsete mõõdikute tabeli ja CSV lingiga.
- KOV-piloodi tööpind `/tooheaolu/piloot` kasutab eraldi piloodi endpoint'i `/api/wellbeing/pilot/aggregate`.
- Mitte-admin piloodiligipääs kasutab nüüd püsivat andmebaasi skoobi mudelit: piloodile saab määrata nime, skoobi tüübi, KOVi või organisatsiooni tunnuse, lubatud rolligrupid, vaatajate e-postid, aktiivsuse ja miinimumgrupi.
- Varasem keskkonnamuutujate allowlist (`WELLBEING_PILOT_VIEWER_EMAILS`, `WELLBEING_PILOT_ROLE_GROUPS`) jäi alles arenduse ja varuvariandi jaoks, kui andmebaasi skoope veel pole.
- Piloodi endpoint kasutab sama anonüümset miinimumgrupi ja summutamise loogikat, seob mitte-admin kasutaja lubatud piloodiskoobiga ega ava suvalist rolligruppi.

API tasemel on olemas:

- kiirkontrolli salvestamine;
- raske juhtumi 24h järelplaani salvestamine;
- töövägivalla järeltegevuse salvestamine;
- taastumisplaani salvestamine;
- tööpiiride kokkuleppe salvestamine;
- katkestuste kokkuleppe salvestamine;
- tööprotsessi auditi salvestamine;
- rollipiiride selgituse salvestamine;
- alustaja töötoe plaani salvestamine;
- ülevaate lugemine;
- output-draft mustandite loomine;
- output-draft mustandite listimine;
- output-draft mustandi kinnitamine;
- admin koondandmestiku endpoint JSON ja CSV väljundiga;
- admin koondandmestiku tööpind `/admin/wellbeing`;
- KOV-piloodi koondandmestiku endpoint JSON ja CSV väljundiga;
- KOV-piloodi koondvaade `/tooheaolu/piloot`;
- KOV-piloodi aruande koostamine anonüümsetest mõõdikutest töökorralduslikeks prioriteetideks ja soovitatavateks kokkulepeteks.
- KOV-piloodi prinditav HTML aruanne `format=report-html`;
- KOV-piloodi XLSX töövihik `format=xlsx`, mis sisaldab aruande, prioriteetide, kokkulepete ja anonüümsete mõõdikute lehti.
- admini piloodiskoobi endpoint `/api/admin/wellbeing/pilots` püsivate pilootide listimiseks ja loomiseks;
- admini koondvaates piloodiskoobi loomise paneel rolligruppide, vaatajate ja miinimumgrupi seadistamiseks.

Kõik tööheaolu API-d kontrollivad kasutaja rolli ja tellimuse ligipääsu.

## Toe küsimise lisaplaan

Lisaplaanist on esimene oluline osa arendatud.

Kiirkontrollis on nüüd korduv toe küsimise paneel:

- Jäta privaatseks
- Koosta juhiga arutelu memo
- Koosta kovisiooni sisend
- Koosta abipalve
- Ava Taastumine

Kasutaja saab:

- näha jagatava versiooni eelvaadet;
- teksti muuta;
- märkida, et on teksti üle vaadanud;
- kinnitada, et tekst sobib jagatavaks sisendiks;
- jätta kõik privaatseks.

Süsteem ei saada midagi automaatselt juhile, kolleegile, KOVile ega kovisiooni.

## Kovisiooni sidumine

Kovisiooni moodulit ei dubleeritud Tööheaolu alla. Selle asemel lisati seos olemasoleva Kovisiooni lehega.

Valmis on:

- Tööheaolu saab koostada kovisiooni sisendi mustandi;
- kasutaja saab selle kinnitada;
- Kovisiooni lehel on nupp `Alusta Tööheaolu sisendist`;
- Kovisiooni lehel kuvatakse kinnitatud tööheaolu sisendid eraldi plokis;
- kasutaja saab valida `Kasuta kovisioonis`.

See järgib lisaplaani põhimõtet:

```text
Tööheaolu koostab sisendi.
Kovisioon võtab sisendi vastu.
Kasutaja kinnitab, mida kaasa viiakse.
```

## Kontrollid

Sihitud automaatkontrollid on rohelised.

Kontrollitud on:

- tööheaolu kaardid ja järjekord;
- tööheaolu ikoonide toon;
- kiirkontrolli signaaliloogika;
- kiirkontrolli salvestus;
- ülevaate koondloogika üle kõigi salvestatavate töövoogude;
- ülevaate üldistatud juhimemo;
- output-draft mustandite loomine ja kinnitamine;
- raske juhtumi signaali, ohutusteksti ja salvestuse loogika;
- töövägivalla signaali, ohutusteksti ja salvestuse loogika;
- tööpiiride kokkuleppe arvutus- ja salvestusloogika;
- katkestuste arvutus-, väljundi-, API- ja salvestusloogika;
- tööprotsesside arvutus-, väljundi-, API- ja salvestusloogika;
- rollipiiride arvutus-, väljundi-, API- ja salvestusloogika;
- alustaja toe arvutus-, väljundi-, API- ja salvestusloogika;
- Prisma skeemi kontraktid;
- API kontraktid;
- admini koondandmestiku vaate kontraktid;
- KOV-piloodi access policy ja vaate kontraktid;
- püsiva piloodiskoobi ligipääsu, Prisma mudelite, admin API ja UI kontraktid;
- KOV-piloodi aruande summutamise, prioriteetide ja soovitatud kokkulepete loogika;
- KOV-piloodi HTML ja XLSX ekspordi kontraktid;
- Kovisiooni lehe olemasolevad põhilised UI kontraktid;
- anonüümse koondandmestiku miinimumgrupi, summutamise ja identiteedi/vabateksti välistamise loogika.

Brauseris kontrollitud:

- Kiirkontrolli vaade avaneb;
- kovisiooni sisendi mustand tekib;
- privaatne mustand salvestub;
- kinnitamine nõuab kasutaja ülevaatust ja kinnitust;
- Kovisioonis on näha tööheaolust ette valmistatud sisend.
- Katkestuste vaade avaneb, väljundid renderduvad ja privaatne salvestus õnnestub.
- Tööprotsesside vaade avaneb, väljundid renderduvad ja privaatne salvestus õnnestub.
- Rollipiiride vaade avaneb, väljundid renderduvad ja privaatne salvestus õnnestub.
- Alustaja toe vaade avaneb, väljundid renderduvad ja privaatne salvestus õnnestub.
- Ülevaate memo mustand salvestub privaatselt, nõuab kasutaja ülevaatust ja kinnitust ning ei tekita automaatset saatmist.
- Ülevaate perioodivalik `Kõik / Nädal / Kuu` pärib andmed valitud ajavahemiku piires ja värskendab koondplokke.
- Ülevaade kuvab töö nõudmised, tööressursid ja riskisündmused eraldi tooniga kaartidena.
- Admini koondvaade `/admin/wellbeing` avaneb testadminina, filtreerib rolligrupi järgi, kuvab miinimumgrupi täitumisel anonüümsed mõõdikud ja CSV link tagastab sama filtreeritud andmestiku.
- KOV-piloodi koondvaade `/tooheaolu/piloot` avaneb testadminina, kasutab eraldi piloodi API-t, kuvab anonüümsed mõõdikud ja CSV link tagastab sama filtreeritud andmestiku.
- KOV-piloodi aruandeplokk kuvab signaalikoormuse, töökorralduslikud prioriteedid ja soovitatavad kokkulepped ning API vastus ei sisalda `ownerUserId` välja.
- KOV-piloodi prindivaate link tagastab HTML aruande `@media print` stiiliga ja XLSX link tagastab OpenXML töövihiku; kumbki ei sisalda `ownerUserId` välja.
- Admini piloodiskoobi API loob ajutise skoobi, listib selle tagasi ja admin UI kuvab loodud skoobi; suitsutesti andmed kustutati pärast kontrolli.

## Mida veel ei ole valmis

Kõik 10 põhifunktsiooni avavad nüüd sisulise vaate. Üheksa töövoogu salvestavad privaatseid standardiseeritud kirjeid, Ülevaade loeb kasutaja enda kirjeid tagasi ning admini ja KOV-piloodi koondvaated saavad kasutada piloodi anonüümset andmestikku ja aruannet.

KOV piloodi kasutajapoolse osa esimene tehniline vaade, aruandeplokk ja püsiv skoobi seadistus on valmis. Veel vajab tootedisaini ja arendust:

- KOV või organisatsiooni lõplik aruandevaade, kus püsiv skoop on seotud selgema piloodi tööprotsessi, valitud ajaperioodi ja ekspordi esitlusloogikaga.

## Riskid ja tähelepanekud

- Kovisiooni suur komponent sisaldab juba varasemalt palju kõvasid UI tekste. Uued lisatud tekstid on osaliselt viidud tõlkefunktsiooni alla, aga kogu kovisiooni faili i18n-korrastus on eraldi suurem töö.
- Tööheaolu andmemudel on juba õiges suunas, kuid järgmiste töövoogude lisamisel peab vältima vabateksti muutumist ainsaks oluliseks andmeks.
- Jagatavad mustandid on õigesti privaatsed, aga järgmises etapis tuleb täpsustada, kuidas kinnitatud mustand liigub päriselt kovisiooni töövoogu või dokumentide koostamisse.
- Dev-server vajab Prisma mudelite lisamisel taaskäivitust, sest uued mudelid ei ilmu jooksvale protsessile enne Prisma kliendi uuendust.

## Soovitatav järgmine arendusetapp

Kõige loogilisem järgmine samm on teha püsivast skoobist päris piloodi töövoog:

1. **Piloodi kasutajavoog**  
   Mitte-admin kasutaja näeb ainult talle lubatud pilooti, saab valida lubatud skoobi ja saab aru, millise KOVi või organisatsiooni koondvaadet ta vaatab.

2. **KOV/organisatsiooni lõppvaade**  
   Siduda rolligrupid, organisatsioonid ja KOVid lõpliku aruandevaatega ning vormistada see piloodis kasutatavaks juhtimisvaateks.

Praktiline prioriteet:

```text
Kiirkontroll -> Taastumine -> Tööpiirid -> Raske juhtum -> Töövägivald -> Katkestused -> Tööprotsessid -> Rollipiirid -> Alustaja tugi -> Ülevaate koondplokid -> anonüümne koondandmestik -> admini koondvaade -> KOV piloodi vaade -> püsivad piloodi skoobid -> piloodi aruanne
```

## Seis ühe lausega

Tööheaolu laud on kujunduselt paigas ja tehniliselt käivitatud: kõik 10 põhifunktsiooni avavad sisulise vaate, üheksa töövoogu salvestavad privaatselt, Ülevaade, kasutaja kinnitatud toe-mustandid, Kovisiooni sidumine, anonüümne koondandmestik, admini koondvaade, KOV-piloodi vaade, püsivad piloodi skoobid, piloodi aruanne ning CSV/HTML/XLSX eksport töötavad; järgmine suurem töö on lõpliku KOV/organisatsiooni piloodi töövoo ja aruandevaate viimistlus.
