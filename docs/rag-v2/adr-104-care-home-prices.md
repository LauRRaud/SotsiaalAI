# ADR-104: hooldekodude kohamaksumus omavalitsuste kaupa

Kuupäev: 07.10.2026. Seis: lugeja, lehed ja kuine uuendus tehtud; lehed on korpuses alates v69 (jaotis „Korpus v69“).

## Probleem

07.10.2026 küsis kasutaja päris vestluses, kui palju hooldekodu koht maksab, ja nimetas koha ja hooldekodu. Vastus ei saanud öelda ühtki summat: Luna ette jõudnud lõikudes ei olnud ühtki eurosummat. Korpuses oli Sotsiaalkindlustusameti leht, mis hinnatabelit kirjeldab, aga mitte tabel ise.

Omanik samal päeval ettepanekule „hooldekodude hinnatabel RAG-i, nagu abivahendite müügikohad: iga valla kohta leht koos kuupäevaga ja kuise uuendamisega“: „ja selle vist võiks ka ära teha jah“.

## Allikas

Sotsiaalkindlustusameti üldhooldusteenuse lehel (`sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/uldhooldusteenus`) on hinnaseire tabel „Hoolduskulud ja hoolduskoha maksumus“ (Exceli fail; faili aadress muutub iga uue tabeliga, link leitakse lehelt selle sõnade järgi).

Esimene lugemine 07.10.2026: fail `HKhinnaseire_august_2026.xlsx`, tabel ise ütleb „seisuga märts 2026“. 201 tegevuskohta 66 omavalitsuses; 12 omavalitsuses ei ole tabelis ühtegi hooldekodu. Iga rea kohta: maakond, asukoha omavalitsus, teenuseosutaja ja tegevuskoht, kett, kohtade arv tegevusloal, koduleht, hoolduskulu, koha maksumus (tekst ja kuni neli taset), kas võetakse dementsusega inimesi, tegevusloa number, aadress, telefon, e-post.

Amet ütleb tabeli kohta ise: hinnad on ülevaatlikud ja pärinevad omavalitsuste ning teenuseosutajate avalikelt kodulehtedelt; kehtiva hinna saab hooldekodu kodulehelt või teenuseosutajalt. See lause on igal lehel.

## Otsus

**Lugeja** (`lib/rag-v2/care-prices.js`, `scripts/rag-v2-care-prices.mjs`): loeb ameti lehelt tabeli lingi ja tabeli (kaks viisakat lugemist), teeb tabelist andmestiku ja lehed. Exceli fail loetakse oma väikese ZIP-lugejaga, lisapaketti ei ole. Veerud leitakse päiserea sõnade järgi, mitte asukoha järgi.

**Mida ei arvata.** Hooldekodu koht, hinnad ja sõnad on tabeli omad: hinna ja hoolduskulu tekst läheb lehele tabeli sõnastuses. Rida, mille omavalitsust korpus ei tunne, jäetakse välja ja nimetatakse lugemise aruandes; esimesel lugemisel oli tabelis kaks teistsugust kirjapilti (`TABLE_NAMES`).

**E-posti aadresse ei loeta** (paljud on inimese nimega). Üldtelefon on lehel, nagu abivahendite müügipunktidel (ADR-096); lehed on seetõttu väljaspool avalikku koodihoidlat.

**Lehed (79):**

- **iga omavalitsuse kohta üks leht** „Hooldekodude kohamaksumus: <omavalitsus>“: selle omavalitsuse hooldekodud, igaüks oma pealkirja all (koha maksumus kuus, hoolduskulu, kohtade arv, dementsus, aadress, üldtelefon, koduleht, kett); seejärel sama maakonna teised hooldekodud ühe reana, sest inimene võib valida hooldekodu ka mujalt. Omavalitsusel, kus tabelis hooldekodu ei ole, on ka oma leht: see ütleb nii ja annab maakonna hooldekodud täielikult (ADR-096 õppetund: vastuseni jõuab omavalitsuse enda leht, mitte maakonna ülevaade);
- **üks üle-eestiline ülevaade** (ei ole ühegi omavalitsuse allikas): mitu hooldekodu on igas maakonnas ja mis vahemikku jääb nende madalaim loetletud kohamaksumus. See vastab küsimusele, mis kohta ei nimeta.

Iga summa juures on tabeli kuu („seisuga märts 2026“) ja igal lehel lugemise päev. Sama nimega tegevuskohti eristab aadress.

