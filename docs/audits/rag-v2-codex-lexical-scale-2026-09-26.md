# RAG v2 sõnaline otsing kogu korpusel: sõltumatu audit

26.09.2026. Uuritud ADR-029 ettepanekut ja serveri tegelikku indekseeritud korpust. Koodi ega andmebaasi ei muudetud.

## 1. Järeldus ja ulatus

**ADR-029 suund — eelarvutatud termipostitused ja BM25-põhine järjestus — on põhjendatud, kuid ettepanek vajab täpsustamist.** Praegune viga ei tulene puuduvast GIN-indeksist ega aeglasest küsimuse lemmatiseerimisest. Lai OR-päring sobitab suure osa korpusest ning PostgreSQL arvutab igale vastele kaks `ts_rank_cd` skoori. Sagedaste sõnade ja liitsõnaosade skoorimine kahjustab samal ajal asjakohasust. Ainult üldsõnade eemaldus või ainult `ts_rank` ei täida mõõdetud korpusel alla sekundi eesmärki.

**Lisaks on eraldi aeglane allikate laadimise ja kontrollimise etapp.** Algse viie küsimuse sõnalise kanali mõõdik peidab 4,7–26,1 sekundit lisatööd pärast SQL-järjestust. Kiire järjestaja üksi ei anna kiiret otsingut.

Mõõtmise objekt:

- kohalik HEAD `7328ce90ad5fb4f9da3ce16fc62a6c0f9160b077`;
- serveri kood `/home/ubuntu/apps/sotsiaalai/tmp/rag-v2-v25`;
- rentnik ainult `sotsiaalai-corpus`;
- aktiivne generatsioon `search_generation_ea2676840568d8a8e1b6a2040bab05588f5db378fc920683310adf4d7d89db13`, olek `ready`;
- 5996 dokumenti, 29 183 ühikut; neist 29 141 on `evidence_eligible`, 42 struktuursed dokumendisildid;
- profiil `pg-estnltk175-et-snowball311-en-ru-v1`, kataloog `rag-v2/retrieval-directory-3`;
- PostgreSQL 16.15, 4 vCPU, AMD EPYC 9274F, hosti mälu ligikaudu 9,71 GiB; `shared_buffers=128MB`, `work_mem=4MB`.

Kuue asjassepuutuva lähtefaili LF-iks normaliseeritud SHA-256 räsi kattus kohaliku ja serveri koopia vahel (`postgres.js`, `lexical-analysis.js`, `morphology.js`, `estnltk.js`, `estnltk-worker.py`, `retrieval.js`). Tõend `inventory.json`.

Serveri andmepäringud käisid ühe ühenduse kaudu ükshaaval `BEGIN READ ONLY` / `ROLLBACK` vahel. Ka ühenduse `default_transaction_read_only=on`. Tavalised katsed kasutasid 15 s SQL-piiri, seletusplaanid kuni 60 s diagnostikapiiri. Ei käivitatud migratsioone, indekseerimist, genereerimisi, OpenAI kutseid ega vektorotsingut. Rentniku `sotsiaalai-development` sisu ega vestluse seadistust ei loetud ega muudetud. Süsteemikataloogist loetud tabelisuurused on jagatud tabelite koondid; sisulised korpusepäringud olid rentniku ja generatsiooniga piiratud.

Olemasolev muudetud Claude'i audit ja jälgimata `Arhiiv/rag-v1-registry-2026-09-24/` jäid puutumata. `SotsiaalAI.md` ei uuendatud, sest ülesande eripiirang lubab ainult raportit ja auditikausta abifaile.

## 2. Mõõdetud SQL ja päringuplaanid

`lib/rag-v2/search/postgres.js:176–190` teeb sisuliselt:

```sql
WITH q AS (
  SELECT replace(plainto_tsquery('pg_catalog.simple', $4)::text,
                 ' & ', ' | ')::tsquery AS exact,
         replace(plainto_tsquery('pg_catalog.simple', $7)::text,
                 ' & ', ' | ')::tsquery AS stems
)
SELECT u.id,
       ts_rank_cd(u.search_vector, q.exact)
       + 0.35 * ts_rank_cd(u.morphology_vector, q.stems) AS score
FROM rag_v2_unit u, q
WHERE u.tenant = $1 AND u.generation_id = $2
  AND u.document_id = ANY($3::text[])
  AND (u.search_vector @@ q.exact OR u.morphology_vector @@ q.stems)
  AND ($6::text[] IS NULL OR u.id = ANY($6::text[]))
ORDER BY score DESC, u.id COLLATE "C" ASC
LIMIT $5;
```

Parameetrid: lubatud 5996 dokumendi ID-d, 29 141 tõendikõlbliku ühiku ID-d, `LIMIT 40`, muutmata küsimus ja sama EstNLTK analüsaatori väljund. Need plaanid vastavad dokumendisilte välistavale profiilile; allpool eraldi tehtud algse `smoke-test.mjs` päringute kordus kasutab skripti vaikimisi kõiki 29 183 ühikut. Neid skoobe ei käsitleta identsetena.

Kõigi viie laia päringu tegelik põhikuju oli `Limit → Sort (top-N heapsort) → Seq Scan rag_v2_unit`. Sorteerimise mälu 39–44 kB; sort ei läinud kettale. Plaanija aeg 62,7–66,0 ms. Aeg kulus peaaegu täielikult skannimissõlmes, mis sisaldab sobitamist ja skooride arvutamist.

| Küsimus | Sobinud ühikuid | Osa 29 141-st | EXPLAIN täitmisaeg | Shared hit / read plokke |
|---|---:|---:|---:|---:|
| Toimetulekutoetuse taotlemine | 15 092 | 51,8% | 9,356 s | 279 475 / 59 641 |
| Koduteenus ja korraldaja | 27 919 | 95,8% | 26,733 s | 281 523 / 60 400 |
| Hooldajatoetuse saaja | 19 419 | 66,6% | 11,033 s | 295 619 / 60 421 |
| Lähisuhtevägivalla ohvri aitamine | 15 092 | 51,8% | 12,336 s | 274 141 / 60 413 |
| MARAC-i võrgustiku mudel | 25 945 | 89,0% | 20,912 s | 279 771 / 60 413 |

`shared read` tähendab PostgreSQL-i jagatud puhvrist puudunud plokki, mitte tõendatud füüsilist kettalugemist: operatsioonisüsteemi vahemälu ei tühjendatud. Loendurid võivad hõlmata korduvaid lugemisi ning TOAST-i. `Seq Scan` eemaldatud ridade hulgas on ka teiste generatsioonide/rentnike füüsilised read; nende sisu ei tagastatud ega uuritud.

Toimetulekutoetuse sama filtri ja kandidaatide hulga lahutatud mõõtmised (`breakdown.json`):

| Variant | EXPLAIN täitmisaeg | Mida see näitab |
|---|---:|---|
| Ainult vastete `count(*)`, skoorita | 1,055 s | Sobitamine ise on juba kallis |
| Sobitamine + ainult täpse teksti `ts_rank_cd` | 2,489 s | Ka väiksem vektor ei täida eesmärki |
| Sobitamine + ainult morfoloogia `0.35 * ts_rank_cd` | 7,961 s | Morfoloogia skoor on peamine lisakulu |
| Mõlemad skoorid `ts_rank`, sama lai päring | 1,565 s | Odavam järjestus aitab, kuid ei piisa |
| Praegune üldsõnade eemaldus + mõlemad `ts_rank_cd` | 6,145 s | Alles 11 564 vastet |

