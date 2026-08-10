# Parandusaudit — SOL-süvaauditi seis

**Tuletatud loend. Olekut kannab `sotsiaalai-sol-suvaaudit.md` ise** (Seis-lõik iga leiu all);
see fail on ainult ülevaade ja ta ei ole allikas. Numbrid on **loetud raportist**, mitte
käsitsi kokku pandud: loendatakse `### SOL-XXX-NN — … — Pn` pealkirju ja nende all olevaid
`**Seis (…): DONE…` lõike. Mõõdetud **11.08.2026**.

## Kokkuvõte

| | |
|---|---|
| Tehtud leidu | **71 / 357** |
| Peatükke lõpuni | **5 / 35** — SOL-SCHEMA, SOL-BUILD, SOL-RAGADMIN, SOL-ORG, **SOL-FIELD** |
| Lahtised prioriteedi järgi | **P0-sid EI OLE** · 209 × P1 · 76 × P2 · 1 × P3 |
| Toodangus | **kümnes deploy 10.08 23:34 omaniku selgel loal: server = `44144aba`**, viis commit'i (SOL-FIELD-04, -05 ja -06 + kaks docs-commit'i), migratsioone ei olnud. Mõõdetud, mitte eeldatud: `.next` 23:34, kolm teenust `active`, `/` `/vestlus` `/valitoo` `/admin/rag` **200**, veatasemel logi tühi kõigis kolmes teenuses. (Üheksas deploy 22:49 = `a2aa7435`.) |
| Järgmine peatükk (dokumendi järjekord; P0-sid enam ei ole) | **SOL-DOC on käsil** (1/9). Kõige eespool lahtine on endiselt **SOL-AUTH** (13 lahtist) |
| Käsil oleva peatüki saba | SOL-NET 11 lahtist (9 × P1, 2 × P2) · SOL-PRE 16 · SOL-JOUR 15 · SOL-RAGSVC 26 · SOL-SLOG 19 · SOL-URG 11 · SOL-CALL 3 |
| Esimene lahtine peatükk puhtas dokumendi järjekorras | SOL-AUTH (13 lahtist: 8 × P1, 5 × P2) — ootel, P0-sid ei ole |

**70 tehtud leidu 71-st on tootmises** (kümnes deploy 10.08 23:34, server `44144aba` —
FIELD-04, -05 ja -06 läksid välja, migratsioone ei olnud). Deploy'mata on ainult
**SOL-DOC-01**; ka tema ei vaja migratsiooni. Ainus P3 kogu auditis on SOL-SEARCH-i oma ja teda ei ole allpool eraldi veerus.

**Deploy-järgne kontroll tõi ühe asja välja:** `npm run rag:path:probe` — RAGSVC-01/02
HTTP-negatiivtest, mis oli teadlikult deploy'd ootamas — andis esimesel jooksul
`PROBE_FAIL 6/7`, **aga viga oli sondis, mitte serveris**. Kettalt mõõdetuna ei olnud ühtki
faili hoidlast väljas. Sondi otsustusreegel oli iseenesest tõene (`/rag-escape-probe/`
vastab vaenuliku faili enda nimele ka pärast korrektset puhastust). Parandatud: sond õpib
hoidla juure kontrollfailist ja küsib „kus fail on", mitte „kas nimi näeb kahtlane välja".
Teine jooks: **`PROBE_OK 8/8`**.

## Peatükid dokumendi järjekorras

