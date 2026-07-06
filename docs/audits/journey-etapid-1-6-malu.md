# Journey MVP etapid 1-6 - mälu

## 1. Eesmärk ja hetkeseis

See fail koondab Journey / Teekond MVP esimese kuue etapi praktilise mälu: mis on juba ehitatud, millised failid on seotud, millised piirid on teadlikult alles jäetud ja millest järgmine arendus peaks lähtuma.

Oluline tootejoon on seni püsinud sama: Teekond on pöörduja-keskne, alguses privaatne ja salvestub püsiva Journey objektina ainult kasutaja kinnitusega. See ei asenda chat/RAG-i, eelpöördumist, teenusekaarti ega ruume, vaid annab nende kohale õhukese olukorra- ja järgmiste sammude kihi.

## 2. Etappide kokkuvõte

| Etapp | Teema | Hetkeseis | Peamised failid |
|---|---|---|---|
| 1 | Õhuke Journey core | Tehtud | `prisma/schema.prisma`, `prisma/migrations/20260526090000_add_journey_core/migration.sql`, `lib/journey/service.js`, `lib/journey/validation.js`, `app/api/journeys/**` |
| 2 | Pöörduja algusvoog | Tehtud | `app/teekond/page.jsx`, `components/journey/JourneyDashboard.jsx`, `lib/journey/draft.js`, `app/api/journeys/draft/route.js` |
| 3 | Salvestatud teekonna minimaalne kaart | Tehtud | `app/teekond/[id]/page.jsx`, `components/journey/JourneyDetail.jsx` |
| 4 | Teekond -> teenusekaart handoff | Tehtud | `lib/journey/serviceMapHandoff.js`, `components/journey/JourneyDetail.jsx`, `components/workspace/WorkspaceFeaturePage.jsx` |
| 5 | Teekond -> eelpöördumine handoff | Tehtud | `lib/journey/preInquiryHandoff.js`, `app/api/journeys/[id]/pre-inquiry-draft/route.js`, `components/workspace/WorkspaceFeaturePage.jsx` |
| 6 | Teekonna režiim vestluse + menüüst | Tehtud | `components/alalehed/ChatBody.jsx`, `components/alalehed/chat/ChatBodyView.jsx`, `components/alalehed/chat/ChatComposer.jsx`, `messages/*.json` |

## 3. Etapp 1 - õhuke Journey core

Lisatud on minimaalne `Journey` andmemudel ja owner-põhine API.

Põhiväljad:

- `ownerUserId`
- `conversationId` optional
- `roleContext`
- `status`
- `sharingStatus`
- `title`
- `summary`
- `primaryPath`
- JSON-väljad: `domains`, `missingInfo`, `riskSignals`, `suggestedActions`, `context`
- `createdAt`
- `updatedAt`

API:

- `GET /api/journeys`
- `POST /api/journeys`
- `GET /api/journeys/[id]`
- `PATCH /api/journeys/[id]`

Ligipääsu põhimõte:

- `ownerUserId` määratakse serveris sessioonist.
- Kasutaja näeb ja muudab ainult enda Journey objekte.
- MVP-s jääb `sharingStatus` privaatseks.
- `conversationId` seostamisel kontrollitakse vestluse omanikku.

## 4. Etapp 2 - kontrollitud pöörduja algusvoog

Lisatud on põhivaade `/teekond`, kus pöörduja saab:

- alustada uut teekonda;
- kirjeldada olukorda;
- koostada ajutise mustandi;
- mustandit enne salvestamist üle vaadata ja muuta;
- salvestada kinnituse järel privaatse Journey objekti.

Oluline piir:

- salvestamata draft ei ole andmebaasi Journey objekt;
- draft tekib eraldi Journey töövoos, mitte tavachat/RAG pipeline'is;
- kasutajale nähtav nimetus on `Teekond`, mitte `Minu teekonnad`.

## 5. Etapp 3 - salvestatud teekonna minimaalne kaart

Lisatud on detailvaade `/teekond/[id]`.

Detailvaade kuvab:

- pealkirja;
- olukorra kokkuvõtet;
- esmast suunda;
- seotud teemasid;
- puuduolevat infot;
- ettevaatlikke tähelepanekuid;
- soovitatud järgmisi samme;
- privaatsusmärget;
- staatust ja viimati muudetud aega.

Kasutaja saab muuta:

- `title`
- `summary`
- `primaryPath`
- `domains`
- `missingInfo`
- `suggestedActions`

Arhiveerimine:

- ei kustuta Journey objekti;
- muudab `status` väärtuseks `ARCHIVED`;
- arhiveeritud teekond on nimekirjas eristatud.

