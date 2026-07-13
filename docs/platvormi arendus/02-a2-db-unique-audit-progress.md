# A2 DB-taseme unikaalsuse ettevalmistav audit — progress

Uuendatud: 13.07.2026
Staatus: **HEAKS KIIDETUD — COMMIT'ITUD + PUSH'ITUD** (`6a8e9fca`, `fabe2b9e..6a8e9fca main -> main`). Tootmis-deploy ega `migrate deploy` EI tehtud (eraldi samm; enne seda korrata read-only auditit + küsida luba).
Teostaja: **Claude Opus 4.8 / Claude Code**
Nõutud effort: **EXTRA (`xhigh`)**
Tooteotsused: **kasutaja**
Baas: `main` @ `fabe2b9e`

## 0. Effort-märkus

Mudel on Opus 4.8 (õige). Effort-tase ei ole selles sessioonis mulle tehniliselt nähtav. Kogu käesolev töö on **read-only** (andmeid, skeemi ega migratsioone EI muudetud), seega audit tehti; kui aktiivne effort polnud EXTRA, palun anna teada ja töö korratakse õigel tasemel.

## 1. Ulatus ja piirid (kasutaja korraldus)

- Read-only audit tootmisandmetes `(originType, originId)` duplikaatidele, kus `originId IS NOT NULL`.
- Kontrollida ka tühje/vigaseid origin-väärtusi ja kas mõni ruumi loomise tee läheb A2 advisory-lock'ist mööda.
- **KEELATUD:** andmete muutmine, UNIQUE indeksi lisamine, migratsioon, commit, push, deploy.
- Duplikaate ei ühendata ega kustutata automaatselt.
- Kui puhas → valmistada ette täpne partial UNIQUE migratsiooni- + rollback-plaan, aga MITTE rakendada enne kasutaja kinnitust.
- Lõpetada auditiga ja küsida kinnitust enne andmeparandust või kitsenduse lisamist.

## 2. Varasem A2 kontekst (loetud)

- `docs/platvormi arendus/01-opus-jarjekord-a2-u10-progress.md` §2 (A2): dedup viidud `(originType, originId)` peale, hapra description-markeri asemel; lisatud **mitte-unikaalne** liitindeks `Room_originType_originId_idx` (migratsioon `20260713170000_room_origin_composite_index`); app-level race-turvalisus Postgres advisory-lock'iga (`ensureRoomForPreInquiry`). DB partial-unique jäeti **teadlikult edasi** pärast produktsiooni duplikaatide auditit → käesolev töö.
- spawn_task „A2 follow-up: Room (originType,originId) partial UNIQUE index" — sama edasilükatud samm.

## 3. Aktiivse koodi / skeemi / migratsioonide / loomisteede audit

