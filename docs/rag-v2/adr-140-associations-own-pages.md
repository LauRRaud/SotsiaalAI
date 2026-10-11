# ADR-140: ühingute enda lehed (korpus v78)

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v78 on serveris töös alates 11.10.2026 02:37; otsing ja katvus mõõdetud tasuta; vastused mõõdetud 36 pöördega (allpool).**

## Miks

Omaniku nimekirjafaili (`tmp/rag-sisu-korjamise-nimekiri-2026-10-10.md`) neljas küsimus oli, kas mittetulundusühingute lehed tohivad kogusse minna nagu varem organisatsioonide lehed. Omanik 11.10.2026: „mittetulundusühingute lehed - need ka sisse panna“. Korpuses v77 olid ühingutest sees puuetega inimeste organisatsioonid, Toidupank ja sotsiaaltöö assotsiatsioon ([ADR-095](adr-095-web-pages-as-corpus-sources.md), [ADR-137](adr-137-coverage-batch-and-the-law-of-obligations-act.md)). Katvuse kaardil on ühingute töö kõige rohkem seotud ridadega vaimse tervise kriis, psüühikahäire, lähisuhtevägivald, seksuaalvägivalla ohver, sõltuvus, lähedase hooldamine, elu lõpp ja lein.

## Mis läks sisse

**314 lehte üheksalt ühingult, 184 214 sõna, 1789 lõiku.**

| Ühing | Sait | Lehti | Mis |
|---|---|---:|---|
| MTÜ Peaasjad | peaasi.ee | 230 | ärevus, depressioon, söömishäired, psühhoos, bipolaarne häire, enesevigastamine ja enesetapumõtted, lein ja trauma, sõltuvus, uni, stress ja läbipõlemine; kuidas ennast ja lähedast aidata, kuidas rääkida; kust abi leida, nõustamine, vaimne tervis töökohal |
| Eesti Seksuaaltervise Liit | seksuaaltervis.ee | 26 | noorte nõustamiskeskused, „Küsi nõu“, rasedus, raseduse katkestamine ja katkemine, rasestumisvastased meetodid, hädaabimeetodid, suguhaigused, HIV |
| Naiste Tugi- ja Teabekeskus | naistetugi.ee | 20 | abi ööpäev läbi ja abiasutused, perevägivald, emotsionaalne vägivald, ohumärgid, vägivalla tsükkel, miks ohver ei lahku, kuidas aidata, vägivald ja lapsed, eakatevastane vägivald, seksuaalvägivald ja ohvri tugiisiku juhend, õigusalane info |
| MTÜ Pallium | pallium.ee | 12 | haigusega toimetulek kodus: sümptomaatiline ravi, õhupuudus, kõhulahtisus, meeleoluhäired, toetavad teraapiad, taastusravi, kasvajavastane ravi, koduõendus, õendusabi haiglas, hospiits, turvalisuse abivahendid |
| Hasartmängusõltuvuse Nõustamiskeskus | 15410.ee | 10 | hasartmängusõltuvus ja digisõltuvus, enesetestid, nõustamine ja psühhoteraapia, kontakt ja hinnad |
| MTÜ Lastekaitse Liit | lastekaitseliit.ee | 6 | lapse õigused ja nende ABC, korduvad küsimused, kuhu pöörduda abi saamiseks, hea nõu lastega peredele, tasuta õigusabi võimalused |
| Hingehoid | hingehoid.ee | 4 | mis on hingehoid, „Vajan tuge“, hingehoiutelefon, hingehoiukeskus |
| MTÜ Eesti Omastehooldus | omastehooldus.eu | 3 | abiks omastehooldajale (käsiraamatud ja juhendid), omastehoolduse kümme teesi, ühingud ja ametid |
| Eesti Juristide Liit | juristaitab.ee | 3 | mis on tasuta õigusnõustamine, nõustamiskohad, teised õigusnõustajad |

Loend, iga leht oma aadressiga: `Andmebaasi/register/web_pages_associations.json`. Lehtede tekstid ei ole repos samal põhjusel mis ADR-137 lehtedel: valikureegel võtab neist lõike välja.

