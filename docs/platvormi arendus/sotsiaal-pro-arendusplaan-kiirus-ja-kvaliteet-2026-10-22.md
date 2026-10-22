# Sotsiaal.pro vestluse arendusplaan: kiirus, sisu ja töökindlus

22.10.2026. Koostas Claude Opus 5.5 omaniku palvel („pane kokku üks korralik plaan“). Aluseks:
- viis lugemisuurimust ja kriitiku kontroll;
- andmed: 255 vastatud pööret jooksudest R1, R2, R3 ja F1 ning 21.10 regressioonijooks koos otsingu sisemiste aegadega.

Kõik arvud on kontrollitud ja toorandmed on [uurimuses](../audits/evidence/sol-proof-20261014-01/arendusplaan-uurimus-2026-10-22.json).

## 1. Mida me teame

**Aeg sõltub sellest, mida mudel kirjutab ja kui palju ta arutleb, mitte sellest, mida ta loeb.** Aja korrelatsioon
101 pöördes:

| samm | sisendi maht | väljund | arutlus |
|---|---:|---:|---:|
| plaan | 0,11 | 0,63 | 0,63 |
| valik | 0,17 | 0,82 | 0,81 |
| vastus | 0,01 | 0,56 | 0,52 |

Pöörde aja jaotus (R3+F1, keskmine):

| osa | osa ajast |
|---|---:|
| vastus | 45% |
| otsing ilma LLM-ita | 19% |
| plaan | 18% |
| valik | 13% |
| ümbris | 5% |

**Mis selgus:**
- **Sõnaotsing on otsingu ainus kriitiline osa.** See lõpetas viimasena 75 pöördel 75-st ja lisab pöördele mediaanis
  2,35 s. Ainult sõnaotsingu leitud lõik ei jõua praeguste kaaludega kunagi valikusse (R1+R2: 0 kandidaati 5544-st). Sõnaotsing
  annab ainult lisapunkte lõikudele, mille vektorotsing juba leidis.
- **Vastuse nähtav tekst on juba lühike:** mediaan 167 sõna (pöörduja 144, spetsialist 210). Vastuse samm on
  aeglustunud arutluse, mitte teksti tõttu.
- **Arutlus kõigub sama juhisega.**
  - Pöörduja vastuse arutluse mediaan oli eri jooksudes 201, 224, 426 ja 502 tokenit.
  - Mudel jätab arutluse kutse kaupa juhuslikult vahele: vastuses 52 korral 255-st (6,2 s vs 12,2 s), valikus 72 korral 255-st.
- **Kasutaja näeb teksti varem, kui pööre lõpeb.** Vestlus voogedastab: esimene tekst tuleb ~21 s juures, pööre lõpeb
  ~27 s juures. Kõik mõõdetud jooksud olid voogedastuseta.
- **Pikkuse piiramine annaks vähe** (parimal juhul 0,25–0,6 s) ja selle sisurisk on suur.
- **„Osaline“ on mudeli enda silt, mitte sisu mõõt.** R2-s olid osalised 42 vastust 74-st:
  - vastus on sisuliselt täielik, aga piirang ütleb ainult, et otsuse teeb amet või kohus: 11;
  - kasutajalt on päriselt infot vaja, sh ohutusküsimused: 11;
  - teema puudus kandidaatide seas: 7, neist 4 on tõenäoliselt avalikus korpuses puuduvad (leping, aruandluse vorm);
  - valik jättis vajaliku lõigu välja: 5;
  - tõend oli olemas, aga vastus ütles „ei saa“: 3;
  - teenuseosutaja omavalitsus oli lahendamata: 4, nüüd ADR-167, 172 ja 173 abil parandatud.

## 2. Eesmärk ja mõõdik