Need on eraldi mõõtmised, mitte ühe päringu täpselt liidetavad ajavahemikud. Algse ja skoorita katse erinevus, ligikaudu 8,30 s, näitab skoorimise ja selle lisalugemiste suurusjärku. Kogu maksumust ei saa omistada üksnes aritmeetikale.

Kaks kontrollkatset eristavad indeksit päringukujust:

- Sama Q01 täielik päring, kuid ainult lugemistransaktsioonis `SET LOCAL enable_seqscan=off`: `BitmapOr` kahe olemasoleva GIN-i kaudu, 15 092 vastet, **8,534 s**. Indeksile sundimine ei vii seda alla sekundi.
- Q01 teematerminile kitsendatud diagnostika: täpne `toimetulekutoetust`, morfoloogiline `vmettoimetulekutoetus`, sama lubatud dokumentide/ühikute nimekiri ja sama `ts_rank_cd`: **71,6 ms täitmine + 64,1 ms planeerimine**, 629 vastet. Plaan `Limit → top-N Sort → Bitmap Heap Scan → BitmapOr → 2 × Bitmap Index Scan`. See tõendab valikulise GIN-päringu kiirust, mitte valmis loomuliku küsimuse terminivaliku kvaliteeti. Ülejäänud küsimussõnade eemaldamine oli siin teadlik diagnostikakatse, mitte pakutav allikapõhine runtime-erand.

Indeksid on serveris olemas:

| Indeks | Kuju | Suurus |
|---|---|---:|
| `rag_v2_unit_pkey` | B-tree `(tenant, generation_id, id)` | 8,17 MiB |
| `rag_v2_unit_search_idx` | GIN `(search_vector)` | 27,81 MiB |
| `rag_v2_unit_morphology_idx` | GIN `(morphology_vector)` | 84,33 MiB |

Ühikutabeli põhiosa on 41,83 MiB, koos TOAST-i ja indeksitega 602,95 MiB. Kataloogi tabel koos lisadega 18,61 MiB; versioonitabel 666,91 MiB. Ühikutabeli `reltuples` hinnang oli 26 672, `n_live_tup` 29 358, viimane automaatne analüüs 16:44 UTC. Mõõdetud korpuse ühikuid oli täpselt 29 183. Statistika värskus väärib indeksiehituse järel kontrolli, kuid ligi terve korpuse sobitamisel ei lahenda `ANALYZE` ega uus GIN üksinda skoorimise maksumust.

Keskmised vektorid: täpne tekst 129,45 lekseemi / 2221 baiti, morfoloogia 473,42 / 8014 baiti. Mahud on `length(tsvector)` ja `pg_column_size` keskmised, mitte sisendi tokeniarvud.

## 3. Leiud raskuse järgi

### P1-1. Lai OR ja iga vaste kallis skoorimine põhjustavad aegumise

**Asukoht:** `lib/rag-v2/search/postgres.js:181–186`; limiit `:13`; veaks teisendus `lib/rag-v2/search/retrieval.js:137–146`.

Piir on `pg.Pool({ statement_timeout: 15000 })`. See piirab üht SQL-lauset; see ei ole kogu otsingu ega EstNLTK ajalimiit. Katkestuse kood on `57014`; `retrieve()` muudab sõnalise kanali tagasilükkamise veaks `lexical_service_failed`, ka hübriidotsingus. Vektorikanali õnnestumine ei päästa seda pööret. Käitumine on koodist tuvastatud; hübriidi päris küsimusevektoriga siin ei käivitatud.

**Kordamine:** auditi `baseline` annab eespool toodud plaanid; `smoke` või `suite` säilitab 15 s piiri ja taastoodab aegumise. **Parandus:** termipostitustest arvutatav järjestus ja versioonitud sisusõnade/alternatiivide käsitlus. Ajalimiidi tõstmine 30–60 sekundini peidaks vea, jättes kasutaja ootele. Eraldi vektorile taandumine vajab nähtavat ja testitud teenusepoliitikat; vaikselt veatut hübriidi teeselda ei tohi.

### P1-2. Praegune skoor tõstab üldsõna või liitsõnaosa täpse teema ette

**Asukoht:** `postgres.js:181–186`, `lexical-analysis.js:16`, `estnltk-worker.py:44–65`, `morphology.js:15–24`; päringu üldsõnade filter `retrieval.js:138` ja `query-stopwords.js:27`.

`pg_catalog.simple` jätab alles „kuidas”, „kes”, „ja”, „on”. Skooris pole korpuse dokumendisagedust (IDF) ega pikkuse normaliseerimise argumenti. Pealkiri/autor kaalutakse `A`, sisu `B`, abitekst `D` (`prisma/rag-v2/migrations/202609050001_local_search/migration.sql:32–35`); näiteks pealkirjas olev „kuidas” võib seetõttu anda tugeva signaali.

EstNLTK lisab pinnavormi, kuni kaheksa analüüsi lemmad ja liitsõna juurosad samasse termikogumisse. Päring „toimetulekutoetust” sisaldab muu hulgas `vmettoimetulekutoetus`, `vmettoetus`, `vmettoime`, `vmettuleku`. Nende vahel puudub skooris tervikmõiste ja üldise osa eristus. Kahe teise keele tüved annavad sama sisendsõna eest lisasignaale.

Mõõdetud ühikusagedused 29 141 tõendikõlblikul ühikul (`df.json`):

| Term | Ühikuid | Osakaal |
|---|---:|---:|
| täpne `ja` / `on` | 25 664 / 23 507 | 88,1% / 80,7% |
| täpne `kuidas` / `kes` | 5701 / 7735 | 19,6% / 26,5% |
| `vmettoimetulekutoetus` | 629 | 2,16% |
| `vmettoetus` / `vmettoime` | 6751 / 6538 | 23,2% / 22,4% |
| `vmetkoduteenus` / `vmetteenus` | 887 / 12 319 | 3,0% / 42,3% |
| `vmethooldajatoetus` | 427 | 1,47% |
| `vmetlähisuhtevägivald` / `vmetohver` | 751 / 1095 | 2,58% / 3,76% |
| `vmetmarac` / `vmetvõrgustik` | 882 / 1564 | 3,03% / 5,37% |

**Oluline vastunäide ADR-i 30% piirile:** „toetus”, „toime”, „kuidas” ja „kes” jääksid selle piiri alla ning jätkaksid laia sobitamist. Ainult DF-lävend ei asenda stoppsõnade ja liitsõnaosade semantilist käsitlust.

Korduse esimesed tulemused:

- Q01 vale esikoht: `document_794e475374c5dcf6c31f96a2cef09b256c938e92c625baf5801447c4147832f0`, ühik `unit_0ec64016f9960b147663ce420d733884a24c1b74686f7b2fbafdd924b64bb832`, ordinal 9; „Ei või koroona pärast koduväravastki välja minna. Pandeemia mõju noorte vaimsele tervisele ja kuidas neid toetada”, skoor 7,705.
- Q03 esimene oli **„Töötaja saab edaspidi töötuskindlustusest suurema kaitse”**, `document_78e061bda758a136d3bcce0600f4281ed91b047bc7e52b5c17bcb2468c92276e`, ordinal 4, skoor 6,845. „Hooldajatoetus”, `document_b8a44f777a0ac1dc90f4af9d1628907e4b6ce124445fd56cf586359deaf3f337`, tuli teisena, skoor 6,000. Seega „leiab õige dokumendi” on tõsi, kuid esikoha kvaliteet ei ole stabiilselt hea.
- Q04 esikoht oli asjakohane MARAC-i artikkel `document_3d773f5f13653a4ba1bdbaa6ff77adcb7e4f2f0d5f2b19527a344d03671b0470`, ordinal 2, skoor 8,570; konkreetse teema vasteid leidub nii pealkirjas kui sisus. Samas toimetulekuküsimuse vale koroonaartikkel oli ka siin neljas, sama skooriga 7,705. See on seletatav küsimuste ühise sõnaga „kuidas”.

