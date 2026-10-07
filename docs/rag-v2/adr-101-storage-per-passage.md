# ADR-101 — Serveri ruumikulu lõigu kohta: kus see kulub ja kuidas seda vähendada (ettepanek)

Kuupäev: 07.10.2026. Seotud: ADR-036 (versioonipõhine indeks), ADR-060 (versioonide koristus), ADR-099 (uudiskirja dokumendid), ADR-100 (indeksi mahupiir).

**Seis: viis ettepanekut allpool on tegemata ja omanik jättis need 07.10.2026 kõrvale („ära siis tee seda üldse“). Selle asemel on serveri hoidla kokku pakitud (jaotis „Tehtud: serveri hoidla pakkimine“), ilma süsteemi muutmata.** Ettepanekud jäävad kirja juhuks, kui ketas uuesti piiriks saab.

## Probleem

Korpuse kasvu piirab serveri ketas, mitte raha ega indeksi mahupiir. 07.10.2026 lisati kolme täiendusega 153 dokumenti (17 420 lõiku) 1,49 USD eest, aga ruumi tegemiseks tuli serverist maha võtta LiveKiti kõnesalvestus ja pärast v68 on vaba 4,0 GB (94% täis). Üks lõik võtab serveris umbes 365 KB.

## Mõõtmine

Loetud serverist 07.10.2026 pärast korpust v68 (8258 dokumenti, 67 799 lõiku), ainult arvud. Mahud on kettal võetud ruum; hoidlas jagavad sama sisuga originaalid ühte faili ja on loetud üks kord.

| Kus | Maht | Lõigu kohta |
|---|---:|---:|
| RAG-andmebaas `rag_v2_dev` (andmeköide on 1–2 GB suurem) | 10,0 GB | 155 KB |
| Korpuse hoidla failid (`rag-v2-corpus-store-v25`, 8692 versiooni) | 8,3 GB | 128 KB |
| Ostetud vektorite failid (`rag-v2-corpus-embeddings/usage`, 66 653 faili) | 4,0 GB | 62 KB |
| Vektorihoidla (Qdrant) | 1,4 GB | 21 KB |
| **Kokku** | **umbes 24 GB** | **umbes 365 KB** |

Andmebaas tabelite kaupa:

| Tabel | Maht | Mis seal on |
|---|---:|---|
| `rag_v2_object` | 5044 MB | iga dokumendiversiooni osad eraldi ridadena (3,2 miljonit rida: lõigud, viited, tekstiplokid, seosed) |
| `rag_v2_vector_cache` | 2132 MB | 66 485 lõigu vektorid JSON-ina |
| `rag_v2_version` | 1443 MB | dokumendiversiooni terve pakk (`bundle`) |
| `rag_v2_version_unit` | 1319 MB | otsingulõigud: tekst, sõnavormid, otsinguvektorid sõnalise otsingu jaoks |
| `rag_v2_generation_document` | 472 MB | iga põlvkonna iga dokumendi kataloogikirje (22 põlvkonda) |
| muud | 165 MB | |

Hoidla failid liigi kaupa:

| Fail | Maht | Märkus |
|---|---:|---|
| `bundle.json` | 4417 MB | versiooni pakk, kirjutatud taanetega |
| `original.pdf` | 1202 MB | PDF-ide originaalid |
| `spans.json` | 1169 MB | sama, mis on `bundle.json` sees |
| `chunks.json` | 490 MB | sama, mis on `bundle.json` sees |
| `report.html` | 250 MB | tehtud pakist |
| `original.json` | 109 MB | struktureeritud allikate originaalid; 6106 versiooni jagavad 370 faili |
| muud (`original.xml`, `provenance.json`, `metadata.json`, `manifest.json`, `original.html`) | 192 MB | |
| `publications` | 433 MB | 52 avaldamiskirjet |

Kokkupakkimise proovid üksikutel failidel: `bundle.json` 2,44 MB → taaneteta 1,85 MB → gzip 0,38 MB (16%), väiksem `bundle.json` 83 KB → 9 KB (11%); vektorifail 61 KB → gzip 16 KB (27%), sama vektor kahendarvudena oleks 12 KB; avaldamiskirje 18,6 MB → 1,4 MB (8%).

