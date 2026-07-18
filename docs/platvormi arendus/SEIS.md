# SEIS — SotsiaalAI arenduse elav seisufail

STATUS: SINGLE SOURCE OF TRUTH

Viimati uuendatud: 2026-07-18 õhtul (**ÕHTU-UUENDUS:** T07 E3 TEHTUD, push'itud (`origin @ 6dbb6752`) ja **liidetud kohalikku main-i** (`729b09f0`) — T07 SKOOBIOTSUS JÄÄB LAHTISEKS (omanik: „otsustan hiljem"; 4 lepingu-jääki vt „T07 E3 18.07 õhtul"); `lint-debt-cleanup` commit'itud (`c674a3ec`) ja **liidetud main-i** (`072ec70e`) — hoiatused 359→50, 0 viga; **main uus tipp = `072ec70e`**, väravad merge'itud main'il: **1727/1727 testi + i18n OK + prisma validate OK** (lint/build kontrollitud eraldi ridades); seisutabelisse lisatud **Teemakaart T01–T28**. **DEPLOY TEHTUD:** local `main` `adc83829` → server LIVE; 6 migratsiooni rakendatud, smoke roheline, DB-backup võetud. **T03 disainiotsus LAHENDATUD:** ühtne mikker võidab, spatial-entry hüljatud. **T09 PAYMENTS-V1 DEPLOYED** — `main @ 7b49e9f7` LIVE serveris (baas `538ec4bb`), väravad + päris-DB runtime 33/33; migratsioon rakendatud, smoke roheline, DB-backup võetud, rollback `538ec4bb`; järgmine kooditeema = T10. **Ops-fixid: research-worker live + Turbopack puhas; server `efd275f1`.** **T23 mentorlus rebase'itud + liidetud local `main`-i `13d59449` (1642/1642 testi), EI serveris**. **T24 FIELD-V1 = `CODE_READY`** — `origin/codex/field-v1 @ 919aa806`, E10 testid kirjutatud, 42 puuduvat veatõlget parandatud; **push'itud + liidetud kohalikku main-i** (`662b6e8a`) koos kahe pargitud korrastusharuga (`admin-analytics-honesty`, `usage-reservation-reaper`); T07 rebase'itud + migratsiooniviga parandatud + push'itud. **Kohalik main (viimane kood `032a1e6d`) on `origin/main`-ist ees — push'imata, EI serveris**)

> **See fail on AINUS koht, kus elab „kus me oleme".** Kõik muud dokumendid on viitematerjal: lepingud ütlevad *mida teha*, masterregister *mida teema tähendab*, analüüsidokid *mida leiti*. Ükski neist ei kanna elavat olekut — kui leiad neist staatuseväite, mis on selle failiga vastuolus, kehtib SEIS.md ja vana väide tuleb parandada.
>
> **Miks nii:** 18.07 oli elav staatus laiali 20+ failis (ainuüksi T24 seis kümnes kohas). Iga koopia vananes eraldi — T19 „pooleli" väidet tuli parandada viies failis ja üks leping viitas kustutatud worktree'dele. Üks fail vananeb ühes kohas ja parandub ühe muudatusega.

## Kasutajale: mida uude aknasse kleepida

Jätkamiseks üks rida:

> Loe `docs/platvormi arendus/SEIS.md` ja jätka sealt.

Uue teema väljastamiseks kaks rida: see + lepingufaili nimi (nt `t10-public-v1-ulesanne.md`).

## Ülesanne

Sina oled SotsiaalAI arenduskoordinaator. Jätka olemasoleva seisu alusel. Ära alusta arendusprogrammi, analüüse ega auditeid nullist.

Töökaust: `C:\Users\rauds\Desktop\SotsiaalAI`

Kui sul puudub ligipääs kohalikule töökaustale, palu kasutajal lisada vähemalt käesolev fail ja viimane lõpparuanne. Ilma repo ligipääsuta ei tohi Git-, worktree-, remote- ega failiseisu kinnitatuks lugeda.

## LÕPETAMISE KONTROLLNIMEKIRI (iga ülesande lõpus)

Kui teema saab valmis, katkeb või jääb pooleli, uuenda **AINULT seda faili** ja **ainult neid kolme asja**:

1. **Teema rida seisutabelis** → uus olek, haru + lõppcommit SHA, kasutatud baas-SHA, väravate tulemus, mis jäi `NOT_PROVEN`.
2. **Järjekord** → mis teema avanes, mis on järgmine.
3. **Vananenud väide** → kui töö käigus selgus, et mõni siinne lause on vale, paranda see kohe siin.

Reeglid:
- **Kirjuta siia ka POOLELIOLEK.** „Lõpparuanne alles tuleb" ei ole põhjus jätta seis kirjutamata — 18.07 seisis T24 ja T23 töö päevi ainult kettal just sellepärast.
- **Ära uuenda masterregistrit, programmi ega analüüsidokke** teema oleku pärast. Need on viitematerjal. Erand: kui teema *definitsioon* või *piir* päriselt muutus, siis masterregister — aga mitte olek.
- **Ära loo uut konkureerivat seisufaili** ega „handoff-<kuupäev>" faili.

## Viitematerjal (ei kanna elavat olekut)

| Fail | Mille jaoks |
|---|---|
| `arendusteemade-masterregister.md` | teemade definitsioonid, piirid, vastutuskaart |
| `platvormi-arendusprogramm-2026-07-17.md` | programmi plaan ja faasid |
| `arendusplaan-omanikuvaade.md` | omaniku vaade eesmärkidele |
| `tXX-…-ulesanne.md` | teemalepingud — ei muutu pärast väljastamist |
| `koordinaatori-handoff-2026-07-16.md` | **AJALOOLINE**, ei uuendata |

## Kriitilised tööreeglid

- **UUENDATUD 18.07:** kohalik põhitööpuu on PUHAS ja kohalik `main` on uus kanooniline baas (26 haru konsolideeritud, värav roheline: 1551 testi + i18n + 96-migratsiooni ahel + lint + build). **DEPLOY TEHTUD 18.07:** `origin/main` ja server on nüüd `adc83829` (= kohalik `main`); rollback-SHA `fe4eb4fa`.
- Uued teemaharud luuakse kohalikust `main`-ist (mitte `origin/main`-ist); põhitööpuud ennast kasutatakse ainult read-only baasina.
- Uus kooditöö tehakse ainult eraldi värskes worktree's ja ülesandes nimetatud baascommit'i pealt.

### JADATÖÖ REEGEL (kehtestatud 2026-07-18, ülimuslik varasema paralleelmudeli suhtes)

18.07 integratsioon maksis 24 konfliktiplokki ja 3 edasilükatud disainikollisiooni (T02/T03/T16). Juurpõhjus ei olnud harude olemasolu, vaid see, et **mitu teemat jooksid korraga, igaüks eri baasilt, ja ükski ei näinud teiste muudatusi enne lõppu**. Tooteomaniku otsus 18.07: see mudel lõpetatakse.

- **Korraga kirjutab koodi ainult ÜKS teema.** Järgmist teemat ei väljastata enne, kui eelmine on väravad läbinud ja `main`-i liidetud.
- **Iga teema algab `main`-i PRAEGUSEST tipust.** Ülesandes nimetatud baas-SHA peab alustamise hetkel võrduma `git rev-parse main` tulemusega. Kui ei võrdu, on `main` vahepeal liikunud → alusta praegusest tipust ja raporteeri kasutatud SHA. Cherry-pick'i ahelaid ega vanemast commit'ist hargnemist ei kasutata.
- **Haru elab tunde, mitte päevi.** Merge `main`-i samal päeval, kui väravad on rohelised — nii ei jõua miski lahkneda.
- **Paralleelselt tohib joosta ainult see, mis koodi ei kirjuta:** analüüsid, auditid, dokumenditöö, tooteotsuste ettevalmistus.
- Erand paralleelsuseks nõuab tooteomaniku selgesõnalist luba ja eeldab, et failialad on tõendatult lahus (mitte ainult eeldatavalt).
- Ära merge'i ega deploy ilma kasutaja eraldi selgesõnalise loata.
- Ära käivita `OPS-FINAL-A0`; see jääb release candidate'i lõppväravaks.
- Ära loe tootmiskasutajate sisu ega kasuta päris kasutajaid testimiseks.
- Ära saada päris e-kirju, tee päris makseid ega kontakteeru päris partneriga ilma eraldi loata.
- Ära korda teostaja teste, build'i, runtime-smoke'i ega sõltumatut auditit, kui lõpparuanne sisaldab nende tulemusi.
- Paketipõhised sõltumatud auditid ja täissviidid on tooteomaniku otsusel koondatud T27 release-candidate'i väravasse.
- Üks funktsiooniteema tähendab vaikimisi üht haru, üht terviklikku teostust ja üht lõppüleandmist, mitte hulka mikropakette.
- Analüüsidokumentide `P0.1`, `P1.2` jne on teema sisemised kontrollpunktid, mitte automaatselt eraldi arendusülesanded.
- Katkenud teemaarendus jätkub samas worktree's ja harus [`teemaarenduse-jatkamise-kord.md`](./teemaarenduse-jatkamise-kord.md) järgi. Konto tüüp ega limiit ei muuda teemaülesande ulatust.

## Esimene tegevus uues aknas

Kontrolli odavalt ja read-only viisil muutlikud Git-faktid:

- põhitööpuu branch, HEAD ja määrdunud seis;
- `origin/main`;
- kasutaja lõpparuandes nimetatud remote-haru SHA;
- commit'i parent või stack'i alus;
- nimetatud worktree branch ja puhtus;
- aruandes nimetatud diffstat.

Ära jooksuta selle kontrolli käigus teste, build'i ega runtime'i.

Kui kontrollitud Git-fakt erineb käesoleva faili hetkeülevaatest, kasuta kontrollitud fakti ja paranda see fail.

## SEISUTABEL — 2026-07-18

**KOHALIK `main` on `origin/main @ 104d69d8`-ist EES, push'imata ja deploy'mata.** Viimane KOODI-commit main'is = **`072ec70e`** (lint-debt-cleanup merge; selle all `729b09f0` T07 E3 merge, `c429bf4a` P2-6, `032a1e6d` reaper). Sisaldab lisaks T09-le: T23 mentorlus, **T24 FIELD-V1**, `admin-analytics-honesty` (M2), `usage-reservation-reaper` (PERF L4). Väravad integreeritud main'il rohelised: **1700/1700 testi (P2-6 järel; enne 1696), lint 0 viga, i18n OK, prisma validate OK, build OK, 101-migratsiooni ahel OK**. **Server kood `7b49e9f7` — LIVE (T09 PAYMENTS-V1 deploy'tud 18.07)**; T23, T24 ega korrastused EI ole serveris. **T09-deploy 18.07** (`538ec4bb`→`7b49e9f7`): ff, 1 additiivne migratsioon (`20260719120000_payments_v1`) rakendatud prod-DB-le, npm ci + build roheline, 3 teenust `active`, smoke roheline (`/` `/vestlus` `/meist` `/tellimus` `/voimalused` → 200). **T09 tööliste ajastus (`604fe898`, main'is, deploy'mata):** `scripts/subscription-reconcile.mjs` + `scripts/payment-emails.mjs` + `ops/systemd/sotsiaalai-{payment-emails,subscription-reconcile}.{service,timer}` — **inaktiivsed** üksused; e-posti outbox ja reconcile EI jookse enne käsitsi `enable`-t + võtmeid (vt `ops/systemd/README-payment-workers.md`). Verifitseeritud: 9/9 shim-kontrolli + lint + diff-check; 0 jagatud faili (ainult `ops/`+`scripts/`+`docs/`). Rollback-SHA `538ec4bb`; DB-backup `~/sotsiaalai-db-backups/pre-deploy-7b49e9f7-20260718T141532Z.dump` (2,75 MB, 1114 kirjet, taastatav). Server `SUBSCRIPTION_RECURRING_ENABLED=0` (variant A) + `PAYMENT_TOKEN_ENC_KEY` seadmata → recurring-token krüpto on **fail-closed dormant** (recurring rada ei aktiivne; enne recurring'u sisselülitamist tuleb võti seada). Eelmine deploy (ajalooline): põhi-deploy `adc83829` + ops-fix `efd275f1`. **Ops-fixid 18.07 (live+tõendatud):** (1) `sotsiaalai-research-worker.service` paigaldatud + `active`+stabiilne (fix: `--conditions=react-server`, sest `pipeline.js`→`@/lib/server/ragAuth`→`server-only` crash-loopis standalone node's; repo alla `ops/systemd/`) — [[perf-cost-audit]] L1 **worker-osa** lahendatud, **kvoodileke JÄÄB** (PERF-P0); (2) Turbopack NFT-hoiatused 10→0 (`lib/dataExport/service.js`). Rollback-SHA `fe4eb4fa`; DB-backup `~/sotsiaalai-db-backups/pre-deploy-adc83829-20260718T111528Z.dump` (2,69 MB, taastatav).

### Teemakaart T01–T28 (koondvaade, 18.07 õhtul)

Olekusõnastik: **LIVE** = serveris toodangus · **MAIN** = kohalikus `main`-is, EI serveris · **TÖÖS** = aktiivne kooditöö · **OTSUS** = ootab omaniku otsust · **ANALÜÜS** = analüüs/audit valmis, kood alustamata · **OOTEL** = järjekorras või teadlikult edasi lükatud · **—** = alustamata.

| # | Teema | Olek | Märkus |
|---|---|---|---|
| T01 | ADMIN-V1-CORE | **LIVE** | 18.07 integratsioon |
| T02 | ACCOUNT-V1 | **LIVE** | T02+T16 lepituse kaudu |
| T03 | CHAT-VOICE-V1 | **OTSUS** | kood valmis harul `7bdd1288`, 109 commit'i main'ist taga — rebase või E1–E5 uuesti |
| T04 | WORKSPACE-EVENTS-V1 | **LIVE** | |
| T05 | WORKBENCH-V1 | **LIVE** | |
| T06 | JOURNEY-V1 | **LIVE** | |
| T07 | DOCUMENTS-RESEARCH-V1 | **TÖÖS** | E3 main'is (`729b09f0`, push'itud `origin @ 6dbb6752`); SKOOBIOTSUS LAHTINE — vt T07 rida allpool |
| T08 | FILES-MEDIA (Failid) | **OOTEL** | omaniku otsusega hilisemaks; riskid jäävad registrisse |
| T09 | PAYMENTS-V1 | **LIVE** | `7b49e9f7`; recurring teadlikult väljas; töölise-timerid inaktiivsed |
| T10 | PUBLIC-V1 | **OOTEL** | järjekorras T07 järel (omaniku otsus: lõputeema) |
| T11 | SERVICE-MEDIATION-V1 | **LIVE** | |
| T12 | ROOMS-CALLS-V1 | **ANALÜÜS** | ruum-audit.md 20 ptk; teemaarendus alustamata |
| T13 | COVISION-V2 | **ANALÜÜS** | V1 LIVE ja runtime-tõendatud; V2 ruumiline lõppmudel alustamata |
| T14 | WELLBEING-V2 | **ANALÜÜS** | E0 kriitiline parandus LIVE; E1–E6 tegemata |
| T15 | A11Y/RV | osaliselt LIVE | a11y-i18n P0 LIVE; RV-P1+ ja tõlkestrateegia tegemata |
| T16 | EXPORT-V1 | **LIVE** | lepituse kaudu |
| T17 | SEARCH-LANGUAGE-V1 | **LIVE** | |
| T18 | PERF | osaliselt LIVE | L1 worker LIVE; L4 reaper MAIN (vaikimisi väljas); kvoodileke + L3 timerid + L5 kuluajalugu tegemata |
| T19 | SPATIAL-WORKSPACE-V1 | **OOTEL** | DEFERRED omaniku otsusega; prototüüp main'is viitena; ükski teema ei oota |
| T20 | COLLAB-V1 | **—** | O-CO otsused lahtised |
| T21 | CASEWORK-V1 | **ANALÜÜS** | CASEWORK-A0 valmis |
| T22 | SUPERVISION-V1 | **ANALÜÜS** | tootemudel + V0 tööplaan valmis |
| T23 | ESTA-MENTOR-V1 | **MAIN** | `main @ 13d59449`; ootab deploy'd |
| T24 | FIELD-V1 | **MAIN** | `main @ 662b6e8a`; ootab deploy'd |
| T25 | ORG-V1 | **ANALÜÜS** | ootab release candidate'i |
| T26 | PILOT-PARTNER-V1 | **ANALÜÜS** | piloodikoodi ei avata enne RC-d |
| T27 | OPS-FINAL-A0 | värav | teadlikult käivitamata; koondab edasi lükatud QA-d |
| T28 | RAG-V1 | **LIVE** | saba: P8.6 päris allikate proovipakk + timeri aktiveerimine (omaniku otsus) |

Kokku: 11 LIVE, 2 MAIN (deploy ootel), 1 TÖÖS, 1 OTSUS, 6 ANALÜÜS, 3 OOTEL, 2 osaliselt, 1 alustamata, 1 värav. Harutasandi korrastus `lint-debt-cleanup` on 18.07 õhtul main-i liidetud (vt „Pooleli, ei ole järjekorras").

### Töö järjekord (jadatöö)

| # | Teema | Olek | Haru / SHA | Avab |
|---|---|---|---|---|
| ✓ | T24 `FIELD-V1` | **`MERGED_LOCAL` 18.07 — push'itud + liidetud kohalikku `main`-i** | `origin/codex/field-v1 @ 919aa806` → `main @ 662b6e8a`, baas `082d8efa`, 45 faili `+7367/−22` | — |
| 2 | T02+T16 `LEPITUS` | **`DEPLOYED` — main'is `d2860b0b`, **LIVE serveris 18.07** (`adc83829`). Väravad: 1582 testi, 98-migr ahel, build; 6 migratsiooni rakendatud prod-DB-le** | `codex/t02-t16-remerge @ a6f683a6` → `main` | **T09 avatud** |
| ▶ | **T07 `DOCUMENTS-RESEARCH-V1`** | **`IN_PROGRESS` — E3 TEHTUD, push'itud ja MAIN-IS 18.07 õhtul; SKOOBIOTSUS LAHTINE (vt „T07 E3 18.07 õhtul")** | `codex/documents-research-v1 @ 6dbb6752` = remote (push'itud), **merge main-i `729b09f0`**, baas `032a1e6d`, worktree puhas; väravad merge'itud main'il: **1727/1727 testi + i18n OK + prisma validate OK + build OK + lint 0 viga** (E3 ei lisa migratsiooni; 102-migr ahel kehtib rebase'ist) | skoobiotsus → sulgemine avab T10 |
| — | T10 `PUBLIC-V1` | `QUEUED` — T07 järel | leping `t10-public-v1-ulesanne.md` | avalikud pinnad |

### Paralleelne mittekooditöö (jadatöö reegel lubab)

| Teema | Olek | Leping | Teenib |
|---|---|---|---|
| DEPLOY-A0 valmiduse audit | **`EXECUTED` 18.07 — GO täidetud, deploy LIVE** | väljund: `deploy-a0-valmiduse-audit-2026-07-18.md` | mõlemad eeltingimused täidetud (DB `pg_dump` võetud+verifitseeritud; server-build madala koormusega, 4.5 GB vaba); server `adc83829`, smoke roheline |

### Pooleli, ei ole järjekorras

| Teema | Olek | Haru / SHA | Märkus |
|---|---|---|---|
| T23 `ESTA-MENTOR-V1` | **`MERGED_LOCAL` — rebase'itud + liidetud `main`-i** | `codex/esta-mentor-v1 @ 8af9bcb5` → `main @ 13d59449`, baas `e18acc3f` | 6 konflikti lahendatud (additiivne liit T16 DATA_EXPORT + supervisioon + mentorlus); migratsioon ümber nimetatud `20260719130000_mentoring_v1` (main-i uusimast hilisem, järjekord ohutu); väravad rohelised: **1642/1642 testi + 100-migr ahel + build + i18n + lint + päris-DB runtime PASS**; `NOT_PROVEN`: brauseri-QA, seadme-a11y. **main-is, EI serveris** (push=deploy) |
| `admin-analytics-honesty` | **`MERGED_LOCAL` 18.07 — korrastatud pargist** | `origin/codex/admin-analytics-honesty` → `main @ a1533356` | M2 vaikiv 500-lagi: aus „Kuvatud X-Y / N" + paginatsioon + truncated-hoiatus; rebase puhas, 5 faili `+97/−2` |
| `usage-reservation-reaper` | **`MERGED_LOCAL` 18.07 — korrastatud pargist** | `origin/codex/usage-reservation-reaper` → `main @ 032a1e6d` | PERF-P0 kvoodileke (L4): aegunud RESERVED-hoidude koristaja; **vaikimisi VÄLJAS** (unit'id inaktiivsed, lipp seadmata); puhtalt additiivne, 7 uut faili `+515/−0` |
| `lint-debt-cleanup` | **`MERGED_LOCAL` 18.07 õhtul** | `codex/lint-debt-cleanup @ c674a3ec` → **main `072ec70e`** (push'imata remote'i) | Lint-võla koristus: surnud CovisionSession.jsx kustutus (`3cd035ac`, `−3187`) + TeemaseemnedPage i18n-ekstraktsioon (`c674a3ec`, 4 faili `+504/−90`, 88 võtit ×3 keelt). **Lint-hoiatused 359 → 50 (0 viga)**; väravad merge'itud main'il rohelised. Suurim allesjäänud hoiatuspesa: `WorkspaceFeaturePage.jsx` 27 hardcoded-stringi. Reeglimärkus: töö käis põhitööpuus (sama muster mis P2-6) |
| T03 `CHAT-VOICE-V1` | **`DECISION_MADE` 18.07 — ühtne mikker võidab; HARU LAHKNEB** | `origin/codex/chat-voice-v1 @ 7bdd1288` — **109 commit'i main-ist taga** | omanik otsustas: sisenemine = alati-nähtav tekstiväli + VALIKULINE mikker (main). Spatial-entry hüljatud. Skoop = ainult E1–E5 (kriis/Stop/hääl), MITTE sisenemis-UX. **OTSUST VAJAV:** 109 commit'i lahknemine on sama muster mis T02/T16 enne lepitust — kas rebase'ida lähipäevil või teha E1–E5 main'i peal uuesti; iga päev nihutab vastust teise poole |
| T19 `SPATIAL-WORKSPACE-V1` | `DEFERRED — OWNER_DECISION` | prototüüp main'is `faeaf04c` | kogu suund praegu ebaoluline; **ükski teema ei oota T19 järele** |
| T09 `PAYMENTS-V1` | **`DEPLOYED` 18.07 — LIVE serveris `7b49e9f7`** | `main @ 7b49e9f7` (= `origin/main` = server); haru `origin/codex/payments-v1` push'itud; baas `538ec4bb` | 36 faili `+2488/−566`; **väravad: 1618/1618 testi (+36), lint 0, i18n OK, prisma validate, 99-migr ahel, diff-check, build** + **päris-DB throwaway runtime 33/33** (plaani-eskaleerimise keeld, webhook FOR UPDATE race/idempotents, revoked-sponsor ei ärka, refund-clawback, PAST_DUE/period-end, outbox retry, token-krüpto); **deploy: 1 additiivne migratsioon rakendatud, smoke roheline, DB-backup `pre-deploy-7b49e9f7-…141532Z.dump`, rollback `538ec4bb`**. `NOT_PROVEN`: brauseri-QA, päris Maksekeskus/callback/webhook/e-kiri, juristi/PCI (O-J1). P1a `0aca8c4b`/T02 olid juba main'is — cherry-pick'i EI tehtud |
| T25, T26 | `ANALYSIS_READY` | — | ootavad T27 release candidate'i |
| T27 `OPS-FINAL-A0` | ei käivitata | — | release candidate'i lõppvärav |

### Viimati valminud: T02+T16 LEPITUS (18.07)

- Baas `main @ 89edb9c3`, lõppcommit `a6f683a6`, **remote'i EI push'itud** (ootab kasutaja luba).
- T16 oli T02 otsa laotud → üks merge tõi mõlemad.
- 29 konfliktiplokki 6 failis: schema/retention/notifications additiivsed; accountLifecycle + route.js + testid tervikuna T02 poolelt.
- **Verify-then-swap võitis ja sulges ka turvaaugu:** main'i PROF-P1 jättis PIN-ita kasutajal reauth'i üldse vahele, T02 tagastab `409 PIN_SETUP_REQUIRED`.
- Kaks teadlikku testiasendust, neist üks päris käitumismuutus (PIN-ita konto ei saa enam profiili muuta).
- Väravad: **1582/1582 testi**, lint 0 viga (baasjoonega identne), i18n OK, **98-migratsiooni täisahel OK**, build OK, **sünteetiline runtime 26/26 PASS** isoleeritud DB-l.
- `NOT_PROVEN`: brauseri-QA (T27), päris e-kirjad.
- ~~Teadmiseks: T24 peab hiljem rebase'ima~~ — **TEHTUD 18.07:** T24 on rebase'itud `104d69d8` peale ja migratsioon ümber nimetatud `20260718090000` → `20260719140000_field_v1_mobile_shell` (vana nimi oleks sorteerunud juba rakendatud `payments_v1`/`mentoring_v1` ette).

### Lahtised omaniku otsused

1. ~~**Deploy**~~ — **TEHTUD 18.07.** `git push origin main` + `npm run deploy:server` → server `adc83829` LIVE. DB `pg_dump` võetud+verifitseeritud ENNE migrate'i; 6 migratsiooni rakendatud (kõik additiivsed); server-build (4.5 GB vaba, kaas-saite ei häirinud); frontend+rag `active`; smoke roheline. MAKSEKESKUS jäi variant A (`SUBSCRIPTION_RECURRING_ENABLED=0`).
2. ~~**T02+T16 push**~~ — **TEHTUD** (kuulus deploy'sse).
3. ~~**T03 disainiotsus**~~ — **OTSUSTATUD 18.07:** ühtne alati-nähtav tekstiväli + valikuline mikker (main) võidab; kaheikooniline „Räägi/Kirjuta — pead valima" spatial-entry lõplikult hüljatud. Segaduse allikas oli deploy-vahe (main eemaldas selle 16.07, aga toodangus jooksis veel eemalduse-eelne `fe4eb4fa`) — nüüd deploy'ga lahendatud.

**T09 lõpetatud (18.07):** push + merge + **deploy TEHTUD** kasutaja loal → `main @ 7b49e9f7` LIVE serveris. **T07 `DOCUMENTS-RESEARCH-V1` — WIP-kontrollpunkt 18.07** (*SHA-d selles lõigus on AJALOOLISED, rebase'i-eelsed; kehtiv seis = seisutabeli T07 rida ja allpool „T07 korrastus 18.07"*) (`codex/documents-research-v1 @ db3589f5`; baas `180d668f` = T09 sees; worktree `SotsiaalAI-documents-research-v1` puhas; alusdependents T28/T17/T16 juba main'is; **2 commit'i**: WIP `b94f9370` + E2 analüüs `db3589f5`). **TEHTUD** (väravad rohelised: **täissviit 1632/1632** + lint + i18n + 100-migr ahel + build + diff-check): E1 owner-404 (12 rada, foreign-id == missing-id, T28 cross-tenant piir puutumata), E2 püsiv mustand (`persistArtifactDraft`, `AgentArtifact.idempotencyKey` + `SavedAnalysis` mudel), **E2 salvestatav analüüsiobjekt** (`lib/documents/savedAnalysis.js` + `/api/documents/analyses` CRUD, owner-404, püsiv disclaimer "AI selgitus, mitte ametlik otsus", allika-omandikontroll, 6 uut testi), E4 uuring elab üle nav (stop vs detach), E5 meeting-summary snapshot fail-closed kustutus. **NOT_DONE:** E2 Journey "Lisa dokument analüüsiks" side (sõltub E3 analüüsiraja URL-ist) + chat "Salvesta analüüs" nupp, **~~E3 ühtne /documents tööruum (suurim tükk, puutumata)~~ → E3 TEHTUD 18.07 õhtul (`6dbb6752`); provenance/privaatsus-riba jäi E3-st VÄLJA (commit seda ei sisalda)**, E5 T04-sündmused (tihe registry/projector-integratsioon), E4 ulatuse/geo-UI. **NOT_PROVEN:** autenditud brauser + päris-RAG/worker runtime. T10 `PUBLIC-V1` = lõputeema (omaniku otsus 18.07), EI järgmine.

**T07 korrastus 18.07** (ainult tehniline, sisu EI arendatud): haru rebase'itud main-i tipule `032a1e6d` (konflikte 0) ja **push'itud** → `origin/codex/documents-research-v1 @ e49834e3`. **Parandatud migratsiooni ajatempli põrge:** `20260719130000_documents_research_v1` kandis SAMA ajatemplit kui juba main-i liidetud `20260719130000_mentoring_v1` ja sorteerus sellest tähestikuliselt ETTE (`documents_` < `mentoring_`) → ümber nimetatud `20260719150000_documents_research_v1`. Rebase'i-järgsed väravad: **1710/1710 testi + i18n OK + 102-migratsiooni ahel OK**.

**T07 E3 18.07 õhtul — TEHTUD ja commit'itud** (`6dbb6752`, 11 faili `+1153/−665`, EI skeemimuudatust ega migratsiooni): `lib/documents/workspace.js` ühtse tööruumi mudel (dokumendid+artefaktid+analüüsid+uuringud), `DocumentsPage` ümber ehitatud ühtseks tööruumiks, `GET /api/research/jobs` owner-scoped loend paginatsiooniga (lugemine lubatud ka siis, kui uute loomine väljas), 2 uut testifaili + 88 tõlkevõtit ×3 keelt. Väravad E3 peal worktree's: **1723/1723 testi, lint 0 viga / 359 hoiatust, i18n OK, prisma validate OK**; 102-migr ahel kehtib rebase'ist. **18.07 õhtul omaniku loal: push'itud (`origin @ 6dbb6752`) + liidetud kohalikku main-i (`729b09f0`)**; merge'itud main'i väravad: 1727/1727 + i18n + prisma + build + lint 0 viga. **Kahe sessiooni intsident:** koodi kirjutas üks sessioon, commit'is teine (sisu bait-täpselt, väravad üle jooksutatud); õppetund = üks worktree, üks sessioon korraga. **SKOOBIOTSUS LAHTINE:** lepingu järgi jääks veel (1) E2 Journey „Lisa dokument analüüsiks" side + chat „Salvesta analüüs" nupp, (2) E1/E3 provenance/privaatsus-riba, (3) E5 T04-sündmused, (4) E4 ulatuse/geo-UI — omanik otsustab, kas T07 suletakse praeguse skoobiga (kitsendus kirja siia) või jätkub samas worktree's.

**T07 E1 cross-tenant RAG-küsimus — VASTATUD 18.07: leket EI OLE, piir oli juba suletud (DOK-XTEN P0, mitte T28).** Seetõttu ei olnudki T07 harus ühtegi RAG-faili vaja muuta. Jälitatud tervikahel:

1. Kasutaja dokumendid **on** RAG-is, aga **eraldi privaatses kollektsioonis** — päring käib `/search/agent-documents` pihta serveris koostatud `doc_ids` lubatute-loendiga (`lib/documents/search.js`); kliendipoolset `where`-filtrit ei saadeta.
2. `searchDocumentChunks`-il on **täpselt üks kutsuja** (`buildRetrievedEvidence`, `lib/documents/generation.js:228`), mille `documents` tuleb kahest eksporditud sisenemispunktist.
3. **Kõik neli kutsujat on omaniku-skoobitud:** `artifacts/generate/route.js:104`, `artifacts/refine/route.js:132`, `artifacts/route.js:235` (kõik `ownerId: auth.userId`) ja chat-töövoog `lib/chat/workflowBranchHandlers.js`, mis annab **tühja loendi** (`agentDocuments = []`, kunagi ei täideta) → dokumendi-retrieval'it seal ei toimu.
4. **Süvauuring on eraldi kaitstud:** `app/api/research/jobs/route.js` filtreerib `PRIVATE_AGENT_RAG_COLLECTION_IDS` välja enne geo-variantide koostamist.
5. **Jagatud teadmusbaas `RagDocument` kannab `adminId`-d, mitte kasutaja omandit** — see on kureeritud sisu, mitte cross-tenant pind.
6. **Kaitse on serveripoolne ja testitud:** `rag-service/main.py` `AgentDocumentSearchIn` on `extra: forbid` ja **ilma** `owner_id`/`tenant_id`/`where` väljadeta (klient ei saa skoopi süstida); `tests/rag/agentDocumentIsolation.test.js` **4/4 roheline**, sh Python-poolne `test_search_security.py`.

**Tagajärg T07-le:** E1 esimene punkt on juba täidetud — **mitte tegemata töö**. E1-st jääb alles ainult päritolu/privaatsusriba, mis sõltub E3-st. Varasem märge „T28 cross-tenant piir puutumata" oli eksitav: piiri ei puudutatud sellepärast, et see oli juba korras. Vt ka `sol-dok-xten-p0-kordusaudit.md`.

### Väikesed sulgemised 18.07 (kolm nimekirjarida maha)

| Rida | Tulemus |
|---|---|
| **M1** admini bulk-email tokeni replay | **SULETUD ILMA TÖÖTA — oli juba parandatud.** `lib/admin/dangerousAnalyticsActions.js` paneb `jti` tokenisse ja `reserveBulkEmailPreview` kirjutab `DataAuditLog`-i `id: jti`-ga ENNE saatmist; `DataAuditLog.id` on primaarvõti → kordus annab P2002 → `DANGEROUS_PREVIEW_ALREADY_USED` 409. Kaetud 3 testiga. **Kontrollimeetodi õppetund:** marsruudifaili (`app/api/admin/analytics/users/route.js`) grep'imine EI näita seda — kogu loogika on lib-is. Varasem „M1 jääb lahtiseks" oli aegunud. |
| **T07 E1** cross-tenant RAG | **LEKET EI OLE** — piir suleti juba DOK-XTEN P0-s (vt eespool täisahel + `tests/rag/agentDocumentIsolation.test.js` 4/4). T07 E1-st jääb ainult päritolu/privaatsusriba (sõltub E3-st). |
| **P2-6** `receiverChecklist` ET-only | **PARANDATUD** — `codex/receiver-checklist-i18n @ 39c1085a` → main `c429bf4a`. 5 ET-only lauset (mis läksid ka DB-sse) on nüüd võtmete taga: serveripoolne `labelKey` + `labelVars`, ET-tekst jääb fallback'iks vanadele ridadele; `clarify_missing` jagatud kolmeks variandiks (loenduriga lauseosa ei saa tõlkes tingimuslikuks teha); võtit ei saa kliendist süstida. 9 võtit × 3 keelt + 4 testi. Väravad: **1700/1700**, lint 0 viga, i18n OK, build OK. |

**Reeglimärkus:** P2-6 muudatus tehti põhitööpuus, mitte eraldi worktree's (reegel „uus kooditöö ainult eraldi värskes worktree's"). Maht oli 6 faili; commit läks siiski korralikule harule ja sealt merge'iga main-i. Kirjas, et muster oleks nähtav, mitte vaikimisi normiks.

**Backup'id:** `backup/main-pre-cleanup-2026-07-18` (uus, = `662b6e8a`, main enne kahe pargitud haru liitmist), `backup/documents-research-pre-rebase-2026-07-18` (uus, = T07 `db3589f5`), `backup/field-v1-pre-rebase-2026-07-18` (= T24 WIP `cb99b092`), `backup/main-pre-t02t16-merge-2026-07-18`, `backup/main-pre-sync-2026-07-18`, `backup/main-pre-integration-2026-07-18`, `integration/2026-07-18`.

## Varasem taust (ajalooline, ei uuendata)

### 18.07 integratsioon (ülimuslik allolevate "ei ole main'is" märgete suhtes)

Kohalik `main @ 0ea13453` sisaldab nüüd 26 liidetud haru: kogu Faas-1 P0/P1 kiht (admin-v1-core, a11y-i18n-p0, u6/u7, perf-p0, maksed-p1a, k1-p0, prof-p1, avalik-p1s, vest-p0/p0a, rag-qm-p0/p0a, tooheaolu-e0 jt), T17 search-language, T11 service-mediation, T04+T05 workspace-stack, T06 journey, T28 rag-v1, supervision-v0-skeem ja registreerimise jaamalend. Allpool olevad „ei ole main'is” laused kehtisid 17.07 seisuga; Git-seis on ülimuslik.

**Edasi lükatud (disainikollisioon, EI liidetud):** T03 `chat-voice-v1` (kannab vanemat Räägi/Kirjuta spatial-entry mudelit; main'is on uuem mic-nupu lahendus), T02 `account-v1` + T16 `export-v1` (verify-then-swap e-postimudel vs main'i kohene swap; export sõltub account'ist). Kõik kolm haru on remote'is alles; igaüks vajab sihitud rebase+lepitussessiooni, mitte mehaanilist merge'i.

**Teadaolev .env-leid:** `SUBSCRIPTION_RECURRING_ENABLED` on seatud, aga `MAKSEKESKUS_PUBLIC_KEY` puudub → maksed-p1a uus check-env reegel kukutab deploy-kontrolli. Enne deploy'd lisada võti või keelata recurring.

**Backup'id:** `backup/main-pre-sync-2026-07-18`, `backup/main-pre-integration-2026-07-18`, `integration/2026-07-18` (= main).

### Valmis alus

- T01 `ADMIN-V1-CORE`: `CODE_READY @ f5e20b2190ec043b8c598cd81c77cc844575b10b`.
- T04 `WORKSPACE-EVENTS-V1`: `CODE_READY @ 87d9a141ee609597844912dcc37ca949a13c3329`.
- T04 otsene parent on K1 `ef5973c9eecfd8a9664dc2a0d7eb8c29f793b23a`.
- T04 haru, feature flag'id ja tootmismigratsioon ei ole main'is ega serveris.
- T26 `PILOT-PARTNER-A0` on `COMPLETE`; T26 on `ANALYSIS_READY`, kuid enne release candidate'i eraldi piloodikoodi ei avata.

### Viimane vastu võetud arendus

T06 `JOURNEY-V1` on vastu võetud, kuid ei ole main'is ega serveris.

Kontrollitud faktid:

- haru `codex/journey-v1`;
- baas T05 `33f7fb827ec35bbde3e7ce5a190213eb1c1174dc`;
- lõppcommit/local/remote `f17a3c365928433fbe5a9a681d6f8a91bb762010`, ahead/behind `0/0`, worktree puhas;
- neli järjestikust commit'i; diff 32 faili `+1062/−114`;
- teostaja tõend: markerid 5 punast → 14/14 rohelist, koond-sihttestid 52/52, i18n/Prisma/lint/diff-check/build PASS;
- autentitud runtime, cleanup ja migratsiooni rakendamise DB-seis `NOT_RUN/NOT_PROVEN`; need lähevad T27 koondväravasse;
- merge ja deploy puuduvad.

### Fable'i analüüside seis

- `JOURNEY-D0` on vastu võetud: `fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md`, tööpuus 368 rida, `STATUS: COMPLETE`.
- T06 fail-closed jagamisleping on otsustevaba ja üheselt määratud.
- JOURNEY-D1 vaikevalikud kinnitati 17.07.2026: O-J1=B, O-J2=iseseisev Teekonna leht + rajasisene tagasi-nool ja O-J3=2-sammuline kustutamine + eksport.
- T19 `RUUM-VIS-D1` on **`DEFERRED — OWNER_DECISION 2026-07-18`**: tooteomanik otsustas, et kogu T19 suund on praegu ebaoluline. Prototüüp `prototyybid/ruumilise-toolaua-prototuup.html` on valmis ja main'is (`faeaf04c`) — see on ajalooline viide, MITTE pooleliolev töö. Varasem juhis „jätkub algses aknas pärast limiidi taastumist" on tühistatud. Ei väljastata, ei jätkata, ei alustata nullist. Ükski teine teema ei oota T19 järele.
- Uut sõltumatut Fable'i süvaanalüüsi praegu ei avata.

### T28 vastuvõetud kood

T28 `RAG-V1` on `CODE_READY`, mitte aktiivne jätkuülesanne.

- Worktree `C:\Users\rauds\Desktop\SotsiaalAI-rag-v1`, haru `codex/rag-v1`, lõppcommit ja remote `8c3e5f778d1a85eb1281ee076f578ed227aeec55`, baas T06 `f17a3c36`, otsene parent `77510353`, local=remote, tööpuu puhas.
- P8.3 kinnitatud `html_or_topic` ingest, retry/dead-letter + advisory-lock/CAS, versioonivahetus/RAG_DELETE + `chunks==0` fixture-runtime ning seire/mitteaktiveeritud systemd mallid on lõpetatud. Teostaja tõend: 18/18 RAG-testi, lint/i18n/Prisma/diff-check/build/runtime ja cleanup PASS.
- [`t28-rag-v1-mitme-konto-ulesanded.md`](./t28-rag-v1-mitme-konto-ulesanded.md) on ajalooline järjestikuste etappide üleandmisfail; seda ei väljastata enam uuesti.
- P8.6 päris kümne allika proovipakk on `NOT_DONE — OWNER_DECISION`; päris korje/ingest ja timeri aktiveerimine pole tehtud. Täissviit ja sõltumatu audit kuuluvad T27-sse.
- T06 jääb külmutatuks `f17a3c36`; selle runtime-/migratsioonitõend tehakse T27-s, mitte eraldi auditiülesandena.

**T24 `FIELD-V1` — UUENDATUD 18.07: see lõik on aegunud, kehtib seisutabeli T24 rida.** (Ajalooline algseis oli: pausil testide alguses, väravaid pole jooksutatud, WIP `cb99b092`.)

**T24 lõpetatud 18.07 → `CODE_READY`, push'itud ja liidetud** (`origin/codex/field-v1 @ 919aa806` = local, worktree `C:\Users\rauds\Desktop\SotsiaalAI-field-v1` puhas, baas `082d8efa`, liidetud kohalikku main-i `662b6e8a`; backup `backup/field-v1-pre-rebase-2026-07-18 @ cb99b092`). Tooteomanik andis selgesõnalise **jadatöö-erandi** T24 pargist tagasitoomiseks; **T07 haru ei puudutatud.**

- **Rebase:** 95 commit'i vahet, 10 konflikti (kõik additiivsed liidud: mentorlus+välitöö kõrvuti). `workspaceContinuity` prioriteedid ühendatud nii, et mõlema poole suhteline järjekord säilib (`field_visit` tippu, `mentoring` olemasolevate järele). Tõlkefailid liidetud programmaatiliselt (3-way JSON, 0 päris konflikti) ja sisestatud kirurgiliselt → **+218 rida puhast lisandust, 0 ümbervormindust**.
- **WIP-i leitud vead (parandatud):** (1) `lib/field/service.js` sisaldas hash-eraldajana **literaalset NUL-baiti** → git luges faili binaarseks (diffi polnud, rebase/merge oleks katkenud); asendatud `"\u0000"`-ga, käitumine bait-täpselt sama. (2) migratsiooni järjekord (vt ülal). (3) kasutamata import + `useMemo`-ta `|| []` hook-deps.
- **Etapid:** E1–E9 olid WIP-is sisuliselt juba terviklikud (3 mudelit + `FIELD_PHOTO`, 6 API-rada omaniku-skoobitud 404-ga, SW-värav, UI, turvasignaal, retention-sweep, konto kustutus DB-kaskaadiga). **E10 oli 1/5 testifailist → nüüd 6 faili, 48 FIELD-testi.**
- **LEID + PARANDUS (päris viga):** 42 `field.errors.*` võtit olid koodis, aga puudusid **kõigist kolmest** keelefailist — `i18n:check` ei näinud, sest see kontrollib ainult et/en/ru **pariteeti** ja kõik kolm olid ühtviisi puudu. Iga serveripoolne välitöö-viga oleks kasutajale renderdunud toore võtmena. Põhjus: UI-võtmed camelCase (`loadFailed`), server viskab snake_case (`load_failed`). Lisatud 42 × 3 keelt + `tests/i18n/fieldKeys.test.js` hoiab augu suletuna.
- **Väravad (kõik rohelised):** **1691/1691 testi** (main 1642 + 49 uut), lint **0 viga** / 359 hoiatust (= main'i baasjoon; FIELD-i pinnad 0), `i18n:check` OK, `prisma validate` OK, **build** OK, **`db:migrate:check` 101-migratsiooni täisahel OK** (visatav localhost-proovibaas, eemaldatud).
- **SW-leping tõendatud käitumuslikult:** `swContract.test.js` käivitab `public/sw.js` võltsitud worker-globaalis ja surub läbi päris fetch-sündmused; **mutatsioonikontroll tehtud** — värava eemaldamisel kukuvad mõlemad põhitesti.
- **`NOT_PROVEN` (ausalt):** seadme-/brauserimaatriks (Android Chrome, iOS Safari 16.4+ PWA ja sakk, töölaud), päris kaamera/mikrofon/OCR runtime, Playwright sünteetiline offline↔online tervikvoog, päris-DB runtime väljaspool migratsiooniahelat. Need on lepingu käsitsi-QA osa ja kuuluvad T27 koondväravasse.
- **Teadlik kõrvalekalle lepingust:** online-dikteerimine taaskasutab `/api/documents/[id]/transcribe` (salvestatud helimanus), mitte lepingus nimetatud `/api/stt` (live-vootee). Funktsionaalselt kaetud, kirjas siin, et see ei kaoks.
- **Push'itud + liidetud kohalikku `main`-i** (`662b6e8a`); **EI serveris**.

**T24 lepingu-kõrvalekalded — tooteomanik VAATAS ÜLE JA VÕTTIS VASTU 18.07 („las jääb nii"). Need EI ole avastamata vead; ära „paranda" neid järgmises sessioonis ilma uue otsuseta:**

1. **DoD p7 („EI merge'i — koordinaator võtab vastu") — teadlikult üle astutud.** T24 liideti kohalikku `main`-i teostaja poolt. Omanik kinnitas, et jääb; tagasipööramist ei tehta.
2. **`lib/workspaces/provenance.js` jäi loomata.** Leping nõudis, et 8-väärtuseline päritolusõnastik elaks selles jagatud failis („EI kahte sõnastikku"). Praegu on see `lib/field/constants.js`-is (`FIELD_PROVENANCE`, väärtused ÕIGED, asukoht lepingu-vastane). Omanik võttis vastu. **⚠ TAGAJÄRG CASEWORK-P0-le:** see pakett plaanib luua `provenance.js` — kui ta teeb seda nullist, tekib teine sõnastik. CASEWORK-P0 peab kas taaskasutama `FIELD_PROVENANCE`-i või tõstma selle jagatud faili ja suunama FIELD-i sinna.
3. **DoD p1 ja p3 ei ole täidetud:** seadme-/brauserimaatriks ja Playwright sünteetiline tervikvoog on `NOT_RUN`. Seetõttu on aus nimi `CODE_READY`, mitte „valmis" → T27 koondväravasse.
4. Väiksemad, kirja pandud: E6 dikteerimine kasutab `/api/documents/[id]/transcribe` (mitte `/api/stt`); `syncApi` kvoodikatted testimata (jagatud `documents`-abilised pole süstitavad); `swContract` tehtud käitumusliku, mitte staatilise testina (ületab nõuet); DoD p6 lubatud-nimekirjast väljas 5 faili (`app/api/jobs/notifications/route.js`, `lib/notifications.js`, `lib/actions/registry.js`, `app/styles/globals.css`, `public/sw.js`) — kõik E4/E7/E8 poolt nõutud.

T23 `ESTA-MENTOR-V1` — **UUENDATUD 18.07: see lõik on aegunud, kehtib seisutabeli T23 rida.** Teema on terviklikult teostatud, rebase'itud `main`-i tipule (`e18acc3f`) ja **liidetud `main`-i** (`main @ 13d59449`, haru `codex/esta-mentor-v1 @ 8af9bcb5`, local=remote); ei ole serveris (push=deploy). (Ajalooline algseis oli: 18.07 WIP-kontrollpunkt `adc44f69`, väravaid pole jooksutatud, remote puudub.)

### Väljastusjärjekord (JADATÖÖ, kinnitatud 18.07)

Kolm teemat väljastati 18.07 paralleelselt (T10, T07, T02+T16). Jadatöö reegli jõustumisel need **järjestati ümber**; lepingud jäävad kehtima, kuid neid ei alustata korraga. Väljastatakse ükshaaval, iga järgmine alles siis, kui eelmine on `main`-i liidetud:

| Järjek. | Teema | Leping | Avab |
|---|---|---|---|
| ✓ | T24 `FIELD-V1` — **CODE_READY + MERGED_LOCAL 18.07** | `919aa806` → main `662b6e8a`, baas `082d8efa` | omaniku selgesõnaline jadatöö-erand (T07 jäi puutumata) |
| ✓ | T02+T16 LEPITUS | — | **DEPLOYED 18.07** → avas T09 |
| ✓ | **T09 `PAYMENTS-V1` — DEPLOYED 18.07** (`main @ 7b49e9f7` LIVE) | `t09-payments-v1-ulesanne.md` | baas `538ec4bb`; P1a/T02 ei cherry-pick'itud |
| ▶ | **T07 `DOCUMENTS-RESEARCH-V1` — TÖÖSSE 18.07 (aktiivne)** | `t07-documents-research-v1-ulesanne.md` | dokumendiruum; `codex/documents-research-v1`, baas `180d668f` |
| 1 | T10 `PUBLIC-V1` — T07 järel | `t10-public-v1-ulesanne.md` | avalikud pinnad |

**T09 `PAYMENTS-V1` — DEPLOYED 18.07** (`main @ 7b49e9f7` = server LIVE; `origin/main` on hiljem liikunud → `104d69d8`, mis sisaldab `7b49e9f7`; haru `origin/codex/payments-v1` push'itud; worktree `SotsiaalAI-payments-v1` puhas). Baas = `538ec4bb` (leping ütles `fe4eb4fa`/`cdbd9139` — JADATÖÖ reegel: praegune tipp). P1a `0aca8c4b` ja T02 olid juba main'is → cherry-pick'i EI tehtud. E1–E6 kõik teostatud (lukustatud O-M1…O-M6/O-J1…O-J4, testilepingud 1–9, DoD); väravad rohelised + päris-DB throwaway runtime 33/33; deploy: 1 additiivne migratsioon rakendatud, smoke roheline, DB-backup + rollback `538ec4bb`. `NOT_PROVEN`: brauseri-QA, päris Maksekeskus/callback/webhook/e-kiri, juristi/PCI (O-J1). T03 `chat-voice-v1` disainiotsus on TEHTUD (ühtne mikker) — vt seisutabel.

Kui mõni neist teemadest jõuab alustada ajal, mil `main` on vahepeal liikunud, kehtib jadatöö reegel: baas = `main`-i praegune tipp, mitte lepingus kirjas olev SHA.

## T06 vastuvõtu lõpetus

T06 Git-ahel, remote SHA, diff ja tööpuu puhtus on kontrollitud; registreid on uuendatud. Teostaja teste, buildi ega runtime'i ei korrata. T06 on `CODE_READY`, mitte main'is ega serveris. Runtime, cleanup ja migratsiooni DB-seis on ausalt tõendamata ning jäävad T27-sse. Merge'i ja deploy'd ei tehta.

## T06 kinnitatud otsused

- O-J1: autori konto kustutamisel jääb adressaadile anonüümne faktikiht ja tema märkmed.
- O-J2: Teekond saab iseseisva täislehe ning koostamisrajal on tagasi-nool ainult raja sees.
- O-J3: kasutaja saab Teekonna jäädavalt kustutada 2-sammulise kinnituse järel; seotud eelpöördumised jäävad, side katkeb ning enne pakutakse eksporti.

T06 on `CODE_READY @ f17a3c36`; TK-P0…P5 eraldi pakette ei avata. Haru hoitakse muutmata T27-ni.

## Mudelivalik

- Terra Medium: tavapärane terviklik frontend/backend teemaarendus.
- Sol Medium: suurema turva-, privaatsus-, migratsiooni- või keeruka olekumasina raskusega arendus.
- Terra High: kasuta ainult siis, kui teema vajab erakordselt laia repoülest integratsiooni; see ei ole vaikimisi valik.
- T06 soovitus: Sol Medium.
- Claude Fable 5 Low: ainult väike, madala riskiga ja selgelt piiritletud muudatus; mitte tervikliku T-teema jaoks.
- Claude Fable 5 Medium, kui see on valikus: hea vaikimisi tase tavapärase tervikliku teemaarenduse jaoks.
- Claude Fable 5 High: kasuta privaatsus-, turva-, migratsiooni-, retention'i-, kustutamis- või keeruka olekumasinaga tervikteemal. T06 soovitus Claude'i keskkonnas on Fable 5 High.
- Fable 5 kõrgeimat/max effort'i ei kasutata tavapärase lõpparuande vastuvõtuks ega dokumentide uuendamiseks; see kulutaks koordinaatoritöös limiiti tarbetult.

## Dokumentide muutmise reeglid

- Kasuta olemasolevaid dokumente; ära loo sama teema kohta uut konkureerivat registrit.
- Säilita paralleelsete sessioonide muudatused.
- Ära stage'i ega commit'i määrdunud põhitööpuu dokumente.
- Kasuta failimuudatusteks patch-meetodit.
- Pärast muutmist kontrolli dokumentide `diff --check` tulemust ja vastuolulisi aktiivseid staatuseid.
- Käesolevat faili uuendatakse pärast iga vastu võetud lõpparuannet nii, et „Praegune jätkamispunkt” ja järgmine arendus oleksid värsked.

## Lõppvastus kasutajale

Teata lühidalt:

- milline töö vastu võeti;
- millised Git-faktid kontrolliti;
- mida teadlikult uuesti ei testitud;
- milliseid kanoonilisi dokumente uuendati;
- mis on järgmine terviklik arendusteema;
- kas mõni otsus vajab kasutaja kinnitust;
- kinnitus, et merge'i ega deploy'd ei tehtud.
