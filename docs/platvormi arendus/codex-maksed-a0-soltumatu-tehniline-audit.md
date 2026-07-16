# MAKSED-A0-IA — maksete, tellimuste ja sponsoreeritud kasutuse sõltumatu tehniline audit

STATUS: COMPLETE

Kuupäev: 2026-07-16

Audiitor: Codex

Auditiharu: `codex/maksed-a0-independent-audit`

Auditeeritud `origin/main`: `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`

Auditiworktree HEAD enne raportit: `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`

Live-server: `main @ fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`, puhas tööpuu, `sotsiaalai-frontend.service=active`
Fable'i lähtefaili SHA-256: `6C52FCAB4C302699C34C9207EA5CCF3E0B55516ADA129992C4EC5808E1C6C2A9`

## 1. Lõppverdikt

**Fable'i analüüsi verdikt: `ANALYSIS_NEEDS_CHANGES`.**

Fable leidis õigesti L-01 paketi-eskaleerimise, L-05 reconciliation'i puudumise, callback'i tühja saladuse vea ning mitu sponsoreeritud kasutuse, PII ja UX-i puudust. Analüüs ei ole siiski kinnitatav, sest see:

1. kirjeldab 1/3/5 päeva renewal-retry'd töötava olekumasinana, kuigi esimene tõrge eemaldab tellimuse järgmise job'i valimist;
2. hindab paralleelse webhook'i võistluse P2-ks ja alahindab sama PAID-sõnumi paralleelset topeltgranti; kontrollitud route-tasandi reproduktsioon andis ühe makse eest kaks kuud;
3. jätab märkamata mitu makstud-kuid-grantimata sponsoreeritud kutse rada;
4. väidab 7-aastast makseridade säilitust ilma konto kustutamise `ON DELETE CASCADE` mõju arvestamata;
5. esitab renewal'i ja payment-alert'i operatiivse võimekuse liiga positiivselt: live-serveris on recurring välja lülitatud, provider'i vajalik konfiguratsioon puudub ning kummalgi job'il pole timerit ega cron'i;
6. nimetab `codex/role-aware-invite-copy` haru ainult koopia/i18n muudatuseks, kuigi see lisab sponsoreeritud target-role'i autoriseerimise;
7. pakub MAKSED-P1a ühe võimalusena ainult `planDefinitionId` serveripoolset sidumist, kuid jätab kliendi `plan` väärtuse salvestusse. See ei sulge kõiki UI/serveri seisundi harusid.

### Kolm eraldi hinnangut

| Küsimus | Hinnang |
|---|---|
| Kas Fable'i analüüs on korrektne? | **Ei, vajab sisulisi P1 parandusi.** |
| Kas praegune maksekood on tootmisvalmis? | **Ei.** Vältimatut P0 ei leitud, kuid on mitu P1 finants-, idempotentsus-, renewal- ja retention-riski. Live-maksevoog on lisaks konfiguratsiooniga välja lülitatud. |
| Kas MAKSED-P1a on piisav esimene parandus? | **Jah kui kitsas esimene commit, kuid ainult laiendatud kujul.** Server peab siduma nii `Subscription.plan` kui `planDefinitionId`; P1a ei tee kogu makseintegratsiooni valmis ega kata teisi uusi P1 leide. |

## 2. Tõeallikas ja Fable'i seisumaatriks

### 2.1 Git ja server

| Kontroll | Tulemus | Hinnang |
|---|---|---|
| Värske `git fetch origin main --prune` | `origin/main=fe4eb4fa...` | PASS |
| Auditiworktree | eraldi worktree ja haru otse `origin/main`-ist | PASS |
| Kasutaja põhitööpuu | määrdunud; audit seda ei muutnud | PASS |
| Live-serveri release | `fe4eb4fa...`, branch `main`, puhas, frontend active | PASS |
| Maksefailide diff `origin/main` vs live | sama SHA ja server puhas | PASS, diff tühi |
| Fable'i kasutatud `origin/main` | `2a63fcd0` | aegunud SHA |
| Makse tuum `2a63fcd0..fe4eb4fa` | `app/api/subscription`, sponsoreeritud rajad, `lib/payments`, plaanihelperid ja skeem sisuliselt muutmata | Fable'i staatiline koodibaas on endiselt asjakohane |
| Viimane sisuline maksecommit | `cb914ceefb5d618df42130f2450413541f7acb95` (2026-07-11) | kinnitatud |

