# ADR-064 — Nimetatud teise akti säte jõuab tõenditesse (profiil v4)

01.10.2026. Teostus Claude Opus 5.5. Omanik 01.10: „alusta“. Järgib [ADR-063](adr-063-checked-relations.md) otsust (üks reegel viidete lugejasse) ja [ADR-057](adr-057-graph-experiment.md) (akti enda viited, profiil v3).

## Probleem

- Valla määrus või seadus ütleb sageli, et tingimus on teises aktis: „isik, kes on sotsiaalhoolekande seaduse § 25 lõikes 2 nimetatud“.
- Profiil v3 järgib ainult akti enda viiteid („käesoleva seaduse § 133“). Teise akti nimetatud säte jäi tõenditest välja.
- ADR-063 mõõtmises oli see ainus kuju, kus otsing otsustava sätte kaotas. Päris vestluses vastas Luna Harku tugiisiku küsimusele, et SHS § 25 lõike 2 sisu ei ole tal ees.

## Otsus

Uus otsinguprofiil `hybrid-estnltk-chat-v4`: profiil v3 ja üks reegel juurde.

- **Millal reegel rakendub:** valitud lõigus seisab teise akti nimi täielikult ja vahetult paragrahviloendi ees: „sotsiaalhoolekande seaduse § 25 lõikes 2“, „perekonnaseaduse § 97 punkti 1 või 2“.
- **Mis akt see on:** otsinguulatuse riiklik õigusakt (kehtivuse algusega, ilma piirkonnata), mille pealkiri omastavas käändes on see nimi. Ulatuses on küsimuse kuupäeval kehtiv redaktsioon. Kui sama pealkirjaga dokumente on ulatuses kaks, ei nimeta nimi kumbagi.
- **Mis lisatakse:** lõik, kus nimetatud lõike tekst tegelikult on. Pikk lõige jätkub järgmises lõigus, siis lisatakse mõlemad. Kui lõiget ei nimetata, paragrahvi esimene lõik.
- **Kui palju:** kuni 2 lõiku pöörde kohta, kahel omaette kohal (kokku 15 senise 13 asemel). Tekst mahub akti viidete senisesse ruumi (3000 tokenit); eelarve ei kasva.
- **Järjekord:** reegel käib pärast kõiki v3 lisandusi. Seega valib v4 kõik, mida v3, samas järjekorras, ja lisab ainult oma lõigud.

### Mida reegel ei tee

- Lühend („SHS § 25“), „sama seaduse“ ja lauses mujal nimetatud akt ei anna midagi. Nimi peab seisma vahetult loendi ees.
- Nimetatakse ainult seadust, seadustikku või koodeksit. Määrusel ja korral on pikk pealkiri, mida tekstid ei korda.
- Paragrahvide vahemik („§-de 31–35“) jääb välja.
- Lisatud lõigu enda viiteid edasi ei järgita.

## Teostus

- `lib/rag-v2/search/legal-references.js`:
  - `namedActReferences` loeb nimetatud teise akti loendid; `actGenitive` teeb pealkirjast nime; `resolveSection` leiab paragrahvi teise akti enda paragrahvide seast.
  - `provisionChunks` leiab lõigud, kus nimetatud lõige on.
- `lib/rag-v2/search/retrieval.js`: reegel pärast akti enda viiteid; mõõdik `named_act_references` ja ajamõõt `named_acts`.
- `lib/rag-v2/search/postgres.js`: `documentTitles` loeb dokumentide pealkirjad lõikude ridadelt. Otsingu kataloogis pealkirju ei ole. Pealkirja kontrollitakse pärast laadimist allika enda pealkirja vastu.
- `lib/rag-v2/search/profiles.js`: `CHAT_NAMED_ACTS_PROFILE`. Profiil v3 on muutmata.
- `scripts/rag-v2-corpus-run.sh` teeb uue vestlusplaani profiiliga v4.
- `scripts/rag-v2-graph-experiment.mjs`: haru N (profiil v4) ja võrdlus haruga L (skeem `rag-v2/graph-experiment-3`; alates [ADR-068](adr-068-own-reference-subsections.md) `-4`).

