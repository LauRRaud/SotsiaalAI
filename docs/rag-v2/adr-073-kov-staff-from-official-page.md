# ADR-073 — Omavalitsuse töötajad loetakse ametlikult lehelt, mitte ei otsita registri rida lehelt üles

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10: „kodeering või kontroll peab olema selline, et suudame tuvastada kõik sotsiaalvadkonna töötajad KOV lehelt“ ja samal päeval: „oluline, et uus info võib olla valesti korjatud ja vale, et vana õige üle ei kirjutaks“. Jätkab [ADR-017](adr-017-verified-contact-export.md) ja [ADR-045](adr-045-contact-binding-content.md) kontaktiteemat.

**Seis 04.10.2026 õhtul:** iganädalane kontroll kasutab tuvastajat (omanik 04.10: „võib kasutada jah kord nädalas“; jaotis „Kontroll kasutab tuvastajat“). Registri sisu kontroll ei muuda. Uute inimeste, muutunud numbrite ja kolinud lehtede jaoks on ehitatud ettepanekute kiht (jaotis „Ettepanekute kiht“): see loeb ja pakub, registrisse pole midagi kirjutatud. Esimene partii (355 ettepanekut) on omanikul üle vaadata.

## Probleem

- **Avalik teenusekaart ja vestlus näitavad ainult iganädalases kontrollis kinnitatud kontakte.** 04.10 kontroll kinnitas 726 rida 1197-st; 471 on peidus. Spetsialistid, keda kaardil ei ole, on omanikule pettumust väljendanud.
- **Kontroll otsib lehelt registri rida, mitte inimest.** Rida kinnitub ainult siis, kui registris olev nimi, roll, telefon ja e-post on lehel kõik kohe nime järel. Iga erinevus peidab inimese:

  | Ridu | Miks rida 04.10 ei kinnitunud |
  |---:|---|
  | 110 | registris olev lehe aadress on vananenud (12 lehte annavad 404 või 403) |
  | 111 | inimene on lehel sama telefoni ja e-postiga, aga registri rollitekst ei klapi lehe omaga |
  | 51 | kuus lehte, millelt kontroll ei leia ühtki oma inimest (Paide, Mustvee, neli Tallinna lehte) |
  | 17 | telefon ja e-post on lehel, aga mitte kohe nime järel |
  | 15 | e-post on lehel kodeeritud või roboti eest peidetud kujul |
  | 15 | roll ei klapi ja ka telefon või e-post pole nime kõrval |
  | 8 | nimi on lehel teisiti kirjutatud |
  | 144 | inimest lehel pole või on telefon või e-post muutunud |

- **Register kahaneb ise.** Kontroll kinnitab või võtab ära, ridu ei paranda keegi: kinnitatud ridu oli 13.09 744, 20.09 740, 27.09 739 ja 04.10 726.
- **Kontroll ei leia uusi inimesi.** Kes registris pole, seda ei otsita. Väike-Maarjal pole registris ühtki rida.

## Otsus

`lib/serviceMap/kovStaffExtract.js` loeb ametlikult lehelt töötajate nimekirja, teadmata ette, kes seal on: iga inimese nimi, amet, osakond (lehe pealkirja järgi), telefonid ja e-postid. Registrit võrreldakse tulemusega pärast.

- **Kolm viisi, kuidas leht inimest näitab, proovitakse selles järjekorras:**
  1. töötajakaart kahel veebiplatvormil, mida enamik omavalitsusi jagab (`kontaktimuster` ja nimelõik `ankur`; `vp-employee`), ning Tartu `entry-contact`. Kaart on kirje ka siis, kui seal pole telefoni ega e-posti;
  2. suurim lehe osa, kus on täpselt üks e-posti aadress (tabelirida, loendi element, tundmatu platvormi kaart), ja sama märgendusega osad, kus e-posti pole. Inimest nimetav tabelirida on kirje ka siis, kui muudel ridadel e-posti pole;
  3. vaba tekst, kus inimesed järgnevad ridade kaupa: inimene ulatub nimest järgmise nimeni. Silt rea alguses („Teeninduspiirkond: …“) ei alusta inimest.
