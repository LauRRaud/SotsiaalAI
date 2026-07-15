# Fable 5 · Teenusekaart, teenuseprofiil ja abivahendus — tervikvoo analüüs

STATUS: COMPLETE

- **Kuupäev:** 2026-07-15
- **Alus:** aktiivne `main` (analüüsi ajal HEAD = 7ae76d5b)
- **Skoop:** kaks otsast-lõpuni voogu:
  1. Teenuseprofiil → Teenusekaart → otsing ja filtrid → kaardimarker → detailvaade → pöördumine
  2. Abisoov/abipakkumine → avaldamine → Teenusekaardil nähtavus → sobitamine → ühine vestlusruum
- **Meetod:** staatiline koodianalüüs + git-ajalugu + kuvatõmmise võrdlus + (võimalusel) autenditud runtime-kontroll testandmetega. Rakenduskoodi EI muudeta.

## Sisukord

**A-osa — tõendid (12 kontrolli)**
- A1. Teenusekaardi lehed, komponendid, API-d, andmemudelid
- A2. Teenuseosutaja teenuseprofiili elutsükkel
- A3. KOV sotsiaalhoolekande kontaktide allikas
- A4. Abisoov: loomine, privaatsus, avaldamine, kaardil nähtavus
- A5. Abipakkumine: loomine, privaatsus, avaldamine, kaardil nähtavus
- A6. Sobituse tegelik loogika
- A7. Ühine vestlusruum sobituse järel
- A8. Otsing, filtrid, kaardi/listivaate seos
- A9. Rollisõltuvad tegevused
- A10. Omanikuõigused ja avaliku/privaatse piir
- A11. Tühjad olekud, vead, mobiil, klaviatuur, a11y
- A12. Runtime-tõendus (autenditud voog)
- A13. Kujundusajalugu: vana kuvatõmmis + nelja markeriklassi git-arheoloogia

**B-osa — süntees (10 nõutud osa)**
- B1. Kasutaja lubadus vs tegelik aktiivne kood
- B2. Kaks otsast-lõpuni vooskeemi
- B3. Rollide ja õiguste tabel
- B4. Nelja markeritüübi tähendus- ja kujundusleping
- B5. Katkised ühendused ja vead (kooditõenditega)
- B6. Puuduva funktsionaalsuse loend
- B7. Soovitatud tulevane lehehierarhia
- B8. Ruumiline kujundusettepanek
- B9. Tooteotsused, mida koodist tuletada ei saa
- B10. Järjestatud teostuspaketid

---

# A-osa — tõendid

## A1. Teenusekaardi lehed, komponendid, API-d, andmemudelid

### Lehed (App Router)

| Route | Fail | Sisu |
|---|---|---|
| `/teenusekaart` | `app/teenusekaart/page.jsx:20` | `<WorkspaceFeaturePage feature="service_map" />` |
| `/teenuseprofiil` | `app/teenuseprofiil/page.jsx` | `<WorkspaceFeaturePage feature="service_profile" />` |
| `/eelpoordumised` | `app/eelpoordumised/` | `feature="pre_inquiries"` — pöördumise (eelpöördumise) töövoog |
| `/vestlus` | `app/vestlus/` | AI-vestlus; abisoovi/abipakkumise loomise töövoog (`?workflow=help_request\|help_offer`) ja sobitusjärgne ruumivestlus (`?roomId=…&roomKind=help-match`) |
| `/minu-jagamised` | `app/minu-jagamised/page.jsx` | Kasutaja jagamiste koondvaade (`/api/my-sharings`) |

**Arhitektuurne fakt:** kolm pinda (eelpöördumised, teenusekaart, teenuseprofiil) elavad ÜHES 4869-realises failis `components/workspace/WorkspaceFeaturePage.jsx`:
- `PreInquiriesSurface` (rida 666–2803)
- `ServiceMapSurface` (rida 2804–3153)
- `ServiceProfileSurface` (rida 3728–4746)
- dispatcher `WorkspaceFeaturePage` (rida 4747–4869)

Kaardirendrer on eraldi: `components/workspace/ServiceMapLeaflet.jsx` (1009 rida). Leaflet laetakse lokaalsest vendor-koopiast (`/vendor/leaflet/leaflet.js`, rida 21–22), aluskaart on Maa- ja Ruumiameti hallkaart-TMS (rida 17–20), vaade lukustatud Eestile (`ESTONIA_BOUNDS`, minZoom 8).

### API-d

| Endpoint | Meetodid | Autentimine | Roll |
|---|---|---|---|
| `/api/service-map/entries` | GET | sessioon valikuline; admin-lipud (`includeUnlocated`, `includeNeedsReview`) ainult adminile (`entriesQueryPolicy.js:13-14`) | teenuse- ja abikirjete koondloend kaardile |
| `/api/service-map/address-suggestions` | GET | — | Maaruumi geokoodri aadressiotsing profiili vormile |
| `/api/service-provider/profile` | GET/PUT | nõuab `SERVICE_PROVIDER` rolli või adminit (`route.js:27-34`) | oma profiili lugemine/salvestus |
| `/api/service-provider/profile/services/[serviceId]/availability-confirmation` | — | — | teenuse saadavuse ühe-klõpsu kinnitus |
| `/api/help/listings` | GET | nõuab sisselogimist | kuulutuste loend (`scope=mine\|global`) |
| `/api/help/listings/[kind]/[id]` | GET/PATCH/DELETE | sisselogimine; PATCH ainult omanik, DELETE omanik/admin | kuulutuse detail/muutmine/kustutus |
| `/api/help/matches` | POST | sisselogimine; algataja peab olema ühe poole omanik | sobituse + ruumi loomine |
| `/api/pre-inquiries` (+`/preferences`) | GET/POST | sisselogimine | eelpöördumised |
| `/api/my-sharings` | GET | sisselogimine | jagamiste koond |
| `/api/rooms/[roomId]/…` | GET/POST | sisselogimine | ruumivestlus (sõnumid, liikmed, stream, kõned) |

### Andmemudelid (prisma/schema.prisma)

**Teenusepool:**
- `ServiceProviderProfile` (rida 1663) — 1:1 omanikuga (`@@unique([ownerId])`), `status DRAFT|PUBLISHED|HIDDEN`, `mapVisible` (vaikimisi **false**), `publicSlug`, `acceptsPlatformPreInquiries/acceptsEmailPreInquiries` (vaikimisi true), `assistantRecommendationAllowed` (vaikimisi false)
- `ServiceProviderService` (1715) — teenusekirjed: kategooriad, sihtrühmad, vanuserühmad, vajaduse-sildid, eluvaldkonnad, osutusviisid, keeled, hind (`feeType`), saadavus (`availabilityStatus/-CheckedAt/-ReminderSentAt`), suunamisnõuded (`requiresKovAssessment/KovDecision/SkaReferral/SpecialistReferral`), oma `mapVisible`+`status`
- `ServiceProviderLocation` (1778) + sidumistabel `ServiceProviderServiceLocation` (1811) — mitu teeninduskohta, igal oma geokood
- `ServiceMapEntry` (1823) — kaardikirje: `type ServiceMapEntryType` (KOV_SOCIAL_CONTACT, KOV_GENERAL_CONTACT, SERVICE_PROVIDER), `status DRAFT|NEEDS_REVIEW|PUBLISHED|HIDDEN`, `geocodingStatus PENDING|MATCHED|MANUALLY_CONFIRMED|AMBIGUOUS|FAILED`, `accessPath Json` (teenusele jõudmise loogika), seos `providerProfileId @unique`
- `Municipality` (1511) + `MunicipalityKovAdmin` (1532) — KOV register (ametlik veeb, failid, RT-viited)
- `PreInquiry` (1864) — pöördumine: `recipientType KOV_CONTACT|KOV_GENERAL_CONTACT|SERVICE_PROVIDER`, `deliveryChannel INTERNAL|EXTERNAL_EMAIL`, autor + `recipientOwnerId` + `recipientEntryId → ServiceMapEntry`, staatused DRAFT→READY→SENT→…

**Abivahenduspool:**
- `HelpRequest` (2586) / `HelpOffer` (2628) — kasutaja omanduses, `status HelpRecordStatus (DRAFT|OPEN|MATCHED|CLOSED|CANCELLED|ARCHIVED)`, `helpType VOLUNTARY|PAID|MIXED`, `timeType ONE_TIME|RECURRING|FLEXIBLE`, `classificationSource AI|USER|MANUAL`, `userConfirmedAt`, `expiresAt`
- `HelpCategory` (2545, puu) + `TargetGroup` (2572) + M:N sidumistabelid
- `HelpMapEntry` (2669) — kuulutuse kaardiprojektisioon 1:1: `mapVisible` (vaikimisi **false** skeemis), `mapMode PHYSICAL|AREA|AT_HOME|ONLINE_PHONE`, `contactMode` (vaikimisi PLATFORM), `status` (vaikimisi REVIEW), `privacyNote`
- `HelpMatch` (2753) — `@@unique([requestId, offerId])`, `roomId @unique`, `status PENDING|CONTACTED|ACCEPTED|DECLINED|CLOSED`, `scoreSnapshot`, `reasonsJson`
- `Room` (2779) + `RoomMember` (2804, `role OWNER|MEMBER`) + `RoomMessage` (2859) + `Invite` — päris vestlusruumid, origin-viide (`originType HELP_MATCH`)

### Serveripoolne kokkupanek

`GET /api/service-map/entries` (route.js:15-47) liidab kaks allikat:
1. `listPublishedServiceMapEntries` (`lib/serviceProviderProfiles.js:1105`) — ainult `status: "PUBLISHED"` + geokood MATCHED/MANUALLY_CONFIRMED (või avaldatud geokoodiga teeninduskoht)
2. `listPublishedHelpMapEntries` (`lib/help/mapEntries.js:428`) — ainult `mapVisible: true` + `status: "PUBLISHED"` + aegumata + geokooditud

---

## A2. Teenuseosutaja teenuseprofiili elutsükkel

### Loomine ja muutmine

- UI: `ServiceProfileSurface` (WorkspaceFeaturePage.jsx:3728) — organisatsiooni andmed, teenusekirjed (`serviceItems`), teeninduskohad (`serviceLocations`), aadressiotsing `ServiceProfileAddressInput` (3623) Maaruumi soovituste vastu.
- API-värav on **serveripoolne**: `requireServiceProviderProfileUser` (profile/route.js:16-43) lubab ainult `SERVICE_PROVIDER` rolli või admini. Kliendipoolne dispatcher (WorkspaceFeaturePage.jsx:4855) EI kontrolli rolli — iga sisselogitu näeb `/teenuseprofiil` vormi kesta, kuid andmelaadimine annab 403.
- Salvestus: `upsertServiceProviderProfileForOwner` (serviceProviderProfiles.js:900-1086) — Serializable-transaktsioon, korduskatsetega. Teenused ja asukohad kustutatakse ja luuakse uuesti (964-969); teenuse ID säilib `previous?.id` kaudu (992), et saadavuskinnituse ajatemplid ei kaoks.

### Avaldamine ja kaardile jõudmine

`deriveServiceMapState` (serviceProviderProfiles.js:177-208) — kaardikirje olek tuletatakse profiilist:

| Profiili seis | Kaardikirje staatus |
|---|---|
| `mapVisible=false` VÕI `status=HIDDEN` | `HIDDEN` |
| `status != PUBLISHED` | `DRAFT` |
| `PUBLISHED` + kinnitatud koordinaat (profiilil või ≥1 avaldatud teeninduskohal) | `PUBLISHED` → **nähtav kaardil** |
| `PUBLISHED`, aga koordinaat kinnitamata | `NEEDS_REVIEW` → kaardil EI kuvata (v.a admini eelvaade) |

- Koordinaat loetakse kinnitatuks kui `geocodingStatus ∈ {MATCHED, MANUALLY_CONFIRMED}` + lat/lng olemas (`isConfirmedLocation`, 166-175). Aadressivalik vormis annab kohe MATCHED (239-243).
- `publishedAt` fikseeritakse esimesel avaldamisel (932-935); `publicSlug` genereeritakse nimest + omaniku ID sufiksist (160-164) — **kuid ühtegi avalikku `/teenus/[slug]` lehte selle slugiga ei eksisteeri** (vt B6).
- Kasutajale peegeldatakse geokoodi seisu tekstiga `serviceProfileMapStatusText` (WorkspaceFeaturePage.jsx:3465-3497): „vaste olemas", „vajab täpsustamist", „vastet ei leitud", „ootab vastendamist".

