# Journey MVP tehniline spetsifikatsioon

## 1. MVP eesmärk

Journey MVP lisab SotsiaalAI-sse õhukese teekonnakihi, mis võimaldab kasutajal alustada privaatsest chat'ist, saada olukorra põhjal ajutise `JourneyDraft` vaate, kinnitada selle salvestamise ja liikuda sealt olemasolevasse teenusekaardi või eelpöördumise töövoogu. MVP ei ehita uut teenusekaarti, uut ruumisüsteemi, uut intake-süsteemi ega uut ametliku hindamise loogikat. Eesmärk on testida teekonnakeskset kasutajavoogu olemasolevate moodulite kohal.

## 2. MVP piirid

### Sisaldub MVP-s

- Ajutine `JourneyDraft` või structured chat context privaatse vestluse põhjal.
- Kasutaja kinnitusega salvestatav privaatne `Journey`.
- Minimaalne teekonnakaardi UI chatis või chati kõrval.
- Teekonnalt olemasoleva teenusekaardi avamine eelfiltriga.
- Teekonnalt olemasoleva eelpöördumise avamine eel täidetud kontekstiga.
- Olemasolevate privacy, authz, source attribution ja pre-inquiry kihtide kasutamine.
- Pöörduja-keskne esmane kasutusvoog.

### Ei sisaldu MVP-s

- Uus ruumisüsteem.
- `Room` mudeli või room call töövoogude ümbertegemine.
- `PreInquiry` staatuste ümbernimetamine või intake-mudeli täielik ümberkujundamine.
- Teenusekaardi `accessPath` täielik andmemudel.
- `HEALTH_CONTACT` või `KOV_SERVICE` täielik teenusekaardi kirjetüüpide ümberkujundus.
- Täis `JourneyParty` ja `JourneyAction` tabelid.
- Pakettide/tellimuste ümberkujundamine.
- Rolliti täielik uus töölaud.

### Hilisem etapp

- `JourneyParty` ja `JourneyAction` normaliseeritud mudelid.
- `PreInquiry.journeyId` ja `Room.journeyId` tugevad skeemiseosed, kui MVP on valideeritud.
- Teenusekaardi ligipääsutee (`accessPath`) struktureeritud mudel.
- Teenusekatkemise kontroll eraldi workflow'na.
- Tervisekontakti piiratud kiht teenusekaardis või journey soovitustes.
- Rollipõhine journey töölaud spetsialistile ja teenuseosutajale.
- Allikapaneeli ühtlustamine kõigis journey-ga seotud vaadetes.

## 3. Kasutajavoog

Minimaalne voog:

Privaatne chat  
-> `JourneyDraft`  
-> kasutaja kinnitab või salvestab  
-> privaatne `Journey`  
-> kasutaja avab teenusekaardi või eelpöördumise

Detailsemalt:

1. Kasutaja kirjeldab privaatses chat'is oma olukorda.
2. Chat orchestration koostab vastuse kõrval struktureeritud `JourneyDraft` väljad.
3. Kasutajale kuvatakse teekonnakaardi mustand: kokkuvõte, puuduolev info ja soovitatud järgmised sammud.
4. Draft ei ole püsiv andmeobjekt enne kasutaja kinnitust.
5. Kui kasutaja valib "Salvesta teekond", luuakse privaatne `Journey`.
6. Kui kasutaja valib "Ava teenusekaart", antakse teenusekaardile kaasa journey context eelfiltriks.
7. Kui kasutaja valib "Koosta eelpöördumine", avatakse olemasolev pre-inquiry flow eel täidetud kontekstiga.

## 4. Minimaalne andmemudel

See kirjeldus ei ole migratsioon ega Prisma skeemi muutmise juhis. See on mudelitaseme spetsifikatsioon hilisemaks arenduseks.

### Journey

Minimaalne `Journey` peaks olema privaatne kasutaja teekonna objekt.

Soovitatavad väljad:

- `id`
- `ownerUserId`
- `conversationId` valikuliselt
- `status`
- `sharingStatus`
- `title`
- `summary`
- `primaryPath`
- `domains`
- `missingInfo`
- `riskSignals`
- `suggestedActions`
- `context`
- `createdAt`
- `updatedAt`

