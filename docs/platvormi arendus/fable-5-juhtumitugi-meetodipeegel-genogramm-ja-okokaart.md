# Fable 5: juhtumitugi — juhtumitöö assistent, Meetodipeegel, genogramm ja ökokaart (CASEWORK-A0)

STATUS: COMPLETE (esimene täisring 17.07.2026; vt lõpurida. COMPLETE tähendab valmis analüüsi, mitte valmis rakenduskoodi, ega anna ühelegi paketile arendusluba — iga pakett käib koordinaatori arendusvalmiduse väravast läbi eraldi.)

> Toote-, metoodika-, privaatsus- ja arhitektuurianalüüs: kuidas SotsiaalAI toetab spetsialisti
> juhtumitööd STAR2 kõrval (juhtumitöö assistent), professionaalset refleksiooni (Meetodipeegel)
> ning pere- ja keskkonnaseoste visuaalset mõtestamist (genogramm ja ökokaart) — COLLAB-A0
> võrgustikumudeli, K1 tööruumilepingu ja U1 sündmuskihi peal, STAR2 dubleerimiseta.
> Autor: Fable 5 (CASEWORK-A0), 2026-07-17. Ainult analüüs — rakenduskoodi, skeeme, migratsioone ega teste ei muudetud.

## Edenemistabel

| Etapp | Sisu | Seis |
|---|---|---|
| 0 | Tõeallikad (git/origin/server/harud/teenused, read-only) | TEHTUD |
| 1 | Kohustuslike sisendite lugemine (5 dokumenti + ideed 13–15) | TEHTUD (loend Jätkamispunktis) |
| 2 | Koodikontroll (vastuvõtulaud, receiverChecklist, artefaktid, doonormudelid, genogrammi 0-seis) | TEHTUD |
| 3 | Ptk 1 — juhtumitöö assistendi roll ja pädevuspiir | TEHTUD |
| 4 | Ptk 2 — kandjapiir juhtumitöös (STAR2) | TEHTUD |
| 5 | Ptk 3 — Meetodipeegli metoodiline leping | TEHTUD |
| 6 | Ptk 4 — genogramm ja ökokaart võrgustikumudeli vaadetena | TEHTUD |
| 7 | Ptk 5 — kolmandate isikute andmete leping | TEHTUD |
| 8 | Ptk 6 — osaleja-, jagamis-, sündmuse-, tegevuse-, otsuse- ja ajajoonelepingud | TEHTUD |
| 9 | Ptk 7 — seosed (K1/U1, COLLAB, Teekond, eelpöördumine, kohtumised, Kovisioon, Supervisioon) | TEHTUD |
| 10 | Ptk 8 — riskid, doonorid, dubleerimiskeelud | TEHTUD |
| 11 | Ptk 9 — otsuste register (sh ideed 17 k1–k11 kaardistus) | TEHTUD (10 otsust) |
| 12 | Ptk 10 — paketid CASEWORK-P0…P6 + ptk 11 lõppväljund + master-registri uuendus | TEHTUD |

## 0. Tõeallikad (kontrollitud 2026-07-17, read-only)

