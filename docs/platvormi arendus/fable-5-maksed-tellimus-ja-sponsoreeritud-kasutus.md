# MAKSED-A0 — tellimuse, Maksekeskuse, sponsoreeritud kasutuse ja makse-elutsükli tervikanalüüs

STATUS: IN PROGRESS

Kuupäev: 2026-07-16
Autor: Fable (read-only tervikanalüüs). Rakenduskoodi, Prisma skeemi, migratsioone, teste ega tõlkefaile ei muudetud. Ei stage'itud, commit'itud, push'itud, merge'itud ega deploy'tud. Päris makset ei tehtud, päris teenusepakkuja callback'i ei kutsutud, päris e-kirja ei saadetud, võtmeid/küpsiseid/tokeneid ei avaldatud.

Skoop: tellimuse elutsükkel algatamisest lõpetamiseni, Maksekeskuse integratsioon (checkout, recurring, webhook, callback), sponsoreeritud kutsete elutsükkel, tasuta/tasulise/sponsoreeritud kasutuse serveriväravad, maksehäirete jälgimine ja admini teavitus.

Välistatud (tõeallikaks on valmis dokument, ei korrata): AVALIK-A0 hinnastuse ja õigustekstide audit → `fable-5-avalikud-turunduslikud-ja-oiguslikud-pinnad.md`. Sealt on lähteallikana kasutatud hinna-/entitlement-vastavust; siin keskendutakse tehingu ja õiguste tegelikule elutsüklile.

---

## 1. Tõeallikas: Git / main / server seisumaatriks

| Seisund | Väärtus | Tõend |
|---|---|---|
| GitHubi `origin/main` | `2a63fcd0` | lokaalne ref (`git branch -a`); langeb kokku koordinaatori handoff'i 16.07 kontrolliga. Sandboxist `git fetch` ei tehtud (SSH keelatud) |
| Lokaalne `main` | `890124bd`, `origin/main`-ist **4 commit'i maas** | `git status -b`; vahe on ainult RAG-P8.0 dokid/skriptid/testid (`git diff --stat main origin/main`) |
| Lokaalsed commit'imata muudatused | stiilid, workspace/room/journey komponendid, untracked dokid | `git status`; **ükski ei puuduta maksekoodi** |
| Live-server | `main @ 890124bd`; `sotsiaalai-frontend.service` aktiivne | koordinaatori handoff 2026-07-16 (read-only SSH) |

**Maksepinna võtmejäreldus: lokaalne `main` = `origin/main` = server on makseloogika osas identsed.** Kontrollitud sihitud diff'iga: `git diff origin/main -- app/api/subscription app/api/invites lib/payments lib/subscriptionPlans.js lib/subscriptionStatus.js lib/usage/planSeeds.js lib/chat/subscriptionGate.js lib/admin` = **tühi**. Need neli `origin/main`-i vahecommit'i (RAG-P8.0) ei puuduta ühtki maksefaili. Seega kõik käesolevas dokumendis kirjeldatud käitumine kehtib **serveris praegu**.

Makseloogika viimane sisuline muudatus: commit `cb914cee` „Add usage administration and platform updates" (usage-ledger P0; tõi `planDefinitionId`, entitlement-väravad, recurring). Sellest hilisemat maksekoodi muudatust harudel ei ole.

**Harudel (EI ole main-is ega serveris; puudutavad ainult kutse-koopiat/i18n, MITTE makseloogikat):**
- `codex/role-aware-invite-copy` @ `ead1d8d1` — muudab `app/api/invites/route.js` (U9 rolliteadlik kutsetekst). Ei muuda `lib/payments`, tellimuse radu ega `subscriptionPlans.js`.
- `claude/clever-bassi-243deb` @ `359d779c` (05.07) — puudutab `app/api/invites/[id]/accept/route.js` i18n-võtmete tasandil.

Kumbki haru **ei muuda** makse-, tellimuse- ega entitlement-loogikat. Kogu tuum (`lib/payments/*`, `subscription/*` rajad, `subscriptionPlans.js`, `planSeeds.js`) on kolme seisundi vahel identne.

**NOT_READ — SAFEGUARD:** ükski fail ei olnud safeguardi taga; kõik nõutud failid loeti edukalt. Eraldi Sol/Codexi kontrolliks blokeeritud faile ei ole.

---

## 2. Osaliste ja usalduspiiride kaart

```
[Klient/brauser]  --(1) POST /api/subscription/init {locale, acceptedTerms}-->  [SotsiaalAI server]
      |                                                                                  |
      |                                                              (2) loob Payment(INITIATED) + Subscription(NONE)
      |                                                              (3) createMaksekeskusRecurringSetup  --->  [Maksekeskus API]
      |  <--(4) {transactionId, publishableKey, scriptUrl}-----------------------------------------------      (Bearer API key)
      |
      |  (5) laeb Maksekeskuse iframe-skripti, sisestab kaardi otse Maksekeskusele (server kaarti EI näe)
      |
[Maksekeskus]  --(6a) token_return / payment_return  POST (json+mac, SHA-512) -->  /api/subscription/callback  (redirect)
[Maksekeskus]  --(6b) payment_return  POST (json+mac)                          -->  /api/subscription/webhook   (AUTORITEETNE)
      |                                                                                  |
      |                                                     (7) verifyMac -> aktiveerib Subscription, salvestab BillingMethod.token
      |                                                     (8) owner+customer e-kiri (SMTP)
[Maksekeskus]  <--(9) recurring charge (token)  POST  <-- [cron] POST /api/jobs/subscription-renewals (x-cron-key)
```

Usalduspiirid:
- **Klient ei ole usaldatav.** Kliendilt tulevad ainult `locale` ja `acceptedTerms` (tellimus) või `emails/targetRole/roomTitle` (kutse). Summa, valuuta, roll ja pakett peaks tulema serverilt. **Erand: `plan` võetakse kliendi kehast ja seda ei valideerita rolli suhtes — vt L-01 (P1).**
- **Maksekeskus on osaliselt usaldatav**: iga sõnum on allkirjastatud jagatud saladusega (API-võti) SHA-512 MAC-iga; server verifitseerib `verifyMaksekeskusMac`-iga (`lib/payments/maksekeskus.js:367-387`).
- **Kaardiandmed ei jõua serverisse**: recurring setup kasutab Maksekeskuse iframe'i (publishableKey + scriptUrl); PAN sisestatakse otse Maksekeskusele. Server salvestab hiljem ainult korduva makse **tokeni** (`BillingMethod.providerToken`).
- **Cron/renewal on eraldi usalduspiir**: `x-subscription-renewal-key` / `x-cron-key` ajaturvalise võrdlusega (`app/api/jobs/subscription-renewals/route.js:47-63`).
- **Admin-teavitus** on eraldi rada: aggregeeritud maksehäirete dispatch (`payment-alerts/dispatch`), autoriseeritud kas admin-sessiooni või dispatch-key'ga.

---

## 3. Tellimuse täielik olekumasin (küsimus 1)

**`Subscription.status` enum:** `NONE → ACTIVE → {CANCELED, PAST_DUE}` (`prisma/schema.prisma`).
**`Payment.status` enum:** `INITIATED → {PAID, FAILED, CANCELED, REFUNDED}`.
**`BillingMethod.status`:** `PENDING → ACTIVE → {FAILED, REVOKED, EXPIRED}`.

