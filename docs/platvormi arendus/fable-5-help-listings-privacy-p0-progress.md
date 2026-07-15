# P0 turvapakett — help-listing privaatsuslekete sulgemine (V1 + V2)

STATUS: IN_PROGRESS

Progressidokument turvapaketile, mis sulgeb kaks tõestatud privaatsusleket abivahenduse kuulutustes. Skoop on **ainult V1 ja V2**. V3–V10, nõusolekuvoog, markerite CSS, kujundus ja uus funktsionaalsus on selgelt välistatud (vt §Piirid).

Alusdokument (audit): [`fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md`](fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md) — lekete täpne kooditõend on seal jaotistes A12 (runtime) ja B5 (V1/V2).

---

## 1. Lähtekontekst

| Väli | Väärtus |
|---|---|
| Lähtecommit | `890124bd` (`origin/main`, „AI update 2026-07-15 14:51") |
| Local main == origin/main | jah (`890124bdbef17f899ba15c11c93450ef17875fac`) |
| Haru | `fable/help-listings-privacy-p0` |
| Worktree | `C:/Users/rauds/Desktop/SotsiaalAI-p0` (eraldi; põhitööpuu `C:/Users/rauds/Desktop/SotsiaalAI` puutumata) |
| Sõltuvused | `node_modules` ja `generated/` jagatud põhipuust junction-lingiga; `.env` kopeeritud (mõlemad gitignore'itud) |
| Alusdokumendi SHA-256 | `40667c5969dd026ff5ec99d0a2da7bd4e5dde4104fc80d9bf29d60a99324296d` (allikas == koopia, 78878 baiti, bait-baidilt identne) |

---

## 2. Juurpõhjus

**V1 — Detail-GET ei autoriseeri.** `app/api/help/listings/[kind]/[id]/route.js` `GET` laeb kirje `loadRecord(kind, id)` kaudu ja tagastab `toHelpListingDetailView(record)` **ilma omaniku- ja staatusekontrollita**. `toHelpListingDetailView` on omanikuprojektsioon: sisaldab `rawPlace`, `editable*`, `beneficiaryLabel`, `urgency`, `providerScopeOrConditions`, täpset aadressi/lat-long (PHYSICAL). Tagajärg: iga sisselogitu loeb suvalise ID-ga võõra `DRAFT`/`CLOSED`/`CANCELLED`/`ARCHIVED`/`MATCHED` kirje täissisu.

**V2 — Globaalne loend ei põranda staatust.** `lib/help/requests.js` `listHelpRequests` (ja `offers.js` `listHelpOffers`) lisab `where.status` ainult kui klient annab staatuse; `app/api/help/listings/route.js` `scope=global` haru ei sunni `OPEN`. Tagajärg: globaalne loend tagastab võõraste `DRAFT/CLOSED/CANCELLED/ARCHIVED` kirjeid; `status=DRAFT` laiendab nähtavust.

Mõlemad on runtime-tõendatud alusdokumendi A12-s (B luges A `DRAFT`-i; globaalne loend näitas `Mustand`).

---

## 3. Serveripoolne nähtavusleping (jõustatud)

*(Täidetakse teostuse käigus.)*

## 4. Muudetud failid

*(Täidetakse teostuse käigus.)*

## 5. Regressioonitestid

*(Täidetakse teostuse käigus.)*

## 6. Kontrollitulemused

*(Täidetakse teostuse käigus.)*

## 7. Teadlikud piirangud (skoobist väljas)

Ei teostatud (P0 skoop = ainult V1/V2): V3 liit-ID, V4 kuulutuse valik kaardil, V5 popup→eelpöördumine, V6/O1 markerite CSS, V7 i18n, V8 URL-olek, V9 tühiseise, V10/O3 nõusolekuvoog, avaliku kaardi/filtrite ümberkujundus, rate-limit/blokeerimine/moderatsioon, skeem/migratsioon, deploy.

## 8. Sõltumatu auditi fookus

*(Täidetakse lõpus.)*

## 9. Järgmine lubatud pakett

*(Täidetakse lõpus.)*
