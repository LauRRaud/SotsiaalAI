# Praeguse vestlus- ja RAG-susteemi kaardistus

## 1. Luhikokkuvote

Praegune vestlusleht `/vestlus` on chat-first kasutajaliides, mille peamine tavalise sonumi rada liigub `ChatBody.jsx` ja `useChatStream.js` kaudu `POST /api/chat` route'i. Frontend saadab tavasonumi vaikimisi `chatMode: "rag"`, aga serveris ei lahe sonum pimesi ainult RAG-otsingusse: enne tehakse request bootstrap, privaatsuse kontroll, rolli/subscription/budget kontroll, ruumiliikmesuse kontroll ning aktiivse dokumendi- voi abivoogude kontroll. Kui eriharu ei vota sonumit ule, koostab `lib/chat/retrievalContextAssembler.js` RAG/dokumendi/teenusekaardi kontaktide konteksti ning `lib/chat/mainResponseHandler.js` kutsub OpenAI Responses API-t.

Chat on praktiliselt RAG-first tavalise info- ja juhendamise voo jaoks, sest frontend paneb vaikimisi `chatMode: "rag"` ja backend kasutab seda `defaultToExternalSources` signaalina. See on siiski osaliselt oige, mitte absoluutne: tervitus, aktiivne dokumendivoog, aktiivne abisoovi/abipakkumise voog, ruumisonum ilma assistendi edasisuunamiseta ja sugavuuringu reziim liiguvad teist rada. Assistent ei vasta otse komponendist; vastus tekib serveripoolses orchestration kihis, mis koostab prompti koos `RAG_CONTEXT`, ajaloo, rolli ja lisajuhistega. Eraldi intent/router loogika on olemas mitmes kihis: frontend active workflow, `requestBootstrap`, help intent detection, document workflow state, `questionPlanner`, `sourceNeed` ja `orchestrationPolicy`.

Journey/teekonnakaardi keskset objekti praegu ei leidnud. On olemas osaliselt sarnaseid metadata ja draft-olekuid: `ConversationMessage.metadata.workflow.help`, `ConversationMessage.metadata.workflow.document`, `PreInquiry.assessmentState`, RAG `questionPlan`/`retrievalMeta` ja kovisiooni `CovisionJourneyStep`, kuid need ei ole uldine `JourneyDraft` ega teekonnakaart.

## 2. Sonumi liikumise teekond

Praegune tavaline sonumi rada:

Kasutaja kirjutab sonumi  
-> `components/alalehed/chat/ChatComposer.jsx` teeb vajadusel `/api/privacy/check` privaatsuse eelkontrolli  
-> `components/alalehed/ChatBody.jsx` kutsub `useChatStream.sendMessage`  
-> `components/chat/hooks/useChatStream.js` lisab kasutaja sonumi lokaalselt ja loob streaming AI placeholder'i  
-> `POST /api/chat` koos `message`, `history`, `role`, `stream`, `persist`, `convId`, `chatMode`, workflow state ja vajadusel dokumendikontekstiga  
-> `lib/chat/requestBootstrap.js` teeb JSON, auth, privacy, role, subscription, budget, history, crisis/greeting ja workflow routing eeltooktluse  
-> `app/api/chat/route.js` proovib dokumendivoogu  
-> proovib abisoovi/abipakkumise voogu  
-> tervituse korral vastab kohe ilma RAG-ita  
-> muul juhul `lib/chat/retrievalContextAssembler.js` otsustab, kas valiseid allikaid on vaja, teeb RAG-otsingu, lisab kasutaja dokumendi voi teenusekaardi KOV kontaktid  
-> `lib/chat/orchestrationPolicy.js` koostab orchestration metadata  
-> `lib/chat/mainResponseHandler.js` kutsub `callOpenAI` voi `streamOpenAI`  
-> `lib/chat/sourceAttribution.js` filtreerib vastuse pohjal kuvatavad allikad  
-> `lib/chat/responseFinalizer.js` salvestab kasutaja ja assistendi sonumid `Conversation` / `ConversationMessage` mudelisse  
-> frontend saab SSE `meta`, `delta`, `done` event'id ja uuendab sonumit ning allikaid.

Tekstiskeem:

```text
Kasutaja sonum
-> ChatComposer privacy-check
-> ChatBody / useChatStream
-> POST /api/chat
-> requestBootstrap
-> document workflow? / help workflow? / greeting?
-> assembleRetrievalContext
-> OpenAI Responses API
-> sourceAttribution
-> persist ConversationMessage metadata
-> SSE/JSON response
-> ChatMessageItem + ChatSourcesPanel
```

## 3. Frontend komponendid

| Fail/komponent | Roll vestluses | Markus |
|---|---|---|
| `app/vestlus/page.js` | Server page vestluslehele | Renderdab `ConversationDrawer`, `ChatSidebar` ja `ChatBody`; annab edasi `roomId`. |
| `components/alalehed/ChatBody.jsx` | Vestluse peakonteiner | Hoiab aktiivset workflow'd, ruumireziimi, allikapaneeli, analuusipaneeli, sonumeid ja `useChatStream` integratsiooni. |
| `components/alalehed/chat/ChatComposer.jsx` | Sisend, tools menu ja privacy prompt | Teeb enne saatmist `/api/privacy/check`; tools menu avab help request, help offer, deep research ja document analysis reziime. |
| `components/chat/hooks/useChatStream.js` | Sonumi saatmine ja streaming | Saadab tavalise sonumi `/api/chat`; deep research laheb `/api/research/jobs`; room mode voib saata ainult ruumi sonumi ilma assistendita. |
| `components/chat/hooks/useChatConversationState.js` | Conversation state ja ajalugu | Hoiab `convId`, sessionStorage sonumeid, hydrate'ib `/api/chat/run` kaudu ja koostab `historyPayload`. |
| `components/ChatSidebar.jsx` | Vestluste ja ruumide kulgriba | Laeb `/api/chat/conversations` ja `/api/rooms`; rollifilter on `CLIENT`, `SOCIAL_WORKER` voi adminil `ALL`. |
| `components/alalehed/chat/ChatMessageItem.jsx` | Sonumite kuvamine | Kuvab user/assistant/member sonumid, attachments, cards, copy/listen/source nupud. |
| `components/alalehed/chat/ChatSourcesPanel.jsx` | Allikate paneel | Kuvab viimase vastuse voi kogu vestluse allikad. |
| `components/chat/hooks/useConversationSources.js` | Allikate kogumine UI jaoks | Eelistab `displayed_sources`, filtreerib mitte-RAG/upload allikad ja koondab kordused. |
| `components/chat/utils/sources.js` | Allikate normaliseerimine | Vormindab label'id, lehekulgede vahemikud ja source identiteedi UI jaoks. |
| `components/alalehed/chat/hooks/useChatRoomMode.js` | Ruumireziimi sonumid | Laeb ruumisonumeid ja eristab assistendi ruumisonumid tavaliikmete sonumitest. |
| `components/chat/hooks/useChatAnalysisController.js` | Dokumendi/analuusi upload kontekst | Annab `ephemeralChunks`, `ephemeralSource`, `docOnlyMode` `useChatStream` konfiguratsiooni. |
| `components/chat/HelpListingsPanel.jsx` ja `SelectedListingContext.jsx` | Abisoovide/abipakkumiste paneelid | Chat UI saab avada help listing vaateid ja valitud kirje konteksti. |

## 4. API route'id

