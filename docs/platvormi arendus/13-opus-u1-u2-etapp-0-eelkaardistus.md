# U1/U2 Etapp 0 kanooniline koond ning SOLI U5/U6/U7/U9/U11 auditi- ja tööplaanisisend

> **Kuupäev:** 2026-07-14  
> **Töörežiim:** read-only arhitektuuri- ja privaatsusaudit  
> **Rakenduskoodi, skeemi, migratsioonide ja testide muudatused:** puuduvad  
> **Opuse auditipaketi commit / push / merge / deploy:** tegemata; hilisem integratsioon ja deploy on lepitatud §14-s
> **Eelnevate SOL paranduste seis:** `SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA`; see ei võrdu märgendiga `OPUS HEAKS KIIDETUD`.

See fail on kahe sõltumatu **Etapp 0 kaardistuse** kanooniline koond. Kattuvad järeldused on deduplitseeritud, erinevad leiud on ühendatud ning loendite või aktiivse koodi lahknevuse korral lähtutakse 2026-07-14 uuesti kontrollitud `main` tööpuust. Opus lõpetas eraldi privaatsusringi, U5/U6/U7/U9/U11 auditi ja U7 tööplaani sisendi §11–§13-s; U1–U12 progressihinnang on failis 10. §6–§8 on säilitatud **Soli sisendina**, §11–§13 Opuse sõltumatu kontrollina ja §14 auditi järel muutunud integratsiooni- ning deploy-seisu lepitusena.

---

## 1. Kokkuvõttev otsus

U1/U2 teostus võib alata pärast allpool kirjeldatud sõltuvuste ühendamist ja kahe uue P1 eeltingimuse sulgemist. Praeguses aktiivses koodis on olemas head lähtekohad — tööruumikaartide badge'i sisend, ruumide `lastReadAt`, omanikuskoobiga Teekond ja Tööheaolu mustandid, tehinguline help-match ning P1 scheduler — kuid püsivat sündmuste tabelit, keskset sündmuseteenust, kasutaja e-kirjaeelistust, delivery job'i ega serveripoolset „Jätka siit” koondit ei ole.

Kõige olulisemad järeldused:

1. **SOL-U1U2-P1-1 — uus privaatsusblokeerija, Opuse poolt kinnitatud ja laiendatud.** `serializePreInquiry()` väljastab `receiverNote` ja `receiverChecklist` nii autorile kui vastuvõtjale. `GET /api/pre-inquiries` ja detail-GET kasutavad sama vaatajakontekstita serialiseerijat. UI kirjeldab neid samal ajal vastuvõtja sisemise töövaatena. Enne U2 järgmise kontakti välja lisamist tuleb leping teha vaatajapõhiseks ning regressioonitestiga lukustada, et autor ei saa vastuvõtja sisemist märget, checklist'i ega kuupäeva API kaudu. Opuse §11 kontroll kinnitas lisaks, et sama serializer lekitab mõlema poole konto-e-posti.
2. **OPUS-U1U2-P1-2 — mailer on tootmises fail-open.** Kui SMTP konfiguratsioon puudub, tagastab `getMailer()` ka `production` keskkonnas mock-transpordi, mis logib kogu kirja koos adressaadiga ja resolve'ib saatmise õnnestunuks. U1 delivery job võiks seetõttu märkida `emailedAt`, kuigi kirja ei saadetud, ning rikkuda logide PII-lepingut. Enne U1 e-kirjakanalit peab tootmise mailer puuduliku konfiguratsiooni korral katkema, dev-mock peab olema selgelt piiratud ja logid redigeeritud ning regressioonitest peab tõendama, et valet `SENT` olekut ei teki.
3. **U3 oli U1/U2 otsene merge-eeltingimus ja on nüüd täidetud.** Recall/correction/opened olekud muudavad saabumise ja olekusündmuste dedupe- ning read-lepingut; U3 on `main`-is ja produktsioonis.
4. **U4 oli kättesaadavusmeeldetuletuse otsene merge-eeltingimus ja on nüüd täidetud.** U4 kasutab otse-SMTP saatmist ja `availabilityReminderSentAt` claim'i. U1 peab selle kanali püsiva sündmuse/delivery lepingu alla tooma või selgelt adapteriga ühitama; U4 ja U1 ei tohi saata kahte paralleelset kirja.
5. **SMTP peal ei ole crash-after-send täpselt-üks-kord tõendatav.** Praegune mailer loob igal katsel juhusliku `Message-ID`. Kui SMTP on kirja vastu võtnud, kuid protsess sureb enne DB `SENT` märget, ei saa rakendus teada, kas uuesti saata. V1 soovitus on fail-closed: stagneerunud `SENDING` läheb `UNKNOWN` olekusse ega lähe automaatselt kordussaatmisele; administraator saab teha teadliku käsitsi korduse. Kui toode eelistab „vähemalt üks kord”, tuleb võimalik duplikaat ausalt aktsepteerida.
6. **Praegune receiver checklist on JSON-is array ning ei kanna kuupäeva.** Kuupäeva peitmine array elemendi sisse lõhuks normaliseerija lepingu. Kõige väiksem ohutu kuju on eraldi nullable `PreInquiry.nextContactOn String?`, range `YYYY-MM-DD`, koos adressaadi/kuupäeva indeksiga. See väldib UTC/DST tähendusmuutust ja on ausam kui olemasoleva JSON-kuju varjatud vahetamine.
7. **U5/U6/U7/U9/U11 pole valmis.** U9-l on suur osa mehaanikast olemas ja U7-l head prompt/a11y liidesed; U5, U6 ja U11 vajavad uusi serverivertikaale. U7 on endiselt mõistlik järgmine esmane kandidaat pärast U1/U2.

---

## 2. Auditi lähteolek ja tõendi märgendid

### 2.1 Tööpuud

| Tööpuu | Haru / HEAD | Seis auditi alguses | Kasutus selles dokumendis |
|---|---|---|---|
| `C:/Users/rauds/Desktop/SotsiaalAI` | `main` / `df2f45c02c...` | dirty; P1 töö ja dokumendid commit'imata, lisaks kõrvalised kasutaja muudatused | aktiivne `main` tööpuu |
| `C:/Users/rauds/Desktop/SotsiaalAI-u12-u3` | `codex/u12-u3-trust-package` / `d2dd13e317...` | clean | U3 lõplik haruleping |
| `C:/Users/rauds/Desktop/SotsiaalAI-u4` | `codex/u4-availability-trust` / `3208c08c...` | U4 auditiparandused commit'imata | U4 lõplik parandatud tööpuuleping |
| `C:/Users/rauds/Desktop/SotsiaalAI-u8-lite` | `codex/u8-lite-trust-layer` / `df2f45c02c...` | U8-lite pakett commit'imata | ainult migratsiooni- ja merge-sõltuvus |

`main` tracked-diff SHA-1 auditi alguses oli `9dbc0726a52fb861afff8b0dde2ba6c5f41ede43`. U3 tracked diff oli tühi. U4 tracked-diff SHA-1 oli `797397cd58b91fb39df35e87e63efd8fdcddbe62`; U8-lite tracked-diff SHA-1 oli `69302e9806b4fda887a2af0cfd82c3459f33bb18`. Untracked faile need hashid ei kata; nende olemasolu fikseeriti eraldi `git status --short` väljundiga.

### 2.2 Märgendid

- **MAIN-IST KINNITATUD** — kontrollitud aktiivsest `main` tööpuust. Kui fail on commit'imata, on see eraldi öeldud.
- **HARUST KINNITATUD** — kontrollitud nimetatud feature-tööpuust.
- **VAJAB PÄRAST MERGE’I UUESTI KONTROLLI** — leping sõltub veel ühendamata või commit'imata paketist.

---

## 3. U1/U2 aktiivse koodi kaart

### 3.1 Püsiv sündmusekiht

**MAIN-IST KINNITATUD:** skeemis puudub `NotificationEvent` või samaväärne kasutajale suunatud püsiv sündmus. `DataAuditLog` ei sobi asenduseks: selle actor/target ID-d on vabatekstilised stringid, tal pole kasutaja-FK cascade'i, read-state'i ega delivery olekut. `EffectivePracticeAuditEvent` on praktikadomeeni audit, mitte kasutaja märguandekast.

**MAIN-IST KINNITATUD:** puuduvad ka:

- omanikuskoobiga notification API;
- e-kirja delivery job;
- notification e-kirjaeelistus;
- sündmuse allowlist ja target allowlist;
- serveripoolne „Jätka siit” koondteenus.

### 3.2 Tööruumi badge'id

**MAIN-IST KINNITATUD:** `lib/workspaceDashboardCards.js` juba toetab `dashboardBadges` sisendit ja seob aliased kaartidega. `WorkspacePanel` ja `ChatBodyView` kannavad prop'i edasi, kuid `components/alalehed/ChatBody.jsx` ei anna `dashboardBadges` prop'i `ChatBodyView`-le ning `WorkspacePanel` ei tee ise ühtegi badge'i andmepäringut.

**MAIN-IST KINNITATUD:** aktiivses koodis ei leitud ühtegi `dashboardBadges` tootjat ega olemasolevat tööruumi koond-API-t, mida saaks lihtsalt laiendada. Seega on olemas ainult esitluskonks, mitte serveriandmed. Mapper lubab tüüpe `dot`, `number` ja `attention`, kuid `workspace.css` annab kõigile `[data-badge-type]` variantidele sama 0,55-rem täpi geomeetria. U1 peab looma turvalise serverikoondi ja prop'i andmevoo ning lisama numbri/tähelepanu jaoks eraldi visuaalse lepingu ja UI-testi.

### 3.3 Eelpöördumised

**MAIN-IST KINNITATUD:** `PreInquiry` kannab autorit, valikulist platvormiadressaati, kanalit, sisu, vastuvõtja märkmeid/checklist'i ning olekut. `listVisiblePreInquiries()` lubab rea autorile või `recipientOwnerId` kasutajale.

