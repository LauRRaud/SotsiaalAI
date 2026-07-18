# K1 — ühine tööruumileping ja U1 — sündmuse-/teavituskiht (K1-U1-A0)

STATUS: COMPLETE (esimene täisring 17.07.2026; dokument jääb elavaks — vt Edenemistabel ja Jätkamispunkt. COMPLETE ei anna ühelegi paketile arendusluba: K1-P0/U1-P0 käivad koordinaatori arendusvalmiduse väravast läbi eraldi.)

> Rakendusvalmis platvormiülene analüüs: (1) K1 — ühine tööruumileping kõigile faasipõhistele
> ja ruumilistele funktsioonidele; (2) U1 — sündmuse- ja teavituskiht, mille kaudu funktsioonid
> ütlevad kasutajale, mis muutus ja mida ta järgmisena tegema peab.
> Autor: Fable 5 (K1-U1-A0), 2026-07-17. Ainult analüüs — rakenduskoodi, skeeme ega teste ei muudeta.

## Edenemistabel

| Etapp | Sisu | Seis |
|---|---|---|
| 0 | Tõeallikad (git/main/server/harud) | TEHTUD |
| 1 | Dokumentide lugemine | TEHTUD (loend Jätkamispunktis) |
| 2 | Koodi kontroll (schema, ruumid, Notification, continuity, rajad) | TEHTUD (+ serveri timer-runtime) |
| 3 | Ptk 2 — K1 leping (A/B/C võrdlus, valik) | TEHTUD — valik A |
| 4 | Ptk 3 — K1 valideerimine 12 funktsiooniga | TEHTUD |
| 5 | Ptk 4 — K1 normatiivne leping | TEHTUD |
| 6 | Ptk 5 — U1 olemasoleva kihi audit | TEHTUD (+ toodangu timer-runtime) |
| 7 | Ptk 6 — U1 sihtarhitektuur (A/B/C, envelope) | TEHTUD — valik B-minimaalne |
| 8 | Ptk 7 — sündmuste kanooniline kataloog | TEHTUD (11 perekonda) |
| 9 | Ptk 8 — deep-link ja tegevuse terviklus | TEHTUD (action-register + ack-semantika) |
| 10 | Ptk 9 — tehniline leping Sol/Codexile | TEHTUD (failitasemel) |
| 11 | Ptk 10 — paketistus (K1-P0, U1-P0…P3) | TEHTUD — vertikaal: eelpöördumise staatus |
| 12 | Ptk 11 — otsused ja soovitus | TEHTUD (3+8+6 otsust) |
| 13 | Ptk 12 — lõppväljund + STATUS: COMPLETE | TEHTUD |

## 1. Tõeallikad (kontrollitud 2026-07-17)

Kõik kontrollid olid read-only. Rakenduskoodi, skeeme, migratsioone ega teste ei muudetud.

