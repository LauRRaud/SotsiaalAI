# SotsiaalAI SOL-süvaaudit — jätk: Koosta dokument

**Auditi seis:** kasutajaliidesest agendi, lähtefailide/RAG-i, mustandi, refinement'i, kinnitamise, salvestamise ja ekspordini ulatuva staatilise tervikahela süvaaudit `DONE`; runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `4d7b60eb71355bdfdd055a2cad565c2d2b765776`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-compose-4d7b60e` (detached HEAD). Auditi ajal ei kasutatud tõendina põhi-worktree dirty faili `app/styles/carousel.css`, teise akna commit'imata parandusi ega vana `SotsiaalAI-sol-audit-cfa62ea` koopiat.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Kasutajale nähtav leht ja sisenemisteed | DONE | `/dokreziim`, `/documents` rollisuunamine, dokumentide/artefakti query-süvalingid, kliendi ja töötaja erikujud ning tellimuse read-only seis |
| React ja olekuhaldus | DONE | lähtefailide laadimine, kliendi upload/remove, mallid, vestlus, genereerimine, refinement, stopp, kohalik versiooniajalugu, salvestamine, kinnitamine, kopeerimine, allalaadimine ja kustutamine |
| API ja autoriseerimine | DONE | artifact list/create/generate/refine/detail/PATCH/approve/download/DELETE; owner-skoop, rollipõhine allikapiir, tellimus, privacy confirmation, rate-limit, kasutuslimiit ja idempotentsus |
| AI, RAG ja lähteallikad | DONE | privaatne `agent_documents` ingest/search, väljavõte ja fallback, PII-redaction, evidence'i chunk-/tokenipiirid, prompt, kasutuslogi ja retrieval-observability |
| Artefakti olekumasin | DONE | püsiv DRAFT, CAS-muutmine, idempotentne FINAL-kinnitus, refinement-slot, kasutuse settlement ning kliendi reload/stop/stale rajad |
| Prisma ja migratsioonid | DONE | `AgentArtifact`, `AgentArtifactSourceDocument`, `DocumentAudit`, usage ledger ning migratsioonid `20260227143000`, `20260227170000`, `20260227193000`, `20260324143000`, `20260711120000` ja `20260719150000` |
| Eksport, audit, konto kustutus ja retention | PARTIAL | artefakti dünaamiline DOCX/PDF, allikad/mall, auditikutsed ning eelmise Dokumendid-ploki konto kustutuse, andmekoopia ja 90 päeva retention'i kattuvused; neid üldradu ei korratud algusest |
| Päris runtime | NOT_PROVEN | autentitud brauser, päris OpenAI/RAG/PostgreSQL, võrgu katkemine, serveri restart ja mitme protsessi samaaegsus `not_run` |

## Auditeeritud failid ja funktsioonid

- `app/dokreziim/page.js`, `app/documents/page.js`, `components/agent/AgentModePage.jsx`, `components/chat/ChatComposer.jsx`; rolli-/tellimusvärav, `buildWorkspaceHref()`, lähtefailide loaderid, `handleClientUpload()`, `handleClientRemoveDocument()`, `runGeneration()`, `handleRefine()`, `handleStopAgentRequest()`, `persistCurrentDraft()` ja `handleApprove()`.
- `app/api/documents/artifacts/route.js`, `generate/route.js`, `refine/route.js`, `[id]/route.js`, `[id]/approve/route.js`, `[id]/download/route.js`; list/paginatsioon, omand, DRAFT/FINAL, CAS, idempotentsus, kvoot, kasutus ja audit.
- `app/api/documents/route.js`, `[id]/route.js`; kliendi kaheosaline upload, `agentAllowed`, faili muutmine/kustutus ja kliendi omanikuvaate piir.
- `lib/documents/generation.js`, `evidence.js`, `sourceMaterial.js`, `search.js`, `embeddings.js`, `ragService.js`, `retrievalObservability.js`; `generateArtifactDraftContent()`, `refineArtifactDraftContent()`, RAG/fallback, evidence'i moodustamine, redaction ja mudelikutsed.
- `lib/documents/persistDraft.js`, `artifacts.js`, `artifactMutation.js`, `refinementSlots.js`, `storageQuota.js`, `rateLimit.js`; püsistus, serialiseerimine, FINAL-kaitse, sloti atomaar­sus, salvestuskvoot ja rate-limit.
- `lib/documents/docxExport.js`, `pdfExport.js`, `audit.js`, `auditShared.js`; dünaamiline väljund, allikaplokk ja kohustusliku/best-effort auditi piir.
- `lib/usage/paidResult.js`, `intentKey.js`, `routeAdapter.js`, `service.js`; stabiilne kliendikavatsus, reserve-produce-persist-commit järjekord ja perioodipiir.
- `prisma/schema.prisma` ning ülal loetletud dokumendi-, artefakti-, auditi-, kasutuse- ja idempotentsusmigratsioonid.
- Põhiauditi `SOL-DOC-01`–`09` kõik `Seis`-lõigud, jätkuauditi `SOL-DOC-J-01`–`06`, `SOL-VOICE-03`, `SOL-CHAT-05`, parandusauditi koondseis ja varasem Dokumendid tervikvoo kaardistus.

