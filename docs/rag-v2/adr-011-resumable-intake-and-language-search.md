# ADR-011: jätkatav kohalik vastuvõtt ja keeleteadlik tekstotsing

Kuupäev: 23.09.2026. Teostuse baas: `00fb25ac0`; muudatused kohalikus main-tööpuus.
See on tehniline otsus ja kontrollitõend. Aktiivne teemaseis asub SotsiaalAI.md S1.0/S2-s.

## Tulemus ja piir

Teostatud on PostgreSQL-is püsiv vastuvõtupartii, katkestusest jätkamine,
muutumatute väljundite kontroll ning uus ET/EN/RU sõnatüvesid kasutav tekstotsingu
indeks. Olemasolevale vastusekutsesse lisati olukorra mõistmise üldjuhised.
Eraldi AI-planeerijat, küsimuse ümberkirjutajat ega käsitsi sõnavormide loendeid ei lisatud.

See ei ole veel kogu omaniku soovitud assistendi vastuvõtt. Pärismudeli vastamise,
keelteülese tähendusotsingu, kasutajafaktide ja teenusetingimuste sidumise,
kontaktide ajakohasuse ning perioodide sünteesi tervik on `NOT_PROVEN` või tegemata.
Admini käsitsi käivitatavat RAG-enesetesti ei muudetud. Tootmist ei muudetud.

## Vastuvõtupartii

`planIngestBatch` külmutab täpse metaandme-JSON-i, algfaili SHA-256, dokumendi,
profiili, piirid ja kohaliku kasutusõiguse. Canonical JSON väldib objektivõtmete
järjekorra muutumisest või PostgreSQL JSONB-st tekkivat uut versiooni. Valiku
järjekord ei muuda partii identiteeti. Ühes partiis ei või sama dokumendi jaoks
olla kaht sisendit; sama algfaili eri JSON-kirjed peavad olema lahus.

`rag_v2_ingest_batch` ja `rag_v2_ingest_item` asuvad eraldi kohalikus RAG-andmebaasis.
Tööseisud: `queued`, `processing`, `prepared`, `needs_review`. Reserveerimine kasutab
`FOR UPDATE SKIP LOCKED`, tähtajalist tööõigust ja kordumatut tokenit. Aegunud
töötegija ei saa uuema töö tulemust kinnitada. Kolm katkestatud katset lõpetavad
automaatse jätkamise. Parsimise/sisendi viga jätab konkreetse allika läbivaatusele;
teised allikad saavad jätkata. Tasulisi samme selles järjekorras ei ole.

`prepareIngest` salvestab tervikliku muutumatu versiooni, kuid ei muuda `active.json`-i
ega otsinguindeksit. Ta ei vaja aktiivse kataloogi `writer.lock`-i. Pärast väljundi
salvestamist ja enne järjekorra kinnitust katkenud töö kasutab kontrollitud versiooni
uuesti. Poolikut staging-kausta ei kasutata. Üheaegne sama versiooni ettevalmistamine
jätab alles ühe räsidega kontrollitud versiooni. Vana ühe dokumendi `ingest` API
säilitab oma avaldamiskäitumise.

Esimene töötleja seob partii konkreetse kohaliku hoidla tegeliku teega. Jätkamine
teise hoidla vastu ei tohi näidata valmimist ilma sealsete failideta. `verify`
kontrollib uuesti kõiki salvestatud faile, metaandmete ja algallika räsi ning
mahutulemuse vastavust. Järjekorra `prepared` seis üksi ei ole failide tervikluse,
allika sisulise õigsuse, värskuse ega avaldamisvalmiduse tõend.

Hoiatused säilivad tulemuses. Bibliograafia kandidaadi konflikt ei kao tehnilise
ettevalmistuse järel; allpool kirjeldatud avaldamisrada jätab selle parandamist ootama.
`needs_review` kirjeid ei lähtestata automaatselt. Parandatud lähteandmed loovad uue
plaani; sama sisendi käsitsi uuesti lubamise auditeeritud haldusliides on tegemata.
Vaikimisi tööõiguse aeg on 120 s; seda saab anda kuni 3600 s. Automaatset pikendamist
pole. Pooleli staging-kaustade turvaline koristamine pärast päris protsessikrahhi on
samuti eraldi hooldustöö.

