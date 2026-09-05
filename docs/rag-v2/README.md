# Kohaliku RAG v2 sissevõtu kasutamine

See CLI võtab ühe haldaja PDF-i ja JSON-metaandmed vastu ilma väliste mudelikutseteta. Tehniline kaart: [M0 audit](repository-audit.md); andme- ja avaldamisleping: [ADR-001](adr-001-local-ingestion.md); tüübid: `lib/rag-v2/types.d.ts`; käitusaegne valideerimine: `lib/rag-v2/contracts.js`. Aktiivne seis asub ainult [SotsiaalAI.md](../platvormi%20arendus/SotsiaalAI.md) S1.0-s.

## Käivitamine

Node 24 ja `npm ci` repositooriumi lukufaili põhjal. Järgmine PowerShelli käsk on käivitatud `SotsiaalAI-repair-b` juurest; põhikaustas kohanda `--input-root` enda lähtepaketi asukohale. Sisendeid ei pea koodi kõrvale kopeerima.

```powershell
node scripts/rag-v2-ingest.mjs --input-root '../SotsiaalAI/docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1/inputs' --metadata sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos.json --tenant sotsiaalai-development --store tmp/rag-v2-sample --development-only
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