## Leiud

### SOL-COMP-01 — refinement'i tasuline tulemus kaob reload'i, vastuse kao või Stop-toimingu järel — P1

**Tõend.** Refinement-route ütleb ise, et tulemus elab ainult vastuses, kinnitab püsivalt vaid refinement-slot'i auditirea ja kasutustasu ning tagastab lõpuks teksti (`app/api/documents/artifacts/refine/route.js:208-259`). Ta ei uuenda `AgentArtifact` rida. Genereerimise järel on tööruumi artefaktil alati päris ID (`components/agent/AgentModePage.jsx:1239-1248`); refinement paneb uue teksti ainult `resultContent` olekusse ja kohalikku kuni kaheksa kirjega mäluloo hulka, kuid uuendab `workspaceResult` sisu ainult harul `!workspaceResult?.id`, kuhu tavalisel rajal ei jõuta (`:1266-1357`). Salvestus toimub alles eraldi kasutajatoiminguga (`:1481-1556`). Lehe reload loeb seetõttu serverist refinement'i-eelse mustandi. `Stop` kutsub ainult brauseri `AbortController.abort()`-i (`:792-794`); route ei jälgi `request.signal`-it ning `client.responses.create()` ei saa katkestussignaali (`lib/documents/generation.js:750-768`). Server võib pärast kasutaja „katkestatud” teadet slot'i ja tasu kinnitada, kuid vastus visatakse brauseris ära. Negatiivkontroll tõendas, et refinement-püsistust ei ole ning Stop ei ulatu route'i ega mudelini.

**Mõju.** Kasutaja võib kulutada perioodi refinement-ühiku ja ühe ainult kolmest lubatud paranduskorrast, kuid kaotada kogu uue teksti tavalise reload'i, navigeerimise, ühenduse katkemise või Stop-nupu järel. Sama idempotentsusvõti ei anna algset mudelivastust taastamiseks, sest seda ei ole serveris talletatud.

**Vastuvõtukriteerium.** Refinement peab enne slot'i/tasu kinnitamist püsistama omaniku artefakti uue revision'i või eraldi idempotentse tulemuserea; sama võtmega retry tagastab täpselt sama tulemuse ilma uue mudelikutsuta. Stop peab olema serveripoolne tühistus-/fencing-leping või UI peab ausalt ütlema, et katkeb ainult ootamine ja tulemus jääb taastatavaks. Negatiivtestid peavad katkestama ühenduse pärast mudelivastust, enne HTTP-vastust ja pärast serveri commit'i ning tegema reload'i/Stop'i; igal juhul on tulemus leitav või tasu ja slot vabastatud.

**Seis.** DONE — refinement'i kavatsus on nüüd omaniku ja idempotentsusvõtmega püsiv
`AgentArtifactRefinement`: mudelitulemus, artefakti uus sisu, kinnitatud slot ning kasutuse
commit sünnivad ühes tehingus ja sama võtmega kordus tagastab talletatud tulemuse ilma uue
mudelikutseta. Brauseri Stop katkestab ausalt ainult ootamise ning ütleb, et töö jätkub serveri
tähtajani; Playwrighti rada tõendas selle teate ja pärast serveripoolse tulemuse tekkimist reload'il
uue sisu taastumise. Vana koodi vastane kandev kontroll oli enne parandust 0/3, sihttestid on
34/34 PASS ja päris PostgreSQL-i refinement-sond 13/13 PASS.