| Allikas | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa` — "merge: integrate Admin P0.1 safety gates and independent audit" | `git fetch` + `git log origin/main` 2026-07-17 |
| Tootmisserver | `fe4eb4fa` — identne origin/main-iga | `ssh sotsiaalai`, `/home/ubuntu/apps/sotsiaalai`, `git log -3` 2026-07-17 |
| Lokaalne main | `0da4185b` — **22 commitit origin/main-ist maas**, 1 unikaalne commit ees | `git rev-list --left-right --count origin/main...HEAD` → `22 1` |
| `prisma/schema.prisma` | Lokaalne = origin/main (bait-identne) | `git diff --quiet main origin/main -- prisma/schema.prisma` |
| Lokaalse ja origin/main erinevus | Ainult: admin-analytics väravad, help-listings privaatsus (`lib/help/listingAccess.js` UUS origin-is), RAG P8.0 inventuur, dokumendid | `git diff --stat main origin/main` |
| SUP-P0 | `2fc826c4` "feat(db): add supervision V0 schema foundation" — **loetav, harul `codex/supervision-v0-p0-schema`, EI OLE main-is ega serveris** | `git cat-file -t` + `git branch -a --no-merged origin/main` |
| Merge'imata harud | 15+ (sh `codex/vest-p0-crisis-failsafe`, `codex/rag-qm-p0-baseline`, `fable/tooheaolu-e0`, `codex/supervision-v0-p0-schema`, `codex/maksed-*`, `opus/u6-personal-search`) | `git branch -a --no-merged origin/main` |
| Lokaalne tööpuu | Commit'imata: CSS-stiilid, registreerimislend (`components/register/`), i18n-sõnumid, dokumendid — ei puuduta K1/U1 analüüsi pindu | `git status --short` |

Järeldused analüüsi jaoks:

1. **Koodi tõeallikas on origin/main `fe4eb4fa`.** Kuna `schema.prisma` on lokaalis identne, loen skeemi lokaalselt; Help-listingu õiguste kood erineb — seal tsiteerin origin/main versiooni.
2. **SUP-P0 skeemi kasutan AINULT eraldi märgistatud tulevase sisendina** (märgis „SUP-P0 haru, ei ole main-is").
3. Ükski merge'imata haru ei lisa Notification-, event- ega workspace-mudeleid main-i — U1 audit peegeldab seega tegelikku toodangut.

## 2. K1 — ühine tööruumileping

### 2.1. Mis on „tööruum" (definitsioon)

Koordinaatori handoffi strateegiline siht (kanooniline sõnastus): platvormi funktsioonid arenevad **faasipõhisteks toetatud tööruumideks**; ühine minimaalne tööruumileping koosneb **eesmärgist, faasidest, praegusest seisust, kasutaja märgitud olulisest, tegevustest, otsustest, seotud inimestest/teenustest/dokumentidest, ajajoonest, järgmisest sammust ja lõpetamise või jätkamise tingimusest**. Valdkonnamoodulid võivad kasutada eri faase, kuid ei ehita neid alusvõimeid igaüks uuesti.

K1 selle dokumendi tähenduses: **leping, mille järgi funktsioon kvalifitseerub tööruumiks**, ilma et kõik funktsioonid peaksid kasutama sama Prisma tabelit. Tööruum on:

1. **identifitseeritav** — tal on tüüp (`kind`) ja stabiilne ID;
2. **omatud** — tal on üks omanik (kasutajakonto) ja määratletav vastutaja;
3. **elutsükliga** — ta sünnib, on aktiivne, võib pausil olla, lõpeb ja arhiveerub/kustub teadlike üleminekutega;
4. **faasidega** (kui ta on protsess) — faasid on toetavad, mitte sundivad; värav = kasutaja teadlik kinnitus;
5. **kirjeldatav** — ta oskab vastata: mis on eesmärk, mis on hetkeseis, mis on järgmine tegevus;
6. **sündmusi väljastav** — iga oluline üleminek tekitab U1 sündmuse (ptk 4.8 loetelu);
7. **piiridega** — privaatne on vaikeseis; jagamine on eesmärgipõhine, külmutatud ja tagasivõetav; elutsükli lõpp määratakse sünnil.

### 2.2. Olemasolevate „tööruumilaadsete" mudelite inventuur (kood, origin/main `fe4eb4fa`)

Kontrollitud `prisma/schema.prisma` (lokaalne = origin/main, bait-identne) ja teenusekihtide vastu:

| Mudel | Identiteet/tüüp | Omanik | Osalejad | Elutsükkel | Faasid | Eesmärk/seis/järgmine samm | Sündmused välja |
|---|---|---|---|---|---|---|---|
| `CovisionCase` + `CovisionSessionState` (:1971, :2090) | juhtum; tüüp implitsiitne | `ownerId` | `CovisionParticipant` (roll OWNER/PARTICIPANT/OBSERVER/CO_MODERATOR/SUMMARY_REVIEWER; inviteStatus INVITED/ACCEPTED/DECLINED/EXPIRED) | DRAFT→ACTIVE→SUMMARY_READY→CLOSED→ARCHIVED + **atomaarne sulgemine + purge** (`covisionCompletedCases.js` purgeSessionDetailTx) | `stage` 1–8 + `phase` kataloogist; üleminekud AINULT serveri väravatega (`gateStageOne..Eight`, 409+`missing[]`); `version` CAS + advisory lock | centralQuestion; closure'i selectedDirection/nextStep/timeframe/progressMarker; CovisionFollowUp | EI (ainult UI; teavitusi/auditit ei kirjuta) |
| `Room` + `RoomMember` + `Invite` (:2779..2857) | `originType/originId/originLabel` (HELP_MATCH, PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY, MANUAL_INVITE) | `ownerId` | RoomMember (OWNER/MODERATOR/MEMBER; `leftAt`, `lastReadAt`); Invite (SENT/…, `expiresAt`, revoke/resend) | **elutsüklita**: pole staatust, pausi, arhiveerimist — ainult hard-DELETE (kaskaadid; auditijäljeta — RUUM-A0 16 K4) ja leave | — | — (title/description) | ROOM_ACTIVITY/ROOM_INVITE tulevad reconcilerist tuletatuna; roomStream SSE reaalajas |
| `Journey` (:1214) | elusündmuse tuum | `ownerUserId` | — (AINULT omanik; sharingStatus enum'is ainult PRIVATE) | DRAFT/ACTIVE/ARCHIVED | — | title/summary/primaryPath/suggestedActions | EI |
| `PreInquiry` (:1864) | jagamisobjekt (mitte ruum) | `authorId` → `recipientOwnerId` | 2 poolt fikseeritud | DRAFT→READY→SENT→(DOWNLOADED)→ARCHIVED; `recalledAt`, `supersededById`, `openedAt` CAS-idega | — | receiverChecklist, `nextContactOn` | PRE_INQUIRY_ARRIVED/STATUS_CHANGED/NEXT_CONTACT_DUE (reconciler) + sisuta saabumis-e-kiri |
| `WellbeingRecord` (:1241) | üksikkirje, **konteinerita** | `ownerUserId` | ainult omanik | — (kirjed kuhjuvad; lugemisrada puudub) | workflowType 10 vormi | computedSignal/recommendedActions kirje sees | EI (mitte ühtegi) |
| `TopicSeed` (:1943) | ettevalmistusobjekt | `ownerId` | ainult omanik | DRAFT→WAITING (külmutus `sharedCardSnapshot`)→IN_COVISION→FOLLOW_UP→CLOSED | — | whyNow/requestedSupport | EI |
| `SupervisionProcess` [SUP-P0 haru `2fc826c4`, EI OLE main-is] | INDIVIDUAL/GROUP | `supervisorId` (NB: omanik = superviisor) | `SupervisionParticipation` INVITED/ACCEPTED/DECLINED/LEFT/WITHDRAWN | DRAFT→ACTIVE→CLOSED + `closedAt`; leping versioonidena | lepingust lõpetamiseni; `version` CAS | goal; SupervisionSummary DRAFT→PENDING_APPROVAL→APPROVED/DISCARDED | `SupervisionAuditEvent` (oma auditisündmus; teavitusi EI) |
| `EffectivePractice` (:2322) | artefakt-elutsükkel | authorId | võimekuspõhised retsensendid | DRAFT→SUBMITTED→IN_REVIEW→READY_TO_PUBLISH→PUBLISHED (+NEEDS_CHANGES/RE_REVIEW/HIDDEN/ARCHIVED); versioonisnapshotid | — | — | PRACTICE_REVIEW_ASSIGNED/OVERDUE (reconciler) + `EffectivePracticeAuditEvent` |
| `HelpRequest`/`HelpOffer` + `HelpMatch` (:2586..2778) | kuulutus + sobitus | omanik | match: 2 poolt + ruum | OPEN/…/CLOSED/EXPIRED (`expiresAt`) | — | — | HELP_MATCH_CREATED (reconciler) |

**Järeldused inventuurist.** (1) Faasimasin eksisteerib platvormil ÜKS kord (Kovisioon) ja on tootmiskvaliteediga (server-väravad, CAS, advisory lock, purge). (2) Osalejakiht eksisteerib KAKS korda (Room/Invite ja CovisionParticipant) ja kolmas (SupervisionParticipation) on harul — kolm eri liitumis-/lahkumissõnastikku. (3) Room on ainus mitme kasutaja üldpind, aga tal POLE elutsüklit (ei lõpetamist, arhiveerimist ega auditijälge kustutusel — RUUM-A0 ptk 16). (4) Ükski mudel ei väljasta sündmusi tegevushetkel — kõik kasutajale nähtav tuletatakse hiljem olekuskaneeringuga (ptk 5). (5) „Eesmärk / hetkeseis / järgmine tegevus" on lepingu nõuetest kõige ebaühtlasemalt kaetud: Kovisioonil closure-väljad, PreInquiry'l `nextContactOn`, teistel puudub.

### 2.3. Lepingu katteala (ülesande nõuded → kus leping selle fikseerib)

| Nõue | Lepingu koht | Olemasolev tõendmuster |
|---|---|---|
| Identiteet ja tüüp | 4.1 `WorkspaceRef {kind, id}` | Room.originType; CovisionCase; SupervisionProcess.type |
| Omanik, vastutaja, osalejad | 4.3 rollimaatriks; 4.6 osaleja elutsükkel | Room.ownerId + RoomMember.role; CovisionParticipant; closure `assignedFollowUpUserId` (vastutaja ≠ omanik pretsedent) |
| Päris roll vs tööruumiroll vs admini eelvaade | 4.3; keelatud otseteed 4.11 | User.role (fail-closed väravad) vs RoomRole/CovisionParticipantRole; admini vaate-eelvaade = `PUT /api/profile/view-role` (AINULT UI-vaade; server-õigusi ei muuda — rollivahetaja analüüs + TÖÖLAUD P2-1) |
| Loomine…kustutamine | 4.2 olekud | Kovisioon (täielik); PreInquiry (jagamispool); Room (auk) |
| Faasid ja lubatud üleminekud | 4.2.2 | COVISION_STAGE_PHASES + normalizePhaseTransition (sammukaupa; hüpe → 409) |
| Eesmärk/hetkeseis/järgmine tegevus/edenemine | 4.1 descriptor-väljad | closure'i väljad; nextContactOn; continuity prioriteedid |
| Sündmus, märge, ülesanne, artefakt, kokkulepe | 4.1 mõisted; 4.7 artefakt | CovisionWorkItem/StageSnapshot; AgentArtifact FINAL; RoomMessage; CovisionFollowUp |
| Privaatne/jagatud/osalejapõhine nähtavus | 4.4 maatriks | CovisionPrivateState (serializer laadib ainult vaataja omad); WellbeingRecord private; Help avalik projektsioon (Help P0 leping) |
| Nõusolek ja tagasivõtt | 4.6/4.7 + U1 sündmused | anonymityConfirmedAt; salvestusnõusolek (CallRecordingConsent; NB FAILID F-01: ACTIVE-salvestuse tagasivõtt EI peata egressi — leping peab nõudma jõustamist); SupervisionSharedTopic SHARED→WITHDRAWN [BRANCH] |
| Kutse/liitumine/eemaldamine/lahkumine | 4.6 | Invite + RoomMember.leftAt; CovisionInviteStatus; SupervisionParticipationStatus (LEFT ja WITHDRAWN eristus!) |
| Omaniku/vastutaja vahetus | 4.3 + U1 sündmus; PUUDUB koodis | RUUM-A0 16 K6: omanikuvahetust pole üheski moodulis; U11 analüüsitud |
| Jagamise tagasivõtmine | 4.7 | PreInquiry recall (ainult enne avamist; U3 = avamisjärgne parandus); kutse revoke; Supervision topic WITHDRAWN [BRANCH] |
| Arhiveerimine vs kustutamine | 4.5 maatriks | Kovisioon: CLOSED (purge'itud sisu, säilitatud valitud väljund) vs ARCHIVED; Room: AINULT hard-delete (auk); Journey ARCHIVED |
| Retention ja konto kustutamine | 4.5 + U1 retention-klassid | lib/retention.js (90p üldklass, 7a makse, sweep 6h laisk — FAILID F-06); DataDeletionJob fail-closed orkestreerimine; CovisionRetentionStatus |
| Tööruumi väljundid ja kandja | 4.7 | closure whitelist-väljad; PreInquiry külmutatud draft; U10 RoomMessage koopia (kandja = ruum; autori kustutus kaskaadib — FAILID ptk 8 tõend) |
| Auditijälg | 4.8 + U1 | DataAuditLog (üldine) + DocumentAudit + EffectivePracticeAuditEvent + SupervisionAuditEvent [BRANCH] — 4 eri süsteemi, ühtne leping puudub |
| Lokaliseeritud nimed ja faasid | 4.9 i18n-leping | notifications.events.* 9/9/9 pariteedis; AGA eelpöördumise checklist-sildid DB-s ET-only (TÖÖLAUD P2-6) — leping keelab sisulise teksti DB-hardcode'i |
| Ligipääsetavus, mobiilne/välitöö kest | 4.1 esitusnõue (K8 viide) | flat-režiim/reduced-motion leping (RUUM-VIS 5.2 K8); kest EI OLE K1 andmeleping — K1 nõuab ainult, et seis oleks esitatav ka loendina |

### 2.4. Kolm arhitektuurivarianti

**A — ainult ühine liidese- ja teenuseleping olemasolevate mudelite kohal.** Iga funktsioon hoiab oma tabelid; K1 on (1) normatiivne dokument, (2) jagatud tüübidefinitsioon (`WorkspaceDescriptor`), (3) funktsioonipõhised read-adapterid (`listWorkspaces(userId)` → descriptor), mida tarbivad töölaud/kompass/U1; (4) kohustuslike sündmuste loetelu, mille iga moodul U1 kaudu väljastab.

**B — ühine `Workspace`/`WorkspaceMember` tuum + funktsioonipõhised laiendustabelid.** Uus tabelipaar kannab identiteeti, omanikku, elutsüklit ja osalejaid; Kovisioon/Room/Journey/SUP viitavad tuuma FK-ga; faasid ja sisu jäävad laiendustesse.

**C — täielikult universaalne tööruumi- ja artefaktimudel.** Üks Workspace + polümorfne WorkspaceObject kannavad kõike; funktsioonid on konfiguratsioonid.

| Kriteerium | A: leping + adapterid | B: ühine tuum + laiendused | C: universaalmudel |
|---|---|---|---|
| Migratsioonirisk | **0** — ühtegi olemasolevat rida ei liigutata | Kõrge: Room (tootmises, kutsete/maksete FK-d), CovisionCase (purge-tehing!), Journey tuleb tuuma alla backfill'ida; iga viga puudutab tootmisandmeid | Väga kõrge + pöördumatu |
| Dubleerimine | Jääb kontrollituks: 3 osalejasõnastikku KAARDISTATAKSE ühte lepingusse; kood ühtlustub sündmuste kaudu; uus dubleerimine keelatud (uus ruum peab kasutama Room+Invite või põhjendama erandi) | Kaotab dubleerimise andmekihis, AGA loob ülemineku ajaks NELJANDA osalejasüsteemi (tuum + 3 vana) | Kaotab paberil, praktikas tekivad `meta Json` erandid |
| Õigused | Jäävad moodulite fail-closed väravatesse (tõendatud: Kovisiooni IDOR-sondid 404; Help P0 leping; documents owner-first) — leping ainult nõuab mustrit | Tsentraliseeritud kontroll on võimalik, aga iga moodul peab IKKA lisama sisupõhised reeglid (nt SUMMARY_REVIEWER; org-tellija meta-only) → kaks kihti, riskantne üleminek | Universaalne RBAC — RUUM-VIS anti-lukustusreegel keelab selle otse |
| Jõudlus | Muutumatu; adapterid on olemasolevad omaniku-skoobitud päringud (continuity juba teeb sama mustrit 8 allikaga) | +1 JOIN igale päringule; tuumatabelist kuum punkt | Polümorfsed päringud + indeksiprobleemid |
| Tulevased ruumid | Uus ruum SAAB alustada tuumana Room+Invite peal (soovitus) VÕI oma tabeliga, kui täidab lepingu (SUP-V0 juba vastab ~90%) | Uus ruum saab tuuma tasuta — see on B tegelik eelis | — |
| Kooskõla kinnitatud reeglitega | Täielik (RUUM-VIS 5.4: „K1 = leping DOKUMENDINA + JSON-kontraktina, mitte supertabelina"; handoff: aluskiht ainult sellele, mida ≥2 voogu vajavad) | Rikub „enne leping, siis kood"; ehitaks aluskihi enne, kui ükski UUS tarbija on lepingut vajanud | Rikub anti-lukustusreegleid otse |

### 2.5. Valik V1 jaoks: **variant A** (normatiivne leping + adapteripiir), selge B-evolutsiooniteega

**Otsus:** K1 V1 = variant A. Põhjendus kriteeriumide kaupa:

1. **Migratsioonirisk.** A ei puuduta ühtegi tootmisrida. B nõuaks Room-i (maksete/kutsete FK-dega) ja Kovisiooni (atomaarse purge-tehinguga) ümbertõstmist — mõlemad on kõrgeima riskiga kohad, ilma et ükski kasutajaväärtus enne SUP-V0 ja kompassi sündi seda tagasi teeniks.
2. **Dubleerimine.** Tegelik valu ei ole kolm tabelit, vaid kolm ERI KÄITUMIST (kutse aegumine on Invite'il, Kovisioonil pole; LEFT vs WITHDRAWN eristus on SUP-il, teistel pole). Leping ühtlustab käitumise ja sõnastiku; tabelite liitmine üksi seda ei teeks.
3. **Õigused.** Platvormi tugevaim omadus on moodulipõhine fail-closed omandikontroll (runtime-tõendatud Kovisioonis, Helpis, dokumentides). A säilitab selle; B/C nõrgendaks üleminekuajal.
4. **Jõudlus.** A = 0 muutust; descriptor-adapterid on samad päringud, mida continuity juba teeb.
5. **Tulevased ruumid.** Leping + „vaikimisi alusta Room+Invite peal" annab uutele ruumidele sama kiirenduse, mida B lubaks, ilma tuumatabelita. SUP-V0 valideerib lepingu teise, Room-ist sõltumatu teostusena (ptk 3).

**B-evolutsiooni tingimus (fikseeritud, et valik ei muutuks dogmaks):** kui pärast SUP-V1 ja kompass-P0 valmimist on tõendatud, et ≥2 UUT ruumi vajavad füüsiliselt ühist osalejatabelit (nt üleplatvormiline „kõik minu tööruumid" päring muutub jõudluse pudelikaelaks või rollivahetuse/üleandmise loogikat tuleb kolmandat korda kopeerida), tehakse eraldi analüüs B-tuuma kohta, kus tuum = **AINULT Room+RoomMember+Invite üldistus** (mitte uus tabel), millele Kovisioon/SUP migreeruvad adapteri kaudu. See on tagasipöörduv tee; C ei ole.

## 3. K1 valideerimine olemasolevate ja tulevaste funktsioonidega

Vorming: **jääb alles** (mudel/voog) · **K1 kaudu jagatav** · **EI universaliseeri** · **puuduv K1 väli/üleminek, mis ilmnes** · **roll** (doonor = annab lepingule mustri; tarbija = hakkab lepingut täitma).

| Funktsioon | Jääb alles | K1 kaudu jagatav | EI universaliseeri | Puuduv väli/üleminek ilmnes | Roll |
|---|---|---|---|---|---|
| **Teekonna kompass / elusündmuse tööruum** | Journey tabel + shareKeys-jagamine + „Jätka viimast" | descriptor (eesmärk=title, seis, järgmine samm), U1 sündmused („mis muutus"), U12 jagamiste seis | elusündmuse SISU struktuur (domains/riskSignals Json) — jääb Journey omaks; MITTE mingit „jaga kogu Teekond" | `nextAction` väli puudub Journey'l; PAUSED-olek puudub (ACTIVE↔ARCHIVED on liiga järsk); descriptor vajab `lastMeaningfulActivityAt` | Tarbija (esimene privaatse ruumi profiil) |
| **Tööheaolu iganädalane püsiruum** | 10 vormi + WellbeingRecord + k-anonüümne agregaat + WellbeingOutputDraft→Kovisioon sild | rütm kui faasivariant (K1 lubab mittelineaarse profiili); U1 nädalarütmi sündmus; „jätka pooleli vormiga" descriptor | kirjete SISU ja skoorid; agregaadi summutusmuster; mitte KUNAGI org-nähtavust | **konteiner puudub üldse** — K1 descriptor tuleb tuletada kirjete koondist (adapter, mitte uus tabel enne TH-RUUM otsuseid); rütmi-checkpoint väli | Tarbija; doonor ühes asjas: „üksik privaatne + koond anonüümne" nähtavusklass |
| **Kovisioon** | KÕIK: 8 etappi, väravad, CAS+lock, sulgemine, purge, järelteod, praktikad | K1 olekusõnastik (tema oma ONGI etalon), faasivärava muster (server arvutab tõendid), purge-klass, vastutaja-muster (assignedFollowUpUserId) | 8 etapi SISU, tööobjektiliikide whitelist'id, retsensioonivoog | ainus auk: ta EI VÄLJASTA sündmusi (kutse, etapivahetus, kokkuvõte ootab — mitte ühtegi teavitust üheski kanalis; ptk 5.2) | **Doonor** (peamine) |
| **Supervisioon (SUP-V0)** | SUP-P0 13 mudelit [haru 2fc826c4, tulevane sisend — EI OLE main-is] | olekusõnastik (DRAFT/ACTIVE/CLOSED kattub), osaleja elutsükkel (INVITED..WITHDRAWN on lepingu RIKKAIM teostus), Summary approval-muster = artefakti kinnitusvoog, SupervisionAuditEvent = tööruumi-auditi muster | superviisori kvalifikatsiooni/grandi loogika; org-tellija meta-only vaade; tasumudel | descriptor vajab `responsible` ≠ owner (supervisorId on „vastutaja", supervisant on subjekt — K1 peab eristama); kohtumise lähenemise sündmus (U1 kataloogis) | Tarbija (esimene TÄIS-lepingu tarbija) + doonor osaleja-sõnastikus |
| **Vestlus + kohtumise ühisvaade** | Conversation/ConversationMessage; U10 meetingSummaryShare [MAIN, auditeeritud RUUM-A0 ptk 8] | kohtumine kui K1 mini-profiil (enne/ajal/järel); U10 jagamine = artefakti-elutsükli SHARED üleminek + U1 sündmus | vestluse sisu; RAG-rada; kriisirada (VEST-P0a on eraldi värav) | U10 jagamisel puudub auditikirje (RUUM-A0 8 K2) JA U1 sündmus; „kokkuvõte ootab kinnitust" olek | Tarbija |
| **Abivahendus + Teenusekaart** | HelpRequest/Offer/Match + Help P0 nähtavusleping (origin/main); ServiceMapEntry; U4 availability-väljad | match-ruum = Room origin-tüübiga (JUBA NII); listing'u elutsükkel (OPEN→CLOSED/EXPIRED) kaardistub K1 olekutesse; U1: match/listing sündmused | avalik projektsioon (listingAccess.js leping on värskelt auditeeritud — K1 EI tohi seda lahjendada); anonüümsuskinnitus | match-ruumi ühepoolse kustutuse keeld (RUUM-A0 16 K2 — K1 kustutusmaatriks peab flow-päritolu ruumid kaitsma) | Mõlemad: doonor (expiresAt, avalik projektsioon), tarbija (ruumi elutsükkel) |
| **Võrgustikutöö** [VISION] | — (pole koodi) | K3/K4 täismahus: osaleja kutsumine piiratud nähtavusega, kokkulepped, ligipääsu lõpp | kolmandate isikute andmete reeglid (eraldi õigusanalüüs — BLOCKED) | „osaleja nähtavuspiir kutsel" (K1 4.6 vajab `scopeNote` kohta); EI ehitata enne K3/K4 ühtlustust | Tulevane tarbija (rangeim) |
| **Juhtumitöö assistent (JTA)** [VISION] | vastuvõtulaud + receiverChecklist + artefaktid (olemas) | K1 ettevalmistus-faasid; K6 järgmine kontakt (nextContactOn muster üldistub); päritolumärgistus (K2) | STAR2 piir (mustand, MITTE register); ideed 17 k1–k11 otsused | „ülesanne vastutajaga" objekt (praegu ainult checklist Json) | Tulevane tarbija |
| **Genogramm/ökokaart** [VISION] | — | võrgustikuruumi VAATED (mitte eraldi ruumid) | kolmandate isikute andmed [BLOCKED_DECISION] | — | Tulevane tarbija (võrgustiku kaudu) |
| **Organisatsiooni tööruum / org-analüütika** [VISION, BLOCKED: org-mudel] | Tööheaolu agregaat; admin-analüütika | AINULT k-anonüümsed koondid U1 sündmustest; org-tellija „meta-only" nähtavusklass (SUP annab mustri) | ühtegi individuaalset sündmusevoogu EI avata org-ile — see on U1 nähtavusklassi ARHITEKTUURILINE keeld | org-liikmesuse mudel puudub (teadlikult) | Tulevane tarbija |
| **ESTA** [VISION, BLOCKED: partnerlus] | — | liikmesusvärav = K1 4.6 uus liikmelisuse TÜÜP (tiitel + kehtivus), mitte uus süsteem | partnerluse tingimused; mitte uus põhiroll | liikmesuse kehtivusaeg (validUntil muster on PracticeCapability's OLEMAS — taaskasutatav) | Tulevane tarbija |
| **Välitöö mobiilne kest** [VISION] | PWA + dikteerimine | külastus = K1 mini-tööruum (3 faasi); U1 saabumis-/lahkumissündmused (töötaja OMA valikul) | asukoht — rangelt kasutaja algatatud, MITTE K1 kohustuslik väli | offline-mustandi olek (`draftPendingSync`) descriptor'is | Tulevane tarbija |

**Valideerimise kaks kontrolljäreldust (ülesande nõue):**

1. **Kovisioon doonorina:** K1 4. peatüki olekusõnastik, faasivärava muster, purge-klass ja vastutaja-väli on KÕIK ekstraktitud Kovisiooni töötavast koodist (mitte leiutatud) — leping ei nõua Kovisioonilt ühtegi muudatust peale sündmuste väljastamise (mis on U1 adapteripakett, mitte loogikamuutus). Leping katab Kovisiooni 100%: iga tema olek/üleminek/roll kaardistub (4.2 tabel).
2. **SUP-V0 tarbijana:** SUP-P0 skeem [haru, tulevane sisend] täidab lepingu ilma muudatusteta ~90%: olekud kattuvad (DRAFT/ACTIVE/CLOSED ⊂ K1), osaleja elutsükkel on lepingu rikkaim (INVITED/ACCEPTED/DECLINED/LEFT/WITHDRAWN), CAS-version + lastActivityAt + closedAt on olemas, SupervisionAuditEvent vastab auditinõudele. Kaks lünka, mis tuleb SUP-P1-s lisada lepingu järgi: (a) PAUSED-olek (leping lubab, SUP skeem ei paku — vajalik „leping peatatud" reaalsuseks); (b) U1 sündmuste väljastus (nagu kõigil). See kinnitab, et leping on piisavalt üldine ilma Kovisiooni-spetsiifikat kopeerimata.

## 4. K1 normatiivne leping (V1)

Kõik selles peatükis on **normatiivne V1**, kui pole märgitud [TULEVIK], [DECISION] (tooteomanik) või [TECH-OPEN] (tehniline lahtine).

### 4.1. Kanoonilised mõisted ja descriptor

- **Workspace (tööruum)** — lepingut täitev funktsiooni-eksemplar. **WorkspaceRef** = `{kind, id}`; `kind` on registrist (4.9), `id` on mooduli oma tabeli ID. FK-d üle moodulipiiri EI looda (anti-lukustus).
- **Omanik (owner)** — kasutajakonto, kellele ruum kuulub; alati täpselt üks; ainus, kes tohib algatada elutsükli lõppu (v.a admin-erandid auditijäljega).
- **Vastutaja (responsible)** — kasutaja, kes vastutab JÄRGMISE tegevuse eest; vaikimisi = omanik; võib erineda (Kovisiooni assignedFollowUpUserId; SUP supervisorId). Descriptor kannab alati mõlemad.
- **Osaleja (participant)** — kasutaja, kellel on ruumis roll (4.3) ja elutsükkel (4.6). Osaleja ≠ ligipääs päritoluobjektidele (ruumi kutsumine ei ava kutsuja teisi andmeid).
- **Faas (phase)** — protsessiruumi samm; toetav, mitte sundiv. **Värav (gate)** — üleminek, mis nõuab kasutaja teadlikku kinnitust; tõendid arvutab ALATI server (Kovisiooni muster).
- **Artefakt** — ruumis loodud püsiväljund (kokkuvõte, mustand, pakk, praktika); elutsükkel 4.7.
- **Kokkulepe (agreement)** — mitmepoolne kinnitatud artefakt (kohtumise kokkuvõte, ruumi kokkulepe); nõuab kinnitusahelat.
- **Märge/ülesanne** — kergemad tööobjektid; ülesandel on vastutaja ja võib olla tähtaeg (K6 „järgmine kontakt" muster).
- **Sündmus** — U1 kirje ruumi üleminekust (4.8); ajajoon ja auditijälg on sama voo kaks esitust.

**WorkspaceDescriptor (read-model, mille iga adapter tagastab):**

```jsonc
{
  "ref": { "kind": "covision_case", "id": "cml…" },
  "title": "Üldistatud pealkiri",            // lokaliseeritav võtme VÕI kasutaja teksti kaudu
  "ownerId": "usr…",
  "responsibleId": "usr…",                    // vaikimisi = ownerId
  "lifecycle": "ACTIVE",                      // 4.2.1 sõnastik
  "phase": { "stage": 3, "key": "viewpoints", "labelKey": "covision.stage.3" }, // null kui faasideta
  "goal": "…",                                 // kasutaja sõnastatud eesmärk; võib olla null
  "nextAction": { "labelKey": "…", "dueOn": "2026-07-28", "assigneeId": "usr…" }, // null lubatud
  "progress": { "current": 3, "total": 8 },   // null kui pole loenduslik
  "visibility": "PRIVATE",                    // 4.4 klass
  "participants": { "active": 4, "invited": 1 },
  "lastMeaningfulActivityAt": "2026-07-16T…",
  "href": { "action": "open_workspace", "target": "covision_case:cml…" } // 8. ptk registri viide, MITTE toores URL
}
```

### 4.2. Olekud ja üleminekud

**4.2.1. Kanooniline elutsükli sõnastik** (rakenduskihi konstandid, MITTE PostgreSQL enum — kinnitatud reegel):

`DRAFT → ACTIVE → (PAUSED ⇄ ACTIVE) → CLOSED → ARCHIVED`, lisaks terminaalne `PURGED` (sisu kustutatud, valitud väljund säilitatud) ja `DELETED` (kirje kadunud; lubatud ainult 4.5 maatriksi järgi).

- Iga moodul kaardistab OMA olekud sellesse sõnastikku (descriptor.lifecycle); oma olekuid EI pea ümber nimetama.
- Kaardistustabel (normatiivne):

| Moodul | DRAFT | ACTIVE | PAUSED | CLOSED | ARCHIVED | PURGED |
|---|---|---|---|---|---|---|
| Kovisioon | DRAFT | ACTIVE, SUMMARY_READY | pausedAt≠null | CLOSED | ARCHIVED | CLOSED+purge (juba nii) |
| Room | — (sünnib aktiivsena) | (vaikimisi) | [TULEVIK] | [TULEVIK — puudub, vt 4.5] | [TULEVIK] | — |
| Journey | DRAFT | ACTIVE | [TULEVIK] | — | ARCHIVED | — |
| PreInquiry (jagamisobjekt) | DRAFT | READY/SENT | — | ARCHIVED/DOWNLOADED | — | recall enne avamist |
| SUP [haru] | DRAFT | ACTIVE | [SUP-P1 lisa] | CLOSED | [SUP-P1] | purge-tehing (SUP-plaanis) |
| TopicSeed | DRAFT | WAITING/IN_COVISION | — | CLOSED | — | — |

**4.2.2. Üleminekureeglid (invariandid):**

1. Üleminek on lubatud ainult naabrisse (DRAFT→ACTIVE, ACTIVE→PAUSED/CLOSED, PAUSED→ACTIVE/CLOSED, CLOSED→ARCHIVED); hüpe = 409 (Kovisiooni `PHASE_TRANSITION_CONFLICT` muster).
2. CLOSED on kasutaja teadlik otsus (värav), MITTE taimeri kõrvalmõju; platvorm ei lõpeta faasi ega ruumi vaikimisi (handoff).
3. Iga olekumuutus kirjutatakse CAS-iga (version-väli VÕI updatedAt-CAS — mõlemad mustrid on koodis; uutel ruumidel version Int).
4. Faasid: üleminek sammukaupa mööda kataloogi; COMPLETE-üleminekul arvutab tõendid server (`missing[]` vastus); topelt-lõpetamine on idempotentne viga (409, mitte korduv kõrvalmõju).
5. PAUSED ei muuda õigusi ega nähtavust — ainult rütmi (meeldetuletused vaikivad).

### 4.3. Rolli- ja õiguste maatriks

Kolm eri asja, mida EI TOHI segada (rollivahetaja analüüsi kinnitatud piir):

- **Konto roll** (`User.role`: CLIENT/SOCIAL_WORKER/SERVICE_PROVIDER/ADMIN) — määrab, MILLISEID ruume tohib LUUA (nt Kovisiooni looja = ADMIN|SOCIAL_WORKER `assertCovisionCreator`); fail-closed.
- **Tööruumiroll** — OWNER / RESPONSIBLE / MODERATOR (CO_MODERATOR) / MEMBER (PARTICIPANT) / OBSERVER / REVIEWER (SUMMARY_REVIEWER jm võimekuspõhised) — kehtib AINULT ruumi sees.
- **Admini vaate-eelvaade** — `PUT /api/profile/view-role` vahetab UI-vaate, MITTE õigusi; serverikomponendid vajavad refresh'i (TÖÖLAUD P2-1); admin EI näe eelvaates teiste privaatseid ruume (kehtiv käitumine, muutub lepingu invariandiks).

| Tegevus \ roll | OWNER | RESPONSIBLE | MODERATOR | MEMBER | OBSERVER | Konto-ADMIN (väljaspool ruumi) |
|---|---|---|---|---|---|---|
| Ava/vaata sisu | ✓ | ✓ | ✓ | ✓ | ✓ (kitsam sisu lubatud) | ✗ (404 — Kovisiooni IDOR-tõend on norm) |
| Muuda sisu / tööobjekte | ✓ | ✓ | ✓ | ✓ (faasi whitelist) | ✗ (ainult kinnitused) | ✗ |
| Faasi edasi (värava kinnitus) | ✓ | ✓ | ✓ (kui LEADER-klass) | ✗ | ✗ | ✗ |
| Kutsu osaleja | ✓ | reegel moodulis | ✓ | ✗ | ✗ | ✗ |
| Eemalda osaleja | ✓ | ✗ | ✓ [DECISION per moodul] | ✗ | ✗ | ✗ |
| Lahku | ✗ (peab enne üle andma [TULEVIK]) | ✓ (vastutus läheb omanikule) | ✓ | ✓ | ✓ | — |
| Sulge (CLOSED) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Arhiveeri/kustuta | ✓ (4.5 piires) | ✗ | ✗ | ✗ | ✗ | ainult retention-/õigusprotseduur auditijäljega |
| Omaniku/vastutaja vahetus | ✓ algatab; uus kinnitab [TULEVIK — üheski moodulis pole; U11] | — | — | — | — | ✗ |

### 4.4. Nähtavuse maatriks

Neli klassi (descriptor.visibility); iga ruum deklareerib oma klassi ja server jõustab:

| Klass | Kes näeb sisu | Kes näeb fakti (meta) | Näited/tõend |
|---|---|---|---|
| PRIVATE | ainult omanik | ainult omanik | Journey, WellbeingRecord, TopicSeed DRAFT, JTA [VISION] |
| SHARED_PARTICIPANTS | aktiivsed osalejad (rollipiiridega; privaatsed KÕRVALPINNAD jäävad isiklikuks — CovisionPrivateState muster) | osalejad | Room, CovisionCase ACTIVE, SUP protsess [haru] |
| ORG_META [TULEVIK, blokeeritud org-otsusega] | MITTE KEEGI org-ist ei näe sisu | org-tellija näeb toimumise fakti (kohtumiste arv, staatus) | SUP org-leping; Tööheaolu KOV-koond |
| PUBLIC_DERIVED | avalik TULETIS (külmutatud projektsioon), mitte ruum ise | kõik | Help avalik projektsioon (listingAccess.js leping); EffectivePracticeVersion publicSnapshot |

Reeglid: (1) klassi tõstmine (privaatsem→avalikum) nõuab alati kasutaja teadlikku kinnitust + U1 sündmust; (2) langetamine (jagamise tagasivõtt) on alati võimalik, tagajärjed 4.7 järgi; (3) osaleja NÄHTAVUSPIIR fikseeritakse kutsel (mida kutsutav näeb) — võrgustikuruumi eeldus, Invite'il täna implitsiitne („kogu ruum").

### 4.5. Kustutuse/arhiveerimise maatriks

| Üleminek | Mis juhtub sisuga | Mis säilib | Kes tohib | U1 sündmus |
|---|---|---|---|---|
| CLOSED (sulgemine) | sisu külmub; uus töö keelatud (Kovisiooni `SESSION_STAGE_WORK_COMPLETED` muster) | kõik, mida moodul lubab | omanik värava kaudu | workspace.closed |
| CLOSED + purge | tööandmed kustuvad tehinguna; säilib AINULT whitelist-väljund (closure-muster) | üldistatud väljund + osalejate õiguskirjed | omanik (värava osana) | workspace.closed (purge-lipuga) |
| ARCHIVED | kirje kaob aktiivvaadetest, jääb loetavaks | kõik senine | omanik | workspace.archived |
| DELETED (hard) | kirje + kaskaadid kaovad | ei midagi (v.a auditikirje!) | omanik; **flow-päritolu mitmepoolsetel ruumidel KEELATUD ühepoolselt** [DECISION — RUUM-A0 16 K2; soovitus: arhiveeri+lahku asemele] | workspace.deleted (auditiklass) |
| Konto kustutamine | fail-closed orkestreerimine (DataDeletionJob): omaniku ruumid kustuvad/anonümiseeruvad mooduli reegli järgi; ADRESSAADILE jäävad külmutatud koopiad märkega „autor kustutatud"; ruumisisu jääb ruumile (RoomMessage kaskaad on TEADA erand — FAILID ptk 8: autori kustutus kustutab ta ruumisõnumid; leping märgib selle [DECISION-kandidaadiks], mitte vaikeseaduseks) | adressaatide külmutatud koopiad; auditijälg | kasutaja ise / õigusprotseduur | account.deletion_* (olemas privacy-radades, ühtlustatakse) |
| Retention-aegumine | klassipõhine (90p üld; 7a makse; moodulipõhised) | vastavalt klassile | süsteem (timer) — NB toodangus sweep on täna laisk-throttle, mitte garanteeritud taimer (FAILID F-06) | retention.expired [TULEVIK] |

### 4.6. Osaleja elutsükkel (kanooniline)

`INVITED → ACCEPTED | DECLINED | EXPIRED` (kutse; Invite + CovisionInviteStatus + SupervisionParticipation ühisosa), seejärel `ACTIVE → LEFT` (ise) `| REMOVED` (eemaldati) `| WITHDRAWN` (võttis OSALUSNÕUSOLEKU tagasi — SUP-i eristus, mis muutub lepingu osaks: WITHDRAWN nõuab ka tema panuse käsitlusreeglit).

Invariandid: (1) kutse on aegumisega ja tagasivõetav (Invite muster); (2) liitumine = nõusolek ruumi reeglitega (raamistiku-kinnituse analoog); (3) lahkumine on alati võimalik (v.a OWNER enne üleandmist); lahkumine EI kustuta tema senist panust, aga lõpetab ligipääsu (leftAt + SSE 20s taaskontroll on tõendatud muster); (4) liikmesuse lõpp KORISTAB ristkihid (kõneosalus, consent-read — RUUM-A0 16 K3/20.3 retsept muutub lepingu nõudeks); (5) iga elutsüklisamm väljastab U1 sündmuse.

### 4.7. Artefakti elutsükkel (kanooniline)

`DRAFT → CONFIRMED/FINAL → SHARED (külmutatud koopia adressaadil) → SUPERSEDED (parandus uue versioonina) | REVOKED (enne avamist) | EXPIRED`.

Tõendmustrid: PreInquiry (SENT→openedAt; recall ainult avamata; correction = uus kirje `supersededById`), TopicSeed `sharedCardSnapshot` (külmutus), AgentArtifact FINAL (immutability), EffectivePracticeVersion (muutumatu avaldamissnapshot + re_review tagasivõtutee), U10 (FINAL → RoomMessage koopia).

Invariandid: (1) jagatakse alati KÜLMUTATUD versiooni, mitte elavat viidet (v.a teadlik erand, mis dokumenteeritakse); (2) tagasivõtt enne avamist eemaldab; pärast avamist on rada „saada parandus" (U3 muster); (3) kandja konto kustutuse järel: adressaadi koopia jääb märkega „autor kustutatud" (4.5); (4) iga SHARED/REVOKED/SUPERSEDED üleminek = U1 sündmus + auditikirje (U10 auk RUUM-A0 8 K2 suletakse selle lepinguga).

### 4.8. Sündmused, mida iga tööruum PEAB väljastama (K1→U1 sild)

Miinimum (tüübinimed on U1 registri võtmed, ptk 7): `workspace.created`, `workspace.activated`, `workspace.phase_changed`, `workspace.next_action_set` (sh tähtaja muutus), `workspace.participant_invited/_joined/_left/_removed`, `workspace.owner_changed` [TULEVIK kuni U11], `workspace.consent_granted/_withdrawn`, `workspace.artifact_created/_confirmed/_shared/_revoked`, `workspace.closed`, `workspace.archived`, `workspace.deleted`. Faasideta ruumid (Journey, Tööheaolu konteiner) väljastavad ainult asjakohased. Sündmuse SISU piirang: ptk 6.4 (payload ilma vabatekstita).

### 4.9. Näidis-JSON ja registrid

- `WorkspaceKind` register (rakenduskihi konstant, laieneb ainult koos adapteriga): `room`, `covision_case`, `journey`, `pre_inquiry`, `wellbeing_space` (adapter kirjete koondist), `supervision_process` [haru], `topic_seed`, hiljem `meeting`, `network_case`, `field_visit`, `org_space`.
- Descriptor: 4.1 näidis. Adapteri leping: `listWorkspaces(userId, {kinds?, lifecycle?}) → WorkspaceDescriptor[]` — AINULT omaniku-/osaleja-skoobitud read; ükski adapter ei tohi lekitada teise kasutaja ruume (continuity omandipiiri muster on referents).
- i18n: descriptor kannab `labelKey`-sid, mitte tõlgitud stringe; kasutaja OMA tekst (pealkiri, eesmärk) jääb tekstina. DB-sse EI salvestata tõlkimata süsteemisilte (TÖÖLAUD P2-6 õppetund — checklist'i ET-sildid DB-s on rikkumise pretsedent).

### 4.10. Invariandid, mida server ALATI jõustab

1. Omaniku-skoobitud päringud igal descriptor-/sisu-rajal (404 võõrale; mitte 403-oraakel — documents F-14 vastane muster).
2. Olekuüleminekud CAS-iga; väravatõendid arvutab server; kliendi „evidence" ei ole usaldusväärne.
3. Nähtavusklassi tõstmine ainult kasutaja kinnitusega; klassivahetus = U1 sündmus.
4. Elutsükli lõpp määratakse loomisel (moodul deklareerib retention-klassi ja purge-whitelisti ENNE esimest rida).
5. Liikmesuse lõpp koristab ristkihid samas tehingus (või kompensatsiooniga).
6. Iga 4.8 sündmus kirjutatakse U1-te SAMAS tehingus äritoiminguga (outbox-põhimõte) — mitte best-effort pärast vastust.
7. Admini eelvaade ei ava kunagi PRIVATE/SHARED sisu; admin-toimingud käivad eraldi protseduurirajalt auditijäljega.
8. Ükski agregaat/koond ei sisalda üksikkasutaja tuvastatavat rida (Tööheaolu summutusmuster on referents).

### 4.11. Keelatud otseteed

- EI polümorfset supertabelit; EI PG-enum'e olekutele; EI org-mudelit enne otsust; EI universaalset RBAC-i; EI geo/3D alusarhitektuuri (RUUM-VIS 5.4 anti-lukustus — kinnitatud siin lepinguna).
- EI „jaga kogu ruum" nuppu privaatsetele tuumadele (Journey!); jagamine ainult külmutatud väljavõtetena.
- EI vaikimisi-jagamist ega vaikimisi-lõpetamist; EI automaatset faasivahetust.
- EI sündmuse payload'is vabateksti (6.4); EI teavitusi, mille sihtlink pole registrist (ptk 8).
- EI uut osalejasüsteemi ühelegi uuele ruumile ilma põhjendatud erandita: vaikimisi Room+Invite VÕI lepingukohane oma tabel (SUP-i juht), aga mitte kolmas ad-hoc muster.

### 4.12. Eristus: normatiiv / tulevik / otsused / tehnilised küsimused

- **Normatiivne V1:** 4.1–4.11 ilma [TULEVIK]/[DECISION] märgisteta read; adapteripiir (4.9); sündmuste miinimum (4.8).
- **Tulevikuvariandid:** PAUSED Room'il/Journey'l; owner_changed (U11); ORG_META klass; B-tuum (2.5 tingimus); retention.expired sündmus.
- **Tooteomaniku otsused:** kanoonilise sõnastiku kinnitus (blokeerib K1-P0 — ptk 11 O-K1); flow-ruumide kustutusreegel (RUUM 16 K2); RoomMessage autori-kaskaadi saatus; moderaatori eemaldusõigus moodulite kaupa.
- **Tehnilised avatud:** [TECH-OPEN] descriptor'i vahemälustrateegia (iga-päringu-arvutus vs materialiseeritud vaade — V1: arvuta päringul, nagu continuity); [TECH-OPEN] `wellbeing_space` adapteri koondireeglid enne TH-RUUM otsuseid.

## 5. U1 — olemasoleva sündmuse- ja teavituskihi audit

### 5.1. Viis mehhanismi, mis täna „sündmusi" kannavad (kood + runtime)

| Mehhanism | Mis ta on | Tõend |
|---|---|---|
| **NotificationEvent + reconciler + delivery** | `NotificationEvent` (schema :1912): userId, type, sourceType/sourceId, `dedupeKey @unique`, targetKind/targetId, readAt, expiresAt, email* (policy NONE/OPTIONAL/TRANSACTIONAL; status kuni SENT/FAILED/UNKNOWN). Loojaid on TÄPSELT ÜKS: `createNotificationEvent` (lib/notifications.js:177), mida kutsub AINULT `reconcileNotificationEvents` (lib/notificationReconciler.js) — **olekuskaneeriv projektsioon**: 7 paralleelset allikpäringut (saabunud pöördumised; tähtajad; SENT-kutsed; 6h akna ruumisõnumid; help-match'id; praktika-määrangud; aegunud availability) tuletavad sündmused DB SEISUST, mitte tegevushetkest. Saajaõigus verifitseeritakse loomisel JA uuesti igal lugemisel. Delivery: claim-CAS, 15s timeout, backoff 5min·2^n (lagi 24h), 3 katset → FAILED; kinni jäänud SENDING >10min → UNKNOWN (terminaalne, nähtamatu — TÖÖLAUD P2-4). | kood + testid 21/21 (TÖÖLAUD §11) |
| **Toodangu käivitaja** | systemd `sotsiaalai-notifications.timer` → `npm run notifications:dispatch` → `POST /api/jobs/notifications` (NOTIFICATION_JOB_KEY, timing-safe) — **käib iga ~5 min; kontrollisin serverist 17.07: viimane käivitus 08:22:48, väljund `{"ok":true,…}`**. Lisaks `sotsiaalai-practice-reviews.timer` ja `sotsiaalai-service-availability.timer` (päevased). TÖÖLAUD P2-5 („käivitusgarantii puudub") kehtib REPO kohta (unit-failid pole repos), MITTE toodangu kohta — oluline korrektsioon. | SSH runtime 17.07 [SERVER] |
| **Continuity („Jätka siit")** | `lib/workspaceContinuity.js`: 8 liiki (next_contact ületähtaja prio 0 → … → journey prio 7), omaniku-skoobitud, Tallinna-kuupäev, href-dedup, kuni 7 kirjet + badge'id kaartidele. See on DE FACTO „mis vajab tähelepanu" projektsioon — DB-tuletatud, teavitustest SÕLTUMATU (kaks paralleelset badge-allikat, kasutusel continuity oma). | TÖÖLAUD §2 |
| **Otsesed e-kirjad (mailer) väljaspool konveierit** | sisuta saabumiskiri pöördumisel (`dispatchInternalArrivalEmail`), kutse-e-kirjad (`/api/invites` + resend), availability-meeldetuletus (`lib/serviceAvailabilityReminders.js` — oma timer!), auth/parool/registreerimine, admin bulk-email. Igaüks oma retry-/dedupe-loogikaga või ilma. | grep mailer-kasutajad; timer serverist |
| **Auditikihid (4 tk) + reaalajakanal** | DataAuditLog (üldine; privacy/calls/retention/materjalid), DocumentAudit (dokumendid/artefaktid; ARTIFACT_SHARE puudub — RUUM-A0 8 K2), EffectivePracticeAuditEvent, SupervisionAuditEvent [haru]. Reaalajas: `lib/roomStream.js` SSE (message/delete/call; 20s ligipääsu-taaskontroll) — EFEMEERNE, mitte püsisündmus. | kood |

### 5.2. Sündmusperekondade kaardistus: kus iga rada TÄNA lõpeb

Legend: ✉=e-kiri, N=NotificationEvent, C=continuity, A=auditikiri, D=deep-link olemas, L=ainult lehe lokaalne olek, —=mitte midagi kasutajale.

| Sündmusrada (tekitaja) | Täna | Märkused/tõend |
|---|---|---|
| Eelpöördumine saabus (saatmine `sendPreInquiry`) | ✉(sisuta, sünkr) + N(PRE_INQUIRY_ARRIVED, NONE-poliitika) + C(prio 2) + D | topelt-e-kirja väldib NONE-poliitika reconcileris |
| Eelpöördumine avati/arhiveeriti (vastuvõtja workflow-PATCH) | N(STATUS_CHANGED, OPTIONAL) autorile | **UI-pind puudub** (P1-2); autor näeb ainult „Minu jagamised" kehtivusreast |
| Eelpöördumise recall/parandus (autor) | recall: N-kirjed kaovad (lugemisaegne re-verify); parandus: uus SENT → uus saabumisrada | recall ISE ei teavita vastuvõtjat [auk — U3 skoop] |
| Järgmise kontakti tähtaeg | N(NEXT_CONTACT_DUE, OPTIONAL) + C(prio 0/4) + D | kuupäevamuutus tühistab vanad (updatePreInquiryReceiverWorkflow) |
| Ruumikutse | ✉(kutsekiri otse) + N(ROOM_INVITE, NONE) + D(/join) | kutse-e-kiri EI käi konveieri kaudu |
| Ruumi uus sõnum | N(ROOM_ACTIVITY, OPTIONAL, 6h-akna dedupe) + C(room_unread) + SSE + lastReadAt | badge maandub „Lisa inimene" kaardile (P2-3) |
| Ruum kustutati / liige lahkus / omanik? | — / — / pole olemas | kustutus AUDITIJÄLJETA (RUUM 16 K4); lahkumisest keegi teada ei saa |
| Help match tekkis | N(HELP_MATCH_CREATED, NONE) + ruum | listing'u aegumine/sulgemine: — |
| Kovisioon: kutse/etapp/sulgemine/järeltegevus | **— (mitte ükski kanal)** | ainus „teavitus" on UI ise; CovisionInviteStatus on kirjas, aga kutsutu ei saa signaali; järeltegevuse tähtaeg (scheduledFor) ei tõuse kuhugi |
| Tööheaolu: mustand pooleli / nädalarütm | C(wellbeing_draft, prio 6) / **rütmi pole olemas** | kirjete lugemisrada puudub (tervikanalüüs) |
| Supervisioon [haru] | SupervisionAuditEvent (A) — teavitusi pole kavandatudki P0-s | K1 valideerimise lünk (b) |
| Praktika retsensioon määratud/üle tähtaja | N(PRACTICE_*, OPTIONAL) + C(prio 1) + D(katki!) | `?practice=` parameetrit EI LOE ükski komponent (P1-1) |
| Teenuse availability aegunud | N(SERVICE_AVAILABILITY_STALE, NONE) + C + eraldi ✉-meeldetuletus (oma timer + DataAuditLog) | KAKS paralleelset süsteemi sama asja jaoks |
| Dokumendid: analüüs valmis/artefakt kinnitatud/jagatud | L + A(DocumentAudit; share'il MITTE) | kasutajale järeltegevussignaali pole |
| Konto/retention/kustutus | A + DataDeletionJob; kasutajale pending-olekut ei näidata (FAILID F-07) | — |
| Vestlus: kriisirada, RAG-vastus | L (+ ChatLog) | VEST-P0a eraldi värav; U1 EI puutu kriisirada |

### 5.3. Kontrollnimekirja verdiktid (ülesande 14 punkti)

| Kontroll | Seis (N-kanal) | Auk |
|---|---|---|
| Sündmuse tekitaja | reconciler tuletab olekust; tegevushetke emitterit POLE | faasimuutus, recall, artefakti jagamine jm EI JÕUA kunagi kanalisse, sest olekuskaneering neid ei näe (nt vahepealne olek kaob enne skaneeringut) |
| Adressaadi leidmine | inline reconcileris (recipientOwnerId/authorId/liikmed/reviewerId/profiiliomanik) | iga uus tüüp = uus käsitsi haru; resolver-lepingut pole |
| Õiguste kontroll | loomisel + lugemisel re-verify (tugev!) | — (säilitada) |
| Duplikaadid | dedupeKey `type:sourceId:userId:suffix` @unique + upsert-püüe | tugev; ROOM_ACTIVITY 6h-aken on teadlik agregatsioon |
| Retry | e-post: claim-CAS + backoff + FAILED; UNKNOWN terminaalne, admin-vaateta (P2-4) | reconciler ise on loomult retry-kindel (järgmine skaneering) |
| Lugemata/loetud | readAt; PATCH üksik/allika kaupa; ainsad automaatsed märkijad: ruumi read-route + NEXT_CONTACT tühistus | PRE_INQUIRY_*/PRACTICE_* jäävad igaveseks lugemata (P1-2) |
| Arhiveerimine/dismiss | **puudub** (ainult readAt; expiresAt ainult ROOM_INVITE-l) | kasutaja ei saa teavitust „käsitletuks" märkida |
| Deep-link terviklus | targetHref 4 mustrit; 2 katki (practice, journey continuity-s), 1 osaline (openInquiry vastuvõtja-fallback P2-2) | ptk 8 lahendab |
| Kanalid | in-app API (UI-ta!) + e-post; push puudub | laienduspunkt olemas (emailPolicy muster) |
| Keele valik | frameworkAcceptance viimane lokaat; võtmed 9/9/9 ET/EN/RU | korras; sisuta-kirja põhimõte säilitada |
| Retention | NotificationEvent-il OMA retention'i pole (kustub kasutajaga Cascade) | vajab klassi (ptk 6/9) |
| Konto kustutamine | onDelete: Cascade userId kaudu | korras |
| Privaatsus/vabatekst | payload'i EI OLE ÜLDSE (ainult type+id-d) — parim omadus | säilitada lepinguna |
| Tegelik UI-tarbija | **PUUDUB** — `GET/PATCH /api/notifications` on ilma ühegi UI-kutsujata; badge'id tulevad continuity'st | U1-P1 skoop |

### 5.4. Auditi koondleiud (U1-A)

1. **U1-A1.** Serveripool (loomine, dedupe, õiguste re-verify, delivery, toodangu timer) on TÖÖTAV ja üle keskmise kvaliteediga; kasutajapool (inbox, dismiss, ajajoon) puudub. „API olemas" ≠ „kasutajakogemus olemas" — kinnitatud.
2. **U1-A2.** Arhitektuurne piir: olekuskaneering EI SAA kunagi kanda tegevushetke sündmusi (faasivahetus, tagasivõtt, jagamine, sulgemine) — nende jaoks on vaja tegevushetkel kirjutatavat püsisündmust. See on põhjus, miks Kovisioon/Tööheaolu/dokumendid on täna kanalita, MITTE „lisamata tüübid".
3. **U1-A3.** Sündmusel puudub tööruumi viide (ainult sourceType/sourceId + targetKind/targetId) — timeline'i ega kompassi „mis muutus" EI SAA sellest ehitada ilma K1 WorkspaceRef-ita.
4. **U1-A4.** Kolm paralleelset e-kirja süsteemi (konveier; otsekirjad; availability-reminder oma timeriga) ja kaks badge-allikat — konsolideerimissuund, mitte kohe-parandus (D-korvi kandidaadid kuni U1-P1+).
5. **U1-A5.** Deep-lingid on osaliselt katteta lubadused (P1-1/P2-2) ja `targetHref` salvestab URL-mustri KIRJUTAMISE hetkel — registri (ptk 8) puudumine tähendab, et marsruudimuutus murrab vanad kirjed.
6. **U1-A6.** UNKNOWN-parkla (P2-4) ja repo-väline timer-seadistus (P2-5 repo mõttes) on ops-nähtavuse augud; toodangus timer TÖÖTAB (uus runtime-fakt).

## 6. U1 sihtarhitektuur

### 6.1. Kolm varianti

**A — laienda ainult NotificationEventi.** Lisa väljad (workspaceKind/Id, actor, dismissedAt, meta) ja kirjuta rohkem tüüpe reconcilerisse.
**B — püsiv DomainEvent (tegevushetke outbox) + olemasolev NotificationEvent kasutajapõhise projektsiooni/delivery kihina.** Äritehing kirjutab DomainEventi SAMas tehingus; projektor tuletab adressaadid ja loob NotificationEventid (sama delivery, i18n, dedupe, timer); reconciler jääb üleminekuajal paralleelseks turvavõrguks olemasolevatele tüüpidele.
**C — täielik event-sourcing / universaalne sündmuslogi** (olekud tuletatakse sündmustest).

| Kriteerium | A | B | C |
|---|---|---|---|
| „Mis muutus?" tegevushetkel (U1-A2) | ✗ (skaneering ei näe üleminekuid) | ✓ | ✓ |
| Tööruumi timeline + kompass (U1-A3) | ✗ (kirje on kasutaja-, mitte ruumipõhine) | ✓ (DomainEvent on ruumi-/allikapõhine; N-kirjed jäävad kasutajapõhiseks) | ✓ |
| Mitu adressaati sama sündmuse pealt dubleerimata | osaliselt (iga adressaat = eraldi rida, allikas kaob) | ✓ (1 sündmus → n projektsiooni) | ✓ |
| Idempotentne + retry-kindel väljastus | olemas (dedupe) | ✓ (event.id → projektsiooni dedupeKey; delivery muutumatu) | ✓ |
| Kanalite lisamine (push/digest) | keskmine | ✓ (uus projektsioon sama sündmuse pealt) | ✓ |
| Ehitus- ja opsirisk | madal, AGA jätab U1-A2/A3 lahendamata → iga tulevane ruum põrkub uuesti | **keskmine-madal**: 1 uus tabel + 1 helper + projektor; olemasolev konveier SÄILIB muutmata | kõrge; olekute tuletamine nõuaks kõigi moodulite ümberkirjutust — anti-lukustuse rikkumine |
| Kooskõla „väldi event-sourcing'u platvormi" nõudega | ✓ | ✓ (sündmus on TEADE, mitte tõeallikas; olek jääb mooduli tabelisse) | ✗ |

**Valik: B (minimaalne).** Ainuke variant, mis täidab kõik üheksa ülesande nõuet („mis muutus / mida pean tegema / kes näeb / kuhu viib / kas tehtud / kanalid / timeline / teavituskeskus / idempotentsus") ilma olemasolevat töötavat konveierit asendamata. Kriitiline disainipiirang: **DomainEvent on teavituslik fakt (notification of record), MITTE tõeallikas** — mooduli tabel jääb olekuks; sündmuse kaotus ei tohi kunagi rikkuda äriloogikat (see hoiab meid event-sourcing'ust eemal).

### 6.2. Komponendid ja andmevoog

```
äritehing (nt updatePreInquiryReceiverWorkflow TX)
  └─ emitDomainEvent(tx, envelope)          # SAMA tehing = outbox-garantii