## 6. Etapp 4 - Teekond -> teenusekaart handoff

Teekonna detailvaates on tegevus `Ava teenusekaart`.

Handoff:

- avab olemasoleva teenusekaardi töövoo;
- koostab võimalusel query/filter parameetrid Journey kontekstist;
- kasutab ainult olemasolevaid teenusekaardi filtreid;
- nõrga konteksti korral avab teenusekaardi üldvaates.

Oluline piir:

- teenusekaarti ei ehitatud ümber;
- service map sync/import loogikat ei muudetud;
- `accessPath` mudelit ei lisatud;
- uusi teenusekaardi tüüpe ei lisatud;
- teenusekaardi avamine ei jaga Journey objekti ühegi osapoolega.

## 7. Etapp 5 - Teekond -> eelpöördumine handoff

Teekonna detailvaates on tegevus `Koosta eelpöördumine`.

Handoff:

- avab olemasoleva eelpöördumise vaate `/eelpoordumised?fromJourney=<journeyId>&workspaceRole=CLIENT`;
- admini puhul sunnib `workspaceRole=CLIENT`, et avaneks pöörduja algusvoog;
- kasutab `POST /api/journeys/[id]/pre-inquiry-draft`;
- koostab Journey põhjal eelpöördumise prefill payload'i;
- ei loo PreInquiry objekti;
- ei saada midagi vastuvõtjale;
- ei muuda Journey `sharingStatus` väärtust.

Prefill võib sisaldada:

- teemat;
- olukorra kirjeldust;
- KOV/piirkonda;
- adressaadi tüübi vihjet;
- puuduoleva info märkmeid;
- soovitatud mustandi teksti.

Oluline piir:

- uut eelpöördumise mudelit ei lisatud;
- `PreInquiry.status` enumit ei muudetud;
- vastuvõtja ei näe privaatset teekonda ega privaatset chat'i;
- kasutaja saab kogu eelpöördumise sisu enne saatmist muuta.

Täpsem Etapp 5 ülevaade on failis `docs/audits/journey-etapp-5-eelpoordumine-handoff-ulevaade.md`.

## 8. Etapp 6 - Teekonna režiim vestluse + menüüst

Etapp 6 esialgne plaan rääkis chat'i mitteinvasiivsest soovitusest. Tegelik tooteotsus muutis selle teadlikult valitud töörežiimiks: Teekond ei ilmu tavavestluses passiivse soovitusena, vaid kasutaja peab valima selle vestluse + menüüst.

Lisatud on:

- + menüüsse valik `Teekond`;
- aktiivne `journey` workflow olek vestluses;
- algustekst, mis selgitab Teekonna režiimi ja privaatsust;
- JourneyDraft koostamine kasutaja olukorra kirjelduse põhjal;
- drafti kasutajasõbralik kuvamine vestluses;
- tekstipõhine kinnitamine: `salvesta`, `täpsustan`, `tühista`;
- kinnituse järel `POST /api/journeys`;
- salvestatud teekonna link `/teekond/[id]`.

Rollipiir:

- Teekonna + menüü valik on nähtav ainult `CLIENT` efektiivses rollivaates.
- Admin näeb seda siis, kui admini aktiivne vaateroll on `CLIENT`.
- `SOCIAL_WORKER` ja `SERVICE_PROVIDER` vaates Teekonna pöörduja töövoogu ei kuvata.

Oluline piir:

- tavachat ei loo Journey't automaatselt;
- tavachat ei kuva passiivset Teekonna soovitust;
- tavaline RAG-vastus jääb tavaliseks RAG-vastuseks;
- `app/api/chat/route.js` ja `lib/chat/**` jäid muutmata;
- JourneyDraft ei salvestu automaatselt andmebaasi;
- püsiv Journey tekib ainult kasutaja kinnitusega.

## 9. Peamised seotud failid

| Valdkond | Failid |
|---|---|
| Journey route'id | `app/api/journeys/route.js`, `app/api/journeys/[id]/route.js`, `app/api/journeys/draft/route.js`, `app/api/journeys/[id]/pre-inquiry-draft/route.js` |
| Journey UI | `app/teekond/page.jsx`, `app/teekond/[id]/page.jsx`, `components/journey/JourneyDashboard.jsx`, `components/journey/JourneyDetail.jsx` |
| Journey teenusekiht | `lib/journey/constants.js`, `lib/journey/draft.js`, `lib/journey/preInquiryHandoff.js`, `lib/journey/serializers.js`, `lib/journey/service.js`, `lib/journey/serviceMapHandoff.js`, `lib/journey/validation.js` |
| Chat integratsioon Etapp 6 | `components/alalehed/ChatBody.jsx`, `components/alalehed/chat/ChatBodyView.jsx`, `components/alalehed/chat/ChatComposer.jsx` |
| Töölaud ja info | `lib/workspaceDashboardCards.js`, `lib/dashboardInfoContent.js`, `components/workspace/WorkspaceFeaturePage.jsx` |
| Tõlked | `messages/et.json`, `messages/en.json`, `messages/ru.json` |
| Andmemudel | `prisma/schema.prisma`, `prisma/migrations/20260526090000_add_journey_core/migration.sql` |

