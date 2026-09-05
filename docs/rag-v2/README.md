# Kohaliku RAG v2 sissevõtu kasutamine

See CLI võtab ühe haldaja PDF-i ja JSON-metaandmed vastu ilma väliste mudelikutseteta. Tehniline kaart: [M0 audit](repository-audit.md); andme- ja avaldamisleping: [ADR-001](adr-001-local-ingestion.md); tüübid: `lib/rag-v2/types.d.ts`; käitusaegne valideerimine: `lib/rag-v2/contracts.js`. Aktiivne seis asub ainult [SotsiaalAI.md](../platvormi%20arendus/SotsiaalAI.md) S1.0-s.

## Käivitamine

Node 24 ja `npm ci` repositooriumi lukufaili põhjal. Järgmine PowerShelli käsk on põhikausta `SotsiaalAI` jaoks. Sama CLI läbis näidise sissevõtu parandustööpuus enne koodi muutmata integreerimist `main`-i. Sisendeid ei pea teise tööpuusse kopeerima.

```powershell
node scripts/rag-v2-ingest.mjs --input-root 'docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs' --metadata sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos.json --tenant sotsiaalai-development --store tmp/rag-v2-sample --development-only
```

`--input-root`, `--metadata`, `--tenant`, `--store` ja `--development-only` on kohustuslikud. `source_path` metaandmetes lahendatakse ainult lubatud sisendjuure sees; absoluutne tee, `..` ja juurest väljuv sümbollink/junction lükatakse tagasi. UTF-8 failinimed on toetatud. Väljavõtete HTML ja JSON võivad sisaldada kogu algteksti: hoia `--store` privaatses, Gitist ignoreeritud kataloogis (siin `tmp/`), mitte `public/` all.

`--profile FILE.json` lubab teise deklaratiivse valdkonnaprofiili. Profiili kuju: `id`, `version`, valikulised `months`, `categoryLabels`, `assetReviews`. Profiil ei sisalda käivitatavat koodi. `--config FILE.json` lubab muuta piiranguid, näiteks `{"chunkMaxChars":1800,"maxPages":100}`. Vaikeväärtused on `DEFAULT_CONFIG`-is; tundmatud valikud ja toetamata töötlusversioonid annavad vea. OCR ja keelemudeliga rikastamine puuduvad.

Väljundkonsool näitab ainult töö tunnuseid, mahtusid, hoiatuste koode ning väljundkausta. Vead ei väljasta lähtefaili sisu. CLI tagastab vea korral väljumiskoodi 1. `--development-only` kirjeldab selle kohaliku töö kasutuspiiri; see ei loo avaldamisluba ega anna kasutajale platvormi admini õigusi.

## Väljundi lugemine

`<store>/tenant_<hash>/active.json` on aktiivse põlvkonna manifest. Selle `documents` kaart viitab `versions/version_<hash>/` muutmatutele versioonidele:

| Fail | Sisu |
| --- | --- |
| `original.pdf`, `metadata.json` | Sisendite täpsed muutmata baidid |
| `bundle.json` | Dokumendi-, versiooni-, õiguste-, tekstielementide-, leheteksti-, allikakoha-, lõigu-, peatüki-, tekstiosa- ja seosteregister |
| `provenance.json` | Normaliseeritud väljade masinloetav päritolukaart |
| `spans.json` | PDF-lehed, täpsed tekstivahemikud ja koordinaadid |
| `chunks.json` | Alg- ja otsingutekst, allikakohad, peatükk, naabrid ning embedding-sisendi räsi |
| `report.html` | Kohalik inimloetav ülevaade koos PDF-lehe linkidega |
| `manifest.json` | Kõigi versioonifailide SHA-256 kontrollsummad |

`jobs/<attempt>.json` eristab `received`, `validated`, `parsed`, `staged`, `published`, `failed`. Kordusimport võib juba kontrollitud versiooni taaskasutada ilma parserita. `usable_with_warnings` on sisulise kvaliteedi seis, mis ei võrdu töö avaldamisoleku ega kõigi väidete kinnitamisega.

## Taaskäivitamine ja taastamine

Tavalise vea järel paranda sisend ja käivita sama käsk uuesti. Aktiivset manifesti ei muudeta enne kõigi uue versiooni osade valmimist. Vanad versioonid säilivad, et varem antud viide ei muutuks vaikselt uueks tekstiks. Kustutamise/säilituse ning kliendi ligipääsu tühistamise API lisandub enne pärisandmetega ühendamist.

