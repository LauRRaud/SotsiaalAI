# T25 `ORG-WORKSPACE-V1` — kogu arenduse kokkuvõte kontrollimiseks

Kuupäev: **01.08.2026**
Alusleping: `docs/platvormi arendus/t25-org-workspace-v1-arenduskava-opusele.md`
Staatus: **E0 + viil A tehtud. Viil B on funktsionaalselt valmis, kuid E7 on `PARTIAL` — vt ptk 2.
Push'imata, main'i merge'imata, deploy'mata. Integratsioon `origin/main`-iga on eraldi worktree's
läbi proovitud (ptk 6a).**

See dokument on kirjutatud KONTROLLIMISEKS. Iga väide on siin kas Git-fakt, käivitatav
käsk või viide failile ja reale. Kus midagi ei ole tõendatud, on see öeldud otse.

---

## 1. Git-faktid

| Ese | Väärtus |
|---|---|
| Lähtebaas (E0 auditeeritud) | `952a76e3aea0eb94a1cb622c78cc22fb1abf93fb` |
| Viil A haru | `codex/org-foundation-v1` |
| Viil A tipp | `40dc95b1` (2 commit'i: `074030fc`, `40dc95b1`) |
| Viil B haru | `codex/org-funding-inbox-v1`, parent `40dc95b1` |
| **Viil B RAKENDUSTIPP** | **`b508fc647ccf3cad3892a5b3412b221ab5a4f5d4`** — viimane commit, mis muudab rakenduskoodi |
| **Viil B haru HEAD** | rakendustipp + käesolev dokument (dokumendi-commit ei muuda rakenduskoodi) |
| `origin/main` praegu | `cf7b0f1840ef09602619758e62252e30410de158` — **14 commit'i baasist edasi liikunud** |
| Lokaalne `main` | `c08d18fd`, 7 commit'i ees `origin/main`-ist, push'imata |
| Integratsiooniproov | `4bb509942a7f7eb6d50a48cacd4cb0549dd0b34b` (detached, `origin/main` + viil B) |
| Merge main'i / deploy | **ei tehtud** |

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

**Kontrollkäsud:**

```bash
git -C C:/Users/rauds/Desktop/SotsiaalAI-org-foundation-v1 log --oneline 952a76e3..HEAD
```

```bash
git -C C:/Users/rauds/Desktop/SotsiaalAI-org-funding-inbox-v1 log --oneline 40dc95b1..HEAD
```

Lokaalse `main`-i 7 commit'i on E0 aruanne, parandatud arenduskava, SEIS, analüütikatöö,
koolitusmaterjalid, RAG-hindamise dokumendid, `.gitignore` korrastus ja `launch.json` kirjed.
**Viilu A ja B kood ei ole main'is.**

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
| E7 vastuvõtt, määramine, üleandmine | B | **PARTIAL** — vt allpool |
| E8 teenuseosutaja org-profiil | C | **TEGEMATA** |
| E9 tööheaolu toe tarne | C | **TEGEMATA** |
| E10 offboarding, eksport, audit | osaliselt A + B | offboarding DONE, **eksport tegemata** |
| E11 teavitused ja observability | osaliselt | audit DONE, **teavitused ja e-kirjad tegemata** |
| E12 QA | A + B | DONE oma viilude ulatuses |

### Miks E7 on `PARTIAL`

Vastuvõtt, määramine, vastuvõtmine, tagasilükkamine ja üleandmine on tehtud ja tõendatud.
**Kaks arenduskava §5.7 nõuet on tegemata:**

1. **Saatjale nähtav täpne adressaat.** §5.7 nõuab, et pöörduja näeks enne saatmist adressaati
   kujul „organisatsiooni vastuvõtutiim". Server salvestab `recipientOrganizationId`, aga
   `serializePreInquiry` ei projitseeri seda ja saatja UI ei kuva midagi — org-adressaadiga
   pöördumisel on `selectedRecipientName` null.
2. **Neutraalsed teavitused.** §5.7 nõuab, et autor saaks töö üleandmisel neutraalse teate uue
   vastutaja kohta, ja et e-kiri sisaldaks ainult fakti ja turvalist linki. **Ühtegi teavitust
   ei saadeta** — ei kutsel, ei sponsorlusel, ei määramisel, ei üleandmisel.

Kuni need on tegemata, ei tohi E7 lugeda `DONE`-iks.

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

**Migratsioonid:**

| Fail | Iseloom |
|---|---|
| `20260801000000_org_foundation_v1` | **puhtalt aditiivne** — ei ALTER-da ühtegi olemasolevat tabelit |
| `20260801120000_org_funding_inbox_v1` | aditiivne + **ainult nullable veerud** `Subscription`-ile ja `PreInquiry`-le, + 2 enum-väärtust |

Mõlemat kontrollib test, mitte lubadus:
`tests/org/contracts.test.js` → „migration is purely additive";
`tests/org/funding.test.js` → „only adds nullable columns", „no UPDATE or DELETE".

**DB-tasemel invariandid (10 osalist unikaalindeksit, 12 CHECK-i)** — nimekiri on
migratsioonifailide osas 2. Olulisemad:

- organisatsioon ei saa jõuda `ACTIVE` seisu ilma `verifiedAt`-ita;
- capability skoop on XOR (`UNIT` nõuab üksust, `ORGANIZATION` keelab);
- üks aktiivne liikmesus / moodul / põhiüksus / koht / elav määramine;
- üksuse sügavus 1…3.

**Rollback:** mõlema migratsiooni osas 3. Viil A = `DROP` vastupidises järjekorras, mõju
olemasolevatele andmetele null. Viil B = FK-d ja nullable veerud maha; **kaks enum-väärtust
JÄÄVAD**, sest Postgres ei võimalda neid eemaldada ilma tüüpi ümber ehitamata — see on
migratsioonifailis hoiatusena kirjas.

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

Samad käsud jooksevad ka integreeritud puus `origin/main`-i vastu — vt ptk 6a.

> **NB `npm run lint` juurkataloogis annab exit 1** — 705 „viga" tulevad
> `.claude/worktrees/**/.next/**` buildiartefaktidest, mida eslint skaneerib.
> **Päris koodis on 0 viga**; kontrolli `npx eslint lib app components tests scripts`.
> See on olemasolev seadistuse puudujääk, mitte selle töö tulemus.

---

## 6a. Integratsiooniproov praeguse `origin/main`-i vastu

`origin/main` on liikunud auditeeritud baasist **14 commit'i edasi** (analüütika UI, Luna RAG
kõvendus, admini dokk). Proov tehti eraldi PUHTAS worktree's, lokaalset `main`-i puutumata:

