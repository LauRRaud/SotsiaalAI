# T25 viil A `ORG-FOUNDATION-V1` — lõppüleandmine

Kuupäev: **01.08.2026**
Alusleping: `docs/platvormi arendus/t25-org-workspace-v1-arenduskava-opusele.md` ptk 9.1 „Viil A"
Eelnev värav: `docs/platvormi arendus/t25-org-e0-arendusvalmiduse-audit.md` (ORG-E0, omaniku otsused O-E0-1…4)

**Seis: viil A kood valmis, kõik automaatväravad rohelised, COMMIT'IMATA. Ootab omaniku vastuvõttu.**

---

## 1. Haru, tööpuu, baas

| Fakt | Väärtus |
|---|---|
| Worktree | `C:/Users/rauds/Desktop/SotsiaalAI-org-foundation-v1` |
| Haru | `codex/org-foundation-v1` |
| Parent SHA | `952a76e3aea0eb94a1cb622c78cc22fb1abf93fb` (auditeeritud E0-s; == `origin/main`) |
| Commit'e | **0 — töö on tööpuus, commit'imata** |
| Remote SHA | — (push'i ei tehtud) |
| Põhitööpuu | **puutumata** koodi osas; muudetud ainult kaks dokumenti (leping + SEIS) |
| Merge / deploy | **ei tehtud** |

Worktreesse kopeeriti `.env` (gitignore'itud), et Prisma ja migratsioonid töötaksid. See ei ole muudatus repos.

---

## 2. Muudetud ja lisatud failid

**Muudetud (8 faili, +1121 / −3):**

| Fail | Mida |
|---|---|
| `prisma/schema.prisma` | +314 rida: 11 enumit, 7 mudelit, tagasiviited `User`-is ja `Municipality`-s |
| `lib/workspaces/registry.js` | `ORG_SPACE`: `RESERVED` → `SUPPORTED`, adapter `orgSpace` (O-E0-2) |
| `messages/{et,en,ru}.json` | +265 rida igasse: `org.*` plokk, täielik pariteet |
| `app/styles/globals.css` | +1 `@import` |
| `tests/workspaces/{workspaceContract,caseworkContract}.test.js` | `org_space` liikus SUPPORTED-nimekirja — teadlik lepingumuudatus |

**Uued (56 faili, ~6 680 rida):**

- `prisma/migrations/20260801000000_org_foundation_v1/migration.sql`
- `lib/org/` — 9 faili: `constants`, `flags`, `errors`, `units`, `accessContext`, `invites`, `inviteService`, `organizations`, `structure`, `members`, `audit`
- `lib/workspaces/adapters/orgSpaceAdapter.js`
- `app/api/org/` — 12 route-faili + `_shared.js`
- `app/org/` — 8 lehte + `_serverContext.js` + `OrgHomeClient.jsx`
- `components/org/` — 9 komponenti
- `app/styles/org-workspace.css` (`ow-*`)
- `tests/org/` — 5 testifaili (89 testi)
- `scripts/org-foundation-runtime-check.mjs`

---

## 3. Skeem ja migratsioon

Migratsioon `20260801000000_org_foundation_v1` on **puhtalt aditiivne**: ühtegi olemasolevat tabelit, veergu
ega piirangut ei muudeta. Seda kontrollib ka test (`tests/org/contracts.test.js`).

**Mudelid:** `Organization`, `OrganizationModule`, `OrganizationUnit`, `OrganizationMembership`,
`OrganizationMembershipUnit`, `OrganizationCapabilityGrant`, `OrganizationInvite`.

**Osalised unikaalindeksid** (Prisma skeemikeel ei väljenda `WHERE`-i):

- üks AKTIIVNE liikmesus org+kasutaja kohta;
- üks AKTIIVNE moodul org+moodulivõtme kohta;
- üks aktiivne põhiüksus liikmesuse kohta;
- üks aktiivne rida (liikmesus, üksus) kohta;
- üks PENDING kutse org + `lower(email)` kohta;
- üks kehtiv grant (liikmesus, capability, skoop) kohta.

**CHECK-piirangud:**

- capability skoop on XOR (`UNIT` nõuab üksust, `ORGANIZATION` keelab);
- üksuse sügavus 1…3; juurüksus = 1; üksus ei ole iseenda vanem;
- `ENDED` liikmesusel on `endedAt`, aktiivsel mitte;
- **organisatsioon ei saa jõuda `ACTIVE` seisu ilma `verifiedAt`-ita** — aktiveerimisvärav on DB-s, mitte ainult UI-s.

**Rollback** on migratsioonifaili lõpus (osa 3): `DROP TABLE` vastupidises järjekorras + `DROP TYPE`.
Olemasolevaid andmeid see ei puuduta.

**Üks modelleerimisparandus jooksu käigus:** `OrganizationCapabilityGrant.scopeUnitId` FK oli algselt
`RESTRICT`. Runtime-koristus näitas, et see blokeerib organisatsiooni päris kustutamise (org → üksus kaskaad
jääb grandi taha kinni). Muudetud `CASCADE`-iks — üksuseta üksuse-skoop on niikuinii mõttetu, ja tavakäigus
üksust ei kustutata, vaid arhiveeritakse.

---

## 4. Realiseeritud etapid

| Etapp | Seis | Sisu |
|---|---|---|
| E1 (viilu A osa) | DONE | skeem, enumid, migratsioon, raw-SQL invariandid, rollback |
| E2 | DONE | `resolveOrgAccessContext` (`lib/org/accessContext.js`), fail-closed membership/module/capability, üksuse skoobi pärilus, `payerSource` |
| E3 | DONE | organisatsiooni elutsükkel, moodulite aktiveerimine, üksuste CRUD + tsükli/sügavuse keeld |
| E4 | DONE (reporting-line välja arvatud → viil C) | kutse, eelvaade, accept/decline/revoke/expire, capability-mallid, grant/revoke, liikme peatamine ja lahkumine |
| E6 (põhivaated) | DONE koodis, **NOT_PROVEN brauseris** | `/org` + 7 vaadet, kontekstipäis, ET/EN/RU |
| E11 (viilu A osa) | OSALINE | `DataAuditLog` kaudu auditeeritud haldustoimingud + org-auditi projektsioon. **Teavitusi ja e-kirju viilus A EI OLE** — vt ptk 7 |
| E12 (viilu A QA) | DONE | vt ptk 6 |

---

## 5. Privaatsusinvariantide tõendid

| Invariant (arenduskava) | Tõend |
|---|---|
| §D8 `WellbeingRecord` ei saa org-omandivõtit | `tests/org/contracts.test.js` — skeemitest: mudelis ei ole `organizationId` ega `Organization` |
| §4 org-kiht ei viita ühelegi privaatobjektile | skeemitest 10 mudelinime vastu (`Conversation`, `Journey`, `UserDocument`, supervisioon, mentorlus, kovisioon jt) |
| §7.4 juht ei näe kasutusstatistikat | `toClientContext` projektsioonitest: serialiseeritud vastuses ei ole `lastSeen`, `lastActive`, `usage`, `conversation`, `wellbeing`, `riskScore`, `messageCount` |
| §6 võõras org = 404, mitte 403 | resolver-test + runtime: org 1 omanik saab org 2 kohta 404, sama vastuse saab olematu ID |
| §11.1 platvormi admin ei saa drill-down'i | resolver-test + runtime: `isPlatformAdmin: true` ilma liikmesuseta → 404 |
| §5.4 üksuse skoop ei leki õdeüksusesse | `units.test.js` + runtime: `UNIT_LEAD` tiimil A ei kata tiimi B ega ülemüksust |
| §5.5 kutse on teadlik nõustumine | eelvaade (`GET`) ja nõustumine (`POST`) on eri toimingud; eelvaade ei muuda midagi |
| §5.5 e-posti domeen ei tekita liikmesust | `invites.test.js`: sama domeen + teine inimene → tagasi lükatud |
| §D3 organisatsioonisisene roll ei ole globaalne roll | skeemitest: `Role` enum on täpselt 4 väärtust, `MANAGER`/`ORG_ADMIN`/`TEAM_LEAD` puuduvad |
| O-E0-1 pöördujast ei saa liiget | `OrganizationSeatRole` enumis ei ole `CLIENT`-i — kontrollitud nii konstandis kui skeemis |
| Audit ei salvesta täisaadressi | `maskEmail` + runtime-kontroll: ükski auditirida ei sisalda kutsutu e-posti |
| §10 gate väljas = pind puudub | `flags.test.js` + resolver-test: väljas olles ei tehta ühtegi org-päringut ja vastus on 404 |

---

## 6. Käivitatud kontrollid

| Käsk | Tulemus |
|---|---|
| `npx prisma validate` | skeem kehtiv |
| `npx prisma migrate deploy` | migratsioon rakendus kohalikku dev-baasi |
| `npm run db:migrate:check` | **täisahel ajutises baasis: OK** (109 migratsiooni nullist) |
| `npm run lint` | 0 viga |
| `npm run i18n:check` | et/en/ru pariteet OK |
| `npm run build` | õnnestus; kõik 12 `/api/org/*` ja 8 `/org/*` route'i registreeritud |
| `npm test` | **2106/2106** (varem 2017; +89 uut) |
| `node scripts/org-foundation-runtime-check.mjs` | **35/35**, cleanup 0 jääki |

### Runtime-stsenaarium (35 kontrolli, sünteetilised `@t25-runtime.invalid` kontod)

Tõendatud päris andmebaasi vastu — see, mida `npm test` fake-Prismaga ei saa:

- elutsükkel: DRAFT ei hüppa ACTIVE-sse; mitte-admin ei verifitseeri iseennast; **toor-SQL ei suuda aktiveerida
  verifitseerimata organisatsiooni** (CHECK);
- struktuur: kolm tasandit lubatud, neljas keelatud nii teenusekihis kui **toor-SQL-is** (CHECK);
- kutsed: vale isik, tundmatu token, korduskasutus ja topeltkutse — kõik suletult tagasi; DB-s ainult räsi;
- skoop: `UNIT_LEAD` katab alampuu, **ei kata õdetiimi**, ei anna omanikku ega liikmehaldust;
- isolatsioon: org 1 omanik ei näe org 2; platvormi admin saab sama 404; gate väljas → 404 ka päris liikmele;
- DB-invariandid: topelt-aktiivne liikmesus võimatu (osaline unikaalindeks); org-skoobiga grant ei saa üksust (CHECK);
- offboarding: kõik capability'd tühistatud, üksused suletud, **konto alles**, teine organisatsioon puutumata,
  viimane omanik ei saa lahkuda;
- audit: ≥8 rida, ükski ei sisalda täisaadressi;
- cleanup: 0 sünteetilist jääki.

---

## 7. NOT_DONE / NOT_PROVEN / OUT_OF_SCOPE

### NOT_PROVEN

1. **Brauseri-QA on tegemata.** `/org` lehtede päris renderdus, navigatsioon, mobiil (390×844), klaviatuur,
   ekraanilugeja ja 200% tekst on **kontrollimata**. Põhjus on protseduuriline, mitte tehniline: projekti reegel
   nõuab dev-serveri käivitamist `preview_start`-i `next-dev` konfiga, mis osutab PÕHItööpuule — seal seda koodi ei
   ole, ja põhitööpuu muutmine oli keelatud. Verifitseerimiseks:
   ```bash
   cd C:/Users/rauds/Desktop/SotsiaalAI-org-foundation-v1 && ORG_WORKSPACE_ENABLED=1 ORG_CREATION_ENABLED=1 npm run dev
   ```
2. **A11y-audit** (fookusjärjekord, kontrast, dialoogiprimitiiv) — kood järgib nõudeid (`aria-current`, `caption`,
   `scope`, värv ei ole ainus seisukandja, mobiilis tabel → kaardid), aga mõõdetud ei ole.
3. **Tootmis-DB seis** — kõik mõõtmised tehti kohalikus dev-baasis.
4. **Samaaegsuse võistluskatsed** (kaks paralleelset kutse-vastuvõttu, kaks üksuse liigutamist) — invariandid on
   tehingus ja osalises unikaalindeksis, aga päris võistlust ei simuleeritud.

### NOT_DONE (teadlikult, viilu A ulatuses)

- **Kutse e-kiri.** Kutse loomine tagastab toore lingi kutsujale, kes edastab selle ise. E-kirja saatmine nõuab
  eraldi otsust, mis kirjas seisab (§4: „e-kirjadesse ei panda tundlikku sisu") ja kuulub teavituste liitekohta.
- **`DomainEvent`/`NotificationEvent` org-sündmused.** U1 registri (`lib/events/registry.js`) on suletud
  valideeritud register oma gate'i taga. Org-sündmuste lisamine sinna on mõttekas siis, kui neil on päris SAAJA
  (kutse-teavitus, töö määramine) — see tuleb viiluga, mis selle saaja loob. Viilus A on audit `DataAuditLog`-is.
- **Reporting-line ja tugikontaktid** — lepingu järgi viil C.

### OUT_OF_SCOPE

Kõik viilu B ja C mudelid ja funktsioonid. Ühtegi tühitabelit ega „igaks juhuks" välja ei lisatud
(arenduskava §9.2).

---

## 8. Gate'ide seis

| Lipp | Vaikimisi | Mida avab |
|---|---|---|
| `ORG_WORKSPACE_ENABLED` | **VÄLJAS** | kogu `/org` ja `/api/org` pind |
| `ORG_CREATION_ENABLED` | **VÄLJAS** | organisatsiooni loomine; nõuab lisaks ülemist lippu |

Väljas olles: leht annab 404, API annab 404, **ühtegi org-päringut andmebaasi ei tehta** (tõendatud spy-testiga).
Viilude B ja C lipud lisab see viil, mis nad kasutusele võtab.

---

## 9. Teadaolevad riskid

1. **Org-audit skaneerib.** `DataAuditLog.resourceType/resourceId` on indekseerimata (E0 leid L10) ja
   `/org/[orgId]/audit` filtreerib `meta.organizationId` järgi. Viilu A mahus on ridu vähe; kui vaade muutub
   kuumaks, vajab ta indeksit või eraldi projektsioonitabelit.
2. **Dev-baasi olemasolev draif.** `prisma migrate dev` tahtis lähtestada baasi kolme MINU-EELSE erinevuse tõttu
   (`HelpMatch` indeks, `Invite.tokenHash` indeks, `UserDocument` veerutüübid). **Baasi ei lähtestatud**;
   migratsioon kirjutati offline-diffiga ja rakendati `migrate deploy`-ga. Draif on endiselt olemas ja puudutab
   järgmist arendajat, kes `migrate dev`-i käivitab.
3. **`CLIENT` ei saa organisatsiooni luua.** `seatRoleForProductRole` tagastab pöörduja rolli korral `null` ja
   loomine annab 403. See tuleneb otseselt sellest, et `OrganizationSeatRole`-is ei ole `CLIENT`-i (O-E0-1), aga
   see on tooteotsus, mida leping otsesõnu ei sätesta. Kui pöörduja peab saama organisatsiooni luua, on see
   eraldi otsus.
4. **Kutse link on ühekordne kuva.** Kui kutsuja lingi kaotab, tuleb saata uus kutse. Teadlik, aga UX-mõju on
   päriskasutuses mõõtmata.

---

## 10. Definition of Done — viilu A ulatuses

| Nõue | Seis |
|---|---|
| Kasutaja saab isiklikku ja mitut org-konteksti turvaliselt kasutada | DONE (runtime tõendatud) |
| KOV saab luua struktuuri, kutsuda töötajaid, anda õigusi | DONE |
| Olemasolevad tellimused, hinnad ja isiklikud tööruumid ei regressi | DONE — 2106/2106, migratsioon aditiivne |
| Migratsioonid ja rollback kontrollitud | DONE — täisahel nullist OK |
| ET/EN/RU, lint, build, sihitud testid rohelised | DONE |
| A11y ja mobiil | **NOT_PROVEN** |
| Kahe org-i negatiivne runtime tõendab serveripoolset lahusust | DONE |
| Feature-gate väljas = pärisandmete kõrvalmõju null | DONE |
| Commit/push omaniku ulatuses | **commit'imata — ootab luba** |
| Merge/deploy | ei tehtud, ei kuulu DoD-sse |

**Programm peatub siin ja ootab omaniku vastuvõttu enne viilu B (`ORG-FUNDING-INBOX-V1`).**