Kui protsess katkestati jõuga ja CLI ütleb `catalog_busy`, kontrolli täpsest tenant-kaustast `writer.lock` faili PID-d ning kinnita operatsioonisüsteemist, et vastav töö enam ei käi. Alles siis eemalda **see üks** lukufail; ära lõpeta tundmatut protsessi ega kustuta aktiivset registrit. `staging-*` orvud ei kuulu aktiivsesse kogusse ja võivad kuni eraldi hoolduseni alles jääda. Algallikaid ega versioone taastamiseks üle ei kirjutata.

Enne hoidla failitaseme varundamist peata selle CLI kirjutused ja kopeeri **kogu** tenant-kaust privaatsesse asukohta. Taastamisel säilita versioonid, originaalid, manifest ja tööjäljed koos. Kontrolli taastatud versioonide räsid `loadVersion()` abil enne kasutamist. See on M1 lokaalne protseduur; päris varundus-taastamiskatse ja tootmise reindekseerimine on M6 vastuvõtuväravad ning selle tööga `NOT_PROVEN`.

## Sihttestid ja tõendi piir

```powershell
$env:TZ = 'UTC'
$env:RAG_V2_INPUT_ROOT = 'C:/Users/rauds/Desktop/SotsiaalAI/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs'
node --test tests/rag-v2-ingest.test.mjs
```

Testifail katab paketi I-01…I-15 ning konkreetseid M1 riske: duplikaadikonflikt, versiooniviited, muutumatu embedding-sisend, teise profiili eraldatus, registri/versiooni rikkumine, piirangud, failitee junction ja päisega sama sisuteksti säilimine. Päris PDF-i testid vajavad ülaltoodud sisendjuurt; selle puudumisel on need ausalt `skip`, mitte roheline artiklitõend. Sünteetilised parserinäited on testikoodis eraldi ning neid ei lisata näidisartiklisse ega päriskorpusse. Test teeb oma ajutisse kausta sissevõtud ja koristab ainult selle kausta.

PDF lk 1, 3, 5, 8, 12 ja 13 renderdati ning vaadati üle: pealkiri/kuupäev, neli põhialapealkirja ja suletud „Viidatud allikad” ala vastavad ingest'i kasutatud alustele. Üks artikkel ei tõenda teiste failitüüpide, tabelite, OCR-i, semantilise graafi, mitmekeelse otsingu ega kümne aasta korpuse kvaliteeti.

Väike staatiline värav:

```powershell
npx eslint lib/rag-v2/contracts.js lib/rag-v2/pdf-worker.js lib/rag-v2/parser.js lib/rag-v2/normalize.js lib/rag-v2/catalog.js lib/rag-v2/ingestion.js scripts/rag-v2-ingest.mjs tests/rag-v2-ingest.test.mjs
git diff --check
```

Peatüki lõpus kasutatakse projekti tavalist `npm run build` käsku (sisaldab `i18n:check`). Prisma valideerimist pole selle ploki tõttu vaja, sest skeemi ega migratsioone ei muudeta. Autenditud admini-, kasutaja-, privaatsus- ja DB-radu see test ei tõenda ega asenda admini käsitsi RAG-enesetesti.

## M2.1: kohalik PostgreSQL + Qdrant

[ADR-002](adr-002-local-hybrid-search.md) kirjeldab põlvkondi, õigusi, tokenipiiri, kanaleid ja tõendi piire. Otsingutuuma kood on `lib/rag-v2/search/`; HTTP-otsing, chat ja admini enesetesti `retired` olek jäävad selle plokiga muutmata.

Docker peab töötama. Järgmised käsud on käivitatud põhikaustas:

```powershell
node scripts/rag-v2-local.mjs up
node scripts/rag-v2-local.mjs migrate
node scripts/rag-v2-local.mjs validate
```

`up` loob eraldi `sotsiaalai-rag-v2` compose-projekti, teenused ja andmeköited. PostgreSQL 16.13 kuulab ainult `127.0.0.1:55432`, Qdrant 1.15.5 ainult `127.0.0.1:56333`. Pildid on digestiga lukustatud. Paroolid/võti genereeritakse kohalikku ignoreeritud `tmp/rag-v2-services/` kausta; neid ei lisata Gitti. `migrate` kasutab Prisma eraldi kohalikku konfiguratsiooni ega loe platvormi `DATABASE_URL` väärtust. `stop` peatab ainult need teenused ja säilitab köited. Olemasoleva platvormi konteinerid jäävad puutumata.