| Route | Mida teeb | Milliseid teenuseid kutsub | Markus |
|---|---|---|---|
| `POST /api/chat` | Peamine chat route | `bootstrapChatRequest`, `handleDocumentWorkflowBranch`, `handleHelpWorkflowBranch`, `assembleRetrievalContext`, `handleMainChatResponse` | Tavaline chat/RAG/orchestration sisenemispunkt. |
| `GET /api/chat` | Health/info vastus | Rate limit | Tagastab `{ ok: true, route: "api/chat" }`. |
| `GET /api/chat/conversations` | Kasutaja vestluste nimekiri | `requireChatUser`, `resolveSessionRoleState`, `resolveConversationListRoleFilter`, Prisma `conversation` | Tagastab ainult oma vestlused; rollifilter toetab admini vaadet. |
| `POST /api/chat/conversations` | Vestluse loomine/upsert | `resolveConversationWriteRole`, Prisma `conversation` | Kasutatakse conversation shelli jaoks. |
| `GET /api/chat/conversations/[id]/messages` | Vestluse sonumite lugemine | `requireChatUser`, Prisma `conversationMessage` | Kontrollib omanikku; tagastab `sources` ja `displayed_sources` metadata seest. |
| `GET /api/chat/run` | Persistitud viimase tulemuse hydrate/poll | Prisma `conversation`, `conversationMessage` | Frontend kasutab vestluse taastamiseks ja deep research tulemuse lepitamiseks. |
| `POST /api/privacy/check` | Teksti privaatsuse eelkontroll | `evaluateTextPrivacy` | Frontend kutsub enne saatmist; `/api/chat` kordab serveris kontrolli. |
| `POST /api/pre-inquiries/assist` | Eelpöördumise assist | `assistPreInquiry`, `evaluateTextPrivacy` | Ei ole praegu `/api/chat` peavoo haru; eraldi pre-inquiry workflow route. |
| `GET /api/service-map/entries` | Teenusekaardi kirjete lugemine | `listPublishedServiceMapEntries`, `readServiceMapEntriesQuery` | RAG assembler kasutab lisaks otse `ServiceMapEntry` kontakte KOV konteksti jaoks. |
| `POST /api/rooms/[roomId]/messages` | Ruumisonumi saatmine | Room message route | `useChatStream` kasutab room mode'is enne/ilma assistendita. |
| `/api/research/jobs*` | Sugavuuringu eraldi voog | Research jobs stream | `deep_research` ei kasuta `/api/chat` peamist RAG-vastuse rada. |

## 5. Serveripoolne chat orchestration

Peamine serveripoolne jada on `app/api/chat/route.js`.

1. `bootstrapChatRequest` loeb request body, valideerib sonumi, koostab `history`, maarab `requestedChatMode`, teeb privacy-check'i, lahendab rolli, kontrollib subscription'i ja budget'it, tuvastab greeting/crisis ning leiab aktiivse document/help workflow state'i.
2. `handleDocumentWorkflowBranch` votab sonumi ule ainult siis, kui `shouldUseDocumentWorkflow` on toene. See kasutab `runDocumentChatWorkflow` ja voib lopuks luua `AgentArtifact` mustandi.
3. `handleHelpWorkflowBranch` votab sonumi ule abisoovi/abipakkumise reziimis voi aktiivses help workflow's. See kasutab `runHelpChatWorkflow` ja voib luua `HelpRequest` voi `HelpOffer`.
4. Kui sonum on esimene tervitus ja kriisi ei tuvastatud, vastab route kohe ilma RAG/OpenAI retrievalita.
5. `assembleRetrievalContext` teeb RAG ja konteksti koostamise: question plan, source need, KOV/municipality detection, service map KOV contacts, RAG query plan, source package context, kasutaja dokumendi ephemeral context, selected context ja sources.
6. `chooseOrchestrationPlan` lisab metadata: mode, step, complexity, reasoning, capability.
7. `handleMainChatResponse` kutsub `callOpenAI` voi `streamOpenAI`. Prompti koostamine toimub `promptBuilder.toResponsesInput` kaudu: system prompt, `RAG_CONTEXT`, grounding message, history, lisajuhised ja kasutaja sonum.
8. `buildSourceAttribution` filtreerib kuvatavad allikad lopliku vastuse teksti, query plan'i, legal lookup plan'i ja risk policy pohjal.
9. `finalizeAssistantReply` salvestab kasutaja- ja assistendi sonumid, allikad, `displayed_sources`, RAG trace'i, attachments/cards ja workflow metadata.

Model/provider valik on kapseldatud `lib/chat/openaiRuntime.js` ja `lib/chat/promptBuilder.js`: kasutatakse OpenAI Responses API-t, mudel tuleb `lib/chat/settings.js` väärtusest `DEFAULT_MODEL`. Fallback loogika on olemas no-context vastuse, OpenAI errori ja streaming empty reply jaoks.

## 6. RAG kasutus

- Kas iga chat-sisend läheb RAG-pipeline'i?  
  Ei. Tavasonumi vaikevoog on RAG-first, sest frontend saadab `chatMode: "rag"`, aga erandid on olemas: tervitus vastatakse kohe; deep research läheb research route'i; aktiivne help workflow ja document workflow võivad sonumi enne RAG-i üle võtta; ruumis saab sonumi saata ilma assistendita; source UI probleemid ja capability-küsimused võivad `sourceNeed` järgi mitte vajada väliseid allikaid.

