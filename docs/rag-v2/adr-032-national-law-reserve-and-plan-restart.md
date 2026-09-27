# ADR-032 — Riikliku õiguse reserv valikus ja vestluse jätk pärast plaani uuendust

27.09.2026. Teostus Claude Opus 5.5. Järgib [ADR-031](adr-031-source-level-and-answer-completeness.md) lahtisi küsimusi: HMS ei jõudnud vaidlustamise küsimusel tõendisse, ja vana vestluse jätk ebaõnnestus pärast vestlusplaani ümberehitust.

## Probleem

1. **Riigi seadus ei jõudnud valijani.** Küsimusel B9 („Mida saan teha, kui omavalitsus keeldub mulle sotsiaalteenust andmast ja ma ei nõustu otsusega?“) ei tulnud Haldusmenetluse seadus (HMS) ühelgi korral tõendisse, kuigi v26 korpuses see on ja plaan nimetas seda päringus.
   - Mõõdetud 27.09 B9 kandidaatide hulgaga: teadmusraja 30 parimast liidetud kandidaadist (`RERANK_POOL`) 19 olid omavalitsuste kordade „Vaidlustamine“ / „Vaidemenetlus“ paragrahvid ja 11 artiklid või juhendid. Ühtegi riikliku seaduse lõiku polnud.
   - Riiklikud tekstid üksi otsides oli SHS § 146 esimene, SÜS § 36 teine ja HMS § 87 neljas. Nad olid olemas, aga 54 omavalitsuse peaaegu samasugust lõiku täitsid valija hulga enne neid.
2. **Vana vestlus ei jätkunud.** Pärast vestlusplaani ümberehitust andis vana vestluse küsimus veateate „Valitud varasem kontekst pole kättesaadav“ (`context_unavailable`).
   - Vestluse pea (`metadata.m4Dialogue`) viitab eelmise plaani pöördele. Uue plaani all on selle vestluse pöörded peidus (ajalugu filtreeritakse `configHash` järgi), seega vestlus paistab tühi.
   - Kliendi vaikevalik oli „Jätkan sama teemat“. Server keeldus, sest „aegunud pea ei luba vana isiku konteksti taastada“. Uus vestlus töötas.
   - See kordub pärast iga deploy'd, mis plaani ümber ehitab. 27.09 serveris: 26 hiljutisest vestlusest 11 oli selles seisus.

## Otsus

### 1. Riikliku õiguse reserv valiku kandidaatides

**Riiklik õigustekst** (`nationalLegalText`, `lib/rag-v2/search/unified.js`): teadmusdokument, millel on kataloogis `valid_from` ja pole `regions` väärtust. v26 korpuses on neid 7: SHS, HMS, SÜS, Lastekaitseseadus, Perekonnaseadus, Riigilõivuseadus ja abivahendite määrus (kokku 1469 ühikut). Omavalitsuse korrad on `regions` väljaga ja jäävad välja. Ükski väli ei tulene pealkirjast ega mudelist.

**Reserv** (`poolReserve`, `lib/rag-v2/search/retrieval.js`):
- Päringu väli `poolReserve: { documents, size, perDocument }` (valideerib `validateQuery`: kuni 100 dokumenti, `size` ja `perDocument` 1–10).
- Kui otsingul on valija (`hooks.rerank`), otsitakse reservi dokumentidest eraldi samade tekstide ja samade vektoritega: üks sõnaline päring ja vektoripäring küsimuse ning iga plaanipäringu kohta. Uut embedding'ut pole; reservi otsing käib põhiotsinguga paralleelselt.
- Reservi read liidetakse eraldi RRF-iga. Nende read, mida põhijärjestuse 30 kandidaati juba sisaldavad, jäetakse vahele. Ülejäänutest lisatakse valija hulga lõppu kuni `size` lõiku, ühest dokumendist kuni `perDocument`.
- Valija otsustab nagu varem, milline lõik jääb. Reserv ei pane ühtegi lõiku tõendisse ilma valijata.
- Ilma valijata (otsinguabi pole plaanis või valik ebaõnnestus) reservi ei kasutata ega otsita.
- Vestluse teadmusrada: `NATIONAL_LAW_RESERVE = { size: 6, perDocument: 2 }`. Valija loeb seega kuni 36 lõiku. Esimene katse `perDocument` = 6 täitis reservi viie SHS-i lõiguga ja HMS jäi välja; kahene piir jagab kohad aktide vahel.

**Jälg paketis:** `selection_config.pool_reserve`, kanal `pool_reserve`, `candidate_counts.reserve_*`, `rerank.reserved`, `raw_rankings.reserve`. Reservist tulnud tõendi `selection.ranks` võtmed on `reserve_lexical`, `reserve_vector` jne. Tõendi valiku põhjus jääb `ranked_seed`.

