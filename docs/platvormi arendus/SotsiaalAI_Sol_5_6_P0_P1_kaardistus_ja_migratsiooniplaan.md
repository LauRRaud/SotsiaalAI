# SotsiaalAI Sol 5.6: P0/P1 kaardistus ja migratsiooniplaan

Kuupäev: 11. juuli 2026  
Ulatus: ainult P0 (skeem) ja P1 (usage service). Kasutajaliides, route'ide ühendamine ja deploy ei kuulu sellesse etappi.

## 1. Olemasoleva süsteemi kaardistus

### Paketid ja tellimused

- `Subscription.plan` on ajutine tekstiline ühilduvusväli; uus vaikimisi väärtus on avaliku hinnastusega kooskõlas `free`.
- Rakenduse genereeritud rollipõhised võtmed on `client_monthly`, `social_worker_monthly` ja `service_provider_monthly`.
- Mõnes vanemas või käsitsi loodud voos võivad esineda üldvõtmed `monthly` ja `kuutellimus`.
- Paketi hind ja rolli vastendus asuvad `lib/subscriptionPlans.js` failis ning neid saab keskkonnamuutujatega muuta.
- Tellimuse loomine ja maksevoog kirjutavad jätkuvalt tekstilist `plan` väärtust. P0 ei muuda neid route'e.

### Praegune kasutuse ja kulu arvestus

- P0-eelne `lib/usageBudget.js` grupeeris kvoodikontrolliks jooksva kuu `ChatLog` sündmusi; P2 järel säilib selles failis ainult admini ligikaudse kulu raportiloogika.
- `ChatLog` sündmus `openai_usage` sisaldab juba tegelikke input-, cached-input-, output- ja reasoning-tokenite välju.
- P0-eelne `AnalyzeUsage` hoidis kasutaja päevast failianalüüsi loendurit; P2 järel on ajalooline tabel ümber nimetatud `AnalyzeUsageLegacy`-ks ja aktiivne arvestus kasutab ainult usage ledger'it.
- Failianalüüsi praegused vaikimisi päevased piirid on CLIENT 10, SOCIAL_WORKER/SERVICE_PROVIDER 20 ja ADMIN 100. Uue plaani nädalased piirid 4/10/20 on uus ärireegel, mitte olemasoleva tabeli otsene ümbernimetamine.
- Chat, STT, TTS ja meeting-summary kontrollivad praegu hinnangulist kuueelarvet eraldi. Dokumentide generate/refine vood logivad OpenAI tegeliku kasutuse, kuid ei kasuta veel ühist kvooditeenust.

### Route'id ja admin

- Vestlus: `POST /api/chat`.
- Dokumendimustand: `POST /api/documents/artifacts` ja `POST /api/documents/artifacts/generate`.
- Dokumendi AI-täiendus: `POST /api/documents/artifacts/refine`.
- Failianalüüs: `POST /api/chat/analyze-file`.
- Süvauuring: `POST /api/research/jobs`.
- Kõne: `POST /api/stt` ja `POST /api/tts`.
- Olemasolevad admini koondid: `app/api/admin/analytics/users/route.js`, `ai-costs/route.js` ja `components/admin/AnalyticsDashboard.jsx`.

## 2. P0 andmemudel

Lisatud olemid:

- `PlanDefinition`: versioonitud pakett, roll, hind ja kehtivus.
- `PlanEntitlement`: paketi mõõdiku feature flag, periood ning soft/hard limiit.
- `UserEntitlementOverride`: ajutine või püsiv kasutajapõhine erand koos põhjuse ja adminiga.
- `UsageBucket`: perioodi atomaarne `used`/`reserved` koond koos limiidisnapshotiga.
- `UsageReservation`: kuluka töö reserveeritud, committed või released olek.
- `UsageEvent`: muutmatu reserve/commit/release/adjustment sündmus unikaalse idempotency võtmega.
- `ModelPrice`: mudelihinna ajaliselt versioonitud sisend-, cache-, väljund- ja reasoning-hinnad.

`Subscription.planDefinitionId` on paketi tõeallikas. Andmebaas keelab `ACTIVE`, `PAST_DUE` ja `CANCELED` tellimuse ilma normaliseeritud paketita. `Subscription.plan` säilib ainult ajutise deprecated lugemisväljana kuni P2 lõpuni; migratsioon kirjutab selle väärtuse kohe kanooniliseks paketivõtmeks ning uued aktiveerimisvood kirjutavad alati ka `planDefinitionId`.

Andmebaasi CHECK piirang tagab, et `UsageBucket.used >= 0`, `reserved >= 0` ning `used + reserved <= hardLimit`.