**MAIN-IST KINNITATUD:** sisemise saatmise saabumine tekib `createPreInquiry()` või `updatePreInquiry()` käigus, kui olek läheb `SENT` ja kanal on `INTERNAL`. Praegune teavitus on best-effort e-kiri pärast DB kirjutust. E-kirja viga neelatakse; püsivat retry rada ega sündmuserida ei teki.

**HARUST KINNITATUD — U3:** recall, correction ja explicit accept kasutavad ühist eelpöördumise advisory lock'i. U3 lisab `openedAt`, `recalledAt` ja `supersededById`. Accept muudab `SENT -> READY` ning seab `openedAt`; workflow salvestus seab samuti esimesel korral `openedAt`. Recall on lubatud ainult enne avamist; correction loob uue rea pärast avamist.

**MAIN-IST KINNITATUD:** receiver workflow salvestus on praegu plain last-write-wins: visibility loetakse enne kirjutust ning mutation ei nõua `expectedUpdatedAt` väärtust, tehingut, advisory lock'i ega kliendi snapshot'i fingerprint'i. U3 haru lisab advisory lock'i ja värske rea vastu mutation-time CAS-i, mis sulgeb paralleelse interleaving'u, kuid klient ei saada endiselt oma loetud versiooni. Seega võib vana vorm pärast luku saamist uuema workflow üle kirjutada. U2 §11 jaoks tuleb lisada kliendi `expectedUpdatedAt` ja stale vastusele ühetaoline `409`.

**VAJAB PÄRAST MERGE’I UUESTI KONTROLLI:** saabumise sündmus peab välistama recalled originaali, correction peab looma sündmuse uue rea ID-ga ning vana sündmus tuleb recall'i korral serveris mitteaktiivseks/loetuks muuta. Seda ei saa lõplikult ehitada `main` praeguse kolmeväljalise olekumudeli vastu.

### 3.4 SOL-U1U2-P1-1 — vaatajakontekstita eelpöördumise serializer

**Uus tõend, mitte vana U3 auditi kordus.** Probleem leiti U2 privaatse järgmise kontakti kaardistamisel.

Tõendiahel:

1. `lib/preInquiries.js:487` `serializePreInquiry(inquiry)` ei võta `viewerId` ega audience'i.
2. Sama serializer lisab vastusesse `receiverNote` ja `receiverChecklist` (`lib/preInquiries.js:503-504`).
3. `listVisiblePreInquiries()` tagastab sama kuju nii autorile kui adressaadile (`lib/preInquiries.js:539-559`).
4. `GET /api/pre-inquiries/[id]` serialiseerib sama moodi pärast autori-või-adressaadi visibility kontrolli.
5. UI ütleb, et märge on vastuvõtja töövaates, mitte pöörduja mustandis (`components/workspace/WorkspaceFeaturePage.jsx:1978-2000`).

Mõju: autor saab vastuvõtja sisemise tööinfo API kaudu isegi siis, kui UI seda ei renderda. Kui U2 lisaks samasse lepingusse järgmise kontakti kuupäeva, lekiks ka see.

Nõutav sulgemine enne U2:

- `serializePreInquiry(inquiry, { viewerId })` või kaks selgelt eraldi serializer'it;
- `receiverNote`, `receiverChecklist` ja `nextContactOn` ainult siis, kui `viewerId === recipientOwnerId`;
- author-view regressioonitest, mis kontrollib välja puudumist, mitte ainult UI peitmist;
- recipient-view regressioonitest;
- list, detail, workflow mutation ja U3 accept/correction vastusekujud peavad kasutama sama audience-lepingut.

### 3.5 Ruumid ja kutsed

**MAIN-IST KINNITATUD:** ruumi lugemata arv arvutatakse `RoomMember.lastReadAt` ja teise autori kustutamata sõnumite `createdAt > lastReadAt` järgi. `PUT /api/rooms/[roomId]/read` kontrollib liikmelisust ja billing access'i, leiab viimase sõnumi aja ning nihutab `lastReadAt` ainult edasi.

**MAIN-IST KINNITATUD:** kasutaja ruumisõnum kirjutatakse otse `prisma.roomMessage.create()` kaudu. Lisaks kirjutavad ruumisõnumeid assistendi runtime ja kõne lõpetamise süsteemitee. Seega ühe route'i instrumenteerimine ei kataks kõiki kirjutajaid.

**MAIN-IST KINNITATUD:** tavaline kutse luuakse üksikute `Invite.create()` kutsetena ning e-kiri saadetakse pärast iga create'i best-effort korras. Kutse ei kanna kutsutu `userId`-d; adressaat on e-post. Accept lukustab kutse `FOR UPDATE`, kontrollib konto e-posti ning loob liikmelisuse ja accepted oleku samas tehingus.

Ruumidigest ei tohi tekkida iga sõnumi e-kirjana. V1 ohutu päritolu on scheduler/reconcile, mis koondab ühe aktiivse liikme lugemata tegevuse ühe ruumi ja ajavahemiku sündmuseks. Badge'i tõde jääb ruumi unread päringust; digest-sündmus on kanali- ja ajalooobjekt.

Read-semantika serv: `lastReadAt` üksi ei erista kahte täpselt sama timestamp'iga sõnumit. U1 v1 võib säilitada praeguse lepingu, kuid test peab lukustama valitud tähenduse. Täielikult stabiilne lahendus vajab `lastReadMessageId` või muud komposiitset watermark'i (`createdAt`, `id`).

### 3.6 Help match

**MAIN-IST KINNITATUD:** `createHelpMatchAndRoom()` töötab ühe Prisma tehinguna. See loob või leiab room'i, loob mõlema kasutaja liikmelisuse ja upsert-laadse `(requestId, offerId)` match'i. `HelpMatch` kannab nii requester- kui offerer-ID-d.

See on U1 kõige puhtam same-transaction adapter: event'id saab luua match'i samas tehingus mõlemale lubatud osapoolele, välja arvatud juhul, kui tooteleping otsustab teavitada ainult mittealgatajat. Kumbki sündmus ei tohi kanda kuulutuse kirjeldust ega `reasonsJson` sisu.

### 3.7 Teekond ja Tööheaolu

**MAIN-IST KINNITATUD:** Teekonna list/detail/update on alati `ownerUserId` skoobis. Aktiivse teekonna koondikandidaat on `status = ACTIVE`, deterministlikult `updatedAt` järgi.

**MAIN-IST KINNITATUD:** Tööheaolu väljundmustandid on alati `userId` skoobis. Pooleli kandidaat on privaatne `status = draft`, `userConfirmed = false`; `ready_to_share` ega `in_covision` ei ole „jätka mustandit”.

Koond ei tohi tagastada mustandi teksti, wellbeing'u riskimarkereid ega Teekonna kokkuvõtet. V1 vajab ainult turvalist tüüpi, objekti ID-d, staatilist lokaliseeritavat label-key'd ja aega.

### 3.8 Parimate praktikate scheduler

**MAIN-IST KINNITATUD, commit'imata P1 tööpuust:** `runPracticeReviewSchedulerTick()` kasutab transaction-scoped advisory lock'i, stabiilset cursor/batch skanni ja püsivaid `REVIEW_DUE` / `ASSIGNMENT_OVERDUE` auditimarkereid. Markerid ei kanna praktikateksti.

U1 adapteri täpsustus:

- assignment'i loomise märguanne peab sihtima konkreetset `reviewerId`-d ja tekkima assignment'iga samas tehingus;
- overdue märguanne peab tekkima konkreetse assignment'i või konkreetse reviewer'i kohta, mitte ainult praeguse tsükli koondmarkerist;
- ainult `ASSIGNED`, `completedAt = null`, current `contentVersion` ja kehtiva reviewer'i rida võib tekitada sündmuse;
- avaldatud praktika `REVIEW_DUE` markeril pole praegu üheselt määratud kasutajadressaati. Kui autor puudub konto kustutamise tõttu, ei tohi seda suvalisele adminile isikliku notification endpoint'i kaudu anda. See vajab enne adapterit tooteotsust: autor, määratud retsensent või ainult ops/admin koond.

### 3.9 U4 kättesaadavusmeeldetuletus

**HARUST KINNITATUD — U4 parandatud tööpuu:** service'il on `availabilityStatus`, `availabilityDescription`, `availabilityCheckedAt` ja `availabilityReminderSentAt`. Meeldetuletuse dispatcher:

- valib stale avaldatud teenused;
- teeb `updateMany` CAS claim'i `availabilityReminderSentAt = now`;
- saadab e-kirja otse;
- õnnestumisel kirjutab auditikirje;
- vea korral taastab claim'i nulliks ja kirjutab ohutu veakoodiga auditikirje.

**VAJAB PÄRAST MERGE’I UUESTI KONTROLLI:** U1 peab vältima kahte paralleelset saatjat. Soovitus on, et U4 valik loob ühe `SERVICE_AVAILABILITY_STALE` NotificationEvent'i ning ainult notification delivery job saadab kirja. `availabilityReminderSentAt` seatakse alles confirmed `SENT` järel või jääb legacy-ühilduvuse markeriks, mitte eraldi claim'iks.

### 3.10 Mailer, job-auth ja avalikud vead

**MAIN-IST KINNITATUD:** `lib/mailer.js` on oma SMTP klient. `Message-ID` on praegu `Date.now() + Math.random()`, mitte sündmusest deterministlik. SMTP `250` järel tagastab mailer ainult MIME payload'i; provider-level idempotency key puudub.

**OPUS-U1U2-P1-2 — MAIN-IST KINNITATUD:** kui SMTP konfiguratsiooni pole, tagastab `getMailer()` ka `NODE_ENV=production` korral `createDevTransporter()`. Mock logib `JSON.stringify(message)` kaudu kogu sõnumi, sealhulgas `to`, subject'i ja body, ning `sendMail()` resolve'ib edukalt. Aktiivses `main`-is on 17 välist `getMailer()` kutsekohta; mõju ei piirdu U1-ga. `hasConfiguredEmailTransport()` eelkontroll üksi ei ole piisav, sest mailer ise peab tootmises fail-closed olema.

Nõutav sulgemine enne U1 delivery job'i:

- tootmises puuduv või vigane transport viskab klassifitseeritava vea ega tagasta mock'i;
- dev/test mock on explicit opt-in ning ei logi adressaati ega kirja sisu;
- delivery claim ei liigu `SENT`/`emailedAt` olekusse, kui päris transport puudub;
- regressioonitestid katavad production-no-transport, logide PII puudumise ja retry/claim'i õige oleku.

**MAIN-IST KINNITATUD:** P1 `practice-reviews` job kasutab fail-closed keskkonnavõtit ja `crypto.timingSafeEqual` võrdlust. Sama muster sobib notification job'ile, koos pikkuse-eelkontrolli, no-store vastuse ja ainult loenduritega.

**MAIN-IST KINNITATUD:** ühise `publicErrorMessageKey()` allowlist lubab ainult `api.*` ja `documents.*` võtmeid. Notification endpoint peab kasutama fikseeritud `api.notifications.*` võtmeid; ta ei tohi peegeldada caller'i ega DB raw error message'it.

**MAIN-IST KINNITATUD:** `createLatestRequestGate()` katkestab eelmise kliendipäringu ja lubab rakendada ainult viimase vastuse. Sama gate või ekvivalent on vajalik read-state'i ja preference-toggle'i hiliste vastuste vastu, kuid serveri preference mutation vajab lisaks version/CAS-i — browser abort ei tühista juba serveris commit'itud kirjutust.

### 3.11 Konto kustutamine

**MAIN-IST KINNITATUD:** konto kustutamine lõpeb päris `User.delete()`-ga pärast domeenipuhastusi. Seetõttu peab `NotificationEvent.userId` olema päris FK `onDelete: Cascade`. Stringiline `targetUserId` DataAuditLogis seda lepingut ei täida.

Source/target objekti kustumine ei pea notification rea FK-dega blokeerima. Sündmus hoiab ainult allowlist'itud source/target ID stringi; serializer kontrollib avamisel või koondamisel sihtobjekti õigust ja olemasolu. Stale sündmus märgitakse aegunuks/loetuks või jäetakse koondist välja, mitte ei lekitata 403/404 erinevust.

---

## 4. Etapp 0 kaksteist vastust

### 4.1 Millest tekib iga v1 sündmus?

| Sündmus | Tekitaja aktiivse koodi järgi | Soovituslik adapter |
|---|---|---|
| Eelpöördumine saabus | INTERNAL `SENT` transition; U3-s ka correction'i uus rida | `createPreInquiry`/`updatePreInquiry`/correction sama lock-tehingu sees |
| Eelpöördumine võeti vastu või olek muutus | U3 `acceptPreInquiry` ja receiver workflow oluline status-transition | sama eelpöördumise lock-tehingu sees; sündmus autorile |
| Ruumikutse | `Invite.create`; konto adressaat on tuletatav invitee e-postist | invite + platvormikasutaja event ühe tehinguna; väliskutsutu jääb ainult transactional email'i lepingusse |
| Ruumi uus tegevus | kõik roomMessage writer'id; koondaken, mitte üksiksõnum | scheduler/reconcile aktiivsete liikmete unread olekust |
| Sobitus tekkis | `createHelpMatchAndRoom()` | match'i Prisma tehingus lubatud osapooltele |
| Järgmise kontakti tähtaeg | vastuvõtja salvestatud `nextContactOn`, serveri Tallinn-date boundary | kuupäeva mutation tühistab vana tuleviku; due scheduler loob event'i |
| Praktika review ülesanne/tähtaeg | assignment create ja P1 overdue scheduler | assignment'iga samas tx-is; scheduler-markeriga samas tx-is |
| Kättesaadavuse värskendus | U4 stale-service selection | U4 dispatcher loob event'i; delivery ainult U1 job'ist |

### 4.2 Millised sündmused peavad tekkima sama tehinguga?

Same-transaction on kohustuslik arrival/status, platvormikasutaja invite, match, review assignment ning scheduler'i marker + notification kombinatsioonile. Tulevase kuupäeva salvestamisel ei looda veel „tähtaeg käes” sündmust, kuid vana plaanitud event tuleb samas mutation-tehingus invalideerida. Room digest on tuletatud koond ja tekib oma scheduler-tehingus.

### 4.3 Deterministlik dedupe

Soovituslikud võtmed (server koostab, caller ei saada):

- `pre_inquiry_arrived:{preInquiryId}:{sentVersion}`;
- `pre_inquiry_status:{preInquiryId}:{previousUpdatedAt}:{nextStatus}` või veel parem eraldi monotonic status revision;
- `room_invite:{inviteId}:{userId}`;
- `room_digest:{roomId}:{userId}:{windowStartUtc}`;
- `help_match:{matchId}:{userId}`;
- `next_contact:{preInquiryId}:{nextContactOn}:{recipientOwnerId}`;
- `practice_assignment:{assignmentId}:{reviewerId}`;
- `practice_overdue:{assignmentId}:{contentVersion}:{reviewerId}`;
- `service_availability:{serviceId}:{availabilityCheckedAt-or-period}:{ownerId}`.

DB `dedupeKey @unique` on lõplik võistluskaitse. Teenus kasutab create-and-catch-unique või upsert'i; find-then-create üksi ei ole piisav.

### 4.4 Minimaalne NotificationEvent skeem

Soovituslik Prisma kuju, nimed võib teostuses kohandada:

```prisma
model NotificationEvent {
  id                 String    @id @default(cuid())
  userId             String
  type               String
  sourceType         String
  sourceId           String
  dedupeKey          String    @unique
  targetKind         String
  targetId           String?
  occurredAt         DateTime  @default(now())
  readAt             DateTime?
  expiresAt          DateTime?
  emailStatus        String    @default("NOT_REQUESTED")
  emailAttempts      Int       @default(0)
  emailNextAttemptAt DateTime?
  emailClaimToken    String?
  emailClaimedAt     DateTime?
  emailedAt          DateTime?
  emailLastErrorCode String?
  emailMessageId     String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt, occurredAt, id])
  @@index([emailStatus, emailNextAttemptAt, id])
  @@index([userId, targetKind, targetId, readAt])
}
```

Kõik stringilised olekud valideeritakse rakenduskihi frozen allowlist'iga. Tabelisse ei lisata `metadata Json`, kasutajateksti, e-posti aadressi, teise inimese ID-d, ruumisõnumit, pöördumise teemat ega praktikateksti.

Userile on väikseim concurrency-kindel eelistus:

- `notificationEmailEnabled Boolean?` — `null` säilitab event-type'i documented legacy default'i;
- `notificationPreferenceVersion Int @default(0)` — owner-only CAS mutation.

`null` on vajalik, et mitte muuta vaikides olemasolevate transactional kirjade lepingut ega lülitada kõigile sisse uusi digest'e. UI esimene teadlik valik muudab väärtuse booleaniks. Lõplik legacy-default maatriks tuleb enne teostust tooteomanikul kinnitada.

### 4.5 E-kirja claim/CAS ja crash-after-send

1. Worker valib stabiilse `(emailNextAttemptAt, id)` cursor'iga `PENDING/RETRY` read.
2. `updateMany` CAS seab unikaalse claim tokeni, `SENDING`, `claimedAt`, increment attempts.
3. Enne saatmist loetakse kasutaja eelistus värskelt; opt-out märgib `SKIPPED_PREFERENCE`.
4. Mailer peab aktsepteerima sündmusest tuletatud stabiilset `messageId`-d, kuigi SMTP ei taga selle dedupe'i.
5. Edu järel CAS tokeniga `SENT + emailedAt`.
6. Selge transport error läheb bounded backoff'iga `RETRY` või `FAILED`.
7. Aegunud `SENDING` on **ambiguous**. V1 fail-closed soovitus: `UNKNOWN`, automaatset resend'i ei tehta. Admini käsitsi resend loob auditeeritud uue katse.

See sulgeb paralleelworker'i duplikaadi ja automaatse crash-resend duplikaadi. Ta ei saa tõendada, et ambiguous kiri jõudis kohale. Täpselt-üks-kord nõuaks providerit, mis toetab idempotency key'd või delivery lookup'i.

### 4.6 Ruumidigest

- aken fikseeritakse UTC-s (soovitus 6 h või üks päev; Tallinnat kasutatakse ainult UI kuupäevaks);
- üks event `(roomId, userId, windowStart)`;
- ainult aktiivne `RoomMember`, mitte sõnumi tekitaja;
- event ei sisalda sisu, saatja nime ega liikmete ID-sid;
- uus aktiivsus samas aknas ei loo uut kirja;
- ruumi read-toiming märgib sama ruumi adressaadi unread digest-event'id loetuks samas tx-is membership watermark'i nihutamisega;
- lahkunud või billing-access'i kaotanud liige ei saa uut event'i ega target-linki.

### 4.7 Read-semantika

- arrival: loetud pärast access-checked detaili avamist või U3 explicit accept'i;
- status event autorile: loetud explicit event click'i järel või sama source'i owner-scoped mark-read API-ga;
- invite: accepted/revoked/expired lõpetab unread oleku; lihtsalt võõra tokeni probe ei muuda midagi;
- room digest: ruumi read endpoint;
- match: osapoole access-checked match/room avamine;
- next-contact: explicit read või kuupäeva muutmine/eemaldamine;
- practice: assignment avamine või lõpetamine; lõpetamine sulgeb seotud unread event'i;
- availability: owneri teenuse availability review avamine või värskuse kinnitamine.

Mark-read endpoint ei võta suvalist `userId`-d. Late-response UI kasutab latest-request gate'i; mutation ise kasutab idempotentset `readAt = COALESCE(readAt, now)` või CAS-i.

### 4.8 Dashboard badge'id

Server tagastab ainult allowlist'itud kaardivõtmed ja arvud. `workspaceDashboardCards` praegune alias-mapper jääb esitlusadapteriks. Soovituslikud badge'id:

- `pre_inquiries`: adressaadi unread arrival/status work;
- `add_person`: aktiivsed room invite / room activity märgid või `rooms` alias;
- `journey`: aktiivne owner journey, kui UI otsustab seda markerina näidata;
- `wellbeing`: owner'i pooleli draft;
- `service_profile`: stale availability ownerile;
- `effective_practices`: assigned/overdue review ainult lubatud reviewerile.

