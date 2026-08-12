# SotsiaalAI SOL-süvaaudit — jätk: Tööheaolu

**Auditi seis:** staatiline süvaaudit `DONE`; päris HTTP/PostgreSQL/runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `c9cefd285e082c70ab7f573c0ab130d578f57a98`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-mat-c9cefd2` (detached HEAD). Põhiprojekti liikuvat koodi ega commit'imata parandusi ei kasutatud tõendina.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Lehed ja sisenemisteed | DONE | `/tooheaolu`, `/toolaud/tooheaolu`, tööriista detail, „Minu kirjed”, piloodi- ja adminivaated |
| React ja kasutaja toimingud | DONE | kümme töövoogu, salvestus, detail, parandus, kustutus, kontrollpunkt, mustand ja Kovisiooni üleandmine |
| API ja autoriseerimine | DONE | ühine autentimis-/rolli-/tellimusvärav, records, output-drafts, pilot ja admin |
| Äriloogika ja andmemudel | DONE | records, aggregate, checkpoint, recommendations, output drafts, pilot scope/viewer ja migratsioonid |
| Samaaegsus ja idempotentsus | DONE | kirjete dedupe, paranduse advisory-lock, drafti CAS/lukk ja Kovisiooni/Supervisiooni handoff |
| Andmekoopia, konto kustutus ja retention | DONE | `WellbeingRecord`, `WellbeingOutputDraft`, kasutaja FK-d, export registry; ajapõhist kustutuspoliitikat ei tõendatud |
| Päris runtime | NOT_PROVEN | HTTP-brauserit, PostgreSQL-i ega päris ajastatud tööd ei käivitatud; `runtime: not_run` |

## Auditeeritud failid ja funktsioonid

- `app/tooheaolu/**`, `app/toolaud/tooheaolu/**`, `components/wellbeing/**`: tööriistade register, töövood, `MyRecordsWorkflow`, `SupportRequestPanel`, piloodi- ja adminivaated.
- `app/api/wellbeing/**`: `_shared`, records/detail/correction/checkpoint/recommendation, output-drafts/CAS, covision/supervision handoff, aggregate/pilot/admin.
- `lib/wellbeing/**`: kirjete ehitajad ja valideerimine, `createWellbeingRecordDeduped`, `list/get/delete/correct`, aggregate, checkpoint, draftid ja lukud.
- `lib/supervision/wellbeingHandoff.js`, `lib/wellbeing/covisionHandoff.js`.
- `prisma/schema.prisma:1485-1640` ja Tööheaolu migratsioonid; `lib/dataExport/registry.js:67-83,138-142`; konto kustutuse seosed.
- Põhiauditi `SOL-WB-01`–`SOL-WB-14` ja `parandusaudit.md` koondrida kontrolliti enne uute ID-de andmist.

## Leiud

### SOL-WB-15 — „Minu kirjed” ja mustandid lõpevad vaikides 100/50 rea juures — P2

**Tõend.** `listWellbeingRecordsForUser()` piirab vastuse maksimaalselt 100 reale ja `listWellbeingOutputDraftsForUser()` 50 reale (`lib/wellbeing/records.js:171-175,486-505`; `lib/wellbeing/supportDrafts.js:66-70,225-239`). Kumbki päring ega route ei võta ega tagasta kursorit või koguarvu (`app/api/wellbeing/records/route.js:13-21`; `app/api/wellbeing/output-drafts/route.js:16-23`). `MyRecordsWorkflow` teeb ühe päringu kummalegi ning ei paku „laadi veel” toimingut (`components/wellbeing/MyRecordsWorkflow.jsx:96-139,226-305`). Staatiline negatiivkontroll kinnitas mõlemad piirid ja kursori puudumise. See ei dubleeri `SOL-WB-10`: too käsitleb admini/overview koondi 100 rea piiri, käesolev leid omaniku enda kronoloogiat ja mustandeid.

**Mõju.** Pikaajalisel kasutajal kaovad vanemad kirjed ning pooleli mustandid UI-st ilma teate või taastamisrajata. Filtrid ei lahenda mustandite piiri; kasutaja ei saa aru, et andmed on DB-s alles.

**Vastuvõtukriteerium.** Mõlemal omaniku loendil peab olema stabiilne cursor-paginatsioon, deterministlik sekundaarne järjestus, `hasMore` ja UI jätkamistoiming. Negatiivtest peab looma üle 100 kirje ja üle 50 mustandi, läbima kõik lehed täpselt ühe korra ning kontrollima lisamist/kustutamist lehtede vahel.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-WB-16 — salvestatud mustandit ei saa avada, jätkata ega kustutada — P1

**Tõend.** Mustand luuakse ja seda saab sama komponendi mälus PUT/PATCH-iga muuta (`SupportRequestPanel.jsx:118-197`), kuid `[id]` route ekspordib ainult `PUT` ja `PATCH`; `GET` ning `DELETE` puuduvad (`app/api/wellbeing/output-drafts/[id]/route.js:19-56`). „Minu kirjed” loetleb ainult kinnitamata mustandid, kuvab töövoo ja kuupäeva ning lubab avada üksnes seotud kirje, mitte mustandit ennast (`components/wellbeing/MyRecordsWorkflow.jsx:210-255`). Lähtekirje kustutamine kustutab vaid `WellbeingRecord` rea (`lib/wellbeing/records.js:535-546`); `WellbeingOutputDraft.sourceRecordId` on FK-ta tekstiväli (`prisma/schema.prisma:1577-1602`), mistõttu mustand jääb alles katkenud naasmispunktiga. Negatiivkontroll kinnitas detaili GET/DELETE ja mustandi avamis-/muutmis-/kustutustoimingu puudumise.

**Mõju.** „Salvesta privaatne mustand” lubab jätkatavat tööd, kuid lehelt lahkumise järel saab kasutaja näha ainult selle olemasolu. Ta ei saa tundlikku teksti taastada ega kustutada; seotud kirje kustutamine võib jätta privaatse tuletise püsima teadmata ajaks.

**Vastuvõtukriteerium.** Omanik-skoobitud detail, jätkamine ja idempotentne kustutus peavad olema API-s ja UI-s; lähtekirje kustutamisel peab leping selgelt pakkuma mustandite kaasakustutust või säilitamise teadlikku valikut. Negatiivtestid peavad katma võõra ID 404, stale CAS-i, handed-off mustandi kustutuspoliitika, katkenud `sourceRecordId` ning lehelt lahkumise järel jätkamise.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-WB-17 — kolm neljast toevalikust ei jõua tegeliku adressaadini — P1

**Tõend.** `SupportRequestPanel` pakub juhile memo, Kovisiooni sisendit, pilooditoe abipalvet ja mentori sisendit (`components/wellbeing/SupportRequestPanel.jsx:11-44`). Kõigi puhul saab teksti salvestada ja kinnitada, kuid ainus üleandmisfunktsioon on `startCovision()` ning ainult Kovisiooni puhul renderdatakse lõpunupp (`:199-250,352-383`). Kood ei kutsu organisatsiooni toe-, mentorluse- ega supervisiooni route'i. Eraldi `POST /api/wellbeing/output-drafts/[id]/supervision` ja serveriteenus nõuavad `recipientType="supervisor"`, kuid sellist valikut paneelis pole (`lib/supervision/wellbeingHandoff.js:7,100-110`; `app/api/wellbeing/output-drafts/[id]/supervision/route.js`). UI lõputeade ütleb üksnes, et kinnitatud versiooni ei saadeta automaatselt (`SupportRequestPanel.jsx:388-395`), pakkumata allalaadimist, kopeerimist, adressaadi valikut ega saatmist. Negatiivkontroll kinnitas, et neljast valikust on teostatud vaid `/covision` handoff.

**Mõju.** Kasutaja võib läbida tundliku toe küsimise vormi ja saada „jagatav versioon kinnitatud” tulemuse, kuid juht, pilooditugi või mentor ei saa midagi. Supervisiooni jaoks olemasolev turvaline serverirada on Tööheaolu UI-st kättesaamatu.

**Vastuvõtukriteerium.** Iga nähtav valik peab viima konkreetsesse, õigustega piiratud adressaadi-/ruumivoo toimingusse või olema ausalt nimetatud ainult kopeeritavaks privaatmustandiks. Supervisiooni valik peab kasutama olemasolevat CAS/handoff-lepingut; organisatsiooni ja mentorluse rajad peavad kasutama oma kinnitatud snapshot'i, mitte lähteandmeid. E2E-negatiivtest peab tõendama adressaadi puudumise, võõra organisatsiooni/protsessi, stale mustandi, topeltkliki ja osalise vea käitumise.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-WB-18 — kasutaja andmekoopia jätab mustandid ja kirjete elutsükliandmed välja — P1

**Tõend.** Andmekoopia registry ekspordib ainult `WellbeingRecord` read (`lib/dataExport/registry.js:138-142`) ning `wellbeingProjection()` jätab välja `aggregationEligible`, `supersedesRecordId`, `checkpointDueOn` ja `checkpoint` (`:67-83`). `WellbeingOutputDraft` ridu ei loeta üldse, kuigi need sisaldavad kasutaja loodud/muudetud teksti, adressaaditüüpi, kinnitusi ja handoff'i aega (`prisma/schema.prisma:1577-1602`). Staatiline negatiivkontroll kinnitas nii draftipäringu kui checkpoint-väljade puudumise. Konto kustutus on FK `onDelete: Cascade` kaudu tõendatud, kuid kustutamine ei asenda enne seda nõutavat täielikku andmekoopiat.

**Mõju.** Kasutajale väljastatud koopia ei võimalda taastada tema tööheaolu plaani, järelhindamist, parandusahelat ega privaatseid jagamismustandeid. Ekspordi manifest võib näida täielik, kuigi osa tundlikest isikuandmetest jääb välja.

**Vastuvõtukriteerium.** Andmekoopia peab eksportima kirjete täieliku omanikuvaate koos checkpoint'i ja parandusahela metaandmetega ning eraldi kõik omaniku `WellbeingOutputDraft` read ja handoff'i fakti; kolmanda isiku sisu tuleb allowlist-projektsiooniga välistada. Test peab sisestama kõik väljad, tegema paranduse ja handoff'i ning võrdlema ekspordi semantilist täielikkust DB omanikuvaatega.

**Seis (12.08.2026): DONE — koopia kannab nüüd elutsüklit, mitte hetketõmmist.**

Projektsioon jättis välja täpselt need väljad, mis teevad kirjest elutsükli: `aggregationEligible`,
`supersedesRecordId`, `checkpointDueOn` ja `checkpoint`. Kasutaja ei saanud oma plaani,
järelhindamist ega parandusahelat taastada, kuigi manifest näis täielik. Nüüd on nad kõik sees,
**pluss `supersededByRecordId`** — ahel peab olema loetav MÕLEMAST otsast, muidu ei saa koopia
lugeja aru, et vana kirje on asendatud — ja `checkpointAnsweredAt` (SOL-WB-07 skalaar).

**Mustandid said oma faili** (`wellbeing-output-drafts.ndjson`): kasutaja enda kirjutatud ja
toimetatud tekst, adressaaditüüp, kinnitused ja üleandmise aeg. `covisionCaseId` on teadlikult
VÄLJAS — kovisiooni juhtum on jagatud objekt ja tema ID ei kuulu ühe osaleja koopiasse; kaasa
käib ainult FAKT, et üleandmine toimus (`handedOff`).

**Neli ühikut ja värav, mis vananeb koos skeemiga:** test loeb `schema.prisma`-st mõlema mudeli
veerud ja nõuab, et iga veerg oleks kas eksporditud või **nimeliselt välistatud**. Nii kukub ta
siis, kui skeemi lisandub uus veerg ja keegi unustab otsustada, kas ta kuulub koopiasse — vaikne
väljajätmine oligi leid. **Negatiivkontroll:** vana projektsioon EI läbi seda väravat ja test
loetleb täpselt need viis veergu, mis puudu olid.

**Runtime:** päris ZIP-i ja päris kasutaja koopiat ei jooksutatud (`not_run`) — teenusetestid
katavad kogumise, aga mitte lõppfaili.

## Testid ja negatiivkontrollid

- `node --import ./scripts/register-node-test-loader.mjs --test tests/wellbeing/*.test.js tests/workspace/wellbeingTools.test.js`: **182/182 passed**, 0 failed.
- `node --import ./scripts/register-node-test-loader.mjs --test tests/i18n/wellbeingKeys.test.js`: **3/3 passed**, 0 failed.
- Kokku sihtteste: **185/185 passed**.
- Auditispetsiifiline staatiline negatiivkontroll: **10/10 kinnitatud** — records 100 cap, drafts 50 cap, cursorite puudumine, draft detaili GET/DELETE puudumine, UI avamis-/kustutusraja puudumine, ainult Kovisiooni handoff, supervisori valiku puudumine, draftide ekspordi puudumine, checkpoint'i ekspordi puudumine ja `sourceRecordId` FK puudumine.
- Päris HTTP/PostgreSQL/brauseri, paralleelsus- ja ajastatud checkpoint'i runtime: **not_run**.

## Kattuvused ja tõendamata osa

- `SOL-WB-01`–`SOL-WB-14` kontrolliti põhiauditist; `parandusaudit.md` näitab 0/14 ja aktiivses fikseeritud koodis ei olnud alust neid DONE-ks muuta. Neid ei dubleeritud.
- `SOL-WB-15` on eraldi `SOL-WB-10` admini/overview 100 rea leiust: omaniku records/drafts route'id ja UI on teine rada.
- Supervisiooni ja Kovisiooni sisemisi tervikahelaid ei avatud uuesti; kontrolliti ainult Tööheaolu sisenemis- ja üleandmispiiri.
- NOT_PROVEN: päris DB CAS/advisory-lock käitumine, checkpoint'i ajastatud teavitus, piloodi päris kasutajaõigused ning retention-job'i tegelik käik.

## Leidude kokkuvõte

| Prioriteet | Uusi leide |
|---|---:|
| P0 | 0 |
| P1 | 3 |
| P2 | 1 |
| P3 | 0 |
| **Kokku** | **4** |

**Järgmine auditiplokk:** Organisatsioonide põhiõiguste ja graafiku plokist välja jäänud vaated.
