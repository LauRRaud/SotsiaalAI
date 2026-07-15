STATUS: COMPLETE

# Tööheaolu E0 teostus — lõppseis ja üleandmine

Kuupäev: 15.07.2026 · Teostaja: Fable 5
Leping: `fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` ptk „E0 — rakendusvalmis paranduskokkulepe" (E0.1–E0.7)
Haru: **`fable/tooheaolu-e0` @ fe8c7df2** (push'itud origin'i; EI merge'itud, EI deploy'itud — ootab sõltumatut järelkontrolli)
Baas: origin/main @ 7ae76d5b (täpselt see commit, mille vastu E0 leping kirjutati — failiviited kehtisid muutmata)
Worktree: `C:/Users/rauds/Desktop/sotsiaalai-e0` (põhitööpuud ei muudetud; ainsad põhipuu muudatused = see dokument + põhidoki V17/E0 seisuread, mille ülesanne ise ette nägi)

## Mis tehti (E0.1–E0.3)

**E0.1 — V17 detektoriparandus.** `lib/covisionShared.js` „name"-reegli vahemuster `\s+` → `[^\S\r\n]+` (+ selgituskommentaar). Nimi ei ulatu enam üle reavahetuse; ühe rea nimed tuvastatakse endiselt. Teisi reegleid (address/small_place/institution) EI muudetud (leping: väikseim pind).

**E0.2 — Lekketa tuvastajavihjed.** `covisionHandoff.js`: `finalDraftText` lisab veale `details = { issueTypes, issueCount }`; uus `sanitizedIdentifierDetails` + whitelist `wellbeingCovisionHandoffPublicError`-is (details AINULT identifiers-võtmel; snippet/label/väärtus ei välju kunagi). Route (`output-drafts/[id]/covision/route.js`) edastab `details` 400-vastuses. `SupportRequestPanel.jsx`: uus olek `identifierIssueTypes` (lähtestatakse igal valiku/teksti/privaatseks-jätmise muutusel), `covision_identifiers` staatuse all kuvatakse kuni 3 tüübipõhist vihjet i18n kaudu. i18n: 21 uut võtit × 3 keelt (`identifier_hints_label` + `identifier_types.{9+other}` + `identifier_suggestions.{9+other}`; katab ka lepingus loetlemata 9. tüübi `rare_detail`).

**E0.3 — Salvestuse idempotentsus.** `outputDraftLock.js`: üldistatud `withWellbeingAdvisoryLock(db, key, cb)` (senine draft-lukk delegeerib; fake-prisma tagavaratee säilis). `records.js`: `createWellbeingRecordDeduped` — advisory-lock võtmega `wellbeingRecord:<omanik>:<töövoog>`, luku sees 30 s akna `findFirst` + sügavvõrdlus (`isDeepStrictEqual`: standardizedFields, period, roleGroup); kõik 9 `create*ForUser` tagastavad nüüd `{ record, deduplicated }`. Kõik 9 route'i: dedupe → **200 + `deduplicated: true`**, uus kirje → **201** (senine kuju). Prisma skeemi/migratsioone EI muudetud; koondanalüütikat/piloodivaadet EI puudutatud.

## E0.6 testid (kõik päris koodteed; fake = ainult süstitud prisma, senise sviidi muster)