- **E-post loetakse kõigis kujudes, mida platvormid robotite eest peitmiseks kasutavad:** `mailto:`, Cloudflare'i `data-cfemail` ja `/email-protection#…`, `data-enc-email` (rot13 ja `[at]`), tagurpidi tükkidena kirjutatud aadress peidetud täitega (`eeb-rtl`), tekstis `nimi [at] vald.ee`.
- **Amet** on rida nime järel või selle puudumisel nime ees; „amet - nimi“ ja „nimi - amet“ ühel real; paksu kirja piir („**amet** nimi“); vormilehel välja „Ametikoht“ väärtus. Numbritega rida (vastuvõtuajad) ei ole amet.
- **Sotsiaalvaldkond** (`isSocialFieldStaff`): ametis või inimese kohal olevas osakonnapealkirjas on sotsiaalvaldkonna sõna (sotsiaal, lastekaitse, hoolekanne, eestkoste, puue, erivajadus, eakad, tugiisik, koduteenus, toimetulek, heaolu jt). Sotsiaalosakonna pealkirja all on sotsiaalvaldkonna töötaja ka sekretär. Tugiamet (raamatupidaja, finants, IT, koristaja jt) ei ole sotsiaalvaldkonna töötaja ka sotsiaalameti all: omanik märkis 04.10, et Narva sotsiaalabiameti lehel on ka raamatupidajad.
- **Mis ei ole inimene:** täitmata ametikoht, kus nime kohal on ametinimetus („Spetsialist“), ja teenuse postkast („Eluruumi tagamise teenus“). Kui leht ütleb, et töösuhe on peatatud, saab inimene märke `away`.
- **Mida tuvastaja ei tee:** ei tõmba lehti, ei kirjuta registrisse ega otsusta, mida avaldada.

## Kontroll

- **`tests/kov-staff-extract.test.mjs`** (16 testi, väljamõeldud nimede ja aadressidega): mõlema platvormi kaart, kaart ilma kanaliteta, tagurpidi kirjutatud e-post, Cloudflare'i kaitse, „(ät)“ tekstis, tabel (amet nime ees, vastuvõtuaeg pole amet, e-postita rida), Tartu pealkiri, mitu inimest ühes lõigus, „amet - nimi“ lõigud, vormileht, mis ei ole inimene (üldaadress, menüü, jalus), Narva moodi sotsiaalameti leht (täitmata ametikoht, teenuse postkast, peatatud töösuhe, raamatupidaja), kopeeritud kaart vale lingiga, kaardile järgnev lõik, protsentkodeeritud kaitstud aadress ja sotsiaalvaldkonna reegel koos sarnaste sõnadega (teedehooldus, heakord).
- `npm test` ja ESLint läbisid.

## Mõõtmine 04.10.2026

Ainult lugemine, tasuta, mudelita. Tuvastaja jooksis serveris samade 149 ametliku lehe peal, mida iganädalane kontroll tõmbab, ja tulemust võrreldi registriridadega. Väljund on ainult arvud; nimedega tabelid on serveris. Üks jooks.

