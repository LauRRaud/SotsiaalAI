# SEIS — SotsiaalAI arenduse elav seisufail

STATUS: SINGLE SOURCE OF TRUTH

Viimati uuendatud: 2026-07-19 (**OTSUSTERING TEHTUD — 8 blokeerivat omaniku otsust langetatud:** T14 TO-1/TO-2 → **P2 VABA** (mitte kogu P2–P5: paketispetsi kontroll näitas, et P3 kannab O-WB-1/O-WB-5/O-WB-2a väravaid — varasem „P2–P5 avatud" oli sama päeva jooksul parandatud); T21 O-CW-2/3/4/10 → P2+P3 VABAD; ops-lülitid otsustatud, **serveris TEGEMATA**. Kolm rida selgus mitte-otsusena (O-CW-7 = jurist, T22 retention = juba otsustatud, T09 recurring/T20 = ei ole lüliti). Vt „Otsustering 19.07". — Varem samal päeval: **T22 SUPERVISION-V1 = LIVE — E1–E7 TERVIKUNA SERVERIS.** Omaniku luba „commit ja push ja deploy" 19.07. **Server = `origin/main` = kohalik `main` = `17b5d7cc`** (merge `codex/supervision-v1 @ 3fb5ec37`, haru push'itud). **0 migratsiooni** (`prisma migrate deploy`: „No pending migrations to apply", DB skeem muutumatu), npm ci + build OK, **3 teenust `active`**, **smoke 13/13 → 200** (senised 10 + `/supervisioon`, `/supervisioon/uus`, `/supervisioon/valjundid`), toodangus sisu kontrollitud (Minu supervisioon / Uus protsess / Minu paketid), DB-backup `~/sotsiaalai-db-backups/pre-deploy-17b5d7cc-20260719T085933Z.dump` (2,7 MB, 1214 TOC-kirjet, verifitseeritud), **rollback `ac0b7d3f`**. Väravad enne deploy'd: **1825/1825 testi, lint 0 viga, i18n OK, prisma validate OK, turbopack build OK**. **Brauseri-QA TEHTUD** (kõik 7 marsruuti mountisid, 401-olekud korrektsed, 0 konsooli-/serverviga) — jääb NOT_PROVEN ainult **autenditud läbiv voog** (nõuab SW/SP kasutajat + grant'i + andmeid) ja mobiilivaade. Koodijärjekorras avaneb **T12**. Vt „T22 teostus 19.07". — Varasem samal päeval: **T21 CASEWORK-V1 tuum E1+E2 = `MERGED_LOCAL`** — liidetud kohalikku `main`-i (`d27066c2`, merge `codex/casework-v1 @ 73c3953e`, omaniku loal) ja haru **push'itud origin'i** (`origin/codex/casework-v1 @ 73c3953e`); **LIVE serveris `ac0b7d3f` (19.07 deploy, smoke 10/10, rollback `ae59516f`)**. Tuum = provenance-konsolideerimine (FIELD_PROVENANCE → jagatud `lib/workspaces/provenance.js`, FIELD-regressioon roheline) + read-only adapterid (preInquiryReceiver/caseArtifact) + vastuvõtulaua ettevalmistuspaneel; 0 migratsiooni; **1743/1743 testi + lint 0 + i18n + prisma + build OK**; VÄLJAS P2–P6 (STAR2/Meetodipeegel/genogramm/ökokaart — O-CW + O-CW-7 õigusanalüüs); vt „T21 teostus 19.07". **Samal päeval: T14 WELLBEING-V2 tuum samuti LIVE** (`8eb3430b`, deploy'tud sama 19.07 aknaga); vt „T14 teostus 19.07". — Varasem, 2026-07-18 õhtul: **ÕHTU-UUENDUS:** T07 E3 TEHTUD, push'itud (`origin @ 6dbb6752`) ja **liidetud kohalikku main-i** (`729b09f0`) — T07 SKOOBIOTSUS JÄÄB LAHTISEKS (omanik: „otsustan hiljem"; 4 lepingu-jääki vt „T07 E3 18.07 õhtul"); `lint-debt-cleanup` commit'itud (`c674a3ec`) ja **liidetud main-i** (`072ec70e`) — hoiatused 359→50, 0 viga; **main uus tipp = `072ec70e`**, väravad merge'itud main'il: **1727/1727 testi + i18n OK + prisma validate OK** (lint/build kontrollitud eraldi ridades); seisutabelisse lisatud **Teemakaart T01–T28**. **ÕHTU-DEPLOY TEHTUD: server = `ae59516f` (= main = origin/main)** — 2 migratsiooni rakendatud (`field_v1_mobile_shell`, `documents_research_v1`), smoke 8/8 → 200, DB-backup `pre-deploy-ae59516f-20260718T205612Z.dump`, rollback `104d69d8`; **avastus:** enne õhtu-deploy'd oli server juba `104d69d8` (T23 + T09-timerikood juba serveris; varasem „server 7b49e9f7" väide oli aegunud). **PÄEVANE DEPLOY TEHTUD:** local `main` `adc83829` → server LIVE; 6 migratsiooni rakendatud, smoke roheline, DB-backup võetud. **T03 disainiotsus LAHENDATUD:** ühtne mikker võidab, spatial-entry hüljatud. **T09 PAYMENTS-V1 DEPLOYED** — `main @ 7b49e9f7` LIVE serveris (baas `538ec4bb`), väravad + päris-DB runtime 33/33; migratsioon rakendatud, smoke roheline, DB-backup võetud, rollback `538ec4bb`; järgmine kooditeema = T10. **Ops-fixid: research-worker live + Turbopack puhas; server `efd275f1`.** **T23 mentorlus rebase'itud + liidetud local `main`-i `13d59449` (1642/1642 testi), EI serveris**. **T24 FIELD-V1 = `CODE_READY`** — `origin/codex/field-v1 @ 919aa806`, E10 testid kirjutatud, 42 puuduvat veatõlget parandatud; **push'itud + liidetud kohalikku main-i** (`662b6e8a`) koos kahe pargitud korrastusharuga (`admin-analytics-honesty`, `usage-reservation-reaper`); T07 rebase'itud + migratsiooniviga parandatud + push'itud. **Kohalik main (viimane kood `032a1e6d`) on `origin/main`-ist ees — push'imata, EI serveris**)

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

**KOHALIK `main` = `origin/main` = SERVER = `17b5d7cc` (19.07 TEINE DEPLOY — T22 SUPERVISION-V1 täis-V0 LIVE; rollback `ac0b7d3f`).** Varasem samal päeval: `ac0b7d3f` (T14 + T21 tuumad). **19.07 DEPLOY:** server `ae59516f` → `ac0b7d3f`, ff (T14 WELLBEING + T21 CASEWORK, kõik additiivne), **0 uut migratsiooni** (`prisma migrate deploy`: „No pending migrations to apply", DB skeem muutumatu), npm ci + build OK, 3 teenust `active`, **smoke 10/10 → 200** (`/`, `/vestlus`, `/meist`, `/tellimus`, `/voimalused`, `/valitoo`, `/documents`, `/teemaseemned`, `/eelpoordumised`, `/tooheaolu`), DB-backup `~/sotsiaalai-db-backups/pre-deploy-ac0b7d3f-20260719T060140Z.dump` (2,80 MB, verifitseeritud), **rollback `ae59516f`**. Ajalooline (18.07 ÕHTU-DEPLOY, kood `072ec70e` + otsuste-docs): Viimane KOODI-commit main'is = **`072ec70e`** (lint-debt-cleanup merge; selle all `729b09f0` T07 E3 merge, `c429bf4a` P2-6, `032a1e6d` reaper). Sisaldab lisaks T09-le: T23 mentorlus, **T24 FIELD-V1**, `admin-analytics-honesty` (M2), `usage-reservation-reaper` (PERF L4). Väravad integreeritud main'il rohelised: **1700/1700 testi (P2-6 järel; enne 1696), lint 0 viga, i18n OK, prisma validate OK, build OK, 101-migratsiooni ahel OK**. **18.07 õhtu-deploy (`ae59516f`) tõi:** T24 välitöö, T07 E3, admin-honesty M2, reaper-koodi (units INAKTIIVSED), P2-6, lint-debt; **T23 mentorlus oli juba enne serveris** (`104d69d8`-ga, avastatud õhtul — varasem „T23 EI serveris" oli aegunud). Õhtu-deploy: 2 additiivset migratsiooni (`field_v1_mobile_shell`, `documents_research_v1`) rakendatud, build OK, 3 teenust `active`, **smoke 8/8 → 200** (`/`, `/vestlus`, `/meist`, `/tellimus`, `/voimalused`, `/valitoo`, `/documents`, `/teemaseemned`), DB-backup `~/sotsiaalai-db-backups/pre-deploy-ae59516f-20260718T205612Z.dump` (2,79 MB, 1196 TOC, verifitseeritud), **rollback `104d69d8`**. **T09-deploy 18.07** (`538ec4bb`→`7b49e9f7`): ff, 1 additiivne migratsioon (`20260719120000_payments_v1`) rakendatud prod-DB-le, npm ci + build roheline, 3 teenust `active`, smoke roheline (`/` `/vestlus` `/meist` `/tellimus` `/voimalused` → 200). **T09 tööliste ajastus (`604fe898`, main'is, deploy'mata):** `scripts/subscription-reconcile.mjs` + `scripts/payment-emails.mjs` + `ops/systemd/sotsiaalai-{payment-emails,subscription-reconcile}.{service,timer}` — **inaktiivsed** üksused; e-posti outbox ja reconcile EI jookse enne käsitsi `enable`-t + võtmeid (vt `ops/systemd/README-payment-workers.md`). Verifitseeritud: 9/9 shim-kontrolli + lint + diff-check; 0 jagatud faili (ainult `ops/`+`scripts/`+`docs/`). Rollback-SHA `538ec4bb`; DB-backup `~/sotsiaalai-db-backups/pre-deploy-7b49e9f7-20260718T141532Z.dump` (2,75 MB, 1114 kirjet, taastatav). Server `SUBSCRIPTION_RECURRING_ENABLED=0` (variant A) + `PAYMENT_TOKEN_ENC_KEY` seadmata → recurring-token krüpto on **fail-closed dormant** (recurring rada ei aktiivne; enne recurring'u sisselülitamist tuleb võti seada). Eelmine deploy (ajalooline): põhi-deploy `adc83829` + ops-fix `efd275f1`. **Ops-fixid 18.07 (live+tõendatud):** (1) `sotsiaalai-research-worker.service` paigaldatud + `active`+stabiilne (fix: `--conditions=react-server`, sest `pipeline.js`→`@/lib/server/ragAuth`→`server-only` crash-loopis standalone node's; repo alla `ops/systemd/`) — [[perf-cost-audit]] L1 **worker-osa** lahendatud, **kvoodileke JÄÄB** (PERF-P0); (2) Turbopack NFT-hoiatused 10→0 (`lib/dataExport/service.js`). Rollback-SHA `fe4eb4fa`; DB-backup `~/sotsiaalai-db-backups/pre-deploy-adc83829-20260718T111528Z.dump` (2,69 MB, taastatav).

### Teemakaart T01–T28 (koondvaade, 18.07 õhtul)

Olekusõnastik: **LIVE** = serveris toodangus · **MAIN** = kohalikus `main`-is, EI serveris · **TÖÖS** = aktiivne kooditöö · **OTSUS** = ootab omaniku otsust · **ANALÜÜS** = analüüs/audit valmis, kood alustamata · **OOTEL** = järjekorras või teadlikult edasi lükatud · **—** = alustamata.

| # | Teema | Olek | Märkus |
|---|---|---|---|
| T01 | ADMIN-V1-CORE | **LIVE** | 18.07 integratsioon |
| T02 | ACCOUNT-V1 | **LIVE** | T02+T16 lepituse kaudu |
| T03 | CHAT-VOICE-V1 | **OOTEL** | omaniku otsus 18.07 õhtul: TEADLIKULT PARGITUD — voice = hiljem; haru `7bdd1288` = arhiiv/retsept; mitte-häälne sisu (kriis EN/RU, aus Stop, kvoodivärav) nopitakse tulevikus väikese paketina |
| T04 | WORKSPACE-EVENTS-V1 | **LIVE** | |
| T05 | WORKBENCH-V1 | **LIVE** | |
| T06 | JOURNEY-V1 | **LIVE** | |
| T07 | DOCUMENTS-RESEARCH-V1 | **LIVE (skoobitud)** | tuum + DoD kõvad nõuded LIVE (`ae59516f`); 3 naaberpinna-integratsiooni teadlikult edasi lükatud — vt „T07 sulgemine 18.07" |
| T08 | FILES-MEDIA (Failid) | **OOTEL** | omaniku otsusega hilisemaks; riskid jäävad registrisse |
| T09 | PAYMENTS-V1 | **LIVE** | `7b49e9f7`; recurring teadlikult väljas; töölise-timerid inaktiivsed |
| T10 | PUBLIC-V1 | **OOTEL** | 18.07 õhtu ümberprioriseerimine: release-raja algus, käivitub kui omanik tahab turule (EI ole enam T07 järel) |
| T11 | SERVICE-MEDIATION-V1 | **LIVE** | |
| T12 | ROOMS-CALLS-V1 | **LEPING VALMIS — JÄRGMINE kooditeema** | otsustering + leping `t12-rooms-calls-v1-ulesanne.md` valmis 18.07; **T22 kood valmis 19.07 → T12 järg avanenud** |
| T13 | COVISION-V2 | **LEPING VALMIS (prototüüp-esimene)** | V1 backend LIVE+tõendatud; leping `t13-covision-v2-ulesanne.md` = Faas A prototüüp (kohustuslik värav) → Faas B tootmine; **avab varem DEFERRED teema**; R13-D8 (kaks lehte) otsustab prototüüp; EI taaskäivita T19 |
| T14 | WELLBEING-V2 | **LIVE** | E1+E2 tuum liidetud kohalikku `main`-i `8eb3430b` (merge `codex/wellbeing-v2 @ 981682c0`, baas `e0a78632`, omaniku loal 19.07), **LIVE serveris 19.07 (`ac0b7d3f`)**; kirjete lugemis-/kustutusrada + „Minu kirjed" naasmisvaade + V6 continuity + `wellbeing_space` adapter (SUPPORTED); 0 migratsiooni; **1736/1736 testi + väravad rohelised**; **P2 AVATUD 19.07** (TO-1 = paranda uue kirjena, TO-2 = U1 sündmus + badge e-kirjata) → leping `t14-wellbeing-v2-kontrollpunkt-ulesanne.md`; **P3 endiselt kinni** (O-WB-1 nädalakirje kuju + O-WB-5 PAUSED-semantika + O-WB-2a admin-maskimine), P4 (TO-8), P5 (TO-3/4/5/7/9), org-koond (O-WB-3 õigusanalüüs) — vt „Otsustering 19.07" + „T14 teostus 19.07" |
| T15 | A11Y/RV | osaliselt LIVE | a11y-i18n P0 LIVE; RV-P1+ ja tõlkestrateegia tegemata |
| T16 | EXPORT-V1 | **LIVE** | lepituse kaudu |
| T17 | SEARCH-LANGUAGE-V1 | **LIVE** | |
| T18 | PERF | osaliselt LIVE | L1 worker LIVE; L4 reaper-kood serveris (units INAKTIIVSED, vaikimisi väljas); kvoodileke + L3 timerid + L5 kuluajalugu tegemata |
| T19 | SPATIAL-WORKSPACE-V1 | **OOTEL** | DEFERRED omaniku otsusega; prototüüp main'is viitena; ükski teema ei oota |
| T20 | COLLAB-V1 | **—** | O-CO otsused lahtised |
| T21 | CASEWORK-V1 | **LIVE** | liidetud kohalikku `main`-i `d27066c2` (merge `codex/casework-v1 @ 73c3953e`, baas `ae997dbd`, omaniku loal 19.07), haru push'itud origin'i, **LIVE serveris 19.07 (`ac0b7d3f`, smoke 10/10)**; otsustevaba tuum = provenance-konsolideerimine (FIELD_PROVENANCE → jagatud `lib/workspaces/provenance.js`, FIELD-regressioon roheline) + read-only adapterid + vastuvõtulaua ettevalmistuspaneel; 0 migratsiooni; **1743/1743 testi + väravad rohelised**; **P2+P3 AVATUD 19.07** (O-CW-4 = konteiner kohe, O-CW-2 = kirjutuskaitse+12 kuud, O-CW-10 = fakt+väljade loend, O-CW-3 = kinnitatud); **P4/P5 blokeeritud O-CW-7 jurist-analüüsiga**; P6 ootab O-CW-5 partnerit — vt „Otsustering 19.07" |
| T22 | SUPERVISION-V1 | **LIVE** | **E1–E7 TERVIKUNA 19.07** — haru `codex/supervision-v1 @ 3fb5ec37` push'itud, liidetud main'i (`17b5d7cc`), **LIVE serveris `17b5d7cc`** (smoke 13/13, rollback `ac0b7d3f`, 0 migratsiooni); väravad: 1825/1825 testi, lint 0 viga, i18n OK, prisma OK, build OK; brauseri-QA tehtud; NOT_PROVEN = autenditud läbiv voog + mobiil — vt „T22 teostus 19.07" |
| T23 | ESTA-MENTOR-V1 | **LIVE** | oli juba `104d69d8`-ga serveris (avastatud 18.07 õhtul) |
| T24 | FIELD-V1 | **LIVE** | õhtu-deploy 18.07 (`ae59516f`) |
| T25 | ORG-V1 | **ANALÜÜS** | ootab release candidate'i |
| T26 | PILOT-PARTNER-V1 | **ANALÜÜS** | piloodikoodi ei avata enne RC-d |
| T27 | OPS-FINAL-A0 | värav | teadlikult käivitamata; koondab edasi lükatud QA-d |
| T28 | RAG-V1 | **LIVE** | saba: P8.6 päris allikate proovipakk + timeri aktiveerimine (omaniku otsus) |

Kokku (18.07 hilisõhtu, T07 sulgemise järel): **13 LIVE** (sh T07 skoobitud), 0 aktiivset kooditeemat, 1 JÄRGMINE (T12), 6 ANALÜÜS, 4 OOTEL (sh T03 pargitud, T10 release-ootel), 2 osaliselt, 1 alustamata (T20), 1 värav (T27). T07-l 3 edasi lükatud naaberpinna-integratsiooni (mitte augud). Harutasandi korrastus `lint-debt-cleanup` on main'is JA serveris.

### Töö järjekord (jadatöö)

| # | Teema | Olek | Haru / SHA | Avab |
|---|---|---|---|---|
| ✓ | T24 `FIELD-V1` | **`MERGED_LOCAL` 18.07 — push'itud + liidetud kohalikku `main`-i** | `origin/codex/field-v1 @ 919aa806` → `main @ 662b6e8a`, baas `082d8efa`, 45 faili `+7367/−22` | — |
| 2 | T02+T16 `LEPITUS` | **`DEPLOYED` — main'is `d2860b0b`, **LIVE serveris 18.07** (`adc83829`). Väravad: 1582 testi, 98-migr ahel, build; 6 migratsiooni rakendatud prod-DB-le** | `codex/t02-t16-remerge @ a6f683a6` → `main` | **T09 avatud** |
| ✓ | **T07 `DOCUMENTS-RESEARCH-V1`** | **`CLOSED_SCOPED` 18.07 hilisõhtul (omanik: „sulge T07")** — sisuline tuum + DoD kõvad nõuded VALMIS ja LIVE; 3 naaberpinna-integratsiooni teadlikult edasi lükatud (vt „T07 sulgemine 18.07") | `codex/documents-research-v1 @ 6dbb6752` = remote, merge main-i `729b09f0`, LIVE server `ae59516f`; väravad: **1727/1727 testi + i18n + prisma + build + lint 0 viga** | **sulgemine avab T12** |
| — | T10 `PUBLIC-V1` | `QUEUED` — T07 järel | leping `t10-public-v1-ulesanne.md` | avalikud pinnad |

### Tegevusjärjekord orienteerumiseks (koostatud 18.07 õhtul)

Viis astet; igaüks avaneb eelmisest. Otsused (A) ei ole kooditöö ja võivad langeda igal ajal.

**A. OTSUSED (omanik, 18.07 — KÕIK KOLM LANGETATUD):**
1. ~~**O1 — T07 skoop**~~ — **OTSUSTATUD 18.07 hilisõhtul: SULETUD kitsendatud skoobiga (`CLOSED_SCOPED`).** Sisuline tuum + DoD kõvad nõuded (sh E1 provenance-riba, mis oli tegelikult koodis) VALMIS ja LIVE; 3 naaberpinna-integratsiooni (chat „Salvesta analüüs", E5 T04-sündmused, E4 geo-UI) teadlikult edasi lükatud — vt „T07 sulgemine 18.07". **T12 nüüd vaba.**
2. ~~**O2 — deploy-aken**~~ — **OTSUSTATUD JA TEOSTATUD 18.07 õhtul:** server = `ae59516f`, 2 migratsiooni, smoke 8/8, backup + rollback `104d69d8` (vt seisutabel).
3. ~~**O3 — T03 saatus**~~ — **OTSUSTATUD 18.07 õhtul: TEADLIK PARKIMINE.** Omanik: sisenemisvalikut (hääl-vs-tekst) ei kasutata (oli juba 18.07 hommikul hüljatud); voice-vestlus ise = „kunagi tuleb arendada", MITTE praegu. Haru `codex/chat-voice-v1 @ 7bdd1288` jääb arhiiviks/retseptiks; rebase'i EI tule. **NB mitte-häälne sisu nopitakse tulevikus välja väikese paketina värske main'i peal:** E1 kriis EN/RU fail-closed + E2 aus Stop (=PERF L2 kulukaitse) + E3 kvoodivärava sulgemine — need EI ole hääle-spetsiifilised.

**B. KOODIJÄRJEKORD (jadatöö, üks korraga; omaniku ümberprioriseerimine 18.07 — funktsioonid enne release'i, sest arendustööriistad on praegu võimsad):**
1. ~~T07~~ — **SULETUD 18.07 (`CLOSED_SCOPED`).** Ükski kooditeema pole enam aktiivne → T12 võib alata.
2. ~~T22~~ — **LIVE 19.07.** E1–E7 tervikuna; push + merge + deploy tehtud omaniku loal, server `17b5d7cc`, smoke 13/13. Vt „T22 teostus 19.07".
3. **T12 ROOMS-CALLS-V1** — **JÄRGMINE kooditeema** (leping valmis `t12-rooms-calls-v1-ulesanne.md`, 6 otsust lukus); T22 kood ei blokeeri enam.
4. **T14 WELLBEING-V2 ja T21 CASEWORK-V1** — **lepingud VALMIS (otsustevabad tuumad)**, ootel; `t14-…` = kirjete lugemisrada+adapter (P0+P1), `t21-…` = provenance-konsolideerimine+adapterid+ettevalmistuspaneel (P0+P1). Mõlema hilisemad viilud vajavad otsuseid (T14: TO-1/TO-2 rütmiks; T21: O-CW-2/3/4/10 + O-CW-7 õigusanalüüs võrgustikuvaadetele). T13 Kovisioon V2 võib T19 tagasi lauale tuua.
5. **T10 PUBLIC-V1 + release-rada (D) nihkub plokki „siis, kui omanik tahab turule".**

**C. VAHEPALAD teemade vahele (väikesed, otsustevabad, sobivad ka ootepäevadele):**
- lint-debt jätk: `WorkspaceFeaturePage.jsx` 27 hardcoded-stringi + ülejäänud (50 → 0 hoiatust);
- PERF-P0 ülejäänu: kvoodileke, L3 renewals-timerid, L5 kuluajaloo retention;
- T03-st nopitav mitte-häälne pakett (värske main'i peal, haru `7bdd1288` = retsept): kriis EN/RU fail-closed + aus Stop (kattub PERF L2-ga) + kvoodivärava sulgemine;
- EXPORT-P0 jääk: **ainult PDF kirillitsa** — GDPR-andmekoopia rada on T16-ga JUBA LIVE (`lib/dataExport/{registry,service,zip}.js`); alles on `lib/chat/exportDocument.js`, mis koostab PDF-i käsitsi `/BaseFont /Helvetica` + latin1-puhvritega → kirillitsa (ja tõenäoliselt õäöü) murdub. Kontrollitud koodist 19.07; varasem „GDPR-andmekoopia rada puudub" oli aegunud;
- A11Y-I18N-P0: ainult tõlkefailid, 0 tooteotsust;
- RAG-QM-P0 baasjoon (enne mistahes otsinguparandusi) — **19.07 otsusega blokeerib see ka P8.6 päris allikate proovipaki**.

**D. RELEASE-RADA (käivitub omaniku otsusel „lähme turule"; algab T10-ga):**
0. **T10 PUBLIC-V1** — avalikud pinnad (leping `t10-public-v1-ulesanne.md` valmis).
1. **T27 OPS-FINAL-A0** — RC koondvärav: kõik edasi lükatud QA-d (brauseri-/seadmematriks, Playwright, päris Maksekeskus/e-kirjad, juristi kinnitused, täissviidid+sõltumatud auditid).
2. **P8.6** päris allikate proovipakk + RAG-timerite aktiveerimine (omaniku otsus, sobib RC ümber).
3. **T25 ORG + T26 PILOT** — alles RC järel (G3 eeldused: T27 RC + TK-P0 + U1-P0).

**E. RC/PILOODI JÄREL, omaniku prioriseerimisel:** T12 (audit+pingerida ptk 20 olemas), T13 COVISION-V2, T14 E1–E6, T21 CASEWORK (CASEWORK-P0 tehniliselt vaba — K1-P0 main'is; NB `provenance.js` hoiatus T24 lõigus), T22 SUPERVISION (SUP-P0 skeemipakett valmis), T15 RV-P1 + tõlkestrateegia, T20 COLLAB (O-CO otsused lahtised), T08 FAILID (omaniku otsusega hilisemaks), T19 (DEFERRED, keegi ei oota).

### Paralleelne mittekooditöö (jadatöö reegel lubab)

| Teema | Olek | Leping | Teenib |
|---|---|---|---|
| DEPLOY-A0 valmiduse audit | **`EXECUTED` 18.07 — GO täidetud, deploy LIVE** | väljund: `deploy-a0-valmiduse-audit-2026-07-18.md` | mõlemad eeltingimused täidetud (DB `pg_dump` võetud+verifitseeritud; server-build madala koormusega, 4.5 GB vaba); server `adc83829`, smoke roheline |

### Pooleli, ei ole järjekorras

| Teema | Olek | Haru / SHA | Märkus |
|---|---|---|---|
| T23 `ESTA-MENTOR-V1` | **`MERGED_LOCAL` — rebase'itud + liidetud `main`-i** | `codex/esta-mentor-v1 @ 8af9bcb5` → `main @ 13d59449`, baas `e18acc3f` | 6 konflikti lahendatud (additiivne liit T16 DATA_EXPORT + supervisioon + mentorlus); migratsioon ümber nimetatud `20260719130000_mentoring_v1` (main-i uusimast hilisem, järjekord ohutu); väravad rohelised: **1642/1642 testi + 100-migr ahel + build + i18n + lint + päris-DB runtime PASS**; `NOT_PROVEN`: brauseri-QA, seadme-a11y. **LIVE serveris — oli juba `104d69d8`-ga deploy'tud (avastatud 18.07 õhtul)** |
| `admin-analytics-honesty` | **`LIVE` — õhtu-deploy 18.07** | `origin/codex/admin-analytics-honesty` → `main @ a1533356` → server `ae59516f` | M2 vaikiv 500-lagi: aus „Kuvatud X-Y / N" + paginatsioon + truncated-hoiatus; rebase puhas, 5 faili `+97/−2` |
| `usage-reservation-reaper` | **kood `LIVE` — õhtu-deploy 18.07; unit'id INAKTIIVSED** | `origin/codex/usage-reservation-reaper` → `main @ 032a1e6d` → server `ae59516f` | PERF-P0 kvoodileke (L4): aegunud RESERVED-hoidude koristaja; **vaikimisi VÄLJAS** (unit'id inaktiivsed, lipp seadmata — aktiveerimine = omaniku otsus); puhtalt additiivne, 7 uut faili `+515/−0` |
| `lint-debt-cleanup` | **`MERGED_LOCAL` 18.07 õhtul** | `codex/lint-debt-cleanup @ c674a3ec` → **main `072ec70e`** (push'imata remote'i) | Lint-võla koristus: surnud CovisionSession.jsx kustutus (`3cd035ac`, `−3187`) + TeemaseemnedPage i18n-ekstraktsioon (`c674a3ec`, 4 faili `+504/−90`, 88 võtit ×3 keelt). **Lint-hoiatused 359 → 50 (0 viga)**; väravad merge'itud main'il rohelised. Suurim allesjäänud hoiatuspesa: `WorkspaceFeaturePage.jsx` 27 hardcoded-stringi. Reeglimärkus: töö käis põhitööpuus (sama muster mis P2-6) |
| T03 `CHAT-VOICE-V1` | **`PARKED_DELIBERATE` 18.07 õhtul (omaniku otsus)** | `origin/codex/chat-voice-v1 @ 7bdd1288` — 113+ commit'i main-ist taga, jääb NII | omanik 18.07 õhtul: voice-vestlus = „kunagi tuleb arendada", MITTE praegu; sisenemisvalik (hääl-vs-tekst) oli juba hommikul hüljatud (ühtne mikker main'is). **Rebase'i EI tule; haru = arhiiv/retsept.** Kui voice avaneb, tehakse E1–E5 uuesti värske main'i peal, haru diff on disainiretsept. **Mitte-häälne sisu läheb varem väikese paketina** (kriis EN/RU fail-closed + aus Stop (=PERF L2) + kvoodivärav) — vt tegevusjärjekord C |
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

**T09 lõpetatud (18.07):** push + merge + **deploy TEHTUD** kasutaja loal → `main @ 7b49e9f7` LIVE serveris. **T07 `DOCUMENTS-RESEARCH-V1` — WIP-kontrollpunkt 18.07** (*SHA-d selles lõigus on AJALOOLISED, rebase'i-eelsed; kehtiv seis = seisutabeli T07 rida ja allpool „T07 korrastus 18.07"*) (`codex/documents-research-v1 @ db3589f5`; baas `180d668f` = T09 sees; worktree `SotsiaalAI-documents-research-v1` puhas; alusdependents T28/T17/T16 juba main'is; **2 commit'i**: WIP `b94f9370` + E2 analüüs `db3589f5`). **TEHTUD** (väravad rohelised: **täissviit 1632/1632** + lint + i18n + 100-migr ahel + build + diff-check): E1 owner-404 (12 rada, foreign-id == missing-id, T28 cross-tenant piir puutumata), E2 püsiv mustand (`persistArtifactDraft`, `AgentArtifact.idempotencyKey` + `SavedAnalysis` mudel), **E2 salvestatav analüüsiobjekt** (`lib/documents/savedAnalysis.js` + `/api/documents/analyses` CRUD, owner-404, püsiv disclaimer "AI selgitus, mitte ametlik otsus", allika-omandikontroll, 6 uut testi), E4 uuring elab üle nav (stop vs detach), E5 meeting-summary snapshot fail-closed kustutus. **NOT_DONE:** E2 Journey "Lisa dokument analüüsiks" side (sõltub E3 analüüsiraja URL-ist) + chat "Salvesta analüüs" nupp, **~~E3 ühtne /documents tööruum (suurim tükk, puutumata)~~ → E3 TEHTUD 18.07 õhtul (`6dbb6752`); provenance/privaatsus-riba on koodis OLEMAS (varasem „jäi välja" oli vale — vt „T07 sulgemine 18.07")**, E5 T04-sündmused (tihe registry/projector-integratsioon), E4 ulatuse/geo-UI. **NOT_PROVEN:** autenditud brauser + päris-RAG/worker runtime. T10 `PUBLIC-V1` = lõputeema (omaniku otsus 18.07), EI järgmine.

**T07 korrastus 18.07** (ainult tehniline, sisu EI arendatud): haru rebase'itud main-i tipule `032a1e6d` (konflikte 0) ja **push'itud** → `origin/codex/documents-research-v1 @ e49834e3`. **Parandatud migratsiooni ajatempli põrge:** `20260719130000_documents_research_v1` kandis SAMA ajatemplit kui juba main-i liidetud `20260719130000_mentoring_v1` ja sorteerus sellest tähestikuliselt ETTE (`documents_` < `mentoring_`) → ümber nimetatud `20260719150000_documents_research_v1`. Rebase'i-järgsed väravad: **1710/1710 testi + i18n OK + 102-migratsiooni ahel OK**.

**T07 E3 18.07 õhtul — TEHTUD ja commit'itud** (`6dbb6752`, 11 faili `+1153/−665`, EI skeemimuudatust ega migratsiooni): `lib/documents/workspace.js` ühtse tööruumi mudel (dokumendid+artefaktid+analüüsid+uuringud), `DocumentsPage` ümber ehitatud ühtseks tööruumiks, `GET /api/research/jobs` owner-scoped loend paginatsiooniga (lugemine lubatud ka siis, kui uute loomine väljas), 2 uut testifaili + 88 tõlkevõtit ×3 keelt. Väravad E3 peal worktree's: **1723/1723 testi, lint 0 viga / 359 hoiatust, i18n OK, prisma validate OK**; 102-migr ahel kehtib rebase'ist. **18.07 õhtul omaniku loal: push'itud (`origin @ 6dbb6752`) + liidetud kohalikku main-i (`729b09f0`) + LIVE serveris (`ae59516f`)**; merge'itud main'i väravad: 1727/1727 + i18n + prisma + build + lint 0 viga. **Kahe sessiooni intsident:** koodi kirjutas üks sessioon, commit'is teine (sisu bait-täpselt, väravad üle jooksutatud); õppetund = üks worktree, üks sessioon korraga.

### T07 sulgemine 18.07 (omanik: „sulge T07") → `CLOSED_SCOPED`

**Enne sulgemist kontrollisin lepingu jäägid koodist (mitte oletusest) — pilt oli parem kui varasem märge.** Sulgemine on aus, sest sisuline tuum ja DoD kõvad nõuded on täidetud ja LIVE:

| Lepingu tükk | Tegelik seis (kontrollitud) |
|---|---|
| **E1 päritolu/privaatsusriba** | ✅ **KOODIS OLEMAS** — `describeProvenance()` ([DocumentsPage.jsx:546](components/documents/DocumentsPage.jsx)) + `documents-provenance` dl 5 väljaga (kes näeb/päritolu/olek/kehtivus/otsing); täidab `lib/documents/presentation.js` + `workspace.js` iga objektitüübi kohta; i18n 3 keeles. **Varasem SEIS-märge „provenance jäi E3-st välja" oli VALE — parandatud.** |
| E2 salvestatav analüüs (tuum) | ✅ SavedAnalysis CRUD + püsiv mustand |
| E2 Journey „Lisa dokument analüüsiks" | ✅ **JUBA wire'itud** — `components/journey/JourneyDetail.jsx:1446` + link `/documents` |
| E3 ühtne tööruum | ✅ LIVE |
| E4 uuring elab üle nav (tuum) | ✅ stop-vs-detach |
| E5 kustutus + snapshot-purge (tuum) | ✅ |
| **DoD kõva nõue: cross-tenant piir serveris** | ✅ tõendatud (DOK-XTEN P0, `tests/rag/agentDocumentIsolation.test.js` 4/4) |

**Teadlikult edasi lükatud (3 naaberpinna-integratsiooni — EI augud dokumendifunktsioonis, EI privaatsus/korrektsus; ära „paranda" järgmises sessioonis ilma uue otsuseta):**
1. **Chat „Salvesta analüüs" nupp** — sisenemispunkt vestlusest → dokumentidesse. SavedAnalysis API (`/api/documents/analyses`) OLEMAS, UI-päästik chat'is puudub. Kuulub chat-pinna järgmisse töösse.
2. **E5 T04 tööruumisündmused** — dokumendimuutus → T05 töölaua „mis muutus" voog. Registris dokumendi-domeenisündmusi pole. Kuulub T05/U1-sündmuskihi järgmisse töösse.
3. **E4 ulatuse/geo-UI viimistlus** — polish, mitte tuum.

**NOT_PROVEN (T27 koondväravasse):** autenditud brauser + päris-RAG/worker runtime. **DoD-kõrvalekalle (nagu T24):** leping ütles „main/server/merge/deploy puutumata" — tegelikult merge'itud + deploy'tud omaniku selgel loal; kirjas, et nähtav oleks. **Sulgemine avab T12 ROOMS-CALLS-V1.**

**T07 E1 cross-tenant RAG-küsimus — VASTATUD 18.07: leket EI OLE, piir oli juba suletud (DOK-XTEN P0, mitte T28).** Seetõttu ei olnudki T07 harus ühtegi RAG-faili vaja muuta. Jälitatud tervikahel:

1. Kasutaja dokumendid **on** RAG-is, aga **eraldi privaatses kollektsioonis** — päring käib `/search/agent-documents` pihta serveris koostatud `doc_ids` lubatute-loendiga (`lib/documents/search.js`); kliendipoolset `where`-filtrit ei saadeta.
2. `searchDocumentChunks`-il on **täpselt üks kutsuja** (`buildRetrievedEvidence`, `lib/documents/generation.js:228`), mille `documents` tuleb kahest eksporditud sisenemispunktist.
3. **Kõik neli kutsujat on omaniku-skoobitud:** `artifacts/generate/route.js:104`, `artifacts/refine/route.js:132`, `artifacts/route.js:235` (kõik `ownerId: auth.userId`) ja chat-töövoog `lib/chat/workflowBranchHandlers.js`, mis annab **tühja loendi** (`agentDocuments = []`, kunagi ei täideta) → dokumendi-retrieval'it seal ei toimu.
4. **Süvauuring on eraldi kaitstud:** `app/api/research/jobs/route.js` filtreerib `PRIVATE_AGENT_RAG_COLLECTION_IDS` välja enne geo-variantide koostamist.
5. **Jagatud teadmusbaas `RagDocument` kannab `adminId`-d, mitte kasutaja omandit** — see on kureeritud sisu, mitte cross-tenant pind.
6. **Kaitse on serveripoolne ja testitud:** `rag-service/main.py` `AgentDocumentSearchIn` on `extra: forbid` ja **ilma** `owner_id`/`tenant_id`/`where` väljadeta (klient ei saa skoopi süstida); `tests/rag/agentDocumentIsolation.test.js` **4/4 roheline**, sh Python-poolne `test_search_security.py`.

**Tagajärg T07-le:** E1 esimene punkt on juba täidetud — **mitte tegemata töö**. E1-st jääb alles ainult päritolu/privaatsusriba, mis sõltub E3-st. Varasem märge „T28 cross-tenant piir puutumata" oli eksitav: piiri ei puudutatud sellepärast, et see oli juba korras. Vt ka `sol-dok-xten-p0-kordusaudit.md`.

### Otsustering 19.07 (8 blokeerivat otsust langetatud)

Omanik käis läbi SEIS-i „blokeerivate otsuste" nimekirja. **Kaheksa otsust langetatud, kolm rida selgus mitte-otsusena.** Otsuste sisu ja variandid loeti allikadokkidest (`fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` ptk 12, `fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` ptk 3.3 + ptk 9), mitte mälust.

**T14 — avab paketi WB-V2-P2** (⚠ esialgu kirjutasin siia „P2–P5"; paketispetsi (`fable-5-tooheaolu-v2-iganadalane-pusiruum.md` ptk 10) kontroll samal päeval näitas, et **avanes ainult P2**. P3 nädalarütm kannab edasi **O-WB-1** (nädalakirje kuju — „viimane hetk: enne P2/P3"), **O-WB-5** (PAUSED = „rütm väljas") ja **O-WB-2a** (U1 admin-tõrkeloendi maskimine) väravaid; P4 = TO-8; P5 = TO-3/4/5/7/9.)

| # | Otsus | Valik |
|---|---|---|
| TO-1 | Kirjete elutsükkel | **„Paranda uue kirjena" (versioonitus)** = doki soovitus (c). Vana kirje jääb, parandus tekib uue kirjena ahelasse — muutmine ei kirjuta mustri-statistikat tagantjärele ümber. Kustutamine jääb päris kustutuseks (§19.8), koondist eemaldub järgmisel arvutusel. |
| TO-2 | Kontrollpunkt + meeldetuletus | **U1 sündmus + badge, e-kirjata** = doki soovitus. Tööandja-poolset rütmi ei tule (§19.2 keeld). E-kiri jääb välja ka opt-in'ina — tööheaolu kirje on tundlik pind (jagatud/tööarvuti postkast). |

**T21 — avab P2 (STAR2-ülekanne) ja P3 (Meetodipeegel):**

| # | Otsus | Valik |
|---|---|---|
| O-CW-4 | Konteiner vs adapterid | **Konteiner kohe** (CaseWorkAssist mudel) — **vastu doki soovitusele (b)**. Tagajärg: P2 kannab migratsiooni; vt ⚠ allpool. |
| O-CW-2 | Ülekantud mustandi retention | **Kirjutuskaitse + 12 kuud arhiivis + kustutus** = doki vaikesoovitus. Tähtaja õiguslik kinnitus käib O-CW-1 juristiringiga kaasa. |
| O-CW-10 | STAR2-ekspordi auditisügavus | **Fakt + väljade loend** = doki soovitus. EI täissnapshot — see oleks varju-register auditilogi kaudu. |
| O-CW-3 | Refleksioonikirje leping | **Kinnitatud sellisena (a).** Kandvad punktid: PRIVATE invariandina (mitte vaikeseadena), kirje EI ole kunagi otse jagatav (jagatav on ainult deidentifitseeritud + kasutaja kinnitatud tuletis), tähelepanek ≠ tõlgendus eri väljadel, päritolumärgistus kohustuslik, AI ei skoori ega võrdle töötajaid, kirjete olemasolu ei näe ka admin. |

**⚠ O-CW-4 tagajärg, mis TULEB P2 lepingusse kirjutada:** konteiner + 12-kuune arhiiv tähendab, et platvormil seisab juhtumitöö struktureeritud kujul aasta ajal, mil **O-CW-1 (eelpöördumise õiguslik staatus + vastutav töötleja) on lukustamata** — doc nimetab seda R1 (varju-register) ja R8 (õiguslik staatus) riskiks. O-CW-1 „viimane hetk" oli niikuinii „enne esimest partner-KOV pilooti"; see otsus ei muuda tähtaega, vaid tõstab rea tähtsust. Lisaks peab P2 leping määrama, kas konteiner **asendab** 1:1 eelpöördumise-sideme või seisab selle kõrval.

**Ops-lülitid (OTSUSTATUD, serveris TEGEMATA — eraldi samm):**

| Lüliti | Otsus | Mida see praktikas tähendab |
|---|---|---|
| PERF L4 kvoodireaper | **Kuivkäik kõigepealt** | Serveris `USAGE_REAPER_JOB_KEY` + `USAGE_REAPER_ENABLED=1`, seejärel käsitsi `dryRun=1` päring → `wouldReap` arv. Kontrollitud koodist: marsruut nõuab NII võtit KUI lippu, lipp üksi ei käivita midagi (timer paigaldamata), `dryRun` vabastab null rida. Timeri otsus langeb päris arvu peale. |
| RAG master-source-check timer | **Sisse** | Unit + `/etc/sotsiaalai/rag-master-source-check.env` + enable. Timer teeb ainult piiratud, SSRF-kaitstud avalike URL-ide kontrolli ja uuendab kandidaadijärjekorda — EI publitseeri, EI approve'i, EI kutsu ingest-otspunkti. |
| RAG P8.6 proovipakk | **Ootab RAG-QM-P0 baasjoont** | Ilma mõõdetud lähtejooneta ei saa hiljem öelda, kas päris allikad parandasid või halvendasid vastuseid. Baasjoon on vahepalade nimekirjas (C). |

**Mitte-otsused — read, mis nimekirjast maha ei lähe, aga ei ole omaniku klikk:**
1. **O-CW-7** — genogrammi/ökokaardi kolmandate isikute õiguslik alus = **jurist-analüüs** (GDPR art 14 teavitamiskohustus mittekasutajale, laste andmed, kliendi-oma kaardi isikliku kasutuse erand). Blokeerib T21 **P4/P5 TERVIKUNA**. Ei otsustata vaikimisi tehniliselt.
2. **T22 retention** — juba lahendatud otsusega 12: `retentionStatus="AWAITING_POLICY"` on staatus ILMA automaatikata; säilitustähtaeg, õiguslik alus ja kustutusmehhanism = eraldi otsus + eraldi töö **pärast V0**. Ei olnud täna lahtine.
3. **T09 recurring** ootab turuleminekut (enne seda pole `PAYMENT_TOKEN_ENC_KEY` seadmisel mõtet); **T20 O-CO** on terve alustamata teema oma otsusteringiga, mitte üksik lüliti.

### T12 otsustering 18.07 (ROOMS-CALLS-V1 eeltöö — 6 otsust)

Auditi (`fable-5-ruumid-liitumine-ja-konevoog.md`, 20 ptk) pingerea ja registri T12-otsuste pealt tehtud otsustering. **Leping `t12-rooms-calls-v1-ulesanne.md` (E1–E7) koostatud nende otsuste alusel.**

| # | Otsus | Valik |
|---|---|---|
| 1 | **Salvestus V1-s** | **SEES — täismudel.** `RECORDING_ENABLED=true` (alles kui E5+E6 tõendatud); nõusolek kehtib kogu kestuse, egress-peatus, withdraw-UI, retention-purge. Auditi #1/#2 = V1 tuum. |
| 2 | **Voo-ruumi kustutus** | **Keela + arhiveeri.** Voo-põhises ruumis (`originType != MANUAL_INVITE`) omanik ei saa ühepoolselt kustutada; „arhiveeri/lahku". Ühine ajalugu säilib. |
| 3 | **Kokkuvõtte kandja** | **Iga osaleja privaatne koopia** → Minu dokumendid (T07 pind); elab üle ruumi kustutuse. |
| 4 | **Kutseõigus** | **Ainult OWNER kutsub.** Sponsorlus käib Subscription'i kaudu (liikmesuse sponsor-väljad informatiivsed). |
| 5 | **Salvestise ligipääs + retention** | **Nõusoleku-osalised + auto-purge.** Ligipääs ainult kohal-olnud-ja-nõustunul; withdraw eemaldab; auto-purge 90 p (ühtne dokumentidega) + omaniku käsitsi kustutus. |
| 6 | **Omanikuvahetus** | **JAH** — OWNER saab rolli üle anda enne lahkumist (katab 16 K6). |

**Etapid E1–E7** (auditi parandusjärjekord 20.5 = selgroog): E1 elutsükli ristkoristus, E2 race-migratsioon (osalised unikaalindeksid), E3 vealeping+väravaring, E4 kutse+kustutuspoliitika+omanikuvahetus, E5 salvestuse kestev nõusolek, E6 failipool+egress+retention, E7 kokkuvõtte privaatkoopia+T04-sündmused. **Kergemad vaikevalikud lepingus** (omanik võib üle vaadata): billing-kadumise aus kuva (15 K2), moderatsioon = olemasolev filter (3 K6b), SSE ei kanna kõneseisu (4 K7). Soovitatud teostaja: **Sol/Fable High** (salvestus+egress+olekumasin = kõrge privaatsus-/turvaraskus).

### Lepingupank 18.07 (valmis lepingud, järjekord ees ootamas)

Omaniku soovil valmistatud ette rida lepinguid, et suurte teemade järjekord oleks olemas. **Neli lepingut valmis; kolm ootavad väljastamist.**

| Teema | Leping | Skoop | Eeldused | Lahtised otsused |
|---|---|---|---|---|
| **T22** SUPERVISION | `t22-supervision-v1-ulesanne.md` | E1–E7 (P1–P10) täis-V0 | **TEOSTATUD 19.07** — `codex/supervision-v1 @ 3fb5ec37`, `CODE_READY` | — (decision-complete) |
| **T12** ROOMS-CALLS | `t12-rooms-calls-v1-ulesanne.md` | E1–E7, salvestus SEES | audit valmis ✓ | — (6 otsust tehtud) |
| **T14** WELLBEING-V2 | `t14-wellbeing-v2-ulesanne.md` | E1–E2 = tuum P0+P1 | E0 LIVE ✓ + K1-P0 main'is ✓ | rütmiviil (P2–P5) vajab TO-1/TO-2 |
| **T21** CASEWORK | `t21-casework-v1-ulesanne.md` | E1–E2 = tuum P0+P1 | K1-P0 main'is ✓ | võrgustikuvaated (P4/P5) vajavad O-CW-7 õigusanalüüsi |
| **T13** COVISION-V2 | `t13-covision-v2-ulesanne.md` | **Faas A prototüüp → Faas B tootmine** | V1 backend LIVE ✓ | prototüüp-esimene (omaniku lukustatud reegel); R13-D8 otsustab prototüüp; avab DEFERRED teema |

Kontrollitud aegunud väited, mis said parandatud: T22 „SUP-P0 remote puudub" (on main'is+prod'is), T14 „E0 [BRANCH]" (E0 on main'is `fe8c7df2`), T21 „K1-P0 [BRANCH]" (K1-P0 `ef5973c9` on main'is). **T21 kriitiline:** P0 peab `FIELD_PROVENANCE` (praegu `lib/field/constants.js`-s) tõstma jagatud `lib/workspaces/provenance.js`-i ja suunama FIELD-i sinna — MITTE teist sõnastikku looma.

Väljastusjärjekord (omaniku prioriteet: suured funktsioonid enne release'i): **omaniku valik {T22, T12, T21, T13}**. **T14 tuum TEOSTATUD 19.07** (omanik andis T14 T22 asemel ette) — `CODE_READY` harus, ootab merge-luba; vt „T14 teostus 19.07". T21 tuum on väiksem (P0+P1); rütmi-/võrgustikuviilud avanevad hilisemate otsuste järel. **T13 on prototüüp-esimene** — Faas A (prototüüp) ei ole tootmiskood; see avab varem DEFERRED teema ja Faas B ootab prototüübi vastuvõttu.

### T14 teostus 19.07 (WELLBEING-V2 tuum E1+E2 — CODE_READY, ootab merge-luba)

Omanik andis T14 T22 asemel ette (jadatöö, üks haru). **Skoop = leping E1+E2 (WB-V2-P0+P1), otsustevaba tuum.** Haru `codex/wellbeing-v2 @ 981682c0`, baas `e0a78632` (= main'i tipp alustamise hetkel; leping nimetas `9ab72a05`, main oli vahepeal T13-docs-commitiga liikunud — võtsin praeguse tipu, JADATÖÖ reegel). Push'itud `origin`-isse (SotsiaalAI-uus), **main/server/merge/deploy PUUTUMATA**. 0 migratsiooni (andmemudel kandis kõike).

**E1 (kirjete lugemisrada + „Minu kirjed" naasmisvaade):** `records.js` `getWellbeingRecordForUser`/`deleteWellbeingRecordForUser` (omanik-skoop `findFirst`/`deleteMany`, päris kustutus, võõras/olematu → 404); marsruudid `GET /api/wellbeing/records` (loend, workflowType/perioodi filter) + `GET`/`DELETE /records/[id]` (detail liidab seotud mustandid); `supportDrafts.js` `listWellbeingOutputDraftsForRecord` (kirje↔mustandi side); uus vaade `MyRecordsWorkflow.jsx` (kronoloogia + detail: signaal/tegurid/soovitused/seotud mustandid/handoff-ajalugu, kustutus) uue tööriistana „Minu kirjed" (`/tooheaolu/minu-kirjed`); 9 workflow-komponenti annavad `sourceRecordId` värskelt salvestatud kirje juurde (`saveState === "saved"` värav); **V6 parandus** `workspaceContinuity.js` — „Jätka siit" href → `/tooheaolu/minu-kirjed?draft=<id>` (mitte tühi `/tooheaolu`).

**E2 (`wellbeing_space` K1 read-adapter):** `wellbeingAdapter.js` sisutu descriptor (W-INV-7: ei workflowType'i/signaale/arve, ainult olek+viide), omanik-skoop, `lastMeaningfulActivityAt` = max(record.createdAt, draft.updatedAt); registry RESERVED→SUPPORTED. **Kaks teadlikku kõrvalekallet analüüsidoki ptk 7.1-st (kood ülimuslik aegunud doki suhtes):** (1) `href.action = "open_workspace"` (MITTE ptk 7.1 soovitatud `open_wellbeing`) — K1 descriptor-validaator lubab ainult `open_workspace`, marsruut eristub `ref.kind`-ist nagu kõigil SUPPORTED adapteritel; (2) tühi ruum (0 kirjet + 0 mustandit) → tagastab `[]` (MITTE ptk 7.1 „descriptor null-ajatempliga") — descriptor-validaator nõuab kanoonilist ISO ajatemplit; privaatsus säilib, sest descriptor on nagunii omanik-ainult, võõras saab alati `[]`. **NB K1 adapterid on isekehtiv lepingu-kiht** — ükski tootmispind ei tarbi neid veel (töölaud/kompass = hilisem töö), seega adapter ei vaja „ühendamist".

**Väravad (worktree, npm ci päris node_modules — junction lõhub Turbopacki):** **1736/1736 testi** (+9 uut: records-lugemine/kustutus, kustutuse elus koondimõju, adapter sisutus+tühi ruum, records API-leping, V6 continuity href), lint 0 viga, i18n:check OK (et/en/ru pariteet), prisma validate OK, git diff --check puhas, **build (turbopack) OK**. Sünteetiline runtime = fake-prisma testid tõestavad kõik DoD-punktid (loend/detail/kustutus omanik-skoobis, kustutuse koondimõju elusalt, mustandi↔kirje side, continuity sihib mustandit, adapter sisutus). **NOT_PROVEN:** autenditud brauser-QA + a11y/mobiil (T27). **VÄLJAS (skoobist, otsuste taga):** rütmikiht P2–P5 (TO-1/TO-2), org-suunaline koond (O-WB-3 õigusanalüüs). Fable teeb fokuseeritud kontrolli: omanik-skoop, kustutuse koondimõju, `wellbeing_space` sisutus, E0-regressioon.

**Järgmine:** **T14 tuum liidetud kohalikku `main`-i 19.07 (`8eb3430b`, omaniku loal) — merge-luba antud; server/deploy jäävad eraldi otsuseks.** T14 **teine viil = pakett WB-V2-P2 on 19.07 otsusteringiga AVATUD** (TO-1 = „paranda uue kirjena" versioonitus, TO-2 = U1 sündmus + badge e-kirjata) → **leping `t14-wellbeing-v2-kontrollpunkt-ulesanne.md` koostatud 19.07**. P3–P5 jäävad kinni (P3: O-WB-1 + O-WB-5 + O-WB-2a; P4: TO-8; P5: TO-3/4/5/7/9). Järgmisena töösse võetud **T21 CASEWORK-V1 tuum** (P0+P1); vt „T21 teostus 19.07".

### T21 teostus 19.07 (CASEWORK-V1 tuum E1+E2 — MERGED_LOCAL + push'itud origin'i)

Jadatöö, üks haru. **Skoop = leping E1+E2 (CASEWORK-P0+P1), otsustevaba tuum.** Haru `codex/casework-v1 @ 73c3953e` (kood `38ded8dc` + SEIS-docs `73c3953e`), baas `ae997dbd` (= T14 merge `8eb3430b` + SEIS-docs commit; leping nimetas `9ab72a05`, main oli vahepeal liikunud — võtsin praeguse tipu, JADATÖÖ reegel). **Liidetud kohalikku `main`-i `d27066c2` (--no-ff), push'itud origin'i (haru + `main`) ja LIVE serveris `ac0b7d3f` (19.07 deploy, omaniku loal).** 0 skeemimuudatust, 0 migratsiooni, 0 kirjutavat rada.

**E1 (CASEWORK-P0 — sõnastiku-/adapterikiht):** `lib/workspaces/provenance.js` KANOONILINE (8-väärtuseline päritolusõnastik 2.3 + kandjaklass 1/2/3 + STAR2-ülekande olekud 2.2 + validaatorid; 0 päringut). **FIELD_PROVENANCE konsolideeritud:** `lib/field/constants.js` impordib nüüd `provenance.js`-st (`FIELD_PROVENANCE = PROVENANCE`, bait-identsed väärtused ja järjekord) — **üks sõnastik, mitte kaks; FIELD-regressioon (provenance/stateMachine/handover/syncApi/privacy) roheline.** `registry.js` +2 RESERVED kindi (`case_work`, `practice_reflection`); SUPPORTED-loend muutumatu (`workspaceContract.test.js` ootused uuendatud — additiivse konstandi paratamatu tagajärg). Kaks read-only adaptrit: `preInquiryReceiverAdapter.listReceivedCaseWork` (vastuvõtja-skoobitud K1-descriptorid `recipientOwnerId`-lt; K1 4.2.1 elutsükkel DRAFT→DRAFT / READY+SENT→ACTIVE / DOWNLOADED+ARCHIVED→CLOSED / recall→PURGED; `nextAction`=nextContactOn; sisutu — ei topic/situation/autori-ID; võõras→tühi) ja `caseArtifactAdapter.listCaseArtifacts` (omanik-skoobitud jagamis-descriptorid; DRAFT→kandjaklass 1 mitte-jagatav / FINAL→klass 2 jagatav; 11-tüübiline sõnastik; range validaator; sisutu — ei content/metadata; võõras→tühi).

**E2 (CASEWORK-P1 — UI, 0 migratsiooni):** `CaseworkPreparationPanel` vastuvõtulaual (`WorkspaceFeaturePage`, feature=pre_inquiries) — kohtumise ettevalmistuse raamistus range „mustand/ettevalmistus" registriga (R8, EI „menetlus"/ametlik esitamine), päritolumärgiste kuva P0 sõnastikuga (allikatükid → päritolu + legend), artefakti-mustandi tüübid (CASE_BRIEF/PRE_ASSESSMENT_SUMMARY/CHECKLIST, kandjaklass 1). `casework.*` i18n ET/EN/RU pariteedis + `workspace.kind.pre_inquiry`. Klient-piir: panel impordib AINULT `provenance.js` (puhas), MITTE adaptreid (need impordivad `@/lib/prisma`) — build kinnitab, et server-only koodi klientbundlisse ei satu.

**Väravad (worktree, npm ci + kopeeritud Prisma klient):** **1743/1743 testi** (baasjoon 1736 + 7 casework-lepingut), lint **0 viga** (27 olemasolevat WorkspaceFeaturePage-hoiatust, **0 uut**), `i18n:check` OK (et/en/ru pariteet), `prisma validate` OK, `git diff --check` puhas, **build (turbopack) OK**. Sünteetiline runtime = fake-prisma leping-testid tõestavad mõlema adaptri skoobi/sisutuse, üks-sõnastik-invariandi (FIELD import), sõnastike täielikkuse (iga AgentArtifactType + PreInquiryStatus kaardistub) ja validaatorite fail-closed. Cleanup: ainus loodud objekt = kopeeritud `generated/` (gitignore's), DB-objekte ei loodud. **NOT_PROVEN:** autenditud brauser-QA (panel päris rolli + seeditud eelpöördumisega), a11y/mobiil → T27.

**VÄLJAS (skoobist, otsuste/õiguse taga):** P2 STAR2-ülekande salvestus (O-CW-2/4/10 + Opuse audit), P3 Meetodipeegel/PracticeReflection (O-CW-3), P4 kliendi ökokaart (**O-CW-7 õigusanalüüs**), P5 töötaja genogramm/võrgustik (COLLAB-P5 + O-CW-7/8/9), P6 meetodite teadmusbaas (O-CW-5). Fable teeb fokuseeritud kontrolli: üks-sõnastik-invariant (FIELD import), adapterite skoop/sisutus, P1 registrikeel.

**Järgmine:** T21 **P2/P3 on 19.07 otsusteringiga AVATUD** (O-CW-4 = konteiner kohe, O-CW-2 = kirjutuskaitse + 12 kuud, O-CW-10 = fakt + väljade loend, O-CW-3 = kinnitatud) — vt „Otsustering 19.07" ja seal **⚠ O-CW-4 tagajärg**, mis peab P2 lepingusse jõudma; P4/P5 vajavad O-CW-7 õigusabi (ei alustata koodiga). Omaniku valik järgmiseks suureks teemaks {T22, T12, T13}. **Push + merge + DEPLOY TEHTUD omaniku loal 19.07** — server `ac0b7d3f` (smoke 10/10, rollback `ae59516f`); **kohalik `main` = `origin/main` = server** (kõik sünkroonis).

### T22 teostus 19.07 (SUPERVISION-V1 — E1–E7 TERVIKUNA, `CODE_READY`)

**Haru `codex/supervision-v1 @ 3fb5ec37`, worktree `C:\Users\rauds\Desktop\SotsiaalAI-supervision-v1`, baas `ac0b7d3f`** (= `main` haru alustamise hetkel; `main` oli vahepeal liikunud ühe docs-commit'i võrra `f9ca078a`-le — koodimuudatusi vahepeal ei tulnud). **6 commit'i, worktree puhas.**

**PUSH + MERGE + DEPLOY TEHTUD omaniku loal 19.07** („commit ja push ja deploy"): haru push'itud `origin`-isse, liidetud kohalikku `main`-i merge-commit'iga **`17b5d7cc`**, `main` push'itud, **server `ac0b7d3f` → `17b5d7cc`**. Deploy: **0 migratsiooni** („No pending migrations to apply" — DB skeem muutumatu), npm ci + build OK, **3 teenust `active`**, **smoke 13/13 → 200** (senised 10 + `/supervisioon`, `/supervisioon/uus`, `/supervisioon/valjundid`), toodangu sisu kontrollitud, DB-backup `~/sotsiaalai-db-backups/pre-deploy-17b5d7cc-20260719T085933Z.dump` (2,7 MB, 1214 TOC-kirjet, verifitseeritud), **rollback `ac0b7d3f`**.

| Etapp | Commit | Sisu |
|---|---|---|
| E1+E2 | `1118f447` | grant + protsessi tuum (M2–M5, vaatajapõhised serializer'id SV/OS/OS†/KUT/LAHK) |
| E3 | `d0f35e3e` | eeskamber M6 + teadlik jagamine M7 |
| E4 | `a851f727` | kohtumised M8 + kokkuvõtted M9/M10 |
| E5 | `28ff3d07` | **atomaarne sulgemine + purge** + isiklikud pakid M11/M12 |
| E6 | `eb444a99` | U1/U2 teavitused + Tööheaolu üleandmine eeskambrisse |
| E7 | `3fb5ec37` | **eeskambri UI: Q2.6 kümme vaadet** (7 marsruuti `app/supervisioon/**` + 13 faili `components/supervision/**`) |

**Väravad (kõik jooksutatud E7 järel, tervel harul):** **1825/1825 testi** (sh 82 supervisiooni oma, neist **17 uut UI-lepingutesti**), **lint 0 viga** (50 hoiatust = muutumatu baasjoon), **i18n:check OK** (et/en/ru pariteet), **prisma validate OK**, **turbopack build OK** (kõik 7 UI-marsruuti emiteeritud dünaamilistena). **0 uut migratsiooni** — `git diff main -- prisma/` on tühi, nagu leping ennustas.

**E7 sisulised otsused:** `?ala=` ankrud (kontrakt/eeskamber/kohtumised/kokkuvotted/kapp) on otselingitavad ja brauseri tagasi/edasi töötab; `?summary=` on U2 „Jätka siit" siht. Privaatsusmärgis on **püsielement** (eeskamber iga kirje juures, lävi, kapp, isiklik pakk). Jagamise eelvaade näitab **täpselt** saadetavaid välju — pealkirja tuletus (pealkirjata kirjel sisust) elab ühes kohas, nii et eelvaade ja saadetav ei saa lahku minna. Salvestus on **teadlik nupp, mitte autosalvestus** (plaan nimetas autosalvestust): nii ei kaota CAS- ega võrguviga kirjutatud teksti — mõlemad plaani invariandid on täidetud, kuid lihtsama mehaanikaga.

**Kaasnev parandus (E2 defekt, mille test lukustas valesti):** `capabilities.canShareTopic` andis superviisorile `true`, kuigi `topics.js` viskab talle 403 ja skeem teeb autorluse võimatuks (`M7.authorParticipationId` = NOT NULL FK osalusele; SV-l osalust pole). UI oleks kandnud nuppu, mis alati ebaõnnestub. Lipp viidud jõustusega kokku (`serializers.js`) ja `serializers.test.js` ootus parandatud.

**Brauseri-QA TEHTUD pärast merge'i** (peapuu dev-server, `preview_start`): kõik 7 marsruuti mountisid ja renderdasid õiged olekud — `/supervisioon` „Palun logi sisse.", `/supervisioon/uus` täisvorm + mustandi-vihje, `/supervisioon/[id]?ala=eeskamber` süvalink (Suspense OK), `/supervisioon/valjundid` püsimärgis „Ainult sina näed", `/sulge` ja `/jaga` sissejuhatused; **0 konsooliviga, 0 serverviga**. **NOT_PROVEN jääb:** autenditud läbiv voog (nõuab SW/SP kasutajat + aktiivset grant'i + andmeid — sünteetiline runtime tuleks teha T09 throwaway-DB retseptiga) ja mobiilivaade. **Keskkonnamuudatus:** worktree `node_modules` oli sümbollink põhitööpuule, mis lõhub Turbopacki (`Symlink [project]/node_modules is invalid`); link eemaldati mitte-rekursiivselt (põhitööpuu 564 kirjet enne ja pärast — puutumata) ja asendati päris `npm ci` paigaldusega, et build saaks tõendatud. Link jäi taastamata: nii saab järgmine sessioon selles worktree's build'ida.

**Järgmine:** SUP-P11 = T27 koondvärav, jääb skoobist välja; retention on `AWAITING_POLICY` (otsus 12) ja admin-UI väljas. **Esimene sisuline järelsamm = autenditud läbiv voog** (grant → protsess → kutse → eeskamber → jagamine → kohtumine → kokkuvõte → sulgemine → isiklik pakk) sünteetilistel andmetel; see on ainus koht, kus V0 loogika on veel tõendamata pärispäringutega. Koodijärjekorras avaneb **T12 ROOMS-CALLS-V1**.

### T22 eeltöö 18.07 (SUPERVISION-V1 — leping valmis, otsusteringi EI vajanud)

Omanik valis T22 esimeseks suureks teemaks (funktsioonid enne release'i, võimsad tööriistad praegu). **Leping `t22-supervision-v1-ulesanne.md` (E1–E7 = P1–P10) koostatud.** Erinevalt T12-st ei vajanud T22 otsusteringi — SUP-V0 tööplaan (`fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md` Q2) on **decision-complete**: 12 tooteotsust lukus, 18-testi plaan, purge-tehing, UI-vaated, Tööheaolu-piir kõik spetsifitseeritud.

**Kaks kontrollitud fakti (parandavad aegunud register-väiteid):**
- **SUP-P0 skeem on JUBA main'is ja prod'is.** `2fc826c4` „supervision V0 schema foundation" on main'i eellane; migratsioon `20260716090000_supervision_v0` on prod-DB-s rakendatud (kontrollitud). 13 mudelit + 11 enumit paigas. Register „SUP-P0 lokaalne, remote puudub / CODE_READY_PARTIAL" oli AEGUNUD (18.07 integratsioon tõi main'i + deploy prod'i). Leping algab P1-st.
- **Registri „3 lahtist otsust" on rollout-väravad, mitte koodiväravad.** Grandi tõendusstandard (enne *päris* granti), retention-tähtaeg (lukustatud otsus #12: V0 EI ehita scheduler'it, `retentionStatus=AWAITING_POLICY`) ja piloodi ulatus (enne rollout'i) kuuluvad kõik T27/rollout'i, mitte V0 koodi. Seega V0 väljastatav ilma täiendava otsuseta.

**Etapid E1–E7 = paketid SUP-P1…P10** (JADATÖÖ: üks haru, mitte 11 mikroharu; paketid = sisemised etapid): E1 grant+admin-API, E2 protsessi tuum (protsess+kontrakt+kutse+nõusolek, vaatajapõhised serializer'id), E3 eeskamber+teadlik jagamine, E4 kohtumised+kokkuvõtted, E5 atomaarne sulgemine+purge (kõrgeim risk), E6 U1/U2+Tööheaolu üleandmine, E7 eeskambri UI (10 vaadet). SUP-P11 = T27. Soovitatud teostaja: **Sol/Fable High** (privaatsusinvariandid + atomaarne purge + RAG-keeld).

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
- **Push'itud + liidetud kohalikku `main`-i** (`662b6e8a`); **LIVE serveris alates 18.07 õhtu-deploy'st (`ae59516f`)**.

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
| ✓ | **T07 `DOCUMENTS-RESEARCH-V1` — `CLOSED_SCOPED` 18.07** | `t07-documents-research-v1-ulesanne.md` | tuum+DoD LIVE; 3 naaberpinna-jääki edasi lükatud; avab T12 |
| ✓ | **T22 `SUPERVISION-V1` — KOOD VALMIS 19.07 (`CODE_READY`)** | `t22-supervision-v1-ulesanne.md` (E1–E7 = P1–P10) | supervisioon; haru `codex/supervision-v1 @ 3fb5ec37`, väravad rohelised, **push/merge/deploy ootavad omaniku otsust** |
| ▶ | **T12 `ROOMS-CALLS-V1` — JÄRGMINE** | `t12-rooms-calls-v1-ulesanne.md` (E1–E7, 6 otsust lukus) | ruumid/kõned/salvestus; T22 järg avanenud |
| — | T10 `PUBLIC-V1` — release-ootel | `t10-public-v1-ulesanne.md` | avalikud pinnad (ei enam automaatselt järgmine) |

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
