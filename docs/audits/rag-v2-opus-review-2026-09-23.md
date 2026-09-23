# RAG v2 / GraphRAG: sõltumatu hüpoteesi- ja koodiülevaatus

23.09.2026. Koostaja: Claude Opus 5.5. Lähteülesanne: [hüpoteetilise analüüsi §12](rag-v2-hypothetical-implementation-analysis-2026-09-23.md#12-opusele-ülesanne-hüpoteesi-ja-tehtud-töö-kriitiliseks-ülevaatuseks).
Ülevaadatud kood: `00fb25ac0..e2540b998` (`22193e7af`, `a407fb6d0`, `e2540b998`) koos kutsujatega. Tööpuu HEAD ülevaatuse ajal: `6b1fcd5e2`.
Aktiivset tööseisu kannab endiselt SotsiaalAI.md; see fail on dateeritud ülevaatus.

**Meetod ja piir.** Lugesin analüüsi §1–12, ADR-011/012/013, SotsiaalAI.md S1.0 ja S2 RAG-osa, kõik muudetud `lib/rag-v2` failid ning veebiraja kutsujad (`app/api/chat/route.js`, `lib/chat/m4PilotServer.js`, `pilot/*`, vestluse UI). Kahtlusi kontrollisin **ainult lugevate** kohalike skriptidega: Snowballi tüved, PostgreSQL-i `ts_rank_cd` VALUES-andmetel, `retrieve()` ADR-011 isoleeritud tenant'il `batch-acceptance-20260923` (ainult sõnaline kanal, sest testvektoritel pole tähendust), `createBatchReview()` sama partii peal ning `Andmebaasi/` KOV/XML andmete kuju loendused (ainult väljanimed ja arvud, mitte kontaktide väärtused). Tasulisi kutseid, serverimõõtmist, push'i ega täiskomplektide kordamist ei tehtud. Alamagente ei kasutatud (AGENTS.md; omaniku 08.09 keeld).

---

## 0. Lühikokkuvõte

1. **Põhiküsimus: kas inimene jõuab vabast olukorrakirjeldusest asjakohase abini? Praegu mitte.** Rada murdub vähemalt viies kohas: (a) sõnaline otsingukanal eelistab vaba kirjelduse korral stoppsõnu („on”, „ei”, „ole”) ja vestluse ingliskeelset päist/nummerdust; (b) KOV-kirje kaotab vastuvõtul oma struktuuri (valla seos, `relatedContacts`), mudel ei näe, millise valla kirje see on; (c) KOV-kontaktides pole ühtegi telefoni ega e-posti (819/819), kontaktikoond on vastuvõtust välja lülitatud; (d) KOV-i ega ajaperioodi ei hoita vestluse seisuna ega kasutata filtrina — piirkonnafilter ei saa üldse töötada; (e) olukorra mõistmise juhis rakendub alles pärast otsingut vastusekutses.
2. **Uus kood on tehniliselt hoolikas** (tööõigused, idempotentsus, fail-closed kontrollid, ausad NOT_PROVEN-märked). Olulisemad vead on integratsioonis ja andmemudelis, mitte lukkudes.
3. **Uus ülevaatus/avaldamisrada ei suuda päris korpust avaldada:** 98% KOV-kirjetest ja ~54% RT XML-aktidest saavad koodi tekitatud *vale* konflikti, mis on blokeeriv. ADR-011 päris valim avaldati vana `ingest()` API kaudu ega läbinud uut väravat; läbiks 2/6.
4. **Codexi hüpoteesi tuum on õige** (ühine allika-/versiooni-/tõendileping, üks vastusekutse pöörde kohta, ei käsitsi sõnaloendeid), **kuid KOV-rada ei ole tekstiosade RAG-i probleem** ja LLM-i koostatud väitegraaf ei ole praegu väärtuse allikas. Soovitan KOV-i jaoks struktureeritud kirjete/kataloogi rada ning vestluse seisu väljundit sama vastusekutse sees.
5. **Järgmised plokid:** (1) üks läbiv olukorrast-KOV-kontaktini rada 2–3 vallaga; (2) keelekihi mõõdetav parandus märgistatud valimil; (3) ajakirjakorpuse mahutöötlus *ilma* LLM-teadmiskoostamiseta + perioodi katvus. Codexi ettepanek jätkata mahutöö ja adminiühendusega on õige suund valel ajal.

---

## 1. Hinnang eesmärgile vastavusele

### 1.1. Mis töötab tehniliselt (kohalikult, testvektoritega)

- Külmutatud vastuvõtupartii, `SKIP LOCKED` tööõigus, katkestusest jätkamine ja muutumatu väljundi taaskasutus (`ingest-batch*.js`).
- Ülevaatusfaili ja avaldamise sidumine allika, hoiatuste ja baaspõlvkonnaga; hilinenud kordus ei kirjuta uuemat kataloogi üle (`ingest-publication.js`).
- Jätkatav indekseerimine: tööõiguse kaitse `advanceIndex`/`activateIndex` CAS-tingimustes, idempotentsed PG/Qdranti kirjutused, täielik lõppkontroll enne aktiveerimist (`index-jobs*.js`).
- `retrieve()` valikuline laadimine: õigused ja filtrid rakenduvad enne kandidaatide piiri, võõras ID peatab päringu enne täisteksti laadimist, sisse tulev erand laaditakse pöördaadressi kaudu.
- Tüved on eraldi veerus ega jõua allikatsitaati ega mudelikonteksti.

### 1.2. Mida kasutaja täna teha saab

- **Tootmise tavavestlus: mitte midagi.** `app/api/chat/route.js:26-30` tagastab ilma piloodi päiseta `503 RAG_RETIRED`.
- **M4 piloot:** ainult konfiguratsioonis nimetatud kasutajad, fikseeritud dokumendiloend (`pilot/retrieval.js:14`). Päris režiim nõuab uut kinnitust, sest `implementationManifest` räsib kogu `lib/rag-v2` ja `PROMPT_VERSION` muutus (`-8` → `-9`); `purpose: 'execute'` lükkab vana plaani tagasi (`pilot/config.js`, `implementation_approval_mismatch`). Uus profiil `hybrid-multilingual-dependencies-v1` ei ole ühelgi kasutajarajal kasutusel (esineb ainult `profiles.js`-s, testis ja dokumentides).
- **Kohalikult:** testrežiim fikseeritud tõendiga (`test_transport_fixed_selection`) — see ei ole otsingu ega vastuse kvaliteedi tõend.

### 1.3. Kolm läbivat stsenaariumi

| Stsenaarium | Mis juhtub koodis | Hinnang |
| --- | --- | --- |
| Artikliküsimus („omastehooldajate koormuse vähendamine”) | Hübriidotsing top-5 + ≤4 sõltuvuslisa, bibliograafia (pealkiri/autor/kuupäev), PDF-lehed, allikapaneel. `omastehooldaja*` vormid ühtivad eesti tüvega. | **Tehniliselt võimalik** indekseeritud alamhulgas (≤5000 tekstiosa ≈ alla 10% korpusest). Uurimistulemuse/arvamuse eristus on ainult juhises. Sisuline kvaliteet NOT_PROVEN. |
| Kahe perioodi võrdlus | Katvuse, perioodikvootide ega koondamise rada puudub. Piloot ei anna `publication_from/to` filtreid. Vastus põhineks ≤9 tekstiosal. | **Ei toetata.** Oht üldistada üksikutest lõikudest; juhis võib selle piiranguna esitada. |
| „Olen üksi kodus, raske on toimetulek, tööd ei ole” → KOV → „kellele helistan?” → teine vald → „lihtsamalt” | Vt §1.4. | **Ei jõua kontaktini.** Parimal juhul küsib mudel täpsustust (õige esimene samm), kuid edasised pöörded ei saa usaldusväärselt õiget valda, teenust ega kontaktikanalit. |

### 1.4. Olukorrakirjelduse jälg

1. **Sisend → otsingutekst.** Esimesel pöördel läheb otsingusse toortekst. Jätkupöördel ehitab `buildDialogueQuery` (`pilot/dialogue.js:74-86`) teksti: ingliskeelne päis „Active topic and person…” + `1. USER MESSAGE:` … kõigi sama teema pöörete kohta. Filtrid on alati tühjad (`strictFilters: {}`); `queryForProfile` saab ainult `text/language/generation_id` (`pilot/retrieval.js:49`).
2. **Sõnaline kanal.** `plainto_tsquery('simple')` ilma stoppsõnadeta, kõik sõnad VÕI-ga (`search/postgres.js:152-161`). Mõõdetud:
   - VALUES-kopeering (sama SQL): päringule „Olen üksi kodus, raske on toimetulek, tööd ei ole.” sai asjakohatu lõik skoori **6,48**, koduteenuse lõik 1,22 ja toimetulekutoetuse lõik 0,82. Päring `toimetulek` ei leidnud vormi `toimetulekut` üldse.
   - Päris `retrieve()` ADR-011 valimil: sama lause top-5 = 4 lõiku 2016. aasta STAR-registri artiklist + õigusakti § 7; Anija koduteenus ega erakorraline toetus ei jõudnud top-5 hulka. Analüüsi enda näide „…eaka koduse toimetulekuga; kelle poole pöörduda?” andis samuti ainult õigusakti ja artikli lõike. `toimetulek` → `empty`.
   - Vestlusraja tekst („Vajan emale kodus abi” / „Elame Anija vallas” / „Kellele helistada?”) → top-5 = ainult õigusakti §§ 8, 14, 22, 17, 5 (nummerdus „1”, „2”, „3” ja „abi” tabavad paragrahve). Ilma päiseta oli esimene kontakti `relatedTo` ID-loend. Koduteenuse kirje ei jõudnud kummalgi juhul top-5 hulka.
3. **Vektorikanal.** Veebirada hangib suvalise päringu embedding'u (`pilot/service.js`, `text-embedding-3-large`). Selle panus on mõõtmata (kohalikud testvektorid on räsid). RRF annab mõlemale kanalile võrdse kaalu (`search/ranking.js:3-18`), nii et sõnalise kanali müra võtab osa viiest seemnekohast ka siis, kui vektorkanal leiab õige kirje.
4. **Tõendipakett.** KOV-kirje iga JSON-väli on eraldi tekstiosa; ka `status: "active"` ja kontakti `relatedTo` ID-loend on tõendiks lubatud. Mudel näeb allika kohta `source_type, authority, language, historical, source_status, valid_*, source_checked_at` (`search/model-context.js:7-11`) — **mitte valda ega maakonda**.
5. **Vastusekutse.** `m4-grounded-answer-9` juhis eristab öeldut, võimalikku vajadust ja teadmata asjaolu ning küsib kuni kaks täpsustust. See on hea juhis, kuid see töötab ainult juba valitud tõendiga. Otsingut see ei suuna.
6. **Jätkupöörded.** Ulatust juhib käsitsi rippmenüü (`components/chat/PilotContextControls.jsx:20-23`), vaikimisi „same” (`usePilotDialogue.js:5`). KOV-i ega perioodi ei salvestata seisuna. Parandus mõjub parandusena ainult siis, kui kasutaja valib „correction”. „Selgita lihtsamalt” teeb uue otsingu sama liitteksti põhjal ega kanna eelmist tõendit edasi. Teema kohta on 8 pööret (`DIALOGUE_LIMITS`).
7. **Kontakt.** 79 KOV-paketi 819 kontaktikirjest ei ole ühelgi telefoni ega e-posti. Teenustest 7/1271 sisaldab telefoni mustrit. Telefonide ja e-postidega kontaktikoond (`kontaktid/`, roll `reference_lookup`) lükatakse `registered-source.js:9` tagasi ning S2 järgi on vana üleriigiline kontaktikoopia tootes peidetud kuni värske korje ja moderatsioonini.

---

## 2. Leiud tõsiduse järjekorras

Liigitus: **U** = uus viga nendes commit'ides; **K** = uue ja olemasoleva koodi koosmõju; **V** = varasem puudus; **E** = kontrollimata eeldus; **A** = arhitektuurieelistus.

### L1 — Kõrge (K): uus avaldamisvärav blokeerib päris KOV- ja XML-allikad valekonfliktide tõttu

- **Kus:** `lib/rag-v2/ingest-publication.js:35-38` (iga `*_conflict` hoiatus = blocker), `:69` (`batch_review_blocked`); põhjused `lib/rag-v2/metadata-adapter.js:6` ja `lib/rag-v2/normalize.js:85,88-92`.
- **Käivitav olukord:** KOV-i JSON-kirjel on nii `title`/`name` kui ka `municipality_name`. Aliastabelis on `title: ['title','name','municipality_name','municipality']`, seega tekib alati `metadata_candidate_conflict` (`title`). RT XML-i puhul võrreldakse metaandme toorkuupäeva `2019-11-04+02:00` normaliseeritud väärtusega `2019-11-04` ja tekib `source_metadata_conflict`.
- **Mõõdetud mõju:** 4876/4957 KOV-kirjet (98%) saavad vale `title`-konflikti. 56/104 RT XML-aktil on tsooniga kuupäev. `createBatchReview()` ADR-011 päris valimil: **lubatud 2/6** (ainult kaks ajakirjaartiklit). ADR-011 valim avaldati `tmp/rag-v2-batch-acceptance/exercise.mjs:21` kaudu vana `ingest()` API-ga, mis väravat ei läbi. Uut avaldamisrada kontrolliti ainult sünteetiliste allikatega.
- **Parandus:** KOV-kirje puhul ei ole paketi `municipality_name` pealkirja kandidaat. Kuupäevi tuleb võrrelda normaliseeritud kujul ja säilitada toorkuju päritolus. Lisa regressioonitest, mis viib kolm päris allikatüüpi läbi `review → publish`. Ära nõrgenda väravat üldiselt.

### L2 — Kõrge (V/A): KOV-kirje kaotab struktuuri; vale valla andmete oht on sisse ehitatud

- **Kus:** `lib/rag-v2/text-source.js:123-128` (`NON_CONTENT` sisaldab `municipality_*`, `county`, `relatedContacts`, `relatedForms`), `:146-153` (iga väli eraldi lõik); `search/model-context.js:7-11`.
- **Olukord:** 2327 teenuse- ja toetusekirjest ainult 911 nimetab oma valda pealkirjas või kokkuvõttes. „Koduteenus” on 74 vallas ja „toimetulekutoetus” 70 vallas. Näiteks `application` lõik „Võta ühendust valla sotsiaaltööspetsialistiga…” ei sisalda valla nime ei tekstis, pealkirjateel ega mudeli metaandmetes.
- **Mõju:** kui KOV-korpus indekseeritakse täismahus, saab mudel teise valla tingimuse või taotlemise sammu ega saa seda eristada. See on §11.1 nullveaklass („vale KOV-i andmete esitamine õigena”). Allikas olemasolevad selgesõnalised seosed kaovad: `relatedContacts` on 1104/1271 teenusel ja 872/1056 toetusel. Kontakti leidmine jääb tekstisarnasuse peale.
- **Parandus:** vt §4 ja §5 P1. KOV-kirjed peavad olema struktureeritud kirjed (vald, tüüp, väljad, lingid), mitte väljade kaupa tükeldatud tekst.

### L3 — Kõrge (E): „kontaktisik” ei ole andmetest kättesaadav

- **Kus:** andmed `Andmebaasi/KOV/**` ja `Andmebaasi/REGISTER.json`; `registered-source.js:9`.
- **Tõend:** 819 KOV-kontaktikirjest on 0 telefoni ja 0 e-posti. Telefonidega kontaktikoond on `reference_lookup`, mille adapter tagasi lükkab. Analüüsi §4.2 („kontaktikoond võetakse lähteandmeteks”) on vastuolus S2 tooteotsusega hoida vana kontaktikoopia peidus. Põhirakenduses on juba `Municipality`, `ServiceMapEntry` (`phone`, `email`, `checkedAt`, `tombstonedAt`, staatus) ja ülevaatusega `SourcePackageSnapshot`; analüüs neid ei maini.
- **Mõju:** „Kellele helistan?” saab parimal juhul vastuseks nime, rolli ja osakonna ilma kanalita.
- **Parandus:** otsustada üks kontaktide tõeallikas. Soovitan põhirakenduse üle vaadatud kirjeid adapteri kaudu. Praeguseks esitada kontakt ainult üle vaadatud kirjest, muidu ametlik leht ja märge „kontakt kinnitamata”.

### L4 — Kõrge (V, keelekanal süvendab): sõnaline kanal on vaba kirjelduse jaoks mürarikas

- **Kus:** `search/postgres.js:155-161` (VÕI-päring, `simple` konfiguratsioon, stoppsõnu ei eemaldata), `pilot/dialogue.js:77-78` (ingliskeelne päis ja numbrid otsingutekstis), `search/ranking.js:3-18` (võrdsed RRF-kaalud).
- **Tõend:** vt §1.4 punkt 2. Eitus („tööd **ei** ole”) on otsingus tavaline sõna.
- **Parandus (odav, lokaalne):** eemalda vestluse päis ja nummerdus otsingutekstist (mudelile võivad need jääda). Summuta korpuse sageduse (DF) põhjal väga sagedased terminid; see ei ole käsitsi sõnaloend. Kaalu pika vaba teksti puhul sõnalist kanalit vähem. Mõõda märgistatud valimil (P2).

### L5 — Keskmine-kõrge (E): Snowballi eesti tüvestaja ei ühenda põhilisi käändeid; ADR-i näited on esindamatud

- **Kus:** `search/morphology.js:8,16-17` (iga sõna kolme tüvestajaga, alla 3 tähe sõnad jäetakse välja); `tests/rag-v2-morphology.test.mjs:9-10`.
- **Tõend:** 25 levinud algvormi ja käändevormi paarist jagab mõnda terminit 9. Eesti tüvestaja kaudu ühtib 5. Neli ühtivad ainult seetõttu, et **inglise** tüvestaja lõikab eesti sõnalt „-e”/„-ed” (`toetus/toetuse`, `koduteenus/koduteenuse`, `hooldus/hoolduse`). Ei ühti näiteks `toimetulek/toimetuleku`, `vald/vallas`, `laps/lapse`, `laps/lapsed`, `pere/perekonna`, `puue/puudega`. Liitsõnad ei ühti (`toimetulek/toimetulekutoetus`). Test kontrollib nimetava ja osastava paare (`toetus/toetust`), mis juhtumisi töötavad. Nimetava ja omastava vaheldus on eesti päringu ja dokumendi vahel kõige sagedasem. Lisaks tekitavad tüved müra: `koduteenus → kodutee`.
- **Võrdlus:** PostgreSQL-i `pg_trgm` stiilis trigrammide sarnasus annab samadele paaridele 24/25 ≥ 0,30, sh liitsõna 0,56, kuid tekitab valepositiivseid (`vald/valge` 0,38, `hooldus/hoolimatus` 0,36). See on hinnatav alternatiiv, mitte valmis otsus.
- **Parandus:** P2. ADR-i väidet „käändevormid leitakse” tuleb kitsendada seni, kuni mõõtmine seda toetab.

### L6 — Keskmine (V; uus kood kordab): piirkonnafilter ei saa kunagi töötada ja `valid_at` välistab kõik KOV-kirjed

- **Kus:** `search/ranking.js:21` loeb `fields.regions`, mida `normalize.js` ei loo (dokumendil on `municipality_id`, `municipality_name`, `county`). `search/discovery.js:10` kopeerib ADR-013 aadressiloendisse alati `regions: null`. `ranking.js:25` nõuab nii algust kui lõppu.
- **Tõend:** päris Anija bundle'itel annab `filtersMatch(region: 'Anija vald' | 'anija_vald')` tulemuse `false` ja `valid_at: '2026-09-23'` samuti `false`. `valid_from/valid_to` on tühjad kõigil 4957 KOV-kirjel. Kõik piirkonnatestid kontrollivad ainult tühja tulemust. ADR-013 väide, et piirkonnafilter rakendub enne kandidaatide piiri, on formaalselt tõene, kuid sisuliselt tühi.
- **Mõju:** praegu varjatud, sest ükski kutsuja filtreid ei anna. KOV-i ulatuse teostamisel annaks filter vaikselt tühja tulemuse, mida oleks lihtne tõlgendada kui „teenust pole”.
- **Parandus:** filtreeri kanonilise KOV-tunnuse järgi (`municipality_id`, seotud põhirakenduse `Municipality`-ga). Teadmata kehtivus peab olema eraldi tulemus (§4.2).

### L7 — Keskmine (V): ADR-013 kokkuhoid ei jõua veebirajale

- **Kus:** `pilot/service.js:73` → `pilot/retrieval.js:16-24` (`preflight` laeb iga pöörde alguses kõigi konfigureeritud dokumentide bundle'id ja kontrollib kõik objektid); `pilot/retrieval.js:54-66` (`canonical()` loob iga viite jaoks uue `pg.Pool`-i ja laeb terve bundle'i; pöörde jooksul umbes 3 × kuni 9 viidet).
- **Mõju:** veebipöörde lugemismaht sõltub endiselt kogu piloodi korpusest. Suurema korpuse korral on see latentsuse ja mälu piir. S2 M6 rida kirjeldab preflight'i tervikuna lugemist, ADR-013 piirid seda ei maini.
- **Parandus:** preflight kontrollib põlvkonda ja versioone aadressiloendi või versiooniridade kaudu, bundle'eid ei laadita. Canonical kasutab ühte ühendust ja vahemälu pöörde piires.

### L8 — Keskmine (operatiivne; serveris kontrollimata): deploy ei migreeri RAG v2 andmebaasi

- **Kus:** `scripts/deploy-server.mjs:224-229` rakendab ainult põhiskeemi. `search/postgres.js` `bundles()` valib nüüd alati `d.retrieval_directory`, `importSnapshot()` kirjutab veergu `morphology`.
- **Olukord:** `git branch -r --contains 22193e7af` näitab, et commit on `origin/main`-is. S1.0 rida 117 kinnitab push'i, rida 124 ütleb aga „tootmisse viimata”. Kui serveri RAG v2 andmebaasi migratsioone `202609230001–0004` käsitsi ei rakendatud, kukuvad seal M4 preflight/otsing ja admini v2 vastuvõtu indekseerimine.
- **Lisaks:** `pilot/provenance.js:9-21` räsib ka `messages/*.json`, `prisma/schema.prisma`, `package*.json` ja vestluse UI komponendid. Iga UI- või tõlkedeploy tühistab päris piloodi kinnituse. See on ebaproportsionaalne seos.
- **Parandus:** mõõda serveris veergude olemasolu. Lisa RAG v2 migratsioon deploy'sse või kaitse, mis lülitab RAG v2 raja selge veaga välja. Kitsenda manifest RAG-i käitusfailidele. Paranda S1.0 vastuolu.

### L9 — Keskmine (V vs §8.1): vestluse ühendus on mehaaniline, mitte sisuline

- **Kus:** `PilotContextControls.jsx:20-23`, `usePilotDialogue.js:5`, `pilot/dialogue.js:5,74-86`.
- **Mõju:** kasutaja peab valima „parandus/uus/uus inimene/teema/vastus/punkt”. Vaikimisi liidetakse kõik pöörded otsingusse. KOV-i ja perioodi seisu pole. „Lihtsamalt” ei kasuta eelmist tõendit. 8 pööret teema kohta. Juhis on hea, kuid süsteem ei anna talle §8.1 vajalikku seisu.
- **Parandus:** P1, vestluse seis vastuseskeemis.

### L10 — Madal-keskmine (U, proportsionaalsus): ülevaatusfail nõuab märkust iga hoiatusega allika kohta

- **Kus:** `ingest-publication.js:67`; `text-source.js:164` lisab `collected_package_text` hoiatuse igale JSON-allikale.
- **Mõju:** iga KOV-kirje vajab käsitsi märkust. 1000 kirjega käsitsi täidetav JSON ei ole töövõtena realistlik; pärast L1 parandust saab see järgmiseks pudelikaelaks.
- **Parandus:** teadaolevate, mittekriitiliste hoiatuskoodide jaoks reeglipõhine kinnitus koos auditiga; käsitsi märkus ainult blocker'i või uue koodi korral.

### L11 — Madal (U): ajutine viga muutub püsivaks `needs_review` seisuks

- **Kus:** `ingest-batch.js:136-139`; partii id on sisust tuletatud, seega sama valikut ei saa uuesti järjekorda panna.
- **Olukord:** Windowsi EPERM/EBUSY `rename`-il (viirusetõrje või indekseerija) → `loadVersion` ENOENT → `batch_preparation_failed`.
- **Parandus:** eristada sisendiviga ja keskkonnaviga; auditeeritud `requeue`.

### L12 — Madal (andmekvaliteet): KOV-korje artefaktid lähevad mudelile

- 99/4957 kirjes on AI-veebikorje viitejäänuseid `【…†L…】` (näiteks summa väljas).
- `status: "active"` ja kontakti `relatedTo` ID-loend on tõendiks lubatud lõigud.
- KOV-tekst on AI-kogutud sekundaarandmestik; seda kinnitab ka hoiatus `collected_package_text`.

### L13 — Madal (A, skaleerumine)

- Iga allikamuudatus loob uue *täis*põlvkonna: kõik tekstiosad kopeeritakse PG-sse ja luuakse uus Qdranti kogu (`index-jobs.js:43-58`). Vanade põlvkondade ega kogude koristamist pole.
- Qdranti päring saadab iga kord kõik lubatud üksuste ID-d (`has_id`) ja teeb `exact: true` täisläbivaatuse (`qdrant.js:94-99`). Iga päring loeb ja räsib kõigi nähtavate dokumentide aadressiloendid.
- Korpus: 892 artiklit, 185 juhendit, 104 õigusakti ja ~4957 KOV-kirjet. Hinnanguliselt 50k+ tekstiosa (KOV-väljade tükeldusega ~25k) vs piir 5000.

### L14 — Madal (V, varjatud): filtriga välja jäänud sõltuvus kannab üldist põhjust

`dependencies.js:42-45,94-96`: päringufiltrist välja jäänud tingimusdokument märgitakse `dependency_target_unavailable`, sama koodiga nagu puuduv või keelatud dokument. Tulemus on küll `incomplete`, mitte vaikne, kuid põhjus peaks olema eristatav, näiteks `outside_query_scope`. Sama käitumine kehtib vanal rajal.

### L15 — Info

- Kolm punast vana artiklitesti (`tests/rag-v2-search.integration.test.mjs:270` jt) on usutavalt andmete triiv (07.09 korpuse ja metaandmete parandus), mitte koodiregressioon; ADR-011 selgitus on usutav. Teadaolevalt punaste testide hoidmise asemel seo sisend räsiga arhiveeritud fikstuuriga.
- Aktiivse põlvkonna tagasipööramine ei ole API kaudu võimalik (`search/postgres.js:83`, `requested_sequence`). See on 08.09 hooldustoiminguna dokumenteeritud; §2 lubadus „taastada eelmine tervik” vajab kas API-t või runbook'i.
- `scripts/rag-v2-selection-compare.mjs` on Gitis jälgimata, kuigi ADR-005 viitab sellele.

### 2.1. Alad, kus viga ei leidnud (kontrolli ulatus)

- **Tööõigused ja aegunud töötleja:** `finish`, `advanceIndex` ja `activateIndex` sisaldavad tokenit ja `lease_until > clock_timestamp()`. Qdranti/PG kirjutused on deterministlike ID-dega ja idempotentsed, seega aegunud töötleja kirjutus on kahjutu. Kontrollitud koodi lugemisega.
- **Avaldamise korduskindlus:** kviitung enne `writeActive`; vana otsus uuema põlvkonna järel ebaõnnestub; `writer.lock` hoitakse ainult vahetuse ajal. Koodi lugemisega.
- **Otsingu õiguste järjekord:** poliitika → nähtavad → filtrid → kanalid → võõra ID tõrje → lõpus uus õiguste kontroll. Koodi lugemisega ja ADR-013 testide sisu kontrolliga.
- **Tüved ei jõua tsitaati ega mudelisse:** eraldi `morphology` veerg; `modelProjection` kasutab `source_text`-i.
- **Uut HTTP-pinda ei tekkinud:** partii- ja indeksitöö on ainult CLI.
- **Uutel radadel tasulisi väliskutseid pole.**

---

## 3. Hüpoteesi kriitika

### 3.1. Põhjendatud — säilita

- Muutumatud allikaversioonid, kanoonilised viited, põlvkonna kinnitamine päringus, õiguste korduskontroll, kuluregister ja teadmata tulemusega kutse kordamise keeld.
- **Üks vastust koostav mudelikutse tavapöörde kohta.** See on saavutatav, kuid mitte praegusel kujul (vt 3.3).
- Keel üldistes vahendites (embedding + automaatne töötlus), mitte promptis käsitsi loendites.
- Tuum pluss adapter. SotsiaalAI-spetsiifika kuulub adapterisse.

### 3.2. Nõrgad või valed eeldused

| Eeldus | Probleem |
| --- | --- |
| Üks tekstiosade RAG teenindab kõiki kolme rada | KOV on **suletud, loetletav kirjekogum** (~30 teenust/toetust valla kohta) selgete seostega. Tekstiosade top-k lõhub struktuuri (L2), ei võimalda „kõik teenused” vastust ja paisutab indeksi. Perioodivõrdlus vajab metaandmete katvust ja koondamist, mitte väitegraafi. |
| Olukorra mõistmise juhis vastusekutses aitab leida abi | Juhis töötab pärast otsingut. Kui tõend puudub, saab mudel ainult küsida (L4, §1.4). |
| Snowball on arvestatav eesti morfoloogia kiht | Mõõdetult nõrk ja juhuslik (L5). |
| Graaf annab tingimused ja erandid | Väitegraaf on LLM-i koostatud: valimis 0, serveris üks dokument, 13 väidet ja 1 seos. Samal ajal visatakse allika **selgesõnalised** seosed (`relatedContacts`, `municipality_id`, `relatedForms`) ära. Tegelik väärtus on praegu andmetes olemas, mitte LLM-graafis. |
| Kontaktikoond on kasutatav lähteandmestik | Vastuolus tooteotsusega; KOV-pakettides pole kanaleid (L3). |
| Järgmine samm on mahutöö ja admin | Ilma töötava rajata ja mõõdikuta skaleerib see praeguseid vigu (L1, L2, L4). |

### 3.3. Soovitatud sihtarhitektuur (lihtsustus, mitte ümberkirjutus)

1. **Ajakirjad, juhendid ja õigusaktid:** praegune hübriidotsing (parandatud sõnaline kanal + mitmekeelne embedding), versioonid ja viited. Graaf ainult õigusaktide viidetele (RT XML-is on need struktuursed) ja hiljem.
2. **KOV-rada: struktureeritud kirjete allikas tuuma liidesena** (`StructuredRecordSource`). SotsiaalAI adapter loeb põhirakenduse `Municipality`, üle vaadatud KOV-paketid ja kontaktid. Kui vald on teada, antakse mudelile selle valla **teenusekataloog** (pealkiri, tüüp, lühikokkuvõte; ~1–3k tokenit) ja valitud kirjete detailid koos lingitud kontaktidega. Top-k ega tüvestamist pole vaja; „kõik teenused” on loendus. Kontaktikanal tuleb ainult üle vaadatud kirjest.
   - Eelis: õige vald ja kontakt garanteeritakse andmetega.
   - Kulu: adapter + kataloogi projektsioon + kaks tõendiliiki paketis.
   - Üleminek: KOV-kirjeid pole vaja tekstiindeksisse viia; olemasolev JSON-i adapter jääb ajalooliseks.
3. **Vestluse seis sama vastusekutse väljundina.** Vastuseskeemi lisandub `dialogue_state`: vald (kanoniline id), vajaduse kandidaadid, kasutaja öeldud asjaolud, teadmata asjaolud, periood ja keelevihje. Server valideerib selle kanonilise KOV-loendi vastu ning salvestab mudeli tõlgendusena, mitte kasutajafaktina. Järgmine pööre kasutab seda otsingu ulatuseks ja filtriks. Jooksva pöörde KOV-nime tuvastus käib deterministlikult kanonilisest `Municipality` loendist (andmed, mitte käsitsi sõnavormid).
   - Eelis: lisamudelikutset pole ning rippmenüü jääb ainult eksperdi ülekirjutuseks.
   - Kulu: skeemi versioon + valideerimine.
   - Üleminek: `m4-active-dialogue-2`.
4. **Tõendi edasikandmine.** Embedding maksab tavaliselt sadu kordi vähem kui vastusekutse, seega otsingu vahelejätmine ei ole kululeevendus. Väärtus tuleb eelmise tõendi uuesti valideeritud edasikandmisest, nii et „lihtsamalt” põhineb samadel allikatel. Uus otsing võib samal ajal jätkuda.
5. **Perioodivõrdlus eraldi rajana** oma eelarvega: katvustabel → perioodikvoodid → perioodi kokkuvõtted → võrdlus. Loendusühik on artikkel, mitte lõik. Siin on mitu mudelikutset põhjendatud.
6. **Külmuta** LLM-teadmiskoostamise laiendus (mitme dokumendi seostamine, admini ülevaatus) seni, kuni rajad 1–2 töötavad. Säilita olemasolev kood.

**Proportsionaalsus.** Terviklusräsid ja CAS-kaitsed on kvaliteetsed ning suuresti juba tehtud; neid ei tasu eemaldada. Kulu tekib arenduskiiruses: iga uus võime vajab lepinguversioone, `READABLE_*` loendeid ja kinnituse räsi. Kõige ebaproportsionaalsem on kinnituse sidumine UI- ja tõlkefailidega (L8). Partii tööõiguste mehhanism ühe operaatori jaoks on vajalikust suurem, kuid odav; laiendada seda ei ole vaja.

### 3.4. Vastused §12.3 küsimustele lühidalt

1. **Arhitektuur:** tuum sobib, ühtne tekstiosade rada KOV-i jaoks mitte. Graaf annab väärtust õigusaktide tingimustes ja eranditest ning allika selgesõnalistes seostes.
2. **Vaba mure → allikas:** murdub otsingus, andmemudelis ja kontaktiandmetes (§1.4). Pelgalt empaatilist vastust ei tohi pidada tõendiks.
3. **Keel:** Snowball on ebapiisav. Embedding teeb tõenäoliselt põhitöö (mõõtmata). Mõõda valimil DF-summutus, `pg_trgm` ja Vabamorfi lemmad (viimane ainult siis, kui kasu õigustab Pythoni sammu).
4. **Vestlus:** mehaaniline ulatus ilma seisuta (L9). Vt 3.3 p 3–4.
5. **Kulu:** veebirada hangib suvalise päringu embedding'u. Kulu määrab vastusekutse. Lisamudelietappi ei soovita. Seis tuleb sama kutse väljundist.
6. **KOV ja aeg:** vaja struktureeritud kirjeid, kanonilist KOV-i, lingitud kontakte ning eraldi kuupäevatüüpe ja teadmata kehtivust. Top-k ei tõenda „kõiki teenuseid” ega perioodi arengut.

---

## 4. Kolm järgmist arendusplokki

**Enne järgmist deploy'd (väike hügieen, mitte plokk):** mõõda serveri RAG v2 skeem ja lisa migratsioon või kaitse; kitsenda `implementationManifest`; paranda S1.0 vastuolu (L8).

### P1 — Üks läbiv olukorrast KOV-kontaktini rada (2–3 valda)

- **Kasutajale nähtav tulemus:** inimene kirjeldab muret oma sõnadega → assistent küsib vajadusel valda ja põhivajadust (≤2 küsimust) → pakub 1–3 põhjendatud kohalikku võimalust koos järgmise sammuga → „kellele helistan?” annab üle vaadatud kontakti või ausa „kinnitamata, ametlik leht” vastuse → „aga naabervallas / Kose vallas” vahetab ulatuse → „lihtsamalt” kasutab sama tõendit.
- **Ulatus:**
  - L1 adapteriparandus.
  - `StructuredRecordSource` ja KOV-kataloogi projektsioon koos `relatedContacts` linkidega.
  - Kanoniline vald `Municipality` põhjal.
  - `dialogue_state` vastuseskeemis.
  - Deterministlik KOV-nime tuvastus.
  - Kontakt ainult üle vaadatud kirjest.
  - Vestluse päis ja nummerdus eemaldatud otsingutekstist.
- **Sõltuvus:** omaniku otsus, milline kontaktiallikas loeb üle vaadatuks, ning 2–3 valla valim.
- **Vastuvõtt (kohalik, tasuta):** testtranspordi fikseeritud `dialogue_state`-iga peab kehtima:
  - Tõendipaketis on ainult õige valla kirjed ja lingitud kontakt; ühtegi teise valla kirjet ei ole.
  - Valla parandus vahetab kõik kirjed.
  - Kontakt on kirjega sõna-sõnalt sama ja kannab värskuse seisu.
  - Puuduv vald annab täpsustuse märke.
  - „Lihtsamalt” kasutab samu uuesti valideeritud tõendi ID-sid.
  - Päris mudeli mõistmine jääb NOT_PROVEN. Omaniku soovil tõendaks selle 10 kinnist stsenaariumi (senti).

### P2 — Keelekiht mõõdetavaks ja lihtsamaks

- **Tulemus:** käändes, liitsõnaga, eitusega või EN→ET esitatud küsimus leiab õige allika; iga kanali panus on teada.
- **Ulatus:** 40–60 omaniku või valdkonnaeksperdi märgistatud päringut koos oodatud allikatega (kinnine valim). Kohalikult ja tasuta mõõdetavad variandid:
  - praegune Snowball;
  - DF-summutus;
  - `pg_trgm`;
  - valikuliselt Vabamorfi lemmad indekseerimisel.
  - Lisaks RRF-kaal pika teksti jaoks.
- **Sõltuvus:** märgistatud valim. Vektorikanali mõõtmine vajab valimi päris embedding'uid (senti, valikuline).
- **Vastuvõtt:** kanalite recall@5 raportis. L4 ja L5 näited parandatud. Käsitsi sõnaloendeid pole.

### P3 — Ajakirja- ja juhendikorpuse mahutöötlus ilma LLM-teadmiskoostamiseta + perioodi katvus

- **Tulemus:** kõik 892 artiklit on otsitavad õige bibliograafiaga ning esimene katvust arvestav kahe perioodi võrdlus näitab nimetajaid.
- **Ulatus:**
  - partiivastuvõtt reeglipõhise hoiatuste kinnitusega (L10);
  - päris embedding'ud (mahutöö kulu vajab omaniku kinnitust);
  - 5000 piiri tõstmine pärast L7 parandust ja mõõtmist;
  - katvustabel;
  - perioodirada (3.3 p 5).
  - Teadmiskaardid ainult õigusaktidele ja hiljem.
- **Sõltuvus:** P2 mõõdik ja kulu kokkulepe.
- **Vastuvõtt:** korpus on indekseeritud; latentsus ja mälu on mõõdetud täismahus; katvuslüngad on raportis; võrdlus viitab mõlemale perioodile ja loendab artikleid.

**Codexi ettepaneku hinnang:** mahutöö on P3 osa, kuid enne seda tuleb P1 ja P2. Adminiliides ei ole ühe operaatori juures praegu pudelikael; CLI piisab.

---

## 5. Alles jääv ebakindlus

- Vektorikanali (`text-embedding-3-large`) tegelik panus vaba ja EN→ET teksti korral on mõõtmata. Võimalik, et see kompenseerib osa L4/L5 mõjust. Sõnalise kanali müra jääb siiski RRF-i.
- Päris mudeli olukorra mõistmine, täpsustuste kvaliteet ja „ühe kutse” piisavus on NOT_PROVEN.
- Serveri RAG v2 skeem, M4 plaani seis ja piloodi tegelik kasutatavus on mõõtmata (L8).
- Minu 25 käändepaari ja sünteetilised lõigud on indikatiivsed, mitte esinduslik valim. Otsus peab tuginema P2 märgistatud valimile.
- 56/104 XML-akti arv põhineb tsooniga kuupäeva esinemisel metaandmetes. Konflikt tekib, kui parser annab samale väljale väärtuse, nagu valimi aktil juhtus.
- Kolme vana testi selgitust ei tõestanud ma sõltumatult uuesti.

## 6. Reprodutseerimine (lugevad, kohalikud)

- **Tüvepaarid:** `node -e` + `morphologyText` (`lib/rag-v2/search/morphology.js`) paaridele §L5.
- **Sõnalise kanali järjestus:** sama SQL mis `PostgresCatalog.lexical()` MORPHOLOGY harus, VALUES-ridadega kohalikus `rag_v2_dev` andmebaasis (ei kirjuta).
- **Päris valim:** `retrieve()` tenant'il `batch-acceptance-20260923`, `method: 'lexical'`, profiiliga võrdsed piirid; vestlustekst `buildDialogueQuery()` abil.
- **Avaldamisvärav:** `createBatchReview()` ADR-011 partii peal → `blockers`.
- **KOV/XML loendused:** `Andmebaasi/KOV/**` ja `REGISTER.json` võtmete ning arvude loendus; `adaptMetadata()` iga KOV-kirje kohta; `inspectXmlMetadata()` 104 XML-akti kohta.
