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

## Teine partii: korpus v66 (ajakirja Sotsiaaltöö uudiskirjas viidatud dokumendid)

Omanik lasi 07.10.2026 koguda ajakirja Sotsiaaltöö uudiskirjades viidatud dokumendid kausta `Andmebaasi/Sotsiaaltöö uudiskiri` (teise agendi töö, kaust ei ole koodihoidlas): 195 PDF-i, 790 MB, enamiku kõrval koguja metafail. Tema sõnad: „need uudiskirja dokumendid lisa, mida saab kindlasti lisada. need kahtlased kontrolli üle ja see, mis peaks suuruse tõttu välja jääma“.

**Võrdlus RAG-iga (korpus v65) ja kontroll, tasuta:**

| Rühm | Faile | Mis sai |
|---|---:|---|
| Samad baidid juba RAG-is | 20 | ei lisata |
| Sarnase pealkirjaga dokument RAG-is | 3 | kõik kolm on eri dokumendid (variraport, mille kohta RAG-is oli ainult artikkel; kaks hilisemat aastaülevaadet): kandidaadid |
| Üle vastuvõtu 32 MB piiri | 2 | tekst on loetav (56 lk, 17 691 sõna; 203 lk, 138 685 sõna), suureks teevad pildid; ootavad piltideta koopiat |
| Tekstikihita (lehed on pildid) | 6 | ootavad tekstituvastust |
| Ingliskeelsed | 9 | omanik: „inglise keeles hetkel ei pane, aga kirjuta need kuhugi üles“ |
| Arvutabelite kogumikud (üle poole sisust arvud) | 3 | omanik: „arvutabelid jäta välja“ |
| Eestikeelsed, tekstiga | 155 | kandidaadid |

Keel on mõõdetud kogu faili sõnadest (ainult ühes keeles esinevad sidesõnad), mitte pealkirjast. Tervisevaldkonna reeglit (otsus 2) siin ei rakendatud: uudiskirja toimetus valis need dokumendid sotsiaaltöötajatele; ütlesin seda omanikule ja ta välja jätta ei palunud.

**Otsused selle partii kohta:**

1. **Väljaandja on organisatsioon, kelle aadressil dokument on avaldatud** (korpusesse läinud 74 dokumendil 23 väljaandjat: ministeeriumid, ametid, Riigikontroll, mõttekojad, ülikoolid, ühingud). Juhend on riigiasutuse väljaandena `official_guideline`, muu väljaandja juhend või infoleht `information_material`, uuring `research_report`.
2. **Aasta** on koguja märgitud avaldamisaasta; kui seda ei olnud, siis pealkirjas, aadressis või failis seisev aasta. Uudiskirja number ei ole dokumendi aasta.
3. **Märksõnu dokumendile ei panda.** Dokumendi märksõnad on otsinguabi iga selle lõigu juures; esimeses kohalikus läbimängus oli igal dokumendil märksõna uudiskirja nimega, mis oleks pannud tuhanded lõigud vastama sõnale „sotsiaaltöö“. Viga leitud enne ostu, allikad tehtud uuesti. Kust dokument leiti, seisab metaandmete väljas `collection.collected_from` (uudiskirja number), mis otsinguabi ei ole.
4. **Uudiskirja lugemislinki ei kirjutata kuhugi** (see kannab tellija tunnust): metaandmetes ja loendis on ainult dokumendi enda ametlik aadress.
5. **Pealkiri** on koguja metafailist; lõpus sulgudes seisev aasta ei ole pealkirja osa. Pealkirja ei täiendata sõnadega, mida dokumendi tekstis ei ole.
6. **Omaniku lisatud failil** (psühholoogilise esmaabi juhend, metafailita) leiti ametlik aadress pealkirja järgi ja kontrolliti baitide võrdsust (Sotsiaalkindlustusameti fail, samad baidid).
7. **Ülevaatuse reegel** (`document`) võtab vastu ka lugeja märkuse, et fondis tähtedeta kodeeritud märgid taastati fondi enda andmetest (`pdf_glyph_char_codes_recovered`): kolme sellise dokumendi tekst loeti läbi, see on tavaline eesti keel.
8. **Loend on koodihoidlas:** `Andmebaasi/register/newsletter_documents.json`, 175 dokumenti pealkirja, väljaandja ametliku aadressi ja seisuga (RAG-is alates v66; ootab indeksi mahupiiri; ootab kettaruumi; ingliskeelne; tekstikihita; liiga suur; arvutabelid). Failid ise ei ole koodihoidlas.

