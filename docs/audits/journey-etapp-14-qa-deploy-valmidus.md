# SotsiaalAI Journey MVP - Etapp 14 QA ja deploy-valmidus

## 1. Kokkuvõte

Etapp 14 kontrolli põhjal on Teekonna MVP valmis piiratud kasutajatestiks, kuid production deploy otsust ei tohiks teha enne staging/prod-laadse andmebaasi migratsiooniproovi ja varuplaani kinnitamist.

Lõplik otsus: **READY_FOR_LIMITED_USER_TEST**.

Peamine põhjus:

- puhta lokaalse Postgres testandmebaasi migratsiooniproov läbis;
- `npx prisma validate`, `npx prisma generate` ja `npx prisma migrate status` läbisid;
- Journey owner-access API smoke läbis;
- CLIENT, SOCIAL_WORKER, SERVICE_PROVIDER rollivaated töötasid ajutiste päris rollikontodega;
- admin effective-role preview töötas testadmin kontoga;
- privaatne Journey ega private chat ei lekkinud kontrollitud smoke'ides.

Alles jääv kõrge risk:

- lokaalses dev-andmebaasis on endiselt varasem Prisma drift migratsiooni `20260105120000_add_rooms_invites` ja vanade timestamp/index erinevuste tõttu;
- see ei takistanud puhast migratsiooniproovi, kuid production deploy vajab staging/prod-laadset kinnitust.

## 2. Migratsiooniproov

Käivitatud kontrollid:

| Kontroll | Tulemus |
|---|---|
| `npx prisma validate` | Läbis |
| `npx prisma generate` | Läbis |
| `npx prisma migrate status` | Läbis, `Database schema is up to date!` |
| `npx prisma migrate deploy` ajutisel tühjal DB-l | Läbis, kõik 64 migratsiooni rakendusid |
| `npx prisma migrate status` ajutisel DB-l | Läbis, schema up to date |
| `npx prisma migrate dev` lokaalsel dev-DB-l | Ei läbinud vana drift'i tõttu |

Puhas/staging DB migratsiooniproov:

- DB tüüp: lokaalne PostgreSQL samas serveris.
- DB nimi: ajutine `sotsiaal_ai_migration_probe_*`.
- DB seis: tühi andmebaas.
- Käivitatud: `npx prisma migrate deploy` eraldi `DATABASE_URL` väärtusega.
- Tulemus: kõik 64 migratsiooni rakendusid edukalt.
- Käsitsi SQL: ei olnud vaja.
- Ajutine DB kustutati pärast kontrolli.

Etapp 1-13 migratsioonid, mis olid kontrolli fookuses:

| Migratsioon | Sisu | Tulemus puhtal DB-l |
|---|---|---|
| `20260526090000_add_journey_core` | Journey core | Rakendus |
| `20260526093000_add_room_origin_meta` | Room origin/meta | Rakendus |
| `20260526103000_add_service_map_access_path` | ServiceMapEntry accessPath | Rakendus |

Migration drift otsus: **SAFE kasutajatestiks, production jaoks vajab staging kinnitust**.

Täpsustus:

- puhtal DB-l migratsioonid töötavad;
- lokaalne `migrate dev` drift on seotud varasema dev-andmebaasi ajalooga, mitte Etapp 1-13 migratsioonide puhta rakendatavusega;
- production deploy ei ole veel soovitatav ainult lokaalse dev-DB põhjal.

## 3. Rollipõhine QA

QA tehti ajutiste päris rollikontodega:

- CLIENT: ajutine `qa-e14-client-*`;
- SOCIAL_WORKER: ajutine `qa-e14-worker-*`;
- SERVICE_PROVIDER: ajutine `qa-e14-provider-*`;
- Admin: `raudsoolaur+testadmin@gmail.com`.

Ajutised QA kasutajad ja nende Journey objekt kustutati pärast smoke'i.