## Kuidas lehed valiti

1. **Lugemine** (tasuta, korjaja `rag-v2/web-page-2`). Kümne saidi avalehelt kaks taset allapoole; Peaasi suurest saidist 252 lehte saidikaardi järgi teema kaupa (ilma ürituste, koolituste, kampaaniate, poe, annetuste, testide, lugude ja teiskeelsete lehtedeta); Palliumi 34 artiklit patsiendile ja lähedasele eraldi aadressidega (avaleht ise on skriptiga joonistatud ja andis esimesel lugemisel viis lehte). Kokku loeti 489 lehte.
2. **Valikureegel** (`scripts/rag-v2-web-select.mjs`): 411 lehte. Välja jäi 78: alla 30 sõna lehed (31), peamiselt inimestest rääkivad lehed (33), skriptiga joonistatud lehed (4), foorumi, uudiste, toetajate ja aruannete lehed (4) jt; 60 lehest võeti välja inimest nimetavad lõigud (122 lõiku).
3. **Minu valik reegli tulemusest** (pealkirjade ja tekstide järgi, leht lehe haaval; `tmp/rag-v2-v78/tools/choose.mjs`): 314 lehte. Välja jäi 97 lehte, mida reegel ei oska ära tunda:
   - lehed, mis räägivad ühingust endast, mitte abist: ajalugu, põhimõtted, projektid, kampaaniad, uudised, puhkuseteated, raamatututvustused (Lastekaitse Liidu 17 lehest 11, Hingehoiu üheksast viis, Eluliini kümnest üheksa);
   - teiskeelsed lehed ning pakkumised kuupäeva ja hinnaga (tugigrupp, koolitused);
   - arvamuslood ja kirjanduse loetelu naiste tugikeskuse saidil;
   - **Palliumi kokkuvõtted riigi ja omavalitsuse toetustest** (töövõime hindamine, puude raskusaste, hooldusleht, hooldekodu jt, 13 lehte): need on kirjutatud 2019–2020, hooldekodu kohta käiv on vanem kui 2023. aasta hooldereform, ja korpuses on iga teema kohta asutuse enda leht;
   - **juristaitab.ee õigusartiklid** (26 lehte): kahe taseme lugemine sai neist kätte paarkümmend, rubriigis on neid umbes kaks tuhat. Juhuslik paarkümmend ei ole valik; rubriik tervikuna on omaette otsus (vt „Lahtine“);
   - **Eluliini emotsionaalse toe telefoni leht** (48 sõna): lugeja võttis lehe pealkirjaks lingi teksti „Loe lisa >“, ja selle nimega allikas oleks vastuse viites eksitav. Leht tuleb sisse järgmise lugemisega, kui lugeja võtab pealkirja lehe enda pealkirjast.

Enne pakkimist vaadati paigutatud lehed üle (see õppetund on ADR-137-st): korduvaid plokke lehtede sees (menüü, jalus) ei ole üheski saidis üle ühe protsendi sõnadest (seksuaaltervis.ee nuppude ja vahepealkirjade tekst, 179 sõna 20 863-st); autori-, tõlkija- ja koostajaridu ei jäänud; e-posti aadressid on ühingute ja tugikeskuste üldaadressid; lingi sihtkohtades olevad @-märgid on kaardilingid.

**Minu enda viga, mis tuli välja enne serverisse saatmist.** Lugemisnimekirjas oli väljajätumuster, mille võtsin üle organisatsioonide nimekirjast („toeta“, „sündmus“, „koolitus“ jt). See jättis välja kümme head Peaasi lehte („Soovitused leinaja toetajale“, „Kuidas toetada lähedast, kui tal on söömishäire?“, „Enesetoetamine“, „Traumaatilised sündmused … töökohal“ jt) ja Palliumi „Toetavad teraapiad palliatiivses ravis“. Märkasin seda dokumendi arve kontrollides, kui esimene pakk oli pooleldi üles laetud; peatasin laadimise, lisasin 11 lehte teise partiina ja pakkisin uuesti. Lõplikus nimekirjas mustrit ei ole: otsustavad reegel ja lehe haaval tehtud valik.