| Peatükk | Kood | Tehtud | Lahtised P0 | P1 | P2 | Märkus |
|---|---|---|---|---|---|---|
| Skeemi ja Prisma mudeli vastavus | SOL-SCHEMA | **1/1** | – | – | – | **tehtud** |
| Build | SOL-BUILD | **1/1** | – | – | – | **tehtud** |
| Autentimine ja autoriseerimine | SOL-AUTH | 2/15 | – | 8 | 5 | 13 lahtist, P0-sid ei ole |
| Juhtumitöö (JTA-V1) | SOL-CW | 17/20 | – | 2 | 1 | kolm kvalifitseeritud seisu, vt allpool |
| RAG-i admin ja failihaldus | SOL-RAGADMIN | **4/4** | – | – | – | **tehtud** |
| Organisatsioonid ja skoop | SOL-ORG | **12/12** | – | – | – | **tehtud** |
| Välitöö | SOL-FIELD | **6/6** | – | – | – | **tehtud** |
| Dokumendid ja AI-kasutus | SOL-DOC | 1/9 | – | 5 | 3 | **käsil**, DOC-01 tehtud |
| Uuringud | SOL-RES | 0/7 | – | 6 | 1 | |
| Koosolekukokkuvõtted | SOL-MEET | 0/6 | – | 5 | 1 | |
| Vestlus | SOL-CHAT | 0/13 | – | 9 | 4 | |
| Hääl (STT/TTS) | SOL-VOICE | 0/3 | – | 2 | 1 | |
| Ruumid | SOL-ROOM | 0/7 | – | 5 | 2 | |
| Kõned ja salvestus | SOL-CALL | 10/13 | – | – | 3 | **käsil**, lahtised CALL-07, -08, -09 (kõik P2) |
| Kutsed ja sponsorlus | SOL-INV | 0/3 | – | 1 | 2 | |
| Maksed | SOL-PAY | 0/11 | – | 9 | 2 | |
| Teavitused | SOL-NOTIF | 0/7 | – | 3 | 4 | |
| Domeenisündmused | SOL-EVENT | 0/1 | – | – | 1 | |
| Kiireloomuline abi | SOL-URG | 2/13 | – | 11 | – | **käsil**, mõlemad P0-d tehtud |
| Tööheaolu | SOL-WB | 0/14 | – | 9 | 5 | |
| Teenuspäevik | SOL-SLOG | 5/24 | – | 18 | 1 | **P0-dest tühi**, SLOG-01/13/14/17/18 tehtud |
| RAG-teenus ja ingest | SOL-RAGSVC | 2/28 | – | 19 | 7 | suurim peatükk; **käsil**, mõlemad P0 tehtud |
| Migratsioonid | SOL-PRISMA | 0/4 | – | 3 | 1 | |
| Mentorlus | SOL-MENT | 0/7 | – | 7 | – | |
| Supervisioon | SOL-SUP | 0/15 | – | 11 | 4 | |
| Kovisioon | SOL-COV | 0/8 | – | 8 | – | |
| Tõenduspõhised praktikad | SOL-PRAC | 0/8 | – | 8 | – | |
| Teemaseemned | SOL-SEED | 0/5 | – | 3 | 2 | |
| Teekond ja jagamine | SOL-JOUR | 2/17 | – | 12 | 3 | **käsil**, mõlemad P0 tehtud |
| Eelpöördumised | SOL-PRE | 2/18 | – | 15 | 1 | **käsil**, mõlemad P0 tehtud |
| Abikuulutused | SOL-HELP | 0/13 | – | 11 | 2 | |
| Võrgustikutöö | SOL-NET | 2/13 | – | 9 | 2 | **käsil**, mõlemad P0 tehtud |
| Refleksioonid | SOL-REF | 0/9 | – | 3 | 6 | |
| Otsing | SOL-SEARCH | 0/7 | – | 1 | 5 | + 1 × P3 |
| Teenuseosutaja profiil | SOL-SPROF | 2/15 | – | 6 | 7 | auditi viimased kaks P0-d, mõlemad tehtud |

## Mis on tehtud

- **SOL-SCHEMA-01** · **SOL-BUILD-01**
- **SOL-AUTH-01, AUTH-02**
- **SOL-CW-01…CW-08, CW-10…CW-13, CW-15…CW-18, CW-20** (17 leidu)
- **SOL-RAGADMIN-01, -02, -03, -04** (peatükk lõpuni)
- **SOL-CALL-01, -02, -03** — igal kolmel on vastuvõtukriteeriumist osa katmata, vt leidude
  Seis-lõike.