## 10. Seni teadlikult puutumata jäetud osad

Ei ole muudetud Journey etappide 1-6 raames:

- chat/RAG tuum;
- `app/api/chat/route.js`;
- `lib/chat/**`;
- RAG retrieval selection;
- source attribution;
- PreInquiry status enum;
- eelpöördumise põhimudel;
- service map sync/import;
- Room mudel ja room access;
- `JourneyParty`;
- `JourneyAction`;
- `Room.journeyId`;
- `PreInquiry.journeyId` püsiseos;
- billing/subscription/authz/privacy tuum.

## 11. Kontrollid, mis viimases etapis läbisid

Etapp 6 järel läbisid:

- `npx eslint components/alalehed/ChatBody.jsx components/alalehed/chat/ChatBodyView.jsx components/alalehed/chat/ChatComposer.jsx components/journey lib/journey app/api/journeys`
- `npx eslint app/api/chat components/alalehed components/chat components/journey lib/journey`
- `npx prisma validate`
- `npx prisma generate`
- `messages/et.json`, `messages/en.json`, `messages/ru.json` JSON parse kontroll

Brauseris kontrolliti:

- CLIENT vaates + menüüs on `Teekond`;
- Teekond käivitab aktiivse workflow;
- olukorra kirjeldus loob drafti;
- draft ei loonud andmebaasi Journey objekti;
- `salvesta` lõi privaatse Journey objekti;
- `Ava teekond` viis `/teekond/[id]` vaatesse;
- tavachat ei loonud uut Journey objekti;
- tavachat ei kuvanud passiivset Teekonna soovitust;
- `SOCIAL_WORKER` ja `SERVICE_PROVIDER` vaates Teekonda + menüüs ei olnud;
- console error'e ega warninguid ei jäänud viimases kontrollis.

## 12. Järgmise etapi lähtekoht

Järgmine loogiline etapp on Etapp 7: spetsialisti esimene seos.

Etapp 7 ei tohiks anda spetsialistile ligipääsu kogu privaatsele Journey objektile. Esmane seos peaks jääma eelpöördumise kaudu kinnitatud eelinfo tasemele:

- pöörduja loob ja kinnitab Journey;
- pöörduja koostab Journey põhjal eelpöördumise;
- spetsialist näeb ainult eelpöördumises kinnitatud ja saadetud sisu;
- privaatne Journey ja privaatne chat jäävad varjatuks.

Enne Etapp 7 arendust vajab lukustamist:

- kas spetsialist näeb ainult prefillitud eelpöördumise sisu või ka eraldi "teekonnast tulnud eelinfo" märget;
- kas Journey ja PreInquiry vahel on vaja hiljem püsivat seost või jääb Etapp 7 ainult olemasoleva eelpöördumise andmete peale;
- kas eelpöördumise vastuvõtja vaates peab eristama kasutaja enda kirjutatud teksti ja Teekonnast eeltäidetud mustandit.

## 13. Avatud riskid ja märkused

- Etapp 6 teekonna vestlussõnumid on töövoo kasutuskogemus, kuid püsivaks objektiks jääb ainult kinnitatud Journey. Vajab tooteotsust, kas tulevikus peab Teekonna töövoo vestlusajalugu eraldi säilima.
- `sharingStatus` on MVP-s privaatne. Jagamise tegelik semantika tuleb lahendada enne, kui spetsialist või teenuseosutaja hakkab Journey-ga seotud infot nägema.
- `JourneyParty` ja `JourneyAction` puudumine on teadlik MVP piir. Neid ei tohiks lisada enne, kui lihtne Journey + eelpöördumise/teenusekaardi handoff on kasutuselt valideeritud.
- Teenusekaardi handoff on kerge eelfilter. See ei tähenda, et süsteem leidis kindlasti õige teenuse.
- Eelpöördumise handoff ei saada midagi automaatselt. Vastuvõtja näeb ainult kasutaja kinnitatud eelpöördumist.