## Valikureegli täiendused

Lugemine tõi välja kohad, kus reegel eksis, ja need on parandatud reeglis endas (`lib/rag-v2/web-select.js`, `web-select-words.js`, testid):

- **Suurtähtedega pealkiri „KUST LEIDA ABI JA TUGE?“** loeti inimese nimeks (Leida on eesnimi) ja Peaasi kõige olulisem leht jäi välja. Sõna „abi“ on nüüd tavasõnade loendis.
- **„Soovitused leinaja toetajale“** jäi välja kui toetajate (annetajate) leht. Sõna „toetaja“ alaleütlevas käändes („toetajale“, „toetajatele“) on juhis toetavale inimesele, mitte annetajate leht.
- **118 sõnapaari**, mida reegel pidas inimese nimeks ja mis on asutused, võrgustikud, kohad, väljaanded, tooted, filmid või kahe tavasõna loetelu („Befrienders International“, „Seksuaaltervise Kliiniku“, „Põhja-Eesti Pimedate“, „Vastandumine Õiendamine“, „Music Therapy“), lisati loendisse `NOT_PERSONS`, igaüks ükshaaval vaadatud. Palliumi artiklid on salvestatud ühe lõiguna, nii et üks selline paar võttis välja terve artikli.
- Eesnimede loendisse lisati üks nimi, mille taga oli tõlkija rida kahel lehel.
- Ülevaatuse reegel (`scripts/rag-v2-review-by-rule.mjs`) tunneb nüüd ka ühingu lehel hoiatust, et lehe lõpus olevat viidete loendit ei tükeldata (üks leht).

Eelmise täienduse 565 lehe peal annab reegel enne ja pärast neid täiendusi sama tulemuse (560 samad, 3 muutunud, 2 väljas mõlemal juhul; need viis tulevad sellest, et reegli üks tunnus sõltub koos loetud lehtede sõnavarast, mitte tänasest muudatusest).

## Mida ei saanud lugeda

- Anonüümsed Alkohoolikud (aaestonia.com): sait ei vastanud kahel katsel aja jooksul.
- convictus.ee: avaleht on skriptiga joonistatud. lastekriis.ee: saidi robotite fail keelab lugemise. kuldneliiga.ee ja al-anon.ee ei vastanud.
- Palliumi artiklid „Hingehoidlik tugi“ ja „Patsientide ühingud ja tugigrupid“: kumbki nimetab ühte inimest ja on salvestatud ühe lõiguna, nii et reegel võtab välja terve artikli.
- Eluliini psühholoogilise kriisinõustamise leht on 27 sõna ja jääb reegli alampiiri alla.

## Eelkontrollid ja ost

| | Enne | Pärast | Piir |
|---|---:|---:|---:|
| Dokumente | 9288 | 9602 | 10 000 |
| Lõike | 88 181 | 89 970 | 100 000 |
| Vaba ketast serveris | 18 GB | 17 GB | |

Kohalik arvestus: 1789 lõiku, 1784 erinevat sisendit, umbes 618 000 märki, hinnaga 0,13 USD miljoni märgi kohta 0,080 USD. Lagi 0,10 USD ja kuni 1800 sisendit (minu pandud; omaniku sõnad lubavad lehed sisse panna, summat ta ei nimetanud).

| Käik | Sisendeid ostetud | Märke | Hind | Indeks | Dokumente | Lõike |
|---|---:|---:|---:|---|---:|---:|
| v78 | 1784 | 616 823 | 0,0802 USD | `98359144` | 9602 | 89 970 |

Serveri tasuta plaan näitas enne ostu täpselt kohalikku arvestust (1784 sisendit, 0,0802 USD). Vestlusplaan: `/etc/sotsiaalai/m4-corpus-chat-20261011b.json`. Järgmine alus: põhikausta `tmp/rag-v2-v78/ship/policy.json` (9602 dokumenti).