Kohalik usaldatud poliitikafail kirjeldab eksplitsiitselt tenant'i, operaatorit ja lubatud dokumendi-ID-sid. Näidise jaoks on kasutatud `tmp/rag-v2-services/sample-policy.json`:

```json
{
  "tenants": {
    "sotsiaalai-development": {
      "operator": ["document_a360b102f9ca757e85023f68a1b0c87606f9a1f2c059e0e5743665b0b2e4274b"]
    }
  }
}
```

See on kohaliku arendusoperaatori luba, mitte veebikasutaja autentimine ega materjali välisele mudeliteenusele saatmise luba. Loendi tühjendamine tühistab selle operaatori ligipääsu; päring loeb poliitika uuesti vahetult enne tõenduspaketi tagastamist. Teise tenant'i tunnus ei anna ligipääsu.

Indekseeri M1 aktiivne lubatud versioonipilt ja tee päring:

```powershell
node scripts/rag-v2-search.mjs --mode index --tenant sotsiaalai-development --subject operator --store tmp/rag-v2-sample --policy tmp/rag-v2-services/sample-policy.json --development-only
node scripts/rag-v2-search.mjs --mode retrieve --tenant sotsiaalai-development --subject operator --policy tmp/rag-v2-services/sample-policy.json --query OTT --language et --output tmp/rag-v2-query --development-only
```

CLI väljastab tunnused, loendused ja ajamõõtmised; algtekst läheb ainult privaatsesse `evidence.json` ja `evidence.html` faili. `--graph` lisab piiratud struktuurse naabrilaienduse. Täpsemad eelarve-, piirkonna- ja ajafiltrid on tuuma `retrieve()` liideses (`types.d.ts`); need ei ole selle CLI vaikimisi oletused. Päringu väljund on tõenduspakett, mitte mudeli koostatud vastus. Teenuste versioonid, platvorm ja `measured_query_runs=1` salvestatakse paketi mõõtmistesse. Üks mõõtmine ei ole p95 ega koormustest.

`--connections FILE.json` saab määrata teise kohaliku ühendusfaili, kuid adapter aktsepteerib endiselt ainult ülaltoodud määratud sihtkohti. Tõrge ei tohi suunata päringut avalikku või tootmisteenusesse. CLI `retrieve` kirjutab ainult `tmp/` alla.

Katkestatud indeksit saab sama `--mode index` käsuga jätkata. Vana aktiivne põlvkond säilib kuni kõigi uute andmete kontrollini. `superseded_index_job` tähendab, et uuem töö on juba registreeritud; vana töö ei aktiveeru selle asemel. Vanu PostgreSQL-i põlvkondi, Qdranti kollektsioone ega M1 versioone ei kustutata automaatselt. Lokaalse hoolduse korral peata indekseerijad/pärijad ning võrdle kõigepealt iga tenant'i `rag_v2_head.active_id` väärtust; aktiivset ega pooleliolevat põlvkonda ei kustutata. Käesolev plokk ei paku üldist kustutuskäsku ega tõenda tootmise retention'it.

M2.1 sihttestid kasutavad olemasolevat Node'i testikäivitajat:

```powershell
$env:TZ = 'UTC'
$env:RAG_V2_INPUT_ROOT = 'C:/Users/rauds/Desktop/SotsiaalAI/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs'
node --test tests/rag-v2-ingest.test.mjs
node --test tests/rag-v2-search.test.mjs tests/rag-v2-search.integration.test.mjs
```

Integratsioonitesti nimi tähendab päris PostgreSQL-i ja Qdranti. Ühendusfaili, teenuse või näidis-PDF-i puudumisel see test ebaõnnestub; neid ei asendata rohelise mock-tulemuse või vaikse skip'iga. Teenuseadaptrite võrku lubatakse ainult määratud kahele kohalikule pordile. Ühiktestide võrk on keelatud. Sünteetilised aiandus-/eksitusdokumendid kasutavad eraldi juhuslikke testtenant'e ning koristatakse pärast jooksu, säilitades operaatori näidise.

Testid katavad failiregistri/DB võrdsust, tegelikke kanalifiltreid, katkestust ja taaskäivitust, vana töö hilist aktiveerimist, päringu ajal uue dokumendiversiooni avaldamist, õiguste tühistamist, vektorruumi/tokenipiire, Unicode'i, RRF-i, tsitaatide kanoonilist lahendamist, piiratud graafilaiendust, ET/EN/RU `simple` tokenizer'it, teenusetõrke olekuid ning rikutud põlvkonna/allika/Qdranti viite tõrjumist. R-01 ja R-04 kontrollivad leksikaalset allikakohta ja bibliograafiat; R-02/R-03 semantilist ja mitmekeelset rada kontrolliti hiljem piiratud M2.2 pärispiloodis. API-võtme olemasolu ei käivita testides mudelikutset.