### SOL-COMP-02 — refinement ei nõua DRAFT-seisu ega artefakti nähtud versiooni — P2

**Tõend.** UI lubab refinement'i ainult siis, kui kohalik `workspaceResult.status === "DRAFT"`, kuid server kontrollib `artifactId` puhul ainult `id + ownerId` olemasolu (`components/agent/AgentModePage.jsx:1266-1280`; `app/api/documents/artifacts/refine/route.js:102-110`). Route ei võta `expectedUpdatedAt` väärtust, ei nõua `status:"DRAFT"` ning reserveerib seejärel slot'i ja kasutuse enne mudelikõnet (`:177-215`). Vastuse `updatedAt` on lihtsalt `new Date().toISOString()`, mitte loetud või muudetud DB-versioon (`:255-260`). Auditispetsiifiline otse-API negatiivkontroll kinnitas DRAFT- ja version-precondition'i täieliku puudumise.

**Mõju.** Stale vahekaart saab pärast teise vahekaardi salvestust parandada vana sisu ning alles hilisem Save saab 409; tasuline töö ja slot on selleks ajaks juba kulunud. Otse-API klient saab refinement'i käivitada ka FINAL-artefakti vastu, kuigi tulemust ei saa samasse kinnitatud ritta enam salvestada.

**Vastuvõtukriteerium.** Refine peab nõudma `artifactId`, `expectedUpdatedAt` ja DRAFT-seisu ning siduma kontrolli sloti reserveerimisega atomaarse tingimuse/luku all. Stale või FINAL annab 409 enne RAG-i, mudelit, kasutusreservatsiooni ja slot'i. Päris PostgreSQL-i võistlustest peab katma refine vs PATCH, refine vs approve ning otse-API FINAL-refine'i ja tõendama null kulu/null auditirida kaotajale.

**Seis.** DONE — refine nõuab nüüd `artifactId`, `expectedUpdatedAt`, idempotentsusvõtit ning
lukustatud DRAFT-versiooni enne slot'i ja kasutusreservatsiooni. Sama artefakti aktiivne refine
fence'ib PATCH-i ja approve'i; püsistus teeb tingimusliku DRAFT/CAS-kirjutuse ning FINAL või stale
versioon lõpeb 409-ga enne tasulist tööd. Päris PostgreSQL-i sond tõendas refine-vs-PATCH,
refine-vs-approve ja FINAL-refine kaotajate nullmutatsiooni/null-slot'i; kogu sond 13/13 PASS ning
sihttestid 34/34 PASS.

### SOL-COMP-03 — protsessi katkemine võib jätta refinement-slot'i jäädavalt kasutatuks — P2

**Tõend.** `claimRefinementSlot()` loendab kõik sama artefakti `ARTIFACT_REFINE` auditiread, võtab advisory-lock'i ja loob enne mudelikõnet püsiva rea `meta.pending:true` (`lib/documents/refinementSlots.js:32-59`). Rida kustutatakse ainult sama request'i veakäsitluses `releaseRefinementSlot()` kaudu; mudulis ega `DocumentAudit` skeemis pole aegumist, lease'i, stale-seisu ega sweeper'it (`:65-81`; `prisma/schema.prisma:3864-3880`). Mudelikutsedel puudub rakenduse timeout/cancellation-leping (`lib/documents/generation.js:628-647,750-769`). Protsessi crash, restart või lõputult rippuv provider pärast claim'i ei jõua release'ini; järgmised katsed loevad pending rea kasutatud kolme hulka. Negatiivkontroll kinnitas pending-loenduse ja recovery-mehhanismi puudumise.

**Mõju.** Üks infrastruktuuritõrge võib vähendada artefakti kolme paranduse limiiti püsivalt; kolm sellist tõrget lukustavad refinement'i täielikult, kuigi kasutaja ei saanud ühtegi tulemust. Audititabelis näeb pooleli rida samasse action-perekonda kuuluva toiminguna.