Käik algas ajal, mil teise seansi muudatuse kasutuselevõtt oli pooleli (kontrollisin seda samas käsus, millega käigu käivitasin, ja käsk ei oodanud vastust ära). Kasutuselevõtt lõppes enne, kui käik vestlusplaani vahetas, ja lõpus töötab teenus uue plaaniga; õige järjekord on enne oodata, siis käivitada.

## Mõõdetud pärast täiendust (tasuta, serveris)

**Otsinguvärav** (33 raske tingimusega küsimust, võrdlus korpuse v77 alusega): vigu 0, otsustav lõik ei kadunud ühelgi küsimusel ega liikunud tahapoole; 31 küsimust täpselt samad, kahel vahetus üks kandidaat. Otsingu aja mediaan 5249 ms enne ja 4738 ms pärast. Vaimse tervise ja vägivalla lehed ei tõrju seaduse sätteid nende küsimuste kandidaatide seast.

**Katvuse kaart** (34 olukorda ja 15 töö teemat, 294 lahtrit): ühegi lahtri olek ei muutunud (piisav 235, õhuke 48, ainult seadus 7, ainult uuring 4, nagu v77-l). Ühingute lehed lisandusid ridadele, kus lahtrid olid ametlike lehtedega juba täidetud; kaart loeb nüüd ühingute lehti nii:

| Rida | Ühingute lehti enne | Pärast |
|---|---:|---:|
| Sõltuvus (alkohol, narkootikumid, hasartmäng) | 1 | 22 |
| Vaimse tervise kriis ja enesetapumõtted | 0 | 20 |
| Psüühikahäirega täiskasvanu | 23 | 33 |
| Lapse sünd ja väikelapsega pere | 1 | 12 |
| Lähisuhtevägivald | 0 | 8 |
| Lähedase surm ja lein | 0 | 5 |
| Kuriteo või seksuaalvägivalla ohver | 0 | 4 |
| Raske haigus ja haiglast koju | 37 | 41 |
| Lähedase hooldamine kodus | 2 | 5 |
| Elu lõpp | 1 | 3 |

Elu lõpu rea õhukesed lahtrid (raha, kohalik kord, ootamise ajal, õigused) jäid õhukeseks: Palliumi lehed selgitavad haigust ja hooldust, mitte seda, kes maksab ja kuidas taotleda.

## Tasuline vastuste kontroll (11.10.2026)

Omanik 11.10.2026, kui olin öelnud mahu ja hinna (36 pööret, umbes 0,15 USD, lagi 0,18 USD): „koosta küsimused ja küsi ära“. 18 küsimust, mis algavad inimese murest, igaüks kaks korda päris vestluse rajal, korpusel v78 (`w4/check96` serveris; küsimused `tmp/rag-v2-v78/check96/questions.json`). **36 pööret, vigu 0, kõik vastused läbisid kontrolli, 0,1244 USD.** Ühtegi kohta ei loetud küsimusest valesti.