- Kas on olukordi, kus RAG-i ei kasutata?  
  Jah. `shouldUseExternalSourcesForTurn` võib tagastada false; siis `effectiveContext` võib olla `CONVERSATIONAL_CONTEXT: No verified external context was retrieved for this turn.` Greeting haru ei jõua retrieval assemblerini.

- Kuidas otsustatakse, millised allikad otsitakse?  
  `buildQuestionPlan`, `shouldUseExternalSourcesForTurn`, `buildRagSearchQuery`, `buildRagQueryPlan`, `buildTemporalRetrievalPlan`, legal/source lookup tuvastus, municipality detection ja audience filter määravad otsingu. `searchRagQueries` teeb päringud ning tulemusi filtreeritakse KOV, legal, temporal ja source-package loogika järgi.

- Kuidas valitakse selected context?  
  `retrievalContextAssembler` grupeerib tulemused `groupMatches`, valib konteksti MMR/diversity/temporal/legal/municipality strateegiaga ning eelarvestab selle `buildContextWithBudget` abil. SourcePackage ja evidence package loogika võivad konteksti täiendada.

- Kuidas tekivad answer/displayed sources?  
  Kõigepealt tekivad `sources` valitud RAG gruppidest, kasutaja dokumendist ja/või service map KOV kontaktidest. Pärast mudelivastust `buildSourceAttribution` otsustab, millised allikad tegelikult kuvatakse `displayed_sources` nime all.

- Kus kuvatakse allikad kasutajale?  
  `useChatStream` paneb `sources` AI sõnumile; `ChatMessageItem` kuvab allikate nupu; `ChatSourcesPanel` kuvab allikate loendi; `useConversationSources` koondab viimase vastuse ja kogu vestluse allikad.

- Kas allikate kuvamine põhineb ainult vastuses tegelikult kasutatud allikatel?  
  Suures osas jah, sest `sourceAttribution.js` skoorib ja filtreerib allikaid lopliku vastuse teksti, query anchor'ite, legal contract'i, risk policy ja source package reeglite alusel. Samas ei ole see formaalne tsitaadipõhine proof; see on heuristiline attribution kiht. Kui `RAG_DISPLAYED_SOURCES_ENFORCED` on aktiivne, kasutatakse `displayed_sources` enforced reziimi.

## 7. Intent, töövood ja eriharud

| Töövoog | Kas on olemas? | Kus failides? | Kuidas käivitub? |
|---|---|---|---|
| Tavaline info/RAG-küsimus | Jah | `useChatStream.js`, `app/api/chat/route.js`, `retrievalContextAssembler.js` | Frontend saadab vaikimisi `chatMode: "rag"`; backend koostab RAG/context vastuse. |
| Dokumendi analüüs uploaditud materjali põhjal | Jah, osaliselt chat'i sees | `useChatAnalysisController.js`, `useChatStream.js`, `retrievalContextAssembler.js`, `promptBuilder.js` | Kui `ephemeralChunks` on olemas, pannakse konteksti `USER DOCUMENT`; vajadusel kombineeritakse RAG-iga. |
| Dokumendi koostamise workflow | Jah | `lib/chat/documentOrchestration.js`, `workflowBranchHandlers.js` | Aktiivne document workflow state või `chatMode: "document"` käivitab haru; lõpus võib luua `AgentArtifact`. |
| Abisoovi koostamine | Jah | `lib/help/chatWorkflow.js`, `lib/help/intents.js`, `workflowBranchHandlers.js` | Tools menu `help_request` või intent/state; salvestab `HelpRequest`. |
| Abipakkumise koostamine | Jah | `lib/help/chatWorkflow.js`, `lib/help/intents.js`, `workflowBranchHandlers.js` | Tools menu `help_offer` või intent/state; salvestab `HelpOffer`. |
| Abisoovi/abipakkumise sirvimine ja ühendamine | Jah, help workflow sees | `lib/help/chatWorkflow.js`, `lib/help/matches.js`, `components/chat/HelpListingsPanel.jsx` | Help workflow intent'id `browse_*`, `connect_*`; UI paneelid avanevad chatist. |
| Eelpöördumise töövoog | Olemas eraldi, mitte chat'i peavoo haruna | `app/api/pre-inquiries/*`, `lib/preInquiries.js`, `app/api/pre-inquiries/assist/route.js` | Eraldi pre-inquiry route'id ja vaated; `/api/chat/route.js` ei käivita seda otse. |
| Teenusekaardi suund | Osaliselt olemas | `retrievalContextAssembler.js`, `app/api/service-map/entries/route.js`, `lib/serviceProviderProfiles.js` | RAG assembler lisab KOV kontaktid ja kasutab service map kontakte kontekstina; chat ei ava ise teenusekaarti. |
| Kriisi- või ohusuunamine | Jah, piiratud | `lib/chat/safety.js`, `requestBootstrap.js`, `app/api/chat/route.js`, `promptBuilder.js`, `preInquiriesAssessment.js` | `detectCrisis` annab `isCrisis`; kriisi korral muudetakse prompti/no-context vastust ja logitakse `crisis_detected`. |
| Privaatsuse eelkontroll | Jah | `ChatComposer.jsx`, `app/api/privacy/check/route.js`, `requestBootstrap.js`, `privacyGuard.js` | Frontend kontrollib enne saatmist; server kordab kontrolli vastavalt workflow tüübile. |
| Deep research | Jah, eraldi rada | `ChatBody.jsx`, `useChatStream.js`, `/api/research/jobs` | Tools menu `deep_research`; ei liigu `/api/chat` põhirajale. |
| JourneyDraft/teekonnakaart | Ei leidnud | Puudub üldine `lib/journey`, `app/api/journeys`, Prisma `Journey` | On ainult sarnane metadata, mitte teekonnakaardi objekt. |