Fable'i Git-/serverimaatriks vajab seega ajakohast SHA-d, kuid kirjeldatud maksekoodi versioon ei ole vahepeal muutunud.

### 2.2 Asjakohased harud

- `origin/codex/role-aware-invite-copy @ ead1d8d1` muudab lisaks koopiale `app/api/invites/sponsored/init/route.js` autoriseerimisloogikat: tuletab sponsoreeritavast rollist suhte tüübi ja kontrollib `canInviteRelationshipType(auth.role, relationshipType)`. Fable'i väide „ainult kutse-koopia/i18n, mitte makseloogika" on ebatäpne.
- Fable'is nimetatud `claude/clever-bassi-243deb` ei olnud pärast värsket kõigi origin-refide fetch'i enam remote-haruna kontrollitav.
- Main/serveri tõeallikas jääb `fe4eb4fa...`; merge'imata haru ei muuda käesoleva auditi koodijäreldusi.

### 2.3 Live-konfiguratsioon ja operatiivne seis

Read-only kontrollis väljastati ainult mittetundlikud hinnad/lipud ja saladuste olemasolu boole'id, mitte väärtusi.

| Live-kontroll | Tulemus |
|---|---|
| `SUBSCRIPTION_RECURRING_ENABLED` | `0` |
| `SUBSCRIPTION_ALLOW_DIRECT_ACTIVATION` | `0` |
| Retry-päevad / max | `1,3,5` / `3` |
| CLIENT / SOCIAL_WORKER kuuhind | `7.99` / `14.99` |
| SERVICE_PROVIDER / sponsored hind | koodi default `19.99` / `4.00` |
| Maksekeskuse API base/key/shop/public key | kõik `not configured` |
| Return/webhook URL | configured |
| Renewal job key | configured |
| Payment-alert sink / dispatch key | mõlemad `not configured` |
| Renewal/payment-alert timer, cron või unit | puudub |

Järelikult tagastab live `POST /api/subscription/init` recurring-lipu tõttu 503 (`app/api/subscription/init/route.js:192-198`) ning webhook tagastaks puuduva API-võtme/saladuse tõttu 503 (`app/api/subscription/webhook/route.js:590-602`). See on ohutu fail-closed seis, kuid mitte töötav makseintegratsioon. Fable'i väide, et kogu kirjeldatud käitumine „kehtib serveris praegu", tuleb piirata: kood on serveris, kuid live-konfiguratsioon ei võimalda voogu käivitada.

### 2.4 Dokumendi staatus

Fable'i faili alguses on `STATUS: IN PROGRESS` (rida 3), lõpus `STATUS: COMPLETE` (rida 438). Kanooniline auditeeritud sisu on käsitletud lõpu järgi lõpetatuna, kuid sisemine olekuvastuolu tuleb Fable'i dokumendis parandada.

## 3. Leiud

### A-01 — paralleelne sama PAID-webhook annab ühe makse eest kaks perioodi

- **Raskus:** P1
- **Tõend:** staatiline + kontrollitud lokaalne route-runtime ajutise PostgreSQL-iga
- **Failid/read:** `app/api/subscription/webhook/route.js:656-740`, eriti `686-713` ja `717-740`; kõrvalmõju `366-409` ning kutse/tellimuse haru `746-865`
- **Reproduktsioon:** loodi kaks identset `INITIATED` makset eri tellimustele. Sequential-kontrollis saadeti sama allkirjastatud PAID-keha kaks korda järjest; paralleelkontrollis hoiti testmakse rida välise `FOR UPDATE` lukuga kinni, lasti mõlemal webhook-transaktsioonil lugeda `INITIATED` ja vabastati lukk. Tulemused:

  ```text
  sub-sequential | ACTIVE | 31.01 granted_days
  sub-parallel   | ACTIVE | 62.01 granted_days
  ```