| Küsimus | Millele vastus viitas |
|---|---|
| Tütar lõikab ennast | Peaasi „Kuidas aidata kedagi, kes end vigastab?“ (2/2) |
| Sõber ei jaksa enam elada | Peaasi „Kuidas aidata enesetapumõtetega …“ ja „Kust leida abi ja tuge“ (2/2), ohvriabi leht; vastus ütleb, mida küsida, millal helistada 112 ja kuhu veel |
| Paanikahood | Peaasi „Paanikahäire“, „Ärevushäirete ravi“, korduvad küsimused (2/2) |
| Lein pärast abikaasa surma | Peaasi „Keha reageerib“, „Soovitused enesehooleks“, „Kust leida abi ja tuge“ (2/2) |
| Ema räägib häältest | terviseportaali „Arstiabi“; Peaasi „Millal pöörduda spetsialisti poole“ (1/2). Peaasi leht psühhoosi haigestunu lähedasele oli ühel korral kandidaatide seas, aga mudelile seda ei antud |
| Mees kontrollib telefoni ja raha | noorteinfo portaali ja ohvriabi lähisuhtevägivalla lehed. Naiste tugikeskuse „Emotsionaalne vägivald“ oli mõlemal korral kandidaatide seas, aga mudelile seda ei antud |
| Õde ei lahku vägivaldse mehe juurest | naiste tugikeskuse „Kuidas aidata?“ (2/2) |
| Vend võtab 80-aastase ema pensioni | ohvriabi ja ministeeriumi lehed, ajakirja artiklid; vastus nimetab majanduslikku väärkohtlemist ja kriisitelefoni |
| 16-aastane kardab rasedust | Seksuaaltervise Liidu „Rasedus“ ja „Küsi nõu“ (2/2) |
| Isa õhupuudus kodus | Palliumi „Õhupuudus“ (2/2), Regionaalhaigla palliatiivravi keskus; vastus algab sellega, et tugeva õhupuuduse korral helista 112 |
| Mis on hospiits | Kliinikumi „Palliatiivravi ja hospiits“ (2/2), Palliumi „Hospiits“ (1/2) |
| Poeg mängib ööd läbi arvutis | nõustamiskeskuse „Digisõltuvus“ ja Peaasi „Arvutisõltuvus“ olid mudelile antud; vastus viitas Peaasi lehele ühel korral ja toetus muidu koolikohustuse sätetele ja lasteabile |
| Palk kasiinosse ja kiirlaen | Hasartmängusõltuvuse Nõustamiskeskus (2/2), „Maksejõuetus“ |
| Lapse arvamus vanemate lahkuminekul | lastekaitseseadus ja tsiviilkohtumenetluse seadustik; Lastekaitse Liidu lehti ei olnud vaja |
| Dementset ema hooldav lähedane on läbi | Dementsuse Kompetentsikeskuse lehed (varasem sisu); Omastehoolduse lehed ei olnud kandidaatide seas |
| Tasuta õigusnõu | ametlik „Õigusabi“ (2/2), Juristide Liidu „Teised õigusnõustajad“ (1/2) |
| Telefonikelmus | ohvriabi „Kelmuse ohvriks sattudes saab tuge ka ohvriabist“ (2/2; korpuse v76 sisu) |
| Kliendi terviseandmed perearstilt (spetsialist) | Andmekaitse Inspektsiooni lehed (2/2; korpuse v76 sisu), omavalitsuse sotsiaalteenuse üldjuhend |

Ühingute lehtedele suunatud 16 küsimusest 12 puhul viitas vastus vähemalt ühel korral ühingu lehele. Ülejäänud nelja vastas vestlus teiste allikate põhjal (seadus, ametlik leht, varasem organisatsiooni leht) ja ükski neist vastustest ei olnud selle pärast vale. Kahes küsimuses (emotsionaalne vägivald, psühhoos) jõudis ühingu leht kandidaatide sekka, aga mitte mudelile antud lõikude hulka: samal teemal on korpuses mitu lehte ja valik võttis teised.
## Järeltäiendus v80: neli ühingut, mida esimesel korral ei saanud lugeda (11.10.2026)

Omanik 11.10.2026, kui olin öelnud, mis jäi lugemata: „AI-Anon ja teised proovi ikka. Minu luba antud osta vektorid.“ Proovisin uuesti ja kolm asja, mida olin enne öelnud, osutusid valeks või aegunuks:

- **Laste ja Noorte Kriisiprogramm (lastekriis.ee).** Olin kirjutanud, et saidi robotite fail keelab lugemise. See ei ole nii: keeld „Disallow: /“ käib failis ainult nimetatud otsirobotite kohta, tavalisele lugejale on lehed lubatud (paus kaks sekundit). Minu viga faili lugemisel.
- **Anonüümsed Alkohoolikud (aaestonia.com).** Kaks esimest katset aegusid; nüüd vastas sait tavalisele lugejale.
- **Convictus (convictus.ee).** Avaleht aadressil ilma www-ta andis viis sõna; aadressil www.convictus.ee on lehed loetavad.
- **Al-Anon.** Arvatud aadressid ei olnud olemas; päris aadress (alanoneesti.wordpress.com) oli Anonüümsete Alkohoolikute lehel.

