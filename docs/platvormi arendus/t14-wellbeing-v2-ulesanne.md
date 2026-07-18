# ÜLESANNE: T14 `WELLBEING-V2` — Tööheaolu „Minu kirjed" lugemiskiht ja püsiruumi tuum

**Olek:** `READY_TO_ASSIGN` (otsustevaba tuum). Suur teema, aga skoop on lukustatud **decision-ready osale** — vt allpool „Skoop ja otsuste väravad".
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine.
**Soovitatud teostaja:** Fable 5 High või Sol High (privaatsusinvariandid + olemasoleva `records.js` lugemiskiht).
**Alus:** analüüs valmis — `docs/platvormi arendus/fable-5-tooheaolu-v2-iganadalane-pusiruum.md` (WB-V2-P0…P5, otsused O-WB-1…5, ptk 10 paketid) + `fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` (17 V-leidu, TO-1…10).

## Eesmärk

Tööheaolu on täna „10 head vormi ilma tervikuta" — kirjeid saab luua, aga **mitte tagasi vaadata, kustutada ega jätkata**. See teema sulgeb juurvea nr 1: ehitab kirjete lugemisraja ja „Minu kirjed" naasmisvaate olemasoleva andmemudeli peale (0 uut konteinertabelit), ning ühtlustab `wellbeing_space` K1-adapteriks. Kasutaja näeb oma mustrit ja kirjeid, saab jätkata pooleli jäänut ning kustutada. Individuaalne kirje ei jõua kunagi juhi/organisatsiooni vaatesse.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-tooheaolu-v2-iganadalane-pusiruum.md` — **tervikuna**, eriti ptk 2 (lähteseis), 3.3 (naasmispunkt), 4 (privaatsusinvariandid), 10 (paketid P0/P1).
4. `docs/platvormi arendus/fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` — ptk 19 (lugemisraja auk), TO-1.
5. `docs/platvormi arendus/arendusteemade-masterregister.md` — T14 (rida 306).
6. `lib/wellbeing/records.js` (E0 lugemiskiht — ära lõhu dedupe-loogikat), `lib/wellbeing/aggregate.js` (elus koond), `app/api/wellbeing/**`, `components/**` Tööheaolu vaated, `lib/workspaces/registry.js` (K1) + `adapters/`.
7. `docs/platvormi arendus/tehis-testkontod.md` enne lokaalset autentitud kontrolli.

## Alus ja worktree

> **KAKS EELDUST ON JUBA TÄIDETUD (kontrollitud 18.07):** (1) **E0 kriitiline parandus on main'is** — fix `fe8c7df2` on main'i eellane; advisory-lock dedupe (`deduplicated`) + V17 anonüümsusdetektori parandus on `lib/wellbeing/records.js`-s. Doci ptk 2.3 „E0 [BRANCH], merge on järjestussõltuvus" on AEGUNUD — E0 tuli 18.07 integratsiooniga. **Samm 0 on tehtud.** (2) **K1-P0 registry on main'is** (`ef5973c9` eellane; `lib/workspaces/registry.js` + adapterid olemas) → `wellbeing_space` adapteri (P1) eeldus täidetud.

> **JADATÖÖ REEGEL (18.07).** Üks haru, üks teostaja. Paketid WB-V2-P0/P1 on selle haru sisemised etapid.

1. **Baas = `main`-i PRAEGUNE tipp.** `git rev-parse main` ja raporteeri SHA (koostamise ajal `9ab72a05`).
2. Worktree: `git worktree add ../SotsiaalAI-wellbeing-v2 -b codex/wellbeing-v2 main`.
3. **Migratsioon: 0 uut** — andmemudel kannab juba kõike (kirjed, soovitused, `sourceRecordId` mustandi-side, kontrollpunkti väljad). Kui midagi ootamatult vajab indeksit, nimeta `20260720xxxxxx_…` (uusimast hilisem) — aga eeldatavasti EI vaja.
4. Tõlkefailid ainult T14 võtmetes.
5. Lõpetamisel: väravad rohelised → merge `main`-i **samal päeval**. `main`, server, merge, deploy puutumata kuni omaniku loani.

## Skoop ja otsuste väravad (OLULINE — loe enne alustamist)

T14 täisvisioon (WB-V2-P0…P5) on suur, aga **ainult P0 ja P1 on otsustevabad ja kohe ehitatavad**. Rütmi-/kontrollpunktikiht (P2–P5) sõltub tegemata tooteotsustest. Seetõttu on **selle ülesande skoop = WB-V2-P0 + WB-V2-P1** (E1–E2 all).

**Teadlikult VÄLJAS sellest ülesandest (vajavad omaniku otsust enne järgmist T14-viilu):**
- **WB-V2-P2/P3** (kontrollpunkt „kas pidas?" + nädalarütm `weekly_checkin_due`) — vajab **TO-1** (kirje elutsükkel: muutmine/„paranda uue kirjena") + **TO-2** (kontrollpunkt+meeldetuletus = kogu rütmikihi värav). Kumbki pole veel vastust saanud.
- **WB-V2-P4** (nädalaruumi vormirütm) — vajab TO-8 (vormifaktor).
- **WB-V2-P5** (uued väljundid, koondi tugevdamine) — vajab TO-3/4/5/7/9.
- **Org-suunaline koond** — BLOKEERITUD kuni **O-WB-3 õigusanalüüs** (kas heaolumarkerid = GDPR art 9 terviseandmed; välise koondi anonüümsuslävi). Sisepiloot k=3 jääb sisemiseks.

Kui omanik tahab rütmikihti, on eraldi lühike otsustering (TO-1, TO-2) enne T14-teist-viilu — see EI kuulu siia.

## Teostus

### E1 — Kirjete lugemisrada + „Minu kirjed" naasmisvaade (WB-V2-P0; ESIMENE, kõrgeim väärtus)

- **API:** `GET /api/wellbeing/records` (loend, omanik-skoop, workflowType/perioodi filter) + `GET /api/wellbeing/records/[id]` + `DELETE /api/wellbeing/records/[id]` (**päris kustutus**; koondist eemaldumine on automaatne, sest `aggregate.js` arvutab elusalt — ptk 4.3). Praegu on `GET /api/wellbeing/quick-check` = 405; lugemisrada puudub täielikult.
- **Mustandi-side:** mustandite loend + kirje↔mustandi side UI-s (`sourceRecordId` on skeemis; loomisel hakkab UI seda saatma).
- **Naasmispunkt:** „Jätka siit" continuity href → **konkreetne mustand/kirje** (mitte tühi `/tooheaolu` — praegune V6-viga), ptk 3.3.
- **Ülevaade → „Minu muster ja kirjed":** kronoloogia + detail (vastused, signaal, soovitused, seotud mustandid, handoff-ajalugu „viidi Kovisiooni <kuupäev>").
- **Piirid:** 0 migratsiooni; **muutmine/„paranda uue kirjena" JÄÄB VÄLJA** (TO-1 taga). Loend+detail+kustutus on TO-1 kõigi variantide ühisosa → otsustevaba.

### E2 — `wellbeing_space` K1 read-adapter (WB-V2-P1; paralleelne E1-ga, eri failid)

- Adapter ptk 7.1 koondireeglitega + registry kind `wellbeing_space` **RESERVED → SUPPORTED** + K1-P0 mustri testid.
- **Invariant (sisutuse kontroll):** descriptor EI sisalda `workflowType`'i, signaale ega arve — ainult olek+viide (K1 nähtavusklass „üksik privaatne + koond anonüümne"). Võõras → tühi loend. PAUSED-semantika = rütm väljas (O-WB-5 (a), aga rütmiolekut ennast siin ei ehitata — ainult adapter talub seda välja).

## Selgelt väljas

- Rütm/kontrollpunkt/„kas pidas?"/nädalasündmus (P2–P5), kirje muutmine (TO-1), org-koond (O-WB-3 õigusanalüüs), uued väljundid/töötubade liitmine (P5).
- Uus vorm, uus workflowType (O-WB-1 = adaptiivne, mitte uus tüüp), uus konteinertabel, Flight/3D.
- Merge, deploy, PR, põhitööpuu puhastus, tootmisandmete lugemine, päris kasutajate testimine.

## Nõutud testilepingud

1. `GET /records` loend on omanik-skoobitud (võõras → 404 / ainult enda kirjed); workflowType/perioodi filter töötab.
2. `DELETE /records/[id]` kustutab päriselt ja koond (`aggregate.js`) muutub vastavalt (üksikkirje kadumine kajastub elusalt).
3. Mustandi↔kirje side: loomisel `sourceRecordId` salvestub; „Jätka siit" href viib konkreetsele mustandile/kirjele, mitte `/tooheaolu`-le.
4. Ülevaade kuvab kronoloogia + detaili (vastused, signaal, soovitused, handoff-ajalugu) ilma toorvõtmeteta.
5. `wellbeing_space` adapter: descriptor ei sisalda `workflowType`/signaale/arve; võõras → tühi; kind on SUPPORTED; K1 descriptor-validaator roheline.
6. E0 dedupe/anonüümsusrada EI katke (regressioon: `records.js` advisory-lock + `deduplicated` leping püsib).
7. ET/EN/RU pariteet, klaviatuur, fookus, aria-live, mobiil, reduced-motion katavad „Minu kirjed" + detail.

Käivita T14 sihttestid + kahjustatud regressioonid (Tööheaolu + Kovisiooni handoff — E0-pind), muudetud failide lint, `npm run i18n:check`, Prisma validate, `git diff --check`, build. Täissviit + sõltumatu audit → T27.

## Sünteetiline runtime ja DoD

Lokaalne sünteetiline DB + testidentiteedid. Tõenda: kirjete loend/detail/kustutus omanik-skoobis, kustutuse mõju koondile, mustandi↔kirje side, continuity-href sihib mustandit, `wellbeing_space` adapteri sisutus. Korista loodud kirjed/mustandid. Päris org-koond ja rütmikiht on VÄLJAS (ei `NOT_PROVEN`, vaid skoobist väljas).

Valmis on siis, kui E1–E2 on samas harus, kirjete lugemis-/kustutusrada on omanik-skoobis testitud, koond reageerib kustutusele elusalt, `wellbeing_space` adapter on sisutu ja SUPPORTED, E0-pind ei katke, worktree puhas, commit/push tehtud. `main`, server, merge, deploy puutumata.

## Lõpparuanne

Esita worktree, haru, baas-SHA, lõppcommit/remote SHA, migratsioonid (eeldatavasti 0), E1–E2 kokkuvõte, testid/lint/i18n/Prisma/diff-check/build, sünteetiline runtime/cleanup, VÄLJAS jäänud P2–P5 + org-koond ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

Pärast lõpparuannet teeb Fable fokuseeritud kontrolli: kirjete omanik-skoop, kustutuse koondimõju, `wellbeing_space` sisutus ja E0-regressioon.

## Lõpetamisel: uuenda AINULT `SEIS.md`

1. **Seisutabeli rida** → uus olek, haru + SHA, baas-SHA, väravad, `NOT_PROVEN`.
2. **Järjekord** → mis avanes (nt T14 rütmi-viil TO-1/TO-2 järel), mis järgmine.
3. **Vananenud väide** → paranda kohe.

Masterregistrit ei uuendata oleku pärast. Kirjuta SEIS-i ka pooleliolek.