- **Põhjus:** mõlemad transaktsioonid teevad lukustamata `findUnique`, mõlemad otsustavad `sameStatus=false`, teine `update` ootab esimese järel, kuid ei kontrolli värsket staatust uuesti. Seejärel loeb teine aktiveerimine juba pikendatud `validUntil` väärtuse ja lisab veel ühe kuu. Mõlemad võivad saata ka e-kirjad.
- **Mõju:** ühe makse eest topeltõigus ja topeltteavitused; sama probleem võib paralleelse PAID sponsor-webhook'i korral roteerida tokenit ja tekitada kaks e-kirja, millest esimene token muutub kohe kehtetuks.
- **Kas Fable leidis:** osaliselt, L-03.
- **Kas Fable'i raskus oli õige:** ei; P2 → **P1**. Fable kirjeldas peamiselt eri staatuste „last writer wins" juhtumit ega tõendanud sama PAID duplikaadi topeltgranti.
- **Kas Fable'i pakett sulgeb:** MAKSED-P1a ei sulge; Fable paigutas paranduse P2-sse liiga hilja.
- **Järgmine tegevus:** makserida lukustada enne staatuseotsust (`SELECT ... FOR UPDATE`) või teha üks atomaarne compare-and-set üleminek; kõrvalmõjud ainult võitnud üleminekule. Lisada paralleelne sama PAID, PAID/FAILED, PAID/REFUNDED ja sponsor-PAID test.

### A-02 — kirjeldatud renewal-retry olekumasin ei ole kättesaadav

- **Raskus:** P1
- **Tõend:** staatiline
- **Failid/read:** `lib/payments/recurring.js:132-142`; `app/api/jobs/subscription-renewals/route.js:96-122,230-265`; `app/api/subscription/webhook/route.js:833-853`
- **Reproduktsioon/pseudotest:** loo due `ACTIVE` recurring-tellimus. Esimese sünkroonse charge-tõrke järel route kirjutab `Subscription.status=PAST_DUE` ja `BillingMethod.status=FAILED`. Järgmise job'i `where` nõuab samal ajal `Subscription.status=ACTIVE` ja `BillingMethod.status=ACTIVE`, seega rida ei valita. Webhook-põhine FAILED/CANCELED seab samuti `PAST_DUE`; lisaks ei arvuta see `nextBilling`-ule 1/3/5 päeva retry-aega.
- **Mõju:** 1/3/5 päeva retry'sid ei toimu; tellimus võib jääda püsivalt PAST_DUE ega jõua kolme katse järel CANCELED seisundisse. Uuendustulu ja kasutaja seisund lahknevad kirjeldatud mudelist.
- **Kas Fable leidis:** ei; Fable kinnitas retry-mustri toimivana ja kasutas seda olekumasinas ning „heade lahenduste" loendis.
- **Kas Fable'i raskus oli õige:** puudus; uus P1.
- **Kas Fable'i pakett sulgeb:** ei. L-05/MAKSED-P1b käsitles peamiselt stuck-INITIATED esmamakse reconciliation'it, mitte katkist renewal-valikut.
- **Järgmine tegevus:** defineerida retry jaoks ühtne valitav seisund, säilitada kasutatav makseviis kuni lõpliku tõrkeni või eristada charge'i ja mandaadi tõrge, arvutada `nextBilling` mõlemas tõrkerajas ning testida kogu 1/3/5 → cancel ahelat.

### A-03 — live recurring ja alarmsüsteem ei ole operatiivselt käivitatud

- **Raskus:** P1 maksete valmisolekule; payment-alert'i osa P2
- **Tõend:** read-only live-runtime
- **Failid/read:** `app/api/subscription/init/route.js:192-198`; `app/api/subscription/webhook/route.js:590-602`; `app/api/jobs/subscription-renewals/route.js:79-92`; `app/api/admin/analytics/payment-alerts/dispatch/route.js:295-296`; `scripts/subscription-renewals.mjs`; `scripts/payment-alert-dispatch.mjs`
- **Reproduktsioon:** live-env valitud mitte-salajaste väljade kontroll + `systemctl list-timers`, kasutaja crontab ja payment/renewal unit'ide loend. Recurring on 0; Maksekeskuse API võtmekomplekt puudub; renewal timer/cron puudub; alert sink/key ja timer/cron puuduvad.
- **Mõju:** live checkout ja webhook on fail-closed, renewal-job ei käivitu automaatselt ning kriitiliste alert'ide helperil pole sinki ega tarbijat. Koodis olevad route'id/skriptid ei võrdu töötava operatiivse süsteemiga.
- **Kas Fable leidis:** ei. Fable märkis prod-env kontrollimata, kuid järeldas siiski, et kirjeldatud käitumine kehtib serveris, ning esitas alert-dispatch'i töötava jälgijana.
- **Kas Fable'i raskus oli õige:** puudus; uus readiness-P1 ja observability-P2.
- **Kas Fable'i pakett sulgeb:** ei.
- **Järgmine tegevus:** enne maksete sisselülitamist teha eraldi kontrollitud rollout-pakett: sandbox/provider konfiguratsioon, schedule, dry-run, alarmi sink, võtmete fail-closed test, esimese renewal'i ja alarmi jälgitav canary. Päris makse vajab eraldi luba.