**Vastuvõtukriteerium.** Pending-slot vajab lease/`expiresAt`/state-masinat ja idempotentsusvõtmega omandit; retry peab sama slot'i jätkama või aegunud slot'i auditeeritult vabastama. Provideril peab olema serveripoolne tähtaeg. Crash-probe peab tapma protsessi pärast claim'i, käivitama uue protsessi ning tõendama, et slot taastub ja kinnitatud auditiridu ei kustutata; mitme protsessi sama võtmega test tõendab üht slot'i ja üht tulemust.

**Seis.** DONE — poolelioleval refinement'il on nüüd lease, claim-token, katseloendur ja olek;
aegunud töö võetakse sama rea, sama idempotentsusvõtme ja sama pending-slot'iga üle ning vana
protsessi claim ei saa enam tulemust kirjutada. Ebaõnnestumine eemaldab ainult pending-auditi,
kinnitatud audit jääb puutumata, ning providerikutsel on serveripoolne 90-sekundiline vaikimisi
tähtaeg. Päris PostgreSQL-i sond tõendas lease'i ülevõttu kahe kliendiga, vana claim'i fencing'ut,
ühte job'i/slot'i/tulemust ja uue claim'i edukat lõppu (13/13 PASS); sihttestid 34/34 PASS.

### SOL-COMP-04 — kliendi lähtefail võib jääda peidetult alles ja kasutajal puudub selle haldamisvaade — P1

**Tõend.** Kliendi upload on kaks eraldi HTTP-toimingut: esmalt `POST /api/documents`, seejärel eraldi PATCH `agentAllowed:true` (`components/agent/AgentModePage.jsx:813-855`). Teise sammu vea catch ei kustuta esimeses sammus loodud DB-rida/faili ega paku taastamislinki. „Eemalda” teeb ainult PATCH-i `agentAllowed:false` ja eemaldab ID Reacti mälust (`:875-899`); faili ega DB-rida ei kustutata. Kliendi `/documents` leht suunab alati tagasi `/dokreziim` (`app/documents/page.js:39-41`) ning koostamisvaade ei lae kliendi dokumentide omaniku-loendit. Upload/remove ei kirjuta valitud ID-de muutust kohe URL-i; `buildWorkspaceHref()` kasutab küll `documents` query't, kuid handlerid ei kutsu pärast valiku muutust routerit (`components/agent/AgentModePage.jsx:260-266,813-899`). Negatiivkontroll kinnitas kahefaasilise osalise vea, revoke-only eemaldamise ja kliendiraamatukogu puudumise.

**Mõju.** Tundlik abipalve või muu kliendifail võib PATCH-i vea või näilise eemaldamise järel jääda hoidlasse ja kvooti kulutama, kuid kasutajal pole tavalisest UI-st enam võimalust seda näha, uuesti valida, alla laadida ega päriselt kustutada. Reload võib omakorda kaotada värskelt üles laaditud valiku või taastada URL-ist vana keelatud valiku.

**Vastuvõtukriteerium.** Kliendi upload peab looma faili ja soovitud agendiloa ühe serveripoolse terviktoiminguna või tegema teise sammu vea korral auditeeritud kompenseeriva kustutuse/püsiva recovery-seisu. Kliendil peab olema kõigi oma lähtefailide owner-skoobitud, pagineeritud vaade koos download'i ja päris DELETE-iga; „eemalda töölt” ja „kustuta fail” peavad olema eri, ausad toimingud. Valik peab URL-i/sessiooni olekuga koherentselt püsima. Negatiivtestid: PATCH-viga pärast upload'i, reload enne genereerimist, remove → reload, 11+ faili ning cleanup-viga.