**Serveri kettaruum otsustas partii suuruse.** Mõõdetud v65 pealt (104 dokumenti, 4783 lõiku): hoidla 741 MB (sellest PDF-id 118 MB), vektorifailid 287 MB, RAG-andmebaas umbes 700 MB (`rag_v2_object` 355 MB, `rag_v2_version` 122 MB, `rag_v2_version_unit` 82 MB, vektorid 143 MB). Kokku umbes **380 KB serveri ketast ühe lõigu kohta**: tekst on salvestatud mitmes koopias (hoidlas kolm korda, andmebaasis kolm korda) ja vektor JSON-ina kaks korda. 155 dokumenti oleks võtnud umbes 7 GB; vaba oli 5,9 GB.

Omanik: „ainult siis mahub kui eemaldad livekit nt, aga seda peab oskama tagasi panna hiljem“, seejärel „livekit võid eemaldada“. Serverist võeti maha **LiveKiti kõnesalvestuse osa** (`livekit-egress`: teenus peatatud ja keelatud, konteiner ja pilt eemaldatud; 4,7 GB). LiveKiti server ise (kõned) jäi puutumata; teenuse fail, `/etc/livekit` ja salvestiste kaust on alles. Teenus on keelatud, mitte ainult peatatud: see käivitub alati uuesti ja laadiks pildi järgmisel taaskäivitusel tagasi. Vaba ruumi sai 11 GB.

Tagasipanek (vajab umbes 5 GB vaba ruumi; juhis on ka serveris failis `/home/ubuntu/livekit-egress-restore.txt`):

```bash
sudo docker pull livekit/egress:v1.14.1@sha256:bf2b648b947349c3e9ff7aa8c718f00378d5c06af7624652a3653318e00333ce
sudo systemctl enable --now livekit-egress.service
```

Sama räsiga pilt oli 07.10.2026 Docker Hubis olemas. Seni kõne salvestamine ei tööta.

**Indeksi mahupiir otsustas lõpuks rohkem kui ketas.** Valmistasin ette 104 dokumenti (juhendid ja käsiraamatud ning uuringud alates 2023; 11 440 lõiku) ja saatsin serverisse. Serveri tasuta plaan keeldus: `local_index_limit`. Ühe indeksipõlvkonna piir on 10 000 dokumenti ja 60 000 lõiku (`lib/rag-v2/search/capacity.js`, ADR-036), korpuses oli 50 379 lõiku ja 104 dokumendiga oleks saanud 61 819. Piir kontrollitakse enne ostu, nii et midagi ei ostetud. Seda piiri ma partiid valides ei kontrollinud; LiveKiti salvestus võeti maha 104 dokumendi jaoks, 74 oleks mahtunud ka ilma.

**Partii on 74 dokumenti:** juhendid ja käsiraamatud (kõik aastad) ning 2025–2026 uuringud; 7481 lõiku, korpuses kokku 57 860 (96% piirist). 30 uuringut aastatest 2023–2024 on vastu võetud ja serveri hoidlas, aga korpuse poliitikast väljas, kuni piir tõstetakse. 51 vanemat uuringut (2017–2022) on vastu võtmata.

Käivitus õnnestus kolmandal korral; ükski katse enne seda midagi ei ostnud:

