# Sotsiaaltöö artiklite aastateülene RAG-testipakett

Testipakett kasutab kohaliku `docs/ajakiri_sotsiaaltoo` korpuse täistekste. See ei ole
vastusemallide ega päringupõhiste erandite loend. Küsimused kontrollivad, kas otsing leiab
eri aastate artiklitest õige lõigu, säilitab väite konteksti ning oskab vajaduse korral
ühendada mitu allikat.

## Ühe allika täpsusküsimused

| Aasta | Allikas | Testküsimus | Vastuses kontrollitav tõend |
|---|---|---|---|
| 2016 | Katrin Pedastsaar, „Lastekaitse juhtumikorraldusest sotsiaalteenuste ja -toetuste andmeregistris“ | Mitu omavalitsust oli 2015. aastal STARis juhtumimenetlusi algatanud ning mitu juhtumikorralduse koolitust korraldati? | Ligi 180 omavalitsust; 26 koolitust ja 246 osalejat. |
| 2017 | Laur Raudsoo, „Võrgustikutöö pagulasperega Padise vallas“ | Kes toetas Padise vallas Süüria pagulaspere vastuvõttu ja millal ettevalmistus algas? | Ettevalmistus algas 2016. aasta mais; valla sotsiaalnõunik, EELK Risti kogudus ja Annika Laats, Risti põhikool ning tugiisik Matthew Crandall. |
| 2018 | Merle Varik, Kai Saks ja Marju Medar, „Dementsusega inimeste ja omastehooldajate vajadused“ | Kas dementsus on vananemise paratamatu osa ja kui suur osa seda põhjustavatest haigustest on põhimõtteliselt ravitavad? | Ei; dementsus on haigustest põhjustatud sündroom ning ligikaudu 10–20% seda põhjustavatest haigustest on põhimõtteliselt ravitavad. |
| 2019 | René Randver, Mari Rull ja Terje Bachmann, „Dementsus – meie kõigi ühine väljakutse“ | Millised ülesanded anti Dementsuse Kompetentsikeskusele? | Võrgustikutöö; tõenduspõhiste teadmiste, metoodika ja heade praktikate kogumine ning levitamine; koolitus ja tugiteenuste arendamine. |
| 2020 | Dagmar Narusson, „Avatud dialoog: võimalus muudatusteks vaimse tervise valdkonnas“ | Miks ei käsitleta avatud dialoogi lihtsalt tehnika või valmis lahendusplaanina? | Töötatakse inimese ja kogu võrgustikuga; praktikul ei ole ette valmis mõeldud lahendust; kõik hääled kuulatakse ära ja otsustamises lähtutakse samaväärsusest. |
| 2021 | Kaia Iva, „Eakad on Türi vallas kogukonna väärtuslik ja hoitud osa“ | Milliste lahendustega toetab Türi vald eakate iseseisvat ja kodulähedast toimetulekut? | Teenusmaja, koduteenus, sotsiaaltransport, kodude kohandamine, päevahoid või kavandatav lõimitud sotsiaalteenus. |
| 2022 | Alexander Klein ja Ingo Stamm, „Inimõigusharidus sotsiaaltöös“ | Miks peab inimõigusharidus kuuluma sotsiaaltöö erialaõppe keskmesse? | Haavatavate inimeste õiguste kaitse, inimõiguslepingute tundmine ja igapäevaste eetiliste dilemmade inimõiguspõhine lahendamine. Autorid on Klein ja Stamm, mitte Getter Uustalu. |
| 2023 | Vaike Vainu, „Suure hoolduskoormusega inimesed vajavad täiendavat abi“ | Kui suur osa vähemalt 16-aastastest Eesti elanikest hooldab lähedast ja kui paljud hooldajad tunnevad, et vajavad täiendavat abi? | 15% elanikest hooldab lähedast; 61% hooldajatest vajab täiendavat abi ja 26% palju abi. |
| 2024 | Liis Kroonmäe, „Dementsusega inimesi toetavad kohandatud keskkond ja abivahendid“ | Millised keskkonna- ja abivahendilahendused aitavad ennetada dementsusega inimese eksimist ja toetada orienteerumist? | GPS või teavitusega alarm, nime-aadressi-kontaktiga sildid, valgus ja kontrastid, visuaalsed märgised ning vajaduse korral väljapääsu varjav kujundus. |
| 2025 | Laur Raudsoo, „Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid“ | Kuidas kasutab Eesti Töötukassa OTT-süsteem tehisintellekti ning millised piirangud kasutajad esile tõid? | Eesti OTT hindab pikaajalise töötuse riski 45 näitaja alusel ja toetab, kuid ei asenda spetsialisti; probleemid olid läbipaistmatus, koormav tagasisidestamine ning motivatsiooni ja tervise hindamine. Lõigu algviide on Vihalemm jt 2023; väidet ei omistata vahendava artikli autorile. AuroraAI ja SOTE-AI kuuluvad Soome näidete juurde. |
| 2026 | Ingrid Sindi, „Erasmus+ LOCUS projekt Eestis“ | Kus ja kuidas LOCUS-projekti välitööd Eestis tehti ning mida üliõpilased sellest õppisid? | Põhja-Tallinn; vaatlused, tänavaintervjuud ja kogukonnaanalüüsid; arenesid kontakti loomine, suhtlemisoskus, enesekindlus ja professionaalne refleksioon. |