MVP-s piisab JSON-väljadest:

- `domains`
- `missingInfo`
- `riskSignals`
- `suggestedActions`
- `context`

Need ei pea esimeses versioonis olema eraldi tabelid.

### JourneyDraft või structured chat context

`JourneyDraft` ei pea MVP-s olema püsiv tabel.

See võib olla:

- chat response metadata;
- frontend state;
- ajutine structured context API vastuses;
- salvestatavaks muutuv payload, kui kasutaja kinnitab.

Drafti minimaalne kuju:

- `title`
- `summary`
- `primaryPath`
- `domains`
- `missingInfo`
- `riskSignals`
- `suggestedActions`
- `serviceMapFilters`
- `preInquiryPrefill`

### Seos Conversationiga

- `Journey` võib hoida valikulist `conversationId`.
- Iga `Conversation` ei pea looma `Journey` objekti.
- Ühest vestlusest võib tekkida null või mitu teekonda, kuid MVP-s on mõistlik toetada ainult üht salvestatavat teekonda ühe valitud olukorra kohta.

### Seos PreInquiryga

- MVP-s ei pea `PreInquiry` skeemi kohe muutma.
- Handoff võib toimuda prefill payload'i kaudu.
- Hilisemas etapis võib lisada `PreInquiry.journeyId`, kui tekib vajadus näidata eelpöördumist teekonna ajajoonel.

### Seos ServiceMapEntryga

- MVP-s piisab teenusekaardi avamisest filtritega.
- Valitud `ServiceMapEntry` ID-d võib hoida `Journey.context.selectedServiceMapEntryIds` sees.
- Eraldi join-tabel ei ole MVP-s vajalik.

### SuggestedActions

`suggestedActions` võib olla JSON-array.

Võimalikud MVP väärtused:

- `OPEN_SERVICE_MAP`
- `CREATE_PRE_INQUIRY`
- `ADD_DOCUMENT`
- `CREATE_HELP_REQUEST`
- `ASK_CLARIFYING_QUESTION`

MVP UI võib kuvada ainult kaks aktiivset tegevust:

- `OPEN_SERVICE_MAP`
- `CREATE_PRE_INQUIRY`

### MissingInfo

`missingInfo` võib olla JSON-array tekstilistest või enumilaadsetest võtmetest.

Näited:

- `municipality`
- `existingDecisionOrPlan`
- `whoIsConcerned`
- `currentServiceStatus`
- `preferredContact`

### RiskSignals

`riskSignals` võib olla JSON-array.

MVP-s ei tohi seda kuvada ametliku riskihindena. See on ettevaatlik tähelepanek, mis aitab valida järgmist sammu.

Näited:

- `possible_service_continuity_issue`
- `possible_health_contact_needed`
- `urgent_or_crisis_signal`

### Status ja sharingStatus

Minimaalne `status`:

- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

Minimaalne `sharingStatus`:

- `PRIVATE`
- `PREPARING_SHARE`
- `SHARED_VIA_PRE_INQUIRY`

MVP algolek on alati:

- `status = ACTIVE`
- `sharingStatus = PRIVATE`

## 5. API ja teenusekiht

API ja teenusekiht peaksid olema õhukesed ning kasutama olemasolevat authz/privacy loogikat.

### Journey draft loomine

Võimalikud lahendused:

- draft tekib `app/api/chat/**` vastuse metadata sees;
- või eraldi teenus `lib/journey/draft.js`, mida chat orchestration kutsub.

Soovitus:

- hoida drafti loomise loogika teenusekihis, mitte UI-s;
- mitte luua eraldi püsivat draft route'i enne, kui on selge, et drafti tuleb serveris hoida.

### Journey salvestamine

Vajalik route:

- `POST /api/journeys`

Vastutus:

- kontrollib kasutaja sessiooni;
- valideerib draft payload'i;
- loob privaatse journey kasutaja kinnituse järel;
- ei jaga infot ühelegi vastuvõtjale.