Skoori eraldi termideks lahutamine (`score-parts.json`) kinnitas põhjuse otse:

| Tulemus | Täpne tekst | Morfoloogiline osa | Järeldus |
|---|---|---|---|
| Q01 vale koroonaartikkel | Ainult `kuidas`: 6,200 | `sbenkuida`, `sbrukuidas`, `vmetkuidas`: kokku 1,470; `vmettoetus`: 0,035 | Skoorist 7,670 / 7,705 tuleb „kuidas”-est; tervikliku toimetulekutoetuse vastet pole |
| Q03 vale töötuskindlustusartikkel | `kes`: 2,000; `saab`: 1,800 | Enamasti „kes/saab” alternatiivid; `vmettoetus`: 0,175 | Täpne hooldajatoetus ei panusta üldse |
| Q03 õige hooldajatoetus | 2,500, sh `hooldajatoetust`: 0,500 | 3,500, sh hooldaja/terviklemma vasted | Õige teema ei ületa üldsõnade tugevat summat vales dokumendis |
| Q04 õige MARAC | `lähisuhtevägivalla`: 2,000; `ohvrit`: 0,500; `kuidas`: 0,400 | 5,670, sh teema ja selle alternatiivid | Teemavasted aitavad siin võita, kuid skooris on ka aliaste korduv panus |

Q01 täpse pealkirjaga teenuse esimene ühik oli 22 küsimuse katses alles **19. kohal**. Üldsõnade eemaldus parandas selle 9. kohale, eemaldus koos `ts_rank`-iga 5. kohale; esikohale jäi toimetulekutoetust saanud pere lapse **koolimineku lisatoetus**. Seega kiirparandus parandab järjestust, kuid ei lahenda veel kasutaja taotluse täpset sisu.

**Parandus:** korpusepõhine IDF, küllastuv tegelik termini esinemissagedus, väljade pikkuse normaliseerimine, tervikliku lemma eelistamine juurosale, sama küsimussõna alternatiivide koondamine üheks signaaliks. Üldised abipalve sõnad ei tohi üksi anda tugevat vastet. Omavalitsust ja kehtivust käsitleda olemasolevate metaandmefiltritega; teise valla teenuse hea tekstiline vaste pole kohaliku teenuse vastus.

### P1-3. Pärast järjestamist tehakse uuesti tuhandete tekstide morfoanalüüs

**Asukoht:** `lib/rag-v2/search/retrieval.js:93–119,153–154`; `postgres.js:104–124,140–150`.

40 kandidaadi dokumentidest laaditakse kõik ühikud. `units()` arvutab `lexicalFields()` kaudu pealkirja, sisu ja abiteksti morfoloogia uuesti ning võrdleb seda salvestatuga. Lisaks kontrollitakse terveid bundle'eid ja kõiki nende lähteobjekte. See kontroll on sisuliselt vajalik tervikluse tagamiseks, kuid selle täielik kordamine iga küsimuse ajal on kallis.

Algse smoke'i loogika lugemisrežiimis kordus:

| Küsimus | Sõnaline kanal | Laadimine/kontroll | Kogu `retrieve()` | Laaditud dok / ühikuid | Olek |
|---|---:|---:|---:|---:|---|
| Q01 toimetulek | 10,287 s | 26,094 s | 37,082 s | 30 / 1778 | ok, vale esikoht |
| Q02 koduteenus | 15,014 s | — | 15,352 s | 0 / 0 | viga |
| Q03 hooldaja | 11,102 s | 4,692 s | 16,446 s | 26 / 477 | ok, õige dokument teine |
| Q04 vägivald | 12,474 s | 14,692 s | 27,812 s | 18 / 1018 | ok |
| Q05 MARAC | 15,011 s | — | 15,352 s | 0 / 0 | viga |

Q01 laadimise kolme SQL-kutse summa oli umbes 2,232 s; enamik 26,094 sekundist jäi rakenduse kontrollide ja morfoanalüüsi sisse. Kataloogi/õigusskoobi etapp oli ligikaudu 0,34–0,39 s.

Sama 30 dokumendi/1778 ühiku eraldi instrumenteeritud kordus (`hydrate.json`) täpsustas: `bundles()` 7,603 s, `units()` 13,351 s; analüsaatori sees **12,018 s**, 56 pakki ja 2 710 544 tekstimärki. Objektipäring laadis 113 823 lähteobjekti; kolme SQL-kutse summa oli 2,251 s. See kordus ei sisalda `retrieve()` kõiki hilisemaid `indexUnit()`/skoobikontrolle ja selle koguaega ei võrdsustata eelmise 26,094 sekundiga.

**Parandus:** põhiline täielik kontroll enne generatsiooni avaldamist, seejärel muutumatu versiooni ja konfiguratsiooni räsiga seotud valideerimise tõend/vahemälu; päringu ajal ainult kandidaatidest vajalike ühikute ja viidete sihitud laadimine ning odavad terviklus- ja õiguskontrollid. Vahemälu võti peab sisaldama rentnikku, generatsiooni/versiooni, sisu- ja analüsaatoriversiooni räsi. Rikutud andmeid ei tohi hakata aktsepteerima kiiruse nimel. BM25-eelarvutust ei tohi samuti iga küsimuse ajal uuesti teha.

### P2-1. Olemasolev morfoloogiaväli pole korrektse BM25 sagedustabeli lähtekuju

**Asukoht:** `estnltk-worker.py:44,64–65`; `morphology.js:16,24`; morfoloogiavektori migratsioon `202609230002_morphology/migration.sql:2–6`.

Analüsaator tagastab iga välja **unikaalsed, sorditud** terminid. Seetõttu ei säili tegelik korduste arv ega sõnade asukohad; `to_tsvector()` positsioonid kirjeldavad sorditud abiloendit, mitte allikat. Praeguse puhta OR-skoori puhul ei nimetata seda tõendiks suvalisest fraasiläheduse veast, kuid seda välja ei saa kasutada tõelise lemma-TF ega fraasikauguse alusena.

PostgreSQL tokeniseerib sidekriipsuga prefiksitud sõnu omakorda: näiteks `vmetmarac-i` annab ka eraldiseisva `i`. Eksporditud morfoloogiavektorites oli 40 275 sellist või muud kolme põhiprefiksita termi/ühiku paari. See on lisapõhjus hoida termi liiki eraldi veerus ja mitte sööta prefiksitud termistringe uuesti loomuliku keele tokenizerisse.

**Parandus:** arvuta morfoloogilised postitused algteksti tokenitest; säilita tegelik TF, väljapikkus ning vajadusel positsioon. Märgista pinnavorm, terviklemma ja liitsõnaosa eraldi ning ära liida sama tokeni alternatiive täiskaaluga kokku. Ära nimeta olemasoleva `Set`-i põhist binaarset järjestust BM25-TF teostuseks.