### A-04 — makstud sponsoreeritud kutse võib jääda grantimata

- **Raskus:** P1
- **Tõend:** staatiline
- **Failid/read:** `app/api/invites/[id]/accept/route.js:222-238,240-338`; `app/api/invites/sponsored/init/route.js:304-340,431-435,467-502`; `lib/rooms/access.js:28-38`; `app/api/rooms/[roomId]/messages/route.js:139-155`
- **Reproduktsioon 1 — olemasolev liige:** kutsutav on juba ruumi aktiivne `RoomMember`, kuid tal pole aktiivset tellimust. Init ei keela seda. Pärast 4-eurost makset tagastab accept real 222-238 kohe `ok`, enne sponsored-role'i kontrolli, tellimuse loomist ja invite'i `useCount/status` uuendust. Liige jääb `SELF` billingSource'iga, serverivärav nõuab endiselt aktiivset Subscription'it ja kutsetoken jääb kasutamata.
- **Reproduktsioon 2 — capacity oversell:** init loendab ainult juba vastu võetud sponsored `RoomMember` read, mitte makstud või pending kutseid. Kui ruumis on 49 sponsored liiget, saavad kaks checkout'i mõlemad läbida; esimene accept täidab 50, teine makstud kutse saab 409 `SPONSOR_CAPACITY_FULL`. Reservatsiooni ega automaatset refund'i pole.
- **Reproduktsioon 3 — expiry:** init laseb kliendil määrata `expires_in_hours` ainult alampiiriga ja PAID-webhook ei värskenda `expiresAt`; makse kinnituse ajaks aegunud kutse jääb accept-is 410, kuigi makse on PAID.
- **Mõju:** maksja võib maksta, kuid adressaat ei saa lubatud ühe kuu ligipääsu; automaatne refund/reconciliation puudub.
- **Kas Fable leidis:** ei. Fable hindas „juba liige" early-return'i positiivse topeltgranti vältimisena ja capacity kontrolli toimivana.
- **Kas Fable'i raskus oli õige:** puudus; uus P1.
- **Kas Fable'i pakett sulgeb:** ei; MAKSED-P1a ei puuduta sponsoreeritud rada ning Fable'i P1b skoop on liiga kitsas.
- **Järgmine tegevus:** enne checkout'i kontrollida olemasolevat liikmesust ja tegelikku grant-vajadust; capacity jaoks reserveerida koht või arvestada pending/paid kutseid atomaarse room-lock'i all; PAID-but-ungrantable olukorrale automaatne refund/reconciliation; expiry poliitika serveripoolseks ja piiratud väärtuseks.

### A-05 — konto kustutamine kustutab makseajaloo enne 7 aasta täitumist

- **Raskus:** P1 finants-/auditipoliitikale; juriidiline lõppotsus väljas
- **Tõend:** staatiline skeem + aktiivne kustutusrada
- **Failid/read:** `prisma/schema.prisma:994-1018,1026-1044`; `prisma/migrations/0000_baseline/migration.sql:226`; `prisma/migrations/20260320183000_add_recurring_billing_foundation/migration.sql:84`; `lib/privacy/userDeletionOrchestrator.js:44-50`; `lib/privacy/effectivePracticeAccountCleanup.js:144-150`; `lib/retention.js:18-21,404-421`
- **Reproduktsioon/pseudotest:** kasutaja kustutusrada jõuab `tx.user.delete`-ni. `Payment.user` ja `BillingMethod.user` FK-d on `ON DELETE CASCADE`; ka Subscription kuulub kasutajale cascade'iga. Seega kasutaja maksed võivad kaduda kohe, mitte `PAYMENT_RETENTION_DAYS` järel.
- **Mõju:** makse-, refund- ja sponsorlusajaloo tõend võib kaduda koos kontoga; retention-job'i 7-aastane poliitika ei garanteeri tegelikku säilitust. Sponsori konto kustutamisel kaob `Payment`, kuigi adressaadi aktiivne Subscription võib `sponsorUserId` SetNull tõttu jätkuda.
- **Kas Fable leidis:** ei; Fable väitis makseridade 7-aastast säilitust ja ei käsitlenud konto kustutamise mõju.
- **Kas Fable'i raskus oli õige:** puudus; uus P1 kuni raamatupidamise/juristi otsuseni.
- **Kas Fable'i pakett sulgeb:** ei.
- **Järgmine tegevus:** jurist/raamatupidamine otsustab säilitatava minimaalse maksekirje; tehniliselt lahutada raamatupidamislik makserida kustutatavast User-ist (nt nullable/anonymized payer reference), redigeerida PII ja testida account-delete retention'i.

