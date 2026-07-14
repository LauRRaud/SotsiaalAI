# SOL — U3 + P1 + U8-lite + U4 integratsioonirehearsal

> **Kuupäev:** 2026-07-14
> **Tööpuu:** `C:/Users/rauds/Desktop/SotsiaalAI-integration`
> **Haru:** `codex/integration-u3-p1-u8-u4-rehearsal`
> **Baas:** `origin/main` @ `df2f45c0`
> **Remote main / production deploy:** tehtud 2026-07-14, commit `22958456`

## 1. Otsus

Neli kasutaja poolt integratsiooniks lubatud paketti on värske `origin/main`
peal üheks rehearsal-haruks ühendatud ja kogu kontrollpaketiga testitud.
Pärast kasutaja eraldi deploy-luba viidi integratsioon kontrollitud
fast-forward'ina remote `main`-i ja production-serverisse commit'il `22958456`.
U1/U2 teostust ei ole alustatud; see ootab Opuse read-only ülesannete 2–5
lõppüleandmist.

Pakettide auditeerimismärgendid jäävad muutmata:

- U12/U3: varasem `OPUS HEAKS KIIDETUD`;
- P1, U4 ja U8-lite auditiparandused:
  `SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA`;
- viimane märgend ei võrdu `OPUS HEAKS KIIDETUD` otsusega.

## 2. Lähteharud ja ühendamisjärjekord

| Järjekord | Pakett | Lähteharu | Lõppcommit | Rehearsali merge-commit |
|---|---|---|---|---|
| 1 | U12/U3 | `codex/u12-u3-trust-package` | `d2dd13e3` | `46191a21` |
| 2 | P1 ops | `codex/p1-ops-final` | `0fd73ccf` | `c816ae59` |
| 3 | U8-lite | `codex/u8-lite-trust-layer` | `02f40a21` | `a66309ca` |
| 4 | U4 | `codex/u4-availability-trust` | `a3529ac0` | `bf07e0e2` |

Kõik neli lähteharu on remote'i push'itud ja nende tööpuud olid rehearsaali
alustamisel puhtad. Dirty `main` tööpuud, selle staging-ala ja kõrvalisi
ruumifaile ei muudetud.

## 3. Integratsioonis lahendatud ristpaketi küsimused

### 3.1 CSS budget add/add

P1 ja U8-lite lisasid mõlemad sama `52/52` budget-faili. Sisuline leping oli
identne; konfliktis säilitati hilisema U8 faili `setAt` väärtus. Eelarvet ei
tõstetud.

U3 `MySharingsPage.module.css` sisaldas kahte lokaalset `!important` deklaratsiooni,
mis viisid ühendharu 54 peale. Need olid üleliigsed, sest `app/styles/base.css`
rakendab sama `prefers-reduced-motion` lepingut globaalselt ja tugevamalt.
Lokaalne duplikaat eemaldati ning budget jäi **52/52**.

### 3.2 Migratsioonide deterministlik järjekord

U3 ja U8-lite kasutasid mõlemad prefiksit `20260714220000`. U8 migratsioon
nimetati integratsioonis ümber:

```text
20260714220000_pre_inquiry_recall_and_correction
20260714223000_source_feedback_trust_layer
20260714230000_practice_ops_retry_and_justification
20260715003000_service_availability_freshness
```

U8 migratsioonilepingu test viitab uuele rajale. Migratsiooni SQL sisu ei
muudetud.

### 3.3 Rakenduskoodi liidesed

- U3 ja U4 `lib/preInquiries.js` muudatused ühinesid automaatselt;
- U4 päring-mapper-UI availability integratsioonitest läbis U3 skeemi ja
  lock-lepingu peal;
- U8 `sourceAttribution` identiteet püsis pärast kõigi chat-muudatuste ühendust;
- P1 konto-kustutus, scheduler, repair ja deploy-gate läbisid ühendatud Prisma
  skeemi peal;
- ET/EN/RU tõlkepuud ühinesid võtmekadudeta.

## 4. Kontrollitulemused

| Kontroll | Tulemus |
|---|---|
| U3/P1/U8/U4 ühine sihtmaatriks | **235/235 läbitud** |
| U3 CSS-paranduse lepinguvalik | **11/11 läbitud** |
| Kogu `npm test` | **1190/1190 läbitud** |
| `npm run i18n:check` | ET/EN/RU korras |
| `npm run css:budget` | **52/52** |
| `npx prisma validate` | skeem korras |
| `npm run db:migrate:check` | **91/91 migratsiooni**, puhas ajutine PostgreSQL ahel |
| `npm run lint` | **0 viga**, 359 baasis olemasolevat hoiatust |
| `npm run build` | läbitud, 54 lehte; uued U3/U4/U8/P1 route'id buildis |
| `git diff --check` | puhas |