| Roll | Kontroll | Tulemus |
|---|---|---|
| CLIENT | `/teekond` avaneb | 200 |
| CLIENT | näeb Teekond tööpinda ja `Alusta Teekonda` tegevust | Läbis |
| CLIENT | saab luua Journey API kaudu | 201 |
| CLIENT | saab avada enda `/teekond/[id]` | Läbis |
| CLIENT | detailvaates on privaatsus, teenusekaart, eelpöördumine, tervisekontakt | Läbis |
| CLIENT | saab arhiveerida PATCH kaudu | Läbis, status `ARCHIVED` |
| SOCIAL_WORKER | `/teekond` avaneb | 200 |
| SOCIAL_WORKER | ei näe `Alusta Teekonda` loomise vaadet | Läbis |
| SOCIAL_WORKER | näeb kinnitatud eelinfo rollivaadet | Läbis |
| SOCIAL_WORKER | võõra `/teekond/[id]` ei leki pealkirja/sisu | Läbis |
| SERVICE_PROVIDER | `/teekond` avaneb | 200 |
| SERVICE_PROVIDER | ei näe `Alusta Teekonda` loomise vaadet | Läbis |
| SERVICE_PROVIDER | näeb teenusega seotud eelinfo rollivaadet | Läbis |
| Admin CLIENT preview | kuvab CLIENT loogikat | Läbis |
| Admin SOCIAL_WORKER preview | ei kuva privaatseid Journey nimekirju | Läbis |
| Admin SERVICE_PROVIDER preview | ei kuva privaatseid Journey nimekirju | Läbis |

Märkus:

- testkontodel OTP samm märgiti lokaalses QA-s DB-s verifitseerituks, et rollivooge automaatselt testida ilma e-posti OTP kanalita;
- see oli ainult lokaalne smoke-abivahend, mitte rakenduse koodimuudatus.

## 4. API ja owner-access

Kontrollitud API route'id:

- `GET /api/journeys`;
- `POST /api/journeys`;
- `GET /api/journeys/[id]`;
- `PATCH /api/journeys/[id]`;
- `POST /api/journeys/draft`;
- `POST /api/journeys/[id]/pre-inquiry-draft`.

Smoke tulemused:

| Kontroll | Tulemus |
|---|---|
| sisselogimata `GET /api/journeys` | 401 |
| sisselogimata `POST /api/journeys/draft` | 401 |
| `POST /api/journeys/draft` sisselogitult | 200 |
| draft route lõi DB Journey objekte | Ei, muutus 0 |
| CLIENT `POST /api/journeys` | 201 |
| klient proovis üle kirjutada `ownerUserId` | server määras omanikuks sessiooni CLIENT kasutaja |
| klient proovis saata `sharingStatus: SHARED` | salvestus jäi `PRIVATE` |
| CLIENT `GET /api/journeys/[id]` enda Journey kohta | 200 |
| CLIENT `PATCH /api/journeys/[id]` enda Journey kohta | 200 |
| PATCH proovis muuta `ownerUserId` | omanik jäi samaks |
| PATCH proovis muuta `sharingStatus` | jäi `PRIVATE` |
| SOCIAL_WORKER `GET` võõra Journey kohta | 404 |
| SERVICE_PROVIDER `PATCH` võõra Journey kohta | 404 |
| CLIENT pre-inquiry draft enda Journey põhjal | 200 |
| SOCIAL_WORKER pre-inquiry draft võõra Journey põhjal | 404 |

Teenusekaardi handoff on hetkel helper/UI-link, mitte eraldi server route. Võõra Journey põhjal linki koostada ei saanud, sest võõra detailvaade ei lekitanud Journey sisu.

## 5. Privaatsuse kontroll

Kontrollitud piirid:

- Journey API on owner-põhine;
- `ownerUserId` määratakse serveris;
- `sharingStatus` jääb MVP-s `PRIVATE`;
- draft ei muutu püsivaks objektiks;
- SOCIAL_WORKER ja SERVICE_PROVIDER ei saa API kaudu võõrast Journey objekti;
- võõra `/teekond/[id]` smoke ei lekitanud QA Journey pealkirja;
- eelpöördumise handoff tagastab ainult kasutaja enda Journey põhjal prefill payload'i;
- `sharedJourneyInfo` loetakse eelpöördumise `assessmentState` kaudu, mitte privaatse Journey objektina;
- Room `originId`/`originMeta` on kirjeldav metadata, mitte ligipääsuallikas;
- `accessPath` on teenusekaardi metadata ja ei sisalda kasutaja Journey sisu;
- tervisekontakti küsimuste mustandit ei saadeta automaatselt.

Private chat:

- koodikaardistuse ja smoke'i põhjal private chat'i ei lisata Journey handoff payload'i, provider/spetsialisti eelinfo plokki ega Room origin meta sisse;
- täismahus chat sõnumi sisuline RAG vastuse test jäi kasutajatesti/käsitsi QA ringi, et mitte teha kulukat mudelikõnet ilma eraldi vajaduseta.

