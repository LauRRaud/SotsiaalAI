# SotsiaalAI platvormiloogika ülevaade

Kuupäev: 12.07.2026
Koostaja: Fable 5 (lähteülesanne: [fable-5-platvormi-loogika-brief.md](./fable-5-platvormi-loogika-brief.md))
Meetod: aktiivse koodi kontroll (marsruudid, API-d, Prisma skeem, komponendid, testid), seejärel dokumentide [ideed.md](./ideed.md), [ruumilise-kogemuse-lahtekoht.md](./ruumilise-kogemuse-lahtekoht.md), [funktsioonide-ja-ux-kaardistus.md](./funktsioonide-ja-ux-kaardistus.md) ja [lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md](./lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md) võrdlus. `docs/audits` kausta ei kasutatud tõeallikana.

Märgistus soovituste juures: **[FAKT]** = aktiivsest koodist kontrollitud; **[JÄRELDUS]** = faktidest tuletatud hinnang; **[ETTEPANEK]** = tooteotsust eeldav soovitus.

---

## 1. Juhtkokkuvõte

1. **Pöörduja põhirada töötab serveris otsast lõpuni.** Vestlus → Teekonna mustand → salvestatud Teekond → kasutaja valitud väljavõttega eelpöördumise eeltäide → eelpöördumise koostamine koos privaatsuse eelkontrolliga → sisemine või e-posti saatmine → spetsialisti vastuvõtutöövoog (märkmed, kontrollnimekiri) → ühine vestlusruum. Iga samm on API-s ja andmemudelis olemas ning kasutaja kinnitusega. Nõrgim koht ei ole funktsionaalsus, vaid **jälgitavus**: Teekonna ja eelpöördumise seos ei salvestu, tagasilingid puuduvad.
2. **Kogukonnarada töötab.** Abisoov/abipakkumine (vestlustöövoona) → avaldamine → sobitusskoor → HelpMatch → automaatne ühine ruum, mis on osalejaile tellimuseta tasuta. Teenuseosutaja rada (profiil → Teenusekaart → pöördumine) töötab, sh profiili sünk RAG-i.
3. **Suurim katkestus on Kovisioon.** Andmekiht (8 mudelit, ~16 API-marsruuti, kõned, kokkuvõtted, parimad praktikad koos RAG-sünkiga) on täielik, kuid **ükski komponent ei kutsu enam ühtegi `/api/covision` marsruuti**. `/kovisioon` renderdab 8-etapilise lõuendi demoandmetega. Sama kehtib Teemaseemnete kohta (ainult lokaalne olek). Tööheaolu „kovisiooni sisend" lõpeb navigeerimisega lehele, mis sisendit vastu ei võta.
4. **Kontseptsioonid, mida koodis ei ole:** Juhtumitöö assistent, Meetodipeegel, Supervisioon, võrgustikutöö kui moodul, ESTA (mitte ühtegi rida), STAR2 ülekandmise olekud. STAR2 mustandi *genereerimine* on olemas (`STAR_HELPER` artefakt), elutsükkel mitte.
5. **Privaatsuspiirid on üldiselt serveris jõustatud** (rollipiirded, k-anonüümsus, anonüümsuse kinnitus, privaatsuse eelkontroll, kasutusarvestus). Peamised augud on väikesed: ruumi seose hoidmine kirjelduse tekstis ning kasutuseta „surnud" olekud.
6. **Soovitus:** enne uute moodulite ehitamist parandada olemasolevate ühenduste püsivus ja tagasiside (P0-kava ptk 9) ning teha esimeseks vertikaalseks lõiguks **Vestlus → Teekond → eelpöördumine** tervikluskihi lõpetamine (ptk 10). Häälvestluse režiim on eraldiseisev väike pakett (ptk 8), mis ei sõltu ülejäänud kavast.

---

## 2. Aktiivse platvormi rolli- ja moodulikaart

### 2.1. Rollid ja õiguste mehhanismid

**[FAKT]** Andmebaasis on neli rolli: `ADMIN`, `SOCIAL_WORKER`, `SERVICE_PROVIDER`, `CLIENT` ([schema.prisma:12](../prisma/schema.prisma)) ning eraldi lipp `User.isAdmin` (schema:560). Serveripoolne rollituletus on koondatud [lib/authz.js](../lib/authz.js):

- `roleFromSession` / `normalizeRole` — admin normaliseeritakse sisuvaadetes `SOCIAL_WORKER`-iks (authz.js:18–24);
- `resolveSessionRoleState` — admin saab küpsisega vahetada vaaterolli (`adminViewRole`, [lib/adminViewRole.js](../lib/adminViewRole.js), UI [components/workspace/AdminRoleViewCycleButton.jsx](../components/workspace/AdminRoleViewCycleButton.jsx));
- `requireSubscription` — kõik kolm põhirolli vajavad aktiivset tellimust; admin mitte (authz.js:64–105).

**[FAKT]** Briefi mõistes „lisatiitli/võimekuse" mehhanismi eellased on juba olemas võimekuslippudena, mitte uute kasutajagruppidena:

| Võimekus | Väli | Kontrollikoht |
|---|---|---|
| Võtab vastu platvormisiseseid eelpöördumisi | `User.acceptsPreInquiries` (schema:565) | `resolveRecipient` ([lib/preInquiries.js:454–472](../lib/preInquiries.js)) |
| Teenusekaardil nähtav | `ServiceProviderProfile.mapVisible`, `status` (schema:1533, 1537) | `listPublishedServiceMapEntries` |
| Assistent tohib soovitada | `ServiceProviderProfile.assistantRecommendationAllowed` (schema:1536) | RAG-sünk ([lib/serviceProviderProfiles.js:455+](../lib/serviceProviderProfiles.js)) |
| Tööheaolu koondi vaataja | `WellbeingPilotViewer` (schema:1194) | [lib/wellbeing/pilotAccess.js](../lib/wellbeing/pilotAccess.js) |
| Ruumi roll | `RoomMember.role` OWNER/MODERATOR/MEMBER (schema:126–130) | kutsete marsruudid |
| Kovisiooni roll | `CovisionParticipantRole` (OWNER/PARTICIPANT/OBSERVER/CO_MODERATOR/SUMMARY_REVIEWER, schema:350–356) | [lib/covision.js](../lib/covision.js) |

**[JÄRELDUS]** Üldist tiitliregistrit (superviisor, KOV-juht, ESTA liige) koodis ei ole; iga võimekus on praegu punktlahendus. See on kooskõlas briefi nõudega mitte luua uusi põhikasutajagruppe, kuid tähendab, et iga uus tiitel nõuab praegu uut ad hoc välja.

**[FAKT]** ESTA-d ei esine aktiivses koodis üheski vormis (grep üle `app`, `components`, `lib`, `prisma` — 0 sisulist vastet). Kõik ESTA-ga seotud osad on staatusega **kontseptsioon** (ideed.md ptk 25–27).

### 2.2. Moodulikaart