## Mis koopiat mis loeb

Koodist loetud (`lib/rag-v2/search/postgres.js`, `index-jobs.js`, `indexing.js`, `pilot-runner.js`, `lib/rag-v2/catalog.js`).

| Koopia | Vestluse ajal | Korpuse täiendus serveris | Muu |
|---|---|---|---|
| `rag_v2_version.bundle` | jah (tõendi tekst ja allikakirje) | kirjutab | |
| `rag_v2_version_unit` | jah (sõnaline otsing) | kirjutab | |
| Qdrant | jah (vektoriotsing) | kirjutab | |
| `rag_v2_generation_document` | jah, ainult töötav põlvkond | kirjutab uue põlvkonna | vanu põlvkondi ei loe keegi |
| `rag_v2_object` | **ainult võrdluseks**: kord protsessi kohta võrreldakse ridu sama andmebaasi `bundle` väljaga, edasi loetakse ainult ridade arvu | kirjutab ja võrdleb | ükski otsing ega vastus neid ridu ei kasuta |
| `rag_v2_vector_cache` | ei | uue lõigu vektor loetakse failist ja kirjutatakse siia; olemasoleva lõigu vektorit ei loeta | indeksi `--mode verify` loeb vanade versioonide vektorid siit |
| vektorifailid | ei | loetakse ainult ostuarvestus (`ledger`) ja nende lõikude failid, mida parajasti indekseeritakse | ostu tõend; ilma failita tuleks sama vektor uuesti osta |
| hoidla failid | ei | loetakse ainult uute dokumentide versioonid (`--indexed`) | täiskontroll `--mode verify` ja indeksi nullist ehitamine loevad kõik |

Teksti hoitakse seega kuues kohas (hoidlas pakk, lõigud ja viited eraldi failidena; andmebaasis pakk, osad ridadena ja otsingulõigud) ja vektorit neljas (fail, vahemälu tabel, Qdrant, ja ostuarvestus viitab failile), kuigi vestlus loeb teksti kahest ja vektorit ühest kohast.

## Ettepanekud

Järjestatud suuruse ja lihtsuse järgi. Säästud on mõõdetud mahud; kokkupakkimise säästud on ühe faili proovi suhte järgi.

| # | Mis | Sääst | Mida see nõuab |
|---|---|---:|---|
| 1 | `rag_v2_object` ära jätta | 4,9 GB | koodimuudatus, siis tabeli kustutamine |
| 2 | Hoidla failid: `spans.json`, `chunks.json` ja `report.html` ära jätta (1,9 GB), `bundle.json` gzip-iga (umbes 3,7 GB) | umbes 5,6 GB | hoidla vormingu uus versioon, ühekordne ümberpakkimine |
| 3 | Vektorifailid gzip-iga | 3,0 GB | väike koodimuudatus, ühekordne kokkupakkimine |
| 4 | `rag_v2_vector_cache` tühjendada | 2,1 GB | koodimuudatust ei vaja; `--mode verify` vajab enne väikest muudatust |
| 5 | Vanad põlvkonnad ja nende versioonid koristada | umbes 0,6 GB | väike tööriist põlvkondade eemaldamiseks, siis olemasolev `rag-v2-prune-versions.mjs` |
| | **Kokku** | **umbes 16 GB** | |

Pärast kõiki viit oleks RAG serveris umbes 8 GB 24 GB asemel ja lõik võtaks umbes 120 KB.

### 1. `rag_v2_object` (4,9 GB)

Tabel on versiooni paki teine koopia samas andmebaasis. Ainus lugeja on võrdlus `bundles()` sees: kas read on samad, mis pakis. Pakki ennast kontrollitakse juba räsiga (`bundle_hash`). Võrdlus kaitseb seega ainult tabelit, mida keegi muu ei loe.

