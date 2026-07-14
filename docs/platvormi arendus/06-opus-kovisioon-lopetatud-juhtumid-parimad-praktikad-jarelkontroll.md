# 06 — Opus järelkontroll: Kovisioon, Lõpetatud juhtumid, Parimad praktikad

> **LÕPPOTSUS: `OPUS PARANDUSED VAJALIKUD`** — P0 puudub; 1 kitsas P1 (A-P1-1) blokeerib. Ülejäänu P2. Kasutaja otsus (2026-07-14): peatu, Sol parandab + regressioontest + kordusaudit enne uue arenduse jätkamist.
>
> **Audit A** faili `05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md` §14 järgi.
>
> **Mudel / effort:** Claude Opus 4.8, Extra (`xhigh`)
>
> **Kontrollitav commit:** `7f20d7ce14e00262a5e4851a05eb59425968e770`
>
> **Auditi tüüp:** read-only. Koodi/skeemi/dokumente EI muudetud, EI commit'itud, EI deploy'itud.
>
> **Kuupäev:** 2026-07-14

## 1. Tööpuu algseis

- `main` HEAD auditi ajal: `3b52f399` (docs-commit `7f20d7ce`/`9a46192b`/`42fe884a` peal); auditeeriti fikseeritud `7f20d7ce`.
- Töökataloog: puhas, v.a kasutaja kõrvalised ruumifailid (`public/room/frame-*.webp` kustutused, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs`) — **puutumata**.

## 2. Kohustuslikult loetud / kontrollitud

Aktiivne kood: `lib/covisionSession.js`, `covisionSessionShared.js`, `covisionConstants.js`, `covisionCompletedCases.js`, `covisionLegacyWrite.js`, `covisionAccessShared.js`, `covisionInvites.js`, `lib/effectivePractices.js`, `covisionKnowledge.js`, `lib/covision.js`, `lib/topicSeeds.js`, `lib/calls/service.js` + `calls/covisionRoutes.js` + `calls/covisionLifecycle.js`, `lib/privacy/userDeletion*.js`, `effectivePracticeAccountCleanup.js`; API-marsruudid `app/api/covision/**`, `app/api/topic-seeds/[id]/covision`; tootmisvaated `CovisionLiveSession.jsx`, `CovisionWorkspace.jsx`, `CompletedCasesPage.jsx`, `EffectivePracticesPage.jsx`; 6 migratsiooni `20260714120000…190000`; testipakett `tests/covision/**`, `tests/calls/**`, `tests/topicSeeds/**`. Spetsid: `05-...progress.md` §2/§7–14.

## 3. Päriselt käivitatud kontrollid (objektiivsed, `main`-il)

| Kontroll | Tulemus |
|---|---|
| `npm test` | **1070/1070** ✔ |
| `npm run i18n:check` | OK (ET baas, EN/RU pariteet) ✔ |
| `npm run lint` | **0 viga**, 359 varasemat hoiatust ✔ |
| `npx prisma validate` / `generate` | OK ✔ |
| `npm run db:migrate:check` | **87 migratsiooni**, drift puudub ✔ |
| `npm run build` | Compiled successfully; kõik marsruudid registreeritud ✔ |
| `git diff --check` | puhas ✔ |
| Runtime-smoke (autentimata) | `GET /api/covision/completed`, `POST …/session/actions`, `POST …/close`, `POST /api/topic-seeds/:id/covision` → **401** `api.common.unauthorized` ✔ |

**Migratsioonide struktuurne audit (Opus, lisaks):** 6 migratsiooni on edasiühilduvad. Kaks andmemigratsiooni, mida `db:migrate:check` **ei** testi (jookseb tühjal DB-l), verifitseerisin lugedes: (a) `publicId` backfill `md5(random()||clock_timestamp()||id)` sisaldab rea unikaalset `id`-d → reapõhiselt garanteeritud unikaalne enne `SET NOT NULL`; (b) legacy RAG-quarantine `INSERT` on idempotentne (`NOT EXISTS` + deterministlik, erineva prefiksiga id → PK-põrget pole) ja viib legacy PUBLISHED/REVIEW read `NEEDS_CHANGES`-i. **Mõlemad korrektsed.**

## 4. Auditimeetod

Kuus sõltumatut adversaalset lugejat, igaüks eraldi kitsa mandaadiga: (1) session-mootor + Teemaseeme→Kovisioon; (2) etapp-8 closure + Lõpetatud juhtumid + kõne lõpetamine; (3) Parimad praktikad + RAG + konto kustutamine; (4) läbiv serializer-/privaatsuse-leke; (6) UI ajalugu/võistlused/ligipääsetavus. Iga leid nõudis konkreetset fail, rida ja murdmisstsenaariumi. Kaks P1 verifitseeris Opus ise koodist üle.

## 5. Leiud

### P0 — ei leitud

Kõik privaatsuse-, andmeterviklikkuse-, atomaarsuse- ja idempotentsuse-invariandid kehtisid adversaalse surve all (vt §7).

### P1 — 1 leid (päris viga)

**A-P1-1 — `serializeCallSession` väljastab sisemise `userId` covision-kõne osalejatele.**

- **Fail / read:** `lib/calls/service.js:174` (`startedByUserId`), `:180` (`participants[].userId`), `:191` (`speakRequests[].userId`), `:194` (`resolvedByUserId`). Tagastustee: `app/api/covision/[id]/calls/route.js` (+ join/leave/mute/speak-requests) → `requireCovisionCallAccess` (`lib/calls/covisionRoutes.js:27`).
- **Käivitustingimus:** aktsepteeritud covision-osaleja/vaatleja (MITTE omanik) teeb GET/POST mis tahes `/api/covision/[id]/calls/**` marsruudil, kui kõnes on ≥1 teine liige → vastus sisaldab teiste liikmete sisemisi platvormi `userId`-sid.
- **Mõju:** sisemine kasutaja-ID (autori keelatud nimekirja punkt) jõuab tavaosalejani. Kõrvalasuv `serializeParticipant` (`covisionSession.js:399`) peidab teadlikult `userId` ja kasutab ainult opaakset `participant.id`-d — kõnepayload rikub sama covision-privaatsuslepingut. Ei ole andmekadu ega õiguste-eskalatsioon.
- **Klass:** PÄRIS VIGA. `serializeCallSession` on **olemasolev** (baasi-redisain `64a24eb4`, teenindab ka ruumikõnesid); commit `7f20d7ce` **taaskasutas** selle covision-kõnedele covision-spetsiifilise ID-eemalduseta.
- **Miks P1, mitte P0:** väljastatavad on opaaksed cuid-id (mitte e-post/PII), saajad on sama live-kõne aktsepteeritud liikmed.
- **Oodatav parandus:** covision-kontekstis (`call.contextType === CALL_CONTEXT_COVISION`) tagastada track-korrelatsiooniks ainult opaakne `callParticipant.id` (juba unikaalne kõne piires) ning JÄTTA payloadist välja `participants[].userId`, `startedByUserId`, `speakRequests[].userId`, `resolvedByUserId`. Sama parandusega eemaldada `displayNameFor` e-posti fallback (A-P2-1) defense-in-depth'ina.
- **Vajalikud regressioonitestid:** (1) covision-kõne serialiseeritud payload mitte-omanikust aktsepteeritud osalejale EI sisalda ühtki `userId`/`startedByUserId`/`resolvedByUserId` välja (ainult opaaksed id-d + `displayName`); (2) klient suudab endiselt audio-radu korreleerida `callParticipant.id` kaudu; (3) e-post ei ilmu kunagi `displayName`-ina ka siis, kui tulevane include lisaks `email`-i (või fallback on eemaldatud). (Ruumikõne kontekst — `CALL_CONTEXT_ROOM` — võib `userId` säilitada, kui see on seal teadlik olemasolev leping; test peab covisioni ja ruumi eristama.)
- **Verifitseeritud Opuse poolt** (kood loetud `lib/calls/service.js:100-199`).

### P2 — leiud (robustsus / defense-in-depth / valikuline / teadlikult edasilükatu)

| ID | Leid | Fail | Klass |
|---|---|---|---|
| A-P2-1 | `displayNameFor` e-posti fallback on latentne e-posti-leke; praegu tõkestatud ainult `select`-klauslitega (covision recording sunnib `email`-i nulliks, participant include ei vali `email`-i) | `calls/service.js:114` | defense-in-depth |
| A-P2-2 | Privaatne turvalipp (`hasBlockingSafetyOrPrivacyIssue`) blokeerib etapiedu jäädavalt; juhil/kaasjuhil pole serveriteed teise kasutaja privaatrea puhastamiseks | `covisionSession.js:852` | valikuline/robustsus (turvakeskne disain) |
| A-P2-3 | `SAVE_PRIVATE_STATE` võtab case-laiuse luku + bumpib globaalset session-versiooni → paralleelse privaatmustandi faasis 409-müra (andmekadu pole, CAS kaitseb) | `covisionSession.js:1145,1245` | valikuline/skaleeruvus |
| A-P2-4 | `startCovisionFromTopicSeed` kontrollib ainult seemne omandit; loojarolli (SW/ADMIN) värav on ainult marsruudis — teine tulevane kutsuja võiks lasta teenuseosutajal saada omanikuks | `covisionSession.js:530` vs marsruut | defense-in-depth (latentne) |
| A-P2-5 | Puuduv/vigane `expectedUpdatedAt` → 409 (`TOPIC_SEED_VERSION_CONFLICT`) mitte 400 | `covisionSession.js:137` | valikuline |
| A-P2-6 | „Owner-private package" gating on nominaalne: samad väljad (direction/nextStep/timeframe/progressMarker) on juba `serializeClosure` tipptasemel osalejale nähtavad — „privaatne pakk" ületähtsustab kaitset (disainikohane) | `covisionCompletedCases.js:333` | valikuline/by-design |
| A-P2-7 | `workFocus` tuletus (`firstText`) tunneb ainult võtmeid `text/title/question/label/summary/description`; ootamatu sisukujuga etapp-3 tööobjekt → `invalid()` 400 etapp-8 tehingu **sees** (fail-closed, kogu closure roll back, andmekadu/leket pole) | `covisionCompletedCases.js:455,514` | edasilükatu/robustsus |
| A-P2-8 | Madala riski review-ahela saab üks mitte-autor läbida üksi, kui tal on REVIEWER+EDITOR+ETHICS võimekused (spets nõuab 2 eraldi retsensenti ainult KÕRGE riski puhul → spetsikohane) | `effectivePractices.js:1058` | valikuline/spetsikohane |
| A-P2-9 | Avaldamise guard eelistab kustutamist: crash guard-commiti ja lingi vahel → drain kustutab >10 min vana guardi ka siis, kui ingest õnnestus; `verify 0/0` ei tõenda et iga avaldatud praktika on RAG-is | `effectivePractices.js:1284`, `drain-...mjs:5` | **edasilükatu (= uue töö P1-A)** |
| A-P2-10 | `re_review`/ACCEPTED-application: RAG-dok kustutus + `ragSourceId=null` toimuvad pärast commiti → lühike aken, kus juba-avalik sanitiseeritud snapshot jääb RAG-i päritavaks (privaatsuse-eskalatsiooni pole; kustutustöö püsivalt järjekorras) | `effectivePractices.js:1251,1516` | edasilükatu |
| A-P2-11 | `buildEffectivePracticeRagDocId` võtmestab rea optimistlukk-`version`-il (mitte avaldamisversioonil) → vale id, KUI kunagi live-teel kasutataks; praegu ainult testis, surnud kood | `covisionKnowledge.js:142` | valikuline/latentne |
| A-P2-12 | `CompletedCasesPage.closeDetail` kasutab `pushState` → Back taasavab detaili modaali (erineb `EffectivePracticesPage` back-or-replace mustrist) | `CompletedCasesPage.jsx:466` | valikuline-UX |
| A-P2-13 | Surnud i18n-võti `covision.live.exit` („Välju"); ühtki JSX-viidet pole — ainus väljumine on `back_to_cases` (üks-väljumine invariant **kehtib**) | `messages/*.json` | edasilükatu/surnud võti |
| A-P2-14 | `EffectivePracticesPage.reviewApplication` ilma request-väravata / 409-re-fetchita, `finally setBusy(false)` ja viga läheb top-level `setError`-isse (mõjutab loendiridu, mitte avatud detaili) | `EffectivePracticesPage.jsx:752` | valikuline/robustsus |
| A-P2-15 | `aria-controls` viitab kokkuvarisenud paneeli id-le; popstate/deep-link modaal ei sea opener-ref'i → sulgemisel fookus ei naase | `CompletedCasesPage.jsx:559`, `EffectivePracticesPage.jsx:796` | väike a11y |

## 6. Jaotus

- **Päris vead:** A-P1-1 (P1).
- **Teadlikult edasilükatud operatsioonitööd:** A-P2-9, A-P2-10 (RAG-reconcile — kattub täpselt uue töö P1-A/P1-E-ga), A-P2-7, A-P2-13.
- **Valikulised UX/robustsus/defense-in-depth:** A-P2-1..6, A-P2-8, A-P2-11, A-P2-12, A-P2-14, A-P2-15.

## 7. Invariandid, mis KEHTIVAD (agendid proovisid murda, ei suutnud)

- **Teemaseeme→Kovisioon:** owner-only, advisory-lock + üks tehing, versioonikindel (`sameInstant` + `updateMany … WHERE status=WAITING, covisionCaseId=NULL, updatedAt` CAS, `count!==1`→409), idempotentne varajane tagastus, **1:1 DB-tasemel** (`TopicSeed.covisionCaseId @unique`); kopeeritakse ainult `sharedCardSnapshot`, mitte `safetyGate`/privaat.
- **Etapiväravad:** `COMPLETE_STAGE` arvutab tõendid serverist (`buildServerStageGateState`), kliendi `payload.evidence` ignoreeritakse; versioonimatš → generic 409; `@@unique([sessionId, stage])` blokeerib topelt.
- **Privaatolek-isolatsioon:** `privateStates: { where: { userId } }`, `workItems: { where: { visibility: "shared" } }`; etapp-7 snapshot ainult whitelist-väljad; closure joonistab ainult stage-snapshot payload'idest.
- **Etapp-8 closure:** atomaarne + idempotentne (sama lukk/tehing loob closure + follow-up + owner-pakk, kustutab privaatolekud/tööobjektid/legacy sõnumid/toorväljad/kõne, CLOSED + seeme FOLLOW_UP); kordus tagastab olemasoleva closure'i ilma teist loomata.
- **Terminal read-only:** `isCovisionCaseTerminal` (closure VÕI CLOSED/ARCHIVED VÕI phase=complete); legacy sõnum/kokkuvõte/PATCH + session actions + kõne-mutatsioonid kõik blokeeritud; ka terminal-no-session read.
- **Rollivaated + follow-up aken:** owner/kutsutu/osaleja/järelvaate-tegija/kõrvaline; endine järelvaate-tegija kaotab refleksiooni-nähtavuse ümbermääramisel/sulgemisel; kõrvaline → generic 404.
- **Parimad praktikad:** avalik serializer ei lekita autorit/lähte-ID-d/retsensendi-märkmeid/RAG-viiteid; autor ei kinnita ise (review/publish/anonüümsus); COI (user-id VÕI seotud e-post) blokeerib retsensendi+kinnitaja; KÕRGE risk = 2 eraldi REVIEWER-inimest; avaldatud snapshot `Object.freeze`, ajalugu sanitiseeritud; ADMIN ei saa sisulooja õigust; konto kustutamine `SELECT … FOR UPDATE` + versioon/staatus CAS (ei revert avalikuks, ei jäta anonüümset orbu).
- **Privaatsuspiirid:** kutsutu (INVITED) näeb ainult `{case:{id}, self-participant, version}`; osaleja ei näe `casePrefill`/teise privaatolekut/owner-pakki/retsensendi-märkmeid/lähte-ID-d; session-snapshot ei emiteeri osaleja e-posti/TopicSeed-id/sisemist userId-d.
- **Kõne lõpetamine:** aktiivsust loovad toimingud → 409 terminalis; puhastustoimingud idempotentsed värske rea + jagatud luku all.

## 8. Lõppotsus

**OPUS PARANDUSED VAJALIKUD** — kitsalt.

Pakett on kvaliteetne ja invariandirikkalt terve: **P0 puudub**, kõik dokumenteeritud privaatsus-/andme-/atomaarsuse-väited kehtivad tõendatult. Blokeerib ainult **üks kitsas P1 (A-P1-1)** — covision-kõne serializer väljastab sisemised opaaksed `userId`-d aktsepteeritud osalejatele (olemasolev, covisioni taaskasutatud serializer). See on väike, lokaalne parandus (kasuta opaakset `callParticipant.id`-d). Kõik muu on P2 (valikuline/edasilükatu). Doc 01 §1 järgi: P1 tuleb Solil parandada + regressioontest lisada + kordusaudit, enne kui uus arendus jätkub.

## 9. Soli paranduse üleandmine Opuse kordusauditiks — 2026-07-14

**A-P1-1 parandatud, Opuse kordusauditi ootel.** Algset Opuse lõppotsust selles dokis ei kirjutata üle enne sõltumatut kordusauditit.

- `serializeCallSession` eristab nüüd `COVISION` ja `ROOM` konteksti. Kovisiooni vastus ei väljasta `startedByUserId`, `participants[].userId`, `speakRequests[].userId` ega `resolvedByUserId` välju.
- Kovisiooni käivitaja ja kõnejärjekord seotakse opaaksete `callParticipant.id` väärtustega (`startedByParticipantId`, `participantId`, `resolvedByParticipantId`). Tavaruumi senine `userId` leping säilis.
- `displayNameFor` e-posti fallback eemaldati; profiilinime puudumisel tagastatakse tühi nimi, mitte e-post.
- Lisatud käitumistest Kovisiooni payloadi, opaaksete seoste ja e-posti puudumise kohta ning eraldi regressioonitest tavaruumi lepingu säilimise kohta. Source-contract kontrollib sama kontekstipiiri.
- Kontrollid enne commit'i: sihttestid **35/35**, kogu `npm test` **1074/1074**, `i18n:check` OK, muudetud failide ESLint 0 viga/0 hoiatust, kogu lint 0 viga, build OK, `db:migrate:check` 87 migratsiooni OK.

Kordusauditi ülesanne: kontrolli A-P1-1 kolme nõuet, sh et ükski Kovisiooni kõne API vastusetee ei serialiseeri sisemist kasutaja-ID-d ja `ROOM` kontekst ei regressi.