Brauserit ei läinud ühegi jaoks vaja. Sisse läks **57 lehte** (15 161 sõna, 216 lõiku):

| Ühing | Lehti | Mis |
|---|---:|---|
| Convictus Eesti MTÜ | 26 | abi tarvitajale, lähedasele ja kogukonnale; viis kahjude vähendamise keskust ja buss; programm SÜTIK; 15 teenust (nõustamine, süstlavahetus, naloksoon, kiirtestimine, tugiisik, päevakeskus jt) |
| Anonüümsed Alkohoolikud | 21 | mis AA on ja ei ole, kas AA on sinu jaoks, 15 nõuannet, kuidas rühm toimib, korduvad küsimused, sotsiaal- ja tervishoiutöötajale ning tööandjale |
| MTÜ Laste ja Noorte Kriisiprogramm | 5 | lapsele, vanemale, spetsialistile, teenused, leinalaager |
| Al-Anon Eesti | 5 | tutvustus, korduvad küsimused, 12 sammu ja traditsiooni, alkohoolikute täiskasvanud lapsed |

Kolm käsitsi sammu, mida reegel ei tee:

- **Convictuse lehed** lõpevad kõik sama plokiga (lähimad keskused lahtiolekuaegadega, programm, piirkonnad; 24 % nende lehtede sõnadest) ja viie teenuselehe esimene pealkiri on rubriigi nimi „NÕUSTAMINE“. Plokk võeti välja kõigilt lehtedelt peale avalehe ja pealkirjaks pandi lehe enda `<title>` (`tmp/rag-v2-v80/tools/fix-convictus.mjs`). Selle sammu pärast on need 26 lehte eraldi nimekirjas `web_pages_associations_2.json` ja igakuine uuendus neid ei loe: uuesti lugemisel tuleks sama samm uuesti teha.
- **Al-Anoni korduvate küsimuste leht** on aadressil „/lood“ ja reegel jätaks selle aadressi pärast välja kui lugude lehe. Lehe enda pealkiri ja sisu on küsimused; reeglilt küsiti selle kohta teise aadressi all ja isikute otsus jäi reegli oma (`tools/alanon-more.mjs`).
- 17 sõnapaari, mis ei ole inimesed, lisati reegli loendisse.

Välja jäid: AA koosolekute loend ja Al-Anoni rühmade leht (kontaktisikute nimed), lood, teiskeelsed lehed, Convictuse uudised ja meeskond.

| Käik | Sisendeid ostetud | Märke | Hind | Indeks | Dokumente | Lõike |
|---|---:|---:|---:|---|---:|---:|
| v80 | 216 | 51 383 | 0,0067 USD | `c7d36b42` | 9 698 | 90 604 |