| Katse | Kuhu jõudis | Mida tegin |
|---|---|---|
| 1 | hoidla pea tõsteti (104 versiooni lahti pakitud), plaan keeldus: `local_index_limit` | poliitika tehtud uuesti 74 dokumendiga pakkimise sammu enda funktsiooniga (`nextPolicy`); paki kirje alus seatud pea väärtusele, mis serveril juba oli (sama pakk pakitakse iseenda peale lahti); enne täiendust tehtud pea koopia tõstetud kõrvale (`tmp/store-backup-v65-before`) |
| 2 | plaan keeldus: väljundkaust `plan-v66` oli esimesest katsest tühjana alles ja samm teeb selle alati uuena | tühi kaust eemaldatud |
| 3 | plaan läbis, ost ja indeks | |

Käivitusskript ei osanud ise jätkata pärast plaani keeldumist, kui pea oli juba tõstetud (alus ei klappinud) ja tühi väljundkaust oli ees. Mõlemad on samal õhtul parandatud ja testiga kaetud (`tests/rag-v2-corpus-run.test.mjs`).

**Tulemus (07.10.2026 kell 16.04):** serveri tasuta plaan näitas 74 dokumenti, 7473 sisendit ja 4 664 304 tokenit; ost õnnestus kõigi 7473 sisendiga, **0,6064 USD** ülempiiri 0,80 all (ülempiiri panin mina kohaliku tokeniarvutuse 0,61 järgi; omanik: „Raha on piisavalt“, „luba on antud rag andmebaasi panna“). Ost kestis 33 minutit, indeksi töö 6 minutit. Indeks `de3e160f`: **8179 dokumenti, 57 860 lõiku**; vestluse plaan `m4-corpus-chat-20261007b.json`; `ready` läbis 8179 allikaga. Dokumentidest 49 on uuringud, 15 riigiasutuste juhendid ja 10 muude väljaandjate juhendid ja infomaterjalid.

**Kontroll enne ostu (kohalik, tasuta):** 104 ette valmistatud dokumendil on kõik metaandmete väljad (pealkiri, väljaandja, liik, keel, aasta, ametlik aadress, räsi), märksõnu ei ole; 11 440 lõigust igaühel on lehekülje number ja peatüki pealkiri ning iga dokumendi esimene lõik kannab pealkirja; faili sõnadest jõudis lõikudesse 97 dokumendil üle 85% ja seitsmel 74–85% (tükeldamata viidete loendid); 526 lõiku on alla 200 märgi. Sama kontroll v65 kohta: 104 PDF-il on metafail ja räsi klapib, kolmel puudub aasta; 4783 lõigul on lehekülje number ja peatüki pealkiri.

**Kontroll päris lehel**, kolm küsimust, igaüks uues vestluses (0,0096 USD); tsiteeritud allikad on loetud pöörete kirjetest:

| Küsimus | Mida vastus tsiteeris |
|---|---|
| mida leidis Riigikontroll hooldereformi kohta | „Hooldereform. Riigikontrolli aruanne Riigikogule“ (uus), neli lõiku |
| kuidas anda psühholoogilist esmaabi inimesele, kes on just kriisi läbi elanud | „Psühholoogiline esmaabi: juhend otsestele abistajatele“ (uus, omaniku lisatud fail), seitse lõiku; kandidaatide seas veel kolm uut dokumenti |
| mida näitas uuring riikliku perelepitusteenuse tulemuslikkuse kohta | „Riikliku perelepitusteenuse tulemuslikkuse uuring“ (uus), kaks lõiku |

Kolm küsimust on kontroll, mitte mõõtmine: need küsivad otse uue dokumendi järele. Mõõtmata on, kas 7481 uut uuringulõiku muudavad vastuseid tavalistele küsimustele (teenused, toetused), kus uuringud võistlevad omavalitsuste ja seaduste lõikudega.

