# 07 — Opus järelkontroll: Tööheaolu kinnitatud mustand → päris Kovisioon

> **LÕPPOTSUS: `OPUS PARANDUSED VAJALIKUD`** — P0 puudub; 1 kitsas P1 (B-P1-1) blokeerib. Ülejäänu P2. Kasutaja otsus (2026-07-14): peatu, Sol parandab + regressioontest + kordusaudit enne uue arenduse jätkamist.
>
> **Audit B** faili `06-sol-tooheaolu-kovisioon-uleandmine-progress.md` §9 järgi.
>
> **Mudel / effort:** Claude Opus 4.8, Extra (`xhigh`)
>
> **Kontrollitav commit:** `9a46192b` (`Wellbeing: hand off confirmed drafts to Covision`)
>
> **Auditi tüüp:** read-only. Koodi/skeemi/dokumente EI muudetud, EI commit'itud, EI deploy'itud.
>
> **Kuupäev:** 2026-07-14

## 1. Tööpuu algseis

- `main` HEAD auditi ajal: `3b52f399`; auditeeriti fikseeritud `9a46192b`.
- Töökataloog puhas, v.a kasutaja kõrvalised ruumifailid — **puutumata**.

## 2. Kohustuslikult loetud / kontrollitud

`lib/wellbeing/covisionHandoff.js`, `supportDrafts.js`, `outputDraftLock.js`; `lib/covisionSession.js` (session-invariant), `covisionShared.js` (tuvastaja-detektor); `app/api/wellbeing/output-drafts/[id]/covision/route.js`, `.../[id]/route.js` (PUT), `_shared.js`; `components/wellbeing/SupportRequestPanel.jsx`; `prisma/schema.prisma` (`WellbeingOutputDraft`, migratsioon `20260714203000_wellbeing_covision_handoff`); testid `tests/wellbeing/covisionHandoff*.js`, `supportDrafts.test.js`. Spets: `06-sol-...progress.md` §3/§3.1/§6/§9.

## 3. Päriselt käivitatud kontrollid

Objektiivsed kontrollid on ühised Audit A-ga (sama `main`): `npm test` **1070/1070**, i18n OK, lint 0 viga, `db:migrate:check` 87 migratsiooni OK, build OK, diff puhas. Runtime-smoke (autentimata): `POST /api/wellbeing/output-drafts/:id/covision` ja `PUT /api/wellbeing/output-drafts/:id` → **401**. Migratsioon `20260714203000` on additiivne (nullable `covisionCaseId @unique` + `handedOffAt`, FK `SET NULL`), backfill puudub.

## 4. Leiud

### P0 — ei leitud

Kolm rünnakueesmärki — toor-Tööheaolu andmete / lähte-mustandi ID lekitamine osalejale, kahe juhtumi loomine, aegunud sisu jagamine — on kõik suletud (vt §6).

### P1 — 1 leid (päris viga)

**B-P1-1 — `SupportRequestPanel` mustandi-salvestusel puudub latest-request/abort-värav ja tekstiväli jääb muudetavaks → hiline vastus taastab oleku pärast lahkumist + kaotab lennult tehtud muudatused.**

