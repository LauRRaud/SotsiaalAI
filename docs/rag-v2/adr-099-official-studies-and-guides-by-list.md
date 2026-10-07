# ADR-099 — Asutuste uuringud ja juhendid nende enda loendi järgi

Kuupäev: 07.10.2026. Seotud: ADR-095 (veebilehtede korjaja), ADR-098 (igakuine uuendamine), registrid (`scripts/rag-v2-register-corpus.mjs`).

## Probleem

Omanik küsis 07.10.2026, kas üks Sotsiaalministeeriumi 2026. aasta uuring (kodus elavate dementsusega inimeste ja nende lähedaste tugisüsteemide analüüs) on RAG-is. Ei olnud. Seejärel: „kas saad kontrollida, mis sotsiaalministeeriumi ja ska uuringuid ja juhendeid ei ole andmebaasis“.

Võrdlesin asutuste veebilehtedel loetletud dokumente sellega, mis on serveris RAG-is (korpus v64). Vaste oli sama aadress või väga sarnane pealkiri.

| Loend | Loetletud | RAG-is | Ei olnud RAG-is |
|---|---:|---:|---:|
| Sotsiaalministeerium: läbiviidud ja käimasolevad uuringud | 407 | 21 | 386 |
| – 2026. aastal valminud | 12 | 0 | 12 |
| – varasemad (uuem tabel, 2024–2025) | 39 | 1 | 38 |
| – sotsiaalvaldkond | 137 | 15 | 122 |
| – töövaldkond | 69 | 4 | 65 |
| – tervisevaldkond | 150 | 1 | 149 |
| Sotsiaalkindlustusamet: uuringud ja analüüsid | 75 | 7 | 68 |
| Sotsiaalkindlustusamet: juhendid ja juhendmaterjalid | 104 | 11 | 93 |

Loetud lehed: ministeeriumi „Läbiviidud uuringud“ ja „Käimasolevad uuringud“; ameti „Uuringud“ ja 63 lehte jaotisest „Spetsialistile ja koostööpartnerile“ (34 alalehte jäi lugemispiiri taha, üks ei avanenud). Ministeeriumi lehel eraldi juhendite loendit ei ole.

## Otsus

1. **Allikas on asutuse enda loend** ja dokument laaditakse alla ametlikult aadressilt. Lugemine käib lehtede korjajaga (ADR-095): üks päring korraga, paus saidi kohta, `robots.txt`.
2. **Tervisevaldkond jääb välja** (omanik: „tervishoiu valdkonna jätaksin jah välja“): ravimid, vähitõrje, alkohol, tervishoiu rahastamine, koolitoit. Vaimne tervis, hooldus ja puue jäävad sisse. Välja jäävad ka haldushindamised (välisvahendite vahehindamised), tehnilised juhendid (portaalide kasutusjuhendid, liidestamine) ja failid, mis ei ole PDF-id.
3. **Failid ei lähe koodihoidlasse.** Esimene partii on 229 MB ja ülejäänud loendid on mitu korda suuremad. Dokument on korpuse hoidlas; register loetleb selle pealkirja ja ametliku aadressiga (`lib/rag-v2/register-corpus.js`, liik `official_documents`).
4. **Metaandmed** on samad, mis korpuse senistel juhenditel ja uuringutel: väljaandja, `NATIONAL`, `national_guidelines`, sihtrühm `BOTH`, aasta, allika aadress. Liik: ministeeriumi uuring on `research_report`, ameti juhend `official_guideline`, infoleht, meelespea või tööriist `information_material`.
5. **Pealkiri** on asutuse loendist. Failinimest tehtud pealkirjad on puhastatud: aastaarv, loendur ja autorite perekonnanimed failinime lõpus ei ole pealkirja osa. Lisa või kokkuvõte, mille pealkiri oma teemat ei nimeta, saab ette lehe nime, millel ta seisab.
6. **Ülevaatus on reegli järgi** (`scripts/rag-v2-review-by-rule.mjs`, liik `document`). Oodatud on lugeja märkused küljenduse kohta: veerud, tekstikastid, tekstikihita lehed (kaaned, pildid), tükeldamata viidete loend, ja see, et loendi pealkiri ei seisa sõna-sõnalt tekstis. Dokument, mille tekst on ainult osaliselt loetav, reeglini ei jõua: vastuvõtt hoiab selle ise kinni.
7. **Uuring on taust ja tõendus, juhend on asutuse juhis; kumbki ei ole õiguslik alus.** See seisab iga dokumendi ülevaatuse märkuses.

## Esimene partii: korpus v65

Omanik valis: „Jah, lagi 0,80 USD“ (ministeeriumi 2024–2026 uuringud ja ameti juhendid).

