# SotsiaalAI teekonnakeskse mudeli audit — Run 1 koodibaasi kaardistus

## 1. Auditi ulatus

See raport on ainult Run 1 koodibaasi kaardistus.

Eesmärk oli:
- leida olemasolevad failid, moodulid, lehed, API route'id, Prisma mudelid ja töövood, mis seostuvad `docs/uus-plaan.md` punktides 1–21 kirjeldatud teekonnakeskse mudeliga;
- hinnata esmasel tasemel, mis on juba olemas, mis on osaliselt olemas ja mis tundub puuduvat;
- valmistada ette sisend Run 2 peatükipõhiseks süvaauditiks.

Selles etapis:
- rakenduse koodi ei muudetud;
- Prisma skeemi ei muudetud;
- migratsioone ei tehtud;
- pakette ei installitud;
- build/deploy käske ei käivitatud.

Kaardistus tugineb eelkõige aktiivsele koodile, route'idele, komponentidele, Prisma skeemile ja testidele. Vanadele sisemistele arhitektuurikirjeldustele ei toetutud auditi alusena.

## 2. Leitud põhivaldkonnad

Leitud põhivaldkonnad, mis haakuvad dokumendi punktidega 1–21:

- privaatne assistendivestlus ja vestluse töövood;
- töölaud / feature-pinnad;
- eelpöördumised ja eelkaardistus;
- teenusekaart;
- teenuseosutaja profiil ja teeninduskohtade haldus;
- abisoovid, abipakkumised ja matchimine;
- vestlusruumid, liikmed, kutsed ja kõned;
- dokumendihoidla, dokumendi analüüs, artefaktid ja agent-workspace;
- kovisioon;
- privaatsuse eelkontroll, audit ja kustutustöövood;
- RAG, allikate kuvamine ja RAG-admin;
- rollipõhine ligipääs ja paketid/tellimused;
- admini analüütika ja haldusvaated.

## 3. Failide ja moodulite kaart