| Üleminek | Käivitaja | Kood | Tulemus |
|---|---|---|---|
| (puudub) → NONE | `POST /api/subscription/init` | `init/route.js:242-258` | Subscription(NONE) + Payment(INITIATED), `billingMode=RECURRING` |
| NONE → **ACTIVE** | webhook `payment_return` PAID | `webhook/route.js:800-830, 366-409` | `validUntil = anchor + 1 kuu`, `nextBilling=validUntil`, `pastDueSince=null`, `billingRetryCount=0`; salvestab recurring BillingMethod(ACTIVE) |
| ACTIVE → ACTIVE (uuendus) | renewal-job → charge → webhook PAID | `subscription-renewals/route.js` + `webhook:820-830` | `validUntil` pikeneb kuu võrra olemasolevast `validUntil`-ist (prorata-kaitse: anchor = max(validUntil, now)) |
| ACTIVE → **PAST_DUE** | renewal charge ebaõnnestub VÕI renewal-webhook FAILED/CANCELED | `renewals:249-257`, `webhook:833-854` | `pastDueSince=now`, `billingRetryCount++`, BillingMethod → FAILED; `nextBilling = computeNextRetryAt` (1,3,5 p) |
| PAST_DUE → ACTIVE | järgmine retry õnnestub (webhook PAID) | `webhook:820-830` | taasaktiveerimine, retry-loendur nulli |
| PAST_DUE → **CANCELED** | retry-loendur ≥ `MAX_RETRY_COUNT` (vaikimisi 3) | `renewals:230-257`, `recurring.js:61-63` | `status=CANCELED`, `nextBilling` külmutatud |
| ACTIVE → **CANCELED** | kasutaja `DELETE /api/subscription` | `subscription/route.js:241-268` | `status=CANCELED`, `canceledAt=now` (updateMany ainult ACTIVE ridadele) |
| ACTIVE → CANCELED | webhook REFUNDED (vaikeaction=cancel) | `webhook:45,119-124,831-832,487-515` | tagasimakse tühistab tellimuse |
| aegumine (ACTIVE, `validUntil` möödas) | passiivne | `subscriptionStatus.js:1-18`, `authz.js:44-62` | staatus jääb DB-s ACTIVE, kuid `isSubscriptionActive`=false → väravad kohtlevad aegununa. **Eraldi „EXPIRED" staatust ei ole** |

**Autoriteetne olek `NONE` säilib** kuni webhook'ini: `init` loob Subscription(NONE) ja Payment(INITIATED), kuid EI aktiveeri. Ka `callback` (kasutaja tagasisuunamine) ei aktiveeri. Ainus aktiveerija on **webhook** (vt ptk 4, küsimus 2).

Nüanss: „tühistatud" tellimus jääb `validUntil`-ini kasutatavaks? **Ei koodi tasandil** — `DELETE` seab `status=CANCELED` kohe ja `hasActiveSubscription` (`authz.js:44-62`) nõuab `status="ACTIVE"`. Seega tühistus lõpetab ligipääsu **kohe**, mitte perioodi lõpus. See on toote-/õigusteksti kontrollküsimus (vt O-M4), sest hinnastus/tingimused võivad lubada „kehtib perioodi lõpuni".

---

## 4. Õiguste aktiveerimise autoriteetsus (küsimus 2)

**Autoriteetne sündmus on `POST /api/subscription/webhook` (`message_type=payment_return`, staatus PAID).** Ainult see rada:
- muudab `Payment.status → PAID` ja seab `paidAt` (`webhook:717-740`);
- kutsub `activateSubscriptionFromPayment` → `Subscription.status → ACTIVE`, `validUntil`, `nextBilling` (`webhook:366-409`);
- salvestab korduva makse `BillingMethod` (`webhook:421-485`);
- sponsoreeritud kutse puhul genereerib kutse-tokeni ja saadab e-kirja (`webhook:746-787`).

**Callback EI ole autoriteetne õiguste suhtes.** `GET /api/subscription/callback` teeb ainult 302-redirecti `/tellimus?payment=…` (`callback:182-211`). `POST`-callback verifitseerib MAC-i ja `token_return` korral salvestab BillingMethod'i (`callback:60-169`), kuid **ei aktiveeri tellimust**. Sponsoreeritud callback (`invites/sponsored/callback`) on puhas redirect.

**Renewal-job ei aktiveeri otse** — see ainult loob uue Payment(INITIATED) ja kutsub charge'i; aktiveerimine toimub taas webhook'i kaudu.

Positiivne: üksainus autoriteetne rada väldib topeltloogikat. Risk: kui webhook ei jõua kohale (võrgutõrge, teenusepakkuja viivitus, serveri taaskäivitus), jääb makse `INITIATED` ja tellimus `NONE`, kuigi klient maksis — ja **reconciliation-rada puudub** (vt L-05, ptk 7 küsimus 5–6).

---

## 5. Kasutaja/rolli/summa/valuuta serveripoolne sidumine (küsimus 3)

| Väli | Kust tuleb | Kas klient saab ümber määrata? |
|---|---|---|
| `userId` | JWT/sessioon (`getToken`/`getServerSession`) | **Ei** ✔ |
| `amount` | `getRoleMonthlyAmount(user.role)` DB-rollist (`init:190`) | **Ei** ✔ — summa on seotud konto rolliga serveris |
| `currency` | `SUBSCRIPTION_CURRENCY` env, normaliseeritud (`init:191`) | **Ei** ✔ |
| `planRole` | `normalizeSubscriptionRole(user.role)` DB-st (`init:187`) | **Ei** ✔ |
| **`plan` / `planDefinitionId`** | **kliendi kehast** `body.plan` → `getPlanDefinitionId(plan, planRole)` (`init:188-189`) | **JAH — VALIDEERIMATA. Vt L-01 (P1).** |

**L-01 (P1) — entitlement-paketi eskaleerimine kliendi `plan`-välja kaudu.** `getPlanDefinitionId` (`subscriptionPlans.js:34-40`) tagastab kliendi antud `plan`-stringile vastava paketi, kui see on `PLAN_DEFINITION_IDS` võti (`free, client_monthly, social_worker_monthly, service_provider_monthly, admin_internal`). CLIENT-kasutaja, keda **serveripoolselt maksustatakse 7,99 €** (`getRoleMonthlyAmount(CLIENT)`), saab kehas saata `plan: "service_provider_monthly"` või `plan: "admin_internal"` ja tema `Subscription.planDefinitionId` salvestub vastavalt `plan_service_provider_v1` / `plan_admin_internal_v1`. Kasutusteenus (`lib/usage/service.js:140-142`) loeb entitlement'id just sellest `planDefinitionId`-st → kasutaja saab **kõrgema paketi kvoodid (rohkem vestlusi, süvauuringuid, salvestusruumi) kliendi hinnaga**.