**Serveri ketas pärast:** hoidla 5,9 → 7,5 GB (lahti pakiti kõik 104 versiooni), vektorifailid 3,1 → 3,5 GB, RAG-andmebaas 7,5 → 8,8 GB; vaba 7,2 GB (88% täis) pärast käivituse kahe hoidlakoopia eemaldamist (`cmp` järgi võrdsed). Ilma LiveKiti salvestust eemaldamata oleks vaba jäänud umbes 2,5 GB. Kulu selle töö jaoks kokku: **0,6160 USD**.

## Korpus v67 ja v68: ülejäänud eestikeelsed uuringud

Pärast v66 tõsteti indeksi mahupiir mõõtmise järgi 80 000 lõigule ([ADR-100](adr-100-index-capacity-80000.md)). Omanik: „jätka“, seejärel „kui tehtud need dokumendid, siis võtaks nendest järgmised“ ja „jah“ kolmele arvule, mille enne ütlesin (lõike umbes 68 400 80 000-st; ketast umbes 2,5 GB, vaba jääb umbes 3,8 GB ja LiveKiti salvestust ei saa enne ruumi tegemist tagasi panna; ülempiir 0,70 USD).

**v67 (07.10.2026 kell 17.55): 30 uuringut aastatest 2023–2024.** Versioonid olid serveri hoidlas esimesest v66 katsest saadik, nii et versioonide pakki üles ei laaditud: pakk tehti serveris hoidla enda peast (`active.json` ja `publications`), paki kirje alus ja pea on mõlemad pea, mis serveril oli, ja poliitika on sülearvutis tehtud 104 dokumendi poliitika (8209 dokumenti; kontrollitud, et see on töötav 74 dokumendi poliitika pluss need 30). Serveri plaan: 3957 sisendit, 2 632 745 tokenit; ost õnnestus, **0,3423 USD** ülempiiri 0,45 all. Indeks `9120d524`: 8209 dokumenti, 61 819 lõiku; plaan `m4-corpus-chat-20261007c.json`. Kaks kontrollküsimust päris lehel (0,0061 USD): Lasteabi tulemuslikkuse uuring ja täisealiste eestkostekorralduse uuring; mõlemad vastused tsiteerisid uut uuringut ja selle kohta varem korpuses olnud ajakirjaartiklit.

**v68 (07.10.2026 kell 18.36): 49 vanemat uuringut aastatest 2017–2022** (17 väljaandjat). Vastuvõtt hoidis 51-st kaks kinni (`partial_text_needs_review`: liiga paljudel lehekülgedel puudub tekstikiht); need on loendis seisuga `held_partial_text`. Kohalik kontroll enne ostu: 49 dokumendil kõik metaandmete väljad, märksõnu ei ole; 5980 lõigul lehekülje number ja peatüki pealkiri; faili sõnadest jõudis lõikudesse 44 dokumendil üle 85% ja viiel 73–85%. Serveri plaan: 5978 sisendit, 4 010 172 tokenit; ost õnnestus, **0,5213 USD** ülempiiri 0,70 all. Indeks `c49c1d5c`: **8258 dokumenti, 67 799 lõiku** (mahupiirist 85%); plaan `m4-corpus-chat-20261007d.json`; `ready` läbis 8258 allikaga. Kaks kontrollküsimust päris lehel (0,0067 USD): elanikkonna hoolduskoormuse uuring ja asendushoolduselt iseseisvasse ellu astuvate noorte uuring; mõlemad vastused tsiteerisid uut uuringut.

**Uudiskirja dokumentidest on RAG-is nüüd 153** (74 + 30 + 49): kõik eestikeelsed tekstiga dokumendid peale kahe kinni peetu. Kulu kolme täienduse peale **1,4924 USD** (v66 0,6160; v67 0,3484; v68 0,5280, kontrollküsimused sees).

**Serveri ketas pärast v68:** hoidla 8,3 GB, vektorifailid 4,1 GB, RAG-andmebaas 10 GB; **vaba 4,0 GB (94% täis)**. LiveKiti salvestust (vajab 5 GB) ei saa tagasi panna enne, kui ruumi on juurde tehtud; omanik 07.10.2026: „paneme asjad seisma, ostan ruumi juurde“. Kuni selleni uusi täiendusi ei tehta. (Samal õhtul suurendas omanik ketast 77 GB-le, serveri hoidla pakiti kokku (ADR-101) ja LiveKiti salvestus pandi tagasi; vaba on 26 GB.)

