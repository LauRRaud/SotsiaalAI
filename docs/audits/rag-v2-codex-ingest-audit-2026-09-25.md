# SotsiaalAI RAG v2 süsteemi, ingest'i ja metaandmete sõltumatu audit

Algne audit: **2026-09-25**. Viimane järelkontroll: **2026-09-26, v25**. Töökaust: `C:\Users\rauds\Desktop\Sotsiaal.ee`.

## Viimane järelkontroll: külmutatud v25 sõltumatu kontroll

**R03 konkreetsed vastunäited on parandatud ja selle leiu võib sulgeda. V25-st ei leidnud uut koguvaliku embeddinguostu blokeerivat koodiviga.** Täpne v22 → v25 võrdlus kinnitab, et varasemast tükkide põhitekstist ei kadunud ühtegi allikarida; lisandus **18 rida kümnes PDF-is**. R01/R02 varasemad parandused säilivad. Külmutatud plaani võib esitada omanikule kinnitamiseks, arvestades allpool kirjeldatud piiranguid. See ei ole ostuluba ega kinnitus, et kogu korpus on sisuliselt veatu.

Kohalikult läbis **242 testi**; kõik **5999 dokumendi 631 861 span'i** vastasid allika täpsele viilule. **37 PDF-i** värske parse–normalize väljund kattus store'iga viies struktuuriosas. Ostuplaani sõltumatu arvutus kordus täpselt: **5997 dokumenti, 29 354 sisendit, 14 923 234 tokenit**, manifest **`17d3ffa5e910…`**. Plaan on õiguspäraselt koostatud **ilma hinnata**; vana hinna järgi arvutatud **1,940020420 USD** ei ole värske hinnakinnitus.

Töö oli lugemiseks. Koodi, metaandmeid ja korpust ei muudetud; võrgu-, mudeli-, OpenAI-, embeddingu- ega andmebaasikutseid ei tehtud. Ainus muudetud mitteajutine fail on see raport. Ajutised tõendid on `tmp/codex-audit/`. Opuse [raporti §12](C:/Users/rauds/Desktop/Sotsiaal.ee/docs/audits/rag-v2-claude-prepurchase-review-2026-09-25.md:608) väiteid kontrolliti sõltumatult; tema pakutud **2,00 USD** kulupiiri ei käsitletud omaniku antud loana.

### Ulatus ja külmutus

- HEAD **`5ab30c02d874a1524074e04c19f09331e2d863c9`**; normaliseerimine **`source-structure-v25`**; tükeldamine **`structure-blocks-v19`**; teostuse sõrmejälg **`aa9b917b2280f182110609d97c5b4e42e1619b7f473ee88792aba53ead2eb4f5`**.
- Varasema **212 süsteemifaili** kaardi räsid kontrolliti. V22 järel muutus **4 faili**: `chunking.js`, `contracts.js`, `processing-implementation.json` ja `rag-v2-source-structure.test.mjs`. Läbi vaadati kogu **159-realine diff**, vajalik ümbritsev kood ning katvuskontrolli muudatused. Ülejäänud **208 faili ei loetud seekord uuesti tervikuna**; nende varasem audit ja failikaart jäävad ajaloolistesse osadesse.
- Kõigi **15 varem auditeeritud Andmebaasi muudatusfaili** räsid on v22-ga samad. Kõigi 5999 dokumendi allika- ja metaandmeräsid ning allikaüksuste `raw_text` on v22-ga samad. **1023 PDF / 43 HTML / 59 XML / 4874 JSON**. Muutus kümne PDF-i `retrieval_text`; kõik mitte-PDF sisendid jäid samaks.
- Kõigi dokumentide tükke **29 478 → 29 487**, sisendiräsidest eemaldus **1**, lisandus **10**. Üks olemasolev tükk täienes, üheksa tükki lisandus. See ei tähenda ühe sisulõigu kadu: kadunud sisendiräsi asendus sama vana teksti ja taastatud joonealuse ühise sisendiräsiga.
- Külmutuse kontroll läbis alguses ja lõpus: **39 külmutatud koodifaili**, plaan **`17d3ffa5e910…`**, generatsioon **`18f457dc8970…`**. Kontrolli teostuse koopia on eraldi `v25-source/`. Lõpus oli **0 muutunud süsteemiräsi ja 0 muutunud auditeeritud andmefaili**; kõigi **14 store'i** ning Andmebaasi failiteed, suurused ja muutmisajad jäid samaks. Inventuur ei ole kõigi store'i failide teine sisuräside arvutus.

[Manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-manifest.json), [koodidiff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-delta.diff), [kogu väljundi võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-store-check.json), [täpne tekstimuutuste võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-exact-delta.json), [lõppkontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-verification.json).

### Parandada enne embeddinguid

**Selles ringis uut kohustuslikku ingest-koodiparandust ei tuvastatud.** Alles on ostu eeltingimused: omaniku kinnitus täpsele manifestile ja kulupiirile ning värske hinnatõend enne käivitamist. Soovitus ei nõua uut versiooni ega korpuse ettevalmistust ainult versiooninumbri tõstmiseks.

Opuse väide hinna ja manifesti kohta on õige. [multi-source-plan.js:104](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/multi-source-plan.js:104) arvutab manifesti sisenditest, failidest ja embeddingukonfiguratsioonist; hind lisandub eraldi plaani kokkuvõttesse. Värske hinna võib seetõttu kontrollida **pärast** manifesti ja kulupiiri kinnitamist, vahetult enne ostu. [pilot-manifest.js:37](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-manifest.js:37) kontrollib 24 tunni vanust ning `validateApproval` kontrollib nii manifesti ulatust kui ka värske hinna järgi arvutatud kogukulu. [pilot-runner.js:169](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:169) kontrollib hinda ja kulupiiri ka jooksvalt.

**Hinnatõend on jätkuvalt aegunud:** kontrollitud **2026-09-25 09:28:36.050 UTC**, 24 tunni piir möödus **2026-09-26 09:28:36.050 UTC**. Selle auditi plaaniarvutus kasutas `price=null`; ajaloolist kella ega hinnaväravast möödumist ei olnud vaja. **Kordamine:** `v25-plan.mjs`. **Tegevus enne ostu:** kinnitatud manifest ja kulupiir, värske kontrollitud hinnakirje, ostujooksja olemasolevad kontrollid. Kui uus hind ületab kinnitatud kulupiiri, ei anna varasem manifestikinnitus luba piiri ületada.

### R03 paranduse kontroll

Parandatud kontroll moodustab väljajäetud ridadest katkematud jadad. Säilinud põhitekst, pealkiri või teine sektsioon katkestab naaberkirjelt tõendi laenamise. Bibliograafiajätku kuju kontrollitakse ning leheküljevahetuse positiivne näide säilib.

Käivitati **auditi enda varasema vastunäite muutmata katseosa**, ühendatuna v25 külmutatud võrdlusfunktsiooniga. Mõlemad kustutused annavad nüüd **`lost=1`, `left_out_unproven=1`, `reference_entry=0`**: nii samas kui ka teises allikaüksuses. Kasti enesetest kontrollib nüüd konkreetset URL-iga sisurida; tõelise bibliograafiajätku näited, sh üle lehekülje, läbivad. [Sõltumatu tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-checker-adversarial-result.json).

Seejärel rakendati **muutmata võrdlusfunktsiooni kõigile 5999 v22/v25 salvestatud dokumendile**: kaotatud/kontrollimata/tõendamata ridu **0**, võtmekollisioone ja tekstivastavuse vigu **0**. Läbisid **31 dokumendi 42 nimelist väidet**. Võrdluse nulli toetab seekord ka eraldi täpsete allikakohtade võrdlus: **0 eemaldatud keharida, 18 lisatud keharida**. [Kogu kontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-checker-stored-result.json).

Kõik **102 uut käsitsi märgendatud väljajätuteksti** loeti läbi; märgendusi on kokku **652**. Eelmise 550 märgenduse visuaalset kontrolli tervikuna ei korratud. Täiendavad read on valdavalt bibliograafiakirjete osad, leheküljenumbrid ja artikli enda ilmumis-/kokkuvõtteviited. Märgendus ei muuda tekstita algoritmiskeemi kaetuks. Katvuskontroll jääb heuristiliseks koos käsitsi tehtud eranditega; R03 vastunäidete sulgemine ei tõenda iga võimaliku tulevase sisendi semantilist veatust.

### Taastatud sisu ja visuaalne kontroll

Kõigi **10 uue või muutunud tüki täistekst** vaadati läbi. Taastunud on NICE juhendi selgitus, stressi/depressiooni seose joonealune, „It's the economy…” selgitus, heaoluteooria analüüsi piirang, võlakirjade märkus, projektikirjelduse jätk ning perelepituse kontaktlause. Õiguskantsleri viite kahe rea lisamine säilitab sama tüki varasema ERR-i viite alguse. [Kõik muutunud tükid ja read](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-exact-delta.json).

Originaali vastu vaadati visuaalselt **4 lehte**: `21befccedd49` **PDF lk 5 / trükitud 69**, `ce24387c990f` **lk 7 / trükitud 21**, `177d1309b8fb` **lk 7 / trükitud 31**, `8460d3c89cbd` **lk 7 / trükitud 37**. Esimesed kaks kinnitavad terviklike selgitavate joonealuste taastamist; viimased kaks täpsustavad allpool toodud väiksemaid piiranguid. Poppler andis ühe fondikaalu hoiatuse, kuid lehed renderdusid ja kontrollitav tekst oli loetav.

Kontrolli `bibliography_added=1` tähistab selles jooksus **NICE selgitust**, mille `(2009)` sobib kontrolli bibliograafiamustriga. Lehepilt kinnitab, et see on õigesti säilitatud selgitus. Seda automaatset loendurit ei tohi samastada ühe tõestatud uue bibliograafialekkega; tegelik uus viitekirje on eraldi L05.

### Võib hiljem

**Varasemad L01–L04 jäävad piiranguteks:** kolm keeruka paigutusega lehte, PDF-i pildikihi algoritm, osa bibliograafiat/prefikseid ja harjutusemalli silt. Neid ei esitata v25 parandustena. Nende hilisem parandamine võib vajada mõjutatud tükkide uusi embeddinguid; see ei nõua iseenesest kogu korpuse vektorite uuesti ostmist. Järgnevad P3 leiud ei ole eraldi koguvaliku ostublokeerijad.

#### L05 — P3: selgitava joonealuse reegel laseb otsingusse ka ühe õigusakti viitekirje

**Koht:** [chunking.js:74](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:74), `[notes]` erand real 150 ja `referenceSpans` real 224. **Dokument:** `document_8460d3c89cbdc7df1f033f297a3c185f73cf6f1f6d25e2c1202aeae75a7acee8`, „Koduteenuse korraldamise probleeme kohalikes omavalitsustes”, **PDF lk 7 / trükitud 37**. Uue tüki kogu keha on `5 Vabariigi Valitsuse 2011. aasta 22. detsembri määrus nr 180 „Hea õigusloome ja normitehnika eeskiri”.` See on allikaviide; originaalis on sama määrus ka bibliograafias.

**Kordamine:** `v25-inspect.mjs 8460d3c89cbd:7`; [v22/v25 tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-inspect-8460d3c89cbd.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-8460d3c89cbd-p7.png). V22-s eraldi otsingutükki polnud. **Soovitus:** kui bibliograafia väljajätt jääb tootenõudeks, eristada nimetatud õigusakti viide selgitusest ka ilma sulgudes aastaarvu või URL-ita. Lisada see negatiivne näide koos NICE positiivse näitega. See on üks piiratud müraallikas, mitte sisukadu ega põhjendus kogu parser uuesti teha.

#### L06 — P3: seitse taastatud joonealusetükki kannavad viiteloendi prefiksit

**Koht:** [chunking.js:150](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:150) säilitab märkused loendi sektsioonis, prefiksi koostab [chunking.js:312](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:312). Näiteks `document_981a22ee03cbe97fe2055add0493fd903d020ea8cba86a4334b9dc495af8a8d7`, **PDF lk 5**, selgitab stressi ja depressiooni seost, kuid algab `Miks on keelatud lapse kehaline karistamine? > Viidatud allikad`. NICE näitel on sama olukord. Viiteloendinimega tükke **31 → 38**; seitse uut on säilitatud joonealused.

**Kordamine:** vaadata `v25-exact-delta.json.new_chunks` või `v25-reference-chunks.txt`. **Soovitus:** hilisemas struktuuritäpsustuses anda selgitustele tõendatud joonealuse roll või neutraalne dokumendi kontekst. Tekst on praegu terviklik; prefiksi semantiline ebatäpsus on väike ja Opuse raportis juba avaldatud. Prefiksi muutmine pärast ostu nõuab nende sisendite uusi embeddinguid.

#### L07 — P3: kuupäev joonealuse lõpus eemaldatakse leheküljenumbrina

**Dokument:** `document_177d1309b8fbaa88ff38e325c4d6d50969c5af4545f0d31f478adee204399d7f`, **PDF lk 7 / trükitud 31**. ERR-i artikliviite järgmise rea **`16.04.2025.`** leiab `report.transformations` seast põhjusega **`page_mark`**. See on viite ilmumiskuupäev, mitte leheküljenumber. Otsingutekst lõpeb eelmise rea komaga. Sama eemaldus on nii v22-s kui ka v25-s; see ei ole v25 joonealuse paranduse tekitatud regressioon.

**Kordamine:** `v25-inspect.mjs 177d1309b8fb:7`, kontrollida mõlema versiooni `transformations` ja võrrelda [originaallehega](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-177d1309b8fb-p7.png). [Read ja eemalduspõhjus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-inspect-177d1309b8fb.json). **Soovitus:** leheküljenumbri reegel peab eristama täielikku kuupäeva, arvestama jätkuva joonealuse paigutust ning testima kuupäeva säilimist. Mõju on siin viite täielikkusele; artikli põhisisu ei kao.

GraphRAG-i täiendavad seosed ja filtreerimisväljad võivad lisanduda hiljem ilma tekstivektoreid muutmata, kui `retrieval_text` ja embeddingukonfiguratsioon säilivad. XML/JSON-i kehtivus- ja `record_key`-rada selles versioonis ei muutunud. Allikate tänast juriidilist kehtivust, õigusi ega väliseid URL-e ei kinnitatud võrgukeelu tõttu uuesti.

### Mõõdikud ja kordamine

| Kontroll | Tulemus | Tõend |
|---|---|---|
| Kohalikud testid | **242 PASS**, 0 FAIL, 0 SKIP; **32 faili**, **20,669 s**, `TZ=UTC` | [logi](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-unit-tests-verified.txt), [valik](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-test-summary-verified.json) |
| Kogu store'i tekstiviilud | **5999 dokumenti / 631 861 span'i / 0 viga**, **40,991 s** | [store-kontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-store-check.json) |
| Täpne keharidade võrdlus | **0 eemaldatud / 18 lisatud**, **0 allikaüksuste raw_text muutust**, **34,411 s** | [täpne võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-exact-delta.json) |
| Parandatud katvuskontroll kõigil v22/v25 bundle'itel | **0 lost / 0 unverified / 0 left_out_unproven**, **31 dokumenti / 42 nimelist väidet**; **177,634 s** | [tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-checker-stored-result.json) |
| Värske parsimine | **37/37 PDF-i**, sh kõik kümme muutunud dokumenti; allikaüksused, span'id, plokid, sektsioonid, tükid kattusid; **45,161 s** | [tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-reparse-result.json) |
| Ostuplaani arvutus | **5997 / 29 354 / 14 923 234**, täpne võrdsus külmutatud plaaniga, **0 korduskasutatavat sisendit**, **162,037 s**, 0 võrgukutset | [tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v25-plan-result.json) |

**Auditi mõõtmismeetodi täpsustus:** vanem `v22-store-check.mjs` ja sellest tuletatud `v25-store-check.mjs` kasutavad `new_uncovered` jaoks võtit `(source_unit_index, source_text)`. Kui samas allikaüksuses kordub identne tekst, võib viimane samanimeline span varasema üle kirjutada. V25 selle välja **14 kandidaati** on niisugused muutumatute dokumentide pealkirjaread, mitte 14 sisukadu. Järeldus põhineb uuel `v25-exact-delta.mjs` kontrollil, mille võti sisaldab ka **`start/end`**. Samal põhjusel ei olnud v22 raporti vana 527 kandidaadi arv offset-täpne mõõdik; varasemad päris sisukaoleiud ja nende kordused sellest ei sõltunud. Ka `structure_changes=5999` loeb versioonist muutunud ID-sid, mitte 5999 raw_text muutust.

Käsud töökaustast. `wx`-tulemusfailide kordusjooksuks kasutada auditikaustas uut väljundnime. Võrgu ja kirjutamise piirangud seab `offline-guard.mjs`; tulemused kirjutatakse ainult auditikausta.

```powershell
node tmp/rag-v2-freeze-v25-2026-09-26/verify.mjs
node tmp/codex-audit/v25-run-tests.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v25-store-check.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/codex-audit/v25-exact-delta.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v25-checker-stored.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v25-checker-adversarial.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v25-reparse.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v25-plan.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/codex-audit/v25-verify-end.mjs
```

Opuse kolme baasi kõigi originaalide värske parsimise täisjookse ei korratud; kasutati kogu v22/v25 store'i ning 37 originaali kordusparsimist. Teenuseid vajavad **7 unit-testifaili ja 10 integratsioonitestifaili** on **NOT_RUN**, nagu ka päris embeddingud, kogu vektorindeks ja tootmisruntime. Kohalik testiedu ei tõenda vastuste semantilist kvaliteeti. Kõigi lehtede visuaalset kontrolli selles ringis ei tehtud.

Omaniku otsuseks kontrollitud plaani identiteet:

```text
egress_manifest_sha256 = 17d3ffa5e910274628dd3cb6a894a5b1b9a32dfcdd71bc8f7960bdd1dc64af0a
source_generation_id = generation_18f457dc897072dc2f9ac01c8dde56b485185d932e72dad85698dec58a4b03d2
corpus_snapshot_sha256 = d83a84105f330ef4af778595db142f2bb21ed5b16fb88526715cfe7e918a5117
```

---

## Ajalooline järelkontroll: külmutatud v22 sõltumatu kontroll

**R01 ja R02 konkreetsed sisukaod on parandatud. R03 katvuskontroll on oluliselt parem, kuid veel mitte korras: sõltumatu kustutuskatse annab ekslikult „kadu 0”.** V22 47 muutunud dokumendi ülevaatuses ei kinnitunud uut samalaadset kommentaari või infokasti kadu. Soovitan enne ostu parandada allpool kirjeldatud kontrolliviga ja rakendada parandatud kontrolli olemasolevale v22 väljundile. See ei nõua iseenesest parseri muutmist, uut korpuse ettevalmistust ega uut normaliseerimisversiooni. Uut ettevalmistust on vaja ainult siis, kui kontroll leiab parandamist vajava otsinguteksti.

Läbis **241 kohalikku testi**. Kõigi **5999 dokumendi 631 861 span'i** tekst vastab allikaüksuse täpsele viilule. **63 originaalfaili** parsiti uuesti; allikaüksused, span'id, plokid, sektsioonid ja tükid kattusid külmutatud väljundiga. Salvestatud ostuplaani sisu kordus ajaloolise hinnakontrolliajaga täpselt: **5997 dokumenti, 29 345 sisendit, 14 922 435 tokenit, 1,939916550 USD**. **Praeguse ajaga plaan õigesti ei läbi: `price_verification_stale`.** See summa on vana kohaliku hinnakirje alusel arvutatud hinnang, mitte värskelt kontrollitud hind ega ostuluba.

Töö oli kohalik ja lugemiseks; võrgu-, mudeli-, OpenAI-, embeddingu- ega andmebaasikutseid ei tehtud. Koodi, korpust ja metaandmeid ei parandatud. Abifailid on `tmp/codex-audit/`, ainus muudetud mitteajutine fail on see raport. Opuse lisatud vestlust ning [tema raporti §11](C:/Users/rauds/Desktop/Sotsiaal.ee/docs/audits/rag-v2-claude-prepurchase-review-2026-09-25.md:485) käsitleti kontrollitavate väidetena. Vahepealseid store'e ei kustutatud.

### Ulatus, failikaart ja külmutus

- HEAD **`5ab30c02d874a1524074e04c19f09331e2d863c9`**; normaliseerimine **`source-structure-v22`**; tükeldamine **`structure-blocks-v16`**; teostuse sõrmejälg **`d92d9b675ea4a77c57cb61b6593eb2f17605f00facd29ede44bfdf4112bd543a`**.
- Varasema täieliku failikaardi **212 süsteemifaili** räsid kontrolliti. V15 järel muutus **4 faili**: `lib/rag-v2/chunking.js`, `contracts.js`, `processing-implementation.json` ja `tests/rag-v2-source-structure.test.mjs`. Üle vaadati v15 → v22 muudatused, muutunud funktsiooni tervik ning uued testid. Ülejäänud **208 muutumatut faili ei loetud selles järelkontrollis uuesti tervikuna**; algne failide läbivaatuse katvus ja kaart jäävad raporti ajaloolisse ossa. V15-eelsed commit'imata muudatused kuuluvad jätkuvalt auditi ulatusse varasemate kontrollide kaudu.
- `parser.js`, `pdf-layout.js`, `text-source.js`, metaandmeadapter ja normaliseerimise teostus on v15-ga samad. Varem kontrollitud **15 Andmebaasi muudatusfaili** räsid ei muutunud. Uut välist õigusaktide kehtivuse või metaandmete allikatõenduse kontrolli ei tehtud.
- Kogu aktiivne store: **1023 PDF, 43 HTML, 59 XML, 4874 JSON**. Embeddingutekst muutus **46 PDF-is ja ühes HTML-is**; **40** sisendiräsi eemaldus, **41** lisandus. Tükke **29 477 → 29 478**. Kõigi XML/JSON dokumentide ja ülejäänud HTML-ide `retrieval_text`-ide järjestused jäid samaks. Allika- ja metaandmeräside muutusi: **0**.
- Mõlemad külmutuse kontrollid läbisid: **39 külmutatud koodifaili**, plaan **`01ed2dd22cb9…`**, generatsioon **`21f249a7de42…`**. Lõpuinventuuris **0 muutunud süsteemifaili** ja **0 muutunud auditeeritud andmefaili**. Kõigi **12 store'i** ning Andmebaasi failide teed, suurused ja muutmisajad jäid samaks. See inventuur ei ole kõigi store'i failide teine sisuräside arvutus.