Ohutu runtime-tõend (pure-funktsioon, ilma DB/võrgu/makseta, `node --input-type=module` reaalset `lib/subscriptionPlans.js`-i importides):
```
Account role: CLIENT | server-bound amount: 7.99 EUR
Crafted body.plan="service_provider_monthly" -> planDefinitionId: plan_service_provider_v1 | charged: 7.99 EUR
Crafted body.plan="admin_internal"           -> planDefinitionId: plan_admin_internal_v1   | charged: 7.99 EUR
```
- Ulatus: eskaleerib **kasutuskvoote**, mitte kontorolli (`role`) ega admin-lippu (`isAdmin`) ega andmeligipääsu. `activateSubscriptionFromPayment` (`webhook:388`) säilitab juba salvestatud `planDefinitionId` (`existing.planDefinitionId || …`), seega eskaleeritud pakett jääb ka pärast aktiveerimist.
- Reaalsus: eeldab ühe päris makse sooritamist ja et `SUBSCRIPTION_RECURRING_ENABLED` on sees (mis on tootel normaalne, sest tellimusvoog töötab ainult siis). Prod-env väärtust sandboxist ei lugenud.
- UI ise seda ei kasuta — `TellimusBody.jsx:244-247` saadab ainult `{locale, acceptedTerms}`. Ekspluateeritav ainult koostatud päringuga.
- Sama juur ka `POST /api/subscription` (otseaktiveerimine, `subscription/route.js:191,199`), kuid see on `ALLOW_DIRECT_ACTIVATION` env-i taga (vaikimisi väljas → 409).
- DB CHECK-constraint `Subscription_normalized_plan_check` (`migrations/20260711120000_usage_ledger_p0:266-267`) nõuab ainult `status='NONE' OR planDefinitionId IS NOT NULL` — **ei piira** `plan`-stringi ega paketti, seega ei blokeeri eskaleerimist.
- Parandus (kontseptuaalselt, teostus eraldi kirjutusloaga): tuleta `planDefinitionId` **ainult serveri rollist** (`getPlanDefinitionId(getRolePlanKey(planRole), planRole)`), või valideeri, et kliendi `plan` kuulub selle rolli lubatud pakettidesse; `admin_internal` ei tohi kunagi olla avaliku init-raja kaudu saavutatav.

Kokkuvõte: summa/valuuta/roll on serveris usaldusväärselt seotud; **pakett ei ole** — see on ainus, kuid oluline usalduspiiri auk selles küsimuses.

---

## 6. Callback'ide ja webhook'ide allkiri, idempotentsus, kordus/järjestus/taasesitus (küsimus 4)

**Allkiri.** Kõik provider-POST'id verifitseeritakse `verifyMaksekeskusMac` (`maksekeskus.js:367-387`): SHA-512(`json` + jagatud saladus), ajaturvaline võrdlus (`crypto.timingSafeEqual`). Webhook **nõuab** saladust: `if (!WEBHOOK_SECRET) → 503` (`webhook:590-602`), seejärel `if (!verifyMac) → 401` (`webhook:604-617`). ✔

