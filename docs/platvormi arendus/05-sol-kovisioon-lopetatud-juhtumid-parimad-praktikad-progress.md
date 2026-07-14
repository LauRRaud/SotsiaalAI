# Sol 5.6 Ultra — Kovisioon, lõpetatud juhtumid ja parimad praktikad

**Mudel / effort:** Sol 5.6, Ultra
**Baas:** `main` @ `848de7a6` (`A6.1: Persist private topic seed workflow`)
**Staatus:** lõplikult kontrollitud; tööpakett kuulub käesolevasse integreeritud GitHubi commit'i
**Deploy:** ei kuulu sellesse tööpaketti
**Järelkontroll:** pärast Soli lõppkontrolli võib Opus vaadata kõik kolm tööd ühe paketina üle

## 1. Tööpaketi järjestus

1. terviklik Kovisiooni voog (etapid 1–8 + päris sessiooniandmed);
2. Lõpetatud juhtumite põhileht ja järelvaate töövoog;
3. Parimate praktikate põhileht, kandidaadid ja kontrollitud avaldamine;
4. kogu paketi regressiooni-, privaatsus-, ligipääsetavus- ja visuaalne kontroll.

Kolm omavahel seotud põhiosa liiguvad ühe integreeritud commit'i ja push'ina. Deploy toimub ainult eraldi otsusega.

## 2. Auditi lukustatud järeldused

### 2.1. Üks andmeelu

Praegune `CovisionSession.jsx` on lokaalne kuue inimese demosimulatsioon. Seda ei pikendata tootmises etappidega 5–8. Tootmisvoog kasutab olemasolevat `CovisionCase` objekti ning sellele lisatud versioonitud sessiooniolekut, stabiilseid osalejaolekuid, jagatud tööobjekte, etapifotosid ja kasutajapõhist privaatset olekut.

### 2.2. Teemaseeme → Kovisioon

- ainult omanik saab `WAITING` olekus ja külmutatud `sharedCardSnapshot`-iga seemnest Kovisiooni luua;
- toiming on atomaarne, versioonikindel ja idempotentne;
- privaatset ettevalmistust Kovisiooni ei kopeerita;
- üks Teemaseeme seotakse kõige rohkem ühe Kovisiooni juhtumiga.

### 2.3. Kovisiooni etapid

- kõik 1–8 etappi kasutavad sama serverisnapshot'i;
- etapp liigub edasi ainult serveris kontrollitud värava kaudu;
- vaiksed mustandid, Mari resonants ja isiklik õppimine on eraldi privaatses olekus;
- jagatud tööobjektidel on serveri määratud autor ja nähtavus;
- taimerid põhinevad serveriajal;
- konkurentsi korral annab aegunud versioon üldise `409`, mitte ei kirjuta uuemat tööd üle;
- teenuseosutaja osaleb ainult kutsega, mitte ei loo Kovisiooni omanikuna.

### 2.4. Lõpetatud juhtumid

Leht ei loe aktiivse juhtumi toorvälju. Etapp 8 loob inimese kinnitatud minimaalse ja isikustamata `CovisionClosure` hetktõmmise. Järelvaade, Kovisioonipakk, säilitamine ja praktikakandidaat on eraldi olekuteljed.

### 2.5. Parimad praktikad

- avalik praktika, autori kandidaat ja retsensendi vaade saavad eraldi serializerid;
- avalik vastus ei väljasta lähtejuhtumi ID-d, autori e-posti ega RAG-metaandmeid;
- AI ettepanek on alati privaatne `DRAFT`;
- autor ei kinnita ise anonüümsuskontrolli, retsensiooni ega avaldamist;
- avaldamine kasutab lukustatud versiooni ja ainult päris aktiivset pädevust;
- RAG-i liigub ainult avaldatud, isikustamata snapshot.

## 3. Visuaalne suund

