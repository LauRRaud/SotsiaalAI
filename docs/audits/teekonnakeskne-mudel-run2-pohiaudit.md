# SotsiaalAI teekonnakeskse mudeli audit — Run 2 põhiaudit

## Auditi alus ja piirid

- Audit põhineb failil `docs/uus-plaan.md` ja aktiivsel koodibaasil.
- Audit ei toetu failile `docs/internal/rag-architecture.md`.
- Koodifaile, Prisma skeemi, migratsioone, route'e, komponente ega teenuseid ei muudetud.
- Punkt 20 on kasutatud tervikpildi kontrolliks.
- Punkti 21 ei viidud ellu; seda käsitleti ainult audititava arendusülesandena.

## Punkt 1: Uus keskne mõte

### 1. Sisuline kommentaar

- Punkt on arusaadav ja sisuliselt kooskõlaline.
- See sobib olemasoleva platvormi tugevustega, sest privaatne assistendivestlus on juba olemas.
- Punkti maht on sobiv, kuid enne arendust vajab täpsustamist üks asi: kas "olukorra kaardistamine" on eraldi chat-režiim, eraldi süsteemne väljund või mõlemad.
- Punkti piirid on hästi sõnastatud: ametlik hindamine, otsus ja teenusele suunamine jäävad väljapoole.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `app/vestlus/page.js`
  - `components/alalehed/ChatBody.jsx`
  - `components/ChatSidebar.jsx`
  - `app/api/chat/route.js`
  - `app/api/chat/conversations/route.js`
  - `app/api/chat/conversations/[id]/messages/route.js`
  - `lib/chat/documentOrchestration.js`
  - `lib/help/chatWorkflow.js`
  - `app/api/privacy/check/route.js`
  - `lib/privacy/privacyGuard.js`
- Juba olemas:
  - sisselogitud kasutaja privaatne assistendivestlus;
  - privaatsuse eelkontroll;
  - dokumentide, abisoovi ja muude töövoogude aktiveerimine vestluse ümbert.
- Osaliselt olemas:
  - assistent suudab juba suunata eri töövoogudesse, aga mitte eraldi teekonnakaardi objektina;
  - kriisi- ja ohusuunamise alus on olemas chat safety ja pre-inquiry assessment loogikas.
- Puudub:
  - eraldi "esmane teekonnasõel" väljund;
  - teekonnakaardi loomine vestluse esmasest kirjeldusest;
  - keskne journey-objekt, mis seoks vestluse järgmise sammuga.
- On olemas, aga teise loogikaga:
  - praegune platvorm on endiselt tugevalt funktsioonipõhine; kasutaja saab minna otse lehtedele nagu `eelpoordumised`, `teenusekaart`, `documents`.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Privaatne vestlus kui alguspunkt on olemas, kuid peatüki keskne muutus eeldab teekonnakaarti ja struktureeritud esmast sõela, mida koodis ei ole.

### 4. Muudatuse vajadus

- SUUR ARHITEKTUURILINE MUUDATUS
- Uus keskne mõte eeldab, et olemasolevad funktsioonid allutatakse ühele uuele juhtobjektile, mitte ei jää eraldiseisvateks tööriistadeks.

### 5. Riskid ja tähelepanekud

- Peatükk 1 / `app/vestlus/page.js`, `app/api/chat/route.js`
  - Tõsidus: keskmine
  - Risk: chat on olemas, aga ta ei loo täna püsivat teekonnastruktuuri; see jätab "algus vestlusest -> teekonnakaart" osa katmata.
  - Soovitus: enne arendust fikseerida, kas teekonnakaart luuakse igale uuele chat-threadile või ainult siis, kui kasutaja kinnitab.
- Peatükk 1 / `lib/help/chatWorkflow.js`, `lib/chat/documentOrchestration.js`
  - Tõsidus: keskmine
  - Risk: osa suunamisloogikast on juba eri moodulites hajutatud; uus algusrežiim võib hakata dubleerima olemasolevaid intent-loogikaid.
  - Soovitus: hiljem otsustada, kas esmane teekonnasõel elab chat orchestration kihis või eraldi journey-teenuses.

### 6. Soovitus

- Hiljem muuta:
  - `app/api/chat/route.js`
  - `lib/chat/**`
  - uus journey-teenus ja journey-andmemudel
- Praegu mitte puudutada:
  - olemasolevat privaatse chati põhitöövoogu ja privaatsuse eelkontrolli
- Kindlasti alles jätta:
  - selge piir ametliku hindamise ja AI abi vahel
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas teekonnakaart on automaatselt loodav või kasutaja kinnitusega salvestatav objekt

## Punkt 2: Platvormi uus arhitektuurne mudel

### 1. Sisuline kommentaar

- Punkt on arusaadav ja hästi piiritletud.
- Nelja kihi mudel sobib hästi olemasoleva süsteemi kaardiga.
- Punkt on sobiva mahuga ja ei ole liiga abstraktne.
- Enne arendust vajab täpsustamist ainult see, milline kiht omab "truth source" rolli: kas chat, journey või vastav töövoog.

### 2. Praegune seis koodibaasis

- Seotud failid ja moodulid:
  - privaatne vestlus: `app/vestlus/page.js`, `app/api/chat/**`, `lib/chat/**`
  - nähtavad tööriistad: `app/eelpoordumised/page.jsx`, `app/teenusekaart/page.jsx`, `app/documents/page.js`, `app/kovisioon/page.jsx`
  - töölaud: `components/workspace/WorkspaceFeaturePage.jsx`
  - usaldus- ja kaitsekihid: `lib/privacy/**`, `app/api/privacy/check/route.js`, `lib/authz.js`, `components/chat/hooks/useConversationSources.js`, `lib/chat/sourceAttribution.js`, `lib/rag/sourceFreshness.js`
- Juba olemas:
  - kõik neli kihti eksisteerivad mingil kujul;
  - rolli- ja subscription-gating on olemas;
  - allikate kuvamise tehniline alus on olemas.
- Osaliselt olemas:
  - teekonnakaart kui eraldi teine kiht puudub;
  - olemasolevad tööriistad ei ole journey-kihi kaudu seotud.
- Puudub:
  - uus keskne teekonnakiht.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Platvormis on arhitektuuri kõik toorained olemas, kuid puudu on peatüki keskne siduv kiht.

### 4. Muudatuse vajadus

- SUUR ARHITEKTUURILINE MUUDATUS
- Muutus puudutab süsteemi keskset navigatsiooni- ja andmemudelit, mitte ainult UI ümbertõstmist.

### 5. Riskid ja tähelepanekud

- Peatükk 2 / `components/workspace/WorkspaceFeaturePage.jsx`, feature page'd
  - Tõsidus: keskmine
  - Risk: praegune töölaud on feature-first; journey-first mudel hakkab sellega konkureerima, kui üleminekut ei tehta järk-järgult.
  - Soovitus: hiljem hoida olemasolevad tööriistad alles ja lisada journey kui ülemkiht.
- Peatükk 2 / `lib/authz.js`, `lib/privacy/**`, `lib/chat/**`
  - Tõsidus: madal
  - Risk: usalduskihid on hajutatud eri moodulitesse; journey-kihi lisamine peab need kasutama, mitte kopeerima.
  - Soovitus: hoida privacy/auth/source-attribution läbilõike teenustena, mitte ehitada journey sisse eraldi dubleeritud kontrolli.

### 6. Soovitus

- Hiljem muuta:
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `app/vestlus/page.js`
  - `app/api/chat/**`
  - uus journey-andmemudel ja route'id
- Praegu mitte puudutada:
  - eraldi tööriistade sisemist loogikat
- Kindlasti alles jätta:
  - olemasolevad privacy, authz ja source attribution kihid
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas journey vaade elab chat lehel, töölaul või omaette lehel

## Punkt 3: Teekonnakaart kui platvormi uus kese

### 1. Sisuline kommentaar

- Punkt on selge ja sisuliselt kooskõlaline.
- See on kogu mudeli keskne arhitektuurne pööre.
- Punkt on mahukas, kuid põhjendatult mahukas.
- Enne arendust vajab täpsustamist, milline on teekonnakaardi minimaalne salvestatav väljade komplekt MVP-s.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `lib/covision.js`
  - `app/api/pre-inquiries/**`
  - `app/api/documents/**`
  - `app/api/rooms/**`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Juba olemas:
  - analoogsed töövood teekonna eri osade jaoks: pre-inquiry, documents, rooms, service map.
- Osaliselt olemas:
  - `CovisionJourneyStep` ja `CovisionParty` olemasolevas skeemis, kuid need kuuluvad kovisiooni juhtumi loogikasse, mitte kasutaja üldisesse teekonnakaarti.
- Puudub:
  - `Journey` või `JourneyMap` Prisma mudel;
  - teekonnakaardi UI;
  - teekonnakaardi route'id, teenused, salvestus ja seosed teiste objektidega.
- On osaliselt olemas, aga teise loogikaga:
  - `PreInquiry` on sillakiht jagatava eelinfo jaoks, kuid ei kanna kogu teekonda.

### 3. Vastavus peatükile

- EI OLE VEEL OLEMAS
- Peatüki keskne objekt puudub nii andmemudelis, API-s kui UI-s.

### 4. Muudatuse vajadus

- SUUR ARHITEKTUURILINE MUUDATUS
- Vaja on uut keskset andmeobjekti, mille külge hiljem seotakse teenusekaart, eelpöördumine, dokumendid ja ruumid.

### 5. Riskid ja tähelepanekud

- Peatükk 3 / `prisma/schema.prisma`
  - Tõsidus: kõrge
  - Risk: journey-objekti puudumine tähendab, et peatükis kirjeldatud "uus kese" ei ole tänases arhitektuuris representatiivne.
  - Soovitus: enne arendust lukustada minimaalne journey-skeem ja seoste suund.
