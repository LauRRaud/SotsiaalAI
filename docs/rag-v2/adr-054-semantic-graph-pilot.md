# ADR-054 — Semantilise graafi piloot: allikapõhised kaardid partiina ja graafi ruum vestluses

29.09.2026. Teostus Claude Opus 5.5. See on [RAG Graph arendusteekaardi](../SOTSIAALAI_RAG_GRAPH_ARENDUSTEEKAART_v0_1.md) M3 „sisulise sõltuvuskihi“ esimene päris samm. Aluseks on Codexi süsteemianalüüsi leid F6 ([audit](../audits/rag-v2-system-analysis-2026-09-29.md)): „esmalt väike allikatega ankurdatud tingimuste ja erandite valim ning mõõdetav katvuskontroll“. Omanik 29.09: „ehita edasi“; „raha ei ole hetkel probleem“.

## Probleem

- **Graaf oli tühi.** Vestluse profiil läbib semantilist graafi (`semanticGraph`: 16 sammu, 4 lisandust), aga aktiivses indeksis polnud ühtegi kaarti ega seost.
- **Kaartide koostamine käis ainult halduri vaates** (ADR-008), ühe dokumendi kaupa ja ühe päringuna. Sotsiaalhoolekande seadus (~272 000 tähemärki) ei mahu ühte päringusse.
- **Vestluse profiil ei jätnud graafile ruumi.** Üheksa järjestatud lõiku täitsid kõik üheksa lõppkohta ja 10 000-tokenise eelarve. Graaf leidis seotud väiteid, aga ei saanud lisada ühtegi allikalõiku.

## Otsus

### Kaardid partiina (`scripts/rag-v2-knowledge-batch.mjs`)

- **Režiimid:**
  - **plan** koostab valitud dokumentide päringud ilma võrguta;
  - **run** on ainus tasuline samm. Enne iga kõnet on reserveering ja vastus salvestatakse. Sama päringut ei saadeta teist korda (`KnowledgeJobs`, ADR-008).
  - **draft** koostab kaardifaili.
- **Osad** (`knowledgePreparationParts`): suur dokument jagatakse lõikude piirilt kuni 40 000-baidisteks osadeks. Fragmentide tunnused on dokumendi omad (T1…Tn), kaartide võtmed saavad osa eesliite (p3-c12) ja osadevaheline seos läheb lahendamata sõltuvuseks.
- **Osa piirid mahuvad väljundisse:** kuni 40 kaarti, 60 seost ja 8 lahendamata sõltuvust. Kaart võtab umbes 250 väljunditokenit ja 85 lubatud kaarti ületas 16 000 tokeni piiri.
- **Juhis:** eelista õigusi ja kohustusi otsustavaid tingimusi, erandeid, mõisteid ja summasid ning seo iga tingimuse, erandi, täpsustuse ja mõiste kaart väitega, mida see puudutab.
- **Leebe mustand** (`knowledgePartsDraft`) kontrollib iga üksust eraldi:
  - ankur peab olema fragmendi täpne ja unikaalne tekst ning läbima ingest'i ankrukontrolli;
  - kui sõnade vahel on muu tühik (reavahetus), leitakse tsitaat ikkagi, aga ankur võtab allika enda teksti. Ainult unikaalne vaste kehtib.
  - Muu jäetakse välja ja loendatakse (`dropped`), mitte ei parandata ega arvata. Puuduv osa on kirjas (`missing_parts`).
- **Halduri tervikpäring on muutmata:** 400 dokumendi plaani räsi on identne.

### Register ja ingest

- **Kaardifail** (`Andmebaasi/teadmised/<allikas>.knowledge.json`, `rag-v2/registered-knowledge-1`) nimetab oma allika tee ja räsi ning koostamise (mudel, partii, plaanide ja mustandi räsid, välja jäetud üksused, kasutus).
- **Allika kirje** nimetab faili (`knowledge_path`). Kirje rolliga `knowledge` nimetab faili baidid.
- **Ingest:** registriadapter kontrollib räsi, allikat ja kuju. Ingest võtab kaardid allika järgmisesse versiooni ja kontrollib iga ankru dokumendi enda teksti vastu. Tükid ja nende otsingutekst jäävad samaks, seega embeddinguid uuesti ei osteta.
- **Olemasolevad allikad on muutumatud:** 223 `oigusaktid` ja KOV allika registriväljund on HEAD-koodiga identne. Salvestati ainult uus sõrmejälg.

### Graafi ruum vestluses (`hybrid-estnltk-chat-v2`)

- Samad 9 järjestatud lõiku ja 10 000-tokenine eelarve nagu v1, lisaks 4 lõppkohta ja 3000 tokenit (`dependencyContextTokens`), mida saab kasutada ainult semantiline sõltuvus.
- Graafi kontekst (väited ja seosed) mõõdetakse sama laiendatud eelarve vastu.
- v1 on muutmata.

## Piloot