### P2-2. Külmkäivitus ja vaikimisi testiprofiil vajavad eraldi katmist

**Asukoht:** `estnltk.js:15,22–29,64–69,91`; `ranking.js:70`; `profiles.js:35–40`; `tests/rag-v2-estnltk.integration.test.mjs:53`.

Esimene küsimuse analüüs koos Python-protsessi käivitamisega oli 814,6 ms; järgmised neli 0,88–1,36 ms. Analüsaatori oma ajalimiit on 30 s, jõudeoleku järel sulgemine 60 s. See ei põhjusta 10–27-sekundilist SQL-i, kuid alla sekundi kanali-SLO puhul on külm analüsaator oluline.

Smoke kutsub `retrieve()` otse ega kasuta vaikimisi otsinguprofiili kõiki valikuid. Seal on dokumendisildid vaikimisi sees ja tulemi kontekstivalik erineb kompaktsest sõltuvusprofiilist. Ka üldsõnade eemaldamine on valikuline; põhiprofiil seda ei lülita sisse. Neid erinevusi tuleb raportites ja uues regressioonis nähtavana hoida.

Olemasolev EstNLTK integratsioonitest katab kaheksa lühikest sünteetilist dokumenti ja vormivasteid; `rag-v2-capacity.test.mjs` kontrollib mahupiire, mitte 29 000 ühiku latentsust. Need ei ole kogu korpuse kiiruse ega asjakohasuse tõend. Audit ei käivitanud andmebaasi muutvaid integratsiooniteste.

**Parandus:** teenuse käivitamisel soojendatav ja ressursipiiridega analüsaator, soojade/külmade mõõtmiste eristamine, ühetaoliselt versioonitud päringuprofiil ning kogu korpuse lugemistestid.

## 4. ADR-029 hinnang ja soovitatud lahendus

Soovitan jätkata **variandiga 2 ja keelepõhise analüüsiga**, koos P1-3 laadimisparandusega. See on teostussoovitus, mitte tõend juba valminud alla sekundi indeksist. Uut skeemi ega BM25 indeksit selle auditi käigus ei ehitatud.

ADR-i vajalikud täpsustused:

1. **Keelte eemaldamine annab siin umbes kahekordse, mitte kolmekordse vähenemise.** 29 141 ühiku morfoloogiavektoris oli kokku 13 804 780 lekseemi/ühiku paari: `vmet*` 7 075 511 (51,25%), `sben*` 3 310 695, `sbru*` 3 378 299, muu 40 275. Need ei ole veel tulevase TF/väljatabeli ridade täpsed arvud. Keelemetaandmeid, tsitaate ja segakeelseid allikaid peab kontrollima; ühe dokumendikeele pime rakendamine ei ole riskivaba.
2. **DF>30% ei kõrvalda mitut tuvastatud mürasõna.** Filtreerimine peab arvestama sõna rolli ja küsimuse tervikmõistet. Ainult haruldase sõna järgi kandidaatide lõikamine võib kaotada õige vaste; mõõta tuleb recall'i enne lõplikku valikut.
3. **BM25 ei saa võtta tegelikku lemma-TF-i praegusest sorditud unikaalsete termide väljast.** Indeks tuleb sõnalise analüüsi osas algtekstist uuesti arvutada.
4. **Lisada laadimis- ja tervikluskontrolli etapi eelarve.** Praegune post-SQL analüüs võib kulutada rohkem aega kui järjestus.
5. **Eristada päris küsimusevektoritega hübriidi kvaliteeti vektori eneseleidmisest.** Käesoleva ülesande piirangutega esimene ei ole tõendatud; tasuline uus hindamisring ei ole tehnilise paranduse eeltingimus.

### Konkreetne teostusvariant

Järgmine skeem on ettepanek; ühtegi allolevat tabelit ei loodud.

- Kompaktne `lex_unit`: rentnik, generatsioon, numbriline `unit_no`, praegune stabiilne ühiku-ID, dokumendi-ID, tõendikõlblikkus, väljade pikkused. Numbriline sisemine võti vähendab miljonites postitustes 69-märgilise ID kordamist; väline identiteet ei muutu.
- `lex_term`: rentnik, generatsioon, keel, termini liik, `term_no`, termini tekst, ühikusagedus `df`. `N` ja väljade keskmised pikkused fikseeritakse sama põlvkonna statistikasse. BM25 „dokument” tähendab siin otsinguühikut: `N≈29 141`, mitte 5996 allikadokumenti. Õiguspõhise filtri ja sildipoliitika mõju statistikasse tuleb versioonilepingus määratleda.
- `lex_posting`: rentnik, generatsioon, keel, `term_no`, `unit_no`, tegelikud `tf_title`, `tf_body`, `tf_aids`. B-tree juurdepääs võtmega `(tenant, generation_id, language, term_no, unit_no)`; tulevane query-plan peab näitama just valitud terminite postituste lugemist. Kaalud/arvutatud panuse võib muutumatu konfiguratsiooni korral eelarvutada, kuid siis nõuab kaalu muutus vastava eelarvutuse uuendamist.
- Päring: üks EstNLTK analüüs → versioonitud funktsioonisõnade eemaldus → küsimussõnade rühmad ja alternatiivid → konkreetse põlvkonna termi-ID-d/statistika → ainult nende postitused → õiguste, piirkonna/kehtivuse ja tõendikõlblikkuse piir **enne TOP-K-d** → skoor → deterministlik `score DESC, unit_id COLLATE "C" ASC` → 40 kandidaati.
- Algne valem: `idf = ln(1 + (N - df + 0.5)/(df + 0.5))`; sagedus küllastub ning väljade pikkus normaliseeritakse. `k1=1.2`, `b=0.75` sobivad katse algväärtusteks, mitte tõendatud optimumiks. Pealkirja, sisu ja abiteksti kaalud peavad olema eraldi versioonitud. Sama küsimussõna pinnavormi, lemma, tüvede ja juurosade panuseid ei summeerita piiramatult; eelistada terviklemma ja võtta alternatiivide seast piiratud/parim panus.
- Hoida **terviklemma esmane rada**, liitsõnaosad madalama kaaluga laiendusena. Kui küsitava sisumõiste enda vaste puudub, ei tohi pelk „toetus” või „teenus” anda näiliselt kindlat vastust. Tühi või ainult üldsõnadest koosnev päring saab selgesõnalise tühja/ebapiisava sõnalise tulemuse; hübriidi käitumine määratakse profiilis.
- Säilitada sõnalise kanali sõltumatus vektorikanalist. Piiratud vektorikandidaatide sees tehtavat sõnalist ümberjärjestust ei tohi nimetada sama sõltumatuks RRF-kanaliks.

**Eeldatav latents:** sooja analüsaatori ja valikuliste terminite korral seada teostushüpoteesiks SQL 50–300 ms ning sõnaline kanal p95 <1 s. Need arvud on projekteerimise siht ja kontrollitav hüpotees, **mitte mõõdetud BM25 tulemus**. Väga üldine või pikk päring, statistika/skema vead ja õigusskoobi ühendamine võivad sihi rikkuda. Kõik päringud ei muutu kiireks üksnes sellest, et tabeli nimi on `posting`.