- Peatükk 3 / `lib/covision.js`, `CovisionJourneyStep`
  - Tõsidus: keskmine
  - Risk: olemasolev nimetuse sarnasus võib tekitada vale tunde, et journey on juba olemas.
  - Soovitus: käsitleda covision journey step'i eraldi domeeniobjektina, mitte kasutada seda uue üldise teekonnakaardi asendusena.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - uus `lib/journey/**`
  - uued `app/api/journeys/**`
  - chat ja workspace UI
- Praegu mitte puudutada:
  - `CovisionCase`, `CovisionJourneyStep` loogikat
- Kindlasti alles jätta:
  - olemasolevad tööriistad eraldi töövoogudena
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas üks kasutaja võib omada paralleelselt mitut aktiivset teekonda ja kuidas need UI-s kuvatakse

## Punkt 4: Teekonnakaardi olekud

### 1. Sisuline kommentaar

- Punkt on sisuliselt tugev ja vajalik.
- Kolme tasandi eristus - üldolek, osapooled, tegevused - on loogiline.
- Punkt sobib platvormi privaatsusloogikaga hästi.
- Enne arendust vajab täpsustamist, millised olekud on kasutajale nähtavad ja millised jäävad sisemisteks tööolekuteks.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `lib/preInquiries.js`
  - `app/api/pre-inquiries/[id]/accept/route.js`
  - `app/api/pre-inquiries/[id]/workflow/route.js`
  - `app/api/pre-inquiries/[id]/room/route.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `app/api/documents/**`
- Juba olemas:
  - `PreInquiry.status` enum (`DRAFT`, `READY`, `SENT`, `DOWNLOADED`, `ARCHIVED`);
  - teenuseprofiili ja teenusekaardi kirjete olekud;
  - dokumentide ja artefaktide eraldi olekud.
- Osaliselt olemas:
  - vastuvõtja tööolekud on osaliselt olemas receiver workflow plokkides;
  - ruumi olemasolu on tuletatav room-loomise töövoost.
- Puudub:
  - journey üldolek;
  - journey osapoolte olekud;
  - journey tegevussammude olekud.
- On olemas, aga teise loogikaga:
  - praegused olekud on objekti- või töövoopõhised, mitte ühe teekonna ümber koondatud.

### 3. Vastavus peatükile

- EI OLE VEEL OLEMAS
- Peatüki loogika eeldab keskset journey-olekute süsteemi, mida ei ole.

### 4. Muudatuse vajadus

- SUUR ARHITEKTUURILINE MUUDATUS
- Olekumudel tuleb ehitada uue journey-objekti ümber ja sünkroonida olemasolevate töövoogudega.

### 5. Riskid ja tähelepanekud

- Peatükk 4 / `PreInquiry.status`, `Room`, `UserDocument`, `AgentArtifact`
  - Tõsidus: keskmine
  - Risk: teekonna olekud dubleerivad kergesti olemasolevate objektide tööolekuid, kui piire ei lukustata.
  - Soovitus: hoida journey state kasutajateekonna tasemel ja jätta töövoo tehnilised olekud allobjektidele.
- Peatükk 4 / `components/workspace/WorkspaceFeaturePage.jsx`
  - Tõsidus: keskmine
  - Risk: kasutajale nähtavad sõnad nagu "valmis", "saadetud", "avatud" võivad hakata kattuma pre-inquiry ja vastuvõtu olekutega.
  - Soovitus: enne UI arendust lukustada terminid.

### 6. Soovitus

- Hiljem muuta:
  - uus journey state enum ja party/action state mudel
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `app/api/pre-inquiries/**` integratsioon
- Praegu mitte puudutada:
  - olemasolevaid `PreInquiry.status` väärtusi
- Kindlasti alles jätta:
  - kasutaja kinnituse põhimõte enne jagamist
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - milline journey olekute alamhulk on MVP-s piisav

## Punkt 5: Osapoolte loogika teekonnakaardil

### 1. Sisuline kommentaar

- Punkt on arusaadav ja sobib privaatsusloogikaga.
- Peatükk on sisuliselt kooskõlaline, eriti reegel, et osapool ei ole automaatselt kaasatud.
- Maht on sobiv.
- Enne arendust vajab täpsustamist, kas "osapool" on isik, organisatsioon, kontaktikirje või nende ühine ühtlustatud abstraktsioon.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `lib/preInquiries.js`
  - `lib/covision.js`
  - `lib/rooms/access.js`
  - `app/api/invites/**`
  - `app/api/rooms/**`
  - `app/api/help/**`
- Juba olemas:
  - `PreInquiry.recipientType`, `recipientOwnerId`, `recipientEntryId`;
  - `CovisionParty`;
  - `RoomMember`;
  - abisoovi/abipakkumise matchi osapooled.
- Osaliselt olemas:
  - KOV kontakt, teenuseosutaja ja kasutaja osapoole loogika on olemas eri töövoogudes;
  - kutsed ja ruumid võimaldavad osapooli kaasata.
- Puudub:
  - üldine journey-party mudel, mis eristaks `KOV kontakt`, `teenuseosutaja`, `tervisekontakt`, `lähedane`, `esindaja`, `kriisiabi kontakt` ühe keskse objekti all.
- On osaliselt olemas, aga teise loogikaga:
  - tervisekontakti osapoolt ei leidnud esimese klassi objektina;
  - teekonnaga seotud osapoole olek puudub.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Osapooltega seotud ehitusplokid on olemas, kuid mitte peatüki kirjeldatud ühtses ja selgelt tüübitatud mudelis.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Kui journey-objekt tekib, saab osapoolte loogika tõenäoliselt sellele ehitada olemasolevaid `recipient`, `member`, `party` mustreid kasutades.

### 5. Riskid ja tähelepanekud

- Peatükk 5 / `PreInquiry`, `RoomMember`, `CovisionParty`
  - Tõsidus: keskmine
  - Risk: sama osapoole mõiste on täna eri domeenides eri kujul; see teeb journey-party mudeli ühtlustamise keeruliseks.
  - Soovitus: enne arendust otsustada, kas journey-party salvestab ainult viite algobjektile või normaliseerib väljad eraldi.
- Peatükk 5 / `ServiceMapEntryType`
  - Tõsidus: keskmine
  - Risk: tervisekontakti ja KOV teenuse kontakti tüüpe ei ole olemasolevas entry type enumis eraldi.
  - Soovitus: lahendada koos teenusekaardi uue tüübimudeliga.

### 6. Soovitus

- Hiljem muuta:
  - journey-party mudel
  - `lib/preInquiries.js`
  - `app/api/rooms/**`
  - `app/api/invites/**`
- Praegu mitte puudutada:
  - covision ja room member siseobjekte
- Kindlasti alles jätta:
  - põhimõte, et osapool näeb ainult kasutaja kinnitatud infot
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kuidas modelleerida tervisekontakti ja lähedase rolli

## Punkt 6: Teenusekaart uues loogikas

### 1. Sisuline kommentaar

- Punkt on selge ja praktiline.
- Tervisekontaktide piiratud kaasamine on peatüki enda sees kooskõlaline.
- Punkti maht on suur, kuid hästi struktureeritud.
- Enne arendust vajab täpsustamist, kas KOV teenus on eraldi kaartkirje tüüp või jääb see RAG-põhiseks teenuseinfo kihiks KOV kontaktide kõrval.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `app/api/service-map/entries/route.js`
  - `app/api/service-map/address-suggestions/route.js`
  - `components/workspace/ServiceMapLeaflet.jsx`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `lib/serviceMap/entryTypes.js`
  - `lib/serviceMap/ragServiceMapSync.js`
  - `lib/serviceProviderProfiles.js`
  - `app/api/service-provider/profile/route.js`
- Juba olemas:
  - teenusekaart ja kaardikuva;
  - KOV kontaktide ja teenuseosutajate kirjed;
  - teenuseosutaja profiili, teenuste, sihtrühmade, piirkonna ja ligipääsetavuse haldus;
  - `checkedAt` / allikapõhine sünk teenusekaardi kirjetel.
- Osaliselt olemas:
  - KOV kontakti ja teenuseosutaja haru on olemas;
  - teenuseosutaja profiilis on pöördumiste vastuvõtu võimekuse väljad (`acceptsPlatformPreInquiries`, `acceptsEmailPreInquiries`).
- Puudub:
  - `KOV_SERVICE` ja `HEALTH_CONTACT` entry type;
  - teenusekaardi `accessPath` struktuur peatüki kirjeldatud kujul;
  - `sourceStatus` ja `lastChecked` lõppkasutaja teenusekaardi kirje tasemel sellise nimetusega;
  - teekonnakaardilt eelfiltreeritud avamine kui keskne töövoog.
- On osaliselt olemas, aga teise loogikaga:
  - `ServiceMapEntryType` sisaldab praegu `KOV_SOCIAL_CONTACT`, `KOV_GENERAL_CONTACT`, `SERVICE_PROVIDER`;
  - KOV teenused paistavad täna pigem RAG-sisus ja teenuseosutaja profiilides, mitte eraldi teenusekaartkirje tüübina.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Teenusekaardi baas on olemas, kuid peatüki keskne "kontakt + teenus + ligipääsutee + tervisekontakt" andmemudel ei ole veel realiseeritud.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Tugev olemasolev alus vähendab vajadust nullist ümber ehitada, kuid andmemudelit ja filtreerimisloogikat tuleb laiendada.

### 5. Riskid ja tähelepanekud

- Peatükk 6 / `ServiceMapEntryType`, `lib/serviceMap/entryTypes.js`
  - Tõsidus: kõrge
  - Risk: peatükis kirjeldatud põhitüübid ei mahu tänasesse enumisse.
  - Soovitus: enne arendust otsustada, kas lisada uued tüübid skeemi või hoida osa tüüpidest tuletatava vaatena.
- Peatükk 6 / `ServiceMapEntry` mudel
  - Tõsidus: kõrge
  - Risk: puuduvad `accessType`, `firstStep`, `decisionBy`, `sourceStatus` väljad; ilma nendeta jääb "kuidas teenuseni jõuda" struktureerimata.
  - Soovitus: lukustada minimaalne `accessPath` MVP andmemudel.
- Peatükk 6 / `lib/serviceMap/ragServiceMapSync.js`
  - Tõsidus: keskmine
  - Risk: teenusekaardi osa andmeid sünkroniseeritakse RAG dokumendist olemasoleva tüübiskeemi järgi; see võib piirata uute kirjetüüpide lisamist.
  - Soovitus: hinnata hiljem, kas sync peab looma uusi entry tüüpe või ainult rikastama olemasolevaid.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - `lib/serviceMap/entryTypes.js`
  - `lib/serviceMap/ragServiceMapSync.js`
  - `components/workspace/ServiceMapLeaflet.jsx`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Praegu mitte puudutada:
  - teenuseosutaja profiili toimiv avaldamis- ja sünkloogika
- Kindlasti alles jätta:
  - KOV + teenuseosutaja tänane kaart kui baas
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas tervisekontaktid on eraldi `ServiceMapEntry` kirjed või ainult soovituslikud väljundid journey-st

## Punkt 7: Teenuseni jõudmise loogika

### 1. Sisuline kommentaar

- Punkt on sisuliselt tugev ja vajalik.
- See täpsustab hästi, et teenuse kirjeldus ja teenuseni jõudmise tee ei ole sama asi.
- Sobib platvormi loogikaga.
- Enne arendust vajab täpsustamist, kas see loogika peab olema rangelt struktureeritud andmetes või võib osaliselt elada allikapõhises RAG-vastuses.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `lib/preInquiries.js`
  - `lib/serviceProviderProfiles.js`
  - `lib/chat/sourcePackages.js`
  - `lib/chat/sourceAttribution.js`
  - `lib/chat/retrievalContextAssembler.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Juba olemas:
  - teenuseosutaja profiilides teenuse tingimuste ja kontaktikanalite väljad;
  - pre-inquiry drafti tekst eristab KOV pöördumist ja teenuseosutaja tingimuste küsimist;
  - RAG/allikate kiht kannab `source_status`, `last_checked`, allikatüüpi.
- Osaliselt olemas:
  - teenuseni jõudmise info on osa vastustest ja mustanditest, kuid mitte ühtse struktureeritud teenuseobjekti väljana.
- Puudub:
  - ligipääsutüüpide keskne enum teenusekaardi kirjetel;
  - "esimene praktiline samm", "kes otsustab", "mis dokumendid võivad vajalikud olla" kui eraldi väljad.
- On osaliselt olemas, aga teise loogikaga:
  - osa ligipääsuteest on täna genereeritud tekst, mitte mudel.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Loogika on mõnes töövoos juba nähtav, kuid mitte standardiseeritud teenusekaardi andmemudelina.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Vajab teenusekaardi laiendust ja osaliselt RAG väljundi standardiseerimist.

### 5. Riskid ja tähelepanekud

- Peatükk 7 / `ServiceMapEntry` mudel
  - Tõsidus: kõrge
  - Risk: kui teenuseni jõudmise loogika jääb ainult vabateksti või RAG vastuse sisse, ei ole seda võimalik järjepidevalt filtreerida ega UI-s näidata.
  - Soovitus: modelleerida vähemalt `accessType` ja `firstStep`.
- Peatükk 7 / `lib/preInquiries.js`
  - Tõsidus: madal
  - Risk: pre-inquiry draft eristab juba mõningaid harusid; uue struktureeritud loogika lisamisel ei tohi need tekstid hakata vana loogikat dubleerima.
  - Soovitus: hiljem võtta mustanditekstid andmemudelist, mitte hoida kõva haruloogikana.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - `lib/preInquiries.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - teenusekaardi detailvaade
- Praegu mitte puudutada:
  - olemasolevat pre-inquiry drafti toimivat recipient-haruloogikat
- Kindlasti alles jätta:
  - ettevaatlik sõnastus, et AI ei tee teenuseotsust
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kui suur osa teenuseni jõudmise väljadest on kohustuslik igale kirjele

## Punkt 8: Eelpöördumise ja eelkaardistuse uus koht

### 1. Sisuline kommentaar

- Punkt on arusaadav, professionaalselt hästi piiritletud ja sisuliselt kooskõlaline.
- See sobib olemasoleva platvormiloogikaga väga hästi.
- Maht on sobiv.
- Enne arendust vajab täpsustamist ainult terminoloogia: mis jääb "eelpöördumiseks" ja mis "eelkaardistuseks" lõpp-UI-s.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `lib/preInquiries.js`
  - `lib/preInquiriesAssessment.js`
  - `lib/preInquiriesQuestionnaire.js`
  - `app/api/pre-inquiries/route.js`
  - `app/api/pre-inquiries/[id]/route.js`
  - `app/api/pre-inquiries/assist/route.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `app/api/privacy/check/route.js`
- Juba olemas:
  - eraldi pre-inquiry objekt;
  - struktureeritud `assessmentState`;
  - lühemad ja põhjalikumad kaardistusrajad (`QUICK_DESCRIPTION`, `TARGETED_ASSESSMENT`, `COMPREHENSIVE_ASSESSMENT`);
  - privacy-guard enne saatmist;
  - adressaadi valik KOV/teenuseosutaja vahel.
- Osaliselt olemas:
  - peatüki kirjeldatud "esmane teekonnasõel -> teekonnakaart -> eelpöördumine" eelkäik puudub, kuid eelpöördumise enda loogika on olemas.
- Puudub:
  - seos journey-objektiga.
- On osaliselt olemas, aga teise loogikaga:
  - eelkaardistus on täna iseseisev feature-flow, mitte selgelt teekonnakaardi alamvoog.

### 3. Vastavus peatükile

- SUURES OSAS KOOSKÕLAS
- Eelpöördumise ja eelkaardistuse tuum on olemas; puudu on peamiselt uus koht journey-keskse arhitektuuri sees.

### 4. Muudatuse vajadus

- VÄIKE TÄIENDUS
- Olemasolev voog vajab pigem uut konteksti ja terminite korrastamist kui nullist ümberkirjutust.

### 5. Riskid ja tähelepanekud

- Peatükk 8 / `lib/preInquiriesQuestionnaire.js`
  - Tõsidus: madal
  - Risk: tehniline loogika on juba hindamisstruktuurile lähedal; vale UI-keel võiks selle esitada liiga ametliku hindamisena.
  - Soovitus: hoida lõpp-UI-s selge märge "eelinfo, mitte ametlik hindamine".
- Peatükk 8 / `components/workspace/WorkspaceFeaturePage.jsx`
  - Tõsidus: keskmine
  - Risk: kui teekonnakaart lisandub, võib kasutaja jaoks tekkida kaks algust - otse eelpöördumine ja journey kaudu eelpöördumine.
  - Soovitus: hiljem teha eelpöördumine teekonnast avanevaks vaiketeeks, jättes otselingi alles vaid kõrvalteena.

### 6. Soovitus

- Hiljem muuta:
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `lib/preInquiries.js`
  - teekonnakaardi integratsioon
- Praegu mitte puudutada:
  - küsimustiku domeenistruktuuri
- Kindlasti alles jätta:
  - privacy confirmation ja kasutaja kinnituse samm
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas eelpöördumine jääb eraldi navigeeritavaks mooduliks või muutub teekonnast avanevaks vaiketeeks

## Punkt 9: Juhendatud eelkaardistus

### 1. Sisuline kommentaar

- Punkt on arusaadav ja sisuliselt tugev.
- See sobib hästi olemasoleva ruumi- ja kõneloogikaga.
- Punkti maht on sobiv.
- Enne arendust vajab täpsustamist, milline minimaalne kanalivalik peab olema MVP-s: kirjalik ruum, helivestlus, kohtumine või ainult ruum.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `lib/preInquiriesQuestionnaire.js`
  - `lib/preInquiries.js`
  - `app/api/pre-inquiries/[id]/room/route.js`
  - `app/api/pre-inquiries/[id]/workflow/route.js`
  - `app/api/rooms/**`
  - `components/rooms/RoomsPage.jsx`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Juba olemas:
  - lühemad/põhjalikumad eelkaardistusrajad;
  - võimalus luua pre-inquiryst vestlusruum;
  - olemasolev room/call süsteem;
  - kõne ja transkriptsiooni nõusolekuga seotud room-call vood.
- Osaliselt olemas:
  - juhendatud täitmise idee on kaudselt toetatud ruumi ja kõne olemasoluga;
  - vastuvõtja saab teha receiver workflow märkmeid ja jätkusamme.
- Puudub:
  - eraldi "juhendatud eelkaardistuse soov" kui esimese klassi pöördumistüüp;
  - kanalieelistuse (`vestlusruum`, `helivestlus`, `kohtumine`) püsiv väljasalvestus `PreInquiry` mudelis;
  - ühine "koostäidetav eelkaardistus" paneel ruumis.
- On osaliselt olemas, aga teise loogikaga:
  - ruum on olemas üldise koostööruumina, mitte juhendatud eelkaardistuse spetsiaalse tööruumina.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Vajalikud alusmoodulid on olemas, kuid peatükis kirjeldatud workflow ei ole tervikuna eraldi modelleeritud.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Vajab uusi pöördumise tüüpe või eelistusvälju, mitte täiesti uut tehnilist alussüsteemi.

### 5. Riskid ja tähelepanekud

- Peatükk 9 / `PreInquiry` mudel
  - Tõsidus: keskmine
  - Risk: peatükis kirjeldatud eelistatud kanalid ei ole skeemis eraldi väljadena nähtavad.
  - Soovitus: lisada hiljem minimaalsed preference-väljad või hoidla `assessmentState` sees selge struktureeritud haruna.
- Peatükk 9 / `app/api/pre-inquiries/[id]/room/route.js`, `app/api/rooms/**`
  - Tõsidus: madal
  - Risk: room on olemas, aga tema sisuline roll juhendatud eelkaardistuse tööruumina pole süsteemselt eristatav.
  - Soovitus: lisada hiljem ruumi päritolu või eesmärgi metaandmed.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - `lib/preInquiries.js`
  - `app/api/pre-inquiries/**`
  - `app/api/rooms/**`
  - `components/rooms/**`
- Praegu mitte puudutada:
  - olemasolevat room call consent loogikat
- Kindlasti alles jätta:
  - võimalus kasutada olemasolevat ühtset ruumisüsteemi
- MVP või hilisem:
  - MVP, kuid kitsas variandis
- Enne arendust tooteotsus:
  - milline kanalite alamhulk läheb esimesse versiooni

## Punkt 10: Pöördumiste vastuvõtt uues mudelis

### 1. Sisuline kommentaar

- Punkt on arusaadav ja kooskõlaline.
- See sobib hästi olemasoleva pre-inquiry töövoo järgmise kihina.
- Punkt on mahukas, kuid praktiline.
- Enne arendust vajab täpsustamist, kas vastuvõtt jääb `PreInquiry`-põhiseks või tekib eraldi intake-view/mudel.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `lib/preInquiries.js`
  - `lib/preInquiryReceiverWorkflow.js`
  - `app/api/pre-inquiries/[id]/accept/route.js`
  - `app/api/pre-inquiries/[id]/workflow/route.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `app/api/pre-inquiries/[id]/room/route.js`
- Juba olemas:
  - saabunud pre-inquiry avamine vastuvõtja vaates;
  - `receiverNote` ja `receiverChecklist`;
  - vastuvõtmise ja arhiveerimise tegevused;
  - vastuvõtja poolt ruumi avamine.
- Osaliselt olemas:
  - peatükis kirjeldatud töölaud on olemas pre-inquiry töövaatena, kuid mitte nii detailse pöördumistüüpide ja olekute süsteemina;
  - KOV ja teenuseosutaja vastuvõtu haru on olemas recipient type järgi.
- Puudub:
  - eraldi pöördumise tüübi klassifikaator nagu `lühike märguanne`, `juhendatud eelkaardistuse soov`, `teenuse jätkumise pöördumine`;
  - eraldi vastuvõtu olekute mudel peatükis toodud sõnastusega;
  - terviklik intake inbox, mis oleks journey-keskselt struktureeritud.
- On osaliselt olemas, aga teise loogikaga:
  - olemasolev vastuvõtt töötab `PreInquiry.status` ja receiver workflow kaudu, mitte peatüki kirjeldatud uue intake-semantika järgi.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Vastuvõtu baas on olemas, kuid peatükis kirjeldatud struktureeritus ja tüübistus on oluliselt rikkam kui tänane mudel.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Töövoog on olemas, kuid vajab klassifitseerimist, uusi nähtavaid staatuseid ja tihedamat sidet journey-ga.

### 5. Riskid ja tähelepanekud

- Peatükk 10 / `PreInquiry.status`
  - Tõsidus: keskmine
  - Risk: olemasolev status-ekraan ei kata peatüki vastuvõtuolekuid nagu `Saabunud`, `Avatud`, `Lisainfo ootel`, `Vestlusruum pakutud`.
  - Soovitus: otsustada, kas need lisatakse eraldi intake-state väljaga või tuletatakse receiver workflow andmetest.
- Peatükk 10 / `components/workspace/WorkspaceFeaturePage.jsx`
  - Tõsidus: keskmine
  - Risk: praegune vastuvõtuvaade võib muutuda liiga koormatud ühe komponendi sees, kui sinna lisada kõik peatüki tüübid ja tegevused.
  - Soovitus: hiljem eraldada intake-view väiksemateks komponentideks, kuid mitte enne kui mudel on lukus.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - `lib/preInquiries.js`
  - `lib/preInquiryReceiverWorkflow.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Praegu mitte puudutada:
  - toimivat recipient acceptance / room open loogikat
- Kindlasti alles jätta:
  - kasutaja kinnitatud info piir vastuvõtjas
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas intake jääb pre-inquiry alusel või eraldatakse tulevikus omaette objektiks

## Punkt 11: Vestlusruum kui koostööruum

### 1. Sisuline kommentaar

- Punkt on arusaadav ja arhitektuuriliselt tugev.
- "Üks ruumisüsteem, mitu käivitajat" sobib koodibaasiga hästi.
- Punkti maht on sobiv.
- Enne arendust vajab täpsustamist, kas koostööruum ja tänane room jäävad sama nime alla või tehakse ainult sisuline ümberpositsioneerimine.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `app/api/rooms/**`
  - `components/rooms/RoomsPage.jsx`
  - `lib/rooms/access.js`
  - `app/api/invites/**`
  - `app/api/pre-inquiries/[id]/room/route.js`
  - `app/api/help/matches/route.js`
- Juba olemas:
  - üks keskne `Room` süsteem;
  - kutsed;
  - pre-inquiry kaudu ruumi loomine;
  - help match ruumiloogika;
  - kõne, recordingu ja transkriptsiooni nõusolekupõhised vood.
- Osaliselt olemas:
  - eri käivitajad on juba olemas, kuid mitte ühtse päritolu- või ruumitüübi mudelina;
  - room on sisuliselt juba koostööruum, kuid UI-s mitte järjekindlalt nii positsioneeritud.
- Puudub:
  - `roomType`, `sourceId`, `journeyId` või muu päritolumeta `Room` mudelis;
  - juhendatud eelkaardistuse eripaneel ruumis.
- On osaliselt olemas, aga teise loogikaga:
  - pre-inquiry ruumi seos hoitakse täna `description` markerina `preInquiry:<id>`, mitte skeemiväljana.

### 3. Vastavus peatükile

- SUURES OSAS KOOSKÕLAS
- Peatüki põhiidee on tehniliselt juba olemas; puuduvad tüübitud metaandmed ja mõni töövoo-spetsiifiline lisakiht.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Ruumisüsteemi ei ole vaja nullist ümber teha, kuid tal puudub peatüki kirjeldatud semantiline metakiht.

### 5. Riskid ja tähelepanekud

- Peatükk 11 / `app/api/pre-inquiries/[id]/room/route.js`
  - Tõsidus: kõrge
  - Risk: seos pre-inquiry ja roomi vahel on kirjeldustekstis, mitte tugevasti tüübistatud andmemudelis.
  - Soovitus: lisada hiljem `roomOriginType`/`roomOriginId` või sarnane skeemiväli.
- Peatükk 11 / `Room` mudel
  - Tõsidus: keskmine
  - Risk: kui room peab teenima paljusid käivitajaid, muutub hilisem päritolu ja õiguste audit keeruliseks ilma päritoluväljata.
  - Soovitus: lukustada päritolu-meta enne journey integratsiooni.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - `app/api/rooms/**`
  - `app/api/pre-inquiries/[id]/room/route.js`
  - `components/rooms/**`
- Praegu mitte puudutada:
  - room call consent / recording loogikat
- Kindlasti alles jätta:
  - üks ühtne room süsteem
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - millised room origin tüübid on esimeses versioonis vajalikud

## Punkt 12: Teenusekatkemise kontroll

### 1. Sisuline kommentaar

- Punkt on arusaadav ja sisuliselt hästi fokuseeritud.
- See sobib dokumendi ülejäänud loogikaga.
- Maht on sobiv.
- Enne arendust vajab täpsustamist, kas riskitase on kasutajale nähtav või ainult sisemine töövoo atribuut.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `lib/preInquiriesAssessment.js`
  - `lib/preInquiriesQuestionnaire.js`
  - `lib/preInquiries.js`
  - `app/api/documents/**`
  - `lib/chat/**`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Juba olemas:
  - olemas on küsimustik ja assessment loogika, mis suudab märgata kiireloomulisust ja ohusignaale;
  - dokumendianalüüsi tööriistad on olemas;
  - olemas on teenuseosutaja ja KOV kontakti leidmise baas.
- Osaliselt olemas:
  - teenuse katkemise teema on tekstiliselt võimalikud küsimustikus ja chatis;
  - vastuvõtja workflow's on kiireloomulisuse kontrolli checklist.
- Puudub:
  - eraldi teenusekatkemise kontroll kui iseseisev workflow;
  - eraldi riskitasemete mudel;
  - journey-lipp või intake-lipp teenusekatkemise jaoks;
  - teenuse jätkumise eelpöördumise eraldi tüüp andmemudelis.
- On osaliselt olemas, aga teise loogikaga:
  - kriisi- või kiireloomulisuse hindamine on olemas, kuid teenuse jätkuvuse risk kui eraldi nähtus ei ole modelleeritud.

### 3. Vastavus peatükile

- EI OLE VEEL OLEMAS
- Sarnaseid ehitusplokke leidub, aga peatüki kirjeldatud alamvoogu ei leidnud.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Vajalikud komponendid eksisteerivad, kuid neid tuleb siduda uueks eristuvaks workflow'ks.

### 5. Riskid ja tähelepanekud

- Peatükk 12 / `lib/preInquiriesAssessment.js`, `lib/preInquiriesQuestionnaire.js`
  - Tõsidus: keskmine
  - Risk: teenusekatkemise risk võib jääda üldise kiireloomulisuse või probleemikirjelduse sisse peitu.
  - Soovitus: lisada hiljem eraldi continuity signal, mitte käsitleda seda ainult vabateksti märksõnana.
- Peatükk 12 / `app/api/documents/**`
  - Tõsidus: keskmine
  - Risk: dokumendianalüüs suudab toetada lõppkuupäeva ja otsuse lugemist, kuid seost journey-riskiga ei ole.
  - Soovitus: hiljem tuua dokumentidest continuity-relevantne info struktureeritult välja.

### 6. Soovitus

- Hiljem muuta:
  - uus continuity signal / workflow
  - `lib/preInquiriesAssessment.js`
  - `lib/preInquiriesQuestionnaire.js`
  - dokumendianalüüsi väljundid
- Praegu mitte puudutada:
  - olemasolevat kriisi- ja ohusuunamise loogikat
- Kindlasti alles jätta:
  - ettevaatlik sõnastus, et AI ei tee jätkamisotsust
- MVP või hilisem:
  - MVP, aga pärast teekonnakaardi alust
- Enne arendust tooteotsus:
  - kas continuity-risk on kasutajale näidatav tase või ainult spetsialisti töövaate signaal

## Punkt 13: “Anna endast märku” loogika

### 1. Sisuline kommentaar

- Punkt on arusaadav ja kasutajakeskne.
- See on sisuliselt kooskõlaline peatükkidega 1, 8, 9 ja 12.
- Maht on sobiv.
- Enne arendust vajab täpsustamist, kas see on eraldi CTA/entrypoint või lihtsalt privaatse vestluse uus sõnastus.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `app/vestlus/page.js`
  - `app/api/chat/**`
  - `lib/preInquiries.js`
  - `lib/preInquiriesQuestionnaire.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `lib/help/chatWorkflow.js`
- Juba olemas:
  - kasutaja saab alustada privaatse vestlusega;
  - kasutaja saab koostada eelpöördumise;
  - kasutaja saab täita eelkaardistuse;
  - kasutaja saab luua abisoovi.
- Osaliselt olemas:
  - mitmed peatüki väljundid on olemas eri töövoogudena;
  - `concernsAbout` küsimustik toetab, kelle kohta pöördumine käib.
- Puudub:
  - eraldi "Anna endast märku" CTA ja süsteemne workflow-nimi;
  - keskne voog, mis koondaks kirjelduse, kontakti leidmise, eelpöördumise, guided mapping requesti ja abisoovi ühe nime alla.
- On osaliselt olemas, aga teise loogikaga:
  - tänane loogika on pigem "mine õigesse feature'sse", mitte "anna endast märku ja lase süsteemil haru valida".

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Peatüki soovitud väljundid on suuresti olemas, kuid need ei moodusta veel ühtset nähtavat töövoogu.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Pigem ümberpositsioneerimine ja ühtne orkestreerimine kui täiesti uus tehniline moodul.

### 5. Riskid ja tähelepanekud

- Peatükk 13 / `app/vestlus/page.js`, `components/workspace/WorkspaceFeaturePage.jsx`
  - Tõsidus: keskmine
  - Risk: kui "Anna endast märku" lisada lihtsalt uue nupuna, ilma teekonnakihi ja suunamiseta, jääb see dubleerima olemasolevaid feature-sisendeid.
  - Soovitus: siduda see hiljem journey algusega, mitte teha uut eraldiseisvat vormi.
- Peatükk 13 / `lib/preInquiriesQuestionnaire.js`
  - Tõsidus: madal
  - Risk: küsimustik toetab juba "kelle kohta", kuid mitte kogu peatüki narratiivi.
  - Soovitus: kasutada olemasolevat `concernsAbout` struktuuri ühe building block'ina, mitte ehitada seda uuesti.

### 6. Soovitus

- Hiljem muuta:
  - chat algus-UI
  - journey start voog
  - eelpöördumise avamise sisendid
- Praegu mitte puudutada:
  - olemasolevat pre-inquiry küsimustiku domeenistruktuuri
- Kindlasti alles jätta:
  - kasutaja kontroll enne jagamist
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas "Anna endast märku" asendab avalehe peamise CTA või on ainult üks käivitaja teiste seas

## Punkt 14: Teenuseprofiil ja haldus

### 1. Sisuline kommentaar

- Punkt on arusaadav ja lühike.
- See sobib hästi platvormi olemasoleva teenuseosutaja haruga.
- Punkt on pigem kitsas ja hästi piiritletud.
- Enne arendust vajab täpsustamist ainult see, kui palju ligipääsutingimuste infot peab teenuseosutaja ise haldama.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `prisma/schema.prisma`
  - `app/api/service-provider/profile/route.js`
  - `lib/serviceProviderProfiles.js`
  - `app/teenuseprofiil/page.jsx`
  - `components/workspace/WorkspaceFeaturePage.jsx`
- Juba olemas:
  - organisatsiooni profiil;
  - teenused;
  - sihtrühmad;
  - teeninduspiirkond;
  - teeninduskohad;
  - ligipääsetavus;
  - kaardi nähtavus;
  - eelpöördumiste vastuvõtu valikud;
  - avaldamisolekud.
- Osaliselt olemas:
  - teenusele jõudmise tingimuste haldus on kaudselt võimalik kirjelduse kaudu, kuid mitte peatüki ja punktide 6-7 nõutud struktureeritud kujul.
- Puudub:
  - peatüki ülejäänud mudeliga seotud struktureeritud `vajab suunamist / vajab KOV otsust / saab küsida tingimusi` väljad teenuse tasemel.
- On osaliselt olemas, aga teise loogikaga:
  - teenuseprofiil on olemas iseseisva funktsioonina, mitte veel journey- ja access-path keskse mudeli osana.

### 3. Vastavus peatükile

- SUURES OSAS KOOSKÕLAS
- Peatüki tuum on juba valmis; puudu on peamiselt sidumine uue teekonna- ja teenuseni jõudmise loogikaga.

### 4. Muudatuse vajadus

- VÄIKE TÄIENDUS
- Teenuseprofiili tuuma ei ole vaja ümber ehitada.

### 5. Riskid ja tähelepanekud

- Peatükk 14 / `ServiceProviderProfile`, `ServiceProviderService`
  - Tõsidus: madal
  - Risk: peatükis eeldatud teenuse tingimuste info võib jääda vabakirjelduse sisse, kui struktureeritud välju ei lisata.
  - Soovitus: lisada hiljem minimaalsed access-path väljad teenuse tasemele, mitte kogu profiili ümber kirjutada.

### 6. Soovitus

- Hiljem muuta:
  - `prisma/schema.prisma`
  - `lib/serviceProviderProfiles.js`
  - `app/api/service-provider/profile/route.js`
- Praegu mitte puudutada:
  - teenuseprofiili publitseerimise ja mapVisible loogikat
- Kindlasti alles jätta:
  - `acceptsPlatformPreInquiries`, `acceptsEmailPreInquiries`, teeninduskohad ja ligipääsetavus
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kui detailseks teenuseosutaja peab ise ligipääsutingimused sisestama

## Punkt 15: Allikate kuvamise uus väärtus

### 1. Sisuline kommentaar

- Punkt on arusaadav, sisuliselt väga tugev ja kooskõlaline.
- See sobib platvormi tänase RAG-suuna ja usalduskihiga väga hästi.
- Maht on suur, kuid õigustatud.
- Enne arendust vajab täpsustamist vaid see, milline info kuvatakse pöördujale vaikimisi ja milline jääb spetsialisti detailvaatesse.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `components/chat/hooks/useConversationSources.js`
  - `components/chat/utils/sources.js`
  - `lib/chat/responseFinalizer.js`
  - `lib/chat/retrievalContextAssembler.js`
  - `lib/chat/sourceAttribution.js`
  - `lib/chat/sourcePackages.js`
  - `lib/rag/sourceMetadata.js`
  - `lib/rag/sourceFreshness.js`
  - `app/api/chat/run/route.js`
  - `app/api/chat/conversations/[id]/messages/route.js`
  - `app/api/admin/analytics/summary/route.js`
  - testid `tests/chat/**`, `tests/rag/**`
- Juba olemas:
  - `displayed_sources` eristatud leitud/kasutatud allikatest;
  - `source_status`, `last_checked`, `sourceType` metadata;
  - answer/display layeri eristus;
  - testidega kaetud displayed-sources poliitika;
  - source freshness ja risk policy moodulid.
- Osaliselt olemas:
  - tehniline vundament toetab peatükki tugevalt;
  - kasutajale nähtava UI detailsus sõltub sellest, kui palju allikavaates täna päriselt renderdatakse.
- Puudub:
  - ei leidnud terviklikku journey- või teenusekaardiga seotud allikapaneeli, mis näitaks süsteemselt "mida see allikas vastuses toetas" kõigis pindades;
  - ei leidnud kindlat tõendit, et kõik peatüki kirjeldatud display-group'id on UI-s valmis kujul olemas.
- On osaliselt olemas, aga teise loogikaga:
  - tugev tehniline allikakiht on olemas pigem chat/RAG tasemel kui kogu platvormi läbiva ühtse paneelina.

### 3. Vastavus peatükile

- SUURES OSAS KOOSKÕLAS
- Eriti tugev on tehniline vastavus; võimalik vahe jääb peamiselt lõpp-UI detailsuse ja eri pindade ühtlustuse tasemele.

### 4. Muudatuse vajadus

- VÄIKE TÄIENDUS
- RAG ja attribution kihti ei ole vaja ümber ehitada; vaja on peamiselt UI ja platvormiülest rakendust.

### 5. Riskid ja tähelepanekud

- Peatükk 15 / `lib/chat/responseFinalizer.js`, `lib/chat/sourceAttribution.js`
  - Tõsidus: madal
  - Risk: tehniline mudel on detailne, kuid kui eri vaated ei kasuta sama paneeliloogikat, võib kasutajakogemus jääda ebaühtlaseks.
  - Soovitus: hiljem ehitada ühine allikapaneeli komponent.
- Peatükk 15 / `components/chat/hooks/useConversationSources.js`, `components/chat/utils/sources.js`
  - Tõsidus: madal
  - Risk: peatükis nõutud rollipõhine lihtsustatud vs detailne allikavaade vajab UI tasandil eraldi otsust.
  - Soovitus: hoida metadata mudel samana ja teha rollipõhine renderdus komponentides.

### 6. Soovitus

- Hiljem muuta:
  - chat/source UI komponendid
  - teenusekaardi ja dokumendivaate allikapaneelid
- Praegu mitte puudutada:
  - `displayed_sources` ja source metadata tehnilist tuuma
- Kindlasti alles jätta:
  - answer sources vs displayed sources eristus
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - milline allikadetail on pöörduja vaikimisi vaates vajalik

## Punkt 16: Rollipõhine uus kogemus

### 1. Sisuline kommentaar

- Punkt on arusaadav ja kooskõlaline.
- See sobib platvormi senise rolliloogikaga, kuid nõuab UI ümberkujundamist.
- Maht on suur, kuid põhjendatud.
- Enne arendust vajab täpsustamist, kui palju rolle jääb esimesse teekonnakesksesse versiooni esiplaanile.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `lib/authz.js`
  - `auth.js`
  - `components/auth/useEffectiveRole.js`
  - `components/workspace/WorkspaceRoleCycleButton.jsx`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `app/kovisioon/page.jsx`
  - `app/documents/page.js`
  - `lib/subscriptionPlans.js`
- Juba olemas:
  - rollid `CLIENT`, `SOCIAL_WORKER`, `SERVICE_PROVIDER`;
  - admin view role;
  - role-based access ja subscription gating;
  - eri rollidele nähtavad pinnad ja tööriistad.
- Osaliselt olemas:
  - rollikogemus on olemas, kuid see on feature-first, mitte journey-first;
  - teenuseosutaja ja spetsialisti vaates on eraldi mooduleid, kuid teekonnakaart puudub nende ühise sissepääsuna.
- Puudub:
  - rollipõhine teekonnakaardi vaade;
  - rollipõhine journey töölaud.
- On osaliselt olemas, aga teise loogikaga:
  - admini role cycling ja feature visibility ei ole sama, mis peatükis kirjeldatud rolli vastutusest lähtuv teekonnakogemus.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Rollide alus on tugev, kuid peatüki tuum eeldab uut teekonnakeskset UI-d.

### 4. Muudatuse vajadus

- KESKMINE MUUDATUS
- Access control on olemas; peamine töö on kogemuse ja navigeerimise ümberkujundamine.

### 5. Riskid ja tähelepanekud

- Peatükk 16 / `components/workspace/WorkspaceFeaturePage.jsx`
  - Tõsidus: keskmine
  - Risk: üks suur feature-page komponent võib raskendada selge rollipõhise journey-kogemuse kujundamist.
  - Soovitus: hiljem lahutada vähemalt journey-home ja feature-detail pinnad.
- Peatükk 16 / `lib/authz.js`, `useEffectiveRole.js`
  - Tõsidus: madal
  - Risk: rolliõigused ise ei ole peamine probleem; risk on UI-s, kus sama õigust saab esitada vales järjekorras.
  - Soovitus: hoida authz puutumata ja muuta ainult kogemuse ülesehitust.

### 6. Soovitus

- Hiljem muuta:
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - journey home / dashboard
  - seotud navigeerimiskomponendid
- Praegu mitte puudutada:
  - `lib/authz.js` ja olemasolevat subscription-check loogikat
- Kindlasti alles jätta:
  - role normalization ja effective role süsteem
- MVP või hilisem:
  - MVP
- Enne arendust tooteotsus:
  - kas spetsialist ja teenuseosutaja saavad eraldi teekonnavaate või jagavad sama raamiga eri mooduleid

## Punkt 17: Pakettide tabeli mõju

### 1. Sisuline kommentaar

- Punkt on arusaadav.
- See on sisuliselt kooskõlaline ülejäänud mudeliga.
- Punkt on pigem toote- ja pakendamisotsuse peatükk kui tehniline arhitektuuripeatükk.
- Enne arendust vajab täpsustamist, millised uued journey-funktsioonid jäävad tasuta, millised nõuavad tellimust.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `lib/subscriptionPlans.js`
  - `lib/subscriptionStatus.js`
  - `lib/authz.js`
  - `app/api/subscription/**`
  - `app/tellimus/page.js`
  - `app/documents/page.js`
  - `app/kovisioon/page.jsx`
- Juba olemas:
  - rollipõhised paketid ja subscription vood;
  - moodulite gating tellimuse alusel.
- Osaliselt olemas:
  - olemasolevad paketid ei ole veel kirjeldatud teekonnakeskse funktsioonimaatriksi järgi;
  - mõned spetsialisti moodulid on juba gated, kuid journey-funktsioone pole olemas.
- Puudub:
  - journey, guided mapping, continuity control ja uue intake loogika pakettidesse paigutus.
- On osaliselt olemas, aga teise loogikaga:
  - olemasolev tabeliloogika on rohkem rolli- kui teekonnafunktsiooni-põhine.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Subscription infrastruktuur on olemas, kuid uut funktsioonikaarti selle peale veel ei ole.

### 4. Muudatuse vajadus

- VÄIKE TÄIENDUS
- Tehniline alus on olemas; muutus on pigem feature mapping ja UI sõnastuse tasemel.

### 5. Riskid ja tähelepanekud

- Peatükk 17 / `lib/subscriptionPlans.js`, `lib/authz.js`
  - Tõsidus: keskmine
  - Risk: kui uusi journey funktsioone ei seota varakult pakettidega, võib hiljem tekkida ebaühtlane gating.
  - Soovitus: kui MVP scope lukustub, teha kohe funktsioonide ja pakettide kaart.
- Peatükk 17 / `app/tellimus/page.js`
  - Tõsidus: madal
  - Risk: turundus- või tellimuslehe sõnastus jääb feature-first, kuigi tootelogi muutub journey-first.
  - Soovitus: uuendada pakettide esitlust alles siis, kui journey-MVP on lukus.

### 6. Soovitus

- Hiljem muuta:
  - `lib/subscriptionPlans.js`
  - tellimuse UI
  - feature gating map
- Praegu mitte puudutada:
  - olemasolevat aktiivse tellimuse kontrolli
- Kindlasti alles jätta:
  - role-based subscription skeleton
- MVP või hilisem:
  - Hilisem etapp pärast journey-MVP lukustumist
- Enne arendust tooteotsus:
  - uute teekonnafunktsioonide paketipaigutus

## Punkt 18: Arendusjärjekord

### 1. Sisuline kommentaar

- Punkt on arusaadav ja praktiline.
- See on kooskõlas koodibaasi tegeliku olukorraga: palju alusmooduleid on juba olemas.
- Punkti maht on sobiv.
- Peatükk ei vaja sisulist täpsustamist, kuid tehnilise tööjaotuse detailid tulevad ikkagi lukustada enne realiseerimist.

### 2. Praegune seis koodibaasis

- Seotud failid ja moodulid:
  - chat: `app/api/chat/**`, `lib/chat/**`
  - service map: `app/api/service-map/**`, `lib/serviceMap/**`
  - pre-inquiry: `app/api/pre-inquiries/**`, `lib/preInquiries*.js`
  - rooms: `app/api/rooms/**`, `app/api/invites/**`
  - documents: `app/api/documents/**`, `components/agent/AgentModePage.jsx`
  - auth/subscription/privacy/source layers: `lib/authz.js`, `lib/privacy/**`, `lib/chat/sourceAttribution.js`, `lib/rag/**`
- Juba olemas:
  - peatükis nimetatud alusmoodulid tõesti eksisteerivad.
- Osaliselt olemas:
  - journey alusmudel puudub, ülejäänud plokid on olemas.
- Puudub:
  - punktis soovitatud esimene tööpakett ehk journey-andmemudel.

### 3. Vastavus peatükile

- SUURES OSAS KOOSKÕLAS
- Põhjendus: arendusjärjekord sobib olemasoleva koodibaasi ehitusloogikaga ja ei eelda nullist alustamist.

### 4. Muudatuse vajadus

- EI VAJA MUUTMIST
- Peatüki jada on koodibaasi järgi mõistlik.

### 5. Riskid ja tähelepanekud

- Peatükk 18 / kogu koodibaasi struktuur
  - Tõsidus: madal
  - Risk: kui järjestust ei järgita ja journey jäetakse hilisemaks, süveneb olemasolevate feature-voogude hajusus.
  - Soovitus: alustada tõesti journey andmemudelist ja chat integratsioonist.

### 6. Soovitus

- Hiljem muuta:
  - alustada journey-andmemudelist
- Praegu mitte puudutada:
  - mitteseotud feature-refaktoreid
- Kindlasti alles jätta:
  - järkjärguline lähenemine olemasolevate funktsioonide peale
- MVP või hilisem:
  - MVP planeerimise aluseks
- Enne arendust tooteotsus:
  - kinnitada tööpakettide piirid

## Punkt 19: Kõige lühem uus visioon

### 1. Sisuline kommentaar

- Punkt on arusaadav ja kooskõlaline.
- See sobib olemasoleva platvormi suunaga, kui journey objekt lisandub.
- Maht on sobiv.
- Enne arendust vajab täpsustamist ainult see, milline avalehe sõnastus jääb esimese MVP ajal kasutusse.

### 2. Praegune seis koodibaasis

- Seotud failid:
  - `app/vestlus/page.js`
  - `components/workspace/WorkspaceFeaturePage.jsx`
  - `lib/dashboardInfoContent.js`
  - olemasolevad feature-lehed
- Juba olemas:
  - visioonis nimetatud funktsioonid on suuresti olemas eraldi moodulitena.
- Osaliselt olemas:
  - privaatne vestlus, teenusekaart, eelpöördumine, dokumendid, ruumid ja abisoov on olemas;
  - puudub teekonnakaart, mis teeks visiooni sõna-sõnalt tõeks.
- Puudub:
  - visiooni keskne journey-kiht.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Visioon kirjeldab suunda, mille poole olemasolev süsteem saab areneda, aga keskne uus objekt puudub.

### 4. Muudatuse vajadus

- EI VAJA MUUTMIST
- Visioon ise on koodibaasi suhtes mõistlik.

### 5. Riskid ja tähelepanekud

- Peatükk 19 / töölaud ja feature-lehed
  - Tõsidus: madal
  - Risk: kui visiooni kommunikeeritakse enne journey-MVP valmimist, tekib lõhe lubaduse ja tegeliku feature-first kogemuse vahel.
  - Soovitus: avalik sõnastus sünkida realease-scope'iga.

### 6. Soovitus

- Hiljem muuta:
  - avalehe ja töölaudade sõnastus
- Praegu mitte puudutada:
  - toimivat olemasolevat feature-nav'i enne kui journey-home on valmis
- Kindlasti alles jätta:
  - piiritekst ametliku hindamise ja otsuse osas
- MVP või hilisem:
  - MVP kommunikatsiooni osa pärast tehnilise aluse valmimist
- Enne arendust tooteotsus:
  - millal uue visiooni sõnastus avalikult kasutusele võtta

## Punkt 20: Kogu mudeli lõplik koond

### 1. Sisuline kommentaar

- Punkt on arusaadav ja töötab hästi tervikpildi peatükina.
- See on sisuliselt kooskõlaline varasemate punktidega.
- Maht on sobiv, sest see ei too uut tuuma, vaid seob kogu mudeli kokku.
- Enne arendust täpsustust ei vaja; see on pigem kontrollpeegel ülejäänud dokumentidele.

### 2. Praegune seis koodibaasis

- Seotud failid ja moodulid:
  - chat: `app/api/chat/**`, `lib/chat/**`
  - journey analoogid: `PreInquiry`, `CovisionJourneyStep`
  - service map: `app/api/service-map/**`, `lib/serviceMap/**`
  - docs: `app/api/documents/**`, `components/documents/**`, `components/agent/**`
  - rooms: `app/api/rooms/**`, `app/api/invites/**`
  - help: `app/api/help/**`, `lib/help/**`
  - service provider: `app/api/service-provider/profile/route.js`, `lib/serviceProviderProfiles.js`
  - privacy/auth/sources: `lib/privacy/**`, `lib/authz.js`, `lib/chat/sourceAttribution.js`, `lib/rag/**`
- Juba olemas:
  - peaaegu kõik koondis loetletud alamsüsteemid on olemas.
- Osaliselt olemas:
  - keskne sidumine teekonnakaardi kaudu puudub.
- Puudub:
  - journey kui platvormi uus kese.

### 3. Vastavus peatükile

- OSALISELT KOOSKÕLAS
- Koond kirjeldab hästi seda, milleks olemasolevad moodulid sobivad, kuid tervik ei ole veel journey-keskne.

### 4. Muudatuse vajadus

- SUUR ARHITEKTUURILINE MUUDATUS
- Just koond näitab selgelt, et puudu on keskne ühendav objekt ja selle ümber ehitatud kogemus.

### 5. Riskid ja tähelepanekud

- Peatükk 20 / kogu koodibaas
  - Tõsidus: kõrge
  - Risk: kõik vajalikud feature'd on olemas, aga ilma journey objektita jääb tervik endiselt "tööriistade kogumikuks".
  - Soovitus: kasutada punkti 20 kontrollnimekirjana alles pärast punktide 1-17 tehnilise aluse teket.

### 6. Soovitus

- Hiljem muuta:
  - kogu koondis journey-seotud ühenduskohad
- Praegu mitte puudutada:
  - hästi töötavaid üksikfeature'e
- Kindlasti alles jätta:
  - olemasolevad moodulid, mida saab siduda, mitte asendada
- MVP või hilisem:
  - Punkt 20 ise ei ole eraldi MVP work item, vaid tervikhinnangu alus
- Enne arendust tooteotsus:
  - ei vaja eraldi tooteotsust peale journey scope lukustamise

## Punkt 21: Codexile antav arendusülesanne

### 1. Sisuline kommentaar

- Punkt on arusaadav ja tööpakettideks jagatud.
- See on sisuliselt kooskõlaline punktidega 1-20.
- Punkt on sobiva mahuga arenduse lähteülesandena.
- Enne arendust vajab täpsustamist ainult see, millised tööpaketid kuuluvad esimesse tehnilisse MVP-sse ja millised hiljemasse faasi.

### 2. Praegune seis koodibaasis

- Seotud failid ja moodulid:
  - puudutab laia lõiget kogu koodibaasist:
    - `prisma/schema.prisma`
    - `app/api/chat/**`
    - `app/api/service-map/**`
    - `app/api/pre-inquiries/**`
    - `app/api/rooms/**`
    - `components/workspace/**`
    - `lib/chat/**`
    - `lib/preInquiries*.js`
    - `lib/serviceMap/**`
- Juba olemas:
  - tööpakettides viidatud sihtmoodulite tehniline alus on suuresti olemas.
- Osaliselt olemas:
  - punktis nimetatud etapid 4-10 saavad toetuda olemasolevatele feature'itele.
- Puudub:
  - esimene ja teine tööpakett peatüki enda mõttes: journey-andmemudel ja esmane teekonnasõel.
- On osaliselt olemas, aga teise loogikaga:
  - mõned etapilised tulemused on olemas feature-first kujul, mitte journey-first kujul.

### 3. Vastavus peatükile

- SUURES OSAS KOOSKÕLAS
- Tööpakettide jada on koodibaasi suhtes usutav ja rakendatav, kuid neid ei ole veel ellu viidud.

### 4. Muudatuse vajadus

- EI VAJA MUUTMIST
- Arendusülesande ülesehitus ise on mõistlik; muutma peaks hiljem ainult scope'i, kui MVP kitseneb.

### 5. Riskid ja tähelepanekud

- Peatükk 21 / `prisma/schema.prisma`, `app/api/chat/**`, `components/workspace/**`
  - Tõsidus: keskmine
  - Risk: kui tööpakett 1 ja 2 jäetakse poolikuks, hakkavad järgmised paketid toetuma ebastabiilsele journey mudelile.
  - Soovitus: hoida tööpakettide järjekord vähemalt esimese kolme sammu osas jäik.
- Peatükk 21 / kogu koodibaas
  - Tõsidus: madal
  - Risk: tööpakettide ulatus on lai; ilma eraldi MVP lõiketa võib esimene arendusvoor paisuda.
  - Soovitus: alustada ainult `Journey` + chat sõel + minimaalne journey UI + service map/pre-inquiry avamine teekonnast.

### 6. Soovitus

- Hiljem muuta:
  - tööpakettide detailid alles siis, kui tehniline MVP scope on lukus
- Praegu mitte puudutada:
  - olemasolevaid feature'e ainult refaktori pärast
- Kindlasti alles jätta:
  - järjekord: journey mudel -> chat sõel -> journey UI -> feature integratsioon
- MVP või hilisem:
  - peatükk 21 on MVP arenduse lähtealus
- Enne arendust tooteotsus:
  - kinnitada esimese arendusploki täpne scope

## Koondtabel

| Punkt | Teema | Praegune seis | Vastavus peatükile | Muudatuse vajadus | Peamine tähelepanek | Soovitatud järgmine samm |
|---|---|---|---|---|---|---|
| 1 | Uus keskne mõte | Privaatne chat olemas, journey puudub | OSALISELT KOOSKÕLAS | SUUR ARHITEKTUURILINE MUUDATUS | Alguspunkt on olemas, uus juhtobjekt puudub | Lukustada chat -> journey algusvoog |
| 2 | Uus arhitektuurne mudel | Kõik kihid peale journey eksisteerivad | OSALISELT KOOSKÕLAS | SUUR ARHITEKTUURILINE MUUDATUS | Siduv teine kiht puudub | Lisada journey arhitektuuri keskmesse |
| 3 | Teekonnakaart | Tundub puuduvat | EI OLE VEEL OLEMAS | SUUR ARHITEKTUURILINE MUUDATUS | Puudub `Journey` mudel, API ja UI | Luua minimaalne journey andmemudel |
| 4 | Teekonnakaardi olekud | Olekud on hajutatult eri objektides | EI OLE VEEL OLEMAS | SUUR ARHITEKTUURILINE MUUDATUS | Ühtne state süsteem puudub | Lukustada journey state mudel |
| 5 | Osapoolte loogika | Osapoolte ehitusplokid on eri domeenides olemas | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Üldine journey-party mudel puudub | Ühtlustada osapoole abstraktsioon |
| 6 | Teenusekaart uues loogikas | Tugev baas olemas | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Puuduvad `KOV_SERVICE`, `HEALTH_CONTACT`, `accessPath` | Laiendada teenusekaardi mudelit |
| 7 | Teenuseni jõudmise loogika | Osaliselt tekstiloogikana olemas | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Ligipääsutee pole struktureeritud | Lisada `accessType` ja esimese sammu väljad |
| 8 | Eelpöördumise uus koht | Tugev olemasolev voog | SUURES OSAS KOOSKÕLAS | VÄIKE TÄIENDUS | Puudub seos journey kihiga | Siduda pre-inquiry teekonnaga |
| 9 | Juhendatud eelkaardistus | Alusmoodulid olemas, eraldi workflow puudub | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Kanalieelistused ja guided type puuduvad | Lisada minimaalne guided mapping mudel |
| 10 | Pöördumiste vastuvõtt | Vastuvõtu baas olemas | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Intake semantika on tänasest rikkam | Tüüpida saabunud pöördumised selgemalt |
| 11 | Vestlusruum kui koostööruum | Room süsteem tugev | SUURES OSAS KOOSKÕLAS | KESKMINE MUUDATUS | Puudub tüübitud päritolumeta | Lisada room origin metaandmed |
| 12 | Teenusekatkemise kontroll | Tundub puuduvat eraldi workflow'na | EI OLE VEEL OLEMAS | KESKMINE MUUDATUS | Continuity risk pole modelleeritud | Luua continuity signal ja väljundid |
| 13 | Anna endast märku | Harud olemas eri feature'tena | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Ühtne entrypoint puudub | Siduda CTA journey algusega |
| 14 | Teenuseprofiil ja haldus | Tugevalt olemas | SUURES OSAS KOOSKÕLAS | VÄIKE TÄIENDUS | Ligipääsutingimused vajavad struktureerimist | Laiendada teenuse taseme välju |
| 15 | Allikate kuvamise uus väärtus | Tugev tehniline alus olemas | SUURES OSAS KOOSKÕLAS | VÄIKE TÄIENDUS | Vajab platvormiülest ühtset UI-d | Ühtlustada allikapaneeli renderdus |
| 16 | Rollipõhine uus kogemus | Rollid ja gating olemas | OSALISELT KOOSKÕLAS | KESKMINE MUUDATUS | Kogemus on veel feature-first | Ehita journey-first töölaud rollidele |
| 17 | Pakettide tabeli mõju | Subscription alus olemas | OSALISELT KOOSKÕLAS | VÄIKE TÄIENDUS | Uute journey funktsioonide mapping puudub | Kaardista MVP funktsioonid pakettidesse |
| 18 | Arendusjärjekord | Sobib olemasoleva koodibaasiga | SUURES OSAS KOOSKÕLAS | EI VAJA MUUTMIST | Järjekord on realistlik | Alustada నిజ journey mudelist |
| 19 | Kõige lühem uus visioon | Enamik mooduleid olemas, journey puudub | OSALISELT KOOSKÕLAS | EI VAJA MUUTMIST | Visioon ületab veidi tänast UX-i | Sünkida avalik sõnastus MVP-ga |
| 20 | Kogu mudeli lõplik koond | Enamik alamsüsteeme olemas | OSALISELT KOOSKÕLAS | SUUR ARHITEKTUURILINE MUUDATUS | Puudub ühendav journey kese | Kasutada koondit pärast journey aluse loomist |
| 21 | Codexile antav arendusülesanne | Tööpakettide sihtmoodulid olemas | SUURES OSAS KOOSKÕLAS | EI VAJA MUUTMIST | Jada on mõistlik, kuid eeldab scope lukku | Kinnitada esimese tehnilise MVP täpne ulatus |

## A. Mis on juba platvormis olemas ja sobib uue mudeliga?

- Privaatne assistendivestlus
- Eelpöördumised ja eelkaardistuse küsimustik
- Teenusekaart kui KOV + teenuseosutaja kaart
- Teenuseosutaja profiili haldus
- Vestlusruumid, kutsed, kõned ja nõusolekupõhine salvestus/transkriptsioon
- Dokumendihoidla, dokumendi analüüs, agent workspace, artefaktid
- Abisoovid ja abipakkumised
- Privaatsuse eelkontroll
- Rolli- ja subscription-gating
- Allikate kuvamise tehniline alus ja source metadata

## B. Mis on olemas, aga teise nime või teise loogikaga?

- `PreInquiry` toimib osaliselt tulevase journey-järgmise sammu sillana
- `CovisionJourneyStep` ei ole üldine teekonnakaart, vaid kovisiooni juhtumi siseloogika
- Room on sisuliselt juba koostööruum, kuid mitte type/origin tasemel modelleeritud
- Vastuvõtt on olemas pre-inquiry töövaatena, mitte eraldi intake-mudelina
- Rollipõhine kogemus on olemas feature-first loogikaga, mitte journey-first loogikaga

## C. Mis vajab ainult väikest täiendust?

- Punkt 8: eelpöördumise koht uues mudelis
- Punkt 14: teenuseprofiil ja haldus
- Punkt 15: allikate kuvamise uus väärtus
- Punkt 17: pakettide tabeli mõju

## D. Mis vajab keskmist muudatust?

- Punkt 5: osapoolte loogika
- Punkt 6: teenusekaart uues loogikas
- Punkt 7: teenuseni jõudmise loogika
- Punkt 9: juhendatud eelkaardistus
- Punkt 10: pöördumiste vastuvõtt
- Punkt 11: vestlusruum kui koostööruum
- Punkt 12: teenusekatkemise kontroll
- Punkt 13: anna endast märku
- Punkt 16: rollipõhine uus kogemus

## E. Mis vajab suurt arhitektuurilist muudatust?

- Punkt 1: uus keskne mõte
- Punkt 2: uus arhitektuurne mudel
- Punkt 3: teekonnakaart kui uus kese
- Punkt 4: teekonnakaardi olekud
- Punkt 20: kogu mudeli koond

## F. Mis vajab eraldi tooteotsust?

- Kas journey luuakse automaatselt või kasutaja kinnitusega
- Kas teekond elab chatis, töölaul või omaette vaates
- Kas tervisekontaktid on teenusekaardi päriskirjed või ainult soovitatud haru
- Millised guided mapping kanalid lähevad MVP-sse
- Kuidas paketid seotakse uute journey-funktsioonidega

## G. Kõige olulisemad peatükkide ja koodibaasi vahelised vastuolud

- Dokumenti keskne `Journey`/`JourneyMap` objekt puudub koodibaasis täielikult.
- Teenusekaart ei toeta täna peatüki 6-7 kirjelduse järgi `KOV_SERVICE`, `HEALTH_CONTACT` ega struktureeritud `accessPath` mudelit.
- Roomi päritolu ja tüüp ei ole andmemudelis tugevasti modelleeritud; pre-inquiry seos hoitakse kirjeldusmarkeriga.
- Vastuvõtt on olemas, kuid mitte dokumenti kirjeldatud intake tüüpide ja olekutega.

## H. Kõige olulisemad andmemudeli tähelepanekud

- Puudub `Journey`/`JourneyMap` mudel.
- `Room` mudelis puuduvad `roomType`, `originType`, `originId`, `journeyId`.
- `ServiceMapEntryType` on liiga kitsas teekonnakeskse teenusekaardi jaoks.
- `ServiceMapEntry` mudelis puuduvad ligipääsutee väljad.
- `PreInquiry` mudel on tugev, kuid ei hoia guided mapping kanalieelistusi ega pöördumistüüpi piisavalt rikkalt.

## I. Kõige olulisemad ligipääsu ja nähtavuse tähelepanekud

- `lib/authz.js` ja `useEffectiveRole.js` annavad tugeva aluse rollipõhisusele.
- Privaatse vestluse jagamata jätmise põhimõte on kooskõlas nii koodi kui dokumendiga.
- Vastuvõtja näeb juba täna ainult saadetud/jagatavat pre-inquiry infot, mitte kogu privaatset chati.
- Teenuseosutaja vaate laiendamisel tuleb vältida, et talle avaneks liiga lai eelkaardistus väljaspool teenusega seotud konteksti.

## J. Kõige olulisemad UI/UX tähelepanekud

- Praegune UX on endiselt tugevalt feature-first.
- Journey-first UX-i jaoks tuleb lisada uus alguspind, mitte lihtsalt uus nupp olemasolevate sekka.
- `WorkspaceFeaturePage.jsx` koondab palju loogikat; journey-kogemus võib vajada sellest eraldi pealmist taset.
- Allikate kuvamise tehniline alus on tugev, kuid eri pindade ühine allikapaneel vajab ühtlustamist.

## K. Kõige olulisemad RAG/allikate tähelepanekud

- RAG/allikate hinnang põhineb ainult aktiivsel koodil ja testidel.
- `displayed_sources` eristus on olemas ja hästi testitud.
- `source_status`, `last_checked`, allikatüüp ja autoriteedi vihjed on tehniliselt toetatud.
- Teenusekaardi ja journey jaoks puudub veel sama metadata platvormiülene ühtne esitlus.

## L. Soovituslik MVP järjekord

1. Luua minimaalne `Journey` andmemudel ja API.
2. Lisada chati esmane teekonnasõel, mis loob journey esialgse kokkuvõtte.
3. Kuvada minimaalne teekonnakaardi UI: kokkuvõte, puuduolev info, järgmised sammud, privaatsusmärge.
4. Siduda teekonnast teenusekaart eelfiltritega.
5. Siduda teekonnast eelpöördumine/eelkaardistus.
6. Lisada pre-inquiry/intake poolele lihtne pöördumistüüpide eristus.
7. Lisada roomile typed origin metaandmed.
8. Lisada teenusekatkemise kontroll kui eraldi journey signal.
9. Laiendada teenusekaarti `accessPath` loogikaga.
10. Uuendada rollipõhine töölaud ja pakettide esitlus.

## M. Failid ja moodulid, mida tuleks hiljem esimesena muuta, kui annan arenduseks loa

- `prisma/schema.prisma`
- uus `lib/journey/**`
- uued `app/api/journeys/**`
- `app/api/chat/route.js`
- `lib/chat/**`
- `components/workspace/WorkspaceFeaturePage.jsx`
- `app/vestlus/page.js`
- `app/api/service-map/**`
- `lib/serviceMap/**`
- `app/api/pre-inquiries/**`
- `lib/preInquiries.js`
- `app/api/rooms/**`

## N. Mida kindlasti praegu mitte puudutada?

- RAG/source attribution tehnilist tuuma, mis juba töötab:
  - `lib/chat/sourceAttribution.js`
  - `lib/chat/responseFinalizer.js`
  - `lib/rag/sourceMetadata.js`
  - `lib/rag/sourceFreshness.js`
- olemasolevat privacy-check loogikat:
  - `app/api/privacy/check/route.js`
  - `lib/privacy/privacyGuard.js`
- toimivat subscription/authz alust:
  - `lib/authz.js`
  - `lib/subscriptionPlans.js`
- olemasolevat room call consent/salvestuse voogu, kui room metaandmeid alles lisatakse
- `CovisionCase` ja `CovisionJourneyStep` domeeniobjekte; neid ei tohiks võtta üldise journey mudeli asenduseks

## Lõpukontroll

- Käsitletud on punktid 1–21.
- Punkt 20 on käsitletud koondina, mitte detailpeatükkide asendusena.
- Punkti 21 ei viidud ellu.
- Faile peale selle auditiraporti ei muudetud.
- Koodi ei kirjutatud.
- Migratsioone ei tehtud.
- Build/deploy käske ei käivitatud.
- Riskid ja tähelepanekud lähtuvad peatükkide sisust ja aktiivsest koodibaasist.