### A-06 — MAKSED-P1a ühe-realine variant jätab kliendi `plan` väärtuse süsteemi

- **Raskus:** P1a acceptance'i puudus; jääkmõju P2
- **Tõend:** staatiline
- **Failid/read:** `app/api/subscription/init/route.js:187-190,225-250`; `app/api/subscription/route.js:190-226`; `lib/usage/snapshot.js:36-41,171-181`
- **Reproduktsioon:** kui parandada ainult Fable'i soovitatud real `planDefinitionId`, kuid säilitada `plan = normalizePlan(body.plan, ...)`, saab CLIENT jätkuvalt salvestada `plan="admin_internal"`. Enforcement-teenus eelistab küll parandatud `planDefinitionId`-d, kuid usage snapshot arvutab `fallbackPlanKey` väärtusest `Subscription.plan`; võtmete lahknemisel laeb see admin-paketi kuvaseisu.
- **Mõju:** L-01 põhine serveri kvoodienforcement saab suletud, kuid UI/serveri pakett ja legacy tarbijad võivad lahkneda; crafted väärtus jääb Payment.raw/merchant_data-sse ja adminivaadetesse.
- **Kas Fable leidis:** osaliselt L-01, kuid P1a konkreetne skoop on ebapiisav.
- **Kas Fable'i raskus oli õige:** L-01 P1 on õige; P1a DoD vajab täiendust.
- **Kas Fable'i pakett sulgeb:** ainult siis, kui server seob **mõlemad** väljad või lükkab rolliga sobimatu `body.plan` tagasi.
- **Järgmine tegevus:** `const plan = getRolePlanKey(planRole)` ja `const planDefinitionId = getPlanDefinitionId(plan, planRole)` mõlemas route'is; crafted `body.plan` ignoreerida või 400-ga tagasi lükata. Testida salvestatud `plan`, `planDefinitionId`, usage-service ja usage-snapshot tulemust.

### A-07 — sponsoreeritava rolli algataja-õigus on main-is määratlemata

- **Raskus:** P2 või tooteotsus
- **Tõend:** staatiline + harudiff
- **Failid/read:** `app/api/invites/sponsored/init/route.js:386-435`; merge'imata `origin/codex/role-aware-invite-copy @ ead1d8d1`
- **Reproduktsioon:** main normaliseerib kliendi `targetRole`, kuid ei kontrolli, kas maksja konto roll tohib sellist suhtetüüpi/rolli sponsoreerida. Merge'imata haru lisab täpselt selle autoriseerimise.
- **Mõju:** accept seob adressaadi õigesti kutse rolliga, kuid maksja → lubatud adressaadi roll usalduspiir on main-is toote-/autoriseerimisreeglita. See võib olla teadlik „igaüks võib sponsoreerida iga rolli" poliitika, kuid peab olema sõnaselge.
- **Kas Fable leidis:** ei; Fable nimetas haru ainult copy/i18n muudatuseks.
- **Kas Fable'i raskus oli õige:** puudus; P2 ainult siis, kui toote reegel piirab sponsoreeritavaid suhteid.
- **Kas Fable'i pakett sulgeb:** ei.
- **Järgmine tegevus:** tooteomanik kinnitab lubatud maksja-roll → sponsoreeritav-roll maatriksi; seejärel rakendada serverivärav ja testid eraldi või kooskõlastada olemasoleva haru merge.

## 4. Fable'i leidude hindamine