**Seis.** DONE — kliendi upload saadab nüüd soovitud `agentAllowed:true` POST-is ning server
lubab selle ainult CLIENT + MATERIAL kombinatsioonile ja kirjutab loa sama kvoodiluku,
andmebaasitehingu ning staged-file publish'i sees; eraldi PATCH-i ega selle järel tekkivat
peidetud orb-rida enam ei ole. „Eemalda” muudab ainult töö valikut ja URL-i, püsifail jääb
raamatukokku; `/documents` on kliendile owner-skoobitud pagineeritud „Minu lähtefailid” vaade
eraldi download'i ja pöördumatu DELETE-toiminguga. Vana koodi vastane kontroll oli 0/3;
sihttestid 18/18 PASS. Playwright tõendas päris upload'i ühe POST-iga, reload'il URL-valiku
taastumise, remove → reload valiku puudumise koos alles DB-rea/failiga, 12 faili nähtavuse ning
raamatukogu DELETE-i; järelkontroll kinnitas rea ja faili kadumise ning `DataDeletionJob=done`
(1 katse). Stagingu vea­süstid jäid roheliseks ning katsesisu koristati.

### SOL-COMP-05 — FINAL-artefakti provenants ja allalaaditav dokument ei ole kinnitamise hetke suhtes muutumatud — P1

**Tõend.** `AgentArtifactSourceDocument` talletab ainult `artifactId`, `documentId` ja `createdAt`; tal pole lähtefaili SHA-d, revision'i, pealkirjasnapshot'i ega kasutatud chunk'ide viiteid ning lähtefaili kustutus cascade'ib seose (`prisma/schema.prisma:3852-3861`). Malliseos on `onDelete:SetNull` (`:3798-3824`). Genereerimisel seotakse kõik valitud dokumendi-ID-d, kuid retrieval'i detailist pannakse best-effort auditisse ainult `chunksUsed`, `documentsIndexed`, tokenieelarve ja fallback'i loendurid; `AgentArtifact.metadata`-sse debug/evidence snapshot'i ei kirjutata (`lib/documents/persistDraft.js:40-48,79-119`). RAG võib kasutada ainult osa valitud dokumentide chunk'e, kuid serialiseeritud artefakt ja UI näitavad kõiki valitud dokumente ühe `sources/sourceCount` loendina. FINAL download loeb igal päringul hetke mallifaili ja hetke allikaseosed ning genereerib DOCX/PDF uuesti (`app/api/documents/artifacts/[id]/download/route.js:84-120`). Auditispetsiifilised negatiivkontrollid kinnitasid, et lähte kustutus/rename või malli kadumine muudab järgmise allalaadimise sisendit ilma FINAL-artefakti revision'ita.

**Mõju.** Sama kinnitatud artefakti kaks hilisemat allalaadimist võivad erineda paigutuse ja allikaloendi poolest. Pärast lähte kustutamist ei saa tõendada, millisest failiversioonist või millistest chunk'idest sotsiaaltöö dokument koostati; kõigi valitud failide kuvamine võib jätta eksliku mulje, et igaüks neist toetas väljundi väiteid.

**Vastuvõtukriteerium.** Kinnitamisel peab tekkima muutumatu provenantsimanifest: artefakti/content hash, mudeli ja prompti versioon, iga lähte ID + kinnitamiseaegne SHA/revision/pealkiri, tegelikult kasutatud chunk-ID-d/ranges ning malli hash või renderdatud faili püsiv hash/koopia. Lähte kustutus säilitab mittetundliku tombstone-manifesti ega muuda FINAL-revision'i. Sama FINAL-i kordusdownload peab olema bititasemel või versioonitud manifesti järgi deterministlik. Negatiivtestid peavad rename'ima ja kustutama lähte, kustutama malli ning muutma retrieval'i chunk'e pärast approve'i; vana download/provenants jääb muutumatuks.

