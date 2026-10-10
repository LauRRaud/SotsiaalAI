# ADR-139: vallanimi, mis on ühtlasi tavasõna vorm, on nimi ainult seal, kus kiri seda näitab

Kuupäev: 11.10.2026. Seis: **kood ja testid valmis, serveri morfoloogiaga tasuta mõõdetud; päris vastuseid selle reegliga ei ole mõõdetud.**

## Mis juhtus

Tasulises kontrollis pärast korpust v77 ([ADR-137](adr-137-coverage-batch-and-the-law-of-obligations-act.md), osa „Tasuline vastuste kontroll“) küsiti kaks korda: „Leidsin oma 15-aastase poja toast kanepit. Kuidas ma temaga sellest räägin ja kuhu pöörduda?“ Ühel korral kahest lõppes vastus lõiguga „Kui mure on Kanepi vallas, võid võtta ühendust laste heaolu spetsialistiga …“ koos selle valla töötaja kontaktiga, ja otsingusse tulid Kanepi valla toetuste kirjed.

Pöörde kirjest: kasutaja sõnum ei nimetanud ühtegi kohta (olek `region_required`). Otsinguplaan kirjutas päringu „15-aastase kanepi tarvitamine vanema nõustamine“. Kui kasutaja sõnadest kohta ei leita, loetakse plaani päringuid sama kohalugemisega (`knowledgeRegionScope`, mõeldud teises kirjas kirjutatud koha jaoks: „в Нарва-Йыэсуу“), ja see luges sõna „kanepi“ Kanepi vallaks (olek `search_plan_region`).

Viga ei ole ainult plaani päringutes. Kohalugemine võrdleb valla nime sõnaga, nagu see on kirjutatud, ja sõna algvormidega. „Kanepit“ algvorm on „kanep“ ja nimi ei klapi. „Kanepi“ on aga kirjapildilt valla nimi ise. Serveri oma morfoloogiaga mõõdetult (tasuta, 40 lauset ja 23 päringut) valis enne parandust Kanepi valla ka kasutaja enda lause „Mu poeg on kanepi sõltlane“, Tapa valla lause „Ära tapa mind, ütlesin talle“ ja Nõo valla lause „Maja on nõo põhjas“. See oli teada piir (ADR-020; test kinnitas lause „Kas kanepi tarvitamine on ohtlik?“ vastuseks Kanepi valla), mille kohta oli kirjas, et vastuse mudel peab seda pidama esialgseks. Kontroll näitas, et mudel seda ei tee.

## Otsus

Kolme valla nimi on kirjapildilt sõna, mida selles vestluses päriselt öeldakse: **kanepi** (kanep), **tapa** (tapma), **nõo** (nõbu, nõgu). Selline sõna on valla nimi ainult seal, kus kiri seda näitab:

1. sõna on kirjutatud suure tähega ja ei ole lause esimene sõna („hooldajatoetus Kanepi“, „Mu ema elab Kanepi lähedal“);
2. sõnale järgneb samas osalauses „vald“ või „linn“ mis tahes käändes („kanepi vallas“, „Tapa valla sotsiaaltoetused“, „tapa linn“);
3. sõna on kogu sõnum (vastus küsimusele, mis omavalitsuses inimene elab: „kanepi“, „Tapa“).

Lause esimese sõna suur täht tuleb kohast lauses, mitte nimest, seega „Kanepi tarvitamine on mu poja mure“ ja plaani päring „Tapa ähvardus lähisuhtes“ kohta ei nimeta. Nime enda käändevormid („Kanepis“, „Tapal“, „Nõos“, „Kanepisse“) ei ole tavasõna vormid ja neid loetakse nagu enne.

Reegel on ühes kohas (`reads`, `lib/rag-v2/pilot/record-scope.js`), mida kasutavad kõik neli lugemist: kasutaja sõnumi koht, plaani päringute koht, iga mainimise lugemine inimeste elukohtade jaoks ja eituse lugemine.

## Miks suletud loend, mitte morfoloogia

