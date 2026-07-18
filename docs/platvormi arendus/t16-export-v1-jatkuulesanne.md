# JÄTKUÜLESANNE: T16 `EXPORT-V1` — lõpeta pooleliolev eksport ja andmekoopia

**Olek:** `IN_PROGRESS_PAUSED`  
**Jätka ainult siin:** `C:\Users\rauds\Desktop\SotsiaalAI-export-v1`  
**Haru:** `codex/export-v1`  
**Praegune HEAD:** `4be2153f58f61a46d5692d49f0b7180a3f820fcb` — EXPORT-P0 on juba stack'is; otsene parent on T02 `929793f1339ce5754ae0206b87450e8ee1689e48`.  
**Remote:** harul puudub kohalik upstream; remote SHA on praegu tõendamata. Ära loo uut worktree'd või uut haru enne selle töö lõpetamist.

## Eesmärk

Lõpeta olemasolev T16 töö samas harus: kasutaja saab turvalise enda-andmete ZIP-koopia, näeb töö olekut, saab selle piiratud ajal alla laadida ning konto kustutuse eel teha ausa koopia-valiku. Üksik artefakti-/failiallalaadimine jääb eraldi toiminguks. Mitte ühegi teise inimese sisu, märkme, ruumisõnumi, tokeni või audititoorvälja ei tohi koopiasse sattuda.

## Loe enne

1. `docs/platvormi arendus/t16-export-v1-ulesanne.md` tervikuna — see on siduv V1 leping.
2. `CLAUDE.md` ja `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`.
3. Selle worktree tegelik `git status` ja olemasolev diff **enne ühegi faili muutmist**.
4. T02 lõpparuanne / `codex/account-v1 @ 929793f1`; ära tee konto sessiooni- või kustutuslepingut nõrgemaks.

## Juba tehtud WIP — säilita ja lõpeta

Teine teostaja lõi, kuid ei commit'inud:

- muudetud: `components/alalehed/ProfiilBody.jsx`, `lib/notifications.js`, `lib/retention.js`, `messages/en.json`, `messages/et.json`, `messages/ru.json`, `prisma/schema.prisma`;
- uued: `lib/dataExport/registry.js`, `lib/dataExport/service.js`, `lib/dataExport/zip.js`, `components/profile/DataExportPanel.jsx`, migratsioon `prisma/migrations/20260717143000_data_export_v1/migration.sql`, `tests/dataExport/dataExportService.test.js`;
- uued API-rajad: `app/api/data-export/route.js`, `app/api/data-export/[id]/route.js`, `app/api/data-export/[id]/download/route.js`, `app/api/jobs/data-exports/route.js`.

Seni kavandatud alus: omaniku-põhine allowlist-registry, ZIP-manifest, aegumine ja omanikukontrolliga allalaadimine, profiilipaneel, teavituste/retentioni laiendus ning DataExportJob skeem/migratsioon. Seda ei kirjutata nullist ümber; esmalt paranda skeemi-, import-, tüübi- ja lepingurikked ning ehita puuduv osa selle peale.

## Jätkamise järjekord

### 1. Stabiliseeri alus

- Kontrolli Prisma skeemi, migratsiooni ja importide tegelik korrektsus; kasuta ainult lokaalset/isoleeritud andmebaasi ning genereeri klient ohutu testühendusega.
- Kontrolli registry iga pinna omaniku-filtrit ja minimaalset serialiseerijat. Puuduv adapter = „ei ekspordita”, mitte üldine tabeli dump.
- Kontrolli ZIP-i voog, manifest, failinimed, suurusepiirid, ajutise faili puhastus, allalaadimise headerid ja aegumine.

### 2. Lõpeta serveri elutsükkel

- `DataExportJob` peab olema ühe aktiivse töö, idempotentsusvõtme, advisory-lock/CAS, cancel/retry/failure/expiry ja omaniku-404 lepinguga.
- Taotlus nõuab T02 serveripoolset step-up'i. Admin ega teine kasutaja ei saa kasutaja nimel koopiat luua või alla laadida ilma olemasoleva autoriteetse aluseta.
- Teavituse/outbox payload sisaldab ainult töö ID-d, olekut ja turvalist linki; ei ZIP-i, sisu, tokenit ega teise isiku identifikaatorit.
- Retention eemaldab aegunud ZIP-i, ajutised osad ja tundliku väljundiviite. Audit jääb minimaalseks ja sisutuks.

### 3. Seo ausalt konto kustutusega

- Enne pöördumatut kustutusetappi saab inimene valida „koosta koopia”, „oota kuni 7 päeva” või „jätka ilma koopiata”.
- Koopia-valik ei hoia sessioone avatuna ega muuda T02 anonüümset `202 pending` vastust. Ooteaja lõpp, cancel, ready, expiry ja „ilma koopiata” jätkamine on idempotentsed.
- Ära puutu kolmandate isikute sisu, ruumisõnumeid, adressaadi märkmeid, salvestisi või admini koondeid.

### 4. Lõpeta kasutajatee ja tõendid

- Profiilis erista üksiku faili allalaadimist tervikandmekoopiast; näita sisu, välja jäetud osi, seisu, aegumist, tühistamist ja viga ausalt.
- Säilita ET/EN/RU pariteet, klaviatuur, aria-live, mobiil ja reduced-motion.
- Laienda olemasolevat `tests/dataExport/dataExportService.test.js` ning lisa route-/retention-/kustutusvoo testid vastavalt algse T16 lepingu kaheksale testilepingule.

## Kontrollid ja piirid

Käivita T16 sihttestid ja kahjustatud regressioonid, muudetud failide lint, `npm run i18n:check`, Prisma validate, migratsiooniahela kontroll, `git diff --check` ja production build. Täissviit ning sõltumatu release-audit jäävad T27-sse.

Sünteetiline runtime tõendab ainult lokaalses test-DB-s: request → ready → download → expiry, võõra kasutaja 404, cancel/race, kustutuse koopia-valik ning cleanup. Päris kasutajaandmeid, päris e-kirja, välissalvestust, merge'i, deploy'd, rebase'i ega force-push'i ei tehta.

## Lõpp

Tee **üks** normaalne lõppcommit, push'i `origin/codex/export-v1` ja anna üle: worktree/haru, baas, EXPORT-P0/T02 aluscommits, lõppcommit ja remote SHA, migratsioonid, testid, runtime/cleanup või `NOT_RUN`, V1-st välja jäetud andmeliigid ning kinnitus, et main/server/merge/deploy jäid puutumata.
