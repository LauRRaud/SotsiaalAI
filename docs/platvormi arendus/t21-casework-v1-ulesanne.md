# ÜLESANNE: T21 `CASEWORK-V1` — juhtumitöö tugi: sõnastiku-/adapterikiht ja vastuvõtulaua ettevalmistuspaneel

**Olek:** `READY_TO_ASSIGN` (otsustevaba tuum P0+P1). Täisteema (Meetodipeegel, genogramm, ökokaart) on suurem ja **õigusanalüüsi/otsuste taga** — vt „Skoop ja otsuste väravad".
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine.
**Soovitatud teostaja:** Sol High (P0 sõnastik/adapter = madal risk, kõrge täpsus) + Fable UI (P1).
**Alus:** analüüs valmis — `docs/platvormi arendus/fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` (11 ptk; paketid CASEWORK-P0…P6 ptk 10; otsused O-CW-1…10 ptk 9).

## Eesmärk

Juhtumitöö tugi (JTA) tuum on juba toodangus (STAR_HELPER/CASE_SUMMARY jt artefaktid, vastuvõtulaud `WorkspaceFeaturePage feature="pre_inquiries"`). Puudu on **leping ja sidumine**: kanooniline päritolusõnastik, read-only adapterid olemasolevate mudelite kohal, ning üks „kohtumise ettevalmistuse" vaade vastuvõtulaual. See teema teeb proto-JTA koodis kontrollitavaks (P0) ja annab vastuvõtjale ettevalmistuspaneeli (P1) — **ilma uue andmekihita, migratsioonita ja lahtise otsuseta**. UI hoiab ranget „mustand/ettevalmistus" registrit; SotsiaalAI ei muutu STAR2 paralleelregistriks.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` — **tervikuna**, eriti ptk 1 (JTA roll), 2 (kandja-/päritolusõnastik), 10 (paketid P0/P1), 8 (dubleerimiskeelud).
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T21 (rida 377).
5. `lib/workspaces/registry.js` + `descriptor.js` + `adapters/**` (K1 muster), `lib/field/constants.js` (**`FIELD_PROVENANCE` — vt kriitiline hoiatus allpool**), `lib/preInquiryReceiverWorkflow.js`, `WorkspaceFeaturePage` (`feature="pre_inquiries"`), AgentArtifact-mudel + tüübid.
6. `docs/platvormi arendus/tehis-testkontod.md` enne lokaalset autentitud kontrolli.

## Alus ja worktree

> **EELDUS TÄIDETUD:** **K1-P0 registry on main'is** (`ef5973c9` eellane; `lib/workspaces/registry.js` + descriptor-validaator + adapterid olemas). T21 analüüsidoci „K1-P0 [BRANCH]" on AEGUNUD (18.07 integratsioon). COLLAB-P0 EI ole eeldus (failid ei kattu).

> **⚠ KRIITILINE HOIATUS — PÄRITOLUSÕNASTIK ON JUBA OLEMAS, VALES KOHAS.** T24 FIELD-V1 lõi 8-väärtuselise päritolusõnastiku `lib/field/constants.js`-i (`FIELD_PROVENANCE`: KLIENDI_OELDUD, KLIENDI_KINNITATUD, DOKUMENDIST, TEISE_SPETSIALISTI_INFO, TOOTAJA_TAHELEPANEK, TOOTAJA_TOLGENDUS, AI_MUSTAND, AMETLIKULT_KONTROLLITUD) — need on identsed CASEWORK-A0 2.3 sõnastikuga. Tooteomanik võttis kõrvalekalde teadlikult vastu. **KUI SA LOOD `lib/workspaces/provenance.js` NULLIST, TEKIB KAKS SÕNASTIKKU** — täpselt see, mida leping keelab. **Õige käik:** loo `lib/workspaces/provenance.js` kui **kanooniline allikas**, tõsta `FIELD_PROVENANCE` väärtused sinna JA **suuna FIELD sinna** (`lib/field/constants.js` impordib jagatud failist, ei defineeri oma koopiat). Väärtused peavad jääma bait-identseks (FIELD on juba toodangus). Kontrolli, et FIELD-i olemasolevad kasutuskohad ja testid ei murdu.

> **JADATÖÖ REEGEL (18.07).** Üks haru, üks teostaja. Paketid P0/P1 = sisemised etapid.

1. **Baas = `main`-i PRAEGUNE tipp.** `git rev-parse main`, raporteeri SHA (koostamise ajal `9ab72a05`).
2. Worktree: `git worktree add ../SotsiaalAI-casework-v1 -b codex/casework-v1 main`.
3. **Migratsioon: 0** (P0/P1 on sõnastik + adapterid + UI olemasolevate mudelite peal). `registry.js` saab +2 rida (`case_work`, `practice_reflection` RESERVED — additiivne konstant).
4. Tõlkefailid ainult T21 võtmetes (receiverChecklist i18n-võtmestamine on A11Y-I18N kattuvus — liida, ära dubleeri).
5. Lõpetamisel: väravad rohelised → merge `main`-i **samal päeval**. `main`, server, merge, deploy puutumata kuni omaniku loani.

## Skoop ja otsuste väravad (OLULINE)

T21 täisvisioon (P0…P6) sisaldab STAR2-ülekannet, Meetodipeeglit, genogrammi ja ökokaarti — need on **otsuste ja õigusanalüüsi taga**. Selle ülesande skoop = **CASEWORK-P0 + CASEWORK-P1** (E1–E2), mis on otsustevabad (analüüsi kinnitus: „Ükski O-CW EI blokeeri CASEWORK-P0 ega P1").

**Teadlikult VÄLJAS (vajavad otsust/õigusanalüüsi enne järgmist T21-viilu):**
- **P2** STAR2-ülekande olekurada + „Kopeeri STAR2 jaoks" — vajab O-CW-2 (ülekande retention), O-CW-4 (olekute salvestus), O-CW-10 (ekspordi auditisügavus); migratsioon → Opuse audit (kliendi andmete kandja muutub). **R2 artefaktide retention-auk** sulgub siin.
- **P3** Meetodipeegel V1 (PracticeReflection mudel) — vajab O-CW-3 (refleksiooni/dokumentatsiooni piir).
- **P4** kliendi OMA ökokaart Teekonnas — vajab **O-CW-7 ERALDI ÕIGUSANALÜÜSI** (kolmandate isikute õiguslik alus, GDPR art 14, lapsed genogrammil) — siduv piir, ei otsustata tehniliselt.
- **P5** töötaja genogramm/ökokaart/võrgustikukaart — vajab COLLAB-P5 + O-CW-7 + O-CW-8 (notatsioon) + O-CW-9 (kliendi ligipääs). Kõige blokeeritum, teadlikult viimane.
- **P6** meetodite teadmusbaas + valiku-assistent — vajab O-CW-5 (partner-kataloog).

Kui omanik tahab P2/P3, on eraldi lühike otsustering (O-CW-2/3/4/10) enne seda viilu. P4/P5 vajavad õigusabi (O-CW-7) — ei alustata koodiga.

## Teostus

### E1 — Juhtumitöö sõnastiku- ja adapterikiht (CASEWORK-P0; ESIMENE, otsustevaba)

- **`lib/workspaces/provenance.js`** (uus, KANOONILINE): 8-väärtuseline päritolumärgistuse sõnastik (2.3) + kandjaklassi typedef (töömustand=1 / kinnitatud kokkuvõte=2 / ametlik kandja=3) + STAR2-ülekande olekusõnastik (2.2: MUSTAND→…→ÜLE_KANTUD|EI_KANTA) + validaatorid; 0 päringut. **Tõsta `FIELD_PROVENANCE` siia ja suuna `lib/field/constants.js` importima** (vt kriitiline hoiatus — üks sõnastik, mitte kaks; väärtused bait-identsed).
- **`lib/workspaces/registry.js`** +2 rida: `case_work`, `practice_reflection` RESERVED.
- **`lib/workspaces/adapters/preInquiryReceiverAdapter.js`:** `listReceivedCaseWork(userId)` → `WorkspaceDescriptor[]` (kind `pre_inquiry`, vastuvõtja-skoobitud; lifecycle K1 4.2.1 kaardistusest; `nextAction` = `nextContactOn`; võõras → tühi).
- **`lib/workspaces/adapters/caseArtifactAdapter.js`:** `listCaseArtifacts(userId)` → jagamis-descriptor[] (AgentArtifact omaniku-skoobitud; DRAFT→klass 1, FINAL→klass 2; tüübisõnastik).
- **`tests/workspaces/caseworkContract.test.js`** (fake-db): mõlemad adapterid, võõras → 0 rida, sõnastike täielikkus (iga AgentArtifactType + PreInquiryStatus kaardistub), validaator reject tundmatule.
- **Keelatud:** EI kirjutavat rada, EI UI-d, EI PracticeReflection mudelit, EI ülekande-olekute salvestust (ainult sõnastik), EI võrgustiku-/kaardikirjeid, EI U1 emit-punkte.

### E2 — Vastuvõtulaua ettevalmistuspaneel (CASEWORK-P1; UI, 0 migratsiooni)

- Ühenda olemasolev eelpöördumine + artefaktigeneraator (OLEMASOLEVATE tüüpidega CASE_BRIEF / PRE_ASSESSMENT_SUMMARY / CHECKLIST) + `receiverChecklist` + `nextContactOn` üheks **„kohtumise ettevalmistuse" vaateks** vastuvõtulaual.
- Päritolumärgistuse kuvamine P0 sõnastikuga; `receiverChecklist`-siltide i18n-võtmestamine (koordinaator liidab A11Y-I18N-iga, ei dubleeri).
- **UI-keel hoiab ranget „mustand/ettevalmistus" registrit** (R8) — mitte „menetlus"/„ametlik esitamine" (eelpöördumise õiguslik staatus O-CW-1 lahtine).
- 0 uut mudelit, 0 otsust.

## Selgelt väljas

- STAR2-ülekande salvestus (P2), Meetodipeegel/PracticeReflection (P3), genogramm/ökokaart (P4/P5), meetodite teadmusbaas (P6).
- **JTA oma ülesandesüsteem** — mitmepoolne „ülesanne vastutajaga" on COLLAB objektiklass 8 (dubleerimiskeeld 6.4/8.3).
- Uus kirjutav rada, uus migratsioon, U1 emit-punktid (P0/P1 ei emiteeri).
- Merge, deploy, PR, põhitööpuu puhastus, tootmisandmete lugemine, päris kasutajate testimine.

## Nõutud testilepingud

1. **Üks sõnastik:** `lib/field/constants.js` impordib `provenance.js`-st (mitte oma koopia); FIELD-i väärtused bait-identsed; FIELD olemasolevad testid rohelised (regressioon).
2. `preInquiryReceiverAdapter.listReceivedCaseWork`: vastuvõtja-skoobitud descriptorid; võõras → tühi; lifecycle + `nextAction` õiged.
3. `caseArtifactAdapter.listCaseArtifacts`: omaniku-skoobitud; DRAFT→1/FINAL→2; võõras → tühi.
4. Sõnastike täielikkus: iga AgentArtifactType + PreInquiryStatus kaardistub; validaator lükkab tundmatu väärtuse tagasi.
5. `registry.js`: `case_work` + `practice_reflection` RESERVED; SUPPORTED-loend ei muutu.
6. P1 vaade: ettevalmistuse paneel kuvab artefaktid + checklist + `nextContactOn` + päritolumärgise; UI-keel „mustand/ettevalmistus"; ET/EN/RU pariteet.

Käivita T21 sihttestid + FIELD-i regressioon (provenance-import), muudetud failide lint, `npm run i18n:check`, Prisma validate, `git diff --check`, build. Täissviit + sõltumatu audit → T27.

## Sünteetiline runtime ja DoD

Lokaalne sünteetiline DB + testidentiteedid. Tõenda: mõlemad adapterid tagastavad kehtiva descriptor'i, võõras → tühi, sõnastik on üks (FIELD impordib jagatust), P1 paneel kuvab õigesti. Korista loodud objektid.

Valmis on siis, kui E1–E2 on samas harus, päritolusõnastik on ÜKS jagatud fail (FIELD suunatud sinna, väärtused identsed), adapterid on read-only ja skoobitud, P1 paneel kannab „mustand/ettevalmistus" keelt, worktree puhas, commit/push tehtud. `main`, server, merge, deploy puutumata.

## Lõpparuanne

Esita worktree, haru, baas-SHA, lõppcommit/remote SHA, migratsioonid (0), E1–E2 kokkuvõte, testid/lint/i18n/Prisma/diff-check/build, sünteetiline runtime/cleanup, VÄLJAS jäänud P2–P6 + O-CW otsused ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud. **Märgi eraldi:** kas `FIELD_PROVENANCE` konsolideerimine õnnestus ilma FIELD-i regressioonita.

Pärast lõpparuannet teeb Fable fokuseeritud kontrolli: üks-sõnastik-invariant (FIELD import), adapterite skoop/sisutus ja P1 registrikeel.

## Lõpetamisel: uuenda AINULT `SEIS.md`

1. **Seisutabeli rida** → uus olek, haru + SHA, baas-SHA, väravad, `NOT_PROVEN`.
2. **Järjekord** → mis avanes (nt T21 P2/P3 O-CW otsuste järel), mis järgmine.
3. **Vananenud väide** → paranda kohe (nt kui provenance-konsolideerimine muutis mõnda FIELD-märget).

Masterregistrit ei uuendata oleku pärast. Kirjuta SEIS-i ka pooleliolek.