- **Eesmärk:** vastus alla 30 s ilma kvaliteeti kaotamata, ka aeglasemates pööretes (p90).
- **Peamõõdik on omaniku valik:**
  - aeg esimese tekstini (`first_text`) on see, mida kasutaja tunneb;
  - aeg lõpuni (`done`) on aeg allikate ja lõpliku vastuseni.

  Mõlemat mõõdetakse.
- **Mõõtmise viis:**
  - ühe muudatuse kaupa vahelduv A/B samas sessioonis või üksiksammu taasesitus, sest jooksude triiv (arutlus +200 tokenit sama
    juhisega) varjab alla 1 s mõjusid;
  - deterministlikud muudatused mõõdetakse komponendi taimeriga ja võrdsustestiga;
  - LLM-i muudatused mõõdetakse tokenitega.

## 3. Etapid

### Etapp 0. Mõõtmisalus (käitumist ei muuda)

1. Pöörde jälge lisanduvad taimerid:
   - allikate laadimine pärast valikut, eraldi andmebaasi ja kontrolli osa;
   - seemnete laadimine;
   - valiku ümbris;
   - `searchTimings` jõuab tagasi ekspordi.
2. Pöörde jälge lisandub silt, mis omavalitsuse ahela samm otsuse tegi (küsitud / plaani päring / tööpiirkond / pere /
   eelmine / vastus). See on silumise jaoks, kiirust ei mõjuta.
3. Serveris loetakse sõnapäringu kulu: `EXPLAIN (ANALYZE, BUFFERS)` viie küsimusega. See on ainult lugemine, üks ~4 s päring.
4. Baasjooks main'il voogedastusega: 27 küsimusega vigade test ja 75 küsimust öösel.

### Etapp 1. Kiirus, sama tulemus

| muudatus | oodatav võit | risk | otsus |
|---|---|---|---|
| **Sõnaotsing ainult vektorkandidaatidele.** Täisskaneerimise asemel skooritakse vektorikanalite ID-d sama valemiga. | **pöörde mediaan −2,1…−2,35 s** (~8–10%), vabastab 2 andmebaasiühendust pöörde kohta | keskmine: lisapunktide järjestus muutub (korpuse top-40 asemel kandidaatide seas), kaaslassätete rada kaotab ainult sõnaotsingu tabamused. Enne kasutuselevõttu võrdlusjooks fikseeritud plaani ja vektoritega, K kalibreerimine | **omanik** |
| Pärast valikut laaditakse dokumendid ühe päringuga. Vajadusel kontrollitud dokumendi vahemälu versiooni järgi. | mediaan ≤0,33 s, **p90 ~1,3 s**, sabas kuni 3 s | väike, tulemus sama | — |
| Plaanist sõltumatu otsingu ettevalmistus plaani ajal (kataloog, kehtivus, pealkirjad) | ≤0,25 s | väike | — |

### Etapp 2. Vähem väljundit ja arutlust (LLM, A/B mõõtmisega)

| muudatus | oodatav võit | risk | otsus |
|---|---|---|---|
| Plaan ei kirjuta juba loetud sõnumite kohti uuesti (R3+F1-s 76 korda, kasutati 0) | jätkupöördes ~0,1–0,35 s | väike kuni keskmine: kui mudel jätab vahele ka praeguse sõnumi koha, kaob omavalitsus. Kohtade regressioonid peavad läbima | — |
| Dialoogi olek. Kõigepealt mõõta, kui suur see on (esimeses pöördes hinnanguliselt ~290 tokenit). Seejärel tähendab `needs`/`unknowns` null „muutusteta“. | jätkupöörde lõpuaeg (`done`) 0,3–1 s, `first_text` 0 | keskmine: vananenud „teadmata“ võib panna uuesti küsima. Olekuversioon tõuseb | — |
| Valiku juhise väikesed katsed eraldi taasesitusega (praegune sõnum eraldi väljal, tingimuslikud read) | igaüks ≤0,2 s, spekulatiivne | väike kuni keskmine | — |

### Etapp 3. Sisu (mõõdetakse kiirusest eraldi)