| Valdkond | Leitud failid/moodulid | Märkus |
|---|---|---|
| Privaatne vestlus | `app/vestlus/page.js`, `components/alalehed/ChatBody.jsx`, `components/ChatSidebar.jsx`, `app/api/chat/route.js`, `app/api/chat/conversations/route.js`, `app/api/chat/conversations/[id]/messages/route.js`, `lib/chat/**` | Vestlus on juba platvormi keskne sisenemispunkt. Teekonnakaardi objekti ei leidnud. |
| Töölaud / feature-pinnad | `components/workspace/WorkspaceFeaturePage.jsx`, `app/eelpoordumised/page.jsx`, `app/teenusekaart/page.jsx`, `app/teenuseprofiil/page.jsx` | Sama shell teenindab mitut funktsiooni. Feature-põhine, mitte journey-põhine. |
| Eelpöördumised | `lib/preInquiries.js`, `lib/preInquiriesQuestionnaire.js`, `lib/preInquiriesAssessment.js`, `app/api/pre-inquiries/route.js`, `app/api/pre-inquiries/[id]/route.js`, `app/api/pre-inquiries/assist/route.js`, `app/api/pre-inquiries/[id]/workflow/route.js` | Tugev olemasolev baas pöördumise ettevalmistuseks ja vastuvõtuks. |
| Eelpöördumisest edasi liikumine | `app/api/pre-inquiries/[id]/room/route.js`, `app/api/pre-inquiries/[id]/covision/route.js` | Olemas sild ruumi ja kovisiooni suunas. |
| Teenusekaart | `app/api/service-map/entries/route.js`, `app/api/service-map/address-suggestions/route.js`, `lib/serviceProviderProfiles.js`, `lib/serviceMap/entryTypes.js`, `lib/serviceMap/entriesQueryPolicy.js`, `components/workspace/ServiceMapLeaflet.jsx` | Teenusekaart on olemas, kuid journey-konteksti välju ei paista. |
| Teenuseosutaja profiil | `app/api/service-provider/profile/route.js`, `lib/serviceProviderProfiles.js`, `app/teenuseprofiil/page.jsx` | Profiil, teenused, piirkonnad, teeninduskohad ja avaldamisloogika on olemas. |
| Abisoovid / abipakkumised | `lib/help/chatWorkflow.js`, `lib/help/requests.js`, `lib/help/offers.js`, `lib/help/matches.js`, `lib/help/listingViews.js`, `app/api/help/listings/route.js`, `app/api/help/listings/[kind]/[id]/route.js`, `app/api/help/matches/route.js` | Olemas eraldi help-workflow, seotud ka chatiga. |
| Vestlusruumid | `app/api/rooms/route.js`, `app/api/rooms/[roomId]/route.js`, `app/api/rooms/[roomId]/messages/route.js`, `app/api/rooms/[roomId]/members/route.js`, `components/rooms/RoomsPage.jsx`, `lib/rooms/access.js`, `lib/roomPath.js` | Koostööruumi alus on olemas. |
| Kutsed ja jagamine | `app/api/invites/route.js`, `app/api/invites/[id]/accept/route.js`, `app/api/invites/[id]/resend/route.js`, `app/api/invites/[id]/revoke/route.js`, `components/invite/InviteModal.jsx` | Kutseloogika on olemas ruumidele, mitte journey jagamisele. |
| Kõned / salvestus / transkriptsioon | `app/api/rooms/[roomId]/calls/**`, `app/api/covision/[id]/calls/**`, `lib/calls/service.js`, `lib/transcription/provider.js`, `app/api/stt/route.js`, `app/api/tts/route.js` | Nõusolekupõhise kõne/transkriptsiooni baas on olemas. |
| Dokumendid | `app/documents/page.js`, `components/documents/DocumentsPage.jsx`, `app/api/documents/route.js`, `app/api/documents/[id]/route.js`, `app/api/documents/[id]/summary/route.js`, `app/api/documents/[id]/transcribe/route.js` | Dokumendihoidla ja analüüsi töövood on olemas. |
| Artefaktid / agent-workspace | `components/agent/AgentModePage.jsx`, `app/api/documents/artifacts/route.js`, `app/api/documents/artifacts/generate/route.js`, `app/api/documents/artifacts/refine/route.js`, `app/api/documents/artifacts/[id]/approve/route.js` | Dokumentidest mustandite loomine ja täiendamine on olemas. |
| Kovisioon | `app/kovisioon/page.jsx`, `components/covision/CovisionPage.jsx`, `lib/covision.js`, `app/api/covision/route.js`, `app/api/covision/[id]/messages/route.js`, `app/api/covision/effective-practices/route.js` | Juhtumipõhine koostöö ja praktika kogumine on olemas. |
| RAG / allikad | `app/api/rag/[...path]/route.js`, `app/api/chat/route.js`, `components/chat/hooks/useConversationSources.js`, `components/chat/utils/sources.js`, `tests/chat/sourceAttribution.test.js`, `tests/rag/**` | Allikate kuvamine ja serveripoolne retrieval/attribution on olemas. |
| RAG-admin | `app/admin/rag/page.jsx`, `app/admin/rag/documents/page.jsx`, `app/admin/rag/ingest/page.jsx`, `app/admin/rag/kov/page.jsx`, `app/admin/rag/source-packages/page.jsx`, `components/admin/rag/**`, `app/api/admin/rag/**`, `lib/admin/rag/**` | Tugev admini kiht teadmuspõhja halduseks. |
| Privaatsus / audit / kustutus | `app/api/privacy/check/route.js`, `lib/privacy/privacyGuard.js`, `lib/privacy/piiFilter.js`, `lib/privacy/audit.js`, `lib/privacy/deletionJobs.js`, `app/api/profile/route.js`, `app/api/internal/retention/cleanup/route.js` | Privaatsuse eelkiht ja auditibaas on olemas. |
| Rollid ja ligipääs | `auth.js`, `lib/authz.js`, `components/auth/useEffectiveRole.js`, `app/api/profile/view-role/route.js`, `lib/adminViewRole.js` | Rolli- ja admin-view loogika on olemas. |
| Paketid / tellimused | `lib/subscriptionPlans.js`, `lib/subscriptionStatus.js`, `app/api/subscription/route.js`, `app/api/subscription/init/route.js`, `app/api/subscription/webhook/route.js`, `app/tellimus/page.js` | Paketipõhine ligipääs on olemas ja mõjutab töövooge. |
| Prisma põhimudelid | `prisma/schema.prisma` mudelid `Conversation`, `ConversationMessage`, `ServiceMapEntry`, `ServiceProviderProfile`, `PreInquiry`, `CovisionCase`, `CovisionJourneyStep`, `CovisionParty`, `HelpRequest`, `HelpOffer`, `HelpMatch`, `Room`, `Invite`, `UserDocument`, `AgentArtifact`, `DataAuditLog` | Lai funktsionaalne baas on olemas, aga `Journey`/`JourneyMap` mudelit ei leidnud. |