### Kasutamine

Valikufail on massiiv, näiteks:

```json
[
  { "source": "KOV/anija-vald/anija-vald.json", "item": "anija_vald_service_koduteenus" }
]
```

Kohalikud käsud (isoleeritud testtenant ja privaatne väljund):

```powershell
node scripts/rag-v2-local.mjs migrate
node scripts/rag-v2-ingest-batch.mjs --mode plan --registry Andmebaasi/REGISTER.json --selection tmp/selection.json --tenant LOCAL_TEST --manifest tmp/batch/manifest.json --development-only
node scripts/rag-v2-ingest-batch.mjs --mode run --manifest tmp/batch/manifest.json --input-root Andmebaasi --store tmp/batch/store --max-items 2 --development-only
node scripts/rag-v2-ingest-batch.mjs --mode run --manifest tmp/batch/manifest.json --input-root Andmebaasi --store tmp/batch/store --development-only
node scripts/rag-v2-ingest-batch.mjs --mode verify --manifest tmp/batch/manifest.json --store tmp/batch/store --development-only
```

`enqueue` registreerib töö ilma parsimiseta; `status` näitab salvestatud seisu.
Väljumiskood 2 tähendab läbivaatust vajavat sisendit, 1 käsu või kontrolli viga.
`--max-items` piirab ühe käivituse tööd; selle piirini jõudmine võib jätta partii
korrektselt pooleli. Planeerimine ega vastuvõtt ei aktiveeri korpust.

## Partii ülevaatus ja avaldamine — 23.09 jätkuplokk

`ingest-publication.js` ühendab ettevalmistatud allikad olemasoleva kohaliku
kataloogi ja otsingu sisendiga. Uut andmebaasiskeemi ega mudelikutseid ei lisandu.
See on kohaliku operaatori API/CLI; admini veebiliidesega ühendamine jääb eraldi tööks.

`createBatchReview` koostab ülevaatusfaili pärast partii ettevalmistuse lõppemist.
`needs_review` veaga allika võib põhjendusega välja jätta ja ülejäänud avaldada.
Veel töötav või järjekorras allikas takistab ülevaatuse koostamist, et otsus ei
muutuks töötleja lõpetamise järel märkamatult vanaks. Fail sisaldab iga allika
välju koos päritoluga, hoiatusi, blokeerivaid vastuolusid, versiooni ja paketi räsi
ning teed kohalikule HTML-aruandele. Aluseks oleva kataloogipõlvkonna ja tõendi
räsi seob otsuse konkreetse seisu külge.

Operaator täidab `reviewed_by` ning iga kirje `decision` (`include` või `exclude`)
ja `note`. Väljajätmine ja hoiatusega allika kaasamine nõuavad põhjendust.
Metaandmete konflikti või ettevalmistamata allikat ei saa märkusega heaks kiita:
allikas tuleb sellest avaldamisest välja jätta või sisend parandada ja koostada
uus partii. Ülejäänud failivälju ei muudeta. Hoiatuse kustutamine või välja
väärtuse muutmine ei paranda algandmeid ning avaldamine lükatakse tagasi.
`reviewed_by` on kohaliku operaatori märge, mitte autentimistõend.

`publishReviewedBatch` kontrollib uuesti faili terviklust, algallika ja metaandmete
räsi, töötlemisseadistust, profiili ning õigusi. Ta kasutab sama kirjutuslukku
nagu olemasolev `ingest`. Kõik kaasatud dokumendid jõuavad korraga ühte uude
`active.json` põlvkonda; teiste dokumentide senised versioonid säilivad.
`exclude` tähendab selle partii versiooni väljajätmist, mitte varasema avaldatud
versiooni kustutamist ega ligipääsu tühistamist. Kogu lõppvalikus kontrollitakse
algallika topeltidentiteete ja kattuvaid JSON-kirjeid; eraldiseisvad JSON-kirjed
samast paketist on lubatud.