Vaba ketast serveris pärast: 16 GB. Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20261011d.json`; järgmine alus põhikausta `tmp/rag-v2-v80/ship/policy.json`. Vektorite hind kontrolliti samal hommikul pakkuja lehelt (0,13 USD miljoni märgi kohta) ja kirjutati päeva hinnafaili. Mudeliga mõõtmata.

**Mis jäi ka nüüd lugemata.** Töötukassa: lehtede aadressid on robotitele lubatud, aga tekst tuleb skriptiga aadressilt `/web/`, mille nende reeglid robotitele sulgevad; brauser näitaks seda, kuid nii ma sisu ei võta ilma nende loata. Lasteabi käsiraamatu 71 lehte on saidil endal tühjad ka päris brauseris (lehel on ainult pealkiri ja saidi jalus). PDF-idena jagatud materjalid on tegemata.
## Järeltäiendus v81: korjatud lehed, mis olid välja jäänud (11.10.2026)

Omanik 11.10.2026: „lisa lehed, mille korje on tehtud“. Küsisin, milliseid korjatud ja välja jäetud rühmi ta mõtleb (abiinfoga lehed; ühingute tutvustuslehed; Palliumi toetuste kokkuvõtted; juristaitab.ee artiklid), ja ta valis kaks esimest.

Sisse läks **37 lehte** (8 259 sõna, 103 lõiku):

- **Viis abiinfo lehte:** Eluliini emotsionaalse toe telefon ja psühholoogiline kriisinõustamine, Convictuse „Kuidas käituda kui näen kasutatud süstalt?“ ja „Toidu- ja riideabi“, Peaasi e-nõustamine. Neli esimest on paigutatud käsitsi (`tmp/rag-v2-v81/tools/place-by-hand.mjs`): lugeja oli võtnud pealkirjaks lingi teksti või rubriigi nime, üks leht on alla reegli 30 sõna ja üks on aadressil, kus on sõna „uudised“. Enne paigutamist kontrolliti, et ükski lõik ei nimeta inimest; pealkirjaks on lehe enda pealkiri. Need neli on nimekirjas `web_pages_associations_2.json` ja igakuine uuendus neid ei loe.
- **32 tutvustuslehte** ühingutest endist (Lastekaitse Liit 11, naiste tugikeskus 6, Hingehoid 5, Omastehooldus 4, Eluliin 3, Seksuaaltervise Liit 2, Pallium 1): tegevused, põhimõtted, eetika, kutsestandard, kampaaniad, kontakt, kaebuste kord. Reegel oli need valinud; välja olin need jätnud lehe haaval kui lehed, mis räägivad ühingust, mitte abist.

Välja jäid ka nüüd: neli Eluliini projektilehte, mille tekst on inglise keeles; puhkuseteated, pakkumised kuupäeva ja hinnaga, arvamuslood ja raamatututvustused; Palliumi toetuste kokkuvõtted ja juristaitab.ee artiklid (omanik neid ei valinud); kõik lehed, mille reegel jätab välja inimeste nimetamise pärast.

| Käik | Sisendeid ostetud | Märke | Hind | Indeks | Dokumente | Lõike |
|---|---:|---:|---:|---|---:|---:|
| v81 | 103 | 29 332 | 0,0038 USD | `f66fd13d` | 9 735 | 90 707 |

Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20261011e.json`; järgmine alus põhikausta `tmp/rag-v2-v81/ship/policy.json`. Mudeliga mõõtmata.
## Lahtine

- **juristaitab.ee rubriik „Kiirelt kätte“** (umbes kaks tuhat lühikest õigusartiklit, mida toimetab Justiits- ja Digiministeeriumi lepingupartner; igal artiklil viimase kontrolli kuupäev). See kataks võlad, pärimise, eestkoste, töösuhted, üüri ja perekonnaõiguse inimese keeles, aga on maht, mis nõuab dokumentide piiri tõstmist (omanik lubas 15 000-ni) ja mõõtmist, kas kokkuvõtted ei tõrju seaduse sätteid kandidaatide seast. Omanik 11.10.2026: „selles ma kahtlen, pigem ei pane“. Samal päeval hiljem otsustas ta teisiti ja rubriik loeti läbi: seal on 501 toimetatud artiklit ja umbes 3430 juristi vastust eraisikutele, mitte kaks tuhat artiklit. Juristi vastused ei lähe sisse; toimetatud artiklite ettevalmistus ja dokumentide piiri tõstmine on [ADR-143](adr-143-edited-legal-articles-and-15000-documents.md).
- Need 314 lehte ei ole igakuises uuenduses (nagu ADR-137 lehedki): uuendus peab enne oskama valikureeglit ja lehe haaval tehtud valikut.
- Lugeja võtab alamlehe pealkirjaks lingi teksti, kui lehel pealkirja ei ole (Eluliini leht „Loe lisa >“); lehe enda `<title>` oleks õige.
- ~~Anonüümsed Alkohoolikud, Al-Anon, Convictus ja lastekriisi leht~~: sees alates v80 (vt järeltäiendus).
- ~~Mudeliga mõõtmata: kas vastused neid lehti kasutavad.~~ Mõõdetud 11.10 (osa „Tasuline vastuste kontroll“).
