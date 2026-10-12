# ADR-148: Vanemluse infokeskkond tarkvanem.ee ja asendushoolduse juhendid

Kuupäev: 12.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v88 on serveris: 235 tarkvanem.ee lehte, 6 sama saidi PDF-i ja 9 juhendit; ost 0,0881 USD.**

## Miks

Omanik küsis 12.10.2026, kas tarkvanem.ee materjalid on andmebaasis. Olid ainult PDF-id (13 dokumenti: töölehed ja infomaterjalid); saidi enda lehti ei olnud. Kogu on tugev õiguste, toetuste ja teenuste poolel ning nõrk seal, kus vanem küsib, mida ta ise teha saab. Omaniku sõnad töö käigus:

- „tee palun korje nendest“;
- „perede lugusid sisse ei võta. samuti ei soovi koroone, vene jms“;
- „küsimuste ja vastuste kogu ei soovi“ (leht „Küsi nõu“: vanemate kirjad ja spetsialistide vastused, 71 000 sõna ühel lehel);
- „siiski võiks mingi statistika olla? või meil juba on?“;
- juhendite kohta, milleni lehtede lingid viisid: „väga hea, nüüd oleks see materjal vaja andmebaasi panna“.

Saiti peab Sotsiaalkindlustusamet (kontakt ja saidi päis); suure osa tekstidest on kirjutanud Tervise Arengu Instituudi töötajad. Väljaandja nimi kogus on „Tarkvanem (Sotsiaalkindlustusamet)“.

## Mis loeti ja mis sisse läks

Saidikaartides on 236 artiklit ja 162 lehte. Aadressi järgi jäid lugemata venekeelsed lehed (13), koroona- ja eriolukorra lehed (13), „Küsi nõu“, konverentsi lehed, avaleht, tutvustusleht ja neli loendilehte. Loeti 362 aadressi, üks neist oli teise lehe koopia.

| | Lehti |
|---|---:|
| loetud | 361 |
| **sees, valitud reegliga** | **228** (119 artiklit, 109 teemalehte) |
| **sees, paigutatud käsitsi** | **7** |
| väljas minu valikuga lehthaaval | 101 |
| väljas ainult reegli järgi | 25 |

Minu valik lehthaaval (`tmp/rag-v2-tarkvanem/tools/choose.mjs`, iga aadress põhjusega):

- 53 perede, laste ja inimeste lugu;
- 28 ürituse, kampaania või saate teadet ja kokkuvõtet;
- 9 raamatute, saadete ja linkide loendit;
- 6 lehte, mille tekst on teisel sisse jääval lehel;
- 3 jaotise avalehte, mis ainult edasi juhatavad;
- 2022. aasta kriisiaja leht ja artikkel kooliõpilaste 2011. ja 2012. aasta arvudega (kogus on ESPAD 2024).

Ainult reegli järgi jäi välja 8 lehte, mille pealkiri nimetab isikut, ja 11 valdavalt isikutest rääkivat lehte (nimeliste spetsialistide intervjuud, kaks traumaartiklit, mis toetuvad ühe nimelise psühholoogi loengule) ning 6 alla 30 sõna lehte. Reegliga valitud lehtedest võeti välja 157 isikut nimetavat lõiku.

**Koolituste lehed jäid sisse.** Olin need omanikule enne lugemist nimetanud ürituste teadete seas. Need on püsivate vanemlusprogrammide kirjeldused (Imelised aastad, Hoolivad isad, Triple P, Kõik algab mängust, PREP); omanikule öeldud.

## Statistika: seitse lehte käsitsi

Reegel jätab välja lehe, mille pealkirjas või aadressis on varasem aasta. Aastaülevaates on aasta lehe teema, mitte vananemise märk. Kogus oli asendushoolduse kohta üks arv (2023. aasta lõpp, ameti lehel) ja kolm uuringut; aastate kaupa ülevaadet ei olnud. Käsitsi paigutati (`tools/place-dated.mjs`):