- **Dokumendid:**
  - Sotsiaalhoolekande seadus (12.06–30.09 ja 01.10–30.11.2026);
  - haldusmenetluse seadus (2024–2026);
  - abivahendite määrus (kaks redaktsiooni);
  - Harku sotsiaalhoolekandelise abi andmise kord ja selle lisa.
- **Mudel:** gpt-6-luna, arutlus `medium`.
- **Partiid:**
  1. esimene partii (õppetunnid): 27 kõnet, 0,18 USD plaani hinnaga;
  2. lõplik partii: 27 kõnet, 0,16 USD;
  3. Harku korra kordus (üks osa katkes võrgus): 3 kõnet, 0,02 USD.
  - Summad on plaani hinnatabeli järgi, tegelik kulu on OpenAI platvormil.
- **Tulemus: 780 kaarti, 282 seost, 61 lahendamata sõltuvust.**

  | Dokument | Kaarte | Seoseid |
  |---|---:|---:|
  | SHS (12.06) | 250 | 72 |
  | SHS (01.10) | 244 | 107 |
  | HMS | 120 | 42 |
  | Harku kord | 81 | 37 |
  | Abivahendite määrus (2×) | 33 kumbki | 12 kumbki |
  | Harku lisa | 19 | 0 |
- **Esimese partii õppetunnid:**
  - 123 tsitaati 998-st erines allikast ainult reavahetuse poolest;
  - SHS-is oli ainult 19 seost;
  - 85-kaardise piiriga osad jäid pooleli.
  - Parandused on ülal.
- **Korpus v38:**
  - indeks `4b050698`, 7 dokumenti suletud, 0 embeddingut;
  - vestlusplaan `m4-corpus-chat-20260929c.json` (…-1758, profiil v1).

## Mõõtmine

### Katvus otsingutasandil (`scripts/rag-v2-knowledge-coverage.mjs`)

Kasutatakse vestluse enda otsingut (`runtimeAdapters.search`) ilma otsinguplaani ja rerank'ita. Nii on graaf ainus muutuja. Mõõdetakse, kas küsimuse eeldatav tingimus või erand (akti täpne tekst, kontrollitud enne jooksu) on tõendipaketis. Küsimusi on 10: `tests/evaluation/knowledge/coverage-1.json`.

| Indeks ja profiil | Leitud | Graafi lisandusi | Graafi väiteid ja seoseid kontekstis |
|---|---:|---:|---|
| v37, kaartideta | 7/10 | 0 | — |
| v38, profiil v1 | 7/10 | 0 | on, aga allikalõiku lisada ei saa (`dependency_context_limit`) |
| v38, profiil v2 | **8/10** | 15 | kuni 10 väidet ja 8 seost küsimuse kohta |

- **v2 lisandus:** abivahendi omaosaluse reegel („mitte väiksem kui 7 eurot“) jõudis paketti graafi seose kaudu.
- **Endiselt puudu:**
  - toimetulekutoetuse erand hooldekodus olijale (SHS § 132 lg 7). Kaart on olemas, aga seost sellel pole ja see asub teises paragrahvis kui määramise reeglid;
  - abivahend, mida loetelus pole (määruse erandkord).
- **Mõõtmise piir:** tootmises kirjutab otsinguplaan igapäevased sõnad („hooldekodu“) ametlikeks terminiteks, seega alahindab see mõõtmine vestlust. Sama küsimustik vestluse täisahelas on kataloog `scenarios-coverage-1.json`, ootus `evidence_text`.

### Katvus vestluse täisahelas (`scenarios-coverage-1.json`, ootus `evidence_text`)

Samad 10 küsimust, iga küsimus eraldi vestlusena. Otsinguplaan, rerank ja graaf töötavad nagu vestluses.

| Indeks ja profiil | Leitud |
|---|---:|
| v38, profiil v1 (plaan t) | **10/10** |
| v38, profiil v2 (plaan w) | **10/10** |

Otsinguplaan kirjutab igapäevased sõnad ametlikeks terminiteks („hooldekodu“ → üldhooldusteenus) ja rerank valib lõigud. Nii jõudsid kõik 10 tingimust ja erandit paketti ka ilma graafi lisandusteta.

### Regressioonikontroll (aktiveerimata plaanid v38 peal)

| Kataloog | v37 | v38, v1 | v38, v2 |
|---|---:|---:|---:|
| Kataloog v4 | 40/40 | 40/40 (plaan r) | 40/40 (plaan q) |
| Lisade kataloog | 4/4 | 4/4 | 3/4, 4/4, 4/4 |
| Kulukataloog | 5/5 | 5/5 | 4/5, 4/5, 5/5 |

- v2 vead (parandatud 29.09 Codexi järelülevaate järgi; varem oli siin „kordusel ei korranud“, mis oli vale):
  - Peipsiääre vastus lükati ühes jooksus kolmest tagasi (`invalid_answer_reference`);
  - kuuldeaparaadi vastus jättis „piirhinna“ nimetamata **kahes kulujooksus kolmest**. Viga kordus. Kas selle põhjustas v2 lisakontekst, pole eraldatud.
