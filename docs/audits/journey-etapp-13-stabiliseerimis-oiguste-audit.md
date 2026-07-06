# SotsiaalAI Journey MVP — Etapp 13 stabiliseerimis-, õiguste ja rollitöölaudade raport

## 1. Faas A auditi tulemus

**CONTINUE_WITH_CAUTION**

Faas A leidis alguses blokeeriva Etapp 9/11 migratsiooniseisu:

- `20260526093000_add_room_origin_meta` ja `20260526103000_add_service_map_access_path` olid Prisma jaoks rakendamata.
- Lokaalses dev-andmebaasis olid samad veerud juba olemas.

Parandus:

- `20260526093000_add_room_origin_meta` muudeti idempotentseks (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Mõlemad Etapp 9/11 migratsioonid märgiti lokaalses dev-andmebaasis rakendatuks käsuga `prisma migrate resolve --applied`.
- `npx prisma migrate status` näitab nüüd: `Database schema is up to date!`

Alles jääv ettevaatus:

- `npx prisma migrate dev` tuvastab endiselt varasema dev-andmebaasi drift'i migratsiooni `20260105120000_add_rooms_invites` ja vanade timestamp/index erinevuste tõttu.
- Seda ei parandatud reset'iga, sest DB reset ei olnud lubatud.
- See drift ei tulene Etapp 9–12 uutest väljadest pärast resolve-parandust, kuid enne production deploy'd tuleb seda eraldi hinnata staging/puhta DB peal.

## 2. Migration status

Käitatud:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate dev
```

Tulemused:

| Käsk | Tulemus |
|---|---|
| `npx prisma validate` | Läbis |
| `npx prisma generate` | Läbis |
| `npx prisma migrate status` | Läbis, DB schema up to date |
| `npx prisma migrate dev` | Ei läbinud varasema dev drift'i tõttu |

Etapp 9/11 migratsioonide seis:

| Migratsioon | Seis |
|---|---|
| `20260526093000_add_room_origin_meta` | Märgitud rakendatuks, SQL idempotentne |
| `20260526103000_add_service_map_access_path` | Märgitud rakendatuks, SQL kasutab `IF NOT EXISTS` |

Production deploy:

- Otse production deploy'd ei tehtud.
- Production deploy on lubatav alles pärast eraldi staging/puhta DB migratsiooniproovi.
- Lokaalse dev drift'i tõttu ei tohiks teha pimesi reset'i ega deploy-otsust ainult selle dev-DB põhjal.

## 3. Õiguste ja rollide audit

Journey owner-piir:

- `GET /api/journeys` kasutab sessiooni kasutaja ID-d.
- `POST /api/journeys` seab `ownerUserId` serveris.
- `GET /api/journeys/[id]` kasutab `id + ownerUserId` filtrit.
- `PATCH /api/journeys/[id]` kontrollib enne muutmist `id + ownerUserId`.
- `conversationId` seostamisel kontrollitakse vestluse omanikku.
- `sharingStatus` lubatud väärtus on MVP-s ainult `PRIVATE`.

Sisselogimata smoke:

| Päring | Tulemus |
|---|---|
| `GET /api/journeys` | `401` |
| `GET /api/journeys/smoke-missing-id` | `401` |
| `POST /api/journeys/draft` | `401` |

Rollipõhine brauserikontroll admin effective role kaudu:

| Rollivaade | Tulemus |
|---|---|
| CLIENT | `/teekond` kuvab pöörduja Teekonna tööpinna ja privaatseid Teekondi |
| SOCIAL_WORKER | `/teekond` ei kuva privaatsete Teekondade nimekirja; kuvab kinnitatud eelinfo töövaate |
| SERVICE_PROVIDER | `/teekond` ei kuva privaatsete Teekondade nimekirja; kuvab teenusega seotud eelinfo töövaate |

## 4. Privaatsuse audit

Kinnitused:

- SOCIAL_WORKER ei saa uut ligipääsu kasutaja privaatsele Journey objektile.
- SERVICE_PROVIDER ei saa uut ligipääsu kasutaja privaatsele Journey objektile.
- Private chat ei liigu eelpöördumise, teenuseosutaja ega room vaatesse.
- Room `originId`/`originMeta` on kirjeldav metadata, mitte access source.
- `accessPath` ei sisalda kasutaja Journey sisu.
- Tervisekontakti küsimuste mustand ei saada infot automaatselt.

## 5. API audit

Kontrollitud route'id:

- `GET /api/journeys`
- `POST /api/journeys`
- `GET /api/journeys/[id]`
- `PATCH /api/journeys/[id]`
- `POST /api/journeys/draft`
- `POST /api/journeys/[id]/pre-inquiry-draft`

Järeldus:

- API jääb owner-põhiseks.
- Draft route ei loo DB objekti.
- Handoff route'id ei anna vastuvõtjale Journey objekti lugemisõigust.

## 6. UI ja i18n audit

Käitatud:

```bash
npx eslint app/teekond components/journey lib/journey app/api/journeys components/workspace lib/serviceMap components/chat components/rooms lib/rooms lib/workspaceDashboardCards.js
```

Tulemus:

- Sihitud ESLint läbis.
- Uued Etapp 13 tekstid lisati `messages/et.json`, `messages/en.json`, `messages/ru.json`.
- Uus UI kasutab olemasolevaid `Button`, `GlassSubpageHeader`, glass/workspace klasside mustreid.
- Ei lisatud uut kujundussüsteemi.

## 7. Faas B teostus

Faas B tehti pärast migratsioonivärava parandamist.

Muudetud/lisatud põhilised failid:

- `components/journey/JourneyDashboard.jsx`
- `messages/et.json`
- `messages/en.json`
- `messages/ru.json`
- `prisma/migrations/20260526093000_add_room_origin_meta/migration.sql`

CLIENT:

- `/teekond` kuvab pöörduja Teekonna tööpinna.
- Näha on "Alusta Teekonda", "Jätka viimast Teekonda", eelpöördumiste, teenusekaardi ja dokumentide kiirlingid.
- Privaatse Teekonna märge jääb nähtavaks.
- Privaatseid Journey objekte laaditakse ainult CLIENT vaates.

SOCIAL_WORKER:

- `/teekond` ei kuva teiste kasutajate Journey nimekirja.
- Kuvatakse "Kinnitatud eelinfo" vaade.
- Tegevused suunavad olemasolevatesse eelpöördumise, ruumide ja dokumendi töövoogudesse.
- Tekst selgitab, et privaatset Teekonda ega assistendivestlust ei jagata automaatselt.

SERVICE_PROVIDER:

- `/teekond` ei kuva teiste kasutajate Journey nimekirja.
- Kuvatakse "Teenusega seotud eelinfo" vaade.
- Tegevused suunavad olemasolevatesse teenusega seotud pöördumise, ruumide ja teenuseprofiili töövoogudesse.
- Tekst selgitab, et teenuseosutaja näeb ainult kinnitatud ja teenusega seotud infot.

Admin effective role:

- Admin saab `/teekond` vaates kasutada olemasolevat role preview loogikat.
- CLIENT preview kuvab CLIENT tööpinna.
- SOCIAL_WORKER preview kuvab spetsialisti eelinfo töövaate.
- SERVICE_PROVIDER preview kuvab teenuseosutaja eelinfo töövaate.

## 8. Regressioonid

Kontrollitud:

- Prisma validate/generate läbis.
- Prisma migrate status on korras.
- Sihitud ESLint läbis.
- `/teekond` rollivaated renderdusid brauseris.
- CLIENT/SOCIAL_WORKER/SERVICE_PROVIDER rollivaadetes ei olnud rakenduse console error'e; esines ainult Chromium WebGL performance warning, mis ei ole rakenduse viga.

Kontrollimata täismahus:

- Kõik chat/RAG töövood brauseris.
- Kõik room loomise variandid.
- Kõik eelpöördumise vastuvõtu harud.

## 9. Riskid

### Kõrge

- `npx prisma migrate dev` näitab endiselt varasema dev-andmebaasi drift'i. Enne production deploy'd on vaja staging/puhta DB migratsiooniproovi.

### Keskmine

- Rollitöölaudade Faas B on minimaalne koondkiht; see ei too veel spetsialistile ega teenuseosutajale uut statistikat ega päris "inbox" filtreid.
- Täielik room/eelpöördumise/chat regressioon vajab eraldi QA ringi.

### Madal

- Tervisekontakti ja accessPath andmekvaliteet sõltub sisendandmete olemasolust.

## 10. Paranduste nimekiri

### Kriitiline enne deploy'd

1. Käivitada migratsioonid puhta DB või staging DB peal.
2. Lahendada või dokumenteerida vana `20260105120000_add_rooms_invites` dev drift.
3. Mitte teha `prisma migrate reset` ilma eraldi loata ja andmete varunduseta.

### Soovitatav enne kasutajatesti

1. Testida CLIENT, SOCIAL_WORKER ja SERVICE_PROVIDER rollivaateid päris testkontodega, mitte ainult admin preview'ga.
2. Testida eelpöördumise, teenuseosutaja ja room seoseid päris andmetega.
3. Testida tavachat/RAG allikate kuvamist pärast Teekonna + menüü töövoogu.

### Hilisem tehniline võlg

1. Lisada API taseme owner-access testid.
2. Lisada Journey handoff helperite unit-testid.
3. Lisada role-dashboard päris koondandmete endpoint'id, kui tooteotsus seda nõuab.

## 11. Soovitus

- Teekonna süsteem on lokaalse `migrate status`, lint ja smoke vaates edasiarenduseks kasutatav.
- Production deploy ei ole veel soovitatav enne staging/puhta DB migratsiooniproovi.
- Etapp 1–12 kriitilist privaatsusleket Faas A käigus ei tuvastanud.
- Etapp 13 rollipõhised töölaudade muudatused on konservatiivsed ja ei anna spetsialistile ega teenuseosutajale privaatset Journey ligipääsu.
- Järgmine praktiline samm on migratsiooniproov staging/puhta DB peal ja seejärel täisrolli QA päris testkontodega.

## 12. Lõpukontroll

- Faas A otsus on `CONTINUE_WITH_CAUTION`.
- Faas B tehti pärast Etapp 9/11 migratsioonivärava parandamist.
- Chat/RAG tuuma ei refaktoreeritud.
- `PreInquiryStatus` jäi puutumata.
- Room access jäi puutumata.
- Journey owner-põhine privaatsusmudel jäi puutumata.
- Production deploy'd ei tehtud.
- DB reset'i ei tehtud.