Migratsioonikontroll lõi ainult localhosti ajutise
`sotsiaal_ai_migration_probe_*` andmebaasi ja eemaldas selle lõpetamisel.
Tootmisandmeid ei kasutatud ega muudetud.

`npm ci` raporteeris baasi sõltuvuspuus 7 mõõdukat auditileidu. Ükski neljast
paketist ei muuda lukufaili; see ei ole käesoleva integratsiooni regressioon.

## 5. Täpne jätkamispunkt

1. Remote `main` ja production on commit'il `22958456`; neli feature-haru ei
   vaja enam eraldi ühendamist.
2. Opus lõpetab read-only ülesanded 2–5 ning annab U1/U2 privaatsus- ja
   arhitektuurilepingu Solile üle.
3. Pärast seda loob Sol värskest, integratsiooni sisaldavast `origin/main`-ist
   uue eraldi U1/U2 tööpuu. Esimesed parandused on SOL-U1U2-P1-1 serializeri
   audience-värav ja OPUS-U1U2-P1-2 tootmise maileri fail-closed leping.
4. Jälgi esimeste automaatsete scheduler-käivituste järel systemd `Result` ja
   rakenduse auditikirjeid; käsitsi kordussaatmist ega deploy-erandit pole vaja.

## 6. Piirid

- lokaalse dirty põhitööpuu HEAD, staging ja kõrvalmuudatused jäid puutumata;
- remote `main` viidi fast-forward'ina `df2f45c0 -> 22958456`;
- kõrvalisi ruumipilte, imagegen-väljundeid ega CSS-ruumifaile ei lisatud;
- feature-harude ajalugu ei kirjutatud ümber;
- production-migratsioon ja build tehti repo deploy-skriptiga; productioni
  kasutajaandmeid käsitsi ei muudetud ning väliseid sõnumeid ei saadetud;
- U1/U2 rakenduskoodi ei alustatud enne Opuse üleandmist.

## 7. Production deploy — 2026-07-14

### 7.1 Git, migratsioon ja build

- remote `main`: `229584569fe497f78b4888d45872b32ad9601781`;
- server: `ssh sotsiaalai`, `/home/ubuntu/apps/sotsiaalai`, haru `main`;
- server tegi puhta fast-forward'i `e5fa1c59 -> 22958456`;
- `prisma migrate deploy` rakendas ahela 91. migratsioonini;
- `prisma migrate status`: **Database schema is up to date**;
- serveri production build läbis, 54 lehte genereeriti;
- `sotsiaalai-rag.service` ja `sotsiaalai-frontend.service`: **active**;
- build-logi: `/home/ubuntu/apps/sotsiaalai/deploy-build-logs/build-20260714T150127Z.log`.

### 7.2 Keskkonnamuutujad

`/etc/sotsiaalai/frontend.env` sai ainult puuduvad võtmed; väärtusi reposse ega
logisse ei kirjutatud:

- `PRACTICE_REVIEW_JOB_KEY` — serveris genereeritud 256-bitine juhuslik saladus;
- `PRACTICE_REVIEW_BATCH_SIZE=50`;
- `PRACTICE_DEPLOY_MAX_RAG_RESIDUE=0`;
- `PRACTICE_DEPLOY_ALLOW_RAG_DISABLED=false`;
- `SERVICE_AVAILABILITY_FRESH_DAYS=28`.

Varukoopia:
`/etc/sotsiaalai/frontend.env.bak-20260714T150110Z`.

### 7.3 Deploy-järgsed väravad

- väline HTTPS: `/`, `/minu-jagamised`, `/admin/rag/source-feedback` ja
  `/admin/service-availability` tagastasid **200**;
- RAG health: `ok=true`, teenus aktiivne;
- frontend/RAG journalis pärast deploy'd error-taseme kirjeid polnud;
- practice scheduler dry-run: HTTP **200**, `reviewsDue=0`,
  `assignmentsOverdue=0`;
- availability reminder dry-run ja esimene päriskäivitus: `due=0`, `sent=0`,
  `notSent=0`;
- P1 deploy-gate: `ok=true`, kõik residue/mismatch/unlinked/repair loendurid 0,
  migratsioonid ajakohased.

### 7.4 Ajastajad

Serveris lisati ja valideeriti:

- `sotsiaalai-practice-reviews.timer` — iga päev 03:15, kuni 15 min juhuslik nihe;
- `sotsiaalai-service-availability.timer` — iga päev 04:00, kuni 15 min
  juhuslik nihe;
- mõlemal `Persistent=true`, seotud oneshot-service töötab kasutajana `ubuntu`;
- job-secret ei lähe protsessi argumenti ega journalisse;
- mõlema esimene päriskäivitus lõpetas `Result=success`, `ExecMainStatus=0`.
