# 09 — Opus sõltumatu järelkontroll: U12 + U3 usalduspakett

> **LÕPPOTSUS: `OPUS PARANDUSED VAJALIKUD`** — P0 puudub; kasutaja otsus (2026-07-14) tõstab **F1 blokeerivaks P1-ks**. Sol parandab F1 + F2, lisab regressioonitestid, teeb täieliku kontrollipaketi; seejärel Opuse kordusaudit enne merge'i (doc 00 §6.6). Opus peatub kuni paranduseni; branch ei merge'ita.
>
> **Audit** faili `08-sol-u12-u3-minu-jagamised-ja-tagasivotmine-progress.md` §9 + handoff `00-...` §6 järgi.
>
> **Mudel / effort:** Claude Opus 4.8, Extra (`xhigh`)
>
> **Kontrollitav haru:** `codex/u12-u3-trust-package`, tip `2d889a81` (`Harden U12 U3 trust interactions`); alus `origin/main` @ `11381100`.
>
> **Auditi tüüp:** read-only. Kood auditeeriti eraldi detached worktree'st; **Opuse põhitööpuu haru EI vahetatud** (doc 00 §6.0). Koodi ei muudetud, haru ei merge'itud/rebase'itud, ei commit'itud/push'itud/deploy'itud.
>
> **Kuupäev:** 2026-07-14

## 1. Meetod ja tööpuu seis

- Loodi read-only detached worktree haru tipust (`2d889a81`) scratch-kausta; `node_modules` sümlingitud, haru-skeemi Prisma-klient genereeritud → objektiivsed kontrollid jooksutati **haru koodi peal**, mitte main-il.
- Opuse põhitööpuu jäi `main` @ `d6c2c695` peale; kõrvalised ruumifailid puutumata.
- Meetod: 2 sõltumatut adversaalset lugejat (U3 elutsükkel/race/no-leak; U12 owner-only koond/klient) + Opuse enda tuum-CAS-, skeemi/migratsiooni- ja objektiivkontroll. Sol tegi ka §16 enesekontrolli (6 viga); need verifitseeriti eraldi.

## 2. Päriselt käivitatud kontrollid (haru peal, sõltumatult)

| Kontroll | Tulemus |
|---|---|
| Sihttestid (`trustLifecycle` + `trustPackageContracts` + `mySharings`) | **20/20** ✔ |
| `npm test` (kogu, haru) | **1090/1090** ✔ |
| `npm run i18n:check` | OK (ET/EN/RU pariteet) ✔ |
| `npm run db:migrate:check` (haru migratsioon) | **88 migratsiooni**, drift puudub ✔ |
| `git diff --check` | puhas ✔ |

**Skeem + migratsioon (Opus verifitseeris):** 3 nullable veergu (`openedAt`, `recalledAt`, `supersededById`) — additiivne; backfill **fail-closed** (`sentAt = COALESCE(updatedAt, createdAt)` AINULT `status='SENT'` ridadele, avamist/tagasivõttu ei oletata); `UNIQUE(supersededById)` → 1:1 lineaarne parandusahel; self-FK `ON DELETE SET NULL`; enum'i ei muudetud, sisu ei kustutata. **Terve.**

## 3. Leiud

### P0 — ei leitud
### P1 — **1 blokeeriv (F1, kasutaja otsusega tõstetud)**

### F1 — post-open ridade otsene muutmine möödub supersession'ist (**P1, blokeeriv**; pre-existing juur)