## Mõõtmine enne ühendamist

Serveris, rakenduse ajutises koopias, korpus v47, kuupäev 15.10.2026. Koopia ja plaan on eemaldatud.

### Otsingukatse, ilma vastuseta (tasuta)

| Kataloog | Küsimusi | v3 leidis | v4 leidis | v4 hoiab v3 valiku | Lisandusi (küsimustes) | Kontekst keskmiselt |
|---|---:|---:|---:|---:|---:|---:|
| [1](../audits/evidence/graph-v4-hard-1-2026-10-01.json) | 9 | 9 | 9 | 9 | 3 (3) | +128 tokenit |
| [2](../audits/evidence/graph-v4-hard-2-2026-10-01.json) | 6 | 5 | 5 | 6 | 2 (2) | +213 |
| [3](../audits/evidence/graph-v4-hard-3-2026-10-01.json) | 15 | 12 | 14 | 15 | 9 (7) | +438 |
| Kokku | 30 | 26 | **28** | **30** | 14 (12) | **+300** |

- Juurde tulid kaks küsimust: Harku tugiisik (SHS § 25 lg 2) ja pensionäritoetus õppiva lapsega (PKS § 97). Ükski ei kadunud.
- Lisatud lõigud: SHS 5, perekonnaseadus 3, lastekaitseseadus 3, sotsiaalseadustiku üldosa seadus 3.
- Otsingu aeg ei muutunud (mediaan 1,8–2,4 s mõlemal profiilil).
- Esimene jooks näitas, et reegel ei rakendunud kordagi: otsingu kataloogis ei ole pealkirju ja ühiktest käis ainult kataloogita rada. Parandatud (`documentTitles`) ja test käib nüüd ka kataloogiga.

### Päris vestluse rada (v4 plaan, aktiveerimata)

| Jooks | Küsimused | Tulemus | Kulu plaani hindade järgi |
|---|---|---|---:|
| Teise akti kolm küsimust (kataloog 3) | pensionäritoetus, lapse abivajadus, Harku tugiisik | 3/3 läbis | 0,0173 USD |
| Kataloogi 1 küsimused, kus v4 lisas lõigu | 3 | 3/3 läbis | 0,0157 USD |
| Kataloogi 2 küsimused, kus v4 lisas lõigu | 2 | 1 läbis, 1 otsingu taga | 0,0090 USD |

- **Harku tugiisik** (v3-ga jäi otsingu taha): „Ei, kui mõtled tugiisikuteenuse vahetut osutamist. Harku valla korras ei tohi tugiisik olla teenuse saaja üleneja või alaneja sugulane; poja vanaema kuulub nende hulka.“ Viitab valla korrale ja SHS-ile.
- **Otsingu taha jäi `coach-reports-child`.** Seda küsimust ei leidnud 30.09 ega täna ükski otsinguharu; vestluses valis rerank ainult juhendite lõigud ja lastekaitseseadus tõenditesse ei jõudnud. Reegel seda ei muuda. Sama päeva v3 võrdlusjooksu selle küsimusega ei tehtud.
- ADR-063 lävend on täidetud: Harku läbib, kaks ülejäänut jäävad läbima, kontekst kasvab keskmiselt alla 800 tokeni.
- Tasuline kulu kokku 0,042 USD plaani hindade järgi, kolm jooksu.

## Testid

- `tests/rag-v2-legal-references.test.mjs`: nimi vahetult loendi ees, pikem nimi võidab, lühend ja vahemik ei anna midagi; lõike lõigud, ka üle lõigupiiri.
- `tests/rag-v2-graph-experiment.test.mjs`: v4 lisab lõigu, kus nimetatud lõige on, nii kataloogiga kui ilma; v3 ei lisa; kaks sama pealkirjaga dokumenti ei anna midagi; lõikude ridade pealkiri, mida allikal ei ole, ei anna midagi; v4 seaded on v3 seaded ja kaks kohta.
- `tests/rag-v2-relation-gold.test.mjs`: otsingu lugeja nimetab seitsmel päris aktil samu teisi akte mis käsitsi kontrollitud kuldkomplekt (27 viidet; ainus erinevus on paragrahvide vahemik). Harku § 15 lg 3 annab SHS § 25 lõike 2 lõigu, kus otsustavad sõnad on.