- **SOL-CALL-04, -05** (10.08) — üks plokk: mõlemad ütlevad, et salvestuse alustamise rajal
  loetakse asju ÜHEKS, ilma et miski neid üheks hoiaks. CALL-04 sai katsepõhise failivõtme ja
  idempotentse korduse; CALL-05 sai unikaalse indeksi + jagatud `upsert`-tee ja on **ainus
  selle päeva parandus, mis on tõendatud päris PostgreSQL-is** (`npm run call:consent:probe` 8/8).
- **SOL-CALL-06** (10.08) — kustutus sai astmelise `DELETE_PENDING` seisu ja lõpetas
  `ok:true` vastamise kustutamata faili kohta. Parandust kirjutades tuli välja **teine,
  raportis kirjas mitte olnud leid**: karantiini pandud toorest egress-faili ei kustutanud
  keegi, sest ta saadeti dokumendisalvestuse teele, kus ta andis neelatud tee-vea. Sama
  neelamine oli teinud `discardActiveRecording()` `DELETED`/`QUARANTINED` valiku surnud
  koodiks. Ketast ennast tõendab ainult mock — vt Seis-lõigu NOT_PROVEN.
- **SOL-CALL-10** (10.08) — salvestis sai kolm piiri, kus enne oli null: voogedastav
  finaliseerimine (mälukulu ei sõltu enam salvestise pikkusest), kestuselagi koos serveri
  automaatse peatamisega ja kvoodireserv enne providerit. Kriteeriumi osa **„jõustada
  maksimaalne kestus provideris"** ei ole teostatav — LiveKit'i egress ei tunne sellist
  seadet — ja ta on Seis-lõigus nimeliselt asendatud serveripoolse valvega.
- **SOL-URG-01** (10.08) — laua järjekord võttis kõik pöördumised vanimast alates ja lõikas
  200 peal, seega ajaloos 200 vanema rea taha jäi iga uus abipalve **deterministlikult**
  nähtamatuks. Töö ja ajalugu on nüüd eri päringud, loendurid tulevad andmebaasist ja kärbe
  ütleb ennast välja. Sama parandus kattis ka `GET /api/urgent-requests?role=desk`, kus oli
  teine koopia samast valikureeglist.
- **SOL-URG-02 + SOL-PRE-01** (10.08) — **kaks P0-d eri peatükkidest, üks tehing.** Konto
  kustutus vastas `ok: true` töö kohta, mida ta ei teinud: kiire abi verbatim-tekst, nimi ja
  telefon jäid alles, saatmata eelpöördumiste mustandid samuti. Neid ei saanud eraldi
  parandada, sest konversioon kopeerib kiire abi teksti mustandisse — ainult ühe sulgemine
  oleks jätnud samad sõnad teise tabeli alla. **Omanikule jääb lahtiseks retentsiooni
  tähtaeg**, vt URG-02 Seis-lõiku.