- **Fail / verifitseeritud Opuse poolt:** `lib/preInquiries.js:1064` ja `:1101` — `updatePreInquiry` väravab muutmise ainult `status === "SENT"` korral. Värske-selekt loeb `openedAt`/`supersededById` (`:1086-1088`), kuid väraval neid ei kasuta.
- **Käivitustingimus:** adressaat aktsepteerib (`acceptPreInquiry` SENT→READY) või salvestab tööplaani (READY/ARCHIVED); autor teeb seejärel `PATCH /api/pre-inquiries/[id]` → topic/situation/draft muudetakse **otse**, ilma uue versioonita, `supersededById`-lingita ja saabumisteavituseta. Kehtib ka juba superseded vanale reale.
- **Mõju:** undermineerib U3 põhilubadust. Doc 00 §6.4: „pärast avamist ei tohi ajalugu tagantjärele kustutada; pärast avamist saab saata parandatud versiooni, mis viitab eelmisele". Otsene PATCH asendab avatud sisu jäljetult. **Pole privaatsuse-/auth-/andmekao-viga** (autor muudab enda kirjet; kooskõlas doc 08 „ainult SENT muutmatu" LITERAALSE lepinguga).
- **Klass:** pre-existing käitumine (SENT→READY accept'il ja „ainult SENT muutmatu" värav eelnevad harule; `openedAt` on uus). Haru lisab supersession-mudeli, aga EI sulge otsest muutmisteed → lubadus jääb poolikuks.
- **Oodatav parandus (kasutaja otsus: sulge):** `updatePreInquiry` peab keelama sisumuutmise, kui `fresh.openedAt != null` (või `supersededById != null`) — kontrollitud 409 (nt `pre_inquiries.errors.opened_cannot_be_edited`) luku all värske rea põhjal; post-open muudatused suunatakse ainult correction-teele (`sendPreInquiryCorrection`). Väravat peab olema nii pre-lock kui luku-all värske kontrollis (nagu olemasolev SENT-värav `:1064`/`:1101`). Veavõti ET/EN/RU-s.
- **Vajalikud regressioonitestid:** (1) avatud (`openedAt != null`) READY kirje PATCH sisumuutus → 409, 0 kirjutust, sisu muutmata; (2) sama superseded (`supersededById != null`) vanale reale → 409; (3) avamata (DRAFT/READY, `openedAt = null`) kirje jääb muudetavaks (ei regressi); (4) post-open muudatus läbib correction-tee → uus SENT + `supersededById` link (olemasolev correction-test katab, kinnita et otsetee on ainus alternatiiv suletud); (5) recall-eelne (SENT, avamata) jääb recall'itavaks/muudetavaks olemasoleva lepingu järgi.

### P2 — muud leiud

| ID | Leid | Fail | Klass |
|---|---|---|---|
| F2 | Puuduv i18n-võti `pre_inquiries.errors.situation_required` — jõutav correction'iga tühja `situation`-iga (`normalizeRequiredText` viskab, route allowlistib ja pindab võtme toorelt); `i18n:check` läbib, sest puudub kõigis 3 lokaalis | `lib/preInquiries.js:798`, `corrections/route.js` | päris (väike) |
| F3 | `409 not_sent` vs `404` olemasolu-signaal adresseeritud-aga-saatmata DRAFT-il (adressaadile nõrk „mustand sulle olemas" vihje); cuid-kaitstud, loend peidab niikuinii | `:723`, `:1259` | valikuline |
| F4 | `ensureRoomForPreInquiry` P2002-fallback + `markRecipientOpened` jooksevad väljaspool advisory-lukku → harv `open_conflict` 409 ruumi taasavamisel | `lib/rooms/preInquiryRoom.js:190` | valikuline/robustsus (pre-existing) |
| U1 | „Minu jagamised": toimingu-viga kirjutatakse liveRegion'i, mis on kinnitusmodaali overlay ALL → nägija näeb dialoogi ilma põhjuseta uuesti aktiveerumas | `MySharingsPage.jsx:232` | päris (väike a11y) |
| U2 | Mutatsiooni-järgse värskenduse tõrge tõstetakse full `loadError`-iks → kogu loend kaob pärast edukat mutatsiooni (võrgu-blip); taastatav Retry'ga | `MySharingsPage.jsx:145,201` | päris (väike UX) |
| U3 | `PENDING_PAYMENT` kutse kuvatud aktiivse adressaadi-nähtavusena, kuigi pole veel tasutud/saadetud | `lib/mySharings.js:161` | valikuline |
| U4 | Autentimata `/minu-jagamised` näitab toorviga („unauthorized") login-viipe asemel (andmed kaitstud, UX-only) | `MySharingsPage.jsx` | valikuline |

### Märkused (mitte vead)
- **F5:** §5/§16 väide, et `UNIQUE(supersededById)` kaitseb duplikaadi eest „ka rakendusvea korral", on ülepakutud — päris kaitse on `supersededById:null` CAS + lukk; UNIQUE takistab kahe *erineva originaali* osutamist samale parandusele (mida create-then-link isegi ei tekita). Kaitse kehtib.
- **F6:** fail-closed ajaloolise peitmise piir (backfill + adressaadi nähtavusfilter) on teadlik doc 08 §16 kompromiss — andmete-kättesaadavuse valik, mitte leke.

## 4. Jaotus

- **Päris vead:** F1 (piiripealne P1/P2), F2, U1, U2 (kõik väikesed; F1 puudutab põhilubadust).
- **Valikulised:** F3, F4, U3, U4.
- **Märkused:** F5, F6.

## 5. Invariandid, mis KEHTIVAD (agendid + Opus proovisid murda, ei suutnud)

- **Recall:** autor-only (`findFirst {authorId}` → no-leak 404), luku all värske re-lugemine, idempotentne, external→409, opened→409, kanooniline-ruum-olemas→409 ka ilma openedAt-ita, mitte-SENT→409, fingerprint→409, atomaarne CAS `{updatedAt, openedAt:null, recalledAt:null}`; recalled kaob adressaadi loendist, jääb autorile; ei kustuta rida.
- **Open:** ainult värske `recipientOwnerId` (accept/workflow/room), iga re-loeb luku all, recalled→404 adressaadile, esimene sündmus seab `openedAt`, kordus säilitab (`fresh.openedAt || new Date()` + CAS). §16 idempotentsus (ARCHIVED ei taastu READY-ks) kehtib.
- **Correction:** autor-only, opened+not-recalled+INTERNAL, retsipient/kanal/kontekst kopeeritud LUKUS vanast reast (klient ei saa adressaati ümber määrata — test kinnitab hijack-katse tagastab originaal-retsipiendi), üks tehing loob uue SENT + lingib `supersededById`, kordus tagastab sama paranduse, privaatsusvärav, `receiverNote/checklist/assessmentState` EI kopeerita, link-CAS fail → rollback (orb-rida ei jää).
- **U12 owner-only:** kõik 6 päringut server-skoobitud `userId`-le (`authorId`/`userId`/`inviterId`), admin-möödapääsu pole, auth-first (401 enne keha/DB-d); eelpöördumiste `select` jätab välja `receiverNote`/`receiverChecklist`/`assessmentState`; kanal-üleste väljade (`room.ownerId` jne) leket pole; valdusriba `canRecall/canRevoke/canLeave` peegeldavad täpselt serveri väravaid; topeltklõps `mutationInFlightRef` (enne await'i).
- **Race'id (§6):** recall↔open↔correction kõik serialiseeritud sama `withPreInquiryRoomLock` + CAS all → lost-update/duplikaat/recall-after-open/hijack ei leitud.
- **§16 kuus parandust:** kõik olemas ja korrektsed.

## 6. Lõppotsus — `OPUS PARANDUSED VAJALIKUD`

**P0 puudub.** U12 owner-only koond ja U3 recall/open/correction race/CAS/privaatsus/migratsioon on adversaalselt tugevad ja kannavad kõik dokumenteeritud väited. Objektiivsed kontrollid haru peal rohelised.

**Kasutaja otsus (2026-07-14): F1 tõstetud blokeerivaks P1-ks.** Haru ei merge'ita enne kui:

1. **F1 suletud** — `updatePreInquiry` väravab post-open (`openedAt != null` / `supersededById != null`) otsese sisumuutmise; post-open muudatused ainult correction-teel. + regressioonitestid (vt F1 nimekiri).
2. **F2 parandatud** — puuduv i18n-võti `pre_inquiries.errors.situation_required` lisatud ET/EN/RU-sse (jõutav correction-teel).
3. **Soovituslikult** samas ringis U1 (veatekst modaali sisse) ja U2 (värskendustõrge ei kustuta loendit) — väikesed UX-parandused.
4. F3/F4/U3/U4 on valikulised (võib jätta teadlikuks follow-up'iks).

**Protsess (doc 00 §6.6 / doc 01 §1):** Sol parandab tõendatud vead + lisab regressioonitestid + teeb täieliku kontrollipaketi harul. Seejärel Opus teeb paranduste kordusauditi. Alles pärast F1 sulgemist ja kordusauditit on U12/U3 diff merge-review-valmis. **Opus peatub kuni Soli paranduseni; kood/merge/deploy tegemata.**