Admin ei saa endpoint'ile teise user ID-d ette anda. Response on no-store.

### 4.9 „Jätka siit” kuni 7 kirjet ilma rollilekketa

Üks serveriteenus teeb iga allika kohta olemasoleva loendi õigusega samaväärse query. Ta ei tee laia admin query't ja ei filtreeri tulemusi alles serializeris.

Soovituslik deterministlik prioriteet:

1. tähtaja ületanud `nextContactOn`;
2. määratud overdue practice review;
3. saabunud/READY eelpöördumine vastuvõtjale;
4. unread room;
5. stale availability service ownerile;
6. enda DRAFT eelpöördumine;
7. enda unconfirmed wellbeing draft;
8. enda ACTIVE journey.

Igas rühmas: tähtpäev kasvavalt, muidu `updatedAt desc`, lõpuks `id asc`. Pärast serveripoolset õigusekontrolli võetakse esimesed 7. Response sisaldab `kind`, allowlist target, targetId, labelKey, timestamp/deadline ja badge group'i — mitte sisu ega teise inimese identiteeti.

### 4.10 Aktiivse checklist'i järgmise kontakti kuju

Praegune `receiverChecklist` on array ja normaliseerija väljastab ainult `{id,label,checked}`. Seetõttu ei ole olemasolev JSON-leping kuupäeva jaoks ühilduv ilma kogu kuju migratsioonita.

Soovitus:

```prisma
nextContactOn String?
@@index([recipientOwnerId, nextContactOn, status])
```

- server lubab ainult päris kalendrikuupäeva `YYYY-MM-DD`;
- tähendus on Europe/Tallinn local date, mitte UTC instant;
- serializer annab välja ainult recipient audience'ile;
- workflow mutation nõuab `expectedUpdatedAt`, U3 advisory lock'i ja värske rea CAS-i;
- kuupäeva muutmine/eemaldamine lõpetab vana aktiivse event'i samas tx-is;
- due scheduler arvutab Tallinnas päeva alguse/lõpu ning testib DST piire.

### 4.11 Merge-sõltuvused

| Pakett | Sõltuvus U1/U2-le | Otsus |
|---|---|---|
| U12/U3 | `openedAt`, recall, correction, supersession ja indeksid | merge enne eelpöördumise adapterit; **VAJAB PÄRAST MERGE’I UUESTI KONTROLLI** |
| U4 | availability väljad, serializer ja reminder dispatcher | merge enne availability adapterit; **VAJAB PÄRAST MERGE’I UUESTI KONTROLLI** |
| U8-lite | otsest v1 event'i pole, kuid schema/migration ja account cleanup regressioonid peavad koos püsima | merge-järgne migration/status kontroll; vana auditit ei korrata |
| P1 ops | scheduler ja assignment repair on commit'imata `main` tööpuus | stabiliseeri/commit'i enne practice adapterit |
| U10 | room-message writer on digest'i allikas | regressioon; eraldi merge-eeltingimus puudub |

Migratsiooninimed on praegu U3 `20260714220000_pre_inquiry_recall_and_correction`, U8-lite `20260714220000_source_feedback_trust_layer`, P1 `20260714230000_practice_ops_retry_and_justification` ja U4 `20260715003000_service_availability_freshness`. Sama timestamp'iga U3/U8 kataloogid vajavad merge-järgses clean-migration kontrollis deterministliku järjekorra kinnitamist.

### 4.12 Plaani ja aktiivse koodi konfliktid — Soli ja Opuse Etapp 0 koond

1. Plaan eelistas järgmise kontakti JSON-välja ilma migratsioonita; aktiivne JSON-kuju seda ohutult ei võimalda.
2. Plaan eeldas privaatset receiver workflow'd; aktiivne serializer lekitab selle autorile.
3. Plaan eeldas U4 reminder job'i; U4-l on praegu admin-POST dispatcher, mitte eraldi secret-gated job route.
4. Plaan eeldas room digest'i ühe sündmusena; aktiivsel koodil on vähemalt kolm roomMessage writer'it ja ainult timestamp-watermark.
5. Plaan eeldas practice markerist õigesti skoopitud reviewer event'i; `REVIEW_DUE` markeril pole määratud reviewer'it ning `ASSIGNMENT_OVERDUE` marker koondab assignment ID-d tsükli kaupa.
6. Plaan nõudis preference late-response ohutust; olemasolev latest-request gate kaitseb UI-d, kuid serveris puudub version/CAS preference objekt.
7. Plaan rääkis olemasoleva tööruumi koond-API laiendamisest; aktiivses koodis pole sellist päringut ega producer'it ning `ChatBody` ei anna badge'i prop'i edasi.
8. Badge mapper lubab numbrit ja tähelepanu, kuid aktiivne CSS kujundab kõik badge'id täpisuuruseks; liides vajab type-põhist integratsioonitesti.
9. Main-i receiver workflow on last-write-wins; U3 lock/CAS sulgeb paralleelse kirjutuse, kuid ei tõesta kliendi snapshot'i värskust. U2 peab lisama `expectedUpdatedAt` lepingu.
10. Plaan eeldas usaldusväärset delivery tulemust; praegune mailer võib tootmises SMTP puudumisel mock'iga edukalt lõpetada ja kogu kirja logida.

---

## 5. U1/U2 soovituslik teostusjärjekord pärast Etapp 0

1. Merge/commit alus: U3, U4, U8-lite ja P1 ops; clean migration check.
2. Sulge SOL-U1U2-P1-1 audience-aware eelpöördumise serializeriga pärast Opuse sõltumatut privaatsuskinnitust.
3. Sulge OPUS-U1U2-P1-2 tootmise maileri fail-closed ja logide PII regressioonitestidega.
4. Lisa `NotificationEvent`, preference väljad ja `PreInquiry.nextContactOn` additiivse migratsioonina.
5. Keskne notification service: allowlist, target builder, dedupe, owner read API, account deletion.
6. Same-transaction adapterid: pre-inquiry, invite, help match, review assignment; receiver workflow'le kliendi `expectedUpdatedAt`.
7. Scheduler adapterid: room digest, next-contact, practice overdue, U4 availability.
8. Delivery job koos fail-closed transport- ja ambiguous-send lepinguga.
9. Serveri badge/continue aggregator, `dashboardBadges` producer ja type-põhine UI.
10. UI, ET/EN/RU, preference CAS, latest-request gate, a11y.
11. Kohustuslikud integratsiooni-, concurrency-, privacy-, migration- ja täistestid; seejärel sõltumatu audit.

---

## 6. SOLI SISEND — U5/U6/U7/U9/U11 hetkeseisu audit aktiivse koodi vastu

See osa on Soli tehtud aktiivse koodi audit ja Opuse ülesande nr 3 lähtealus. Seda ei tohi märkida Opuse sõltumatult lõpetatud auditiks enne, kui Opus on leiud ise koodist üle kontrollinud, lahknevused jäädvustanud ja oma otsuse faili 12 progressipäevikusse kirjutanud.

### 6.1 U5 — teenusepuudujäägi märge ja anonüümne koond

**Seis: TEOSTAMATA; alusosad osaliselt olemas.**

**MAIN-IST KINNITATUD:** skeemis, API-s ja UI-s pole `ServiceGapReport` või samaväärset objekti. Teenusekaardi nulltulemusest puudujääki salvestada ei saa.

**MAIN-IST KINNITATUD:** taaskasutatavad osad on olemas:

- help category ja municipality registrid;
- `lib/privacy/piiFilter.js` / privacy confirmation muster;
- `lib/wellbeing/aggregate.js` minimum-distinct-users suppression;
- teenusekaardi filtrid ja empty-state pinnad.

**HARUST KINNITATUD — U4:** availability eristab stale/unknown/not-accepting teenust, kuid pole veel `main`-is. U5 ei tohi lugeda „teenus ei võta praegu vastu” automaatselt „teenust pole piirkonnas”.

Väikseim ohutu vertikaal pärast U4 merge'i:

- authenticated specialist/provider endpoint;
- ainult category + municipality; free-text märkus jätta esimesest lõikest välja või lubada alles privacy-confirmation järel;
- `reporterUserId` FK pseudonüümse dedupe'i ja account deletion cascade'i jaoks, kuid üksikuid ridu ei väljastata adminile;
- uniqueness üks raport kasutaja/kategooria/KOV/perioodi kohta;
- adminile ainult k-summutatud aggregate; alla läve ei väljastata isegi kategooriavõtmeid;
- rate limit, no case/preInquiry/client link;
- avalik/KOV vaade on eraldi tooteotsus, mitte v1.

Tooteotsused: kes aggregate'i näeb ja k-lävi. Soovitus v1: ainult admin, `k >= 5`, mitte avalik.

### 6.2 U6 — isiklik otsing enda objektide üle

**Seis: TEOSTAMATA; ainult kitsas kliendifilter olemas.**

**MAIN-IST KINNITATUD:** `ChatSidebar` filtreerib brauseris ainult juba laaditud vestlusi `title + preview + id` järgi. Conversations GET-il on limit/cursor/role, kuid `q` puudub. Ruumide, dokumentide, eelpöördumiste ja Teekondade ühist otsingut pole.

Omanikuskoobid on allikteenustes olemas, kuid neid ei tohi asendada ühe laia OR-päringuga. Väikseim ohutu vertikaal:

- `/api/workspace/search?q=...&limit=...`;
- neli eraldi serveriküsimust: owner conversations, owner document titles, author pre-inquiry topic, owner journey title/summary metadata;
- tulemused rühmitatud tüübiti, kogulimiit ja per-type limiit;
- ei otsi received pre-inquiry body't, private wellbeing teksti ega võõra room'i sisu;
- v1 alustab metadataotsingust. Conversation message content search lisatakse alles eraldi jõudlus- ja snippet-privaatsustestidega;
- Postgres ILIKE on v1 jaoks piisav; pg_trgm ainult mõõdetud vajadusel.