Muutmata: `RERANK_POOL` = 30, valikus kuni 9 lõiku, valija juhis `rag-v2/search-assist-2`, profiil `hybrid-estnltk-chat-v1`, kataloogi ja perioodiradade loogika.

### 2. „Jätkan sama teemat“ pärast plaani uuendust alustab uue teema

**Server** (`acceptDialogue`, `lib/rag-v2/pilot/dialogue.js`): kui vestluse pea on teise plaani oma ja praeguse plaani all pole selles vestluses ühtegi pööret, pole midagi jätkata. „Sama teema“ alustab siis uue teema nagu uue vestluse esimene sõnum (`context.selection = 'new_scope'`). Audit märgib `selection.headFromEarlierPlan: true`.
- Endine kaitse jääb: aegunud pea sama plaani all (`context_unavailable`) ja teise plaani pea, kui praeguse plaani all on vestluses pöördeid, lükatakse tagasi.
- Parandus (`correction`) ja nimetatud teema (`contextTurnId`) vajavad endiselt praeguse plaani pööret.

**Klient** (`usePilotDialogue`): kui kontekst on laaditud ja aktiivset teemat pole (uus vestlus või vestlus, mille pöörded on eelmise plaani omad), on vaikevalik „Uus teema“. Kasutaja enda valik jääb kehtima. Konteksti olek näitab siis teadet `m4Pilot.contextRestarted`: varasemad sõnumid on enne teenuse uuendust ega ole enam kontekstiks, järgmine sõnum alustab uut teemat.

Server lahendab ka vana kliendikoodi ja laadimise ajal saadetud sõnumi juhu.

## Mõõtmine

Failid: kohalik `tmp/rag-v2-dev-2026-09-27/` ja server `/home/ubuntu/rag-v2-work/eval-files/`. Hinnastaadium `eval-reserve` (main `f312233b` + selle ADR-i kood). Mõõtmise skriptid said variandi `reserve`; mõlemad variandid kasutasid küsimuse kohta sama plaani.

### Allikavalik 12 küsimusel (`law-check.mjs`, `law-reserve2-v26.json`)

| Küsimus | ilma reservita | reserviga |
|---|---|---|
| B1 toimetulekutoetus | SHS | SHS |
| B3 teade abivajavast lapsest | LasteKS, juhend | LasteKS, juhend, uuring |
| B4 omaosalus hooldekodus | artikkel | SHS, artikkel |
| B6 isikliku abistaja teenus | SHS, Järva, Tallinna kord | SHS |
| B8 vältimatu abi | SHS | SHS |
| B9 keeldumise vaidlustamine | Tallinna, Jõhvi kord, 3 artiklit või juhendit | **SÜS, HMS**, Tallinna, Elva kord, artikkel |
| B10 lapse arvamus | 2 juhendit | LasteKS, 2 juhendit |
| C9 kuuldeaparaat | teatmik, teabematerjal | teatmik, SHS, teabematerjal |
| F3 Narva, eakas kodus | Narva artikkel | Narva artikkel, SHS |
| F4 toimetulekutoetus | SHS | SHS |
| G11 1600/600/500 | SHS, artikkel | artikkel, SHS |
| A9 Tartu sotsiaaltransport | artikkel | SHS, artikkel |

- Riiklik seadus tõendis: 6/12 → 12/12 küsimusel.
- B9 sai HMS-i kahel reservi jooksul kolmest. Esimene jooks (`perDocument` 6) andis ainult SÜS-i; silumisjooks (`law-debug-b9.json`) ja teine jooks andsid HMS § 87.
- Kulu: 0,048 USD jooksu kohta (12 plaani, 24 valikut).

### Otsinguabi 52 küsimusel (`assist-eval-v26.mjs`, `assist-reserve-v26.json`)

ADR-030 hindamiskomplekt, 48 vastatavat ja 4 vastuseta küsimust. Mõlemal variandil sama plaan küsimuse kohta.

| 48 vastatavat | ilma reservita | reserviga |
|---|---:|---:|
| Kõik õiged lõigud | 35 | **38** |
| Vähemalt üks õige lõik | 44 | **45** |
| Õige dokument | 46 | **47** |
| Tõendilõike keskmiselt | 3,6 | 3,8 |
| Tõendeid 4 vastuseta küsimusel | 0, 0, 0, 0 | 0, 0, 1, 1 |
| Kulu (mõlemad variandid) | 0,209 USD | |

- Reserviga paremad: `laws-01` (SÜS ja SHS), `laws-03`, `laws-07` (abivahendite määrus ja SHS, ilma reservita isegi õiget dokumenti polnud), `journal-b-11`.
- Halvem: `journal-a-04` (sai SHS-i, kaotas ühe ankru).
- Vastuseta `journal-b-13` ja `journal-a-13` said reserviga ühe lõigu. Mõlemad lõigud olid põhijärjestuse kandidaadid, mitte reservist (`reserved_selected` 0): Sotsiaalkiirabi artikkel ja lähisuhtevägivalla artikkel. See on valija varieeruvus sama hulga peal. `journal-b-13` sai sama lõigu ka ADR-031 search-assist-3 jooksus.
- Kiirus: reservi variant jooksis küsimuse kohta teisena, pakkuja eesliite vahemälu ja soe andmebaas soosisid seda. Selle jooksu ajad üksi kiirust ei võrdle (vt teine jooks). Valija sisend kasvab kuni 6 lõigu võrra (~20%).