### Journey lugemine

Vajalik route:

- `GET /api/journeys`
- `GET /api/journeys/[id]`

Vastutus:

- tagastab ainult kasutajale kuuluvad journey'd;
- admin või rollivaade ei pea MVP-s olema eraldi käsitletud.

### Journey uuendamine

Vajalik route:

- `PATCH /api/journeys/[id]`

MVP-s lubatud uuendused:

- `title`
- `summary`
- `missingInfo`
- `suggestedActions`
- `status = ARCHIVED`

MVP-s mitte lubada:

- jagamisoleku käsitsi muutmist ilma seotud töövoota;
- teiste kasutajate lisamist;
- vastuvõtja määramist otse journey külge.

### Journey -> PreInquiry handoff

Võimalik route või teenus:

- `POST /api/journeys/[id]/pre-inquiry-draft`

Vastutus:

- koostab olemasolevale pre-inquiry flow'le prefill payload'i;
- ei loo uut paralleelset eelpöördumise mudelit;
- kasutab olemasolevat `lib/preInquiries.js` loogikat seal, kus võimalik.

### Journey -> Service Map handoff

Võimalik route või client-side link:

- `/teenusekaart?journeyId=...`
- või service map API päring `journeyContext` filtriga

MVP-s piisab:

- piirkond, kui teada;
- primaryPath;
- domains;
- soovitud recipient type (`KOV_CONTACT` või `SERVICE_PROVIDER`), kui tuletatav.

## 6. Chat-integratsioon

`JourneyDraft` tekib privaatses chat'is pärast seda, kui kasutaja kirjeldab olukorda piisavalt, et pakkuda järgmisi samme.

Structured output võiks sisaldada:

- `summary`
- `primaryPath`
- `domains`
- `missingInfo`
- `riskSignals`
- `suggestedActions`
- `serviceMapFilters`
- `preInquiryPrefill`
- `confidence`

Kasutajale näidatakse kaarti siis, kui:

- vastuses on vähemalt üks konkreetne järgmine samm;
- süsteem suudab koostada lühikese kokkuvõtte;
- draft ei põhine ainult tervitusel või väga üldisel küsimusel.

Püsiv `Journey` salvestatakse ainult siis, kui kasutaja vajutab salvestamise või teekonna kasutamise tegevust.

Olemasoleva chat orchestration dubleerimist tuleb vältida nii:

- chat jääb vastamise ja töövoo käivitamise kohaks;
- journey draft on structured output, mitte eraldi paralleelne agent;
- olemasolevaid document, help ja pre-inquiry intent'e ei kopeerita journey teenusesse;
- journey teenus ei otsusta ametlikult, vaid korrastab järgmiste sammude konteksti.

## 7. UI MVP

Minimaalne UI paikneb chatis või chati kõrvalpaneelis.

Teekonnakaardi MVP plokid:

- olukorra kokkuvõte;
- seotud teemad;
- puuduolev info;
- ettevaatlikud tähelepanekud;
- soovitatud järgmised sammud;
- privaatsusmärge.

Vajalikud nupud:

- `Salvesta teekond`
- `Ava teenusekaart`
- `Koosta eelpöördumine`

UI tekst peab selgelt ütlema:

- teekond on privaatne;
- see ei ole ametlik hindamine;
- soovitatud kontaktid ei näe infot;
- jagamine toimub ainult kasutaja kinnitusega.

MVP ei vaja:

- keerulist timeline'i;
- osapoolte haldust;
- drag-and-drop tegevusi;
- eraldi journey dashboardi;
- rolliti erinevaid journey vaateid.

## 8. Integratsioon eelpöördumisega

Journey ei tohi dubleerida olemasolevat eelpöördumist.

Soovitatud handoff:

1. Kasutaja vajutab journey kaardilt `Koosta eelpöördumine`.
2. Süsteem koostab prefill payload'i.
3. Avatakse olemasolev pre-inquiry flow.
4. Kasutaja näeb ja muudab kogu jagatavat sisu enne salvestamist või saatmist.
5. Vastuvõtja näeb ainult eelpöördumise kinnitatud sisu, mitte privaatset chat'i ega kogu journey drafti.