## 8. Vestluse ajalugu ja kontekst

Vestlus hoitakse Prisma mudelites `Conversation` ja `ConversationMessage`. Frontend hoiab aktiivset `convId` sessionStorage'is ning lokaalseid sonumeid samuti sessionStorage'is, seejärel hydrate'ib püsiva seisundi `/api/chat/run` kaudu. `useChatConversationState` koostab `historyPayload` viimastest nähtavatest sonumitest, tavaliselt kuni 8 kirjet. Assistant-sonumite puhul lisatakse ajalukku ka kuni 8 allika label'i ja metadata lühikokkuvõte, mis aitab mudelil varasemate allikate peale viidata.

Serveris `requestBootstrap.toOpenAiMessages` teisendab history OpenAI formaati. Assistant history saab juurde ploki `Assistant source metadata for this answer`, kui varasemal vastusel olid allikad. `promptBuilder` paneb selle history `RAG_CONTEXT` ja lisajuhiste järel enne uut kasutaja sõnumit.

Vestlus on kasutajapõhine: `/api/chat/conversations`, `/api/chat/conversations/[id]/messages` ja `/api/chat/run` kontrollivad, et `conversation.userId` vastab auth userile. Ruumirežiimis kasutatakse `Room`, `RoomMember` ja `RoomMessage` mudeleid ning `/api/chat` kontrollib `roomId` puhul liikmesust, kui kasutaja ei ole admin.

## 9. Rollipohine kaitumine

Roll mõjutab vestlust mitmel tasandil.

| Roll/vaade | Mõju chat'is | Failid |
|---|---|---|
| `CLIENT` | Client system prompt, lühem output fallback, client audience filter RAG-is, client document task piirangud | `useEffectiveRole.js`, `authz.js`, `promptBuilder.js`, `retrievalContextAssembler.js`, `documentOrchestration.js` |
| `SOCIAL_WORKER` | Specialist system prompt, suurem output fallback, social worker audience filter, dokumendi/raporti töövood | `promptBuilder.js`, `systemPrompts/*`, `retrievalContextAssembler.js` |
| `SERVICE_PROVIDER` | `authz.normalizeRole` säilitab rolli subscription kontrollis, kuid chat role promptides paistab põhiloogika koonduvat `CLIENT`/`SOCIAL_WORKER` harudele | `authz.js`, `promptBuilder.js` |
| Admin view-role | Admin saab effective role'i cookie/profiili kaudu; vestluste list võib kasutada `ALL` vaadet | `useEffectiveRole.js`, `authz.js`, `ChatSidebar.jsx`, `conversationRoles.js` |
| Room member | Ruumis liikmesuse kontroll; member/assistant/user kuvamine erineb | `requestBootstrap.js`, `useChatRoomMode.js`, room API route'id |