## 4. Olemasolevad funktsioonid

Koodibaasis on juba olemas:

- privaatne assistendivestlus sisselogitud kasutajale;
- vestluse conversation-list, history ja room-mode;
- RAG-põhine vastamine koos allikate kuvamisega;
- teenusekaart KOV ja teenuseosutaja kirjete jaoks;
- teenuseosutaja profiili haldus, teenused ja teeninduskohad;
- eelpöördumise loomine, mustandi koostamine ja adressaadi soovitamine;
- juhendatud eelkaardistuse küsimustik eelpöördumise sees;
- privaatsuse kontroll enne jagamist või saatmist;
- eelpöördumise vastuvõtt recipient-owner vaates;
- eelpöördumisest vestlusruumi avamine;
- eelpöördumisest kovisiooni mustandi loomine;
- abisoovide ja abipakkumiste loomine ning matchimine;
- vestlusruumid, kutsed, liikmete ligipääs ja room-chat;
- audio/video kõnede, salvestuse ja transkriptsiooni töövood;
- dokumentide üleslaadimine, hoidla, transkriptsioon, kokkuvõte;
- artefaktide genereerimine, refine, approve ja agent-workspace;
- kovisioon juhtumite, osapoolte, riskitegurite ja teekonna sammudega;
- admini RAG-ingest, source package, KOV ja organisatsioonide haldus;
- rolli- ja paketipõhine ligipääs;
- auditilogid ja retention/kustutuse alusmehhanismid.

## 5. Osaliselt olemasolevad funktsioonid

Osaliselt olemas või teise loogikaga:

- teekonnakeskne algus: olemas vestluse kujul, aga eraldi teekonnakaarti ei ole;
- teekonna sammud: olemas ainult kovisiooni juhtumi sees `CovisionJourneyStep` kujul, mitte üldise kasutajateekonnana;
- osapoolte loogika: olemas kovisioonis `CovisionParty` ja ruumide liikmetes, aga mitte teekonnakaardi keskse objektina;
- vastuvõtt: olemas pre-inquiry recipient-workflow’na, mitte laiemalt journey intake-mudelina;
- eelkaardistus: olemas pre-inquiry questionnaire kujul, mitte eraldiseisva journey-konteksti alusobjektina;
- teenusekaart teekonna sisendiga: tehniline alus teenusekaardiks on olemas, aga journey filter/context objekt puudub;
- “anna endast märku”: sisuliselt lähim analoog on pre-inquiry flow, kuid sama nime ja loogikaga eraldi töövoogu ei leidnud;
- teenusekatkemise risk: dokumendis oluline teema, koodis paistab vaid osaliste vihjete ja sarnaste väljade kaudu, mitte tervikliku workflow’na;
- tervisekontakti loogika: dokument kirjeldab `HEALTH_CONTACT` taset, aga selget rakendusmudelit või route’i selle jaoks ei leidnud;
- jagamise kinnitused: olemas privaatsuse ja nõusoleku mehhanismides, kuid mitte teekonnakaardi jagamise olekuna.

## 6. Puuduvad või leidmata osad

Ei leidnud või tundub puuduvat:

- Prisma mudel `Journey` või `JourneyMap`;
- teekonnakaardi UI;
- teekonnakaardi olekud ja sharing-status;
- teekonnakaardi `summary`, `domains`, `riskSignals`, `missingInfo`, `suggestedActions` keskne andmemudel;
- seos, mis koondaks ühe objekti alla vestluse, teenusekaardi, eelpöördumise, dokumendid ja ruumi;
- eraldi teenusekatkemise kontrolli workflow;
- eraldi “anna endast märku” workflow dokumendi terminoloogias;
- intake-vaade, mis oleks selgelt teekonnakaardist tulnud pöördumise vastuvõtt;
- teenusekaardi kirjeväljad dokumendis kirjeldatud kujul: `accessType`, `firstStep`, `decisionBy`, `sourceStatus` jms vähemalt praeguses skeemis;
- dokumenteeritud või koodis selgelt nähtav `HEALTH_CONTACT` teenusekaardi tüüp;
- teekonnast teenusekaardile, eelpöördumisse või dokumentidesse antav standardiseeritud context payload.