**Teine jooks vastupidises järjekorras** (`assist-reserve-rev-v26.json`, reservi variant esimesena, 0,209 USD):

| 48 vastatavat | ilma reservita | reserviga |
|---|---:|---:|
| Kõik õiged lõigud | 34 | **35** |
| Vähemalt üks õige lõik | 45 | 45 |
| Õige dokument | **47** | 46 |
| Tõendeid 4 vastuseta küsimusel | 0, 1, 0, 0 | 0, 0, 0, 0 |

| Kahe jooksu summa (96 paari) | ilma reservita | reserviga |
|---|---:|---:|
| Kõik õiged lõigud | 69 | **73** |
| Vähemalt üks õige lõik | 89 | **90** |
| Õige dokument | 93 | 93 |
| Tõendeid vastuseta küsimusel | 1 | 2 |

- Vastuseta küsimuste lõik liikus jooksude vahel variandist teise, seega on see valija müra, mitte reservi mõju.
- Teises jooksus kaotas reserviga `guides-02` õige dokumendi (valija võttis SHS-i ja kaks muud lõiku); esimeses jooksus oli see mõlemal õige.
- **Kiirus samal kohal:** valik esimesena 2,50 s (ilma) vs 2,50 s (reserviga), teisena 1,24 s vs 1,42 s (p50). Reserv lisab valikule kuni ~0,2 s; otsing käib paralleelselt.

### Vana vestluse jätk (`stale-head-check.mjs`, ainult lugemine)

Serveris 26 hiljutist piloodivestlust aktiivse plaani `m4-corpus-chat-20260927k` all, uue koodiga `acceptDialogue` mälus (midagi ei kirjutatud):
- 11 vestlust: pea eelmise plaani oma, praeguse plaani pöördeid 0. Enne: `context_unavailable`. Nüüd: uus teema, `headFromEarlierPlan`.
- 2 vestlust: pea praeguse plaani oma. „Sama teema“ jätkab aktiivset teemat nagu enne.
- 13 vestlust: pead pole. Uus teema nagu enne.

### Testid

- Uus `tests/rag-v2-pool-reserve.test.mjs` (5 testi): riikliku õiguse rühm; reserv toob seaduse valijani, kui 40 omavalitsuse lõiku täidavad hulga; `perDocument` jagab kohad; reservi ei kasutata ilma valijata; hulgas olev kandidaat ei kordu; reservist väljapoole jääv tulemus peatab otsingu; sisendi piirid.
- `tests/rag-v2-dialogue.test.mjs`: plaani vahetuse järel „sama“ alustab uue teema; parandus ja nimetatud teema lükatakse tagasi; praeguse plaani pöörete korral jääb `context_unavailable`.
- RAG v2 ühiktestid kohalikult rohelised, v.a keskkonna puudused (test-DB URL, EstNLTK, `next/server`), mis on sama `main`-il.

## Piirid

- 52 küsimust kaks jooksu, 12 küsimust kaks jooksu (+ üks silumisjooks B9-le); valija varieerub samal hulgal. Kogukulu 27.09 selles töös ~0,52 USD.
- `nationalLegalText` eeldab, et riiklikul aktil pole `regions` väärtust ja omavalitsuse aktil on. Uue allikaliigi (nt maakondlik või riiklik juhend kehtivusajaga) korral kontrolli rühma enne indekseerimist.
- Riigilõivuseaduses on 714 ühikut; reservi kahene piir hoiab selle ühe akti kohtadest kahel. Kehtetuks tunnistatud sätted (nt SHS 5. peatüki „Kehtetu“ read) on indeksis ja võivad reservi sattuda; see on XML-i puhastuse töö (aruande parandus 5).
- Valija ei saa endiselt tänast kuupäeva ega allika taset (ADR-031 search-assist-3 katse).
- Klient: konteksti oleku teade on konteksti juhtelementide sees (`<details>`, vaikimisi suletud). Tühja vestluse vaade ise teadet ei näita.

## Staatus

- Harul `claude/rag-v2-national-law-reserve`, PR järgmisena. Muudatus puudutab `lib/rag-v2`-te ja `messages/*.json`-i, seega pärast deploy'd tuleb vestlusplaan uuesti ehitada ([runbook](runbook-corpus-increment.md)).
- Plaani ümberehitus paneb kõik olemasolevad vestlused „eelmise plaani pea“ seisu; selle ADR-i jaotis 2 lahendab just selle.