Kasutatakse seniste Kovisiooni etappide ruumilist lõuendikeelt: üks soe tume ruum, klaasjad tööpinnad, üks aktiivne hero-objekt, vaoshoitud merevaigukollane aktsent ning selge privaatse/jagatud ruumi eristus. Piltide 5–8 kompositsioon on referents, mitte põhjus luua väljamõeldud andmeid.

Kovisioonis on üks väljumistoiming: paremas ülanurgas `← Välju`. Vasakpoolset dubleerivat nuppu ei kuvata.

## 4. Progress

| Osa | Skoop | Staatus | Commit |
|---|---|---|---|
| Kovisioon | Audit, päris sessioon, etapid 1–8, Teemaseemne üleminek | Valmis | Käesolev commit |
| Lõpetatud juhtumid | Closure, järelvaade, pakett, säilitus, põhileht | Valmis | Käesolev commit |
| Parimad praktikad | Kandidaat, kontroll, avalik kogu, detail | Valmis | Käesolev commit |
| Koondkontroll | Testid, i18n, lint, build, migratsioonid, brauser | Valmis | Käesolev commit |

## 5. Soli kontrollnimekiri

- [x] kõik tootmisvaated kasutavad päris API andmeid;
- [x] demo rollivahetaja ja taimeriga simulatsioon ei ole tootmisteel;
- [x] privaatne olek ei leki teisele osalejale ega moderaatorile;
- [x] kõik etapivahetused on versioonikindlad ja serveris kontrollitud;
- [x] etapp 8 → lõpetatud juhtum on atomaarne ja idempotentne;
- [x] praktikakandidaat jääb privaatseks kuni eraldi kontrollitud avaldamiseni;
- [x] ET/EN/RU võtmed on pariteedis;
- [x] sihttestid ja kogu `npm test` on rohelised;
- [x] Prisma validate/generate ja migratsiooniahel on rohelised;
- [x] lint ei lisa uusi hoiatusi;
- [x] build ja `git diff --check` on puhtad;
- [x] autentitud brauserikontroll katab vähemalt omaniku põhivoo;
- [x] kasutaja pooleliolevad ruumipiltide failid ei satu ühegi commit'i sisse.

## 6. Opuse hilisem ühine ülevaatus

Opus peab vaatama kolme osa koos, sest privaatsus- ja andmevoog on lineaarne:

```text
Teemaseeme
  → Kovisiooni etapid 1–8
  → kinnitatud minimaalne lõpetamise snapshot
  → järelvaade / jätkuotsus
  → privaatne praktikakandidaat
  → pädevuspõhine kontroll
  → avalik isikustamata praktika
```

Ülevaatus ei asenda Soli enda lõppkontrolli ega blokeeri commit'e/push'e.

## 7. Kovisiooni serverituuma audit ja üleandmine

**Staatus:** serverituum valmis; UI ja kogu kolme lehe koondkontroll jätkub põhiagendis.

Valmis ja kontrollitud:

- Teemaseeme → Kovisioon on omanikupõhine, atomaarne, versioonikindel, idempotentne ja 1:1 seosega;
- üks püsiv sessioonimootor juhib etappe 1–8, jagatud tööobjekte, kasutajapõhist privaatolekut ja serveris tuletatud etapiväravaid;
- `SET_PHASE` kasutab eraldi normaalset progressiteed ega sunni valikulisi pause läbima;
- omanik ja kinnitatud kaasjuht saavad versioneeritud sessioonikäsuga osalejaid kutsuda; e-posti kutse seob konkreetse juhtumi URL-i ning saadetakse pärast transaktsiooni;
- e-posti teel kutsutu GET on kõrvalmõjuta ja minimaalne; kasutajakonto seotakse alles sõnaselge nõustumise all;
- kutsutu ei näe enne nõustumist juhtumi sisu, teisi osalejaid, sessiooni etappi ega faasi; tavapayload'id ei väljasta e-posti, TopicSeedi ID-d ega kasutaja sisemisi ID-sid;
- teenuseosutaja saab osaleda ainult kutsega; uue Kovisiooni omanikuks saab sotsiaaltöötaja või administraator;
- legacy detail-API ei väljasta e-posti, generic PATCH ei puuduta sessiooniga juhtumit ega saa luua `CLOSED`/`ARCHIVED` olekut;
- nii Teemaseemnest kui generic POST-ist loodud juhtum saab kohe versioon-0 ooteruumi sessiooni ja osalejaolekud;
- etapi 8 `COMPLETE_STAGE` loob sama advisory-lock'i ja transaktsiooni sees minimaalse closure'i, järelvaate ja omanikupaki, viib juhtumi `CLOSED` ning Teemaseemne `FOLLOW_UP` olekusse ja puhastab detailsed tööandmed;
- suletud sessioon on absoluutne read-only ka siis, kui säilituse tõttu etapifotod eemaldatakse.