| muudatus | oodatav mõju | risk | otsus |
|---|---|---|---|
| **Piirangu reegel:** kui vastus on tõendite põhjal täielik, ei kirjuta piirang ainult „otsuse teeb amet“ | osalisi −4…−8 pp | vastuse põhijuhis muutub (ADR-165 pretsedent: arutlus võib kasvada). Mõõta tokenitega | **omanik** |
| **Osaliste mõõdik serveris sisu järgi:** on piirang või küsimus ja piirangu liik. Mudeli silt jääb jälge. | mõõdik stabiliseerub, arv muutub definitsiooni tõttu | vanad jooksud arvutatakse JSON-idest ümber | **omanik** |
| Kitsas serveri parandus: ainult kirje kuupäeva või ajakohasuse kohta käiv piirangulause eemaldatakse (juhis keelab selle juba) | sisu, aeg 0 | võib eemaldada õige hoiatuse; iga eemaldus läheb jälge | **omanik** |
| **Korpus:** üldine allikas omavalitsuse ja teenuseosutaja lepingu, tellimuse ja aruandluse kohta (punkt 28) | −1…−5 pp, kui selline allikas on olemas | väike, kui allikas on ametlik | **omanik** |

### Etapp 4. Omavalitsuse loogika

- **Praegu struktuuri ei muudeta.** Etapis 0 lisandub otsuse silt. Tänased parandused (ADR-167–173) mõõdetakse koos etapiga 1.
- **Hiljem, kui reegleid tuleb juurde:** plaan annab varjurežiimis ühe omavalitsuse otsuse koos alusega, ja võrreldakse
  praeguse ahelaga.
  - Kiiruse võit ~0.
  - Risk on kõrge, sest plaan kõigub: C01 andis viiest kordusest kolm korda „Viljandi linn“ ja kaks korda „Viljandi“.

## 4. Mida me ei tee ja miks

| muudatus | põhjus |
|---|---|
| Vastuse pikkuse lagi | võit 0,25–0,6 s, sisurisk suur |
| Spetsialistile vähem sätteid | omaniku otsus (ADR-129), võit 0,1–0,2 s |
| Küsimuse vektor plaani ajal | võit 0 s: vektor pole kriitilisel teel |
| Vastuse skeemi `enum` või `factual` maha | ≤0,1–0,15 s, vastuse versioon muutub |
| Plaani tsitaatide lühendamine | lõhub omavalitsuse loogika |
| Kaks samaaegset valikukutset | valiks sagedamini arutluseta tulemuse, kulu kahekordne, kuluarvestus seda ei luba |
| Valiku ülempiir 9 → 6 | lõigu mõju vastusele on 0,1–0,3 s |
| Konteksti vähendamine kiiruse pärast | sisend aega ei mõjuta (r = 0,01). Kirjete kärbe (ADR-169) on kulu küsimus |

## 5. Oodatav tulemus pärast etappe 1 ja 2

- **Lõpuaeg (`done`):** mediaan −3…−4 s (~27 → ~23–24 s). p90 paraneb peamiselt sõnaotsingu ja dokumentide laadimise
  sabast.
- **Esimese teksti aeg (`first_text`):** −2,5…−3 s (~21 → ~18 s).
- **Mis jääb alles:** teenusepakkuja ja arutluse kõikumine on meie kontrolli all ainult osaliselt. Vastuse sammu saba
  (18–36 s) tuleb peamiselt arutlusest.

## 6. Omaniku otsused

1. Peamõõdik: `first_text`, `done` või mõlemad.
2. Sõnaotsing ainult vektorkandidaatidele (etapp 1, suurim võit, keskmine risk).
3. Piirangu reegel ja osaliste mõõdik (etapp 3).
4. Korpus: lepingu, tellimuse ja aruandluse allikas.
5. Kasutamata tabel `rag_v2_version_lexical`: kas kustutada.