**Seis.** DONE — FINAL-kinnitus loob nüüd sama tehingu sees muutumatu
`AgentArtifactFinalSnapshot` rea: manifest külmutab sisu räsi, mudeli ja prompti versiooni,
tegelikult kasutatud chunk-ID/indexi/tekstiräsi, iga allika kinnitamiseaegse ID/pealkirja/SHA/
revision'i ning malli SHA/revision'i. DOCX- ja toetatud PDF-baidid koos räsidega säilivad
hetktõmmises; allalaadimine loeb ainult neid baite ja kontrollib terviklust, mitte enam elavat
malli ega allikaseoseid. Hetktõmmise maht kuulub kasutaja kvooti ning renderi või kvoodi viga
rollback'ib ka FINAL-muutuse. Vana koodi vastane kontroll oli 0/3; sihttestid on 29/29 PASS,
179 migratsiooni täisahel roheline ja päris PostgreSQL-i sond 11/11 PASS (allika rename/delete,
malli delete, retrieval-meta muutmine, FK-kaskaad, DOCX/PDF baitidentsus ja rollback). Autenditud
Playwrighti brauserikontekst sai manifesti detail-API-st 200 ning kaks DOCX-i (2906 baiti) ja
kaks PDF-i (809 baiti) 200-vastustena; mõlema formaadi kordused olid bait-identse SHA-256-ga.

## Testid ja negatiivkontrollid

### Sihttestid

Audit-worktree's puudus algul genereeritud Prisma klient. Esimene eeljooks andis **54 PASS / 4 testifaili load-fail** (`generated/prisma/client.ts` puudus); see ei olnud rakenduse semantiline testitulemus. `npx prisma generate` käivitati mittetoimiva lokaalse dummy-`DATABASE_URL`-iga ainult ignoreeritud `generated/prisma` kausta jaoks: **PASS**, Prisma 7.8.0; andmebaasi ei ühendatud.

Pärast eeltingimuse taastamist:

```text
node --import ./scripts/register-node-test-loader.mjs --test tests/documents/documentsResearchContracts.test.js tests/documents/artifactMutation.test.js tests/documents/artifactPdfExport.test.js tests/documents/workspaceModel.test.js tests/documents/savedAnalysisContracts.test.js tests/usage/paidResult.test.js tests/usage/intentKey.test.js tests/usage/routeAdapter.test.js tests/usage/service.test.js tests/rag/agentDocumentIsolation.test.js
```

Tulemus: **88/88 PASS**, 0 fail, 0 skipped, kestus **1 717 ms**.

Laiendatud Koosta dokument / Dokumendid / RAG / usage sihtkogum:

```text
node --import ./scripts/register-node-test-loader.mjs --test tests/documents/*.test.js tests/rag/agentDocumentIsolation.test.js tests/usage/paidResult.test.js tests/usage/intentKey.test.js tests/usage/routeAdapter.test.js tests/usage/service.test.js
```

Tulemus: **145/145 PASS**, 0 fail, 0 skipped, kestus **62 557 ms**. Koosolekukokkuvõtte testide konsoolis olid tahtlikud provider-, faili- ja dummy-DB veasüstid; protsessi lõpptulemus oli 145 PASS. Need testid ei tõenda päris OpenAI/RAG/PostgreSQL-i ega brauserit.

### Auditispetsiifilised negatiivkontrollid

Kõik **8/8 PASS**:

1. refinement'i tekst elab ainult HTTP-vastuses/Reacti olekus ja püsivat artefakti ei uuendata;
2. refine-route aktsepteerib omaniku artefakti ilma DRAFT- ja versioonitingimuseta;
3. Stop katkestab ainult brauseri fetch'i ning signaal ei jõua route'i ega mudelikutsesse;
4. pending refinement-slot loetakse limiiti, kuid tal puudub expiry/stale-cleanup;
5. kliendi upload on kaheosaline, remove muudab ainult `agentAllowed` lippu ja `/documents` suunab kliendi ära;
6. provenants talletab elavad relation-ID-d, mitte lähteversiooni või retrieval-evidence'i snapshot'i;
7. FINAL download genereeritakse iga kord hetke mallist ja hetke allikaseostest;
8. kliendi artefaktid lõpevad 10 ning mallivalik 50 real ilma jätkuteeta.

## Olemasolevate leidudega kontrollitud kattuvused