### 6.3 U7 — selge keele režiim

**Seis: TEOSTAMATA, kuid kõige tugevama olemasoleva alusega.**

**MAIN-IST KINNITATUD:** AccessibilityProvider salvestab kohaliku/cookie preference objekti (UI profile, contrast, reduce motion/transparency, theme). Selge keele boolean puudub.

**MAIN-IST KINNITATUD:** chat'i prompt builder toetab lokaliseeritud base prompti ja serveri loodud extra-system instruktsioone. Chat request ei kanna selge keele eelistust.

**MAIN-IST KINNITATUD:** dokumentide generation juba tunneb `tone = plain` ning tõlgib selle `plain-language and easy to follow` juhiseks. See on taaskasutatav, kuid pole seotud globaalse preference'iga.

**MAIN-IST KINNITATUD:** teenuseprofiili `communication_support_options.simple_language` kirjeldab teenuseosutaja tuge, mitte kasutaja UI-režiimi; seda ei tohi segi ajada U7 eelistusega.

Väikseim turvaline vertikaal ei vaja uut DB mudelit. V1 võib lisada `plainLanguage: boolean` olemasolevasse a11y localStorage/cookie lepingusse, serverile saadetakse ainult boolean. Kontoülene/multi-device sync on hilisem otsus.

### 6.4 U9 — tugiisiku kaasamise rada

**Seis: OSALISELT OLEMAS, kasutusleping puudulik.**

**MAIN-IST KINNITATUD:** CLIENT tööruumis on juba kaart `Lisa inimene`; InviteModal võib luua ruumi või kutsuda olemasolevasse ruumi. Server kontrollib owner/moderator rolli, kutse aegumist, konto e-posti, subscription/sponsorlust ja loob ainult selle ruumi liikmelisuse.

**MAIN-IST KINNITATUD:** klassikaline InviteModal ei saada `relationship_type`; API default on `COLLEAGUE`. Seega pöörduja „Lisa inimene” ei jää andmetes tugiisiku/CLIENT suhteks. UI ega e-kiri ei selgita, et kutsutu näeb ainult valitud ruumi, mitte Teekonda, isiklikke vestlusi, dokumente või teisi ruume.

Väikseim vertikaal on endiselt peamiselt UI/i18n:

- CLIENT rollis kaart „Kutsu tugiisik”;
- enne saatmist selge scope-copy;
- `relationship_type: CLIENT` serveripayloadis ja testis;
- kutsekiri ET/EN/RU lihtsas keeles;
- olemasolev room membership jääb ainsaks õiguseks;
- ametlik esindusõigus, volitus ja kontoülene ligipääs jäävad rangelt välja.

### 6.5 U11 — töö üleandmine kolleegile

**Seis: TEOSTAMATA ning algne „kaks kitsast PATCH-i” hinnang on liiga optimistlik.**

**MAIN-IST KINNITATUD:** eelpöördumise recipient update on autori edit-flow osa ja pärast canonical room'i olemasolu teadlikult keelatud, et uus adressaat ei päriks vana adressaadi ruumi. Eraldi transfer flow puudub.

**MAIN-IST KINNITATUD:** room owner on dubleeritud `Room.ownerId` ning `RoomMember.role = OWNER` kujul. Transfer peab neid muutma atomically, vältima null või kahte aktiivset owner'it, säilitama billing/sponsor lepingud ja auditeerima mõlemad pooled.

Väikseim ohutu U11 vertikaal vajab:

- ainult käsitsi valitav kolleeg, kelle `acceptsPreInquiries = true`;
- eelpöördumise transfer advisory lock'i all, värske CAS, audit ja U1 läbipaistvussündmus autorile;
- kui canonical room on olemas, kas uus adressaat lisatakse teadliku uue liikmena ja vana adressaadi liikmelisuse saatus otsustatakse, või transfer keelatakse. Vaikne owner-ID vahetus pole lubatud;
- room ownership transfer ühe transactioniga, täpne billing/sponsor invariant ja audit;
- org/juhi massjaotus, automaatne asendaja ja ametlik volitus jäävad v1-st välja.

U11 ei tohiks alata enne U1 notification/transparency kihti ja eraldi tooteotsust vana adressaadi ruumiligipääsu kohta.

---

## 7. SOLI SISEND — U7 järgmise tööplaani jaoks

See osa on Soli soovituslik sisend, mitte Opuse lõpetatud ülesanne nr 4. Opus peab pärast §6 sõltumatut U7 hetkeseisu kontrolli kinnitama või parandama ulatust, privaatsuspiire ja teostusplokke.

### 7.1 Soovitatud ulatus

U7 v1 on üks esitus-eelistus, üks serveri prompt-adapter ja kaks minimaalset UI tarbijat. Ta ei loo eraldi lihtsat rakendust ega muuda retrieval'i, allikavalikut, õigusi või alussisu.

### 7.2 Teostusplokid

1. **U7-0 leping ja kvaliteedimaatriks**
   - `plainLanguage` on boolean, mitte vabatekstiline prompt;
   - režiim säilitab faktid, õigusliku täpsuse, ebakindluse, allikad ja kriisijuhised;
   - ET/EN/RU instruktsioonid; „selge keel” tähendab vastava UI-keele lihtsat varianti;
   - defineeri 10–20 golden sisendit: õigused, tähtajad, KOV teenus, kriis, dokumendiselgitus, eelpöördumine.

2. **U7-A preference**
   - lisa `plainLanguage` `DEFAULT_PREFS`-i, cookie/localStorage parse'i, DOM dataset'i ja AccessibilityModalisse;
   - server render ei pea selle tõttu tundlikku kasutajainfot lugema;
   - existing prefs migration: puuduva välja fallback `false`;
   - a11y: lüliti nimi ja selgitus, mitte ainult ikoon.

3. **U7-B chat**
   - `ChatBody` saadab ainult normaliseeritud booleani;
   - request bootstrap loeb selle allowlist'itud väljalt;
   - prompt builder lisab lokaliseeritud `PLAIN_LANGUAGE_MODE` extra-system instruction'i;
   - instruction: lühikesed laused, üks mõte lõigus, konkreetsed sammud, seletatud terminid; ei tohi eemaldada tingimusi, erandeid, allikaviiteid ega uncertainty't;
   - prompt injection test: caller ei saa boolean välja kaudu teksti sisestada.

4. **U7-C juhendatud eelpöördumine**
   - sama andmemudel ja küsimused;
   - väiksem samaaegselt avatud plokkide arv, selgemad sammud;
   - ei peideta consent/privacy/risk kontrolli ega kohustuslikke välju;
   - režiim ei muuda salvestatud eelpöördumise sisu iseseisvalt.

5. **U7-D dokumendid ja U10 integratsioon**
   - kui kasutaja pole tooni teadlikult valinud, võib `plainLanguage=true` pakkuda `tone=plain` default'i;
   - explicit document tone võidab globaalse eelistuse;
   - U10 client-audience meeting summary võib kasutada sama eelistust ainult spetsialisti kinnitamise eelvaates.

6. **U7-E i18n, UI ja testid**
   - ET/EN/RU key parity;
   - reducer/persistence/hydration testid;
   - request-to-prompt integration test;
   - allikate säilimise ja legal/crisis invariant testid;
   - pre-inquiry density UI contract test;
   - latest-request/hydration ei tohi lülitit tagasi hüpitada.

### 7.3 Privaatsus- ja turvapiirid

- preference ei anna uusi andmeõigusi;
- server ei logi preference'iga koos kasutaja küsimust uude kohta;
- plain-language instruction on serveri allowlist'itud konstant;
- allikad, kuupäevad, tingimused ja negatiivse väite ettevaatus jäävad muutmata;
- lihtsam sõnastus ei tohi muutuda otsuseks inimese eest;
- kriisi- ja emergency sõnumid säilitavad olemasoleva prioriteedi.

### 7.4 Valmisoleku kriteerium

U7 on valmis siis, kui preference püsib refresh'i järel, chat kasutab seda tõendatult, eelpöördumise vaade vähendab korraga nähtavat koormust ilma infot peitmata, ET/EN/RU on võrdsed ning golden testid näitavad, et faktid/allikad/erandid ei kao. Mudeli subjektiivset „ilusamat teksti” ei loeta üksi tõendiks.

---

## 8. SOLI SISEND — U1–U12 ajakohastamiseks

Selle Soli auditi põhjal peaks koondseisu järgmine muutus olema alljärgnev. Tabel katab ainult käesolevas ringis kontrollitud seitset tööd ega ole Opuse ülesandes nr 5 nõutud täielik U1–U12 progressihinnang. Opus peab kontrollima kõik kaksteist rida ja uuendama kanoonilist koondseisu failis 10.

| ID | Uus tõendatud seis |
|---|---|
| U1 | TÖÖPLAAN + ETAPP 0 VALMIS; teostamata; SOL-U1U2-P1-1, OPUS-U1U2-P1-2 ja merge-sõltuvused ees |
| U2 | TÖÖPLAAN + ETAPP 0 VALMIS; teostamata; `nextContactOn` skeemiotsus tehtud, serializer blocker ja stale-client CAS ees |
| U5 | TEOSTAMATA; aggregate/privacy alus olemas; ootab U4 merge'i ja k-läve otsust |
| U6 | TEOSTAMATA; ainult laetud vestluste kliendifilter olemas |
| U7 | TEOSTAMATA; tugevad a11y/prompt/plain-tone liidesed olemas; järgmise plaani sisend valmis |
| U9 | OSALISELT OLEMAS; room invite mehaanika olemas, tugiisiku semantika/scope-copy puudub |
| U11 | TEOSTAMATA; vajab rohkem kui kaks PATCH-i ning sõltub U1-st |

U3/U12, P1, U4 ja U8-lite aktsepteeritud paranduste märgend jääb kasutaja otsuse järgi: `SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA`, välja arvatud U12/U3 eraldiseisev varasem `OPUS HEAKS KIIDETUD` auditiotsus seal, kus see juba dokumenteeriti. Käesolevad uued SOL-U1U2-P1-1 ja OPUS-U1U2-P1-2 on U1/U2 eeltingimused ega muuda tagantjärele kasutaja aktsepteerimismärgendit.

