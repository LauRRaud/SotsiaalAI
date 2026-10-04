# ADR-085 — Kinnitatud kontaktid lähevad vestlusse otse registrist; iga omavalitsus saab kontaktide kirje

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „kontaktide värske korjandus oli vist üle 800 jah, need tuleb panna platvormile, ingestida, indekseerida, graph ja siduda KOViga jne.“ Täiendab [ADR-017](adr-017-verified-contact-export.md) ja [ADR-045](adr-045-contact-binding-content.md).

**Mõõtmata mudeliga selle kirjutamise hetkel.** Tõend on kohalikud testid väljamõeldud ridadega. Eksport, korpuse täiendus ja kontroll päris andmetel lisatakse jaotisesse „Käivitus“.

## Lähteseis (loetud serverist 04.10, ainult lugemine)

- Registris on 860 kinnitatud kontakti; kaart näitab neid kõiki. Vestlus sai kasutada 370.
- **Vestlus näitab kontakti ainult siis, kui mõni kirje talle viitab.** Kirjete rada loetleb omavalitsuse teenused, toetused ja ressursid; kontakt tuleb kaasa viite (`relatedContacts`) sihtmärgina. 78 omavalitsusest 74-s mahub kontekst ainult pealkirjade vaatesse, kus viited avatakse kolmel küsimusele lähimal kirjel.
- Senine eksport ([ADR-017](adr-017-verified-contact-export.md)) nõuab iga kontakti jaoks omavalitsuse paketi kirjet ja käsitsi vastendust. Registriridu, millel paketikirjet pole, vestlusse viia ei saanud.
- **Tallinna 183 kinnitatud rida ei ole omavalitsusega seotud** (`municipalityId` puudub kõigil 253 Tallinna real, real on ainult nimi „Tallinna linn“). Sidumata rida ei saa vestluses üheski omavalitsuses näidata. Sidumine on registrimuudatus ja tehakse eraldi (jaotis „Käivitus“).

## Otsus

### 1. Eksport otse registrist

`prepareRegisterContactExport` (`scripts/rag-v2-contact-export.mjs --register --store <hoidla> --out <kaust>`):

- loeb kõik kinnitatud ja aktiivse omavalitsusega seotud kontaktiread (sama värskusreegel mis kaardil);
- rida, mille kohta hoidlas on juba seotud dokument ja see vastab reale (sama rida, revisjon ja sisu), **jätab oma dokumendi**: teenuste viited sellele kehtivad edasi;
- iga muu rida saab kontaktikirje nimega `service-map-contact:<rea id>`. Väljad on registri enda väärtused (nimi, amet, osakond, telefon, e-post, ametlik leht, kontrolli aeg), nagu senises ekspordis;
- telefoni ja e-postita, nimeta või kõlbmatu leheaadressiga rida jäetakse välja ja loetakse kokku.

### 2. Registriseos ilma paketikirjeta

Seose (`registry_binding`, [ADR-045](adr-045-contact-binding-content.md) seos 2) allikakirje on kas paketikirje (nagu enne) või registririda ise: `{ register: "service_map", item_id }`, kus `item_id` peab olema selle rea nimi. Muu kontroll on sama: vestlus näitab kontakti ainult siis, kui rida on praegu kinnitatud ja selle sisu ning revisjon pole muutunud.

### 3. Kontaktide kirje omavalitsuse kohta (graaf)

Iga omavalitsus saab ressursikirje „Sotsiaalvaldkonna kontaktid: <omavalitsus>“, mis viitab kõigile tema kinnitatud kontaktidele, nii alles jäänud paketikontaktidele kui uutele. Selle kaudu jõuavad kontaktid vestlusse.