| Fable leid | Auditi tulemus | Raskus | Paketi hinnang |
|---|---|---|---|
| L-01 crafted `plan` | **kinnitatud** pure-funktsiooni reproduktsiooniga: CLIENT 7.99 → `plan_service_provider_v1` / `plan_admin_internal_v1` | P1 õige | P1a õige esimene commit ainult siis, kui seotakse nii `plan` kui ID |
| L-02 tühi saladus callback'is | kinnitatud staatiliselt; `verifyMaksekeskusMac` tagastab tühja saladusega true, callback'id ei fail-closed | P2 õige | P2 hardening sobib, kuid üldhelper võiks ise fail-closed olla |
| L-03 webhook race | **kinnitatud ja alahinnatud**; paralleelne sama PAID annab kaks kuud | **P1, mitte P2** | tuua P1 idempotentsuspaketti |
| L-05 reconciliation puudub | kinnitatud, kuid skoop on liiga kitsas | P1 õige | laiendada renewal'i ja paid-but-ungrantable sponsorjuhtumitele |
| L-06 e-mail outbox puudub | kinnitatud | P3 õige | sobib P3/ops paketti |
| L-07 REVOKED → SENT PAID korral | kinnitatud | P3; võib tõusta P2-ks pärast tooteotsust | eraldi refund/revoke poliitika |
| L-08 resend email enne DB update'i | kinnitatud | P3 õige | eraldi outbox/transactional mail muster |
| L-09 PAST_DUE UI | kinnitatud, kuid tegelik retry on katki | P2 õige, mõju suurem A-02 tõttu | lahendada koos renewal-state paketiga |
| L-10 raw payload | kinnitatud; 90 päeva trim olemas | P2 õige | jurist/turva otsus; minimeerida enne salvestust |
| L-11 providerToken plaintext | kinnitatud | P2 õige | KMS/envelope encryption + rotation/revoke otsus |
| L-12 refund pärast accept'i | kinnitatud | P2 õige | clawback otsus enne teostust |
| L-13 alert conversion overcount | kinnitatud staatiliselt | P3 õige | kõrvalmõju muutub olulisemaks, kui dispatcher päriselt käivitada |

## 5. Kontrollküsimuste koond

### Pakett, summa ja roll

- `userId`, summa ja valuuta tuletatakse serveris; L-01 `plan`/`planDefinitionId` lahknemine on reaalne.
- L-01 pure-funktsiooni väljund:

  ```json
  {
    "role": "CLIENT",
    "amount": "7.99",
    "craftedServiceProvider": "plan_service_provider_v1",
    "craftedAdmin": "plan_admin_internal_v1"
  }
  ```

- Direct activation sisaldab sama crafted-plan juurt, kuid live-lipp on 0. See route peab jääma productionis keelatuks või olema eraldi rangelt admin/test autoriseeritud.

### Callback ja webhook

- Webhook on autoriteetne aktiveerija; callback ei aktiveeri Subscription'it.
- Webhook failib puuduva saladusega 503 ja vigase MAC-iga 401; MAC kasutab SHA-512 ja `timingSafeEqual`.
- Üldhelper on tühja saladusega fail-open, mistõttu callback'id on latentse konfiguratsioonivea suhtes nõrgad.
- Callback GET võib kuvada kasutaja juhitud query järgi success/pending UX-seisu, kuid ei anna õigusi.
- Webhook seob makse allkirjastatud `providerPaymentId` kaudu; kasutaja ei saa ilma saladuseta teise kasutaja makset muuta. Payload'i amount/currency't DB-maksega siiski eraldi ei võrrelda; see on P2 defense-in-depth kontroll.

### Idempotentsus, järjestus ja paralleelsus

- Sequential sama-staatus replay on idempotentne.
- Parallel sama-staatus replay ei ole idempotentne (A-01).
- Terminal-state kaitse piirab järjestikuseid hiliseid sündmusi, kuid ei serialiseeri samaaegseid üleminekuid.
- Provider-event'i püsivat unikaalset võtit ega inbox-tabelit ei ole.

### Reconciliation ja renewal

- Stuck `INITIATED` provider reconciliation puudub, nagu Fable leidis.
- Renewal retry on lisaks loogiliselt kättesaamatu (A-02).
- Live scheduler puudub ning recurring/provider on välja lülitatud (A-03).
- Adminil puudub per-payment ohutu reconcile/repair töövoog.

### Sponsoreeritud kasutus