M2.1 staatiline värav ja peatüki build:

```powershell
npx eslint lib/rag-v2/search/*.js lib/rag-v2/parser.js lib/rag-v2/pdf-worker.js scripts/rag-v2-search.mjs scripts/rag-v2-local.mjs scripts/rag-v2-evaluation-plan.mjs tests/rag-v2-search.test.mjs tests/rag-v2-search.integration.test.mjs prisma/rag-v2/prisma.config.mjs
node scripts/rag-v2-local.mjs validate
git diff --check
npm run build
```

## M2.2 prooviplaani valmistamine ilma väliskutseteta

```powershell
node scripts/rag-v2-evaluation-plan.mjs --store tmp/rag-v2-sample --tenant sotsiaalai-development --subject operator --policy tmp/rag-v2-services/sample-policy.json --output tmp/rag-v2-query/m2-2-plan.json
```

`tests/evaluation/rag-v2-queries.json` sisaldab seitset pärisartikli küsimust (sh OTT-i ja dokumenteerimise ET/EN/RU perekonnad) ning kaht praeguses korpuses vastuseta küsimust. Oodatud allikakohti määravad artikli PDF-räsi, leht ja algteksti fraas, mitte praeguse järjestaja tulemused. Plaan lahendab need konkreetseteks SourceSpan ID-deks. Sünteetiliste õiguste-/mehaanikatestide tähendus ei kandu pärisartikli kvaliteedihinnanguks.

Plaan arvestab `text-embedding-3-large`, 3072 mõõdet, iga sisendi tegelikke tokeneid, külma vahemälu ja ühte katset sisendi kohta, ilma korduskatseteta. Genereerivaid kutseid on 0. Valikuline `--prices FILE.json` võtab `input_per_million`, `currency` ja `version` väljad; hinnata on rahaline kulu **teadmata**, mitte null. Hinnang ei ole omaniku kinnitatud kulupiir. Enne päris M2.2 käivitust peab omanik kinnitama nii plaanis nimetatud materjalide saatmise välisele teenusele kui ka konkreetse kulupiiri. Selle plaani generaatoris pole välist mudeliadapterit ega käivituskäsku.

## M2.2 ehitus, audit ja piiratud piloot

[ADR-003](adr-003-approved-embedding-pilot.md) määrab täieliku auditi, kompaktse mudelikonteksti, struktuurse rolli ning loa-/kulupäeviku lepingu. Varasem ettevalmistusgeneraator jääb alles; päriskatse eraldi käsk on `scripts/rag-v2-pilot.mjs`.

Vaikimisi tehakse **ainult kuivjooks**:

```powershell
node scripts/rag-v2-pilot.mjs
```

Vaikesisendid on M1 näidishoidla, `sample-policy.json`, vana `m2-2-plan.json`, `evidence.json` ning muutmata üheksa küsimusega fail. Kuivjooks võrdleb kõiki sisendiräsisid ja tokeniarve algse plaaniga ning kirjutab privaatsesse `tmp/rag-v2-m2-2/` kausta väljasaatmismanifesti, ankrurühmad, säilitatud vana auditi, konteksti enne/pärast võrdluse ja kompaktse näidise. API-võtit ei nõuta ja väliskutseid ei tehta.

Päriskatse vajab omaniku tegeliku kinnituse alusel koostatud `rag-v2/pilot-approval-1` loakirjet ja värskelt kontrollitud hinnakirjet. Need on privaatsed käitusfailid, mitte Gitti lisatavad mallid. Võtit ei kirjutata loakirjesse ega käsureale; see loetakse `OPENAI_API_KEY` keskkonnamuutujast (või kohalikust `.env.local` failist).

```powershell
node scripts/rag-v2-pilot.mjs --execute --approval tmp/rag-v2-m2-2/approval.json --price tmp/rag-v2-m2-2/price.json
```

Omanik kinnitas 05.09 vestluses olemasoleva 16 tekstiosa + 9 küsimuse plaani, kuni 25 katset, kuni 12 420 sisendtokenit ja kuni 0,05 USD, automaatsete korduste ning Luna kutseteta. Sama vestlus lubas GitHubi kaudu serveri uuendamise ja katse serveris. See tekst dokumenteerib antud loa ulatust; käivitus kontrollib lisaks konkreetse manifesti räsi, tegelikku loakirjet, praegust poliitikat ja hinda. Uus tekst, mudel või ulatus ei päri seda luba.