- **SOL-SLOG-13 + SOL-SLOG-14** (10.08) — kaks P0-d, üks loend. `listShareRecipients()` ei
  ole ainult UI valik, vaid ka saatmise autoriseerimise alus, seega mõlemad andsid ÕIGUST
  kliendinimedega aruandele. SLOG-13: juhiseos lisas saaja ise, vastu mudeli enda invarianti
  („EI ANNA SISUÕIGUSI"). SLOG-14: kaks `OR`-i ühes objektis — teine kirjutas esimese üle ja
  `validUntil` kontroll kadus päris WHERE-st, seega aegunud luba töötas edasi. Kehtivus ja
  skoop on nüüd ühe `AND` harudena: struktuur ise välistab vea.
- **SOL-SLOG-01** (10.08) — seadme `localStorage` oli BRAUSERI oma, mitte konto oma: jagatud
  arvutis nägi järgmine töötaja eelmise kliendi nime ja märkust, ja võrgujärjekord saatis
  need kirjed UUE töötaja teenuskirjeteks. Read on nüüd omaniku ID järgi eraldatud ühe
  jagatud värava taga (`lib/serviceLog/deviceStore.js`), mis annab omanikuta **`null`** —
  identiteedita on seade lukus. Parandus on **tõendatud päris brauseris päris sessiooniga**
  ja tõi välja **kaks raportis kirjas mitte olnud leidu**: mustand kustus lehe avamisel
  (lipp oli viide ja jooksis taastatud väärtustest ette) ning üks ootel kirje läks teele
  kolme POST-iga (voo-lukk puudus). Mõlemad parandatud.
- **SOL-SLOG-17 + SOL-SLOG-18** (10.08) — **kaks P0-d, üks juur.** Külastus ei kandnud
  organisatsioonilist päritolu ja juhi tahvel tuletas skoobi INIMESE kaudu. Kahes majas
  töötaval inimesel on aga üks SOLO-profiil ja üks tööpäev, seega org A juht nägi org B
  klientide nimesid (-17) ja sai teadaoleva `visitId` abil org B töö oma töötajale ümber
  määrata (-18). Neid ei saanud eraldi parandada: mõlema kriteerium algab samast
  külmutatud väljast. `ServiceVisit.assignedOrganizationId` (migratsioon `20260810160000`)
  kirjutatakse seal, kus ta on tõendatud; `NULL` tähendab „mitte kellelegi", mitte
  „kõigile". Ümbermääramine annab võõrale päritolule **404** enne olekukontrolli, ja audit
  on nüüd `$transaction`-is, mitte `.catch(() => {})` taga. Tõendatud päris PostgreSQL-is
  (üks teekond, kaks maja + päritoluta rida; `EXPLAIN` = Index Scan).
- **SOL-RAGSVC-01 + SOL-RAGSVC-02** (10.08) — **kaks P0-d, üks viga:** kliendi tekst
  kasutati failiteena ilma tõendamata, et ta jääb hoidlasse. `-01` andis kirjutamise
  (`raw_path = d / file_name`, kus Pythoni `/` viskab absoluutse parema poole korral vasaku
  ära), `-02` lugemise (kliendi `source_path` → registri `path` → `FileResponse`). Uus
  `rag-service/storage_paths.py` on eraldi moodul, sest `main.py` sõltuvusi ei saa
  ühiktestis laadida — **piir, mida ei saa testida, ei ole piir**. `/ingest/text` salvestab
  nüüd allikateksti ise. Auditis nimetatud ühe lugemiskoha asemel leidsin **kuus**: sama
  registri `path` avatakse ka `reindex`-i kolmes harus, artiklite ingestis ja metaandmete
  uuenduses. **HTTP-negatiivtest on kirjutatud, aga teadlikult jooksmata** — enne deploy'd
  oleks ta ise rünnak päris serveri vastu; `npm run rag:path:probe` ootab deploy-järgset
  käivitust.
- **SOL-JOUR-01** (10.08) — eelpöördumise jagamisvalikuid oli KAKS ja ainult esimene juhtis
  teksti. Teine — see, mida kasutaja näeb vahetult enne adressaadi valikut — filtreeris
  ainult manifesti koopiat; `topic`, `situation` ja kirjamustand jäid esimese projektsiooni
  kujule. Linnuke läks maha, tekst läks adressaadile. Nüüd küsib iga muutus serverilt uue
  projektsiooni ja kõik püsivad väljad tulevad sellest ühest vastusest; kliendipoolne filter
  on kustutatud, mitte parandatud. Vana vaikehulk `personWish` ei kuulunud isegi serveri
  sõnavarasse. **Tõendatud lõpuni: salvestatud andmebaasireas eemaldatud võtme markerit EI
  OLE**, `confirmedKeys` vastab täpselt projektsioonile.
- **SOL-NET-01 + SOL-NET-02** (10.08) — **kaks P0-d, üks juur:** kogu `lib/network/share.js`
  kirjutas mustriga „loe rida → kontrolli mälus → kirjuta `where:{id}`", seega kinnitus
  viitas REALE, mitte tekstile. Parandus on kaks veergu (`contentHash`,
  `confirmedContentHash`, migratsioon `20260810180000`) ja üks primitiiv `commitOnce`, mida
  kasutavad kõik kuus kirjutavat rada. Saatmine nõuab rea tingimuslikult endale **enne**
  ruumi loomist ja teeb mõlemad ühes tehingus — vana järjekord jättis kaotanud saatmise
  järel orvu ruumi ja ruumitõrke järel `CONFIRMED` rea koos ruumiga. Kanooniline räsi-string
  on JS-is ja SQL-is sama; pariteet **mõõdetud**, mitte eeldatud. Sama klassi leid, mida
  raportis ei olnud: avamine-vs-tagasivõtmine, kus mõlemad lähtusid seisust `SENT`.
  Sond `npm run net:share:probe` **30/30 päris PostgreSQL-is**, deterministlike
  lukuvõistlustega mõlemas järjestuses; **vana käitumise vastu 14 passed / 16 failed**.
  Ühiktestide fake sai parandatud (tagastas lugemisel sama objektiviite — just see peitis
  selle veaklassi).
- **SOL-PRE-02** (10.08) — tagasivõetud pöördumise pakett oli organisatsioonile endiselt
  avatav ja uuesti määratav. Parandus on üks invariant kahes tükis: **sisu** peatab
  `projectSourcePackage()` (`recalledAt` → `null`, värav on ainsa ukse sees, mitte
  kutsujates) ja **töö** peatab `isTerminalInboxStatus()`, mis on **tuletatud
  seisumasinast**, mitte teine käsitsi hoitud loend. Kirjutavad rajad võtavad nüüd
  `FOR UPDATE` postkastikirje real **enne lugemist** — seisukontroll üksi ei püüa
  võistlust, sest ta mõõdab hetke, mis on möödas enne, kui ta jõuab otsustada.
  Avamise rajal on **kirjutus kohtunik**: kui `updateMany({openedAt: null, recalledAt:
  null})` ei kirjutanud, loetakse värskelt üle, MIKS. Kolm leidu, mida raportis ei olnud:
  saatja kiirusmärge elas org-tabelis koopiana (kustutatakse tagasivõtmisel + maskeeritakse
  vanadel ridadel), vananenud lugemine oleks andnud sisu ka pärast tagasivõtmist, ja
  `respondToAssignment` sõltus tuletisest. Sond `npm run org:recall:probe` **42/42 päris
  PostgreSQL-is**, deterministlike lukuvõistlustega mõlemas järjestuses; **vana koodi vastu
  21 passed / 21 failed**. Brauseris läbi käidud kahe kirjega kõrvuti.
- **SOL-JOUR-02** (10.08) — Teekonna mustand elas globaalse `sessionStorage` võtme all ilma
  kasutaja ID-ta; sama vahekaardi kontovahetus taastas eelmise inimese olukirjelduse.
  Sama viga mis SOL-SLOG-01, seega kaitse kolis ühte kohta
  (`lib/device/ownerScopedStorage.js`) ja teenuspäevik delegeerib sinna. Tõendatud brauseris:
  vana sildistamata rida kustutati, võõra omaniku rida jäi puutumata ja kummastki ei jõudnud
  ekraanile midagi.
- **SOL-CALL-11, -12, -13** (10.08) — kõneklienti puudutav plokk: kolm leidu elasid kõik
  `components/rooms/useRoomCall.js`-is ja neid parandati koos, sest üks fail on üks sidus
  funktsiooniplokk. **Dokumendi järjekorrast tehti siin teadlik erand**: CALL-12 oli
  peatüki ainus lahtine P0 ja CALL-04…-10 (P1/P2) jäid tema taha ootele. Otsused kolisid
  hookist välja `lib/calls/clientState.js`-i, sest testijooksja ei renderda React-hooke —
  seesama muster, mis JTA E2-s (laua sektsiooni olek). Kõigil kolmel on runtime katmata,
  vt Seis-lõike.

**SOL-SPROF-01 ja -02 (10.08): kood tehtud, seis KVALIFITSEERITUD.** Mõlema juur oli sama —
profiil ütles „eemaldatud" enne, kui midagi oli eemaldatud, ja kaotas seejuures ainsa viida
orvule. Uus jagatud moodul `lib/privacy/serviceProfileRagRemoval.js` kirjutab püsiva
`RAG_DELETE` töö **enne** kustutuskatset ja kustutab `ragSourceId` **ainult kinnitatud
kustutuse järel**; puuduv RAG-võti ei ole enam „skipped". Konto kustutus peidab SOLO-profiili
ja tema kaardikirjed ning kirjutab töö — kõik enne `user.delete`-i, samas lukustatud
tehingus. Uut töölist ei ehitatud: `DataDeletionJob` + `deletionJobRetryService` +
deploy-värav olid olemas. Kolm puuduvat otsa said **10.08 õhtul** kaetud: päringuaegne
fail-closed nõusolekuvärav (`lib/privacy/serviceProfileRetrievalGuard.js`), aus
pending/failed seis liideses ja runtime-tõend päris PostgreSQL-i vastu
(`npm run sprof:consent:probe` 22/22). Ühiktest leidis seejuures, et esimene värav oli
**vales kohas** — `searchRagQueries` tagastab kahest kohast ja ühe päringu kiirtee käis
mööda; värav kolis `searchRagDirect`-i. Teine, seni märkamata uks oli **kovisiooni
teadmusotsing**, mis käib sama RAG-indeksi peal ilma kollektsioonifiltrita.

**Kogu SOL-ORG peatükk (01…12) on 10.08 õhtul tehtud** — auditi neljas lõpuni viidud
peatükk. Muster kordus enamikus: loe seis → otsusta → kirjuta tingimusteta; parandus on kas
`updateMany ... WHERE <eeldatav seis>` või rea lukk ENNE lugemist. Viis uut sondi, kõik päris
PostgreSQL-i vastu (`slog:org:probe` 34/34 · `org:seat:probe` 26/26 · `org:sponsor:probe`
33/33 · `org:inbox:probe` 51/51 · `org:invite:probe` 38/38 · `org:offboard:probe` 60/60) ja
**iga sond jooksutati ka vana koodi vastu**, punaste arv on kirjas iga leiu Seis-lõigus.
Neli asja tulid välja alles sondiga ja audit ise neid ei nimetanud: korduv sponsorluse
vastuvõtmine tegi kaks tellimusrida · korduv kutse vastuvõtmine oleks teinud kaks liikmesust ·
`REVOKED` kutse all oli aktiivne liikmesus koos õigustega · ühest olekumuutusest jäi auditisse
kaks sündmust. Migratsioon `20260810200000` teeb külastuse organisatsioonilise päritolu
andmebaasi tasemel muutumatuks.

**SOL-FIELD-01 ja -02 (10.08): kaks sama klassi leidu vastupidises suunas.** FIELD-01-l oli
otsus õige, aga teda TOITEV loendur luges vale asja — hoiatuste loendurit kasvatas taustakäik,
mida mitte ükski komponent ei kuvanud („kolm hoiatust" = „rakendus avati kolmel eri päeval").
FIELD-02-l on otsus õige ja teda ei kutsu mitte keegi: `fieldPackPurgeDue()` oli olemas, aga
ainus automaatne säilituskäik luges `items`, mitte pakke — ohutusinfot kandev külastuspakett
kadus seadmest ainult käsitsi. FIELD-02 sond käib **päris Chromiumi päris IndexedDB ja
WebCrypto vastu** (`npm run field:pack:probe` 26/26), sest fake-hoidla ei tõenda seda, et
otsus tuleb toime ainult metaandmetega — sisu on seadmes krüptitud. Vana koodi vastu 6 plokki
punast. FIELD-01 brauserikiht jääb `NOT_PROVEN`.

**SOL-FIELD-03 (10.08): audit kirjutas alati globaalse ühenduse kaudu ja neelas iga vea.**
Nüüd on kaks eksporti ja kaks lepingut — `writeDataAudit()` võtab `db` süstituna ja VISKAB,
`logDataAudit()` jääb best-effort'iks. Viis kohustuslikku välitöö rada on põhitehingus;
turvahoiatuse ja säilituskäigu kirjed said süstitud kliendi, aga jäid teadlikult
best-effort'iks, sest seal on kiri juba saadetud ja fail juba kustutatud — rollback teeks
rohkem kahju. Teine pool leidu oli TESTIDES: fake-DB-ga roheline test proovis vaikselt päris
andmebaasi kirjutada (mõõdetud: 241 ms esimesel kirjutusel). Fake-hoidla ise pidi saama
päris rollback'i ja pesastatud seose-projektsiooni — mõlemad peitsid veaklassi. Vana koodi
vastu **8/12 punast**.

**SOL-FIELD-04 (10.08): marker kadus kolmel viisil, millest üks oli raportist väljas.**
Kinnine väljaloend ei kopeerinud teda (kolmas kord samas failis), flush eemaldas ta pärast
IGA täidetud päringut staatust vaatamata — ja võrguta kinnitus kutsus `storePack`-i
**võltsvisiidiga**, mis kirjutas üle terve ettevalmistuspaketi, sealhulgas OHUTUSINFO.
Marker on nüüd versioonitud pakiskeemi osa ja kaob ainult 2xx või tõendatud sündmuse peale;
kõik muu jätab ta alles nähtava tõrkeseisu ja korduskatsega. Sond **35/35** päris IndexedDB
vastu (sh rakenduse taasavamine), ühikuid **18**. Mõõtmise aus piir on Seis-lõigus: vanal
koodil ei olnud moodulipiiri, mille vastu jooksutada.

**SOL-FIELD-05 ja -06 (10.08) lõpetasid peatüki.** FIELD-05: teksti vastuvõtmine ja toorheli
kustutuskell olid kaks eraldi päringut, millest teise viga neelati ja eduteade anti alati —
nüüd on nad **üks idempotentne serveritoiming** (märge kannab viidet salvestisele, kell
käivitub samas tehingus) ja eduteade tuleb ainult siis, kui kirje jõudis `SYNCED`-i. Vana
koodi vastu 4/9 punast; kolm rohelist on seal **tühjalt** rohelised, sest kella ei
käivitatud kunagi. FIELD-06: lubatud 5 s → 5 min backoff oli olemas ainult arvutusena —
ükski taimer ei käivitanud kordust. Uus `lib/field/syncScheduler.js` on Reactist väljas ja
tema kell on süstitav, seega **viis automaatset katset, backoff, peatumine, parkimine ja
unmount'i koristus on mõõdetud võltskella all**, ilma ühegi päris ootamiseta.

**SOL-DOC-01 (11.08) avas dokumendipeatüki: tasu võeti enne, kui tulemus oli olemas.** Kolm
rada arvestasid kasutuse maha kohe pärast mudelikutset ja märkisid siis „valmis" lipu, mis
keelas hilisema vabastuse — mustandi loomise viga, üle kvoodi jäänud sisu (413) või auditirea
viga tuli juba arvestatud ühiku otsa. Järjekord `reserve → produce → persist → commit` on nüüd
omaette moodulis (`lib/usage/paidResult.js`) kahe piiriga: viga enne tasu vabastab, tasu enda
viga EI vabasta (püsiv tulemus on juba omaniku oma). Refine'i puhul on püsiv asi **auditirida**
— ühtlasi kolme refinement'i loenduri ainus allikas — seega käivad audit ja tasu ühes tehingus.
Parandus ise oleks tekitanud uue lõksu (stabiilne kliendivõti + vabastus = igaveseks surnud
kavatsus), nii et vabastatud võti on nüüd sama perioodi sees uuesti reserveeritav. Vana koodi
vastu kolm punast ja **üks, mis ei kuku, vaid lukustub** — vana `commit` avab alati oma
tehingu, ja just see lukk on tõend, miks audit ja tasu ei saanud varem üks toiming olla.

## Lahtised, mis EI OLE lihtsalt tegemata

Neid kolme ei saa „järgmise tööna" ette võtta — nad ootavad kas otsust või tõendust, mida
kood ei anna:

- **SOL-CW-09** (P2) — *kood DONE, brauseritest NOT_PROVEN.* Parandus on olemas, aga
  tagasinupu käitumist ei ole päris brauserist läbi käidud. Loendis on ta seepärast lahtine.
- **SOL-CW-14** (P1) — *mehhanism DONE ja alarm tõendatud päris PostgreSQL-is; taimeri
  LUBAMINE ootab omaniku enda lukustatud järjekorda* (Õ2/Õ3 andmekaitseanalüüs → cron →
  kuivjooks → aktiveerimine). Unit-failid on serveris paigaldatud, taimer on `disabled`.
- **SOL-CW-19** (P1) — *BLOCKED_DECISION.* Leid on mõõdetud ja tõene, aga kriteerium algab
  tooteotsusest, mis on omaniku oma. Koodi ei ole muudetud.

## Kuidas seda loendit lugeda

- **Loend on mehaaniline.** Tehtuks loetakse ainult leid, mille Seis-lõik ALGAB sõnaga
  `DONE`. Kvalifitseeritud seisud („kood DONE; brauseritest NOT_PROVEN", „mehhanism DONE…")
  loetakse **lahtiseks**. Seepärast on SOL-CW siin **17/20**, mitte varem kirjas olnud 18/20 —
  see ei ole tagasiminek, vaid rangem lugemine. Kolm kvalifitseeritud leidu on ülal nimetatud.
- **`runtime: not_run` ei tee leidu lahtiseks.** Enamik parandusi on tõendatud teenuse- ja
  andmebaasitasemel; „päris admini sessioonist läbi käimata" on kirjas iga leiu Seis-lõigus
  eraldi ja seda ei loeta siin puuduseks.
- **Järjekorra reegel on 09.08 parandatud: P0 EES, dokumendi järjekord on tasavägiste vahel
  otsustaja.** Vana reegel oli pelk dokumendi järjekord ja ta ei kannatanud seda tabelit välja:
  puhta dokumendijärjekorra järgi oleks järgmine peatükk SOL-AUTH, kus P0-sid EI OLE ühtegi.
  SOL-CALL, SOL-URG, **SOL-SLOG**, **SOL-RAGSVC**, **SOL-JOUR**, **SOL-PRE** ja **SOL-NET** on
  selle reegli järgi P0-dest tühjaks tehtud. **Alles on KAKS P0-d, mõlemad SOL-SPROF-is
  (SPROF-01, SPROF-02).** Kui need on kaetud, ei ole auditis enam ühtegi P0-d ja
  järjekord langeb tagasi puhtale dokumendijärjekorrale — see tähendab **SOL-AUTH-i** (13
  lahtist), mis on siis kõige eespool.
- **Uue ploki alustamisel loe ENNE raportist**, mis juba tehtud on — see fail võib olla
  vananenud, raport ei ole.