### Teenuse-taseme nähtavus

Iga `ServiceProviderService` kannab oma `mapVisible` + `status`; kaardi otsing ja popup filtreerivad `mapVisible !== false && status === "PUBLISHED"` (WorkspaceFeaturePage.jsx:2944; ServiceMapLeaflet.jsx:346).

---

## A3. KOV sotsiaalhoolekande kontaktide allikas

KOV-kirjed EI sünni kasutajavormist, vaid kolmest sünkroniseerimisrajast:

1. **KOV registri põhine** — `lib/serviceMap/kovMunicipalitySync.js`: igast `MunicipalityKovAdmin` reast tehakse üks `ServiceMapEntry` id-ga `kov-municipality-<slug>`, tüüp `KOV_SOCIAL_CONTACT`, pealkiri „<KOV> sotsiaalhoolekanne", staatus **NEEDS_REVIEW** ja geokood **PENDING** — st vajab admini ülevaatust enne kaardile pääsemist. Telefon/e-post jäetakse teadlikult tühjaks („Kirje on loodud KOV registri põhjal ning vajab … ülevaatust").
2. **KOV failide/RAG-i kontaktikirjed** — `lib/serviceMap/kovContactSync.js`: `contact|official_contact` tüüpi kirjed filtreeritakse sotsiaalvaldkonna märksõnadega (`sotsiaal`, `hoolekan`, `lastekaitse`, `toimetulek`, …) → id `kov-contact-*`.
3. **RAG-allikate sünk** — `lib/serviceMap/ragServiceMapSync.js` + `lib/admin/rag/contactRegistry/service.js` (admin-RAG kontaktiregister).

Käivitus on **operatiivne, mitte runtime**: `scripts/sync-kov-service-map-entries.mjs` ja `scripts/sync-kov-municipality-service-map-entries.mjs`. Kaardile jõuab KOV-kirje alles siis, kui admin on kirje PUBLISHED-iks vaadanud ja geokood on MATCHED/MANUALLY_CONFIRMED (listPublishedServiceMapEntries filtrid, A1).

`KOV_GENERAL_CONTACT` (üldkontakt) on eraldi tüüp; kaardi UI koondab mõlemad KOV-filtri alla (`serviceMapEntryMatchesType`, WorkspaceFeaturePage.jsx:530-537).

---

## A4. Abisoov: loomine, privaatsuspiir, avaldamine, kaardil nähtavus

### Loomine — ainult vestluse kaudu