`usage/pilot_<hash>/ledger.json` säilitab sama manifesti katsete, tokenite ja nanodollarite reserveeringud ka protsessi taaskäivitamisel. `unknown` või alles `reserved` kirje järel automaatset uut katset ei tehta. Edukad vektorifailid kontrollitakse räsiga üle. Päevikut, vektorifaile ega `pilot.lock` lukku ei kustutata limiidi lähtestamiseks; mahajäänud luku puhul kontrollitakse enne ainult selle töö PID-d. Materjali õiguse muutus kontrollitakse enne iga väliskutset.

Pärast kõigi 25 sisendi edukat salvestamist indekseeritakse vektorid PostgreSQL-i/Qdranti eraldi `real` põlvkonda. Nelja meetodi 36 võrdlusrida kasutavad samu salvestatud päringuvektoreid. Leksikaalne rada ei loe päringuvektorit. `pilot-results.json` ja `pilot-report.html` esimene tulemus säilib; kordus ei kirjuta seda üle ega tee uusi embedding-kutseid. Halb tulemus raporteeritakse juhtumina, kuldmärgendeid ei muudeta selle varjamiseks.

Kontrollid:

```powershell
$env:TZ = 'UTC'
$env:RAG_V2_INPUT_ROOT = 'C:/Users/rauds/Desktop/SotsiaalAI/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs'
node --test tests/rag-v2-ingest.test.mjs tests/rag-v2-search.test.mjs tests/rag-v2-search.integration.test.mjs tests/rag-v2-pilot.test.mjs
npx eslint lib/rag-v2/search/*.js scripts/rag-v2-pilot.mjs tests/rag-v2-pilot.test.mjs tests/rag-v2-search.integration.test.mjs
git diff --check
npm run build
```

Tavalised testid kasutavad välise transpordi asendust, kuid PostgreSQL/Qdrant integratsioon on päris. API-kulu arvestatakse ainult eraldi lubatud käivitusel. M2.2 lisas olemasolevale integratsioonitestile 3072-mõõtmelise transpordifikstuuri, nelja raja võrdluse ja tegeliku Qdranti vektorisisu rikkumise kontrolli. Testtranspordiga tulemus ei saa semantilise kvaliteedi kinnitust.

### 05.09 piiratud pärispiloodi tulemus

Serveris tehtud kinnitatud piloot kasutas 16 muutmata tekstiosa ja 9 küsimust. Kõik 25 `text-embedding-3-large` katset õnnestusid ühe saatmisega sisendi kohta; lokaalne ja API raporteeritud tokeniarv oli 12 420 ning hinnaga 0,13 USD miljoni sisendtokeni kohta oli arvestuslik kulu 0,001614600 USD. Genereerivaid ja Luna kutseid oli 0. Korduskäivitus kasutas räsiga kontrollitud salvestatud vektoreid ning tegi 0 uut API-katset.

Kuue ET/EN/RU sisuküsimuse nõutud allikakohad olid hübriidraja lõppkontekstis 6/6 ja top-1-s 6/6, pärisvektorraja lõppkontekstis 6/6 ning leksikaalses rajas 4/6. Struktuurne laiendus käivitus 9/9, kuid selle eraldi kvaliteedilisa ei ole selle valimiga tõendatud. Lõplik M0–M2.2 komplekt koos turvaparandustega läbis kohalikult ja serveris 57 testi, 0 vea ning 0 skip'iga. Täielik ulatus, turvaauditi leiud ja piirid on [M0–M2.2 auditis](../audits/rag-v2-m2-2-audit-2026-09-05.md).

Serveri käitus kasutab sama koodi GitHubist. Kohalikud algmaterjalid ja privaatsed loakirjed/väljundid viiakse serveri privaatsesse `tmp/` hoidlasse eraldi; neid ei avaldata Git-repositooriumis. Serveri `OPENAI_API_KEY` jääb `/etc/sotsiaalai/frontend.env` seadistusse. Uued konteinerid on seotud ainult loopback-portidega; olemasolev platvormi andmebaas jäi eraldi. Vana RAG-i/research-worker'i teenused on `inactive/disabled` ning frontendi unit ei sõltu neist enam. Rakenduse chat ja käsitsi enesetest jäävad M4 ühenduseni ausalt `retired` olekusse.