## Mitme allika sünteesi kontrollid

1. Kuidas on ajakirjas Sotsiaaltöö aastatel 2018, 2019 ja 2024 käsitletud dementsusega
   inimeste ja nende lähedaste toetamist? Too iga aasta kohta vähemalt üks konkreetne
   rõhuasetus ning erista uuringut, kompetentsikeskuse ülesandeid ja keskkonna kohandamist.
2. Milliseid võimalusi ja piire kirjeldavad Sotsiaaltöö artiklid digivahendite kasutamisel
   sotsiaaltöös? Kasuta vähemalt kahte eri aasta allikat ning erista spetsialisti toetamine
   inimese eest otsustamisest.
3. Milliseid kogukonna- ja võrgustikutöö võtteid kirjeldavad Padise pagulaspere juhtum,
   avatud dialoogi käsitlus ja LOCUS-projekt? Too välja nii ühised jooned kui ka erinev
   tegevuskontekst.

## Sama vestluse kontekstikontroll

1. Küsi esmalt „Kes on Laur Raudsoo?” ja seejärel samas vestluses 2025. aasta OTT-küsimus.
   OTT-vastus peab olema täielik, kuid ei tohi vana vastuse tõttu nimetada väite autorina
   Laur Raudsood; algviide on Vihalemm jt 2023.
2. Küsi kohe järele „Aga millised neist olid seotud inimese hindamisega?”. Vastus peab
   siduma jätkuküsimuse OTT-piirangutega ning nimetama motivatsiooni ja terviseseisundit.

## Läbimise tingimus

- Täpne küsimus peab leidma nimetatud artikli küsimusele vastava lõigu, mitte ainult artikli
  pealkirja või mõne teise sama märksõnaga allika.
- Mitme allika küsimus peab kasutama vähemalt kaht iseseisvat allikat ega tohi lasta ühel
  artiklil kogu vastust hõivata.
- Aasta, autor, riik ja arvuline väide peavad jääma selle lõigu külge, millest need pärinevad.
- Uus iseseisev küsimus ei tohi pärida vana assistendivastuse väiteid, kuid selge jätkuküsimus
  peab säilitama eelmise pöörde vajaliku konteksti.
- Vastus ei tohi rääkida „praegu kasutatud allikabaasist“ ega paluda kasutajal olemasoleva
  materjali korral küsimust ümber sõnastada.