| Allikas | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa` — "merge: integrate Admin P0.1 safety gates and independent audit" | `git fetch` + `git log origin/main` 17.07 |
| Tootmisserver | `fe4eb4fa` — identne origin/main-iga; tööpuu puhas. Teenused: `sotsiaalai-frontend.service` (running), `sotsiaalai-rag.service` (running), `livekit.service` + `livekit-egress.service` (running); pm2 all 3 MUUD saiti (avasta, beyondframes, raio). Taimerid: notifications (~5 min, viimane käivitus 10:57:45 EEST = 24 s enne kontrolli), practice-reviews ja service-availability (päevased) | `ssh sotsiaalai`, `git rev-parse HEAD`, `systemctl list-units/list-timers` 17.07 |
| Lokaalne main | `0da4185b` — 1 ees / 22 taga; määrdunud tööpuu (CSS, `components/register/`, i18n, dokumendid) — EI kasutatud tõeallikana. Tööpuu on `lib/`, `app/api/` ja `prisma/` osas bait-identne lokaalse HEAD-iga; origin/main erineb neist ainult Admin-P0.1/Help-P0/RAG-P8.0 failides, mis EI ole juhtumitöö pinnad — seega lokaalsed lugemised allpool = origin/main sisu | `git status --porcelain`, `git diff --name-only origin/main` |
| `prisma/schema.prisma` | tööpuu = origin/main (bait-identne); 102 mudelit | `git diff --quiet origin/main -- prisma/schema.prisma` |
| K1-P0 | `origin/codex/k1-p0-workspace-contract @ ef5973c9` [BRANCH] — registry SISU üle kontrollitud: `meeting`, `network_case`, `field_visit`, `org_space` RESERVED; **`case_work` ega `practice_reflection` kind'i registris EI OLE** | `git show origin/...:lib/workspaces/registry.js` |
| SUP-P0 | `codex/supervision-v0-p0-schema @ 2fc826c4` — AINULT lokaalne haru, remote'is puudub | `git branch -r --no-merged` loend |
| Merge'imata remote-harud | 20 origin-haru (sh k1-p0, tooheaolu-e0, vest-p0, rag-qm-p0, maksed-*, u6/u7); ÜKSKI ei sisalda juhtumitöö-, genogrammi- ega võrgustikukoodi | `git branch -r --no-merged origin/main` + grep |
| Juhtumitöö kood [MAIN] | `CaseWork*`, `PracticeReflection`, `Network*`, `Meeting*` mudeleid ja `genogram/ecomap` koodi **EI EKSISTEERI** (0 vastet kogu koodibaasis) | grep schema + lib/app/components |

Kontrollitud juhtumitöö-seotud kood (kõik [MAIN], tööpuu = origin/main nendel failidel):

| Pind | Leid |
|---|---|
| Vastuvõtulaud | `app/eelpoordumised/page.jsx` → `WorkspaceFeaturePage feature="pre_inquiries"` (4869 r): plokid „Saabunud eelpöördumised" → „Valitud eelpöördumine" → „Vastuvõtja tööplaan" → „Eelkaardistuse struktureeritud eelinfo"; salvestus `PATCH /api/pre-inquiries/[id]/workflow` (receiverNote + receiverChecklist + nextContactOn) |
| `receiverChecklist` | `lib/preInquiryReceiverWorkflow.js` — 5 fikseeritud punkti (review_preinfo, check_consent, check_urgency, clarify_missing, choose_next_step); sildid EESTIKEELSED KOODIS (TÖÖLAUD P2-6 klassi rikkumine); riskisõnumi/lünkade korral dünaamiline silt `buildPreInquiryAssessmentReview` pealt |
| `PreInquiry` (schema :1864) | receiverChecklist Json, nextContactOn String, assessmentState Json, sourceJourneyId (Teekonna-sild), recalledAt + supersededById + openedAt (tagasivõtu/paranduse elutsükkel), externalSendConfirmedAt |
| Artefaktid | `AgentArtifact` (:3076, DRAFT/FINAL + DocumentAudit); `AgentArtifactType` juba sisaldab **STAR_HELPER, CASE_SUMMARY, CASE_BRIEF, PRE_ASSESSMENT_SUMMARY, ACTION_PLAN, CHECKLIST, MEETING_SUMMARY, REPORT_DRAFT, LETTER_DRAFT**; `lib/documents/generation.js` structureGuide STAR_HELPER-ile: "grouped by observations, needs, strengths, risks, actions, and follow-up" + audience worker/client + toon/pikkus/keel |
| Kõne salvestuseesmärgid | `lib/calls/service.js` RECORDING_PURPOSE_LABELS: CASE_SUMMARY („juhtumikokkuvõtte mustand"), STAR_HELPER („STAR-i sisestamise abimaterjal") jt — samuti ET-only koodis |
| Kovisiooni sillad | `CovisionCase.sourcePreInquiryId` + `anonymizedDescription` (juhtum saab sündida eelpöördumisest); `TopicSeed` (whyNow, requestedSupport, safetyGate, sharedCardSnapshot külmutus, ownerConfirmedAt); `WellbeingOutputDraft` (userReviewed/userConfirmed/covisionCaseId/handedOffAt — kinnitatud üleandmise täismuster) |
| Tööheaolu piirinaabrus | `components/wellbeing/HardCaseWorkflow.jsx` — raske juhtumi TÖÖTAJA-KOORMUSE vorm (vahetu oht, eetiline pinge, moraalne stress, taastumine, covisionNeed) — heaolu-, MITTE metoodikarefleksioon |
| Room | `originType` on String (mitte PG-enum), väärtused sh PRE_INQUIRY — eelpöördumisest saab avada ruumi |

Kolme seisundi eristus kehtib kogu dokumendis: `[MAIN]` = origin/main+server; `[BRANCH]` = ainult harul; `[VISION]`/`[DOC]` = ainult analüüsides. Lokaalne määrdunud tööpuu ei ole ühegi väite alus. COLLAB-A0, K1-U1-A0 ja RUUM-VIS-A0 valmis analüüsi EI korrata — neile viidatakse.

## 1. Juhtumitöö assistendi roll ja pädevuspiir

### 1.1. Määratlus ja rollijaotus STAR2-ga

Juhtumitöö assistent (JTA) on **spetsialisti privaatne ettevalmistus-, mõtestamis- ja ülekandetööruum STAR2 kõrval** (ideed 4.1 rollijaotus on siduv lähtekoht). Ta ei ole register, menetlus, kliendihaldus ega juhtumiplaan — ta on kiht, mis muudab STAR2-eelse ja -vahelise töö (eelpöördumise vastuvõtt, kohtumise ettevalmistus, märkmete struktureerimine, mustandi kontroll, ülekande jälgimine, järelrefleksioon) nähtavaks ja korratavaks, ilma et ükski ametlik kirje tekiks platvormile.

Määratluse kolm kandvat allikat: STAR2 strateegia nimetab paralleelsüsteeme riskina (ideed 4.9) → SotsiaalAI teadlik positsioon on „STAR2 sisestuse ettevalmistaja, mitte konkurent"; kandjapiir (COLLAB-A0 1.3) annab õigusliku selgroo; visioonivastus (RUUM-VIS 6.9) annab ruumilise kuju (muutuv stuudio, mille ÜKS väljund on STAR2-mustand).

### 1.2. Pädevuspiir kolmel teljel

**a) Andmepiir — mida JTA hoiab** (ideed 4.7/10.2 loend on normatiivne): eelpöördumise algmaterjal; töösolevad mustandid; puuduva info loend; kohtumise ettevalmistus; STAR2 viitenumber + ülekandestaatus; privaatne refleksioon; deidentifitseeritud Kovisiooni/Supervisiooni sisendid; piiratud võrgustikuruumi metadata. JTA EI hoia: aktiivset juhtumiplaani koopiat pärast ülekannet, CaseGoal/CaseAction/CasePlan olemeid, teenuste-toetuste määramisi, riiklike registrite peegeldusi.

**b) Otsustuspiir — mida assistent (AI) teeb ja EI tee.** Siduv piir: inimese otsustusõigus säilib; assistent ei tee juhtumi-, riski- ega metoodilisi otsuseid kasutaja eest. Ideed 13.3 loendid muutuvad siin lepinguks:

| AI TEEB (alati DRAFT-märgisega, K2 päritolu „AI koostatud mustand") | AI EI TEE KUNAGI |
|---|---|
| struktureerib eelinfo (assessmentState → struktureeritud eelinfo on juba [MAIN]) | ei tee abivajaduse hinnangut ega otsusta teenusele õiguse üle |
| märkab puuduvat/vastuolulist/aegunud infot ja pakub täpsustavaid küsimusi | ei anna riskiskoori otsuse alusena; ei triaaži pöördumisi (mitte-ehitada nr 5) |
| koostab STAR2 struktuurile vastava mustandi (STAR_HELPER structureGuide on juba [MAIN]) | ei saada midagi STAR2-sse ega täida ametlikke välju kasutaja eest |
| pakub kohtumise päevakorra/küsimuste/lihtsa keele mustandi (U7) | ei muuda hüpoteesi faktiks — päritolumärgis ei tohi „üle kirjutuda" |
| kõrvutab refleksioonis meetodit ja reaktsiooni, küsib refleksiooniküsimusi | ei määra „õiget" meetodit ega hinda töötaja kvaliteeti |

**c) Kandjapiir** — ptk 2; JTA sisu on vaikimisi klass 1 (töömustand); klass 2 tekib ainult teadliku kinnitusega; klass 3 ei teki platvormil kunagi.

### 1.3. Mis on juba olemas [MAIN] — proto-JTA inventuur

Analüüsi kõige olulisem koodileid: **JTA ei alusta nullist — tema selgroo tükid on toodangus töös, aga sidumata.** Ideed 4.3 töölaua kümnest reast on täna kaetud või osaliselt kaetud kuus:

| Ideed 4.3 töölaua rida | Kate täna [MAIN] | Auk |
|---|---|---|
| saabunud eelpöördumised | vastuvõtulaud (ptk 0 tabel) — täielik voog kviteeringu, tagasivõtu ja parandusega | — |
| tänased vastuvõtud / järgmised kontaktid | `nextContactOn` + NEXT_CONTACT_DUE teavitus + continuity prio 0/4 | kontakt on kuupäev-string, mitte „ülesanne vastutajaga" (K1-U1 leitud auk) |
| aktiivsed ettevalmistustööd | receiverChecklist (5 punkti) + receiverNote | fikseeritud checklist, mitte ettevalmistuskonteiner; ET-only sildid |
| STAR2-sse kandmist ootavad mustandid | AgentArtifact STAR_HELPER/CASE_* tüübid DRAFT/FINAL | ülekande-olekud (kontrollitud/kantud/ei kanta), viitenumber ja kirjutuskaitse puuduvad |
| puuduv ja kontrollimist vajav info | assessmentState review (unknownQuestions, unansweredPrimaryCount, riskMessage) | ainult eelpöördumise piires; mitte tööobjekt |
| Kovisiooni/Supervisiooni ettevalmistus | TopicSeed [MAIN] + CovisionCase.sourcePreInquiryId + WellbeingOutputDraft handoff | Meetodipeegli kirjet (mille PEALT ette valmistada) pole |
| võrgustikutöö ettevalmistus | — (COLLAB-P4/P5 teema) | kogu kiht |
| Meetodipeegel | — (HardCaseWorkflow on heaolu-, mitte metoodikavorm) | kogu kiht (ptk 3) |
| STAR2 ülekandmise ajalugu | — | kogu kiht (P2) |

Järeldus: JTA esimesed sammud on olemasolevate tükkide LEPING ja SIDUMINE (paketid P0–P1), mitte uus andmekiht. Uus andmekiht (ülekande-olekud, refleksioonikirje) tuleb alles otsuste järel (P2–P3).

### 1.4. JTA kui K1 tööruum

- **Kind:** K1-P0 register [BRANCH] EI reserveeri `case_work` kind'i — erinevalt kohtumisest/võrgustikust, mille kind'id on juba RESERVED. See tähendab kahte asja: (1) registrilaiendus (2 rida RESERVED-staatuses: `case_work`, `practice_reflection`) tuleb teha koos esimese CASEWORK-paketiga; (2) enne konteineriotsust (O-CW-10) töötab JTA descriptor OLEMASOLEVATE kind'ide peal: vastuvõtja vaade = `pre_inquiry` kind'i vastuvõtja-skoobitud descriptor (kind on registris juba RESERVED).
- **Descriptor:** K1 4.1 väljad katavad vajaduse: lifecycle (eelpöördumise staatusekaardistus on K1 4.2.1 tabelis juba olemas), nextAction (= nextContactOn), goal (kohtumise eesmärk), visibility PRIVATE. Faasid: `vastuvõtt → ettevalmistus → kohtumine → mustandikontroll → ülekanne → refleksioon` — toetavad, mitte sundivad (K1 4.2.2); ükski faas ei sulgu taimeriga.
- **Nähtavus:** JTA on PRIVATE-klassi etalon koos Teekonnaga (K1 4.4). Jagamine käib AINULT väljundobjektide kaudu (artefakt kohtumise ühisvaatesse, deidentifitseeritud mustand Kovisiooni, külmutatud kokkuvõte võrgustikku) — „jaga kogu juhtum" nuppu ei eksisteeri üheski versioonis (K1 4.11).
- **Sündmused:** kõik vajalikud perekonnad on K1-U1 ptk 7 kataloogis; JTA ei lisa ühtegi uut perekonda (ptk 6.3 — vaja on 1 uus tüüp olemasolevas perekonnas).

### 1.5. Mida JTA EI OLE (keelud, koondatud allikatest)

SotsiaalAI ametlik kliendibaas; STAR2 juhtumiplaani/menetluse peegel pöördujale (mitte-ehitada nr 2); automaatne STAR2-saatja (ainult „Kopeeri STAR2 jaoks" kuni SKA/TEHIK-u ametliku liidestusleppeni — ideed 4.8 jääb kaugeks tulevikuks ega ole üheski CASEWORK-paketis); AI riski-/triaažimootor; teine vestlus- või failisüsteem; organisatsiooni juhtumihaldus (org-mudelit ei ole [DECISION, ORG-A0]).

## 2. Kandjapiir juhtumitöös: töömustand, kinnitatud kokkuvõte, ametlik kandja

### 2.1. Kolm klassi juhtumitöö objektidel

COLLAB-A0 1.3 kandjapiir kehtib muutmata; siin ainult juhtumitöö-spetsiifiline kaardistus:

| Klass | Juhtumitöö objektid | Reegel |
|---|---|---|
| 1 — töömustand | ettevalmistus, kohtumismärkmed, puuduva info loend, STAR2-mustand kuni kinnituseta, AI mustandid, receiverNote/checklist | purge'itav, mitte-eksporditav, tõendiväärtuseta; elab JTA sees |
| 2 — kinnitatud kokkuvõte | FINAL-artefakt (nt kinnitatud kohtumise kokkuvõte, kliendi kinnitatud eelpöördumine [MAIN]), „valmis STAR2-sse" märgitud mustand | külmutatud, versioonitud, auditijäljega; jagatav külmutatud koopiana; SIISKI mitte menetlusdokument |
| 3 — ametlik kandja | STAR2 kirje, asutuse dokumendihaldus | EI TEKI platvormil KUNAGI; platvorm annab „Kopeeri STAR2 jaoks" väljundi + viitenumbri välja; kopeerimissündmus on eksport (COLLAB klass 10): auditikirje + pöördumatuse ausus |

### 2.2. STAR2-ülekande olekurada

Ideed 4.5 olekud vormistatakse artefakti-elutsükli (K1 4.7) juhtumitöö-PROFIILINA, mitte uue masinana. Kanooniline olekusõnastik (rakenduskihi konstant, mitte PG-enum):

`MUSTAND → VAJAB_KONTROLLI (alamliigid: kliendiga | dokumendiga/registripäringuga) → KONTROLLITUD → VALMIS_ÜLEKANDEKS → ÜLE_KANTUD | EI_KANTA`

Invariandid: (1) üleminekud on kasutaja teadlikud otsused, mitte taimerid; (2) `ÜLE_KANTUD` = kirjutuskaitse + retention-kella start (kestus = O-CW-2 otsus; arhitektuur peab toetama kõiki kolme ideed 4.7 varianti: kirjutuskaitstuks / arhiveerub / kustub); (3) `ÜLE_KANTUD` kannab STAR2 viitenumbrit (vabatahtlik väli — viitenumber EI ole isikuandmete rikas väli, aga on ametliku seose ainus jälg); (4) `EI_KANTA` on võrdväärne teadlik lõpp (mitte „jäi seisma"); (5) iga üleminek = U1 sündmus + auditikirje. See rada on TÄPSELT see, mida tänane AgentArtifact DRAFT/FINAL ei kata — ja on P2 paketi tuum.

### 2.3. Päritolumärgistus — K2 kanooniline sõnastik

Ideed 4.4 kaheksa päritolu muutuvad platvormiüleseks konstandiks (JTA tuum, RUUM-VIS 6.9; sama sõnastikku tarbivad Meetodipeegel ptk 3.3, kohtumise märkmed COLLAB ptk 5 ja tulevik-võrgustik):

`KLIENDI_ÖELDUD | KLIENDI_KINNITATUD | DOKUMENDIST | TEISE_SPETSIALISTI_INFO | TÖÖTAJA_TÄHELEPANEK | TÖÖTAJA_TÕLGENDUS | AI_MUSTAND | AMETLIKULT_KONTROLLITUD (STAR2-s registreeritud/kontrollitud)`

Reeglid: (1) märgis on kirje TASANDIL (mitte dokumendi tasandil) — kohtumismärkme iga sisukas rida kannab päritolu; (2) märgis ei „parane" automaatselt: AI_MUSTAND → KLIENDI_KINNITATUD nõuab inimese toimingut; (3) TÖÖTAJA_TÄHELEPANEK (nähtud fakt) ja TÖÖTAJA_TÕLGENDUS on ERI väärtused (ideed 7 vaatluse nõue); (4) kolmanda isiku teave saab LISAKS klass-5 märgise (ptk 5); (5) sõnastik on i18n-võtmetega (mitte DB-teksti — P2-6 õppetund).

### 2.4. Varju-registri vältimise invariandid

1. Pärast `ÜLE_KANTUD` ei ole platvormil aktiivset ametliku plaani koopiat — mustand külmub (ideed 4.7/10.1 topelttõe risk).
2. STAR2-struktuuriga väljad (eluvaldkond, eesmärk, tegevus, vastutaja, tähtaeg) eksisteerivad AINULT mustandi sisuna, mitte päritavate andmeväljadena — neid ei indekseerita ega agregeerita (muidu tekiks de facto juhtumiregister).
3. Kliendi kohta ei teki JTA-s ühtki kirjet ilma allika-eelpöördumise, kohtumise või dokumendita — JTA ei ole koht, kus „lihtsalt hoida" kliendiinfot.
4. `externalSendConfirmedAt` / EXTERNAL-kanali aususe muster [MAIN] laieneb: iga väljund, mis lahkub platvormilt, ütleb ausalt, et kontroll lõpeb (U12 EXTERNAL_EMAIL pretsedent).

## 3. Meetodipeegli metoodiline leping

### 3.1. Kiht, mitte moodul

RUUM-VIS 6.7 vastus on siduv sisend: Meetodipeegel on professionaalse refleksiooni ÜHINE KIHT, mida tarbivad juhtumitöö, Kovisioon, Supervisioon ja Tööheaolu; ta avaneb tegevuse juurest („ava refleksioon" kohtumise, artefakti, eelpöördumise, kõne juurest), mitte eraldi navigatsioonisihtkohana. Käesolev peatükk lisab sellele vastuse peale METOODILISE LEPINGU — mida kirje sisaldab, mis on AI piir, kuhu väljund tohib liikuda.

### 3.2. Metoodiline alus

- **Nelja tasandi mudel** (ideed 6: lähenemisviis → meetod → töövõte/tegevus → töötaja tugimeetod) on refleksioonikirje selgroog: kirje seob need neli, sest just nende SEGAMINE on praktikas refleksiooni nõrkus (nt „kasutasin motiveerivat intervjueerimist" ilma tegevuse ja reaktsioonita).
- **36 meetodi kataloog** (ideed 7, A–F) on tulevase teadmusbaasi-kihi KANDIDAAT, mitte V1 andmestik: enne kataloogi sisulist kasutamist AI-soovitustes peab olema vastatud, kes kinnitab sisu ja ajakohasuse (O-CW-5 = ideed 17 k13–k14). Kuni selleta on meetod kirjes VABATEKST + valikuline viide (RAG-i olemasolev teadmusbaas on allikaviidete, mitte meetodi-taksonoomia kiht).
- **Piir Tööheaoluga:** HardCaseWorkflow [MAIN] käsitleb TÖÖTAJA koormust (oht, eetiline pinge, moraalne stress, taastumine); Meetodipeegel käsitleb TÖÖTAJA VALIKUT (meetod, põhjus, reaktsioon, järeldus). Sama juhtum võib avada mõlemad; kirjed EI liitu ega viita teineteisele vaikimisi (heaoluandmed on eraldi tundlikkusklass). RUUM-VIS 6.7 sõnastus „raske juhtumi refleksioon võib suunduda kumbagi" tähendab kasutaja VALIKUT, mitte andmesidet.

### 3.3. Refleksioonikirje leping

Ideed 8.2 minimaalne kirje, normatiivseks vormistatuna:

| Väljarühm | Sisu | Leping |
|---|---|---|
| Seos | juhtum/tegevus, mille kohta reflekteeritakse (sourceRef: artefakt, kohtumine, eelpöördumine, kõne) | viide, mitte koopia; allika kustumisel kirje JÄÄB („allikas kustutatud" markeriga) |
| Valik | lähenemisviis, meetod, konkreetne tegevus, valiku põhjus | nelja tasandi eristus (3.2); meetod vabatekst + valikuline kataloogiviide [kuni O-CW-5] |
| Vaatlus | kliendi eesmärk, kliendi vaade/reaktsioon, töötaja tähelepanek | päritolumärgistus KOHUSTUSLIK (2.3 sõnastik): kliendi-öeldud ≠ töötaja-tähelepanek |
| Tõlgendus | töötaja tõlgendus, mis töötas / ei töötanud, AI hüpotees (kui küsiti) | tõlgendus ja tähelepanek ERI väljad (ideed 8.3); AI hüpotees ei muutu kirjeks ilma kasutaja kinnituseta |
| Järeldus | järgmine samm, vajadus toe järele (kovisioon/supervisioon/eetiline arutelu), vahehindamise tulem (ideed 8.5 sõnastik) | vahehindamise tulem on enum-sõnastik (jätkata / kohandatult / vajab aega / ei hinnatav / klient ei soovi / väline takistus / teine lähenemine / kovisioon / supervisioon / eetiline arutelu) |
| Staatus | visibility: PRIVATE (invariant, mitte vaikeseade) | ideed 12 PracticeReflection visandi kinnitus; kirje EI OLE kunagi jagatav objekt — jagatav on ainult deidentifitseeritud TULETIS (3.5) |

Kliendi tagasiside (ideed 8.6) on eraldi sisendkanal — töötaja kirjeldatud reaktsioon ja kliendi ENDA sõnad peavad olema eristatavad (päritolumärgistus katab); kliendi tagasiside kogumise UI on kohtumise ühisvaate (COLLAB ptk 5 „sain aru / mul on parandus"), MITTE Meetodipeegli funktsioon — Meetodipeegel ainult viitab sellele.

### 3.4. AI piir refleksioonis

Ideed 8.4 + siduv otsustuspiir: AI võib pakkuda kaalumiseks meetodeid + sobivuse põhjuseid + mittesobivuse olukordi + puuduvaid andmeid + riske + alternatiive + refleksiooniküsimusi; AI EI määra õiget meetodit, EI skoori töötaja valikuid, EI võrdle töötajaid, EI tuleta refleksioonist riskisignaale. KAKS lisapiiri: (1) meetodi-soovituste funktsioon on BLOKEERITUD kuni kinnitatud kataloogita (O-CW-5) — enne seda AI ainult struktureerib ja küsib; (2) Kovisiooni SEES kehtib rangem Q1.10 (AI ei genereeri sisu) — Meetodipeegli AI-tugi lõpeb Kovisiooni ukse taga (mustandi deidentifitseerimise abi on lubatud, sest see toimub ENNE Kovisiooni viimist).

### 3.5. Väljundrajad

| Sihtkoht | Mehhanism | Olemasolev doonor [MAIN] |
|---|---|---|
| Kovisioon | refleksioonist → deidentifitseeritud mustand (keskne küsimus, kasutatud lähenemine, seni proovitu, oodatav abi — ideed 8.7) → kasutaja kinnitus → TopicSeed | TopicSeed (safetyGate + sharedCardSnapshot külmutus + ownerConfirmedAt) on TÄPSELT see muster; CovisionCase.sourcePreInquiryId tõestab allika-sideme mustri; WellbeingOutputDraft (userReviewed→userConfirmed→handedOffAt) on kinnitatud üleandmise kolmas tõend |
| Supervisioon | refleksioonide KOGUM → supervisiooni teema (supervisandi valikul) | SupervisionSharedTopic SHARED→WITHDRAWN [BRANCH] — tarbitav pärast SUP-P0 merge'i |
| Tööheaolu | „vajan tuge" järeldus → kasutaja AVAB ise heaoluvormi (navigatsiooniline, mitte andmeside) | HardCaseWorkflow.covisionNeed checkbox näitab sama suunda vastupidi |
| JTA | järgmine samm → JTA järgmine kontakt / ettevalmistus | nextContactOn muster |

Läbiv reegel: iga väljund on KÜLMUTATUD + DEIDENTIFITSEERITUD + KASUTAJA KINNITATUD tuletis; deidentifitseerimine on kasutaja vastutus, mida süsteem TOETAB (safetyGate-laadne kontrollnimekiri + AI abi), mitte automaatne garantii.

### 3.6. Anti-jälgimise invariandid

1. Praktika arenguvaade (ideed 8.8) näitab AINULT töötajale endale tema mustreid; mitte ühtegi üle-töötajate agregaati, edetabelit ega „meetodikasutuse statistikat" ühelegi rollile — arhitektuuriline keeld (sama klass kui org-analüütika üksikrea keeld, RUUM-VIS 6.12).
2. Org-õppimise küsimus (ideed 17 k15) EI OLE tehniline seadistus — see on ORG-A0 + org-otsuse taga [DECISION O-CW-6]; kuni selleta refleksiooniandmed EI osale üheski koondis, ka k-anonüümses.
3. Refleksioonikirjete OLEMASOLU fakt (mitu, millal) ei ole nähtav kellelegi peale omaniku — ka adminile mitte (K1 4.10 p7).

## 4. Genogramm ja ökokaart: võrgustikumudeli vaated

### 4.1. Kolm kaarti, üks andmekandja

Siduv piir: genogramm ja ökokaart on COLLAB-A0 ptk 6.1 võrgustikumudeli VAATED, mitte eraldi andmekiht. Ideed 9.3 kolmene eristus jääb kehtima esitustasandil:

| Kaart | Küsimus, millele vastab | Fookus |
|---|---|---|
| Genogramm | milline on PERE struktuur ja põlvkondademustrid | perestruktuur, põlvkonnad, lähedased/konfliktsed suhted, lahkuminekud, surmad, korduvad mustrid (ideed 7 meetod 7) |
| Ökokaart | milline on inimese ELUKESKKOND | seosed pere, sõprade, kogukonna, kooli, töö, spetsialistide, teenustega; seose kvaliteet (toetav/nõrk/pingeline/konfliktne/katkenud/puuduv — ideed 7 meetod 8) |
| Professionaalne võrgustikukaart | kes juhtumiga TÖÖTAB | roll, jagamispiir, vastutus, viimane kontakt (ideed 9.3) — see on COLLAB ptk 6 põhivaade |

Kaarte EI SEGATA esitustasandil (ideed 9.3 hoiatus), aga isiku- ja suhtekirjed on ÜHISED — sama inimene (nt vanaema, kes on ka tugiisik) on üks kirje, mis ilmub mitmes vaates. See on vaadete-arhitektuuri põhjendus nr 1: parandus/kustutus mõjub KÕIGIS vaadetes korraga (kolmanda isiku õiguste teostamine ühest kohast, ptk 5).

### 4.2. Mida vaade lisab andmekandjale

COLLAB 6.1 mudel (isik, roll, organisatsioon, teenus, suhe, eesmärk, aktiivsus, kontaktipiir, nähtavus, kehtivus) katab professionaalse kaardi. Genogramm/ökokaart vajavad LISAKS (kõik read on tulevase skeemi kandidaadid, mitte otsused):

| Lisand | Sisu | Kuhu kuulub |
|---|---|---|
| Suhte domeen | `FAMILY \| ENVIRONMENT \| PROFESSIONAL` — peresuhe, keskkonnaseos ja koostöösuhe on sama olemi kolm domeeni, mida vaated filtreerivad | suhtekirje |
| Struktuursed peresuhte atribuudid | suhtetüüp (vanem/laps/partner/õde-vend/eestkoste…), staatus (koos/lahus/lahutatud), eluloofaktid (surm) — genogrammi notatsiooni tarbeks | suhtekirje (FAMILY-domeen); TAKSONOOMIA LAHTINE kuni O-CW-8 |
| Kvalitatiivsed seoseatribuudid | kvaliteet (toetav/pingeline/katkenud…), tugevus, suund | suhtekirje (ENVIRONMENT + FAMILY) |
| Põlvkonnamärge | isiku suhteline põlvkond kaardil (mitte sünniaasta!) | vaatespetsiifiline paigutusatribuut |
| Leibkonnapiir | kes elavad koos (leibkond ≠ pere) | isikukirjete rühmitus, mitte uus olem |
| Paigutus | koordinaadid/lähedus lõuendil (K2 tähenduslik paigutus) | vaatespetsiifiline, MITTE andmekandja osa — paigutus ei ole andmeväide |

COLLAB 6.2 kolm nõuet on täidetud: (a) isiku-/suhtekirjed on vaadetest lahus; (b) suhtetüüpide taksonoomiat EI fikseerita siin (O-CW-8 metoodikaotsus — genogrammi standardnotatsioon on erialane valik, mitte arendaja oma); (c) jagamismehhanism on vaate-, mitte kirjepõhine ja rangemaks keeratav (4.5).

### 4.3. Osapoolte esitusleping

Ülesande nõutud eristus — kuidas esitatakse inimene, leibkond, lähedased, spetsialistid ja organisatsioonid:

| Osapool | Kirje tüüp | Genogrammis | Ökokaardil | Võrgustikukaardil | Kolmanda isiku staatus |
|---|---|---|---|---|---|
| Inimene (keskmes) | isikukirje, seotud kliendikontoga VÕI kliendisuhte-kutsega | keskne isik | keskne isik | „kelle asjus" | EI — tema on andmesubjekt, kelle nõusolek on kaasamise eeldus |
| Leibkond | isikukirjete rühmitus (leibkonnapiir) | leibkonnaring | taustaring | — | liikmed on üldjuhul kolmandad isikud |
| Lähedased (pere, tugiisikud) | isikukirje, ENAMASTI mittekasutaja | peresuhted (FAMILY) | seosed (ENVIRONMENT) | ainult kui on kaasatud osaleja (U9 rada [VISION]) | JAH — klass 5, ptk 5 leping; kirje loomine blokeeritud kuni O-CW-7 |
| Spetsialistid | isikukirje, EELISTATULT platvormi kasutaja (siis konto-viide, mitte andmekoopia) | — (v.a peresisene topeltroll) | teenuseseos | roll + jagamispiir + vastutus (COLLAB 6.1) | kasutaja → EI (tema andmed on konto); mittekasutaja-spetsialist → JAH, aga tööalased andmed (nimi, roll, asutus) on madalama riskiga kui pereandmed |
| Organisatsioonid | tekstiväli/registriviide isiku- või teenusekirje küljes (COLLAB 6.1: org-MUDELIT ei looda enne org-otsust) | — | keskkonnaseos (kool, töökoht) | osaleja tööandja kontekstina | organisatsioon ise ei ole isikuandmete subjekt; org+isik koos on |
| Teenused | ServiceMapEntry viide [MAIN] | — | teenuseseos | teenuseseos | EI |

Kandev reegel: **roll on kirjeldav silt, õigused tulevad AINULT ruumiliikmesusest** (COLLAB 6.1) — kaardile kandmine ei anna kellelegi ligipääsu millelegi; ligipääs tekib alles kutse+liitumisega (COLLAB ptk 2 osalejaleping).

### 4.4. Kaks omanikujuhtu (eri reeglid, sama andmemudel)

**A. Klient ise oma Teekonnas** (RUUM-VIS 6.10 väikseim prototüüp): inimene kaardistab OMA pere ja keskkonna. Andmesubjekt = koostaja → väikseim õiguslik risk, AGA mitte null: kaardil on IKKAGI kolmandate isikute (pereliikmete) andmed, mille töötlejaks platvorm saab. Kliendi-oma kaardi õiguslik hinnang (isikliku kasutuse erandi kohaldatavus, kui platvorm on taristu) on O-CW-7 osa — EI otsustata vaikimisi tehniliselt. Jagamine: AINULT shareKeys-laadse külmutatud väljavõttena eelpöördumisse (olemasolev muster) — elav kaart ei liigu kunagi.

**B. Töötaja juhtumi kontekstis** (koos kliendiga või kliendi teadmisel): kolmandate isikute andmete kontsentratsioon on platvormi SUURIM (RUUM-VIS 6.10 [BLOCKED_DECISION]); eeldab COLLAB-P5 võrgustikukirjete kihti + O-CW-7 õigusanalüüsi. Kliendi õigus näha teda puudutavat kaarti on eraldi otsus (O-CW-9).

Järjekord on seega pööratud intuitiivsele: KLIENDI oma ökokaart (juht A) on esimene teostatav samm, töötaja genogramm (juht B) viimane.

### 4.5. Vaadete leping (esitus ja jagamine)

1. **Lõuend:** vaba paigutusega lõuend (ruumidoc 4.4 muster); vaadete vahetus (genogramm ⇄ ökokaart ⇄ võrgustik) SAMA andmestiku peal; lähedus/ühendus kannab tähendust (K2), aga paigutus ei ole andmeväide (4.2).
2. **Loendiesitus on kohustuslik paralleelvorm** (K1 esitusnõue; ligipääsetavus): iga kaart on esitatav ka struktureeritud loendina (isikud, suhted, seosed) — ekraanilugeja ja mobiilne välitöö saavad sama info ilma lõuendita.
3. **AI piir:** joonistamise abi tekstikirjeldusest (nt kohtumismärkmest kaardi mustand — alati DRAFT + kasutaja kinnitab iga kirje); AI EI järelda suhete kvaliteeti, EI diagnoosi peremustreid, EI täienda kaarti vaikimisi (RUUM-VIS 6.10).
4. **Mustri märkamine:** AI võib KÜSIDA („kas korduv muster X on oluline?"), MITTE VÄITA — märkamise kinnitab inimene; kinnitamata tähelepanek ei salvestu.
5. **Jagamine:** tervikvaate teadlik otsus, külmutatud HETKVÕTTENA (pilt/väljavõte + kuupäev), mitte elav kaart; Kovisiooni illustratsioonina AINULT deidentifitseeritult (nimed → rollid); jagamise kirje läheb „Minu jagamistesse" (U12) nagu iga jagamine. Vaikimisi EI jagata midagi.

## 5. Kolmandate isikute andmete leping

Juhtumitöö on platvormi suurim kolmandate isikute andmete pind (võrgustik + genogramm + kohtumismärkmed). COLLAB ptk 3 klass 5 leping kehtib; siin kuus ülesandes nõutud dimensiooni juhtumitöö-spetsiifiliselt. ÜKSKI selle peatüki rida ei ole õiguslik otsus — need on arhitektuurinõuded, mis peavad kehtima SÕLTUMATA sellest, millise õigusliku aluse O-CW-7/O-CO-6 analüüs valib.

| Dimensioon | Leping |
|---|---|
| **Minimaalsus** | mittekasutaja kirje miinimumväljad: kuvanimi (võib olla roll/initsiaal — „ema", „perearst R"), suhte domeen+tüüp, kaasamise/kaardistamise eesmärk. EI vaikimisi: kontaktandmed, sünniaeg, isikukood, terviseinfo, aadress. Iga lisaväli nõuab dokumenteeritud vajadust (klass 5 leping). Genogrammi eluloofaktid (surm, lahutus) on lubatud struktuurifaktid — need EI ole eriliigi andmed, aga on pieteeditundlikud |
| **Nõusolek / õiguslik alus** | LAHTINE (O-CW-7 = O-CO-6 laiendus perestruktuurile): õigustatud huvi vs nõusolek vs kirjeid-ei-looda. Kuni analüüsita: mittekasutajate PÜSIKIRJEID EI LOODA (kehtiv [MAIN] seis — koodis pole); vabatekstis mainimine (kohtumismärge „ema toetab") on lubatud reaalsus, mida piirab päritolumärgistus + mitte-artefaktidesse-kopeerimise reegel (COLLAB klass 5) |
| **Nähtavus** | kirje on nähtav ainult kaardi omanikuringile (juht A: klient; juht B: koordinaator + kliendi-osas klient O-CW-9 järgi); mittekasutaja ISE ei näe platvormil midagi → GDPR art 14 teavitamiskohustuse küsimus (kas, millal ja kuidas kolmandat isikut teavitatakse) on O-CW-7 KOHUSTUSLIK osa, mitte tehniline lisa |
| **Parandamine** | kirje parandus on versioonitud (supersededBy-ahela muster [MAIN]); kliendi eriarvamus teda puudutava kirje kohta järgib „sain aru / mul on parandus" mustrit (COLLAB ptk 5); kolmanda isiku parandustaotlus (kui ta saab teada) käib andmesubjekti õiguste protseduuri kaudu — vajab admin-protseduurirada auditijäljega (K1 4.10 p7 klass) |
| **Eemaldamine** | kustutus mõjub läbi KÕIGI vaadete korraga (4.1 — vaadete-arhitektuuri põhieelis); kirje eemaldus ei kustuta ajaloolisi külmutatud jagamisi (kandjareegel), aga märgib need „kirje eemaldatud" markeriga; kustutusõiguse teostamise rada peab olema disainitud ENNE esimest püsikirjet, mitte pärast |
| **Retention** | kaasamise/kaardistamise lõpp on kohustuslik väli (K4 „igavesti vaikimisi" keeld); juhtumi sulgemine käivitab kaardi ülevaatuse (mitte automaatkustutuse — inimene otsustab); tähtaja möödumisel U1 sündmus omanikule (workspace.next_action_due klass), mitte vaikiv kustutus |

**Alaealised:** genogramm sisaldab lapsi PARATAMATULT (perestruktuur ilma lasteta ei ole perestruktuur) — see on O-CW-7 õigusanalüüsi TUUM, mitte ääremärkus. COLLAB ptk 8 reegel kehtib (alaealine ei ole osaleja; alaealise info on klass 5 rangeima piiriga); ideed 17 k12 (lapse/eestkostja ligipääsumudel) jääb teadlikult MVP-st välja (ideed 15). Vahepealne arhitektuurireegel: lapse kirje genogrammil kannab AINULT struktuurifakte (laps, vanus-vahemik kui vajalik, mitte sünnikuupäev) ja EI OLE kunagi jagatava väljavõtte vaikimisi osa.

## 6. Juhtumitöö lepingud

### 6.1. Osalejaleping

JTA ja Meetodipeegel on PRIVATE — osalejaid EI OLE, seega osalejaleping (COLLAB ptk 2) neid ei puuduta. Osalejaleping rakendub juhtumitöö ümber kolmes kohas, KÕIK COLLAB-i lepingu muutmata tarbimisena: (1) kohtumise ühisvaade (klient MEMBER kliendisuhte lipuga; O-CO-5 positsioon); (2) võrgustikuruum (piiratud nähtavusega kutsed, scopeNote); (3) juhtumikonverents (COLLAB perekond A rangeim profiil; O-CO-10). CASEWORK EI LISA osalejalepingusse ühtegi rida — see on teadlik tulemus, mitte lünk: juhtumitöö privaatsed kihid ja ühistegevuse osalejakihid on eri asjad, mida seob ainult jagamisleping (6.2).

### 6.2. Jagamisleping — juhtumitöö objektide kaardistus COLLAB klassidesse

| Juhtumitöö objekt | COLLAB klass (ptk 3 maatriks) | Eripära |
|---|---|---|
| Eelpöördumine (kliendi kinnitatud) | 4 — inimese enda sisend | JUBA [MAIN] täies elutsüklis (recall/parandus/valdusriba) |
| Vastuvõtja tööplaan (checklist+note+nextContactOn) | 2 — spetsialisti töömärge | EI jagata kunagi; UI ütleb seda selgelt (olemas [MAIN]: „nähtavad vastuvõtja töövaates, mitte pöörduja mustandis") |
| Kohtumise ettevalmistus / märkmed | 2, üksikud read päritolumärgisega | kolmanda isiku read = klass 5: ei kopeeru artefaktidesse ilma teadliku otsuseta |
| STAR2-mustand (kuni ÜLE_KANTUD) | 2 → „Kopeeri STAR2 jaoks" = klass 10 eksport | kopeerimine on EKSPORT: auditikirje + „kontroll lõpeb" ausus + U1 sündmus; EXPORT-P0 auditimuster [BRANCH 65c82d04] on eeskuju |
| Refleksioonikirje | 2 — ABSOLUUTNE (ei jagata mitte kunagi) | jagatav on ainult deidentifitseeritud tuletis (3.5) |
| Deidentifitseeritud Kovisiooni/Supervisiooni mustand | 9-laadne külmutatud tuletis kinnitusega | TopicSeed / WellbeingOutputDraft mustrid [MAIN] |
| Kinnitatud kohtumise kokkuvõte | 9 — kinnitatud kokkuvõte | COLLAB ptk 5 leping; U10 [MAIN] on v1 |
| Genogrammi/ökokaardi kirje | 5 (mittekasutaja) või 4 (kliendi enda kinnitatud osa) | ptk 5 leping |
| Kaardi tervikvaade | UUS jagamisobjekt: külmutatud hetkvõte | rangeim vaikimisi (ei jagata); deidentifitseeritud versioon Kovisiooni; U12 rida alati |

### 6.3. Sündmuseleping — U1 kataloogi kaardistus

JTA/Meetodipeegel EI vaja ühtegi uut sündmuseperekonda; vaja on ÜKS uus tüüp olemasolevas perekonnas:

| Vajadus | K1-U1 ptk 7 tüüp | Märkus |
|---|---|---|
| Eelpöördumise elutsükkel | pre_inquiry.* (7.7) | JUBA kataloogis; U1-P0 vertikaal ise |
| Järgmine kontakt / tähtaeg | workspace.next_action_set/due (7.2) | nextContactOn muster ON selle perekonna doonor |
| Mustand kinnitatud / ülekandevalmis | artifact.created/confirmed (7.5) | olemas |
| **STAR2-sse üle kantud** | **UUS TÜÜP `artifact.external_transfer_marked`** (perekond 7.5) | meta: ainult artifactKind + kuupäev (viitenumber EI lähe meta'sse — see on mooduli väli); retention audit_long; TÄIENDAB DocumentAudit-kirjet, ei asenda |
| Refleksioon loodud | — TEADLIKULT MITTE | refleksiooni olemasolu ei ole sündmus kellelegi (3.6 p3); isegi omaniku timeline'is ainult kui omanik selle sisse lülitab [TULEVIK] |
| Kaardi kirje muutus | workspace.* võrgustikuruumi kaudu (COLLAB-P5 järel) | mitte enne võrgustikukihti |

Payload-privaatsus (K1-U1 6.4) kehtib absoluutselt: ühegi juhtumitöö sündmuse meta'sse ei lähe kliendi nime, teemat ega vabateksti.

### 6.4. Tegevuse- ja otsuseleping

- **Tegevus** (JTA sees): küsimus, puuduva info rida, kontrollstaatuse muutus, ettevalmistuse samm — need on PRIVAATSED tööobjektid, mitte U1 sündmused ega COLLAB-i „ülesanne vastutajaga" objektid. Piir: niipea kui tegevusel on TEINE vastutaja või tähtaeg, mida keegi teine näeb, on ta COLLAB-i ülesanne (objektiklass 8) ja elab kohtumise/võrgustiku ruumis — JTA EI ehita oma ülesandesüsteemi (dubleerimiskeeld 8.3).
- **Otsus:** juhtumitöös on kolme liiki otsuseid, mis EI TOHI seguneda: (1) ametlik otsus (STAR2, klass 3 — platvormil ei eksisteeri); (2) mitmepoolne kokkulepe (kohtumise ühisvaade, COLLAB objektiklass 7 kinnitusahelaga); (3) töötaja professionaalne valik (Meetodipeegli kirje väli, privaatne). JTA-s endas otsuse-objekti EI OLE — see on teadlik disain: „otsus" JTA-s oleks varju-registri seeme.

### 6.5. Ajajooneleping

- Juhtumi ajajoon on U1-P2 timeline (DomainEvent workspaceRef-i järgi), MITTE eraldi CaseTimeline tabel — sekkumispäevik (ideed 8.5) on refleksioonikirjete + artefaktide + sündmuste KOOSVAADE, mitte uus andmekiht.
- Ajajoon on kirje-, mitte seirekiht: sellest ei tuletata aktiivsus-skoore ega „juhtumi tervise" mõõdikuid (8.3 keelud).
- Kliendi ajajoone (elusündmused, ideed 7 meetod 6) koht on kliendi OMA Teekond, mitte JTA — töötaja näeb kliendi ajajoont ainult kliendi jagatud väljavõtete kaudu. Ajajoone-meetod hindamisvahendina (kes-millal-mis-teenusel) on STAR2/menetluse pool.

## 7. Seosed teiste analüüside ja moodulitega

| Seos | Mida CASEWORK tarbib | Mida CASEWORK annab | Piir |
|---|---|---|---|
| K1 (tööruumileping) | descriptor, elutsükkel, PRIVATE-klass, faasid, esitusnõue (loend) | 2 uut RESERVED kind'i (case_work, practice_reflection) + K1 4.2.1 kaardistuse laiendus | JTA on privaatne tööruum, mitte Room-i profiil |
| U1 (sündmuskiht) | pre_inquiry.*, next_action, artifact.* | 1 uus tüüp (artifact.external_transfer_marked) | refleksioon ei emiteeri; kriisirada väljas (K1-U1 11.3) |
| COLLAB-A0 | kandjapiir (1.3), objektiklassid (ptk 3), osalejaleping (ptk 2), võrgustikumudel (ptk 6), kohtumise ühisvaade (ptk 5) | genogrammi/ökokaardi vaatenõuded võrgustikumudelile (4.2 lisandid); O-CO-10 konverentsi-kandja sisend | CASEWORK ei ava osalejalepingut uuesti |
| Teekond | sourceJourneyId [MAIN]; shareKeys väljavõttemuster | kliendi-oma ökokaart (P4) elab Teekonnas | Teekonna sisu ei liigu JTA-sse kunagi tervikuna |
| Eelpöördumine | KOGU vastuvõtulaud [MAIN] on JTA sissepääs | vastuvõtja descriptor-adapter (P0); ettevalmistuspaneel (P1) | eelpöördumise õiguslik staatus (k1) jääb lahtiseks — UI ei tohi lubada „menetlust" |
| Kohtumised (U10/COLLAB-P1/P2) | MEETING_SUMMARY + jagamine + kinnitusring | kohtumise ettevalmistus (JTA faas) + järelrefleksioon (Meetodipeegel) | kokkuvõte ei muutu protokolliks (O-CO-10/O-CW-1) |
| Kovisioon | TopicSeed, sourcePreInquiryId, purge-distsipliin | Meetodipeegel = Kovisiooni ettevalmistuse allikas (8.7) | Q1.10: AI-tugi lõpeb Kovisiooni ukse taga; perekonna B piir |
| Supervisioon [BRANCH] | SharedTopic WITHDRAWN muster; SummaryApproval kuju | refleksioonide kogum supervisiooni teemaks | SUP-P0 merge on eeldus SUP-adapterile |
| Tööheaolu | HardCaseWorkflow olemasolu (piir 3.2) | „vajan tuge" navigatsiooniline suund | heaoluandmed ja metoodikaandmed EI liitu |
| Teenusekaart | ServiceMapEntry viited (ökokaart, võrgustik) | — | viide, mitte koopia |
| FIELD-A0 (tulevik) | — | JTA kohtumismärkmete mobiilne kest; dikteerimine | välitöö on kest, mitte eraldi andmekiht |
| ESTA-MENTOR-A0 (tulevik) | — | Meetodipeegli kirje võib viidata mentorlussuhtele | mentorlus ise on ESTA-MENTOR-A0 teema |

## 8. Riskid, doonorid ja dubleerimiskeelud

### 8.1. Riskid

| # | Risk | Sisu ja leevendus |
|---|---|---|
| R1 | Varju-register | suurim strukturaalne risk; leevendus = 2.4 invariandid + O-CW-2 retention-otsus ENNE ülekande-olekute ehitust |
| R2 | Artefaktide retention-auk JUBA TÄNA | AgentArtifact (sh STAR_HELPER/CASE_SUMMARY kliendi andmetega) elab konto eluea — K7 retention-klassi pole; juhtumitöö kasv teeb sellest kuhjuva riski; seos FAILID-A0/EXPORT-A0 leidudega — CASEWORK-P2 peab andma artefaktidele retention-klassi, mitte ainult uued olekud |
| R3 | ET-only sildid koodis | receiverChecklist 5 punkti + RECORDING_PURPOSE_LABELS on eestikeelsed koodis/DB-s (P2-6 klassi rikkumine [MAIN]) — RU-kasutaja saab täna eestikeelse tööplaani; uus kiht sünnib i18n-võtmetega, olemasolevate parandus on A11Y-I18N raja kattuvus (koordinaator liidab) |
| R4 | Kliendi andmed refleksioonis | Meetodipeegli kirje seob juhtumi + tõlgenduse; deidentifitseerimise tugi (safetyGate muster) on P3 kohustuslik osa, mitte lisa |
| R5 | AI hüpotees → fakt | päritolumärgistuse jõustamata jätmine muudaks AI mustandi vaikselt „teadmiseks"; leevendus = märgis kirje tasandil + „parane­mine" ainult inimese toiminguga (2.3) |
| R6 | Töötaja jälgimine | arenguvaade/org-õppimine (k15); leevendus = 3.6 arhitektuurilised keelud |
| R7 | Kolmandate isikute kontsentratsioon | genogramm on platvormi suurim kolmandate isikute (sh laste) andmete pind; leevendus = ptk 5 + järjekorra pööramine (kliendi-oma kaart enne töötaja oma) + O-CW-7 värav |
| R8 | Õiguslik staatus lahtine (k1/k2) | eelpöördumine on juba toodangus, aga tema menetluslik staatus + vastutav töötleja on lukustamata; iga JTA-samm, mis lisab „ametlikkuse" muljet, süvendab riski — UI-keel („mustand", „ettevalmistus") on leevendus, partner-KOV-i lukustus (O-CW-1) on lahendus |
| R9 | Ülesande-objekti dubleerimine | „ülesanne vastutajaga" puudub platvormil (K1-U1 leid); kui JTA ehitaks oma, tekiks COLLAB-iga paralleelsüsteem — 6.4 piir hoiab |
| R10 | Kaardi-andmete taksonoomia lukustumine | kui P4/P5 fikseeriks suhtetüübid enne metoodikaotsust (O-CW-8), tuleks genogrammi notatsiooni hiljem migreerida; leevendus = domeen+vabatekst-tüüp V1-s, taksonoomia alles otsuse järel |

### 8.2. Doonorid (tõendatud mustrid, millest CASEWORK ehitub)

| Doonor [MAIN] | Mida annab |
|---|---|
| Vastuvõtulaud + workflow-PATCH | JTA sissepääs ja töövoo-kirje muster (note+checklist+nextContactOn ühes PATCH-is) |
| PreInquiry elutsükkel | recall enne avamist, parandus supersededBy-ahelana, openedAt CAS, külmutatud jagamine — kandjapiiri töötav etalon |
| assessmentState + buildPreInquiryAssessmentReview | struktureeritud eelinfo + puuduva info tuletus — „puuduv ja kontrollimist vajav info" seeme |
| AgentArtifact + generation.js | audience/tone/length/language valikud + STAR-i keelt rääkivad structureGuide'id — STAR2-mustandi generaator on 80% olemas |
| U10 meetingSummaryShare | FINAL-artefakti leping-jagamine — kohtumise kokkuvõtte rada |
| TopicSeed | külmutus (sharedCardSnapshot) + safetyGate + ownerConfirmedAt — deidentifitseeritud üleandmise etalon |
| WellbeingOutputDraft | userReviewed → userConfirmed → handedOffAt + covisionCaseId — kinnitatud üleandmise teine sõltumatu tõend |
| CovisionCase.sourcePreInquiryId + anonymizedDescription | allikaviite + deidentifitseerimise mudelipretsedent |
| shareKeys (Teekond→eelpöördumine) | kliendi valitud väljade külmutatud väljavõte — kliendi-oma ökokaardi jagamismuster |
| Invite.relationshipType=CLIENT | kliendisuhte eristus kutsel — kohtumise ühisvaate sild |
| PracticeCapability.validUntil | tähtajaline võimekus — kaasamise ajaline kehtivus (K4/ptk 5 retention) |
| RECORDING_PURPOSE eesmärgistus | „luba = eesmärk" muster kõnesalvestusel — juhtumitöö kõnede eesmärgisidumine on juba normaliseeritud |

### 8.3. Dubleerimiskeelud (mida uus süsteem EI tee)

1. EI CaseGoal/CaseAction/CasePlan koopiat ega ühtegi STAR2-välja päritava andmeväljana (2.4 p2).
2. EI uut artefaktisüsteemi — AgentArtifact laieneb (olekud, retention-klass), ei kordu.
3. EI oma ülesandesüsteemi JTA-s — mitmepoolne ülesanne on COLLAB objektiklass 8 (6.4).
4. EI eraldi genogrammi/ökokaardi andmebaasi — võrgustikumudeli vaated (ptk 4; COLLAB 9.3 p6 kinnitus).
5. EI eraldi Meetodipeegli „moodulit" navigatsioonis — kiht tegevuste juures (3.1).
6. EI neljandat osalejasüsteemi ega uut teavituskanalit (COLLAB/K1-U1 keelud kehtivad).
7. EI teist checklist-süsteemi — receiverChecklist üldistub ettevalmistuskonteineriks (P1), mitte ei jää paralleelseks.
8. EI STAR2 menetluse peeglit pöördujale (mitte-ehitada nr 2) — kliendi vaade menetlusele on STAR2/KOV-i kanal.

## 9. Otsuste register (O-CW-1…O-CW-10)

Ideed 17 k1–k11 kaardistus: **k5 (kliendi parandusrada), k7 (valesti saadetu parandus) ja k10 (jagamise tagasivõtt) on koodis LAHENDATUD [MAIN]** (U3 parandus + recall + U12 valdusriba) — nende õiguslik KINNITUS käib k1 paketis kaasas, aga tehnilist otsust ei oota. k6 katab COLLAB O-CO-2/O-CO-5. k9 katab COLLAB O-CO-6 + K4. Ülejäänud (k1–k4, k8, k11–k17) jaotuvad alljärgnevatesse otsustesse.

| ID | Otsus (allikas) | Variandid | Soovitus | Blokeerib | Viimane hetk |
|---|---|---|---|---|---|
| O-CW-1 | Eelpöördumise/JTA õiguslik staatus + vastutav töötleja + STAR2-registreerimise kohustuse piir (k1+k2; ideed 11.8) | partner-KOV-iga lukustatud protokoll / ainult „ettevalmistav mustand" positsioon / ametlik esitamiskanal partner-leppega | lukustada partner-KOV-iga ENNE pilooti; kuni selleta UI hoiab ranget „mustand/ettevalmistus" keelt | partner-PILOOTI ja igasugust „ametliku kontakti" positsioneerimist; EI blokeeri P0/P1 | enne esimest partner-KOV pilooti |
| O-CW-2 | Ülekantud mustandi ja ülekandemetadata retention (k3+k8+k11) | kirjutuskaitstuks konto eluks / arhiiv N kuud / kustub N päeva pärast ülekannet | arhitektuur toetab kõiki kolme; vaikimisi soovitus: kirjutuskaitse + 12 kuud arhiivis + kustutus (kinnitada õigusanalüüsiga) | CASEWORK-P2 (ülekande-olekud) | enne P2 migratsiooni |
| O-CW-3 | Refleksiooni ja ametliku dokumentatsiooni piiri kinnitus (k4; ideed 13.4 printsiip) | (a) ideed 13.4 staatuste loend sellisena; (b) muudatustega | (a) — printsiip on dokumenteeritud, vajab tooteomaniku kinnitust | CASEWORK-P3 (refleksioonikirje mudel) | enne P3 |
| O-CW-4 | JTA konteineri sünd (CaseWorkAssist mudel ideed 12) vs adapteripõhine JTA olemasolevate mudelite peal | (a) konteiner kohe; (b) adapterid kuni tõendatud vajaduseni (mitu pöördumist sama inimese asjas = üks töö) | (b) — K1 variant A loogika kordus; konteiner alles siis, kui 1:1 eelpöördumine≠töö muutub päris valuks | konteineri-migratsiooni (P2 saab teha ka artefakti-olekutega ilma konteinerita) | enne P2 skeemikuju |
| O-CW-5 | Meetodikataloogi sisu, kinnitaja ja ajakohasus (k13+k14) | erialaliit/ülikool kinnitab / toimetuskolleegium / ei tooda kataloogi (ainult vabatekst+RAG) | vajab partnerit (ESCÜ/ESTA/ülikool) — metoodikaotsus, mitte arendusotsus | meetodi-valiku-assistendi AI-osa (P6); EI blokeeri refleksioonikirjet | enne P6 |
| O-CW-6 | Meetodipeegli andmete org-õppimise kasutus (k15) | ei kunagi / k-anonüümne koond org-otsuse järel / opt-in uuringud | EI OTSUSTATA enne ORG-A0 + org-otsust; arhitektuuriline vaikekeeld kehtib (3.6) | org-vaateid (pole üheski CASEWORK paketis) | ORG-A0 järel |
| O-CW-7 | Genogrammi/ökokaardi kolmandate isikute õiguslik alus (= O-CO-6 laiendus: perestruktuur, LAPSED, GDPR art 14 teavitamine, kliendi-oma kaardi isikliku kasutuse erand) | õigustatud huvi / nõusolek / kirjeid ei looda; + art 14 erandite analüüs | ERALDI ÕIGUSANALÜÜS (õigusabi) — ei otsustata vaikimisi tehniliselt (siduv piir) | CASEWORK-P4 (kliendi-oma kaardi osa) ja P5 (töötaja kaart) TERVIKUNA | enne P4 |
| O-CW-8 | Suhte- ja notatsioonitaksonoomia (genogrammi standard, ökokaardi seosetüübid) | rahvusvaheline standardnotatsioon / lihtsustatud oma / vabatekst V1 | V1 = domeen + vabatekst-tüüp; taksonoomia kinnitab erialapartner (seos O-CW-5 kinnitusprotsessiga) | genogrammi KORREKTSET vaadet (P5); ei blokeeri andmemudelit | enne P5 UI-d |
| O-CW-9 | Kliendi ligipääs teda puudutavale kaardile/võrgustikule (RUUM-VIS 6.10 + COLLAB 6.1 [DECISION]) | näeb kogu kaarti / näeb kinnitatud kihti / ei näe (ainult jagatud väljavõtted) | „näeb teda puudutavat kinnitatud kihti" — kooskõlas O-CO-5 vaimuga | kaartide jagamis-UI (P5) | enne P5 |
| O-CW-10 | „Kopeeri STAR2 jaoks" ekspordi kuju ja auditisügavus (kas kopeeritud SISU snapshot säilib auditis) | ainult fakt+aeg / fakt+väljade loend / täissnapshot | fakt + väljade loend (täissnapshot = varju-register auditi kaudu!) | CASEWORK-P2 ekspordiosa | enne P2 |

Ükski O-CW EI blokeeri CASEWORK-P0 ega P1 — see on paketivaliku kriteerium (COLLAB-P0 pretsedent).

## 10. Rakenduspaketid

### CASEWORK-P0 — juhtumitöö sõnastiku- ja adapterikiht (ESIMENE, rakendusvalmis)

- **Eesmärk:** ptk 2 kandja-/päritolusõnastik ja ptk 1.3 proto-JTA muutuvad koodis kontrollitavaks K1-P0/COLLAB-P0 mustri järgi: kanooniline sõnastik + read-only descriptorid + adapterid olemasolevate mudelite kohal + leping-testid. **Skeemimuudatust, migratsiooni ega UI-d EI OLE. Ühtegi lahtist otsust EI OLE** (sõnastikud on ekstraktitud ideed 4.4/4.5 tekstist ja töötavast koodist; read-only kiht ei fikseeri ühtegi õiguslikku küsimust).
- **Sõltuvus:** K1-P0 sõltumatu PASS + merge (failipaigutus `lib/workspaces/**`, descriptor-validaator, registry). COLLAB-P0-ga paralleelne — failid ei kattu. U1-P0 EI ole eeldus.
- **Failid (kõik uued, v.a registry 2-realine RESERVED-lisa):**
  - `lib/workspaces/provenance.js` — päritolumärgistuse 8-väärtuseline sõnastik (2.3) + kandjaklassi typedef (1/2/3) + STAR2-ülekande olekusõnastik (2.2) + validaatorid; 0 päringut;
  - `lib/workspaces/registry.js` — +2 rida: `case_work`, `practice_reflection` RESERVED (additiivne konstant);
  - `lib/workspaces/adapters/preInquiryReceiverAdapter.js` — `listReceivedCaseWork(userId)` → WorkspaceDescriptor[] (kind `pre_inquiry`, vastuvõtja-skoobitud; lifecycle K1 4.2.1 kaardistusest; nextAction = nextContactOn; võõras → tühi);
  - `lib/workspaces/adapters/caseArtifactAdapter.js` — `listCaseArtifacts(userId)` → jagamis-descriptor[] (AgentArtifact omaniku-skoobitud; DRAFT→klass 1, FINAL→klass 2; tüübisõnastik);
  - `tests/workspaces/caseworkContract.test.js` — fake-db (repo konventsioon): mõlemad adapterid, võõra kasutaja 0 rida, sõnastike täielikkus (iga AgentArtifactType + PreInquiryStatus kaardistub), validaatorite reject tundmatule väärtusele.
- **DoD:** adapterid tagastavad kehtiva descriptor'i; `npm test` + `npm run i18n:check` rohelised; ühtegi olemasolevat faili peale registry konstantide ei muudeta.
- **Keelatud skoobilaiendused:** EI kirjutavat rada; EI UI-d; EI PracticeReflection mudelit; EI ülekande-olekute salvestust (ainult sõnastik); EI võrgustiku-/kaardikirjeid; EI U1 emit-punkte.
- **Audititase:** Soli tehniline kontroll (read-only, madal risk). **Rollback:** failide eemaldus.

### CASEWORK-P1 — vastuvõtulaua ettevalmistuspaneel (0 migratsiooni, UI)

Sisu: olemasolev eelpöördumine + artefaktigeneraator (OLEMASOLEVATE tüüpidega CASE_BRIEF / PRE_ASSESSMENT_SUMMARY / CHECKLIST) + receiverChecklist + nextContactOn ühendatakse üheks „kohtumise ettevalmistuse" vaateks vastuvõtulaual; päritolumärgistuse kuvamine P0 sõnastikuga; receiverChecklist-siltide i18n-võtmestamine (A11Y-I18N kattuvus — koordinaator liidab, ei dubleeri). UI-keel hoiab ranget „mustand/ettevalmistus" registrit (R8). Otsuseid ei vaja; 0 uut mudelit. Audititase: Sol + Fable ristkontroll (UI).

### CASEWORK-P2 — STAR2-ülekande olekurada + „Kopeeri STAR2 jaoks" (otsuste taga)

Sisu: 2.2 olekusõnastik salvestuvaks (artefakti-olekuväljad VÕI kerge kõrvalmudel — O-CW-4 järgi ilma konteinerita), STAR2-viitenumbri väli, kirjutuskaitse ÜLE_KANTUD järel, kopeerimis-eksport auditikirjega (O-CW-10 kuju), artefaktide retention-klass (R2 sulgemine), U1 `artifact.external_transfer_marked` tüüp. Sõltuvused: O-CW-2, O-CW-4, O-CW-10; U1-P0 (sündmuse jaoks; ilma selleta ainult audit); migratsioon → **Opuse sõltumatu audit** (kliendi andmete kandja elutsükkel muutub).

### CASEWORK-P3 — Meetodipeegel V1 (otsuse taga)

Sisu: PracticeReflection mudel (3.3 leping; visibility PRIVATE invariant; migratsioon), „ava refleksioon" tegevuse juurest (kohtumine/artefakt/eelpöördumine/kõne), fakti/tõlgenduse/päritolu väljad P0 sõnastikuga, vahehindamise enum, deidentifitseeritud Kovisiooni-mustandi rada TopicSeed-prefillina (safetyGate muster; 0 uut silda — TopicSeed on olemas). AI-osa: ainult struktureerimine + refleksiooniküsimused; meetodisoovitused VÄLJAS kuni O-CW-5. Sõltuvused: O-CW-3; soovitatavalt P1 (et oleks tegevusi, mille juurest avada). Migratsioon → Opuse audit (uus isikuandmete kandja). ideed Etapp 3 vaste.

### CASEWORK-P4 — kliendi OMA ökokaart Teekonnas (õigusanalüüsi taga)

Sisu: RUUM-VIS 6.10 väikseim prototüüp — inimene kaardistab ise oma võrgustikku Teekonnas; isik+suhe kirjed (domeen+vabatekst-tüüp, O-CW-8 V1 kuju); loendiesitus + lihtne lõuend; jagamine AINULT shareKeys-laadse külmutatud väljavõttena eelpöördumisse. Sõltuvused: **O-CW-7 (kliendi-oma juhtu kattev õigushinnang) — ka „väikseim risk" ei ole null-risk**; Teekonna O-TK9 kandjaotsuse kooskõla. EI sõltu COLLAB-P5-st (Teekonna-sisene, mitte võrgustikuruumi kiht) — aga andmemudel peab olema COLLAB 6.1-ga liidetav (sama olemisõnastik), et P5 ajal ei tekiks kahte isikukirje-süsteemi.

### CASEWORK-P5 — töötaja juhtumi kaardivaated (genogramm + ökokaart + võrgustikukaart)

Sisu: võrgustikuruumi kirjete peal (COLLAB-P5) kolm vaadet ühe andmekandjaga (ptk 4); genogrammi notatsioon O-CW-8 järgi; kliendi ligipääs O-CW-9 järgi; kaardi tervikvaate jagamisobjekt (külmutatud hetkvõte). Sõltuvused: COLLAB-P5 + O-CW-7 + O-CW-8 + O-CW-9 — kõige rohkem blokeeritud pakett, teadlikult viimane.

### CASEWORK-P6 — meetodite teadmusbaas + meetodi-valiku-assistent

Sisu: kinnitatud metoodikakiht (ideed 7 kataloog O-CW-5 kinnitusprotsessi järgi; RAG-i eraldi kinnitatud allikaklass), Meetodipeegli AI-assistendi meetodisoovituste avamine (8.4 piirides), refleksiooniküsimuste kataloog. Sõltuvused: O-CW-5 (partner!); P3. ideed Etapp 6 metoodikapool.

**Järjestusloogika:** P0 → P1 kohe (K1-P0 järel, otsustevabad); P2 esimeste otsuste järel (O-CW-2/4/10 on „tooteomanik + õigusabi nädal", mitte partner-leping); P3 paralleelselt P2-ga (O-CW-3 on kinnitus, mitte analüüs); P4 õigusanalüüsi järel; P5/P6 partnerite ja COLLAB-P5 taga. Ükski pakett EI oota O-CW-1 (partner-KOV) — see blokeerib ainult PILOODI positsioneerimist, mitte ehitust; aga P2+ väljundite AVALIK kasutuselevõtt partner-KOV-ides eeldab O-CW-1 lukustust.

## 11. Lõppväljund

### 11.1. Peamised järeldused

1. **JTA ei alusta nullist — proto-JTA on toodangus töös.** Vastuvõtulaud, receiverChecklist, nextContactOn, struktureeritud eelinfo, STAR-i keelt rääkivad artefaktitüübid (STAR_HELPER structureGuide!), eesmärgistatud kõnesalvestus ja kolm sõltumatut kinnitatud-üleandmise mustrit (TopicSeed, WellbeingOutputDraft, sourcePreInquiryId) on kõik [MAIN]. Puudu on LEPING ja SIDUMINE (sõnastikud, olekud, descriptor), mitte funktsioonimass — seepärast on esimesed paketid lepingu-, mitte funktsioonipaketid.
2. **Kandjapiir on juhtumitöö keskne leping ja STAR2-piir selle rakendus:** klass 3 (ametlik kandja) ei teki platvormil kunagi; STAR2-ülekanne on artefakti-elutsükli profiil (6 olekut) + eksport-sündmus, mitte integratsioon; varju-registri vältimine on 4 arhitektuuri-invarianti (2.4), mitte poliitikadokument.
3. **Meetodipeegel on kiht, mille tuum on päritolumärgistus** — sama 8-väärtuseline K2 sõnastik kannab JTA märkmeid, refleksiooni fakti/tõlgenduse lahusust ja kohtumise märkmeid. Refleksioonikirje on PRIVATE-invariandiga (mitte vaikeseadega); jagatav on ainult deidentifitseeritud külmutatud tuletis kasutaja kinnitusega; org-õppimine ja igasugune töötajate võrdlus on arhitektuuriliselt keelatud kuni eraldi otsusteta.
4. **Genogramm ja ökokaart on võrgustikumudeli projektsioonid, mille õige ehitusjärjekord on pööratud:** kliendi OMA ökokaart Teekonnas (andmesubjekt = koostaja) enne töötaja juhtumikaarti; suhtekirje saab domeeni (FAMILY/ENVIRONMENT/PROFESSIONAL), taksonoomia jääb metoodikaotsuse taha; laste andmed genogrammil on õigusanalüüsi tuum, mitte ääremärkus; parandus/kustutus ühest kohast läbi kõigi vaadete on vaadete-arhitektuuri põhieelis.
5. **Ideed 17 õigusküsimustest kolm (k5, k7, k10) on koodis juba lahendatud** (U3/recall/U12 [MAIN]) ja kaks (k6, k9) katab COLLAB — päriselt lahtised juhtumitöö-otsused koonduvad kümnesse O-CW-otsusesse, millest ÜKSKI ei blokeeri kahte esimest paketti.

### 11.2. Sõltuvused

| Sõltuvus | Suund |
|---|---|
| K1-P0 PASS + merge | → CASEWORK-P0 failipaigutus ja descriptor-alus (nagu COLLAB-P0) |
| COLLAB-P0 (osaleja-/jagamisleping) | → P2+ jagamis-descriptorid; failid ei kattu, võib käia paralleelselt |
| U1-P0 (DomainEvent outbox) | → P2 ülekande-sündmus; P2 auditipool töötab ka ilma |
| COLLAB-P5 (võrgustikukirjed) | → CASEWORK-P5 andmekandja |
| O-TK9 kandjaotsus | → P4 kliendi-oma kaardi kustutusjärgne saatus |
| SUP-P0 push+audit+merge | → refleksioon→supervisiooni teema rada (SharedTopic) |
| A11Y-I18N rada | → P1 checklist-siltide i18n (koordinaator liidab, ei dubleeri) |
| EXPORT-P0 auditimuster [BRANCH] | → P2 „Kopeeri STAR2 jaoks" auditikirje eeskuju |
| Partner-KOV + õigusabi | → O-CW-1 (piloot), O-CW-7 (kaardid), O-CW-5 (kataloog) |

### 11.3. Otsuste register

Kümme otsust O-CW-1…O-CW-10 (ptk 9 tabel variantide, soovituste ja tähtaegadega). Esimesena vajavad vastust O-CW-2/O-CW-4/O-CW-10 (avavad P2 ülekande-olekud — tooteomanik + õigusabi, partner pole vajalik) ja O-CW-3 (kinnitus, avab Meetodipeegli P3). Partner-otsused (O-CW-1, O-CW-5, O-CW-7 õigusanalüüs) on pikema horisondiga ega blokeeri ehituse algust.

### 11.4. Esimene rakendusvalmis pakett

**CASEWORK-P0 — juhtumitöö sõnastiku- ja adapterikiht** (ptk 10): 4 uut faili + 2-realine registrilisa + testid; 0 migratsiooni, 0 lahtist otsust, 0 UI-d; sõltuvus ainult K1-P0 PASS+merge; Soli tehniline kontroll. Paralleelselt teostatav COLLAB-P0-ga (failid ei kattu). Tulemus: päritolumärgistuse, kandjaklasside ja STAR2-ülekande sõnastikud on koodis valideeritavad ning vastuvõtulaud ja artefaktid saavad K1 descriptorid — töölaua/kompassi ja kõigi järgnevate CASEWORK-pakettide alus.

### 11.5. Soovitatud järgmine süvaanalüüs

**WELLBEING-V2-A0** (master-registri järjekorra rida 3): Tööheaolu iganädalane püsiruum. CASEWORK-A0 annab talle piirid: Meetodipeegli ja heaoluvormide lahusus (3.2), HardCaseWorkflow kui heaolu- (mitte metoodika-) refleksioon, refleksiooniandmete anti-jälgimise invariandid (3.6), mis kehtivad samal kujul heaoluandmetele.

### 11.6. Kopeeritav jätkamisülesanne

```
ÜLESANNE: WELLBEING-V2-A0 — Tööheaolu iganädalane püsiruum (süvaanalüüs)
Loe enne: docs/platvormi arendus/fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md (master-register);
Tööheaolu tervikanalüüs (memory: tooheaolu-tervikanalyys — 10 vormi ilma tervikuta, kirjete lugemisrada puudub,
E0 seis fable/tooheaolu-e0 harul); fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md (ptk 3 wellbeing_space
adapter [TECH-OPEN], ptk 7.9 weekly_checkin_due + TO-2 keeld); fable-5-ruumilise-platvormi-elav-visioon-ja-arendusteed.md
ptk 6.2; fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md ptk 3.2/3.6 (Meetodipeegli-Tööheaolu piir,
anti-jälgimise invariandid); ideed.md ptk 19–21 (Tööheaolu tootekontseptsioon + anonüümne andmekiht).
Kontrolli read-only: origin/main + server + fable/tooheaolu-e0 haru seis (E0 järelkontroll+merge ootel?);
WellbeingRecord/WellbeingOutputDraft/pilootskoop kood; k-anonüümse agregaadi tegelik teostus.
Väljund: docs/platvormi arendus/fable-5-tooheaolu-v2-iganadalane-pusiruum.md (edenemistabel alguses; lõpus
järeldused, sõltuvused, otsused, esimene pakett, järgmine analüüs, jätkamisülesanne, Jätkamispunkt, STATUS: COMPLETE).
Uuenda master-registrit alguses (IN_PROGRESS) ja lõpus (COMPLETE).
Reeglid: rakenduskoodi/skeemi/teste ei muudeta; ei commit'ita; määrdunud main-i ei puututa; TO-2 (nädalarütmi
vaikeseade) ja org-nähtavus on tooteotsused, mida EI lahendata vaikimisi tehniliselt; üksikkirje ei jõua KUNAGI
ühtegi koondisse ilma k-anonüümsuse läveta.
```

## Jätkamispunkt

- **Seis:** kõik 12 etappi TEHTUD (vt Edenemistabel); esimene täisring COMPLETE; dokument jääb elavaks — uus töökord lisab uue kuupäevaga rea, ei muuda ptk 0 lukustatud kontrolle.
- **Kontrollitud allikad (17.07.2026):** git fetch + origin/main `fe4eb4fa` = server (SSH, ise kontrollitud: HEAD, puhas tööpuu, frontend/rag/livekit teenused, 3 taimerit — notifications viimane käivitus 24 s enne kontrolli); lokaalne main `0da4185b` (1/22, määrdunud — ei kasutatud); K1-P0 `ef5973c9` registry sisu loetud (case_work/practice_reflection PUUDUVAD; meeting/network_case/field_visit/org_space RESERVED); SUP-P0 ainult lokaalne haru; 20 unmerged origin-harus juhtumitöö-koodi EI ole. Kood [MAIN]: WorkspaceFeaturePage vastuvõtulaud + workflow-PATCH; preInquiryReceiverWorkflow.js (5-punktine ET-only checklist); PreInquiry/AgentArtifact(+Type)/TopicSeed/WellbeingOutputDraft/CovisionCase.sourcePreInquiryId skeemist; generation.js structureGuide'id; calls/service.js RECORDING_PURPOSE_LABELS; HardCaseWorkflow väljad; genogram/ecomap/CaseWork/PracticeReflection = 0 vastet. Dokumendid täies mahus: master-register, COLLAB-A0 (477 r), K1-U1-A0 (707 r), ideed ptk 4–15+17, RUUM-VIS ptk 6.7–6.13.
- **Peamised tulemused:** JTA roll ja pädevuspiir 3 teljel + proto-JTA inventuur (ptk 1); STAR2-ülekande 6-olekuline rada + päritolumärgistuse 8-väärtuseline K2 sõnastik + varju-registri 4 invarianti (ptk 2); Meetodipeegli metoodiline leping (kirje, AI piir, väljundrajad, anti-jälgimine — ptk 3); genogramm/ökokaart võrgustikumudeli vaadetena (domeenimudel, osapoolte esitus, kaks omanikujuhtu pööratud järjekorras — ptk 4); kolmandate isikute 6-dimensiooniline leping (ptk 5); kuus lepingut (ptk 6); 10 riski, 12 doonorit, 8 dubleerimiskeeldu (ptk 8); k1–k11 kaardistus + 10 otsust O-CW-1…10, ükski ei blokeeri P0/P1 (ptk 9); paketid CASEWORK-P0…P6, P0 = sõnastiku-/adapterikiht (ptk 10).
- **Järgmine töökord siin dokumendis:** (1) kui K1-P0 saab PASS+merge, ava CASEWORK-P0 (ptk 10 leping on Sol-valmis; koordineeri COLLAB-P0-ga — paralleelsed); (2) kui O-CW-2/4/10 saavad vastuse, täpsusta P2 skeemikuju; (3) kui O-CW-3 kinnitatakse, ava P3 leping; (4) kui COLLAB-P5/O-CW-7 liiguvad, ava P4/P5 read; (5) O-CW-seisude muutused kanna ptk 9 tabelisse uue kuupäevaga.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; git/serveri kontrollid on lukus 17.07 seisuga — uus sessioon teeb UUE kontrolli ja lisab uue rea, mitte ei muuda vana.

STATUS: COMPLETE
