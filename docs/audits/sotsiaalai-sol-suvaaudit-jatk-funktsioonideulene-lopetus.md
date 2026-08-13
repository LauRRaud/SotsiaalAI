# SotsiaalAI SOL-süvaaudit — funktsioonideülene lõpetus

**Auditi seis:** Haldus, Ruumid ja Töölaud ning tellitud funktsioonideülesed vood on fikseeritud koodi vastu staatiliselt `DONE`; anonüümne ja sünteetilise vastusega brauseriruntime `PARTIAL`; autentitud mitme kasutaja, päris SMTP/RAG/välisteenuste ja tootmiskeskkonna tervikruntime `NOT_PROVEN`.

**Fikseeritud audit-commit:** `a4e00e43ea72e6d0e08a09103df804d14123dbb0`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-smapclose-a4e00e4` (detached HEAD). Tootmiskoodi ei muudetud, stage'itud, commit'itud, push'itud ega deploy'itud.

## Kõrgema taseme pindade katvus

| Pind | Staatiline audit | Runtime | Kontrollitud ulatus |
|---|---|---|---|
| Haldus | DONE | PARTIAL | administraatori kaardi nähtavus, `adminHub` olek, neli menüükaarti, kõik tegelikud `/admin/**` lehed, serveri- ja API-väravad, URL/F5/doki kontekst ning anonüümne piir |
| Ruumid | DONE | PARTIAL | `/ruum` ja `/rooms`, loend, detaililink, serveri tegevuslipud, kutse/lahkumine/kustutus/arhiveerimine, veaolek, ruumi- ja kõneelutsükli kattuvused ning sünteetilise vastusega brauserirada |
| Töölaud | DONE | PARTIAL | kõigi 20 funktsioonikaardi rollipõhine olemasolu, kolm tsooni, admini S/P/T vaade, feature-flag'id, chat-workspace süvalingid, continuity, doki tagasitee ja anonüümne sisselogimisvärav |

Töölaud sisaldab kolme rolli ühendvaates kõiki tellitud 20 funktsiooni. Kliendile, sotsiaaltöötajale ja teenuseosutajale ei näidata sama kaardikomplekti; see on tooteleping, mitte puuduv katvus. Admini vaateroll mõjutab esitlust, mitte serveri õigusi, ja salvestatakse HTTP-only küpsisesse.

## Uued leiud

### SOL-XFUNC-01 — Haldus on URL-ita ajutine olek ja jätab kolm päris halduspinda menüüst välja — P2

**Tõend.** Haldus avaneb `RoomStage` lokaalse `adminHub` booleanina (`components/room/RoomStage.jsx:334,1184-1192,1485-1492`). `/admin` lehte ei ole ning fikseeritud buildi route-loendis on `/admin` puudu; päris HTTP vastus oli 404. Halduskomplekt näitab ainult Analüütikat, RAG-i, Teenuste kättesaadavust ja kinnitusi. Samas buildis on eraldiseisvad, serveris administraatoriga kaitstud lehed `/admin/wellbeing`, `/admin/urgent-desks` ja `/admin/mentorlus`, kuid ühtki neist `adminItems` loendis ei ole. Admini alamlehe värskendamisel või otsesüvalingiga avamisel on `adminHub=false`; dokk ei taasta Halduskomplekti, sest `roomHubReturn` allowlist sisaldab ainult `/`, Töölauda, Tööheaolu, Kovisiooni ja Profiili (`lib/roomHubReturn.js:17-24`).

**Mõju.** Haldus ei ole järjehoidjaga, jagatava lingiga ega F5 järel taastatav tervikpind. Kolm olemasolevat adminitööriista on Haldusest leitamatud ning otse avatud adminileht võib saada tavapõhise töödoki, mitte Haldus-konteksti. See ei ava tavakasutajale administraatoriõigusi, sest lehed ja API-d kontrollivad sessiooni eraldi, kuid muudab haldusfunktsioonide tegeliku ulatuse ja navigeerimise ebaausaks.

**Vastuvõtukriteerium.** Luua päris `/admin` hub-route või muu URL-iga taastatav halduskontekst, milles on kõik omanikult kinnitatud administraatoripinnad. Otse-/F5-süvalink peab taastama Haldus-doki; tundmatu ja mitteadmin peab saama fail-closed vastuse. Contract-test peab võrdlema route-manifesti teadlikult klassifitseeritud adminilehtede loendiga, mitte käsitsi valitud nelja kaardiga.

**Seis.** DONE — commit `84afee74` lisab serveris autentiva päris `/admin` hub-route'i ning kanoonilise `ADMIN_SURFACES` registri, mida kasutavad nii hub kui Haldus-dokk. Contract-test võrdleb registrit kõigi 13 tegeliku `app/admin/**/page.jsx` pinnaga. Autenditud lokaalses brauseris avanes 13/13 pinda, `/admin/wellbeing` säilitas F5 järel Haldus-doki, tundmatu adminitee oli 404 ning mitteadmin suunati fail-closed avalehele. Tootmisruntime ja deploy jäid `NOT_PROVEN`.

### SOL-XFUNC-02 — Ruumid ignoreerib serveri tegevuslepingut ning peidab keelatud kustutuse vea — P2

**Tõend.** `GET /api/rooms` arvutab iga rea kohta kanoonilised `canDelete`, `canArchive`, `canInvite` ja `canTransfer` lipud omaniku, päritolu ja arhiiviseisu järgi (`app/api/rooms/route.js:125-170`). `RoomsPage` neid ei kasuta: ta tuletab õiguse ainult kliendile saadetud `role` väärtusest (`components/rooms/RoomsPage.jsx:82-92,441-444`), ei loe kordagi `room.canArchive` väärtust ega paku PATCH-arhiveerimist. Voo-ruumi omanikule näidatakse seetõttu `Kustuta`, kuigi server keelab mitte-`MANUAL_INVITE` ruumi kustutuse 409-ga ja tagastab `canArchive:true` (`app/api/rooms/[roomId]/route.js:66-76`). Kõik loendi-, lahkumis- ja kustutusvead lähevad ainult `console.warn`-i; laadimisviga asendatakse tühja `rooms=[]` loendiga (`components/rooms/RoomsPage.jsx:106-123,131-183`).

Sünteetilise route-vastusega Chromiumi kontrollis oli PRE_INQUIRY-ruum `role=OWNER`, `canDelete=false`, `canArchive=true`. UI näitas `Kutsu` ja `Kustuta`, kuid mitte `Arhiveeri`. Kustutuse kinnitus saatis päringu, mock-server vastas 409 `canArchive:true`, modaal sulgus, ruum jäi loendisse ning nähtavat veateadet ei tekkinud; tõrge jäi ainult konsooli.

**Mõju.** Voo-ruumi omanik ei saa Ruumide pinnalt serveri pakutud korrektset lõpetusviisi kasutada. Ta saab eksitava ja alati nurjuva hävitava toimingu, mille ebaõnnestumist UI varjab. Sama lokaalne rollituletus võib näidata moderaatorile kutsetoimingut, mida serveri omaniku-põhine leping ei luba. Laadimisviga näeb kasutajale välja nagu tal poleks ruume.

**Vastuvõtukriteerium.** UI peab kasutama ainult serveri tegevuslippe, kuvama `canArchive` korral arhiveerimise ning mitte renderdama keelatud kustutust/kutset. Iga 4xx/5xx peab säilitama dialoogi või andma nähtava taastatava veaseisu. Brauseritest peab katma MANUAL_INVITE, PRE_INQUIRY/HELP_MATCH, arhiveeritud ruumi, omaniku/moderaatori/liikme ning GET/PATCH/DELETE tõrked.

**Seis.** DONE — commit `84afee74` eemaldab `RoomsPage`-i rollipõhise õiguste tuletuse ja kasutab ainult serveri `canInvite`, `canLeave`, `canDelete` ning `canArchive` lippe. UI pakub PATCH-arhiveerimist, ei kuva keelatud kutset/kustutust ning säilitab GET/PATCH/DELETE tõrke nähtava taastatava seisuna. Autenditud brauserirada kattis `MANUAL_INVITE`, `PRE_INQUIRY`, `HELP_MATCH`, arhiveeritud ruumi ning omaniku/moderaatori/liikme; päris PostgreSQL-i kahe sünteetilise konto sond kinnitas ühe kustutuse, ühe arhiveerimise ja kahe kontrollruumi muutumatuse (`PROBE_OK accounts=2 delete=1 archive=1 unchanged=2`). Tootmisruntime ja deploy jäid `NOT_PROVEN`.

### SOL-XFUNC-03 — isikuandmete koopia registril puudub täielikkusleping ning uus kasutajapind jääb vaikimisi välja — P1

**Tõend.** `DATA_EXPORT_REGISTRY` on teadlikult kinnine kuue pinna loend: profiil/nõusolekud, vestlused, Teekonnad, Tööheaolukirjed, eelpöördumised ning dokumendid/artefaktid (`lib/dataExport/registry.js:101-179`). Puuduva pinna vaikekäitumine on vaikne väljajätt; skeemi või tootmiskoodi vastu puudub klassifikatsioonivärav, mis nõuaks iga kasutajaga seotud mudeli kohta `exported`, `third-party excluded`, `retained snapshot` või põhjendatud `not personal data` otsust.

See ei ole üksiku varasema leiu uus nimi. Eri lõpetusringid tõendasid sama arhitektuurse vaikimisi-väljajätu vähemalt järgmistes sõltumatutes pindades: `PracticeReflection` (`SOL-REF-06`), teenuseprofiil (`SOL-SPROF-08`), Välitöö (`SOL-FIELD-J-09`), Tööheaolu mustandid (`SOL-WB-18`), Organisatsioonid (`SOL-ORG-19`), Minu jagamised (`SOL-SHARE-06`) ja Teenuspäevik (`SOL-SLOG-J-05`). Prisma `User` kannab otseseid seoseid mh `WellbeingOutputDraft`, `PracticeReflection`, `FieldVisit`, `ServiceEntry`, `OrganizationMembership`, `NetworkShare` ja `UrgentRequest` mudelitele (`prisma/schema.prisma:754-888`), kuid registry kasv ei ole nende lisamise värav.

**Mõju.** Iga uus funktsioon või jagamismudel võib läbida buildi ja kõik olemasolevad eksporditestid, kuid jääda kasutaja koopiast täielikult välja. Konto kustutuse või retention'i järel võib ainus taastatav kasutajaajaloo tõend kaduda enne, kui puuduv register avastatakse. Üksikute moodulite parandamine ei takista sama vea kordumist järgmise mudeliga.

**Vastuvõtukriteerium.** Kehtestada masinloetav kasutajaandmete pinnaregister ja CI-värav: iga Prisma kasutajaseos ning fail/RAG/väliskoopia peab saama omaniku, projektsiooni, kolmanda isiku filtri, retention-klassi ja ekspordiotsuse. Skeemi lisandunud või ümber nimetatud seos peab värava punaseks tegema, kuni klassifikatsioon ja positiivne/negatiivne test on lisatud. ZIP-i integratsioonitest peab võrdlema sünteetilise kasutaja tegelikke klassifitseeritud pindu manifestiga.

**Seis.** DONE — kasutajaandmete masinloetav pinnaregister klassifitseerib kõik praegused 157 Prisma `User`-seost ning 41 skeemist avastatavat ja kaks koodipõhist faili-, RAG- või väliskoopia pinda omaniku, projektsiooni, kolmanda isiku filtri, retention-klassi ja ekspordiotsusega. Iga kirje kannab positiivse ja negatiivse kontrolli lepingut; uus või ümber nimetatud kasutajaseos või koopiamarker muudab CI-värava punaseks, kuni register on teadlikult uuendatud. Sünteetilise kasutaja ZIP-integratsioon nõuab manifesti täpset vastavust kõigile 15 käivitatud ekspordipinnale. Negatiivkontroll vana käitumise vastu kukkus ootuspäraselt; päris PostgreSQL oli `not_run`, sest invariant on skeemi- ja manifestipõhine. Production-andmekoopia jäi `NOT_PROVEN`.

## Funktsioonideüleste voogude järeldused

| Tellitud voog | Auditi seis | Järeldus |
|---|---|---|
| Ühe mooduli andmete liikumine teise | DONE | Teekond→eelpöördumine/Teenusekaart, Välitöö→Teenuspäevik/dokument, Tööheaolu→Kovisioon/Supervisioon, ruum→privaatkoopia, teenuseprofiil/kaart→vestluse retrieval ja notification/action sisenemised kontrollitud; aktiivsed juurpõhjused jäävad vastavate `SOL-*` leidude alla |
| Rolli ja organisatsiooni vahetus | DONE | admini vaateroll on esitluskiht; organisatsiooni ID on URL-is ja serveri access-context'is; olemasolevad mitme organisatsiooni skoobi- ja omandileiud jäid `SOL-ORG`, `SOL-SLOG` ja `SOL-SPROF` alla; uut tõendatud privileegileket ei lisatud |
| Konto kustutus ja retry | DONE | kontrolliti user-cascade'i, tombstone/SetNull radu, fail-closed cleanup'i ja `DataDeletionJob` retry'd; süsteemne katkine seis on juba `SOL-ORG-18`, `SOL-SHARE-07`, `SOL-SLOG-J-06` jt, uut duplikaati ei lisatud |
| Andmekoopia | DONE | kuue pinna registry, ZIP-worker ja allalaadimine võrreldi kasutajaseoste ning kõigi lõpetusraportitega; lisandus süsteemne `SOL-XFUNC-03` |
| Retention | DONE | üldsweep, sisemine cron-route, request-side käivitajad, moodulipõhised tähtajad ja puuduvad worker'id kontrollitud; `SOL-SEARCH-01`, `SOL-MAT-12`, `SOL-SLOG-J-07`, `SOL-WB-18` jt jäävad avatuks |
| RAG-i koopiad ja eemaldamine | DONE | ingest, stale/tombstone, konto kustutuse järjekord, Teenusekaart ja vestluse retrieval kontrollitud; `SOL-RAGADMIN`, `SOL-RAGSVC`, `SOL-SPROF`, `SOL-SMAP` leiud jäid ametlikeks juurpõhjusteks |
| Failid ja välised koopiad | DONE | dokumendi-, materjali-, Välitöö-, Teenuspäeviku-, kõnesalvestuse-, SMTP- ja kaarditile'i koopiad kontrollitud; uus tile-leid on `SOL-SMAP-09` |
| SMTP ja muud teavitused | DONE | notification-worker, outbox/reconciler, otsemailerid, jagamis- ja süvalingid kontrollitud; päris SMTP jäi `NOT_PROVEN`, olemasolevaid `SOL-NOTIF`, `SOL-INV`, `SOL-MAT`, `SOL-FIELD` leide ei dubleeritud |
| Töölaua süvalingid | DONE | chat `workspace=*`, continuity, roomId, profileId, practice, entry/listing/match lingid kontrollitud; katkised sihid on `SOL-SMAP-06`, `SOL-SEARCH-04` ning Haldus-kontekst `SOL-XFUNC-01` |
| Samaaegsus ja idempotentsus | DONE | advisory-lock/CAS/idempotency võtmed, P2002 fallback'id, osalised tulemused ja crash-recovery võrreldi testide ning avatute leidudega; roheline täissviit ei tühista kirjeldatud katmata päris DB/mitme protsessi võistlusi |

## Testid, build ja runtime

- Fikseeritud commit'i täielik testivärav: `npm test` — **3718/3718 PASS**, 0 failed, 0 skipped/todo; 49,9 s.
- Haldus/Ruumid/Töölaud, workspace, workbench, notification-continuity ja admini sihtsviit: **151/151 PASS**.
- Teenusekaardi laiendatud sihtsviit: **141/141 PASS**.
- `npx prisma validate --schema prisma/schema.prisma` — **PASS**.
- `npm run build:webpack` — **PASS**: i18n ET/EN/RU OK, compile, TypeScript, **69/69** staatilist lehte ja route-manifest; 227,4 s.
- Anonüümne päris HTTP fikseeritud serveris: `/toolaud` ja `/ruum` suunasid brauseri avalehele; `/api/rooms`, `/api/workspace/continuity` ja `/api/admin/notifications` vastasid 401; `/admin` vastas 404.
- Ruumide sünteetilise vastusega Chromium: `SOL-XFUNC-02` reprodutseeritud.
- Teenusekaardi anonüümne ja sünteetilise vastusega Chromium: `SOL-SMAP-05`, `06`, `08` ja `09` reprodutseeritud.
- Jagatud sünteetiliste kontode varasemad värsked lõpetuskontrollid leidsid kõik viis kontot ja aktiivsed tellimused, kuid **0/5 dokumenteeritud credential'ist kehtis**. Kontosid ei taastatud, PIN-e ei väljastatud ning aktiivseid seansse ei kustutatud. Seetõttu jäi autentitud brauseriruntime ausalt `NOT_PROVEN`.

## Leidude mõju koondloendile

Enne käesolevat plokki oli kõigis peafaili ja registreeritud jätkufailides **426 unikaalset leidu**: 110 `DONE` ja 316 lahtist. Käesolev plokk lisab **3** uut aktiivset leidu: **1 × P1 ja 2 × P2**.

Uus kogu auditi loend on seega:

| Seis | P0 | P1 | P2 | P3 | Kokku |
|---|---:|---:|---:|---:|---:|
| DONE | 22 | 59 | 28 | 1 | 110 |
| Lahtine / kvalifitseeritud | 0 | 223 | 95 | 1 | 319 |
| **Kõik leiud** | **22** | **282** | **123** | **2** | **429** |

Kõik P0 leiud on ametliku `Seis`-lõigu järgi `DONE`. See ei tähenda, et platvormi kõik P1–P3 leiud oleksid parandatud; 319 leidu jääb avatuks või kvalifitseeritud/tõendamata lõppseisu.