**Riskid:** kümnete miljonite pikkade võtmetega ridade tarbetu mahu kasv; vale TF/DF definitsioon; sama sõna mitmekordne premeerimine; KOV-ide ja pikkade juhendite tasakaalu muutumine; segakeelsete allikate recall; valed/puuduvad keelemetaandmed; liiga agressiivne levinud termide eemaldus; lubamatu dokumendi sattumine kandidaatide hulka enne filtreerimist. Nende vastu on allpool konkreetsed kontrollid.

### Alternatiivid

| Lahendus | Latentsuse tõend või hüpotees | Järjestuse mõju | Uuesti ehitamine ja risk |
|---|---|---|---|
| Üldsõnad välja, praegune `ts_rank_cd` | Q01 mõõdetud 6,15 s; 22 küsimuse kokkuvõte allpool | Eemaldab osa müra, liitsõnaosade OR jääb; Q01 esimeseks tõuseb koolimineku lisatoetus | Indeksit ega embeddinguid pole vaja muuta; uus päringuprofiil. Ei täida kiiruse eesmärki |
| Üldsõnad välja + `ts_rank` | Mõõdetud umbes 1–2 s, täielik tabel allpool | Odavam, kuid teistsugune skoor; õige dokumendi leidmine ei ole garanteeritud | Skeemi ehitust ei vaja; järjestus tuleb versioonida ja hinnata. Ei tõenda <1 s |
| Ainult keelepõhine morfoloogia | Mõõtmata; siin termipostituste vähenemine umbes 1,94 korda; kiiruse samas suurusjärgus paranemine pole garanteeritud | Vähem topeltkaale; võimalik segakeelse teksti recall'i langus | Morfoloogia uuesti arvutus ja uus otsingugeneratsioon. Üksi pole piisav lahendus |
| Haruldaste tervikterminite GIN-kandidaadid + odav skoor | Valikulise termini diagnostika allpool; loomuliku küsimuse täieliku algoritmi p95 tõendamata | Väiksem muudatus, kuid terminivalik võib õige kandidaadi kõrvale jätta | GIN on olemas, indeksimuutust ei pruugi vaja minna; selge vastete säilitamise test kohustuslik |
| Eelarvutatud PostgreSQL BM25-põhised postitused | Siht 50–300 ms SQL, p95 kanal <1 s; teostamata | IDF, TF küllastus ja pikkusnormaliseerimine lahendavad tuvastatud signaalivead | Uus sõnaline indeks/statistika/konfiguratsioon; algteksti morfoanalüüs uuesti, olemasolevad vektorid taaskasutusse |
| Eraldi BM25 mootor (`pg_search`/Tantivy) | Võimalik alla sekundi siht; sellel serveril mõõtmata | Sama kvaliteedikontroll vajalik; mootorivalik ise ei lahenda termitüüpe | Uus komponent/juurutus, indeksi elutsükkel, varundus ja ACL-filtrid. Praegu pole tõendit, et seda lisakeerukust on vaja |
| Suurem timeout, mälu või sund-GIN | Ei kõrvalda iga vaste `ts_rank_cd` tööd | Järjestus jääb sama vigaseks | Sobib piiratud diagnoosiks; ei ole funktsionaalne parandus |

### Olemasolevate embeddingute taaskasutus

Sõnalise analüüsi, stoppsõnade, postituste, IDF-i või järjestuse muutmine **ei nõua uut embeddinguostu**, kui `input_text`/`input_hash`, mudel, mõõtmed, õigusskoop ja sisendiversioon säilivad.

Kooditäpsustus ADR-i juurde: `cachedIndexVector()` (`indexing.js:22–40`) eraldab vahemälu ka `lexical` väärtusega. See otsib varasemaid **kataloogiskeeme sama lexical-konfiguratsiooni sees**, mitte automaatselt mis tahes vana lexical-konfiguratsiooni. Uue konfiguratsiooni korral võib vahemälutabeli tabamus puududa. `StoredEmbedding.embed()` (`pilot-runner.js:238–242`) leiab vektori tekstiräsi järgi salvestatud ledger'ist ja puuduva puhul katkestab. Reaalse indeksi ehitaja nõuab `source='persisted_vectors'` (`indexing.js:48`). Seega tuleb uus ehitus anda teadlikult kontrollitud salvestatud vektorite adapterile; ainult SQL-vahemälu tabamusi ei tohi eeldada.

Praegune arhitektuur seob lexical-konfiguratsiooni otsingukonfiguratsiooni ja generatsiooni-ID-ga (`indexing.js:9–17,56–59`). Selle tee kasutamine tähendab uut PostgreSQL-i otsingugeneratsiooni ning uut Qdranti kollektsiooni koos samade vektorite üleslaadimisega. See on **indeksi uuesti ehitamine**, mitte embeddingute uuesti arvutamine. Vektorigeneratsiooni ja sõnalise indeksi elutsükli lahutamine oleks eraldi arhitektuurimuudatus; seda pole selle auditi jaoks vaja teha.

## 5. Kontrollitav testiplaan

Auditikaustas on `suite.json`: 21 positiivset eestikeelset küsimust ja üks negatiivne kontroll. Küsimused ja oodatud allikad pandi kirja enne kolme SQL-variandi võrdlust. Allikate sisu vaadati korpuse ekspordist; õigusakti redaktsiooni tänast kehtivust sellega ei kinnitata.

Q01–Q03 kasutavad esialgset täpse teenusepealkirja klassi (vastavalt 69, 75 ja 45 dokumendi ID-d). Q04–Q21 on konkreetsete allikatega ankurdatud osaline hinnangukogum. Teine dokument võib samuti olla õige: märgistamata vastet ei tohi lugeda valeks. Mitmed küsimused kasutavad teadlikult pealkirja sõnastust; see on regressiooni- ja diagnoosikomplekt, mitte esinduslik hinnang päriskasutajate vajadustele.

Võrrelda eraldi:

1. **Kiirus:** küsimuse analüüs, SQL planeerimine/täitmine, kataloog, hüdreerimine ja kogu otsing. Enne mõõtmist sama aktiivse põlvkonna/konfiguratsiooni räsi kontroll; küsimused ükshaaval. Tulevase paranduse vastuvõtul vähemalt kolm järjestikust vooru erinevas fikseeritud järjekorras, soojad ja külmad analüsaatorid eraldi; koormustest pole vajalik selle ülesande täitmiseks. p50/p95 koos veamääraga. Aegunud päringud on tsenseeritud, mitte 15 sekundiga lõpetanud edukad päringud.
2. **Kandidaadid:** ankrud top-40 hulgas; asjakohane allikas peab säilima ka enne RRF-i. Märkida nii ühiku- kui dokumenditaseme tulemus, et sama dokumendi 20 tükki ei näiks 20 hea allikana.
3. **Järjestus:** ankur-Hit@1/5/10 ja esimese ankru positsioon; pärast inimhinnanguid graded nDCG@10/MRR. Osalise märgistuse pealt mitte esitada täielikku precision'it ega semantilist edukust. Käesolev mõõtmine raporteerib ankrute nähtavust esimeses viies **ühikus**, mitte dokumenditi kokkupakitud top-5-s.
4. **Piirkond ja aeg:** Q06/Q07/Q12/Q21 korrata nii tekstis nimetatud vallaga kui olemasoleva region-filtriga; dokumente lubav nimekiri enne TOP-K-d. Korpuses oleva ajaloolise õigusakti allika leidmine ei võrdu tänase kehtivuse tõendiga; ajaliste filtrite/puuduvate metaandmete oodatav käitumine eraldi.
5. **Tühjus ja morfoloogia:** Q22 ning ainult „kas mul on?”; tundmatu liitsõna ei tohi „toetuse” kaudu muutuda kindlaks otseseks vasteks. Lisa sama mõtte vormid „toimetulekutoetus / toimetulekutoetust / toimetulekutoetuse”, sidekriipsuga MARAC, numbrid/§-viited, keeltevahetus, EN/RU ja segakeelsus, Unicode normaliseerimine.
6. **Terviklus ja vead:** vale rentnik, keelatud dokument, teise generatsiooni ühik, vale TF/statistikaräsi, rikutud salvestatud morfoloogia või bundle, analüsaatori puudumine, SQL katkestus. Õiguste piir ja tõendite allikakohad peavad säilima; selleks kasutatakse hilisema teostuse eraldatud testandmeid, mitte tootmiskasutajate sisu.
7. **Determinism ja vektorite taaskasutus:** sama sisend/konfiguratsioon annab identse järjestuse koos võrdskooride ID-järjekorraga; uue põlvkonna avaldamine toimub hiljem atomaarse vahetusega. Uuesti ehitamisel salvestatud vektorite räside kontroll ning null väliseid embeddingukutseid; puuduv vektor peab katkestama, mitte alustama ostu.