DomainEvent (uus tabel; append-only)
  └─ projektor (jobs/notifications laiendus; iga ~5 min olemasoleva timeriga)
       ├─ recipientResolver(event) → [userId]   # registripõhine, õiguskontrolliga
       ├─ NotificationEvent upsert (dedupeKey = type:eventId:userId)  # OLEMASOLEV tabel
       └─ (hiljem) teised projektsioonid: digest, push, org-koond
NotificationEvent → olemasolev delivery (e-post) + uus /api/notifications UI (U1-P1)
DomainEvent (workspaceRef-iga) → tööruumi timeline / kompassi „mis muutus" (U1-P2)
```

Üleminekustrateegia: reconciler JÄÄB tööle olemasoleva 9 tüübi jaoks; uued sündmused tulevad ainult outbox-rajalt; tüüp migreerub reconcilerist outbox'i alles siis, kui tema tekitaja-tehing emiteerib (paarisnädalane dual-run, dedupeKey kaitseb topelt-teavituse eest, sest projektor kasutab SAMA type:sourceId:userId ruumi — vt 9. ptk detail). Rollback = projektori väljalülitus; reconciler katab vana käitumise edasi.

### 6.3. Sündmuse envelope (normatiivne)

| Väli | Tüüp/sisu | Märkus |
|---|---|---|
| `id` | cuid | idempotentsuse juur |
| `type` | string registrist (ptk 7), nt `pre_inquiry.status_changed` | rakenduskihi konstant, MITTE PG-enum |
| `version` | int (tüübi skeemi versioon), algul 1 | payload-metadata muutused tõstavad |
| `occurredAt` | DateTime | äritehingu hetk |
| `actor` | `{kind: "user"|"system"|"job", id?}` | KES tegi; system/job inimeseta radadele (timer, retention) |
| `source` | `{feature, resourceType, resourceId}` nt `{preInquiries, PRE_INQUIRY, id}` | = tänase sourceType/sourceId üldistus |
| `workspace` | `{kind, id}` VÕI null | K1 WorkspaceRef (4.1); null ruumita sündmustel (konto) |
| `audienceRule` | string registrist: `owner`, `author`, `recipient_owner`, `participants`, `participants_except_actor`, `reviewer`, `explicit:[ids]` | adressaadi REEGEL, mitte lahendatud loend — õigus kontrollitakse projektsioonil JA lugemisel (säilitame re-verify tugevuse) |
| `visibilityClass` | `personal` \| `workspace` \| `admin_ops` | kes tohib sündmust timeline'is näha; org-koond EI OLE klass (arvutatakse alati agregaadina) |
| `action` | `{kind, target}` registrist (ptk 8), nt `{open_workspace, "covision_case:…"}` | deep-linki TÜÜP; URL EI salvestu |
| `idempotencyKey` | string `type:resourceId:discriminator` @unique | nt `pre_inquiry.status_changed:ID:ARCHIVED:2026-07-17T…` — tehingu kordus ei loo topelt |
| `retentionClass` | `standard90` \| `short30` \| `audit_long` | cleanup-job loeb seda |
| `meta` | Json, AINULT lokaliseeritav/struktuurne miinimum: olekukoodid, kuupäevad, loendurid, labelKey-viited | **vabateksti keeld (6.4)** |

### 6.4. Payload-privaatsuse reegel (normatiivne, absoluutne)

Sündmuse `meta` EI TOHI vaikimisi sisaldada: vestluse sisu, dokumendi sisu/pealkirja vabateksti, kriisi-/juhtumiandmeid, kolmanda isiku andmeid, vaba teksti üldse. Lubatud: enum-koodid, ID-d, kuupäevad, arvud, i18n-võtmed. Kasutaja OMA pealkirja näitamine teavituses lahendatakse LUGEMISHETKEL allikast (join sourceId kaudu + õiguskontroll), mitte payload'i kopeerimisega — nii ei teki „külmutatud leket" pärast tagasivõttu/kustutust (tänase sisuta-kirja põhimõtte üldistus). Erandid (nt kutse saaja e-post süsteemsel rajal) nõuavad registrikirjes eksplitsiitset `piiFields` deklaratsiooni + põhjendust.

## 7. Sündmuste kanooniline kataloog (V1 registri sisu)

Veerud: tootja (kus tehingus emit toimub) · adressaadireegel · minimaalne meta · kanal (T=timeline, N=in-app teavitus, ✉=e-post poliitikaga) · action (ptk 8) · dedupe/idempotentsus · lõpetamine (ack) · retention · privaatsusrisk. Kõik tüübid on rakenduskihi konstandid; ükski meta ei sisalda vabateksti (6.4).

**7.1. Tööruumi elutsükkel** (`workspace.*` — iga K1 adapter)

| Tüüp | Tootja | Adressaat | Meta | Kanal | Action | Dedupe | Ack | Retention | Risk |
|---|---|---|---|---|---|---|---|---|---|
| created | loomistehing | owner (timeline-only; teavitust EI — tegija ise) | kind | T | open_workspace | type:id | — | standard90 | madal |
| activated | DRAFT→ACTIVE | participants_except_actor | — | T,N | open_workspace | type:id | readAt | standard90 | madal |
| phase_changed | faasivärava tehing (nt COMPLETE_STAGE) | participants_except_actor | stageFrom/To, phaseKey | T,N(koond: mitte igast faasist — registris `notifyOn:[gate]`) | open_workspace | type:id:stageTo | readAt | standard90 | madal (koodid) |
| closed | sulgemistehing (nt closure-TX) | participants_except_actor | purge:boolean | T,N,✉OPT | open_workspace (arhiivivaade) | type:id | readAt | standard90 | madal |
| archived / deleted | arhiveerimis-/kustutustehing | participants_except_actor; deleted → KA auditiklass | — / auditmeta (memberCount jm) | T / audit | open_list | type:id | — | standard90 / audit_long | deleted: KÕRGE kui meta liiga rikas — ainult arvud |

**7.2. Järgmine tegevus** (`workspace.next_action_*` — NEXT_CONTACT_DUE üldistus)

| Tüüp | Tootja | Adressaat | Meta | Kanal | Action | Dedupe | Ack | Retention | Risk |
|---|---|---|---|---|---|---|---|---|---|
| set/changed | tegevuse määramise tehing | responsible (kui ≠ actor) | dueOn | T | open_workspace | type:id:dueOn | readAt | short30 | madal |
| due | taimer-projektor (kuupäev saabus; tallinnDate muster) | responsible | dueOn | N,✉OPT | open_workspace | type:id:dueOn (tänane muster) | allika olekumuutus (kuupäev edasi → vana tühistub; olemasolev käitumine säilib) | short30 | madal |

**7.3. Osalejad** (`participant.*`)

| Tüüp | Tootja | Adressaat | Meta | Kanal | Action | Dedupe | Ack | Retention | Risk |
|---|---|---|---|---|---|---|---|---|---|
| invited | kutsetehing | kutsutu (kui konto olemas; e-postita kutse jääb ✉-otsekirjale nagu täna) | roleKey, expiresAt | N (+ senine kutsekiri jääb) | open_invite | invite.id | liitumine/keeldumine/aegumine (re-verify kaotab) | short30 | keskmine: kutsutu e-post EI lähe meta'sse |
| joined | liitumistehing | owner (+moderaatorid) | roleKey | T,N | open_workspace | invite.id:userId | readAt | standard90 | madal |
| left / removed / withdrawn | lahkumis-/eemaldustehing | owner; removed → KA eemaldatu; withdrawn → owner+responsible | roleKey, reasonKey? (enum!) | T,N | open_workspace | type:memberId | readAt | standard90 | keskmine: reason AINULT enum |
| owner_changed [TULEVIK U11] | üleandmistehing | mõlemad pooled + osalejad | — | T,N,✉OPT | open_workspace | type:id:newOwnerId | uus omanik kinnitab | standard90 | madal |

**7.4. Nõusolek** (`consent.*`)

| Tüüp | Tootja | Adressaat | Meta | Kanal | Action | Dedupe | Ack | Retention | Risk |
|---|---|---|---|---|---|---|---|---|---|
| granted | nõusolekutehing (nt CallRecordingConsent, anonymity) | taotleja/owner | consentKind (enum) | T | open_workspace | consent.id:granted | — | audit_long | madal |
| withdrawn | tagasivõtutehing | owner + asjaosalised, kelle töö sellest sõltub | consentKind | T,N | open_workspace | consent.id:withdrawn | **kohustuslik jõustamiskontroll MOODULI tehingus** — U1 sündmus on TEADE, mitte jõustaja; FAILID F-01 (ACTIVE-salvestuse tagasivõtt ei peata egressi) jääb mooduli parandada ja U1 EI tohi luua illusiooni, et „teavitatud = peatatud" | audit_long | KÕRGE tähelepanu: kind on enum, konteksti ei kanta |

**7.5. Artefaktid ja kokkulepped** (`artifact.*`)

| Tüüp | Tootja | Adressaat | Meta | Kanal | Action | Dedupe | Ack | Retention | Risk |
|---|---|---|---|---|---|---|---|---|---|
| created/confirmed | artefaktitehing | owner (timeline); confirmed + vajab kinnitust → kinnitajad (N) | artifactKind, versionNo | T(,N) | open_artifact | artifact.id:status | kinnitusotsus | standard90 | madal |
| shared | jagamistehing (nt U10 room-share; PreInquiry SENT) | adressaadid (audienceRule allika järgi) | artifactKind | T,N(,✉ allika poliitika) | open_shared_copy | artifact.id:targetRef | readAt/avamiskviitung allikas | standard90 | keskmine: sisu EI KUNAGI meta's; U10 saab siit ka puuduva auditikirje (RUUM-A0 8 K2) |
| revoked/superseded | tagasivõtu-/parandustehing | adressaadid | supersededBy? id | T,N | open_shared_copy (kadunu → selgitusvaade, ptk 8.4) | artifact.id:revoked | readAt | standard90 | madal |
| approval_pending | kinnitusvoo tehing (nt SupervisionSummary PENDING_APPROVAL [haru]; kohtumise kokkuvõte U10-järgselt) | kinnitajad | artifactKind | N,✉OPT | open_artifact | artifact.id:vN:pending | kinnitusotsus (approved/discarded) | short30 | madal |

**7.6. Suhtlusreaktsioon** (`message.needs_reaction`) — V1: AINULT olemasoleva ROOM_ACTIVITY üldistus (6h-akna koond; badge õigesse kohta U1-P2-s); „märgi vajab-vastust" lipp on [TULEVIK] (nõuab UI-d ja väärkasutuse analüüsi). Dedupe: roomWindow-muster. Risk: madal (loendur, mitte sisu).

**7.7. Eelpöördumine** (`pre_inquiry.*` — olemasolevate tüüpide outbox-migratsioon)

| Tüüp | Tootja | Adressaat | Meta | Kanal | Action | Dedupe | Ack | Retention | Risk |
|---|---|---|---|---|---|---|---|---|---|
| sent (=ARRIVED) | sendPreInquiry TX | recipient_owner | — | N (✉ jääb tänasele sisuta otsekirjale, topelt väldib NONE) | open_pre_inquiry_received | id:sentAt (sama mis täna) | accept/avamise fakt | standard90 | madal (sisuta) |
| opened / replied(correction/room) / archived | workflow-/correction-/room-TX | author | statusKey | N,✉OPT (tänane) | open_my_sharings VÕI open_pre_inquiry_sent | id:status:updatedAt (tänane) | readAt | standard90 | madal |
| recalled | recallPreInquiry TX | recipient_owner (**UUS — täna recall lihtsalt kaotab kirjed vaikselt**) | — | N | open_pre_inquiry_received (kadunu → ptk 8.4 selgitus) | id:recalledAt | readAt | short30 | madal; U3 paketi eeldus |

**7.8. Help** (`help.*`): match_created (tänane, outbox'i pärast Help-adapterit) — adressaat: mõlemad pooled; action open_room. UUS: listing_expiring/expired (taimer; owner; dedupe id:expiresAt; action open_listing) ja match_closed [TULEVIK koos Help V3–V5 otsustega]. Risk: madal — kuulutuse pealkirja meta'sse EI panda (avalik projektsioon on eraldi leping).

**7.9. Tööheaolu** (`wellbeing.weekly_checkin_due`) [TO-2 otsuse järel]: taimer-tootja; adressaat AINULT owner; meta: weekKey; kanal N (✉ ainult kasutaja opt-in'iga); action open_wellbeing; dedupe userId:weekKey; ack = nädala kirje loomine VÕI dismiss; retention short30; risk: sündmuse OLEMASOLU ütleb „kasutab Tööheaolu" — nähtav AINULT kasutajale endale; EI KUNAGI ühtegi koond-/org-projektsiooni üksikkirjena (arhitektuuriline keeld).

**7.10. Kovisioon/Supervisioon kohtumised ja väljundid** (`meeting.upcoming`, `output.pending`): järeltegevuse `scheduledFor`/kohtumise aeg → taimer-projektor; adressaat participants/responsible; meta: dateOn; action open_workspace; dedupe id:dateOn; ack: toimumine/otsus; retention short30. Kovisiooni 4 esimest sündmust (invited/phase gate/closed/follow_up.due) tulevad KOV-U1 adapteripaketiga; SUP omad SUP-U1-ga [haru merge järel].

**7.11. Konto/retention** (`account.*`): retention_action_required, deletion_started/completed, data_export_ready [TULEVIK] — actor: system; adressaat owner; kanal N,✉TRANSACTIONAL (ainus perekond, kus e-post on kohustuslik klass); action open_profile; dedupe jobId; retention audit_long; risk: meta ainult koodid. Kriisirada (VEST) EI OLE U1 perekond — kriisisignaale ei kanaliseerita teavitusteks ilma eraldi analüüsita (keelatud skoobilaiendus, ptk 12).

## 8. Deep-link ja tegevuse terviklus (TÖÖLAUD-P1 seos)

### 8.1. Kanooniline action-register

Uus `lib/actions/registry.js`: `action.kind → { route(target), paramReader, accessCheck }`. V1 kirjed (kaardistavad TÄNASE targetHref-i + parandavad P1-1/P2-2 augud):

| action.kind | Route | Tänane seis → nõue |
|---|---|---|
| open_pre_inquiry_received / _sent | `/eelpoordumised?openInquiry=ID` | loetakse; fallback toetab ainult autorit (P2-2) → fallback aktsepteerib ka `recipientOwnerId` (TÖÖLAUD-P1 punkt 3) |
| open_room | `/vestlus?roomId=ID` | töötab |
| open_practice | `/parimad-praktikad?practice=ID` | **parameetrit ei loe ükski komponent (P1-1)** → EffectivePracticesPage loeb mount'il (TÖÖLAUD-P1 punkt 2) |
| open_journey | `/teekond/ID` | continuity link on `?journey=` (surnud) → marsruut `/teekond/[id]` on OLEMAS, kasuta seda (TÖÖLAUD-P1 punkt 1) |
| open_service_profile | `/teenuseprofiil` | parameeter ignoreeritakse, tulemus juhtumisi õige — registrisse ilma parameetrita |
| open_workspace | adapteri kaudu kind→route | UUS (K1) |
| open_my_sharings / open_wellbeing / open_listing / open_invite / open_profile / open_list | olemasolevad lehed | UUS registikirjed, marsruudid olemas |

**Reegel:** sündmus/teavitus salvestab AINULT `{action.kind, target}`; URL ehitatakse LUGEMISHETKEL registrist. Marsruudimuutus = 1 registirea muutus, mitte katkised ajaloolised kirjed (parandab U1-A5 juurpõhjuse). `targetHref` (lib/notifications.js:92) muutub registri õhukeseks kihiks; olemasolevad NotificationEvent read EI vaja migratsiooni (targetKind/targetId JUBA ON {kind,target} paar).

### 8.2. Õiguse kontroll kliki hetkel

Kolm kihti (kaks esimest on JUBA OLEMAS, kolmas lisandub):
1. loomisel — audienceRule + assertNotificationRecipient muster;
2. loendi lugemisel — re-verify (tagasivõetud/õiguseta kirjed EI VÄLJU; tänane tugevaim omadus, säilib);
3. sihtlehe avamisel — lehe OMA omaniku-skoobitud päring (404 võõrale) — st katkine/aegunud link EI leki kunagi sisu; registri `accessCheck` on ainult UX-i (selgitustekst), MITTE turvapiir.

### 8.3. Kustutatud/arhiveeritud/õiguse kaotanud ressurss

| Seisund | Teavituskeskus | Timeline | Sihtleht |
|---|---|---|---|
| Allikas kustutatud/tagasivõetud | rida kaob (re-verify — tänane) | kirje jääb, märgis „pole enam saadaval" (halliks; ilma sisuta) | loendivaade + i18n selgitus `actions.target_gone` |
| Arhiveeritud | rida jääb readAt-ni; action viib arhiivivaatesse | tavaline | arhiivivaade |
| Õigus kadunud (lahkus ruumist) | rida kaob (re-verify) | tema PERSONAALNE timeline säilitab fakti („lahkusid ruumist X" — workspace-timeline talle enam ei avane) | 404 (olemasolev) |

### 8.4. Katkiste `?practice=`/`?journey=` laadsete linkide vältimine edaspidi

Registri lisanõue: iga action.kind deklareerib `paramReader` (komponent+parameeter, mis teda loeb) ja CI-tasemel leping-test kontrollib, et (a) registri route'i marsruut eksisteerib `app/` all, (b) paramReader-komponendis on parameetri lugemise test (TÖÖLAUD-P1 testimuster). „Katteta lubadus" muutub testivea, mitte kasutajakogemuse küsimuseks.

### 8.5. Tegevuse lõpetatuks märkimine (ack-semantika)

Registri `ackMode`: `read` (readAt piisab) | `target_open` (sihtlehe avamine PATCH-ib allika kaupa loetuks — ruumi read-route'i muster üldistatakse) | `source_resolved` (allika olekumuutus kaotab kirje — NEXT_CONTACT muster) | `explicit` (dismiss/otsus — uus `dismissedAt`). Iga ptk 7 rida määrab ühe. UI näitab „tehtud" AINULT ack-tingimuse, mitte kliki järgi.

### 8.6. Sama sündmus kolmel pinnal dubleerimata

ÜKS DomainEvent → kolm ERI projektsiooni, mitte kolm koopiat: (1) teavituskeskus loeb NotificationEventi (kasutajapõhine, ack-iga); (2) tööruumi timeline loeb DomainEventi workspaceRef-i järgi (osaleja-õigusega); (3) töölaua badge = lugemata N-ide loendur badgeKey kaupa (continuity badge-allikas asendub selle SAMAGA alles U1-P2-s — enne jäävad mõlemad, sest continuity kannab ka mitte-sündmuselisi kirjeid nagu DRAFT-id). Dedupe on tagatud, sest kõik kolm tuletuvad samast event.id-st.

## 9. Tehniline leping Sol/Codexile (rakendusvalmis; koodi siin EI kirjutata)

### 9.1. Prisma muudatused (1 uus mudel + 4 lisavälja; PG-enum'e EI lisata)

**UUS `DomainEvent`** (prisma/schema.prisma, NotificationEventi kõrvale):
- väljad: `id` cuid PK; `type` String; `version` Int @default(1); `occurredAt` DateTime; `actorKind` String; `actorUserId` String? (FK User, onDelete: SetNull); `sourceFeature` String; `sourceType` String; `sourceId` String; `workspaceKind` String?; `workspaceId` String?; `audienceRule` String; `audienceHint` Json? (AINULT explicit-ID-de jaoks); `visibilityClass` String @default("personal"); `actionKind` String; `actionTarget` String; `idempotencyKey` String @unique; `retentionClass` String @default("standard90"); `meta` Json?; `projectedAt` DateTime?; `createdAt` DateTime @default(now()).
- indeksid: `@@index([projectedAt, id])` (projektori järjekord); `@@index([workspaceKind, workspaceId, occurredAt])` (timeline); `@@index([sourceType, sourceId, occurredAt])`; `@@index([retentionClass, occurredAt])` (cleanup); `@@index([actorUserId, occurredAt])` (kustutus/audit).
- TEADLIKULT ILMA: FK-d source'ile/workspace'ile (moodulipiir), userId-adressaadita (adressaat elab projektsioonis).

**`NotificationEvent` lisaväljad (kõik nullable — migratsioon backfill'ita):** `eventId String?` (+ `@@index([eventId])`; SIDE, mitte FK-kaskaad — event võib elada kauem), `dismissedAt DateTime?`, `workspaceKind String?`, `workspaceId String?`; uus indeks `@@index([userId, dismissedAt, readAt, createdAt])` keskuse loendile.

Migratsioon: `prisma/migrations/<ts>_u1_domain_event_outbox/migration.sql` — ainult CREATE TABLE + ALTER ADD COLUMN (nullable) + indeksid; **rollback = DROP TABLE + DROP COLUMN, andmekadu piirdub uue kihiga; ühtegi olemasolevat rida ei muudeta.**

### 9.2. Serveriteenused (uued failid)

| Fail | Vastutus |
|---|---|
| `lib/events/registry.js` | ptk 7 kataloog koodis: `EVENT_TYPES` + per-tüüp `{audienceRule, visibilityClass, actionKind, retentionClass, emailPolicy, labelKey, ackMode, notifyOn?}`; valideerib meta-võtmed whitelist'iga (6.4 jõustamine — vabatekstivälja registrisse lisada EI SAA ilma `piiFields` deklaratsioonita) |
| `lib/events/emitDomainEvent.js` | `emitDomainEvent(tx, input)` — AINULT tehingu sees (nõuab tx-klienti parameetrina, nagu covision-teenused); ehitab envelope'i registrist, arvutab idempotencyKey, `create` + unique-püüe (nagu createNotificationEvent :200–243 muster); EI tee HTTP-d/e-posti/Redist |
| `lib/events/recipients.js` | `resolveRecipients(event, {db})` — audienceRule → userId[] KOOS õiguskontrolliga (assertNotificationRecipient üldistus; owner/author/recipient_owner/participants(_except_actor)/reviewer/explicit) |
| `lib/events/projector.js` | `projectDomainEvents({db, now, batchSize, cursor})` — `projectedAt: null` järjekorras; iga event → resolveRecipients → NotificationEvent upsert'id (`dedupeKey = type:sourceId:userId:suffix` — **SAMA nimeruum mis reconcileril, et dual-run EI dubleeriks**); märgib `projectedAt` ka 0 adressaadiga; lehekülgedena nagu reconciler |
| `lib/actions/registry.js` | ptk 8.1 tabel koodis; `buildActionHref(kind, target)`; `lib/notifications.js targetHref` delegeerib siia (käitumine identne — olemasolevad testid EI muutu) |
| `lib/workspaces/registry.js` + `lib/workspaces/descriptor.js` | K1: WorkspaceKind register + WorkspaceDescriptor JSDoc-typedef + valideerija |
| `lib/workspaces/adapters/covisionAdapter.js`, `roomAdapter.js` | K1-P0 kaks read-adapterit: omaniku-/osaleja-skoobitud `listWorkspaces(userId)` → descriptor[] (Kovisioon: case+sessionState+closure→lifecycle/phase/nextAction; Room: liikmesus→SHARED_PARTICIPANTS, elutsükli auk descriptor'is `lifecycle:"ACTIVE"` konstantne — aus piirang) |

Outbox'i piir: emit AINULT äritehingus; projektor AINULT jobs-rajal; kanaleid (e-post) puudutab AINULT olemasolev `notificationDelivery.js` (muutmata); roomStream/Redis jääb efemeerseks UI-kanaliks ega kanna DomainEventi (teadlik piir — reaalajateavitused on [TULEVIK], mitte U1-P0..P2).

### 9.3. API ja UI

| Koht | Muudatus |
|---|---|
| `app/api/jobs/notifications/route.js` | lisa projektorileht reconcile'i ja delivery vahele (sama võti, sama timer — **ops-muudatust EI VAJA, toodangu 5-min timer katab**); vastusesse `projected{…}` loendurid |
| `app/api/notifications/route.js` | GET: + `dismissed` filter, + workspaceKind/actionKind väljad vastuses; PATCH: + `dismiss` operatsioon (dismissedAt) |
| UUS `app/api/workspaces/route.js` (U1-P2/K1 tarbija) | GET: adapterite liitloend (descriptor[]) — töölaua/kompassi jaoks |
| UUS `app/api/workspaces/[kind]/[id]/events/route.js` (U1-P2) | GET: DomainEvent timeline; õigus adapteri accessCheck'iga (osaleja); visibilityClass filter |
| UI (U1-P1) | minimaalne teavituskeskus: loend + loetuks/dismiss + badge; asukoht töölaua paneelis (mitte uus leht); kasutab olemasolevat `notifications.events.*` i18n-t |

### 9.4. i18n-võtmete leping

- Uued sündmusetüübid: `notifications.events.<type_snake>` KÕIGIS kolmes failis samas PR-is (i18n:check nõuab et-pariteeti — test-infra reegel); `workspace.lifecycle.*`, `workspace.kind.*`, `actions.target_gone`.
- Registri labelKey on kohustuslik väli — tüüpi ilma tõlkevõtmeta lisada ei saa (registri validaator).
- DB-sse EI lähe ühtegi tõlgitavat stringi (P2-6 õppetund).

### 9.5. Retention, cleanup, konto kustutamine

- `lib/retention.js` sweep'i lisa: `domainEvent.deleteMany({retentionClass:"short30", occurredAt < now-30p})`, `standard90` 90p, `audit_long` = LOG_RETENTION_DAYS loogika; NB sweep on täna laisk-throttle (FAILID F-06) — U1 EI paranda seda üksi, aga registrisse läheb TODO-viide OPS-FINAL-A0 väravale.
- `lib/privacy/userDeletion.js`: lisa samm — `notificationEvent` kustub kaskaadiga (olemas); `domainEvent`: actorUserId → SetNull automaatselt; LISAKS kustuta read, kus `visibilityClass="personal"` JA sourceId kuulub kustutatava allikaridadele (mooduli kustutussammuga samas job'is); workspace-klassi read jäävad (osalejate ajalugu; „autor kustutatud" markeriga UI-s).

### 9.6. Observability ja opsid

- jobs-route vastuse loendurid (+projected) logitakse juba journald'i kaudu (timer — runtime-tõendatud); lisa `truncated`-hoiatuse tõstmine console.error'iks.
- Admin-loend UNKNOWN/FAILED e-kirjadele + requeue (TÖÖLAUD P2-4 sulgemine) — U1-P1 osa, fail `app/api/admin/notifications/route.js` (admin-guard nagu admin-analytics väravad).
- Dual-run pariteedimõõdik: projektori loodud vs reconcileri loodud (created/existing suhe) — nähtav jobs-vastusest; migratsiooniotsus tüübi kaupa selle pealt.

### 9.7. Testistrateegia (repo konventsioonid: node:test, süstitud fake-db, EI elavat DB-d)

- `tests/events/registry.test.js` — registri terviklus: iga tüüp → labelKey olemas kolmes keeles (loe messages/*.json), actionKind registris, meta-whitelist.
- `tests/events/emitDomainEvent.test.js` — tx-nõue, idempotencyKey kordus → existing, meta-vabateksti reject.
- `tests/events/projector.test.js` — audienceRule'id fake-db-ga; dedupe reconcileriga SAMAS nimeruumis (simuleeri mõlemad — 0 duplikaati); 0-adressaadiga event märgitakse projected.
- `tests/events/actionsRegistry.test.js` — iga registri route eksisteerib `app/` all (fs-kontroll) + href-leping (olemasoleva workspaceContinuity href-testi laiendus).
- `tests/workspaces/adapters.test.js` — descriptor-leping mõlemale adapterile; võõra kasutaja 0 rida.
- Migratsioonikontroll: `npm run db:migrate:check` (localhost Postgres); täissviit `npm test` + `npm run i18n:check`.

### 9.8. Migratsiooni- ja backfill-plaan + rollback

- **Backfill: EI OLE.** DomainEvent algab deploy'st; timeline on aus („sündmused alates <kuupäev>"); NotificationEventi uued veerud jäävad vanadel ridadel null (UI käsitleb). See on teadlik väikseima riski valik — ajaloo rekonstrueerimine olekust oleks valetamine tegevushetke kohta.
- Lülitid: `U1_OUTBOX_ENABLED` (emit no-op kui väljas — helper tagastab vaikselt; äritehing EI katke), `U1_PROJECTOR_ENABLED`. Rollback-astmed: (1) projektor välja → reconciler katab vanad tüübid, uued sündmused kogunevad projekteerimata (kahjutu); (2) emit välja → süsteem = tänane seis; (3) täisrollback = migratsiooni DROP (9.1, andmekadu ainult uues kihis).

## 10. Paketistus

### K1-P0 — normatiivne tööruumileping ja adapteripiir
- **Eesmärk:** ptk 4 leping koodis kontrollitavaks: registry + descriptor + 2 read-adapterit (Kovisioon=doonor, Room=üldpind) + leping-testid. **Skeemimuudatust EI OLE.**
- Sõltuvused: O-K1-1 (sõnastiku kinnitus). Failid: `lib/workspaces/registry.js`, `descriptor.js`, `adapters/covisionAdapter.js`, `adapters/roomAdapter.js`, `tests/workspaces/*`. Testid: adapterite leping + võõra-kasutaja-0-rida + descriptor-validaator. Runtime-smoke: tsx-skriptiga adapteri väljakutse seed-kasutajal (admin-login retsept memory's). Vastuvõtt: mõlemad adapterid tagastavad kehtiva descriptor'i; `npm test` + `i18n:check` rohelised; ühtegi olemasolevat faili peale testide ei muudeta (v.a võimalik lib/index eksport). Audititase: Soli tehniline kontroll (read-only kiht, madal risk; Opust ei vaja). Rollback: failide eemaldus. **Välja jääb:** UI, descriptor'i kuvamine, Journey/Wellbeing adapterid, igasugune jõustamine.

### U1-P0 — minimaalne püsiv sündmus/outbox + üks vertikaal
- **Vertikaali valik.** Võrdlus (ülesande kolm kandidaati):

| Kriteerium | Eelpöördumise staatusemuutus | Tööheaolu nädalarütm | Kohtumise kokkuvõtte kinnitamine |
|---|---|---|---|
| Tõendab tx-emiti (outbox'i tuuma) | ✓ (workflow-TX on olemas, CAS-iga) | ✗ (taimer-tootja, mitte äritehing) | ✓ (U10 TX) |
| UUS andmekategooria/privaatsusrisk | **0** — sama tüüp, sama sisutu payload JUBA eksisteerib toodangus | UUS kategooria („kasutab Tööheaolu" + rütm) | UUS adressaatide ring (ruumi liikmed) |
| Blokeeriv tooteotsus | puudub | TO-2 (rütmi vaikeseade) — LAHTINE | kinnituse kohustuslikkus — LAHTINE |
| Pariteedikontroll võimalik | ✓ — reconciler toodab SAMA tüüpi; dual-run mõõdab 1:1 | ✗ (võrdlusalust pole) | osaline (ROOM_ACTIVITY kattub) |
| Ahela täielikkus (emit→project→deliver→ack) | täielik (OPTIONAL e-post + readAt + allika-resolved) | täielik miinus emit | täielik |

  **Valik: eelpöördumise staatusemuutus** — ainus, mis tõendab KOGU ahela nulli uue andme- ja privaatsusriskiga ning ilma lahtise tooteotsuseta; boonusena annab mõõdetava pariteedi (reconciler vs outbox). Tööheaolu rütm → U1-P3+TO-2 järel; kokkuvõtte kinnitamine → artifact.approval_pending KOV/SUP adapterite lainega.
- **Sisu:** 9.1 migratsioon; `lib/events/{registry,emitDomainEvent,recipients,projector}.js`; emit-punktid `lib/preInquiries.js` workflow-TX-i (opened/READY/ARCHIVED) ja recall-TX-i (`pre_inquiry.recalled` — UUS tüüp, N-kanal vastuvõtjale); jobs-route projektorileht; lülitid.
- Sõltuvused: O-U1-1, O-U1-2; K1-P0 EI blokeeri (workspace-väli võib olla null), aga soovitatavalt enne (kind-sõnastik). Testid: 9.7 kolm esimest + preInquiries olemasolev sviit puutumata. Runtime-smoke: lokaalne workflow-PATCH → DomainEvent rida + projektor dry-run → dedupe existing (mitte created) olemasoleva reconciler-kirje vastu; `npm run notifications:dispatch` dryRun. Vastuvõtt: dual-run ≥1 nädal ilma ühegi duplikaat-teavituseta (dedupe existing-loendur), recall-teavitus jõuab vastuvõtjani, rollback-lülitid töötavad. Audititase: **Opuse sõltumatu audit** (uus püsiv andmekiht + privaatsuspind — kõrge risk klassifikatsioonilt, kuigi payload on tühi). Rollback: 9.8. **Välja jääb:** UI, uued perekonnad peale pre_inquiry, e-posti sisumuutused, continuity muutmine.

### U1-P1 — notification projection ja teavituskeskuse minimaalne API/UI
- Sisu: NotificationEvent lisaväljad (9.1) + GET/PATCH laiendus + minimaalne keskus töölauapaneelis + dismiss + admin UNKNOWN/FAILED loend+requeue (P2-4) + P1-2 sulgemine (autori STATUS_CHANGED muutub nähtavaks). Sõltuvused: U1-P0; TÖÖLAUD otsus 2 (kuju). Failid: 9.3 read + `components/workspace/NotificationCenter.jsx` (uus) + messages/*. Testid: route-leping + UI-leping (workspaceContinuityUi mustri järgi). Smoke: keskuses kuvatakse pre_inquiry read; dismiss püsib. Vastuvõtt: P1-2 stsenaarium suletud (autor näeb „avati/arhiveeriti" ilma e-postita). Audititase: Sol + Fable ristkontroll (UI, keskmine). Rollback: UI-lipp; API-väljad jäävad (kahjutud). Välja jääb: push, digest, continuity asendus.

### U1-P2 — töölaud/timeline/deep-link registry
- Sisu: `lib/actions/registry.js` + targetHref delegeerimine + TÖÖLAUD-P1 kolm parandust (KUI veel tegemata — koordineeri, et mitte dubleerida) + 8.4 leping-test + workspace-timeline API + kompassi/töölaua „mis muutus" feed (descriptor+events) + badge'ide ümberjuhtimine (P2-3 õige kodu). Sõltuvused: U1-P0/P1, K1-P0. Vastuvõtt: kõik ptk 8.1 action'id läbivad leping-testi; timeline kuvab pre_inquiry+workspace sündmused õigusfiltriga. Audititase: Sol. Välja jääb: uute moodulite adapterid.

### U1-P3 — e-post/push/eelistused/digest
- Sisu: per-perekond kanalieelistused (praeguse ühe checkboxi asemel), digest-job, push-otsus [DECISION], wellbeing.weekly (TO-2 järel), kutse-/availability-otsekirjade konsolideerimise ANALÜÜS (mitte automaatne muutmine — kasutajalubadused). Sõltuvused: U1-P1. Audititase: otsustatakse sisu järgi.

### Funktsioonipõhised adapterid (eraldi hilisemad paketid)
`KOV-U1` (4 sündmust: participant.invited, phase gate'id notifyOn, closed, follow_up.due) → `ROOM-U1` (elutsükkel + kustutuse auditisündmus — RUUM 16 K4 sulgemine; kustutusreegli otsuse järel) → `SUP-U1` [pärast SUP-P0 push+audit+merge] → `DOC-U1` (artifact.shared + U10 audit — RUUM 8 K2) → `HELP-U1` (listing expiry) → `TH-U1` (TO-2 järel). Igaüks: ainult emit-punktid + registrikirjed + testid; projektor/UI EI muutu.

## 11. Otsused ja soovitus

### 11.1. Blokeerivad (enne K1-P0 / U1-P0)

| ID | Otsus | Variandid | Soovitus | Mõju | Viimane hetk |
|---|---|---|---|---|---|
| O-K1-1 | Kanooniline elutsüklisõnastik + WorkspaceKind registri esialgne loend (4.2.1/4.9) | (a) ptk 4 kuju; (b) muudatustega | (a) — ekstraktitud töötavast koodist | iga tulevane ruum kasutab; hilisem ümbernimetus = kõigi adapterite muutus | enne K1-P0 merge'i |
| O-U1-1 | Uue püsiva DomainEvent kihi loomine + retention-vaikeklassid (standard90/short30/audit_long) | (a) jah, 9.1 kuju; (b) ainult variant A (ilma outbox'ita) | (a) — variant A jätab U1-A2/A3 lahendamata | uus isikuandmete kandja (koodid+ID-d, sisuta); retention-klassid | enne U1-P0 migratsiooni |
| O-U1-2 | U1-P0 vertikaal | eelpöördumise staatus / TH rütm / kokkuvõtte kinnitus | eelpöördumise staatus (10. ptk võrdlus) | määrab esimese emit-punkti ja auditiskoobi | enne U1-P0 algust |

### 11.2. Pärast tehnilise aluse valmimist (EI blokeeri P0-sid)

teavituskeskuse kuju ja asukoht (TÖÖLAUD otsus 2 — enne U1-P1 UI-d); flow-päritolu ruumide kustutusreegel (RUUM 16 K2 — enne ROOM-U1/jõustamist; soovitus: arhiveeri+lahku, mitte hard-delete); ROOM-badge'i kodu (P2-3 — U1-P2); UNKNOWN-kirjade protseduur (P2-4 — U1-P1 admin-loend + käsitsi requeue piisab alguses); e-posti vaikeseade ja digest (U1-P3); RoomMessage autori-kaskaadi kandjareegel (FAILID tõend — enne K1 kandjamaatriksi jõustamist); omanikuvahetuse kinnitusreegel (U11); push-kanali lisamine.

### 11.3. Küsimused, mida EI TOHI lahendada vaikimisi tehnilise otsusena

1. **Org-nähtavus:** ükski üksikkasutaja sündmus ei jõua KUNAGI org-/tööandja-vaatesse; ainus lubatav kuju on k-anonüümne koond (Tööheaolu summutusmuster). See on arhitektuuriline keeld, mitte seadistus.
2. **Tööheaolu rütm ja igasugune „aktiivsuse" signaal** — TO-2 on tooteotsus; U1 ei tekita heaolusündmusi enne seda ka „tehniliselt lihtsa" lisana.
3. **Kriisiraja signaalid** — EI kanaliseerita teavitusteks/sündmusteks ilma eraldi kriisiohutuse analüüsita (VEST-raja piir).
4. **Teekonna sisu** (domains/riskSignals) ei liigu payload'i ega timeline'i — Teekond jääb privaatseks tuumaks; „jaga kogu Teekond" ei teki ühegi sündmuse kaudu.
5. **Kutse-/saabumis-e-kirjade sisupoliitika** (täna sisuta) — igasugune „rikkam kiri" on privaatsusotsus, mitte tehniline täiendus.
6. **Osaleja WITHDRAWN-panuse saatus** (kas tema varasem panus jääb ruumi) — moodulipõhine tooteotsus (SUP-i pretsedent tuleb SUP-P1-ga).

## 12. Lõppväljund

### 12.1. Ühe lehe juhtkokkuvõte

**Probleem.** Platvormil on 3 osalejasüsteemi, 1 faasimasin, 4 auditikihti, 3 e-kirjarada ja 0 tegevushetke sündmust — iga uus „ruum" (kompass, Tööheaolu tuba, SUP, võrgustik) põrkuks samade aukudega: kasutaja ei saa teada, mis muutus, ega leia järgmist tegevust.
**Lahendus kahes kihis.** **K1** = normatiivne tööruumileping (variant A: leping + read-adapterid olemasolevate mudelite kohal; supertabelit EI ehitata) — ekstraktitud Kovisiooni töötavast koodist, valideeritud SUP-V0 skeemi vastu [haru]. **U1** = variant B minimaalkujul: püsiv tegevushetke DomainEvent (outbox äritehingus) + OLEMASOLEV NotificationEvent/delivery projektsioonikihina (toodangu 5-min timer juba töötab — runtime-tõendatud 17.07) + action-register, mis teeb deep-lingid registripõhiseks (parandab „katteta lubaduste" klassi P1-1/P2-2).
**Esimene rakendusvalmis pakett: K1-P0** (migratsioonita, madal risk, kohe alustatav pärast O-K1-1). Järjestus: **K1-P0 → U1-P0 (eelpöördumise vertikaal, Opuse audit) → U1-P1 (teavituskeskus, P1-2 sulgemine)**.
**Blokeerivad otsused:** O-K1-1 (sõnastik), O-U1-1 (DomainEvent kihi luba + retention), O-U1-2 (vertikaal).
**Riskid ja keelud:** payload ilma vabatekstita (absoluutne); org ei näe üksiksündmusi KUNAGI; kriisirada ja Teekonna sisu on U1-st väljas; event-sourcing'ut ei ehitata (sündmus = teade, mooduli tabel = tõde); reconciler jääb turvavõrguks kuni tüübipõhise migratsioonini.

### 12.2. K1 ja U1 seos
K1 annab U1-le `workspace {kind,id}` viite ja kohustuslike sündmuste loetelu (4.8); U1 annab K1-le ajajoone, „mis muutus" ja teavituste kandevõime. Kumbki ei sõltu teise KOODIST: K1-P0 on skeemivaba; U1-P0 töötab ka null-workspace'iga. Koos moodustavad nad RUUM-VIS horisont B selgroo (B1+B2).

### 12.3. Täpne jätkamiskäsk Sol/Codexile
```
ÜLESANNE: K1-P0 (esimene pakett; U1-P0 alles pärast O-U1-1/O-U1-2 kinnitust)
Loe: docs/platvormi arendus/fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md ptk 4 (leping), 9.2 (failid), 10 (K1-P0 skoop+vastuvõtt).
Piirid: värske worktree origin/main pealt (fe4eb4fa või uuem); AINULT uued failid lib/workspaces/** ja tests/workspaces/**; prisma/, migrations/, olemasolevaid teenuseid EI puututa; npm test + npm run i18n:check rohelised; commit ilma push'ita, teata haru.
DoD: 2 adapterit tagastavad descriptor'i (fake-db testid); registri validaator keeldub tundmatust kind'ist; võõras kasutaja saab tühja loendi.
```

### 12.4. Jätkamispunkt tulevastele sisenditele (RUUM-VIS-A0, SUP, FAILID)
- **RUUM-VIS-A0:** ptk 5.2/5.4 „väikseim alus" read võib märkida täidetuks viitega SIIA (B1=U1 ptk 6–10; B2=K1 ptk 4); järgmine visioonisisend = kompassi feed (U1-P2 järel).
- **SUP:** kui SUP-P0 saab push+audit+merge, uuenda ptk 3 rida [haru]→[MAIN], lisa SUP-U1 adapteripakett (ptk 10) järjekorda ja täienda 4.2.1 kaardistust SUP-P1 PAUSED-olekuga.
- **FAILID:** F-01 (nõusoleku jõustamine) jääb mooduli P0-ks — U1 consent.withdrawn kirje viitab sellele, mitte ei asenda; artifact.* perekond ootab FAILID-P3 artefaktivisiooni sisendit.
- **Selle dokumendi uuendusreegel:** iga paketi valmimisel uuenda ptk 10 seisu ja Edenemistabelit; ära muuda ptk 1 lukustatud kontrolle — uus git-seis = uus kuupäevaga rida.

*(STATUS-rida dokumendi lõpus.)*

## Jätkamispunkt

- **Seis:** KÕIK 13 etappi TEHTUD (vt Edenemistabel); dokument on esimese täisringi järel COMPLETE ja jääb elavaks.
- **Kontrollitud allikad (17.07.2026):** git fetch + origin/main `fe4eb4fa` = server (SSH); lokaalne main 22 taga; SUP-P0 `2fc826c4` [haru]; schema.prisma (mudeliloend + 15 võtmemudelit + olekute enum'id); lib/notifications.js + notificationReconciler.js (täielikult) + app/api/jobs/notifications/route.js + app/api/notifications/route.js (kuju) + lib/retention.js (klassid) + lib/privacy/userDeletion.js (DataDeletionJob) + i18n-võtmed (9/9/9 + continuity 14) + mailer-kasutajate loend; **serveri systemd-taimerid runtime'is** (notifications ~5 min, viimane käivitus OK; practice-reviews; service-availability). Dokumendid: RUUM-VIS-A0 (täismaht), TÖÖLAUD-A0 (täismaht), koordinaatori handoff (strateegia+väravad+lähtepunkt), RUUM-A0 (ptk 8/9/16/17/20 + struktuur), Kovisiooni teadmistekaart (ptk 1–9 täielikult), SUP-P0 skeemidiff (13 mudelit + võtme-enum'id), Tööheaolu koondseis (täismaht), FAILID-A0 (leiud+tugevused+vastuolud), Teekond-UX ja rollivahetaja (struktuur + varasemate analüüside ristviited).
- **Peamised tulemused:** K1 = variant A (leping+adapterid; ptk 2.5, leping ptk 4); U1 = variant B minimaalne (DomainEvent outbox + olemasolev projektsioon; ptk 6); vertikaal = eelpöördumise staatusemuutus (ptk 10); blokeerivad otsused O-K1-1/O-U1-1/O-U1-2 (ptk 11.1); esimene pakett K1-P0 + Sol-käsk (ptk 12.3).
- **Järgmine töökord siin dokumendis:** (1) kui O-K1-1..O-U1-2 saavad vastuse, märgi ptk 11.1 seisud ja ava K1-P0 teostuseks (12.3 käsk); (2) kui SUP-P0 merge'itakse, uuenda ptk 3 SUP-rida ja 4.2.1 tabel; (3) kui TÖÖLAUD-P1 teostatakse, märgi ptk 8.1 kolm parandust tehtuks; (4) kui U1-P0 dual-run algab, lisa pariteedimõõdikute tabel ptk 9.6 alla.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; ptk 1 git/serveri kontrollid on lukus 17.07 seisuga — uus sessioon teeb UUE kontrolli ja lisab uue rea, mitte ei muuda vana.

STATUS: COMPLETE
