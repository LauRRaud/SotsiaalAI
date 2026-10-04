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
- **Üle 12 kontaktiga omavalitsus loetletakse osakondade kaupa:** iga vähemalt kolme kontaktiga osakond saab oma kirje, ülejäänud jäävad üldkirjesse; üle 12 kontaktiga rühm jagatakse võrdseteks osadeks ametite järjekorras, nii et ühes osas on sama ametiga inimesed ja kirjeldus nimetab just neid ameteid. Üle 60 kontaktiga omavalitsuses (Tallinn) on kirjes kuni 5 kontakti. Põhjus on kontekstieelarve (jaotised „Korpus v52“ ja „Korpus v53“): näidatud kontakt võtab umbes 450 tokenit, kirjete kontekst on 12 000 tokenit.
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

## Korpus v52 ja mida see näitas (04.10 kell 22.50)

- **Tallinna read seotud omavalitsusega:** 253 rida (`municipalityId`), iga rea kohta auditikirje `SERVICE_MAP_CONTACT_CORRECTION`; registri reegli järgi revisjon +1 ja kontroll uuesti. Kontaktikontroll pärast seda: 869 kinnitatud rida.
- **Eksport:** 869 kinnitatud rida, 19 ilma telefoni ja e-postita, 97 sama inimese kordust; 370 inimest jätsid oma senise dokumendi, 383 said uue kontaktikirje; 66 omavalitsust, 75 kontaktide kirjet.
- **Korpus v52:** 458 dokumenti, 850 sisendit, 118 838 tokenit, 0,0154 USD (usage `pilot_f5166dc6…`); indeks `d0684ad3` (6932 dokumenti, 41 488 lõiku), plaan `/etc/sotsiaalai/m4-corpus-chat-20261004e.json`.
- **Tasuta kontroll kirjete rajal** (küsimus sotsiaaltööspetsialisti kohta, sõnaotsingu kanal, ilma mudelita):
  - piirid peavad (suurim Tallinn: 219 dokumenti), vigu ei ole; uute kontaktide luba kehtib (Tallinn 110/110);
  - kiirus: Tallinn 110 kontaktiotsust 0,55 s;
  - **väikestes omavalitsustes kontaktid paistavad** (Võru 8, Anija 8, Nõo 2), **suurtes mitte** (Tallinn, Tartu, Pärnu, Valga: 0). 35–53 kontaktiga kirje avamine ei mahu eelarvesse ja rada loobus siis kõigist kolmest automaatselt avatud kirjest korraga.

## Parandus pärast v52

- Kontaktide kirjes on kuni 12 kontakti (vt „Otsus“ punkt 3).
- **Kirjete rada loobub avatud kirjetest ükshaaval** (`structured-record-source.js`): kui kolm küsimusele lähimat kirjet täies mahus ei mahu, proovitakse kahte, siis ühte, ja alles siis mitte ühtegi. Enne loobuti kõigist kolmest. See puudutab iga pööret, kus kolm avatud kirjet eelarvesse ei mahu: nüüd jääb sinna rohkem infot, mitte vähem. Paketi kuju ja versioon ei muutu.
- Raja muudatusel kohalikku ühiktesti ei ole (raja testid on integratsioonitestid); kontroll on sama tasuta mõõtmine serveris pärast avaldamist.

## Korpus v53 (04.10 kell 23.08)

- **Eksport:** kõik 753 inimest on hoidlas juba olemas (uusi kontakte 0); 102 kontaktide kirjet (enne 75). Üheksa v52 kirjet, mille nime enam ei teki, eemaldati poliitikast.
- **Korpus v53:** 102 dokumenti, ostetud 43 sisendit (59 kirje tekst oli sama), 4846 tokenit, 0,0006 USD (usage `pilot_47146485…`); indeks `3574091e` (6959 dokumenti, 41 506 lõiku), plaan `/etc/sotsiaalai/m4-corpus-chat-20261004f.json`.
- **Tasuta kontroll kirjete rajal** (sama küsimus sotsiaaltööspetsialisti kohta, sõnaotsingu kanal):

| Omavalitsus | Näidatud kontakte v52 | v53 |
|---|---:|---:|
| Tartu linn | 0 | 10 |
| Pärnu linn | 0 | 12 |
| Valga vald | 0 | 10 |
| Saaremaa vald | 0 (mõõtmata) | 11 |
| Kohtla-Järve linn | 0 (mõõtmata) | 16 |
| Võru vald | 8 | 8 |
| Anija vald | 8 | 8 |
| Nõo vald | 2 | 2 |
| Tallinn | 0 | 0 |

- **Tallinn:** õige kirje on küsimusele lähim (Lasnamäe osakonna kirje esimesel kohal), aga 11 kontaktiga kirje ei mahu: Tallinna 84 kirje pealkirjad võtavad umbes 8300 tokenit ja näidatud kontakt umbes 450 (Tartus 17 kontakti ja 54 pealkirja = 11 940 tokenit). Seepärast saab üle 60 kontaktiga omavalitsus kuni 5 kontaktiga kirjed.
- Teistsuguse sõnastusega küsimus („Kellele ma saan helistada, kui vajan lastekaitse abi?“, „Mul on raha otsas. Kellele ma saan helistada?“) kontaktide kirjet sõnaotsinguga esimeste hulka ei toonud (Tartu 0, Nõo 0–1). Vestlus järjestab vektoriga, mida see kontroll ei mõõda.

## Käivitus pärast Tallinna parandust

Tegemata selle kirjutamise hetkel; lisatakse pärast eksporti ja korpuse täiendust v54.