## 7. Esmased tähelepanekud

- Koodibaas ei ole tühi ega MVP-tasemel algus; suur osa dokumendi ümber vajalikest funktsionaalsetest plokkidest on juba olemas.
- Peamine puuduolev kiht ei ole üksik funktsioon, vaid uus keskne objekt, mis seoks olemasolevad tööriistad üheks teekonnaks.
- Praegune arhitektuur on pigem feature-põhine: chat, pre-inquiries, service-map, documents, rooms, covision, help.
- Dokument eeldab journey-first loogikat. Praegune kood toetab pigem chat-first + feature handoff loogikat.
- `PreInquiry` on oluline olemasolev sild kasutaja olukorra ja järgmise sammu vahel, kuid see ei kata kogu teekonnakaardi rolli.
- `CovisionCase` ja selle alamobjektid võivad anda ideid osapoolte, riskide ja sammude modelleerimiseks, kuid neid ei saa automaatselt käsitleda journey-kaardina.
- RAG ja allikate kuvamise kiht on olemas, kuid Run 2-s tuleb hinnata ainult aktiivse koodi põhjal, mitte ajalooliste sisemiste markdown-failide järgi.
- Punkt `14. Teenuseprofiil ja haldus` on dokumendis olemas, kuid markdown-struktuuris mitte samal kujul vormistatud kui ülejäänud nummerdatud pealkirjad; Run 2-s tuleb seda käsitleda eraldi tähelepanuga.

## 8. Run 2 sisendiks olulised failid

Run 2 peaks kindlasti sügavamalt vaatama järgmisi faile ja mooduleid:

- `docs/uus-plaan.md`
- `prisma/schema.prisma`
- `app/vestlus/page.js`
- `components/alalehed/ChatBody.jsx`
- `components/ChatSidebar.jsx`
- `app/api/chat/route.js`
- `app/api/chat/conversations/route.js`
- `components/workspace/WorkspaceFeaturePage.jsx`
- `app/eelpoordumised/page.jsx`
- `lib/preInquiries.js`
- `lib/preInquiriesQuestionnaire.js`
- `lib/preInquiriesAssessment.js`
- `app/api/pre-inquiries/route.js`
- `app/api/pre-inquiries/assist/route.js`
- `app/api/pre-inquiries/[id]/workflow/route.js`
- `app/api/pre-inquiries/[id]/room/route.js`
- `app/api/pre-inquiries/[id]/covision/route.js`
- `app/teenusekaart/page.jsx`
- `app/api/service-map/entries/route.js`
- `lib/serviceProviderProfiles.js`
- `lib/serviceMap/entryTypes.js`
- `lib/serviceMap/entriesQueryPolicy.js`
- `app/teenuseprofiil/page.jsx`
- `app/api/service-provider/profile/route.js`
- `lib/help/chatWorkflow.js`
- `lib/help/requests.js`
- `lib/help/offers.js`
- `lib/help/matches.js`
- `app/api/help/listings/route.js`
- `app/api/help/matches/route.js`
- `app/rooms/page.js`
- `components/rooms/RoomsPage.jsx`
- `app/api/rooms/route.js`
- `lib/rooms/access.js`
- `app/documents/page.js`
- `components/documents/DocumentsPage.jsx`
- `components/agent/AgentModePage.jsx`
- `app/api/documents/route.js`
- `app/api/documents/artifacts/generate/route.js`
- `app/kovisioon/page.jsx`
- `components/covision/CovisionPage.jsx`
- `lib/covision.js`
- `app/api/covision/route.js`
- `app/api/privacy/check/route.js`
- `lib/privacy/privacyGuard.js`
- `lib/privacy/audit.js`
- `lib/authz.js`
- `auth.js`
- `lib/subscriptionPlans.js`
- `app/api/subscription/route.js`
- `app/api/admin/rag/**`
- `app/api/rag/**`
- `lib/chat/**`
- `lib/admin/rag/**`
- `components/admin/rag/**`
- `tests/chat/**`
- `tests/rag/**`

## Kontroll

- Koodifaile ei muudetud.
- Migratsioone ei tehtud.
- Pakette ei installitud.
- Build/deploy käske ei käivitatud.
- Loodi või muudeti ainult auditiraporti Markdown-faili.