**Kuine uuendus** (`scripts/rag-v2-assistive-refresh.mjs`, samm 2b; ADR-098 reegel kogutud andmete kohta): tabel loetakse uuesti; uus või muutunud hooldekodu rakendub siis, kui järgmine lugemine näitab sama muudatust; tabelist kadunud hooldekodu ei eemaldata ise, see ootab inimese luba (`--approve-care-removals`). Uus kuu tabelis on iga hooldekodu muudatus (hind on uue kuu seisuga). Leht tehakse uuesti ainult siis, kui tema sisu muutub, mitte lugemise päeva pärast. Muutunud lehed lähevad samasse täienduse kausta mis abivahendite lehed.

**Register ja ülevaatus:** registris on oma liik „Hooldekodude kohamaksumus omavalitsuste kaupa“ (sama allika liik `registry` mis abivahendite lehtedel, eristab pealkiri); ülevaatuse reeglis liik `care`.

## Mida see ei tee

- **Omavalitsuse piirmäära** (kui palju hoolduskulust vald tasub) tabelis ei ole. See on valla enda õigusaktis või korralduses; inimesele jääva summa arvutamiseks on seda vaja.
- Keskmise vanaduspensioni summat, millest sõltub väiksema sissetulekuga inimese hüvitis, lehed ei anna.
- Hinnad on tabeli kuu seisuga, mitte tänased; hooldekodu enda hinnakirja ei loeta.
- Lugeja ei kontrolli, kas hooldekodul on vabu kohti.

## Kontroll

- `tests/rag-v2-care-prices.test.mjs`: link, ZIP ja leht; tabel andmetena (kuu, omavalitsus, sama nimega tegevuskohad, e-posti ei ole); lehed (oma hooldekodud, maakonna teised, hooldekoduta omavalitsus, ülevaade, tabeli sõnad ei muutu märgistuseks); uuendus (teine sama lugemine, kadunud hooldekodu ootab, leht ei muutu lugemise päeva pärast). Näidisandmed on välja mõeldud.
- Päris tabel: 201 rida, kõik omavalitsuses, 200 kodulehega, 187 üldtelefoniga; lehtedel ei ole ühtki e-posti aadressi.

## Korpus v69 (07.10.2026 kell 22.26)

| | |
|---|---|
| Lehti | 79 (78 omavalitsust, 1 ülevaade) |
| Lõike | 609 |
| Ost | 609 sisendit, 158 766 tokenit, **0,0206 USD** (lagi 0,05; serveri tasuta plaan andis sama arvu) |
| Indeks | `8b1e1008`: 8337 dokumenti, 68 408 lõiku (mahutavus 80 000) |
| Vestluse plaan | `/etc/sotsiaalai/m4-corpus-chat-20261007e.json` |
| Ketas | 68%, 26 GB vaba; hoidla 2,0 GB (käik pakkis uued kaustad ise) |

See oli esimene päris käik pakitud hoidlaga ja uue käivitusskriptiga (#443); käik lõppes veata.

**Kontroll päris lehel** (3 pööret, 0,0172 USD plaani hinna järgi; kogu töö 0,0378 USD, lagi 0,05):

- „Kui palju maksab hooldekodu koht Harku vallas?“: vastus andis valla hooldekodu kolm kuuhinda märtsi 2026 seisuga, selgitas, mida vald tasub, nimetas keskmise vanaduspensioni summa valla kirjest ja andis valla taotlusvormide lingid. Viidatud: valla hinnaleht, valla kord, valla teenusekirje.
- „Kui palju maksab hooldekodu koht Eestis?“: vastus andis ülevaate lehe vahemiku ja mediaani märtsi 2026 seisuga.
- **Esimene katse Harku küsimusega lükati tagasi** (`answer_rejected`, `invalid_answer` kohas `$.kind`): mudel märkis sisult õige vastuse liigiks „partial“, aga ei lisanud piirangut ega täpsustavat küsimust, mida see liik nõuab. Kasutaja nägi „Vastust ei avaldatud“. Sama küsimus uuesti õnnestus. Säilitatud 138 pöörde seas on see ainus tagasilükkamine. Reegel on meelega range (vastust ei muudeta); kas liigi silt tuleks sellisel juhul lugeda „grounded“-iks, on omaniku otsus. Seda ei ole muudetud.

**Kuine uuendus** on seemendatud selle lugemisega (`accepted/care-homes.json`, `ingested/hooldekodud/`); proovikäik ameti lehelt luges sama tabeli: 201 hooldekodu, muudatusi ei ole, 79 lehte muutmata.

**Kontrollimata:** hooldekoduta omavalitsuse küsimus (leht annab maakonna hooldekodud); hooldekodu nimega küsimus ilma kohata; uue tabeli tulek (uuenduse reegel on testitud välja mõeldud andmetega).