Kontrollitulemused:

- serveri privaatsus-, sessiooni- ja route-sihttestid **30/30**;
- sessiooni + lõpetatud juhtumite integratsioonitestid **28/28**;
- kogu Kovisiooni komplekt **90/93**; kolm järelejäänud viga olid vananenud UI source-contract ootused (uus progressifaaside eksport, eemaldatud hard-coded ET tekst, uus stage-8 closure-semantika), mitte serveriregressioonid;
- muudetud serverifailide ESLint **0 viga, 0 hoiatust**;
- Prisma validate ja generate **OK**;
- `db:migrate:check` **OK**: kõik **82 migratsiooni** rakendusid puhtale Postgresi andmebaasile, drift puudub;
- runtime import-smoke: `covisionSession` ja serveritingimustes `covision` laadivad puhtalt;
- `git diff --check` puhas.

## 8. Kovisiooni live-UI audit ja üleandmine

**Staatus:** tootmis-UI valmis põhiagendi integratsioonikontrolliks; commitimata.

- `CovisionLiveSession` kuvab ühe serverisnapshot'i põhjal kõik etapid 1–8, kanoonilise normaalfaaside tee, rollipõhised käsud, ühe aktiivse hero-objekti ning eraldi privaatse ja jagatud tööruumi;
- kutsutu näeb enne konfidentsiaalsuskokkuleppe kinnitamist ainult minimaalset rolli/nõustumise/valmisoleku vaadet; juhtumi pealkiri, sisu ja osalejad on peidetud;
- sessiooni juht saab pärast sessiooni käivitamist kutsuda e-posti ja lubatud rolliga uue osaleja; ootel kutsed ei muuda etapi 1 serveriväravat rangemaks kui server ise;
- varasem kinnitatud ühine ankur, fookus ja uuriv küsimus püsivad järgmistes etappides read-only kontekstina; etapis 8 kuvatakse ainult etapifotos kinnitatud omaniku suund, samm ja järelvaade;
- etapi 8 `COMPLETE_STAGE` on UI-s ausalt juhtumi sulgemise värav; suletud vaade on read-only ja suunab Lõpetatud juhtumite lehele ka siis, kui detailsed etapifotod on säilituse käigus eemaldatud;
- kogu kasutajatekst, tööobjektide liigid, rollid, faasid, olekud, väravapõhjused, placeholder'id ja aria-sildid kasutavad `covision.live.*` ET/EN/RU sõnastikku; Kovisiooni `Välju` nupp on samuti lokaliseeritud;
- Workspace arvestab serveri `capabilities.canCreate` õigust ja brauseri Back/Forward ajalugu (`popstate`).

Kontrollid:

- LiveSession + Workspace + sessioonimasina sihttestid **33/33**;
- LiveSession, PanelFrame, Workspace ja nende source-contract testide ESLint **0 viga, 0 hoiatust**;
- Kovisiooni live-sõnastiku ET/EN/RU pariteet kontrolliti roheliseks; kogu-repo i18n kontroll ootab paralleelse Lõpetatud juhtumite sõnastiku EN/RU valmimist;
- selle UI-skoobi `git diff --check` puhas.