Tehniline vastuvõtukriteerium: sõnaline kanal soojas püsiprotsessis p95 <1 s, SQL-aja ületusi 0, õigusskoobi rikkumisi 0 ja kõigil kokkulepitud kriitilistel ankrutel tulemus top-40-s. Relevantsuse lävend tuleb lukustada pärast märgistamata top-tulemuste hindamist; vigast praegust järjestust ei säilitata kvaliteedi etalonina. Hübriidi kontrolliks saab kasutada olemasolevaid sobiva mudeli küsimusevektoreid, kui nende küsimus ja räsi täpselt kattuvad. Juhuslikud või salvestatud dokumendivektorid ei asenda küsimuse semantilist vektorit.


## 6. 22 küsimuse mõõtmise tulemused

Kõiki küsimusi mõõdeti ükshaaval ühel ühendusel. Iga küsimuse järjekord oli alus → üldsõnade eemaldus → üldsõnade eemaldus koos `ts_rank`-iga. Igast paarist on üks mõõtmine; järjekord ei olnud juhuslik, OS-i/andmebaasi vahemälu ei tühjendatud. Seetõttu on see diagnoos, mitte tootmiskoormuse p95 tõend.

Tabeli ajad on ainult SQL-kutse koos parameetrite saatmise ja lugemistransaktsiooni raamiga, pärast küsimuse morfoanalüüsi. Ühikute/allikate laadimist need ei sisalda. p95 on nearest-rank meetodil. Aegumisega variandi edukate päringute p95 ei kirjelda kogu valimit.

| Variant | Lõpetas / 22 | Aegus | Edukate p50 / p95 | Edukate min–max | Ankur top-5 / 21 | Ankur top-40 / 21 |
|---|---:|---:|---:|---:|---:|---:|
| Praegune | 4 | 18 | 9.488 / 12.465 s | 7.818–12.465 s | 2 | 3 |
| Üldsõnad välja | 11 | 11 | 6.714 / 13.217 s | 2.369–13.217 s | 9 | 10 |
| Üldsõnad välja + `ts_rank` | 22 | 0 | 1.771 / 1.988 s | 1.343–2.006 s | 18 | 20 |

Aegumised loetakse ankru praktilise kättesaadavuse tabelis ebaõnnestumiseks, kuid sellest ei järeldu, et nende lõpuni jooksmata järjestus oleks semantiliselt vale. Ka ankruta top-5 võib sisaldada märgistamata õiget allikat. Ükski odavama variandi päring ei täitnud siin ühe sekundi SQL-sihti.

Järgnevas `E` = 15 s SQL-aegumine; `—` = oodatud ankrut ei olnud esimeses 40 ühikus; `neg` = negatiivne kontroll. Positsioonid on ühikute järjestuses. Q01–Q03 allikaviide on üks näide pealkirjaklassist, mitte ainus lubatud dokument. Täielikud ID-loendid on `suite.json`-is.

| ID | Eestikeelne küsimus | Oodatud dokumendi lühiviide | Ankru positsioon: alus / stop / rank | `stop+rank` SQL |
|---|---|---|---|---:|
| Q01 | Kuidas taotleda toimetulekutoetust? | `1a4fffc3e8e1` | 19 / 9 / 5 | 1.650 s |
| Q02 | Mis on koduteenus ja kes seda korraldab? | `1376e86f8e24` | E / 1 / 1 | 1.771 s |
| Q03 | Kes saab hooldajatoetust? | `4539134b6d86` | 2 / 1 / 1 | 1.504 s |
| Q04 | Kuidas aidata lähisuhtevägivalla ohvrit? | `a89db3bb5817 (+ alternatiivid)` | 1 / 1 / 1 | 1.690 s |
| Q05 | Mis on MARAC-i võrgustiku mudel? | `95c7b79f84fd (+ alternatiivid)` | E / 1 / 1 | 1.453 s |
| Q06 | Kust saab Tallinna elanik tasuta võlanõustamist? | `124114fc91d5` | E / 4 / 8 | 1.536 s |
| Q07 | Kellele on Raasiku vallas mõeldud isikliku abistaja teenus? | `d41bac9e4c4a` | E / E / 8 | 1.811 s |
| Q08 | Kuidas riik toetab dementsusega inimesi ja nende lähedasi? | `4b6955536dff` | E / 1 / 1 | 1.796 s |
| Q09 | Mis on CARe metoodika rehabilitatsioonis? | `a2560f654858` | E / 2 / 1 | 1.343 s |
| Q10 | Kuidas toetab spirituaalsus inimese taastumist ja rehabilitatsiooni? | `624c97ff975b` | E / 3 / 2 | 1.732 s |
| Q11 | Kuidas hinnatakse lapse abivajadust Jõgevamaa näitel? | `4ea41d27acf8` | E / E / 1 | 1.988 s |
| Q12 | Millal saab puudega laps Raasiku vallas sotsiaaltransporti? | `2cf8838b86cf` | E / E / 1 | 1.964 s |
| Q13 | Mida ütleb lastekaitseseadus abivajavast lapsest teatamise kohta? | `e8d605b2f0f1` | E / E / 4 | 2.006 s |
| Q14 | Miks on lapse oluliste suhete säilitamine asendushooldusel tähtis? | `000b7a501075` | E / E / 1 | 1.807 s |
| Q15 | Kuidas kasutada elulooraamatut asendushooldusel või lapsendatud lapsega? | `033ef57c92bd` | E / E / 1 | 1.973 s |
| Q16 | Milline on Põhja-Pärnumaa võlanõustamiskogemus? | `66b3bb6cb13d` | E / 1 / 1 | 1.621 s |
| Q17 | Kuidas jälgib õiguskantsler puuetega inimeste õiguste konventsiooni rakendamist? | `1e855dcec271` | E / E / 1 | 1.831 s |
| Q18 | Kuidas arendati Eestis sotsiaalse rehabilitatsiooni vajaduse eelhindamist? | `7302110d87e9` | E / E / 1 | 1.914 s |
| Q19 | Kuidas korraldatakse Keilas mäluhäiretega inimeste koduteenust? | `1b392a34832c` | E / E / 1 | 1.902 s |
| Q20 | Mida näitas vanemaealiste ja eakate toimetuleku uuring 2015? | `9d901444038d` | E / E / 1 | 1.751 s |
| Q21 | Elan Tallinnas ja üürivõlg kasvab. Kes aitab võlgadest välja tulla? | `124114fc91d5` | E / E / — | 1.847 s |
| Q22 | Kuidas taotleda kvantarvutitoetust? | `puudub` | neg / neg / neg | 1.515 s |

