# DEPLOY-A0 — deploy-valmiduse audit (kohalik main → server)

**Olek:** `COMPLETE` (2026-07-18)
**Teostus:** read-only (repo + server). Serverisse EI kirjutatud midagi; kohalikus repos muutus AINULT see dokument + `SEIS.md`.
**Deploy-otsust ega -teostust EI tehtud** — see jääb omanikule. See dokument koondab faktid ja lõpeb go/no-go soovitusega.

> Kontroll tehti pärast **T02+T16 lepituse liitmist kohalikku main-i** (`d2860b0b`). Seepärast on esmane stsenaarium **98 migratsiooni / 6 rakendamata**; lepituse-eelne stsenaarium (96 / 4) on kajastatud eraldi real (ptk 2).

---

## 0. Kontrollitud tõeallikad

| Allikas | Väärtus |
|---|---|
| Kohalik `main` HEAD | `d2860b0b325244cc516dac9c9ea8be112abb7c87` (T02+T16 merge peal) |
| `origin/main` | `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` |
| Server app-kaust | `/home/ubuntu/apps/sotsiaalai`, git HEAD `fe4eb4fa`, remote = `github.com:LauRRaud/SotsiaalAI-uus`, tööpuu puhas |
| Server-koodi deploy-aeg | 2026-07-16 20:22 (fe4eb4fa) |
| Serveri protsessimudel | **systemd** (mitte pm2): `sotsiaalai-frontend.service`, `sotsiaalai-rag.service`, `livekit.service`, `livekit-egress.service` |
| Prod env-fail | `/etc/sotsiaalai/frontend.env` (135 võtit), RAG: `/etc/sotsiaalai/rag.env` |

Serveri poole read-only käsud: `git log/status/rev-parse`, `systemctl status/list-timers/cat`, `df -h`/`free -h`/`swapon`, `pm2 list`, `prisma migrate status`, `SELECT`-id `_prisma_migrations`-ist. Ühtki kirjutavat käsku ei jooksutatud. Ühegi env-võtme VÄÄRTUST ei loetud ega väljastatud (v.a `SUBSCRIPTION_RECURRING_ENABLED`, mille väärtus `0` on funktsioonilipp, mitte saladus).

---

## 1. Git-vahe (mis deploy'ga serverile lisanduks)

Server on `origin/main @ fe4eb4fa`; kohalik `main` on **88 commit'i ees**. Sisu teemade kaupa (mitte toorloend):

- **Faas-1 P0/P1 turvakiht** (18.07 integratsioon, 26 haru): admin-v1-core, a11y-i18n-p0, u6/u7 (owner-scoped otsing + selge keel), perf-p0 (reservation-lifecycle), **maksed-p1a** (server-plan-binding + check-env), k1-p0 (workspace-leping), prof-p1, avalik-p1s (sitemap-terviklus), vest-p0/p0a (kriisi-failsafe), rag-qm-p0/p0a, tooheaolu-e0.
- **Funktsiooniteemad:** T17 search-language, T11 service-mediation, T04+T05 workspace-events-stack, T06 journey, T28 rag-v1, supervision-v0 skeem, registreerimise jaamalend.
- **T02 ACCOUNT-V1 + T16 EXPORT-V1** (äsja liidetud): verify-then-swap e-postivahetus + reset-revoke + ausad kontoseisu-olekud; GDPR-andmekoopia eksport (portable ZIP) + kustutuse-eelne koopiavalik.

Kasutajale nähtav lisandus: kogu turvaparanduste kiht + konto-, ekspordi-, otsingu-, teekonna-, RAG- ja tööheaolu-täiendused. **NB:** T02+T16 push origin'isse == deploy; seda EI ole tehtud (ptk 8).

---

## 2. Migratsioonid

| Näitaja | Väärtus |
|---|---|
| Repo migratsioone lokaalses `main`-is | **98** (97 ajatempliga + `0000_baseline`) |
| Repo migratsioone `origin/main`-is (fe4eb4fa) | 92 |
| Serveri DB-s rakendatud (`prisma migrate status`) | **92 — „Database schema is up to date!"** |
| `_prisma_migrations` toorkirjed | 93 (92 `finished` + 1 `rolled_back`) |

**Rakendamata deploy'ga (praegune, 98-stsenaarium): 6 migratsiooni**, järjekorras:

1. `20260716090000_supervision_v0` — ainult uued tabelid + unikaalindeksid **uutel tabelitel** → ohutu
2. `20260717120000_add_pending_email_change` (T02) — uus tabel + unikaalindeksid → ohutu
3. `20260717143000_data_export_v1` (T16) — uus tabel + osaline unikaalindeks → ohutu
4. `20260717180000_u1_domain_event_outbox` — uus tabel + unikaalindeks → ohutu
5. `20260717193000_journey_sent_author_retention` — `DROP NOT NULL` `PreInquiry.authorId`-l + uus veerg + FK `SET NULL` → **ohutu** (piirangu lõdvendus ei kuku olemasolevatel andmetel)
6. `20260717233000_help_match_consent` — `ADD COLUMN initiatedByUserId` → **backfill `requesterId`-st** → alles siis `SET NOT NULL` → **ohutu** (iga rida on enne täidetud)

**Lepituse-eelne stsenaarium (96 / 4 rakendamata):** kui T02+T16 poleks liidetud, rakenduks 4 migratsiooni (#1, #4, #5, #6). T02/T16 kaks migratsiooni (#2, #3) on mõlemad uute tabelite lisamised — nende olemasolu/puudumine ei muuda riskiprofiili.

### Destruktiivsete sammude riskirida

**Puuduvad kõrge riski sammud.** Kõigis 6 rakendamata migratsioonis: 0× `DROP TABLE`, 0× `DROP COLUMN`, 0× `TRUNCATE`, 0× katmata `SET NOT NULL` (ainus `SET NOT NULL` on backfill'i taga), 0× unikaalindeks olemasolevatel andmetel (kõik unikaalindeksid on uutel tühjadel tabelitel). Ainus piirangumuutus olemasoleval tabelil (`journey_sent_author_retention`) on `DROP NOT NULL` (lõdvendus). **Migratsioonirisk: madal.**

### Rolled-back kirje (kontrollitud, kahjutu)

DB-s on 1 kirje `finished_at IS NULL`: `20260522190000_add_pre_inquiry_receiver_workflow`, `rolled_back_at = 2026-05-22`, `applied_steps_count = 0`. See migratsioon **keerati mais puhtalt tagasi** (0 sammu rakendatud) ja **rakendati hiljem edukalt uuesti** (Prisma `migrate status` = „up to date", 92 kaetud). Seega EI ole tegu ebaõnnestunud migratsiooniga; `migrate deploy` seda ei blokeeri ega proovi uuesti. Kohalik `db:migrate:check` (98 migratsiooni puhtal DB-l) läbis samuti.

---

## 3. Env-pariteet ja MAKSEKESKUS

| Kontroll | Server prod (`/etc/sotsiaalai/frontend.env`) |
|---|---|
| Võtmeid kokku | 135 |
| `SUBSCRIPTION_RECURRING_ENABLED` | **`0` (recurring keelatud)** |
| `MAKSEKESKUS_PUBLIC_KEY` | puudub/tühi |
| check-env reegel serveri koodis | olemas (fe4eb4fa) |

**Otsustav leid:** check-env reegel on `recurring truthy && MAKSEKESKUS puudub → hard error` (`scripts/check-env.mjs:212–214`). Kuna serveri prod-env-il on **recurring = `0`**, reegel EI rakendu → **`env:check` läbib**. Jooksev `sotsiaalai-frontend.service` käivitub `npm run start` = `env:check && next start` kaudu, seega on env:check juba praegu roheline.

> SEIS.md „teadaolev .env-leid" (recurring seatud, võti puudub → deploy kukub) kehtib **kohaliku dev `.env`** kohta (11 võtit, recurring seatud). **Tootmise env on juba turvalises seisus** — MAKSEKESKUS-blokeer on prod-poolel de facto lahendatud variandiga „recurring keelatud".

**Variandid omanikule (deploy jaoks tegevust EI vaja):**
- **(A, praegu kehtiv) recurring keelatud** — 0 tegevust, 0 saladust, deploy läbib. Ühekordsed maksed (`BillingMode.ONE_OFF`, vaikeväärtus) töötavad edasi; automaatne korduvarveldus on väljas.
- **(B) recurring lubada** — omanik lisab `MAKSEKESKUS_PUBLIC_KEY` prod-env-i JA seab `SUBSCRIPTION_RECURRING_ENABLED=1`. Nõuab päris makseintegratsiooni testimist enne. **Võtme sisestab omanik ise** (AI saladusi ei sisesta). Ei ole selle deploy eeltingimus.

**Env-nimede pariteet:** kohalik dev-`.env` on minimaalne (11 võtit) ja EI ole prod-env-i võrdlusalus; tootmiskonfiguratsioon elab ainult serveris (135 võtit) ega ole repos. Puuduvate/üleliigsete prod-võtmete täisdiff nõuaks teadaolevat prod-võtmete kanoonilist loendit, mida repos ei ole → **täielik nimepariteet: NOT_PROVEN** (aga funktsionaalne tõend olemas: jooksev teenus on env:check'i läbinud).

---

## 4. Ressursid ja build

| Ressurss | Seis |
|---|---|
| RAM | 6.8 GiB kokku, 1.4 GiB kasutusel, **4.6 GiB vaba** |
| Swap | 2.0 GiB (0 B kasutusel) |
| Ketas `/` | 48 G, 25 G kasutusel, **23 G vaba (53%)** |
| Kaas-saidid (pm2) | avasta, beyondframes, raio (~75 MB igaüks) + RAG-uvicorn (~1 GB) + LiveKit |

**Build serveril = keskmine risk.** Kohalik build kasutab `NODE_OPTIONS=--max-old-space-size=8192` (8 GB heap-lagi). Serveril on 4.6 GB vaba + 2 GB swap (~6.6 GB). Next/turbopack build tipneb tavaliselt 2–4 GB, seega **mahub tõenäoliselt**, aga tipuhetkel võib swap'i minna ja **kaas-saite (3 tk) + RAG-i + LiveKit'i aeglustada/ohustada**. `scripts/deploy-server.mjs` toetab `SKIP_BUILD` ja `BUILD_TIMEOUT_SECONDS` lippe.

**Soovitus (ettepanek):** eelista **kohalikku/CI-buildi** ja saada `.next` artefakt serverisse (kaitseb kaas-tenante), VÕI kui build serveril, tee see madala koormuse aknas ja jälgi `free -h`. Kohaliku buildi tõend on juba olemas (npm run build = OK, 57/57 lehte).

---

## 5. Teenused ja taimerid

**systemd unit'id (SotsiaalAI):**
- `sotsiaalai-frontend.service` — `npm run start`, WorkingDirectory `/home/ubuntu/apps/sotsiaalai`, env `/etc/sotsiaalai/frontend.env`. **Deploy taaskäivitab selle** (pärast build + migrate).
- `sotsiaalai-rag.service` — `rag-service/`, env `/etc/sotsiaalai/rag.env`. Taaskäivita **ainult kui rag-service muutus**.
- `livekit.service` + `livekit-egress.service` — self-hosted LiveKit (kõned/salvestus). **Deploy ei puuduta** (v.a LiveKit-config muutus).

**Taimerid (systemd, aktiivsed):**
- `sotsiaalai-notifications.timer` → **iga 5 min** (kinnitatud: viimane 2 min tagasi). Mentorluse (T23) sweep ja kõik teavitused sõidavad selle sees — **uut taimerit deploy ei vaja**.
- `sotsiaalai-practice-reviews.timer` → päevas (~03:18).
- `sotsiaalai-service-availability.timer` → päevas (~04:12).

**Taaskäivitusjärjekord deploy'l:** migrate deploy → `systemctl restart sotsiaalai-frontend` → (vajadusel) `sotsiaalai-rag`. Taimerid ei vaja restart'i (nad kutsuvad rakendust). Kaas-saite (avasta/beyondframes/raio) EI puututa.

---

## 6. Varundus ja rollback

**Koodi-rollback SHA (kirjuta üles):** `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`
→ `git -C /home/ubuntu/apps/sotsiaalai reset --hard fe4eb4fa` + rebuild + `systemctl restart sotsiaalai-frontend`.

**Kohalikud backup-harud:** `backup/main-pre-t02t16-merge-2026-07-18` (uus, enne T02+T16 merge'i), `backup/main-pre-sync-2026-07-18`, `backup/main-pre-integration-2026-07-18`, `integration/2026-07-18`.

**DB-varundus — RISK:** serveril **EI leitud automaatset Postgres-varundust** (pg_dump cron/timer). `systemctl list-timers` näitab ainult `dpkg-db-backup` (OS-pakettide DB, mitte Postgres) ja apt-taimereid. `~/sotsiaalai-deploy-backups` sisaldab ainult `manual-hotfix-20260501` (mai koodikoopia); `~/backups` sisaldab teise saidi (raio) oma. **Prisma down-migratsioone EI ole** → **DB-varukoopia ENNE `migrate deploy`'d on KOHUSTUSLIK ja tuleb teha käsitsi.**

Rollback DB-l (kui migrate läheb valesti): taasta pg_dump'ist. Kuna 6 migratsiooni on additiivsed (0 destruktiivset), on praktiline risk madal, aga varukoopia jääb kohustuslikuks eeltingimuseks.

---

## 7. Deploy-sammud (ETTEPANEK, mitte teostus)

Ükski samm EI ole selle auditiga käivitatud. Omanik viib läbi koos AI-ga peatuspunktidega:

1. **Kontroll:** kohalik `main` roheline (✓ tehtud: 1582 testi, 98-migratsiooni ahel, build, i18n); server puhas `fe4eb4fa`.
2. **DB-varukoopia (KOHUSTUSLIK):** serveril `pg_dump` → ajatempliga fail väljaspool app-kausta; **kontrolli faili suurus > 0 ja taastatavus**.
3. **Env-otsus:** kinnita, et prod jääb `SUBSCRIPTION_RECURRING_ENABLED=0` (variant A) — 0 muudatust. (Või variant B, kui omanik lisab võtme.)
4. **Push:** `git push origin main` (== deploy algus; toob ka T02+T16).
5. **Server pull:** `git -C /home/ubuntu/apps/sotsiaalai pull --ff-only origin main`.
6. **Install:** `npm ci` (kui `package-lock` muutus).
7. **Build:** kohalik/CI artefakt VÕI serveril madala koormuse aknas (ptk 4).
8. **Migrate:** `prisma migrate deploy` (6 migratsiooni; varukoopia peab olemas olema).
9. **Restart:** `systemctl restart sotsiaalai-frontend` (+ vajadusel `sotsiaalai-rag`).
10. **Smoke:** `systemctl status` roheline; `/` laeb; login; üks maksevaba põhivoog; `journalctl -u sotsiaalai-frontend -n 50` puhas; notifications-timer järgmine tsükkel OK.

---

## 8. Riskid pingereas + go/no-go

| # | Risk | Tase | Leevendus |
|---|---|---|---|
| 1 | **DB-varundus puudub automaatselt** enne pöördumatut migrate'i | KÕRGE (protsess) | Kohustuslik käsitsi `pg_dump` sammus 2; ilma selleta NO-GO |
| 2 | **Build serveril** võib swap'i minna ja kaas-saite ohustada | KESKMINE | Kohalik/CI build + `.next` saatmine (soovitus) |
| 3 | Env-nimede täispariteet tõendamata (prod-loendit repos pole) | MADAL | Funktsionaalne tõend olemas (env:check läbib); täisdiff soovi korral eraldi |
| 4 | 6 migratsiooni olemasoleval prod-andmestikul | MADAL | Kõik additiivsed/ohutud (ptk 2); varukoopia katab |
| 5 | MAKSEKESKUS | LAHENDATUD | Prod recurring=0 → check-env läbib; tegevust pole vaja |

### GO/NO-GO: **TINGIMUSLIK GO**

Deploy on tehniliselt valmis — **hard-blokeerijaid ei ole**: migratsioonid on additiivsed ja ohutud, Prisma kinnitab serveri „up to date", prod-env läbib check-env (recurring keelatud), rollback-SHA teada, teenusekaart selge.

**Eeltingimused enne migrate deploy'd (mõlemad kohustuslikud):**
1. **Käsitsi DB pg_dump** on tehtud ja taastatavus kontrollitud (automaatset varundust ei ole).
2. **Build-strateegia valitud** — soovitus kohalik/CI build kaas-tenantide kaitseks.

**Soovituslik lisatingimus:** deploy madala koormuse aknas; smoke-test pärast restart'i (ptk 7 samm 10).

MAKSEKESKUS ei ole enam eeltingimus (prod juba variandis A). Deploy-otsuse ja -teostuse teeb omanik; see audit ei push'i, ei build'i ega migrate'i.

---

## Kinnitus

Serverisse EI kirjutatud midagi (kõik käsud read-only). Ühegi env-võtme väärtust ei väljastatud (v.a funktsioonilipp `SUBSCRIPTION_RECURRING_ENABLED=0`). Kohalikus repos muutusid selle tööga ainult **see dokument + `SEIS.md`**; T02+T16 merge on eraldi committ (omaniku otsusega). Push'i, deploy'd, migrate'i ega serveri-restart'i EI tehtud.