## 6. Chat/RAG regressioon

Kontrollitud:

- `/vestlus` route vastas CLIENT sessiooniga 200;
- Teekond + menüü integratsioon on koodis aktiivne ainult valitud workflow'na;
- tavachat ei loo JourneyDrafti automaatselt;
- draft route on eraldi `/api/journeys/draft`;
- displayed sources/source attribution koodi ei muudetud Etapp 14 raames;
- `app/api/chat/route.js` ja `lib/chat/**` jäid Etapp 14 ajal puutumata.

Piirang:

- reaalset RAG mudelivastust ja allikate kuvamist ei jooksutatud automaatselt, et mitte teha ebavajalikku mudelikõnet;
- kasutajatesti stsenaariumides peab tavachat/RAG allikate smoke olema eraldi samm.

## 7. Eelpöördumine, teenusekaart ja Room

Eelpöördumine:

- `/eelpoordumised` route vastas CLIENT sessiooniga 200;
- Teekond -> eelpöördumine prefill route töötas omanikule 200;
- võõra Journey põhjal prefill tagastas 404;
- `PreInquiryStatus` enum jäi skeemis puutumata;
- eelpöördumise vastuvõtja näeb `sharedJourneyInfo` põhjal kinnitatud infot, mitte privaatset Journey objekti.

Teenusekaart:

- `/teenusekaart` route vastas CLIENT sessiooniga 200;
- Teekond detailis oli nähtav `Ava teenusekaart`;
- `ServiceMapEntry.accessPath` on JSON väli;
- accessPath UI kuvab fallback'i, kui täpne info puudub;
- accessPath tekstides on `notDecision` hoiatus ja see ei ole ametlik hindamine ega teenuse määramine.

Room:

- Room mudelis on `originType`, `originId`, `originLabel`, `originMeta`;
- Room origin helper normaliseerib origin väärtused;
- origin metadata ei anna koodi järgi automaatset ligipääsu päritoluobjektile;
- Room access/membership tuuma Etapp 14 ei muutnud.

Piirang:

- `/kutsed` andis smoke'is 404; see võib tähendada, et kutsete kasutajavaade on teise route'i all või ei ole selles sessioonis otse avanev;
- käsitsi kutse, help-match ruumi ja eelpöördumisest ruumi loomise täisvoog tuleb kasutajatestis eraldi läbi klikkida.

## 8. Teenuse jätkumine ja tervisekontakt

Teenuse jätkumise kontroll:

- aktiivse QA Journey detailvaade avanes 200;
- `context.serviceContinuity` andmetega Journey detail kuvas teenuse jätkumise kokkuvõtte sisu;
- tekstis oli nähtav ametliku hinnangu/otsuse vältimise piir;
- eelpöördumise ja teenusekaardi tegevused olid detailis nähtavad;
- info jääb Journey konteksti ja `sharingStatus` ei muutu automaatselt.

Tervisekontakt:

- tervisekontakti suund kuvatakse ainult Journey konteksti/signaali alusel;
- detailvaates oli nähtav tervisekontakti plokk;
- tekst ütleb, et SotsiaalAI ei anna meditsiinilist hinnangut;
- küsimuste mustandit ei saadeta automaatselt;
- tervisekontakt ei saa API kaudu Journey ega chat'i ligipääsu;
- teenusekaart ei muutu terviseplatvormiks, sest accessPath käsitleb tervisekontakti ainult kontaktisuunana.

Piirang:

- teenuse jätkumise vormi täielikku brauseris täitmist ei automatiseeritud; kontrolliti olemasoleva JSON konteksti kuvamist ja API kaudu salvestusloogika piire.

## 9. UI ja i18n

Kontrollitud:

- `npx eslint app/teekond components/journey lib/journey app/api/journeys components/workspace lib/serviceMap components/chat components/rooms lib/rooms lib/workspaceDashboardCards.js` läbis;
- etteantud lai käsk koos `messages` argumendiga ei ole selle projekti ESLint konfiguratsiooniga sobiv, sest `messages` kaust on ignoreeritud;
- `messages/et.json`, `messages/en.json`, `messages/ru.json` parsiti eraldi JSON-ina ja kõik kolm olid korras;
- `rg` ei leidnud kasutajale nähtavat vana route'i `minu-teekonnad`;
- `rg` ei leidnud kasutajale nähtavat nimetust `Minu teekonnad`;
- `Teekond` on kasutajanimetusena rollivaadetes kasutusel.