- **Parandus (07.10.2026, leitud enne tegema hakkamist): tabelit ei saa tervikuna kustutada.** Otsingulõikude tabelitel `rag_v2_unit` ja `rag_v2_version_unit` on võõrvõti selle tabeli lõiguridadele (`prisma/rag-v2/migrations/202609050001_local_search`, `202609270001_version_index`). Turvaline kuju on jätta alles read liigiga `chunk` (umbes 0,4 GB) ja eemaldada ülejäänud; sääst on siis umbes **4,4 GB**, mitte 4,9. Lugemiskontroll peab siis võrdlema ainult lõiguridu ja töötama nii enne kui pärast ridade eemaldamist.
- 3,1 miljoni rea kustutamine tuleb teha osade kaupa, kontrollpunktidega vahel, et eelkirjutuslogi ketast täis ei kirjutaks; ruum vabaneb pärast tabeli ümberkirjutamist (`VACUUM FULL`).
- Muudatus: import kirjutab ainult lõiguread, `bundles()` võrdleb ainult neid; testid, mis rikuvad viiterida ja ootavad viga `source_object_integrity_failed`, lähevad kaasa.
- Järjekord on oluline: praegune kood annab vea, kui read puuduvad. Enne kood, siis read.
- Tagasi: tabel on täielikult pakkidest tuletatav (sama sisestuskood); vana väljalase koos uuesti täidetud tabeliga töötab.
- Risk: kaob teine kontroll. Jääb paki räsi kontroll igal lugemisel.

### 2. Hoidla failid (umbes 5,6 GB)

`loadVersion` nõuab praegu täpselt seitset faili ja kontrollib igaühe räsi. `chunks.json`, `spans.json` ja `report.html` kirjutatakse pakist ja neid saab pakist alati uuesti teha.

- Muudatus: manifesti uus versioon, kus tuletatud faile ei ole ja `bundle.json` võib olla gzip-iga (räsi arvestatakse lahtipakitud sisult, et versiooni identiteet ei muutuks); lugeja oskab mõlemat vormingut. Ühekordne ümberpakkimine serveris ja sülearvutis. Avaldamiskirjed (433 MB, pakituna umbes 35 MB) võib samas pakkida; see annaks veel 0,4 GB.
- Tagasi: ümberpakkimine on pööratav (lahti pakkida, tuletatud failid uuesti kirjutada).
- Risk: keskmine. Hoidla on korpuse algallikas; ümberpakkimine tuleb teha pärast varukoopiat ja kontrollida iga versiooni räsi enne vana faili eemaldamist.
- PDF-e ja muid originaale ei puututa.

### 3. Vektorifailid (3,0 GB)

Täiendus loeb vektorifaile laisalt: ainult nende sisendite omad, mida parajasti indekseeritakse. Vanu faile loetakse ainult siis, kui vana versiooni indeks tuleb uuesti kirjutada.

- Muudatus: `verifiedStoredVector` loeb `vector-….json.gz`, kui `.json` puudub (räsi kontroll jääb kirje sisule); ühekordne kokkupakkimine.
- Tagasi: lahti pakkida.
- Risk: väike. Alternatiiv ilma koodita on vanade ostude failid serverist ära tõsta ja jätta ostuarvestus paika, aga siis ebaõnnestub täiendus, mis vajab vana vektorit; seda ma ei soovita.

### 4. `rag_v2_vector_cache` (2,1 GB)

Indeksi töö küsib vektorit esmalt siit; kui ei ole, loeb ostetud failist ja kirjutab siia. Tühja tabeliga töötab täiendus samamoodi (iga esmane paigaldus algab tühjast). Vestlus tabelit ei loe.

- `TRUNCATE` vabastab ruumi kohe ja koodimuudatust ei vaja.
- Hind: indeksi täiskontroll (`--mode verify`) loeb vanade versioonide vektorid siit ja annab tühja tabeliga vea `index_vector_checkpoint_missing`. Enne tühjendamist tuleks `verify` panna lugema ostetud failidest; muidu jääb see hooldustööriist kasutuskõlbmatuks.
- Tabel täitub uute lõikudega uuesti; et see ei korduks, peaks indeksi töö pärast versiooni pitseerimist oma read eemaldama.
- Tagasi: täitub failidest.