- hooldusperede aastaülevaated 2022, 2023, 2024 ja 2025;
- kaks Sotsiaalministeeriumi analüüsi kokkuvõtet (perest eraldatud lapsed 2011–2021; asendus- ja järelhooldus 2016–2020);
- nõuandeartikkel lastekaitsetöötajale (müüdid hooldusperre paigutamisel), mille aadressis on 2023.

Iga leht käis muus osas reeglist läbi: isikut nimetavad lõigud on välja võetud, ainult aasta kontroll jäeti kõrvale. Need lehed kannavad märget `selection.placed_by_hand` ja on nimekirjas, mida igakuine uuendus ei loe.

## Lugeja muudatused

Commit `e204816d` (enne ostu, `main`-is):

- **Nimekirja kirje väli `keep`.** Sait kirjutab lahtiklõpsatavad plokid ja märkusekastid `<aside>`-märgendisse, mille lugeja saidi osana välja jätab: 1287-sõnalisest lehest loeti 119 sõna. Kirje nimetab nüüd plokid, mis on sisu (`aside.card-collapse`, `aside.article__aside`); igakuine uuendus kannab välja edasi nagu sisuosa vihjet. Ilma väljata ei loeta ühtki lehte teisiti.
- **Paneeli avav link on paneeli pealkiri.** Enne salvestati see lingina lehele endale.
- **`asendushooldus` on üksuse sõna.** Valik võttis hooldusperede lehtedelt välja 40 lõiku, mis ütlevad, kuhu kirjutada (ameti asendushoolduse postkast).
- **Kahetäheline eesnimi loetakse.** Autoririda jäi viie artikli alla, sest kahetäheline nimi ei ole mustri järgi suurtähega sõna; nimekirja lisati kolm eesnime.

Kolmel lehel ei ole oma pealkirja (tühi `<title>`, pealkirja sisuosas ei ole); nende nimi on saidi menüüst. Jaotiste avalehtede pealkiri on bänneris sisuosa kohal, seega tuli pealkiri lehe `<title>`-st. Saidi robotifail annab kõigile 403; seda loeti kui puuduvat faili.

## PDF-id ja juhendid

**Saidi töölehtede lehelt** (23 faili; 11 olid kogus ja üks koodihoidlas): sisse viis töölehte ja väikelaste (1–4 a) ohutuse infomaterjal. Välja: kaks plakatit ja üks tööleht ilma tekstikihita, 45-sõnaline kalender, infograafik, mis kordab artiklit. Koodihoidla „Suhtekonto“ tööleht on 89 sõna viiel lehel väljalõigatavat mänguraha ega ole kogus; suhtekonto veebileht on.

**Lehtedel viidatud failid.** Sisse läinud lehed viitavad 63 failile; 50 neist registrid aadressi ega failinime järgi ei tundnud. Viisteist linki on surnud. Kolm neist viisid Sotsiaalkindlustusameti juhenditeni, mis on ameti lehel „Asendushoolduse ja järelhoolduse korraldamine“ uuel aadressil koos teiste omavalitsuse lastekaitsetöötajale mõeldud juhenditega; ameti kahte faili (noorte infoleht „Sinu iseseisva elu alustamine“, abivajava lapse voldik) sealt ei leidnud. Alla laaditi 13 faili (omaniku loal), sisse läks 9:

- juhis omavalitsuse spetsialistile perest eraldatud lapse hooldusperre paigutamisel;
- minijuhis olukorraks, kui sünnib laps, kelle vanemad soovivad anda nõusoleku lapsendamiseks;
- kooskõlastuse andmine lapse paigutamiseks asendushooldusele vanema nõusolekul;
- enamaarvulise paigutuse kooskõlastuse saamise juhend;
- järelhooldusteenuse planeerimise ja korraldamise soovituslik juhend omavalitsusele (2025. aastal kaasajastatud);
- hoolduspere vanema kompetentsimudel ja kompetentside selgitused;
- tugiteenused kasuperedele, juhend lastekaitsetöötajale;
- coachiva vestluse vägi (asendushoolduselt ellu astuvate noorte toetamine);
- voldik „Kogu tõde hooldusperest“ (2021).