Prefill payload võiks sisaldada:

- `topic`
- `situation`
- `assessmentState.subject.concernsAbout`, kui teada;
- `assessmentState.subject.municipality`, kui teada;
- `selectedRecipientType`, kui journey soovitusest tuletatav;
- `missingInfo` märkusena, mitte kohustusliku väljana.

MVP-s ei pea lisama `PreInquiry.journeyId`, kui handoff töötab turvaliselt payload'i kaudu. Kui tooteotsus nõuab hiljem teekonna ajalugu, võib seos lisanduda järgmises etapis.

## 9. Integratsioon teenusekaardiga

Journey avab olemasoleva teenusekaardi eelfiltriga.

MVP eelfilter võib kasutada:

- omavalitsus või piirkond, kui kasutaja on selle andnud;
- primaryPath;
- domains;
- soovitud kirjetüüp:
  - `KOV_SOCIAL_CONTACT`
  - `KOV_GENERAL_CONTACT`
  - `SERVICE_PROVIDER`
- otsingusõnad olukorra kokkuvõttest või domain'idest.

MVP ei eelda:

- uut `accessPath` mudelit;
- uusi teenusekaardi kirjetüüpe;
- tervisekontaktide täielikku kaardikihti;
- service map sync muutmist.

Kui teenusekaart ei leia sobivat filtrit, peab UI lubama kasutajal avada kaart ilma filtrita.

## 10. Privaatsus ja nähtavus

Journey on MVP-s alati privaatne.

Põhimõtted:

- `JourneyDraft` ei ole jagatud objekt.
- Salvestamata draft ei jää püsivaks teekonnaks.
- `Journey` kuulub kasutajale.
- Soovitatud kontakt ei näe journey sisu.
- PreInquiry vastuvõtja ei näe privaatset chat'i.
- PreInquiry vastuvõtja näeb ainult kasutaja kinnitatud eelpöördumise sisu.
- Kasutaja kinnitab enne jagamist.
- Olemasolevat privacy-check loogikat kasutatakse jagatava teksti kontrolliks.
- Olemasolevat authz kihti kasutatakse ligipääsu kontrolliks.
- Source attribution tuuma ei dubleerita journey kihis.

Journey UI peab vältima sõnastust:

- "SotsiaalAI hindas abivajadust"
- "Sulle määrati teenus"
- "Sind suunatakse teenusele"
- "See otsus kehtib KOV-ile"

Sobiv sõnastus:

- "Teekonnakaart aitab olukorda korrastada ja järgmisi samme ette valmistada."
- "Ametliku hindamise või otsuse teeb pädev spetsialist või asutus."

## 11. Mida mitte muuta

Esimeses Journey MVP etapis mitte muuta:

- `Room` süsteemi;
- room call, recording ja transkriptsiooni nõusoleku vooge;
- `PreInquiry` status enumit;
- pre-inquiry vastuvõtu põhimudelit;
- service map sync loogikat;
- RAG/source attribution tuuma;
- `displayed_sources` loogikat;
- privacy-check tuuma;
- authz/subscription tuuma;
- billingut;
- kovisiooni `CovisionJourneyStep` mudelit;
- `HelpRequest`, `HelpOffer`, `HelpMatch` põhimudeleid.

MVP peab kasutama olemasolevaid töövooge nende kohal oleva handoff-kihina.

## 12. Vastuvõtukriteeriumid

MVP on vastuvõetav, kui:

- kasutaja saab privaatses chat'is olukorra kirjelduse järel `JourneyDraft` kaardi;
- kasutaja saab salvestada draftist privaatse `Journey`;
- salvestamata draft ei muutu püsivaks objektiks;
- salvestatud `Journey` on nähtav ainult omanikule;
- `Journey` avab olemasoleva teenusekaardi eelfiltriga;
- kui filter puudub või on nõrk, saab kasutaja avada teenusekaardi ilma filtrita;
- `Journey` avab olemasoleva eelpöördumise eel täidetud kontekstiga;
- kasutaja saab eelpöördumise sisu enne jagamist muuta ja kinnitada;
- privaatset chat'i ei jagata eelpöördumise vastuvõtjale;
- olemasolevad pre-inquiry töövood ei regressi;
- olemasolevad service map töövood ei regressi;
- olemasolevad privacy/authz/source attribution kihid jäävad kasutusse;
- build/deploy ei ole spetsifikatsiooni osa.