- Sissepääsud: `/vestlus?workflow=help_request` (nt Teekonna jagamispaneelist, `components/journey/JourneyDetail.jsx:671`). Eraldi vormi-lehte ei ole — see vastab tooteloale („vestluspõhine, mitte ankeet").
- Töövoog: `lib/help/chatWorkflow.js` + `workflowExtraction/Questions/Preview/State` — AI loeb kirjeldusest väljad, küsib puuduva, näitab eelvaadet.
- **Salvestus toimub alles kinnitusel**: `saveStructuredRecord` (workflowActions.js:317-369) käivitub ainult kinnitusintendil; enne seda elab mustand ainult töövoo olekus, mitte andmebaasis. Kirje luuakse `classificationSource: "USER"`, `userConfirmedAt: now` (360-361) → `HelpRecordStatus` vaikimisi `OPEN`.
- **PII-redaktsioon**: kõik avalikud tekstiväljad käivad läbi `redactPersonalData` (336, 342-359) nii loomisel kui ka hilisemal PATCH-il (`listings/[kind]/[id]/route.js:118-127` — `PUBLIC_LISTING_TEXT_FIELDS`).

### Kaardile projitseerimine

`createHelpRequest` → `syncHelpRequestMapEntry` (requests.js:238) → `syncHelpMapEntryForRecord` (mapEntries.js:268-316):

- `mapMode` vaikimisi **AREA** (üldistatud piirkond); `DIGITAL_HELP` kategoorial ONLINE_PHONE (145-150)
- **Täpne aadress AINULT** kui `mapMode=PHYSICAL` JA kasutaja andis `exactAddressPublic=true` (168-175); muidu `address=null`
- `privacyNote` alati kaasas: „Kaardil kasutatakse üldistatud piirkonda; täpset koduaadressi ei avaldata." (302-304)
- kaardistaatus: `userConfirmedAt` olemas → **PUBLISHED**, muidu REVIEW; suletud/aegunud → CLOSED/EXPIRED (192-200)
- `mapVisible` vaikeväärtus sünkis on **true** (279) — kinnitatud kuulutus läheb otse kaardile, kui geokood õnnestub
- aegumine: vaikimisi **45 päeva** (6, 123-127)
- geokood käib üldistatud koha järgi (`serviceArea` → omavalitsuse nimi → `rawPlace`); madala kindlusega vaste → AMBIGUOUS ja koordinaate EI avaldata (231-251)

### Mida avalik kaart väljastab

`serializeHelpMapEntry` (mapEntries.js:365-426): pealkiri, kirjeldus, kategooria/abi liik/aja tüüp, piirkonnasilt, sihtrühmasildid, `contactMode` (PLATFORM), `privacyNote`, `isOwn` (ainult sisselogitule). **EI väljasta**: kasutaja nime, e-posti, telefoni ega kuulutuse omaniku ID-d. Aadress ainult PHYSICAL-режиiimis (371, 392-393).

---

## A5. Abipakkumine: loomine, privaatsuspiir, avaldamine, kaardil nähtavus

Peegelpilt A4-st sama masinavärgiga:
- `/vestlus?workflow=help_offer` (JourneyDetail.jsx:672)
- `createHelpOffer` → `syncHelpOfferMapEntry` (offers.js:236, 363)
- Väljade erinevus: abisoovil `beneficiaryLabel`+`urgency`, pakkumisel `providerScopeOrConditions` (workflowActions.js:321-323, 349-351); mõlemal `skillsOrBackground`, `compensationDetails`, `conditions`
- Sama privaatsusmudel (AREA, PLATFORM-kontakt, PII-redaktsioon, 45 päeva)
- Kaardil eraldi kirjetüüp `HELP_OFFER`, marker „+" (ServiceMapLeaflet.jsx:618)

---

## A6. Sobituse tegelik loogika

**Sobitus on päriselt implementeeritud** — `lib/help/matches.js`:

### Skoorimudel (rida 5-14)

| Signaal | Kaal |
|---|---|
| põhikategooria täpne kattuvus | 35 |
| omavalitsuse täpne kattuvus | 20 |
| lisakategooriate kattuvus | ≤10 |
| sihtrühmade kattuvus | ≤10 |
| abi vormi (tasuta/tasuline) ühilduvus | 10 |
| aja tüübi ühilduvus | 10 |
| kirjelduste sõnakattuvus (stopp-sõnadega) | ≤10 |
| rollisildi kattuvus | ≤5 |

### Kõvad filtrid (evaluateHardFilters, 304-349)

Mõlemad `OPEN` + aegumata; **erinevad omanikud**; vähemalt üks ühine kategooria; asukohatundlikel kategooriatel (TRANSPORT, DAILY_TASKS, HOME_HELP, CARE_SUPPORT, CHILD_YOUTH_SUPPORT — rida 21-27) sama omavalitsus (või määramata); abi vormi / aja tüübi ühilduvus (MIXED ja FLEXIBLE on jokker, 280-296).

### Pehmed möödalasud

`help_type_incompatible` ja `time_type_incompatible` (16-19) — alternatiivotsing (`listAlternativeOffersForRequest`, 682-708) lubab neid hoiatusega (`requiresConfirmation: true`), sobituse loomisel saab teadlikult üle sõita (`allowSoftFailures`, 800-828).

### Kus sobitus kasutajale paistab

1. **Vestluses pärast salvestust** — `handleBrowseTurn` (workflowActions.js:416-460): top-5 vastet skoori järjekorras, ühilduvuskokkuvõttega; vastete puudumisel alternatiivid hoiatustega. Vastab lubadusele „pärast salvestamist näitab sobivaid vasteid".
2. **Kaardilt** — popup-nupp „Võta ühendust" (ServiceMapLeaflet.jsx:416-429) → `handleConnectHelpMapEntry` (WorkspaceFeaturePage.jsx:3002-3043): laeb kasutaja OMA avatud vastukuulutused (`scope=mine&status=OPEN&limit=20`) ja võtab **`items[0]` — esimese suvalise** (3016) → `POST /api/help/matches`.

⚠️ Kui kasutajal on mitu avatud kuulutust, ei saa ta kaardivoos valida, MILLISEGA ühenduda — vt B5-V4.

### Serveripoolne kaitse

`createHelpMatchAndRoom` (800-893): algataja peab olema ühe poole omanik (817-819); ühilduvus arvutatakse serveris uuesti ja sobimatu paar → `HELP_MATCH_NOT_COMPATIBLE` 409 (826-828; matches/route.js:55); duplikaat (sama paar) taaskasutab olemasolevat matchi+ruumi (830-864).

---

## A7. Ühine vestlusruum sobituse järel

**Ruum avaneb päriselt** — sama transaktsioon loob mõlemad:

- `ensureRoomForMatch` (matches.js:758-798): `Room` pealkirjaga „<soovi pealkiri> - <omavalitsus>", origin `HELP_MATCH`, liikmed: **soovi omanik = OWNER, pakkuja = MEMBER**; seejärel `HelpMatch.roomId` + staatus `CONTACTED` (843-891).
- Klient navigeerib: `buildRoomChatPath(roomId)` → `/vestlus?roomId=<id>&roomKind=help-match` (lib/roomPath.js:3-17; WorkspaceFeaturePage.jsx:3036-3039).
- Ruumi infrastruktuur on täielik: sõnumid + SSE-stream + liikmed + loetud-märgised + kõned (`app/api/rooms/[roomId]/…`, 29 route'i).

⚠️ **Nõusolekuvoog puudub**: `HelpMatchStatus.PENDING/ACCEPTED/DECLINED` on skeemis olemas, aga koodirada paneb alati kohe `CONTACTED` ja lisab teise poole ruumi ilma küsimata. Teine pool avastab ruumi alles oma ruumiloendist. Kas see on teadlik otsus („kontakt = vestlus algab") või poolik consent-mudel — koodist ei tuletu, vt B9-O3.

*(Runtime-tõendus roomId-parameetri töötlemisest /vestlus lehel — vt A12.)*

---

## A13. Kujundusajalugu: vana kuvatõmmis + nelja markeriklassi git-arheoloogia

### Võrdlusalus (kasutaja kuvatõmmis 2026-07-15 03:01)

`C:/Users/rauds/Pictures/Screenshots/Kuvatõmmis 2026-07-15 030157.png` näitab:
- ülariba: tagasi-nool, 2 otsinguvälja („Teenus, kontakt või märksõna", „KOV, asula või maakond"), 3 filtripilli („KOV sotsiaalhoolekanne", „Teenuseosutaja", „Abisoovid ja pakkumised"), ⓘ-nupp
- kaart täidab ülejäänud ala; sinised „K"-nõelad üle Eesti
- legend all vasakul: **K/KOV sinine · Abisoovid oranž · Abipakkumised lilla · T/Teenuseosutaja roheline**

### Git-arheoloogia tulemus

| Commit | Mis juhtus |
|---|---|
| `faf35a40` (05.05), `aceb8197` (19.06) | markeriklasside CSS ajalooliselt olemas |
| `2bf95976` „paljas funktsionaalne platvorm (redesign-prep Fable 5-le)" | **kujundus striptiti** — markerite/kaardi CSS eemaldati; JSX-i klassinimed ja loogika jäid alles (WorkspaceFeaturePage.jsx:48-52 kommentaar „Kujundus stripitud… klassikonstandid on tühjendatud") |
| `64a24eb4` „hämarikuruumi redisain — puhas algus" | uus kujundusbaas |
| `8fb09367` „fix: restore semantic service map markers" (**15.07 03:08, haru `codex/service-map-marker-css`, ka origin'is; POLE main-is**) | +125 rida workspace.css + **visuaal-lepingu test** `tests/serviceMap/markerVisualContract.test.js` |

### Seis aktiivsel main-il

- `ServiceMapLeaflet.jsx` genereerib neli semantilist klassi + tähed: `--kov` „K", `--provider` „T", `--help-request` „?", `--help-offer` „+", segagrupp „KT" (markerClassName/markerLabelText, rida 590-622) ja **legend on JSX-is täielikult olemas** (964-1000).
- **CSS-i neile klassidele main-is EI OLE** (grep üle kõigi .css failide: 0 vastet; `service-map` stiile on ainult layout-kihis `app/styles/workspace.css` 43 + `panel.css` 2 vastet).
- Tagajärg: `divIcon` className on tühi ja pin-SVG `fill`/`stroke` tulevad ainult CSS-ist → markerid renderduvad stiilitult (mustad siluetid, tüübid eristamatud, legend värvitu).

### Taastatud kujunduse sisu (codex-harus, main-i vastu diffitud)

- Neli täidisevärvi + tume ring: KOV `#2f5f8f` (sinine), teenuseosutaja `#168a72` (roheline), abisoov `#b45309` (merevaik), abipakkumine `#a23b72` (magenta), sega `#475569` (slate); graveeritud täht `currentColor`-iga, valge „auk" (`--hole-bg rgba(255,250,244,.78)`)
- CSS-kommentaar fikseerib kontrakti: *„Värv ei kanna tähendust üksi: K = KOV, T = teenuseosutaja, ? = abisoov ja + = abipakkumine"* — **värvitaju eripäraga kasutajale jääb tähemärk esmaseks kandjaks**
- valitud olek = tugevam drop-shadow-hõõg (mitte ainult värvimuutus)
- legendi markerid on sama HTML-i vähendatud koopiad (73%)
- kuvatõmmise värvid klapivad selle CSS-iga 1:1 → kuvatõmmis on tehtud codex-haru taastatud seisuga

Järeldused kujunduslepinguks → B4; mis on veel puudu (klasterdamine, loendivaade) → B5/B6.

---

## A8. Otsing, filtrid, kaardi/listivaate seos

### Andmevoog

Kaardileht laeb KÕIK avaldatud kirjed korraga (`/api/service-map/entries?limit=2000`, WorkspaceFeaturePage.jsx:2897) ja filtreerib **kliendipoolselt** (useMemo, 2919-2968). Server toetab ka `q/municipality/county/type` parameetreid (entriesQueryPolicy.js) ja teenusepoolel mahukat serveripoolset otsingut (serviceProviderProfiles.js:1184-1220), kuid kaardi-UI neid ei kasuta — arhitektuur on „lae kõik, filtreeri mälus".

### Filtrid

1. **Märksõnaväli** — haystack sisaldab pealkirja, kirjeldust, aadressi, kategooriaid, sihtrühmi, vajadusi, teenusekirjete kõiki tekste (ainult PUBLISHED+mapVisible teenused, 2944)
2. **Piirkonnaväli** — omavalitsus/maakond/aadress/teeninduspiirkond, sh teenusekirje-tasemel piirkonnad (2953-2965)
3. **Kirje liigi raadiofiltrid** — 3 valikut: KOV (vaikimisi!), Teenused, Abisoovid ja pakkumised (3078-3096). Eraldi HELP_REQUEST vs HELP_OFFER filtrit UI-s EI OLE (tüübiloogika toetaks, 530-537)

### URL-olek — ühesuunaline

`readInitialServiceMapFilters` (2785-2802) loeb `?type/q/keyword/municipality/county` mount'il, kuid muudatusi EI kirjutata URL-i tagasi → olukorda ei saa jagada ega taastada (sama juurviga, mis Teekonna analüüsis: olek pole URL-is).

### Tulemuste loend

- Renderdatakse AINULT siis, kui märksõna VÕI piirkond on sisestatud (`hasResultFilter`, 3045-3046) — ilma otsinguta loendialternatiivi pole
- Maksimaalselt 56 nuppu (`SERVICE_MAP_RESULT_BUTTON_LIMIT`), ainult pealkirjatekst — kirje TÜÜPI loendis ei näidata
- Klõps → `setSelectedEntryId` → kaart `flyTo` zoom ≥11 + popup (ServiceMapLeaflet.jsx:917-946); mobiilis sulgeb paneeli (2997-3000)
- Filtri muutmine tühistab valiku (2982-2995); valik kaob ka siis, kui kirje filtrist välja jääb (2975-2980)

### Kaart

- Markerid ainult koordinaatidega kirjetele (`mappableEntries`, 2970-2973)
- **Grupeerimine = identsete koordinaatide liitmine** (6 komakohta, ServiceMapLeaflet.jsx:44-78) — mitte kauguspõhine klasterdamine. Tihedad alad (nt Tallinn) jäävad markeripilveks (kuvatõmmisel näha kattuvad K-nõelad)
- Grupipopup: kontaktide loend, igal oma tegevused (502-588)
- Teenuseosutaja mitme teeninduskohaga = mitu kirjet (`splitServiceLocationMapEntries`, lib/serviceProviderServiceLocations.js:75-90), id `<entryId>:location:<locId>`

### Detailvaade = ainult popup

Eraldi detailpaneeli/lehte kaardil EI OLE. Popup sisaldab: teenuseosutajal teenused + saadavus + `accessPath` („Kuidas edasi liikuda?" — esimene samm, otsustaja, hindamis-/suunamisvajadus, allika seis, ametlik allikas; ServiceMapLeaflet.jsx:255-342); abikirjel liik/piirkond/aeg/tasu/sihtrühm + privaatsusmärge + „Võta ühendust".

### Pöördumise ühendus kaardilt — PUUDUB

Popup pakub ainult `mailto:` („Kirjuta") ja veebilinki. **In-app eelpöördumise nuppu popup'is ei ole**, kuigi `/eelpoordumised` oskab `?recipientEntryId=` parameetrit vastu võtta (WorkspaceFeaturePage.jsx:1140-1156). Voog 1 viimane lüli (detailvaade → pöördumine) on seega platvormisiseselt juhtmestamata — kasutaja peab mailto-le lülituma või minema eraldi eelpöördumiste lehele ja adressaadi uuesti otsima.

---

## A9. Rollisõltuvad tegevused

Töölaua kaardid (`lib/workspaceDashboardCards.js:123-330`) + API-väravad annavad maatriksi:

| Tegevus | Pöörduja (CLIENT) | Sotsiaaltöötaja | Teenuseosutaja | Admin |
|---|---|---|---|---|
| Teenusekaardi kaart töölaual | ✅ (koos Teekonnaga, rida 236-239) | ❌ **kaarti pole** | ✅ (rida 178) | rollivaate kaudu |
| `/teenusekaart` leht ise | ✅ kõigil sisselogitutel (URL-iga) | ✅ | ✅ | ✅ + review-eelvaade |
| Abisoovi/abipakkumise loomine (vestlus) | ✅ | ✅ | ✅ | ✅ |
| Kuulutuste sirvimispaneel (vestluses) | ✅ | ✅ | ✅ (töölaual esireas) | ✅ |
| Ühendu kuulutusega (match+ruum) | ✅ kui omab vastaskuulutust | ✅ sama | ✅ sama | sama reegel (peab omama poolt) |
| Teenuseprofiili loomine/avaldamine | ❌ 403 | ❌ 403 | ✅ (paid-gate töölaual, rida 186) | ✅ |
| Eelpöördumise koostamine | ✅ („Eelpöördumine", paid) | ✅ („Pöördumised") | ✅ | ✅ |
| Eelpöördumiste vastuvõtt | ❌ (ainult autor-vaade) | ✅ kui `acceptsPreInquiries` | ✅ kui profiil lubab | ✅ |
| KOV-kirjete haldus | ❌ | ❌ | ❌ | ✅ (sünk-skriptid + review) |

Olulised mehhanismid:
- `normalizeWorkspaceRole` (WorkspaceFeaturePage.jsx:90-93): tundmatu roll → SOCIAL_WORKER
- Admini rollivaate tsükkel (`AdminRoleViewCycleButton`) on ainult pre_inquiries pinnal (4816-4818); kaardipinnale antakse `isAdmin` eraldi (3124-3133)
- Kuulutustepaneeli detail (ChatBody.jsx:1600-1810): võõra kuulutuse juures laetakse kasutaja OMA vastaskuulutused valikuks (`connectOptions`, 1613-1626) — **vestluspaneelis saab valida, millise oma kuulutusega ühenduda; kaardi popup võtab alati esimese** (WorkspaceFeaturePage.jsx:3016)
- Oma kuulutuse muutmine/kustutamine käib samast paneelist (PATCH/DELETE, 1691-1762)

---

## A10. Omanikuõigused ja avaliku/privaatse piir

### Õiguskontrollid (serveripoolsed)

| Ressurss | Lugemine | Muutmine | Kustutamine |
|---|---|---|---|
| Teenuseprofiil | omanik (`ForOwner`) + roll SERVICE_PROVIDER/admin | sama | — (staatus HIDDEN) |
| Kuulutus (help listing) | **iga sisselogitu, ka võõras ja mistahes staatuses** (route.js:129-150 — ei filtreeri staatust ega omanikku) | ainult omanik (166-168) | omanik või admin (199-201) |
| Kuulutuste loend | sisselogitu; `scope=global` **ilma staatusfiltrita tagastab ka võõrad DRAFT/CLOSED/CANCELLED/ARCHIVED** (requests.js:242-278 — status lisatakse where'i ainult kui parameeter antud) | — | — |
| Match | loomine: peab omama üht poolt (matches.js:817-819) | — | — |
| Ruum | ainult liige (`leftAt: null`; messages/route.js:114-155) + arveldusreegel: help-match ruum TASUTA (`HELP_MATCH_FREE`, lib/rooms/access.js) | liige | omanik/lahkumine |
| Eelpöördumine | autor VÕI adressaadi omanik (preInquiries.js:579-581); mutatsioonid vastava poole vastu (695-770) | autor | autor |

### Avaliku info piir kaardil

- Abikirje avalik projektsioon EI sisalda kasutaja identiteeti ega kontakte; kontaktikanal on „Platvormisisene" (mapEntries.js serialize, A4)
- Täpne aadress ainult PHYSICAL+nõusolek; AREA-režiimis geokooditakse üldistatud piirkond
- Teenuseosutaja äri-kontaktid (telefon/e-post/veeb) ON avalikud — äriline info, kooskõlas profiili avaldamisotsusega
- `/api/service-map/entries` on sisselogimata kasutajale kättesaadav (sessioon valikuline) — avalik kaart on teadlik valik; admin-lipud kaitstud

### Leitud piiriaugud (üksikasjad B5-s)

1. Võõra kuulutuse DETAIL on loetav suvalise ID-ga mistahes staatuses (sh mahavõetud/aegunud kuulutused; sisaldab `rawPlace` — kasutaja sisestatud toorasukohta)
2. Globaalne loend lekitab võõraste mitteavalikud staatused (DRAFT/CLOSED/…)
3. Liit-ID (`:location:`) katkestab eelpöördumise INTERNAL-marsruudi vaikselt (preInquiries.js:453-467 + WorkspaceFeaturePage.jsx:1404)

---

## A11. Tühjad olekud, vead, mobiil, klaviatuur, ligipääsetavus

### Tühjad ja laadimisolekud

- Kaart: „Laen Eesti kaarti..." kuni Leaflet valmis (ServiceMapLeaflet.jsx:1001-1005); kirjete laadimise AJAL topbaris indikaatorit EI OLE (loading-olekut ei renderdata; `showResults` on lihtsalt false)
- 0 kirjet → kaart lihtsalt tühi Eesti; et.json `empty`-tekst („Avaldatud kaardikirjed kuvatakse siin markeritena") on defineeritud, aga **seda ei renderdata kusagil**
- Otsing ilma vastuseta → tulemusteriba lihtsalt puudub (mitte „0 tulemust" teadet)
- Kuulutustepaneelil on tühiteade (`emptyText`/`ui.empty`, HelpListingsPanel.jsx:175-179) ✅

### Vead

- Kirjete laadimisviga: `role="status" aria-live="polite"` div (3136-3140) ✅; tõlge enne API-teksti (2900-2901, kommentaar „API message võib olla toores võtmestring")
- Ühendumise vead: kolm eesti fallback-teksti (oma kuulutus / vastaskuulutus puudub / ühendus ebaõnnestus, 3005-3042), **kuid i18n-võtmed puuduvad et.json-ist** — sama kõigil popup'i abikirje-väljadel (help_request/help_offer/connect/own_listing/… — kontrollitud: 11 võtit puudu). UI töötab fallback'idel, EN/RU-lokaadid saavad eestikeelsed tekstid
- Leaflet ebaõnnestumisel: viga staatusekihis (785, 1001-1005) ✅

### Mobiil (max-width 768px)

- Filtripaneel muutub kokkuklapitavaks (`isMobilePanel`, 2878-2889); kirje valik sulgeb paneeli automaatselt (2999)
- Paneeli kõrgus sünkroonitakse CSS-muutujasse `--service-map-panel-height` (2852-2876)
- Toggle-nupp `aria-expanded` + `aria-label` ✅ (3113-3123)

### Klaviatuur ja ligipääsetavus

- Otsinguväljadel `sr-only` sildid ✅ (3061, 3069); liigivalik `role="radiogroup"` + `aria-label` ✅ (3078)
- Leafleti markerid `keyboard: true` (846-853) — fookustatavad, Enter avab popup'i; popup'i tegevused on päris `<button>`/`<a>` elemendid, mille pointer-sündmused on kaardi eest kaitstud (182-199, 214-232)
- Kaardikonteiner `role="application"` + aria-label (958-963); legend `aria-label` (964-967)
- **Kaardi mitte-visuaalne alternatiiv on poolik**: tulemuste loend nõuab sisestatud otsingut; ilma selleta on markerid AINUS sirvimisviis. Loendinupud ei ütle kirje tüüpi ega piirkonda (ainult pealkiri, 3100-3109)
- **Duplikaat-pealkirjade risk**: grupipopup'i kontaktinupud on OK, aga topbari 56 nuppu ilma tüübi/piirkonna vihjeta on ekraanilugejale eristamatud, kui pealkirjad korduvad
- Legend on `aria-hidden` markerite osas + tekstisildid kõrval ✅; markerivärvid + tähed = kahekanaliline kodeering (A13)

---

## A12. Runtime-tõendus (autenditud voog päris testandmetega)

**Meetod:** lokaalne dev-server (`preview_start` next-dev), 3 päris testkasutajat (A/B/C, CLIENT), `LoginTempToken` + NextAuth credentials-callback → päris `session-token` küpsis; abisoov (A, Paide, VOLUNTARY/RECURRING) + abipakkumine (B, Paide, VOLUNTARY/FLEXIBLE) + kinnitamata DRAFT-mustand (A). Geokood simuleeritud MATCHED + Paide koordinaadid (päris geokooder jääks võrgusõltuvusest kõrvale). *NB: esimesel katsel andsid kõik API-d 404 — põhjus oli riknenud `.next` dev-vahemälu; pärast `rm -rf .next` + taaskäivitust töötasid marsruudid ootuspäraselt. See ei ole koodiviga.*

### Tulemused

| Kontroll | Tulemus | Tõend |
|---|---|---|
| Sisselogimine A/B/C | ✅ kõik `session-token` said | `login: {A:true,B:true,C:true}` |
| Kinnitatud kuulutused kaardil | ✅ nii abisoov kui pakkumine nähtavad | `requestOnMap:true, offerOnMap:true` |
| `isOwn` õigsus | ✅ B näeb oma pakkumist `isOwn:true`, võõrast soovi `false` | `offerIsOwnForB:true, requestIsOwnForB:false` |
| **PII kaardil** | ✅ **0 identiteedivälja**; aadress null; privaatsusmärge kaasas | `piiFields:[], requestAddress:"(null)"` |
| Anonüümne kaart | ✅ sisselogimata näeb avalikke kirjeid | `anonMap.status:200, seesEntries:true` |
| Sobitus (B algatab) | ✅ match + ruum loodud, staatus CONTACTED | `match.status:200, roomId:…, matchStatus:"CONTACTED"` |
| Ruum mõlemale poolele | ✅ B postitab, **A näeb B sõnumit** | `aSeesMessage:true` |
| Võõra C tõkestus ruumist | ✅ 403 `api.rooms.access_denied` | `cRead:403` |
| `/vestlus?roomId=…&roomKind=help-match` | ✅ leht laadib (200) | `roomPage.status:200` |
| Minu jagamised | ✅ näitab kuulutust + ruumi | `hasHelpListing:true, hasRoom:true` |
| Rollivärav (CLIENT → teenuseprofiil) | ✅ 403 | `profileRoleGate.status:403` |
| **V1 leke: võõra DRAFT detail** | ❌ **200 + täistekst** kätte | `leakDraftDetail:{status:200, title:"…DRAFT…", gotDescription:true}` |
| **V2 leke: globaalne loend** | ❌ **DRAFT nähtav võõrale**, staatus „Mustand" | `leakGlobalList:{draftVisible:true, statuses:["Mustand","Aktiivne"]}` |

### Markeri-CSS runtime (teenusekaardi leht, `getComputedStyle`)

```
--service-map-marker-fill: (PUUDUB)     ← tühi, CSS-muutujat pole
color: rgb(244, 241, 236)               ← peaaegu valge (päritud), mitte tüübivärv
display: inline                          ← peaks olema grid (taastatud CSS-is)
legendOnPage: true                       ← JSX-legend olemas
markerCountOnMap: 8                       ← markerid renderduvad
```

**Kinnitus A13-le:** markerid renderduvad, aga stiilitult — täidisevärvi muutuja on määramata, seega neli tüüpi on visuaalselt eristamatud ja peaaegu nähtamatud. See on main-i tegelik seis, mitte oletus.

### Kokkuvõte

Mõlema voo tuum töötab **päriselt otsast lõpuni**: loomine → kaardil nähtavus → sobitus → ühine vestlusruum, korrektsete privaatsus- ja ligipääsupiiridega. Kaks tõestatud lekevoogu (V1, V2) ja stiilitud markerid (V-CSS) on ainsad tuvastatud katkised kohad selles runtime-voos — kõik B5-s täpse kooditõendiga.

*(Testandmed kustutatakse dokumendi lõpus, vt A12-lisa.)*

---

# B-osa — süntees

## B1. Kasutaja lubadus vs tegelik aktiivne kood

Alus: `abisoovidjapakkumised_kirjeldus.md` + kahe voo kirjeldus.

| # | Lubadus | Tegelik seis | Hinnang |
|---|---|---|---|
| 1 | „Kirjuta vestluses oma sõnadega, ilma vormita" | Loomine ainult vestluse töövoos; AI ekstraheerib väljad | ✅ täidetud |
| 2 | „Piisab ühest lausest; küsib puuduva üle" | `workflowQuestions/Extraction` küsib kontekstis puuduvat | ✅ täidetud |
| 3 | „Salvestab alles pärast kinnitust" | `saveStructuredRecord` ainult kinnitusintendil; `userConfirmedAt` | ✅ täidetud |
| 4 | „Pärast kinnitamist näed sobivaid vasteid" | `handleBrowseTurn` top-5 skoori järgi + alternatiivid | ✅ täidetud |
| 5 | „Aitab liikuda ühise vestlusaknani" | Match → Room (OWNER+MEMBER) → `/vestlus?roomId=` — **runtime-tõendatud** | ✅ täidetud |
| 6 | „Ühendamine platvormi sees, turvaline" | Ruum tasuta (HELP_MATCH_FREE), liikmepõhine ligipääs, 403 võõrale | ✅ täidetud |
| 7 | „Eristab abi liiki, sihtrühma, asukohta, aega, vormi" | Kategooriad + sihtrühmad + helpType + timeType + piirkond skeemis ja skoorimudelis | ✅ täidetud |
| 8 | Teenusekaart: „Leia KOV kontaktid ja teenuseosutajad kaardilt" | KOV (sünk) + teenuseosutaja (profiil) kirjed kaardil | ⚠️ osaline — **markerite kujundus main-is juhtmestamata** (A13/A12) |
| 9 | Kaardilt pöördumine adressaadini | Popup pakub ainult `mailto`/veeb; in-app eelpöördumise nuppu popup'is EI OLE | ❌ **lünk** — voog 1 viimane lüli katki (A8) |
| 10 | Nelja tüüpi selge eristus kaardil (kuvatõmmis) | JSX loob 4 klassi+tähed+legendi; **CSS eemaldatud main-ist** | ❌ **katki** (A13/A12) |
| 11 | Sobitus „viib soovid ja pakkumised kokku" | Päris skoorimudel + kõvad/pehmed filtrid | ✅ täidetud (aga kaardi-„Võta ühendust" võtab suvalise oma kuulutuse, B5-V4) |

**Kokkuvõte:** vestlus-abivahenduse tuumlubadus (1–7, 11) on koodis päriselt täidetud ja runtime-tõendatud. Teenusekaardi lubadus (8–10) lonkab visuaalse juhtmestuse ja kaardilt-pöördumise puudumise tõttu. Privaatsuslubadus peab avaliku kaardi tasemel (A12), aga lekib omaniku-API tasemel (B5-V1/V2).

---

## B2. Kaks otsast-lõpuni vooskeemi

### Voog 1 — Teenuseprofiil → Teenusekaart → otsing → marker → detail → pöördumine

```
TEENUSEOSUTAJA                         PÖÖRDUJA / SPETSIALIST
──────────────                         ──────────────────────
/teenuseprofiil (roll SP/admin)
  │ organisatsioon + teenused
  │ + teeninduskohad + aadress
  │ (Maaruumi geokood → MATCHED)
  ▼
PUT /api/service-provider/profile
  │ upsertServiceProviderProfileForOwner
  │ deriveServiceMapState:
  │   mapVisible + PUBLISHED + koordinaat
  ▼
ServiceMapEntry status=PUBLISHED ──────────────►  /teenusekaart
                                                    │ GET /api/service-map/entries?limit=2000
                                                    │ (KOV-sünk + teenuseprofiilid + abikirjed)
                                                    ▼
                                                  Otsing + filtrid (KLIENDIPOOLNE)
                                                    │ märksõna / piirkond / 3 liigifiltrit
                                                    ▼
                                                  Marker (ServiceMapLeaflet)
                                                    │ ⚠️ CSS puudub → stiilitu (A13)
                                                    ▼
                                                  Popup-detail (accessPath, teenused, saadavus)
                                                    │
                                                    ├─ „Kirjuta" (mailto) ─────► väline e-post
                                                    ├─ „Veeb" ────────────────► väline sait
                                                    └─ ❌ in-app eelpöördumine PUUDUB popup'is
                                                         (/eelpoordumised?recipientEntryId=
                                                          oskaks vastu võtta, aga linki pole)
```

### Voog 2 — Abisoov/abipakkumine → avaldamine → kaart → sobitus → ühine ruum

```
PÖÖRDUJA A (abisoov)                    PÖÖRDUJA/PAKKUJA B (abipakkumine)
───────────────────                    ─────────────────────────────────
/vestlus?workflow=help_request         /vestlus?workflow=help_offer
  │ vestlus, AI ekstraheerib           │ (peegel)
  │ eelvaade → KINNITUS                 │
  ▼                                     ▼
createHelpRequest (USER,               createHelpOffer
  userConfirmedAt, PII-redakt.)          │
  │ syncHelpRequestMapEntry             │ syncHelpOfferMapEntry
  │  mapMode=AREA, mapVisible=true      │
  │  geokood → MATCHED                  │
  ▼                                     ▼
HelpMapEntry PUBLISHED ────► /teenusekaart marker „?"   marker „+" ◄──── HelpMapEntry
                                    │                                        (privaatsus: piirkond, ei kontakte)
             pärast salvestust      ▼
             vestluses:        handleBrowseTurn (top-5, skoor)
                                    │
   ┌────────────────────────────────┼─────────────────────────────┐
   │ Rada A: vestlusest             │ Rada B: kaardilt popup       │
   │ ChatBody connect               │ „Võta ühendust"              │
   │ (valib OMA kuulutuse) ✅        │ (võtab items[0] ⚠️ B5-V4)    │
   └────────────────────────────────┴─────────────────────────────┘
                                    ▼
                    POST /api/help/matches
                      │ serveripoolne ühilduvuskontroll
                      │ createHelpMatchAndRoom (transaktsioon):
                      │   HelpMatch (CONTACTED, skoor, reasons)
                      │   Room (origin HELP_MATCH)
                      │   RoomMember: A=OWNER, B=MEMBER   ⚠️ ilma nõusolekuta (B9-O3)
                      ▼
          /vestlus?roomId=<id>&roomKind=help-match
                      │ ligipääs: liige + HELP_MATCH_FREE
                      ▼
          ÜHINE VESTLUSRUUM (sõnumid + SSE + kõned)   ✅ runtime-tõendatud (A12)
                      │ võõras C → 403
```

---

## B3. Rollide ja õiguste tabel

| Toiming | CLIENT (pöörduja) | SOCIAL_WORKER | SERVICE_PROVIDER | ADMIN | Jõustus |
|---|---|---|---|---|---|
| Teenusekaardi vaatamine | ✅ | ✅ | ✅ | ✅ + review-eelvaade | leht avalik; `includeNeedsReview` adminile (entriesQueryPolicy.js:13) |
| Töölaua-kaart „Teenusekaart" | ✅ | ❌ puudub | ✅ | rollivaates | workspaceDashboardCards.js:236-239,178 |
| Abisoovi/-pakkumise loomine | ✅ | ✅ | ✅ | ✅ | vestluse töövoog |
| Kuulutuse muutmine | ainult oma | oma | oma | oma | listings/[kind]/[id]:166-168 |
| Kuulutuse kustutamine | oma | oma | oma | oma+**võõras** | :199-201 |
| Sobituse loomine | peab omama poolt | sama | sama | sama | matches.js:817-819 |
| Ühisruumi ligipääs | liige, tasuta | liige | liige | kõik (ADMIN) | rooms/access.js |
| Teenuseprofiili loomine/avaldamine | ❌ 403 | ❌ 403 | ✅ (paid) | ✅ | profile/route.js:27-34 |
| Eelpöördumise koostamine | ✅ | ✅ | ✅ | ✅ | pre-inquiries |
| Eelpöördumise vastuvõtt | ❌ | ✅ (`acceptsPreInquiries`) | ✅ (profiil lubab) | ✅ | preInquiries.js:485-495 |
| KOV-kirjete loomine/haldus | ❌ | ❌ | ❌ | ✅ (sünk-skriptid) | kovMunicipalitySync.js |
| Võõra kuulutuse detail | ⚠️ **kõik loevad iga staatust** | sama | sama | sama | listings/[kind]/[id]:129-150 (B5-V1) |
| Admini rollivaate tsükkel | — | — | — | ✅ ainult pre_inquiries | WorkspaceFeaturePage.jsx:4816 |

---

## B4. Nelja markeritüübi tähendus- ja kujundusleping

Alus: kasutaja kuvatõmmis + codex-haru `8fb09367` taastatud CSS + `ServiceMapLeaflet.jsx` JSX-loogika + värvitaju-nõue.

### Kahekanaliline kodeering (kohustuslik)

Iga marker kannab tähendust **KAHES sõltumatus kanalis**, et värvitaju eripäraga kasutaja saaks tüübi tähemärgist:

| Tüüp | Täht | Värv (täidis) | Ring | Semantika |
|---|---|---|---|---|
| KOV sotsiaalhoolekanne | **K** | sinine `#2f5f8f` | `rgba(22,65,104,.94)` | ametlik esmakontakt |
| Teenuseosutaja | **T** | roheline `#168a72` | `rgba(10,94,77,.96)` | teenus |
| Abisoov | **?** | merevaik `#b45309` | `rgba(146,64,14,.96)` | keegi vajab abi |
| Abipakkumine | **+** | magenta `#a23b72` | `rgba(111,36,78,.96)` | keegi pakub abi |
| Segagrupp | **KT** | slate `#475569` | `rgba(30,41,59,.92)` | eri tüüpi samas punktis |

- Kuju: kaardinõel (SVG path viewBox 0 0 48 60), graveeritud „auk" tähe taga (`rgba(255,250,244,.78)`) → täht loetav ka tumeda täidise peal
- Valik = tugevam drop-shadow-hõõg, **mitte** ainult värvinihe (ligipääsetavus)
- Legend: sama HTML 73% suuruses, tekstisilt kõrval; markeriosa `aria-hidden`
- Kuvatõmmise värvid ühtivad selle lepinguga 1:1 → kuvatõmmis on tehtud taastatud seisuga, mitte praeguse main-iga

### Miks „?" ja „+" (mitte täht)

Abisoov/-pakkumine on tegevused, mitte asutused → sümbol on universaalsem kui täht ja töötab keeltevaheliselt. `?` = küsimus/vajadus, `+` = lisamine/pakkumine. Suurused on tüübiti häälestatud (help-offer „+" 35px, weight 500; help-request „?" 24px) loetavuse pärast.

### Kontrastikontroll (WCAG)

Kõik neli täidisevärvi valge/kreemja „augu" ja graveeritud tähe vastu annavad piisava kontrasti; ring lisab eristuse heleda aluskaardi (Maaameti hallkaart) peal. **Soovitus:** enne juhtmestamist kontrollida täht-vs-täidis kontrastisuhet (siht ≥ 4.5:1) igal neljal värvil — codex-CSS ei dokumenteeri mõõdetud suhteid.

---

## B5. Katkised ühendused ja vead (täpse kooditõendiga)

### TURVALISUS / PRIVAATSUS

**V1 — Võõra kuulutuse detail loetav suvalise ID-ga, mistahes staatuses** · `app/api/help/listings/[kind]/[id]/route.js:129-150`
`GET` laeb kirje `loadRecord(kind, id)` kaudu ega kontrolli EI omanikku EGA staatust; tagastab `title`, `description`, `structuredSummary`, `rawPlace`. **Runtime-tõendatud (A12):** kasutaja B luges kasutaja A kinnitamata DRAFT-mustandi täisteksti (200 + kirjeldus). `rawPlace` on kasutaja sisestatud toorasukoht, mida avalik kaart teadlikult varjab (mapEntries.js:168-175) — siit lekib see redigeerimata.
*Mõju:* iga sisselogitu saab ID-d ära arvates/itereerides lugeda mustandeid, suletud ja aegunud kuulutusi koos toorasukohaga.

**V2 — Globaalne loend lekitab võõraste mitteavalikud staatused** · `lib/help/requests.js:242-278` + `app/api/help/listings/route.js:83-171`
`listHelpRequests` lisab `status` where-tingimuse ainult kui parameeter on antud; `scope=global` ilma staatuseta tagastab KÕIK staatused, sh DRAFT/CLOSED/CANCELLED/ARCHIVED, ka võõrastelt. **Runtime-tõendatud (A12):** B nägi globaalses loendis A DRAFT-i sildiga „Mustand". Avalik kaart näitab ainult PUBLISHED — loend on lõdvem kui kaart.
*Mõju:* mahavõetud/mustand-kuulutused muutuvad võõrastele loetavaks; vastuolus „salvestatakse alles pärast kinnitust" privaatsusootusega.

**V3 — Teeninduskohaga teenuseosutajale eelpöördumise INTERNAL-marsruut katkeb vaikselt** · `lib/serviceProviderServiceLocations.js:49` + `lib/preInquiries.js:453-467` + `WorkspaceFeaturePage.jsx:1404`
Mitme teeninduskohaga (kinnitatud geokood) teenuseosutaja kirjed jagatakse liit-ID-ga `<entryId>:location:<locId>` ja **baaskirje kaob** (splitServiceLocationMapEntries:85 tagastab `[]`). Eelpöördumise UI saadab `recipientEntryId: selectedRecipient?.id` = see liit-ID. Server teeb `serviceMapEntry.findUnique({ where: { id: recipientEntryId } })` → **ei leia** → `recipientOwnerId = null` → `deliveryChannel = "EXTERNAL_EMAIL"`.
*Mõju:* just täieliku profiiliga (mitu teeninduskohta) teenuseosutaja puhul kukub platvormisisene pöördumine vaikselt tagasi väliseks e-postiks; osutaja ei saa seda oma „Pöördumised" vaates. Veateadet ei teki.

### KATKISED ÜHENDUSED

**V4 — Kaardilt „Võta ühendust" võtab suvalise oma kuulutuse** · `WorkspaceFeaturePage.jsx:3011-3023`
`handleConnectHelpMapEntry` laeb `scope=mine&status=OPEN&limit=20` ja kasutab `items[0]` küsimata. Kui kasutajal on mitu avatud vastaskuulutust, seotakse suvaline esimene. Vestluspaneelis (ChatBody.jsx:1613-1626) saab kasutaja valida (`connectOptions`) — kaardil mitte.
*Mõju:* vale kuulutuse sidumine → segane match + ruum; kasutaja ei pruugi arugi saada, milline sooviti.

**V5 — Kaardilt pöördumise lüli puudub (voog 1 katkeb)** · `ServiceMapLeaflet.jsx:473-497` (popup actions) vs `WorkspaceFeaturePage.jsx:1140-1156` (`?recipientEntryId=` tugi olemas)
Teenuseosutaja/KOV popup pakub ainult `mailto:` ja veebilinki. Eelpöördumiste leht OSKAB vastu võtta `recipientEntryId/serviceMapEntryId/entryId` parameetreid ja adressaadi eeltäita, aga **popup ei genereeri sellist linki**.
*Mõju:* „detailvaade → pöördumine" toimub platvormist väljas (mailto) või nõuab adressaadi käsitsi uuesti otsimist eelpöördumiste lehel. Tervikvoo lubadus katkeb.

**V6 — Markerite kujundus main-is juhtmestamata** · `ServiceMapLeaflet.jsx:590-635` (JSX loob klassid) vs 0 CSS-vastet main-i .css-failides
Neli semantilist klassi + tähed + legend on JSX-is; värvi/kuju CSS on ainult codex-harus `8fb09367`. **Runtime-tõendatud (A12):** `--service-map-marker-fill` = tühi, `display:inline`, värv peaaegu valge.
*Mõju:* markerid stiilitud (peaaegu nähtamatud, tüübid eristamatud, legend värvitu). Kaardi põhilubadus visuaalselt katki.

### VÄIKSEMAD / UX

**V7 — i18n-võtmed puuduvad popup'i abikirje-väljadel ja ühendusvigadel** · `messages/et.json` (kontrollitud: 11 võtit puudu — `popup.help_request/help_offer/help_type/time/compensation/target_groups/contact_mode/platform_contact/no_public_contacts/connect/own_listing`) + `errors.own_help_listing/no_counterpart_listing/connect_failed`
UI toimib eestikeelsete fallback-tekstidega (ServiceMapLeaflet.jsx annab fallback'i teise argumendina), aga EN/RU-lokaadid saavad eestikeelse teksti; `i18n:check` võib seda karistada.

**V8 — URL-olek ühesuunaline** · `WorkspaceFeaturePage.jsx:2785-2802` loeb; tagasi ei kirjuta
Otsingut/filtrit/valikut ei saa jagada ega taastada. Sama juurmuster kui Teekonna analüüsis.

**V9 — Tühjad/laadimisolekud poolikud** · kirjete laadimise ajal indikaatorit pole; `empty`-tekst defineeritud (`et.json`), aga renderdamata; „0 tulemust" teadet pole (A11).

**V10 — Ühendumise nõusolek puudub** · `matches.js:840-891` paneb alati `CONTACTED` ja lisab teise poole ruumi ilma tema kinnituseta; `PENDING/ACCEPTED/DECLINED` on skeemis kasutamata. (Tooteotsus, vt B9-O3.)

---

## B6. Puuduva funktsionaalsuse loend

1. **Kaardimarkerite CSS** main-is (või codex-haru `8fb09367` teadlik integreerimine + inim-ülevaatus).
2. **Kaardipopup → in-app eelpöördumine** nupp (`recipientEntryId` linkimine; tugi API-s juba olemas).
3. **Kaardilt „Võta ühendust" kuulutuse valik**, kui kasutajal on mitu vastaskuulutust (V4).
4. **Avalik teenuseosutaja leht** `/teenus/[slug]` — `publicSlug` genereeritakse (serviceProviderProfiles.js:160-164), aga lehte ei eksisteeri; popup on ainus detailvaade.
5. **Kaardi kõrval loendivaade** (praegu ainult otsingu-tingimuslik 56-nupuline riba; ligipääsetav alternatiiv poolik, A11/B7).
6. **Kaugusepõhine klasterdamine** — praegu ainult identsete koordinaatide liitmine; tihedad linnad = markeripilv (A8).
7. **HELP_REQUEST vs HELP_OFFER eraldi filter** kaardil (loogika toetab, UI koondab).
8. **Tühja/0-tulemuse olek** kaardil (`empty`-tekst juhtmestamata).
9. **Match-nõusoleku voog** (PENDING → teine pool ACCEPT/DECLINE) kui toode seda soovib.
10. **Staatuse-/omanikupiir help-listing GET-il ja globaalses loendis** (V1/V2 parandus loeb ka puuduva funktsioonina: „ära lekita mitteavalikke").

---

## B7. Soovitatud tulevane lehehierarhia

```
/teenusekaart  (avalik sirvimine, sisselogimata lubatud)
├── Ülariba: 2 otsinguvälja + 4 liigifiltrit (KOV · Teenused · Abisoovid · Abipakkumised)
│              [praegu 3 filtrit — poolita abi kaheks, sest markerid on nagunii eraldi]
├── Vasak/all: LOENDIVAADE (uus)
│   ├── alati nähtav (mitte ainult otsingul), kaardiga sünkroonis
│   ├── iga rida: TÜÜBIMÄRK (K/T/?/+) + pealkiri + piirkond + lühimeta
│   └── ligipääsetav kaardialternatiiv (A11)
├── Kaart (Leaflet)
│   ├── 4 semantilist markerit + legend (B4)
│   ├── kaugusklasterdamine tihedatel aladel
│   └── popup-detail
│        ├── teenuseosutaja/KOV → accessPath + teenused + saadavus
│        │     └── [UUS] „Alusta pöördumist" → /eelpoordumised?recipientEntryId=…
│        └── abisoov/-pakkumine → privaatsusmärge
│              └── „Võta ühendust" → kuulutuse valik (kui neid mitu) → match+ruum
└── (valik) /teenus/[slug] avalik osutaja detailleht (sügavlink popup'ist)

/teenuseprofiil (roll SERVICE_PROVIDER/admin) — loomine/muutmine/avaldamine
/eelpoordumised — pöördumise koostamine (võtab recipientEntryId vastu)
/vestlus?workflow=help_request|help_offer — kuulutuse loomine
/vestlus?roomId=…&roomKind=help-match — ühine ruum
```

---

## B8. Ruumiline kujundusettepanek

Kooskõlas platvormi „hämarikuruumi" suunaga (redisain-baas `64a24eb4`) ja Teekonna/Heaolu ruumiliste analüüsidega:

- **Kaart = maastik, mitte leht.** Ülariba hõljub klaaskihina kaardi kohal (nagu praegu, `service-map-topbar`); markerid on „valgussambad" maastikul. Aluskaart jääb heledaks (Maaameti hallkaart), markerid kannavad värvi ja hõõgu.
- **Marker kui kahekihiline objekt:** värviline nõel (tüüp) + graveeritud sümbol (tähendus) + valik-hõõg (fookus). Valitud marker tõuseb esile drop-shadow-glow'ga, ei kasuta ainult värvi (B4).
- **Loend ja kaart on üks ruum:** loend on kaardi „sisukord" küljel; rea kohalt liigub fookus kaardil vastavale markerile (`flyTo` on juba olemas). Mobiilis loend liugub alt (dokk-riba muster nagu Heaolu analüüsis).
- **Popup = kohalik süvend, mitte modaal:** ankurdatud markerile, autopan hoiab vaates (praegu juba nii). Pöördumise „Alusta" nupp on süvendi selge esmastegevus.
- **Ligipääsetavus kui esimene klass:** legend + tüübimärgid + loend annavad täieliku mitte-visuaalse tee; klaviatuurifookus liigub loend→marker→popup→tegevus.
- **Ruumiline üleminek** teenusekaardilt eelpöördumisse: sama „ruumist ukse taha" metafoor mis mujal (kaart hägustub, pöördumise ruum tõuseb esile), säilitades adressaadi konteksti.

---

## B9. Tooteotsused, mida koodist tuletada ei saa

- **O1 — Kaardimarkerid: taasta codex-CSS või kujunda uus?** Haru `8fb09367` sisaldab valmis CSS-i + visuaal-kontrakt-testi, aga eelnev mälu (`room-galaxy-background`) hoiatab: kujundust ei tohi pimesi tagasi kopeerida. Otsus: kas integreerida `8fb09367` main-i (kiire, testitud) või kujundada „hämarikuruumi" keeles uus. Nõue: kahekanaliline kodeering (B4) peab säiluma kummalgi juhul.
- **O2 — Kaardilt pöördumine: eelpöördumine vs otse-match?** Teenuseosutaja/KOV puhul on loomulik tee eelpöördumine (`recipientEntryId`); abisoov/-pakkumise puhul otse-match+ruum. Kas ühtlustada üks „alusta kontakti" muster või hoida kaks eraldi? Koodis on mõlemad pooleli erineval moel.
- **O3 — Match = kohe ruum või nõusolek enne?** Praegu tekib ruum ja teine pool lisatakse ilma kinnituseta (V10). Kas „kontakt = vestlus algab kohe" (madal hõõre, praegune) või „PENDING → teine pool nõustub" (kontroll, skeem toetab). Privaatsuse ja hõõrde tasakaal — ärimudeli otsus.
- **O4 — Avalik sisselogimata kaart: kui palju näidata?** Praegu `/api/service-map/entries` on avalik. Kas KOV/teenuseosutaja peaks olema nähtav ilma kontota (avalik teenistus) ja abisoovid/-pakkumised ehk mitte? Praegu näeb anonüümne kõiki avaldatud kirjeid (A12).
- **O5 — Loendivaade: alati või otsingul?** Praegu tulemusteriba ainult otsingul. Kas loend on alati nähtav (parem ligipääs, aga 2000 kirje jõudlus) või lehitsetav/tingimuslik?
- **O6 — Filtrite arv: 3 vs 4?** UI koondab abisoovid+pakkumised üheks filtriks, kuigi markerid on eraldi. Kuvatõmmis näitab „Abisoovid ja pakkumised" ühe pillina. Kas jätta 3 (lihtsam) või 4 (sümmeetriline markerite ja legendiga)?

---

## B10. Järjestatud teostuspaketid

**Reegel:** esmalt turvalisus ja katkised ühendused, siis funktsionaalsus, lõpuks kujundus. Iga pakett lõpeb `npm test` + `npm run i18n:check` (ja DB-muudatusel `npm run db:migrate:check`) rohelisena. Praegu EI teosta — see on plaan.

### Pakett P0 — Turvalisus (BLOKEERIV)
1. **V1:** `GET /api/help/listings/[kind]/[id]` — luba detail ainult omanikule/adminile VÕI ainult avaldatud (OPEN) kirjele; muidu 404. (route.js:129-150)
2. **V2:** `listHelpRequests`/`listHelpOffers` globaalne loend — piira vaikimisi avalikele staatustele (OPEN); mitteavalikud ainult `scope=mine`. (requests.js:242-278, offers.js analoog, listings/route.js:83-171)
3. **V3:** eelpöördumise adressaadi resolver — tükelda liit-ID (`<entryId>:location:<locId>`) enne `serviceMapEntry.findUnique`, või kanna `parentEntryId` UI-st serverisse; taasta INTERNAL-marsruut. (preInquiries.js:453-467, WorkspaceFeaturePage.jsx:1404)
- *Regressioonitestid:* võõras ei loe DRAFT-i; globaalne loend ei sisalda mitteavalikke; teeninduskohaga osutaja pöördumine jääb INTERNAL.

### Pakett P1 — Katkised ühendused
4. **V5:** lisa kaardipopup'i teenuseosutaja/KOV „Alusta pöördumist" → `/eelpoordumised?recipientEntryId=<baasentryId>` (kasuta `parentEntryId` liit-ID puhul). (ServiceMapLeaflet.jsx:473-497)
5. **V4:** kaardilt „Võta ühendust" — kui vastaskuulutusi >1, ava valik (taaskasuta ChatBody connectOptions-mustrit) enne matchi. (WorkspaceFeaturePage.jsx:3011-3023)
6. **V7:** lisa puuduvad i18n-võtmed et/en/ru baasi; `i18n:check` roheliseks.

### Pakett P2 — Funktsionaalsus
7. **V9:** kaardi tühja/0-tulemuse/laadimisolek (juhtmesta `empty`-tekst + laadimisindikaator).
8. **B6-5:** kaardi kõrvale püsiv loendivaade tüübimärkidega (ligipääsetav alternatiiv); sünkroonis kaardiga.
9. **B6-6:** kaugusepõhine klasterdamine tihedatel aladel (marker-cluster või oma lahendus).
10. **B6-7/O6:** eralda HELP_REQUEST/HELP_OFFER filter (kui O6 = 4 filtrit).
11. **O3/V10:** (kui otsustatud) match-nõusoleku voog PENDING→ACCEPT/DECLINE.

### Pakett P3 — Kujundus
12. **V6/O1:** juhtmesta neli markeriklassi + legend (integreeri `8fb09367` VÕI uus „hämarikuruumi" kujundus), säilita kahekanaliline kodeering (B4), lisa visuaal-kontrakt-test, tee inim-ülevaatus.
13. **B8:** ruumiline kaart+loend+popup üleminekud; fookuse liikumine loend→marker→popup.
14. **O4/O5:** avaliku nähtavuse ja loendivaate lõplikud tooteotsused UI-sse.

---

## A12-lisa. Testandmete puhastus

Loodud testandmed **on kustutatud** (kinnitatud). Enne: 3 kasutajat, 2 abisoovi, 1 pakkumine, 1 match, 1 ruum, 6 login-tokenit. `user.deleteMany` kaskaadis (`onDelete: Cascade`: User → HelpRequest/Offer → HelpMapEntry/HelpMatch → Room → RoomMember/RoomMessage → LoginTempToken). Pärast: **0 kasutajat, 0 abisoovi, 0 pakkumist, 0 matchi, 0 ruumi** — orbe ei jäänud. Olemasolevat abikategooriat EI puudutatud (`createdCategory:false`). Ainsad koodivälised kõrvalmõjud: ajutine `.next` vahemälu kustutati (dev-server ehitas uuesti) — rakenduskoodi ei muudetud.

---

## B11. Abivahenduse turvalisuse, nõusoleku ja väärkasutuse mudel

Alus: B-osa tõendid + sihttõendus selle peatüki jaoks. Analüüs, mitte teostus. Iga küsimus saab **ühe soovitatud vaikimudeli** + põhjenduse, miks see sobib tundlikule sotsiaalvaldkonna platvormile, kus üks pool on sageli haavatav abivajaja.

**Läbiv põhimõte (miks range vaikimudel):** SotsiaalAI abivahendus viib kokku *võõraid inimesi* teemadel, mis paljastavad haavatavust (hooldusvajadus, vaimne tervis, vägivallakogemus, toimetulekuraskus, laps/eakas). Sellises kontekstis on õige vaikeseade **nõusolek enne kontakti, minimaalne avalik jälg, selge väljumistee ja platvorm kui tutvustaja — mitte garant**. Iga leevendus vaikest peab olema teadlik tooteotsus, mitte tehniline juhus.

### B11.1 — Nõusolek: kas teine pool saab kohe ruumi liikmeks? (Q1)

**Tegelik seis:** `createHelpMatchAndRoom` (lib/help/matches.js:840-891) paneb matchi kohe `CONTACTED` ja lisab **mõlemad pooled ruumi liikmeks ilma teise poole kinnituseta**; runtime (A12) tõestas, et algataja B sai kohe sõnumi postitada ja A nägi seda. Skeem `HelpMatchStatus.PENDING/ACCEPTED/DECLINED` (schema.prisma:551-557) on olemas, aga **kasutamata**.

**Soovitatud vaikimudel — NÕUSOLEK ENNE (`PENDING → ACCEPT/DECLINE`):**
1. Algataja loob `HelpMatch` staatuses **PENDING**. Ruumi EI looda veel (või luuakse tühjana ainult algatajaga; teist poolt liikmeks EI lisata).
2. Teine pool saab **teavituse** „Keegi soovib sinu [abisooviga/abipakkumisega] ühendust võtta" (vt B11.11) — ilma vestlust avamata.
3. Alles **ACCEPT** teeb matchi `ACCEPTED`, lisab teise poole `RoomMember`-iks ja avab sõnumid. **DECLINE** → `DECLINED`, ruumi ei teki; korduvpäring samale poolele piiratakse (B11.7).
4. Kuni ACCEPT-ini ei näe kumbki pool teise privaatset kontakti ega saa sõnumeid saata.

**Põhjus:** ühepoolne ruumi tekitamine tähendab, et igaüks, kellel on sobiv vastaskuulutus, saab sundida haavatava inimesega privaatkanali ja alustada sõnumeid enne, kui too on nõustunud. Nõusolek-enne annab abivajajale kontrolli, väldib soovimatut kontakti ja kasutab juba olemasolevat enum-i. Madal hõõre ei kaalu üles ohutust, kui üks pool paljastab abivajaduse.

### B11.2 — Kes võib kellele vastata? (Q2)

**Tegelik seis:** vastata saab igaüks, kellel on OMA avatud (`OPEN`) vastaskuulutus (abisoov↔abipakkumine), eri omanik, ühine kategooria (matches.js:304-349); kaardilt „Võta ühendust" võtab `items[0]` (WorkspaceFeaturePage.jsx:3016).

**Soovitatud vaikimudel:**
- **Säilita polaarsus:** abisoovile vastab ainult abipakkumine ja vastupidi. Mitte kunagi soov↔soov ega pakkumine↔pakkumine.
- **Vastajal peab olema päris pandimäng:** kinnitatud (`userConfirmedAt`) vastaskuulutus — see on juba de facto nõue, aga fikseeri lepinguna (B11.13). See tõkestab „drive-by" kontakti ilma oma panuseta.
- **Säilita kõvad filtrid:** eri omanik + ühine kategooria + asukohatundlikel kategooriatel sama KOV.
- **Lisa väravad:** blokeeringu-kontroll (B11.6) ja vastamise rate-limit (B11.7) enne matchi loomist.
- **Kaardilt vastamisel** nõua kuulutuse valikut, kui vastaskuulutusi on >1 (parandab B5-V4).

**Põhjus:** polaarsus + kinnitatud vastaskuulutus hoiab vahenduse sümmeetrilise ja tahtlikuna; ilma selleta muutub kaart kontaktivõtu tööriistaks ühesuunaliselt haavatavate inimeste poole.

### B11.3 — Haavatavad inimesed: alaealised, eakad, sõltuvad (Q3)

**Tegelik seis:** sihtrühmad sisaldavad otseselt „Laps", „Noor", „Eakas inimene", „Puudega inimene", „Sõltuvusprobleemiga inimene", „Vägivalla või kriisiolukorra kogemusega inimene" (WorkspaceFeaturePage.jsx:3196-3213); abivahendus on **vabatahtlike vaheline** (peer-to-peer). Ühtki safeguarding-väravat koodis EI OLE.

**Soovitatud vaikimudel — kaitse-esmasus:**
1. **Ära vahenda järelevalveta füüsilist kohtumist**, kui kuulutuse abisaaja on märgitud alaealiseks või selgelt sõltuvaks/haavatavaks. Sellised kuulutused **ei avaldata automaatselt** → suunatakse admini ülevaatusse (B11.9) ja/või professionaalse/KOV-kontakti rajale, mitte anonüümsele vabatahtlikule.
2. **Nõua konteksti:** kui abisaaja on laps/eakas/sõltuv, peab kuulutuse looma või kinnitama seotud täiskasvanu (lapsevanem/eestkostja/spetsialist) — mustandis on juba `requesterRole` (Inimene ise / Lapsevanem või eestkostja / Lähedane / Spetsialist).
3. **Ohutusteade** kohustuslik enne kontakti: kohtu avalikus kohas, ära anna ette raha/dokumente, kaasa usaldusisik.
4. **Mitte kunagi täpne asukoht** nende kuulutuste puhul (AREA-lukk, B11.5).

**Põhjus:** platvorm tegutseb sotsiaalhoolekande ruumis, kus hoolsuskohustus (duty of care) on eetiline ja juriidiline. Anonüümse vabatahtliku ja alaealise/sõltuva inimese järelevalveta sidumine on lubamatu risk; vaikeseade peab olema „hoia kinni ja vaata üle", mitte „avalda ja looda".

### B11.4 — Avalik vs autenditud andmed kaardil (Q4)

**Tegelik seis:** `/api/service-map/entries` on **avalik** (sessioon valikuline); runtime (A12) tõestas, et sisselogimata kasutaja näeb kõiki avaldatud kirjeid, sh abisoove ja abipakkumisi.

**Soovitatud vaikimudel — kaks nähtavusklassi:**

| Andmeklass | Ilma sisselogimata | Alles pärast autentimist |
|---|---|---|
| KOV sotsiaalhoolekande kontaktid | ✅ avalik (avalik teenistus) | — |
| Teenuseosutaja profiilid (nimi, org-kontakt, teenused, üldistatud piirkond) | ✅ avalik (äriline avalik info) | — |
| **Abisoovid ja abipakkumised (eraisikute kuulutused)** | ❌ **peida** | ✅ ainult sisselogitule |
| Kuulutuse detail (kirjeldus, `rawPlace`) | ❌ | ✅ ainult omanik/match (B5-V1) |

**Põhjus:** avalik-õiguslikud asutused ja ettevõtted on õiguspäraselt avalikud. Eraisiku abivajadus/-pakkumine — ka üldistatuna — võimaldab haavatavate inimeste profileerimist ja on isikuandme-lähedane. Anonüümne juurdepääs peer-kuulutustele (praegune seis) on otsene risk; autentimisnõue tõstab jälitamise/skreipimise künnist ilma avalikku teenistust piiramata.

### B11.5 — Massikogumise, jälitamise ja asukoha tuvastamise riski vähendamine (Q5)

**Tegelik seis:** kaart laeb **kuni 2000 kirjet korraga** kliendipoolseks filtreerimiseks (A8); AREA-režiim üldistab, aga `rawPlace` lekib kuulutuse detailist (B5-V1); entries-endpointil rate-limit'i EI OLE.

**Soovitatud vaikimudel:**
1. **Autentimisnõue peer-kuulutustele** (B11.4) — esimene ja tugevaim kaitse.
2. **Ära „dump'i kõike":** peer-kuulutustele serveripoolne lehekülgede kaupa laadimine + piirkonna-piir; mitte 2000-kirjeline massieksport.
3. **Jämedateralisus AREA-markeritel:** kuva KOV-i tsentroid või geohash-lahter, mitte tegelik koordinaat (isegi kui geokood on täpne). Lisa väike jitter, et markerit ei saaks koordinaadiks tagasi arvutada.
4. **Mitte kunagi `rawPlace`/täpne aadress** üheski kuulutuse-API-s mitte-omanikule (parandab B5-V1).
5. **Rate-limit entries-endpointil** + juurdepääsumustri audit (B11.12).

**Põhjus:** ilma nendeta saab keegi ühe päringuga ehitada haavatavate inimeste kaardi (kes vajab abi, kus, millal). Jämedateralisus + autentimine + rate-limit teevad süstemaatilise jälitamise ebapraktiliseks, säilitades kaardi kasutatavuse.

### B11.6 — Blokeerimine, raporteerimine, kontakti lõpetamine (Q6)

**Tegelik seis:** **ühtki blokeeringu-/raporteerimismudelit EI OLE** (schema-grep: 0 vastet `Block/Report/Abuse/Mute`). Ruumist lahkumine on olemas (`leftAt`), aga **omanik EI SAA lahkuda** („owner_cannot_leave" 409, rooms/[roomId]/leave/route.js:72). „Ruumi lõpetamise" tegevust pole.

**Soovitatud vaikimudel — kohustuslikud ohutusväljapääsud:**
1. **Raporteeri** (kuulutusel JA ruumis/kasutajal): loob moderatsioonikirje; N raportit → kuulutus **automaatselt peidetakse** ülevaatuseni (B11.9).
2. **Blokeeri** (kasutaja tasemel): tõkestab tulevased matchid JA sõnumid **mõlemas suunas**; kontrollitakse enne matchi (B11.2).
3. **Lõpeta kontakt:** kumbki pool — **kaasa arvatud omanik** — saab ruumi sulgeda. Suletud ruum = kirjutuskaitstud, uusi sõnumeid ei teki, audit säilib. Asenda „owner_cannot_leave" reegliga „owner_can_close".

**Põhjus:** ohutusväljapääsud on tundlikul platvormil kohustuslikud, mitte lisavara. Praegu on haavatav omanik lõksus ruumis, kust ta ei saa lahkuda ega mida sulgeda — see on aktiivne kahjurisk. Blokeerimine ja raporteerimine on miinimum, mida iga võõraid siduv platvorm vajab.

### B11.7 — Rate-limit'id, duplikaadi- ja spämmikaitse (Q7)

**Tegelik seis:** ruumisõnumitel on rate-limit (20/min, `ROOM_MESSAGES_POST_RATE_LIMIT_MAX`, messages/route.js:18-19), aga **kuulutuse loomisel, matchi loomisel ega listings-endpointil rate-limit'i EI OLE**. Duplikaadikaitset pole (`@@unique([requestId, offerId])` väldib ainult sama paari topelt-matchi).

**Soovitatud miinimum (taaskasuta `consumeRateLimit`, lib/rate-limit):**

| Tegevus | Miinimumkaitse |
|---|---|
| Abisoovi/-pakkumise loomine | per-kasutaja päevacap + per-IP tunnicap |
| Matchi POST | per-kasutaja-per-sihtmärk cap + globaalne per-tund |
| Kuulutuse detail-GET | per-IP cap (ID-de itereerimise vastu, B5-V1) |
| Entries-endpoint | per-IP cap (skreipimise vastu) |
| Duplikaat-kuulutus | sama kasutaja + kategooria + sarnane tekst akna sees → hoia kinni |

**Põhjus:** ilma nendeta on massiline kuulutamine, massiline matchimine ja ID-de itereerimine triviaalsed. Rate-limit-teek on juba olemas — puudub ainult rakendamine abivahenduse-endpointidel.

### B11.8 — Tasulised ja `MIXED` pakkumised: vältida eksitavat turvatunnet (Q8)

**Tegelik seis:** `helpType VOLUNTARY|PAID|MIXED` (schema.prisma:505-509); `compensationDetails` on vaba tekst; sobitus kohtleb PAID/MIXED tavakuulutusena (MIXED on ühilduvuse jokker, matches.js:280-287). Platvorm **ei töötle makseid** ega kontrolli osutajaid peer-rajal.

**Soovitatud vaikimudel — platvorm on tutvustaja, mitte garant ega maksevahendaja:**
1. **Selge lahtiütlus** iga PAID/MIXED peer-kuulutuse juures: „SotsiaalAI ainult tutvustab pooli. Me ei kontrolli, ei kindlusta ega vahenda makseid. Ära maksa ette."
2. **Visuaalne eristus** + hoiatus PAID/MIXED kuulutustel („raha vahetab omanikku — kohtu turvaliselt, ära maksa ette").
3. **Kaalu peer-PAID piiramist:** tasuline teenus kuulub pigem **kontrollitud teenuseosutaja rajale** (teenuseprofiil, mitte anonüümne peer-kuulutus). Vaikimisi: peer-rada = vabatahtlik/kokkuleppeline; äriline tasuline = teenuseprofiil.
4. **Ära kunagi vihja kontrollile/usaldusele, mida pole** (ei „verifitseeritud", ei „turvaline" märgiseid peer-kuulutustel).

**Põhjus:** niipea kui raha on mängus, loeb kasutaja platvormi maaklerina, kellel on eeldatav usaldus ja vastutus. Sotsiaalvaldkonna tööriistal loob see juriidilise vastutuse ja pettuse-pinna (ettemaksu-pettus haavatavate inimeste vastu). Selge „me ainult tutvustame" hoiab platvormi rollist väljas ja kasutaja valvsana.

### B11.9 — Automaatne peatamine ja admini ülevaatus (Q9)

**Soovitatud vaikimudel — auto-hold (`REVIEW`, mitte `PUBLISHED`), kui:**
1. abisaaja/sihtrühm viitab **alaealisele või kõrge haavatavuse kategooriale** (B11.3);
2. **PAID/MIXED** üle läve või maksekeelega tekstiga (B11.8);
3. **PII jäänuk** (telefon/e-post/isikukood surviva redaktsiooni järel — `redactPersonalData` andis vaste);
4. **N raportit** täis (B11.6);
5. **täpse aadressi opt-in** peer-abisoovil (harv, kõrge risk).

Taaskasuta olemasolevat `NEEDS_REVIEW`/`REVIEW` seisu (ServiceMapEntry ja HelpMapEntry pipeline'is juba olemas). Avaldamine alles admini kinnitusel.

**Põhjus:** safeguarding + pettusetõrje. Pipeline'il on juba review-seis (KOV-kirjed käivad sellest läbi) — sama väravat saab rakendada riskantsetele peer-kuulutustele ilma uut masinavärki ehitamata.

### B11.10 — Aegumine, pikendamine, sulgemine, tagasivõtmine, ruumi lõpetamine (Q10)

**Tegelik seis:** peer-kuulutused aeguvad **45 päeva** (`DEFAULT_EXPIRY_DAYS`, mapEntries.js:6); tagasivõtmine (recall) on ainult eelpöördumistel (`canRecall`, mySharings.js:37-45), **mitte peer-kuulutustel**; ruumil pole sulgemist, omanik ei saa lahkuda (B11.6).

**Soovitatud vaikimudel — täielik elutsükkel omaniku kontrolli all:**
| Seisund | Vaikekäitumine |
|---|---|
| Aegumine | 45 päeva; enne aegumist teavitus + „pikenda" tegevus |
| Pikendamine | omaniku-tegevus, taasavab kaardil |
| Sulgemine/tühistamine | omanik → `CLOSED`; kaardikirje peidetakse, avatud matchid külmutatakse |
| Tagasivõtmine | omaniku algatatud kohene mahavõtmine peer-kuulutuselt (nagu eelpöördumisel) |
| Ruumi lõpetamine | kumbki pool (sh omanik) → ruum kirjutuskaitstud, audit säilib, teine pool saab teavituse |

Kui kuulutus suletakse/aegub, peavad selle avatud matchid liikuma `CLOSED` ja seotud ruumid muutuma kirjutuskaitstuks + teavitus.

**Põhjus:** inimeste vajadused muutuvad; nad peavad saama end tagasi võtta ja kontakti puhtalt lõpetada. Praegu ei saa peer-kuulutust tagasi võtta ega ruumi lõpetada — see lukustab kasutaja olukorda, millest ta tahab väljuda.

### B11.11 — Teavitus enne kontakti/ruumi aktiveerumist (Q11)

**Tegelik seis:** teavitusespetsifikatsioon **`HELP_MATCH_CREATED` on defineeritud** (lib/notifications.js:41-46, `sourceType: "HELP_MATCH"`, `targetKind: "ROOM"`), aga **`createHelpMatchAndRoom` seda EI emiteeri** (matches.js — grep: 0 teavituskutset; API-route samuti mitte). St teine pool lisatakse ruumi **ilma ühegi teavituseta**.

**Soovitatud vaikimudel (koos B11.1 nõusolek-enne mudeliga):**
1. Algataja päring → teine pool saab **enne ruumi aktiveerumist** teavituse: „Keegi soovib sinu [abisooviga/abipakkumisega] ühendust võtta teemal [kategooria]".
2. Teavitus **ei leki privaatset kuulutusesisu** üle selle, mida seotud vastaspool niikuinii näeb (kategooria, üldistatud piirkond — mitte `rawPlace` ega täistekst).
3. Alles **ACCEPT** aktiveerib ruumi ja saadab mõlemale „ühendus loodud" teavituse.
4. **Paranda puuduv emiteerimine** — `HELP_MATCH_CREATED` peab päriselt käivituma.

**Põhjus:** keegi ei tohi avastada, et on võõraga privaatkanalis, ilma eelneva teavituse ja nõusolekuta. Spetsifikatsioon on olemas — puudub ainult käivitamine; see on üheaegselt lünk (Q11) ja nõusolekumudeli (Q1) võti.

### B11.12 — Auditikirjed ilma privaatset sisu dubleerimata (Q12)

**Tegelik seis:** `DataAuditLog` (actorUserId, targetUserId, action, resourceType, resourceId, ipAddress, meta) ja `ChatLog` on olemas (schema.prisma:1402-1432).

**Soovitatud vaikimudel — logi sündmused, mitte sisu:**
- **Logi `DataAuditLog`-i:** match loodud/aktsepteeritud/keeldutud, ruum avatud/suletud, raport esitatud, blokeering seatud, kuulutus auto-peatatud, admini tegevus. Salvesta **ID-d + tegevus + actor/target + minimaalne meta** (kategooriakood, mitte kirjeldustekst).
- **Ära kunagi kopeeri** kuulutuse `description`/`situation`/`rawPlace` auditi `meta`-sse.

**Põhjus:** vastutus ja intsidendiuurimine ilma tundliku isikliku sisu teise koopiat loomata (andmete minimeerimine / GDPR). Olemasolev `DataAuditLog` on juba ID-põhine ja `meta Json?` sobib minimaalsele struktuurmetale — mudel toetab seda juba.

### B11.13 — Minimaalne V0 turvaleping (Q13)

Invariandid, mida **P0/P1 parandused peavad jõustama** (kui üht rikutakse, on see viga, mitte disainivalik):

1. **Nähtavus:** peer-kuulutused (abisoov/abipakkumine) EI OLE sisselogimata kättesaadavad. KOV + teenuseosutaja on avalikud. *(B11.4)*
2. **Kuulutuse detail:** mitteavalikke staatuseid (DRAFT/CLOSED/CANCELLED/ARCHIVED) ja `rawPlace`/täpset aadressi näeb ainult omanik (või seotud match). *(parandab B5-V1/V2)*
3. **Nõusolek:** teine pool ei saa ruumi liikmeks ega sõnumeid enne `ACCEPT`-i. Match algab `PENDING`. *(B11.1)*
4. **Teavitus:** teine pool saab teavituse enne kontakti aktiveerumist; teavitus ei leki täisteksti/`rawPlace`. *(B11.11)*
5. **Polaarsus + panus:** vastata saab ainult vastaskuulutusega (soov↔pakkumine), eri omanik, kinnitatud vastaskuulutus. *(B11.2)*
6. **Väljapääs:** kumbki pool (sh omanik) saab ruumi sulgeda; blokeerimine tõkestab mõlemasuunalise kontakti. *(B11.6)*
7. **Asukoht:** peer-marker on jämedateraline (KOV-tsentroid/geohash), mitte täpne koordinaat; täpset asukohta ei tagastata üheski API-s mitte-omanikule. *(B11.5)*
8. **Auto-hold:** alaealise/kõrge haavatavuse/PAID-üle-läve/PII-jäänuku/raportitud kuulutus ei avaldata automaatselt. *(B11.9)*
9. **Rate-limit:** kuulutuse loomine, matchi loomine, detail-GET ja entries-endpoint on rate-limiteeritud. *(B11.7)*
10. **Roll ≠ garant:** PAID/MIXED peer-kuulutusel on lahtiütlus; platvorm ei töötle makseid ega vihja kontrollimata usaldusele. *(B11.8)*

### B11.14 — Kohustuslikud negatiivsed regressioonitestid (Q14)

Iga test peab **valjult kukkuma**, kui vastav invariant murtakse. Sobib olemasolevasse `node:test` + süstitud fake-prisma raamistikku (`tests/`), API-tasemel testid LoginTempToken-autendusega (nagu A12).

**Nähtavus / privaatsus:**
1. `GET /api/service-map/entries` **ilma sessioonita** EI tohi tagastada ühtki `HELP_REQUEST`/`HELP_OFFER` tüüpi kirjet.
2. `GET /api/help/listings/[kind]/[id]` **võõra** kasutajana DRAFT/CLOSED kirjele → 404/403, mitte 200. *(B5-V1)*
3. `GET /api/help/listings?scope=global` ilma staatusfiltrita EI tohi sisaldada võõraste DRAFT/CLOSED/CANCELLED/ARCHIVED kirjeid. *(B5-V2)*
4. Ükski kuulutuse-API vastus mitte-omanikule EI tohi sisaldada `rawPlace`/täpset aadressi/koordinaati täpsemalt kui KOV-tera.

**Nõusolek / kontakt:**
5. Pärast `POST /api/help/matches` on match `PENDING`; teine pool **EI OLE** `RoomMember` ja tema `GET /rooms/[id]/messages` → 403 kuni ACCEPT.
6. Teine pool ei saa sõnumit postitada enne ACCEPT-i (403).
7. Peale ACCEPT-i saab teine pool ligi; DECLINE järel ruumi ei teki ja korduspäring on piiratud.
8. `HELP_MATCH_CREATED` teavitus **emiteeritakse** teisele poolele matchi loomisel (praegu ei emiteerita — test peab seda nõudma). *(B11.11)*

**Väärkasutus / väljapääs:**
9. Blokeeritud kasutaja `POST /api/help/matches` sihtmärgi vastu → keeldutud; sõnumid mõlemas suunas tõkestatud.
10. Ruumi omanik saab ruumi **sulgeda**; suletud ruumis on `POST messages` → keeldutud mõlemale poolele.
11. Rate-limit: N+1. kuulutuse loomine / matchi loomine akna sees → 429.
12. Sama paari duplikaat-match ei loo teist ruumi (kehtiv `@@unique` säilib); sama kasutaja duplikaat-kuulutus → hoitakse kinni/keeldutakse.

**Haavatavus / roll:**
13. Alaealise sihtrühmaga peer-abisoov EI avaldata automaatselt (`REVIEW`/`HELD`, mitte `PUBLISHED`).
14. PAID/MIXED peer-kuulutuse vastus/vaade sisaldab lahtiütlust; API/EI vasta „verifitseeritud"/„turvaline" atribuutidega.

**Auditi minimeerimine:**
15. `DataAuditLog` kirje match/room/report tegevusest EI tohi sisaldada kuulutuse `description`/`situation`/`rawPlace` teksti (ainult ID-d + kategooriakood).

---

**B11 kokkuvõte:** soovitatud vaikimudel on **nõusolek-enne, autenditud peer-nähtavus, jämedateraline asukoht, kohustuslikud väljapääsud ja platvorm-kui-tutvustaja**. See ei ole maksimalistlik — see on miinimum, mida haavatavaid võõraid siduv sotsiaalvaldkonna platvorm vajab, et mitte ise muutuda kahju-, pettuse- ega jälitamisvahendiks. Suur osa vundamendist on koodis juba olemas, aga juhtmestamata: `PENDING/ACCEPTED/DECLINED` enum (kasutamata), `HELP_MATCH_CREATED` teavitus (ei emiteerita), `DataAuditLog` (ID-põhine), `REVIEW`-seis (KOV-rajal olemas). V0 leping (B11.13) jõustab need P0/P1 sees; negatiivsed testid (B11.14) hoiavad neid murdumast.

---

## B9-lisa. O1–O6 soovitatud vaikeotsused

B9 esitas tooteotsused lahtiste küsimustena. Siin on iga otsuse **soovitatud vaikeseade** — kooskõlas B11 turvamudeli ja B10 teostuspakettidega. Need on lähtekohad, mille tellija saab kinnitada või tagasi lükata; ei ole uus analüüs.

| # | Otsus | Soovitatud vaikeseade | Miks | Seos |
|---|---|---|---|---|
| **O1** | Markerid: taasta codex-CSS või kujunda uus? | **Integreeri codex-haru `8fb09367` CSS main-i**; hilisem „hämarikuruumi" ümberkujundus eraldi hilisem samm | Kiire, testitud (visuaal-kontrakt-test kaasas), kuvatõmmisega 1:1; kahekanaliline kodeering peab säiluma | B4, B10-P3 |
| **O2** | Kaardilt kontakt: eelpöördumine vs otse-match? | **Kaks rada tüübi järgi:** KOV/teenuseosutaja → eelpöördumine (`recipientEntryId`); abisoov/-pakkumine → otse-match nõusolekuga | Eri adressaaditüübid, eri loomulik tee; mõlemad rajad juba pooleli koodis | B5-V5, B11.1 |
| **O3** | Match = kohe ruum või nõusolek enne? | **Nõusolek-enne: `PENDING → ACCEPT/DECLINE`** | Haavatava poole kaitse; enum juba olemas, kasutamata | B11.1, B11.11 |
| **O4** | Avalik sisselogimata kaart: kui palju? | **Kaks klassi:** KOV + teenuseosutaja avalik; **peer-kuulutused ainult autenditule** | Avalik teenistus/äri vs eraisiku abivajadus (isikuandme-lähedane) | B11.4, B11.5 |
| **O5** | Loendivaade: alati või otsingul? | **Alati nähtav** (ligipääsetav alternatiiv), aga **serveripoolse lehekülgede/piiriga** peer-kuulutustele | A11y nõue + skreipimiskaitse („ära dump'i kõike") | A11, B6-5, B11.5 |
| **O6** | Filtreid 3 vs 4? | **4 filtrit:** KOV · Teenused · Abisoovid · Abipakkumised | Markerid on nagunii eraldi; abisoov ≠ abipakkumine on kasutajale eri kavatsus | A8, B6-7 |

---

STATUS: COMPLETE