- Õnneteel seotakse maksja, invite, adressaadi e-post, adressaadi roll, pakett ja üks kuu serveripoolselt.
- Token tekib alles PAID webhook'is; accept lukustab konkreetse Invite rea ja takistab sama tokeni paralleelset topeltaccept'i.
- Eri invite'ide paralleelne accept ei lukusta ruumi capacity aggregaati; lisaks capacity't ei reserveerita makse ajal.
- Existing-member early return, capacity oversell ja expiry võivad jätta makse grantimata (A-04).
- Refund pärast accept'i ei clawback'i (L-12).
- Payer deletion eemaldab Payment-tõendi, sponsor reference muutub nullable'ks ja granted subscription võib jätkuda (A-05).
- Konto e-posti muutumise puhul kasutab accept `auth.email || DB email`; vana sessiooniväärtus võib olla autoriteetsem kui värske DB e-post. Seda ei reprodukseeritud; soovitus on e-posti sobivus alati värskest User-reast ning vajadusel verified-email nõudega.

### Serveriväravad ja UI

- Autoriteetne subscription-värav nõuab `ACTIVE` + kehtivat `validUntil`; admin möödub.
- Usage enforcement eelistab `planDefinitionId`-d ja failib entitlement'i puudumisel suletult.
- Usage snapshot kasutab legacy `plan` fallback'i; seetõttu peab P1a siduma ka tekstilise `plan` välja (A-06).
- Tühistus lõpetab ligipääsu kohe, mitte tasutud perioodi lõpus; see jääb toote/juristi otsuseks.
- PAST_DUE kasutajavaade on ebaselge ning tegelik retry ei tööta.

### PII, saladused ja retention

- Sündmuslogi redigeerib tundlikud võtmed ja kärbib väärtusi.
- `Payment.raw` sisaldab redigeerimata provider payload'i kuni retention-trimini; `BillingMethod.providerToken` on plaintext.
- 90 päeva raw ja 7 aasta payment retention on ainult retention-job'i poliitika; account-delete cascade murrab selle garantii (A-05).
- PCI/juriidilist vastavust käesolev audit ei kinnita.

### Operatiivne nähtavus

- Alertide arvutamise helper töötab: sünteetiline `8 checkout / 0 webhook` tekitas `webhook_missing_after_checkout` critical alert'i.
- Dispatch-route oskab HMAC-signatuuriga sinki kutsuda ja 6 h dedupe'ida.
- Live-sink, dispatch-key ja scheduler puuduvad, seega alarmil pole tegelikku automaatset tarbijat.
- Stuck payment'i per-item counter/list/reconcile puudub.

## 6. Testid ja reproduktsioonid

| Kontroll | Tulemus | Mida tõendab |
|---|---|---|
| `tests/usage/*.test.js` | PASS 44/44 | usage, entitlements, subscription plan contract; ei testi payment route'e |
| Täiendavad seotud contract-testid | PASS 43/43 | admin/chat/wellbeing regressioon; mitte makse elutsükkel |
| Kogu `npm test` | PASS 1292/1292 | üldine regressioonibaas |
| Olemasolevad callback/webhook/payment route-testid | **not_run — repos puuduvad** | testikatte auk, mitte runtime-kinnitus |
| Olemasolevad sponsored-payment route-testid | **not_run — repos puuduvad** | testikatte auk |
| L-01 pure-funktsioon | PASS / finding reproduced | Fable L-01 kinnitatud |
| Sequential sama PAID webhook | PASS, üks kuu | sequential replay idempotentsus |
| Parallel sama PAID webhook | **FAIL, kaks kuud** | A-01 kinnitatud |
| Payment-alert pure-funktsioon | PASS | helper arvutab critical signaali |
| `npx prisma validate` | PASS | skeem kehtiv |
| Täielik migratsiooniahel ajutises PostgreSQL-is | PASS, 92 migratsiooni | puhas migrate deploy/status |
| Ajutise DB/protsesside koristus | PASS | mõlemad konteinerid eemaldatud; race-port listener puudub |
| Sihtlint | PASS | auditeeritud route/lib pinnad |
| Tootmisbuild | PASS | Next 16.2.10, 54 static pages, payment route'id buildis |
| `git diff --check` | PASS lõppkontrollis | raporti whitespace |
| Päris Maksekeskuse checkout/callback/webhook | `not_run` — ülesanne keelab päris makse/provider-kutse |
| Päris e-kiri | `not_run` — ülesanne keelab |
| Live-andmete lifecycle test | `not_run` — tootmisandmeid ei kirjutatud ega muudeta |
| Täielik local init→provider→webhook→accept | `not_run` — providerit ei kutsutud; route-level concurrency kontroll tehti täielikult fake provider payload'i ja ajutise DB-ga |