### Allikaviidete täielikud ID-d

- **Toimetulekutoetus** — `document_1a4fffc3e8e1e5254e4089cea0b5bf15aa462ec00e61c8dde9e0567df7f3f977`.
- **Koduteenus** — `document_1376e86f8e2415498a256a5ce9c2b25da24110edce0b9dc0f8adfa8e4d0327ad`.
- **Hooldajatoetus** — `document_4539134b6d86faea66fc0874f3842795c6d84a6a3e80128d6cb685d5bdf8d05a`.
- **MARAC-i juhendmaterjal** — `document_a89db3bb5817000bb395529f9407349b3bed8d6274e2deec25118c48c72795c2`.
- **MARAC – võrgustikupõhine mudel lähisuhtevägivalla juhtumite korraldamiseks** — `document_3d773f5f13653a4ba1bdbaa6ff77adcb7e4f2f0d5f2b19527a344d03671b0470`.
- **Lähisuhtevägivalla abikanalid** — `document_287ffbdc3b6ba6d70961749c916219869a6a9ffe2551bd86bef9dd3591c7a5bb`.
- **MARAC-i võrgustiku mudeli mõju hindamine. Lõppraport** — `document_95c7b79f84fd298915bbe2c13149bd2b05df6fcf01498800f4d2e03ac2d10993`.
- **Võlanõustamine** — `document_124114fc91d56ed5d57598005b7b8972c0484bd0074f646586c5a6e4fe05399b`.
- **Isikliku abistaja teenus** — `document_d41bac9e4c4a9ec312723097e0d75f8465b7b2621e4f80ddd9d2e158b42a1178`.
- **Kuidas riik toetab dementsusega inimesi ja nende lähedasi?** — `document_4b6955536dff030f2d1c55765f101c0f07b7b015aa5200eddd30b74d1c0c50ad`.
- **CARe metoodika kui kõikehõlmav rehabilitatsioonikäsitlus** — `document_a2560f654858a9cfb7236e3476cee0a6046efce39fb7e70dc326721f386238ef`.
- **Spirituaalsus kui ressurss inimeste taastumisel ja rehabilitatsioonis** — `document_624c97ff975b26804255a887e183bdfaba55d39c0a280772db608a22aa299dfd`.
- **Lapse abivajaduse hindamisest lastekaitseseadus kontekstis Jõgevamaa näitel** — `document_4ea41d27acf8b6e1194bd0a1054aaca92ceba40556ab7d65717e6a6e28c9d82a`.
- **Raasiku valla sotsiaalhoolekandelise abi osutamise kord** — `document_2cf8838b86cf04d869998fddf28caede81cc9962a34a3c2e0bb991e7d5a4aabc`.
- **Lastekaitseseadus** — `document_e8d605b2f0f123f8cdba704b85070848b8cbcb566e8511f0c6f7a382a7f26c5f`.
- **Lapse õigus kasvada peres: suhetel põhinevad lapse õigused asendushooldusel** — `document_000b7a50107583bf15b87784fa28b287e96c510d407ba4e6c9dda8c51db7ff91`.
- **Ilmus eestikeelne elulooraamat asendushooldusel ja lapsendatud lastele** — `document_033ef57c92bd2454a2791040b49568e8feb23556ad65519491f76d7a1a8b777a`.
- **Põhja-Pärnumaa võlanõustamiskogemus** — `document_66b3bb6cb13d6d855e0ed039f162132bcbfa844234641a0759fe197e6f0e1ada`.
- **Õiguskantsleri ametkonna tegevusest puuetega inimeste õiguste konventsiooni rakendamisel** — `document_1e855dcec2716f4b5e496730a602f5153172d345298a4b46b93b8fc97bfe960e`.
- **Puuetega inimeste sotsiaalse rehabilitatsiooni vajaduse eelhindamine ja rehabilitatsiooniteenuste sisu kujundamine Eestis** — `document_7302110d87e942e2504e35eeff02f8f7da485a2f7885bcb6fa234332c831a371`.
- **Mäluhäiretega inimeste toetamisest isikuabini – koduteenus Keilas** — `document_1b392a34832cc7ce947951e14aed63709f18e4291c26d9682e936b50ef1f1411`.
- **Vanemaealiste ja eakate toimetuleku uuring 2015** — `document_9d901444038d4802162b8587c0268a76113aee249ff90018fee36381893f8799`.

Q22 „kvantarvutitoetus” on tahtlikult puuduv mõiste. Kõik kolm varianti tagastasid 40 ühikut, mitte tühja tulemuse. Praegune algoritm andis taas esimeseks koroona/noorte artikli. See katse mõõdab sõnalise kanali põhjendamatu vaste tekkimist; lõpliku vastusmudeli keeldumist ei katsetatud.

Kõige praktilisemad regressioonid sellest tabelist: Q01 õige teenus peab tõusma üldise taotlemisküsimuse jaoks koolimineku lisatoetuse ette; Q06 Tallinna võlanõustamine ei tohi taanduda õigusnõustamise taha; Q07 peab leidma **Raasiku**, mitte teise omavalitsuse isikliku abistaja; Q21 olukorrakirjeldus ei leia odavamas variandis Tallinna võlanõustamist isegi top-40-st. Viimane on oluline piir: sõnalise järjestuse kiirendamine ei asenda semantilist kanalit.

## 7. Kordamine ja tõendid

Kohalik auditikaust:
`C:\Users\rauds\Desktop\Sotsiaal.ee\tmp\codex-audit\lexical-scale-20260926\`.

Serveri auditikaust:
`/home/ubuntu/apps/sotsiaalai/tmp/codex-audit/lexical-scale-20260926/`.

Kõik loodud abifailid ja mõõtmistulemused asuvad ainult nendes kaustades. Korpus eksporditi avalike teadmistebaasi ühikutena, mitte kasutajaandmetena. Ühendusfaili kasutatakse skriptis ainult ühenduse loomiseks; selle väärtusi ei logita. Skript kustutab enda protsessist `OPENAI_API_KEY`, keelab `fetch()` ja loob ühe PostgreSQL-i ühenduse lugemisvaikeseadega. Koodiradade uurimine ei käivitanud OpenAI adapterit. `smoke`-režiimi vektori- ja embeddinguadapterid viskavad kutsumise korral vea.

### Serveris

Auditiskript on `audit.mjs`; küsimused ja oodatud ID-d on `suite.json`. Skript kontrollib igal käivitamisel aktiivset generatsiooni ja keeldub teise generatsiooniga jätkamast. Algset serveri `smoke-test.mjs` faili ei muudetud ega käivitatud: auditi `smoke` kordab selle viit sõnalist päringut sama `retrieve()`-rajaga, kuid ümbritseb **iga SQL-kutse** lugemistransaktsiooniga ja jätab vektorikatsed välja.

Käivita üks režiim korraga:

```bash
ssh sotsiaalai
cd /home/ubuntu/apps/sotsiaalai/tmp/rag-v2-v25
env -u OPENAI_API_KEY TZ=UTC \
  node --import ./scripts/register-node-source-loader.mjs \
  ../codex-audit/lexical-scale-20260926/audit.mjs inventory
