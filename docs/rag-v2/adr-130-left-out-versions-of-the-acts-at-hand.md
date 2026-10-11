# ADR-130: mittekehtivatest redaktsioonidest nimetatakse pöördes ainult käsil olevate aktide omad

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5. Leitud samal hommikul tasuta otsingukontrolliga ([ADR-122](adr-122-free-search-gate.md)) kohe pärast korpuse v75 lisamist ([ADR-124](adr-124-acts-that-end-and-the-experiment-at-a-date.md)). Seis: **kood ja testid tehtud, mõõdetud tasuta serveris muudetud koodiga; midagi ei ostetud.**

## Probleem

Otsing hoiab õigusaktist ainult seda redaktsiooni, mis küsitud päeval kehtib, ja ütleb vastuse mudelile, mis jäi välja: iga pöörde sisendis oli loend **kõigist** riigi õigusaktide redaktsioonidest, mis sel päeval ei kehti, igaüks pealkirja ja kuupäevadega (`retrieval.scope.legal_validity.excluded`). Loend ei sõltunud küsimusest.

Korpus v75 lisas 26 tulevast redaktsiooni. Otsingukontroll näitas, et **kõigi 33 küsimuse sisend kasvas täpselt 1107 tokeni võrra**, ka omavalitsuse küsimustel, kus neil seadustel ei ole küsimusega mingit pistmist. Loend kasvab iga redaktsiooniga, mis korpusesse jääb, ja ei lühene kunagi: 01.01.2027 muutuvad tulevased redaktsioonid kehtivaks ja senised kehtivad lähevad samasse loendisse.

Teine kulu oli peidus: pealkirja jaoks laaditi iga pöörde ajal iga väljajäetud redaktsiooni terve allikas (seaduse terviktekst), ainult selleks, et lugeda sealt pealkiri.

## Otsus

Väljajäetud redaktsioon ütleb midagi ainult akti kohta, millest pööre räägib. Loend jaguneb kaheks (`leftOutVersions`, `evidenceScope`, `lib/rag-v2/search/legal-validity.js`):

- **Akt, millel ei ole sel päeval otsingus ühtegi redaktsiooni** (ei kehti veel, või lõppes ja järglast ei ole): selle redaktsioonid nimetatakse **igas** pöördes nagu enne. See on ainus märk aktist, mis on korpuses, aga mida pööre lugeda ei saa: just see olukord, mille pärast ADR-124 tehti.
- **Akt, millel on otsingus kehtiv redaktsioon:** selle teised redaktsioonid nimetatakse ainult pöördes, mille tõendite hulgas on sama akti lõik. Muus pöördes need loetakse kokku (`excluded_other_national_documents`).

Kumb akt on kumb, otsustatakse indeksi enda pealkirjade järgi (üks vahemällu jääv päring). Mudelile näidatav pealkiri on tõendi enda oma; terve allikas laaditakse ainult aktidele, millel otsingus redaktsiooni ei ole. Juhiste tekst ei muutu: loend on endiselt „välja jäetud redaktsioonid oma kuupäevadega“, ainult lühem.

## Mõõdetud (tasuta, serveris, muudetud kood kattekaustas)

Otsingukontrolli 33 küsimust, mudeli sisendi suurus tokenites (keskmine):

| | Sisend |
|---|---:|
| Korpus v74 (enne täiendust) | 11 914 |
| Korpus v75, töötav kood | 13 021 |
| Korpus v75, see muudatus | **11 458** |

Iga pööre on praeguse seisuga võrreldes umbes 1560 tokenit (12%) lühem ja 456 tokenit lühem kui enne v75. Ükski otsustav lõik ei kadunud ega nihkunud, kandidaadid on samad.

## Mida see ei muuda

- Mis redaktsioon otsingusse jõuab: kehtivuse reegel on sama.
- Küsimus tulevase kuupäeva kohta („mis muutub 1. jaanuarist“): otsinguplaan lisab selle päeva ja sel päeval kehtiv redaktsioon on tõendite hulgas nagu enne.

## Piir

Kui pööre küsib seaduse kohta, millel on kehtiv redaktsioon, aga otsing ei too sellest ühtki lõiku, siis selle seaduse teisi redaktsioone ei nimetata (need on arvu sees). Enne nimetati neid alati.

## Kontrollitud ja kontrollimata

- Kontrollitud: ühiktestid (jaotus kaheks; nimetamine tõendi pealkirja järgi kummaski kujus; arv; varasem ulatus ilma loendita jääb muutmata); kogu ühiktestide komplekt; otsingukontroll serveris.
- Kontrollimata: päris vastus muudetud koodiga (mudeli sisend läheb lühemaks, sisu ei lisandu; tasulist kontrolli ei tehtud).