## 13. Riskid ja lahtised otsused

| Teema | Risk | Vajalik otsus | Soovitus |
|---|---|---|---|
| Millal Journey salvestub | Automaatne salvestus võib luua liiga palju privaatseid objekte | Kas salvestus on automaatne või kinnitusega? | Ainult kasutaja kinnitusega |
| UI paiknemine | Eraldi leht teeb MVP liiga suureks | Kas kaart on chatis, kõrvalpaneelis või lehel? | Chatis või kõrvalpaneelis |
| MVP väljad | Liiga lai mudel muudab esimese etapi raskeks | Millised väljad on kohustuslikud? | `summary`, `primaryPath`, `missingInfo`, `suggestedActions`, `sharingStatus` |
| JourneyParty | Varane normaliseerimine võib dubleerida olemasolevaid osapooli | Kas vaja on eraldi tabelit? | Mitte MVP-s |
| JourneyAction | Varane tegevustabel võib paisutada scope'i | Kas vaja on eraldi tabelit? | Mitte MVP-s; JSON `suggestedActions` |
| PreInquiry seos | Otsene seos võib vajada skeemimuutust liiga vara | Kas lisada kohe `journeyId`? | Mitte vältimatu MVP-s |
| ServiceMap filter | Filter võib olla ebatäpne | Kas ebatäpne filter blokeerib kasutaja? | Ei, kaart peab avanema ka ilma filtrita |
| RiskSignals | Võib näida ametliku riskihindena | Kuidas kuvada? | Ettevaatlik tähelepanek, mitte riskiskoor |
| Tervisekontakt | Võib paisutada teenusekaardi scope'i | Kas lisada MVP-s kirjetüübina? | Ei, jätta hilisemaks |
| Room seos | Room mudeli muutmine võib tekitada regressioone | Kas siduda room kohe journeyga? | Ei, ainult hiljem |

## 14. Soovitatud esimene arendusülesanne

Pealkiri:

"Lisa õhuke Journey MVP: chat draft -> privaatne Journey -> teenusekaart/eelpöördumine handoff."

Kirjeldus:

Luua minimaalne teekonnakeskne MVP, kus privaatne chat saab koostada kasutaja olukorra põhjal struktureeritud `JourneyDraft` väljundi. Kasutaja saab selle kinnitada ja salvestada privaatse `Journey` objektina. Salvestatud journey võimaldab avada olemasoleva teenusekaardi eelfiltriga või alustada olemasolevat eelpöördumise voogu eel täidetud kontekstiga.

Töö piirid:

- mitte muuta olemasolevat room süsteemi;
- mitte muuta `PreInquiry` staatuseid;
- mitte ehitada uut teenusekaarti;
- mitte muuta RAG/source attribution tuuma;
- mitte muuta privacy/authz/subscription/billing tuuma;
- mitte lisada täis `JourneyParty` või `JourneyAction` tabeleid MVP-s.

Tõenäoliselt puudutatavad moodulid hilisema arenduse korral:

- `prisma/schema.prisma`
- uus `lib/journey/**`
- uus `app/api/journeys/**`
- `app/api/chat/**`
- `lib/chat/**`
- `components/alalehed/ChatBody.jsx`
- `app/vestlus/page.js`
- `components/workspace/WorkspaceFeaturePage.jsx`
- `lib/preInquiries.js`
- `app/api/pre-inquiries/**`
- `app/api/service-map/**`

Lõpukontroll:

- Koodi ei muudetud.
- Prisma skeemi ei muudetud.
- Migratsioone ei tehtud.
- Build/deploy käske ei käivitatud.
- Loodi ainult Markdown-spetsifikatsioon.