```bash
git worktree add --detach C:/Users/rauds/Desktop/SotsiaalAI-integration-probe origin/main
cd C:/Users/rauds/Desktop/SotsiaalAI-integration-probe && git merge codex/org-funding-inbox-v1
```

Tulemus: **merge läks konfliktideta** (ainus kattuv fail oli `messages/*.json`, kus minu `org`
plokk on faili lõpus ja nende muudatused mujal). Merge-commit `4bb50994`.

| Kontroll integreeritud puus | Tulemus |
|---|---|
| `npx prisma validate` | OK |
| `npm run db:migrate:check` | **täisahel nullist OK** |
| `npm test` | **2151/2151** (origin/main tõi 13 testi juurde) |
| `npx eslint lib app components tests scripts` | 0 viga |
| `npm run i18n:check` | OK (et/en/ru) |
| `npm run build` | OK |
| viilu A runtime | 35/35, 0 jääki |
| viilu B runtime | **50/50**, 0 jääki |

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

---

## 9. NOT_PROVEN

1. **Klaviatuurirada, ekraanilugeja, 200% tekst, värvikontrast** — struktuursed eeldused on
   paigas ja kontrollitud (`aria-current`, `caption`, `th[scope]`, `aria-label`, mobiilis
   tabel → kaardid), aga päris abivahendiga läbi käidud ei ole.
2. **Tootmis-DB** — kõik mõõtmised kohalikus dev-baasis.
3. **Gate väljas brauseris** — tõendatud ühiktestis ja resolveris (0 päringut), aga dev-server
   jooksis lipud sees.