---

## 9. Täpne jätkamispunkt

### 9.1 Tegelik tööjaotus

- Opuse U1/U2 Etapp 0 eelkaardistus: **tehtud ja Soli kaardistusega koondatud**.
- Opuse eraldi U1/U2 privaatsusring: **tehtud**; `SOL-U1U2-P1-1` kinnitatud ja laiendatud konto-e-posti lekkega (§11).
- Opuse U5/U6/U7/U9/U11 sõltumatu aktiivse koodi audit: **tehtud** (§12).
- Opuse U7 tööplaani sisend: **tehtud** (§13).
- Opuse täielik U1–U12 progressihinnang: **tehtud** failis 10 ning integratsioonijärgselt lepitatud.
- Rakenduskood/skeem/migratsioonid: **muutmata**.
- Opuse auditidokkide commit/push: **tegemata Opuse tööplokis**; Sol tõstis need hiljem eraldi harule. Rakenduse integratsioon/deploy on §14 järgi tehtud.

### 9.2 Opuse järgmine lubatud samm

Opuse ülesanded 1–5 on lõpetatud. Järgmine Opuse töö on Soli U1/U2 teostuse sõltumatu doc 10 §16 audit pärast seda, kui Sol on paketi testinud ja üle andnud. U7 audit algab eraldi ainult siis, kui U7 teostus käivitatakse.

### 9.3 Soli järgmine lubatud samm pärast Opuse üleandmist

Opuse ülesanded 2–5 ning U3, U4, U8-lite ja P1 integratsioon on lõpetatud. Alusta värskest `origin/main`-ist eraldi Soli worktree/harus. Esimesed koodiparandused peavad sulgema **SOL-U1U2-P1-1** + **OPUS-U1U2-P1-1-EXT** ja **OPUS-U1U2-P1-2**, mitte alustama `NotificationEvent` migratsioonist: vastasel juhul ehitatakse privaatne järgmise kontakti info lekkiva serializeri ning delivery näiliselt õnnestuva transpordi peale.

Esimesed täpsed failid/funktsioonid:

1. `lib/preInquiries.js` — `serializePreInquiry`, `listVisiblePreInquiries`, U3-järgne accept/workflow/correction response;
2. `app/api/pre-inquiries/route.js` ja `app/api/pre-inquiries/[id]/route.js` — viewer context;
3. uued author-vs-recipient privacy ja stale-client `expectedUpdatedAt` regressioonitestid;
4. `lib/mailer.js` — production fail-closed, dev-mock opt-in/redaction ning delivery-truth testid;
5. alles seejärel `prisma/schema.prisma` + uus additiivne U1/U2 migratsioon;
6. `lib/workspaceDashboardCards.js` tarbija jääb alles; producer ja type-põhine CSS lisatakse pärast serverikoondit.

### 9.4 Enne teostust kinnitatavad päris tooteotsused

1. Millised e-kirjatüübid on legacy/transactional ja millised järgivad uut optional preference'it?
2. Kas ambiguous SMTP `SENDING` on fail-closed `UNKNOWN` (soovitus) või auto-retry võimaliku duplikaadiga?
3. Kes saab avaldatud praktika `REVIEW_DUE` kasutajamärguande, kui määratud reviewer puudub?
4. U5 admin aggregate'i k-lävi ja nähtavus (soovitus ainult admin, `k >= 5`).
5. U11 canonical room'i olemasolul vana ja uue adressaadi liikmelisuse täpne leping.

Kõik muud siin kirjeldatud tööd on tehniliselt jätkatavad pärast merge-eeltingimusi; täiendavat üldist eelkaardistusringi ei ole vaja.

---

## 10. Read-only lõppkontroll

Pärast dokumendi koostamist jooksutati olemasoleva aktiivse koodi vastu üheksa seotud testifaili:

- pre-inquiry internal arrival email;
- recipient/canonical-room lock;
- source Journey link;
- pre-inquiry room dedupe ja ordering;
- meeting-summary room share;
- wellbeing aggregate ja export suppression;
- wellbeing API contracts;
- chat prompt style.

Tulemus: **73/73 testi läbis, 0 ebaõnnestumist**.

Lisaks käivitati `serializePreInquiry()` minimaalse receiver-private näitega. Runtime-vastus sisaldas nii `receiverNote` kui `receiverChecklist` välja, kinnitades SOL-U1U2-P1-1 mitte ainult tekstivaatluse, vaid päris eksporditud funktsiooni käitumisega.

Koondamisel kontrolliti aktiivsest koodist eraldi maileri production fallback'i, kõik välised `getMailer()` kutsekohad, `dashboardBadges` prop'i andmevoog, badge'i CSS ning receiver workflow mutation. Need tõendid lisasid OPUS-U1U2-P1-2 ja täpsustasid badge'i ning stale-client concurrency lepingut; rakenduskoodi ei muudetud.

`git diff --check` ei leidnud tracked tööpuu whitespace-vigu. Käesoleva auditi ainus loodud fail on see dokument; kõik teised `git status` muudatused olid tööpuus enne auditi dokumenteerimist ning neid ei muudetud.

---

## 11. OPUSE SÕLTUMATU KONTROLL — ülesanne 2 (arhitektuuri- ja privaatsusring)

> Read-only. Kontrollisin faili 13 leiud ise koodist üle. Allpool on **Opuse otsused ja lahknevused**, selgelt eristatuna Soli sisendist.
> Kuupäev: 2026-07-14. Baas: `main` @ `df2f45c0` + commit'imata P1 diff.

### 11.1 SOL-U1U2-P1-1 — **OPUS KINNITAB. Leid on tõene ja ulatuselt LAIEM kui kirjeldatud.**

Kontrollisin kogu tõendiahela ise, rida-realt:

| Soli väide | Opuse kontroll | Tulemus |
|---|---|---|
| `serializePreInquiry` ei võta `viewerId` | `lib/preInquiries.js:487` — üks argument, vaatajakonteksti ei ole | KINNITATUD |
| serializer lisab `receiverNote`/`receiverChecklist` | `:503` ja `:504` | KINNITATUD |
| `listVisiblePreInquiries` annab sama kuju mõlemale | `:548–559` → `visiblePreInquiryWhere` (`:539–546`) = `OR: [{authorId}, {recipientOwnerId}]` → `inquiries.map(serializePreInquiry)` | KINNITATUD |
| detail-GET serialiseerib sama moodi | `app/api/pre-inquiries/[id]/route.js:45–51` → `getVisiblePreInquiry` (sama OR-skoop) → `serializePreInquiry` | KINNITATUD |
| UI kirjeldab seda vastuvõtja töövaatena | `WorkspaceFeaturePage.jsx:934` klient-filter `recipientOwnerId === currentUserId`; `:1037` täidab `receiverNoteDraft` ainult `activeReceivedInquiry`-st; `:945` `showReceivedInquiries = isRecipientRole` | KINNITATUD |