| Moodul | Leht/vaade | API | Andmemudelid | Serveripoolne rollipiire | Seis |
|---|---|---|---|---|---|
| Vestlus + RAG | `app/vestlus/page.js`, [ChatBody.jsx](../components/alalehed/ChatBody.jsx) | `POST /api/chat` (SSE-voog, [route.js:360](../app/api/chat/route.js)), `/api/chat/run`, `/api/chat/conversations/*`, `/api/rag/[...path]` | `Conversation`, `ConversationMessage` | sisselogitud + tellimus | töötab |
| Teekond | `app/teekond`, [JourneyDashboard/Detail](../components/journey/JourneyDashboard.jsx) | `/api/journeys`, `/draft`, `/[id]`, `/[id]/pre-inquiry-draft` | `Journey` (schema:1096) | ainult omanik | töötab |
| Eelpöördumine | `app/eelpoordumised`, [WorkspaceFeaturePage.jsx](../components/workspace/WorkspaceFeaturePage.jsx) | `/api/pre-inquiries` + `assist`, `send`, `accept`, `workflow`, `room`, `covision`, `preferences` | `PreInquiry` (schema:1706) | autor/adressaat ([lib/preInquiries.js:537–544](../lib/preInquiries.js)) | töötab |
| Abisoovid/-pakkumised | vestluse töövoog + loendid ([HelpListingsPanel](../components/chat/HelpListingsPanel.jsx)) | `/api/help/listings`, `/api/help/matches` | `HelpRequest/Offer/MapEntry/Match` (schema:1965–2156) | omanik; sobitus ainult osapool ([lib/help/matches.js:817](../lib/help/matches.js)) | töötab |
| Ruumid + kõned | `app/ruum`, `app/room/[roomId]`, [RoomsPage](../components/rooms/RoomsPage.jsx) | `/api/rooms/*` (sh `messages/stream` SSE, `calls/*`, salvestuse nõusolek) | `Room`, `RoomMember`, `RoomMessage`, `Invite`, `CallSession` + salvestusmudelid (schema:2158–2390) | liikmesus + ruumi-billing ([lib/rooms/access.js](../lib/rooms/access.js)) | töötab |
| Dokumendid | `app/documents`, [DocumentsPage](../components/documents/DocumentsPage.jsx) | `/api/documents/*` (sh `transcribe`, `summary`, `meeting-summary/jobs`) | `UserDocument`, `TranscriptionJob`, `DocumentAudit` (schema:2392–2533) | omanik + rollipõhised limiidid | töötab |
| Dokumendi koostamine | `app/dokreziim`, [AgentModePage](../components/agent/AgentModePage.jsx) | `/api/documents/artifacts/*` | `AgentArtifact` (11 tüüpi, sh `STAR_HELPER`; schema:509–526) | CLIENT: 3 ülesannet, 2 lähtefaili ([artifacts.js:47](../lib/documents/artifacts.js), [AgentModePage.jsx:39–41](../components/agent/AgentModePage.jsx)) | töötab |
| Tööheaolu | `app/tooheaolu`, 10 töövoogu ([components/wellbeing](../components/wellbeing)) | `/api/wellbeing/*` (13 marsruuti) | `WellbeingRecord`, `WellbeingOutputDraft`, `WellbeingPilotScope/Viewer` (schema:1122–1208) | ainult SOCIAL_WORKER + tellimus ([app/api/wellbeing/_shared.js:21–51](../app/api/wellbeing/_shared.js), [wellbeingTools.js:119–122](../lib/wellbeingTools.js)) | töötab |
| Kovisioon (andmekiht) | — | `/api/covision/*` (~16 marsruuti: juhtumid, sõnumid, kõned, sõnavõtusoovid, kokkuvõte, assist, parimad praktikad) | `CovisionCase` + 7 seotud mudelit (schema:1742–1922) | SOCIAL_WORKER/SERVICE_PROVIDER/admin ([lib/covision.js:409–421](../lib/covision.js)) | töötab, aga **UI-ta** |
| Kovisioon (lõuend) | `app/kovisioon` → [CovisionSession.jsx](../components/covision/CovisionSession.jsx) | ei kutsu ühtegi API-t | demoandmed (CovisionSession.jsx:33–85) | lehe tasemel rollipiire ([app/kovisioon/page.jsx:34](../app/kovisioon/page.jsx)) | UI-demo |
| Teemaseemned | `app/teemaseemned` → [TeemaseemnedPage.jsx](../components/teemaseeme/TeemaseemnedPage.jsx) | ei kutsu ühtegi API-t | `DEMO_SEEDS`, lokaalne olek (read 20, 87, 173) | lehe tasemel | UI-demo |
| Teenuseprofiil | `app/teenuseprofiil` | `/api/service-provider/profile` | `ServiceProviderProfile` + teenused + asukohad (schema:1509–1663) | omanik (üks profiil kasutaja kohta, schema:1552) | töötab |
| Teenusekaart | `app/teenusekaart`, [ServiceMapLeaflet](../components/workspace/ServiceMapLeaflet.jsx) | `/api/service-map/entries` | `ServiceMapEntry` + `HelpMapEntry` | avaldatud kirjed; REVIEW ainult adminile ([entries/route.js:20–22](../app/api/service-map/entries/route.js)) | töötab |
| Materjalid | `app/materjalid` | `/api/materials/*` | `MaterialSubmission` (schema:2535) | esitaja + admini ülevaatus ([lib/materials/submissions.js](../lib/materials/submissions.js)) | töötab |
| STT/TTS | vestluse mikrofon/kõlar ([useSpeech.js](../components/chat/hooks/useSpeech.js)) | `/api/stt`, `/api/tts` | kasutusarvestus `STT_SECONDS`/`TTS_CHARS` (schema:26–36) | sisselogitud + tellimus + rate-limit | töötab (dikteerimine + ettelugemine) |
| Süvauuring | vestluse tööriist | `/api/research/jobs/*` (sh SSE) | `ResearchJob` (schema:1332) | tellimus + kasutusarvestus | töötab |
| Kutsed („Lisa inimene") | [InviteModal](../components/invite/InviteModal.jsx) | `/api/invites/*` (sh sponsoreeritud makse) | `Invite`, `Subscription` (sponsorväljad) | ruumi OWNER/MODERATOR ([invites/route.js:445–452](../app/api/invites/route.js)) | töötab |
| Admin: RAG, analüütika, kinnitused, tööheaolu koond | `app/admin/*` | `/api/admin/*` | RAG-, KOV-, organisatsiooni- jm mudelid | `assertAdmin` | töötab |

**[FAKT]** Navigatsioon: peakarussell (ruumid, töölaud, vestlus, profiil, + admini haldus) ja Töölaua alamkarussell on defineeritud [RoomStage.jsx:898–980](../components/room/RoomStage.jsx); rollipõhised Töölaua kaardid [lib/workspaceDashboardCards.js:124–353](../lib/workspaceDashboardCards.js). Rollide erinevus UI-s: CLIENT näeb Teekonda ja eelpöördumist, ei näe Kovisiooni/Tööheaolu/Materjale; SOCIAL_WORKER näeb Kovisiooni, Tööheaolu, Materjale, Pöördumisi; SERVICE_PROVIDER näeb Teenuseprofiili, ei näe Kovisiooni kaarti (kuigi API seda lubaks — vt ptk 6.3).

---

## 3. Funktsioonigraaf

Servade tähised: `██` töötab otsast lõpuni · `▓▓` osaliselt töötab · `░░` ainult UI/demo · `··` ainult kontseptsioon.

```text
                              ┌────────────┐
        ┌──────██────────────►│  Teekond   │──██ (shareKeys-eeltäide) ──┐
        │                     └────────────┘                            ▼
┌───────┴────┐                                                   ┌──────────────┐      ┌──────────────────┐
│  Vestlus   │───██ abisoovi/abipakkumise töövoog ──┐             │ Eelpöördumine│──██─►│ Vastuvõtt (SW/SP)│
│  (RAG+SSE) │───██ dokumenditöövoog → dokreziim    │             └──┬───────┬───┘      └───────┬──────────┘
└───────┬────┘───██ süvauuring                      ▼                │       │                  │
        │                                    ┌────────────┐         ██      ██                 ██
        ██ (teadmusbaas: allikad)            │ Abisoov /  │         │       │                  │
        ▲                                    │ Abipakkumine│         ▼       ▼                  ▼
        │                                    └─────┬──────┘   e-post välja  Kovisiooni     ┌─────────┐
┌───────┴─────────┐                                ██              (SMTP)   juhtumi mustand│  Ruum   │
│  Teadmusbaas    │◄──██ Parimad praktikad          ▼                       (API olemas,   │ +kõned  │
│  (RAG-teenus)   │   (PUBLISHED → ingest)    ┌───────────┐                  UI puudub ░░)  │ +salvest│
│                 │◄──██ Teenuseprofiil       │ HelpMatch │───██ tasuta ruum ──────────────►└────┬────┘
│                 │◄──██ Materjalid (admin)   └───────────┘                                      │
└─────────────────┘                                                                              ██
                                                                                                 ▼
┌──────────────┐    ░░ (ainult navigeerimine /kovisioon)                                 salvestus → transkript
│  Tööheaolu   │──────────────────────────────►┌──────────────────┐                      → artefakt (STAR_HELPER,
│ (privaatne)  │──██ k-anonüümne koond (admin) │ Kovisiooni lõuend │                        MEETING_SUMMARY …)
└──────────────┘                               │  (demo ░░)        │
                                               └──────────────────┘
       ·· Juhtumitöö assistent   ·· Meetodipeegel   ·· Supervisioon   ·· Võrgustikutöö moodul   ·· ESTA
```

**[FAKT]** Kovisiooni andmekihi enda sisemised servad (juhtum → osalejad/kutse-e-kirjad → sõnumid → kõned → kokkuvõte → parim praktika → RAG) on serveris terviklikud ([lib/covision.js](../lib/covision.js), [app/api/covision/*](../app/api/covision)), kuid graafis „ripuvad õhus", sest UI-servad nende juurde puuduvad.

---

## 4. Ühenduste valmidustabel

### 4.1. Põhjalik kontroll (briefi ptk 7 väljad)

**A. Vestlus → Teekond — töötab otsast lõpuni**

| Väli | Leid |
|---|---|
| Lähtekoht | Vestluse „journey" töövoog, [ChatBody.jsx:2116–2145](../components/alalehed/ChatBody.jsx) |
| Sihtkoht | Sama kasutaja privaatne Teekond (`/teekond/[id]`) |
| Käivitaja | Kasutaja käsklus vestluses; salvestus eraldi kinnituskäsuga (`isJourneySaveCommand`) |
| Üleantav objekt | Uus struktureeritud mustand (`buildJourneyDraft`), mitte vestluse koopia |
| Eelvaade | Jah — mustand kuvatakse vestluses enne salvestamist |
| Õigused | Sessioon; `Journey.ownerUserId` = kasutaja ([lib/journey/service.js:49–62](../lib/journey/service.js)) |
| Püsivus | `POST /api/journeys` → Prisma; mustandifaas ei salvestu (`persisted:false`, [draft/route.js:39–43](../app/api/journeys/draft/route.js)) |
| Vastuvõtt | JourneyDashboard/Detail kuvab ja lubab muuta |
| Tagasiside | Vestlusesse tuleb kinnitus + link salvestatud Teekonnale |
| Elutsükkel | `JourneyStatus` DRAFT/ACTIVE/ARCHIVED (schema:294) |

**B. Teekond → eelpöördumine — osaliselt töötab** (funktsionaalselt terve, jälgitavuseta)

| Väli | Leid |
|---|---|
| Lähtekoht | JourneyDetail „Koosta eelpöördumine" → `/eelpoordumised?fromJourney=<id>&share=…` |
| Sihtkoht | Sama kasutaja eelpöördumise vorm ([WorkspaceFeaturePage.jsx:1046–1121](../components/workspace/WorkspaceFeaturePage.jsx)) |
| Käivitaja | Kasutaja; jagatavad osad valitakse `shareKeys`-iga (nt `assistiveDevices`) |
| Üleantav objekt | Minimaalne väljavõte-eeltäide ([preInquiryHandoff.js:99–168](../lib/journey/preInquiryHandoff.js)), mitte Teekonna koopia |
| Eelvaade | Jah — vorm on eeltäidetud, kasutaja toimetab enne salvestust |
| Õigused | `getJourneyForUser` kontrollib omanikku |
| Püsivus | **Puudulik:** eeltäide ei salvestu (`persisted:false`); `sourceJourneyId` tekib prefill'i (rida 153), kuid `createPreInquiry` seda ei salvesta — `PreInquiry`-l pole Teekonna viidet (schema:1706–1740) |
| Vastuvõtt | Eelpöördumise vorm võtab vastu; `sharedJourneyInfo` salvestub `assessmentState` sisse |
| Tagasiside | **Puudub:** Teekond ei saa teada, et eelpöördumine loodi; `linkedPreInquiryIds` on ainult lugev UI-väli ([JourneyDetail.jsx:369–373](../components/journey/JourneyDetail.jsx)), mida ükski kood ei kirjuta |
| Elutsükkel | Eelpöördumise oma; seos kaob |

**C. Eelpöördumine → saatmine → vastuvõtt — töötab otsast lõpuni**

| Väli | Leid |
|---|---|
| Lähtekoht | Eelpöördumise vorm (kolm algusviisi: vaba tekst, kaardistus, Teekonnast) |
| Sihtkoht | INTERNAL: adressaadi `Pöördumised` vaade (sama leht, saaja roll); EXTERNAL_EMAIL: päris e-kiri ([sendExternalPreInquiry, lib/preInquiries.js:748–813](../lib/preInquiries.js)) |
| Käivitaja | Kasutaja salvestab/saadab; enne salvestust privaatsuse eelkontroll (`evaluatePreInquiryPrivacy`, 409-kinnitusvoog) |
| Üleantav objekt | Kasutaja toimetatud mustand (`userEditedDraft`) + hindamisseis |
| Eelvaade | Jah — genereeritud ja toimetatav mustand enne saatmist |
| Õigused | Adressaadituvastus: platvormisisene ainult siis, kui saaja on lubanud (`acceptsPreInquiries` või teenuseosutaja `acceptsPlatformPreInquiries`; [resolveRecipient:425–483](../lib/preInquiries.js)); nähtavus ainult autor/adressaat |
| Püsivus | Prisma `PreInquiry`; e-postiga saatmisel `sentAt` + `externalSendConfirmedAt` |
| Vastuvõtt | Saaja töövoog: kinnita (`accept` → READY), märkmed + kontrollnimekiri (`updatePreInquiryReceiverWorkflow:718–746`) |
| Tagasiside | Autor näeb staatust loendis; **eraldi teavitust (e-kiri/märguanne) sisemise pöördumise saabumisel ei ole** |
| Elutsükkel | DRAFT→READY→SENT→ARCHIVED; **`DOWNLOADED` on surnud olek** — defineeritud (lib/preInquiries.js:32) ja kuvatav (WorkspaceFeaturePage.jsx:465), kuid mitte kunagi määratav |

**D. Eelpöördumine → ühine ruum — töötab otsast lõpuni**

| Väli | Leid |
|---|---|
| Lähtekoht/käivitaja | Autor või adressaat vajutab „Ava ruum" ([pre-inquiries/[id]/room/route.js:42–135](../app/api/pre-inquiries/[id]/room/route.js)) |
| Sihtkoht | Uus `Room` mõlema osapoolega; nõuab platvormisisest adressaati (409 muidu) |
| Üleantav objekt | Ainult viide (ruumi pealkiri teemast); pöördumise sisu ruumi ei kopeerita |
| Õigused | `getVisiblePreInquiry` + autor/adressaat kontroll |
| Püsivus | Prisma; kordusavamisel taaskasutatakse olemasolevat ruumi |
| Puudus | Dedup otsib markerit `preInquiry:<id>` ruumi **kirjelduse tekstist** (route.js:65–77), kuigi samas tehingus salvestatakse korrektsed `originType/originId` väljad (schema:2163–2164) — vt ptk 5 |
| Elutsükkel | Ruumi oma (liikmed, lahkumine, sõnumid, kõned) |

**E. Abisoov + abipakkumine → sobitus → ruum — töötab otsast lõpuni**

| Väli | Leid |
|---|---|
| Lähtekoht | Loendivaade / vestlusest tulnud kuulutus |
| Käivitaja | Osapool (ainult soovi või pakkumise omanik, [matches.js:817–819](../lib/help/matches.js)) |
| Üleantav objekt | `HelpMatch` + skoor + põhjendused; ruum mõlema osapoolega ühes tehingus (`ensureRoomForMatch`) |
| Õigused | Sobivuskontroll (`calculateMatchScore`), mittevastavus → 409 |
| Püsivus | Prisma (`@@unique([requestId, offerId])` väldib duplikaate) |
| Vastuvõtt | Ruum on kohe kasutatav; **sobitusruum on tellimuseta tasuta** (`HELP_MATCH_FREE`, [lib/rooms/access.js:21–26](../lib/rooms/access.js)) |
| Elutsükkel | `HelpMatchStatus` PENDING→CONTACTED→ACCEPTED/DECLINED/CLOSED |

**F. Tööheaolu → Kovisioon — ainult kasutajaliides**

| Väli | Leid |
|---|---|
| Lähtekoht | Tööheaolu töövoo „Koosta kovisiooni sisend" ([SupportRequestPanel.jsx:17–22](../components/wellbeing/SupportRequestPanel.jsx)) |
| Üleantav objekt | Üldistatud tekst genereeritakse ja salvestatakse (`WellbeingOutputDraft`, `outputType: covision_input`; [supportDrafts.js:93–128](../lib/wellbeing/supportDrafts.js)); kasutaja peab kinnitama (`userReviewed`+`userConfirmed`) |
| Katkestus | Nupp „Ava olemasolevas Kovisioonis" ainult **navigeerib** `/kovisioon` (SupportRequestPanel.jsx:204–208). Kovisioon ei loe `WellbeingOutputDraft`e (grep: 0 vastet components/covision all) ja demolõuend ei võta sisendit vastu. Mustand jääb kasutatavaks ainult copy-paste'iga |
| Positiivne | Privaatsuspiir on õige: toorkirjeid ei anta edasi, ainult kinnitatud üldistus |

**G. Kovisioon → kokkuvõte → parim praktika → teadmusbaas — server töötab, UI puudub**

| Väli | Leid |
|---|---|
| Server | `CovisionSummary` (schema:1871), `EffectivePractice` staatusevoog DRAFT→ANONYMITY_CHECK→REVIEW→PUBLISHED (schema:394–401); PUBLISHED sünkroonitakse RAG-i, tagasivõtmisel kustutatakse ([lib/covision.js:580–659](../lib/covision.js)) |
| Puudus | Mitte ükski komponent ei kutsu neid marsruute; karusselli kaart „Parimad praktikad" viib lihtsalt `/kovisioon` ([RoomStage.jsx:950](../components/room/RoomStage.jsx)) — **näiline ühendus** |
| Spetsifikatsioon | Eraldi lehe detailne spec on olemas: [Kovisioon/Uus leht-parimad-praktikad-pohileht-ja-loogika.md](../Kovisioon/Uus%20leht-parimad-praktikad-pohileht-ja-loogika.md) |

**H. Kõne → salvestus → transkript → artefakt — töötab otsast lõpuni (ruumides)**

| Väli | Leid |
|---|---|
| Ahel | Ruumikõne (LiveKit/mock, [lib/calls/service.js:43–55](../lib/calls/service.js)) → salvestustaotlus eesmärgiga (sh `STAR_HELPER`) → **kõigi osalejate nõusolek** (consent-tekst versioonitud, service.js:97–107) → fail `UserDocument` (CALL_AUDIO_RECORDING) → `TranscriptionJob` → transkript → kokkuvõtte/artefakti genereerimine eraldi kasutajatoiminguna |
| Õigused | Nõusolek per osaleja (`CallRecordingConsent`), auditijälg (`DocumentAudit`) |
| Märkus | Sama taristu on Kovisiooni kõnedele valmis (`CallContextType.COVISION`, schema:137–143), aga UI-ta |

### 4.2. Ülejäänud servade koondtabel

| # | Ühendus | Hinnang | Tõend | Peamine puudus |
|---|---|---|---|---|
| 1 | Vestlus → RAG-allikatega vastus (rollipõhine audience) | töötab | [lib/chat/ragContext.js](../lib/chat/ragContext.js), `Audience` enum schema:107 | — |
| 2 | Vestlus → dokumenditöövoog → artefakt | töötab | [lib/chat/workflowBranchHandlers.js](../lib/chat/workflowBranchHandlers.js), [documentOrchestration.js](../lib/chat/documentOrchestration.js) | — |
| 3 | Vestlus → abisoovi/abipakkumise töövoog | töötab | [lib/help/chatWorkflow.js](../lib/help/chatWorkflow.js), testid [tests/help/chatWorkflow.test.js](../tests/help/chatWorkflow.test.js) | — |
| 4 | Vestlus → süvauuring | töötab | `/api/research/jobs` + SSE | roomides keelatud (teadlik) |
| 5 | Teekond → Teenusekaart (filtritega suunamine) | töötab | [lib/journey/serviceMapHandoff.js](../lib/journey/serviceMapHandoff.js) | viidet ei salvestata |
| 6 | Teekond → abisoov (jagamispaneel) | töötab | [JourneyDetail.jsx:468–520](../components/journey/JourneyDetail.jsx), [helpMediationHandoff.js](../lib/journey/helpMediationHandoff.js) | viidet ei salvestata |
| 7 | Teekond → tervishoiukontakti küsimuste mustand | töötab (mustand) | [lib/journey/healthContact.js](../lib/journey/healthContact.js) | teadlikult ainult tekstimustand |
| 8 | Eelpöördumine → Kovisiooni juhtumi mustand | server valmis, UI puudub | [pre-inquiries/[id]/covision/route.js](../app/api/pre-inquiries/[id]/covision/route.js), `buildCaseFromPreInquiryDraft` + anonüümsusprobleemide tuvastus (lib/covision.js:1023+) | ükski komponent ei kutsu |
| 9 | Teenuseprofiil → Teenusekaart | töötab | profiili avaldamine → `ServiceMapEntry` sünk, testid [tests/serviceMap](../tests/serviceMap) | — |
| 10 | Teenuseprofiil → RAG (assistendi soovitus) | töötab | [serviceProviderProfiles.js:455–530](../lib/serviceProviderProfiles.js), test `ragServiceMapSync.test.js` | — |
| 11 | Teenusekaart → eelpöördumine (kontakt eeltäidetud) | töötab | `?recipientEntryId=` eeltäide (WorkspaceFeaturePage.jsx:1123–1139) | — |
| 12 | Materjal → ülevaatus → teadmusbaas | osaliselt | esitus + ülevaatus töötab ([lib/materials/submissions.js](../lib/materials/submissions.js)); staatus `imported` eeldab admini käsitsi RAG-ingesti | otseühendust ülevaatusest ingestini pole |
| 13 | Dokumendid → heli üleslaadimine → transkript → kokkuvõte | töötab | `/api/documents/[id]/transcribe`, `meeting-summary/jobs`, [lib/documents/audioWorkflow.js](../lib/documents/audioWorkflow.js) | — |
| 14 | „Lisa inimene" → kutse → ruum (+ sponsoreeritud tellimus) | töötab | [invites/route.js:386+](../app/api/invites/route.js), `sponsored/init|callback` | — |
| 15 | Tööheaolu → k-anonüümne koond (piloot/admin) | töötab | [aggregate.js:114–146](../lib/wellbeing/aggregate.js) (suppression), 24 testi [tests/wellbeing](../tests/wellbeing) | — |
| 16 | Kovisiooni lõuend (8 etappi) ↔ andmekiht | UI-demo | CovisionSession.jsx demoandmed; 0 API-kutset | kogu sidumine puudub |
| 17 | Teemaseemned ↔ Kovisioon (seeme → sessiooni juhtum) | UI-demo | TeemaseemnedPage lokaalne olek; spec [Kovisioon/uue-kovisiooni-funktsiooni-visioon…](../Kovisioon/uue-kovisiooni-funktsiooni-visioon-ja-8-etapiline-selgroog.md) | mudelit pole |
| 18 | Juhtumitöö assistent (STAR2 mustand + ülekandeolek) | kontseptsioon | ainult `STAR_HELPER` genereerimine ([generation.js:83–84,114](../lib/documents/generation.js)); `AgentArtifactStatus` on ainult DRAFT/FINAL (schema:523–526), STAR2-viidet/ülekandeolekut pole | ideed.md ptk 4, 12 |
| 19 | Meetodipeegel | kontseptsioon | 0 koodivastet | ideed.md ptk 8 |
| 20 | Supervisioon | kontseptsioon | ainult sildid tööheaolu adressaadiloendis ([displayLabels.js:113](../lib/wellbeing/displayLabels.js)) | ideed.md ptk 22–23 |
| 21 | Võrgustikutöö moodul (kaart, kokkulepped, DisclosureGrant) | kontseptsioon | substraat olemas (Room/Invite/CallSession), moodulit pole | ideed.md ptk 5, 12 |
| 22 | ESTA liikmeala / liikmesus / foorum | kontseptsioon | 0 koodivastet | ideed.md ptk 25–27; ainult kavandatav partnerlus |

---

## 5. Dubleerimised ja tupikteed

### 5.1. Dubleerimised

1. **Kovisiooni kaks elu.** Andmepõhine Kovisioon (`/api/covision/*` + 8 Prisma mudelit) ja demolõuend ([CovisionSession.jsx](../components/covision/CovisionSession.jsx)) kirjeldavad sama töövoogu kaks korda: lõuendi „juhtumipilt/kokkulepped/etapid" vs andmekihi `CovisionJourneyStep`/`CovisionMessage` tüübid/`CovisionSummary` väljad. Kummalgi pool on mõisteid, mida teisel pole (lõuendil etapid 1–8 ja rollivaated; andmekihil kõned ja sõnavõtusoovid). **[JÄRELDUS]** Kuni sidumisotsust pole, kasvab iga lõuendi iteratsiooniga ümberkirjutamise hind.
2. **Ruumi päritolu kaks salvestusviisi.** `Room.originType/originId/originMeta` (schema:2163–2166; [lib/rooms/origin.js](../lib/rooms/origin.js)) ja tekstimarker `preInquiry:<id>` kirjelduses; dedup-otsing kasutab hapramat teksti ([room/route.js:66–70](../app/api/pre-inquiries/[id]/room/route.js)).
3. **Teekonna seoseväljade topeltloogika.** Prefill toodab `sourceJourneyId` ([preInquiryHandoff.js:153](../lib/journey/preInquiryHandoff.js)), mida ei salvestata; JourneyDetail loeb `linkedPreInquiryIds/linkedHelpRequestIds/…` context-JSON-ist, mida ükski kirjutaja ei täida. Kaks poolikut mehhanismi sama seose jaoks.
4. **`ConversationRun` vs `Conversation`.** `ConversationRun` (schema:1052) on aktiivsest vestlusteest väljas — seda kasutavad ainult [lib/retention.js](../lib/retention.js) ja admin-reset. **[JÄRELDUS]** pärandmudel, mis väärib kas eemaldamist või selget märgistust.
5. **Kaks „praktikate" sihtkohta.** Karussellis viivad nii „Kovisiooni ruum" kui „Parimad praktikad" samale `/kovisioon` lehele (RoomStage.jsx:948–950), kuigi andmekihis on `EffectivePractice` eraldi objekt ja spetsifikatsioonis eraldi leht.

### 5.2. Tupikteed ja näilised ühendused

| # | Koht | Probleem | Tõend |
|---|---|---|---|
| 1 | Tööheaolu `covision_input` | Kinnitatud mustand jääb seisma; sihtleht ei võta vastu | SupportRequestPanel.jsx:204–208; grep components/covision → 0 |
| 2 | „Parimad praktikad" kaart | Lubab sisu, mida leht ei kuva (demolõuend) | RoomStage.jsx:950 |
| 3 | `PreInquiryStatus.DOWNLOADED` | Olek eksisteerib, üleminek puudub (PDF-i/allalaadimise voog ehitamata) | lib/preInquiries.js:32; setter puudub (grep) |
| 4 | Eelpöördumine → Kovisioon server-marsruut | Väärtuslik valmis ühendus ilma ühegi UI-nuputa — „nähtamatu ühendus" (vastupidine näilisele) | app/api/pre-inquiries/[id]/covision/route.js |
| 5 | Kovisiooni kõned + sõnavõtusoovid | Täielik API ilma UI-ta | app/api/covision/[id]/calls/* |
| 6 | `AgentArtifactType.STAR_HELPER` | Mustand genereerub, aga „STAR2-sse kantud" elutsükkel puudub — kasutaja jaoks lõpeb rada DOCX/PDF allalaadimisega | AgentModePage.jsx:575–581; schema:523–526 |
| 7 | Teemaseemnete kaardid | Salvestuvad ainult sessiooni mällu; värskendus kaotab töö | TeemaseemnedPage.jsx:173 |
| 8 | Sisemise eelpöördumise saabumine | Adressaat saab teada ainult lehte avades; teavituskiht puudub | pre-inquiries marsruudid; e-kiri ainult EXTERNAL_EMAIL kanalil |

---

## 6. Privaatsus- ja õiguste piirid

### 6.1. Serveris jõustatud (kooskõlas briefi ptk 8 otsustega)

- **Teekond on rangelt privaatne:** `JourneySharingStatus` sisaldab ainult `PRIVATE` (schema:300–302); jagamine toimub ainult väljavõtte-eeltäitena, mille kasutaja üle vaatab. **[FAKT]**
- **Tööheaolu:** ainult SOCIAL_WORKER pääseb ligi (`canUseWellbeingRole`); koondvaated summutatakse alla miinimumgrupi (`suppressed`, aggregate.js:140–146; vaikimisi väärtus + `WELLBEING_MIN_GROUP_SIZE`); pilootvaatajad on eksplitsiitne lubatud-nimekiri; väljundmustand nõuab `userReviewed` + `userConfirmed`. Toorkirjeid ei anta ühelegi teisele funktsioonile. **[FAKT]**
- **Kovisiooni andmekiht:** juhtumi loomine nõuab anonüümsuse kinnitust (`anonymityConfirmed_required`, lib/covision.js:366–368); eelpöördumisest mustandi tegemisel tuvastatakse anonüümsusprobleemid; parim praktika läheb RAG-i alles PUBLISHED-staatuses ja eemaldatakse RAG-ist tagasivõtmisel. **[FAKT]**
- **Eelpöördumine:** privaatsuse eelkontroll (eesti reeglitega PII-filter, [lib/privacy/privacyGuard.js](../lib/privacy/privacyGuard.js), eraldi `POST /api/privacy/check`) nõuab 409-kinnituse kaudu kasutaja teadlikku otsust; nähtavus rangelt autor+adressaat; SENT-olekus muutmine keelatud. **[FAKT]**
- **Kõnesalvestus:** iga osaleja individuaalne nõusolek versioonitud tekstiga; transkriptsioon ja kokkuvõte on eraldi kasutajatoimingud, mitte automaatika (lib/calls/service.js:104). **[FAKT]**
- **STAR2 piir:** koodis ei looda ühtegi ametlikku juhtumiplaani objekti; ainus STAR-viide on abistav mustand ja hoiatustekst „Eelkaardistus … ei ole STAR2 hindamise asendaja" ([preInquiriesAssessment.js:202](../lib/preInquiriesAssessment.js)). **[FAKT]**
- **Kustutamine/retentsioon:** `DataDeletionJob`, `maybeRunRetentionCleanup` (authz.js:65), auditilogid (`DataAuditLog`, `DocumentAudit`). **[FAKT]**

### 6.2. Ainult UI-s eeldatud või puuduvad piirid

1. **Kovisiooni demolõuendil pole andmepiire, sest pole andmeid** — aga see tähendab ka, et lõuendi „konfidentsiaalsuse kokkulepped" (CovisionSession.jsx:88–97) on praegu ainult tekst. Sidumisel tuleb iga lõuendi element viia serveri õiguste alla (osaleja roll, `SUMMARY_REVIEWER` jne on andmekihis juba olemas). **[JÄRELDUS]**
2. **Ruumi dedup kirjeldusteksti kaudu** võib pöördumise ruumi siduda vale ruumiga, kui kirjeldust muudetakse või marker satub mujale; `originType/originId` on olemas, kuid mitte unikaalsuspiiranguga. **[JÄRELDUS]**
3. **Teavituse puudumine** tähendab, et sisemise pöördumise SLA sõltub sellest, kas adressaat lehte avab; privaatsusriski pole, aga vastuvõtupiir on praktikas nõrk. **[JÄRELDUS]**

### 6.3. Rollide ja serveripiirete sümmeetria

| Koht | Asümmeetria | Hinnang |
|---|---|---|
| Kovisioon | API lubab SERVICE_PROVIDER-it (lib/covision.js:409–413), Töölaud/karussell ei paku teenuseosutajale Kovisiooni sissepääsu (workspaceDashboardCards.js:159–233) | teadlik otsus vajalik: kas teenuseosutaja kuulub kovisiooni sihtrühma? |
| Dokumendid | CLIENT ei näe „Dokumendid" kaarti, kuid `/documents` marsruut ja API on rollile avatud (piiratud ülesannetega) | korras, aga dokumenteerimata |
| Admin | `normalizeRole` teisendab admini sisuvaadetes SOCIAL_WORKER-iks; admin möödub tellimusepiirdest (authz.js:76–81) | ootuspärane |
| Teekond | Rollipiiret pole (iga roll võib Teekondi luua; `roleContext` väli olemas) | kooskõlas briefiga (pöörduja tööriist, aga ei blokeeri teisi) |

---

## 7. Soovitatud sihtarhitektuur

### 7.1. Tööobjektid ja üleandmiste ühine muster

**[FAKT]** Koodis on juba välja kujunenud korduv ja hea üleandmismuster: *lähteobjekt → kasutaja valitud väljavõte → eelvaade → kinnitus → uus sihtobjekt, algne jääb puutumata*. Seda rakendavad `preInquiryHandoff` (shareKeys), `WellbeingOutputDraft` (review+confirm), `buildCaseFromPreInquiryDraft` (anonüümsuskontrolliga) ja kõnesalvestuse nõusolekuvoog. See vastab täpselt ideed.md ptk 29 otsustusreeglile.

**[ETTEPANEK]** Standardiseerida see kolme elemendiga, ilma suure refaktoorimiseta:

1. **Seosekirje.** Iga üleandmine jätab püsiva, minimaalse jälje. Kaks võimalust: (a) sihtobjektile FK-veerg (nagu `CovisionCase.sourcePreInquiryId` — juba olemas ja töötab) või (b) üldine `WorkObjectLink { sourceType, sourceId, targetType, targetId, sharedKeys, createdByUserId, createdAt }` tabel. Soovitan (a) põhipaaridele, mille elutsükkel on oluline (PreInquiry.sourceJourneyId, Room.originId juba olemas), ja (b) alles siis, kui paare tekib >5.
2. **Üleandmise serialiseering.** Üks jagatud helper (`lib/handoff.js`), mis toodab `{ sourceType, sourceId, sharedKeys, preview }` ja mille iga handoff-lib (journey→preinquiry, wellbeing→covision, preinquiry→covision) taaskasutab. Praegu on igal oma kuju.
3. **Tagasiside-invariant.** Iga üleandmise järel peab lähtevaade suutma kuvada „loodud X" — see nõuab ainult seosekirje olemasolu ja ühte loendipäringut.

### 7.2. Jagatud taristu, lahus andmesisu (Kovisioon, Supervisioon, ruumid)

**[FAKT]** Taristu on juba jagatav: `CallSession.contextType` toetab ROOM ja COVISION konteksti (schema:137–143); kutsed, sõnumid, SSE, salvestus ja nõusolek on ruumides tööle rakendatud; kovisioonil on oma paralleelsed mudelid (`CovisionMessage`, `CovisionParticipant`), mis **ei jaga** ruumide andmesisu — see on õige suund.

**[ETTEPANEK]** Supervisioon (kui see kunagi ehitatakse) peaks järgima sama mustrit: uus `contextType` + oma juhtumi/kokkuvõtte objekt, taaskasutades kõne-, kutse- ja nõusolekutaristut. Mitte ehitada kolmandat sõnumisüsteemi.

### 7.3. Kovisiooni sidumine (kriitilisim arhitektuuriotsus)

**[JÄRELDUS]** Demolõuend ja andmekiht on ühendatavad ilma skeemimuudatusteta esimeses sammus: lõuendi „juhtumi kinnitamine" (etapp 1) = `CovisionCase` DRAFT→ACTIVE; „ühine pilt" (etapp 2) = `CovisionJourneyStep`/`CovisionParty`; küsimused/võimalused (etapid 3–5) = `CovisionMessage` tüübid QUESTION/NEXT_STEP/EXPERIENCE; kokkuvõte (etapp 8) = `CovisionSummary` väljad. Ainus päriselt puuduv mõiste on **etapi kursor** (mis etapis sessioon on) — see mahub `CovisionCase`-i ühe veeru või `context`-JSON-ina.

**[ETTEPANEK]** Teemaseemned = kovisiooni juhtumite eeltuba: seeme on `CovisionCase` staatuses DRAFT koos `topics/tags`-iga; „seemnest sessiooniks" = staatusemuutus. See väldib kolmanda juhtumiobjekti loomist (spec-failides kirjeldatud „teemaseeme" ja „lõpetatud juhtum" on sama objekti elutsükli otsad: DRAFT → ACTIVE → SUMMARY_READY → CLOSED → ARCHIVED, mis kõik on skeemas juba olemas, schema:337–343).

### 7.4. Tiitlid ja võimekused

**[ETTEPANEK]** Kui esimene päris tiitel (nt kontrollitud superviisor või ESTA liige) muutub aktuaalseks, lisada üks tabel `UserCapability { userId, type, grantedBy, verifiedAt, validUntil, organizationRef }` ja server-helper `hasCapability(userId, type)`. Mitte lisada rolle `Role` enumisse. ESTA-spetsiifiline osa peab olema funktsioonilipuga välja lülitatav, sest partnerlus on kinnitamata (brief ptk 2.1). Ühegi võimekusega ei tohi kaasneda ligipääs privaatsetele andmeruumidele (Tööheaolu, Teekond, Supervisiooni sisu) — see piir on täna koodis olemas ja peab jääma.

### 7.5. STAR2 mustandi elutsükkel

**[ETTEPANEK]** Ideed.md ptk 4.5 olekud saab lisada ilma paralleelregistrita: `AgentArtifact.metadata` JSON-i väljad `transferStatus` (draft / needs_client_check / verified / ready / transferred / not_transferred), `transferredAt`, `star2Reference` (vabateksti viitenumber). Nupp „Kopeeri STAR2 jaoks" + käsitsi oleku märkimine. Mitte lisada `CasePlan`-laadseid tabeleid enne tooteotsuseid (ptk 11, küsimused 1–4).

### 7.6. Interaktiivsuse mudelite paigutus (briefi ülesanne 11)

| Kiht | Kandidaat | Hinnang esimese MVP suhtes |
|---|---|---|
| Brauseris lokaalne | MediaPipe näpistus + pea asend (Teemaseemnete katserežiim) | sobiv prototüübiks, **mitte** MVP-sse; nõuab klaviatuurialternatiivi (mis lõuendil juba osaliselt on) |
| Brauseris lokaalne | Energia-läve VAD (olemas: `useSpeech` helimõõdik, useSpeech.js:302–323) → hiljem Silero VAD (wasm) | esimene häälvestluse versioon saab hakkama olemasoleva mõõdikuga; Silero on täiendus |
| SotsiaalAI serveris | Whisper STT — **liidesekoht on juba olemas**: `/api/stt` kasutab `STT_SERVER_URL` välise teenusena, OpenAI on fallback (stt/route.js:22–24, 180–213) | isemajutatud Whisperi vahetus = konfiguratsioonimuudatus, mitte arendus |
| SotsiaalAI serveris | TTS — Google/OpenAI juba serveris (tts/route.js:25–26, 102–144); eesti keel läheb serveri kaudu, en/ru brauseri sünteesiga (useSpeech.js:178–183) | olemas |
| Serveris | Tesseract `est` OCR, Presidio-laadne PII-eelkontroll | PII-reeglid on juba olemas eesti reeglitega ([lib/privacy/piiFilter.js](../lib/privacy/piiFilter.js)); OCR lisada alles dokumendivoo vajadusel |
| Ei kuulu MVP-sse | äratussõna, speech-to-speech reaalajasessioon, pilgujuhtimine, emotsioonituvastus (viimane on ka dokumentides keelatud) | kooskõlas lokaalsed-mudelid.md ptk 14 |

---

## 8. Eestikeelse häälvestluse väikseim muudatuspakett (briefi ülesanne 12)

### 8.1. Olemasolevad komponendid **[FAKT]**

| Osa | Asukoht | Seis |
|---|---|---|
| Mikrofon + salvestus | `useSpeech.handleMic` ([useSpeech.js:324–443](../components/chat/hooks/useSpeech.js)); MediaRecorder + WAV-fallback; helitaseme mõõdik vaikuse tuvastuseks (:249, :302–323) | töötab (dikteerimine) |
| STT | `POST /api/stt` — väline server (`STT_SERVER_URL`) või OpenAI; kasutusarvestus `STT_SECONDS`; rate-limit | töötab |
| Transkripti sisestus | `processRecordingBlob` → `onAppendText` lisab teksti sisestusvälja; **kasutaja saadab ise** | töötab (kontrollitud dikteerimine briefi tähenduses) |
| Sõnumi saatmine | ChatBody → `POST /api/chat` ([app/api/chat/route.js:360](../app/api/chat/route.js)) | töötab |
| RAG + voogvastus | `handleMainChatResponse` SSE ([mainResponseHandler.js:788, 991](../lib/chat/mainResponseHandler.js)); allikad `displayed_sources` metaandmetes | töötab |
| Ettelugemine | `speakText` → `POST /api/tts` (et) või brauserisüntees (en/ru); käivitub ainult kõlarinupust (useSpeech.js:170–216) | töötab (käsitsi) |

### 8.2. Väikseim muudatuspakett **[ETTEPANEK]**

Serveripoolseid muudatusi **ei ole vaja** — kogu pakett on klientkihi sessiooniloogika:

1. **`useVoiceSession` hook** (uus, ~1 fail): olekumasin `idle → listening → understood → searching → speaking → paused`, mis vastab dokumendi olekutele „Kuulan / Sain aru / Otsin allikatest / Vastan / Peatatud" (lokaalsed-mudelid.md ptk 7.4).
2. **Kõnevooru lõpu tuvastus:** taaskasutada `useSpeech`-i helimõõdikut — N sekundit taset alla läve → peata salvestus → saada `/api/stt`. (Silero VAD wasm on hilisem täpsustus, mitte eeldus.)
3. **Automaatne saatmine:** transkript ei lähe sisestusvälja, vaid otse olemasolevasse saatmisfunktsiooni (sama tee, mida kasutab tekstisõnum; workflow-režiimides häälvestlus keelata).
4. **Automaatne ettelugemine:** SSE-vastuse lõpetumisel kutsuda olemasolev `speakText(latestAiText)`. Allikaid ette ei loeta — `speakText` loeb ainult vastuse teksti, allikakaardid jäävad ekraanile (praegune käitumine juba vastab nõudele).
5. **Vahelerääkimine:** kui mikrofoni tase ületab läve `speaking`-olekus → `stopSpeaking()` + uus kõnevoor.
6. **UI:** üks lüliti „Alusta häälvestlust" vestluse sisendireal + olekukiip + nähtav transkript; väljumine tagasi tekstirežiimi ühe toiminguga.
7. **Piirangud esimeses versioonis:** toorheli ei säilitata (praegune `/api/stt` ei salvesta faili — jääb nii); häälega ei kinnitata saatmis-/jagamistoiminguid peale tavalise vestlussõnumi; kriisiviited kuvatakse alati ka tekstina (kriisituvastus on juba vastuses olemas, `isCrisis` metaandmed).

**[JÄRELDUS]** Maht: 1 uus hook + ChatBody integratsioon + tõlkevõtmed; riskid koonduvad eesti STT kvaliteedi (mõõta enne `STT_SERVER_URL` Whisperiga) ja TTS-i latentsuse ümber, mitte arhitektuuri.

---

## 9. Prioriseeritud paranduskava

**P0 — ühenduste terviklus (enne igasuguseid uusi mooduleid):**

1. **Kovisiooni sidumisotsus** (tooteomanik + arhitektuur, ptk 7.3): kas lõuend saab andmekihi külge või asendab selle. Kuni otsuseta külmutada andmekihi edasiarendus ja mitte nimetada lõuendit valmis funktsiooniks. *(otsus, mitte kood)*
2. **Teekond ↔ eelpöördumine seosekirje:** `PreInquiry.sourceJourneyId` veerg + kirjutamine `createPreInquiry`-s + Teekonna detailvaate „seotud eelpöördumised" päring. Väike, kõrge väärtus. *(≤1 päev)*
3. **Ruumi dedup `originType/originId` kaudu** markeri asemel (pre-inquiries/[id]/room/route.js:66–77) + osaline unikaalsus. *(väike)*
4. **Tupikute koristus:** `DOWNLOADED` kas rakendada (PDF-allalaadimine + olek) või eemaldada; „Parimad praktikad" kaart suunata ajutiselt olemasolevale sihile selge märgisega või peita. *(väike)*
5. **Sisemise eelpöördumise teavitus:** vähemalt e-kiri adressaadile saabumisel (mailer on olemas, `getMailer`), hiljem märguandekiht. *(väike–keskmine)*

**P1 — nähtavale tuua olemasolev väärtus:**

6. **Eelpöördumine → Kovisioon nupp** vastuvõtutöövoogu (marsruut on valmis; vajab ainult UI-d + anonüümsusprobleemide kuvamist) — aktiveerub pärast P0.1 otsust.
7. **Tööheaolu `covision_input` päris üleandmine:** kinnitatud mustand → kovisiooni juhtumi mustandi eeltäide (sama muster nagu eelpöördumisel). Sõltub P0.1-st.
8. **Teemaseemnete püsivus:** seeme = `CovisionCase` DRAFT (ptk 7.3) või vähemalt serveripüsivus enne, kui kasutajad demole sisu usaldavad.
9. **STAR2 mustandi ülekandeolek** (`transferStatus` + viitenumber + „Kopeeri STAR2 jaoks", ptk 7.5) — eeldab ptk 11 küsimuste 1–4 vastuseid.

**P2 — pärast ülaltoodut:**

10. Parimate praktikate eraldi leht (spec olemas) andmekihi peale.
11. Häälvestluse pakett (ptk 8) — sõltumatu, võib käia paralleelselt P1-ga.
12. Ruumiindeks/kiirmenüü karusselli täppidest (ideed.md ptk 28.6) + poolelioleva töö märgid (`dashboardBadges` konks on kaartides juba olemas, workspaceDashboardCards.js:107).
13. `ConversationRun` pärandmudeli eemaldamine/migratsioon.

**Mitte praegu (kooskõlas briefi ptk 12):** Juhtumitöö assistendi töölaud, Meetodipeegel, Supervisiooni moodul, ESTA liikmeala, võrgustikukaart, automaatne STAR2 liidestus, skeemimuudatused peale ülal loetletud minimaalsete veergude.

---

## 10. Soovitatud esimene vertikaalne lõik

Briefi ptk 13 kandidaatide võrdlus:

| Kriteerium | 1. Vestlus→Teekond→eelpöörd. | 2. Eelpöörd.→vastuvõtt→ruum | 3. JTA→STAR2 mustand→olek | 4. JTA→Meetodipeegel→Kovisioon | 5. Tööheaolu→Superv./Kovis. sisend |
|---|---|---|---|---|---|
| Kasutajaväärtus | kõrge (pöörduja põhirada) | kõrge, aga juba toimiv | kõrge spetsialistile | kõrge, kaudne | keskmine |
| Olemasoleva koodi taaskasutus | **~85% olemas** | ~90% olemas | ~40% (STAR_HELPER olemas, elutsükkel puudu) | ~15% (2 moodulit puudu) | ~60% (mustand olemas, vastuvõtt puudu) |
| Privaatsusrisk | madal (shareKeys + eelvaade juba olemas) | madal | keskmine (tooteotsused lahtised) | kõrge | madal-keskmine |
| STAR2 dubleerimise oht | puudub | puudub | **peamine risk** | keskmine | puudub |
| Rollide arv | 1 | 2 | 1 | 1 | 1–2 |
| Testitavus sünteetiliselt | väga hea (testitaristu olemas: tests/journey, tests/preInquiries) | hea | keskmine | halb | hea, aga sõltub Kovisiooni sidumisest |
| Sobivus ruumilise UX prototüübiks | **hea: Teekonna kokkuvõte kui liikuv tööobjekt vestlusest eelpöördumisse** | keskmine | nõrk (vormikeskne) | nõrk | keskmine |

**Soovitus [ETTEPANEK]:** valida **kandidaat 1 — Vestlus → kasutaja kinnitatud Teekonna objekt → eelpöördumine**, defineerituna *lõpetamisena*, mitte uusehitusena:

1. seosekirje püsivus (P0.2) ja tagasilink Teekonnale;
2. üleandmise eelvaade ruumilise tööobjektina (Teekonna kokkuvõttekaart liigub eelpöördumise lõuendile — esimene päris näide „tulemus liigub järgmisse ruumi tööobjektina", brief ptk 9);
3. staatusetagasiside mõlemas otsas (Teekond näitab „eelpöördumine koostatud/saadetud");
4. e2e-test sünteetiliste andmetega kogu ahelale.

Põhjendus: suurim väärtus väikseima uue koodi ja madalaima riskiga; ei sõltu Kovisiooni sidumisotsusest ega STAR2 tooteotsustest; loob üleandmismustri etaloni (ptk 7.1), mida kõik järgmised lõigud kopeerivad. Kandidaat 2 on juba funktsionaalne — sellele piisab P0.3/P0.5 parandustest ja kontrollringist (funktsioonide-ja-ux-kaardistus.md „Järgmine kontrolliring" punktid 1–3 katavad selle). Kandidaadid 3–5 eeldavad kas lahtisi tooteotsuseid või Kovisiooni sidumist.

---

## 11. Tooteomaniku otsust vajavad küsimused

1. **Kovisiooni sidumine:** kas 8-etapiline lõuend ühendatakse olemasoleva `CovisionCase` andmekihiga (soovitus, ptk 7.3) või asendab uus lõuend andmemudeli? Kumb pool on tõde etappide, rollide ja kokkuvõtte struktuuri osas?
2. **Kas Teemaseeme = Kovisiooni juhtumi mustand** (üks objekt, üks elutsükkel) või eraldi objekt oma elutsükliga (kaks spec-lehte eeldavad eraldi lehti, kuid mitte tingimata eraldi andmeobjekti)?
3. **Kas teenuseosutaja kuulub Kovisiooni sihtrühma?** API lubab, UI mitte (ptk 6.3).
4. **Eelpöördumise `DOWNLOADED` rada:** kas „laen alla ja lähen kohtumisele" on toetatav stsenaarium (siis ehitada PDF-eksport + olek) või eemaldada?
5. **STAR2 mustandi elutsükkel:** millised olekud ja kui kaua mustandit pärast „STAR2-sse kantud" märget hoitakse (ideed.md ptk 17 küsimused 3, 8, 11)? Ilma selleta jääb P1.9 ootele.
6. **Teavituskanalid:** kas sisemise eelpöördumise/kutse/sobituse kohta saadetakse e-kiri, kuvatakse ainult platvormisisene märk või mõlemat? (Mõjutab P0.5 ja märguannete arhitektuuri.)
7. **Tööheaolu → Kovisioon üleandmise vorm:** kas kinnitatud `covision_input` muutub kovisiooni juhtumi mustandiks automaatse eeltäitena või jääb teadlikult copy-paste tasemele (privaatsuse lisapiir)?
8. **Supervisiooni staatus:** kas see jääb lähiaasta plaanist välja (praegu 0 koodi) — kui jah, eemaldada UI-tekstidest viited, mis lubavad rohkemat?
9. **ESTA:** kinnitada, et kogu ESTA-funktsionaalsus püsib kontseptsioonistaatuses kuni kirjaliku koostööleppeni; iga tulevane ESTA-võimekus ehitatakse lülitatava mooduli ja `UserCapability` mustriga (ptk 7.4), ilma ligipääsuta privaatsetele andmeruumidele.
10. **Häälvestluse keelefookus:** kas esimene versioon on ainult eestikeelne (soovitus: jah — en/ru kasutavad nagunii brauserisünteesi) ja milline on aktsepteeritav STT-vea määr enne avalikustamist?
11. **Karusselli „Parimad praktikad" kaart:** kas peita kuni eraldi lehe valmimiseni või suunata märgistatult olemasolevasse vaatesse?

---

*Raporti iga tehniline väide on kontrollitud aktiivsest koodist 12.07.2026 seisuga (töölaual olid commit'imata muudatused, sh Kovisiooni lõuendi ja Teemaseemnete failid — analüüs kajastab worktree seisu, mitte ainult viimast commit'i `899c8c3e`).*