**L-02 (P2) — tühja saladuse korral MAC-verifikatsioon möödub callback'is.** `verifyMaksekeskusMac` tagastab `true`, kui `sharedSecret` on tühi (`maksekeskus.js:372`). Webhook on selle vastu kaitstud (503), aga `subscription/callback` (`callback:229`) ega `invites/sponsored/callback` (`callback:88`) **ei kontrolli tühja saladust** enne verifitseerimist. Callback küll ainult redirectib ja `token_return` korral salvestab BillingMethod'i — seega väärkäitumise mõju on piiratud (võltsitud „token_return" salvestaks tokeni, kui saladus poleks seatud). Prod-is on saladus seatud, seega latentne; kaitse peaks siiski olema süsteemne.

**Idempotentsus.** Webhook tuletab idempotentsuse **`Payment.status`-st**, mitte eraldi töödeldud-sündmuste registrist (`webhook:686-713`):
- sama staatus (nt PAID→PAID kordus) → uuendab ainult `raw`, ei rakenda kõrvalmõju uuesti (ei taasgenereeri kutse-tokenit, ei saada uut e-kirja). ✔
- terminalse staatuse kaitse: `FINAL_STATUSES.has(payment.status) && nextStatus !== REFUNDED` → `ignored` (`webhook:706-713`). Seega FAILED-pärast-PAID ja PAID-pärast-FAILED eiratakse. ✔ (REFUNDED on lubatud terminali järel, et tagasimakse läbiks.)

**L-03 (P2) — webhook ei lukusta makseea rida; teoreetiline võistlusolukord.** `webhook:656-740` teeb `$transaction`-is `findUnique` + `update` ilma `SELECT … FOR UPDATE`-ta (vrd accept-rada, mis kasutab `FOR UPDATE` — `accept:183-187`). Kaks korraga saabuvat eri-staatusega webhook'i (nt PAID ja CANCELED) võivad mõlemad lugeda `INITIATED` ja mõlemad kirjutada → viimane võidab, halvimal juhul aktiveerimine + tühistamine läbisegi. Tõenäosus madal (Maksekeskus saadab järjest, rate-limit 120/min), kuid idempotentsuse garantii pole rangelt seriaalne. Soovitus: `FOR UPDATE` makseea real või unikaalne töödeldud-sündmuse võti.

**Taasesitus (replay).** MAC katab keha, seega võõra makse võltsimine pole võimalik. Kinnipüütud kehtiva PAID-sõnumi taasesitus on **idempotentne** (staatus juba PAID → efekti pole). Ajatemplit/nonce'i värskuskontrolli pole → väga vana kehtiv sõnum on taasesitatav, kuid mõju idempotentne. Talutav.

**Järjestus.** Käsitletud terminali-kaitsega (ülal). Renewal kasutab iga katse kohta **uut** `providerPaymentId`-d (`recurring.js:120-130` — `mk_renew_<cycle>_a<attempt>_<sub>`), seega katsete segunemist ei teki. Duplikaat-loomise kaitse: `P2002` unikaalsuse rikkumine → `duplicate_skipped` (`renewals:75-77,214-227`).

**Message-type filter.** Webhook töötleb ainult `payment_return`; muu `message_type` → `ignored` 200 (`webhook:621-634`). `token_return` käsitletakse callback'is. ✔

---

## 7. Katkestus, retry, timeout, reconciliation, maksehäired, admini teavitus (küsimused 5–6)

### Katkestuse maatriks (küsimus 5)

| Katkestuskoht | Praegune käitumine | Hinnang |
|---|---|---|
| Provideri makse õnnestus, aga webhook'i pole veel töödeldud | Payment=INITIATED, Subscription=NONE. Maksekeskus **kordab** webhook'i → lõpuks järjepidev | ✔ kui provider kordab |
| Webhook `$transaction` katkeb keskel (serveri crash) | Transaktsioon veereb tagasi; Payment jääb INITIATED; provideri järgmine kordus parandab | ✔ atomaarne |
| Webhook commit õnnestus, e-kiri jäi saatmata (crash pärast commit'i) | Tellimus ACTIVE, kinnituskiri **ei lähe uuesti** (outbox puudub) | ⚠ L-06 (P3) |
| Webhook **kunagi** ei jõua kohale / provider loobub kordamast | Payment igavesti INITIATED, tellimus NONE, klient maksis — **reconciliation puudub** | **L-05 (P1/ops)** |
| token_return saabub, payment_return ei saabu | BillingMethod ACTIVE, aga Subscription NONE; renewal-job töötleb ainult ACTIVE → ei laadi | osa L-05-st |

### Retry / timeout / reconciliation (küsimus 6)

- **Timeout:** Maksekeskuse API-kutsetel `AbortController`, vaikimisi 15 s (`maksekeskus.js:16,124-125`). ✔
- **Retry (uuendus):** ajakava `SUBSCRIPTION_RENEWAL_RETRY_DAYS=1,3,5`, `MAX_RETRY_COUNT=3` (`recurring.js:9-12,45-63`); ületamisel CANCELED. ✔ hea muster.
- **Duplikaadikaitse:** unikaalne `(provider, providerPaymentId)` + `P2002`-käsitlus. ✔
- **L-05 (P1) — puudub reconciliation stuck-INITIATED maksetele.** Grep kinnitas: ühtki `reconcile`/`poll`/manuaalse „mark paid" rada ega admin-tegevust, mis päriks provideri seisu või lõpetaks rippuva makse, ei ole (`app/api/**` — 0 vastet). Renewal-job töötleb ainult juba-ACTIVE tellimusi, mitte rippuvaid esmamakseid. Ainus taastus on käsitsi DB-sekkumine.
- **Maksehäired ja admini teavitus:**
  - Per-webhook: omaniku e-kiri iga töödeldud webhook'i kohta (`webhook:920-936`, `sendOwnerPaymentWebhookNotification`); kliendi kinnituskiri PAID korral (`webhook:904-918`).
  - Aggregeeritud: `payment-alerts/dispatch` (`lib/admin/payment-alerts.js` + `dispatch/route.js`) arvutab ChatLog-sündmustest konversioonimõõdikud ja saadab **kriitilised** hoiatused välisele webhook'ile (HMAC-SHA256 allkiri), 6 h dedup (`dispatch:256-276`). Ohutu runtime-tõend (pure-funktsioonid): `webhook_missing_after_checkout` (critical) käivitub, kui checkout'e ≥8 ja webhook'e 0; `webhook_error_spike`/`webhook_error_rate_high` tehniliste vigade korral.
  - **Auk:** aggregeeritud signaal on **partii-tasandil**, mitte per-rippuv-makse. Üksik stuck-INITIATED klient ei tekita omanikule teavitust (owner-mail saadetakse ainult siis, kui webhook *töödeldi*). Kombineerituna L-05-ga: kui webhook püsivalt ebaõnnestub, ei aktiveeru tellimus ega teavitata omanikku per-juhtumi tasandil.

---

## 8. Sponsoreeritud makse sidumine (küsimus 7)

Sponsoreeritud kutse seob maksja, kutse, adressaadi, rolli, paketi ja kehtivuse **kahes etapis**: (a) host maksab kutse eest init-is, (b) adressaat aktiveerib accept-is.

| Element | Kus seotakse | Kood |
|---|---|---|
| Maksja (host) | `sponsoredByUserId = auth.userId` (sessioonist) | `sponsored/init:498` |
| Adressaat | `inviteeEmail` (host sisestab, üks e-post) | `sponsored/init:386-391,494` |
| Roll | `sponsoredRole = normalizeSubscriptionRole(targetRole)` | `sponsored/init:393,499` |
| Pakett | `sponsoredPlan = getRolePlanKey(targetRole)` | `sponsored/init:474,500` |
| Summa | `getSponsoredInviteAmount(targetRole)` server-poolne (vaikimisi **4 €** kõigile rollidele) | `sponsored/init:475`, `subscriptionPlans.js:4,66-88` |
| Kehtivus | accept-is `validUntil = addOneMonth(now)`, `nextBilling=null` (ei uuene automaatselt) | `accept:117-121,299,318-319` |
| Makse-kutse side | `Payment.inviteId = invite.id`, `kind=INVITE_SPONSORED` | `sponsored/init:514-524` |

Eeltingimused init-is: host peab omama **aktiivset tellimust** (või olema admin) — `sponsored/init:424-429`; adressaadil **ei tohi** olla aktiivset tellimust — `sponsored/init:431-435`; ruumi mahupiir 50 sponsoreeritud liiget — `sponsored/init:332-341,467-472`; kohustuslik `acceptedTerms` — `sponsored/init:417-421`; ainult üks e-post kutse kohta — `sponsored/init:387-391`.

Init loob `Invite(status=PENDING_PAYMENT)` **placeholder-tokeniga** (raw token visatakse ära, `sponsored/init:479` destruktureerib ainult `hash`). Tegeliku, kasutatava tokeni genereerib **webhook** PAID korral ja saadab e-kirjaga (`webhook:748-787`) — seega adressaat saab töötava lingi alles pärast makset. ✔

Makse ebaõnnestumisel init-is: Payment→FAILED, Invite→REVOKED, ja kui ruum loodi selle voo käigus, kustutatakse ruum (`sponsored/init:608-641`). ✔ puhas tagasipööramine.

Sponsoreeritud makse kasutab **sama webhook'i** (`/api/subscription/webhook`, `sponsored/init:552-556`); webhook'i `inviteId`-haru eristab kutse- ja tellimusmakset (`webhook:746-799`). ✔

---

## 9. Kutse aegumine, tühistamine, kordussaatmine, vastuvõtt pärast makset (küsimus 8)

| Sündmus | Käitumine | Kood | Märkus |
|---|---|---|---|
| Aegumine | accept nõuab `status="SENT" && expiresAt > now`; muidu 410 EXPIRED | `accept:207-209` | aegunud kutset ei saa vastu võtta ✔ |
| Tühistamine (revoke) | owner/mod → `status=REVOKED` | `revoke:113-148` | õigus kontrollitud ruumi omaniku/mod järgi ✔ |
| Kordussaatmine (resend) | ainult `status="SENT"`; **rotib tokeni** ja saadab uue kirja | `resend:171-212` | vana token invalideeritakse ✔ |
| Vastuvõtt pärast makset | webhook seab `sponsoredPaidAt` + tokeni; accept nõuab sponsored korral `sponsoredPaidAt` olemasolu | `webhook:753-758`, `accept:273-280` | maksestamata sponsored-kutset ei saa vastu võtta (409 PENDING) ✔ |
| Topelt-vastuvõtt | `useCount >= maxUses` → 410 EXHAUSTED; `SELECT … FOR UPDATE` rea lukk | `accept:183-187,211-213,367-376` | atomaarne ✔ |
| Juba liige | tagastab olemasoleva liikmesuse, ei tee topeltgranti | `accept:222-238` | ✔ |

**L-07 (P3) — revoke'itud kutse „ärkab" makse laekumisel.** Kui host tühistab sponsoreeritud kutse, kui makse on veel teel (Invite=REVOKED), siis PAID-webhook seab tingimusteta `status="SENT"` + tokeni (`webhook:753-758`) → kutse taastub ja adressaat saab liituda, kuigi host tühistas. Host on küll juba maksnud, seega äriliselt vaieldav, kuid host'i selge tühistustahe eiratakse. Soovitus: PAID-käsitluses austa REVOKED-seisu (tagasimakse/otsus) või blokeeri tühistus, kui makse on `INITIATED`.

**L-08 (P3) — resend saadab kirja enne DB-uuendust.** `resend:197-212` saadab uue tokeniga kirja ja alles siis uuendab `tokenHash`-i. Kui SMTP õnnestub, aga DB-update ebaõnnestub, on adressaadil kirjas token, mille hash DB-s ei kehti → ei saa vastu võtta. Väike aken; talutav.

---

## 10. Sponsoreeritud callback ei saa aktiveerida vale kasutajat/rolli (küsimus 9)

**Ei saa.** Kaks sõltumatut kaitset:

1. **Callback ei aktiveeri midagi** — `invites/sponsored/callback` on puhas redirect (`callback:45-112`); õiguste andmine toimub webhook'is (token+`sponsoredPaidAt`) ja lõplik grant accept'is. Callback'i võltsimine ei anna ligipääsu.

2. **Accept seob rolli serveripoolselt ja nõuab e-posti vastet:**
   - E-posti vaste: `invite.inviteeEmail === userEmail` muidu 403 EMAIL_MISMATCH (`accept:215-220`).
   - Rolli vaste: kui `paymentMode=SPONSORED_BY_HOST` ja `normalizeSubscriptionRole(auth.role) !== inviteRole` → 409 ROLE_MISMATCH (`accept:251-262`). Seega CLIENT ei saa vastu võtta SOCIAL_WORKER-ile sponsoreeritud kutset.
   - `planDefinitionId` tuletatakse `inviteRole`-ist (`accept:303-306`), mitte kliendi sisendist → sponsoreeritud pakett vastab kutse rollile, mitte adressaadi valikule.
   - Kui adressaadil on juba aktiivne tellimus, jääb `billingSource="SELF"` ega looda sponsoreeritud tellimust (topeltandmise vältimine) — `accept:240-243,264`.

Ainus jääkrisk on **L-01** (init-raja pakett-eskaleerimine), mis on tellimusraja, mitte sponsoreeritud accept-raja probleem. Sponsoreeritud rada ise on rolli suhtes turvaline.

---

## 11. Tasuta / tasulise / sponsoreeritud kasutuse serveriväravad vs UI (küsimus 10)

| Kiht | Tasuta | Tasuline | Sponsoreeritud |
|---|---|---|---|
| **Serverivärav (autoriteetne)** | `plan_free_v1` entitlements=`[]` (`planSeeds.js:8-16`); usage fail-closed → `USAGE_NOT_ENTITLED` (`service.js:175-179`); AI-vestlus lubatud ainult abisoovi/-pakkumise voos (`subscriptionGate.js:1-38`) ja sobitusruumis; muu → 402 `requireSubscription` (`authz.js:64-101`) | `hasActiveSubscription` nõuab `status=ACTIVE` + `validUntil>now` (`authz.js:44-62`); entitlement'id paketist (`service.js:111-190`) | accept loob `Subscription(ACTIVE, billingSource=SPONSORED_BY_HOST, nextBilling=null)`; sama entitlement-värav kui tasuline |
| **UI-seis** | HinnastusBody/TellimusBody kuvavad tasuta/tasulist; `subscription.info` „tellimus vajalik" | TellimusBody `isActive`, `daysLeft`, tühistusnupp | TellimusBody `isSponsored`, `sponsorEndsSoon` (≤7 p), `sponsorExpired` (`subscription/route.js:108-127`, `TellimusBody.jsx:103-105`) |

**Räägivad üldjoontes sama tõde.** Nii serverivärav kui UI tuletavad seisu samast `Subscription`-mudelist. Fail-closed usage on tugev muster (puuduv entitlement blokeerib, mitte ei luba).

**L-09 (P2) — PAST_DUE ei kajastu selgelt kasutajavaates.** `subscription/route.js` `shape()` (`:93-128`) arvutab `isActive = status===ACTIVE && daysLeft>0`; PAST_DUE-tellimus näidatakse lihtsalt „mitteaktiivsena" ilma eristava „makse ebaõnnestus, proovime uuesti" seisuta. TellimusBody käsitleb sponsor-seise, aga mitte PAST_DUE retry-akent. Kasutaja, kelle uuendusmakse ebaõnnestus (retry 1–3 päeva), ei näe selget põhjust. Adminivaade (analytics summary) näeb PAST_DUE loendust. → kasutaja/admini vaate vastuolu.

---

## 12. Logitavad makseandmed, saladused, isikuandmed (küsimus 11)

**Logimine.** `logPaymentEvent` (`observability.js:44-83`): console + `ChatLog(role="payment")`. Tundlike võtmete redaktsioon: `authorization, cookie, password, token, accessToken, refreshToken, apiKey, secret, raw, body, payload, audioBuffer, file, content, text, messageContent` → `[redacted]` (`observability.js:7,15-42`); väärtused kärbitakse 300 tähemärgini; `redactObject` sügavstruktuurile. ✔ hea hügieen — sündmuslogisse saladusi ja tooreid payload'e ei satu.

**L-10 (P2) — `Payment.raw` salvestab redigeerimata provideri payload'i.** Webhook kirjutab `raw: { …, payload }` (`webhook:724-729`), samuti `checkout.raw` init-is (`init:332`) ja `tokenReturn: payload` callback'is (`callback:144-148`). See payload võib sisaldada kliendi e-posti, nime, kaardi brändi/last4 ja **korduva makse tokenit**. Leevendus: `retention.js:404-411` **kärbib `Payment.raw → null`** pärast `PAYMENT_RAW_RETENTION_DAYS` (vaikimisi ~90 p), samas kui makseea rida ise säilib `PAYMENT_RETENTION_DAYS=7 aastat` raamatupidamiseks (`retention.js:18-21`). Seega PII-aken on piiratud ~90 päevaga. Siiski: 90 päeva jooksul on redigeerimata provideri payload DB-s.

**L-11 (P2) — korduva makse token plaintekstina.** `BillingMethod.providerToken` salvestatakse plaintekstina (`callback:116-123`, `webhook:459-470`); see on **korduvkasutatav makse-mandaat** (renewal-job laeb sellega kaardilt — `renewals:174-188`). See ei kärbita retention'is (aktiivne mandaat). DB-kompromiss = võime algatada kordusmakseid (küll ainult kaupmehe enda shoppi). Inherentne recurring-billing'ule, kuid vääriks jurist/turva märkust (krüpteering rest'is / KMS).

Kokkuvõte küsimusele 11: **sündmuslogi on puhas** (redaktsioon+kärbe), aga **Payment.raw ja BillingMethod.providerToken** hoiavad tundlikke andmeid (payload 90 p, token püsivalt). Ei ole P0, kuid on jurist/turva otsuse teema.

---

## 13. Tagasimakset, käsitsi taastamist või tooteomaniku otsust vajavad olukorrad (küsimus 12)

| Olukord | Miks vajab otsust | Praegune automaatika |
|---|---|---|
| Makse õnnestus, webhook ei jõudnud → stuck INITIATED | Klient maksis, õigust pole; reconciliation puudub (L-05) | **Puudub** → käsitsi DB / provideri kontroll |
| Tagasimakse pärast kutse vastuvõttu | REFUNDED revoke'ib kutse, aga juba antud sponsoreeritud tellimus/liikmesus jääb (vt allpool L-12) | Osaliselt automaatne |
| PAST_DUE 3 retry järel CANCELED | Kas pakkuda käsitsi taastamist / makseviisi uuendust | Auto-CANCELED; taastusvoogu UI-s pole |
| L-01 kaudu eskaleeritud pakett | Vale kvoot kliendi hinnaga; vajab paranduse + võimaliku korrektsiooni otsust | Puudub |
| Revoke'itud-siis-makstud kutse (L-07) | Tagasimakse või austa tühistust | Auto-„ärkab" |

**L-12 (P2) — tagasimakse pärast accept'i ei võta ligipääsu tagasi.** Kui sponsoreeritud makse REFUNDED saabub **pärast** seda, kui adressaat on kutse vastu võtnud (accept lõi `Subscription(ACTIVE)` + `RoomMember`), siis webhook seab ainult `Invite.status=REVOKED` (`webhook:788-799`), aga **ei tühista** juba antud sponsoreeritud tellimust ega eemalda liiget. Adressaat säilitab kuu aega ligipääsu, mille eest raha tagastati. Vajab tooteomaniku otsust (kas clawback vs. jäta kehtima) ja eraldi koodi.

---

## 14. Head, toimivad lahendused

1. **Üksainus autoriteetne aktiveerimisrada (webhook)** — väldib topeltloogikat callback'i ja webhook'i vahel; callback on teadlikult ainult UX-redirect.
2. **Summa/valuuta/roll seotakse serveris kontost**, mitte kliendist (v.a pakett — L-01).
3. **MAC-verifikatsioon on tugev**: SHA-512, ajaturvaline võrdlus, webhook nõuab saladust (503 kui puudub).
4. **Idempotentsuse baas**: sama-staatuse kordus ja terminali-kaitse väldivad topeltkõrvalmõju; kutse-token ja e-kiri ei kordu.
5. **Fail-closed usage-värav**: puuduv entitlement blokeerib (`USAGE_NOT_ENTITLED`), mitte ei anna vaikimisi ligipääsu; tasuta pakett on tõesti tühjade entitlement'idega.
6. **Recurring retry on läbimõeldud**: ajakava 1/3/5 p, max 3, siis CANCELED; duplikaadikaitse `(provider, providerPaymentId)` unikaalsusega + `P2002`-käsitlus.
7. **Timeout kõigil provider-kutsetel** (15 s AbortController).
8. **Cron-autoriseerimine ajaturvaline** (renewal-job, alerts-dispatch).
9. **Sponsoreeritud rada rolli suhtes turvaline**: accept nõuab e-posti + rolli vastet; token genereeritakse alles makse järel; puhas tagasipööramine init-tõrkel.
10. **Logihügieen**: tundlike võtmete redaktsioon + väärtuse kärbe sündmuslogis; `Payment.raw` kärbitakse 90 p; makseread 7 a raamatupidamiseks.
11. **Prorata-kaitse uuendusel**: `validUntil` pikeneb olemasolevast `validUntil`-ist (anchor=max(validUntil, now)), mitte now-ist → kasutaja ei kaota päevi.
12. **Maksehäirete jälgija** arvutab konversioonimõõdikud ja saadab allkirjastatud (HMAC) hoiatused dedup'iga.

---

## 15. Leiud P0–P3 (täpsed failiviited)

**P0:** käesolev audit uut P0 ei lisa. L-01 on tõsine, kuid klassifitseeritud P1-ks, sest (a) eeldab päris makse sooritamist, (b) eskaleerib ainult kasutuskvoote, mitte kontorolli/andmeligipääsu. Kui tooteomanik hindab kvoodi-/tuluriski kõrgemaks, võib selle tõsta P0-ks.

| # | Leid | Raskus | Viide |
|---|---|---|---|
| **L-01** | Kliendi `plan`-väli tellimuse init-is ei ole rolli suhtes valideeritud → CLIENT saab kliendi hinnaga (7,99 €) `plan_service_provider_v1`/`plan_admin_internal_v1` entitlement'id (kvoodi-eskaleerimine). Runtime-tõend pure-funktsiooniga | **P1** | `app/api/subscription/init/route.js:188-190`; `lib/subscriptionPlans.js:34-40`; `lib/usage/service.js:140-142`; sama juur `app/api/subscription/route.js:191,199` (ALLOW_DIRECT_ACTIVATION taga) |
| **L-05** | Puudub reconciliation stuck-INITIATED maksetele: kui webhook püsivalt ei jõua, jääb klient makstuks-aga-õiguseta, ilma automaatse taastuse ega per-juhtumi omanikuteavituseta | **P1 (ops)** | grep `app/api/**` reconcile/poll/mark-paid = 0; `app/api/subscription/webhook/route.js` (ainus aktiveeraja); `app/api/jobs/subscription-renewals/route.js:96-122` (ainult ACTIVE) |
| **L-02** | Tühja saladuse korral `verifyMaksekeskusMac` → true; callback-rajad ei kontrolli tühja saladust (webhook kontrollib) | P2 | `lib/payments/maksekeskus.js:372`; `app/api/subscription/callback/route.js:229`; `app/api/invites/sponsored/callback/route.js:88` |
| **L-03** | Webhook ei lukusta makseea rida (`FOR UPDATE` puudub); idempotentsus tuletatud `Payment.status`-st, mitte sündmuse-registrist → teoreetiline võistlus samaaegsetel eri-staatusega webhook'idel | P2 | `app/api/subscription/webhook/route.js:656-740` (vrd `accept:183-187` FOR UPDATE) |
| **L-09** | PAST_DUE-tellimus ei kajastu kasutajavaates eristava „makse ebaõnnestus / proovime uuesti" seisuna | P2 | `app/api/subscription/route.js:93-128`; `components/alalehed/TellimusBody.jsx:103-105` |
| **L-10** | `Payment.raw` salvestab redigeerimata provideri payload'i (e-post/nimi/kaardi last4/token), kärbitakse alles ~90 p | P2 | `app/api/subscription/webhook/route.js:724-729`; `app/api/subscription/init/route.js:332`; `lib/retention.js:404-411` |
| **L-11** | Korduva makse token plaintekstina `BillingMethod.providerToken`; korduvkasutatav mandaat, ei kärbita | P2 | `app/api/subscription/callback/route.js:116-123`; `app/api/subscription/webhook/route.js:459-470`; `app/api/jobs/subscription-renewals/route.js:174-188` |
| **L-12** | Tagasimakse pärast sponsoreeritud accept'i revoke'ib ainult kutse, ei võta tagasi juba antud tellimust/liikmesust (clawback puudub) | P2 | `app/api/subscription/webhook/route.js:788-799` vs `app/api/invites/[id]/accept/route.js:308-365` |
| **L-06** | Kinnitus-/omanikukiri ei saadeta uuesti, kui crash toimub pärast webhook-commit'i, kuid enne e-kirja (outbox puudub) | P3 | `app/api/subscription/webhook/route.js:889-936` (e-kirjad väljaspool transaktsiooni) |
| **L-07** | Revoke'itud sponsoreeritud kutse „ärkab" (status→SENT) PAID-webhook'il; host'i tühistustahe eiratakse | P3 | `app/api/subscription/webhook/route.js:753-758` |
| **L-08** | Resend saadab uue tokeniga kirja enne DB-uuendust; SMTP-ok + DB-fail → adressaadil kehtetu token | P3 | `app/api/invites/[id]/resend/route.js:197-212` |
| **L-13** | Idempotentne webhook-kordus logitakse `subscription_webhook_processed`-na `resultStatus=PAID` → maksehäirete „paid conversion" mõõdik võib korduste tõttu reaalsust ületada | P3 | `app/api/subscription/webhook/route.js:880-887`; `lib/admin/payment-alerts.js:61` |

---

## 16. Katkestuse, korduse ja taastamise maatriks (koond)

| Stsenaarium | Automaatne taastus | Käsitsi/otsus vajalik |
|---|---|---|
| Webhook viivitus, provider kordab | ✔ järjepidev | – |
| Webhook-transaktsioon crash | ✔ rollback + kordus | – |
| Webhook püsivalt kadunud (L-05) | ✖ | käsitsi reconciliation / provideri kontroll |
| Uuendusmakse tõrge | ✔ retry 1/3/5 p, siis CANCELED | makseviisi uuendus (UI-voog puudub) |
| Duplikaat-webhook (sama staatus) | ✔ idempotentne | – |
| Samaaegne eri-staatus webhook (L-03) | osaline (viimane võidab) | harv; `FOR UPDATE` soovitus |
| Tagasimakse enne accept'i | ✔ kutse REVOKED | – |
| Tagasimakse pärast accept'i (L-12) | ✖ ligipääs jääb | clawback-otsus |
| E-kiri kadus pärast commit'i (L-06) | ✖ | käsitsi teavitus |
| L-01 eskaleeritud pakett | ✖ | parandus + võimalik korrektsioon |

---

## 17. Kasutaja- ja adminivaate vastuolud

- **PAST_DUE (L-09):** admin (analytics summary) näeb PAST_DUE loendust ja maksehäirete mõõdikuid; kasutaja näeb ainult „mitteaktiivne" ilma retry-põhjuseta.
- **Stuck INITIATED (L-05):** kasutaja näeb `/tellimus?payment=pending` (callback redirect), admin ei saa per-juhtumi teavitust (owner-mail ainult töödeldud webhook'il); aggregeeritud alert vaid partii-tasandil.
- **Tühistuse ajastus (ptk 3):** kasutaja UI võib eeldada „kehtib perioodi lõpuni", kood lõpetab ligipääsu kohe (`DELETE` → CANCELED → värav ei loe). Kontrolli õigustekstiga (O-M4).
- **Sponsoreeritud clawback (L-12):** adressaadi vaade näitab aktiivset ligipääsu, admin/host teab tagasimaksest — seisud lahknevad.

---

## 18. Tooteomaniku otsused

- **O-M1 — L-01 raskusaste ja korrektsioon.** Kas käsitleda P0-na (kohene parandus + audit olemasolevate tellimuste `planDefinitionId` vs makstud summa vastuolule) või P1-na. Fable soovitab parandada kohe (juur on väike: seo `planDefinitionId` serveri rolliga) ja kontrollida, kas mõni olemasolev tellimus kannab rolliga mittevastavat paketti.
- **O-M2 — reconciliation-strateegia (L-05).** Kas (a) perioodiline job, mis pärib Maksekeskuselt INITIATED-maksete seisu ja lõpetab/aktiveerib, või (b) admin „reconcile payment" nupp, või mõlemad. Mõjutab tulu ja klienditoe koormust.
- **O-M3 — sponsoreeritud clawback (L-12).** Kas tagasimakse pärast accept'i peab tühistama tellimuse/liikmesuse automaatselt, või jääb see käsitsi otsuseks.
- **O-M4 — tühistuse ajastus.** Kas tühistatud tellimus peab kehtima `validUntil`-ini (perioodi lõpuni) või lõppema kohe (praegune kood). Seotud hinnastuse/tingimuste lubadusega (AVALIK-A0).
- **O-M5 — PAST_DUE kasutajavaade (L-09).** Kas lisada UI-seis „makse ebaõnnestus, uuendame N päeva jooksul" + makseviisi uuenduse voog.
- **O-M6 — revoke-vs-paid (L-07).** Kas host'i tühistus makse ajal peab blokeeruma või tagasimakse käivituma.

## 19. Eraldi juristi / raamatupidamise otsused

- **O-J1 — makse-PII säilitus (L-10, L-11).** Kas `Payment.raw` redigeerimata payload'i 90 p säilitus ja `providerToken` plaintekst-säilitus vastavad andmekaitse- ja PCI-ootustele. Kas token vajab krüpteeringut rest'is (KMS). Raamatupidamise 7 a säilitus makseridadele on ootuspärane.
- **O-J2 — tagasimakse ja sponsoreeritud kuu.** Raamatupidamislik käsitlus, kui sponsoreeritud makse tagastatakse pärast seda, kui adressaat on kuu ligipääsu kasutanud (L-12). Kas host'ile tagastatakse täis/prorata.
- **O-J3 — tühistuse jõustumine (O-M4).** Juriidiline nõue, kas tasutud periood peab kehtima lõpuni; mõjutab `DELETE`-käitumist.
- **O-J4 — L-01 finantskorrektsioon.** Kui mõni kasutaja on saanud kõrgema paketi kvoodid madalama tasu eest, kas ja kuidas korrigeerida.

---

## 20. Rakenduspaketid P0–P3 (read-only analüüs; teostab Sol/Codex eraldi kirjutusloaga)

**MAKSED-P0 — (tinglik).** Ainult kui O-M1 tõstab L-01 P0-ks: `planDefinitionId` serveripoolne sidumine + olemasolevate tellimuste korrektsuse kontroll.

**MAKSED-P1 — pakettide sidumise ja reconciliation'i pakett** (esimene rakendusvalmis, allpool detailselt): L-01 (plan-binding) + L-05 (reconciliation).

**MAKSED-P2 — idempotentsuse ja saladuste karastamine:** L-02 (callback tühja-saladuse kaitse), L-03 (`FOR UPDATE` / sündmuse-register webhook'is), L-10/L-11 (raw-payload minimeerimine, providerToken krüpteering), L-09 (PAST_DUE kasutajavaade), L-12 (clawback pärast O-M3).

**MAKSED-P3 — servaviimistlus:** L-06 (e-kirja outbox/retry), L-07 (revoke-vs-paid), L-08 (resend järjestus), L-13 (idempotentse korduse mõõdiku-parandus).

Järjestus: P1 esimesena (L-01 turvamõju + L-05 tuluриsk); P2 pärast O-M3/O-J otsuseid; P3 viimasena. Ükski ei blokeeri olemasolevaid turvapakette (DOK-XTEN, Help-P0a, VEST-P0).

---

## 21. Esimene rakendusvalmis pakett — MAKSED-P1a (L-01: plan-binding)

Kitsendatud L-01-le, sest see on iseseisev, väikese pindalaga ja kõrge mõjuga; L-05 (reconciliation) on suurem ja vajab O-M2 otsust, seega eraldatud MAKSED-P1b-ks.

**Skoop (sees):**
- `app/api/subscription/init/route.js`: tuleta `planDefinitionId` **serveri rollist**, mitte kliendi `plan`-väljast. Konkreetselt: `const planDefinitionId = getPlanDefinitionId(getRolePlanKey(planRole), planRole);` — VÕI valideeri, et `normalizePlan(body.plan)` kuulub selle rolli lubatud pakettide hulka (`{free, <role>_monthly}`), tagasilükkega muidu. `admin_internal` ei tohi kunagi olla saavutatav.
- `app/api/subscription/route.js` (POST, direct activation): sama parandus, isegi kui `ALLOW_DIRECT_ACTIVATION` on vaikimisi väljas (kaitse sügavuti).
- `lib/subscriptionPlans.js`: valikuline — lisa `getPlanDefinitionIdForRole(role)` või range-parameter `getPlanDefinitionId`-le, mis keeldub rolliga mittevastavast paketist. Ära muuda olemasolevat `getPlanDefinitionId` signatuuri viisil, mis lõhub testi `tests/usage/subscriptionPlans.test.js` (legacy-plan resolutsioon peab jääma; lisa uus rangem tee).

**Skoop (väljas):** L-05 reconciliation (P1b); webhook `FOR UPDATE` (P2); mis tahes Prisma-skeemi/migratsiooni muudatus; hinnastus-/õigustekst (AVALIK-A0); sponsoreeritud rada (juba rolliturvaline).

**Puutepind:** 2 route-faili + valikuliselt 1 lib-helper. 0 migratsiooni. ~15–30 rida.

**Testid (nõutud enne merge't):**
- Uus üksustest `lib/subscriptionPlans` rangele teele: CLIENT-roll + `plan="admin_internal"`/`"service_provider_monthly"` → tagastab **client-paketi** (või viskab), mitte eskaleeritud paketti.
- Route-tasandi test (või olemasoleva `subscriptionPlans.test.js` laiendus): kinnita, et init-is salvestatud `planDefinitionId` vastab konto rollile sõltumata `body.plan`-ist.
- Regressioon: normaalne UI-voog (ilma `plan`-ita) annab endiselt õige rolli-paketi; `tests/usage/subscriptionPlans.test.js` 4/4 roheline (kontrollitud baasjoon: praegu **PASS 4/4**).
- Kogu `tests/usage/*` ja lint rohelised.

**Vastuvõtukriteeriumid (DoD):**
- CLIENT-kontoga (või sünteetiline) init `plan="admin_internal"` kehaga → salvestatud `Subscription.planDefinitionId` = `plan_client_v1`, mitte `plan_admin_internal_v1`.
- Serveripoolne summa jääb rolli-põhiseks (muutumatu).
- Ükski olemasolev test ei katke; uus test katab eskaleerimiskatse.
- Runtime-smoke (sünteetiline, ilma päris makseta): pure-funktsiooni tõend näitab client-rolli → client-pakett kõigi crafted-`plan` väärtuste korral.

**Välistatud skoop:** deploy (eraldi otsus); reconciliation; saladuste krüpteering; UI-muudatused; õigustekst.

**Riskikontroll:** kuna tegu on autz/billing-integrity parandusega, peaks täpset diffi kontrollima teostajast erinev Sol/Codex (või Opus), kinnitades, et legacy-plan resolutsioon (registreerimise „free", migratsiooni kanoniseerimine) ei katke.

---

## 22. Runtime-kontrollide seis ja koristus

Meetod: analüüsisandboxist puudub ühendus kasutaja lokaalse Postgresiga (localhost:5432 on kasutaja masinas, sandboxile kättesaamatu — kooskõlas varasemate handoff'idega). Seetõttu **täielikku DB-põhist runtime'i ei tehtud**. Ohutult teostati ainult **pure-funktsiooni kontrollid** reaalseid mooduleid importides.

| Kontroll | Tulemus |
|---|---|
| `node --test tests/usage/subscriptionPlans.test.js` | **PASS 4/4** (plan-normaliseerimine, registreerimise free-pakett, kõik aktiveerimisrajad kirjutavad `planDefinitionId`, migratsiooni kanoniseerimine) |
| L-01 tõend: `getPlanDefinitionId(crafted, CLIENT)` reaalse `lib/subscriptionPlans.js`-iga | **KINNITATUD** — `service_provider_monthly`→`plan_service_provider_v1`, `admin_internal`→`plan_admin_internal_v1`, summa jääb 7,99 € |
| `buildPaymentAlerts` / `buildPaymentPipelineFromCounts` reaalse `lib/admin/payment-alerts.js`-iga | **PASS** — `webhook_missing_after_checkout` (critical) ja `webhook_error_spike`/`webhook_error_rate_high` käivituvad ootuspäraselt |
| Reconciliation-raja olemasolu (grep `app/api/**`) | **not applicable** — 0 vastet (kinnitab L-05) |
| Admin manuaalne `Payment.status` mutatsioon (grep `app/api/admin`) | **0 vastet** (kinnitab käsitsi-taastuse puudumist) |
| DB-põhine tellimuse/kutse elutsükli runtime (init→webhook→accept) | **not_run** — põhjus: sandboxist puudub ohutu DB-ühendus; sünteetilise konto rada polnuks puhtalt läbitav |
| Päris Maksekeskuse checkout / callback / webhook | **not_run** (teadlikult; ei tehtud päris makset ega kutsutud päris callback'i) |
| Päris e-kirja saatmine | **not_run** (teadlikult) |

**Koristuse tulemus: nulljääk, tõendatud.** Ühtki DB-ühendust ei loodud, ühtki sünteetilist kirjet (kasutaja, tellimus, makse, kutse, ChatLog) ei tekitatud, ühtki e-kirja ei saadetud, ühtki provideri kutset ei tehtud, ühtki võtit/tokenit/küpsist ei avaldatud. Sooritatud sai ainult kolm mälusisest pure-funktsiooni importi (node `-e`, failideta). Git-jääk: ainult käesolev analüüsidokument on lisatud (`git status` kinnitas — ükski koodifail muutmata). Sünteetilisi protsesse ei jäänud tööle.

---

## 23. Vastused kontrollküsimustele (koond)

1. **Olekumasin:** ptk 3. `NONE→ACTIVE` (webhook PAID), `ACTIVE→ACTIVE` (uuendus), `ACTIVE→PAST_DUE` (tõrge)→retry→`ACTIVE`/`CANCELED`, `ACTIVE→CANCELED` (kasutaja/refund), aegumine passiivselt (eraldi EXPIRED-staatust pole).
2. **Autoriteetne aktiveerija:** webhook (`payment_return`, PAID). Callback = redirect + token; renewal = charge; kumbki ei aktiveeri otse. Ptk 4.
3. **Server seob:** userId/amount/currency/role ✔, **pakett ei ✖ (L-01 P1)**. Ptk 5.
4. **Allkiri/idempotentsus:** MAC SHA-512 ajaturvaline ✔; idempotentsus staatuse-põhine (osaline, L-02/L-03); replay idempotentne. Ptk 6.
5. **Katkestus makse ja DB vahel:** provideri korduse korral järjepidev; püsiva webhook-kao korral stuck INITIATED, reconciliation puudub (L-05). Ptk 7.
6. **Retry/timeout/reconciliation/häired/teavitus:** retry 1/3/5×max3 ✔, timeout 15s ✔, **reconciliation puudub (L-05)**, häired PAST_DUE+alerts, teavitus per-webhook + aggregeeritud. Ptk 7.
7. **Sponsoreeritud sidumine:** host→kutse→adressaat→roll→pakett→kuu, kaheastmeline (init makse + accept grant). Ptk 8.
8. **Kutse aegumine/tühistus/resend/vastuvõtt:** aegunud/kasutatud blokeeritud, revoke owner-gated, resend rotib tokeni, sponsored vastuvõtt nõuab `sponsoredPaidAt`. Servajuhtumid L-07/L-08. Ptk 9.
9. **Vale kasutaja/roll sponsored callback'is:** ei saa — callback ei aktiveeri, accept nõuab e-post+roll vastet. Ptk 10.
10. **Tasuta/tasuline/sponsoreeritud värav vs UI:** räägivad sama tõde (fail-closed usage); erand PAST_DUE kasutajavaade (L-09). Ptk 11.
11. **Logitav/saladused/PII:** sündmuslogi puhas (redaktsioon+kärbe); `Payment.raw` payload 90 p (L-10), `providerToken` plaintekst (L-11). Ptk 12.
12. **Tagasimakse/käsitsi taastus/PO-otsus:** stuck INITIATED, refund-pärast-accept (L-12), PAST_DUE→CANCELED, L-01 korrektsioon. Ptk 13, 18–19.

---

STATUS: COMPLETE
