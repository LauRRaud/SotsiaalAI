# ADR-085 — Kinnitatud kontaktid lähevad vestlusse otse registrist; iga omavalitsus saab kontaktide kirje

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „kontaktide värske korjandus oli vist üle 800 jah, need tuleb panna platvormile, ingestida, indekseerida, graph ja siduda KOViga jne.“ Täiendab [ADR-017](adr-017-verified-contact-export.md) ja [ADR-045](adr-045-contact-binding-content.md).

**Töös korpusega v55 (jaotis „Seis pärast korpust v55“); mudeliga mõõtmata.** 65 omavalitsuse 643 kontakti on vestluses kontaktide kirjete kaudu; Tallinn (110 kontakti) jäi välja, sest need ei mahu kirjete konteksti. Kontroll päris andmetel on tasuta mõõtmine kirjete rajal (sõnaotsingu kanal); kas vestlus kontaktide kirje vektoriga üles leiab ja kuidas mudel kontakte vastuses kasutab, on mõõtmata.

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
- **Üle 12 kontaktiga omavalitsus loetletakse osakondade kaupa:** iga vähemalt kolme kontaktiga osakond saab oma kirje, ülejäänud jäävad üldkirjesse; üle 12 kontaktiga rühm jagatakse võrdseteks osadeks ametite järjekorras, nii et ühes osas on sama ametiga inimesed ja kirjeldus nimetab just neid ameteid. **Üle 60 kontaktiga omavalitsus (Tallinn, 110 inimest) jäetakse ekspordist välja** (jaotis „Korpus v54“). Põhjus on kontekstieelarve: näidatud kontakt võtab umbes 490 tokenit ja kontaktide kirje pealkiri umbes 210, kirjete kontekst on 12 000 tokenit.
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

## Korpus v54 ja otsus Tallinna kohta (04.10 kell 23.25)

- **Korpus v54:** Tallinn 27 kirjega (kuni 5 kontakti), kokku 116 kirjet; ostetud 27 sisendit, 0,0004 USD (usage `pilot_a689c5e1…`); indeks `14e7f321`, plaan `/etc/sotsiaalai/m4-corpus-chat-20261004g.json`.
- **Tallinnas ei paistnud ikka ühtegi kontakti.** Mõõdetud otse: Tallinna 98 kirje pealkirjad võtavad 10 334 tokenit 12 000-st (enne kontaktide kirjeid 4646); ühe 5 kontaktiga kirje avamine maksab umbes 2460 tokenit ja ei mahu.
  - Kontaktide kirje pealkiri ise maksab umbes 210 tokenit (pikk pealkiri seisab kontekstis kaks korda koos allika andmetega). 13 kirjet võtsid 2900 ja 27 kirjet 5700 tokenit.
  - See võttis ruumi ka Tallinna teenuste infolt: enne jäi avatud kirjetele ja kokkuvõtetele umbes 7350 tokenit, v54-s 1670.
  - Iga Tallinna pööre otsustas lisaks kõik 110 kontakti (0,55–0,85 s).
- **Otsus:** üle 60 kontaktiga omavalitsus jäetakse ekspordist tervikuna välja ja nimetatakse (`too_large`). Tallinna kontaktid ja kontaktide kirjed eemaldatakse indeksi poliitikast: Tallinna seis vestluses on sama mis enne (v51). Kaardil on Tallinna kontaktid endiselt, nüüd omavalitsusega seotud.
- **Mida Tallinn vajab:** odavamat kontakti vaadet kirjete kontekstis (praegu umbes 490 tokenit kontakti kohta) ja kontaktiotsust ainult näidatavate kontaktide kohta. See on kirjete raja muudatus ja vajab mudeliga mõõtmist; alustamata.
- Eksport loeb nüüd, millised dokumendid on indeksi poliitikas (`--policy`): poliitikast välja jäetud dokumenti ei loeta olemasolevaks, muidu viitaks kontaktide kirje kontaktile, mida vestlus avada ei saa.

## Seis pärast korpust v55 (04.10 kell 23.35)

- **Eksport:** 869 kinnitatud rida; 19 ilma telefoni ja e-postita; 97 sama inimese kordust; Tallinn välja jäetud (110 inimest). 65 omavalitsust, 643 kontakti (370 paketikontakti ja 273 registrist), 89 kontaktide kirjet.
- **Korpus v55:** 89 kirjet uuesti (ostu ei olnud, kõik tekstid olid olemas); Tallinna 27 kirjet ja 110 kontakti eemaldatud poliitikast; indeks `5e1c79dd` (6836 dokumenti, 41 273 lõiku), plaan `/etc/sotsiaalai/m4-corpus-chat-20261004h.json`.
- **Kulu kokku:** v52 0,0154 + v53 0,0006 + v54 0,0004 + v55 0 = 0,0164 USD (vektorid). Mudelijookse ei tehtud.
- **Tasuta kontroll kirjete rajal** (küsimus „Kes on sotsiaaltööspetsialist ja kuidas temaga ühendust saab?“, sõnaotsingu kanal):

| Omavalitsus | Näidatud kontakte enne (v51) | v55 |
|---|---:|---:|
| Tartu linn | 2 | 10 |
| Pärnu linn | 1 | 12 |
| Valga vald | mõõtmata | 11 |
| Saaremaa vald | mõõtmata | 11 |
| Kohtla-Järve linn | mõõtmata | 17 |
| Võru vald | 7 | 8 |
| Anija vald | mõõtmata | 8 |
| Nõo vald | 0 | 2 |
| Tallinn | 0 | 0 (välja jäetud) |

- Tallinn on samas seisus mis enne: 85 kirjet, pealkirjad 4646 tokenit, kontaktiotsuseid 0.
- Kirjete raja aeg koos kontaktiotsustega: 0,6–1,8 s omavalitsuse kohta esimesel päringul (Tartu 69 otsust 0,57 s).

### Mis jääb lahti

- **Tallinn:** kontakti odavam vaade kirjete kontekstis ja kontaktiotsus ainult näidatavatele kontaktidele (kirjete raja muudatus, vajab mudeliga mõõtmist).
- **Mõõtmine mudeliga:** kas vestlus leiab kontaktide kirje (vektor) ja nimetab õige inimese. Teistsuguse sõnastusega küsimused („Kellele ma saan helistada …?“) kontaktide kirjet sõnaotsinguga esile ei toonud.
- **Eksport on hetkeseis:** registris muutunud rida kaob vestlusest kohe, uus jõuab sinna järgmise ekspordi ja korpuse täiendusega. Regulaarset eksporti ei ole.
- **Kontaktiettepanekud** (355, omaniku ülevaatusel) on rakendamata; pärast rakendamist ja kontrolli tuleb eksport uuesti teha.
- Registris on sama inimene mitmel real (97 kordust kinnitatud ridade seas); eksport näitab inimest üks kord, register on muutmata.
