# T25 `ORG-WORKSPACE-V1` — kogu arenduse kokkuvõte kontrollimiseks

Kuupäev: **02.08.2026** (esimene versioon 01.08, viil C lisatud 02.08)
Alusleping: `docs/platvormi arendus/t25-org-workspace-v1-arenduskava-opusele.md`
Staatus: **CORE-V1 on koodis TERVIKUNA valmis — E0 + viil A + viil B + teavituskiht + viil C.
Kõik E-etapid E0–E12 on DONE. Push'imata ja deploy'mata; integratsioon `origin/main`-iga on
eraldi worktree's läbi proovitud (ptk 6a).**

See dokument on kirjutatud KONTROLLIMISEKS. Iga väide on siin kas Git-fakt, käivitatav
käsk või viide failile ja reale. Kus midagi ei ole tõendatud, on see öeldud otse.

---

## 1. Git-faktid

> **Ahel:** `952a76e3` → viil A `40dc95b1` → viil B `b508fc64` → teavituskiht `b5729915`
> → viil C `codex/org-profile-support-v1`. Iga viil hargneb eelmise tipust, seega iga järgmise
> viilu väravad jooksevad KÕIGI eelmiste koodi peal korraga.

| Ese | Väärtus |
|---|---|
| Lähtebaas (E0 auditeeritud) | `952a76e3aea0eb94a1cb622c78cc22fb1abf93fb` |
| Teavituskihi haru | `codex/org-funding-inbox-v1` tipp `b5729915` |
| Viil C haru | `codex/org-profile-support-v1`, parent `b5729915` |
| Viil A haru | `codex/org-foundation-v1` |
| Viil A tipp | `40dc95b1` (2 commit'i: `074030fc`, `40dc95b1`) |
| Viil B haru | `codex/org-funding-inbox-v1`, parent `40dc95b1` |
| **Viil B RAKENDUSTIPP** | **`b508fc647ccf3cad3892a5b3412b221ab5a4f5d4`** — viimane commit, mis muudab rakenduskoodi |
| **Viil B haru HEAD** | rakendustipp + käesolev dokument (dokumendi-commit ei muuda rakenduskoodi) |
| **Viil C tipp** | **`fcd65165`** (2 commit'i: `d2613735` serverikiht, `fcd65165` UI + eksport + tõlked) |
| `origin/main` praegu | `cf7b0f1840ef09602619758e62252e30410de158` — **14 commit'i baasist edasi liikunud** |
| Integratsiooniproov | `bbf2a644` (detached, `origin/main` + viil C = kogu CORE-V1) |
| Merge lokaalsesse `main`-i | **tehtud** — vt ptk 1a |
| Push `origin`-isse / deploy | **ei tehtud** — omaniku otsus |

**Viilu B commit'id:**

| SHA | Liik |
|---|---|
| `c81feed0` | rakendus — serverikiht |
| `7cfc1b10` | rakendus — eelpöördumise liitekoht |
| `7c8639a8` | rakendus — UI |
| `9f8daaef` | **ainult dokumentatsioon** |
| `b508fc64` | rakendus — atomaarsus ja tehingu omandus |

**Diffid eraldi** (`git diff --shortstat 40dc95b1 HEAD -- . ':(exclude)docs'`):

| Ulatus | Failid | Read |
|---|---|---|
| Viil B **rakendus** (docs väljas) | 41 | +5289 / −37 |
| Viil B **dokumentatsioon** | 1 | +262 |
| Viil B **kogu haru** | 42 | +5551 / −37 |
| Viil A (`952a76e3..40dc95b1`) | 65 | +8899 / −3 |
| Viil C (`b5729915..fcd65165`) | 29 | +3771 / −39 |
| **Kogu CORE-V1** (`952a76e3..fcd65165`) | 135 | ≈ +18200 / −79 |

> Viil C on ainus, kus miinuseid on rohkem kui paar rida: 39 kustutatud rida on
> `lib/serviceProviderProfiles.js` kolm ümberkirjutatud päringut (`findUnique({ownerId})`
> → `findFirst({ownerId, ownershipMode:"SOLO"})`) ja `upsert` → selgesõnaline
> uuenda-või-loo. Need on E8 destruktiivse migratsiooni vältimatu tagajärg.

**Kontrollkäsud:**

```bash
git -C C:/Users/rauds/Desktop/SotsiaalAI-org-foundation-v1 log --oneline 952a76e3..HEAD
```

```bash
git -C C:/Users/rauds/Desktop/SotsiaalAI-org-funding-inbox-v1 log --oneline 40dc95b1..HEAD
```

```bash
git -C C:/Users/rauds/Desktop/SotsiaalAI-org-profile-support-v1 log --oneline b5729915..HEAD
```

---

## 1a. Merge lokaalsesse `main`-i

Kogu CORE-V1 tuleb main'i **ühe merge'ina viilu C harust** — mitte kolme eraldi merge'ina.
Põhjus on lihtne: viil B hargneb viilu A tipust ja viil C viilu B tipust, seega viilu C
haru SISALDAB juba mõlemat eelmist. Kolm merge'i annaks sama puu, aga kolm korda rohkem
kohti, kus midagi valesti läheb.

Lokaalses `main`-is on paralleelselt omaniku enda UI-töö (`motion` sõltuvus,
`CurvedInput` / `SpecularButton` / `TiltedCard`, karusselli ja klaasi CSS). Need
puudutavad `app/styles/*`, `components/ui/Button.jsx` ja `package.json`-i —
organisatsioonikiht neid faile ei muuda, seega ristumist ei olnud.

**Merge'i järel jooksevad väravad main'is uuesti** (ptk 6c). Harude väravad ei
tõenda main'i: main'is on koodi, mida harus ei olnud.

---

## 2. Mis tehti, etappide kaupa

| Etapp | Viil | Seis |
|---|---|---|
| E0 read-only audit | — | DONE (`docs/platvormi arendus/t25-org-e0-arendusvalmiduse-audit.md`) |
| E1 skeem ja migratsioonid | A + B | DONE |
| E2 access-context ja capability | A | DONE |
| E3 organisatsiooni elutsükkel ja struktuur | A | DONE |
| E4 kutsed, liikmed, õigused | A | DONE (reporting-line jäi viilu C) |
| E5 rollipõhised kohad ja hinnastus | B | DONE |
| E6 tööruumivahetaja ja UI | A + B | DONE |
| E7 vastuvõtt, määramine, üleandmine | B + teavituskiht | DONE |
| E8 teenuseosutaja org-profiil | C | DONE |
| E9 tööheaolu toe tarne | C | DONE |
| E10 offboarding, eksport, audit | A + B + C | DONE |
| E11 teavitused ja observability | teavituskiht + C | DONE |
| E12 QA | kõik viilud | DONE |

---

## 3. Omaniku otsused ja kus need koodis on

| Otsus | Teostus | Kontroll |
|---|---|---|
| **O-E0-1** pöördujast ei saa liiget; sponsorlus ei nõua ruumi | `OrganizationSeatRole` = 2 väärtust; eraldi mudel `OrganizationClientSponsorship` ilma `roomId`-ta | `tests/org/funding.test.js` — kolm testi kolmel tasandil |
| **O-E0-2** `ORG_SPACE` aktiveeritud; resolver `resolveOrgAccessContext()` | `lib/workspaces/registry.js`, `lib/org/accessContext.js` | `tests/org/orgSpaceAdapter.test.js` |
| **O-E0-3** eraldi worktree'd | kaks worktree'd, main'is koodi ei ole | `git worktree list` |
| **O-E0-4** leping parandatud | 4 kohta arenduskavas | `git -C SotsiaalAI show f43dc89e` |

---

## 4. Andmemudel

**Viil A (7 mudelit):** `Organization`, `OrganizationModule`, `OrganizationUnit`,
`OrganizationMembership`, `OrganizationMembershipUnit`, `OrganizationCapabilityGrant`,
`OrganizationInvite`.

**Viil B (5 mudelit):** `OrganizationSeatPlan`, `OrganizationSeatAssignment`,
`OrganizationInboxItem`, `OrganizationWorkAssignment`, `OrganizationClientSponsorship`.

**Viil C (3 mudelit):** `OrganizationReportingLine`, `OrganizationSupportContact`,
`WellbeingSupportShare`.

> `WellbeingSupportShare` on kogu töö kõige tundlikum tabel ja tema kuju on tahtlik:
> `sourceRecordId` ja `sourceDraftId` on **stringid ilma `@relation`-ita**. Võõrvõti oleks
> mugavam, aga ta ühendaks organisatsioonikihi tööheaolu kirjetega — ja §D8 keelab täpselt
> selle. Jagatud tekst elab `sharedSnapshotJson`-is koopiana; lähtekirje muutumine EI muuda
> juba saadetut, ja saaja ei jõua kunagi originaalini.

**Migratsioonid:**

| Fail | Iseloom |
|---|---|
| `20260801000000_org_foundation_v1` | **puhtalt aditiivne** — ei ALTER-da ühtegi olemasolevat tabelit |
| `20260801120000_org_funding_inbox_v1` | aditiivne + **ainult nullable veerud** `Subscription`-ile ja `PreInquiry`-le, + 2 enum-väärtust |
| `20260802090000_org_profile_support_v1` | **ainus destruktiivne** — `ServiceProviderProfile` omandirežiim (vt allpool) |

Kaht esimest kontrollib test, mitte lubadus:
`tests/org/contracts.test.js` → „migration is purely additive";
`tests/org/funding.test.js` → „only adds nullable columns", „no UPDATE or DELETE".
Kolmandat kontrollib `tests/org/profileSupport.test.js` → „the migration destroys no data"
(ridu ei kustutata, tabeleid ei kaotata, uus veerg tuleb `DEFAULT 'SOLO'`-ga).

**Viilu C omandirežiimi muutus** — kolm sammu, mis peavad koos käima:

1. `ownerId` muutub nullitavaks ja FK `Cascade` → **`SET NULL`**. Enne seda hävitas konto
   kustutamine organisatsiooni teenuseprofiili. See oli E0 leid, mis jäi NOT_PROVEN-iks.
2. Globaalne `ServiceProviderProfile_ownerId_key` asendub **osalise** indeksiga
   `WHERE "ownershipMode" = 'SOLO' AND "ownerId" IS NOT NULL`. Nii saab endine omanik pärast
   üleandmist teha uue solo-profiili, ilma et kaks solo-profiili ühele inimesele võimalikuks
   muutuks. Prisma skeemikeeles seda väljendada ei saa — indeks on migratsioonis käsitsi.
3. CHECK `ServiceProviderProfile_ownership_chk` teeb režiimi ja organisatsiooni sidumise
   andmebaasi tasandil kohustuslikuks. Teenusekiht valvab sama asja; see on teine lukk.

**DB-tasemel invariandid (10 osalist unikaalindeksit, 12 CHECK-i)** — nimekiri on
migratsioonifailide osas 2. Olulisemad:

- organisatsioon ei saa jõuda `ACTIVE` seisu ilma `verifiedAt`-ita;
- capability skoop on XOR (`UNIT` nõuab üksust, `ORGANIZATION` keelab);
- üks aktiivne liikmesus / moodul / põhiüksus / koht / elav määramine;
- üksuse sügavus 1…3.

**Rollback:** iga migratsiooni osas 3. Viil A = `DROP` vastupidises järjekorras, mõju
olemasolevatele andmetele null. Viil B = FK-d ja nullable veerud maha; **kaks enum-väärtust
JÄÄVAD**, sest Postgres ei võimalda neid eemaldada ilma tüüpi ümber ehitamata — see on
migratsioonifailis hoiatusena kirjas.

**Viil C rollback on ainus, millel on VÄRAV.** Tagasi saab minna ainult siis, kui
`SELECT count(*) FROM "ServiceProviderProfile" WHERE "ownershipMode" = 'ORGANIZATION'`
annab **nulli**. Põhjus: globaalne unikaalindeks eeldab, et igal profiilil on omanik ja
igal omanikul üks profiil. Organisatsiooniprofiilidel omanikku ei pruugi olla — nad ei
mahu tagasi. Värav on migratsioonifailis kirjas suurtähtedega, mitte kommentaarina.

---

## 5. Privaatsusinvariandid — kus igaüht tõendatakse

| Invariant (arenduskava) | Tõend |
|---|---|
| §D8 `WellbeingRecord` ei saa org-omandivõtit | `tests/org/contracts.test.js` skeemitest |
| §4 org-kiht ei viita ühelegi privaatobjektile | skeemitestid mõlemas viilus, 10 mudelinime vastu |
| §7.4 juht ei näe kasutusstatistikat | `toClientContext` projektsioonitest + `listMembers`/`listSeatPlans` projektsioonid |
| §6 võõras org = 404 | `tests/org/accessContext.test.js` + runtime A + runtime B |
| §11.1 platvormi admin ei saa drill-down'i | resolver-test + runtime A |
| §5.4 üksuse skoop ei leki õdeüksusesse | `tests/org/units.test.js` + **runtime B: õdeüksuse koordinaator ei näe kirjet** |
| §5.5 kutse on teadlik nõustumine | eelvaade ja nõustumine on eri route'id |
| §5.7 Teekonda ei jagata | `tests/org/inbox.test.js` + **brauseris: vastuses ei ole `sourceJourneyId`-d** |
| §5.7 üleandmine ei laienda ulatust | runtime B võrdleb võtmekomplekte enne ja pärast |
| §D3 org-roll ei ole globaalne roll | `Role` enum = täpselt 4 väärtust |
| §D5/§D6 hind, õigus ja maksja on eri teljed | runtime B: koht ei anna capability't; capability ei anna kohta |
| §5.6 maksmine ei ole nägemisõigus | runtime B: sponsoreeritud pöörduja saab org-konteksti pärides 404 |
| §D8 tööheaolu kirje ei muutu org-varaks | `tests/org/profileSupport.test.js` skeemitestid: `WellbeingSupportShare`-il **ei ole `@relation`-it** kirjete tabelitesse |
| §9 jagatakse koopiat, mitte ligipääsu | `sanitizeSnapshot` valge nimekiri (5 välja) + **runtime C: saaja vaates ei ole `sourceRecordId`, `sourceDraftId` ega omanikku** |
| §9 skoorimine ei ole jagatav | test loetleb `computedSignal`, `riskMarkers`, `loadFactors`, `standardizedFields`, `scoringVersion` — ükski ei tohi valges nimekirjas olla |
| §9 jagamine on suunatud, mitte laiali | runtime C: suvalisele kolleegile saata ei saa — ainult juht või tugikontakt |
| §9 avatud jagamist ei saa olematuks teha | runtime C: avamise järel tagasivõtmine keeldub; parandus on UUS avaldus, originaali tekst jääb |
| §10 eksport ei kanna isiklikku sisu | `assertExportIsClean` **aktiivne kaitse** + `EXPORT_EXCLUSIONS` nimeline loend |
| §8 avalik profiil ei lekita omandit | `toPublicProfileProjection`: `ownershipMode`, `organizationId`, `ownerId` ei tule läbi |

---

## 6. Käivitatud kontrollid

**Viil A** (`C:/Users/rauds/Desktop/SotsiaalAI-org-foundation-v1`):

| Käsk | Tulemus |
|---|---|
| `npm test` | 2106/2106 |
| `npx eslint .` | 0 viga |
| `npm run i18n:check` | OK |
| `npm run build` | OK |
| `npm run db:migrate:check` | täisahel nullist OK |
| `node --import ./scripts/register-node-test-loader.mjs scripts/org-foundation-runtime-check.mjs` | **35/35**, 0 jääki |

**Viil B** (`C:/Users/rauds/Desktop/SotsiaalAI-org-funding-inbox-v1`):

| Käsk | Tulemus |
|---|---|
| `npm test` | **2138/2138** |
| `npx eslint .` | 0 viga |
| `npm run i18n:check` | OK (et/en/ru) |
| `npm run build` | OK |
| `npm run db:migrate:check` | täisahel nullist OK |
| `node --import ./scripts/register-node-test-loader.mjs scripts/org-funding-runtime-check.mjs` | **50/50**, 0 jääki |

Samad käsud jooksevad ka integreeritud puus `origin/main`-i vastu — vt ptk 6b.

> **NB `npm run lint` juurkataloogis annab exit 1** — 705 „viga" tulevad
> `.claude/worktrees/**/.next/**` buildiartefaktidest, mida eslint skaneerib.
> **Päris koodis on 0 viga**; kontrolli `npx eslint lib app components tests scripts`.
> See on olemasolev seadistuse puudujääk, mitte selle töö tulemus.

---

## 6a. Viil C ja teavituskiht — kontrollid

| Käsk (`SotsiaalAI-org-profile-support-v1`) | Tulemus |
|---|---|
| `npm test` | **2155/2155** |
| `npx eslint lib app components tests scripts` | 0 viga |
| `npm run i18n:check` | OK (et/en/ru) |
| `npm run build` | OK |
| `npm run db:migrate:check` | täisahel nullist OK |
| `node --conditions=react-server … scripts/org-profile-support-runtime-check.mjs` | **42/42**, 0 jääki |

> `--conditions=react-server` on selle skripti puhul KOHUSTUSLIK: ta impordib
> `lib/serviceProviderProfiles.js`, mis toob kaasa `server-only` paketi. Ilma
> konditsioonita see pakett VISKAB. Import on tahtlik — solo-rada tõendatakse
> PÄRIS funktsiooniga, mitte koopiaga.

**Viilu C runtime tõendab mh:**

- toeavalduse saaja projektsioonis EI OLE `sourceRecordId`, `sourceDraftId` ega omanikku;
- snapshot'i valge nimekiri viskab välja `computedSignal`, `riskMarkers`, `loadFactors`;
- suvalisele kolleegile toeavaldust saata EI SAA — ainult juht või tugikontakt;
- avamise järel tagasi võtta ei saa; parandus on UUS avaldus ja originaali tekst jääb puutumata;
- tagasivõetud avaldus kaob saaja loendist ja teda ei saa avada;
- professionaalse toe moodul NÕUAB alternatiivset tugiteed ja viimast ei saa eemaldada;
- **organisatsiooni teenuseprofiil JÄÄB ALLES, kui looja konto kustutatakse** — see on E8
  kandvaim tõend, sest enne seda viilu hävitas `Cascade` selle;
- endine omanik saab pärast üleandmist teha uue solo-profiili (osaline unikaalindeks);
- kaks SOLO-profiili ühele omanikule on võimatu (P2002);
- SOLO-profiil ei saa kanda organisatsiooni (CHECK).

**Väravate suletus brauseris (ilma sessioonita):** `/api/org`, `/tugi`, `/tugi/avaldused`,
`/teenusprofiil`, `/eksport`, `/inbox`, `/seats` — kõik **401**, kõik identse 48-baidise
vastusega, ka olematu organisatsiooni ID puhul. Ükski otspunkt ei erista olemasolevat
organisatsiooni olematust.

---

## 6b. Integratsiooniproov praeguse `origin/main`-i vastu

`origin/main` on liikunud auditeeritud baasist **14 commit'i edasi** (analüütika UI, Luna RAG
kõvendus, admini dokk). Proov tehti eraldi PUHTAS worktree's, lokaalset `main`-i puutumata:

```bash
git worktree add --detach C:/Users/rauds/Desktop/SotsiaalAI-integration-probe origin/main
cd C:/Users/rauds/Desktop/SotsiaalAI-integration-probe && git merge codex/org-profile-support-v1
```

Tulemus: **merge läks konfliktideta** — 115 faili, +18601/−39. Ainus kattuv fail oli
`messages/*.json`, kus `org` plokk on faili lõpus ja nende muudatused mujal.

| Kontroll integreeritud puus | Tulemus |
|---|---|
| `npx prisma validate` | OK |
| `npm run db:migrate:check` | **täisahel nullist OK** |
| `npm test` | **2168/2168** |
| `npx eslint lib app components tests scripts` | 0 viga |
| `npm run i18n:check` | OK (et/en/ru) |
| `npm run build` | OK |

> Proov leidis ÜHE vea, mis harudes ei paistnud: kasutamata import
> `scripts/org-profile-support-runtime-check.mjs`-is. Viilu C oma lint-käivitus
> kattis `lib app components`, aga mitte `scripts`-i. Parandatud allikas, mitte
> proovis — ja see on põhjus, miks integratsiooniproov tehakse enne main'i, mitte
> pärast.

Proovi-worktree on kustutatav:
`git worktree remove C:/Users/rauds/Desktop/SotsiaalAI-integration-probe --force`.
Merge-commit `4bb50994` ei ole ühelgi harul ja kaob GC-ga; proov on ülal oleva kahe käsuga
korratav.

---

## 7. Mida runtime tõendas, mida ühiktestid ei suutnud

### Kohaletoimetamise rikkestsenaarium (kontrolli punkt 4)

**Enne parandust:** `PreInquiry` salvestati ja alles pärast commit'i loodi
`OrganizationInboxItem`. Postkastikirje tõrge oleks jätnud `SENT` pöördumise, mida
organisatsioon **ei näe**, samal ajal kui saatja usub, et see on kohale toimetatud. Vaikne
kadu, mida kumbki pool ei märka.

**Pärast parandust:** salvestus ja kohaletoimetamine on samas tehingus
(`lib/preInquiries.js`, `createPreInquiry` ja `updatePreInquiry`). Tehing avatakse **ainult**
org-adressaadi korral; isikliku vastuvõtja rada on baithaaval muutmata.

**Tõend on veasüst, mitte väide.** `scripts/org-funding-runtime-check.mjs` süstib tõrke
`OrganizationInboxItem.create`-sse ja saadab uue pöördumise:

| Kontroll | Tulemus |
|---|---|
| tõrge jõuab kutsujani, mitte ei kao vaikselt | PASS |
| tõrke järel EI JÄÄ ripakil `SENT` pöördumist (loend muutumatu) | PASS |
| lepitusvaade on tühi — ükski `SENT` org-pöördumine ei ole ilma postkastikirjeta | PASS |
| lepitusel ei ole midagi parandada | PASS |

> **Metoodiline hoiatus, mis ise oleks peaaegu vale rohelise andnud.** Esimene veasüst
> asendas `prisma.organizationInboxItem.create` — ja EI JÕUDNUD KOHALE, sest tehingu sees
> kasutatakse `tx`-i, mis on eri objekt. Test „möödus" ilma midagi kontrollimata. Süst tuleb
> teha tehingukliendi tasemel (`dbWithFailingInboxCreate` proksib `$transaction`-i).
> Kes seda kontrollib, peaks veenduma, et süst päriselt viskab — mitte et test on roheline.

**Lepitus on lisaks olemas ka funktsioonina:** `findUndeliveredOrganizationInquiries` ja
`reconcileOrganizationDeliveries` (`lib/org/inbox.js`). Need EI OLE outbox — outbox eeldab, et
kadu on lubatud ja hiljem järele jõutakse. Siin kadu ei ole lubatud; need on tõend ja võrk
enne atomaarsust loodud ridade jaoks.

### Samaaegse kohaletoimetamise idempotentsus (kontrolli punkt 5)

`findFirst → create` on võistlusaken: kaks samaaegset kohaletoimetamist näeksid mõlemad
tühjust. Unikaalindeks päästaks andmed, aga kasutaja saaks `P2002` → 500. Nüüd loetakse
kokkupõrge õnnestumiseks ja tagastatakse võitja rida.

| Kontroll | Tulemus |
|---|---|
| kolm samaaegset kohaletoimetamist õnnestuvad kõik | PASS |
| kõik kolm annavad SAMA postkastikirje | PASS |
| dubleeritud rida ei teki (`count = 1`) | PASS |

### Kolm viga, mille leidis runtime, mitte ühiktestid

Kaks esimest leiti enne kontrolli, kolmas kontrolli punkti 4 lahendamisel:

1. **Seisumasinas puudus `RECEIVED → ASSIGNED`** — kirje jäi määramise järel `RECEIVED`-i ja
   vastuvõtmine ei jõudnud kunagi `ACCEPTED`-isse. Ühiktest kontrollis siirdetabelit, mitte
   läbivat rada.
2. **Pesastatud tehing** — `recallInboxItemForSource` kutsuti eelpöördumise oma tehingu seest,
   aga avas ise uue; Prisma tehingukliendil ei ole `$transaction`-it. Oleks visanud iga
   org-adressaadiga tagasivõtmise peal. Lahendus: `runInTransaction` (`lib/org/inbox.js`).

3. **Pesastatud tehing tuvastamise heuristikas.** Punkti 2 lahendus oli `runInTransaction`,
   mis nuuskis `typeof db.$transaction === "function"`, et otsustada, kas avada tehing.
   **Mõõtsin: Prisma interaktiivsel tehingukliendil ON `$transaction` olemas** — seega
   heuristika avas pesastatud tehingu just seal, kus ta pidi jooksma kutsuja tehingus. Viga
   oli vaikne: rida tekkis, aga mitte kutsuja tehingus, ja rollback ei oleks teda tagasi
   keeranud. Asendatud selgesõnalise paariga — `…Within(tx, …)` ei ava kunagi tehingut,
   avalik `…(input, { db })` avab. Kutsuja ütleb, süsteem ei arva.

Lisaks tõendas runtime B **seat-limiidi võistluse**: kaks samaaegset nõuet viimasele vabale
kohale → täpselt üks koht. Kaitse on kahekordne — `SELECT … FOR UPDATE` plaanireal ja osaline
unikaalindeks.

### Viil C — mida runtime tõendas ja mida testid oleks lasknud mööda

**Kandev tõend:** runtime loob organisatsiooniprofiili, **kustutab selle loonud kasutaja
konto** ja kontrollib, et profiil on ikka alles. Enne viilu C hävitas `Cascade` selle
vaikselt. Ühiktest ei saanud seda kunagi näidata — ta loeb migratsioonifaili teksti, mitte
Postgresi käitumist konto kustutamisel.

Teised runtime-ainsad tõendid:

- endine omanik saab pärast üleandmist teha **uue** solo-profiili — see töötab ainult siis,
  kui osaline indeks on päriselt osaline. Globaalse indeksiga oleks P2002.
- kaks solo-profiili ühele omanikule annavad P2002 — indeks ei ole liiga lõtv.
- SOLO-profiil organisatsiooniga → CHECK viskab. Teenusekiht valvab sama; siin mõõdeti,
  et teine lukk päriselt olemas on.
- professionaalse toe moodulit ei saa jätta ilma alternatiivse tugiteeta: viimase
  `ALTERNATE_SUPPORT` kontakti eemaldamine keeldub, kui moodul on aktiivne. See on
  inimlik invariant, mitte tehniline — kellelgi peab alati olema teine tee.

**Kolm asja, mis viilu C tegemisel valesti läksid ja mida tasub kontrollida:**

1. **Prisma nõudis `organizationId` peale `@unique`-i** (1:1 valideerimine). Postgresis
   NULL-id ei põrku, seega organisatsioonita profiile võib olla palju — aga kontrolli üle,
   et see on tõesti unikaalne indeks, mitte kogemata tekkinud 1:1 piirang seal, kus
   1:N oli mõeldud.
2. **Kaks skeemitesti otsisid keelatud mudelinimesid ka KOMMENTAARIDEST** ja andsid vale
   punase. Lisasin `schemaCodeOnly()`. Esimene versioon ei töötanud, sest fail on CRLF ja
   JS-i `.` ei kata `\r`-i — `//.*` jättis rea lõpu alles. Kasutusel on `/\/\/[^\n]*/gu`.
   Kes seda loeb: see on väike asi, aga sama muster tapab iga regexi selles repos.
3. **`tests/availabilityContract.test.js` väitis vana päringukuju.** Ma ei kustutanud
   testi ega lõdvendanud teda — ta väidab nüüd
   `findFirst({ ownerId, ownershipMode: "SOLO" })`. Testi PÄRIS mõte (saadavuse päring
   käib omaniku, mitte profiili ID järgi) on alles.

---

## 8. Brauseri-QA (autenditud, päris sessioon)

**Viil A:** kolm viga leitud ja parandatud — mustand-organisatsioon kuvas „on peatatud";
nimeta liikme e-post kuvati kaks korda; põhiüksuse silt oli laenatud struktuurivaatest.

**Viil B:** üks viga leitud ja parandatud — juba koha saanud liige jäi „Anna koht"
valikuloendisse.

**Tõendatud brauseris:** kohaplaani loomine vormist; koha andmine, mille järel `payerSource`
lendas päises „Sina ise" → „Organisatsioon"; eelpöördumine `/api/pre-inquiries` kaudu sai
`recipientType = ORGANIZATION_INBOX` ja jõudis vastuvõtulauale; kirje avamine märkis
`openedAt`; vastuses **ei ole** `sourceJourneyId`-d ja väljakomplekt on täpselt 12-võtmeline;
mobiil 390×844 ilma horisontaalse ülevooluta; konsool ja serverilogi puhtad.

**Viil C: autenditud brauseri-QA-d EI TEHTUD.** Ütlen selle otse, sest see on ainus
koht, kus viil C jääb A-st ja B-st nõrgemaks. Lokaalne NextAuth-sessioon oli aegunud ja
uut ma luua ei saa — mandaatide sisestamine ei ole minu teha. Asendustõend on
**suletud-vaikimisi kontroll**, mitte väide: kõik seitse org-otspunkti (`/api/org`,
`/tugi`, `/tugi/avaldused`, `/teenusprofiil`, `/eksport`, `/inbox`, `/seats`) vastavad
ilma sessioonita **401**-ga, kõik identse 48-baidise kehaga, **ka olematu organisatsiooni
ID puhul** — seega otspunkt ei lekita isegi seda, kas organisatsioon on olemas.

Mida see asendus EI kata: viilu C lehtede päris renderdust, vormide käitumist ja
mobiilivaadet 390×844. **See on ainus lahtine QA-saba kogu CORE-V1-s** ja ta on
kirjas ka ptk 9 all.

---

## 9. NOT_PROVEN

1. **Klaviatuurirada, ekraanilugeja, 200% tekst, värvikontrast** — struktuursed eeldused on
   paigas ja kontrollitud (`aria-current`, `caption`, `th[scope]`, `aria-label`, mobiilis
   tabel → kaardid), aga päris abivahendiga läbi käidud ei ole.
2. **Tootmis-DB** — kõik mõõtmised kohalikus dev-baasis.
3. **Gate väljas brauseris** — tõendatud ühiktestis ja resolveris (0 päringut), aga dev-server
   jooksis lipud sees.
4. **Kutse ja sponsorluse e-kiri** — neid ei saadeta üldse (vt ptk 10).
5. **Viilu C lehtede autenditud brauseri-QA** — vt ptk 8. Väravad on suletud-vaikimisi
   tõendatud, sisuvaated mitte. **Kõige olulisem lahtine asi selles dokumendis.**
6. **Push `origin`-isse ja deploy** — kood on lokaalses `main`-is, aga seda ei ole
   push'itud ega serverisse viidud. Serveri käitumise kohta ei ole ühtegi mõõtmist.

**Mis EI OLE enam NOT_PROVEN:** viilude omavaheline koostöö. Iga viil hargneb eelmise
tipust, seega viilu C väravad jooksevad kõigi kolme koodi peal korraga. Integratsioon
praeguse `origin/main`-iga on eraldi worktree's läbi proovitud (ptk 6b) ja lokaalses
`main`-is merge'i järel uuesti (ptk 6c).

---

## 10. NOT_DONE — teadlikult, põhjendustega

| Asi | Miks |
|---|---|
| **Kutse ja sponsorluse e-kiri** | Link antakse kutsujale, kes edastab ise. Mis kirjas seisab, on eraldi otsus §4 „e-kirjadesse ei panda tundlikku sisu" all |
| **`DomainEvent` org-sündmused** | U1 register on suletud, valideeritud ja oma gate'i taga. Sündmus tuleb koos päris SAAJAGA. Audit on `DataAuditLog`-is |
| **Org-checkout ja arve** | §D6 järgi tulevane hinnastusotsus, mitte CORE-V1 |
| **Toeavalduse e-kiri saajale** | Teavitus on platvormisisene (`ORG_WORK_ASSIGNED` rada). Toeavalduse sisu ei tohi e-kirja minna; kiri kannaks kas tühja vihjet või tundlikku teksti — mõlemad halvad |

**Mis oli varem selles tabelis ja on nüüd tehtud:**

- **Saatjale nähtav adressaat** (§5.7). `serializePreInquiry` projitseerib nüüd
  `recipientOrganization` — **täpselt kaks välja: `displayName` ja `legalKind`**
  (`lib/preInquiries.js:594`). Mitte kogu organisatsiooniobjekt: saatja ei pea nägema
  ei mooduleid, ei üksusi, ei staatust. Adressaadi nägemine on saatja õigus,
  organisatsiooni siseehitus ei ole.
- **Neutraalsed teavitused** — `ORG_WORK_ASSIGNED` (`lib/notifications.js`). Teavitus ei
  kanna pöörduja sisu, ainult viite `/org/vastuvott/<id>`. Saaja-kontroll nõuab **elavat
  määramist JA aktiivset liikmesust** — kui üks neist kaob, ei ole teavitus enam avatav.
- **Viil C tervikuna** — E8, E9, E10.

---

## 11. Teadaolevad riskid

1. **Dev-baasi minu-eelne draif** — `HelpMatch` indeks, `Invite.tokenHash` indeks,
   `UserDocument` veerutüübid. `prisma migrate dev` tahab baasi **lähtestada**. Ma ei
   lähtestanud; migratsioonid kirjutati offline-diffiga ja rakendati `migrate deploy`-ga.
2. **Org-audit skaneerib** — `DataAuditLog.resourceType/resourceId` on indekseerimata
   (E0 leid L10). Viilude mahus on ridu vähe; kuuma vaate korral vajab indeksit.
3. **`OrganizationWorkAssignment.assignee` on `Restrict`** — teadlik, see hoiab ära töö
   vastutaja vaikse kadumise. Hind: organisatsiooni **päris** kustutamine nõuab määramiste
   eemaldamist eraldi sammuna.
4. **Olematu org-i LEHT vastab 200-ga**, mitte 404-ga — Next-i voogedastus `force-dynamic`
   all. Sisu on korrektne not-found, org-välju ei lekita, API annab 404. Turvaomadus kehtib.
5. **Täislaadimisel dubleerub DOM** (2× `h1`) — **olemasolev viga**, kordub ka `/refleksioon`
   lehel, aga mitte `/tellimus`-el. SSR-i HTML on korrektne. Mõõdetud ainult dev-režiimis.
6. **`CLIENT` ei saa organisatsiooni luua** — tuleneb otse O-E0-1-st, aga leping ei sätesta
   seda otsesõnu. Kui pöörduja peab saama organisatsiooni luua, on see eraldi otsus.
7. **Viil C sisaldab CORE-V1 ainsat destruktiivset migratsiooni.** `ServiceProviderProfile`
   kaotab globaalse `ownerId` unikaalindeksi ja saab osalise
   (`WHERE ownershipMode = 'SOLO' AND ownerId IS NOT NULL`). Tagasikeeramine on **väravaga**:
   migratsioonifail nõuab, et `count(*) WHERE ownershipMode = 'ORGANIZATION'` oleks null.
   Kui organisatsiooniprofiile on juba tekkinud, EI TOHI rollback'i teha — globaalne indeks ei
   mahutaks neid tagasi. Serveris on see kord, kus migratsiooni tuleb vaadata enne, mitte pärast.
8. **`ServiceProviderProfile.ownerId` on nüüd nullitav.** Iga kood, mis eeldas, et profiilil
   on alati omanik, peab seda taluma. Ma parandasin kolm teadaolevat kohta
   (`lib/serviceProviderProfiles.js`), aga see on mustri-, mitte punktirisk.

---

## 12. Cleanup

Kolme viilu runtime-skriptid koristavad enda järelt ja tõendavad seda: viil A `0 jääki`,
viil B `0 organisatsiooni, 0 kasutajat`, viil C `0 jääki` (sh 0 teenuseprofiili,
0 toeavaldust). Brauseri-QA andmed kustutatud käsitsi; kontrollitud: dev-baasis
0 organisatsiooni, 0 postkastikirjet, 0 kohaplaani.

Sünteetilised nimeruumid: `@t25-runtime.invalid`, `@t25-fund.invalid`,
`@t25-profile.invalid`, organisatsiooni nimes sõna `sünteetiline`.

Alles jäänud worktree'd (kustutatavad, kui kontroll on tehtud):
`SotsiaalAI-org-foundation-v1`, `SotsiaalAI-org-funding-inbox-v1`,
`SotsiaalAI-org-profile-support-v1`, `SotsiaalAI-integration-probe`.

---

## 13. Mida kontrollijal tasub esimesena vaadata

1. **Kohaletoimetamise rikkestsenaarium.** `lib/preInquiries.js` — kas salvestus ja
   `deliverPreInquiryToOrganizationWithin` on päriselt SAMAS tehingus, ja kas tehing avatakse
   ainult org-adressaadi korral. Käivita veasüst
   (`scripts/org-funding-runtime-check.mjs`, ptk „3a") ja **veendu, et süst päriselt viskab** —
   naiivne `prisma`-tasemel süst ei jõua tehingusse ja annaks vale rohelise. Kontrolli ka, et
   `findUndeliveredOrganizationInquiries()` tagastab tühja loendi.
2. **Viilu C destruktiivne migratsioon** — `prisma/migrations/20260802090000_org_profile_support_v1/`.
   See on kogu CORE-V1 ainus migratsioon, mis midagi maha võtab. Kontrolli kolme asja:
   osaline indeks katab solo-juhtumi, `ON DELETE SET NULL` on päriselt kohal (mitte `Cascade`),
   ja rollback'i värav on kirjas. `tests/org/profileSupport.test.js` väidab kõike kolme —
   loe migratsioonifail ise üle.
3. **Kas `projectSourcePackage` on päriselt valge nimekiri** — `lib/org/inbox.js`. See on
   ainus koht, kust pöörduja sisu organisatsioonini jõuab.
4. **Kas `sanitizeSnapshot` ja `toRecipientView` on päriselt valged nimekirjad** —
   `lib/org/supportShare.js`. See on ainus koht, kust tööheaolu sisu inimesest välja jõuab.
   Vaata eraldi, et `ALLOWED_SNAPSHOT_FIELDS` ei sisalda ühtegi skoorimisvälja ja et
   saaja vaates ei ole teed lähtekirjeni tagasi.
5. **Kas `resolveOrgAccessContext` on ainus tee org-kontekstini** — `lib/org/accessContext.js`.
   Kui mõni route ehitab konteksti mööda seda, on värav katki.
6. **Kas seat-limiidi lukk on päris** — `lib/org/seats.js` `assignSeat`, `SELECT … FOR UPDATE`.
7. **Kas eelpöördumise liitekoht muutis nähtavusreeglit** — `visiblePreInquiryWhere`
   `lib/preInquiries.js`-is peab olema **muutmata**. Kui ta on muutunud, on mõjuala teine kui
   siin lubatud.
8. **Kas `lib/serviceProviderProfiles.js` kolm ümberkirjutatud päringut on õiged** — need on
   ainsad kohad, kus viil C muutis OLEMASOLEVAT käitumist. Solo-profiili otsing peab nüüd
   filtreerima `ownershipMode: "SOLO"`; kui filter kaob, hakkab teenuseosutaja nägema
   organisatsiooni profiili enda omana.
9. **Kas eksport lekib** — `lib/org/export.js`. `assertExportIsClean` on aktiivne kaitse, mitte
   dokumentatsioon: proovi lisada väljundisse `sharedSnapshotJson` või `situation` ja vaata,
   kas ta viskab.
