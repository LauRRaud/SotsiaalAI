# ADR-002: M2.1 kohalik hübriidotsing ja põlvkonna fikseerimine

Alus: omaniku `CODEX_M2_1_OTSING_v0_2` ülesanne ning ADR-001. See kirjeldab teostuse lepingut; tööseisu kannab ainult SotsiaalAI.md S1.0. M2.1 tehniline vastuvõtt ei ole M2.2 semantilise otsingukvaliteedi vastuvõtt.

## Teenused ja migratsioonid

Kasutame olemasolevat `pg` sõltuvust (lukufailis 8.22.0, MIT), `js-tiktoken` 1.0.21 (MIT) ja Node'i HTTP-klienti. Qdranti SDK-d ega teist leksikaalset otsinguteenust ei lisata. PostgreSQL 16.13 ja Qdrant 1.15.5 konteinerid on compose-failis nii versiooni kui SHA-256 digestiga lukustatud. PostgreSQL kasutab PostgreSQL License'i; Qdrant Apache-2.0 litsentsi. Qdranti versiooni alus: [ametlik väljalase](https://github.com/qdrant/qdrant/releases/tag/v1.15.5).

Compose-projekt `sotsiaalai-rag-v2` on eraldi platvormi olemasolevast PostgreSQL-ist. Ainult hosti `127.0.0.1:55432` ja `127.0.0.1:56333` pordid avaldatakse; Qdrant nõuab genereeritud teenusevõtit, telemeetria on väljas. Ühendusfailid ja paroolid jäävad ignoreeritud `tmp/rag-v2-services/` alla. Adapterid keelduvad muudest hostidest, portidest või PostgreSQL-i andmebaasinimest. Tarkvara allalaadimine Dockerist on eraldi seadistussamm; mudeliteenuste ühendust ei ole.

Migratsioonide omanik on endiselt **Prisma**. `prisma/rag-v2/prisma.config.mjs` ja selle migratsioonikataloog sihivad ainult eraldatud `rag_v2_dev` andmebaasi; platvormi `prisma/schema.prisma`, migratsioonikett ja `DATABASE_URL` jäävad puutumata. Kohaliku SQL-migratsiooni genereeritud `tsvector`, liitvälisvõtmed ja kontrollpiirangud on migratsioonis selgelt kirjas; neid ei muudeta `db push` abil. Arenduse liitmine tootmise Prisma mudelite/migratsioonidega nõuab hiljem oma plokki, mitte selle kohaliku konfiguratsiooni suunamist tootmisandmebaasi.

## Põhiregister ja muutumatud allikad

PostgreSQL säilitab dokumendi identiteedi, muutmatu M1 bundle'i ja räsi, algfailide privaatsed asukohad/räsid ning eraldi objektiregistri: varad, versioon, lehed bundle'is, allikakohad, lõiguplokid, peatükid, tekstiosad ja seosed. Tenant on kõigi võtmete osa. Seoste otspunktide liitvälisvõtmed nõuavad sama tenant'i ja versiooni. Tekstiosa ning indeksiüksus on seotud põlvkonna konkreetse dokumendiversiooniga.

Kordusimport kontrollib väärtuste võrdsust. Olemasolevat versiooni ei kirjutata üle; erinev sisu sama ID all on viga. Päring kontrollib bundle'i räsi, päritoluvälju, objektide võrdsust ning indeksiüksuste seost algtekstiga. Puuduv või rikutud aktiivkirje annab vea. Algfailid jäävad M1 privaatsesse failihoidlasse; Qdrant sisaldab vektoreid ja filtreerimiseks vajalikke ID-sid, mitte ainsat tekstikoopiat.

## Tokeniseerimine ja testvektorid

`js-tiktoken` kohalik `cl100k_base` kodeering on kontrollitud teegi `text-embedding-3-large` mudelivastenduse, teadaolevate tokeni-ID-de, ET/EN/RU teksti, eritokeni tekstina käsitlemise ja mitme UTF-16 üksusega sümbolite edasi-tagasi teisendusega. Võrgust sõnavara ei laadita. [OpenAI embedding-liides](https://developers.openai.com/api/reference/resources/embeddings/methods/create) kirjeldab 8192-tokenilist sisendipiiri; meie konservatiivne eelkontroll lubab kuni **8191 tokenit** kogu tegelikule embedding-sisendile, kaasa arvatud pealkiri/peatükiprefiks.

Ülepikk või vigase UTF-16-ga tekst annab `embedding_input_too_long` / `invalid_embedding_input`. M2.1 ei poolita ega kärbi juba väljastatud M1 allikakohti; liiga pikk üksus peatab uue põlvkonna ettevalmistuse. Päringu ja dokumendi sisendile kehtib sama tokeniseerija leping.

M2.1 adapter on `local-mock / mock-sha256-v1`, 32 mõõdet, cosine-kaugus. Vektorid tulevad deterministlikult sisendi ja konfiguratsiooni räsist; neil **ei ole semantilise mudeli tähendust**. Mõõtmed, mudel, provider, kaugus, tokeniseerija ja sisendikoostamise versioon moodustavad konfiguratsiooni identiteedi. M2.1 keeldub `embedding_mode=real` seadistusest. Päris API-võti keskkonnas ei lülita mudelikutseid sisse.

Vahemälu võti sisaldab tenant'i, lubatud kasutusulatust, kogu embedding-konfiguratsiooni ja täisteksti räsi. Metadata muutmine säilitab muutumatu teksti vektori, kuid loob uued versiooni-/filtriseosed. Mudeli, mõõtmete, sisendikoostamise või teksti muutus ei kasuta vana vektorit. Vahemälu ei ole klientide vahel jagatud. Vigane dimensioon, NaN/Infinity ja nullvektor lükatakse tagasi.

## Avaldamine ja võistlused

1. Failiadapteri `active.json` fikseerib lubatud dokumentide versioonipildi; `versions/` loendit ei kasutata kogu määramiseks. Kontrollitakse manifestide, bundle'ite ja algfailide räsiseoseid.
2. PostgreSQL-is luuakse deterministliku ID-ga `staged` indeksipõlvkond, mis sisaldab allikapilti, töötlus-/embedding-/leksikaalset konfiguratsiooni, Qdranti kollektsiooni ja eeldatud üksuste arvu. Esmane registreerimine saab andmebaasijärjekorranumbri.
3. Ühes PostgreSQL-i tehingus salvestatakse allikad, objektid ja leksikaalsed üksused. Qdranti jaoks kasutatakse selle tenant'i ja põlvkonna eraldi `ragv2_mock_*` kollektsiooni.
4. Kontrollitakse PostgreSQL-i üksuste täielikku ID/sisu võrdsust ning Qdranti kõiki punkte, ID-sid, payload'i scope'i, konfiguratsiooni, vektori kuju ja täpset arvu. Mõlemas kanalis tehakse päringu teostatavuse kontroll.
5. Aktiveerimine lukustab tenant'i head-kirje PostgreSQL-is. Aktiveerida saab ainult viimati registreeritud töö järjekorranumbri; vanem töö või vana põlvkonna hiline kordus ei saa uuemat pointer'it üle kirjutada. Alles seejärel muutub põlvkond `ready` ja head viitab talle.

Katkestus jätab vana aktiivse põlvkonna alles. Sama poolelioleva põlvkonna taaskäivitamine on idempotentne; olemasolevad vektorid võivad tulla vahemälust. Vanema töö `superseded_index_job` tähendab teadlikult lubamata aktivatsiooni, mitte õigust uut pointer'it lähtestada. PostgreSQL-i ja Qdranti vahel ei eeldata hajustransaktsiooni.

Päring loeb alguses ühe aktiivse põlvkonna ja kasutab seda mõlemas kanalis ning allikate lahendamisel. Vahepealne aktiveerimine ei vaheta selle päringu dokumente. Vanu põlvkondi ega vektoreid indekseerimine automaatselt ei kustuta. Tootmise versioonihoidla puhastus ja täielik kustutuste elutsükkel ei kuulu M2.1-sse.

## Õigused, päring ja järjestus

Usaldatud kohalik kontekst sisaldab `tenant`, `subject`, `usage=development_only`. `FilePolicy` loeb operaatori hallatud lubatud dokumendi-ID-de faili; testides on sama lepinguga muudetav `LocalPolicy`. Puuduv tenant või puuduv poliitikakanne on viga. Need ei ole platvormi HTTP-autentimise asendajad.

Tenant, fikseeritud põlvkond ja lubatud dokumendid piiravad mõlemat kanalit enne järjestamist. Qdranti [payload-filtrid](https://qdrant.tech/documentation/search/filtering/) kasutavad lisaks konfiguratsiooni ja mock-märget. Vastuse eel loetakse **praegune** poliitika uuesti: vahepeal keelatud teksti, allikaid ja korpuseviiteid paketis ei tagastata. Poliitika muutuse korral jäetakse varasema kandidaatide loenduse diagnostika välja.

PostgreSQL kasutab `pg_catalog.simple`: pealkiri/autor on kaaluga A, algtekst B ja pärandkirjeldus/sildid D. `plainto_tsquery` teeb parameetrilisest tekstist lexeme'id; nende AND-ühendused teisendatakse deterministlikult OR-ühendusteks. Nii saab ka mitmesõnaline küsimus osalisi vasteid. See ei tõlgi ega lemmatiseeri. [PostgreSQL simple-sõnastik](https://www.postgresql.org/docs/16/textsearch-dictionaries.html#TEXTSEARCH-SIMPLE-DICTIONARY) muudab sõnu väiketähtedeks; päris `ts_debug`, `tsvector` ja tsquery ET/EN/RU näited salvestati privaatsesse väljundisse.

Päringukeel ei ole allikakeele filter. Piirkonnata päring ei vali vaikimisi KOV-i. Täpne piirkonnafilter nõuab normaliseeritud, päritoluga `regions` väärtust; M1 näidisel see puudub. Avaldamisaja filter nõuab teadaolevat `publication_date` väärtust. `valid_at` nõuab mõlemat teadaolevat kehtivuspiiri; teadmata ei tähenda kehtivat. Tühi tekst ei tee embedding- ega teenuseotsingut ning annab `empty`.

Kanalid käivitatakse paralleelselt. RRF skoor on `sum(1/(60+rank))`, mitte toorskooride summa ega tõenäosus. Üksuse duplikaat eemaldatakse samas kanalis ja kanalite vahel; viigimurdja on ID kasvav järjestus. PostgreSQL-i viigid kasutavad C-kollatsiooni, Qdranti tagastatud võrdse skooriga read järjestatakse ID järgi. Qdranti cutoff'i juures võrdse skooriga kandidaatide valik ise sõltub Qdranti vastusest; korduskatse globaalset viigikomplekti ei laiendata piiramata.

Vaikimisi on kuni 40 kandidaati kanalis, 5 seemet, kuni 3 üksust dokumendist ja 6000 tokenit konteksti. Eelarve loeb tagastatavate `evidence` kirjete tegeliku JSON-esituse tokenid, sh teksti, tuletatud otsinguabi ja viitetunnused; paketi üldine diagnostika ei kuulu sellesse kontekstieelarvesse. Sama teksti koopiad samas dokumendiversioonis/õigustes eemaldatakse. Erineva dokumendi või õigustega tekste ei sulatata üheks viiteks.

Struktuurne laiendus on vaikimisi väljas. Sisselülitamisel kasutatakse M1 `BELONGS_TO`, `PARENT_SECTION` ja `NEXT_SPAN` servu naaberüksuse põhjendamiseks. Vaikimisi lubatakse kuni 8 sammu ja 2 lisatud üksust sama üldise dokumendi- ja tokenipiiri sees; lisamise põhjus ja serva-ID-d on paketis. `REQUIRES`, `EXCEPTION_TO` ega semantilist sõltuvussulundit ei lisata.

## Tõenduspakett ja tõrge

`ok`, `empty`, `degraded`, `error` on eraldi. Qdranti transpordi/teenuse tõrke korral on vaikimisi lubatud sama põlvkonna leksikaalne `degraded` varurada. Vale vektorruum, lubamatu ID, päritolu- või scope'i rikkumine ei käivita varurada. PostgreSQL-i tõrge on viga. Paketis puudub loomulikus keeles genereeritud vastus.

Allikatekst lahendatakse PostgreSQL-i kontrollitud dokumendiversioonist ja M1 allikakohtadest. Pealkirjaprefiks ning `legacy_description` paiknevad eraldi `search_aids` all; need ei muutu tsitaadiks. M1 kvaliteedihoiatused jäävad alles. Failide absoluutseid privaatseid asukohti ei esitata URL-idena. HTML-eksport põgeneb teksti ning ei sisalda käivitatavat allikasisu.

Etappide kestused ja kandidaatide/konteksti mahud mõõdetakse päris päringust. CLI lisab Node'i, operatsioonisüsteemi ja teenuste versioonid ning `measured_query_runs=1`. See ei ole p95 ega koormustest. Ühiktestide võrk on keelatud; integratsioonitestid lubavad ainult määratud kohalikke PostgreSQL-i/Qdranti sihtkohti.

M2.2 küsimused ja eelarveplaan on ettevalmistus: pärisartikli allikakohad määrati algteksti ja sisendauditi järgi, sünteetiline aianduskorpus jääb mehaanikatestidesse, vastuseta päring ei nõua vektorotsingult null kandidaati. Päris embedding-mudeli katse nõuab eraldi materjaliloa ning kulupiiri kinnitamist. M2.1 ei sisalda välisembedding'u ega Luna käivitajat.