Tähelepanek:

- komponentides on `t(key, fallback)` fallback'id, mis sisaldavad osaliselt ingliskeelset teksti (`Journey updated`, `Journey archived`, `Journey is private`). Kui tõlkesõnastik laadib võtmed korrektselt, kasutaja näeb tõlget. Enne laiemat kasutajatesti tasub fallback'id eesti keeleks ühtlustada, et tõlkesüsteemi rikke korral ei tekiks ingliskeelseid varutekste.

Visuaalne stiil:

- Etapp 14 ei muutnud UI-d;
- varasemad rollivaated kasutavad olemasolevaid workspace/glass mustreid;
- kasutaja eelnev nõue jääb jõusse: uued vaated peavad austama light, mid, dark, night, mono ja HC teemasid ning vältima liigseid kaste/jooni/triipe.

## 10. Kasutajatesti stsenaariumid

### Pöörduja testlood

1. Ava `/teekond`.
2. Kontrolli, et lehel on nimetus `Teekond`, privaatsusmärge ja `Alusta Teekonda`.
3. Alusta Teekonda `/teekond` lehelt.
4. Kirjelda olukorda oma sõnadega.
5. Kontrolli, et mustand ei salvestu enne kinnitust.
6. Salvesta Teekond.
7. Ava `/teekond/[id]`.
8. Muuda lubatud välju ja salvesta.
9. Ava teenusekaart Teekonna detailist.
10. Koosta eelpöördumise mustand Teekonnast.
11. Kontrolli, et eelpöördumist ei saadeta automaatselt.
12. Tee teenuse jätkumise kontroll.
13. Koosta tervisekontaktile küsimuste mustand.
14. Kontrolli, mida jagatakse ja mida ei jagata.
15. Arhiveeri Teekond.

### Pöörduja chat testlood

1. Ava `/vestlus`.
2. Saada tavaline RAG küsimus, näiteks `Mis on koduteenus?`.
3. Kontrolli, et allikad kuvatakse nagu enne.
4. Kontrolli, et Teekond ei käivitu automaatselt.
5. Ava + menüü ja vali `Teekond`.
6. Kirjelda olukorda.
7. Kontrolli, et tekib JourneyDraft.
8. Salvesta Teekond kinnitusega.
9. Kontrolli, et tavachat ilma + menüü valikuta ei kuva passiivset Teekonna soovitust.

### Spetsialisti testlood

1. Logi sisse SOCIAL_WORKER rollis.
2. Ava `/teekond`.
3. Kontrolli, et privaatseid Teekondi ei kuvata.
4. Ava saabunud eelpöördumise vaade.
5. Kontrolli, et Teekonnast tulnud eelinfo kuvatakse ainult siis, kui see on eelpöördumisega saadetud.
6. Kontrolli, et spetsialist ei näe privaatset Teekonda.
7. Kontrolli, et spetsialist ei näe private chat'i.
8. Ava seotud ruum, kui see on olemas.

### Teenuseosutaja testlood

1. Logi sisse SERVICE_PROVIDER rollis.
2. Ava `/teekond`.
3. Kontrolli, et privaatseid Teekondi ei kuvata.
4. Ava teenusega seotud pöördumine.
5. Kontrolli, et näha on ainult konkreetse teenuse/pöördumisega seotud kinnitatud eelinfo.
6. Kontrolli, et kogu Journey ei ole nähtav.
7. Kontrolli, et private chat ei ole nähtav.
8. Kontrolli teenuseprofiili ja ruumi seoseid.
9. Kontrolli, et teise teenuseosutaja pöördumine ei ole nähtav.

### Admin/effective role testlood

1. Logi sisse `raudsoolaur+testadmin@gmail.com`.
2. Lülita CLIENT preview.
3. Kontrolli, et `/teekond` näitab CLIENT loogikat.
4. Lülita SOCIAL_WORKER preview.
5. Kontrolli, et privaatseid Journey objekte ei kuvata.
6. Lülita SERVICE_PROVIDER preview.
7. Kontrolli, et privaatseid Journey objekte ei kuvata.
8. Ava teadaoleva CLIENT Journey detail mõnes mitte-CLIENT preview rollis ja veendu, et sisu ei leki.

## 11. Riskid

