# T25 `ORG-E0` — read-only arendusvalmiduse audit

Kuupäev: **01.08.2026**
Alusleping: `docs/platvormi arendus/t25-org-workspace-v1-arenduskava-opusele.md` ptk 9.1 „Üleandmine 0 — `ORG-E0`"
Staatus: **E0 TEHTUD — 0 rakenduskoodi muudatust. Ootab omaniku luba viilule A.**

---

## 1. Baas ja tööpuu

| Fakt | Väärtus |
|---|---|
| `HEAD` | `952a76e3aea0eb94a1cb622c78cc22fb1abf93fb` |
| `origin/main` | `952a76e3aea0eb94a1cb622c78cc22fb1abf93fb` |
| `main` | `952a76e3aea0eb94a1cb622c78cc22fb1abf93fb` |
| Lahknevus | **puudub** — lokaalne main == origin/main |
| Põhitööpuu seis | 20 kirjet `git status`-is: **ainult dokumendid ja üks PNG. Rakenduskoodi muudatusi ei ole.** |
| Prisma | `7.3.0` (`prisma` + `@prisma/client`), generator `prisma-client` → `../generated/prisma` |
| Next / React | `16.2.3` / `19.2.7` |
| Migratsioone kokku | 108, viimane `20260724000000_collab_v1_summary_approval` |
| Skeem | `prisma/schema.prisma`, 3777 rida, 219 `model`/`enum` deklaratsiooni |

Aktiivseid worktree'sid on 11 (2 Claude'i oma, 8 teemapõhist, 1 põhitööpuu). Ükski neist ei ole org-teema oma; nimekonflikti ei teki.

**Muudatusi ei tehtud.** See fail on ainus E0 väljund.

---

## 2. Mida loeti

Loetud aktiivsest koodist (mitte dokumentidest):
`prisma/schema.prisma`, `lib/subscriptionPlans.js`, `lib/authz.js`, `lib/workspaces/registry.js`,
`lib/invites/acceptInviteCore.js`, `app/api/invites/route.js`, `lib/wellbeing/pilotScopes.js`,
`lib/notifications.js`, `lib/events/{registry,projector,emitDomainEvent}.js`, `package.json`,
route-puu `app/api/**`, `messages/{et,en,ru}.json` mõõdud, `prisma/migrations/`.

---

## 3. Kooditõe inventuur

### 3.1. Roll, tellimus ja hind