- `SOL-DOC-01` on DONE ja fikseeritud kood püsistab genereeritud mustandi enne tasu. `SOL-COMP-01` ei ava genereerimise settlement'i uuesti: ta käsitleb pärast edukat serveritööd response-only refinement'i reload/Stop/vastuse-kao elutsüklit, mille tulemust ei ole retry jaoks kuskil.
- `SOL-DOC-03` artefakti PATCH/approve CAS ja FINAL-kaitse töötavad ning neid ei dubleeritud. `SOL-COMP-02` on varasem, eraldi tasuline refine-kutse, mille route CAS-i ega DRAFT-i ei nõua.
- `SOL-DOC-05` atomaarne kolme slot'i piir on DONE ja testid rohelised. `SOL-COMP-03` ei väida, et paralleelne loendus ületab kolme; ta tõendab crash/restart-järgse pending-slot'i recovery puudumist.
- `SOL-DOC-J-02` katab `UserDocument` stale PATCH-i ja `SOL-DOC-J-03` `agentAllowed` tagasivõtmise RAG-cleanup'i. `SOL-COMP-04` ei saanud nendele uut ID-d; uus leid on kliendi faili loomise, leitavuse ja päris kustutamise UI/serveri tervikahel.
- Kliendi viimase 10 artefakti ja töötaja esimese 50 malli katkestus on sama owner-list/paginatsiooni probleem nagu `SOL-DOC-J-01`; seda ei dubleeritud uue leiuna, vaid negatiivkontroll laiendab vana leiu ulatust.
- FINAL approve, artifact download ja delete kasutavad best-effort `logDocumentsAudit()` rada. Seda mehhanismi ei dubleeritud: see kuulub olemasoleva `SOL-DOC-J-06` alla, mille ulatusse tuleb parandamisel lisada ka irreversible approve.
- `SOL-DOC-J-06` ei kata `SOL-COMP-05` provenantsi muutuvust: auditi olemasolu ei külmuta lähte revision'i, kasutatud chunk'e, malli ega allalaaditavat faili.
- `SOL-VOICE-03` puudutab STT/TTS providerite timeout'i. Koosta dokument mudelikutse abort/timeout jäi `SOL-COMP-01`/`-03` tõendisse, mitte uue VOICE-ID alla.
- Põhiauditi `SOL-DOC-01`–`09` ametlik seis loeti iga leiu `Seis`-lõigust; `parandusaudit.md` koondtabelit kasutati ainult indeksina.

## Leidude koond

| Prioriteet | Arv |
|---|---:|
| P0 | 0 |
| P1 | 3 |
| P2 | 2 |
| P3 | 0 |
| **Kokku** | **5** |

## Mis jäi tõendamata

- Päris autentitud brauseris kliendi ja töötaja kogu compose-voog, mobiil/klaviatuur, reload ning Stop täpsetel serveriajastustel.
- Päris OpenAI vastuse järel võrgu katkestus ja tõend, kas SDK/provider jätkab tööd pärast brauseri aborti; staatiline kood tõendab ainult katkestussignaali puudumist.
- Päris PostgreSQL-is refine vs PATCH/approve võistlus, protsessi tapmine pending-slot'i järel ja mitme protsessi idempotentne retry.
- Päris RAG-is kahe lähtefaili retrieval, ühe allika null chunk'i juht, fallback, prompt-injection'i vastupidavus ja väitepõhine evidence/citation'i õigsus.
- Päris failisüsteemis kliendi uploadi teise sammu viga, compensating cleanup, malli/lähte kustutus pärast approve'i ning kahe allalaadimise baitide võrdlus.
- Kas valdkondlik tooteotsus nõuab claim-level tsitaate või piisab muutumatust lähte-/chunk-manifestist; praegune kood ei tõenda kumbagi.
- Klastriülene rate-limit: compose-route'id kasutavad protsessisisest limiterit, kuid selle reaalset deploy-topoloogiat ega mitme instantsi möödumist ei mõõdetud; `NOT_PROVEN`, uut leidu ei lisatud.
- Konto kustutuse, andmekoopia ja 90 päeva retention'i päris worker/runtime; eelmise Dokumendid-ploki staatiline katvus ei muutu runtime-tõendiks.

## Järgmine soovitatud auditimoodul

**Välitöö** — lõpetada esimese ploki järel ülejäänud kasutajavaated, manused, audio, üleandmine, samaaegsus, konto kustutus/retention ja päris runtime. See on auditi määratud järjekorras järgmine veel lõpetamata tervikmoodul.