Serveri morfoloogia annab 77 nimesõnast 38-le väikese tähega kirjutatuna teise lugemise, aga enamik neist on oletused tundmatu sõna kohta („viimsi“: viimsima; „maardu“: maarduma; „haljala“: haljalg). Reegel „sõnal on teine algvorm“ võtaks ära väikese tähega kirjutatud Viimsi, Maardu ja veel kolmkümmend nime. Päris tavasõna vorme on loendis kümmekond („kose“: kosk; „tõrva“: tõrv; „kiili“: kiil; „rae“: raad; „paide“: pai; „muhu“: muhk; „mulgi“: mulk; „vinni“: vinn). Neist kolm on sellised, mida abi otsiv inimene või otsinguplaan päriselt kirjutab; ülejäänud jäävad nagu enne („kose lasteaed“ on Kose vald), sest nende puhul oleks kaotus (väikese tähega kirjutatud nimi jääb lugemata) suurem kui võit.

## Mida reegel ära võtab

Nende kolme valla nimi jääb lugemata, kui see on kirjutatud väikese tähega või lause algusesse ilma sõnata „vald“ või „linn“ („tapa lasteaed“, „Kanepi gümnaasium asub kus?“, „elan nõo“). Siis küsib vestlus omavalitsust nagu iga kord, kui kohta ei ole, ja vastus üksi („tapa“) loetakse.

## Mõõdetud

Serveris tasuta, väljalaske `1cb79238` koodiga ja sama koodi peale pandud muudetud mooduliga (`ov2-run.sh`, päris EstNLTK ja päris omavalitsuste loend), 40 kasutaja lauset ja 23 plaani päringut (`tmp/rag-v2-v78/place-check/`):

| | Enne | Pärast |
|---|---|---|
| „Mu poeg on kanepi sõltlane.“ | Kanepi vald | kohta ei ole |
| „Kuidas rääkida lapsega kanepi tarvitamisest?“ | Kanepi vald | kohta ei ole |
| „Kanepi tarvitamine on mu poja mure.“ | Kanepi vald | kohta ei ole |
| „Ära tapa mind, ütlesin talle.“ | Tapa vald | kohta ei ole |
| „Maja on nõo põhjas.“ | Nõo vald | kohta ei ole |
| päring „15-aastase kanepi tarvitamine vanema nõustamine“ | Kanepi vald | kohta ei ole |
| päring „Kanepi tarvitamine noorel ja vanema nõustamine“ | Kanepi vald | kohta ei ole |
| päring „kanepi mõju teismelisele“ | Kanepi vald | kohta ei ole |
| päring „Tapa ähvardus lähisuhtes“, „tapa ähvardus ja lähenemiskeeld“ | Tapa vald | kohta ei ole |
| päring „nõo põhjas asuv maja üleujutus“ | Nõo vald | kohta ei ole |

Ülejäänud 35 lauset ja 17 päringut loeti täpselt nagu enne, nende seas „Elan Kanepis.“, „Elan Kanepi vallas.“, „Mu ema elab Kanepis ja vajab hooldust.“, „Mu õde elab Tapal.“, „Elan Tapa vallas.“, „Elan Nõos.“ ning päringud „Kanepi valla lastekaitsetöötaja kontakt“, „Kanepi vald hooldajatoetus“, „hooldajatoetus Kanepi“, „Tapa valla sotsiaaltoetused“, „Nõo valla sünnitoetus“. Serveris jooksev test päris morfoloogiaga (`tests/rag-v2-record-scope.test.mjs`) läbib; kohalikud testid kasutavad serverist salvestatud lugemisi (`tests/fixtures/rag-v2-recorded-terms.mjs`).

## Mis jääb lahti

- Sama mõõtmine näitas, et väikese tähega tavasõnad „kose“, „tõrva“, „mulgi“, „tori“, „valga“, „rae“, „kiili“, „paide“, „türi“, „saku“, „luunja“, „keila“ valivad endiselt oma valla („Maja asub kose ääres“: Kose vald). Need on jäetud teadlikult; kui mõni neist päris vestluses ette tuleb, lisatakse sõna loendisse.
- Väikese tähega kirjutatud nime käändevorme ei loeta ka praegu („elan kanepis“: kohta ei ole), sest morfoloogia annab neile tavasõna algvormi. See ei ole selle otsuse teema.
- Vastus, mis pakub valla töötaja kontakti koha kohta, mida inimene ei nimetanud, tugineb plaani päringutest loetud kohale. Kas plaani päringutest tohib kohta üldse lugeda, kui kasutaja kirjutab ladina tähtedega, on eraldi küsimus.