### 5. Vanad põlvkonnad (umbes 0,6 GB)

Andmebaasis on 22 põlvkonda; vestlus kasutab ühte. Põlvkonna eemaldamise tööriista ei ole. 2317 versiooni ei kuulu töötavasse põlvkonda (pakid 122 MB, objektid 239 MB, lõigud 40 MB, lisaks nende punktid Qdrantis ja 434 kausta hoidlas).

- Muudatus: tööriist, mis jätab alles viimased N põlvkonda (ettepanek: töötav ja eelmine); seejärel olemasolev `rag-v2-prune-versions.mjs --execute` (ADR-060).
- Risk: eelmisele põlvkonnale tagasi minna saab ainult siis, kui see on alles; vanematele mitte.

## Tehtud: serveri hoidla pakkimine

Omanik küsis ettepanekuid nähes: „aga kokku pakkida hoidla serveris?“ ja „väga hea ju. Ja kui lisandub süsteemi veel faile, siis saad need ka millalgi kokku pakkida“. See ei muuda süsteemi: failide vorming jääb samaks, juba indekseeritud versioonide kaustad hoitakse lihtsalt ühe kokkupakitud arhiivina.

**Miks see on ohutu.** Vestlus hoidla faile ei loe. Täienduse plaanisammud jätavad juba pitseeritud versiooni vahele enne selle failide avamist (`buildCorpusEmbeddingPlan`, `planIndexJob`). Enne pakkimist proovitud serveris: versioonide kaust tõsteti kõrvale ja töötava poliitika (v68) mõlemad plaanisammud jooksid läbi (ostuplaan: 0 dokumenti, 8258 valmis; indeksi plaan: 0 indekseerida); pärast pakkimist uuesti, sama tulemus.

**Tööriist:** `scripts/rag-v2-store-pack.sh` (serveris `/home/ubuntu/rag-v2-work/`).

```bash
T=$(ls -d /home/ubuntu/rag-v2-work/rag-v2-v25/tmp/rag-v2-corpus-store-v25/tenant_*)
sh rag-v2-store-pack.sh pack   $T /home/ubuntu/rag-v2-work/rag-v2-v25/tmp/rag-v2-corpus-index-v<N>/index-plan.json
sh rag-v2-store-pack.sh list   $T
sh rag-v2-store-pack.sh unpack $T                # kõik tagasi lahti
sh rag-v2-store-pack.sh unpack $T <versiooni id> # üks versioon
```

- Pakitakse kaustad, mille versioon on töötava korpuse indeksi plaanis (pitseeritud), ja kaustad, mida hoidla pea üldse ei nimeta. Pea versioon, mis ei ole veel indeksis, jääb lahti: järgmine täiendus loeb seda.
- Enne lahtise kausta eemaldamist võrreldakse arhiivi iga liiget kettal oleva failiga; mis tahes erinevus jätab kõik nii, nagu oli.
- Iga käivitus teeb ühe arhiivi `versions-packed/pack-<aeg>.tar.zst` koos versioonide loendi ja räsiga. **Pärast iga täiendust pakib käivitusskript uued kaustad ise** (`scripts/rag-v2-corpus-run.sh` viimane samm; pakkimise ebaõnnestumine ei tee käivitust ebaõnnestunuks, vaid annab hoiatuse ja sama käsu saab siis käsitsi käivitada).
- Kaust, mis on arhiivis juba olemas (lahti pakitud kontrolliks), võrreldakse arhiiviga ja eemaldatakse, mitte ei pakita teist korda; erinev kaust jäetakse lahti.
- Enne indeksi täiskontrolli (`--mode verify`) või indeksi nullist ehitamist tuleb arhiiv lahti pakkida.
- Sama allika versioonid jagavad lahtiselt oma algfaili kõva lingiga; arhiivis on igal kaustal oma koopia, et ühe versiooni saaks eraldi välja võtta. Täielikult lahti pakituna võtab hoidla seetõttu umbes 1,2 GB rohkem kui enne.