Prompti rollierinevus tekib `buildLocalizedSystemPrompt` kaudu ning reply pikkus `OPENAI_MAX_OUTPUT_TOKENS_CLIENT` / `OPENAI_MAX_OUTPUT_TOKENS_WORKER` kaudu. RAG audience filter valib `CLIENT/BOTH` või `SOCIAL_WORKER/BOTH`. Service provider'i eraldi vestlusloogikat ei leidnud samas tugevuses nagu client/social worker loogikat.

## 10. Privaatsus ja ohutus

Privaatsuse eelkontroll on kahekihiline. `ChatComposer.jsx` kutsub enne saatmist `/api/privacy/check`, mille route kasutab `evaluateTextPrivacy`. Kui leitakse isikuandmeid, tagastatakse 409 ja UI kuvab kasutajale valikud: muuta teksti, saata maskeeritult või privaatse workflow korral saata originaal. Seejärel saadetakse `privacyDecision` koos chat requestiga.

Serveris `requestBootstrap.js` teeb sama kontrolli uuesti, et klienti ei peaks usaldama. Workflow sõltub kontekstist: `chat_private`, `room_private`, `help_request_public`, `help_offer_public`, `document_generation`. Avalike help listing workflow'de puhul ei lubata originaali samal viisil kui privaatsetes töövoogudes. `privacyGuard.js` kasutab `detectPersonalData` ja `redactPersonalData` loogikat.

Kriis ja ohusuunamine on osa chat bootstrap'ist: `detectCrisis` seab `isCrisis`, route logib kriisi ning system prompt/no-context vastus muutub kriisirežiimile. Pre-inquiry assist sisaldab eraldi risk/urgency hindamist `preInquiriesAssessment.js` ja lisab hoiatusi.

Logides kasutatakse `safeLogPayload` ja `safeError`, kuid chat logidesse jõuavad siiski sündmuste metadata nagu `messageLength`, role, isCrisis, source counts, query plan, mitte terviksonum. `requestBootstrap` ei paistnud logivat sonumi sisu otse. RAG trace logib palju allika metadata välju; see ei ole kasutaja privaatse olukorra täistekst, kuid võib sisaldada query plan'i ja allikate identifikaatoreid.

## 11. Kas süsteem eristab infoküsimust ja olukorra kirjeldust?

Jah, osaliselt. Ei ole ühte lihtsat `isSituationDescription` routerit, kuid mitu heuristikakihti eristavad tavalist vestlust, teadmusküsimust, sotsiaalvaldkonna küsimust ja elulise olukorra kirjeldust.

- `lib/chat/sourceNeed.js` eristab tõenäolist conversational turn'i, capability-küsimust, substantive knowledge question'i, service jurisdiction lookup'i, follow-up'e ja social-domain teksti.
- `lib/chat/questionPlanner.js` tuvastab `life_situation_guidance` režiimi esimese isiku olukorrakirjelduste puhul, nt rahaline raskus, eaka lähedase hooldus või puudega lapse pere tugi.
- `retrievalContextAssembler.js` kasutab `questionPlan.mode`, `needs_rag`, `life_situation`, `topics`, municipality detection ja RAG query plan'i, et valida allikad ja lisajuhised.
- `lib/preInquiriesAssessment.js` ja `lib/preInquiries.js` hindavad olukorda eelpöördumise assist flow jaoks eraldi.

Kas on olemas loogika, mis ütleb "see on tavaline infoküsimus"?  
Osaliselt jah: `sourceNeed`, `questionPlanner` ja `orchestrationPolicy` käsitlevad üldküsimust vaikimisi `general_question` / `default` / RAG guidance radadena.

Kas on olemas loogika, mis ütleb "see on inimese olukorra kirjeldus"?  
Osaliselt jah: `questionPlanner.detectLifeSituation` tuvastab teatud elulised olukorrad ja annab `mode: "life_situation_guidance"`. See ei loo aga JourneyDrafti.

Kas on olemas loogika, mis võiks käivitada JourneyDrafti?  
Potentsiaalselt jah: `questionPlanner` ja `retrievalContextAssembler` toodavad juba `questionPlan`, `topics`, `life_situation`, `missing municipality`, `riskPolicy`, `suggested source context` ja `retrievalMeta`. Eraldi JourneyDraft käivitajat ei leidnud.

Kui küsida otseselt, kas JourneyDrafti käivitav objekt on olemas: Ei leidnud.

## 12. JourneyDrafti võimalik lisamiskoht