- **Fail / read:** `components/wellbeing/SupportRequestPanel.jsx:63` (`isBusy` ainult `status`-est), `:65-75` (`changeEditedText` seab `status:"editing"` → isBusy false), `:87-95` (`leavePrivate`), `:97-138` (`saveDraft`), `:129-134` (resolve kirjutab oleku), tekstiväli `~:262-267` (pole `disabled`). Loetud `:55-138`.
- **Käivitustingimus:** kasutaja avab salvestatud `covision_input` mustandi → klõpsab „Salvesta" (PUT lennus, `status:"saving"`) → trükib ≥1 märgi (`changeEditedText`, `draft?.id` → `status:"editing"` → `isBusy` false, nupud taasavatakse) → klõpsab „Jäta privaatseks" (`leavePrivate` puhastab `selected/draft`) → algne PUT laheneb hiljem.
- **Mõju:** lahenenud PUT käivitab `setDraft/setEditedText/setStatus("draft_saved")`, taastades mustandioleku vastuolus kasutaja „jäta privaatseks" valikuga; eraldi kaob esimese POST-i ajal trükitud sisu serveri kaja alla (B-P2-1). Kolm covision/praktika-vaadet kasutavad kõik `createLatestRequestGate` + await-järgset id/versioonikontrolli; see paneel ei kasuta ühtki request-generatsiooni väravat.
- **Klass:** PÄRIS VIGA. Audit B skoop (commit `9a46192b`).
- **Miks P1, mitte P0:** mõjuala piiratud — paneel on peidetud (`selected` null pärast `leavePrivate`), server jõustab optimistliku samaaegsuse (`expectedUpdatedAt`) → **andmeterviklikkuse ega privaatsuse riski pole**; kahju on lokaalne olekuvastuolu + lennult tehtud sisendi kaotus. (Borderline P1/P2.)
- **Oodatav parandus:** võta kasutusele sama `createLatestRequestGate` (abort + monotoonne versioon), kontrollides jooksvust iga await järel enne oleku kirjutamist; JA/VÕI `disabled` tekstiväli + külmutatud `status`/`isBusy` lennus-salvestuse ajaks, et nupud ei taasavaneks mid-request.
- **Vajalikud regressioonitestid (repo mustri järgi source-contract; DOM-harnessi pole):** (1) `SupportRequestPanel` viitab `createLatestRequestGate`-ile (või samaväärsele request-generatsiooni väravale) mustandi-salvestusteel; (2) hiline `saveDraft`/PUT-vastus EI kirjuta olekut pärast `leavePrivate`/navigatsiooni (värav tühistab); (3) tekstiväli on `isBusy` ajal `disabled` või `status` ei lülitu salvestuse ajal `editing`-uks. Kui hiljem lisandub DOM/e2e harness, katta sama voog käitusaegselt.
- **Verifitseeritud Opuse poolt** (kood loetud `:55-138`).

### P2 — leiud

| ID | Leid | Fail | Klass |
|---|---|---|---|
| B-P2-1 | Esimese POST-i (`draft` null) ajal trükitud sisu kaob vaikselt: resolve kirjutab `editedText` üle serveri kajaga (sama juur kui B-P1-1) | `SupportRequestPanel.jsx:130` | valikuline-UX |
| B-P2-2 | `outputDraftLock` degradeerub no-op'iks, kui süstitud `db`-l pole `$transaction` (tootmises kättesaamatu — päris Prismal on alati) → atomaarsuse-garantii on sellest meetodist tingimuslik | `outputDraftLock.js:3` | defense-in-depth (tootmises kättesaamatu) |
| B-P2-3 | Teenusekihi rollivärav (`forbidden()` → `api.common.forbidden`) on surnud kood: marsruudi `requireWellbeingApiUser` lükkab kõik mitte-SW/mitte-admin juba tagasi teise võtmega (`wellbeing.errors.forbidden`) | `covisionHandoff.js:28,56` | valikuline (võtme-ebakõla) |
| B-P2-4 | Serveripoolne tuvastaja-heuristika (`covisionShared.js:32`) märgib iga kaks järjestikust Suurtähelist sõna nimeks → võib legitiimset kinnitatud teksti valepositiivselt blokeerida (turvaline 400, mitte leke); jagatud detektor, mitte uus | `covisionShared.js:32` | valikuline-UX |
| B-P2-5 | Handoff-päring normaliseeritakse kaks korda (marsruut + teenus); idempotentne, kahjutu | `covisionHandoff.js:144` | nit |

## 5. Jaotus

- **Päris vead:** B-P1-1 (P1), B-P2-1 (sama juur).
- **Valikulised / defense-in-depth:** B-P2-2, B-P2-3, B-P2-4, B-P2-5.
- **Teadlikult edasilükatud:** —

## 6. Invariandid, mis KEHTIVAD (agent proovis murda, ei suutnud)

