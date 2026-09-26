# RAG v2 ingest'i ja koguvaliku sõltumatu audit (Claude) ning kohalik laadimine

Kuupäev: 2026-09-25. Täiendab Codexi auditit
[rag-v2-codex-ingest-audit-2026-09-25.md](rag-v2-codex-ingest-audit-2026-09-25.md): sama
failikaart, eraldi läbilugemine ja parandused. Kõik tööd on kohalikud; mudeli- ega
embeddingukutseid ei tehtud. Embeddingute ost ootab omaniku kinnitust (allpool).

## Tulemus lühidalt

- Kohalikus store'is (`tmp/rag-v2-corpus-store`, tenant `sotsiaalai-corpus`) on **5985
  avaldatud dokumenti, 29 103 tükki**, töötlusversioon `source-structure-v12` /
  `structure-blocks-v6`. 14 allikat on kõrvale jäetud omaniku otsuseni (tabel allpool).
- Täpne ostuplaan: **29 051 erinevat sisendit, 14 682 957 tokenit, 1,908784 USD** hinnaga
  0,13 USD / 1M (kontrollitud 25.09 ametlikult mudelilehelt). Allikateksti plaanifailides pole.
- Ostujooksja parandati korpuse mahuks (varem ei oleks ~29 000 sisendiga ost lõppenud).

## Parandatud (iga uus test kukub parandamata koodil läbi)

