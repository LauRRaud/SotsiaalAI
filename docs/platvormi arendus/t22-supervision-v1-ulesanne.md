# ÜLESANNE: T22 `SUPERVISION-V1` — supervisiooni ruum ja elutsükkel (V0 „protsessi mälu")

**Olek:** `READY_TO_ASSIGN` — järgmine täisteema (omaniku prioriteet 18.07: suured funktsioonid enne release'i). T12 leping on valmis, aga omanik valis T22 esimeseks.
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine (P1–P10 ühe teemaharuna — MITTE 11 mikroharu).
**Soovitatud teostaja:** Sol High või Fable 5 High (privaatsusinvariandid + atomaarne purge + vaatajapõhised serializer'id = kõrge privaatsus-/olekuraskus).
**Alus:** kogu tehniline tööplaan on valmis — `docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md` (Q1 tootemudel + Q2 V0 tööplaan: 13 mudelit, Q2.3 õigusmaatriks, Q2.5 purge-tehing, Q2.6 UI, Q2.7 Tööheaolu-piir, Q2.8 U1/U2, Q2.10 18-testi plaan, Q2.11 paketid SUP-P0…P11). **See leping ei dubleeri plaani — see viitab sellele ja lukustab teostusraami.**

## Eesmärk

Supervisioon on privaatsust austav protsessi mälu: admin annab superviisorile grandi → superviisor loob protsessi ja kontrakti → kutsub professionaalid → osaleja kinnitab kontrakti → igaühel on privaatne **eeskamber** → teadlik jagamine eelvaatega → kohtumise fakt → kinnitatud kokkuvõtted → sulgemine → **jagatud toorsisu purge** → osalejale jäävad privaatne refleksioon ja kinnitatud väljundid. AI ei tõlgenda ega hinda supervisiooni sisu; supervisiooni vabatekst ei jõua kunagi RAG-i.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md` — **tervikuna**, eriti Q2 (Q2.2 andmemudel, Q2.3 õigusmaatriks, Q2.4 API, Q2.5 purge, Q2.6 UI, Q2.7 Tööheaolu, Q2.8 U1/U2, Q2.10 testid, Q2.11 paketid). See on lepingu detailne selgroog.
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T22 (rida 385).
5. Olemasolev skeem `prisma/schema.prisma` — supervisiooni mudelid (`SupervisionProcess`…`SupervisionAuditEvent`, read ~3583–3881) **on juba main'is** (P0 tehtud).
6. Etalonmustrid, mida taaskasutada: `lib/effectivePractices.js` (grant-muster, PracticeCapability schema:~2382), `lib/covisionLegacyWrite.js` (advisory-xact-lukk, atomaarne sulgemine), `lib/wellbeing/covisionHandoff.js` (üleandmise allowlist/fingerprint — PEEGEL, mitte refaktor), `NotificationEvent` (schema:~1912), `/api/workspace/continuity` koostur.
7. `docs/platvormi arendus/tehis-testkontod.md` enne lokaalset autentitud kontrolli.

## Alus ja worktree

> **SUP-P0 ON TEHTUD JA MAIN'IS (kontrollitud 18.07).** Skeemialus `2fc826c4` „feat(db): add supervision V0 schema foundation" on `main`-i eellane; migratsioon `20260716090000_supervision_v0` on **prod-DB-s rakendatud**. 13 mudelit + 11 enumit on paigas. **Ära taasteosta skeemi.** Register „SUP-P0 lokaalne, remote puudub / CODE_READY_PARTIAL" oli aegunud — 18.07 integratsioon tõi selle main'i ja deploy prod'i.

> **JADATÖÖ REEGEL (18.07, ülimuslik).** Plaani Q2.11 kirjeldab iga paketti „eraldi harul tehtavana" — see on **tühistatud** jadatöö reegliga: P1–P10 tehakse **ühe teemaharuna, ühe teostajaga**. Paketid SUP-P1…P10 on selle haru **sisemised kontrollpunktid ja etapid**, mitte eraldi arendusülesanded ega eraldi merge'id. Q2.11 pakettide sõltuvusjärjestus (P1→P2→{P3,P5}→P4→P6→P7→{P8,P9,P10}) on etappide sisemine tegemisjärjekord.

1. **Baas = `main`-i PRAEGUNE tipp alustamise hetkel.** Jooksuta `git rev-parse main` ja raporteeri kasutatud SHA. Ülesande koostamise ajal oli `main` = `3f4808bd`.
2. Loo uus worktree kohalikust `main`-ist: `git worktree add ../SotsiaalAI-supervision-v1 -b codex/supervision-v1 main`.
3. **Migratsioon:** P0 migratsioon on olemas ja rakendatud. **Kui P1–P10 vajab skeemi lisamuudatust** (nt indeks, mille P0 unustas), nimeta see `main`-i uusimast HILISEMAKS (`20260720xxxxxx_…`) — MITTE P0 migratsiooni muuta. Eelistatavalt V0 EI vaja uut migratsiooni (Q2.11 tabel: P1–P10 migratsioonivaba).
4. Tõlkefailid `messages/*.json` — ainult T22 võtmetes (suurim i18n-pakett on P10 UI).
5. Lõpetamisel: väravad rohelised → merge `main`-i **samal päeval**. `main`, server, merge ja deploy jäävad puutumata kuni omaniku eraldi loani.

## Lukustatud V0 otsused (plaani Q2, siduvad — otsusteringi EI vaja)

Plaan on decision-complete. 12 lukustatud tooteotsust (Q2 „lukustatud tooteotsused"), millest olulisimad:

| Otsus | V0 leping |
|---|---|
| V0 = **protsessi mälu** | Kohtumine võib toimuda platvormiväliselt; V0-s **pole helikõnet, salvestust ega transkriptsiooni** (erinevalt T12/Kovisioonist). |
| Grant | Superviisori lisatiitli annab **admin dokumenteeritud aluse põhjal** (`SupervisorGrant`); avalikku „ESTA/ESCÜ kontrollitud" märgist EI kasutata. |
| Eeskamber (M6) + isiklik väljund (M12) | **AINULT omanik näeb** — mitte superviisor, mitte ADMIN. Eraldi privaat-serializer'i fail; ükski jagatud vaade ei impordi seda (CI-grep). |
| Purge sulgemisel | Jagatud toorsisu (M7 teemad, M8 märkmed, M9 mustandid) **kustub ühes `$transaction`-is** (Q2.5 järjestus 1–10); alles jäävad kinnitatud väljundid (M9 APPROVED), kontraktiraam (M3+M5), faktijälg (M11) ja igaühe privaatne pakk (M12). Pool-suletud olekut ei eksisteeri. |
| RAG-keeld | **Ükski supervisiooni vabatekst ei jõua RAG-i** (kohustuslik invariant, test #18) — supervisioonil RAG-sünki EI OLE. |
| Tööheaolu üleandmine | Kinnitatud Tööheaolu-mustand → supervisiooni **EESKAMBRISSE** (M6 privaatkirje); superviisor EI näe enne tavalist jagamisväravat (Q2.7 v2). |
| CLIENT väljas | CLIENT-roll ei osale V0 supervisioonis. |

**Kolm otsust, mis EI blokeeri V0 koodi (rollout-väravad, mitte koodiväravad):** (1) grandi tõendusstandard — vaja enne *päris* granti, mitte V0 koodi; (2) kinnitatud väljundite lõplik retention-tähtaeg — lukustatud otsus #12: **V0 ei leiuta numbrit ega ehita retention-scheduler'it** (`SupervisionClosure.retentionStatus="AWAITING_POLICY"`); (3) piloodi ulatus — enne rollout'i. Kõik kolm kuuluvad T27/rollout'i, mitte sellesse arendusse.

## Teostus (P1–P10 → E1–E7; detailid plaani Q2.11)

### E1 — Grant-teenus ja admin-API (SUP-P1)

- `lib/supervision/grants.js` + `app/api/admin/supervisor-grants/**`: anna/tühista/loe, „1 aktiivne grant" reegel, GRANT_ISSUED/REVOKED audit. `grantBasis` ei jõua mitte-admin serializer'isse (v.a omanikule fakti kujul). Admin-UI EI kuulu V0-sse (API + olemasolev konsool piisab). Etalon: PracticeCapability muster.

### E2 — Protsessi tuum: protsess + kontrakt + kutse + nõusolek (SUP-P2)

- `lib/supervision/service.js` + `serializers.js`; `app/api/supervision/processes/**`, `participations/**`. Read 4–13 + **vaatajapõhised serializer'id** (SV/OS/OS†/KUT/LAHK), ühetaoline 404 (VÕÕR/CLIENT/ADMIN → 404). Serializer ehitab audience'i järgi, mitte ei kärbi. CAS-leping versioonidel; OS† (osaleja ilma kehtiva kontraktikinnituseta) kirjutuskeeld. IDOR-sviip.

### E3 — Eeskamber + teadlik jagamine (SUP-P3 + SUP-P4)

- **Eeskamber (M6):** `lib/supervision/privateItems.js` + `serializersPrivate.js` (eraldi fail); omanik-skoobis CRUD, CAS autosalvestusele. Invariant: jagatud vaade EI impordi privaat-serializer'it; M6 toimingud EI kirjuta M13 auditit; ADMIN/SV → 404.
- **Teadlik jagamine (M7):** `lib/supervision/topics.js`; M6 → **külmutatud koopia** M7-sse (hilisem M6 muudatus ei levi) + audience (SUPERVISOR_ONLY / PROCESS) + tagasivõtt. SUPERVISOR_ONLY ei jõua teiste OS-vaatesse.

### E4 — Kohtumised + kokkuvõtted ja kinnitused (SUP-P5 + SUP-P6)

- **Kohtumised (M8):** `lib/supervision/meetings.js`; plaanimine + HELD-fakt (lõplik), seq-unikaalsus, CAS.
- **Kokkuvõtted (M9/M10):** `lib/supervision/summaries.js`; mustand → submit → kinnitused → APPROVED-lävi **samas tehingus**. DRAFT ainult SV-le; APPROVED muutumatu; lävi = sulgemishetkel ACCEPTED-osalused; OS† ei kinnita; viimane-kinnitus-tehing luku all.

### E5 — Sulgemine, purge, isiklikud pakid (SUP-P7) — KÕRGEIM RISK

- `lib/supervision/closure.js`; Q2.5 järjestus 1–10 **ühes `prisma.$transaction`-is** advisory-xact-lukuga (`supervision:<processId>`). CAS `expectedVersion`; PENDING-kokkuvõttega → 409; idempotentne kordus (olemasolev closure → 409, mitte teine purge/M12-pakk); iga sammu tõrge → täisrollback (pool-suletud olekut ei teki). M12 igale ACCEPTED-osalusele + superviisorile; purge EI puuduta M6. `purgeReport` täpsus tõendatud raw SQL-iga.

### E6 — U1/U2 sündmused + Tööheaolu üleandmine (SUP-P8 + SUP-P9)

- **U1/U2 (Q2.8):** `lib/supervision/notifications.js`; 6 sündmust `NotificationEvent`-idena (fakt + viide, **MITTE sisu**, test #15); continuity-koostur saab supervisiooni-allika täpsete `?ala=…` URL-olekutega; `supervision_prep_waiting` on AINULT continuity-allikas (mitte teavitus — restoratiivne, mitte survestav).
- **Tööheaolu üleandmine (Q2.7):** `lib/supervision/wellbeingHandoff.js` + `app/api/wellbeing/output-drafts/[id]/supervision/route.js`. Kinnitatud mustand → M6 eeskamber; `expectedUpdatedAt`-fingerprint (sameInstant), topelt → 409 (M6 `sourceWellbeingDraftId @unique`); superviisorile EI leki enne jagamist; M13 kirjet ei teki. `covisionHandoff.js` jääb PUUTUMATA (peegel).

### E7 — Eeskambri UI: V0 vaated (SUP-P10)

- `app/supervisioon/**` (uus marsruut) + `components/supervision/**`; Q2.6 **10 vaadet** (loend → loomine → kontrakt/kutse → eeskamber → jagamise eelvaade → kohtumised → kokkuvõte → kapp → sulgemise eelvaade → suletud vaade). Ruumigrammatika (eeskamber/lävi/laud/kapp) paigutuse ja märgistusega — **EI uut lõuendimootorit, EI Flight/3D**. Privaatsusmärgis („Ainult sina näed" / „Näevad: superviisor + N") on **püsielement**. Jagamis-eelvaade näitab TÄPSELT manifesti välju (kaheastmeline kinnitus). `?ala=` URL-olekud otselingitavad; laadimine/viga/409/tühi kaetud; ET/EN/RU + klaviatuur + reduced-motion. Vajadusel tükelda sisemiselt P10a/b/c.

## Selgelt väljas (plaani Q2 + JADATÖÖ)

- Platvormisisene kõne, salvestus, transkriptsioon (V0 pole T12/Kovisiooni tüüpi ruum).
- Organisatsiooni-/tellijavaade, arveldus, superviisorite kataloog, partnerintegratsioonid (ESTA/ESCÜ), Kovisiooni ühendamine.
- Retention-scheduler / automaatkustutus (otsus #12 — `AWAITING_POLICY`), admin-UI grantidele, AI-kokkuvõttemustand.
- Uus üldine lõuendimootor / Flight / 3D; T19 esitlusmootor (DEFERRED — ei äratata).
- SUP-P11 (täiskontroll) = **T27 release-candidate**, mitte selle arenduse osa.
- Merge, deploy, PR, põhitööpuu puhastus, force-push, tootmisandmete lugemine, päris kasutajate testimine.

## Nõutud testilepingud (plaani Q2.10, 18 testi — olulisimad)

1. Grant: „1 aktiivne" reegel; `grantBasis` ei leki mitte-adminile; 403-väravad.
2. Vaatajapõhised serializer'id: KUT näeb ainult piiratud kaarti; VÕÕR/CLIENT/ADMIN → sama 404; OS† kirjutuskeeld; IDOR-sviip roheline.
3. Eeskamber (M6): ainult omanik; jagatud vaade ei impordi privaat-serializer'it (import-graafi/CI-grep); M6 toiming ei kirjuta M13.
4. Teadlik jagamine: M7 on külmutatud koopia; SUPERVISOR_ONLY ei jõua teiste OS-vaatesse; tundmatu kehaväli → 400.
5. Kokkuvõte: DRAFT ainult SV; APPROVED muutumatu; lävi arvutatud luku all; viimane kinnitus = APPROVED samas tehingus.
6. **Sulgemine/purge:** kogu järjestus ühes tehingus; PENDING → 409; toorsisu (M7/M8.note/M9 DRAFT) kustub, kinnitatud+faktid+M6+M12 jäävad; idempotentne kordus ei tee teist purge't/pakki; rollback tõendatud; `purgeReport` raw SQL-iga kinnitatud.
7. **RAG-isolatsioon:** ükski supervisiooni vabatekst ei jõua RAG-i tööjärjekorda ega embedding'usse (test #18, runtime-pool).
8. **Tööheaolu üleandmine:** superviisor EI näe kirjet enne jagamist (→ 404); fingerprint-mismatch → 409; topelt → 409; toorkirje ei liigu.
9. U1/U2: 6 sündmust = fakt+viide sisuta (test #15); continuity kuni 2 kirjet/kasutaja; dedupeKey-leping.
10. UI (P10): privaatsusmärgis alati nähtav; jagamis-eelvaade näitab täpselt manifesti; 409-UX; ET/EN/RU pariteet; reduced-motion.

Käivita T22 sihttestid ja kahjustatud regressioonid (kovisiooni/Tööheaolu pere — `covisionHandoff.js` peab jääma puutumata), muudetud failide lint, `npm run i18n:check`, Prisma validate + `db:migrate:check`, `git diff --check` ning production build. Täissviit ja sõltumatu release-audit jäävad T27-sse (= SUP-P11).

## Sünteetiline runtime ja DoD

Kasuta ainult lokaalset sünteetilist DB-d ja olemasolevaid testidentiteete. Tõenda kahe kontoga: grandi elutsükkel, protsessi/kontrakti/kutse/nõusolek, eeskambri privaatsuspiir (superviisor ei näe M6-t), teadlik jagamine + audience, kokkuvõtte kinnituslävi, **atomaarne sulgemine + purge** (raw SQL kinnitab, et toorsisu kustus ja kinnitatud+M12 jäid), Tööheaolu üleandmine eeskambrisse, RAG-isolatsioon. Korista kõik loodud protsessid, osalused, teemad, kokkuvõtted, pakid ja sündmused. Kui mõni osa vajab päris RAG-i või välist teenust, märgi `NOT_RUN`/`NOT_PROVEN` — ära kasuta tootmist.

Valmis on siis, kui E1–E7 on samas harus, eeskambri ja isikliku paki privaatsuspiir on serveris testitud, sulgemine/purge on atomaarne ja tõendatud, supervisiooni tekst ei jõua RAG-i, Tööheaolu üleandmine jõuab eeskambrisse (mitte superviisorile), UI kannab privaatsusmärgiseid, worktree on puhas ning commit/push tehtud. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne

Esita worktree, haru, kasutatud `main`-baasi SHA, lõppcommit/remote SHA, migratsioonid (eeldatavasti 0 uut — P0 on olemas), E1–E7 (P1–P10) kokkuvõte, testid/lint/i18n/Prisma/diff-check/build, sünteetiline runtime/cleanup või `NOT_RUN`/`NOT_PROVEN`, välja jäetud osad (SUP-P11, retention, admin-UI) ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

Pärast lõpparuannet teeb Fable fokuseeritud lepingu kontrolli: eeskambri/M12 privaatsuspiir, atomaarne purge, RAG-isolatsioon, Tööheaolu-üleandmise siht ja vaatajapõhised serializer'id. Ta ei korda täissviiti, buildi ega tervikauditit.

## Lõpetamisel: uuenda AINULT `SEIS.md`

Kui töö on valmis, katkeb või jääb pooleli, uuenda [`SEIS.md`](./SEIS.md) — **ja mitte ühtki teist registrit**:

1. **Seisutabeli rida** → uus olek, haru + lõppcommit SHA, kasutatud baas-SHA, väravate tulemus, mis jäi `NOT_PROVEN`.
2. **Järjekord** → mis avanes, mis on järgmine.
3. **Vananenud väide** → kui selgus, et mõni SEIS.md lause on vale, paranda kohe seal.

Masterregistrit, arendusprogrammi ega omanikuvaadet **ei uuendata teema oleku pärast**. **Kirjuta SEIS.md-sse ka pooleliolek.**