| Ese | Kooditõde |
|---|---|
| `enum Role` | `ADMIN, SOCIAL_WORKER, SERVICE_PROVIDER, CLIENT` (schema.prisma:12–17) — **kinnitab lepingu §2.1** |
| Vaikehinnad | `lib/subscriptionPlans.js:1–3`: `14.99` / `19.99` / `7.99` — **kinnitab §D5** |
| `PlanDefinition` | on `role Role` + `price Decimal(10,2)` + `version` + `effectiveFrom/To` → **hinnasnapshot'i muster on juba olemas**, `OrganizationSeatPlan` peab käituma samamoodi, mitte viitama jooksvale hinnale |
| `Subscription` | juba `billingSource: SELF \| SPONSORED_BY_HOST`, `sponsorUserId`, `inviteId` |
| `PlanEntitlement` / `UsageBucket` / `UserEntitlementOverride` | kvoodikiht on kasutajapõhine; org-koht ei tohi seda korrutada (§5.6 „kohti ei stack'ita") |
| Rollikontroll | `lib/authz.js`: `roleFromSession`, `normalizeRole` (ADMIN→SOCIAL_WORKER), `requireSubscription`, `assertAdmin`. **Keskset capability- ega konteksti-resolverit ei ole.** |

### 3.2. Kutsed ja sponsorlus

`model Invite` (schema.prisma:3174–3206) väljad: `roomId` (**NOT NULL**, `onDelete: Cascade`), `inviterId`,
`inviteeEmail`, `tokenHash @unique`, `status`, `relationshipType`, `paymentMode`, `sponsoredByUserId`,
**`sponsoredByOrgId String?`**, `sponsoredRole Role?`, `sponsoredPlan`, `expiresAt`, `maxUses`, `useCount`,
`acceptedBillingSource`, `acceptedByUserId`.

### 3.3. Teenuseosutaja profiil

`model ServiceProviderProfile` (1854–1904): `@@unique([ownerId])`, `owner User @relation(… onDelete: Cascade)`,
`publicSlug String? @unique`, `status`, seotud `ServiceProviderService[]`, `ServiceProviderLocation[]` ja
`ServiceMapEntry?` (`ServiceMapEntry.providerProfileId String? @unique`, `onDelete: Cascade`).

### 3.4. Eelpöördumine

`model PreInquiry` (2055–2103): adressaat on `recipientOwnerId` (User) **või** `recipientEntryId` (ServiceMapEntry);
`enum PreInquiryRecipientType { KOV_CONTACT, SERVICE_PROVIDER }`; `enum PreInquiryStatus { DRAFT, READY, SENT, DOWNLOADED, ARCHIVED }`;
elutsükkel `sentAt/openedAt/recalledAt/supersededById` on olemas. 11 indeksist 5 on `recipientOwnerId`-põhised.
Lüliti `User.acceptsPreInquiries Boolean @default(false)` (+ indeks).
Route'e: 12 (`app/api/pre-inquiries/**`).

### 3.5. Tööheaolu

`WellbeingRecord` (1337–1380) — `ownerUserId` + `onDelete: Cascade`, `visibility "private"`, **omandivõtit ega jagamisvälju ei ole** (§D8 on koodis juba tõsi).
`WellbeingOutputDraft` (1429–1454) — `recipientType String`, `userConfirmed`, `handedOffAt`, `covisionCaseId @unique`. **Tarnemudelit (saaja, avamine, tagasivõtt) ei ole.**
`WellbeingPilotScope` / `WellbeingPilotViewer` (1456–1492) — pilootkoondi kiht, `municipalityId String?` ja `organizationId String?`.

### 3.6. Teavitused, sündmused, audit

`NotificationEvent` — `dedupeKey @unique`, e-posti outbox-väljad, `eventId`, **`workspaceKind`/`workspaceId`**.
`DomainEvent` — U1 outbox: `idempotencyKey @unique`, `visibilityClass`, `retentionClass`, **`workspaceKind`/`workspaceId`**, `projectedAt`.
`DataAuditLog` — `actorUserId`, `targetUserId`, `action String`, `resourceType?`, `resourceId?`, `meta Json?`; indeksid ainult `createdAt`, `actorUserId`, `targetUserId`, `action`.

### 3.7. RAG-i haldusmudelid (mitte kasutajaorganisatsioonid)

`Municipality` (id/slug/baseName/type/displayName/county/isActive), `MunicipalityKovAdmin`, `MunicipalityKovAdminFile`,
`OrganizationAdmin` (`slug @unique`, `displayName @unique`, crawl/ingest-väljad), `OrganizationAdminFile`.
Enumid: `OrganizationAdminFileRole`, `OrganizationFileValidationStatus`, `KovAdminStatus` jt.

---

## 4. Kriitilised leiud

### L1 — `workspace` on juba hõivatud mõiste. **KÕRGE. Lepingu §6 nimi tuleb muuta.**

`lib/workspaces/registry.js` defineerib K1 `WorkspaceKind` = **töö-objekti liik**, mitte organisatsioonikontekst:
`room, covision_case, journey, pre_inquiry, wellbeing_space, supervision_process, mentoring_process, topic_seed, meeting, network_case, field_visit, org_space, case_work, practice_reflection`.
See tähendus on toodangus kandev: `DomainEvent.workspaceKind` väärtused on täna `"pre_inquiry"` ja `"journey"`
(`lib/events/registry.js:53,67,78,89,100`), `NotificationEvent.workspaceKind` sama, indeks
`@@index([workspaceKind, workspaceId, occurredAt])`, olemas ka `app/api/workspace/continuity/route.js`
ja 16-failine `lib/workspaces/`.

Lepingu §6 `resolveWorkspaceAccessContext()` looks sama nimeruumi teise tähendusega funktsiooni.

**Soovitus:** nimeta serveriresolver `resolveOrgAccessContext()` failis `lib/org/accessContext.js`;
UI-s võib eestikeelne sõna „tööruum" jääda.

**Kingitus samast leiust:** `WorkspaceKind.ORG_SPACE = "org_space"` on registris juba **RESERVED**
(registry.js:18,68) — K1 nägi org-ruumi ette. Viil A peaks selle teadlikult kas adapteriga aktiveerima
või lepingus kirja panema, et ta jääb RESERVED-iks. Vaikimisi möödaminek tekitaks kaks paralleelset org-mõistet.

### L2 — `Invite.sponsoredByOrgId` on surnud veerg. **KÕRGE. Lepingu §5.6 eeldus ei pea paika.**

Leping ütleb: „kasuta/laienda olemasolevat sponsorkutse mehhanismi ja `sponsoredByOrgId` seost".
Kooditõde:

- veerg on olemas alates `20260105120000_add_rooms_invites` (migration.sql:55) — **`TEXT`, ilma FK-ta, ilma indeksita**;
- ainus kirjutaja on `app/api/invites/route.js:534` `sponsoredByOrgId: sponsor.orgId`;
- `sponsor` tuleb funktsioonist `resolveSponsor(room)` (sama fail, 267–272), mis tagastab **alati `orgId: null`**;
- ainus lugeja `lib/invites/acceptInviteCore.js:179` `sponsorOrgId = invite.sponsoredByOrgId || null` — ja seega alati null;
- test `tests/invites/acceptInviteCore.test.js:24` fikseerib `sponsoredByOrgId: null`.

**Tagajärg viilule B:** organisatsiooni sponsorlus **ei ole olemasoleva raja laiendus, vaid uus rada**
tühja kohatäite peal. See on viilu B mahuhinnangu suurim viga, kui teda ei paranda.

### L3 — kutse on Room-i küljes. **KÕRGE. Tootedisaini otsus, mitte tehniline detail.**

`Invite.roomId` on NOT NULL ja `onDelete: Cascade`. Täna ei saa kutset eksisteerida ilma ruumita.
Sellel on kaks eraldi tagajärge:

1. **Viil A on selle tõttu õigesti disainitud** — leping §5.5 loob eraldi `OrganizationInvite` mudeli. Kinnitatud.
2. **Viil B `CLIENT` sponsorlus jookseb otsa.** „Organisatsioon sponsoreerib pöörduja ligipääsu olemasoleva
   sponsorkutse kaudu" tähendab tänase koodi järgi, et **organisatsioon peab kutse saatmiseks looma ruumi ja
   olema selle omanik**. See on tooteliselt küsitav: KOV, kes rahastab 200 elaniku ligipääsu, ei taha 200 ruumi.
   → **O-E0-1** allpool.

### L4 — `ServiceProviderProfile` migratsioon on kolmekordselt lukus. **KÕRGE. Viilu C riskikese.**

Kolm piirangut samal objektil:

| Piirang | Asukoht | Miks blokeerib |
|---|---|---|
| `@@unique([ownerId])` | 1897 | org-profiilil ei ole ühte omanikku; Prisma ei väljenda osalist unikaalsust → **raw SQL** |
| `owner … onDelete: Cascade` | 1892 | leping §5.9 nõuab „konto kustutamine ei hävita org-profiili" — **täna hävitab** |
| `ServiceMapEntry.providerProfile … onDelete: Cascade` + `providerProfileId @unique` | 2031, 2042 | avalik kaardikirje kaob koos profiiliga; peab üle elama omandirežiimi vahetuse |

Nõuab expand-migrate-contract mustrit, mitte üht `ALTER`-it. Ainus viil, kus migratsioon on
päriselt destruktiivne — ülejäänud on aditiivsed.

### L5 — eelpöördumise adressaadimudel on kasutajapõhine kogu indeksikihini välja. **KESKMINE.**

`recipientType` enumis ei ole organisatsiooni; adressaat on `User` või `ServiceMapEntry`.
Viil B peab: (a) lisama enum-väärtuse (nt `ORGANIZATION_INBOX`), (b) lisama org-adressaadi välja,
(c) lisama **uued indeksid** — viiest olemasolevast adressaadiindeksist ei kata ükski org-postkasti päringut,
(d) leidma `User.acceptsPreInquiries` org-vaste (moodul `KOV_INTAKE` + `INBOX_COORDINATOR` olemasolu ei ole sama asi
mis „organisatsioon võtab eelpöördumisi vastu").

### L6 — keskset feature-flag moodulit ei ole. **KESKMINE.**

Lipud loetakse vähemalt neljal erineval viisil: `readFlag` (`lib/chat/settings.js:59`), `enabled()`
(`lib/events/emitDomainEvent.js:20`, `projector.js:24`), `envEnabled` (`lib/calls/egress.js:8`),
`readBooleanEnv` (`lib/documents/audioWorkflow.js:21`), pluss otsesed `String(env.X||"").toLowerCase()==="true"`.
Kaheksa uut `ORG_*` lippu (§10) vajavad **üht moodulit** `lib/org/flags.js`, muidu tekib viies muster
ja §11.8 „iga gate väljas: DB kõrvalmõju 0" muutub kontrollimatuks.

### L7 — `WellbeingPilotScope.organizationId` on vaba tekst, mitte viide. **KESKMINE. Soovitus: ÄRA PUUDUTA.**

`lib/wellbeing/pilotScopes.js:77` — `organizationId: cleanText(input.organizationId)`. Admini sisestatav string.
Leping E1 ütleb „seo senised nullable sponsor-/organization-väljad FK-dega ainult siis, kui andmeaudit näitab
ohutut migratsiooni". Siin **ei näita**: väli kuulub pilootkoondi kihti, mis on CORE-V1-st teadlikult väljas
(§13, `ORG-WELLBEING-V1`). FK lisamine nõuaks andmepuhastust ilma ühegi CORE-V1 kasuta.
→ jäta muutmata kõigis kolmes viilus; kirjuta see lepingusse, et see ei näiks unustusena.

### L8 — `Organization*` nimeruum on osaliselt hõivatud homonüümiga. **KESKMINE.**

Literaalset kokkupõrget ei ole (`Organization`, `OrganizationUnit`, `OrganizationMembership` jne on vabad),
kuid **`OrganizationAdminFile.organizationId` viitab `OrganizationAdmin`-ile, mitte uuele `Organization`-ile**
(schema.prisma:1834, 1847). See on aktiivne mürgine homonüüm: iga tulevane lugeja peab teadma, kumb `organizationId`
on kumb. Sama kehtib `WellbeingPilotScope.organizationId` (L7) kohta.

**Soovitus:** (a) uued mudelid nimetavad org-viite alati `organizationId` ja **ainult** uue `Organization` tähenduses;
(b) viilu A üleandmisse lisada grep-värav, mis loetleb kõik `organizationId` esinemised ja nende sihtmudeli;
(c) mitte ümber nimetada olemasolevat `OrganizationAdmin`-i — see oleks CORE-V1-välise RAG-kihi riskiv puudutus.

### L9 — admini rollivaade tuleb küpsisest. **MADAL, aga E2 peab teadlikult vältima.**

`lib/authz.js:29–42` `resolveSessionRoleState` võtab `adminViewRole` küpsisest ja ehitab sellest `effectiveRole`.
Uus org-resolver **ei tohi** seda mustrit laiendada org-kontekstile (§6 „klient ei saada serverile usaldatavat
`effectiveRole`, capability't ega maksjat"). §7.2 lubab „viimati kasutatud kontekst" küpsisena ainult mugavuseelistusena.
Piir on õige, kuid koodis on olemas eeskuju, mida on lihtne kogemata kopeerida.

### L10 — `DataAuditLog` ei kanna org-i skoopi. **MADAL.**

`resourceType`/`resourceId` on indekseerimata; org-i auditivaade (§7.3 `/org/[orgId]/audit`) teeks
täisskaneeringu. Kaks võimalust: uus indeks `([resourceType, resourceId, createdAt])`, või projitseerida
org-audit `DomainEvent`-i pealt, kus `@@index([workspaceKind, workspaceId, occurredAt])` juba sobiks
(vt L1 — sel juhul on `org_space` aktiveerimine vajalik, mitte valikuline).

---

## 5. A/B/C jaotuse kooditõene hinnang

**Jaotus kehtib. Muutmist ei vaja. Neli täpsustust:**

| Viil | Hinnang | Täpsustus |
|---|---|---|
| **A `ORG-FOUNDATION-V1`** | **Kinnitatud.** Puhtalt aditiivne: 7 uut mudelit + enumid, ühtegi olemasolevat tabelit ei muudeta. Rollback = drop. | Lisandub 2 tööd, mida ptk 9.1 ei nimeta: `lib/org/flags.js` (L6) ja otsus `WorkspaceKind.ORG_SPACE` kohta (L1). |
| **B `ORG-FUNDING-INBOX-V1`** | **Kinnitatud, aga alahinnatud.** | `CLIENT` sponsorlus ei ole olemasoleva raja laiendus (L2) ja põrkab Room-nõudega (L3). Eelpöördumise org-adressaat vajab enumit + uusi indekseid (L5). |
| **C `ORG-PROFILE-SUPPORT-V1`** | **Kinnitatud, kõrgeim risk.** | Ainus destruktiivne migratsioon (L4), nõuab expand-migrate-contract'i ja peab kandma `ServiceMapEntry` 1:1 seost. |

Järjestus A → B → C on kooditõe järgi õige: A ei sõltu millestki, B sõltub A liikmesusest,
C sõltub A capability'dest ja B offboarding-liidesest.

---

## 6. Migratsioonijärjekord ja rollback

Uute migratsioonide ajatempel algab `20260801…` (viimane olemasolev on `20260724000000`).

**Viil A — aditiivne, pöörduv.**

1. `…_org_foundation_enums` — `OrganizationStatus`, `OrganizationLegalKind`, `OrganizationModuleKey`, `OrganizationModuleStatus`, `OrganizationUnitType`, `OrganizationMembershipStatus`, `OrganizationSeatRole` (**ainult `SOCIAL_WORKER \| SERVICE_PROVIDER`**), `OrganizationCapability`, `OrganizationCapabilityScopeType`, `OrganizationInviteStatus`.
2. `…_org_foundation_core` — `Organization`, `OrganizationModule`, `OrganizationUnit` (+ `parentUnitId` self-FK).
3. `…_org_foundation_membership` — `OrganizationMembership`, `OrganizationMembershipUnit`, `OrganizationCapabilityGrant`, `OrganizationInvite`.
4. `…_org_foundation_partial_indexes` — **raw SQL**, mida Prisma skeemikeel ei väljenda:
   - üks aktiivne liikmesus org+kasutaja kohta: `CREATE UNIQUE INDEX … ON "OrganizationMembership"("organizationId","userId") WHERE "status" = 'ACTIVE'`;
   - üks aktiivne moodul org+moodulivõtme kohta (`WHERE "status" = 'ACTIVE'`);
   - üks aktiivne põhiüksus liikmesuse kohta (`WHERE "isPrimary" AND "endedAt" IS NULL`);
   - üks avatud kutse org+e-posti kohta (`WHERE "status" = 'PENDING'`).

Rollback: `DROP TABLE` vastupidises järjekorras + `DROP TYPE`. **Olemasolevaid tabeleid ei puudutata → rollback on triviaalne ja tõendatav.**
`Organization.municipalityId` võib FK-da olemasolevale `Municipality`-le (`id String @id`) — soovitan `onDelete: SetNull`, sest KOV-i registrikirje kustumine ei tohi organisatsiooni kaotada.

**Viil B — aditiivne + üks olemasolev tabel.**

1. Uued tabelid `OrganizationSeatPlan`, `OrganizationSeatAssignment`, `OrganizationInboxItem`, `OrganizationWorkAssignment` + enumid.
2. `PreInquiryRecipientType` + `ORGANIZATION_INBOX`; `PreInquiry` uus nullable org-adressaadi väli + indeksid (L5).
3. `Invite.sponsoredByOrgId` → FK `Organization(id)`. **Andmeaudit enne:** koodi järgi (L2) on kõik read `NULL`,
   seega `ALTER TABLE … ADD CONSTRAINT` on ohutu — kuid **tuleb enne migratsiooni päriselt loendada**
   (`SELECT count(*) FROM "Invite" WHERE "sponsoredByOrgId" IS NOT NULL`), sest E0 ei lugenud tootmis-DB-d.
4. Raw SQL: üks aktiivne määramine inbox-item'i kohta; seat-limit'i kontroll **tehingus**, mitte indeksis
   (limiit on loendus, mitte unikaalsus) — vajab `SELECT … FOR UPDATE` mustrit `OrganizationSeatPlan` real.

Rollback: FK maha, veerg jääb (oli enne olemas), enum-väärtust **ei saa Postgresis lihtsalt eemaldada** →
rollback-plaan peab ütlema, et `ORGANIZATION_INBOX` jääb enumisse ka pärast rollback'i (kasutamatuna).

**Viil C — destruktiivne, expand-migrate-contract.**

1. *Expand:* `ServiceProviderProfile` + `organizationId String?` + `ownershipMode` (vaikimisi `SOLO`), `ownerId` jääb nullable'iks-tehtud alles.
2. *Expand:* raw SQL — `DROP` senine `@@unique([ownerId])`, asemele
   `CREATE UNIQUE INDEX … ON "ServiceProviderProfile"("ownerId") WHERE "ownershipMode" = 'SOLO'`
   ja `CREATE UNIQUE INDEX … ON "ServiceProviderProfile"("organizationId") WHERE "ownershipMode" = 'ORGANIZATION'` (§5.9 „üks põhiprofiil org-i kohta").
3. *Migrate:* kõik olemasolevad read → `ownershipMode = 'SOLO'`, `organizationId = NULL`. **Andmemuutust ei toimu.**
4. *Contract:* `owner` relatsiooni `onDelete: Cascade` → `SetNull`/`Restrict` (L4). See on ainus koht,
   kus rollback ei ole triviaalne: Cascade tagasi panemine on ohutu ainult siis, kui vahepeal ei ole
   ühtki ORGANIZATION-režiimi profiili tekkinud. **Rollback-värav: `SELECT count(*) … WHERE "ownershipMode" = 'ORGANIZATION'` peab olema 0.**
5. Uued tabelid `OrganizationReportingLine`, `OrganizationSupportContact`, `WellbeingSupportShare`.

---

## 7. API / route / UI puutepind

**Olemasolev, mida viilud puudutavad:**

| Rada | Failid | Viil |
|---|---|---|
| Kutsed | `app/api/invites/route.js`, `lib/invites/acceptInviteCore.js` | B (L2/L3) |
| Eelpöördumine | `app/api/pre-inquiries/**` (12 route'i) | B (L5) |
| Teenuseprofiil | `app/api/service-provider/profile/**` (2 route'i) | C (L4) |
| Tellimus | `app/api/subscription/**`, `lib/subscriptionPlans.js`, `lib/usage/**` | B (payerSource, kvoodikaitse) |
| Teavitused | `lib/notifications.js`, `lib/events/**` | A, B, C |
| Autoriseerimine | `lib/authz.js` | A (L9) |
| K1 tööruumikiht | `lib/workspaces/registry.js` | A (L1) |

**Uus, mida ei ole olemas:** `app/org/**` (puudub täielikult — `Test-Path app\org` = False), `app/api/org/**`, `lib/org/**`.
Nimeruum on vaba.

**i18n:** `messages/et.json` 474 KB, `en.json` 467 KB, `ru.json` 730 KB. Värav `npm run i18n:check`
(`scripts/check-messages.mjs`) on **pariteedikontroll, mitte kattekontroll** — vt varasem T24 õppetund.
Iga viil peab lisama kõik kolm keelt korraga.

---

## 8. Testiplaan ja selle piir

`npm test` = `node --test tests/**/*.test.js` fake-Prisma laaduriga (`scripts/register-node-test-loader.mjs`).
**Elavat andmebaasi ei ole.** Sellest järeldub testimaatriksi (§11) kohustuslik jaotus:

| §11 plokk | Kaetav `npm test`-iga | Nõuab autenditud sünteetilist runtime'i |
|---|---|---|
| 11.1 isolatsioon ja õigused | resolveri puhtad reeglid (capability ilma membership'ita jne) | **kahe org-i päris-eraldatus, 404/403 mustrid** |
| 11.2 kutsed | token, aegumine, revoke, korduskasutus | e-posti sisu puudumine |
| 11.3 struktuur | tsükkel, max sügavus, skoobi pärilus | üksuse liigutamine ajalooga |
| 11.4 hinnastus | vaikehinnad, role mismatch, snapshot'i muutumatus | **seat-limit'i võistluskatse (vajab päris tehingut)** |
| 11.5 vastuvõtt | seisumasin, jagamisulatus | **topeltmääramise võistlus**, recall/openedAt |
| 11.6 teenuseprofiil | projektsioonid, CAS-konflikt | **migratsiooni järel solo-profiil töötab** |
| 11.7 toeavaldus | snapshot'i väljade filter, fail-closed | lähtekirje null-leke päris päringus |
| 11.8 gate'id | UI/API suletus | **„DB kõrvalmõju 0"** |
| 11.9 runtime | — | **kogu 12-sammuline stsenaarium** |

Lisaks igas viilus: `npm run db:migrate:check`, `npm run lint`, `npm run i18n:check`, `npm run build`.

---

## 9. `NOT_PROVEN` loend

E0 oli read-only ja ei puudutanud andmebaasi ega runtime'i. Tõendamata:

1. **Tootmis-DB sisu.** `Invite.sponsoredByOrgId` non-null ridade arv on koodianalüüsi põhjal 0, **mõõtmata**.
2. **`ServiceProviderProfile` ridade arv ja seis** — migratsiooni riski (L4) suurus on teadmata.
3. **`WellbeingPilotScope.organizationId` tegelikud väärtused** — kas seal on üldse ridu.
4. **Prisma 7.3 migratsioonimootori käitumine** osaliste unikaalindeksite ja `prisma migrate diff` juures — käivitamata.
5. **`npm test` / `lint` / `build` hetkeseis** — E0-s ei käivitatud (baas on puutumata, aga rohelust ei tõendatud).
6. **`messages/*.json` pariteedi mõju** uute võtmete lisamisel — mõõtmata.
7. **Kas mõni olemasolev route eeldab `ServiceProviderProfile` `@@unique([ownerId])` semantikat** (nt `findUnique({ where: { ownerId } })`) — täisgrep tegemata, kuulub viilu C algusesse.

---

## 10. Otsused omanikule enne viilu A

| ID | Küsimus | Miks E0 ei saa seda ise otsustada | Soovitus |
|---|---|---|---|
| **O-E0-1** | Kas organisatsiooni `CLIENT` sponsorlus tohib nõuda ruumi (`Invite.roomId` NOT NULL, L3)? | Tootedisain: KOV, kes rahastab 200 elaniku ligipääsu, looks 200 ruumi. Alternatiiv = `roomId` nullable + eraldi org-sponsorluse rada = **viilu B maht kasvab oluliselt**. | Otsustada **enne viilu B**, mitte selle sees. Viilu A see ei blokeeri. |
| **O-E0-2** | Kas `WorkspaceKind.ORG_SPACE` aktiveeritakse viilus A (adapter + audit/timeline liitekoht) või jääb RESERVED? | L1/L10: aktiveerimine annab org-auditile valmis indeksi; mitteaktiveerimine hoiab viilu A väiksemana. | Aktiveerida viilus A — muidu tekib kaks org-mõistet ja L10 vajab eraldi indeksit. |
| **O-E0-3** | Kas E0 järel luuakse eraldi worktree, või tehakse viil A põhitööpuus? | Leping §9.2 nõuab „iga viil oma värskes worktree's"; salvestatud töökord ütleb „töö otse main-is, ei harusid ega worktree-kaustu". **Vastuolu.** | Leping võidab: viil A on suur skeemimuudatus → eraldi worktree `codex/org-foundation-v1`. Kinnitust vajab. |
| **O-E0-4** | Kas leping parandatakse L1 (nimi), L2 (surnud veerg) ja L7 (`pilotScope.organizationId` = ära puuduta) osas enne viilu A? | Praegu ütleb leping kolmes kohas midagi, mis ei vasta kooditõele. | Jah — kolm lauset, et viilude teostaja ei ehitaks olematu eelduse peale. |

---

## 11. E0 kokkuvõte

| Nõue (ptk 9.1) | Seis |
|---|---|
| aktiivse koodi ja skeemi inventuur | **DONE** (ptk 3) |
| konfliktide ja migratsiooniriskide kontroll | **DONE** (ptk 4, 10 leidu) |
| mudelite lõplik jaotus viilude vahel | **DONE** (ptk 5) |
| API/route/UI puutepinna kaart | **DONE** (ptk 7) |
| täpne testiplaan | **DONE** (ptk 8) |
| parent SHA ja worktree strateegia | **DONE** (ptk 1) + lahtine **O-E0-3** |
| `NOT_PROVEN` loend | **DONE** (ptk 9) |
| hinnang A/B/C jaotusele | **DONE** — jaotus kehtib, 4 täpsustust (ptk 5) |
| turvakriitiline vastuolu | **EI LEITUD.** Privaatsusinvariandid (§D8, §4) on tänases skeemis juba tõesed: `WellbeingRecord`-il ei ole omandivõtit ega jagamisvälju. |
| 0 rakenduskoodi muudatust | **DONE** — muudetud ainult see dokument |

**Programm peatub siin ja ootab omaniku luba viilule A (`ORG-FOUNDATION-V1`).**