**Esimene pakkimine tehti kaks korda.** Esimene arhiiv salvestas jagatud algfaili lingina teise versiooni kausta; terve arhiivi lahtipakkimine töötas, aga üksiku versiooni väljavõtmine ebaõnnestus. Leitud kohe pärast pakkimist pistelise kontrolliga. Tööriist parandatud (`--hard-dereference`), test täiendatud jagatud failiga, arhiiv pakitud lahti (võrreldud failidega) ja uuesti kokku.

**Tulemus (07.10.2026 õhtu):** 8650 versioonikausta (7999 MiB) on ühes arhiivis `pack-20261007T162941Z.tar.zst`, 1,48 GB; lahti jäi 42 kausta (60 MiB: pea versioonid, mida korpuse poliitikas ei ole). Hoidla kaust serveris 8,3 GB → **2,0 GB**. Kontroll pärast pakkimist: arhiivi räsi vastab kirjele; arhiivist ajutisse kausta võetud kolme versiooni 21 faili vastavad oma manifestide räsidele (kahel neist on jagatud algfail); mõlemad plaanisammud jooksid ilma vanade kaustadeta; `ready` läbis ja vestluse leht vastas. Tööriista test (`tests/rag-v2-store-pack.test.mjs`) jooksis serveris 3/3; Windowsi arvutis jääb see vahele, sest seal ei ole `zstd`-d.

Samal õhtul suurendas omanik serveri ketast (58 → 77 GB). Pärast pakkimist on vaba **30 GB (62% täis)**.

**Mida see ei tee:** andmebaasi ja vektorifaile see ei puuduta; sülearvuti hoidla jääb lahti (see on algallikas). Lõigu ruumikulu serveris langes umbes 365 KB-lt umbes 270 KB-le.

## Mida mitte teha

- Originaale (`original.pdf`, `original.json`, `original.xml`) ei eemaldata: neist loetakse dokument uuesti, kui lugeja muutub.
- `rag_v2_version`, `rag_v2_version_unit` ja Qdrant on vestluse tööandmed.
- Hoidla faile ei eemaldata serverist täielikult, kuigi täiendus loeb ainult uusi versioone: nullist ehitamiseks tuleks 8 GB uuesti üles laadida ja praegune ühendus teeb seda umbes 0,25–1 MB/s.

## Järjekord, kui omanik otsustab teha

1. Varukoopia (hoidla sülearvutis, andmebaasi tõmmis), sest RAGV2 varukoopia on v56 seisuga.
2. Samm 1 (kood, juurutus, `DROP TABLE`): 4,9 GB ühe muudatusega.
3. Samm 4 koos `verify` muudatusega: 2,1 GB.
4. Samm 3: 3,0 GB.
5. Samm 2: 5,6 GB, kõige rohkem tööd ja kõige hoolikamat kontrolli.
6. Samm 5.

Iga samm on eraldi muudatus oma testide ja mõõtmisega (ruum enne ja pärast, üks päris pööre pärast juurutust).

## Kontrollimata

- Säästud 2 ja 3 on arvutatud ühe faili kokkupakkimise suhtest, mitte kõigi failide pealt.
- Andmebaasi köide on 1–2 GB suurem kui andmebaas ise (eelkirjutuslogi ja muu); see vahe on lahti võtmata.
- Kas `rag_v2_object` ridade puudumine mõjutab mõnda harva kasutatavat skripti väljaspool `lib/rag-v2/search/postgres.js` ja `prune-versions.js`: otsing koodist leidis lisaks ainult kaks testandmete skripti.
- Sülearvuti hoidla on sama vorminguga ja sama suur; sammu 2 sääst kehtib ka seal.
- Serveri muu ruum (esimene rakenduskaust 5,1 GB, millest vanad paketid ja ehitus 1,4 GB; logid 0,5 GB) ei ole selle ettepaneku osa.
