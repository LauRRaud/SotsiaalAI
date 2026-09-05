# ADR-001: eraldatav, kohalik ja päritolu säilitav sissevõtt

Otsuse alus: M0 kontrollitud lähtepuu ja omaniku viidatud RAG/Graph v0.1 lähteülesande M1. See dokument kirjeldab tehnilist otsust; aktiivse töö seisu kannab SotsiaalAI.md.

## Valik

Kasutame olemasolevat Node/JavaScript ESM-i. `lib/rag-v2` impordib ainult oma mooduleid, Node'i standardteeki ja PDF.js-i; see ei impordi Next.js-i, autentimist, Prisma klienti, kasutajaliidest ega vana RAG-i helpereid. Seega saab tuuma hiljem tõsta eraldi protsessi ilma andmete normaliseerimist ümber kirjutamata.

PDF.js 5.4.296 on otsene, täpselt lukustatud sõltuvus. Varem oli sama versioon `pdf-parse` kaudu juba olemas. Otsekasutus annab tekstielemendid, fondisuurused ja koordinaadid, mida üldine leheteksti helper ei säilita piisava täpsusega. [Mozilla näited](https://mozilla.github.io/pdf.js/examples/) kirjeldavad leheobjekte, baidisisendit ja koordinaate. PDF.js 5.4.296 ja olemasoleva `pdf-parse` 2.4.5 litsents on kohalike pakettide `package.json` järgi Apache-2.0. Kohalikke AI-mudeleid, OCR-i ega pilveparserit ei lisata.

Parser töötab piiratud mälu ja ajaga eraldi Node'i lapsprotsessis. M2.1 korduskontroll leidis Windowsis `worker_threads` kasutamisel protsessi krahhi koodiga `3221225477`; protsessipiir parandas sama pärisfaili testi. Edu korral lastakse lapsprotsessil koristamine lõpetada; timeout lõpetab ainult selle töö lapsprotsessi. PDF-i skripte, linke ja manuste tegevusi ei käivitata. Suuruse piirang kehtib enne parsimist; lisaks piiratakse lehti ja eraldatud teksti mahtu. Normaliseeritud andmete ja allikakohtade leping sellest ei muutu.

M1 põhiregister on **privaatne kohalik failiadapter**, mitte uus tootmisandmebaas. See annab päris püsivuse, versioonide lugemise, kontrollsummad, sissevõtu vea- ja korduskäitumise ilma tootmismigratsioonita. M2 serveriadapteri siht on olemasolev PostgreSQL põhiregistri ja tüübistatud seoste jaoks ning Qdrant taasloodava vektorindeksi jaoks. Failiadapter ei pretendeeri mitme serveri transaktsioonide ega Qdranti atomaarse avaldamise lahenduseks.

Otsingu leksikaalse kanali kavandatud lähtevalik on PostgreSQL-i `simple` täistekstiindeks + rakenduses rank-põhine RRF koos Qdranti tulemustega. Seda ei nimetata BM25-ks. ET/EN/RU otsingukvaliteet, tokenizer'i tegelik käitumine ja mudelivalik võetakse vastu M2-s; neid M1 ei implementeeri ega mõõda.

## Andmete tähendus

- `SourceAsset`: muutmata PDF/JSON, SHA-256, baidimaht, MIME ja eksplitsiitne `local_private/development_only` kasutuspiir. Sisendpakett ei anna õigust materjali avaldada.
- `Document`: kliendi, allikaliigi ja artiklitasandi `document_id` põhine ID; `docId`, `articleId`, `source_id` ja `document_id` säilivad nimeliste väliste väljadena. Sama fail teise identiteediga annab ülevaatust nõudva konflikti.
- `DocumentVersion`: identiteet + PDF-i ja JSON-i baidid + kogu töötluskonfiguratsioon + profiil + õigused. Sama töö kordus kasutab olemasolevat versiooni. Kontrollimismärke muutus loob metaandmete versiooni, kuid muutumatu tekst säilitab embedding-sisendi räsi.
- `SourceSpan`: 1-põhine PDF-leht, 0-põhine parseri indeks, UTF-16 vahemik rekonstrueeritud `pages[].raw_text`-is, PDF-koordinaadid ja PDF.js elemendiindeksid. `raw_text` on koordinaatide järgi järjestatud tekstielementide ühendus; algsed elemendid säilivad eraldi. See ei ole PDF-i binaarfaili baidivahemik.
- Lõiguplokid säilitavad tuvastatud pealkirjade, tavateksti, tsitaatide ja loendite eristuse. Neid tuvastatakse fondisuuruse/asukoha järgi; keeruline paigutus vajab eraldi tõendit. PDF-lehe vahetus võib katkestada lõiguploki, aga säilitab sama peatüki.
- `Chunk`: allikatekst ja puhastatud otsingutekst on eraldi. Pealkirja/peatükitee prefiks on märgitud tuletatud osaks; lõikude vahel säilivad plokivahed. Vaikimisi piir on 2200 algteksti märki, mitte lubadus kindlast tokeniarvust. Ühte pikka PDF-tekstirida ei poolitata; tegelik embedding-tokeni piir tuleb jõustada M2 adapteris. Terve dokumendi piirkondi/sihtrühmi ei kopeerita igasse tekstiossa.
- `Relation`: M1 loob ainult `BELONGS_TO`, `PARENT_SECTION`, `NEXT_SPAN`; igal serval on versioon, tenant ja põhjendavad allikakohad. Need on parseri struktuursed seosed, mitte sisuline põhjuslikkus või teenuseõigus.
- `IngestReport`: väljade päritolu, eemaldatud marginaalide allikakohad, hoiatuste põhjused ja katvuse piirid. `KnowledgeCard` on valikuline ja M1-s tühi.

Tundmatu JSON-väli säilib `legacy_metadata` all; kanoonilisse skeemi seda automaatselt ei lisata. Tuntud välja sobimatu tüüp annab vea. Kuupäev, kirjeldatud periood, kehtivus, faili loomisaeg, imporditud kontrollimismärge ja tegelik import jäävad eraldi. `historical=true`, `source_status=active` ja `audience=BOTH` ei ole õiguste või tänase kehtivuse järeldused.

Näidisartikli puuduv bibliograafia ning kirjelduse ülevaatusvajadus tulevad PDF-räsiga seotud läbivaadatud auditi märkusest valdkonnaprofiilis. Neid ei järeldata üldise semantilise regex-kontrolliga ega kanta teistele failidele. Pealkirja/autori sõnaline vaste ja autor-aasta mustri leid on piiratud parserikontrollid, mitte väidete õigsuse tõendid.

## Kohalik avaldamisleping ja piirangud

Igal tenant'il on eraldi kataloog. Ainukirjutaja lukk väldib sama registri samaaegset muutmist. Kõik versiooni osad kirjutatakse staging-kausta, failide räsid pannakse manifesti ning tervik nimetatakse püsivaks versiooniks. Aktiivne manifest vahetub viimase sammuna ja sisaldab kogu lubatud aktiivsete dokumentide versioonikaarti. Lugeja peab alustama sellest manifestist; `versions/` loend ei tähenda avaldatud kogu.

Püsiva bundle'i `version.state=staged` kirjeldab muutmatu objekti valmimist. Tegeliku avaldamise autoriteet on `active.json` ja töö `published` lõppseis. See väldib näilist valmisolekut enne manifesti vahetust. `published` tähendab kohalikku kataloogi, mitte avalikku veebisaiti, töötavat otsingut ega semantilist heakskiitu.

Katkestus enne aktiivse manifesti vahetust jätab eelmise põlvkonna alles. Sama töö saab uuesti käivitada; valmis versioon kontrollitakse räsidega üle. Vigane register või vigased püsifailid ei muutu tühjaks edukaks koguks. Protsessi jõuga lõpetamisel võib jääda lukk või orvuks staging; taastamisjuhis on README-s. Elektrikatkestuse vastupidavust/fsync-i, võrgu-failisüsteemi ega mitme hosti kirjutust pole tõendatud. Tootmise jaoks tuleb kasutada sobivat andmebaasi/objektihoidla adapterit.

CLI ei ole administraatori HTTP-teenus. Hoidla ja sisendjuur peavad olema operaatori kontrollitud ning OS-i õigustega privaatsed, väljaspool avalikku veebijuurt. Failide samaaegne pahatahtlik asendamine operaatori enda sisendjuures ei ole selle lokaalse adapteri turvapiir. Enne platvormiga ühendamist on vaja serveripoolset autentimist, organisatsiooni/omandi/nõusoleku filtreid, kustutamise lepingut ja viiteavamise ACL-kontrolli.