## Codexi ülevaatuse parandus R1 (01.10.2026): numbri täpsus tuleb viitavalt tekstilt

- **Viga ([Codexi raport](../audits/rag-v2-pr300-301-review-2026-10-01.md), P2):** kas lihtne number „131“ on täpselt § 131, küsiti sihtakti redaktsioonilt. Number on aga loetud viitavast tekstist. PDF või vanema lugejaga XML võib olla ülaindeksi kaotanud ([ADR-056](adr-056-rt-xml-superscripts.md)), seega võib selle „§ 131“ olla § 13¹. Reegel lisas sel juhul § 131, kuigi sihtaktis olid mõlemad.
- **Nüüd:** täpsus tuleb viitava lõigu dokumendi redaktsioonilt (`keepsSuperscripts`); sihtakti paragrahvide loend jääb sihtaktist.
  - Viitav tekst ei hoia ülaindekseid ja sihtaktis on nii § 13¹ kui § 131: number on mitmetähenduslik, ei lisata kumbagi.
  - Sihtaktis on ainult § 13¹: see on ainus paragrahv, mida number saab tähendada, ja see lisatakse.
  - Kirjutatud ülaindeks („§ 13¹“) on täpne igas allikas. Ülaindekseid hoidvas tekstis on „131“ täpselt § 131.
- **Sama kehtib lõike numbri kohta** (`provisionChunks`, `exactNumbers`): ülaindekseid mittehoidva teksti „lõikes 21“ on lõige 2¹ ainult siis, kui paragrahvis lõiget 21 ei ole; kahe võimaluse korral lisatakse paragrahvi esimene lõik.
- **Testid:** Codexi tabeli neli juhtu ja kaks lisajuhtu mõlemal otsingurajal (kataloogiga ja ilma); lõike numbri juhud eraldi. Vana käitumisega uus test kukub.
- **Mõju mõõdetud tulemusele:** otsingukatse korratud serveris samal 30 küsimusel: ükski valik ei muutunud (28 leitud, samad 14 lisandust). Tasulist jooksu ei tehtud.
- **Hind:** SHS-is on nii §-d 13¹–13⁴ kui §-d 131–134. PDF-artikkel, mis nimetab „sotsiaalhoolekande seaduse § 131“, ei too enam seda paragrahvi kaasa, sest number on selles allikas mitmetähenduslik.

## Kasutuselevõtt

- Profiil on vestlusplaani osa. Pärast deploy'd tehakse serveris uus plaan profiiliga v4 (`scripts/rag-v2-chat-plan.mjs --profile hybrid-estnltk-chat-v4 --activate`) ja teenus taaskäivitatakse.
- Tagasi v3 peale saab uue plaaniga profiilist v3; kood toetab mõlemat.

## Piirid

- Mõõdetud on 30 otsinguküsimust ja 8 vestluspööret, iga jooks üks kord.
- Nimi on pealkirja omastav kääne lõpu järgi (seadus → seaduse). Kui aktil on kõnekeelne nimi või lühend, reegel seda ei tunne.
- Kaks eri akti, mille nimi lõpeb samade sõnadega, eristab pikem nimi. Akt, mida ulatuses ei ole, võib lõppeda ulatuses oleva akti nimega; sellist juhtu seitsmes kontrollitud aktis ei olnud.
- Lisandus võib olla küsimuse jaoks kõrvaline: 14 lisatud lõigust tõid puuduva otsustava fraasi 2. Ülejäänute asjakohasust ei ole hinnatud; nende hind on keskmiselt 300 tokenit küsimuse kohta.
- Kahe lõigu piir võib pika lõike korral jätta nimetatud punkti välja, kui lõige ulatub üle kahe lõigu.
- Ülaindekseid mittehoidvast allikast (PDF, vanem XML) loetud number, mis sihtaktis sobib kahele paragrahvile, jääb järgimata.