Enne kataloogi vahetamist salvestatakse `publications/` alla muutumatu otsuse,
vana kataloogi ja sihtkataloogi kirje. Sama otsuse kordamine enne vahetust jätkab
avaldamist ning pärast vahetust tagastab `reused: true`. Uuema põlvkonna järel
vana otsus ebaõnnestub ega keera uut seisu tagasi. Vigast salvestatud otsusekirjet
ei asendata uuega. Katkestuskontrollid katavad vead enne ja pärast kataloogi
vahetust ning jätkamise uue andmebaasiühendusega. Päris protsessi sundlõpetamisel
võib olemasolev `writer.lock` alles jääda: automaatset surnud protsessi luku
eemaldamist ega elektrikatkestuse taluvust selles plokis ei teostatud.

Kasutamine pärast `run` lõppu:

```powershell
node scripts/rag-v2-ingest-batch.mjs --mode review --manifest tmp/batch/manifest.json --store tmp/batch/store --review tmp/batch/review.json --development-only
# Vaata üle allikaaruanded ja täida review.json otsused, põhjendused ning reviewed_by.
node scripts/rag-v2-ingest-batch.mjs --mode publish --manifest tmp/batch/manifest.json --store tmp/batch/store --review tmp/batch/review.json --development-only
```

Avaldamine tagastab kataloogipõlvkonna ja avaldamiskirje tunnuse. Otsinguindeksi
aktiveerimine jääb olemasolevasse `indexSnapshot` rajasse; vastuses on seetõttu
`search_index: not_run`. Järjekorra `status` ja ettevalmistuse `verify` annavad
`publication: not_checked`, sest need ei kontrolli aktiivset kataloogi.
Kohaliku avaldamise edu ei tähenda tootmispaigaldust ega andmete sisulise värskuse kinnitamist.

### Jätkuploki tõend

`TZ=UTC` all läbisid 41 sihttesti: 12 uut avaldamise integratsioonitesti,
11 olemasolevat partii testi ja 18 allikastruktuuri testi. Uued kontrollid katavad
katkestusest jätkamise, vana põlvkonna ja luku konflikti, muudetud tõendi ja
algfaili, vigase avaldamiskirje, kliendi/hoidla eraldatuse, osalise väljajätmise,
JSON-kirjete kattuvuse ning CLI ülevaatuse ja korduva avaldamise.

Eraldatud sünteetiliste allikatega läbiti päris kohalik PostgreSQL/Qdranti rada:
partii avaldamine → `loadSnapshot` → olemasolev indekseerija testvektoritega →
eestikeelse käändevormi tekstotsing. Tulemus säilitas algallika asukohad ja
lugemisõiguste piiri. Väliseid mudelikutseid 0; testvektorid ei tõenda
keelteülest semantilist kvaliteeti. Muudetud failide ESLint ja `git diff --check`
läbisid. Skeemi, veebiliidest, serveriseadistust ega tootmist ei muudetud;
build ja brauserikontroll ei olnud selle muudatuse kontrollpind.

## Keeleotsingu otsus

Uus indeksileping on `pg-snowball311-et-en-ru-v1` ja vestluse päringuprofiil
`hybrid-multilingual-dependencies-v1`. Indekseerimine arvutab lokaalselt
Snowball 3.1.1 sõnatüved, päring saab sama töötluse. PostgreSQL säilitab algkujul
otsingu eraldi; tuletatud vasted lisavad väiksema kaaluga skoori (0,35).
See kaal on esialgne tehniline valik, mitte semantiliselt optimeeritud tulemus.
Nimed ja täpsed väärtused jäävad algkujul kanalisse. Algallika tekst, embedding'u
sisend ja kanoonilised viited ei muutu. Tüved on ainult otsinguabi.