| Lepingu nõue | Kus | Tõend |
|---|---|---|
| Standardmall ei anna valepositiivi | UUS `tests/wellbeing/templateAnonymity.test.js` (10 töövoogu × 3 väljunditüüpi) | **kirjutati ENNE parandust; punane tõend:** `AssertionError: quick-check/covision_input template must pass the gate, got: ["name"]`; pärast parandust roheline |
| Päris tuvastajad blokeeritakse | sama fail (nimi/aadress/telefon/isikukood/e-post ühel real) + olemasolev `tests/covision/shared.test.js` (muutmata, roheline) + handoff-tasand | ✓ |
| Topeltklikk → 1 kirje | `records.test.js` „saving the same quick check twice…" | ✓ |
| Paralleelsed korduspäringud → 1 kirje | `records.test.js` „parallel identical saves are serialized…" (serialiseeriv $transaction-fake; päris-DB serialiseerimise kannab pg_advisory_xact_lock — sama piirang kui senisel draft-luku sviidil) | ✓ |
| Võõra kasutaja andmeid ei avaldata | `records.test.js` „the dedupe window never returns another user's record" + olemasolevad handoff 404-testid (muutmata) | ✓ |
| Kinnitatud handoff töötab lõpuni | `covisionHandoff.test.js` „the unedited standard covision template passes the gate end-to-end (V17 regression)" + olemasolev idempotentsuse test | ✓ |
| API-leping | `apiContracts.test.js`: 9 route'i dedupe-muster, records-teenuse lukk+aken, covision-route details + snippet'i keeld | ✓ |
| Lisapiirid | details-saneerimine (väärtus ei serialiseeru), whitelist (409 ei kanna details'e), rikutud details → ilma details'ita vastus; akna aegumine (>30 s → uus kirje); muudetud vastus aknas → uus kirje | ✓ |

## E0.7 lõppkontroll

- [x] **Täissviit:** `npm test` → **1238/1238 pass, 0 fail** (sh kõik olemasolevad wellbeing/covision sviidid pärast lepingumuutusi)
- [x] **i18n:** `npm run i18n:check` → „All locales match et" (21 uut võtit ET/EN/RU pariteedis)
- [x] **Lint:** eslint muudetud failidel (components/wellbeing, lib/wellbeing, app/api/wellbeing, lib/covisionShared.js, tests/wellbeing) → 0 leidu
- [x] **Migratsioonid:** `git status prisma/` → tühi (skeemi ei puudutatud; `db:migrate:check` stsenaarium muutumatu)
- [x] **Autenditud runtime-vood** (worktree server pordil 3001, NEXTAUTH_URL override; kasutaja 3000-porti ei puudutatud; playwright-core + päris Chrome + LoginTempToken):
  - A) standardmalliga kovisiooni-üleandmine LÄBIS lõpuni → maandus `/kovisioon?case=cmrlwzkn8…`, Kovisiooni tööruum renderdus (kuvatõend `wb-e0-handoff-ok.png` sessiooni scratchpadis);
  - B) päris nimi („Mari Mets" + telefon) → 400, kasutaja jäi Tööheaolu lehele, vihjeplokk kuvas „Võimalik nimi — Asenda nimi rolliga…", **väärtust ei lekkinud** (kuvatõend `wb-e0-identifiers-hint.png`);
  - C) 3 kiiret „Salvesta kiirkontroll" klikki → **1 kirje** DB-s, staatus normaalne.
- [x] **Sünteetilised andmed koristatud:** covisionCase + 2 mustandit + 1 kirje + login-tokenid kustutatud; DB lõppkontroll: records/drafts/covisionCases/tempTokens kõik `[]`
- [x] **3001-server peatatud** (port vaba); NB! kasutaja 3000-dev-server oli juba enne E0 tööd seismas (mitte minu peatatud) — vajadusel käivita `preview_start` config'iga `next-dev`
- [x] Põhidokis V17 leiu ja E0-paketi seis uuendatud (viide fe8c7df2)
- [x] commit + push: `fable/tooheaolu-e0` @ **fe8c7df2** — 22 faili, +726/−194; EI merge'itud, EI deploy'itud

## Teadlikud kõrvalekalded lepingust (järelkontrollijale)

1. E0.5 tabel lubas 16 i18n-võtit — tegelikult 21×3: detektoris on ka lepingu kirjutamise ajal kahe silma vahele jäänud 9. tüüp `rare_detail` + lisasin `other`-fallbacki ja ploki pealdise võtme.
2. Lepingu E0.6 punkt 7 („identifiers-400 kehas ainult ok/message/details") on kaetud handoff-üksustestiga (`Object.keys(publicPayload)` täpne võrdlus) + route'i lähtekoodilepinguga, sest apiContracts-sviit on selles repos lähtekoodi-vastavustestide stiilis (mitte HTTP-tasand).
3. `scoringVersion`/käitumine üheski töövoos ei muutunud; dedupe-akna teadlik semantika (identne kordus >30 s = uus kirje) on kirjas nii koodikommentaaris kui lepingus.

## Üleandmine

Pakett ootab **sõltumatut järelkontrolli** (nt `/code-review` haru `fable/tooheaolu-e0` peal või ultrareview). Kontrolli eelkõige: (a) detektorimuudatuse mõju kolmele kutsujale (covisionHandoff:107, covisionShared:280 eelpöördumis-mustand, covision.js:840 anonüümsuskontrolli action) — kõik muutuvad leebemaks AINULT üle-rea juhul; (b) dedupe-akna semantika sobivus tootele; (c) 200/201 lepingumuutuse mõju võimalikele klientidele (ainus kasutaja on 9 wellbeing-vormi, mis loevad ainult `ok`/`message` — kontrollitud). Pärast heakskiitu: merge main'i, THEN põhidoki V17-rea „main-is viga veel kehtib" eemaldus. E1–E6 EI ole alustatud (leping pidas).
