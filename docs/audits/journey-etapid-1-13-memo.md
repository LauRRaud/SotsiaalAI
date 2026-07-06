# SotsiaalAI Journey MVP — Etappide 1–13 memo

## Kokkuvõte

Teekonna MVP on ehitatud õhukese kihina olemasolevate töövoogude peale. Püsivaks objektiks jääb ainult kasutaja kinnitatud privaatne Journey. Chat/RAG, eelpöördumise põhistaatused, teenusekaart, Room access ja billing/authz/privacy tuum jäid põhimõtteliselt eraldi.

## Etapid

| Etapp | Teema | Seis | Peamine tulemus |
|---|---|---|---|
| 1 | Õhuke Journey core | Tehtud | Lisati Journey mudel, owner-põhine ligipääs, `/api/journeys` route'id ja teenusekiht. |
| 2 | Kontrollitud pöörduja algusvoog | Tehtud | `/teekond` võimaldab olukorda kirjeldada, mustandit üle vaadata ja kinnitusega privaatse Journey salvestada. |
| 3 | Salvestatud Teekonna minimaalne kaart | Tehtud | Lisati `/teekond/[id]`, detailvaade, lubatud muutmine ja arhiveerimine. |
| 4 | Teekond → teenusekaart handoff | Tehtud | Detailvaates saab avada olemasoleva teenusekaardi Teekonna kontekstiga. |
| 5 | Teekond → eelpöördumine handoff | Tehtud | Teekond koostab eelpöördumise eeltäite; saatmine jääb kasutaja kinnituse taha. |
| 6 | Teekonna režiim vestluse + menüüst | Tehtud | CLIENT vaates saab kasutaja teadlikult käivitada Teekonna workflow; tavachat ei loo Journey't automaatselt. |
| 7 | Spetsialisti esimene seos | Tehtud | Spetsialist näeb ainult eelpöördumisega saadetud kinnitatud eelinfot, mitte privaatset Journey objekti. |
| 8 | Teenuseosutaja esimene seos | Tehtud | Teenuseosutaja näeb ainult konkreetse teenuse/pöördumisega seotud kinnitatud eelinfot. |
| 9 | Vestlusruumi päritolu/meta | Tehtud | Room sai kirjeldavad origin väljad; origin ei anna lisaligipääsu. |
| 10 | Teenusekatkemise kontroll | Tehtud | Teekonna detailis saab korrastada teenuse jätkumise infot `context.serviceContinuity` alla. |
| 11 | Teenusekaardi accessPath | Tehtud | `ServiceMapEntry.accessPath` võimaldab kuvada teenuseni jõudmise ettevaatlikku selgitust. |
| 12 | Tervisekontakti piiratud kiht | Tehtud | Lisati piiratud tervisekontakti suund ja küsimuste mustand ilma diagnoosi/ravi loogikata. |
| 13 | Stabiliseerimine ja rollitöölauad | Tehtud ettevaatusega | Etapp 9/11 migratsiooniseis joondati; `/teekond` sai CLIENT/SOCIAL_WORKER/SERVICE_PROVIDER rollivaated. |

## Olulised failid

Journey:

- `prisma/schema.prisma`
- `app/api/journeys/route.js`
- `app/api/journeys/[id]/route.js`
- `app/api/journeys/draft/route.js`
- `app/api/journeys/[id]/pre-inquiry-draft/route.js`
- `app/teekond/page.jsx`
- `app/teekond/[id]/page.jsx`
- `components/journey/JourneyDashboard.jsx`
- `components/journey/JourneyDetail.jsx`
- `lib/journey/**`

Seotud kihid:

- `components/workspace/ServiceMapLeaflet.jsx`
- `lib/serviceMap/accessPath.js`
- `lib/preInquiryJourneySharedInfo.js`
- `lib/rooms/origin.js`
- `components/rooms/useRoomMessages.js`
- `lib/workspaceDashboardCards.js`
- `messages/et.json`
- `messages/en.json`
- `messages/ru.json`

Migratsioonid:

- Journey core migratsioon on varasemast Etapp 1 tööst.
- `prisma/migrations/20260526093000_add_room_origin_meta/migration.sql`
- `prisma/migrations/20260526103000_add_service_map_access_path/migration.sql`

## Privaatsuspiirid

- Journey on vaikimisi `PRIVATE`.
- `sharingStatus` MVP-s jagatud olekusse ei lähe.
- SOCIAL_WORKER ja SERVICE_PROVIDER ei saa privaatset Journey objekti lugeda.
- Private chat ei liigu eelpöördumise, teenuseosutaja ega Room vaatesse.
- Room origin/meta on kirjeldav metadata, mitte ligipääsuallikas.
- AccessPath ja tervisekontakt ei sisalda kasutaja privaatset Journey infot.

## Migratsiooniseis

Praegune seis pärast Etapp 13 parandust:

- `npx prisma validate` läbib.
- `npx prisma generate` läbib.
- `npx prisma migrate status` näitab lokaalses dev-DB-s schema up to date.
- `npx prisma migrate dev` näitab endiselt varasema dev-andmebaasi drift'i migratsiooni `20260105120000_add_rooms_invites` ja vanade timestamp/index erinevuste tõttu.

Oluline:

- DB reset'i ei tehtud.
- Production deploy'd ei tehtud.
- Enne production deploy'd tuleb teha staging või puhta DB migratsiooniproov.

## Järgmised soovitatud sammud

1. Teha migratsiooniproov puhtal DB-l või staging DB-l.
2. Käivitada täisrolli QA päris testkontodega: CLIENT, SOCIAL_WORKER, SERVICE_PROVIDER.
3. Kontrollida tavachat/RAG allikate regressiooni eraldi.
4. Kontrollida eelpöördumise, teenuseosutaja ja Room töövood päris testandmetega.
5. Alles pärast seda otsustada production deploy.