```

Viimase argumendi väärtused ja väljundid:

| Režiim | Mõõdab / loob |
|---|---|
| `inventory` | Generatsioon, arvud, PostgreSQL-i versioon/seaded, indeksid, tabelimahud, lähtekoodi räsid → `inventory.json` |
| `baseline` | Viie küsimuse EstNLTK aeg ja 60 s piiriga lugemis-EXPLAIN → `baseline.json`, `q1-baseline.plan.json` … `q5-baseline.plan.json` |
| `breakdown` | Q01 sobitamine / täpne skoor / morfoskoor / `ts_rank` / üldsõnade eemaldus → `breakdown.json` ja viis plaanifaili |
| `smoke` | Algse smoke'i viis sõnalist küsimust, 15 s piir, kogu otsingu ajad ja toorjärjestus → `smoke-readonly.json` |
| `suite` | 22 küsimust × 3 varianti järjestikku, 15 s piir → `suite-results.json` |
| `diagnosis` | Smoke'i esiviisiku termiskoorid, Q01 kitsas tervikterm ja sund-indeksiplaan → `score-parts.json`, `q1-specific-term.plan.json`, `q1-forced-index.plan.json`; vajab varasemat `smoke` väljundit |
| `hydrate` | Q01 40 kandidaadi dokumentide laadimine ja analüsaatori instrumentatsioon → `hydrate.json`; vajab varasemat `smoke` väljundit |
| `export` | Ainult sama korpuse ühikud, tekstid ja termiloendid → `corpus.jsonl`, `directories.json` |

Iga plaan saadi `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` abil. Täielikus JSON-is on nii filtreerivad massiivid kui hinnangulised/tegelikud read ja puhvriarvestus; raportis on neist loetav kokkuvõte. Plaanifailid on tõend, mitte tootmiskonfiguratsiooni muudatus.

Ekspordi tihendamine ja koopia toomine kohalikku auditikausta on valikuline; selle mõõtmise ajal eksporditi 29 183 rida, tihendamata 489 103 147 baiti. Ühtki korpuse eksporti ega tihendamist ei käivitatud SQL-kiiruskatsega samal ajal.

```bash
cd /home/ubuntu/apps/sotsiaalai/tmp/codex-audit/lexical-scale-20260926
gzip -1 -c corpus.jsonl > corpus.jsonl.gz
tar -czf plans.tgz -- *.json
```

Kopeeri vajadusel failid `scp` abil **sama nimega kohalikku auditikausta**. `plans.tgz` sisaldab JSON-tõendeid, mitte ühendusfaili ega võtmeid. Mõõtmised kirjutavad üle ainult auditi enda sama nimega väljundid; olemasolevate tõendite säilitamiseks kopeeri need enne uut mõõteringi eraldi auditi alamkausta.

### Kohalik analüüs

Järgnevad käsud töötavad projekti juurkaustas, pärast tõendite ja `corpus.jsonl.gz` kopeerimist. Need ei tee võrgu- ega mudelikutseid:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
python tmp/codex-audit/lexical-scale-20260926/summarize.py
python tmp/codex-audit/lexical-scale-20260926/make-suite.py
python tmp/codex-audit/lexical-scale-20260926/offline.py
python tmp/codex-audit/lexical-scale-20260926/result-summary.py
```

- `summarize.py`: `documents.json`, dokumentide pealkirjad ja sisunäited.
- `make-suite.py`: sama fikseeritud 22 küsimuse/ID-de `suite.json`; uue mõõteringi jaoks tuleb see serveri auditikausta kopeerida **enne** `suite`-režiimi.
- `offline.py`: `df.json`, `offline-stats.json`, `unit-map.json`, `anchor-extracts.json`; kogu korpuse tõendikõlblike ühikute termisagedused ja ankrute sisutekstid.
- `result-summary.py`: `suite-summary.json`, `results-section.md`; p50/p95 ja esimeses 40 ühikus leiduvate ankrute kohad. See ei muuda raportit ega projektikoodi.

Oma aruandeteksti ja JSON-kokkuvõtete numbrid kontrolliti omavahel; `git diff --check` läbis. Andmebaasi muutvaid unit-/integratsiooniteste, build'i ega olemasolevaid indekseerimiskäske ei käivitatud.

## 8. Mida ei kontrollitud

- Uue BM25 skeemi tegelik kiirus, ehitusaeg, kettamaht ja migratsiooni käitumine — **NOT_PROVEN**; skeemi loomine oli keelatud. 50–300 ms on siht, mitte katsetulemus.
- Päris küsimusevektoritega uue järjestuse hübriidkvaliteet, vastusmudeli lõppvastused, allikate sisuline kasutamine vastuses — **not_run**. Ühtegi OpenAI kutset ei tehtud. Varasemat vektori eneseleidmist ei korratud ega kasutatud vastusekvaliteedi tõendina.
- Üle 22 küsimuse ulatuv esinduslik semantiline hindamine, täielikult inimeste hinnatud relevantsusmärgendid, EN/RU ja segakeelsuse uus korpusekatse — **NOT_PROVEN**. Ankrud on piiratud; Q01–Q03 klassid on esialgsed.
- Koormuse, samaaegsete kasutajate, failover'i, füüsiliselt külma kettavahemälu ja pikaajalise p95/p99 käitumine — **not_run**. Katseid tehti ükshaaval; esimese käivituse hostikoormus oli väike, teisi serveriteenuseid ei peatatud.
- KOV-kirjete värskus, tegelik teenuse kättesaadavus, õigusaktide kehtivuse uus audit ja ülejäänud ingest-kvaliteet — väljaspool seda ülesannet. Allikasisu kasutati oodatavate otsinguankrute määramiseks, mitte tänase õigusliku nõu andmiseks.
- Tootmise kasutajate päringud, `sotsiaalai-development`, vestluse seadistus, `origin/main` ja serveri rakenduse deploy-seis — ei uuritud. Mõõdeti konkreetselt nimetatud staging-koodi ja corpus-generatsiooni.
- Automaatne vektorile taandumine sõnalise kanali vea korral — puudub selles koodirajas; uut käitumist ei teostatud ega testitud.

## 9. Soovitatud tööjärjekord

1. Lukustada uus lexical-konfiguratsioon ning eelarvutatud postituste/TF/DF leping; säilitada kõik embeddingusisendid ja ostetud vektorid.
2. Teostada eraldatud uue generatsiooni BM25-põhine sõnaline indeks, keeletöötlus ja küsimuse alternatiivide kaalumine. Enne vanast loobumist mõõta §5–6 sama ankrukogumi ja laiemate olemasolevate küsimustega.
3. Parandada kandidaatidest allikate laadimine ning viia täielik korduv morfoanalüüs päringu kriitiliselt rajalt välja, säilitades tervikluse tõendid ja õiguskontrollid.
4. Alles tulemuste järel otsustada uue korpuse otsingugeneratsiooni aktiveerimine. Vestluse arendusrentniku ümberlülitamine on eraldi otsus ja pole selle töö osa.

Üldsõnade eemaldus koos `ts_rank`-iga on mõõdetud väiksem vahevariant: 22/22 lõpetas, ankruid top-5-s 18/21, kuid p95 1,99 s ja endiselt valed esikohad. Seda võib käsitleda ajutise arendusprofiilina; **ADR-029 alla sekundi eesmärk pole sellega täidetud**. Uue embeddinguostu vajadust see audit ei leidnud.