## 3. Paketiseemned

| Pakett | Võti | Hind | Chat soft/hard kuus | Dokumendid nädalas | Failianalüüsid nädalas | Hoiuruum |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Tasuta | `free` | 0 EUR | – | – | – | – |
| Pöörduja | `client_monthly` | 7,99 EUR | 120/150 | 2 | 4 | 50 MB |
| Spetsialist | `social_worker_monthly` | 14,99 EUR | 300/360 | 4 | 10 | 100 MB |
| Teenuseosutaja | `service_provider_monthly` | 19,99 EUR | 600/750 | 8 | 20 | 150 MB |

Dokumendi-, analüüsi- ja hoiuruumirea üksik number on hard limit; neile ei tuletata P0-s eraldi soft limit'it. UI 70% ja 90% hoiatused kuuluvad P3 etappi.

## 4. Olemasolevate tellimuste backfill

1. `NONE` olekus registreerimised seotakse avaliku `free` paketiga; tasuta pakett ei sisalda AI-kasutusõigusi.
2. Tuntud tasulise `Subscription.plan` võti kaardistatakse otse sama võtmega `PlanDefinition` reale.
3. `monthly`, `kuutellimus` ja tundmatu aktiivne pärandväärtus kaardistatakse kasutaja rolli järgi.
4. ADMIN saab sisemise `admin_internal` paketi; seda ei kuvata avalikul hinnastuse lehel.
5. Kõik aktiivsed pärandvõtmed, sealhulgas `e2e`, normaliseeritakse kasutaja rolli järgi ning tekstiline väärtus kirjutatakse kanooniliseks paketivõtmeks.
6. Tekstiline `plan` eemaldatakse P2 lõpus pärast viimaste lugemiskohtade ümberühendamist; see ei ole pikaajaline ühilduvuskiht.

## 5. P1 reserve/commit/release teenus

- Entitlement lahendatakse aktiivse tellimuse normaliseeritud paketist; vana tekstivälja puhul kasutatakse ajutist rollipõhist fallback'i.
- Kehtiv `UserEntitlementOverride` asendab ainult väljad, mis erandis määrati.
- Perioodid arvutatakse `Europe/Tallinn` ajavööndis. Nädal algab esmaspäeval 00.00 ning DST nädala tegelik kestus võib olla 167 või 169 tundi.
- Reserveerimine kasutab ühte tingimuslikku PostgreSQL `UPDATE ... WHERE used + reserved + amount <= hardLimit` käsku.
- Sama kasutaja sama `idempotencyKey` korduskutse tagastab olemasoleva reserveeringu. Sama võti teise mõõdiku või kogusega tekitab konflikti.
- Commit liigutab reserveeritud mahu `used` väljale. Tehnilise vea release vähendab `reserved` välja ja taastab jäägi.
- Iga olekumuutus loob eraldi muutmatu `UsageEvent` kirje.
- Andmebaas keelab `UsageEvent` UPDATE'i; parandused lisatakse `ADJUSTMENT` sündmusena. DELETE jääb lubatuks ainult orkestreeritud privaatsus- ja konto kustutamise voo jaoks.

## 6. P2 eeltingimused ja lahtised otsused

Enne route'ide ühendamist tuleb kinnitada:

- kas `DOCUMENT_REFINE` jagab `DOCUMENT_GENERATE` nädalalimiiti või saab eraldi limiidi;
- süvauuringu, STT, TTS ja RAG-i konkreetsed paketilimiidid;
- admini sisemise kasutuse pakett või vabastusreegel;
- paketivahetuse korral, kas jooksva bucket'i limiidisnapshot säilib perioodi lõpuni või luuakse auditeeritud adjustment;
- pikalt töötava research-job'i reservation lease ja aegunud reserveeringute worker;
- tegelike tokenite kulu sidumine `ModelPrice` versiooniga.

## 7. Rollback-plaan

1. P2 usage-route'id on ühendatud. `AnalyzeUsageLegacy` säilib ajutise ajalooarhiivina, kuid seda ei loe enam ükski aktiivne kvoodi- ega adminivoog; `usageBudget` ei blokeeri enam kasutajate päringuid.
2. Vajadusel eemaldatakse esmalt `Subscription.planDefinitionId` välisvõti ja veerg.
3. Seejärel eemaldatakse uued usage tabelid sõltuvuste vastupidises järjekorras ning neli uut enum-tüüpi.
4. Vanu tabeleid ega välju migratsioon ei kustuta ega nimeta ümber; andmekadu olemasolevates voogudes ei teki.
