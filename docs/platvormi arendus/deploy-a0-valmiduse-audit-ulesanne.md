# ÜLESANNE: DEPLOY-A0 — deploy-valmiduse audit (kohalik main → server)

**Olek:** `ISSUED` (2026-07-18) — paralleelne **mittekooditöö**; jadatöö reegel lubab, sest koodi ei kirjutata  
**Teostus:** ainult lugemine (repo + server READ-ONLY) → üks väljunddokument → `SEIS.md` uuendus  
**Soovitatud teostaja:** Fable 5 Medium või Sol Medium (High pole vajalik — töö on read-only)

## Miks see ülesanne olemas on

Kohalik `main` on serverist (`origin/main @ fe4eb4fa`) väljastamise hetkel **73 commit'i ees** ja vahe kasvab iga merge'iga. Deploy on omaniku järgmine suur otsus (`SEIS.md` → „Lahtised omaniku otsused" p 1), aga otsuse tegemiseks puuduvad koondatud faktid: mitu migratsiooni on serveris rakendamata, kas serveri `.env` on uute check-env reeglitega kooskõlas, kas jagatud VPS-i ressursid kannavad next build'i, kuidas eelmine deploy tehti ja milline on rollback-plaan.

See audit koondab faktid ühte dokumenti ja lõpeb go/no-go soovitusega. **Deploy-otsust ennast EI tehta ega teostata — see jääb omanikule.**

## JADATÖÖ piir

- See on dokumenditöö. **Ära kirjuta ega muuda rakenduskoodi, Prisma skeemi, migratsioone ega ühtegi haru.**
- Ära loo worktree'd. Töö käib põhitööpuus `C:\Users\rauds\Desktop\SotsiaalAI` ja muudab AINULT kahte faili: uus väljunddokument + `SEIS.md`.
- Paralleelselt võib joosta T24 FIELD (kood elab tema oma worktree's) — failialad ei kattu.

## Loe enne

1. `docs/platvormi arendus/SEIS.md` — elav seis (järjekord, lahtised otsused, backup'id)
2. `CLAUDE.md`
3. `prisma/migrations/` loend kohalikus `main`-is (väljastamise hetkel 96 migratsiooni: 95 ajatempliga + `0000_baseline`)
4. Kohalik `.env` — **AINULT võtmenimed** (nt `sed 's/=.*//' .env`), väärtusi ei loeta ega väljastata

## Serveri ligipääs — RANGELT READ-ONLY (kriitiline)

SSH on seadistatud: `ssh sotsiaalai`. Rakenduse kausta leidmiseks kasuta ainult lugevaid käske (`pm2 list` → cwd, `ls ~`, `systemctl status` → WorkingDirectory).

**LUBATUD** (ainult lugevad): `cat`/`less`/`ls`/`grep`; `git -C <kaust> log|status|rev-parse|remote -v|diff --stat`; `systemctl status`, `systemctl list-timers`; `journalctl -n 50`; `df -h`, `free -h`, `swapon --show`; `pm2 list`/`pm2 status`; `psql`-iga AINULT `SELECT` `_prisma_migrations` tabelist; `npx prisma migrate status`.

**KEELATUD:** `git pull/fetch/checkout/reset`; `npm install`/`npm run build`; `prisma migrate deploy/dev/reset`; `systemctl start/stop/restart/reload`; `pm2 restart/reload/delete/save`; failide loomine/muutmine/kustutamine serveris; `.env` muutmine; `sudo`, kui käsk pole lubatud loendis. **Kui käsk võib midagi kirjutada — ära käivita; märgi `NOT_RUN`.**

**Saladused:** ära väljasta ühegi env-võtme VÄÄRTUST ei terminali ega dokumenti — raporteeri ainult võtmenimede olemasolu/puudumine.

Kui SSH ei tööta, tee repo-poolne osa ära ja märgi serveri-osad ausalt `NOT_RUN`; ära paigalda ega seadista midagi.

## Kontrolli ja dokumenteeri

Väljunddokument: `docs/platvormi arendus/deploy-a0-valmiduse-audit-2026-07-18.md`

1. **Git-vahe.** Serveri rakenduskausta `git rev-parse HEAD` vs kohalik `main`. Commit'ide arv ja **teemade kokkuvõte** (mitte 73-realine toorloend): mis funktsionaalsus deploy'ga serverile lisanduks.
2. **Migratsioonid.** Kohalikus repos N; serveri DB-s rakendatud M (`_prisma_migrations` SELECT või `migrate status`). Loetle rakendamata migratsioonid järjekorras. Märgi eraldi **riskireale destruktiivsed sammud** (`DROP`, `ALTER … NOT NULL`, unikaalindeks olemasolevatel andmetel jms) — loe migratsioonifailide SQL kohalikust repost, mitte serverist.
3. **Env-pariteet.** Võtmenimed: kohalik `.env` vs serveri `.env` — puuduvad/üleliigsed nimed. Eraldi read: `MAKSEKESKUS_PUBLIC_KEY` olemasolu ja `SUBSCRIPTION_RECURRING_ENABLED` seis MÕLEMAS. Teadaolev risk: maksed-p1a check-env kukutab deploy-kontrolli, kui recurring on lubatud, aga võti puudub. Paku omanikule kaks lahendusvarianti (võti lisada VÕI recurring keelata) koos kummagi mõjuga.
4. **Ressursid ja build.** `df -h`, `free -h`, `swapon --show`. Kohalik build vajab `--max-old-space-size=8192`; server on jagatud ~6,8GB VPS (3 muud saiti + taristukiht, RAG-uvicorn ~1GB). Kas build serveris on realistlik? Kuidas EELMINE deploy tehti (serveri git log, olemasolevad skriptid, pm2/systemd jäljed)? Kui build serveris on riskantne, kirjelda alternatiivid AINULT ettepanekuna.
5. **Teenused.** Protsessihaldur (pm2/systemd unit'id) nimede ja seisudega; RAG-uvicorn; notifications-timer (teadaolevalt iga 5 min). Mida deploy peab taaskäivitama ja millises järjekorras.
6. **Varundus ja rollback.** Kas DB-varundus on olemas (pg_dump cron, systemd timer, muu)? Rollback-plaan: kood = `git reset --hard <praegune serveri SHA>` — **kirjuta see SHA dokumenti**; DB = **varukoopia ENNE `migrate deploy`'d on kohustuslik**, sest Prisma down-migratsioone ei ole. Kohalikud backup-harud on `SEIS.md`-s.
7. **Deploy-sammud (ETTEPANEK, mitte teostus).** Järjestatud käsuloend peatuspunktidega (kontroll → DB-varukoopia → push → pull → install → build → migrate → restart → smoke), mille omanik saab hiljem koos AI-ga läbi viia. Ära käivita ühtegi neist.
8. **Riskid pingereas + go/no-go soovitus** koos eeltingimustega (nt „GO pärast MAKSEKESKUS-otsust + DB-varukoopia olemasolu").

## Piirid

- **See EI ole OPS-FINAL-A0** ega asenda T27 release-väravat; timereid/workereid EI aktiveerita, seadistusi EI muudeta.
- Serverisse ei kirjutata MIDAGI. Tootmisandmete sisu ei loeta (ainult `_prisma_migrations` ja skeemimeta; mitte ühtegi sisutabelit).
- Kohalikus repos muudetakse AINULT kaks faili: väljunddokument + `SEIS.md`. Kontrolli enne, et tööpuu on puhas; commit'i ainult need kaks faili `main`-i.
- T02+T16 push'i/merge'i EI tehta (eraldi omaniku otsus). Kajasta auditis mõlemad stsenaariumid: deploy enne lepituse merge'i (96 migratsiooni) vs pärast (98).

## Lõpetamisel: uuenda AINULT `SEIS.md`

1. Seisutabelisse DEPLOY-A0 rida → `COMPLETE` + väljunddokumendi tee (või aus pooleliolek, kui katkes).
2. „Lahtised omaniku otsused" p 1 → viide auditi go/no-go tulemusele.
3. Kui leidsid `SEIS.md`-st vananenud väite, paranda see seal.

Masterregistrit, arendusprogrammi ega omanikuvaadet ei uuendata.

## Lõpparuanne

Esita: väljunddokumendi tee; serveri HEAD SHA ja commit-vahe; migratsioonid M/N + rakendamata loend + destruktiivsete riskirida; env-erinevuste võtmenimed (väärtusteta) + MAKSEKESKUS-variandid; ressursihinnang + build-soovitus; varunduse seis; go/no-go + eeltingimused; kinnitus, et serverisse ei kirjutatud midagi ja kohalikus repos muutusid ainult kaks faili.