Kontrollküsimused küsivad otse uue dokumendi järele. Kui palju lisatud dokumendid tavaliste küsimuste otsingut muudavad, on mõõdetud allpool (jaotis „Mõõtmine“); kas vastused muutuvad, on mõõtmata.

## Mõõtmine: kui palju lisatud dokumendid otsingu tulemust muudavad (tasuta, 07.10.2026 õhtu)

07.10.2026 lisandus korpusesse 257 dokumenti (v65–v68: 106 juhendit ja infomaterjali, 151 uuringut), 22 203 lõiku ehk kolmandik korpusest. Kontrollküsimused näitasid ainult, et uus dokument leitakse, kui selle kohta küsida. Küsimus oli, mis juhtub tavaliste küsimustega.

**Meetod.** Salvestatud pöörete otsingud korrati vestluse enda otsinguga (`runtimeAdapters`), iga pöörde salvestatud päringu ja küsimuse vektoriga, mudelit ja embedding-teenust kutsumata. Iga küsimus kaks korda: töötava korpusega ja sama korpusega ilma lisatud 257 dokumendita (poliitika dokumendiloend on otsingu filter). Tõendivaliku asemel oli asendaja, mis jättis kandidaadid meelde ega valinud midagi; nii on näha kandidaadid, mida valik saab, ja üheksa lõiku, mille otsingu enda järjestus ette paneb, kui valikut ei ole. Plaani päringud otsisid oma sõnadega; nende endi vektoreid ei salvestata, nii et vektorina oli küsimuse vektor. Küsimused: 78 eri küsimust 05.–07.10 pööretest (minu mõõtmisküsimused ja omaniku proovid), ilma seitsme kontrollküsimuseta uute dokumentide kohta. Loeti ainult arvud ja lisatud dokumentide pealkirjad.

| | Kõik 78 | Omavalitsusega 27 | Omavalitsuseta 51 |
|---|---:|---:|---:|
| Kandidaate valikule kokku | 2838 | 975 | 1863 |
| neist lisatud dokumentidest | 535 (19%) | 157 (16%) | 378 (20%) |
| Varasemaid kandidaate, mis enam kandidaatide seas ei ole | 560 | 159 | 401 |
| Esimesi lõike otsingu järjestuses kokku | 759 | 259 | 500 |
| neist lisatud dokumentidest | 152 (20%) | 45 (17%) | 107 (21%) |
| Küsimusi, kus ükski kandidaat ei ole lisatud dokumendist | 14 | 7 | 7 |
| Küsimusi, kus esimesed lõigud ei muutunud | 28 | 11 | 17 |
| Küsimusi, kus pool või rohkem esimestest lõikudest muutus | 11 | 2 | 9 |

Kandidaatide hulk on mõlemal juhul sama suur (36 enamasti), nii et iga lisatud kandidaat võtab ühe varasema koha.

**Mis liiki lisatud dokumendid ette jõuavad** (kolmas läbijooks, 71 küsimust, sest osa vanemaid pöördeid oli vahepeal säilitusaja lõpu tõttu kustunud; 135 esimest lõiku lisatud dokumentidest):

| Liik | Lisatud dokumente | Esimesi lõike |
|---|---:|---:|
| Juhendid ja infomaterjalid | 106 (41%) | 66 (49%) |
| Uuringud 2023–2026 | 99 (39%) | 36 (27%) |
| Uuringud 2015–2022 | 52 (20%) | 33 (24%) |

Esimeste lõikude sekka jõudis 39 dokumenti 257-st. Täienduste kaupa: v65 61 lõiku, v66 34, v67 7, v68 33.