Snowballi neli vajalikku JavaScripti faili pärinevad ametlikust 3.1.1 arhiivist;
algkoodi ei kohandatud. Päritolu, arhiivi räsi ja BSD-litsents asuvad
`lib/rag-v2/vendor/snowball-3.1.1/` all. Uut käitavat teenust ega tasulist API-t
keeletöötlus ei vaja. Algoritm ei taga kõigi eesti käänete ühendamist ega tõlgi.
Teadaolev kontrollitud puudujääk: `lapsed` / `lastele` ei ühti. Tähendusotsingu
panust peab hindama päris mitmekeelsete vektoritega, mitte testvektoritega.

Vana leksikaalne leping ja ajaloolised profiilid säilitavad oma identiteedi.
Uue lepingu jaoks luuakse uus indeksi põlvkond; vana indeks ei muutu vaikimisi.
Uut profiili ei lubata vana indeksiga. Olemasolevate vektorite andmed saab uuesti
importida: indekseerija pärisvektorite rada loeb salvestatud vektoreid ja ei kutsu
embedding'u teenust. Erineva leksikaalse seadistuse lokaalne vahemälunimeruum on
eraldatud, sest ajalooline vahemälukirje seob kogu otsinguseadistuse identiteeti.

`scripts/rag-v2-search.mjs` ja pärisvektorite piloot toetavad
`--lexical pg-snowball311-et-en-ru-v1`; esimene on jätkuvalt testvektorite CLI.
Puhta tekstotsingu kontrolliks saab kasutada `--method lexical`.
Kogu lubatud korpuse lugemise senine päringukulu ja 5000 tekstiosa indeksipiir
on alles. See muudatus ei tõenda tuhandete artiklite koormustaluvust.

## Olukorra mõistmine ja mudelikulu

Vastuse üldjuhis versiooniti `m4-grounded-answer-9` ja vestluslaiendus
`m4-grounded-dialogue-3`. Varasemad versioonid jäävad ajalooliste vastuste lugemiseks
lubatuks. Uued päriskutsed nõuavad uut kooskõlalist teostusmanifesti ja plaani.

Juhis eristab kasutaja öeldut, võimalikke vajadusi ja teadmata asjaolusid; küsib
korraga kuni kaks vajalikku täpsustust; seob kohaliku abivõimaluse tõendatud tingimuse,
piirkonna, ajakohasuse ja järgmise sammuga. Sisuline õnnestumine ei ole juhise
olemasoluga tõendatud. Sama olemasolev üks vastusekutse täidab seda ülesannet.

Püsiv teenuserada lubab ühe embedding'u ja ühe vastuse etapi pöörde kohta.
Vahemälutabamus jätab embedding'u ära; sama tegevuse kordussaatmine taastab varem
salvestatu. Teadmata tulemusega väliskutset ega tagasilükatud vastust automaatselt
uuesti ei genereerita. Jätkuvestlus ei tunne veel automaatselt ära kõiki pöördeid,
mille jaoks otsingu saaks turvaliselt vahele jätta. Kaheksa pöörde praegune
vestlusulatus ja muud piloodipiirid säilivad.

## Kontrollitõend

- Uued partii sihttestid: 5 ühiktesti ja 6 päris kohaliku PostgreSQL-i testi PASS.
  Katavad korduvregistreerimist, kaht töötlejat, aegunud tokenit, kolm katkemist,
  allika muutumist, pärast püsivat väljundit kadunud kinnitust, hoidla vahetust,
  tenant'i piiri, rikutud faile ja SQL-seisu piiranguid.
- Keeletöötlus: 3 ühiktesti ja 1 päris PostgreSQL/Qdranti katse PASS. Vana indeks
  ei leia `koduteenust`, uus leiab vastava kanoonilise `Koduteenus` allika. ET/EN/RU
  sõnavormide piiratud kontroll, täpsete allikakohtade säilimine, lubatud dokumentide
  piir, korduv indekseerimine ja rikutud tüveväljade tõrjumine on kaetud.