### 3.1. Skeem ja indeksid (`prisma/schema.prisma`, model `Room`)
- Väljad: `originType String?`, `originId String?`, `originLabel String?`, `originMeta Json?` (kõik nullable).
- Indeksid: `@@index([originType])`, `@@index([originId])`, **`@@index([originType, originId])`** (A2, mitte-unikaalne). UNIQUE kitsendust EI ole.
- Migratsioonid: `20260526093000_add_room_origin_meta` (lisas veerud + üksikindeksid, nullable, backfill'i pole); `20260713170000_room_origin_composite_index` (liitindeks). Kummaski POLE UNIQUE-t.

### 3.2. Origin-tüübid (`lib/rooms/origin.js`)
`MANUAL_INVITE`, `PRE_INQUIRY`, `HELP_MATCH`, `SERVICE_PROVIDER_INQUIRY`, `JOURNEY`, `UNKNOWN`. `buildRoomOrigin`: normaliseerib tüübi (tundmatu → `UNKNOWN`), `originId = cleanText(originId,120) || null` (tühi → NULL).

### 3.3. Kõik ruumi loomise teed (4 `.room.create` kohta)

| Tee | originType | originId | Dedup / race-kaitse | Katab partial UNIQUE? |
|---|---|---|---|---|
| `lib/rooms/preInquiryRoom.js` `ensureRoomForPreInquiry` | PRE_INQUIRY / SERVICE_PROVIDER_INQUIRY | = `inquiry.id` (**alati mitte-null**) | **A2 advisory-lock** (`pg_advisory_xact_lock`) + transaktsioon + membership-skoop | JAH |
| `lib/help/matches.js` `createHelpMatchAndRoom`→`ensureRoomForMatch` | HELP_MATCH | loomisel **NULL**, seejärel post-create `tx.room.update(... originId = helpMatch.id).catch(()=>null)` | **Ei kasuta A2 advisory-lock'i**, kuid race-turvaline: kogu töö on `$transaction`, `HelpMatch` on `@@unique([requestId, offerId])` → paralleelne teine loomine kukub P2002-l ja orb-ruum roll back'itakse; olemasoleva match'i korral taaskasutatakse `existing.roomId` | JAH (kui backfill õnnestus) |
| `app/api/invites/route.js` (2×) | MANUAL_INVITE | **NULL** (originId'd ei anta) | Teadlik: uus ruum või omaniku esimese ruumi taaskasutus; ei dedup'ita origin'i järgi | EI (originId NULL) |
| `app/api/invites/sponsored/init/route.js` (2×) | MANUAL_INVITE | **NULL** | sama | EI (originId NULL) |

### 3.4. Kas mõni tee läheb A2 advisory-lock'ist mööda?
- **JAH — HELP_MATCH** (`ensureRoomForMatch`) ei kasuta A2 advisory-lock'i. **See ei ole viga:** race-turvalisus tuleb `HelpMatch` unikaalsest kitsendusest (`requestId_offerId`) + `helpMatch.roomId` viitest samas transaktsioonis. Üks ruum ühe match'i kohta on tagatud sõltumata originId backfill'ist.
- **MANUAL_INVITE** (invite-teed) läheb samuti mööda, kuid originId = NULL → partial UNIQUE ei puuduta; dedup origin'i järgi pole soovitud.
- **Ainus PRE_INQUIRY/SERVICE_PROVIDER_INQUIRY loomistee** on `ensureRoomForPreInquiry` (advisory-lock'iga). Muid neid tüüpe loovaid teid ei ole.
- **JOURNEY:** ROOM_ORIGIN_TYPES.JOURNEY on defineeritud (label olemas), kuid **ükski tee ei loo JOURNEY-origin ruumi**. Partial UNIQUE'i JOURNEY-haru oleks praegu 0 rida (kahjutu), aga puhtalt tulevikuvaru.

### 3.5. Koodi-riskid partial UNIQUE jaoks
- **R1 (HELP_MATCH null originId):** origin-backfill on `.catch(()=>null)` → kui `tx.room.update` ebaõnnestub, jääb HELP_MATCH ruum `originId = NULL`. Partial UNIQUE (originId IS NOT NULL) sellist rida ei kata → **ei tekita kitsenduse rikkumist**; dedup on niikuinii tagatud `HelpMatch` unikaalsuse kaudu. Mõju: ainult origin-metaandme puudumine.
- **R2 (loomisteed ei püüa P2002):** ükski praegune tee ei püüa `originType/originId` UNIQUE rikkumist (kitsendust pole veel). Kui kitsendus lisada, tuleks `ensureRoomForPreInquiry` (ja tulevikus HELP_MATCH) täiendada, et P2002 korral olemasolev ruum uuesti pärida. Advisory-lock teeb selle praktikas ülimalt ebatõenäoliseks, aga DB-garantii korral on P2002-käsitlus korrektne lõppseis. **Käesolevas auditis koodi EI muudetud.**

## 4. Tootmisandmete read-only audit

### 4.1. Ligipääs ja ohutus
- Tootmis-DB ei ole lokaalselt kättesaadav (`.env.production` puudub; `.env` = localhost).
- Ligipääs: `ssh sotsiaalai` (ubuntu@217.146.72.147); `DATABASE_URL` failis `/etc/sotsiaalai/frontend.env` (loetav).
- **Read-only garantii:** päring jooksutati psql-is `SET default_transaction_read_only = on;` all, ainult `SELECT`-id, `-v ON_ERROR_STOP=1`. `DATABASE_URL` väärtust ei prinditud ega logitud. Ühtegi kirjutust/DDL-i ei tehtud.

### 4.2. Kasutatud auditipäring (read-only)
Kaheksa SELECT-plokki: (1) ruumide koguarv; (2) origin-tüüpide jaotus (total / with_origin_id / null_origin_id); (3) duplikaadid kõigi mitte-null originId järgi; (4) duplikaadid index-skoobis (`originType IN (PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY, HELP_MATCH, JOURNEY)`); (5) tühi/whitespace originId; (6) singleton-tüübid null-originId-ga (poolik backfill); (7) null/blank originType; (8) iga duplikaadi mõju (aktiivsed liikmed, sõnumid, kutsed, help-match'id, kõned). Täispäring on selle sessiooni käsuloos ja korratav samas read-only vormis.

### 4.3. Tulemused (tootmine, 2026-07-13)

| Kontroll | Tulemus |
|---|---|
| 1. Ruume kokku | **7** |
| 2. Origin-jaotus | kõik 7 rida: `originType = NULL`, `with_origin_id = 0`, `null_origin_id = 7` |
| 3. Duplikaadid (mitte-null originId) | **0 rida** |
| 4. Duplikaadid (index-skoop) | **0 rida** |
| 5. Tühi/whitespace originId | **0** |
| 6. Singleton-tüübid null-originId-ga | **0** |
| 7. Vigane originType | `null_type = 7`, `blank_type = 0` |
| 8. Duplikaatide mõju | **0 rida** |

### 4.4. Tõlgendus
- **Audit on PUHAS:** null ühtki `(originType, originId)` duplikaati, null tühja/vigast originId-d, null poolikut backfill'i.
- **Kõik 7 tootmisruumi on origin-eelsed** (nii originType kui originId NULL). See tähendab, et origin-põhiseid ruume (pre-pöördumine, help-match) ei ole tootmises veel tekkinud — need 7 ruumi on kas migratsioonieelsed või loodud enne origin-täitmist. Legacy null-origin ruumid EI ole „vigased"; partial UNIQUE (originId IS NOT NULL) neid ei puuduta.
- **Partial UNIQUE indeks kataks praegu 0 olemasolevat rida → selle loomine ei saa ebaõnnestuda olemasolevate duplikaatide tõttu.**

## 5. Duplikaatide käsitlus
Duplikaate EI leitud → ühendamis-/kustutamisplaani ei ole vaja. (Kui neid oleks leitud: iga juhtumi kohta oleks päring 8 andnud room_id, createdAt, aktiivsed liikmed, sõnumid, kutsed, help-match'id ja kõned; plaan oleks olnud säilita-vanim + käsitsi liida hilisemate ruumide liikmed/sõnumid, MITTE automaatne kustutus — ruumidel on seotud objektid.)

## 6. Ettevalmistatud partial UNIQUE migratsioon + rollback (MITTE rakendatud)

> **EI OLE RAKENDATUD.** Ootab kasutaja kinnitust (§8).

Prisma skeemi DSL ei toeta osalist unikaalset indeksit, seega see on **raw-SQL migratsioon**; Prisma mudelis jääb ainult mitte-unikaalne `Room_originType_originId_idx` (vt §7 drift-märkus).

### 6.1. Migratsioon (uus fail `prisma/migrations/<timestamp>_room_origin_partial_unique/migration.sql`)
```sql
-- A2 hardening: one room per confirmed singleton origin, enforced at the DB.
-- Partial unique index (Prisma DSL cannot express it) — only non-null originId
-- of singleton origin types; MANUAL_INVITE/UNKNOWN (null originId) are exempt.
CREATE UNIQUE INDEX "Room_origin_singleton_unique"
  ON "Room" ("originType", "originId")
  WHERE "originId" IS NOT NULL
    AND "originType" IN ('PRE_INQUIRY', 'SERVICE_PROVIDER_INQUIRY', 'HELP_MATCH');
```
- Soovitatud tüübid: **PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY, HELP_MATCH** (tegelikult kasutusel olevad singleton-origin'id). `JOURNEY` võib lisada, KUI/kui tekib dedup'iva JOURNEY-ruumi loomistee — muidu on see tulevikuvaru ilma ridadeta (kasutaja otsus).
- 7-realise tabeli peal on `CREATE UNIQUE INDEX` (ilma CONCURRENTLY) hetkeline. Suurema tabeli korral kaaluks `CREATE UNIQUE INDEX CONCURRENTLY` (ei saa transaktsioonis → Prisma migratsiooni jaoks eritöö); praegu pole vaja.

### 6.2. Rollback
```sql
DROP INDEX IF EXISTS "Room_origin_singleton_unique";
```
Täielikult tagasipööratav; indeks ei muuda andmeid.

### 6.3. Rakendamise-eelne kontroll (kinnituse järel)
1. Korda §4 read-only auditit vahetult enne (kinnita 0 duplikaati).
2. `npm run db:migrate:check` (ajutine reaalne DB, kogu ahel).
3. Koodi-täiendus (soovituslik, samas PR-is): `ensureRoomForPreInquiry` (ja HELP_MATCH-tee) püüab P2002 → pärib olemasoleva ruumi. Advisory-lock jääb esimeseks kaitseks.

## 7. Riskid
- **Prisma drift:** partial-unique on raw-SQL, mitte skeemis → `prisma migrate dev` (lokaalne arendus) võib teatada driftist ja tahta „parandada". `migrate deploy`/`migrate status` (tootmine + `db:migrate:check`) drifti EI kontrolli, seega tootmine ei katke. Leevendus: hoia skeemis mitte-unikaalne liitindeks (juba olemas), käsitle partial-unique'i käsitsi-hallatava indeksina; dokumenteeri arendajatele.
- **Tulevikukindlus:** kui lisada JOURNEY (või muu) origin-ruumi loomistee, PEAB see dedup'ima (nagu pre-pöördumine) või P2002 käsitlema, muidu murrab kitsendus loomise.
- **HELP_MATCH null originId (R1):** ei riku kitsendust; jälgi, et backfill-update õnnestub (praegu `.catch(()=>null)`).
- **Andmeseis muutub:** audit kajastab 2026-07-13 seisu (7 origin-eelset ruumi). Enne kitsenduse rakendamist korrata auditit (§6.3.1).

## 8. Järgmine otsustuspunkt (kasutaja)

Audit on **puhas**; DB partial UNIQUE on olemasolevate andmete suhtes ohutu lisada. **Ma ootan Sinu kinnitust** enne, kui:
1. lisan partial UNIQUE migratsiooni (§6.1) + valikuliselt P2002-koodikäsitluse, ja/või
2. teen mis tahes andmeparanduse (praegu pole vaja — duplikaate ei ole).

Palun kinnita, kas soovid, et valmistan/rakendan §6 migratsiooni (ja kas kaasata `JOURNEY` indeksisse), või jätame edasi ootele.

## 9. Progressipäevik

### 2026-07-13 19:02 Europe/Tallinn — OPUS — AUDIT VALMIS
- Etapp: A2 DB-unique ettevalmistav audit (read-only).
- Mudel ja effort: Opus 4.8; effort-tase ei olnud nähtav (vt §0); kogu töö read-only.
- Tehtud: loetud varasem A2 materjal (01-doc §2 + spawn_task); auditeeritud skeem, indeksid, migratsioonid ja kõik 4 ruumi loomise teed; tuvastatud advisory-lock'ist möödujad (HELP_MATCH — race-turvaline muul viisil; MANUAL_INVITE — null origin); jooksutatud tootmises garanteeritud read-only auditipäring.
- Muudetud failid: ainult käesolev auditidokument. Andmeid, skeemi, migratsioone EI muudetud; commit/push/deploy EI tehtud.
- Käivitatud kontrollid ja tulemused: tootmine 7 ruumi, kõik origin-eelsed (null); **0 duplikaati, 0 tühja/vigast originId, 0 poolikut backfill'i** → PUHAS. Partial UNIQUE kataks 0 rida → ohutu.
- Otsused ja põhjendus: puhta auditi tõttu valmistatud §6 migratsioon + rollback, kuid MITTE rakendatud; ootab kasutaja kinnitust.
- Risk või takistus: Prisma drift (raw-SQL partial-unique); tulevased origin-teed peavad dedup'ima/P2002 käsitlema; audit on ajahetke seis (korrata enne rakendamist).
- Järgmine samm: kasutaja kinnitus §8 → seejärel migratsioon + valikuline P2002-koodikäsitlus.

### 2026-07-13 19:13 Europe/Tallinn — OPUS — MIGRATSIOON + P2002 RAKENDATUD KOODIS (ootab commit/push luba)

- Etapp: kasutaja valis **valiku 2** — partial UNIQUE 3 tüübile (PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY, HELP_MATCH) + P2002-käsitlus; **JOURNEY välja** kuni selle ruumi loomistee tekib.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- Tehtud:
  - Kordusaudit (read-only tootmine): endiselt 7 ruumi, **0 duplikaati**, 0 tühja/null-singleton originId → ohutu.
  - Migratsioon: `prisma/migrations/20260713193000_room_origin_partial_unique/migration.sql` — `CREATE UNIQUE INDEX "Room_origin_singleton_unique" ON "Room"("originType","originId") WHERE "originId" IS NOT NULL AND "originType" IN ('PRE_INQUIRY','SERVICE_PROVIDER_INQUIRY','HELP_MATCH')`. (JOURNEY teadlikult väljas.)
  - P2002-tagavara: `lib/rooms/preInquiryRoom.js` `ensureRoomForPreInquiry` — kui racing-insert libiseb advisory-lock'ist mööda ja DB-kitsendus lükkab tagasi (P2002), pärib olemasoleva ruumi (transaktsioonivälise `db.room.findFirst`-iga) ja tagastab selle; muidu re-throw. Advisory-lock jääb esimeseks kaitseks. HELP_MATCH ei vaja muudatust (struktuurselt turvaline: `HelpMatch` unique → üks ruum ühe match'i kohta; originId = helpMatch.id ei saa kahes ruumis korduda).
  - Testid: `tests/rooms/preInquiryRoomDedup.test.js` — 2 uut P2002-testi (tagavara → olemasolev ruum; re-throw kui olemasolevat ei leita).
- Muudetud/uued failid: `prisma/migrations/20260713193000_room_origin_partial_unique/migration.sql` (uus), `lib/rooms/preInquiryRoom.js`, `tests/rooms/preInquiryRoomDedup.test.js`, käesolev auditidoc.
- Käivitatud kontrollid ja tulemused:
  - `npm run db:migrate:check` → **OK** (79 migratsiooni, „schema up to date", drift-viga puudub → raw-SQL partial-index sobib `migrate deploy`-ga).
  - Indeksi definitsiooni kontroll reaalses Postgresis → osaline predikaat täpselt `WHERE originId IS NOT NULL AND originType IN (PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY, HELP_MATCH)`.
  - A2 dedup-testid **9/9**; `npm test` **779/779**; `eslint` 0 viga; `npm run build` „Compiled successfully"; `git diff --check` puhas; runtime-smoke ruumi-endpoint autoriseerimata → 401 (laadib).
- Otsused/põhjendus: valik 2 (kasutaja). Migratsioon on raw-SQL (Prisma DSL ei toeta partial-unique'i); `migrate deploy`/`db:migrate:check` läbivad. P2002-käsitlus muudab samaaegse loomise DB-garantii korral korrektseks.
- **EI tehtud:** commit, push, deploy. Andmeid tootmises EI muudetud (audit oli read-only; duplikaate polnud).
- Järgmine otsustuspunkt: kasutaja luba commit + push. **Deploy on eraldi samm** — enne tootmis-deploy'd korrata read-only auditit (§6.3.1) ja jooksutada `migrate deploy` tootmises alles kasutaja loal.

### 2026-07-13 19:29 Europe/Tallinn — OPUS — SOLI BLOKEERIV VIGA PARANDATUD (ootab Soli taaskontrolli)

- Etapp: Soli järelkontrolli blokeeriva vea parandus enne commit'i.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- **Soli leitud viga (blokeeriv):** partial UNIQUE ei ühildunud membership-scoped otsinguga. Kui eelpöördumise autor/adressaat oli canonical-ruumist lahkunud (`leftAt != null`) ja vajutas uuesti „Ava ruum", ei leidnud `ensureRoomForPreInquiry` ruumi (filter nõudis `leftAt: null`), proovis luua teise ruumi → DB partial UNIQUE lükkas tagasi (P2002) → P2002-varuotsing kasutas sama membership-filtrit → ei leidnud → **500**.
- **Parandus (`lib/rooms/preInquiryRoom.js`):**
  1. Canonical-ruum leitakse **origin'i järgi** (`originType IN set, originId`), MITTE membership-filtriga → üks canonical-ruum origin'i kohta.
  2. Uus `joinCanonicalRoom`: lubatud pool (autor/adressaat) või varasem liige (olemasolev membership-rida) **taasaktiveerib oma liikmelisuse** (`leftAt = null`) sõnaselgel „Ava ruum" tegevusel; kõrvaline (pole pool ega varasem liige) saab **403** ega saa liikmeks ega infot ruumi olemasolust.
  3. Canonical-ruumi loomine lubatud ainult poolele (`isParty`).
  4. **P2002-varuotsing järgib sama canonical-loogikat** (`resolveCanonicalRoom(db)`).
  5. Marsruut (`app/api/pre-inquiries/[id]/room/route.js`): veakäsitlus austab nüüd `error.status`-t (<500 → sama staatus, nt 403), mitte blanket-500 → helperi 403 ei maskeerita 500-ks.
  6. Aegunud kommentaar uuendatud: helperi docstring ei ütle enam, et UNIQUE on „edasilükatud" — nüüd DB-tasemel tagatud.
- **Testid (`tests/rooms/preInquiryRoomDedup.test.js`):** eemaldatud „non-member creates a new room" (DB UNIQUE korral tootmises võimatu). Lisatud: lahkunud pool taasliitub (membership reaktiveeritud, teist ruumi ei looda); kõrvaline saab 403 ega lisata; teist origin-ruumi ei looda; P2002-rada jääb toimima (canonical-varu + re-throw kui olemasolevat ei leita). **10/10.**
- Käivitatud kontrollid ja tulemused: A2 dedup **10/10**; `npm test` **780/780**; `eslint` muudetud failid 0 viga; `npm run build` „Compiled successfully"; `npm run db:migrate:check` OK (79 migratsiooni, schema up to date); `git diff --check` puhas; runtime-smoke ruumi-endpoint autoriseerimata → 401.
- **EI tehtud:** commit, push, deploy.
- Järgmine samm: Soli taaskontroll. Seejärel (kasutaja loal) commit + push; deploy eraldi.

### 2026-07-13 19:49 Europe/Tallinn — OPUS — SOLI PRIVAATSUSERV PARANDATUD (ootab Soli taaskontrolli)

- Etapp: Soli 2. järelkontrolli privaatsuserva parandus enne commit'i.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- **Soli leitud privaatsuserv (blokeeriv):** `joinCanonicalRoom` lisas olemasolevasse canonical-ruumi praeguse autori/adressaadi liikmelisuse ka siis, kui tal polnud selles ruumis kunagi liikmelisust. Kuna `updatePreInquiry` lubab enne SENT-i adressaati muuta, oleks **uus adressaat saanud ligipääsu vana adressaadiga peetud ruumi ajaloole**.
- **Parandus:**
  1. `lib/rooms/preInquiryRoom.js`: `joinCanonicalRoom` → `reactivateMembership` — olemasolevas canonical-ruumis **ainult taasaktiveerib olemasolevat liikmelisust** (`leftAt = null`); **ei loo kunagi uut liikmelisust**, isegi mitte praegusele adressaadile. Varasema liikmelisuseta kasutaja (sh ümbermääratud adressaat) → üldine **403**, ruumi olemasolu ei lekitata. Esmasel loomisel lisatakse endiselt autor + adressaat koos; luua tohib ainult pool (`isParty`).
  2. `lib/preInquiries.js`: uus `assertRecipientChangeAllowed({inquiryId, previousRecipientOwnerId, nextRecipientOwnerId}, {db, findCanonicalRoom})` — kui adressaat muutub JA canonical-ruum juba eksisteerib → üldine **409** (`pre_inquiries.errors.recipient_locked_by_room`). Kutsutud `updatePreInquiry`-s pärast `resolveRecipient`-i. Adressaadi üleviimine = tulevane eraldi teadlik voog. Uus abifunktsioon `findPreInquiryCanonicalRoom(originId, {db})` (preInquiryRoom.js).
  3. Marsruut `app/api/pre-inquiries/[id]/room/route.js`: veakäsitlus kasutab nüüd `publicErrorStatus`/`publicErrorMessageKey` — ainult whitelistitud `api.*`/`documents.*` võtmed (nt helperi `api.common.forbidden` 403) väljastatakse oma staatusega; kõik muu → üldine 500. Suvalist `error.message`-i ei väljastata.
- **Testid:**
  - `tests/rooms/preInquiryRoomDedup.test.js`: lisatud „ümbermääratud adressaat ilma varasema liikmelisuseta ei pääse vana ruumi (403, ei mintita liikmelisust)". Säilinud: lahkunud liige taasaktiveeritakse; kõrvaline 403; teist ruumi ei looda; esmane ruum sisaldab mõlemat poolt; P2002-rada. → **11/11.**
  - `tests/preInquiries/recipientRoomLock.test.js` (uus): muutmata adressaat → no-op (ruumi ei päritagi); null/tühi = muutmata; muutus + ruum olemas → 409; muutus enne ruumi → lubatud. → **4/4.**
- Muudetud/uued failid: `lib/rooms/preInquiryRoom.js`, `lib/preInquiries.js`, `app/api/pre-inquiries/[id]/room/route.js`, `tests/rooms/preInquiryRoomDedup.test.js`, `tests/preInquiries/recipientRoomLock.test.js` (uus), käesolev doc.
- Käivitatud kontrollid ja tulemused: sihttestid **15/15**; `npm test` **785/785**; `eslint` muudetud failid 0 viga; `npm run build` „Compiled successfully"; `npm run db:migrate:check` OK; `git diff --check` puhas; ristimport (preInquiries ↔ preInquiryRoom) laadib puhtalt (ei tsüklit).
- **EI tehtud:** commit, push, deploy.
- Järgmine samm: Soli taaskontroll.

### 2026-07-13 20:09 Europe/Tallinn — OPUS — SOLI CONCURRENCY-SERV PARANDATUD (atomaarne; ootab Soli viimast kontrolli)

- Etapp: Soli 3. järelkontrolli concurrency-serva parandus enne commit'i.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- **Soli leitud concurrency-serv (blokeeriv):** `assertRecipientChangeAllowed` kontrollis ruumi olemasolu ja `preInquiry.update` toimus hiljem eraldi. Paralleelne „Ava ruum" mahtus vahele: PATCH kontrollib (ruumi pole) → POST loob ruumi vana adressaadiga → PATCH muudab adressaadi uueks. Tulemus mittedeterministlik.
- **Parandus (atomaarne, sama advisory-lock + transaktsioon):**
  1. Uus jagatud `withPreInquiryRoomLock(inquiryId, callback, {db})` (`preInquiryRoom.js`) — võtab transaktsioonis `pg_advisory_xact_lock(hashtext('preInquiryRoom:'+id))`. **Nii ruumi loomine kui adressaadi muutmine kasutavad sama võtit + transaktsiooni** → ei saa põimuda.
  2. `ensureRoomForPreInquiry` **loeb luku all `preInquiry.findUnique`-ga uuesti aktiivse `authorId`, `recipientOwnerId`, `recipientType`** (ei usalda route'i pre-lock snapshotti); liikmed luuakse värske andme põhjal. Ruum kuulub deterministlikult autorile.
  3. `updatePreInquiry`: adressaadi-kontroll + `preInquiry.update` on nüüd **ühes `withPreInquiryRoomLock` transaktsioonis**. `assertRecipientChangeAllowed(client, {...})` võtab nüüd transaktsiooni-client'i.
  4. Deterministlik tulemus: ruum enne → hilisem adressaadimuutus 409; adressaat enne → ruum värske adressaadiga.
  5. Route veakäsitlus (eelmisest ringist) austab `publicErrorStatus`/`publicErrorMessageKey`.
- **i18n:** `pre_inquiries.errors.recipient_locked_by_room` lisatud **ET/EN/RU** (varem puudus kõigist; pariteet oli olemas, seega `i18n:check` seda ei avastanud).
- **Testid (juhitav fake-transaction/lukk jagatud store'iga, ei ainult regex):**
  - `preInquiryRoomDedup.test.js`: **ordering A** (ruum enne → adressaadimuutus 409, ruum säilitab vanad pooled); **ordering B** (adressaat enne → ruum värske adressaadiga, vana adressaat pole liige). Säilinud: canonical-loomine (autor+adressaat, autori-omanik), taasaktiveerimine, kõrvaline 403, ümbermääratud adressaat 403, P2002-rada, recipientType-dedup. → **13/13.**
  - `recipientRoomLock.test.js`: `assertRecipientChangeAllowed(client, …)` — muutmata → no-op; null/tühi = muutmata; muutus+ruum → 409; muutus enne ruumi → lubatud. → **4/4.**
- Muudetud/uued failid: `lib/rooms/preInquiryRoom.js`, `lib/preInquiries.js`, `messages/{et,en,ru}.json`, `tests/rooms/preInquiryRoomDedup.test.js`, `tests/preInquiries/recipientRoomLock.test.js`.
- Käivitatud kontrollid: sihttestid **17/17**; `npm test` **787/787**; `i18n:check` OK; `eslint` 0 viga; `npm run build` „Compiled successfully"; `npm run db:migrate:check` OK; `git diff --check` puhas.
- **EI tehtud:** commit, push, deploy.
- Järgmine samm: Soli viimane kontroll.

### 2026-07-13 20:27 Europe/Tallinn — OPUS — SOLI STALE-SNAPSHOT SERV PARANDATUD (ootab Soli kontrolli)

- Etapp: Soli 4. järelkontrolli stale-snapshot serva parandus enne commit'i.
- Mudel ja effort: Opus 4.8, Extra (`xhigh`).
- **Soli leitud stale-snapshot serv (blokeeriv):** `updatePreInquiry` kasutas luku sees enne lukku loetud `existing.recipientOwnerId` + `recipient` snapshotti. Kahe paralleelse PATCH-i korral võis hilisem sisumuudatus kirjutada vahepeal muudetud adressaadi vana snapshot'i põhjal tagasi.
- **Parandus (kõik adressaadi-loogika luku all värske kirje põhjal):**
  1. `updatePreInquiry`: kogu adressaadi-lahendus, draft, staatus-kontroll, privaatsus ja `preInquiry.update` on nüüd **luku sees**. Loeb `tx.preInquiry.findUnique`-ga aktiivse kirje (recipientEntryId/Type/OwnerId/email/name, status, situation, topic, drafts, assessment) ja **lahendab adressaadi `resolveRecipient(..., {db: tx})`-ga värskete vaikeväärtuste põhjal** (mitte pre-lock `existing`). Adressaadi-kontroll võrdleb värsket DB `recipientOwnerId`-d värskelt lahendatud järgmisega. Ühtki enne lukku loetud adressaadivälja tagasi ei kirjutata.
  2. E-kirja dispatch (`shouldSendInternalArrival` → `dispatchInternalArrivalEmail`) **pärast transaktsiooni** (arrival-snapshot kogutakse luku all).
  3. `updatePreInquiry` + `getVisiblePreInquiry` said süstitava `{db}` (testitavus); DI vaikeväärtus = `prisma`.
  4. `ensureRoomForPreInquiry`: ruumi loomisel kontrollitakse luku all, et **`freshParties` sisaldab 2 erinevat kasutajat**; muidu üldine 409 `room_requires_platform_recipient` (ei looda ühe liikmega „ühist" ruumi).
  5. Route: `room_requires_platform_recipient` 409 **kaardistatud sõnaselgelt** (kuna `publicErrorMessageKey/Status` ei luba `pre_inquiries.*` võtmeid) — ei muutu 500-ks.
- **i18n:** lisatud `pre_inquiries.errors.room_requires_platform_recipient` **ET/EN/RU** (varem puudus; nüüd väljastatud).
- **Testid:**
  - Uus `tests/preInquiries/updateRecipientAtomicity.test.js`: stale-snapshot regressioon — pre-lock loeb vana adressaadi, luku all värske (uus); sisu-ainult PATCH lahendab adressaadi **värskest kirjest** ja EI kirjuta vana tagasi (uus jääb alles). Kukuks vana koodiga läbi.
  - `preInquiryRoomDedup.test.js`: ordering-testid kirjeldatud ausalt **järjestikuse determinismina** (fake `$executeRaw` ei modelleeri lukku; reaalne mutex = Postgres advisory-lock + partial-unique, kontrollitud `db:migrate:check`-iga). → **14/14.**
  - `recipientRoomLock.test.js`: **4/4.**
- Muudetud/uued failid: `lib/rooms/preInquiryRoom.js`, `lib/preInquiries.js`, `app/api/pre-inquiries/[id]/room/route.js`, `messages/{et,en,ru}.json`, `tests/rooms/preInquiryRoomDedup.test.js`, `tests/preInquiries/recipientRoomLock.test.js`, `tests/preInquiries/updateRecipientAtomicity.test.js` (uus).
- Käivitatud kontrollid: sihttestid **18/18**; `npm test` **788/788**; `i18n:check` OK; `eslint` 0 viga; `npm run build` „Compiled successfully"; `npm run db:migrate:check` OK; `git diff --check` puhas.
- **EI tehtud:** commit, push, deploy.
- Järgmine samm: Soli kontroll.

### 2026-07-13 23:33 Europe/Tallinn — SOL — LÕPLIK JÄRELKONTROLL / HEAKS KIIDETUD

- Kontrollitud partial UNIQUE migratsiooni ulatus, canonical-ruumi leidmine, P2002 varutee, lahkunud liikme taasaktiveerimine, kõrvalise kasutaja tõkestamine, adressaadi muutmise privaatsuspiir, jagatud advisory-lock ning stale-snapshot regressioon.
- Kinnitatud: ruumi loomine ja adressaadi muutmine kasutavad sama `preInquiryRoom:<id>` transaction-scoped advisory-lock'i; mõlemad loevad luku all aktiivse andmeseisu. Adressaadi kontroll ja update on samas transaktsioonis ning e-kirja saatmiskatse toimub pärast commit'i.
- Kinnitatud: olemasolevasse canonical-ruumi ei looda uut liikmelisust; varasem `leftAt` liikmelisus taasaktiveeritakse. Esmane ruum luuakse värske autori ja värske platvormiadressaadiga, omanikuks jääb deterministlikult autor ning ühe liikmega ühist ruumi ei looda.
- Kinnitatud: ohutud 403/404/409 vastused on kontrollitud; suvalist serverivea teksti ruumi marsruut ei väljasta. ET/EN/RU tõlkevõtmed on olemas.
- Soli sõltumatud sihttestid: **28/28** (A2, adressaadilukk, stale-snapshot ja A5 e-kirja regressioonid).
- Soli sõltumatu kogu `npm test`: **788/788**.
- `npm run build`: **OK**.
- `npm run db:migrate:check`: **OK**, kõik **79 migratsiooni** rakendusid ajutises reaalses PostgreSQL andmebaasis ja skeem oli ajakohane.
- Muudetud failide ESLint: **0 viga**; `npm run i18n:check`: **OK**; `git diff --check`: puhas.
- Autenditud kahe kasutajaga brauseri-e2e jäi tegemata; concurrency garantii tugineb ühisele PostgreSQL advisory-lock'ile, DB partial UNIQUE indeksile ning deterministlike järjestuste ja stale-snapshot'i ühiktestidele.
- Töökataloogis on A2-väliseid ruumipiltide kustutusi ja `output/imagegen` / kaadriskripti faile. Neid Sol selle A2 järelkontrolli osana ei hinnanud.

**Soli otsus:** A2 DB partial UNIQUE hardening on **HEAKS KIIDETUD**. A2 failid võib kasutaja loal commit'ida ja push'ida. Tootmise deploy ning `migrate deploy` jäävad eraldi otsuseks ja vajavad vahetult enne uut read-only duplikaadiauditit.

### 2026-07-13 20:33 Europe/Tallinn — OPUS — COMMIT'ITUD + PUSH'ITUD

- Kasutaja loal (Soli heakskiidu järel) commit'itud ja push'itud A2 muudatused + progressidokumendid.
- Commit: **`6a8e9fca`** — „A2: Room origin partial UNIQUE hardening (Sol HEAKS KIIDETUD)".
- Push: `fabe2b9e..6a8e9fca  main -> main` → `github.com:LauRRaud/SotsiaalAI-uus.git`; `main` sünkroonis `origin/main`-iga.
- **Selektiivne commit (12 faili):** `prisma/migrations/20260713193000_room_origin_partial_unique/`, `lib/rooms/preInquiryRoom.js`, `lib/preInquiries.js`, `app/api/pre-inquiries/[id]/room/route.js`, `messages/{et,en,ru}.json`, `tests/rooms/preInquiryRoomDedup.test.js`, `tests/preInquiries/recipientRoomLock.test.js`, `tests/preInquiries/updateRecipientAtomicity.test.js`, `docs/platvormi arendus/{01,02}-…-progress.md`.
- **Teadlikult välja jäetud (A2-välised, kasutaja korraldus):** `public/room/frame-*.webp` kustutused, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs`. Need jäid stage'imata.
- Enne commit'i kinnitatud roheline seis: `npm test` 788/788, sihttestid 18/18, `i18n:check` OK, lint 0, build ✓, `db:migrate:check` OK, `git diff --check` puhas.
- **EI tehtud:** tootmis-deploy, `migrate deploy`.
- **Tootmis-deploy = eraldi samm:** enne seda tuleb (1) korrata read-only duplikaadiauditit (§4/§6.3.1) ja (2) küsida kasutajalt selge luba; alles siis `migrate deploy` tootmises.
