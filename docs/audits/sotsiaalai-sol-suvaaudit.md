# SotsiaalAI SOL süvaaudit

> **Staatus: POOLELI — `auth` koos konto taastamise/e-posti vahetusega, maksete/tellimuste esimene plokk, `casework`, Meetodipeegel, Minu otsing, Teenuseprofiil, admin-RAG, org/graafik, välitöö, dokumendid/agent, põhivestlus, ruumide/kõnede, teavituste/sündmuste, kiire abi, tööheaolu, Teenuspäeviku esimene plokk, `rag-service` tootmiskood, Prisma skeemi/migratsioonide staatiline plokk ning mentorluse, supervisiooni, kovisiooni, Parimate praktikate, Teemaseemnete, Teekonna, eelpöördumise, abi vahendamise/Teenusekaardi ja võrgustikujagamise semantilised tervikahelad**  
> **Auditeeritud commit:** `cfa62ea8ad161aef04442b1c43048656c7d0e289`  
> **Meetod:** aktiivse tootmiskoodi semantiline realt-reale ülevaatus, sõltuvusahelate kontroll ja sihttestid.  
> **Parandusi selles auditis ei tehta.**

## Tõendamise seis

- Auditi põhiloendis on 1480 faili: 1292 tootmiskoodi kandidaati, 136 Prisma-faili (skeem ja 135 `migration.sql` faili), 43 stiilifaili ja 9 muud faili.
- Esimene plokk katab `auth.js`, `proxy.js`, `lib/authz.js`, `lib/casework/**`, `app/api/casework/**`, juhtumitöö lehed ja komponendid ning seotud Prisma mudelid/migratsioonid.
- `tests/casework/*.test.js`: **246/246 läbitud** pärast Prisma kliendi genereerimist isoleeritud auditikoopias.
- Casework/auth teise ringi kontroll: **246/246 casework-testi ja 7/7 password-reset/session-testi läbitud**. Casework-jooks logis siiski korduvalt `draftsAwaitingTransfer` ja `transferHistory` sektsiooni `TypeError`-i, sest workbench'i fake-DB ei sisalda nende mudelite meetodeid; testid jäid roheliseks ja nende kahe sektsiooni privaatsus jäi tõendamata. Eraldi fake-DB negatiivkontrollis loodi tagasivõetud `DRAFT` eelpöördumisest kaks eri juhtumit ning STAR2 kopeerimisaudit aktsepteeris sündmuse pärast teksti A asendumist tekstiga B, talletades ainult välja võtme. Päris PostgreSQL-i, ajastatud retention-worker'i ja varastatud JWT-ga logout-runtime jäi `not_run`/`NOT_PROVEN`.
- Authi/RAG-authi/Teenuspäeviku proxy sihttestid: **14/14 läbitud**; need ei kata SOL-AUTH-01 ega juhtumitöö lehtede HTTP staatust.
- Admin-RAG/KOV sihttestid: **36/36 läbitud**; need ei kata failisüsteemi-DB veasüsti, paralleelset/stale ingest’i ega osaliselt ebaõnnestunud resetti.
- Admini ohtlike toimingute, usage’i, mentorite ja kiirabilaudade sihttestid: **74/74 läbitud**.
- Organisatsiooni ja graafiku sihttestid: **164/164 läbitud**; mitme orgiga töötaja, peatatud org/moodul, auditi veasüst ning kohaplaani paralleelsed limiidi/lõpetamise toimingud on katmata.
- Tellimuse vaateserialiseerija testid: **9/9 läbitud**; `SPONSORED_BY_ORGANIZATION` juhtum puudub testandmetest.
- Välitöö sihttestid: **43/43 läbitud**. Privacy/handover failid vajasid protsessi lõpetamiseks `--test-force-exit` lippu ja paljastasid katse minna süstitud test-DB asemel globaalsesse Prismasse; päris andmebaasi runtime jäi `not_run`.
- Dokumentide, uurimistöö ja privaatse RAG-isolatsiooni sihttestid: **48/48 läbitud**; need on valdavalt puhaste funktsioonide ja lähtekoodi-kuju lepingutestid ning ei kata kasutuse commit'i järel tekkivaid vigu, päris failisüsteemi-DB lahknemist ega paralleelseid päringuid.
- Vestluse sihttestid: **403/403 läbitud**; jooks logis RAG-i sündmuste best-effort Prisma kirjutustel puuduva test-DB parooli vead, kuid lõpetas koodiga 0. Kogum ei kata vestluse püsistuse ega kasutuse settlement'i veasüsti, paralleelseid sama vestluse pöördeid, enneaegselt suletud SSE-d ega Stop'i võidujooksu pärast provider'i `done` sündmust.
- Ruumide, kõnede ja kutsete sihttestid: **134/134 läbitud**. Kogum ei kata arhiveeritud ruumi otseseid kirjutus-API-sid, ruumivahetuse hiliseid fetch'e, päris DB omanikuvahetuse/join/start paralleelsust, provider-stop'i ega pärast provider-start'i tekkivaid DB-vigu. Üks test kinnitab praegu teadlikult, et kokkuvõtte seose kirjutusviga ei kukuta jagamist — see on SOL-ROOM-06 kirjeldatud tootelepingurisk, mitte negatiivne tõend.
- Konto taastamise, profiili e-posti/PIN-i ja registreerimise sihttestid: **30/30 läbitud**. Kogum ei kata toortokeni lekkestsenaariumi, e-posti kinnituse `GET`-prefetch'i, tokeni asendamisega võistlevat kinnitamist, maileri vea järel kehtivat tokeniseisu ega enne PIN-i muutmist väljastatud ajutise sisselogimistokeni hilisemat kasutust.
- Maksete, tellimuse vaate ja paketiseemnete sihttestid: **52/52 läbitud**. Kogum ei käivita webhook-route'i ega kata paralleelset checkout'i/recurring-tokeni callback'i, ebamäärast provideritulemust, summa/valuuta mittevastavust, osalist tagasimakset või konto kustutamise makseretentsiooni. Jooks kestis 61,0 s ja logis kolm neelatud globaalse Prisma DB-logi ühendusviga, kuigi testid süstisid fake-DB — see toetab SOL-PAY-08 sõltuvus- ja auditileidu.
- Domeenisündmuste, teavituste, ruumi/kõne elutsükli, supervisiooni ja heaolu teavituste sihttestid: **64/64 läbitud**. Delivery-testid kasutavad lubavat fake-mailerit ega kontrolli kohustuslikku saatja aadressi; kogum ei kata päris SMTP-d, üle 10 000 püsiva reconciler-allikarea nälgimist, lehekülgedeülest ruumiautorite deduplikatsiooni, kuue tunni piiril topeltteadet ega varasema sweep'i vea mõju välitöö ja kiire abi sweep'idele. Eraldi kontroll päris `getMailer()` teega kinnitas, et notification-worker'i praegune sõnum kukub enne võrguühendust veaga `EMAIL_FROM peab sisaldama kehtivat aadressi.`
- Kiire abi laudade, pöördumiste, üleandmise, aegumise, vormi ja koondi sihttestid: **139/139 läbitud**. Testid kasutavad järjestikust fake-Prismat ega kata päris tehinguid, olekusiirete võidujookse, 200 rea järel tekkivat järjekorranälga, konto kustutuse andmepuhastust, puuduvat safety-vastust, kliendi loodud AI-mustandit, auditirea kirjutusviga, 20 000 rea koondipiiri ega Tallinna ajavööndit.
- Tööheaolu kirjete, paranduste, kontrollpunktide, mustandite, kovisiooni handoff'i, piloodijuurdepääsu, koondite ja eksportide sihttestid: **185/185 läbitud**. Kogum ei kontrolli piloodi lõplikku Prisma organisatsiooni/KOV skoopi, serveri kategooriaväärtuste allowlist'i, üle 10 000 kirje kärbet, ühe inimese korduvkirjete mõju meetrikale, kitsaste koondpäringute differencing-riski, vastatud kontrollpunktide batch-nälgimist, paranduse topeltkontrollpunkti, päris paralleelkirjutusi ega 500-vea avalikku kehakuju.
- Teenuspäeviku kirjete, kliendivaate, päevateekonna, määramise, ekspordi, narratiivi, mõõtmise, idempotentsuse, outbox'i ja skeemi sihttestid: **282/282 läbitud**. Kogum ei sisalda `reportShare.js` semantilisi teste ega kata kasutajavahetust samas brauseris, 4xx järel outbox'i taastamist, eri sisuga idempotentsusvõtit, päris paralleelseid elutsüklisiirdeid/parandusi, mitme organisatsiooniga töötajat, aruandefaili ja DB lahknemist ega säilitusaegset dokumendikustutust. `reportArchive` testid proovisid süstitud fake-DB kõrval globaalse audit-Prisma kaudu päris DB-ga ühenduda ja logisid puuduva parooli vigu; runtime jäi `not_run`.
- `rag-service` puhaste turvapiiride testidest **5/5 läbitud** (`test_search_security.py`). Chroma integratsiooni ja otsingu observability kaks testimoodulit ei käivitunud, sest auditikeskkonna Pythonis puuduvad `chromadb` ja `starlette`; sõltuvusi auditi jaoks ei paigaldatud. Päris RAG-teenus, OpenAI embeddingud, Chroma püsikiht, failisüsteemi veasüst ja võrgu-SSRF runtime jäid `not_run`.
- Prisma skeemis on **179 mudelit ja 145 enumit**; kettas on **135 migratsioonikausta** ning kõigis on `migration.sql`. `npx prisma validate --schema prisma/schema.prisma`: **läbitud**. CI rakendab kogu migratsiooniahela ainult tühjale PostgreSQL-ile (`.github/workflows/quality-gate.yml:65-69`), mitte olemasolevate pärandandmetega upgrade'ile. Kohalik puhta migratsiooniahela jooks ei käivitunud, sest auditikeskkonnas puudus autentitav kohalik PostgreSQL; päris/staging DB-d read-only auditis ei kasutatud. Migratsioonide upgrade-, lukustus- ja andmetulemi runtime jäi `not_run`.
- Mentorluse profiili, kataloogi, taotluste, suhte, kokkuleppe, kohtumise, kokkuvõtte, ettevalmistuse, sweep'i, adapterite ja ajavööndi sihttestid: **29/29 läbitud**. Päris PostgreSQL-i terviklussond läbis **22/22** mõõtmist ning Tallinna ajavööndiga päris brauser tõendas talve- ja suveaja UTC teisenduse koos identse tagasikuvamisega. Peatüki UTC täisvärav: **4438/4438**. SOL-MENT-01…07 vastuvõtukriteeriumide negatiivsed, piiri- ja võistlusjuhtumid on kaetud.
- Supervisiooni grandi, protsessi, kontrakti, osaluse, eeskambri, jagamise, kohtumiste, kokkuvõtete, sulgemise, teavituste, Tööheaolu-üleandmise, serializer'ite ja UI sihttestid: **82/82 läbitud**. Eraldi in-memory negatiivkontroll tõendas, et (a) INVITED kasutaja saab pärast protsessi sulgemist ACCEPTED/OS liikmeks, (b) ACCEPTED kasutaja saab pärast sulgemist luua uue SHARED teema, mida CLOSED-vaade tagastab, (c) SUPERSEDED kontraktiversiooni taasaktiveerimine taastab vana acceptance'i põhjal OS-rolli ilma uue nõusolekuta ning (d) OS_STALE kasutaja isiklikku väljundisse kirjutatakse kinnitamata aktiivse versiooni tekst `lastAcceptedContractBody` väljana. Päris PostgreSQL-i, kahe autentitud brauserikonto, raw-SQL purge'i, worker'i ja samaaegsete päringute runtime jäi `not_run`.
- Kovisiooni tööruumi, sessioonimasina, lõpetatud juhtumite, kõnede, Tööheaolu-üleandmise, route'ide, skeemi, privaatsus- ja UI-lepingute sihttestid: **188/188 läbitud**. Kolm eraldi in-memory negatiivkontrolli tõendasid, et (a) konto kustutuse järel `userId:null`-iks muutunud ACCEPTED osalejarida annab sama e-postiga uuele kontole osalejavaste, (b) serveri action-normaliseerija aktsepteerib `agreementConfirmed:true` ilma rollikinnituseta ning (c) puuduva saatja aadressi korral lõpeb kutse saatmine eduna, mailerit kutsumata. Kogum ei kata kutse tagasivõtmist/aegumist, konto kustutuse päris FK-kaskaadi, üle 100/200 kirje nälgimist, kutse outbox'i ega `private_draft` tööobjekti negatiivset privaatsusjuhtu. Päris PostgreSQL-i, kahe autentitud konto ja SMTP-ga runtime jäi `not_run`.
- Parimate praktikate kandidaadi-, pädevus-, retsensiooni-, avaldamis-, rakendamiskogemuse-, RAG-i-, deploy-värava-, konto-kustutuse-, scheduleri- ja UI-lepingute sihttestid: **82/82 läbitud**. Kogum ei kata üle 100/200/500 rea kärpeid, retsensendi pädevuse aegumist või konto kustutamist enne madala riskiga praktika avaldamist, automaatse assignment-repair/RAG-drain käivitaja olemasolu, nime/aadressi/juhtuminumbriga kaudset isikustamist, sisendi vaikset kärpimist ega seda, et RAG-tekstist puuduvad õppimisalus, allikad ja oodatav tulemus. Päris PostgreSQL-i, autentitud mitme kasutaja brauseri ja RAG-teenusega runtime jäi `not_run`.
- Teemaseemnete service-, route-, skeemi- ja UI-lepingute sihttestid: **51/51 läbitud**. Kogum katab ainult DRAFT/WAITING kliendioleku, mitte `IN_COVISION`/`FOLLOW_UP`/`CLOSED` kuvamist ja toiminguid; samuti puuduvad mustandi kustutus/tagasivõtt, serveripoolne identifikaatoriproov, millisekundilise `updatedAt`-CAS-i kokkupõrge ning suure omanikuajaloo loendikäitumine. Päris PostgreSQL-i samaaegsus ja autentitud brauseri elutsüklirada jäid `not_run`.
- Teekonna, eelpöördumise handoff'i ja Töölaud-continuity sihttestid: **45/45 läbitud**. Eraldi puhaste funktsioonide negatiivkontroll tõendas, et struktureeritud `context.assistiveDevices` ja `context.activityLog` muutuvad salvestusnormaliseerimisel väärtuseks `[object Object]`, eitav ohukirjeldus tekitab 112-hoiatuse ning ühe abivahendi „katki” seis kandub kõigile leitud abivahenditele. Kogum ei läbi teist jagamisvalikut kuni päriselt salvestatud/SENT eelpöördumiseni, kahe konto sama brauserisessiooni mustanditaastet, stale continuity/archive kirjutust, arhiveeritud Teekonna muutmist, vestlusest loodud Teekonna päritoluseost ega päris PostgreSQL-i samaaegsust. Autenditud brauseri, kahe kasutaja, päris PostgreSQL-i ja SENT-adressaadi runtime jäi `not_run`.
- Eelpöördumise koostamise, adressaadi, allalaadimise, vastuvõtu, tööplaani, tagasivõtu, paranduse, ruumi, organisatsiooni postkasti, sündmuste, Kovisiooni ja konto-kustutuse sihttestid: **140/140 läbitud** (137 eelpöördumise/org/ruumi testi + 3 konto-kustutuse testi). Eraldi puhaste funktsioonide negatiivkontroll tõendas, et `lähisuhtevägivald` ja `koduvägivald` jäävad `NORMAL`/riskiliputa, piirkonnaga mitteseotud suvaline soovitus saab `HIGH` kindluse ning tagasivõetud organisatsioonipöördumise projektsioon kannab endiselt kogu tundlikku paketti. Rohelised testid ei kata saatmata mustandi konto-kustutust, tagasivõetud org-kirje detaili/uusmääramist, organisatsiooniparandust, avaldamata adressaati, välise e-kirja topeltsaatmist, stale üldsalvestust ega 12 route'i rate-limit'i puudumist. Päris PostgreSQL-i, SMTP, organisatsiooni vastuvõtulaua ja kahe autentitud brauserikonto runtime jäi `not_run`.
- Abi vahendamise, help-listing'u, Teenusekaardi, geokodeerimise, sobitamise, võrgustikujagamise, Teekonna handoff'i ja „Minu jagamiste” sihttestid: **164/164 läbitud**. Eraldi fake-DB negatiivkontroll tõendas, et (a) paralleelne tekstimuutus ja kliendi otsus jätavad uue kinnitamata teksti `CONFIRMED` olekusse, (b) paralleelne tekstimuutus ja saatmine jätavad sama teksti `SENT` olekusse ilma `clientConfirmedAt`-ita, (c) ruum luuakse enne nurjunud saatmisoleku kirjutust, (d) möödunud kaasamistähtajaga jagamine saadetakse, (e) tavaline kuulutuse tekstiparandus taastab peidetud kaardikirje `mapVisible:true`/`PUBLISHED` kujule ning (f) suletud, aegunud ja omavahel sobimatud kuulutused saab vana PENDING-sobituse kaudu siiski `ACCEPTED` ruumiks muuta. Rohelised testid ei kata neid paralleelsusi, rolli/raamlepingu hilisemat kadumist, tagasivõetud lähtepöördumist, tegeliku lugemise ja käsitsi „avatud” märgi lahknemist ega notification/audit'i osalist viga. Päris PostgreSQL-i, kahe autentitud brauserikonto, välise geokodeerija ja ruumiliikmete runtime jäi `not_run`.
- Meetodipeegli kirje- ja workspace-adapteri sihttestid: **11/11 läbitud**; andmeekspordi sihttestid: **7/7 läbitud**. Eraldi fake-DB negatiivkontroll tõendas, et (a) vigane `sourceKind/sourceId` filter tagastab vea asemel kõik omaniku kirjed, (b) suvaline kontrollimata `PRE_INQUIRY` allika-ID salvestatakse ning (c) kaks samast vanast seisust PATCH-i aktsepteeritakse ja viimane kirjutab esimese vaikides üle. Ekspordiregistri runtime-loend sisaldab kuut kogu, kuid mitte `PracticeReflection` kirjeid. Testid ei kata route'i auth-/tellimusväravat, päris PostgreSQL-i samaaegsust, 51+ kirje loendit, in-flight detailipäringuid ega lepingulise moodulitähtaja retention'i; autentitud brauser ja päris DB jäid `not_run`.
- Minu otsingu service- ja route-testid: **12/12 läbitud**. Omanikufiltrid ning minimaalne `kind/title/status/updatedAt/href` projektsioon on staatiliselt olemas ja testitud, kuid testid kasutavad fake-Prismat ega tõenda teise päris kasutaja negatiivset runtime'i. Eraldi negatiivkontrollis tagastas 12 vestluse vastega andmestik ainult 8 ilma kärpemarkerita, ühe Journey-päringu viga lõpetas kogu otsingu ning kaks eri dokumenti said sama `/documents` href'i. Päris PostgreSQL-i, kahe sünteetilise kasutaja, proxy access-log'i, mitme Node'i protsessi limiter'i ja autentitud brauseri runtime jäi `not_run`/`NOT_PROVEN`.
- Teenuseprofiili, teenuse kättesaadavuse ja MTR-i sihttestid: **123/123 läbitud**; konto elutsükli, organisatsiooniprofiili ning andmekoopia seotud kontrollid: **51/51 läbitud**. Eraldi negatiivkontroll tõendas, et (a) nähtava teeninduskoha avalik projektsioon toob seosetabeli varuvariandi kaudu tagasi `HIDDEN`/`mapVisible:false` teenuse, (b) RAG metadata saadab sama peidetud teenuse täisandmed, ja (c) server aktsepteerib koordinaadid `999/-999`, märgib need `MATCHED` ning omistab allikaks vaikimisi `maaruum`. Rohelised konto-testid kinnitavad teadlikult `ownerId:null` SOLO-profiili püsimist, kuid ei kontrolli selle avaliku kaardi- ega RAG-koopia sulgemist. Päris PostgreSQL-i, RAG-teenuse, MTR-võrgu, kahe autentitud brauseri ja konto kustutuse avaliku järelkontrolli runtime jäi `not_run`.
- `npm run build:webpack`: **FAILED** — vt SOL-BUILD-01. Vaikimisi Turbopack-build jäi auditikoopia välise `node_modules` ühenduskausta piirangu taha; see on auditikeskkonna piirang, mitte platvormi tulemus.
  **Parandusjärgne mõõtmine 09.08.2026 (peatööpuu):** `npm run build:webpack` exit 0, `npm run build` exit 0, `npm test` **3126/3126 läbitud**. Vt SOL-BUILD-01 seisu.
- Päris andmebaasi ja sisselogitud brauseriga runtime: **not_run**.
- Roheline test ei tühista allolevaid leide: olemasolevad testid ei kata kirjeldatud negatiivseid ega paralleelsusjuhtumeid.

## Vaheleiud

### SOL-SCHEMA-01 — kohtumise märkme kirjet EI SAA päris andmebaasis luua — P0

*Ei ole algsest auditist. Leitud 09.08.2026 SOL-CW-19 sondi kirjutamise käigus ja
kirjutatud siia, et ta ei kaoks.*

**Tõend.** `20260808160000_jta_v1_meeting_note` lõi `CaseWorkMeetingNoteEntry` tabeli veergudega `"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` ja **`"updatedAt" TIMESTAMP(3) NOT NULL` ilma vaikeväärtuseta**. Prisma mudel neid kahte veergu **ei kandnud**. Prisma ei saada seda, mida mudelis ei ole, seega iga `caseWorkMeetingNoteEntry.create()` — sh teenuskihi `addEntry()` (`lib/casework/caseWorkMeetingNote.js:358-361`) — kukub päris PostgreSQL-is: `23502 null value in column "updatedAt" violates not-null constraint`. `prisma migrate diff` migratsioonide ja skeemi vahel ütles sama välja: `ALTER TABLE "CaseWorkMeetingNoteEntry" DROP COLUMN "createdAt", DROP COLUMN "updatedAt"`.

**Mõju.** Kohtumise märge — kogu E4 ja kogu SOL-CW-15 karastus — ei oleks toodangus kirjutanud **ühtegi rida**. Töötaja oleks märkme kirjutanud ja saanud 500. Kasutajakahju ei ole tekkinud ainult sellepärast, et `CASEWORK_V1_ENABLED` on tootmises väljas.

**Miks ükski roheline värav teda ei näinud.** `npm test` jookseb fake-Prismal, mis ei jõusta `NOT NULL`-i · `db:migrate:check` rakendab migratsioone, aga **ei kirjuta ühtegi rida** · `prisma validate` kontrollib skeemi süntaksit, mitte skeemi ja andmebaasi vastavust. Kolm rohelist väravat, null katvust. Täpselt see, mille kohta [[fake-prisma-ei-valideeri]] hoiatab.

**Seis (09.08.2026): DONE — parandus, negatiivkontroll ja väravatest.**
- **Parandus on MUDELIS, mitte migratsioonis:** `createdAt DateTime @default(now())` ja `updatedAt DateTime @updatedAt` lisati `CaseWorkMeetingNoteEntry`-le. Veerud on andmebaasis juba olemas, seega uut migratsiooni ei ole vaja ja tootmises ei muutu ükski rida. Vastupidine tee (veergude kustutamine migratsiooniga) oleks kaotanud kirje loomise ja muutmise aja — andmed, mis kohtumise tõendi juures on mõttekad, ja `revision`/`retractedAt` kõrval otseselt kasulikud.
- **Mõõdetud pärast parandust:** `npm run casework:deletion:probe` loob nüüd päris PostgreSQL-is kasutaja → juhtumi → märkme → märkme kirje ahela lõpuni. Enne parandust kukkus sama sond `23502`-ga.
- **Väravatest** (`tests/casework/schemaModelParity.test.js`, 3 uut): iga `CaseWork*` `CREATE TABLE` ploki kohustuslik vaikeväärtuseta veerg peab olema ka mudelis · **negatiivkontroll parseri enda peale** (väljamõeldud plokk, kus üks veerg puudub) · nimeline test just nende kahe veeru peale. **Negatiivkontroll päris koodi vastu:** paranduse eemaldamisel kukub 2/3 testi ja nimetab täpselt `CaseWorkMeetingNoteEntry.updatedAt`; tagasi pannes 3/3.
- **Testi piir on aus:** ta loeb `CREATE TABLE` plokke, seega hiljem `ALTER TABLE ADD COLUMN`-iga lisatud veerg jääb talle nähtamatuks ja seda katab endiselt ainult sond. Katvus on `CaseWork*` tabelid.
- **Ülejäänud skeemi triiv jäi PARANDAMATA ja see on teadlik.** `migrate diff` näitab veel ~15 lahknevust (`TIMESTAMP` täpsused, `DROP DEFAULT`, pärandtabel `AnalyzeUsageLegacy`, paar indeksinime). Neist **ükski ei ole sama liiki**: seal on veerg olemas nii mudelis kui andmebaasis ja `INSERT` töötab. Nad on omaette töö ja kuuluvad eraldi otsuse alla.
- Kontroll: `npm test` **3240/3240**, `npx prisma validate` OK, klient genereeritud, `npx eslint` puhas.

### SOL-BUILD-01 — projekti Webpack production-build ei kompileeru — P2

**Tõend.** Isoleeritud commit’il käivitatud `npm run build:webpack` lõpetas veaga `components/brand/LogoExportStage.module.css:23`: CSS Modules lükkab selektori `:global(html:has(...)), :global(body:has(...))` tagasi, sest selektor ei sisalda kohalikku klassi ega ID-d.

**Mõju.** Dokumenteeritud Webpack-build’i ja analüüsi varurada (`build:webpack`, `analyze:webpack`) ei ole kasutatav. Vaikimisi Turbopack-build’i läbimine selle kontrolliga tõendatud ei ole.

**Vastuvõtukriteerium.** Nii `npm run build` kui `npm run build:webpack` peavad puhtast checkout’ist õnnestuma; logo ekspordilehe globaalse tausta nõue tuleb lahendada CSS Modules’iga ühilduvalt ning lisada CI build-kontroll.

**Seis (09.08.2026): DONE.**
- Parandus: `html`/`body`/`main#main` globaalreeglid kolisid `components/brand/LogoExportStage.module.css`-ist uude marsruudi stiililehte `app/logo-eksport/logo-export.css`, mille `app/logo-eksport/page.jsx` impordib. Moodulisse jäi ainult kohaliku klassiga `:global(.room-veil-line).loadingLine`.
- Tõend enne parandust: `postcss-modules-local-by-default` `pure`-režiimis andis HEAD-i failile täpselt auditis kirjeldatud vea real 23.
- Tõend pärast parandust (kohalik, 09.08.2026): `npm run build:webpack` → exit 0, `✓ Compiled successfully in 2.9min`; `npm run build` (Turbopack) → exit 0. Mõlemad vastuvõtukriteeriumi build'id läbivad.
- Regressioonitest: `tests/styles/cssModulesPurity.test.js` — jooksutab Next.js-i enda kaasapakitud `postcss-modules-local-by-default` `pure`-režiimi kõigi repo `*.module.css` failide peale, pluss negatiivkontroll (teadaolevalt ebapuhas selektor peab läbi kukkuma) ja marsruudi stiililehe olemasolu leping.
- CI: `.github/workflows/quality-gate.yml` sai eraldi töö `webpack-build`, mis jooksutab `npm run build:webpack` (eraldi töö, et mitte segada põhitöö `.next` kausta ja tootmis-smoke'i).

### SOL-AUTH-01 — ootamatu andmebaasiviga jätab JWT varasemad õigused kehtima — P1

**Tõend.** `auth.js:275-339` värskendab igal JWT-kutsel kasutaja rolli, administraatoriõigust, sessiooniversiooni ja jälgitavat sessiooni. Ainult vead `SESSION_USER_MISSING` ja `SESSION_REVOKED` katkestavad sessiooni; iga muu viga seab üksnes `token.subActive = false`. Varem tokenis olnud `id`, `role`, `isAdmin`, `sessionVersion` ja `sessionRecordId` säilivad.

**Mõju.** Andmebaasi ajutise vea ajal võib peatatud, kustutatud, muudetud rolliga või aegunud jälgitava sessiooniga kasutaja jätkata vana autoriseerimisinfoga. Tellimusega funktsioonid sulguvad, kuid rolli- ja administraatoriõigused ei sulgu.

**Vastuvõtukriteerium.** Autoriseerimise värskendamise ootamatu tõrge peab olema fail-closed: sessioon ei tohi anda vana rolli ega administraatoriõigust. Test peab katma vähemalt kasutaja päringu vea ja jälgitava sessiooni kontrolli vea.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- Parandus: JWT autoriseerimise värskendus kolis `auth.js`-ist testitavasse moodulisse `lib/auth/jwtAuthorization.js` (`refreshTokenAuthorization`). Ootamatu tõrge kutsub nüüd `applyFailClosedAuthorization()`: `role → "CLIENT"`, `isAdmin → false`, `subActive → false`, `authDegraded → true`. `SESSION_USER_MISSING`/`SESSION_REVOKED` visatakse endiselt edasi (sessioon lõpeb). Järgmine õnnestunud värskendus taastab õigused andmebaasist ja kustutab `authDegraded` lipu.
- `auth.js` `session()` callback avaldab `session.authDegraded`, et langetatud seis ei näiks kasutaja tegeliku rollina.
- Testid: `tests/auth/jwtAuthorization.test.js` — kasutajapäringu viga, jälgitava sessiooni kontrolli viga, jälgitava sessiooni **loomise** viga (kolmas, auditis nõutust laiem rada), taastumine pärast tõrget ning kontroll, et SESSION_* rajad endiselt sessiooni lõpetavad. 8/8 läbitud.
- **runtime: not_run** — päris andmebaasi katkestust sisselogitud brauserisessiooni ajal ei mängitud läbi; tõend on ühikutasemel veasüst, mitte HTTP-tasemel.

**Lahtine tooteotsus.** Valisin fail-closed *langetuse* (sessioon jääb alles, õigused kaovad), mitte sessiooni lõpetamise. Nii ei logi mööduv andmebaasitõrge kõiki kasutajaid välja. Kui omanik tahab range varianti (iga ootamatu tõrge = väljalogimine), on muudatus üherealine: `applyFailClosedAuthorization` asemel `throw error`.

### SOL-AUTH-02 — aktiivsete sessioonide ülempiir ei ole paralleelsete sisselogimiste korral atomaarne — P2

**Tõend.** `auth.js:51-108` kustutab aegunud read, loeb aktiivsed sessioonid, kustutab ülejäägi ja loob uue sessiooni tavalises tehingus. Kahel paralleelsel sisselogimisel on võimalik sama algseisu lugemine ja kahe uue rea loomine. Skeemis puudub kasutajapõhine piirang, mis ülempiiri jõustaks.

**Mõju.** Seadistatud aktiivsete sessioonide ülempiiri võib ületada; turvameede ei ole koormuse all deterministlik.

**Vastuvõtukriteerium.** Sama kasutaja sessioonide loomine tuleb serialiseerida või jõustada andmebaasi tasemel ning lisada kahe samaaegse sisselogimise test.

**Seis (09.08.2026): DONE — kaasa arvatud päris PostgreSQL-i runtime.**
- Parandus: `createTrackedSessionForUser` (nüüd `lib/auth/jwtAuthorization.js`) võtab tehingu esimese sammuna PostgreSQL nõuandeluku
  `SELECT pg_advisory_xact_lock(4711::int4, hashtext($userId)::int4)`. Lukk on kasutajapõhine ja vabaneb tehingu lõpus, seega sama kasutaja sessiooniloomised serialiseeruvad, eri kasutajate omad mitte.
- Ühiktestid: `tests/auth/jwtAuthorization.test.js` — lukku matkiv test-DB hoiab kahe paralleelse loomise järel ülempiiri; **negatiivkontroll** sama test-DB lukustamata režiimis ületab ülempiiri (tõendab, et test päriselt mõõdab võidujooksu). Lisaks kontrollitakse, et võetav lause on `pg_advisory_xact_lock` ja et argumendid on nimeruum + kasutaja ID.
- **Runtime (päris kohalik PostgreSQL 09.08.2026, sondid ajutise kasutajaga, mis kustutati):**
  - lukustatud lause töötab `$executeRaw` kaudu (`$queryRaw` ei sobi: `void` tagastustüüpi ei deserialiseerita); kaks paralleelset tehingut serialiseerusid (`enter-1 exit-1 enter-2 exit-2`), pärast tehingute lõppu ei jäänud ühtki advisory lukku alles;
  - täis limiidi (3) juures **kolm paralleelset** `createTrackedSessionForUser` kutset → lõppseis täpselt **3** aktiivset sessiooni;
  - negatiivkontroll sama stsenaariumiga parandus-eelse (lukustamata) algoritmiga → **4** aktiivset sessiooni, s.t. audidis kirjeldatud ületamine reprodutseerus päris andmebaasil.
- Katmata jääb kahe päris HTTP-sisselogimise (NextAuth `authorize` → `jwt`) samaaegne rada; tõend on teenuse-, mitte marsruuditasemel.

### SOL-CW-01 — tasulise juhtumitöö UI ja serveri ligipääsureegel räägivad eri tõde — P2

**Tõend.** `lib/workspaceDashboardCards.js:179-209` märgib nii „Minu juhtumid” kui „Juhtumitöö laua” `requiresPaid: true` funktsioonideks. `lib/casework/routes.js:53-78` kontrollib funktsioonilippu, sessiooni ja rolli, kuid mitte aktiivset tellimust. Kõik `app/api/casework/**` marsruudid kasutavad seda sama väravat. Ka `app/juhtumid/page.jsx` ja `app/toolaud/juhtumitoo/page.jsx` ei kontrolli tellimust.

**Mõju.** Tellimuseta töötaja ei saa funktsiooni kaardilt avada, kuid saab kasutada lehte ja kõiki lugemis- ning kirjutamis-API-sid otse-URL-i kaudu. Samas platvormi reegel „ligipääs oma andmetele ei aegu” tähendab, et pelk kõigi API-de sulgemine ei pruugi olla õige parandus. Praegu pole lugemisõiguse ja tasuliste tööriistatoimingute piir üheselt määratud.

**Vastuvõtukriteerium.** Omanik peab lukustama tasuta lugemise ja tasuliste toimingute lepingu; UI, lehed ja server peavad jõustama sama reeglit. Negatiivne HTTP-test peab tõendama tellimuseta kasutaja lubatud ja keelatud toimingud.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**

**Omaniku otsus 09.08.2026: „loe tasuta, tööriistad tasu eest".** Piir on sama kõva reegel, mis platvormil juba kehtib Tööheaolul ja refleksioonil (`app/api/reflections/_shared.js`) ning mille aluslubadus on SotsiaalAI.md-s („ligipääs oma andmetele ei aegu kunagi"): **GET/HEAD ja DELETE ei sõltu tellimusest, POST/PUT/PATCH nõuavad aktiivset tellimust.**

- Server: `lib/casework/routes.js` sai `caseWorkRequiresSubscription(method)` ja `guardCaseWorkRequest` kutsub nüüd `requireSubscription()`-i `allowWithoutSubscription` lipuga. Tasuline toiming ilma tellimuseta → **402** koos `api.common.subscription_required` võtme, `redirect: /tellimus` ja `requireSubscription: true` väljaga. Kõik 31 `app/api/casework/**` marsruuti käivad läbi selle sama värava, seega ükski marsruut ei jää maha.
- Väravate järjekord ei muutunud: lipp (404) → sessioon (401) → roll (403) → **tellimus (402)** → rate-limit. Suletud funktsioon jääb olematust marsruudist eristamatuks (L19).
- UI: mõlemalt juhtumitöö kaardilt (`lib/workspaceDashboardCards.js`) kadus `requiresPaid: true`. Enne oli kaart tellimuseta lukus ja server lubas kõik läbi — täpselt vastupidi tõele. Nüüd on pind lugemiseks lahti ja piiri jõustab server.
- Lehed `/juhtumid` ja `/toolaud/juhtumitoo` jäävad teadlikult lipu-, mitte tellimuseväravaga — lugemine on tasuta.
- Testid: **`tests/casework/subscriptionGate.test.js` (7 testi)** käivitab päris `guardCaseWorkRequest`-i (sessioon ja tellimuskontroll `deps` õmbluse kaudu, mitte tekstiotsing): tellimuseta GET/DELETE läbivad, tellimuseta POST/PUT/PATCH annavad 402 õige kehaga, tellimusega kõik läbivad, admin ei jää kinni, väljas lipuga **ei loeta sessiooni ega küsita tellimust** ning roll laheneb enne tellimust. `tests/casework/dashboardCard.test.js` kinnitab nüüd vastupidist lepingut (kaart lahti). Kogu `tests/casework/*` **253/253**.
- **runtime: not_run** — päris HTTP-päringut tellimuseta sisselogitud töötajaga ei tehtud; tõend on väravafunktsiooni, mitte võrgu tasemel.

**Allesjäänud lõtk (teadlik, omanikule teadmiseks).** (1) `POST /cases/[caseId]/retention` (arhiveerimine) langeb tasulisele poolele — tellimuseta töötaja ei saa juhtumit arhiveerida, mis lükkab säilituskella käivitumist edasi. (2) Kliendipoolsed kirjutusnupud ei ole ette keelatud: kasutaja saab teada 402 järel. Veateade ise on tõlgitud kõigis kolmes keeles (`api.common.subscription_required` on olemas et/en/ru), seega toorest veakoodi ei kuvata.

### SOL-CW-02 — juhtumitöö suletud lehed ei ole tõendatult olematust marsruudist eristamatud — P2, runtime NOT_PROVEN

**Tõend.** `proxy.js:38-49` dokumenteerib päris production-build’iga mõõdetud Next.js käitumise: voogedastatud paigutuse korral võib lehe `notFound()` anda 404-sisu staatusega 200. Seetõttu kirjutatakse `/teenuspaevik` keskvaras olematule teele ümber (`proxy.js:50-55`). Juhtumitöö lehed kasutavad sama `notFound()` mustrit (`app/juhtumid/page.jsx:48-50`, `app/toolaud/juhtumitoo/page.jsx:52-54`), kuid proxy matcher neid teid ei kata (`proxy.js:90-92`).

**Mõju.** HTTP staatus võib paljastada väljalülitatud funktsiooni olemasolu ja rikub lepingu nõuet, et suletud pind oleks olematust marsruudist eristamatu.

**Vastuvõtukriteerium.** Väljalülitatud lipuga production-build’i test peab võrdlema mõlema juhtumitöö tee staatust, sisu ja olulisi päiseid juhusliku olematu marsruudiga. Vajadusel tuleb mõlemad teed keskvaras sama 404-marsruudi peale kirjutada.

**Seis (09.08.2026): DONE — koos päris production-build'i runtime-tõendiga.**
- Parandus: `proxy.js` sai `FLAGGED_PAGE_REWRITES` nimekirja (`/teenuspaevik` + `/juhtumid` + `/toolaud/juhtumitoo`) ning `config.matcher` katab nüüd kõiki kolme. Suletud pind kirjutatakse ümber täpselt samale olematule teele (`/_puudub`) — mitte tühja 404-vastusega, mis oleks omaette sõrmejälg.
- **Leiu juur oli matcher, mitte leht:** `notFound()` muster oli lehtedel olemas, aga matcher neid teid ei katnud, seega keskvara ei jooksnud üldse. Uus test `tests/casework/closedSurface.test.js` hoiab ümberkirjutuste nimekirja ja matcher'i sünkroonis, et sama viga ei korduks järgmise lipu taga oleva lehega.
- **Runtime — mõõdetud päris `next build` + `next start` (09.08.2026, port 3100):**
  - **Enne parandust** (build ilma proxy-muudatuseta): `/juhtumid` → **200**, `/toolaud/juhtumitoo` → **200**, juhuslik olematu marsruut → 404. Leid reprodutseerus.
  - **Pärast parandust:** kolm ringi, iga suletud tee vs juhuslik olematu marsruut **sama segmendi all** — staatus 404/404, olulised päised identsed, normaliseeritud keha **bait-identne**. `/teenuspaevik`, `/juhtumid` ja `/toolaud/juhtumitoo` kõik.
  - **Sees lipuga** (`CASEWORK_V1_ENABLED=1`) annavad mõlemad juhtumitöö teed endiselt 200 — funktsioon ei ole kinni pandud.
- **Mõõtmismetoodika täpsustus, mis oleks muidu vale tulemuse andnud:** `/toolaud/*` all renderdub 404 `/toolaud` segmendi paigutuse sees ja erineb tipptaseme 404-st ka siis, kui ühtki juhtumitöö lehte poleks olemas. Võrdlusbaas peab olema **sama sügavusega** olematu marsruut (`/toolaud/olematu-…`). Tipptaseme baasiga andis mõõtmine vale-negatiivse „eristatav" tulemuse.
- Testid: `tests/casework/closedSurface.test.js` (5 testi) kutsub päris `proxy`-t — väljas lipuga ümberkirjutus mõlemal teel, sama sihtkoht mis Teenuspäevikul, sees lipuga ei sekku, naabertee ei sulgu, ja matcher-sünkroon. Kogu `tests/casework/*` **262/262**.

### SOL-CW-03 — READ_ONLY ja ARCHIVED juhtumite mustandid jäävad tegevuslauale — P2

**Tõend.** `lib/casework/caseWorkDraft.js:255-271` valib kõik omaniku mitteterminaalsed mustandid, kuid ei nõua vanemjuhtumilt `retentionState: ACTIVE`. Võrdluseks filtreerivad puuduva info ja järgmise kontakti lugejad aktiivse juhtumi (`lib/casework/caseWorkMissingInfo.js:228-235`, `lib/casework/caseWorkAssist.js:341-349`). Mustandi muutmised ise kasutavad aktiivse juhtumi lukku ja keelduvad READ_ONLY/ARCHIVED juhtumil.

**Mõju.** Töölaud näitab tegevusena tööd, mida kasutaja ei saa enam lõpetada; loend ja kirjutusreegel on vastuolus.

**Vastuvõtukriteerium.** Otsustada, kas read-only juhtumi pooleliolev mustand peab olema ainult loetav või töölaualt puudu. Päring ja UI peavad seda otsust järgima ning test peab katma ACTIVE, READ_ONLY ja ARCHIVED vanemjuhtumi.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- **Otsus: töölaualt puudu.** Laud on tegevusloend ja kirjutusreegel (`withActiveCaseLock`) keelab READ_ONLY/ARCHIVED juhtumi mustandi muutmise — tegevusena kuvamine lubaks tööd, mida ei saa lõpetada. Kaks õde-lugejat filtreerivad juba `retentionState: ACTIVE`; kolmas viidi nendega ühte ritta, mitte vastupidi. Mustand jääb juhtumi enda vaates loetavaks, ta lihtsalt ei ole enam päevatöö.
- Parandus: `lib/casework/caseWorkDraft.js` `listDraftsAwaitingTransfer()` `where.caseWorkAssist` sai `retentionState: RETENTION_STATE.ACTIVE`. UI järgib automaatselt — `lib/casework/workbench.js:312` sektsioon loeb sama päringut, eraldi loendurit ei ole.
- Testid: `tests/casework/draftsAwaitingRetention.test.js` (4 testi) test-DB-ga, mis **lahendab seose päriselt** — olemasoleva `caseWorkDraft.test.js` fake teeb ainult pinnapealse võrdluse ega näeks pesastatud filtrit üldse, seega roheline test seal ei tõendaks midagi. Kaetud: ACTIVE / READ_ONLY / ARCHIVED vanemjuhtum, võõra omaniku rida, terminaalsed seisud (`ULE_KANTUD`, `EI_KANTA`) jäävad endiselt välja, filter on `WHERE`-is (mitte vastuse peal — muidu täituks `take` piir arhiveeritud ridadega, sama nälgimismuster nagu SOL-CW-07), ja **negatiivkontroll**, mis tõendab, et säilitusfiltrita päring laseks arhiveeritud mustandid läbi.
- **runtime: not_run** — päris PostgreSQL-i ja autenditud lauavaadet ei mõõdetud.

### SOL-CW-04 — ülekandesündmus võib pärast edukat tehingut jäädavalt kaduda — P1

**Tõend.** `lib/casework/caseWorkTransfer.js:330-378` muudab mustandi seisundi ja kirjutab ülekande auditi ühes tehingus, kuid kutsub domeenisündmuse kirjutamise alles pärast commit’i. `lib/casework/caseWorkTransfer.js:390-410` avab selleks teise tehingu ja neelab vea pärast logimist. `lib/events/emitDomainEvent.js:19-56` näitab, et tegu on sama andmebaasi `DomainEvent` outbox-reaga, mitte välise teenuse väljakutsega.

**Mõju.** API tagastab edu ja põhiseis muutub, kuid outbox’i ajajoone-/teavitussündmus võib jäädavalt puududa. Hilisem automaatne taastamine puudub.

**Vastuvõtukriteerium.** Domeenisündmus tuleb kirjutada põhimuudatusega samas tehingus või luua tõendatud taastatav järelkirjutus. Negatiivne test peab sundima sündmuse loomise vea ja tõendama, et ei teki vaikset osalist edu.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- Parandus: `emitDomainEvent` kolis `markTransferred` põhitehingu **sisse** (`lib/casework/caseWorkTransfer.js`); commit'i-järgne teine tehing ja tema `try/catch` neelaja kustutati.
- **Vana põhjendus oli vale ja see on koodis nüüd kirjas:** „tehingu sees emiteeritud sündmus jõuaks välja ka siis, kui tehing tagasi veereb" kehtiks välise teenuse kutse kohta, aga `emitDomainEvent` kirjutab `DomainEvent` rea **samasse andmebaasi** (outbox). Outbox-rida veereb tehinguga koos tagasi, seega „sündmus ülekande kohta, mida ei toimunud" ei olegi võimalik. Commit'i-järgne emiteerimine tekitas aga vastupidise ja päris riski.
- Sama muster kehtib platvormil juba mujal: `lib/journey/service.js` ja `lib/preInquiries.js` emiteerivad tehingu sees. Juhtumitöö ülekanne oli ainus erand.
- Testid (`tests/casework/caseWorkTransfer.test.js`, 3 uut): **veasüst outbox-rea kirjutusele** → kogu ülekanne veereb tagasi (seis, `transferredAt`, auditirida, sündmus kõik puutumata) ja kutsuja saab vea, mitte vaikse edu; **kordus pärast viga** õnnestub tervikuna; **tehingute loendur** tõendab, et ülekanne kasutab täpselt üht tehingut (kaks tähendaks, et sündmus libises tagasi commit'i-järgsesse tehingusse).
- **runtime: not_run** — päris PostgreSQL-i outbox-veasüsti ei tehtud.

### SOL-CW-05 — uus kopeerimine võib kirjutamata kopeerimisauditi üle kirjutada — P2

**Tõend.** Kui lõikelaud õnnestub, kuid auditi POST ebaõnnestub, tagastab `components/casework/transferFlow.js:74-86` `pendingAudit` andmed. `components/casework/TransferPanel.jsx:94-116` asendab iga uue kopeerimise järel selle ühe oleku. Kopeerimisnupp on keelatud ainult `working || purged` korral (`TransferPanel.jsx:145-156`), mitte ootel auditi korral.

**Mõju.** Kasutaja saab enne auditi korduskatset uuesti kopeerida; teise tegevuse tulemus asendab esimese kirjutamata auditi ja esimest tegevust ei saa enam taastada.

**Vastuvõtukriteerium.** Uus kopeerimine tuleb ootel auditi ajal blokeerida või ootel sündmused järjekorda panna. Test peab katma järjestuse: kopeerimine õnnestub → audit ebaõnnestub → kasutaja proovib uuesti kopeerida.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- **Valisin järjekorra, mitte blokeerimise.** Mõlemad kopeerimised TOIMUSID päriselt, seega mõlemad väärivad tõendit; kopeerimise keelamine lukustaks töötaja välja tööst, mille ta juba tegi, ja püsivalt vigane audit jätaks ta lõksu.
- Parandus: `components/casework/transferFlow.js` sai kaks puhast funktsiooni — `queuePendingAudit()` (lisab, ei asenda; sama võti ei satu kaks korda järjekorda) ja `flushPendingAudits()` (proovib kogu järjekorda **järjekorras ja lõpuni**, ei peatu esimese vea peale, sest iga kirje kannab oma võtit). `TransferPanel.jsx` hoiab `pendingAudits` massiivi ühe pesa asemel.
- **Hoiatust juhib nüüd järjekord, mitte viimane faas.** See oli teine, varjatud pool samast leiust: pärast uut õnnestunud kopeerimist läks `phase` väärtusele `COPIED` ja eelmise teo salvestamata jälje hoiatus kadus ekraanilt.
- Loogika elab JSX-ist väljas — sama põhjus, mille `transferFlow.js` ise kirja paneb: JSX-failis elavat otsust ei saa selle projekti testijooksjaga tõendada.
- Testid (`tests/casework/transferUi.test.js`, 5 uut): auditis nõutud järjestus (kopeerimine → audit kukub → uus kopeerimine) tõendab, et esimest ootel jälge ei kustutata ja ajaline järjestus säilib; korduskatse tühjendab järjekorra ja säilitab võtmed; püsivalt vigane kirje ei hoia teisi pantvangis; ebaõnnestunud korduskatse ei kasvata järjekorda; pinna leping (`pendingAudits`, `queuePendingAudit`, `flushPendingAudits`, hoiatuse tingimus).
- **runtime: not_run** — brauseris kahe järjestikuse kopeerimisega läbi ei mängitud.

### SOL-CW-06 — kopeerimisauditi idempotentsusvõti ei kontrolli algse payload’i vastavust — P2

**Tõend.** `lib/casework/caseWorkTransfer.js:280-293` tagastab unikaalsuskonflikti korral olemasoleva `(draftId, clientActionId)` sündmuse, kuid ei kontrolli, et olemasoleva sündmuse `fieldKeys` ja muu teoidentiteet vastaksid uuele päringule.

**Mõju.** Sama võti koos teistsuguste väljadega annab näiliselt eduka vastuse, kuigi auditirida kirjeldab eelmist kopeerimist.

**Vastuvõtukriteerium.** Täpselt sama payload peab olema idempotentne; sama võti erineva payload’iga peab andma 409. Mõlemad harud vajavad testi.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- Parandus: `recordCopyEvent` unikaalsuskonflikti haru võrdleb nüüd olemasoleva sündmuse **teo identiteeti** uue päringuga (`isSameCopyAction`): `fieldKeys` koos järjekorraga, `kind`, `draftType`, `transferStateAtEvent`, `caseWorkAssistId`, `actorUserId`. Erinevus → **409** `casework.errors.transfer_action_key_conflict`.
- `id` ja `createdAt` jäävad võrdlusest välja — need on esimese kirjutuse omad ka õigustatud korduse korral.
- Väljade **järjekord loeb**: teine järjekord tähendab, et kasutaja valis väljad teisiti, ja auditirida peab kirjeldama seda, mis päriselt juhtus.
- Uus tõlkevõti lisatud kõigis kolmes keeles; `npm run i18n:check` läbitud.
- Testid (`tests/casework/caseWorkTransfer.test.js`, 2 uut, mõlemad haru): sama võti eri väljadega → 409 ja esimese teo auditirida jääb muutmata; sama võti sama järjekorraga → idempotentne 200 sama `id`-ga, teine järjekord samast võtmest → 409.
- **runtime: not_run** — päris HTTP-tasemel 409 vastust ei mõõdetud.

### SOL-CW-07 — retention-hoiatuste fikseeritud batch võib uuemad juhtumid näljutada — P1

**Tõend.** `lib/casework/retention.js:183-195` valib hoiatusaknast vanimad read ja rakendab `take` piiri enne, kui kontrollitakse, kas hoiatus on juba saadetud. Deduplikatsioon toimub alles `sendRetentionWarning()` sees (`retention.js:225-246`). Iga töö käivitus küsib seetõttu samu vanimaid ridu (`retention.js:414-433`).

**Mõju.** Kui hoiatusaknas on rohkem juhtumeid kui batch’i suurus, täidavad juba hoiatatud vanemad read iga uue batch’i. Uuemad juhtumid võivad hoiatuseta jääda kuni vanemad read kustutusaknasse liiguvad.

**Vastuvõtukriteerium.** Valik peab välistama juba hoiatatud juhtumid või kasutama edenemiskursorit. Test peab looma rohkem kõlblikke ridu kui batch’i suurus ja tõendama, et korduvad käivitused jõuavad kõigini täpselt üks kord.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- Parandus: `findCasesDueForWarning()` loeb nüüd **lehthaaval** (`skip`), filtreerib igalt lehelt juba hoiatatud juhtumid välja ja kogub, kuni `limit` **hoiatamata** rida on koos või allikas saab otsa. Ülempiir `WARNING_SCAN_PAGES = 20` hoiab ühe käivituse skaneeringu piiratuna; edasi jõuab järgmine käivitus.
- „Allikas on otsas" otsust teeb **toorete ridade** arv, mitte elusate oma: `alive` on juba kustutatud juhtumitest puhastatud ja lühem `alive` tähendaks ekslikult „rohkem ei ole". Sellele on eraldi test.
- **Ühe koha reegel dedupe-võtmele:** `lib/notifications.js` eksportib nüüd `notificationDedupeKey()` ja `createNotificationEvent` kasutab sama funktsiooni. Kui eelfilter ehitaks stringi ise, läheks kaks kuju esimese muudatusega lahku ja tagajärg oleks vaikne — dedupe töötaks edasi, aga eelfilter ei leiaks midagi.
- Testid (`tests/casework/retention.test.js`, 3 uut): 7 juhtumit hoiatusaknas, batch 3 → käivitused annavad 3 + 3 + 1 hoiatust, iga juhtum saab **täpselt ühe**, neljas käivitus 0; eraldi test tõendab, et juba hoiatatud read ei võta batch'i kohti; kolmas katab vahepeal kustunud juhtumi.
- **Test-infra parandus, ilma milleta test valetaks:** säilituse fake-DB `findMany` ignoreeris `skip`-i ja `orderBy`-d. Sellisena „läbis" iga lehitsev päring testi ka siis, kui ta annab alati sama esimese lehe — täpselt see viga, mida SOL-CW-07 kirjeldab. Enne fake'i parandamist kukkusid uued testid läbi täpselt parandus-eelse mustriga (teine käivitus: 0 hoiatust), mis on ühtlasi tõend, et testid mõõdavad õiget asja.
- **runtime: not_run** — päris PostgreSQL-i ja ajastatud töö vastu ei mõõdetud (vt ka SOL-CW-14, ajastus ise on eraldi lahtine).

### SOL-CW-08 — tundmatu `retentionState` muutub kliendivea asemel 500-ks — P2

**Tõend.** `app/api/casework/cases/route.js:19-25` edastab URL-i suvalise `retentionState` väärtuse. `lib/casework/caseWorkAssist.js:276-295` annab selle valideerimata Prisma enum-filtrisse. Veakaardistus käsitleb tulemust üldveana.

**Mõju.** Vigane päringuparameeter tekitab serverivea, halvendab API lepingut ja toodab eksitavat veaseiret.

**Vastuvõtukriteerium.** Lubada ainult `ACTIVE`, `READ_ONLY`, `ARCHIVED` või parameetri puudumine ning tagastada muul juhul 400. Lisada route’i negatiivne test.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- Parandus: `listCaseWorkAssists()` valideerib `retentionState` väärtuse (`normalizeRetentionStateFilter`) enne päringut. Tundmatu väärtus → **400** `casework.errors.retention_unknown`.
- Valideerimine on **teenuskihis, mitte marsruudis** — sama põhjendus mis `normalizeDate`-il samas failis ja sama muster mis omanikupiiril (leping L2): kaks kontrolli tähendaks kaht tõde ja üks neist vananeks.
- **Uut tõlkevõtit ei loodud:** `casework.errors.retention_unknown` oli juba olemas ja seda kasutab `transitionRetention` täpselt sama asja kohta.
- Väiketähtedega väärtust **ei normaliseerita vaikselt** — vaikne normaliseerimine tähendaks, et kaks eri URL-i annavad sama tulemuse ja klient ei saa kunagi teada, et ta küsis vale asja.
- Testid (`tests/casework/caseListFilter.test.js`, 4 uut): tundmatu väärtus annab 400 **ja andmebaasi ei puututa üldse**; väiketäht annab 400; kõik kolm lubatud seisu jõuavad `WHERE`-i; puuduv/tühi parameeter ei lisa filtrit.
- **runtime: not_run** — päris HTTP-päringu staatust ei mõõdetud; tõend on teenuskihi tasemel.

### SOL-CW-09 — URL-i olek ei toeta lubatud brauseri tagasinuppu — P2

**Tõend.** `components/casework/CaseWorkShell.jsx:6-9` lubab tagasinupuga loendisse naasmist. Tegelik avamine kasutab `replaceState` (`CaseWorkShell.jsx:91-97`), mis kirjutab loendi ajalookirje üle. Komponent loeb URL-i ainult mount’imisel (`CaseWorkShell.jsx:83-89`) ega kuula `popstate` sündmust.

**Mõju.** Back viib tõenäoliselt eelnevale lehele, mitte juhtumiloendisse; edasi-/tagasinavigatsioon ei sünkroniseeri valitud juhtumit URL-iga.

**Vastuvõtukriteerium.** Kasutada päris navigatsiooni või `pushState` + `popstate` sünkroniseerimist. Brauseritest peab katma loend → detail → Back → loend → Forward → sama detail.

**Seis (13.08.2026): DONE — URL, vaade ja päris brauseriajalugu taastuvad kooskõlaliselt.**
- Juhtumi avamine kasutab `pushState`-i ja komponent kuulab `popstate`-i; detaili sulgemine kasutab enda lisatud kirje korral `history.back()`-i ning otselingi erand eemaldab juhtumiparameetri `replaceState`-iga ilma kasutajat platvormilt välja viimata.
- Production-build käivitati eraldi kohalikul pordil 3101 `CASEWORK_V1_ENABLED=1` abil ja rada läbiti autentitud sünteetilise `ai.specialist.a@sotsiaalai.test` kontoga. URL `?filter=aktiivne&section=cases` säilis juhtumi avamisel; päris Back taastas sama sektsiooni ja filtriga loendi ning Forward sama juhtumi detaili. Kõigis kolmes olekus oli vaade olemas, vale sektsiooni ega valget vaadet ei tekkinud ja brauserikonsoolis polnud vigu.
- Sama `filter`, `section` ja `juhtum` parameetritega otselink avati eraldi uues brauserivahekaardis ning see taastas kohe sama detaili. Testiks loodud kohalik sünteetiline juhtum kustutati pärast kontrolli.
- `tests/casework/caseListState.test.js` jäi muutmata koodipuul 11/11 roheliseks; selle kuus CW-09 kontrolli katavad lisaks ajaloopinu, otselingi erandi, kordusavamise no-op-i ja `popstate` kuulaja elutsükli.

### SOL-CW-10 — „Näita rohkem” lubab paralleelseid sama kursori päringuid — P3

**Tõend.** `components/casework/CaseWorkShell.jsx:228-231` ei keela nuppu laadimise ajal. `load()` lisab vastuse olemasolevale loendile (`CaseWorkShell.jsx:59-69`).

**Mõju.** Kiire topeltvajutus võib saata sama kursoriga kaks päringut ja lisada samad read kaks korda.

**Vastuvõtukriteerium.** Keelata nupp aktiivse laadimise ajal või deduplikeerida read ID järgi; UI-test peab katma kaks samaaegset klõpsu.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- Parandus **mõlemat teed**, mitte ühte: „Näita rohkem" on laadimise ajal keelatud (`disabled={state === "loading"}`) **ja** lehe liitmine käib ID järgi (`mergeCaseRows`).
- Deduplikatsioon on teine kaitse teadlikult: kursoripõhine loend võib sama rea uuesti tuua ka siis, kui kirje vahepeal muutus ja lehe piirile nihkus — ja siis ei ole topeltklõpsu süüd kuskilt otsida.
- Kordumisel jääb alles **uuem** versioon, aga rea **asukoht ei muutu** — muidu hüppaks rida kasutaja silme all.
- Testid (`tests/casework/caseListState.test.js`, 3 CW-10 testi): sama kursori kaks vastust ei tekita topeltridu; kordumisel võidab uuem, asukoht püsib; tühi/vigane leht ei riku loendit. Pinna leping kontrollib nupu `disabled` tingimust.
- **runtime: not_run** — päris brauseris kahte samaaegset klõpsu ei tehtud; tõend on liitmisfunktsiooni ja pinna lepingu tasemel.

### SOL-CW-11 — tagasivõetud või saatmata päritoluobjektist saab endiselt juhtumi luua — P1

**Tõend.** `resolveOrigin()` kontrollib eelpöördumisel ainult `id + recipientOwnerId` ning kiire abi pöördumisel ainult aktiivset lauakuuluvust (`lib/casework/caseWorkAssist.js:224-249`). Ta ei kontrolli eelpöördumise `recalledAt`, `sentAt` ega staatust ning kiire abi pöördumise staatust/aegumist. Päritolu lugemine ja juhtumi loomine toimuvad eraldi päringutena väljaspool ühist lukku või tehingut (`:380-399`). Fake-DB kontroll lõi edukalt juhtumi eelpöördumisest, mille seis oli `DRAFT` ja `recalledAt` määratud.

**Mõju.** Töötaja saab otse-API kaudu teha juhtumi sisust, mille saatja on tagasi võtnud või mida talle pole kehtivalt saadetud. Ka õiguspärane lähteobjekt võib kontrolli ja loomise vahel tagasi võetud/aegunud olekusse liikuda.

**Vastuvõtukriteerium.** Päritolu kõlblikkus peab kasutama sama kanoonilist nähtavus-/elutsüklifiltrit mis lähteobjekti töövoog ning kontroll ja loomine peavad olema sama lukustatud tehingu sees. Testida DRAFT, SENT, RECALLED, EXPIRED, RESOLVED ja kontrolli ajal toimuvat tagasivõttu.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- **Kanooniline filter tuleb nüüd lähteobjekti enda töövoost.** `lib/preInquiries.js` eksportib `recipientVisiblePreInquiryWhere(userId)` (adressaat olen mina · saatja EI OLE tagasi võtnud · pöördumine on päriselt saadetud) ja `visiblePreInquiryWhere` kasutab sama funktsiooni. `resolveOrigin()` kutsub teda, mitte oma koopiat — kaks koopiat tähendaks, et üks jääb muutmisel maha.
- Kiire abi pöördumisel lisandus `status: { notIn: ORIGIN_BLOCKED_URGENT_STATUSES }`.
- **Kontroll ja loomine on nüüd ühes tehingus** ja päritolukontroll tehakse **teist korda pärast `INSERT`-i**. PostgreSQL READ COMMITTED annab igale lausele värske hetktõmmise, seega vahepeal commit'itud tagasivõtt on järelkontrollis nähtav ja kogu tehing veereb tagasi. Ilma järelkontrollita jääks aken kontrolli ja kirjutuse vahele lahti.
- Testid (`tests/casework/caseWorkAssist.test.js`, 7 uut): DRAFT → 404 · RECALLED → 404 · SENT/READY/DOWNLOADED/ARCHIVED → lubatud · kiire abi RECALLED → 404 ja SENT/READ/TAKEN/DECLINED/RESOLVED/EXPIRED → lubatud · võõra laua pöördumine → 404 · **kontrolli ja loomise vahel toimunud tagasivõtt veeretab juhtumi tagasi** · päritoluta rada B jääb tööle.
- **Test-infra parandus, ilma milleta uued testid ei tõendaks midagi:** vana fake-DB `preInquiry.findFirst` ignoreeris `recalledAt`-i ja `sentAt`-i täielikult ning `urgentRequest.findFirst` võrdles ainult `id`-d. Fake sai päris filtrihindaja, `$transaction`-i tagasiveeremisega ja `beforeCreate` konksu TOCTOU akna simuleerimiseks. Kaks olemasolevat testi kukkusid selle peale läbi, sest nende fikstuurides polnud `sentAt`-i — nad tuginesid puuduvale kontrollile. Fikstuurid parandatud kehtivalt saadetud pöördumiseks.

**Teadlik otsus, mille omanik võib ümber pöörata.** `EXPIRED`, `RESOLVED` ja `DECLINED` kiire abi pöördumisest **saab** juhtumi luua; ainult `RECALLED` on keelatud. Põhjus: laud näeb neid endiselt oma järjekorras (`lib/urgent/deskQueue.js` toob kõik laua read), ja kui juhtumi loomine neist keelduks, ütleksid järjekord ja juhtumipind eri tõde. Kitsam reegel on ühes konstandis (`ORIGIN_BLOCKED_URGENT_STATUSES`).

### SOL-CW-12 — juhtumi loomise kordus võib tekitada ühest lähteobjektist mitu juhtumit — P2

**Tõend.** `POST /api/casework/cases` ei võta idempotentsusvõtit (`app/api/casework/cases/route.js:33-50`) ja `createCaseWorkAssist()` teeb iga kutse peale tingimusteta `create` (`lib/casework/caseWorkAssist.js:362-402`). Skeemis on `preInquiryId` ja `urgentRequestId` ainult indekseeritud, mitte unikaalsed (`prisma/schema.prisma:6454-6459`). Sama fake-DB kontroll lõi sama `preInquiryId` väärtusega järjest kaks eri juhtumit.

**Mõju.** Topeltklõps, võrgu timeout või kliendi korduskatse võib teha samast pöördumisest mitu sõltumatult muutuvat juhtumit. Hilisem märge, säilituskell ja STAR2 ülekanne jagunevad eri tõdede vahel.

**Vastuvõtukriteerium.** Loomine vajab kasutajapõhist idempotentsusvõtit koos payload'i sõrmejäljega; kui tooteleping lubab ühest lähteobjektist ainult ühe juhtumi omaniku kohta, peab seda jõustama ka DB unikaalsus. Testida sama võti/sama sisu, sama võti/eri sisu ja kaks paralleelset päringut.

**Omaniku otsus (09.08.2026).** Üks juhtum lähteobjekti kohta **+** idempotentsusvõti — mõlemad, mitte kumbki eraldi.

**Seis (09.08.2026): DONE — kood, migratsioon ja testid; migratsiooniahel tõendatud päris PostgreSQL-i vastu, rakenduse runtime: not_run.**
- **Jõustaja on INDEKS, mitte teenuskihi eelkontroll.** Migratsioon `20260809120000_jta_v1_case_origin_idempotency` lisab `CaseWorkAssist`-ile veeru `clientActionId` ja kolm unikaalset indeksit: `(ownerUserId, preInquiryId)`, `(ownerUserId, urgentRequestId)`, `(ownerUserId, clientActionId)`. Eelkontroll ei aita — kaks paralleelset päringut jõuaksid mõlemad temast läbi. Teenuskiht **püüab kinni** andmebaasi vastuse (`P2002`), ta ei asenda seda.
- **NULL ei põrka, ja see on osa lepingust.** PostgreSQL loeb unikaalses indeksis NULL-id eristuvaks. Seetõttu: päritoluta juhtumeid (rada B) piirang ei puuduta · **sama pöördumisest võib juhtumi teha kaks eri töötajat** (piirang on `(omanik, lähteobjekt)`, mitte lähteobjekt üksi — muidu lukustaks esimene töötaja pöördumise kõigi teiste eest) · võtmeta vana klient töötab edasi, kaotades ainult korduskaitse.
- **Migratsioonis on värav ENNE indekseid.** Unikaalne indeks olemasolevate duplikaatide peal kukuks läbi Postgresi enda sõnumiga, mis nimetab indeksi, mitte põhjust. `DO $$` plokk loeb duplikaatsed `(omanik, lähteobjekt)` paarid kokku ja katkestab nimelise tõrkega. **Andmeid see migratsioon ei kustuta** — kumb kahest juhtumist alles jääb, ei ole migratsiooni otsustada.
- **Kaks eri konflikti, kaks eri vastust** (`resolveCreateConflict`): sama `clientActionId` **ja sama sisu** → tagastatakse **sama juhtum**, mitte viga (topeltklõps, võrgu korduskatse) · sama võti **eri sisuga** → `409 create_action_key_conflict`, sest vana võti uue sisu all on uus tegu vana nime all (sama reegel mis SOL-CW-06 kopeerimisauditil) · sama lähteobjekt uue võtmega → `409 origin_already_has_case`, sest see on **teadlik** teine katse ja peab olema nähtav, mitte vaikselt esimeseks juhtumiks tõlgitud.
- **Võti peab kliendist ka päriselt tulema.** `POST /api/casework/cases` võtab `clientActionId` vastu ja loomisvorm (`CaseWorkShell.jsx`) saadab selle. Keelatud nupp katab ainult topeltklõpsu ühes brauseris; võrgu timeout ja kliendi korduskatse jõuavad serverini siis, kui nupp on juba vabastatud. Võti on seotud **selle sisuga**, mida saadetakse: muutmata sisuga korduskatse kasutab sama võtit, iga väljamuutus tühistab võtme — muidu vastaks server kasutaja parandatud sisule 409-ga.
- **Üks generaator kahele kasutajale.** `newClientActionKey()` kolis `components/casework/caseWorkClient.js`-i; kopeerimisaudit (L22) ja juhtumi loomine kasutavad sama kuju ja sama `randomUUID`-varuteed (HTTP-leht ja vanem WebView). Kaks koopiat tähendaks, et üks jääb parandamata.
- **Testid** (`tests/casework/caseWorkAssist.test.js`, 7 uut): sama võti + sama sisu → sama juhtum (ka SUURTÄHTEDEGA kirjutatud võti, sest võti normaliseeritakse) · sama võti + eri sisu → 409 ja esimese juhtumi sisu ei muutu · **kaks paralleelset päringut** → üks juhtum · sama lähteobjekt teist korda → 409 · kaks töötajat sama pöördumisest → kaks juhtumit · päritoluta ja võtmeta read ei põrka · vigane võtmekuju → 400, mitte 500. Pinna leping: `tests/casework/caseListState.test.js`. Jagatud generaator, sh varutee ilma `crypto`-ta: `tests/casework/transferUi.test.js`.
- **Paralleelsuse test on barjääriga, mitte lootusel.** Mõlemad kutsed hoitakse kinni kuni hetkeni, mil **mõlemad** on kõik eelkontrollid läbinud, ja alles siis lastakse nad kirjutama. Just seda olukorda eelkontroll ei püüa.
- **Test-infra parandus, ilma milleta uued testid ei tõendaks midagi:** fake-DB `caseWorkAssist.create` ei tundnud unikaalseid indekseid — iga idempotentsuse test oleks läinud roheliseks ka siis, kui migratsiooni poleks olemas. Fake sai indeksikontrolli INSERT-i hetkel (koos NULL-eristusega) ja tehingu tagasiveeremine eemaldab nüüd täpselt selles tehingus kirjutatud read, mitte ei taasta hetktõmmist — hetktõmmis kustutaks paralleelse tehingu töö ja paralleelsuse test mõõdaks fake'i artefakti.
- **Negatiivkontroll (09.08.2026):** fake-indeksi väljalülitamisel kukkus neli SOL-CW-12 testi (sh paralleelsuse oma) läbi; sisselülitatuna 31/31. Roheline tuleb jõustusest, mitte testi kujust.
- **Tõend päris PostgreSQL-i vastu:** `npm run db:migrate:check` → kogu 136-migratsiooniline ahel, uus migratsioon kaasa arvatud, rakendus tühjale PostgreSQL-ile ja `prisma migrate status` andis „Database schema is up to date!". `npx prisma validate`: läbitud. `npx prisma generate` tehtud — genereeritud klient kannab `clientActionId` välja ja kõiki kolme unikaalset sisendit.
- **Tõend TOOTMISEST (09.08.2026 16:53, deploy `ff4547b9`):** migratsioon rakendus päris tootmisandmebaasile ilma väravat käivitamata (`CaseWorkAssist` oli ja on tühi, 0 rida) ning `pg_indexes` kannab kõiki kolme unikaalset indeksit: `CaseWorkAssist_ownerUserId_preInquiryId_key`, `..._urgentRequestId_key`, `..._clientActionId_key`.
- **runtime: not_run** — rakenduse päris loomisrada kahe samaaegse HTTP-päringuga sisselogitud brauserist läbi ei käidud (juhtumitöö värav on tootmises väljas). Indeksi olemasolu on tõendatud tootmises, tema jõustuskäitumine migratsiooniahela ja fake-DB tasemel, teenuskihi tõlgendus fake-DB tasemel.
- Kontroll: `npm test` **3185/3185**, `npm run i18n:check` OK, `npx eslint` puhas.

### SOL-CW-13 — „aktiivsed ettevalmistused” ei loe kohtumise ettevalmistusi — P2

**Tõend.** Workbench'i `activePreparations` sektsioon kutsub `listCaseWorkAssists()`-i ja kuvab kuni 25 ACTIVE juhtumit koos tekstiga `preparations_not_yet` (`lib/casework/workbench.js:291-307`). `CaseWorkMeetingPrep` teenus ja API on juba olemas, kuid sektsioon ei kasuta `listMeetingPreps()`-i ega ühtegi prep-päringut. Test kinnitab placeholder'i notice-võtme olemasolu, mitte tegelikke ettevalmistusi (`tests/casework/workbench.test.js:130-149`, test 6).

**Mõju.** Laud nimetab iga aktiivse juhtumi ettevalmistustööks ja samal ajal ei erista päriselt alustatud või läheneva kohtumise ettevalmistust. Töötaja prioriteediloend on sisuliselt vale.

**Vastuvõtukriteerium.** Sektsioon peab tulema omaniku-skoobitud `CaseWorkMeetingPrep` lugejast, määratlema aktiivsuse/ajalise prioriteedi ning tagastama minimaalse deskriptori. Testida juhtum ilma prep'ita, mitu prep'i, purge'itud prep ja võõra omaniku rida.

**Seis (09.08.2026): DONE — kood ja testid; runtime: not_run.**
- **Uus omaniku-skoobitud lugeja** `listActiveMeetingPrepsForOwner()` (`lib/casework/caseWorkMeetingPrep.js`). Olemasolev `listMeetingPreps()` on juhtumipõhine ja lauale ei kõlba — laud vajab ridu **üle** juhtumite, aga sama omanikupiiriga. Skoop tuleb vanemalt: `caseWorkAssist: { ownerUserId, retentionState: ACTIVE }`.
- **Aktiivsus on kolm tingimust, igaühel oma põhjus:** juhtum on `ACTIVE` (READ_ONLY/ARCHIVED juhtum on laualt läinud — sama reegel mis mustanditel, SOL-CW-03) · sisu ei ole purge'itud (`contentPurgedAt` tähendab, et töötaja arhiveeris töömaterjali; juhtumi pinnal jääb marker nähtavaks, laual ei ole tal midagi öelda) · kohtumine ei ole möödas.
- **Ajaline prioriteet: lähim kohtumine ees** (`meetingAt ASC, nulls last`, siis `updatedAt DESC, id DESC`). See on vastupidine `listMeetingPreps()`-ile, kus uusim ees on juhtumi **ajalugu** — laud on tööjärg, mitte ajalugu. `nulls: "last"` on kohustuslik: ilma temata upuksid ajata plaanid Postgresis `ASC` sortimisel ette ja tõrjuksid homse kohtumise silma alt.
- **Piir on Eesti kalendripäeva ALGUS, mitte `now`,** ja ta tuleb kutsujalt (`from`), mitte lugejalt. Kell 09:00 algav kohtumine ei tohi laualt kaduda 09:01, kui töötaja alles istub selles. Laud annab sama `day.start`, mille peal seisab sektsioon #2.
- **Ajata ettevalmistus jääb alles.** `meetingAt: null` on plaan ilma kuupäevata — pooleliolev töö, mille kadumine oleks vaikne andmekadu. Ta seisab loendi lõpus, sest kella tal ei ole.
- **Deskriptor muutus:** `caseId · label · nextContactAt · openMissingInfoCount` → **`prepId · caseId · label · meetingAt · openMissingInfoCount`**. `meetingAt`, mitte `nextContactAt`: sektsiooni kell on kohtumise oma ja juhtumi järgmist kontakti kuvavad juba #2 ja #6 — kaks eri kella ühel real näitaksid ühte aega. Pinnal on rea võtmeks nüüd `prepId`, sest ühel juhtumil võib olla mitu kohtumist ja `caseId` andis React'ile korduva võtme. Leping (`jta-v1-arendusleping.md` deskriptoritabel ja testilepingu punkt 6) on muudetud koos koodiga.
- **Placeholder-hoiatus kadus koos oma põhjusega.** `casework.workbench.preparations_not_yet` ütles „need on juhtumid, mitte veel ettevalmistused" — see ei ole enam tõsi. Võti on eemaldatud kõigist kolmest sõnastikust. L12 tabel lubas selle sektsiooni täiskujule juba E3-ga; E3 tuli ja läks, sektsioon jäi E1 kitsendusse.
- **Silt tuleb juhtumilt, ühe hulgipäringuga.** Kuvanime reegel (L10) elab `caseDisplayLabel`-is ja teine koopia läheks temast lahku. Pesastatud valik toob AINULT sildi neli välja ja tal on **oma** select (`OWNER_PREP_SELECT`) — `PREP_SELECT`-i laiendamine oleks toonud kliendi identiteedi ka `getMeetingPrep()` väljundisse, kus tal ei ole asja (L20).
- **Testid** (`tests/casework/meetingPrep.test.js`, 8 uut): juhtum ilma prep'ita → tühi · mitu prep'i → lähim ees, ajata viimane · purge'itud prep ei ole tööjärg · võõra omaniku rida ei jõua kohale (ja omanikuta kutse ei anna kellegi ridu) · READ_ONLY ja ARCHIVED juhtumi prep on laualt läinud · möödunud kohtumine kaob, tänane jääb terveks päevaks · silt tuleb juhtumilt ja kustutatud kliendiviide võidab (üks kasutajapäring, mitte N) · deskriptori võtmed ja limiit. Laua tasemel (`tests/casework/workbench.test.js` test 6) on ümber kirjutatud: aktiivne juhtum ilma ettevalmistuseta annab `EMPTY` ja `notice` on `null`.
- **Test-infra:** laua fake-DB sai `caseWorkMeetingPrep.findMany`-i, mis nõuab skoopi vanemalt (`requireOwner`) — skoobita lugeja kukub fake'i peal, mitte alles toodangus. Lugeja enda testidel on **eraldi** fake, mis hindab päriselt pesastatud filtrit, `contentPurgedAt`-i, `OR`-i ja `nulls: "last"` järjestust; ülemine lame fake oleks lasknud kõik read läbi ja iga test oleks läinud roheliseks ka skoobita lugeja peal.
- **Teadlik otsus, mille omanik võib ümber pöörata.** Möödunud kohtumise ettevalmistus **kaob** laualt. Alternatiiv oleks „üle tähtaja" märgis, mille L3 sõnaselgelt keelab (laud ei loenda töötajat). Juhtum ise jääb alles ja tema ettevalmistus on juhtumi pinnal.
- **runtime: not_run** — laual päris ettevalmistustega sisselogitud brauserist läbi ei käidud; juhtumitöö värav on tootmises väljas.
- Kontroll: `npm test` **3193/3193**, `npm run i18n:check` OK, `npx eslint` puhas.

### SOL-CW-14 — casework'i säilitustöö ajastatud käivitamine ei ole tõendatud — P1, runtime NOT_PROVEN

**Tõend.** `runRetention()` rakendab purge'i, hoiatuse ja kustutuse (`lib/casework/retention.js:376-454`), kuid tootmiskoodi otsing leiab sellele väljakutse ainult käsitsi käivitatavast `scripts/casework-retention.mjs` failist ja testidest. `package.json` pakub käsitsi npm-käsud; skripti päises on cron'i näide, mitte repositooriumi hallatav ajastus (`scripts/casework-retention.mjs:19-27`). Rakenduse üldine retention-cleanup ei kutsu casework'i worker'it.

**Mõju.** Kui serverivälist cron'i pole eraldi paigaldatud, ei kustu ülekantud mustandite sisu 12 kuu järel, arhiveeritud juhtumid ei saa hoiatust ega kustu tähtajal. Koodis olev säilitusreegel ei muutu iseenesest päris tööks.

**Vastuvõtukriteerium.** Hallatav deploy-konfiguratsioon peab paigaldama lukustatud, monitooritud ja retry'ga ajastuse ning smoke peab tõendama viimase eduka jooksu, järgmise jooksu ja alarmi. Stagingus tuleb läbida tähtaja mõlemad pooled ning nurjunud rea taastumine.

**Seis (13.08.2026): PARTIAL — omaniku kinnitatud säilituspoliitika on koodis, kasutajatekstides, privaatsusteavituses, raamlepingus ja hallatavas ajastuses vastuoludeta ning kohalikult väljalaskevalmis; tootmistaimeri aktiveerimine ja kontrollitud systemd-jooks on runtime: NOT_PROVEN.**
- **Ajastus elab nüüd repositooriumis:** `deploy/systemd/sotsiaalai-casework-retention.{service,timer}`. Ajastus, mis elab ainult ühe masina crontabis, ei ole platvormi oma — ja just tema puudumine oli see, mis jäi märkamatuks.
- **Lukk** on `flock -n /var/lock/…` teenusefailis, mitte ainult systemd'i instantsipiir: käsitsi käivitatud `npm run casework:retention` ei tea systemd'ist midagi. Lisaks `TimeoutStartSec=900` — kinni jäänud jooks hoiaks LUKKU ja kõik järgmised jooksud jääksid vaikselt tegemata.
- **Retry tuleb taimerilt,** sest `Type=oneshot` ei tohi `Restart`-i kanda: `OnCalendar=hourly` + `Persistent=true`. Tunnipõhine, mitte öine — kord ööpäevas tähendaks, et üks kukkunud jooks lükkab säilituse 24 tundi edasi; töö ise on idempotentne ja partii piiratud, seega tund on odav. `Persistent=true` teeb vahelejäänud jooksu järele: säilitustähtaeg ei oota hooldusakent.
- **Monitooring on ANDMEBAASIS** (`CaseWorkRetentionRun`, migratsioon `20260809180000`). Rida tekib **enne** tööd: lõpus kirjutatud rida ei jätaks protsessi tapmisest mingit jälge — keset partiid surnud töö näeks välja täpselt nagu töö, mis ei käivitunudki. Kaks `CHECK`-i: loendurid ei ole negatiivsed ja **lõpetamata jooks ei saa olla `ok`**.
- **Isikuandmeid jooksureal ei ole** ja erindi **teadet ei salvestata** — ainult klass ja kood. Prisma paneb ebaõnnestunud päringu argumendid teatesse ja mõni teenuskiht kirje teksti (sama põhjendus mis laual, L13).
- **Smoke** `npm run casework:retention:smoke` väljastab kriteeriumi kolm asja nimeliselt — **viimane edukas jooks**, **järgmine jooks**, **alarm** — ja alarm on **väljumiskood 1**, mitte ilus lause. Smoke, mis lõpeb alati koodiga 0, ütleb monitooringule „kõik hästi" ka siis, kui töö on kuu aega seisnud.
- **Alarmi lävi on AJAS, mitte jooksude arvus:** „viimasest õnnestumisest üle kahe intervalli". Jooksude arv eeldab, et keegi teab intervalli — ja just intervalli muutmine on see, mis järelevalve vaikselt katki teeb. Kaks vahelejäänud jooksu, mitte üks: üks on taaskäivitus ja temast alarmi tegemine õpetab inimest alarmi eirama.
- **Kaks olukorda, mis EI ole alarm ja mille kohta smoke ütleb seda välja:** värav väljas (`CASEWORK_V1_ENABLED`) → väljas funktsioonil ei ole midagi säilitada; ja **kuiv käivitus ei kõlba tõendiks** — `dryRun` jooks ei kirjuta midagi ja kui ta loeks „viimaseks õnnestumiseks", näitaks tervis rohelist töö kohta, mida ei tehtud.
- **Deploy paigaldab unit-failid** (`scripts/deploy-server.mjs`: kopeerib, `daemon-reload`, teatab muutusest) **ja EI luba taimerit sisse.** See on teadlik: kinnitatud väljalaskerada on preflight → kuivjooks → alarm/smoke → aktiveerimine → üks kontrollitud päris jooks → viimase edu, järgmise jooksu ja journal'i kontroll. Unit-failide olemasolu ei aktiveeri midagi; lubamine on üks käsk ja ta on dokumenteeritud (`deploy/systemd/README.md`).
- **Testid** (`tests/casework/retentionSchedule.test.js`, 15): tervis mõlemast otsast (värske jooks → OK; üks vahelejäänud jooks **ei ole** alarm, kaks on; lävi täpselt piiril) · ükski jooks kunagi → `NEVER_RUN`, mitte vaikne OK · jooksud käivad aga ei õnnestu → ALARM · rida tekib enne tööd ja pooleli jäänud jooks ei ole `ok` · tõrgetega partii ei ole edukas jooks · erindi teadet ei salvestata · kuiv käivitus ei tee tervist roheliseks · ajastuse leping (lukk, `Persistent`, timeout, ei ühtegi `Restart=`) · deploy paigaldab aga ei luba · smoke on olemas ja alarm jõuab väljumiskoodi · käivitaja suleb jooksurea ka kukkumisel · runtime-sond peab käivitama päris säilitustöö tähtaja mõlemal poolel ja taastuma reatõrkest. Koos `retention.test.js`-iga **41/41**.
- **Runtime-sond 13.08: `npm run casework:retention:probe`, 28/28 päris PostgreSQL-i vastu.** Sond loob **visatava** andmebaasi (`sotsiaal_ai_retention_probe_<ts>`), rakendab talle kogu migratsiooniahela, mõõdab ja kustutab ta ära — arendus- ega tootmisbaasi ta ei kirjuta. Koristust **kontrollitakse** (`pg_database`), mitte ei eeldata.
- **Mida sond tõendab ja `npm test` ei saa:** lisaks mõlemale DB `CHECK`-ile, UTC-kokkuleppele ja smoke'i päris väljumiskoodidele käivitab sond nüüd `runRetention()`-i päris PostgreSQL-is. Mustandi ning arhiveeritud juhtumi rida **üks millisekund tähtaja eel säilib**; täpselt tähtajal mustandi sisu purge'itakse ja tõendirida jääb, juhtum kustub päris DB-kaskaadiga koos auditiga. Ühe sünteetilise juhtumi kustutus süstitakse esimesel jooksul tõrkesse: partii loendab vea ja jätab rea alles; **järgmine jooks leiab sama rea ning kustutab selle koos auditiga**.
- **Ajavöönd on eraldi mõõdetud** (`B1`): rakenduse kirjutatud hetk ja andmebaasi `NOW() AT TIME ZONE 'UTC'` langesid kokku 0,0 s täpsusega. Ilma selleta mõõdaks kogu ülejäänud sond arendusmasina ajavööndit (+3) — kolme tunni vanune rida näeks värskena ja iga läve-mõõtmine oleks väljamõeldis.
- **Negatiivtõend enne parandust:** uus poliitika kooskõla test kukkus lähtepuul **0/4**: mustandi kasutajatekst ei nimetanud 12 kalendrikuud, avalik privaatsusteavitus ei maininud CaseWork'i, raamlepingus puudus ainult lühemat tähtaega lubav erireegel ja privaatsusversioon ei eristanud sisulist muudatust. Pärast parandust **4/4**. Varasem runtime-sondi negatiivkontroll kukkus vana sondi peal **14/15**, sest sond ei käivitanud päris säilitustööd; pärast sondi laiendust **15/15**.
- **Tootmis-runtime 13.08, ainult koondseis ja unit-staatus:** serveri HEAD `aa73e35d`, tracked tööpuu puhas; paigaldatud service ja timer on **disabled / inactive**, `LastTriggerUSec` ja `NextElapseUSecRealtime` on tühjad, `list-timers` 0 ning service-journal 0 rida. `/etc/sotsiaalai/frontend.env`-is `CASEWORK_V1_ENABLED` puudub. Kaks käsitsi **dry-run** kontrolli tegid 0 purge'i, 0 väljakustutust, 0 hoiatust, 0 juhtumikustutust ja 0 viga; need jätsid ausad operatsioonilised dry-run jooksulogi read, kuid kasutajate sisu ei loetud ega muudetud. Smoke teenuse keskkonnas: `ALARM`, viimane edukas jooks `—`, viimane jooks `2026-08-13T15:15:32.631Z`, tuletatud järgmine `2026-08-13T16:15:32.631Z`; väljas värava tõttu lõppes kontroll koodiga 0. Taimerit, lippu ega unit-faile ei muudetud.
- **Omaniku kinnitatud poliitika on nüüd kanooniliselt kirjas:** arhiveeritud privaatne juhtum kustub 12 kalendrikuud pärast arhiveerimist; hoiatus on 30 päeva enne; üleantud mustandi sisul on sama 12 kalendrikuu ülempiir; organisatsioon võib lepingus valida ainult lühema tähtaja. `lib/casework/flags.js` kirjeldab lippu nüüd kontrollitud väljalaskepiirina, mitte lahendamata säilitusotsuse asendajana. Privaatsusteavituse sisulise muudatuse versioon on `2026-08-13.1`.
- **Alles (NOT_PROVEN):** integraatori tootmisväljalase peab läbima `preflight → dry-run → alarm/smoke → enable → üks kontrollitud systemd-jooks → viimane edu / järgmine jooks / service-journal`. Kohalik visatav PostgreSQL tõendab koodi ja DB-invariante, kuid ei teeskle aktiveeritud tootmistaimerit. Eelmine tootmiskoond ülal ei ole selle ploki järel uuesti mõõdetud.
- Kontroll: säilituse sihttestid **45/45**, registreerimise nõustumistestid **6/6**, `npm run casework:retention:probe` **28/28** päris PostgreSQL-is, ajutise andmebaasi koristus 0 allesjäänud rida; i18n, lint ja diff-check läbitud.

### SOL-CW-15 — kohtumise „kustutamatu” märkme sisu saab jäljetult muuta ja täielikult eemaldada — P1

**Tõend.** Märkme konteineri DELETE puudub põhjendusega, et märge on toimunud kohtumise jälg (`lib/casework/caseWorkMeetingNote.js:30-32`, `:259-260`). Samal ajal lubavad `updateEntry()` ja `removeEntry()` teksti muuta või rea kõvasti kustutada ilma versiooni-, paranduse- või auditireata (`:308-372`); API avaldab mõlemad toimingud (`app/api/casework/cases/[caseId]/meeting-notes/[noteId]/entries/[entryId]/route.js:20-56`). UI pakub kustutamist, kuid mitte paranduste ajalugu (`components/casework/MeetingNoteSection.jsx:156-168`, `:320-329`).

**Mõju.** Kõik märkme sisuread saab ükshaaval eemaldada ja alles jääb tühi konteiner, mis näib endiselt kohtumise tõendina. Hilisema vaidluse või järelevalve korral pole võimalik eristada algset märget, parandust ja kustutamist.

**Vastuvõtukriteerium.** Pärast esmast salvestust peab muutmine olema auditeeritud parandus/tühistus, mis säilitab eelmise versiooni, tegija, aja ja põhjuse; kõva kustutus peab olema keelatud või rangelt erandlik. Negatiivtest peab tühjendama kõik read ja tõendama, et algne sisu/tõend jääb lubatud kujul taastatavaks.

**Seis (09.08.2026): DONE — kood, migratsioon ja testid; migratsiooniahel tõendatud päris PostgreSQL-i vastu, rakenduse runtime: not_run.**
- **Kõva kustutust EI OLE.** `removeEntry()` on kustutatud ja teenuskihis ei ole enam ühtegi teed, mis märkme rea andmebaasist maha võtaks. Asemel on `retractEntry()` — rida jääb alles, tema tekst läheb ajalukku ja aktiivselt pinnalt kaob ainult tekst.
- **Kolmas mudel:** `CaseWorkMeetingNoteEntryRevision` (migratsioon `20260809160000_jta_v1_note_entry_revisions`), mis kannab **asendatud** sisu — kihi, teksti, päritolu, järjekorra —, versiooninumbri, kohustusliku põhjuse, tegija ja aja. **Miks eraldi tabel, mitte väli kirje peal:** üks „eelmine tekst" väli kannaks ainult viimast muutust ja teine parandus kirjutaks esimese üle — lubadus „eelmine versioon säilib" katkeks vaikselt just korduvalt muudetud rea juures, kus teda kõige rohkem vaja on.
- **Kirje ise sai kaks välja:** `revision` (mitmes versioon) ja `retractedAt`. Pind ütleb mõlemad välja — parandatud rida kannab „parandatud N korda" märgist, tühistatud rida kannab tühistuse teadet.
- **Muutumatus on ANDMEBAASIS, mitte teenuskihi lubadus.** `BEFORE UPDATE` trigger `prevent_note_revision_update`, sama muster mis `UsageEvent`-il. `DELETE`-i trigger **ei** blokeeri ja see on teadlik: konto kustutus ja säilituse purge peavad kaskaadi kaudu läbi minema ning nemad viivad kaasa terve juhtumi, mitte üksiku tõendi. Piir on aus — sisu ei saa **muuta**, ta saab kaduda ainult koos juhtumiga.
- **Põhjus on kohustuslik kahel tasemel:** teenuskiht annab tühja põhjuse peale 400 õige veavõtmega, andmebaas keelab tühjuse `CHECK (btrim("reason") <> '')`-ga. Ainult teenuskihi kontroll kaitseks neid teid, mis temast läbi käivad — otse-SQL ja tulevane teine kutsuja ei käi.
- **API pind ei valeta.** `DELETE .../entries/<id>` on **eemaldatud**; tühistus on `POST .../entries/<id>/retract`. `DELETE`, mis ei kustuta, oleks vale lubadus täpselt seal, kus leid räägib pinna aususest — ja tegu vajab keha (`reason`), mida `DELETE`-il ei ole kombeks kanda. Uus lugeja `GET .../meeting-notes/<id>/revisions` on **ainult lugeja**, kirjutusteedeta.
- **Pind sai paranduste ajaloo,** mida tal varem ei olnud: iga parandus ja tühistus koos asendatud tekstiga, liigiga, ajaga ja põhjusega. Tühja ajaloo kohta öeldakse välja, et parandusi ei ole — kadunud plokk tähendaks, et lugeja ei tea, kas parandusi ei olnud või ei oska pind neid näidata. Tühistamise nupp on kinni, kuni **põhjus on kirjutatud**: kaheastmeline „kas oled kindel" ei tekita auditile midagi, ja ilma põhjuseväljata saaks töötaja 400 alles pärast otsust.
- **Tühistatud rida ei jõua STAR2-sse** ja see piir on `WHERE`-is, mitte kutsuja pool — tagasivõetud lause kandmine registrisse oleks tühistuse vaikne tühistamine.
- **Paralleelne parandus ei kaota teise teksti.** Uuendus on tingimuslik `revision` peal: kaks samast versioonist lähtuvat parandust kirjutaksid muidu kaks ajaloorida sama numbri alla ja teine kaotaks esimese teksti. Teine saab nüüd 409.
- **Testid** (`tests/casework/meetingNote.test.js`, 10 uut): parandus säilitab versiooni, tegija, aja ja põhjuse · põhjuseta parandus ei lähe läbi ega jäta poolikut jälge · **korduv parandus ei kirjuta esimest üle** · tühistus jätab rea alles ja tekst kaob pinnalt · tühistatud kirjet ei saa parandada ega teist korda tühistada · **auditi nõutud negatiivtest: kõik read tühistatud → märge ei ole tühi puutumata konteiner ja algne sisu on ajaloost taastatav** · tühistatud STAR2-kirje ei lähe ekspordisse · ajalugu on omanikupiiri sees ja kirjutusteedeta · paralleelne parandus annab 409 · migratsioonifail kannab triggerit ja `CHECK`-e. Lisaks marsruudileping (`routeContract.test.js`) ja pinna ohutusleping (`uiSafety.test.js`).
- **Test-infra:** märkme fake-DB sai ajaloo kollektsiooni, mille `updateMany` **viskab** — muidu oleks „append-only" testis ainult kokkulepe. `deleteMany` on lubatud, sest kaskaad peab läbi minema. Paralleelsuse test tagastab lugemisel **koopia**, mitte elava objekti: ilma selleta näeks kutsuja juba uut versiooni ja test mõõdaks fake'i, mitte võidujooksu.
- **Teadlik otsus, mille omanik võib ümber pöörata.** Kriteerium lubas ka „rangelt erandlikku" kõva kustutust; erandit V1-s **ei tehtud**. Iga erand vajab oma luba, oma auditit ja oma pinda, ja pool-ehitatud erand oleks tagauks. Kui ridu tuleb päriselt hävitada — eksikombel sisestatud kolmanda isiku andmed —, käib see juhtumi tasandi radu pidi (kliendiviite kustutus L17, säilituse purge), mis on auditeeritud ja mille kohta on omaniku otsus juba olemas.
- **Tõend päris PostgreSQL-i vastu:** `npm run db:migrate:check` → 137-migratsiooniline ahel, uus migratsioon kaasa arvatud, rakendus tühjale PostgreSQL-ile ja `migrate status` andis „Database schema is up to date!". `npx prisma validate` läbitud, klient genereeritud.
- **runtime: not_run** — päris brauseris parandust ja tühistust läbi ei käidud; juhtumitöö värav on tootmises väljas.
- Leping (`jta-v1-arendusleping.md` E4 plokk) on muudetud koos koodiga.
- Kontroll: `npm test` **3203/3203**, `npm run i18n:check` OK, `npx eslint` puhas.

### SOL-CW-16 — STAR2 kopeerimisaudit ei ole seotud kopeeritud tekstiversiooniga — P1

**Tõend.** Serveri plokk tagastab teksti ja `fieldKeys` loendi (`lib/casework/caseWorkTransfer.js:177-211`), kuid brauser saadab pärast lõikelauale kirjutamist auditisse ainult võtmed ja `clientActionId` (`components/casework/transferFlow.js:44-85`). `recordCopyEvent()` kontrollib, et samanimelised väljad praegu eksisteerivad, ja talletab üksnes võtmed (`lib/casework/caseWorkTransfer.js:234-293`). Negatiivkontrollis kopeeriti tekst „VERSIOON A”, DB-s asendati see enne auditit tekstiga „VERSIOON B” ning audit aktsepteeriti väljaloendiga `['SISU']`.

**Mõju.** Append-only rida tõendab kopeerimistoimingu aega ja väljanimesid, kuid mitte seda, milline tekst tegelikult lõikelauale läks. Paralleelne muutmine või hilisem vaidlus võib siduda auditi vale sisuseisuga.

**Vastuvõtukriteerium.** Plokk peab kandma serveri loodud muutumatu versiooni-/snapshot-ID või kanoniseeritud sisu räsi; audit võtab sama tõendi vastu tingimuslikult ja lükkab stale ploki 409-ga tagasi. Testida tekstimuutust ploki laadimise ja auditikande vahel.

**Seis (09.08.2026): DONE — kood, migratsioon ja testid; migratsiooniahel tõendatud päris PostgreSQL-i vastu, rakenduse runtime: not_run.**
- **Valitud tee: kanooniline sisu räsi, MITTE snapshot.** L8 keelab väljade väärtuste salvestamise — täissnapshot elaks üle E7 sisu-purge'i ja oleks varju-register, ehitatud selle mehhanismi sisse, mis pidi teda ära hoidma. Räsi tõendab identsust ilma sisu hoidmata ja purge'i üle ta midagi ei kanna.
- `buildStar2Block()` tagastab nüüd `contentHash` (sha256 hex) ja klient kannab ta muutmata kujul auditisse — **ploki oma, mitte praegusest andmebaasi seisust arvutatud**. Ootel audit (L22 korduskatse) hoiab teda koos võtmega.
- **Kanooniline kuju:** `[[fieldKey, text], …]` võtme järgi sorditult, JSON-ina. Sortimine on kohustuslik — päringu järjekord võib muutuda ja siis annaks sama sisu kaks eri räsi, mis muudaks iga auditi „aegunuks" ilma ühegi päris muudatuseta. **Hoiatusrida ja keel ei käi kaasa:** nemad on serveri kaunistus, mitte juhtumi sisu, ja `et` all laaditud plokk peab andma sama tõendi mis `ru` all.
- **`recordCopyEvent()` arvutab räsi PRAEGUSEST sisust ümber ja lükkab lahknevuse 409-ga tagasi** (`transfer_block_stale`). 409, mitte 400: mustand on kasutajale nähtav ja takistus on **seisund** — tema plokk on aegunud, õige tee edasi on kopeerida uuesti.
- **Räsi on kohustuslik.** Puuduv või vigase kujuga väärtus annab 400. Vaikselt lubatud puuduv räsi tähendaks, et vana klient taastab vea ja rida jääb jälle ilma tekstiversioonita.
- **Räsi jääb auditirea külge** (`CaseWorkTransferEvent.contentHash`) ja on osa teo identiteedist: sama `clientActionId` **teise sisuversiooniga** annab 409, mitte vaikset 200 — sama reegel mis SOL-CW-06 väljaloendil.
- **Kaks `CHECK`-i andmebaasis** (migratsioon `20260809170000`): kahesuunaline `("kind" = 'COPIED_FOR_STAR2') = ("contentHash" IS NOT NULL)` (sama muster mis `clientActionId`-l — ülekantuks märkimisel plokki ei ole) ja kuju `^[0-9a-f]{64}$`. Enne `CHECK`-e on **värav**: olemasolev räsita kopeerimisrida katkestaks migratsiooni nimelise tõrkega, sest teda ei saa tagantjärele arvutada — sisu võib olla vahepeal muutunud ja väljamõeldud räsi oleks halvem kui puuduv.
- **Testid** (`tests/casework/caseWorkTransfer.test.js`, 7 uut): **auditi enda negatiivkontroll sõna-sõnalt — „VERSIOON A" kopeeritud, „VERSIOON B" andmebaasis → 409 ja auditirida ei teki** · värske plokk läheb läbi ja räsi jääb rea külge (sisu ise auditireas ei ole) · räsi on kohustuslik ja tema kuju kontrollitakse · sama võti teise sisuversiooniga → 409 · kordus sama sisuga jääb idempotentseks (L22 ei murdu) · räsi on kanooniline: järjekord ei loe, iga päris muudatus loeb, ja piiride segunemine (`"AB"+"c"` vs `"A"+"Bc"`) ei anna kokkupõrget · migratsioonifail kannab mõlemat `CHECK`-i ja väravat. Pinna leping (`transferUi.test.js`) nõuab, et räsi jõuab plokist ootel auditisse muutmata kujul.
- **runtime: not_run** — päris brauseri lõikelauaga läbi ei käidud; juhtumitöö värav on tootmises väljas. `db:migrate:check`: 138-migratsiooniline ahel rakendus tühjale PostgreSQL-ile.
- Kontroll: `npm test` **3210/3210**, `npm run i18n:check` OK, `npx eslint` puhas.

### SOL-CW-17 — workbench'i rohelised privaatsustestid ei läbi kahte uut sektsiooni — P2

**Tõend.** `tests/casework/workbench.test.js` fake-DB defineerib juhtumi, puuduva info, eelpöördumise, jagamise, teemaseemne ja refleksiooni mudelid, kuid mitte `caseWorkDraft` ega `caseWorkTransferEvent` meetodeid (`:56-127`). `getCaseWorkbench()` kutsub neid sektsioonides `draftsAwaitingTransfer` ja `transferHistory` (`lib/casework/workbench.js:310-313`, `:346-352`). 246/246 jooks logis mõlema sektsiooni korduvaid `TypeError`-eid; privaatsustest kontrollis ainult aktiivsete juhtumite ja puuduva info ridu ning jäi roheliseks (`tests/casework/workbench.test.js:130-149`).

**Mõju.** Testiraport jätab mulje, et kõik kümme koondsektsiooni on omaniku järgi isoleeritud, kuigi kahe sektsiooni positiivset ega võõra omaniku rada selles kogumis tegelikult ei täideta.

**Vastuvõtukriteerium.** Fake-DB peab kõik kümme sektsiooni päriselt toetama ja põhilepingutest peab nõudma nende olekuks `OK/EMPTY`, mitte lubama ootamatut `ERROR`-it. Lisada kummalegi sektsioonile oma ja võõra omaniku read ning katkestada test ootamatu konsoolivea korral.

**Seis (09.08.2026): DONE — testid; tootmiskoodi see leid ei muutnud.**
- **Fake-DB sai puuduvad kaks mudelit:** `caseWorkDraft` ja `caseWorkTransferEvent`. Mõlemad nõuavad skoopi (`requireOwner`) — mustandil vanema kaudu (`caseWorkAssist.ownerUserId` + `retentionState`), auditireal denormaliseeritud `ownerUserId` kaudu. Skoobita lugeja kukub nüüd fake'i peal, mitte alles toodangus.
- **Ootamatu konsoolikirje on TESTI KUKUTAJA.** `Promise.allSettled` teeb iga erindi vaikseks `ERROR` sektsiooniks; roheline test tähendas seni „laud vastas", mitte „laud töötas". Uus abiline `workbenchWithoutErrors()` püüab `console.error`-i kinni ja nõuab, et teda ei oleks.
- **Uus nimeline leping (test 1b):** iga kümnest sektsioonist peab olema `OK` **või** `EMPTY` — mitte `ERROR`, mitte `TIMEOUT`. Tühja andmestikuga peavad kõik olema `EMPTY`. Varem ei kontrollinud seda ükski test ja kaks sektsiooni olid iga jooksu ajal `ERROR`.
- **Mõlemal sektsioonil on nüüd OMA ja VÕÕRAS rida.** Ilma võõra reata ei tõendaks positiivne rida omanikupiiri — ta ütleks ainult, et lugeja midagi tagastab. Privaatsustest kontrollib nüüd ka `draft_voeras` ja `event_voeras` puudumist väljundist ning **positiivset poolt**: minu mustand ja minu auditirida on kohal.
- **L20 valge nimekiri sai tõendi ka nende kahe peal:** deskriptori kuju test (`9.`) kontrollib nüüd `draftsAwaitingTransfer` ja `transferHistory` võtmehulki, mida varem üheski jooksus ei täidetud.
- **Negatiivkontroll (09.08.2026):** ühe fake-mudeli eemaldamisel kukuvad mõlemad uued testid läbi (`1.` ja `1b.`); tagasi pannes 12/12. Roheline tuleb katvusest, mitte testi kujust.
- Kontroll: `npm test` **3211/3211**, `npx eslint` puhas.

### SOL-CW-18 — workbench'i timeout ei lõpeta aegunud päringuid — P2

**Tõend.** Iga kümnest sektsioonist käivitatakse paralleelselt `Promise.race`-is; 2,5 sekundi täitumisel tagastatakse `TIMEOUT`, kuid algne teenuse-/DB-promise jätkab taustal (`lib/casework/workbench.js:204-245`, `:356-364`). Faili kommentaar nimetab koormuse jätkumist teadlikuks piiranguks. Päringutele ei anta abort-signaali ega PostgreSQL statement timeout'i.

**Mõju.** Aeglane DB või väline allikas võib ühe HTTP vastuse järel jätta kuni kümme tööd ühendusi ja CPU-d kasutama. Korduvad refresh'id kuhjavad nähtamatu taustakoormuse just tõrke ajal, mil süsteem on juba aeglane.

**Vastuvõtukriteerium.** Sektsioonidel peab olema päris päringu-/statement-timeout või katkestatav adapterileping; koondrada vajab sama kasutaja paralleelpäringute piiri. Koormustest peab hoidma ühe allika rippumas, tegema korduvaid refresh'e ja tõendama, et lõpetatud HTTP järel töö/ühendus ei jää elama.

**Seis (09.08.2026): DONE — kood, testid ja KOORMUSSOND päris PostgreSQL-i vastu; rakenduse brauseri-runtime: not_run.**
- **Päris katkestus tuleb andmebaasilt, sest mujalt ta tulla ei saa.** Prisma ei võta päringule `AbortSignal`-it — „katkestatav adapterileping" ei ole selle kliendiga olemas. Ainus tõeline katkestus on PostgreSQL-i `statement_timeout`, mis lõpetab backend'i töö serveri pool. Kõik muu on lubadus.
- **Laud sai OMA ühendustepesa** (`lib/casework/workbenchDb.js`): `statement_timeout = 2500` (sama arv mis sektsiooni tähtaeg — päring ei tohi elada üle lubaduse), `max = 10` (üks sektsiooni kohta ja edasi ei kasva), `connectionTimeoutMillis = 2500`, `application_name = sotsiaalai-casework-workbench`.
- **Miks oma pesa, mitte `SET LOCAL` ühises pesas:** `SET LOCAL` kehtib ainult tehingus, seega iga sektsioon vajaks interaktiivset tehingut — **kümme tehingut kinnitaks kümme ühendust ja `pg` vaikepesa on täpselt kümme**. Üks laua päring võiks lukustada terve rakenduse pesa: halvem viga kui see, mida parandame. Oma pesa annab tähtaja ilma tehinguteta ja ühtlasi kõva ülempiiri — ammendunud laua-pesa ei puuduta ühtegi teist rada.
- **`query_timeout` on VALE tööriist ja seda valvab test:** node-postgres'i `query_timeout` lükkab lubaduse tagasi kliendi pool ja **server jätkab päringut edasi** — täpselt see viga, mida leid kirjeldab, ainult teise nime all.
- **Katkestus (`57014`) annab `TIMEOUT`-i, mitte `ERROR`-i.** Kui ta annaks `ERROR`-i, sõltuks kasutaja nähtav olek sellest, kumb millisekund võitis — sama aeglus näeks kord ühtemoodi, kord teistmoodi välja. Erindi kuju on **mõõdetud, mitte oletatud** (Prisma 7 + `adapter-pg`: `P2010`, päris põhjus `meta.driverAdapterError.cause`-is); teate TEKSTI järgi ei otsustata, sest tekst võib kanda päringu argumente.
- **JS-`race` jääb backstop'iks** selle jaoks, mis EI OLE päring, ja logis on kaks allikat eristatud (`source: "database"` vs `"deadline"`) — pärast seda parandust tähendab `deadline` hoopis teist viga.
- **Kasutaja paralleelpäringute piir on 2** (`workbenchConcurrency.js`), üle selle **429**. Kaks, mitte üks: laud võib olla lahti kahes vahekaardis. Slott võetakse **pärast väravat** (autentimata päring ei kuluta kellegi kvooti) ja vabastatakse `finally`-s — vabastamata slott jätaks kasutaja igaveseks 429 taha.
- **Tähtaeg on ÜKS arv** (`workbenchLimits.js`): sama väärtus on JS-tähtaeg ja `statement_timeout`. Kaks kirjapanekut läheksid esimese muudatusega lahku ja tagajärg oleks vaikne — laud lubaks 2,5 s, andmebaas laseks päringul edasi joosta.
- **Koormussond `npm run casework:workbench:probe`, 10/10 päris PostgreSQL-i vastu** (visatav andmebaas, koristus kontrollitud). Ta täidab kriteeriumi sõna-sõnalt: hoiab allikat rippumas (`pg_sleep(20)`), teeb **viis vooru à kümme päringut** ja loeb `pg_stat_activity`-st, mitu backend'i on veel elus.
- **Sondi kõige tähtsam osa on NEGATIIVKONTROLL:** sama rippuv päring käib läbi kahe pesa. Ilma statement-timeout'ita (leiu-eelne seis) on backend pärast tähtaega **elus** (A1), laua pesas on ta **kadunud** (B1) — ja pärast 50 päringut on laua pool **null**, samal ajal kui vana raja töö on ikka veel elus (C2 + C3). Ilma C3-ta võiks C2 roheline tulla lihtsalt sellest, et `pg_sleep` juhtumisi lõppes.
- **Sond tõendas ka pesa ülempiiri koormuse all:** 50 samaaegse päringu juures oli aktiivsete backend'ide tipp täpselt **10**, mitte 50.
- **D1/D2:** kõik kümme sektsiooni vastavad päris PostgreSQL-is `EMPTY`-ga, mitte `ERROR`-iga — SOL-CW-17 lepingu päris-andmebaasi versioon.
- **Testid** (`tests/casework/workbenchLoad.test.js`, 12 uut): katkestus → `TIMEOUT` ja seda **ei logita veana** · negatiivkontroll: muu erind → endiselt `ERROR` · kaks allikat on logis eristatavad · **väljas värav ei ava ühendustepesa** (klient lahendatakse alles pärast väravat, mitte vaikeväärtusena) · pesa leping, sh `query_timeout` puudumine · tähtaeg on üks arv · piir lubab N korda, teine kasutaja ei jää esimese taha, vabastamine vabastab · **kaks korda vabastamine ei tõsta piiri vaikselt üles** · vabastatud kasutaja ei jäta rida mällu · kasutajata päring ei võta slotti · marsruut võtab sloti pärast väravat ja vabastab `finally`-s · koormussond on olemas ja tal on negatiivkontroll.
- **runtime: not_run** — päris brauserist lauda läbi ei käidud; juhtumitöö värav on tootmises väljas.
- Leping (`jta-v1-arendusleping.md`, L13 plokk) on muudetud koos koodiga: v6 „aegunud päringut ei katkestata" on nüüd läbi kriipsutatud ja asendatud lukustatud tabeliga.
- Kontroll: `npm test` **3237/3237**, `npm run i18n:check` OK, `npx eslint` puhas, `npm run build` OK, `npm run casework:workbench:probe` **10/10**.

### SOL-CW-19 — töötaja konto kustutamine hävitab kogu juhtumitöö ja selle auditid kohe — P1

**Tõend.** `CaseWorkAssist.ownerUserId` FK kasutab `onDelete: Cascade` (`prisma/schema.prisma:6446`); kõik märkmed, mustandid, ülekande-, retention- ja kliendiviite auditid ripuvad omakorda juhtumi küljes kaskaadiga (`:6490`, `:6562`, `:6656`, `:6747`, `:6837`, `:6859`, `:6879`). Konto kustutamise orkestreerija kustutab lõpuks User-rea ega arhiveeri või anna juhtumeid organisatsioonile üle (`lib/privacy/userDeletionOrchestrator.js:55-76`; `lib/privacy/userDeletion.js:132-151`).

**Mõju.** Töötaja lahkumine või konto kustutus eemaldab hetkega ka klientide kohta tehtud kohtumismärkmed ja STAR2 ülekande tõendi, sõltumata juhtumi retention-olekust või 12 kuu kellast. Organisatsioonil ega järelevalvel ei jää vastutusjälge.

**Vastuvõtukriteerium.** Otsustada ja dokumenteerida, kas juhtumitöö on isiklik mustand või organisatsiooni ametialane töö. Teisel juhul peab konto kustutus pseudonüümima tegija ja andma aktiivsed/säilitatavad juhtumid kontrollitud omanikule või retention-hoidlale; testida offboarding, organisatsioonist lahkumist ja kustutust kõigis kolmes olekus.

**Seis (13.08.2026): DONE — kehtiv kanooniline leping määrab CaseWorkAssisti töötaja rangelt isiklikuks töömaterjaliks; konto kustutus eemaldab selle tervikuna, organisatsiooni ametlik tööajalugu ja sisuvaba kustutustõend säilivad ning töötaja saab oma juhtumitöö enne kustutust andmekoopiasse.**

- **Otsus ei olnud enam lahtine blocker.** `juhtum-v1-arendusleping.md` O-JU-2 ütleb nimeliselt „rangelt isiklik" ja „ei ole üleantav"; `jta-v1-arendusleping.md` piirab tööriista ettevalmistava tööruumina, mille ametlik kanne sünnib STAR-is; kasutajatekst ütleb, et laud näitab ainult kasutaja enda tööd. Kehtiv raamleping §12.4 ütleb, et konto kustutamisel eemaldatakse konto ja seotud rakenduse andmed, säilitades sisuvaba tehnilise auditijälje. Seetõttu jäi `CaseWorkAssist.ownerUserId` kaskaad muutmata; skeemi ega migratsiooni ei lisatud.
- **Vana käitumise negatiivtõend:** uus sihttest kukkus enne parandust teatega `casework ekspordipind puudub`. `caseWorkAssistsOwned` oli ekslikult `THIRD_PARTY_EXCLUDED`, mistõttu isiklik töömaterjal küll kustus kontoga, kuid ei olnud enne kustutust kasutaja andmekoopias.
- **Andmekoopia:** `casework.ndjson` valib ainult `ownerUserId = küsija` juhtumid ja nende märkme-, paranduse-, mustandi-, ülekande- ning säilitusauditi. Kliendi konto-/lähteobjekti ID-sid ja denormaliseeritud tegija-ID-sid ei valita; kasutaja kui kliendi seos võõra töötaja juhtumis jääb `THIRD_PARTY_EXCLUDED`.
- **Päris PostgreSQL (`casework:deletion:probe`, ajutine lokaalne DB, 14/14, cleanup OK):** ACTIVE, READ_ONLY ja ARCHIVED juhtum koos kohtumismärkme, paranduse, mustandi, ülekande-, retention- ja kliendiviite auditiga kustub konto järel; FK-d jõustavad omaniku ning kõigi otseste laste kaskaadi. Viimase omaniku ja PENDING töö katsed annavad parandatava 409 ning rollback jätab konto, liikmesuse, töö ja kogu juhtumipuu puutumata; takistuse eemaldamise järel retry õnnestub. Organisatsioon, teine omanik, isikuta ENDED liikmesus, lõpetatud ametliku töö seos, `USER_DELETE` kustutustöö tõend ja organisatsiooni audit säilivad. Sond tõendas ka viimase SOCIAL_WORKER-i lahkumise, kui organisatsioonile jääb teise rolliga aktiivne omanik.
- **Sihttõend:** `accountDeletion.test.js` + isikuandmete pinnaregistri testid **6/6**; muudetud koodi ESLint ja `git diff --check` puhtad. Täisvärav: peatüki sulgemisel.

### SOL-CW-20 — juhtumiloendi cursor tugineb muutlikule järjestusväljale — P2

**Tõend.** Loend sordib `updatedAt DESC, id DESC`, kuid cursorina liigub kliendile ainult rea ID (`lib/casework/caseWorkAssist.js:269-305`). Lapse iga kirjutus võtab vanemrea luku tingimusliku update'iga ja puudutab `updatedAt` väärtust (`:553-576`), mistõttu juba nähtud cursor-rida või muu rida võib lehekülgede vahel järjekorras liikuda. Cursor ei kanna esimese lehe snapshot'i ega algset `(updatedAt,id)` piiri.

**Mõju.** Pika aktiivse loendi lehitsemisel võib sama juhtum korduda või mõni juhtum vahele jääda, kui paralleelne vahekaart või muu toiming vahepeal last muudab. Sama loend on just aktiivse töö pind, kus `updatedAt` muutub sageli.

**Vastuvõtukriteerium.** Kasutada muutumatut/snapshot'iga cursorit või tagastada ja jõustada täielik sortimisvõti koos stabiilse ülemise piiriga; UI peab ID järgi deduplikeerima. Testida esimese lehe järel cursor-rea ja nähtamatu järgmise rea muutmist.

**Seis (09.08.2026): DONE — kood, testid ja päris PostgreSQL-i sond; rakenduse brauseri-runtime: not_run.**
- **Cursor kannab nüüd TÄIELIKKU sortimisvõtit** `(updatedAt, id)` **ja stabiilset ülempiiri**, mitte paljast ID-d. Prisma `cursor: { id }` positsioneerib rea **praeguse** koha järgi järjestuses — ja `updatedAt` on muutlik, sest juhtumi iga lapse kirjutus puudutab vanemrida. Lehepiir on nüüd keyset-tingimus (`paging.js`: `encodeListCursor`, `decodeListCursor`, `listCursorWhere`), mitte „leia see rida üles".
- **Ülempiir sünnib ESIMESEL lehel ja kandub edasi muutumatuna.** Kui ta tekiks iga lehe peal uuesti, liiguks snapshot koos lehitsemisega ja kogu kaitse kaoks — sama viga, ainult aeglasemal kujul. Sellele on oma test.
- **Snapshot-leping on välja öeldud, mitte vaikimisi:** pärast esimest lehte muudetud või tekkinud rida **ei tule keset lehitsemist sisse** — ta on nähtaval värskendusel. Alternatiiv annaks rea, mille kasutaja on juba läbi kerinud, teist korda. Test tõendab **mõlemad pooled**: rida ei kordu selles lehitsemises JA värske lehitsemine leiab ta esimeselt lehelt, seega andmestikust ta ei kao.
- **Loetamatu cursor annab 400** (`casework.errors.cursor_invalid`), **mitte vaikset esimest lehte** — vaikne tagasilangus kaotaks kasutaja koha loendis ja näeks välja nagu andmete kadu. Sama reegel mis SOL-CW-08-l. **Vana kujuga cursorit (paljas ID) EI tõlgendata:** vale tõlgendus taastaks täpselt selle vea. Cursor on läbipaistmatu (base64url) ja kannab versiooninumbrit, et tulevane kuju saaks vana AUSALT tagasi lükata, mitte teda valesti lugeda.
- **UI dedupe oli juba olemas** (`mergeCaseRows`, SOL-CW-10) ja tal on oma test (`caseListState.test.js`) — kriteeriumi see pool oli täidetud enne seda parandust.
- **Testid** (`tests/casework/caseListCursor.test.js`, 12 uut) ja **nende fake on siin sisuline osa, mitte tugi:** pood hindab päriselt nii keyset-tingimust kui ka VANA `cursor`-semantikat, sest fake, mis `where`-i ignoreerib, oleks selle leiu juures täiesti kasutu — kogu viga ON järjestuse ja lehepiiri koosmõju.
- **Kaks negatiivkontrolli, mis jooksevad VANA algoritmi peal sama stsenaariumi ja peavad KUKKUMA:** (1) vahepeal etteotsa hüpanud cursor-rida → vana rada **kordab** ridu; (2) kustutatud cursor-rida → vana rada **kaotab kogu ülejäänud loendi** (`cursor: { id }` ei leia rida ja saba jääb tulemata), uus rada lehitseb lõpuni, sest keyset on võrdlus, mitte otsing.
- **Sond `npm run casework:list:probe`, 7/7 päris PostgreSQL-i vastu** (visatav andmebaas, koristus kontrollitud). Ta tõendab seda, mida fake **ei saa**: et Prisma pesastatud `AND`/`OR` + `lt`/`lte` `DateTime` peal üldse vastu võtab. Fake tõendab minu loogikat, mitte päringu kehtivust — ja just seal ütleb fake kõige veenvamalt „roheline".
- **runtime: not_run** — päris brauserist „näita rohkem" nuppu läbi ei käidud; juhtumitöö värav on tootmises väljas.
- Kontroll: `npm test` **3252/3252**, `npm run i18n:check` OK, `npx eslint` puhas, `npm run casework:list:probe` **7/7**.

### SOL-RAGADMIN-01 — faili metadata ja failisüsteem võivad asendamisel või kustutamisel lahkneda — P1

**Tõend.** KOV faili asendamine kirjutab esmalt DB reale uue `storagePath` väärtuse, kustutab vana faili ning teeb seejärel veel mitu ebaõnnestuda võivat DB-/sünkroniseerimistoimingut (`app/api/admin/rag/kov/[slug]/files/route.js:57-106`). Iga hilisem viga käivitab catch’is uue faili kustutamise (`:115-120`), kuigi DB võib juba uuele failile osutada ja vana fail on kustutatud. Organisatsioonifail kasutab sama mustrit (`app/api/admin/rag/organizations/[slug]/files/route.js:74-124`). Kustutamisel eemaldatakse füüsiline fail enne DB-rida (`app/api/admin/rag/kov/[slug]/files/[role]/route.js:37-53`; organisatsioonifailil vastavalt `.../[fileId]/route.js:38-43`), mistõttu DB vea järel jääb alles kirje puuduvale failile.

**Mõju.** Üks vahepealne DB-, failisüsteemi- või sünkroniseerimisviga võib kaotada nii vana kui uue faili või jätta metadata osutama failile, mida enam pole. API tagastab küll vea, kuid automaatset taastamist ega järjekorda ei ole.

**Vastuvõtukriteerium.** Faili ja metadata olekumuutus vajab taastatavat protokolli: uus fail kirjutatakse ajutiselt, DB vahetus on atomaarne ning vana faili koristus on idempotentne järeltegevus; kustutamisel eemaldatakse esmalt DB nähtavus/tombstone ja füüsiline fail koristatakse retry-järjekorraga. Veasüstetestid peavad katkestama iga sammu järel ja tõendama, et aktiivne kirje osutab alati olemasolevale failile.

**Seis (09.08.2026): DONE — protokoll, neli rada, retry-rada ja veasüstetestid; rakenduse runtime: not_run.**
- **Protokoll on ÜHES kohas** (`lib/admin/rag/fileSwap.js`) ja seisab ühe lause peal: **aktiivne kirje osutab alati olemasolevale failile.** KOV ja organisatsioon kandsid sama viga kahes koopias; kaks parandust oleksid esimese muudatusega lahku läinud.
- **`committed` lipp on kogu leiu tuum.** Varem kustutas `catch` **uue faili** ka siis, kui DB temale juba osutas ja vana fail oli kustutatud — üks tõrge hilisemas sammus hävitas **mõlemad failid korraga** ja jättis kirje olematule failile. Nüüd on uue faili koristus lubatud ainult enne vahetuspunkti.
- **Ajutist faili ei olnud vaja leiutada:** `buildKovStoredFilePath`/`buildOrganizationStoredFilePath` annavad juba UUID-tee, seega uus fail ei kirjuta vana kunagi üle. Kriteeriumi „kirjutatakse ajutiselt" osa oli sisuliselt täidetud; puudu oli **vahetuspunkti distsipliin**.
- **Vana faili koristus on nüüd järeltegevus, mitte osa tehingust:** tema tõrge annab orvu, mitte 500. DB on juba õige ja allesjäänud fail on orb, mitte vale.
- **Kustutamisel läheb DB nähtavus esimesena.** Orb fail on ohutu — talle ei osuta keegi; kirje ilma failita ei ole.
- **Järeltegevused (`checkedAt`, seisu sünkroniseerimine) ei kukuta enam päringut** (`afterCommit`). Nad jooksevad siis, kui töö ON tehtud; 500 ütleks adminile „ei õnnestunud" ja ta laeks faili uuesti üles.
- **Orb ei kao vaikselt:** iga ebaõnnestunud koristus kirjutab püsiva `DataDeletionJob` rea (`FILE_DELETE`), mille admin näeb ja mida saab uuesti proovida. Salvestatakse ainult erindi **kood/klass**, mitte teade.
- **Retry-rada oli enne katki ja see on MÕÕDETUD, mitte oletatud.** `deleteStoredDocument` jõustab tee `<docs>/uploads/` sees, aga RAG-admini failid elavad `<docs>/kov/…` ja `<docs>/organizations/…` all — olemasolev `FILE_DELETE` haru oleks visanud `storage_path_invalid` igal katsel. **Järjekord, mis ei saa kunagi tühjeneda, on halvem kui järjekorra puudumine: ta näeb välja nagu töötav järelevalve.** Lisatud on `deleteRagAdminFile` haru, mis tunneb tüübi ära ja tagastab `false`, kui ei tunne — vaikne `true` kataks kirjaviga tüübinimes kinni.
- **Paranduse käigus leitud ja parandatud oma viga:** `createDeletionJobRetryService` ei andnud uut tegevust `executeDeletionJob`-ile edasi, seega haru ei oleks kunagi käivitunud. Leidis **käitumistest**, mitte lähtekoodi lugemine — allikaleping oleks olnud roheline.
- **Testid** (`tests/admin/ragFileSwap.test.js`, 10 uut) järgivad kriteeriumi kuju: maailmamudel (failid + kirje) ja iga stsenaarium lõpeb SAMA kontrolliga `assertInvariant()`. Katkestus **enne** vahetuspunkti · **pärast** vahetuspunkti · vana faili koristuse tõrge (orb, mitte 500, ja orvu rida on tõendatud) · DB-rea eemalduse tõrge kustutamisel (fail jääb ALLES) · faili koristuse tõrge kustutamisel · esmane üleslaadimine · sama tee iseenda asendamisel · orb KOV-fail jõuab KOV-kustutajani, mitte dokumendirajale · tundmatu tüüp ei lähe vaikselt läbi.
- **NEGATIIVKONTROLL:** sama veasüst käib läbi ka VANA raja (`legacyReplace`) ja seal peab invariant **katkema** — test nõuab seda sõnaselgelt. Ilma selleta ei tõendaks roheline sviit, et süst leidu üldse reprodutseerib.
- **runtime: not_run** — päris admini sessioonist faili asendamist ja kustutamist läbi ei käidud; veasüst on mudelil, mitte päris failisüsteemil.
- Kontroll: `npm test` **3262/3262**, `npx eslint` puhas, `npm run build` OK.

### SOL-RAGADMIN-02 — KOV RAG reset raporteerib edu ka kustutamata dokumentide korral — P1

**Tõend.** `lib/admin/rag/kov/resetState.js:223-230` kogub `deleteRagDocument()` tõrked massiivi `failed_rag_documents`, kuid ei katkesta operatsiooni. Seejärel arhiveeritakse aktiivsed snapshot’id ja lähtestatakse KOV admini ingest-olek (`:232-264`) ning funktsioon tagastab `ok: true` plaani. UI kontrollib ainult HTTP staatust ja `payload.ok` väärtust (`components/admin/rag/kov/useKovAdminController.jsx:703-713`) ning kuvab ühemõttelise eduteate, et üksikuid dokumente pole vaja kustutada (`:719-723`). Sama faili web-layer cleanup’i rada kontrollib vigade massiivi ja katkestab, mis kinnitab kahe raja vastuolu.

**Mõju.** RAG-dokument võib teenuses aktiivseks jääda, samal ajal kui DB snapshot’id ja admini olek ütlevad, et pakett lähtestati. Adminile kuvatakse vale edu ning allesjäänud teadmus võib jätkata otsingutulemuste mõjutamist.

**Vastuvõtukriteerium.** Ükski kustutusviga ei tohi anda `ok: true` ega eduteadet. Kas kogu reset peab enne DB oleku muutmist katkema või peab operatsioon olema püsiva tööjärjekorra ja nähtava `PARTIAL/RETRYING` olekuga. Negatiivne test peab sundima ühe dokumendi kustutuse ebaõnnestuma ja tõendama serveri ning UI ausa osalise vea.

**Seis (09.08.2026): DONE — protokoll, kolm raja koristus, püsiv järjekord ja aus UI; rakenduse runtime: not_run.**
- **Protokoll on ÜHES kohas** (`lib/admin/rag/kov/ragResetProtocol.js`) ja seisab ühe lause peal: **admini olek ei tohi kunagi väita puhtamat maailma, kui RAG-is päriselt on.** Ingestitud olek koos allesjäänud dokumendiga on korras — see ongi tõsi. Vale on vastupidine paar.
- **Kriteeriumi „kas–või" sai MÕLEMA poole ja see ei ole liialdus.** Ainult katkestus jätaks allesjäänud dokumendi nähtamatuks (erind kaob ekraanilt); ainult järjekord jätaks DB ütlema „lähtestatud" seni, kuni keegi järjekorda vaatab. Seepärast: kustutus esimesena, DB-olek alles siis, kui ükski kustutus ei jäänud võlgu, JA iga allesjäänu kohta püsiv `DataDeletionJob` (`RAG_DELETE`).
- **„Katkesta enne DB-d" on siin täielikult taastuv, mitte poolik töö.** Plaan arvutatakse igal katsel uuesti ja juba kustutatud dokument annab RAG-ist 404, mille `deleteRagDocument` loeb sihilikult eduks. Admin vajutab uuesti ja reset läheb lõpuni. Alternatiiv „muuda DB ära ja märgi PARTIAL" jätaks pärandiks oleku, mille tõesus sõltub sellest, kas keegi juhtus märget lugema.
- **Reset ja veebikihi koristus olid kaks koopiat, mis olid JUBA lahku läinud** — koristus kontrollis tõrkeid ja katkestas, reset kogus need vaikselt massiivi. Nüüd on üks rada (`runKovRagStateReset`); erinevus on ainult observability-silt. Ja koristuse enda kontroll oli **liiga hilja**: ta viskas 502 alles PÄRAST snapshot'ide arhiveerimist.
- **Kolmas koopia oli CLI-s** (`scripts/cleanup-kov-rag-state.mjs`): ta arhiveeris ja lähtestas admini read tõrgetest hoolimata ning pani `plan.ok = false` alles päris lõpus. Sama värav on nüüd ka seal. Püsivat järjekorrarida see skript EI pane — ta jookseb ilma alias-laadijata ja tõrked on logis + väljumiskood 1; see on kirjas kommentaaris, et keegi ei loeks vaikust lubaduseks.
- **DB-olek on nüüd ÜHES tehingus.** Arhiveeritud snapshot'id koos lähtestamata admini reaga oleks omakorda pooleldi tehtud reset — täpselt see seis, mille vastu see parandus on. Varem olid need kaks eraldi kirjutust.
- **UI otsustab TÖÖ TULEMUSE, mitte staatuse järgi** (`components/admin/rag/kov/ragResetMessage.js`). Kustutamata dokument annab veateate ka siis, kui vastus ütleb `ok: true` — nii ei sõltu aus teade sellest, et iga tulevane serverirada mäletaks õige staatuse panna. Sellele on oma negatiivkontroll.
- **Teade peab ise ütlema, et reset jäi pooleli:** `RagAdminAlert` on tooniva kujunduseta (`.ra-alert` kannab ainult kursorit), seega „error" ja „success" näevad ühtemoodi välja. Tekst nimetab allesjäänud doc_id-d, järjekorra pikkuse ja selle, et DB olekut EI muudetud.
- **Retry-rada on MÕÕDETUD, mitte oletatud** (sama õppetund mis SOL-RAGADMIN-01): `executeDeletionJob` valib `RAG_DELETE` haru ENNE `FILE_DELETE`-i ja ainult `externalRef`-i järgi, seega uus `resourceType` (`MunicipalityKovAdmin`) läheb sealt läbi ilma teenuse muutmist. Tõendab käitumistest, mis nõuab, et rida jõuab RAG-kustutajani ja MITTE failikustutajani.
- **`storagePath` jääb järjekorrareal tühjaks** — teadlikult. Vabatekstiline põhjus seal (nagu `effectivePractices` teeb) suunaks kaotsi läinud `externalRef`-i korral töö failikustutajale. Sellele on oma test.
- **Reas ja vastuses on tõrke KOOD, mitte teade:** `deleteRagDocument` erindi teade on `messageKey`, kohati kaugteenuse omast payload'ist. Salvestatakse `rag_delete_failed:<status>`.
- **Sama dokumendi kohta ei teki teist lahtist rida** — järjekord, mis täitub ühe ja sama tööga, matab nähtavuse enda alla.
- **Testid** (`tests/admin/kovRagReset.test.js`, 13 uut) järgivad kriteeriumi kuju: maailmamudel (RAG-dokumendid + DB olek) ja iga stsenaarium lõpeb SAMA kontrolliga `assertInvariant()`. Täisõnnestumine · tühi plaan ei ole tõrge · ühe dokumendi tõrge katkestab enne DB-d · püsiv rida tekib · järjekorda panemise tõrget ei vaikita eduks · rida jõuab RAG-kustutajani · rida ei kanna teadet ega failiteed · dedupe · UI osaline viga · `ok: true` ei päästa · järjekorda panemata dokument on eraldi välja öeldud · eduteade jääb alles.
- **KAKS NEGATIIVKONTROLLI:** (1) sama veasüst käib läbi VANA raja (`legacyReset`) ja seal peab invariant **katkema** — test nõuab seda sõnaselgelt; (2) osaline vastus `ok: true`-ga peab UI-s ikka veaks jääma.
- **runtime: not_run** — päris admini sessioonist resetit läbi ei käidud; kustutustõrge on mudelil, mitte päris RAG-teenusel.
- Kontroll: `npm test` **3275/3275**, `npx eslint` puhas, `npm run build` OK.

### SOL-RAGADMIN-03 — `INGESTING` lukk ei ole atomaarne ega taastuv — P1

**Tõend.** KOV ingest kontrollib esmalt loetud objektil, kas seis on `INGESTING` (`lib/admin/rag/kov/service.js:1460-1478`), kuid seab seisu hiljem tingimuseta `update`-iga (`:1869-1876`). Kaks paralleelset päringut võivad seega mõlemad eelkontrolli läbida ja sama `doc_id` ingest’i käivitada. Protsessi katkemisel pärast seisu muutmist jääb rida `INGESTING`-usse; staatuse sünkroniseerija säilitab selle seisu alati (`:886-919`) ja järgmine ingest blokeeritakse. Organisatsiooni ingest kordab sama mustrit (`lib/admin/rag/organizations/service.js:477-504`, `:578-590`, `:696-703`). Lisaks võib RAG teenuse edukale kirjutusele järgnev DB lõpu-update ebaõnnestuda, mille järel märgitakse DB `ERROR`-iks, kuigi dokument võib RAG-is aktiivne olla.

**Mõju.** Paralleelsed ingest’id võivad üksteist üle kirjutada ning serveri restart või protsessikatkestus võib jätta paketi püsivalt lukku. RAG ja admin-DB võivad näidata vastupidist tõde dokumendi aktiivsuse kohta.

**Vastuvõtukriteerium.** Ingest’i võtmine peab olema tingimuslik atomaarne claim koos lease’i/`startedAt` tähtajaga; aegunud claim peab olema taastatav. RAG kirjutus ja DB lõppseis vajavad idempotentset töö-ID-d ning reconciler’it. Testid peavad katma kaks paralleelset käivitust, katkestuse pärast claim’i ja DB vea pärast edukat RAG vastust.

**Seis (09.08.2026): DONE — claim + lease, lepitus, kolm rada, migratsioon, 17 testi ja 21/21 päris PostgreSQL-i sond; rakenduse runtime: not_run.**
- **Protokoll on ÜHES kohas** (`lib/admin/rag/ingestClaim.js`) ja seisab kahe lause peal: **(1) luku võtmine on ÜKS tingimuslik kirjutus, mitte kontroll + kirjutus** — `updateMany` kannab tingimuse `where`-is, seega `count === 1` on „minu oma" ja kahe sammu vahel ei ole enam akent, sest sammu on üks; **(2) igal lukul on omanik ja tähtaeg** — lukk, mida ei saa vabastada, ei ole kaitse, vaid ummik, mis näeb välja nagu kaitse.
- **KOLM koopiat ühest veast:** KOV veeb, KOV Riigi Teataja ja organisatsioon. Erinevus on ainult veerunimedes (`INGEST_LANES`); kolm parandust oleksid esimese muudatusega lahku läinud. RT ja veeb jäävad **eraldi lukkudeks** — üks pakett, kaks sõltumatut tööd.
- **`claimedAt IS NULL` LOETAKSE AEGUNUKS ja see teeb backfill’i olematuks.** Enne seda parandust `INGESTING`-usse jäänud rida ei kanna lease’i ega saagi kanda; väljamõeldud algusaeg oleks halvem kui puuduv, sest lükkaks taastumist edasi. `NULL` = „omanikku ei ole teada" = kohe varastatav, seega vanad ummikud lahenevad esimese uue katsega ja ükski andmerida ei vaja puudutamist.
- **Eelkontroll blokeerib ainult ELUSA claim’i.** Paljas „kas seis on INGESTING" oleks jätnud surnud luku igavesti kinni ja teinud claim’i varastamise võimatuks — värav ise on `claimIngestLease`, eelkontroll on ainult kiire ja sõbralik vastus tavajuhu jaoks. **409, mitte 400:** „proovi hiljem", mitte „sinu päring on vigane".
- **`syncKovAdminIngestStatusById` OLI luku igavese elu põhjus** — ta säilitas `INGESTING` seisu alati. Nüüd küsib ta aegunud claim’i puhul RAG-ist, mis päriselt sai (`lib/admin/rag/ingestReconcile.js`), ja **lepituse tulemus on selle kutse lõpptulemus**: allpool olev valmisoleku-arvutus viiks iga mitte-INGESTING seisu tagasi READY/NOT_INGESTED peale ja kustutaks `lastIngestError`, ehk kirjutaks just tuvastatud tõe kohe üle oletusega.
- **Tõe allikas on RAG, mitte oletus.** `present` → `INGESTED` (töö oli tehtud, ainult kinnitus jäi kirjutamata) · `missing` → `ERROR` koodiga `ingest_interrupted` · **`unknown` → EI OTSUSTA MIDAGI.** Just „märgi ERROR-iks ja loodame" oli see viga, mis ütles adminile „ei õnnestunud", kuigi dokument oli teenuses aktiivne. Ja `unknown` ei ole ummik: lease on juba läbi, seega järgmine ingest saab luku — see on sondis eraldi mõõdetud.
- **Pärast õnnestunud RAG-kirjutust ei kirjuta ükski veaharu enam `ERROR`-it.** `ragWriteCompleted` on siin sama kujuga lipp mis SOL-RAGADMIN-01 `committed`: vahetuspunkti järel ei tohi käitleja väita vastupidist sellele, mis juba juhtus. Rida jääb `INGESTING`-usse, lease aegub ja lepitus viib ta `INGESTED`-isse. Testis on see ahel läbi käidud otsast otsani.
- **Lõppseis ja tõrke-vabastus on TINGIMUSLIKUD claim’i peale.** Aegunud lease võis vahepeal minna kellelegi teisele; ilma selle tingimuseta kirjutaks hiline zombi üle värskema katse tulemuse või märgiks tema töö `ERROR`-iks. Mõlemad tagastavad `claim_lost` ja ei kirjuta midagi.
- **Idempotentne töö-ID: claim id katab DB poole, `doc_id` katab RAG poole.** RAG `/ingest/text` on deterministliku `doc_id`-ga upsert, seega kordamine ei duplitseeri. **Claim id-d RAG-i metadata sisse EI pandud** ja see on teadlik piir, mitte tegemata jäänud töö: selle masinal ei ole RAG-võtit (vt [[dev-masinal-puuduvad-teenusevotmed]]), seega tundmatu metadata-võtme vastuvõtlikkust ei saa siin mõõta — ja katsetamata võti võib kukutada IGA ingest’i. Lepitus kasutab ainult kohalolu, seega võit oleks olnud null.
- **Migratsioon** `20260809190000_sol_ragadmin_03_ingest_claim_lease`: 6 veergu (kolm rada × id + aeg) ja **kolm CHECK-i ainult PAARI peale** — pool-lease (id ilma ajata) oleks lukk, mille tähtaega ei saa arvutada. CHECK-i „claim tohib olla ainult INGESTING seisus" **teadlikult EI OLE**: UUID-i ei kasutata teist korda ja claim-värav laseb iga mitte-INGESTING rea läbi, seega terminaalsele reale jäänud claim on müra, mitte viga — CHECK selle peale muudaks iga sõltumatu seisu-kirjutaja (kaks CLI-skripti, reset, sünkroniseerija) potentsiaalseks 500-ks. Lease vabastatakse siiski igas kirjutajas, keda ma omanikuks pean.
- **Testid** (`tests/admin/ragIngestClaim.test.js`, 17 uut) järgivad kriteeriumi kuju: maailmamudel (rida + RAG-dokumendid + jooksvad ingest’id) ja **kolmeosaline invariant**, iga osa leiu peegel — korraga jookseb üks ingest · `INGESTED` ⇒ dokument ON RAG-is · `ERROR` ⇒ dokumenti EI OLE RAG-is. Jooksjaid loetakse TIPU, mitte hetkeseisu järgi: „korraga üks" on väide aja kohta ja lõppseisus on jooksjaid alati null.
- **KAKS NEGATIIVKONTROLLI:** (1) vana rada (loe → kontrolli → kirjuta tingimusteta) laseb sama süsti peal **mõlemad sisse** ja invariant peab katkema; (2) vana rada märgib DB-tõrke järel `ERROR`, kuigi dokument on RAG-is — ka seal peab invariant katkema.
- **Sond `npm run kov:claim:probe`, 21/21 päris PostgreSQL-i vastu** (visatav andmebaas, koristus kontrollitud). Ta tõendab seda, mida fake **ei saa**: et Prisma võtab tingimusliku `where`-i (`OR` + `lt` `DateTime` peal) vastu, et **kaks ja kaheksa samaaegset claim’i annavad täpselt ühe võitja**, et DB CHECK keelab pool-lease’i ja et lepituse kolm haru käituvad päris veergude peal õigesti. Fake tõendab minu `where`-puud, mitte andmebaasi semantikat.
- **Kus kumbki tõend lõpeb, on välja öeldud:** sond ei tõesta kerneli-tasemel põimumist; küll aga kukub VANA kood mõlema põimumise korral (tema kontroll käis vananenud lugemise pealt) ja uus mitte kummagi korral — seda poolt katab ühiktesti negatiivkontroll.
- **Arendusbaas oli 5 migratsiooni maas** (4 neist eelmise sessiooni omad) ja on nüüd `prisma migrate deploy`-ga järele viidud; ilma selleta oleks RAG-admin lokaalselt „veerg puudub" vigadega katki.
- **TOODANGUS 09.08 22:24 (`841b6fa8`, omaniku selge luba).** Migratsioon rakendus (`_prisma_migrations` 140 rida, `migrate status` „up to date"), kuus claim-veergu ja kolm `ingest_claim_pair` `CHECK`-i on kohal. **Toodangus ei olnud ühtki `INGESTING` rida**, seega lease-mehhanism ei pärinud ühtki ummikut ja olemasolevate ridade jaoks ei muutunud midagi nähtavat. `/admin/rag` 200, frontend/rag/worker `active`, vea-ridu ei ole.
- **runtime: not_run** — päris admini sessioonist ingest’i läbi ei käidud ja päris RAG-teenust ei kutsutud (võtmed puuduvad); lepituse kohalolu-lugeja on sondis ja testides süstitud.
- Kontroll: `npm test` **3292/3292**, `npx eslint` puhas, `npm run build` OK, `npm run db:migrate:check` OK (140 migratsiooni puhtal baasil), `npm run kov:claim:probe` **21/21**. Drift-värav: migratsiooniahel vs `schema.prisma` — minu veerud kattuvad, tabelitel jääb ainult repo-ülene `updatedAt`-vaikeväärtuse müra, mida see parandus ei puutu.

### SOL-RAGADMIN-04 — hävitav RAG reset ei seo dry-run plaani serveripoolse kinnitusega — P2

**Tõend.** Reset API lubab kirjutuse pelga `confirmReset: true` väärtusega (`app/api/admin/rag/kov/[slug]/reset-rag-state/route.js:20-35`). Brauser teeb küll dry-run’i ja näitab `window.confirm` dialoogi, kuid server ei nõua dry-run’i allkirjastatud sõrmejälge, täpset kinnitusteksti ega põhjust. Teised ohtlikud adminitoimingud kasutavad 5-minutilist allkirjastatud preview token’it, payload’i/mahu sõrmejälge ja ühekordset kinnitust (`lib/admin/dangerousAnalyticsActions.js:30-38`, `:69-128`).

**Mõju.** Kinnitamise ja tegeliku kirjutuse vahel muutunud plaan võib kustutada rohkem dokumente kui admin kinnitas; otse API-kutse jätab dry-run’i täielikult vahele.

**Vastuvõtukriteerium.** Reset peab kasutama sama serveripoolset preview → signed token → exact confirmation → one-time consume väravat nagu teised hävitavad adminitoimingud. Test peab tõendama, et muutunud plaan, aegunud/kasutatud token ja kinnitamata otsekutse ei tee kõrvalmõjusid.

**Seis (09.08.2026): DONE — jagatud värav, sõrmejälg täisloendina, ühekordne broneering ja 13 testi; rakenduse runtime: not_run.**
- **Värav oli olemas ja töötas — teda ei saanud keegi kasutada.** Preview → signed token → exact confirmation → one-time consume elas `dangerousAnalyticsActions.js` sees **privaatsete funktsioonidena**. Seepärast ei olnud KOV RAG resetil muud kaitset kui brauseri `window.confirm`. Primitiivid on nüüd `lib/admin/dangerousActionGate.js`-is ja **uut loogikat ei ole lisatud** — analüütika enda 34 testi läbisid muutmata kujul, mis on selle väite tõend.
- **Teine koopia oleks olnud halvim variant.** HMAC, TTL ja sõrmejälje kuju peavad olema üks implementatsioon; kaks läheksid esimese muudatusega lahku ja üks pool jääks nõrgemaks, ilma et keegi seda näeks. Sama põhjus mis SOL-RAGADMIN-01/02 juures.
- **Sõrmejälg on TÄISLOEND, mitte kokkuvõte.** Ta kannab slug'i, kihi, **kõik kustutatavad doc_id-d**, kõik arhiveeritavad snapshot-ID-d, admini rea ID ja põhjuse. Paljas arv ei kaitseks: „13 dokumenti" jääb „13-ks" ka siis, kui üks dokument vahetub teise vastu — sellele on oma test (`SAMA ARVU juures vahetunud doc_id`).
- **Kinnitustekst kannab slug'i ja mõju arvu** (`RESET KOV RAG harku-vald 4`), seega vale KOV põrkab juba teksti peal ja veel teist korda sõrmejälje peal. Testis on mõlemad astmed eraldi kirjas.
- **Põhjus küsitakse ENNE dry-run'i ja ta on sõrmejäljes.** Hiljem teise põhjusega kirjutamine ei ole see, mida keegi kinnitas — sellele on test. Põhjus läheb auditisse.
- **Ühekordne kasutus on auditirea PRIMAARVÕTI** (`jti`), seega teine kasutus põrkab andmebaasi unikaalsuse vastu — see töötab ka mitme protsessi ja restardi üle, erinevalt mälus olevast loendist. **Ja seesama rida on esimene auditijälg, mis KOV RAG resetist üldse maha jääb:** varem ei jäänud hävitavast toimingust mitte midagi. Rida sünnib enne tööd (`status: "started"`) ja tulemus kirjutatakse samale reale.
- **Plaan arvutatakse ÜKS kord ja seesama objekt läheb nii väravasse kui täitmisele** (`executeKovRagStateResetBySlug(slug, { plan })`). Kaks arvutust tähendaks, et värav kontrollib ühte plaani ja server täidab teist — täpselt see aken, mille vastu värav on. Ette antud plaani slug ja kiht kontrollitakse üle; vale plaan annab 409, mitte vaikse katastroofi.
- **UI: põhjuse küsimine → dry-run → serveri antud täpne tekst → kirjutatud kinnitus.** Klient EI valideeri kirjutatud teksti ise — server on ainus autoriteet, ja kuna `assertPreview` põrkab enne broneeringut, ei kuluta kirjaviga token'it ära: sama eelvaatega saab kohe uuesti proovida.
- **Piir, mis on teadlik:** kaks `window.prompt`-i, mitte vorm. Kriteerium puudutab serveripoolset väravat ja test käib serveri peal; korralik vorm `KovDetailPanel`-is (põhjuse ja kinnituse väljad, mõjuplokk) on eraldi UI-töö ja ei ole tehtud.
- **Testid** (`tests/admin/kovRagResetGate.test.js`, 13 uut) järgivad kriteeriumi kuju: maailmamudel (auditiread + tehtud resetid) ja iga stsenaarium lõpeb SAMA kontrolliga `assertInvariant()` — **iga tehtud reset kannab kehtivat, ühekordselt broneeritud eelvaadet.** Kaetud on: terve rada · tulemus samale reale · paljas `confirmReset` · puuduv kinnitus ja puuduv token eraldi · muutunud plaan · sama arvu juures vahetunud doc_id · teine KOV · muudetud põhjus · aegunud token (ja üks millisekund varem kehtib veel) · juba kasutatud token · vale tekst, rikutud allkiri, võõra saladusega token.
- **NEGATIIVKONTROLL:** vana rada (`legacyReset`) teeb sama kutse peale reseti ära ja seal peab invariant **katkema**.
- **Marsruudi leping on staatilises testis** (`assertKovRagResetGate`, `previewKovRagReset`, `executeKovRagStateResetBySlug(slug, { plan })`, `DangerousActionError`, `recordKovRagResetOutcome`). See on ainus viis marsruuti katta ilma teda importimata — ta veab kaasa serveri-ainult ahelat (vt [[server-only-tapab-npm-testi]]) — ja ta kaitseb selle vastu, et keegi ehitab väravata raja tagasi sisse. Sama muster mis analüütika enda marsruudi-lepingul.
- **runtime: not_run** — päris admini sessioonist resetit läbi ei käidud; värav on tõendatud teenusetasemel.
- Kontroll: `npm test` **3305/3305**, `npx eslint` puhas, `npm run build` OK.

### SOL-ORG-01 — töötaja kaudu tuletatud graafikuskoop lekib mitme organisatsiooni töö üle tenantide piiri — P1

**Tõend.** `lib/serviceLog/dispatchBoard.js:60-90` leiab juhi organisatsiooni töötajate kasutaja-ID-d. Tahvel küsib seejärel kõik nende kasutajate sama päeva `ServiceWorkRoute` read (`:113-143`) ja kõik nende külastused (`:145-166`) ilma organisatsiooni filtrita. Filtrit ei saagi lisada, sest `ServiceVisit`/`ServiceWorkRoute` skeemil puudub organisatsiooni/provenantsi väli (`prisma/schema.prisma:5590-5608`, `:5615-5689`). `reassignVisit()` loeb külastuse globaalse ID järgi ning kontrollib ainult, kas selle omanik ja sihttöötaja on päringu organisatsiooni liikmed (`lib/serviceLog/dispatchAssign.js:184-224`); ta ei tõenda, et külastus pärineb sellest organisatsioonist. `assignVisit()` salvestab organisatsiooni ainult parima-püüdega auditirea metadata sisse, mitte külastuse kanoonilisse seosesse (`:99-171`).

**Mõju.** Kui töötaja on kahe organisatsiooni liige, võib ühe organisatsiooni juht näha tema teise organisatsiooni või isikliku töö klientide nimesid, kellaaegu, olekuid ja põhjuseid. Teadaoleva külastuse ID-ga saab ta teise konteksti plaanitud töö ümber määrata. Praegune andmemudel ei võimalda seda piiri päringus jõustada.

**Vastuvõtukriteerium.** Iga organisatsioonist loodud külastus/teekond vajab muutumatut organisatsiooni ja vajadusel üksuse provenantsi; tahvel ja kõik mutatsioonid peavad filtreerima selle provenantsi järgi. Isiklik töö peab jääma eraldi. HTTP/teenusetest peab kasutama üht töötajat kahes organisatsioonis ning tõendama, et kummagi juht ei näe ega muuda teise organisatsiooni ega isiklikke külastusi.

**Seis (10.08.2026): DONE — kood, migratsioon ja testid; tõendatud päris PostgreSQL-i vastu (`npm run slog:org:probe` 19/19).**

**Suurem osa sellest leiust oli juba parandatud SOL-SLOG-17/-18 all** (mõlemad P0,
migratsioon `20260810160000`): `ServiceVisit.assignedOrganizationId` sündis, juhi tahvel
sai teise filtri (`organizationVisitScope`) ja `reassignVisit` kontrollib päritolu **enne
olekut ja enne õigusi**, vastusega **404, mitte 403** — võõra maja töö olemasolu on ise
info. Ülal olev tõendilõik kirjeldab seisu ENNE seda parandust; loend luges leidu
lahtiseks, sest kriteeriumil oli kaks katmata osa.

**Kaks katmata osa said nüüd kaetud.**

**1. „MUUTUMATUT" oli kommentaar, mitte reegel.** Skeem ütles „külmutatud loomise
hetkel", aga miski ei takistanud `update({ data: { assignedOrganizationId } })`-t. See ei
ole tavaline andmeväli: tema väärtus otsustab, KELLE juhi ekraanile kliendi nimi jõuab.
Uus migratsioon `20260810200000` paneb `BEFORE UPDATE` triggeri, mis keelab muutuse **igas
suunas** — `NULL → org` (tõendamata päritolu ei muutu tagantjärele tõendiks), `org → teine
org`, `org → NULL`. **Rea kustutamine EI ole keelatud:** konto kustutus ja säilituse purge
peavad kaskaadina läbi minema. Sama muster mis `UsageEvent`-il ja märkme parandusridadel.
Ühiktest hoiab triggerit migratsiooniahelast vaikselt kadumast.

**2. Kriteeriumi enda tõend puudus.** Olemasolevad testid mõõtsid filtri OTSUST fake-DB
peal — nad ei saa öelda, kas päris PostgreSQL filtreerib samamoodi. `npm run slog:org:probe`
teeb päris andmed: üks töötaja kahes ACTIVE organisatsioonis, **üks ühine tööpäev**
(sond kontrollib, et mõlemad tööd on tõesti samal `routeId`-l — see ongi leiu tingimus),
kummagi maja juht ORG_OWNER-iga, pluss isiklik töö tõendamata päritoluga. Mõõdetud:
kumbki juht näeb ainult oma maja klienti, ei näe teise maja ega isiklikku, ei saa neid
ümber määrata (404), oma maja töö liigub inimeselt inimesele **ilma päritolu kaasa
võtmata**, ja trigger peab kinni mõlemad muutmiskatsed. 19/19.

**Kaks teadlikku piiri, mis jäävad — need ei ole tegemata töö, vaid kirja pandud otsus.**
- **`ServiceWorkRoute` ei kanna organisatsiooni.** Teekond EI OLE organisatsioonist loodud
  objekt: ta on inimese enda tööpäev, üks päevas, ka siis kui ta töötab kahes majas.
  Tagajärg on aus ja dokumenteeritud: mõlema maja juht näeb, **kas** tema liige on päeva
  alustanud (avatud / paus / lõpetatud), ilma ühegi kliendi, aja või põhjuseta. See on
  tahtlik — juht peab teadma, kas inimene on tööl. Kui sa tahad ka selle ära võtta, on see
  tootemuudatus, mitte parandus.
- **Üksuse provenantsi külastus ei kanna.** Üksuse-skoobiga juhi filter käib
  liikmesuse kaudu PÄRINGU AJAL, seega üksusest lahkunud inimese töö kaob tema tahvlilt
  järgmisel päringul, ilma et ükski kirje muutuks. Külmutatud üksus tähendaks vastupidist:
  ümberkorraldus jätaks vana juhile igavese vaate.

### SOL-ORG-02 — graafiku kirjutusrada möödub peatatud organisatsiooni ja mooduli väravast — P1

**Tõend.** `requireOrgContext()` lubab nähtava, kuid peatatud organisatsiooni konteksti `writable: false`; tavapärased org-mutatsioonid kutsuvad seejärel `assertWritable()`. `app/api/org/[orgId]/graafik/route.js:48-81` on ainus tavapärane org-konteksti POST peale status-route’i, mis seda kontrolli ei tee. Selle asemel loeb `resolveBoardScope()` otse aktiivseid liikmesusi ja raw capability-grante (`lib/serviceLog/dispatchBoard.js:60-90`). Ta ei kontrolli organisatsiooni `ACTIVE` staatust ega nõutava `KOV_INTAKE`/`SERVICE_DELIVERY` mooduli aktiivsust, kuigi organisatsioonileping ütleb, et capability kehtib ainult aktiivse organisatsiooni ja aktiivse mooduli korral ning `WORK_ASSIGNER` on mooduliga seotud (`lib/org/constants.js:146-154`).

**Mõju.** Peatatud organisatsiooni liige saab jätkata tööde määramist ja ümbermääramist. Toote mooduli väljalülitamine ei võta graafiku raw capability-õigust ära.

**Vastuvõtukriteerium.** Route peab nõudma `assertWritable(auth.context)` ning teenus peab kasutama kanoonilist `hasCapability()`/aktiivse mooduli konteksti, mitte teist raw-grant resolverit. Negatiivsed testid: `SUSPENDED`, puuduv/aegunud moodul, aegunud grant ja aktiivne kontrolljuhtum.

**Seis (10.08.2026): DONE — kood ja testid; tõendatud päris PostgreSQL-i vastu (`npm run slog:org:probe` 24/24).**

**Värav on KAHES kohas ja see ei ole liigne.** Marsruut kutsub nüüd
`assertWritable(auth.context)` nagu iga teine org-konteksti POST — ta fail'ib kiiresti ja
ühtmoodi kõigi teistega. **Päris parandus on aga teenuskihis:** `resolveBoardScope` tuletab
skoobi ise, seega peab ta ka reeglid ise kandma. Ainult marsruudi parandamine oleks
parandanud ühe kutsuja ja jätnud järgmise lahti — sama kuju nagu SOL-SPROF-02 juures, kus
värav oli algul koridoris, mitte ukse peal.

**Kolm tingimust ühe asemel.** `resolveBoardScope` kontrollib nüüd
(1) organisatsiooni **nähtavust** (arhiveeritu ei ole tööruum),
(2) capability **nõutavat moodulit** (`WORK_ASSIGNER` → `KOV_INTAKE`) ja
(3) **kirjutamisõigust** eraldi lugemisest.

**Lugemine ja kirjutamine on eri küsimused.** Peatatud maja tahvel jääb LOETAVAKS — juht
peab nägema, mis pooleli jäi, muidu kaob peatamise hetkel ülevaade käimasolevast tööst,
mille keegi peab lõpetama. Kirjutamine lõpeb ja vastus on **409, mitte 403**: õigus on tal
alles, muutunud on maja seis, ja see vahe peab teatest välja paistma — 403 saadaks ta oma
capability't otsima, kus ei ole midagi valesti.

**Reeglid on jagatud, mitte kopeeritud.** `requiredModulesForCapability` on sama funktsioon,
mida kasutab `resolveOrgAccessContext`; `VISIBLE_ORG_STATUSES` ja `WRITABLE_ORG_STATUSES`
on nüüd `accessContext`-ist eksporditud, mitte teine koopia. Teine koopia lahkneks esimese
olekumuudatusega ja lahknemise suund oleks alati sama: värav jääks lahti seal, kus teda ei
uuendatud.

**Testid** (`tests/serviceLog/dispatchBoardScope.test.js` + `dispatchAssign.test.js`):
SUSPENDED (loetav, mitte kirjutatav), ARCHIVED, olematu organisatsioon, puuduv moodul,
aegunud/tühistatud grant, **ja kaks negatiivkontrolli** — moodulinõudeta `ORG_OWNER`/
`UNIT_LEAD` ei tohi mooduli puudumise peale kaduda, ning moodulita capability üksus ei tohi
jääda skoopi teise grandi varju. Päris andmebaasis: `npm run slog:org:probe` peatab maja,
mõõdab loetavuse ja 409, lülitab mooduli välja ja sisse.

**Mis JÄÄB lahti ja on eraldi leid:** kaks resolverit on endiselt olemas — teenuskihi oma
ei kasuta `hasCapability()`-t, vaid samu poliitika-primitiive. Nähtav vahe on üksuse
**alampuu**: kanooniline kontekst katab `unitScopeCovers()`-iga alampuu, graafiku resolver
ainult grantis nimetatud üksuse. See on **SOL-ORG-04** (P2) ja jääb tema alla.

### SOL-ORG-03 — töö määramine võib õnnestuda ilma kohustusliku auditijäljeta — P1

**Tõend.** Nii uue külastuse määramine kui ümbermääramine kirjutavad põhiseisu esmalt ja kutsuvad seejärel sama DB `writeOrgAudit()` funktsiooni `.catch(() => {})` kujul (`lib/serviceLog/dispatchAssign.js:153-173`, `:230-248`). Kommentaar lubab, et iga määramine jätab jälje, kuid auditi viga neelatakse ja põhitoiming tagastab edu.

**Mõju.** Teise inimese päevikusse tehtud muudatus võib jääda ilma tõendita, kes selle tegi. Ümbermääramise vaidlust või kuritarvitust ei saa hiljem usaldusväärselt rekonstrueerida.

**Vastuvõtukriteerium.** Külastuse kirjutus ja auditirida peavad olema ühes DB tehingus; auditi vea korral ei tohi põhimuudatus commit’ida. Veasüstetest peab sundima auditirea loomise vea mõlemal rajal.

**Seis (10.08.2026): DONE — kood (SOL-SLOG-18), veasüstetestid ja päris PostgreSQL-i tagasikerimine (`npm run slog:org:probe` 30/30).**

**Mehhanism oli juba parandatud SOL-SLOG-18 all:** `.catch(() => {})` on kadunud, mõlemal
rajal on külastus ja auditirida ühes `$transaction`-is. Ülal olev tõendilõik kirjeldab
seisu enne seda parandust. **Puudu oli kriteeriumi teine pool — veasüstetest** —, ja ilma
selleta ei olnud midagi, mis hoiaks jälje tehingust välja rändamast.

**Auditikirjutus on nüüd süstitav port** (`writeAudit`), vaikeväärtuseks päris
`writeOrgAudit`. Vaikeväärtus on siin õige, sest ta EI OLE vaikne edu — ta on seesama
kirjutus, mis tehingus niikuinii toimuks. (Vrd `serviceProfileRagRemoval`, kus vaikeväärtust
teadlikult EI OLE: seal oleks ta muutnud seadistamata teenuse vaikseks õnnestumiseks.)

**Kaks tasandit, sest üks ei piisa.**
- **Ühiktestid** (`dispatchAssign.test.js`) tõendavad, et viga **ei neelata** — kumbki rada
  ei tohi tagastada edu, kui audit kukkus — ja et audit saab **tehingu käepideme** (`tx`),
  mitte välise kliendi. Väline klient tähendaks auditirida, mis jääb alles ka siis, kui
  põhimuudatus tagasi keritakse: jälg tööst, mida ei ole.
- **Sond** tõendab **tagasikerimise ise**, sest see on PostgreSQL-i käitumine, mitte meie
  oma — fake-`$transaction` ei ütle selle kohta midagi. Mõõdetud: kukkunud auditiga
  määramine ei jäta ühtki rida (loendur enne = pärast, orbu ei ole) ja kukkunud auditiga
  ümbermääramine jätab töö endisele omanikule ja endisele teekonnale.

### SOL-ORG-04 — üksuse capability ei kata graafikus lubatud alampuud — P2

**Tõend.** Kanooniline org-kontekst kasutab `unitScopeCovers()` funktsiooni ja loeb üksuseskoobi alla ka alampuu (`lib/org/accessContext.js`, `hasCapability`). Graafiku eraldi resolver taandab skoobi ainult grantides otseselt nimetatud `scopeUnitId` väärtustele ja filtreerib töötajad täpselt nende ID-dega (`lib/serviceLog/dispatchBoard.js:82-90`, `:113-118`).

**Mõju.** Osakonnajuht ei näe ega saa määrata tööd osakonna allüksuste töötajatele, kuigi sama capability töötab mujal lepingukohaselt alampuule.

**Vastuvõtukriteerium.** Eemaldada paralleelne skoopiarvutus või kasutada sama `unitScopeCovers()` loogikat. Test peab katma valitud üksuse, lapse, õe ja vanema.

**Seis (10.08.2026): DONE — kood ja testid; tõendatud päris PostgreSQL-i vastu (`npm run slog:org:probe` 34/34).**

**Sama funktsioon, mitte teine koopia.** `resolveBoardScope` laiendab üksuse-skoobiga
grandid `collectSubtree()`-ga — seesama funktsioon, mille peal seisab `unitScopeCovers()`
kanoonilises kontekstis. Paralleelset skoopiarvutust ei kirjutatud juurde; see, mis oli,
sai õige alusega.

**See viga oli KITSENDAV, mitte lekkiv** — osakonnajuht ei näinud oma allüksuse töötajaid
ega saanud neile tööd määrata. Oht ei olnud seega andmelekkes, vaid selles, et ühes tootes
elas kaks eri skoobimõistet ja keegi pidi meeles pidama, kumb kus kehtib.

**Puud loetakse ainult vajadusel:** org-skoobiga juht katab niikuinii kõik üksused ja tema
päring ei puuduta `OrganizationUnit` tabelit üldse (eraldi test mõõdab just seda).

**Testid katavad kriteeriumi neli juhtumit** (`dispatchBoardScope.test.js`): valitud üksus,
laps, õde (ei leki), vanem (ei leki), pluss juurüksus (kogu haru) ja leht (jääb üheks).
Sondis on sama puu päris ridadena — osakond → allüksus → õeosakond, `depth` salvestatud
väljana: osakonnajuht näeb ja saab määrata allüksuse töötajale, õeüksuse töötajale ei näe
ega saa (403).

### SOL-ORG-05 — kohaplaani limiiti ja lõpetamist saab paralleelse kohaandmisega rikkuda — P1

**Tõend.** `assignSeat()` loeb plaani staatuse ja limiidi enne plaanirea `FOR UPDATE` lukku ning kasutab pärast luku saamist sama varem loetud objekti (`lib/org/seats.js:201-210`, `:236-250`). `updateSeatLimit()` loeb aktiivsete kohtade arvu ja muudab limiiti ilma sama plaanirea eellukuta (`:114-130`). `endSeatPlan()` lõpetab olemasolevad kohad ja alles seejärel plaani, samuti ilma kohaandmisega ühist lukuprotokolli kasutamata (`:144-167`). Seetõttu võib limiidi vähendamisega paralleelselt vana limiidi järgi lisanduda uus koht või pärast kohtade hulgi lõpetamist lisanduda aktiivne koht plaani, mis seejärel lõpetatakse. Migratsiooni kontrollid nõuavad ainult mittenegatiivset limiiti ja ühe aktiivse koha olemasolu liikmesuse kohta; aktiivsete kohtade arvu ning aktiivse vanemplaani seost need ei jõusta (`prisma/migrations/20260801120000_org_funding_inbox_v1/migration.sql:263-271`, `:288-303`). `resolveAccessContext()` loeb maksja tuvastamisel aktiivset kohaandmist, kuid ei nõua aktiivset kohaplaani (`lib/org/accessContext.js:243-252`, `:295-315`).

**Mõju.** Organisatsioon võib saada rohkem tasulisi kohti kui lepinguline limiit või lõpetatud plaani alla võib jääda aktiivne koht. Viimane võib jätkuvalt määrata organisatsiooni kasutaja maksjaks, kuigi plaan on lõpetatud; arveldus- ja ligipääsutõde lahknevad.

**Vastuvõtukriteerium.** Koha andmine, limiidi muutmine ja plaani lõpetamine peavad kasutama sama plaanirea lukku ning lugema staatuse/limiidi uuesti alles luku all. Maksja päring peab nõudma ka aktiivset ja kehtivat vanemplaani. Päris PostgreSQLi paralleelsustestid peavad katma `assign vs limit decrease` ja `assign vs end plan` mõlemas ajastuses ning tõendama, et `usedSeats <= seatLimit` ja lõpetatud plaanil pole aktiivseid kohti.

**Seis (10.08.2026): DONE — kood ja paralleelsussond (`npm run org:seat:probe` 26/26; vana koodi vastu 10 punast).**

**LUKK OLI ÕIGEL REAL, AGA OTSUS TEHTI LUKU-EELSE TÕE PEALT.** `assignSeat` võttis
`FOR UPDATE`-i, aga luges `status`-e ja `seatLimit`-i **enne** seda ja kasutas pärast luku
saamist sama, juba vananenud objekti. Vahepeal commit'unud limiidi langetus või plaani
lõpetamine oli talle nähtamatu. See on TOCTOU peenem kuju kui „lukku ei ole" — ja just
seepärast nägi kood parandatud välja.

`updateSeatLimit` ja `endSeatPlan` ei võtnud lukku üldse: Postgres andis neile rea luku
alles `UPDATE` hetkel, ehk **pärast** loendust.

**Üks protokoll kolmele kirjutajale.** Uus `lockSeatPlan(tx, orgId, planId)` teeb kaks
sammu ja nende järjekord on kogu mõte: **(1) lukusta plaanirida, (2) loe plaani seis alles
siis.** Kõik kolm rada kutsuvad teda. Invariant, mille kolm kirjutajat hoiavad kolme eri
protokolliga, ei ole invariant.

**Maksja nõuab nüüd ka kehtivat vanemplaani.** Kaks tingimust, mis on eri asjad ja mõlemad
vajalikud: `status: ACTIVE` (plaani ei ole lõpetatud) ja `validUntil` tulevikus või tühi
(plaan ei ole aegunud). Aegunud plaan võib jääda `ACTIVE`-ks, kuni keegi ta lõpetab —
ilma teise tingimuseta maksaks organisatsioon ligipääsu eest, mida ta enam ei tellinud.

**Sond on deterministlik, mitte „mahtusid ühte sekundisse".** Kolmas tehing võtab plaanirea
luku ja hoiab; mõlemad võistlejad käivitatakse ja **mõõdetakse, et nad ootavad**; lukk
lastakse lahti ja Postgres annab ta ootejärjekorra järjekorras — seega võistlejate järjekord
on see, mille meie valisime. Kumbki ajastus jooksutatakse eraldi.

**Sond kukub vana koodi vastu: 10 punast 26-st** — `used=2 limit=1` mõlemas
limiidi-ajastuses, aktiivne koht lõpetatud plaani all mõlemas lõpetamis-ajastuses, ja
maksja, kes ütleb `ORGANIZATION` nii lõpetatud kui aegunud plaani all. Ilma selle
kontrollita ei tõendaks roheline sond midagi.

### SOL-ORG-06 — sponsorluse vastuvõtmine ja tühistamine võivad anda vastuolulise lõppseisu — P1

**Tõend.** Vastuvõtmine, keeldumine ja organisatsioonipoolne tagasivõtmine loevad sponsorluse esmalt olekus `PENDING`, kuid ükski neist ei lukusta rida ega tee tingimuslikku `UPDATE ... WHERE status = 'PENDING'` üleminekut (`lib/org/sponsorship.js:155-178`, `:233-295`, `:310-327`). Vastuvõtmine loob või kirjutab kasutaja tellimuse üle enne sponsorluse `ACCEPTED` olekut. Kui vastuvõtmine ja tagasivõtmine/keeldumine loevad mõlemad sama algseisu, võib hilisem tingimusteta update teise tehingu tulemuse üle kirjutada. Migratsioonis on unikaalsus ainult ühe organisatsiooni ja e-posti avatud kutse kohta; olekumasina üleminekuid ega sponsorluse/tellimuse kooskõla DB ei jõusta (`prisma/migrations/20260801120000_org_funding_inbox_v1/migration.sql:279-282`). Olemasolevad rahastuslepingutestid kontrollivad skeemi kuju, mitte konkureerivaid teenusekutseid.

**Mõju.** Tellimus võib jääda aktiivseks organisatsiooni kulul, kuigi sponsorlus on lõppseisus `REVOKED` või `DECLINED`; vastupidises ajastuses võib juba tagasivõetud kutse siiski aktiveeruda. Arveldus-, audit- ja kasutaja ligipääsuolek ei kirjelda enam sama sündmust.

**Vastuvõtukriteerium.** Kõik kolm üleminekut peavad serialiseeruma sama sponsorlusrea lukul või kasutama atomaarset tingimuslikku olekuvahetust, mille täpselt üks võistleja võidab. Tellimuse muutmine ja `ACCEPTED` olek peavad jääma samasse tehingusse. Päris PostgreSQLi testid peavad katma `accept vs revoke`, `accept vs decline` ja korduva `accept` kutse ning tõendama üheainsa koherentse lõppseisu.

**Seis (10.08.2026): DONE — kood ja paralleelsussond (`npm run org:sponsor:probe` 33/33; vana koodi vastu 10 punast).**

**Atomaarne tingimuslik üleminek, mitte eraldi lukk.** `claimPendingSponsorship` teeb
`updateMany ... WHERE status = 'PENDING'`: Postgres võtab rea luku ja hindab tingimuse
UUESTI luku all (READ COMMITTED), seega teine võistleja leiab 0 rida ja **teab, et ta
kaotas**. Eraldi `SELECT ... FOR UPDATE` ei ole vaja — tingimuslik `UPDATE` ise ON see lukk.
Kõik kolm väljapääsu (`accept`, `decline`, `revoke`) käivad sealt läbi.

**Nõue on nüüd tehingu ESIMENE kirjutus.** Vastuvõtmine kirjutas varem `Subscription`-i
enne sponsorluse olekut; paralleelne tagasivõtmine sai vahele jääda ja lõppseis oli
**aktiivne organisatsiooni makstud tellimus `REVOKED` kutse all**. Kes nõude kaotab, ei
jõua enam tellimuseni.

**Sond kukub vana koodi vastu 10 korda 33-st,** igas neljas ajastuses „võitjaid 2". Kaks
tulemust väärivad nimetamist:
- `revoke→accept` lõppseis oli **`ACCEPTED`** — tagasivõtmine kirjutati üle, täpselt nagu
  leid ennustas;
- korduv `accept` tegi kasutajale **kaks `Subscription` rida**. Seda leid ise ei nimetanud;
  ta tuli välja alles siis, kui sond kaht samaaegset vastuvõtmist päriselt proovis.

**Sond mõõdab KOHERENTSUST, mitte ainult olekut:** iga ajastuse järel kontrollitakse, et
sponsorluse olek ja tellimuse maksja kirjeldavad sama sündmust — `ACCEPTED` all peab
organisatsiooni makstud tellimus OLEMA ja viitama samale kutsele, iga muu olek all mitte
olema. Just see paar läks vana koodiga lahku.

### SOL-ORG-07 — organisatsiooni sponsoreeritud tellimus kuvatakse kasutajale omamaksena — P2

**Tõend.** Organisatsiooni sponsorluse vastuvõtmine salvestab `billingSource: SPONSORED_BY_ORGANIZATION` (`lib/org/sponsorship.js:270-285`) ja access-context tunneb selle eraldi maksjaallikana ära (`lib/org/accessContext.js:102-120`). Tellimuse kanooniline serialiseerija loeb aga sponsoreerituks ainult `SPONSORED_BY_HOST` väärtuse (`lib/subscriptionView.js:40-51`), mistõttu uue allika olekuks jääb tavaline `ACTIVE`, `isSponsored` on väär ning sponsorluse lõpuhoiatusi ei teki. Tellimuse UI näitab `isSponsored === false` korral tühistamise tegevust (`components/alalehed/TellimusBody.jsx:433-450`), kuigi serveri DELETE muudab ainult `billingSource: SELF` ridu (`app/api/subscription/route.js:205-240`). Ka kasutusülevaade eristab sponsorlusena ainult `SPONSORED_BY_HOST` (`components/profile/UsageOverview.jsx:113`). `tests/payments/subscriptionView.test.js` sponsorlustestid kasutavad üksnes vana host-allikat.

**Mõju.** Organisatsiooni rahastatud pöördujale näidatakse vale maksjat ja vale tühistamisvõimalust; tühistamisnupp ei muuda tegelikku tellimust. Sponsorluse lõppemise hoiatus ning sponsoreeritud/omamakse analüütika võivad samuti olla valed.

**Vastuvõtukriteerium.** Keskne serialiseerija peab käsitlema mõlemat sponsorlusallikat sponsoreerituna, säilitades UI jaoks vajadusel täpse sponsori liigi ja organisatsiooni nime minimaalse projektsioonina. Tellimuse, kasutusülevaate ja tühistamise UI peab lähtuma samast serveritõest. Testid peavad katma aktiivse, peatselt lõppeva ja aegunud `SPONSORED_BY_ORGANIZATION` tellimuse ning tõendama, et kasutaja ei näe mittetoimivat omamakse tühistamist.

**Seis (10.08.2026): DONE — kood ja testid.**

**Kaks allikat, üks mõiste.** `SPONSORED_BY_HOST` on üksikisiku kutse, `SPONSORED_BY_ORGANIZATION`
on organisatsiooni oma. Kasutaja jaoks on need sama asi: **keegi teine maksab ja mina ei saa
seda tellimust tühistada.** Serialiseerija tunneb nüüd mõlemat (`isSponsoredBillingSource`),
ja `sponsorKind` (`"HOST"` / `"ORGANIZATION"` / `null`) hoiab vahe alles neile, kes seda
päriselt vajavad — ilma et keegi peaks sõnesid võrdlema.

**Vale nupp on halvem kui puuduv nupp.** Tühistamisnupp ilmus `isSponsored === false` peale,
aga server puudutab ainult `SELF` ridu: organisatsiooni rahastatud pöörduja vajutas nuppu,
mis ei teinud midagi. Nüüd on nupp peidus, sest serverivastus ütleb tõtt.

**Kasutusülevaade küsib nüüd serverilt, mitte ei võrdle sõnet.** `UsageOverview` luges
`billingSource === "SPONSORED_BY_HOST"` — täpselt see võrdlus jäi uue allika lisandumisel
uuendamata. `lib/usage/snapshot.js` annab nüüd `isSponsored` ja `sponsorKind`.

**Test loeb enum'i SKEEMIST, mitte käsitsi kirjutatud loendist.** Uus maksjaallikas, mida
keegi ei registreeri sponsorluseks, kukutab testi — mitte kasutaja nuppu. See on sama
klass, mis leidu tekitas: väärtus lisati enum'i ja üks võrdlus jäi maha.

**Mis EI OLE tehtud ja miks:** kriteerium lubab „organisatsiooni nime minimaalse
projektsioonina". Nime UI-sse ei lisatud — see oleks uus andmeväli kliendile, mitte
paranduse osa, ja `sponsorKind` katab vajaduse eristada. Kui omanik tahab kuvada „Maksab
Harku vald", on see eraldi tootemuudatus.

### SOL-ORG-08 — suletud või tagasivõetud pöördumise saab uuesti töötajale avada — P1

**Tõend.** `assignWork()` kontrollib kirje olemasolu, määraja capability't, varasema elava määramise puudumist ja saaja aktiivset org-liikmesust, kuid ei nõua kirje määratavat olekut ega välista `CLOSED`, `REJECTED` või `RECALLED` seisu (`lib/org/inbox.js:607-654`). Kui olekumasin ei luba kirjet `ASSIGNED` olekusse viia, jäetakse põhikirje lihtsalt muutmata, kuid uus `PENDING` määramine on selleks hetkeks juba loodud (`:630-645`). `requireVisibleInboxItem()` annab elava määramise saajale kirje ja valge nimekirja projektsiooni vaatamise õiguse sõltumata põhikirje olekust (`:464-492`, `:495-540`). Samad read pole sulgemise/tagasivõtmisega ühise luku all: `recallInboxItemForSourceWithin()` ja sulgev `transitionInboxItem()` lõpetavad hetkel nähtavad määramised `updateMany` abil (`:303-340`, `:544-597`), kuid paralleelne assign võib pärast seda uue elava rea lisada. `respondToAssignment()` muudab varem loetud `PENDING` määramise tingimusteta `ACCEPTED`-iks ja võib sulgemisega võisteldes lõpetatud töö taaselustada (`:672-725`).

**Mõju.** Saatja selge tagasivõtmine või organisatsiooni sulgemisotsus ei lõpeta usaldusväärselt ligipääsu. Koordinaator saab otse API kaudu jagada tagasivõetud pöördumise kinnitatud sisupaketi uuele töötajale; paralleelsus võib sama teha ilma tahtliku kuritarvituseta.

**Vastuvõtukriteerium.** Määramine, vastamine, üleandmine, sulgemine ja tagasivõtmine peavad kasutama sama kirje lukku ning tingimuslikke olekusiirdeid. `assignWork` peab lubama ainult lepingus nimetatud avatud seisud; `respond` ja `handover` peavad tõendama nii määramise kui põhikirje jätkuva elususe. Negatiivsed teenuse- ja HTTP-testid peavad katma kõik terminalolekud ning `assign/respond/handover vs close/recall` võistlused, tõendades et terminalkirjel pole elavat määramist ega uut lugejat.

**Seis (10.08.2026): DONE — kood, testid ja võistlussond (`npm run org:inbox:probe` 51/51).**

**AUS PIIR ESIMESENA: suurem osa sellest leiust oli juba parandatud SOL-PRE-02 all.** Kirje
rea lukk (`lockInboxItemRow`) ja terminalseisu värav on olemas kõigil viiel rajal. Sond
kukub vana koodi vastu ainult **2 korda 51-st** — mitte kümme, nagu ORG-05/-06 juures. Kes
loeb ülalolevat tõendilõiku, loeb seisu ENNE SOL-PRE-02-t.

**Kaks päris auku, mis alles jäid, ja mõlemad on samast juurest:** määramise elusust
kontrolliti **enne kirje lukku loetud koopiast**.
- `respondToAssignment` luges `assignment.status`, siis võttis luku. Vahepealne **üleandmine
  ei tee kirjet terminaalseks**, seega terminalivärav ei püüdnud teda — tingimusteta
  `update` oleks äraantud töö tagasi ellu äratanud.
- `handOverWork` sama muster: kaks samaaegset üleandmist nägid mõlemad elavat rida.

Mõlemad on nüüd **tingimuslikud `updateMany`-d**: `WHERE id = ? AND status = 'PENDING'`
(vastamine) ja `... status IN ('PENDING','ACCEPTED')` (üleandmine). Kui kirjutus ei
toimunud, siis me kaotasime.

**Mis vana koodi PÄÄSTIS ja miks sellest ei piisa.** Osaline unikaalindeks
`(inboxItemId) WHERE status IN ('PENDING','ACCEPTED')` püüdis mõlemad juhtumid kinni —
andmed ei riknenud. Aga kaotaja sai **`P2002`**, mitte konflikti: kasutajale tähendab see
tundmatut viga seal, kus vastus on lihtne ja aus („selle töö andis keegi juba edasi").
Indeks on viimane kaitseliin, mitte veateade.

**Siirded arvutatakse nüüd luku all loetud seisust** (`inboxNow.status`), mitte tehingu
alguse koopiast — vananenud alus otsustaks, kuhu kirje liigub.

**`assignWork` küsib nüüd seisumasinalt, mitte terminali-eitust.** „Mitte-terminaalne" ei
ole sama mis „määratav": `ACCEPTED` kirjel EI OLE siiret `ASSIGNED`-isse, aga vana kood
laskis ta läbi ja lõi uue `PENDING` määramise, ilma et laual midagi muutuks. **Ausalt: seda
seisu ei ole täna võimalik tekitada** — iga rada, mis määramise lõpetab, viib kirje ka
terminaali. See muudatus teeb invariandi kohalikuks ja selgeks, selle asemel et sõltuda
kättesaadavuse-arutlusest, mis järgmise raja lisandumisel vaikselt katkeb.

**Sond katab kõik kolm terminalseisu eraldi** (`CLOSED`, `REJECTED`, `RECALLED` — kolm eri
sündmust, mitte üks) ja neli võistlust mõlemas ajastuses: `assign vs recall`,
`respond vs close`, `handover vs respond`, `handover vs handover`. Iga stsenaariumi järel
mõõdetakse sama invariant: **terminalkirjel ei ole ühtki elavat määramist — ehk mitte ühtki
uut lugejat.**

### SOL-ORG-09 — tagasivõetud liikmekutse võib samaaegse vastuvõtmisega siiski õigused anda — P1

**Tõend.** `acceptInvite()` loeb kutse `PENDING` oleku tehingu sees, kuid ei lukusta kutserida; pärast liikmesuse ja capability-grantide loomist muudab ta kutse ID järgi tingimusteta `ACCEPTED`-iks (`lib/org/inviteService.js:212-299`). `revokeInvite()` ja `declineInvite()` kasutavad sama loe-olek → tingimusteta update mustrit (`:144-167`, `:320-345`). Kaks tehingut võivad seega mõlemad lugeda `PENDING`: revoke võib pärast edukat accept’i lõppoleku `REVOKED`-iks üle kirjutada, jättes liikmesuse ja õigused alles, või accept võib enne revoke’i commit’i loetud kutse põhjal õigused siiski luua. Aktiivse liikmesuse osaline unikaalindeks piirab kahte paralleelset accept’i, kuid ei seo liikmesuse loomist kutse võidetud olekusiirdega.

**Mõju.** Organisatsiooni administraatori tühistamisotsus ei ole turvapiir: ajastusest sõltuvalt võib tühistatud kutse siiski luua aktiivse liikmesuse ja õigused või audit näidata kutset tühistatuna, kuigi ligipääs anti.

**Vastuvõtukriteerium.** `accept`, `revoke` ja `decline` peavad võistlema ühe atomaarse `PENDING` olekusiirde või sama kutser ea luku pärast; liikmesus ja capability’d luuakse ainult accept’i võidetud tehingus. Päris PostgreSQLi testid peavad katma kõik kolm paarisvõistlust ja tõendama, et `REVOKED/DECLINED` kutsel pole sellest kutsest loodud aktiivset liikmesust.

**Seis (10.08.2026): DONE — kood ja paralleelsussond (`npm run org:invite:probe` 38/38; vana koodi vastu 14 punast).**

**Sama muster mis SOL-ORG-06-l, aga rangem tagajärg.** Seal oli valeks lõppseisuks vale
maksja; siin on selleks **liikmesus ja capability-grandid**. `claimPendingInvite` teeb
`updateMany ... WHERE status = 'PENDING'`: rea lukk ja tingimuse uuestihindamine on üks
samm, ja kaotaja leiab 0 rida.

**Nõue on vastuvõtmise ESIMENE kirjutus.** Varem loodi liikmesus ja grandid esimesena ning
kutse olek alles pärast. Kes nõude kaotab, ei jõua nüüd liikmesuseni.

**Vana koodi vastu 14 punast 38-st ja üks neist on see leid ise:**
`REVOKED` kutse all oli **aktiivne liikmesus koos grandiga** — administraatori tühistamine
ei olnud turvapiir, vaid ajastuse küsimus. Vastupidises ajastuses kirjutati tühistamine üle
ja lõppseis oli `ACCEPTED`.

**Sond mõõdab koherentsust, mitte olekut:** iga stsenaariumi järel kontrollitakse, et kutse
olek ja **väljaantud õigused** kirjeldavad sama sündmust. Mall on teadlikult `MEMBER_ADMIN`,
et „kutse ei tohi õigusi anda" oleks mõõdetav rohkem kui ühe grandi peal. Kaetud on kõik
kolm paari (`accept/revoke`, `accept/decline`, `revoke/decline`) mõlemas ajastuses ja
korduv `accept`.

**Võistlusriist on nüüd jagatud** (`scripts/probe-race-harness.mjs`): sama retsept elas
neljas sondis eraldi ja vigane võistlusriist annaks ROHELISE tulemuse, mitte punase — see
on täpselt see koopia, mida ei tohi lasta lahku minna.

### SOL-ORG-10 — offboarding võib lõppeda aktiivse töö või kohaga — P1

**Tõend.** `endMembership()` loeb liikmesuse, kontrollib viimast omanikku ja loendab elavad tööd, kuid ei lukusta liikmesuse rida ega töö/koha määramise väravat; seejärel lõpetab hetkel nähtavad kohad, capability’d ja üksuseseosed ning märgib liikmesuse lõppenuks (`lib/org/members.js:393-458`). Viimase omaniku kontroll loeb aktiivsed `ORG_OWNER` grantid samuti ilma lukuta (`:461-476`), mistõttu kaks allesjäänud omanikku võivad paralleelselt mõlemad näha, et nad pole viimased, ja mõlemad lahkuda. `assignWork()` kontrollib saaja aktiivsust eraldi päringuga ja loob määramise hiljem (`lib/org/inbox.js:607-638`); `assignSeat()` loeb liikmesuse aktiivsust enne loomist ning lukustab ainult kohaplaani (`lib/org/seats.js:201-250`). Kui offboarding loendab/lõpetab olemasolevad read ja paralleelne määramine on aktiivse liikmesuse juba lugenud, võib uus töö või koht lisanduda pärast vastavat kontrolli. Skeemi välisvõtmed tõendavad ainult liikmesuse rea olemasolu, mitte selle `ACTIVE` olekut; `onDelete: Restrict` ei aita, sest offboarding rida ei kustuta.

**Mõju.** Edukalt lahkunuks märgitud töötajale võib jääda elav organisatsioonitöö või organisatsiooni rahastatud koht. Töö jääb praktiliselt omanikuta, rahastus võib jätkuda ning süsteemi offboarding-raport annab vale kindluse. Ka organisatsioon võib jääda ühegi aktiivse omanikuta ja muutuda tavakasutaja õigustega parandamatuks.

**Vastuvõtukriteerium.** Liikmesuse lõpetamine ning kõik uut tööd, kohta või õigust loovad rajad peavad kasutama ühist liikmesusrea lukku ja kontrollima `ACTIVE` staatust luku all. Offboarding peab vahetult enne commit’i tõendama, et elavaid töid/kohti pole. Päris PostgreSQLi testid peavad katma `endMembership vs assignWork`, `endMembership vs handover`, `endMembership vs assignSeat` ning viimase omaniku paralleelsed lõpetamised.

**Seis (10.08.2026): DONE — kood ja paralleelsussond (`npm run org:offboard:probe` 39/39; vana koodi vastu 13 punast).**

**KAKS KÜSIMUST, ÜKS RIDA.** Lahkumine küsib „kas sellel inimesel on veel elavat tööd või
kohta"; töö määramine ja koha andmine küsivad „kas see liikmesus on veel aktiivne". Ilma
ühise lukuta võisid **mõlemad vastused olla korraga õiged ja tulemus vale**. Sond
reprodutseeris vana koodiga täpselt selle: `ENDED` liikmesus, mille küljes on elav juhtum
(1) ja aktiivne makstav koht (1).

**`lockMembershipRow` on nüüd jagatud** (`lib/org/members.js`) ja teda võtavad `assignWork`,
`handOverWork` ja `assignSeat` **enne** aktiivsuse lugemist, `endMembership` enne kõike muud.

**LUKUJÄRJEKORD ON OSA PARANDUSEST:** liikmesuse rida võetakse ALATI VIIMASENA. Töö
määramine hoiab enne teda postkastikirjet, koha andmine kohaplaani, lahkumine
organisatsiooni rida — ükski neist ei taotle teise „vanemat", seega tsüklit ja ummikseisu
ei teki.

**Viimase omaniku võistlus on TEISEST reast.** Kaks omanikku lahkumas korraga on eri
liikmesustel: kummagi enda lukk ei pane neid järjekorda ja mõlemad näevad, et nad ei ole
viimased. Ainus ühine rida on **organisatsioon ise** — `lockOrganizationRow` serialiseerib
lahkumised ja teine saab „viimane omanik ei saa lahkuda".

**Koht EI BLOKEERI lahkumist, ta LÕPETATAKSE — ja see vahe on tahtlik.** Töö on kellegi
teise juhtum, mille üleandmine on inimlik otsus; koht on arve rida, mille lõpetamine on
lahkumise otsene tagajärg. Sond mõõdab mõlemat: elava tööga inimene ei saa lahkuda, äsja
antud kohaga saab — ja lõppseisus ei ole kohta.

**Aus märkus sondi enda kohta:** viimase omaniku stsenaarium kukub vana koodi vastu
„ootamise" kontrolli peal (vana `endMembership` ei võta organisatsiooni lukku, seega ta ei
oota), mitte lõppseisu peal — minu ajastusega jõudsid nad niikuinii järjest. Struktuurne
puudumine on tõendatud, päris kahe-omaniku kadu ei ole reprodutseeritud.

### SOL-ORG-11 — viimase organisatsiooniomaniku õiguse saab eemaldada — P1

**Tõend.** Liikmesuse lõpetamine kutsub `isLastActiveOwner()` kontrolli ja keeldub viimase `ORG_OWNER` liikme lahkumisest (`lib/org/members.js:393-406`, `:461-476`). Capability eemaldamise rada loeb aga ainult sihtgrandi olemasolu ja tühistab selle tingimusteta; erandit viimase aktiivse `ORG_OWNER` grandi jaoks ei ole (`:182-218`). API nõuab küll kutsujalt `ORG_OWNER` õigust, kuid lubab tal sihtida ka enda granti (`app/api/org/[orgId]/members/[membershipId]/capabilities/[grantId]/route.js:10-23`).

**Mõju.** Ainus omanik saab ühe päringuga jätta organisatsiooni ilma ühegi aktiivse omanikuta. Pärast seda ei saa tavapäraste route’ide kaudu enam õigusi, mooduleid ega organisatsiooni elutsüklit hallata; taastamine vajab platvormiadmini erakorralist sekkumist või otsekirjutust andmebaasi. Kahe viimase omaniku paralleelne revoke tekitab sama seisu isegi siis, kui lisada ainult lukuta eelkontroll.

**Vastuvõtukriteerium.** `ORG_OWNER` grandi revoke ja liikmesuse lõpetamine peavad kasutama ühist organisatsioonipõhist lukku ning jätma commit’i hetkel vähemalt ühe aktiivse omaniku. Testid peavad katma enda viimase grandi revoke’i, teise viimase omaniku revoke’i ning kahe omaniku paralleelse revoke/offboard kombinatsioonid.

**Seis (10.08.2026): DONE — kood ja sond (`npm run org:offboard:probe` 48/48).**

**SAMA REEGEL, TEINE UKS.** Lahkumine oli kaitstud (`isLastActiveOwner`), õiguse eemaldamine
mitte — üks päring jättis maja ilma ühegi aktiivse omanikuta. `revokeCapability` võtab nüüd
**sama organisatsiooni rea luku**, mille lisas SOL-ORG-10, ja keeldub viimase `ORG_OWNER`
grandi eemaldamisest.

**Kutsuja OMA grant on sama range.** „Ma tean, mida teen" ei aita, kui tulemus on maja,
mida keegi hallata ei saa: pärast seda ei saa ükski tavapärane route enam õigusi, mooduleid
ega elutsüklit puutuda ja taastamine vajaks platvormiadmini erakorralist sekkumist.

**Lukk on siin sama vajalik kui reegel.** „Viimane omanik" on ORGANISATSIOONI omadus, mitte
grandi oma: kaks viimast omanikku, kes eemaldavad korraga teineteise (või iseenda) õiguse,
on eri ridadel ja kummagi enda lukk ei paneks neid järjekorda.

**Sond katab kriteeriumi kolm juhtumit** (`org:offboard:probe` osad 5–6): enda viimase
grandi eemaldamine, **negatiivkontroll** (teise omaniku olemasolul PEAB eemaldamine
õnnestuma — muidu oleks reegel lukk, mitte kaitse), viimaseks jäänud teise omaniku
eemaldamine, ja `offboard vs revoke` võistlus organisatsiooni luku peal. Vana koodi vastu:
**enda viimane omanikuõigus läks eemaldatuks.**

### SOL-ORG-12 — paralleelne olekusiire võib arhiveeritud organisatsiooni taas aktiveerida — P1

**Tõend.** Olekuleping määrab `ARCHIVED` terminalseisuks, kust pole ühtegi lubatud siiret (`lib/org/constants.js:36-45`). `changeOrganizationStatus()` loeb algoleku, valideerib siirde mälus ja teeb hiljem organisatsiooni ID järgi tingimusteta update’i; rida ei lukustata ja update ei nõua enam algoleku püsimist (`lib/org/organizations.js:152-207`). Näiteks `PENDING_VERIFICATION → ACTIVE` ja `PENDING_VERIFICATION → ARCHIVED` on mõlemad lubatud. Kui platvormiadmin ja omanik loevad sama algoleku, võib arhiveerimine commit’ida esimesena ning varem kontrollitud aktiveerimine kirjutada selle järel staatuseks `ACTIVE`. Skeemi `verifiedAt` kontroll ei keela seda, sest aktiveeriv tehing lisab ka verifitseerimisaja. Olemasolev test tõendab ainult järjestikust `canTransitionOrganizationStatus("ARCHIVED", "ACTIVE") === false`, mitte võistlevat teenusekutset.

**Mõju.** Terminalseks lubatud organisatsioon võib taastuda koos vanade liikmesuste ja grantidega. See rikub arhiveerimise turva- ja elutsüklilepingut ning muudab auditi ajaloo vastuoluliseks: samas ajajärjestuses võivad olla `ARCHIVED` sündmus ja hilisem aktiivne seis ilma lubatud taasavamiseta.

**Vastuvõtukriteerium.** Olekusiire peab lukustama organisatsioonirea või tegema atomaarse `UPDATE` tingimusega `id + expected fromStatus`; kaotaja peab saama 409 ja kõrvalmõju/audit peab puuduma. Päris PostgreSQLi test peab katma vähemalt `activate vs archive`, `suspend vs archive` ja kaks eri lubatud siiret samast algolekust ning tõendama, et `ARCHIVED` ei taastu kunagi.

**Seis (10.08.2026): DONE — kood ja sond (`npm run org:offboard:probe` 60/60; vana koodi vastu 6 punast).**

**Siire on nüüd TINGIMUSLIK.** `updateMany ... WHERE id = ? AND status = fromStatus` hindab
algolekut andmebaasis, rea luku all. Ülemine `canTransitionOrganizationStatus` kontroll
hindas MÄLUS loetud algolekut — ja kaks lubatud siiret samast algolekust
(`PENDING_VERIFICATION → ACTIVE` ja `→ ARCHIVED`) võisid mõlemad selle läbida.

**Vana koodi vastu reprodutseeritud, täpselt nagu leid ennustas:** `archive→activate`
lõppseis oli **`ACTIVE`** — terminaliks lubatud maja taastus koos vanade liikmesuste ja
grantidega.

**Kaotaja EI JÄTA auditijälge.** Vana koodiga jäi ühe päris muutuse kohta **kaks**
siirdesündmust ja ajalugu luges „arhiveeritud, siis aktiveeritud" — ilma et taasavamine
oleks kunagi lubatud olnud. Nüüd viskab kaotaja enne kirjutust ja tema tehing keritakse
tagasi: sündmust, mida ei toimunud, ei tohi ajaloos olla.

**Veateade loeb VÄRSKE seisu.** „ARCHIVED → ACTIVE ei ole lubatud" on kasutajale
arusaadav; „PENDING_VERIFICATION → ACTIVE ei ole lubatud" oleks vale ja segane, sest tema
alus oli vahepeal aegunud.

**Aus märkus:** kaotaja saab 409 ka siis, kui tema siire oleks värske seisu pealt olnud
LUBATUD (nt `activate→archive`: arhiveerija otsus tehti `PENDING_VERIFICATION` pealt ja maja
on nüüd `ACTIVE`). See on optimistliku samaaegsuse leping, mitte puudus — kordus on kutsuja
otsus, sest vahepeal muutunud maailmas võib ta ümber mõelda.

### SOL-FIELD-01 — saatmata kohalik sisu võib kustuda ilma kolme kasutajale näidatud hoiatuseta — P1

**Tõend.** Välitöö leping nõuab, et serverisse jõudmata `DEVICE_ONLY/QUEUED/FAILED` sisu ei kustutataks vaikselt: 30. päeval peab tekkima püsiv hoiatus ja kustutamine on lubatud alles 37. päeval pärast kolme selget hoiatust (`docs/platvormi arendus/fable-5-valitoo-mobiilne-kest.md:222-231`). Puhas olekufunktsioon lubab 37 päeva järel purge’i, kui `warnCount >= 3` (`lib/field/syncMachine.js:152-177`). Runtime-hook ei kuva aga hoiatust ega loo kasutajale nähtavat kinnitust: iga retention-käik lihtsalt suurendab `warnCount` väärtust kord ööpäevas ja kustutab otsuse `PURGE` korral kirje IndexedDB-st (`components/field/useFieldSync.js:215-236`). `warnCount` ega `lastWarnAt` pole üheski välitöö komponendis kasutajale renderdatud. Ühiktest sisestab `warnCount: 3` käsitsi ja kontrollib ainult puhast otsust, mitte seda, kas kolm hoiatust päriselt kuvati (`tests/field/stateMachine.test.js:76-98`).

**Mõju.** Saatmata välitöömärge, nõusolekukirje või manus võib seadme kohalikust hoidlast jäädavalt kaduda, kuigi server pole seda kunagi saanud ja kasutaja pole kolme hoiatust näinud. Rakenduse avamine kolmel eri päeval võib täita loenduri kasutaja teadmata.

**Vastuvõtukriteerium.** Hoiatus peab olema püsiv kasutajale nähtav olek koos eraldi tõendatava kuvamis-/kinnitussündmusega; taustal retention-käigu arv ei tohi olla hoiatusarv. Saatmata sisu kustutus vajab lepingukohast kolme päris hoiatust ja viimast eksplitsiitset kinnitust või omaniku uut otsust. Brauseritest peab vanandama kirje üle 37 päeva ja tõendama, et pelk kolm käivitust ei kustuta seda.

**Seis (10.08.2026): DONE — kood ja testid; brauserikiht NOT_PROVEN (vt allpool).**

**KAKS ROLLI, MIDA VANA KOOD SEGAS.** Taustakäik kasvatas loendurit, mida mitte ükski
komponent ei kuvanud — „kolm hoiatust" tähendas päriselt **„rakendus avati kolmel eri
päeval"**. Nüüd:
- **taustakäik** (`runFieldLocalRetention`) ainult NIMETAB, keda näidata; ta ei kirjuta
  loendurit;
- **inimene** kinnitab, et nägi hoiatust (`acknowledgeFieldWarning`) — alles see loeb
  hoiatuseks — ja hiljem eraldi, et lubab kustutada (`confirmFieldPurge`).

**Ööpäevane vahe on lepingu oma, mitte mugavus:** kolm nuppuvajutust ühe minuti jooksul ei
ole kolm hoiatust. Test mõõdab just seda.

**Kolm hoiatust EI OLE kustutusluba.** Nad ütlevad „ma tean, et see kaob"; `purgeConfirmedAt`
ütleb „kustuta". Ilma selleta jääb otsus igavesti `WARN`-i — vaikimisi ALLES, mitte
vaikimisi kustutatud. Luba enne 37. päeva või enne kolme hoiatust ei kehti: ta käib SELLE
kustutuse kohta, mitte igavesti ette.

**Poliitika kolis komponendist välja** (`lib/field/localRetention.js`). See ei ole
korrastus, vaid tõendatavuse tingimus: `useCallback`-i sees ei olnud teda võimalik mõõta
ilma Reactita ja ilma IndexedDB-ta, ja ainus testitav asi oli PUHAS otsus — täpselt see,
mis jättis leidu nähtamatuks. Otsus oli õige, aga teda TOITEV loendur luges vale asja.

**Testid jooksutavad päris käiku päris otsustega, ainult ajaga mängides**
(`tests/field/localRetention.test.js`): seitse taustakäiku üle 40 päeva ei kustuta midagi;
loendur ei liigu; kaks kinnitust ühel päeval on üks; kolm kinnitust ilma loata ei kustuta;
luba enne kolme hoiatust ega enne 37. päeva ei kehti. **Negatiivkontroll:** sünkroonitud
koopia kaob endiselt taustal 7 päeva pärast — parandus ei tohi kogu säilitust seisma panna.

**Vana ühiktest kirjeldas VANA lepingut** (`warnCount: 3` → `PURGE`) ja on parandatud koos
selgitusega, miks ta enam ei kehti.

**NOT_PROVEN, aus piir:** kriteeriumi **brauseritesti ei jooksutatud**. Selles projektis ei
ole DOM-iga testisviiti (`node:test` ilma jsdom-ita) ja päris jooks nõuaks autenditud
sessiooni + IndexedDB seemendamist. Selle asemel on kaks asja: (1) poliitika ise on
mõõdetud päris koodirajal, (2) kesta ja hoogi SIDET hoiab staatiline lepingutest, mis kukub,
kui keegi bänneri või kinnitusnupu eemaldab. Mida see EI tõenda: et bänner brauseris
päriselt renderdub ja klikitav on.

### SOL-FIELD-02 — tundlikud külastuspaketid ei läbi automaatset kohalikku retention’it — P1

**Tõend.** Leping nõuab külastuspaketi kustutamist külastuse sulgemisel, hiljemalt 72 tundi pärast planeeritud ajaakent või DRAFT-i korral 7 päeva pärast loomist (`docs/platvormi arendus/fable-5-valitoo-mobiilne-kest.md:222-231`). `fieldPackPurgeDue()` arvutab need tähtajad (`lib/field/syncMachine.js:180-187`) ning kohalik hoidla pakub `listPacks()` ja `deletePack()` operatsioone (`lib/field/localStore.js:180-190`). Runtime’i ainus automaatne retention-käik loeb ja kustutab aga ainult `items` kirjeid; pakke ta ei loenda ega kontrolli (`components/field/useFieldSync.js:215-236`). Koodibaasis kasutab `fieldPackPurgeDue()` funktsiooni ainult ühiktest, mitte rakendus. Pakett eemaldub üksnes kasutaja käsitsi `removePack()` toiminguga (`components/field/useFieldSync.js:449-453`, `components/field/FieldVisitRoom.jsx:429-435`).

**Mõju.** Eesmärki, asukohta, ajakava, võtmeküsimusi ja ohutusinfot sisaldav krüptitud külastuspakett võib jääda samasse brauseriprofiili tähtajatult. Krüpteering vähendab juhusliku faililugemise riski, kuid ei täida lubatud säilitustähtaega ega kaitse sama konto/seadme hilisema kasutuse eest.

**Vastuvõtukriteerium.** Rakenduse käivituse retention-käik peab läbima kõik kasutaja paketid, rakendama `fieldPackPurgeDue()` otsust ning kustutama tähtaja ületanud paketi sõltumata sellest, milline külastus parasjagu avatud on. Külastuse sulgemine peab käivitama lepingus otsustatud kohese või hiljemalt tähtajalise eemaldamise. Fake IndexedDB brauseritest peab tõendama 72 tunni, 7 päeva, käsitsi eemaldamise ja veel kehtiva paketi säilimise juhud.

**Seis (10.08.2026): DONE — kood, testid ja runtime-tõend PÄRIS IndexedDB vastu.**

**OTSUS OLI ÕIGE, TEDA EI KUTSUNUD KEEGI.** `fieldPackPurgeDue()` oli koodis olemas ja
arvutas lepingu tähtaegu õigesti — aga ainus koht, kust teda kutsuti, oli ühiktest.
Rakenduse ainus automaatne säilituskäik luges `items`, mitte pakke. See on sama klass mis
SOL-FIELD-01, ainult teistpidi: seal oli otsus õige ja teda TOITEV loendur luges vale
asja, siin on otsus õige ja teda ei küsi mitte keegi. Eesmärki, asukohta, ajakava,
võtmeküsimusi ja OHUTUSINFOT kandev pakett kadus seadmest ainult siis, kui inimene vajutas
„Eemalda pakett".

**Kolm tähtaega on nüüd järjekord, mitte valik** (`lib/field/syncMachine.js`):
1. **külastuse sulgemine** — pakett kaob KOHE;
2. **hiljemalt 72 h pärast planeeritud akent**;
3. **7 p seadmesse võtmisest**, kui planeeritud akent ei olegi.

**Minu otsus, mille omanik võib pöörata:** lugesin lepingu sõna „hiljemalt" ÜLEMPIIRIKS,
mitte soovituseks — punkt 2 kehtib ka `IN_PROGRESS`/`WRAP_UP` külastuse paketile. Vastasel
juhul jääks tähtajatuks just see juht, mis leiu üldse tekitas: lõpetamata jäänud külastus.
Kaotus on taastatav (online „Võta seadmesse" uuesti), säilimine ei ole.

**Sulgemist ei saa taustakäik ise teada** — seadmel on ainult see olek, mis paketti
kirjutades kehtis. Seepärast annab kest iga värske külastuse vastuse paketile edasi
(`applyFieldVisitStatusToPack`); nii kaob pakett ka siis, kui sulges teine seade või teine
inimene. „Lõpetatud" küsitakse seisumasinalt (`isFieldVisitClosed` = masin ei anna ühtegi
väljapääsu), mitte teisest nimekirjast — SOL-ORG-08 õppetund vastupidises suunas. Tundmatu
olek EI ole lõpetatud: vale pool oleks vaikne kustutus.

**Kaks välja pidid kirje peal PÜSIMA, muidu ei jõua tähtaeg kunagi kohale.** `status` elab
paketi PEALMISEL kirjel, mitte krüptitud sisu sees, sest säilituskäik loeb `listPacks()`-iga
ainult metaandmeid ega tohi iga paketti lahti krüptida. Ja `takenAt` ei nullita enam iga
kirjutusega: sama `storePack()` kutsuvad ka markerite rajad, ja kui nemad kella nullivad, ei
jõua 7 päeva tähtaeg kunagi kohale. Kella alustab otsast ainult teadlik `retake: true`.

**Sond käib päris Chromiumi päris IndexedDB ja päris WebCrypto vastu**
(`npm run field:pack:probe`, `scripts/field-pack-retention-probe.mjs`): **26/26**. Fake-hoidla
on minu enda kirjutatud ja ta võib eksida just seal, kus otsus teda kõige rohkem usub —
seepärast mõõdab sond `lib/field/localStore.js`-i ennast. Serverit ega sisselogimist ta ei
vaja: moodulid serveeritakse repost ühele https-päritolule (IndexedDB ja `crypto.subtle`
nõuavad turvalist konteksti) ja aeg ei jookse, sest säilituskäik võtab `now` parameetrina.
Kaetud on kriteeriumi kõik neli juhtu + hoidla kuju + sulgemine + saatmata sisu puutumatus.

**Vana koodi vastu: 6 plokki punast, 7 kontrolli rohelist** — ja need rohelised on
ÕIGESTI rohelised: hoidla kuju ja käsitsi eemaldamine töötasid ka enne, leid oli automaatika
puudumises. Ühikutasandil `tests/field/localRetention.test.js` **9 punast** vana koodi vastu
(neist 4 kannab käitumist, 3 ainult tulemuse kuju, 1 kesta sidet) ja 2 testi, mis vana koodis
ei käivitu üldse, sest funktsiooni polnud olemas. Sondi plokid on eraldi piiratud just
selleks — nimeline import oleks andnud ühe krahhi, mitte loetava punaste rea.

**Kaks vastupidavuse auku tuli välja sondi kirjutamisel, mitte auditist.** (1) `storePack`
loeb nüüd vana kirje ja katkine krüptogramm oleks blokeerinud UUE võtmise — just selle
tegevuse, mis olukorra parandaks. (2) `applyVisitStatus` kutsub `loadDetail`, kelle catch
tähendab „server ei vastanud"; kohaliku hoidla viga oleks öelnud selle vale lause. Mõlemad
on nüüd piiratud.

**Aus piir:** sond juhib hoidlat ja poliitikat, MITTE React-komponenti. Käivituskäigu
seob kesta külge `FieldShell` (`useFieldSync({ userId })` ilma külastuseta — seepärast on
käik terve kasutaja ulatuses) ja seda sidet hoiab staatiline lepingutest, mitte renderdus.
Mida see EI tõenda: et mount-effect brauseris päriselt käivitub. Kustutus ise on vaikne ja
peabki olema — paketil on serveris koopia, erinevalt saatmata sisust (4.5 piir).

### SOL-FIELD-03 — välitöö kohustuslik audit ei kuulu põhitehingusse ja võib vaikselt kaduda — P1

**Tõend.** Välitöö teenus teeb nõusoleku tagasivõtmise, turvatoimingu, üleandmise ja manuse kustutamise põhikirjutused süstitud `db`/tehingukliendis, kuid kutsub seejärel `logDataAudit()` ilma sama kliendita (`lib/field/service.js:520-528`, `:635-644`, `:831-837`, `:873-883`; `lib/field/attachments.js:297-308`). `logDataAudit()` kasutab alati moodulitaseme globaalset Prismat, neelab iga kirjutusvea ja tagastab `null` (`lib/privacy/audit.js:1-40`). Sihttestides õnnestusid põhitoimingud fake-DB-ga, samal ajal proovis audit päris globaalse ühenduse kaudu kirjutada, logis ühendusvea ja test jäi roheliseks; privacy/handover protsessid ei lõpetanud ilma `--test-force-exit` liputa.

**Mõju.** Nõusoleku tagasivõtmine, turvasündmus, välitöö üleandmine või manuse kustutamine võib õnnestuda ilma tõendita, kes toimingu tegi. Põhiseis ja audit võivad kasutada eri ühendusi ning eri commit’i tulemust; testid annavad rohelise ka täielikult puuduva auditirea korral.

**Vastuvõtukriteerium.** Kohustuslikud välitöö auditikirjed peavad kasutama sama süstitud tehinguklienti ja auditi vea korral põhitoimingu tagasi pöörama; ainult selgelt mittekriitiline telemeetria võib olla best-effort. Test peab veasüstiga tõendama rollback’i ja kontrollima auditirida fake-/päris test-DB-s, ilma globaalse ühenduse või `--test-force-exit` vajaduseta.

**Seis (10.08.2026): DONE — kood ja testid; veasüstiga tõendatud, ilma globaalse ühenduseta.**

**KAKS EXPORTI, KAKS LEPINGUT** (`lib/privacy/audit.js`). `writeDataAudit()` võtab `db`
süstituna ja **VISKAB** vea; `logDataAudit()` jääb best-effort'iks ja neelab. Vana kood pakkus
ainult teist ja kirjutas ALATI moodulitaseme globaalse ühenduse kaudu. Tagajärg oli
kahekordne ja teine pool on see, mis leiu nii kauaks peitis:

- **toodangus** võis nõusoleku tagasivõtmine, turvatoiming, üleandmine või manuse kustutamine
  õnnestuda ilma ühegi tõendita, kes seda tegi;
- **testides** proovis fake-DB-ga roheline test vaikselt PÄRIS andmebaasi kirjutada, logis
  ühendusvea ja jäi ikka roheliseks. Mõõtsin selle ära: vanade kutsujate vastu kulub esimesel
  auditikirjutusel **241 ms** — see on päris ühenduse katse, mitte test.

**Viis kohustuslikku rada on nüüd põhitehingus:** visiidi turvatoiming ja sulgemine
(`field.visit_*`), nõusoleku tagasivõtmine, üleandmine artefakti, üleandmine eelpöördumisse ja
manuse kustutamine. Auditita rajad (nt `confirm_arrival`) tehingut EI ava — parandus ei tohi
olla vaikne jõudluskulu igale klahvivajutusele, ja seda mõõdab eraldi test.

**Tühi `action` on `writeDataAudit`-is VIGA, mitte vaikne `null`:** kohustuslikku kirjet ei
tohi saada „täidetuks" kirjaveaga.

**KAKS TEADLIKKU ERANDIT, mis ei ole „telemeetria", vaid koht, kus tagasipööramine teeks
rohkem kahju.** Turvahoiatuse eskalatsioon (`lib/field/safety.js`) ja säilituskäigu kustutus
(`lib/field/retentionSweep.js`) said süstitud kliendi, aga jäid best-effort'iks: seal on
**e-kiri juba välja läinud** ja **fail juba kettalt ning RAG-ist läinud**. Rollback tähendaks
teist kirja samale inimesele või rida, mis viitab olematule failile. Ütlen selle välja, sest
kriteeriumi sõna „mittekriitiline telemeetria" seda päris täpselt ei kata.

**Aus piir üleandmisel eelpöördumisse:** `updatePreInquiryReceiverWorkflow` võtab ise
ruumiluku ja commit'ib OMA tehingu — teda ei saa välisesse tehingusse mähkida. Atomaarne on
see, mis on välitöö enda kirjutus: üleandmise tempel ja tema tõend.

**Fake-hoidla pidi saama kaks asja ja MÕLEMAD peitsid päris veaklassi**
(`tests/helpers/fieldDb.mjs`): (1) `$transaction` oli **läbilase** — olemasolev test „vea
korral ei jää templit maha" oli roheline ainult seepärast, et vigane kirjutus juhtus ajaliselt
esimesena; tõend, et tehing HOIAB, nõuab hoidlat, mis oskab ka unustada. (2) Pesastatud
seose-select (`document: { select: … }`) jäi projektsioonist VAIKSELT välja, seega nägi iga
test manust nii, nagu tal poleks dokumenti — täpselt see haru, kus kustutus võtab maha ka
faili rea. Enne seda ei olnud manuse kustutusel ühtki jooksvat testi, ainult allika-regex.

**Vana koodi vastu 8/12 punast** (`tests/field/audit.test.js`, mõõdetud nii, et uus
auditimoodul jäi alles ja vahetusid ainult kutsujad — vastasel juhul kukuks import ja mõõta
ei saaks midagi). Neli rohelist on õigesti rohelised: fake-tehingu kontroll, auditita rada ja
kaks auditimooduli enda testi.

**Üks õppetund läks testi kommentaari, sest ta oleks mind peaaegu ära petnud:**
`assert.rejects(promise)` üksi rahuldub SUVALISE veaga. Esimene versioon läks roheliseks
hoopis `invalid_transition` 409 pealt (sulgeda saab ainult `WRAP_UP` pealt) — kontroll, mis ei
nimeta oodatavat viga, ei mõõda midagi. Nüüd nõuab helper `/audit_write_failed/`.

**Kriteeriumi viimane osa mõõdetud eraldi:** `tests/field/audit.test.js` väljub koodiga 0
**ilma `--test-force-exit` liputa** — globaalset ühendust ei avata enam üldse.

### SOL-FIELD-04 — võrguühenduseta saabumise/lahkumise markerit ei salvestata ja flush võib vea järel selle kustutada — P1

**Tõend.** Offline saabumise või lahkumise toiming lisab `localArrivalAt`/`localDepartureAt` välja `sync.storePack()` sisendisse ja kuvab kohe teate „salvestatud” (`components/field/FieldVisitRoom.jsx:184-200`). `storePack()` koostab aga uue payload’i kinnise väljaloendi järgi ning ei kopeeri kumbagi markerivälja (`components/field/useFieldSync.js:421-445`). Marker puudub seega juba järgmisel `getPack()` lugemisel ja `flushMarkers()` ei leia midagi saata. Isegi kui marker oleks payload’is, ignoreerib flush PATCH vastuse staatust: pärast mis tahes täidetud fetch’i eemaldab ta markerivälja ja kirjutab paki ümber (`components/field/FieldVisitRoom.jsx:112-138`). 409, 401 või 500 vastus kaotaks kohaliku tõendi samamoodi. Markerite tervikahela testi pole.

**Mõju.** Töötajale öeldakse, et saabumine või lahkumine salvestati seadmesse, kuid sündmus ei jõua serverisse ega püsi kohalikult. See võib rikkuda külastuse kestuse, ohutuskontrolli ja hilisema teenuskirje alusandmed ning annab välitöötajale vale turvatunde.

**Vastuvõtukriteerium.** Markerid peavad kuuluma versioonitud pakiskeemi ning säilima kuni server on vastanud 2xx või detail tõendab sama sündmuse olemasolu. 401/403/409/429/5xx ja võrguvea korral peab marker alles jääma nähtava tõrkeseisuga. Fake IndexedDB + fetch brauseritest peab katma offline salvestuse, rakenduse taasavamise, eduka flush’i ja kõik negatiivsed vastused.

**Seis (10.08.2026): DONE — kood, testid ja runtime-tõend päris IndexedDB vastu.**

**KOLMAS KORD SAMAS FAILIS, KOLMAS KINNINE VÄLJALOEND.** `storePack()` ehitas payload'i
kinnise loendi järgi ja ei kopeerinud kumbagi markerivälja — SOL-FIELD-02 kaotas samamoodi
`takenAt` ja `status`. Nüüd on payload koodis nähtavalt KAHES pooles: serveripoolne
ettevalmistuse sisu ehitatakse ümber, seadmepoolne (`schemaVersion`, `markers`) kantakse
edasi. Neljas seadmepoolne väli kuulub sinna plokki, mitte uude unustusse.

**RAPORTIS NIMETAMATA TAGAJÄRG, mis on tegelikult rängem kui kadunud marker.** Võrguta
kinnitus kutsus `storePack`-i **võltsvisiidiga** (`{ id: visitId, ...markers }`), kus
`goal`, `locationText`, `packKeyQuestions` ja `safety` olid kõik `undefined`. Ehk: „Kinnita
saabumine" ilma võrguta **kirjutas üle terve ettevalmistuspaketi** — sealhulgas
OHUTUSINFO —, mille inimene just offline-kasutuseks seadmesse võttis. Marker on nüüd oma
tehe (`recordMarker`), mitte paketi ülekirjutus, ja seda mõõdab eraldi väide.

**Leping ühes lauses:** marker kaob AINULT kahel juhul — server vastas 2xx, või värske
külastus tõendab, et sama sündmus on juba olemas. Kõik muu jätab ta alles ja annab talle
**nähtava tõrkeseisu** koos põhjusega (`auth` / `conflict` / `rate_limit` / `server` /
`network`) ja korduskatse nupuga. Põhjus on ANDMEVÄLI, mitte tekst — liides tõlgib ta ise,
kolmes keeles.

**Poliitika kolis komponendist välja** (`lib/field/visitMarkers.js`) ja `fetchImpl` on
süstitav, sest just **vastuse käsitlus** oli katki: teda peab saama mõõta ilma serverita ja
ilma brauseri võrgukihita. `classifyMarkerResponse()` on üks funktsioon, mille kogu sisu on
„ok otsustab AINULT 2xx"; tundmatu staatus läheb `SERVER`-i alla, sest vaikimisi ALLES on
ainus suund, mis tõendit ei kaota.

**Kaks asja, mida ainult päris hoidlaga saab tõendada** (`npm run field:pack:probe`, nüüd
**35/35**): marker elab üle rakenduse SULGEMISE (probe avab IndexedDB partitsiooni uuesti) ja
tema seis on pärast 500-t päriselt kettal `FAILED`, mitte ainult mälus. Ühikutasandil
**18 testi** (`tests/field/visitMarkers.test.js`), sh iga negatiivne staatus eraldi reana ja
versiooni edasiliikumine kahe markeri vahel — teine PATCH peab kasutama esimese vastusest
saadud versiooni, muidu saab ta 409 iseenda eelkäija pärast.

**AUS PIIR MÕÕTMISES.** SOL-FIELD-02 ja -03 sai vana koodi vastu jooksutada, sest neil oli
moodulipiir olemas. **Siin seda ei olnud** — vana loogika elas React-i `useCallback`-i sees
ja kadus koos temaga. Vana kesta vastu läheb punaseks staatiline lepingutest (1/18); ülejäänud
17 mõõdavad moodulit, mida vanas koodis EI OLE. Selle asemel on eraldi negatiivkontroll, mis
kirjutab vana reegli („pärast täidetud fetch'i eemalda marker") testi sisse ümber ja tõendab,
et ta sama 500 peale tõendi kustutab — silt on ausalt küljes: see on minu transkriptsioon
vanast reeglist, mitte vana kood ise.

### SOL-FIELD-05 — transkripti kinnituse serveriviga peidetakse ning toorheli kustutuskell ei käivitu — P2

**Tõend.** Kasutaja kinnitatud AI/transkripti tekst salvestatakse esmalt kohaliku märkmena ja saadetakse serverisse; seejärel teeb komponent eraldi `confirmTranscript: true` päringu, kuid neelab võrguvea, ei kontrolli `response.ok` väärtust ning kuvab alati kinnituse eduteate (`components/field/FieldVisitRoom.jsx:370-394`). Serveri eraldi toiming seab `transcriptConfirmedAt`, mis käivitab toorheli kohese retention-valiku (`app/api/field/visits/[id]/attachments/[clientItemId]/route.js:25-38`, `lib/field/attachments.js:312-332`, `lib/field/retentionSweep.js:37-45`). Kui see teine päring ebaõnnestub, võib kinnitatud tekst juba olemas olla, kuid toorheli jääb kuni 7-päevase varutähtajani ja UI ütleb ekslikult, et tervik õnnestus.

**Mõju.** Kinnitatud transkripti toorheli säilib lubatust kauem ning kasutaja ei saa teada ega toimingut teadlikult korrata. Teksti ja toorheli elutsükli tõde lahkneb kahe vaikse osatoimingu vahel.

**Vastuvõtukriteerium.** Kinnituse eduteade tuleb anda ainult pärast serveri 2xx vastust. Teksti vastuvõtmine ja `transcriptConfirmedAt` vajavad üht serveripoolset idempotentset toimingut või püsivat retry-olekut. Negatiivne test peab sundima kinnituse päringu 500/võrguveale ja tõendama nähtava vea ning korduskatse võimaluse.

**Seis (10.08.2026): DONE — kood ja testid.**

**KAKS TÕDE ÜHEST TOIMINGUST EI TOHI LAHKNEDA.** Valisin kriteeriumi esimese haru: teksti
vastuvõtmine ja toorheli kella käivitamine on nüüd **üks serveripoolne idempotentne toiming**.
Märge kannab välja `transcriptClientItemId` ja `putFieldVisitNote` seab
`transcriptConfirmedAt` SAMAS tehingus, kus ta teksti vastu võtab. Teist päringut ei ole enam
olemas — koos temaga kadus ka koht, kus viga sai vaikselt neelduda.

**Miks see on ka ilma võrguta parem.** Vana kest saatis kinnituse KOHE, samal ajal kui märge
läks sünkroonijärjekorda. Võrguta seadmes tähendas see, et kinnitus kukkus vaikselt ja tekst
jõudis serverisse alles tunde hiljem — kell aga ei käivitunud kunagi. Nüüd rändavad nad koos
ja järjekord ISE on püsiv retry-olek (kriteeriumi teine haru tuleb tasuta kaasa).

**Eduteade ainult 2xx järel.** `approveItem` tagastab nüüd kirje LÕPPSEISU ja kest ütleb
täpselt seda, mis juhtus: `SYNCED` → „kinnitatud", `FAILED`/`CONFLICT` → nähtav tõrge,
muidu ausalt „seadmes, saadetakse — kell käivitub alles siis, kui tekst on serveris". Kolm
teadet kolmes keeles.

**Idempotentsus on mõõdetud, mitte eeldatud:** `updateMany` tingimusega
`transcriptConfirmedAt: null` — kordus ei liiguta kella. Kadunud salvestis EI OLE viga
(kustutada ei ole midagi ja märge on kasutaja sisu, mis ei tohi kaduda vana viite pärast).
Vana otsetee (`PUT { confirmTranscript: true }`) jääb alles **taasteteena** ja sai sama
väravа: kordus vastab `alreadyConfirmed`, mitte 404, ja kella ei liiguta.

**Vana koodi vastu 4/9 punast.** Aus lisamärkus: kolm rohelist on vana koodi all
**tühjalt** rohelised — „kell ei käivitunud" ja „kordus ei liiguta kella" kehtivad
triviaalselt, kui kella ei käivitata kunagi. Punased on need, mis mõõdavad tegelikku
sidumist: kell käivitub koos tekstiga, järgmine revisjon käivitab seisva kella, otsetee on
idempotentne, ja kest ei tee enam teist päringut.

### SOL-FIELD-06 — lubatud automaatne retry/backoff ei käivitu tähtaja saabumisel — P2

**Tõend.** Olekumasin seab retryable vea järel `nextAttemptAt` väärtuse ja `isUploadDue()` lubab uue katse alles selle aja saabumisel (`lib/field/syncMachine.js:97-143`). Hook’i `runSync()` kontrollib järjekorda ainult funktsiooni kutsumise hetkel ja lõpetab, kui uus tähtaeg on veel tulevikus (`components/field/useFieldSync.js:166-180`). Koodis pole taimerit ega scheduler’it, mis käivitaks `runSync()` uuesti `nextAttemptAt` saabumisel. Uus katse toimub ainult mount’il, brauseri `online` sündmusel või kasutaja approve/retry toimingul (`:239-287`, `:338-355`). Ühiktest kontrollib kuupäeva arvutamist, mitte päris automaatset korduskatset.

**Mõju.** Ajutise 429/5xx/võrguvea järel võib kinnitatud välitöösisu jääda kogu avatud rakenduse ajaks järjekorda, kuigi ühendus taastub ja UI lubab automaatset 5 s → 5 min retry’d. Kasutaja peab teadmata tegema uue sündmuse või rakenduse taasavama.

**Vastuvõtukriteerium.** Sünkimootor peab planeerima ühe tühistatava äratuse varaseima `nextAttemptAt` järgi, hoidma korraga ühe sync’i ja arvutama järgneva tähtaja pärast iga katset uuesti. Fake-timer test peab tõendama 5 automaatset katset, backoff’i, edu korral peatumist, offline/auth parkimist ja unmount’i taimerikoristust.

**Seis (10.08.2026): DONE — kood ja testid võltskella all.**

**BACKOFF OLI OLEMAS AINULT ARVUTUSENA.** `nextAttemptAt` seati, `isUploadDue()` oskas teda
lugeda — aga pärast tähtaja saabumist ei küsinud teda MITTE KEEGI. Uus katse tuli ainult
mount'il, brauseri `online` sündmusel või kasutaja vajutusel. Ajutise 429 või 5xx järel võis
kinnitatud välitöösisu jääda kogu avatud rakenduse ajaks järjekorda, kuigi ühendus oli ammu
tagasi ja liides lubas automaatset 5 s → 5 min kordust.

**Kaks uut tükki, mõlemad Reactist väljas.** `nextFieldSyncWakeup()` (`syncMachine.js`) on
puhas funktsioon „millal on varaseim mõtet ärgata"; `createFieldSyncScheduler()`
(`lib/field/syncScheduler.js`) on ajastaja, kelle `setTimer`/`clearTimer`/`now` on
**süstitavad**. Taimeri õigsus on AJALINE omadus — „viis katset kasvava vahega" ei ole midagi,
mida saaks renderdamata mõõta, ja päris ootamine testis oleks lubadus, mitte tõend.

**Kolm reeglit, mis hoiavad ta ohutuna:** korraga üks ootel äratus (uus plaan tühistab vana) ·
tähtaeg arvutatakse PÄRAST iga katset, mitte ette · minevikus olev tähtaeg ei anna kunagi
nulliga silmust, vaid lükkub lepingu baas-backoffi võrra edasi. Viimane on eraldi test, sest
just see viga oleks parandusest hullem kui leid ise.

**Mõõdetud võltskella all** (`tests/field/syncScheduler.test.js`, 9 testi): viis automaatset
katset **ilma ühegi kasutaja tegevuseta**, vahed täpselt lepingu backoffi järgi
(5 s → 10 s → 20 s → 40 s), peatumine `FAILED` ülempiiril, peatumine edu korral, `needsLogin`
ja offline parkimine, üksainus ootel äratus korduva plaanimise järel, ja `stop()` ehk
unmount'i taimerikoristus koos kontrolliga, et peatatud ajastaja ei ärka enam ellu. Kirje
läbib PÄRIS olekumasina, seega ka backoff on päris, mitte testi oma.

**Aus piir mõõtmises:** vana koodi vastu läheb punaseks üks test — kesta ja mootori side.
Ülejäänud kaheksa mõõdavad moodulit, mida vanas koodis **ei olnud olemas**, ja see ongi leiu
sisu: ajastajat ei olnud. Sama piir mis SOL-FIELD-04-l.

### SOL-DOC-01 — AI-kasutus arvestatakse enne püsivat või kasutajale tagastatud tulemust — P1

**Tõend.** Artefakti loomise eraldi route märgib genereerimise lõpetatuks ja commit'ib `DOCUMENT_GENERATE` kasutuse enne `persistArtifactDraft()` kutset (`app/api/documents/artifacts/generate/route.js:192-224`). Kui mustandi loomine ebaõnnestub, ei vabasta catch enam reservatsiooni, sest `generationCompleted` on juba `true` (`:228-235`). Üldine artefakti POST teeb sama commit'i ning kontrollib alles seejärel genereeritud sisu mahtu; üle kvoodi tulemus tagastab 413 juba arvestatud kasutusega (`app/api/documents/artifacts/route.js:294-345`). Refinement commit'ib `DOCUMENT_REFINE` kasutuse enne kohustuslikuna kasutatavat otsest `documentAudit.create()` kirjutust; auditi vea korral saab kasutaja 500 ega saa genereeritud sisu, aga kasutus jääb arvestatuks (`app/api/documents/artifacts/refine/route.js:198-250`). Agendi klient ei saada genereerimise ega refinement'i payload'is `idempotencyKey` väärtust (`components/agent/AgentModePage.jsx:1188-1205`, `:1261-1280`); adapter loob puuduva võtme asemel iga kord uue UUID (`lib/usage/routeAdapter.js:41-55`).

**Mõju.** Ajutine DB-, auditi- või mahutõrge võib kulutada kasutaja nädalalimiiti ilma leitava mustandi või isegi vastuses saadud tulemuseta. Korduskatse ei taaskasuta eelmist kasutussündmust ja võib kulutada järgmise ühiku.

**Vastuvõtukriteerium.** Kliendi ühe kavatsuse stabiilne idempotentsusvõti peab siduma reservatsiooni, loodud tulemuse ja retry. Genereerimise kasutus commit'itakse alles pärast püsiva mustandi edukat loomist või need kaks tulemust tehakse taastatava olekumasinaga koherentseks. Refinement peab kas tulemuse enne commit'i püsivalt talletama või tagama, et hilisem auditi/response'i tõrge on sama võtmega taastatav. Veasüstetestid peavad katma quota-check'i, artefakti create'i, refinement-auditi ja vastuse-eelse vea.

**Seis (11.08.2026): DONE — kood ja testid; runtime: not_run.**

**LIPP, MIS KEELAS VABASTUSE.** Kolm rada arvestasid kasutuse maha kohe pärast mudelikutset ja
märkisid seejärel `generationCompleted`/`refinementCompleted` tõeseks. Sellest hetkest EI SAANUD
catch enam midagi vabastada — mustandi loomise viga, üle kvoodi jäänud sisu (413) või kohustusliku
auditirea viga tuli juba arvestatud ühiku otsa. Kasutaja nädalalimiit kahanes ilma leitava
mustandi või isegi vastuses saadud tekstita, ja korduskatse ei taaskasutanud eelmist sündmust.

**Valisin kriteeriumi esimese haru:** tasu võetakse ainult püsiva tulemuse järel. Järjekord
`reserve → produce → persist → commit` kolis omaette moodulisse (`lib/usage/paidResult.js`), sest
ta elab muidu ainult ridade järjestuses ja iga hilisem lisandus võib ta märkamatult ümber tõsta.
Tal on kaks piiri: iga viga ENNE commit'i vabastab reservatsiooni · commit'i enda viga EI vabasta
midagi, sest püsiv tulemus on juba omaniku oma ja vabastus annaks talle tasulise tulemuse tasuta.

**Marsruutide kaupa.** Generate: mustand luuakse enne tasu. Artefakti POST: mahukontroll tõusis
tasust ETTEPOOLE — varem mõõdeti alles pärast commit'i ja 413 tuli arvestatud ühikuga. Refine:
tema tulemus ei ole server-poolel püsiv (tekst läheb vastusesse), küll aga on püsiv **auditirida**,
mis on ühtlasi lubatud kolme refinement'i loenduri ainus allikas — nii et auditirida ja tasu käivad
nüüd ÜHES tehingus (`commit({ tx })`). Kas mõlemad või mitte kumbki; poolikut slot'i ei teki.

**Lõks, mille parandus ise oleks tekitanud.** Stabiilne kliendivõti + vabastus = igaveseks surnud
kavatsus: `reserve` tagastaks RELEASED rea ja `commit` keelduks temast alati. Seepärast on
vabastatud võti nüüd **sama perioodi sees** uuesti reserveeritav (üks rida, uus RESERVED-sündmus,
sama ülempiiri kontroll). Suletud perioodist tulnud võti annab konflikti, mitte elustamist — muidu
läheks tasu valesse arvestusaknasse.

**Klient.** Agendi kest ei saatnud üldse `idempotencyKey` välja ja adapter mintis igal katsel uue
UUID-i. Nüüd elab võti kuni serveri kindla vastuseni: sama sisendiga kordus kannab sama võtit
(server ei võta teist tasu ega loo teist mustandit), õnnestumise järel ta kustub, seega tahtlik
uus jooks on aus uus töö (`lib/usage/intentKey.js`).

**Mõõdetud (23 uut testi).** Veasüst igasse sammu eraldi: mahukontroll, mustandi loomine,
refinement'i audit ja vastuse-eelne commit — koos kontrolliga, MIS juhtus reservatsiooniga.
Vana koodi vastu: kolm uut usage-teenuse testi on punased ja neljas ei kuku, vaid **lukustub** —
vana `commit` avab alati oma tehingu, seega kutsuja tehingu sees jääb ta iseennast ootama. See
lukk ongi tõend, miks auditirida ja tasu ei saanud varem üks toiming olla.

**Aus piir mõõtmises.** `paidResult` ja `intentKey` testid mõõdavad mooduleid, mida vanas koodis ei
olnud olemas (sama piir mis SOL-FIELD-04/06-l). Marsruuditasandi HTTP-veasüsti EI ole: järjekorda
hoiab moodul, ja et marsruudid teda ka päriselt kasutaksid, valvab lähtekoodi-leping
(`runPaidResult` olemas, `generationCompleted`/`refinementCompleted` lipud keelatud).

### SOL-DOC-02 — transkriptsiooni ja transkripti kokkuvõtte rajad mööduvad kasutuslimiitidest — P1

**Tõend.** Plaanid annavad rollidele eraldi `STT_SECONDS` kuu- ja `DOCUMENT_GENERATE` nädalalimiidi (`lib/usage/planSeeds.js:25-34`, `:45-54`, `:65-74`). Helifaili transkribeerimise route kutsub päris OpenAI transkriptsiooni otse, kuid ei reserveeri ega commit'i ühtegi `STT_SECONDS` kasutust (`app/api/documents/[id]/transcribe/route.js:177-265`, `lib/transcription/provider.js:51-73`). Transkripti kokkuvõtte route kutsub AI genereerimist ja loob uue `TRANSCRIPT_SUMMARY` artefakti, kuid ei kasuta `DOCUMENT_GENERATE` reservatsiooni (`app/api/documents/[id]/summary/route.js:113-181`). Mõlemal rajal on ainult minutipõhine mälupõhine rate-limit, mitte lepinguline perioodikvoot.

**Mõju.** Tasuline kasutaja saab neid otsepunkte kasutades tekitada piiramatut perioodikulu üle paketi STT- ja dokumendilimiidi; kasutusülevaade ja arveldus ei näita tegelikku kulu. Kokkuvõtte rada lubab sama muudetavat transkripti korduvalt genereerida.

**Vastuvõtukriteerium.** Transkriptsioon peab reserveerima STT mahu turvalise ülempiiri järgi ja commit'ima tegeliku kestuse; kokkuvõte peab kasutama sama `DOCUMENT_GENERATE` lepingut nagu teised dokumendiloomised. Mõlemad vajavad stabiilset idempotentsusvõtit, release'i enne tasulise etapi valmimist tekkinud vea korral ning limiidi ületamise negatiivset testi.

**Seis (11.08.2026): DONE — kood ja testid; runtime: not_run.**

**KAKS OTSEPUNKTI VÄLJASPOOL LEPINGUT.** Paketis on `STT_SECONDS` piir olemas ja ta on kitsas
(klient 900 s/kuus, töötaja 3600, teenusepakkuja 7200) — aga helifaili transkribeerimise
marsruut kutsus päris teenusepakkujat ilma ühegi reservatsioonita. Kokkuvõtte rada tegi
AI-genereerimise ja lõi uue artefakti ilma `DOCUMENT_GENERATE` lepinguta. Mõlemal oli ainult
minutipõhine **mälupõhine** rate-limit, mis ei ole perioodikvoot: kasutusülevaade ja arveldus ei
näinud sellest kulust midagi.

**Reservatsioon ja arvestus on kaks ERI küsimust.** Enne kutset vastust ei ole, seega peab
reservatsioon olema turvaline ÜLEMPIIR; pärast kutset on vastus olemas, seega peab arvestus
olema TÄPNE. `lib/usage/sttDuration.js` hoiab neid lahus. Ülempiir tuleb tugevuse järjekorras:
kõnesalvestise teadaolev kestus andmebaasist → failist loetud kestus → **baitidest tuletatud
piir kõne madalaima usutava bitikiiruse (8 kbps) järgi** → põrand 60 s. Viimane on teadlikult
helde: liiga suurt reservatsiooni hoitakse ainult päringu kestel ja commit parandab ta tegeliku
kestusega ära, liiga väike aga laseks piirist märkamatult mööda.

**Arvestus on piiratud reserveeritud mahuga.** Kui teenusepakkuja ütleb rohkem, kui me
ülempiiriks pidasime, oli meie hinnang vale — aga suurem commit kukuks ämbri invariandi otsa ja
annaks 500 kasutajale, kelle transkript on juba olemas. Vale hinnang ei tohi muutuda kasutaja
veaks; ta jääb piiratud kujul arvestusse ja on logist leitav.

**Mõlemad rajad kasutavad SOL-DOC-01 järjekorda** (`runPaidResult`): tasu tuleb alles pärast
püsivat transkripti või kokkuvõtte artefakti, ja viga enne seda vabastab reservatsiooni. Kokkuvõtte
üle salvestuskvoodi 413 vabastab nüüd samuti. Olemasoleva transkripti tagastamine ei kutsu
teenusepakkujat ega reserveeri midagi — reuse-haru väljub enne kvoodirida ja seda mõõdab leping.

**Kavatsuse võtmed on eri kujuga, sest kavatsused on eri kujuga.** Transkriptsioonil on võti
**allika enda id**: sama helifaili teist transkripti ei ole olemas, marsruut tagastab olemasoleva.
Kokkuvõttel on võti kavatsuse allkiri, sest muudetud transkripti tohib ausalt uuesti kokku võtta.
Mõlemad kliendid (agendi kest ja välitöö tuba) saadavad selle nüüd kaasa.

**Mõõdetud (14 testi).** Ülempiiri ladder, ümardamine ÜLES, katkiste väärtuste kõrvalejätt,
bitikiiruse mõju suund, ja arvestuse pool: teenusepakkuja mõõt võidab, tokeni-usage EI ole kestus,
piiramine reserveeritud mahuga. Vana koodi vastu läheb leping punaseks õige lausega
(„transcription must reserve STT capacity"); `sttDuration` testid mõõdavad moodulit, mida ei olnud.

**Aus piir mõõtmises.** Limiidi ületamise negatiivne rada on tõendatud **ahelana**, mitte ühe
HTTP-testiga: teenus viskab piiril (`service.test.js`), deskriptor teeb sellest 429
(`routeAdapter.test.js`), ja leping mõõdab ahela viimast lüli — et marsruut seda kaardistust ka
päriselt kasutab, mitte ei neela viga.

### SOL-DOC-03 — paralleelne muutmine saab FINAL-artefakti pärast kinnitamist üle kirjutada — P1

**Tõend.** PATCH loeb omaniku artefakti ja kontrollib mälus, et see on `DRAFT`, kuid hilisem update sihib ainult `where: { id }` (`app/api/documents/artifacts/[id]/route.js:140-146`, `:199-207`). Approve loeb samuti oleku eraldi ja muudab rea hiljem ainult ID järgi `FINAL`-iks (`app/api/documents/artifacts/[id]/approve/route.js:69-110`). Kui PATCH loeb `DRAFT`, approve commit'ib `FINAL` ja PATCH jätkab seejärel, muudab ta juba lõplikuks kinnitatud rea sisu/pealkirja, sest update ei nõua enam `status: DRAFT`. Kliendi kinnitamine ise koosneb samuti kahest eraldi HTTP päringust — PATCH ja POST approve — ilma versiooni/CAS-ta (`components/documents/ArtifactDetailPage.jsx:100-124`, `components/agent/AgentModePage.jsx:1518-1541`).

**Mõju.** Allalaaditava „lõpliku” dokumendi sisu võib pärast kinnitamise aega muutuda ning kinnitusaudit ei kirjelda enam seda sisu, mille kasutaja kinnitas. Kahe vahekaardi tavaline kasutus piisab vastuolu tekitamiseks.

**Vastuvõtukriteerium.** DRAFT-i muutmine peab olema atomaarne tingimuslik update (`id + ownerId + status + expected version/updatedAt`); approve peab kinnitama täpselt kliendi nähtud versiooni ühes serveritoimingus. Kaotaja peab saama 409. Päris PostgreSQLi test peab katma `PATCH vs approve`, kaks PATCH-i ja kaks approve'i eri ajastustes ning tõendama FINAL-sisu muutumatust.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (33/33).**

**KONTROLL OLI OLEMAS — LIHTSALT VALES KOHAS.** Nii PATCH kui approve lugesid seisu eraldi
päringuga ja kontrollisid mälus, et rida on `DRAFT`. Kontroll oli LUGEMISE hetkel õige. Katki
oli see, et kirjutus tuli hiljem ja sihtis ainult `where: { id }`. Kahe vahekaardi tavaline
kasutus piisas: PATCH luges `DRAFT` → approve commit'is `FINAL` → PATCH jätkas ja muutis **juba
kinnitatud dokumendi sisu**. Allalaaditav „lõplik" fail ei olnud enam see, mille kasutaja
kinnitas, ja kinnitusaudit ei kirjeldanud enam midagi tõest.

**Parandus on struktuurne, mitte täiendav kontroll.** `lib/documents/artifactMutation.js` teeb
kontrollist ja kirjutusest ÜHE lause: `updateMany` tingimus kannab kõike, mis peab kehtima
kirjutamise hetkel — `id + ownerId + status + oodatud versioon` — ja `count === 0` tähendab
kaotust. Mälus loetud seis ei otsusta enam midagi; teda loetakse alles PÄRAST kaotust, et öelda
kasutajale, mis täpselt juhtus (409 „muudeti vahepeal" vs 409 „kinnitatud on ainult lugemiseks"
vs 404). Versioon on `updatedAt` — eraldi veergu ja migratsiooni ei ole vaja, sest iga kirjutus
liigutab teda niikuinii ja klient saab ta vastuses kaasa.

**Kinnitamine võib sisu kaasa võtta.** Detailivaade tegi varem kaks HTTP-päringut — salvesta,
siis kinnita — ja nende vahele mahtus terve võistlus. Nüüd on see üks päring: kinnitatakse
täpselt see versioon ja see sisu, mida kasutaja nägi, või ei kinnitata midagi.

**Üks eristus, mis kergesti kaoks.** „Juba FINAL" ei tähenda automaatselt, et minu töö on tehtud.
Sama sisuga korduskinnitus on edu (võrgu retry ei tohi anda viga), aga MUU sisuga kinnitus juba
kinnitatud rea peale on konflikt — muidu ütleks server „kinnitatud" inimesele, kelle sisu ei
kinnitatud kunagi.

**Mõõdetud päris PostgreSQL-is** (`npm run artifact:race:probe`, **33/33**): võistlus on
deterministlik, mitte „mahtus ühte millisekundisse" — kolmas tehing hoiab rea lukku, mõlemad
võistlejad **mõõdetakse ootamas**, siis lukk vabastatakse. Kaetud on approve→patch, patch→approve,
patch→patch, approve→approve sama ja eri sisuga, ning kinnitatud rea hilisem muutmine. Iga haru
lõpeb sama invariandiga: FINAL-i sisu on täpselt see, mis kinnitati.

**Negatiivkontroll on osa sondist.** Ilma temata ei teaks me, kas rohelised on tõend või lihtsalt
see, et võistlust ei tekkinud. Sond jäljendab samas harnessis VANA mustrit (loe seis → kirjuta
`where: { id }`) ja nõuab, et see FINAL-i **ära rikuks**. Rikub. Seega on harness päris ja
ülejäänud 32 rohelist on paranduse teene.

**Aus piir mõõtmises.** Agendi tööpind salvestab ja kinnitab endiselt kahe päringuga — mõlemad on
nüüd versiooniga valvatud (kinnitus kannab seda versiooni, mille tema enda salvestus just
tagastas), aga ühe toiminguni kokku sai ainult detailivaade. Ühiktestid mõõdavad otsust
(mis seis → mis viga); võistlust ennast tõendab ainult sond.

### SOL-DOC-04 — transkripti fail ja andmebaas võivad osalise vea järel eri sisu näidata — P1

**Tõend.** Olemasoleva transkripti PATCH kirjutab uue teksti esmalt vana `storagePath` faili peale ja alles seejärel uuendab DB `content`, `size` ning `sha256` välju (`app/api/documents/[id]/route.js:226-276`, `lib/documents/server.js:316-328`). DB update'i vea korral faili eelmist versiooni ei taastata. Allalaadimine loeb sisu failist, samas API ja AI-kokkuvõte kasutavad DB `content` välja (`app/api/documents/[id]/download/route.js:48-76`, `app/api/documents/[id]/summary/route.js:96-124`). Uue transkriptsiooni rada kirjutab samuti faili enne `userDocument.create()` toimingut, kuid catch ei tea loodud `storagePath` väärtust ega kustuta orbfaili (`app/api/documents/[id]/transcribe/route.js:207-249`, `:277-295`).

**Mõju.** Kasutaja võib saada 500, kuid allalaaditav fail on juba muutunud; UI ja AI töötlevad samal ajal vana DB-teksti. Uue transkripti DB vea korral jääb tundlik tekst failisüsteemi ilma omaniku- ja retention-reata.

**Vastuvõtukriteerium.** Muudatus tuleb kirjutada uude ajutisse faili ning avaldada atomaarse asenduse/kompensatsiooniga alles pärast DB edu; vea korral peab säilima vana fail ja eemalduma ajutine. Uue transkripti loomisel peab iga kirjutatud fail olema DB-reaga seotud või tõendatult puhastatud. Veasüstetestid peavad katkestama DB update/create'i pärast failikirjutust ja võrdlema DB, allalaadimise ning kettaseisu.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i ja päris hoidla runtime-tõendiga (17/17).**

**KAKS TÕDE ÜHEST DOKUMENDIST.** Transkripti muutmine kirjutas uue teksti VANA faili peale ja
alles seejärel uuendas andmebaasi. DB-vea korral ei taastanud eelmist faili keegi: allalaadimine
luges juba uut sisu, aga API ja AI-kokkuvõte lugesid `content` välja andmebaasist — sama dokument
andis kaks eri vastust, olenevalt sellest, kust vaadata. Uue transkripti rada kirjutas samuti
faili enne rea loomist ja catch ei teadnud loodud teed: DB-vea korral jäi **tundlik tekst kettale
ilma omaniku- ja retention-reata**.

**Järjekord on ümber pööratud ja lukus.** `lib/documents/storageStaging.js` kirjutab uue sisu
esmalt ajutisse faili samas kaustas; `lib/documents/transcriptContent.js` teeb DB-kirjutuse
tehingus ja avaldab faili (`rename`) **tehingu sees viimase sammuna**. Sama failisüsteemi sees on
rename atomaarne, seega lugeja näeb kas vana või uut faili, mitte pooleliolevat.

**Ülekirjutusel hoitakse vana alles.** `publish()` viib olemasoleva faili kõrvale varukoopiaks ja
`rollback()` toob ta tagasi. Ilma selleta oleks „vea korral peab säilima vana fail" ainult lubadus:
rename on kiire, aga tema JÄREL võib tehing ikka veel kukkuda. Just see kitsaim aken on sondis
eraldi veasüstina.

**Mõõdetud kahel tasemel.** Ühiktestid (`tests/documents/storageStaging.test.js`, 8) jooksevad
PÄRIS failisüsteemi vastu ajutises kaustas — võltsitud failisüsteemi all oleks ka vana kood
roheline. Sond (`npm run doc:staging:probe`, **17/17**) lisab päris hoidla ja päris tehingu ning
süstib vea kolme eri kohta: DB-viga enne avaldamist (vana fail alles), tehingu viga PÄRAST
avaldamist (vana fail tuleb tagasi, rida pöördub tagasi), ja loomise viga (**orbfaili ei teki
üldse** — kontrollitud võõrvõtme veaga päris andmebaasis).

**Aus piir mõõtmises.** Kaks tõde said üheks nende kahe raja jaoks, mida leid nimetab. Sama
„kirjuta fail, siis rida" muster võib mujal alles olla; seda peatükki see leid ei kata, ja
lähtekoodi-leping valvab ainult neid kahte marsruuti.

### SOL-DOC-05 — kolme refinement'i piirang pole paralleelsete päringute korral jõustatud — P2

**Tõend.** Refinement loendab artefakti varasemad `ARTIFACT_REFINE` auditiread ja võrdleb arvu kolmega enne AI-kutset (`app/api/documents/artifacts/refine/route.js:97-127`). Piirangul pole artefaktipõhist lukku, reservatsioonirida ega unikaalset slot'i. Audit lisatakse alles pärast genereerimist ja kasutuse commit'i (`:198-230`). Kaks või enam samaaegset päringut võivad kõik lugeda sama arvu alla kolme ja kõik lõpetada edukalt.

**Mõju.** Ühe artefakti lubatud refinement'ide arvu saab ületada nii kiire topeltklõpsu, mitme vahekaardi kui otse-API päringutega. See kasvatab AI-kulu ja muudab UI-le tagastatava `used/limit` lepingu ebausaldusväärseks.

**Vastuvõtukriteerium.** Refinement'i slot tuleb reserveerida atomaarse artefaktipõhise loenduri või unikaalsete slotiridadega enne AI-kutset ja vea korral vabastada; korraga ei tohi olla võimalik võita üle kolme slot'i. Paralleelsustest peab saatma vähemalt neli võistlevat päringut piirile 2/3 ning tõendama täpselt ühe edu.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).**

**PIIR OLI LOENDUS, MITTE KOHT.** Marsruut luges varasemad `ARTIFACT_REFINE` auditiread kokku ja
võrdles kolmega — enne AI-kutset. Auditirida lisandus aga alles PÄRAST genereerimist ja kasutuse
commit'i. Kaks või enam samaaegset päringut lugesid seega kõik sama arvu, kõik nägid ruumi ja kõik
lõpetasid edukalt. Kiire topeltklõps, mitu vahekaarti või otse-API päring kasvatas AI-kulu ja tegi
UI-le tagastatava `used/limit` lepingu ebausaldusväärseks.

**Koht võetakse ENNE kutset ja ta on püsiv rida.** `lib/documents/refinementSlots.js` teeb
kontrollist ja kirjutusest ühe tehingu, mille serialiseerib **artefaktipõhine nõuandelukk**
(`pg_advisory_xact_lock`, AINULT `$executeRaw` kaudu — `$queryRaw` kukub void-tüübi
deserialiseerimisel). „Loe arv → otsusta → kirjuta" ei saa enam kahe päringu vahel läbi põimuda.

**Miks lukk, mitte unikaalne indeks.** Slot ei ole eraldi tabel — ta ON auditirida, ja „mitmes see
rida on" ei ole väärtus, mille peale saaks unikaalsust panna ilma uue veeru ja migratsioonita.
Lukk annab sama garantii skeemi puutumata.

**Kolm seisu, mis hoiavad auditi ausana.** Reserveeritud rida kannab `pending: true`; õnnestumisel
ta kinnitatakse (samas tehingus, kus tasu arvestatakse — SOL-DOC-01 leping), ebaõnnestumisel
vabastatakse. Kustutada saab AINULT veel kinnitamata rea, seega päris auditijälge see tee kunagi
ei puuduta — see on eraldi mõõdetud.

**Mõõdetud päris PostgreSQL-is** (`npm run refine:slot:probe`, **13/13**): 2/3 täis + neli
võistlejat → võidab **täpselt üks**, ülejäänud kolm saavad 429 · tühi artefakt + kuus võistlejat →
võidab täpselt kolm (piir ei tohi olla ka liiga range) · vabastatud koht läheb tagasi ringi ·
kinnitatud auditirida ei kustu vabastusega.

**Negatiivkontroll on osa sondist.** Sama harnessi all jäljendatakse vana mustrit (loe arv,
otsusta, kirjuta hiljem) ja nõutakse, et see limiidist **üle laseks**. Laseb. Seega on
samaaegsus päris ja ülejäänud 12 rohelist on paranduse teene.

### SOL-DOC-06 — sama helifaili paralleelne transkribeerimine teeb mitu kallist tööd ja mitu transkripti — P1

**Tõend.** Route kontrollib esmalt, kas `derivedDocuments` hulgas on transkript, ning kui ei ole, loob uue job'i, kutsub teenusepakkujat ja loob seejärel uue `UserDocument` rea (`app/api/documents/[id]/transcribe/route.js:101-169`, `:177-249`). Skeemis pole aktiivsele job'ile ega `(sourceDocumentId, transcript kind)` paarile unikaalsust (`prisma/schema.prisma:3611-3649`, `:3705-3728`). Kahel paralleelsel esmakutsel on seega võimalik mõlemal näha „transkript puudub”, mõlemal teenusepakkujat kasutada ning mõlemal eri transkript luua.

**Mõju.** Üks kasutajategevus võib tekitada mitu välist kulu, eri sisuga transkriptiversioonid ja mitu job'i; UI näitab neist lihtsalt kõige uuemat. Kuna SOL-DOC-02 järgi STT kasutust ei mõõdeta, ei peata seda ka paketilimiit.

**Vastuvõtukriteerium.** Ühe allika transkriptsioon peab olema idempotentne: atomaarne claim/unikaalne aktiivne job ning üks kanooniline transkript või selgelt versioonitud uus katse. Konkureeriv päring peab liituma olemasoleva job'iga või saama 409/202. Päris DB paralleelsustest peab tõendama ühe provider-kutse ja ühe lõpptulemuse.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).**

**MÕLEMAD NÄGID TÜHJA LAUDA.** Marsruut kontrollis, kas allikal on juba transkript; kui ei olnud,
lõi job'i, kutsus teenusepakkujat ja lõi siis dokumendirea. Skeemis ei olnud unikaalsust ei
aktiivsele job'ile ega paarile (allikas, transkripti liik). Kahel paralleelsel esmakutsel nägid
seega mõlemad „transkripti ei ole", mõlemad maksid ja mõlemad lõid **eri sisuga** transkripti;
liides näitas neist lihtsalt kõige uuemat. Kuna SOL-DOC-02 järgi STT-kasutust ei mõõdetud, ei
peatanud seda ka paketilimiit.

**Otsus ja tema jälg ühes lukustatud tehingus.** `lib/documents/transcriptionClaim.js` teeb kolm
asja ühe allikapõhise nõuandeluku all: kas valmis transkript on olemas (→ `reused`, ilma ühegi
kutseta), kas aktiivne töö käib (→ `busy`, marsruut vastab **409**), või tohin mina alustada
(→ `claimed`, job luuakse kohe `PROCESSING` seisus). Job ei ole enam „kõrvalt loodud" rida, vaid
ON see claim.

**Vananemisaken on lepingu osa, mitte varjatud detail.** Protsessi surm jätab `PROCESSING` rea
alles; ilma aknata ei saaks seda faili enam KUNAGI transkribeerida ja parandus oleks leiust
hullem. Sellest vanem töö loetakse hüljatuks, märgitakse ausalt `FAILED`-iks põhjusega ja uus
katse võtab üle — see on eraldi mõõdetud.

**Mõõdetud päris PostgreSQL-is** (`npm run transcribe:claim:probe`, **13/13**): neli esmakutset →
täpselt üks saab töö, kolm saavad „töö käib", job'e on üks · täisvoog võltspakkujaga → **üks
kutse, üks transkript** · valmis transkript → uut tööd ei tehta · hüljatud töö võetakse üle ·
värske töö ei ole hüljatud.

**Negatiivkontroll on osa sondist.** Sama samaaegsuse all jäljendatakse vana mustrit ja nõutakse,
et see teeks MITU kutset ja MITU transkripti. Teeb. Seega on samaaegsus päris ja ülejäänud 12
rohelist on paranduse teene.

**Aus piir mõõtmises.** Konkureeriv päring saab 409, ta ei „liitu" olemasoleva job'iga — kriteerium
lubab mõlemat („liituma … või saama 409/202"). Liitumine eeldaks voogedastavat tööseisu, mida sellel
rajal ei ole; klient saab tulemuse kätte järgmise päringuga, mis näeb valmis transkripti.

### SOL-DOC-07 — faili- ja salvestuskvoodid on paralleelselt ületatavad — P2

**Tõend.** Tavaline ja audio üleslaadimine loevad kasutaja senise salvestus- ning päevamahu agregaatpäringutega ja loovad faili/DB rea hiljem ilma kasutajapõhise luku või mahureservatsioonita (`app/api/documents/route.js:246-301`, `app/api/documents/audio-sources/route.js:146-204`). Artefakti loomine ja muutmine kasutavad sama loe-summa → kirjuta mustrit (`lib/documents/persistDraft.js:53-72`, `app/api/documents/artifacts/[id]/route.js:184-207`). Kaks päringut võivad mõlemad mahtuda vana summa järgi ja ühiselt limiidi ületada.

**Mõju.** Salvestus- ja päevase üleslaadimise limiit pole koormuse all päris piir; kasutaja võib saada rohkem püsisalvestust kui pakett lubab ning järgnev tavakasutus lukustub ootamatult üle kvoodi seisu.

**Vastuvõtukriteerium.** Salvestusmaht vajab andmebaasis atomaarset kasutajapõhist reservatsiooni/loendurit, mis hõlmab dokumente, materjale ja artefakte ning vabastatakse kustutamisel või vea korral. Paralleelsustestid peavad täitma limiidi lähedale ja saatma korraga mitu upload/create/update päringut, millest võib võita ainult limiiti mahtuv hulk.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (8/8).**

**PIIR KEHTIS AINULT ÜHELE PÄRINGULE KORRAGA.** Neli rada — tavaline üleslaadimine, helifaili
üleslaadimine, artefakti loomine ja artefakti muutmine — lugesid kasutaja senise mahu
agregaatpäringuga ja lõid rea ALLES HILJEM. Kaks päringut mahtusid seega mõlemad VANA summa järgi
ära ja ületasid koos limiidi; kasutaja sai rohkem püsisalvestust kui pakett lubab ja järgnev
tavakasutus lukustus ootamatult „üle kvoodi" seisu.

**Mõõtmine ja kirjutus ühes tehingus.** `lib/documents/storageQuota.js` võtab kasutajapõhise
nõuandeluku, mõõdab summa ja jooksutab kirjutuse **sama tehingu sees** (`write(tx)`). Kui kirjutus
jookseks väljaspool, oleks tulemus täpselt vana kood. Teine päring ootab luku taga ja mõõdab siis
juba uut summat.

**Miks lukk, mitte loenduriveerg.** Kanooniline maht on tuletatav summa mitmest tabelist ja tema
ainus tõde on nendes tabelites endis. Eraldi loendur oleks neljas koht, mida peaks iga kustutuse ja
iga muutuse peale sünkroonis hoidma — ja tema lahknemine oleks nähtamatu. Lukk annab sama
garantii ilma teist tõde loomata ja ilma migratsioonita.

**Asendus vabastab oma senise mahu.** Muutmine ei ole lisamine: `releaseBytes` hoiab ära selle, et
sama suure sisu asendamine täis kvoodi all põhjendamatult kukuks. Eraldi mõõdetud mõlemat pidi.

**Üleslaadimine sai ühtlasi SOL-DOC-04 lepingu.** Fail läheb esmalt ajutisse faili ja avaldatakse
sama tehingu sees viimasena, seega kvoodi 413 ei jäta enam faili kettale.

**Mõõdetud päris PostgreSQL-is** (`npm run storage:quota:probe`, **8/8**): ruumi kahele + neli
võistlejat → õnnestub täpselt kaks, ülejäänud saavad 413, **lõppsumma ei ületa limiiti** · sama
päevase üleslaadimispiiriga (429) · asendus mahub, kasvav asendus ei mahu. Negatiivkontroll näitab,
et vana muster ületab sama samaaegsuse all limiidi.

**Aus piir mõõtmises.** Sond mõõdab lukukihti päris andmebaasi vastu, mitte HTTP-marsruute; et
marsruudid teda ka kasutavad ja summat enam väljaspool ei loe, valvab lähtekoodi-leping. Kvoodi
„vabastamine kustutamisel" tuleb kanoonilisest summast iseenesest: kustutatud rida ei ole enam
summas.

### SOL-RES-01 — kasutaja ei saa oma uuringut kustutada ja tellimuse lõpp sulgeb ka lugemise — P1

**Tõend.** Kõik uuringu list/detail/stream/DELETE rajad kasutavad `requireResearchAuth()` funktsiooni, mis nõuab alati aktiivset tellimust (`lib/research/auth.js:17-57`, `app/api/research/jobs/route.js:121-155`, `app/api/research/jobs/[id]/route.js:57-96`). See erineb dokumentide kanoonilisest kõvast reeglist, mille järgi oma failide ja tulemuste GET/DELETE ei sõltu tellimusest (`lib/documents/server.js:98-117`), ning platvorm lubab, et ligipääs oma andmetele ei aegu (`docs/platvormi arendus/SotsiaalAI.md:752-754`). Lisaks näitab Minu dokumentide UI kustutamisnuppu ainult terminaluuringule ja ootab päriselt kustutamist (`components/documents/DocumentsPage.jsx:382-392`, `:531-545`), kuid serveri DELETE kutsub ainult `cancelResearchJob()`. Terminaltöö puhul tagastab see kohe midagi muutmata ja route vastab ikkagi eduga `status: cancelled`; DB-rida jääb alles (`app/api/research/jobs/[id]/route.js:79-96`, `lib/research/jobStore.js:447-471`).

**Mõju.** Aktiivse tellimuseta inimene ei saa oma uuringu sisendit, tulemust ega olekut lugeda ega kustutada. Aktiivse tellimusega kasutajale öeldakse „kustutatud”, kuid rida ilmub kohe uuesti ja säilib kuni laisa 14-päevase sweep'ini või konto kustutamiseni.

**Vastuvõtukriteerium.** Uue uuringu käivitamine võib jääda tellimusvärava taha, kuid omaniku GET/list/detail ja päris DELETE peavad töötama tellimuseta. Aktiivse töö Stop ja terminaltulemuse Delete peavad olema eri semantikaga idempotentsed toimingud. HTTP-testid peavad katma aktiivse/aegunud tellimuse ning queued/running/done/error/cancelled olekud ja tõendama DB-rea tegelikku eemaldumist.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (15/15).**

**KAKS ERI ASJA OLID ÜHTE AETUD.** (1) Kogu uuringupind — loend, detail, voog ja DELETE — käis
läbi `requireResearchAuth()`, mis nõudis alati aktiivset tellimust. Aegunud tellimusega inimene ei
näinud oma uuringu sisendit, tulemust ega olekut ja ei saanud teda ka ära koristada. Dokumentidel
on sama küsimus juba lahendatud KÕVA REEGLIGA (oma failide lugemine ja kustutamine ei sõltu
tellimusest) ja platvorm lubab, et ligipääs oma andmetele ei aegu. (2) `DELETE` kutsus ainult
`cancelResearchJob()`, mis terminaltöö puhul **väljus kohe midagi muutmata** — ja marsruut vastas
ikkagi eduga `status: "cancelled"`. „Minu dokumentide" kustutusnupp näitas seega „kustutatud" ja
rida ilmus kohe uuesti nimekirja.

**Sama kõva reegel ka siin.** `requireResearchAuth({ allowWithoutSubscription: true })` on nüüd
loendil, detailil, vool, peatamisel ja kustutamisel; **uue tasulise töö käivitamine (POST) jääb
värava taha** — mõlemad on ühes failis kõrvuti, seega erand on nähtav, mitte peidetud.

**Peatamine ja kustutamine on kaks tegu.** `POST /api/research/jobs/[id]/stop` peatab aktiivse töö
ja on idempotentne: juba lõppenud töö puhul ei muudeta midagi ja vastuses on tema **päris**
lõppseis, mitte teeseldud „cancelled". `DELETE` eemaldab rea päriselt; aktiivne töö annab **409
„peata enne"**, sest muidu jääks tasuline töö rippuma. Klient läks kaasa: vestluse Stop kutsub
stop-marsruuti (muidu oleks Stop hakanud tulemust ära viskama), „Minu dokumentide" kustutus jääb
DELETE peale.

**Mõõdetud päris PostgreSQL-is** (`npm run research:delete:probe`, **15/15**) kõigis viies olekus:
`done`/`error`/`cancelled` → **rida on andmebaasist kadunud** · `queued`/`running` → kustutus
keeldub ja rida jääb alles · teine kustutus ütleb ausalt „ei ole" · **võõras töö ja olematu id
annavad SAMA vastuse** (olemasolu-oraaklit ei teki). Negatiivkontroll kinnitab, et vana tee jättis
terminaltöö rea alles.

**Sond tõi välja ühe fakti, mida raportis ei olnud:** andmebaasis on osaline unikaalne indeks
`ResearchJob_userId_active_unique_idx` — ühel kasutajal saab korraga olla ainult üks aktiivne töö.
Sond pidi seetõttu andma igale aktiivsele olekule oma konto.

**Aus piir mõõtmises.** Kriteerium küsis HTTP-testi aegunud tellimusega. Sond mõõdab kustutuskihti
päris andmebaasi vastu ja lähtekoodi-leping mõõdab, et marsruudid kasutavad tellimusevaba väravat
(ja et POST seda EI kasuta) — aga päris sessiooniga HTTP-jooksu aegunud tellimuse all ei ole.
`requireResearchAuth` laadib `next-auth` dünaamiliselt ega ole süstitav; selle katmine eeldaks
brauserisessiooni, mis on selle paranduse skoobist väljas.

### SOL-RES-02 — idempotentsusvõti seob ainult kasutusühiku, mitte uuringutöö — P1

**Tõend.** Route reserveerib `DEEP_RESEARCH_RUN` kasutuse kliendi võtmega ja salvestab adapteri võtme payload'i, kuid loob töö alati uue juhusliku UUID-ga; võtme ja `ResearchJob` vahel pole unikaalset seost (`app/api/research/jobs/route.js:234-255`, `lib/research/jobStore.js:269-325`, `prisma/schema.prisma:1759-1782`). Usage-teenus tagastab sama võtme olemasoleva reservatsiooni — ka terminalse — `reused: true` vastusena, kui metric ja amount kattuvad (`lib/usage/service.js:222-240`). Pärast esimese töö lõppu pole aktiivse töö piirangut, seega sama idempotentsusvõtmega saab luua uue täismahus job'i, mille lõpp-commit taaskasutab juba arvestatud ühikut. Tavaklient ei saada üldse `idempotencyKey` väärtust (`components/chat/hooks/useChatStream.js:417-428`), mistõttu võrgu-/response'i retry saab vastupidiselt luua uue võtme ja uue tasulise töö.

**Mõju.** Teadlikult sama võtit korrates saab ühe kuulimiidi ühikuga käivitada järjest piiramatult uuringuid; tavakasutaja ebaselge võrguvea kordus võib aga kulutada mitu ühikut ja luua topelttöid. Idempotentsus toimib kahes kihis vastupidise tähendusega.

**Vastuvõtukriteerium.** `(userId, clientIntentId)` peab unikaalselt siduma ühe usage-reservatsiooni ja ühe ResearchJob'i; sama payload'i retry tagastab olemasoleva job'i, erinev payload sama võtmega annab 409. Klient peab looma kavatsuse alguses stabiilse võtme ja säilitama selle kuni serveri kindla vastuseni. Testid peavad katma retry enne loomist, aktiivse töö ajal, pärast done/error/cancelled seisu ja sama võtme erineva payload'iga.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (21/21). VAJAB MIGRATSIOONI.**

**IDEMPOTENTSUS TOIMIS KAHES KIHIS VASTUPIDISE TÄHENDUSEGA.** Marsruut reserveeris kasutuse kliendi
võtmega, aga lõi töö ALATI uue juhusliku UUID-ga — võtme ja `ResearchJob` vahel ei olnud mingit
seost. Usage-teenus tagastab sama võtme olemasoleva reservatsiooni (ka terminalse) `reused: true`
vastusena, seega **teadlikult sama võtit korrates sai ühe kuulimiidi ühikuga käivitada järjest
piiramatult uusi täismahus uuringuid**. Tavaklient ei saatnud võtit üldse, mistõttu ebaselge
võrguvea kordus tegi vastupidi: uus võti, uus tasuline töö, topelttöö.

**Kavatsus sai oma veeru.** `ResearchJob.clientIntentKey` + unikaalne `(userId, clientIntentKey)`
(migratsioon `20260811040000`). `claimResearchJobForIntent()` tagastab sama võtme peale olemasoleva
töö — ka pärast lõppu — ja erineva sisendi peale **409**. Sisendi võrdlus käib kavatsuse allkirja
järgi, millest on välja jäetud võtmest endast tuletatud väljad; muidu oleks iga korduskatse „uus
kavatsus". NULL jääb piiranguta, seega võtmeta ja sisemised tööd käituvad nagu enne.

**Kaks unikaalsust, kaks tähendust.** „Üks aktiivne töö kasutaja kohta" ja „üks kavatsus = üks töö"
on eri reeglid ja kutsuja teeb nende peale eri asju, seega P2002 lahutatakse `meta.target` järgi —
ühe veateate alla surumine oleks teinud konfliktist „limiit täis".

**Klient.** Vestlus loob nüüd kavatsuse alguses stabiilse võtme (sama `lib/usage/intentKey.js`, mis
SOL-DOC-01-l) ja kustutab ta alles serveri kindla vastuse peale.

**Sond leidis kohe ühe päris vea, mida ma ise ei näinud.** Esimene versioon tagastas taaskasutatud
töö protsessimälust — ja mälu kandis vana seisu, seega `done` töö vastas „queued". Lõppseisu
autoriteet on nüüd ANDMEBAAS; lokaalset objekti kasutatakse ainult siis, kui töö on veel aktiivne
(voo jaoks on tal vaja sündmusi ja tellijaid). See on sama klass, mida kirjeldab SOL-RES-03, ainult
et siin oli ta paranduse enda sees.

**Mõõdetud päris PostgreSQL-is** (`npm run research:intent:probe`, **21/21**): kordus enne loomist
→ sama töö · kordus pärast `done`/`error`/`cancelled` → **sama töö ja tagastatakse lõppseis, mitte
uus jooks** · sama võti + teine sisend → konflikt ilma uut tööd loomata · kaks eri kasutajat sama
võtmega ei sega teineteist · võtmeta töö käitub nagu enne. Negatiivkontroll näitab, et sidumata
võti annab sama võtme all kaks tööd.

**Migratsioon.** `20260811040000_sol_res_02_research_client_intent` lisab veeru ja unikaalse
indeksi; olemasolevaid ridu ei muuda (kõik saavad `NULL`).

### SOL-RES-03 — worker-režiimis jääb päritoluprotsessi job lõpmatult vanasse olekusse — P1

**Tõend.** Job'i loonud frontend-protsess salvestab iga uue töö alati lokaalsesse `jobs` Map'i (`lib/research/jobStore.js:269-325`). Worker-režiimis claim'ib sama DB-rea eraldi `research-worker` protsess ja uuendab omaenda runtime-objekti (`scripts/research-worker.mjs:31-52`, `lib/research/jobStore.js:579-640`). Originaalse frontend-protsessi Map ei saa neid sündmusi. Stream valib DB pollimise ainult siis, kui lokaalset job'i pole; kohaliku stale job'i olemasolul ta ainult subscribib selle protsessi mälusündmustele (`app/api/research/jobs/[id]/stream/route.js:182-235`). Ka snapshot/result eelistavad Map'i DB-le ning queued/running runtime-objekte ei sweep'ita kunagi (`lib/research/jobStore.js:254-267`, `:336-349`, `:507-519`).

**Mõju.** Dokumenteeritud eraldi worker-unit'i korral võib töö DB-s edukalt lõppeda, kuid selle loonud frontend annab detailis ja SSE-s lõputult `queued`; stale Map võib jääda protsessi kogu elueaks. Vestluse eraldi persistence-poll võib valmimist juhuslikult varjata, kuid progress, Stop, detail-API ja persistence-tõrke rada jäävad valeks.

**Vastuvõtukriteerium.** Worker-režiimis peab DB olema oleku autoriteet: frontend ei tohi aktiivset DB-job'i lokaalse Map'iga varjutada ning SSE peab pollima/subscribima protsessideülese kanali kaudu. Integratsioonitest peab kasutama kahte eraldi protsessi, looma töö frontendist, lõpetama workeris ja tõendama queued → running → done/error/cancelled olekut detailis ning streamis.

**Seis (11.08.2026): DONE — koos päris kaheprotsessilise runtime-tõendiga (8/8).**

**KAKS PROTSESSI, KAKS TÕDE.** Töö loonud frontend-protsess pani IGA uue töö oma lokaalsesse `jobs`
Map'i. Worker-režiimis claim'ib sama DB-rea aga eraldi `research-worker` protsess ja uuendab OMA
runtime-objekti — päritoluprotsessi Map neid sündmusi kunagi ei saa. Kuna snapshot, result ja SSE
eelistasid kõik Map'i andmebaasile, võis töö DB-s edukalt lõppeda, samal ajal kui teda loonud
protsess andis detailis ja voos **lõputult `queued`**. Stale objekt ei kadunud kunagi, sest sweep ei
kustuta queued/running seisu.

**Parandus on omandi küsimus, mitte sünkroonimise oma.** Runtime-objekt on ainult sellel protsessil,
kes tööd PÄRISELT jooksutab: worker-režiimis ei pane loonud protsess teda enam Map'i üldse. Kes tööd
ei jooksuta, loeb andmebaasist — ja siis on andmebaas ainus tõde, mitte kaks võistlevat. Sünkroonimist
ei ole vaja, kui teist koopiat ei ole.

**SSE tuleb kaasa ilma eraldi mehhanismita.** Voog valib andmebaasi pollimise täpselt siis, kui
lokaalset objekti ei ole — ja worker-režiimis teda enam ei ole. Poll ON protsessideülene kanal;
varem ei jõudnud voog selle haruni, sest stale objekt oli olemas ja voog tellis sündmusi, mida keegi
kunagi ei saatnud.

**Mõõdetud PÄRIS kahe protsessiga** (`npm run research:worker:probe`, **8/8**). Sellist viga ei saa
mõõta ühe protsessi sees — kogu viga ongi selles, et kaks protsessi hoiavad eri tõde. Sond käivitab
`spawn`-iga abilise (`scripts/probes/research-job-child.mjs`), kontrollib et tema **pid on päriselt
teine**, laseb tal töö andmebaasis lõpetada ja mõõdab, et loonud protsess näeb lõppu kohe — nii
seisus kui tulemuses.

**Negatiivkontroll on sama harnessi teine pool.** Laps loob töö INLINE-režiimis (seega jääb tal
runtime-objekt), vanem lõpetab töö andmebaasis, ja laps ütleb, mida TEMA arvab seisuks. Ta ütleb
`queued`. Seega mehhanism, mille vastu parandus käib, on päris — ja täpselt seda tegi worker-režiimis
varem ka frontend.

**Aus piir mõõtmises.** Sond lõpetab töö andmebaasis, mitte päris `research-worker` pipeline'i
kaudu (see kutsuks mudelit ja RAG-i). Mõõdetud on seega nähtavuse invariant — „teise protsessi
kirjutatud lõppseis on kohe nähtav" — mitte kogu worker-pipeline. `running` vahepealset seisu sond
eraldi ei mõõda: sama mehhanism kannab teda, sest lugeja ei hoia enam ühtki lokaalset koopiat.

### SOL-RES-04 — lease'i kaotanud worker võib uuringut jätkata ja uue workeri tulemuse võita — P1

**Tõend.** Heartbeat uuendab rida tingimusel `workerId`, kuid ei kontrolli `updateMany.count` väärtust ega katkesta lokaalset tööd, kui lease kuulub juba teisele workerile (`lib/research/jobStore.js:643-682`). Progressi persistence kasutab omakorda tingimusteta `update where id` ning kirjutab lokaalse vana `workerId/leaseUntil` tagasi (`:187-199`, `:370-396`). Done/error/cancel terminalsiire nõuab ainult aktiivset staatust, mitte praegust workerId-d ega lease'i kehtivust (`:201-210`, `:399-471`). Pipeline kontrollib DB-st ainult `cancelled` olekut, mitte lease'i omanikku (`lib/research/pipeline.js:134-140`).

**Mõju.** Pausi või heartbeat'i tõrke järel saab uus worker aegunud lease'i claim'ida, kuid vana worker jätkab mudeli- ja RAG-kutseid. Mõlemad võivad kirjutada vestlusse; vana worker võib lease'i tagasi rikkuda või terminaltulemuse esimesena commit'ida. Tekib topeltkulu, dubleeritud sõnum või vale võitja tulemus.

**Vastuvõtukriteerium.** Iga heartbeat, progress ja terminalsiire peab kasutama fencing-tokenit/attempt-versiooni ning praegust workerId-d; `count=0` tähendab lease'i kaotust ja peab töö abortima. Vestluspersistence peab samuti olema job/attempt-idempotentne. Kahe päris workeriga test peab külmutama esimese üle lease'i tähtaja, laskma teisel claim'ida ning tõendama, et ainult uus omanik võib jätkata ja lõpetada.

**Seis (11.08.2026): DONE — fencing tõendatud kahe päris workeriga (9/9) ja kriteeriumi viimane
lause (vestluspersistence job-idempotentne) sai kaetud SOL-RES-05 plokiga, `persistKey` kaudu.**

**KEEGI EI VAADANUD ARVU.** Heartbeat uuendas rida tingimusel `workerId`, aga ei vaadanud kunagi
`updateMany.count` väärtust — ja seega ei saanud ka teada, kui rida enam talle ei kuulunud.
Progressi kirjutus kasutas tingimusteta `update where id` ja kirjutas vana `workerId`/`leaseUntil`
**tagasi**, varastades lease'i endale. Terminalsiire nõudis ainult aktiivset staatust. Pausi või
heartbeat'i tõrke järel sai uus worker aegunud lease'i claim'ida, aga vana worker jätkas mudeli- ja
RAG-kutseid ning võis terminaltulemuse esimesena commit'ida: topeltkulu ja **vale võitja tulemus**.

**Fencing ilma uue veeruta.** `workerId` ON juba see märk, kes tohib kirjutada — eraldi
fencing-tokenit ei ole vaja. Iga kirjutus käib nüüd tingimusega `workerId = minu oma` (inline-jooksja
puhul `NULL`, mis fence'ib teda samamoodi), ja `count === 0` tähendab lease'i kaotust: lokaalne töö
katkestatakse `abortController`-iga ja rohkem ei kirjutata midagi.

**Üks vahetegemine, mis oleks kergesti valesti läinud.** Terminaalne TULEMUS (`done`/`error`) on
fence'itud, aga TÜHISTUS ei ole. Peatamise päring tuleb frontendist, kes ei ole kunagi lease'i
omanik — kui ka tühistus oleks fence'itud, kukuks omaniku enda Stop worker-režiimis **alati** läbi
ja SOL-RES-01 parandus oleks vaikselt katki. Sond mõõdab mõlemat suunda.

**Pipeline'i „kas tohin jätkata" küsimus sai teise poole.** `syncResearchCancellation()` küsis ainult
„kas tühistatud"; nüüd vaatab ta ka rea omanikku. Üle võetud töö peatub vanas workeris sama teed
pidi nagu tühistatud töö.

**Mõõdetud kahe päris workeri ja kahe protsessiga** (`npm run research:lease:probe`, **9/9**): laps
claim'ib tööna `worker-A` ja **külmub** (ei saada heartbeat'i) · vanem aegutab lease'i ja claim'ib
`worker-B` nimel · uus omanik lõpetab oma tulemusega · vana worker üritab siis progressi kirjutada
ja lõpetada — ei lähe läbi, ta **saab teada**, et lease on kadunud, ja andmebaasi jääb uue omaniku
tulemus. Teine stsenaarium tõendab, et võõra protsessi Stop läheb ikka läbi.

**Kriteeriumi viimane lause tuli järgmise plokiga.** „Vestluspersistence peab samuti olema
job/attempt-idempotentne" on eraldi mehhanism vestlussõnumite kihis ja ühtib SOL-RES-05 sisuga —
seepärast tehti ta seal: `persistDone()` võtab nüüd `persistKey` (`research:<jobId>`) ja sama
tunnusega teist sõnumit ei looda. Kaks workerit ega kaks korduskatset ei kirjuta vestlusse kahte
raportit. Mõõdetud `npm run research:persist:probe` all.

### SOL-RES-05 — vestlusse püsivalt salvestamise viga ei takista tasulise uuringu edukaks märkimist — P1

**Tõend.** Pipeline kutsub enne tööd `persistInit()` ning pärast sünteesi `persistAppend()` ja `persistDone()` funktsioone, kuid kõik kolm neelavad DB vead; `persistDone()` tagastab vea korral `null` (`lib/chat/persistence.js:38-116`, `:118-140`, `:147-241`). Pipeline ei kontrolli tagastusväärtusi ja märgib ResearchJob'i ikkagi `done`, pärast mida kasutus commit'itakse (`lib/research/pipeline.js:1154-1161`, `:1240-1280`, `lib/research/jobStore.js:399-420`). Minu dokumentide uuringurida ei kuva `ResearchJob.result` sisu, vaid pakub ainult vestluse linki (`components/documents/DocumentsPage.jsx:531-545`); job ise kustub vaikimisi 14 päeva pärast.

**Mõju.** Kasutaja võib näha jooksva SSE ajal tulemust ja kulutada uuringuühiku, kuid pärast navigeerimist avaneb vestlus ilma raportita. Täielik tulemus on ajutiselt ainult peidetud detail-API JSON-is ning kaob laisa retention'iga; UI ei paku selle taastamist.

**Vastuvõtukriteerium.** Uuringu edukas lõpp peab tähendama vähemalt ühe kasutajale taasavatava püsikoopia kinnitatud olemasolu. Vestlussõnumi kirjutus peab olema job/attempt-idempotentne ja vea korral jääma taastatavasse `finalizing`/retry olekusse, mitte `done`. Veasüstetestid peavad katkestama init/append/done eri kohtades ning tõendama, et kasutus, job'i olek ja leitav raport jäävad koherentseks.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (10/10).**

**„EDU" TÄHENDAS KUTSE TEGEMIST, MITTE TULEMUST.** `persistInit`, `persistAppend` ja `persistDone`
neelasid kõik DB-vead ja `persistDone()` tagastas vea korral `null`. Pipeline ei vaadanud
tagastusväärtust ja märkis ResearchJob'i **ikkagi `done`**, mille järel kasutus commit'iti. Kasutaja
nägi jooksva voo ajal tulemust ja kulutas uuringuühiku — aga pärast navigeerimist avanes vestlus
ILMA raportita. Täielik tulemus jäi ainult peidetud detail-API JSON-i ja kadus laisa retention'iga.

**Lõpp on nüüd seotud kinnitatud koopiaga.** `conversationCopyConfirmed` tuleb sellest, kas
vestlussõnum PÄRISELT tekkis (`assistantMessageId`), mitte sellest, kas kutse tehti. Kui koopiat ei
õnnestu kinnitada, siis tööd **ei märgita lõppenuks ja kasutust ei arvestata**: töö jääb aktiivseks
ja on korratav. `done` on lubadus, mida ei anta enne, kui teda saab täita.

**Üks kordus enne loobumist.** Ajutine DB-tõrge ei tohi tasulist tulemust ära visata, seega
`persistDone` proovitakse teist korda — ja kuna kirjutus on idempotentne, ei tekita kordus teist
raportit ka siis, kui esimene tegelikult õnnestus ja ainult vastus kadus.

**Idempotentsus on `persistKey` (`research:<jobId>`).** Sõnumi metaandmesse jääb sama tunnus ja
teist sama tunnusega sõnumit ei looda. See kattis ühtlasi SOL-RES-04 kriteeriumi viimase lause.

**Mõõdetud päris PostgreSQL-is** (`npm run research:persist:probe`, **10/10**): kaks kirjutust sama
võtmega → **üks raport**, teine vastus `reused` sama id-ga · kaks eri tööd → kaks raportit (valvur ei
ole liiga lai) · võtmeta kirjutus käitub nagu enne · **süstitud DB-viga annab `null`**, mitte vaikse
edu, ja vestlusse ei jää midagi · võõra vestluse alla ei kirjutata.

**Aus piir mõõtmises.** Sond mõõdab püsikoopia kihti ja veasüsti otse (`deps.prisma`); et pipeline
sellele ka reageerib — `done` jääb tegemata ja `markResearchDone` on valve taga — mõõdab
lähtekoodi-leping. Kogu pipeline'i läbijooksu ei mõõdeta, sest see kutsuks mudelit ja RAG-i.

### SOL-RES-06 — kasutuse lõplik commit/release on best-effort ja võib lõpptulemusest lahkneda — P1

**Tõend.** `markResearchDone()` muudab DB-job'i esmalt `done`-iks, saadab runtime'i result/status/done sündmused ja alles seejärel kutsub usage commit'i (`lib/research/jobStore.js:399-420`). `settleResearchUsage()` neelab kõik commit/release vead (`:213-231`). Kuna research-reservatsiooni TTL on 24 tundi, võib edukaks märgitud töö commit'i vea järel jääda RESERVED-iks ja üldine reaper vabastab selle hiljem kui kasutamata ühiku; töö tulemust see enam tagasi ei pööra. Samuti ei saa DB snapshotist tühistatud töö release'i kohe teha, sest `toPublicFromRecord()` ei säilita payload'i ning `cancelResearchJob()` otsib usage-võtit just `job.payload` seest (`:78-95`, `:213-216`, `:447-471`).

**Mõju.** Edukas tasuline uuring võib jääda paketikasutuses arvestamata või tühistatud töö hoiab limiiti kuni TTL-ini kinni. Job'i seis, kasutusülevaade ja arveldus pole üks taastatav sündmus.

**Vastuvõtukriteerium.** Terminalsiire ja usage settlement vajavad püsivat outbox/finalization olekut ning korduskatset kuni idempotentse commit/release'i kinnituseni. Usage-võti peab olema DB-s eraldi väljal või turvalises snapshotis kättesaadav. Testid peavad sundima commit/release'i ajutisi vigu, protsessi restarti ja reaper'i ning tõendama, et done ei muutu tasuta tööks ja cancel ei jää kvooti kinni.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).**

**VAIKUS OLI KOGU MEHHANISM.** `markResearchDone()` muutis rea esmalt `done`-iks ja kutsus alles
seejärel kasutuse commit'i, mille vead **neelati täielikult**. Research-reservatsiooni TTL on 24
tundi, seega edukaks märgitud töö võis commit'i vea järel jääda `RESERVED`-iks ja üldine reaper
vabastas ta hiljem kui **kasutamata ühiku** — töö tulemust see enam tagasi ei pööranud. Edukas
tasuline uuring jäi paketikasutuses arvestamata ja keegi ei saanud sellest kunagi teada.

**Teine pool oli veel vaiksem.** Tühistatud töö arveldust ei saanud DB-snapshotist üldse teha:
`toPublicFromRecord()` ei säilita payload'i, aga võtit otsiti just sealt. Peatamine teisest
protsessist (mis on SOL-RES-01 järel tavaline tee) ei jõudnud seega reservatsioonini ja kvoot jäi
TTL-ini kinni.

**Kolm muudatust.** (1) Võti on alati leitav — kui teda objektil ei ole, loetakse ta reast juurde.
(2) Arvelduse tulemus JÄÄB REALE KIRJA: õnnestumisel `usageSettledAt` + toiming, ebaõnnestumisel
`usageSettlePending`. Vaikimine oleks siin kõige halvem: rida jääks „edukaks" ja arveldus lahkneks
nähtamatult. (3) Pooleli jäänud arveldusi korratakse (`retryPendingResearchUsageSettlements`) oma
tempos — vaikimisi minut, mitte säilitussweepi tunnine rütm, sest edukas töö ei tohi tunde
arvestamata seista. Commit ja release on ise idempotentsed, seega kordus on ohutu ka siis, kui
esimene kutse päriselt läbi läks ja ainult märge jäi kirjutamata.

**Migratsiooni ei olnud vaja.** Märked elavad töö enda `payload`-is, kus juba on `usageIdempotencyKey`
ja `intentFingerprint` — see on meie oma väli, mitte kliendi oma.

**Mõõdetud päris PostgreSQL-is** (`npm run research:settle:probe`, **13/13**): tundmatu reservatsioon
jätab **pooleli märke, mitte vaikuse** · kordus töötava teenusega lõpetab arvelduse ja märge kaob ·
**snapshot ilma payload'ita** (täpselt see, mida vana kood ei suutnud) leiab võtme ikkagi ja tühistus
jõuab `release`-ni · tühja järjekorra kordus ei kuku.

**Aus piir mõõtmises.** Protsessi restarti ja reaper'i sond eraldi ei jooksuta: kordussweep on
protsessist sõltumatu (märge elab reas, mitte mälus), seega restart on tema jaoks sama mis järgmine
tsükkel. Reaper'i enda käitumine on kaetud `tests/usage/reservationReaper.test.js`-is.

### SOL-RES-07 — soft-nav'i järel pole aktiivse uuringuga taasühendumise ega Stop'i kasutajateed — P2

**Tõend.** Hook'i `detach()` katkestab lokaalse streami ja nullib `researchJobIdRef`, jättes serveritöö õigesti käima (`components/chat/hooks/useChatStream.js:250-279`). Taasavamise ajal pole aga ühtegi koodi, mis otsiks conversationId järgi aktiivset ResearchJob'i ja avaks selle streami uuesti; ainus uuringu POST/stream toimub uue `sendMessage()` sees (`:336-501`). Minu dokumentide aktiivsel uuringureal on ainult vestluse link; Stop/Delete nupp renderdub alles terminalolekus (`components/documents/DocumentsPage.jsx:531-545`). T07 leping nõuab sama aktiivse töö edenemise/tulemuse taastamist ja ütleb, et selge Stop on ainus tühistusrada (`docs/platvormi arendus/t07-documents-research-v1-ulesanne.md:72-77`, `:98`).

**Mõju.** Navigeerimise järel töö küll jätkub, kuid kasutaja ei saa selle edenemist jälgida ega seda enam peatada. Uue uuringu käivitamine annab ühe aktiivse töö piirangu vea; kasutaja peab ootama lõppu või kasutama otse-API-d.

**Vastuvõtukriteerium.** Vestluse avamisel peab klient leidma sama omaniku ja sama conversationId aktiivse job'i, taastama progressi/streami ning siduma Stop-nupu selle ID-ga. Minu dokumentide aktiivne rida peab võimaldama jätkamist ja selget Stop'i. Brauseritest peab tegema start → soft-nav → tagasi → progress → Stop ning tõendama, et uut job'i ei teki.

**Seis (13.08.2026): DONE — nõutud autentitud production-build brauserirada on päris ajutise PostgreSQL-i ja sünteetilise kohaliku kasutajaga tõendatud.** Uuringu käivitamine muutis `ResearchJob`-ide arvu 0 → 1; kogu soft-nav'i, „Minu dokumentide” vaate ja vestlusse naasmise vältel jäi alles sama üks job samas vestluses ning võrgus oli täpselt üks loomise POST. Dokumentide tööruum ei avanud enam peidetud streami, vestlusse naasmine taastas progressi sama job ID GET-streamist ja Stop lõpetas sama serverirea olekuga `cancelled`. „Minu dokumentide” aktiivse rea „Ava vestluses” ja „Peata” kontrolliti samuti brauseris; rea Stop muutis oleku „Katkestatud”. Runtime paljastas ja commit `9e0912ba` parandas peidetud tööruumi duplikaatse SSE-tarbija. Production-build, sihttestid 57/57, ESLint ja diff-check on rohelised; väliseid OpenAI/RAG-kutseid ei tehtud.

**MIS MUUTUS.** Värske ja soft-nav'i järel taastatud uuring kasutavad nüüd sama SSE-tarbijat.
Vestluse avamine leiab omaniku ning `conversationId` järgi aktiivse töö, loob ühe edenemisrea,
taastab progressi ja seob Stopi sama töö ID-ga; samaaegsed/StrictMode'i loendivastused ei saa luua
teist placeholderit, streami ega tasulist POST-i. „Minu dokumentide" aktiivsel real säilib eraldi
Stop-nupp.

**VÕISTLUS- JA TERVIKLUSPIIRID.** Persistence fallback aktsepteerib ainult vestlussõnumi täpselt
sama `researchJobId`-d, mitte korduvat või loendis kärbitud päringuteksti. Stop enne create-POST-i
vastust jätab kavatsuse võtme elama, taastab kadunud vastuse järel selle täpse töö ja tühistab
selle; Stopi 5xx ei peida job'i ega streami, vaid jätab toimingu kordamiseks nähtavaks. Terminalne
mälus olev töö ja DB-poll emiteerivad mõlemad `result → status → done`, sh GET/valmimise võistluses.

**MÕÕDETUD.** Kogu chat+research sihtlõik koos dokumendilepinguga läbis **519/519** testi. Kandev
käitumistest katab olemasoleva töö ühe GET-streami ja progressi, samaaegsete vastuste ühe tarbija,
korduva/pika päringu vana tulemuse tõrje, kadunud või ajapiiri ületanud create-vastuse Stopi,
Stopi vea järel ainult kasutaja algatatud korduskatse, hiljem nähtavaks muutuva töö algse
Stop-kavatsuse ning vana vestluse hilise Stop-vastuse isoleerimise uuest tööst. Mõlemad terminalse
streami võistlused on samuti kaetud. Muudetud failide ESLint ja `git diff --check` on rohelised;
sõltumatu lõppreview ei leidnud pärast parandusi ühtki blockerit. Peatüki lõplik muutumatu
koodipuu läbis UTC täissviidi **4299/4299**.

**BRAUSER NOT_PROVEN.** Kahel värske dev-serveri katsel vastas SSR-leht 200-ga, kuid React ei
hüdreerunud: textarea DOM-väärtus muutus, saatmine jäi disabled, React fiber-sõlmi oli 0 ning HMR
WebSocket lõppes `ERR_INVALID_HTTP_RESPONSE`-iga. Seetõttu ei saanud ausalt läbida nõutud
start → soft-nav → tagasi → progress → Stop rada ega brauseris tõendada, et uut job'i ei teki.

### SOL-DOC-08 — salvestatud analüüside sisu ei lähe salvestuskvoodi arvestusse — P1

**Tõend.** Üks analüüs võib sisaldada kuni 200 000 baiti ja `createSavedAnalysis()` kontrollib enne loomist kasutaja üldist salvestuskasutust (`lib/documents/savedAnalysis.js:15-35`, `:69-114`). `getUserStorageUsageBytes()` liidab aga ainult `UserDocument`, `MaterialSubmission` ja `AgentArtifact.content` mahu; `SavedAnalysis` ridu ta ei loe (`lib/storageUsage.js:4-50`). Seetõttu ei muuda ühegi salvestatud analüüsi loomine järgmise analüüsi quota-check'i sisendit.

**Mõju.** Kasutaja saab järjest salvestada piiramatult kuni 200 kB analüüse, ületades paketi salvestuslimiiti ilma 413-ta. Kasutusülevaade alahindab tegelikku isikliku AI-sisu mahtu ja retention/kulu planeerimine lähtub valest summast.

**Vastuvõtukriteerium.** `SavedAnalysis.content` peab kuuluma kanoonilisse `STORAGE_BYTES` loendurisse ning kasutama sama atomaarset reservatsiooni nagu muud isiklikud objektid. Test peab täitma limiidi analüüsidega, kontrollima järgmise salvestuse 413 vastust ning vabastatud mahtu pärast kustutamist.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).**

**KONTROLL, MIS ISEENNAST EI NÄINUD.** `createSavedAnalysis()` kontrollis enne loomist kasutaja
üldist salvestusmahtu — aga see summa luges ainult dokumente, materjale ja artefakte. Salvestatud
analüüs võib olla kuni 200 000 baiti, ja ükski neist ei muutnud järgmise kontrolli sisendit:
kasutaja sai järjest salvestada piiramatult, ilma ühegi 413-ta. Kasutusülevaade alahindas
tegelikku isikliku AI-sisu mahtu ja retention/kulu planeerimine lähtus valest summast.

**Analüüs on nüüd kanoonilise summa neljas pott** (`analysisBytes`) ja salvestamine kasutab sama
atomaarset kasutajapõhist reservatsiooni nagu iga teine isiklik objekt (SOL-DOC-07 lukk).

**Mõõdetud päris PostgreSQL-is** (`npm run storage:quota:probe`, **13/13**): analüüsideta on pott
null · kaks analüüsi annavad täpselt oma baidid nii omas potis kui kogusummas · täis kvoodi all
saab järgmine analüüs **413** · kustutamine vabastab mahu ja sama kirjutus läheb siis läbi.

**Kõrvalleid, mille parandus välja tõi.** Kõneteenuse ühiktesti fake-klient ei tundnud
`savedAnalysis` mudelit ja puuduv pott ei andnud seal nulli, vaid krahhi — mis oleks maskeerinud
kvoodikeelu millekski muuks. Fake sai neljanda poti — roheline fake-testi sviit ei tõenda
skeemimuudatuse järel iseenesest midagi.

### SOL-DOC-09 — analüüsi salvestamise ja kustutamise auditikutsed ei loo auditirida — P2

**Tõend.** `createSavedAnalysis()` ja `deleteSavedAnalysisForOwner()` kutsuvad vastavalt sündmusi `analysis.saved` ja `analysis.deleted` (`lib/documents/savedAnalysis.js:106-123`, `:146-151`). `buildDocumentAuditRecord()` loob kirje ainult `AUDIT_EVENT_TO_ACTION` kaardis olevale sündmusele, kuid kumbagi analüüsisündmust kaardis pole; tundmatu sündmus tagastab `null` ja `logDocumentsAudit()` lõpetab kirjutamata (`lib/documents/auditShared.js:5-37`, `:77-107`, `lib/documents/audit.js:23-35`).

**Mõju.** Privaatse AI-analüüsi loomine ja kustutamine paistavad koodis auditeerituna, kuid `DocumentAudit` tabelisse ei jää neist ühtegi jälge. Hiljem pole võimalik eristada kasutaja salvestust/kustutust retentionist või puuduvast objektist.

**Vastuvõtukriteerium.** Analüüsisündmused peavad saama skeemis sobivad auditi action'id või selgelt dokumenteeritud eraldi auditiandmekandja; kohustusliku jälje puudumisel ei tohi logifunktsioon vaikides edu teeselda. Test peab kontrollima päriselt loodud/kustutatud `DocumentAudit` rida, mitte ainult funktsioonikutse olemasolu.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (10/10). VAJAB MIGRATSIOONI.**

**VAIKUS OLI LEIU TUUM.** `createSavedAnalysis()` ja `deleteSavedAnalysisForOwner()` kutsusid
auditit sündmustega `analysis.saved` ja `analysis.deleted` — aga kumbagi ei olnud auditikaardis.
Tundmatu sündmus andis `null` ja logifunktsioon lõpetas kirjutamata. Privaatse AI-analüüsi loomine
ja kustutamine **paistsid koodis auditeerituna**, kuid `DocumentAudit` tabelisse ei jäänud neist
ühtki jälge; hiljem ei saanud kasutaja kustutust eristada retentionist ega puuduvast objektist.
Funktsioonikutse olemasolu kontrolliv test oleks olnud roheline kogu selle aja.

**Kolm muudatust, mis vaikuse lõpetavad.** (1) Skeem sai kaks oma action'it — `ANALYSIS_SAVE` ja
`ANALYSIS_DELETE` (migratsioon `20260811020000`, ainult enum-väärtused). (2) `writeDocumentAudit()`
on KOHUSTUSLIK tee: ta ei neela midagi, kaardistamata sündmus ja kirjutuse viga **viskavad**, ja
`db` on süstitav, seega jälg käib samas tehingus toiminguga. (3) Best-effort `logDocumentsAudit()`
jääb alles, aga kaardistamata sündmus ei kao enam vaikselt — ta läheb veatasemel logisse.

**Kustutus ja tema jälg on üks toiming.** Kui jälge ei õnnestu kirjutada, ei kehti ka kustutus —
muidu tekiks täpselt seesama seis, mida leid kirjeldab: objekt on kadunud ja põhjus teadmata.

**Mõõdetud päris PostgreSQL-is** (`npm run analysis:audit:probe`, **10/10**): salvestus loob
täpselt ühe `ANALYSIS_SAVE` rea, mis viitab analüüsile · kustutus loob oma `ANALYSIS_DELETE` rea ·
**olematu analüüsi kustutus ei loo jälge** · kaardistamata sündmus kukub kohustuslikul teel.
Ühiktestid (7) katavad kaardistuse ja kohustusliku tee ilma andmebaasita.

**Migratsioon.** `20260811020000_sol_doc_09_analysis_audit_actions` lisab kaks enum-väärtust
(`ADD VALUE IF NOT EXISTS`), andmeid ei muuda. See on selle peatüki AINUS migratsiooni vajav leid.

### SOL-MEET-01 — snapshoti tõrge võib jätta koosolekukokkuvõtte igaveseks aktiivseks — P1

**Tõend.** `createMeetingSummaryJob()` lisab uue queued-job'i esmalt protsessi `jobs` Map'i ja alles seejärel kirjutab JSON-snapshoti (`lib/documents/meetingSummaryJobs.js:314-342`). Snapshoti vea korral route vabastab kasutusreservatsioonid ja tagastab 500, kuid Map'i lisatud aktiivset tööd ei eemaldata; sweep ei kustuta queued/running olekut (`:46-52`, `:254-262`). Töö käivitamisel muudetakse olek `running`-uks ja snapshot kirjutatakse enne põhifunktsiooni `try` plokki; ka OpenAI mooduli import jääb try'st välja (`:543-563`). Nende vigade korral jõuab erind ainult route'i `queueMicrotask(...).catch` logisse, job'i ei märgita error'iks ega vabastata kasutust (`app/api/documents/meeting-summary/jobs/route.js:145-151`).

**Mõju.** Üks failisüsteemi- või importtõrge võib jätta kasutaja aktiivse töö limiidi protsessi elueaks lukku, hoida STT ja dokumendi reservatsioone ning blokeerida kõik järgmised kokkuvõtted. Kliendile võib esimese stsenaariumi korral tulla 500, kuid retry annab jätkuvalt busy.

**Vastuvõtukriteerium.** Job muutub nähtavaks alles pärast snapshoti edukat loomist või create peab vea korral Map'i ja reservatsioonid atomaarse kompensatsiooniga puhastama. Kogu running/import/persistence algus peab kuuluma ühte fail-closed veakäsitlusse, mis viib terminalolekusse ja settle'ib kasutuse. Veasüstetestid peavad katkestama mkdir/write/rename/import etapid ning tõendama, et uut tööd saab kohe alustada.

**Seis (11.08.2026): DONE.**

**Kaks vaikset viga, mõlemad sama tagajärjega: kasutaja jäi lukku ja keegi ei saanud teada.**

**Esimene oli järjekord.** `createMeetingSummaryJob` pani töö esmalt protsessi `jobs` Map'i ja
kirjutas alles siis snapshoti. Kirjutuse vea korral vabastas route reservatsioonid ja vastas
ausalt 500-ga — aga Map'i jäänud `queued` tööd ei eemaldanud **keegi**, sest sweep ei kustuta
queued/running olekut. Kasutaja aktiivse töö limiit oli **protsessi elueaks** lukus ja iga
järgmine katse sai `busy`. Nüüd kirjutatakse enne ja tehakse nähtavaks pärast; vea korral
käib kaasas kompensatsioon, nii et kettale ei jää rida ega Map'i tööd.

**Teine oli katuse auk.** Running-märge, tema snapshot ja `import("openai")` seisid `try`-plokist
**väljas**. Nende viga jõudis ainult route'i `queueMicrotask(...).catch` logisse: tööd ei märgitud
error'iks, kasutust ei vabastatud, ja limiit jäi samamoodi kinni. Nüüd on kogu jooksu algus ühe
fail-closed katuse all.

**Terminalolek ise on nüüd fail-closed.** Olek pannakse paika mälus ENNE ketast ja ketta viga ei
pööra teda tagasi — just failisüsteemi tõrge on see, mis meid sinna tõi. Kui see viga erindiks
jääks, jääks töö `queued`/`running` olekusse, mida sweep ei korista. Lisaks koristatakse nurjunud
kirjutuse `.tmp` ära: snapshot kannab kohtumise kokkuvõtte teksti, seega poolik fail ei ole
niisama prügi.

**Üks nimeviga parandatud teel.** `runMeetingSummaryJob`-is oli kohalik `const usage =
transcription?.usage` (provideri mõõt) kaks rida `job.usage` arvelduse kutsete all — kaks eri asja
sama nimega. Nüüd on ta `transcriptionUsage`.

**Mõõdetud (`tests/documents/meetingSummaryJobLifecycle.test.js`, 4/4) päris failisüsteemi
vigadega, mitte fake-fs-iga:** kataloogi asemel tavaline fail annab päris `EEXIST` `mkdir`-il ·
sihtfaili asemel kataloog annab päris `EPERM` `rename`-il · impordi tõrge on süstitud laaduri
kaudu · kasutuse settle mõõdetakse süstitud arvestajaga, mis näitab **mõlemat** vabastatud
idempotentsusvõtit.

**Negatiivkontroll on igal testil.** Kolm neljast kukuvad muutmata `HEAD`-i vastu. Neljas —
järjekorra oma — läks esimesel katsel vana koodi peal **läbi**, ja see oli minu testi viga, mitte
paranduse tõend: vanas koodis kukub `createMeetingSummaryJob` juba aktiivsete tööde loendamisel
(`listPersistedMeetingSummaryJobIds` teeb sama `mkdir`-i), seega `jobs.set()`-ini ei jõutagi.
Isoleeritud kontroll — kus tagasi pööratakse AINULT järjekord — annab täpselt selle vea, mida leid
kirjeldab: `documents.agent_workspace.meeting_summary.busy`.

**Aus piir.** Puhast `write`-etappi eraldi failisüsteemi veana ei katkestata, vaid süstitava
`persist`-õmbluse kaudu: iga kataloogitasandi viga tabaks enne kirjutust tema **lugemist**, seega
päris fs-iga ei saa neid kahte lahku mõõta. Kasutuse settle on mõõdetud süstitud arvestajaga, mitte
päris `usageService` ja PostgreSQL-i vastu — see rada jääb `not_run`.

**Vana lepingutest kukkus ausalt läbi** (`tests/usage/legacyQuotaRemoval.test.js`): ta nõudis
lähtekoodist sõna-sõnalt `settleMeetingSummaryUsage(job, "stt", "commit")` ja neljas argument
lõhkus selle. Kontrolli ei lõdvendatud — ta sai **rangema** kuju: `workCompleted` märge ja tema
etapi commit peavad olema KÕRVUTI (seda vana regexp ei nõudnud, seega ei takistanud ta märke ja
arvelduse lahku triivimist), ning süstitava teenuse vaikeväärtus peab olema päris arveldus.

### SOL-MEET-02 — kokkuvõtte ühik commit'itakse enne kasutajale kuuluva dokumendi loomist — P1

**Tõend.** Pärast mudelivastust seab job `document.workCompleted = true`, commit'ib `DOCUMENT_GENERATE` kasutuse ja persistib snapshoti enne `persistMeetingSummaryDocument()` kutset (`lib/documents/meetingSummaryJobs.js:668-680`). Kui faili või `UserDocument` rea loomine ebaõnnestub, catch kutsub küll üldise release'i, kuid `settleMeetingSummaryUsage()` keeldub release'ist kohe, kui `workCompleted` on tõene (`:84-117`, `:697-703`). Commit'i enda viga neelatakse olekusse `commit_pending`, kuid koodis pole selle oleku retry'd (`:92-109`). Dokumendi loomisel ei kontrollita ka kasutaja salvestuskvooti (`:444-515`).

**Mõju.** Kasutaja võib kulutada dokumendiühiku ja saada terminalse error'i ilma leitava kokkuvõttedokumendita. Commit'i ajutise vea korral võib valmis töö muutuda 24 tunni järel üldise reservatsioonireaperi kaudu tasuta tööks; edukas dokument võib samal ajal viia konto üle salvestuslimiidi.

**Vastuvõtukriteerium.** Summary ja kasutajale kuuluv dokument tuleb enne kasutuse commit'i püsivalt siduda või viia taastatavasse finalization-olekusse. `commit_pending` vajab püsivat retry'd; dokument peab läbima atomaarse salvestusreservatsiooni. Veasüstetest peab katma usage commit'i, snapshoti, failikirjutuse ja DB create'i kõik järjekorrad ning tõendama üht koherentset tulemust.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i runtime-tõendiga (12/12).**

**Lahendus oli koodibaasis juba olemas ja kasutamata.** `usageService.commit()` võtab `tx`
parameetri just selleks, et kutsuja saaks arvelduse siduda oma püsiva kirjutusega ühte tehingusse —
ja `meetingSummaryJobs.js` oli kogu koodibaasis selle meetodi **ainus kutsuja**, kes seda võimalust
ei kasutanud. `withStorageQuota()` omakorda võtab `write(tx)` tagasikutse ja serialiseerib ta
kasutajapõhise nõuandelukuga. Kaks olemasolevat tükki klapivad kokku ilma midagi leiutamata.

**Nüüd sünnivad kvoodikontroll, `UserDocument` rida ja `DOCUMENT_GENERATE` commit ühes tehingus:**
kas kõik kolm maanduvad või mitte ükski. `workCompleted` saab tõeseks alles pärast tehingut — just
tema keelas varem release'i ja tegi kasutaja arveldatuks ilma dokumendita.

**Kvooti saab siin JÕUSTADA just sellepärast, et commit on tehingu sees.** Vana kood pidi kvoodist
mööda vaatama (vrd `persistDraft.js` `enforceQuota:false` — „tasutud mustandit ei visata marginaalse
ületuse pärast ära"), sest ühik oli juba võetud. Meil ei ole enne tehingut midagi võetud, seega üle
kvoodi jäänud kasutaja **ei ole arveldatud**. See on tootekäitumise muutus ja ta on teadlik: üle
salvestuspiiri kasutaja saab nüüd kokkuvõtte asemel vea, dokumendiühikut temalt ei võeta.

**`commit_pending` OLI olemas, aga teda ei lugenud keegi kunagi tagasi.** Märge kirjutati juba enne
seda parandust, ainult et ükski rada ei korranud teda — ajutine andmebaasi tõrge muutis tehtud töö
tasuta tööks (reservatsioon jäi `RESERVED`-iks ja 24 h reaper vabastas ta kasutamata ühikuna). Nüüd
loeb `retryPendingMeetingSummaryUsageSettlements()` snapshotid kettalt, seega kordus on protsessi
restardist sõltumatu; ta käib olemasoleva minutise sweep'i sees. Sellega tuli kaasa **teine, raportis
kirjas mitte olnud lõks**: sama sweep oleks pooleli arveldusega terminalsnapshoti TTL-i järgi ära
visanud — ja koos temaga korduse ainsa sisendi. `shouldDelete` hoiab ta nüüd alles.

**Mõõdetud päris PostgreSQL-is** (`npm run meeting:summary:probe`, **12/12**): dokumendirida +
`COMMITTED` reservatsioon + `used=1, reserved=0` · tundmatu võtmega commit kukutab kogu tehingu ja
dokumendirida **EI JÄÄ ALLES** (päris rollback, mida fake-Prisma `$transaction` põhimõtteliselt
mõõta ei saa) ning poolik fail koristatakse kettalt · üle kvoodi jäänud kutse jätab reservatsiooni
`RESERVED`-iks ja kasutuse nulli · sama võtmega teine commit ei võta teist ühikut.

**`npm test` pool** (`tests/documents/meetingSummaryJobLifecycle.test.js`, 8/8): dokumendi vea korral
on dokumendiühik `released` ja STT oma jääb `committed` (provider vastas, väline kulu tekkis
päriselt) · õnnestumisel on tulemus koherentne ja dokumendirajale jõuab roll, ilma milleta kvooti ei
saa arvutada · `commit_pending` kordub kuni õnnestumiseni ja jääb seni kettale alles.

**Negatiivkontroll.** Ainult järjekorra tagasipööramine (ühik enne dokumenti) annab täpselt selle
kahju, mida leid kirjeldab: dokumendiühik on `committed`, kuigi dokumenti ei tekkinud.

**Aus piir.** (1) Puhast failikirjutuse viga eraldi ei süstita — kaetud on commit, kvoot, DB-tasandi
rollback ja snapshot; failikirjutuse tõrge jookseb sama `catch`-i kaudu, aga tal ei ole oma
veasüsti. (2) STT ühik commit'itakse endiselt kohe pärast providerit ja see on **teadlik**: väline
kulu on selleks hetkeks päriselt tekkinud. (3) Kui protsess sureb tehingu ja `markMeetingSummaryDone`
vahel, jääb töö `error`-iks, kuigi dokument on olemas ja ühik võetud — dokument on „Minu
dokumentides" olemas, aga töö seis valetab. See rada jääb lahtiseks. (4) Kordussweep on
protsessipõhine; mitme app-protsessi korral skaneerib igaüks sama kataloogi.

### SOL-MEET-03 — 30-minutilised tundlikud snapshotid võivad pärast restarti jääda tähtajatult alles — P1

**Tõend.** Job-snapshot sisaldab lõpptulemuse `summaryText` väärtust (`lib/documents/meetingSummaryJobs.js:68-81`, `:693-696`). 30-minutiline cleanup-timer läbib ainult aktiivse protsessi `jobs` Map'i ja kustutab snapshoti vaid sealt leitava terminalobjekti puhul (`:26-27`, `:254-262`). Pärast protsessi restarti on Map tühi; koodis pole kataloogi terminalfailide TTL-sweep'i. Faili loetakse ainult konkreetse ID GET-il või aktiivse töö loendamisel ning terminalset vana snapshoti ka siis ei kustutata (`:353-414`). Dokumentide elutsüklikaart kirjeldab sama snapshoti vaikimisi 30-minutilise jobina (`docs/platvormi arendus/fable-5-failide-ja-meedia-elutsukkel.md:81-82`).

**Mõju.** Kohtumise tundlik kokkuvõte võib `AGENT_STORAGE_DIR` kataloogis säilida tähtajatult, kui server restardib enne 30 minuti täitumist. Konto-/dokumendipõhine käsitsi purge vähendab osa juhtumeid, kuid ei jõusta retention-tähtaega orvuks jäänud või lihtsalt vana snapshoti puhul.

**Vastuvõtukriteerium.** Kataloog vajab restart-kindlat sweep'i, mis loeb iga snapshoti, valideerib skeemi ning eemaldab terminalfaili TTL-i järgi; vigased `.json` ja `.tmp` failid vajavad eraldi fail-closed/orphan poliitikat. Restart-test peab looma terminalsnapshoti, tühjendama runtime-Map'i, nihutama aja üle TTL-i ja tõendama sisu kustutamise.

**Seis (11.08.2026): DONE.**

**TTL oli olemas ainult nende tööde jaoks, mille elas üle sama protsess.** Koristus käis läbi
protsessi `jobs` Map'i ja kustutas snapshoti ainult sealt leitud terminalobjekti puhul. Pärast
restarti on Map tühi — ja kuna snapshot kannab valmis `summaryText` välja, jäi kohtumise tundlik
kokkuvõte `AGENT_STORAGE_DIR`-i **tähtajatult** seisma. „30-minutiline TTL" oli seega lubadus, mis
kehtis täpselt nii kaua, kuni server ei taaskäivitunud.

**`sweepMeetingSummarySnapshots()` loeb nüüd kataloogi ennast.** Kolm poliitikat, sest tegu on
kolme eri asjaga:

1. **kehtiv terminalkirje** — tähtaeg tema enda `endedAt` järgi, sama `shouldDelete` reegel;
2. **kehtiv, aga rippuv töö** — `queued`/`running`, mille protsess suri: katkestatakse (see
   **vabastab ka reservatsiooni**, mis muidu hoiaks kvooti kuni TTL-ini) ja alles seejärel hakkab
   tema enda tähtaeg jooksma;
3. **loetamatu `.json` ja orb `.tmp`** — FAIL-CLOSED faili muutmisaja järgi. Nende sisu me ei
   mõista, aga just seetõttu ei tohi nad igavesti alles jääda: **tundliku teksti puhul on „ei
   suutnud lugeda" argument kustutamise POOLT, mitte vastu.** Ooteaeg on olemas ainult selleks, et
   mitte kustutada teise protsessi pooleliolevat kirjutust.

**Skeemivalideerimine on siin sisuline, mitte kosmeetiline.** Ilma selleta ei oska sweep vahet teha
„terminaaltöö, mille tähtaeg on käes" ja „fail, mille sisu ma ei mõista" vahel — ja teine neist
jääks igaveseks alles just seetõttu, et teda ei õnnestunud lugeda.

**Elava töö snapshotti kataloogisweep ei puutu** (omanik on protsess ise), muidu võiks pikk
transkriptsioon saada 15 minuti pealt „rippuvaks" ja iseenda alt kustutatud.

**Mõõdetud (7 uut testi, kokku failis 15/15).** Otse kettale kirjutatud snapshot ONGI restardi
tingimus: seda faili ei ole see protsess kunagi näinud. Tõendatud: aegunud terminalsnapshot kaob
**koos sisuga** (kontrollitakse markeri kadumist, mitte ainult faili puudumist) · värske jääb alles ·
pooleli arveldusega jääb alles ka üle TTL-i · rippuv `running` katkestatakse, vabastab **mõlemad**
reservatsioonid ja aegub alles järgmisel ringil · seisnud katkine `.json` ja orb `.tmp` kaovad,
värsked mitte · tundmatu staatusega kirje loetakse loetamatuks · elava töö oma jääb puutumata.

**Negatiivkontroll.** Sweepi tagasipööramine vana semantika peale („ainult protsessi enda tööd")
kukutab **5 seitsmest**. Ülejäänud kaks on negatiivsed väited („ei tohi kustutada") ja neid rahuldab
ka mittemidagitegev sweep — nad valvavad ülekustutamise, mitte alakustutamise vastu, ja seda tuleb
nii ka lugeda.

**Elutsüklikaart parandatud** (`fable-5-failide-ja-meedia-elutsukkel.md`), sest leid viitas talle
tõendina. Seal olnud väide „konto kustutus ei sihi kataloogi" oli **juba enne seda tööd aegunud** —
`lib/privacy/userDeletion.js:143` kutsub `purgeMeetingSummarySnapshotsForUser`.

**Aus piir.** (1) Sweep on protsessipõhine: mitme app-protsessi korral skaneerib igaüks sama
kataloogi ja teeb sama tööd — see on ohutu (kustutus on idempotentne), aga mitte koordineeritud.
(2) Kataloogi loetakse nüüd minutis kaks korda — kord arvelduse korduse, kord selle sweepi jaoks.
30-minutise TTL-i juures on kataloog väike, seega neid ei ühendatud; kui failide arv kunagi kasvab,
on see esimene koht, mida liita. (3) Päris serveri restarti ei ole jooksutatud — tõend on selles, et
sweep ei kasuta protsessi mälu üldse, mitte selles, et masin oleks taaskäivitatud.

### SOL-MEET-04 — ühe aktiivse töö piirang on paralleelsete POST-ide korral ületatav — P1

**Tõend.** Mõlemad POST-id reserveerivad STT ja dokumentide kasutuse enne job'i loomist (`app/api/documents/meeting-summary/jobs/route.js:93-143`). `createMeetingSummaryJob()` kontrollib aktiivsete tööde arvu Map'i ja snapshotkataloogi lugemisega ning lisab uue job'i hiljem; puudub kasutajapõhine lukk või DB unikaalsus (`lib/documents/meetingSummaryJobs.js:314-342`, `:391-415`). Kahe await'idega põimuva kutse puhul saavad mõlemad lugeda null aktiivset tööd ning luua eri ID ja eri usage-võtmega job'i.

**Mõju.** Üks kasutaja võib käivitada paralleelselt mitu mahukat STT+summary tööd, kuigi UI ja vealeping lubavad ühte. Mõlemad väliskulud ja kasutusühikud arvestatakse ning tulemused võivad UI-s võistelda.

**Vastuvõtukriteerium.** Aktiivne claim peab olema protsessideülene ja atomaarne, eelistatult DB osalise unikaalindeksi/tingimusliku insertiga; kaotaja reservatsioonid vabastatakse. Paralleelsustest peab saatma vähemalt kaks samaaegset POST-i ja tõendama ühe job'i ning ühe STT+document reservatsioonipaari.

**Seis (11.08.2026): DONE — koos päris PostgreSQL-i samaaegsustõendiga (16/16).**

**Vana kontroll ei olnud atomaarne ja ta on nüüd KADUNUD, mitte parandatud.**
`getActiveMeetingSummaryJobCount()` luges aktiivsete tööde arvu protsessi Map'ist ja
snapshotikataloogist ning uus töö lisati alles hiljem. Kahe põimuva `await`-iga POST-i puhul lugesid
**mõlemad** „aktiivseid ei ole" ja lõid mõlemad oma töö oma kasutusvõtmega — üks kasutaja sai
paralleelselt mitu mahukat STT+summary tööd ja mõlemad välised kulud arvestati.

Loendus oli leiu **põhjus**, mitte tema vigane teostus, seega funktsioon on eemaldatud. Tema
kõrvalülesande — rippuma jäänud snapshotide katkestamise ja nende kvoodi vabastamise — võttis
SOL-MEET-03 kataloogisweep juba üle ja teeb seda **tsükliliselt**, mitte alles siis, kui keegi
juhtub uut tööd proovima.

**`MeetingSummaryJobClaim.userId` unikaalsus on ainus koht, kus see võidujooks päriselt lõpeb.**
Mälulukk ei aita üle protsesside ja kataloogilugemine ei ole atomaarne. Kaotaja saab
`ACTIVE_JOB_LIMIT` ja route vabastab tema reservatsioonid juba olemasoleval rajal
(`meeting_summary_job_create_failed`).

**Aegunud claim on üle võetav, aga ainult COMPARE-AND-SWAP'iga:** kustutus on seotud sama rea sama
`updatedAt` väärtusega, seega kaks samaaegset ülevõtjat ei saa mõlemad võita.

**Üks auk tuli välja alles paranduse kirjutamise ajal ja teda ei olnud raportis.** Kui claim'i
`updatedAt` jääks loomise hetke peale seisma, muutuks üle 15 minuti kestev töö „aegunuks" ja teine
POST võiks ta **elusalt üle võtta** — täpselt see kahju, mille vastu see leid on. Südamelöök käib
nüüd jooksu kahes loomulikus punktis (running-märke järel ja transkriptsiooni järel, sest kokkuvõte
võib omakorda kaua võtta). Eraldi taimerit ei ole, sest muid ootepunkte sellel tööl ei ole.
Negatiivkontroll ilma südamelöögita annab sõna-sõnalt `ÜLE VÕETUD`.

**Migratsioon.** `20260811120000_sol_meet_04_job_claim` loob uue tabeli koos `userId` unikaalindeksi
ja `ON DELETE CASCADE` võtmega. **Olemasolevaid ridu ei puudutata** ja see on selle peatüki ainus
migratsiooni vajav leid.

**Mõõdetud päris PostgreSQL-is** (`npm run meeting:summary:probe`, **16/16**, neli uut juhtu): kaks
`Promise.all`-iga samaaegset loomist annavad **täpselt ühe** töö · kaotaja kood on
`ACTIVE_JOB_LIMIT` · andmebaasis on täpselt üks claim · kettal täpselt ühe töö snapshot.

**`npm test` pool** (20/20 failis): kaks samaaegset loomist → üks võidab · terminalolek vabastab
claim'i ja järgmise saab kohe alustada · värsket claim'i ei saa üle võtta, aegunud oma saab · kaks
samaaegset ülevõtjat → ainult üks · elav jooks värskendab oma claim'i ise.

**Negatiivkontroll.** Atomaarse claim'i eemaldamine kukutab neli testi neljast; südamelöögi
eemaldamine kukutab viienda.

**Aus piir.** (1) Andmebaas on nüüd töö loomiseks kohustuslik. See ei ole regressioon — marsruut
reserveerib kasutuse juba enne `createMeetingSummaryJob`-i ja see käib niikuinii andmebaasi kaudu —
aga öeldagu välja. (2) Testide võlts-DB jäljendab ainult `userId` unikaalsust ja `P2002` viga;
päris indeksi käitumist tõendab **ainult sond**. (3) Südamelöök vähendab elusa claim'i ülevõtmise
akent, aga ei sulge teda matemaatiliselt: kui provideri üks kutse kestab üle 15 minuti, on aken
uuesti lahti. Selle sulgemine nõuaks perioodilist südamelööki jooksu sees ja seda ei tehtud.

### SOL-MEET-05 — tundmatu audio kestus arvestatakse alati 60 sekundina ka pikema faili puhul — P1

**Tõend.** Kestuse parser tagastab iga parse-vea korral `null` (`lib/audio/duration.js:8-21`). Route reserveerib sel juhul täpselt 60 `STT_SECONDS` ühikut sõltumata kuni 12 MB faili tegelikust kestusest (`app/api/documents/meeting-summary/jobs/route.js:82-105`). Pärast provider-kutset leitakse võimalusel tegelik `usage.seconds`, kuid usage commit tehakse enne seda ja ilma `actualAmount` väärtuseta (`lib/documents/meetingSummaryJobs.js:580-590`, `:84-103`).

**Mõju.** Toetatud MIME-ga fail, mille kestust lokaalne parser ei tuvasta, võib tarbida palju rohkem kui ühe minuti transkriptsiooni, kuid paketist võetakse alati 60 sekundit. Sellega saab `STT_SECONDS` kuulimiidist süsteemselt mööda minna.

**Vastuvõtukriteerium.** Tundmatu kestus peab kas fail-closed katkestama või reserveerima ohutu maksimaalse mahu faili/piiri järgi; pärast providerit tuleb commit'ida tõendatud tegelik amount lubatud reservatsiooni piires. Testid peavad katma parse'itava, parse'imatu, alla minuti ja pika audio ning kontrollima bucket'i täpset muutust.

**Seis (11.08.2026): DONE.**

**Fikseeritud 60 sekundit ei olnud konservatiivne oletus, vaid möödapääs.** Parser tagastab iga
parse-vea korral `null` ja marsruut pani selle asemele täpselt 60 — sõltumata sellest, et fail võis
olla kuni 12 MB. Sama toetatud MIME-ga fail, mille kestust parser ei tunne, võis olla tunnipikkune
ja `STT_SECONDS` kuulimiidist sai nii **süsteemselt** mööda minna.

**Kaks poolt.** (1) Reserv: teadaoleva kestuse korral `ceil(kestus)`, tundmatu korral **failimahust
tuletatud ohutu ülempiir** (`estimateMaxAudioSecondsFromBytes`). Madalam eeldatav bitikiirus annab
PIKEMA kestuse, seega on ta ohutu suund; vaikimisi 32 kbps, seadistatav. (2) Arveldus: mõõt
arvutatakse nüüd **enne** commit'i ja commit kannab `actualAmount`-i, klammerdatuna reservatsiooni
piiri. Varem käis commit kaks tosinat rida eespool ja ilma tegeliku mahuta, seega võeti alati kogu
reserv.

**Kasutaja maksab ainult tõe eest; suur on ainult ajutine reservatsioon.** Aga sellel on hind ja
see on teadlik: **kliendi paketi kuulimiit on 900 s ja 12 MB tundmatu fail annab ülempiiriks üle
3000 s**, seega selline üleslaadimine lükatakse tagasi. Kriteerium lubas kaks teed — fail-closed
katkestamine või ohutu maksimum — ja suure faili puhul need kaks langevad praktikas kokku. See on
õige suund: 60-sekundilise reserviga läbi lastud tunnipikkune fail oli täpselt see viga.

**Mõõdetud (10 testi).** Töö pool: mõõdetud lühem kestus läheb arvele tegelikuna, mitte reservina ·
mõõt klammerdub reservatsiooni piiri · murdosa sekundit ümardatakse ÜLES · **tundmatu mõõdu korral
ei mõelda väiksemat summat välja**, commit jääb reservatsiooni peale. Hinnangu pool: maht → sekundid
skaleerub lineaarselt, 12 MB annab üle 3000 s (mitte 60), madalam bitikiirus annab pikema kestuse,
vigane seadistus langeb tagasi vaikeväärtusele, mitte `Infinity`-le.

**Negatiivkontroll.** `actualAmount`-i eemaldamine kukutab kolm testi.

**Aus piir.** Bitikiiruse põrand on **eeldus, mitte mõõt** — ta on valitud ohutus suunas, aga ta ei
ole tõendatud päris salvestiste vastu. Seda rada sond ei kata: `meeting:summary:probe` mõõdab
dokumenti, tehingut ja claim'i, mitte STT arvestust.

### SOL-MEET-06 — väline veateade salvestatakse ja tagastatakse kasutajale puhastamata — P2

**Tõend.** Job'i catch annab `markMeetingSummaryFailed()` funktsioonile otse `String(error.message)` ning see salvestatakse snapshoti `error` väljale (`lib/documents/meetingSummaryJobs.js:434-441`, `:697-702`). Detailroute tagastab sama väärtuse kliendile muutmata (`app/api/documents/meeting-summary/jobs/[id]/route.js:45-48`, `lib/documents/meetingSummaryJobs.js:372-384`). Erinevalt transkriptsiooni ja summary tavaroutest ei kasutata `publicErrorMessageKey()` allowlist'i.

**Mõju.** OpenAI SDK, failisüsteemi või DB täpne veatekst võib lekkida autentitud kasutajale ja püsivasse JSON-snapshoti; see võib avaldada sisemisi teid, teenusepakkuja detaile või diagnostilist konteksti ning rikub API lokaliseeritud vealepingut.

**Vastuvõtukriteerium.** Avalik job.error peab olema allowlistitud lokaliseeritav võti; toorviga läheb ainult redigeeritud serverilogisse. Test peab süstima provider-, filesystem- ja DB-vea koos tundliku markeriga ning tõendama, et marker puudub HTTP vastusest ja snapshotist.

**Seis (11.08.2026): DONE.**

**Toorviga läks kahte kohta korraga:** kasutajale HTTP vastuses ja **püsivasse JSON-snapshoti**.
`markMeetingSummaryFailed()` sai otse `String(error.message)` ja detailmarsruut tagastas selle
muutmata. OpenAI SDK, failisüsteemi või andmebaasi täpne veatekst võis nii kanda sisemisi teid,
teenusepakkuja detaile ja diagnostilist konteksti.

**Nüüd käib avalik viga `publicErrorMessageKey()` allowlist'ist läbi** (sama, mida ülejäänud
dokumendirajad kasutavad) ja toorviga läheb ainult `safeError()`-iga redigeeritud serverilogisse.

**Teel ühtlustus ka välja kuju.** Sama `error` väli kandis kolme eri asja: katkestusrada salvestas
**võtme**, seadistusrada **tõlgitud lause** ja provideri rada **toorteksti**. Nüüd on kõik kolm
võtmed. Kontrollisin enne muutmist, et ükski klient `job.error`-it praegu ei tarbi — seega
tõlgitud lauselt võtmele üleminek ei riku ühtki vaadet.

**Mõõdetud (2 testi).** Provideri viga tundliku markeriga (`sk-live-…` + sisemine tee): avalik
väärtus on täpselt `documents.agent_workspace.meeting_summary.error` ja marker puudub **nii
väljundist kui ka kettale kirjutatud snapshotist** — snapshot kontrollitakse eraldi, sest just tema
on püsiv. Teine test hoiab vastupidist: meie **oma** võtmega viga (`api.stt.not_configured`) peab
kasutajani muutmata jõudma, muidu oleks „puhastamine" tähendanud kogu info kaotamist.

**Negatiivkontroll.** Toorvea otse väljastamine kukutab lekketesti.

**Aus piir.** Failisüsteemi ja DB vead jooksevad sama `catch`-i kaudu ja saavad seega sama kaitse,
aga neid **eraldi markeriga ei süstitud** — kriteerium nimetas kolme allikat, tõendatud on üks.

### SOL-CHAT-01 — tasuline vestlusvastus commit'itakse enne püsivat vestlust ja salvestusviga raporteeritakse eduna — P1

**Tõend.** Tavavastuse rada märgib provider'i järel `CHAT_ASSISTANT_REPLY` kasutuse commit'ituks enne `finalizeAssistantReply()` kutset nii mittevoogedastuses kui SSE-s (`lib/chat/mainResponseHandler.js:680-720`, `:833-883`). Ka no-context vastus commit'itakse enne finalize'i (`:586-653`). `finalizeAssistantReply()` eeldab püsistuse õnnestumist, kuid kõik kolm püsistusastet neelavad DB-vead: `persistInit()` logib ja tagastab, `persistAppend()` logib ja tagastab ning `persistDone()` tagastab `null` (`lib/chat/persistence.js:38-115`, `:118-139`, `:147-240`). Finalizer ei kontrolli, kas kasutajasõnum, assistendisõnum või terminalmarker tegelikult tekkis, ja tagastab edukad manused/vastuse ka `null` tulemuse korral (`lib/chat/responseFinalizer.js:174-251`).

**Mõju.** Kasutaja limiit võib väheneda ning UI kuvada täieliku eduka vastuse, mida vestluse taasavamisel enam ei ole. Kui `persistInit` ebaõnnestub, võib puududa ka kasutaja küsimus; kui `persistDone` ebaõnnestub, jääb vestlus kasutajasõnumi järel kuni stall-timeout'ini näiliselt `RUNNING` olekusse. Korduskatse tekitab uue tasulise töö.

**Vastuvõtukriteerium.** Ühe pöörde kavatsus, kasutussündmus, kasutajasõnum ja assistendi terminaltulemus vajavad taastatavat ühist olekut. API ei tohi vastata `COMPLETED`, kui nõutud püsistus pole kinnitatud; pärast provider'i valmimist tekkinud DB-viga peab jätma sama võtmega taastatava tulemuse, mitte kadunud vastuse. Veasüstetestid peavad katkestama iga püsistusastme eraldi nii stream- kui non-stream-rajal ja kontrollima kasutust, vastust ning `/api/chat/run` olekut.

**Seis (11.08.2026): DONE — koos SOL-CHAT-02-ga üks plokk, sest neil on üks juur.**
- **Parandus on JÄRJEKORD, mitte uus valve.** Arveldus ei ole enam oma samm: `persistDone()` võtab
  `settleUsage`-i ja jooksutab teda OMA TEHINGUS, terminalmarkeri kõrval. Kolm vastuserada
  (no-context, tavavastus, voog) annavad commit'i kaasa; kolm terminalrada (provideri viga, Stop,
  voo viga) annavad kaasa release'i. Sellega ei ole „arvestatud, aga kadunud" ja „püsiv, aga
  arveldamata" enam olekud, mida kood suudab toota — rollback viib mõlemad korraga tagasi.
- **`usageService.release` sai `tx` toe** (commit'il oli see juba SOL-MEET-02 ajast olemas). See on
  ainus uus võimekus; ülejäänu on olemasoleva kasutamine õiges kohas.
- **Kasutaja küsimuse kirjutamine on nüüd pöörde EELDUS.** `persistInit()` tagastab `true/false` ja
  `false` peatab pöörde **enne providerit**: tasulist kutset ei tehta, reservatsioon vabastatakse,
  vastuseks 503 `chat.error.not_saved`. Varem läks küsimuseta pööre täies mahus läbi.
- **Kinnitamata püsistus ei anna enam `done`-i.** Voog emiteerib `event: error` võtmega
  `chat.error.not_saved`; non-stream ja no-context annavad 503. Ühik on selleks hetkeks vabastatud,
  seega korduskatse ei maksa kaks korda.
- **Tõendatud päris PostgreSQL-is: `npm run chat:settle:probe` 23/23.** Sondi tuum on rollback,
  mida fake-Prisma ei saa tõendada (`$transaction` on seal lihtsalt funktsioonikutse): arvelduse
  viga tehingus **kustutab ka juba kirjutatud assistendisõnumi**, ja vastupidi — vabastuse viga ei
  jäta ABORTED markerit kettale. Kaetud on ka päris `USAGE_RESERVATION_STATE_CONFLICT` (mitte ainult
  visatud erand) ja võõra omaniku vestlus (ei sõnumit, arveldust ei kutsuta üldse).
- **Negatiivkontroll sondis:** sama harness jäljendab vana järjekorda (commit enne püsistust) ja
  NÕUAB, et keelatud seis tekiks — arvestatud ühik ilma vestlusse jõudnud vastuseta. Ta tekib,
  seega ülejäänud 22 rohelist on paranduse teene, mitte harnessi oma.
- **Ühiktestid:** `tests/chat/turnDurability.test.js` (7 uut) mõõdab marsruudi otsust: 503 +
  vabastus + eraldi commit'i puudumine, voog ilma `done`-ita, `persist=false` raja endine käitumine,
  provideri kutsumata jätmine `persistInit` vea järel. `tests/usage/chatRouteUsage.test.js` vana
  kujuleping **pöörati ümber**: ta mõõtis varem, et commit KUTSUTAKSE kolmel rajal — just see oli
  leid. Nüüd nõuab ta, et ükski rada ei commit'i ise.
- **Aus piir.** `persist === false` (ruumirada ilma vestluseta) jääb eraldi commit'i sammuks, sest
  siduda ei ole millegagi; see on koodis nimeliselt välja öeldud. Kriteeriumi lause „sama võtmega
  taastatav tulemus" katab **SOL-CHAT-03** (stabiilne pöördevõti) — siin on tagatud ainult see, et
  kadunud vastuse eest ei võeta tasu. `/api/chat/run` olekukontroll ja päris brauserirada on
  katmata: `runtime: not_run`.

### SOL-CHAT-02 — kasutuse commit/release'i viga neelatakse alla ja vestlus jätkub vale arvestusseisuga — P1

**Tõend.** `settleChatUsage()` püüab nii commit'i kui release'i vea kinni, kirjutab ainult logi ja ei anna kutsujale ebaõnnestumisest märku (`lib/chat/mainResponseHandler.js:539-548`). Kõik põhivestluse edurajad kasutavad seda helperit ning jätkavad vastuse püsistamise/tagastamisega ka ebaõnnestunud commit'i järel (`:631-653`, `:697-742`, `:833-895`). Provider'i vea ja Stop'i rajad jätkavad terminalmarkeri kirjutamisega ka ebaõnnestunud release'i järel (`:756-804`, `:901-929`, `:996-1011`). Reservatsioonil on 15-minutiline TTL ning adapter ei loo settlement'i retry/outbox'i (`lib/usage/routeAdapter.js:7-32`, `:93-109`).

**Mõju.** Edukas AI-vastus võib jääda üksnes reserveerituks ja hiljem reaper'iga tasuta vabastuda; nurjunud või katkestatud pööre võib jääda ajutiselt limiiti kinni. Logikirje ei taasta kasutuse ja tulemuse kooskõla ning korduskatse uue võtmega võib olukorda dubleerida.

**Vastuvõtukriteerium.** Settlement peab olema idempotentne ja püsivalt retry-tav või kuuluma sama pöörde olekumasinasse; terminalseis peab näitama `commit_pending/release_pending`, kuni arvestus on kinnitatud. Testid peavad süstima commit/release'i enne tehingut ja ebamäärase vea pärast tehingut, käivitama retry/reaper'i ning tõendama täpselt ühe lõpparvestuse.

**Seis (11.08.2026): DONE — sama plokk mis SOL-CHAT-01, vt sealt tõendid.**
- **Kriteerium lubas kaks teed ja valitud on TEINE:** „kuuluma sama pöörde olekumasinasse".
  Arveldus on nüüd terminalse kirjutusega ühes tehingus, seega vahepealset seisu
  `commit_pending`/`release_pending` **ei ole olemas** — ei ole akent, mille jaoks teda vaja oleks.
  Esimene tee (püsiv pending-seis + kordaja) oleks olnud kolmas koht, kus sama tõde hoitakse:
  reservatsioon, marker ja pending-märge. Vt SOL-DOC-07 sama otsust loenduriveeru kohta.
- **Neelamine on kadunud sealt, kus ta valetas.** `settleChatUsage()` (best-effort + logi) on alles
  ainult kahel rajal, kus siduda ei ole millegagi: `persist=false` commit ja see haru, kus
  terminalmarkerit ennast ei õnnestunud kirjutada. Mõlemad on koodis nimeliselt välja öeldud, mitte
  vaikimisi. Kõik ülejäänud rajad kannavad arvelduse vea EDASI — tehing kukub, kutsuja saab teada.
- **Topeltarveldust ei teki:** iga terminalrada vaatab, kas marker (ja koos temaga arveldus) jõudis
  kettale (`releasedWithMarker`), ja alles siis kaalub eraldi vabastust. Voo tehnilise vea rada sai
  ühtlasi `!streamFinalized` värava — vana kood kirjutas ERROR markeri ka juba edukalt lõpetatud
  pöörde otsa.
- **Mõõdetud:** `npm run chat:settle:probe` 23/23 päris PostgreSQL-is (sh vabastuse viga → markerit
  ei jää; ABORTED marker + RELEASED reservatsioon ühes tehingus; ämbri `used`/`reserved` mõlemas
  suunas). `npm test` **3644/3644**, `npm run i18n:check` OK, `npx eslint` puhas.
- **Katmata:** reaper'i enda rada (`USAGE_RESERVATION_REAPER` on toodangus vaikimisi väljas) ja
  päris HTTP-tasemel veasüst. `runtime: not_run`.

### SOL-CHAT-03 — kliendi pöördel puudub stabiilne idempotentsusvõti ja Retry seos kaob — P1

**Tõend.** Tavavestluse klient saadab `/api/chat` payload'is sõnumi, ajaloo, `convId` ja `retryOf`, kuid mitte `idempotencyKey` väärtust (`components/chat/hooks/useChatStream.js:717-758`). Route kasutab sama puuduva väärtuse põhjal eraldi chat- ja RAG-reservatsioone (`app/api/chat/route.js:248-305`); adapter genereerib puuduva kliendivõtme korral iga HTTP katse jaoks uue UUID (`lib/usage/routeAdapter.js:41-55`). `persistInit()` loob iga katse kohta uue USER-sõnumi ja skeemis pole pöördepõhist unikaalvõtit (`lib/chat/persistence.js:38-109`, `prisma/schema.prisma:1576-1589`). Lisaks annab kliendi `resolveRetryTarget()` kohaliku sõnumi ID edasi arvuna (seda tõendab test väärtusega `2`), kuid route aktsepteerib `retryOf` välja ainult stringina, mistõttu seos visatakse ära (`tests/chat/stopRetryLifecycle.test.js:168-177`, `components/chat/hooks/useChatStream.js:1039-1048`, `app/api/chat/route.js:366-372`).

**Mõju.** Brauseri/vahendaja korduspäring või kasutaja Retry võib luua mitu kasutaja- ja assistendisõnumit, mitu providerikutset ning mitu kasutusühikut sama kavatsuse eest. Auditis ei saa usaldusväärselt siduda kordusvastust ebaõnnestunud pöördega.

**Vastuvõtukriteerium.** Klient peab looma enne esimest saatmist ühe stabiilse pöörde-ID, saatma selle retry'del muutmata ning server peab selle alusel atomaarse pöörderea/tulemuse taaskasutama. USER- ja ASSISTANT-kirjed, chat/RAG kasutus ning `retryOf` peavad olema sama serveripoolse identiteediga seotud. Integratsioonitest peab kordama identset HTTP kavatsust paralleelselt ja pärast timeout'i ning tõendama üht providerikutset, üht kasutussettlement'i ja üht sõnumipaari.

**Seis (11.08.2026): DONE — koos SOL-CHAT-04-ga üks plokk, sest mõlema kriteerium algab samast
puuduvast asjast: pöördel ei olnud rida, mille külge kinnituda.**
- **Uus mudel `ChatTurn`** (migratsioon `20260811160000`, uus tabel + uus enum `ChatTurnStatus`;
  olemasolevaid ridu ei puudutata). Unikaalsus **`(userId, clientTurnKey)`** on ainus koht, kus üks
  kavatsus muutub üheks reaks. Rida kannab mõlemat poolt (`userMessageId`, `assistantMessageId`),
  seega USER/ASSISTANT paar on **seotud**, mitte ajatemplist tuletatud.
- **Klient loob võtme enne esimest saatmist** ja hoiab teda kuni kavatsus on lahendatud:
  võrguviga, Stop ja „Proovi uuesti" saadavad SAMA võtme; lõpetatud pöörde järel võti kustutatakse,
  seega tahtlik sama küsimuse uuesti küsimine on aus uus töö. Primitiiv oli koodibaasis juba olemas
  — `resolveIntentKey`/`buildIntentSignature` (SOL-DOC-01) — ja seda ei kirjutatud teist korda.
- **Sama võti läheb NII pöörde reale kui kasutusarvestusse** (`idempotencyKey`). Kaks eri identiteeti
  ühe kavatsuse peal oli osa leiust: `routeAdapter` genereeris iga HTTP-katse jaoks uue UUID-i.
  Kordus taaskasutab nüüd reservatsiooni; `usageService` oskab RELEASED rea sama perioodi sees ise
  üles äratada, seega parandus ei vajanud arvestusteenuses ühtegi muudatust.
- **`retryOf` tüübiviga parandatud seal, kus ID sünnib:** `resolveRetryTarget()` tagastab stringi.
  Vana test nõudis arvu `2` — ta kodeeris viga; nüüd on tüüp lepingu osa.
- **Kolm uut serveri vastust:** lõpetatud kavatsuse kordus → **salvestatud vastus tagasi, ilma
  providerita ja ilma uue tasuta**; sama kavatsus juba töös → **409**; teine kavatsus samas
  vestluses → **409**.
- **Mõõdetud päris PostgreSQL-is: `npm run chat:turn:probe` 20/20**, võistlejad `Promise.all`-iga.
  Sh: sama võti kaks korda korraga → üks töö + üks „juba töös" + **üks kasutajasõnum**; lõpetatud
  kordus ei loo uut pööret ega uut sõnumit; ebaõnnestunud pöörde kordus on **sama rida, `attempt`
  kasvab**. Ühiktestid `tests/chat/turnIdentity.test.js` (7 uut) mõõdavad marsruudi otsust iga
  tulemuse peale.
- **Aus piir.** Ilma kliendivõtmeta (vana klient) jääb vana rada alles ja **kaitset ei ole** — see
  on koodis ja testis nimeline, mitte vaikiv. Dokumendi- ja abitöövoo harud (`document`/`help`) ei
  käi veel pöörde nõude alt läbi; nende oma leiud on eraldi. `runtime: not_run` — kahe vahekaardi
  päris brauserirada on käimata.

### SOL-CHAT-04 — sama vestluse paralleelsed pöörded rikuvad järjekorda ja sessioonipiiri — P1

**Tõend.** Sessioonipiir loeb olemasolevad USER-sõnumid ja otsustab lubamise enne uue sõnumi loomist, ilma vestluse lukuta või atomaarse loendurita (`lib/chat/requestBootstrap.js:269-288`). `persistInit()` teeb vestluse olemasolu kontrolli, USER-sõnumi loomise ja aktiivsusaja update'i, kuid ei loo aktiivse pöörde lukku ega järjekorranumbrit (`lib/chat/persistence.js:38-109`). Skeemis olevat `ConversationRun` mudelit aktiivne chat-kood ei kasuta; otsingus leiduvad ainult retention ja admin-reset (`prisma/schema.prisma:1348-1367`). Kliendi `isGeneratingRef` piirab topeltklikki ainult ühes hook'i instantsis (`components/chat/hooks/useChatStream.js:239-244`, `:1039-1048`), mitte teises vahekaardis ega otseses HTTP-s.

**Mõju.** Kaks vahekaarti või paralleelpäringut võivad mõlemad läbida viimase lubatud pöörde kontrolli, käivitada kaks AI-tööd ja salvestada vastused vales kronoloogilises paaris. `/api/chat/run` tuletab oleku lihtsalt viimasest ajatempliga sõnumist, seega ühe pöörde terminalmarker võib varjata teise veel jooksvat või hiljem ebaõnnestuvat pööret (`app/api/chat/run/route.js:166-237`).

**Vastuvõtukriteerium.** Vestlus vajab serveripoolset pöörde-ID-d ja kas ühte aktiivset pööret või selget järjestatud mitme pöörde lepingut. Limiidi reserveerimine peab olema atomaarne ning USER/ASSISTANT paarid seotud. Päris PostgreSQLi test peab saatma sama `convId`-ga paralleelpäringud limiidi eel ja tavaseisus ning kontrollima limiiti, järjekorda, kasutust ja `/api/chat/run` tõde.

**Seis (11.08.2026): DONE — sama plokk mis SOL-CHAT-03, vt sealt mudel ja sond.**
- **Valitud on „üks aktiivne pööre"**, mitte järjestatud mitme pöörde leping: teine samaaegne
  kavatsus saab 409. Järjekorranumbriga variant oleks nõudnud kliendipoolset mitme voo haldust ja
  poleks kaotanud ühtegi tegelikku kahju — kaks paralleelset pööret samas vestluses on kasutaja
  jaoks niikuinii viga, mitte funktsioon.
- **Sessioonipiir on nüüd atomaarne.** Lugemine ja kirjutamine käivad ühes tehingus
  `pg_advisory_xact_lock(4712, hashtext(conversationId))` all — vestlusepõhine, seega eri vestlused
  ei serialiseeru. Lukk `$executeRaw` kaudu ([[prisma-advisory-lock]]: `$queryRaw` kukub `void`
  tüübil).
- **Kaks kohta, kus piiri loetakse, ja see on teadlik.** `requestBootstrap` varane kontroll jäi
  alles kui **mitteatomaarne odav värav** („kas tasub üldse alustada"); jõustaja on pöörde nõue
  („kes sai viimase koha"). Mõlemad on koodis nimeliselt välja öeldud, et hilisem lugeja ei arvaks,
  et üks neist on üleliigne.
- **Rippuma jäänud pööre ei lukusta vestlust igaveseks:** `updatedAt` on lease (vaikimisi 15 min,
  `CHAT_TURN_LEASE_MS`), aegunud RUNNING pööre suletakse ausalt `ERROR`-iks ja uus pööre saab töö.
  Sama õppetund mis SOL-MEET-04 claim'il.
- **Terminalseis pannakse paika `persistDone`-i TEHINGUS** (`closeChatTurn`), seega „vestluses on
  vastus, aga pööre on igavesti RUNNING" ei ole seisund, mida kood suudab toota.
- **Mõõdetud päris PostgreSQL-is: `npm run chat:turn:probe` 20/20**, sh „vabu kohti täpselt üks,
  neli võistlejat → võidab täpselt üks ja kasutajasõnumeid on kokku kaks" ning **negatiivkontroll**:
  sama harness jäljendab vana mustrit (loe loendur väljaspool lukku → kirjuta) ja NÕUAB piiri
  ületamist. Ta ületab, seega ülejäänud rohelised on paranduse teene.
- **Katmata jäi kriteeriumi viimane sõna — `/api/chat/run` tõde.** Marsruut tuletab oleku endiselt
  viimasest sõnumist, mitte `ChatTurn` reast; nüüd, kus see rida on olemas, on see omaette
  ühesammuline töö ja ta kuulub **SOL-CHAT-06** juurde, kus kliendi lõpukinnitus niikuinii sama
  marsruuti kasutama hakkab. `runtime: not_run`.

### SOL-CHAT-05 — Stop võib provider'i `done` järel siiski commit'ida kasutajale kuvamata täisvastuse — P1

**Tõend.** Streami lõppfunktsioon seab `streamFinalized = true` kohe sisenemisel, alles seejärel flush'ib viimase delta, commit'ib kasutuse ja püsistab kogu `accumulated` vastuse (`lib/chat/mainResponseHandler.js:833-883`). Abort-listener seab ainult `aborted/clientGone` lipud (`:931-940`). Kui Stop jõuab `done` sündmuse järel finaliseerimise ajal, ei saada `flushPendingDelta()` ega `done` enam kliendile midagi, kuid commit ja püsistus jätkuvad; hilisem `finalizeStreamAbort()` ei tööta, sest `streamFinalized` on juba tõene (`:819-840`, `:884-929`, `:987-1004`). Olemasolev Stop-test katkestab enne provider'i `done` sündmust ja ei kata seda ajastust (`tests/chat/stopRetryLifecycle.test.js:215-279`).

**Mõju.** Kasutaja vajutab Stop, näeb katkestatud/osalist teksti, kuid limiit kulub ja vestluse taasavamisel võib ilmuda pikem sisu, mida talle katkestamise hetkel ei näidatud. See rikub koodi enda lubadust „salvestab AINULT juba kuvatud osalise teksti”.

**Vastuvõtukriteerium.** Lõpetamine vajab üht atomaarset olekusiiret, kus abort võib võita kuni kliendile `done` kinnitamise piirini; püsistatav tekst peab olema serveri poolt tegelikult emiteeritud tekst, mitte kogu provider'i puhver. Deterministlik test peab abortima enne viimast flush'i, flush'i ajal, attribution/persistence'i ajal ja pärast `done` emiteerimist ning kontrollima iga kord nähtava teksti, terminalstaatust ja kasutust.

**Seis (11.08.2026): DONE — kaks eraldi viga ühe pealkirja all.**
- **Esimene: mida püsistati.** `accumulated` on PROVIDERI puhver, mitte see, mida kasutaja nägi.
  Nüüd on kõrval `emitted`, mida kasvatab AINULT õnnestunud `controller.enqueue` — katkestuse
  marker kannab täpselt seda. Vahe `accumulated.length - emitted.length` läheb `chat_stream_aborted`
  sündmusesse (`discardedChars`), seega „kui palju jäi näitamata" on nüüd mõõdetav suurus, mitte
  oletus.
- **Teine: kes võidab.** `streamFinalized = true` sisenemisel tegi hilisema `finalizeStreamAbort()`
  surnud koodiks. Abort- ja edurada jagavad nüüd üht keha (`finalizeAsAborted`) ja edurajal on
  **kaks värava kontrolli**: kohe pärast viimast flush'i ja vahetult enne püsivat kirjutust
  (omistamine ja RAG-jälg on `await`-id, mille ajal Stop saabub). Kumbki suunab katkestusse.
- **Piir on nimeliselt VÄLJA ÖELDUD ja ta EI OLE `done` emiteerimine, vaid püsiv kirjutus.**
  Kriteeriumi sõnastus lubab abordil võita kuni `done` kinnitamiseni; pärast tehingu commit'i oleks
  see tagasivõtt, mitte võistluse lahendamine — vastus on siis juba kasutaja oma, salvestatud ja
  taasavamisel nähtav, ja tema eest on tasutud. `done`-i mittejõudmine kliendini on **kohaletoimetamise**,
  mitte olekuprobleem; selle lahendab SOL-CHAT-06 (`/api/chat/run` kinnitus EOF-i järel).
- **Testid (`tests/chat/stopRaceAfterProviderDone.test.js`, 4 uut), kõik neli ajastust:** Stop
  täpselt `done` hetkel · Stop pärast abort'i saabuvat teksti (püsiv tekst = emiteeritud tekst) ·
  Stop finaliseerimise `await`-ide ajal · Stop PÄRAST `done`-i (ei tohi lõpetatud pööret tagasi
  võtta — vastassuund). Kaks neist kannavad **enesekontrolli**: esimene nõuab
  `discardedChars > 0` (võistlusaken oli selles jooksus päriselt olemas) ja kolmas nõuab
  `rag_trace` sündmuse olemasolu (muidu ei oleks `await`-i, mille ajal Stop saaks saabuda, ja test
  oleks vaikselt roheline).
- **Kõrvalparandus, mis oli testitavuse eeldus:** `persistDone` on nüüd `deps` kaudu süstitav
  (`completeTurnPersistence`), nagu `persistInit` juba oli. Ilma selleta ei saa terminalmarkeri
  sisu üldse mõõta — piir, mida ei saa testida, ei ole piir.
- Kontroll: `npm test` **3648/3648**, `npx eslint` puhas. **runtime: not_run** — päris brauseri
  Stop-nuppu ei ole läbi käidud; tõend on voo tasemel.

### SOL-CHAT-06 — enneaegselt lõppenud SSE märgitakse kliendis edukalt lõpetatuks — P2

**Tõend.** Klient seab `streamCompleted = true` ainult `event: done` korral (`components/chat/hooks/useChatStream.js:868-937`). Kui response body lõpeb aga võrgu-, proxy- või serverikatkestuse tõttu normaalse reader-EOF-iga ilma `done` sündmuseta, ei kontrolli kood pärast tsüklit `streamCompleted` väärtust: ta flush'ib nähtava osalise teksti ja märgib sõnumi alati `completionStatus: "COMPLETED"` (`:938-963`). Persisted-run kontrolli kasutatakse samas hook'is ainult pika uuringu rajal, mitte tavavestluse SSE lõpu kinnitamiseks (`:147-168`, `:396-408`, `:571-587`).

**Mõju.** Osaline või tühi vastus kuvatakse lõpliku edukana, Retry-nuppu ei pakuta ning kasutaja võib otsustada puuduliku sotsiaal- või õigusinfo põhjal. Serveri tegelik `ERROR/RUNNING/ABORTED` olek võib UI-st lahkneda.

**Vastuvõtukriteerium.** Tavavestluse stream on edukas ainult pärast valideeritud `done` sündmust. EOF ilma `done`-ita peab andma nähtava vea või küsima `/api/chat/run` kaudu sama pöörde terminalseisu; ainult kinnitatud `COMPLETED` võib muuta UI edukaks. Brauseri-/hook-test peab katma meta+delta+EOF, tühi EOF, malformed done ja võrgukatkestuse.

**Seis (11.08.2026): DONE — kriteeriumi MÕLEMAD teed, mitte üks neist.**
- **Klient küsib serverilt, mitte ei eelda.** EOF ilma `done`-ita läheb nüüd
  `readPersistedConversationResult()` kaudu `/api/chat/run` peale (funktsioon oli olemas, aga teda
  kasutati ainult pika uuringu rajal — sama „lahendus oli koodibaasis olemas" muster). Kinnitatud
  tulemus lõpetab pöörde ausalt COMPLETED-ina ja **kirjutab ka teksti/allikad serveri omaga üle**;
  kinnituseta EOF annab nähtava vea `chat.error.stream_incomplete` ja Retry-nupu.
- **Marsruudi tõde tuli kaasa parandada, muidu oleks kinnitus olnud sama heuristika.**
  `/api/chat/run` luges seisu „viimane sõnum oli kasutajalt" reeglist; nüüd loeb ta **`ChatTurn`
  rida** (`resolveRunStatusFromTurn`) ja langeb tuletusele ainult siis, kui rida puudub (enne
  11.08 migratsiooni loodud vestlused). See on **SOL-CHAT-04 kriteeriumi viimane lause**, mis oli
  seal teadlikult siia edasi lükatud.
- **Rippuma jäänud RUNNING pööre ei ole „veel töös"** — lease'ist vanem annab `ERROR`, seega
  klient saab ta korrata. Ilma selleta oleks uus tõeallikas teinud igavese RUNNING-u võimalikuks.
- **Testid** (`tests/chat/streamCompletionTruth.test.js`, 3 uut): pöörde rida vs tuletus kõigis
  seisudes + aegumine; marsruudi eelistusjärjekord ja **omanikupiir** (`userId: auth.userId`);
  kliendi leping, sh **positsioonikontroll** — voo `COMPLETED` märgend peab olema EOF-värava
  TAGA. Viimane on kirjutatud viimase esinemise peale ja põhjus on kommentaaris: teine `COMPLETED`
  kuulub JSON-vastuse rajale, kus server vastas 200-ga ja voogu ei olnudki.
- **Aus piir.** Ruumirežiimis (`isRoomMode`) kinnitust ei küsita, sest `/api/chat/run` on vestluse-,
  mitte ruumipõhine — seal jääb EOF endiselt veaks, mitte vaikseks eduks. Kriteeriumi neli
  brauseristsenaariumi (meta+delta+EOF, tühi EOF, malformed done, võrgukatkestus) on kaetud
  lepingutasemel, mitte päris brauseris: `runtime: not_run`.

### SOL-CHAT-07 — platvormiadmin saab liikmesuseta suvalisse privaatsesse ruumi AI-sõnumi kirjutada — P1

**Tõend.** Chat bootstrap kontrollib aktiivset `RoomMember` rida ainult siis, kui kasutaja ei ole administraator (`lib/chat/requestBootstrap.js:222-227`). Admin läbib tellimusevärava automaatselt (`lib/authz.js:64-83`) ning saab kliendi antud `roomId` väärtusega käivitada mudeli. Finalizer kutsub `saveAssistantRoomMessage()`, mis teeb `roomMessage.create()` ainult `roomId`, admini `authorId` ja sisuga; liikmesust ega ruumi olekut uuesti ei kontrollita (`lib/chat/responseFinalizer.js:242-247`, `lib/chat/mainRouteRuntime.js:64-101`). Tavaline ruumisõnumite route nõuab seevastu kõigilt, ka adminilt, aktiivset liikmesust enne lugemist või kirjutamist (`app/api/rooms/[roomId]/messages/route.js:95-163`, `:189-199`).

**Mõju.** Teise kasutaja privaatse ruumi ID teadmisel või lekkimisel saab platvormiadmin sinna liikmeks astumata ja osalejate nõusolekuta „Assistant” tüüpi sõnumi sisestada. See rikub ruumi osalejapiiri ja sõnumi päritolu usaldusväärsust; sündmus edastatakse kohe ka ruumi stream'i.

**Vastuvõtukriteerium.** AI ruumirežiim peab kasutama sama aktiivse liikmesuse ja billing-access'i kontrolli nagu ruumisõnumite API; administraatori erakorraline ligipääs, kui seda üldse vajatakse, peab olema eraldi põhjendatud break-glass toiming auditi ja kasutajale nähtava jäljega. Negatiivne HTTP-test peab tõendama, et liikmesuseta admin ei saa ruumi lugeda, AI-d käivitada ega sinna sündmust kirjutada.

**Seis (11.08.2026): DONE — erand kustutatud ja kirjutuskohale antud oma värav.**
- **Leid oli KAHE REEGLI VAHE**, mitte puuduv kontroll: ruumisõnumite API nõuab liikmesust kõigilt,
  chat bootstrap tegi adminile erandi (`!roleState.isAdmin`), ja sõnumi kirjutaja ise ei
  kontrollinud midagi. Erand on kustutatud — sama küsimus, sama vastus.
- **Teine värav on seal, kus KIRJUTUS on.** `saveAssistantRoomMessage()` kontrollib nüüd ise
  aktiivset liikmesust (`leftAt: null`) ja **VISKAB** `ROOM_MEMBERSHIP_REQUIRED`, kui teda ei ole.
  Põhjus on kutsujate arv: finalizer jookseb nii voo- kui tavarajal ja ainus koht, kust mööda ei
  saa, on kirjutus ise. Viskamine, mitte vaikne `null`: ruumipöördel on `persist === false`, seega
  ruumisõnum on **ainus** püsiv tulemus ja tema puudumine on pöörde ebaõnnestumine.
- **Break-glass'i EI ehitatud.** Kriteerium lubab erakorralise ligipääsu „kui seda üldse
  vajatakse"; praegu ei ole ühtegi toodet, mis seda nõuaks, ja poolik break-glass oleks lihtsalt
  sama auk teise nime all. Kui vaja tuleb, on ta eraldi toiming oma jäljega.
- **Testid** (`tests/chat/roomAssistantMembership.test.js`, 5 uut): mõlemad väravad eraldi (üks
  neist üksi ei ole tõend) + **käitumine süstitud kliendiga** — liikmesuseta kirjutus viskab ja
  `roomMessage.create` ei jookse **mitte kordagi**; liikmega kirjutus läheb läbi ja kannab
  `ASSISTANT` päritolu. Lisaks leping, et adminierandi muster ei tohi lähtekoodi tagasi tulla.
- **Katmata:** `hasRoomBillingAccess` kontrolli chat-rajale ei lisatud — ruumisõnumite API teeb
  seda oma marsruudil ja siin oleks ta kolmas koopia samast reeglist; leiu tegelik kahju
  (liikmesuseta kirjutus) on kaetud. Negatiivne **HTTP**-test päris admini sessiooniga on tegemata:
  `runtime: not_run`.

### SOL-CHAT-08 — failianalüüsi valmis tulemus võib commit'i vea järel kaduda ja retry kulutab uue ühiku — P1

**Tõend.** `/api/chat/analyze-file` saab esmalt RAG-teenuselt täieliku analüüsi, seab `analysisCompleted = true` ning proovib alles seejärel `FILE_ANALYZE` kasutust commit'ida (`app/api/chat/analyze-file/route.js:246-257`). Commit'i vea korral läheb kood catch'i, kuid ei vabasta reservatsiooni, sest completed-lipp on juba tõene, ja tagastab analüüsi asemel vea (`:258-269`). Tulemust ei püsistata taastamiseks. Klient ei saada vormis route'i toetatud `idempotencyKey` välja (`components/chat/hooks/useChatAnalysisController.js:321-329`), mistõttu retry saab adapterilt uue UUID ja käivitab uue analüüsi (`lib/usage/routeAdapter.js:41-55`).

**Mõju.** Fail on välistekstiteenuses juba edukalt töödeldud, kuid kasutaja ei saa tulemust; reservatsioon võib jääda kinni ja korduskatse kulutab uue nädalaühiku. Ebamäärase commit-vea korral võib esimene ühik olla ka juba arvestatud.

**Vastuvõtukriteerium.** Ühe faili analüüsikavatsusel peab olema enne upload'i loodud stabiilne võti ning taastatav serveripoolne tulemus või vähemalt tulemuse hash/olek. Commit'i retry peab sama tulemust taaskasutama, mitte faili uuesti parsima. Veasüstetestid peavad katma commit'i enne ja pärast DB tehingut ning tõendama üht analüüsi, üht kasutusühikut ja kasutajale taastatud tulemust.

**Seis (11.08.2026): DONE koodis, ÜKS KRITEERIUMI OSA TEADLIKULT TÄITMATA (vt allpool).**
- **Järjekord ja kaks piiri on nüüd `lib/usage/paidResult.js` reegli järgi.** Tasulise töö viga
  vabastab; **commit'i enda viga ei vabasta ega tühista tulemust** — logi ja vastus lähevad välja,
  reservatsioon jääb RESERVED-iks. Vana kood tegi täpselt vastupidist: `analysisCompleted` lipp
  keelas vabastuse JA `catch` viskas valmis analüüsi ära, nii et kasutaja kaotas mõlemad.
- **Lipp on kadunud, mitte parandatud.** Ta oli leiu mehhanism; test nõuab, et ta lähtekoodi
  tagasi ei tuleks.
- **Klient loob kavatsuse võtme enne üleslaadimist** (`resolveIntentKey`, sama primitiiv mis
  SOL-CHAT-03 ja SOL-DOC-01) ja allkiri sõltub failist endast (nimi + suurus + muutmisaeg), mitte
  ainult nimest. Marsruut toetas `idempotencyKey` välja juba varem — klient lihtsalt ei saatnud
  teda. Kordus taaskasutab nüüd sama reservatsiooni; **teist nädalaühikut ei võeta**.
- **Täitmata jäi „commit'i retry peab sama tulemust taaskasutama, mitte faili uuesti parsima".**
  Selleks peaks server analüüsi tulemuse alles hoidma, aga analüüs on lepingu järgi **efemeerne**
  (`privacy.ephemeral`, `api.chat.analyze.privacy_ephemeral`) — sisu on kasutaja dokument ja teda
  ei säilitata. Valitud on privaatsus: kordus parsib faili uuesti, aga **ei maksa teist korda**.
  See on tooteotsus, mitte tähelepanematus; kui omanik eelistab vastupidist, on muudatus üks
  tabelirida ja üks säilitustähtaeg. **Omanik kinnitas 11.08: jääb efemeerseks.** Taastatav
  tulemus oleks tähendanud kasutaja dokumendi täisteksti talletamist ja seega ka liidese
  `privacy.ephemeral` lubaduse ümberkirjutamist — kaetav tõrge on haruldane, ei maksa enam teist
  korda ja kordus on üks klikk. Kriteeriumi see lause jääb teadlikult täitmata.
- **Testid** (`tests/chat/analyzeFileDurability.test.js`, 2 uut) mõõdavad järjekorda ja mõlemat
  piiri lähtekoodi tasemel: commit'i plokis EI TOHI olla `releaseUsageForRequest` ega `errorJson`.
  Kriteeriumi „veasüst enne ja pärast DB tehingut" ei ole siin kohaldatav — see marsruut ei tee
  ühtegi DB-kirjutust peale kasutusarvestuse. `runtime: not_run`.

### SOL-CHAT-09 — efemeerne failianalüüs usaldab deklareeritud MIME-i ja tagastab piiramatu täisteksti — P1

**Tõend.** Next-route lubab kuni 25 MB faili ja valib MIME-i kliendi `mimeType`, brauseri `file.type` või laiendi järgi, sisu signatuuri kontrollimata (`lib/chat/analyzeFileConfig.js:33-64`, `app/api/chat/analyze-file/route.js:182-244`). RAG-teenuse `_detect_mime()` tagastab deklareeritud tüübi kohe ja kasutab libmagic'ut ainult siis, kui deklaratsioon puudub (`rag-service/main.py:804-812`). DOCX läheb `docx2txt.process()` kaudu lahtipakkimisele ilma tihendatud suhte, lahtipakitud mahu või ajapiirita; PDF parseril pole lehe-/tekstilage (`:987-1010`). `/analyze` piirab küll chunk'ide arvu, kuid tagastab `fullText: raw_text` täiesti kärpimata (`:3329-3382`). Node loeb kogu vastuse esmalt stringiks ja parsib siis JSON-iks (`app/api/chat/analyze-file/route.js:117-142`); klient hoiab `fullText` väärtust Reacti olekus ja renderduse eelvaate alusena (`components/chat/hooks/useChatAnalysisController.js:75-80`, `:344-358`).

**Mõju.** Tellimusega kasutaja saab väikese ZIP-pommi või väga suureks ekstraktitava PDF/DOCX-i abil siduda RAG-protsessi CPU/mälu; Node'i ja brauseri jaoks võib üks vastus paisuda kümnetesse või sadadesse megabaitidesse. 30-sekundiline Node fetch-abort ei peata tingimata FastAPI protsessis juba jooksvat sünkroonset parserit.

**Vastuvõtukriteerium.** MIME tuleb kinnitada sisu järgi ja vastuolu sulgeda. Parserid vajavad protsessi-/tööjärjekorra tasemel timeout'i, PDF lehepiiri, ZIP kirjete ning lahtipakitud kogumahu/suhte lage ja absoluutset ekstraktitud tähemärkide piiri. `/analyze` ei tohi tagastada piiramatut `fullText` välja; UI-le piisab versioonitud piiratud preview/chunk-lepingust. Negatiivsed testid peavad katma võlts-MIME-i, ZIP-pommi, ülisuure lehearvu, 25 MB teksti ja parseri timeout'i.

**Seis (11.08.2026): DONE, ÜKS KRITEERIUMI OSA NIMELISELT TEGEMATA (parseri timeout).**
- **Tuum: deklaratsioon ei vali enam parserit.** `_detect_mime()` tagastas `declared` väärtuse kohe
  ja libmagic'ut kutsuti ainult siis, kui deklaratsioon puudus — kasutaja sai ise otsustada,
  milline parser tema baite näeb. Uus `rag-service/upload_limits.py` `mime_conflict()` on
  **fail-closed**: tundmatu sisu EI kinnita ühtegi deklaratsiooni, ja „ütlen text/plain, saadan
  ZIP-pommi" annab **415**.
- **Kaks väravat kahes protsessis, teadlikult.** Node-poolel on peegel
  `analyzeMimeConflict()` (`lib/chat/analyzeFileConfig.js`), mis kontrollib sisu **enne** 25 MB
  faili edasisaatmist; teenus kaitseb ennast ka teiste kutsujate eest. See ei ole dublikaat, vaid
  kaks eri küsimust: „kas tasub saata" ja „kas tohib parsida".
- **Võimenduse piirid on nüüd olemas:** ZIP kataloogi kontroll **enne lahtipakkimist** (kirjete
  arv, lahtipakitud kogumaht, tihendussuhe — kõik `zipfile`'i kataloogist, midagi ei pakita lahti),
  PDF lehepiir, absoluutne ekstraktitud tähemärkide lagi. Kõik env-ist muudetavad.
- **`/analyze` leping on versioonitud ja piiratud:** `analyzeContract: "v2"`, `fullText` on lae all
  (`ANALYZE_RESPONSE_MAX_CHARS`, vaikimisi 400k) ja kärbe on kliendile **nähtav**
  (`truncated`, `truncatedReasons`, `extractedChars`). Mõju kasutajale on ainult **kuvamisel** —
  mudelisse läheb `chunks`, mitte `fullText` (kontrollitud: `fullText` ainus tarbija on
  eelvaatepaneel).
- **Node ei usalda ka vastajat:** vastus loeti varem tingimusteta üheks stringiks; nüüd on
  `readBoundedText()` lae all ja ületamine on **viga**, mitte vaikne kärbe (poolik JSON ei ole
  tulemus).
- **Testid: `rag-service/test_upload_limits.py` 12/12** (jookseb `unittest`-iga, ilma pytest-i
  sõltuvuseta — auditikeskkonnas puudus see moodul) + `tests/chat/analyzeFileLimits.test.js` 7 uut.
  Kaetud: võlts-MIME mõlemas suunas, päris ZIP-pomm (50 MB nulle → tagasi lükatud **suhte järgi,
  enne lahtipakkimist**), lehearvu ja tähemärgikärbe, loetamatu ZIP. **Negatiivkontroll mõlemas
  failis nimeliselt:** lubatud sisendid PEAVAD läbi minema, muidu tõendaks „lükka kõik tagasi"
  sama hästi.
- **TEGEMATA ja see on nimeline: parseri protsessi-/tööjärjekorra timeout.** Sisendipiirid
  tõkestavad võimenduse (väike fail → tohutu töö), mis on tegelik ründevektor, aga „tapa parser N
  sekundi pärast" nõuab eraldi tööprotsessi — FastAPI sünkroonset parserit ei saa jooksvalt
  katkestada. See on omaette töö ja kuulub SOL-RAGSVC peatüki juurde, kus teenuse tööjärjekord
  niikuinii lahti on.
- **Deploy'mata.** Muudatus puudutab `rag-service`'it, seega jõustub alles järgmisel deploy'l.
  `runtime: not_run` — päris ZIP-pommi ei ole päris teenuse vastu saadetud.

### SOL-CHAT-10 — vestluse ekspordi kohustuslik audit võib vaikselt puududa — P2

**Tõend.** Ekspordirada genereerib faili, kutsub `logDocumentsAudit("chat.exported")` ja tagastab seejärel PDF/DOCX-i (`app/api/chat/export/route.js:115-175`). `logDocumentsAudit()` kasutab moodulitaseme globaalset Prismat ning neelab `documentAudit.create()` vea täielikult, andmata kutsujale ebaõnnestumisest märku (`lib/documents/audit.js:23-45`). Olemasolev test kontrollib ainult auditipayload'i kuju ja kutse paiknemist pärast autoriseerimist/generatsiooni, mitte rea loomist või veakäitumist (`tests/chat/exportRouteContract.test.js:7-38`).

**Mõju.** Tundliku vestluse faili allalaadimine võib õnnestuda ilma jäljeta, kes, millal ja millises formaadis selle eksportis. Serveri console-rida pole püsiv ega sama auditilepinguga päringuteks kasutatav tõend.

**Vastuvõtukriteerium.** Omanik peab otsustama, kas eksport on fail-closed või transactional-outbox'iga taastatav; mõlemal juhul ei tohi auditikadu olla vaikne. Test peab süstima audititabeli kirjutusvea pärast edukat faili genereerimist ning tõendama kas ekspordi blokeerimise või püsiva retry-sündmuse.

**Seis (11.08.2026): DONE — fail-closed, sama valik mis SOL-DOC-09-l.**
- `logDocumentsAudit()` on best-effort: neelab `documentAudit.create()` vea ja kaardistamata sündmus
  lõpetab kirjutamata. Tundliku vestluse faili sai seega alla laadida ilma püsiva jäljeta.
- Mehhanism oli **koodibaasis olemas**: `writeDocumentAudit()` (SOL-DOC-09) viskab nii kaardistamata
  sündmuse kui kirjutuse vea peale. Eksport kasutab nüüd teda ja **jälg käib enne faili**.
- **Kriteerium jättis valiku omanikule** (fail-closed vs transactional outbox). Valisin fail-closed:
  outbox tähendaks, et fail läheb välja ja jälg tuleb hiljem — see on ekspordi puhul nõrgem lubadus.
  **Vastupidine valik on üherealine** (`writeDocumentAudit` → `logDocumentsAudit`).
  **Omanik kinnitas 11.08: jääb fail-closed.** Outbox tasub end ära siis, kui põhitoimingut ei saa
  korrata või ta ei tohi blokeeruda — eksport ei ole kumbki. Aus hind: audititabeli kättesaadavus
  on nüüd ekspordi kättesaadavus.
- Testid: 2 uut (`tests/chat/exportRouteContract.test.js`) — mõlemal formaadil oma värav ja
  positsioonikontroll (värav ENNE faili), + käitumine süstitud kliendiga: kaardistamata sündmus ja
  DB-viga viskavad, **negatiivkontroll**: korras kirjutus peab läbi minema.
- `runtime: not_run`.

### SOL-CHAT-11 — üldine vestluse ID kandub konto ja rolli vahetusel valesse kasutajakonteksti — P1

**Tõend.** Vestluse kohalik sisu kasutab küll kasutaja, rolli ja keele järgi eraldatud `storageKey` väärtust, kuid aktiivse vestluse valikul eelistatakse alati üldist `sotsiaalai:chat:convId` võtit kasutajapõhisele võtmele (`components/chat/hooks/useChatConversationState.js:154-163`, `:184-197`). Sama üldvõtit kirjutavad nii hook, vestluse sisu kui külgriba (`:198-205`, `components/alalehed/ChatBody.jsx:2092-2116`, `components/ChatSidebar.jsx:375-391`). Konto vahetuse järel keelab `/api/chat/run` õigesti teise omaniku ajaloo lugemise 403-ga (`app/api/chat/run/route.js:143-162`), kuid uue sõnumi persistence ei anna omaniku mittevastavusest viga: `persistInit()` lihtsalt tagastab ning neelab üldiselt ka kõik DB vead (`lib/chat/persistence.js:38-116`). Provideritöö ja usage settlement võivad seetõttu jätkuda, samas `persistDone()` ei kirjuta võõrasse vestlusse midagi (`:147-240`). Sama kasutaja rollivahetusel uuendab `persistInit()` vana vestluse rolli uueks ning eri rollide sisu võib ühe vestluse alla seguneda (`:73-87`). Vestlustestides puudub konto- või rollivahetuse `sessionStorage` stsenaarium.

**Mõju.** Samas brauserivahekaardis teise kontoga jätkates võib kasutaja saada tasulise vastuse, mis pärast taasavamist kaob, sest see saadeti eelmise konto vestluse ID-ga, kuid sinna salvestada ei tohtinud. Rollivahetus võib muuta vana vestluse liigitust ja segada kliendi- ning spetsialistivaate konteksti. Otsest teise konto sõnumite lugemist see rada ei võimalda, kuid põhjustab kasutus- ja andmetervikluse vea.

**Vastuvõtukriteerium.** Aktiivse vestluse võti peab olema kasutaja ja rolli suhtes skoopitud; autentimiskonteksti muutus peab üldvõtme valideerima serveris või looma uue vestluse. Persistence'i omaniku/arhiivi konflikt peab muutma pöörde enne providerikutset selgeks 409/403 veaks, mitte vaikseks eduks. Brauseritest peab samas tab'is tegema kasutaja A vestlus → logout/login kasutajana B → uus sõnum ning eraldi rollivahetuse, kontrollides vestluse ID-d, ajalugu, kasutust ja DB-ridu.

**Seis (11.08.2026): DONE — klient JA server, sest leid oli mõlemal pool.**
- **Klient:** üldine `sotsiaalai:chat:convId` on SURNUD. Aktiivne vestlus elab nüüd konto ja rolli
  all (`lib/chat/activeConversationKey.js`), mis kasutab **olemasolevat** primitiivi
  `lib/device/ownerScopedStorage.js` (SOL-SLOG-01 ja SOL-JOUR-02 sama klass). Omanikku ei ole →
  `null` → identiteedita hetk ei loe ega kirjuta midagi.
- **Vana sildistamata rida kustutatakse**, mitte ei anta esimesele avajale — sama otsus mis
  SLOG-01-l ja samal põhjusel: teda ei saa tagantjärele omistada.
- **Kolm kirjutuskohta said ühe tee.** Hook, `ChatBody` ja `ChatSidebar` kirjutasid kõik oma käega;
  nüüd on üks moodul. Kustutus puudutab ainult vastet ja ainult oma konto rida.
- **Server:** võõra omaniku või arhiveeritud vestlus oli VAIKNE EDU (`persistInit` lihtsalt väljus).
  Nüüd annab pöörde nõue **409 `chat.error.conversation_unavailable` ENNE providerikutset** ja
  reservatsioon vabastatakse.
- Testid: 8 uut (`tests/chat/activeConversationScope.test.js`) — kaks kontot, rollivahetus,
  identiteedita hetk, pärandrea kustutus, kustutuse ulatus, võtme kuju, kolme faili leping ja
  serveri 409 positsioon.
- **Aus piir:** keelt skoopi teadlikult EI võetud — keelevahetus ei tee vestlust teise inimese
  omaks. `runtime: not_run` — kahe konto brauserirada on käimata.

### SOL-CHAT-12 — kattuvad ajaloo laadimised võivad uuema vestluse oleku vanema vastusega tagasi pöörata — P2

**Tõend.** `hydrateFromServer()` teeb `/api/chat/run` päringu ilma `AbortController`-i või päringupõlvkonna tunnuseta ning kirjutab vastuse saabudes kogu sõnumiloendi Reacti olekusse (`components/chat/hooks/useChatConversationState.js:374-481`). Mount, fookus, nähtavuse muutus ja `sotsiaalai:refresh-conversations` võivad käivitada sama vestluse laadimise kahe eraldi throttle'i kaudu; need ei välista omavahelist kattumist ning cleanup ei tühista throttle'i ootel timerit ega fetch'i (`:517-538`, throttle `:122-139`). Vestluse ID kontroll kaitseb teise vestlusse kirjutamise eest, kuid mitte sama ID vanemate ja uuemate snapshot'ide järjekorra eest (`:388-389`, `:506-514`). Kohaliku uuema loendi säilitamine kehtib puhta tekstivestluse puhul ainult genereerimise, streami või viimase kaheksa sekundi jooksul; hiljem võib väiksem vana serveriloend uuema üle kirjutada (`:260-281`).

**Mõju.** Aeglane varasem GET võib pärast kiiremat uuemat GET-i lõpetada ja eemaldada kasutajaliidesest viimase pöörde või taastada vanema terminalseisu. Sõnumid võivad DB-s alles olla, kuid UI näitab neid alles järgmise õnnestunud värskenduse järel; kasutaja võib puuduva pöörde uuesti saata ja tekitada topeltkulu.

**Vastuvõtukriteerium.** Igal vestlusel peab olema üks aktiivne hydration-päring või monotonse põlvkonna/revisjoni kontroll; vanem vastus ei tohi uuemat state'i kirjutada. Cleanup peab tühistama nii timeri kui fetch'i. Deterministlik hook-test peab lahendama kaks sama `convId` päringut vastupidises järjekorras üle kaheksa sekundi piiri ning tõendama, et uuem snapshot jääb alles.

**Seis (11.08.2026): DONE.**
- **Põlvkond, mitte lukk.** Uus `lib/chat/requestGeneration.js`: kirjutada tohib ainult viimasena
  **ALANUD** päring (mitte viimasena lõppenud — just see vahe oli leid). Moodul on hookist väljas,
  sest testijooksja ei renderda React-hooke — sama põhjus mis `lib/calls/clientState.js`-il
  (SOL-CALL-11…-13).
- Hüdreerimine sai ka `AbortController`-i ja **mõlemad** kirjutuskohad (sisu + lõppmärgend) on
  värava taga. Puhastus tühistab nüüd nii ootel throttle-taimeri (`throttled.cancel()`, mida enne
  ei olnud) kui käimasoleva päringu.
- Test mõõdab **vastupidist lahendumisjärjekorda**: vanem päring algab esimesena ja lõpeb viimasena
  → kirjutab ainult uuem. Negatiivkontroll kõrval: järjestikused päringud kirjutavad kõik, seega
  põlvkond ei ole lukk.
- `runtime: not_run`.

### SOL-CHAT-13 — ruumide külgriba laadimisviga näib tühja loendina ja asendatud päring võib uue laadimisoleku lõpetada — P2

**Tõend.** Tavalise vestlusloendi `fetchList()` kasutab `shouldSettleRequest()` kaitset, et katkestatud vana päring ei kirjutaks state'i ega lõpetaks uue päringu loading-olekut (`components/ChatSidebar.jsx:128-189`). Kõrvalolev `fetchRooms()` seda lepingut ei kasuta: edu kirjutab alati `setRoomItems(normalized)`, catch logib vea ainult console'i ja `finally` teeb tingimusteta `setRoomsBusy(false)` ka siis, kui `roomsAbortRef` viitab juba uuele päringule (`:191-225`). Ruumivaate tühja/vea olek kasutab ühist `error` state'i, mida `fetchRooms()` ei sea (`:660-674`). Olemasolevad külgribatestid tõendavad superseded-request kaitset ainult vestlusloendi helperile, mitte ruumide rajale (`tests/chat/sidebarListState.test.js:12-25`, `tests/chat/conversationSearchUi.test.js:37-48`).

**Mõju.** Esmane `/api/rooms` võrgu- või serveriviga kuvatakse kasutajale kindla tühja grupiloendina, ilma vea või retry võimaluseta. Fookuse ja drawer'i sündmustest kattuvate laadimiste korral võib vana päring eemaldada uue loading-indikaatori ning piiripealsel abort-rassil kirjutada uuema ruumiloendi üle vana vastusega.

**Vastuvõtukriteerium.** Ruumide laadimine peab kasutama sama aktiivse päringu omandi-, abort- ja error-lepingut nagu `fetchList`; ainult praegune controller võib kirjutada tulemuse või lõpetada busy oleku. UI peab eristama päris tühja loendit tõrkest. Testid peavad katma A → B asendamise kõigi lahendumisjärjekordadega ning algse 401/403/500/võrguvea.

**Seis (11.08.2026): DONE — sama leping mõlemal rajal, mitte uus mehhanism.**
- `fetchRooms()` sai `shouldSettleRequest` valve, mida `fetchList` juba kasutas: **tulemuse
  kirjutamine, veaseis ja busy-lõpetamine on kõik kolm värava taga**. Tingimusteta
  `setRoomsBusy(false)` oli see, mis võõra laadimisindikaatori kustutas.
- **Tõrge ei ole enam tühi loend:** ruumidel on oma `roomsError` seis (ühine `error` kuulus
  vestlusloendile), vaade valib õige ja **retry-nupp on nüüd mõlemal vaatel** — ruumide tõrge oli
  enne täiesti nähtamatu, ainult `console.warn`.
- Testid: 2 uut (`tests/chat/hydrationOrdering.test.js`) + olemasolev otsingu-UI leping
  parandatud kirjeldava kommentaariga (retry tingimus muutus, nõue mitte).
- `runtime: not_run` — 401/403/500 rada päris brauseris käimata.

### SOL-VOICE-01 — STT arvestus ei kasuta provider'i tegelikku kestust ja kliendil puudub idempotentsus — P1

**Tõend.** STT route proovib kestuse failist enne providerikutset lugeda ja reserveerib ebaõnnestunud tuvastuse korral alati 60 sekundit (`app/api/stt/route.js:144-175`). OpenAI vastusest saadav tegelik `usage.seconds` loetakse alles pärast seda, kui reservatsioon on juba vaikimisi summaga commit'itud; `actualAmount` parandust ei tehta (`:226-280`). Välise STT vastuse võimalikku tegelikku kestust samuti commit'iks ei kasutata (`:180-212`). Brauseri hook ei saada vormis `idempotencyKey` välja (`components/chat/hooks/useSpeech.js:287-323`). Lisaks seatakse `transcriptionCompleted = true` enne commit'i, nii et commit'i vea korral ei vabastata reservatsiooni ja valmis transkript visatakse ära (`app/api/stt/route.js:194-222`, `:239-298`).

**Mõju.** Otse-API kaudu saab alla 12 MB pika tihendatud audio eest maksta ainult 60 sekundi ühikuid, kui lokaalne kestuselugeja formaati ei tunne. Võrguretry või commit-tõrge võib teha mitu providerikutset, jätta reservatsiooni kinni või kulutada mitu ühikut ühe salvestuse eest, samal ajal kui valmis tekst kasutajani ei jõua.

**Vastuvõtukriteerium.** Klient peab siduma ühe salvestuse stabiilse võtmega. Reservatsioon peab kasutama ohutut ülempiiri ning commit provider'i kinnitatud tegelikku kestust (`actualAmount`), selge fallback-lepinguga, mis ei alahinda. Valmis transkript vajab sama võtmega taastamist. Testid peavad katma tundmatu lokaalse formaadi + provider'i pika kestuse, commit'i ebamäärase vea ja identse retry.

**Seis (11.08.2026): DONE, ühe kvalifikatsiooniga (vt viimane punkt). Migratsiooni ei ole vaja.**
- **Lahendus oli koodibaasis olemas ja kasutamata.** `lib/usage/sttDuration.js` kirjutati
  SOL-DOC-02 jaoks ja ta hoiab lahus täpselt need kaks küsimust, mille segamine SIIN leiu
  tekitas: „kui palju reserveerida ENNE kutset" (vastust ei ole, seega OHUTU ÜLEMPIIR) ja
  „kui palju arvestada PÄRAST" (vastus on olemas, seega provideri mõõdetud kestus). `/api/stt`
  oli ainus rada, mis seda moodulit ei kasutanud, kuigi ta lahendas sama probleemi.
- **Vana `|| 60` ei olnud konservatiivne oletus, vaid möödapääs.** Tundmatu formaadi korral
  maksis kuni 12 MB tihendatud kõne täpselt minuti ühikuid. Ülempiir tuleb nüüd baitidest
  kõne madalaima usutava bitikiiruse järgi; **sondis mõõdetud: 12 MB tundmatu fail EI mahu
  enam 900-sekundilise kuulimiidi sisse** — vana rada laskis ta läbi 60 sekundi hinnaga.
- **Commit kannab `actualAmount`-i**, klammerdatuna reservatsiooniga: vale hinnang ei tohi
  muutuda 500-ks kasutajale, kelle transkript on juba olemas.
- **`transcriptionCompleted` lipp on KADUNUD, mitte ümber tõstetud.** Ta pandi tõeseks enne
  commit'i, seega commit'i viga tegi korraga kaks asja: jättis reservatsiooni rippuma JA
  vastas 502-ga, nii et kasutaja kaotas valmis teksti. Nüüd kehtib `lib/usage/paidResult.js`
  teine piir: commit'i viga ei vabasta midagi ega võta tulemust ära — ta läheb logisse ja
  transkript jõuab kasutajani.
- **Klient saadab `idempotencyKey`-d**, mis sünnib ühe korra salvestuse kohta ja elab kuni
  tekst on käes, seega võrgukordus ei tekita teist reservatsiooni.
- **`npm run voice:settle:probe` 15/15 päris PostgreSQL-is.** Tõend on `UsageReservation` rida
  ja ämbri seis, mitte funktsiooni tagastusväärtus. Negatiivkontroll jooksutab vana arvestust
  sama ämbri peal: commit ilma `actualAmount`-ita võtab KOGU reservatsiooni.
- **Kvalifikatsioon — „valmis transkript vajab sama võtmega taastamist" on täidetud ainult
  ARVELDUSE mõttes.** Sama võti ei tekita teist ühikut, aga teksti ennast ei hoita kuskil:
  `/api/stt` ei püsista transkripti (erinevalt dokumendirajast, kus ta ON dokument), seega
  kordus kutsub providerit uuesti. Salvestuskoha tegemine tähendaks kõne teksti hoidmist
  ilma omaniku- ja säilitusreata — see on tooteotsus, mitte selle leiu parandus.

### SOL-VOICE-02 — STT ning Google/OpenAI TTS providerikutsetel puudub rakenduse timeout — P1

**Tõend.** Välise STT fetch ei kasuta `AbortController`-it ega timeout'i (`app/api/stt/route.js:180-212`); ka OpenAI STT SDK-kutsel pole route'i signaali ega rakenduse ajapiiri (`:226-238`). TTS-is on timeout ainult katselisel TartuNLP fetch'il (`app/api/tts/route.js:138-177`); Google ja OpenAI sünteesikutsed on piirita (`:103-136`, `:180-203`). Kliendi `/api/stt` ja `/api/tts` fetch'idel pole samuti abort-signaali ega timeout'i (`components/chat/hooks/useSpeech.js:207-261`, `:287-339`). Reservatsioonid luuakse enne providerikutset ja vabastus toimub ainult catch'is, kuhu lõputult ootel promise ei jõua.

**Mõju.** Aeglane või poolavatud provider võib hoida Next worker'i, kasutaja UI ja kasutusreservatsiooni määramata aja kinni. Korduvad katsed eri instantsides kasvatavad samaaegsete ühenduste hulka; mälupõhine rate-limit ei ole klastriülene kaitse.

**Vastuvõtukriteerium.** Igal provideril peab olema konfigureeritud serveripoolne timeout, request aborti edasi kandev signaal ja kontrollitud veavastus; klient vajab eraldi UX-timeout'i/aborti. Timeout peab vabastama sama idempotentsusvõtme reservatsiooni või jätma püsiva retry-seisundi. Testid peavad kasutama mitte kunagi lahenevat providerit ning tõendama ühenduse katkestuse, piiratud kestuse, UI taastumise ja settlement'i.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Üks signaal kannab kahte sündmust ja mõlemad on ERISTATAVAD** (`lib/net/providerRequest.js`):
  meie ajapiir annab `TimeoutError` → 504, kasutaja katkestus `AbortError` → 499. Eristus ei
  ole kosmeetika: Stop ei ole tõrge, mida logisse veaks kirjutada, ja meie ajapiir ei ole
  midagi, mille eest kasutaja maksab. Põhjus tuleb platvormilt (`AbortSignal.timeout` +
  `AbortSignal.any`), mitte oma `controller.abort()`-ist — ise kokku pandud taimer oleks
  andnud mõlemale sama `AbortError`-i ja jätnud iga õnnestunud kutse järel lahtise
  `setTimeout`-i.
- **Neli kutset said signaali:** väline STT `fetch`, OpenAI STT SDK, Google TTS (gRPC oma
  ajapiiriga) ja OpenAI TTS. Lisaks `withAbort`, sest „Next-i töölõng ei jää kinni" ei tohi
  sõltuda sellest, kas KOLMAS OSAPOOL signaali austab — gRPC-klient ja mõni SDK ei austa.
  Signaal antakse ikka edasi (et ka ülesvool lõpetaks), `withAbort` on lisaks, mitte asemel.
- **Kliendil on oma piirid** (STT 90 s, TTS 30 s) `withRequestTimeout`-i kaudu, feature-checki
  taga: `AbortSignal.any` puudumine vanas brauseris ei tohi ettelugemist üldse katki teha.
- **Arveldus on nüüd üks moodul kahe lõpuga** (`lib/usage/providerSettlement.js`), mitte kaks
  koopiat kahes marsruudis. Iga katkestus vabastab reservatsiooni — kasutajani ei jõudnud
  midagi, seega ei ole mille eest võtta — ja ka vabastuse enda viga ei kao vaikselt.
- **`npm run voice:settle:probe` 15/15 päris PostgreSQL-is, MITTE KUNAGI LAHENEVA
  provideriga.** Kui ajapiiri ei oleks, jääks sond ise rippuma — see on aus tõend selle kohta,
  et piir eksisteerib. Mõõdetud on ka mõlema katkestuse jälg: `RELEASED` +
  `releaseReason: provider_timeout` / `client_aborted` ja ämber tagasi nullis.
- `runtime: not_run` päris aeglase provideri osas: ajapiir on tõendatud sondi ja ühiktestiga,
  päris OpenAI/Google poolavatud ühendust ei jäljendatud.

### SOL-VOICE-03 — „Peata ettelugemine” ei katkesta pooleliolevat serverisünteesi — P2

**Tõend.** Eesti ettelugemine seab `isSpeaking`, alustab `/api/tts` fetch'i ja loob audio alles vastuse saabudes (`components/chat/hooks/useSpeech.js:207-249`). `stopSpeaking()` tühistab brauseri SpeechSynthesis'i ja juba loodud `audioRef` objekti, kuid serverifetch'il pole controller'it ega päringu põlvkonna tokenit (`:161-178`, `:224-233`). Kui kasutaja vajutab sama nuppu providerikutse ajal või komponent unmount'ib, jätkab algne async funktsioon ning võib hiljem luua ja käivitada audio (`:235-249`, `:534-538`). Server commit'ib TTS-kasutuse sünteesi valmimisel sõltumata sellest, et kasutaja oli vahepeal Stop'i valinud (`app/api/tts/route.js:273-353`).

**Mõju.** Kasutaja peatamiskäsk võib näiliselt toimida, kuid heli hakkab hiljem ootamatult mängima, sh pärast lehelt lahkumist; tasuline tähemärgikvoot kulub. See on eriti halb avalikus või klienditöö keskkonnas, kus etteloetud sisu on tundlik.

**Vastuvõtukriteerium.** Serveritee vajab ühe aktiivse sünteesipäringu controller'it ja monotonset request-tokenit; Stop/unmount peab abortima fetch'i ning hiline vastus ei tohi audioobjekti luua ega state'i muuta. Server peab kliendi aborti providerile edasi kandma ja kasutuse ausalt settle'ima vastavalt tehtud töö piirile. Hook-/brauseritest peab peatama enne vastust, pärast vastust enne `play()`-d ja pärast unmount'i.

**Seis (11.08.2026): DONE, brauserikiht NOT_PROVEN. Migratsiooni ei ole vaja.**
- **Controller ja monotonne token olid koodibaasis olemas ja kasutamata:**
  `lib/client/latestRequestGate.js` on täpselt see primitiiv, mida kriteerium kirjeldab.
  Uut ei ehitatud — `useSpeech` võtab ta kasutusele.
- **Otsus „kas ma tohin veel heli teha" tehakse VASTUSE saabudes, mitte kutse alustamisel.**
  Just see aken oli leid: `stopSpeaking()` tühistas brauseri kõnesünteesi ja juba loodud
  `Audio` objekti, aga poolelioleva `fetch`-i kohta ei teadnud midagi, seega hiline vastus
  võis heli mängima panna ka pärast lehelt lahkumist. Nüüd katkestab Stop päringu ja
  `attempt.isCurrent()` valvab lisaks seda hetke, kus vastus juba käes on.
- **Unmount oli juba kaetud** — mahavõtmise effect kutsub `stopSpeaking()`-i, ja see kutsub
  nüüd `invalidate()`-i. Uut elutsükliharu ei tekkinud.
- **Katkestus EI kuku varurajale.** TartuNLP katse `catch` neelas iga vea ja läks edasi
  järgmise pakkuja juurde; kui ta neelaks ka Stop'i, tähendaks „Peata ettelugemine" lihtsalt
  teise pakkuja poole pöördumist. Nüüd visatakse katkestus ja ajapiir edasi, tõrge mitte.
- **Serveripool kannab kliendi abordi providerile edasi** (SOL-VOICE-02 signaal) ja arveldab
  ausalt: heli ei jõudnud kasutajani, seega reservatsioon vabaneb. Sondis mõõdetud päris
  ämbri peal.
- **NOT_PROVEN: brauseritest.** Hooki otsuskiht on tõendatud `createLatestRequestGate`
  käitumisega (Stop enne vastust · uus kutse katkestab eelmise · hiline vastus ei kuulu enam
  ühelegi kutsele) ja marsruudi/hooki leping allkirjade tasemel, aga DOM-iga testisviiti
  selles projektis ei ole — päris `Audio.play()` ajastust ei ole mõõdetud.

### SOL-ROOM-01 — arhiveeritud ruum ei ole serveris tegelikult kirjutuskaitstud — P1

**Tõend.** Ruumiloend märgib arhiveeritud ruumi ja eemaldab sellelt kutse-/üleandmis-/arhiivitoimingud (`app/api/rooms/route.js:185-198`), kuid sõnumite ühine `ensureAccess()` valib ruumist ainult ID ja helpMatch-seose, mitte `archivedAt` välja (`app/api/rooms/[roomId]/messages/route.js:106-148`). Sama puudus on SSE-, read-, members- ja kõnede ligipääsuväravas (`app/api/rooms/[roomId]/messages/stream/route.js:45-87`, `app/api/rooms/[roomId]/read/route.js:75-119`, `app/api/rooms/[roomId]/members/route.js:84-126`, `lib/calls/roomRoutes.js:88-126`). Seetõttu lubavad POST sõnumit, sõnumi DELETE, read-marker ning kõik kõne start/join/recording toimingud aktiivsele liikmele edasi. Ka kutse loomise ja vastuvõtu tuum ei kontrolli `room.archivedAt` väärtust (`app/api/invites/route.js:169-181`, `lib/invites/acceptInviteCore.js:81-121`, `:227-266`). Ainult omanikuvahetuse route sulgub arhiveeritud ruumis eraldi 409-ga (`app/api/rooms/[roomId]/transfer/route.js:62-71`).

**Mõju.** Omanikule ja UI-le kuvatakse ruum lõpetatud/read-only olekus, kuid iga aktiivne liige või kehtiva kutse saaja saab otse API kaudu lisada inimesi ja sõnumeid, kustutada sõnumeid ning alustada kõnet või salvestust. Arhiiv ei ole seega usaldatav elutsükli piir ning pärast kokkuvõtete üleandmist võib ühine ajalugu uuesti muutuda.

**Vastuvõtukriteerium.** Üks keskne room-access helper peab eristama read-only lugemist ja kõiki mutatsioone; `archivedAt != null` peab sulgema serveris sõnumi-, kutse-, liikme-, kõne-, salvestus- ja AI-kirjutused. Olemasoleva ajaloo lubatud lugemine peab jääma eraldi selgeks lepinguks. HTTP-negatiivtestid peavad proovima iga mutatsiooniperet arhiveeritud ruumis nii omaniku kui liikmena.

**Seis (11.08.2026): DONE, HTTP-kiht NOT_PROVEN. Migratsiooni ei ole vaja.**
- **Leid ei olnud „üks marsruut unustas kontrolli", vaid „iga marsruut kandis oma koopiat".**
  Sama „leia ruum → leia aktiivne liikmesus → kontrolli arveldust" otsus elas neljas
  käsitsi hoitud koopias (sõnumid, SSE-voog, lugemismärge, liikmed) pluss kõnede oma, ja
  KÕIK valisid ruumist ainult `id` ja `helpMatch` — `archivedAt` ei jõudnud otsuseni kordagi.
  Uus `lib/rooms/accessGuard.js` on üks värav ja koopiad on kustutatud, mitte parandatud.
- **Kolm lepingut, mitte kaks:** `ROOM_READ` (ajaloo lugemine on arhiveeritud ruumis LUBATUD
  — see on lubadus, mitte lünk), `ROOM_WRITE` (409 `api.rooms.archived_readonly`, sama
  vastus, mille omanikuvahetus juba andis) ja **`ROOM_WIND_DOWN`**. Kolmas tekkis paranduse
  kirjutamise ajal: kui kõik kõnemarsruudid oleksid `WRITE`, jääks arhiveerimise hetkel
  käimasoleva kõne osaleja LUKKU — ei saaks lahkuda, salvestust peatada ega nõusolekut
  tagasi võtta. Piir, mis pidi kaitsma, oleks teinud kahju.
- **Vaikeväärtus on `ROOM_WRITE` ja see on tahtlik.** Uus marsruut, mis lepingut ei nimeta,
  on arhiveeritud ruumis KINNI. Erandid on nimelised ja igal on põhjus kirjas.
- **Lugemismärge on teadlikult `READ`** — ta ei muuda ühist ajalugu ega koosseisu, ja
  kirjutuseks lugemine jätaks lõpetatud ruumi igaveseks „lugemata".
- **Kutse loomine ja vastuvõtt** said sama piiri (`isArchivedRoom`), samuti **assistendi
  kirjutus** (`saveAssistantRoomMessage` viskab `ROOM_ARCHIVED`) — kirjutus on ainus koht,
  kust mööda ei saa, sama argument mis SOL-CHAT-07-s.
- **Katvustest on püsiv kaitse, mitte hetkeseis:** test käib läbi KÕIK `app/api/rooms` alla
  jäävad marsruudid ja nõuab jagatud väravat; erandid on nimeline loend koos põhjusega.
  Uus ruumimarsruut kukub selle testi peale, mitte alles järgmises auditis.
- **NOT_PROVEN: HTTP-negatiivtestid.** Väravat ennast on mõõdetud käitumisena (arhiveeritud
  + kirjutus → 409 ka omanikul ja adminil · lugemine ja lõpetamine lubatud · 404/403/403
  vana leping alles), aga marsruutide läbisõit päris sessiooniga on tegemata — sama piir,
  mis kogu selle auditiringi runtime-tõenditel.

### SOL-ROOM-02 — vana ruumi hiline laadimisvastus võib uues ruumis kuvada eelmise ruumi sõnumeid — P1

**Tõend.** `useRoomMessages.load()` ei kasuta abort-signaali ega päringupõlvkonda; vastus kirjutab `setMessages(items)` või merge'ib loendi sõltumata sellest, kas hook'i `roomId` on vahepeal muutunud (`components/rooms/useRoomMessages.js:64-108`). Ruumivahetuse effect tühjendab state'i ja alustab uue `load(true)` päringu, kuid cleanup peatab ainult intervali/EventSource'i, mitte vana fetch'i (`:154-191`). `metaMatchesRoom` peidab küll vana ruumi pealkirja ja rolli, kuid sõnumiloendil samaväärset roomId-valvet ei ole (`:192-206`). Ka vana EventSource'i järjekorras callback'il puudub põlvkonnakontroll (`:115-151`).

**Mõju.** Kui ruumi A päring lõpetab pärast ruumi B päringut, asendab see B vaates sõnumid A ajalooga. Kasutaja võib olla mõlema ruumi õigustatud liige, kuid sisu kuvatakse vale osalejaskonna ja konteksti all; ekraani jagamisel või kliendikohtumisel on see praktiline konfidentsiaalsusleke ning kasutaja võib vastata vale info põhjal.

**Vastuvõtukriteerium.** Fetch, EventSource ja timerid peavad kuuluma konkreetsele roomId-põlvkonnale; cleanup abortib päringu ning ükski vana callback ei kirjuta uude state'i. Hook-/brauseritest peab avama A, vahetama B-le, lahendama B vastuse esimesena ja A vastuse viimasena ning tõendama, et B sõnumid ja meta ei muutu.

**Seis (11.08.2026): DONE koos SOL-ROOM-03-ga, üks plokk. Migratsiooni ei ole vaja.**
- **Otsused kolisid Reactist välja** (`lib/rooms/roomMessageSession.js`), sest leid ON
  ajastus ja ajastust ei saa tõendada lähtekoodi kuju vaadates — testijooksja ei renderda
  hooke. Sama muster, mis SOL-CALL-11…-13 puhul (`lib/calls/clientState.js`). Hook on nüüd
  kest: annab seansile päris `fetch`-i ja `EventSource`-i ning peegeldab seisu.
- **Üks seanss ruumi kohta** kannab oma `AbortController`-it, kursorit, taimereid ja voogu.
  Iga võrguvastus küsib enne kirjutamist `isCurrent()` — suletud seanss ei kirjuta. Vana
  ruumi vastus ei jõua uude vaatesse ka siis, kui ta saabub hiljem.
- **Sulgemine katkestab päringu**, mitte ei unusta teda: `controller.abort()` on cleanup'i
  osa ja katkestust EI loeta tõrkeks (`isAbortError`).
- **Tõend on täpselt kriteeriumi jada:** ava A → vaheta B-le → lahenda B esimesena ja A
  VIIMASENA → B sõnumid ja meta ei muutu. Lisaks kaks eraldi mõõtu: katkestatud päringu
  signaal on `aborted` ja suletud seanss ei tekita ühtki `onChange` kutset.

### SOL-ROOM-03 — sõnumihook lammutab SSE-ühenduse olekumuutustel ja võib 401/403 korral laadimistsüklisse minna — P2

**Tõend.** Peaeffect sõltub `load`-ist ja `connectSse`-st (`components/rooms/useRoomMessages.js:154-191`). `load` sõltub `useSse`, `blocked` ja `authRequired` olekutest ning `connectSse` sõltub omakorda neist ja `load`-ist (`:64-108`, `:109-153`). EventSource'i `onopen` muudab `useSse=true`, mis loob callback'id uuesti, käivitab cleanup'i, sulgeb just avatud ühenduse, tühjendab sõnumid ja loob uue ühenduse. 401/403 seab `authRequired/blocked`, kuid effect'i uus käivitus nullib need lipud kohe enne järgmist laadimist (`:75-84`, `:181-186`); nii võib keelatud või aegunud sessioon tekitada korduva GET/SSE avamise ning vilkuva oleku. Testikogumis on ainult lähtekoodikuju kontroll `useRoomCall` cleanup'ile, mitte selle hook'i olekumasinale.

**Mõju.** Tavalisel avamisel tehakse tarbetu topeltühendus ja sõnumiloend võib vilkuda. Ligipääsu kaol võib klient jätkata perioodilisi keelatud päringuid, näidata ebastabiilselt blocked/login olekut ja koormata serverit selle asemel, et üheselt peatuda.

**Vastuvõtukriteerium.** Ühenduse elutsükkel peab sõltuma stabiilselt ainult ruumi identiteedist; muutuvad olekud tuleb lugeda ref'ist või eraldi reducer'ist. 401 ja 403 on terminalsed kuni sessiooni/ruumi muutuseni ega tohi effect'is nullituda. Fake EventSource + fetch test peab loendama ühendused open/error/401/403/reconnect jadades ja tõendama ühe kontrollitud kanali.

**Seis (11.08.2026): DONE koos SOL-ROOM-02-ga, üks plokk. Migratsiooni ei ole vaja.**
- **Effect sõltub nüüd AINULT ruumi identiteedist ja seadetest.** Muutuv olek (`useSse`,
  `blocked`, `authRequired`) elab seansi sees, mitte callback'ide sõltuvustes — just see
  ahel tegi `onopen`-ist iseenda lammutaja: `useSse=true` → uued callback'id → cleanup →
  just avatud ühendus kinni → uus ühendus.
- **401 ja 403 on terminaalsed SEANSI sees.** Varem olid nad olekus, mille järgmine
  effect-jooks kohe nullis, seega keelatud sessioon küsis lõputult edasi. Nüüd: pollimine
  seisab, voog suletakse, taasühendust ei planeerita ja isegi käsitsi `reload()` ei tekita
  päringut. Uus seanss (ruumi või sessiooni vahetus) alustab puhtalt.
- **Tõend loendab ühendusi**, nagu kriteerium nõuab: avamisel täpselt üks · `onopen` EI tee
  teist ja ei sulge esimest · `onerror` toob pollimise tagasi ja ajastab taasühenduse
  backoff'iga (2000 ms) · 401/403 järel null taimerit, null uut ühendust.
- Võltskell on süstitud, seega backoff ja taasühendus on mõõdetud **ilma ühegi päris
  ootamiseta**.

### SOL-ROOM-04 — omanikuvahetus ja sihtliikme lahkumine võivad jätta ruumi aktiivse omanikuta — P1

**Tõend.** Transfer kontrollib sihtmärgi aktiivset liikmesust enne tehingut (`app/api/rooms/[roomId]/transfer/route.js:68-73`). Tehingus muudab ta tingimuslikult ainult `Room.ownerId` väärtust, kuid sihtmärgi `RoomMember` update ei nõua enam `leftAt: null` tingimust ega kontrolli update count'i (`:76-95`). Lahkumisroute loeb samal ajal vana liikmerolli enne kõnekoristust ja seab `leftAt` hiljem eraldi kirjutusega (`app/api/rooms/[roomId]/leave/route.js:59-86`). Järjestus „lahkuja loeb MEMBER → transfer loeb aktiivse liikme ja teeb temast OWNER → lahkuja seab leftAt” jätab `Room.ownerId` viitama lahkunud liikmele; vana omanik alandatakse MODERATOR-iks.

**Mõju.** Ruumil pole enam aktiivset OWNER-liiget. Vana omanik ei saa omanikupõhiseid kutse-, arhiveerimis-, kustutus- ega üleandmistoiminguid teha ning uus omanik ei näe ruumi aktiivse liikmena. Taastamine vajab administraatori või andmebaasi sekkumist.

**Vastuvõtukriteerium.** Sihtliikme aktiivsus, `Room.ownerId` ja mõlema rolli muutus peavad olema ühe lukustatud/serialiseeritud tehingu invariant; transferi commit'i hetkel peab uus omanik olema aktiivne ning vana omanik ei tohi lahkuda kontrolli ja commit'i vahel valesti. Päris PostgreSQLi test peab võistlema transferi ja target leave'i mõlemas järjekorras ning tõendama täpselt ühe aktiivse OWNER-i.

**Seis (11.08.2026): DONE koos SOL-ROOM-05-ga, üks plokk. Migratsiooni ei ole vaja.**
- **Mõlemad toimingud võtavad SAMA ruumipõhise nõuandeluku** (`lib/rooms/ownership.js`) ja
  teevad kogu otsuse luku sees VÄRSKELT loetud seisu pealt. Varem luges omanikuvahetus
  sihtmärgi aktiivsust enne tehingut ja lahkumine oma rolli enne aeglast kõnekoristust —
  mõlemad otsustasid hetke pealt, mis oli möödas enne, kui otsus jõudis kirjutuseni.
- **Kirjutus on kohtunik, mitte lugemine:** rolli tõstmine nõuab `leftAt: null` ja tema
  `count` on kontrollitud; lahkumine kirjutab `leftAt` ainult tingimusel `role != OWNER`.
  Kui sihtmärk kaob lugemise ja kirjutuse vahel, rullub kogu tehing tagasi — parem tühi
  tulemus kui ruum, mille omanik on lahkunud liige.
- **Lahkumise odav eelkontroll jäi alles**, et omaniku eest ei tehtaks kõnekoristust asjata,
  aga ta ei OTSUSTA enam midagi; otsuse teeb `leaveRoom` luku sees.
- **`npm run room:owner:probe` 22/22 päris PostgreSQL-is, deterministlike lukuvõistlustega
  MÕLEMAS järjekorras** (jagatud `scripts/probe-race-harness.mjs`: kolmas tehing hoiab
  ruumilukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad). Mõõdetav
  invariant ei ole „kes võitis", vaid **ruumil on täpselt üks aktiivne OWNER ja
  `Room.ownerId` näitab aktiivse liikme peale**.
- **Negatiivkontroll jooksutab vana rada sama andmebaasi vastu ja nõuab, et ta invariandi
  RIKUKS** — rikub: `activeOwnerCount === 0` ja vana omanik on MODERATOR.

### SOL-ROOM-05 — ruumi lõpetamise ja omanikuvahetuse kõrvalmõjud ei ole ühe ausa lõpptulemusega seotud — P1

**Tõend.** DELETE lõpetab kõne, kopeerib kokkuvõtted ja kirjutab `ROOM_DELETED` auditi enne `room.delete()` käsku (`app/api/rooms/[roomId]/route.js:82-130`). Lõpliku delete'i vea korral on kõne juba lõppenud, koopiad loodud ja audit väidab kustutamist, kuid ruum eksisteerib. Archive lõpetab samuti kõne ja teeb koopiad enne tingimuslikku archive-update'i; auditi viga toimub pärast edukat `archivedAt` kirjutust ning viib route'i 500 vastuseni (`:168-203`). Transfer teeb omandi tehingu enne auditi kirjutust, nii et audititõrge tagastab 500 juba tehtud omanikuvahetuse kohta (`app/api/rooms/[roomId]/transfer/route.js:76-119`).

**Mõju.** Kasutaja saab 500 ning proovib toimingut uuesti, kuigi osa või kogu põhiseis on muutunud. Audit võib väita olematut kustutust või puududa tehtud arhiivi/transferi kohta; kõne võib olla lõpetatud aktiivseks jäänud ruumis. Seda ei saa ühest vastusest ega auditireast usaldusväärselt taastada.

**Vastuvõtukriteerium.** DB-põhise elutsüklisiirde, auditirea ja püsivate handover-ledgerite kirjutus peab olema üks tehing või durable outbox/finalization olek. Välise kõne-egressi peatamine vajab eraldi idempotentset ette-/järelseisu, mida saab retry'da. Veasüstetestid peavad katkestama iga sammu järel ja kontrollima API vastust, ruumi olekut, kõnet, koopiat ning auditi tõde.

**Seis (11.08.2026): DONE koos SOL-ROOM-04-ga, üks plokk. Migratsiooni ei ole vaja.**
- **Kolm siiret said oma jälje samasse tehingusse.** Kustutus: audit + `room.delete` on nüüd
  üks `$transaction` — varem jäi kustutuse vea korral alles rida, mis väitis olematut
  kustutust. Arhiveerimine: tingimuslik `archivedAt` kirjutus + audit ühes tehingus — varem
  tuli audit PÄRAST edukat arhiveerimist ja tema viga andis 500 seisu kohta, mis oli juba
  olemas. Omanikuvahetus: audit sünnib siirdega samas lukustatud tehingus.
- **Tõend on ROLLBACK, mitte rea olemasolu.** Sond süstib vea täpselt auditikirjutusse
  (`Proxy` tehinguklient, kõik muu on päris) ja nõuab, et KOGU siire rulluks tagasi:
  `ownerId` muutumata, sihtmärgi roll `MEMBER`, auditirida puudub, viga jõuab kutsujani.
  Fake-Prisma seda tõendada ei saa — seal ei ole tehingut, mida tagasi rullida.
- **Väline pool jäi teadlikult tehingust välja ja fail-closed'iks:** kõne lõpetamine ja
  kokkuvõtete privaatkoopiad käivad ENNE siiret ja nende tõrge annab ausa 500 ilma
  kustutuse või arhiveerimiseta (`copy-first`, sama muster mis T16 kustutusvoos). Nad on
  idempotentsed, seega kordus on ohutu — see on kriteeriumi „eraldi ette-/järelseis".
- **Aus piir:** veasüst käib auditikirjutuse pihta, mitte iga sammu järel eraldi. Väliste
  sammude (egress, koopiad) katkestamine päris teenuse vastu on `runtime: not_run`.

### SOL-ROOM-06 — kokkuvõtte jagamine võib õnnestuda ilma hilisema privaatkoopia ja kinnitusringi kandjata — P1

**Tõend.** Route loob ruumisõnumi esmalt ja kutsub alles seejärel `recordSharedRoomSummary()` funktsiooni (`app/api/rooms/[roomId]/messages/route.js:370-436`). See helper neelab `RoomSharedSummary.upsert()` vea ning tagastab `{recorded:false}`; route ei kontrolli tulemust ja tagastab jagamise edukana (`lib/rooms/summaryHandover.js:30-61`). `applySummaryApprovalPolicy()` neelab samuti kõik vead (`lib/rooms/summaryApproval.js:105-151`). Ruumi lõpetamisel kopeeritakse ainult olemasolevad `RoomSharedSummary` read (`lib/rooms/summaryHandover.js:126-139`), seega nähtavaks postitatud kokkuvõte võib handover'ist täielikult puududa. Test `tests/rooms/summaryHandover.test.js` kinnitab praegu sõnaselgelt, et lingi kirjutamise tõrge ei kukuta jagamist.

**Mõju.** Kõik osalejad näevad ruumis kinnitatud kokkuvõtet, kuid ruumi arhiveerimisel/kustutamisel ei saa neist keegi lubatud privaatkoopiat ning soovitud kinnitusring ei avane. Hiljem kaob koos ruumiga ka ainus jagamise kontekst, samal ajal kui esialgne API ja UI ütlesid edu.

**Vastuvõtukriteerium.** Sõnum ja `RoomSharedSummary` snapshot peavad tekkima ühes DB-tehingus või jagamine peab jääma nähtavasse `link_pending` retry-olekusse; kinnitusringi vea korral peab vähemalt jagaja nägema taastatavat osalist seisu. Test peab süstima upsert/policy/audit vea ning tõendama, et edu ei tähenda kadunud handover-kandjat.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Valitud on kriteeriumi esimene haru: sõnum ja kandja on ÜKS tehing.** Teine haru
  (`link_pending` retry-olek) oleks nõudnud uut seisu ja teist tõde selle kohta, mis ruumis
  juba nähtaval on.
- **Vaikimine oli leiu tuum, seega `recordSharedRoomSummary` VISKAB.** Ta neelas `upsert`
  vea ja tagastas `{recorded:false}`, mida marsruut ei vaadanud: kõik nägid ruumis
  kinnitatud kokkuvõtet, aga ruumi lõppedes ei saanud sellest keegi privaatkoopiat, sest
  üleandmine loeb ainult `RoomSharedSummary` ridu. Nüüd on kas mõlemad või mitte kumbki.
- **Kinnitusringi tõrge ei vaiki enam:** vastus kannab `summaryShare.approvalFailed`
  välja, seega jagaja saab ausa osalise seisu (jagamine õnnestus, ring jäi avamata).
  Ringi enda vea peale EI rullita jagamist tagasi — sõnum on ruumis nähtav ja tema
  tagasivõtmine oleks suurem kahju kui avamata ring.
- **Test, mis varem lukustas VALE käitumise, on ümber pööratud:** „lingi kirjutamise tõrge
  ei kukuta jagamist ennast" oli sõna-sõnalt leiu kirjeldus testina. Nüüd nõuab ta
  viskamist.
- **Aus piir:** `summaryShare.approvalFailed` on API vastuses, aga liides ei kuva teda veel
  eraldi tekstina — uut tõlkevõtit selles ringis ei lisatud (`messages/*` kannab teise
  sessiooni pooleliolevat tööd). See on UI saba, mitte serveri lünk.

### SOL-ROOM-07 — enne ruumi lõppu lahkunud osaleja ei saa talle lubatud kokkuvõttekoopiat — P2

**Tõend.** Mooduli leping ja kommentaar lubavad „iga osaleja” privaatkoopiat, mis elab ruumi kustutuse/arhiveerimise üle (`lib/rooms/summaryHandover.js:3-18`, `:119-125`). Tegelik saajate päring valib ainult lõpetamise hetkel aktiivsed `RoomMember` read tingimusega `leftAt: null` (`:140-147`). Lahkumisroute ei tee handover'it (`app/api/rooms/[roomId]/leave/route.js:59-89`). Ka test kirjeldab lahkunule koopia andmata jätmist oodatud käitumisena (`tests/rooms/summaryHandover.test.js`), kuigi ta võis jagatud sõnumit varem näha.

**Mõju.** Osaleja, kes lahkub pärast kokkuvõtte jagamist, kaotab ruumi sulgemisel püsiva koopia, samal ajal kui hiljem lahkuvad liikmed selle saavad. Andmete kättesaadavus sõltub juhuslikust ruumi lõpetamise ajast, mitte sellest, kellele kokkuvõte tegelikult jagati.

**Vastuvõtukriteerium.** Saajate ring peab tulema jagamise hetke auditeeritavast osalejasnapshot'ist või koopia tuleb luua jagamisel/lahkumisel; tooteomanik peab selgelt kinnitama, kui teadlik leping on ainult lõpetamise hetke aktiivsed liikmed. Test peab katma jagamine → üks liige lahkub → arhiiv/kustutus ja kontrollima otsustatud saajate hulka.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Saajate ring on JAGAMISE hetk, mitte ruumi lõpp.** Kättesaadavus ei sõltu enam sellest,
  millal ruum juhtus suletama: pärast jagamist lahkunu saab oma koopia, enne jagamist
  lahkunu ei saa.
- **Ring on ÜHEND, mitte asendus:** praegused liikmed JA jagamise hetkel aktiivsed. Nii ei
  võeta koopiat ära hiljem liitunult, kes näeb kokkuvõtet ruumi ajaloos — parandus on
  puhtalt lisav.
- **Snapshot'i veergu ei tehtud, sest ajalugu on juba olemas:** `RoomMember.joinedAt` ja
  `leftAt` ütlevad, kes oli ruumis jagamise ajal. Eraldi saajate-veerg oleks teine tõde,
  mida tuleks sünkroonis hoida (sama argument, mis SOL-DOC-07 loenduriveerul).
- **Test kannab täpselt kriteeriumi jada:** jagamine → üks liige lahkub PÄRAST → üks lahkus
  ENNE → arhiiv/kustutus → mõõdetakse saajate hulk. Vana ootus („lahkunu ei saa") oli
  testis kirjas oodatud käitumisena ja on nüüd ümber kirjutatud.
- **Aus piir:** üks `RoomMember` rida (roomId, userId) on unikaalne, seega korduv
  lahkumine-liitumine kannab ainult VIIMAST seisu. Kes lahkus, jagamise ajal eemal oli ja
  hiljem uuesti liitus, loetakse saajaks — ring on selles servas pigem lai kui kitsas, ja
  see on teadlik valik: ta näeb sama teksti ruumi ajaloos niikuinii.

### SOL-CALL-01 — nõusoleku tagasivõtu järel võib egress edasi salvestada, kuigi API vastab eduga — P0

**Tõend.** Aktiivse salvestuse ajal `WITHDRAWN/DECLINED` otsus jõuab `discardActiveRecording()` funktsiooni, mille kommentaar lubab egressi kohest fail-closed peatamist (`lib/calls/service.js:1026-1033`, `:1374-1397`). Tegelikult neelab funktsioon nii provider'i `stopRecording()` kui kohaliku artefakti kustutuse vea, märgib faili best-effort `DELETED`-iks ja kirjutab taotluse kindlalt `STOPPED` olekusse (`:1039-1055`). Withdraw/decline route tagastab seejärel `ok:true` ja STOPPED seisu (`app/api/rooms/[roomId]/calls/[callSessionId]/recording/[recordingRequestId]/withdraw/route.js:30-50`; decline kasutab sama teenust). Ka tavalise stop'i viga märgib faili ja taotluse `FAILED`-iks (`lib/calls/service.js:953-1023`), mille järel start/stop route ei leia enam ACTIVE salvestust; providerile pole reconcile'i, webhook'i ega korduspeatust.

**Mõju.** Inimene võtab nõusoleku tagasi ja platvorm kinnitab salvestuse lõppu, kuid LiveKit Egress võib jätkata kõigi heli kirjutamist. DB ütleb STOPPED/DELETED või FAILED, UI ei paku enam peatamist ning retention ei pruugi teada jätkuva provideritöö tegelikku artefakti. See on otsene nõusoleku- ja tundlike heliandmete piiririkkumine.

**Vastuvõtukriteerium.** Provider-stop'i kinnitus peab olema salvestuse terminalseisu eeltingimus; ebaselge/tõrkunud stop jätab nähtava `STOPPING/STOP_FAILED` oleku, blokeerib või lõpetab kõne konservatiivselt ning käivitab püsiva reconcile/retry kuni provider kinnitab lõpu. Nõusoleku tagasivõtu vastus ei tohi olla `ok:true`, kui salvestamise peatumine pole tõendatud. Provider-veasüstetest peab jätma stop-promise'i tõrkuma/aeguma ja kontrollima providerit, DB-d, UI-d ning füüsilist faili.

**Seis (09.08.2026): DONE — tingimuslik lõppseis, kolm uut seisu, jagatud kinnitusloogika, püsiv taasproov ja 3 uut testi; rakenduse runtime: not_run.**

Lõppseis on nüüd providerikinnituse taga. `STOPPING` kirjutatakse ENNE providerikutset;
kinnituseta jääb taotlus `STOP_FAILED`-iks ja fail `QUARANTINED`-iks (mitte `DELETED`,
mis on väide faili puudumise kohta). Kaks tõrget, mis said vanas koodis sama vastuse, on
lahku viidud: „provider ei peatunud" on nõusolekupiir ja lahkub `STOP_FAILED`-iga, „provider
peatus, järeltöötlus kukkus" jõuab `catch`-i, kus `FAILED` on aus. Withdraw ja decline
vastavad `202` + `ok:false`, kui peatumine ei ole tõendatud — nõusoleku tagasivõtt ise
õnnestus, seega mitte 4xx. Kinnitusloogika (`confirmEgressStopped`) on ÜKS implementatsioon
`lib/calls/egress.js`-is, sest sama küsimust küsib ka püsiv taasproov. Taasproov kasutab
olemasolevat `DataDeletionJob` järjekorda (`CALL_EGRESS_STOP`); uut töölist ei ehitatud.

Vastuvõtukriteeriumist on KATMATA kaks osa: „blokeerib või lõpetab kõne konservatiivselt"
on täidetud ainult osaliselt (uut salvestust samas kõnes ei saa alustada, aga kõnet ennast
ei lõpetata), ja päris provideri VEASÜSTETEST puudub endiselt — toodangus ei saa LiveKiti
stoppi tahtlikult katki teha. Commit'id `c58f6c3c` (alus) ja `12f896a2`.

**RUNTIME (10.08.2026): õnnelik rada TÕENDATUD päris LiveKit Egressi vastu.** Toodangus
käivitatud salvestus (`EG_uFk74QLBPbcV`), nõusoleku tagasivõtt → HTTP **200** (provider
kinnitas stopi, seega aus `ok:true`), taotlus `STOPPED`, fail `DELETED`,
`providerStopConfirmedAt` kirjas, ükski `CALL_EGRESS_*` töökäsk ei tekkinud ja füüsilist
artefakti kettale ei jäänud. Kolme järjestikuse elutsükli ümbertegemise järel on see esimene
tõend, et salvestamine üldse töötab.

**JA SEESAMA JOOKS LEIDIS AUGU SELLES PARANDUSES.** Hiline liituja teise kontoga näitas:
`providerStopConfirmedAt` sai kirja (stop tõendatud), aga taotlus läks `FAILED`. Põhjus —
pime `FAILED`-catch elas KAHES kohas ja esimene parandus katkas ainult ühe:
`stopActiveRecordingForCall` sai kaitse, `joinCall` (`:1610`) mitte. Kinnitamata stopi korral
oleks `joinCall` ausa `STOP_FAILED`-i üle kirjutanud — täpselt see viga, mille vastu see leid
tehti. 3313 testi ei näinud seda, sest ükski neist ei jõudnud `stopRecording`-ini LIITUMISE
kaudu. Otsus on nüüd ühes kohas (`markStopFailure`), uus test käib liitumise rada ja tema
negatiivkontroll on tehtud. Commit `51907670`.

### SOL-CALL-02 — salvestuse start võib võita hilise liituja või nõusoleku tagasivõtu ja alustada nõusolekuta — P0

**Tõend.** `startRecording()` loeb aktiivse osalejaskonna ja kontrollib kõigi CONSENTED olekut enne salvestusruumi ettevalmistust ning välist providerikutset (`lib/calls/service.js:876-916`). `CallRecordingRequest` jääb selle aja jooksul `READY_TO_RECORD` olekusse ja muutub ACTIVE-ks alles pärast egressi starti ning faili update'i (`:925-941`). Paralleelne `joinCall()` lisab uue aktiivse osaleja, kuid otsib peatamiseks ainult juba ACTIVE taotlust; kui start pole veel ACTIVE update'ini jõudnud, ei leia ta midagi ja tagastab uuele osalejale tokeni (`:1190-1246`). Sama aken on nõusoleku tagasivõtul: consent-rada võib vana READY requesti DECLINED-iks muuta, kuid start kirjutab hiljem sama rea tingimusteta ACTIVE-ks (`:657-740`, `:935-940`); wrapper kõrvaldab egressi ainult siis, kui consent-raja enda tagastatud staatus oli ACTIVE (`:1374-1397`).

**Mõju.** Uus osaleja võib hakata rääkima salvestatavas kõnes ilma nõusolekut nägemata või osaleja tagasivõetud nõusolek võib kaotada võidujooksu hilisele ACTIVE-kirjutusele. UI ja kommentaarid lubavad kõigi osalejate eelnevat nõusolekut, kuid server ei serialiseeri osalejaskonda, nõusolekuid ja starti.

**Vastuvõtukriteerium.** Salvestuse start vajab atomaarset claim'i koos osalejaskonna/nõusoleku revisjoniga; join/leave/consent/withdraw peavad sama call-lock'i või fencing-versiooni all kas starti katkestama või enne egressi uue rosteri uuesti kinnitama. Päris DB + kontrollitava provideriga test peab peatama starti enne providerit, provideris ja enne ACTIVE update'i ning võistlema join'i ja withdraw'ga; mitte üheski järjestuses ei tohi egress salvestada nõusolekuta osalejat.

**Seis (10.08.2026): DONE — atomaarne claim, fencing-loend, tingimuslikud üleminekud ja 3 võidujooksutesti; rakenduse runtime: not_run.**

Start on nüüd claim, mitte kavatsus. `READY_TO_RECORD → STARTING` on tingimuslik
`updateMany` (CAS), nõusolekut kontrollitakse ALLES claim'i järel, ja enne `ACTIVE`-t
võrreldakse `CallSession.rosterVersion`-i claim'i hetke väärtusega. Loendit kasvatavad
liitumine, lahkumine ja iga nõusolekuotsus. Selle mõte on, et liituja EI PEA starti
„püüdma" — tal piisab numbri kasvatamisest; püüdmisel oleks alati aken, kasvatamisel ei
ole. Fencing'u katkestus peatab äsja käivitatud egress'i ja paneb faili karantiini.

Üks asi, mis peaaegu märkamata jäi: `updateRecordingReadiness` ei puuduta `STARTING`-ut
(rida kuulub starterile), seega claim'i ajal saabunud tagasivõtt ei jõudnud reale.
Claim'i vabastus arvutab pildi nüüd uuesti — muidu oleks tagasi võetud nõusolekuga
taotlus jäänud `READY_TO_RECORD`-iks ja järgmine start oleks kohe uuesti alustanud.

KATMATA: kriteerium nõuab testi „päris DB + kontrollitava provideriga". Võidujooksud on
tõendatud fake-prisma ja süstitava provideri peal (aken on päris providerikutse sees, mitte
kunstlik `await`), päris PostgreSQL-i ja LiveKiti vastu mitte. Commit `88e19c82`.

### SOL-CALL-03 — provider võib salvestada ilma taastatava ACTIVE-seisuta — P0

**Tõend.** `startRecording()` seab faili PROCESSING-uks ja käivitab `startAudioRecording()`; ainult provider-start'i enda erind märgib faili FAILED-iks (`lib/calls/service.js:896-923`). Pärast provider'i edu kirjutatakse egressId faili ning alles siis taotlus ACTIVE-ks (`:925-941`). Nende kahe DB update'i ümber pole catch-kompensatsiooni: kummagi vea korral route tagastab 500, kuid providerile stop'i ei saadeta ja DB võib sisaldada egressId-ta PROCESSING või READY taotlust. `createConfiguredEgressProvider()` ei paku list/status reconcile'i ega webhook'i (`lib/calls/egress.js:17-58`). Samuti võivad import või SDK-kutse määramata ajaks ootele jääda, sest rakenduse timeout/abort puudub.

**Mõju.** LiveKit võib aktiivselt salvestada kõnet, samal ajal kui platvorm näitab starti ebaõnnestununa või jätab taotluse READY olekusse. Kasutaja retry võib käivitada veel ühe egressi; Stop-nupp ei oska esimest egressId-d leida. Salvestamine võib jätkuda pärast kõne või nõusoleku näilist lõppu.

**Vastuvõtukriteerium.** Enne providerikutset peab DB-s olema püsiv STARTING claim/attempt-ID; provider-start peab olema idempotentne ning egressId taastatav. Iga järgnev DB-viga peab käivitama tõendatud provider-stop'i või durable reconcile'i. SDK-kutsetel peab olema timeout. Veasüstetestid peavad katkestama mõlemad DB update'id pärast päris/fake provider-start'i ja tõendama, et ühtki tundmatut egressi ei jää.

**Seis (10.08.2026): DONE — püsiv STARTING claim, kompensatsioon mõlemal DB-tõrkel, ruumipõhine orvukontroll ja 3 veasüstetesti; rakenduse runtime: not_run.**

Enne providerikutset on DB-s püsiv claim (`startClaimId` + `startClaimedAt` lease'iga,
sama muster nagu SOL-RAGADMIN-03). Mõlemad kirjutused providerikutse JÄREL on nüüd
kompenseeritud: failikirjutuse tõrge ja seisukirjutuse tõrge saadavad mõlemad providerile
tõendatud stopi ning vabastavad claim'i — vana kood tagastas 500 ja jättis egress'i käima.
Kinnitamata jäänud stop läheb `CALL_EGRESS_STOP` järjekorda.

Aegunud start on eraldi juhtum: timeout EI OLE tõend, et start ei jõudnud kohale, ja siis
me egressId-d EI TEA. Selleks on `listActiveRoomEgress` + `CALL_EGRESS_ORPHAN_STOP`, mis
otsib orvu ruumi kaudu üles. SDK-timeout tuli juba `c58f6c3c`-ga.

KATMATA: „provider-start peab olema idempotentne" ei ole tehtud — LiveKitile ei saadeta
idempotentsusvõtit, seega taasproov võib teoreetiliselt teise egress'i sünnitada. Praegu
kaitseb selle vastu CAS (kaotaja ei jõua providerini), mitte provider ise. Commit `88e19c82`.

### SOL-CALL-04 — paralleelne salvestuse Start võib käivitada mitu egressi — P1

**Seis (10.08.2026): DONE — katsepõhine failivõti ja idempotentne kordus; kaks varasemat märkust allpool jäävad ajalooks.**

Mõlemad katmata osad on nüüd tehtud. **Failivõti oli katsepõhine ainult näiliselt:**
nimes on sekundi täpsusega ajatempel, seega kaks katset sama sekundi sees said TÄPSELT
sama nime ja teine egress oleks kirjutanud esimese faili peale. Nüüd kannab nimi
start-claim'i id-d (`buildRecordingFileName({ attemptId })`). **Kordus tagastab
olemasoleva stardi**, kui taotlus on `ACTIVE` ja failil on `egressId` — topeltklõps ei
tee teist egress'i ega teist auditirida. Vana vastus `call.recording_not_ready` tähendas
vastupidist asja kui tegelikkus.

Kaks piiri on teadlikud, mitte tegemata: **`STARTING` jääb veaks** (pooleliolev katse ei
ole start, mille kohta saaks öelda „juba käib") ja **`ACTIVE` ilma `egressId`-ta samuti**
— kui me egress'i ei tea, ei ole meil midagi, mille kohta valetada.

Kriteeriumi paralleeltest on kahes tükis: „kaks paralleelset starti annavad ÜHE egress'i"
(olemas CALL-02-st) ja uus „üks fail, üks auditirida". Negatiivkontroll tehtud: uued
testid kukuvad vana teostuse peal. Commit `5af2e22b`.

**Märkus (10.08.2026, EI OLE DONE).** SOL-CALL-02 CAS sulgeb selle leiu peamise raja:
tingimuslik `READY_TO_RECORD → STARTING` tähendab, et kahest paralleelsest start-kutsest
jõuab providerini täpselt üks (tõendatud testiga „kaks paralleelset starti annavad ÜHE
egress'i"). Kriteeriumist on aga katmata kaks osa: igal katsel EI OLE unikaalset
attempt/file key'd (failiplaceholder on endiselt jagatud) ja kordus EI TAGASTA olemasolevat
starti, vaid põrkab `call.recording_not_ready`-ga. Leid jääb seetõttu lahtiseks.

**Tõend.** Kaks `startRecording()` kutset võivad mõlemad lugeda sama `READY_TO_RECORD` taotluse ja sama nõusolekuseisu (`lib/calls/service.js:876-895`). Taotlusel pole STARTING claim'i ega tingimuslikku `READY → ACTIVE` update'i. Mõlemad kasutavad sama või võistluses loodud failiplaceholderit, kutsuvad eraldi `startAudioRecording()` ja kirjutavad hiljem oma egressId sama faili reale (`:896-940`). Skeemi/migratsiooni osaline unikaalindeks tagab ainult ühe avatud request'i kõne kohta, mitte ühe start-attempt'i või faili (`prisma/migrations/20260721000000_rooms_calls_v1/migration.sql:51-60`; `prisma/schema.prisma:3585-3612`).

**Mõju.** Topeltklõps, kaks moderaatorit või retry võivad käivitada kaks sama kõne salvestust. Viimase kirjutuse egressId võidab, teine muutub haldamatuks; Stop lõpetab ainult ühe ja füüsilised failid võivad üksteist sama nimega üle kirjutada või eraldi orvuks jääda.

**Vastuvõtukriteerium.** `READY_TO_RECORD → STARTING` peab olema atomaarne CAS ning igal katsel unikaalne attempt/file key; kordus peab tagastama olemasoleva starti. Paralleeltest peab käivitama vähemalt kaks starti, blokeerima provideris ja tõendama täpselt ühe egress-kutse, ühe faili ning ühe auditisündmuse.

### SOL-CALL-05 — sama osaleja nõusolekurida võib paralleelselt dubleeruda — P1

**Tõend.** `ensureConsentRowsForActiveParticipants()` teeb iga osaleja kohta `findFirst → create` ilma tehingu või unikaalsuskonflikti käsitluseta (`lib/calls/service.js:565-585`). `respondToRecordingConsent()` kordab sama mustrit puuduva rea korral (`:674-704`). Skeemis on `CallRecordingConsent` jaoks ainult tavalised indeksid, mitte `(recordingRequestId,userId)` unikaalsus (`prisma/schema.prisma:3559-3583`). Paralleelsed join/consent toimingud võivad seega luua samale inimesele mitu rida. Readiness loeb kõik read ning üks REQUESTED/DECLINED duplikaat võib blokeerida; `allRequiredConsentsPresent()` teeb massiivist Map'i, kus juhusliku viimase rea staatus otsustab (`lib/calls/service.js:531-563`, `:828-836`).

**Mõju.** Ühe inimese nõusolek võib käituda korraga antu ja andmata/keeldutuna, salvestus võib jääda lukku või ebadeterministlikult käivituda. Audititõend ei ole enam „üks inimene, üks viimane otsus” ning UI võib näidata duplikaate.

**Vastuvõtukriteerium.** Lisada unikaalne `(recordingRequestId,userId)` piir ning kasutada atomaarset upsert'i; readiness peab lugema üht kanoonilist otsust osaleja kohta ja roster-revisjoni. Päris DB paralleeltest peab võistlema join'i, consent'i ja request'i loomise ning tõendama ühe rea ja ühe otsuse.

**Seis (10.08.2026): DONE — unikaalne indeks + üks jagatud `upsert`-tee, tõendatud päris PostgreSQL-is (`npm run call:consent:probe` 8/8).**

Ravim on kahepoolne, sest kumbki pool üksi ei piisa: andmebaasi
`@@unique([recordingRequestId, userId])` (migratsioon `20260810120000`) **ja** üks jagatud
`ensureConsentRow()`, mis kirjutab `upsert`-iga. Mõlemad kutsujad (liitumine ja
vastamine) käivad nüüd sama teed — kaks koopiat sama otsusega lahknevad esimese
muudatusega. `update: {}` on tahtlik: korduv liitumine EI keera juba antud (või tagasi
võetud) otsust `REQUESTED`-iks tagasi.

**Migratsioon ei kustuta duplikaate.** Kui neid leidub, kukub ta nimelise teatega —
nõusolek on õiguslik tõend ja masin ei tohi valida, kumb kahest vastuolulisest
tahteavaldusest ellu jääb. Toodangus mõõdetud 10.08: **13 rida, 13 unikaalset paari**,
seega indeks tekib puhtalt.

„Üks kanooniline otsus osaleja kohta" tuleb nüüd piirist endast: `findMany` ei saa enam
tagastada kahte rida ühe inimese kohta, seega `allRequiredConsentsPresent()` Map ei sõltu
enam järjekorrast. Roster-revisjon oli juba olemas (CALL-02 `rosterVersion`).

Kriteeriumi **päris DB paralleeltest** on sond, mitte `npm test`: fake-Prisma ei jõusta
ühtegi piirangut (sama klass tabas 09.08 SOL-SCHEMA-01-t). Sond mõõdab: duplikaat →
**P2002** · teine inimene mahub · upsert tabab olemasoleva rea ja ei keera otsust tagasi ·
**kolm paralleelset upsert'i → üks rida, null erindit**. Commit `5af2e22b`.

### SOL-CALL-06 — salvestise kustutus ja retention raporteerivad edu ka kustutamata faili korral — P1

**Tõend.** `purgeRecordingFile()` neelab eraldi nii füüsilise objekti kustutuse, `UserDocument` delete'i kui `CallRecordingFile` update'i vea ning tagastab alati `true` (`lib/calls/recordingRetention.js:12-41`). Käsitsi delete kutsub seda tulemust kontrollimata ja tagastab `ok:true`, seejärel best-effort auditi (`lib/calls/service.js:1070-1086`). Retention loendab sama väärtuse `purged` hulka (`lib/calls/recordingRetention.js:43-61`). Kui faili kustutus ebaõnnestub, kuid DB märgitakse DELETED-iks, ei vali sweep seda enam kunagi; kui DB update ebaõnnestub, võib route ikkagi kinnitada kustutust.

**Mõju.** Kasutajale ja retention-raportile öeldakse, et tundlik helifail kustutati, kuigi fail, dokument või DB ligipääs võib alles olla. Eriti füüsilise delete'i tõrke järel muutub fail DB-st orvuks ja automaatne retry kaob.

**Vastuvõtukriteerium.** Purge vajab astmelist püsivat olekut (`DELETE_PENDING`, faili/documenti kinnitused) ja idempotentset retry'd; `purged` kasvab ainult pärast kõigi nõutud sammude kinnitust. Käsitsi delete peab vea nähtavaks jätma. Testid peavad süstima iga kolme sammu vea eraldi ja kontrollima korduskatset ning füüsilist faili.

**Seis (10.08.2026): DONE — astmeline `DELETE_PENDING` kustutus, mis on ise oma taasproovi allikas. Commit `74d5cc80`.**

Kustutus on nüüd neli kinnitatud astet: `DELETE_PENDING` kirja **enne** ühegi artefakti
puutumist → artefakt(id) → `UserDocument` rida → alles siis `DELETED`. Iga aste, mis ei
õnnestu, jätab rea `DELETE_PENDING`-iks ja sweep valib teda uuesti. Uut töölist ei ole
vaja, sest retention käib niikuinii üle.

**Uus enum-väärtus, mitte uus tabel.** Vahe `QUARANTINED`-ist on tähendus, mitte aste:
karantiin ütleb „seda ei väljastata", `DELETE_PENDING` ütleb „seda kustutatakse ja töö on
pooleli". Migratsioon `20260810140000` lisab väärtuse tehingus (PG 16 lubab, kui teda
samas tehingus ei kasutata).

**Kaks artefakti, mitte üks — see leidus ei olnud raportis kirjas.** Finaliseeritud
salvestis elab dokumendisalvestuses (`uploads/…`), finaliseerimata (PROCESSING / FAILED /
QUARANTINED) elab egress'i väljundkaustas ja tema nimi EI OLE dokumenditee. Vana kood
saatis mõlemad `deleteStoredArtifact`-i, mis nõuab `uploads/` prefiksit — toores fail
andis seal tee-vea, mis neelati alla. St **karantiini pandud partiaali ei kustutanud
keegi**, kuigi raport luges ta `purged` hulka. See on täpselt see fail, mille SOL-CALL-01
sinna karantiini pani.

Sama neelamine oli tapnud ka ühe ohutusharu: `discardEgressArtifact` ei visanud kunagi,
seega `discardActiveRecording()` valik `DELETED` ja `QUARANTINED` vahel oli **surnud
kood** — kommentaar ilma mehhanismita. ENOENT jääb õnnestumiseks: puuduv fail ON soovitud
lõppseis.

Käsitsi kustutus viskab nüüd `call.recording_delete_failed` (route **503**, mitte vaikne
200) ja kirjutab `CALL_RECORDING_DELETE_FAILED` auditi. 503, sest see ei ole kasutaja viga
ega lõplik keeldumine — töö on pooleli. `purged` kasvab ainult kinnitatud kustutuse peale;
sweep raporteerib ka `failed` ja `failures[]`.

Väravad: `npm test` **3338/3338** (Europe/Tallinn ja UTC) · `i18n:check` roheline · eslint
puhas · `db:migrate:check` OK (144 migratsiooni). **Negatiivkontroll: 9/9 uut ja muudetud
testi kukub vana teostuse peal** (mõõdetud failide ajutise tagasivahetusega).

**NOT_PROVEN:** kettaoperatsiooni ennast tõendab ainult mock-storage. Päris egress-faili
kustutuse tõrget (õigused, lukus fail) ei ole reprodutseeritud — see nõuab serverit, kus
egress päriselt kirjutab.

### SOL-CALL-07 — nõustunud osaleja saab „salvestis saadaval” teate, kuid fail kuulub ainult taotlejale — P2

**Tõend.** Salvestuse lõpetamisel luuakse üks `UserDocument` omanikuga `recordingRequest.requestedByUserId` (`lib/calls/service.js:838-853`). Dokumentide list, detail ja download on rangelt `ownerId: auth.userId` skoopiga (`app/api/documents/route.js:96-105`, `app/api/documents/[id]/download/route.js:45-56`). Samas `notifyCallRecordingAvailable()` saadab teate kõigile CONSENTED osalejatele (`lib/calls/notifications.js:82-114`) ning notification-verifieri kommentaar väidab, et nõustunul on ligipääs ka pärast ruumist lahkumist (`lib/notifications.js:640-653`). UI nõusolekutekst lubab faili „õigustatud kasutajatele dokumentide vaates” (`components/rooms/RoomCallBar.jsx:235-241`), kuid consent-põhist dokumentide projektsiooni ega allalaadimisroute'i pole.

**Mõju.** Mitte-taotlejast osaleja saab teate, et fail on saadaval, kuid ruumilingilt ega dokumentide vaatest ei leia ega laadi seda alla. See on eksitav nõusoleku- ja andmejagamisleping; pole selge, kas salvestis pidi olema ainult taotleja privaatfail või kõigi nõustunute ühine artefakt.

**Vastuvõtukriteerium.** Tooteomanik peab valima ühe lepingu: ainult taotleja omandus koos ainult talle saadetava teatega, või consent-snapshotil põhinev revocable/read-only ligipääs kõigile õigustatud osalejatele. Teavitus, nõusolekutekst, dokumentide projektsioon ja download peavad sama otsust jõustama. HTTP-testid peavad katma taotleja, nõustunu, tagasivõtnu, lahkunu ja mitteliikme.

**Seis (11.08.2026): DONE — omaniku otsus on „ainult taotleja oma"; teade, saaja-verifitseerimine ja nõusolekutekst jõustavad nüüd ühte ja sama lepingut. Commit `4d2df0af`.**

**Omaniku otsus 11.08.2026:** salvestis on AINULT taotleja privaatdokument. Nõusolek
tähendab „mind tohib salvestada", mitte „ma saan koopia". Teine haru (consent-snapshotil
põhinev ligipääs) oleks nõudnud TEIST ligipääsuteed dokumentide loendis, detailis ja
allalaadimises — täna on seal ainus reegel `ownerId: auth.userId` — ja see oleks uus auk
platvormi kõige tundlikumas piiris.

Kolm kohta muutusid korraga, sest üksinda oleks igaüks neist jätnud lubaduse alles:

- **Teade** läheb taotlejale. `notifyCallRecordingAvailable` ei loe enam nõusolekuridu
  üldse — saaja tuleb `requestedByUserId` pealt.
- **Saaja-verifitseerimine** (`assertNotificationRecipient`) küsib OMANDIT, mitte
  nõusolekut. Seal seisis lisaks kommentaar, mis väitis, et „nõusoleku andnul on
  artefakti ligipääs ka pärast ruumist lahkumist" — see väide ei olnud kunagi tõsi.
- **Nõusolekutekst** ütleb kandja välja kolmes keeles (`calls.recording_consent_custody`)
  ja lubadus „tehakse kättesaadavaks õigustatud kasutajatele dokumentide vaates" on välja
  võetud. Tekst on **uus versioon `call-recording-consent-v2`**, sest muutus LUBADUS,
  mitte sõnastus; v1 all antud nõusolekute snapshot jääb puutumata — inimese loetud teksti
  ei kirjutata tagantjärele ümber.

Kandja lõik tuleb liidesesse ja serveri tõendisse SAMAST võtmest, muidu loeks inimene üht
teksti ja tema nõusolekukirjesse jääks teine.

Väravad: `npm test` **3794/3794** · `i18n:check` OK · eslint puhas. **Negatiivkontroll:
4 uut testi 5-st kukub vana teostuse peal** (viies on regressioonivalve). Fake-DB-st on
`callRecordingConsent` MEELEGA eemaldatud: kui mõni rada saajaid ikka nõusolekuridadest
loeb, kukub test kohe, mitte ei anna vaikselt vale rohelise.

**KATMATA:** kriteeriumi „HTTP-testid taotleja, nõustunu, tagasivõtnu, lahkunu ja
mitteliikme kohta" ei ole tehtud. Valitud lepingu all on nende viie vastus sama, mille
annab juba olemasolev `ownerId`-piir (omanik saab, ülejäänud neli ei saa) — st uut
ligipääsuteed, mille pärast neid rolle läbi käia, ei tekkinud. Tõendatud on saajate ring
ja nõusolekuteksti sisu, mitte HTTP-kihi läbisõit.

### SOL-CALL-08 — osalejapiir ja kõne algseis pole paralleelselt ega veasüstiga usaldusväärsed — P2

**Tõend.** `joinCall()` loeb osalejate arvu snapshotist ning teeb limiidikontrolli enne eraldi `ensureParticipant()` create'i (`lib/calls/service.js:1190-1203`). Unikaalindeks välistab ainult sama kasutaja topeltosaluse; kahe eri kasutaja samaaegne join viimasele kohale võib mõlemad läbi lasta. Kõne start loob ACTIVE `CallSession` rea, kirjutab seejärel eraldi providerRoomName'i ja alles kolmanda sammuna HOST osaluse (`:1114-1150`). Hilisema sammu vea korral jääb unikaalindeksiga aktiivne, kuid tühi/hostita kõne; järgmine start tagastab selle kohe ega paranda. Paralleelse starti kaotaja tagastab võitja kõne samuti alustajat osalejaks lisamata.

**Mõju.** Max-participants piir võib koormuse all ületuda. DB- või protsessitõrge võib jätta ruumi püsivalt aktiivse kõnega, mille providerRoomName on tühi või millel pole hosti; uued start-katsed taaskasutavad katkist seisu.

**Vastuvõtukriteerium.** Kõne loomine, providerRoomName ja host-osalus peavad olema üks taastatav DB-tehing/olekumasin. Liitumiskoht tuleb atomaarse loenduri/slotiga reserveerida. Päris DB testid peavad võistlema mitme eri kasutaja viimase sloti pärast ning süstima vea pärast iga start-sammu.

**Seis (11.08.2026): DONE — koht võetakse kõneluku all, kõne sünnib ühes tehingus; `npm run call:seat:probe` 12/12 päris PostgreSQL-is. Commit `1f2df87c`.**

Kaks poolt, üks juur: otsus ja tema jälg olid eri sammud.

**Osalejapiir** on nüüd nõuandelukk, mitte loendus. Kogu otsus — kas kõne käib · kas ma
olen juba sees · kas ruumi on · osalusrida · koosseisu loendi kasvatus — elab ühe
kõnepõhise `pg_advisory_xact_lock`-i sees (sama muster nagu `lib/rooms/ownership.js`).
Loenduriveergu EI lisatud: see oleks teine tõde, mida tuleks sünkroonis hoida (sama
argument, mis SOL-DOC-07 loenduriveerul ja SOL-ROOM-07 saajate-veerul). `rosterVersion`
kasvab samas tehingus, sest SOL-CALL-02 fencing eeldab, et uus koosseis ja tema number
muutuvad nähtavaks korraga.

**Kõne algseis** sündis kolmes sammus (`create` tühja nimega → nimekirjutus → HOST). Nüüd
genereerime id ise, providerinimi on temast tuletatav ja kõik käib ühe tehinguga. Toodangus
juba tekkinud tühi nimi parandatakse esimesel puutumisel (start ja join); hostita kõne
paraneb ise, sest join annab alustajale HOST-rolli. Parandus tagastab tõrke korral
ORIGINAALI — mälus paikneva nime tagastamine annaks kutsujale nime, mida andmebaasis ei
ole, ja liitumistokenid läheksid lahku.

Sond mõõdab kriteeriumi mõlemat poolt. Võistlus on **deterministlik**: kolmas tehing hoiab
sama nõuandelukku ja MÕÕDETAKSE, et mõlemad liitujad ootavad, alles siis lastakse lukk
lahti. Vea süstimine start-sammule on tõendatud andmebaasi enda tagasipööramisega, mitte
mudeliga. **Negatiivkontroll on vana jada transkriptsioon** (loe arv → loo rida ilma
lukuta) ja ta laseb mõlemad sisse: osalejaid 3, piir 2.

**Fake-Prisma sai kolm puuduvat omadust ja igaüks neist peitis midagi:** `$transaction`
andis tehingusse VÄRSKE TÜHJA andmebaasi (iga tehingusse kolinud koht oleks testis
„töötanud" täpselt vastupidiselt sellele, mida ta päriselt teeb) · tagasipööramist ei olnud
üldse · nõuandelukku ei olnud, seega kahe liituja võidujooks oleks fake'i peal olnud PÄRIS
võidujooks. Tõmmis võetakse laisalt, esimese kirjutuse peale — tehingu alguses võetud
tõmmis tegi vaikselt katki paralleeltesti, sest kaotaja tagasipööramine kustutas ka võitja
rea.

Väravad: `npm test` **3799/3799** (Europe/Tallinn ja UTC) · eslint puhas.
**Negatiivkontroll `npm test`-is: 3 uut testi 5-st kukub vana teostuse peal** (kaks on
regressioonivalve, mis peabki mõlemal pool roheline olema).

**KATMATA:** kriteerium nõuab vea süstimist „pärast IGA start-sammu". Tõendatud on
tehingu tagasipööramine (üks samm ei saa enam teisest lahku minna) ja tühja providerinime
parandus, mitte iga sammu eraldi veasüst — kolmesammulist jada ei ole enam olemas, mille
sammude vahele süstida.

### SOL-CALL-09 — kõnesalvestuse audit on best-effort ja võib vaikides puududa — P2

**Tõend.** Kõik REQUESTED/CONSENTED/DECLINED/WITHDRAWN/STARTED/STOPPED/DISCARDED/DELETED auditid kasutavad `writeRecordingAudit()`, mis püüab `dataAuditLog.create()` vea kinni ja tagastab `null` (`lib/calls/service.js:444-459`). Ükski kutsuja tulemust ei kontrolli. Samal ajal võivad põhiseis, nõusolekusnapshot ja füüsiline helifail edukalt muutuda.

**Mõju.** Tundliku heli salvestamise loa, tagasivõtu, käivitamise ja kustutamise kohta võib kohustuslik tegevusjälg puududa, kuigi API kinnitas edu. Consent-rida säilitab osa tõendist, kuid ei asenda provider-start/stop/delete auditit.

**Vastuvõtukriteerium.** Õiguslikult nõutud auditisündmus peab kuuluma sama DB-tehingusse või püsivasse outbox'i; audititõrge ei tohi muutuda vaikseks `null`-iks. Veasüstetest peab katkestama iga elutsüklitoimingu auditikirjutuse ja tõendama rollback'i või retry-sündmuse.

**Seis (11.08.2026): DONE — jälg elab sama tehingu sees, mis tema otsus; `npm run call:audit:probe` 11/11 päris PostgreSQL-is. Commit `70d53835`.**

Kirje on nüüd kohustuslik ja `db` süstitav, seega kutsuja paneb ta SAMASSE tehingusse
seisumuutusega (sama muster nagu SOL-FIELD-03 `writeDataAudit` ja SOL-ROOM-05
omanikuvahetus). Puuduv `dataAuditLog` mudel ei ole enam vaikne pääs: tõend, mida ei saa
kirjutada, tähendab toimingut, mida ei tohi lõpetada. **Reegel ühe lausega: audititõrge ei
saa kunagi panna ebaõnnestunud toimingut õnnestunuks ega lasta õnnestunud toimingul minna
ilma tõendita.**

Tehingusse kolisid: taotluse sünd (rida + nõusolekuread + failirida + jälg) · iga
nõusolekuotsus koos koosseisuloendiga · tühistus · `STARTING → ACTIVE` üleminek ·
salvestise lõpetamine (dokument + failirida + lõppseis + jälg) · kõrvaldamine. **Käivituse
audititõrge langeb samasse harusse, kus DB enda tõrge** — egress peatatakse ja claim
vabastatakse, sest salvestamine, mille algusest ei saa kirjutada „algas", ei tohi jääda
käima. See on nõusolekupiir, mitte raamatupidamine.

Kaks kohta said nimelise erikohtlemise:

- **Kustutus.** Artefakt on jälje kirjutamise hetkeks juba kettalt kadunud, seega
  „ennista rida" tähendaks rida olematu faili kohta (sama piir, mille SOL-FIELD-03
  nimetas). Jälg läheb `purgeRecordingFile` uue `finalize`-hooki kaudu samasse tehingusse
  VIIMASE astmega: tõrge jätab rea `DELETE_PENDING`-iks ja sweep proovib uuesti — puuduv
  fail on siis ENOENT ehk õnnestumine ja jälg sünnib teisel katsel. Tõrge ja taasproov,
  mitte vaikne null.
- **Tõrke-annotatsioonid** (`*_STOP_UNCONFIRMED`, `TOO_LARGE`, `DELETE_FAILED`,
  `START_ABORTED_*`) kirjutavad seisu ja jälje samas tehingus, aga selle tehingu tõrge ei
  asenda kasutajale minevat ALGSET viga — muidu kaoks tema eest ära see, mis päriselt
  juhtus. Vaikne see rada ei ole: tõrge läheb serveri logisse ja toiming lõpeb niikuinii
  veaga ning korduskatsega. Püsiv `CALL_EGRESS_STOP` töökäsk kirjutatakse annotatsioonist
  VÄLJASPOOL, sest ilma temata ei otsiks keegi kinnitamata egress'i enam kunagi üles.

**Kõrvalleid, mida raportis ei olnud:** salvestise lõpetamine kirjutas neli asja järjest
(dokument → failirida → lõppseis → jälg) ja vahepealne tõrge võis jätta maha dokumendi,
millele ükski failirida ei viita. Nüüd langevad kõik neli kokku või mitte ükski.
`bumpRosterVersion` ei neela enam viga — kasvatamata jäänud loend tähendab, et SOL-CALL-02
fencing ei näe koosseisu muutust, ja selle leiu enda sõnadega „vale-negatiivne maksab
nõusolekuta salvestatud hääle".

Sond mõõdab kolme asja päris andmebaasi vastu: teenusekutse jätab maha KAKS rida (otsus +
jälg) · sama kuju tehing, mis kukub, ei jäta maha KUMBAGI (ka koosseisuloend ei liigu) ·
**negatiivkontroll näitab vana kuju tulemust** — otsus `WITHDRAWN`, jälgi 0.

**Fake sai tagasipööramise, mis EI ole jäme:** ennistus puudutab ainult tõmmise hetkel
olemas olnud ridu ja kustutab ainult need, mille SEE tehing lõi. Kaks korda tegi liiga lai
ennistus testid vaikselt valeks — paralleeltestis kustutas ta võitja rea ja P2002-testis
võõra tehingu commit'itud rea.

Väravad: `npm test` **3805/3805** (Europe/Tallinn ja UTC) · `i18n:check` OK · eslint puhas.
**Negatiivkontroll: kõik 6 uut testi kukuvad vana teostuse peal.**

**KATMATA:** sondi negatiivkontroll on vana koodi TRANSKRIPTSIOON (kirjuta seis, siis neela
audititõrge), mitte vana kood — vana teostust ei ole enam olemas. Retention-sweep'i enda
kustutused (`purgeExpiredCallRecordings`) ei kirjuta auditit ei enne ega pärast; see ei ole
selle leiu loendis, aga ta on lahtine ots.

### SOL-CALL-10 — piiramatu kestusega salvestis loetakse finaliseerimisel tervikuna Node'i mällu — P1

**Tõend.** Kõnel ega salvestusel pole maksimaalse kestuse või failimahu serveripiiri; runtime-konfig määrab ainult providerid ja osalejate arvu (`lib/calls/service.js:54-65`, `:192-244`). Finaliseerimine ootab faili stabiilsust ning teeb seejärel `fs.readFile(sourcePath)`, arvutab hashi kogu Bufferi pealt ja kirjutab sama Bufferi teise faili (`lib/calls/recordingStorage.js:73-126`). `UserDocument` luuakse alles pärast seda ja salvestuskvooti enne egressi ega finaliseerimist ei kontrollita (`lib/calls/service.js:838-853`, `:953-1007`).

**Mõju.** Pikk helikõne võib tekitada suure egress-faili, mille lõpetamine hõivab korraga kogu faili jagu või rohkem Node'i mälu ja võib frontend-protsessi OOM-iga lõpetada. Salvestised võivad ületada kasutaja salvestuspaketi piiri ning protsessi crash jätab egress/DB oleku pooleli.

**Vastuvõtukriteerium.** Jõustada maksimaalne kestus ja maht provideris ning serveris; checksum ja kopeerimine peavad olema streamivad. Enne salvestamist tuleb reserveerida ohutu salvestusmaht või kasutada selget eraldi kvooti ning commit'ida tegelik maht. Suure fixture'i test peab jälgima mälulage, automaatset stoppi, kvooti ja veajärgset koristust.

**Seis (10.08.2026): DONE — kolm piiri, kus enne oli null. Commit `446932e6`.**

**1. Voog.** `readFile` + `writeFile` asemel `pipeline`, mis hashib ja kopeerib ühe
käiguga. Mälus on korraga üks tükk, seega mälukulu ei sõltu enam salvestise pikkusest.
Suurus loetakse kokku voost, mitte `stat`-ist: kui fail on lugemise ajal kasvanud, on tõde
see, mille me päriselt kirjutasime. Katkestusel kustutatakse poolik sihtfail (ta näeks
muidu välja nagu salvestis); allikas jääb alles. **Mahulagi on teadlikult ÜKS mehhanism** —
`stat`-värav enne lugemist oleks teine teostus sama reegli jaoks ja tema kõrval ei
käivituks voo pool kunagi, st ta oleks tõendamatu.

**2. Kestus.** LiveKit'i egress ei tunne „maksimaalset kestust" — see on tema piir, mitte
meie valik, ja seepärast EI OLE „provideris jõustamine" kriteeriumi selles osas
teostatav. Asendus on `stopOverdueRecordings()`: sweep valib üle lae läinud ACTIVE
salvestused ja peatab nad **täpselt sama teed pidi nagu inimese vajutatud stopp** (sama
provider-kinnitus, sama finaliseerimine, sama audit), tegijaks taotluse esitaja. Eraldi
audit `CALL_RECORDING_AUTO_STOPPED`. Elab retention-tsüklis, sest see on ainus töökäik,
mis toodangus juba kindlalt käib. **Latents on ausalt selle tsükli sagedus** — ja just
sellepärast on mahulagi olemas eraldi, tema ei sõltu ajastusest.

**3. Kvoot.** Reserv käib enne providerit — ainus koht, kus keeldumine on veel odav ja
aus. Pärast salvestamist oleks valik „ületa kvoot" või „kustuta nõusolekuga saadud heli",
ja kumbki ei ole meie otsustada. Reserv on ülempiiri hinnang (kestuselagi × bitikiirus),
tegelik maht commit'itakse `fileSizeBytes`-ina.

Vaikeväärtused ei nõua ühtegi env-muutujat: **120 min · 50 MB · 32 kbps** (120 min ×
32 kbps ≈ 28,8 MB mahub ka kliendirolli 50 MB kvooti). Häälestatavad
`RECORDING_MAX_DURATION_MINUTES`, `RECORDING_MAX_FILE_MB`,
`RECORDING_ESTIMATED_BITRATE_KBPS`; vigane väärtus ei võta piiri ära.

Väravad: `npm test` **3346/3346** (Europe/Tallinn ja UTC) · `i18n:check` roheline · eslint
puhas. **Negatiivkontroll: 7 uut testi 8-st kukub vana teostuse peal** (kaheksas on
regressioonivalve, mis peabki mõlemal pool roheline olema). Mälulagi on mõõdetud, mitte
väidetud: 24 MB fikstuur läbib finaliseerimise nii, et kuhi kasvab alla 8 MB.

**NOT_PROVEN:** päris LiveKit-egressiga ei ole ükski kolmest piirist läbi käidud — mock ei
kirjuta kettale tundide kaupa heli. Eraldi katmata on ka see, kas 32 kbps hinnang vastab
päris egress'i väljundile; kui ta on tegelikkusest väiksem, on reserv liiga optimistlik.

### SOL-CALL-11 — ebaõnnestunud LiveKit-liitumine võib jätta mikrofoni ja serveriosaluse aktiivseks — P1

**Tõend.** Serveri `/join` loob aktiivse `CallParticipant` rea enne tokeni tagastamist (`lib/calls/service.js:1190-1246`). Klient kutsub seejärel `connectLiveKit()`, mis salvestab Room-objekti ref'i, ühendub, loob kohaliku audiotrack'i ja publitseerib selle, kuid kogu jadal puudub sisemine catch/finally cleanup (`components/rooms/useRoomCall.js:158-221`). Kui connect, track creation või publish viskab, välimine start/join catch seab ainult errori (`:223-264`). `joinedCallIdRef` kirjutatakse alles pärast edukat `connectLiveKit()` lõppu (`:231-238`, `:252-259`), mistõttu teardown/pagehide ei saada ebaõnnestunud join'i kohta serverile leave'i. Juba loodud track'i ei stopita ja LiveKit Room'i ei disconnect'ita.

**Mõju.** Brauseri mikrofoni indikaator või isegi osaliselt ühendatud audiotrack võib pärast nähtavat liitumisviga aktiivseks jääda; server näeb kasutajat fantoomosalejana ja koht võib jääda hõivatuks. Viimase osaleja auto-end ei käivitu enne eraldi koristust.

**Vastuvõtukriteerium.** LiveKit connect/create/publish peab olema ühe fail-closed try/finally all: iga vea korral stopi track, disconnecti Room, nulli ref'id ning kutsu serveri leave'i sama callSessionId-ga. Liitumis-ID tuleb säilitada enne klientproviderit. Brauseritest peab süstima vea igasse kolme etappi ja kontrollima mikrofoni, LiveKit-ühendust ning DB osalust.

**Seis (10.08.2026): DONE — fail-closed connect, liitumis-ID enne providerit, serveri leave veakäsitluses; brauseri veasüstetest NOT_PROVEN.**

`connectLiveKit` on nüüd kest: kogu connect/create/publish elab `openLiveKitSession`-is ja
iga viga läheb läbi ühe `catch`-i, mis kutsub `cleanupLiveKit()` (stopib track'i,
disconnectib Room'i, nullib ref'id) ja viskab edasi. Teine pool on serveripoolne:
`joinedCallIdRef` kirjutatakse **enne** providerikutset ja uus `releaseFailedJoin()` on
ainus koht, kus ta maha võetakse — tema saadab ka `POST /leave` (ebaõnnestumisel beacon).
Sama rada katab `start()`, sest serveri `/start` lisab alustaja HOST-osalejaks juba enne
join'i; ilma selleta oleks ebaõnnestunud liitumine jätnud alles nii kõne kui hosti.

KATMATA: kriteerium nõuab **brauseritesti, mis süstib vea igasse kolme etappi**. Otsused on
kaetud `lib/calls/clientState.js` sviidiga ja juhtmestik tekstilepinguga
(`tests/calls/callLifecycleClient.test.js`); mõlemad kukuvad vana teostuse peal
(12/12 kontrolli, mõõdetud). Päris `getUserMedia`/`publishTrack` tõrget ei ole süstitud.
Commit `79d54db7`.

### SOL-CALL-12 — teise vahekaardi mute-nupp võib näidata mikrofoni väljas, kuigi heli läheb edasi — P0

**Tõend.** Hook tagastab `joined: joined || Boolean(joinedParticipant)`, seega teises vahekaardis serverisse loodud sama kasutaja osalus paneb ka selles vahekaardis UI „liitunud” olekusse (`components/rooms/useRoomCall.js:431-437`). Mute-klikk kutsub lokaalset `audioTrackRef.current?.mute?.()` funktsiooni, mis selles vahekaardis on null ja seetõttu no-op, ning kirjutab seejärel ainult DB `micMuted` lipu (`:302-319`). Serveri `setMuted()` muudab üksnes `CallParticipant.micMuted` välja; ta ei juhi LiveKiti teise vahekaardi track'i (`lib/calls/service.js:1295-1307`). Poll kuvab sama lipu kõigile ning UI võib näidata „Mikrofon väljas”.

**Mõju.** Kasutaja vajutab nähtavat vaigistusnuppu ja platvorm kinnitab mikrofoni väljalülitamist, kuid teises vahekaardis publitseeritud tegelik audiotrack jätkab teistele osalejatele heli saatmist. See on otsene privaatsus- ja kasutajakontrolli rikkumine.

**Vastuvõtukriteerium.** UI peab eristama serveriosalust ja selle vahekaardi päris provider-ühendust; mute-nupp tohib olla aktiivne ainult track'i omavas kontekstis või peab käsk jõudma providerisse/teise tabi usaldusväärse kanali kaudu ja saama kinnituse. DB `micMuted` ei tohi olla autoriteet ilma provideritõendita. Kahe päris brauserikontekstiga test peab liituma tab A-s, mute'ima tab B-s ja mõõtma, et kaugosaleja audio päriselt lakkab või B ei paku valet nuppu.

**Seis (10.08.2026): DONE — track'i omanik on omaette tõde, nupp on kinni ilma temata, lipp läheb DB-sse alles track'i kinnituse järel; kahe brauserikontekstiga mõõtmine NOT_PROVEN.**

Valitud on kriteeriumi teine haru: **B ei paku valet nuppu**. Serveriosalus („olen kõnes")
ja selle vahekaardi provideriühendus („saan siit mikrofoni juhtida") on nüüd kaks eri
küsimust; otsus elab `lib/calls/clientState.js`-i `resolveMicControl()`-is, sest hooki sees
ei olnud tal ühtegi väravat. `audioOwner` läheb tõeseks alles **publitseerimise järel** ja
`cleanupLiveKit` võtab ta maha.

Kolm asja muutusid korraga, sest üksinda oleks igaüks neist poolik. Esiteks: kui see
vahekaart mikrofoni ei juhi, **ei kirjutata andmebaasi midagi** — vana kood tegi
`audioTrackRef.current?.mute?.()` `null`-i peal (vaikne no-op) ja kirjutas siis
`micMuted: true`. Teiseks: track peab pärast käsku **ise kinnitama** uut seisu
(`track.isMuted !== nextMuted` → tõrge), seega lipp on vastuse, mitte kavatsuse kirje.
Kolmandaks: pind võtab nupu kinni ja **ütleb põhjuse välja** kolmes keeles
(`calls.mic_control_other_tab` / `calls.mic_control_no_audio`) — kinni nupp ilma põhjuseta
oleks omaette viga. Mock-provideril jääb nupp alles: seal ei publitseeri brauser midagi ja
lipp ONGI kogu tõde.

Kaudne tagajärg, mis kriteeriumis eraldi ei seisa: kuna kirjutajaid on nüüd ainult üks —
track'i omav vahekaart —, on `CallParticipant.micMuted` esimest korda provideritagatud ka
**teiste osalejate** jaoks; varem võis teine vahekaart kirjutada sinna väite, mida keegi ei
jõustanud.

KATMATA: kriteeriumi mõõtmine („kaugosaleja audio päriselt lakkab") nõuab **kaht päris
brauserikonteksti LiveKiti vastu**. Arendusmasinal on provider `mock` — seal ei ole track'i,
mille kohta valetada, ja P0 stsenaariumi ei saa lokaalselt üldse reprodutseerida. Tõendatud
on otsus (8 testi negatiivkontrollidega) ja juhtmestik; **runtime jääb toodangu peale, deploy
järel**. Commit `79d54db7`.

### SOL-CALL-13 — vana ruumi kõneseisu vastus võib uue ruumi vaate ja ühenduse üle kirjutada — P1

**Tõend.** `useRoomCall.load()` fetchib roomId closure'i alusel ilma AbortController'i või generation-tokenita ning kirjutab alati `call`, `config` ja `canModerate` state'i (`components/rooms/useRoomCall.js:71-88`). Ruumivahetuse effect nullib state'i ja käivitab uue load'i, kuid cleanup ei katkesta vana fetch'i (`:111-129`). Kui vana vastuse callId erineb parajasti liitutud callId-st, võib see lisaks kutsuda `cleanupLiveKit()` ja katkestada uue ruumi päris ühenduse (`:79-84`).

**Mõju.** Ruumis B võidakse kuvada ruumi A osalejate/kõne/salvestuse olek või katkestada B heliühendus. Järgnevad nupud kasutavad B URL-i koos A callId-ga ja annavad eksitavaid vigu; osalejate nimede kuvamine vales ruumis on konfidentsiaalsusrisk.

**Vastuvõtukriteerium.** Iga load-vastus peab kandma ja kontrollima roomId/request-generation identiteeti ning eelmine fetch tuleb ruumivahetusel abortida. Vana vastus ei tohi kutsuda uue ühenduse cleanup'i. Deterministlik hook-test peab lahendama A vastuse pärast B ühenduse loomist ja kontrollima state'i, track'i ning serveriosalust.

**Seis (10.08.2026): DONE — põlvkond + ruumi identiteet, abort ruumivahetusel, cleanup aegunud vastuse käest ära võetud; hook-tasandi test NOT_PROVEN.**

Iga laadimine saab kasvava numbri **enne** päringut ja rakendamise otsus tehakse **pärast**
vastust: `shouldApplyCallSnapshot()` nõuab korraga uusimat põlvkonda JA sama ruumi.
Kaks tingimust, mitte üks — ainult numbrist ei piisa, sest ruumi vahetusel võib loendur
juhtumisi klappida. Ruumivahetus katkestab lennus päringu (`AbortController`) ja aegub tema
põlvkonna; abort üksi ei ole garantii, sest juba lahendunud `fetch` jõuab `then`-i ka pärast
`abort()`-i.

Kandev pool ei ole state, vaid **cleanup**: vana vastus ei kutsu enam `cleanupLiveKit()`-i
ühenduse peal, mida ta ei loonud. Sama küsimus on nüüd nimeline funktsioon
(`shouldReleaseLocalCall`) ja ta ütleb „ei" alati, kui me ise liitunud ei olnud.

KATMATA: kriteerium nõuab **deterministlikku hook-testi**, mis lahendab A vastuse pärast B
ühenduse loomist. Testijooksja ei renderda React-hooke (JSX-i ei transformita), seega on
otsus testitud puhta funktsioonina (4 testi, sh sama ruumi vanem poll) ja juhtmestik
tekstilepinguga. Commit `79d54db7`.

### SOL-INV-01 — sponsoreeritud liikmete 50 koha piir on eri kutsete paralleelvastuvõtul ületatav — P1

**Tõend.** Kutse vastuvõtt lukustab `FOR UPDATE` ainult konkreetse Invite rea. Sponsori mahtu kontrollib eraldi `roomMember.count()` ning liikmesus luuakse hiljem samas tehingus (`lib/invites/acceptInviteCore.js:51-60`, `:163-176`, `:227-252`). Kaks erinevat sama ruumi kutset lukustavad eri read, loevad mõlemad näiteks 49 aktiivset sponsoreeritud liiget ja lisavad mõlemad uue. Skeemis pole ruumipõhist slot'i/loendurit, mis `SPONSORED_MEMBER_LIMIT=50` piiri commit'il jõustaks.

**Mõju.** Organisatsiooni/hosti sponsorkulu ja lubatud osalejate arv võivad ületada lepingulise piiri; mõlemad vastuvõtud aktiveerivad kasutajale tellimuse ning hilisem lihtne rollback puudub.

**Vastuvõtukriteerium.** Sponsorkoht peab olema ruumipõhiselt atomaarne reservatsioon või serialiseeritud loendur samas tehingus. Päris PostgreSQLi test peab saatma vähemalt kaks eri kutset paralleelselt seisus 49/50 ning tõendama täpselt ühe liikmesuse ja ühe sponsoreeritud tellimuse aktiveerimise.

**Seis (11.08.2026): DONE — kogu liikmesuse otsus käib ruumiluku all; `npm run invite:seat:probe` 11/11 päris PostgreSQL-is. Commit `a32f4230`.**

Piiri ei saa jõustada unikaalindeksi ega tingimusliku kirjutusega: „aktiivseid
sponsoreeritud liikmeid on alla 50" ei ole ühegi ÜHE rea omadus. Seepärast on lahendus
serialiseerimine — kogu otsus (kas ma olen juba liige · kas kohti on · loo liikmesus ja
tellimus) ruumipõhise nõuandeluku all, **sama võtmega, mida kasutavad omanikuvahetus ja
lahkumine** (SOL-ROOM-04: omanik ja liikmesus on üks invariant). Loenduriveergu ruumile EI
lisatud — see oleks teine tõde, mida tuleks sünkroonis hoida (sama argument, mis
SOL-DOC-07 loenduriveerul ja SOL-CALL-08 osalejapiiril).

Lukk võetakse ENNE esimest liikmesuse lugemist, mitte alles loenduse ees: kolm küsimust on
üks otsus. Lukujärjekord on kutse → ruum; ruumiluku teised võtjad ei puutu `Invite` ridu,
seega tsüklit ei teki.

Sond kannab kriteeriumi sõna-sõnalt: kaks ERI kutset seisus 49/50, deterministlik võistlus
(kolmas tehing hoiab sama ruumiluku ja MÕÕDETAKSE, et mõlemad ootavad) → täpselt üks
liikmesus, täpselt üks sponsoreeritud tellimus, täpselt üks kasutatud kutse.
**Negatiivkontroll on vana jada transkriptsioon ja ta annab 51/50.** Kaks lisakontrolli
mõõdavad, et piir ei muutunud liiga rangeks: viimane vaba koht antakse välja ja lahkunu
vabastab koha järgmisele.

Fake-tx sai mõõdetava `$executeRaw`-i — no-op lukk oleks tõendanud, et kood töötab ka ilma
lukuta.

**KATMATA:** `app/api/invites/sponsored/init` teeb enne checkout'i oma `hasSponsorCapacity`
kontrolli, mis on endiselt lukuta. See ei ole sama leid (seal ei teki liikmesust ega
tellimust, ainult makse algatus), aga tema tulemus võib olla aegunud selleks hetkeks, kui
makse laekub — sponsorkutse võib jõuda checkout'ist läbi ja seejärel vastuvõtul 409-ga
põrgata.

### SOL-INV-02 — kutse autoriseerimiseelne ruumisünk võib muuta teise kasutaja liikmerida — P2

**Tõend.** `requireRoomRole()` kutsub esmalt `ensureRoom()`, mis olemasoleva roomId korral teeb enne küsija rolli kontrolli `ensureOwnerMembership(room.id, room.ownerId, ownerDisplayName)` (`app/api/invites/route.js:145-181`, `:230-267`). Helper upsert'ib tegeliku omaniku liikmerea rolliks OWNER, seab `leftAt:null` ja võib kirjutada küsija payload'ist tulnud displayName'i (`:145-165`). Alles pärast seda kontrollitakse, kas küsija ise on omanik või lubatud rollis. Seega ruumi ID-d teadev mitteliige või MEMBER võib keelatud POST-i kaudu enne 403 vastust omaniku nime muuta või lõpetatud omaniku liikmesuse taasaktiveerida.

**Mõju.** Keelatud päring ei ole kõrvalmõjuta: see saab rikkuda omaniku kuvatavat identiteeti ja elutsüklit. Kui owner-liikmesus oli teadlikult lõpetatud/koristatud, võib rida uuesti aktiivseks muutuda ning liikmeloend/audit ei selgita põhjust.

**Vastuvõtukriteerium.** Kõik owner/membership parandused peavad toimuma alles pärast küsija autoriseerimist ning kasutama serverist tuletatud omaniku profiili, mitte võõra payload'i displayName'i. Negatiivne route-test peab võrdlema DB seisu enne ja pärast mitteliikme/MEMBER-i GET ja POST päringut ning nõudma null kõrvalmõju.

**Seis (11.08.2026): DONE — keelatud päring on kõrvalmõjuta, parandus käib autoriseerimise järel ja nimi tuleb serverist. Commit `c8048127`.**

Kolm reeglit, üks koht (`lib/invites/roomAccess.js`):

1. **Lugemine ei kirjuta.** Olemasoleva ruumi haru ei puutu ühtki rida.
2. **Parandus käib autoriseerimise JÄREL** ja ainult siis, kui küsija ise on ruumi omanik.
   Võõra rea „parandamine" ei ole selle voo töö.
3. **Nimi tuleb serverist** — omaniku enda profiilist — ja OLEMASOLEVAT nime ei kirjutata
   üle: inimese enda valitud nimi ei ole hooldusraja otsustada. Küsija enda nime
   (`host_display_name`) kirjutab marsruut ise oma reale, pärast autoriseerimist, nagu
   varemgi. E-posti liikmeloendisse ei kirjutata — see on teistele nähtav väli.

**SAMA VIGA ELAS KAHES KOOPIAS.** Raport nimetas ainult `app/api/invites/route.js`-i, aga
`app/api/invites/sponsored/init` kandis sama koodi sama defektiga. Mõlemad käivad nüüd
ühest väravast. **Sellega jõuab sponsoreeritud rajale esimest korda ka SOL-ROOM-01
arhiivikontroll**, mis oli olemas ainult teises koopias: lõpetatud ruumi ei saa nüüd ka
sponsorkutsega täiendada.

Testid mõõdavad seda, mida päring ENDAST maha jättis: iga kirjutus läheb `writes`
massiivi ja keelatud päringu järel peab ta olema tühi. Üks test otsib payload'i nime
kõigist kirjutustest TEKSTINA — nii ei aita ka mõni tulevane kaudne rada teda omaniku
reale tagasi.

Väravad: `npm test` **3816/3816** · eslint puhas. **Negatiivkontroll: 5 uut testi 8-st
kukub vana kuju peal** (kolm on regressioonivalve: arhiivikontroll, värske ruum,
profiilita omanik).

**KATMATA:** kriteerium nimetab route-testi. Testid käivad jagatud värava vastu, mitte
HTTP kaudu — ruumivärav on nüüd moodul, mille mõlemad marsruudid ainult kutsuvad
(tekstileping `tests/rooms/accessGuard.test.js`-is nõuab seda), aga marsruudi enda
läbisõitu päris sessiooniga ei ole tehtud.

### SOL-INV-03 — e-kirja saatmise viga tagastab kutse loomise edukana ja kaotab esmase tokeni kasutajateelt — P2

**Tõend.** Tavaline invite POST loob SENT kutse ja toortokeni esmalt DB-s, seejärel püüab `sendInviteEmail()` vea kinni ainult logiga ning jätkab (`app/api/invites/route.js:519-558`). Eduvastusest eemaldatakse toortoken (`:560-564`), nii et kasutaja ei saa ebaõnnestunud kirja linki käsitsi edastada. Kutse jääb SENT olekusse ning UI saab vea avastada ainult siis, kui kasutaja ise hiljem resend'i proovib; algvastus ei sisalda delivery staatust.

**Mõju.** Kasutajale öeldakse, et kutse loodi, kuid saaja ei saa liitumislinki ning saatja ei näe põhjust. Mitme e-posti batch'is võivad mõned kirjad jõuda ja teised mitte, kuid vastus raporteerib kõik ühetaoliselt edukana.

**Vastuvõtukriteerium.** Kutsel peab olema püsiv delivery olek/outbox ja idempotentne resend; API peab tagastama iga adressaadi `queued/sent/failed` tulemuse ilma toortokenit logimata. Mailer-veasüstetest peab tõendama nähtava osalise vea ja taastuva sama kutse saatmise, mitte uue kutse loomise.

**Seis (11.08.2026): DONE — püsiv järjekord + aus vastus + idempotentne kordus; `npm run invite:mail:probe` 16/16 päris PostgreSQL-is ja päris workeriga. Commit `b7af4ec0`.**

Kaks asja, mis üksinda kumbki ei piisa:

- **PÜSIV OLEK.** Iga kutse-kiri läheb enne saatmist `PaymentEmailOutbox`-i — samasse
  järjekorda, mida kordussaatmine juba kasutas. Rida ON delivery olek: `PENDING` = kohale
  toimetamata, `SENT` = kinnitatud. Idempotentsus tuleb `dedupeKey`-st, mis kannab kutse
  id-d ja TOKENI RÄSI, mitte toortokenit.
- **AUS VASTUS.** Kohene katse tehakse ikka (inimene ootab kirja kohe, mitte kolme minuti
  pärast), aga tema tulemus öeldakse iga adressaadi kohta välja: `sent` · `queued` ·
  `failed`. Liides ei ütle enam tingimusteta „Kutsed saadetud" — jõudmata jäänud aadressid
  on nimeliselt kirjas, kolmes keeles.

**Kordussaatmine käib nüüd sama teed.** Varem läks ta AINULT järjekorda ja vastas alati
`ok: true`, seega „saatsin uuesti" oli kavatsuse, mitte tulemuse kirjeldus. Kutse ise jääb
sama — uut kutset ei looda, mida kriteerium eraldi nõudis.

**Kirja SISU renderdatakse ühest kohast** (`renderInviteOutboxEmail`): kohene saatmine ja
taasproov ehitasid enne kaks eri teostust sama kirja jaoks ja need oleksid lahknenud
esimese muudatusega.

**Mõõdetud serverist, mitte eeldatud:** `sotsiaalai-payment-emails.timer` on toodangus
`enabled` + `active` (iga ~3 min), seega see järjekord ei ole surnud postkast ja `queued`
on lubadus, mille keegi täidab. Ilma selle kontrollita oleks kogu parandus võinud
tähendada „kiri ei lähe kunagi välja, aga me ütleme selle kohta ilusa sõna".

Sond käib kogu ahela läbi PÄRIS workeriga: kukkunud saatmine jätab püsiva `PENDING` rea
kutse küljes → worker leiab ta üles ja saadab päris liitumislingiga → teine jooks ei saada
teist kirja → kinnitatud kohene saatmine võtab rea workeri käest ära. **Sond pargib võõrad
järjekorraread tunniks ette ja paneb `finally`-s täpselt tagasi** — ta ei tohi kellegi
teise kirja oma stub-mailer'iga „ära saata".

Väravad: `npm test` **3824/3824** (Europe/Tallinn ja UTC) · `i18n:check` OK · eslint puhas.
**Negatiivkontroll: 7 uut testi 8-st kukub vana kuju peal.**

**KATMATA:** negatiivkontroll on transkriptsioon, sest vanal teostusel ei olnud
moodulipiiri, mille vastu jooksutada (sama aus piir nagu SOL-FIELD-04-l). Sponsoreeritud
kutse (`invite_sponsored`) käis outbox'i kaudu juba varem ja tema vastus ei kanna veel
delivery seisu — ta ei kuulunud selle leiu tõendisse.

### SOL-AUTH-03 — konto taastamise ja e-posti kinnitamise bearer-tokenid on andmebaasis toorkujul — P1

**Tõend.** `VerificationToken.token` on skeemis unikaalne toorstring, mitte räsi (`prisma/schema.prisma:908-914`). Parooli taastamise route genereerib tokeni ning kirjutab sama väärtuse otse sellesse välja (`app/api/auth/password/reset/route.js:166-176`); registreerimine ja kinnituskirja kordussaatmine teevad sama (`app/api/register/route.js:320-330`, `app/api/verify-email/route.js:632-642`). Tarbimine otsib samuti URL-ist saadud toortokenit otse (`lib/auth/passwordResetLifecycle.js:51-58`, `app/api/verify-email/route.js:335-383`). Kõrval olev e-posti vahetuse mudel näitab turvalisemat olemasolevat mustrit: `PendingEmailChange` säilitab ainult SHA-256 `tokenHash` väärtuse (`lib/profile/emailChange.js:25-38`, `prisma/schema.prisma:916-925`).

**Mõju.** Andmebaasi lugemisõigus, varukoopia-, dump- või diagnostikaleke annab aktiivse paroolitaastuse toortokeniga otsese konto ülevõtmise võimaluse; e-posti kinnitustokeneid saab samuti kasutaja eest tarbida. Tokenite aegumine vähendab akent, kuid andmebaasi väärtus ise on bearer-saladus.

**Vastuvõtukriteerium.** Kõik uued reset- ja verify-tokenid tuleb salvestada ühesuunalise räsi kujul ning toorväärtus peab eksisteerima ainult väljastatavas lingis; tarbimine räsib sisendi ja teeb atomaarse ühekordse claim'i. Migratsioon/üleminekuaken peab vanad toortokenid kontrollitult aeguma või eraldi pärandharus tarbima. Test peab tõendama, et DB-fixture ei sisalda kasutatavat linki ega toortokenit.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Väljastus ja rida on nüüd kaks eri asja.** Uus `lib/auth/verificationTokens.js`: `raw` läheb
  kirja, `stored` = `v2:` + sha256(raw) läheb ritta. Kolm väljastavat rada (paroolitaaste POST,
  registreerimine, kinnituskirja kordussaatmine) said sama primitiivi; ükski neist ei kirjuta enam
  toorväärtust. Veerg ise ei muutunud — `String @unique` kannab mõlemat kuju, seega skeemimuudatust
  ega migratsiooni ei ole.
- **Prefiks EI OLE dekoratsioon, vaid kogu üleminekumehhanism.** Enne muudatust kirjutatud read
  kannavad toorväärtust, seega tarbimine otsib ka verbatim — **aga ainult siis, kui sisend ei ole
  juba salvestuskujul**. Ilma selle väravata saaks andmebaasi lugeja kleepida rea väärtuse otse
  lingi asemele ja verbatim-haru võtaks ta vastu; see oleks kogu leiu tagasi toonud sama
  paranduse sees. Väravata varianti mõõdeti kõrvuti: naiivne haru **tunnistab** rea väärtuse
  lingiks, saadetav ei tunnista, ja päris link töötab mõlemas.
- **Pärandaken sulgub ise:** reset-token elab 60 min, verify-token 24 h. Kui
  `SELECT count(*) FROM "VerificationToken" WHERE token NOT LIKE 'v2:%'` on 0, saab verbatim-haru
  kustutada — see on kirjas mooduli enda kommentaaris, mitte ainult siin.
- **Tarbimine sai atomaarse ühekordse claim'i.** Vana rada luges rea, otsustas mälus ja kustutas
  alles tehingu LÕPUS `delete`-ga: kaotaja sai P2025 → kogu tehing tagasi ja kasutajale 500.
  Nüüd on `claimVerificationTokenRow()` (`deleteMany` + `count === 1`) tehingu ESIMENE lause ja
  tema tulemus otsustab; kaotaja ei kirjuta midagi ja saab ausa 400.
- **`npm run auth:token:probe` 26/26 päris PostgreSQL-is**, deterministliku lukuvõistlusega
  (`scripts/probe-race-harness.mjs`). Mõõdetud reast ENDAST, mitte fixture'ist: rida ei sisalda
  toorlinki · reast loetud väärtusega ei saa parooli vahetada ega ka võõrast linki ära põletada ·
  päris link töötab ja tühjendab kogu sessioonipinna · kaks samaaegset tarbimist → võidab täpselt
  üks. **Kaks negatiivkontrolli:** vana väljastusega rea väärtus **ON** töötav link (leke oli
  päris) ja vana claim-muster viskab samas võistluses kaotaja peal erindi (seega plokk 4 mõõtis
  päris võistlust, mitte kahte järjestikust kutset).
- Ühiktestid: `tests/auth/verificationTokens.test.js` (8 uut) + `tests/auth/passwordResetLifecycle.test.js`
  laiendatud 5 → 11. Fixture kannab nüüd räsitud kuju ja test „andmebaasis seisev väärtus ei ole
  kasutatav link" on see, mis naiivse teostuse peale punaseks läheb.
- **Kõrvalleid, mida raportis ei olnud:** konto kustutus tühjendas `VerificationToken` read ainult
  kahest nimeruumist (`<email>`, `email-verify:<email>`) — `password-reset:<email>` jäi välja,
  seega kustutatud konto jättis oma taastetokenid maha. Lisatud samasse loendisse.
- `runtime: not_run` päris kirja ja brauseri osas — sond käib teenusetasemel, päris SMTP-linki
  läbi ei klõpsatud.

### SOL-AUTH-04 — e-posti vahetuse lingi pelk avamine muudab konto identiteeti — P1

**Tõend.** Kinnituskiri osutab otse `/api/profile/email-change/confirm?token=...` aadressile (`app/api/profile/route.js:96-124`, kordussaatmisel `app/api/profile/email-change/route.js:59-84`). Selle marsruudi `GET` handler kutsub kohe `confirmEmailChangeByToken()` funktsiooni (`app/api/profile/email-change/confirm/route.js:127-163`), mis vahetab `User.email` välja, märgib aadressi kinnitatuks, suurendab sessiooniversiooni ning kustutab kõik sessioonipinnad (`lib/profile/emailChange.js:96-111`). Eraldi kasutaja kinnitavat POST-sammu pole. Sama projekti e-posti esmase kinnituse route kasutab just skannerikaitseks GET-vahelehte ja POST-vormi (`app/api/verify-email/route.js:128-151`, `:467-501`).

**Mõju.** E-posti turvaskanner, lingieelvaade, automaatne URL-kontroll või muu GET-prefetch võib konto aadressi kasutaja eest ära muuta ja kõik aktiivsed sessioonid lõpetada. Kasutaja võib näha linki juba kasutatuna või avastada identiteedimuudatuse ilma teadliku kinnitava tegevuseta.

**Vastuvõtukriteerium.** GET peab ainult valideerima üldise kujuga lingi ja kuvama kinnitava vahelehe; identiteedimuutus peab toimuma kasutaja algatatud POST-iga, turvalise PRG-jadaga. Skanneritest peab tegema GET-i ilma JS-i/vormi saatmiseta ja tõendama null DB-muutust, seejärel POST-i ning tõendama täpselt ühe vahetuse.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Lahendus oli koodibaasis olemas ja kasutamata.** `app/api/verify-email/route.js` kasutab juba
  aastaid sama skannerikaitset: GET annab vahelehe, mille peal on POST-vorm ja auto-submit skript.
  Päris brauser POST-ib kohe ise (kasutaja jaoks ei muutu midagi), skanner ja lingieelvaade
  JS-i ei käivita ega POST-i, JS-ita kasutajale jääb nähtav nupp. Sama muster on nüüd ka siin —
  uut mehhanismi ei ehitatud.
- **GET ei tee ühtki andmebaasipäringut**, mitte ainult ei kirjuta. Tokenit ei otsita üles:
  skanner ei tohi ka teada saada, kas link on ehtne. Identiteedimuutus elab `POST`-is.
- **Kolm uut tõlkevõtit** (`confirm_page.confirm_title`, `.confirming`, `.confirm_action`)
  kolmes keeles; `i18n:check` roheline.
- **Mõõdetud päris marsruudi ja päris andmebaasi vastu** (`npm run auth:emailchange:probe`):
  skanneri GET → e-post, sessiooniversioon ja ootel rida MUUTUMATUD, leht on vorm, mitte tulemus ·
  sama lingi POST → täpselt üks vahetus, `sessionVersion + 1`, ootel rida tarbitud ·
  kordus-POST ei muuda enam midagi. **Negatiivkontroll:** vana rada (GET kutsub kinnitust otse)
  **vahetab identiteedi pelgalt avamisel** — seega ülemine roheline on paranduse teene, mitte
  vigane token.
- `runtime: not_run` päris meiliskanneri osas — mõõdetud on „GET ilma vormita", mitte konkreetse
  turvatoote käitumine.

### SOL-AUTH-05 — asendatud e-posti vahetustoken võib pooleliolevas päringus siiski võita — P1

**Tõend.** Kinnitamine loeb pending-rea `tokenHash` järgi, teeb aegumise, kasutaja ja aadressikonflikti kontrollid väljaspool tehingut ning kannab tehingusse ainult rea `id` (`lib/profile/emailChange.js:64-94`). Tehing vahetab e-posti ja kustutab pending-rea tingimusteta selle ID järgi (`:96-111`). Uus muutmistaotlus või resend kasutab `upsert({where:{userId}})` ning kirjutab sama rea `tokenHash`, aadressi ja aegumise üle, säilitades rea ID (`:18-38`; resend `app/api/profile/email-change/route.js:115-129`). Jada „vana token loetakse → resend/asendus uuendab sama rida → vana päring jätkab” võimaldab vana snapshot'i aadressi kinnitada ja kustutada uue tokeni rea.

**Mõju.** Kasutaja poolt uuema taotlusega tühistatud/asendatud link ei ole tugevalt tühistatud. Hiline vana päring võib muuta konto valele varasemale aadressile, katkestada sessioonid ja muuta värske kinnituskirja kasutuks.

**Vastuvõtukriteerium.** Tokeni claim, aegumise kontroll, kasutaja/aadressi kontroll ja pending-rea tarbimine peavad olema üks lukustatud tehing ning update/delete peab nõudma sama `tokenHash`/versiooni, mida algselt loeti. Asendamine peab kasvatama monotonset versiooni. Päris DB paralleeltest peab peatama vana kinnituse pärast lugemist, tegema resend'i või uue aadressi taotluse ja tõendama, et vana commit ebaõnnestub ilma kasutaja või uue rea muutmiseta.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Kogu otsus kolis tehingusse ja rea lukk tuli lugemise ETTE.** Vana rada luges rea, tegi
  aegumise/kasutaja/konflikti kontrollid lukustamata hetkeseisu peal ja kandis tehingusse ainult
  rea `id`. Lukustamata rea kontroll mõõdab hetke, mis on möödas enne, kui ta jõuab otsustada —
  sama lause on juba SOL-PRE-02 ja SOL-ORG-05 all.
- **`id` EI OLE siin identiteet.** Rida on kasutaja kohta unikaalne, seega resend kirjutab
  tokeni SAMA rea peale ümber. Iga tarbimine on nüüd tingimuslik `deleteMany({ id, tokenHash })`
  ja tema `count` otsustab; vana `delete({ id })` oleks lasknud vananenud päringul kinnitada
  VANA aadressi ja hävitada värske tokeni rea.
- **Eraldi versiooniveergu ei tehtud ja see on teadlik.** `tokenHash` ise on versioon: ta on
  32-baidise juhusliku tokeni räsi, seega asendus muudab teda alati ja ABA on välistatud.
  Veerg oleks teine koht, mida sünkroonis hoida.
- **Rea lukk on süstitav** (`lockPendingRow`), sest ühiktestide fake-klient ei oska `$queryRaw`-d;
  vaikeväärtus on `SELECT … FOR UPDATE` ja test mõõdab, et lukk tuleb ENNE lugemist ja claim
  ENNE mõju.
- **`npm run auth:emailchange:probe` 27/27 päris PostgreSQL-is**, deterministliku lukuvõistlusega
  (`scripts/probe-race-harness.mjs`): resend vs pooleliolev kinnitus → vana token ei vaheta
  identiteeti, ei anna eduteadet, **värske token jääb alles ja töötab pärast seda**, lõppseis on
  VÄRSKE aadress. **Negatiivkontroll:** vana muster sama võistluse all vahetab aadressi VANA
  sihtmärgi peale JA hävitab värske tokeni — täpselt leiu kirjeldatud jada.
- Ühiktestid: `tests/profile/emailChange.test.js` 5 → 12, sh „asendatud token ei tohi võita" ja
  luku/claimi järjekord. `runtime: not_run` päris brauseri kahe akna osas.

### SOL-AUTH-06 — e-posti vahetuse resend tühistab vana lingi enne uue kirja kohaletoimetamist ja raporteerib mailerivea eduna — P2

**Tõend.** Resend kutsub esmalt `createPendingEmailChange()`, mis asendab ainsa pending-rea tokeni ja aegumise (`app/api/profile/email-change/route.js:115-129`, `lib/profile/emailChange.js:18-38`). Alles seejärel proovitakse uut kirja saata. Maileri viga püütakse ainult logiga kinni ning route tagastab ikkagi `ok:true` koos uue aegumisega (`app/api/profile/email-change/route.js:130-139`). Esialgne profiili PUT kasutab sama „pending edukas, kiri best-effort” lepingut (`app/api/profile/route.js:258-266`, `lib/profile/accountLifecycle.js:153-168`).

**Mõju.** Resend-nupu vajutus muudab varem kohale jõudnud ja veel kehtiva lingi kohe kasutuks. Kui uus kiri ei jõua, näitab UI siiski „uuesti saadetud”; kasutajal pole ühtegi töötavat linki ega delivery olekut ning ta saab taastuda ainult korduvate pimedate katsetega.

**Vastuvõtukriteerium.** Tokeni rotatsioon ja delivery vajavad outbox/olekumasinat: vana link jääb kehtima vähemalt kuni uue kirja tõendatud enqueue/saatmiseni või uus katse säilitab eraldi piiratud kattuva tokeni. API/UI peab eristama `queued/sent/failed`. Maileri veasüstetest peab tõendama, et false-success'i ei tule ja vähemalt üks varem väljastatud link jääb taastatavalt kasutatavaks.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja, outbox'i ei ehitatud.**
- **Parandus on JÄRJEKORD, mitte uus mehhanism.** `createPendingEmailChange` oli üks samm, mis
  tegi mõlemat korraga; nüüd on kaks — `prepareEmailChangeToken()` (sünkroonne, ei puuduta
  andmebaasi) ja `persistPendingEmailChange()` (ainus koht, kus varem väljastatud link sureb).
  Resend teeb nüüd **mint → SAADA → alles siis rotatsioon**. Kriteeriumi „vana link jääb kehtima
  vähemalt kuni uue kirja tõendatud saatmiseni" on täidetud selle järjekorraga; kattuvat teist
  tokenit ega outbox'i ei olnud vaja, seega ka migratsiooni ei ole.
- **Vale eduteade on kadunud.** Saatmise viga annab nüüd `502` + `profile.email_update.resend_failed`
  (`delivery: "failed"`) ja liides näitab seda; õnnestumine kannab `delivery: "sent"`.
- **Sama leping ka esmasel PUT-il** (`app/api/profile/route.js`), mille audit nimeliselt välja tõi:
  seal EI SAA saatmise viga muudatust tagasi keerata (samas päringus võis vahetuda PIN), aga
  vastus kannab nüüd `emailDelivery`-t ja liides ütleb ausalt „muudatus on kirjas, kirja ei
  õnnestunud saata — vajuta „Saada uuesti"". Kaks uut tõlkevõtit kolmes keeles.
- **`npm run auth:emailchange:probe`** mõõdab seda päris andmebaasi vastu võltsi saatjaga:
  saatmise vea järel jääb ritta VANA tokeniräsi, **vana link töötab päriselt edasi** (mõõdetud
  kinnitusrajal, mitte rea kuju järgi) ja kohale jõudmata uus token ei kehti kunagi.
  **Negatiivkontroll:** vana järjekord (rotatsioon enne saatmist) **tapab varem kohale jõudnud
  lingi** — ilma selleta ei tõendaks eelmine roheline midagi.
- **Aus piir:** „API/UI peab eristama `queued/sent/failed`" on täidetud kahe seisuga (`sent`,
  `failed`). `queued` eeldaks päris järjekorda, mida sellel rajal ei ole — kiri saadetakse
  sünkroonselt ja tulemus on teada kohe. `runtime: not_run` päris SMTP osas.

### SOL-AUTH-07 — profiili PIN-i muutus ei tühista enne muudatust väljastatud ajutisi sisselogimisvolitusi — P1

**Tõend.** Profiili PIN-i muutus kirjutab ainult uue `passwordHash` väärtuse ja suurendab `sessionVersion` välja (`lib/profile/accountLifecycle.js:171-181`); `LoginTempToken`, `EmailOtpCode`, `TrustedDevice` ja tracked `Session` ridu ei kustutata. Login-step1 loob pärast vana PIN-i edukat kontrolli `LoginTempToken` rea (`app/api/auth/login-step1/route.js:230-259`, `:321-327`). Mudelis pole credential/session-versiooni snapshot'i (`prisma/schema.prisma:1624-1643`) ning NextAuth tarbimine loeb tokeniga seotud kasutaja **praeguse** `sessionVersion` väärtuse ja väljastab selle uude sessiooni (`auth.js:182-229`). Võrdluseks paroolitaastus ja e-posti vahetus kustutavad samas tehingus temp-tokenid, OTP-d, usaldatud seadmed ja sessioonid (`lib/auth/passwordResetLifecycle.js:81-93`, `lib/profile/emailChange.js:96-110`).

**Mõju.** Vana PIN-i teadnud osapool võib alustada sisselogimist enne PIN-i vahetust, lõpetada OTP/e-posti kinnituse pärast vahetust ning saada uue, juba kasvatatud sessiooniversiooniga sessiooni. PIN-i vahetus näib kasutajale aktiivsed sessioonid tühistavat, kuid pooleliolev autentimisvolitus elab credential-rotatsiooni üle.

**Vastuvõtukriteerium.** PIN-i muutus peab ühes tehingus tühistama kõik `LoginTempToken` ja `EmailOtpCode` read ning vajadusel tracked sessioonid/usaldatud seadmed; alternatiivina peab temp-token kandma väljastamishetke credential-versiooni, mida tarbimisel võrreldakse. Integratsioonitest peab looma vana PIN-iga temp-tokeni, muutma PIN-i ja tõendama, et vana temp-token/OTP/email-link ei saa uut sessiooni luua.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Valitud on kriteeriumi esimene haru: PIN-i vahetus lõpetab kogu eelmise volituspinna.** Ühes
  tehingus koos uue `passwordHash`-iga kustutatakse `LoginTempToken`, `EmailOtpCode`,
  `TrustedDevice` ja `Session` read. Teine haru (temp-token kannab väljastamishetke
  credential-versiooni) oleks nõudnud uut veergu ja teist tõde, mida tuleks sünkroonis hoida.
- **Sama leping oli kõrval juba kaks korda olemas** — paroolitaaste (`passwordResetLifecycle`) ja
  e-posti vahetus (`emailChange`) tühjendavad täpselt need neli pinda. PIN-i vahetus oli ainus
  credential-rotatsioon, mis seda ei teinud; nüüd on üks reegel, mitte kolm.
- **Usaldatud seadmed lähevad kaasa ja see on teadlik.** PIN on esimene faktor; meelde jäetud
  seade on täpselt see, mis lubab tema valdajal teisest faktorist mööda minna. Hind on see, et
  kasutaja peab oma seadmed uuesti usaldama — sama hind, mis paroolitaastel juba on.
- **`npm run auth:attempt:probe` 19/19 päris PostgreSQL-is.** Tõend ei ole rea puudumine, vaid
  **NextAuthi päris credentials-provideri `authorize()` vastus**: enne vahetust annab vana katse
  sessiooni, pärast vahetust `null`. **Negatiivkontroll:** ainult `sessionVersion` kasvatamine
  (vana käitumine) jätab poolelioleva sisselogimise elama ja väljastab uue sessiooni **juba
  kasvatatud versiooniga** — täpselt leiu kirjeldatud rada.
- **Sond leidis ühe lõksu, mis oleks kogu tõendi tühjaks teinud:** `provider.authorize` on
  next-auth'i enda tühi vaikeväärtus (`() => null`) ja päris funktsioon elab
  `provider.options.authorize` all. Vale viide oleks andnud alati `null` ja „vana token ei saa
  sessiooni" oleks olnud triviaalselt roheline VALEL põhjusel. Kinni püüdis selle **baasjoone
  kontroll** („enne vahetust ANNAB"), mis on nüüd sondis nimeliselt sees.
- Ühiktest (`tests/profile/accountLifecycle.test.js`) mõõdab, et tühjendus jagab PIN-i kirjutuse
  tehingut ja et **tagasi lükatud PIN-i vahetus ei tühista mitte midagi**.
- `runtime: not_run` päris brauseri osas — mõõdetud on teenusetasand ja `authorize()`.

### SOL-AUTH-08 — kirjalinki automaatselt avav skanner võib ründaja PIN-sisselogimise teise faktori kinnitada — P1

**Tõend.** Pärast õiget PIN-i loob step1 kaks seotud saladust: brauserile antava `temp_login_token`-i ning e-kirja pandava `emailLinkToken`-i (`app/api/auth/login-step1/route.js:126-150`, `:321-356`). Kinnituslink osutab `GET /api/auth/login-confirm?token=...` teele (`lib/auth/login-email-link.js:20-25`). Selle GET-i ainus avamine teeb tingimusliku `updateMany`, seab `otpVerifiedAt` väärtuse ja nullib e-posti tokeni (`app/api/auth/login-confirm/route.js:247-273`). Algne brauser pollib seejärel staatust ja lõpetab sisselogimise automaatselt (`components/LoginModal.jsx:856-905`). Kasutaja kinnitavat POST-i ega inimese interaktsiooni ei nõuta; erinevalt esmase e-posti kinnituse route'ist puudub siin skannerikaitse.

**Mõju.** PIN-i teada saanud ründaja alustab oma brauseris sisselogimist. Kui sihtkasutaja meilivärav, turvaskanner või lingieelvaade GET-lingi automaatselt avab, muutub ründaja käes olev temp-token kinnitatuks ning tema brauser loob sessiooni ilma, et konto omanik oleks sisselogimist teadlikult heaks kiitnud. Teine faktor taandub sellises postkastis automaatseks server-to-server GET-iks.

**Vastuvõtukriteerium.** Kirja GET peab kuvama konteksti ja jätma DB muutmata; kinnitamine peab nõudma kasutaja teadlikku POST-toimingut või tugevat samasse algvoogu seotud challenge'i. Skanneritest peab GET-i tegema ilma vormi saatmata ning tõendama `otpVerifiedAt:null`; eraldi kasutajatoiming peab kinnitama täpselt ühe konkreetse login-attempt'i.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Muster oli koodibaasis olemas, uut ei ehitatud:** `verify-email` ja e-posti vahetuse
  kinnitus (SOL-AUTH-04) said juba GET = vaheleht, POST = otsus. Siin on ta **rangem kui
  seal: auto-submit'i EI OLE.** Auto-submit oleks skanneri vastu piisav, aga mitte selle leiu
  vastu — PIN-sisselogimist alustab RÜNDAJA oma brauseris ja kirja saab konto omanik, seega
  ohver ise võib lingi uudishimust avada. JS-i käivitav brauser kinnitaks tema eest sama vaikselt
  nagu skanner.
- **Kontekst on siin mehhanism, mitte kaunistus.** Vaheleht näitab seadet, algusaega ja IP-d
  (`summarizeUserAgent` + `formatSecurityEventTime` olid olemas, samad, mis uue seadme
  hoiatuskirjas). Ilma selleta oleks nupp „Kinnita" mõttetu: kasutaja ei tea, KELLE katset ta
  kinnitab. `createdAt`, `userAgent` ja `ipAddress` on `LoginTempToken`-il juba olemas, seega
  migratsiooni ei ole.
- **GET LOEB, aga ei kirjuta.** Kriteerium ütleb „jätma DB muutmata", mitte „puutumata" — ja
  konteksti ei saa näidata ilma lugemata. Kehtetu, aegunud, juba kinnitatud ja juba tarbitud
  link annavad kõik SAMA üldise vealehe **ilma kontekstita**, seega lugemine ei ava uut pinda.
- **Otsus kolis marsruudist välja** (`lib/auth/login-email-link.js`:
  `describeLoginEmailConfirmation` ja `confirmLoginEmailLink`) — sama põhjus mis
  SOL-AUTH-11-l: piir, mida ei saa testida, ei ole piir.
- **Hind on üks klikk ja see on teadlik.** Omaniku 28.07 vastuväide käis kinnituse-JÄRGSE kliki
  kohta („pidi veel käsitsi Ava SotsiaalAI vajutama") — see jääb lahendatuks: pärast POST-i
  töötab sama ootamis-, BroadcastChannel-handoff- ja automaatse suunamise loogika muutumatuna.
  Uus klikk on kinnitus ISE, ja e-kiri ütleb juba praegu „vajuta nuppu KINNITAN". Kolmes keeles
  täpsustatud ka `auth.login.otp_description`: „Ava kiri, vajuta linki ja kinnita avanenud lehel."
- **Rate-limitit siia teadlikult EI lisatud.** Naaber (`email-change/confirm`) piirab IP järgi,
  aga see on mälupõhine loendur, mille kohta SOL-AUTH-09 on veel lahtine leid — kolmas koopia
  samast nõrgast mehhanismist annaks siin ainult eksitava „link ei kehti" lehe. Piir, mis siin
  loeb, on tokeni entroopia (32 baiti) ja `login-step1` enda limiit.
- **`npm run auth:emaillink:probe` 27/27 päris PostgreSQL-is**, kutsudes marsruudi PÄRIS `GET`-i
  ja `POST`-i: skanneri GET jätab `otpVerifiedAt` nulliks ja lingi tarbimata · POST kinnitab
  täpselt selle ühe katse (teine katse jääb puutumata) · sama link teist korda annab 400.
  **Negatiivkontroll:** vana GET-rada kinnitab teise faktori pelgalt avamisel — rada oli päris.
- **Brauseris läbi käidud** (localhost, päris rida andmebaasis): vahelehel `scripts: 0` (ühtki
  skripti, seega ka mitte auto-submit'i), vorm `method="POST"` kahe peidetud väljaga, kontekst
  nähtav („Safari on iPhone", aeg, IP); nupuvajutuse järel „Sisenemine kinnitatud",
  `data-waiting="1"` ja poll-skript käivitub.
- `runtime: not_run` päris meiliskanneri (Gmail/Outlook eelvaade) ja päris PIN-akna
  läbiva voo osas — mõõdetud on marsruut, andmebaas ja kinnitusleht ise.

### SOL-AUTH-09 — lühikese PIN-i brute-force kaitse on protsessimälus ja kliendi IP-päiseid usaldav — P1

**Tõend.** PIN võib vaikimisi olla ainult neli numbrit (`lib/auth/pin-login.js:9-10`, `:52-53`). Step1 piirab küll IP-d ja e-posti, kuid kasutab üldist `consumeRateLimit()` helperit (`app/api/auth/login-step1/route.js:192-214`). Helper hoiab kõik bucket'id mooduli lokaalses `Map`-is, mis ei jagune instantside/protsesside vahel ja kaob restartimisel (`lib/rate-limit.js:1-31`). IP võetakse otse esimesest kliendi saadetud `x-real-ip`/`x-forwarded-for` väärtusest ilma usaldatud proxy piirita (`lib/auth/pin-login.js:92-101`; sama muster `lib/request-ip.js:6-14`).

**Mõju.** Mitme Next-protsessi/instantsi, rolling deploy või korduvate restartide korral saab sama konto katsete arvu korrutada; IP-piiri saab valesti seadistatud proxy taga päise muutmisega hajutada. Neljakohalise PIN-i 10 000 variandi puhul on serveripoolne püsiv, klastriülene konto-lukk põhiline kaitse, kuid praegune piir pole selline.

**Vastuvõtukriteerium.** PIN-katsete loendur peab olema atomaarne ja jagatud püsivas hoidlas, konto-/identiteedipõhise aeglustuse ning turvalise taastamisega; IP tuleb võtta ainult usaldatud edge-proxy normaliseeritud atribuudist. Test peab kasutama vähemalt kahte rakendusinstantsi ja restarti ning tõendama sama konto ühist limiiti; spoofitud forwarded-päis ei tohi uut bucket'it anda.

**Seis (11.08.2026): DONE. VAJAB MIGRATSIOONI** (`20260811210000`, uus tabel
`AuthThrottleCounter`; olemasolevaid ridu ei puudutata). **Vajab ka üht env-rida serveril —
vt allpool.**

- **Loendur elab nüüd andmebaasis** (`lib/auth/loginThrottle.js` + `AuthThrottleCounter`):
  `(scope, subject)` on unikaalne ja see unikaalsus ONgi limiit. Kirjutust serialiseerib
  kasutajapõhine nõuandelukk `4713` (kõrvuti AUTH-02 `4711` ja AUTH-11 `4712`-ga) ja ta tuleb
  **lugemise ETTE** — esimesel katsel rida veel ei ole, seega lukustada saab ainult võtit,
  mitte rida (`FOR UPDATE` siia ei sobi).
- **Subjekt on e-posti räsi, MITTE kasutaja ID, ja see on SOL-AUTH-10 osa.** Konto järgi käiv
  loendur lukustaks ainult olemasoleva konto — ja 429 ise oleks siis uus oraakel, mis ütleks
  ära, kas aadress on registreeritud. Räsi tähendab ühtlasi, et e-post ei seisa loenduri reas
  toorelt.
- **Aeglustus ja turvaline taastamine:** limiit (vaikimisi 8 katset 15 min kohta e-posti,
  40 IP kohta) ületamisel lukk 15 minutiks; lukust vabanemine alustab UUE akna, seega keegi
  ei jää igaveseks kinni; õnnestunud PIN kustutab loenduri. `pruneExpiredLoginThrottles()`
  koristab aegunud read.
- **IP tuleb ainult konfigureeritud edge-päisest** (`getTrustedRequestIp`,
  `TRUSTED_PROXY_IP_HEADER`) ja sealt **viimasest** väärtusest, sest usaldatud edge lisab enda
  nähtu loendi lõppu — esimene väärtus on täpselt see, mille klient ise kirjutas. Ilma
  seadistuseta on vastus `null` ja IP-piir jäetakse vahele: see EI ole „luba kõik", vaid
  „ära tee turvaotsust võltsitava sisendi peal" — brute-force'i vastu loeb identiteedipiir,
  mis on püsiv ja mida spoofitud päis ei puuduta.
- **Vana mälupõhine `consumeRateLimit` jäi teadlikult alles** odava eelväravana (ei puuduta
  andmebaasi), aga ta ei ole enam turvapiir ja see on koodis kommentaariga välja öeldud.
- **Otsus kolis marsruudist välja** (`lib/auth/pinLoginAttempt.js`), sest `login-step1`
  impordib `next/headers` ega lae testijooksjas ega sondis üldse — sama põhjus mis
  SOL-AUTH-08/-11-l. Marsruuti katab lähtekoodi leping.
- **`npm run auth:throttle:probe` 23/23 päris PostgreSQL-is**, sh **päris teine protsess**
  (`spawn`, kontrollitud pid): vanem kulutab 2 katset, teine instants saab ainult ülejäänud
  ühe, kolmas värskelt käivitunud instants ei saa ühtki. Kuus samaaegset katset limiidiga 3
  annavad **täpselt 3** lubatut. **Negatiivkontroll:** sama laps vana mälupõhise loenduriga
  annab IGALE instantsile oma täie limiidi — see on leiu enda mehhanism.
- **Brauseris läbi käidud päris HTTP rajal**: 9. katse annab 429 ja ka ÕIGE PIN saab pärast
  lukustust 429 (lukk ei ole PIN-i kontrolli tagajärg, vaid tema eeltingimus).
- **Deploy'l on üks käsitsi samm:** `TRUSTED_PROXY_IP_HEADER=x-real-ip` tuleb lisada serveri
  `.env`-i (nginx seab `proxy_set_header X-Real-IP $remote_addr`). Ilma selleta töötab
  e-posti-põhine piir, aga IP-põhine jääb välja — teadlikult, sest võltsitava päise peal
  IP-piir ei ole piir.
- **Jääk, mida see parandus EI lahenda:** ründaja saab võõra konto sihilikult 15 minutiks
  lukustada. See on iga konto-lukustuse hind; alternatiiv (lukustus ainult IP kaupa) oleks
  täpselt see, mille leid ümber lükkab. Aken on lühike ja lukk ei nulli midagi püsivat.
- `runtime: not_run` mitme päris Next-instantsi (klastri) osas — kaks protsessi on tõendatud,
  aga mitte kaks `next start` protsessi koormustasakaalustaja taga.

### SOL-AUTH-10 — login-step1 avaldab, kas e-posti aadressiga konto eksisteerib — P2

**Tõend.** Süntaktiliselt sobiva tundmatu e-posti korral tagastab route `EMAIL_NOT_FOUND` (`app/api/auth/login-step1/route.js:230-245`), aga olemasoleva konto vale PIN annab `PIN_INCORRECT` (`:248-258`). Klient kasutab neid koode eraldi: tundmatu e-post märgitakse e-posti veana, vale PIN jäetakse „teadaoleva e-posti” voogu (`components/LoginModal.jsx:629-641`). Paroolitaastuse route kasutab samas olukorras teadlikult ühetaolist edu nii tundmatu kui olemasoleva kasutaja puhul (`app/api/auth/password/reset/route.js:160-191`).

**Mõju.** Automatiseeritud küsija saab koostada registreeritud klientide ja spetsialistide e-posti loendi. Sotsiaaltööplatvormi liikmelisus ise võib olla tundlik ning kinnitatud kontoloend parandab phishing'u, PIN-brute-force'i ja sihitud rünnete täpsust.

**Vastuvõtukriteerium.** Avalik vastus, staatus, kood ja võimalikult ka ajastus peavad tundmatu konto ning vale PIN-i korral olema võrreldavad; täpne põhjus võib jääda ainult turvalisse serverilogisse. Negatiivtest peab võrdlema mõlemat rada ning kasutajaliides peab näitama ühist credential-viga.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja** (tuli koos SOL-AUTH-09 plokiga, mille
oma migratsioon on `20260811210000`).

- **Kolm eri vastust said üheks.** `EMAIL_NOT_FOUND` (400 ja 401) ning `PIN_INCORRECT`
  asendas üks `INVALID_CREDENTIALS` 401 ühe sõnumiga („E-posti aadress või PIN ei ole õige.",
  kolmes keeles). Sama vastuse saavad nüüd ka **peatatud konto** ja **kontod ilma PIN-ita** —
  varem oli neil oma rada.
- **Ajastus on osa vastusest ja seda ei saanud koodiga üksi lahendada.** Bcrypt cost 12 võtab
  ~200 ms; tundmatu konto rada ei kutsunud teda üldse, seega vastus tuli kordades kiiremini ja
  lekitas konto puudumise ka siis, kui iga sõna oleks olnud identne. Nüüd jookseb bcrypt
  **alati**, tundmatul kontol peibutusräsi vastu, mille cost on sama, mis päris PIN-idel
  (`register`, `passwordResetLifecycle`, `accountLifecycle` — kõik 12).
- **Liidese pool suleti samuti:** `LoginModal` märkis `EMAIL_NOT_FOUND` peale e-posti välja
  punaseks ja `PIN_INCORRECT` peale mitte — see eristus oli serveri oraakli nähtav ots.
  `rememberKnownEmail` kutsutakse nüüd mõlemal rajal, muidu oleks eeltäitmine ise oraakel.
- **Lukustus ei tohtinud saada uueks oraakliks** ja just see sidus leiu SOL-AUTH-09-ga:
  loenduri subjekt on e-posti räsi, mitte kasutaja ID, seega tundmatu aadress lukustub
  täpselt samamoodi.
- **`npm run auth:throttle:probe` 23/23 päris PostgreSQL-is**: vale PIN, tundmatu e-post ja
  peatatud konto annavad sama tulemuse; kuue katse jada on **märgi haaval identne** tuntud ja
  tundmatu aadressi vahel. **Negatiivkontroll ajastusele:** paljas `findUnique` ilma
  bcryptita on kordades kiirem kui katse ise — seega vahe, mille peibutusräsi ära kaotab, oli
  päris.
- **Brauseris mõõdetud päris HTTP kaudu** (kolm mõõtmist kummalgi rajal, pärast soojendust):
  tundmatu 440/442/413 ms · vale PIN olemasoleval kontol 441/437/436 ms · mõlemal
  `401 INVALID_CREDENTIALS` ja sama sõnum.
- **Aus piir:** `PIN_INVALID` (400) jäi eraldi vastuseks. See on vormiviga PIN-i kuju kohta,
  ei ütle konto kohta midagi ega kuluta katseid. Ajastuse ühtlustus on „võrreldav", mitte
  konstantne — võrgu- ja andmebaasimüra jääb alles; kriteerium ütleb „võimalikult ka
  ajastus".
- `runtime: not_run` päris serveri koormuse all — mõõdetud on lokaalne dev-server ja
  teenusetasand.

### SOL-AUTH-11 — üks kinnitatud temp-token võib enne sessiooni claim'i luua korduvalt usaldatud seadmeid — P2

**Tõend.** Step2 loeb temp-tokeni ja kontrollib `usedAt` väärtust väljaspool tehingut (`app/api/auth/login-step2/route.js:80-96`, `:143-153`). Kui `remember_device=true`, loeb ta aktiivsed seadmed, arvutab mälus väljatõstetavad read ja loob uue `TrustedDevice` rea (`:173-228`), kuid tehingu lõpus muudab ainult `otpVerifiedAt` ja `trustedDeviceId` välju — `usedAt` jääb nulliks (`:231-237`). Temp-token claim'itakse alles hilisemas NextAuth `authorize()` kutses CAS-iga (`auth.js:182-222`). Seetõttu saab sama toortokeniga enne `signIn`-i teha mitu step2 POST-i; paralleelsed POST-id võivad kõik lugeda sama seadmete arvu ning ületada ka limiidi.

**Mõju.** Kinnitatud login-attempt ei ole seadme usaldamise suhtes ühekordne. Temp-tokeni valdaja saab luua mitu püsivat teise faktori bypass-cookie't, sh paralleelselt rohkem kui konto limiit, isegi kui ainult üks lõplik sessioon tokeni ära tarbib.

**Vastuvõtukriteerium.** Temp-tokeni verifitseerimine, valikuline ühe seadme loomine ja sessiooniks claim'imine peavad moodustama ühe ühekordse state machine'i või eraldi CAS-etapid, kus sama attempt ei saa teist seadet väljastada. Seadmelimiit peab olema DB-s serialiseeritud. Paralleeltest peab saatma sama tokeniga mitu step2 päringut ning tõendama ühe cookie/rea ja ühe lõpliku sessiooni.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Otsus kolis marsruudist välja** (`lib/auth/loginAttemptVerification.js`), sest testijooksja ei
  saa marsruudi tehingut osadeks võtta — sama põhjus mis `lib/calls/clientState.js`-il
  (SOL-CALL-11…-13) ja `lib/chat/requestGeneration.js`-il (SOL-CHAT-12). Piir, mida ei saa
  testida, ei ole piir.
- **Kaks piiri, mõlemad andmebaasis.** (1) **Tingimuslik claim `trustedDeviceId: null` peal** teeb
  samast katsest ühekordse seadmeväljastaja; ta on tehingu sees, seega kaotaja loodud seaderida
  **rullub tagasi** — teda ei ole kunagi olnud. (2) **Kasutajapõhine nõuandelukk**
  (`TRUSTED_DEVICE_LOCK_NAMESPACE = 4712`, kõrvuti AUTH-02 sessiooniluku `4711`-ga) serialiseerib
  „loe seadmed → tõsta välja → loo uus" ka kahe ERI tokeni vahel — ilma temata oli limiit ainult
  lootus.
- **`usedAt` jäi teadlikult NextAuthi claim'ida.** Sessiooni loomine on eraldi samm ja tema CAS on
  `auth.js`-is olemas; step2 otsustab lõplikult ainult selle, mille ta ise väljastab. Kahe koha
  vahel jagatud „ühekordsus" oleks tähendanud, et step2 tarbib tokeni ära ja `signIn` ei saa enam
  sessiooni luua.
- **Üks kõrvalmõju sai teel parandatud:** vana kood kirjutas `trustedDeviceId` alati (ka `null`),
  seega hilisem `remember_device=false` kutse **võttis just väljastatud seadme küljest lahti** ja
  kustutas küpsise. Nüüd ei puuduta mittemäletav rada seda välja ega küpsist.
- **`npm run auth:attempt:probe` 19/19 päris PostgreSQL-is**, deterministliku lukuvõistlusega:
  sama katse kaks korda → **täpselt üks seade**, kaotaja saab nimelise claim-vea · täis limiidi
  juures kaks ERI katset paralleelselt → limiiti ei ületata. **Negatiivkontroll:** vana muster
  (loo seade, siis tingimusteta `update({ where: { id } })`) väljastab samast katsest **KAKS
  seadet**.
- Ühiktestid: `tests/auth/loginAttemptVerification.test.js` (6 uut). Fake modelleerib **päris
  rollback'i** — ilma selleta oleks „kaotaja seaderida rullub tagasi" roheline fake'i vastu, kus
  rollback'i ei ole (sama õppetund mis SOL-FIELD-03-l).
- `runtime: not_run` — päris kahe brauserivahekaardi rada on käimata; mõõdetud on teenusetasand.

### SOL-AUTH-12 — puuduva avaliku baas-URL-i korral saab login-kirja hosti päringupäisega mürgitada — P1

**Tõend.** `buildLoginConfirmUrl()` kasutab esmalt `resolveBaseUrl()` tulemust, kuid production'is puuduva `NEXTAUTH_URL`/`AUTH_URL`/`APP_URL`/`VERCEL_URL` korral langeb tagasi request'i `x-forwarded-host` või `host` ning `x-forwarded-proto` päisele (`lib/auth/login-email-link.js:6-24`, `lib/mailer.js:14-21`). Erinevalt parooli taastamisest ja e-posti vahetusest ei suleta voogu puuduva baaskonfiguratsiooni korral. Moodustatud URL saadetakse konto e-posti aadressile (`app/api/auth/login-step1/route.js:345-349`).

**Mõju.** Kui edge ei kirjuta neid päiseid rangelt üle ja baas-URL on puudu, saab õiget PIN-i teadev ründaja lasta kirja panna enda domeeniga kinnituslingi. Kasutaja või meiliskanneri avamisel jõuab bearer-token ründaja serverisse; ründaja saab selle päris confirm-route'ile esitada ja oma temp-tokeni kinnitada. See on konfiguratsioonivea korral teise faktori ülevõtmise rada.

**Vastuvõtukriteerium.** Production peab ilma allowlistitud kanoonilise avaliku originita fail-closed käivituma või login-maili saatmisest keelduma; turvatokeni URL-i ei tohi kunagi tuletada kliendi Host/Forwarded päisest. Konfiguratsiooni- ja host-header test peab tõendama, et võõras origin ei satu kirja ega redirecti.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Valitud on kriteeriumi teine haru: login-mailist keeldumine.** `buildLoginConfirmUrl` võtab
  origini AINULT `resolveBaseUrl()`-ist ja **viskab** `api.auth.login.base_url_missing`, kui
  konfiguratsiooni ei ole — täpselt nagu paroolitaaste (`buildResetUrl`) ja e-posti vahetus
  (`buildEmailChangeConfirmUrl`) juba teevad. Sisselogimise link oli ainus turvalink, mis
  puuduva baas-URL-i korral kliendi päise peale tagasi langes.
- **Parandus on ka STRUKTUURNE, mitte ainult tingimuslik:** `getRequestBaseUrl(request)` on
  kustutatud ja funktsiooni allkirjast kadus `request`. Päist, mida ei anta, ei saa usaldada —
  ja seda mõõdab test nimeliselt (`buildLoginConfirmUrl.length === 2` + lähtekoodi leping, et
  moodulis ei esine enam `x-forwarded-host`/`x-forwarded-proto`/`host`).
- **Fail-closed on terve rada, mitte üks funktsioon.** `login-step1`-s on kirja saatmine värav:
  viga läheb üldisesse catch'i, kasutaja saab 500 ja `LoginTempToken` jääb kinnitamata
  (`requiresOtp: true`, `otpVerifiedAt: null`), seega teist faktorit ei saa läbida. Ründaja
  domeeniga linki ei teki üheski harus.
- **Arendust see ei muuda:** `resolveBaseUrl()` annab `NODE_ENV=development` all
  `http://localhost:3000`, seega lokaalne voog käitub nagu enne.
- **`npm run auth:emaillink:probe`** katab selle ploki koos ülejäänud kahega (27/27): puuduv
  baas-URL keeldub lingi ehitamisest · origin tuleb konfiguratsioonist · funktsioon ei võta enam
  `request`-i. Ühiktest lisaks `tests/auth/loginEmailLink.test.js`-is.
- `runtime: not_run` päris tootmiskonfiguratsiooni osas — serveril on `NEXTAUTH_URL` olemas,
  seega leiu rada sai mõõdetud ainult tühjendatud keskkonnamuutujatega.

### SOL-AUTH-13 — login-lingi resend tühistab vana lingi enne uue kirja õnnestumist — P2

**Tõend.** Resend genereerib uue e-posti tokeni ja kirjutab selle räsi `LoginTempToken` reale enne maileri kutset (`app/api/auth/login-resend-otp/route.js:156-167`). Kui `sendLoginLinkEmail()` ebaõnnestub, jõuab route catch'i ja tagastab 500, kuid vana tokeniräsi on juba üle kirjutatud (`:175-179`); rollback'i ega vana räsi taastamist pole. Uus toortoken eksisteeris ainult ebaõnnestunud saatmiskutses.

**Mõju.** Kasutaja võib vajutada resend'i ajal, mil tal on juba üks kohale jõudnud kehtiv link; ajutine SMTP-viga muudab selle vana lingi kohe kasutuks ning uus link ei jõua kohale. Alles jääb PIN-i uuesti alustamine, kuigi UI näitab lihtsalt resend-tõrget.

**Vastuvõtukriteerium.** Uue tokeni aktiveerimine peab järgnema tõendatud enqueue/saatmisele või tokenitel peab olema lühike kontrollitud kattuvus ja püsiv delivery olek. Maileri veasüstetest peab tõendama, et vana link töötab edasi või et kasutajale antakse selge taastuv uus login-attempt.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Parandus on JÄRJEKORD ja ta oli kõrval juba olemas:** SOL-AUTH-06 lahendas sama asja
  e-posti vahetuse resend'is (mint → SAADA → alles siis rotatsioon). Uus
  `resendLoginEmailLink()` teeb siin sama: `prepareLoginEmailLink()` ei puuduta andmebaasi ja
  `persistLoginEmailLinkHash()` jookseb ALLES pärast õnnestunud tarnet. Rea peal olev räsi ON
  kehtiv link, seega tema ülekirjutamine on lingi pensioneerimine — ja see ei tohi juhtuda
  enne, kui asendus on teele läinud.
- **Vale eduteade oli osa leiust, seega tarnetõrget ei neelata:** route vastab **502**
  `DELIVERY_FAILED` ja tekst on kolmes keeles aus — „Varem saadetud link kehtib edasi — proovi
  mõne hetke pärast uuesti." Kasutaja ei pea enam PIN-i uuesti alustama.
- **Tõend ei ole räsi võrdlus, vaid kinnitus ise.** Sond nõuab, et pärast nurjunud resend'i
  läheks vana lingiga POST **päriselt läbi** (200 + `otpVerifiedAt` seatud), ja õnnestunud
  resend'i puhul mõõdab ta rida SAATMISE HETKEL: seal peab veel olema VANA räsi. **`npm run
  auth:emaillink:probe` 27/27**, negatiivkontroll: vana järjekord tapab kohale jõudnud lingi
  juba enne saatmiskatset.
- **Püsivat `delivery` olekuveergu teadlikult ei tehtud.** Kriteerium lubab „või" — vana link
  jääb kehtima, seega puuduv kiri ei ole enam ummiktee, ja `LoginTempToken` elab vaid
  `LOGIN_TEMP_LOGIN_MINUTES` (vaikimisi 15 min). Veerg oleks teine tõde, mida tuleks
  sünkroonis hoida.
- `runtime: not_run` päris SMTP osas — tarnetõrge on sondis ja ühiktestis süstitud.

### SOL-AUTH-14 — ühe seadme logout ei garanteeri kopeeritud JWT tühistamist — P1

**Tõend.** JWT seotakse jälgitava `Session` reaga ja iga järgmine JWT-kutse kontrollib rea olemasolu (`auth.js:111-125`, `:314-328`). Logout'i `signOut` event proovib selle rea kustutada, kuid neelab iga muu vea peale `P2025` ainult logides ning laseb väljalogimisel lõppeda (`auth.js:363-377`). Püsivat revoke-tööd, retry'd ega sessioonirea fail-closed märgistust pole.

**Mõju.** Kasutaja brauser kaotab küpsise ja näeb end välja logituna, kuid sama JWT varem kopeerinud või varastanud osapool saab DB kustutusvea järel jätkata kuni jälgitava rea/JWT aegumiseni. Turvatoimingu nähtav tulemus ja serveri revokatsioon võivad lahkneda.

**Vastuvõtukriteerium.** Logout peab siduma serveripoolse revokatsiooni kasutajale raporteeritava tulemusega või kirjutama enne küpsise eemaldamist püsiva retry'ga revoke-käsu. Véasüstetest peab sundima `Session.delete` vea ja tõendama, et vana JWT ei autoriseeri järgmist päringut või et kasutaja saab ausa taastatava vea.

**Seis (11.08.2026): DONE. Migratsiooni ei ole vaja.**
- **Valitud on kriteeriumi esimene haru: revokatsioon ja nähtav tulemus on üks asi.** Uus
  `POST /api/profile/logout` tühistab jälgitava sessiooni ja ütleb, kas see õnnestus;
  `ProfiilBody` kutsub `signOut()`-i — st eemaldab küpsise — **ainult eduka vastuse peale**.
  Teine haru (püsiv retry-käsk) oleks nõudnud uut tabelit ja teist tõde; siin on retry
  kasutaja enda järgmine vajutus.
- **Muster oli koodibaasis olemas ja kasutamata:** `POST /api/profile/logout-all` teeb juba
  täpselt sama — server teeb töö, klient kontrollib vastust, alles siis `signOut()`. Ühe
  seadme logout oli ainus väljalogimisrada, mis seda ei teinud.
- **`sessionRecordId` loetakse TOKENIST, mitte kliendi kehast.** Ta ei ole avalikus
  sessiooniobjektis; kliendi antud ID oleks olnud võõra sessiooni tühistamise tee.
- **`count === 0` tähendab kahte vastupidist asja ja neid ei tohi ühte lugeda:** rida oli
  juba läinud (soovitud lõppseis) või rida on olemas ja kuulub kellelegi teisele (siis ei ole
  midagi tühistatud → 409). Kustutus on tingimuslik (`{ id, userId }`), mitte mälus
  kontrollitud.
- **`auth.js` `signOut` event jääb varuvõrguks** nendele kutsujatele, kes kutsuvad
  `signOut()` otse (ruumi kliendi surnud-sessiooni rada), aga ta ei ole enam revokatsiooni
  põhirada. Teel sai ta ise kaks parandust: `delete({ where: { id } })` → `deleteMany` koos
  **omanikutingimusega**, ja `P2025` vaikimine kadus koos best-effort lepinguga.
- **`npm run auth:logout:probe` 14/14 päris PostgreSQL-is.** Tõend ei ole rea puudumine, vaid
  **`refreshTokenAuthorization()` vastus** — sama funktsioon, mille NextAuth igal JWT-kutsel
  jooksutab: enne väljalogimist AUTORISEERIB, pärast annab `SESSION_REVOKED`, ja teine seade
  jääb sisse. **Veasüst:** `session.deleteMany` viskab → viga jõuab kutsujani, rida jääb alles
  ja token autoriseerib edasi — see on AUS seis, mitte regressioon. **Kaks negatiivkontrolli
  vana raja koodiga:** ta raporteeris tõrke kiuste edu (ja token elas edasi) · ta kustutas
  võõra sessiooni ilma omanikku küsimata.
- **Brauseris läbi käidud päris sessiooniga** (dev-admin): `/api/profile/logout` →
  `{ ok: true, outcome: "revoked" }`, ja `/api/auth/session` annab pärast seda `null`
  **ilma et küpsist oleks eemaldatud** — täpselt see, mida leid nõudis. Uus marsruut on ka
  dev-serveri registris (`content-type: application/json`, mitte HTML 404).
- **Aus piir:** kui andmebaas on maas, ei saa kasutaja üldse välja logida. See on teadlik —
  alternatiiv on öelda „oled väljas", kui ta ei ole. `logout-all` on samal ajal sama katki,
  seega uut ummikteed juurde ei tekkinud.

### SOL-AUTH-15 — paralleelsed paroolitaaste päringud võivad mõlemad välja saadetud lingid tühistada — P2

**Tõend.** Iga reset-POST loob uue `VerificationToken` rea, saadab selle lingi ja alles pärast edukat saatmist kustutab sama identifikaatori kõik teised tokenid (`app/api/auth/password/reset/route.js:163-191`). Kahe paralleelse päringu jadas A:create → B:create → A:send → B:send → A:delete-not-A → B:delete-not-B kustutab A tokeni B ning B tokeni A; mõlemad route'id võivad siiski `ok:true` tagastada. Testid katavad üksiku tokeni tarbimist, mitte POST-route'i paralleelsust (`tests/auth/passwordResetLifecycle.test.js`).

**Mõju.** Kasutaja saab kaks näiliselt edukat taastamiskirja, kuid kumbki link ei pruugi töötada. Kordusvajutus või aeglane meilitarne võib muuta konto taastamise juhuslikult võimatuks.

**Vastuvõtukriteerium.** Sama e-posti reset-algatus peab olema serialiseeritud/idempotentne ning saatmise ja aktiivse tokeni seos püsivalt jälgitav. Paralleeltest peab käivitama kaks POST-i kõigi oluliste interleaving'utega ja tõendama, et vähemalt viimasena edukaks raporteeritud kiri sisaldab üht kehtivat tokenit.

**Seis (11.08.2026): DONE. Vajab migratsiooni** (`20260811220000`, uus tabel
`VerificationLinkDispatch`; olemasolevaid ridu ei puudutata).
- **Järjekord oli õige, omand puudus.** `mint → SAADA → alles siis rotatsioon` on sama leping,
  mille SOL-AUTH-06 ja -13 paika panid, ja teda ei muudetud. Vale oli sõna „ülejäänud":
  rotatsioon luges stale'iks ka selle tokeni, mille teine samaaegne päring oli just välja
  saatnud. Parandus ei ole uus järjekord, vaid see, et **mint ja saatmine on üks omand** —
  identifikaatoripõhise nõuandeluku (`4714`) all tehtud claim, mille jälg on
  `VerificationLinkDispatch` rida.
- **See rida ON kriteeriumi „püsivalt jälgitav seos":** `tokenValue` ütleb, milline token
  teele läks, ja rotatsioon tohib kustutada ainult neid, mille peale rida EI näita. Kui rida
  ei näita enam minu tokeni peale (`count === 0`), siis ma **ei rotreeri midagi** — sama
  lugemine mis SOL-AUTH-14-s: null tähendab kas „ma olen aegunud omanik" või „rida on üle
  võetud", ja kummalgi juhul ei ole teiste ridade kustutamine minu asi.
- **Teine samaaegne päring on idempotentne, mitte 409:** ta ei mindi ega saada midagi ja
  vastab `ok`-iga. Topeltklikk annab ühe kirja ühe kehtiva lingiga; see on kriteeriumi lubatud
  „serialiseeritud VÕI idempotentne" haru ja ainus, mis ei tekita kasutajale uut ummikteed.
- **Vananemisaken (2 min) on lepingu osa, mitte peidetud detail** — ilma temata lukustaks üks
  surnud saatja konto taastamise igaveseks (sama argument, mis SOL-DOC-06 claim'is). SMTP enda
  timeout on 15 s, seega aken on saatmise ülempiir.
- **Tarnetõrge ei kustuta minu tokenit.** „Viskas" ei tähenda „ei jõudnud kohale" — SMTP võib
  kirja vastu võtta ja alles siis timeout'ida, seega kustutamine tapaks lingi, mis on kasutaja
  postkastis. Vabastatakse ainult liisung, et kordus ei ootaks akent.
- **`npm run auth:reset:probe` 31/31 päris PostgreSQL-is.** Tõend ei ole rea olemasolu, vaid
  **sama marsruudi `PUT`** — see, mille kasutaja lingile klikkides käivitab — ja token loetakse
  sealt, kust kasutaja ta saab: VÄLJA SAADETUD KIRJAST (mailer on stub, ajastus on mõõteriist).
  Kaetud on kolm olulist interleaving'ut: tarne pooleli (üks kiri, üks kehtiv link),
  järjestikused POST-id (viimane kiri võidab, vana on rotreeritud) ja hüljatud liisungi
  ülevõtmine. **Negatiivkontroll jooksutab VANA rada samas harnessis sama andmebaasi vastu:**
  mõlemad päringud raporteerivad edu, mõlemad kirjad lähevad teele ja **andmebaasi ei jää
  ühtki tokenit** — kumbki link ei taasta kontot.
- **Kõrvalparandus:** puuduv baas-URL või saatja andis varem 500 ainult OLEMASOLEVALE kontole
  (olematu vastas `ok`-iga juba enne) — konfiguratsioonivea kujul oli see sama oraakel, mille
  SOL-AUTH-10 sulges. Kontroll käib nüüd ENNE kasutaja otsimist. Arendusmasinal, kus saatjat
  `.env`-is ei ole kunagi olnud, jääb kehtima endine vaikne rada.
- **Aus piir:** tarnetõrge jääb kasutaja jaoks `ok`-iks. Erinev vastus ütleks ära, et konto on
  olemas (SOL-AUTH-10), seega valitud on vaikimine — erinevalt SOL-AUTH-13-st, kus kasutaja on
  juba tuvastatud ja 502 ei leki midagi.
- `runtime: not_run` brauseri mõttes: marsruudi PÄRIS `POST` ja `PUT` on sondis päris
  andmebaasi vastu läbi käidud, aga dev-serverist läbi ei ole — kaustalukk hoiab teise
  sessiooni serverit ja **skeemimuudatuse järel kannab ta vana Prisma klienti**. Sama põhjus
  on ka operatiivne: uus tabel jõuab jooksvasse dev-serverisse alles taaskäivitusega.
- **Sama muster elas veel kahes kohas ja mõlemad on nüüd samal rajal.** `verify-email` resend
  ja registreerimine tegid identse `create → send → deleteMany(NOT mina)` paari — auditis neid
  ei ole, aga tagajärg oli sama: kaks paralleelset „saada uuesti" jätsid kasutaja ilma ühegi
  töötava kinnituslingita, ja konto jäi kinnitamata. Mõlemad kutsuvad nüüd
  `dispatchVerificationLink()`-i; kummagi veakäitumine jäi endiseks (verify-email annab tõrke
  edasi 500-na, register logib ja jätkab). Registreerimine ei mindi enam orbi tokenit, kui
  baas-URL puudub. **Sond mõõdab teist marsruuti eraldi jaamana** (`verify-email` kaks
  paralleelset POST-i → üks kiri, üks token, ja see ON kirjas välja läinud token), sest
  import üksi ei tõenda kasutust; leping on lukus ka ühiktestis, mis nõuab kõigilt kolmelt
  marsruudilt jagatud rada ja keelab neis rotatsioonimustri `NOT: { token }`.

### SOL-PAY-01 — kirjeldatud kordusmakse retry ei saa pärast esimest tõrget enam käivituda — P1

**Tõend.** Renewal-worker valib ainult `status: ACTIVE` tellimused, mille maksemeetod on `ACTIVE` (`lib/payments/recurring.js:132-143`, kasutus `app/api/jobs/subscription-renewals/route.js:96-116`). Esimese charge-vea catch muudab tellimuse `PAST_DUE`-ks ja maksemeetodi `FAILED`-iks, kuigi arvutab `nextRetryAt` ning retry-loenduri (`app/api/jobs/subscription-renewals/route.js:249-285`). Ka provider-webhooki FAILED/CANCELED rada muudab renewal-tellimuse `PAST_DUE`-ks (`app/api/subscription/webhook/route.js:581-607`). Ükski järgmine valik ei kaasa `PAST_DUE` tellimusi ega `FAILED` maksemeetodit, seega `SUBSCRIPTION_RENEWAL_MAX_RETRY_COUNT`, päevagraafik ja lõplik cancel ei jõua teise katseni. Test kontrollib ainult query kuju ja kuupäevaarvutust eraldi, mitte failure → järgmine worker-run jada (`tests/payments/recurringDue.test.js`).

**Mõju.** Üks ajutine võrgu-, provider- või kaarditõrge lõpetab tegeliku automaatse uuendamise pärast esimest katset. UI võib `willRetry=true` ja `nextRetryAt` kuvada, kuid server ei vali seda tellimust enam; maksja kaotab ligipääsu ja retry/cancel olekumasin jääb pooleli.

**Vastuvõtukriteerium.** Due-query peab valima lepinguga lubatud `PAST_DUE` retry-seisud ja kasutatava maksemeetodi või eristama provider-decline'i konfiguratsiooniveast; iga katse vajab CAS-claim'i ja järgmise katse püsivat aega. Jadakatse peab läbima vähemalt failure #1 → retry #2 → retry #3 → cancel ning eraldi recovery-success'i.

**Seis (11.08.2026): DONE — valik näeb korduskatse seisu ja maksemeetod märgitakse katkiseks alles loobumisel; `npm run pay:renewal:probe` 13/13 päris PostgreSQL-is. Commit `d988ef87`.**

Kaks muudatust, kumbki üksinda ei piisa:

- **VALIK on kaks haru** — tavaline tähtaeg (`ACTIVE`) ja lubatud korduskatse (`PAST_DUE`,
  mille katsete arv on lae all ja mille `nextBilling` kannab järgmise katse aega).
- **MAKSEMEETOD märgitakse `FAILED`-iks ALLES loobumisel.** Tagasi lükatud kaardimakse on
  tellimuse sündmus (`PAST_DUE` + loendur), mitte tõend, et meetod ise on katki — ja just
  see märge lukustas vana koodi enda korduskatse välja, sest valik nõuab kasutatavat
  meetodit. Otsuse kolm poolt (tellimuse seis, järgmise katse aeg, meetodi seis) tulevad
  nüüd ühest kohast (`planRenewalFailure`).

**Katse-claim** on endiselt `providerPaymentId` unikaalsus: viide kannab tsükli markerit ja
katse numbrit, seega kaks paralleelset jooksu ei saa sama katset kaks korda laadida.
**Konfiguratsiooniviga** (puuduv krüptovõti) oli juba eraldi rada ja jääb selleks — ta ei
puutu tellimuse seisu.

Sond ei kutsu providerit ega vaja teda: leid on VALIKUS, mitte laadimises. Ta kirjutab
täpselt need seisud, mille tõrkeharu kirjutab, ja küsib pärast igat sammu ANDMEBAASILT, kas
rida on valitav. **Negatiivkontroll: vana kuju (meetod `FAILED` esimese tõrke peale) võtab
rea valikust välja.** Vana ühiktest lukustas just selle vea
(`assert.equal(where.status, "ACTIVE")`) ja on ümber kirjutatud.

Väravad: `npm test` **3831/3831** · eslint puhas.

**KATMATA:** päris provideri tõrget (declined kaart, timeout) ei ole süstitud — jada on
tõendatud tõrkeharu KIRJUTATUD seisude pealt, mitte päris Maksekeskuse vastuse pealt.
Recurring on toodangus väljas (`SUBSCRIPTION_RECURRING_ENABLED`), seega päris jada saab
tõendada alles aktiveerimise järel.

### SOL-PAY-02 — ebamäärane provideritulemus märgitakse lõplikult FAILED-iks ja hilisem PAID webhook visatakse ära — P1

**Tõend.** Init-route loob provideri checkout'i ja teeb alles seejärel kohaliku Payment update'i; iga järgnev viga märgib olemasoleva makse `FAILED`-iks (`app/api/subscription/init/route.js:267-341`, `:359-378`). Renewal-worker teeb sama: provideritransaktsioon/charge toimub enne lokaalset update'i, kuid ükskõik milline catch märgib Payment rea `FAILED`-iks (`app/api/jobs/subscription-renewals/route.js:170-220`, `:249-266`). Webhook loeb `FAILED` lõplikuks ning ignoreerib hilisema `PAID` staatuse, sest erand lubab ainult `REFUNDED` ülemineku (`app/api/subscription/webhook/route.js:45`, `:336-361`).

**Mõju.** Provider võib makse vastu võtta, kuid timeout või hilisema DB-kirjutuse viga paneb kohaliku rea FAILED-iks. Kui PAID webhook hiljem saabub, platvorm kinnitab selle 200-ga, ent ei aktiveeri/pikenda tellimust. Kasutaja raha on võetud, ligipääsu pole; uus katse võib lisaks tekitada teise makse.

**Vastuvõtukriteerium.** Providerikutse timeout/ebaselge vastus peab jätma `UNKNOWN/RECONCILE_PENDING`, mitte provider-terminalse FAILED seisu. PAID peab suutma taastada ainult lokaalse/ebamäärase vea, eristades providerilt kinnitatud DECLINED-i. Veasüstetest peab katkestama pärast transaction-create'i, charge'i ja iga DB update'i ning hiljem saatma PAID webhooki, tõendades ühe makse ja ühe õiguse.

**Seis (11.08.2026): DONE — ebamäärane tulemus on oma seis (`RECONCILE_PENDING`), millest hilisem PAID veel õiguse annab; `npm run pay:outcome:probe` 27/27 päris PostgreSQL-is päris marsruutide ja päris HTTP-provideriga. Vajab migratsiooni `20260811230000`.**

Üks küsimus otsustab kõik kolm rada: **kas provider ütles ise ära?**

- **Ta ei näinud päringut** (puuduv konfiguratsioon, puuduv token) — raha ei saanud liikuda,
  `FAILED` on aus ja lõplik.
- **Ta vastas selge eitusega** (4xx, mis ei ole ajastuse/konflikti oma) — `FAILED`, providerilt
  kinnitatud.
- **Kõik muu** — timeout, katkenud ühendus, 5xx, 408/409/429, arusaamatu vastus VÕI meie enda
  viga PÄRAST providerikutset — jätab tulemuse lahtiseks. Vaikimisi ebamäärane: tundmatu vea
  korral eeldatakse, et raha VÕIS liikuda (`lib/payments/providerOutcome.js`).

**Sama muster elas KOLMES kohas ja raport nimetas kaks.** `app/api/invites/sponsored/init` kandis
sedasama `catch`-i sõna-sõnalt ja tema tagajärg oli veel karmim: tagasipööramine revoke'is ka
kutse, ja webhook keeldub hiljem terminaalset kutset äratamast (O-M6) — sponsori raha läks ja
kutset ei tulnud kunagi. Nüüd pöörab tagasipööramine ainult siis, kui raha kindlasti ei liikunud.

**Lahtine katse blokeerib kordusmakse valiku.** Teadmata tulemusega kutset ei tohi korrata, muidu
on teine laadimine sama kuu eest. Peatus ei ole vaikne: worker'i vastuses on `unresolvedBlocked`,
admini lahtiste maksete loendur ja `RECONCILE_PENDING` rida analüütika seisujaotuses. Teine
väljapääs webhooki kõrval on reconciliation-worker, mis valib nüüd ka need read ja tohib
kinnitatud PAID peale kordusmakse ise lõpetada (varem ootas ta kordusmakse puhul webhook'i —
lahtise rea taga oleks see tähendanud peatunud arveldust).

**Kõrvalparandus samas failis, SOL-PAY-01 sabast:** webhookilt tulnud KINNITATUD eitus kasvatas
ainult loendurit ja jättis `nextBilling`-u minevikku — järgmine jooks laadis kohe uuesti, ilma
päevagraafikuta, ja lae peal jäi tellimus igaveseks `PAST_DUE` seisu ilma lõpliku tühistuseta.
Mõlemad rajad (worker'i `catch` ja webhook) kasutavad nüüd sama otsust ja sama kirjutuskuju
(`planRenewalFailure` + `buildRenewalFailureSubscriptionUpdate`).

**Sond ei imiteeri viga, vaid tekitab ta.** Provider on päris HTTP-server, mille vastust sond
juhib: transaction-create 500 · ühendus katkeb keset charge'i · charge õnnestub ja MEIE järgmine
kirjutus kukub päris `P2002`-ga (provider tagastab viite, mis põrkab olemasoleva rea
unikaalsuse vastu) · transaction-create 402. Seejärel läheb teele päris allkirjastatud PAID
webhook. **Mõõdetud on kaks numbrit: üks makserida ja üks õigus** (periood pikeneb täpselt
korra). **Negatiivkontroll on vana kuju transkriptsioon:** makse märgitakse `FAILED`-iks ja sama
PAID webhook vastab `ignored`-iga — raha on võetud, ligipääsu ei ole. **Teine negatiivkontroll
käib vastassuunas:** providerilt kinnitatud eitus PEAB jääma terminaalseks ja korduskatse rajale
liikuma, muidu oleks parandus lihtsalt „kõik on ebamäärane".

Väravad: `npm test` **3866/3866** (Europe/Tallinn ja UTC) · eslint puhas · `db:migrate:check` OK.

**KATMATA:** pärandread, mis on juba `FAILED` ebamäärase tõrke tõttu, jäävad `FAILED`-iks —
koodist ei ole võimalik tagantjärele eristada, kumb `FAILED` oli kinnitatud eitus. Päris
Maksekeskuse timeout'i ei ole süstitud (sond kasutab oma HTTP-serverit) ja recurring on toodangus
väljas, seega päris jada saab tõendada alles aktiveerimise järel.

### SOL-PAY-03 — tellimuse init pole idempotentne ja võib luua mitu tasutavat recurring-checkout'i — P1

**Tõend.** Init kontrollib ainult, kas viimane tellimus on juba aktiivne, ning uuendab/loob subscriptioni (`app/api/subscription/init/route.js:216-264`). Seejärel loob iga request uue juhusliku `providerPaymentId`-ga Payment rea ja uue provideritransaktsiooni (`:266-341`). Avatud `INITIATED` makset ei otsita, kliendi idempotentsusvõtit pole ja skeemi unikaalsus kehtib ainult juba erinevate provider-viidete suhtes (`prisma/schema.prisma:1141-1169`). Kaks paralleelset request'i võivad mõlemad enne aktiivseks muutumist läbida.

**Mõju.** Topeltklõps, kaks vahekaarti või võrgu-retry võib avada kaks kehtivat recurring-checkout'i. Mõlema tasumisel pikendab kumbki webhook sama tellimust veel kuu võrra ning võib salvestada mitu mandaati; kasutaja saab soovimatu topeltmakse, kuigi kavatsus oli üks kuu/üks mandaat.

**Vastuvõtukriteerium.** Checkout-init vajab kliendi stabiilset idempotentsusvõtit ja kasutaja/tellimuse kohta atomaarset avatud-attempt'i claim'i; identne retry tagastab sama checkout'i, konkureeriv uus katse saab 409 või asendab eelmise tõendatult. Päris DB + fake-provider paralleeltest peab tõendama ühe Payment rea ja ühe transaction-create'i.

**Seis (11.08.2026): DONE — kliendi kavatsuse võti + kasutajapõhine lukustatud claim; `npm run pay:checkout:probe` 27/27 päris PostgreSQL-is, päris marsruudiga ja deterministliku võistlusega. Vajab migratsiooni `20260811230000`.**

Kaks kihti, sest kumbki üksinda ei kata (`lib/payments/checkoutIntent.js`):

- **Kliendi võti** (`Payment.clientIntentKey`, unikaalne kasutaja kohta) — sama kavatsuse kordus
  tagastab SAMA checkout'i, mitte uue. Võti on kohustuslik: võtmeta päring saab 400, sest
  „võtmeta" tähendas vanas koodis täpselt „tee uus tasuline checkout".
- **Avatud katse claim kasutaja kohta** — nõuandelukk (`4715`) serialiseerib otsuse ja lukustatud
  otsus vaatab, kas kasutajal on juba avatud tasutav katse. Ainult võti üksi ei aitaks: **kaks
  vahekaarti genereerivad kaks ERI võtit.** Sama luku alla kolisid ka aktiivsuse kontroll ja
  tellimuse upsert — vana kood tegi kõik kolm eraldi päringutena.

**Avatud katse taaskasutatakse, mitte ei keelata.** See on ainus rada, mis hoiab tasutavate
checkout'ide arvu ühe peal ILMA kasutajale ummikteed tekitamata (kriteeriumi „409" haru jääb
konkureerivale päringule, kes jõuab kohale sel ajal, kui võitja on veel provideri kutses).
Erineva summa/paketi korral on vastus aus konflikt, mitte vaikne vale summa. Kaks piiri on
mõõdetavad ja seatavad: avatud checkout elab 30 min (provideri transaktsiooni eluiga) ja
„rida on olemas, checkout'i veel ei ole" on usutav 2 min (kutse enda ajapiir on 15 s) — ilma
teiseta hoiaks protsessi surm keset kutset kasutajat ummikus terve akna.

**Sond mõõdab kahte numbrit: mitu makserida tekkis ja mitu transaction-create'i provider nägi.**
Võistlus on deterministlik (`scripts/probe-race-harness.mjs`): kolmas tehing hoiab sama
nõuandelukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad, alles siis lastakse
lukk lahti. Kaetud on sama võtmega võistlus (topeltklõps), **kahe ERI võtmega võistlus** (kaks
vahekaarti — seda ei lahenda võti, vaid lukk), järjestikune identne kordus, teine vahekaart pärast
võitjat, ära kasutatud kavatsus ja uue kavatsuse aus uus katse. **Negatiivkontroll on vana kuju
transkriptsioon:** võtmeta read lähevad andmebaasi mõlemad sisse — täpselt nii sai vana init avada
kaks tasutavat checkout'i — ja sama võtmega teist rida andmebaas ei võta (`P2002`).

Väravad: `npm test` **3866/3866** (Europe/Tallinn ja UTC) · i18n ja eslint puhtad ·
`db:migrate:check` OK.

**KATMATA:** sponsorkutse checkout (`app/api/invites/sponsored/init`) EI ole idempotentne — seal
ei ole kliendi kavatsuse võtit ja kaks päringut loovad kaks kutset ja kaks makset. See ei ole selle
leiu tekstis (kriteerium nimetab tellimuse init'i ja `Payment` skeemi) ega ole ka mujal auditis
eraldi leiuna kirjas; **lahtine, omanikule teada antud**. Samuti ei ole tõendatud, kas
MakeCommerce'i pool aegub avatud transaktsioon täpselt 30 minutiga — „asendab eelmise tõendatult"
haru jääks selle taha ja seepärast on valitud taaskasutus.

### SOL-PAY-04 — pärast sponsorluse lõppu tehtud omamakse säilitab vana sponsori allika — P1

**Tõend.** Init lubab makset, kui olemasolev ACTIVE tellimus on aegunud (`app/api/subscription/init/route.js:143-148`, `:216-229`). Olemasoleva tellimuse update muudab plaani, definitsiooni ja billing-mode'i, kuid ei sea `billingSource: SELF` ega nulli `sponsorUserId`, `inviteId`, `sponsorOrganizationId` või `orgClientSponsorshipId` välju (`:231-248`). Hilisem `activateSubscriptionFromPayment()` samuti neid välju ei muuda (`lib/payments/subscriptionActivation.js:38-80`).

**Mõju.** Inimene maksab ise, kuid aktiveeritud tellimus jääb andmebaasis `SPONSORED_BY_HOST` või `SPONSORED_BY_ORGANIZATION` päritoluga. UI, tühistamine, analüütika ja võimalik hilisem sponsori clawback käsitlevad omamakset võõra sponsorlusena; kasutaja ei pruugi saada enda recurring-tellimust lõpetada.

**Vastuvõtukriteerium.** Omamakse init peab ühes tehingus looma eraldi SELF tellimuse või puhastama kõik sponsori seosed ja allika, säilitades ajaloo eraldi ledgeris. Test peab katma aegunud hosti- ja organisatsioonisponsorluse → SELF checkout → PAID → cancel/refund ning tõendama õiget maksjat.

**Seis (12.08.2026): DONE — päritolu kirjutatakse tervikuna ja tema vahetus jätab ledgerisse jälje; `npm run pay:origin:probe` 19/19 päris PostgreSQL-is päris marsruutidega (init → PAID → cancel → refund).**

**Leid ei ole kosmeetiline, sest `billingSource` on VÄRAV.** Tühistamine nõuab
`billingSource: "SELF"` (`app/api/subscription/route.js`), seega omamaksja ei saanud oma
tellimust lõpetada — ja sponsori hilisem tagasimakse clawback'is perioodi, mille eest maksis
kasutaja ise. Sond mõõdab mõlemat lõppu, mitte ainult välja väärtust.

**Päritolu on nüüd üks otsus, mitte viis välja** (`lib/payments/subscriptionOrigin.js`): iga
ehitaja tagastab KÕIK viis välja, ka need, mis tuleb nullida. **Sama auk elas sponsorluste
VAHEL ja seda raport ei nimetanud:** organisatsioonisponsorlus kirjutas `sponsorOrganizationId`
ja jättis varasema `sponsorUserId`/`inviteId` rea külge (ja vastupidi) — `lib/org/accessContext.js`
valib sponsori just nende väljade järgi. Kolm rada (omamakse aktiveerimine, kutse vastuvõtt,
organisatsioonisponsorluse vastuvõtt) kasutavad nüüd sama ehitajat.

**Kriteeriumist kõrvalekalle, teadlik:** kriteerium ütleb „omamakse **init** peab … puhastama".
Puhastus käib **aktiveerimise** tehingus, mitte init'is. Init on kavatsus, mitte tõend (vt
SOL-PAY-02): checkout'i avamine ei tähenda, et makse tuleb, ja lõpetamata makse kustutaks
sponsori päritolu perioodilt, mille eest sponsor päriselt maksis. „Ühes tehingus" nõue on
täidetud — vahetus ja ledgeririda commit'ivad koos webhooki lukustatud tehingus.

**Ledger on `DataAuditLog`** (`subscription.billing_source_changed`, from/to + paymentId), mitte
`logPaymentAudit()`: viimane kirjutab `ChatLog`-i globaalse kliendiga põhitehingust VÄLJAS ja on
ise eraldi lahtine leid (SOL-PAY-08).

**Kõrvalparandus, mis tegi selle vea nähtamatuks:** tühistus vastas `ok`-iga ka siis, kui ükski
rida ei liikunud. Kasutaja klõpsas „lõpeta", sai eduka vastuse ja tellimus uuenes edasi.
Sponsoreeritud tellimust kasutaja endiselt ei tühista — aga see öeldakse nüüd välja
(`409 api.subscription.cancel_not_self_paid`).

**Kaks negatiivkontrolli, mõlemad vana kuju transkriptsioonid:** sama rida jäetakse
`SPONSORED_BY_HOST` päritoluga ja päris „lõpeta" ei liiguta mitte midagi · sponsori
tagasimakse clawback'ib kogu perioodi. Uue kuju all jääb omamakstud periood alles.

Väravad: `npm test` **3895/3895** (Europe/Tallinn ja UTC) · i18n ja eslint puhtad ·
`db:migrate:check` OK. Skeemimuudatust see leid ei vajanud.

**KATMATA:** brauserist läbi käidud ei ole (tühistusnupu uus 409-tekst on lepingutestiga lukus,
mitte klõpsuga tõendatud). Vanad read ei parane tagantjärele — päritolu vahetub alles järgmise
omamakse aktiveerimisel. **Backfilli ei ole vaja ja see on mõõdetud, mitte eeldatud:** toodangus
on 11 tellimust (8 `SELF`, 3 `SPONSORED_BY_HOST`) ja kokku 4 makset; ühelgi sponsoreeritud real
EI OLE oma `PAID` makset, seega ühtki „ise maksis, aga rida ütleb sponsor" rida praegu ei
eksisteeri (mõõdetud `ssh sotsiaalai` + psql 12.08).

### SOL-PAY-05 — allkirjastatud webhooki PAID otsus ei võrdle makstud summat ega valuutat kohaliku tellimusega — P1

**Tõend.** Payment mudelis on autoriteetsed `amount` ja `currency` väljad (`prisma/schema.prisma:1141-1157`), kuid webhooki lukustatud select neid ei loe (`app/api/subscription/webhook/route.js:307-324`). Otsus vajab ainult kehtivat MAC-i, leitavat providerPaymentId-d ja PAID-iks mapitavat staatust (`:245-294`, `:364-387`); provider payload'i summa/valuuta salvestatakse projektsioonina, kuid ei võrrelda (`lib/payments/rawProjection.js:24-62`). MakeCommerce'i ametlik juhend rõhutab, et merchant peab vastuvõetud summa oodatuga võrdlema: [Payment Links – MakeCommerce Developer Portal](https://developer.makecommerce.net/guides/custom-api/paymentLinks).

**Mõju.** Allkirja kehtivus tõendab sõnumi päritolu, mitte seda, et selle tehingu summa ja valuuta vastavad kohaliku õiguse hinnale. Providerikonfiguratsiooni, osalise makse, vale transaction/reference sidumise või tulevase integratsioonimuutuse korral saab väiksem/vale makse täismahus kuu või sponsorkutse õiguse.

**Vastuvõtukriteerium.** Enne PAID üleminekut tuleb kanooniliselt võrrelda provider reference/transaction ID, täpset Decimal-summat, valuutat, merchant_data payment/subscription ID-d ja oodatud makseliiki; mittevastavus läheb nähtavasse `REVIEW_REQUIRED`, mitte õiguse aktiveerimisse. Negatiivtestid peavad muutma iga välja eraldi.

**Seis (12.08.2026): DONE — `PAID` peab enne õiguse andmist sellele maksele ja selle summa eest vastama; mittevastavus läheb `REVIEW_REQUIRED` seisu. `npm run pay:verify:probe` 19/19 päris PostgreSQL-is, iga väli eraldi muudetud. Vajab migratsiooni `20260812010000`.**

**Kaks piiri, mis hoiavad kontrolli ausana** (`lib/payments/paymentVerification.js`):

- **Puuduv väli ei ole vastavus.** Kui sõnum summat üldse ei kanna, ei saa öelda „klapib" —
  see on mittevastavus. Vastupidine valik teeks kontrollist möödapääsu välja ära jättes.
- **`merchant_data` võrreldakse ainult siis, kui ta kohal on.** Teda ei kanna iga sõnumitüüp ja
  tema puudumine ei ole tõend millegi vastu; kohal olles peab ta osutama SELLELE maksele.

**Summa võrdlus on kümnendvõrdlus, mitte ujukoma:** `"7.9"` = `"7.90"` = Prisma `Decimal`
`7.99`… ja `"7.999"` ei ole esitatav, seega ta EI vasta (ümardamine oleks vaikne summa muutmine).

**`REVIEW_REQUIRED` ei ole automaatika lahendada.** Reconciliation küsiks providerilt sama
`PAID`-i, mis kontrolli üldse kukutas — seepärast on ta teadlikult VÄLJAS reconciliation-worker'i
valikust, aga SEES kordusmakse blokeerivate seisude hulgas (raha võis liikuda) ja nähtav kolmes
kohas: omaniku teade outbox'i kaudu, admini analüütika seisujaotus ja eraldi loendur.

**Sond muudab iga välja eraldi, nagu kriteerium nõuab** — summa, valuuta, viide ja
`merchant_data` makse-ID — ja iga sõnum kannab KEHTIVAT MAC-i: just see ongi leiu tuum.
Mõõdetakse kaks asja korraga: makse läks ülevaatusesse JA tellimus jäi aktiveerimata.
**Positiivkontroll on sama tähtis** — täpselt vastav sõnum peab endiselt kuu andma, muidu oleks
parandus lihtsalt „ei aktiveeri enam midagi". **Negatiivkontroll on vana otsuse
transkriptsioon:** sama 0,01-eurose sõnumi peale tehakse käsitsi see, mida vana kood tegi
(`status = PAID` + `activateSubscriptionFromPayment`) — üks sent ostis terve kuu.

**Sond leidis ka päris kõrvalmõju:** SOL-PAY-02 sond saatis oma väljamõeldud summa (`9.90`) ja
läks selle paranduse järel punaseks — täpselt nagu peabki. Ta loeb summa nüüd realt, mitte ei
kirjuta teda endasse.

Väravad: `npm test` **3895/3895** (Europe/Tallinn ja UTC) · i18n ja eslint puhtad ·
`db:migrate:check` OK · kõik viis maksesondi rohelised (13/13 · 27/27 · 27/27 · 19/19 · 19/19).

**KATMATA:** `REVIEW_REQUIRED` rea lahendamiseks ei ole admini nuppu — seis on nähtav, aga
lahendus käib praegu käsitsi andmebaasist. Osalise tagasimakse summa-loogika on eraldi leid
(SOL-PAY-06) ja `REFUNDED` sõnumeid see kontroll teadlikult ei puuduta.

### SOL-PAY-06 — osaline tagasimakse tõlgendatakse täistagastusena ja lõpetab kogu ligipääsu — P1

**Tõend.** Provideri `part_refunded` staatus mapitakse samasse `PaymentStatus.REFUNDED` väärtusse nagu täielik refund (`lib/payments/maksekeskus.js:326-354`). REFUNDED vaiketegevus on `cancel` (`app/api/subscription/webhook/route.js:42`, `:96-100`), mis lõpetab subscriptioni kohe, nullib järgmise makse ja revoke'ib maksemeetodi (`:111-155`, `:573-580`); sponsorkutse puhul eemaldatakse ka juba antud tellimus ja ruumiliikmesus (`:457-517`). MakeCommerce dokumenteerib `PART_REFUNDED` ja `REFUNDED` eri tehingustaatustena: [Refunds – MakeCommerce Developer Portal](https://developer.makecommerce.net/guides/custom-api/refunds/).

**Mõju.** Kasvõi väike osaline tagastus või hinna korrigeerimine käsitletakse täismahus clawback'ina. Kasutaja kaotab kogu makstud ligipääsu, sponsoreeritud inimene ruumiliikmesuse ja aktiivne recurring-mandaat revoke'itakse, kuigi suurem osa maksest jäi jõusse.

**Vastuvõtukriteerium.** Mudel peab eristama PART_REFUNDED ja täielikku REFUNDED seisu ning säilitama tagastatud summa/ledger-seose; õiguse vähendamine vajab toote- ja raamatupidamisreeglit, mitte staatuse stringi kokkusurumist. Testid peavad katma 0,01 €, osalise ja täieliku tagastuse nii SELF kui sponsorkutse puhul.

**Seis (12.08.2026): DONE — osaline tagastus on oma seis oma summaga ja ta EI lõpeta ligipääsu; `npm run pay:refund:probe` 22/22 päris PostgreSQL-is päris allkirjastatud webhookidega. Vajab migratsiooni `20260812020000`.**

**Reegel on raamatupidamise oma, mitte leiutatud tootereegel:** *õigus lõpeb siis, kui makse on
TÄIELIKULT tagastatud* — mitte siis, kui tagastati midagi. Kaks tagajärge:

- **0,01 € tagastus ei võta enam kuud ega ruumiliikmesust.** Osaline tagastus märgitakse ära
  (`PART_REFUNDED` + `refundedAmount`), on nähtav ja auditeeritud, aga ei vähenda ligipääsu.
- **Osalised tagastused liidetakse:** kui summa jõuab kogu makseni, käivitub täisrada (tellimus
  lõpeb, sponsorkutse clawback). `refundedAmount` EI VÄHENE — provideri sõnumid võivad korduda
  ja me ei tea, kas summa on kumulatiivne või ühe tagastuse oma; maksimumi võtmine on ainus
  tehe, mis on korduse suhtes ohutu mõlema tõlgenduse korral.

**Osalise tagastuse MÕJU õigusele (kas pool kuud, kas krediit) on tooteotsus ja teda ei ole siin
leiutatud** — kriteerium ütleb ise, et see vajab toote- ja raamatupidamisreeglit. Vaikimisi
käitumine on valitud kasutaja kasuks ja on seatav (`SUBSCRIPTION_WEBHOOK_PART_REFUNDED_ACTION`).

**Tagastusteade ei lähe enam „sama seis" otseteed** — teine osaline tagastus kannab uut summat ja
võib koos eelmisega katta kogu makse. Lõplikust seisust edasi liigub AINULT tagastus.

Sond mõõdab seda, mida kasutaja tunneb: kas tellimus kehtib ja kas ruumiliikmesus on alles.
Kaetud on 0,01 € · osaline · kumulatiivne (3,00 + 7,99) · täielik, nii omamakse kui sponsorkutse
peal. **Negatiivkontroll on vana kuju transkriptsioon:** sama 0,01 € sõnum `REFUNDED` seisuna
lõpetab kogu ligipääsu (`ACTIVE → CANCELED`).

Väravad: `npm test` **3917/3917** (Europe/Tallinn ja UTC) · i18n ja eslint puhtad ·
`db:migrate:check` OK.

**KATMATA:** kui provider saadab tagastuse summa DELTANA (mitte kumulatiivsena), alahindab
maksimumi-reegel kogusummat ja rida jääb osaliseks — viga läheb siis kasutaja kasuks (ligipääs
jääb) ja on omanikule nähtav, aga täpne kumulatsioon vajaks provideri kinnitust selle välja
tähenduse kohta. Osalise tagastuse rahaline ledger elab `Payment.refundedAmount` peal;
eraldi raamatupidamiskirjet see leid ei ehita.

### SOL-PAY-07 — tasutud sponsorkutse join-token võib outbox'i vea järel jäädavalt kaduda — P1

**Tõend.** PAID webhook genereerib kutse toortokeni tehingu sees, salvestab ainult räsi ja tagastab toortokeni lokaalses `inviteEmail` objektis (`app/api/subscription/webhook/route.js:394-449`). Outbox-rida luuakse alles pärast maksetehingu commit'i; enqueue-viga neelatakse logiks ning webhook vastab ikkagi 200 (`:644-668`, `:743-746`). Sama webhooki kordus näeb makset juba PAID-na ja tagastab idempotentse tulemuse ilma `inviteEmail`/toortokenita (`:336-352`).

**Mõju.** Maksja raha ja kutse SENT-seis commit'ivad, kuid saajale vajalikku join-linki pole võimalik algsest räsist taastada. Provider ei saa kordusega outbox'i parandada; saatja peab vea ise avastama ja eraldi resend'iga uue tokeni looma. Edukas makse ei anna lubatud kasutajateed.

**Vastuvõtukriteerium.** Kutse tokenihash ja krüptitud/minimaalselt kaitstud delivery-payloadiga outbox-rida peavad tekkima samas DB-tehingus; webhooki idempotentne kordus peab suutma puuduva delivery-kandja taastada ilma uue õiguse/makseta. Veasüstetest peab katkestama outbox create'i ning nõudma rollback'i või durable pending-delivery seisu.

**Seis (12.08.2026): DONE — toortoken ja tema kandja sünnivad ühes tehingus ja kordus taastab kadunud kandja ilma uue õiguse või makseta; `npm run pay:refund:probe` 22/22 (jaam 7) päris PostgreSQL-is.**

**Räsi ja kandja ei saa enam lahku minna.** Kutse-kiri EI ole enam „pärast commit'i" —
`issueSponsoredInviteDelivery(tx, …)` mindib tokeni, kirjutab räsi ja loob outbox-rea SAMAS
tehingus. Kui kandjat ei saa luua, ei jõustu ka räsi (nimeline `INVITE_DELIVERY_UNAVAILABLE`,
algne viga `cause` küljes).

**Kordus ei ole enam tupik.** Kui kandja on kadunud, aga kutse on veel elus (`SENT`, aegumata),
teeb sama webhooki kordus uue lingi — ilma uue makse ja ilma uue õiguseta. Rotatsioon on ohutu
just seetõttu, et ta käib AINULT siis, kui ühtegi kohaletoimetamise rida EI OLE: pärast seda
parandust tähendab see, et kirja ei saadetud kunagi. Postkastis olevat linki see ei tapa (kui
kandja on olemas, ei rotreerita midagi — vt AUTH-15 õppetund „mint → SAADA → alles siis
rotatsioon"). Kutse eluiga on 7 päeva ja outbox'i retention 90, seega „kandjat ei ole, sest
retention koristas ta" ei jõua kunagi elusa kutseni.

**Minimaalne kaitse payloadile:** kui kiri on PÄRISELT välja läinud, kustutatakse toortoken
outbox-realt (`joinTokenDelivered: true`) — koopia adressaadi postkastis on kandja, koopia meie
andmebaasis on ainult risk. `FAILED`/`SKIPPED` read jäävad puutumata, sest neid saab operaator
konfiguratsiooni parandades veel elustada.

**SOND TABAS PÄRIS VEA MINU ENDA PARANDUSES ja see on siin kirjas, mitte peidus.** Esimene
teostus lootis erindile: `enqueuePaymentEmail` püüab `P2002` kinni ja tagastab „duplikaat".
Tehingu sees see EI TÖÖTA — **PostgreSQL märgib tehingu vigaseks juba unikaalsuse rikkumise
hetkel**, seega JS-i `catch` päästab ainult protsessi ja kõik järgnevad laused pöörduvad vaikselt
tagasi. Logi ütles „sponsored_invite_activated", aga kutse jäi `PENDING_PAYMENT`-i ja makse
`INITIATED`-iks. Fake seda ei näinud; päris andmebaas nägi. Olemasolu kontrollitakse nüüd ENNE
kirjutamist (makse rida on `FOR UPDATE` all, seega võistlust ei ole), ja ledgerisse jäi
õppetund: **erindipõhine „duplikaat on ok" ei kõlba tehingu sees.**

**Veasüst on päris:** sond hõivab kandja võtme ette, mõõdab et õigus jõustub ilma räsi
rotatsioonita, kustutab siis kandja ja kordab sama webhooki — uus kandja kannab toortokenit, räsi
vahetub, kutse seis ja makseridade arv EI muutu.

Väravad: `npm test` **3917/3917** (Europe/Tallinn ja UTC) · eslint puhas · `db:migrate:check` OK.

**KATMATA:** outbox'i payload ei ole krüptitud (kriteerium lubab „krüptitud VÕI minimaalselt
kaitstud"). Krüpteerimine seoks kutse kohaletoimetamise `PAYMENT_TOKEN_ENC_KEY`-ga, mille
puudumine teeks kogu kutseraja fail-closed'iks — see on suurem risk kui lühiajaline toortoken
reas, mis kustutatakse saatmise hetkel. Omaniku- ja kliendikiri jäävad endiselt tehingust välja:
nende payload kannab ainult `paymentId`-d ja on igal hetkel taastatav.

### SOL-PAY-08 — makseaudit pole põhitehingu osa ja kasutab süstitud tehingu asemel globaalset Prismat — P1

**Tõend.** `logPaymentAudit()` delegeerib async `logPaymentEvent()`-ile, mis kirjutab `ChatLog` rea globaalse `prisma` kliendiga ja neelab DB-vea (`lib/payments/observability.js:48-109`). Webhook kutsub seda korduvalt lukustatud `prisma.$transaction()` sees ilma `await`-ita (`app/api/subscription/webhook/route.js:403-455`, `:510-607`). Seega audit võib joosta enne põhitehingu commit'i, kirjutada hiljem rollback'itud tegevuse või ebaõnnestuda pärast edukat makse/õiguse muutust. Sihttestid logisid kolm globaalse Prisma ühendusviga, kuigi reconciliationile oli fake-DB süstitud; kõik testid jäid roheliseks.

**Mõju.** Makse, refund, sponsorluse clawback ja ligipääsu aktiveerimine võivad toimuda ilma püsiva auditireata või audit võib kirjeldada muudatust, mis rollback'is kadus. `ChatLog` best-effort telemeetria ei ole usaldatav finantsledger ega auditi outbox.

**Vastuvõtukriteerium.** Nõutud makseaudit/outbox tuleb kirjutada sama `tx` kliendiga põhiseisuga samas tehingus; välise logi eksport võib jääda hilisemaks idempotentseks workeriks. Veasüstetest peab katkestama auditirea loomise ja tõendama kas kogu tehingu rollback'i või sama commit'i durable outbox'i.

**Seis (12.08.2026): DONE — otsus ja tema püsiv jälg commit'ivad koos või mitte kumbki; `npm run pay:audit:probe` 11/11 päris PostgreSQL-is, veasüst on päris andmebaasi trigger.**

**Kaks kihti, mille vahe on nüüd nimes** (`lib/payments/observability.js`):

- **`writePaymentAudit(tx, …)`** — püsiv jälg `DataAuditLog`-is, kirjutatud SAMA tehinguga, mis
  kannab otsust. Ta on `await`-itud ja tema viga pöörab tehingu tagasi. **Funktsioon VISKAB, kui
  talle antakse globaalne klient** — vana viga ei saa enam kogemata tagasi tulla.
- **`logPaymentAudit`/`logPaymentEvent`** — telemeetria (konsool + `ChatLog`), millest elavad
  admini loendurid ja häireraport. Ta jääb best-effort'iks ja tehingust VÄLJA, nagu telemeetria
  peabki. Kriteeriumi lubatud „väline logi eksport" ongi see kiht.

Kaetud on kõik tehingusisesed otsused: webhooki üheksa auditit, reconciliation'i kolm, kutse
kandja taastamine ja **kasutaja enda tühistus** — viimane sai ühtlasi tehingu, mida tal varem
üldse ei olnud (kaks `updateMany`-t eraldi ja audit väljaspool).

**Veasüst on päris andmebaas, mitte mock:** sond paigaldab `DataAuditLog`-i peale ajutise
trigger'i, mis viskab erindi ainult selle sondi rea peale. Tulemus: makse jääb `INITIATED`-iks,
tellimus aktiveerimata, auditiridu null ja webhook vastab ausalt 500-ga. Trigger maha → sama sõnum
jõustab makse, õiguse JA jälje. **Negatiivkontroll on vana kuju transkriptsioon:** telemeetriarida
kirjutatakse tehingu sees globaalse kliendiga, tehing pöördub tagasi — jälg jääb alles ja
kirjeldab muudatust, mida kunagi ei toimunud.

Väravad: `npm test` **3924/3924** (Europe/Tallinn ja UTC) · eslint puhas.

**KATMATA:** vanad `ChatLog` auditiread jäävad alles ja neid ei migreerita `DataAuditLog`-i —
uus jälg algab sellest muudatusest. Admini vaated loevad endiselt telemeetriat (`ChatLog`);
`DataAuditLog` on ledger, mitte veel eraldi admini pind.

### SOL-PAY-09 — konto kustutamine kaskaadib makseajaloo enne seadistatud seitsmeaastast retentsiooni — P1, õiguslik ulatus runtime NOT_PROVEN

**Tõend.** Subscription, Payment ja BillingMethod seosed kasutajaga on `onDelete: Cascade`; Payment kustub lisaks subscriptioni kustumisel (`prisma/schema.prisma:935-986`, `:1141-1165`, `:1173-1200`). Konto kustutamise lõpptehing teeb päris `tx.user.delete()` ning eraldi finantsarhiivi/anonymiseeritud ledgerit selles ahelas pole (`lib/privacy/effectivePracticeAccountCleanup.js:144-175`). Üldretention säilitaks Payment kirjeid vaikimisi seitse aastat ja kustutab need alles `paymentCutoff` järel (`lib/retention.js:20-28`, `:585-613`), kuid kasutaja cascade möödub sellest. Kehtiva Raamatupidamise seaduse § 12 järgi tuleb raamatupidamise algdokumente säilitada seitse aastat majandusaasta lõpust: [Riigi Teataja](https://www.riigiteataja.ee/akt/107012025012?tegevus=salvesta-link). Repo ei tõenda, kas nõutav täielik arvestusdokument säilib eraldi raamatupidamissüsteemis/provideris, mistõttu lõplik õiguslik rikkumine on `NOT_PROVEN`.

**Mõju.** Platvormi enda makse-ID, summa, staatus, paid/refunded ajad ja seos tellimusega võivad kasutaja kustutamisel kohe kaduda, kuigi vaidlus-, refund-, audit- või raamatupidamisperiood kestab. Välise süsteemi olemasolu pole koodist tõendatud ega konto kustutuse protseduuriga seotud.

**Vastuvõtukriteerium.** Enne kasutaja hard-delete'i peab olema tõendatud, milline minimaalne finantsdokument/ledger säilib õigusliku aluse ja tähtajaga; otsene kasutaja-FK tuleb asendada pseudonüümse/anonymiseeritud arvestusidentiteediga või teha kontrollitud arhiiv. Jurist/raamatupidaja peab kinnitama väljade ja tähtaja lepingu. Integratsioonitest peab kustutama konto ning tõendama nii isikuandmete eemaldamise kui nõutava finantsjälje säilimise.

**Seis (12.08.2026): DONE mehhanismi osas; koosseisu kinnitus jääb juristile.**

**Leid ei olnud tingimuste ja koodi vastuolu, vaid KOODI JA KOODI oma.** `lib/retention.js`
teostab juba täpselt seda, mida privaatsustingimuste punkt 7.9 kasutajale lubab — minimaalne
kirje seitse aastat, teenusepakkuja toorvastus 90 päeva — ja võõrvõtme reegel võttis selle
vaikselt tagasi. Andmebaasi tasand võitis teenusekihi ilma ühegi logireata. **Kriteeriumi lause
„jurist peab kinnitama väljade JA TÄHTAJA lepingu" on tähtaja osas juba vastatud** ja vastus on
avaldatud: 7.9 on `main`-is, `origin/main`-is ja deploy'tud commit'is, kõigis kolmes keeles.
Lahtiseks jääb ainult **koosseis**.

**Mis muutus.** `Payment.userId` on nullitav ja `SetNull`; `Payment.subscriptionId` samuti
`SetNull`, sest ilma selleta oleks maksja seose parandamine olnud tühi töö — tellimus kaskaadib
kasutajaga ja oleks võtnud maksekirje endaga kaasa teist teed pidi. Kolm külmutatud välja
(`archivedAt`, `archivedPayerRef`, `archivedPlanCode`) kirjutatakse **kustutuse tehingu sees ja
ENNE `user.delete`-i** — pärast seda ei ole enam kedagi, kelle ridu üles leida. Sama järjekorra
argument mis SOL-SPROF-01 juures, sama fail.

**Pseudonüüm on juhuslik, mitte tuletatud.** HMAC kasutaja ID-st oleks nõudnud võtit, ja võti on
asi, mis lekib, roteerub ja puudub testkeskkonnas. Juhuslik viide on konstruktsiooni järgi tagasi
arvutamatu ka siis, kui kogu andmebaas lekib; ühe inimese maksed jäävad omavahel seotuks, sest
sama kustutus kirjutab sama viite kõigile ridadele. Külmutamine on **idempotentne** — kordus
tähendaks uut pseudonüümi ja ühe inimese maksed laguneksid seostamatuks.

**Paketi inimloetavat nime EI külmutata**, vaid sisemine tootekood: „supervisioonipakett"
tõendaks seitse aastat, et see inimene oli supervisioonis, ja § 7 majanduslik sisu on kaetud koodi
ning `kind` väljaga. **`BillingMethod` ja `Subscription` kaskaadivad teadlikult edasi** — makseviis
on kasutatav token, mille säilitamine oleks halvem kui kustutamine, ja tellimus ei ole algdokument.
Algdokument on maksekirje.

**Koosseis on ÜHES kohas** (`PAYMENT_ARCHIVE_FIELDS`, `lib/privacy/paymentArchive.js`): kui jurist
või raamatupidaja täpsustab miinimumi, muutub see loend seal, mitte laiali kustutusrajal.

**Mõõdetud enne migratsiooni** (toodang, 12.08): 4 `Payment` rida, kõigil `userId` täidetud, 11
`Subscription`, 1 `BillingMethod`. Migratsioon `20260812170000` ei muuda ühtki olemasolevat
väärtust — `DROP NOT NULL` ainult lõdvendab piiri.

**Kõrvalleid, mida raportis ei olnud:** hiline `token_return` callback kustutatud maksja rea peale
oleks proovinud luua makseviisi `userId: null`-iga ja andnud FK-vea kaudu 500. Nüüd tunnistab ta
ausalt, et maksjat ei ole enam.

**Väravad:** `TZ=UTC npm test` **4161/4161** · `i18n:check` OK · eslint puhas ·
`db:migrate:check` OK (165 migratsiooni).

**Kriteeriumi integratsioonitest on 12.08 õhtul kaetud päris PostgreSQL-is:
`npm run pay:archive:probe` 24/24.** Sond loob ajutise andmebaasi ja jooksutab sinna peale
`prisma migrate deploy`, seega mõõdetav reegel on migratsiooniahela oma, mitte arendusbaasi
triiv. Läbiv jaam teeb täpselt need kaks lauset samas järjekorras, mis päris kustutusrada
(`lib/privacy/effectivePracticeAccountCleanup.js:276-278`): külmuta, siis `user.delete()`.

**Kaks negatiivkontrolli, sest fiksil on kaks poolt.** *Järjekord:* kolmas maksja kustutatakse
ILMA eelneva külmutamiseta ja alles siis proovitakse arhiveerida — rida elab üle, aga
arhiveerija ei leia teda enam (`archived: 0`), koosseis jääb tühjaks ja plaanikoodi ei ole
kuskilt küsida, sest tellimus kaskaadis kaasa. Ilma selle mõõtmiseta oleks „ENNE `user.delete`-i"
ainult kommentaar. *Võõrvõti:* vana `ON DELETE CASCADE` pannakse samas andmebaasis sama
andmestiku peale tagasi — alles jääb **0 rida**, uue reegli all 2. Külmutamine jooksis mõlemal
juhul, seega vahe tuleb ainult reeglist.

**Sond leidis vea iseendas ja see on leiu enda klass.** Esimene struktuurikontroll otsis
võõrvõtit TABELIPAARI järgi, aga `Subscription` viitab `User`-ile KAHEST veerust vastupidiste
reeglitega (`userId` = Cascade, `sponsorUserId` = SetNull) — mõõdik võttis neist suvalise ja
näitas punast õige koodi peal. Otsing käib nüüd veeru järgi ja kontroll `1e` naelutab
sponsoriseose eraldi `SetNull`-iks: kui need kaks kunagi kokku langeksid, oleks veerupõhine
otsing tühi vaev ja seda oleks näha.

**NOT_PROVEN jääb kaks asja.** Koosseis ise on õiguslik otsus, mitte mõõtmine — sond tõendab, et
`PAYMENT_ARCHIVE_FIELDS` säilib kustutuse üle, mitte seda, et just see loend on raamatupidamise
seaduse miinimum. Ja sond jooksutab kustutusraja kahte lauset, mitte kogu
`effectivePracticeAccountCleanup()` funktsiooni — ülejäänud koristus on kaetud oma testidega.

### SOL-PAY-10 — callback ja webhook võivad luua samale recurring-mandaadile mitu aktiivset BillingMethod rida — P2

**Tõend.** `token_return` callback loeb Payment rea enne tehingut; kui `billingMethodId` puudub, loob ta tehingus uue BillingMethod rea (`app/api/subscription/callback/route.js:62-107`, `:112-162`). PAID webhooki `upsertRecurringBillingMethod()` loeb samuti subscriptioni viite ja võimaliku `providerMandateId` rea ning loob puudumisel uue (`lib/payments/subscriptionActivation.js:91-159`). Callback ei kasuta Payment row-lock'i ning skeemis on `providerMandateId` ainult indeks, mitte unikaalne piir (`prisma/schema.prisma:1173-1200`). Kaks callback'i või callback + webhook võivad mõlemad lugeda nulli ja luua eraldi aktiivse krüptitud tokenirea; viimase subscription/payment update võidab.

**Mõju.** Üks mandaat võib jääda mitme aktiivse tokenikandjana andmebaasi; osa ridadest pole ühegi subscriptioniga seotud, kuid sisaldab jätkuvalt kasutatavat recurring-tokenit. Limiit, revoke ja võtmerotatsioon ei tea, milline rida on autoriteetne.

**Vastuvõtukriteerium.** Provider-mandaat vajab normaliseeritud unikaalset `(provider,userId,providerMandateId)` või eraldi attempt-ID piiri ning kõik callback/webhook rajad peavad kasutama sama lukustatud upsert'i. Paralleeltest peab võistlema token_return'i ja PAID webhooki ning tõendama ühe aktiivse rea ja ühe krüptitud tokeni.

**Seis (12.08.2026): DONE — üks mandaat = üks rida, mõlemad rajad kasutavad sama lukustatud claim'i; `npm run pay:mandate:probe` 13/13 päris PostgreSQL-is deterministliku võistlusega. Vajab migratsiooni `20260812030000`.**

Kaks kihti nagu SOL-PAY-03-l, sest kumbki üksinda ei kata: **unikaalsus**
`(provider, userId, providerMandateId)` on püsiv piir, **kasutajapõhine nõuandelukk** (`4716`)
hoiab ära selle, et piire üldse rikkuma jõutaks — ja see ei ole kosmeetika: unikaalsuse rikkumine
tehingu sees MÜRGITAB tehingu (vt SOL-PAY-07 õppetund), seega „loo ja püüa viga kinni" oleks siin
vaikne andmekadu.

**Mandaadi salvestus elab nüüd ühes kohas** (`lib/payments/billingMethodClaim.js`); nii
`token_return` callback kui PAID webhook kutsuvad sedasama. Callback sai ühtlasi selle, mis tal
üldse puudus: **makse rida loetakse tehingu sees `FOR UPDATE` all.**

**LUKUJÄRJEKORD on kirjas ja ühine: makse rida → nõuandelukk kasutaja peale.** Vastupidine
järjekord ühes rajas tähendaks klassikalist ummikut callback'i ja webhooki vahel — see on täpselt
see viga, mida kaks eraldi teostust kergesti teevad.

Sond mõõdab kolme numbrit: mitu maksevahendi rida jäi (1), mitu neist on aktiivsed (1) ja kas
token on dekrüptitav (on). **Negatiivkontroll:** teist rida sama mandaadiga andmebaas ei võta
(`P2002`) — ja mandaadita read ei ole duplikaadid, seega piirang ei murra tavarada.

Väravad: `npm test` **3932/3932** (Europe/Tallinn ja UTC) · eslint puhas · `db:migrate:check` OK.

**KATMATA:** toodangus on üks `BillingMethod` rida ja duplikaate ei olnud (mõõdetud 12.08), seega
piirang läks peale ilma koristuseta. Vanu ridu, mis kannavad sama mandaati eri kasutajate all,
ei ole — aga kui neid kunagi tekib, keeldub migratsioon ja see on nähtav, mitte vaikne.

### SOL-PAY-11 — e-posti outbox'i timeout/recovery võib sama kirja mitu korda saata — P2

**Tõend.** Worker piirab SMTP promise'i `Promise.race()` timeout'iga, kuid ei katkesta algset `sendMail()` tööd (`lib/payments/emailOutbox.js:311-314`). Timeout märgib rea RETRY-ks (`:323-333`); algne SMTP saatmine võib hiljem siiski õnnestuda. Samuti tõstab lease-recovery vana SENDING rea RETRY-ks teadmata, kas SMTP võttis kirja vastu (`:257-263`). Uus katse saadab sama customer/owner/invite kirja uuesti, sest SMTP sõnumil pole püsivat provider-idempotentsusvõtit.

**Mõju.** Kasutaja võib saada mitu maksekinnitust, clawback-teadet või sama sponsorkutse linki; halvemal juhul jõuab timeout'i järel esimene kiri ja hilisem retry teises järjekorras, mis teeb finants- või ligipääsuteate eksitavaks. Loendur nimetab lease'i õigesti `ambiguous`, kuid käitumine on ikkagi automaatne resend.

**Vastuvõtukriteerium.** SMTP-transport vajab toetatud aborti või püsivat Message-ID/delivery-ledgerit ja teadlikku at-least-once lepingut; ebamäärane tulemus peab olema eraldi review/reconcile olek, mitte pime retry tundliku kirja puhul. Test peab laskma timeout'i järel esimesel send-promise'il õnnestuda ning tõendama otsustatud ühe-kirja või selgelt auditeeritud duplikaadilepingut.

**Seis (12.08.2026): DONE — püsiv Message-ID + `AMBIGUOUS` oma seisuna; tundlik kiri EI lähe pimedale kordusele. Ühiktestid 8/8 (`tests/payments/emailOutboxAmbiguous.test.js`), sh timeout, mille järel esimene saatmine ikkagi õnnestub. Vajab migratsiooni `20260812040000`.**

Kaks asja, mille peale leping saab toetuda:

- **Püsiv Message-ID** (`PaymentEmailOutbox.messageId`, mindud koos reaga) — korduskatse kannab
  sama tunnust, seega duplikaat on RFC mõttes SAMA sõnum ja postiklient tunneb ta ära. Vana kood
  ei andnud tunnust üldse, seega iga kordus oli adressaadi jaoks uus kiri.
- **`AMBIGUOUS` on oma seis**, mitte `RETRY`. `Promise.race()` ei katkesta SMTP tööd ja
  lease-taaste ei tea, mis juhtus — see on TEADMATUS, mitte tõrge.

**Kirja liik otsustab, mis teadmatuse järel juhtub, ja see valik on tooteotsuse-kujuline:**

- **kandja-kirjad** (kutselink, sisemine omaniku teade) korratakse — saamata jäänud link on
  suurem kahju kui topeltkiri, ja sisu on identne;
- **inimesele suunatud uudised** (maksekinnitus, sponsorluse tagasivõtmine) jäävad
  `AMBIGUOUS` seisu ilma järgmise katseta. Otsuse teeb inimene. Vastuvõtja on siin sageli
  haavatavas olukorras — teine „sinu sponsorlus võeti tagasi" kiri ei ole kosmeetiline müra.

Poliitika elab ANDMETES, mitte teises päringus: ülevaatust ootaval real on `nextAttemptAt = null`
ja worker'i valik (`lte: now`) ei näe teda kunagi. Worker'i vastuses on eraldi `ambiguous` ja
`review` loendurid.

**Selge tõrge (SMTP ütles „ei") käitub nagu enne** — `RETRY` backoff'iga. Teadmatus ja tõrge on
kaks eri asja ja see vahe on nüüd koodis.

Väravad: `npm test` **3932/3932** (Europe/Tallinn ja UTC) · eslint puhas · `db:migrate:check` OK.

**KATMATA:** SMTP-transpordil ei ole endiselt päris `abort`-i — `Promise.race` jääb ootamise
piiriks, mitte katkestuseks. See on transpordikihi muudatus (`lib/mailer.js` socket-tasand) ja
selle leiu ulatusest väljas; `AMBIGUOUS` on täpselt selle piiri aus nimi. Ülevaatust ootava rea
lahendamiseks ei ole admini nuppu — seis on nähtav worker'i vastuses ja real endal.

### SOL-NOTIF-01 — notification-worker ei anna päris SMTP-transpordile saatja aadressi — P1

**Tõend.** `lib/notificationDelivery.js:145-152` kutsub `transport.sendMail()` väljadega `to`, `subject`, `text` ja `messageId`, kuid ilma `from` väljata. Platvormi enda SMTP-transport loeb envelope-saatja ainult `message.from` väärtusest ja katkestab selle puudumisel (`lib/mailer.js:273-283`). Eraldi käivitus konfigureeritud `SMTP_HOST` ja sama sõnumikujuga lõpetas enne võrguühendust veaga `EMAIL_FROM peab sisaldama kehtivat aadressi.` Olemasolev test kasutab fake-mailerit, mis võtab suvalise objekti vastu (`tests/notifications/notificationDelivery.test.js:49-61`).

**Mõju.** Kõik e-kirja soovivad `NotificationEvent` read lähevad päris platvormitranspordiga RETRY/FAILED olekusse; rakendusesisene teavitus võib eksisteerida, kuid lubatud või kohustuslik teavituskiri ei jõua adressaadini.

**Vastuvõtukriteerium.** Worker peab andma valideeritud ja konfigureeritud `from` aadressi samast autoriteetsest konfiguratsioonist nagu ülejäänud mailerid. Integratsioonitest peab kasutama päris `getMailer()` lepingut või ranget transporti, mis nõuab envelope-saatjat, ning tõendama eduka SMTP-käsu moodustumise.

**Seis (12.08.2026): DONE — worker annab envelope-saatja ja puuduv saatja ei jää lõputusse korduskatsesse; `npm run notif:progress:probe` 14/14 päris PostgreSQL-is (jaam 4).**

Saatja tuleb nüüd nimeliselt ühest kohast (`resolveMailFrom()` failis `lib/mailer.js`) — sama
`EMAIL_FROM || SMTP_FROM` rida oli koodibaasis kaheksas kohas laiali, seega „sama autoriteetne
konfiguratsioon" oli seni kokkulepe, mitte mõõdetav väide.

**Puuduv saatja ei ole korduskatse väärt.** Ilma temata ei saa ükski katse õnnestuda, seega rida
läheb nähtavasse `SKIPPED_NO_RECIPIENT` seisu koodiga `EMAIL_FROM_MISSING` ja oma loenduriga
(`skippedSender`) — mitte lõputusse `RETRY` ringi.

**Test kasutab kriteeriumi teist haru (range transport), sest esimene ei tõenda siin midagi:**
päris `getMailer()` annab seadistamata keskkonnas „transport is not configured" ja katkeb ENNE
saatja kontrolli. Range transport nõuab envelope-saatjat täpselt nagu `lib/mailer.js`, ja eraldi
väide lukustab, et see nõue seal päriselt on. Sond jooksutab sama raja päris andmebaasi rea peal.

Väravad: `npm test` **3950/3950** (Europe/Tallinn ja UTC) · i18n ja eslint puhtad.

### SOL-NOTIF-02 — reconciler alustab igal käivitusel algusest ja võib kõik read pärast esimest 10 000 kirjet jäädavalt näljutada — P1

**Tõend.** Reconciler loeb seitset püsivat allikat ID-kursoriga kuni 100 rida korraga (`lib/notificationReconciler.js:41-95`) ning tagastab järgmise liitkursori (`:175-188`). Job alustab iga kord `reconcileCursor = null` ja katkestab pärast 100 lehekülge (`app/api/jobs/notifications/route.js:46-57`). Allikaread ei saa „reconciled” märget: deduplikatsioon toimub eraldi `NotificationEvent.dedupeKey` kaudu. Seega loetakse järgmisel job'il uuesti samad kuni 10 000 vanimat jätkuvalt sobivat rida ning hilisemate ID-deni ei jõuta.

**Mõju.** Suurema andmehulga korral võivad hilisemad eelpöördumised, tähtajad, kutsed, ruumid, abimatch'id, praktikaülesanded või teenused teavituseta jääda. Job küll logib `truncated`, kuid järgmine käivitus ei jätka sealt.

**Vastuvõtukriteerium.** Igal allikal peab olema püsiv watermark/edenemiskursor või päring peab välistama juba reconciled/deduplitud read nii, et järgmine käivitus jätkab tegelikust piirist. Test peab looma rohkem kui 100 × batch sobivat püsivat rida ja tõendama, et korduvad job'id jõuavad kõigini.

**Seis (12.08.2026): DONE — allika edenemine on püsiv ja ringi käiv; `npm run notif:progress:probe` 14/14 (jaam 3). Vajab migratsiooni `20260812050000`.**

Uus tabel `NotificationReconcileCursor` kannab iga allika kohta viimast kohta. Jooksu SEES kannab
kohta endiselt liitkursor (kutsuja annab ta järgmisele lehele); jooksude VAHEL kannab teda
andmebaas.

**Kursor on RINGI KÄIV ja see ei ole detail.** Allika lõpus salvestatakse NULL ja järgmine jooks
alustab otsast. Puhas edasiliikuv vesimärk oleks tekitanud UUE vaikse kao: read, mis muutuvad
sobivaks alles hiljem (eelpöördumine, mille `nextContactOn` saabub), on vesimärgist VANEMAD ja ei
tuleks enam kunagi valikusse.

`dryRun` ei liiguta kohta — proovijooks ei tohi varastada ridu päris jooksult.

Sond mõõdab seda päris andmebaasi vastu: viis järjestikust jooksu partii suurusega 1 jõuavad
kõigi ridadeni ja kursoririda on andmebaasis, mitte protsessi mälus. **Kriteeriumi „100 × batch"
täht on täitmata** — sond kasutab viit rida ja partii suurust 1, mis on sama vahekord ilma
10 000 rea kirjutamiseta; mõõdetav väide on „iga jooks liigub edasi", mitte reamaht.

### SOL-NOTIF-03 — ruumiaktiivsuse teade välistab autorid ainult ühe andmelehekülje piires — P2

**Tõend.** Reconciler loeb viimase kuue tunni sõnumeid ID järgi ühe `take`-lehekülje kaupa (`lib/notificationReconciler.js:77-80`). `authors` hulk koostatakse ainult selle lehekülje sõnumitest ning liikmepäring välistab ainult need kasutajad (`:128-140`). Sama ruumi teises leheküljes kirjutanud aktiivne liige ei kuulu selle lehe autorihulka.

**Mõju.** Kasutaja võib saada teate ruumi aktiivsusest, mille ta ise samas kuue tunni aknas tekitas. Esimesena loodud dedupe-rida jääb alles ja hilisem korrektsem lehekülg seda tagasi ei võta.

**Vastuvõtukriteerium.** Autorite välistus peab põhinema kogu deduplikatsiooniakna ruumipõhisel päringul või agregeeritud olekul, mitte hetkeleheküljel. Test peab jagama sama ruumi eri autorite sõnumid üle vähemalt kahe batch'i ja kontrollima iga adressaati.

**Seis (12.08.2026): DONE — autorid välistatakse kogu akna pealt; sond 14/14 (jaam 1).**

Autorid küsitakse nüüd ruumi kohta eraldi päringuga (`distinct: ["authorId"]`) kogu kuue tunni
akna pealt, mitte hetkeleheküljelt. Sond paneb kaks autorit ühte ruumi ja jooksutab partii
suurusega 1 — vana kuju oleks teisele autorile saatnud teate aktiivsusest, mille ta ise tekitas.
Adressaate on täpselt üks: kolmas liige, kes ei kirjutanud.

### SOL-NOTIF-04 — liikuv kuue tunni otsinguaken ja job'i kellast tuletatud dedupe-aken võivad sama tegevuse kaks korda teavitada — P2

**Tõend.** Sõnumivalik kasutab liikuvat piiri `createdAt > now - 6h` (`lib/notificationReconciler.js:46-48`, `:77-80`), kuid dedupeSuffix on worker'i hetkeaja fikseeritud kuue tunni ploki algus (`:18-21`, `:138-140`). Sama veel kuue tunni sisse jääv sõnum võib enne ja pärast UTC kuue tunni piiri saada erineva dedupe-võtme, kuigi uut ruumitegevust ei lisandunud.

**Mõju.** Piiri ümber käivituvad job'id võivad saata ühe ruumi sama vana aktiivsuse kohta kaks rakenduse- ja e-posti teadet.

**Vastuvõtukriteerium.** Valikuaken ja dedupe-aken peavad kasutama sama sündmuspõhist bucket'it või püsivat viimati teavitatud aktiivsuse watermärki. Kellapiiri test peab käivitama reconciler'i mõlemal pool kuue tunni piiri ilma uusi sõnumeid lisamata ja tõendama ühe teate.

**Seis (12.08.2026): DONE — dedupe-aken tuleb SÜNDMUSEST, mitte worker'i kellast; sond 14/14 (jaam 2).**

`roomWindow()` võtab nüüd argumendiks viimase sõnumi aja, mitte praeguse kella. Sama aktiivsus
langeb alati samasse kuue tunni ämbrisse, ükskõik millal job jookseb; uus sõnum järgmises ämbris
annab ausalt uue teate. Sond jooksutab reconciler'i kuue tunni piiri MÕLEMAL pool ilma uusi
sõnumeid lisamata ja loeb teadete arvu: üks, mitte kaks.

### SOL-NOTIF-05 — delivery timeout märgib teadmata tulemuse automaatselt retry'ks, kuigi algset SMTP saatmist ei katkestata — P2

**Tõend.** `withTimeout()` võistleb maileri promise'i taimeriga, kuid ei anna transpordile abort-signaali (`lib/notificationDelivery.js:19-35`, `:147-152`). Timeout läheb tavavea harusse ja seab rea RETRY-ks (`:158-169`); algne saatmine võib pärast timeout'i ikkagi õnnestuda. Püsiv `Message-ID` vähendab mõne vastuvõtja juures riski, kuid SMTP ei anna selle põhjal platvormile täpselt-üks-kord garantiid. Test kinnitab ainult RETRY olekut mitte kunagi laheneva fake-promise'iga (`tests/notifications/notificationDelivery.test.js:76-86`).

**Mõju.** Ajutiselt aeglane SMTP võib põhjustada sama teavituskirja kordussaatmise. Vastupidises crash/lease olukorras märgitakse vana SENDING rida `UNKNOWN`-iks ja automaatne saatmine peatub (`notificationDelivery.js:76-82`, `:84-89`), mistõttu sama ebamäärane tulemus võib sõltuvalt tõrkest tähendada kas duplikaati või kadunud kirja.

**Vastuvõtukriteerium.** Timeout peab reaalselt katkestama transpordi või kasutama püsivat provider-delivery identifikaatorit ja teadlikku UNKNOWN/reconcile lepingut. Testid peavad katma timeout'i järel hilise õnnestumise ning protsessikatkestuse pärast SMTP vastuvõttu, enne DB `SENT` kirjutust.

**Seis (12.08.2026): DONE — timeout on TEADMATUS (`UNKNOWN`), mitte pime korduskatse.**

`withTimeout()` ei anna transpordile abort-signaali, seega timeout ei ütle, kas SMTP kirja vastu
võttis. Vana kood pani rea `RETRY`-ks (võimalik duplikaat), kuigi SAMA teadmatus lease-taastel
läks juba `UNKNOWN`-i (saatmine peatub). **Üks ebamäärane tulemus ei tohi kahte eri asja
tähendada** — mõlemad on nüüd `UNKNOWN`.

Teavituskiri on inimesele suunatud uudis, mitte kandja: teine „sul on uus teade" on pigem müra kui
abi. Sama valik nagu SOL-PAY-11-s, kus kandja-kiri korratakse ja uudis ootab inimest.

**Selge SMTP-tõrge käitub endiselt korduskatsena** — teadmatus ja tõrge on kaks eri asja ja see
vahe on nüüd koodis. Vana test lukustas just selle vea (timeout'i peal `assert.equal(…, "RETRY")`)
ja on ümber kirjutatud.

**KATMATA:** päris `abort`-i SMTP-transpordil ikka ei ole (`lib/mailer.js` socket-tasand) —
`UNKNOWN` on selle piiri aus nimi, mitte katkestus. `UNKNOWN` rea lahendamiseks ei ole admini
nuppu. Kriteeriumi teine test („protsessikatkestus pärast SMTP vastuvõttu, enne DB `SENT`
kirjutust") on kaetud sama seisuga, aga eraldi katkestustesti ei ole kirjutatud: lease-taaste
rada, mis selle olukorra lahendab, oli koodis juba enne ja jääb muutmata.

### SOL-NOTIF-06 — ühe varasema sweep'i viga jätab välitöö ohutuskontrolli ja kiire abi aegumise käivitamata — P1

**Tõend.** Notification-job paneb mentorluse, reconciler'i, projektori, e-posti delivery, välitöö dead-man kontrolli ja kiire abi aegumise ühe `try` ploki järjestikusteks await'ideks (`app/api/jobs/notifications/route.js:31-76`). Välitöö ja kiire abi sweep'id käivituvad kõige viimasena. Ükskõik millise varasema etapi visatud viga hüppab ühisesse catch'i ning hilisemaid etappe ei kutsuta; ka kuni 300 järjestikuse lehekülje töö ajapiir võib nendeni jõudmise takistada.

**Mõju.** Tavalise teavituse, mentorluse või e-posti infrastruktuuri rike võib blokeerida ajakriitilise välitöö check-in eskalatsiooni ja kiire abipalve nähtava lõpetamise. Need ohutusfunktsioonid pärivad endast sõltumatu süsteemi töökindluse.

**Vastuvõtukriteerium.** Ohutuskriitilised sweep'id peavad olema eraldi ajastatud töödes või vähemalt eraldatud veapiiride, iseseisvate eelarvete ja nähtava etapistaatusega. Veasüstitest peab sundima iga varasema etapi eraldi ebaõnnestuma ja tõendama, et field-safety ning urgent-expiry siiski käivituvad täpselt üks kord.

**Seis (12.08.2026): DONE — iga etapp jookseb oma veapiiri sees ja ohutusetapid käivituvad ALATI; `npm run notif:progress:probe` 14/14 (jaam 6, veasüst on päris andmebaasi trigger).**

Kuus etappi olid ühes `try` plokis ja välitöö dead-man kontroll ning kiire abi aegumine olid
viimased — ükskõik millise varasema etapi viga hüppas ühisesse `catch`-i ja need kaks jäid
käivitamata. Nüüd on igal etapil oma veapiir (`runStage`), oma leheküljeeelarve ja **nähtav seis
vastuses**: `stages`, `failedStages` ja eraldi `safetyOk`.

**Vastus ei valeta enam edu:** kukkunud etapiga jooks annab `207` ja `ok: false`, aga
ohutusetapid on ikka käinud ja see on eraldi loetav.

Veasüst on päris: sond paigaldab `NotificationEvent`-i peale ajutise trigger'i, mis viskab erindi
ainult tema rea peale → reconcile-etapp kukub, **välitöö ohutuskontroll ja kiire abi aegumine
käivituvad siiski** ja kukkunud etapp on nimeliselt kirjas. Etapi ühekordsus tuleb `runStage`
lepingust ja on eraldi ühiktestiga lukus.

**KATMATA:** kriteeriumi „eraldi ajastatud töö" haru ei ole valitud — sweep'id sõidavad endiselt
sama taimeriga, aga nüüd eraldatud veapiiride ja eelarvetega. Eraldi systemd-üksus oleks
ops-otsus (uus taimer, uus võti, uus jälgimispind) ja ta ei ole selle leiu ulatuses.
**Veasüst kattis ühe varasema etapi (reconcile), mitte iga etappi eraldi** — piir on `runStage`
tasemel ja ühiktest mõõdab teda otse, aga „iga varasem etapp eraldi" täht on täitmata.

### SOL-EVENT-01 — domeenisündmuse idempotentsuskonflikt ei kontrolli, kas olemasolev sündmus vastab uuele teole — P2

**Tõend.** `emitDomainEvent()` valideerib uue payload'i, kuid unikaalsuskonflikti korral otsib rea ainult `idempotencyKey` järgi ja tagastab selle eduna (`lib/events/emitDomainEvent.js:19-56`). Ta ei võrdle tüüpi, allikat, actor'it, actionTarget'it, aega ega metaandmeid. Test kinnitab vaid identse teise kutse `created: false` tulemuse ega proovi sama võtit erineva payload'iga (`tests/events/emitDomainEvent.test.js:34-46`).

**Mõju.** Kliendi- või serveriveaga taaskasutatud võti võib anda põhitehingule näilise sündmuse edu, kuigi outbox'is on teise teo sündmus. Teavitused ja auditeeritav tegevusjada kirjeldavad siis vale või puuduvat muudatust.

**Vastuvõtukriteerium.** Sama võti peab olema edukalt idempotentne ainult kanoniseeritult sama sündmuse puhul; teistsugune teoidentiteet peab andma selge konflikti ja katkestama sama tehingu. Testid peavad võrdlema vähemalt type/source/actor/action/meta erinevusi.

**Seis (12.08.2026): DONE — sama võti annab edu ainult sama teo peal, teistsugune teoidentiteet
katkestab tehingu; sond 13/13 päris PostgreSQL-is.**

Olemasolu küsitakse nüüd **enne** kirjutamist. Identiteet on kogu salvestatav kuju ja ta on
kokku pandud **välistamise, mitte lubamise kaudu**: uus väli `data`-s satub võrdlusesse
iseenesest. Nii ei teki vaikset auku siis, kui sündmusele hiljem väli lisatakse — lubamisloend
oleks selle unustanud ja vaikimine oleks tähendanud „sama tegu".

**Ainus väljajäetu on `occurredAt` ja see on teadlik.** Ta ütleb, millal me sündmust MÄRKASIME,
mitte mis juhtus. Kutsuja, kes aega ei anna (juhtumitugi, kelle võti on auditirea id), saab
igal katsel uue `new Date()` — aja võrdlemine oleks muutnud just selle korduse, mille jaoks
idempotentsus olemas on, kõvaks konfliktiks. Kutsujad, kelle jaoks aeg ON teo osa (teekond,
eelpöördumine), panevad ta ise võtme sisse; seal eristab aja juba võti.

**Suurem asi, mille see leid välja tõi, ei ole identiteet.** Vana kood lootis, et pärast
`P2002` saab SAMAS tehingus rea `findUnique`-ga üles küsida. Postgres märgib tehingu pärast
unikaalsusrikkumist vigaseks ja iga järgnev käsk selles tehingus kukub. Sondi jaam 4 mõõdab
täpselt selle ja vastus on sõna-sõnalt `current transaction is aborted, commands ignored until
end of transaction block`. Vana „leidsin rea, kõik hästi" haru **ei ole kunagi päris
andmebaasis töötanud** — ta töötas ainult fake-Prisma peal, kelle `findUnique` vastab rõõmsalt
ka pärast viga. Sama klass nagu SOL-PAY-08 juures: `catch (P2002)` tehingu sees on vaikne
andmekadu, mitte taastumine.

Seepärast **võidujooksu enam alla ei neelata**. Kui keegi jõudis meie kontrolli järel ette, on
tehing sel hetkel juba vigane ja ainus aus vastus on kukkuda; kutsuja kordus leiab rea eespool
oleva kontrolliga üles ja lõpeb idempotentselt. Veal on märgis (`domainEventRace`), et logis
oleks võidujooks eristatav — päritav `P2002` jääb muutmata, sest kutsujad võivad teda ise
tunda.

Konflikti veas on **ainult väljanimed**, mitte väärtused (`differingFields`): väärtused võivad
olla isikustatud ja logi ei ole nende koht.

Väravad: `npm test` **3958/3958** (Europe/Tallinn ja UTC) · i18n · eslint · `db:migrate:check`
OK · `npm run event:idempotency:probe` **13/13**. Migratsiooni ei ole vaja.
**Negatiivkontroll: kaheksast uuest testist kukub vana teostuse peal kuus** — viis
identiteedierinevust ja võidujooks. Ülejäänud kaks (tühi vs puuduv meta, hilisem märkamisaeg)
läbivad ka vana koodi: nemad ei tõenda parandust, vaid **lukustavad otsuse**, et kumbki neist
EI ole uus tegu.

**KATMATA:** `version` tõus registris muudab vana võtme mittekorduvaks — see on tahtlik ja
vali, aga tähendab, et versioonimuutuse päeval kukub sama võtmega kordus konfliktiga, mitte ei
lähe vaikselt läbi. Sondi võidujooks on **järjestatud mähisega** (päringud on päris, aga
põimingu panen mina paika), mitte kellaajapõhine — kellaajapõhine oleks olnud hüplik.

### SOL-NOTIF-07 — teavituste loendi fikseeritud kahekordne eelvalik võib peita vanemad kehtivad teated — P2

**Tõend.** `listNotificationEvents()` loeb andmebaasist maksimaalselt `limit × 2` uusimat rida ja alles seejärel kontrollib iga rea praegust adressaadiõigust (`lib/notifications.js:963-1006`). Kui selles eelvalikus on pärast liikmesuse või allika oleku muutust piisavalt nähtamatuid ridu, neid lihtsalt vahele jäetakse; päring ei jätka järgmise andmebaasileheküljega ning API-l pole siin sisemist jätkukursorit.

**Mõju.** Kasutaja võib näha tühja või poolikut teavituste loendit ja badge'i, kuigi tal on vanemaid endiselt kehtivaid lugemata teateid.

**Vastuvõtukriteerium.** Autoriseeritud valik tuleb teha päringus või jätkata turvaliselt lehekülgede kaupa, kuni `limit` nähtavat rida või andmete lõpp on saavutatud. Test peab asetama rohkem kui `limit × 2` nähtamatut teadet uuemateks kui üks kehtiv lugemata teade.

**Seis (12.08.2026): DONE — loend liigub lehekülgede kaupa, kuni nähtavaid ridu on `limit`; sond 14/14 (jaam 5).**

Vana kood luges `limit × 2` uusimat rida ja kontrollis adressaadiõigust alles pärast seda: kui
selles aknas oli piisavalt nähtamatuks muutunud ridu (liikmesus lõppes, allikas suleti), jäid
vanemad KEHTIVAD teated lihtsalt välja — kasutaja nägi tühja loendit, kuigi tal oli lugemata
teateid. Päring jätkab nüüd kursoriga järgmise leheküljega, kuni nähtavaid on `limit` või andmed
said otsa.

**Ülempiir on 25 lehekülge** ja see on teadlik: vigane või liiga range õigusekontroll ei tohi
muutuda lõputuks skaneeringuks. Piir on kordades suurem kui vana `limit × 2` aken.

Sond kirjutab 12 nähtamatut teadet (ruum, kust kasutaja on lahkunud) ÜHE kehtiva peale ja loeb,
et kehtiv leitakse üles; ühiktest mõõdab sama 120 reaga ja kontrollib, et päring päriselt liikus
mitme lehekülje kaupa.

### SOL-URG-01 — 200 ajaloolist kirjet võivad kõik uued kiireloomulised abipalved laua eest peita — P0

**Tõend.** Põhiline laua järjekord küsib kõik sama laua pöördumised vanimast alates, ilma olekufiltri või kursorita, ja rakendab `take: 200` (`lib/urgent/deskQueue.js:82-103`). Ka alternatiivne `GET /api/urgent-requests?role=desk` kasutab sama `orderBy: sentAt asc` + `take: 200` mustrit (`app/api/urgent-requests/route.js:56-76`). Lõpetatud, tagasi võetud ja aegunud read jäävad valikusse püsivalt.

**Mõju.** Niipea kui laual on ajaloos 200 vanemat pöördumist, ei jõua 201. ega ükski hilisem abipalve töötaja nähtavasse järjekorda. Inimesele on antud lugemisaja lubadus, kuid aktiivne uus pöördumine võib deterministlikult nähtamatuks jääda.

**Vastuvõtukriteerium.** Järjekord peab võtma kõik vastust ootavad ja pooleliolevad kirjed enne ajalugu ning ajalugu peab olema stabiilselt lehekülgitav. Test peab looma vähemalt 201 lõpetatud vana rida ja ühe uue SENT rea ning tõendama, et uus rida on esimesel lehel ja loendurites.

**Seis (10.08.2026): DONE — töö ja ajalugu on eri päringud. Commit `0dd6bb18`.**

Parandus **ei ole suurem `take`** — suurem number lükkab sama vaikse kadumise lihtsalt
edasi. Vastust ootavad ja pooleliolevad kirjed (`SENT`, `READ`, `TAKEN`) on oma päring,
mis ei jaga mahtu ajalooga; ajalugu on eraldi ja lehekülgitav. Olemasolev indeks
`[deskId, status, sentAt]` katab mõlemad, **migratsiooni ei ole vaja**.

See **ei ole triaaž** (mooduli reegel 1). Inimesi ei järjestata hinnangu ega
kiireloomulisuse järgi — töö ja ajalugu on eri asjad nagu postkast ja arhiiv, ja ajaline
järjestus kehtib mõlema sees muutmata kujul.

**Ajalugu on ASC ja nihkepõhine, mitte DESC.** Nihkepaginatsioon on ebastabiilne siis, kui
uued read tulevad loendi ETTE: iga lisandumine nihutab kõiki lehti ja lugeja näeb sama
rida kaks korda või ei näe üldse. Ajalugu kasvab ainult lõpust, seega ASC-järjestuses ei
nihuta uus rida ühtegi juba loetud lehte. `id` on tie-breaker — muidu võib sama
millisekundi kaks rida lehtede vahele kaduda.

**Loendurid tulevad andmebaasist**, mitte lehelt. Vana kood luges nad samast kärbitud
massiivist, seega number valetas koos loendiga: „0 ootab" oli võimalik siis, kui ootas 40.

Aktiivsete lagi 500 on **ohutusventiil, mitte lehekülg** — täitumisel tuleb
`activeTruncated` ja vaade ütleb seda inimesele. Vaikne lõikamine näeb välja täpselt nagu
„rohkem ei olegi" ja just see peitis siin uued abipalved. Sama parandus kehtib ka
`GET /api/urgent-requests?role=desk` jaoks: valik elab nüüd ühes kohas
(`selectDeskRequests`), mitte kahes koopias.

Väravad: `npm test` **3359/3359** (Europe/Tallinn ja UTC) · i18n roheline · eslint puhas ·
**negatiivkontroll: kõik 4 uut testi kukuvad vana teostuse peal**. Fake sai `orderBy` ja
`skip` — ilma nendeta oleks lehekülgitamise test mõõtnud, mis järjekorras test ise read
lisas.

**NOT_PROVEN:** päris PostgreSQL-i ega autenditud brauseriga ei ole läbi käidud — fake ei
jõusta indekseid ega päris `skip`-i.

### SOL-URG-02 — konto kustutamine jätab kiire abi nime, telefoni ja olukorra toorteksti andmebaasi — P0

**Tõend.** `UrgentRequest` hoiab `situationVerbatim`, `assistantStructured`, `contactName` ja `contactPhone` välju; kasutajaseos on `onDelete: SetNull` (`prisma/schema.prisma:5962-6021`). Konto kustutuse lõpptehing puhastab saadetud `PreInquiry` read, seejärel kustutab User rea, kuid ei uuenda ühtegi `UrgentRequest` rida (`lib/privacy/effectivePracticeAccountCleanup.js:144-176`). Ka kustutuse sihtide kogumine ja orkestreerimine ei hõlma kiire abi kirjeid (`lib/privacy/userDeletion.js:17-65`, `:132-154`). `authorErasedAt` on skeemis olemas, kuid seda rada ei kirjutata.

**Mõju.** Inimese konto ja autoriviide kaovad, kuid eriti tundlik abivajaduse kirjeldus ning otseselt tuvastavad nimi ja telefon säilivad muutmata. Konto kustutuse tulemus `ok: true` annab seetõttu ebaausa privaatsusgarantii.

**Vastuvõtukriteerium.** Omanik peab määrama kiire abi õigusliku retentsiooni ja pärast konto kustutust vajaliku minimaalse vastutusjälje. Kustutustöö peab samas taastatavas protsessis kas read kustutama või eemaldama toorsisu ja kontaktid ning märkima anonümiseerimise aja; negatiivne test peab kontrollima andmebaasi pärast päris kustutustehingut, mitte ainult User rea puudumist.

**Seis (10.08.2026): DONE — sisu ja kontaktid kaovad, vastutusjälje skelett jääb. Commit `97b28080`.**

`authorErasedAt` oli skeemis juba olemas ja seda rada ei kirjutanud **keegi** — väli ilma
mehhanismita on lubadus ilma katteta. Nüüd puhastab sama lukustatud tehing enne `User` rea
kustutamist `situationVerbatim`, `assistantStructured`, `contactName` ja `contactPhone`
ning stambib `authorErasedAt`. `""` mitte `null`, sest need veerud on skeemis NOT NULL.

**Miks rida jääb, aga sisu kaob.** Vastuvõtulaud kannab lugemisaja lubadust ja selle
täitmine on KOV-i vastutus — „kas see pöördumine loeti läbi lubatud aja jooksul" peab
jääma vastatavaks ka pärast seda, kui inimene oma konto kustutab. Rea skelett (laud,
seisud, kellaajad, sündmuslogi) ongi see vastutusjälg; sisu ja kontaktid ei ole
vastutusjälg.

Kutse on **tingimusteta**. `tx.urgentRequest?.updateMany ? … : { count: 0 }` oleks siin
fail-open: puuduv mudel muutuks vaikseks nulliks ja kustutus vastaks endiselt `ok: true` —
täpselt see, mida leid punub. Tõrke korral kukub kogu tehing tagasi ja kustutustöö läheb
`failed` seisu, kus teda korratakse.

**Sama parandusega läks kinni [SOL-PRE-01](#sol-pre-01--konto-kustutamine-jätab-saatmata-eelpöördumiste-tundliku-sisu-autorita-alles--p0)**,
sest need kaks leidu elavad ühes funktsioonis ja ühe inimese ühe tekstiga: konversioon
kopeerib kiire abi verbatim-teksti eelpöördumise mustandisse. Ainult URG-02 parandamine
oleks jätnud täpselt samad sõnad andmebaasi teise tabeli alla ja „DONE" oleks olnud
eksitav.

Väravad: `npm test` **3359/3359** (Europe/Tallinn ja UTC) · eslint puhas ·
**negatiivkontroll: 8 uut/muudetud testi 10-st kukub vana teostuse peal** (kaks on
regressioonivalve, mis peabki mõlemal pool roheline olema). Testid kontrollivad
**andmebaasi**, mitte kutseid — fake rakendab `updateMany`/`deleteMany` ridadele, nagu
kriteerium sõnaselgelt nõuab.

**LAHTINE OMANIKULE:** kriteeriumi esimene pool — kiire abi õigusliku retentsiooni
**tähtaeg** (kui kaua anonümiseeritud skelett alles jääb) — on endiselt määramata. See on
otsus, mitte kood, ja ma ei ole seda enda eest teinud.

**NOT_PROVEN:** päris PostgreSQL-i tehingut ega FK-kaskaadi ei ole läbi käidud.

### SOL-URG-03 — server ja vorm käsitlevad vastamata ohuküsimust vastusena „ei” — P1

**Tõend.** Domeenifunktsiooni `safetyAnswer` vaikimisi väärtus on `false` ja loomine ei nõua, et sisend oleks päriselt boolean (`lib/urgent/request.js:188-215`). Route teisendab puuduva, `null` või vigase väärtuse avaldisega `body?.safetyAnswer === true` samuti `false`-ks (`app/api/urgent-requests/route.js:34-47`). UI algseis on `null`, kuid review kontrollib ainult `true` ning laseb `null` väärtusega kinnitusekraanile (`components/urgent/UrgentRequestForm.jsx:202-216`); saatmisel teisendatakse see `false`-ks (`:219-233`).

**Mõju.** Kasutaja saab saata kiireloomulise pöördumise ilma küsimusele „kas keegi on ohus?” vastamata. Tekstipõhine tuvastaja on ainult heuristika ega asenda kasutaja otsest ohukinnitust.

**Vastuvõtukriteerium.** Nii UI kui server peavad nõudma eksplitsiitset boolean-vastust; `true` viib alati hädaabirajale ning ainult otsene `false` lubab järgmise sammu. Testid peavad katma puuduva, `null`, stringi, 0, `false` ja `true` sisendi nii domeenis kui HTTP-route'is.

**Seis (12.08.2026): DONE — edasi pääseb ainult OTSENE „ei".**

Puuduv, `null`, string ja `0` on teadmatus, mitte eitus. Vaikeväärtus `false` ja marsruudi
`=== true` teisendus tegid koos seda, et vastamata ohuküsimus libises vaikselt eitusesse ja
pöördumine läks tavajärjekorda. `true` ja tekstituvastaja tabamus lähevad endiselt esimesena
hädaabirajale; teadmatus on VALIDEERIMISVIGA, mitte 112-ekraan — 112 antakse siis, kui midagi
VIITAB ohule, mitte siis, kui vastus on lihtsalt puudu. Ka vorm ei lase vastamata küsimust enam
kinnitusekraanile ja saadab väärtuse toorelt, sest server peab teadmatust NÄGEMA.

Testid katavad kõik kuus kuju (puuduv, `null`, string, `0`, `false`, `true`) NII domeenis KUI
päris HTTP-kutses — marsruut võtab selleks süstitavad sõltuvused nagu `app/api/register/route.js`.

### SOL-URG-04 — klient saab suvalise teksti vastuvõtjale „AI koostatud mustandina” salvestada — P1

**Tõend.** POST-route võtab `assistantStructured` otse päringu kehast ja domeenikiht salvestab selle üksnes pikkust kärpides (`app/api/urgent-requests/route.js:34-47`, `lib/urgent/request.js:201-239`). Laua projektsioon kannab väärtuse edasi (`request.js:617-639`) ning UI märgistab selle sõnaselgelt „AI koostatud mustandiks” ja „Masina mustandiks” (`components/urgent/UrgentDeskView.jsx:46-55`). Tavaline vorm seda välja ei saada, kuid serveril puudub päritolutõend.

**Mõju.** Muudetud klient või otsene API-kutse saab panna töötajale nähtava autoriteetse AI-sildi alla inimese enda või ründaja koostatud teksti. See võib moonutada kiire abi vastuvõtja arusaama ja rikub verbatim/AI päritolupiiri.

**Vastuvõtukriteerium.** Avalik loomise endpoint ei tohi AI-välja usaldada. Mustand peab tekkima serveris kontrollitud protsessist koos mudeli/provenance'i ja sisendiseosega või jääma tühjaks; test peab tõendama, et kliendi `assistantStructured` lükatakse tagasi või ignoreeritakse.

**Seis (12.08.2026): DONE — AI-mustandit ei võeta kliendilt.**

Väli oli avalikust päringu kehast läbi kirjutatav ja laua vaade märgistab ta „AI koostatud
mustandiks". Muudetud klient sai seega panna oma teksti masina autoriteedi alla. Serveripoolset
tootjat, kes kannaks mudelit, päritolu ja sisendiseost, EI OLE OLEMAS — mõõdetud, mitte
eeldatud: ainus kirjutaja oli see endpoint. Väli jääb seetõttu TÜHJAKS kuni tootja tekib. Tühi
mustand on aus; tõendamata mustand ei ole.

**KATMATA:** pärandread, mis said väärtuse vana raja kaudu, jäävad alles — nende puhastus on
andmetöö, mitte koodiparandus. Kuvalepe (verbatim ja mustand on kaks eri välja) kehtib edasi.

### SOL-URG-05 — kiire abi olekumuutus ja kohustuslik vastutusjälg ei ole üks tehing — P1

**Tõend.** Loomine kirjutab esmalt `UrgentRequest` rea ja seejärel eraldi CREATED sündmuse (`lib/urgent/request.js:217-247`). READ, TAKEN, DECLINED, RESOLVED, RECALLED, EXPIRED, HANDED_OVER ja HANDOVER_ACCEPTED rajad uuendavad samuti esmalt põhirea ning kutsuvad alles pärast seda eraldi `recordEvent()`-i (`:295-535`). Ükski neist ei ava Prisma tehingut. Route'i ühine veakäsitlus muudab auditirea vea 500-ks, kuigi põhiseis on juba muutunud (`lib/urgent/routes.js:68-82`).

**Mõju.** Kohustuslik „kes mida millal” jälg võib puududa, kuid inimese pöördumine olla loodud, loetud, võetud, lõpetatud või üle antud. Loomise retry võib luua teise pöördumise; olekutoimingu retry võib anda konflikti, sest esimene katse tegelikult muutis seisu.

**Vastuvõtukriteerium.** Põhirida ja vastutusjälg peavad sündima samas andmebaasitehingus ning toimingul peab olema stabiilne idempotentsusvõti. Veasüstitest peab katkestama iga sündmuse kirjutuse ja tõendama kas täielikku rollback'i või taastatavat outbox-seisu.

**Seis (12.08.2026): DONE — iga siire on üks tehing.**

Seis muutus ühes kirjutuses ja vastutusjälg tekkis teises: jälje viga andis 500, aga seis oli
juba muutunud. Kohustuslik „kes mida millal" võis puududa pöördumise kohta, mis oli loodud,
loetud, võetud, lõpetatud või üle antud — ja loomise kordus tegi TEISE pöördumise, sest inimene
arvas, et esimene ei läinud.

Veasüst tabab teist sammu (jäljekirjutust) ja mõõdab, et esimene ei jää alles. Sondi jaam teeb
sama PÄRIS andmebaasi trigger-iga.

### SOL-URG-06 — olekusiirded on kontrolli järel tingimusteta kirjutused ja võivad paralleelselt üksteist üle kirjutada — P1

**Tõend.** Funktsioonid loevad rea, kontrollivad JavaScriptis vana `status`/`readAt`/handover seisu ning teevad seejärel `update({ where: { id } })` ilma oodatud olekut WHERE-tingimusse lisamata (`lib/urgent/request.js:307-421`, `:433-456`, `:469-535`). Näiteks recall võib pärast enda SENT kontrolli võita vahepealse READ-i; expiry võib pärast valikut võita TAKEN-i; kaks TAKE'i võivad mõlemad õnnestuda; vana handover-accept võib võita vahepealse uue üleandmise.

**Mõju.** Töötaja loetud või võetud pöördumine võib muutuda tagasi võetuks/aegunuks, kaks töötajat võivad mõlemad arvata, et nad võtsid vastutuse, ja üleandmine võib liikuda vale laua kätte. Auditiread võivad kirjeldada omavahel võimatut järjestust.

**Vastuvõtukriteerium.** Kõik siirded peavad olema võrreldava versiooni või tingimusliku `updateMany` abil atomaarsed ning vastutusjäljega samas tehingus. Päris DB paralleeltestid peavad võistlema vähemalt READ↔RECALL, TAKE↔EXPIRE, TAKE↔TAKE ja HANDOVER↔ACCEPT rajad ning lubama ainult ühe korrektse võitja.

**Seis (12.08.2026): DONE — oodatav seis elab WHERE-tingimuses.**

Kontroll käis JavaScriptis ja kirjutus oli tingimusteta `update({ where: { id } })`. Kahe sammu
vahele mahtus võõras siire. Nüüd on oodatav seis päringus ja VÕITU MÕÕDETAKSE LOENDIGA: `count`
0 tähendab „keegi jõudis ette" ja see on vastus võistlusele, mitte viga andmebaasis.

`npm run urgent:race:probe` võistleb kõik neli kriteeriumis nõutud rada PÄRIS PostgreSQL-is ja
deterministlikult — kaotaja klient on mähitud nii, et ta LOEB rea enne võitja tehingut ja
KIRJUTAB alles pärast teda. Aegumine on ainus, mis kaotuse peale ei kuku: ta jätab selle rea
rahule ja liigub edasi, sest üks võistlus ei tohi terve korje ette jääda.

### SOL-URG-07 — „Võtan” ei salvesta pöördumise vastutavat töötajat — P1

**Tõend.** TAKE-route'i leping ütleb, et vastutus läheb nimeliselt töötajale (`app/api/urgent-requests/[requestId]/take/route.js:15-29`), kuid `UrgentRequest` mudelis puudub `takenByUserId`/assignee väli (`prisma/schema.prisma:5962-6028`). `takeUrgentRequest()` kirjutab ainult `status`, `takenAt` ja `readAt`; actor jääb sündmusrea sisse (`lib/urgent/request.js:324-345`). Pärast TAKE'i võivad kõik sama laua töötajad pöördumise lõpetada või sellest keelduda, sest kontrollitakse ainult laualiikmelisust (`:355-397`).

**Mõju.** Aktiivse pöördumise praegust vastutajat ei saa üheselt pärida, järjekorras kuvada ega jõustada. Kahe TAKE-sündmuse või liikuvate liikmesuste korral ei ole sündmuslogist turvaliselt tuletatav, kes praegu vastutab.

**Vastuvõtukriteerium.** Põhiseis vajab nimelist ja FK-ga seotud assignee/vastutaja välja ning selget ümbervõtmise lepingut. TAKE peab selle atomaarselt seadma; resolve/decline õigused peavad vastama omaniku otsusele. Paralleeltest peab tõendama üht vastutajat.

**Seis (12.08.2026): DONE — vastutaja on põhirea peal, mitte ainult sündmuslogis.**

`takenByUserId` on FK-ga ja `SetNull`-iga: konto kustutus ei hävita pöördumist ega võltsi
vastutajat. „Võtan" seab ta ATOMAARSELT ja tingimus `takenByUserId: null` teeb kahest samaaegsest
võtmisest ühe võitja.

Ta on LAUA tööinfo: `deskProjection` kannab teda, `authorProjection` EI KANNA — pöördujale
lubati lugemisaeg, mitte töötaja nimi.

Migratsioon ei puuduta olemasolevaid ridu. Sündmusreast tuletatud backfill oleks täpselt see
turvamatu tuletus, mille pärast veerg üldse tekkis; vana TAKEN rida ilma vastutajata on aus seis
(„me ei tea, kes"), mitte tagasiulatuv oletus.

**OMANIKU OTSUS (O-URG-1):** ümbervõtmist EI OLE — võetud pöördumise uuesti võtmine annab
konflikti. Ka `resolve` ja `decline` jäävad LAUALIIKMESUSE, mitte vastutaja õiguseks: öine
vahetus peab saama töö lõpetada. Kui vastutus peab olema ainuõigus või ümbervõetav, on see
tooteotsus, mitte tehniline valik.

### SOL-URG-08 — üleandmine lubab aktiivset, kuid tegelikult mittevalmis sihtlauda — P1

**Tõend.** Uue pöördumise loomine lubatakse ainult täieliku `deskReadiness` kontrolli järel: aktiivne liige, värske kinnitus, otsekontakt, tingimused ja kehtiv eluiga (`lib/urgent/desk.js:63-106`, `lib/urgent/request.js:127-157`). Üleandmine kontrollib sihtlaual ainult olemasolu ja `isActive === true` (`request.js:469-505`). Ta ei kontrolli aktiivset mehitajat, kinnituse värskust ega muid valmisolekutingimusi.

**Mõju.** Kiire abipalve saab anda lauale, mille viimane töötaja on eemaldatud või mille tingimused/kinnitus on aegunud. Saabuv üleandmine võib seetõttu jääda ilma reaalse vastuvõtjata.

**Vastuvõtukriteerium.** Üleandmise siht peab läbima asjakohase serveripoolse vastuvõtuvalmiduse kontrolli tehingu hetkel; kui suletud lauale üleandmine on erandina vajalik, peab selleks olema eraldi põhjendatud ja auditeeritud leping. Test peab katma mehitamata, stale, kinnitamata ja toimingu ajal suletud sihtlaua.

**Seis (12.08.2026): DONE — siht läbib sama vastuvõtuvalmiduse kontrolli mis uue pöördumise loomine.**

Vana kood küsis ainult „kas laud on olemas ja aktiivne". Juhtumi sai anda lauale, mille viimane
töötaja oli eemaldatud või mille kinnitus oli aegunud, ja saabuv üleandmine jäi ilma päris
vastuvõtjata. Kontroll käib nüüd TEHINGU HETKEL ja laua rea luku all, mitte hetk varem.

**KATMATA:** eraldi põhjendatud ja auditeeritud erandirada suletud lauale üleandmiseks EI OLE
tehtud. Kui üleandmine kinnisele lauale on päris vajadus, on see oma leping oma jäljega.

### SOL-URG-09 — laua valmidus võib loomise kontrolli ja kirjutuse vahel kaduda — P1

**Tõend.** `createUrgentRequest()` loeb laua ja aktiivsete liikmete arvu eraldi päringutega, arvutab valmiduse ning alles seejärel loob pöördumise (`lib/urgent/request.js:109-157`, `:217-239`). Laua sulgemine, tingimuse muutmine või viimase liikme eemaldamine ei ole sama tehingu/luku all ning create WHERE-piirangut ei eksisteeri.

**Mõju.** Admini või vahetuse samaaegne sulgemistoiming võib kasutajale edukalt luua pöördumise lauale, mis loomise hetkeks enam lubadust ei kanna. Avaliku availability tulemuse ja tegeliku vastuvõtu vahele tekib TOCTOU-auk.

**Vastuvõtukriteerium.** Valmiduse autoriteetsed read tuleb lukustada või loomine siduda versioonitud desk-seisuga ühes tehingus. Päris DB test peab võistlema create'i laua deaktiveerimise, tingimuse muutmise ja viimase liikme eemaldamisega.

**Seis (12.08.2026): DONE — laua rida ON valmiduse mutex.**

Valmidus koosneb kahest allikast (laua väljad ja aktiivsete liikmete arv) ja neid loeti eraldi
päringutega ilma lukuta. Admini sulgemine, tingimuse muutmine või viimase mehitaja eemaldamine
mahtus kontrolli ja kirjutuse vahele — inimesele öeldi „saadetud" lauale, mis lubadust enam ei
kandnud.

Lukk on MÕLEMAL pool: `updateUrgentDesk`, `setUrgentDeskActive`, `addUrgentDeskMember` ja
`removeUrgentDeskMember` võtavad sama `FOR UPDATE` luku. Ainult ühel pool lukustamine ei ole
lukk — teine pool sõidaks mööda. Avalik nähtavuspäring lukku EI võta: tema vastus on nagunii
hetkepilt ja lugemine ei tohi adminitoiminguid oodata.

Sondi kaks jaama mõõdavad luku PÄRIS mõju: admin hoiab tehingut lahti ja loomine PEATUB —
ootamine ise on tõend. Vana kood oleks samal ajal lõpuni jõudnud.

### SOL-URG-10 — paralleelne konversioon võib luua mitu eelpöördumise mustandit ja osalise tulemuse — P1

**Tõend.** Konversioon kontrollib esmalt `convertedPreInquiryId`, loob siis eraldi `PreInquiry` rea, uuendab kiire abi viite ja lõpuks kirjutab sündmuse (`lib/urgent/request.js:548-579`). Tehingut, request-row lukku ega toimingu idempotentsusvõtit ei ole. Skeemi unikaalsus kehtib ainult juba requesti külge kirjutatud `convertedPreInquiryId` väärtusele, mitte ühe requesti konversioonikatsete arvule (`prisma/schema.prisma:6008-6021`).

**Mõju.** Topeltklõps või retry võib luua mitu sama tundliku verbatim-tekstiga mustandit; viimane request update võidab ning ülejäänud mustandid jäävad kasutaja kontole orphan-andmetena. Vahepealne viga võib jätta mustandi ilma päritoluseoseta ja tagastada 500.

**Vastuvõtukriteerium.** Konversioon peab olema ühe tehingu, ühe stabiilse võtme ja request-row tingimusliku lukuga täpselt üks kord. Paralleeltest peab tõendama ühe `PreInquiry`, ühe viite ja ühe CONVERTED sündmuse.

**Seis (12.08.2026): DONE — konversioon on täpselt üks kord.**

Mustand sünnib tehingu sees ja viide kirjutatakse tingimuslikult (`convertedPreInquiryId: null`
WHERE-is). Kaotaja tehing veereb TERVIKUNA tagasi, seega tema mustandit ei jää kuhugi. Vana rada
tegi kolm eraldi kirjutust: topeltklõps lõi mitu mustandit sama tundliku verbatim-tekstiga,
viimane `update` võitis ja ülejäänud jäid kasutaja kontole päritoluseoseta koopiatena.

### SOL-URG-11 — kiire abi koond kärbib 20 000 rea järel vaikides ja kasutab Eesti kellaaja asemel UTC-d — P1

**Tõend.** Koond loeb ilma lehekülgitamise või truncation-indikaatorita maksimaalselt 20 000 rida (`lib/urgent/aggregate.js:62-83`). Päringul pole ka selget `orderBy`, seega pole määratud, milline osa suuremast valimist sisse jääb. Kellaaja bucket arvutatakse `sentAt.getUTCHours()` järgi (`:89-99`), kuigi raport kirjeldab inimeste pöördumise kellaaega ning platvormi tegevuskontekst on Europe/Tallinn.

**Mõju.** Raport võib alaloendada inimesi ja piirkondi ning liigitada Eesti hilisõhtuse/öise pöördumise valesse ajavööndibucket'isse. Otsustajale tagastatakse täieliku koondi kujuline, kuid teadmata ulatuses kärbitud tulemus.

**Vastuvõtukriteerium.** Koond peab töötlema kogu valimi DB-agregatsiooni või kontrollitud lehekülgitamisega ja kandma tõendatud timezone'i lepingut; ülempiiri korral tuleb fail-closed/truncated seis nähtavaks teha. Testid peavad katma üle 20 000 rea ning Tallinna suve- ja talveaja piirid.

**Seis (12.08.2026): DONE — kogu valim ja Eesti kell.**

`take: 20000` ilma `orderBy`-ta tähendas, et otsustajale tagastati TÄIELIKU koondi kujuline
vastus, millest oli teadmata osa välja jäänud — ja isegi see, MILLINE osa sisse jäi, oli
määramata. Koond liigub nüüd `id` kursoriga läbi kogu valimi. Ülempiir (200 × 5000) on
ohutusventiil, mitte lehekülg, ja tema täitumine tuleb vastuses välja (`truncated`) — sama
põhimõte nagu `suppressedGroups` ja SOL-URG-01 `activeTruncated`.

Kellaaja ämber tuleb EESTI seinakellast jagatud mooduli kaudu (`lib/time/estonianDay.js`), mitte
`getUTCHours()`-ist ega kohalikust getter-ist, mis loeks masina vööndit. Suvel nihutas UTC iga
öise pöördumise ämbri võrra valesti — ja „öö" on kogu funktsiooni mõte. Vastus ütleb ka välja,
MILLISE kella järgi ämbrid on. Testid katavad 20 001 rida, kärpeseisu ning suve- ja talveaja
mõlemad pooled.

### SOL-URG-12 — kiire abi partnerikinnitus ja kriitilised lauamuudatused ei salvesta otsustajat ega auditit — P1

**Tõend.** `verifyUrgentDesk()` kirjutab ainult `lastVerifiedAt` aja (`lib/urgent/deskAdmin.js:172-187`) ja skeemis pole `lastVerifiedByUserId` välja (`prisma/schema.prisma:5878-5943`). Verify-route nõuab üldist platvormiadmini õigust, kuid ei anna `authz.userId` funktsioonile edasi (`app/api/admin/urgent-desks/[deskId]/verify/route.js:23-31`). Sama puudutab tingimuste muutmist, aktiveerimist ning liikmete lisamist/eemaldamist; `app/api/admin/urgent-desks/**` ei kirjuta platvormi auditilogisse.

**Mõju.** „Partner kinnitas tingimused” ei ole tõendatav: andmebaas ütleb ainult aja, mitte kinnitaja ega tema seose partneriga. Samuti ei saa hiljem tuvastada, kes avas/sulges kiire abi kanali, muutis lubadust või eemaldas viimase mehitaja.

**Vastuvõtukriteerium.** Kinnitaja identiteet, roll/organisatsioon ja kinnitatud tingimuste versioon peavad olema püsivalt seotud kinnitusega. Kõik valmisolekut mõjutavad adminitoimingud vajavad kohustuslikku, põhimuudatusega atomaarset auditit ning negatiivset auditirea veatesti.

**Seis (12.08.2026): DONE — kinnitusel on kinnitaja ja tekstiversioon; igal adminitoimingul on jälg.**

Kinnitus on nüüd kolm asja: MILLAL, KES ja MILLIST teksti (`VERIFIED_CONDITION_FIELDS`
kanooniline sha256). Räsi on vajalik ka siis, kui tingimuse muutmine juba nullib kinnituse: see
reegel elab koodis ja võib muutuda, räsi aga on kinnituse enda juures ja vastab tagantjärele ka
siis, kui reegel oleks katki olnud. Tingimuse muutmine võtab nüüd ka KINNITAJA — vana kinnitaja
ei seisa uue teksti taga.

Iga valmisolekut mõjutav toiming kirjutab `DataAuditLog` rea PÕHIMUUDATUSEGA SAMAS tehingus.
Tegija on KOHUSTUSLIK: puuduva `actorUserId` peale ei kirjutata midagi — vaikimisi `null` oleks
tähendanud „keegi tegi" ja just see seis oli enne, sest marsruut teadis admini, aga ei andnud
teda edasi. Jälg kannab väljanimesid, mitte väärtusi; mehitaja eemaldamise real on
`remainingActiveMembers`, sest viimase mehitaja kadumine sulgeb piirkonna vaikselt.

**KATMATA:** kinnitaja ROLL ja ORGANISATSIOON ei ole kinnituse küljes eraldi väljadena — nad on
tuletatavad kasutaja ja auditirea kaudu. Kui partnerisuhe peab olema kinnituse enda peal
(nt „see inimene esindas SEDA organisatsiooni SEL päeval"), on see oma mudel.

### SOL-URG-13 — tundliku pöördumise täisloendi API möödub „iga vaatamine jätab jälje” lepingust — P1

**Tõend.** Üksikdetaili route kasutab teadlikult `viewUrgentRequest()` funktsiooni, mis kontrollib laualiikmelisust ja kirjutab VIEWED sündmuse (`app/api/urgent-requests/[requestId]/route.js:22-39`, `lib/urgent/request.js:289-303`). Kuid `GET /api/urgent-requests?role=desk` tagastab kuni 200 reale `deskProjection()` kuju otse (`app/api/urgent-requests/route.js:56-76`). See projektsioon sisaldab verbatim-teksti, AI-mustandit, nime, telefoni ja keeldumise põhjust (`lib/urgent/request.js:617-661`) ning ühegi rea kohta VIEWED sündmust ei teki.

**Mõju.** Volitatud lauatöötaja saab ühe päringuga lugeda kuni 200 inimese tundlikku sisu ilma lepingus nõutud isikulise vaatamisjäljeta. Olemasolev route-kuju test kontrollib ainult `[requestId]` detailirada ega tuvasta loendi bypass'i (`tests/urgent/requestRoutes.test.js:63-66`).

**Vastuvõtukriteerium.** Loendi endpoint peab tagastama ainult sisuta järjekorraprojektsiooni või kirjutama iga tegelikult avaldatud detaili kohta atomaarse vaatamisauditi; eelistatult eemaldada dubleeriv täisloendi rada. HTTP-test peab kontrollima nii vastuse välju kui VIEWED sündmuste teket.

**Seis (12.08.2026): DONE — dubleeriv täisloend on eemaldatud.**

`GET /api/urgent-requests?role=desk` tagastas kuni 200 rida laua projektsiooni kujul ilma ühegi
VIEWED sündmuseta, kuigi üksikvaate rada käib teadlikult `viewUrgentRequest()` kaudu just
selleks, et iga vaatamine oleks seotud inimese ja kellaajaga.

Rada on EEMALDATUD, mitte auditeeritud — see on ka kriteeriumi eelistatud lahendus. Mõõdetud:
laual on juba oma endpoint `/api/urgent-requests/desk-queue` SISUTA järjekorraprojektsiooniga ja
liides kasutab teda; `role=desk` kutsujat ei olnud üheski kliendis. Dubleeriv rada ei kandnud
ühtegi vajadust, ainult riski.

`410`, mitte vaikne ümbersuunamine autori loendile: vana klient peab saama teada, et ta küsib
asja, mida enam ei ole — mitte saama tühja vastust ja arvama, et järjekord on tühi.

### SOL-WB-01 — piloodi organisatsiooni- ja omavalitsusskoop ei jõua andmepäringusse — P1

**Tõend.** `WellbeingPilotScope` salvestab `scopeType`, `municipalityId` ja `organizationId` (`prisma/schema.prisma:1538-1557`). Juurdepääsukiht valib küll vaatajale konkreetse scope'i, kuid tagastab koondifiltriks ainult `pilotId`, `roleGroup`, ajavahemiku, workflow ja miinimumgrupi (`lib/wellbeing/pilotAccess.js:153-196`). `buildWellbeingAggregateDataset()` ignoreerib `pilotId` täielikult ning Prisma WHERE sisaldab vaid `roleGroup`, `workflowType`, aega ja üldisi lippe (`lib/wellbeing/aggregate.js:85-128`). `WellbeingRecord` ise ei kanna organisatsiooni ega KOV seost (`prisma/schema.prisma:1419-1462`).

**Mõju.** Ühe KOV või organisatsiooni piloodi vaataja näeb sama rollirühma koondit kogu platvormilt, mitte talle määratud asutusest. Vastus kannab piloodi metaandmeid, mistõttu laiem valim näib ekslikult kohaliku organisatsiooni tulemusena.

**Vastuvõtukriteerium.** Kirje peab saama serveris tõendatud ja ajaliselt külmutatud piloodi/organisatsiooni/KOV kuuluvuse või koond peab kasutama eraldi osalusprojektsiooni; kliendi enesedeklaratsioon ei sobi. Integratsioonitest peab looma sama rollirühma kahes organisatsioonis ning tõendama, et kummagi vaataja valimis pole teise asutuse ridu.

**Seis (12.08.2026): DONE — koos SOL-WB-02-ga, üks juur ja üks parandus.** Vt SOL-WB-02 all.

### SOL-WB-02 — kliendi suvaline `roleGroup` määrab, millise piloodi koondisse kirje läheb — P1

**Tõend.** Kõik loomisteenused annavad `payload.roleGroup` väärtuse muutmata builderile ja andmebaasi (`lib/wellbeing/records.js:216-483`). Route'id seovad ainult `ownerUserId` sessiooniga; rollirühma ei tuletata konto, organisatsiooniliikmesuse ega piloodiosaluse järgi. Koond filtreerib just seda stringi (`lib/wellbeing/aggregate.js:85-101`). UI saadab praegu fikseeritud `SOCIAL_WORKER`, kuid otsene API-kutse saab kasutada ükskõik millist väärtust.

**Mõju.** Iga tööheaolu õigusega kasutaja saab oma kirjeid paigutada teise piloodi rollirühma, kasvatada või muuta selle signaale ja aidata valimil künnise ületada. Raport ei ole seetõttu tõendatud organisatsiooniline mõõdik.

**Vastuvõtukriteerium.** Aggregatsioonis kasutatav rolli-/skoopvõti peab tulema serveri autoriteetsest ja ajaliselt külmutatud liikmesusest; payload'i roll võib olla üksnes kasutaja privaatne kirjeldus ega tohi juhtida pilootkoondit. Negatiivne HTTP-test peab proovima võõrast rollirühma.

**Seis (12.08.2026): DONE — SOL-WB-01 ja SOL-WB-02 on üks juur: koond ei teadnud, kelle
valimisse kirje kuulub, ja uskus selles küsimuses klienti.**

Parandus on **osalusprojektsioon** `WellbeingParticipation` (migratsioon **`20260812080000`**),
mitte veerud kirje peal — ja see ei ole stiilivalik. **§D8 on kõva piir: `WellbeingRecord` ei
saa organisatsiooni omandivõtit** ja seda hoiavad kaks lepingutesti (`tests/org/contracts.test.js`,
`tests/org/profileSupport.test.js`). Kriteerium ise pakub teise haru („või koond peab kasutama
eraldi osalusprojektsiooni") ja tema sai valitud: **lepingutesti ma ümber ei kirjutanud.**
Lähtekirje ei muutu organisatsiooni varaks — ta ei kanna ühtki organisatsiooni välja, omanik,
nähtavus ja kustutusrada ei muutu ning juhile ei avane ühtki uut lugemisteed. Avaneb ainult see,
mille omandileping juba ette näeb: anonüümne künnisega kaitstud koond.

**Rida sünnib ainult tõendatud osalusest** (`lib/wellbeing/participation.js`): täpselt üks
aktiivne `OrganizationMembership`. Kaks liikmesust = `null`, mitte esimene leitu — kahes majas
töötaval inimesel on üks tööpäev ja platvormil ei ole allikat, mis ütleks, kumma maja koormus
see oli. **Rea puudumine ei ole „kõigile", vaid „mitte ühelegi piloodile"**; sama piir mis
külastuse päritolul (`lib/serviceLog/visitOrigin.js`, SOL-SLOG-17/-18).

**Rollirühm tuleb istmerollist** (`seatRole`), mitte payload'ist. Kirje `roleGroup` veerg JÄÄB
alles kasutaja enda kirjeldusena — koond lihtsalt ei küsi teda enam. Nii ei kao kasutajalt
midagi ja tõend ei sõltu tema sõnadest.

**Piloodi skoop jõuab nüüd PÄRINGUSSE:** `resolveWellbeingPilotAggregateFilters()` annab
organisatsiooni/KOV piiri ja `buildWhere()` paneb ta WHERE-i. **Fail-closed:** skoop, mille tüüp
on `organization`, aga `organizationId` puudub, annab `403 scope_incomplete` — teostamata piir
tähendaks platvormiülest valimit ühe asutuse nime all. **Ka admin seotakse valitud piloodiga:**
varem oli `pilotId` tema käes dekoratsioon, mis jõudis vastuse metaandmetesse, aga ei piiranud
valimit. Vastus kannab nüüd `filters.organizationId` / `filters.municipalityId` — ta ütleb välja,
millise piiri all ta arvutati.

**Parandus PÄRIB osaluse, ei tuleta uuesti** (sama põhjus, mille pärast periood ja kontrollpunkt
juba päritakse): vahepealne töökohavahetus koliks muidu mullused andmed uue tööandja raportisse.
**Muutumatust jõustab andmebaas, mitte teenusekiht** — trigger `WellbeingParticipation_frozen`
(sama muster mis SOL-ORG-01). Lisamine ja kustutamine jäävad lubatuks (kirje sünd ja kaskaad);
muuta ei saa.

**`npm run wb:pilot:probe` 28/28 päris PostgreSQL-is** — kaks maja, sama rollirühm, kolm inimest
kummaski. Tõend on koondi enda väljund: A maja koondis 0 punast signaali, B maja omas 3, ja B
maja riskimarker ei ilmu A maja koondisse ühelgi kujul. **Kaks negatiivkontrolli:** vana reegel
(kirje enda `roleGroup` veerg, ilma osaluseta) loeb SAMADEST ridadest kõik üheksa — kuus kahest
majast, üks võõrast rollirühma väitnud teeskleja ja kaks tõendamata kontot, samas kui uus loeb
kolm · paranduse hetkel ANNAKS uuesti tuletamine juba B maja, aga parandus jääb A-sse.
Ühikuid 7 (`tests/wellbeing/participation.test.js`).

**Toodangus 0 `WellbeingRecord` rida, 0 pilooti ja 0 vaatajat** (mõõdetud enne migratsiooni
kirjutamist), seega backfilli ei ole ja kelleltki midagi ei kao.

**KATMATA ja omanikule teadmiseks:** liikmesuseta konto kirjed ei osale ÜHESKI piloodikoondis.
See on kriteeriumi otsene tagajärg („kliendi enesedeklaratsioon ei sobi"), aga tähendab, et
piloot mõõdab ainult organisatsiooni kaudu platvormil olevaid inimesi. Kui piloot peab katma ka
üksikkasutajaid, on vaja eraldi tõendatud osalusmehhanismi (nt kutsepõhine piloodiliikmesus) —
see on tooteotsus, mitte viga.

### SOL-WB-03 — server kontrollib ainult väljade olemasolu ning tundmatu ohuväärtus muutub madalaks riskiks — P1

**Tõend.** `records.js` validaatorid kontrollivad vaid, kas kõik võtmed on objektis, mitte väärtuste tüüpi ega lubatud loendit (`lib/wellbeing/records.js:64-152`). Skoorijad annavad tundmatule kategooriale `0` (`lib/wellbeing/quickCheck.js:98-100`, `lib/wellbeing/hardCase.js:31-33`, `lib/wellbeing/workplaceViolence.js:39-41`). Näiteks tundmatu `dangerStatus` ei nõua safety notice'it ja võib anda `no_immediate_danger`, sest ainult täpsed `ongoing`/`uncertain` väärtused käivitavad lukud (`workplaceViolence.js:47-52`, `:100-114`). String `"false"` on boolean-väljadel tõene.

**Mõju.** Vigane, vana või muudetud klient võib salvestada semantiliselt sobimatu kirje, kus teadmatus hinnatakse ohutuks. Isiklik soovitus, kontrollpunkt ja organisatsioonikoond saavad vale rohelise/madala signaali.

**Vastuvõtukriteerium.** Igal schemaVersion'il peab olema serveripoolne range skeem: täpsed enumid, booleanid, massiivielemendid, vabateksti pikkused ja unknown-key poliitika. Tundmatu safety-väärtus peab fail-closed katkestama. Testida iga töövoo kõiki välju vähemalt ühe vale tüübi ja tundmatu enumiga.

**Seis (12.08.2026): DONE — teadmatust ei hinnata enam ohutuks.**

Üheksa validaatorit küsisid täpselt üht asja: kas võti on objektis. Kuna skoorijad annavad
tundmatule väärtusele `0`, tähendas see, et **vale kirjapilt oli ohutu vastus**:
`dangerStatus: "ONGOING"` ei ole `ongoing` ega `uncertain`, seega `safetyNoticeRequired` jäi
`false`, ühtki riskimarkerit ei tekkinud ja signaal oli `no_immediate_danger`. Sama
`immediateDanger`-il, ja `"false"` (string) oli boolean-väljal tõene.

Kontroll elab nüüd ühes deklaratiivses skeemis (`lib/wellbeing/fieldSchemas.js`): iga töövoo iga
välja liik ja täpne lubatud väärtuste hulk, sh massiivielemendid, vabateksti piir (4000) ja
**unknown-key poliitika** — vana kliendi lisatud võti annab 400, mitte vaikse läbipääsu. Veavõti
ja `details.missing` jäid samaks, seega liidese tõlge ei murdu; juurde tulid `details.unknown` ja
`details.invalid`. **Skeem on ühes failis, mitte üheksas** — lahknemise hind oleks siin vale
ohuhinnang.

**Kaks lepingutesti hoiavad skeemi ausana:** liidese `initialFields` peab läbima serveri skeemi
ja väljade hulgad peavad olema identsed (muidu oleks „range skeem" kasutaja jaoks lihtsalt
katkine salvestusnupp), ning skeemi `schemaVersion` peab võrduma builderi omaga — versiooni
tõstmine ilma uue skeemita kukub testis, mitte toodangus.

**48 ühikut** (`tests/wellbeing/fieldSchemas.test.js`), sh **iga töövoo IGA väli** vale tüübi ja
tundmatu enumiga — valimit ei ole. **Negatiivkontroll on skoorija ise:** ta jäi teadlikult
muutmata ja test mõõdab, et ta ANNAB endiselt `no_immediate_danger` tundmatu ohuväärtuse peale;
tõend on see, et värav ei lase seda väärtust temani. Sama string-boolean'iga.

### SOL-WB-04 — koondi `sampleSize` on inimesed, kuid meetrikad on piiramata kirjete arvud — P1

**Tõend.** Privaatsuskünnis arvutatakse eristuvate `ownerUserId` väärtuste arvust, kuid signaali-, töövoo-, nõudlus-, ressursi- ja riskiloendurid suurenevad iga kirje pealt (`lib/wellbeing/aggregate.js:118-140`, `:151-173`). Ühe kasutaja korduvate kirjete arvu ei piirata ega normaliseerita. Raport sõnastab tulemuse töötajate koondina, näiteks „N töötaja ... X punast signaali” (`lib/wellbeing/pilotReport.js:88-114`).

**Mõju.** Kolme inimese künnisega võib üks väga aktiivne kasutaja anda kümneid või sadu signaale ja määrata kogu prioriteedijärjestuse. Meetrika nimetaja on kirjete arv, kuid raporti loomulik keel jätab mulje töötajate osakaalust.

**Vastuvõtukriteerium.** Omanik peab määrama analüüsiühiku: viimane kirje inimese/perioodi/töövoo kohta või selgelt sündmuspõhine trend. Loendurid, osakaalude nimetajad ja raportitekst peavad kasutama sama ühikut. Test peab andma ühele inimesele 100 kirjet ja kahele ühe ning kontrollima otsustatud kaalu.

**Seis (12.08.2026): DONE — ühik on valitud, nähtav ja valitav. Commit `285686ad`.**

Leiul on kaks poolt ja neid tuleb eristada. **Esimene on viga ja ta on parandatud:** loendurid
kasvasid iga KIRJE pealt, aga ainus vastusega kaasas käiv nimetaja oli `sampleSize` ehk INIMESTE
arv. Aruande tabelis tähendas see rida „100/3" ja **3333%**. Nüüd kannab iga mõõdik oma
`denominator`-it (sama ühik mis lugejal) ja raport kasutab teda — osakaal ei saa enam ületada
100%. `sampleSize` jääb kaasa, aga ta ei ole enam nimetaja.

**Teine pool on VALIK ja ta on nüüd tehtav, mitte sisse ehitatud.** Andmestik ütleb välja
`analysisUnit`-i ja tal on kaks teostust:
- **`record`** (vaikimisi, senine käitumine) — sündmuspõhine trend: iga sisestus loeb;
- **`latest_per_person`** — üks inimene, üks hääl töövoo kohta: sada sisestust ei määra enam
  prioriteedijärjestust.

Mõlemad on kaetud kriteeriumi enda stsenaariumiga (üks inimene 100 kirjega, kaks ühega):
`record` annab 100 punast 102-st, `latest_per_person` annab 1 punase ja 2 rohelist.
**Negatiivkontroll:** vana nimetaja annab samal real 3333%.

**OMANIKU OTSUS (tehtud 12.08): vaikeühik on `latest_per_person`.** Põhjus on aruande LUGEJA,
mitte andmed — juhtimisraporti loomulik keel loetakse alati inimeste osakaaluna. NIST SP 800-226
sõnastab sama asja teisest otsast: inimese taseme kaitse on sündmuse taseme omast tugevam.
Vahetus tehti ajal, mil tootmises oli **0 `WellbeingRecord` rida, 0 pilooti ja 0 vaatajat**,
seega ühegi olemasoleva aruande tähendus ei muutunud; iga hilisem vahetus muudaks kõigi seniste
oma. `record` **ei kadunud** — ta on eraldi sagedusvaade ja teda saab päringus küsida.

**„Vahetus on üks rida" EI PIDANUD PAIKA ja see oli mõõtmise, mitte oletuse asi.** Kolm asja olid
puudu: (1) `analysisUnit` ei esinenud kordagi `pilotReport.js`-is ega `pilotReportExport.js`-is,
seega aruanne ja kõik kolm eksporti jätsid ühiku välja; (2) `app/` all ei olnud ühtki viidet,
seega ühikut ei saanud päringuga valida ja vaikeväärtuse vahetus oleks teinud sagedusvaate
KÄTTESAAMATUKS; (3) `resolveWellbeingPilotAggregateFilters` on range valge nimekiri ja oleks
parameetri vaikselt ära neelanud.

**CSV-s käivad ühik ja nimetaja IGA REAGA kaasa.** Tabelis sorteeritakse ja filtreeritakse, seega
päisekommentaar või eraldi metaandmete plokk oleks kadunud esimese sortimisega ja alles oleks
jäänud paljas arv. Vana veerukogum andis `metricValue` kõrvale ainult `sampleSize` — täpselt selle
sisendi, millest „100/3 = 3333%" sünnib.

**Tundmatu ühik annab 400**, mitte vaikset tagasilangust: klient, kes küsib sagedusvaadet ja saab
inimeste vaate sama nime all, on sama vaikimise klass, mille SOL-WB-03 ohuväärtuse pealt välja
võttis.

**Kaks kõrvalleidu, mida raportis ei olnud:** XLSX-i veerupealkiri „Valim" seisis `denominator`
veeru peal ja ütles sedasama vale, mille see leid osakaaludest välja võttis; `countedRecordCount`
arvutati kaks korda.

**Väravad:** `TZ=UTC npm test` **4155/4155** · `i18n:check` OK · eslint puhas. Migratsiooni ei ole.

### SOL-WB-05 — 10 000 kirje piir kärbib tööheaolu koondit vaikides — P1

**Tõend.** `buildWellbeingAggregateDataset()` rakendab `take: 10000` ilma `orderBy`, jätkukursori või `truncated` väljata (`lib/wellbeing/aggregate.js:3-5`, `:114-129`). Valimi suurus ja kõik meetrikad arvutatakse ainult tagastatud osast, kuid väljund esitatakse täieliku raportina.

**Mõju.** Suuremas kasutuses võivad sampleSize, signaalid ja prioriteedid olla alaloendatud või sõltuda andmebaasi määramata reajärjestusest. Juhtimisraport ei näita, et osa andmeid puudub.

**Vastuvõtukriteerium.** Kasutada täielikku DB-agregatsiooni või stabiilset lehekülgitamist; kaitsepiiri tabamisel peab raport fail-closed või selgelt `truncated/incomplete` olema. Testida vähemalt 10 001 rea ja mitme lehekülje determinismi.

**Seis (12.08.2026): DONE — koos SOL-WB-10-ga, üks juur: vaikne kärbe, mis esitles end
tervikuna.** Vt SOL-WB-10 all.

### SOL-WB-06 — künnis üksi ei kaitse kitsaste ja kattuvate koondpäringute kaudu üksikisiku tuletamise eest — P1

**Tõend.** Admin ja piloodivaataja saavad vabalt kombineerida `periodStart`, `periodEnd`, `workflowType` ja rollirühma filtreid (`app/api/admin/wellbeing/aggregate/route.js:33-53`, `app/api/wellbeing/pilot/aggregate/route.js:41-72`). Väljund annab täpsed täisarvud ja osakaalud künnise ületamisel (`lib/wellbeing/aggregate.js:59-81`, `:165-173`). Minimaalne künnis tuleb keskkonnast ning üldfunktsioon lubab ka väärtuse 1 (`aggregate.js:27-37`). Puuduvad minimaalse ajavahemiku, päringute sidumise, väikeste alamkategooriate summutamise või differencing-kaitse piirid.

**Mõju.** Vaataja saab teha kaks peaaegu identset piisava suurusega päringut, kus üks ajapiir või workflow erineb ühe inimese võrra, ja lahutada täpsetest loenduritest selle inimese signaalid/riskimarkerid. Vale `WELLBEING_MIN_GROUP_SIZE=1` seadistus eemaldab kaitse täielikult.

**Vastuvõtukriteerium.** Künnis peab olema koodis alampiiriga jõustatud ning privaatsusleping vajab differencing-/small-cell kaitset: lubatud fikseeritud perioodid ja dimensioonid, alamrühmade summutus, päringueelarve või privaatsust säilitav müra. Negatiivne test peab proovima kattuvaid N ja N−1 päringuid ning env-väärtust 1.

**Seis (12.08.2026): DONE osas, mis on kood; üks haru jäi teadlikult lahti (vt allpool).**

**Künnis on nüüd koodis alampiiriga.** `WELLBEING_MIN_GROUP_SIZE=1` eemaldas varem
privaatsuskaitse täielikult, ilma et ükski logirida oleks seda öelnud; env saab künnist ainult
TÕSTA. Piloodi skoobi enda künnis oli juba alampiiriga (`normalizeMinimumGroupSize`), aga
üldfunktsioon ei olnud — ja tema all käib admini koond.

**Rünnaku eeldus oli vabalt nihutatav ajapiir** ja ta on ära võetud: periood ei ole enam vaba
vahemik, vaid **valik fikseeritud võrgust** — terve kalendrikuu, kvartal või aasta **Eesti
kalendri järgi** (`lib/wellbeing/periodGrid.js`), või „kõik". Kahte lubatud perioodi, mis
erinevad ühe inimese võrra, ei ole olemas: nad erinevad alati terve kuu, kvartali või aasta
võrra. Vanad `periodStart`/`periodEnd` võetakse teadlikult vastu ja **lükatakse tagasi 400-ga** —
vaikne ümardamine tähendaks, et vastus katab muud kui küsitud. Sama võrk kehtib **admini pinnal**,
sest leid nimetas mõlemat marsruuti. Mõlemas liideses on kuupäevaväljade asemel perioodivalik.

**Ajavöönd on siin sisuline, mitte vormistuslik:** kuu algab Eesti keskööl (suvel UTC 21:00
eelmisel päeval). UTC-kesköö oleks lasknud iga kuu esimese kolme tunni töö eelmisse kuusse — ja
see nihe ise oleks olnud uus differencing-pind. Test käib läbi ka `TZ=UTC` all.

**Seitse ühikut**, sh kriteeriumi mõlemad negatiivsed juhud: **env-väärtus 1** (künnis jääb 3,
valim summutatakse, ühtki riskimarkerit vastuses ei ole) ja **kattuv N ja N−1 paar** — teine
päring ei ole enam väljendatav, ka mitte segavariandina, kus klient annab korraga võrgu ja vaba
piiri.

**LÄVEND ON 12.08 TÕSTETUD 3 → 5 (omaniku otsus), commit `285686ad`.** Kolm oli liiga madal
kohas, kus aruande vaataja on tööandja määratud inimene, kes tunneb kõiki oma töötajaid nimepidi:
kolme inimese koondist on kahe teadmisel kolmas tuletatav ilma ühegi lisapäringuta. **Viis on ka
koodibaasi enda pretsedent** — `lib/urgent/aggregate.js` hoiab võrreldava tundlikkusega pinda
`URGENT_MIN_GROUP_SIZE = 5` peal sama „ainult tõsta" lepinguga, ja kaks eri lävendit kahel kõrvuti
pinnal oleks olnud lahknemine, mitte valik. **Põrand tuleb nüüd ÜHEST kohast** — sama arv seisis
käsitsi teise koopiana ka `pilotScopes.js`-is.

**Kümme oli laual ja jäi VÕTMATA.** Piloot on kümneid inimesi ning ristlõigetega töövoo ja
rollirühma järgi summutaks kümme enamiku lahtreid — juht näeks tühja aruannet. Selle otsuse eeldus
on piloodi päris pealiikmete arv, mida veel ei ole.

**Testid on seotud eksporditud konstandiga, mitte kirjutatud numbriga**, ja fikstuurid tuletavad
oma suuruse temast — järgmine otsus ei tee neid valeks asja pärast, mida nad ei mõõda. Lävendi
tõstmine kukutas esmalt **12 testi viies failis**: kõik fikstuurid olid ehitatud kolme inimese
peale. See on mõõt, kui palju „üks konstant" tegelikult maksab.

**LAHTINE HARU (omaniku otsus):** kaks ERI SUURUSEGA lubatud perioodi (kuu vs kvartal) on
endiselt sisestikud ja piisavalt kannatlik vaataja saab neid võrrelda. Selle vastu aitavad
**päringueelarve** või **privaatsust säilitav müra** — mõlemad muudavad kas numbrid ebatäpseks või
kasutuse piiratuks, seega nad on tootevalik, mitte tehniline detail. Kolmas võimalus on lubada
korraga ainult ÜHT perioodiliiki piloodi kohta (skoobi seadistus). Kuni otsust ei ole, on kaitse
tase: **künnis 5** + fikseeritud võrk.

**LÄVEND EI OLE ANONÜÜMSUSE TÕEND ja teda ei tohi nii nimetada.** Kolme kriteeriumi test —
eristamine, linkimine, järeldamine — pärineb WP29 arvamusest 05/2014 anonüümimistehnikate kohta
ja seda ei läbi ükski künnis üksi. Väljundit tuleb käsitleda **kontrollitud ligipääsuga
isikuandmete koondina**, mitte anonüümse infona. See ei ole tehniline järeldus, vaid õigusliku
asendi otsus koos oma tagajärgedega (õiguslik alus, säilitustähtaeg, andmesubjekti õigused koondi
enda vastu, tõenäoliselt DPIA ja see, mida osalejale piloodi alguses lubatakse) — **ta on omanikul
lahti ja ta ei kuulu selle leiu alla.**

**TÄIENDAV LAHTRISUMMUTUS ON 12.08 HILISÕHTUL TEHTUD** (commit `db97a10b`). Ta ei vajanud
migratsiooni ega omaniku otsust — ta on algoritm avaldatud lahtrite peal, nagu siin all varem
kirjas oli.

**Lävend mõõtis kogu koondit ja lahter jäi katmata.** Kaheteistkümne inimese aruandes läks
`risk_event.risk.workplace_violence.count = 1` välja täpselt nii: valim ületas lävendi, seega
summutust ei olnud, ja vaataja on tööandja määratud inimene, kes tunneb kõiki oma töötajaid
nimepidi. Lävend 5 ei puutunud sellesse kordagi — ta mõõdab valimit, mitte lahtrit.

**Kaks kihti, sest üks üksi ei tööta.** *Esmane:* lahter, mille loendur on 0 < n < lävend, ei
jõua välja ja rida ei teki ÜLDSE — null väärtusega rida ütleks lugejale sama asja („see rühm on
olemas ja väike"), mille pärast summutus käib. Osakaal kaob koos loenduriga, sest `share ×
avaldatud nimetaja` annab loenduri tagasi. *Täiendav:* kui perekonna lahtrid liituvad AVALDATUD
üldsummaks, on ainus summutatud lahter lahutamise teel tagasi arvutatav (12 − 9 = 3), seega
summutatud lahtreid peab olema vähemalt KAKS ja nende summa vähemalt lävendi jagu. Kinni läheb ka
suur lahter, kui ta on ainus teine — see on summutuse hind ja teadlik: alternatiiv oleks jätta
üldsumma avaldamata, aga üldsumma on kogu aruande nimetaja.

**Mitme valikuga perekonnad** (koormustegurid, ressursid, riskimarkerid) ei liitu ühekski
avaldatud summaks — üks kirje kannab neid mitu — seega seal ei ole lahutamisvõrrandit ja teine
kiht ei käi. Null jääb avaldatuks: ta ei kirjelda ühtki inimest.

**Vaikus oleks olnud uus viga.** Summutus on vastuse omadus (`cellSuppression`) ja aruande oma
(`cellSuppressionNotice`): puuduv rida EI tähenda nulli. **Võtmed avaldatakse ainult SULETUD
sõnavaraga perekonnal** (signaal) — aruanne nimetab niikuinii kõiki kolme, seega puuduv rida on
lugejale nähtav ka ilma loendita ja tema varjamine oleks vaikimine, mitte kaitse; avatud
sõnavaraga perekonnal läheb välja ainult ARV.

**Kolm kohta oleksid teinud summutusest vaikse nulli ja kõik kolm on parandatud:**
`pilotReport` lugemisreegel („puuduv rida → 0"), XLSX kokkuvõttelehe signaaliread ja prindivaate
KPI-kaardid. Teadmata arv on nüüd `null` ja ütleb ennast sõnadega välja; „Juhitav" nõuab, et
MÕLEMAD signaalid oleksid teada, muidu ütleks aruanne rahu seal, kus ta lihtsalt ei näe.

**Kolm fikstuuri mõõtsid pärast seda summutust, mitte oma asja, ja on kasvatatud:**
`aggregate.test` 5 → 15 inimest (enesekontrolliga `withheldCellCount === 0`), `analysisUnit`
96 + 4 punast viielt inimeselt (mõõdetav kontrast `record` 100 vs `person` 5 jäi täpselt samaks),
`aggregateExport` sama riskimarker kõigil. **Sama õppetund mis lävendi tõstmisel 3 → 5.**

**Väravad:** `TZ=UTC npm test` **4175/4175** · `i18n:check` OK · eslint puhas. Kolm
negatiivkontrolli: üks summutamata lahter on üldsummast täpselt lahutatav (12 − 9 = 3) · vana
lugemisreegel annab summutatud signaalist `0` · vana prindiavaldis paneb paberile lõpliku nulli.

**Lahtiseks jääb endiselt ainult see, mis ülal LAHTINE HARU all kirjas** — kaks eri suurusega
perioodi (päringueelarve, müra või üks perioodiliik piloodi kohta) ja õigusliku asendi otsus.
Kumbki ei ole lahtrisummutus.

### SOL-WB-07 — vastatud vanad kontrollpunktid võivad hilisemad tähtajad taimerist välja näljutada — P1

**Tõend.** Due-päring valib `checkpointDueOn <= now` järgi kõige varasemad kuni 1000 rida ja alles pärast `take` piiri filtreerib mälus välja need, mille `followUp` on juba vastatud (`lib/wellbeing/checkpoint.js:187-202`). Vastamisel `checkpointDueOn` ei nullitu (`:102-135`), seega jäävad vastatud vanad read igal käivitusel kandidaatide algusse.

**Mõju.** Kui vastatud aegunud kontrollpunkte koguneb batch'i jagu, võib taimer tagastada iga kord null uut due-kirjet ning hilisemad kasutajad ei saa rakendusesisest meeldetuletust.

**Vastuvõtukriteerium.** Vastatud kontrollpunkt peab SQL-päringust välja jääma eraldi skalaarse oleku/aja abil või kandidaatide lugemine peab jätkuma lehekülgede kaupa. Test peab paigutama batch'i jagu vastatud vanu ridu ühe vastamata uue ette ja tõendama uue teavituse.

**Seis (12.08.2026): DONE — vastatud read ei ole enam kandidaadid.**

„Kas vastatud?" elas AINULT `checkpoint` JSON-i sees, seega SQL ei saanud teda küsida: päring
võttis 1000 VANIMAT due-rida ja viskas vastatud alles pärast `take`-i mälus välja. Piisav hulk
vastatud vanu ridu tõrjus kõik hilisemad tähtajad batch'ist välja — ja tagajärg oli **vaikne**:
taimer tagastas iga jooksu null uut kirjet, ilma veata.

Skalaar `checkpointAnsweredAt` (migratsioon **`20260812090000`**, backfill JSON-i `notedAt`-ist,
seega midagi ei oletata) viib otsuse WHERE-i. Mälufilter jäi teiseks väravaks pärandridade jaoks.
**Ühik kriteeriumi sõnastuses:** 200 vastatud vana rida ühe vastamata uue ees — uus tuleb
välja. **Negatiivkontroll:** sama andmestik vana WHERE-iga täidab batch'i vastatutega ja uus jääb
päringust välja.

### SOL-WB-08 — kirje parandamine jätab sama kontrollpunkti aktiivseks nii vanal kui uuel real — P2

**Tõend.** Parandustehing märgib algse kirje ainult `aggregationEligible: false`, seejärel kopeerib `checkpointDueOn` ja `checkpoint` uuele kirjereale (`lib/wellbeing/records.js:607-633`). Kontrollpunktitaimer ei filtreeri `aggregationEligible` ega `supersededBy` olekut (`lib/wellbeing/checkpoint.js:191-201`). Kuna vana ja uue rea sourceId on erinev, loob dedupe mõlemale eraldi teavituse (`:217-234`). Olemasolev test kinnitab pärimist, kuid mitte vana kontrollpunkti sulgemist.

**Mõju.** Pärast parandust võib kasutaja saada sama kokkuleppe kohta kaks badge'i/teavitust ja vastata kahele iseseisvalt lahknevale kontrollpunktile.

**Vastuvõtukriteerium.** Parandustehing peab kontrollpunkti omandi üheselt uuele reale liigutama või taimer peab arvestama ainult ahela kehtivat tippu. Testida due-parandust enne ja pärast teavituse loomist ning nõuda üht aktiivset kontrollpunkti.

**Seis (12.08.2026): DONE — kokkulepe LIIGUB parandusega, mitte ei kopeeru.**

Parandus kopeeris `checkpointDueOn` ja `checkpoint` uuele reale, jättes need ka vanale. Vana rida
kukkus koondist välja (`aggregationEligible`), aga taimer teda ei filtreerinud ja kuna dedupe'i
võti on `type:sourceId:userId:suffix` ehk REA id-ga seotud, tekkis kaks teavitust. Kasutaja sai
sama kokkuleppe kohta kaks badge'i ja sai vastata kahele iseseisvalt lahknevale kontrollpunktile.

Parandustehing tühjendab nüüd kokkuleppe asendatud kirjelt: omand on üheselt ahela kehtiva tipu
peal. Vastuse aeg liigub kaasa — muidu ärkaks juba vastatud kokkulepe paranduse peale taimeris
uuesti ellu. **Teavituse identiteet liigub samuti kokkuleppe sees** (`checkpoint.notifiedFor`),
sest dedupe'i võti üksi on rea, mitte kokkuleppe oma; ilma selleta oleks juba teavitatud
kokkulepe pärast parandust teist korda teavitatud. **Pärandread korrastab migratsioon.**
Kaks ühikut: parandus jätab täpselt ÜHE aktiivse kontrollpunkti, ja juba vastatud kokkulepe jääb
vastatuks.

### SOL-WB-09 — kontrollpunkti ja soovituse read-modify-write rajad võivad uuema muudatuse vana snapshotiga üle kirjutada — P2

**Tõend.** Follow-up loeb kogu `checkpoint` JSON-i ja kirjutab selle hiljem `updateMany({ where: { id, ownerUserId } })` abil tagasi ilma versioonitingimuseta (`lib/wellbeing/checkpoint.js:102-135`). Soovituse märkimine teeb sama kogu `recommendedActions` massiiviga (`:142-184`). Paralleelne uue checkpoint'i seadmine või teise soovituse märkimine võib toimuda kahe sammu vahel.

**Mõju.** Hiline follow-up võib taastada vana järgmise sammu ning kahe soovituse kiire märkimise korral jääb ainult ühe muudatus alles. UI näitab õnnestumist, kuigi teine kasutaja enda toiming kadus.

**Vastuvõtukriteerium.** Kasutada versiooni/`updatedAt` CAS-i või advisory-lock'iga tehingut ning tagastada stale muudatusele 409. Paralleeltestid peavad võistlema SET↔FOLLOW_UP ja kahe eri recommendation'i toimingud.

**Seis (12.08.2026): DONE — kokkuleppel on nüüd identiteet ja kirjutamine on jagamatu.**

Mõlemad rajad olid read-modify-write terve JSON-i peal ilma ühegi tingimuseta. Kaks eri soovituse
märkimist lugesid sama massiivi ja kirjutasid oma versiooni tagasi — alles jäi ainult viimane,
kuigi UI näitas mõlemale õnnestumist.

Lugemine ja kirjutamine käivad nüüd ühe advisory-lukuga tehingus (`wellbeingRecord:checkpoint:<id>`,
sama mehhanism mis kirje loomisel ja parandusel). **Soovituste juures 409 ei ole vaja ega õige:**
hiline kirjutaja loeb värsket seisu ja tema märge LISANDUB. **Kontrollpunkti juures on 409 õige,**
sest vastus käib konkreetse KOKKULEPPE kohta: kontrollpunkt sai identiteedi (`checkpoint.id`),
klient saadab `expectedCheckpointId` ja vahepeal välja vahetatud plaanile antud vastus annab
`wellbeing.errors.checkpoint_conflict`, mitte vaikse kirjutuse uue plaani külge.

**Neli ühikut**, sh mõlemad kriteeriumi võistlused päris `$transaction`-i serialiseeriva fake'i
vastu (ilma temata langeks lukuümbris tagavarateele ja test ei tõendaks midagi).
**Negatiivkontroll:** sama kaks märget ilma serialiseerimiseta kaotab ühe.

### SOL-WB-10 — „Kõik” tööheaolu ülevaade kasutab vaikides ainult 100 uusimat kirjet — P2

**Tõend.** `buildWellbeingOverviewForUser()` kutsub loendit `take: filters.take || 100` väärtusega (`lib/wellbeing/overview.js:185-192`). Kasutaja overview route ega UI ei anna lehekülgitust või kärpeindikaatorit; väljund nimetab perioodi „Kõik”, `recordCount` on valitud massiivi pikkus ning juhimemo esitleb selle põhjal täielikku mustrit (`overview.js:222-252`, `components/wellbeing/OverviewWorkflow.jsx:167-181`).

**Mõju.** Pikaajalisel kasutajal kaovad vanemad kirjed trendist ja juhiga jagatavast memost ilma nähtava hoiatuseta. „Kõik” ei tähenda tegelikult kõiki.

**Vastuvõtukriteerium.** Ülevaade peab agregeerima kogu valitud perioodi või märkima selgelt truncation'i ja võimaldama jätkamist. Testida vähemalt 101 kirjet, kus ainus punane signaal on vanim.

**Seis (12.08.2026): DONE — SOL-WB-05 ja SOL-WB-10 on üks juur ja üks parandus.**

Kaks vaikset kärbet, mõlemad esitatud täieliku tulemusena: koond luges `take: 10000`
**ilma `orderBy`-ta** (suurema hulga korral otsustas valimi andmebaasi määramata reajärjestus —
kaks järjestikust päringut võisid anda eri vastuse) ja isiklik ülevaade luges 100 uusimat kirjet,
nimetades perioodi „Kõik".

Mõlemad kasutavad nüüd üht lugejat (`lib/wellbeing/pagedRecords.js`): **stabiilne kursor
`(createdAt, id)`**. `createdAt` üksi ei ole unikaalne — sama millisekundiga read (topeltklikk,
import) korduksid või kaoksid lehekülje piiril; `id` teeb järjestuse totaalseks. Kursor on
`skip: 1` mustriga, mitte `offset`, sest offset triivib, kui vahepeal ridu lisandub.

**Kaitsepiir jäi alles, aga ta ei ole enam vaikne:** piirini jõudmine annab `truncated: true` ja
see jõuab andmestikku (`truncationReason`, `recordLimit`), **piloodiraportisse**
(`completenessNotice` — „arvud on alampiirid, ära tee neist osakaaluotsuseid"), **HTML- ja
XLSX-eksporti** ning ülevaate liidesesse. Piir tuleb `options`-ist (serveri kood), mitte
`filters`-ist (päringustring) — kliendi seatav kaitsepiir ei ole kaitsepiir. Koondil 100 000,
ülevaatel 20 000 (kasutajapõhine).

**Kuus + kaks ühikut** päris kursorisemantikat jäljendava fake'i vastu — ta austab `cursor`-it ja
`skip`-i, seega vale lehekülgitus annaks vale arvu, mitte rohelise testi. Kaetud: **10 001 rida
ilma lünkade ja kordusteta** · sama päring kahe eri leheküljesuurusega annab **identse
järjestuse** · sama ajatempliga 25 rida loetakse täpselt üks kord · **täpselt piiri peale jäänud
valim EI OLE poolik** (muidu kaotaks hoiatus tähenduse) · ülevaade **101 kirjega, kus ainus punane
on VANIM** — vana rada jättis ta välja ja memo ütles juhile „roheline". Negatiivkontroll: sama
andmestik piisava piiriga ei ole poolik, seega lipp mõõdab kärbet, mitte hulka.

**KATMATA:** „võimaldada jätkamist" (kursoriga lehitsemine liideses) ei ole tehtud — piirini
jõudmine ütleb praegu ausalt, et vaade on poolik, ja soovitab kitsamat perioodi. Päris
lehitsemine on UI-töö ja tal ei ole täna kasutajat: piir on 20 000 kirjet ühe inimese kohta.

### SOL-WB-11 — mitmed tööheaolu API-d tagastavad ootamatu serverivea toorsõnumi kliendile — P2

**Tõend.** Salvestus-, detaili-, kustutus-, kontrollpunkti-, paranduse-, recommendation'i ja drafti loomise route'id logivad 500-vea `safeError()` kaudu, kuid vastuses kasutavad ikkagi `error?.message` väärtust (nt `app/api/wellbeing/quick-check/route.js:22-30`, `app/api/wellbeing/records/[id]/route.js:30-38`, `:53-61`, `app/api/wellbeing/output-drafts/route.js:38-46`). Prisma või muu ootamatu vea sõnum pole avalik allowlistitud veavõti.

**Mõju.** Autenditud kasutaja võib saada andmebaasi-, skeemi- või infrastruktuurivea sisemise teksti. Lisaks proovib UI seda käsitleda tõlkevõtmena, tekitades ebastabiilse avaliku API lepingu.

**Vastuvõtukriteerium.** Ainult tuntud 4xx domeenivead tohivad oma messageKey/details välja anda; kõik ootamatud vead peavad tagastama fikseeritud üldvõtme ja korrelatsiooni-ID. Veasüstitest peab kasutama Prisma-laadset tundliku tekstiga viga kõigis jagatud route-mustrites.

**Seis (12.08.2026): DONE — 4xx staatus üksi ei ole enam luba rääkida.**

Kõik seitseteist rada logisid 500-vea `safeError()` kaudu õigesti, aga panid vastusesse ikkagi
`error?.message`. Prisma erind kannab tabelinime, veerunime, failiteed ja sageli ka väärtust —
ja liides proovib sama välja tõlkevõtmena kasutada, mis tegi juhuslikust veatekstist avaliku
API lepingu osa.

Otsus elab nüüd ühes puhtas moodulis (`lib/wellbeing/apiErrors.js`): oma sõnumi ja `details`
saab välja anda AINULT erind, millel on **4xx staatus JA tõlkevõtme kujuga sõnum**
(`^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$`). Kõik muu annab `wellbeing.errors.unexpected` +
korrelatsiooni-ID, mille järgi logist tegelik viga üles leiab. **`details` on sama otsuse teine
pool** — kui sõnum ei kvalifitseerunud, ei tule ka detailid kaasa.

Moodul on `_shared.js`-ist LAHUS teadlikult: `_shared.js` impordib `next-auth`-i ja teda ei saa
ühiktestis kutsuda. Värav, mida ei saa testida, ei ole värav.

Kaks kohta said katte, mida neil üldse ei olnud: **piloodi koondi arvutus oli try-plokist väljas**
ja admini koondil ei olnud `try`-d üldse — Prisma tõrge lendas mõlemas käsitlemata välja.

**Viis ühikut.** Veasüst on päris Prisma vea kujuga (`P2009`, `prisma.wellbeingRecord.create()`
invocation, failitee, väärtus ja e-posti aadress) ja test nõuab, et ükski neist kuuest stringist
vastuses ei esineks. **Kõige tähtsam piir on eraldi kaetud:** võõras erind 4xx staatusega EI
kvalifitseeru. Ja kate on tõendatud eraldi — test käib kõik 20+ marsruudifaili läbi ja nõuab, et
mitte ükski neist ei kirjutaks `error?.message` vastusesse; ilma selleta kehtiks parandus ainult
nendes failides, mida ma juhtusin avama.

### SOL-WB-12 — piloodivaataja ligipääsu ei saa platvormi API kaudu tühistada — P1

**Tõend.** Admini piloodi API pakub ainult scope'ide GET/POST-i ning vaataja lisamise POST-i (`app/api/admin/wellbeing/pilots/route.js:38-61`, `app/api/admin/wellbeing/pilots/[id]/viewers/route.js:30-44`). `pilotScopes.js` sisaldab ainult list/create/add teenuseid (`lib/wellbeing/pilotScopes.js:133-215`); puuduvad viewer DELETE, scope PATCH/deactivate ja aegumise muutmise rajad. E-posti põhine `WellbeingPilotViewer` rida säilib ka seotud User kustumisel `SetNull`-iga (`prisma/schema.prisma:1560-1573`).

**Mõju.** Valesti lisatud, rolli vahetanud või lahkunud vaataja juurdepääsu ei saa tavapärase haldusvooga kohe eemaldada. Kustutatud konto e-postile hiljem loodud uus konto võib endiselt sobituda vana email-viewer reaga.

**Vastuvõtukriteerium.** Vajalikud on auditeeritud revoke/deactivate/update rajad, mis toimivad kohe nii userId kui e-posti seostele; konto/e-posti muutuse leping peab vältima vana aadressi õiguse pärimist. Testida viewer revoke'i, scope deactivate'i, konto kustutust ja sama e-postiga uut kontot.

**Seis (12.08.2026): DONE — koos SOL-WB-13-ga, üks plokk: andmine ja äravõtmine on sama rada
ja mõlemal on jälg.**

Admini API pakkus ainult skoopide GET/POST-i ja vaataja lisamise POST-i. **Nüüd on olemas**
`PATCH /api/admin/wellbeing/pilots` (nimi, rollirühmad, künnis, algus/lõpp, `active`) ja
`DELETE …/pilots/[id]/viewers`. Deaktiveerimine võtab ligipääsu **kohe** — juurdepääs küsib
`active: true` iga päringu peale ja vahemälu, mida oleks vaja tühjendada, ei ole. Mõlemad rajad on
ka **admini liideses** (iga vaataja kõrval „Eemalda", piloodil „Peata piloot"), sest kriteerium
räägib tavapärasest haldusvoost, mitte ainult endpoint'ist.

**E-posti rida on KUTSE, mitte igavene võti** (migratsioon **`20260812100000`**). Vana leping:
rida sobitus e-posti järgi alati ja konto kustumisel jäi ta `SetNull`-iga alles — samale
aadressile hiljem loodud UUS konto päris kustutatud inimese vaate tundlikule koondile. Nüüd
seotakse rida esimesel kasutamisel konkreetse kontoga (`claimedAt`), pärast mida **e-post enam ei
sobitu**, ja `ON DELETE CASCADE` viib rea koos kontoga. Lunastamine on tingimuslik
(`claimedAt: null` WHERE-is), seega kaks samaaegset päringut ei saa rida kaks korda siduda.

**Kuus ühikut**, sh kriteeriumi neli juhtu: revoke · scope deactivate (ligipääs kaob JÄRGMISE
päringu peale, mõõdetuna) · kustutatud konto aadressiga uus konto EI saa ligipääsu ·
**negatiivkontroll** — lunastamata kutse sama aadressiga töötab edasi, seega piir käib
lunastamise, mitte e-posti kohta.

### SOL-WB-13 — piloodiscope'i loomine ja vaatajate õiguste muutmine ei jäta administraatori auditijälge — P1

**Tõend.** `WellbeingPilotScope` ja `WellbeingPilotViewer` mudelites puuduvad looja/muutja väljad või eraldi auditiseos (`prisma/schema.prisma:1538-1573`). Admin-route kontrollib sessiooni, kuid ei anna `authz.userId` teenusele edasi ning `createWellbeingPilotScope()`/`addWellbeingPilotViewer()` kirjutavad ainult konfiguratsiooniread (`app/api/admin/wellbeing/pilots/route.js:49-60`, `app/api/admin/wellbeing/pilots/[id]/viewers/route.js:30-43`, `lib/wellbeing/pilotScopes.js:142-215`).

**Mõju.** Ei ole tõendatav, kes andis kellele ligipääsu tundlikele tööheaolu koonditele, millise skoobi ja künnisega. Vea või väärkasutuse korral puudub vastutusahel.

**Vastuvõtukriteerium.** Iga scope'i ja viewer'i create/update/revoke peab kirjutama sama tehinguga append-only auditi: actor, siht, scope'i versioon, künnis ja aeg ilma koondi sisuta. Veasüstitest peab tõendama, et õigus ei muutu ilma auditi õnnestumiseta.

**Seis (12.08.2026): DONE — vt SOL-WB-12 plokk.**

`WellbeingPilotScope` ja `-Viewer` ei kandnud looja ega muutja välju ning marsruut, kes teadis
administraatorit, ei andnud teda teenusele edasi. Ei olnud tõendatav, **kes andis kellele**
ligipääsu tundlikele koonditele, millise skoobi ja künnisega.

Iga create/update/add/revoke/claim kirjutab nüüd `DataAuditLog` rea **põhimuudatusega samas
tehingus**. **Tegija on KOHUSTUSLIK** — `actorUserId`-ta ei muutu midagi (`actor_required`, 400);
vaikimisi `null` oleks tähendanud „keegi andis kellelegi ligipääsu" ja täpselt see seis oli enne.
Meta kannab **skoobi versiooni** (kanooniline sha256 konfiguratsioonist, sama muster mis
SOL-URG-12 `conditionsHash`), muudatuse korral **kaks versiooni — mille pealt ja mille peale** —,
künnist ja muutunud väljade NIMESID. Koondi sisu, arve ega vastuseid jälg ei kanna.

**Veasüst tabab AINULT auditikirjutust** ja tõendab, et vaataja rida jääb alles, kui jälg kukub.
Tema kõrval on kaks negatiivkontrolli: tegijata toiming ei puuduta ühtki rida, ja sama toiming
töötava auditiga läheb läbi (muidu mõõdaks süst lihtsalt seda, et erind lendas).

### SOL-WB-14 — piloodivaate hiline päring võib uuema filtrivaliku vana raportiga üle kirjutada — P2

**Tõend.** `WellbeingPilotClient` käivitab iga filtrimuutuse järel uue `loadAggregate()` päringu, kuid ei kasuta AbortControllerit, request-ID-d ega aktiivse päringu omandikontrolli (`app/tooheaolu/piloot/WellbeingPilotClient.jsx:97-159`). Kõik vastused kutsuvad lahendumisjärjekorrast sõltumata `setDataset`, `setReport` ja `setStatus`.

**Mõju.** Kiire piloodi, rolli või perioodi vahetus võib ekraanile jätta eelmise scope'i raporti, samal ajal kui valikuribad näitavad uut. See võimendab SOL-WB-01 vale omistamise riski ning võib kasutaja eksportima panna vale valimi.

**Vastuvõtukriteerium.** Iga laadimine peab katkestama eelmise või kirjutama olekut ainult siis, kui request-ID ja filtrisõrmejälg on endiselt aktiivsed. Brauseritest peab lahendama A ja B päringud mõlemas järjekorras ning kontrollima raporti ja valikute vastavust.

**Seis (12.08.2026): DONE — kaks väravat, sest kumbki üksi ei piisa.**

`AbortController` katkestab eelmise päringu VÕRGU tasemel ja omandikontroll hoiab ära selle, et
katkestamise ja lahenemise vahele jäänud vastus veel kirjutaks — ei andmestikku ega viga.
Lahkumisel katkestatakse ka viimane päring.

**Otsust ennast ei ehitatud uuesti:** `shouldSettleRequest` (`lib/chat/sidebarListState.js`) on
sama leping, mis SOL-U6-P1-2 juures juba kirjutati ja mida tõendavad tema omad ühiktestid.
Muster oli koodibaasis olemas ja kasutamata.

**Sama klass parandati ka admini koondivaates** (`AdminWellbeingClient`), kus ta oli täpselt
samasugune — leid nimetas ainult piloodivaadet, aga jätta teine pool katki oleks tähendanud sama
vea teadlikku alleshoidmist.

**Neli ühikut:** kriteeriumi stsenaarium (A ja B **mõlemas lahenemisjärjekorras**, aegunud
vastus ei kirjuta kummalgi juhul) + mõlema vaate delegeerimisleping. **Negatiivkontroll:** ilma
omandikontrollita („kirjuta alati") oleks vastus mõlemal juhul jah.

**NOT_PROVEN:** päris brauseritest kahe võistleva päringuga jäi tegemata — ta nõuab autenditud
piloodivaataja seanssi ja aeglustatud endpoint'i. Loogika on tõendatud puhta moodulina ja
komponendi delegeerimine lepingutestiga, aga kliki-tasemel läbisõitu ei ole.

### SOL-SLOG-01 — seadme mustand ja saatmisjärjekord võivad järgmise konto andmed eelmise konto päevikusse saata — P0

**Tõend.** Nii outbox kui pooleli külastuse mustand kasutavad kogu brauseriprofiili kohta üht fikseeritud `localStorage` võtit, milles pole kasutaja- ega profiili-ID-d (`lib/serviceLog/outbox.js:26-50`, `lib/serviceLog/visitDraft.js:27-40`, `:61-81`). Teenuspäeviku avamisel loeb komponent järjekorra ja saadab iga payload'i praeguse sessiooniga serverisse (`components/serviceLog/ServiceLogDay.jsx:606-635`); koodibaasis ei ole nende võtmete logout'i- ega kasutajavahetuse puhastust.

**Mõju.** Jagatud arvutis või samas brauseriprofiilis kontot vahetades võib järgmine teenuseosutaja näha eelmise töötaja kliendi nime, märkust, aegu ja asukohapunkte ning outbox võib need uue töötaja profiili teenuskirjeteks salvestada. See on korraga isikuandmete leke ja vale arve alusdokumendi teke.

**Vastuvõtukriteerium.** Kohalikud read peavad olema kasutaja/profiili krüptograafiliselt või vähemalt autoriteetse ID järgi eraldatud, kasutajavahetusel lukustatud ning logout'il otsustatud korras eemaldatud või turvaliselt üle antud. Brauseritest peab jätma A konto mustandi/outbox'i, vahetama B kontole ja tõendama, et B ei näe ega saada A sisu.

**Seis (10.08.2026): DONE.** Seadme read on nüüd konto omad, mitte brauseri omad.

- **Eraldus autoriteetse ID järgi.** Uus `lib/serviceLog/deviceStore.js` on AINUS tee nende
  ridadeni: `openDeviceStore(storage, ownerId)` annab võtme `…outbox::<userId>` ja tagastab
  **`null`**, kui omanikku ei ole. `outbox.js` ja `visitDraft.js` võtavad nüüd selle
  salvestuse, mitte `localStorage`-i, ning nende olemasolev „salvestust ei ole" haru katab
  omanikuta hetke ära — identiteedita ei loeta ega kirjutata midagi. Struktuur välistab
  „unustasin omaniku kaasa anda" (sama muster mis SLOG-14 juures).
- **Kasutajavahetuse lukk.** Omanik tuleb toorest sessioonist (`useSession`), mitte
  rollivaatest. Omaniku muutumisel tühjendatakse vorm MÄLUS (`clearFormFields`), salvestust
  puutumata — `clearVisitDraft` läheks juba uue omaniku reale ja kustutaks tema õige
  mustandi. See haru on vajalik, sest sessiooniküpsis on brauseriülene: teises vahekaardis
  sisse logimine vahetab omaniku ka juba avatud vormi all.
- **Logout'il valiti „turvaliselt üle antud", mitte „eemaldatud".** Järjekord hoiab TEHTUD
  TÖÖD ja tema kustutamine on täpselt SLOG-02/-03 kahju (tasustamata töö). Rida jääb oma
  konto skoopi; mustandil on lisaks 18-tunnine iga.
- **Vana sildistamata rida kustutatakse.** Teda ei saa omistada (payload'is on kliendi nimi,
  mitte töötaja), seega ainus lekkevaba valik. Kahju on mõõdetud, mitte oletatud: tootmises
  on teenuspäevik sees (`SERVICE_LOG_ENABLED=1`), aga andmebaasis on 11 teenuskirjet ja ÜKS
  osutajaprofiil (omaniku enda), viimane kirje 02.08 — flotti, kelle telefonis oleks saatmata
  päevatöö, veel ei ole.

**Kaks leidu, mida raportis kirjas ei olnud ja mis tulid parandust brauseris tõendades:**

1. **Mustand kustus lehe avamisel.** Lipp „taastamine on tehtud" oli viide
   (`draftReadyRef.current = true`) ja läks püsti taastamis-effecti sees, aga taastatud
   väärtused jõudsid olekusse alles JÄRGMISES renderduses. Salvestav effect jooksis vahepeal
   sama commit'i ajal — lipp püsti, väljad tühjad — ja luges tühja vormi „siin ei ole tööd",
   mis kustutas rea, mille just taastasime. Lipp on nüüd olek (`draftOwner`), mis käib
   taastatud väärtustega ühes commit'is. Ilma brauserita oleks see jäänud leidmata: unit-testid
   ei renderda komponenti.
2. **Üks ootel kirje läks teele kolme POST-iga.** `flushOutbox`-il ei olnud voo-lukku ja
   käivitajaid on mitu (leht avaneb, omanik selgub, `online`, StrictMode). Server on
   idempotentne ja topeltkirjet ei tekkinud, aga idempotentsus on turvavõrk, mitte luba
   võrku raisata. Lukk viis 3 → 2 (järelejäänu on dev-StrictMode'i oma).

**Tõend (runtime, lokaalne dev-server, päris sessioon `ai.service-provider@sotsiaalai.test`):**
seadmesse pandi korraga (a) vana sildistamata mustand+outbox, (b) VÕÕRA omaniku mustand+outbox
ja (c) oma mustand+outbox. Lehe avamisel: oma mustand tuli vormi (`MINU Klient`), oma
järjekorra kirje läks serverisse ja kadus seadmest, vana sildistamata rida kustutati, **võõra
omaniku mõlemad read jäid baidilt puutumata ja tema kirje EI JÕUDNUD serverisse** (`GET
/api/service-entries` näitas ainult oma kirjet). Kumbagi võõrast nime ei olnud lehel.

**Testid.** `tests/serviceLog/deviceStore.test.js` (uus, 7 testi) + olemasolevad outbox/draft
sviidid käivad nüüd sama teed mis komponent. Negatiivkontroll: skoopimise eemaldamine
`deviceRowKey`-st kukutab 4 testi 7-st, seega sviit mõõdab päriselt eraldust. `npm test`
3374/3374 (TZ=UTC).

**runtime: `A logib välja → B logib sisse` vahetus päris kahe kontoga on läbi käimata** —
lokaalselt on üks SERVICE_PROVIDER konto. Vahetuse haru on kaetud ühikutestiga ja ülal
kirjeldatud võõra omaniku katsega, mis mõõdab sedasama invarianti teisest otsast (seade
sisaldab teise konto ridu; meie sessioon ei näe ega saada neid).

### SOL-SLOG-02 — iga 4xx vastus kustutab võrgujärjekorrast tehtud töö taastamisvõimaluseta — P1

**Tõend.** `postEntry()` liigitab retry'ks ainult võrguvea ja 5xx-i; kõik 4xx-id on `rejected` (`components/serviceLog/ServiceLogDay.jsx:581-600`, `lib/serviceLog/outbox.js:105-118`). `flushOutbox()` eemaldab rejected payload'i kohe localStorage'ist ja jätab alles vaid komponendi mälus oleva üldteate (`ServiceLogDay.jsx:606-623`). Payload'i ega taastamis-/parandamisvaadet ei säilitata.

**Mõju.** Näiteks võrgu taastumise ajaks aegunud sessioon (401), ajutiselt muutunud roll (403) või parandatav valideerimisviga (400/409) kustutab tehtud teenuse kirje seadmest. Lehe värskendamisel kaob ka ainus veateade ning töötaja peab töö mälu järgi uuesti sisestama või jääb see arvelt välja.

**Vastuvõtukriteerium.** Autentimis- ja ajutised olekuvead peavad järjekorda säilitama; parandatav payload peab liikuma püsivasse `needs_attention` olekusse koos põhjuse, redigeerimise ja uuesti saatmisega. Testida eraldi 400, 401, 403, 409 ja 5xx järel reload'i ning nõuda, et ükski rida ei kaoks ilma kasutaja kinnitatud lahenduseta.

**Seis (12.08.2026): DONE — outbox eristab nüüd uuesti proovitavat ja parandamist vajavat tööd ning ei kustuta kumbagi vaikides.** Võrguviga, 401, 403, 408, 425, 429 ja 5xx jäävad järjekorda; 400/409 liiguvad püsivasse `needs_attention` olekusse koos põhjusega. UI näitab neid eraldi ja „Tõsta vormile” taastab payload'i redigeerimiseks; alles see kasutaja toiming eemaldab vana järjekorrarealt. Reload-test tõendas 400 payload'i ja põhjuse püsimise ning olekutestid katsid kõik nõutud vastuseklassid.

### SOL-SLOG-03 — 201. võrgujärjekorra kirje kustutab vanima teenuse vaikides — P1

**Tõend.** Outbox'i piir on 200 ja `enqueue()` rakendab `current.slice(-OUTBOX_LIMIT)`, mis viskab vanima rea välja ilma veata või eraldi kadunud-rea olekuta (`lib/serviceLog/outbox.js:28-34`, `:80-91`). Test kinnitab praegu just vanima väljakukkumist (`tests/serviceLog/outbox.test.js:84-93`); UI kuvab ainult alles jäänud kirjete arvu.

**Mõju.** Pikema offline-perioodi või takerdunud sünkroonimise korral kaob kõige varem tehtud töö arve- ja aruandealusest, kuid kasutaja näeb ainult 200 ootel kirjet ega saa teada, milline klient või teenus kadus.

**Vastuvõtukriteerium.** Täis järjekord peab uue sisestuse enne andmekadu blokeerima või vanima rea püsivasse taastatavasse arhiivi viima; UI peab näitama selget täitumis- ja sünkroonimistõrget. Piirtest peab tõendama, et 201. sisestus ei kustuta ühtegi varasemat tööd.

**Seis (12.08.2026): DONE — 201. kirje blokeeritakse enne kirjutust ning kõik 200 varasemat payload'i jäävad muutmata alles.** Sama idempotentsusvõtmega rea parandamine on endiselt lubatud, kuid uue võtme lisamine täis järjekorda tagastab nähtava täitumisvea ja vorm jääb avatuks. Piirtest võrdleb kogu järjekorda enne ja pärast 201. katset, mitte ainult pikkust.

### SOL-SLOG-04 — korduv idempotentsusvõti ei kontrolli, kas uus payload kirjeldab sama tööd — P1

**Tõend.** `createEntry()` otsib `clientRequestId` järgi olemasoleva rea enne uue sisendi kliendi, kuupäeva, koguse või suunamise valideerimist ja tagastab selle `replayed:true` vastusena (`lib/serviceLog/entries.js:462-475`). Ka P2002 järel tagastatakse võtmega leitud rida ilma payload'i sõrmejälge võrdlemata (`entries.js:436-451`). Test kontrollib ainult seda, et kordussaatmine vana rida üle ei kirjutaks, mitte eri sisu konflikti (`tests/serviceLog/idempotency.test.js:83-113`).

**Mõju.** Kliendi võtme taaskasutus vea, taastatud backup'i või muudetud outbox'i tõttu võib uue kliendi töö näiliselt edukalt salvestada, kuigi server jättis alles hoopis vana kirje. UI tühjendab payload'i ja vale tulemus avastatakse alles kuu koondis.

**Vastuvõtukriteerium.** Idempotentsusrea juurde tuleb salvestada kanoniseeritud sisendi räsi; sama võti ja sama räsi annavad replay, sama võti ja erinev räsi 409 koos taastatava payload'iga. Testida vähemalt kliendi, kuupäeva, koguse ja suunamise muutust.

**Seis (12.08.2026): DONE — teenuskirje kannab kanoniseeritud SHA-256 sisendiräsi ning replay nõuab võtme ja sisu kokkulangevust.** Sama payload tagastub idempotentselt; kliendi, kuupäeva, koguse või suunamise muutus sama `clientRequestId` all annab `409 service_log.errors.idempotency_payload_mismatch`. Nullable migratsioon säilitab vanad read ning nende esimene kordus võrreldakse rea tegelikust sisust taastatud sõrmejäljega. Sihitud testid katsid kõik neli nõutud lahknevust.

### SOL-SLOG-05 — `sourceFieldVisitId` on kliendi usaldatud päritoluväide, mitte tõendatud Välitöö seos — P1

**Tõend.** POST-sisendist võetud `sourceFieldVisitId` kärbitakse ja kirjutatakse otse teenuskirjele (`lib/serviceLog/entries.js:468-472`, `:548-559`). Loomisrada ei otsi vastavat Välitöö külastust ega kontrolli selle omanikku, olekut või sisu. Skeem loob ainult profiilisisese unikaalsuse ning dokumenteerib teadlikult FK puudumise (`prisma/schema.prisma:5366-5395`).

**Mõju.** Otsene API-kutsuja saab suvalise ID-ga väita, et arve alusdokument tuli konkreetsest külastusest, või hõivata päris külastuse ID nii, et hilisem õige kirje saab `visit_already_used`. Päritoluväli näeb auditile tõendina välja, kuid pole serveris tõendatud.

**Vastuvõtukriteerium.** Loomise hetkel peab server tõendama, et lähtekülastus kuulub samale kasutajale/profiilile, on sobivas lõppolekus ja vastab kliendi/aja põhiandmetele; FK puudumine retention'i tõttu võib jääda. Negatiivtest peab proovima võõrast, olematut, lõpetamata ja juba kasutatud külastust.

**Seis (12.08.2026): DONE — `sourceFieldVisitId` seos tõendatakse nüüd serveris enne teenuskirje loomist.** Külastus peab kuuluma samale profiilile ja omanikule, olema `COMPLETED`, kasutamata ning vastama kliendi, kuupäeva, suunamise, teenuse ja aja põhiandmetele; olematu ja võõras ID annavad ühtemoodi 404. Negatiivtestid katsid olematut, võõrast, lõpetamata, juba kasutatud ja sisult lahknevat külastust. FK-ta retention'i piir jäi teadlikult alles, kuid päritoluväidet ei saa enam kliendist vabalt kirjutada.

### SOL-SLOG-06 — sama nimega väliskliendi suunamist saab kasutada teise välisviitega kirjel — P1

**Tõend.** Väliskliendi suunamise terviklikkus võrdleb ainult `clientDisplayName` väärtust, mitte `clientExternalRef`-i (`lib/serviceLog/entries.js:302-311`). Loomisrada võtab kirje välisviite vabalt payload'ist, kuid suunamise päring isegi ei vali võrdluseks `clientExternalRef` välja (`entries.js:475-515`).

**Mõju.** Kaks sama nimega Mari-t saavad omavahel segi minna: kirje võib tarbida ühe kliendi suunamismahtu, kuid kanda teise välisviidet ja ilmuda koondis teise identiteedina. Ekspordi hilisem parem grupivõti ei paranda valesti seotud alusdokumenti.

**Vastuvõtukriteerium.** Välise kliendi identiteet peab tulema suunamisest või võrdlema vähemalt nime ja välisviite normaliseeritud paari; vastuolu peab andma 400. Integratsioonitest peab looma kaks sama nime ja eri viitega klienti ning proovima ristkasutust.

**Seis (12.08.2026): DONE — suunamise terviklikkus võrdleb väliskliendi puhul nüüd normaliseeritud nime ja `clientExternalRef`-i paari nii loomisel kui parandamisel; sama nimi ei varja enam viite vastuolu.** Suunamise päring valib välisviite mõlemal rajal ning vastuolu annab enne kirjutust `400 service_log.errors.referral_client_mismatch`. Teenuskihi negatiivtest lõi sama nimega `external-a` suunamise ja proovis seda `external-b` kirjel: vastus 400 ja kirjeid 0; õige nime-viite paar salvestus ühe reana.

### SOL-SLOG-07 — tühi tegevuskataloog muudab serveri allowlist'i vabatekstiks — P2

**Tõend.** `normalizeActivities()` lükkab tundmatu tegevuse välja ainult siis, kui lubatud kataloogi `Set` pole tühi (`lib/serviceLog/entries.js:101-120`). Seega teenuseta kirje või tühja `activityCatalog`-iga teenus salvestab kuni 50 suvalist kliendi saadetud tegevust, kuigi kommentaar ja mall B leping nõuavad valikut teenuse kataloogist. Loomisrada rakendab seda tulemust otse (`entries.js:516-524`, `:548-568`).

**Mõju.** Otsene API või vananenud klient saab aruandesse kontrollimata kategooriad; võrdlusstatistika ja linnukeste tähendus lahknevad teenuste vahel.

**Vastuvõtukriteerium.** Puuduv/tühi kataloog peab lubama ainult tühja tegevusmassiivi või serveri otsustatud üldsõnastikku; tundmatu väärtus peab andma nähtava valideerimisvea. Testida teenuseta ja tühja kataloogiga sisendit.

**Seis (12.08.2026): DONE — tühi või puuduv tegevuskataloog lubab nüüd ainult tühja tegevusmassiivi ning kataloogiväline väärtus annab nähtava 400 valideerimisvea, mitte ei muutu vabatekstiks ega kao vaikselt.** ET/EN/RU veateade nimetab, et tegevus ei kuulu teenuse kataloogi. Negatiivtestid katsid teenuseta kirje, tühja teenusekataloogi ja tundmatu väärtuse; positiivkontroll salvestas ainult kataloogis oleva tegevuse. Ploki sihttestid 29/29 PASS.

### SOL-SLOG-08 — kinnitamine ja tühistamine võivad samaaegselt üksteist tingimusteta üle kirjutada — P1

**Tõend.** `finalizeEntry()` ja `voidEntry()` loevad oleku eraldi ning teevad seejärel `update({ where:{id} })` ilma oodatud staatuse tingimuseta (`lib/serviceLog/entries.js:832-878`). Ka kaks finalize-kutset läbivad mõlemad DRAFT-kontrolli; finalize ja void võivad lugeda sama algseisu ning viimasena kirjutaja määrab lõppoleku, jättes teise toimingu ajatemplid reale.

**Mõju.** Kirje võib lõppeda näiteks `FINAL` olekus koos varasema `voidedAt/voidReason` väljaga või `VOID` olekus pärast kasutajale edukana vastatud kinnitamist. Säilitusaasta, aruanded ja audititõlgendus võivad rääkida eri lugu.

**Vastuvõtukriteerium.** Elutsüklisiire peab olema üks tingimuslik DB-kirjutus või lukustatud tehing, mis sisaldab oodatud lähteolekut; kaotaja peab saama 409 ja lõpprea väljad peavad olekuga kooskõlas olema. Päris paralleeltest peab võistlema finalize/finalize ja finalize/void.

**Seis (12.08.2026): DONE — `finalizeEntry()` ja `voidEntry()` kasutavad nüüd sama `id + providerProfileId + status + updatedAt` CAS-kirjutust; eellugemine ei anna enam õigust hiljem tingimusteta üle kirjutada.** Finalize puhastab tühistusväljad ning DRAFT-ist tühistamine hoiab kirjendamisaasta/finaliseerimise väljad nullina. `npm run slog:entry:probe` 16/16 päris PostgreSQL-is tõendas finalize/finalize ja finalize/void võistlustes täpselt ühe võitja, ühe 409 kaotaja ja mõlemal juhul olekuga kooskõlalise lõpprea.

### SOL-SLOG-09 — paralleelsed kinnitatud kirje parandused ei moodusta usaldusväärset muutmisahelat — P1

**Tõend.** `updateEntry()` loeb kogu olemasoleva rea enne tehingut, arvutab sellest `previousValues` ning teeb hiljem update'i ja correction-create'i küll ühe tehinguna, kuid ilma versiooni või `updatedAt` eeltingimuseta (`lib/serviceLog/entries.js:609-620`, `:692-747`). Kaks parandajat saavad seega mõlemad logida sama vana väärtuse ja kirjutada teineteise tulemuse üle.

**Mõju.** Paranduslogis võivad mõlemad toimingud näida lähtuvat samast väärtusest, kuigi teine asendas esimese; lõppväärtuse ajalugu ei ole enam ahelana rekonstrueeritav. RPS §10 jaoks loodud jälg võib olla formaalselt olemas, kuid sisuliselt vale.

**Vastuvõtukriteerium.** Parandus peab kasutama rea versiooni/CAS-i või lukku ning correction'i eelmine väärtus peab tulema samas serialiseeritud tehingus. Teine stale parandus peab saama 409 koos värske reaga; testida sama ja eri välja paralleelmuudatusi.

**Seis (12.08.2026): DONE — kirje PATCH nõuab nüüd kliendi nähtud `expectedUpdatedAt` versiooni ning ServiceEntry CAS ja `ServiceEntryCorrection` sünnivad samas tehingus; stale kaotaja saab 409 koos värske reaga.** Paranduse `previousValues` arvutatakse ainult CAS-iga kaitstud snapshotist. Päris PostgreSQL-i sond võistles eraldi sama välja ja eri väljade parandustega: mõlemas üks võitja, üks värske reaga 409 ning täpselt üks correction, mitte kaks sama vana lähtega haru.

### SOL-SLOG-10 — osutaja saab platvormikliendi digikinnituse asemel märkida käsitsi kinnituse — P1

**Tõend.** Lifecycle-route lubab kõigil teenuskirjetel `confirm_manual` ja `unconfirm_manual` toiminguid ning annab need otse `updateEntry()`-le (`app/api/service-entries/[id]/lifecycle/route.js:41-49`). Teenus ei kontrolli, et `clientUserId` oleks tühi või klient tõesti väline; lõpliku rea `confirmedManually` saab ka põhjuse ja correction-reata tagasi `false`-ks muuta (`lib/serviceLog/entries.js:713-733`).

**Mõju.** Teenuseosutaja saab platvormil oleva kliendi eest kinnituse sisestada või selle hiljem jäljetult eemaldada, kuigi kommentaar lubab osutajale ainult välise kliendi paberkinnitust ja platvormikliendile eraldi digirada. Ekspordis võib tekkida vale kinnitusfakt.

**Vastuvõtukriteerium.** Käsitsi kinnitus peab serveris olema lubatud ainult väliskliendi real ning kandma kinnitaja, aja ja pöördumatu/parandatava auditireegli. Platvormikliendi katse peab andma 409/403; eemaldamine peab olema jälgitav parandus, mitte vaikne boolean.

**Seis (12.08.2026): DONE — paberkinnituse märge on nüüd eraldi `setManualConfirmation()` elutsüklirada, mida saab kasutada ainult FINAL väliskliendi kirjel; üld-PATCH on selle välja jaoks suletud ja platvormikliendi katse annab 409.** Iga tegelik märkimine ja eemaldamine loob samas CAS-tehingus `ServiceEntryCorrection` rea, mis kannab tegijat, aega, vana boolean-väärtust ja toimingu liiki. Päeva- ja kuuvaade ei näita nuppu platvormikliendile ega mustandile. PostgreSQL-i sond tõendas platvormikliendi muutmata rea/auditite 0 ning väliskliendi true→false järel kaks järjestikust auditirida; Teenuspäeviku testslice 342/342 PASS, muudetud failide eslint ja i18n puhtad.

### SOL-SLOG-11 — kliendi kuupõhine kinnitus võib hõlmata kontrolli järel lisatud nähtamatut kirjet — P1

**Tõend.** `confirmClientMonth()` loeb esmalt kuu ridade arvu ja kontrollib 500 piiri, seejärel teeb eraldi `updateMany` kõigile kuu kinnitamata FINAL-ridadele (`lib/serviceLog/clientView.js:141-165`). Kahe operatsiooni vahel puudub tehing/snapshot või kinnitatavate ID-de külmutamine.

**Mõju.** Osutaja saab loenduskontrolli järel uue rea kinnitada/finaliseerida ning kliendi samaaegne vajutus märgib ka selle rea `confirmedByClientAt`-iga, kuigi klient ei saanud seda oma eelnevas vaates näha. Pöördumatu kinnitus ei vasta kuvatud dokumendile.

**Vastuvõtukriteerium.** Kinnitus peab kandma kliendile kuvatud külmutatud ID-loendit või serveri väljastatud snapshot-versiooni ning muutunud kuu korral 409-ga uut ülevaatust nõudma. Paralleeltest peab lisama FINAL-rea count'i ja update'i vahele ning tõendama, et see ei kinnitu.

**Seis (12.08.2026): DONE — kliendi kuuvaade annab nähtavate ID-de ja sisu sha256-snapshoti ning POST nõuab sama võtit, külmutab ID-loendi ja kinnitab ainult need read serialiseeritavas tehingus.** Lühike PostgreSQL-i SHARE-lukk sulgeb FINAL-fantoomirea akna; enne tehingut muutunud kuu saab 409 ja UI laadib värske vaate. `npm run slog:confirmation-retention:probe` lisas FINAL-rea deterministlikult snapshoti lugemise ja update'i vahele: lisamine ootas lukku, kliendi nähtud rida kinnitus, uus rida jäi kinnitamata ning vana snapshoti kordus sai 409.

### SOL-SLOG-12 — seitsmeaastase säilitusega kuuaruande saab tavalisest dokumendi-DELETE rajast kohe kustutada — P1

**Tõend.** Arhiveerija märgib Teenuspäeviku aruande `SERVICE_LOG_REPORT` dokumendiks ja paneb metaandmetesse RPS §12 põhise `retentionEndsAt` (`lib/serviceLog/reportArchive.js:129-160`). Üldine dokumendi DELETE kontrollib omanikku ja framework-read-only olekut, kuid mitte kind'i ega retention-tähtaega, ning kustutab rea ja faili kohe (`app/api/documents/[id]/route.js:313-405`). Konto kustutuse kogur valib samuti kõik omaniku `UserDocument` read ilma retentsioonierandita (`lib/privacy/userDeletion.js:17-36`).

**Mõju.** Platvormi enda sõnul väljastatud aruanne ja tema baitidest tõend võivad kaduda aastaid enne lubatud tähtaega nii käsitsi kui konto kustutamisel. Hilisem kirjeparandus tähendab, et sama kuu uus eksport ei tõenda, mis varem esitati.

**Vastuvõtukriteerium.** Teenuspäeviku aruande füüsiline/DB kustutus peab enne tähtaega fail-closed olema või minema anonüümitud juriidilisse arhiivi; konto kustutus peab säilitama vajaliku dokumendi ilma aktiivse kasutajaidentiteedita. Testida DELETE-i ja konto kustutust enne ning pärast retentionEndsAt aega.

**Seis (12.08.2026): DONE — tavapärane dokumendi DELETE annab aktiivse RPS § 12 tähtajaga raportile 409 ning puuduv või vigane tähtaeg lukustab kustutuse fail-closed.** Konto kustutus eraldab säilitatava faili tavakustutuse sihtidest ja teisaldab `UserDocument` rea enne kasutajakaskaadi `ServiceLogReportLegalArchive` tabelisse, millel ei ole `ownerId`-d, `userId`-d ega User-seost. Olemasolev retention-sweep kustutab pärast tähtaega esmalt faili ja siis arhiivirea. Päris PostgreSQL-i sond tõendas omaniku-`UserDocument` kadumise, identiteediväljadeta arhiivirea ja tähtajajärgse fail+DB koristuse; Teenuspäeviku ning konto-kustutuse testslice 366/366 PASS. Vajab migratsiooni `20260812213000_sol_slog_12_report_legal_archive`.

### SOL-SLOG-13 — pelk otsese juhi seos annab tundliku kliendiaruande sisuõiguse vastupidiselt org-lepingule — P0

**Tõend.** `listShareRecipients()` lisab lubatud saajaks iga aktiivse lõputa `OrganizationReportingLine.manager` liikmesuse (`lib/serviceLog/reportShare.js:105-142`, `:173-195`) ning saatmisrada kasutab sama loendit autoriseerimise alusena (`reportShare.js:206-242`). Prisma mudeli enda invariant ütleb sõnaselgelt, et otsese juhi seos **ei anna sisuõigusi** ja seda ei tohi kasutada capability-kontrollis (`prisma/schema.prisma:5056-5071`).

**Mõju.** Juhiseos, mis oli mõeldud vaikeadressaadiks, muutub siin kliendinimede, teenuste, mahtude ja märkmetega faili lugemisõiguseks ilma vastava capability-ta. Valesti või liiga laialt määratud juht saab tundliku aruande seadusliku aluseta.

**Vastuvõtukriteerium.** Sisu saaja peab omama selgelt nimetatud ja skoopitud aktiivset aruandelugemise capability't; reporting line võib ainult soovitada kandidaati, mitte autoriseerida. Negatiivtest peab tõendama, et manager-seos ilma capability-ta ei ilmu saajatesse ega läbi otsest POST-i.

**Seis (10.08.2026): DONE — autoriseerib ainult capability, juhiseos võtab sõna. Commit `bcff4903`.**

`listShareRecipients()` ei ole ainult UI valik — sama loend on ka saatmise
autoriseerimise alus (`shareMonthlyReport` valideerib tema vastu), seega leid andis
õigust, mitte ainult nähtavust. Nüüd lisab saaja **ainult** capability; juhiseos võib
öelda ainult, KUIDAS teda nimetada („juht" on täpsem sõna kui „üksuse juht", kui sama
inimene on mõlemat). Ilma capability-ta ei ilmu ta loendisse ega läbi otsest POST-i.

Järjekord failis on nüüd **autoriseerimisotsus, mitte stiil** — grantide silmus käib enne
juhiseoste oma ja see on kommentaaris välja öeldud, et järgmine muutja ei keeraks neid
kogemata tagasi.

Väravad ja negatiivkontroll: vt SOL-SLOG-14 Seis-lõiku (sama commit).

**NOT_PROVEN:** päris PostgreSQL-i WHERE-d ega autenditud POST-i ei ole läbi käidud.

### SOL-SLOG-14 — aruandesaajate päring kirjutab kehtivusfiltri üle ja lubab aegunud capability — P0

**Tõend.** `activeGrantWhere()` tagastab `OR` tingimuse `validUntil` kontrolliks (`lib/serviceLog/reportShare.js:87-97`). Capability päringu objektis spread'itakse see sisse, kuid hilisem teine `OR` skoobitüübi jaoks kirjutab JavaScripti samanimelise võtme üle (`reportShare.js:146-158`). Alles jäävad `revokedAt` ja `validFrom`, kuid `validUntil` tingimus kaob päris Prisma WHERE-st.

**Mõju.** Aegunud UNIT_LEAD või ORG_OWNER luba annab endiselt õiguse saada töötaja kliendiaruande külmutatud koopia. UI ja server kasutavad sama vigast loendit, seega otsene saatmine õnnestub ning näeb korrektse autoriseerimisena välja.

**Vastuvõtukriteerium.** Kehtivus ja skoop peavad olema ühe `AND` struktuuri eri harudes või ühises testitud abis; aegunud, tulevane ja revoked grant peavad kõik välja jääma. Integratsioonitest peab kontrollima lõppenud luba nii saajaloendis kui saatmis-POST-is.

**Seis (10.08.2026): DONE — kehtivus ja skoop on ühe `AND` eri harudes. Commit `bcff4903`.**

Abifunktsioon tagastab nüüd **massiivi**, mitte objekti, ja tingimused elavad ühe `AND`
harudena. Kaks haru kõrvuti ei saa teineteist üle kirjutada — **struktuur ise välistab vea,
mitte tähelepanelikkus**. Vana kuju (objekt, mille sees `OR`, spread'itud `where`-i, kus oli
juba teine `OR`) kaotas `validUntil` kontrolli päris Prisma WHERE-st ilma süntaksivea,
hoiatuse või testita.

Testi fake **hindab `AND`/`OR`-i päriselt**. Mõlemad leiud on vaikselt kadunud tingimused,
seega fake, mis `where`-i sisu ära neelab, annaks sama vastuse nii vana kui uue koodiga —
ta tõendaks oma puudust. Sama klass sundis 10.08 õpetama fake'ile ka `orderBy`/`skip`-i
(SOL-URG-01) ja `lte`-d (SOL-CALL-10).

Väravad: `npm test` **3367/3367** · eslint puhas. **Negatiivkontroll: 3 testi 8-st kukub
vana teostuse peal** ja need kolm on täpselt kahe leiu omad. Ülejäänud 5 on
regressioonivalve — sh „tulevikus algav ja tagasi võetud luba jäävad välja", mis vanas
koodis **töötas**: ülekirjutamine kaotas ainult `validUntil`, mitte `validFrom` ega
`revokedAt`. See vahe on mõõdetud, mitte oletatud.

**NOT_PROVEN:** kriteerium nõudis integratsioonitesti, mis kontrollib lõppenud luba ka
saatmis-POST-is. Tõendatud on saajaloend; POST kasutab sama loendit, aga seda ahelat ei ole
päris päringuga läbi käidud. Just see leid näitab, miks vahe loeb — fake ei koosta päris
WHERE-d.

### SOL-SLOG-15 — aruande koopia failikirjutus ja jagamis-/auditirida võivad jääda lahku — P1

**Tõend.** `shareMonthlyReport()` loeb ja kirjutab tundliku faili enne `ServiceReportShare` rea loomist (`lib/serviceLog/reportShare.js:244-251`). DB loomise, sealhulgas P2002, vea korral faili ei kustutata (`reportShare.js:250-291`). Eduka rea järel neelatakse kohustusliku org-auditi viga (`:276-285`). Sama best-effort auditit kasutatakse avamisel ja tagasivõtmisel (`:401-417`, `:430-443`).

**Mõju.** Paralleelse topeltsaatmise või DB vea järel jääb kettale omanikuta kliendiaruanne, mida retention ega kasutajaliides ei leia. Teisalt võib saatmine, lugemine või tagasivõtmine õnnestuda ilma vastutusjäljeta.

**Vastuvõtukriteerium.** Fail peab sündima ajutisse asukohta ning liikuma lõplikuks ainult koos taastatava DB-olekuga; veal tuleb fail kindlasti puhastada või püsiv cleanup-job luua. Jagamise põhitegu ja audit peavad olema sama tehingu/transactional-outbox'i osa. Veasüstitestid peavad katma store→DB, DB→audit ja P2002 rajad.

**Seis (12.08.2026): DONE — jagamine loob enne failikirjutust püsiva `PREPARING` rea, kirjutab koopia staging-asukohta, promob selle lõplikuks ning commitib alles siis `SENT` siirde ja kohustusliku org-auditi samas tehingus.** Store-, promote-, DB- või auditivea kompensatsioon puhastab mõlemad võimalikud failiteed; puhastuse enda tõrkel jääb `PREPARING` rida retention-sweepile taastatavaks cleanup-job'iks. P2002 tekib enne ühtegi uut faili. Ka tagasivõtmise `RECALLED` ja audit commitivad nüüd koos. Veasüstitestid katsid store→DB, DB→audit, cleanup-tõrke ja P2002; `npm run slog:share-integrity:probe` tõendas päris PostgreSQL-is SENT+auditi, staging-promote'i, failita P2002 ja RECALLED auditi rollbacki.

### SOL-SLOG-16 — liikmesuse, organisatsiooni või omaniku kustutus kaskaadib juhile saadetud külmutatud aruande — P1

**Tõend.** `ServiceReportShare` kannab ainsat juhile kuuluvat külmutatud faili ja lubab tagasivõtmisel rea alles jätta, kuid kõik kolm seost — owner User, Organization ja recipient OrganizationMembership — on `onDelete: Cascade` (`prisma/schema.prisma:5507-5544`; migratsioonis `20260803000000_service_report_share/migration.sql:51-59`). Teenuskihis pole enne neid kustutusi koopiat anonüümivasse/retentsiooni säilitavasse rada.

**Mõju.** Töötaja konto kustutus, juhi liikmesuse lõpetamise tehniline kustutus või organisatsiooni kustutus eemaldab nii aruande ligipääsu kui saatmise/avamise/tagasivõtu tõendi, sõltumata aruande säilitustähtajast. Kettale jääva faili puhastus pole cascade'i osa, mistõttu võib sama tegu jätta ka orvufaili.

**Vastuvõtukriteerium.** Säilitatava jagamise identiteediseosed peavad kasutama SetNull + erased-at snapshot'i või eraldi retentsiooniarhiivi; liikmesuse/konto kustutus peab puhastama või säilitama faili koos DB reaga ühe tõendatava poliitika järgi. Testida kõigi kolme vanema kustutust.

**Seis (12.08.2026): DONE — `ServiceReportShare` omaniku, organisatsiooni ja saajaliikmesuse FK-d on nüüd nullable `SetNull` seosed ning DB-trigger kirjutab iga kadunud vanema jaoks vastava erased-at ajatempli.** Külmutatud fail, räsi, periood, jagamisolek ja aruandest pärit `retentionEndsAt` jäävad alles; retention-sweep kustutab faili ja rea alles tähtaja järel. Päris PostgreSQL-i sond kustutas järjest omaniku, saajaliikmesuse ja organisatsiooni: rida elas kõik kolm kaskaadi üle, iga seos muutus nulliks koos erased-at jäljega ning faili räsi ja tähtaeg säilisid. Teenuspäeviku ja konto-kustutuse testslice 373/373 PASS. Vajab migratsiooni `20260812223000_sol_slog_15_16_share_integrity`.

### SOL-SLOG-17 — mitme organisatsiooniga töötaja kaudu näeb üks juht teise organisatsiooni klienditöid — P0

**Tõend.** Juhi tahvel tuletab org-skoobi aktiivsetest liikmetest `workerUserId` loendi, kuid küsib seejärel `ServiceWorkRoute` ridu ainult töötaja ID ja päeva järgi; route/visit ei kanna `organizationId` seost (`lib/serviceLog/dispatchBoard.js:100-167`, `prisma/schema.prisma:5582-5689`). Ühe töötaja SOLO-profiil ja avatud päev koondavad seetõttu eri organisatsioonidest määratud või tema enda lisatud külastused samasse teekonda. Tahvel tagastab kliendinimed ja tulemused (`dispatchBoard.js:175-220`).

**Mõju.** Kui töötaja on aktiivne kahes organisatsioonis, saab org A juht näha org B klientide nimesid, hilinemist, käiguolekut ja outcomeReason'it. Inimese kaudu tuletatud skoop ei tõenda töö organisatsioonilist päritolu.

**Vastuvõtukriteerium.** Iga juhitav route/visit peab kandma loomise hetkel tõendatud organisatsiooni/üksuse snapshot-skoopi või juhitöö peab olema organisatsiooniprofiili all; board peab filtreerima seda seost. Negatiivtest peab looma ühe töötaja kahes organisatsioonis ja kummagi kliendid ning tõendama vastastikuse nähtamatuse.

**Seis (10.08.2026): DONE.** Parandatud koos SOL-SLOG-18-ga — sama juur, kaks otsa.

- **Snapshot elab KÜLASTUSEL, mitte teekonnal.** `ServiceVisit.assignedOrganizationId`
  (migratsioon `20260810160000`). Teekond ei saanud teda kanda ja see on leiu tuum: kahes
  majas töötaval inimesel on ÜKS SOLO-profiil ja ÜKS tööpäev. Org-veerg teekonnal oleks
  eeldanud, et päev kuulub ühele majale — ta ei kuulu.
- **Kirjutatakse seal, kus ta on TÕENDATUD.** Juhi määramisel (`assignVisit`) on
  `assertCanAssign` just kontrollinud kutsuja kehtivat luba ja töötaja skoopi, seega
  organisatsioon on teada, mitte tuletatud.
- **Töötaja enda lisatud töö** (`createVisit`) saab päritolu ainult siis, kui see on
  ühemõtteline — täpselt üks aktiivne liikmesus. Kahe puhul jääb `NULL` ja töö ei ilmu
  KUMMALEGI juhile. Vale juht on halvem kui puuduv rida.
- **`NULL` = mitte kellelegi, mitte kõigile.** Vaikimisi kinni.
- **Tahvlil on nüüd kaks filtrit, mis vastavad eri küsimustele:** liikmesus ütleb, KELLE
  read ilmuvad, külastuse päritolu ütleb, MILLISED tööd nendel ridadel on.
- **Võõrvõtit teadlikult ei ole.** See on snapshot („kelle tööna see sündis"), mitte elav
  seos: `Cascade` kustutaks tõendi koos organisatsiooniga, `SetNull` teeks tööst orvu.
  Kustutatud organisatsiooni ID ei anna kellelegi ligipääsu — skoop nõuab kehtivat
  liikmesust ja luba.

**Teadlik jääk, mida see parandus EI kata.** Tahvel näitab endiselt tööpäeva enda seisu
(avatud / paus / lõpetatud) ka siis, kui ühtegi selle maja tööd sellel päeval ei ole. See on
selle inimese päev, kes ON selle juhi aktiivne liige, ja juht peab teadma, kas ta on
alustanud; kliendi kohta ei ütle see mitte midagi. Kui omanik soovib ka seda peita, on see
tooteotsus, mitte tehniline takistus — rida tuleks siis tahvlilt üldse välja jätta.

**Kriteeriumi osa, mis on nimeliselt asendatud:** „organisatsiooni/**üksuse** snapshot".
Salvestatud on organisatsioon, mitte üksus. Üksuse piir jõustub liikmesuse kaudu
(`resolveBoardScope` → üksuse liikmed → `workerIds`) ja ta hinnatakse ÜMBER iga päringu ja
iga ümbermääramise ajal — külmutatud üksus tähendaks, et üksusest lahkunud inimese töö jääb
vanale juhile nähtavaks. Organisatsioon on turvapiir, üksus on töökorraldus.

**Tõend (päris PostgreSQL, lokaalne):** üks teekond, kolm külastust — `org-a-probe`,
`org-b-probe` ja päritoluta. `WHERE routeId = … AND assignedOrganizationId = 'org-a-probe'`
tagastas ainult `A maja klient`, ja `EXPLAIN` näitab **Index Scan** uue
`ServiceVisit_assignedOrganizationId_routeId_idx` peal, mitte skaneerimist.
`npm run db:migrate:check` OK (145 migratsiooni, skeem vastab ahelale).

**Testid.** `tests/serviceLog/visitOrigin.test.js` (uus, 10 testi, ülekaalus negatiivsed).
Negatiivkontroll: päritolu-kontrolli tühistamine kukutab 8 testi 10-st.
`npm test` 3384/3384 (TZ=UTC).

**runtime: not_run** — kahe päris organisatsiooni ja ühe jagatud töötajaga läbimängu ei ole
lokaalselt tehtud (nõuaks kaks organisatsiooni, üksused ja capability-grant'id). Andmekihi
käitumine on ülal päris andmebaasis mõõdetud.

### SOL-SLOG-18 — ühe organisatsiooni juht saab teise organisatsiooni külastuse ümber määrata — P0

**Tõend.** `reassignVisit()` otsib külastuse globaalselt ainult ID järgi ja seejärel kontrollib, kas vana ning uus töötaja kuuluvad kutsuja antud organisatsiooni skoopi (`lib/serviceLog/dispatchAssign.js:184-237`). Külastusel endal pole organizationId/provenance'i ning kontroll ei tõenda, milline organisatsioon töö algselt määras. Update muudab profiili, route'i ja omanikku tingimusteta; audit kirjutatakse best-effort (`:239-246`).

**Mõju.** Kahes organisatsioonis töötava inimese org A juht saab teadaoleva visitId abil org B planeeritud klienditöö oma töötajale liigutada. Org B päevaplaanist kaob töö, kliendiandmed kanduvad A töötajale ning audit võib puududa.

**Vastuvõtukriteerium.** Ümbermääramine peab kontrollima külastuse külmutatud organizationId/unitId seost ja samaaegselt aktiivset capability't; võõra päritoluga ID peab olema 404. Audit peab olema põhimuudatusega atomaarne. Testida mitme orgi töötaja ristümbermääramist ja auditiviga.

**Seis (10.08.2026): DONE.** Sama plokk mis SOL-SLOG-17 (üks juur: külastusel puudus
organisatsiooniline päritolu).

- **Külmutatud seost kontrollitakse ESIMESENA.** `reassignVisit` küsib nüüd
  `assignedOrganizationId` ja lükkab võõra maja töö tagasi ENNE olekukontrolli ja ENNE
  õiguste kontrolli. Vastus on **404**, mitte 403 ega konflikt: „sul ei ole õigust" ja „see
  töö on juba alustatud" ütleksid mõlemad välja, et selline külastus on olemas — ja seegi on
  info teise organisatsiooni töö kohta. `NULL` päritolu langeb samasse harusse.
- **Kehtiv capability jäi alles ja ta on endiselt KAHEKORDNE:** mõlemad töötajad peavad
  olema kutsuja skoobis (`assertCanAssign` × 2), ja kehtivust küsitakse päringus
  (`revokedAt`, `validFrom`, `validUntil`), mitte mälust.
- **Audit on nüüd põhimuudatusega ühes tehingus.** Varem oli ta `.catch(() => {})` taga:
  töö võis liikuda ühelt inimeselt teisele nii, et „kes selle ära viis" jäi kirjutamata.
  Nüüd `db.$transaction`: kas „liikus ja on jälg" või „ei liikunud". Sama parandus tehti ka
  `assignVisit`-ile — sama argument kehtib seal sõna-sõnalt.
- **Päritolu ümbermääramisel EI MUUDETA:** töö jääb sellele majale, kelle oma ta on, ja
  liigub ainult inimeselt inimesele.

**Kriteeriumi osa „testida auditiviga"** on kaetud struktuurselt, mitte veasüstiga:
audit ja update on ühes `$transaction`-is, seega auditi tõrge katkestab liigutuse
andmebaasi enda jõuga. Eraldi veasüstitesti kirjutamine nõuaks tehingu-fake'i, mis
tõendaks fake'i, mitte Postgresi.

**Testid.** Vt SOL-SLOG-17 Seis: `tests/serviceLog/visitOrigin.test.js` katab võõra maja
külastuse (404), sidumata päritolu (404) ja võõra maja ALUSTATUD töö (404, mitte konflikt).
Olemasolev `dispatchAssign.test.js` hoiab kahekordse õiguse piiri edasi.

**runtime: not_run** — vt SOL-SLOG-17.

### SOL-SLOG-19 — „üks aktiivne külastus” on ainult võidujooksule avatud eelkontroll — P1

**Tõend.** `transitionVisit()` kontrollib enne aktiivsesse olekusse kirjutamist, kas samal route'il on teine EN_ROUTE/ARRIVED rida, ja teeb siis eraldi tingimusteta update'i (`lib/serviceLog/dayRoute.js:437-474`). Skeem ja migratsioon loovad aktiivsele tööpäevale unikaalsuse, kuid aktiivsele `ServiceVisit` reale ainult tavalise status-indeksi; osalist unikaalpiiri pole (`prisma/schema.prisma:5687-5690`, `prisma/migrations/20260803120000_service_day_route/migration.sql:70-78`).

**Mõju.** Kahe külastuse paralleelsed „läksin” vajutused võivad mõlemad kontrolli läbida. UI valib `currentVisitId`-ks esimese leitud rea ning sõidu-, turvasignaali- ja sulgemisloogika jäävad kahe aktiivse töö vahel ebamääraseks.

**Vastuvõtukriteerium.** Andmebaas peab jõustama ühe aktiivse külastuse route/profiili kohta või siirded tuleb serialiseerida; kaotaja saab 409. Paralleeltest peab käivitama kaks eri külastust samal route'il.

**Seis (12.08.2026): DONE — kõik külastuse siirded võtavad nüüd `ServiceWorkRoute` rea `FOR UPDATE` luku ning loevad luku järel nii külastuse kui route'i uuesti.** Aktiivse teise külastuse kontroll ja olekukirjutus toimuvad samas tehingus, seega kahe eri külastuse paralleelsel alustamisel saab ainult üks võita ja teine 409. `npm run slog:route-race:probe` käivitas päris PostgreSQL-is kaks sama route'i eri `PLANNED` külastust paralleelse `depart`-iga: üks õnnestus, teine sai 409 ning andmebaasi jäi täpselt üks aktiivne rida. Kogu sond 10/10 PASS.

### SOL-SLOG-20 — päeva sulgemine ja külastuse alustamine võivad jätta aktiivse külastuse suletud route'ile — P1

**Tõend.** `closeRoute()` kontrollib aktiivse külastuse puudumist ja sulgeb route'i kahe eraldi päringuga (`lib/serviceLog/dayRoute.js:508-531`). `transitionVisit()` ei kontrolli, et seotud route oleks endiselt OPEN, ja kirjutab külastuse oleku eraldi (`dayRoute.js:370-474`). Nende vahele pole lukku ega tingimuslikku seost.

**Mõju.** Töötaja saab ühe samaaegse kutsega päeva edukalt lõpetada ja teisega külastuse EN_ROUTE/ARRIVED olekusse viia. Järgmine `openRoute()` loob uue päeva, kuid vana aktiivne töö jääb suletud route'ile ning turva- ja tööajaloogika lahknevad.

**Vastuvõtukriteerium.** Route'i sulgemine ja visiidisiirded peavad lukustama sama route'i või kontrollima atomaarse tingimusena route.status väärtust. Paralleeltest peab võistlema close/depart ja close/arrive ning lubama ainult ühe koherentse lõpptulemuse.

**Seis (12.08.2026): DONE — `closeRoute()` ja `transitionVisit()` serialiseeruvad nüüd sama `ServiceWorkRoute` realuku kaudu; siire nõuab luku järel endiselt `OPEN` route'i.** Kui sulgemine võidab, jääb visiit `PLANNED`; kui siire võidab, näeb sulgemine aktiivset visiiti ja annab 409. Päris PostgreSQL-i sond võistles eraldi `close/depart` ja `close/arrive`: mõlemas oli täpselt üks võitja, kaotaja sai 409 ning lõppseis oli vastavalt ainult `CLOSED/PLANNED` või `OPEN/EN_ROUTE|ARRIVED`, mitte kunagi aktiivne visiit suletud route'il. Struktuurivalvur hoiab mõlema toimingu ühise luku, luku järel tehtava korduslugemise ja `OPEN` kontrolli alles.

### SOL-SLOG-21 — erineva kliendi idempotentsusvõtmega saab ühest lõpetatud külastusest kaks arvekirjet — P1

**Tõend.** `createEntryFromVisit()` kontrollib `visit.serviceEntryId`, loob teenuskirje ja seob selle alles eraldi update'iga (`lib/serviceLog/dayRoute.js:634-681`). API lubab kutsujal anda suvalise `clientRequestId` (`app/api/service-visits/[id]/route.js:43-50`). Kahel paralleelsel kutsujal eri võtmetega pole ServiceEntry poolel sama külastuse unikaalset `sourceFieldVisitId` kaitset; mõlemad võivad kirje luua ja hilisemad update'id kirjutavad visit.serviceEntryId üksteise järel üle.

**Mõju.** Üks tehtud külastus võib tekitada kaks arve alusdokumenti, millest ainult üks paistab külastuse küljes; teine jääb tavaloendisse ja tarbib mahtu. UI kasutab küll deterministlikku võtit, kuid serveri otsene leping ei jõusta seda.

**Vastuvõtukriteerium.** Server peab tuletama idempotentsusvõtme ise visitId-st või kirjutama visitId teenuskirje unikaalsesse päritoluvälja; kirje loomine ja linkimine vajavad ühe taastatava tehingu/olekumasina lepingut. Testida kahte samaaegset eri võtmega create_entry kutset.

**Seis (12.08.2026): DONE — külastusest kirje loomise võti on nüüd ainult serveri tuletatud `visit-entry-<visitId>` ning sama unikaalne `sourceFieldVisitId` seob tulemuse külastusega.** Kutsuja võtit API enam edasi ei anna; juba lingitud külastus tagastab sama kirje idempotentselt. `npm run slog:entry-origin:probe` läbis päris PostgreSQL-is **12/12**, sealhulgas kaks paralleelset eri kliendivõtmega kutset: mõlemad said sama kirje, andmebaasi jäi üks teenuskirje ja üks tagasilink.

### SOL-SLOG-22 — suunamiseta kuunarratiiv ühendab sama nimega väliskliendid üheks looks — P1

**Tõend.** `ServiceMonthlyNarrative` ei kanna `clientExternalRef` välja ning suunamiseta väliskliendi osaline unikaalindeks kasutab nime (`prisma/schema.prisma:5441-5476`, `prisma/migrations/20260802100000_service_log_v1/migration.sql:161-166`). `getNarrativeSeed()` filtreerib samuti ainult `clientDisplayName` järgi ja `upsertNarrative()` leiab/uuendab sama nimega kuu rea (`lib/serviceLog/narratives.js:69-115`, `:140-208`).

**Mõju.** Kahe sama nimega väliskliendi faktid, märkmed ja AI sisend võivad koonduda ühte narratiivi ning ühe kliendi salvestus kirjutab teise loo üle. Ekspordi mallide parandatud grupivõti seda eraldi tabelit ei kaitse.

**Vastuvõtukriteerium.** Narratiivi väliskliendi identiteet peab sisaldama stabiilset minimeeritud viidet/snapshot-võtit ja osaline unikaalsus peab kasutama seda, mitte nime. Migratsioon peab olemasolevad nimepõhised konfliktid käsitsi lahendatavaks märgistama. Testida sama nime ja eri välisviitega kahte narratiivi ning seed'i.

**Seis (12.08.2026): DONE — suunamiseta väliskliendi narratiiv kasutab nime asemel stabiilset `clientExternalRef` identiteeti.** Uus osaline unikaalindeks on profiil+välisviide+aasta+kuu; vana nimepõhine indeks eemaldati. Migratsioon annab olemasolevatele nimepõhistele ridadele unikaalse `legacy:<id>` viite ja märgib need `clientIdentityNeedsReview=true`, nii et võimalikku identiteedivõlga ei peideta. `npm run slog:narrative-identity:probe` läbis päris PostgreSQL-is **6/6**: kaks sama nime ja eri viitega narratiivi ning nende seed'id jäid lahus.

### SOL-SLOG-23 — hiline narratiivi vastus võib ühe kliendi teksti teise kliendi alla salvestada — P1

**Tõend.** `ServiceLogNarrative` käivitab referral'i muutumisel seed'i ja olemasoleva narratiivi kaks järjestikust fetch'i, kuid ei kasuta AbortControllerit ega request-tokenit; iga hiline vastus kirjutab `bodyText`, `proposal`, `loadedId` ja AI-päritolu praegusesse olekusse (`components/serviceLog/ServiceLogNarrative.jsx:81-129`). AI-mustandi päringul on sama puudus (`:57-79`). Salvestus kasutab aga alati hetkel valitud `referralId` väärtust (`:131-167`).

**Mõju.** Kiire A→B kliendi vahetus võib jätta vormi A loo ja B valiku; „Salvesta” kirjutab A tundliku teksti B narratiiviks. Sama võib juhtuda, kui A AI-mustand lahendub pärast B valimist.

**Vastuvõtukriteerium.** Iga laadimine/genereerimine peab olema seotud referralId+month sõrmejäljega ja tohib olekut muuta ainult aktiivse request-ID korral; valiku vahetus peab vana mustandi tühistama või kinnitust küsima. Brauseritest peab lahendama A/B seed-, list- ja AI-päringud mõlemas järjekorras ning proovima salvestust.

**Seis (12.08.2026): DONE — seed, olemasolev narratiiv ja AI-mustand on seotud `referralId+month` sõrmejälje, request-ID ja AbortControlleriga.** Valiku vahetus tühistab vana töö ning puhastab editori kohe; hiline vastus ei tohi olekut muuta ja salvestus on blokeeritud, kui editori sõrmejälg ei vasta aktiivsele valikule. Päris brauseris lahendati seed-, list- ja AI-päringud nii A→B kui B→A järjekorras: kõik kuus jätsid ekraanile viimase valiku teksti ning salvestus saatis ainult nähtava A valiku ja `A SAFE` teksti.

### SOL-SLOG-24 — kuu-, saldo- ja narratiivivaated kärbivad alusandmeid vaikides — P1

**Tõend.** Kuuaruanne loeb kuni 5000 kuu kirjet ja kuni 5000 suunamiskirjet ning kuni 500 suunamist, kuid ei tagasta `truncated` olekut (`lib/serviceLog/monthReport.js:47-102`). Suunamiste saldo teeb sama 500/5000 piiriga (`lib/serviceLog/referrals.js:140-172`). Narratiivi seed võtab 2000 kirjet ja list 500 narratiivi ilma kärpeindikaatorita (`lib/serviceLog/narratives.js:99-115`, `:216-233`). Ekspordikiht oskab seevastu 5001. rea küsimisega kärpe nähtavaks teha (`lib/serviceLog/exportService.js:74-90`, `:152-157`).

**Mõju.** Suuremas teenuseosutuses võivad kuu summad, jäägid, kinnitamata arv ja narratiivi faktibaas olla poolikud, kuid UI ning AI esitavad neid täieliku kuuna. Kõige vanemad/uuemad puuduvad read sõltuvad päringute erinevast või määramata järjestusest.

**Vastuvõtukriteerium.** Rahalised koondid peavad kasutama täielikku DB-agregatsiooni või stabiilset lehekülgitamist; igal kaitsepiiril peab olema fail-closed või selge `truncated/incomplete` leping. Testida vähemalt 5001 kirjet, 501 suunamist ja 2001 narratiivikirjet nii, et piiri taha jääv rida muudab tulemust.

**Seis (12.08.2026): DONE — kuu-, saldo-, suunamis- ja narratiivipäringud kasutavad nüüd stabiilset ID-kursoriga lehekülgitamist ega lõpeta vaikides vana `take` piiri juures.** Ühine abifunktsioon nõuab igalt lehelt kasvavat viimast ID-d ja viskab seiskunud kursori korral, selle asemel et tagastada näiliselt täielik tulemus. Piirtestid tõendasid, et 5001. kuurida ja saldorida muudavad summat, 501. suunamine ja narratiiv jõuavad vastusesse ning 2001. seed'i kirje jõuab faktibaasi.

### SOL-RAGSVC-01 — kaks ingest-rada võimaldavad kirjutada faili väljapoole RAG-hoidlat — P0

**Tõend.** `/ingest/file` annab kliendi `payload.fileName` väärtuse muutmata `_process_ingest_file()`-le (`rag-service/main.py:3532-3545`) ning `/upload` teeb sama vormiväljaga `fileName` (`:3670-3715`). Ühine töötlus moodustab tee otse avaldisega `raw_path = d / file_name` ja kirjutab sinna baidid (`:3385-3407`); `_sanitize_filename()`-i neil kahel rajal ei kutsuta. Absoluutne failinimi tühistab `d` prefiksi ja `../` komponendid väljuvad räsi-kaustast. Platvormi admini catch-all proksi edastab suvalise RAG alamtee ja kirjutusmeetodi kõigile `ADMIN` rolliga kasutajatele (`app/api/rag/[...path]/route.js:101-108`, `:118-186`, `:223-240`).

**Mõju.** Adminikonto või selle sessiooni kaaperdaja saab RAG-protsessi kasutaja õigustes üle kirjutada suvalise kirjutatava serverifaili, sh rakenduse lähtekoodi, registri või teenuse konfiguratsiooni. Teenuse hilisem restart võib muuta failiüleslaadimise koodi käivitamiseks.

**Vastuvõtukriteerium.** Kõik failinimed tuleb serveris basename'iks normaliseerida, lõpptee `resolve()`-ida ja tõendada, et see jääb konkreetse dokumendi hoidla sisse; absoluutne, `..`, eraldajate ja sümlinkide kaudu põgenev tee peab andma 400. HTTP-negatiivtest peab katma mõlemad endpointid ning tõendama, et ükski bait ei teki väljaspool ajutist RAG-hoidlat.

**Seis (10.08.2026): DONE (kood); HTTP-negatiivtest deploy-järgne, vt allpool.**
Parandatud koos SOL-RAGSVC-02-ga — kaks leidu, üks viga: kliendi tekst kasutati failiteena
ilma tõendamata, et ta jääb hoidlasse.

- **Uus `rag-service/storage_paths.py`** (eraldi moodul samal põhjusel, mis
  `search_security.py`: `main.py` impordib fastapi/chromadb/openai ja teda ei saa
  ühiktestis laadida — **piir, mida ei saa testida, ei ole piir**).
- **KAKS VÄRAVAT JÄRJEST, mitte üks.** `safe_basename()` vastab küsimusele „mis on selle
  faili nimi", `resolve_within()` küsimusele „kas see tee on meie oma". Teine ei ole
  esimese pärast üleliigne: `doc_dir` ise võib olla sümling.
- **`_process_ingest_file`** kasutab neid mõlemat; ebaõnnestumine annab **400**. Registri
  `fileName` on nüüd see nimi, mis päriselt kettal on, mitte kliendi oma.
- **Leiu tuum ühe lausega:** Pythoni `/` EI OLE liitmine. `Path("/srv/storage/docs/abc") /
  "/etc/cron.d/x"` == `Path("/etc/cron.d/x")` — vasak pool visatakse ära. Seda ei näe koodi
  lugedes, kui seda mustrit ei tunne, ja just seepärast on selle peal nüüd nimeline test.
- **Windowsi eraldaja `\` võeti eraldi maha.** POSIX-il ei ole ta kataloogieraldaja, seega
  `Path(...).name` jätab `..\..\evil.dll` TERVIKUNA alles — vana `_sanitize_filename`
  asendas ta alles hiljem `_`-ga, aga `_process_ingest_file` ei kutsunud teda üldse.

**Testid.** `rag-service/test_storage_paths.py` (uus, 15 testi: absoluutne tee, `..`,
Windowsi eraldaja, NTFS-i vooeraldaja `:`, puhas punktijada, tühi string, **sama prefiksiga
naaberkaust** (`/…/storage-evil` ei ole `/…/storage` sees — `startswith` ütleks JAH) ja
**sümling hoidlast välja**). Negatiivkontroll: mõlema värava tühistamine kukutab 4 testi.
`python -m unittest test_storage_paths test_search_security` 20/20.

**HTTP-negatiivtest: JOOKSUTATUD 10.08 pärast deploy'd — `PROBE_OK 8/8` päris
toodanguteenuse vastu.** Kuni deploy'ni oli ta `runtime: not_run` ja seda teadlikult:
arendusmasinas ei ole `rag-service` sõltuvusi, ja **enne parandust oleks see test ise
rünnak** olnud. `npm run rag:path:probe` (`scripts/rag-path-containment-probe.mjs`) katab
`/ingest/file` ja `/upload` kolme vaenuliku nimega ning `/ingest/text` +
`/documents/{id}/source` raja `/etc/passwd`-iga.

Tulemus toodangus: kõik kuus vaenulikku nime maandusid **oma doc-kausta hoidla sees**
(`/var/lib/sotsiaalai-rag/docs/<hash>/…`), `/etc/passwd` andis meie oma salvestatud teksti.
Kettalt tõendatud kaks korda: `find / -name 'rag-escape-probe-*'` **tühi**, `/tmp` tühi,
probe-dokumendid koristatud.

**ESIMENE JOOKS ANDIS `PROBE_FAIL 6/7` — ja viga oli SONDIS, mitte serveris.**
Otsustusreegel oli `path.includes("..") || /rag-escape-probe/.test(path)`. Teine pool on
**iseenesest tõene**: vaenuliku faili nimi ONGI `rag-escape-probe-…` ja pärast õiget
puhastust jääb just see nimi tema oma doc-kausta alles. Sond kuulutas seega korrektse
ohjeldamise „põgenemiseks". Ilma kettakontrollita oleks see saatnud parandaja otsima viga,
mida ei ole — **või, mis hullem, oleks hiljem päris põgenemise puhul olnud juba
„teadaolevalt punane" ja seetõttu vaadatud üle**. Parandatud: sond **õpib hoidla juure**
(saadab kahjutu nimega kontrollfaili ja võtab juureks tema kausta emakausta) ning küsib
„KUS see fail on", mitte „kas nimi näeb kahtlane välja". Kõva tee sondi sisse ei kirjutatud
— see oleks teine tõde, mis teenuse kolides vaikselt vananeb. Kontrollfail on ühtlasi
sondi enda negatiivkontroll (8. rida tulemuses).

### SOL-RAGSVC-02 — tekstidokumendi `source_path` annab serverifaili lugemise primitiivi — P0

**Tõend.** `/ingest/text` võtab kliendi `metadata.source_path` väärtuse ja salvestab selle registri `path` väljale (`rag-service/main.py:3576-3589`, `:3617-3665`). `GET /documents/{doc_id}/source` avab TEXT-kirje `Path(entry["path"])` väärtuse ilma hoidla-containment'i kontrollita ja tagastab selle `FileResponse`-ina (`:4224-4242`). Eelnev admini catch-all lubab samal administraatoril mõlemat päringut teha.

**Mõju.** Adminikonto kaudu saab lugeda RAG-protsessile nähtavaid kohalikke faile, sealhulgas keskkonna-/teenusefaile ja võtmeid; leitud teenusevõtmeid saab kasutada täiendavaks liikumiseks. See ei ole tavapärane teadmisteallika eelvaade, sest tee ei pea osutama ingestitud ega RAG-hoidlas olevale failile.

**Vastuvõtukriteerium.** TEXT-sisend peab kas salvestama allikateksti enda hallatavasse hoidlasse või aktsepteerima ainult eelnevalt registreeritud, containment-kontrolliga sisemist faili-ID-d. Suvalist kliendi failiteed ei tohi registrisse ega `FileResponse`-i usaldada. Testida absoluutset teed, `..`, sümlinki ja registrisse käsitsi sattunud välist teed.

**Seis (10.08.2026): DONE — HTTP-negatiivtest jooksutatud toodangus, `PROBE_OK 8/8`.**
`/documents/{id}/source` andis pärast `source_path=/etc/passwd` ingesti **meie oma
salvestatud teksti**, mitte paroolifaili. Sondi enda vea lugu on SOL-RAGSVC-01 all.
Valitud on kriteeriumi ESIMENE haru: `/ingest/text` **salvestab allikateksti ise**
(`<hoidla>/docs/<räsi>/source.md`) ja registri `path` on nüüd meie oma tee. Kliendi
`source_path` jääb alles ainult päritolusildina metaandmetes — teda ei avata enam kunagi
failina.

**Kõrvalkasu, mis ei olnud kriteeriumis:** allikavaade näitab nüüd SEDA teksti, mis
päriselt vektoritesse läks. Varem osutas ta kettal olevale failile, mis võis vahepeal olla
muutunud või olla hoopis muu asi.

**Containment ei ole ainult allalaadimisel.** Auditi tõend nimetas
`GET /documents/{id}/source`, aga sama registri `path` avatakse veel **viies kohas** ja igaüks
neist oleks andnud sama lugemisprimitiivi ühe sammu kaudu:
`_load_pdf_pages()`, artiklite ingesti failisuurus, `reindex` FILE / URL / TEXT harud ja
metaandmete uuendus. Kõik käivad nüüd läbi `_storage_path_or_404()`. Reindeks oli neist
kõige vaiksem: ta LOEB faili ja paneb sisu vektoritesse, kust ta tuleb välja tavalise
otsinguga.

**Vastus on 404, mitte 400.** Kutsuja küsib dokumendi allikat; hoidlast välja osutav rida
ei ole „vigane päring", vaid „sellist allikat ei ole".

**Vana register.** Ridu, mille `path` osutab hoidlast välja (varem CLI-ingestiga
salvestatud), enam ei serveerita — nad annavad 404 ja logisse jääb hoiatus. See on
kriteeriumi „registrisse käsitsi sattunud väline tee" haru ja ta on **teadlik
funktsionaalne muutus**: nende dokumentide allikavaade lakkab töötamast, kuni nad uuesti
ingestitakse. Otsing ja vastused ei sõltu sellest — vektorid on juba baasis.

**Testid ja runtime:** vt SOL-RAGSVC-01 Seis (sama sviit, sama probe).

### SOL-RAGSVC-03 — puuduva teenusevõtmega lülitub RAG autentimine välja — P1

**Tõend.** `_require_key()` tagastab puuduva `RAG_SERVICE_API_KEY` korral edu kommentaariga `auth disabled` ning kontrollib päist ainult siis, kui võti on seadistatud (`rag-service/main.py:62`, `:635-639`). Sama sõltuvus kaitseb kõiki ingest-, otsingu-, allika-, metaandmete muutmise ja kustutamise endpoint'e. Next.js kliendid sulguvad puuduva võtmega küll veale, kuid RAG-teenus ise jääb lubavaks (`lib/documents/ragService.js:43-53`; `app/api/rag/[...path]/route.js:152-163`).

**Mõju.** Vigane või eraldi systemd keskkond ei peata teenust, vaid muudab kõik haldus- ja andmeendpointid võtmeta kasutatavaks. Praegune dokumenteeritud arhitektuur kasutab loopback-aadressi, mis vähendab internetipinda, kuid samas masinas olev protsess või ekslik bind/proksi saab täisõiguse.

**Vastuvõtukriteerium.** Teenus peab production-laadses režiimis puuduva või liiga nõrga võtmega käivitumast keelduma; võtmeta arendusrežiim peab olema eraldi eksplitsiitne lipp ja ainult loopback-bind. Käivitustest peab tõendama fail-closed oleku ning iga kaitstud endpointi 401 vale/puuduva võtmega.

**Seis (12.08.2026): DONE.** RAG loeb käivitumisel autentimiskonfiguratsiooni
`auth_config.py` kaudu ja katkestab protsessi, kui `RAG_SERVICE_API_KEY` puudub või on alla
32 märgi. Võtmeta arendus nõuab nüüd eraldi `RAG_ALLOW_INSECURE_NO_AUTH=1` lippu ning lubab
ainult loopback `RAG_BIND_HOST` väärtust; võtme võrdlus on konstantse ajaga. Kandev
negatiivkontroll kukkus enne parandust juba puuduva mooduli peal ning käivitussubprocess
tõendab, et `main` ise ei impordi võtmeta lõpuni. `test_endpoint_auth.py` hoiab 18 kaitstud
meetod+tee inventuuri ja tegi igaühele nii puuduva kui vale võtmega päringu: kõik 401.
Sihttestid `test_auth_config.py`, `test_endpoint_auth.py` ja olemasolev
`test_search_observability.py` **16/16**; runtime: not_run (käivituskäitumine tõendati lokaalse
ASGI rakenduse ja eraldi protsessiga, toodangut ei muudetud).

### SOL-RAGSVC-04 — üks üldine adminiproksi annab kõik RAG-i hävitavad õigused ilma toimingupõhise loata või auditita — P1

**Tõend.** `app/api/rag/[...path]/route.js:118-186` kontrollib ainult globaalset `assertAdmin()`-i, koostab kasutaja antud alamteest siht-URL-i ja edastab GET/POST/PUT/PATCH/DELETE/HEAD meetodid (`:223-245`). Marsruudil puudub lubatud tee+meetodi maatriks, eraldi knowledge-steward/platform-admin capability, CSRF-teoleping ja sisuline audit. RAG-teenus näeb kõiki kutsujaid sama `X-API-Key` võtmena.

**Mõju.** Iga globaalne administraator saab otse kustutada või ümber kirjutada kogu teadmistebaasi, käivitada URL-fetch'i ja kasutada failiallika endpoint'e; hiljem pole võimalik tõendada, milline inimene millise dokumendiga mida tegi. RAGSVC-01/02 muudavad selle ka serverifailide kompromiteerimise pinnaks.

**Vastuvõtukriteerium.** Avalik adminiproksi peab kasutama eksplitsiitset endpoint/meetod allowlist'i, toimingupõhist capability't ja kohustuslikku kasutaja-ID, sihtdokumendi, meetodi ning tulemusega auditit. Toore ingest'i, allikatee ja kustutuse jaoks peab olema kitsas serveri enda teenusliides või eraldi kõrge õigusega haldusvoog. Negatiivtestid peavad kontrollima tavalist ADMIN-i, lubatud teadmistehalduri ja platform-admini erisust.

**Seis (12.08.2026): DONE.** Brauseri catch-all kasutab nüüd täpset meetod+tee maatriksit:
teadmistehaldur saab dokumente lugeda ning hallatud PDF-i/artikleid ingestida, platform-admin
lisaks kustutada ja URL-ingest'i käivitada. Toored `/ingest/file`, `/ingest/text`, otsingu- ja
analyze-pinnad ei ole enam avaliku proksi kaudu saavutatavad. Tavaline `ADMIN` ei saa RAG-õigust
rollist; püsiv `User.ragAdminCapability` on `NONE`, `KNOWLEDGE_STEWARD` või `PLATFORM_ADMIN`.
Migratsioon säilitab olemasolevate administraatorite ligipääsu platform-adminina, uued kontod
algavad `NONE`-ist. Kõik mutatsioonid nõuavad täpset same-origin `Origin`-päist. Iga lubatud
upstream-kutse saab enne käivitust kohustusliku `rag_proxy_operation_started` rea ning tulemuse
järel lõpetava rea kasutaja, toimingu, meetodi, lubataseme, sihtdokumendi/tee ja HTTP-tulemusega;
algusauditi viga ei käivita toimingut, lõppauditita edu kliendile ei tagastata. Sihttestid
**8/8**, sh ADMIN/steward/platform-admin eristus ja audititõrked; 171 migratsiooni täisahel
puhtas PostgreSQL-is OK. Runtime: not_run (päris adminisessiooni ja RAG-teenust ei käivitatud).

### SOL-RAGSVC-05 — katkine registrifail tõlgendatakse tühja registrina ja järgmine kirjutus matab vana loendi — P1

**Tõend.** `_load_registry_unlocked()` neelab kõik `registry.json` lugemis- ja JSON-parsimisvead ning tagastab `{}` (`rag-service/main.py:605-611`). `_register()` loeb selle tühja väärtuse, lisab ühe uue kirje ja asendab registrifaili (`:2406-2416`). Tervise-, loendi- ja dokumendiendpointid käsitlevad sama tühja tulemust normaalse seisuna.

**Mõju.** Osaline kettakirjutus, käsitsi viga või failisüsteemitõrge muudab kogu dokumendiregistri nähtamatuks; esimene hilisem ingest kirjutab ainsa uue kirjega näiliselt kehtiva registri ning kaotab taastamiseks vajaliku veaoleku. Vektorid ja toorfailid jäävad alles, kuid haldus- ja kustutusteed neid enam ei leia.

**Vastuvõtukriteerium.** Olemasoleva registri lugemis-/skeemiviga peab teenuse kirjutused fail-closed peatama ja tervise punaseks muutma; säilitada tuleb viimane kontrollitud snapshot/backup ning taastamisjuhis. Veasüstitest peab katkestama JSON-i, proovima loendit, ingest'i ja delete'i ning tõendama, et vana fail ei asendu.

**Seis (12.08.2026): DONE koos SOL-RAGSVC-06-ga.** Register elab nüüd eraldi
`RegistryStore`-is: puuduv fail tähendab esimest käivitust, kuid olemasoleva faili JSON-,
UTF-8-, juurkuju-, kirjerea- või `docId` vastuolu annab `REGISTRY_CORRUPT`, `/health` 503 ning
kõik püsivad ingest/patch/reindex/delete rajad peatuvad enne Chroma või faili muutmist.
Veasüstitest rikkus töötava registri, proovis health/list/ingest/delete rada ja tõendas, et
ükski vector-kutse ei toimunud, katkine baitijada ei asendunud ning `registry.json.last-good`
jäi muutmata. Taastejuhis on `rag-service/REGISTRY_RECOVERY.md`; automaatset vaikset taastamist
ei tehta. Sama ploki testid **21/21** (sh varasem auth/observability slice); runtime: not_run.

### SOL-RAGSVC-06 — registri lukk ja fikseeritud `.tmp` fail ei kaitse mitme protsessi kaotatud uuenduste eest — P1

**Tõend.** `REGISTRY_LOCK` on protsessisisene `threading.Lock` (`rag-service/main.py:148`). Salvestus kasutab alati sama `registry.json.tmp` nime ja `os.replace()`-i (`:617-624`); register/update/pop on read-modify-write ainult selle kohaliku luku all (`:626-633`, `:2406-2416`, `:4464-4471`). Kui teenus käivitatakse mitme Uvicorni worker'i või kahe kattuva protsessiga, pole neil ühist lukku ega unikaalset ajutist faili.

**Mõju.** Paralleelsed protsessid võivad lugeda sama vana registri, kirjutada teineteise `.tmp` faili või viimase salvestusega teise dokumendi muudatuse kaotada. Repo ei sisalda RAG systemd unit'i täpset `ExecStart`/worker-arvu, seega tootmises avaldumine on `NOT_PROVEN`, kuid koodileping ei ole protsessiohutu.

**Vastuvõtukriteerium.** Registri tõeallikas peab olema transaktsiooniline andmebaas või kasutama OS-ülest faililukku, unikaalset temp-faili, fsync'i ja versiooni/CAS-i. Mitme protsessi test peab tegema samaaegseid eri dokumendi register/patch/delete toiminguid ja säilitama kõik uuendused.

**Seis (12.08.2026): DONE koos SOL-RAGSVC-05-ga.** Protsessisisene `threading.Lock` ja ühine
`.tmp` fail on eemaldatud. `filelock`-i OS-ülene lukufail katab kogu read-modify-write tsükli;
iga kirjutus kasutab PID+UUID tempfaili, faili `fsync`-i, atomaarset `os.replace`-i ja võimalusel
kataloogi `fsync`-i. Nelja päris protsessi test tegi korraga 100 register-, 100 patch- ja 20
delete-toimingut: alles jäi täpselt 80 õige omaniku ning patchiga kirjet ja tempjääke 0.
Lukutimeout ja I/O-viga on fail-closed `REGISTRY_IO_ERROR`, mitte tühi register.

### SOL-RAGSVC-07 — dokumendi vektorite asendamine võib jätta vana ja uue indeksi osaliselt kadunuks — P1

**Tõend.** `_replace_document_vectors_payload()` proovib vana sisu lugeda kuni 100 000 kirjena, kuid neelab lugemisvea ja jätkab tühja backup'iga (`rag-service/main.py:2311-2336`). Seejärel kustutab kõik dokumendi vektorid ja upsert'ib uued eraldi operatsioonidena (`:2338-2358`). Vea korral taastatakse vana ainult siis, kui kõik neli loendit on olemas ja sama pikkusega; taastamise enda viga üksnes logitakse (`:2359-2369`).

**Mõju.** Chroma ajutine lugemis- või kirjutusviga, üle 100 000 tüki või protsessi katkestus delete'i ja upsert'i vahel võib jätta dokumendi täiesti otsinguta või osalise uue indeksiga. Endpoint tagastab vea, kuid varasem töötav versioon pole garanteeritult taastatud.

**Vastuvõtukriteerium.** Uus versioon tuleb kirjutada eraldi versioonilise doc-ID/kollektsiooni alla, kontrollida terviklikuks ja alles siis atomaarse aktiivversiooni viitega vahetada; vana versioon säilib kuni commit'ini. Veasüstitestid peavad katkestama backup-get'i, delete'i, iga upsert-batch'i ja aktiveerimise.

**Seis (12.08.2026): DONE koos SOL-RAGSVC-08-ga.** Asendus ei kustuta enam vana indeksit
enne kirjutamist. Uue versiooni kõik füüsilised chunk-ID-d ja metadata saavad juhusliku
`document_version` tunnuse, upsert toimub vana kõrval, seejärel loetakse uus ID-komplekt
stabiilse paginguga tagasi ja nõutakse täpset võrdsust. Alles `registry.activeVersion` commit
teeb versiooni dense- ja leksikaalotsingule nähtavaks; otsing filtreerib stagingu ja cleanup'i
ootavad vanad read välja. Backup-get, osalise upsert'i, verifitseerimise ja registri commit'i
veasüst jättis vana aktiivse versiooni puutumata ning eemaldas ainult staging-ID-d. Pärast
commit'i ebaõnnestunud vana cleanup jääb nähtava `cleanupState=PENDING` olekuna, kuid ei sega
aktiivset otsingut. Dokumendiversiooni testid **10/10**, kogu RAG slice **31/31**; runtime:
not_run (päris Chroma protsessi ei käivitatud).

### SOL-RAGSVC-08 — toorfail, Chroma vektorid ja JSON-register commit'ivad eri aegadel — P1

**Tõend.** Faili ingest kirjutab toorfaili enne teksti eraldamist ja vektoriasendust (`rag-service/main.py:3403-3451`), seejärel kirjutab registri alles pärast Chroma edu (`:3460-3507`). Olemasoleva dokumendi vea korral uut/ülekirjutatud toorfaili ei taastata (`:3438-3458`); registrivea korral jäävad uus fail ja vektorid registrita. URL-ingest kordab sama järjekorda (`:3878-3926`, `:3951`). Ühegi dokumendi operatsioonil pole per-doc lukku.

**Mõju.** Ebaõnnestunud või konkureeriv ingest võib jätta registri, allikafaili ja otsingusisu kirjeldama kolme eri versiooni. Reindex võib hiljem indekseerida faili, mida kasutaja algse vea järel edukaks ei pidanud, või adminiloend ei näe otsingus endiselt leitavat sisu.

**Vastuvõtukriteerium.** Kasutada tuleb dokumendiversiooni olekumasinat (`STAGING` → kontrollitud `ACTIVE`), ajutisi faile ja atomaarset aktiivversiooni vahetust; kõik vead puhastavad staging-versiooni ning vana aktiivne versioon jääb puutumata. Testida iga sammu viga ja kahte sama docId samaaegset ingest'i.

**Seis (12.08.2026): DONE koos SOL-RAGSVC-07-ga.** FILE, TEXT ja URL allikad kirjutatakse
`docs/<hash>/versions/<version>/` alla; sama docId kogu stage→verify→activate rada on
protsessideülese dokumendiluku sees. Registrisse commit'ib korraga uue allikatee ja sama
`activeVersion`, vea korral kutsutakse vektorstagingu abort ning versioonifail eemaldatakse.
Vana allikas kustutatakse alles pärast aktiivviite vahetust; cleanup-tõrge saab
`fileCleanupState=PENDING`. Reindex kasutab sama lepingut. Protsessi katkestuse järel registrita
staging jääb otsingule nähtamatuks ning on operatsioonijälje järgi lepitatav.

### SOL-RAGSVC-09 — delete tagastab edu ka siis, kui vektor või allikafail jäi alles — P1

**Tõend.** `delete_doc()` neelab Chroma delete'i kõik vead, eemaldab registrirea ning neelab seejärel iga failikustutuse ja kausta eemaldamise vea (`rag-service/main.py:4495-4514`). Vastus on alati `{"ok": true}` (`:4516`). Next.js `deleteRagDocument()` tõlgendab seda privaatsuseesmärgi õnnestumisena (`lib/documents/ragService.js:127-155`).

**Mõju.** Kasutaja dokumendi kustutus või retention-töö võib näida lõpetatud, kuigi tundlikud vektorid on üldotsingu või privaatotsingu kaudu endiselt leitavad või lähtefail seisab kettal. Registrirea eemaldamise järel puudub tavapärane retry-siht.

**Vastuvõtukriteerium.** Kustutus peab olema püsiva tombstone'i ja retry-olekuga; edu tohib tagastada alles pärast vektori ja faili puudumise järelkontrolli. Osalise vea korral peab register säilitama `DELETE_FAILED` oleku. Veasüstitestid peavad eraldi rikkuma Chroma, faili ja registri kustutuse.

**Seis (12.08.2026): DONE.** Delete kirjutab enne hävitamist registrisse
`DELETE_PENDING` tombstone'i sama docId lukus, kustutab kõik loogilise dokumendi vektorid,
loeb ID-d puudumise tõendamiseks tagasi ning eemaldab kogu tõendatud dokumendikausta.
Vektori-, kontroll- või failivea järel jääb püsiv `DELETE_FAILED` koos stabiilse veakoodiga ja
endpoint annab 503; eduks märgitakse alles `DELETED`, kus `path=null` ja otsingufilter välistab
dokumendi. Registririda jääb retry ja auditisihtmärgiks alles. Veasüstitest kattis Chroma tõrke
ning edukas test nii vektorite, allika kui tombstone'i järelkontrolli.

### SOL-RAGSVC-10 — metadata patch muudab registri enne Chroma edu ja jätab vea korral lahkneva tõe — P1

**Tõend.** `patch_document_metadata()` uuendab ja salvestab registri esmalt (`rag-service/main.py:4443-4471`), alles seejärel loeb ning uuendab kuni 100 000 Chroma metadatarida (`:4473-4484`). Chroma vea korral tagastatakse sõnaselgelt 500 tekstiga `Registry updated but chunk metadata update failed`, kuid registrimuudatust ei pöörata tagasi (`:4485-4486`).

**Mõju.** Admin näeb dokumendiloendis uut staatust/kehtivust, kuid otsing filtreerib vana chunk-metadata järgi. Eriti `source_status`, `historical`, `valid_to` ja `collection_id` korral võib haldusvaade kinnitada ühe tõe, samal ajal kui vastused kasutavad teist.

**Vastuvõtukriteerium.** Patch peab kasutama versioonilist staging+commit lepingut või vähemalt taastama registri Chroma vea korral ja jätma retry-oleku. Üle piiri jäävaid chunk'e ei tohi vaikida. Veasüstitest peab kontrollima registri, Chroma ja korduskatse kooskõla.

**Seis (12.08.2026): DONE.** Metadata patch kasutab sama OS-ülest docId lukku ja pagib kõik
chunk'id 1000 kaupa. Chroma saab uue metadata enne registrit ning loetakse võtme kaupa tagasi;
osalise update'i või verifitseerimisvea järel taastatakse kõigi chunk'ide vana metadata.
Registri commit'i vea järel toimub sama rollback. Kui rollback ise ebaõnnestub, jääb registrisse
`metadataState=REPAIR_REQUIRED`; tavapärane kordus kasutab sama koherentset rada. Toorest
erinditeksti API enam ei tagasta. Veasüstitest tõendas osalise Chroma update'i rollback'i ja
edukas test chunkide/registri sama väärtust.

### SOL-RAGSVC-11 — failide ja tekstide suurusepiirid rakenduvad pärast kogu keha mällu laadimist või puuduvad — P1

**Tõend.** `/analyze`, `/upload` ja PDF+metadata rajad teevad `await file.read()` enne `MAX_MB` kontrolli (`rag-service/main.py:3329-3340`, `:3670-3701`, `:3751-3768`). JSON `/ingest/file` dekodeerib kogu base64 väärtuse enne ühise worker'i suurusekontrolli (`:3532-3541`). `/ingest/text`-il ning otsingupäringul pole keha, teksti, chunk'i ega query pikkusepiiri (`:1594-1606`, `:1722-1731`, `:3576-3615`).

**Mõju.** Võtme või adminisessiooniga ründaja saab saata lubatust palju suurema multipart/JSON keha, tekitada samaaegsete päringutega protsessi mälutühjenemise ja `/ingest/text` kaudu piiramatu embeddingu- ning Chroma-kulu. 20 MB konfiguratsioon ei ole tegelik vastuvõtupiir.

**Vastuvõtukriteerium.** Reverse-proxy ja ASGI tasemel peab olema keha kõva piir; failid tuleb voogedastada ajutisse faili koos loenduri ja varase 413-ga. Teksti, query, chunk'ide arvu ja üksiku chunk'i jaoks peavad olema põhjendatud piirid ning kululimiit. Testida chunked transfer'it, valet/puuduvat Content-Length'i ja paralleelseid suuri päringuid.

**Seis (12.08.2026): DONE.** Nexti RAG-proksi loendab nüüd tegelikke `ReadableStream` baite
ning FastAPI ees olev ASGI middleware loendab sõltumatult iga `http.request` chunk'i; deklareeritud
liigmaht katkeb enne body lugemist ja päise puudumine, vale väiksem väärtus või chunked transfer ei
möödu piirist. Multipart-fail loetakse 64 KiB osadena kettal olevasse unikaalsesse ajutisse faili,
loendur annab varase 413 ning alles piiratud fail teisendatakse parseri sisendiks. JSON/base64,
teksti, koguchunkide mahu, chunkide arvu, üksiku chunki ja otsingupäringu piirid on serveri
lepingus. Negatiivkontrollid katsid puuduva/vale `Content-Length`-i ja kaheksa paralleelset
liigmahus voogu nii proksi kui ASGI kihis.

### SOL-RAGSVC-12 — deklareeritud MIME ja piiramatud dokumendiparserid võimaldavad CPU/mälu ammendamist — P1

**Tõend.** `_detect_mime()` usaldab deklareeritud MIME-i enne maagilise sisu kontrolli (`rag-service/main.py:804-812`). DOCX töödeldakse `docx2txt.process()`-iga ilma ZIP-i entry-arvu, paisutatud mahu, compression-ratio või ajapiirita; PDF-i kõik lehed parsitakse ja ekstraheeritakse samas päringuprotsessis piiranguta (`:988-1010`). Faili kokkusurutud maht võib jääda `MAX_MB` alla, samal ajal kui paisutatud/parsimistöö on kordades suurem.

**Mõju.** Autenditud üleslaadija saab esitada valesti märgistatud või zip-bomb DOCX/PDF-i ja blokeerida või tappa RAG-protsessi. Sama protsess teenindab vestluste otsingut, seega ingest-DoS katkestab ka tavakasutajate teadmistepõhised vastused.

**Vastuvõtukriteerium.** MIME tuleb tõendada signatuuri ja konteineri struktuuriga; ZIP-il piirata entry-arvu, kogupaisutust ja suhet, PDF-il lehti/objekte ning parser käivitada ressursipiiriga eraldi worker'is. Pahatahtliku konteineri test peab lõppema kontrollitud 4xx-ga, mitte protsessi mälu/CPU ammendumisega.

**Seis (12.08.2026): DONE.** Signatuuri ja konteineri kontroll rakendub nüüd ka püsiva ingest'i
ühises worker'is enne ühegi versioonifaili või vektori muutmist. DOCX-i kirjete arv, kogupaisutus
ja compression-ratio kontrollitakse enne lahtipakkimist. PDF-i lehtede ning xref-objektide arvul
on eraldi lagi. PDF, DOCX ja HTML parser töötavad eraldi spawn-protsessis, millele Linuxis seatakse
aadressiruumi ja CPU piir ning mille parent tapab tähtaja ületamisel. MIME-valet ja ZIP-pommi
testiti nii, et parserit ei kutsutud ning tulemus oli kontrollitud 415/413; eraldi kontroll tõendas
PDF-i mõlemad struktuurilimiidid ja timeout'i järel lapse lõpetamise. Päris pahatahtliku PDF-parseri
runtime: not_run.

### SOL-RAGSVC-13 — URL-ingest'i SSRF-kaitses on DNS-rebindingu ajavahemik — P1

**Tõend.** `_assert_safe_fetch_url()` lahendab hosti `socket.getaddrinfo()` abil ja keelab mitteavalikud aadressid (`rag-service/main.py:908-946`). Seejärel teeb `requests.Session.get()` uue sõltumatu DNS-lahenduse (`:948-960`); kontrollitud IP-d ei pin'ita ühendusele. Iga redirect kontrollitakse uuesti, kuid sama check-then-connect vahe jääb igal sammul.

**Mõju.** DNS-kirje saab kontrolli ajal vastata avaliku IP-ga ja ühenduse ajal loopbacki, metadata-teenuse või sisevõrgu IP-ga. Vastuse sisu salvestatakse ja indekseeritakse; isegi kui see hiljem otsingusse ei jõua, saab SSRF põhjustada sisepäringuid ja kulutada ressursse.

**Vastuvõtukriteerium.** Ühendus peab kasutama kontrollitud IP-d, säilitades Host/SNI õigesti, ning pärast connect'i kontrollima tegelikku peer-aadressi; redirectidel kordub sama. Keelata tuleb proxy-env'i ootamatu mõju. DNS-rebindingu test peab andma eri aadressi check/connect faasis ja tõendama, et privaatühendust ei tehta.

**Seis (12.08.2026): DONE.** URL-fetch lahendab hosti ühe korra, lükkab tagasi kogu
aadressikomplekti, kui selles on mitteavalik aadress, ning loob otsese urllib3 connection pool'i
kontrollitud IP-le. HTTPS säilitab algse hosti nii `Host` päises, SNI-s kui sertifikaadi
hostname-kontrollis; pärast ühendust peab socket'i peer-aadress võrduma pin'itud avaliku IP-ga.
Keskkonna proxy-seadeid see rada ei kasuta. Iga redirect läbib uue resolve→pin→connect→peer
kontrolli. Rebindingu negatiivtest andis lahendamisel avaliku ja võimalikul teisel DNS-kutsel
loopback-aadressi: teist DNS-kutset ei tehtud ning ühendus sihtis ainult esimest kontrollitud IP-d;
eraldi peer-mismatch test lükkas loopback-ühenduse tagasi.

### SOL-RAGSVC-14 — Chroma päringuviga muutub HTTP 200 tühjaks tõendiks — P1

**Tõend.** `_execute_search()` püüab `collection.query()` vea kinni ning tagastab tavavastuse `results: []` ja tekstilise `error` välja HTTP staatust muutmata (`rag-service/main.py:4687-4726`). Vestluse klient kontrollib ainult `res.ok`, märgib 200 vastuse observability outcome'iks `ok` ja kasutab tühja tulemust; `data.error`-it ei kontrollita (`lib/chat/retrievalOrchestrator.js:711-737`). Privaatdokumendi klient teeb samuti ainult `payload.results` massiivi (`lib/documents/search.js:15-48`).

**Mõju.** Katkine vektorandmebaas või vigane filter on rakenduse jaoks eristamatu olukorrast „asjakohast tõendit pole”. AI võib anda vähem põhjendatud vastuse, kasutaja ei näe degradeerumist ning mõõdik märgib vea edukaks otsinguks.

**Vastuvõtukriteerium.** Infrastruktuuri-/päringuviga peab andma mitte-2xx staatuse ja struktureeritud veakoodi; kui osaline leksikaalne fallback on lubatud, peab vastus kandma `partial/degraded` olekut, mida klient kohustuslikult kuvab ja mõõdab. Testida Chroma exception'i nii vestluse kui agentdokumendi tervikahelas.

**Seis (12.08.2026): DONE.** Dense Chroma exception annab nüüd HTTP 503 ja stabiilse
`RAG_RETRIEVAL_UNAVAILABLE` koodi koos request ID ning sisuta timingutega; toorest erindit vastuses
ei ole. Vestluse klient viskab mitte-2xx vastuse erindina edasi, mitte ei teisenda seda tühjaks
tõendiks. Agentdokumendi rada kasutas juba ühist `ragServiceRequest()` mitte-2xx erindilepingut.
Negatiivtest kattis teenuse exception→503 ning vestluse 503→erind tervikahela.

### SOL-RAGSVC-15 — hübriidotsing tagastab rohkem tulemusi kui `top_k` lubab — P1

**Tõend.** Dense-päring küsib kuni `top_k` tulemust (`rag-service/main.py:4692-4697`). Leksikaalrada lisab eraldi kuni `min(top_k, RAG_LEXICAL_TOP_K)` kandidaati (`:4840-4891`, `_fetch_lexical_candidates():3255-3303`). Pärast ühendamist arvutatakse uus järjestus, kuid `flat` massiivi ei lõigata enam `top_k` pikkuseks (`:4892-4912`, `:5053-5059`).

**Mõju.** `top_k=5` võib anda kuni kümme chunk'i ja `top_k=20` kuni nelikümmend. See rikub API lepingut, suurendab LLM-i konteksti ja kulu ning võib lükata päriselt parima tõendi downstream-kärpe taha.

**Vastuvõtukriteerium.** Pärast kõigi kanalite merge'i ja lõplikku rankimist tuleb tulemused deterministlikult `top_k` piirini lõigata; channel_stats peab eristama kandidaate ja tagastatud tulemusi. Testida kattuvaid ning täiesti eri dense/leksikaal kandidaate piiridel 1, 5, 20 ja 50.

**Seis (12.08.2026): DONE.** Dense- ja leksikaalkandidaadid ühendatakse enne hübriidskoori;
alles pärast `_apply_hybrid_ranking()`-ut lõigatakse `flat` normaliseeritud `top_k` pikkuseks.
Sama lõigatud hulk juhib vastuse tulemiarvu, channel-statistikat ja gruppe. Test tõendas, et kolm
kandidaati ning `top_k=2` annavad nii vastuses kui statistikas täpselt kaks lõplikult järjestatud
tulemust; serveri skeem piirab sama väärtuse vahemikku 1…50.

### SOL-RAGSVC-16 — leksikaalotsing skannib vaikides ainult suvalist esimest 2000 chunk'i — P1

**Tõend.** `_fetch_lexical_candidates()` teeb ühe `collection.get(... limit=RAG_LEXICAL_SCAN_LIMIT)` päringu, mille vaikeväärtus on 2000 ja millel puudub offset, paging või stabiilse valimi strateegia (`rag-service/main.py:94-102`, `:3255-3276`). Seejärel arvutab BM25-laadse skoori ainult saadud ridadel ja vastus ei kanna kärpeinfot.

**Mõju.** Üle 2000 chunk'iga teadmistebaasis sõltub pealkirja-, täppisfraasi- ja BM25 leidmine Chroma tagastusjärjekorrast. Uuem või sisuliselt parim allikas võib jääda alati valimist välja, kuid vastus ja observability väidavad täisväärtuslikku hübriidotsingut.

**Vastuvõtukriteerium.** Leksikaalindeks peab olema päris indekseeritud otsing või läbima kogu filtreeritud korpuse stabiilse paginguga väljaspool kasutajapäringu kuuma rada. Kui kaitsepiir rakendub, peab vastus olema `partial` koos skannitud/koguarvuga. Testida, et 2001. ja hilisem ainus täppisvaste leitakse või kärbe on nähtav.

**Seis (12.08.2026): DONE.** Leksikaalrada pagib Chroma tulemeid offset'iga kuni korpuse
lõpuni või eraldi `RAG_LEXICAL_MAX_SCAN` turvalaeni. Vastus kannab
`lexical_scan.scanned/complete/error`; turvalaeni või vea korral on `partial=true` ning vea korral
lisaks `degraded=true`, seega kärbe ei ole vaikne. Test paigutas read üle esimese 2-realise akna,
tõendas offsetid 0/2/4, viie rea skanni ja täielikkuse.

### SOL-RAGSVC-17 — artiklite ingest ei ole asendav, idempotentne ega ühe tervikuna atomaarne — P1

**Tõend.** `/ingest/articles` töötleb artikleid tsüklis ning igaüks kutsub `_ingest_text()`-i (`rag-service/main.py:4024-4086`). `_ingest_text()` teeb ainult `collection.upsert()` ega kustuta eelmise artikliversiooni chunk'e (`:2374-2395`). Chunk'i Chroma ID on `doc_id:index:8-kohaline tekstiräsi`, mis ei sisalda articleId-d (`:1978-1986`): muutunud tekst loob vana kõrvale uue rea, sama tekst ja indeks teises artiklis kirjutab esimese metadata üle. Hilisema artikli vea korral jäävad varasemad upsert'id alles ning register puudutatakse alles tsükli lõpus (`:4088-4092`).

**Mõju.** Artikli parandamine jätab vanad lõigud otsingusse, kaks sarnast artiklit võivad teineteise allikaviite üle kirjutada ja osaliselt ebaõnnestunud batch jätab vastuseks vea, kuid muutunud indeksi. Õiguslik või metoodiline vana väide võib pärast näilist uuesti ingestimist edasi vastustesse tulla.

**Vastuvõtukriteerium.** Batch tuleb ehitada staging-versioonina; chunk-ID peab sisaldama stabiilset artikliidentiteeti ning sama artikli uus versioon asendama täpselt vana kogumi. Kõik artiklid aktiveeritakse atomaarse manifestiga või vastus kirjeldab taastatavat osalist olekut. Testida muutunud sisu, sama sisuga eri articleId-sid ja viga teise artikli ajal.

**Seis (12.08.2026): DONE.** Kogu artiklipakk ehitatakse nüüd mälus valmis enne esimest
Chroma kirjutust, igal artiklil on eksplitsiitne või pealkirjast/lehekülgedest tuletatud stabiilne
identiteet ning loogiline ID sisaldab `docId + articleId + chunk index + text hash`. Seejärel läheb
kogu pakk ühe dokumendiversioonina olemasolevasse stage→verify→registry.activeVersion→old cleanup
lepingusse ja registriga commit'ib sama `articleManifest`. Teise artikli veasüst tõendas, et
upsert'i ei toimunud; sama tekst eri articleId-ga andis eri ID-d. Uus sama artikli sisu saab uue
versiooni ning vana kogum eemaldatakse alles atomaarse aktiveerimise järel.

### SOL-RAGSVC-18 — kliendi antud chunk-ID võib üle kirjutada teise dokumendi globaalse Chroma rea — P1

**Tõend.** Eksplitsiitsete `/ingest/text` chunk'ide korral valitakse Chroma ID otse chunk metadata `canonical_chunk_id`, `chunk_id` või `chunkId` väljast (`rag-service/main.py:2253-2273`). Kontroll väldib duplikaati ainult sama request'i `ids` loendis; puudub nõue, et ID algaks praeguse `doc_id`-ga või et see ei kuuluks teisele dokumendile. Chroma `upsert(ids=...)` käsitleb ID-d kollektsioonis globaalsena (`:2294-2308`, `:2351-2358`).

**Mõju.** Vigane ingest või teenusevõtme/admini kuritarvitus saab teadaoleva chunk-ID-ga teise dokumendi teksti ja metadata üle kirjutada. Ohvri registririda jääb alles, kuid tema chunk kaob või omandab ründaja doc_id, rikkudes allikate terviklust.

**Vastuvõtukriteerium.** Füüsilise vektori-ID peab tuletama server `doc_id + article/chunk identity` väärtustest ja kliendi ID säilitama eraldi metadata väljana. Upsert peab kontrollima olemasoleva ID omanikku ja võõra konflikti korral 409 andma. Negatiivtest peab proovima sama ID-d kahe docId-ga.

**Seis (12.08.2026): DONE.** Eksplitsiitse chunki füüsilise alus-ID tuletab server nüüd
`docId + chunk key + request index + text hash` väärtustest; dokumendiversiooni kiht lisab sellele
serveri version ID. Kliendi `canonical_chunk_id/chunk_id/chunkId` säilib ainult
`client_chunk_id` metadatas ega saa enam valida globaalset Chroma võtit. Sama kliendi ID kahe
docId-ga andis testis erinevad serveri ID-d ja säilitas mõlema metadata päritolusildi; sama batch'i
duplikaatse articleId korral annab server enne stage'i 409 `DUPLICATE_ARTICLE_ID`.

### SOL-RAGSVC-19 — märgipõhine chunker jätab lausepiiril teksti vahele — P1

**Tõend.** `_split_chunks_chars()` valib akna teises pooles viimase lauselõpu ja lisab chunk'i ainult selle kohani, kuid järgmise akna algust suurendab alati fikseeritud `max_chars-overlap` võrra, mitte tegeliku lõikekoha järgi (`rag-service/main.py:1040-1060`). Näiteks 1200/200 konfiguratsioonis ja lõikekohaga positsioonil 700 algab järgmine aken positsioonilt 1000; positsioonid 701–999 ei jõua ühtegi chunk'i. See rada aktiveerub `RAG_CHUNK_MODE=chars` või tiktokeni puudumisel (`:1062-1094`).

**Mõju.** Terved lauseosad võivad indeksist vaikselt kaduda ning hilisem otsing ei saa neid leida. Tervisekontroll ega ingest-vastus ei mõõda lähte- ja chunk-teksti katvust.

**Vastuvõtukriteerium.** Järgmine start peab lähtuma tegelikust lõikekohast miinus overlap või kasutama tõendatud splitterit; test peab rekonstrueerima lähte katvuse mitme lausepiiri ja väga pika lauseta teksti korral ning keelama positiivse pikkusega vahed.

**Seis (12.08.2026): DONE.** Märgipõhise chunkeri järgmine algus arvutatakse nüüd tegelikust
lausekatkestusest miinus overlap; nominaalse akna samm ei saa vahepealset teksti vahele jätta.
Test tõendas varem kadunud unikaalse keskmise lõigu olemasolu, järjestikuste chunkide nullvahe ning
ilma ühegi lausepiirita pika teksti täpse rekonstrueerimise overlap'i eemaldamisel.

### SOL-RAGSVC-20 — lühikese mitmeleheküljelise PDF-i üks chunk omistatakse ainult esimesele lehele — P1

**Tõend.** Kui PDF-i kogu puhastatud tekst mahub single-chunk piiridesse, ühendab `_build_ingest_payload()` kõik lehed üheks tekstiks, kuid `page_nums` väärtuseks pannakse ainult esimene lehekülg (`rag-service/main.py:1928-1944`). Chunk'i `page` metadata ja hilisem grupi leheküljeviide kasutavad seda ühte väärtust (`:2040-2048`, `:4962-5003`).

**Mõju.** Teiselt või hilisemalt lehelt pärinev väide kuvatakse esimese lehe tõendina. Sotsiaal- ja õigusmaterjali allikaviide näeb täpne välja, kuid juhatab valele lehele, mis raskendab inimkontrolli ja võib anda vale auditijälje.

**Vastuvõtukriteerium.** Mitme lehe teksti ei tohi ühe lehe numbriga kokku sulatada; ühe chunk'i korral peab metadata kandma tegelikku lehevahemikku/listi või chunk tuleb lehepiiril jagada. Testida lühikest 2–3-leheküljelist PDF-i, kus vastesõna on ainult viimasel lehel.

**Seis (12.08.2026): DONE.** Single-chunk PDF kogub nüüd kõigi sisendlehtede unikaalse loendi
ning kirjutab chunk'i metadatasse nii `pages` kui kokkusurutud `pageRange`; esimese lehe `page`
jääb tagasiühilduvaks ankruväljaks, kuid ei väida enam ainsat lehte. Kolmeleheküljelise lühifaili
test kinnitas `pages=1,2,3`, `pageRange=1–3` ja ainult viimasel lehel olnud märksõna samas chunk'is.

### SOL-RAGSVC-21 — tekstita uus versioon kustutab vana indeksi ja märgitakse siiski lõpetatuks — P1

**Tõend.** `_replace_document_vectors_payload()` kustutab vana dokumendi vektorid ka siis, kui uue payload'i `count` on 0, ning jätab upsert'i tegemata (`rag-service/main.py:2338-2358`). `_process_ingest_file()` registreerib pärast seda dokumendi tavapärase FILE-kirjena ja tagastab `ok:true, inserted:0` (`:3438-3507`, `:3521-3527`). `documents()` ja `get_document()` annavad registrikirjele staatuse `COMPLETED` ka null chunk'iga (`:4103-4152`, `:4154-4177`). Skannitud pildipõhine PDF või tühi/valesti dekodeeritud tekst võib selle raja käivitada.

**Mõju.** Olemasoleva otsitava dokumendi asendamine OCR-ita PDF-i või tekstita failiga kustutab töötava indeksi, kuid API/adminivaade ei näita läbikukkumist. Teadmistebaas kaotab allika vaikides.

**Vastuvõtukriteerium.** Null loetava chunk'iga ingest peab enne aktiivversiooni muutmist 422/`EXTRACTION_EMPTY` andma ja vana versiooni säilitama. Kui tekstita dokument on teadlikult lubatud, peab staatus olema eraldi `NO_TEXT`, mitte `COMPLETED`. Testida uut ja olemasolevat docId-d skannitud/tühja failiga.

**Seis (12.08.2026): DONE.** Ühine vektorasenduse piir annab null-chunk payload'ile enne
`stage_document_version()` kutset 422 `EXTRACTION_EMPTY`. Seega ei loeta vana ID-komplekti, ei
kirjutata Chroma ridu ega muudeta registri aktiivversiooni; faili-ingest puhastab juba loodud
versiooniallika oma olemasolevas exception-harus. Negatiivtest tõendas, et stage'i ei kutsutud.

### SOL-RAGSVC-22 — liiga pikk eksplitsiitne chunk talletatakse muu tekstiga kui selle embedding — P2

**Tõend.** Eksplitsiitse chunk'i payload jätab kliendi kogu puhastatud teksti `documents` massiivi (`rag-service/main.py:2253-2274`). `_pack_embedding_subbatches()` kärbib embeddingu sisendi `RAG_EMBED_MAX_TOKENS_PER_INPUT` piirini, kuid tagastab ainult embeddingud ega asenda salvestatavat dokumenti (`:1137-1169`, `:2294-2308`). Tavachunker hoiab chunk'id piirist all, ent `/ingest/text` eksplitsiitset chunk'i ei jaga ega valideeri.

**Mõju.** Chroma tagastab täispika chunk'i, mille hilisem osa ei mõjutanud vektorit üldse. Seal oleva ainsa asjakohase väite dense-leidmine ebaõnnestub, kuigi admin näeb teksti indeksis; leksikaalrada võib anda teistsuguse tulemuse.

**Vastuvõtukriteerium.** Eksplitsiitse chunk'i suurus peab olema kõva piiriga või server peab salvestama täpselt sama kärbitud/jagatud teksti, mille embedding arvutati. Testida märksõna enne ja pärast tokenipiiri ning tõendada embedding-document üksühesust.

**Seis (12.08.2026): DONE.** `/ingest/text` piirab eksplitsiitse chunki juba Pydanticu
char-lävega; embeddingu pakendaja kontrollib lisaks tegelikku tokeniläve ja annab enne providerit
413 `EMBEDDING_INPUT_TOO_LARGE`, kui tekst vajaks kärpimist. Vaikne `_truncate_to_tokens()` ei saa
seega enam luua täisteksti ja osalise embeddingu paari. Test asetas märksõnad tokenipiiri mõlemale
poolele, tõendas 413 ning selle, et providerit ei kutsutud; lubatud PDF payload'i test kinnitas
embeddingu sisendi ja salvestatava `documents` massiivi üksühesuse.

### SOL-RAGSVC-23 — tervise- ja dokumendivaated maskeerivad Chroma vea terveks olekuks ning lekitavad siseteid — P2

**Tõend.** `/health` seab Chroma vea korral `vectors=-1`, kuid jätab `ok:true` ja `status:"ok"`; vastus on võtmeta ning sisaldab kollektsiooni nime, mudelit, MIME-loendit ja absoluutset `storage_dir` teed (`rag-service/main.py:3308-3326`). `documents()` ja `get_document()` neelavad Chroma vead, annavad chunkide arvuks 0 ning staatuseks `COMPLETED` (`:4119-4152`, `:4160-4177`). Loend spread'ib registri muud väljad, sh absoluutse `path`, vastusesse (`:4147-4150`).

**Mõju.** Monitooring ja administraator ei erista katkist vektorikihti tühjast/tervest dokumendist; samal ajal annab avalik health serveri paigutuse kohta tarbetut infot. Intsident võib jääda roheliseks, kuni kasutajad märkavad allikate puudumist.

**Vastuvõtukriteerium.** Health peab kontrollima registrit ja Chroma lugemist, tagastama degradeerumisel mitte-2xx või `ok:false`, ning avalik vastus ei tohi sisaldada absoluutteid ega sisekonfiguratsiooni. Dokumendi staatus peab olema `DEGRADED/UNKNOWN`, mitte `COMPLETED`. Testida Chroma count/get exception'e.

**Seis (12.08.2026): DONE.** `/health` annab nii registri- kui Chroma count-tõrkel 503,
`ok:false`, stabiilse veakoodi ja `Cache-Control:no-store`; edukast vastusest eemaldati embeddingu
mudel, kollektsiooni nimi, MIME-loend, chunkiseadistus ja absoluutne storage path. Dokumentide
loendi/detaili Chroma get-tõrge annab `status=DEGRADED`, `chunks=null` ja
`VECTOR_STORE_UNAVAILABLE`, mitte null chunk'i ning `COMPLETED`. Vastused ehitatakse nüüd
avalike väljade allowlistist; `path` ja `source_path` ei välju. Testid katsid count/get exception'i
ning absoluutse sisetee puudumise.

### SOL-RAGSVC-24 — tag-tokeni filter kirjutab kasutaja muu `$or` filtri üle — P2

**Tõend.** `_execute_search()` normaliseerib esmalt `payload.where.$or` ja salvestab selle `md_where["$or"]` alla (`rag-service/main.py:4551-4559`). Kui sama päring sisaldab `tag_tokens`/`tagTokens` filtrit, ehitatakse uus token-slot'ide OR ja omistatakse samale võtmele, kirjutades varasema tingimuse üle (`:4564-4576`).

**Mõju.** Kombineeritud geograafia-, allika- või staatusealternatiivid võivad päringust vaikides kaduda. Tulemused vastavad ainult tagile ja võivad tulla laiemast sisulisest skoobist, kui upstream eeldas mõlema filtri rakendumist.

**Vastuvõtukriteerium.** Iga OR-grupp peab saama eraldi klausli ühise `$and` all; normaliseerimine ei tohi samanimelist võtit üle kirjutada. Testida üld-OR + tag_tokens kombinatsiooni nii dense kui leksikaalrajal.

**Seis (12.08.2026): DONE.** Otsingufiltri kompilaator lisab iga OR-rühma eraldi
`{"$or": ...}` klauslina ühise `$and` alla; järgnev autorite või tagide rühm ei omista enam
olemasolevat `$or` võtit üle. Sama lõpuks komponeeritud `chroma_where` antakse nii
`collection.query()` dense-rajale kui pagitud `collection.get()` leksikaalrajale. Test ühendas
riigi üld-OR-i, autori ja tagi ning tõendas vähemalt kolme säilinud OR-rühma ja mõlema raja täpselt
sama filtripuu.

### SOL-RAGSVC-25 — `tags` ja `authors` filtreid võrreldakse formaadiga, milles neid ei salvestata — P2

**Tõend.** Chroma ei luba loendeid, mistõttu `_stringify_meta()` muudab listid komaga ühendatud üheks stringiks (`rag-service/main.py:496-518`); ingest salvestab nii `authors`, `tags` kui nende `_list` variandid selle kaudu (`:1984-2078`, `:2161-2251`). Otsing kopeerib kliendi `authors` ja `tags` filtri muutmata `md_where` sisse (`:4560-4563`) ning `$in` võrdleb tervet scalar-stringi, mitte üksikuid väärtusi (`:2572-2624`).

**Mõju.** Dokument tagidega `foo, bar` ei vasta filtrile `tags in [foo]`, kuigi haldusvaade ja allika metadata väidavad tagi olemasolu. Mõne tagi jaoks eraldi token-slotid aitavad ainult `tag_tokens` rajal; autoritel puudub seegi.

**Vastuvõtukriteerium.** Filtreeritavad korduvväljad peavad saama eraldi normaliseeritud slotid/indeksi või päris otsinguandmemudeli; API peab dokumenteerima ja rakendama sama semantikat. Testida ühe- ja mitmeväärtuselist autorit/tagi ning diakriitikuid.

**Seis (12.08.2026): DONE.** Ingest kirjutab autorid 12 eraldi `author_token_N` slotti ning
tagid olemasolevatesse 8 `tag_token_N` slotti; mõlemad normaliseeritakse väiketäheks ja
diakriitikata. Otsingu `authors`/`tags` scalar või `$in` sisend kompileeritakse samade slotiväljade
OR-rühmaks ega võrdle enam komadega ühendatud kuvateksti. Test kattis kaks autorit ja kaks tagi,
`Jüri Öö`→`juri oo`, `Mari Mägi`→`mari magi`, `Töövõime`→`toovoime` ning üheväärtuselise
filtri dense/leksikaal ühise puu.

### SOL-RAGSVC-26 — base64 ingest aktsepteerib tühja või vigase sisu ilma korrektse kliendiveata — P2

**Tõend.** `/ingest/file` kasutab `base64.b64decode(payload.data)` ilma `validate=True`-ta ja ei kontrolli tühja tulemust (`rag-service/main.py:3532-3541`). Erinevalt `/upload`-ist pole `Empty file` haru. Ühine worker võib kirjutada nullbaidise faili, eemaldada vana vektori ja registreerida `inserted:0`; osa vigaseid stringe neelatakse permissiivselt, teised dekodeerimisvead jõuavad üldise 500-ni.

**Mõju.** Kliendi transport-/kodeerimisviga võib muuta olemasoleva dokumendi tühjaks või saada serverivea, mitte taastatava 400. Vigane payload pole idempotentselt eristatav päriselt tühjast dokumendist.

**Vastuvõtukriteerium.** Nõuda ranget base64 valideerimist, mitte-tühja sisu ja enne aktiivversiooni muutmist MIME/signatuuri kontrolli; vead peavad olema 400/422 stabiilse koodiga. Testida tühja, vale padding'u, mitte-base64 märke ja nullbaite olemasoleva docId puhul.

**Seis (12.08.2026): DONE.** JSON faili-ingest kasutab nüüd `base64.b64decode(...,
validate=True)` ning teisendab padding'u või tähestiku vea 400 `BASE64_INVALID` vastuseks. Tühi ja
ainult nullbaitidest sisu annab 400 `FILE_EMPTY`; muu sisu läbib seejärel ühise MIME/signatuuri
kontrolli enne source stagingut. Olemasoleva docId-ga testid katsid tühja stringi, vale padding'ut,
mitte-base64 märke ja nullbaite ning tõendasid, et ingest-workerit ega aktiivversiooni ei puudutatud.

### SOL-RAGSVC-27 — üldine valideerimisvea handler annab kõigile endpointidele vale upload-lepingu — P2

**Tõend.** kogu FastAPI rakenduse `RequestValidationError` handler tagastab sõltumata marsruudist ühe detaili: `Upload endpoint expects JSON body with base64 encoded 'data'` (`rag-service/main.py:180-231`). See rakendub ka `/search`, `/ingest/text`, article-, metadata- ja agent-dokumendi endpointidele ning peidab Pydanticu välja asukoha kliendi eest.

**Mõju.** Vigane otsingufilter või puuduva `doc_ids`-iga privaatotsing näib failiüleslaadimise veana. Kliendid ei saa täpset sisendit parandada, observability koondab eri lepingurikkumised ühe eksitava põhjuse alla.

**Vastuvõtukriteerium.** Handler peab tagastama sisuvabu, kuid endpointi ja välja suhtes täpseid veakoode/asukohti; tundlikku keha ei logita. Negatiivtestid peavad katma vähemalt search, agent search, ingest/text, patch-meta ja upload vead.

**Seis (12.08.2026): DONE.** Üldine handler tagastab nüüd marsruudiklassi täpse koodi,
tegeliku route'i ning iga vea `location/field/code` kolmikud; vastuses ega logis ei ole keha,
keharäsi või upload-spetsiifilist eksitavat teksti. Negatiivtestid katsid `/search`, agent search,
`/ingest/text`, `/documents/{id}/patch-meta` ja `/upload` ning tõendasid vastavalt `query`,
`doc_ids`, `doc_id`, `metadata` ja `file` väljad.

### SOL-RAGSVC-28 — metadata patch ei võimalda vigast väärtust eemaldada — P2

**Tõend.** `PatchMetadata.metadata` lubab `null` väärtusi (`rag-service/main.py:1705-1707`), kuid `patch_document_metadata()` jätab iga `None` väärtuse lihtsalt vahele ja annab lõpuks `No patchable metadata values provided` (`:4450-4462`). Seega API kuju lubab välja tühjendamist näivat sisendit, kuid register ja chunk-metadata jäävad muutmata.

**Mõju.** Vale `valid_to`, URL, authority, collection_id või ajaloolisuse metadata ei ole sama odava patch-rajaga eemaldatav; administraator võib arvata, et `null` puhastas väärtuse, või peab tegema kuluka reingest'i.

**Vastuvõtukriteerium.** Leping peab eristama „puudub muudatus” ja „eemalda väli”; lubatud nullable väljade null peab eemaldama väärtuse nii registrist kui kõigist chunk'idest ühe koherentse commit'ina. Testida iga nullable välja set → clear tsüklit ja Chroma vea rollback'i.

**Seis (12.08.2026): DONE.** Patch eristab nüüd puuduvat võtit ja saadetud `null` väärtust:
null kogutakse `clear_fields` hulka, Chroma uued metadatad ehitatakse võtmeta, puudumine
verifitseeritakse ning register eemaldab samad võtmed alles pärast Chroma edu. Vea korral taastub
vana chunk-metadata ning register jääb vanaks. Set→clear test kattis kõik allowlisti nullable väljad,
sh `valid_from/valid_to`, URL-id, authority, collection, ajaloolisus, riik ja aasta; eraldi Chroma
veasüst tõendas vana väärtuse rollback'i.

### SOL-PRISMA-01 — MTR-i parandav migratsioon kaotab pärandpõhjuse ja võib kinnistada vale allikatulemuse — P1

**Tõend.** Esimene MTR-i skeem salvestas ühe `LicenceCheck.reason` välja ning üldise `result` väärtuse, mis võis olla `OK` ka siis, kui `entityResolved` oli false (`prisma/migrations/20260805170000_a4_mtr_licence_check/migration.sql:48-63`; varasema teenusekoodi commit `ef70cfb`: `lib/mtr/licenceCheckService.js:135-146`). Järgmine migratsioon ütleb kommentaaris, et tabelid on tühjad, kuid ei jõusta seda eeltingimust ühegi SQL-kontrolliga. Ta kopeerib vana üldise `result` väärtuse mõlemasse uude allikavälja, ei paranda `result = OK AND entityResolved = false` ridu, ei kopeeri vana `reason` väärtust ei `licenceReason` ega `entityReason` väljale ning kustutab seejärel vana veeru (`prisma/migrations/20260805190000_a4_licence_assessment_evidence/migration.sql:1-3`, `:25-40`). Git-ajaloos eksisteeris vana skeemi ja teenusekoodi commit enne parandavat migratsiooni; repo ei tõenda, et seda ei saanud vahepeal üheski keskkonnas rakendada.

**Mõju.** Kui esimeses skeemiversioonis tekkis kasvõi üks kontrollirida, võib upgrade kustutada tõrke tegeliku põhjuse ja muuta identiteediallika näiliselt edukaks. Hilisem audit, alarm või kliendivaade saab ajaloolisest kontrollist semantiliselt vale tõendi.

**Vastuvõtukriteerium.** Migratsioon peab enne destruktiivset sammu kas SQL-is tõendama tabeli tühjust ja ootamatute ridade korral katkema või tegema tähendust säilitava backfill'i: tuletama üldise/allikatulemuse `entityResolved` ja teadaolevate väljade järgi ning kandma vana põhjuse dokumenteeritud sihtvälja. Upgrade-test peab alustama vana skeemi seemnetega, mis sisaldavad nii õnnestunud, ebaõnnestunud kui `result=OK/entityResolved=false` rida.

**Seis (13.08.2026): DONE.** Ajalooline migratsioon ei eelda enam tühja tabelit: ta tuletab
üld- ja allikatulemuse `entityResolved` järgi, kannab vana põhjuse enne veeru kustutamist
dokumenteeritud allikaväljale ning nullib vale üldise kinnitusaja. Juba vana migratsiooni
rakendanud andmebaasidele parandab uus forward-migratsioon deterministlikult vale
`OK/entityResolved=false` seisu, kuid ei mõtle pöördumatult kadunud põhjust välja. Päris
PostgreSQL-i upgrade-sond alustab tegelikust migratsiooniahelast enne A4 parandust ja läbib
õnnestunud, allikatõrke ning identiteedivastuolu read; vana kuju negatiivkontroll on punane ja
`npm run db:migrate:upgrade:probe` on **14/14**.

### SOL-PRISMA-02 — kaks HelpMatchi välisvõtit jäid püsivalt valideerimata — P1

**Tõend.** `HelpMatch_requesterId_fkey` ja `HelpMatch_offererId_fkey` lisatakse `NOT VALID` kujul, et olemasolev triiv migratsiooni ei peataks (`prisma/migrations/20260423173000_strengthen_integrity_guards/migration.sql:18-33`). Üheski 135 migratsioonis ei ole nende jaoks `VALIDATE CONSTRAINT` sammu. Lõppskeem käsitleb mõlemat kohustusliku `User` seosena ja eeldab kasutaja kustutamisel kaskaadi (`prisma/schema.prisma:3263-3285`).

**Mõju.** Uued kirjutused on kaitstud, kuid enne piirangu lisamist tekkinud orvud võivad jääda lõppandmebaasi määramata ajaks. Selline HelpMatch võib rikkuda kohustusliku Prisma relation'i lugemise, jääda kasutaja kustutamisel alles ning kanda osapoolte/ruumi andmeid ilma enam eksisteeriva omanikuta.

**Vastuvõtukriteerium.** Eelmigratsioon peab raporteerima ja teadliku poliitika järgi parandama või karantiini viima kõik orvud; seejärel tuleb mõlemad piirangud `VALIDATE CONSTRAINT` abil jõustada. Upgrade-test peab sisaldama tervet ja orvustatud pärandrida ning kontrollima nii parandust kui lõpp-piirangute valideeritud olekut `pg_constraint.convalidated` kaudu.

**Seis (13.08.2026): DONE.** `HelpMatch` osapoolte ID-d on sama rea `HelpRequest.userId` ja
`HelpOffer.userId` denormaliseeritud koopiad; need vanemseosed on juba FK-ga kaitstud ja on
seetõttu paranduse deterministlik allikas. Migratsioon parandab mõlemad koopiad, katkeb, kui
ükski orb siiski alles jääb, ning valideerib mõlemad piirangud. Upgrade-sond külvab mõlema
osapoole triivi, säilitab matši ja tõendab lõpuks mõlemal FK-l
`pg_constraint.convalidated=true` (`db:migrate:upgrade:probe` **14/14**).

### SOL-PRISMA-03 — tootmisdeploy muudab skeemi enne vana rakenduse peatamist ja enne uue build'i õnnestumist — P1

**Tõend.** Serveri deploy tõmbab uue koodi, teeb `npm ci` ning käivitab `prisma migrate deploy`, samal ajal kui olemasolev frontend võib endiselt aktiivne olla (`scripts/deploy-server.mjs:102-139`). Frontend peatatakse alles seejärel build'i ajaks (`:141-152`). Build'i vea korral käivitatakse „previous frontend state” uuesti, kuid rakendatud migratsioonidele puudub rollback (`:154-164`). Migratsiooniahel sisaldab vähemalt veeru kustutamist ja tüübimuutust (`prisma/migrations/20260805190000_a4_licence_assessment_evidence/migration.sql:40-47`), samal ajal kui käesoleva auditi dokumenteeritud Webpack-build juba ebaõnnestub (SOL-BUILD-01).

**Mõju.** Migratsiooni ajal saab vana protsess töötada skeemi vastu, mida tema Prisma klient ei tunne. Kui uus build või hilisem restart ebaõnnestub, jääb andmebaas uude versiooni, kuid teenus proovib taastada vana rakenduse; destruktiivse migratsiooni korral võib tulemuseks olla püsiv 500-voog või käsitsi taastamist nõudev katkestus.

**Vastuvõtukriteerium.** Deploy peab kasutama expand/contract-ühilduvaid migratsioone või selget hooldus-/versiooniväravat: uus artefakt ehitatakse ja valideeritakse enne destruktiivset skeemimuutust, vana ning uue rakenduse ühisosa on tõendatud ja contract-samm toimub alles pärast vana versiooni eemaldamist. Veasüstiga staging-test peab katkestama build'i pärast migratsiooni ning tõendama, et vana versioon töötab või automaatne taastamisplaan taastab ka skeemi ohutult.

**Seis (13.08.2026): DONE.** Deploy siseneb nüüd selgesse hooldusväravasse ja ehitab uue
artefakti enne ühtki migratsiooni; seega varasem „migratsioon õnnestus, järgnev build kukkus”
järjestus ei ole enam võimalik. Vana `.next` artefakt varundatakse ning build'i või preflight'i
vea korral taastatakse ainult siis, kui Prisma migratsiooniseis on mõõdetult muutumata; osalise
migratsiooni järel ei käivitata valelikult vana artefakti. `--skip-build` on pending-migratsiooni
korral fail-closed. Hermetiline bash-veasüst jooksutab päris genereeritud deploy-skripti:
build rikub kandidaadi ja väljub koodiga 42, migratsioonikutseid on 0, vana marker taastub ning
frontend käivitatakse uuesti. Production deploy: **not_run** — push/deploy vajab eraldi omaniku
luba ega ole leiu mehhanismi tõendamiseks vajalik.

### SOL-PRISMA-04 — migratsioonivärav tõendab tühja skeemi, kuid mitte pärandandmeid ega tootmislukke — P2

**Tõend.** CI loob tühja PostgreSQL 16 andmebaasi ja rakendab sinna kogu ahela (`.github/workflows/quality-gate.yml:16-31`, `:65-69`); eraldi kohalik kontroll teeb samuti uue ajutise tühja andmebaasi (`scripts/check-clean-migrations.mjs:21-54`). Seetõttu ei käivitu olemasolevate ridade duplikaadi-, backfill'i-, `NOT NULL`-, tüübimuutuse ega kustutusriskid. Ahelas on 663 tavalist `CREATE INDEX` lauset ja mitte ühtegi `CREATE INDEX CONCURRENTLY`; deploy käivitab need otse ilma lock-timeout'i või migratsiooniohu eelanalüüsita. Ka migratsiooni enda kommentaar nõuab vähemalt ühe indeksi puhul tootmisandmete auditit vahetult enne deploy'd, kuid deploy-skript seda kontrolli ei käivita (`prisma/migrations/20260713193000_room_origin_partial_unique/migration.sql:15-23`). Prisma ametlik tootmisdeploy juhis soovitab enne `migrate deploy` sammu analüüsida just raskeid lukke tekitavaid mustreid, sealhulgas `CREATE INDEX` ilma `CONCURRENTLY`-ta ja `ALTER COLUMN TYPE`: [Deploying database changes with Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate).

**Mõju.** Roheline quality gate tõendab, et nullandmetega SQL-ahel on rakendatav, kuid ei tõenda päris upgrade'i õigsust ega teenuse saadavust migratsiooni ajal. Olemasolevad duplikaadid võivad deploy peatada; tavaline indeks või tüübi muutus võib suurel tabelil kirjutused blokeerida. Konkreetne tootmisluku kestus on `NOT_PROVEN`, sest tabelimahte ja päris runtime'i selles auditis ei mõõdetud.

**Vastuvõtukriteerium.** CI/staging peab lisaks tühjale ahelale käivitama vähemalt eelmise väljalaske skeemi realistlike piir- ja pärandandmetega upgrade'i ning kontrollima semantilist tulemit. Pre-deploy peab tegema andme-eeltingimused, migratsiooniohu analüüsi, sobiva `lock_timeout`/`statement_timeout` poliitika ja suurte indeksite ohutu loomise; blokeeriva riski või teadmata mahu korral peab deploy fail-closed peatuma.

**Seis (13.08.2026): DONE.** Quality gate käivitab nüüd lisaks tühjale täisahelale päris
PostgreSQL-is eelmise A4 skeemiversiooni migratsiooniahela koos õnnestunud, tõrkunud,
semantiliselt vastuolulise ja FK-triiviga pärandandmestikuga. Deploy preflight loeb ainult
pending-migratsioone, klassifitseerib lukustavad/destruktiivsed laused, mõõdab sihttabelite
baidid ja read, kontrollib ootel lukke ning üle 60 sekundi tehinguid ja peatub teadmata või
üle 100 MiB / 100 000 rea mahu korral; suur lukustav indeks tuleb enne deploy'd ümber teha või
eraldi teadlikult lubada. Tegelik `migrate deploy` saab `lock_timeout=5s` ja
`statement_timeout=15min`. Kohalik preflight mõõtis ka kõik neli parajasti arendusbaasis
pending-migratsiooni, upgrade-sond on **14/14** ja puhta **183 migratsiooni** ahel on roheline.

### SOL-MENT-01 — aktiivse avaliku mentoriprofiili sisu saab pärast heakskiitu modereerimata ümber kirjutada — P1

**Tõend.** Profiili muutmise allowlist sisaldab `ACTIVE`, `PAUSED` ja isegi `PENDING_REVIEW` olekut (`lib/mentoring/profileService.js:20-26`). `upsertOwnMentorProfile()` kirjutab nime, organisatsiooni, valdkonnad, teemad ja kogu bio uueks, kuid jätab staatuse samaks ega nulli varasemat ülevaatuse tõendit (`:53-90`). UI näitab salvestusvormi ka ACTIVE-profiilile (`components/mentoring/MyMentorProfilePage.jsx:164-270`). Kataloog avaldab iga ACTIVE-profiili kohe (`lib/mentoring/catalogService.js:14-31`).

**Mõju.** Admini heakskiidetud neutraalne profiil võib pärast kontrolli muutuda eksitavaks, sobimatuks või teise isiku/asutuse identiteeti kasutavaks ning jääda kataloogis ACTIVE märgisega. `reviewedAt` ja `reviewedByUserId` näivad endiselt tõendavat sisu, mida admin tegelikult ei näinud.

**Vastuvõtukriteerium.** Modereeritava välja muutmine peab looma uue ülevaatusversiooni või viima profiili tagasi `PENDING_REVIEW` olekusse, jättes viimase heakskiidetud snapshoti avalikuks kuni uue otsuseni. Test peab heaks kiitma profiili, muutma iga avalikku välja ja tõendama, et uus sisu ei jõua enne teist heakskiitu kataloogi.

**Seis (13.08.2026): DONE — admini heakskiit külmutab avaliku snapshot'i; modereeritava välja muutus viib profiili `PENDING_REVIEW` olekusse, kuid kataloog ja taotlusrada kasutavad kuni uue otsuseni ainult eelmist kinnitatud versiooni. Test muudab korraga kõik avalikud väljad ja tõendab, et ükski uus väärtus ei leki; PostgreSQL-sond kinnitab sama päris ridadel. Vajab migratsiooni `20260814001000`.**

### SOL-MENT-02 — välise mentori nõusolek ei nõua tõendit ega aegu 12 kuu järel — P1

**Tõend.** Konstandis on `STALE_EXTERNAL_MONTHS: 12` (`lib/mentoring/constants.js:91-105`), kuid seda ei kasutata üheski mentorluse funktsioonis. Kataloog lubab iga `ESTA_IMPORT`/`userId:null` kirje pelgalt `consentStatus = CONSENTED` alusel, ilma `checkedAt` vanuse kontrollita (`lib/mentoring/catalogService.js:14-31`). Sweep ei töötle väliskirjeid üldse (`lib/mentoring/sweep.js:36-289`). Admin võib seada `CONSENTED` ilma `consentNote` või `refreshCheckedAt` nõudeta (`lib/mentoring/adminService.js:169-208`); olemasolev test teebki nõusoleku nähtavaks ainult status-väljaga (`tests/mentoring/lifecycle.test.js:363-379`).

**Mõju.** Aegunud või dokumenteerimata nõusolekuga inimese nimi, amet ja profiiliviide võivad jääda professionaalide kataloogi määramata ajaks. UI näitab küll vana `checkedAt` kuupäeva, kuid server ei käsitle seda juurdepääsu- ega avaldamisväravana.

**Vastuvõtukriteerium.** `CONSENTED` peab nõudma struktureeritud nõusolekutõendit ja kontrolliaega; kataloog peab stale-piiri lugemisel fail-closed jõustama sõltumata sweep'ist. Sweep märgib tähtaja ületanud kirjed idempotentselt `STALE`-iks ning teavitab haldurit. Testida 12 kuu piiri mõlemat poolt ja puuduva/tulevikulise/vigase `checkedAt` väärtust.

**Seis (13.08.2026): DONE — `CONSENTED` nõuab tüübitud tõendit ja viidet ning server kirjutab kontrolli- ja fikseerimisaja; kataloog kontrollib igal lugemisel tõendit, tulevikuaega ja 12 kuu piiri fail-closed. Sweep muudab aegunud rea ühe korra `STALE`-iks, kirjutab auditi ja püsiva adminiteavituse. Piiri mõlemad pooled ning puuduv, tulevikuline ja vigane tõend on testitud; PostgreSQL-sond kinnitab ülemineku ja teavituse. Vajab migratsiooni `20260814001000`.**

### SOL-MENT-03 — mentor saab jagatud ettevalmistuse sisu lugeda enne, kui avamine fikseeritakse — P1

**Tõend.** Suhte GET valib kõik jagatud ja tagasivõtmata ettevalmistused (`lib/mentoring/relationService.js:72-83`) ning serializer lisab mentorile kogu `sharedContent` väärtuse juba siis, kui `openedByOtherAt` on null (`lib/mentoring/serializers.js:254-270`). UI renderdab selle teksti kohe ja pakub alles seejärel eraldi „märgi avatuks” nuppu (`components/mentoring/MentoringRelationPage.jsx:533-605`). Avamisaeg tekib ainult selle POST-toimingu järel (`lib/mentoring/preparationService.js:239-263`); kuni nupuvajutuseni lubab server omanikul sisu tagasi võtta (`:192-217`).

**Mõju.** Mentor võib sisu päriselt näha või API-st kopeerida, kuid omanikule jääb seis „avamata” ja tagasivõtuõigus. Hilisem recall kustutab jagatud koopia ning audit väidab sisuliselt, et adressaat ei avanud seda, kuigi konfidentsiaalne sisu oli juba talle väljastatud.

**Vastuvõtukriteerium.** Sisu esimene väljastamine mentorile ja `openedByOtherAt` claim peavad olema üks atomaarne serveritoiming; tavaline suhte GET ei tohi enne claim'i sisu tagastada. Alternatiivina peab esimene GET ise tehinguliselt avamise fikseerima. Kahe paralleelse open/recall testis võib võita ainult üks ja vastus/audit peab vastama tegelikule väljastamisele.

**Seis (13.08.2026): DONE — tavaline suhte GET tagastab avamata ettevalmistuse metaandmed, kuid mitte `sharedContent` sisu; avamise POST fikseerib lukustatud tehingus `openedByOtherAt` enne sisu vastusesse panemist. Päris PostgreSQL-i paralleelses open/recall võistluses võidab täpselt üks rada ja lõppseis vastab võitjale.**

### SOL-MENT-04 — kinnitatud kokkuvõte märgitakse asendatuks enne paranduse kinnitamist ning parandusrada puudub UI-st — P1

**Tõend.** Funktsiooni kommentaar ütleb, et vana kokkuvõte märgitakse superseded alles uue kinnitamisel (`lib/mentoring/summaryService.js:228-232`), kuid `superseedMentoringSummary()` loob uue `DRAFT` rea ja kirjutab vana `supersededById` kohe samas loomistoimingus (`:233-265`). Kui uus mustand hiljem `DISCARDED` olekusse läheb, puudub vana lingi taastamise rada. Olemasolev test lukustab selle varase lingi oodatud käitumiseks (`tests/mentoring/lifecycle.test.js:225-246`). Suhteleht kuvab superseded märget, kuid ei saada kusagil `action:"supersede"` toimingut ega paku kinnitatud kokkuvõtte parandamise vormi (`components/mentoring/MentoringRelationPage.jsx:440-523`).

**Mõju.** Vana kinnitatud kandja näib asendatud juba kinnitamata või hiljem hüljatud tekstiga. Tavakasutaja ei saa lubatud parandusrada UI-st üldse käivitada; otse API-ga loodud hüljatud parandus võib jätta ajaloo püsivalt vale seosega.

**Vastuvõtukriteerium.** Parandusmustand peab kandma viidet originaalile, kuid originaali `supersededById` tohib atomaarse tehinguga seada alles asenduse teise kinnituse järel. Discard ei tohi vana kinnitatud seisu muuta. UI peab pakkuma kinnitatud kokkuvõtte „paranda uue versioonina” voogu koos mõlema kinnitusega; testida create → discard ja create → kaks kinnitust rajad.

**Seis (13.08.2026): DONE — paranduse mustand kannab `correctionOfId` algviidet ja kasutajaliides pakub kinnitatud kokkuvõttel uue versiooni vormi. Algne `supersededById` tekib alles paranduse teise kinnitusega samas lukustatud tehingus; discard ei muuda algset. Mõlemad jadad on kaetud ühiktesti ja päris PostgreSQL-sondiga. Vajab migratsiooni `20260814001000`.**

### SOL-MENT-05 — PLATFORM_ROOM kohtumine luuakse UI-st ilma ruumita ja server ei nõua teise poole liikmesust — P1

**Tõend.** Suhtelehe kohtumisvorm lubab valida `PLATFORM_ROOM`, kuid selle olekus ja väljade hulgas puudub `roomId`; POST saadab ainult aja, mode'i ja teema (`components/mentoring/MentoringRelationPage.jsx:39-42`, `:383-428`). Serveri `resolveRoomReference()` tagastab tühja ID korral `null`, mistõttu kirje luuakse `mode = PLATFORM_ROOM`, `roomId = null` kujul (`lib/mentoring/meetingService.js:28-39`, `:41-63`). Kui ID saadetakse otse API-ga, kontrollitakse ainult algataja liikmesust, mitte seda, et mentorlussuhte teine pool samas ruumis oleks (`:28-38`, `:48-53`). Serializer ja UI näitavad ruumilinki ainult mitte-null ID korral (`lib/mentoring/serializers.js:209-219`; `components/mentoring/MentoringRelationPage.jsx:340-349`).

**Mõju.** Kasutaja valib „platvormi ruum”, kuid saab vaikides välise kohtumise laadse kirje ilma avatava ruumita. Otsese API-ga saab suhte ajalukku siduda ruumi, kuhu teisel poolel pole ligipääsu, ning UI pakub talle mittetoimivat/keelatud linki.

**Vastuvõtukriteerium.** PLATFORM_ROOM peab nõudma mitte-null ruumi, mille aktiivsed liikmed on mõlemad suhte pooled; UI peab laadima ainult sellised ühised ruumid ja saatma valitud ID. EXTERNAL peab omakorda alati nullima roomId. Testida puuduvat ID-d, ainult algataja ruumi, mõlema poole ruumi ning lahkunud liikme juhtumit.

**Seis (13.08.2026): DONE — suhtevaade tagastab ainult mõlema poole ühised aktiivsed ruumid ning vorm nõuab PLATFORM_ROOM valikul üht neist. Server kontrollib lukustatud loomisel ja muutmisel ruumi olemasolu, arhiveerimata seisu ning mõlema suhtepoole aktiivset liikmesust; EXTERNAL nullib viite. Puuduv, ühepoolne, ühine ja lahkunud liikme juhtum on ühiktestis ja päris PostgreSQL-sondis kaetud.**

### SOL-MENT-06 — `datetime-local` kohtumisaeg tõlgendatakse serveri ajavööndis — P1

**Tõend.** Brauseri vorm kasutab `type="datetime-local"` välja ja saadab selle toorväärtuse muutmata JSON-i (`components/mentoring/MentoringRelationPage.jsx:383-404`). Sellisel stringil puudub UTC offset. Server teeb `new Date(String(value))`, mistõttu tõlgendus sõltub Node-protsessi kohalikust ajavööndist (`lib/mentoring/meetingService.js:22-25`). Vastus kuvatakse seejärel kasutaja brauseri lokaalses ajas (`components/mentoring/MentoringRelationPage.jsx:50-58`).

**Mõju.** Kui brauser on Tallinnas ja server UTC-s, salvestub kohtumine talvel kaks ning suvel kolm tundi soovitust nihkes. Vale aeg jõuab mõlemale poolele, upcoming-sweep'i ja e-posti teavitusse.

**Vastuvõtukriteerium.** Klient peab saatma ISO aja selge offset'i/UTC väärtusega või eraldi IANA ajavööndi; server peab offsetita sisendi tagasi lükkama. Brauseritest peab fikseeritud Tallinna kohaliku aja puhul kontrollima talve- ja suveaja täpset DB UTC väärtust ning tagasikuvamist.

**Seis (13.08.2026): DONE — brauser teisendab `datetime-local` väärtuse enne POST-i UTC ISO-stringiks ja server aktsepteerib ainult selge `Z` või offset'iga aega. Tallinna brauserikontekstis salvestus `2026-01-15 10:30` väärtuseks `08:30Z` ning `2026-07-15 10:30` väärtuseks `07:30Z`; mõlemad kuvati tagasi kohaliku `10:30` ajana. Offsetita serverisisend on ühiktestis ja PostgreSQL-sondis tagasi lükatud.**

### SOL-MENT-07 — lähenevate kohtumiste sweep võib jääda esimese 50 rea külge kinni — P1

**Tõend.** Sweep küsib 48 tunni akna kõik PLANNED kohtumised `take` piiriga (vaikimisi 50), kuid ilma `orderBy` või kursorita (`lib/mentoring/sweep.js:221-235`). Teavituse loomine ei muuda kohtumise olekut ega lisa „upcoming sent” markerit; dedupe teeb järgmisel sweep'il sama sündmuse lihtsalt olemasolevaks (`:236-250`). Seega jäävad samad sobivad read järgmise päringu kandidaadiks ja võivad täita esimese lehekülje kogu 48 tunni jooksul.

**Mõju.** Kui aknas on üle 50 kohtumise, võivad hilisemad read mitte kunagi upcoming-teadet saada enne oma algusaega. Töö loendur näitab samal ajal igal jooksul tööd, sest juba dedupe'itud esilehekülge töödeldakse uuesti.

**Vastuvõtukriteerium.** Sweep peab lehekülgima stabiilse `(occurredAt,id)` kursori kaudu või salvestama iga kohtumise/ajakava versiooni kohta püsiva claim'i, mis eemaldab juba töödeldud rea kandidaatidest. Testida vähemalt 2,5× batchSize kohtumist, kordusjooksu ja sama päeva ümbertõstmist.

**Seis (13.08.2026): DONE — upcoming-sweep lehitseb kogu akna stabiilse `(occurredAt,id)` kursori järgi, loendab tööks ainult uue teavituse ning dedupe sisaldab täpset kohtumisaega. Nii ühiktest kui päris PostgreSQL-sond töötlevad 125 kohtumist 50-reases pakis, kordusjooks on vaikne ja sama päeva ümbertõstmine tekitab täpselt ühe uue teate kummalegi poolele.**

### SOL-SUP-01 — suletud protsess ei ole serveris lõplik: kutse saab vastu võtta ja uut jagatud sisu luua — P1

**Tõend.** Kutsele vastamise teenus kontrollib osaluse omanikku ja aktiivset kontraktiversiooni, kuid ei keela `process.status === "CLOSED"` olekut ei enne ega protsessiluku sees (`lib/supervision/service.js:437-496`). Sama puudus on aktiivse kontraktiversiooni kinnitamisel (`:499-523`). `shareTopic()` kontrollib ainult OS/OS_STALE rolli, mitte protsessi olekut, ning loob luku all uue SHARED rea (`lib/supervision/topics.js:34-90`). Eraldi auditiproov sulges protsessi ja tõendas seejärel mõlemad rajad: INVITED osalus muutus `ACCEPTED`/`OS`-iks ning uus teema tekkis `CLOSED` protsessi ja oli detailvaates nähtav. UI peidab toimingud `open` lipu abil (`lib/supervision/serializers.js:139-157`), kuid siduv leping nõuab õiguste serveripoolset jõustamist (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:506-510`).

**Mõju.** Sulgemisel tehtud purge ei ole püsiv lõppseis: pärast toorsisu kustutamist saab protsessi uuesti tundliku jagatud tekstiga täita. Sulgemishetkel kutsutuna välja jäänud kasutaja saab hiljem liikmeks, kuid talle ei loodud sulgemistehingus isiklikku väljundit; samal ajal saab ta ligipääsu alles hoitud kontraktile, kohtumisfaktidele ja kinnitatud kokkuvõtetele.

**Vastuvõtukriteerium.** Kõik protsessi kirjutusrajad peavad luku all värskelt kontrollima lubatud protsessiolekut. CLOSED protsessil võib lubada ainult selgelt dokumenteeritud omaniku privaatala toiminguid; kutse vastuvõtt, kontrakti kinnitus ja M7 jagamine peavad andma stabiilse 409 ilma ühegi kirjutuse/auditita. Lisada iga raja HTTP- ja teenusetest ning sulgemisjärgne invariant, et jagatud toorsisu jääb tühjaks.

**Seis (13.08.2026): DONE — jagatud protsessiala kirjutused kasutavad nüüd ühist, advisory-luku sees värskelt loetavat CLOSED-väravat; omaniku privaatne eeskamber jääb teadlikuks erandiks. Teenuse- ja HTTP-testid tõendavad kutse vastuse, kontraktikinnituse ja M7 jagamise 409-t ilma kirjutuse või auditita. `npm run supervision:integrity:probe` 18/18 päris PostgreSQL-is järjestas sulgemise enne ootel teema- ja kutsekirjutust: mõlemad hilised kirjutused kaotasid ning suletud protsessi jagatud toorsisu jäi tühjaks.**

### SOL-SUP-02 — asendatud kontraktiversiooni taasaktiveerimine taastab vana nõusoleku ilma kasutaja uue kinnituseta — P1

**Tõend.** `activateContractVersion()` lubab aktiveerida protsessi suvalise versiooni ega nõua `version.status === "DRAFT"`; eelmine aktiivne märgitakse SUPERSEDED ja valitud versioon ACTIVE-iks (`lib/supervision/service.js:312-370`). Kontraktipaneel pakub aktiveerimisnuppu igale mitteaktiivsele ajalookirjele, sealhulgas SUPERSEDED versioonile (`components/supervision/ContractPanel.jsx:124-145`). Acceptance-read säilivad versioonipõhiselt (`prisma/schema.prisma:4075-4085`). Auditiproov aktiveeris v2, sai osalejale `OS_STALE`, aktiveeris siis SUPERSEDED v1 uuesti ning osaleja muutus vana acceptance'i põhjal kohe `OS`-iks väärtusega `hasAcceptedActiveContract=true`, kuigi ta ei teinud uut kinnitustoimingut.

**Mõju.** Superviisor saab lepinguraami tagasi pöörata ja taastada osalejate kirjutus- ning kinnitamisõigused ajaloolise nõusoleku põhjal. Teavitust ei pruugi tekkida, sest selle versiooni acceptance on juba olemas. Audit jätab mulje kehtivast nõusolekust, kuid kasutaja ei kinnitanud seda uut aktiveerimisotsust.

**Vastuvõtukriteerium.** Aktiveerida tohib ainult uut DRAFT-versiooni ja versiooninumbrid peavad liikuma monotoonselt edasi; SUPERSEDED peab olema lõplik. Kui vana teksti soovitakse taastada, tuleb luua uus versioon uue ID/numbriga ning kõik ACCEPTED osalejad muutuvad OS_STALE-iks kuni uue kinnituseni. Testida vana versiooni otsest API-aktiveerimist ja UI nupu puudumist.

**Seis (13.08.2026): DONE — aktiveerimisrada võtab vastu ainult DRAFT-versiooni, kontrollib aktiivse versiooni vastu rangelt kasvavat versiooninumbrit ning jätab SUPERSEDED rea lõplikuks. Kontraktipaneel kuvab aktiveerimisnupu ainult DRAFT-reale. Teenuse- ja HTTP-test lükkavad v1 taasaktiveerimise 409-ga tagasi, osaleja vana acceptance ei taastu ning PostgreSQL-sond kinnitab, et v2 jääb aktiivseks.**

### SOL-SUP-03 — superviisor ei saa jagatud teemat luua, kuigi siduv õiguste- ja API-leping lubab seda — P1

**Tõend.** Siduv Q2.3 maatriks annab M7 loomise õiguse nii SV-le kui OS-ile ning API-kaart kirjeldab väravat `OS/SV` (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:519-525`, `:583-584`). Skeem nõuab aga igal teemal `authorParticipationId` väärtust (`prisma/schema.prisma:4109-4126`), kuigi superviisoril osalusrida ei ole. Teenus lahendab vastuolu SV keelamisega 403 kaudu (`lib/supervision/topics.js:25-42`) ja UI peidab temalt jagamisnupu (`lib/supervision/serializers.js:149-154`; `tests/supervision/ui.test.js:216-224`).

**Mõju.** Lubatud põhifunktsioon puudub: superviisor ei saa protsessi ühisesse alasse lisada enda ettevalmistatud teemat. Testid ei paljasta lahknevust, vaid kinnistavad rakenduse käitumise, mis on lähteülesande õiguste maatriksiga vastuolus.

**Vastuvõtukriteerium.** Omanik peab otsustama, kumb leping on õige. Kui siduv Q2 jääb jõusse, peab autorimudel toetama superviisorit ilma võltsosalust loova kõrvalmõjuta, serializer ja audit peavad eristama autoritüüpi ning UI/teenusetest peab tõendama SV ja OS lubatud rajad. Kui SV ei tohi autoreerida, tuleb enne parandust muuta siduvat tootelepingut ja mõju ülejäänud voole uuesti hinnata.

**Seis (13.08.2026): DONE — omanik kinnitas siduva Q2 õiguse: nii SV kui kehtiva kontraktikinnitusega OS võivad M7 teemat autoreerida. Autorimudel kasutab nüüd ilma võltsosaluseta kas `authorSupervisorUserId` või `authorParticipationId` viidet; andmebaasi CHECK lubab täpselt ühe elava autoritüübi või konto kustutamisel ajatempliga anonüümse autori. Serializer eristab `SUPERVISOR`/`PARTICIPANT`/`DELETED` autorit ning SV jagamis- ja tagasivõtmisõigus on teenuse- ja UI-lepingutestiga tõendatud.**

### SOL-SUP-04 — osaleja lahkumise olek on mudelis olemas, kuid sellesse jõudmise funktsioon puudub — P1

**Tõend.** Skeem ja serializer toetavad `LEFT`/`leftAt` olekut (`prisma/schema.prisma:4052-4073`; `lib/supervision/serializers.js:56-64`, `:162-198`) ning auditikonstantides on `PARTICIPANT_LEFT` (`lib/supervision/shared.js:24-39`). Kogu `lib/supervision/**`, `app/api/supervision/**` ja `components/supervision/**` ulatuses puudub aga teenus, API-route ja kasutajatoiming, mis seaks osaluse LEFT-iks või kirjutaks selle auditi; otsing leiab `leftAt` kasutuse ainult lugemis-/testikoodist. Kokkuvõtete test saavutab LEFT-oleku fake-DB otsese muutmisega (`tests/supervision/summaries.test.js:53-56`), mitte avaliku vooga.

**Mõju.** Liitunud osaleja ei saa tavavoo kaudu protsessist lahkuda. LAHK-privaatsusreeglid, lahkumisaja järgne sisu piiramine ja `PARTICIPANT_LEFT` audit on tootmises saavutamatud; ainus praktiline tee on protsessi sulgemine või käsitsi andmebaasimuutus.

**Vastuvõtukriteerium.** Lisada atomaarne, protsessilukuga lahkumistoiming koos selge kinnituse, `leftAt`, auditi, teavituste ning Q2.3 lugemispiiridega. Testida individuaal- ja grupiprotsessi, viimase osaleja lahkumist, pooleliolevat kokkuvõtet, paralleelset kinnitamist/lahkumist ja lahkumisjärgset IDOR-i.

**Seis (13.08.2026): DONE — osalejal on nüüd kahe sammuga kinnitatav lahkumistoiming, mis seab protsessiluku all `LEFT`/`leftAt`, kirjutab `PARTICIPANT_LEFT` auditi ja teavitab superviisorit ning allesjäänud aktiivseid liikmeid. Lahkunud vaade säilitab ainult lahkumiseelse sisu; võõras osalus annab HTTP 404. Viimase osaleja lahkumine lõpetab muidu kinnijääva ootel kokkuvõtte ning sama luku all värskelt kontrollitav kinnitusrada ei luba lahkunul hiljem kinnitada. Ühik- ja HTTP-plokk on 92/92 roheline; PostgreSQL-sondi deterministlik leave-vs-approve võistlus kinnitas ühe võitja, ühe lahkumisauditi ja püsiva teavituse.**

### SOL-SUP-05 — läheneva supervisioonikohtumise teavitus on surnud funktsioon — P1

**Tõend.** Q2.8 leping nõuab `supervision_meeting_upcoming` sündmust olemasolevalt ajastatud töölt kõigile liikmetele (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:700-709`). `notifyMeetingUpcoming()` on küll defineeritud (`lib/supervision/notifications.js:38-46`) ja tüüp registris olemas, kuid kogu tootmiskoodi otsing ei leia sellele ühtegi väljakutset; vasteid on ainult definitsioonis, registris ja tõlgetes. Supervisiooni testid kontrollivad teisi teavitusi, mitte ajastatud upcoming-rada (`tests/supervision/notifications.test.js:19-77`).

**Mõju.** Planeeritud kohtumised ei tekita lubatud läheneva aja teavitust ühelegi osalejale. UI ja tõlked jätavad funktsioonist valmis mulje, kuid worker ei saa seda kunagi käivitada.

**Vastuvõtukriteerium.** Ajastatud töö peab stabiilse lehekülje/claim'i kaudu leidma kõlblikud PLANNED kohtumised, tuletama värskelt liikmed, looma deduplikeeritud sündmused ja mitte näljutama hilisemaid ridu. Testida üle batch'i mahu, ümbertõstmist, tühistamist, CLOSED protsessi ja juba saadetud sündmust.

**Seis (13.08.2026): DONE — olemasolev notification-job käivitab supervisiooni eraldatud etapina; sweep lehitseb 48 tunni akna stabiilse `(plannedAt,id)` võtmega ning loeb iga kandidaadi protsessi ja ACCEPTED-liikmed värskelt. Dedupe sisaldab täpset kohtumisaega, seega kordusjooks ei dubleeri, aga ümbertõstmine loob uue teate. Ühiktest katab 2,5 batch'i, korduse, ümbertõstmise, CANCELLED/CLOSED read ja lahkunud liikme; päris PostgreSQL-sond kinnitas samad põhiinvariandid.**

### SOL-SUP-06 — isiklik väljund nimetab kinnitamata aktiivse lepingu kasutaja viimati aktsepteeritud lepinguks — P1

**Tõend.** Sulgemine laeb protsessi aktiivse kontraktiversiooni ja kirjutab selle teksti iga omaniku ühisesse `content` objekti välja `lastAcceptedContractBody`, kontrollimata konkreetse osaleja acceptance'i (`lib/supervision/closure.js:105-111`, `:134-149`). Q2.5 määratleb sama välja sõnaselgelt viimati aktsepteeritud lepingu tekstina (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:604-610`). Auditiproovis aktiveeriti v2, osaleja jäi `OS_STALE`/`hasAcceptedActiveContract=false`, protsess suleti ja tema M12 väljund sisaldas v2 teksti `lastAcceptedContractBody` all.

**Mõju.** Püsiv isiklik väljund loob vale nõusolekutõendi: kasutajale omistatakse lepingutekst, mida ta ei kinnitanud. Sama vale koopia säilib ka pärast protsessi toorsisu purge'i ning võib olla hilisema vaidluse või aruande alus.

**Vastuvõtukriteerium.** M12 tuleb ehitada omaniku kaupa: osalejale salvestada tema acceptance'idega tõendatud viimane versioon või selgelt nimetatud `activeContractBody` koos `accepted=false` faktiga. Sulgemise eeltingimus peab teadlikult otsustama, kas OS_STALE osalejaga üldse sulgeda tohib. Testida eri acceptance-ajalooga grupiliikmeid.

**Seis (13.08.2026): DONE — sulgemine lubab teadlikult ka OS_STALE osalejaga lõpetada, kuid M12 `lastAcceptedContractBody` arvutatakse nüüd iga omaniku acceptance-ajaloost eraldi. Superviisor saab aktiivse versiooni, osaleja enda suurima kinnitatud versiooninumbri ning kinnitamata aktiivset teksti talle ei omistata. Grupi ühiktest ja PostgreSQL-sond tõendasid, et v2 kinnitanud osaleja saab v2 ning v1 juurde jäänud osaleja v1.**

### SOL-SUP-07 — protsessilukk ei kaitse mitme teenuse pre-lock õiguse- ja olekukontrolli vananemise eest — P1

**Tõend.** Q2.4 nõuab igalt muteerivalt teenuselt lukku ja värske seisu kontrolli (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:550-561`), sulgemisleping keelab enne lukku loetud andmete usaldamise (`:602-607`). Tegelikult teevad näiteks kontraktiversiooni loomine (`lib/supervision/service.js:288-308`), kutse loomine (`:374-404`), kohtumise plaanimine (`lib/supervision/meetings.js:34-56`), kokkuvõtte loomine (`lib/supervision/summaries.js:52-83`) ja teema jagamine (`lib/supervision/topics.js:45-90`) õiguse/oleku kontrolli enne lukku ega loe protsessi ning osalust callback'is värskelt üle.

**Mõju.** Kui sulgemine, kontrakti aktiveerimine või osaluse muutus võidab pärast eelkontrolli, võib oodanud päring luku saades ikkagi kirjutada nüüdseks keelatud olekusse. Nii võivad CLOSED protsessi tekkida uus leping, kutse, kohtumine või kokkuvõte; OS_STALE/LEFT kasutaja võib lõpetada enne muutust alustatud jagamise. Päris PostgreSQL-i samaaegsusrada on `not_run`, kuid koodi lock-boundary ei sisalda lepingu nõutud värsket kontrolli.

**Vastuvõtukriteerium.** Kõik autoriseerimist ja protsessiolekut mõjutavad read tuleb teha advisory-luku sees samas tehingus ning väljast toodud rolli/process objekti ei tohi otsuse tegemiseks usaldada. Kahe ühendusega integratsioonitest peab deterministlikult peatama päringu eelkontrolli järel, tegema konkureeriva ülemineku ja tõendama keelatud kirjutuse puudumist.

**Seis (13.08.2026): DONE — protsessi, kontrakti, kutse, kohtumise, kokkuvõtte ja jagatud teema otsustavad õiguse- ning olekukontrollid loetakse advisory-luku callback'is samast tehingust uuesti; väljast loetud rolli või protsessi ei kasutata enam kirjutusotsuse autoriteedina. PostgreSQL-sondi kahe ühendusega deterministlik activate-vs-share võistlus peatas mõlemad kirjutajad, aktiveeris v2 esimesena ja tõendas seejärel ootel jagamise `CONTRACT_NOT_ACCEPTED` vastust ning puuduva M7 rea.**

### SOL-SUP-08 — kokkuvõtte „üks kohtumise kohta / üks FINAL” kontroll pole luku sees atomaarne — P1

**Tõend.** `createSummary()` kontrollib olemasolevat meeting- või FINAL-kokkuvõtet enne protsessiluku võtmist ja luku callback loob rea ilma korduskontrollita (`lib/supervision/summaries.js:52-83`). Skeemis on unikaalne ainult `meetingId`; FINAL-ridade jaoks on tavaline `[processId,kind,status]` indeks, mitte unikaalpiirang (`prisma/schema.prisma:4154-4174`). Kaks paralleelset FINAL-päringut võivad seega mõlemad eelkontrolli läbida ja luku järel järjest kaks FINAL-rida luua. Kohtumisrea puhul peatab teise DB unique, kuid P2002 pole selles funktsioonis 409-ks kaardistatud.

**Mõju.** Protsess võib saada mitu konkureerivat lõppkokkuvõtet, rikkudes kinnituse ja sulgemispaki tähenduse. Kohtumise topeltklõps/paralleelpäring võib lepingujärgse 409 asemel anda 500.

**Vastuvõtukriteerium.** Cardinality-kontroll tuleb korrata luku all ja FINAL vajab DB-taset tõket, mis arvestab teadlikult DISCARDED-versioone/parandusi. Kõik unique-konfliktid tuleb stabiilseks 409-ks kaardistada. Testida kahe päris DB-ühendusega paralleelset FINAL- ja MEETING-loomist.

**Seis (13.08.2026): DONE — `createSummary()` kordab MEETING/FINAL kardinaalsuskontrolli luku sees ja kaardistab DB `P2002` stabiilseks 409-ks. Migratsioon `20260814002000_sol_sup_summary_cardinality` asendas meetingId üldunikaalsuse kahe osalise unikaalindeksiga: üks elus kokkuvõte kohtumise kohta ja üks elus FINAL protsessi kohta; DISCARDED versiooni võib teadlikult asendada. Täis migratsioonikett oli 185/185 roheline ning kahe ühendusega PostgreSQL-võistlustes jäi nii FINAL-i kui MEETING-u puhul alles täpselt üks võitja; otsene duplikaat-FINAL kukkus DB-tõkkesse.**

### SOL-SUP-09 — kasutajakonto kustutus võib kustutada kogu supervisiooniprotsessi ja selle auditi — P1

**Tõend.** Protsessi `supervisor` FK kasutab `onDelete: Cascade`, mistõttu superviisori User-rea kustutamine kaskaadib kogu `SupervisionProcess` rea (`prisma/schema.prisma:4002-4031`). Protsessi kustutus kaskaadib kontraktid, osalused, teemad, kohtumised, kokkuvõtted, closure'i ja `SupervisionAuditEvent` read; auditi FK on samuti `onDelete: Cascade` (`:4217-4231`). Osaleja User-rea kustutus kaskaadib tema osaluse (`:4052-4069`), mis omakorda kustutab tema acceptance'id, authored topics ja summary approval'id. Isiklik väljund kustub omaniku konto kustutamisel (`:4202-4214`). Samal ajal kirjeldab tooteleping kinnitatud kokkuvõtteid, kontraktiraami ja faktijälge sulgemisjärgselt püsivana (`docs/platvormi arendus/t22-supervision-v1-ulesanne.md:41-48`).

**Mõju.** Ühe superviisori konto kustutamine võib hävitada kõigi osalejate ühise protsessiajaloo ja append-only auditijälje. Ühe osaleja kustutamine võib eemaldada juba jagatud teema või APPROVED kokkuvõtte approval-tõendi ilma kokkuvõtte staatust muutmata. See on vastuolus protsessi ühise omandi ja tõendusliku püsivusega.

**Vastuvõtukriteerium.** Konto elutsükkel vajab eraldi dokumenteeritud supervisioonipoliitikat: identiteediviited anonümiseeritakse/SetNull-ivad, kuid jagatud protsess, closure, kinnitatud artefaktid ja sisuvaba audit säilivad määratud retention'i piires. Upgrade ja konto-kustutuse integratsioonitest peab tõendama iga M1–M13 rea oodatud saatuse nii superviisori kui osaleja kustutusel.

**Seis (13.08.2026): DONE — omanik kinnitas PII-vaba tombstone'i lepingu. Konto kustutamise tehing nullib superviisori, osaleja ja superviisori-autori identiteediviited ning lisab kustutusaja, kuid säilitab jagatud protsessi, kontraktid ja acceptance'id, jagatud teemad, kinnitatud kokkuvõtted ja approval'id, closure'i ning sisuvaba auditi. M6 privaatkirjed ja M12 isiklikud pakid kustuvad koos kontoga. Privaatsuspoliitika §7.12 kirjeldab erandit ning jätab jagatud tõendi automaatse purge'i `AWAITING_POLICY` fail-closed olekusse kuni täpse tähtaja kinnitamiseni. Täis migratsioonikett on 186/186 roheline; päris PostgreSQL-i 47/47 sond tõendas eraldi superviisori ja osaleja kustutuse järel kõik säilimise, anonümiseerimise ja kustumise invariandid.**

### SOL-SUP-10 — LAHK kasutaja saab sulgemise eelvaatest peidetud sisu olemasolu ja ID-sid — P2

**Tõend.** Õiguste maatriks lubab close-preview'd SV/OS/OS† rollile, kuid LAHK veerus on keeld (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:534-536`). `closePreview()` keelab ainult KUT-rolli ning lubab seega LAHK kasutaja läbi (`lib/supervision/closure.js:42-47`). Seejärel loeb funktsioon filtreerimata kõik kokkuvõtted, teemad ja kohtumised ning tagastab PENDING-kokkuvõtete ID-d, kõikide teemade arvu, SV DRAFT/DISCARDED kokkuvõtete arvu ja märkmetega kohtumiste arvu (`:48-73`), kuigi tavaprotsessi serializer piirab LAHK vaate APPROVED sisule kuni lahkumiseni (`lib/supervision/serializers.js:189-198`).

**Mõju.** Endine osaleja saab pärast lahkumist teada hilisemate või talle kunagi nähtamatute supervisor-only teemade, superviisori mustandite, märkmete ja ootel kokkuvõtete olemasolu ning mõne objekti ID. Sisu ennast ei väljastata, kuid konfidentsiaalse töö mahu ja käimasoleku metaandmed lekivad üle lahkumispiiri.

**Vastuvõtukriteerium.** Close-preview peab jõustama täpselt SV/OS/OS† rollid. Mitte-SV vastus tuleb ehitada vaatajapõhiselt ega tohi sisaldada talle nähtamatute objektide ID-sid või loendusi. Testida LAHK, KUT, ADMIN, outsider ja OS, kelle eest on SUPERVISOR_ONLY/DRAFT sisu.

**Seis (13.08.2026): DONE — `closePreview()` lubab ainult SV/OS/OS† vaataja, tagastab LAHK/KUT/ADMIN/võõrale ühetaolise 404 ning ehitab mitte-SV pending-ID-d ja teema-/kokkuvõtteloendused ainult tema nähtavast vaatest. Teenusetest katab kõik keelatud rollid ning OS-i eest peidetud SUPERVISOR_ONLY teema ja SV mustandi.**

### SOL-SUP-11 — pöördumatu sulgemise eelvaade ei ütle, et kogu kontraktiraam ja kinnitusfaktid jäävad alles — P1

**Tõend.** Sulgemistehing jätab kõik kontraktiversioonid ja acceptance-read alles ning kasutab aktiivse versiooni teksti püsiväljundite loomisel (`lib/supervision/closure.js:105-111`, `:134-149`, `:152-188`). Siduv leping nimetab M3+M5 kontraktiraami säilimise otsesõnu (`docs/platvormi arendus/t22-supervision-v1-ulesanne.md:41-44`). Serveri `willKeep` vastus sisaldab aga ainult APPROVED kokkuvõtete arvu, kohtumiste arvu ja `facts:true` (`lib/supervision/closure.js:63-72`); sulgemisleht kuvab vaid kinnitatud kokkuvõtteid, kohtumisfakte ja privaatkirjeid (`components/supervision/SupervisionClosePage.jsx:157-172`). Kontraktiversioone ega nõusolekufakte kustub/jääb manifestis ei nimetata.

**Mõju.** Superviisor teeb pöördumatu purge-otsuse puuduliku säilitusinfo alusel. Konfidentsiaalne lepingutekst ja osalejate kinnitusfaktid jäävad andmebaasi ning osaliselt isiklikesse pakkidesse, kuigi kinnitusvaade seda ei avalda.

**Vastuvõtukriteerium.** Close-preview peab serverist tuleva täieliku, versioonitud retention-manifestina loetlema kõik alles jäävad objektiklassid ja koopiad: lepingud, acceptance'id, audit, closure/faktid, APPROVED read, M6 ja M12. UI peab selle enne teist kinnitust arusaadavalt näitama; lepingutest võrdleb manifesti päris sulgemisjärgse DB seisuga.

**Seis (13.08.2026): DONE — close-preview tagastab `retentionManifestVersion:1` manifesti kontraktiversioonide, acceptance'ide, auditirea (koos tulevase close-sündmusega), closure/faktide, APPROVED kokkuvõtete, kohtumiste, M6 ja M12 kohta ning sulgemisleht kuvab kõik objektiklassid enne kinnitamist. Lepingutest võrdleb manifesti sulgemisjärgse andmebaasiseisuga ja eraldi kontroll tõendab, et kustutusloendus hõlmab ka päriselt kustuvat DISCARDED rida.**

### SOL-SUP-12 — kokkuvõtete „reaalajas” kinnitusseis ei värskene teiste osalejate tegevuse järel — P2

**Tõend.** Q2.6 nõuab PENDING-kokkuvõtte kinnituste seisu reaalajas ning lubab selleks polling'ut (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:637-639`). `SupervisionProcessPage` laeb protsessi ainult komponendi mount'imisel või oma child-toimingu `onReload` callback'iga (`components/supervision/SupervisionProcessPage.jsx:45-76`, `:203-219`). `SummariesPanel`-is puudub poll, refresh või nähtav käsitsi värskendamise toiming; see kuvab serverist saadud approvals massiivi muutumatu propsina (`components/supervision/SummariesPanel.jsx:19-36`, `:130-137`).

**Mõju.** Grupiprotsessis ei näe superviisor ega teine osaleja teiste kinnitusi või APPROVED-üleminekut enne kogu lehe uuesti avamist või enda kirjutustoimingut. Kuvatud `N/M` ja tegevusnupp võivad olla aegunud ning „juba kinnitatud” 409 käsitlus ei aita passiivset vaatajat.

**Vastuvõtukriteerium.** Lisada nähtavuse ajal mõõdukas poll/revalidation või sündmuspõhine värskendus, peatades selle taustal ja CLOSED olekus. Testida kahe kliendiga: üks kinnitab, teine näeb ilma oma toiminguta N/M ja lõppstaatuse muutust.

**Seis (13.08.2026): DONE — protsessivaade värskendab aktiivse ja nähtava dokumendi kokkuvõtteala iga 10 sekundi järel, peatub taustal/CLOSED olekus ning teeb nähtavaks muutumisel kohe uue päringu; cleanup eemaldab taimeri ja listener'i. Kahe päris brauserikliendi läbisõit tõendas, et ühe osaleja kinnitus muutis teise vaates ilma tema toiminguta seisu `Ootab 1/2 kinnitust` ning teine kinnitus muutis esimese vaates staatuse `APPROVED`.**

### SOL-SUP-13 — ootel kokkuvõtte saab API-ga discard'ida, kuid UI-st puudub ainus sulgemist vabastav parandusrada — P1

**Tõend.** Sulgemine keeldub seni, kuni kasvõi üks kokkuvõte on `PENDING_APPROVAL` (`lib/supervision/closure.js:100-104`). `discardSummary()` lubab superviisoril kõik mitte-APPROVED staatused, sh PENDING, DISCARDED-iks muuta (`lib/supervision/summaries.js:141-155`) ja DELETE-route on olemas (`app/api/supervision/summaries/[id]/route.js:26-35`). `SummariesPanel` ei kutsu aga DELETE-meetodit ega kuva discard/tühista nuppu; superviisor saab DRAFT-i ainult muuta/submit'ida ja PENDING-real pole tal ühtegi tegevust (`components/supervision/SummariesPanel.jsx:75-96`, `:140-183`). Sulgemisvaade viib blokeeriva kokkuvõtte juurde, kuid seal parandusrada ei teki (`components/supervision/SupervisionClosePage.jsx:175-195`).

**Mõju.** Kui osaleja lahkub, ei vasta või kokkuvõte saadeti ekslikult kinnitamisele, ei saa tavakasutaja protsessi enam lõpetada. Funktsioon on tehniliselt API-s olemas, kuid platvormi UI-st saavutamatu; kasutaja jääb püsivasse PENDING-sulgemisblokki.

**Vastuvõtukriteerium.** Superviisorile tuleb PENDING kokkuvõttel pakkuda selgelt sõnastatud tagasivõtmise/discard'i voog koos kinnituse ja tagajärje selgitusega. Otsustada tuleb, mis saab juba antud approval'idest ja teavitustest. Kahe konto brauseritest peab tõendama submit → osaline approval → discard → sulgemine.

**Seis (13.08.2026): DONE — omanik kinnitas, et PENDING rea tagasivõtmine kustutab selle kinnitused, märgib kõik ootel kokkuvõtteteavitused loetuks ja peidetuks ning kirjutab sisuvaba `SUMMARY_DISCARDED` auditi; asenduskokkuvõte alustab kinnitamist nullist. Superviisoril on DRAFT/PENDING real selge tagasivõtmisnupp koos tagajärgede kinnitusega ning aegunud teavituse serveripoolne sihtkontroll nõuab endiselt PENDING olekut ja kinnitamata osalust. Teenusetest tõendab approval'ide, teavituste ja auditi saatuse. Kahe päris konto brauserivoog tõendas `1/2` osalise kinnituse → kinnitatud discard'i → osaleja tühja kokkuvõttevaate → superviisori eduka kaheastmelise sulgemise.**

### SOL-SUP-14 — protsesside „viimane tegevus” järjekord ei kajasta mitut põhitoimingut — P2

**Tõend.** Avaleht järjestab protsessid `lastActivityAt` järgi (`lib/supervision/service.js:194-227`). Osa toiminguid kutsub `touchProcess()`-i, kuid kontraktiversiooni loomine (`:288-309`), kokkuvõtte muutmine ja submit (`lib/supervision/summaries.js:88-138`) ning teema tagasivõtmine (`lib/supervision/topics.js:94-123`) ei uuenda seda välja. Privaatala toimingute väljajätmine võib olla teadlik, kuid nimetatud jagatud/protsessitoimingud pole privaatsed kõrvaltegevused.

**Mõju.** Hiljuti muudetud või kinnitamisele saadetud protsess võib „Minu protsessid” loendis jääda vanale kohale. Continuity ja teavitused võivad tegevust näidata, kuid põhiloendi kuupäev/järjestus räägib eri tõde.

**Vastuvõtukriteerium.** Defineerida üks kanooniline „protsessi aktiivsuse” sündmuste loend ja uuendada `lastActivityAt` kõigil neil samas tehingus; privaattegevused tuleb teadlikult välja jätta. Tabeltest peab läbima kõik muteerivad teenusefunktsioonid ja kontrollima välja muutumist või dokumenteeritud muutumatust.

**Seis (13.08.2026): DONE — `SUPERVISION_ACTIVITY_EVENTS` fikseerib jagatud/protsessi tegevuste kanoonilise loendi ja jätab M6 privaattoimingud teadlikult välja. Puudunud kontraktiversiooni loomine, kokkuvõtte muutmine/submit ja teema tagasivõtmine uuendavad nüüd `lastActivityAt` samas advisory-lukustatud tehingus; tabeltest kontrollib iga varem puudu olnud rada täpse ajaga ning eraldi create/update/delete M6 kontroll tõendab tegevusaja muutumatust.**

### SOL-SUP-15 — continuity võib jätta aktiivsed protsessid ja järgmiste kohtumiste ettevalmistuse vaikides leidmata — P2

**Tõend.** `buildSupervisionContinuity()` võtab ACCEPTED osalustest maksimaalselt 20 ilma `orderBy` või kursorita (`lib/supervision/notifications.js:108-111`), mistõttu üle piiri jäävad protsessid ei jõua ühegi pending-kontrollini. Ettevalmistusmärguanne tekib ainult siis, kui protsessis on kasutajal kokku null SHARED teemat (`:154-169`); teema ega kontroll ei ole seotud konkreetse järgmise kohtumisega. Pärast esimese teema jagamist ei saa kasutaja enam ühegi hilisema PLANNED kohtumise jaoks `supervision_prep_waiting` kirjet, kuigi Q2.8 sõnastab tingimuse järgmise kohtumise kohta (`docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md:700-709`).

**Mõju.** Rohkem kui 20 protsessiga kasutaja ootel lepingud/kokkuvõtted võivad „Jätka siit” kihist kaduda. Tavalises mitme kohtumise supervisioonis töötab ettevalmistusmärguanne sisuliselt ainult enne esimest jagamist, mitte iga järgmise kohtumise kontekstis.

**Vastuvõtukriteerium.** Pending-allikas peab kasutama stabiilset prioriteedipäringut või lehekülgima kõik kõlblikud osalused enne lõplikku kahe kirje valikut. Ettevalmistuse semantika vajab meeting/topic seost või muud kohtumisepõhist markerit. Testida üle 20 protsessi ning vähemalt kolme kohtumise jada, kus teema on jagatud esimese, kuid mitte järgmise jaoks.

**Seis (13.08.2026): DONE — continuity loeb kõik ACCEPTED osalused ja kõik PENDING kokkuvõtted stabiilses `updatedAt,id` järjekorras enne lõpliku kahe kirje valikut. Ettevalmistuse marker on nüüd kasutaja SHARED teema seos just järgmise PLANNED kohtumise `agendaTopicIds` väljaga, mistõttu eelmise kohtumise teema ei vaiki järgmist märguannet. Test leiab sihttöö 21. protsessist ning läbib kolme kohtumise jada: esimese agenda ei kata teist, teise agenda katab teise ja kolmas vajab uut markerit.**

### SOL-COV-01 — konto kustutus võib anda sama e-posti uuele kontole aktiivse kovisiooni ligipääsu — P1

**Tõend.** `CovisionParticipant.userId` kasutab konto kustutamisel `onDelete: SetNull`, kuid osaleja e-post ja `ACCEPTED` staatus jäävad reale (`prisma/schema.prisma:2576-2595`). Konto kustutuse lõpptehing teeb `tx.user.delete()` ega puhasta enne kovisiooni osalusi (`lib/privacy/effectivePracticeAccountCleanup.js:144-175`). Kõik aktiivse juhtumi päringud lubavad kasutaja-ID kõrval just `userId:null + email` varuvastet (`lib/covisionAccessShared.js:33-56`; `lib/covision.js:372-420`) ning sessiooniteenus teeb sama LIVE-staatusega reale (`lib/covisionSession.js:369-401`). Stabiliseerimisdokument väidab, et taaskasutatud e-post ei anna ligipääsu, kuid selle test katab ainult endiselt teise kontoga seotud rea, mitte FK `SetNull` lõppseisu (`docs/platvormi arendus/05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md:174-181`; `tests/covision/workspaceServerPrivacy.test.js:86-101`). Eraldi in-memory kontroll kinnitas, et `userId:null`, sama e-post ja `ACCEPTED` tagastavad uuele konto-ID-le osaleja.

**Mõju.** Kui kustutatud konto e-posti aadress võetakse hiljem uuesti kasutusele, saab uus konto näha aktiivse professionaalse arutelu täissessiooni ning osaleda jagatud töös ilma uue kutse või nõusolekuta. See on konto elutsüklist tekkiv konfidentsiaalsus- ja IDOR-piiririke.

**Vastuvõtukriteerium.** Konto kustutus peab samas tehingus muutma kõik kasutajaga seotud aktiivsed kovisiooniosalused terminalseks ja eemaldama e-posti-põhise ligipääsukandja või siduma osaluse kustutatud identiteedi pöördumatu tombstone'iga. Negatiivne päris-DB test peab looma ACCEPTED osaluse, kustutama konto, looma sama e-postiga uue konto ning tõendama 404 nii tööruumi-, sessiooni-, legacy- ja kõneradadel.

**Seis (14.08.2026): DONE — konto kustutuse lõpptehing muudab kasutaja osalused `EXPIRED` tombstone'iks, eemaldab `userId` ja e-posti ning märgib `identityErasedAt`; kõik e-posti varuvasted ja jagatud actor-lookup välistavad kustutatud identiteedi. PostgreSQL-i sond kustutas ACCEPTED konto, lõi sama e-postiga uue konto ning tõendas ligipääsu puudumist shared tööruumi-, sessiooni- ja legacy-päringus; kõnerada kasutab sama parandatud actor-lookup'i.**

### SOL-COV-02 — ekslikku või enam kehtivat osalejakutset ei saa tagasi võtta ega aeguma panna — P1

**Tõend.** Prisma enumis on `DECLINED` ja `EXPIRED`, kuid osalejamudelil pole aegumis-, tagasivõtmis- ega otsustaja välja (`prisma/schema.prisma:369-374`, `:2576-2595`). Jagatud adapter tunnistab otse, et kutsel pole aegumisaega (`lib/workspaces/adapters/covisionParticipationAdapter.js:53-75`). Sessioonikäsud sisaldavad kutsumist ja kinnitamist, kuid mitte decline/remove/revoke/expire toimingut (`lib/covisionSession.js:19-32`); UI action-loend ning etapi 1 juhtpaneel pakuvad samuti ainult kutsumist ja kutsutule kolme kinnitussammu (`components/covision/CovisionLiveSession.jsx:17-30`, `:360-408`, `:1036-1130`). ACCEPTED osaleja jääb nähtava aktiivse juhtumi ja lõpetatud juhtumi ligipääsureeglisse tähtajatult (`lib/covision.js:372-386`; `lib/covisionCompletedCases.js:128-171`).

**Mõju.** Valesti sisestatud aadressi, lahkunud kolleegi või konfidentsiaalsusleppe lõpetamise järel ei saa omanik ligipääsu serveris lõpetada. INVITED kutse võib jääda ootama piiramata ajaks ja ACCEPTED osaleja saab ka arhiveeritud üldistatud juhtumit edasi vaadata.

**Vastuvõtukriteerium.** Lisada auditeeritud owner/co-moderator revoke/remove ning kutsutu decline toiming, serveri kontrollitav aegumisaeg ja terminalse staatuse kohene jõustamine kõigis tööruumi-, sessiooni-, legacy-, closure- ja kõneradades. Testida vale aadressi revoke'i, aegumist, aktiivse osaleja eemaldamist, paralleelset accept-vs-revoke'i ning eemaldatud kasutaja avatud vahekaardi järgmist päringut.

**Seis (14.08.2026): DONE — server ja UI toetavad kutsutu keeldumist, juhi/kaasmoderaatori tühistamist ning kordussaatmist; kutsel on 14-päevane serveriaeg, taustasweep muudab aegunud kutsed terminalseks ja katkestab outboxi. Tühistamine sulgeb järgmise päringu kohe ning salvestab otsustaja/aja ja append-only auditi. PostgreSQL-i lukustatud revoke-vs-accept võistlus tõendas, et täpselt üks käsk võidab ja tühistamise järel on avatud vahekaardi järgmine päring 404.**

### SOL-COV-03 — API lubab kutse nõustumisjärjekorrast mööda minna ja avab sisu enne valmisolekut — P1

**Tõend.** UI nõuab järjekorda rollikinnitus → kokkuleppega nõustumine → valmisolek (`components/covision/CovisionLiveSession.jsx:360-401`). Server kontrollib kokkuleppe kinnitamisel aga ainult seda, et sessiooniseaded oleks kinnitatud; rollikinnitust nõutakse alles `ready` toimingul (`lib/covisionSession.js:1076-1087`). `agreementConfirmed:true` muudab INVITED rea kohe `ACCEPTED`-iks ja seob konto (`:1104-1116`). Järgmine serializer ei kasuta enam minimaalset kutsevaadet, vaid tagastab juhtumi pealkirja, kõik osalejad, jagatud töö, kasutaja privaatoleku ja etapifotod (`:464-519`). Üldine mutatsioonivärav kontrollib edasiste toimingute puhul ACCEPTED staatust, mitte `roleConfirmedAt` või `readyAt` olemasolu (`:1048-1061`). Eraldi action-normaliseerija kontroll aktsepteeris `agreementConfirmed:true` ilma rollikinnituseta.

**Mõju.** Kutsutu saab otse API-ga vahele jätta kuvatud rolli- ja valmisolekusammud, avada konfidentsiaalse sessiooni ning kirjutada jagatud tööobjekte enne seda, kui serveri enda metoodiline nõusolekujada on täidetud.

**Vastuvõtukriteerium.** Server peab jõustama sama monotoonse kinnitusahela nagu UI: agreement eeldab role-confirmed, ready eeldab mõlemat ning täissisu ja kõik sisumutatsioonid eeldavad ready-olekut. Negatiivtestid peavad saatma iga sammu vales järjekorras nii INVITED kui ACCEPTED, kuid veel mittevalmis osalejana, ja kontrollima sisu puudumist ning null kirjutust.

**Seis (14.08.2026): DONE — server nõuab monotoonselt rollikinnitust enne kokkulepet ja mõlemat enne `ready`; `ACCEPTED` ning konto sidumine tekivad alles viimasel sammul. Osaliselt kinnitatud osaleja saab ainult minimaalse sisuta vaate ja kõik muud mutatsioonid nõuavad `readyAt` olemasolu. Sihttestid katavad iga vale järjekorra ning PostgreSQL-i sond tõendab enne valmisolekut peidetud pealkirja ja read-only vaate.**

### SOL-COV-04 — kovisiooni kutse võib jäädavalt kaduda, kuigi API raporteerib toimingu edukana — P1

**Tõend.** Kutse luuakse andmebaasis enne e-kirja saatmist. `sendCovisionInviteEmails()` tagastab puuduva `EMAIL_FROM`/`SMTP_FROM` korral vaikselt ja kutsub mailerit null korda (`lib/covisionInvites.js:11-24`); eraldi kontroll kinnitas selle lõppseisu. Generic loomine käivitab saatmise fire-and-forget ja ainult logib vea (`lib/covision.js:603-658`). Sessioonikäsu rada küll ootab saatmist, kuid neelab vea ning tagastab ikkagi eduka värske sessiooni (`lib/covisionSession.js:1258-1289`). Kovisiooni jaoks ei looda `NotificationEvent`, domeenisündmust ega püsivat e-posti outbox'i; osalejareal puuduvad delivery staatus, katsete arv ja resend-kandja (`prisma/schema.prisma:2576-2595`).

**Mõju.** Välise aadressiga kutsutu ei tea juhtumi olemasolust ning omanik näeb lihtsalt INVITED osalejat, ilma usaldusväärse tõendita, kas kiri saadeti. Ajutine SMTP-tõrge või üks puuduva saatja seadistus võib kutse jäädavalt kaotada; taastatav resend puudub.

**Vastuvõtukriteerium.** Kutse peab looma samas põhitehingus idempotentse outbox-/teavituskirje ning API peab tagastama ausa delivery-seisu. Worker vajab retry/backoff'i, stabiilset dedupe-võtit ja administraatori/omaniku turvalist resend-rada; puuduva saatja korral peab konfiguratsioonivärav fail-closed olema. Veasüstitestid peavad katma DB→outbox, outbox→SMTP, timeout/unknown outcome ja kordussaatmise.

**Seis (14.08.2026): DONE — kutse ja `CovisionInviteDelivery` tekivad samas tehingus nii generic kui sessioonirajal. Teavitustöö claimib CAS-iga, kasutab piiratud backoff'i ja stabiilset Message-ID-d, märgib timeout'i `UNKNOWN` ning puuduva saatja `FAILED`; terminalne osalus tühistab ootel tarne. Juht näeb tarneolekut ja saab sama outbox-rida turvaliselt uuesti järjekorda panna. Sihttestid katavad env-i puudumise, SMTP retry, timeout'i, püsiva ID ja resend'i; PostgreSQL-i sond tõendab päris outboxi `SENT` lõppseisu.**

### SOL-COV-05 — `private_draft` tööobjekt salvestatakse ja jagatakse tegelikult kõigile osalejatele — P1

**Tõend.** Serveri lubatud tööobjekti staatuste seas on sõnaselgelt `private_draft` (`lib/covisionSession.js:34-52`). `SUBMIT_WORK_ITEM` seab aga sõltumata staatusest `visibility:"shared"` ja salvestab kogu content'i (`:1136-1149`). Sessioonipäring loeb kõik `visibility:"shared"` read ning serializer tagastab nende sisu igale ACCEPTED osalejale (`:329-365`, `:425-438`, `:485-518`). See on vastuolus sama skeemi selgitusega, et privaatsed mustandid hoitakse eraldi just selleks, et jagatud serializer neid teisele kasutajale ei annaks (`prisma/schema.prisma:2665-2683`).

**Mõju.** API klient, tulevane UI või integratsioon, mis kasutab nime järgi `private_draft` staatust, võib avaldada tundliku mõtte või märkme kohe kogu ringile. Staatus loob privaatsuslubaduse, mida server ei täida.

**Vastuvõtukriteerium.** `private_draft` tuleb jagatud tööobjekti allowlist'ist eemaldada või suunata atomaarse käsuga `CovisionPrivateState` mudelisse; privaatne sisu ei tohi kunagi sattuda shared real ega snapshot'i. Kahe kasutajaga negatiivtest peab salvestama privaatmustandi ja kontrollima, et teine osaleja ei näe selle sisu, ID-d ega olemasolu.

**Seis (14.08.2026): DONE — `private_draft` eemaldati jagatud tööobjekti serveri allowlist'ist; privaatmustandi ainus rada jääb kasutajaga seotud `SAVE_PRIVATE_STATE`/`CovisionPrivateState` mudelisse, mida teise osaleja päring ei lae. Negatiivtest saadab `private_draft` shared-käsu, saab `INVALID_WORK_STATUS` ning tõendab, et markerit, rida ega ID-d ei salvestatud.**

### SOL-COV-06 — omaniku konto kustutamine hävitab kõigi osalejate lõpetatud juhtumi ja tõendusjälje — P1

**Tõend.** `CovisionCase.owner` kasutab `onDelete: Cascade`; juhtumi kustutus kaskaadib sessiooni, osalejad ja `CovisionClosure` rea (`prisma/schema.prisma:2481-2517`, `:2707-2748`). Closure'i `owner` ja omaniku pakett kasutavad samuti Cascade'i (`:2733-2741`, `:2778-2791`). Konto kustutuse teenus kustutab User rea otse ega eralda enne jagatud kovisioonikirjeid või osalemise tõendit (`lib/privacy/effectivePracticeAccountCleanup.js:144-175`). Kohalik õigus-/retentsioonimustand eristab privaatmärkmiku kontoelutsüklit jagatud ruumi sisust ja osalemise tõendist, mis peavad säilima eraldi reegli järgi (`docs/legal/sotsiaalai_organisatsioonikasutuse_raamleping_vnext_MUSTAND.md:1004-1011`). Olemasolev skeemitest tõendab ainult `closedBy` SetNull-seost, mitte omaniku cascade'i (`tests/covision/completedCasesSchema.test.js:71-76`).

**Mõju.** Ühe omaniku konto kustutus võib eemaldada teiste professionaalide ühise minimaalse closure'i, järelvaate ajaloo, osaluse ja selle, kes mida kinnitas. See lõhub nii koostöö järjepidevuse kui ka tõendi, kuigi toode nimetab closure'it lõpetatud/arhiveeritud kirjeks.

**Vastuvõtukriteerium.** Omaniku identiteet tuleb jagatud/ajaloolise kirje elutsüklist eraldada: SetNull + minimaalne kustutatud omaniku snapshot või eraldi retentsiooniarhiiv, mille tähtaeg ja vastutaja on selged. Päris FK-test peab kustutama omaniku ning tõendama, milline minimaalne closure, follow-up ja osalemise audit säilib ning milline privaatne sisu kustub.

**Seis (14.08.2026): DONE — `CovisionCase` ja `CovisionClosure` omaniku FK on nüüd nullable `SetNull`; konto kustutuse samas tehingus külmutatakse rollisnapshot ja kustutusaeg. Jagatud juhtum, closure, follow-up, osalus ning sisuvaba audit säilivad, omaniku privaatne `CovisionOwnerPackage` kustub endiselt. PostgreSQL-i FK-sond tõendab kõiki neid lõppseise ning actor-seose tombstone'i.**

### SOL-COV-07 — fikseeritud loendipiirid võivad peita aktiivse kutse või tähtaja ületanud järelvaate — P1

**Tõend.** Aktiivse kovisiooni tööruum võtab ilma kursori või `hasMore` väljata ainult 100 rida (`lib/covision.js:568-578`); UI pärib ühe korra ega paku lehekülge (`components/covision/CovisionWorkspace.jsx:58-81`). Lõpetatud juhtumite teenus võtab ainult 200 rida, sorteerib need alles mälus ning arvutab total/followUp/attention loendurid ainult kärbitud valimist (`lib/covisionCompletedCases.js:382-418`). Kliendi päring saadab ainult scope/sort/q/status parameetrid, mitte cursorit (`components/covision/CompletedCasesPage.jsx:391-421`).

**Mõju.** Rohke ajaloo korral võib kasutaja aktiivne kutse või vanem endiselt aktiivne juhtum esimesest vaatest kaduda. Veel ohtlikumalt võib üle 200 rea jääv tähtaja ületanud järelvaade puududa nii tähelepanualast kui ka loendurist, kuigi UI kuvab arvu terviktõena.

**Vastuvõtukriteerium.** Mõlemad loendid peavad kasutama stabiilset prioriteedijärjestust ja cursor-paginatsiooni või eraldi täielikke serveriloendureid. Aktiivsed kutsed, `OVERDUE`, `DUE_TODAY` ja `DECISION_REQUIRED` peavad olema prioriteetselt leitavad sõltumata ajaloo mahust. Testida vähemalt 101 aktiivset/kutserida ja 201 closure'it, kus ainus üle tähtaja kirje jääb praeguse lõike taha.

**Seis (14.08.2026): DONE — eksitavad kõvad 100/200 lõiked eemaldati; server tagastab täieliku valimi ja sellest arvutatud täielikud loendurid. Tööruum tõstab kutsed stabiilselt ette ning closure-loendi kõik sordid kasutavad deterministlikku ID tie-break'i, tähelepanujärjestus hoiab `OVERDUE`, `DUE_TODAY` ja `DECISION_REQUIRED` ees. Mahutest leiab vana kutse 101 rea seast ning ainsa overdue closure'i ja õige loenduri 201 rea seast.**

### SOL-COV-08 — osaleja- ja otsuseelutsüklil puudub taastatav auditirada — P1

**Tõend.** `CovisionParticipant` talletab ainult rolli, kutse staatuse ning üldised created/updated ajad; kutsuja, nõustumise, tagasivõtmise ja rollimuutuse actor/aja väljad puuduvad (`prisma/schema.prisma:2576-2595`). Sessioonikäsud muudavad kutse staatust, rolli, osaleja kinnitusi, faasi ja etappi ühe muteeruva hetkeseisuna (`lib/covisionSession.js:965-1034`, `:1036-1255`). Stage snapshot säilitab ainult etapi lõpetaja ning sulgemine ainult ühe `closedById`; järelvaate otsus kirjutab closure'i staatuse ja märkuse üle ilma otsusesündmuse või `decidedBy/decidedAt` reata (`prisma/schema.prisma:2686-2748`; `lib/covisionCompletedCases.js:857-936`). Nendes teenustes ei looda domeenisündmust ega eraldi append-only Covision auditikirjet.

**Mõju.** Hiljem ei saa usaldusväärselt tõendada, kes saatis kutse, millal ja millise rolliga nõustuti, kes muutis osalejarolli või milline otsus viis järelvaate sulgemise/jätkuni. Konto- ja FK-elutsükkel võib viimasedki actor-seosed SetNull'iks või Cascade'iga kaduma panna.

**Vastuvõtukriteerium.** Defineerida minimaalne sisuvaba append-only auditileping kutse, accept/decline/revoke, rollimuutuse, etapi lõpetamise, closure'i, follow-up'i ja lõppotsuse jaoks. Audit peab sündima põhitehingus või transactional outbox'is, kasutama idempotentsusvõtit ning säilitama actor tombstone'i konto kustutuse järel. Tabeltest peab katma iga muteeriva käsu ja auditikirjutuse veasüsti.

**Seis (14.08.2026): DONE — `CovisionAuditEvent` on sisuvaba append-only leping unikaalse idempotentsusvõtme, actor-rollisnapshot'i ja `SetNull` actor-seosega. Kõik sessiooni mutatsioonikäsud kirjutavad ühise tehingu lõpus auditi; eraldi sündmused katavad closure'i loomise, follow-up'i lõpetamise/ümberajastamise, lõppotsused ja arhiveerimise. Veasüstitest tõendab kutse, outboxi ja versiooni täielikku rollback'i auditiveal; PostgreSQL-i sond tõendab rolli/kokkuleppe/revoke jada ning konto kustutuse järel säilinud actor tombstone'i.**

### SOL-PRAC-01 — avaldamine arvestab aegunud, tühistatud või kustutatud retsensendi vana kinnitust — P1

**Tõend.** Retsenseerimise hetkel nõutakse aktiivset ja praktikaga sobiva skoobiga pädevust (`lib/effectivePractices.js:1250-1267`), kuid avaldamisel laaditakse kõik sama `contentVersion`-i review-read ning kontrollitakse ainult nende otsust ja rollinime (`:1383-1397`). Review'ga seotud pädevust ei loeta uuesti ega kontrollita `revokedAt`/`validUntil`/scope'i. Skeem seab retsensendi konto kustutamisel `reviewerId` väärtuseks `null` (`prisma/schema.prisma:2913-2933`), kuid madala riski ahel loeb sellise rea rolli endiselt täielikult; kõrge riski korral nõutakse elusat identiteeti ainult kahel REVIEWER-real, mitte EDITOR- ega ETHICS-kinnitusel. Olemasolev negatiivtest katab ainult kõrge riski kahe REVIEWER-inimese kao (`tests/effectivePractices/effectivePracticesService.test.js:536-553`). See on vastuolus tööpaketi väitega, et avaldamine kasutab ainult päris aktiivset pädevust (`docs/platvormi arendus/05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md:45-52`).

**Mõju.** Praktika saab avaldada pärast seda, kui ühe või kõigi sisuliste kontrollijate pädevus on aegunud/tühistatud või konto kustutatud. Avaldatud snapshot näitab professionaalse ülevaatuse rolle, kuigi avaldamishetkel pole nende taga enam kontrollitavat kehtivat kinnitajat.

**Vastuvõtukriteerium.** Avaldamistehing peab iga arvesse mineva viimase APPROVED otsuse puhul uuesti tõendama mitte-null retsensendi, aktiivse sama tüübi pädevuse ja praegusele praktikale sobiva skoobi; kehtetu otsus ei tohi READY/PUBLISH läve täita. Testida madalat ja kõrget riski, revoke'i, loomulikku aegumist, scope'i muutust ning reviewer/EDITOR/ETHICS konto kustutust enne publish'i.

**Seis (14.08.2026): DONE — avaldamine ja READY_TO_PUBLISH parandustöö arvestavad ainult sama versiooni APPROVED otsuseid, mille taga on avaldamishetkel elus retsensent, aktiivne sama tüübi pädevus ja praktikale sobiv skoop. Madala ja kõrge riski tabeltest katab revoke'i, aegumise, vale skoobi ning REVIEWER/EDITOR/ETHICS konto kao; päris PostgreSQL-i sond tõendab, et aegunud ETHICS-kinnitus ei loo versiooni ega avalda.**

### SOL-PRAC-02 — pädevuse loomulik aegumine või konto kustutus võib määratud ülevaatuse tähtajatult kinni jätta — P1

**Tõend.** Tööjärjekord kuvab ainult aktiivse pädevusega kasutajale tema praeguse versiooni ASSIGNED read (`lib/effectivePractices.js:1084-1111`, `:635-647`). Käsitsi REVOKE reassign'ib read kohe (`:1915-1948`), kuid `validUntil` loomulikul saabumisel ega retsensendi konto kustutamisel samaväärset hook'i pole. `repairAssignments()` oskab vigaseid/nullable määranguid parandada (`:1981-2166`), kuid repo seob selle ainult käsitsi CLI-käskudega ja deploy-eelse kontrolliga (`package.json:75-79`; `scripts/repair-effective-practice-assignments.mjs:1-22`); review-scheduler märgib üksnes tähtaja ületuse ega tee reassign'i (`lib/effectivePractices.js:941-1045`).

**Mõju.** Kandidaat või rakendamiskogemus võib jääda SUBMITTED/IN_REVIEW olekusse, kuid vana retsensent ei näe ega saa enam ülesannet lõpetada ning uus pädev kasutaja ei saa seda ilma administraatori käsitööta endale. Tähtajaliste pädevuste normaalne elutsükkel tekitab seega püsiva töövootupiku.

**Vastuvõtukriteerium.** Pädevuse aegumine/konto kustutus peab käivitama idempotentse reassign'i või perioodiline worker peab vigased määrangud piiratud ajaga parandama. Lahendus peab olema batch'itud, CAS-kaitsega ja auditeeritud; testida aegumist ilma deploy'ta, kustutatud kasutaja SetNull-rida, asendaja puudumist ning review-vs-repair võidujooksu päris PostgreSQL-is.

**Seis (14.08.2026): DONE — teavituste perioodiline job käitab nüüd piiratud partiiga määranguparandust, mis tuvastab loomuliku aegumise, revoke'i, vale skoobi, autori konflikti ja konto kustutuse SetNull-rea. Parandus kasutab CAS-i, jätab asendaja puudumise nähtavalt lahendamata ja kirjutab sisuvaba auditi; päris PostgreSQL-i lukusond mõõdab nii review-first kui repair-first järjekorra ilma topeltotsuse või topeltmääranguta.**

### SOL-PRAC-03 — kõvad 100/200/500 piirid peidavad praktikad, määratud tööd ja pädevused — P1

**Tõend.** Tööruum võtab enne filtreerimist ainult 200 uusimat avaldatud praktikat, 100 autori kandidaati, 100 enda rakendamiskogemust, 200 globaalset review-kandidaati ja 100 rakendamiskogemuse ülesannet (`lib/effectivePractices.js:1059-1115`). Otsing, maturity/environment filtrid ja sortimine rakenduvad avaldatud 200 reale alles mälus (`:1114-1117`, `:604-632`). Review-kandidaadid kärbitakse enne kasutaja assignment'i/skoobi filtrit; administraatori pädevusloend võtab 500 rida (`:1962-1978`). API ei võta cursorit ega tagasta `hasMore`/total välju (`app/api/effective-practices/route.js:15-31`) ja klient laeb ühe lehe (`components/covision/EffectivePracticesPage.jsx:474-499`).

**Mõju.** Otsing võib väita, et sobivat avaldatud praktikat pole, kuigi see asub 200 rea lõike taga. Omaniku vanem mustand ja retsensendi päriselt määratud uuem ülesanne võivad UI-st kaduda; administraator ei pruugi näha ega tühistada üle 500 piiri jäävat aktiivset pädevust.

**Vastuvõtukriteerium.** Filtrid ja prioriteedid tuleb rakendada andmebaasis ning kõik loendid peavad kasutama stabiilset cursor-paginatsiooni koos `hasMore` ja serveri tervikloenduritega. Assignment'i järjekord peab pärima otse `reviewerId` järgi, mitte lõikama esmalt globaalset kandidaadivalimit. Testida vähemalt 201 avaldatud/kandidaatrida, 101 isiklikku/assignment-rida ja 501 pädevust, kus ainus vaste jääb praeguse piiri taha.

**Seis (14.08.2026): DONE — avaliku kogu filtrid ja sortimine käivad nüüd andmebaasis ning praktika-, kandidaadi-, rakendamiskogemuse-, ülevaatus- ja pädevusloenditel on eraldi stabiilne cursor, `hasMore` ja serveri tervikloendur. Ülevaatusjärjekord lähtub otse kasutaja määrangust. Testid läbivad 201 avaldatud, 101 isiklikku ja määratud ning 501 pädevuse rida; päris PostgreSQL kinnitab otsingu, relation-count sortimise ja cursor-lepingu.**

### SOL-PRAC-04 — RAG-i saadetud praktikatekst jätab välja praktika tõendus- ja õppimisaluse — P1

**Tõend.** Avaldatud muutmatu snapshot sisaldab `expectedOutcome`, `learningPoints` ja `sources` välju ning avalik detail näitab neid kasutajale (`lib/effectivePractices.js:400-424`, `:458-490`; `components/covision/EffectivePracticesPage.jsx:414-417`). `ragText()` koostab aga ainult pealkirja, kokkuvõtte, sobiva konteksti, tingimused, piirangud, sammud, sihtrühmad ja keskkonnad; tulemus, õppimisalus ning allikad puuduvad täielikult ja kogu tekst lõigatakse 16 000 märgi pealt (`lib/effectivePractices.js:2251-2261`). Just see kärbitud tekst saadetakse `evidence_role:"practice_guidance"` dokumendina RAG-i (`:2264-2301`).

**Mõju.** AI võib leida ja edasi anda tööviisi juhise ilma infota, millele see tugineb, mida tegelikult saavutati või milline õppimine seda toetab. Kasutajaliideses kontrollitav tõenduskiht ei jõua samasse teadmisteallikasse, mis vastuseid genereerib.

**Vastuvõtukriteerium.** RAG-dokument peab sisaldama eraldi struktureeritud osadena vähemalt allikaid, õppimispunkte ja oodatavat/tegelikku üldistatud tulemust ning kärbe peab olema väljade kaupa teadlik, mitte kogu dokumendi pime lõpp-lõige. Integratsioonitest peab ingestima unikaalsed markerid igasse tõendusvälja ja tõendama nende olemasolu RAG-i salvestatud tekstis ning otsingutulemuses.

**Seis (14.08.2026): DONE — RAG-tekst on väljade kaupa eelarvestatud struktureeritud dokument, milles säilivad tulemus, õppimispunktid, allikad ja tõendus koos konteksti ning piirangutega; kogu dokumendi pime lõpp-lõige eemaldati. Ingest/search adapteri integratsioonitest kasutab igas tõendusväljas unikaalset markerit ja leiab need nii saadetud tekstist kui otsingutulemusest.**

### SOL-PRAC-05 — serveri „isikustamata” kontroll tunneb ainult kolme tüüpi otsest identifikaatorit — P1

**Tõend.** UI autori kinnitus ütleb, et kandidaat ei sisalda klienti, last, perekonda ega konkreetset juhtumit tuvastavaid detaile (`components/covision/EffectivePracticesPage.jsx:351-353`). Serveri automaatkontroll liidab küll kõik avaldatavad väljad, kuid tuvastab ainult e-posti, piiratud Eesti telefoninumbrikuju ja 11-kohalise Eesti isikukoodi (`lib/effectivePractices.js:184-220`). Nimi koos ametikoha/KOV-iga, aadress, asutus, juhtuminumber, välismaa telefon või muud kaudsete tunnuste kombinatsioonid läbivad automaatvärava; pärast ETHICS rolli APPROVED otsust loetakse sama versioon avaldamiskõlblikuks (`:1340-1362`, `:1399-1405`).

**Mõju.** Ekslik autori linnuke ja inimliku ülevaatuse möödalask võivad avaldada konkreetse juhtumi tuvastatava kirjelduse ning saata selle püsiva versioonina RAG-i. Tehniline värav ja UI sõnastus annavad laiemast kaitsest tugevama mulje, kui kood tegelikult rakendab.

**Vastuvõtukriteerium.** Sõnastada ausalt, milline kontroll on automaatne ja milline inimese vastutus, ning lisada riskipõhine PII/juhtumiviidete kontroll vähemalt nimede, aadresside, asutuse+haruldase sündmuse, juhtuminumbrite ja rahvusvaheliste kontaktide jaoks. Kõrge riski või ebakindla tulemuse korral peab avaldamine fail-closed jääma käsitsi põhjendatud privaatsusotsuseni; negatiivkorpus peab sisaldama nii otseseid kui ka kaudseid re-identifitseerimise näiteid.

**Seis (14.08.2026): DONE — serveri riskiklassifikaator blokeerib e-posti, Eesti ja rahvusvahelise telefoni, isikukoodi, aadressi ning juhtuminumbri; nimekontekst ja asutuse-haruldase sündmuse kombinatsioon nõuavad enne avaldamist ETHICS-rolli püsivat põhjendatud privaatsusotsust. UI ütleb kolmes keeles, et automaatkontroll toetab, kuid ei asenda inimese vastutust; negatiivkorpus katab otsesed ja kaudsed taasidentifitseerimise näited.**

### SOL-PRAC-06 — pikem professionaalne sisu kärbitakse salvestamisel vaikides — P1

**Tõend.** `normalizeText()` ja `normalizeShort()` kasutavad sisendi tagasilükkamise asemel `slice()`-i ning `normalizeList()` lõpetab vaikides maksimaalse elementide arvu juures (`lib/effectivePractices.js:69-93`). Kandidaadi vabatekstid lõigatakse 8 000 märgini, pealkiri 180-ni ning listid 12–32 elemendi ja 80–500 märgi piiridesse (`:135-180`); rakendamiskogemuse väljad lõigatakse 2 000/4 000 märgini (`:1618-1643`, `:1684-1708`). Kliendi textarea'del/input'idel pole vastavaid `maxLength`/loendipiire ega kärpimishoiatust (`components/covision/EffectivePracticesPage.jsx:287-378`).

**Mõju.** Salvestus raporteerib edu, kuid piirangu lõpp, oluline risk, allikaviide või rakendamiskogemuse järeldus võib DB-st kaduda. Autor ja retsensent võivad seejärel kinnitada poolikut teksti teadmata, et algne sisend oli pikem.

**Vastuvõtukriteerium.** Server peab üle piiri sisendi stabiilse 400/413 veaga tagasi lükkama või tagastama väljade kaupa selge truncation-tulemuse, mida kasutaja teadlikult kinnitab; vaikne kärbe pole lubatud. UI peab näitama limiite ja allesjäänud mahtu. Testida iga välja/listi piir-1, piir ja piir+1 väärtusi ning tõendada, et ükski edukas vastus ei ole sisendist vaikides erinev.

**Seis (14.08.2026): DONE — kandidaadi ja rakendamiskogemuse serveriteed tagastavad üle piiri sisendile stabiilse `INPUT_LIMIT_EXCEEDED` 400 koos välja ja limiidiga; teksti ega listi ei kärbita enam edukas vastuses. UI näitab teksti allesjäänud mahtu ning listi rea- ja elemendipiire. Tabeltest katab kandidaadi iga teksti/listi ja rakendamiskogemuse iga välja piir-1, piir ning piir+1 väärtusega nii loomisel kui uuesti esitamisel.**

### SOL-PRAC-07 — RAG-i taastetöödel puudub repos tõendatud automaatne käivitaja — P1, runtime NOT_PROVEN

**Tõend.** Avaldamise ingest'i tõrge loob püsiva `RAG_INGEST` töö ning re-review/kinnitatud riski korral tekib `RAG_DELETE` töö (`lib/effectivePractices.js:746-939`, `:1500-1601`, `:1777-1807`). Neid töötleb `scripts/drain-effective-practice-rag-deletions.mjs`, kuid repo pakub sellele ainult käsitsi npm-käsud (`package.json:77-78`); `.github`, `app` ja `lib` ulatuses pole sellele cron-route'i, queue-consumer'it ega ajastatud väljakutset. Dokumenteeritud deploy-järjekord käsib drain'i üks kord enne avamist käsitsi käivitada (`docs/platvormi arendus/05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md:231-239`). Tootmisserveri väline systemd/cron seadistus selles auditis ei olnud kontrollitav, seega runtime on `NOT_PROVEN`.

**Mõju.** Pärast deploy'd tekkinud ingest'i tõrge või aegunud/riski tõttu eemaldatav praktika võib jääda pending/failed olekusse määramata ajaks. Esimesel juhul ei jõua avaldatud praktika RAG-i; teisel juhul võib mitteavalikuks muudetud juhis RAG-is edasi elada, kuni keegi CLI käsitsi käivitab.

**Vastuvõtukriteerium.** Taastetöödel peab olema repos või infrastruktuurina versioonitud perioodiline käivitaja, single-run lukk, due-job claim, bounded batch, backoff/dead-letter, tervisemõõdik ja alarm. Katkestustest peab tõendama nii ingest'i kui delete'i automaatse lõpptulemuse pärast teenuse taastumist, ilma deploy või käsikäsuta.

**Seis (14.08.2026): DONE — viieminutiline notification systemd service/timer on nüüd repos versioonitud ja käitab piiratud partiiga RAG-taastet: advisory-lukuga claim, aegunud claim'i ülevõtt, eksponentsiaalne backoff, `dead_letter`, terviseloendurid ning 207/systemd failed-alarm. Ühiktest katab batch'i, claim'i, backoff'i, dead-letter'i ja pooleli jäänud processorit; päris PostgreSQL-i katkestussond viib nii ingest'i kui delete'i pärast teenuse taastumist lõpuni ja eemaldab vana RAG-viite. Serveris kontrolliti timer `enabled` + `active`, viieminutiline unit ja edukas journalijooks.**

### SOL-PRAC-08 — ülevaatustähtaja möödumine ei käivita uut kontrolli ega eemalda aegunud juhist RAG-ist — P1

**Tõend.** Review-scheduler loob tähtaja saabudes ainult append-only `REVIEW_DUE` auditimarkeri; kommentaar nimetab teavituskanalit eraldi tulevikutööks (`lib/effectivePractices.js:941-1003`). Teavituste reconciler loob sündmusi üksnes olemasolevatele review-assignment'idele, mitte `REVIEW_DUE` markerile ega ETHICS/APPROVER pädevusega adressaatidele (`lib/notificationReconciler.js:152-159`). Praktika jääb `PUBLISHED` olekusse, avalik serializer lisab vaid `reviewOverdue:true` lipu (`lib/effectivePractices.js:458-490`) ning RAG-viidet ei kustutata; uue kontrolli saab käivitada ainult ETHICS kasutaja käsitsi detailvaates (`components/covision/EffectivePracticesPage.jsx:443`).

**Mõju.** Aegunud professionaalne juhis võib jääda avalikku kogusse ja AI teadmistebaasi tähtajatult. Keegi ei saa sihitud ülesannet ega teadet, mistõttu avaliku kaardi hoiatus aitab ainult kasutajat, kes praktika ise üles leiab, kuid RAG-vastuse tarbija ei näe seda hoiatust.

**Vastuvõtukriteerium.** Tähtaja saabumine peab looma ühe idempotentse omaniku/ETHICS tööülesande ja teavituse ning määrama selge grace-period'i järel praktika/RAG-i staatuse (näiteks `RE_REVIEW` + durable delete või otsingus tugev aegumismärgis). Testida scheduler → assignment/notification → RAG nähtavuse jada, adressaadi pädevuse aegumist, kordusjooksu ja taastamist pärast worker'i viga.

**Seis (14.08.2026): DONE — tähtaja saabumine loob ühe aktiivse ja skoobitud ETHICS-ülesande, mille olemasolev reconciler muudab idempotentseks teavituseks; aegunud pädevus ei saa ülesannet ning kordusjooks ei dubleeri seda. 14-päevase grace-period'i järel liigub praktika CAS-iga `RE_REVIEW` olekusse, vana tsükli ülesanded suletakse, uus rollitsükkel luuakse ja durable RAG_DELETE eemaldab aegunud juhise. Päris PostgreSQL-i 23/23 jadasond katab scheduler → assignment → notification → grace → RAG-taaste terviktee.**

### SOL-SEED-01 — Kovisioonis, järelvaates ja suletud seemned muutuvad Teemaseemnete UI-s uuesti mustanditeks — P1

**Tõend.** Serveri enum ja hilisemad Kovisiooni üleminekud kasutavad viit olekut `DRAFT`, `WAITING`, `IN_COVISION`, `FOLLOW_UP`, `CLOSED` (`prisma/schema.prisma:340-346`; `lib/covisionSession.js:551-600`). Kliendi `toCardSeed()` teisendab aga ainult WAITING oleku `ootel`-iks ning iga muu serverioleku tingimusteta `mustand`-iks (`components/teemaseeme/TeemaseemnedPage.jsx:161-213`). Mustandina kuvatud kaardile lisatakse queue-, edit- ja ettevalmistusnupud (`:924-965`), kuigi server lubab PATCH-i ainult DRAFT-ile ja queue update'i `status:"DRAFT"` tingimusel (`lib/topicSeeds.js:318-353`, `:372-411`). Filtrite `valitud` ja `jarelvaates` loendurid ei saa seetõttu nende päris DB-olekute põhjal kunagi täituda (`components/teemaseeme/TeemaseemnedPage.jsx:98-117`, `:468-478`).

**Mõju.** Aktiivne või lõpetatud Teemaseeme näib kasutajale uuesti privaatse mustandina. Pakutud „muuda” ja „lisa järjekorda” toimingud lõpevad serveri 409-ga; olekufiltrid ning elutsüklipilt räägivad andmebaasist erinevat tõde.

**Vastuvõtukriteerium.** Kõigil viiel serverioleku väärtusel peab olema üks kanooniline kliendikaardistus, silt, filter ja lubatud toimingute maatriks. `IN_COVISION` peab avama seotud sessiooni, `FOLLOW_UP` õige järelvaate ning `CLOSED` ainult lubatud read-only ajaloo. Testida päris API payload iga olekuga ja tõendada, et ükski terminalne/aktiivne rida ei saa DRAFT-toiminguid.

**Seis (13.08.2026): DONE —** kõik viis `TopicSeedStatus` olekut kasutavad üht kanoonilist olekukaarti, mille järgi renderdatakse silt, filter ja lubatud toimingud. `DRAFT` lubab muuta, järjekorda lisada ja kustutada; `WAITING` vaadata ja tagasi võtta; `IN_COVISION` avab seotud Kovisiooni, `FOLLOW_UP` järelvaate ning `CLOSED` on read-only ajalugu. Sihttestid 118/118; autenditud lokaalne brauser kontrollitud API-fixtuuriga näitas kõiki viit olekut ja nende eristuvaid toiminguid (`runtime: local_browser_run`, kontrollitud sünteetiline vastus).

### SOL-SEED-02 — omanik ei saa tundlikku mustandit kustutada ega WAITING üldistust tagasi võtta — P1

**Tõend.** TopicSeed API pakub ainult list/create, DRAFT PATCH-i, queue't ja Kovisiooni alustamist; DELETE-, archive-, withdraw- või unqueue-route puudub (`app/api/topic-seeds/**`; `lib/topicSeeds.js:289-411`). UI DRAFT- ja WAITING-kaartidel puudub samuti kustutamise/tagasivõtmise tegevus (`components/teemaseeme/TeemaseemnedPage.jsx:924-965`, `:1709-1804`). Toote alus lubab omanikul mustandi kustutada ja elemendi pärast kasutamist kustutatavaks märkida (`Kovisioon/teemaseeme-professionaalne-funktsioon.md:138-149`, `:1926-1946`). Skeemis on TopicSeed kasutajakonto suhtes Cascade, mistõttu ainus koodis tõendatud lõplik kustutustee on kogu konto kustutamine (`prisma/schema.prisma:2453-2478`).

**Mõju.** Ekslikult loodud või hiljem tundlikuks osutunud juhtumiseeme jääb kasutaja kontole määramata ajaks. Kord WAITING-uks külmutatud üldistust ei saa enne Kovisiooni loomist järjekorrast eemaldada, isegi kui anonüümsuskinnitus või professionaalne otsus oli vale.

**Vastuvõtukriteerium.** Lisada owner-only, auditeeritud ja versioonikindel DRAFT delete ning WAITING withdraw/archive rada; seotud `IN_COVISION` või hilisemaid objekte ei tohi pimesi kustutada. UI peab enne pöördumatut toimingut näitama täpset mõju. Testida DRAFT kustutust, WAITING tagasivõttu, start-vs-withdraw võidujooksu, seotud juhtumi kaitset ja konto kustutuse retentsioonireeglit.

**Seis (13.08.2026): DONE —** omanik saab versioonikindlalt kustutada ainult sidumata `DRAFT`-seemne ning viia ainult sidumata `WAITING`-seemne tagasi privaatsesse `DRAFT`-olekusse. Mõlemad toimingud on transaktsioonilised ja auditeeritud; seotud ja hilisemates olekutes seemned on kaitstud. PostgreSQL-i sond tõendas auditi rollback'i, start/withdraw võistluse ühe võitjaga, sisurea kustumise ja sisuta auditikviitungi säilimise pärast konto kustutamist.

### SOL-SEED-03 — Kovisiooni mineva üldistuse isikustamatust tõendab ainult kliendi linnuke — P1

**Tõend.** Queue-route normaliseerib ainult `expectedUpdatedAt` ja boolean `confirmedNoIdentifiers`; teenus kontrollib, et väärtus on `true`, kuid ei analüüsi pealkirja, `whyNow` teksti ega muid külmutatavaid välju ühegi identifikaatori suhtes (`lib/topicSeeds.js:101-119`, `:360-411`). UI kinnitustekst keelab nime, isikukoodi, täpse aadressi ja muu otsese tuvastaja (`components/teemaseeme/TeemaseemnedPage.jsx:1772-1790`). Külmutatud `whyNow` kopeeritakse seejärel Kovisiooni `summary` ja `anonymizedDescription` väljadesse ning `anonymityConfirmedAt` seatakse sama linnukese aja järgi (`lib/covisionSession.js:294-316`).

**Mõju.** Üks ekslik kinnitus võib muuta nime, aadressi, isikukoodi või haruldase juhtumikirjelduse serveri silmis „anonüümseks” ning viia selle osalejatele jagatavasse Kovisiooni. Hilisem session-serializer ja töövoog usaldavad vale anonüümsusfakti.

**Vastuvõtukriteerium.** Enne WAITING üleminekut peab server tegema kõigi snapshot-väljade riskikontrolli ja eristama automaatset leidu inimese kinnitusest; otsene identifikaator peab ülemineku blokeerima ning kaudne/ebakindel juhtum nõudma teadlikku parandust või eraldi privaatsuskontrolli. Testikorpus peab sisaldama e-posti, Eesti ja välismaa telefoni, isikukoodi, nime, aadressi, juhtuminumbrit ning haruldaste tunnuste kombinatsiooni.

**Seis (13.08.2026): DONE —** enne `DRAFT → WAITING` üleminekut töötab serveripoolne deterministlik privaatsuse eelsõel. E-post, Eesti või välismaa telefon, kehtiv isikukood, nimi, täpne aadress ja juhtuminumber blokeeritakse; haruldaste kaudsete tunnuste kombinatsioon nõuab tavakinnitusest eraldi inimese privaatsusülevaadet. Püsivasse tõendisse lähevad ainult kategooriakoodid, mitte leitud isikuandmed. Negatiivkontroll tõendas, et vana rada lubas e-posti sisaldava seemne edasi.

### SOL-SEED-04 — `updatedAt`-põhine optimistlik lukk võib sama millisekundi kirjutused kokku lasta — P2

**Tõend.** PATCH ja queue kasutavad ainsa versioonifingerprint'ina `updatedAt` aega ning tingimuslikku `updateMany` päringut (`lib/topicSeeds.js:318-353`, `:372-411`). TopicSeed migratsioon salvestab selle välja `TIMESTAMP(3)` täpsusega ehk ainult millisekundini (`prisma/migrations/20260714040000_topic_seed/migration.sql:21`). Eraldi integer-versioni ega kliendi idempotentsusvõtit pole. Olemasolevad ordering-testid muudavad fake-DB aega järjestikku, kuid ei kata kaht sama millisekundi write'i (`tests/topicSeeds/topicSeedsService.test.js:442-493`).

**Mõju.** Kaks kiiret/paralleelset PATCH-i võivad sama fingerprint'i all mõlemad õnnestuda ja viimane kirjutus esimese välja üle. PATCH-vs-queue võidujooksus võib queue külmutada enne patch'i loetud vana snapshot'i, kuigi DB ülemised väljad sisaldavad juba teist väärtust.

**Vastuvõtukriteerium.** Lisada monotoonne integer `version` ja kasutada seda kõigi muutvate päringute CAS-is; `updatedAt` jäägu kuvamisajaks. Kahe päris DB-ühendusega test peab sundima sama algversiooni PATCH-vs-PATCH ja PATCH-vs-queue järjekorrad ning tõendama täpselt ühe võitja ja snapshot'i vastavuse võitnud sisule.

**Seis (13.08.2026): DONE —** TopicSeed kasutab monotoonset täisarvulist `version` CAS-i; `updatedAt` on ainult kuvamise metaandmed. Muutmine, järjekorda lisamine, Kovisiooni alustamine ja järjekorrast eemaldamine nõuavad oodatud versiooni ning edukas mutatsioon suurendab seda. PostgreSQL-i sond tõendas PATCH/PATCH, PATCH/queue, queue/PATCH, start/withdraw ja withdraw/start võistlustes täpselt ühe võitja; vana millisekundipõhise fingerprint'i negatiivkontroll lubas mõlemad kirjutajad läbi.

### SOL-SEED-05 — omaniku kogu Teemaseemnete ajalugu laaditakse ühe piiritlemata vastusena — P2

**Tõend.** `listTopicSeeds()` pärib kõik kasutaja read `findMany` abil, ainsa tingimuse ja järjestusega, kuid ilma `take`, cursor'i või olekupõhise prioriteedita (`lib/topicSeeds.js:289-296`). GET-route tagastab kogu massiivi (`app/api/topic-seeds/route.js:27-37`) ning nii Teemaseemnete leht kui Kovisiooni tööruum laadivad selle tervikuna ühe fetch'iga (`components/teemaseeme/TeemaseemnedPage.jsx:216-249`; `components/covision/CovisionWorkspace.jsx:58-81`). Iga rida võib sisaldada nii top-level `whyNow` kui ka sama tekstiga JSON snapshot'i.

**Mõju.** Pika kasutusajaloo korral kasvavad päring, JSON, brauserimälu ja renderdamine piiritlemata; Kovisiooni tööruumi avamine muutub aeglaseks ka siis, kui vaja on ainult mõnda WAITING seemet. Vastupidiselt kõva kärpega loenditele ei kao siin read vaikides, kuid üks suur konto võib põhjustada käideldavusprobleemi.

**Vastuvõtukriteerium.** Teemaseemnete põhileht peab kasutama stabiilset cursor-paginatsiooni ja serveri loendureid; Kovisiooni queue peab pärima eraldi ainult `status=WAITING AND covisionCaseId=null` minimaalse snapshot-projektsiooniga. Koormustestida vähemalt kümneid tuhandeid seemneid ning kontrollida vastuse suurust, päringuaega ja brauseri renderduse piiri.

**Seis (13.08.2026): DONE —** omaniku ajaloo API kasutab piiratud cursor-paginatsiooni, serveripoolseid olekuloendureid ja stabiilset `updatedAt,id` järjestust; Kovisioonil on eraldi ainult sidumata `WAITING`-seemnete minimaalne järjekorra-API. PostgreSQL-i sond 20 005 reaga tõendas alla 64 KiB vastused, alla viie sekundi päringud ja duplikaadivabad cursor-lehed. Brauser renderdas algul 24 ja järgmise lehe järel 48 kaarti (`runtime: local_browser_run`, kontrollitud sünteetiline vastus).

### SOL-JOUR-01 — eelpöördumise teine jagamisvalik ei juhi tegelikult salvestatavat ega saadetavat teksti — P0

**Tõend.** Teekonna detaili esimene valik saadab `shareKeys` serveri prefill-route'ile ja praegune `buildPreInquiryPrefillFromJourney()` rakendab sellele fail-closed allowlist'i (`components/journey/JourneyDetail.jsx:473-560`, `app/api/journeys/[id]/pre-inquiry-draft/route.js:40-60`, `lib/journey/preInquiryHandoff.js:121-203`). Eelpöördumise vaates ilmub aga teine jagamisvalik oma püsiva vaikehulgaga `summary, domains, personWish, missingInfo`, mitte serverist saadud `confirmedKeys` järgi (`components/workspace/WorkspaceFeaturePage.jsx:842`, `:1191-1247`, `:2257-2295`). Selle teise valiku filter muudab ainult `assessmentState.sharedJourneyInfo` koopiat; `situation`, `topic` ja `userEditedDraft` jäävad algse prefill'i kujule ning lähevad POST-i muutmata (`:564-578`, `:1517-1543`). Ka `confirmedKeys` jääb filtri järel algseks manifestiks. Kanooniline T06 leping nõuab üht läve, kus valik muudab kogu payload'i ja eelvaade võrdub serveri saatmisprojektsiooniga (`docs/platvormi arendus/fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md:109-120`, `:264-270`). Praegune 45-testine kogum kontrollib puhast esimese prefill'i funktsiooni ja lähtekoodi markerite olemasolu, mitte teise valiku → salvestus → adressaadi projektsiooni jada (`tests/journey/preInquiryHandoffContract.test.js:51-106`, `tests/journey/authorFlowUiContract.test.js:21-29`).

**Mõju.** Kasutaja võib teisel, vahetult enne adressaadi valikut nähtaval ekraanil kokkuvõtte või kolmanda isiku info valiku eemaldada, kuid sama tekst jääb olukorra- ja kirjamustandisse ning võib pärast tavalist eelvaadet adressaadile minna. Samal ajal võib talletatud manifest väita muud valikuhulka kui tekst tegelikult sisaldab. Üldine PII-kontroll ei asenda konkreetse jagamisnõusoleku jõustamist.

**Vastuvõtukriteerium.** Jagamisvalikuid peab olema täpselt üks või viimane valik peab olema serveris autoriteetne. Kõik püsivad väljad (`topic`, `situation`, mustandid, `assessmentState.sharedJourneyInfo`) tuleb koostada samast lõplikust serveriprojektsioonist ning `confirmedKeys` peab kirjeldama täpselt seda projektsiooni. Kahe autentitud konto markeritest peab iga valikukombinatsiooni puhul tõendama, et ükski eemaldatud marker ei esine loodud reas ega adressaadi GET-vastuses.

**Seis (10.08.2026): DONE.** Valitud on kriteeriumi TEINE haru: valikuid jääb kaks, aga
viimane on serveris autoriteetne.

- **Iga muutus küsib serverilt uue projektsiooni** (`refreshJourneyProjection`) ja KÕIK
  püsivad väljad — `topic`, `situation`, kirjamustand, omavalitsus,
  `assessmentState.sharedJourneyInfo` — ehitatakse sellest ühest vastusest.
- **Kliendipoolne filter on KUSTUTATUD.** `filterJourneySharedInfoForPreInquiry()` oli
  kolmas tõde: ta kitsendas manifesti, aga `situation` ja mustand jäid laiemaks. Ta on ära,
  mitte parandatud — kaks tõde on halvem kui üks.
- **Linnukesed tulevad serveri `confirmedKeys`-ist, mitte püsivast vaikehulgast.** Vana
  `["summary", "domains", "personWish", "missingInfo"]` oli kahekordselt vale: ta VÄITIS
  valikut, mida kasutaja ei olnud teinud, ja tema võti `personWish` ei kuulunud isegi
  serveri sõnavarasse (`wish`) — linnuke ei vastanud ühelegi päris väljale. Sama vaikehulk
  seisis veel kahes kohas (uus eelpöördumine, avatud eelpöördumine); mõlemad parandatud:
  uuel ei ole valikut üldse, avatul on see, mis TEMA juures salvestatud on.
- **Valida saab ainult esimese lävi kinnitatud võtmete seast** — teine ekraan tohib
  KITSENDADA, mitte laiendada.
- **Hiline vastus ei kirjuta uuemat valikut üle** (request-ID kontroll) — SOL-WB-14 klass,
  mida siia sisse ei lastud.

**Tõend (päris brauser, päris sessioon `ai.client@sotsiaalai.test`, Teekond markertekstidega).**
`?share=summary,domains,missingInfo,wish` → ekraanil neli linnukest, kõik serveri sõnavarast
(„inimese soov", mitte vana `personWish`). „Olukorra kokkuvõte" maha → `MARKERSUMMARY` kadus
KOGU lehelt ja kirjamustandist; ülejäänud kolm markerit jäid.
**Salvestatud rida andmebaasist:** `MARKERSUMMARY` puudub (`false`), `confirmedKeys =
["domains","missingInfo","wish"]`, `sharedJourneyInfo.summary = ""` ja `userEditedDraft`
sisaldab ainult kolme alles jäänud markerit. See on kriteeriumi „ükski eemaldatud marker ei
esine loodud reas" — mõõdetuna, mitte tuletatuna.

**Testid.** `tests/journey/journeyShareProjection.test.js` (uus, 6 testi): igal
jagamisvõtmel on unikaalne marker ja testid nõuavad, et eemaldatud võtme marker ei esine
MITTE KUSAGIL vastuses — nii ei sõltu test sellest, millisesse välja tekst juhtub kokku
pandama. Kaetud ka tundmatu võti (fail-closed), tühi valik ja `confirmedKeys` täpsus.

**runtime osaliselt:** kahe konto ristkontrolli ei tehtud — jagamisprojektsioon ei sõltu
teisest kontost (ta loeb ainult kutsuja enda Teekonda, `getJourneyForUser`), seega teise
konto lisamine mõõdaks omanikuskoopi, mis on juba mujal kaetud.

### SOL-JOUR-02 — seadmesse salvestatud tundlik Teekonna mustand võib samas vahekaardis järgmisele kontole taastuda — P0

**Tõend.** Teekonna kirjeldus ja kogu struktureeritud mustand kirjutatakse globaalse sama-origin võtme `sotsiaalai:journey-v1:draft` alla ning taastatakse komponendi mount'imisel ilma kasutaja ID, sessiooniversiooni või rolli kontrollita (`components/journey/JourneyDashboard.jsx:39-40`, `:477-495`). Kogu repos on selle võtme eemaldajad ainult edukas salvestus ja kasutaja teadlik katkestamine (`:547-574`, `:616-626`); väljalogimine ja konto vahetus seda võtit ei puhasta. `sessionStorage` elab vahekaardi eluea, mitte konto eluea järgi.

**Mõju.** Kui kasutaja A logib samas vahekaardis välja ja kasutaja B sisse, võib B-le taastuda A tundlik olukirjeldus, riskisignaalid, kolmanda isiku kontekst ja järgmised sammud. See on otsene kontodevaheline andmeleke ühiskasutatavas seadmes, kuigi serveri Journey-read ise on korrektselt omanikuskoobitud.

**Vastuvõtukriteerium.** Mustandivõti peab olema seotud vähemalt stabiilse kasutaja ID ja sessioonikontekstiga; identiteedi muutumisel ei tohi eelmise identiteedi mustandit lugeda ning vana võti tuleb turvaliselt eemaldada. Kahe konto brauseritest peab tõendama logout/login, rollivahetuse, aegunud sessiooni ja vahekaardi taastamise negatiivjuhud.

**Seis (13.08.2026): DONE —** Teekonna kohalik mustand on kasutaja ID-ga omanikuskoobitud, omanikuta seade on lukus ning vana sildistamata rida kustutatakse. Sama vahekaardi brauserirada tõendas sünteetiliste kontodega, et A mustand taastus ainult A-le; serveripoolne sessiooni tühistamine, väljalogimine ja taaslaadimine ei näidanud seda B-le; CLIENT → SOCIAL_WORKER rollivahetus ei näidanud kliendimustandeid ning CLIENT-i naasmine ja vahekaardi taastamine tõid tagasi ainult B enda mustandi. Mõlemad sessioonid tühistati ja testandmed koristati; tootmisandmeid ei kasutatud (`runtime: local authenticated browser`).

### SOL-JOUR-03 — salvestusnormaliseerija hävitab Teekonna struktureeritud konteksti — P1

**Tõend.** Mustand loob `context.assistiveDevices` ja `context.activityLog` väljadele objektimassiivid (`lib/journey/draft.js:219-261`). `normalizeContext()` suunab iga massiivi üldisesse stringiloendi normaliseerijasse, mis rakendab objektile `String(value)` ning jätab tulemuseks `[object Object]`; pesastatud objektidest säilib ainult üks madal skalaar-/stringimassiivi kiht (`lib/journey/validation.js:37-56`, `:84-115`). Sama normaliseerija käib nii loomisel kui kogu `context`-i PATCH-il (`:117-150`, `:184-188`). Auditijooksu in-memory kontrollis muutus kahe detailse abivahendi massiiv väärtuseks `["[object Object]"]` ning algne tegevusobjekt samaks stringiks enne DB-kutset.

**Mõju.** Kasutajale eelvaates näidatud abivahendi nimi, seis, kasutuskontekst, tugivajadus ja seosed ei salvestu esitatud kujul. Hilisem loogika peab neid vabatekstist uuesti oletama; tegevusajalugu muutub rikutud stringiks ning järgmine konteksti salvestus võib rikkuda veel säilinud struktuuri.

**Vastuvõtukriteerium.** `context` peab omama versioonitud, väljade kaupa skeemi ja sügavuselt teadlikku normaliseerimist; objektimassiive ei tohi stringistada. Round-trip test peab võrdlema draft → create-normalize → serialize → update-normalize tulemust assistiveDevices, activityLog, helpMediation ja serviceContinuity täisstruktuuridega ning keelama `[object Object]` väärtuse kogu payload'is.

**Seis (13.08.2026): DONE —** Teekonna `context` kasutab versioonitud `schemaVersion: 1` lepingut ja väljade kaupa sügavusteadlikku normaliseerimist. `assistiveDevices`, `activityLog`, `helpMediation` ja `serviceContinuity` objektid ning objektimassiivid säilivad draft → create-normalize → serialize → update-normalize ringis; mitteskalaarsed väärtused ei muutu tekstiväljades `[object Object]` väärtuseks. Tõend: `tests/journey/contextRoundTrip.test.js`; DB-sondi ega brauserit ei ole vaja, sest invariant on deterministlikus DB-eelses normaliseerimises.

### SOL-JOUR-04 — tavaline detailvaate salvestus kustutab soovitatud tegevuste masinloetavad tüübid — P1

**Tõend.** Detailvorm teisendab `suggestedActions` objektid ainult pealkirjadeks ja salvestamisel loob iga rea uuesti kujul `{ title }`, jättes ära `type` ja `description` (`components/journey/JourneyDetail.jsx:95-115`, `:842-862`). Handoff'id kasutavad aga tegevuse `type` väärtusi, et avada teenusekaart või tervisekontakti rada (`lib/journey/serviceMapHandoff.js:61-72`, `lib/journey/healthContact.js:37-50`). Server aktsepteerib kadunud tüüpideta massiivi edukalt (`lib/journey/validation.js:58-81`, `:184-188`).

**Mõju.** Kasutaja võib muuta ainult pealkirja või kokkuvõtet, kuid sama „Salvesta” kustutab kõigi järgmiste sammude tüübid ja kirjeldused. Osa hilisemaid tööriistakaarte või handoff'e võib seejärel kaduda või sõltuda juhuslikust vabateksti tuletusest.

**Vastuvõtukriteerium.** Redigeerimisvorm peab säilitama muutmata tegevuste ID/type/description väljad või server peab rakendama väljade kaupa patch'i olemasolevale struktuurile. Regressioonitest peab muutma ainult pealkirja ning tõendama, et kõik tegevuste tüübid ja kirjeldused jäävad bititäpselt alles.

**Seis (13.08.2026): DONE —** detailvaate salvestus seob redigeeritud pealkirjaread olemasolevate tegevusobjektidega. Ainult pealkirja muutmisel säilivad `id`, `type` ja `description`; muutmata tegevused säilitavad kogu masinloetava struktuuri ning uus rida ei päri teise tegevuse metaandmeid. Serveri normaliseerija säilitab ka tegevuse ID. Tõend: `tests/journey/suggestedActionEditing.test.js`.

### SOL-JOUR-05 — kaks nähtavat Teekonna toimingut kirjutavad vana kliendiseisu konfliktita üle — P1

**Tõend.** Detaili põhisalvestus, arhiveerimine ja taasavamine saadavad `expectedUpdatedAt`, kuid teenuse jätkumise vormi PATCH seda ei saada ning postitab kogu brauseris oleva `context`-snapshot'i koos riskide, puuduva info ja tegevustega (`components/journey/JourneyDetail.jsx:842-924`, `:947-1008`). Ka loendikaardi arhiveerimine saadab ainult `{status:"ARCHIVED"}` (`components/journey/JourneyDashboard.jsx:582-606`). Teenus teeb kliendi versioonikontrolli ainult siis, kui `expectedUpdatedAt` on antud; ilma selleta loeb ta päringu alguses värske rea ning peab vana kliendi payload'i kehtivaks (`lib/journey/service.js:162-205`).

**Mõju.** Teises vahekaardis või seadmes tehtud uuem muudatus võib kaduda, kui vanema detailvaate kasutaja salvestab teenuse jätkumise kontrolli. Loendist arhiveerimine võib omakorda õnnestuda kasutajale teadmata pärast seda, kui detaili sisu on mujal muutunud. Serveri tehing kaitseb ainult oma lugemise ja kirjutamise vahelist võidujooksu, mitte stale kliendi eest.

**Vastuvõtukriteerium.** Kõik Journey PATCH-id peavad nõudma kehtivat versiooni/`expectedUpdatedAt` väärtust ja tagastama puuduva või vana versiooni korral 409. Päris PostgreSQL-i kahe kliendi test peab katma edit-vs-continuity, edit-vs-archive ja continuity-vs-continuity järjestused ning lubama ainult ühe sama algversiooni võitja.

**Seis (13.08.2026): DONE —** kõik Journey PATCH-id nõuavad kliendile nähtavat `expectedUpdatedAt` versiooni; puuduv, vigane, aegunud või võistluse kaotanud versioon annab 409. Detaili teenuse jätkumise salvestus ja loendikaardi arhiveerimine saadavad versiooni kaasa. Päris PostgreSQL-i sond tõendas edit-vs-continuity, edit-vs-archive ja continuity-vs-continuity võistlustes iga kord täpselt ühe võitja ja ühe 409 kaotaja; vana rada võttis versioonita kirjutuse vastu.

### SOL-JOUR-06 — arhiveeritud Teekond jääb täielikult muudetavaks ilma taasavamata — P1

**Tõend.** Detailvaate „Muuda” nupp on aktiivne sõltumata `journey.status` väärtusest; ARCHIVED muudab ainult arhiveerimisnupu taasavamisnupuks (`components/journey/JourneyDetail.jsx:1123-1166`, `:1600-1673`). Serveri `updateJourneyForUser()` ei keela arhiveeritud rea title/summary/context/tegevuste muutmist ega nõua enne olekut ACTIVE (`lib/journey/service.js:162-225`). Samal ajal on tootelepingus arhiveerimine pehme lõpetamine ja eraldi taasavamine teadlik elutsüklitoiming (`docs/platvormi arendus/fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md:141-154`).

**Mõju.** Arhiiv ei ole stabiilne ajalookiht: kasutaja saab lõpetatuks märgitud olukorra sisu muuta, ilma et olek või sündmuslogi näitaks taasavamist. See muudab seotud eelpöördumiste ja ekspordi konteksti tagantjärele raskesti tõlgendatavaks.

**Vastuvõtukriteerium.** ARCHIVED olekus peab sisumuudatus serveris 409-ga sulguma kuni eraldi taasavamise tehinguni; UI peab muutmise blokeerima ja selgitama taasavamist. Testida otsest PATCH-i, stale taasavamist ning archive → reopen → edit sündmusjada.

**Seis (13.08.2026): DONE —** `ARCHIVED` Teekonna sisumuudatus sulgub serveris 409-ga ning ainus lubatud muutmine on eraldi kehtiva versiooniga taasavamine; aegunud taasavamine saab samuti 409. UI peidab nii põhi- kui teenuse jätkumise redaktori ja selgitab taasavamise vajadust. Regressioonitest katab otsese PATCH-i, stale taasavamise ning archive → reopen → edit sündmusjada.

### SOL-JOUR-07 — vigane olekuväärtus taasavab Teekonna vaikimisi ACTIVE-ks — P1

**Tõend.** Uuenduse `status` normaliseerija ei lükka tundmatut väärtust tagasi, vaid kasutab vaikeväärtust `ACTIVE`; `primaryPath` muutub samas olukorras `null`-iks (`lib/journey/validation.js:27-35`, `:153-190`). Auditijooksu puhtas funktsioonikontrollis andis `{status:"TYPO"}` tulemuseks `{status:"ACTIVE"}`. Teenus käsitleb seda ARCHIVED real olekumuutusena, lisab `reopened` tegevuse ja emiteerib `workspace.activated` sündmuse (`lib/journey/service.js:187-216`).

**Mõju.** Kliendi kirjaviga, vana versiooni väärtus või vigane integratsioon võib arhiveeritud Teekonna näiliselt edukalt taasavada; tundmatu suund võib vaikides kaduda. Vea asemel tekib kehtiv, kuid vale äriseis ja eksitav sündmuslogi.

**Vastuvõtukriteerium.** Kõik kliendi poolt kaasa pandud enumid peavad tundmatu väärtuse korral tagastama stabiilse 400 välja-veaga; vaikeväärtus on lubatud ainult välja puudumisel create-operatsioonis. Testida iga enumiga puuduv, tühi, kehtiv ja tundmatu väärtus ning ARCHIVED rea negatiivjuht.

**Seis (13.08.2026): DONE —** kliendi kaasa pandud `status`, `sharingStatus` ja `primaryPath` valideeritakse fail-closed: tühi või tundmatu väärtus annab stabiilse 400 väljavea ning vaikeväärtus rakendub ainult puuduvale create-väljale. Testid katavad iga enumi puuduva, tühja, kehtiva ja tundmatu väärtuse; `ARCHIVED` rea `{status:"TYPO"}` jääb muutmata. Vana normaliseerija oleks tundmatu staatuse `ACTIVE`-ks ja tundmatu suuna `null`-iks muutnud.

### SOL-JOUR-08 — klient saab Teekonna rollikontekstiks väita suvalise lubatud rolli — P2

**Tõend.** POST-route annab teenusele serveri sessiooni rolli (`app/api/journeys/route.js:47-58`), kuid `normalizeJourneyCreateInput()` eelistab sellele kliendi `input.roleContext` väärtust (`lib/journey/validation.js:117-150`). Auditijooksu kontrollis salvestusnormaliseerija valis CLIENT-sessiooni optsiooni asemel kliendi saadetud `ADMIN`. Serializer tagastab selle väärtuse hiljem tavapärase Journey omadusena (`lib/journey/serializers.js:1-22`).

**Mõju.** Kuigi praegused omanikuõigused ei sõltu sellest väljast, muutub rollipäritolu ebausaldusväärseks ning tulevane analüütika, migratsioon või töövooharu võib tõlgendada kasutaja enda väidet serveri faktina.

**Vastuvõtukriteerium.** `roleContext` peab tulema ainult serveri lahendatud sessiooni-/effective-role otsusest või olema selgelt eraldi kasutaja valitud „vaate” väli, mida ei käsitleta autoriseerimisfaktina. Test peab tõendama, et CLIENT ei saa POST-kehaga ADMIN/SOCIAL_WORKER väärtust salvestada.

**Seis (13.08.2026): DONE —** Journey `roleContext` pärineb ainult serveri lahendatud sessioonirollist; POST-keha samanimelist väärtust ei usaldata. Regressioonitest tõendab, et serveri CLIENT-kontekst jääb CLIENT-iks ka kliendi ADMIN, SOCIAL_WORKER, tühja või tundmatu väärtuse korral. Vana rada eelistas kliendi rolliväidet serveri faktile.

### SOL-JOUR-09 — vestluses loodud Teekond on eraldi kaduv rada ega talleta lähtevestluse seost — P1

**Tõend.** Vestluse Journey-režiim hoiab `journeyWorkflowDraft` mustandit React-olekus, koostab selle sama `/api/journeys/draft` kaudu ja salvestab tekstikäsu „salvesta” järel `/api/journeys`-i (`components/alalehed/ChatBody.jsx:216-280`, `:2176-2305`). Seda olekut ei seota JourneyDashboardi kasutaja-/sessionStorage-taastega ega URL-sammuga; värskendus või navigeerimine kaotab mustandi. Salvestusele antakse ainult `journeyWorkflowDraft.draft`, mitte aktiivset `convId`, kuigi Journey mudel ja teenus toetavad omaniku kontrollitud `conversationId` seost (`components/alalehed/ChatBody.jsx:2192-2205`, `lib/journey/service.js:42-57`, `:74-97`). Kanooniline leping nõuab üht rada ja vestlusest loomisel päritoluviidet (`docs/platvormi arendus/fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md:130-135`).

**Mõju.** Kasutaja võib kaotada pika täpsustamise tavalisel F5/tagasi-liigutusel. Edukalt salvestatud Teekond ei tõenda, millisest vestlusest see tekkis, mistõttu „pärineb vestlusest” jätkamine ja kustutusjärgne SetNull-leping ei rakendu sellele tegelikule loomisrajale.

**Vastuvõtukriteerium.** Vestluse Journey-režiim peab suunduma samasse URL-/mustandimasinasse või kasutama sama kasutajaga seotud taastemehhanismi. Salvestus peab saatma aktiivse omaniku vestluse ID ning server peab selle omandit kontrollima. Testida F5-taastet, vestlus A/B vahetust, võõrast conversationId-d ja vestluse kustutuse SetNull tulemust.

**Seis (13.08.2026): DONE —** vestluse Journey-mustand salvestub sama vahekaardi `sessionStorage`-is omaniku ja `conversationId` järgi eraldatud võtmega ning taastub F5 ja vestluste A/B vahel liikumise järel. Salvestus tagab aktiivse vestluse olemasolu ja omandi ning edastab sama ID Journey loomisele; võõras vestlus lükatakse tagasi. PostgreSQL-i sond tõendas omaniku seose, võõra ID puhul 400 ilma Journey loomiseta ja vestluse kustutamisel `ON DELETE SET NULL` käitumise. Autenditud kohalik sama vahekaardi brauserirada tõendas F5-taaste, A/B eraldatuse ja õige päritoluseose; sünteetilised andmed koristati (`production runtime: NOT_PROVEN`).

### SOL-JOUR-10 — Abivahenduse jagamisvalikud ei mõjuta üleantavat kategooriat ega piirkonda — P1

**Tõend.** Teekonna help-handoff paneb täielikust Journeyst tuletatud `category` ja `municipalityName` juba baashref'i ning lisab `shareReview=1` (`lib/journey/helpMediationHandoff.js:40-79`). Detailvaate paneel lisab URL-i ainult valitud `share` võtmete loendi (`components/journey/JourneyDetail.jsx:566-620`). Vestluse abisoovi eeltäide ei loe `share` ega `shareReview` parameetrit üldse; see tarbib kategooria, piirkonna ja `fromJourney` otse URL-ist ning jätab kokkuvõtte/ownWords tühjaks (`components/alalehed/ChatBody.jsx:136-166`).

**Mõju.** „Olukorra lühikokkuvõte” ja „kasutaja enda sõnastatud vajadus” valimine ei kanna neid abisoovi, samas kategooria või piirkonna eemaldamine ei takista nende väärtuste eeltäitmist. Kasutajale esitatud valik on seega korraga nii mittetoimiv kui privaatsuslikult ebaaus.

**Vastuvõtukriteerium.** Abisoovi handoff peab kasutama serveri allowlist-projektsiooni või kandma allkirjastatud/ühekordset mustandi-ID-d, mitte usaldama URL-i täisväärtusi. Iga valiku sisse-/väljalülitamise test peab tõendama vastava markeri olemasolu või puudumist abisoovi päris salvestuspayload'is.

**Seis (13.08.2026): DONE —** abisoovi handoff ei kanna enam Journey täisväärtusi URL-is. Autenditud omaniku-piiriga serverimarsruut koostab lubatud väljadest fail-closed projektsiooni ning välistab alati riskisignaalid. Autenditud kohalik runtime tõendas kõik kuus jagamisvalikut eraldi päriselt salvestatud abipalves, märkimata markerite ja riskimarkeri puudumise ning võõra või puuduva Journey üldise 404; sünteetiline sisu koristati nulljäägiga. Production runtime ja kahe eraldi konto brauseri-IDOR on NOT_PROVEN.

### SOL-JOUR-11 — ohu eitamine tekitab kriisihoiatuse ja kasutaja ei saa valet riskisignaali parandada — P1

**Tõend.** Riskireeglid kasutavad pelka alamstringiotsingut ega arvesta eitust: sõnad `oht`, `vägivald`, `ähvard` või `kriis` loovad 112-sõnumi ning ükskõik milline riskisignaal sunnib primaarraja `PRE_INQUIRY`-ks (`lib/journey/draft.js:31-34`, `:58-97`). Auditijooksus tekitas „Olukord ei ole ohtlik ja vahetut ohtu ei ole” 112-hoiatuse ja PRE_INQUIRY suuna. Detaili muutmisvorm ei sisalda `riskSignals` välja, kuigi vaaterežiim kuvab selle kasutajale (`components/journey/JourneyDetail.jsx:107-115`, `:1600-1663`, `:1699-1707`).

**Mõju.** Rahulik eitav kirjeldus võib saada kriisimärgise ja vale töövoosuunanäitamise. Kasutaja saab muuta kokkuvõtet, kuid salvestatud vale „ettevaatlik tähelepanek” jääb alles ning võib mõjutada tema edasisi valikuid.

**Vastuvõtukriteerium.** Kriisituletus peab eristama vähemalt otsest ja eitavat/ajaloolist/kolmanda isiku konteksti ning jääma selgelt soovituslikuks; vahetu ohu korral peab fail-closed kiirabiinfo siiski säilima. Kasutaja peab saama valesignaali parandada või paluda uuesti tuletamist. Negatiivkorpus peab sisaldama „ei ole ohtu”, „oli varem”, „kardan, et võib” ja otsese vahetu ohu näiteid ET/EN/RU-s.

**Seis (13.08.2026): DONE —** ohu tuletus eristab ET/EN/RU tekstis otsest vahetut ohtu, eitust, ajaloolist või võimalikku ohtu ning kolmanda isiku konteksti. Otsene vahetu oht säilitab fail-closed 112 teate ja `PRE_INQUIRY` raja; muud kontekstid ei saa valet 112 teadet ega sundrada. Teekonna omanik saab salvestatud riskisignaale detailvormis parandada või eemaldada ning positiiv- ja negatiivkorpus on roheline.

### SOL-JOUR-12 — ühe abivahendi seis omistatakse kõigile tekstist leitud abivahenditele — P1

**Tõend.** `inferAssistiveDevicesFromJourney()` arvutab kogu ühendatud teksti põhjal ühe globaalse `status` ja `supportNeed` väärtuse ning kasutab neid iga leitud seadme objektis (`lib/journey/assistiveDevices.js:88-120`, `:147-179`). Auditijooksus sai lausest „Rollaator on katki, aga prillid on olemas” nii rollaator, prillid kui ka üldine toimetuleku abivahend olekuks `NOT_WORKING`. Valitud `assistiveDevices` info võib selle staatusega eelpöördumisse minna (`lib/journey/preInquiryHandoff.js:121-170`).

**Mõju.** Platvorm võib muuta olemasoleva ja toimiva abivahendi vigaseks või kasutamata seadmeks ning kanda vale fakti kasutaja kinnitatavasse pöördumisse. Tervise ja toimetuleku kontekstis võib see suunata vale abi, dokumendi või kontakti poole.

**Vastuvõtukriteerium.** Seis ja probleem tuleb tuletada seadme lokaalsest lause-/fraasikontekstist või jätta `UNSURE`, kui seost pole võimalik usaldusväärselt teha. Mitme seadme vastandlike seisudega testkorpus peab tõendama, et ühe seadme omadus ei kandu teisele.

**Seis (13.08.2026): DONE —** abivahendi seis, probleem, kasutuskontekst ja toe vajadus tuletatakse seadme lokaalsest lause- või fraasikontekstist ning lähimast seisuvihjest; usaldusväärse seose puudumisel jääb seis `UNSURE`. Vastandlike seisudega test tõendab, et katkise rollaatori olek ei kandu prillidele ega teadmata seisuga kuuldeaparaadile.

### SOL-JOUR-13 — piirkonnatuletus kohtleb Pärnut eri handoff'ides vastuoluliselt — P2

**Tõend.** Teenusekaardi handoff tunneb nii `Pärnu/Pärnus` kui diakriitikata variante (`lib/journey/serviceMapHandoff.js:31-42`), kuid eelpöördumise handoff'i aliaseloendis on ainult `parnu/parnus`; „Pärnus” ei sobitu ka üldise `vald|linn` mustriga (`lib/journey/preInquiryHandoff.js:4-13`, `:80-87`). Auditijooksus jäi „Vajan abi Pärnus” eelpöördumise `municipality` väärtuseks tühi. Abivahenduse handoff võib lisaks kasutada `municipalityId` väärtust sõna-sõnalt `municipalityName` päringuparameetrina (`lib/journey/helpMediationHandoff.js:40-60`).

**Mõju.** Sama Teekond võib avada Teenusekaardi Pärnu filtriga, kuid koostada eelpöördumise ilma piirkonnata; ID-põhise konteksti korral võib abipakkumiste otsing kasutada nime asemel tehnilist identifikaatorit ja näidata null vastet.

**Vastuvõtukriteerium.** Kõik handoff'id peavad kasutama ühist KOV/maakonna resolverit, mis eristab ID-d ja kuvanime ning toetab käändeid ja diakriitikat. Lepingutest peab sama sisendi puhul võrdlema teenusekaardi, eelpöördumise ja abisoovi piirkonnatulemust.

**Seis (13.08.2026): DONE —** Teenusekaardi, eelpöördumise ja abisoovi Journey-handoff'id kasutavad ühist KOV/maakonna resolverit. Resolver eristab tehnilise `municipalityId` väärtuse kuvanimest, ei esita ID-d nimena ning toetab Pärnu/Pärnus ja diakriitikata variante koos `vald`, `linn` ja `maakond` kujudega. Lepingutest tõendab sama Pärnu tulemuse kõigis kolmes handoff'is ja ID-põhise konteksti fail-closed käitumise.

### SOL-JOUR-14 — Teekonna „tehtud sammud” ei ole usaldatav tegevusajalugu — P1

**Tõend.** Tegevuslogi elab kasutaja PATCH-itavas `context.activityLog` JSON-is; server ei eralda seda kliendi kontekstist, vaid lisab sinna kuni 50 üldkirjet (`lib/journey/service.js:19-25`, `:182-199`). Uutel serverikirjetel on ainult `type` ja `date`, kuid UI jätab ilma `title`-ita objektid kuvamata; seejärel liidab ta kaks sünteetilist baasrida ja võtab massiivi algusest kaheksa, nii et pikema ajaloo viimased sündmused jäävad välja (`components/journey/JourneyDetail.jsx:164-184`). SOL-JOUR-03 kirjeldatud normaliseerimine muudab olemasolevad objektid lisaks `[object Object]` stringideks.

**Mõju.** Kasutaja saab tehniliselt ajalookirjeid ümber kirjutada, päris archive/reopen/update sündmused ei pruugi üldse nähtavale jõuda ja pika ajaloo puhul näidatakse uusimate asemel vanemaid ridu. „Tehtud sammud” annab seega auditi- või jätkamiskindlusest tugevama mulje kui andmed lubavad.

**Vastuvõtukriteerium.** Kasutajale esitletav tegevusajalugu peab tulema append-only serverisündmustest või rangelt serveri hallatavast struktuurist, mitte kliendi muudetavast kontekstist. Kuvada tuleb määratud järjestuses viimased sündmused lokaliseeritud `type` järgi; testida üle 50 sündmuse, konteksti PATCH-i ja archive/reopen jada.

**Seis (13.08.2026): DONE —** Teekonna tegevusajalugu tuleb omaniku järgi skoobitud append-only `DomainEvent` kirjetest; kliendi `context.activityLog` eiratakse loomisel ja PATCH-il. Detail kuvab serveri määratud järjestuses uusimad kaheksa lokaliseeritud sündmust ning create/update/archive/reopen kirjutavad sündmuse samas tehingus. Päris PostgreSQL-i sond tõendas 61 sündmust, uusima kaheksa järjestust ja konteksti PATCH-i võimetust ajalugu muuta.

### SOL-JOUR-15 — Teekonna põhi- ja seoseloendid kasvavad piiritlemata ning kirjutusradadel puudub mahupiir — P2

**Tõend.** `listJourneysForUser()` tagastab kõik omaniku Journey-read ilma `take`/cursor'i/olekufiltrita ning detail laadib kõik seotud eelpöördumised samal viisil (`lib/journey/service.js:59-72`, `:133-159`). API ei võta paginatsiooni ega tagasta `hasMore` väärtust (`app/api/journeys/route.js:32-44`). Neljas Journey-route'is puudub rate-limit või omaniku aktiivsete/üldkirjete ülempiir; POST loob iga kord uue rea (`app/api/journeys/**`, `lib/journey/service.js:74-98`). Eraldi continuity kiht kärbib vaid töölaua kandidaate seitsmeni ega lahenda põhiloendi mahtu (`lib/workspaceContinuity.js:95-102`, `:142-147`, `:416-434`).

**Mõju.** Pika ajaloo, topeltklikkide või automatiseeritud autentitud päringute korral kasvavad DB, JSON-vastus ja brauseri renderdus piiritlemata. Ühe Journey detail võib muutuda aeglaseks üksnes seotud pöördumiste arvu tõttu ning kirjutusmahule pole rakenduse tasemel pidurit.

**Vastuvõtukriteerium.** Põhiloend ja linked-pre-inquiry loend peavad kasutama stabiilset cursor-paginatsiooni, minimaalseid projektsioone ja tervikloendurit. Loomine/draft-preview vajab kasutaja-/sessioonipõhist mõistlikku limiiti ning korduv loomine idempotentsusvõtit või topelt-submit kaitset. Koormustestida vähemalt kümneid tuhandeid Journey-ridu ja seotud pöördumisi.

**Seis (13.08.2026): DONE —** Journey põhiloend ja seotud eelpöördumised kasutavad stabiilset `updatedAt + id` cursor-paginatsiooni, minimaalseid projektsioone, `totalCount`/`hasMore`/`nextCursor` lepingut ja olekufiltrit; UI laadib lehti nõudmisel. Draft-preview ja loomine on kasutajapõhiselt piiratud, omanikul kehtib 200 aktiivse ja 10 000 kogukirje piir ning loomine on klienditoimingu võtmega kordusohutu. PostgreSQL-i sond läbis 10 005 Journey-rida ja 10 005 seotud eelpöördumist ning viis paralleelkatset lõid ühe rea.

### SOL-JOUR-16 — enne jäädavat kustutamist pakutav eksport ei sisalda kogu Teekonda — P1

**Tõend.** Kustutusdialoog ütleb, et privaatne sisu kustub, ning soovitab enne eksportida (`components/journey/JourneyDetail.jsx:1170-1179`). `downloadJourneyText()` kirjutab faili ainult pealkirja, kokkuvõtte, domains-, missingInfo- ja suggestedActions-pealkirjad; välja jäävad riskisignaalid, kogu `context` (sh inimese soov, kolmanda isiku kontekst, teenuse jätkumine ja abivahendid), ajatemplid, olek, päritoluvestlus ning seotud eelpöördumiste viited (`components/journey/JourneyDetail.jsx:48-62`). Faili loomist ega sisu ei auditeerita serveris.

**Mõju.** Kasutaja võib kustutada originaali põhjendatud usus, et talle pakutud eksport on Teekonna koopia, kuid pärast kustutust avastada, et suur osa privaatsest tööruumist ja selle seostest on pöördumatult puudu.

**Vastuvõtukriteerium.** Dialoog peab ausalt nimetama ekspordi ulatuse või eksportima kõik kasutajale nähtavad Journey-väljad ja seoste minimaalse registri masinloetavas, versioonitud formaadis. Test peab võrdlema täidetud Journey serialiseeringut ekspordiga ning tõendama iga välja kaasamise või teadlikult dokumenteeritud väljajätmise.

**Seis (13.08.2026): DONE —** kustutuseelne omaniku kontrollitud serverieksport annab versioonitud `sotsiaalai.journey.export` JSON-i kõigi kasutajale nähtavate väljade, struktureeritud konteksti, riskisignaalide, päritoluviite, serveriajaloo ja seotud eelpöördumiste minimaalse registriga; teadlikud väljajätud on failis nimetatud. Kohustuslik `JOURNEY_EXPORT` audit kirjutatakse enne failibaitide tagastamist samas tehingus ning auditiviga katkestab ekspordi fail-closed. Täidetud Journey võrdlustest tõendab ulatust.

### SOL-JOUR-17 — pikem Teekonna sisu ja loendid kärbitakse serveris vaikides — P1

**Tõend.** Kõik tekstinormaliseerijad kasutavad üle piiri sisendi tagasilükkamise asemel `slice()`-i; loendid lõpetavad 8/12/20 elemendi juures ilma hoiatuseta (`lib/journey/validation.js:18-25`, `:37-79`, `:84-114`). Kokkuvõtte piir on 12 000 märki, kuid nii loomise kui detaili textarea'l puudub `maxLength`, loendivormidel puuduvad elemendi- ja kogusepiirid (`components/journey/JourneyDashboard.jsx:219-228`, `:787-797`; `components/journey/JourneyDetail.jsx:623-635`, `:1613-1662`). API tagastab tavalise edu koos kärbitud objektiga.

**Mõju.** Pika olukirjelduse lõpus olev oluline risk, erand või inimese enda soov võib kaduda; üheksas tegevus või kolmeteistkümnes puuduva info punkt jäetakse välja. Kasutaja võib kärbitud versiooni edasi jagada või originaali kustutada teadmata, et salvestus ei olnud täielik.

**Vastuvõtukriteerium.** Üle piiri sisend tuleb stabiilse välja-veaga tagasi lükata või tagastada väljade kaupa teadliku kinnituse nõudev truncation-raport; vaikne edu pole lubatud. UI peab näitama piire ja allesjäänud mahtu. Testida iga teksti/listi piir-1, piir ja piir+1 ning tõendada, et edukas round-trip ei erine sisendist vaikides.

**Seis (13.08.2026): DONE —** Journey valideerimine ei kärbi enam teksti ega loendeid vaikides. Üle piiri sisend tagastab stabiilse `JOURNEY_FIELD_TOO_LONG` või `JOURNEY_LIST_TOO_LONG` vea välja ja piiriga; UI näitab väljade piire ja kasutatud mahtu. Piiritest katab kõik teksti- ja loendiklassid väärtustel piir−1, piir ja piir+1 ning tõendab eduka normaliseerimise round-trip samasust.

### SOL-PRE-01 — konto kustutamine jätab saatmata eelpöördumiste tundliku sisu autorita alles — P0

**Tõend.** Konto lõpptehing puhastab ainult read tingimusega `authorId = userId` ja `sentAt != null`, seejärel kustutab kasutaja (`lib/privacy/effectivePracticeAccountCleanup.js:144-169`). Saatmata `DRAFT`/`READY` ridadele ei tehta ei `deleteMany`- ega sisupuhastust. Samal ajal muudeti `PreInquiry.authorId` nullable-väljaks ja välisvõti `ON DELETE SET NULL`-iks (`prisma/migrations/20260717193000_journey_sent_author_retention/migration.sql:1-10`; `prisma/schema.prisma:2203-2241`), mistõttu kasutaja kustutamine neid ridu enam kaskaadiga ei kustuta. Olemasolev konto-kustutuse test kontrollib ainult saadetud rea `updateMany`-d ja adressaadi märkmete nullimist, mitte saatmata rea puudumist (`tests/effectivePractices/effectivePracticeAccountDeletion.test.js:212-225`). Kanooniline leping nõuab sõnaselgelt, et saatmata read kustuksid ja pärast kustutust oleks neid null (`docs/platvormi arendus/fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md:204-213`).

**Mõju.** Konto kustutanud inimese olukorrakirjeldus, eelkaardistus, mustandid ja võimalik kolmanda isiku info jäävad andmebaasi määramata ajaks autorita orvuna. Kasutajale lubatud kustutus ei toimu ning tavavaatest nähtamatu jääk võib jõuda varukoopiasse, administraatoriandmetesse või tulevasse valesti skoopivasse päringusse.

**Vastuvõtukriteerium.** Sama lukustatud kustutustehing peab enne `User` rea kustutamist kustutama kõik selle autori `sentAt = null` eelpöördumised ja puhastama ainult kohale toimetatud read. Päris PostgreSQL-i integratsioonitest peab looma DRAFT-, saatmata READY-, SENT- ja parandusahela, kustutama konto ning tõendama: saatmata ridu 0, saadetud ridadel 0 sisumarkerit, Journey-ridu 0 ja võõra autori andmed muutmata.

**Seis (10.08.2026): DONE — saatmata mustandid kustutatakse samas lukustatud tehingus. Commit `97b28080`.**

`deleteMany({ authorId, sentAt: null })` käib **enne** `User` rea kustutamist, samas
`$queryRaw … FOR UPDATE` luku all. Saadetud read puhastatakse endiselt (sisu tühjaks +
`authorErasedAt`) ja jäävad alles.

**Miks kustutus, mitte puhastus.** Vahe saadetud reaga on sisuline, mitte tehniline:
saadetud eelpöördumine on jõudnud teise inimeseni ja tema töö kohta jääb vastutusjälg.
Saatmata mustand ei ole kellegi teise juures olnud — tema kohta ei ole midagi, mille eest
vastutada.

Kriteeriumi **„Journey-ridu 0"** katab juba skeem: `Journey.owner` on `Cascade`, seega
teekonnad lähevad kasutajaga kaasa ilma eraldi koodita. Seda ei ole vaja lisada, aga see
oli vaja üle vaadata — kontrollisin, mitte ei eeldanud.

Leid tuli ette [SOL-URG-02](#sol-urg-02--konto-kustutamine-jätab-kiire-abi-nime-telefoni-ja-olukorra-toorteksti-andmebaasi--p0)
parandust kirjutades: konversioon kopeerib kiire abi verbatim-teksti mustandisse, seega
ainult URG-02 sulgemine oleks jätnud samad sõnad teise tabeli alla. Kaks eri peatükki, üks
funktsioon, üks inimese tekst — nad said ühe paranduse.

Väravad ja negatiivkontroll: vt SOL-URG-02 Seis-lõiku (sama commit).

**NOT_PROVEN:** kriteerium nõudis **päris PostgreSQL-i integratsioonitesti** parandusahela
(`supersededById`) ja FK-kaskaadidega. Tõendatud on ainult reatasandi loogika ridu
päriselt muutva fake'iga; parandusahelat ma eraldi ei mudeldanud.

### SOL-PRE-02 — tagasivõetud organisatsioonipöördumise sisu saab hiljem avada ja uuesti töötajale määrata — P0

**Tõend.** Tagasivõtt märgib postkastikirje `RECALLED`-iks ja lõpetab hetkel elavad määramised samas tehingus (`lib/preInquiries.js:804-867`; `lib/org/inbox.js:304-340`). Detaili autoriseerija kontrollib aga ainult organisatsiooni, üksuse ja määramise skoopi, mitte `RECALLED` olekut; `getInboxItem()` loeb seejärel lähte-eelpöördumise kogu paketi, märgib selle isegi avatuks ja tagastab projektsiooni (`lib/org/inbox.js:464-540`). `assignWork()` ei keela terminalset `RECALLED`, `CLOSED` ega `REJECTED` kirjet: ta võib luua uue PENDING määramise ka siis, kui postkasti olekut enam `ASSIGNED`-iks muuta ei saa (`lib/org/inbox.js:607-668`). API lubab `includeClosed=1` loendit ja detail-GET-il puudub eraldi terminalkontroll (`app/api/org/[orgId]/inbox/route.js:19-31`; `app/api/org/[orgId]/inbox/[itemId]/route.js:18-29`). Negatiivkontrollis kandis `projectSourcePackage()` `recalledAt` väärtusega real endiselt edasi teema, olukorra, mustandi ja `assessmentState` sisu.

**Mõju.** Enne esimest avamist tagasi võetud tundlik pakett ei muutu organisatsioonile kättesaamatuks. Koordinaator võib selle ajaloo- või otselingist avada, tekitada pärast tagasivõttu `openedAt` ja anda töö uuele inimesele; kasutaja nähtav tagasivõtu lubadus on seega privaatsuslikult vale.

**Vastuvõtukriteerium.** `RECALLED` kirje detail peab tagastama ainult sisuta ajaloomarkeri või 404 ning ei tohi muuta `openedAt` väärtust. Kõik assign/transition/handover rajad peavad terminalolekus serveris sulguma. Päris DB võistlustest peab katma open-vs-recall ja assign-vs-recall mõlemad järjestused ning tõendama, et recall-võidu järel ei tagasta ükski organisatsiooni API sisumarkerit.

**Seis (10.08.2026): DONE — terminalne seis ei anna sisu ega tööd. Sond `npm run org:recall:probe` 42/42 päris PostgreSQL-is.**

Invariant on üks lause ja ta on kahes tükis, sest tema kaks poolt on eri asjad:

- **sisu** — `projectSourcePackage()` tagastab `recalledAt` korral **`null`**. Värav on
  projektsiooni sees, mitte kutsujas: see funktsioon on ainus uks sisu juurde ja iga
  tulevane kutsuja pärib värava tasuta.
- **töö** — `isTerminalInboxStatus()` (`lib/org/constants.js`) on **tuletatud
  seisumasinast** (`INBOX_STATUS_TRANSITIONS[x].length === 0`), mitte teine käsitsi hoitud
  loend. Teda kontrollivad `assignWork`, `transitionInboxItem`, `handOverWork` ja
  `respondToAssignment`. Tundmatu seis loetakse terminaliks — fail-closed.

Detail tagastab **sisuta ajaloomarkeri, mitte 404**: kirje ise jääb `includeClosed=1`
loendis nähtavaks, seega 404 tekitaks vastuolu, kus koordinaator näeb nimekirjas rida,
mida avada ei saa. Marker on `sourceWithheldReason: "RECALLED"` + `recalledAt`.

**Kolm asja, mida raportis ei olnud, aga mis sama juure all olid:**

1. **`urgencyDeclaredBySender` on saatja oma tekst** organisatsiooni tabelis. Tagasivõtmine
   kustutab selle koopia (`recallInboxItemForSourceWithin`), ja loend maskeerib ta ka
   vanadel ridadel, mis võeti tagasi enne seda parandust.
2. **Avamise võistlus ei olnud lugemisega lahendatav.** Esimene katse kontrollis mälus
   loetud `recalledAt`-i — aga `findUnique` võib olla vananenud ja samaaegne tagasivõtmine
   commit'ib lugemise ja otsuse vahel. Nüüd on **kirjutus kohtunik**: `updateMany({openedAt:
   null, recalledAt: null})` on korraga idempotentsus, võistlusvärav JA tõendiallikas — kui
   ta ei kirjutanud, loetakse värskelt üle, MIKS ta ei kirjutanud.
3. **Seisukontroll üksi ei püüa võistlust** — ta mõõdab hetke, mis on möödas enne, kui ta
   jõuab otsustada. Kõik kirjutavad rajad võtavad nüüd `SELECT … FOR UPDATE` postkastikirje
   real **enne lugemist**, ühesuguses järjekorras (kirje rida → määramised).

**Tõendus.** `scripts/org-inbox-recall-probe.mjs` on **deterministlik, mitte
`Promise.all`-lootus**: ta hoiab luku juba võtnud tehingut lahti, käivitab teise poole,
**mõõdab et see OOTAB**, laseb siis luku lahti ja mõõdab tulemust. Kaetud on mõlemad
järjestused mõlemal võistlusel — open-vs-recall (recall võidab: sisu ei tule ja `openedAt`
jääb `null`; open võidab: sisu tuleb ja recall saab ausa 409) ja assign-vs-recall
(recall enne: määramine kukub `inbox_item_terminal`-iga; assign enne: recall ootab ära ja
**lõpetab just tekkinud määramise**, kirje lõpeb `RECALLED`-is).

**Negatiivkontroll on kahekihiline.** Sondis endas on „tavaline kirje töötab endiselt"
plokk (sisu tuleb, `openedAt` tekib, määramine ja üleandmine õnnestuvad). Lisaks jooksutasin
sondi **vana koodi vastu**: `21 passed, 21 failed` — sh „assigning work on a recalled item
is refused — **expected rejection, got success**", „opening a recalled item does NOT stamp
openedAt" ja „assign-first: the assignment created under the lock is ENDED by the recall".
Sond mõõdab täpselt seda, mida leid väitis.

**Brauseris läbi käidud** (päris sessioon, `ai.specialist.a` koordinaatorina, kaks kirjet
kõrvuti): tagasivõetud kirje leht ei kanna olukorra teksti ega kiirusmärget, näitab
tagasivõtu teadet ja **ei paku ühtki nuppu**; avamise teade („sinu avamine on pöördujale
nähtav") on peidus, sest avamist ei toimunudki. Kõrvalolev tavaline kirje näitab kõike —
maskeerimine on sihitud, mitte üldine. HTTP-tasemel: `GET .../inbox/{id}` → `source: null`,
`POST .../assign` → **409 `org.errors.inbox_item_terminal`**.

**Väravad:** `npm test` 3395/3395 · `i18n:check` OK (uued võtmed et/en/ru) · eslint puhas ·
`npm run org:recall:probe` 42/42.

**NOT_PROVEN:** kolme muu terminaalse seisu (`CLOSED`, `REJECTED`) sisu **ei ole**
peidetud ja see on teadlik — need on organisatsiooni enda töö ajalugu, mitte saatja
tagasivõetud pakett. Peidetud on ainult `RECALLED`. Töörajad sulguvad kõigil kolmel.

### SOL-PRE-03 — eelpöördumine möödub teenusekaardi avaldamis- ja moderatsioonipiirist — P1

**Tõend.** Tavaline teenusekaardi API lubab `NEEDS_REVIEW` eelvaadet ainult administraatorile ja tagastab muidu üksnes `PUBLISHED` read (`app/api/service-map/entries/route.js:28-46`; `lib/serviceMap/entriesQueryPolicy.js:1-16`; `lib/serviceProviderProfiles.js:1142-1154`). Eelpöördumise assistent pärib aga iga autentitud kasutaja jaoks korraga `PUBLISHED` ja `NEEDS_REVIEW` read (`lib/preInquiries.js:1697-1789`). Salvestuse `resolveRecipient()` kasutab omakorda pelka `findUnique({id})` päringut ilma `status`-piirita, nii et teadaoleva ID-ga sobivad ka `DRAFT` ja `HIDDEN` (`lib/preInquiries.js:481-501`). Serializer tagastab valitud kirje nime, aadressi, telefoni, e-posti ja veebilehe (`lib/preInquiries.js:630-640`).

**Mõju.** Tavakasutaja võib assistendi kaudu näha veel kinnitamata kontakte või teadaoleva ID-ga lugeda ja kasutada peidetud/mustandkirje kontaktandmeid. Moderatsioonist eemaldatud adressaadile saab koostada või saata pöördumise ka siis, kui avalik teenusekaart seda enam ei paku.

**Vastuvõtukriteerium.** Kõik eelpöördumise adressaadiresolverid peavad kasutama ühist avaldamispoliitikat: tavakasutajale ainult `PUBLISHED`, administraatori eelvaade eraldi ja saatmises alati keelatud. Testida PUBLISHED/NEEDS_REVIEW/DRAFT/HIDDEN iga rolliga nii assistendi, create'i kui update'i kaudu ning kontrollida, et keelatud ID ei leki 404-vastuses.

**Seis (13.08.2026): DONE —** eelpöördumise assistent ja create/update resolverid kasutavad tavakasutajale ainult `PUBLISHED` teenusekaardiridu; `NEEDS_REVIEW`, `DRAFT`, `HIDDEN` ja puuduv ID annavad ühetaolise 404 enne kirjutust. Väline saatmine kontrollib avaldamisseisu uuesti vahetult enne kõrvalmõju. `tests/preInquiries/recipientPolicy.test.js` katab rollid, kõik avaldamata seisud ning nullkirjutuse/nullsaatmise; ploki testslice 115/115 (`runtime: not_run`, invariant on serveripäringu tasandil).

### SOL-PRE-04 — klient saab teenusekaardi adressaadi e-posti ja nime serveris teise väärtusega asendada — P1

**Tõend.** `resolveRecipient()` eelistab POST/PATCH-kehast tulevaid `selectedRecipientEmail` ja `selectedRecipientName` väärtusi teenusekaardi rea autoriteetsetele väljadele; sama kliendi e-posti järgi otsitakse suvaline `User` ning tema opt-in määrab sisemise adressaadi (`lib/preInquiries.js:481-518`, `:503-510`). `recipientEntryId` ja tegelik `recipientOwnerId`/e-posti siht ei pea omavahel sobima. UI saadab küll nähtava rea väärtused (`components/workspace/WorkspaceFeaturePage.jsx:1524-1543`), kuid server ei jõusta seda seost.

**Mõju.** Muudetud klient või integratsioon saab näidata ja salvestada ühe KOV-i/teenuseosutaja nime, kuid suunata tundliku pöördumise teisele e-posti aadressile või teise opt-in kasutaja kontole. Auditijälg ja kasutaja eelvaade võivad nimetada vale adressaati.

**Vastuvõtukriteerium.** Kui `recipientEntryId` on antud, peab nimi, e-post, tüüp ja platvormisisene omanik tulema ainult värskelt avaldatud serverirealt; vastuoluline kliendiväärtus peab olema 400 või täielikult ignoreeritud. Käsitsi e-posti sisestus peab olema eraldi, selgelt nimetatud rada ilma teenusekaardi identiteedita. Negatiivtest peab püüdma entry A + email B ja tõendama null kirjutust/saatmist.

**Seis (13.08.2026): DONE —** teenusekaardi ID korral tulevad adressaadi nimi, e-post, tüüp ja platvormisisene omanik ainult värskelt avaldatud serverirealt. Vastuoluline kliendiväärtus annab 400 enne create/update kirjutust; entry A + email B ei tekita kirjet ega saatmist. Käsitsi e-post jääb eraldi rajaks ainult ilma `recipientEntryId`-ta ning saatmine võrdleb identiteeti uuesti aktuaalse avaldatud reaga. Tõend: `tests/preInquiries/recipientPolicy.test.js`, testslice 115/115 (`runtime: not_run`).

### SOL-PRE-05 — levinud eestikeelsed vägivallakirjeldused jäävad kriisiriskita — P1

**Tõend.** Lapse- ja vägivallamärksõnade loendis on mojibake-väärtused `vĆ¤Ć¤rkohtlemine` ja `koduvĆ¤givald`; kriisiloend sisaldab diakriitikata `lahisuhtevagivald`, kuid mitte tavapäraseid `lähisuhtevägivald`, `koduvägivald` ega üldist `vägivald` (`lib/preInquiriesAssessment.js:34-53`, `:78-91`). `buildPreInquiryAssessment()` annab alati `urgencyLevel` väärtuse ja assistent eelistab seda hilisemale laiemale fallback-detektorile, mistõttu fallback ei paranda möödalasku (`lib/preInquiriesAssessment.js:145-181`; `lib/preInquiries.js:1904-1908`). Auditi puhtas kontrollis andsid nii „Partner kasutab lähisuhtevägivalda” kui „Kodus toimub koduvägivald” tulemuseks `urgencyLevel=NORMAL`, `riskFlags=[]` ja tavalise KOV-suuna.

**Mõju.** Just tüüpiline vahetu ohuga seotud eestikeelne kirjeldus võib jääda ilma püsiva kiire abi hoiatuseta ning jätkata tavalise kontaktisoovitusena. See on turvavõrgu vale-negatiivne tulemus kõrge mõjuga töövoos.

**Vastuvõtukriteerium.** Märksõnakorpus peab olema UTF-8 puhas, käände- ja diakriitikakindel ning ühendatud üheks auditeeritavaks riskiväravaks. ET/EN/RU negatiiv- ja positiivkorpus peab katma vähemalt lähisuhtevägivalla, koduvägivalla, ähvarduse, enesevigastuse, eituse, ajaloolise juhtumi ja vahetu ohu; otsese ohu korral peab kiire abi info jääma nähtavaks sõltumata kontaktisoovitusest.

**Seis (13.08.2026): DONE —** kriisirisk kasutab UTF-8 puhast ja diakriitikakindlalt normaliseeritud ühist riskiväravat. ET/EN/RU korpus katab lähisuhte- ja koduvägivalla, ähvarduse, enesevigastuse, eituse, ajaloolise juhtumi ning vahetu ohu; otsese ohu korral säilib kiire abi info sõltumata kontaktisoovitusest. Negatiivkontroll tõendas vana eestikeelse vale-negatiivse käitumise; `tests/preInquiries/assessment.test.js` on testslice'i 115/115 osa (`runtime: not_run`).

### SOL-PRE-06 — sõnad „pere”, „vanem” ja „noor” tekitavad ilma lapseta lastekaitsesuuna — P1

**Tõend.** `CHILD_KEYWORDS` sisaldab kontekstita alamstringe `noor`, `vanem` ja `pere`; ükskõik milline vaste seab `childProtection=true`, asendab muud eluvaldkonnad ainsa väärtusega „lapse heaolu ja pere” ning valib `CHILD_PROTECTION` suuna (`lib/preInquiriesAssessment.js:34-53`, `:145-193`). Auditi kontrollis muutus „Aitan eakat vanemat ja pere vajab hoolduskoormuse tuge” lapse ohutusjuhtumiks ning „Noor spetsialist aitab eakat inimest” sai nii `CHILD_SAFETY` kui `YOUTH_SAFETY` lipu.

**Mõju.** Täiskasvanu hoolduskoormus või lihtsalt noorest töötajast rääkiv tekst suunatakse lastekaitsesse, teised tuvastatud vajadused kaovad ning kasutajale näidatakse põhjendamatut Lasteabi/112 hoiatust. Vale suund võib vähendada usaldust ka päris lapseohutuse hoiatuste vastu.

**Vastuvõtukriteerium.** Lapse suund peab nõudma lapse/alaealise selget semantilist konteksti või kasutaja kinnitust; üldsõnad üksi ei tohi otsustada. Testkorpus peab sisaldama eakat vanemat, lapsevanemat, noort spetsialisti, noorukit, pere eelarvet ja otsest lapse turvariski ning säilitama samaaegselt kõik muud eluvaldkonnad.

**Seis (13.08.2026): DONE —** lapsekaitsesuund nõuab nüüd lapse või alaealise selget semantilist konteksti; sõnad „pere”, „vanem” ja „noor” üksi seda ei käivita. Korpus eristab eakat vanemat, lapsevanemat, noort spetsialisti, noorukit, pere eelarvet ja otsest lapse turvariski ning säilitab samaaegselt muud tuvastatud eluvaldkonnad. Vana vale-positiivne käitumine kukkus negatiivkontrollis; testslice 115/115 (`runtime: not_run`).

### SOL-PRE-07 — piirkonnaga mitteseotud kontakt võib saada eksitava „kõrge kindluse” — P1

**Tõend.** Assistendi soovitused saavad punkte juba pelga e-posti/telefoni olemasolu eest ning jäävad loendisse, kui skoor on üle nulli; piirkonnakattuvus ei ole kohustuslik (`lib/preInquiries.js:275-303`, `:1809-1884`). `buildPreInquiryRoutingConfidence()` annab `HIGH`, kui sisendis on lihtsalt municipality, vähemalt üks vajadus ja vähemalt üks suggestion — ta ei kontrolli, kas soovitus kattus piirkonna või vajadusega (`lib/preInquiryRouting.js:109-149`). Auditi kontrollis sai suvaline `{id:"wrong-region"}` soovitus Tartu + eluaseme sisendiga `HIGH` ja teksti, et soovitus põhineb piirkonnal ning vajadussignaalidel.

**Mõju.** Kasutaja võib saada kõrge usaldussildiga vale KOV-i või teeninduspiirkonna kontakti. Selgitus väidab tõendit, mida arvutus ei kontrollinud, ning võib suunata tundliku info valele asutusele.

**Vastuvõtukriteerium.** Iga soovitus peab kandma eraldi tõendatud piirkonna-, vajaduse- ja kanalivastet; `HIGH` on lubatud ainult nõutud vastete olemasolul. KOV-kontakt peab vaikimisi kattuma kasutaja KOV-iga, üleriigiline teenus peab olema selgelt märgitud. Testida vale KOV, sama maakond, üleriigiline teenus, puuduv piirkond ja null sisulist vastet.

**Seis (13.08.2026): DONE —** iga soovitus kannab eraldi piirkonna-, vajaduse- ja kanalivaste tõendit ning `HIGH` on lubatud ainult nõutud vastete olemasolul. KOV-kontakt peab kattuma kasutaja KOV-iga; sama maakonna ja üleriigilise teenuse rajad on eraldi tähistatud ning puuduv piirkond või null sisulist vastet ei saa kõrget kindlust. Negatiivkontroll kattis vale KOV-i; testslice 115/115 (`runtime: not_run`).

### SOL-PRE-08 — eelpöördumise üldsalvestus kirjutab vana brauseriseisu konfliktita üle — P1

**Tõend.** Koostamis-/muutmisvormi PATCH saadab kogu teema, olukorra, assessment'i, adressaadi ja mustandi, kuid mitte `expectedUpdatedAt` väärtust (`components/workspace/WorkspaceFeaturePage.jsx:1505-1544`). `updatePreInquiry()` võtab küll advisory lock'i ja loeb rea lukus värskelt, kuid ei võrdle seda kliendi nähtud versiooniga; seejärel kirjutab kogu payload'i üle (`lib/preInquiries.js:1274-1472`). Kood kaitseb kahe samal hetkel serveris jooksva adressaadimuutuse interleaving'ut, mitte kaua avatud vana vahekaardi stale payload'i. Kanooniline leping nimetab eelpöördumise CAS-i olemasolevaks nõudeks (`docs/platvormi arendus/fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md:126-139`).

**Mõju.** Teises vahekaardis või seadmes tehtud uuem sisu, adressaat või privaatsusvalik võib vana vormi salvestamisel vaikides kaduda. Lukustus muudab kirjutused järjestikuseks, kuid ei tee vana kliendiseisu õigeks.

**Vastuvõtukriteerium.** Iga author PATCH peab nõudma kehtivat `expectedUpdatedAt`/versiooni ja tegema CAS-kirjutuse; puuduva või vana väärtuse korral 409 ilma osalise muutuseta. Kahe kliendi päris PostgreSQL-i test peab katma content-vs-content, recipient-vs-content, download-vs-edit ja archive-vs-edit järjestused.

**Seis (13.08.2026): DONE —** autori PATCH nõuab nüüd `expectedUpdatedAt` väärtust ning võrdleb seda advisory lock'i all värske reaga enne CAS-kirjutust; puuduva või aegunud versiooni korral vastab server 409 ja ei kirjuta midagi. Vorm saadab kasutaja nähtud versiooni. Päris PostgreSQL-i sond kattis content-vs-content, recipient-vs-content, download-vs-edit ja archive-vs-edit võistlused: igas paaris võitis täpselt üks klient ning teine sai 409; vana tingimusteta kirjutus lasi mõlemad läbi ja kaotas esimese tulemuse. Sihttestid ja sond rohelised (`runtime: PostgreSQL probe`).

### SOL-PRE-09 — arhiveeritud saatmata eelpöördumine on endiselt muudetav ja tavalisel salvestusel taasavatav — P1

**Tõend.** `updatePreInquiry()` keelab ainult `SENT` ning avatud/asendatud kirje muutmise; `ARCHIVED` ei ole terminalne kontroll (`lib/preInquiries.js:1274-1295`, `:1328-1337`). Olekunormaliseerija lubab kliendil küsida DRAFT/READY/SENT/ARCHIVED üleminekut ilma siirdemaatriksita (`lib/preInquiries.js:1379-1450`). Salvestatud kirjete UI näitab „Muuda” nuppu ka ARCHIVED kirjel; avamine täidab vormi ja tavaline „Salvesta” saadab vaikimisi `status:DRAFT` (`components/workspace/WorkspaceFeaturePage.jsx:1476-1509`, `:2875-2917`).

**Mõju.** Ajalukku viidud pöördumise sisu saab muuta või see taasavatakse vaikse DRAFT-salvestusega, ilma teadliku reopen-toimingu ja sündmuseta. Arhiiv ei ole usaldatav lõpetatud seis.

**Vastuvõtukriteerium.** ARCHIVED peab olema serveris read-only kuni eraldi versioonikindla reopen-toiminguni; UI peab muutmise peitma või nõudma taasavamist. Lubatud olekusiirded tuleb jõustada tabelina ning testida otsest PATCH-i, archive→reopen→edit rada ja stale reopen-võistlust.

**Seis (13.08.2026): DONE —** `ARCHIVED` on üldise PATCH-i jaoks terminalne ning lubatud autori siirded on serveris tabelina jõustatud. Eraldi `/reopen` toiming viib kirje CAS-kaitstult tagasi `READY` olekusse; aegunud taasavamine saab 409. UI ei paku arhiveeritud kirjele tavalist muutmist, vaid teadlikku taasavamist. Otsene PATCH, archive→reopen→edit ja stale reopen-võistlus on regressioonitestidega kaetud (`runtime: not_run`; brauserit ei nõutud, sest UI lepingut kontrollib lähtekooditest ja võistlust päris DB sond).

### SOL-PRE-10 — autor saab luua vestlusruumi veel saatmata mustandist — P1

**Tõend.** Room-route lubab nii autorit kui adressaati (`app/api/pre-inquiries/[id]/room/route.js:39-60`). `ensureRoomForPreInquiry()` kontrollib värskelt autorit, `recipientOwnerId`-d ja recall'i, kuid ei nõua `sentAt`/`SENT` olekut ega adressaadi eelnevat accept'i; see loob kohe mõlemale liikmesuse ja ruumi, mille metadata sisaldab eelpöördumise ID-d, tüüpi ja adressaadi nime (`lib/rooms/preInquiryRoom.js:101-180`). Pärast ruumitehingut üritab route DRAFT-i eraldi tavauuendusega READY-ks muuta ning neelab selle vea (`app/api/pre-inquiries/[id]/room/route.js:63-69`).

**Mõju.** Otsese API-kutsega saab autor lisada adressaadi ühisesse ruumi enne, kui eelpöördumine on saadetud; adressaat võib näha ruumi, pealkirja ja päritolu, kuigi tema eelpöördumise loend mustandit õigesti peidab. Kui järel-UPDATE ebaõnnestub, jääb ruum olemas, kuid pöördumine DRAFT-iks.

**Vastuvõtukriteerium.** Ruumi loomine peab nõudma kohale toimetatud, tagasi võtmata sisemist pöördumist ja lukustatud tooteotsuse järgi kas adressaadi explicit accept'i või samas tehingus usaldusväärset avamist. Ruumi loomine ja võimalik olekumuutus peavad olema üks tehing; vigu ei tohi neelata. Testida author-on-DRAFT, author-on-SENT, recipient-before/after-accept ja DB-update veasüsti.

**Seis (13.08.2026): DONE —** vestlusruumi saab luua ainult sisemisest, adressaadile kohale toimetatud, tagasi võtmata ja adressaadi poolt vastu võetud eelpöördumisest. Autor ega adressaat ei saa ruumi enne vastuvõttu; tingimuste värske kontroll ja deduplikeeritud ruumiloome toimuvad samas tehingus ning route'i eraldi veaneelav järel-UPDATE on eemaldatud. Author-on-DRAFT, author-on-SENT, recipient-before/after-accept, deduplikatsioon ja veapiirid on sihttestidega kaetud (`runtime: not_run`).

### SOL-PRE-11 — välise e-kirja kasutajavoog ei märgi saatmist, serveri saatmisrada võib aga duplitseerida kirju — P1

**Tõend.** Tegelik UI avab ainult `mailto:` lingi „Ava e-kirjana”; ta ei kutsu `/api/pre-inquiries/[id]/send` route'i ega saa teada, kas kasutaja saatis, muutis või sulges kirja (`components/workspace/WorkspaceFeaturePage.jsx:539-545`, `:2793-2828`). Seetõttu jääb kirje DRAFT/READY-ks ja ei ilmu saadetud jagamiste registrisse. Eraldi serverifunktsioon saadab SMTP-kirja enne andmebaasi `status=SENT` uuendust, ilma advisory lock'i, CAS-i või idempotentsusvõtmeta (`lib/preInquiries.js:1570-1634`). Kaks paralleelset POST-i võivad mõlemad läbida `existing.status !== SENT` kontrolli ja saata kaks kirja; DB-vea järel on kiri väljas, kuid rida jätkuvalt saatmata.

**Mõju.** Välise saatmise kohta pole üht tõde: tavakasutaja päris tegevus jääb platvormis jälitamata, samas otsene serverirada võib saata topelt või tekitada „kiri saadetud, süsteem ütleb saatmata” seisu. Paranduse/tagasivõtu ja „Minu jagamised” lubadused ei kehti selle kanali jaoks usaldusväärselt.

**Vastuvõtukriteerium.** Lukustada üks välise saatmise leping: kas kasutaja kinnitab pärast mailto-väljumist teadlikult välise saatmise (ilma valet automaatset tõendit loomata) või kasutatakse durable outbox'i/idempotentset serverisaatmist. Paralleel- ja veasüst-testid peavad tõendama maksimaalselt ühe provider-send'i ning ausa taastatava DB/outbox seisu.

**Seis (13.08.2026): DONE —** lukustatud leping on teadlik kasutajakinnitus pärast `mailto:` üleandmist: server ei saada selle raja kaudu ühtegi provider-kirja ega väida automaatset kättetoimetamist. Kinnitus salvestab advisory lock'i ja CAS-i all idempotentselt `SENT` oleku ning `externalSendConfirmedAt` aja; katkestus, DB-viga või aegunud versioon jätab kirje ausalt `READY` olekusse. `/send` tähendus on nüüd üksnes kasutaja välise saatmise kinnitus. Paralleel- ja veasüst-testid tõendavad null provider-send'i, ühe kinnituse ning taastatava oleku (`runtime: not_run`).

### SOL-PRE-12 — organisatsiooni vastuvõtulauda ei saa platvormi enda eelpöördumise UI-st valida — P1

**Tõend.** Server tunneb `recipientOrganizationId` sisendit ja muudab selle korral tüübi `ORGANIZATION_INBOX`-iks (`lib/preInquiries.js:524-573`), kuid kogu `components/**` ja `app/**` tootmiskoodis ei ole ühtegi `recipientOrganizationId` payload'i kirjutajat. Eelpöördumise vorm saadab ainult `recipientType`, `recipientEntryId`, nime ja e-posti (`components/workspace/WorkspaceFeaturePage.jsx:1524-1543`); ka lubatud valikutüübid on kliendis KOV või teenuseosutaja. Staatiline kontroll leidis 12 pre-inquiry route'i, kuid 0 UI/app viidet `recipientOrganizationId`-le.

**Mõju.** Organisatsiooni postkasti atomaarsus, määramine ja üleandmine on tavakasutaja põhivoost kättesaamatu serverifunktsioon. Kasutaja saadab sama organisatsiooni avalikule e-postile või vanale isikurajale ega saa kasutada ehitatud vastuvõtutiimi.

**Vastuvõtukriteerium.** Avalik organisatsiooni adressaadiprojektsioon peab kandma serveri väljastatud postkasti-ID-d ja UI peab näitama eraldi „organisatsiooni vastuvõtutiim” valikut koos tegeliku kanaliga. Autenditud E2E peab saatma vormist org-postkasti, tõendama ühe inbox-item'i, null isiklikku `recipientOwnerId`-d ning õiget autori eelvaadet.

**Seis (13.08.2026): DONE —** autentimist nõudev avalik organisatsiooni adressaadiprojektsioon väljastab ainult serveri postkasti-ID, avaliku nime, juriidilise liigi, piirkonna ja tegeliku `INTERNAL` kanali. UI näitab eraldi „Organisatsiooni vastuvõtutiim” valikut ning saadab `recipientOrganizationId`, mitte UI-tunnust teenusekaardi kirjena. Autenditud kohalik brauserirada saatis vormist organisatsiooni postkasti, säilitas autori eelvaates õige nime ning tõendas päris PostgreSQL-is täpselt ühe inbox-item'i ja `recipientOwnerId=null`; sünteetilised andmed koristati (`production runtime: NOT_PROVEN`).

### SOL-PRE-13 — organisatsioonile määratud mustandi tavaline PATCH kaotab organisatsiooni adressaadi — P1

**Tõend.** `updatePreInquiry()` värske rea select ei loe `recipientOrganizationId`-d ning `resolveRecipient()` sisendisse seda olemasoleva väärtusena ei anta (`lib/preInquiries.js:1303-1321`, `:1339-1345`). Kui PATCH ei saada organisatsiooni ID-d uuesti, lahendab server adressaadi e-posti/isiku või välise kanali järgi ja kirjutab `recipientOrganizationId:null` (`lib/preInquiries.js:1433-1450`). See rikub osalise PATCH-i enda värske-seisu lubadust; tavaklient ei saaks ID-d säilitada ka siis, kui org-valik lisataks, sest praegune payload seda välja ei kanna.

**Mõju.** Teema või teksti muutmine võib vaikides muuta adressaadi organisatsiooni vastuvõtulauast väliseks e-postiks või konkreetseks inimeseks. Järgnev SEND kas ebaõnnestub või läheb teise kanalisse kui kasutaja algselt valis.

**Vastuvõtukriteerium.** Värske `recipientOrganizationId` peab osalise PATCH-i puhul säilima; adressaadi muutus peab olema eraldi explicit input ja room-/olekureeglitega kontrollitud. Testida content-only PATCH org-mustandil, explicit org→person vahetust, lipu sulgumist vahepeal ja stale kahe kliendi muutust.

**Seis (13.08.2026): DONE —** `updatePreInquiry()` loeb lukustatud värskelt realt `recipientOrganizationId` ning säilitab organisatsiooni adressaadi osalise PATCH-i korral. Adressaadi väljad kasutavad explicit-input semantikat, organisatsiooni muutus osaleb canonical-room piirangus ja suletud postkastivärav tagastab 409 ilma adressaati või sisu muutmata. Päris PostgreSQL-i kahe kliendi võistlus tõendas ühe CAS-võitja, ühe 409 kaotaja ja segunemata lõppseisu; explicit org→person vahetus on kaetud (`production runtime: NOT_PROVEN`).

### SOL-PRE-14 — organisatsioonipöördumise parandus kaotab adressaadi ega jõua postkasti — P1

**Tõend.** Parandusfunktsioon lubab originaalil olla kas `recipientOwnerId` või `recipientOrganizationId` ja kommentaar lubab org-postkasti pariteeti (`lib/preInquiries.js:942-985`). Uue SENT-versiooni `create` kopeerib aga ainult isikliku `recipientOwnerId` ning jätab `recipientOrganizationId` täielikult kirjutamata (`lib/preInquiries.js:1011-1029`). Pärast tehingut käivitatakse ainult isikliku adressaadi e-kiri; `deliverPreInquiryToOrganizationWithin()`-i parandusrada ei kutsuta (`lib/preInquiries.js:1044-1053`).

**Mõju.** Autor saab avatud org-pöördumise kohta eduteate ja uue SENT-kirje, kuid uuel real pole ei isiklikku ega organisatsiooni adressaati ning postkasti uut versiooni ei teki. Parandus läheb vaikides kaduma, samal ajal kui originaal märgitakse asendatuks.

**Vastuvõtukriteerium.** Parandus peab kopeerima lukustatud serverirealt `recipientOrganizationId` ja avaliku nime, looma uue inbox-item'i samas tehingus ning alles seejärel siduma originaali `supersededById`-ga. Integratsioonitest peab katma person- ja org-adressaadi, tehingu rollback'i, kordusPOST-i ning paranduse nähtavuse mõlemale poolele.

**Seis (13.08.2026): DONE —** parandusrada kopeerib lukustatud serverirealt organisatsiooni adressaadi ja avaliku nime, loob paranduse inbox-item'i samas tehingus enne originaali `supersededById` sidumist ning kordusPOST tagastab sama paranduse uut kirjet loomata. Päris PostgreSQL-i sond kattis isiku- ja organisatsiooniadressaadid, ühe postkastikirje, korduskatse, autori ja organisatsiooni nähtavuse ning sunnitud postkastitõrke täieliku rollback'i (`production runtime: NOT_PROVEN`).

### SOL-PRE-15 — neli eelpöördumise route'i tagastavad avalikult toore backend-vea sõnumi — P1

**Tõend.** Root POST, detail PATCH, väline send ja receiver workflow annavad `errorJson()`-ile otse `error?.message` väärtuse (`app/api/pre-inquiries/route.js:61-70`; `app/api/pre-inquiries/[id]/route.js:73-83`; `app/api/pre-inquiries/[id]/send/route.js:42-48`; `app/api/pre-inquiries/[id]/workflow/route.js:44-50`). `errorJson()` tagastab tundmatu võtme tõlke puudumisel sõna-sõnalt `messageKey`, `message` ja `error` väljades (`lib/documents/server.js:59-71`). Teised sama mooduli route'id kasutavad teadlikku `PUBLIC_ERRORS` allowlist'i või `publicErrorMessageKey()` filtrit.

**Mõju.** Prisma, PostgreSQL-i, SMTP või muu ootamatu erindi tekst võib jõuda autentitud kliendile koos tabeli-/välja-, hosti- või konfiguratsioonidetailiga. Eriti `/send` rajal võib maileri viga sisaldada infrastruktuuriinfot.

**Vastuvõtukriteerium.** Kõik eelpöördumise route'id peavad avaldama ainult kinnise stabiilsete 4xx võtmete allowlist'i; kõik muu on üldine 500 ja logis `safeError`. Route-testid peavad süstima Prisma ja maileri tundliku markeriga vea ning tõendama markeriteta vastuse.

**Seis (13.08.2026): DONE —** kõik eelpöördumise avalikud kirjutavad API-rajad kasutavad suletud veavastuste allowlist'i: lubatud 4xx võtmed säilitavad kontrollitud vastuse, tundmatu Prisma-, maileri- või muu sisemine viga muutub üldiseks 500 vastuseks ja logitakse `safeError` kujul. Negatiivtest süstis andmebaasiühendust ja SMTP saladust sisaldava markeri ning tõendas, et marker ei jõua vastusesse; neli varem lekkivat marsruuti ei väljasta enam `error.message` väärtust.

### SOL-PRE-16 — ühelgi 12 eelpöördumise route'il pole mahu- ega sageduspiiri — P1

**Tõend.** Staatiline kontroll leidis `app/api/pre-inquiries/**` all 12 route'i ja mitte üheski ei kasutata `consumeRateLimit`-i. Autenditud POST võib luua iga kord uue rea (`app/api/pre-inquiries/route.js:47-60`; `lib/preInquiries.js:1152-1248`), assistent loeb ühe päringuga kuni 1500 teenusekaardirida (`lib/preInquiries.js:1747-1789`), SENT-loomine saadab adressaadile saabumiskirja ning `/send` käivitab välise SMTP-kirja. Loomisel puudub idempotentsusvõti või kasutajapõhine aktiivsete kirjete piir.

**Mõju.** Üks autentitud konto saab tekitada piiramatult tundlikke mustandeid, pommitada opt-in adressaate uute pöördumiste/teavitustega, koormata teenusekaardi assistenti ja proovida väliseid kirju. UI topeltklikk võib samuti luua eraldi kirjed.

**Vastuvõtukriteerium.** Lisada toimingupõhised kasutaja/IP rate-limit'id, SENT/correction/send idempotentsusvõtmed ning mõistlikud aktiivse mahu piirid; lugemisdetail ja kasutaja enda andmete eksport ei tohi põhjendamatult sulguda. Testida topelt-submit, paralleelne sama võti, limiidi päised, adressaadi spam ja assistendi korduspäring.

**Seis (13.08.2026): DONE —** kõigil 12 kirjutaval eelpöördumise marsruudil on tegevuspõhine kasutaja- ja IP-piir koos 429, `Retry-After` ja `X-RateLimit` päistega. Aktiivseid DRAFT/READY/DOWNLOADED kirjeid võib olla kuni 250 ning piir jõustatakse kasutajapõhise PostgreSQL advisory lock'i all. Loomine kasutab kliendi UUID-võtit, sisu SHA-256 räsi ja unikaalset `[authorId, clientActionId]` piirangut: sama võti sama sisuga tagastab sama rea, teise sisuga 409. Päris PostgreSQL-i sond tõendas paralleelse loomise ühe rea, konfliktse korduse ja 251. aktiivse mustandi tagasilükkamise (`production runtime: NOT_PROVEN`).

### SOL-PRE-17 — pikk eelpöördumise sisu kärbitakse serveris vaikides — P1

**Tõend.** Üldine tekstinormaliseerija lõpetab väärtuse `slice(0,maxLength)`-iga: lühiväljad 1000 ja sisu 12 000 märki (`lib/preInquiries.js:53-54`, `:128-155`). Assessment'i tekstid ja massiivid kärbitakse samuti 4000/2000 märgi ning 24/40 elemendi juures (`lib/preInquiriesQuestionnaire.js:500-520`). Põhivormi teema- ja mustandiväljadel puudub `maxLength`, server tagastab eduka vastuse koos kärbitud väärtusega (`components/workspace/WorkspaceFeaturePage.jsx:2753-2758`).

**Mõju.** Pika olukorrakirjelduse või paranduse lõpus olev oht, nõusoleku erand, kontaktieelistus või inimese enda soov võib kaduda ilma hoiatuseta; kasutaja võib kärbitud versiooni kontrollimata saata. Edukas save ei tähenda sisendi täielikku round-trip'i.

**Vastuvõtukriteerium.** Üle piiri väärtus peab saama välja-põhise 400/413 vea või teadliku kinnitusega truncation-raporti; vaikne edu pole lubatud. UI peab näitama piire ja allesjäänud mahtu. Testida iga välja ja loendi piir-1/piir/piir+1 ning markerit täpselt kärbitava saba sees.

**Seis (13.08.2026): DONE —** kasutaja sisendi vaikne `slice`-kärbe eemaldati eelpöördumise ja struktureeritud eelkaardistuse normaliseerijatest. Teema, olukord, mustandid, parandustekst, assistendi sisend, küsimustiku tekstiväljad ja loendid valideeritakse enne töötlemist ning piir+1 annab välja- või hindamispõhise 413 vastuse ilma sabamarkerit kaotamata. UI kannab vastavaid `maxLength` piire ja järelejäänud märkide loendureid; testid katavad piiri, piir+1, sabamarkeri ja loendimahu.

### SOL-PRE-18 — eelpöördumiste loendid lõpevad vaikides 100/250 rea juures — P2

**Tõend.** Põhiloend võtab vaikimisi 100 ja maksimaalselt 250 kirjet ilma cursor'i või `hasMore` väljundita (`lib/preInquiries.js:686-698`; `app/api/pre-inquiries/route.js:28-40`). Vastuvõtja K1 adapteril on eraldi `take:100` (`lib/workspaces/adapters/preInquiryReceiverAdapter.js:101-114`) ning „Minu jagamised” loeb saadetud pöördumisi `take:250` (`lib/mySharings.js:208-241`). UI renderdab saadud massiivi täieliku tõena ega paku lehekülgi; ainult Journey `openInquiry` süvalink teeb ühe detail-fallback'i (`components/workspace/WorkspaceFeaturePage.jsx:1310-1356`).

**Mõju.** Pika ajalooga kasutaja vanemad mustandid, saabunud töö, parandusahelad või tagasivõetavad kirjed kaovad tavavaatest. Sama inimene näeb eri pindadel 100 ja 250 rea tõttu erinevat „kogu” ajalugu.

**Vastuvõtukriteerium.** Kõik kolm pinda peavad kasutama stabiilset cursor-paginatsiooni, minimaalset loendiprojektsiooni, koguarvu/`hasMore` märget ja detaili ID-lugejat. Testida üle 250 rea, võrdse ajatempliga järjestust, parandusahelat lehepiiril ja aktiivse/tagasivõetava kirje leitavust.

**Seis (13.08.2026): DONE —** eelpöördumise põhiloend, Minu jagamiste eelpöördumised ja K1 vastuvõtja adapter kasutavad stabiilset `(updatedAt, id)` kursorit, piiratud projektsiooni ning `total/hasMore/nextCursor` metaandmeid; ID-detaililugeja jääb autoriteetseks detailipinnaks. Põhivaade ja K1 läbivad kõik lehed ning Minu jagamised pakub jätkulaadimist. Testid ja päris PostgreSQL-i sond tõendasid 257 kirje täieliku leidmise, võrdsed ajatemplid, duplikaatide puudumise, arhiveeritud piirirea ning üle lehepiiri kulgeva parandusahela mõlemad otsad (`production runtime: NOT_PROVEN`).

### SOL-HELP-01 — tavaline kuulutuse tekstiparandus võib peidetud kaardikirje uuesti avaldada — P1

**Tõend.** `updateHelpRequest` ja `updateHelpOffer` salvestavad esmalt kuulutuse ning kutsuvad seejärel kaardisünkrooni ainult parajasti PATCH-is olnud kaardiväljadega (`lib/help/requests.js:297-374`; `lib/help/offers.js:293-369`; `lib/help/mapEntries.js:326-343`). Kui UI saadab tavapärase pealkirja/kirjelduse paranduse, ei saada ta `mapVisible`, `mapMode`, `contactMode` ega `mapStatus` väärtust (`components/alalehed/ChatBody.jsx:1728-1755`). Sünkroon asendab puuduvad väärtused vaikimisi kujuga `mapVisible:true`, `mapMode:AREA`, `contactMode:PLATFORM` ning kinnitatud kuulutuse korral `PUBLISHED` (`lib/help/mapEntries.js:145-200`, `:268-315`). Fake-DB kontrollis muutus varasem `mapVisible:false`, `PHYSICAL`, `EMAIL`, `HIDDEN` kirje ainult teksti PATCH-iga väärtusteks `true`, `AREA`, `PLATFORM`, `PUBLISHED`.

**Mõju.** Inimese teadlikult kaardilt peidetud abisoov või -pakkumine ilmub pärast sisulist parandust uuesti Teenusekaardile. Samal ajal kaovad valitud asukoharežiim ja kontaktiviis.

**Vastuvõtukriteerium.** Osaline PATCH peab säilitama kõik puuduvad kaardiväljad. Kaardiseadete muutmine peab nõudma väljade teadlikku saatmist ja stale-versiooni kontrolli; testida tekstiparandust vähemalt `HIDDEN`, `mapVisible:false`, `PHYSICAL` ja iga kontaktiviisi korral.

**Seis (13.08.2026): DONE —** osaline kuulutuse PATCH kasutab puuduvate kaardiväljade alusena olemasolevat `HelpMapEntry` kirjet ning muudab ainult teadlikult saadetud väärtusi. Tekstiparandus säilitab nähtavuse, kaardirežiimi, kontaktiviisi, staatuse, aadressi/geokodeeringu, teenindusala ja tarneviisid; kogu PATCH nõuab sama revisjoni. Negatiivkontrollis avaldas vana kood peidetud kirje uuesti; uus request/offer test katab `HIDDEN`, `mapVisible:false`, `PHYSICAL` ja kõik kontaktiviisid.

### SOL-HELP-02 — kuulutuse ja selle kaardikirje kirjutus ei ole atomaarne — P1

**Tõend.** Loomisel tehakse `helpRequest/helpOffer.create`, alles pärast seda eraldi `syncHelp*MapEntry`; muutmisel tehakse samamoodi põhikirje `update` ja seejärel eraldi `HelpMapEntry.upsert` (`lib/help/requests.js:203-239`, `:352-374`; `lib/help/offers.js:202-237`, `:347-369`). Ümber puudub ühine Prisma tehing.

**Mõju.** Geokodeerimise või map-entry kirjutusvea korral on kuulutus juba loodud/muudetud, kuid API või vestlus võib näidata ebaõnnestumist. Kordus võib luua teise kuulutuse; paranduse vea järel on ekraanil vana, andmebaasis uus sisu ning kaardil kolmas seis.

**Vastuvõtukriteerium.** Põhikirje ja tuletatud kaardikirje peavad valitud lepingus kas commit'ima ühes tehingus või kasutama idempotentset outbox/reconciler rada, mis tagastab tegeliku osalise seisu. Véasüst peab katma create/update järel nurjuva upsert'i ja korduspäringu.

**Seis (13.08.2026): DONE —** `HelpRequest`/`HelpOffer` create või update ja vastava `HelpMapEntry` upsert commit'ivad ühes Prisma tehingus. Kaardikirjutuse vea korral pöörduvad põhikirje sisu ja revisjon tagasi ning sama create kordus jätab ühe kuulutuse ja ühe kaardikirje. Vana käitumise negatiivkontroll jättis nurjunud kirjutuse järel põhikirje püsima; päris PostgreSQL-i veasüst kattis mõlema liigi create/update rollback'i ja korduspäringu.

### SOL-HELP-03 — kuulutuse redigeerimine kirjutab vana brauseriseisu konfliktita üle — P1

**Tõend.** UI PATCH ei saada `updatedAt`/versiooni (`components/alalehed/ChatBody.jsx:1728-1755`); route loeb omaniku, seejärel kutsub ID-põhist update'i (`app/api/help/listings/[kind]/[id]/route.js:173-203`). Teenuse `update` kasutab ainult `where:{id}` ja teeb pärast seda veel stale sisendiga kaardisünkrooni (`lib/help/requests.js:297-374`; `lib/help/offers.js:293-369`).

**Mõju.** Kaks akent või aeglane vastus võivad pealkirja, kirjelduse, kategooria, sihtrühma ja kaardiseaded märkamatult tagasi pöörata. Edukas vastus ei tõenda, et kasutaja redigeeris viimast versiooni.

**Vastuvõtukriteerium.** PATCH peab nõudma `expectedUpdatedAt` või versiooni ja tegema tingimusliku põhikirje ning kaardikirje uuenduse; konflikt tagastab 409 koos värske minimaalse vaatega. Lisada kahe paralleelse paranduse test.

**Seis (13.08.2026): DONE —** PATCH nõuab kehtivat `expectedUpdatedAt` väärtust ja põhikirjutus kasutab `id + updatedAt` CAS-i samas tehingus kaardisünkrooniga. Aegunud parandus saab 409 koos värske minimaalse kuulutuse ja kaardiseadete vaatega. Kahe sama revisjoniga paralleelparanduse test ja päris PostgreSQL-i sond annavad ühe võitja ning ühe konflikti nii abisoovile kui abipakkumisele.

### SOL-HELP-04 — omanik saab API kaudu teha suvalise kuulutuse olekusiirde — P1

**Tõend.** `normalizeStatus` lubab kõiki kuut olekut ning `updateHelpRequest/updateHelpOffer` kirjutab kliendi `status` väärtuse otse (`lib/help/requests.js:118-125`, `:310-334`; `lib/help/offers.js:117-124`, `:306-329`). Route kontrollib omanikku, kuid mitte lähteolekut, lubatud siiret, kinnitust ega põhjendust (`app/api/help/listings/[kind]/[id]/route.js:173-203`).

**Mõju.** `ARCHIVED`, `CANCELLED`, `CLOSED` või `MATCHED` kirje saab otse `OPEN`-iks muuta ja uuesti avaldada; `DRAFT` saab avaldada väljaspool vestluse kinnitusvoogu. Ajalugu ei erista parandust, taasavamist ega süsteemi olekut.

**Vastuvõtukriteerium.** Defineerida serveris olekumasin ja eraldi nimetatud toimingud koos põhjuse/auditiga. Üld-PATCH ei tohi muuta olekut; negatiivtestid peavad katma iga lubamatu siirde ja otse-URL-i.

**Seis (13.08.2026): DONE —** üld-PATCH lükkab otsese `status` muutmise tagasi. Nimetatud `PUBLISH`, `MARK_MATCHED`, `CLOSE`, `CANCEL`, `ARCHIVE` ja `REOPEN` toimingud järgivad serveri lähte- ja sihtolekute tabelit, nõuavad põhjust ning kirjutavad samas tehingus sisuminimaalse auditi ja kaardiseisu. Testid katavad mõlema kuulutuseliigi kõik lubatud ja lubamatud lähteolekud, puuduva põhjuse, aegunud versiooni, auditivea rollback'i ja route'i otsekutse lepingu.

### SOL-HELP-05 — vana nõusolekupäringu saab vastu võtta pärast kuulutuste sulgemist, aegumist või kokkusobimatuks muutmist — P1

**Tõend.** Sobituse loomisel kontrollitakse OPEN-olekut, aegumist ja sobivust (`lib/help/matches.js:305-349`, `:801-860`). `decideHelpMatch` kontrollib hiljem ainult PENDING-rida ja otsustajat; ta laeb kuulutused ning loob ruumi ilma filtrite uue hindamiseta (`lib/help/matches.js:863-907`). Fake-DB kontroll muutis mõlemad kuulutused `CLOSED`, aegunuks, eri kategooria/piirkonna/abi- ja ajatüübiga kirjeks, kuid `ACCEPT` lõppes ikkagi `ACCEPTED` ruumiga.

**Mõju.** Inimene võib nõustuda kontaktiga, mille algne alus on vahepeal tagasi võetud või sisuliselt muutunud. Ruum tekib aegunud või enam mitteavaliku kuulutuse põhjal.

**Vastuvõtukriteerium.** ACCEPT peab samas tehingus lukustama sobituse ja mõlemad allikad ning kontrollima uuesti olekut, tähtaega, omanikke ja kokkusobivust. Muutunud alus lõpetab PENDING-sobituse arusaadava 409/410 tulemusega.

**Seis (13.08.2026): DONE —** ACCEPT lukustab Serializable-tehingus sobituse, abisoovi ja abipakkumise ning kontrollib uuesti olekut, aegumist, omanikke ja sobivust. Muutunud alus sulgeb PENDING-sobituse ilma ruumi loomata ja API vastab 409; varem kinnitatud pehme abi- või ajatüübi erand säilib. Negatiivkontroll kattis suletud, aegunud, kokkusobimatu ja vahetunud omanikuga aluse; päris PostgreSQL-i sond tõendas luku ootamist ja värske oleku nägemist (`production runtime: NOT_PROVEN`).

### SOL-HELP-06 — sobituse teavitus ei ole sobituse loomisega usaldusväärselt seotud — P1

**Tõend.** HTTP-route loob PENDING-sobituse tehingus, kuid saadab teavituse alles pärast commit'i; teavituse viga satub üldisesse catch'i ning klient saab vea juba loodud sobituse kohta (`app/api/help/matches/route.js:41-101`). Kordus leiab sama paari `wasCreated:false` kujul ja teavitust enam ei saada (`lib/help/matches.js:832-859`; route `:70-79`). Vestluse connect-voog kutsub teenust otse ning neelab vead, aga ei loo üldse notification- ega auditikirjet (`lib/help/workflowActions.js:249-269`, `:486-618`).

**Mõju.** Nõusolekupäring võib olla andmebaasis olemas, kuid adressaat ei saa sellest teada; algatajale võidakse samal ajal öelda, et loomine ebaõnnestus. Recipient näeb seda ainult siis, kui satub Teenusekaardi 25-realisse järjekorda.

**Vastuvõtukriteerium.** Match ja notification/outbox sündmus peavad sündima samas tehingus ning kõik loomisteed kasutama sama teenust. Kordus peab taastama puuduva teavituse idempotentselt. Testida notification-write veasüsti ja vestluse connect-rada.

**Seis (13.08.2026): DONE —** PENDING-sobitus ja `HELP_MATCH_CONSENT_REQUEST` teavitussündmus luuakse samas teenuse tehingus ning nii route kui vestluse connect-rada kasutavad sama teenust. Teavituse veasüst pöörab tagasi sobituse ja teavituse; kordus ei loo duplikaati ning taastab puuduva teavituse idempotentselt. Päris PostgreSQL-i sond kattis tehingu ja taastamise (`production runtime: NOT_PROVEN`).

### SOL-HELP-07 — sobituse API lekitab privaatse vabateksti kattuvad märksõnad — P1

**Tõend.** Skoorija tokeniseerib mõlema kuulutuse pealkirja, kirjelduse, kokkuvõtte ja rollisildi ning paneb ühised sõnad `descriptionOverlap`/`roleLabelOverlap` väljadesse (`lib/help/matches.js:152-188`, `:221-274`, `:352-380`). Need salvestatakse `reasonsJson`-i ja route tagastab terve match-objekti (`lib/help/matches.js:846-857`; `app/api/help/matches/route.js:92-95`; otsuse route `:58`). Avalik projektsioon peidab teadlikult kogu selle vabateksti (`lib/help/listingViews.js:480-546`). Puhas kontroll kahe kirjeldusega tagastas `descriptionOverlap:["hiv","tugi"]`, kuigi avalik vaade näitaks ainult taksonoomiat.

**Mõju.** Otse-API kasutaja võib saada teise inimese peidetud tervise-, olukorra- või identifikaatorisõna pelgalt sobitust algatades või vastu võttes.

**Vastuvõtukriteerium.** Kliendile tagastatav match peab olema allowlist-projektsioon ilma `reasonsJson`, teiste kasutajate ID-de ja vabatekstitokeniteta. Sisemine skooripõhjendus peab kasutama koodistatud tunnuseid või jääma serverisiseseks; lisada tundliku kattuvussõna negatiivtest.

**Seis (13.08.2026): DONE —** sobituse loomise ja otsuse API-vastused läbivad täpse allowlist-projektsiooni: `id`, `status`, `roomId`, `createdAt`, `updatedAt` ja `wasCreated`. `reasonsJson`, skoor, osapoolte ja kuulutuste ID-d ning vabateksti kattuvused jäävad serverisse. Tundlike kattuvussõnade ja privaatsete ID-de negatiivtest tõendab nende puudumise vastusest (`production runtime: NOT_PROVEN`).

### SOL-HELP-08 — PENDING-sobitust ei saa tagasi võtta ega automaatselt aeguma panna — P1

**Tõend.** API-s on ainult loomine, saabuvate loend ja teise poole ACCEPT/DECLINE; algataja cancel/withdraw rada puudub. Skeemis pole match'i aegumisaega (`prisma/schema.prisma:3263-3289`). `listIncomingHelpMatches` võtab ainult 25 uusimat PENDING-rida ilma cursor'i või `hasMore`-ta (`lib/help/matches.js:910-938`).

**Mõju.** Ekslik või enam soovimatu nõusolekupäring jääb määramata ajaks kehtima ning teine pool saab selle hiljem vastu võtta. Üle 25 uuema päringu korral ei jõua vanemad otsustamis-UI-sse ja neid pole võimalik sulgeda.

**Vastuvõtukriteerium.** Lisada algataja tagasivõtt, serveripoolne aegumine ja pagineeritud järjekord. ACCEPT peab kontrollima, et päring pole tagasi võetud/aegunud; testida 26+ rida ja vana päringu hilist otsust.

**Seis (13.08.2026): DONE —** algataja saab PENDING-sobituse `WITHDRAW` toiminguga terminalsesse `CLOSED` olekusse viia ning hilisem ACCEPT vastab 409 ega loo ruumi. Saabuvate nimekiri sulgeb serveris aegunud või mitteavatud allikaga PENDING-sobitused ja kasutab stabiilset `createdAt + id` cursor-pagination'it. Test ja päris PostgreSQL-i sond läbisid kõik 27 rida kahe lehega ning tõendasid aegunud sobituse eemaldamist ja sulgemist (`production runtime: NOT_PROVEN`).

### SOL-HELP-09 — kuulutuse kustutamine eemaldab accepted-match'i, kuid jätab ruumi elama — P1

**Tõend.** Omanik või admin saab kuulutuse kustutada olekust sõltumata (`app/api/help/listings/[kind]/[id]/route.js:207-233`). `HelpMatch.request` ja `.offer` kasutavad `onDelete:Cascade`, kuid `Room` ei sõltu match'ist kustutuskaskaadiga; ruumis on ainult vabateksti `originId` (`prisma/schema.prisma:3263-3319`). Kustutusrada ei sulge ruumi, liikmeid ega kirjuta sobituse lõppauditit.

**Mõju.** ACCEPTED sobituse tõendi- ja nõusolekurida kaob, samal ajal kui osalejate ligipääs ning vestlusruum säilivad viitega olematule allikale. Hilisem audit ei suuda tõendada, miks ruum loodi.

**Vastuvõtukriteerium.** Aktiivse/accepted sobitusega kuulutust ei tohi kõva kustutusega eemaldada. Sulgemine peab säilitama minimaalse nõusolekutõendi, lõpetama või teadlikult säilitama ruumi ja kirjutama ühe atomaarse sündmuse; lisada accepted-listingu delete-test.

**Seis (13.08.2026): DONE —** ACCEPTED-sobitusega abisoovi või abipakkumise DELETE ei tee enam kõvakustutust: kuulutus viiakse atomaarse Serializable-tehinguga `CLOSED` olekusse ja kaardikirje peidetakse, samal ajal säilivad `HelpMatch` nõusolekutõend, ruum ning mõlema osalise liikmesusajalugu teadliku `PRESERVE_ROOM_AND_MEMBERSHIP_HISTORY` poliitikaga. Enne sulgemist kontrollitakse ruumi ja osaliste liikmesuste kooskõla; puudulik seos vastab 409 ega kirjuta osalist edu. Kohustuslik põhjusega audit tekib samas tehingus ja kordus ei dubleeri seda. Mõlemad HelpMatch-allikaseosed kasutavad nüüd `ON DELETE RESTRICT`; päris PostgreSQL-i sond kattis säilimise, välisvõtme ja rollback'i (`production runtime: NOT_PROVEN`).

### SOL-HELP-10 — mitmel abi- ja aadressiotsingu rajal puudub sageduspiir — P1

**Tõend.** Help'i juurloendil puudub limiter; detailfailis piiratakse ainult GET-i, mitte PATCH-i ega DELETE-i (`app/api/help/listings/route.js`; `app/api/help/listings/[kind]/[id]/route.js:132-143`, `:173-233`). Teenusekaardi aadressisoovituste route kutsub välist geokodeerijat ilma mahu- või sageduspiirita (`app/api/service-map/address-suggestions/route.js:35-69`).

**Mõju.** Autenditud konto saab tekitada suure päringu-/DB-koormuse, kurnata geokodeerija limiiti või korrata muutvaid toiminguid kiiremini, kui UI takistab.

**Vastuvõtukriteerium.** Rakendada kasutaja+IP+toimingu põhine jagatud limiter kõigile loetletud radadele, tagastada 429 ja piirata väliskutseid eraldi kvoodiga. Testida eri meetodeid, paralleelpäringuid ja mitut protsessi.

**Seis (13.08.2026): DONE —** kõik leius nimetatud rajad kasutavad PostgreSQL-is jagatud kasutaja+IP+toimingu põhist limiterit; välise geokodeerija kutsel on eraldi kvoot, ületamine tagastab 429 ja salvestuskihi puudumine sulgeb raja 503-ga. Migratsioon `20260814008000_sol_help_durable_rate_limit` lisab atomaarse loenduri ning päris PostgreSQL-i koondsond tõendas kahe paralleelse protsessi ühist limiiti ja toimingute eraldi kvoote. Production runtime: NOT_PROVEN.

### SOL-HELP-11 — pikk kuulutuse sisu kärbitakse edukal salvestusel vaikides — P1

**Tõend.** Pealkiri, kirjeldus ja kõik lisaväljad lõigatakse `slice`-iga 120–5000 märgini (`lib/help/requests.js:96-115`, `:208-225`; `lib/help/offers.js:95-114`, `:207-223`). ChatBody redaktor ei saada serverile versiooni ega piiride teadet ning käsitleb 200 vastust täieliku eduna (`components/alalehed/ChatBody.jsx:1728-1768`).

**Mõju.** Kirjelduse lõpus olev piirang, oht, tasutingimus, aeg või ligipääsetavusnõue võib kaduda ilma hoiatuseta; hilisem sobitamine ja jagamine kasutavad kärbitud teksti.

**Vastuvõtukriteerium.** Üle piiri sisend peab saama välja-põhise 400/413 vea või kasutajale nähtava truncation-raporti. UI näitab limiite; testida piir-1/piir/piir+1 ning kriitilist markerit kärbitavas sabas.

**Seis (13.08.2026): DONE —** abisoovi ja abipakkumise kasutajateksti ei kärbita enam edukal salvestamisel vaikides. Keskseid piire ületav sisend saab välja, piiri ja tegeliku pikkusega 413 vastuse; redaktor rakendab `maxLength` piirid ja näitab tähemärgiloendurit. Piir-1, piiri ja piir+1 kontrollid katavad kõik tekstiväljad ning sabamarker ei salvestu kärbitult. HELP-eelvaate vigased kodeeringufallback'id parandati ja inimkeelsed tekstid lisati ET/EN/RU kataloogidesse. Brauseri kordustest: NOT_PROVEN.

### SOL-HELP-12 — Teenusekaardi abiotsing filtreerib alles pärast 1000 uusima kirje võtmist — P2

**Tõend.** `listPublishedHelpMapEntries` piirab DB-päringu maksimaalselt 1000 reale ning rakendab märksõna ja piirkonnanime filtrid alles JavaScriptis pärast `findMany` tulemust (`lib/help/mapEntries.js:433-537`). Route ei väljasta cursor'it, koguarvu ega `hasMore` märget (`app/api/service-map/entries/route.js:17-52`).

**Mõju.** Üle 1000 avaliku kirje korral võib täpne sobiv vanem abipakkumine olla andmebaasis, kuid otsing ütleb „ei leitud”. Koormus kasvab iga päringuga kuni täisplokini.

**Vastuvõtukriteerium.** Filtrid tuleb viia DB-päringusse või otsinguindeksisse ning kasutada stabiilset cursor-paginatsiooni. Testida 1001+ kirjet, vanemat täpset vastet ja võrdse `updatedAt`-ga ridu.

**Seis (13.08.2026): DONE —** HELP-kaardikirjete märksõna- ja piirkonnafiltrid rakenduvad DB-päringus enne `take`-piiri ning lehitsemine kasutab stabiilset `(updatedAt,id)` cursor'it koos `page` plokiga. Päris PostgreSQL-i sond leidis täpse vanema vaste 1002 kirje tagant ning läbis võrdse `updatedAt` väärtusega read kadude ja duplikaatideta. Production runtime: NOT_PROVEN.

### SOL-HELP-13 — abi vahendamise olekumudeli mitu seisundit ei ole tootmiskoodis saavutatavad — P2

**Tõend.** `HelpRecordStatus.MATCHED` ning `HelpMatchStatus.CONTACTED/CLOSED` on skeemis olemas (`prisma/schema.prisma:499-560`), kuid abi tootmiskood ei kirjuta neid üheski nimetatud toimingus. ACCEPT uuendab ainult `HelpMatch`-i `ACCEPTED`-iks ega muuda request/offer olekut (`lib/help/matches.js:890-906`). Omaniku OPEN-kirje jääb pärast sobitamist avalikuks ja uuesti sobitatavaks.

**Mõju.** UI/analüütika olekud ei kirjelda tegelikku elutsüklit ning ühekordne või juba lahendatud vajadus võib jätkata avalikku sobitamist. Pole serveripoolset „kontakt alustatud” ega „sobitus lõpetatud” rada.

**Vastuvõtukriteerium.** Otsustada, kas üks kuulutus lubab üht või mitut aktiivset sobitust, ning rakendada vastav olekumasin. Kasutamata enumid eemaldada või siduda atomaarsete toimingute ja testidega.

**Seis (13.08.2026): DONE —** rakendatud poliitika on üks aktiivne aktsepteeritud sobitus kuulutuse kohta. ACCEPT viib mõlemad allikad samas Serializable-tehingus `MATCHED` olekusse, peidab kaardikirjed ning loob ja seob ruumi; esimene HELP_MATCH-ruumi sõnum viib sobituse `CONTACTED` olekusse ning ruumi arhiiv lõpetab sobituse ja allikad `CLOSED` olekusse. Nõusolekutõend, ruum ja liikmesusajalugu säilivad allikakuulutuse kustutussoovi järel. Sihttestid ja päris PostgreSQL-i koondsond tõendasid olekud, kaardinähtavuse ja rollback'i. Production/browser runtime: NOT_PROVEN.

### SOL-NET-01 — paralleelne muutmine võib kinnitada teksti, mida klient ei näinud — P0

**Tõend.** `updateNetworkShareDraft` ja `clientRespondToShare` loevad mõlemad rea, kontrollivad olekut mälus ning kirjutavad hiljem ainult `where:{id}` alusel (`lib/network/share.js:261-307`, `:324-356`). Fake-DB paralleelkontroll lasi mõlemal lugeda sama `AWAITING_CLIENT` seisu, rakendas esmalt uue teksti/DRAFT-i ja siis vana vaate kinnituse: lõpptulemus oli `CONFIRMED`, `summaryText:"UUS KINNITAMATA TEKST"`, `clientConfirmedAt` olemas.

**Mõju.** Platvormi põhivärav „klient kinnitab täpselt seda, mida jagatakse” ei pea samaaegsuse korral. Uus sisu saab vana nõusoleku ning muutub saatmiskõlblikuks.

**Vastuvõtukriteerium.** Kinnitus peab viitama külmutatud sisuversioonile/hashile ja kasutama atomaarset tingimuslikku update'i (`status=AWAITING_CLIENT` + versioon). Paralleelne edit-vs-confirm test peab lubama ainult ühe võitja ning vana kinnitus ei tohi uuele sisule kanduda.

**Seis (10.08.2026): DONE — kinnitus viitab TEKSTILE, mitte reale. Sond `npm run net:share:probe` 30/30 päris PostgreSQL-is.**

Kaks uut veergu (migratsioon `20260810180000`): `contentHash` (sha256 jagatavast
sisust, arvutatakse igal kirjutusel) ja `confirmedContentHash` (see, MIDA klient
kinnitamise hetkel nägi). Kinnitus kirjutatakse tingimuslikult:
`updateMany({ status: AWAITING_CLIENT, contentHash: <loetud räsi> })` — kui töötaja jõudis
vahepeal muuta, langeb tingimus **andmebaasis**, `count` on 0 ja klient saab
`network_share.content_changed` (409). Vana kinnitus ei saa uuele tekstile kanduda, sest
ta ei jõua reale, mille räsi on muutunud.

Lisaks võtab kinnitus vastu valikulise **`expectedContentHash`** — räsi, mille klient
ekraanil nägi. See on tugevam tõend kui serveri enda lugemine millisekund tagasi: ta katab
ka „klient luges lehte tund aega tagasi" juhtumi, mida tingimuslik kirjutus üksi ei kata.

**Kanooniline string on JS-is ja SQL-is SAMA** — väljad eraldajaga `\x1E`, mis ei saa
kasutaja tekstis olla, aga on Postgresi `text`-is lubatud (erinevalt `\x00`-st, mille peale
`convert_to` kukuks). Pariteet on **mõõdetud, mitte eeldatud**: sama sisend annab
`computeShareContentHash`-ist ja migratsiooni SQL-ist identse räsi, ja kolmel olemasoleval
lokaalsel real langes backfill JS-arvutusega kokku. Toodangus on `NetworkShare` **tühi**
(mõõdetud), seega `contentHash NOT NULL` ei ohustanud ühtki rida.

**Kogu faili vana muster oli sama viga:** „loe rida → kontrolli mälus → kirjuta
`where:{id}`". Parandus ei ole seepärast kahes funktsioonis, vaid ühes primitiivis
(`commitOnce`), mida kasutavad muutmine, ülevaatamisele saatmine, kinnitus, ülekantud
kinnitus, avamine ja tagasivõtmine. Avamine-vs-tagasivõtmine oli **sama klassi leid, mida
raportis ei olnud**: mõlemad lähtusid seisust `SENT` ja viimane kirjutaja määras tulemuse.

**Sond on deterministlik, mitte `Promise.all`-lootus:** hoia tehingut, mis on rea luku juba
võtnud → käivita teine pool → **mõõda et ta OOTAB** → lase lukk lahti → mõõda tulemust.
Kaetud on mõlemad järjestused: muutmine-enne-kinnitust (kinnitus kukub, rida jääb
mustandiks, `clientConfirmedAt` on `null`) ja kinnitus-enne-muutmist (muutmine kukub, tekst
jääb selleks, mida klient kinnitas).

**Negatiivkontroll: sond vana käitumise vastu 14 passed / 16 failed** — sh sõna-sõnalt
leiu tekst: „muutmine enne: kinnitus lükatakse tagasi — **kinnitus õnnestus**" ja „rida
jääb mustandiks — **CONFIRMED**". Ühiktestide fake sai samas parandatud: ta tagastas
lugemisel **sama objektiviite**, seega samaaegne kirjutus muutis rida, mida lugeja juba käes
hoidis — just see peitis selle veaklassi. Nüüd annab ta hetktõmmise, nagu päris Prisma.

**Väravad:** `npm test` 3402/3402 · `i18n:check` OK · `db:migrate:check` OK · eslint puhas ·
`npm run net:share:probe` 30/30.

**NOT_PROVEN:** brauserist läbi käimata — võrgustikujagamise UI vajab kolme rolli korraga
(töötaja, klient, saaja) ja see on eraldi istumine. Kogu rada on tõendatud teenuse- ja
andmebaasitasemel, sh HTTP-veakoodid (`content_changed`, `concurrent_change`,
`confirmation_stale` → 409).

### SOL-NET-02 — paralleelne muutmine ja saatmine võivad edastada kinnitamata uue teksti — P0

**Tõend.** Saatmine loeb `CONFIRMED` rea ning kontrollib `clientConfirmedAt`, seejärel loob ruumi ja teeb hiljem tingimusteta ID-update'i `SENT` olekusse (`lib/network/share.js:416-437`). Paralleelne edit saab vahepeal kirjutada uue teksti, `DRAFT` oleku ja nullida kinnituse (`:272-307`). Fake-DB kontroll rakendas edit'i enne saatmise lõpp-update'i: lõpp oli `SENT`, uus kinnitamata tekst, `clientConfirmedAt:false` ja aktiivne `roomId`.

**Mõju.** Saaja saab teksti, mille klient pole kinnitanud; see on otsene nõusoleku- ja andmejagamispiiri rikkumine.

**Vastuvõtukriteerium.** Saatmine peab ühes tehingus tingimuslikult lukustama sama kinnitatud sisuversiooni ja looma ruumi/outbox-sündmuse. Edit-vs-send võidujooksus peab ainult üks toiming commit'ima; `SENT` rida ei tohi kunagi eksisteerida ilma sama versiooni kinnitustõendita.

**Seis (10.08.2026): DONE — `SENT` nõuab sama versiooni kinnitustõendit. Sama sond, `net:share:probe` 30/30.**

Saatmine teeb nüüd kolm asja, mida ta enne ei teinud:

1. **Väravas** nõuab, et `confirmedContentHash === contentHash` — olek `CONFIRMED` üksi
   ütleb ainult, et KUNAGI kinnitati, mitte MIDA. Aegunud kinnitus annab
   `network_share.confirmation_stale`.
2. **Nõuab rea tingimuslikult endale ENNE ruumi loomist**
   (`updateMany({status: CONFIRMED, contentHash, confirmedContentHash})`). Vana järjekord
   (ruum enne olekut) tekitas kaks viga korraga: kaotanud saatmine jõudis ruumi luua ja
   liikmed sisse panna, ja ruumi loomise tõrge jättis jagamise `CONFIRMED`-iks, ruum aga
   alles.
3. **Kõik ühes tehingus** — ruumi port saab nüüd `db` kutsujalt (`createRoomPort()` ei
   kasuta enam alati globaalset klienti), seega ruumi loomise tõrge keerab ka `SENT` tagasi.

**Tõendatud päris andmebaasis:** muutmine-enne-saatmist → saatmine kukub
`concurrent_change`-iga, `SENT` rida ei teki, `sentAt` on `null` ja **ruumide arv ei
muutu**. Süstitud ruumitõrge → jagamine jääb `CONFIRMED`-iks, `sentAt` `null`, ruume ei
lisandu. **Kaks paralleelset saatmist → täpselt üks võitja ja täpselt üks ruum.**

**Sellest kriteeriumist jäi katmata `outbox-sündmus`** — võrgustikujagamisel ei ole täna
ühtki domeenisündmust ega teavitust ja see on SOL-NET-10 sisu, mitte selle leiu oma. Siin
on tehtud see osa, mis kriteeriumis nimetatud: ruum ja olek sünnivad ühes tehingus.

**Vana käitumise vastu jooksutatuna** langes sond just nendel ridadel: „SENT rida EI
TEKKINUD — **SENT**", „kaotanud saatmine ei jätnud orbu ruumi — **7 → 8**", „kaks saatmist:
täpselt üks võidab — **2 võitjat**", „tekkis TÄPSELT üks ruum — **9 → 11**".

**NOT_PROVEN:** `Room(originType, originId)` unikaalindeksit **ei lisatud** — SOL-NET-03
nõuab teda eraldi. Täna hoiab ühe ruumi invariandi tingimuslik nõudmine (kaotaja ei jõua
ruumi loomiseni) ja see on tõendatud kahe paralleelse saatmisega; DB-tasandi lukku selle
taga veel ei ole.

### SOL-NET-03 — ruum ja liikmed luuakse enne jagamise saatmisoleku commit'i — P1

**Tõend.** `sendNetworkShare` kutsub `createRoom`-i enne `networkShare.update`-i (`lib/network/share.js:427-437`). Päris port kasutab globaalset Prismat ja loob kohe Room/RoomMember read (`lib/network/shareRoutes.js:71-74`; `lib/network/shareRoom.js:36-80`). Fake-DB veasüstis loodi ruum edukalt, järgneva jagamisrea kirjutusviga jättis share'i `CONFIRMED` olekusse. Ka kaks paralleelset send'i võivad enne kummagi `roomId` salvestamist luua eri ruumid; skeemis pole `Room(originType,originId)` unikaalsust (`prisma/schema.prisma:3291-3319`).

**Mõju.** Saaja ja klient võivad saada ruumiliikmeks, kuigi jagamine pole serveri järgi saadetud; kordus või võidujooks võib jätta aktiivse orb-ruumi, mida share enam ei viita.

**Vastuvõtukriteerium.** Ruum, liikmed, share'i olek ja outbox peavad sündima ühes DB-tehingus või kompenseeriva idempotentse protsessiga. Andmebaas peab takistama mitut ruumi sama origin'i kohta; testida room-create järel update-viga ja kahte paralleelset send'i.

**Seis (13.08.2026): DONE —** `sendNetworkShare` nõuab jagamise tingimuslikult endale ja loob `SENT` oleku, ruumi, liikmed, `roomId` seose ning sisuvaba outbox-rea ühes Serializable PostgreSQL-i tehingus. Ruumi- või outbox-tõrge pöörab kogu saatmise tagasi ning kirjutuskonflikt muutub avalikuks veaks. Migratsioon `20260813235900_sol_net_03_room_origin_unique` laiendab osalise unikaalindeksi `NETWORK_SHARE` päritolule. Päris PostgreSQL-i sond tõendas rollback'id, kahe paralleelse saatmise ühe võitja ja DB-tasandi ühe ruumi piiri. NOT_PROVEN: toodangu migratsioon ja deploy.

### SOL-NET-04 — saaja loeb kogu sisu enne, kui süsteem märgib selle avatuks — P1

**Tõend.** Recipient-list tagastab juba `SENT` olekus `summaryText`, eesmärgi ja jagamispiiri (`app/api/network-shares/route.js:77-86`; `lib/network/share.js:471-486`). Inbox renderdab need kohe ja pakub eraldi käsitsi nuppu „Olen läbi lugenud”; ruumi saab avada ka seda nuppu vajutamata (`components/network/NetworkShareInbox.jsx:88-117`). Tagasivõtmine kontrollib ainult formaalset olekut `SENT` ning muudab üksnes share'i staatust, mitte olemasolevat RoomMember ligipääsu (`lib/network/share.js:440-460`).

**Mõju.** Töötaja võib jagamise edukalt tagasi võtta pärast seda, kui saaja on sisu tegelikult näinud. `openedAt` on enesekinnitus, mitte esimese avaldamise audit; tagasivõetud saaja jääb loodud ruumi liikmeks.

**Vastuvõtukriteerium.** Tundlik detail tuleb väljastada eraldi serveritoiminguga, mis märgib avamise atomaarseks enne sisu vastust. Recall peab eemaldama veel avamata saaja ruumiligipääsu või ruum ei tohi enne avamist eksisteerida. Testida inbox-load'i, room deep-link'i ja recall'i võidujooksu.

**Seis (13.08.2026): DONE —** saaja nimekiri tagastab enne avamist ainult sisuvaba ümbriku; tundlik sisu ja ruumiviide jõuavad brauserisse eraldi `/open` operatsiooni vastuses pärast tingimuslikku `OPENED` kirjutust. Keskne ruumivärav keelab saaja `SENT` ruumi otselingi ning tagasivõtmine eemaldab avamata saaja ruumiligipääsu samas tehingus. Sihttestid ja päris PostgreSQL-i sond tõendasid ümbriku, avamise, detaili, otselingi ning avamise/recall'i võistluse. Autenditud visuaalne brauserirada ja production runtime: NOT_PROVEN.

### SOL-NET-05 — kohustuslik kaasamise lõppkuupäev ei lõpeta ligipääsu — P1

**Tõend.** Kuupäeva kontrollitakse ainult mustandi loomisel/muutmisel (`lib/network/share.js:131-152`, `:272-307`). Saatmine ja recipient-projektsioon ei võrdle seda praeguse ajaga (`:416-437`, `:471-486`); koodibaasis pole NetworkShare'i `ENDED`-iks viivat sweep'i ega RoomMember ligipääsu lõpetamist. Fake-DB kontroll saatis 1.08 lõppenud jagamise 9.08 edukalt `SENT` olekusse.

**Mõju.** „Kaasamine lõpeb” on ainult kuvatav tekst. Saaja saab pärast tähtaega jagamise vastu võtta, lugeda ja ruumi kasutada määramata aja.

**Vastuvõtukriteerium.** Saatmine peab aegunud jagamisest keelduma; scheduler lõpetab tähtajal share'i ja seotud välise ligipääsu idempotentselt. Kõik detaili/ruumi autoriseerimised peavad lõppkuupäeva jõustama serveris. Testida piiri eel, piiril, järel ja nurjunud sweep'i taastamist.

**Seis (13.08.2026): DONE —** lõppkuupäev on serveripoolne ligipääsupiir: saatmine ja avamine keelduvad tähtajale järgneval UTC päeval, detailiprojektsioon ja keskset väravat kasutavad ruumirajad sulguvad ning lõppkuupäeva enda jooksul jääb ligipääs kehtima. Teavitustööga ühendatud idempotentne sweep viib aegunud jagamise `ENDED` olekusse, eemaldab aktiivsed ruumiliikmed ja arhiveerib ruumi ühes tehingus; tõrke järel saab töö korduda. Sihttestid ja päris PostgreSQL-i sond tõendasid piire, rollback'i ja kordust. Production cron ja monitooring: NOT_PROVEN.

### SOL-NET-06 — välise kliendi raamlepingut kontrollitakse ainult mustandi loomisel — P1

**Tõend.** Välise kliendi korral küsib `createNetworkShare` töötaja ja saaja kehtivat raamlepingu staatust (`lib/network/share.js:213-240`). Hilisem submit, attestation ja send ei kutsu kontrolli uuesti (`:310-437`); send-route annab kaasa ainult ruumi loomise pordi (`app/api/network-shares/[shareId]/send/route.js:12-23`).

**Mõju.** Pärast mustandi loomist aegunud või tagasi võetud raamlepingu alusel saab mittekasutaja andmed hiljem ikkagi saata ja ruumi avada.

**Vastuvõtukriteerium.** Kehtiv alus tuleb uuesti kontrollida vähemalt kliendi otsuse ülekandmisel ja saatmise atomaarse commit'i sees. Testida töötaja ning saaja lepingu kehtivuse kadumist pärast DRAFT-i ja pärast CONFIRMED olekut.

**Seis (13.08.2026): DONE —** välise kliendi rajal kontrollitakse töötaja ja saaja kehtivat praeguse versiooni raamlepingu aktsepti uuesti nii kliendi otsuse ülekandmisel kui ka Serializable saatmistehingu sees enne `SENT`, ruumi ja outbox'i loomist. Sihttestid ja päris PostgreSQL-i sond tõendasid töötaja aktsepti kadumist pärast DRAFT-i ning saaja aktsepti kadumist pärast CONFIRMED olekut; mõlemad suleti 403 veaga ilma ruumi või saatmisolekuta. Production runtime ja deploy: NOT_PROVEN.

### SOL-NET-07 — tagasivõetud või saatmata eelpöördumisest saab luua uue võrgustikujagamise — P1

**Tõend.** `createNetworkShare` laeb lähte-eelpöördumise ja kontrollib ainult, et `recipientOwnerId === workerId`; `status`, `sentAt`, `recalledAt`, supersede-seos ega aktiivne tööülesanne pole tingimuses (`lib/network/share.js:193-203`). POST-route annab kasutaja valitud `sourcePreInquiryId` otse teenusele (`app/api/network-shares/route.js:45-61`).

**Mõju.** Töötaja saab pärast inimese tagasivõtmist või vana parandusahela sulgemist koostada uue jagamise, küsida kinnitust ja saata selle kolmandale osapoolele.

**Vastuvõtukriteerium.** Lähteallika lubatud olek, saajasuhe ja parandusahela aktiivne versioon tuleb defineerida ning kontrollida loomisel ja uuesti saatmisel. RECALLED/superseded/saatmata allika test peab fail-closed keelduma.

**Seis (13.08.2026): DONE —** võrgustikujagamise loomine ja saatmine kontrollivad esialgsel laadimisel ja tehingu sees, et lähte-eelpöördumine kuulub praegusele töötajale, on päriselt saadetud, pole tagasi võetud ega uuema parandusega asendatud. Sihttestid ja päris PostgreSQL-i sond tõendasid RECALLED-, superseded- ja saatmata allika fail-closed keeldumist. Production runtime: NOT_PROVEN.

### SOL-NET-08 — rolli kaotanud endine töötaja säilitab jagamiste täisvaate ja muutmistoimingud — P1

**Tõend.** Töötajarolli kontroll `isNetworkWorker` on ainult juur-POST-is ja worker-loendis (`app/api/network-shares/route.js:24-28`, `:114-120`). Detail-PATCH, submit, attest, send ja recall nõuavad ainult autentitud kasutajat; domeen kontrollib, et ID võrdub algse `workerId`-ga (`app/api/network-shares/[shareId]/**`; `lib/network/share.js:261-265`). Detail-GET tagastab algsele workerId-le täisprojektsiooni sõltumata praegusest rollist (`app/api/network-shares/[shareId]/route.js:20-35`).

**Mõju.** Teenuseosutaja/sotsiaaltöötaja rollist eemaldatud konto saab jätkuvalt lugeda kliendi identiteeti ja otsuse tõendit, muuta kokkuvõtet, kanda välise kliendi nõusolekut üle ning saata andmed.

**Vastuvõtukriteerium.** Iga töötajatoiming ja täisvaade peab kontrollima praegust rolli ning vajadusel organisatsiooni/ülesande aktiivset seost. Rolli kaotuse järel peavad detail ja kõik mutatsioonid fail-closed sulguma; lisada sessioonist sõltumatu serveritest.

**Seis (13.08.2026): DONE —** töötaja täisdetail, PATCH, submit, attestation, send ja recall kontrollivad lisaks algsele `workerId` seosele sessiooni praegust lubatud töötajarolli. Rolli kaotanud konto detail sulgub üldise 404-ga ja mutatsioonid 403-ga; sessioonist sõltumatu serveritest kontrollib väravat kõigis töötajaradades. Production autentitud runtime: NOT_PROVEN.

### SOL-NET-09 — kontoga klient saab otse-API kaudu näha veel esitamata töötaja mustandit — P1

**Tõend.** `GET /api/network-shares?role=client` filtreerib ainult `clientUserId`, mitte staatust, ja tagastab kokkuvõtte, eesmärgi ning jagamispiiri ka DRAFT-is (`app/api/network-shares/route.js:89-111`). Sama teeb detail-GET kliendiharus (`app/api/network-shares/[shareId]/route.js:36-52`). „Minu jagamiste” koond filtreerib DRAFT-id õigesti välja, kuid otserajad jäävad laiemaks.

**Mõju.** Töötaja pooleli olev, sisemiste märkmete või parandamata isikuandmetega tekst on kliendile loetav enne toimingut „Saada kliendile ülevaatamiseks”. Kliendivaate eri pinnad räägivad erinevat tõde.

**Vastuvõtukriteerium.** Kliendi list/detail peab lubama vähemalt `AWAITING_CLIENT` ja teadlikult defineeritud hilisemad olekud, mitte DRAFT-i. Kõik kliendipinnad kasutavad üht projektsiooni- ja olekupoliitikat; lisada otse-API DRAFT negatiivtest.

**Seis (13.08.2026): DONE —** kliendi list ja detail kasutavad sama allowlist-projektsiooni ning lubavad ainult `AWAITING_CLIENT` ja teadlikult defineeritud hilisemad olekud. DRAFT ei jõua kummastki otse-API pinnast kliendini; negatiivtest tõendab fail-closed null/404 käitumist. Production autentitud runtime: NOT_PROVEN.

### SOL-NET-10 — võrgustikujagamise elutsüklis puuduvad teavitused, outbox ja audit — P1

**Tõend.** Kaheksa `app/api/network-shares/**` route'i ei impordi ega kirjuta `NotificationEvent`, `DomainEvent` ega andmeauditit. Submit, kliendi otsus, attestation, send, open ja recall teevad ainult põhirea/ruumi muutuse. Kliendi ja saaja UI-d leiavad töö üksnes lehe avamisel tehtava polling-GET-iga (`components/sharings/MySharingsPage.jsx:173-204`; `components/network/NetworkShareInbox.jsx:34-51`).

**Mõju.** Klient ei pruugi teada, et temalt oodatakse otsust; saaja ei pruugi teada, et jagamine saabus; töötaja ei pruugi teada otsusest. Hilisem audit ei näita usaldusväärselt, kes millise jagamispiiri millal aktiveeris või tagasi võttis.

**Vastuvõtukriteerium.** Iga oluline siire peab kirjutama samas tehingus minimaalse DomainEvent/outbox'i; projector loob idempotentse teavituse. Nõusoleku- ja saatmisaudit säilitab ID-d/koodid, mitte vabateksti. Testida projector maas, kordus ja osaline delivery-viga.

**Seis (13.08.2026): DONE —** CREATE, UPDATE, SUBMIT, DECIDE, ATTEST, SEND, OPEN, RECALL, RESPOND ja END siirded kirjutavad olekuga samas DB-tehingus minimaalse `DomainEvent`/outbox-rea ja `DataAuditLog`-i ilma vabatekstita. Projector loob adressaadipõhised idempotentsed teavitused; testid ja päris PostgreSQL tõendasid projectori seisu, kordust ning osalise tarne vea järel taastumist. Production projectori käitus: NOT_PROVEN.

### SOL-NET-11 — ühelgi kaheksast võrgustikujagamise route'il pole sageduspiiri — P1

**Tõend.** `app/api/network-shares/**` kaheksa route'i ei kasuta `consumeRateLimit`-i. See hõlmab tundlikku loomist, detaili, submit'i, kliendi otsust, töötaja attestation'it, send'i, open'it ja recall'i.

**Mõju.** Kompromiteeritud või pahatahtlik konto saab kiiresti enumerate'ida ID-sid, tekitada DB/ruumikoormust ja võimendada just neid võidujookse, mille puhul teenus kasutab tingimusteta update'e.

**Vastuvõtukriteerium.** Rakendada kasutaja+IP+toimingu limiter ning mutatsioonidele idempotency key/replay-kaitse. Testida paralleelset limiidi ületamist mitme protsessi vastu.

**Seis (13.08.2026): DONE —** kõik võrgustikujagamise route'id kasutavad püsivat PostgreSQL-i kasutaja+toimingu piirangut ning usaldatud proxy-aadressi korral ka IP+toimingu piirangut. Mutatsioonid nõuavad `Idempotency-Key` päist, leiavad püsiva replay uues protsessis ja seovad korduse õige ressursiga. PostgreSQL-i sondi kaheksa eraldi protsessi lubasid täpselt kolm katset ja tõrjusid viis; ühine IP-piir rakendus eri kasutajatele. Production proxy-headeri seadistus: NOT_PROVEN.

### SOL-NET-12 — võrgustikujagamise loendid lõpevad 100 rea juures ilma paginatsioonita — P2

**Tõend.** Recipient-, client- ja worker-loendid kasutavad kõik `take:100`; vastus ei sisalda cursor'it, `nextOffset`-i ega koguarvu (`app/api/network-shares/route.js:70-120`). UI filtreerib worker-loendi alles brauseris ühe eelpöördumise ID järgi (`components/network/NetworkShareComposer.jsx:48-58`).

**Mõju.** Pika ajalooga töötaja konkreetne aktiivne jagamine või kliendi otsust ootav rida võib uuemate 100 kirje taha kaduda. Sama endpoint veab iga eelpöördumise komponendi jaoks kogu 100-realise täisprojektsiooni.

**Vastuvõtukriteerium.** Lisada serveripoolne source/status filter ja stabiilne cursor-paginatsioon minimaalse loendiprojektsiooniga. Testida 101+ rida, vanemat aktiivset jagamist ja võrdse ajatempliga järjestust.

**Seis (13.08.2026): DONE —** worker-, client- ja recipient-loendid kasutavad stabiilset `updatedAt + id` cursor-paginatsiooni, serveripoolseid source/status filtreid, rollipõhist minimaalset projektsiooni ja `nextCursor` vastust. Mõlemad UI-tarbijad loevad kõik lehed; PostgreSQL-i sond ja sihttest tõendasid 103 võrdse ajatempliga kirje täielikku duplikaadivaba läbimist. Production suurandmete runtime: NOT_PROVEN.

### SOL-NET-13 — `RESPONDED` ja `ENDED` olekud ning tähtajaline ligipääsu lõpetamine on teostamata — P2

**Tõend.** Enum ja JS-konstandid sisaldavad `RESPONDED`/`ENDED` (`prisma/schema.prisma:5797-5807`; `lib/network/share.js:48-58`), kuid tootmiskoodis pole kumbagi olekut kirjutavat teenust ega route'i. Recipient UI avab üksnes üldise ruumi; ruumis vastamine ei uuenda NetworkShare'i. `participationEndsOn` läheb ruumi metaandmeks, mitte autoriseerimisreegliks (`lib/network/shareRoom.js:60-69`).

**Mõju.** Töötaja vaade ja analüütika ei saa eristada vastatud jagamist lihtsalt avatust ning „lõppenud” kaasamine ei jõua kunagi lõppolekusse. Elutsükli lubatud lõpp on skeemis, mitte päriskäitumises.

**Vastuvõtukriteerium.** Siduda esimene lubatud vastus idempotentselt `RESPONDED` siirdega ning tähtaja/sulgemise töövoog `ENDED` oleku ja RoomMember ligipääsu lõpetamisega. Kui neid olekuid ei vajata, eemaldada need ja dokumenteerida tegelik leping.

**Seis (13.08.2026): DONE —** saaja esimene lubatud ruumisõnum viib seotud jagamise idempotentselt `RESPONDED` olekusse samas sõnumitehingus. Tähtaja sweep viib jagamise `ENDED` olekusse, kirjutab elutsüklisündmuse ja lõpetab samas tehingus aktiivsed ruumiliikmesused. Sihttestid ja PostgreSQL-i sond tõendasid RESPONDED siirde, ENDED rollback/retry ning kogu ruumipääsu eemaldamise. Production ajastatud sweep: NOT_PROVEN.

### SOL-REF-01 — sama refleksiooni paralleelsed muutmised kirjutavad üksteise vaikides üle — P1

**Tõend.** PATCH-payload ei kanna `updatedAt`-i ega versiooni ning `updatePracticeReflectionForUser()` teeb tingimusteta `updateMany({ where:{id,ownerUserId}, data })` (`lib/reflection/records.js:201-228`). UI saadab ainult vormiväljad (`components/reflection/ReflectionPage.jsx:195-225`). Fake-DB negatiivkontrollis võeti kaks samast vanast seisust PATCH-i vastu ja lõppväärtuseks jäi üksnes teise kirjutaja `TAB-B`.

**Mõju.** Kaks vahekaarti või aeglane vana vorm võivad professionaalse refleksiooni uuema paranduse jäljetult hävitada. Kasutaja saab mõlemal salvestusel eduteate ning varasemat teksti ega konflikti pole taastada.

**Vastuvõtukriteerium.** PATCH peab nõudma kliendi nähtud muutumatut versiooni (`updatedAt`/revision), kontrollima seda samas DB-kirjutuses ja tagastama stale-konflikti 409. Testida kahe päris DB-ühendusega sama kirje muutmist ning UI konfliktivaadet, mis ei kaota kumbagi teksti.

**Seis (13.08.2026): DONE —** PATCH nõuab `expectedUpdatedAt` väärtust ja teeb omanikuskoobitud CAS-kirjutuse. Aegunud kirjutus tagastab 409 koos serveri praeguse avaliku kirjega; UI säilitab kasutaja mustandi ning kuvab kohaliku ja serveri versiooni kõrvuti. Kahe ühenduse PostgreSQL-i sond kinnitas täpselt ühe võitja ja ühe 409 ning brauseritõend mõlema konfliktiteksti säilimise.

### SOL-REF-02 — Meetodipeegel talletab kontrollimata allikaviite ja kolm lubatud allikaliiki on kasutajateelt sisuliselt surnud — P2

**Tõend.** Loomisel valideeritakse ainult `sourceKind` sõnastikku ja ID pikkust, mitte allika olemasolu ega omaniku/ligipääsu seost (`lib/reflection/records.js:93-108`, `:138-152`). `MEETING` ja `CALL` jäävad lugemisel alati `unresolved` olekusse (`:111-135`). Koodibaasis on ainus `/refleksioon?sourceKind=...` sisenemispunkt eelpöördumise jaoks (`components/workspace/WorkspaceFeaturePage.jsx:764-777`), kuigi leping ja sõnastik lubavad ka artefakti, kohtumist ja kõnet. Negatiivkontroll salvestas edukalt `PRE_INQUIRY/foreign-known-id`.

**Mõju.** Privaatne kirje võib väita seost tegevusega, mida kasutaja ei oma või mida pole olemas, ning hiljem pole võimalik eristada päris sisenemispunktist tekkinud viidet käsitsi sepistatud ID-st. Kolm neljast lubatud tegevusrajast ei tööta tavakasutuses lubatud ühise kihina.

**Vastuvõtukriteerium.** Iga source-kind peab loomisel kasutama oma autoritatiivset owner/member-kontrolli ja salvestama ainult tõendatud seose; puuduva või võõra allika vastus on generic 404. Lisada reaalsed sisenemispunktid või eemaldada enneaegsed liigid lepingust. Testida võõrast artefakti, eelpöördumist, kohtumist ja kõnet ning allika hilisemat kustutust.

**Seis (13.08.2026): DONE —** uute allikaviidete leping piirati päriselt kasutajateega `PRE_INQUIRY` liigile; enneaegsed ARTIFACT, MEETING ja CALL liigid lükatakse 400-ga tagasi. PRE_INQUIRY olemasolu ja adressaadipoolne omand kontrollitakse serveris ning puuduv ja võõras allikas annavad sama üldise 404. PostgreSQL-i sond kinnitas omandipiiri ja allika hilisema kustutuse järel refleksiooni säilimise `deleted` olekuga; ajalooliste liikide lugemistugi säilis.

### SOL-REF-03 — vigane allikafilter avardub vaikides kõigile omaniku refleksioonidele — P2

**Tõend.** `listPracticeReflectionsForUser()` püüab `normalizeSourceRef()` vea kinni ja muudab vigase filtri `null`-iks, mille järel päring sisaldab ainult `ownerUserId` tingimust (`lib/reflection/records.js:155-179`). Negatiivkontrollis tagastas `sourceKind=PRE_INQUIRY&sourceId=` mõlemad omaniku kirjed `A` ja `B`.

**Mõju.** Tegevuse kontekstis minimaalset alamhulka küsiv klient võib vigase või pooliku viite korral saada vastuses kogu kasutaja tundliku refleksioonikogu. Praegune põhivaade filtrit ei kasuta, kuid endpointi leping on tulevaste tegevuspaneelide jaoks fail-open.

**Vastuvõtukriteerium.** Filtri puudumine ja filtri vigasus peavad olema eri olekud; osaline/tundmatu source-filter tagastab 400 ega tohi teha avaramat päringut. Lisada route-testid kõigi puuduvate, vigaste ja õigete kind/ID kombinatsioonidega.

**Seis (13.08.2026): DONE —** mõlema allikaparameetri puudumine tähendab filtreerimata omanikuloendit, kuid ainult ühe parameetri olemasolu või tundmatu liik annab 400. Sihttest katab puuduvad, poolikud ja tundmatu liigi kombinatsioonid; vigane filter ei saa enam päringut kõigile omaniku kirjetele laiendada.

### SOL-REF-04 — Meetodipeegli loend lõpeb 50 kirje juures ja veab iga rea täissisu brauserisse — P2

**Tõend.** Vaikimisi `take` on 50 ja ülempiir 100, kuid vastus ei sisalda cursor'it ega järgmist lehte (`lib/reflection/records.js:155-179`). `findMany()` ei kasuta `select`-projektsiooni, kuigi kaart kuvab ainult meetodit/lähenemist, tulemit ja kuupäeva (`components/reflection/ReflectionPage.jsx:275-299`). UI-s puudub „näita rohkem”.

**Mõju.** 51. ja vanem refleksioon muutub tavakasutuses nähtamatuks. Samal ajal saadetakse iga laadimisega kuni 50 kirje kõik tundlikud väljad brauserisse, kuigi detaili jaoks on eraldi owner-skoobitud endpoint.

**Vastuvõtukriteerium.** Lisada stabiilne cursor-paginatsioon ning minimaalne loendiprojektsioon; detailtekst tuleb ainult `/api/reflections/:id` kaudu. Testida 51+ kirjet, võrdseid ajatempleid, järgmise lehe laadimist ja ID-põhist deduplikatsiooni.

**Seis (13.08.2026): DONE —** refleksiooniloend kasutab stabiilset `(createdAt DESC, id DESC)` keyset-cursorit, tagastab `page.nextCursor` ning laeb ainult kaardivaate minimaalsed väljad. UI-l on „Näita veel” ja ID-põhine deduplikatsioon. PostgreSQL-i sond läbis 51+ sama ajatempliga kirjet kadude ja duplikaatideta; brauseritõend kinnitas järgmise lehe lisamise ja kattuva ID deduplikatsiooni.

### SOL-REF-05 — tühje ja korduvaid refleksioone saab piiramatult luua — P2

**Tõend.** `normalizePayload({})` annab tühja andmeobjekti ja create ei nõua ühtegi sisuvälja (`lib/reflection/records.js:64-90`, `:138-152`). `PracticeReflection` mudelil pole sisulist ega idempotentsustõket (`prisma/schema.prisma:1477-1509`); POST-route ei kasuta idempotency key'd ega `consumeRateLimit`-i (`app/api/reflections/route.js:31-48`).

**Mõju.** Kordusvajutus, võrgu-retry või kompromiteeritud konto võib tekitada hulga tühje/duplikaatkirjeid ja kasvatada privaatset andmemahtu. Hiljem peidab 50 rea piir just päris vanemad kirjed.

**Vastuvõtukriteerium.** Loomine peab nõudma vähemalt üht sisulist välja, kasutama kasutaja+toimingu rate-limit'i ning toetama replay-kindlat idempotency key'd. Testida sama võtmega sama ja erinevat payload'i, paralleelset POST-i ning tühja/ainult tühikutega vormi.

**Seis (13.08.2026): DONE —** loomine nõuab vähemalt üht sisulist välja ja `Idempotency-Key` päist. `(ownerUserId, idempotencyKey)` unikaalsus ja päringuräsi muudavad korduse replay-safe'iks ning sama võtme erinev sisu annab 409; kasutaja+toimingu mahupiir püsib PostgreSQL-is. Päris DB sond kinnitas paralleelse sama võtmega loomise üheks reaks, erineva sisu konflikti, tühikukirje keelu ning 21. katse täieliku rollback'iga blokeerimise.

### SOL-REF-06 — kasutaja andmekoopia jätab kõik Meetodipeegli kirjed välja — P1

**Tõend.** `DATA_EXPORT_REGISTRY` kogub profiili, vestlused, Teekonnad, Tööheaolu, saatja eelpöördumised ning dokumendid/artefaktid, kuid mitte `PracticeReflection` ridu (`lib/dataExport/registry.js:104-178`). Runtime-loend kinnitas samad kuus kogu. Ekspordi 7/7 testi läbivad, sest ükski neist ei oota refleksioone.

**Mõju.** Kasutaja ei saa oma professionaalse arengu materjali andmekoopiasse ega saa seda enne konto sulgemist säilitada. Konto FK-kaskaad kustutab kirjed seejärel jäädavalt.

**Vastuvõtukriteerium.** Lisada owner-skoobitud `practice_reflections` eksport kõigi väljade, source-ref'i ja ajatemplitega, ilma teiste isikute sisu juurde lahendamata. Test peab looma kahe omaniku kirjed, tõendama võõra rea puudumise ning kontrollima koopiat enne konto kustutust.

**Seis (13.08.2026): DONE —** andmekoopia sisaldab nüüd omaniku aktiivseid ja taastamisaknas olevaid `PracticeReflection` kirjeid koos sisu, allikaviidete ning ajatemplitega. Teise omaniku read ja sisemised idempotentsus-/retention-väljad jäävad välja. Registritest ning päris PostgreSQL-i sond tõendasid omaniku täieliku koopia enne kustutamist ja võõra sisu puudumise.

### SOL-REF-07 — privaatse mooduli lepingulise tähtaja lõpp ei käivita refleksioonide retention'it — P1, runtime NOT_PROVEN

**Tõend.** `PracticeReflection` mudelis on ainult owner-kaskaad ja ajatemplid, kuid puudub retention state/deadline (`prisma/schema.prisma:1477-1509`). Tootmiskoodis ega worker'ites pole PracticeReflection'i puhastust. Õigus-/tooteleping lubab säilitada kirjet kuni kasutaja kustutuseni, konto sulgemiseni **või privaatse mooduli lepingulise tähtaja saabumiseni** ning nõuab tähtaja kontrolli enne tootmiskasutust (`docs/legal/sotsiaalai_organisatsioonikasutuse_raamleping_vnext_MUSTAND.md:996-1010`).

**Mõju.** Kui privaatse mooduli õiguslik alus või leping lõpeb, võivad tundlikud kliendi reaktsioonid, töötaja tähelepanekud ja tõlgendused jääda kontole tähtajatult. Tellimuse värav piirab muutmist, kuid GET/DELETE jäävad teadlikult avatuks ega asenda automaatset retention'i.

**Vastuvõtukriteerium.** Kinnitada moodulitähtaeg ja selle autoritatiivne allikas, lisada jälgitav retention-state/deadline ning idempotentne monitooritud worker. Runtime peab tõendama mõlemad tähtaja pooled, kasutaja varasema kustutuse, konto kaskaadi ja nurjunud batch'i retry.

**Seis (13.08.2026): DONE —** jälgitava retention-tähtaja autoritatiivne allikas on omaniku privaatmooduli tellimuse `endsAt`; aktiivse lepingu pikenemine nihutab tähtaega edasi. Idempotentne monitooritud worker jätab tähtajaeelsed read alles, eemaldab aegunud read, salvestab nurjunud batch'i ning võimaldab kontrollitud retry. Päris PostgreSQL-i sond kinnitas tähtaja mõlemad pooled, kasutaja varasema kustutuse, konto FK-kaskaadi, lepingu pikenemise ja tõrkejärgse korduskatse. Tootmistaimeri tegelik jooks on `NOT_PROVEN`.

### SOL-REF-08 — kustutamisnupp eemaldab privaatse refleksiooni kohe ilma kinnituse või taastamiseta — P2

**Tõend.** Loendikaardi „Kustuta” nupp kutsub otse DELETE-i, ilma confirm-/preview-olekuta (`components/reflection/ReflectionPage.jsx:227-239`, `:290-297`). Teenus teeb kohe owner-skoobitud `deleteMany()` (`lib/reflection/records.js:231-238`). Sündmuse puudumine on Meetodipeegli anti-jälgimise lepingu järgi teadlik, seega puudub ka eksliku kustutuse taastamisjälg.

**Mõju.** Üks ekslik klõps kustutab kuni kümnete väljadega professionaalse refleksiooni pöördumatult. Eriti puudutus- või klaviatuurivea korral puudub nii teine kinnitus kui lühike undo.

**Vastuvõtukriteerium.** Lisada sisutu kinnitusdialoog (ei korda refleksiooniteksti) ja taastatav lühiajaline owner-only kustutus/undo või muu privaatsust säilitav taastemehhanism. Testida cancel, confirm, topeltkinnitus, aegunud undo ja võõra ID generic 404.

**Seis (13.08.2026): DONE —** kustutamine kasutab refleksioonisisu mittekordavat kinnitust, owner-skoobitud pehmet kustutust ja lühikest taastamisakent. Korduskinnitus on replay-safe ning võõras või puuduv ID ei avalda olemasolu. Regressioonitestid ja päris PostgreSQL-i sond katsid cancel/confirm-tee, topeltkinnituse, omaniku taastamise, aegunud undo ning võõra ID. Autenditud brauserirada jäi selles plokis `NOT_PROVEN`, kuid sama UI-olekumasin on deterministliku testiga lukustatud.

### SOL-REF-09 — aeglasem vana detailipäring võib uuema valiku vormi üle kirjutada — P2

**Tõend.** `openExisting(id)` ei kasuta AbortController'it, request-sequence väravat ega kontrolli, et vastus vastab viimati valitud ID-le (`components/reflection/ReflectionPage.jsx:169-185`). Kahe kaardi kiirel avamisel kirjutab hiljem lõpetanud esimene päring `editingId`, sourceRef'i ja kogu vormi üle.

**Mõju.** Kasutaja võib näha teise kirje asemel varem klõpsatud tundlikku refleksiooni ning muuta vale kirjet, arvates et avas viimase valiku. Omanikupiir ei leki teise kasutaja andmeid, kuid oma kirjete vahel tekib eksitav ja andmekaoohtlik olek.

**Vastuvõtukriteerium.** Katkestada eelmine detailipäring või rakendada monotonset request-ID väravat; ainult viimase valiku vastus tohib vormi muuta. UI-test peab lõpetama A→B päringud järjekorras B→A ning hoidma B vormi ja ID aktiivsena.

**Seis (13.08.2026): DONE —** detailivaade katkestab eelmise päringu ja kasutab monotonset päringu-ID väravat, mistõttu ainult viimane valik tohib vormi kirjutada. Regressioonitest lõpetab A→B päringud järjekorras B→A ning kinnitab, et aktiivseks jäävad B vorm ja ID. Autenditud brauserirada jäi selles plokis `NOT_PROVEN`.

### SOL-SEARCH-01 — autentimata otsingupäring võib enne 401 vastust käivitada kogu platvormi retention-cleanup'i — P1

**Tõend.** `/api/otsi` kutsub auth-abina `requireChatUser({runRetentionCleanup:true})` (`app/api/otsi/route.js:19-25`). `requireChatUser()` ootab esmalt `maybeRunRetentionCleanup()` lõpuni ja kontrollib sessiooni alles seejärel (`lib/chat/routeServerUtils.js:33-48`). Cleanup hõlmab kasutusreservatsioonide, eksportide, sessioonide, vestluste, ruumide, dokumentide, maksete ja muude andmete töötlemist/kustutamist (`lib/retention.js:128-635`). Protsessisisene 6 tunni värav rakendub alles eduka jooksu järel (`:638-663`).

**Mõju.** Avalik autentimata klient saab külma või eelmise ebaõnnestunud jooksuga protsessis määrata raske ja osaliselt destruktiivse hooldustöö käivitamise aja. Mitme protsessi puhul puudub ühine DB-lukk; nurjuv cleanup jätab `lastRunAt` uuendamata ja järgmine avalik päring proovib uuesti. Otsing võib enne 401 vastust kaua oodata ja koormata andmebaasi/failisüsteemi.

**Vastuvõtukriteerium.** Autentimine ja odav rate-limit peavad eelnema igale hooldustööle. Retention käib hallatava worker/cron'i kaudu ühe jagatud lukuga, mitte avaliku lugemisroute'i kõrvalmõjuna. Negatiivtest peab tõendama, et anonüümne otsing ei kutsu cleanup'i; mitme protsessi test tõendab ühe aktiivse sweep'i ja nurjunud töö kontrollitud retry.

**Seis (13.08.2026): DONE —** `/api/otsi` autentib kasutaja enne jagatud limiterit ega käivita enam säilitustööd avaliku lugemise kõrvalmõjuna. Eraldi autentitud retention-POST kasutab kogu sweep'i vältel PostgreSQL-i sessioonipõhist advisory-lock'i; konkureeriv protsess saab kontrollitud `202 already_running` vastuse ja retry-aja. Negatiivkontroll tõendab, et anonüümne päring ei jõua limiteri ega otsinguni; päris PostgreSQL-i kahe protsessi sond tõendas ühe aktiivse sweep'i, kontrollitud kaotaja ning õnnestunud korduskatse.

### SOL-SEARCH-02 — privaatne otsingutekst liigub URL-i query-string'is — P2, runtime NOT_PROVEN

**Tõend.** Brauser teeb `GET /api/otsi?q=<tekst>` ning server loeb sama `q` parameetri URL-ist (`components/search/PersonalSearchPage.jsx:24-36`; `app/api/otsi/route.js:35-41`). Otsingutekst võib olla kliendi nimi, juhtumi pealkiri või dokumendi failinimi. Repos pole frontend-proxy access-log'i formaati ega sanitiseerimist, mis tõendaks query-string'i väljajätmist.

**Mõju.** Kui reverse proxy, APM või infrastruktuuri access-log salvestab tavalise request URI, jõuab privaatne otsingusisu logidesse väljaspool tööobjekti retention'i ja ligipääsupiiri. Rakenduse enda `console` ei logi query't, kuid sellest ei piisa taristukihi tõendiks.

**Vastuvõtukriteerium.** Tundlik otsing peab kasutama sisu mitte kandvat URL-i (näiteks no-store POST kehaga) või tuleb taristus tõendada ja testida query täielik redaktsioon. Logi-smoke saadab sünteetilise markeriga otsingu ja kontrollib app-, proxy-, APM- ning journal-logidest markeripuudumist.

**Seis (13.08.2026): DONE —** isiklik otsing kasutab nüüd `no-store` POST-päringut JSON-kehaga ning GET tagastab 405; privaatne otsingutekst ei lähe URL-i. Autenditud lokaalne brauserirada sünteetilise markeriga tõendas puhta `/otsi` aadressi, markerita `POST /api/otsi` URL-i ja 0 markerivastet rakenduse arenduslogis. Toodangu proxy-, APM- ja systemd-logipinnad jäid `NOT_PROVEN`; deploy'd ei tehtud.

### SOL-SEARCH-03 — iga objektitüübi üheksas ja vanem vaste kaob ilma paginatsiooni või hoiatuseta — P2

**Tõend.** Kõik kolm Prisma päringut kasutavad fikseeritud `take:8` ning teenus ei tagasta cursor'it, koguarvu ega `hasMore` välja (`lib/search/personalSearch.js:1-2`, `:73-103`). UI kuvab ainult saadud loendi ega paku jätkamist (`components/search/PersonalSearchPage.jsx:69-82`). Negatiivkontrollis oli 12 sobivat vestlust, kuid vastuses 8 ja kärpemarker puudus.

**Mõju.** Levinud pealkirjaga vanem vestlus, Teekond või dokument võib olla Minu otsingust püsivalt leidmatu, kuigi lehe sõnastus lubab otsida oma objekte. Kasutaja ei tea, et tulemus on osaline.

**Vastuvõtukriteerium.** Rakendada stabiilne tüübipõhine või ühine cursor-paginatsioon ning aus `hasMore`/koguarv; vähemalt tuleb kuvada kärpeteade ja tee täieliku loendini. Testida 9+ vastet igas liigis, võrdseid kuupäevi ja lehekülgedevahelist deduplikatsiooni.

**Seis (13.08.2026): DONE —** vestlusel, Teekonnal ja dokumendil on eraldi stabiilne ID-kursor, deterministlik ajatempel+ID järjestus, ühe rea lookahead ning aus `hasMore`/`nextCursor`; lõppenud liik ei alusta järgmisel lehel uuesti. Päris PostgreSQL-i sond läbis iga liigi üheksa võrdse ajatempliga rida kahe lehe kaudu: 27 tulemust, 27 unikaalset sihtmärki, duplikaate ega kadusid ei olnud.

### SOL-SEARCH-04 — dokumendi otsingutulemus ei ava leitud dokumenti — P2

**Tõend.** Iga `UserDocument` tulemus saab sõltumata rea ID-st konstantse `href:"/documents"` (`lib/search/personalSearch.js:47-59`). Kliendiroll suunatakse sellelt lehelt omakorda `/dokreziim` pinnale (`app/documents/page.js:26-41`). Negatiivkontrollis said kaks eri dokumenti identse href'i.

**Mõju.** Otsing leiab pealkirja, kuid kasutaja peab dokumendi üldloendist uuesti leidma; pika loendi või kliendirolli korral ei pruugi tulemuseni üldse jõuda. See ei täida T17 lepingus nõutud olemasolevat detaili-süvalinki.

**Vastuvõtukriteerium.** Luua serveri allowlist'itud owner-skoobitud dokumendi detaili-/fookuslink või ausalt eemaldada dokument tüübist kuni turvalise sihtpinna valmimiseni. Test peab tõendama, et kaks tulemust avavad oma eri owner-kontrollitud objekti ja võõras ID annab generic 404.

**Seis (13.08.2026): DONE —** dokumendi otsingutulemus viib nüüd omaniku kontrollitud `/documents/[id]` detailvaatesse, mitte konstantsesse loendisse. Päris PostgreSQL tõendas eri dokumentidele eri sihtmärgid ja võõra omaniku kirje puudumise otsingust; autentitud brauser avas oma dokumendi detaili ning võõras ja olematu ID andsid sama üldise „Dokumenti ei leitud” vastuse.

### SOL-SEARCH-05 — ühe objektitüübi rike muudab kõik ülejäänud otsingutulemused kättesaamatuks — P2

**Tõend.** Vestluse, Teekonna ja dokumendi päringud on ühes `Promise.all()`-is (`lib/search/personalSearch.js:73-97`) ning route teisendab mistahes vea kogu vastuse 500-ks (`app/api/otsi/route.js:39-45`). Negatiivkontrollis kaotas Journey `journey unavailable` viga ka edukad vestluse ja dokumendi vasted.

**Mõju.** Ühe tabeli ajutine skeemi-/DB-probleem või aeglane alampäring võtab maha terve isikliku otsingu. Kasutaja saab ainult üldise vea ega saa kasutada kahte tervet andmeallikat.

**Vastuvõtukriteerium.** Otsustada ja dokumenteerida fail-closed vs osalise tulemuse leping. Kui osaline vastus on lubatud, kasutada liigipõhist settled-tulemust, tagastada sisutu `partial:true` ning näidata UI-s, milline liik jäi ajutiselt puudu; õiguse- või owner-vea korral peab kogu vastus endiselt fail-closed olema. Testida iga liigi eraldi riket.

**Seis (13.08.2026): DONE —** kolm otsinguallikat täidetakse paralleelse `Promise.allSettled` lepinguga. Ühe tehnilise allika tõrge tagastab ülejäänud tulemused koos `partial: true` ja täpse `unavailableKinds` loendiga, mida UI kasutajale lokaliseeritult näitab; vestluse, Teekonna ja dokumendi tõrget testiti eraldi. Autentimis- või õigusetõrge ei muutu osatulemuseks, vaid katkestab vastuse fail-closed.

### SOL-SEARCH-06 — otsingu limiter on protsessimälus ja seob kliendi juhitava IP-päise bucket'i — P2, runtime NOT_PROVEN

**Tõend.** Route lubab vaikimisi 30 päringut minutis (`app/api/otsi/route.js:12-13`, `:27-33`). Limiter kasutab protsessisisest `Map`-i (`lib/rate-limit.js:1-35`) ning võti sisaldab `x-real-ip`/`x-forwarded-for`/muid päringupäiseid ilma usaldatud proxy-hop'i kontrollita (`lib/request-ip.js:6-20`; `lib/chat-api-rate-limit.js:19-31`).

**Mõju.** Mitme Node'i protsessi/restarti korral on limiit killustunud; kui production-proxy ei kirjuta kliendi IP-päiseid autoritatiivselt üle, saab autentitud klient bucket'it päisega vahetada. Üks otsing teeb korraga kolm `contains` DB-päringut, mistõttu limiter'i möödumine võimendab andmebaasikoormust.

**Vastuvõtukriteerium.** Kasutada jagatud atomaarset limiter'it kasutaja+toimingu võtmega; IP tuleb ainult dokumenteeritud usaldatud proxy-ahelast. Runtime-test peab tegema päringud eri worker'itesse ja võltsitud forwarded-päistega ning saama pärast ühist piiri 429.

**Seis (13.08.2026): DONE —** isiklik otsing kasutab protsessiüleselt atomaarset PostgreSQL-i bucket'it kasutaja+toimingu ja ainult usaldatud proxy päisest saadud IP järgi; seadistamata või kliendi muudetavad `x-forwarded-for`/`x-real-ip` päised ei loo uusi bucketeid. Päris PostgreSQL-i kaks eraldi protsessi tegid vahelduvate spoof-päistega 40 katset: täpselt 30 lubati ja ülejäänud piirati ühise kvoodi järgi; storage'i tõrge sulgeb otsingu 503-ga. Toodangu proxy-seadistus ja mitme sõlme deploy-järgne rada jäid `NOT_PROVEN`.

### SOL-SEARCH-07 — pealkirjata tulemuse serveritagavara on kõigis keeltes eestikeelne — P3

**Tõend.** Projektsioon kirjutab tühja pealkirja korral otse tekstid `Vestlus`, `Teekond` ja `Dokument` (`lib/search/personalSearch.js:27-52`). UI kuvab `item.title` muutmata, kuigi liikide ja staatuste tõlked tulevad sõnastikust (`components/search/PersonalSearchPage.jsx:70-78`).

**Mõju.** Inglise- või venekeelsel töölaual ilmub pealkirjata objekt eestikeelse nimega. See ei mõjuta omanikupiiri, kuid rikub keelepariteeti ja võib ekraanilugeja väljundi segakeelseks muuta.

**Vastuvõtukriteerium.** API peab tagastama nullable title'i või locale'ist sõltumatu `titleKey`-i; fallback tõlgitakse kliendis. ET/EN/RU test loob pealkirjata vestluse ja kontrollib vastava keele teksti.

**Seis (13.08.2026): DONE —** server tagastab pealkirjata objekti puhul `title: null`, mitte eestikeelset fallback'i. Klient tõlgib pealkirjata vestluse, Teekonna ja dokumendi ET/EN/RU kataloogist; kataloogisümmeetria ja kõik kolm lokaliseeritud võtmerühma on testitud.

### SOL-SPROF-01 — konto kustutamine jätab SOLO-teenuseprofiili avalikuks ja RAG-i — P0

**Tõend.** `ServiceProviderProfile.ownerId` kasutab `onDelete:SetNull`; migratsiooni CHECK lubab SOLO-profiili ilma omanikuta ning kommentaar ütleb teadlikult, et rida jääb alles (`prisma/schema.prisma:1939-2003`; `prisma/migrations/20260802090000_org_profile_support_v1/migration.sql:177-208`). Konto kustutuse puhastus kogub dokumente, materjale, artefakte ja eelpöördumisi, kuid mitte teenuseprofiili ega selle `ragSourceId`-d; lõpus kustutatakse ainult User-rida (`lib/privacy/userDeletion.js:17-65`, `:74-154`; `lib/privacy/effectivePracticeAccountCleanup.js:144-176`). Omaniku nullimine ei muuda profiili, ServiceMapEntry ega RAG-i seisu. Avalik kaart filtreerib ServiceMapEntry `PUBLISHED` staatuse, mitte omaniku olemasolu järgi (`lib/serviceProviderProfiles.js:1142-1184`, `:1260-1314`). Olemasolev test kinnitab teadlikult, et SOLO-profiil jääb konto kustutuse järel alles (`tests/org/profileRecipient.test.js:72-83`).

**Mõju.** Konto kustutanud üksikosutaja nimi, kontaktid, teenused ja asukohad võivad jääda avalikule kaardile ning assistendi teadmuskihile määramata ajaks. Profiili pole enam ühelgi omanikul võimalik tavarajalt peita ega parandada; skeemikommentaaris mainitud adminirada koodibaasist ei leitud.

**Vastuvõtukriteerium.** Konto kustutuse tehing peab SOLO-profiili enne User-kustutust vähemalt `HIDDEN` olekusse viima, avalikud kaardiobjektid sulgema ja RAG-kustutuse püsivasse retry-järjekorda panema; äriliselt säilitatavad väljad tuleb anonüümida või üle anda selge õigusliku alusega. Runtime-test loob avaliku SOLO-profiili, kustutab konto ja tõendab seejärel 0 avalikku kaardivastet, 0 RAG-vastet ning hallatava järeltegevuse.

**Seis (10.08.2026): DONE — kood, testid ja päris PostgreSQL-i runtime (`npm run sprof:consent:probe` 22/22).**

Kolm sammu käivad nüüd **enne `user.delete`-i ja samas lukustatud tehingus**
(`deleteUserAfterFinalPracticeSweep`, seesama tehing, kus elavad SOL-PRE-01 ja
SOL-URG-02): profiil → `HIDDEN`, tema `ServiceMapEntry` read → `HIDDEN`, RAG-koopiale
**püsiv `RAG_DELETE` töö**. Loendurid tulevad vastusesse (`hiddenServiceProfiles`,
`hiddenServiceMapEntries`, `queuedServiceProfileRagDeletions`) — kustutus ei saa enam öelda
„tehtud" ilma numbrita.

**RAG-i ei kutsuta tehingu seest.** Võrgukutse hoiaks `User` rea lukku võõra teenuse
vastuse ajaks ja tema tõrge keeraks tagasi kogu kustutuse, mis muidu õnnestus. Töö läheb
järjekorda, mida ajab taga `deletionJobRetryService` ja mida loeb deploy-värav.

**Uut töölist ei ehitatud.** `DataDeletionJob` kannab juba `RAG_DELETE`-i koos
`nextAttemptAt`/`attempts`/`maxAttempts`-iga ning sama rada kasutavad SOL-RAGADMIN-02 ja
tõenduspõhised praktikad. Teine järjekord tähendaks teist kohta, kust orbe otsida.

**Mudeleid ei valvata `?.`-ga.** Sama põhjendus mis SOL-URG-02 juures: puuduv mudel peab
kukutama, mitte muutuma vaikseks nulliks. Kaks testifake'i said seepärast uued mudelid,
mitte kood uue valve.

**Runtime on jooksutatud.** `npm run sprof:consent:probe` (uus,
`scripts/service-profile-consent-probe.mjs`) teeb päris andmebaasis avaliku SOLO-profiili
koos avaliku `ServiceMapEntry`-ga, kustutab konto ja mõõdab tulemuse: profiil `HIDDEN`,
`ownerId` null (SetNull), **avalikke kaardivasteid 0**, RAG-koopial püsiv `pending` töö
põhjusega `owner_account_deleted`, `User` rida läinud — ja seejärel, et sama profiil
**ei jõua enam retrieval'i vastustesse**. 22/22.

Sond leidis kirjutamisel ka ühe päris vea iseendas (`ServiceMapEntry` nõuab `type` ja
`title`, mitte `entryType`/`name`) — fake-Prisma ei oleks seda näinud, vt
[[fake-prisma-ei-valideeri]] klassi.

**Lahtine jääb üks asi, mis ei ole tõendamine, vaid otsus:** kriteeriumi
**anonüümimise/üleandmise** osa („äriliselt säilitatavad väljad"). Täna profiil
PEIDETAKSE, tema sisu jääb reale alles. See vajab õiguslikku alust, mitte koodi, ja on
kirjas lahtise tooteotsusena — leid ise on kaetud.

### SOL-SPROF-02 — soovitusloa tagasivõtmine võib vastata eduga, kuigi vana RAG-dokument jääb aktiivseks — P0

**Tõend.** RAG-sünk kontrollib kõigepealt võtme olemasolu ja tagastab `syncStatus:"skipped"`; alles järgmises harus hinnatakse, kas profiil tuleb eemaldada (`lib/serviceProviderProfiles.js:475-517`). Seega puuduva `RAG_SERVICE_KEY` korral ei kustutata vana `ragSourceId` dokumenti ka siis, kui kasutaja lülitab `assistantRecommendationAllowed` välja või peidab profiili. Kustutus-/ingest-vea püüab profiilisalvestus kinni, kirjutab ainult `ragMetadata.syncStatus:"failed"` ja tagastab route'ile tavapärase profiili (`:1121-1139`); UI kuvab selle järel tingimusteta „Teenuseprofiil salvestati” ega näita RAG-meta seisu (`components/workspace/WorkspaceFeaturePage.jsx:4219-4234`). Püsivat profiili-RAG retry-job'i pole.

**Täpsustus (09.08, mõõdetud).** Kustutuse harul ei ole ka ülalmainitud nõrka võrku.
`deleteRagDocument()` ei viska kunagi erindit: puuduva ID korral tagastab ta
`{ ok: false, skipped: true }`, 404 korral `{ ok: true, missing: true }` ning päris tõrke
(võrk, 5xx, autentimine) korral `{ ok: false, error }` (`lib/documents/ragService.js:127-157`).
Seetõttu `:1121-1139` `catch` sellel rajal ei käivitu ja `syncStatus:"failed"` ei jõua kustutusel
kunagi kirja — võrk ei ole nõrk, teda ei ole. `:497` kutsub kustutust tagastusväärtust vaatamata
ja kirjutab kohe järel tingimusteta `ragSourceId: null` + `ragMetadata.syncStatus:"removed"`
(`:495-517`). Vale eduteade sünnib seega ka siis, kui `RAG_SERVICE_KEY` on olemas — puuduv võti
on ainult üks kolmest teest sinna. Ühtlasi kaob ainus salvestatud viit orvule; doc-ID
`service-provider-profile::${profile.id}` on determinist (`:268-270`), nii et orb on sweep'iga
leitav, kuid miski ei märgi, et teda otsida tuleks. Sama klass nagu SOL-RAGADMIN-02, ainult ilma
snapshot-ridadeta, mis seal jälje alles jätsid.

**Mõju.** Kasutaja selgesõnaline AI-soovitusloa tagasivõtmine või profiili peitmine võib olla ainult DB/UI muudatus; kontaktid ja teenusekirjeldused jäävad assistendile leitavaks. Kasutaja saab vale eduteate ega tea, et nõusolekupiir pole välises koopias jõustunud.

**Vastuvõtukriteerium.** Loa eemaldamine peab fail-closed lõpetama retrieval'i kohe ning looma deterministliku püsiva delete-job'i, mida retry-worker ja deploy-värav jälgivad. Route/UI peab näitama ausat pending/failed olekut. Testida puuduva võtme, timeout'i, osalise RAG-vea, restardi ja korduva tagasivõtmisega; lõpptõend on 0 tulemust vana teenuse unikaalse markeriga.

**Seis (10.08.2026): DONE — kood, testid ja päris PostgreSQL-i runtime (`npm run sprof:consent:probe` 22/22).**

Uus jagatud moodul `lib/privacy/serviceProfileRagRemoval.js` kannab kogu protokolli ja tal
on **kaks reeglit**:

1. **Töö kirjutatakse ENNE kustutuskatset.** Kui protsess sureb katse ajal, peab jälg alles
   olema; vastupidine järjekord kaotab orvu vaikselt. (Ühiktest mõõdab just seda järjekorda.)
2. **`ragSourceId` kustub AINULT kinnitatud kustutuse järel.** Kinnitamata eemaldus jääb
   `pending_removal` seisu koos viida ja töö ID-ga. Vana kood kirjutas `ragSourceId: null`
   tingimusteta ja kaotas nii **ainsa salvestatud viida orvule** — doc-ID on determinist,
   aga miski ei märkinud, et teda otsida tuleks.

**Puuduv `RAG_SERVICE_KEY` ei ole enam „skipped".** Eemalduse haru käib nüüd
võtmekontrollist **eespool**: nõusoleku tagasivõtmine on kasutaja tahe, mitte meie
konfiguratsiooni funktsioon, ja ta peab vähemalt jõudma püsivasse järjekorda ka siis, kui
teenus on kättesaamatu.

**Kustutusteenus on süstitav, mitte imporditud** — `lib/documents/ragService` veab endaga
`server-only` ahela, mille peale iga seda moodulit importiv ühiktest kukuks. Vaikeväärtust
TEADLIKULT ei ole: seadistamata teenus annab `rag_delete_not_configured`, mitte vaikse edu.

Retry-teenus sai `ServiceProviderProfile` haru, mis kinnitatud kustutuse järel viida
lõpuks kustutab — sama muster, mis praktikatel.

**Päringuaegne fail-closed värav on olemas** — `lib/privacy/serviceProfileRetrievalGuard.js`.
Ta on **teine, kohalik** kaitse: kaugkoopia kustutamine on õige lõpplahendus, aga ta on
võrgutoiming, mis võib kukkuda, aeguda või oodata retry-workerit. Kasutaja tahe ei tohi
oodata võõra teenuse kättesaadavust. Värav loeb tõe meie enda andmebaasist ja nõuab
**mõlemat** tingimust (`status:PUBLISHED` JA `assistantRecommendationAllowed:true`).
**Fail-closed on sõna-sõnalt:** kui loakontroll ise ei õnnestu (andmebaasi ei ole, päring
viskab), kaovad KÕIK teenuseprofiili vasted — muud allikad jäävad puutumata. Vale suunas
eksides oleks värav dekoratsioon.

**Värav istub ukse peal, mitte koridoris — ja seda mõõtis test.** Esimene katse pani ta
`searchRagQueries` lõppu. See funktsioon tagastab **kahest** kohast: ühe päringu kiirtee
(`retrievalOrchestrator.js:853`) annab `searchRagDirect`-i tulemuse otse edasi, ja just see
on vestluses kõige tavalisem kuju. Ühiktest langes punaseks ühe päringu juhtumil ja jäi
roheliseks mitme päringu omal — värav kolis `searchRagDirect`-i sisse, ainsasse kohta, kus
RAG-vastus rakendusse siseneb.

**Teine uks oli lahti: kovisiooni teadmusotsing.** `fetchCovisionKnowledgeSupport` käib
sama RAG-indeksi peal **ilma kollektsioonifiltrita**, seega võis ta tagastada
teenuseprofiili dokumendi ka siis, kui vestlusaken seda enam ei teinud. Nüüd käib ka see
rada läbi värava (`filterCovisionKnowledgeConsent`), **enne** `top_k` lõikamist — pärast
lõikamist filtreerimine tähendaks, et keelatud vaste võtab lubatud vastelt koha ära.

**Route/UI ütleb nüüd tõtt.** `serviceProfileSaveNoticeKey` (testitav, JSX-ist väljas)
valib teate `ragMetadata.syncStatus` järgi: `pending_removal` → „eemaldamine on pooleli",
`failed` → „assistendi koopia uuendamine ebaõnnestus", muidu tavaline eduteade. Kõik kolm
võtit on ET/EN/RU sõnastikes ja test kontrollib nende olemasolu.

**Doc-ID prefiksil on nüüd üks omanik.** Ehitaja (`serviceProviderProfiles.js`) ja lugeja
(värav) jagavad sama `serviceProfileRagDocId`-d. Kaks koopiat oleks tähendanud, et prefiksi
muutmine ühes kohas teeb väravast vaikse läbilaskja — ta lihtsalt ei tunneks profiile ära.

**Runtime-tõend on olemas:** `npm run sprof:consent:probe`, 22/22 päris PostgreSQL-i vastu.
Ta katab kukkunud kustutuse (`pending_removal` + viit alles + töö järjekorras), korduva
tagasivõtmise (teist tööd ei teki), kinnitatud kustutuse (`removed` + viit kustub + töö
suletud), negatiivkontrolli (kehtiva loaga profiil JÄÄB) ja fail-closed haru.

### SOL-SPROF-03 — nähtav teeninduskoht võib avalikustada temaga seotud peidetud teenuse — P1

**Tõend.** Avaliku kaardi DB-päring valib profiili `serviceItems` hulka ainult `mapVisible:true,status:PUBLISHED` teenused, kuid iga teeninduskoha `serviceLinks.providerService` laaditakse piiranguta (`lib/serviceProviderProfiles.js:1265-1301`). `locationServices()` proovib esmalt avalikku ID-kaarti, ent puudumisel kasutab varuvariandina piiranguta lingilt saadud `providerService` objekti (`lib/serviceProviderServiceLocations.js:10-18`). Negatiivkontrollis tagastas avalik marker teenuse `SALAJANE TEENUS`, mille seis oli `HIDDEN` ja `mapVisible:false`.

**Mõju.** Individuaalselt peidetud teenuse kirjeldus, kontakt, hind, sihtrühm ja pöördumistingimused võivad nähtava teeninduskoha kaudu avalikku Teenusekaarti lekkida.

**Vastuvõtukriteerium.** Asukohalingi projektsioon tohib lahendada ainult juba allowlist'itud avalikke teenuseid; `link.providerService` varuvariant tuleb eemaldada või samade status/mapVisible tingimustega filtreerida. Negatiivtest peab siduma nähtava asukohaga PUBLISHED, HIDDEN, DRAFT ja mapVisible=false teenused ning lubama vastuses ainult esimese.

**Seis (13.08.2026): DONE —** avalik profiili- ja asukohaprojektsioon lahendab teenuselingid ainult samast kesksest allowlist'ist, kus teenus on `PUBLISHED` ja `mapVisible:true`; piiranguta `providerService` varuteed enam pole. Regressioonitest ja päris PostgreSQL-i sond sidusid nähtava asukohaga avaliku, peidetud, mustandi ning kaardilt eemaldatud teenuse ja kinnitasid, et vastuses säilis ainult avalik teenus ning ainult selle seose-ID.

### SOL-SPROF-04 — RAG metadata saadab peidetud ja mustandteenuste täissisu — P1

**Tõend.** RAG-i tekst filtreerib teenuseid vähemalt `status:PUBLISHED` järgi, kuid `serviceProviderProfileRagMetadata()` map'ib erandita kõik `profile.serviceItems` read ja lisab kirjelduse, piirangud, sihtrühmad, dokumendinõuded, kontaktiväljad, nähtavuse ning staatuse (`lib/serviceProviderProfiles.js:292-347`, `:374-451`). Sama metadata saadetakse `/ingest/text` payload'is välisele RAG-teenusele (`:519-535`). Negatiivkontrollis sisaldas payload täies mahus `HIDDEN`/`mapVisible:false` teenust.

**Mõju.** Avaldamata teenuse detailid lahkuvad rakenduse privaatsuspiirist RAG-hoidlasse. Isegi kui põhitekst seda teenust ei indekseeri, võib metadata olla administraatorile, allikavaatele või retrieval-vastusele nähtav ning selle kustutamisel puudub eraldi teenuseversiooni jälg.

**Vastuvõtukriteerium.** RAG-payload peab moodustuma ühest kesksest avalikust teenuseprojektsioonist; HIDDEN/DRAFT teenust ei tohi olla ei tekstis, metadatas ega loendurites. Lisada payload-test segaprofiiliga ning RAG-teenuse integratsioonitest, mis otsib peidetud teenuse unikaalset markerit ja ootab 0 tulemust.

**Seis (13.08.2026): DONE —** RAG-i tekst, metadata ja loendurid kasutavad keskset avalikku teenuseprojektsiooni. Eraldatud päris RAG-teenuse ja Chroma runtime koos kohaliku deterministliku embedding-teenusega ingestis sünteetilise segaprofiili: avalik marker oli otsingus leitav, kuid HIDDEN-, DRAFT- ega `mapVisible:false` marker ei esinenud otsinguvastustes.

### SOL-SPROF-05 — vana täisvorm võib uuema profiili, teenused ja asukohad vaikides üle kirjutada — P1

**Tõend.** GET tagastab `updatedAt`, kuid PUT ega UI payload ei saada oodatud versiooni (`app/api/service-provider/profile/route.js:64-88`; `components/workspace/WorkspaceFeaturePage.jsx:4150-4218`). Salvestus loeb tehingus hetkeprofiili, kuid kasutab kogu kliendi vormi uue tõena: profiil uuendatakse täisobjektiga, kõik asukohad kustutatakse ja luuakse uuesti ning vormist puuduvad teenused kustutatakse (`lib/serviceProviderProfiles.js:910-975`, `:976-1056`). Serializable retry väldib DB write-conflict'i, kuid ei tõesta, et kliendi vorm põhines samal versioonil.

**Mõju.** Teine brauserivahekaart või aeglane vana vorm võib kustutada vahepeal lisatud teenused/asukohad ja taastada vanad kontaktid või avaldamisvalikud. Mõlemad salvestused saavad eduteate; varasemat seisu ega konflikti pole kasutajale taastamiseks.

**Vastuvõtukriteerium.** PUT peab nõudma profiili revision'i või `expectedUpdatedAt` väärtust ja rakendama selle atomaarse update/CAS-i sees; lapsread peavad kuuluma samasse versioonivalvesse. Päris PostgreSQL-i test kahe ühendusega peab lubama ainult ühe stale-vormi commit'i ning UI peab näitama ühendatavat konfliktivaadet.

**Seis (13.08.2026): DONE —** PUT nõuab `expectedUpdatedAt` väärtust ning lukustab profiili ja lapsread sama atomaarse CAS-i sisse. Päris PostgreSQL-i kahe konkureeriva täisvormi sond lubas täpselt ühe commit'i, tagastas kaotajale 409 ning kinnitas, et profiil, teenused ja asukohad pärinevad samast võitnud revision'ist. UI säilitab kohaliku vormi ja näitab serveri värske seisuga konfliktivaadet.

### SOL-SPROF-06 — klient saab suvalised koordinaadid serveris ametlikuks `MATCHED` asukohaks muuta — P1

**Tõend.** Asukoha normaliseerija kontrollib ainult, kas latitude/longitude on lõplikud arvud; puudub vahemik, Eesti piir, adsObjectId või serveripoolne geokooderi tõend. Iga selline paar saab `geocodingStatus:"MATCHED"` ja vaikimisi provider'i `maaruum` (`lib/serviceProviderProfiles.js:211-265`). Ka profiili põhiaadressi valik usaldab samal viisil kliendi koordinaate (`:559-580`). Negatiivkontroll aktsepteeris `latitude:999, longitude:-999`, märkis selle `MATCHED` ning allikaks `maaruum`.

**Mõju.** Otse-API kasutaja saab avaldada vale teeninduskoha ja esitada seda ametliku aadressivastena. See kahjustab teenuse leidmist, võib rikkuda kaardi renderdust ning loob eksitava usaldussignaali abivajajale.

**Vastuvõtukriteerium.** Server peab kontrollima WGS84 vahemikku ja kas uuesti lahendama aadressi autoritatiivse geokooderiga või valideerima lühiealise allkirjastatud suggestion-tokeni. Kliendi provider/status välju ei tohi usaldada. Testida piirväärtusi, NaN/Infinity't, Eesti-välist punkti, võltsitud adsObjectId-d ja aegunud tokenit.

**Seis (13.08.2026): DONE —** server väljastab omaniku ja kõigi autoritatiivsete aadressiväljadega seotud lühiealise allkirjastatud suggestion-tokeni; ainult kehtiv token võib salvestada `MATCHED` koordinaadid ja provider'i. WGS84/Eesti piiri, NaN/Infinity, omanikuvahetuse, võltsitud `adsObjectId` ja aegumise kontrollid sulguvad fail-closed. PostgreSQL-i sond kinnitas, et võltsitud toorsisend jääb koordinaatideta `PENDING` olekusse.

### SOL-SPROF-07 — RAG-i edukas ingest ja kohaliku profiililingi kirjutus ei ole taastatav tervik — P1

**Tõend.** Avaldamisel kirjutatakse profiil esmalt DB-tehingus, seejärel tehakse välisele RAG-ile ingest ning alles viimaks kirjutatakse eraldi Prisma update'iga `ragSourceId` ja `syncStatus:"synced"` (`lib/serviceProviderProfiles.js:475-550`, `:910-1139`). Kui ingest õnnestub, kuid lõpu-update ebaõnnestub, jääb dokument RAG-i ilma usaldusväärse kohaliku lingita; catch proovib ainult veametadata DB-update'i. Retry-/reconcile-job'i ega versioonikaitset pole ning dokumentatsiooni järgi parandab vea alles järgmine käsitsi salvestus (`docs/platvormi arendus/fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md:128-136`).

**Mõju.** Assistendi korpuses võib olla aktiivne, kuid DB-s nähtamatu või vale versiooniga teenuseprofiil. Järgmine muutmine/kustutus ei pruugi teada, millist koopiat koristada, ning kasutajale kuvatud RAG-seis ei vasta tegelikule korpusele.

**Vastuvõtukriteerium.** Kasutada deterministliku dokumendi-ID-ga püsivat ingest-job'i, profiili revision-valvet ja reconcile/deploy-kontrolli, mis võrdleb DB snapshot'i RAG-registriga. Testida ingest-edu + DB-viga, vastuse kadu, restart, stale-job ning uue versiooni võit vana retry üle.

**Seis (13.08.2026): DONE —** profiili RAG-sünk kasutab deterministliku dokumendi-ID, payload-räsi ja revision'iga püsivat `ServiceProviderProfileRagJob` järjekorda. Leasitud worker teeb retry, märgib aegunud töö `SUPERSEDED` ning uuendab profiililinki ainult sama revision'i CAS-iga; reconcile võrdleb püsivat snapshot'i RAG-registriga. PostgreSQL-i sond kattis ingest-edu+järgne DB-vea, vastuse kao, restardi, stale-job'i ja uue revision'i võidu. Välise production-RAG-i tegelik worker/reconcile jooks jäi `NOT_PROVEN`.

### SOL-SPROF-08 — kasutaja andmekoopia jätab tema SOLO-teenuseprofiili välja — P1

**Tõend.** `profile_and_consents` eksport sisaldab ainult User-konto, Profile nime/telefoni ja raamlepingu nõusolekuid; ülejäänud viis kogu ei käsitle ServiceProviderProfile'i (`lib/dataExport/registry.js:6-31`, `:104-178`). Teenuseprofiili GET annab omanikule küll jooksva vaate, kuid ZIP-andmekoopia ei sisalda profiili, teenuseid, asukohti, avaldamis-/soovitusvalikuid, tegevusloa seoseid ega RAG-meta seisu. Andmekoopia 7/7 testid läbivad, sest seda kogu ei oodata.

**Mõju.** Üksikosutaja ei saa enne konto sulgemist oma teenuseandmeid masinloetava koopiana kaasa võtta. Koos SOL-SPROF-01-ga tekib vastupidine olukord: kasutaja koopias andmeid pole, kuid platvormi avalikus ja RAG-koopias võivad need alles jääda.

**Vastuvõtukriteerium.** Lisada owner-skoobitud SOLO-teenuseprofiili eksport koos lapsridade ja ajatemplitega; kolmandate isikute ning sisemiste registrivigade väljad tuleb eraldi projitseerida. Testida kahte omanikku, omanikuta/orgranžimi profiili välistamist ja koopiat vahetult enne konto kustutust.

**Seis (13.08.2026): DONE —** andmekoopia sisaldab nüüd owner-skoobitud SOLO-teenuseprofiili koos teenuste, asukohtade, seoste, avaldamis-/soovitusvalikute ning ajatemplitega; sisemised registri- ja tööjärjekorraväljad on eraldi projektsiooniga välistatud. PostgreSQL-i sond tõendas kahe omaniku eraldatust, omanikuta ja organisatsiooniprofiili puudumist ning koopia kättesaadavust vahetult enne konto kustutust.

### SOL-SPROF-09 — server kärbib teksti ja kukutab üleliigsed teenused/asukohad ilma hoiatuseta — P2

**Tõend.** Kõik tekstinormaliseerijad kasutavad `slice()`-i, loendid lõpetatakse piiri täitumisel ning teenused/asukohad lõigatakse vastavalt 40/30 reale (`lib/serviceProviderProfiles.js:51-103`, `:604-729`). UI väljadel pole `maxLength` atribuute ega teenuse/asukoha lisamise piiri; lisamisnupud jäävad alati aktiivseks (`components/workspace/WorkspaceFeaturePage.jsx:3800-3818`, `:4310-4385`, `:4820-4895`). Kuna salvestus käsitleb saadud kärbitud lapsloendit täisasendusena, kustutab ta andmebaasist kõik piiri taha jäänud olemasolevad read (`lib/serviceProviderProfiles.js:976-1056`).

**Mõju.** Kasutaja võib saada eduteate, kuigi kirjelduse lõpu oluline tingimus kadus või 41. teenus/31. asukoht kustutati. RAG, kaart ja eelpöördumine hakkavad seejärel kasutama kärbitud tõde.

**Vastuvõtukriteerium.** Üle piiri sisend peab saama välja-/rea-põhise 400/413 vea; UI näitab loendurit ja keelab lisamise enne serveripiiri. Testida piir-1/piir/piir+1, olemasoleva 41. rea säilimist ning kriitilist markerit teksti kärbitavas sabas.

**Seis (13.08.2026): DONE —** server lükkab üle piiri sisendi tagasi ega kärbi teksti või lapsridu vaikides; UI kuvab piirid ja keelab lisamise nende täitumisel. Autenditud production-build brauserirada täitis profiili täpselt 8000 märgi, 40 teenuse ja 30 asukohani. Reload ning päris PostgreSQL kinnitasid kriitilise tekstisaba, viimase teenuse, viimase asukoha ja varasemate HIDDEN/DRAFT/kaardilt peidetud ridade säilimise.

### SOL-SPROF-10 — profiili- ja kättesaadavusroute võivad tagastada kliendile toore serverivea — P2

**Tõend.** Profiili PUT ja kättesaadavuse POST valivad staatuseks `error.status || 500`, kuid annavad kõigi staatuste korral `error.message` otse `errorJson()`-ile (`app/api/service-provider/profile/route.js:79-88`; `app/api/service-provider/profile/services/[serviceId]/availability-confirmation/route.js:32-37`). `safeError()`-it kasutatakse ainult serverilogis; andmebaasi, RAG-i või programmeerimisvea tekst võib seetõttu muutuda 500 vastuse kehaks.

**Mõju.** Sisemised tabeli-/välja-/võrguandmed või muu tehniline kontekst võivad autentitud kliendile lekkida. UI kuvab sama `payload.message` teksti kasutajale.

**Vastuvõtukriteerium.** Ainult allowlist'itud 4xx domeenikoodid tohivad kliendile jõuda; kõik 5xx vastused kasutavad lokaliseeritud üldkoodi ja korrelatsiooni-ID-d. Veasüsttestid peavad panema Prisma ja RAG-i viskama unikaalse salajase markeri ning tõendama selle puudumise HTTP-kehas ja UI-s.

**Seis (13.08.2026): DONE —** tundmatud serverivead ei jõua autentitud kliendile toortekstina. Prisma unikaalse salajase markeriga veasüst andis üldise lokaliseeritud 500 vastuse ja päisega kattuva korrelatsiooni-ID; marker puudus HTTP-kehas ja UI-s. RAG-i markeriga veasüst jäi püsivas tööjärjekorras ohutuks `rag_ingest_failed` koodiks ning marker puudus vastusest, UI-st ja tööjärjekorra kirjest; järgnev taastöö õnnestus.

### SOL-SPROF-11 — avaldamise ja AI-soovitusloa muutmisel puudub püsiv auditijälg — P2

**Tõend.** Profiilisalvestuse tehing uuendab profiili, teenused, asukohad ja ServiceMapEntry, kuid ei kirjuta DomainEvent'i, NotificationEvent'i ega andmeauditit (`lib/serviceProviderProfiles.js:910-1112`). Route ei anna teenusele actor-/request-konteksti ega auditipordi (`app/api/service-provider/profile/route.js:64-88`). Seega `status`, `mapVisible`, `assistantRecommendationAllowed`, kontaktid ja eelpöördumise vastuvõtukanalid võivad muutuda ainult viimase seisu ning üldise `updatedAt` jäljega.

**Mõju.** Hiljem ei saa tõendada, kes ja millal avaldas kontaktid, lubas assistendil teenuseid soovitada või selle loa tagasi võttis. RAG-i lahknemise või eksliku avaldamise uurimisel puudub minimaalne sündmusjada.

**Vastuvõtukriteerium.** Olulised avaldamis-/nõusolekusiirded peavad kirjutama samas DB-tehingus sisutu auditi/outbox-sündmuse: actor, profiili ID, eelmine/uus olek, revision ja korrelatsiooni-ID; teenusekirjeldust ega kontakte auditisse ei kopeerita. Testida auditirea kirjutusviga, kordussalvestust ja tagasivõtmise järjekorda.

**Seis (13.08.2026): DONE —** avaldamise ja assistendi soovitusloa siirded kirjutatakse profiili, lapsridade ja RAG-tööga samas tehingus sisutu `DomainEvent`-ina koos actor'i, profiili ID, vana/uue oleku, revision'i ja korrelatsiooni-ID-ga. PostgreSQL-i sond tõendas auditivea täielikku rollback'i, kordussalvestuse duplikaadivabadust, tagasivõtmise järjekorda ning seda, et kirjeldusi ega kontakte auditisse ei kopeerita.

### SOL-SPROF-12 — kulukatel profiili-, RAG- ja aadressitoimingutel puudub ühine serveripoolne koormuspiir — P2

**Tõend.** Profiili GET/PUT, kättesaadavuse kinnitus ja aadressisoovituste GET ei kasuta `consumeRateLimit`-i; PUT käivitab iga eduka salvestuse järel välise RAG-sünkroniseerimise (`app/api/service-provider/profile/route.js`; `app/api/service-provider/profile/services/[serviceId]/availability-confirmation/route.js`; `app/api/service-map/address-suggestions/route.js`; `lib/serviceProviderProfiles.js:1121-1139`). MTR POST-il on küll 15 minuti domeenijahtumine, kuid ülejäänud välispäringu- ja DB-rajad jäävad piiramata. PUT-il puudub ka idempotency key.

**Mõju.** Kompromiteeritud teenuseosutaja konto või korduv klient saab tekitada järjest RAG-ingeste, täisasendustehinguid ja geokooderi päringuid, kasvatades kulusid ning võimendades samaaegsus- ja lahknemisriske.

**Vastuvõtukriteerium.** Lisada jagatud kasutaja+toimingu limiter ning PUT-ile replay-kindel idempotency/revision leping; aadressipäringul ka mõistlik query-pikkuse piir. Mitme protsessi test peab tõendama ühist 429 piiri ja sama võtmega PUT peab tegema ühe DB/RAG-toimingu.

**Seis (13.08.2026): DONE —** profiili GET/PUT, kättesaadavuse kinnitus ja aadressiotsing kasutavad püsivat kasutaja+toimingu koormuspiiri; aadressipäringul on pikkusepiir ning profiili PUT nõuab replay-kindlat `Idempotency-Key` lepingut. PostgreSQL-i mitme protsessi sond tõendas ühist 429 piiri ning sama võtmega samaaegsete ja korduvate PUT-ide puhul ühe profiilirevision'i, receipt'i ja RAG-töö; erineva kehaga sama võti saab 409 konflikti.

### SOL-SPROF-13 — MTR-i 15 minuti jahtumise vastus näitab ainult kuupäeva ja alati eesti formaati — P2

**Tõend.** Server tagastab 429-ga täpse `retryAfter` hetke (`app/api/service-provider/profile/licence-check/route.js:67-82`; `lib/mtr/licenceCheckService.js:136-147`), kuid UI `formatLicenceDate()` kasutab `dateStyle:"long"` ilma kellaajata ja fikseeritud locale'i `et-EE` (`components/service-provider/ServiceLicenceStatus.jsx:24-31`, `:62-75`). Vaikimisi jahtumine on 15 minutit (`lib/mtr/policy.js:36-41`).

**Mõju.** Teade „millal tohib uuesti” annab samal päeval ainult tänase kuupäeva ega ütle, kas oodata 1 või 14 minutit; EN/RU kasutaja näeb eestikeelset kuupäeva.

**Vastuvõtukriteerium.** Kuvada lokaadipõhine kuupäev ja kellaaeg või arusaadav järelejäänud minutite loendur; server võiks anda ka standardse `Retry-After` päise. Testida ET/EN/RU, sama päeva ja järgmise päeva retry-hetke ning Tallinna ajavööndi piiri.

**Seis (13.08.2026): DONE —** MTR-i jahtumise 429 vastus annab standardse `Retry-After` päise ning UI vormindab retry-hetke kasutaja ET/EN/RU lokaadi, kuupäeva, kellaaja ja `Europe/Tallinn` ajavööndi järgi. Sihttestid katavad sama päeva, järgmise päeva ja Tallinna suveajapiiri.

### SOL-SPROF-14 — profiili tavapärane salvestus võib individuaalselt peidetud teenuse või asukoha uuesti avaldada — P2

**Tõend.** Vorm laeb lapsrea `status` väärtuse, kuid salvestuspayload kirjutab iga asukoha ja teenuse staatuseks ainult profiili üldstaatuse põhjal `PUBLISHED` või `DRAFT`, sõltumata rea varasemast `HIDDEN`/`REVIEW` seisust (`components/workspace/WorkspaceFeaturePage.jsx:3988-3991`, `:4183-4215`). UI-s pole lapsrea staatuse muutmise juhtelementi. Server usaldab saadetud staatust ja uuendab olemasolevat teenust kohapeal (`lib/serviceProviderProfiles.js:639-689`, `:995-1033`).

**Mõju.** Admini, migratsiooni või API kaudu individuaalselt peidetud teenus/asukoht võib omaniku täiesti seosetu kontaktiparanduse järel uuesti avalikuks saada. See muudab peitmise ebapüsivaks ja võib aktiveerida SOL-SPROF-03 avaliku lekke.

**Vastuvõtukriteerium.** Lapsrea staatus tuleb kas UI-s ausalt hallata või tavavormis muutmata säilitada; üldprofiili avaldamine ei tohi HIDDEN rida vaikimisi taasavada. Testida avaliku profiili HIDDEN teenuse ja asukoha salvestust pärast telefoninumbri muutmist.

**Seis (13.08.2026): DONE —** profiili tavapärane salvestus säilitab olemasoleva teenuse ja asukoha individuaalse staatuse ning UI võimaldab lapsrea staatust eraldi hallata; üldprofiili avaldamine ei kirjuta enam kõiki lapsi automaatselt `PUBLISHED`/`DRAFT` olekusse. PostgreSQL-i sond tõendas, et telefoninumbri muutmise järel jäävad HIDDEN teenus ja asukoht peidetuks.

### SOL-SPROF-15 — avaldamise kontrollid on informatiivsed, server lubab tühja teenuseprofiili RAG-i — P2

**Tõend.** UI arvutab teenuse, asukoha ja kontakti valmisolekukontrollid, kuid salvestusnupp nõuab ainult organisatsiooni nime (`components/workspace/WorkspaceFeaturePage.jsx:4242-4292`, `:4919-4967`). Serveri normaliseerija nõuab samuti ainult `organizationName`-i; `status:PUBLISHED` ja `assistantRecommendationAllowed:true` võetakse vastu ilma ühegi teenuse, kontakti või avaldamisvalmiduse reeglita (`lib/serviceProviderProfiles.js:604-636`, `:910-975`). RAG `shouldPublish` kontrollib ainult neid kahte lippu (`:475-479`).

**Mõju.** Assistent võib hakata soovitama sisuliselt tühja või kontaktita osutajaprofiili; kasutaja näeb küll hoiatusi, kuid sama nupp avaldab ikkagi. Teenusekaardi ja RAG-i avaldamislepingud muutuvad omavahel erinevaks.

**Vastuvõtukriteerium.** Lukustada serveripoolne minimaalne avaldamisleping: vähemalt üks sobiva staatusega teenus ning teadlikult määratud kontakt-/ligipääsutee; kaardiasukoht võib olla valikuline veebiteenusele. UI peab näitama välja-põhiseid vigu ja API-test peab otse-PUT tühja PUBLISHED+AI payload'i tagasi lükkama.

**Seis (13.08.2026): DONE —** serveripoolne avaldamisleping nõuab avaldamiseks sobivat teenust ja teadlikku ligipääsuteed. Autenditud route-taseme otse-PUT tühja `PUBLISHED`+AI payload'iga tagastas 400 `service_provider_profile.errors.publish_service_required` ning ei muutnud olemasolevat profiili ega lapsridu.

## Järgmine auditijärjekord

1. Töölauakaardid: Meetodipeegli, Minu otsingu ja Teenuseprofiili esimene süvaplokk tehtud; järgmisena `Materjalid`.
2. Lõpetada osalised kaardid: Tööheaolu runtime, Organisatsioonide ülejäänud vaated, Minu jagamiste koondvaade ja Teenuspäevik.
3. Lõpetada `auth` ja `casework` päris DB-/brauseri runtime ning negatiivsete juhtumite tõendamine.
4. `lib/**`: katmata äriloogika, tehingud, idempotentsus, retention ja outbox.
5. `rag-service/**`, Prisma skeem ja migratsioonid — staatiline esimene plokk tehtud; päris upgrade/runtime `not_run`.
6. Koondtestid ning lõplik P0–P3 otsus; parandused jäävad eraldi tööks.