- **Toorandmete / lähte-ID mitte-leke:** owner-scoped `findFirst` select ei loe `sourceRecordId`/`sourceWorkflowType`; `WellbeingRecord` kirjet ei loeta kunagi (test paigaldab viskava getteri); pöördrelatsioon `sourceWellbeingOutputDraft` (`schema.prisma:1920`) EI ole kusagil `include`'itud/serialiseeritud (grep: 0 kasutust väljaspool skeemi/teste). Eeltäide läheb `CovisionPrivateState`-i; session-serializer laeb privaatolekud `where: { userId }` → aktsepteeritud/kutsutud kolleeg saab `privateStates: []` (eraldi test kinnitab).
- **Ainult värske serveritekst:** `editedText || generatedText` loetakse DB-reast; klient ei saada teksti (paneel saadab ainult `{expectedUpdatedAt, confirmedNoIdentifiers:true}`).
- **Täielik väravakomplekt + null-kirjutusega tõrked:** sobivus (tüüp/adressaat/olek/nähtavus/reviewed/confirmed → 409), sõrmejälje formaat (→409), `confirmedNoIdentifiers` (→400), tuvastaja-detektsioon (→400) — kõik enne/keskel tehingut, 4xx-teel commit'itakse null. Iga create eelneb lõplikule CAS-lingile, mis `count !== 1` korral rollback'ib kogu tehingu.
- **Ei dubleeri juhtumit:** advisory-lock (`wellbeingOutputDraft:<id>`) serialiseerib confirm/save/handoff; varajane `if (draft.covisionCaseId) return existing` + `covisionCaseId @unique` + `updatedAt`+`covisionCaseId:null` CAS → kordus/paralleel tagastab sama juhtumi. `in_covision`/`covisionCaseId` kontrollid confirmis ja salvestuses takistavad üleandmise ülekirjutamist.
- **Whitespace-P1 parandus on päris:** `confirmWellbeingOutputDraftForUser` keelab tühja/whitespace ja >4000-märgilise `editedText` → ükski `ready_to_share` rida ei kanna tühja teksti, mis vaikselt aegunud `generatedText`-ile langeks.
- **Rollback + rolli/tellimuse värav enne teenust; owner-only no-leak 404; allowlist-vead** (`wellbeingCovisionHandoffPublicError`, tundmatu → generic 500, suvalist `error.message` ei tagastata).
- **Klient (handoff):** üks `isBusy` värav kõigi mutatsioonide üle; start-nupp keelatud + varajane return; kordusklõps ei loo teist juhtumit (server-idempotentsus katab); avab ainult `/kovisioon?case=<id>`.

## 7. Lõppotsus

**OPUS PARANDUSED VAJALIKUD** — kitsalt.

Serveripool on põhjalik, defense-in-depth vertikaal, mis peab adversaalsele survele vastu: **P0 puudub**, ei leitud teed, mis lekitaks toor-Tööheaolu andmeid või lähte-mustandi ID-d osalejale, looks duplikaatjuhtumi või jagaks aegunud sisu; lock+unique+CAS-idempotentsus, sõrmejälje/kinnituse väravad null-kirjutusega ja confirm-aja whitespace-kaitse kõik kontrollitud. Blokeerib ainult **üks P1 (B-P1-1)** kliendipoolel — `SupportRequestPanel` mustandi-salvestusel puudub request-generatsiooni värav (kolm ülejäänud vaadet kasutavad seda õigesti); mõjuala on piiratud (server kaitseb andmeid), aga hiline vastus võib oleku pärast lahkumist taastada ja lennult tehtud sisendi kaotada. Väike, lokaalne parandus. Doc 01 §1 järgi: Sol parandab + regressioontest + kordusaudit enne uue arenduse jätkamist.

## 8. Soli paranduse üleandmine Opuse kordusauditiks — 2026-07-14

**B-P1-1 ja sama juurega B-P2-1 parandatud, Opuse kordusauditi ootel.** Algset Opuse lõppotsust ei kirjutata üle enne sõltumatut kordusauditit.

- `SupportRequestPanel` kasutab nüüd `createLatestRequestGate` väravat kõigil kolmel asünkroonsel kirjutusteel: mustandi salvestamine, kinnitamine ja Kovisiooni üleandmine.
- Iga päring saab `AbortSignal`-i ning enne oleku kirjutamist kontrollitakse `request.isCurrent()`; tühistatud või aegunud päringu vead ei muuda UI olekut.
- „Jäta privaatseks", teise väljundi valimine ja Taastumisse navigeerimine tühistavad aktiivse päringugeneratsiooni.
- Tekstiväli ja kinnituskastid on `isBusy` ajal külmutatud ning `changeEditedText` ei saa samal ajal `status`-t tagasi `editing`-uks lülitada.
- Lisatud source-contract regressioonitestid request-värava, lahkumisel invalidatsiooni, iga await-järgse jooksvuskontrolli ja tekstivälja külmutamise kohta.
- Kontrollid enne commit'i: sihttestid **35/35**, kogu `npm test` **1074/1074**, `i18n:check` OK, muudetud failide ESLint 0 viga/0 hoiatust, kogu lint 0 viga, build OK, `db:migrate:check` 87 migratsiooni OK.

Kordusauditi ülesanne: reprodutseeri algne PUT → sisestus → „Jäta privaatseks" võistlus ning kinnita, et hiline vastus ei taasta olekut ega kirjuta kasutaja uuemat sisendit üle.