| Leid | Fail | Mis oli ja mis muutus |
|---|---|---|
| A0 (P1) | `search/pilot-runner.js` | Iga sisendi eel kontrolliti kogu kinnituse kõigi sisendite räsi ja tokeneid uuesti (O(n²)). Nüüd täiskontroll korra, sisendi kaupa hinnaaken, kehtiv ligipääs ja selle sisendi räsi. |
| A1 (P1) | `search/pilot-runner.js` | Kulukirjet (kogu manifest + kõik kirjed) kirjutati iga sisendi kohta kaks korda üle. Nüüd `manifest.json` + ainult lisatav `ledger.jsonl` (üks fsync'itud rida sündmuse kohta, katkenud viimane rida lõigatakse). Vanad lõpetatud `ledger.json` ostud jäävad kasutatavaks; pooleli vanu ei jätkata. 3000 sisendit: 25 s, lineaarne. |
| A3/F16 (P1) | `search/capacity.js`, `search/unified.js` | Indeksi piir 1000 dokumenti / 5000 tükki ja ühise raja kataloogipiir 1000 ei mahutanud korpust. Piirid 10 000 / 60 000 ja 10 000; mahutest allpool. |
| Puuduv tööriist | `search/multi-source-plan.js`, `scripts/rag-v2-corpus-embeddings.mjs` | Tervest store'ist ostuplaani ei saanud teha (multi-source skript lubab 6–10 dokumenti). Uus plaan loeb ühe bundle'i korraga; tulemus on sama mis olemasoleval plaanil (test). |
| C01 | `text-source.js` | JSON-kirje sidumisväli jäi kirje tükki ja oleks kontakti tõendist välja jätnud; nüüd oma sektsioonis. |
| C02 | `metadata-values.js` | URL-ide võrdlus `decodeURIComponent` + NFC (5 lendlehe konflikt kadus). |
| C03 | `metadata-adapter.js`, `normalize.js` | Metaandmefail saab ülevaatuse järel välja kinnitada (`metadata_confirmations`: väli, väärtus, kes, millal, alus). Kinnitatud väärtus valitakse, teised jäävad asendatud kandidaatideks; kinnitatud aasta ei tee esilehe kuupäevast konflikti. |
| N12 (uus) | `registered-source.js` | Metaandmefailide räsi ei kontrollitud REGISTER.json vastu (ainult allikafaili oma). Nüüd kontrollitakse; kõik 1077 viidet klapivad. |
| F07, S09 | `registered-source.js` | Õigusakti jurisdiktsioon registri räsist või üheselt väljaandjast (59/59 aktil olemas); registri vahemälu uuendub failide muutumisel. |
| F10 | `parser.js` | OCR-teksti vahepealkirjad geomeetria järgi, sh väiketähega jätkuread; ajakirja OCR-failide ülevaade: 4 poolitatud pealkirja parandatud, uusi valepositiivseid ei tekkinud. |
| N07 | `search/model-context.js`, `structured-record-source.js` | Mudelile lähevad ainult vastust mõjutavad piirangud (tekstikihita lehed, kogutud või ülevaatamata tekst, metaandmekonfliktid, viidete loend väljaspool tõendit); töötlusmärkused jäävad auditipaketti. |
| N08 | `normalize.js` | Pealkirja/autori kontroll tähtede ja numbrite järgi; allika enda pealkirja (XML) ei võrrelda. XML 76 → 0, juhendid 111 → 75 (enamasti pildikaanega failid). |
| R1 (regressioon) | `normalize.js` | v10 esilehe kuupäevarida ei lubanud sildis kaldkriipsu („Uurimus/analüüs 06. juuni 2025“); leidis päris-artikli vastuvõtutest (`RAG_V2_INPUT_ROOT`), mida `npm test` vahele jätab. |
| W1 (uus) | `catalog.js`, `ingest-batch.js` | Windowsis võib just kirjutatud kaust olla hetkeks lukus ja ümbernimetamine ebaõnnestus (4/2000 KOV-kirjet). Nüüd piiratud kordus; partii viga säilitab OS-i veakoodi (`io_eperm`). |

Testid: `npm test` 228/228 (17 vahele jäetud on teenuse- ja päris-allika komplektid), päris-artikli
vastuvõtt 26/26, kohalike teenuste integratsioonikomplektid (EstNLTK, morfoloogia, indeksitööd,
partii, avaldamine, valikuline otsing, otsing) 56/56. Otsingukomplekti ootused uuendati v12 järgi
(11 532 tokenit, 26 sisendit; OTT-tsitaadi span on jätkuvalt lk 3).

## Kõrvale jäetud allikad (14) — vajavad omaniku otsust

| Allikas | Põhjus | Soovitus |
|---|---|---|
| Riigikontroll: Koduteenuste korraldus; Omavalitsuste tegevus erivajadustega inimeste toetamisel; Toimetulekutoetuse korraldus; Töövõime vähenemise ennetamine | metaandmetes 2025, dokumendi kuupäev 2023-11-22 / 2024-05-16 / 2023-01-16 / 2023-09-25 | aasta dokumendi järgi |
| SKA rehabilitatsiooni teenuseosutajate infopäeva materjal | 2024 vs 2020-10-16 | 2020 |
| Võrdõigusvolinik: arvamus töövõimetuslehe teemal | 2023 vs 2016-01-18 | 2016 |
| Ajakiri 1/2025: „Lapse õigus kasvada peres“, „Võlanõustamisteenus aastatel 2018–2023“ | veebikuupäev detsember 2024, number 1/2025 | jätta numbri aasta 2025 |
| HARNO: Õpitulemuste vähendamine, asendamine ja vabastamine | väljaandja ja kogu konflikt | väljaandja „Haridus- ja Noorteamet“, kogu `national_guidelines` |
| Päästeamet: Hoolekande- ja tervishoiuasutuste tuleohutus | kogu | `national_guidelines` |
| Peaasi: Koolilaste ja noorte vaimne tervis | kogu | `organization_materials` |
| Tark Vanem: Tööleht | allika tüüp ja kogu | väljaandja teadmata, küsida omanikult |
| Tallinn: Õigusnõustamine vähekindlustatud Tallinna elanikele | URL-i konflikt | „…elanikele“ (brauseris kontrollitud; „…elanikule“ on 404) |
| EPIKoda: „ÜRO … konventsioon ja fakultatiivprotokoll“ | fail on tegelikult „… ja puuetega inimeste õigused Eestis“ (EPIKoda 2013), metaandmetes 2025; sisaldab 2013. aasta toetussummasid | pealkiri ja aasta 2013 (või välja jätta) |

Täpsustus samal päeval: dokumentidest kontrollitud parandused koos allikakohtadega on
[ostueelses ülevaates](rag-v2-claude-prepurchase-review-2026-09-25.md#4-14-kõrvale-jäetud-allika-faktid-dokumentidest);
seal muutusid soovitused HARNO väljaandja nime ja Päästeameti aasta (2020) osas.

Otsuse järel kantakse väärtused metaandmefaili koos `metadata_confirmations` kirjega, REGISTER.json
räsid uuendatakse ja need 14 lähevad eraldi partiina läbi sama ülevaatuse.

## Märkused (ei takista)

- N16: 2,3% PDF-sektsioonide pealkirjadest (235/10 045, 76 dokumendis) on pikad: intervjuu
  küsimused, joonise allkirjad, sisukorra read ja mõni pealkiri, mis võttis kaasa esimese sisurea.
  Tekst ei kao (mudel näeb tüki täielikku lähteteksti); otsingu eesliide kordab lisasõnu.
- HARNO „Koolitöötajad jms toetav süsteemne lähenemine“ pealkiri näib failinimest tuletatud.
- N13 `readInput` nullib iga lugemise jaoks 32 MiB puhvri (jõudlus). N14 teadmiste ettevalmistus
  saadab iga PDF-rea eraldi JSON-fragmendina — enne GraphRAG-i sammu rühmitada ploki kaupa, muidu
  maksab sisend umbes kaks korda rohkem. N15 piloot räsib iga pöörde eel kõik jooksufailid (teadlik).
- EstNLTK 1.7.5 on kohalikult olemas (`tmp/rag-v2-estnltk-env`), lõplik indeks saab kasutada
  vaikeprofiili sõnaanalüüsi.

## Mahutest (kogu korpus, katsevektorid, EstNLTK)

| Samm | Tulemus |
|---|---|
| Indeksiplaan | 5985 dokumenti, 29 103 ühikut, 2 min, plaan 5,2 MB |
| Partiidena indekseerimine koos lõppkontrolliga | 64 min, 6072 partiid; 29 051 vektorit = ostuplaani sisendite arv |
| Kõigi dokumentide otsingukataloog | 0,3 s (11,8 MB), ühe pöörde jooksul kuni 7 korda |
| Vektoripäring kogu filtriga | 0,13 s |
| **Sõnaline järjestus (praegune)** | **keskmiselt 36,5 s päringu kohta (60 küsimust, üks ühendus); paralleelselt ~11 s; Postgresi 15 s piir katkestab** |

**L1 (P1 piloodile, ostu ei takista).** Sõnaline päring ühendab kõik sõnad OR-iga, nii et
tavasõnad („ja“, „on“, „kuidas“) sobivad ~27 600 ühikule 29 103-st ja igaühe jaoks arvutatakse
`ts_rank_cd` ka pikal morfoloogiavektoril. Sobitamine ise võtab 0,5 s, järjestus 30+ s. Ühise raja
pööre ebaõnnestus seetõttu `lexical_service_failed`. Kahe astmega päring (odav `ts_rank` valib
400/1000 kandidaati) on 1,5–2,5 s, kuid 40 parema tulemuse järjekord kattub praegusega vaid
27%/41% — see on järjestusmuudatus, mitte kiirendus, ja vajab ADR-i ning hindamist.
Kui kandidaadiks lubada ainult sõnad, mis esinevad kuni 10% ühikutest (skoor sama), on päring
13,5 s, 85% 40 parimast jääb samaks (21/60 loendit identsed) — ikka liiga aeglane. Juurpõhjus on
katvusjärjestus suurtel morfoloogiavektoritel (keskmiselt 468 lekseemi, sest igal ühikul on eesti,
inglise ja vene tüved). Lahendus vajab ADR-i: nt keelepõhised tüved (eesti tekstile ainult
EstNLTK), eraldi BM25-laadne skoor või sõnaline ümberjärjestus vektori- ja haruldaste sõnade
kandidaatidel; hinnata päris vektoritega. Mõõteskriptid: `tmp/rag-v2-corpus/lexical-*.mjs`.

## Järgmised sammud

1. Omaniku otsused 14 allika kohta → kinnitused metaandmetesse → lisapartii.
2. Embeddingute ost: omanik kinnitab täpse manifesti (`egress_manifest_sha256` plaanis) ja
   kululae (soovitus 2,00 USD). Hind tuleb enne käivitamist 24 h jooksul üle kontrollida.
3. L1: sõnalise järjestuse ADR ja teostus korpuse mahule (enne pilooti).
4. Lõplik indeks salvestatud vektoritega ja EstNLTK-ga, uue korpuse hindamisküsimustik, siis piloot.