## 9. Lõpetatud juhtumite üleandmine

**Staatus:** täisvertikaal valmis; commitimata ja põhiagendi koondkontrollis.

- etapi 8 lõpuvärav loob samas advisory-lock'i transaktsioonis ühe versioonitud `CovisionClosure` hetktõmmise, ajastatud järelvaate ja omaniku privaatse Kovisioonipaki;
- closure whitelistib ainult kinnitatud üldistatud pealkirja, tööfookuse, suuna, järgmise sammu, ajaraami, edenemise märgi ja järelvaate — sõnumeid, transkripti, privaatmustandeid ega osalejate tõendeid ei kopeerita;
- pärast closure'i loomist kustutatakse samas transaktsioonis kõik privaatsed sessiooniolekud ja detailsed tööobjektid; etapi 8 auditkirje payload sanitiseeritakse ning varasemad detail-snapshotid eemaldatakse;
- elutsükkel, tähelepanu, järelvaade, praktikakandidaat, Kovisioonipakk ja säilitamine on eraldi teljed; tähelepanu tuletatakse tähtajast ega ole tulemuslikkuse hinne;
- owner, kinnitatud osaleja ja määratud järelvaate tegija saavad ainult oma õigusele vastava vaate; kõrvalisele tagastatakse üldine 404;
- osaleja vastus ei sisalda `covisionCaseId`, TopicSeedi ID-d, kasutaja ID-sid ega Kovisioonipaki sisu; omanik saab paki sisu ainult detailvaates;
- järelvaate kinnitamine või ümberajastamine, jätkuotsus, minimaalne uus Teemaseeme ning arhiiv on versioneeritud ja serveris rollipõhised;
- `/lopetatud-juhtumid` kasutab ainult päris API andmeid ning sisaldab otsingut, nähtavusskoope, olekufiltreid, kaardi- ja nimekirjavaadet, tähelepanuala, ligipääsetavat järelvaate loendit, detaili, järelvaadet, jätkuotsust ja säilitamise vaadet;
- põhilehel pole aktiivse Kovisiooni etappide rada, taimerit, sessioonirolli, Pausi ega „Vajan tuge” toimingut; profiil näitab püsivat ametirühma ning abi on nimetatud `Abi`;
- ET/EN/RU sõnastikud on pariteedis ja visuaal järgib sooja tumeda ruumi, klaaspindade ning merevaiguse aktsendi keelt ilma demoandmeteta.

Kontrollid:

- Lõpetatud juhtumite service/schema/route/client sihttestid **22/22**;
- Kovisiooni sessiooni + closure'i sihttestid koos **34/34**;
- Lõpetatud juhtumite service/page/route ESLint **0 viga, 0 hoiatust**;
- `i18n:check` **OK**;
- Prisma validate/generate **OK**;
- `db:migrate:check` **OK**, puhas ahel **82 migratsiooni**, drift puudub;
- `git diff --check` puhas.

## 10. Kovisiooni ja lõpetatud juhtumite stabiliseerimisring

**Staatus:** Soli järelkontrolli P1/P2 leiud lahendatud; commitimata, deploy tegemata.

Olulisemad järelparandused:

- Kovisiooni osaleja identiteet ei lange seotud kasutajakonto puhul enam e-posti varuotsingule; taaskasutatud e-post ei anna uuele kontole ligipääsu sessioonile, kõnele ega tööruumile.
- Kõik aktiivsust loovad kõnetoimingud ning kõne lõpetamine, lahkumine ja kõnesoovi tühistamine kontrollivad terminalset olekut sama `covisionSession:<id>` luku ja värske andmebaasirea all. Terminalsed puhastustoimingud on idempotentsed ning ei kirjuta kõneandmeid.
- Legacy sõnum, kokkuvõte ja generic PATCH kasutavad sama sessioonilukku. `CLOSED`, `ARCHIVED`, closure'iga või `phase=complete` juhtumit ei saa aegunud eelkontrolli järel uuesti muuta; terminalne no-session legacy-rida on samuti read-only.
- Etapi 2 privaatsusvärava kinnitab aktsepteeritud `SUMMARY_REVIEWER`, kui selline eraldi roll on olemas; muidu jääb turvaline omaniku fallback. Tavalise osaleja privaatlipp ei ava väravat ja privaatne kontrollsisu ei lähe hetkepilti.
- Kui eraldi kokkuvõtte hoidja on olemas, märgib omaniku UI privaatsuskontrolli serveris kontrollitavaks ega nõua teise kasutaja privaatoleku näitamist. Omanik saab värava serverile kontrollimiseks saata; server otsustab värske retsensendikinnituse põhjal.
- Etapi 7 omaniku kinnitus on versioonitundlik: suuna, järgmise sammu, edenemise märgi või järelvaate hilisem muutmine muudab varasema kinnituse aegunuks. UI kustutab kinnitatud visuaalse oleku kohe sisumuudatuse ajal ning server välistab vana kinnituse ka pärast salvestamist. Jagatud hetkepilt sisaldab ainult suunda, sammu, ajaraami, edenemise märki ja järelvaadet, mitte omaniku kaalutlusi ega sortimismärkmeid.
- Etapi 8 lõpetamine kustutab sama transaktsiooni sees varasemad etapihetkepildid, privaatsed olekud, tööobjektid, legacy sõnumid/kokkuvõtte, juhtumi toorväljad, sessiooniseaded ja aktiivse Kovisiooni kõne; säilib üks sanitiseeritud etapi 8 auditkirje ning minimaalne closure.
- Praktikakandidaadi otsus loob päris privaatse `EffectivePractice` DRAFT-i ning kordus ei loo duplikaati. Praktika olek ja link jäävad ainult omanikule.
- Järelvaate tegija õigus kestab ainult aktiivse `FOLLOW_UP_PENDING` + `SCHEDULED` määrangu ajal. Ümbermääramine, lõpetamine, sulgemine, jätkuotsus ja arhiveerimine lõpetavad vana määranguõiguse; endine vastutaja ei näe järelvaate refleksiooni.
- Closure'i ajalooline lõpetaja on nullable `SetNull` seos: kaasjuhi konto kustutamine ei blokeeri omaniku lõpetatud juhtumi säilitamist, kuid olemasoleva kasutaja korral jääb auditiseos alles.
- Lõpetatud juhtumi detaili URL on Back/Forward ajalooga sünkroonis, hilinenud detailivastus ei kirjuta uuemat valikut üle, dialoog piirab Tab-fookuse enda sisse ja sulgemine tagastab fookuse avajale. Otsingul, abil ja dialoogil on selged ligipääsetavuse atribuudid.

Stabiliseerimisringi kontrollid:

- sessiooni, closure'i, route'ide, call-lifecycle'i, legacy-write'i, skeemi, UI väravate ja privaatsuse koond-sihttestid **114/114**;
- stabiliseerimisringi muudetud failide ESLint **0 viga, 0 hoiatust**;
- `i18n:check` **OK**, Prisma validate **OK**, `db:migrate:check` **OK** (**85 migratsiooni**), `git diff --check` puhas;
- kogu `npm test` kontrollis oli selle sissekande ajal **978/979**; ainus järelejäänud viga oli paralleelse Parimate praktikate töö RAG document-ID lepingus ning anti vastava osa tegijale parandada.

## 11. Parimate praktikate täisvertikaali üleandmine

**Staatus:** täisvertikaal valmis, turva- ja privaatsusjärelkontrolli P1 leiud lahendatud; commitimata, push ja deploy tegemata.