- **Midagi ei oletata:** ühtegi teenust ei seota inimesega ameti või nime järgi.
- Kirjeldus nimetab registris olevad ametid („Ametid: lastekaitsespetsialist, sotsiaaltööspetsialist“), et ameti kohta käiv küsimus kirje üles leiaks.
- **Suur omavalitsus (üle 60 kontakti) loetletakse osakondade kaupa:** iga vähemalt viie kontaktiga osakond saab oma kirje, ülejäänud jäävad üldkirjesse; üle 60 kontaktiga rühm jagatakse võrdseteks osadeks. Põhjus on kontekstieelarve: umbes 50 tokenit kontakti kohta, 12 000 tokenit kogu kirjete kontekstile.
- Kirjete nimed on püsivad (omavalitsus ja osakonna nime räsi), nii et järgmine eksport asendab sama kirje.

### Mida ei muudetud

Otsingu ja kirjete raja kood, vestlusplaani versioonid, kaardi reeglid. Kontaktiettepanekuid ei rakendatud.

## Piirangud, mida kontrolliti

Kirjete rajal on omavalitsuse kohta 300 dokumenti ja 300 kirjet, kirjel 200 viidet. Suurim praegu on Pärnu (116 dokumenti); kontaktide lisamisega ei ületa ükski omavalitsus piiri (algseis `eval-files/contact-baseline-2026-10-04.json` serveris).

## Kontrollid

`tests/rag-v2-register-contact-export.test.mjs` (väljamõeldud read, ilma andmebaasita):

- eksporditakse read, millel sobivat dokumenti pole; sobiva dokumendiga rida jätab oma dokumendi ja kontaktide kirje viitab sellele;
- vestluse luba: kehtib, kuni rida on kinnitatud ja muutmata; uus telefon, amet või revisjon lõpetab; võõra rea seos ja lisaväljadega allikakirje lükatakse tagasi; paketiseos loetakse nagu enne;
- välja jäetud read loetakse kokku; ekspordi ajal muutunud rida peatab ekspordi;
- suur omavalitsus osakondade kaupa, iga kontakt täpselt ühes kirjes, nimed ei sõltu ridade järjekorrast;
- lugeja kaudu: kontakt on kirje oma seosega, 60 viitega kontaktide kirje iga viide on lähtetekstis ankurdatud.

## Piirid

- **Kontakt paistab siis, kui kontaktide kirje on küsimusele lähim kolmest** (või kui vestlus selle valib). Kas see juhtub, näitab ainult mõõtmine.
- **Eksport on hetkeseis.** Registris muutunud rida kaob vestlusest kohe (seos lõpeb), uus või parandatud rida jõuab sinna alles järgmise ekspordi ja korpuse täiendusega. Iganädalast automaatset eksporti ei ole.
- Kui osakondade jaotus muutub, jääb vana kontaktide kirje korpusesse, kuni see poliitikast eemaldatakse (`refresh package --remove`). Esimesel ekspordil vanu kirjeid ei ole.
- Nimed ja kontaktandmed on ekspordifailis; see ei lähe repositooriumisse.

## Täiendus pärast esimest eksporti (04.10 hilisõhtu)

Esimene eksport päris andmetel (avaldamata) näitas kaht asja, mida väljamõeldud read ei näidanud.

- **Sama inimene on registris mitmel real** (iga lehe või teeninduskoha kohta oma rida): 480 eksporditud reast 97 kordasid inimest, üks Tallinna sektorijuht 18 korda. Nüüd on üks inimene üks kontakt: sama omavalitsuse read, millel on sama nimi, telefon ja e-post, on sama inimene. Teda esindab rida, mille seotud dokument on hoidlas olemas, muidu esimene rida. Sama nimi teise telefoniga jääb eraldi kontaktiks.
- **Kontakti kontroll luges kehtivusreeglit iga kontakti jaoks uuesti** (viimase kontrolli kirje, umbes 15 ms kontakti kohta; mõõdetud Pärnus 25 kontakti = 0,4 s). Tallinna kontaktidega oleks see olnud üle sekundi pöörde kohta. Reegel loetakse nüüd kuni viieks sekundiks üks kord; iga kontakti enda rida loetakse endiselt iga kord.

## Käivitus

Tegemata selle kirjutamise hetkel; lisatakse pärast eksporti ja korpuse täiendust.