Kõige väiksema riskiga lisamiskoht oleks valikuline structured metadata serveripoolses chat orchestration kihis pärast `assembleRetrievalContext` ja enne/lähedal `handleMainChatResponse` lõplikku response metadata koostamist.

Soovituslik tehniline suund ilma olemasolevat loogikat dubleerimata:

- `lib/chat/questionPlanner.js` ja `retrievalContextAssembler.js` jäävad olukorra/teema/allikate signaalide allikaks.
- Uus hilisem teenus võiks olla `lib/journey/draft.js`, mis võtab sisendiks `effectiveMessage`, `rawHistory`, `normalizedRole`, `questionPlan`, `retrievalMeta`, `sources` ja vajadusel `replyLang`.
- `/api/chat/route.js` võiks lisada vastuse metadata'sse optional `journeyDraft`, kui küsimus on piisavalt olukorrakirjelduslik ja workflow ei ole juba document/help branch'is.
- `JourneyDraft` ei peaks muutma RAG vastuse koostamist ega source attribution loogikat; see peaks olema lisametadata samas response'is.
- Frontend saaks `useChatStream` `meta` või `done` event'ist optional `journeyDraft` välja lugeda ja kuvada eraldi kaardina chatis/kõrvalpaneelis.
- Püsiv `Journey` tuleks luua eraldi kinnituse järel, mitte automaatselt `ConversationMessage` salvestamisel.

Ei soovita JourneyDrafti lisada otse `sourceAttribution.js` või RAG retrieval selection sisse, sest need failid on allika- ja tõendusloogika jaoks. Samuti ei ole hea dubleerida help/document workflow extraction'it uues journey teenuses; journey draft peaks kasutama nende olemasolevat olekut ja linke.

## 13. Praeguse süsteemi tekstiskeem

Praegune voog:

```text
Kasutaja sonum
-> ChatComposer privacy-check
-> useChatStream
-> POST /api/chat
-> requestBootstrap
-> document/help/greeting eriharud
-> questionPlanner + sourceNeed
-> RAG/service map/user document context
-> OpenAI vastus
-> sourceAttribution displayed_sources
-> ConversationMessage metadata
-> ChatMessageItem + ChatSourcesPanel
```

Võimalik tulevane lisaharu:

```text
Kasutaja sonum
-> olemasolev chat/RAG orchestration
-> optional JourneyDraft metadata
-> kasutaja kinnitab
-> privaatne Journey
-> teenusekaart/eelpöördumine handoff
```

## 14. Kokkuvote Laurile

Praegu töötab vestlus nii, et kasutaja sonum läheb kõigepealt chati UI-st privaatsuskontrolli ja seejärel `/api/chat` route'i. Seal otsustatakse, kas käivitub dokumendi töövoog, abisoovi/abipakkumise töövoog, tervituse kiirvastus või tavaline chat/RAG vastus. Tavalise info- ja juhendamisküsimuse puhul on sinu arusaam "küsimus läheb kohe RAG-süsteemi" osaliselt õige: kasutajaliides saadab vaikimisi `chatMode: "rag"`, aga server teeb enne mitu kontrolli ja eriharu otsustust ning RAG võib mõnes olukorras jääda vahele.

Teekonnaloogikast on praegu puudu keskne `JourneyDraft`/`Journey` objekt, teekonnakaardi UI ja kinnitusega salvestatav privaatne teekond. Olemas on aga kasulikud signaalid, mille peale seda hiljem ehitada: `questionPlanner` tuvastab elulisi olukordi, `retrievalContextAssembler` koondab allika- ja teenusekaardi konteksti, help/document workflow metadata salvestub vestluse sonumitesse ning privaatsuse/authz kihid on juba olemas.

Kõige väiksem ohutu lisamiskoht JourneyDraftile oleks optional metadata `/api/chat` vastuses, mille koostab uus eraldi `lib/journey/draft.js` teenus olemasoleva chat/RAG orchestrationi tulemuste põhjal. Seda ei tohiks panna RAG retrievali ega source attribution tuuma sisse ning see ei tohiks automaatselt püsivat Journey objekti luua.

## Lõpukontroll

- Koodifaile ei muudetud.
- Prisma skeemi ei muudetud.
- Migratsioone ei tehtud.
- Pakette ei installitud.
- Build/deploy käske ei käivitatud.
- Loodi või muudeti ainult `docs/audits/praegune-vestlus-rag-susteem-kaardistus.md`.