Valmis kasutajavoog:

- `/parimad-praktikad` kuvab ainult muutmatust avaldatud snapshot'ist pärinevaid praktikaid; detailis on kontekst, sihtrühmad, keskkonnad, tingimused, sammud, tulemus, õppimine, allikad, teemad, piirangud ja professionaalse ülevaatuse alus;
- sotsiaaltöötaja ja teenuseosutaja saavad luua privaatse kandidaadi, esitada selle ülevaatuseks ning parandada tagasiside järel; tehniline administraator ei saa sisulooja õigust pelgalt administraatorirollist;
- eraldi ja tähtajalised `REVIEWER`, `EDITOR`, `ETHICS` ja `APPROVER` pädevused, serveri määratud ülesanded, huvide konflikti kontroll ning kõrge riski puhul kaks erinevat valdkondlikku retsensenti moodustavad avaldamisahela;
- autor, lähte-Kovisiooni osaleja (seotud kasutaja-ID või turvaliselt seotud e-post) ja praktika autoriks olev rakendamiskogemuse hindaja ei saa oma tööd kinnitada; sama keeld kehtib lõplikule kinnitajale;
- avaldatud versioon on muutmatu. Tavakasutaja saab ainult uusima versiooni; autor ja sobiva skoobiga pädevushaldur näevad sanitiseeritud avaldatud versioonide ajalugu, mitte privaatset kandidaatteksti ega retsensendi märkmeid;
- rakendamiskogemus külmutab lisamise hetkel kasutatud avaliku praktikaversiooni ega hakka hilisema privaatse kandidaadimuudatuse välju näitama;
- ülevaatustähtaja ületamine on avalikus kaardis nähtav ning ETHICS-pädevusega kasutaja saab käivitada uue kontrolli; mitteavaldatud kandidaadi omanik saab selle arhiveerida;
- Ruumi Kovisiooni komplekt avab päris lingid Kovisiooni, Lõpetatud juhtumite ja Parimate praktikate lehele; Teemaseemnete varasem „ehitamisel” element on päris link.

Privaatsus ja RAG:

- avalik serializer ei väljasta autorit, lähtejuhtumi ID-sid, privaatseid välju, retsensendi märkmeid ega RAG-tehnilisi viiteid;
- avaldamine loob enne välist ingest'i deterministliku dokumendi-ID-ga püsiva guard-töö. RAG linkimine ja guard'i lõpetamine on üks andmebaasitehing; teadmata vastuse, aegunud CAS-i või andmebaasivea järel tehakse idempotentne kompensatsioon ja guard jääb taastatavaks;
- RAG-i `404` kustutus on idempotentne edu. Kustutustöö `done` ja `EffectivePractice.ragSourceId = null` salvestuvad samas tehingus, vältides crash-window't;
- legacy migratsioon paneb kustutusjärjekorda kõik salvestatud RAG-viited olenemata olekust ning lisaks võimaliku vana deterministliku `effective-practice::<id>` viite iga legacy rea kohta;
- konto kustutamisel kustutatakse avaldamata kandidaadid; varem avaldatud rida taastatakse ainult uusima avaliku snapshot'i whitelistist, privaatväljad ja review vabatekstid nullitakse ning autor eemaldatakse;
- konto kustutuse viimane praktikate sweep ja kasutaja kustutus toimuvad sama `User ... FOR UPDATE` luku all. Versiooni/oleku CAS väldib samaaegse re-review tagasipööramist avalikuks ning in-flight uus DRAFT ei saa jääda anonüümseks privaatseks orvuks.

Sihtkontrollid:

- Parimate praktikate service/schema/API/UI/privaatsus/RAG + Ruumi lingid + kontooperatsioonid **44/44**;
- `i18n:check` **OK** ja Prisma validate **OK**;
- `db:migrate:check` **OK**: puhtale Postgresi andmebaasile rakendus järjest **86 migratsiooni**, drift puudub;
- scoped ESLint **0 viga** (66 varasemat hoiatust puudutatud RoomStage/Teemaseemnete failides; Parimate praktikate failides 0 hoiatust) ja `git diff --check` puhas;
- lõplik build ja kogu `npm test` tehakse põhiagendi koondkontrollis.

### Kohustuslik deploy-järjekord

Deploy'd ei ole tehtud. Parimate praktikate avalik lugemine tuleb avada alles pärast järgmist järjestust:

1. käivita produktsioonis migratsioonid (`prisma migrate deploy`);
2. käivita kehtiva RAG-võtmega `npm run practices:rag:drain`;
3. käivita `npm run practices:rag:verify` ja nõua tulemust `remaining = 0` ning `staleReferences = 0`;
4. käivita `npm run practices:repair-assignments`;
5. alles seejärel käsitle Parimate praktikate avalikku kogu tootmises kasutusvalmina.

Perioodiline ülevaatustähtaja automaatika ja avaldamisel ebaõnnestunud RAG-ingest'i eraldi reconcile-worker on järgmine operatsiooniline järeltegevus. Praegu on tähtaja ületamine nähtav ning RAG-i ebaõnnestumine püsivalt auditeeritav, kuid neid ei käivitata taustal automaatselt.

## 12. Lõplik UI-, ajaloo- ja võistlusolukordade stabiliseerimine

**Staatus:** järelkontrolli P1/P2 UI leiud lahendatud; commitimata, push ja deploy tegemata.

- Kovisiooni sessiooni laadimine ja toimingud kasutavad tühistatavaid latest-request väravaid ning aktiivse juhtumi identiteeti. Juhtumi vahetus, sulgemine ja Back/Forward tühistavad vana päringu; enne toimingut alanud vaikne poll ei saa edukat toimingusnapshot'i enam vanema snapshot'iga üle kirjutada.
- Kovisiooni kaardivalik ja pikk elusessioon kerivad täisekraani lõuendi sees. Ruumiline taust säilib, kuid desktopi ja mobiili pikk sisu ei lõiku.
- Jagatud või privaatse kaardi koostaja puhastab mustandi ainult siis, kui serveritoiming päriselt õnnestus. Võrguviga, konflikt ja nullvastus jätavad teksti alles.
- Elusessioonil on üks põhitaseme pealkiri ning etapi 7 suuna, sammu, ajaraami, edenemismärgi ja järelvaate kõik sisendid on päriselt sildistatud.
- Lõpetatud juhtumite otsingu-, skoobi- ja sortimispäringud on tühistatavad; detaili ning mutatsiooni vastus seotakse avatud juhtumi ID-ga. A vastus ei saa pärast sulgemist või B avamist B detaili üle kirjutada. 409 värskendus kasutab sama ajalookirjet.
- Lõpetatud juhtumi laadimis- ja veavaade on päris `aria-modal` dialoog, sisaldab nimetatud sulgemisnuppu, korduskatset ja Tab-fookuse lõksu; `Abi` nupul on kirjeldav nimi.
- Parimate praktikate detail, uue kandidaadi loomine ja olemasoleva kandidaadi täiendamine on eraldi kanoonilised URL-olekud. Back/Forward taastab ainult ühe õige vaate; salvestamine kasutab tagasi- või replace-semantikat ega lisa duplikaatset detailikirjet.
- Kandidaadi salvestus, töövootoiming ja rakendamiskogemuse lisamine on seotud aktiivse detaili/editori ning tühistatava mutatsiooniväravaga. Suletud või vahetatud modaali vana vastus ei saa enam uut modaali avada ega selle sisu muuta.
- Mõlema lehe laadimismodaal on klaviatuuriga suletav ja fookus püsib dialoogis. Mobiili täisekraanimodaalid kasutavad `100dvh` ning safe-area servi.
- `/lopetatud-juhtumid` ja `/parimad-praktikad` avanevad laias tööpaneelis. Kovisioonil on üks `Välju` nupp paremas ülanurgas; täpsem `button.panel-exit` reegel võidab üldise klaasnupu paigutuse ning väldib täislaiaks venimist.