**Mida see ütleb ja mida mitte.**

- Lisatud dokumendid ei ole otsingus kõrvaline lisa: tavalise küsimuse kandidaatidest ja esimestest lõikudest on neist umbes viiendik, ja iga seitsmenda küsimuse esimestest lõikudest on pool või rohkem uued.
- Ette jõuavad sagedamini juhendid kui uuringud, mis on soovitud suund; vanemad uuringud (2015–2022) annavad siiski veerandi lisatud esimestest lõikudest.
- **See ei ütle, kas vastused läksid paremaks või halvemaks.** Mõõdetud on otsingu järjestus ilma tõendivalikuta; päris pöördes valib mudel kandidaatide seast ise ja võib uuringulõigu kõrvale jätta või eelistada. Selle teadasaamiseks tuleb samad küsimused küsida kahe korpusega ja vastuseid pimesi võrrelda (tasuline, tegemata).
- Vektorina oli plaani päringute juures küsimuse vektor, nii et päris pöörde kandidaadid võivad erineda.

## Tegemata

- **Vastuste võrdlus lisatud dokumentidega ja ilma** (tasuline): otsingu kordus näitab muutuse suurust, mitte suunda.

- **Uudiskirja dokumendid, mis ootavad** (loend `Andmebaasi/register/newsletter_documents.json`): 2 vastuvõtu kinni peetud uuringut (liiga paljudel lehekülgedel puudub tekstikiht), 9 ingliskeelset, 6 tekstikihita, 2 liiga suurt, 13 veebilehena kogutud artiklit (lehtede korjaja tee, ADR-095). Koguja aruandes on veel 12 kättesaamata PDF-i ja 9 muus vormingus allikat.
- Käivitusskript (`scripts/rag-v2-corpus-run.sh`) oskab nüüd pärast plaani keeldumist uuesti alustada (07.10.2026 õhtu): juba tõstetud pead ei pakita teist korda lahti, uus poliitikafail võetakse vana asemele, tühi plaanikaust eemaldatakse ja ebaõnnestunud käivituse lukk vabastatakse. Pärast ostu katkenud käivitust ta endiselt ise ei jätka.
- **Serveri ruumikulu lõigu kohta** (umbes 380 KB) on RAG-i kasvu tegelik piir; hoidla ja andmebaasi kordused ning JSON-vektorid on eraldi töö. Mõõtmine ja viis ettepanekut (kokku umbes 16 GB): [ADR-101](adr-101-storage-per-passage.md); ükski ei ole tehtud.
- LiveKiti kõnesalvestus pandi tagasi 07.10.2026 kell 19.40, pärast seda kui omanik ketast suurendas (58 → 77 GB); päris kõne salvestamist ei ole pärast seda proovitud.
- Kolmel v65 dokumendil puudub metaandmetes aasta.
- **Ülejäänud loendid:** ministeeriumi sotsiaalvaldkonna vanemad uuringud (122), töövaldkond (65), uuema tabeli tervisevälised jäägid; ameti uuringud ja analüüsid (68). Need on eraldi otsus ja ost.
- Ameti 34 alalehte jäi lugemata; juhendite loend ei pruugi olla täielik. Ministeeriumi kompetentsikeskuse lehte ei võrreldud.
- Kaks kinni peetud dokumenti („Rehabilitatsiooni käsiraamat“, „Sotsiaalhoolekande andmepõhise aruandluse mudeli loomine“) ja 62 MB voldik (omanik: „sellega tegeleme hiljem“).
- Mitme failiga uuringust on korpuses põhiaruanne (esimene PDF); lisad ja lühikokkuvõtted ei ole.
- Dokumendi uut versiooni asutuse lehel ei jälgita; igakuine uuendamine (ADR-098) neid ei loe.
- Võrdluse, valiku ja allalaadimise skriptid olid selle töö ajutised skriptid ega ole koodihoidlas; järgmise partii jaoks tuleb need kas uuesti kirjutada või hoidlasse tõsta.