**Opuse täpsustus mõjule:** leke on **puhtalt API-tasemel** — UI ei renderda märget autorile. See teeb leiust õpikunäite doc 10 §3.4 kohta („UI peitmine ei ole õigusekontroll"): `GET /api/pre-inquiries` tagastab autorile tema enda pöördumise real vastuvõtja sisemise märkme (kuni 8000 tähemärki, `normalizePreInquiryReceiverNote`) ja checklisti oleku.

**OPUS-U1U2-P1-1-EXT — sama juur, laiem leke (Soli kirjeldusest puudu).** Sama vaatajakontekstita serializer väljastab ka **mõlema poole konto-e-postid**:

- `:522–528` `author: { id, email, role }` → **vastuvõtjale**;
- `:529–535` `recipientOwner: { id, email, role }` → **autorile**.

Need ei ole juhuslikud: `preInquiryInclude` valib nad eksplitsiitselt (`author.select.email`, `recipientOwner.select.email`) ja `getVisiblePreInquiry` kasutab sama include'i **mõlema poole jaoks**. Seega autor saab spetsialisti **konto-e-posti**, mis ei ole sama, mis teenusekaardi avalik kontakt.

Miks see U1/U2-le loeb: doc 10 §3 keelab teise inimese identifikaatorid ja e-posti aadressid nii sündmuse payloadis, e-kirjas kui „Jätka siit" DTO-s (§10.1). Kui U2 koond ehitatakse selle serializeri peale, pärib ta lekke. Audience-leping peab e-postid **teadlikult otsustama**, mitte vaikimisi kaasa võtma.

**Opuse nõue sulgemisele (täiendab Soli §3.4 nimekirja):**

- audience-leping peab katma ka `author.email` ja `recipientOwner.email` — otsustada, kumb pool millist identifikaatorit näeb, ja see testiga lukustada;
- vaikesoovitus: kumbki pool ei saa teise **konto-e-posti**; vastuvõtja näeb autorit opaque ID/kuvanime kaudu, autor näeb adressaati teenusekaardi avaliku kontakti kaudu (`recipientEntry.email`, mis on juba avalik).

**Opuse hinnang teostuskulule: leid on ODAV sulgeda.** Kontrollisin: **ükski test ei lukusta praegust lekkivat kuju** (`tests/preInquiries/*` seavad `receiverNote: null` ainult fixture'ites). Audience-lepingu lisamine ei lõhu olemasolevaid teste.

**Opuse klassifikatsioon:** P1 **U2 eeltingimusena** — nõustun Soliga. **Ei ole P0:** mõlemal poolel on pöördumisele endale legitiimne ligipääs, ristkasutaja leket ei ole. See on **pre-existing viga, mitte U1/U2 sisse toodud** — seega ei blokeeri U1-A tuuma, vaid U2 järgmise kontakti välja, täpselt nagu Sol ütles.

### 11.2 Privaatsuslepingu (doc 10 §3) kontroll aktiivse koodi vastu

| § | Nõue | Aktiivse koodi seis | Otsus |
|---|---|---|---|
| 3.3 | „Võõrast ja puuduvat privaatset objekti ei eristata" | **juba korrektne pretsedent:** `getVisiblePreInquiry` teeb `findFirst` koos omanikuskoobiga → võõras JA olematu annavad mõlemad `null` → sama 404. U1 peab sama mustrit järgima. | MAIN-IST KINNITATUD |
| 3.8 | Tööheaolu mustand jääb rangelt omanikule | `WellbeingOutputDraft` on alati `userId` skoobis; „Jätka siit" kandidaat = `status="draft"`, `userConfirmed=false` | MAIN-IST KINNITATUD |
| 3.9 | Praktika privaatne retsensendimärkus ei tohi jõuda sündmusesse | `REVIEW_DUE`/`ASSIGNMENT_OVERDUE` metadata kannab ainult ID-sid, versioone ja loendureid; `justification` on eraldi `REVIEW_JUSTIFICATION` real, mida adapter ei puuduta | commit'imata P1-st kinnitatud |
| 3.2 | E-kirja minimaalsus | **juba olemas ja korrektne:** `buildInternalArrivalEmail` (`:1109`) = pealkiri + sisselogimislink + „sisu on nähtav ainult sisse logides"; aadress loetakse saatmise hetkel (`:1128`), mitte ei salvestata | MAIN-IST KINNITATUD |
| 3.4 | „UI peitmine ei ole õigusekontroll" | **rikutud juba täna** — vt §11.1 | P1 |

### 11.3 Opuse arhitektuurilised lahknevused Soli §4.4 skeemist

Nõustun põhikujuga (String-allowlist, `dedupeKey @unique`, `onDelete: Cascade`, ei mingit `metadata Json`). **Neli täpsustust:**

1. **`occurredAt` on üleliigne — Opus soovitab eemaldada.** Soli §4.2 ütleb ise, et tulevase kuupäeva salvestamisel *ei looda* veel „tähtaeg käes" sündmust, vaid due scheduler loob selle siis, kui tähtaeg saabub. Seega `occurredAt == createdAt` **alati**. Kaks ajatemplit sama fakti kohta kutsuvad triivi. Kasuta `createdAt` (repo konventsioon kõigil mudelitel).
2. **`emailClaimToken` ei teeni ühtegi lepingut — Opus soovitab eemaldada.** CAS-claim on täielikult tehtav `updateMany({ where: { id, emailStatus: "PENDING" }, data: { emailStatus: "SENDING" } })` → `count === 1`. Token oleks vajalik ainult siis, kui stale `SENDING` **taastatakse automaatselt** ja tuleb eristada, milline worker seda hoiab. Aga Soli enda §4.5 p7 otsustab, et stale `SENDING` → `UNKNOWN` **ilma auto-resendita**. Ilma auto-taasteta ei ole tokenil tarbijat. (U4 pretsedent CASib samuti eelmiste väärtuste vastu, ilma tokenita.)
3. **Kolmas indeks on vale võtme peal — Opuse parandus.** Sol pakub `@@index([userId, targetKind, targetId, readAt])`. Aga Soli enda §4.7 read-semantika märgib sündmusi loetuks **allika**, mitte sihi järgi: ruumi read-toiming märgib *selle ruumi* sündmused (`sourceId = roomId`), assignmenti lõpetamine *selle assignmenti* sündmuse. Õige indeks on **`@@index([userId, sourceType, sourceId, readAt])`** — see teenib nii read-markingut kui „kas sellel allikal on juba sündmus".
4. **`emailMessageId` on põhjendatud, aga toob sõltuvuse.** Selle täitmiseks peab `lib/mailer.js` aktsepteerima kutsuja antud `Message-ID`-d — praegu genereerib mailer `Date.now() + Math.random()`. See on **sama fail**, mida OPUS-U1U2-P1-2 niikuinii peab muutma → tee mõlemad ühes ringis.

### 11.4 Opuse otsus OPUS-U1U2-P1-2 kohta

Jään väite juurde ja täpsustan ühte numbrit: Sol kirjutab „17 välist `getMailer()` kutsekohta"; minu enda kaardistus leidis **15 kutsujat** (`lib/` + `app/`). Erinevus ei muuda järeldust ega prioriteeti — number tuleb üle lugeda ainult siis, kui keegi seda kuskil lepinguna kasutab. Olulisem fakt U1-C jaoks: **ükski kutsuja ei oma delivery-claimi ega idempotentsust.**

### 11.5 Ülesande 2 verdikt

- **SOL-U1U2-P1-1: OPUS KINNITAB** + laiendan (`OPUS-U1U2-P1-1-EXT`: mõlema poole konto-e-postid samas serializeris).
- **OPUS-U1U2-P1-2:** kehtib muutmata.
- **Uusi P0 ei leitud.** Mõlemad P1-d on **U2 ja U1-C eeltingimused**, mitte U1-A tuuma blokeerijad.
- Neli arhitektuurilist täpsustust (§11.3) on **Opuse otsused**, mis erinevad Soli §4.4 sisendist.

---

## 12. OPUSE SÕLTUMATU AUDIT — ülesanne 3 (U5/U6/U7/U9/U11 aktiivse koodi vastu)

> Kontrollisin Soli §6 iga väite ise koodist. **Kõik Soli väited pidasid paika** — allpool on kinnitus + kolm Opuse täiendust/lahknevust.
> Baas: `main` @ `df2f45c0`. Read-only.

### 12.1 Kinnitused (Soli §6 väited, minu kontroll)

| Töö | Soli väide | Opuse tõend | Otsus |
|---|---|---|---|
| U5 | `ServiceGapReport` või samaväärset ei ole | `grep` skeemis = **0 vastet** | KINNITATUD |
| U5 | taaskasutatavad osad olemas | `lib/privacy/piiFilter.js` ✓; `lib/wellbeing/aggregate.js:36/116/140` — `resolveWellbeingMinimumGroupSize` + `suppressed: sampleSize < minimumGroupSize` ✓ | KINNITATUD |
| U6 | conversations GET-il pole `q` | `app/api/chat/conversations/route.js:135/137/140` — ainult `limit`, `cursor`, `role` | KINNITATUD |
| U6 | `ChatSidebar` filtreerib brauseris `title + preview + id` | `components/ChatSidebar.jsx:626–633` — `haystack = [item.title, item.preview, item.id].join(" ").toLowerCase()` → `.includes()` | KINNITATUD |
| U7 | a11y prefs olemas, selge keele boolean puudub | `AccessibilityProvider.jsx:12` `DEFAULT_PREFS` ✓; `plainLanguage` = **0 vastet** kogu repos | KINNITATUD |
| U7 | dokumendid tunnevad juba `tone = plain` | `lib/documents/generation.js:25` `AGENT_TONE_VALUES = Set(["professional","supportive","plain"])`; `:41` `if (tone === "plain") return "plain-language and easy to follow"` | KINNITATUD |
| U9 | InviteModal ei saada `relationship_type`; API default COLLEAGUE | kliendi POST (`components/invite/InviteModal.jsx:298–305`) = `{ emails, lang, payment_mode, room_id, room_title, host_display_name }` — **puudub**; API loeb selle (`app/api/invites/route.js:477`), skeemis `enum RelationshipType { COLLEAGUE, CLIENT }` + `@default(COLLEAGUE)` | KINNITATUD |
| U11 | room owner on dubleeritud | `Room.ownerId` (`schema:2710`) **JA** `RoomMember.role RoomRole @default(MEMBER)`, `enum RoomRole { OWNER, MODERATOR, MEMBER }` | KINNITATUD |
| U11 | adressaadi vahetus on ruumi olemasolul keelatud | `lib/preInquiries.js:803` `assertRecipientChangeAllowed` → `:810` `recipient_locked_by_room`, kutsutud `:876` | KINNITATUD |

### 12.2 OPUSE LAHKNEVUS 1 — U9 väärtuspakkumine on Soli sõnastuses üle hinnatud

Sol soovitab U9 v1-s „`relationship_type: CLIENT` serveripayloadis ja testis". Kontrollisin, **kes seda välja loeb**:

- kirjutatakse: `app/api/invites/route.js:477` (normaliseerimine), `:518` (create);
- valitakse vastusesse: `:355`, `:533`;
- **loetakse otsuses: MITTE KUSAGIL.** Kõik `=== "CLIENT"` vasted koodibaasis (`lib/authz.js:89`, `lib/chat/conversationRoles.js:5`, `lib/chat/documentOrchestration.js:11/19/134`) puudutavad **`Role`/flow-rolli**, mitte `Invite.relationshipType`-i.

**Opuse otsus:** `Invite.relationshipType` on täna **kirjutuse-ainult väli ilma tarbijata**. `CLIENT` seadmine ei muuda ühtegi õigust ega käitumist. See ei ole viga — Sol ütleb õigesti, et „olemasolev room membership jääb ainsaks õiguseks" — kuid see tähendab, et **U9 v1 kogu kasutajaväärtus on selgituses (kaart + scope-copy + kutsekiri), mitte mehhanismis**. Nii tuleb see ka tööplaanis sõnastada, et keegi ei arvaks, et `CLIENT` lipp midagi kaitseb. Testi, mis kinnitab `relationship_type: CLIENT`, tuleb ausalt nimetada tuleviku-metaandme lepinguks, mitte turvatestiks.

### 12.3 OPUSE LAHKNEVUS 2 — U6 praegune otsing ei ole ainult „kitsas", vaid **eksitav**

Sol kirjutab: „`ChatSidebar` filtreerib brauseris ainult juba laaditud vestlusi". See on tõsi, aga tagajärg on tugevam kui „kitsas filter":

- filter jookseb `sortedConversations` = `items` peal, mis on **ainult juba laetud leht** (`conversations` GET `limit` vaikimisi **30**, `:135`, cursor-lehitsemine);
- kasutaja, kellel on 200 vestlust, otsib „eluase" ja saab **tühja tulemuse**, kuigi vestlus on olemas — lihtsalt teisel lehel;
- otsingukast tühjendatakse vaate vahetamisel (`:282–286`) ja **ruume ei filtreerita üldse** (`currentItems = isConversationView ? filteredConversations : sortedRooms`).

**Opuse otsus:** U6 ei ole „nice-to-have laiendus" — praegune käitumine annab **vale negatiivse vastuse**, mis on usaldusmudeli seisukohalt halvem kui otsingu puudumine. Tõstab U6 prioriteeti Soli hinnangust kõrgemale (vt §12.5).

### 12.4 OPUSE TÄIENDUS 3 — U6-l on juba tõestatud serveripoolne otsingumuster

Sol ütleb „Postgres ILIKE on v1 jaoks piisav". Täpsustan: **mustrit ei pea leiutama** — `lib/covisionCompletedCases.js:391–392` teeb juba täpselt seda, mida U6 vajab: mitme välja `OR` + `contains: normalized.q, mode: "insensitive"` **omaniku-/õigusskoobi sees**. U6 peaks selle kuju kopeerima, mitte uut disainima. (`lib/chat/retrievalContextAssembler.js:207` kasutab sama `mode: "insensitive"` konventsiooni.)

### 12.5 Opuse hinnang: keerukus, sõltuvused ja järjekord

| Töö | Opuse seis | Sõltuvus U1/U2-st | Keerukus | Paralleelselt? |
|---|---|---|---|---|
| **U6** | TEOSTAMATA; praegune filter annab vale negatiivse | **puudub** | **väike** (üks endpoint + 4 skoobitud päringut; muster olemas) | **jah** — ei puuduta U1/U2 faile |
| **U7** | TEOSTAMATA, tugevaim alus | puudub | väike–keskmine | jah (a11y + prompt-kiht) |
| **U9** | OSALISELT; ainult copy/UX puudu | soovituslik (läbipaistvussündmus) | **väike** (UI/i18n + 1 väli) | jah |
| **U5** | TEOSTAMATA | puudub; **sõltub U4 merge'ist** | keskmine (uus mudel + k-summutus + tooteotsus) | jah, pärast U4 |
| **U11** | TEOSTAMATA; „kaks PATCH-i" on vale hinnang | **jah — vajab U1 läbipaistvussündmust** | **suur** (owner-duplikaat + billing/sponsor invariandid + ruumiligipääsu tooteotsus) | ei |

**Opuse soovitatud järjekord pärast U1/U2:** U7 (lukus otsus) → **U6** (odav, parandab vale negatiivse) → U9 (odav copy/UX) → U5 (pärast U4) → U11 (viimane, sõltub U1-st + tooteotsusest).

**Lahknevus Soli järjekorrast:** Sol ei prioriseeri U6-t eraldi. Mina tõstan selle kohe U7 järele, sest see on väikseima kuluga leid, mis parandab **aktiivselt eksitavat käitumist**, mitte ei lisa uut võimekust.

---

## 13. OPUSE U7 TÖÖPLAANI SISEND — ülesanne 4

> See on **Opuse oma sisend**, koostatud pärast §12.1 sõltumatut U7 kontrolli. Kinnitan Soli §7 põhistruktuuri ja lisan neli muudatust.

### 13.1 Kinnitan Soli §7-st

Ulatus (üks esitus-eelistus + üks serveri prompt-adapter + kaks UI-tarbijat), plokid U7-0…U7-E, privaatsuspiirid (§7.3) ja valmisoleku kriteerium (§7.4) on **õiged ja koodiga kooskõlas**. Eriti kinnitan:

- `plainLanguage` **ei vaja uut DB mudelit** — `AccessibilityProvider` cookie/localStorage leping on olemas ja kannab juba nelja eelistust;
- serverile saadetakse **ainult boolean** — see on ainus prompt-injection-kindel kuju;
- `tone = plain` (`generation.js:41`) on päris taaskasutatav alus, mitte oletus.

### 13.2 Opuse muudatus 1 — golden-testid vajavad *negatiivset* invarianti, mitte ainult „faktid säilivad"

Soli §7-0 nõuab 10–20 golden sisendit ja §7-E „allikate säilimise ja legal/crisis invariant testid". Täpsustan mõõdetavaks: iga golden-juhtumi kohta peab test kinnitama **konkreetsete tokenite säilimist**, mitte inimhinnangut:

- kõik lähtevastuses olnud allikaviited on ka plain-vastuses (hulgavõrdlus, mitte „umbes sama");
- kõik tähtajad/numbrid/tingimuslaused (`kui`, `välja arvatud`, `ainult juhul`) säilivad;
- ebakindluse markerid ei kao (`võib`, `ei pruugi`);
- kriisijuhised säilivad **sõna-sõnalt** (konstantne tekst, mitte mudeli ümbersõnastus).

Põhjendus: „mudeli subjektiivset ilusamat teksti ei loeta tõendiks" (Soli §7.4) on õige põhimõte, aga ilma masinloetava invariandita ei ole see testitav.

### 13.3 Opuse muudatus 2 — U7-D on skoobist välja

Sol paneb U7-D-sse „dokumendid ja U10 integratsioon": `plainLanguage=true` võib pakkuda `tone=plain` vaikeväärtuse. **Opus soovitab selle v1-st välja jätta.**

Põhjendus: `tone` on **dokumendi omadus**, `plainLanguage` on **lugeja omadus**. Nende sidumine tähendab, et üks kasutaja eelistus muudab vaikimisi teise inimese jaoks loodud artefakti (U10 kokkuvõte pöördujale). See on väike, aga päris tooteotsus, mis ei kuulu „üks boolean + üks prompt-adapter" ulatusse. V1 = chat + juhendatud eelpöördumine. Dokumendid on eraldi ring pärast seda, kui plain-režiimi mõju on golden-testidega mõõdetud.

### 13.4 Opuse muudatus 3 — lisa üks kontroll, mida Soli plaanis ei ole

`communication_support_options.simple_language` (teenuseosutaja tugi) ja `plainLanguage` (kasutaja UI-režiim) on **eri asjad** — Sol märgib seda õigesti §6.3-s. Lisan nõude: U7-E testide hulka kuulub **regressioonitest, mis kinnitab, et need kaks ei ole seotud** — st `plainLanguage=true` ei muuda teenusekaardi `simple_language` filtrit ega kuva. Vastasel juhul tekib ahvatlus need „loogiliselt" ühendada ja pöörduja hakkab nägema filtreeritud teenusevalikut oma UI-eelistuse tõttu.

### 13.5 Opuse muudatus 4 — U7 järjekord

Sol paneb U7 „järgmiseks esmaseks kandidaadiks pärast U1/U2". **Nõustun**, aga lisan tingimuse: U7 võib alata **U1/U2-st sõltumatult ja paralleelselt**, sest ta ei puuduta ühtegi U1/U2 faili (a11y provider, prompt builder, chat request bootstrap). Kui U1/U2 blokeerub merge-eeltingimuste taga (U3/U4/P1), on U7 **ainus lukus otsusega töö, mis saab kohe alata**. See on praeguses olukorras oluline.

---

## 14. SOLI INTEGRATSIOONI- JA DEPLOY-JÄRGNE LEPITUS

> See jaotis ei kirjuta ümber Opuse audititõendeid ega tee kasutaja aktsepteeritud U4/U8 parandusi tagantjärele märgendiks `OPUS HEAKS KIIDETUD`. See fikseerib ainult pärast read-only auditit muutunud repositooriumi- ja produktsiooniseisu.

### 14.1 Ühendatud paketid

| Pakett | Allikaseis | Tänane seis |
|---|---|---|
| U3 + U12 | `d2dd13e3` | `main`-is, produktsioonis, Opuse heaks kiidetud |
| P1 operatsioonipakett | `0fd73ccf` | `main`-is ja produktsioonis; kasutaja aktsepteeris parandused ilma uue täismahus kordusauditita |
| U8-lite | `02f40a21` | `main`-is ja produktsioonis; kasutaja aktsepteeris parandused ilma uue täismahus kordusauditita |
| U4 | `a3529ac0` | `main`-is ja produktsioonis; kasutaja aktsepteeris parandused ilma uue täismahus kordusauditita |

Integratsiooni rakenduscommit on `22958456`; rakendusintegratsiooni dokumenteeritud `main`-seis on `fb8809a6`. Põhitööpuu `C:/Users/rauds/Desktop/SotsiaalAI` jäi dirty ja selle HEAD/indexit ei kasutatud integratsiooniks.

### 14.2 Kontrollitud integratsiooni- ja produktsioonitõend

- ühendatud sihttestid **235/235**;
- täistestid **1190/1190**;
- migratsioonikontroll **91/91**;
- CSS kontroll **52/52**;
- lint **0 viga**, 359 olemasolevat hoiatust;
- production build **54 lehte**;
- produktsioonis 91 migratsiooni rakendatud ja skeem ajakohane;
- frontend ning RAG teenused aktiivsed;
- `/`, `/minu-jagamised`, `/admin/rag/source-feedback` ja `/admin/service-availability` vastavad HTTPS kaudu 200;
- P1 deploy-värav läbis: unlinked, mismatch ja residue loendurid on nullis;
- praktikaülevaatuse ning kättesaadavusmeeldetuletuse timerid on aktiivsed ja esimene päris käivitus lõppes edukalt.

Täielik env-, systemd-, tervisekontrolli- ja rollback-üleandmine on failis `14-sol-u3-p1-u8-u4-integratsioonirehearsal.md`.

### 14.3 Täpne jätkamispunkt

1. Loo värskest `origin/main`-ist U1/U2 jaoks uus eraldi worktree ja `codex/` haru.
2. Paranda vaatajakontekstiga `serializePreInquiry`: vastuvõtja sisemärge, checklist, tulevane `nextContactOn` ja mõlema poole konto-e-post ei tohi valele poolele lekkida.
3. Tee mailer tootmises fail-closed, dev-mock eksplitsiitseks ja redigeerituks ning `Message-ID` kutsuja määratavaks.
4. Lukusta mõlemad P1-d liidesetasandi regressioonitestidega.
5. Alles pärast seda alusta `NotificationEvent` mudelit ja U1/U2 vertikaali.
6. Anna valmis pakett Opusele doc 10 §16 järgi sõltumatuks auditiks.
