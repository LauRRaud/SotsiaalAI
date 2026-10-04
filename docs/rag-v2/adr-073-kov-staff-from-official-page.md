# ADR-073 — Omavalitsuse töötajad loetakse ametlikult lehelt, mitte ei otsita registri rida lehelt üles

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10: „kodeering või kontroll peab olema selline, et suudame tuvastada kõik sotsiaalvadkonna töötajad KOV lehelt“ ja samal päeval: „oluline, et uus info võib olla valesti korjatud ja vale, et vana õige üle ei kirjutaks“. Jätkab [ADR-017](adr-017-verified-contact-export.md) ja [ADR-045](adr-045-contact-binding-content.md) kontaktiteemat.

**Seis 04.10.2026 õhtul:** iganädalane kontroll kasutab tuvastajat (omanik 04.10: „võib kasutada jah kord nädalas“; jaotis „Kontroll kasutab tuvastajat“). Registri sisu kontroll ei muuda: uued inimesed, muutunud numbrid ja kolinud lehtede aadressid on järgmine samm ja vajavad omaniku otsust (jaotis „Tegemata“).

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

## Järgmine samm: ettepanekute kiht (omanik 04.10: „jah kõigele“)

Omanik kiitis heaks nii ehitamise kui reegli: **muudatus jõustub kahe järjestikuse sama tulemusega lugemise järel või omaniku heakskiidul; automaatselt ei kustutata midagi.** Kehtib ka põhimõte ülal: korjatud info on ettepanek, vana väärtus jääb alles, kuni uus on kinnitatud.

Mida kiht peab tegema:

1. **Kolinud lehe aadress** (110 rida 12 lehel, lisaks Paide 17 ja Mustvee 12 vanal `kovtp.ee` lehel).
   - Kui registris olev aadress ei vasta või leht ei näita ühtki oma inimest, otsida praegune kontaktileht: avalehelt viidatud `/kontakt` töötas 04.10 üheksal saidil kümnest; Paide praegune leht on `paide.ee/linn-uudised-ja-kontakt/kontakt-ja-uudised/kontakt/`, Mustvee oma `mustvee.ee/juhtimine/kontaktid/`; Raasiku annab kontrolli päringule 403.
   - Uus aadress on ettepanek rea `sourceUrl` kohta. Tõend: mitu selle lehe registririda leidub uuel lehel nime järgi.
2. **Muutunud telefon, e-post või amet** (47 rida erineva kanaliga; 22 rida, mille ametinimetust leht teisiti sõnastab, on auditikirjes `roleDiffersContactIds`).
3. **Uued inimesed:** lehel olevad sotsiaalvaldkonna töötajad, keda registris pole (04.10 mõõtmises 327, lisaks kolinud lehtede omad). Uus rida vajab registri kohustuslikke välju ja päritolu, mida värskusreegel lubab (`SERVICE_MAP_VERIFIABLE_CONTACT_NAMESPACES`); selle faili muutmine muudab vestluse plaani räsi.
4. **Lahkunud inimesed** jäävad nagu praegu: rida ei kinnitu ja on peidus; ei kustutata.

Mida tuleb enne ehitamist otsustada või läbi mõelda:

- **Kus ettepanekud ja lugemiste ajalugu elavad.** Kontrolli enda seis on auditikirje metas; sama koht ei vaja andmebaasi migratsiooni. Eraldi tabel on puhtam, aga on skeemimuudatus tootmises.
- **Esimene partii on suur** (suurusjärgus 500–650 ettepanekut) ja sündis tuvastaja esimesest lugemisest. Korduslugemine ei kaitse tuvastaja enda vea eest, sest tuvastaja annab samal lehel sama tulemuse. Esimene partii tuleks anda omanikule failina üle vaadata, nagu „lehel enam pole“ nimekiri; kahe lugemise reegel sobib edasiste väikeste nädalamuutuste jaoks.
- **Registrisse kirjutamine:** muudetud real revisjon +1 ja `checkedAt` tühjaks, iga muudatus auditikirjega (vana ja uus väärtus), nagu 04.10 kaks parandust. Muudetud rea vestluse seos lõpeb (ADR-045), seega vajab vestlus pärast partiid uut eksporti ja indeksit; see on tasuline samm ja vajab eraldi luba.
- **Tuvastaja teadaolevad piirid** on jaotises „Piirid“; 12 rida, mille nimi on lehe tekstis, aga nimekirjas mitte, on läbi vaatamata.

## Kus on andmed

Nimedega tabelid on ainult serveris, mitte repos: `rag-v2-work/eval-files/contact-recheck-2026-10-04.csv` (paketikontaktid pärast kontrolli) ja `contact-diagnose-2026-10-04.csv` (miks rida ei kinnitu). Mõõtmise skriptid on `rag-v2-work/eval-app/` kaustas (`contact-*-1004.mjs`, `kov-*-1004.mjs`).