Kontrollid:

- Kovisiooni, Lõpetatud juhtumite ja Parimate praktikate lai sihtpakett **167/167**;
- kogu `npm test` **1025/1025**;
- uued request-gate'i ja URL-oleku runtime-testid ning source/CSS lepingutestid rohelised;
- scoped ESLint **0 viga, 0 hoiatust**;
- `i18n:check` **OK**;
- `npm run build` **Compiled successfully**;
- `git diff --check` puhas.

## 13. Soli lõplik koondüleandmine

**Otsus:** kolm osa on ühe integreeritud paketina commit'i ja GitHubi push'i jaoks heaks kiidetud. Deploy'd ei tehtud. Commit'i täpne hash on välises lõppüleandmises.

Lõplik kontrollipakett:

- kogu `npm test` **1026/1026**;
- `i18n:check` **OK**: ET on baas ning EN/RU pariteedis;
- Prisma generate ja validate **OK**;
- `db:migrate:check` **OK**: puhas **86 migratsiooni** ahel, drift puudub;
- kogu repo lint **0 viga** ja **359 varasemat hoiatust**; lõplike paranduste sihtlint 0/0;
- tootmisbuild **Compiled successfully**, kõik uued lehed ja API marsruudid registreeritud;
- tootmisserveri autentimata smoke: Kovisioon, Lõpetatud juhtumid, Parimad praktikad, Teemaseeme → Kovisioon ja sessioonitoiming vastavad kõik kontrollitud **401 JSON**-iga;
- runtime-smoke paljastas enne lõppu Parimate praktikate puuduva `401` avaliku veakaardistuse; see parandati ning lukustati regressioonitestiga;
- `git diff --check` puhas.

Autenditud brauserikontroll:

- päris `WAITING` Teemaseemnest loodi päris Kovisiooni juhtum ning tootmis-UI avas selle etapi 1 serverisnapshot'iga;
- Kovisiooni pikk tööala kerib paneeli sees, ainus `Välju` asub paremas ülanurgas ja vaade ei leki horisontaalselt;
- Lõpetatud juhtumite ning Parimate praktikate töölauavaated kontrolliti 1536 px laiuses;
- kõik kolm põhivaadet kontrolliti 390 × 844 mobiilivaates: sisu ei lõiku, leht ei valgu horisontaalselt ning praktikakogu navigeerimine on eraldi keritav ja põhisisu algab selle järel;
- kontrolliks loodud lokaalne QA kasutaja, Teemaseeme ja Kovisiooni juhtum eemaldati pärast kontrolli täielikult.

Sõltumatud järelkontrollid:

- integreeritud privaatsus- ja turvaaudit: **P0/P1 blokeerijaid ei ole**;
- UI, ajaloo, võistlusolukordade ja ligipääsetavuse kordusaudit: **blokeerijaid ei ole**;
- Opus võib kogu andmevoo ühe paketina uuesti üle vaadata §6 järgi.

Teadlikult järgmisse operatsioonietappi jäetud P2 tööd:

- automaatne RAG-ingest'i taastaja;
- ülevaatustähtaegade ja ülesannete perioodiline scheduler;
- rakendamiskogemuse ülevaatuse põhjenduse eraldi muutmatu ajalugu.

Enne võimalikku deploy'd tuleb endiselt läbida §11 kohustuslik migratsiooni-, RAG drain/verify 0/0- ja assignment-repair-värav. Kasutaja pooleliolevaid `public/room/frame-*.webp`, `output/imagegen/**` ega `scripts/build-room-locked-frames.mjs` faile ei lisata commit'i.