Ajutised andmed ja protsessid: kaks auditikonteinerit eemaldati, migratsiooniproovibaas drop'iti, race-konteiner eemaldati, port 3111 listenerit ei jäänud, ajutised logifailid kustutati. Tootmisandmeid ei loetud sisuliselt ega muudetud; live-kontroll oli release'i, service'i, schedule'ite ja valitud konfiguratsioonilippude read-only kontroll.

## 7. Soovitatud paketistus

1. **MAKSED-P1a — plan-binding, esimene väike commit.** Siduda nii `plan` kui `planDefinitionId` serveri rolliga init- ja direct-route'is; lisada route- ning usage snapshot/service regressioonid. See võib alata kohe.
2. **MAKSED-P1b — webhook'i atomaarne idempotentsus.** Payment row lock/CAS, event-inbox või mõlemad; parallel same/different status testid. See peab tulema enne maksete sisselülitamist.
3. **MAKSED-P1c — renewal-state ja operatiivne scheduler.** Parandada PAST_DUE valik, retry-aeg, billing-method state, cancel üleminek; seadistada kontrollitud timer ja canary.
4. **MAKSED-P1d — sponsored paid→grant terviklus.** Existing-member, capacity reservation, expiry, paid-but-ungrantable refund/reconcile, parallel accept eri invite'idega.
5. **MAKSED-P1e — payment retention/account deletion.** Vajab enne koodi juristi ja raamatupidamise otsust säilitatava maksekirje ning pseudonümiseerimise kohta.
6. **MAKSED-P2 — callback secret hardening, alert consumer, raw/token kaitse, PAST_DUE UI, refund clawback.** Jagada sõltumatuteks audititavateks alampakettideks.
7. **MAKSED-P3 — outbox/resend, revoke-vs-paid serv, mõõdiku dedupe.**

Ükski uus leid ei blokeeri P1a koodi alustamist. A-01, A-02, A-03 ja A-04 blokeerivad aga recurring/maksete tootmises sisselülitamist; A-05 vajab enne lõplikku lahendust välist otsust.

## 8. Otsused väljaspool tehnilist auditit

### Tooteomanik

- kas tühistus jõustub kohe või tasutud perioodi lõpus;
- kas refund pärast sponsored accept'i clawback'ib Subscription'i ja RoomMember'i;
- millised maksja-rollid tohivad milliseid rolle sponsoreerida;
- kuidas käituda olemasoleva ruumiliikme sponsoreerimisel;
- kas capacity reserveeritakse checkout'is ja kuidas käsitletakse ülebroneeringut;
- serveripoolne invite expiry maksimum ja kas kuu algab payment'i või accept'i hetkest.

### Jurist / raamatupidamine / maksevaldkonna ekspert

- milline maksekirje tuleb konto kustutamisel alles hoida ja millisel õiguslikul alusel;
- 90 päeva provider payload'i ning recurring-tokeni vajalik minimaalne sisu, krüpteering ja retention;
- refund/clawback ja tasutud perioodi lõpu käsitlus;
- PCI ulatus ja Maksekeskuse mandaadi kaitsenõuded;
- 7-aastase raamatupidamisretention'i täpne ulatus. Käesolev raport ei tee juriidilist ega PCI lõppotsust.

## 9. Lõppkinnitus

- Vältimatut P0 ei leitud.
- Uusi P1 leide leiti: A-02, A-03 readiness-osa, A-04 ja A-05; Fable'i L-03 tõsteti P1-ks.
- L-01 reproduktsioon kinnitati.
- MAKSED-P1a on õige esimene kitsas parandus ainult laiendatud DoD-ga; see ei ole makseintegratsiooni valmisolekupakett.
- Fable'i algfaili ei muudetud ega kopeeritud auditiharusse.
- Rakenduskoodi, Prisma skeemi, migratsioone ega teste ei muudetud.
- Merge'i ega deploy'd ei tehtud.
- Päris makset, päris provider-callback'i/webhook'i ega päris e-kirja ei tehtud.
- Auditiharusse kuulub ainult käesolev raport.

STATUS: COMPLETE