- Omavalitsused on kõigis jooksudes samad.
- **Mõõtmistaristu vead:**
  - plaani p esimene katalooginjooks läks kaotsi: eval-full koopias oli ADR-052-eelne `store.js` ja üks ajutine OpenAI viga blokeeris kogu jooksu;
  - plaanid t ja u said samal minutil sama ID ja kulupäeviku (`ledger_plan_conflict`). Plaani ID on nüüd sekundi täpsusega.

## Järeldus

- **Ahel töötab otsast lõpuni:** kaardid partiina, register, ingest, indeks, graafi läbimine ja allikalõikude lisamine (profiil v2).
- **Selle kümne küsimuse täisahelas ei andnud graafi laiendatud eelarve (profiil v2) mõõdetud tõenditeksti katvusele lisa. Graafi enda mõju vastuse kvaliteedile ei eraldatud.** (Sõnastus parandatud 29.09 Codexi järelülevaate järgi; varem oli siin „graafil pole tootmises mõõdetavat eelist“.)
  - Vestlus (v1 koos otsinguplaaniga) leidis juba kõik 10 tingimust ja erandit. See on laeefekt: 10/10 baas ei saa samal mõõdikul paraneda.
  - Mõlemas profiilis on graaf sees. Ka v1-s jõuavad valitud lõikude kaardid ja seosed konteksti, seega puhast graafita võrdlust pole.
  - `evidence_text` mõõdab fraasi olemasolu tõendis, mitte seda, kas vastus kohaldas tingimust õigele inimesele või eristas erandit.
  - Ilma otsinguplaanita tõstis graaf katvuse 7/10 → 8/10.
- **Otsus:** vestlus jääb profiilile v1 korpusel v38. Kaardid jäävad indeksisse: nende väited ja seosed jõuavad konteksti seal, kus nende allikas on valitud.
  - Profiil v2 on olemas ja mõõdetud, aga tootmisse seda ei viida.
  - Kaartide koostamist kogu korpusele (umbes 6000 dokumenti) ei laiendata enne, kui raskem küsimustik näitab kasu. Teekaardi reegel: „kui keerukam mehhanism ei anna mõõdetavat eelist, jätame tootesse lihtsama variandi“.
- **Järgmine mõõdik** on küsimustik, kus otsing koos plaaniga ei leia määravat tingimust: tingimus teises paragrahvis või teises dokumendis, erand, mida küsimuse sõnad ei puuduta. Seal saab võrrelda:
  - mudeli kaarte;
  - akti enda ristviiteid (`lib/rag-v2/search/legal-references.js`, deterministlikud, ilma mudelita). Codex J5 järel hoiab lugeja loetelu akti ja redaktsiooni. Kohaliku korpuse 89 paragrahvidega aktis leidis ta 2228 oma viidet ja jättis 323 põhjendusega lahendamata (ADR-055);
  - sama jao naabreid.

## Piirid

- **Kaardid on ülevaatamata** (`source_anchored_unreviewed`). Tsitaat on allika täpne tekst, aga väite sõnastust ja seose õigsust pole keegi kontrollinud. Mudel näeb neid ainult otsinguabina.
- **Seoste katvus on osaline.** Näide: SHS-i erandikaart „toimetulekutoetust ei määrata … üldhooldusteenusel olevale isikule“ on olemas, aga seost toimetulekutoetuse reegliga sellel pole.
- **Seosed on ühe dokumendi sees.** Dokumentidevahelist sidumist ei tehta.
- **Piirid:** dokumendi kohta kuni 256 kaarti (ingest'i piir). Iga SHS-i redaktsioon koostati eraldi.
- **Kogu korpus:** umbes 6000 dokumenti oleks suurem kulu ja töö. Valim näitab, kas see tasub ära.

## Järgmised sammud (teekaardi järgi)

1. **Õigete seostega katse** (teekaart M3: „kas graafi kasutamine aitab siis, kui seosed on õiged“). Selle piloodi mõõtmine segab graafi kasu ja automaatse eraldamise vead. Katvusküsimustele tuleb käsitsi kontrollitud seosed, sama mõõtmine kordub ja nii eraldub eraldamise täpsus graafi kasust.
2. **Seoste teine kõne:** ainult seostele keskendunud päring, mis näeb osa kaartide loendit ja leiab tekstist nende seosed. Heuristiline sidumine („lähedal asuv lõik“) jääb välja, sest ADR-008 keelab selle.
3. **Tootmise profiil:** vestlus jääb v1-le (vt „Järeldus“). Kui raskem küsimustik näitab v2 kasu, vajab üleminek käsitsi tehtud plaani profiiliga `hybrid-estnltk-chat-v2`.
4. **M5 ülevaaterada** (GraphRAG-laadsed teemade ja perioodide kokkuvõtted) on teekaardis eraldi vastamisrada ja alustamata.