| Samm | Dokumente | Mis välja jäi |
|---|---:|---|
| Kandidaadid, mida RAG-is ei olnud | 150 | |
| Pärast valikut | 115 | 18 tervisevaldkond, 3 haldushindamist, 6 tehnilist juhendit, 8 mitte-PDF-i |
| Alla laaditud | 112 | 2 ei olnud PDF-id, 1 ei avanenud (kolmanda saidi fail) |
| Vastuvõtuks ette valmistatud | 107 | 1 kordus (samad baidid), 2 peaaegu tekstita (pildid), 1 sama pealkirjaga teine fail, 1 üle 32 MB (kahe lehekülje trükivoldik, 62 MB) |
| Korpusesse | **104** | 1 osaliselt skannitud käsiraamat ja 1 väga suurte tabelitega dokument (vastuvõtt hoidis kinni), 1 juba teise nime all korpuses (samad baidid) |

104 dokumenti: 25 ministeeriumi uuringut, 79 ameti juhendit ja infomaterjali. 4783 lõiku; serveri tasuta plaan: 4782 sisendit, 3 128 772 tokenit, **0,4067 USD** ülempiiri 0,80 all. Indeks `33a3cb2a` (8105 dokumenti, 50 379 lõiku), 07.10.2026 kell 12.59; vestluse plaan `m4-corpus-chat-20261007a.json`. Hinnafail on tänane, hind kontrollitud ametlikult lehelt (0,13 USD miljoni tokeni kohta).

Enne ostu arvasin hinnaks 0,50–0,60 USD (sõnade ja tokenite eilse suhte järgi); tegelik oli väiksem, sest PDF-i tekstist läheb lõikudesse vähem kui lehekülgedelt loetud sõnu (päised, jalused, viited).

## Kontroll

- Võrdlus: asutuste loendite 586 dokumenti (ministeeriumi 407 uuringut, ameti 75 uuringut ja 104 juhendit) korpuse v64 dokumentide aadresside ja pealkirjadega. Pealkirja järgi võrdlus võib üksikjuhul eksida; üks juhend, mis oli korpuses teise nime all, tuli välja alles avaldamisel (samad baidid).
- Kohalik vastuvõtt: 104 dokumenti, kõik olekus „prepared“, ülevaatuse mustandis 0 takistust; reegli järgi ülevaatus 0 probleemi. Tekstikihita lehti oli kümnel dokumendil 1–2 (kaaned), ühel 14 lehte 258-st.
- Serveri käivitus: \`run-v65 exit: 0\`; 4782 sisendit õnnestus, 3 128 772 tokenit, 0,4067 USD; indeksis 8105 dokumenti ja 50 379 lõiku; \`ready\` läbis.
- Kolm küsimust päris lehel, igaüks uues vestluses (0,0133 USD):

| Küsimus | Mida vastus tsiteeris |
|---|---|
| mida näitas 2026. aasta uuring dementsusega inimeste lähedaste hoolduskoormuse kohta ja mida soovitati | uus uuring (leiud ja soovitused) |
| mida peab ameti juhendi järgi isikliku abistaja teenuse korraldamisel arvestama | „Isikliku abistaja teenuse juhend“ ja sama teenuse kvaliteedijuhis (mõlemad uued) |
| kuidas valmistada ette vestlust lapsega, kelle heaolu pärast muretsetakse | „Lapsega vestlemise meelespea“ (uus) ja neli varasemat lastekaitse allikat |

Kolm küsimust on kontroll, mitte mõõtmine. Uuringu ja juhendi aadress ei ole vastuse mullis link: lingiks saab praegu ainult veebilehe aadress (ADR-097), PDF-i allikas on allikate paneelis.
- Testid: \`tests/rag-v2-register-corpus.test.mjs\` (asutuse loendist võetud uuring on registris pealkirja ja ametliku aadressiga).
- Kulu kokku selle töö jaoks: 0,4200 USD (ost 0,4067 ja kolm kontrollpööret 0,0133) omaniku lae 0,80 USD all.

## Tegemata

- **Ülejäänud loendid:** ministeeriumi sotsiaalvaldkonna vanemad uuringud (122), töövaldkond (65), uuema tabeli tervisevälised jäägid; ameti uuringud ja analüüsid (68). Need on eraldi otsus ja ost.
- Ameti 34 alalehte jäi lugemata; juhendite loend ei pruugi olla täielik. Ministeeriumi kompetentsikeskuse lehte ei võrreldud.
- Kaks kinni peetud dokumenti („Rehabilitatsiooni käsiraamat“, „Sotsiaalhoolekande andmepõhise aruandluse mudeli loomine“) ja 62 MB voldik (omanik: „sellega tegeleme hiljem“).
- Mitme failiga uuringust on korpuses põhiaruanne (esimene PDF); lisad ja lühikokkuvõtted ei ole.
- Dokumendi uut versiooni asutuse lehel ei jälgita; igakuine uuendamine (ADR-098) neid ei loe.
- Võrdluse, valiku ja allalaadimise skriptid olid selle töö ajutised skriptid ega ole koodihoidlas; järgmise partii jaoks tuleb need kas uuesti kirjutada või hoidlasse tõsta.
