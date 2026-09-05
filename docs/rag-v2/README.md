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

Testid katavad failiregistri/DB võrdsust, tegelikke kanalifiltreid, katkestust ja taaskäivitust, vana töö hilist aktiveerimist, päringu ajal uue dokumendiversiooni avaldamist, õiguste tühistamist, vektorruumi/tokenipiire, Unicode'i, RRF-i, tsitaatide lahendamist, piiratud graafilaiendust, ET/EN/RU `simple` tokenizer'it, teenusetõrke olekuid ning rikutud põlvkonna/allika/Qdranti viite tõrjumist. R-01 ja R-04 kontrollivad leksikaalset allikakohta ja bibliograafiat; R-02/R-03 semantiline ja mitmekeelne kvaliteet jääb M2.2 katseks. API-võtme olemasolu ei käivita testides mudelikutset.

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
