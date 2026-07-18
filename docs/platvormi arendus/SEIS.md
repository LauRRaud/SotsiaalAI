# SEIS — SotsiaalAI arenduse elav seisufail

STATUS: SINGLE SOURCE OF TRUTH

Viimati uuendatud: 2026-07-18 (**DEPLOY TEHTUD:** local `main` `adc83829` → server LIVE; 6 migratsiooni rakendatud, smoke roheline, DB-backup võetud. **T03 disainiotsus LAHENDATUD:** ühtne mikker võidab, spatial-entry hüljatud. **T09 PAYMENTS-V1 DEPLOYED** — `main @ 7b49e9f7` LIVE serveris (baas `538ec4bb`), väravad + päris-DB runtime 33/33; migratsioon rakendatud, smoke roheline, DB-backup võetud, rollback `538ec4bb`; järgmine kooditeema = T10. **Ops-fixid: research-worker live + Turbopack puhas; server `efd275f1`.** T23 mentorlus valmis + pushitud)

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

`main @ 7b49e9f7`; **server `origin/main @ 7b49e9f7` — LIVE (T09 PAYMENTS-V1 deploy'tud 18.07)**. **T09-deploy 18.07** (`538ec4bb`→`7b49e9f7`): ff, 1 additiivne migratsioon (`20260719120000_payments_v1`) rakendatud prod-DB-le, npm ci + build roheline, 3 teenust `active`, smoke roheline (`/` `/vestlus` `/meist` `/tellimus` `/voimalused` → 200). Rollback-SHA `538ec4bb`; DB-backup `~/sotsiaalai-db-backups/pre-deploy-7b49e9f7-20260718T141532Z.dump` (2,75 MB, 1114 kirjet, taastatav). Server `SUBSCRIPTION_RECURRING_ENABLED=0` (variant A) + `PAYMENT_TOKEN_ENC_KEY` seadmata → recurring-token krüpto on **fail-closed dormant** (recurring rada ei aktiivne; enne recurring'u sisselülitamist tuleb võti seada). Eelmine deploy (ajalooline): põhi-deploy `adc83829` + ops-fix `efd275f1`. **Ops-fixid 18.07 (live+tõendatud):** (1) `sotsiaalai-research-worker.service` paigaldatud + `active`+stabiilne (fix: `--conditions=react-server`, sest `pipeline.js`→`@/lib/server/ragAuth`→`server-only` crash-loopis standalone node's; repo alla `ops/systemd/`) — [[perf-cost-audit]] L1 **worker-osa** lahendatud, **kvoodileke JÄÄB** (PERF-P0); (2) Turbopack NFT-hoiatused 10→0 (`lib/dataExport/service.js`). Rollback-SHA `fe4eb4fa`; DB-backup `~/sotsiaalai-db-backups/pre-deploy-adc83829-20260718T111528Z.dump` (2,69 MB, taastatav).

### Töö järjekord (jadatöö)

| # | Teema | Olek | Haru / SHA | Avab |
|---|---|---|---|---|
| 1 | T24 `FIELD-V1` | `IN_PROGRESS` — pausil, WIP-kontrollpunkt | `codex/field-v1 @ cb99b092` | — |
| 2 | T02+T16 `LEPITUS` | **`DEPLOYED` — main'is `d2860b0b`, **LIVE serveris 18.07** (`adc83829`). Väravad: 1582 testi, 98-migr ahel, build; 6 migratsiooni rakendatud prod-DB-le** | `codex/t02-t16-remerge @ a6f683a6` → `main` | **T09 avatud** |
| 3 | T10 `PUBLIC-V1` | `QUEUED` | leping `t10-public-v1-ulesanne.md` | avalikud pinnad |
| 4 | T07 `DOCUMENTS-RESEARCH-V1` | `QUEUED` | leping `t07-documents-research-v1-ulesanne.md` | dokumendiruum |

### Paralleelne mittekooditöö (jadatöö reegel lubab)

| Teema | Olek | Leping | Teenib |
|---|---|---|---|
| DEPLOY-A0 valmiduse audit | **`EXECUTED` 18.07 — GO täidetud, deploy LIVE** | väljund: `deploy-a0-valmiduse-audit-2026-07-18.md` | mõlemad eeltingimused täidetud (DB `pg_dump` võetud+verifitseeritud; server-build madala koormusega, 4.5 GB vaba); server `adc83829`, smoke roheline |

### Pooleli, ei ole järjekorras

| Teema | Olek | Haru / SHA | Märkus |
|---|---|---|---|
| T23 `ESTA-MENTOR-V1` | **`CODE_READY` — pushitud, väravad rohelised** | `codex/esta-mentor-v1 @ 32b9800d` (local=remote), baas T05 `33f7fb82` | üks commit; 1582/1582 testi (24 uut) + build + i18n + lint + 98-migr ahel + **päris-DB sünteetiline runtime PASS** (mentor+mentee+admin täisteekond, IDOR/purge/continuity/U12/handoff); `NOT_PROVEN`: brauseri-QA, seadme-a11y. Ei ole `main`-is ega serveris |
| T03 `CHAT-VOICE-V1` | **`DECISION_MADE` 18.07 — ühtne mikker võidab** | `codex/chat-voice-v1 @ 7bdd1288` | omanik otsustas: sisenemine = alati-nähtav tekstiväli + VALIKULINE mikker (main). Spatial-entry hüljatud. T03 rebase peab main'i komposeri säilitama; skoop = ainult E1–E5 (kriis/Stop/hääl), MITTE sisenemis-UX |
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
- Teadmiseks: T24 peab hiljem rebase'ima — tema migratsioon `20260718090000` on nendest hilisem, aga haru on vanemal baasil.

### Lahtised omaniku otsused

1. ~~**Deploy**~~ — **TEHTUD 18.07.** `git push origin main` + `npm run deploy:server` → server `adc83829` LIVE. DB `pg_dump` võetud+verifitseeritud ENNE migrate'i; 6 migratsiooni rakendatud (kõik additiivsed); server-build (4.5 GB vaba, kaas-saite ei häirinud); frontend+rag `active`; smoke roheline. MAKSEKESKUS jäi variant A (`SUBSCRIPTION_RECURRING_ENABLED=0`).
2. ~~**T02+T16 push**~~ — **TEHTUD** (kuulus deploy'sse).
3. ~~**T03 disainiotsus**~~ — **OTSUSTATUD 18.07:** ühtne alati-nähtav tekstiväli + valikuline mikker (main) võidab; kaheikooniline „Räägi/Kirjuta — pead valima" spatial-entry lõplikult hüljatud. Segaduse allikas oli deploy-vahe (main eemaldas selle 16.07, aga toodangus jooksis veel eemalduse-eelne `fe4eb4fa`) — nüüd deploy'ga lahendatud.

**T09 lõpetatud (18.07):** push + merge + **deploy TEHTUD** kasutaja loal → `main @ 7b49e9f7` LIVE serveris. Jadatöö avab järgmise: **T10 `PUBLIC-V1`** on nüüd järgmine väljastatav kooditeema (alusta `main`-i praegusest tipust `7b49e9f7`).

**Backup'id:** `backup/main-pre-t02t16-merge-2026-07-18` (uus), `backup/main-pre-sync-2026-07-18`, `backup/main-pre-integration-2026-07-18`, `integration/2026-07-18`.

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

T24 `FIELD-V1` on aktiivne, kuid pausil Fable'i worktree's testide alguses. Skeemi-, teenuse-, API-, retention-, service worker'i ja UI töö on pooleli; väravaid EI ole jooksutatud.

**18.07 kontrollpunkt:** senine ainult-kettal töö on nüüd commit'itud harusse `codex/field-v1 @ cb99b092` (worktree `C:\Users\rauds\Desktop\SotsiaalAI-field-v1`, tööpuu puhas, remote-haru puudub). See on kaotusriski maandav WIP-kontrollpunkt, MITTE valmis etapp — lõpparuannet, väravaid ega vastuvõttu ei ole. Uus konto ei dubleeri seda tööd; algne aken jätkab samast worktree'st.

T23 `ESTA-MENTOR-V1` — **UUENDATUD 18.07: see lõik on aegunud, kehtib seisutabeli T23 rida.** Teema on nüüd `CODE_READY`, terviklikult teostatud, väravad rohelised ja **pushitud** (`codex/esta-mentor-v1 @ 32b9800d`, local=remote, üks puhas commit `adc44f69` asemel; worktree `C:\Users\rauds\Desktop\SotsiaalAI-esta-mentor-v1`, tööpuu puhas). WIP-kontrollpunkt on asendatud lõppüleandmisega; ei ole `main`-is ega serveris. (Ajalooline algseis oli: 18.07 WIP-kontrollpunkt `adc44f69`, väravaid pole jooksutatud, remote puudub.)

### Väljastusjärjekord (JADATÖÖ, kinnitatud 18.07)

Kolm teemat väljastati 18.07 paralleelselt (T10, T07, T02+T16). Jadatöö reegli jõustumisel need **järjestati ümber**; lepingud jäävad kehtima, kuid neid ei alustata korraga. Väljastatakse ükshaaval, iga järgmine alles siis, kui eelmine on `main`-i liidetud:

| Järjek. | Teema | Leping | Avab |
|---|---|---|---|
| — | T24 `FIELD-V1` | `cb99b092` (WIP) | **PARGITUD** — EI aktiivne (jadatöö: 1 korraga) |
| ✓ | T02+T16 LEPITUS | — | **DEPLOYED 18.07** → avas T09 |
| ✓ | **T09 `PAYMENTS-V1` — DEPLOYED 18.07** (`main @ 7b49e9f7` LIVE) | `t09-payments-v1-ulesanne.md` | baas `538ec4bb`; P1a/T02 ei cherry-pick'itud |
| 1 | **T10 `PUBLIC-V1` — järgmine väljastada** | `t10-public-v1-ulesanne.md` | avalikud pinnad; baas = `main @ 7b49e9f7` |
| 2 | T07 `DOCUMENTS-RESEARCH-V1` | `t07-documents-research-v1-ulesanne.md` | dokumendiruum |

**T09 `PAYMENTS-V1` — DEPLOYED 18.07** (`main @ 7b49e9f7` = `origin/main` = server LIVE; haru `origin/codex/payments-v1` push'itud; worktree `SotsiaalAI-payments-v1` puhas). Baas = `538ec4bb` (leping ütles `fe4eb4fa`/`cdbd9139` — JADATÖÖ reegel: praegune tipp). P1a `0aca8c4b` ja T02 olid juba main'is → cherry-pick'i EI tehtud. E1–E6 kõik teostatud (lukustatud O-M1…O-M6/O-J1…O-J4, testilepingud 1–9, DoD); väravad rohelised + päris-DB throwaway runtime 33/33; deploy: 1 additiivne migratsioon rakendatud, smoke roheline, DB-backup + rollback `538ec4bb`. `NOT_PROVEN`: brauseri-QA, päris Maksekeskus/callback/webhook/e-kiri, juristi/PCI (O-J1). T03 `chat-voice-v1` disainiotsus on TEHTUD (ühtne mikker) — vt seisutabel.

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