Tõendid: [212 faili manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-manifest.json), [muudatusdiff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-delta.diff), [store'ide võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-store-check.json), [lõppkontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-verification.json). Store-võrdluse `structure_changes` võrdleb ka versioonist tuletatud ID-sid: selle välja 5999 kirjet **ei tähenda** 5999 dokumendi allikateksti muutumist.

### Parandada enne embeddinguid

#### R03 jätk — P2: katvuskontroll vabastab kustutatud sisulise lause bibliograafiajätkuna

**Koht:** külmutatud [coverage.mjs:67](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-freeze-v22-2026-09-26/evidence/coverage.mjs:67), väljajäetud ridade jada [coverage.mjs:154](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-freeze-v22-2026-09-26/evidence/coverage.mjs:154) ning liiga nõrk enesetesti tingimus [coverage.mjs:435](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-freeze-v22-2026-09-26/evidence/coverage.mjs:435). See on auditiskripti viga, mitte tõend sama lause tegelikust puudumisest v22 korpuses.

`tail` lubab URL-iga rea bibliograafiaks, kui väljajäetud ridade jadas on kuni kolm rida eespool tugev bibliograafiamärk. Jada moodustamisel eemaldatakse vahepealsed otsingus säilinud read ja pealkirjad; sama allikaüksust, sektsiooni ega viitekirjet ei nõuta. Nii saab teenusekirjeldus laenata tõendi varasemalt bibliograafiarealt isegi teisel lehel. Kommentaar „URL või aasta üksi ei tõenda midagi” ei välista seda valenegatiivset tulemust.

**Korratav vastunäide**, kasutades muutmata `compare`-funktsiooni:

1. Allikas sisaldab bibliograafiakirjet `Tamm, M. (2020). Sotsiaaltöö alused. Tallinn.`, seejärel säilivat lõiku ja sisulist lauset `Abi saab ka ilma saatekirjata. Täpsem teave https://example.invalid/abi.`.
2. Vanas väljundis on kaks viimast rida otsingus; uues jäetakse viimane rida välja. Bibliograafiakirje on mõlemas väljas. Allikatekst ja span'ide täpsed viilud säilivad.
3. Kontroll annab **`lost=0`, `unverified=0`, `left_out_unproven=0`, `reference_entry=1`**. Oodatav on vähemalt üks tuvastatud sisukadu. Sama tulemus kordub, kui kustutatud lause on **teises allikaüksuses / teisel lehel**. Võtmekollisioone ja viiluvigu on mõlemas katses 0.

Olemasolev `boxed` enesetest sisaldab infokasti pealkirja ja URL-iga sisulist rida, kuid nõuab ainult **ühe** rea märkimist tõendamata väljajätuks. Pealkiri täidab nõude, kuigi sisuline URL-rida saab ekslikult vabastuse. Kõik kuus olemasolevat enesetesti läbivad ka selle puudusega.

**Kordamine:** `v22-checker-adversarial.mjs` allpool toodud võrguvaba käsuga. [Kahe katse tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-checker-adversarial-result.json), [lisatud katseosa](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-checker-adversarial-footer.txt). Näite URL-i ei avata.

**Soovitus:** siduda bibliograafiajätku tõend tegeliku viitekirje ja katkematu allikajärjestusega; säilinud põhitekst, uus sektsioon või infokast peab katkestama automaatse naabrusvabastuse. Leheküljevahetust võib lubada tõendatud sama kirje jätkule, mitte üldiselt. Ebaselge URL-iga proosa vajab sisupiirkonna tõendit või täpset käsitsi märgendust. Test peab kontrollima **konkreetse sisulise rea** tuvastamist, mitte ainult koguarvu `>=1`. Seejärel kontrollida olemasolevat v22 store'i uuesti. Kood ja embeddingusisendid võivad jääda külmutatuks, kuni kontrolli tulemus annab põhjuse neid muuta.

#### Ostu eeltingimus: aegunud hinnatõend ja täpne omaniku otsus

**Koht:** [pilot-manifest.js:41](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-manifest.js:41). Tavaline kohaliku plaani kordusarvutus peatub õigesti veaga **`price_verification_stale`**. Hinnakirje kontrolliaeg on **2026-09-25 09:28:36.050 UTC** ja 24 tunni piir möödus **2026-09-26 09:28:36.050 UTC**. See on toimiv kaitse, mitte koodiviga.

Plaanisisu korduvuse eraldi tõendamiseks kasutati **ainult auditiprotsessis** `Date.now` ajaloolist väärtust `2026-09-25T10:28:36.050Z`; salvestatud hinnakirjet, plaani ega ostuväravat ei muudetud. Tulemus **ei uuenda hinna kehtivust ega anna ostuluba**. Võrgukeelu tõttu uut hinnakontrolli ei tehtud.

**Kordamine:** `v22-plan.mjs` annab praeguse ajaga aegumisvea; `v22-plan-historical.mjs` kordab vana plaani arvutust. **Järgmine samm:** eraldi lubatud hinnakontroll, seejärel täpne plaan koos kulupiiriga omaniku otsuseks. Audit ega Opuse vestlus ei asenda seda otsust.

### R01/R02 paranduste ja regressiooninäidete tulemus

Kontroll ei piirdunud märksõnade leidmisega. V14 kehast v15-s kadunud read seoti allikaüksuse, täpsete offset'ide ja teksti järgi v22-ga; viis veadokumenti olid ka 63 värskelt parsitud faili hulgas.

| Varem vigane piirkond | V22 tulemus |
|---|---|
| R01: `5cb965d1588e`, „Personaalne peegeldus…”, PDF lk 6 | Kõik **31** v15-s kadunud keharida on tagasi, sh kommentaari/autoriploki **27** rida. Tagasi tulid ka neli viiteosa rida; seda bibliograafialeket ei loeta sisukao paranduse puudumiseks. |
| R01: `7b7b24bf7e22`, kiusamisennetuse infokast, PDF lk 4 | Kõik **26** kadunud rida tagasi, sealhulgas organisatsioonide ja programmide kirjeldused. |
| R01: `ec0a5012083b`, „Koos kainema ja tervema Eesti poole”, PDF lk 4 | Kõik **13** infokasti sisurida tagasi. Ainus taastamata v14 rida on eelmise bibliograafiakirje `index. html (26. 04. 2017).`. |
| R02: `737dd8ceacaf`, Ukraina majutuste artikkel, PDF lk 8 | Joonealuse algus aastatega **2022 ja 2023** on tagasi koos selgituse jätkuga. Teine muutunud rida on pealkiri, mis jõuab prefiksisse. |
| R02: `d02ca2954a66`, tervisealane kirjaoskus, PDF lk 8 | Mõlemad kadunud EKI definitsiooni algusread tagasi; selgitus on terviklik. |

[Kõigi kontrollitud ridade tulemus koos dokumentide täis-ID-dega](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-restored-result.json). Lisaks läbivad Opuse **23 dokumendi 32 nimelist väidet**, sh V01, N01–N03, M01–M04 ning v19–v22 bibliograafiajuhtumid. Need ei ole 23 dokumendi täieliku sisulise veatuse tõend. R03 eelmise baasi probleem on lahendatud Opuse v15/v14/v13 võrdlustega; siin korrati sõltumatult kogu **v15 → v22** salvestatud väljundi võrdlust. [Kontrollitulemused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-checker-stored-result.json).

### Võib hiljem

#### L03 — P2 ulatuspiirang: pildikihis olev sisuline skeem ei kuulu tekstikatvuse nulltulemusse

**Dokument:** `document_7cc0fc2ff30ac553bfcec91f6bce0b3983e643ca765976d094a75c722ab793ea`, „Hoolekandeasutuste tegevusjuhis COVID-19 tingimustes”, **PDF lk 9**. Visuaalselt sisaldab leht juhendi sisulist otsustuspuud. Parseri allikatekstis on ainult `LISA 1. ALGORITM`; skeemi pildikihis olevad laused puuduvad juba v15-s. V22-s jääb välja ka üksik lisa pealkiri. Seega ei tähenda käsitsi märgenduse „figure itself has no text” siin sisutühja lehte: **skeemil puudub eraldatud tekstikiht**.

**Kordamine:** `v22-inspect.mjs 7cc0fc2ff30a:9`, võrrelda [ühe span'iga tulemust](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-inspect-7cc0fc2ff30a.json) [originaallehepildiga](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-7cc0fc2ff30a-p9.png). **Soovitus:** märkida pildisisu eraldi katmata piirkonnaks; hilisem kohalik OCR peab säilitama skeemi harude seosed ja allikakohad. See on olemasolev OCR-i/katvuse piirang, mitte uus tõend v22 põhiteksti kadumisest. Olemasolevaid tekstivektoreid saab kasutada selle piiranguga, kuid dokumenti ei saa kirjeldada täielikult tekstina kaetuna. OCR-ist tekkivad uued sisendid vajavad hiljem embeddinguid.

#### L01 — P3: piiratud bibliograafialekked ja valed viiteloendiprefiksid jäävad

**Näited:** `8abc74aaefe9`, „Erivajaduste alase teadlikkuse tõstmine”, **PDF lk 40–41**: `Kasutatud kirjandus` prefiksis on Bausteini kirje ja sellele järgnev tagasisideküsimustik; `ab83d550824d`, „Evakuatsioonijuhi koolitusmaterjal”, **lk 33–34**: kaks kirjet ning Päästeameti kontaktiplokk; `23d54051c62f`, „Tuleohutuskonsultandi koolitusmaterjal”, **lk 163**: semikoolonitega viiteloend jääb otsingusse. Need on v15-st säilinud piirangud. R01 kommentaari taastamisega naasid ka selle enda viiteosad.

Kokku on **31 viiteloendinimega tüki prefiksit**. Kõik 31 vaadati tekstina läbi: hulgas on õigesti säilinud selgitavaid joonealuseid, märksõnu ja sisulist teksti; arv **ei võrdu 31 bibliograafialekkega**. **Kordamine:** `v22-store-check.mjs` → [31 tüki täistekst ja täis-ID-d](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-reference-chunks.txt). **Soovitus:** parandada kirje/sektsiooni piiri kohaliku struktuuri põhjal ning testida, et kontaktid ja küsimustik säilivad. Hilisem parandus muudab mõjutatud tükkide teksti või prefiksit ning nõuab nende uut embeddingut.

#### L02 — P3: keeruka paigutuse kolm teadaolevat lehte ei ole korras

Originaallehepildi, v15/v22 ridade ning tükkide võrdlus kinnitab, et probleem on juba v15-s ja ei tekkinud v22 bibliograafiamuudatusega:

| Dokument | Koht ja probleem | Tõend |
|---|---|---|
| `3b88021ef1e0`, „Ülimitmekesisus…” | **PDF lk 5 / trükitud 97**: kahe veeru segunemine, päris vahepealkiri „Lõpetuseks” sulandub lugemisjärjekorda | [read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-inspect-3b88021ef1e0.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-3b88021ef1e0-p5.png) |
| `ec88c3c372b8`, „Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?” | **PDF lk 4 / trükitud 85**: proosa, avalikustamise poolt/vastu tabel ja selle pealkiri segunevad | [read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-inspect-ec88c3c372b8.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-ec88c3c372b8-p4.png) |
| `5febcffd1f8f`, „Lapse osalemise põhimõtted” | **PDF lk 1**: mitme paneeliga plakati pealkirjade ja teksti järjekord | [read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-inspect-5febcffd1f8f.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-5febcffd1f8f-p1.png) |

**Kordamine:** `v22-inspect.mjs <ID-algus>:<PDF-leht>` ning originaallehe renderdus. **Soovitus:** käsitleda tabelit/kasti/plakatipaneeli kohaliku piirkonnana ja kontrollida järjestust visuaalselt. Kahe päris pealkirja käsitsi lubatud kadu ei tohi nimetada parandatud pealkirjaks. Neid piirkondi saab parandada hiljem koos mõjutatud tükkide uue embeddinguga; katvuskontrolli null ei tõenda nende kvaliteeti. Varasemad raporti slaidi- ja harjutuslehtede piirangud jäävad samuti alles.

#### L04 — P3: üldine jooksva päise erand peidab ühe harjutusemalli sildi kao

**Dokument:** `document_b2078456e0e73ee238605d5c41848e871ea6bbd83cd7606b7231117361a8b976`, „Harjutuste kogu”, **PDF lk 12**. V15-s otsingus olnud `Harjutus 0.0` on v22-st väljas; kontroll vabastab selle korduva servapäisena (`running_head_in_list`). Visuaalselt on see täidetava **harjutusemalli** silt. Malli nimi ja juhised jäävad alles; see ei ole terve harjutuse või infokasti kadu.

**Kordamine:** `v22-inspect.mjs b2078456e0e7:11,12`, [võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-inspect-b2078456e0e7.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-b2078456e0e7-p12.png). **Soovitus:** korduva servateksti vabastus peab eristama malli osa ja lehekülje kujunduspäist. Praeguse piiratud mõju tõttu ei ole see eraldi koguvaliku ostublokeerija.

GraphRAG-i struktureeritud rikastamine (väljaandja ja omavalitsuse stabiilsed ID-d, teenuse liik, sihtrühm, ajaloo- ja kehtivusseosed, õiguste päritolu) võib jätkuda olemasolevaid vektoreid muutmata, **kui need väljad ei muudeta `retrieval_text`-i osaks**. Sama kehtib sõnalise järjestuse ja indeksilahenduse parandamise kohta. Pealkirja, sektsiooniprefiksi, teksti puhastamise, allikateksti, tüki piiri, mudeli või mõõtmete muutmine võib nõuda uusi sisendeid; versioonisildi tõstmine üksi ei asenda sisendite võrdlust. Korduskasutus peab lähtuma täpsest sisendist ja embeddingukonfiguratsioonist. Praegune ostuplaan leiab **0 korduskasutatavat vektorit**.

### Mõõdikud, kordamine ja tõendite piirid

| Mõõtmine | Sõltumatu tulemus | Tõend |
|---|---|---|
| Kohalikud unit-testid | **241 PASS**, 0 FAIL, 0 SKIP; **32 faili**, `TZ=UTC`, **16,666 s** | [testilogi](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-unit-tests-verified.txt), [testivalik ja piirangud](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-test-summary-verified.json) |
| Kõik aktiivsed dokumendid | **5999**, **631 861** täpset `source_text === raw_text.slice(start,end)` vastavust, **0** viiluviga; **37,509 s** | [store-võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-store-check.json) |
| V15 → v22 vana reavõrdluse väljajätukandidaadid | **527**: 18 pealkirjarida, 182 loendirida, 327 lõigurida; kõik loetletud tekstid vaadati läbi, arv sisaldab õigeid bibliograafiaeemaldusi ja korduva teksti tõttu võimalikke valekandidaate; vt v25 meetoditäpsustus | [kõik read](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-new-uncovered.txt) |
| Opuse muutmata võrdlusfunktsioon kogu v15/v22 store'il | **513** keharida puudu, 4 nüüd prefiksis, 391 bibliograafiana vabastatud, 116 käsitsi lubatud, 2 korduva servapäisena lubatud; **148** uut keharida; raporteeritud `lost=0`, **13 132** väljajäetud rida; **174,746 s** | [tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-checker-stored-result.json); R03 jätku tõttu ei võrdu null sõltumatu sisukaotuse puudumise tõendiga |
| Värske parse → normalize | **63/63**: **62 PDF + 1 HTML**, kõik 47 muutunud dokumenti ning regressiooni- ja riskinäited; viie struktuuriosa räsid kattusid; **64,83 s** | [kordusparsimine](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-reparse-result.json) |
| Eraldi kordusdeterminism | Üks PDF (`cd75f00c8fc8`) parsiti samas kontrollis lisaks teist korda; väljund kattus | Sama tulemuse `repeat_deterministic=true`; ei tähenda kogu korpuse kahekordset parsimist |
| Bibliograafia/pealkirjade käsitsi märgendused | Opuse **550 väljajätumärgendust ja 19 pealkirjamärgendust** loeti; eraldi visuaalselt kontrolliti **7 riskilehte** | [külmutatud märgendused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-freeze-v22-2026-09-26/evidence/reviewed-exclusions.json), [pealkirjamärgendused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-freeze-v22-2026-09-26/evidence/reviewed-headings.json) |
| Ostuplaani ajalooline kordusarvutus | **5997 / 29 345 / 14 922 435**, täpne plaanivõrdsus, **148,365 s**, **0 võrgukutset** | [ajalooline kordus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v22-plan-historical-result.json); praegune hinnatõend aegunud |

**527 ja 513 on eri meetodite arvud:** esimene kasutab allikaüksuse ja teksti järgi võtit, mis korduva teksti puhul pole üheselt täpne (täpsustatud v25 auditis); teine kasutab kontrolliskripti normaliseeritud rea-/sõnataseme võrdlust ja vabastusi. Need ei ole kaks erinevat väidet sisukadude arvu kohta. Kõik märgendustekstid läbi lugeda ei võrdu 550 rea kõigi originaallehtede sõltumatu visuaalse auditiga. Seitsme värskelt renderdatud lehe hulgas kontrolliti lisaks ülaltoodutele `cd75f00c8fc8` lk 45 bibliograafiat ning `af28542403c2` lk 6 loendijärgseid projekti- ja ETIS/ELU viiteid; viimased jäävad välja juba v15-s.

Käivitused töökaustast. Kõik väljundid jäävad auditikausta. `wx`-kirjutusega tulemuste kordamiseks teha auditikausta uus abiskripti koopia ja muuta ainult tulemusfaili nimi, et säilitada algsed tõendid. Kontrolliskripti auditikoopia kasutab külmutatud v22 teostust; selle võrdlusfunktsiooni ei muudetud.

```powershell
node tmp/rag-v2-freeze-v22-2026-09-26/verify.mjs
node tmp/codex-audit/v22-run-tests.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v22-store-check.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v22-reparse.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v22-checker-stored.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v22-checker-adversarial.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/codex-audit/v22-restored.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/codex-audit/v22-inspect.mjs 7cc0fc2ff30a:9
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v22-plan.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v22-plan-historical.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/codex-audit/v22-verify-end.mjs
```

Opuse kõigi 5999 originaali värske parsimise kolme täisjooksu ei korratud; sõltumatu kontroll kasutas kõiki v15/v22 salvestatud dokumente ja 63 originaalfaili kordusparsimist. Teenuseid vajavad **7 unit-testifaili ja 10 integratsioonitestifaili** on **NOT_RUN**. Mudelipõhine semantiline hindamine, tegelikud embeddingud, täismahus vektorindeks ja tootmisruntime on **NOT_RUN**. PDF-i bbox'ide visuaalset täpsust ei hinnatud kõigil lehtedel; täpne tekstiviil ei tõenda lugemisjärjekorda, pealkirja õigsust ega pildikihi katvust.

Külmutatud ostuplaani identiteet:

```text
egress_manifest_sha256 = 01ed2dd22cb95cefed5bb48a003dbe11abdfce80106fb0c5ac7a3ac1f39d7454
source_generation_id = generation_21f249a7de4218ca22ad20592fb59c05f09bb1a87a879bd875c0d032a4839c2e
corpus_snapshot_sha256 = d3852b79fdaaa663ae6353e0f9ea0d1f3a593b2d29ae1975e3a8086b98b713cb
```

**Otsus:** sisukaoleiud R01/R02 võib sulgeda; R03 jääb ülaltoodud kitsas kontrolliloogika osas avatuks. Kõigi ingest-reeglite järjekordne ümbertegemine ei ole selle leiu lahendamise nõue. Enne ostu tuleb saada usaldatav tulemus parandatud katvuskontrollist, värskendada hinnatõend ning kinnitada konkreetne plaan ja kulupiir omaniku otsusega. Hilisemate paigutus-/OCR-paranduste mõjutatud sisendite uuesti embeddimise võimalus jääb teadaolevaks piiranguks.

---

## Ajalooline järelkontroll: v15 paranduste sõltumatu kontroll

**V15 kogu praegust valikut ei soovita veel embeddinguostuks kinnitada.** M01–M05 konkreetsed vastunäited on parandatud, kuid viiteloendi piiri karmistamine eemaldab uuesti sisulise kommentaari ja kaks infokasti. Viiteloendi rolli säilitamine eemaldab kahes teises artiklis joonealuse selgituse alguse. Katvuskontrolli nulltulemus ei välista kumbagi: v13 võrdlusbaasis puudus osa taastatud sisu juba varem ning aastaarvu/URL-i sisaldav selgitus loetakse kontrollis bibliograafiaks. Allpool on kolm P2 leidu R01–R03.

Läbis **238 kohalikku testi**. Kõigi **5999 aktiivse dokumendi 631 861 span'i** tekst vastas täpselt allikaüksuse viilule. **23 dokumenti** parsiti originaalbaitidest uuesti ning kõigil kattusid store'iga allikaüksused, span'id, plokid, sektsioonid ja tükid. Ostuplaan kordus täpselt: **5997 dokumenti, 29 344 sisendit, 14 931 591 tokenit**, kohaliku hinnakirje järgi **1,941106830 USD**. Need on tehnilise korduvuse tõendid; need ei tõenda kogu sisulise teksti jõudmist otsingusse.

Töö toimus kohapeal, võrgu-, mudeli-, OpenAI-, embeddingu- ja andmebaasikutseteta. Koodi, metaandmeid ega korpust ei muudetud. Ainus muudetud mitteajutine fail on see raport; abifailid on `tmp/codex-audit/`. Opuse vestlust ja [tema raporti §10](C:/Users/rauds/Desktop/Sotsiaal.ee/docs/audits/rag-v2-claude-prepurchase-review-2026-09-25.md:405) käsitleti kontrollitavate väidetena, mitte ostu- või muutmisloana.

### Ulatus ja külmutuse kontroll

- HEAD **`5ab30c02d874a1524074e04c19f09331e2d863c9`**; normaliseerimine **`source-structure-v15`**; tükeldamine **`structure-blocks-v9`**; teostuse sõrmejälg **`2cf99a60ceada4807b139581ac4b26d70c798d6bcdd969de7f968209e3e7b6d6`**.
- Varasema täieliku failikaardi **212 süsteemifaili** räsid kontrolliti. V14 järel muutus **7 faili**: `chunking.js`, `contracts.js`, `parser.js`, `pdf-layout.js`, `processing-implementation.json`, `types.d.ts`, `rag-v2-source-structure.test.mjs`. Läbi loeti kogu **397-realine v14 → v15 diff**, vajalik ümbritsev kood, uus katvuskontroll, pealkirjade märgendused ja kastide käsitsi ülevaatuse tulemused. Muutumatuid 205 faili ei loetud selles järelkontrollis uuesti tervikuna.
- Kogu store'i võrdlus tehti **v14 → v15**, mitte ainult Opuse kasutatud v13 lähtepunktiga. Muutus **94 PDF-i** embeddingutekst; eemaldus **338** vana sisendiräsi ja lisandus **324** uut. Kõigi 5999 dokumendi tükiarv vähenes **29 491 → 29 477**. Ostuplaanist jääb endiselt välja kaks dokumenti.
- Formaadid store'is: **1023 PDF, 43 HTML, 59 XML, 4874 JSON**. Kõigi mitte-PDF dokumentide `retrieval_text`-ide järjestused jäid v14-ga samaks. Allikafaili- ja metaandmeräsides oli **0 muutust**. Mitte-PDF täisraja sihtkontrollis kasutati üht päris HTML-i ning ühe kirjega viiteloendi sünteetilist HTML-i.
- Külmutuse kontroll läbis alguses ja lõpus: **39 koodifaili**, plaan **`6a371ab54aba…`**, generatsioon **`2d6618a962ad…`**. Lõpuinventuur: **0 muutunud süsteemiräsi**, **0 muutunud auditeeritud andmefaili**. Viies store'is oli vastavalt **7136 / 48 034 / 48 001 / 48 001 / 48 001** faili, Andmebaasis **2531**; teed, suurused ja muutmisajad jäid samaks. Store'i inventuur ei ole kõigi sealsete failide teine sisuräsiarvutus.

Tõendid: [manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-manifest.json), [täielik muudatusdiff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-delta.diff), [kogu store'i võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-store-check.json), [lõppkontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-verification.json).

### Parandada enne embeddinguid

#### R01 — P2: uus viiteloendi lõpukontroll eemaldab taastatud kommentaari ja infokastid

**Koht:** [chunking.js:48](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:48), tingimus real 49. Kontrolli järgmised kümme rida algavad indeksist `j`, s.o **pärast kogu mitteviitelaadset tekstijada**, mitte järgmise sisupiirkonna algusest. Ka pika sisulise kommentaari lõpus asuv allikaviide või teenusekirjelduse URL võib seetõttu takistada viiteloendi lõpetamist enne seda kommentaari/teenusekirjeldust.

Originaal-PDF, v14/v15 salvestatud tükid ning värske v15 parsimine kinnitavad järgmisi juhtumeid:

| Dokument ja täpne koht | V15-st kadunud sisu | Võrdlustõend |
|---|---|---|
| **`document_5cb965d1588ea1560e195d46712698b989d8cc20f1a2fae8cd32b7bc8699332f`**, „Personaalne peegeldus taastava õiguse võimalustele kinnipidamisasutustes”, **PDF lk 6 / trükitud 30**. Allikas `ajakiri_sotsiaaltoo/20-4/Sotsiaaltoo_4_2020_web_link_Part7.pdf`. | Stanislav Solodovi **KOMMENTAAR**, algusega „Soovin öelda Jaanus Kangurile tänusõnad…”, sealhulgas vanglate sisekliima, kuulamise ja dialoogi käsitlus. Pildil on eraldi raamitud kommentaar koos autori foto ja nimega. | V14 kehast kaob 31 rida: 27 kommentaari/autoriploki rida ja 4 bibliograafiarida. Dokumendi tükke **12 → 10**. [Read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-5cb965d1588e.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-5cb965d1588e-p6.png). |
| **`document_7b7b24bf7e229b533f40f000a241316df0dd41ae08d185787d8073185dd0650b`**, „Tõenduspõhine kiusamise ennetamine koolides – milleks ja kuidas?”, **PDF lk 4 / trükitud 57**. Allikas `ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part14.pdf`. | Sinise infokasti **„Liikumisega „Kiusamisvaba haridustee eest” liitunud organisatsioonid”** kirjeldused: organisatsioonid, KiVa, TORE, VEPA, Vaikuseminutid jt programmid ja nende sihtrühmad. URL-ide esinemine ei muuda neid bibliograafiaks. | Kehast kaob **26 sisulist rida**; ka infokasti pealkiri ei jõua enam otsinguprefiksisse. Tükke **8 → 7**. [Read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-7b7b24bf7e22.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-7b7b24bf7e22-p4.png). |
| **`document_ec0a5012083b4dd6caee49330e2a4861b20c1dd93f601f91d73a9c97271ab153`**, „Koos kainema ja tervema Eesti poole”, **PDF lk 4 / trükitud 64**. Allikas `ajakiri_sotsiaaltoo/17-2/Sotsiaaltoo_2-2017_veebi_link_Part19.pdf`. | Hall infokast: programmi teenuse osutamine viies haiglas, teenuse sihtrühma kirjeldus ja haiglate kontaktread. See on 2017. aasta allikasisu, mitte tänaste teenusetingimuste kinnitus. | Kehast kaob **14 rida**, neist 13 infokasti sisu ja üks eelmise bibliograafiakirje lõpp. Lehekülge katvaid tükke **3 → 2**. [Read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-ec0a5012083b.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-ec0a5012083b-p4.png). |

Sama muutust saab eraldada PDF-parseri teistest muudatustest: anda **üks ja sama v13 struktuur** v14 ja v15 `referenceExtents`-ile. Esimeses dokumendis nihkub loendi lõpp **33 → 64**, teises **13 → 41**, kolmanda dokumendi vastavas loendis **10 → 24**. Kommentaari juures on mitteviitelaadne jada **28 rida / 2282 märki**, kuid kolm lõpuviiterida blokeerivad piiri. Haiglate kastis piisab ühest järgnevast veebiaadressist: `next = 1`, lävend `1`, range `<` tingimus ei täitu. See tõendab v15 uue tingimuse mõju sama sisendi peal.

**Kordamine:** käivitada `v15-checker-store.mjs`, `v15-reference-evidence.mjs` ja `v15-reparse-findings.mjs` allpool näidatud võrguvaba käsuvormiga. Esimene võrdleb store'e ning mõlema teostuse piire; teine salvestab `k`, `j`, märgiarvu ja lävendid; kolmas kordab värske parse–normalize raja. [Piiriarvutuse tõend](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-reference-evidence.json).

**Soovitus:** tuvastada bibliograafia lõpp ja järgmine sisupiirkond koos kohaliku paigutuse ning tervikliku viitekirjega. Viide või URL järgmise sisupiirkonna sees ei tohi seda piirkonda tagasi bibliograafiaks muuta. Pelk lisalävendi eemaldamine taastaks M02 bibliograafialekke; regressioonitest peab korraga hoidma väljas mitmerealise bibliograafia ja sees järgneva kommentaari/infokasti. Need kolm näidet tuleb lisada säiliva sisu kontrolli.

#### R02 — P2: püsiv viiteloendi roll kinnistab selgitava joonealuse vale klassifikatsiooni

**Koht:** bibliograafiamustrid [chunking.js:10](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:10), ühe kirjega loendi klassifikatsioon [chunking.js:59](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:59) ning v15 rolli säilitamine [chunking.js:122](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:122).

M03 parandus säilitab õigesti juba tuvastatud loendi rolli. Aga praegune esialgne klassifikatsioon peab URL-i või lauses olevat `2023. Ajapikku` fragmenti piisavaks bibliograafiliseks tõendiks. Selgitav joonealune lõigatakse kaheks: algus eemaldatakse viitena, jätk jääb otsingusse oma kontekstita. Veebijoonealuse `[2] (#_ftnref2)` välistus nummerdatud kirjete mustris ei kaitse rea teise osa aastaarvu või URL-i eest.

- **`document_737dd8ceacaff83a4b4b47d4ce64c40e13c1e30cfdbcea793439504b916e9704`**, „Ukraina sõjapõgenike elu Eesti lühiajalistes majutustes”, **PDF lk 8**: v14-s olemas olnud **„[2] (#_ftnref2) Sellist teenust osutati aastatel 2022 ja 2023. Ajapikku”** on v15 kehast kadunud. Järgmine tükk algab **„vajadus teenuse järele vähenes…”**; teenuse osutamise ajapiir kaob. [Võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-737dd8ceacaf.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-737dd8ceacaf-p8.png).
- **`document_d02ca2954a6636139da5a448b283adea62a3738c271abc5adcbcc74194f710a0`**, „Tervisealane kirjaoskus – kuidas jõuda tervise võrdsuseni?”, **PDF lk 8**: kaovad **„[1] (#_ftnref1) EKI seletava sõnaraamatu”** ja sellele järgnev URL-iga **„… kohaselt on”** rida. Otsingusse jääb lausejätk **„paternalism „kellegi eest otsustamine“.”** ning järgmine joonealune. [Võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-d02ca2954a66.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-d02ca2954a66-p8.png).

Mõlema dokumendi samale v13 struktuurile arvutatud piirid on v14 ja v15 teostustes **samad**: vastavalt `[4, 5)` ning `[0, 2)`. Erinevus on v15-s nende ekslikult bibliograafiaks määratud lühiloendite püsiv välistamine. Seega on see R01 uuest lõpupiiri tingimusest eraldi põhjus. Mõlemad vead kordusid originaalbaitide värskel parsimisel.

**Kordamine:** `v15-checker-store.mjs`, `v15-reference-evidence.mjs`, `v15-reparse-findings.mjs`; kontrollida `footnotes` all v14/v15 `body` väärtusi ja tüki alguseid. **Soovitus:** eristada selgitav joonealune bibliograafilisest viitekirjest ning klassifitseerida terve joonealune, mitte üks URL-i/aastaarvuga rida. Säilitada M03 stabiilne roll õigesti tuvastatud loenditel. Lisada test, mis nõuab ühe selgituse kõigi ridade ja kuupäevakonteksti koos säilimist.

#### R03 — P2: katvuskontroll ei tõenda, et v14 taastatud või viitemustriga sisu v15-s säilib

**Koht:** [coverage.mjs:31](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v15-check/coverage.mjs:31) kasutab vaikimisi v13 baasi; võrdluses lähtutakse vana tüki kehast [coverage.mjs:86](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v15-check/coverage.mjs:86). Automaatne vabastus: `ENTRY` [coverage.mjs:35](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v15-check/coverage.mjs:35), rakendus [coverage.mjs:168](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v15-check/coverage.mjs:168), kahe lähikonna viitemustriga rea vahele jäämise vabastus [coverage.mjs:174](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v15-check/coverage.mjs:174).

Opuse **muutmata `compare`-funktsioon** käivitati auditikoopias samade salvestatud dokumentide peal kahe võrdlusbaasiga. Kolme R01 dokumendi kõik **71 kadunud v14 keharida** puudusid juba v13 kehast; seetõttu ei saa v13 → v15 kontroll neid kaotustena leida. Nende 71 hulgas on ka viis õigesti eemaldatud bibliograafiarida; see arv ei võrdu 71 sisukaoga.

| Kontrollitav dokument | v13 → v15 `lost / unverified` | v14 → v15 `lost / unverified` | V14 võrdluses bibliograafiana vabastatud |
|---|---:|---:|---:|
| Kommentaar, `5cb965d1588e`, lk 6 | 0 / 0 | **27 / 0** | 4 rida |
| Kiusamisennetuse infokast, `7b7b24bf7e22`, lk 4 | 0 / 0 | **2 / 0** | **24 sisulist rida**: 9 `reference_entry`, 15 `reference_between_entries` |
| Haiglate infokast, `ec0a5012083b`, lk 4 | 0 / 0 | **13 / 0** | 1 rida |
| Ukraina-artikli selgitus, `737dd8ceacaf`, lk 8 | **0 / 0** | **0 / 0** | Sisuline kuupäevarida `reference_entry` |
| EKI definitsiooni algus, `d02ca2954a66`, lk 8 | **0 / 0** | **0 / 0** | URL-rida `reference_entry`, eelnev rida `reference_between_entries` |

See ei ole kogu Opuse 390-sekundilise parsimisjooksu teine täiskäivitus: eraldati ja korrati selle võrdlusloogika tegelikel store'idel. Audit kontrollis eraldi kogu v14/v15 store'i ning parsis leitud vead värskelt üle. [Täistulemus ja näidisridade liigitus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-checker-store-result.json).

**Kordamine:** `v15-checker-store.mjs`. Selle algus on Opuse katvuskontrolli koopia kuni põhitsüklini, impordid suunatud külmutatud v15 koodikoopiale; lisatud lõpp kasutab v13, v14 ja v15 bundle'e ning salvestab arvestuse iga dokumendi kohta. Võrdlusfunktsiooni ega `ENTRY` reeglit ei muudetud.

**Soovitus:** regressioonivärav peab võrdlema vähemalt eelmise külmutatud versiooniga ja hoidma varem parandatud sisupiirkondade püsinäiteid. Lisada sõltumatu allikakatvuse kontroll ka tekstile, mida vanas baasis otsingusse ei jõudnud. URL, aastaarv ega kahe niisuguse rea lähedus ei tõenda üksinda bibliograafiat; ebaselge väljajätt peab saama sisupiirkonna tõendi või täpse käsitsi hinnangu. Praegused kolm sünteetilist enesetesti parandavad M05 sõnakoti vea, kuid ei kata neid päris dokumentide valenegatiivseid tulemusi.

### Varasemate paranduste tulemus

| Varasem leid | Sõltumatu v15 korduskontroll |
|---|---|
| **M01**: graafiku aastaarvud segunesid lausesse | „Sotsiaaltrendid 6”, lk 85: lause „Kui lühiajaliste töötute seas…” on otsingutekstis tervikuna. |
| **M02**: Häkatoni bibliograafia taastati põhitekstina | Lk 7–8 nimetatud Medari jätk, Mulgan, Oertzen, Voorberg, Wilken ei ole enam tükkides; nõustamise infokasti kontrollitud laused ja lahtrid säilivad. |
| **M03**: üksik viitekirje kaotas rolli | HTML-i täisrajas jääb bibliograafia välja ja proosa sisse; pärast jagamist tuvastatakse 1 loend. Ka Astangu lk 35 `equal-in-owl.de` kirje jääb välja. R02 näitab eraldi esialgse liigituse viga. |
| **M04**: päris vahepealkiri kadus | „Tugev side kogukonnaga toetab eluga hakkamasaamist” juhib nüüd nii algus- kui jätkutükki. |
| **M05**: eemaldatud lause laenas säilinud lausete sõnu | Auditi varasem „Toetus on 100 eurot.” kustutuse vastunäide annab nüüd `lost = 1`, `same_text_elsewhere_on_unit = 0`. Ka kontrolli enda kolm enesetesti läbivad. |

Lisaks läbivad salvestatud tükkidel varasemad nimetatud V01 artiklialgused, N01 kolm parandatud prefiksijuhtu, N02 Astangu jooksev päis/bibliograafia ning N03 Häkatoni lahtritekstid. [Kontrollide tulemused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-checker-store-result.json), [HTML-i täisraja tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-single-reference-result.json), [M05 vastunäite tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-checker-repro-result.json). V15-s muutumata ostujooksja eraldi v14 tõrke- ja jätkamiskatseid selles ringis uuesti ei käivitatud.

### Võib hiljem

- **Täiendav GraphRAG-rikastamine ja otsingujärjestus**, mis ei muuda `retrieval_text`-i ega tükkide piire, võib jääda järgmisesse etappi. Metaandmete ja juriidilise versioonikonteksti varasemad tähelepanekud jäävad raporti ajaloolistesse osadesse; v15 ei muuda nende andmefailide sisu. Käesolev kontroll ei ole õigusallikate kehtivuse uus väline kontroll.
- **Ülejäänud keerulised tabelid, slaidid ja pealkirjapiirid** vajavad jätkuvat kvaliteeditööd. Kogu parseri veatust ei ole ostueelseks eeltingimuseks seatud. Teada vigaseid piirkondi võib ostuvalikust põhjendatult välistada; nende parandamine hiljem muudab just nende embeddingusisendeid. Kahe teada vale prefiksi risk („Pereõenduse tegevusjuhend”, lk 5; Astangu „Erivajaduste alase teadlikkuse tõstmine”, lk 40–41) ei kao sellest, et nimetatud teised N01 näited läbivad.
- **Uus deterministlik kahe lehe kastivalim** (`SHA256("codex-v15:" + dokument + ":" + leht)`, v14 → v15 muutunud dokumentide kastilehed, varasemate nimetatud näidete välistused on skriptis) kinnitab allesjäänud paigutusriski. „Rehabilitatsiooni teenuseosutajate infopäeva materjal”, **`document_dbb48964ff97904c34e7f662d5467a973f2a0a6157d185800c0bb257f1e79b5c`**, **lk 22**, põimib teenuseosutaja küsimuse ja SKA vastuse endiselt kokku. Sama reajada oli juba v14-s; seda ei nimetata uueks regressiooniks. „Harjutuste kogu”, **`document_b2078456e0e73ee238605d5c41848e871ea6bbd83cd7606b7231117361a8b976`**, **lk 223**, ühendab v15-s loetelumärgid paremini, kuid külgmine „Mõtete koondamine” silt jääb näidete vahele ja märkeruutude valik ei jõua tekstina edasi. [Valim ja seemned](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-box-sample.json), [slaidi võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-dbb48964ff97.json), [harjutuse võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-inspect-b2078456e0e7.json). Mõlemad lehepildid vaadati üle; Poppler hoiatas teise faili Symbol/ArialUnicode kuvafontide puudumisest.

### Mõõdikud, kordamine ja piirangud

| Mõõtmine | Tulemus | Tõend |
|---|---|---|
| Kohalik testikomplekt | **238 PASS**, 0 FAIL, 0 SKIP; 32 testifaili; 21,75 s; `TZ=UTC` | [testilogi](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-unit-tests-verified.txt), [valik ja keskkond](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-test-summary-verified.json) |
| Kõik aktiivsed bundle'id | **5999 dokumenti**, **631 861** täpset tekstiviilu, **0** viiluviga; 42,08 s | [store-kontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-store-check.json) |
| V14 kehast välja jäänud täpselt sobivad span'id | **224**: 49 nüüd pealkirjaread, 172 lõiguread, 3 loendiread; kõik loetleti ja vaadati üle | Sama faili `new_uncovered`; arv sisaldab õigeid bibliograafiaeemaldusi ega ole automaatne sisukao arv |
| Värske parse → normalize | **23/23**: 22 PDF + 1 HTML; viie struktuuriosa räsi kattus; kolm PDF-i parsiti lisaks kaks korda ja olid deterministlikud | [13 faili](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-reparse-result.json), [4 lisafaili](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-reparse-extra-result.json), [6 leitud vea faili](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-reparse-findings-result.json) |
| Kogu ostuplaani sõltumatu arvutus | **5997 / 29 344 / 14 931 591**, korduskasutatavaid sisendeid 0, täpne plaanivõrdsus; 145,13 s; 0 võrgukutset | [plaani tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-plan-result.json) |
| Allesjäänud viiteloendiprefiksid / kastilehed | **59** viiteloendinimega tükk; **279** tuvastatud kastilehte; kumbki arv ei ole iseseisev kvaliteedihinnang | Store-kontroll ja [prefiksitega tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v15-reference-chunks.txt) |

Käivitused töökaustast; kõik uued tulemused tuleb hoida auditikaustas. `v15-source/` on selle kontrolli külmutatud koodikoopia. `wx`-kirjutusega mõõdikufailid ei kirjuta varasemat tulemust üle: kordusjooksuks kopeerida vastav abiskript auditikaustas uue nimega ja muuta ainult tulemusfaili nimi.

```powershell
node tmp/rag-v2-freeze-v15-2026-09-25/verify.mjs
node tmp/codex-audit/v15-run-tests.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-store-check.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-reparse.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-reparse-extra.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-reparse-findings.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-checker-store.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-reference-evidence.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-single-reference.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-checker-repro.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v15-plan.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/codex-audit/v15-verify-end.mjs
```

Opuse kõigi 5999 originaali värske parsimise täisjooksu selles ringis ei korratud; selle asemel loeti **kogu** v14/v15 store ja tehti **23** originaalist kordusparsimist. Teenuseid vajavad 7 unit-testifaili ja 10 integratsioonitestifaili on **NOT_RUN**. Tegelike embeddingute kvaliteet, täismahus indeks ja vastuste sisuline hindamine on **NOT_RUN**, mitte testiedust järeldatud.

Praeguse ostuplaani täpne identiteet:

```text
egress_manifest_sha256 = 6a371ab54aba9b3e4317825377d6b0eb94abead8b8545be8becc78d828806836
source_generation_id = generation_2d6618a962ad466ba9860610e139941edcb0626bfbcd7f06e393f0927272717c
corpus_snapshot_sha256 = 665751290dd69929ddb0907b1d28d589f44d348cc952e93e90f9d0f5d476c265
```

Hinnakirje on kohalik **0,13 USD / miljon tokenit**, kontrolliajaga **2026-09-25 09:28:36.050 UTC**; selle kehtivus lõpeb **2026-09-26 09:28:36.050 UTC**. Veebihinda ei kontrollitud kasutaja võrgukeelu tõttu. R01/R02 parandamine või dokumentide välistamine nõuab uut ettevalmistust ja uut täpset ostuplaani. Ostu soovitus: parandada need juhud või jätta mõjutatud dokumendid/piirkonnad põhjendatult valikust välja, kontrollida R03 parandatud väravat ning seejärel esitada omanikule konkreetne plaan ja kulupiir. Käesolev audit ei anna ostuluba.

---

## Ajalooline järelkontroll: v14 paranduste sõltumatu kontroll

**V14 ei ole praegusel kujul kogu valiku embeddinguostuks valmis.** Varasemad nimetatud peatükialgused ja Astangu jooksev päis on parandatud, kuid uus kastide tuvastus rikub ühes kontrollitud failis varem korrektset põhiteksti. Lisaks liigub bibliograafia valesti põhitekstiks, ühe kirjega viiteloendi klassifikatsioon kaob pärast sektsiooni jagamist ning üks päris vahepealkiri muutub tavaliseks lõiguks. Katvuskontroll laseb läbi ka tahtlikult eemaldatud sisulise lause. Allpool on viis korratavat P2 leidu. Paranduste alternatiiv on mõjutatud dokumentide/piirkondade põhjendatud välistamine ostuvalikust; kogu parseri veatust ei saa nõuda ega selle kontrolliga tõendada.

Läbis **234 kohalikku testi**. Kõigi **5999 aktiivse dokumendi 632 735 span'i** tekstiviilud olid täpsed. **17 dokumenti** parsiti originaalbaitidest uuesti ja saadi store'iga identsed allikaüksused, span'id, plokid, sektsioonid ning tükid. Ostuplaan kordus täpselt: **5997 dokumenti, 29 358 sisendit, 14 931 888 tokenit**, kohaliku hinnakirje järgi **1,941145440 USD**. Need tulemused ei tõenda lugemisjärjekorra ega sisulise katvuse veatust.

Töö toimus ainult kohapeal, võrgu-, mudeli-, OpenAI- ja embeddingukutseteta. Koodi ega korpust ei parandatud. Ostujooksja katsed kasutasid sünteetilist transporti auditikaustas. Ainus muudetud mitteajutine fail on see raport; abifailid asuvad `tmp/codex-audit/`. Opuse lisatud vestlust ja [tema raporti §9](C:/Users/rauds/Desktop/Sotsiaal.ee/docs/audits/rag-v2-claude-prepurchase-review-2026-09-25.md:322) käsitleti kontrollitavate väidetena, mitte tegevusloana.

### Ulatus ja külmutuse kontroll

- HEAD **`5ab30c02d874a1524074e04c19f09331e2d863c9`**, normaliseerimine **`source-structure-v14`**, tükeldamine **`structure-blocks-v8`**, teostuse sõrmejälg **`636662349211886b073e1d21ed66c02a38576bf6911ca1894e6363ee9236da6d`**.
- Varasema täieliku failikaardi **212 süsteemifaili** räsid kontrolliti. V13 järel muutusid **10 faili**; läbi loeti kogu **607-realine v13 → v14 diff**, vajalik ümbritsev kood, uus katvuskontroll ja kastide kvaliteedikontroll. Muutumatuid 202 faili ei loetud selles järelkontrollis uuesti tervikuna.
- Muutunud failid: `chunking.js`, `contracts.js`, `normalize.js`, `parser.js`, `pdf-layout.js`, `processing-implementation.json`, `search/pilot-runner.js`, `text-source.js`, `rag-v2-pilot.test.mjs`, `rag-v2-source-structure.test.mjs`.
- Külmutuse kontroll läbis alguses ja lõpus: **39 koodifaili**, plaan **`c5907736c63b…`**, generatsioon **`d4893c82df82…`**. See on eraldi kontroll kogu 212 faili auditiinventuurist.
- Lõpus: **0 muutunud süsteemiräsi**, **0 muutunud auditeeritud andmefaili**. Nelja store'i failikirjete arvud olid **7136 / 48 034 / 48 001 / 48 001**, Andmebaasis **2531**; teed, suurused ja muutmisajad jäid samaks. See inventuur ei ole kõigi store-failide teine sisuräsiarvutus.

Tõendid: [manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-manifest.json), [kogu muudatusdiff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-delta.diff), [lõppkontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-verification.json).

### Parandada enne embeddinguid

#### M01 — P2: kastide tuvastus põimib graafiku arvud varem korrektsesse põhiteksti

**Koht:** [pdf-layout.js:241](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/pdf-layout.js:241), eriti piirkonna kogumine ja rühmade lugemine [pdf-layout.js:278](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/pdf-layout.js:278). Dokument **`document_10babef4e07d6bb9a9f03cbce5b689363ab24f3c1601d486e545d611fe51be9a`**, „Sotsiaaltrendid 6”, **PDF lk 85 / trükitud 84**.

Lehel on graafik ja selle all üheveeruline rööpjoondatud põhitekst. V13 loeb õigesti: „Kui lühiajaliste töötute seas võib mõnikord olla naisi meestest rohkem, siis pikaajaline töötus ähvardab enam mehi.” V14 peab graafiku aastaarvude rida ja lõigu kaht esimest rida kastiks ning loeb neid osadena ülalt alla:

```text
00 01 02 03 04
Kui lühiajaliste töötute ähvardab enam mehi.
05 06 07 08 09 10
seas võib mõnikord olla Alates 2000. aastast on
11 12
naisi meestest rohkem, siis pikaajaline töötus ...
```

See jõuab muutmata tähendusrikkumisega tüki **`chunk_e311e55ff93aaab7701ab5330c0878162caf99f92d2bb02f0b38890348d95c11`** `retrieval_text`-i. Tekstiviilu invariant kehtib endiselt: raw_text ise on vales järjekorras. Arvulise veeru kaitse ei päästa olukorda, kus enamik tuvastatud „lahtri” ridadest on tegelikult põhiteksti sõnad.

**Kordamine:** `v14-inspect.mjs 10babef4e07d:85`, seejärel `v14-reparse-extra.mjs`; [v13/v14 read ja tükid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-inspect-10babef4e07d.json), [PDF-lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-10babef4e07d-p85.png). Viga kordus värskel parsimisel. Dokument tuli deterministlikust juhuvalimist, mitte ette teada halvimatest juhtudest.

**Soovitus:** eristada graafiku piirkond järgnevast põhitekstist enne lahtrite lugemist; nõuda iga ümberjärjestatava piirkonna jaoks piisavat kohalikku geomeetrilist tõendit. Rööpjoondatud sõnavahed ja eelmise graafiku teljemärgised ei tohi koos tekitada veerutõendit. Lisada regressioonitest tegelikule lausejärjekorrale ja embeddingutekstile, mitte ainult poolikute sõnade arvule.

Paigutusparandus jääb ka mujal osaliseks: **`document_37b9765f5276eb12a12e4f997463dc1006a809834111ceb5241221563fc093de`**, „Hoolekandeteenuste kvaliteedi juhendmaterjal”, **PDF lk 26 / trükitud 25**, ühendab endiselt külgmise SISEHINDAMINE-kasti ja põhiteksti. Tegelik tulemus sisaldab „arengukavas püstitatud eesmärkide täitmise hendeid (nt enesehindamise küsimustik)” ning jätab eelmise tüki lõppu `tööva-`. [Võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-inspect-37b9765f5276.json) ja [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-37b9765f5276-p26.png). See teine näide oli vigane juba v13-s; seda ei nimetata uueks sisukaoks.

#### M02 — P2: bibliograafia jätkuridu peetakse uueks sisuks ning 33 varem välistatud viiterida jõuab otsingusse

**Koht:** [chunking.js:45](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:45) ja [chunking.js:67](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:67). Dokument **`document_874f1616712073229eb726f7af639bb01db0b6fd17fa3d0d97922d07f71f679f`**, Häkatoni artikkel, **PDF lk 7–8 / trükitud 14–15**.

Medar jt (2017) bibliograafiakirje algusrida jäetakse `Viidatud allikad` alla, aga sama kirje järgmised kolm rida, alates **„of Participating in Estonian Labour Market…”**, loetakse proosaks. Piir leitakse kolme mitteviitelaadse rea, 150 märgi ja kogu järgneva saba viitetiheduse põhjal. Järgnev pikk infokast vähendab saba viitetihedust; see ei tõenda, et viiteloend nende kolme rea kohal lõppes.

V14 viib järgnevasse pealkirjata sektsiooni **33 täpselt sobitatud rida**, mis v13-s olid viiteloendi sees ja otsingutükkidest väljas. Need on bibliograafia jätk ja järgmised kirjed, sh Mulgan, Oertzen, Tulva, Vargo, Voorberg ning Wilken. Esimene uus tükk **`chunk_fe3196db91add505b4af37243c58fdbfe9bf5947143d9ca8a658e58cc7e27afb`** sisaldab bibliograafiat; järgmine **`chunk_c3a756bf09ca86286b64738abba82f981c4c0693642318cb7d552e244a5abb18`** ühendab selle jätku nõustamisüksuse kastiga. Mõlemal on üldine dokumendiprefiks, mistõttu „viiteloendiprefiksiga tükkide” vähenemine seda regressiooni ei näita.

**Kordamine:** `v14-inspect.mjs 874f16167120:7,8`, `v14-evidence.mjs` välja `bibliography_restored_candidates` 33 rida ning `v14-reparse.mjs`. [Võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-inspect-874f16167120.json), [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-874f16167120-p8.png). Kõik 33 selles konkreetses loendis toodud rida on bibliograafia; loendi nimi ei tähenda üldist automaatset sisuklassifikaatorit.

**Soovitus:** säilitada mitmerealine viitekirje tervikuna; tuvastada bibliograafia lõpp kohaliku paigutuse ja järgmise sisupiirkonna tõendiga. Hilisema pika teksti lisamine ei tohi nihutada varasema viitekirje piiri selle keskele. Test peab kontrollima nii infokasti säilimist kui ka seda, et eelnev bibliograafia ei muutuks otsingusisuks.

#### M03 — P2: ühe kirjega viiteloend kaotab pärast jagamist oma välistamise aluse

**Koht:** [chunking.js:55](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:55), [chunking.js:123](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:123), [text-source.js:234](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/text-source.js:234).

Ühe kirjega lühike loend loetakse viiteloendiks ainult tingimusel **`end < lines.length`**, st sellele järgneb proosa. `splitReferenceLists` tõstab selle proosa teise sektsiooni. Hiljem arvutab `referenceSpans` klassifikatsiooni uuesti: alles on ainult üks kirje, proosa puudub ja sama loend ei ole enam viiteloend. Bibliograafia saab otsingutüki ning eemaldamise hoiatus puudub.

**Sünteetiline HTML-kordus:** `<h2>Kasutatud kirjandus</h2>`, üks `Tamm, M. (2020). Sotsiaaltöö alused. Tallinn.` kirje ja kolm järgnevat proosalõiku. `parseTextSource → normalize` annab jagatud sektsiooni, **0 tuvastatud viiteloendit pärast jagamist**, kuid otsingutüki `Hoolekanne > Kasutatud kirjandus` koos bibliograafiaga. `errors: []`, `warnings: []`. See tõendab ka mitte-PDF rada.

**Päris näide:** **`document_8abc74aaefe965333f61093274882c72d1ef63912ade45166b686e71f87a6a13`**, „Erivajaduste alase teadlikkuse tõstmine”, **PDF lk 35**. Üks kirje `equal-in-owl.de; interkulturelles Sensibilisierungstraining (2004), Europäische Partnerschaft` jääb v14 otsingusse. V13 struktuuri kohal v14 jagamisfunktsiooni käivitades tuvastatakse enne jagamist täpselt see ühe kirjega loend, pärast jagamist enam mitte. Värske v14 parsimine kordab salvestatud väljundit.

**Kordamine:** [v14-single-reference.mjs](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-single-reference.mjs), [tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-single-reference-result.json), [pärisloendi stabiilsuskatse](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-reference-stability-result.json).

**Soovitus:** kanda tuvastatud loendi roll/piirid jagamisest tükeldamiseni edasi või muuta klassifikatsioon jagamise suhtes stabiilseks. Lisada kogu parse–normalize rada läbiv test; üksnes `splitReferenceLists` väljundi test ei tuvasta hilisemat taasotsustamist. Loendeid ei tohi pimesi välistada ainult pealkirja järgi, sest see taastaks varasema sisukao riski.

#### M04 — P2: v14 kaotab päris vahepealkirja ja annab kahele sisutükile eelmise teema prefiksi

**Koht:** [parser.js:239](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/parser.js:239) pealkirjaklassifikatsioon koos muudetud PDF-paigutusega. Dokument **`document_d938139465dd3ac98ac5cec42cddf592f32491207a5e69491956403a94ec607e`**, „Head praktikad toetavad sotsiaalset kaasatust ja kestlikke kogukondi”, **PDF lk 3 / trükitud 25**.

V13-s on **„Tugev side kogukonnaga toetab eluga hakkamasaamist”** kahe reaga `heading` ja oma sektsioon. V14-s on samad read `paragraph`; järgnev naisimmigrantide ettevõtluse ja kogukondade kirjeldus pärib **`> Loomateraapia turgutab tervist`**. Viga mõjutab ka jätkutükki PDF lk 3–4, kus päris vahepealkiri ei ole enam otsinguprefiksis. V14 tükid: **`chunk_6d278b1f2a13f9ef3d7e06cdc6a5d4d2bdea05a4bd71417f94297a8a8df72ead`** ja **`chunk_03b90f9fb1868a3c233d76b5c341eb46be634238ad7bb9c2d5ad3665be482392`**. Sõnad ise säilivad; tegemist on struktuuri ja embeddingusisendi regressiooniga.

Opus märkis selle juhtumi oma piirangute seas õigesti. **42/42 märgendatud pealkirja säilimine ei hõlma seda pealkirja** ega tõenda kõigi pealkirjade säilimist. Selle auditi käigus ei eraldatud klassifikatsiooni muutuse kõiki sisemisi vahetingimusi; tõendatud on tegeliku v13/v14 väljundi muutus, allika õige pealkiri ja värske parsimise korduvus.

**Kordamine:** `v14-inspect.mjs d938139465dd:3,4`, `v14-reparse-extra.mjs`; [võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-inspect-d938139465dd.json), [pealkirja lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-d938139465dd-p3.png). **Soovitus:** lisada see päris pealkiri sõltumatusse märgendusse ning kontrollida pealkirja ja kõigi jätkutükkide `section_path`-i pärast paigutusmuutust. Parandada geomeetria/fondi põhine üldreegel, ilma dokumendi ID järgi erandita.

N01 üldine probleem ei ole veel täielikult suletud ka teiste dokumentide puhul. Läbi loetud **62** viiteloendilaadse prefiksiga tükist on mõned sisukorrad, mõned päris joonealused ja mõned jätkuvalt valesti märgendatud põhitekst. Näiteks **`document_01445d05b38fda735325a2ad5b74b2bf4b679fb350316056a95ff0bcbd1380c3`**, „Pereõenduse tegevusjuhend”, **PDF lk 5**, kannab mõistete tabeli kohal eelmise lehe sisukorrast tulnud `> Kasutatud kirjandus` prefiksit. **`document_8abc74aaefe965333f61093274882c72d1ef63912ade45166b686e71f87a6a13`**, **PDF lk 41**, alustab tagasisideküsimustikku `> Kasutatud kirjandus` all. Need ei ole väide 62 uuest veast ega uued v14 regressioonid, kuid vajavad vastava ostusisu otsust. [Kõigi 62 tüki tekst](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-reference-chunks.txt), [mõistete lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-01445d05b38f-p5.png), [küsimustiku lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-8abc74aaefe9-p41.png).

#### M05 — P2: uus katvuskontroll tunnistab tahtlikult eemaldatud sisulise lause säilinuks

**Koht:** [coverage.mjs:80](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v14-check/coverage.mjs:80), [coverage.mjs:122](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v14-check/coverage.mjs:122), [coverage.mjs:128](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v14-check/coverage.mjs:128). See on tõendi viga, mitte tuvastatud tegeliku korpuse lausekadu.

Kontroll ehitab uutest sisuridadest nii täpsete ridade loenduri kui ka sõnade loenduri. Täpselt sobinud vana rida vähendab ainult ridade loendurit. Puuduv rida võib hiljem uuesti kasutada juba arvesse võetud ridade sõnu. Kontroll nimetab seda säilinud/ümberjärjestatud tekstiks ka siis, kui algset lauset otsingus enam pole.

**Korratav vastunäide ühel allikaüksusel:** vanas tükis on kolm lauset: `Toetus on 100 eurot.`, `Toetus on 200 eurot.`, `100 eurot on näites.` Uuest tükist eemaldatakse esimene lause. Span'id ja raw_text jäetakse alles, nagu tükeldamisvea korral. Opuse muutmata `compare`-funktsioon annab **`lost: 0`, `unverified: 0`, `same_text_elsewhere_on_unit: 1`, `errors: 0`**. Allesjäänud lausete sõnad asendavad puuduva toetussumma väite.

**Kordamine:** [v14-checker-repro.mjs](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-checker-repro.mjs), [tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-checker-repro-result.json). Koopia impordid ja väljundid suunati auditikausta; võrreldavat `compare` otsustusloogikat ei parandatud.

**Soovitus:** tarbida täpselt sobitatud ridade sõnade esinemised enne ümberjärjestatud jäägi sobitamist, vältida ühe esinemise topeltkasutust ning nõuda vajaduse korral järjestuse või geomeetriliste lähteelementide tõendit. Lisada kontrollile tahtliku kustutamise ja arvsuhte muutmise negatiivsed testid. Ka sõnade hulga võrdsus üksi ei tõenda lause tähenduse ega järjekorra säilimist.

Eraldi mõõdikupiirang: Opuse kastide kontrolli **91 parem / 267 sama / 4 halvem** on poolitus- ja sidekriipsumustri skoor, mitte 362 lehe lugemisjärjekorra kontroll. M01 leht on selles mõõdikus **0 → 0**, kuigi tekst rikneb. Kõik neli „halvemat” lehte vaadati pildina üle: RFK PDF lk 7 ja Peaasi PDF lk 2 põhiveerud tegelikult paranesid, SKA lk 26 ja Praxis lk 83 jäävad osaliselt segaseks. Kolmest sama-skoori juhuvalimi lehest paljastas Sotsiaaltrendid lk 85 selge regressiooni. Seetõttu ei saa v14 „0 lost” ega poolitusskoori paranemist esitada täieliku kvaliteeditõendina.

### Võib hiljem

- **N05 on parandatud:** vana `ledger.json` duplikaat ei saa enam asendada puuduvat sisendit; sõltumatu kahe sisendi katse annab `pilot_ledger_integrity_failed`. Uue JSONL-päeviku puuduv paar on samuti blokeeritud. V02 edenemisteate erind, V03 protsessi järsk lõpp ja V07 sisendi muutmine jooksu ajal kordasid varasemat korrektset käitumist. Kõik kutsed olid kohalikud testadapterikutsed.
- **N06 on parandatud:** kõigis **367** viiteloendi hoiatusega PDF/HTML-dokumendis võrdub hoiatuse arv tegeliku `referenceSpans` hulgaga; selle hulga ja tükkide sisuspan'ide kattuvust ei olnud. See kontrollib loenduse kooskõla, mitte viiteloendi klassifikatsiooni sisulist õigsust (M02–M03).
- Varasemad GraphRAG-i metaandmete rikastamise, redaktsiooniperekondade ning teenusevalmiduse märkused jäävad kehtima. Väljaspool `retrieval_text`-i hoitud graafiseosed ja päritolutõendid võivad lisanduda hiljem olemasolevaid tekstivektoreid muutmata. Pealkiri, sektsioon, KOV/õigusakti otsingukontekst ja põhitekst tuleb stabiliseerida enne vastava sisendi ostu.
- Peaasi aasta 2014 ja Tarkvanema organisatsioonilise väljaandja kinnitamise varasem piirang ei saanud selles voorus uut allikatõendit. XML/JSON-i otsingutekstid v13 → v14 ei muutunud. See ei võrdu iga õigusakti kehtivuse uue õigusliku hinnanguga.

### Varasemate N01–N06 leidude seis

| Leid | Sõltumatu tulemus v14-s |
|---|---|
| N01: taastatud põhiteksti vale viiteloendiprefiks | Kolme nimetatud dokumendi juhtumid parandatud: laste kogumiku 4 algust, COVID-i 4.9/4.11/4.12 ja puudega inimeste kogumiku ptk 5. Üldprobleem jääb osaliselt alles; M04 sisaldab teisi näiteid. |
| N02: Astangu käsiraamatu jooksev päis | Nimetatud PDF lk 40 päis eemaldatud; sealne bibliograafia ei tekita enam otsingutükki. Korpuses kokku 62 `repeated_running_head` eemaldust; kõigi 62 sisulist õiguspärasust eraldi pildina ei kontrollitud. |
| N03: Häkatoni infokasti veerud | Kolm kirjeldusveergu on loetavad. Piirkondade nimed ja kontaktid tulevad eraldi järjestikuste rühmadena; lahtri päise ja kontakti struktuurset seost pole tõendatud. Lisaks tekkis selles samas dokumendis bibliograafia regressioon M02. |
| N04: katvuskontrolli võtmekollisioon/ringsus | Allikaüksuse võtme ja pealkirjaprefiksi kontroll on parem; uut sõnaloendurite topeltkasutust näitab M05. Täielikult suletuks ei loe. |
| N05: vana päeviku duplikaat | Parandatud ja sõltumatult korratud. |
| N06: eemaldamise hoiatuse arv | Parandatud; 367 dokumendi arvud klapivad tegeliku välistushulgaga. |

Tõendid: [nimetatud peatükid, hoiatused ja andmefailide võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-evidence.json), [ostujooksja korduskatsed](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-repro-result.json).

### Mõõdikud, mitte-PDF rada ja kordamine

| Mõõdik | Sõltumatu tulemus |
|---|---:|
| Aktiivsed dokumendid | **5999**: 1023 PDF, 43 HTML, 59 XML, 4874 JSON |
| Kõigi salvestatud span'ide tekstiviilu kontroll | **632 735**, erinevusi **0** |
| Muutunud allikabaidi / metaandme räsiga dokumendid võrreldes v13-ga | **0 / 0** |
| Muutunud otsingutekstidega dokumendid | **207**: 202 PDF, 5 HTML, 0 XML, 0 JSON |
| Kõigi dokumentide tükid v13 → v14 | **29 585 → 29 491** |
| Dokumendis eemaldunud / lisandunud otsinguteksti räsid | **1614 / 1520** |
| Allesjäänud viiteloendilaadse prefiksiga tükid | **62**, kõik loeti läbi; kõik ei ole vead |
| Kastituvastusega lehed | **362**; kõiki ei vaadatud pildina üle |
| Kohalikud sihttestid, 32 testifaili | **234 läbis**, 0 ebaõnnestumist, 0 skip |
| Värskelt parsitud originaaldokumendid | **17 = 16 PDF + 1 HTML**, kõigil 5 struktuuriosa võrdsed; 2 PDF-i kordusjooks samuti võrdne |
| Ostuplaani sõltumatu arvutus | **126,7 s**, täielik võrdus, `differences: []` |
| Ostuvalik | **5997 dokumenti / 29 358 sisendit / 14 931 888 tokenit** |

Neli poolitusskoori järgi halvemat lehte ning kolm juhuvalimi lehte kontrolliti PDF-pildina ja mõlema versiooni tekstiga. Juhuvalim valiti kõigist 267 sama-skoori lehest: järjestus `SHA256("codex-v14:" + document_prefix + ":" + page)`, esimesed kolm. Valim: **Tööandjate nõustamine, PDF lk 7; Töövõime toetamise vahehindamine, lk 12; Sotsiaaltrendid 6, lk 85**. Lisaks kontrolliti pilte Häkatoni lk 8, Astangu küsimustiku lk 41, pereõenduse lk 5 ja kogukonnaartikli lk 3 kohta: selles voorus kokku **11 lehepilti**. Varasemate voorude pildikontrolle ei esitatud uutena.

HTML/XML/JSON jõuavad nüüd samuti `splitReferenceLists` kaudu tükeldamiseni; seetõttu puudutab M03 ka HTML-i. Kõigi olemasolevate XML/JSON-kirjete muutumatu `retrieval_text` ning läbinud olemasolevad allika-/record_key testid ei tõenda kõiki võimalikke uusi viiteloendipealkirjaga JSON/XML sisendeid. Andmebaasi v13-s üle vaadatud **15 faili räsid** on samad; kõigi 1156 registrikirje sisuräside kontrolli selles voorus uuesti ei käivitatud. Varasem tulemus ja metaandmeleiud jäävad allpool alles.

Plaani täpne väljundmanifest on **`c5907736c63b1dbf00e56aae45acb6f0170799bc6deb7185d6588a32433df9e4`**. Arvutatud kulu põhineb ainult plaanis salvestatud hinnal **0,13 USD / miljon tokenit**, kontrolliajaga **2026-09-25T09:28:36.050Z**. Veebihinda ei kontrollitud ja see raport ei anna ostuluba. [Plaani kordusarvutus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-plan-result.json).

Käivitada töökaustast; helperid kasutavad auditikausta külmutatud lähtekoopiat. `offline-guard.mjs` blokeerib analüüsiprotsessi võrgu ning kirjutamise väljapoole auditikausta. Ükski järgnev käsk ei vaja ingest'i enqueue/run/publish ega index-batch'i:

```powershell
$env:TZ='UTC'
node tmp/codex-audit/v14-run-tests.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-store-check.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-evidence.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-single-reference.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-reference-stability.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-checker-repro.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-repros.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-reparse.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-reparse-extra.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v14-plan.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/rag-v2-freeze-v14-2026-09-25/verify.mjs
```

Mitmed helperid kirjutavad `wx`-režiimis; kordusjooksuks valida helperi väljundile uus nimi sama auditikausta sees. Vanu tõendeid ega store'i pole vaja kustutada. [Kõigi 5999 dokumendi võrdlus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-store-check.json), [esimesed 13 parserijooksu](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-reparse-result.json), [4 lisajooksu](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-reparse-extra-result.json), [testide logi](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-unit-tests-verified.txt), [testivalik](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v14-test-summary-verified.json). Teenuse-/andmebaasiintegratsioonid, EstNLTK teenus, kogu korpuse uus parse ja tasulised hindamised: **not_run**. Opuse kogu korpuse sisulise kadudeta säilimise väide jääb **NOT_PROVEN**; see ei tähenda, et siin oleks tuvastatud tegeliku korpuse uus sisukadu.

Enne ostu tuleb M01–M04 mõjutatud tekstid parandada või ostuvalikust põhjendatult välja jätta ning M05 kontrolliviga lahendada, seejärel külmutada tegelik uus sisend ja plaan. Uuesti embeddimist põhjustab muutunud tekst või embeddingukonfiguratsioon, mitte versiooninumbri muutmine iseenesest. Sama sisendi ja konfiguratsiooni vektorite kontrollitud taaskasutus peab säilima.

---


## Ajalooline järelkontroll: v13, rakendatud metaandmed ja uus ostuplaan

Järgnev kirjeldab v13 seisu. Praegune v14 hinnang ja N01–N06 staatus on ülal; ajaloolised koodiread viitavad toonasele versioonile.


**V13 parandused on valdavalt kinnitatud, kuid enne embeddingute ostmist soovitan parandada allpool näidatud kolm otsinguteksti kvaliteediviga.** Varasem nelja artikli alguse sisukadu enam ei kordu. Taastatud tekstile jäävad siiski valed sektsioonipealkirjad; üks korduv päis toob kirjandusviited otsingusse ning ühe taastatud infokasti veerud on segamini. Nende parandamine muudab `retrieval_text`-i ja seega vastavate sisendite vektoreid. Alternatiiv on jätta tõendatud vigased piirkonnad põhjendatud review-otsusega ostuvalikust välja.

Läbis **230 kohalikku testi**. V13 ostuplaan kordus **täpselt**: **5997 dokumenti, 29 452 sisendit, 14 982 779 tokenit**. Kõigi **5999** avaldatud dokumendi **629 638** span'i puhul kehtis `source_text === source_unit.raw_text.slice(start, end)`. Täpne tekstiviil ei tõenda iseenesest õiget lugemisjärjekorda ega sektsiooni.

Kontroll oli võrgu ja mudelite kasutamiseta. Ostujooksjat katsetati ainult kohaliku sünteetilise transpordiga auditikaustas. Süsteemikoodi, Andmebaasi faile ega kolme olemasolevat korpuse store'i ei muudetud. Ainus muudetud mitteajutine fail on käesolev raport. Opuse raporti §8 ja lisatud vestluse väiteid käsitleti kontrollitava materjalina, mitte tegevusloana.

### Ulatus ja külmutatud seis

- HEAD `5ab30c02d874a1524074e04c19f09331e2d863c9`; normaliseerimine `source-structure-v13`, tükeldamine `structure-blocks-v7`; teostuse sõrmejälg `babbb205b84d8a508fbe4d73bd2d0287bb388af25b8d847eb5696472cffbde8e`.
- Senine failikaart hõlmab **212 süsteemifaili**. V12 järel muutusid **10 faili**; läbi loeti nende kogu **570-realine diff** ning vajalik ümbritsev kood. See jätkab varasemat täielikku failiauditit; muutumatuid 202 faili ei loetud seekord uuesti tervikuna. Failide räsid kontrolliti.
- Muutunud failid: `chunking.js`, `contracts.js`, `metadata-adapter.js`, `metadata-values.js`, `normalize.js`, `parser.js`, `processing-implementation.json`, `search/pilot-runner.js` ning kaks testi `rag-v2-pilot.test.mjs` ja `rag-v2-source-structure.test.mjs`.
- Läbi loeti **15 Andmebaasi faili 558-realine diff**: 13 metaandmefaili, Tallinna pakett ja REGISTER. Külmutuse 39 koodifaili, ostuplaani ja generatsiooni kontroll läbis alguses ja lõpus.
- Lõpuinventuur: süsteemifailide ja 15 andmefaili räsides **0 muutust**; vanas store'is **7136**, v12 store'is **48 034**, v13 store'is **48 001** ja Andmebaasis **2531** failikirjet, mille teed, suurused ja muutmisajad jäid samaks. Store'ide lõpuinventuur ei ole kõigi failide teine sisuräsiarvutus.

Tõendid: [v13 manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-manifest.json), [koodidiff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-delta.diff), [andmediff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-data.diff), [lõppkontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-verification.json).

### Parandada enne embeddinguid

#### N01 — P2: taastatud artiklite ja peatükkide otsinguprefiks jääb viiteloendi nimeks

**Koht:** [chunking.js:34](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:34), [chunking.js:119](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:119), [parser.js:310](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/parser.js:310). `referenceSpans` oskab lõpetada eemaldatava viiteloendi, kuid ei loo tagasitoodud sisule uut sektsiooni. `makeChunks` kasutab endiselt vana `parent_section_id` pealkirja.

Külmutatud v13 tegelikud näited:

| Dokument | PDF-leht | Oodatud sektsioon / tegelik prefiksi lõpp |
|---|---:|---|
| `document_71e6927635c650525fef031a9b867d851d380d9bf7847ab00a05b4756b390186`, „Laste subjektiivne heaolu kohalikus ja rahvusvahelises vaates” | 20, 34, 50, 58 | Nelja järgmise artikli pealkirjad / **`> Allikad`** kõigil neljal algustükil |
| `document_a01c2ad2722ebde4a2de8842f15777a98b867e1926164bd5a1ce8b02e27a9066`, „Pikk COVID esmatasandil: käsitlusjuhend” | 45, 49, 51 | Peatükid **4.9**, **4.11**, **4.12** / **`> Viited`** neljal tükil |
| `document_8387033c6ebd40dc2ee6ea4e4a70a44cba079bd284f27965e5186b1738b3c5f8`, „Puudega inimeste sotsiaalne lõimumine” | 93 | **5. SOCIAL WELFARE FOR PERSONS WITH DISABILITIES** / **`> Allikad`** kahel tükil |

Näiteks `chunk_7721ef9a868125d4ed6d13f451819bfc1578d0a95ee562800764969f71e867aa` algab „Pikk COVID esmatasandil: käsitlusjuhend > Viited”, kuigi sisaldab tromboosipeatüki jätku. Tegelikku peatüki pealkirja selles jätkutükis pole. Viga puudutab nii embeddinguteksti kui ka GraphRAG-i sektsiooniseost. Sisuline otsingukvaliteedi languse määr on mudelitestita mõõtmata; vale sisend on otse nähtav.

**Kordamine:** `v13-evidence.mjs` → `prefix_examples`; `v13-reparse.mjs` parsib COVID-i ja laste kogumiku uuesti originaalbaitidest ning annab store'iga samad sektsioonid ja tükid. PDF-lehti 45 ja 20 kontrolliti ka pildina: [COVID lk 45](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-covid-p45.png), [kogumik lk 20](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-laste-p20.png).

**Soovitus:** viiteloendi lõpp ja uue sisupiirkonna algus peavad väljenduma struktuuris enne tükeldamist. Tõendatud järgmine pealkiri peab saama oma sektsiooni; ebakindla pealkirja korral ei tohi taastatud põhitekst pärida viiteloendi silti. Lisada pärisfaili regressioonitest nii sisu säilimisele kui ka `section_path`-ile ja jätkutüki prefiksile. Ainult nelja alguslause olemasolu test seda viga ei avasta.

#### N02 — P2: laiendatud pealkirjareegel muudab korduva päise sektsiooniks ja toob bibliograafia otsingusse

**Koht:** [parser.js:232](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/parser.js:232). Dokument `document_9fe19f86c5a284d40749f84eb1869e0376242719295b828d3f268f8e83273b66`, [Astangu käsiraamat](C:/Users/rauds/Desktop/Sotsiaal.ee/Andmebaasi/juhendid_ja_uuringud/astangu_hindamisvahendi_kasiraamat.pdf), **PDF lk 40, trükitud 38**.

Korduv kujunduspäis „Hindamisvahendi käsiraamat” on kõrgusega **15,96**, põhitekst **12**. V12-s oli päis `quote` ja lehe seitse bibliograafiarida kuulusid `Kirjandus`-sektsiooni ning olid otsingust väljas. V13-s kvalifitseerub päis uueks `heading`-uks. Selle alla lähevad kaks bibliograafilist kirjet ja tekib uus otsingutükk `chunk_e74e68adf26a8fc332f29d7cc2bdcea3837424381929321f69f749f9c649a261` (lk 40–41). Tükk sisaldab viiteid Vöhringer jt (2020) ja Wechsler & Schütz (2018), mitte käsiraamatu juhiseid. Päis ise kordub ka tüki lõpus.

**Kordamine:** [v13-new-findings.json](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-new-findings.json) võrdleb v12/v13 plokiliiki ja tegelikke tükke; `v13-reparse-extra.mjs` kordab väljundi originaal-PDF-ist. [Lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-astangu-p40.png) kinnitab bibliograafiat ja kujunduspäist.

**Soovitus:** eristada korduvat samas asukohas dokumendipäist sisulisest pealkirjast ka vahetult väljaspool 10% servaala; vältida pelgalt servaala pimedat laiendamist. Päis ei tohi katkestada jätkuvat kirjandusloendit. Test peab hõlmama päris päist koos järgnevate bibliograafiliste ridadega. Parandus muudab siin otsingutükkide hulka.

#### N03 — P2: viiteloendi järel taastatud infokasti veerud on ühte teksti põimunud

**Koht:** dokument `document_874f1616712073229eb726f7af639bb01db0b6fd17fa3d0d97922d07f71f679f`, [„Häkaton kui koosloomel põhinev tööriist uudsete teenuste arendamisel”](C:/Users/rauds/Desktop/Sotsiaal.ee/Andmebaasi/ajakiri_sotsiaaltoo/19-2/Sotsiaaltoo_nr2_2019_veeb_link_Part4.pdf), **PDF lk 8, trükitud 15**; v13 tükk `chunk_2f0b299a3f8a612c80215c573c69bd8e1ce0db5b8af32d9d0eb3ef24b4a8546c`.

Lehe ülaosas on bibliograafia, all eraldi nõustamisüksuse infokast: kolm nõustamisliigi veergu ja nelja piirkonna kontaktitabel. V13 taastab infokasti **18 span'i**, mis v12-s olid viiteloendiga koos välistatud. Leht on endiselt `columns: 1`; iga horisontaalrida ühendab eri veergude teksti. Näiteks saadakse „Nõustame omavalitsusi Nõustame omavalitsusi Nõustame omavalitsusi ja sotsiaalkaitse tegevuste ja sotsiaalteenuste korraldamise teenuseosutajaid keeruliste …”. Piirkondade, töötajate ja kontaktide vastavus kaob samuti.

See on varem kirjeldatud keeruka paigutuse riski **uus konkreetne ostuvalikusse jõudnud näide**, mitte tõend uue geomeetriaalgoritmi regressioonist: PDF-paigutuse kood v12 → v13 ei muutunud. Sisukatvuse suurenemine üksi ei tõenda taastatud teksti kvaliteeti.

**Kordamine:** `v13-new-findings.json`, `v13-reparse-extra.mjs` ja [lehepilt](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-hakaton-p8.png). **Soovitus:** eraldada infokast oma piirkonnaks ja säilitada iga veeru ning tabelilahtri seos; kuni seda pole, jätta see piirkond ostuvalikust välja selge review-põhjusega. Ülejäänud artikli eemaldamine pole tingimata vajalik. Allika ID järgi runtime-erandit ei lisata.

#### N04 — P2: uue katvuskontrolli asukohavõti annab valed HTML-mõõdikud ning välistuste hindamine on ringne

**Koht:** [coverage.mjs:35](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v13-check/coverage.mjs:35) ja [coverage.mjs:45](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-v13-check/coverage.mjs:45). See on tõendus-/testiviga, mitte eraldi tuvastatud allikateksti kadu.

1. Võti `${pdf_page}:${start}:${end}` ei sisalda allikaüksust. HTML-is on leht `null` ning eri allikaüksuste nihked algavad nullist. Kontrollitud **43 HTML-is on 199 võtmekollisiooni**. Näiteks „Turvalisuse märgid” dokumendis saavad üksused 1 ja 18 sama võtme `null:0:50`, kuigi üks on autori amet ja teine vahepealkiri.
2. Välja jäetud rea õiguspärasust hinnatakse sama tootmiskoodi `referenceSpans` tulemusega, mis selle rea välja jättis. Liiga pika viiteloendi puhul võib viga seega iseennast õigeks tunnistada. Samuti pole kontrollitud, kas pealkirjaks nimetatud tekst päriselt jõudis otsinguprefiksisse. Skripti lõpu väljumiskood sõltub ainult `lost_content`-ist, mitte nelja V01 kontrolli tulemustest.

Sama külmutatud väljundi võrdlus annab vana võtmega täpselt Opuse **92 eemaldatud / 640 lisatud** rida. Võtmega **`source_unit_index + start + end + source_text-räsi`** on õiged arvud **86 / 447**. Kõik 86 eemaldatud rida loeti eraldi üle: **83 bibliograafia-/viitejätku rida ja 3 jooksvat päist**; selle konkreetse võrdluse põhjal uut sisukadu ei leitud. Seda tulemust ei tuletatud `referenceSpans` otsusest. Nelja varasema artiklialguse 49 span'ist on 48 tükkides; puuduv üks on lk 20 jooksev päis „LAPSE ÕIGUSED”, mitte artikli pealkiri ega sissejuhatus.

**Kordamine:** `v13-coverage-independent.mjs` ja `v13-evidence.mjs`; [eemaldatud ridade täielik loend](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-removed-lines.txt), [kollisioonid ja mõlemad mõõtmised](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-evidence.json). **Soovitus:** kasutada vormingust sõltumatut allikaüksuse identiteeti, kontrollida võtmete unikaalsust ja tekstivastavust, hinnata eemaldusi sõltumatu märgenduse/ootusega ning arvestada kõikide nõutud kontrollide ebaedu väljumiskoodis. Järgmise paranduse ostuvalmidust ei tohiks tõendada praeguse ringse väravaga.

### Võib hiljem

#### N05 — P2: vana `ledger.json` taaskasutus lubab duplikaadiga võltslõpetatust

**Koht:** [pilot-runner.js:73](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:73), [pilot-runner.js:138](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:138). `coveredLedger` võrdleb kirjete arvu sisendite arvuga ja kontrollib iga kirjet, kuid ei nõua kirjete ID-de unikaalsust. Kahe sisendi vanas `ledger.json`-is võivad kaks sama esimese sisendi edukat kirjet asendada teise sisendi.

**Kordamine:** `v13-repros.mjs`, `legacy_duplicate`: kahele sünteetilisele sisendile lõpetatud jooks, vana formaadi fixture, esimene kirje dubleeritakse teise asemele. `runPilot` tagastab **`complete`**, 2 kirjet, 0 uut kutset; `StoredEmbedding.load` keeldub koodiga **`complete_real_pilot_required`**. Uues JSONL-päevikus on unikaalsus kaitstud ja algne puuduva paariga V04 katse nüüd õigesti blokeeritud. Ei tõendatud lisakulu ega puudulike vektorite kasutamist otsingus; vastuolu puudutab vana formaadi lõpetatuse raporteerimist.

**Soovitus:** kontrollida täpset sisendi-ID-de hulka ja unikaalsust ka ühisfunktsioonis; lisada duplikaadiga vana formaadi test. See muudatus ei vaja uusi embeddinguid ja ei pea blokeerima uut JSONL-jooksu.

#### N06 — P3: viiteloendi eemaldamise hoiatus raporteerib nüüd liiga suurt arvu

**Koht:** [normalize.js:137](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/normalize.js:137). Hoiatus loendab endiselt kogu `referenceSections` sektsiooni, kuigi chunking eemaldab ainult `referenceSpans` alamhulga. Näiteks COVID-juhendis väidab see **249** rea väljajätmist, tegelikult jäetakse välja **169** ning **80** on tükkides; laste kogumikus vastavalt **343 / 295 / 48**. Erinevus leiti 1053 ühise PDF/HTML-dokumendi hulgas **36 dokumendil**.

**Kordamine:** `v13-evidence.mjs`, `warnings`. **Soovitus:** lugeda tegelikke eemaldatud span'e ja nimetada osaliselt säilitatud sektsioonid täpselt. Review-kasutaja ei tohiks saada taastatud sisust vastupidist teadet. Hoiatusteksti parandus üksi ei muuda embeddingusisendit.

Varasemad GraphRAG-i rikastamise ja redaktsiooniperekondade märkused jäävad kehtima ulatuses, milles väljad ei muuda `retrieval_text`-i. ADR-029 sõnalise järjestuse / korpuse otsingu teenusevalmidust selles voorus võrgu- ja teenusekeelu tõttu uuesti ei tõendatud. Seda võib lahendada olemasolevaid vektoreid taaskasutades, kui nende tegelik sisend ja konfiguratsioon säilivad.

### V01–V07 sõltumatu korduskontroll

| Varasem leid | Tulemus v13-s |
|---|---|
| V01, nelja artikli alguse sisukadu | Sisuline kadu parandatud: neli algust on olemas, 48/49 span'i tükkides; üks puuduv on jooksev päis. Sektsiooniseos on endiselt vale — N01. |
| V02, viskav edenemisteade | Parandatud. Esimene jooks jätab `reserved,succeeded`; jätkamine teeb ainult ühe allesjäänud kohaliku kutse ning vektorid on loetavad. |
| V03, järsk protsessilõpp | Parandatud kontrollitud katkestuskohas. Lapsprotsess lõpetab koodiga 73 pärast reserveeringut; jätkamine võtab aegunud luku üle ja tagastab `stopped_unknown`, **0 korduskutset**. See ei tõenda kõiki võimalikke ketta-/lukurikke katkestuskohti. |
| V04, lõpetatud päeviku puuduv paar | Uuel JSONL-il parandatud: nii jooksja kui ka laadija annavad `pilot_ledger_integrity_failed`. Vana formaadi duplikaadierand N05 jääb. |
| V05, URL-eraldajate võrdsustamine | Parandatud kolmel varasemal vastunäitel: `%2F`, päringu `%26` ja `%2B` erinevad struktuurmärkidest ning tekitavad metaandmekonflikti. |
| V06, kinnitatud puudumine | Parandatud. `publication_date` kustutatakse kandidaatidest kinnitatud puudumise alusel. Päästeameti tegelikus v13 väljundis aasta **2020**, kuupäev **null**, põhjendus **`confirmed_absent`**. |
| V07, kutsuja sisendi muutmine jooksu ajal | Parandatud. Tagasikutse muudab algset objekti, kuid transport saab ikka kinnitatud teksti „different words” ja selle algse räsi. |

Tõend: [sõltumatute korduskatsete tulemused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-repro-result.json). Kõik transpordikutsed olid sünteetilised ja võrguühenduseta.

### Metaandmed ja ostuplaan

- Kõik registri **1156 metaandmefaili räsi** klapivad; **1077 allika metaandmeviidet** osutavad olemasolevale registrikirjele; dubleeritud registriteid **0**. Ka kõigi 14 parandatud andmefaili räsid klapivad REGISTER-iga.
- Kõik **13 parandatud PDF-i** parsiti uuesti. Nende ning Tallinna lisandunud JSON-kirje, kahe HTML-i ja nelja probleemse PDF-i puhul oli kokku **20 värske parserijooksu dokumendi** span'ide, allikaüksuste, plokkide, sektsioonide ja tükkide väljund salvestatud v13-ga identne. Kahe PDF-i teine jooks oli samuti identne. See ei tähenda kõigi 5999 allika uuesti parsimist.
- Kontrollitud kuupäevaread vastavad parandustele: Riigikontroll **2023-01-16**, **2023-11-22**, **2024-05-16**, **2023-09-25**; SKA infopäev **2020-10-16**; Võrdõigusvolinik **2016-01-18**. Päästeameti täpne kuupäev on põhjendatult tühi. EPIKoda väljaandja/aasta/koostaja on PDF-i lk 1–2-ga kooskõlas. Ajakirja kahe 2025 väljaande ja 2024 veebikuupäeva eristamise varasem allikakontroll jääb aluseks.
- **Peaasi aasta 2014 jääb allikast kinnitamata**; seda ei esitata kinnitatud paranduse osana. Tarkvanema organisatsiooniline väljaandjaseos jääb samuti tõendamata; allikanimi „Tarkvanem” ei võrdu tõendatud väljaandjaorganisatsiooniga. GraphRAG peab säilitama selle eristuse.
- V13 aktiivseid dokumente **5999**: **1023 PDF-i, 43 HTML-i, 59 XML-i, 4874 JSON-kirjet**. Kõik 5985 varasemat aktiivset dokumenti on alles ning lisandunud 14. Ühiste XML/JSON-dokumentide otsingutekstides selles võrdluses muutusi ei olnud.
- Ostuvalikust jäävad täpselt välja kaks kinnitatud ajaloolist dokumenti: EPIKoda 2013 (`document_9e54e0…`) ja Võrdõigusvolinik 2016 (`document_fde3e9…`). Neid pole ka v13 indeksi lubatud dokumentide poliitikas.
- Ostuplaani sõltumatu arvutus: **5997 dokumenti; 29 452 sisendit; 14 982 779 tokenit; 1,947761270 USD** plaani kohalikult salvestatud hinnaga. Täielik plaan on võrdne, `differences: []`; manifest **`372d495472f9c4035b6275c636fbef665d46ce375c0dad7926a40d3c58cfa0f3`**. See kontrollib arvutust, mitte veebihinna ajakohasust ega anna ostuluba. Võrku ei kasutatud.

Tõendid: [värsked parserijooksud](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-reparse-result.json), [kaks lisajuhtu](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-reparse-extra-result.json), [registri- ja valikukontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-evidence.json), [täpselt kordunud ostuplaan](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-plan-result.json).

### Mõõdikud ja kordamine

| Mõõdik | Tulemus |
|---|---:|
| Võrguühenduseta sihttestid, 32 failist | **230 läbis**, 0 ebaõnnestumist |
| Kõigi aktiivsete v13 dokumentide tekstiviilu kontroll | **629 638 span'i**, 0 erinevust |
| V12/v13 ühine PDF/HTML-alamhulk | **1053 = 1010 PDF + 43 HTML** |
| Muutunud dokumendid selles alamhulgas | **109** |
| Tükke alamhulgas enne → pärast | **20 783 → 20 755** |
| Muutunud sisenditekstide räsid dokumendi sees | **1586 eemaldatud / 1573 lisatud** |
| Korrektselt sobitatud, tükkidest välja/lisaks tulnud span'id | **86 / 447** |
| Mõõdetud HTML-võtmekollisioonid Opuse kontrollis | **199** |
| Värskelt uuesti parsitud dokumendid | **20**, kõigil võrdne väljund |
| Kogu ostuplaani uuesti arvutamine | **99,1 s**, täpne võrdus |

Käivitada töökaustast. Kontrollskriptid kasutavad `v13-source` külmutatud lähtekoopiaid; võrgu- ja kirjutamiskeelu preload lubab kirjutada ainult `tmp/codex-audit/` alla. Skriptid ei vaja `.env` lugemist ega API-võtmeid.

```powershell
$env:TZ='UTC'
node tmp/codex-audit/v13-run-tests.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v13-repros.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v13-coverage-independent.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v13-evidence.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v13-reparse.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v13-reparse-extra.mjs
node --import ./tmp/codex-audit/offline-guard.mjs --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/v13-plan.mjs
node --import ./tmp/codex-audit/offline-guard.mjs tmp/rag-v2-freeze-v13-2026-09-25/verify.mjs
```

Mitmed abiskriptid loovad tõendifaili `wx`-režiimis, et vana tõendit mitte üle kirjutada. Uue kordusjooksu jaoks tuleb nende väljundfailidele valida uus nimi sama auditikausta sees. Store'i ega lähtekoodi ei ole selleks vaja muuta. Testide [täielik logi](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-unit-tests-verified.txt) ja [valiku kirjeldus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/v13-test-summary-verified.json) eristavad minu jooksu Opuse raporteeritud suuremast komplektist. Teenuse-/andmebaasiintegratsioonid, EstNLTK teenus ja tasulised hindamised: **not_run**.

Embeddingute kordusostu seisukohast tuleb lahendada N01–N03 või piirata nende mõjutatud ostuvalikut, seejärel valmistada uus muutumatu väljund ja võrrelda tegelikke sisendiräsisid. Versioonisilt üksi ei tähenda, et iga muutumatu tekst tuleb uuesti embeddida: sama teksti ja embeddingukonfiguratsiooniga kontrollitud vektoreid saab taaskasutada. N05–N06 ja embeddingutekstist eraldi hoitud metaandmete rikastamine ei nõua tekstivektorite muutmist.

---

## Ajalooline järelkontroll: v12, ostujooksja, pealkirjaprototüüp v2 ja paranduste pakett

Järgnev kirjeldab varasemat v12/prototüübi seisu. V01–V07 praegune staatus ja v13 ostueelne otsus on ülal; ajaloolist ostukeeldu ei tohi lugeda paranduste järelkontrolli asemel.

**Praegust pealkirjaprototüüpi v2 ei soovita muutmata v13-sse võtta ega selle väljundile embeddinguid osta.** See parandab palju valesid pealkirju, kuid eemaldab ühe kogumiku nelja järgmise artikli algusest kokku **49 span'i otsingutükkidest**. Lisaks kinnitati ostujooksja taastumise ja päeviku tervikluse vead ning URL-kandidaatide liiga lai võrdsustamine. Need on allpool eraldi korratavad leiud.

V12 ostuplaani arvutus ise kordus täpselt. Varasem mahuarvude piirang, aktiivsete õigusaktide puuduv jurisdiktsioon ja konkreetne OCR-vahepealkirja puudus on parandatud. Läbis **223 kohalikku testi**. Need tulemused ei tühista eraldi leitud äärejuhtumeid.

Järelkontroll oli ainult lugemine ja analüüs. Ei muudetud süsteemikoodi, korpust ega olemasolevaid store'e, ei kasutatud mudelit, embeddinguteenust, võrku, andmebaasiteenuseid ega saladusi. Kõik katseadapterid tagastasid sünteetilisi vektoreid. Lisatud Opuse vestlust ja raportit käsitleti kontrollitavate väidetena, mitte korraldusena parandusi rakendada, midagi avaldada või osta. Ainus muudetud mitteajutine fail on käesolev raport; katsefailid on `tmp/codex-audit/` all.

### Ulatus ja tõendatud seis

HEAD: `5ab30c02d874a1524074e04c19f09331e2d863c9`. Järelkontrolli koopia valmis **14:53:38 UTC**: normaliseerimine `source-structure-v12`, tükeldamine `structure-blocks-v6`. Võrdlusbaas oli eelmise auditi `final-review-source`, mitte eeldus puhtast tööpuust.

- Failikaart hõlmab nüüd **212 süsteemifaili**: eelmises auditis täielikult loetud 211 ning uus `scripts/rag-v2-corpus-embeddings.mjs`. Võrreldes eelmise ülevaatusega muutus 23 faili; nende kogu 1312-realise diffi ülevaatus ja uus CLI lugemine lisandusid varasemale katvusele. Muutumatute failide räsid kontrolliti. See ei ole väide, et kogu ülejäänud rakendus või sõltuvuspuu uuesti auditeeriti.
- V12 külmutuse **39 koodifaili**, ostuplaani ja generatsiooni kontroll ning mõlema prototüübi kirje kontroll läbisid alguses ja lõpus. Failiräsi tõendab muutumatust, mitte korrektset käitumist.
- Lõppkontroll **15:12:38 UTC**: 212 süsteemifailis ega viies lisamaterjalis muutusi ei olnud. Vana store'i **7136** ja uue store'i **48034** faili teed, suurused ja muutmisajad jäid samaks. See võrdlus ei ole kõigi store'i failide sõltumatu lõpu-sisuräsi arvutus.

Tõendid: [212 faili manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-manifest.json), [v10 → v12 diff](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-delta.diff), [lõppkontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-verification.json). Varasema täieliku failikaardi ja lugemiskatvuse tõendid on raporti ajaloolises osas.

## Parandada enne embeddinguid

P1 tähendab siin sisulist ostueelset takistust; P2 piiratud, kuid korratavat käitumis- või kvaliteediviga. Prototüübi leid V01 ei ole külmutatud v12 väljundi regressioon: viga tekib kavandatud pealkirjaparanduse rakendamisel.

### V01 — P1: prototüüp pikendab viiteloendi üle järgmise artikli alguse

**Koht:** [prototüübi parser.js:298](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-heading-prototype-v2/lib/rag-v2/parser.js:298), [chunking.js:12](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:12) ja [chunking.js:138](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/chunking.js:138). Dokument `document_71e6927635c650525fef031a9b867d851d380d9bf7847ab00a05b4756b390186`, versioon `version_580e5084fb57dc9991f018b1ce5b90d9ef83c0ad83e2772c5df8497e9ae01da2`; allikas [Statistikaameti kogumik](C:/Users/rauds/Desktop/Sotsiaal.ee/Andmebaasi/juhendid_ja_uuringud/statistikaamet_laste_subjektiivne_heaolu_kohalikus_ja_rahvusvahelises_vaate.pdf).

Bibliograafiliste kirjete pealkirjarolli eemaldamine on iseenesest õige. Aga järgmise artikli pealkiri ja rasvane sissejuhatus ei moodusta parseris uut sektsiooni. Seetõttu jäävad need eelmise `Kirjandus`-sektsiooni alla; `referenceSections` märgib terve sektsiooni viiteloendiks ja `makeChunks` jätab kõik selle span'id välja.

| PDF-lehekülg | Otsingust täiendavalt kadunud span'e artikli algusest | Kontrollitud algus |
|---|---:|---|
| 20, trükitud 18 | 11 | „Lapse õigused on inimõigused …“ |
| 34 | 11 | „Laste õpihuvi ja akadeemiline edukus …“ |
| 50 | 12 | „Kuidas perekonda määratleda …“ |
| 58 | 15 | „ÜRO lapse õiguste konventsiooni artikkel 12 …“ |
| **Kokku** | **49** | Pealkirjad, autoriread, sissejuhatused ja lk 58 tsitaat |

Kõik neli näidisalgust esinevad v12 `retrieval_text`-is, prototüübi omas puuduvad ning prototüübi span'ides säilivad. Ühest dokumendist jääb täiendavalt tükeldamata kokku 134 span'i; ülejäänud 85 on eelmiste viiteloendite piirkonnas. PDF lk 20 kontrolliti ka renderdatud lehelt: tegemist on selge uue artikli, mitte viitekirjega. Seega ainult span'ide säilimise või pealkirjade arvu test sisukadu ei avasta.

**Kordamine:** `post-v12-reference-regression.mjs` parsib sama PDF-i prototüübiga mälus, normaliseerib selle ja võrdleb külmutatud v12 tükkidega. Tulemus: [täpsed span'id, bbox-id, sektsioonid ja neli tekstikontrolli](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-reference-regression.json); [visuaalne tõend, PDF lk 20](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-reference-p20.png).

**Soovitatud parandus:** lahendada üldise reeglina järgmise artikli alguse tuvastus ja viiteloendi lõpp. Ainult terve sektsiooni bibliograafiliste ridade osakaalust ei piisa. Lisada regressioonikatse, mis nõuab nende nelja sissejuhatuse säilimist otsingutükkides ning eemaldab samal ajal tegelikud bibliograafiakirjed. Üldine katkestamine iga lehevahetuse juures ei sobi mitmeleheküljelisele viiteloendile. Dokumendi ID järgi erandit ei lisata. **Embeddingumõju:** parandatud väljund ja tükipiirid muudavad sisendiräsisid; uus plaan tuleb koostada alles pärast seda parandust.

### V02 — P2: edenemisteate tõrge muudab eduka päevikukirje loetamatuks

**Koht:** [pilot-runner.js:157](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:157), `:159`–`:167`; taasesituse piirang `:60`.

`onProgress` käivitatakse samas `try`-plokis pärast vektori ja `succeeded` sündmuse salvestamist. Kui callback viskab vea, kirjutab `catch` sama sisendi kohta `unknown` sündmuse. Taasesitus lubab tulemust ainult `reserved` olekule, seega keeldub hiljem nii jätkamine kui ka `StoredEmbedding.load` päevikust veaga `pilot_ledger_integrity_failed`.

**Kordamine:** `post-v12-repros.mjs`, juhtum `progress`: üks edukas kohalik adapterikutse, seejärel viskav `onProgress`. Päevikusse jääb `reserved → succeeded → unknown`; mõlemad hilisemad lugemised ebaõnnestuvad. Tegelik CLI callback ainult väljastab edenemist; katse kasutab funktsiooni toetatud callback-liidest, mitte tõendit toimunud tootmistõrke kohta.

**Soovitatud parandus:** eraldada edenemisteate käsitlemine tasulise päringu tulemuse käsitlemisest. Juba püsivalt kinnitatud edu ei tohi muutuda tundmatuks teavitustõrke tõttu. Testida eraldi ka salvestamise/fsync'i tõrke piire. **Embeddingumõju:** tekst ei muutu; säilitatud vektorite taastatavus võib kaduda.

### V03 — P2: tegelik protsessi katkestus jätab jätkamist blokeeriva luku

**Koht:** [pilot-runner.js:95](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:95) ja `:176`; [katkestust simuleeriv test:96](C:/Users/rauds/Desktop/Sotsiaal.ee/tests/rag-v2-pilot.test.mjs:96).

`pilot.lock` luuakse `wx`-iga ja eemaldatakse `finally`-s. Protsessi järsu lõpu korral `finally` ei käivitu. Järgmine käivitus tagastab `pilot_busy` enne päeviku taastamist; lukku kirjutatud PID-i ei kasutata omaniku kontrolliks. See lukukäitumine oli olemas ka varasemas jooksjas: tegu pole append-only muudatusega tekitatud uue regressiooniga, kuid kirjeldatud katkestusest taastumine ei ole terviklik.

**Kordamine:** `post-v12-repros.mjs`, juhtum `crash`: ainult auditi enda lapsprotsess lõpetab end koodiga 73 sünteetilises transpordis pärast reservatsiooni püsivat salvestamist. Päevikus on `reserved`; jätkamine annab `pilot_busy`. Ühtegi päris päringut ei tehta. Olemasolev test kärbib juba korralikult lõpetatud jooksu päevikut, mil lukufail on eemaldatud, ja seetõttu seda ei tuvasta.

**Soovitatud parandus:** protsessi elueaga seotud lukk või tõendatult surnud omaniku luku turvaline taastamismehhanism; säilitada paralleelkäivituse kaitse. Tundmatu tulemusega reservatsiooni ei tohi automaatselt uuesti saata. Alternatiivina peab vähemalt olema täpne, kontrollitav käsitsi taastamise protseduur ja päris protsessikatkestuse test. **Embeddingumõju:** teksti ei muuda; operatsioon jääb sekkumiseta kinni.

### V04 — P2: puuduliku päeviku saab jooksja lugeda lõpetatuks

**Koht:** [pilot-runner.js:63](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:63), `:124`–`:126`; rangem vektorilaadur `:189`–`:191`.

`complete` sündmus kontrollib vaid olemasolevate kirjete edukust. Täielikku kattuvust manifesti sisenditega jooksja selles harus ei nõua. Kahe sisendi edukast päevikust ühe täieliku `reserved/succeeded` paari eemaldamisel tagastab `runPilot` jätkuvalt `complete`, ühe reserveeritud katse ja null uut kutset. `StoredEmbedding.load` keeldub hiljem veaga `complete_real_pilot_required`.

**Kordamine:** sama abiskripti `omitted_pair`. See on sünteetiline päeviku rikkumise/puuduliku taastamise katse, mitte väide, et tavaline append ise keskmisi ridu kustutab. Puuduv paar põhjustab eksitava lõpetamis- ja kasutusaruande; rangem hilisem laadimine peatab indekseerimise.

**Soovitatud parandus:** enne `complete` tagastamist võrrelda edukate kirjete hulka ja täpset ID/hash/token katvust manifestiga, lisaks senisele vektoriräsi kontrollile. Sama põhimõte peab kehtima vana `ledger.json` lõpetatud jooksu taaskasutusele. **Embeddingumõju:** tekst ei muutu.

### V05 — P2: URL-ide täielik dekodeerimine peidab päris metaandmekonflikti

**Koht:** [metadata-values.js:5](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/metadata-values.js:5) ja [metadata-adapter.js:77](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/metadata-adapter.js:77).

`decodeURIComponent` loeb võrdseks ka reserveeritud URL-eraldajate kodeeritud ja kodeerimata vormid. Näiteks `/a%2Fb` ja `/a/b`, `?q=a%26b` ja `?q=a&b` ning `?q=a%2Bb` ja `?q=a+b` pole üldjuhul samatähenduslikud. Katse kõigis kolmes paaris tagastab adapter konfliktide loendiks `[]`. Algne URL-string säilib metaandmetes; tõendatud viga puudutab kandidaatide võrdlemist ja review-kaitset.

**Kordamine:** `post-v12-repros.mjs`, `urls`; päringuid nendele aadressidele ei tehta. **Soovitatud parandus:** normaliseerida võrreldavad komponendid URL-i semantikat säilitades; mitte dekodeerida reserveeritud eraldajaid samaks kui struktuurimärke. Unicode'i kodeeritud/NFC kujud võib võrdsustada sobivas komponendis. Olemasolev kolme Unicode-juhu test ei kata reserveeritud märke. **Embeddingumõju:** URL üksi ei kuulu tavapärasesse prefiksisse; siiski tuleb taastada korrektne allikakandidaatide kontroll.

### V06 — P2: kinnitatud puudumine on endiselt rakendamata; paranduste edukus ei tähenda kogu bibliograafia õigsust

**Koht:** [corrections.json:44](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-corrections-v13/corrections.json:44), [validate.mjs:50](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-corrections-v13/validate.mjs:50) ja `:55`, [metadata-adapter.js:43](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/metadata-adapter.js:43). Allikas [Päästeameti juhend, PDF lk 1](C:/Users/rauds/Desktop/Sotsiaal.ee/Andmebaasi/juhendid_ja_uuringud/paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf.pdf).

Eraldatud koopial kordusid kõik 14 valideerija positiivset tulemust, kuid Päästeameti väljundis on korraga `publication_year=2020` ja tõendamata `publication_date="2024-03-03"`. Esileht annab ainult aasta 2020. `confirmed_absent` on paranduste kirjelduses; v12 adapter ei oska kinnitatud nullväärtust ning valideerija positiivne lõpurida ei arvesta `pending_v13` lahendamata olekut. Opuse raport nimetab piirangut ausalt; seda ei tohi hilisemas automatiseerimises kaotada.

**Kordamine:** `post-v12-corrections.mjs`; [tulemused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-corrections/result.json). **Soovitatud parandus:** rakendada kinnitatud puudumise seis nii, et alternatiiv jääb ajalukku ja ei taastu adapteris; lahendamata `pending_v13` ei tohi saada lõplikku review'd. Sama pakett jätab Peaasi materjali 2014. aasta kinnitamata: aluses endas on märgitud, et aastat dokumendis pole. Muutmata välju ei saa nimetada selle katsega faktikontrollituks. **Embeddingumõju:** need kuupäevad tavapärast embeddinguteksti ei muuda; parandatud pealkirjade ja lõpliku valiku mõju tuleb aga uues plaanis arvestada.

### Ostujärjekord, mis väldib kordusostu

Parandada V01 ja jooksja/adapteri vead, lisada sisulise katvuse regressioonikontroll ning alles siis fikseerida tootmiskandidaadi töötlusversioon ja fingerprint. Rakendada üle vaadatud metaandmeparandused koos registriräsidega ning säilitada kahe ajaloolise materjali kavandatud välistus ostu- ja indeksiõigustes. Need on soovitused; käesolev audit ei rakendanud ühtegi neist muudatustest.

Seejärel valmistada lõplik valik uuesti ette ja koostada uus ostuplaan. V12 `cbcdc858…` kinnitust ei saa kasutada v13 väljundi jaoks. Muutumatu `retrieval_text` räsi ja sama embeddingukonfiguratsiooniga vektorit saab taaskasutada ka uue dokumendiversiooni juures; kogu korpuse pime kordusost pole vajalik. Seda eristust tuleb rakendada plaanis, mitte eeldada ainult töötlusversiooni nime põhjal.

## Võib hiljem

### V07 — P2: jooksja API eeldab muutumatuid objekte, kuid ei taga seda

**Koht:** [pilot-runner.js:87](C:/Users/rauds/Desktop/Sotsiaal.ee/lib/rag-v2/search/pilot-runner.js:87), `:119` ja `:137`.

Täielik manifestiga võrdlus toimub nüüd ühe korra. Per-sisend kontroll võrdleb teksti selle enda muudetavate hash/token väljadega. Katse `mutating_next` muudab esimese `onProgress` järel järgmise sisendi teksti ja selle räsi/tokenid sama pikkusega uueks sisendiks. Jooksja saadab selle kohalikule adapterile ja lõpetab edukalt, kuigi muutumatu manifesti räsi on teine. Hilisem laadimine keeldub `stored_vector_scope_mismatch` tõttu.

See nõuab sama protsessi usaldatud kutsuja/callback'i sekkumist. Praeguse CLI kaudu ei tõendatud välise kasutaja rünnakuteed; seetõttu ei esitata seda tootmise andmelekkega võrdsena. **Soovitus:** teha valideeritud sisenditest ja kinnitusest privaatne muutumatu koopia või võrrelda iga sisendit muutumatu manifestikirjega. Lisada API regressioonikatse. Teksti muutumatu käitlemine on vajalik enne seda funktsiooni kasutavat uut asünkroonset integratsiooni.

### Leksikaalse otsingu jõudlus ja GraphRAG-i rikastamine

[ADR-029](C:/Users/rauds/Desktop/Sotsiaal.ee/docs/rag-v2/adr-029-lexical-ranking-at-corpus-scale.md) käsitleb indeksi ja sõnalise järjestuse muutmist. See võib toimuda ostetud vektoreid säilitades, kui `retrieval_text`, mudel, mõõtmed ja sisendikonfiguratsioon ei muutu. Sama kehtib tõendatud GraphRAG-seoste, omavalitsuse ID-de, õiguste päritolu ja kehtivusajaloo lisamise kohta struktureeritud väljadena.

Opuse külmutatud mahu-logis on kogu korpuse ühisel otsingurajal `lexical_service_failed`; indeksikirjutuse edukus ei tõenda toimivat kasutajapäringut. Need teenusekatsed **ei olnud siin uuesti käivitatud**, sest võrgu-/teenusekutsed olid keelatud. Sõnalise järjestuse paranduse võib embeddinguteksti lõplikust kinnitamisest eraldada, kuid kogu korpuse piloodi kasutusvalmidust see audit ei kinnita. Tasulist mudelitesti pole vaja kohaliku SQL-i jõudluse või viitekatvuse kontrollimiseks.

## Mõõtmised ja Opuse väidete järelkontroll

### Ostukava

`buildCorpusEmbeddingPlan` käivitati külmutatud koopia kaudu olemasolevat store'i ainult lugedes. Kõik valitud bundle'id läbisid funktsiooni enda terviklus- ja mahukontrolli. Uus plaan võrdus varasemaga täielikult; aega kulus umbes 119 sekundit.

| Mõõdik | Sõltumatult saadud tulemus |
|---|---:|
| Dokumendid | 5985 |
| Tükid külmutatud mock-indeksi logis | 29103 — logitõend, teenust ei korratud |
| Erinevad embeddingusisendid | 29051 |
| Sisendtokenid | 14682957 |
| Maksimaalne katsete arv antud strateegiaga | 29051 |
| Arvutus hinnakirjafaili `0.13 USD / miljon` alusel | 1.908784410 USD |
| Manifesti räsi | `cbcdc85813460ab91f8d647b0db28e101710c3977f7ace0e8f79c9e336ecb270` |
| Tegelikud väliskutsed auditis | 0 |

Hinda ei kontrollitud veebist; see on olemasoleva kohaliku hinnafaili alusel korratud arvutus, mitte uus turuhinna kinnitus ega arve. Tõend: [plaani tulemus](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-plan-result.json).

### Pealkirjaprototüüp

Parsiti uuesti kõik avaldatud PDF-id; HTML-ide puhul korrati teksti ingest'i. Kokku **1053 avaldatud dokumenti = 1010 PDF-i + 43 HTML-i**. Pealkirjasiltide võrdlusse lisati veel **13 ettevalmistatud, avaldamata PDF-i**, nagu algses siltide hindamises. Need kaks mõõtmisvalimit pole samad.

| Mõõdik | Tulemus |
|---|---:|
| Muutunud `retrieval_text`-iga dokumendid | 50 |
| Muutunud tükipiiridega dokumendid | 49 |
| Tükid enne → pärast | 20783 → 20495 |
| Dokumendisiseste erinevate tekstide eemaldumisi / lisandumisi | 756 / 483 |
| Tokenid enne → pärast | 12533053 → 12519570 |
| Kontrollitud span'e, PDF + HTML | 564967 |
| PDF-i span'i identiteedi/teksti/lehe/bbox/vahemiku erinevusega dokumente | 0 |
| `source_text !== raw_text.slice(start,end)` | 0 |
| Varem tükeldatud span'e, mida enam tükkides pole | 134, neist 49 uute artiklite algustest — V01 |
| Opuse siltidega valesid pealkirju eemaldatud | 377/389 |
| Opuse siltidega ehtsaid pealkirju kaotatud | 0/42 |
| Küsimuspealkirju kaotatud | 0/743 |
| Liitunud pealkiri+põhitekst: lühendatud / muutmata / pealkirjarollita | 5 / 3 / 6 |
| Muid kadunud/muutunud pealkirju | 28 |

**Sildimõõdikud korduvad, aga sildid ise on Opuse omad, mitte sõltumatu tõde.** V01 artikli algused ei olnud algses pealkirjade valimis, sest neid ei tuvastatud juba v12-s eraldi pealkirjadena. Nii võib `0/42 ehtsat kaotatud` olla aritmeetiliselt õige ja siiski jääda oluline sisukadu märkamata. Kuue liitunud rea pealkirjarolli eemaldamine ei taasta algset kahe veeru lugemisjärjekorda; näiteks Tarkvanema algkoolilapse töölehe lk 1 pealkiri ja kõrvalolev lõik on endiselt läbisegi. Uus reegel vähendab halbu prefikseid, mitte kõiki paigutusprobleeme.

Visuaalselt kontrolliti ka taastatud „Hindamisteema 6 …“ pealkirja PDF lk 51: see on päris mitmerealine pealkiri ja v2 säilitab selle. Tõendid: [kogu mõõtmine](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-prototype-complete.json), [pealkiri lk 51](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-heading-p51.png), [Tarkvanema lk 1](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-tarkvanem-p1.png).

### Metaandmed ja varasemad leiud

- **13 metaandmefaili + üks Tallinna paketiväli:** parandused rakendati ainult auditi eraldatud koopiale ja valmistati v12-ga ette. Kõik etteantud `set`-väärtused jõudsid oodatud väljadesse; metaandmeväljade kinnitused säilisid. V06 jääb lahendamata. Loeti 13 PDF-i paranduste allikakohti, sealhulgas Riigikontrolli esilehed, EPIKoda lk 1–2, HARNO lk 2 ja ajakirja kahe artikli lk 5. See ei tõenda iga dokumendi kõigi ülejäänud väljade õigsust.
- **Tallinn:** kõik **85** kirjet normaliseeriti nii algsest kui ka parandatud paketist. Ühegi kirje `retrieval_text` ei muutunud. Algse ja parandatud URL-i tegelikku HTTP-vastust võrgukeelu tõttu ei kontrollitud.
- **F07 jurisdiktsioon:** vaadati adapteriga läbi kõik 104 registri XML-i ja seoti aktiivse valikuga nii dokumendi ID kui ka allikabaidi räsi järgi. Aktiivseid on **59**: **54 omavalitsuse** ja **5 riigi** akti. Puuduv jurisdiktsioon või omavalitsuse akti puuduv omavalitsuse ID: **0**. Redaktsiooniperekonna ja registri vanade viidete ajaloolised märkused jäävad eraldi teemaks; veebis uusimat kehtivat teksti ei tõendatud.
- **F10 konkreetne OCR-näide:** v12 tuvastab faili `2017_1_Part5.pdf` sektsiooni **„Omavalitsuse abistamiskohustus“**. See varasem üksikleid on suletud. Tõend: [OCR-kontroll](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-ocr-result.json).
- **F16 mahuarvud:** piirid on nüüd 10000 dokumenti / 60000 ühikut ja kogu ostuplaan läbis kontrolli. Opuse külmutatud logi näitab 5985 dokumendi / 29103 ühiku mock-indeksi valmimist; selle teenusekatse tulemust ei nimetata sõltumatult korratuks. Otsingu jõudlus jääb eelkirjeldatud piiranguks.
- **S09 registrivahemälu:** praegune kood jälgib registri ja alusregistrite suurust ning muutmisaega; registrimuutuse test läbis. See parandab v10-s tõendatud tavalise faili uuendamise vea. See ei ole sisuräsipõhine kaitse sama suuruse ja teadlikult taastatud mtime'iga faili vastu.

Tõend: [metaandmete allikaväljavõtted, Tallinna ja XML-i tulemused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-metadata-result.json).

### Testid, kordamine ja piirid

**223 testi läbis, 0 ebaõnnestus, 0 jäeti vahele** käivitatud 32 testifailis. Päris ajakirja vastuvõtukatsed olid samas käivituses lubatud `RAG_V2_INPUT_ROOT` abil. Võrk oli preload-kaitsega blokeeritud, ajavöönd UTC ja testide temp-kaust auditi all. Seitse teenuse-/rakendussõltuvustega unit-faili ja kümme integratsioonifaili ei kuulunud sellesse käivitusse; nende loetelu on kokkuvõttes. Opuse logide 228 unit- ja 56 teenusetesti tulemust ei liideta sõltumatu 223 juurde.

Tõendid: [testilogi](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-unit-tests-verified.txt), [käivitatud/välja jäetud failid](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-test-summary-verified.json), [äärejuhtumite kordused](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/post-v12-repro-result.json).

PowerShellis töökaustast, kasutades juba loodud auditi koopiat:

```powershell
$env:NODE_OPTIONS='--import=file:///C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/offline-guard.mjs'
$env:TZ='UTC'
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/post-v12-plan.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/post-v12-repros.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/post-v12-reference-regression.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/post-v12-prototype.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/post-v12-prototype-complete.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/post-v12-metadata-check.mjs
node tmp/codex-audit/post-v12-run-tests.mjs
```

Abiskriptid kasutavad olemasolevate tõendite kaitseks osaliselt `wx`-kirjutust: korduskatsel tuleb **abiskripti koopias** valida uued väljundnimed ja paranduste kontrollile uus staging-kaust. Olemasolevaid tõendeid, algset korpust ega store'i selleks ei kustutata. `post-v12-prototype.mjs` esmane PDF-lugemise läbimine jätab 43 HTML-i eraldi; järgnev `post-v12-prototype-complete.mjs` töötleb need õige formaadiga ja lisab siltide avaldamata PDF-valimi. Lõplikuks koondiks on `post-v12-prototype-complete.json`, kus töötlemisvigu pole. Algne formaatide eristamise vahetulemus ei ole tootmissüsteemi vealeid.

Katsetamata: päris embeddinguteenuse võrgu- ja arvelduskäitumine, teenustega otsingukatsed, kogu korpuse päringukvaliteet ning kõigi PDF-lehtede visuaalne kontroll. Kood, korpus ja prototüübid jäid muutmata. Järgnev varasem audit on säilitatud tõendite ja failikaardi jaoks; selle „praegune seis“ tähendab v10 etappi ning uuema otsuse jaoks tuleb kasutada ülaltoodut.

---

## Ajalooline v10 audit ja algne failikaart


Kuupäev: 2026-09-25. Töökaust: `C:\Users\rauds\Desktop\Sotsiaal.ee`.

**Kõik failikaardi 211 süsteemifaili on läbi loetud. Koguvaliku embeddingute ostuks ei ole süsteem veel valmis:** alles on koguindeksi mahupiir, valitud allikate metaandmekonfliktid ja osa õigusaktide puuduv jurisdiktsioon. Ühes OCR-artiklis jääb sisuline vahepealkiri tuvastamata. Auditi ajal väliselt lisandunud parandused lahendasid varem leitud olulise PDF-sisukao, ostueelse mahukontrolli puudumise, avatud kehtivusvahemiku filtri ja mitu muud viga. Neid ei esitata allpool enam lahtiste vigadena.

Audit oli ainult lugemine ja analüüs. Koodi, korpust, konfiguratsiooni ega olemasolevat store'i ei muudetud. Ei tehtud mudeli-, embeddingu- ega võrgukutseid, ei loetud saladusi ega tootmiskasutajate sisu. Ei käivitatud keelatud CLI-režiime ega Git-i muutvaid käske. Ainus mitteajutine väljund on käesolev raport; koopiad, sünteetilised katsed ja tõendid asuvad `tmp/codex-audit/`.

## Ulatus ja kontrollitud koodiseis

HEAD: `5ab30c02d874a1524074e04c19f09331e2d863c9`. Viimane külmutatud koodikoopia on **08:06:56 UTC**, `final-review-source`; normaliseerimine `source-structure-v10`, tükeldamine `structure-blocks-v4`. Selles on 23 HEAD-ist erinevat jälgitavat faili ja kuus uut RAG-faili. Muudatused tulid auditi ajal välisest tööst. Lisaks kontrolliti varem kaardistamata jagatud sõltuvust `lib/rag/sourceMetadata.js`.

| Failirühm | Arv | Läbivaatus |
|---|---:|---|
| `lib/rag-v2/` | 90 | Kõik lähte-, konfiguratsiooni- ja vendor-failid |
| `prisma/rag-v2/` | 8 | Skeem, seadistus, migratsioonid ja lukk |
| RAG v2 skriptid | 19 | Kõik kaardistatud CLI-d ja abifailid |
| Rakenduse ja jagatud integratsioonid | 45 | API-d, admin, piloot, vestlus, säilitus, juurutus ja jagatud sõltuvused |
| RAG v2 testifailid | 49 | Kõik testifailid loetud; käivitamise piirid allpool |
| **Kokku** | **211** | Täielik staatiline läbivaatus kaardistatud ulatuses |

Läbi loeti ka seni osaliselt kontrollitud **kogu** `prisma/schema.prisma` (7996 rida), `useChatStream.js`, `retention.js`, `deploy-server.mjs`, `sourceFreshness.js` ja neli genereeritud Snowballi algoritmifaili. Muutunud failidele lisandus külmutatud koopiate vaheline diffi ülevaatus. Lugemisvahemike ühendamisel ei jäänud varasema 204 faili seas katmata ridu; seitse lisandunud faili loeti täielikult. Täpsed räsid ja kontrolliviis: [211 faili manifest](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/final-review-manifest.json), [läbivaatuse register](C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/final-review-coverage.json).

„Kõik” tähendab raporti lõpus nimetatud RAG v2 süsteemifaile ja leitud integratsioone. See ei tähenda kogu ülejäänud Sotsiaal.ee rakenduse või `node_modules` auditit, kõigi PDF-lehtede visuaalset kontrolli ega iga koodiraja käivitamist. Snowballi lähtekood loeti; algoritmide formaalset tõestust ega sõltuvuste võrgust päritolu kontrolli ei tehtud.

## Parandada enne embeddinguid

P1 tähistab kogu kavandatud valiku kasutuselevõttu takistavat puudust; P2 piiratud ja korratavat kvaliteedi- või lepinguprobleemi. Järgnevad leiud kehtivad viimases koopias. Ajaloolised leiud ja nende algsed kordused on raporti lõpuosas eraldi.

### F16 — P1: kogu korpus ei mahu ühe indeksi dokumentide ja tükkide piiridesse

**Koht:** `lib/rag-v2/search/capacity.js:6`, `search/multi-source-plan.js:35`, `search/index-jobs.js:28`, `search/indexing.js:50`.

Üks generatsioon lubab **1000 dokumenti ja 5000 tükki**. Värske `selection-v10-*` valik sisaldab 5999 dokumenti. KOV-is on neist 4874 dokumenti / 4879 tükki, XML-is 59 dokumenti / 3442 tükki. KOV ületab üksi dokumendipiiri; KOV ja XML koos annavad juba 8321 tükki. Väiksemad ingest-batch'id ei tühista kogu aktiivse indeksi piiri.

**Kordamine:** `final-review-capacity.mjs` valmistab mälus 5001 sünteetilist JSON-kirjet. Nii ostuplaan kui ka indekseerimine tagastavad nüüd `local_index_limit`; embeddingu- ja salvestusadapteri kutseid 0. `final-review-selection.json` seob tegelike valikute kirjed uuesti mõõdetud tulemustega. Korpus valikute sees ei ole sünteetiline.

**Parandus:** määrata, kuidas kogu soovitud aktiivne korpus indekseeritakse, ning tõendada kavandatud maht, jätkamine ja avaldamine kohalike adapteritega. Piiri tõstmine peab käima koos mahu/taastumise kontrolliga. Ostueelne kaitse on parandatud (S02 suletud); avaldatava koguindeksi piirang on alles. **Embeddingumõju:** piirimuutus üksi teksti ei muuda, kuid kasutamatu koguvaliku ostu ei tasu teha.

### F14 — P2: värske valik sisaldab endiselt review'd blokeerivaid metaandmekonflikte

**Koht:** `lib/rag-v2/metadata-adapter.js:40`, `:59`; `normalize.js:98`; `ingest-publication.js:36`. Failid ja konfliktiväljad on `final-review-selection.json.categories` all.

Värskes valikus on **9 konfliktiga juhendit 174-st ja 1 KOV-kirje 4874-st**. Näiteks `paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf.pdf` puhul `collection_id`; `tarkvanem_tooleht_abikusimused_vestluseks_algkoolilapsega.pdf` puhul `source_type` ning `collection_id`. Viiel OCR-voldikul on URL-kandidaatide konflikt. Tallinna kirjel `tallinn_service_oigusnoustamine_vahekindlustatud_tallinna_elanikele` lõpevad kaks URL-i erinevalt: `...elanikule` / `...elanikele`.

**Kordamine:** `final-review-metadata.mjs` → konfliktikandidaadid koos päritoluga; `final-review-corpus.mjs` → KOV-i päris normaliseerimise hoiatus; `final-review-selection.mjs` → konfliktide jäämine v10 valikusse. Juhendite konfliktikandidaadid kontrolliti kõigil 185 metaandmekomplektil; kõigi nende PDF-ide uut täis-normaliseerimist lõppkoopiaga ei käivitatud. `metadata_candidate_conflict` blokeerib edukalt ettevalmistatud dokumendi review'd koodi järgi.

**Parandus:** lahendada vastuolud allika ja väljade rolli järgi, säilitades alternatiivide päritolu. Ära kõrvalda kontrolli lihtsalt hoiatuse kustutamisega. Ajakirja joonealuse kuupäeva valepositiiv on nüüd parandatud, kuid veebis esmaavaldamise ja väljaandeaasta rollid tuleb endiselt eristada. **Embeddingumõju:** URL või kogumisstaatus üksi ei nõua uusi vektoreid; pealkirja, dokumendi identiteeti või prefiksisse minevat väljaandjat muutev otsus tuleb teha enne vastava dokumendi ostu.

### F07 — P2: õigusaktide jurisdiktsiooni ja redaktsioonide sidumine on osaline

**Koht:** `lib/rag-v2/registered-source.js:10`, `:44`; `lib/rag-v2/text-source.js:228` XML-metaandmete projektsioon; `Andmebaasi/register/kov_oigusaktid.json`. Konkreetne aktiivse valiku näide: `oigusaktid/417092025025.xml`, väljaandja **Raasiku Vallavolikogu**.

Uus räsi järgi registriga sidumine annab 104 XML-i hulgas **78-le omavalitsuse ID, jurisdiktsiooni ja riigi**, neist 76 on sisuga dokumendid. V10 valiku 59 sisuga XML-ist puudub jurisdiktsiooni tase **13-l**: kaheksal Raasiku/Tallinna kohaliku väljaandjaga aktil ja viiel riigi tasandi väljaandjaga aktil. Omavalitsuse ID puudumine riigi seadusel pole iseenesest viga; riigi tasandi jurisdiktsioon tuleb siiski selgelt modelleerida. Kõik 59 läbivad kohaliku kuupäevafiltri `2026-09-25`, kuid see ei tõenda veebis uusima redaktsiooni olemasolu.

Kohalikus õigusaktide registris jäävad alles algselt leitud 12 vana `act_reference` väärtust, sh Järva `407042026033.xml` / registri vana `404092025027`. Adapter võtab identiteedi XML-ist õigesti. XML-i `terviktekstiGrupiID`, `tekstiliik` ja `dokumentVersioon` pole endiselt terviklik redaktsiooniperekonna mudel. V10 valik jätab aegunud redaktsioonid ja kaks sisutühja „Kehtetu” kirjet välja; algse F07 väide kõigi XML-ide puuduvast jurisdiktsioonist on aegunud.

**Kordamine:** `final-review-metadata.mjs` ja `final-review-selection.mjs`; viimase `missing_jurisdiction` loetleb kõik 13 faili. Algne registri/XML-ID võrdlus on `supplement.json`. **Parandus:** täiendada kontrollitud registriseoseid kõigile kohalikele aktidele, modelleerida riigi jurisdiktsioon ja redaktsiooniperekond, säilitada ajaloo-/kehtetuks muutumise seosed. **Embeddingumõju:** filtrivälju saab rikastada vektoreid muutmata; jurisdiktsiooni või redaktsiooni lisamine `retrieval_text`-i muudab sisendi.

### F10 — P2: OCR-i sisuline vahepealkiri jääb sektsiooniks tuvastamata

**Koht:** `lib/rag-v2/parser.js:218`, `:256`; dokument `kov-valjakutsed-teenused-2017-1`, `Andmebaasi/ajakiri_sotsiaaltoo/17-1/2017_1_Part5.pdf`, PDF lk 1 / trükitud lk 12.

„Omavalitsuse” ja „abistamiskohustus” on kaks säilinud span'i samas põhitekstiplokis, bbox-id vastavalt `[71.72,234.55,147.91706,244.07]` ja `[72,223.98,178.34925,231.07]`. Dokumendi ainsaks nimetatud sektsiooniks jääb artikli pealkiri. Sõnad ei kao, kuid sektsiooniprefiks ja tükipiir ei järgi nähtavat vahepealkirja. Autorinime „Krõõt Kroonmäe” varasem valepositiiv on seevastu parandatud.

**Kordamine:** `final-review-pdf-recheck.mjs`, vastava struktuuriväljavõtte `sections` ja kaks span'i; algses auditis võrreldi lehte ka visuaalselt. **Parandus:** hinnata OCR-pealkirja mitme rea geomeetria ja järgneva lõigu järgi, säilitades autorinimede vastunäite. **Embeddingumõju:** parandatud sektsioon ja võimalikud uued piirid muudavad selle dokumendi sisendit. Üksikjuhtumi tõttu ei pea blokeerima üle vaadatud sõltumatuid dokumente; selle dokumendi puhul tuleb enne ostu parandada või piirang teadlikult fikseerida.

## Võib hiljem

### S09 — P2: registri vahemälu ei märka samas protsessis muudetud registrit

**Koht:** `lib/rag-v2/registered-source.js:10`–`:26`. Kausta tee järgi talletatud `municipalities` kaart ei sõltu `REGISTER.json` ega alusregistri räsist. Korduv kutse tagastab vana omavalitsuse ka pärast mõlema registri korrektset uuendamist; teisel lugemisel ei kontrollita enam registriräsi.

**Kordamine:** `final-review-register-cache.mjs` kasutab ainult uut sünteetilist registrikausta auditi tmp all ja ühe kohaliku XML-i koopiat. Esimene omavalitsus `synthetic_a`; registri ning selle kontrollräsi muutmise järel sama protsessi tulemus endiselt `synthetic_a`; sama füüsilise kausta teise, lõpus eraldajaga võtme korral `synthetic_b`. Tulemus on `final-review-register-cache.json`.

**Parandus:** siduda vahemälu külmutatud registri sisuräsiga või anda muutumatu registrikaart impordisessioonile ette. Puuduva/loetamatu registri tühja tulemust ei tohiks lõputult vahemällu jätta. Muutumatu registriga ühekordne CLI-import pole selle katse põhjal katki. Selle saab lükata edasi, kui ostuvalik ja register on protsessi ajaks külmutatud. **Embeddingumõju:** vahemälu parandus iseenesest ei muuda korrektseid vektoreid; vana jurisdiktsiooniga teksti korral tuleb sisendit võrrelda.

Hilisemaks sobib ka metaandmete rikastamine, mis jääb `retrieval_text`-ist välja: kontrollikuupäevad, õiguste päritolu, väljaandja sõlmed, teenuste ja kontaktide seosed, ajalooliste redaktsioonide graaf. Igal seosel peab säilima allikatõend ja kontrolliseis. Filtrite, leksikaalse indeksi või järjestuse muutus ei nõua sama embeddinguteksti puhul uut ostu.

## Paranduste kinnitatud seis

| Leid | Viimase koopia tulemus |
|---|---|
| S01 | Selle muudatuse jaoks parandatud: v10/v4 versioonitõstmine, töötluse sisuräsi manifest ja läbiv fingerprint-test. Vahemälu ei seo koodi automaatselt versiooni-ID-sse; edasine semantiline muudatus vajab endiselt versioonitõstet. |
| S02 | Parandatud: ühine mahukontroll peatab 5001 tüki plaani enne adaptereid ja kulureservatsiooni. Koguindeksi mahupiir jääb F16-na alles. |
| S03 | Parandatud: XML-ist tõendatud avatud lõpp säilib; 70 lõputa sisuga faili ei kao enam. Vahekoopias tekkinud puuduva `valid_to` TypeError parandati enne lõppkoopiat. |
| S04 | Parandatud koodis ja kohalikes lepingutestides: admin seob indeksi leksikaalse konfiguratsiooni retrieval-profiiliga enne ostu. Tegeliku EstNLTK teenuse töövalmidus on NOT_PROVEN. |
| S05 | Võrdlus-CLI kontrollib nüüd kasutatavat profiili; teiste ühilduvus raporteeritakse. CLI päris indeksi vastu ei käivitatud. |
| S06 | Vestluse/sisendi signatuur ja hilinenud vastuse kaitse lisatud; komponendi tegelikke funktsioonikehi käivitavad testid läbivad. Brauseri E2E on NOT_PROVEN. |
| S07 | Parandatud: „Ohumärkide plaan…” lk 5 kõrvalveeru põhitekst säilib; siht-PDF-is nüüd 8 tükki. Varasema 17 rea kao leid ei kehti lõppkoopiale. |
| F01–F04 | Kontrollitud HTML-vastunäited, OCR-sõnavahed, tsitaadikoopiad ja sihtlehtede lugemisjärjekorra parandused läbivad. See pole kõigi korpuse tabelite semantiline tõestus. |
| F05 | Kõik 4876 KOV-kirjet uuesti normaliseeritud: 4881 tükki, 0 record_key segamist ja 0 ainult tehnilistest ankrutest koosnevat tükki. |
| F06 | Algvalikus endiselt konfliktid; värske v10 valik on dokumendi-ID järgi duplikaatideta: 174 juhendit ja 59 XML-i. Kogu 185 juhendi lugemine avastas lisaks varasemale seitsmele paarile ka suure aastaraamatu paari: kokku 8 juhendi- ja 13 XML-paari. |
| F07 | Osaline parandus; täpne allesjäänud ulatus eespool. |
| F08–F09 | Konkreetne glüüfide kirjavahemärgikadu parandatud. 7 siht-PDF-i 7853 span'il 0 allikalõike- ja 0 bbox-viga. |
| F10 | Autorinime ja pikalt suures kirjas põhiteksti valepositiivid parandatud; OCR-vahepealkiri eespool alles. |
| F11 | 100/200 euro servarea ja COVID-19 pealkirja sünteetilised vastunäited enam ei kordu. Kõigi pööratud servaridade sisu pole uuesti käsitsi hinnatud. |
| F12 | Mõlemad varem näidatud leksikaalsed sidekriipsud säilivad: `järk-järgult` ja `step-by-step`. Kolme algustähe heuristika üldist keelelist täpsust korpuses ei mõõdetud. |
| F13 | XML-i peatüki-/paragrahvihierarhia taastatud; kõik 102 sisuga XML-i uuesti parsitud. |
| F14–F16 | Allesjäänud ulatus on eespool ja mõõtmiste piirangutes. V10 valik välistab 7 OCR-iga asendatud originaali, 3 osalise tekstiga juhendit ja 1 vanema aastaraamatukoopia. Selle välistamisotsuse kõiki PDF-põhjuseid sõltumatult uuesti ei parsitud. |

Ka `artifact-provenance.js` sisaldab nüüd commit'imata diffi ja uute failide sisuräsi; varasem pelga status-teksti tõend on täiendatud.

## Mõõdikud ja piirangud

| Kontroll | Viimase kontrolli tulemus | Tõend `tmp/codex-audit/` all |
|---|---|---|
| Staatiline süsteemiülevaatus | 211 faili; kaardistatud failide seas katmata lugemisvahemikke 0 | `final-review-coverage.json` |
| 32 kohalikku testifaili | 211 testi: **197 läbitud, 0 sisulist tõrget, 14 vahele jäetud** | `final-review-unit-tests-verified.txt`, `final-review-four-tests.txt` |
| 7 päris siht-PDF-i | 214 lehte, 7853 span'i, 300 tükki; allikalõike- ja bbox-vigu 0 | `final-review-pdf-results.json` |
| Kõik 4876 KOV-kirjet | 4881 tükki / 962 367 tokenit; 793 alla 300 märgi; 1 konflikt | `final-review-corpus.json` |
| Kõik 104 XML-i | 102 sisuga tulemust / 6593 tükki / 2 255 528 tokenit; 2 „Kehtetu” sisutühja kirjet | sama |
| KOV/XML allikakohad | 0 ebatäpset raw_text viilu, 0 record_key piiri segamist, 0 ainult ankrutest tükki | sama |
| Kogu registri terviklus | 2529 kirjet, 0 puuduvat faili ja 0 registriräsi erinevust | `final-review-metadata.json` |
| V10 valik | 892 ajakirjaallikat, 174 juhendit, 59 XML-i, 4874 KOV-kirjet; ID-duplikaate 0 | `final-review-selection.json` |
| V10 XML / KOV | XML 3442 tükki / 1 193 707 tokenit; KOV 4879 tükki / 961 976 tokenit | sama, arvutatud täisnormaliseerimise tulemustest |

211 testi tulemus on kahe jooksu ühendatud lõppseis, mitte kattuvate testide summa: külmutatud kaustast läbis 193 testi, neli ebaõnnestusid ainult puuduva `lib/auth` manifestikataloogi tõttu ja läbivad töökausta juurelt kordamise. Esimene käivituskatse kasutas Windowsi failitee asemel valet ESM-impordi kuju; see auditi käivitaja viga ei ole tooteleid. Neli parandatud asukohaga testi loevad rakenduse teostusmanifesti päris tööjuurelt. 14 skip'i vajavad eraldi `RAG_V2_INPUT_ROOT` näidisvara ja neid ei loeta läbituks.

Kümmet integratsioonitestifaili ning seitset andmebaasi/HTTP/eravara või sobimatu kirjutuskohaga testifaili ei käivitatud. Täpsed nimed on `final-review-test-summary-verified.json` all. Tegelik PostgreSQL, Qdrant, EstNLTK pakett/teenus, serveri õigused, brauseri E2E, väliste URL-ide sisu, tootmisindeks ja mudeli vastuse sisuline kvaliteet on **NOT_PROVEN**. Tasuline mudelitest ei ole auditi lõpetamise nõue.

Kogu ajakirja 892 allika (849 PDF + 43 HTML) ja kõigi juhendite algsed täiskorpuse mõõtmised on ajaloolises osas. Viimase parseriga korrati seitset olulist PDF-vastunäidet ning kogu XML/KOV-parsimist, mitte kõigi PDF-ide täisjooksu. Algne deterministlik juhuvalim: 12 PDF-i; koos sihtjuhtudega 20 struktuuriväljavõtet, visuaalselt 11 lehekülge 8 dokumendist. Viimase koopia PDF-testi pealkiri tuleb registrikirjest; sellest ei tuletata koguvaliku ostuplaani. Tokenid loeti lokaalselt `cl100k_base` abil tegelikust retrieval-tekstist; arvud ei võrdu automaatselt unikaalsete ostetavate sisendite arvuga.

KOV/XML täisnormaliseerimine kestis ligikaudu 51,4 sekundit, 7 PDF-i korduskontroll ligikaudu 4,5 sekundit; need on ühe kohaliku jooksu kestused, mitte tootmise jõudlusgarantii. Maksimaalset lubatud koormust, taastumist katkenud päris indekseerimisel ja DB-võistlusolukordi ei tõendatud. Täpne allikaviil tõendab koordinaadilepingut; see ei tõenda, et kogu nähtav tekst või tabeli semantika on säilinud.

## Metaandmed ja GraphRAG: viimane seis

Järgnev tabel mõõdab välja olemasolu adapteri väljundis, mitte sisulist õigsust. Viimases mõõtmises olid loetavad kõik 185 juhendi metaandmekomplekti.

| Väli | Ajakiri / 892 | Juhendid / 185 | XML / 104 | KOV / 4876 |
|---|---:|---:|---:|---:|
| Autorid | 879 | 2 | 0 | 0 |
| Avaldamiskuupäev | 44 | 5 | 104 | 0 |
| Väljaandja/asutus | 46 | 177 | 104 | 4876 |
| Allika URL | 54 | 182 | 104 | 4299 |
| Jurisdiktsiooni tase | 0 | 171 | 78 | 0 |
| Omavalitsuse ID | 0 | 0 | 78 | 4876 |
| Riik | 0 | 171 | 78 | 0 |
| Sihtrühm | 892 | 185 | 0 | 4876 |
| Viimati kontrollitud | 2 | 171 | 0 | 4876 |
| Õiguste iga kontrollitud väli | 0 | 8 | 0 | 0 |

Dokumendi liik on endiselt ajakirja 849 PDF-il `file` ja 43 HTML-il `web`; need kirjeldavad kandjat, mitte artikli rolli. Vajalik on eraldi sisuline dokumendiliik ning kanoniseeritud väljaandja ID. Teenuse/toetuse/kontakti/vormi liigid ja `structured_record` on KOV-adapteris olemas. 808 kontaktikirjel ei leitud kontrollitud `phone`/`email`/`registry_binding` välju; 0 katkist kontrollitud `relatedContacts`/`relatedForms`/`relatedTo` ID-viidet ei tõenda kontakti sisulist täielikkust.

GraphRAG-i jaoks tuleb hoida eraldi väljaande/veebis avaldamise kuupäev, kirjeldatud periood, redaktsiooni kehtivus, kogumisaeg ja viimase kontrolli aeg. Vajalikud on omavalitsuse ning väljaandja stabiilsed ID-d, teenuse liik, sihtrühma sõnastik, keel, kanooniline URL, õiguste päritolu ning väite/seose täpne allikakoht. Keel `et` ei tõenda keele sisulist kontrolli. Õiguste tundmatut väärtust ei tohiks käsitleda antud loana; käesolev audit ei otsusta teoste kasutusõigust. Täiendused kuuluvad profiili/adapterisse, mitte dokumendi-ID järgi tehtavatesse GraphRAG-tuuma eranditesse.

## Mis võib nõuda uut embeddingut?

Viimase `chunking.js:101` sisend on sisuliselt `[retrieval_context >] pealkiri > sektsioon\n\nkeha`; korduv pealkiri ja ankrud võivad kehast välja jääda, poolitused liidetakse. `text-embedding-3-large` / 3072 on koodis määratud konfiguratsioon, mitte auditis kasutatud teenus.

Enne ostu külmutada kanooniline allikavalik, lähte- ja metaandmeräsid, pealkiri/jurisdiktsiooniprefiks, parseri/glüüfide tulemused, eemaldusreeglid, veerujärjekord, JSON-i tekstiprojektsioon, sektsioonid, tüki suurus/piirid, poolitused, normaliseerimise ja chunking'u versioon ning domeeniprofiil. `processing-implementation.json` katab koodi; andmevaliku ja profiili päritolu tuleb siduda eraldi. Testivärav juhib versioonitõstet, kuid sama versioonisildi all vahetatud parseri tulemuse sünteetiline katse näitab endiselt vana versiooni taaskasutust. See on põhjus versioonilepingut järgida.

V10/v4 tuleb uuesti ette valmistada eraldi muutumatu versioonina; auditis korpuse store'i seda ei kirjutatud. Vektorite taaskasutus peab põhinema tegelikul sisenditekstil ja embeddingu konfiguratsioonil, mitte vanal dokumendi- või Git-ID-l. Puhas bbox-/filtri-/järjestusemuudatus ei vaja uut vektorit, kui tekst jääb täpselt samaks. Kõigi metaandmete lõplik rikastamine pole ostu eeltingimus, kui need ei lähe teksti ja vajalikud review/õiguste eeldused on lahendatud.

## Kontrollide kordamine

Käivitada töökausta juurelt, kasutades juba külmutatud lähtekoopiaid. Capture-skripte pole vaja uuesti käivitada. Väljundid kirjutada uude auditi alamkausta.

```powershell
$env:TZ = 'UTC'
$env:NODE_OPTIONS = '--import=file:///C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/offline-guard.mjs'
$env:TEMP = Join-Path (Get-Location) 'tmp/codex-audit'
$env:TMP = $env:TEMP
$auditRepeat = Join-Path 'tmp/codex-audit' ('repeat-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $auditRepeat | Out-Null
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-review-reproductions.mjs "$auditRepeat/reproductions.json"
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-review-pdf-recheck.mjs "$auditRepeat/pdf.json" $auditRepeat
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-review-corpus.mjs "$auditRepeat/corpus.json"
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-review-metadata.mjs "$auditRepeat/metadata.json"
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-review-capacity.mjs "$auditRepeat/capacity.json"
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-review-register-cache.mjs "$auditRepeat/cache.json"
```

`final-review-capacity.mjs`-i ostueelse piiri kordamisel kasutada `capacity` tulemust. Selle vanast abiskriptist säilinud toorväljade kehtivuse/profiili vastunäited **ei** läbi parandatud XML-normaliseerimist ega admini profiilisidumist ja pole nende paranduste ümberlükkamine. Päris XML-kehtivuse tõend on `final-review-corpus.json`, admini profiili tõend vastav lepingutest ning koodirada.

Testikäivitaja `final-review-run-tests.mjs` salvestab täpsed 32 faili, eemaldab mudeli/DB konfiguratsiooni keskkonnast, seab UTC ja piirab kirjutamise auditi tmp-kausta. Kordamisel valida logidele uued nimed (`wx` väldib seniste tõendite ülekirjutamist). Nelja manifestitesti täpne asukohaparandusega käsk on `final-review-followup.mjs` lõpus. Protsessisisene võrgukaitse pärandub PDF-worker'ile; see ei ole operatsioonisüsteemi liivakast.

## Lõppkontroll

2026-09-25T08:22:57.588Z kontrollis vastasid kõik **211 süsteemifaili** auditeeritud räsidele ja kõik **9 v10 valiku-/otsusefaili** salvestatud valikuräsidele (valik fikseeriti 2026-09-25T08:17:02.430Z). HEAD säilis. Store'i **7136 faili teede, suuruste ja muutmisaegade inventuur ei muutunud**. See on inventuurivõrdlus, mitte kõigi store'i failide uus sisuräsimine. Auditi kirjutusrada oli piiratud tmp-kausta ning käesoleva raportiga. git diff --check läbis. Tõend: tmp/codex-audit/final-review-verification.json. Hilisemad välised muudatused jäävad selle kontrollaja piirist välja.


## Ajalooline lisa A: algse korpusejooksu tõendid

Järgnevad arvud ja F-leiud kirjeldavad **algset v9/v3 koodiseisu**. Need säilivad kordamise ja muudatuste põhjenduste jaoks. Neid ei tohi tõlgendada lõppkoopia lahtiste leidudena; kehtiv seis on raporti alguses. Ka selle lisa lõppkontroll on ajalooline.

### Ulatus ja piirangud

- Aluseks oli `HEAD` **`5ab30c02d874a1524074e04c19f09331e2d863c9`** ja selle suhtes kaheksa faili commit'imata muudatused: `pdf-layout.js`, `parser.js`, `pdf-worker.js`, `chunking.js`, `normalize.js`, `contracts.js`, `types.d.ts` ning `tests/rag-v2-source-structure.test.mjs`. Muutunud versioonid: `source-structure-v9`, `structure-blocks-v3`; embeddingusisendi versioon jäi `title-section-text-v1`.
- Vaadati ka nende otseseid sõltuvusi: HTML/XML/JSON parser, kohalik registriadapter, metaandmete adapter ja väärtused, batch'i identiteet/review ning embeddingusisendi ja indeksi piirangud. Muutumata koodis leitud probleemid on allpool eristatud regressioonidest.
- Olemasolevaid faile ega store'i ei muudetud; koodi ei parandatud. Ei käivitatud ingest'i enqueue/run/publish'i ega `scripts/rag-v2-index-batch.mjs`-i. Ei tehtud commit'i, push'i, stash'i, checkout'i ega reset'i.
- Kõik kontrollid olid kohalikud. Mudeli-, embeddingu- ja võrgukutseid ei tehtud. `.env`-faile, võtmeid, ühendusstringe ega tootmiskasutajate andmeid ei loetud. PDF-id renderdati kohaliku Poppleriga. Analüüsis kasutati ainult antud korpust ja kohalikku lähtekoodi.
- Abifailid ja tõendid asuvad `tmp/codex-audit/`. Node'i auditikäivitustel kasutati `offline-guard.mjs`-i, mis blokeerib võrguliidesed ja lubab failikirjutused ainult sellesse kausta; kaitse pärandub PDF-worker'ile. See on protsessisisene kaitse, mitte operatsioonisüsteemi liivakast.
- Review-blokeeringute arvud on arvutatud praeguse `normalize`-väljundi ja `ingest-publication.js:36` reegli järgi. Need **ei ole** andmebaasist loetud review-otsused. Serveri, `origin/main`-i, avaldatud indeksi, URL-ide praeguse sisu ja ostetud vektorite seis on `NOT_PROVEN`.

### Mõõdetud seis

`Andmebaasi/REGISTER.json` sisaldab 2529 kirjet. Kõigi viidatud failide olemasolu ja registris olev SHA-256 kontrolliti: **0 puuduvat faili, 0 räsierinevust**. Kõik valikufailide kirjed leidsid registrivaste. Baitide terviklus ei tõenda metaandmete sisulist õigsust.

Ajakirja 892 allikat on tegelikult **849 PDF-i ja 43 HTML-faili**. Varasemas store'is on samuti 892 versiooni, mitte 892 PDF-versiooni. Juhendite valikus on 185 PDF-i, õigusaktide valikus 104 XML-faili ning KOV-i 78 paketis 4876 kirjet. Registri organisatsiooniallikas jäi selle ülesande kategooriatest välja.

| Valik | Läbitud normaliseerimine mälus | Vead enne lõpptulemust | Review'd blokeeriva hoiatusega tulemus | Tükke | Embeddingusisendi tokeneid |
|---|---:|---|---:|---:|---:|
| Ajakiri: 892 PDF/HTML-allikat | 892 | 0 | 3 | 8109 | 4 658 642 |
| Juhendid/uuringud: 185 PDF-i | 131 | 42 `partial_text_needs_review`, 7 `needs_ocr`, 4 `page_limit`, 1 `input_size_limit` | 124 / 131 | 7598 | 4 863 883 |
| Õigusaktid: 104 XML-faili | 102 | 2 `source_text_empty` | 0 / 102 | 6698 | Ei mõõdetud |
| KOV: 4876 kirjet | 4876 | 0 | 1 | 51 857 | 2 504 177 |

Arvud sisaldavad praeguse valiku duplikaate ning hoiatusi, mitte ainult avaldamiseks sobivat sisu. Need pole ostuplaan. Tokenid loeti kohaliku `js-tiktoken@1.0.21/cl100k_base` abil, kasutades tegelikku `retrieval_text`-i. Ajakirja suurim sisend oli 1017 ja juhendite suurim 4251 tokenit; neis kahes valikus ei ületatud 8191 tokeni piiri. Läbitud tulemus ei tähenda sisuliselt korrektset teksti.

PDF-ide eraldi struktuurikontroll andis järgmise tulemuse:

| Kontroll | Ajakirja PDF-id | Juhendite PDF-id |
|---|---:|---:|
| Edukalt parsitud PDF-e | 849 | 132 |
| Kontrollitud span'e | 257 197 | 194 783 |
| `source_text !== raw_text.slice(start,end)` | 0 | 0 |
| Span'e, mille bbox ei kata tekstielementide kastide liitu üle 0,5 pt tolerantsiga | 9255 | 9768 |
| Selliseid dokumente | 506 | 102 |
| Üle 2200 märgi pikkuseid `source_text`-tükke | 0 | 0 |

Juhendite eraldi PDF-kontroll luges ühe üle 20 MiB faili otse parserisse; päris registritee peatab selle varem. Seetõttu on siin 132, lõpptabelis 131. Ajakirja üldine `pdf-details.mjs journal` proovib ka 43 HTML-faili PDF-ina; selle abiskripti need vead jäeti PDF-mõõdikutest välja. Kõik 43 HTML-faili kontrolliti seejärel õige parseriga: **513 tükki, 299 745 tokenit, 0 tühja tulemust ja 0 tekstivahemiku viga**.

Kogu ajakirja PDF-valiku mõõdikud (`corpus-summary.json`):

- 4247 lehekülge: 940 ühe-, 3273 kahe- ja 34 kolmeveeruliseks hinnatud lehte.
- Eemaldati 8121 `repeated_margin`, 3284 `page_mark`, 2932 `repeated_pull_quote` ja 337 `rotated_margin` rida.
- 7596 PDF-tükki; neist 492 ehk 6,5% alla 300 märgi. Pikkuste p10/mediaan/p90: **629 / 1485 / 2013** märki; maksimum 2200.
- 771 tüki lõpp ehk 10,2% märgiti lause keskel lõppevaks. See on kirjavahemärgiheuristik, mitte käsitsi kinnitatud vigade määr; ka puuduvad lauselõpupunktid mõjutavad seda.
- Lugemisjärjekorra heuristik leidis 5274 kahtlast üleminekut 37 479-st; 151 dokumendil ületas osakaal 20%. **14,1% ei ole tõendatud vales järjekorras teksti osakaal.** Mõõdik aitas valida kontrolljuhtumeid.
- Taastati 28 131 glüüfi 230 dokumendis. Tükkides oli 0 U+FFFD märki, kuid 42 muud juhtmärki. U+FFFD puudumine ei tõenda kirjavahemärkide säilimist.
- Viiteloendiks klassifitseeritud sektsioonidest tuli 0 tükki. See mõõdab filtri rakendumist, mitte klassifikatsiooni õigsust; leid F01 näitab ekslikku välistamist.

Valim: 12 ajakirja PDF-i valiti deterministlikult SHA-256 järjestusega `2026-09-25:` + registritee; lisati sihtjuhud, kokku **20 täielikku struktuuriväljavõtet**. Loeti juhuvalimi otsingutekste ning halvimate juhtude eemaldusi/sektsioone. Visuaalselt võrreldi **11 lehekülge kaheksast dokumendist**; kõiki korpuse lehti käsitsi ei kontrollitud. PDF-lehekülg tähendab allpool alati faili 1-põhist lehekülge; trükitud leheküljenumber on eraldi sulgudes.

### Algse jooksu ostueelsed leiud

Raskused: **P1** = sisukadu, tähenduse segamine või kogu ostuvalikut puudutav oluline takistus; **P2** = konkreetne kvaliteedi-/lepinguvea või valiku korrastamise vajadus. See pole turvaskanni raskusskaala. Failiread viitavad auditeeritud töökoopiale.

### F01 — P1: viiteloendi tuvastus eemaldab päris põhiteksti

**Koht:** `lib/rag-v2/chunking.js:6`, `chunking.js:95`, `parser.js:185`. **Uus regressioon.**

Regexi esimene alternatiiv pole lõpust ankurdatud. `Kasutatud kirjandusest ja intervjuudest` vastab algusele `kasutatud kirjandus`. Parser nimetab selle rea pealkirjaks sõltumata fondist; chunker jätab kogu järgneva sektsiooni välja.

**Päris tõend:** `Andmebaasi/ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part12.pdf`, „Ohumärkide plaan ja kriisikaart vaimse tervise raskustega inimestele”, PDF lk 4–5 (lk 56–57). Lk 4 on nimetatud rida tavalise lõigu algus. Valesti tekkinud sektsioon sisaldab **89 span'i / 3701 märki**, mis ei jõua tükkidesse kuni järgmise pealkirjani „Lõpetuseks”. Sisu käsitleb plaani koostamist, mitte bibliograafiat. HEAD-i parseri/chunker'i kohalik võrdlus säilitas selle sisu.

**Mitte-PDF regressioon:** HTML `<h1>Kasutatud allikad toetuse määramisel</h1><p>Teenuse saamiseks tuleb esitada avaldus kohalikule omavalitsusele.</p>` annab kaks span'i, kuid **null tükki**. `Allikad` annab sama tulemuse; `Kirjandus:` seevastu ei rakenda chunker'i filtrit, kuigi PDF-pealkirjatuvastus eemaldab enne võrdlust kooloni. Sektsiooninime järgi kustutamine on liiga lai ja eri kohtades ebaühtlane.

**Korrata:** `reproductions.mjs` → võtmed `html_reference_*`; `pdf-details.mjs samples tmp/codex-audit/sample-selection.json` → `ST1_2020_web_link_Part12-structure.json`; `compare-head.mjs`. Visuaal: `refs-body.png`.

**Parandus:** kasutada ühtset täieliku pealkirja normaliseerimist ja ankurdatud võrdlust koos sektsiooni tüübi/tüpograafia ning bibliograafilise sisu tõendiga. Pelk prefiks ei tohi põhiteksti retrieval'ist eemaldada. Lisada nulltükkide ja ebaproportsionaalse välistamise kontroll ning regressioonitestid päris lõigualguse, HTML-i ja kirjavahemärkidega pealkirjade jaoks.

### F02 — P1: esiletõstetud tsitaadi eemaldus eemaldab tabelisilte ja võib eemaldada kõik koopiad

**Koht:** `lib/rag-v2/parser.js:146`, `parser.js:159`, `parser.js:162`. **Uus regressioon.**

Kordust otsitakse kogu eemaldamiseelsest tekstist. Algoritm ei nõua, et üks sobiv põhitekstikoopia pärast eemaldamist alles jääks. Samuti ei eristata tabeli rea nime dekoratiivsest tsitaadist.

**Päris tõend:** `Andmebaasi/juhendid_ja_uuringud/sotsiaalministeerium_uuring_taisealiste_puudega_inimeste_puude_tuvastamise_abivaj.pdf`, PDF lk **115, 132, 178**. `repeated_pull_quote` hulgas on tabelite silte ja õigusviiteid. Visuaalselt kontrollitud lk 115 (trükitud 114) eemaldab värvilises tabelis näiteks rea nimetuse „Puhkus sügava puudega isiku hooldamiseks”; lk 178 (177) eemaldab korduvaid õiguse/õigusakti lahtreid. Mujal dokumendis leiduv sama sõnastus ei asenda konkreetse rea silti.

**Piirjuht:** kaks ühesugust vähemalt 60 tähega teistsuguse fondi tekstiplokki eemaldatakse mõlemad. `reproductions.json.double_quote` annab `remaining_contains_quote: false` ja `retrieval_contains_quote: false`. Valimi 36 ühendatud eemaldusplokist neljal polnud allesjäänud tekstis sama ühendatud jada; kõik neli olid nimetatud juhendis. See abimõõdik üksi ei tõenda iga sõna kadumist, kuid visuaalne tabelikontroll ja kahe koopia test tõendavad vea.

**Korrata:** `reproductions.mjs`; nimetatud juhendi struktuuriväljavõtte `removed`; `sample-analysis.mjs`. Visuaalid: `false-pullquote-chart.png`, `false-pullquote-table.png`.

**Parandus:** valida kõigepealt säiliv põhiteksti esinemiskoht ja siduda eemaldus selle tõendiga. Eemaldada ainult geomeetriliselt eristatud dekoratiivne tsitaat. Tabeli lahtrid, rea-/veerunimed ja loendi liikmed vajavad teistsugust käsitlust. Testida kõigi koopiate säilimisreeglit ja korduvaid tabelisilte.

### F03 — P1: uus tühikuta liitmine kaotab OCR-i päris sõnavahesid

**Koht:** `lib/rag-v2/pdf-worker.js:50`, `lib/rag-v2/parser.js:40`, `parser.js:54`. **Uus regressioon.**

Worker ja struktuurifilter eemaldavad ainult tühikut sisaldavad tekstielemendid. Seejärel tuletatakse sõnavahe geomeetriast: alla 0,1 em vahe liidetakse tühikuta. OCR-i sõnaboksidel võib nähtav/eksplitsiitne vahe olla sellest väiksem.

**Tõend:** `Andmebaasi/ajakiri_sotsiaaltoo/17-1/2017_1_Part5.pdf`, PDF lk 1 (12). Uus tekst sisaldab `omavalitsusekohustustele`, `nemadvõi`, `motiveeridakohalikke`. PDF.js tagastab esimese juhtumi jaoks `omavalitsuse`, eraldi ` ` ja `kohustustele`. Tühikuelemendi laius on ligikaudu 0,034 pt ning naabersõnade vahe 0,290 pt. Nähtavas lehes on sõnad lahus. HEAD-i tulemus säilitas need sõnavahed, kuigi selle üldine veerujärjekord oli halvem.

**Korrata:** `pdf-glyph-probe.mjs`, `compare-head.mjs`; `2017_1_Part5-structure.json`. Visuaal: `ocr-title.png`.

**Parandus:** säilitada PDF.js eksplitsiitne sõnavahe vähemalt ühendamisinfona ka siis, kui tühikuelement ei saa oma span'i. Eristada fondimuutusest tekkinud ühe sõna tükke OCR-i sõnaboksidest. Lisada tegeliku PDF-i regressioonitest väikese geomeetrilise vahe ja nullkõrgusega tühikuelemendiga; säilitada ka vajalik `P|raktika` liitmise juhtum.

### F04 — P1: tabeli, joonealuse ja voldiku lugemisjärjekord muudab tähendust

**Koht:** `lib/rag-v2/pdf-layout.js:66`, `pdf-layout.js:128`, `lib/rag-v2/parser.js:189`, `lib/rag-v2/chunking.js:16`. **Osaliselt varasem katmata ala; uus teostus ei lahenda seda piisavalt.**

PDF-i plokiliigid on pealkiri/tsitaat/loendi liige/lõik. Tabeli read, joonealused, kastid ja pildiallkirjad jäävad üldise teksti hulka. Veergude geomeetriline järjestus ei taga nende semantilist järjestust.

**Tõendid:**

- `20-1/ST1_2020_web_link_Part12.pdf`, PDF lk 3 (55), tabel „Ohumärkide plaani ja kriisiplaani teenuste korraldus”: parser loeb esmalt reasiltide veeru, siis ühe teenuse väärtused, seejärel teise teenuse väärtused. „Eesmärk”, „Kasu”, „Vorm” kaotavad naaberväärtusega seose. Lane'id on väljavõttes 8/9/10.
- Sama artikli lk 1–2: otsingutekstis jäävad joonealused `1 Vaimse ... 2 Tartu ...` lause sõnade **„Abi” ja „saamata”** vahele. Lõikude/lausepiiride silumine ei lahenda enne valesti järjestatud teksti.
- `juhendid_ja_uuringud/sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est.ocr.pdf`, lk 1: nähtaval on kolm paneeli, parser tuvastab kaks veergu ja liidab eri paneelide ridu. Näiteks `* Toimunud on seksuaalvahekord, ja vabatahtliku nõusolekuta.` ühendab eri kohtade teksti. Tegu on abi saamise tingimusi kirjeldava sisuga.

**Korrata:** valimi struktuuriväljavõtted, `refs-table.png` ja `guide-ocr.png`; otsida `reading_lane`, `block_id` ning toodud fraase. Juhuvalimi „Teadmusloome sotsiaaltöös” väljavõttes on samuti põhiteksti sisse loetud joonise/joonealuse teksti.

**Parandus:** enne embeddingut eraldada lehe piirkonnad ja nende rollid; tabeli retrieval-kuju peab säilitama rea ning veerupäise seose, joonealune peab olema eraldi ja põhitekstiga viite kaudu seotud. OCR-voldikul tuleb tuvastada paneelid. Kuni seda pole, jätta ebausaldusväärsed dokumendid/plokid ostuvalikust välja, säilitades nende allikad ja review-põhjuse. `layout_coverage_limit` on praegu üldhoiatus, mitte sisulise kvaliteedi garantii.

### F05 — P1: KOV-i tehniliste väljade embeddimine tekitab üle 50 000 killu ja ebavajaliku korduskulu

**Koht:** `lib/rag-v2/text-source.js:124`, `text-source.js:152`, `text-source.js:155`, `text-source.js:193`; `lib/rag-v2/chunking.js:54`. **Varasem adapteri/tükeldamise probleem, nähtav praeguse korpuse mõõtmisel.**

`record_mapping` toob tehnilised väljad `NON_CONTENT` välistusest tagasi allikateksti. Iga JSON-väli ja iga seose siht-ID saavad oma sektsioonitee; chunker ei koonda neid semantiliseks teenusekirjelduseks. Dokumendi pealkiri kordub prefiksis, sest võrreldakse tervet sektsiooniteed, mitte selle esimest komponenti.

**Tõend:** 4876 kirjet annavad **51 857 tükki**, neist **50 143 ehk 96,7%** alla 300 märgi. Tokenite kogusumma on **2 504 177**; eraldi loetud prefiksite osa **1 271 021 ehk 50,8%**. `checked_at` ja `last_checked` annavad kokku **9752 tükki / 296 894 tokenit**. Vektoriruumis on ka eraldi seotud kirje ID-d ja `status` väärtused.

Näide paketist `Andmebaasi/KOV/alutaguse-vald/alutaguse-vald.json`, kirje `/items/0`:

```text
Asendushooldusteenus > Asendushooldusteenus > checked_at

2026-04-12
```

Sama kuupäev embeddiks uuesti ka `last_checked` väljana. Kontrollkuupäeva muutus muudab praegu päris embeddingusisendit.

**Korrata:** `reproductions.mjs` → `kov_chunks`; `metadata-audit.mjs` ja `supplement.mjs` → KOV-i tüki-/tokenimõõdikud. Kõigil 4876 kirjel säilis `record_key`; **0 eri kirjeid ühendavat tükki** ja **0 vigast JSON-tekstivahemikku**.

**Parandus:** eraldada tsiteeritavad allikaüksused ja embeddinguks valitav tekst. Säilitada väljade täpsed JSON-pointer'id, kuupäevad ja ID-seosed, kuid koostada ühe kirje piires sisuline otsingutekst: teenus/toetus, sihtrühm, tingimused, summa, taotlemine. Tehnilised ID-d, kontrollajad ja URL-id kuuluvad valdavalt struktureeritud filtritesse/seostesse. Otsustada enne ostu, kas omavalitsuse nimi lisatakse tekstiprefiksisse; `record_key` piiri ei tohi kaotada. Mõõta uue projektsiooni tegelik tokenimaht uuesti.

### F06 — P1: juhendite ja XML-ide valikud sisaldavad sama loogilise dokumendi konkureerivaid faile

**Koht:** `lib/rag-v2/registered-source.js:23`, `lib/rag-v2/ingest-batch.js:65`; `selection-juhendid.json`, `selection-oigusaktid.json`. **Valiku/identiteedi probleem; konfliktikaitse töötab õigesti.**

Leiti **20 korduvat `document_id` paari**: seitse originaali/OCR-derivaadi paari ja 13 XML-paari. Failiräsid on erinevad; kõigil 13 XML-paaril on pärast parsimist identne `source_text`-ide jada. 104 XML-faili tähendavad **91 erinevat redaktsiooni-ID-d**, mitte 104 erinevat õigusakti ega tingimata 91 eri õigusakti perekonda.

**Korrata:** `reproductions.mjs` kutsub ainult puhast `planIngestBatch`-funktsiooni. Paarid `oigusaktid/412042025007.xml` + `412042025007-d607c4383a.xml` ja `juhendid_ja_uuringud/sotsiaalkindlustusamet_rus.pdf` + `sotsiaalkindlustusamet_rus.ocr.pdf` tagastavad **`batch_document_conflict`**. Ühtegi batch'i ei järjekorrastata ega salvestata. Kõik paarid: `metadata-audit.json.duplicates_by_document_id`; XML-i sisuvõrdlus: `supplement.json.xml_duplicates`.

**Parandus:** valida iga redaktsiooni/dokumendi üks kanooniline sisend. OCR-fail seostada originaali tuletisega, säilitades mõlema räsi ja töötlusinfo. XML-i baidierinevad, kuid samasisulised koopiad koondada sama identiteedi alla. Uute kunstlike dokumendi-ID-de andmine ei lahenda sisuduplikaate. Kinnitada valik enne kuluhinnangut.

### F07 — P1: õigusaktide kehtivus- ja jurisdiktsioonikontekst pole ostuvalikus lõpuni lahendatud

**Koht:** `lib/rag-v2/text-source.js:89`, `lib/rag-v2/registered-source.js:20`; `Andmebaasi/register/kov_oigusaktid.json`.

104 XML-ist on 32-l lõppkuupäev; **30 faili lõppkuupäev on enne 2026-09-25**. Need pole tingimata tarbetud ajalooallikad, kuid kehtiva õiguse valikuga neid eristamata segada ei saa. `valid_from`, `valid_to` ja avaldamisaeg parsitakse; puudub redaktsiooniperekonna ja jurisdiktsiooni täielik kooskõlastus. Ühelgi 104 kohandatud XML-metaandmel pole `municipality_id`, `jurisdiction_level` ega `country` väärtust.

KOV-õigusaktide register annab 78 kohaliku faili vastet, kuid **12 kirje vana `act_reference` erineb XML-i tegelikust ID-st**. Näiteks Järva valla kirje viitab failile `407042026033.xml`, vana viide on `404092025027`. Praegune adapter võtab identiteedi õigesti XML-ist; vana registrivälja pime ülekandmine taastaks vea.

Kaks `source_text_empty` juhtumit on eristaatused: `416022022003.xml` (Lääneranna) ja `425032026041.xml` (Muhu). Neil on tühi `sisu`, kuid mujal märge **„Kehtetu”** (`416022022003.xml:48`, `425032026041.xml:55`). Neid tuleb käsitleda kehtetuks muutumise kirjetena, mitte kadunud teksti või OCR-veana. `terviktekstiGrupiID`, `tekstiliik` ja `dokumentVersioon` on XML-is olemas, kuid käesolev adapter ei tõsta neid redaktsioonimudeli väljadeks.

**Korrata:** `metadata-audit.mjs` → XML-i `expired`/puuduvad väljad; `supplement.mjs` → 78 registrivaste võrdlus; lugeda nimetatud XML-ide metaandmed ja „Kehtetu” märge. Kohalike failide põhjal ei saa kinnitada, et need on veebis hetkel uusimad redaktsioonid.

**Parandus:** eristada õigusakti perekond, redaktsioon, kehtivusvahemik ja kehtetuks muutumise sündmus; siduda KOV-i stabiilne ID kontrollitud kohaliku registrivaste ning väljaandjaga. Määrata ajaloolise sisu kasutusviis ja kuupäevafilter. Metaandmete täiendamine üksi ei pruugi nõuda uusi embeddinguid, kuid jurisdiktsiooni/redaktsioonikonteksti lisamine `retrieval_text`-i nõuab; see otsus teha enne ostu.

### F08 — P2: U+FFFD taastamine ei taasta kõiki nähtavaid lauselõpupunkte

**Koht:** `lib/rag-v2/pdf-worker.js:26`, `pdf-worker.js:50`. **Varasem tekstikihi probleem, mida uus parandus täielikult ei kata.**

`20-1/ST1_2020_web_link_Part12.pdf`, PDF lk 1: PDF.js operaatoriloendis on fondi `g_d0_f4` originaalkoodiga 46 glüüfe, mille Unicode on **`" ."`**, mitte U+FFFD. Proov näitas 15 sellist glüüfi; `getTextContent` annab kogu lehe kohta ainult ühe punkti. Nähtavas tekstis on lauselõpud olemas. Uus taastamine käivitub ainult U+FFFD puhul, mistõttu `fffd=0` ei avasta seda kadumist.

**Korrata:** `pdf-glyph-probe.mjs` → selle PDF-i teksti ja operaatorite võrdlus; võrrelda dokumendi nähtava esimese lehega. Kogu korpuse selliste kadunud punktide sagedust ei mõõdetud; 0 U+FFFD ei ole selle asendusmõõdik.

**Parandus:** kontrollida ka vigaseid mitmemärgilisi Unicode-kaardistusi ning teksti/operaatorite vastavust. Taastamine peab olema fondi ja asukohaga põhjendatud, mitte pime ASCII-koodide ümbertõlgendus. Lisada päris fondikaardistuse test, sh sobimatu kooditabel ja erinev operaatorite järjekord. Lausepiiride kvaliteet kontrollida pärast tekstikao parandamist.

### F09 — P2: PDF-i bbox ei kata alati isegi selle aluseks olevaid tekstielemente

**Koht:** `lib/rag-v2/parser.js:66`, `parser.js:72`; `lib/rag-v2/contracts.js:87`.

Rea kasti ülemine serv on `min(y) + max(height)`, kuid peab katma vähemalt `max(y + height)`. Kõrgemale tõstetud märk võib jääda kastist välja. Sünteetiline rida `Märkus` baaskõrgusel 500 ja kõrgusega 11 koos ülaindeksiga y=507, h=6 annab bbox'i lõpuga **511**, kuigi element ulatub **513**-ni.

**Tõend:** üle 0,5 pt tolerantsi kastierinevus 9255 ajakirja span'il 506 dokumendis ja 9768 juhendi span'il 102 dokumendis. Võrdlus kasutas pööramata PDF.js tekstielemente. See pole glüüfi tindipiiride pikslitäpne mõõtmine; juba elementide liit jääb katmata. `validateBundle` kontrollib tekstivahemikke, aga ei tõenda seda kastiomadust.

**Korrata:** `reproductions.mjs` → `bbox`; `pdf-details.mjs` → `bbox_misses`. **Parandus:** moodustada bbox elementide tegelike koordinaatide liidust, käsitleda pööramist ja lehe koordinaadistikku eraldi ning valideerida need omadused. Ainult bbox'i parandamine muutumatu teksti korral ei nõua uusi vektoreid, kuid ADR-010 allikakoha nõue vajab enne ostu korrektset lahendust.

### F10 — P2: pealkirjade tuvastus muudab põhiteksti pealkirjadeks ja autorinime sektsiooniks

**Koht:** `lib/rag-v2/parser.js:135`, `parser.js:165`, `parser.js:185`, `parser.js:200`; `lib/rag-v2/chunking.js:54`.

Dokumendi üks globaalne kehateksti fondisuurus/fondinimi ei sobi kõigile leheosadele. Kõrvalfondist ja vertikaalsest vahest ei piisa autori, pildiallkirja ja alapealkirja eristamiseks.

**Tõendid:**

- `juhendid_ja_uuringud/tarkvanem_sunnitusjargne_depressioon.pdf`: kuus lehte annavad **97 tükki**. Ümardatud 6 pt tekstil on 4658 märki, 9 pt tekstil 3973; 6 pt saab ülekaaluka kehateksti suuruseks ning 9 pt tavalised lõigud muutuvad pealkirjadeks. Lk 2 nähtaval lehel on need põhitekst. Kaanele trükitud pealkirja ülekattuvad tekstielemendid annavad väljavõttes `SÜNNITUSJÄRGNESÜNNITUSJÄRGNE DEPRESSIOONDEPRESSIOON`.
- `ajakiri_sotsiaaltoo/19-4/ST4_2019_web_link_Part20.pdf`, lk 1: **„Krõõt Kroonmäe”** on autorinimi, kuid parser loob sellest sektsiooni ja eraldi lühikese tüki.
- `17-1/2017_1_Part5.pdf`, lk 1: täispealkiri jaguneb sektsioonideks `Kohaliku omavalitsuse`, `väljakutsed sotsiaalteenuste`, `osutamisel`; päris vahepealkiri „Omavalitsuse abistamiskohustus” jääb tuvastamata.
- Juhuvalimi `18-4/155619690985_Sotsiaaltoo_nr4_2018_veeb_link_Part16.pdf` sektsioonipealkirjas säilib `prob- leemid`, kuigi retrieval-kehas eemaldatakse poolitusi. Täielik dokumendipealkiri ja selle vigane kuju korduvad prefiksis.

**Korrata:** vastavad `*-structure.json` failid; visuaalid `guide-body.png`, `guide-duplicate.png`, `author-heading.png`, `ocr-title.png`.

**Parandus:** hinnata kehateksti fondi piirkonna/lehetüübi järgi; liita pealkirjaread geomeetria alusel; eristada autor, pildiallkiri ja põhitekst; normaliseerida ka tuletatud sektsioonipealkirja poolitused allikateksti muutmata. Pealkiri on igas embeddinguprefiksis, seega selle parandamise edasilükkamine muudab hiljem paljusid sisendeid.

### F11 — P2: servaeemaldus ei tõenda, et eemaldatav rida on päis või jalus

**Koht:** `lib/rag-v2/parser.js:82`, `parser.js:89`, `parser.js:92`, `parser.js:113`. Servaala suurenemine 4,5%-lt 10%-le laiendab riski.

Korduse võti eemaldab kõik numbrid. Kaks eri fakti **„Toetus on 100 eurot.”** ja **„Toetus on 200 eurot.”** kahe lehe alumises servavööndis lähevad samaks võtmeks ja eemaldatakse mõlemad `repeated_margin` põhjusel. Ülemise serva pealkiri **„COVID-19”** eemaldatakse `page_mark` põhjusel. `rotated_margin` eemaldab külgserva pööratud teksti korduse või ploki rolli tõendita.

**Korrata:** `reproductions.mjs` → `different_amounts_removed`, `numeric_title_removed`. Need on sünteetilised vastunäited, mitte mõõdetud korpuse sisukaotuste arv. Päris korpuse `margin-audit` 40 dokumendi valimis olid paljud eemaldused õiged ajakirjapäised/lehenumbrid; auditis ei kinnitatud konkreetset päris `rotated_margin` sisukaotust.

**Parandus:** nõuda korduvat paigutust ja päise/jaluse rolli; normaliseerida lehe-/väljaandenumber kontrollitud mustri, mitte kõigi numbrite eemaldamisega. Pealkirja ja külgserva tabeli/joonise silti ei tohi välistada üksnes asukoha tõttu. Vajalikud on summade, aastaarvuga pealkirja ja pööratud tabelisildi testid.

### F12 — P2: poolituste eemaldamine sööb ära sõna päris sidekriipsu

**Koht:** `lib/rag-v2/chunking.js:28`.

`järk-\njärgult` muutub `järkjärgult` ja `step-\nby-step` kujule `stepby-step`. Reegel eristab rippuvat liitsõna (`sotsiaal- ja`) ning suurtähte/numbrit, kuid ei erista reavahetuse kohale sattunud leksikaalset sidekriipsu tavalisest poolitusmärgist.

**Korrata:** `reproductions.mjs` → `hard_hyphen`. Korpuse tegelikku esinemissagedust ei mõõdetud. **Parandus:** eristada pehme poolitusmärgi ja tavalise sidekriipsu käsitlust, kasutada konservatiivset ühendamist ning vajadusel keelepõhist sõnakontrolli adapteris. Lisada sidekriipsuga sõnade regressioonid. Allika `source_text` säilitamine on õige, kuid vigane `retrieval_text` vajab enne embeddimist parandamist.

### F13 — P2: XML-i peatüki- ja paragrahvipealkirjad ei jõua sektsiooniteesse

**Koht:** `lib/rag-v2/text-source.js:102`, `text-source.js:108`. **Muutumata XML-adapteri katmata skeemiosa.**

Adapter otsib lapse nimega `pealkiri`, kuid korpuse õigusaktid kasutavad `peatykkPealkiri` ja `paragrahvPealkiri`. Paragrahvi `textContent` loeb sisse ka tehnilise numbri ning kuvatava numbri, mistõttu tekivad `1 § 1.` ja `1 (1)`.

**Tõend:** `Andmebaasi/oigusaktid/401112019012.xml:43` ja `:47` sisaldavad „Üldsätted” ning „Määruse reguleerimisala”, aga tüki prefiks on ainult `Sotsiaalhoolekandelise abi andmise kord > § 1.`. Sisu algab `1 § 1. Määruse reguleerimisala ...`. Peatüki tähendus ja puhas kuvatav numbristruktuur on kadunud.

**Korrata:** `reproductions.mjs` → `xml_headings`. **Parandus:** toetada Riigi Teataja skeemi pealkirja- ja numbrivälju eraldi; säilitada peatükk → paragrahv → lõige/punkt kontekst ning valida kuvatav number üks kord. Hoida täpsed XML-lokaatorid. See muudab sektsiooniprefiksit ja keha, seega mõjutatud XML-ide embeddingud tuleks hiljem uuesti arvutada, kui neid praegu osta.

### F14 — P2: metaandmete teisendus toodab laialt konflikte; kuupäeva roll on ebaselge

**Koht:** `lib/rag-v2/metadata-adapter.js:25`, `metadata-adapter.js:47`, `lib/rag-v2/normalize.js:43`, `normalize.js:96`, `lib/rag-v2/ingest-publication.js:36`.

Juhendite 184 loetavast metaandmekogumist **169-l on vähemalt üks konflikt**. Konfliktiväljade esinemised: `source_status` 155, `source_url` 63, `audience` 8, `last_checked` 4, `description` 4, `collection_id` 4, `authority` 2, `source_type` 1. Need arvud kattuvad dokumentide lõikes. Esimene kandidaat valitakse, alternatiivid säilitatakse ning normaliseerimine lisab blokeeriva `metadata_candidate_conflict` hoiatuse. See on kasulik kaitse, kuid migratsioon pole valmis.

Osa konflikte on eri mõistetest: plaani `known` ja sisuline `active`; sihtrühm `BOTH` ja `SOCIAL_WORKER`/`CLIENT` massiiv; eri kontrollimishetked. Neid ei tohiks lahendada lihtsalt kõigi alternatiivide eemaldamisega.

Ajakirja kolmel dokumendil tekib `publication_year_conflict`. `18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part7.pdf` lk 1 näitab kindlat valepositiivi: avaldamisaasta 2018 võrreldakse joonealuse **„Sotsiaalkindlustusameti registri andmed 1. jaanuar 2009 ...”** kuupäevaga. Teised kaks on `25-1/Lapse õigus kasvada peres_1_2025.pdf` ja `25-1/Võlanõustamisteenus aastatel 2018–2023_1_2025.pdf`: PDF-is on 2024. aasta veebiteksti kuupäev, metaandmetes 2025. aasta väljaanne. Vajalik on avaldamisaja ja väljaandeaasta eristamine, mitte ühe aasta vaikiv asendamine.

KOV-is on üks URL-konflikt: `KOV/tallinn/tallinn.json`, ID `tallinn_service_oigusnoustamine_vahekindlustatud_tallinna_elanikele`, `url_canonical` lõpeb `...elanikule`, `officialUrl` `...elanikele`. Veebist õiget varianti selles auditis ei kontrollitud.

**Korrata:** `metadata-audit.mjs`, `normalize-corpus.mjs`, `final-evidence.mjs`; detailid `metadata-audit.json` ja `final-evidence.json.date_conflicts`.

**Parandus:** määrata väljade semantika ja kandidaatide päritolupõhine eelistus. Eristada kogumise/plaani seis, allika kehtivus, väljaanne, veebis esmaavaldamine ning tekstis kirjeldatud ajaperiood. Kuupäevakandidaat ei tohi muutuda avaldamiskonfliktiks pelgalt esimesele lehele sattumise tõttu. Canonical title'i ja tekstiprefiksisse minevad metaandmed tuleb enne ostu üle vaadata; ülejäänud väljade hilisem täiendamine võib kasutada samu vektoreid.

### F15 — P2: juhendite koguvalik ei jõua praeguste piirangutega review'ni

**Koht:** `lib/rag-v2/registered-source.js:11`, `lib/rag-v2/contracts.js:9`, `lib/rag-v2/pdf-worker.js:41`, `lib/rag-v2/parser.js:130`.

185 juhendist peatub 54 enne normaliseerimist: 42 osalise tekstikihiga, seitse OCR-i vajavat, neli üle 250 lehe ning üks üle 20 MiB. Viimane on `sotsiaalkindlustusamet_puue_ja_hoolekanne_ska_aastaraamatu_pdf_osa_2025.pdf`, **25 276 499 baiti**, lubatud 20 971 520. Järelejäänud 131-st 124 sisaldab koodi järgi review-blokeeringut. Piirangud ise pole tõend parseriveast; vaikne nende tõstmine pole parandus.

**Korrata:** `normalize-corpus.mjs`; iga faili veakood on `normalized-corpus.json`-is. Eraldi parserikäik `pdf-details.mjs guides` selgitab lehe/teksti piiranguid, kuid jätab registri failisuuruse värava vahele.

**Parandus:** enne ostu kinnitada igale failile tee: kanooniline OCR-derivaat, põhjendatult välja jäetav tühi/fotoleht, lehevahemikeks jagamine koos originaalkoordinaatidega või eraldi sobiv piirang. OCR-derivaadi olemasolu ei tõenda õiget paneelijärjekorda (F04). Kõiki 185 ei saa esitada valmis embeddinguvalikuna. Tasulist OCR-i ega mudelitesti selles auditis ei käivitatud ega nõuta kohalike paranduste eeltingimusena.

### F16 — P2: indeksi 5000 tüki piir on korpuse mõõduga vastuolus

**Koht:** `lib/rag-v2/search/index-jobs.js:27`, `index-jobs.js:36`, `index-jobs.js:45`, `lib/rag-v2/search/indexing.js:49`. **Olemasolev mahuvärav.**

Indeksiplaan lubab kuni 1000 dokumenti ning kokku 5000 ühikut. Juba ajakirja 8109 tükki ületab ühikupiiri; KOV-i 4876 dokumendikirjet ületab mõlemat. Väiksemateks tööbätsideks jagamine ei tühista `validateIndexPlan` koguplaani piiri.

**Korrata:** `final-evidence.mjs` kutsub puhast `validateIndexPlan`-funktsiooni kahe dokumendi ja 5001 ühikuga; tulemus **`local_index_limit`**. Ühtegi index-batch'i käsku, indeksiühendust ega embeddinguadapterit ei käivitata.

**Parandus:** enne koguvaliku ostu tõendada kohalike adapteritega kavandatud kogumahu planeerimine, jätkamine ja kogu valikut katva põlvkonna avaldamine. Piirangu tõstmine vajab vastavat mahu-/taastumise kontrolli; pelk numbrimuutus ei tõenda runtime'i. See muudatus ei pea muutma embeddingusisendit, kuid praeguse piiriga pole koguvaliku kasutuselevõtt tõendatud.

### Metaandmed ja GraphRAG

Järgmine tabel mõõdab välja olemasolu `registeredSource` + `adaptMetadata` järel, mitte välja õigsust. Juhendite nimetaja on 184, sest üks fail peatub failisuuruse kontrollis. XML-i puhul on metaandmed loetavad ka kahe sisutühja staatusekirje jaoks.

| Väli | Ajakiri / 892 | Juhendid / 184 | XML / 104 | KOV / 4876 |
|---|---:|---:|---:|---:|
| Pealkiri, allikaliik, keel | 892 | 184 | 104 | 4876 |
| Autorid | 879 | 2 | 0 | 0 |
| Aasta | 892 | 145 | 0 | 0 |
| Avaldamiskuupäev | 44 | 5 | 104 | 0 |
| Väljaandja/asutus (`authority`) | 46 | 176 | 104 | 4876 |
| Allika URL | 54 | 181 | 104 | 4299 |
| Kehtivuse algus / lõpp | 0 / 0 | 0 / 0 | 104 / 32 | 0 / 0 |
| Jurisdiktsiooni tase | 0 | 171 | 0 | 0 |
| Omavalitsuse ID | 0 | 0 | 0 | 4876 |
| Riik | 0 | 171 | 0 | 0 |
| Sihtrühm | 892 | 184 | 0 | 4876 |
| `last_checked` / `retrieved_at` | 2 / 44 | 171 / 0 | 0 / 0 | 4876 / 4876 |
| Õigused: `copyright_status`, `allow_excerpts`, `display_full_text` | igaüks 0 | igaüks 8 | igaüks 0 | igaüks 0 |

Peamised järeldused:

1. **Allikaliik vajab ühtset semantikat.** Ajakirjal on 849 korral `file` ja 43 korral `web`, kuigi sisuliselt on tegu ajakirjaartiklitega. Juhenditel on sisulised liigid, nt `information_material`, `official_guideline`, `research_report`. Eristada `source_format`/transpordiviis ja `document_kind`; mitte järeldada failiformaadist dokumendi epistemilist rolli. Liigi muutus mõjutab praegu ka dokumendi-ID-d (`ingestion.js:39`).
2. **Omavalitsuse identiteet on KOV-is olemas**, samuti kirje liik ja seoste adapter. `structured_record.kind` eristab teenust/toetust/kontakti/vormi; seda ei pea nullist looma. Vajalik on siduda sama omavalitsuse ID õigusaktide, teenuste ja pädevate asutustega ning säilitada seose kehtivusaeg ja allikatõend.
3. **Kontaktide sisu on piiratud:** 808 kontaktikirjet, kuid kontrollitud `phone`/`email`/`registry_binding` väljad polnud ühelgi täidetud. Pakettide `relatedContacts`, `relatedForms` ja `relatedTo` ID-de kontroll andis 0 katkist viidet, kuid see ei tõenda kõigi võimalike seoseväljade ega kontaktide täielikkust või URL-ide toimimist. Teenuse vastutaja sõlm ja kasutatav kontaktikanal on eri asjad.
4. **Kuupäevadel on mitu eri rolli.** XML-i tsooniga kalendripäevade `metadata-values.js` normaliseerimine säilitab õige päeva; nihutamist UTC-päevaks ei leitud. Puudu on terviklik `published_at` / väljaandeaasta / kirjeldatud periood / redaktsiooni kehtivus / kogumishetk / viimati kontrollitud hetk mudel. KOV-i kõigil kirjetel olev kontrollkuupäev on imporditud väide, mitte praeguses auditis kontrollitud fakt.
5. **Õiguste väljade puudumine tuleb teha nähtavaks.** `document.rights` töötlus-/juurdepääsuulatus ja teose autoriõiguse, katkendite ning täisteksti näitamise metaandmed on eri kihid. Siin ei otsustatud õiguslikku kasutusluba. Enne ostu peab valitud korpusel olema selge kasutusulatus ja selle päritolu; tundmatu väärtus peab jääma tundmatuks.
6. **Keelekood on olemas**, kuid see ei tõenda keele sisulist kontrolli. Juhendites on 180 `et` ning üks `ru`, `fi`, `en`, `uk`. Samasisulised eri keeled ja OCR-tuletised vajavad eraldi suhteid; neid ei tohi ühendada pelgalt sarnase pealkirja alusel.
7. **GraphRAG-i jaoks tasub fikseerida** dokumendi liik, kanooniline väljaandja ID, redaktsiooniperekond, omavalitsuse ID/jurisdiktsioon, teenuse/toetuse liik, sihtrühma sõnastik, kuupäevarollid, kanooniline URL ja õiguste päritolu. Iga tuletatud väite/seose juurde peab jääma allikakoht ja kontrollistaatus. Registrikategooria või kirjeldus ei asenda allikateksti tõendit.

Need täiendused kuuluvad kliendi adapterisse/profiili. GraphRAG-tuuma ei ole vaja lisada erandeid dokumendi nime, allika-ID või oodatud vastuse järgi. Enne ostu on vajalik otsustada, **millised neist väljadest lähevad embeddinguteksti**; kõigi metaandmeväljade täielik rikastamine ei pea embeddinguid blokeerima.

### Mis muudab embeddingute sisendit?

`chunking.js:64` moodustab sisendi kujul `pealkiri > sektsioon\n\nkeha`. `search/embedding.js:47` kasutab `title-section-text-v1` puhul täpselt seda teksti. Kohalik konfiguratsioon lubab pärisrežiimis `text-embedding-3-large`, 3072 mõõdet; mudelikutsest siin juttu pole, kontrolliti ainult koodi.

| Muutus | Kas muudab praegust embeddingusisendit? | Tegevus enne ostu |
|---|---|---|
| PDF-i lugemisjärjekord, glüüfid, sõnavahed, OCR | Jah, mõjutatud tükkides | Parandada ja võrrelda sisendräsi |
| Eemaldused, viiteloendi määramine, pealkirja-/plokipiirid | Jah; võib muuta ka järgnevate tükkide jaotust | F01–F04, F10–F11 lahendada või vastav sisu välja jätta |
| `chunkMaxChars`, lõikepiirid, poolituste normaliseerimine | Jah | Fikseerida pärast kohalikke regressioone |
| Dokumendi pealkiri ja sektsioonitee | Jah, paljudes sama dokumendi tükkides | Kanooniline pealkiri ja prefiksireegel kinnitada |
| KOV-i projektsioon, kuupäevad ja ID-d teksti sees | Jah | F05 lahendada; tehnilised muutujad tekstist eraldada |
| XML-i peatükid, paragrahvinimetused ja kuvatav numeratsioon | Jah | F13 lahendada |
| Ainult bbox/lokaator, muutumatu tekst | Ei | Allikakoha leping siiski parandada |
| Ainult autor, URL, kehtivus või jurisdiktsioon eraldi metaandmetena | Tavaliselt ei | Mitte lisada neid hiljem ootamatult prefiksisse |
| Muutunud `normalization`/`chunking` silt, kuid täpselt sama tekst | Ei pruugi | Võrrelda tegelikke sisendeid, mitte ainult versiooni-ID-d |
| Mudel, mõõtmed, sisendiversioon; cache'i tenant/rights ulatus | Uus vektorruum või uus cache'i võti | Fikseerida konfiguratsioon ja lubatud taaskasutustee |

**Oluline täpsustus:** üks muutunud sisend ei tähenda, et kogu korpus tuleb uuesti osta. `embedding_input_hash` sisaldab sisenditeksti ja sisendiversiooni (`chunking.js:68`); tegelik indeksivõti lähtub teksti räsist (`embedding.js:45`). Muutunud tekstiga tükid vajavad uut vektorit, täpselt samad sisendid võivad olemasolevat vektorit kasutada. Muutunud normaliseerimissildid ei anna siin vaikset luba vanale tekstile arvutatud vektori kasutamiseks uue tekstiga.

Praeguse ajakirjavaliku 8109 sisendist **188-l** oli oma varasemas store-versioonis täpselt sama `retrieval_text`. See võrdleb tekstisisendeid, mitte ostetud vektorite olemasolu. Muutunud dokumendi/versiooni-ID ei tähenda üksinda vajadust uuesti embeddida: metaandmeräsi, konfiguratsioon, profiil ja rights muudavad versiooni-ID-d, kuid muutumatu tekst võib sobiva cache'i kaudu säilida. Varasemate directory-skeemide cache'i ülekande tee on koodis olemas (`search/indexing.js:22`); tegelikku andmebaasivahemälu ei kontrollitud.

Enne ostu teha kohalik, muutumatu **embeddingusisendite manifest**: kanooniline dokumendi/redaktsiooni ID, allika ja metaandmete räsi, parseri/normaliseerimise/chunking'u/profiili versioon, tüki allikakohad, tegelik `input_text`, selle räsi, tokeniarv, mudel, mõõtmed, tokenizer ja õiguste ulatus. Kinnitada ka valikust välja jäetud dokumendid koos põhjusega. Ost peab viitama sellele manifestile; hilisem ümberarvutus peab näitama muutunud sisendite arvu, mitte ainult uut korpuseversiooni. Raha maksumust ei arvutatud, sest hinnainfot ega võrku ei kasutatud.

### Algse jooksu hilisemad tööd

### L01 — P2: täielik metaandmete ja graafi rikastamine väljaspool tekstisisendit

**Koht/tõend:** eelnev olemasolutabel, `lib/rag-v2/normalize.js:24`, `metadata-audit.json`. Autorite/asutuste kanoonilised ID-d, täiendavad sihtrühmad, teenusetaksonoomia, kontrolliajalugu ja rohkem kinnitatud seoseid on väärtuslikud, kuid neid saab lisada sama teksti vektoreid kasutades. **Korrata:** metaandmete audit. **Soovitus:** hoida need versioonitud struktureeritud väljadena ja tõendatud seostena. Kui otsustatakse need teksti lisada, kuulub vastav otsus ostueelsesse ossa. F07 kehtivuse/valiku eristamist ei lükata selle punktiga edasi.

### L02 — P3: tööaja ülemised piirid vajavad eraldi koormuskatset

**Koht:** `lib/rag-v2/pdf-layout.js:71` skaneerib x-telge 2 pt sammuga, `pdf-layout.js:109` võrdleb alguspositsioone ruutkeerukusega; `lib/rag-v2/chunking.js:75` summeerib iga tüki puhul ülejäänud sektsiooni uuesti. PDF-worker'i timeout ei piira vanemprotsessi kogu struktuuritööd.

Päriskorpuses selles jooksus hangumist ei esinenud: 1077 ajakirja/juhendi allika in-memory läbimine nelja samaaegse worker'iga kestis ligikaudu **172 sekundit**. See ei ole eraldatud benchmark ega tõend patoloogilise sisendi taluvusest. **Korrata:** `normalize-corpus.mjs` ajamõõdik; algoritmide ülevaatus. **Soovitus:** piirata geomeetrilist ulatust/töömahtu, kasutada eelnevaid summasid ja rühmitatud joondusloendust. Patoloogilise sisendi aeg on `not_run`; ei omistata mõõtmata aeglust kogu korpusele.

### L03 — P3: tüübi tagasiühilduvus ja ühe hoiatuse sõnastus

**Koht:** `lib/rag-v2/types.d.ts:55` lubab `retrieval_mapping.operation` väärtusena ainult uut `join_dehyphenated_lines_with_block_breaks`, kuigi vanad store'i bundle'id on endiselt loetavad. **Korrata:** võrrelda vana bundle'i mapping'ut ja tüüpi; olemasolev legacy-bundle'i test läbib. **Soovitus:** tüübistada versioonitud vana/uue kuju ühendina või kirjeldada selgesõnaline migratsioon. TypeScripti tarbija kompileerimise kontrolli ei tehtud.

`lib/rag-v2/normalize.js:90` lisab `reference_list_not_visible` just siis, kui `referenceSpan` leiti. **Korrata:** vaadata tingimust ja ajakirjavaliku üht vastavat hoiatust. **Soovitus:** viia hoiatuse tingimus/nimi tähendusega kooskõlla. See ei muuda embeddinguteksti.

### Testid, determinism ja katmata alad

Käivitati `tests/rag-v2-source-structure.test.mjs`: **27/27 läbis**, `TZ=UTC`, kohaliku võrgu-/kirjutuskaitsega. Testid katavad tekstivahemikke, üldlokaatorite transporti, legacy-bundle'i lugemist, mitut veeru/fondi/poolituse näidet, HTML-i peidetud/nestitud teksti ja JSON-kirjepiiri. Täisrepo testikomplekti, build'i, mudelitesti ega otsingu kvaliteedihindamist ei käivitatud: koodi ei muudetud ning ülesanne keelas mudeli/võrgu.

Puuduvad või ebapiisavad regressioonid on leitud vigadega konkreetselt seotud: tavaline „Kasutatud kirjandusest” lõik; HTML-i valesti välistatav pealkiri; kõikide tsitaadikoopiate eemaldus; tabelisildi kordus; OCR-i eraldi tühik; mitmemärgiline fondi Unicode; ülaindeksi bbox; piirkonniti erinev kehafont; leksikaalne sidekriips; KOV-i kaardistatud tehnilise välja sattumine embeddingusse; originaal/OCR ja XML-duplikaatide lõplik valik; päris RT skeemi pealkirjad.

Neli juhuvalimi PDF-i parsiti/struktureeriti/tükeldati uuesti: **pages, spans ja chunks olid kõigis neljas identsed**. Seda tõendab `sample-analysis.json.determinism`. Kogu korpuse teist sõltumatut determinismijooksu ega teise masina/fontide/PDF.js versiooni võrdlust ei tehtud. Ingest'i ajatempel on eraldi muutuv väli; selle olemasolu ei tähenda muutunud embeddinguteksti. Süsteemifontide kasutus on worker'i seadistuses (`pdf-worker.js:37`), seega keskkonna pin'imine kuulub reproduktiivsuse kirjeldusse.

Positiivsed pärisjuhtumid: juhuvalimi `17-2/Sotsiaaltoo_2-2017_veebi_link_Part23.pdf` lk 2 veerud loeti visuaalse kontrolli järgi vasakult paremale; intervjuu `18-3/155619680390_Sotsiaaltoo_nr3_2018_veebi_link_Part19.pdf` väljavõttes säilisid kõnelejanimed, kuigi eraldi kõnelejastruktuuri ei moodustatud. `18-eri/ST_eri_2018_web_link_Part6.pdf` lk 2 on ka visuaalselt fotoleht; `pdf_pages_without_body_text` hoiatus on selle juhtumi jaoks põhjendatud. See ei tõenda, et iga ainult päistega leht on foto.

Kõigi 102 parsitava XML-i ja 4876 KOV-kirje allikateksti lõiked ning kirjepiirid läbisid kontrolli. XML-i DTD/ENTITY tõrjumine ja JSON-pointer'i järgi ühe kirje valik on olemas. XML/HTML-i `raw_text` on parsitud tekstiüksus, mitte originaalfaili baitide lõik; lokaator ja algfaili räsi on selle seose vajalik osa.

### Kuidas mõõtmisi korrata

Käsud käivitada projekti juurest. Järgmised auditiskriptid kirjutavad ainult `tmp/codex-audit/` alla. Need võivad olemasolevaid **auditi vahetulemusi** uuendada, kuid ei kirjuta korpuse store'i. Keelatud ingest/index režiime pole vaja kasutada.

```powershell
$env:TZ = 'UTC'
$env:NODE_OPTIONS = '--import=file:///C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/codex-audit/offline-guard.mjs'

node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/metadata-audit.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/normalize-corpus.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/pdf-details.mjs journal
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/pdf-details.mjs guides
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/supplement.mjs

node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/select-samples.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/pdf-details.mjs samples tmp/codex-audit/sample-selection.json
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/reproductions.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/pdf-glyph-probe.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/compare-head.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/sample-analysis.mjs
node --import ./scripts/register-node-source-loader.mjs tmp/codex-audit/final-evidence.mjs
```

`compare-head.mjs` loeb `git show HEAD:<fail>` kaudu nelja mooduli vana sisu ja käivitab koopiaid auditi alamkaustast; see ei tee checkout'i ega muuda töökoopia koodi. Seetõttu kordab see võrdlust auditeeritud baasiga ainult seni, kuni HEAD on sama commit.

Kasutaja antud korpusemõõdik ja eemalduste proovid käivitati järgmiselt:

```powershell
$auditTenantDir = 'tmp/rag-v2-corpus/store/tenant_11b24bf457818a3711534b6048b52f18a1e765015085e3b09f5017ab3df535c7'
node --import ./scripts/register-node-source-loader.mjs tmp/rag-v2-corpus/corpus-audit.mjs $auditTenantDir tmp/codex-audit/corpus-summary.json 100000 50
node --import ./scripts/register-node-source-loader.mjs tmp/rag-v2-corpus/margin-audit.mjs $auditTenantDir 40 0
node --import ./scripts/register-node-source-loader.mjs tmp/rag-v2-corpus/pullquote-check.mjs $auditTenantDir 30 29
```

Olemasolev `structure-dump.mjs` kasutab `pdf-worker-probe.js`-i. Auditi tõendites kasutati selle asemel `pdf-details.mjs` väljavõtteid praeguse päris `pdf-worker.js`-iga, et glüüfitaastamise tee oleks sama mis auditeeritud ingest'il.

Test ja üks visuaalse kontrolli korduskäsk:

```powershell
$env:TEMP = Join-Path (Get-Location) 'tmp/codex-audit'
$env:TMP = $env:TEMP
node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-source-structure.test.mjs
pdftoppm -f 4 -l 4 -scale-to 1500 -png -singlefile 'Andmebaasi/ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part12.pdf' 'tmp/codex-audit/refs-body'
```

Olulisemad masinloetavad tõendid: `metadata-audit.json`, `normalized-corpus.json`, `journal-details.json`, `guides-details.json`, `corpus-summary.json`, `supplement.json`, `reproductions.json`, `pdf-glyph-probe.json`, `compare-head.json`, `sample-analysis.json`, `final-evidence.json`. `random-sample.json` ja `sample-selection.json` säilitavad valimi. Suured väljavõtted ja PNG-d on ajutine kohalik tõend, mitte eraldi projekti seisufail.

Lõppkontroll **läbis**: `snapshot-before.json` ja `snapshot-after.json` võrdluses säilis sama HEAD, kaheksa auditeeritud faili samad SHA-256 räsid ning store'i kõigi 7136 faili samad teed, suurused ja muutmisajad. Tulemus on `tmp/codex-audit/verification.json`. `git diff --check` läbis; uuel raportil puuduvad rea lõpu tühikud. `git status` näitab algseid kaheksat muudetud faili, algset arhiveerimiskausta ning ainsa uue mitteajutise failina seda raportit. Store'i lõppkontroll on inventuuri, mitte kõigi 7136 faili korduvate sisuräside võrdlus; auditi käivitatud kirjutustee oli eraldi piiratud.




## Ajalooline lisa B: süsteemi vahekoopia leiud

Järgnevad S01–S07 kordused kirjeldavad **07:29:59 UTC koopiat**. Need on nüüd parandatud vastavalt raporti alguse seisutabelile; siin olevad sõnad „lõppkoopia” ja „endiselt” tähendavad tolle vaheetapi lõppu. F16 mahupiirang ning raporti alguses täpsustatud metaandmete/OCR-i puudused jäävad alles.

### Vahekoopia ostueelsed leiud

Raskused: **P1** = oluline sisukadu või ostu/avaldamist takistav süsteemiviga; **P2** = piiratud, korratav kvaliteedi- või lepinguviga. Iga leiu juures on eraldi mõju embeddingutele.

### S01 — P1: sama töötlusversiooni nimi katab erinevaid parseri ja tükeldaja tulemusi

**Koht:** `lib/rag-v2/contracts.js:8`, `lib/rag-v2/ingestion.js:38`, `ingestion.js:49`.

Auditi jooksul muutusid parser, worker, tükeldaja, JSON/XML projektsioon ja retrieval-prefiks, kuid nimed jäid `source-structure-v9`, `structure-blocks-v3` ning `title-section-text-v1`. Versiooni-ID sõltub lähtefailist, metaandmetest ja konfiguratsioonist, mitte kasutatud teostuse räsist. Olemasoleva versiooni leidmisel tagastab `prepareVersion` selle enne parseri käivitamist.

**Kordamine:** `system-capacity-5001.mjs` sisaldab sõltumatut `version_reuse` katset. Sama sünteetiline PDF ja konfiguratsioon valmistatakse ette kahe erineva parseritulemusega. Teisel ettevalmistamisel on `reused=true`, parserikutseid **0** ja alles vana tekst `joinedwords`; tühjas eraldi ajutises store'is annab sama versiooni-ID uue teksti `joined words`. Kõik katsestore'id asuvad auditi kaustas. See tõendab vahemälu käitumist, mitte seda, et päris korpuse store'is oleks juba selline vale v9 versioon.

**Parandus:** külmutada ostetava sisendi moodustamise teostus ning uuendada normaliseerimise/tükeldamise versiooni iga semantilise muudatuse järel; alternatiiv on teostusmanifesti räsi versiooni-ID-s. Uus lõppseis tõstab ka faili-/lehepiiri 32 MiB / 400 peale, mis muudab konfiguratsiooniräsi, kuid see juhuslik vahemälu eristus ei asenda töötlusversiooni lepingut. Vana versiooni üle kirjutada ei tohi.

**Embeddingumõju:** mõjutatud dokumendid tuleb uuesti ette valmistada ja võrrelda tegelikke `retrieval_text` räse. Muutumatu teksti ning sama embeddingumudeli/konfiguratsiooni vektoreid saab taaskasutada; parandatud teksti vana vektor ei sobi.

### S02 — P1: admin võib embeddingud osta enne, kui indeksi mahupiir avaldamise peatab

**Koht:** `lib/rag-v2/admin/intake.js:346` ja `:364`; `search/multi-source-plan.js:32`; `search/indexing.js:49`; `search/index-jobs.js:27`. Täpsustab algset F16 leidu.

Admini rada käivitab esmalt embeddingute runner'i ning alles salvestatud vektorite järel `indexSnapshot`-i. Ostuplaan ei kontrolli sama 5000 indeksiüksuse piiri. Piiri kontroll toimub indekseerimisel, seega võib kasutaja saada tasulised vektorid, millele sellele rajale vastavat indeksit avaldada ei saa. CLI pilot/multi-source rada kasutab sama olulist järjekorda. Taaskasutuse võimalus vähendab korduskulu, kuid ei kõrvalda välditavat esimest ostu.

**Kordamine:** `system-capacity-5001.mjs` loob mälus 5001 sünteetilist JSON-kirjet. 436 769-baidine allikas annab **5001 tükki**; plaan lubab **5001 välissisendit / 93 019 tokenit**, seis `prepared_not_authorized_not_run`. Sama snapshot'i indekseerimine katkeb `local_index_limit`-iga. Katse ei osta midagi: embeddingu- ega salvestusadapteri kutseid **0**. Tõend `system-capacity-verified.json.capacity`. Uus XML-valik sisaldab ka päriselt 6593 tükki enne duplikaatide korrastamist.

**Parandus:** üks ühine kohalik eelkontroll peab enne kulureservatsiooni ja ostu kinnitama indeksi dokumentide/üksuste/mahupiirid, embeddingu mõõtmed ning leksikaalse profiili. Kui piirid kasvatatakse, tuleb vastav indekseerimisrada ja ressursikulu kohalike testidega tõendada.

**Embeddingumõju:** piiri parandamine üksi ei muuda teksti ega nõua uusi vektoreid; see on enne ostu lahendatav kulu- ja avaldamisrisk.

### S07 — P1: viiteloendi filter eemaldab endiselt kõrvalveeru põhiteksti

**Koht:** `lib/rag-v2/pdf-layout.js:165`, `:200`; `lib/rag-v2/chunking.js:12`, `:136`. Dokument `ohumarkide-plaan-ja-kriisikaart-2020-1`, `Andmebaasi/ajakiri_sotsiaaltoo/20-1/ST1_2020_web_link_Part12.pdf`, **PDF lk 5 / trükitud lk 57**.

Pealkiri „Viidatud allikad” asub mõlema põhitekstiveeru all, kuid tekstijärjekorras tuleb see vasaku veeru järel ja enne paremat veergu. Seetõttu saab parema veeru põhitekst sama sektsiooni kui päris bibliograafia. Uus bibliograafiliste ridade lävend ei välista viga: lõppseisus jääb otsingutükkidest välja **17 rida / 701 märki**, sh teenuste korraldamise ja inimese kui eksperdi käsitlus. Span'id ja täpsed allikakohad on olemas; tükeldus jätab need välja. 07:11 vahekoopias oli sama kadu 698 märki; hilisem glüüfiparandus taastas kolm punkti.

**Kordamine:** `system-completion-pdf-recheck.mjs`; vaadata vastava väljavõtte sektsiooni `Viidatud allikad`, lk 5 põhiteksti `bbox[1] > 390`, `bbox[0] > 230` ning puudumist `chunks[].span_ids` hulgas. Kokkuvõte `system-completion-pdf-analysis.json.false_reference`; visuaalne tõend `system-reference-column.png`. Kõik 17 rida on samal lehel bibliograafiapealkirjast kõrgemal.

**Parandus:** lõpetada mõlema veeru ülemine tekstipiirkond enne kogu lehe alumise piirkonna pealkirja. Viiteloendi välistamine peab piirduma tegeliku piirkonnaga. Lisada päris mitmeveerulise lehe test, mis kontrollib allesjäänud sisu, mitte ainult eemaldatud sektsiooni nime.

**Embeddingumõju:** parandamine muudab retrieval-teksti ja tõenäoliselt tükkide piire. Vastav dokument vajab uut ettevalmistust enne ostu.

### S03 — P2: kehtivusfilter jätab kõik lõppkuupäevata redaktsioonid välja

**Koht:** `lib/rag-v2/search/ranking.js:39`; algse F07 kehtivusmudeli jätk.

`valid_at` nõuab üheaegselt nii `valid_from` kui ka `valid_to` väärtust. Seetõttu ei sobi tähtajatu vahemik isegi siis, kui alguskuupäev on minevikus. Kohalikust 104 XML-ist on **72 lõppkuupäevata**, neist **70 parsitava sisuga**, kaks kehtetuks muutumise tühja sisu kirjet. Kuupäevaga `2026-09-25` läbib filtri ainult **kaks faili, mis esindavad sama redaktsiooni-ID-d**. See ei ole väide nende aktide praeguse veebikehtivuse kohta.

**Kordamine:** `system-capacity-verified.json.validity` ja `system-xml-recheck.mjs`. Sünteetiline vahemik `2025-01-01` kuni `null` → `false`; sama algus kuni `2027-01-01` → `true`. Näiteks `oigusaktid/403042024076.xml` lõppkuupäev puudub ja filter lükkab selle tagasi.

**Parandus:** eristada tõendatud avatud lõpp ja teadmata kehtivus; kontrollitud avatud lõppu käsitleda lõpmatusena. Tühja sisuga „Kehtetu” kirjet ei tohi selle parandusega aktiivseks dokumendiks muuta. Jurisdiktsioon ja redaktsiooniperekond vajavad endiselt F07 järgi korrastamist.

**Embeddingumõju:** päringuaja filtrit saab parandada uusi vektoreid ostmata. Valiku kehtivuse tähendus ja otsinguprefiksi õiguslik kontekst tuleb siiski enne õigusaktide ostu otsustada.

### S04 — P2: admini loodav leksikaalne indeks ei vasta vaikeotsinguprofiilile

**Koht:** `lib/rag-v2/admin/intake.js:364`, `search/indexing.js:44`, `search/profiles.js:6`, `:30`, `:51`.

Admin ei anna `indexSnapshot`-ile leksikaalset profiili. Vaikimisi valitakse `pg-simple-weighted-or-v1`; `retrievalProfile()` vaikeprofiil nõuab `pg-estnltk175-et-snowball311-en-ru-v1`. Sellise uue indeksi ja vaikeprofiili paar peatub `profile_generation_mismatch`-iga. Väide puudutab seda konfiguratsioonipaari; auditis ei loetud ühegi päris piloodi saladusi ega aktiivset serveriseadistust.

**Kordamine:** `system-capacity-5001.mjs` → `admin_default_profile`. Puhtad `searchConfig(realEmbeddingConfig())` ja `assertProfileGeneration(retrievalProfile(), generation)` kinnitavad vastuolu.

**Parandus:** siduda avaldamisplaani indeksikonfiguratsioon kinnitatud retrieval-profiiliga ja kontrollida ühilduvus enne ostu. EstNLTK kasutus peab olema selgesõnaline ning töövalmidus kontrollitud; vaikset teisele leksikaalsele analüüsile langemist ei tohi lisada.

**Embeddingumõju:** sama teksti korral piisab leksikaalse indeksi uuendamisest ja uue generatsiooni/piloodiseose kinnitamisest. Uued embeddingud pole selle paranduse enda tõttu vajalikud.

Enne ostu jäävad lisaks vajalikuks F06 kanooniline failivalik, F07 õigusaktide kontekst ning F12 allesjäänud leksikaalse sidekriipsu juhtum. Viimane annab ka lõppkoopias `järk-\njärgult` → `järkjärgult`; `step-\nby-step` juhtum on nüüd parandatud. F12 esinemissagedust korpuses ei mõõdetud.

### Vahekoopia hilisemad leiud

Need parandused ei eelda embeddinguteksti muutmist. Piloodi kasutajatele avamise eel tuleb vestluse korrektne sidumine siiski korda teha.

### S05 — P2: profiilide võrdlus-CLI nõuab võimatut generatsioonide kombinatsiooni

**Koht:** `scripts/rag-v2-selection-compare.mjs:76`.

Skript võtab kõik kümme profiili ning nõuab, et sama generatsioon vastaks neile kõigile. Profiilid jagunevad kolme üksteist välistava leksikaalse lepingu vahel: legacy **7**, Snowball **1**, EstNLTK **2**. Ükski generatsioon ei läbi kõiki kontrolle; võrdlussilmuseni ei jõuta.

**Kordamine:** `system-capacity-verified.json.profile_matrix`: kõigi kolme leksikaalse konfiguratsiooni korral leidub `profile_generation_mismatch`. Võrguga CLI-d ennast ei käivitatud; selle täpne eelkontroll korrati puhaste funktsioonidega.

**Parandus:** võrrelda sama generatsiooniga ühilduvaid profiile või võtta igale leksikaalsele variandile eraldi kinnitatud generatsioon ja kandidaadid. Embeddinguid ei pea sama teksti tõttu uuesti ostma.

### S06 — P2: pilootvaate kordussaatmine võib kasutada eelmist vestlust ja küsimust

**Koht:** `app/rag-pilot/pilot-client.jsx:25`, `:47`, `:67`.

Saatmisvea järel säilib `pending.current`. Olemasoleva vestluse avamine seda ei vaheta ega seo uue `convId`-ga. Järgmisel saatmisel eelistatakse vana objekti uuele küsimusele. See on sama kasutaja vestluste vale sidumine; teise kasutaja ligipääsu ei ole selle katsega näidatud.

**Kordamine:** vestluses A küsimuse A saatmine ebaõnnestub; avada olemasolev vestlus B ja sisestada küsimus B; saata. `system-ui-probe.mjs` käivitab komponendist võetud tegelikud `loadConversation`/`submit` funktsioonid API, olekusetterite ja brauseriobjektide kohalike asendajatega. Nähtav sisend on B/B, kuid teine päring sisaldab **A/A ja vana kavatsusevõtit**. Tõend `system-ui-probe.json`. Päris brauseri-/HTTP-katse jäi käivitamata.

**Parandus:** siduda pooleliolev kavatsus vestluse ja sisendi signatuuriga, säilitades sama ebaõnnestunud kavatsuse idempotentsuse ainult selle enda piires. Vestluse vahetamisel taastada vastava vestluse kavatsus; hilised vastused ei tohi teise vestluse vaadet üle kirjutada.

Täiendav reprodutseeritavuse parandus: `search/artifact-provenance.js:15` räsi katab Git-status'e teksti, mitte commit'imata failide sisu. Kahe eri sisuga `M sama-fail` seis võib saada sama kooditõendi. Lisada failide sisuräsid nagu käesoleva auditi manifestis. See ei muuda olemasolevaid vektoreid.



## Täielik süsteemi failikaart

Kõik järgnevad **211 faili** on staatiliselt läbi vaadatud. Teede juur: `C:\Users\rauds\Desktop\Sotsiaal.ee`. Käivitamata testid ja teenused on ülal eraldi nimetatud.

```text
app/
  admin/
    rag/
      ingest/
        page.jsx
      pageHelpers.js
  api/
    admin/
      rag/
        v2/
          intake/
            route.js
    chat/
      pilot/
        route.js
      route.js
  chat-source/
    page.jsx
  rag-pilot/
    page.jsx
    pilot-client.jsx
    pilot.module.css
  vestlus/
    page.js
components/
  admin/
    rag/
      RagAdminIntakeWorkspace.jsx
      RagAdminKnowledgePanel.jsx
      RagAdminPageFrame.jsx
      ragV2Intake.module.css
      ragV2IntakeCopy.js
      ragV2Metadata.js
  alalehed/
    chat/
      ChatBodyView.jsx
  chat/
    hooks/
      useChatStream.js
      usePilotDialogue.js
    PilotContextControls.jsx
deploy/
  rag-v2/
    compose.yml
lib/
  admin/
    rag/
      v2Server.js
  chat/
    m4PilotClientContract.js
    m4PilotIntent.js
    m4PilotServer.js
    questionClauseRoles.js
    questionRequirements.js
    questionRequirementsContract.js
    responsePolicy.js
    responsePolicyContract.js
    routeServerUtils.js
    safety.js
    sourceAttribution.js
    sourceSelection.js
    sourceSelectionContract.js
    sourceTrust.js
  rag/
    sourceFreshness.js
    sourceMetadata.js
  rag-v2/
    adapters/
      municipal-contact-export.js
      municipal-directory.js
      municipal-record.js
      verified-municipal-contact.js
    admin/
      auth.js
      config.js
      http-body.js
      intake.js
      knowledge-jobs.js
    domain-profiles/
      sotsiaalai.json
    evaluation/
      rubric-v2.js
    pilot/
      config.js
      contracts.js
      dialogue-state.js
      dialogue.js
      evidence-draft.js
      evidence-segments.js
      fixed-packet.js
      lifetime.js
      presentation.js
      provenance.js
      provider.js
      record-scope.js
      retrieval-plan.js
      retrieval.js
      service.js
      store.js
      test-transport.js
    search/
      artifact-provenance.js
      capacity.js
      dependencies.js
      discovery.js
      embedding.js
      estnltk-requirements.txt
      estnltk-worker.py
      estnltk.js
      evaluation-plan.js
      evaluator.js
      export.js
      index-jobs-postgres.js
      index-jobs.js
      indexing.js
      lexical-analysis.js
      local-config.js
      model-context.js
      morphology.js
      multi-source-plan.js
      openai-embedding.js
      pilot-manifest.js
      pilot-report.js
      pilot-runner.js
      policy.js
      postgres.js
      profiles.js
      qdrant.js
      query-stopwords.js
      ranking.js
      retrieval.js
      snapshot.js
      structural-role.js
      structured-record-source.js
      types.d.ts
      unified.js
    vendor/
      snowball-3.1.1/
        base-stemmer.js
        COPYING
        english-stemmer.js
        estonian-stemmer.js
        README.md
        russian-stemmer.js
    catalog.js
    chunking.js
    contracts.js
    ingest-batch-postgres.js
    ingest-batch.js
    ingest-publication.js
    ingestion.js
    knowledge-preparation.js
    knowledge.js
    metadata-adapter.js
    metadata-values.js
    normalize.js
    parser.js
    pdf-layout.js
    pdf-worker.js
    processing-implementation.json
    registered-source.js
    source-locations.js
    structured-record.js
    text-source.js
    types.d.ts
  serviceMap/
    contactFreshnessProjection.js
  retention.js
prisma/
  migrations/
    20260906000100_m4_private_pilot/
      migration.sql
    20260907000100_m4_optional_expiry/
      migration.sql
  rag-v2/
    migrations/
      202609050001_local_search/
        migration.sql
      202609230001_ingest_batches/
        migration.sql
      202609230002_morphology/
        migration.sql
      202609230003_index_jobs/
        migration.sql
      202609230004_retrieval_directory/
        migration.sql
      migration_lock.toml
    prisma.config.mjs
    schema.prisma
  schema.prisma
scripts/
  lib/
    rag-v2-rubric-proposal.mjs
  deploy-server.mjs
  rag-v2-contact-export.mjs
  rag-v2-eval-data.mjs
  rag-v2-evaluation-plan.mjs
  rag-v2-index-batch.mjs
  rag-v2-ingest-batch.mjs
  rag-v2-ingest-registered.mjs
  rag-v2-ingest.mjs
  rag-v2-local.mjs
  rag-v2-m4-regression-plan.mjs
  rag-v2-multi-source.mjs
  rag-v2-pilot-plan.mjs
  rag-v2-pilot.mjs
  rag-v2-plan-freshness.mjs
  rag-v2-processing-fingerprint.mjs
  rag-v2-query-variants.mjs
  rag-v2-regrade.mjs
  rag-v2-search.mjs
  rag-v2-selection-compare.mjs
  run-unit-tests.mjs
tests/
  rag-v2-admin-intake.test.mjs
  rag-v2-answer-prompt.test.mjs
  rag-v2-capacity.test.mjs
  rag-v2-dialogue-config.test.mjs
  rag-v2-dialogue-scenarios.integration.test.mjs
  rag-v2-dialogue-state.test.mjs
  rag-v2-dialogue-store.test.mjs
  rag-v2-dialogue.test.mjs
  rag-v2-estnltk.integration.test.mjs
  rag-v2-estnltk.test.mjs
  rag-v2-evidence-draft.test.mjs
  rag-v2-index-jobs.integration.test.mjs
  rag-v2-ingest-batch.integration.test.mjs
  rag-v2-ingest-batch.test.mjs
  rag-v2-ingest-publication.integration.test.mjs
  rag-v2-ingest.test.mjs
  rag-v2-knowledge-preparation.test.mjs
  rag-v2-knowledge.test.mjs
  rag-v2-morphology.integration.test.mjs
  rag-v2-morphology.test.mjs
  rag-v2-pilot-answer-v3.test.mjs
  rag-v2-pilot-answer-v4.test.mjs
  rag-v2-pilot-chat-adapter.test.mjs
  rag-v2-pilot-client-intent.test.mjs
  rag-v2-pilot-config.test.mjs
  rag-v2-pilot-core.test.mjs
  rag-v2-pilot-crisis-route.test.mjs
  rag-v2-pilot-http.test.mjs
  rag-v2-pilot-limit-replay.test.mjs
  rag-v2-pilot-provider.test.mjs
  rag-v2-pilot-replay.test.mjs
  rag-v2-pilot-retrieval.test.mjs
  rag-v2-pilot-store.test.mjs
  rag-v2-pilot.test.mjs
  rag-v2-plan-freshness.test.mjs
  rag-v2-processing-version.test.mjs
  rag-v2-query-stopwords.test.mjs
  rag-v2-record-catalogue-compact.test.mjs
  rag-v2-record-scope.test.mjs
  rag-v2-rubric.test.mjs
  rag-v2-search.integration.test.mjs
  rag-v2-search.test.mjs
  rag-v2-selection.test.mjs
  rag-v2-selective-retrieval.integration.test.mjs
  rag-v2-source-structure.test.mjs
  rag-v2-structured-records.integration.test.mjs
  rag-v2-unified.integration.test.mjs
  rag-v2-unified.test.mjs
  rag-v2-vector-cache.test.mjs
```