4. **Kutse ja sponsorluse e-kiri** — neid ei saadeta üldse (vt ptk 10).
5. **Integratsioon lokaalse `main`-iga** — lokaalne `main` (`c08d18fd`) on 7 commit'i ees
   `origin/main`-ist ja tema tööpuu on määrdunud (võõrast pooleliolevat CSS-tööd). Viile ei ole
   selle vastu proovitud ja EI TOHI enne, kui see töö on lõpetatud.
   **Viil A ja B ON koos testitud** — viil B hargneb viilu A tipust `40dc95b1`, seega kõik
   viilu B väravad jooksevad mõlema koodi peal korraga. Integratsioon PRAEGUSE `origin/main`-iga
   on eraldi läbi proovitud, vt ptk 6a.

---

## 10. NOT_DONE — teadlikult, põhjendustega

| Asi | Miks |
|---|---|
| **Kutse ja sponsorluse e-kiri** | Link antakse kutsujale, kes edastab ise. Mis kirjas seisab, on eraldi otsus §4 „e-kirjadesse ei panda tundlikku sisu" all |
| **`DomainEvent` org-sündmused** | U1 register on suletud, valideeritud ja oma gate'i taga. Sündmus tuleb koos päris SAAJAGA. Audit on `DataAuditLog`-is |
| **Saatjale nähtav adressaat** | Arenduskava §5.7 nõuab, et pöörduja näeks adressaati kujul „organisatsiooni vastuvõtutiim". Server salvestab `recipientOrganizationId`, aga `serializePreInquiry` ei projitseeri seda ja saatja UI ei kuva. **See on lahtine saba viilus B** |
| **Viil C tervikuna** | E8, E9, E10 eksport — teenuseprofiili omandirežiim, tööheaolu toe tarne, org-eksport |
| **Org-checkout ja arve** | §D6 järgi tulevane hinnastusotsus, mitte CORE-V1 |

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

---

## 12. Cleanup

Mõlema viilu runtime-skriptid koristavad enda järelt ja tõendavad seda: viil A `0 jääki`,
viil B `0 organisatsiooni, 0 kasutajat`. Brauseri-QA andmed kustutatud käsitsi;
kontrollitud: dev-baasis 0 organisatsiooni, 0 postkastikirjet, 0 kohaplaani.

Sünteetilised nimeruumid: `@t25-runtime.invalid`, `@t25-fund.invalid`, organisatsiooni
nimes sõna `sünteetiline`.

---

## 13. Mida kontrollijal tasub esimesena vaadata

1. **Kohaletoimetamise rikkestsenaarium.** `lib/preInquiries.js` — kas salvestus ja
   `deliverPreInquiryToOrganizationWithin` on päriselt SAMAS tehingus, ja kas tehing avatakse
   ainult org-adressaadi korral. Käivita veasüst
   (`scripts/org-funding-runtime-check.mjs`, ptk „3a") ja **veendu, et süst päriselt viskab** —
   naiivne `prisma`-tasemel süst ei jõua tehingusse ja annaks vale rohelise. Kontrolli ka, et
   `findUndeliveredOrganizationInquiries()` tagastab tühja loendi.
2. **Kas migratsioonid on päriselt aditiivsed** — `tests/org/contracts.test.js` ja
   `tests/org/funding.test.js` väidavad seda; loe migratsioonifailid üle.
2. **Kas `projectSourcePackage` on päriselt valge nimekiri** — `lib/org/inbox.js`. See on
   ainus koht, kust pöörduja sisu organisatsioonini jõuab.
3. **Kas `resolveOrgAccessContext` on ainus tee org-kontekstini** — `lib/org/accessContext.js`.
   Kui mõni route ehitab konteksti mööda seda, on värav katki.
4. **Kas seat-limiidi lukk on päris** — `lib/org/seats.js` `assignSeat`, `SELECT … FOR UPDATE`.
5. **Kas eelpöördumise liitekoht muutis nähtavusreeglit** — `visiblePreInquiryWhere`
   `lib/preInquiries.js`-is peab olema **muutmata**. Kui ta on muutunud, on mõjuala teine kui
   siin lubatud.