- Olemasolevad konteksti, vastuselepingu, konfiguratsiooni ja nelja vormingu kontrollid
  läbisid (40 PASS; tolle jooksu 14 sisendist sõltuvat pärisartiklitesti jäid vahele).
  Eraldi päris isoleeritud vestlusandmebaasi 38 testi PASS, mudelite transport sünteetiline.
  Need kinnitavad ka kutsete arvu, vahemälu, püsivat eelarvet ja kordussaatmise piiri.
- Laiem artikli/otsingu jooks: 36/39 PASS ajaloolise metaandme sisendiga. Kolm vana
  eeldust ei klapi: fikseeritud metaandme SHA-256, avaldamisaja filter ja 12420 tokeni
  asemel 12429. Kõik kolm kordusid HEAD-i `ingestion.js`/`catalog.js` koopiatega.
  See on piiratud baasivõrdlus, mitte kogu repo vanale commit'ile tagasipööramine.
  Algallikaid ega vanu oodatud väärtusi ei kirjutatud rohelise testi saamiseks ümber.
  Tee kontrolli tõrkejärjekord parandati: juurkaustast väljuv tee lükatakse tagasi enne vormingut.
- Sihtlint: 0 viga; muutmata Snowballi genereeritud klassidel 3 upstream-stiilihoiatust.
  Prisma valideerimine ja mõlema uue migratsiooni rakendus kohalikus eraldi RAG-andmebaasis PASS.
  `git diff --check` PASS. Brauseri tootmisrada ja uus pärismudeli vastus: `NOT_PROVEN`.

### Päris kohalike allikate partii

Valim: 2016. aasta ajakirja PDF, 2026. aasta ajakirja HTML, õigusakti XML ning
Anija paketi koduteenus, erakorraline toetus ja kontaktikirje. Materjal on kohalik
kogutud allikas, mitte värskelt kontrollitud veebiteave.

Partii `ingest_batch_7386c3ebb0bc108471aa71223a920b1e35b3b9c570756a9e8d0d11a3d58ad573`:
esimese käivituse järel 2 valmis / 4 ootel; uue protsessi järel 6 valmis / 0 ootel,
kõigil üks katse. `verify` kontrollis 6 versiooni, 73 tekstiosa ja 28405
embedding'u sisendtokenit. Teadmiskandidaate ega pärisvektoreid ei koostatud.

Seejärel avaldati valim ainult isoleeritud kohalikus `batch-acceptance-20260923`
tenant'is ja indekseeriti testvektoritega. Kolm leksikaalset päringut
`koduteenust`, `erakorralist toetust`, `kuuluvustunne` leidsid allikad ning säilitasid
täpsed allikakohad. Päringud ei kasutanud testvektoreid, embedding'u teenust ega
vestlusmudelit. Indeksis on 0 semantilist teadmiskirjet ja 0 semantilist sõltuvust;
see jooks ei tõenda sisulise graafi ega keelteülese otsingu õigsust.

Korratavad kohalikud failid: `tmp/rag-v2-batch-acceptance/selection.json`,
`manifest.json`, `first-status.json`, `status.json`, `exercise.mjs`, `local-evidence.json`.
Räsiga koondtõend säilitatakse selle ADR-i kõrval JSON-is.

## Kontrollide ulatus

Omaniku 23.09 täpsustusega eemaldati tasulise mudelitestiringi ettepanek nõuetest.
Arendus jätkub kohalike sihttestide, testadapterite ja olemasolevate tõenditega;
tasuline hindamisring ei ole järgmise tööploki eeltingimus. Need kontrollid tõendavad
tehnilist käitumist oma ulatuses, mitte pärismudeli keele- ja olukorramõistmise kvaliteeti.
Kontrollimata sisuline kvaliteet jääb kirjeldatud piiranguks. Järgmine teostustöö
lähtub `SotsiaalAI.md` aktiivsest arendusjärjestusest.