Välja jäi neli: teenuseosutaja juhend on samade baitidega juba kogus (teise aadressiga); paigutamise juhendi „linkideta“ fail kordab esimest juhendit (99 % sama tekst); paljas kompetentsimudel sisaldub selgitustes; sünnitusjärgse depressiooni voldik on 93 % sama, mis kogus olev.

Alla laadimata jäid ajakirjade artiklite koopiad, ingliskeelsed versioonid, mängud, vormid, flaierid ja 2011. aasta uuringud. Instituudi vana failiserveri seitse linki on surnud; nende uut aadressi ei ole otsitud (VEPA Kodu vanemaraamat, „Kas sinu südames on ruumi?“, PRIDE-i infomaterjal).

## Ost ja indeks

Alus on korpus v87, mille teine tööriist (Codex) tegi 11.10.2026 õhtul: eetikaruumi 35 dokumenti. Registrid seda veel ei näidanud; nüüd on eetikamaterjalid registris oma real (`config/ethics-sources.json` nimetab iga dokumendi ja selle versiooni).

| | |
|---|---|
| dokumente | 250 (235 lehte, 15 PDF-i) |
| lõike | 1518 |
| ostetud sisendeid | 1514 (üks oli olemas), 677 641 tokenit |
| kulu | **0,0881 USD**, lagi 0,09 |
| indeks | `451ce0e6`: 10 856 dokumenti, 96 115 lõiku |
| vestlusplaan | `m4-corpus-chat-20261012a.json` |

Lae olin omanikule nimetanud enne juhendite lisandumist (0,09 USD); kohalik arvestus koos juhenditega mahtus selle alla ja serveri tasuta plaan kinnitas sama summa. Serveri käigu käivitas omanik ise: seansi õiguste kontroll ei lubanud mul serveris käske käivitada, kuni ta loa andis. Hinnafail on päeva oma (0,13 USD miljoni kohta, loetud pakkuja lehelt).

## Otsinguvärav pärast täiendust

33 kontrollküsimust v77 lähteseisu vastu, tasuta: vigu 0, ühtki otsustavat lõiku ei kadunud, 3 paremat, 2 halvemat, 24 muutunud, 4 sama. Võrreldes v86 järgse väravaga muutus kaks rida:

- **Narva asendushooldus, lapse isiklike kulude miinimum:** otsustav säte (sotsiaalhoolekande seadus § 45¹¹ lõige 3) oli kandidaatide seas 7. kohal, nüüd 21. kohal. Ette tulid uued lõigud, mis räägivad samast summast: hooldusperede KKK, leht „Kuidas riik kasuvanemaid toetab“ ja järelhoolduse juhend. Säte on endiselt 40 kandidaadi seas, mille hulgast tõendid valitakse.
- **Sillamäe järelhooldus:** otsustav lõik tõusis 2. kohalt 1. kohale.

Värav mõõdab otsingu järjekorda, vastust ta ei tee. Kas Narva küsimuse vastus muutus, näitab ainult tasuline pööre; see on tegemata ja ootab omaniku luba.

## Igakuine uuendus

Reegliga valitud 228 lehte on nimekirjas `Andmebaasi/register/web_pages_coverage_4.json` (iga kirje kannab vihjeid `region`, `keep` ja artiklitel `updated_region`) ja igakuise uuenduse vaikenimekirjade seas; uuenduse seisu rühm `coverage` on külvatud (1337 koopiat). Käsitsi paigutatud seitse lehte on nimekirjas `web_pages_coverage_4_by_hand.json`, mida uuendus ei loe.

## Lahtine

- Tasuline vastuste kontroll uuel sisul ja Narva küsimusel.
- Teemalehtedel ei ole kuupäeva; kaks neist räägivad Haigekassast, seega on osa tekste vanemad kui 2023. Artiklitel on kuupäev metaandmetes (`page_updated`).
- Hooldusperede lehed nimetavad summasid (240 eurot kuus, 320 eurot); lehe metaandmed keelavad summa aluseks võtta lehte, alus on seadus.
- Instituudi surnud linkide materjalid.
- Plaanitud töö juhis nimetab reegliga valitud lehti „umbes 1400“; neid on nüüd rohkem ja lugemine võtab kauem.