- **Lehed:** 137 saadi kätte, 12 andsid 404 või 403. Tuvastaja luges 137 lehelt 3010 inimest, neist 1112 sotsiaalvaldkonnas.
- **Kontrollis kinnitatud 726 rida** (teada on, et nimi, roll ja kanalid on lehel kõrvuti):

  | Tuvastaja tulemus | Ridu |
  |---|---:|
  | sama nimi, sama telefon ja e-post | 719 |
  | — neist roll sama | 659 |
  | — roll sarnane (üks sisaldab teist) | 54 |
  | — roll erineb | 6 |
  | nimi leitud, telefon või e-post erineb | 4 |
  | nime ei leitud | 3 |

  Esimene mõõtmine (PR #336 koodiga) andis 711 ja 12. Omanik küsis näidet („too näide, kontrollin“), erinevused vaadati ükshaaval läbi ja kolm tuvastaja viga parandati (jaotis „Seitse erinevust ükshaaval“).

- **Kontrollis kinnitamata 361 rida kättesaadud lehtedel:**

  | Tuvastaja tulemus | Ridu |
  |---|---:|
  | sama nimi, sama telefon ja e-post | 136 |
  | nimi leitud, telefon või e-post erineb | 47 |
  | nime lehelt ei leitud | 178 |

- **Sotsiaalvaldkonna inimesed, keda registris pole:** 327 (sama lehe registriridade nimede järgi).
- **Kolinud lehed.** 12 vigasest aadressist kümnel saidil töötab avalehelt viidatud `/kontakt`; tuvastaja luges sealt töötajad: Narva 196 (36 sotsiaalvaldkonnas), Kuusalu 59 (9), Maardu 54 (11), Jõelähtme 49 (13), Põhja-Sakala 36 (9), Lääneranna 34 (6), Narva-Jõesuu 34 (8), Rakvere vald 32 (5), Kiili 27 (9). Raasiku annab kontrolli päringule 403. Paide (53, 16) ja Väike-Maarja (38, 14) loeti nende praeguselt kontaktilehelt; Mustvee uus leht on leidmata.
- **Narva leht omaniku näitel.** Omanik kleepis 04.10 Narva sotsiaalabiameti lehe teksti. Tuvastaja luges samalt lehelt 36 sotsiaalvaldkonna inimest (Sotsiaalabiamet 8, Lastekaitse osakond 11, Tervise- ja sotsiaalosakond 17), mis vastab kleebitud tekstis nimega inimeste arvule; kaks täitmata ametikohta ja teenuse postkast jäid välja, üks inimene sai märke `away`. Lehe 36 raamatupidamise ametit sotsiaalvaldkonda ei loetud.
- Kinnitatud ridade tabel on mõõdetud parandatud koodiga (faili räsi algus `e489bb49`, LF reavahetustega); ülejäänud arvud andis sama jooks samad mis PR #336 kood (`7570c24f`).

### Seitse erinevust ükshaaval

Kinnitatud 726 reast ei ole tuvastaja tulemus sama seitsmel. Ükski neist ei ole lehelt leidmata jäänud inimene.

- **Kolm „leidmata“ rida ei ole inimesed:** registri nimeväljal on ametinimetus (Vormsi „Hooldustöötaja“, Tallinnas kaks rida „sotsiaaltöö spetsialist“).
- **Kahel real on registris naabri telefon** (üks Nõo ja üks Viljandi valla rida). Lehel on inimese kaardil teine number; registris olev number kuulub lehel järgmisele inimesele. **Praegune kontroll kinnitas vale numbri**, sest tema aken ulatub nimest järgmise registris oleva nimeni ja hõlmab ka vahepealse inimese, keda registris pole. Tuvastaja loeb numbri inimese enda kaardilt.
- **Ühel real on registri e-posti väljal kaks aadressi** (Muhu); leht näitab mõlemat, võrdlus luges välja üheks aadressiks.
- **Ühel real kirjutab leht aadressi täpitähega,** register ilma (Tallinn, Kristiine).

Esimeses mõõtmises oli erinevusi veel kaheksa ja need olid tuvastaja vead, nüüd parandatud:

- **Nähtav tekst võidab lingi sihtmärgi.** Kohtla-Järve ühel kaardil näitab tekst inimese enda e-posti ja telefoni, aga `mailto:` ja `tel:` lingid viivad teise inimese juurde (kaart on kopeeritud). Tuvastaja luges lingid; nüüd loeb seda, mida lugeja näeb, ja lingi sihtmärki ainult siis, kui tekstis aadressi või numbrit pole.
- **Kaardile järgnevad lõigud kuuluvad samale inimesele** kuni järgmise kaardi, pealkirja, e-posti või nimeni. Tallinna Haabersti lehel on mobiilinumber ja tegevusvaldkond kaardi järel eraldi lõigus (7 rida).
- **Kaitstud aadress võib ise olla protsentkodeeritud** (`%c3%b6`); see dekodeeritakse.

## Kontroll kasutab tuvastajat (04.10.2026)

Omanik 04.10: „võib kasutada jah kord nädalas“ ja „kui kontaktide uuendamine on lihtne ja ei häiri platvormi tööd, siis ehk iga nädal“.

- **Mis muutus.** `lib/admin/rag/contactRegistry/pageCheck.js` (uus fail; lehe lugemise funktsioonid toodi sinna `databaseService.js`-ist muutmata kujul üle, et neid saaks andmebaasita testida) otsustab iga registririda nii:
  - **Kui lehe töötajate nimekirjas on sama nimega inimene, otsustab tema enda kirje.** Rida kinnitub, kui kirjel on kõik registri telefonid ja e-postid ning amet klapib. Naabri number enam ei kinnita.
  - **Amet klapib,** kui tekst on sama, üks on teise sees tervete sõnadena („sotsiaaltöö peaspetsialist, asenduskoht“; mitte „linnapea“ sõnas „abilinnapea“), liitsõna on lahku kirjutatud või selle algus on inimese kohal olevas pealkirjas („Sotsiaalosakond“ + „Osakonna juhataja“). Kui kirje ametit ei näita, kinnitab ameti vana tekstiaken.
  - **Sotsiaalkontakt, kelle ametinimetust leht nüüd teisiti sõnastab** („lastekaitse vanemspetsialist“ → „lastekaitse peaspetsialist“), kinnitub, kui leht näitab teda endiselt sotsiaalvaldkonnas. Sellised read loetakse kokku (`roleDiffersContactIds`), et registri amet hiljem ajakohastada. Kes lehe järgi enam sotsiaalvaldkonnas ei tööta, ei kinnitu.
  - **Lehe järgi eemal olev inimene** (töösuhe peatatud, lapsehoolduspuhkusel) ei kinnitu.
  - **Kui nimekirjas sellist nime pole, otsustab vana tekstiaken nagu enne** (näiteks rida, mille nimi on ametinimetus).
- **Mis ei muutunud.** Kontrolli versioon (4), auditikirje kuju, värskusreegel (`contactFreshnessProjection.js`) ja registri sisu. Auditikirjesse lisandusid `staffPeople`, `staffDecidedContacts` ja `roleDiffersContactIds`. Vestluse plaani räsi ei muutu.
- **Kuivjooks serveris enne kasutuselevõttu** (ainult lugemine, sama kood, võrdlus 04.10 hommikuse kontrolliga):

  | | Ridu |
  |---|---:|
  | kinnitatud enne ja nüüd | 722 |
  | uuesti kinnitatud | 136 |
  | enam ei kinnitu | 4 |
  | **kinnitatud kokku** | **858** (enne 726) |

  - Neli, mis enam ei kinnitu: kaks rida, kus registris on naabri telefon (Nõo, Viljandi vald), ja kaks, kus leht ütleb, et inimene on eemal (Keila, Sillamäe).
  - 136 uuest 72 on Tallinnas (amet seisab lehel nime ees või on kaitstud e-post), 8 Anijas ja 7 Raplas (peidetud e-post).
  - Vestluse 376 avaldatud kontaktist on lubatud 370 (hommikul 364; Anija kuus tulid tagasi).
- **Miks mitte kõik 1197.** Registriridu on 1197, eri inimesi (nimi ja omavalitsus) 1066; 131 on sama inimese topeltread. Kuivjooksu järgi:

  | Ridu | Seis |
  |---:|---|
  | 858 | kinnitatud (neist 21 teisiti sõnastatud ametinimetusega) |
  | 110 | registris olev lehe aadress ei vasta (12 lehte) |
  | 89 | nime, telefoni ega e-posti lehel pole |
  | 77 | nime lehel pole, telefon või e-post on |
  | 47 | inimene on lehel, telefon või e-post on muutunud |
  | 12 | nimi on lehe tekstis, aga töötajate nimekirjas mitte ja tekstiaken ei kinnita |
  | 3 | leht ütleb, et inimene on eemal |
  | 1 | amet on muutunud ja pole enam sotsiaalvaldkonnas |

  Esimesed kaks rühma pärast kinnitatuid (110 ja 166) ei tule tagasi kontrolli reegliga: esimesel on vaja uut lehe aadressi, teisel pole inimest enam lehel ja tema asemel on lehel uued inimesed, keda registris pole.
- **Testid:** `tests/service-map-contact-page-check.test.mjs` (13 testi, väljamõeldud andmetega).

## Piirid

- **Sotsiaalvaldkonna reegli täpsust pole silmaga kontrollitud**, välja arvatud Narva näide. 1112 ja 327 on reegli tulemus, mitte ülevaadatud nimekiri; osakonnapealkirja järgi võib sisse tulla ka asutuse töötaja, kes pole ametnik.
- **Jagatud postkast.** Kui tundmatu platvormi lehel on mitmel inimesel üks ja sama e-post ning muid aadresse selles lehe osas pole, loeb tuvastaja nad üheks kirjeks. Kahe ühise platvormi kaartidel seda ei juhtu.
- **Võrdlus on nime järgi sama lehe piires.** Sama nimega kaks inimest või teisiti kirjutatud nimi annab vale vaste.
- **Kinnitamata 361 rea erinevusi pole ükshaaval vaadatud.** Seal on 47 rida erineva kanaliga ja 178 leidmata nimega; kinnitatud ridade näidete järgi võib osa neist olla registri viga, osa tuvastaja oma.
- **Leht ise võib eksida.** Kohtla-Järve kopeeritud kaart ja Kristiine täpitähega aadress on lehe vead; tuvastaja loeb lehte, ta ei tea, mis on õige.
- **Lehte, mille sisu tekib brauseris skriptiga,** tuvastaja ei loe. 04.10 lehtede hulgas selliseid ei leitud, aga seda pole eraldi kontrollitud.
- **Tallinna telefoniraamat** annab ametid ilma osakonnata; sealt leiab reegel vähe sotsiaalvaldkonna inimesi.

## Põhimõte uuendamiseks (omanik 04.10)

Omavalitsuste info muutub (töötajad, teenused, hinnakirjad) ja platvorm peab seda uuendada saama, aga uus info võib olla valesti korjatud. Seepärast:

- **Korjatud info ei kirjuta olemasolevat üle.** Tuvastaja tulemus on ettepanek. Vana väärtus jääb alles, kuni uus on kinnitatud.
- **Lugemine iga nädal** (omanik 04.10: „kui kontaktide uuendamine on lihtne ja ei häiri platvormi tööd, siis ehk iga nädal“). 149 lehe tõmbamine ja lugemine võtab umbes minuti, mudelit ei kasuta ja saidi ega vestluse tööd ei puuduta; praegune kontroll jookseb samamoodi pühapäeva varahommikul.
- **Kinnitamise reegel tuleb otsustada enne ühendamist.** Võimalused: operaatori ülevaatus; sama tulemus kahel järjestikusel lugemisel; ainult lisamine ja kinnitamine automaatselt, muutmine ja eemaldamine ülevaatusega.
- **Sama kehtib teenuste ja hinnakirjade kohta.** Seal on korjamine raskem kui kontaktidel (vaba tekst, PDF-id) ja eksimise hind suurem; see on eraldi töö, mida see muudatus ei alusta.

## Päris jooks ja omaniku otsused (04.10.2026 õhtu)

- **Päris jooks kell 11.47** (kontroll käivitati pärast kasutuselevõttu ühe korra käsitsi): 858 kinnitatud rida, 136 uut ja 4 vähem, täpselt nagu kuivjooksus. Vestluse 376 avaldatud kontaktist oli lubatud 369.
- **Omanik kontrollis nimekirja** inimestest, kelle nime lehel enam pole (166 rida, saadetud failina, mitte repos): „sinu failis olevaid inimesi ma ei leia jah enam, nii et õige“. Paide 17 ja Mustvee 12 rida on erand: registris olev aadress viib vanale `kovtp.ee` lehele ja inimesed võivad uuel lehel alles olla.
- **Kaks numbrit parandati registris** omaniku loal („jah kõigele“): üks Nõo ja üks Viljandi valla rida, kus registris oli lehel järgmise inimese telefon. Omanik kontrollis mõlemad lehed ise üle.
  - Muudatus järgis registri enda reeglit muutunud kontakti kohta (`kovContactSync.js`): revisjon +1 ja `checkedAt` tühjaks; vana ja uus väärtus on auditikirjes `SERVICE_MAP_CONTACT_CORRECTION`.
  - Enne kirjutamist kontrollis skript, et registris on oodatud vana number ja et leht näitab inimese enda kirjel uut numbrit.
  - Kontroll käivitati uuesti: **860 kinnitatud rida.**
  - Mõlemad read on `LEGACY_KOV_CONTACT`, mida failisünkroon ei oma, nii et parandust ei kirjuta miski üle.
- **Leid: vestlus andis neid kaht kontakti vale numbriga 28.09–04.10.** Mõlemad olid vestluses avaldatud ([ADR-045](adr-045-contact-binding-content.md)) registrist võetud vale telefoniga. Alates uuest kontrollist vestlus neid ei anna: enne ei kinnitunud rida, pärast parandust ei klapi seose revisjon. Tagasi tulevad need uue ekspordi ja indeksiga.

## Ettepanekute kiht (04.10.2026 õhtu)

Omanik kiitis 04.10 heaks nii ehitamise kui reegli („jah kõigele“): **muudatus jõustub kahe järjestikuse sama tulemusega lugemise järel või omaniku heakskiidul; automaatselt ei kustutata midagi.** Kehtib ka põhimõte ülal: korjatud info on ettepanek, vana väärtus jääb alles, kuni uus on kinnitatud.

**Seis:** kiht loeb lehti ja arvutab ettepanekud; registrisse pole midagi kirjutatud. Esimene partii on omanikul failina üle vaadata. Iganädalane automaatne rakendamine on ühendamata (jaotis „Tegemata“).

### Kood

- `lib/admin/rag/contactRegistry/proposals.js`: arvutus, puhtad funktsioonid (rea ettepanek, uued inimesed, kolinud lehe järglane, avalehe kontaktilingid, lugemiste seis, automaatse rakendamise valik).
- `lib/admin/rag/contactRegistry/proposalService.js`: lehtede lugemine, registrisse kirjutamine ja tagasivõtmine. Andmebaasiühenduse annab kutsuja, nii et kihti saab testida andmebaasita.
- `scripts/service-map-contact-proposals.mjs` (`npm run service-map:contacts:proposals`): ilma lippudeta ainult loeb ja trükib arvud ning lehtede aadressid; nimed lähevad ainult `--out` faili, mis peab jääma repost välja.
- `tests/service-map-contact-proposals.test.mjs` (15 testi, väljamõeldud andmetega), täiendused failis `tests/kov-staff-extract.test.mjs`.

### Ettepanekuliigid ja tõend

- **Rea muudatus.** Tehakse ainult real, mida kontroll ei kinnita või kinnitab teisiti sõnastatud ametiga, ja ainult siis, kui lehe töötajate nimekirjas on sama nimega inimene.
  - **Telefon või e-post:** uus väärtus on see, mis seisab lehel inimese enda kirjel. Number, mille leht registri omale lisab, ei ole muudatus.
  - **Amet:** muutub ainult kirjelduse rida „Roll: …“; osakond, vastuvõtuaeg ja vastuvõtukoht jäävad.
  - **Lehe aadress:** `sourceUrl` ja `website`, kui see oli sama.
  - Iga muudetud rida lastakse enne läbi kontrolli enda otsuse: kui muudetud rida ei kinnituks, saab ettepanek märke.
- **Uus inimene.** Lehel olev sotsiaalvaldkonna töötaja, keda selle omavalitsuse üheski kontaktireas nime järgi pole (ka peidetud ridades: operaatori peidetud inimest uuesti ei lisata), kellel on telefon või e-post ja kes pole lehe järgi eemal.
  - **Rea väljad:** nimi, „Roll: … Osakond: …“, telefon, e-post, lehe aadress; omavalitsus, maakond, aadress ja koordinaadid tulevad sama lehe registriridadelt (enim kasutatud aadress). Päritolu on `OFFICIAL_KOV_CONTACT`, mida värskusreegel juba lubab ja mida ükski failisünkroon ei oma; `contactFreshnessProjection.js` ei muutu, vestluse plaani räsi ei muutu.
  - Uus rida on `PUBLISHED`, aga `checkedAt` on tühi: kaardile jõuab ta alles siis, kui kontroll on ta lehelt kinnitanud.
  - Mitme valdkonna osakond („Haridus-, kultuuri- ja sotsiaalosakond“) ei tee inimest sotsiaaltöötajaks; seal loeb ainult amet ise.
- **Lahkunud inimene ei ole ettepanek.** Rida, mille nime lehel pole, jääb registrisse ja on peidus nagu praegu. Sama kehtib inimese kohta, kes on lehe järgi eemal või pole enam sotsiaalvaldkonnas.

### Kolinud leht

- Kui registri aadress ei vasta või leht ei nimeta ühtki oma rida (vähemalt kaks rida), otsitakse järglast: operaatori antud aadress (`--pages`) või saidi avalehelt viidatud kontaktilehed ja `/kontakt`.
- Avaleht võib ise olla teisele saidile suunatud; ettepanekusse läheb aadress, kuhu leht pärast suunamisi jõuab.
- **Tõend on nimed:** järglane on leht, mis nimetab vana lehe ridu; enim nimesid andev on esimene. Rida, mida see ei nimeta, läheb järgmisele, mis nimetab. Uued inimesed loetakse ainult esimeselt.
- Kontaktilink on link, mille viimane teeosa või lühike silt seda ütleb. Menüüjaotis, mille nimes on sama sõna (`/vald-uudised-kontakt/eelarve`), ei ole.

### Mis ootab alati omanikku

Korduslugemine ei kaitse lugemisvea eest: sama leht annab tuvastajale kaks korda sama vastuse. Need ettepanekud ei rakendu kahe lugemise reegliga:

- leht ei näita enam telefoni või e-posti (väli tühjeneks);
- registri telefon ega e-post pole kumbki inimese kirjel (rida seob ainult nimi);
- uue lehe tõend on üks nimi mitmest;
- uus inimene on sotsiaalvaldkonnas ainult osakonna pealkirja järgi;
- sama e-post on lehel mitmel inimesel;
- e-posti aadressis on täpitäht;
- ametitekst ei sisalda ühtki ametinimetuse sõna (lehel seisab nime kõrval näiteks kohanimi);
- muudetud rida ei kinnituks.

### Kus seis elab

Ettepanekuid endid ei salvestata: need arvutatakse igal lugemisel lehtedest ja registrist uuesti (149 lehte, 35 sekundit). Salvestada tuleb ainult see, mida uuesti arvutada ei saa, ja see läheb auditikirjetesse (`DataAuditLog`), ilma skeemimuudatuseta.

| Auditikirje | Mida hoiab |
|---|---|
| `SERVICE_MAP_CONTACT_PROPOSAL_READ` | lugemiste seis: iga ettepaneku võti, sisu räsi ja mitu lugemist järjest on sama andnud; omaniku tagasi lükatud räsid. Nimesid ei ole. Viimane kirje kannab seisu edasi nagu kontrolli oma. |
| `SERVICE_MAP_CONTACT_PROPOSAL_APPLIED` | üks kirje muudetud või lisatud rea kohta: vana ja uus väärtus, revisjon enne ja pärast, ametlik leht, tõend, alus (omaniku heakskiit või kaks lugemist), partii. |
| `SERVICE_MAP_CONTACT_PROPOSAL_BATCH` | partii kokkuvõte arvudena. |
| `SERVICE_MAP_CONTACT_PROPOSAL_REVERTED` | tagasi võetud muudatus. |

- **Miks mitte tabel.** Tabel oleks skeemimuudatus tootmises, aga hoida on vähe: seisu loeb ainult see kiht ise kord nädalas ja rakendatud muudatus on olemuselt auditikirje. Tabel tasub ära siis, kui ettepanekuid hakkab admini vaates otsustama mitu inimest; üleminek ei kaota midagi, sest ettepanekud arvutatakse uuesti.
- **Miks eraldi kirje, mitte kontrolli kirje sees.** Kontrolli viimast kirjet loeb iga kaardi- ja vestluspäring; ettepanekute seis seda ei koorma.
- Auditikirjeid ei kustuta koodis miski.

### Rakendamine ja tagasivõtmine

- **Rakendamine** (`applyContactProposals`) nõuab alust: omaniku heakskiit või kaks lugemist. Kõik käib ühes tehingus sama lukuga, mida kontroll oma kirjutamisel võtab.
  - Rida kirjutatakse ainult siis, kui ta on täpselt see, mida ettepanek luges: sama revisjon, samad vanad väärtused, avaldatud. Vahepeal muutunud rida jäetakse vahele ja nimetatakse.
  - Muudetud rida järgib registri reeglit: revisjon +1, `checkedAt` tühjaks. Midagi ei kustutata.
  - Uus inimene lisatakse ainult siis, kui registris pole vahepeal sama rida ega sama nimega inimest; sama ettepanek kaks korda ei tee kaht rida.
- **Skript rakendab ainult seda, mida ülevaadatud nimekiri ja tänane lugemine mõlemad annavad** (sama räsi). Leht või rida, mis pärast ülevaatust muutus, jääb ootama. Ilma `--yes` liputa skript ainult ütleb, mida teeks.
- **Omaniku vastus käib numbrite järgi:** märketa ettepanek rakendub, kui teda pole nimetatud lipuga `--except`; omaniku otsust ootav ainult siis, kui ta on nimetatud lipuga `--also`; `--hold` jätab ettepaneku hilisemaks. Ülejäänu märgitakse tagasi lükatuks. Vale number peatab jooksu.
- **Tagasivõtmine** (`revertContactProposals`, partii kaupa või võtmete järgi): muudetud rida saab vanad väärtused tagasi (revisjon +1, `checkedAt` tühjaks), lisatud rida peidetakse, mitte ei kustutata. Rida, mida keegi pärast partiid muutis, jäetakse puutumata. Tagasi võetu läheb tagasi lükatute hulka.

### Kahe lugemise reegel

- **Lugemine loeb, kui see tuleb vähemalt viis päeva pärast eelmist loetut**; samal hommikul kaks korda käivitatud kontroll on üks lugemine.
- Ettepanek, mida leht enam ei anna või annab teisiti, alustab otsast.
- Tagasi lükatud ettepanek ei rakendu, kuni leht annab sama.
- **Korraga palju muudatusi ei rakendu ilma omanikuta:** üle 10 ühel lehel või üle 40 ühes jooksus näeb välja nagu ümber ehitatud leht või lugemisviga, mitte nädala muudatused.
- Reegel on kood ja testid (`nextProposalState`, `automaticProposals`); iganädalase kontrolliga on ta ühendamata.

### Tuvastaja parandused

Esimest nimekirja läbi vaadates leiti kolm tuvastaja viga. Need muudavad ka iganädalast kontrolli.

- **E-post looksulgudes:** Haapsalu leht kirjutab `nimi{ätt}linn.ee`. Tuvastaja loeb nüüd „at“, „ät“ ja „ätt“ igasugustes sulgudes. Enne pakkus kiht seitsmel real e-posti eemaldamist.
- **Amet nime ees suure tähega** („Spetsialist Mari Maasikas“, Tallinna linnaosade lehed): ametinimetus pole eesnimi. Pärast parandust leiab nimi registrist vaste ja uusi inimesi on 13 vähem.
- **Sotsiaalvaldkond ei ole** sotsiaalmeedia, erakonna nimi ega volikogu komisjon; komisjoni või volikogu liige ja bussijuht ei ole sotsiaaltöötaja.
- **Mõju kontrollile** (sama kood, võrdlus 04.10 kell 11.54 kirjega, ainult lugemine): kinnituks 869 rida (praegu 860), juurde Haapsalu 7 ja Tallinn 2, ükski ei kao.

### Kuivjooks serveris (04.10.2026, ainult lugemine, mudelita)

Kood jooksis ajutises kaustas, mis viitab jooksvale väljalaskele ja hoiab muudetud faile; väljund on arvud ja lehtede aadressid.

| | Ridu |
|---|---:|
| registriridu | 1197 |
| kinnitatud, muudatuseta | 846 |
| **ettepanek: leht kolinud** | 108 |
| **ettepanek: telefon või e-post muutunud** | 35 |
| **ettepanek: amet teisiti sõnastatud** | 23 |
| nime lehel pole (jääb peitu) | 177 |
| inimene eemal (jääb peitu) | 4 |
| pole enam sotsiaalvaldkonnas (jääb peitu) | 4 |

- **Uusi inimesi:** 189.
- **Kokku 355 ettepanekut:** 278 ilma märketa (107 kolinud lehe rida, 30 kanalimuutust, 22 ametit, 119 uut inimest) ja 77 omaniku otsust ootavat (63 uut inimest ainult osakonna pealkirja järgi, 7 muud uut inimest, 7 olemasolevat rida).
- **Ükski ettepanek ei saanud märget „ei kinnituks“:** kontrolli enda otsus kinnitaks iga muudetud ja lisatud rea.
- **Kolinud lehed:** kõik 149 lehte said loetud või järglase. 14 lehte 12 saidil (Jõelähtme 2, Lääneranna 2, Kiili, Kuusalu, Maardu, Mustvee, Narva, Narva-Jõesuu, Paide, Põhja-Sakala, Raasiku, Rakvere vald); nende 139 reast nimetavad uued lehed 109.
  - Paide aadressi andis omanik: vana `kovtp.ee` aadress suunab nüüd platvormi pakkuja lehele.
  - Mustvee vana aadress suunab ise uuele saidile; enim nimesid annab sealne sotsiaalvaldkonna ametnike leht.
  - Raasiku `/kontakt` annab endiselt 403, teenistujate leht vastab.
- **Kuus Tallinna lehte (26 rida) ei nimeta ühtki oma rida** ja avalehelt järglast ei leitud; need read jäävad peitu.
- **Vestlus:** 23 teisiti sõnastatud ametiga reast kuus on vestluses avaldatud. Ameti muutmine lõpetab nende seose (ADR-045), kuni tehakse uus eksport ja indeks.
- **Viis jooksu ja mis neist õpiti** (igaüks 35 s):
  - 371 ettepanekut, neli lehte kättesaamatud: avalehe lingiotsing võttis menüüjaotise nime kontaktileheks.
  - 424: kõik lehed käes, aga uute inimeste seas olid volikogu komisjonide liikmed ja mitme valdkonna osakondade haridus- ja kultuuritöötajad.
  - 374: uute inimeste reeglid rangemad; Haapsalu e-postid lugemata.
  - 368: Haapsalu loetud; 13 inimest topelt, sest amet oli nime osa.
  - 355: lõplik.

### Piirid

- **Uue inimese sotsiaalvaldkond on reegli tulemus.** 119 märketa uut inimest on need, kelle amet ise valdkonda nimetab; ametite loetelu vaadati läbi, inimesi ükshaaval mitte. See on omaniku ülevaatuse töö.
- **Sama inimene teise nimega.** 61 uut inimest vastab telefonile või e-postile, mis on registris teise nimega real. Enamasti on see järglane samal töökohal (eelkäija rida on peidus); nime muutnud inimene saab uue rea ja vana jääb peitu.
- **Omavalitsus ilma registrireata** (Väike-Maarja) jääb kihist välja: pole lehte, mida lugeda, ega rida, millelt asukoht võtta.
- **Inimene, kes liikus sama omavalitsuse teisele lehele,** ei saa ettepanekut: oma lehel teda pole ja uuena teda ei pakuta, sest nimi on registris.
- **Ametiteksti reegel on sõnaloend.** Haruldane ametinimetus saab märke ja ootab omanikku; see on kavatsetud suund.

### Tegemata

1. **Omaniku ülevaatus ja esimese partii rakendamine.** Nimekiri on serveris (`rag-v2-work/eval-files/contact-proposals-2026-10-04.json`) ja omanikul loetava failina. Rakendamine on tootmisandmebaasi muutmine ja ootab omaniku luba.
2. **Kontroll pärast rakendamist** ja kaardil nähtava arvu võrdlus. Ootus, kui märketa ettepanekud rakendatakse ja lehed ei muutu: 869 + 107 + 30 + 119 = 1125 nähtavat kontakti.
3. **Iganädalane ühendamine:** lugemise salvestamine ja kahe lugemise reegli rakendamine kontrolli eel. Teenuse ühik ütleb praegu, et kontroll ei kirjuta kontaktiandmeid ümber; see muutub ja tuleb omanikuga kokku leppida pärast esimest partiid. Enne ühendamist tuleb lisada reegel, et teisele saidile kolinud leht ootab alati omanikku: esimeses partiis on selliseid kaks (Paide ja Mustvee) ja omanik näeb neid nimekirjas.
4. **Vestlus:** uus eksport ja indeks toovad muudetud ja uued kontaktid vestlusse. Tasuline samm, vajab eraldi luba.
5. **Väike-Maarja** ja kuus Tallinna lehte.

## Kus on andmed

Nimedega tabelid on ainult serveris, mitte repos: `rag-v2-work/eval-files/contact-recheck-2026-10-04.csv` (paketikontaktid pärast kontrolli), `contact-diagnose-2026-10-04.csv` (miks rida ei kinnitu) ja `contact-proposals-2026-10-04.json` (esimene ettepanekute partii numbrite ja räsidega). Mõõtmise skriptid on `rag-v2-work/eval-app/` kaustas (`contact-*-1004.mjs`, `kov-*-1004.mjs`).