| Risk | Tase | Mõju | Soovitus |
|---|---|---|---|
| Lokaalne dev DB drift `20260105120000_add_rooms_invites` ja vanade timestamp/index erinevuste tõttu | Kõrge production jaoks | `migrate dev` nõuab reset'i; production deploy otsus võib olla ebaselge, kui stagingut ei kasutata | Enne production deploy'd teha staging/prod-laadne migratsiooniproov ja backup plaan |
| Täismahus RAG vastust ja allikate kuvamist ei automatiseeritud | Keskmine | Võimalik allikate kuvamise regressioon jääks ainult route-smoke'iga märkamata | Kasutajatesti eel teha käsitsi RAG vastuse smoke ühe tuntud küsimusega |
| Room loomise kõik variandid ei olnud automaatses QA-s läbi klikitud | Keskmine | Origin/meta regressioon võib ilmneda konkreetse loomisharu kaudu | Testida käsitsi käsitsi kutse, eelpöördumise room ja help-match room |
| `/kutsed` route andis smoke'is 404 | Madal/keskmine | Võib olla vale route või kutsete vaade pole otse avatav | Täpsustada tegelik kutsete route enne room kasutajatesti |
| i18n fallback'id sisaldavad mõnes kohas inglise teksti | Madal | Tõlkesüsteemi rikke korral võib kasutaja näha ingliskeelset fallback'i | Ühtlustada fallback'id eesti keelde enne laiemat pilooti |
| ServiceMap accessPath/tervisekontakti andmekvaliteet sõltub sisendandmetest | Madal | Puuduliku metadata puhul kuvatakse fallback | Andmekvaliteedi rikastus teha eraldi kontrollitud sisutööna |

## 12. Paranduste nimekiri

### Kriitiline enne deploy'd

1. Teha staging/prod-laadne migratsiooniproov päris deploy protsessiga.
2. Kinnitada, et vana `20260105120000_add_rooms_invites` drift ei puuduta production migratsioonide ajalugu.
3. Mitte teha `prisma migrate reset` pärisandmetega DB-s.
4. Koostada production backup/rollback plaan enne deploy otsust.

### Vajalik enne kasutajatesti

1. Teha käsitsi RAG vastuse/allikate smoke.
2. Teha käsitsi Room loomise smoke vähemalt ühe toimiva room loomise teega.
3. Testida eelpöördumise saatmist ja vastuvõttu päris rollivoos.
4. Testida teenuseosutaja pöördumise vastuvõttu päris service provider profiiliga.
5. Täpsustada kutsete tegelik kasutajaroute, sest `/kutsed` andis automaatses smoke'is 404.

### Hilisem tehniline võlg

1. Lisada püsivad API owner-access testid Journey route'idele.
2. Lisada Journey handoff helperite unit-testid.
3. Lisada Room origin/meta ligipääsu regressioonitestid.
4. Lisada ServiceMap accessPath normaliseerija unit-testid.
5. Ühtlustada i18n fallback tekstid eesti keelde.

## 13. Lõplik otsus

**READY_FOR_LIMITED_USER_TEST**

Põhjendus:

- Teekonna MVP põhilised migratsioonid rakenduvad puhtal DB-l;
- lokaalne dev `migrate status` on korras;
- API owner-access ja privaatsuspiirid läbisid smoke'i;
- CLIENT, SOCIAL_WORKER, SERVICE_PROVIDER ja admin preview rollivaated töötasid;
- privaatset Journey objekti ega private chat'i ei lekitatud kontrollitud smoke'ides;
- production deploy jaoks jääb vana dev drift'i tõttu kohustuslikuks staging/prod-laadne migratsiooniproov.

Production deploy:

- praegu ei ole veel soovitatav;
- lubatav alles pärast staging/prod-laadse DB migratsiooniproovi ja backup/rollback plaani kinnitamist.

Kasutajatest:

- piiratud kasutajatest võib alata pärast käsitsi RAG, Room ja eelpöördumise saatmise smoke'i.

## Lõpukontroll

- Uusi funktsioone ei lisatud.
- Production deploy'd ei tehtud.
- DB reset'i ei tehtud.
- Chat/RAG tuuma ei refaktoreeritud.
- `PreInquiryStatus` jäi puutumata.
- Room access jäi puutumata.
- Journey owner-põhine privaatsusmudel jäi puutumata.
- Raport annab otsustustoe stagingu, kasutajatesti ja production deploy riski kohta.
