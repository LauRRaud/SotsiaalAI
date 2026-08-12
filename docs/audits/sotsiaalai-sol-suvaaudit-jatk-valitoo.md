# SotsiaalAI SOL-süvaaudit — jätk: Välitöö

**Auditi seis:** Välitöö kasutajaliidese, offline-kesta, sünkroonimise, märkmete, nõusolekute, foto/heli/OCR-i, ohutussignaali, üleandmise, Teenuspäeviku silla, Prisma kandjate, retention'i, konto kustutuse ja andmekoopia staatiline tervikahel `DONE`; päris autentitud seadme- ja serveriruntime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `eaca270b940178eb19bbecce6688394a90704425`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-field-eaca270` (detached HEAD). Auditi ajal ei kasutatud tõendina põhi-worktree dirty faili `app/styles/carousel.css`, teise akna commit'imata parandusi ega vana `SotsiaalAI-sol-audit-cfa62ea` koopiat.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Kasutajale nähtavad lehed ja sisenemisteed | DONE | `/valitoo`, `/valitoo/[visitId]`, töölaua continuity-süvalink, suletud külastuse Teenuspäeviku link, rollipõhine nähtavus ja offline-navigeerimine |
| React ja olekuhaldus | DONE | külastuse loomine/list, ettevalmistus, faasid, kohalik pakett, saabumise/lahkumise markerid, märkmed, nõusolekud, foto, heli, review, konflikt, OCR/transkriptsioon, üleandmine, sulgemine ja kohalik purge |
| API, autoriseerimine ja mahupiirid | DONE | visit list/create/detail/PATCH, note PUT/DELETE, attachment PUT/DELETE, OCR ja handover; sessioon, roll, owner-404, CAS, idempotentsus, rate-limit ja salvestuskvoot |
| Offline, samaaegsus ja stale-andmed | DONE | IndexedDB/WebCrypto kandja, SW-leping, üheksa olekuga sünkroonimismasin, retry scheduler, reconcile, paketiretention, markerid, note revision/conflict ning sulgemise ja üleandmise võidujooksud |
| Prisma ja migratsioonid | DONE | `FieldVisit`, `FieldVisitNote`, `FieldVisitAttachment`, `UserDocument`, `AgentArtifact`, owner-/preInquiry-/document-seosed ning migratsioon `20260719140000_field_v1_mobile_shell` |
| Failid, RAG, OCR, SMTP ja välised koopiad | DONE | foto/heli signatuur ja metadata sanitiseerimine, fail–DB järjekord, OCR temp-fail, dokumendi transkriptsioonirada, ohutussignaali e-post, artefakti/eelpöördumise üleandmine ja Teenuspäeviku päritolulink |
| Konto kustutus, andmekoopia ja retention | DONE | failide fail-closed konto kustutus + owner cascade, külastuse/märkmete 90 päeva, foto üldretention, toorheli 7 päeva/kinnitatud transkript, kohalikud tähtajad ja `DATA_EXPORT_REGISTRY` |
| Päris runtime | NOT_PROVEN | autentitud Android/iOS/PWA, päris PostgreSQL, SMTP, OCR/Tesseract, transkriptsioon, mitme protsessi võistlus, võrgu katkestus ja konto kustutuse lõppkontroll `not_run`; päris Chromiumi IndexedDB/WebCrypto sihtsond läbis 35/35, kuid ei asenda tervikruntime'i |

## Auditeeritud failid ja funktsioonid

- `app/valitoo/page.jsx`, `app/valitoo/[visitId]/page.jsx`, `components/field/FieldShell.jsx`, `FieldVisitRoom.jsx`, `useFieldSync.js`; kõik kasutajateed, faasid, kohalik/sünkroonitud sisu, sisendid, review, üleandmine, sulgemine ja purge.
- `app/api/field/visits/route.js`, `[id]/route.js`, `[id]/items/[clientItemId]/route.js`, `[id]/attachments/[clientItemId]/route.js`, selle `ocr/route.js` ning `[id]/handover/route.js`; autentimine, roll, owner-skoop, sisend, rate-limit ja veavastused.
- `lib/field/service.js`; `createFieldVisit()`, `listFieldVisits()`, `getFieldVisitDetail()`, `casVisitUpdate()`, `performFieldVisitAction()`, `putFieldVisitNote()`, `deleteFieldVisitNote()` ja `handoverFieldVisit()`.
- `lib/field/attachments.js`, `imageSanitize.js`, `ocr.js`; `putFieldVisitAttachment()`, `deleteFieldVisitAttachment()`, `confirmFieldTranscript()`, pildi-/helisignatuur, EXIF/XMP eemaldamine, OCR temp-fail ja cleanup.
- `lib/field/syncMachine.js`, `syncScheduler.js`, `visitMarkers.js`, `localStore.js`, `localRetention.js`; olekusiirded, backoff, reconcile, AES-GCM IndexedDB, paketi/üksuse retention ja offline-markerid.
- `lib/field/safety.js`, `app/api/jobs/notifications/route.js`; meeldetuletus, eskalatsiooni claim/retry, SMTP, lahendusteade ja notification-job'i käivitusjärjekord.
- `lib/field/retentionSweep.js`, `lib/retention.js`, `lib/privacy/userDeletion.js`, `userDeletionOrchestrator.js`, `lib/dataExport/registry.js`; serveriretention, faili/RAG kustutus, konto kustutuse retry ning andmekoopia projektsioonid.
- `lib/serviceLog/fieldBridge.js`, `entryDerivation.js`, `app/api/service-visits/**`, `lib/workspaces/adapters/fieldVisitAdapter.js`, `lib/workspaceContinuity.js`; Teenuspäeviku eeltäide, päritoluväide ja töölaua descriptor.
- `prisma/schema.prisma`, `prisma/migrations/20260719140000_field_v1_mobile_shell/migration.sql`, `lib/documents/storageQuota.js`, `storageUsage.js`, `audioWorkflow.js`, `rateLimit.js`.
- Põhiauditi `SOL-FIELD-01`–`06` kõik `Seis`-lõigud, `SOL-NOTIF-06`, `SOL-SLOG-05`, `SOL-DOC-07`, parandusauditi koondseis ning Välitöö disainilepingu kasutus-, nõusoleku-, offline-, faili-, retention- ja runtime-osad.

## Leiud

### SOL-FIELD-J-01 — külastuse saab sulgeda lahendamata `FAILED/CONFLICT` sisuga ja see muutub serverisse saatmatuks — P1

**Tõend.** Hook loendab `pendingCount` hulka ainult `DEVICE_ONLY`, `QUEUED` ja `UPLOADING` üksused; `FAILED` ja `CONFLICT` on eraldi `failedCount` (`components/field/useFieldSync.js:641-655`). Sulgemisnupp blokeerub ainult `sync.pendingCount > 0` korral ega arvesta `failedCount` väärtust (`components/field/FieldVisitRoom.jsx:899-913`). Serveri `close`-toiming ei tea seadme kohalikest üksustest ja viib `WRAP_UP` külastuse `CLOSED` olekusse (`lib/field/service.js:493-499`). Pärast seda keelavad nii märkme kui manuse serverirajad kõik hilised sünkroniseerimised `409 visit_read_only` vastusega (`lib/field/service.js:259-263,590-597`; `lib/field/attachments.js:44-51`). `reopen` töötab ainult `WRAP_UP → IN_PROGRESS`, mitte `CLOSED` külastusel (`lib/field/service.js:457-460`). Sulgemine eemaldab kohaliku külastuspaketi kohe, kuigi lahendamata üksused jäävad eraldi IndexedDB-sse. Auditispetsiifiline negatiivkontroll kinnitas sulgemisvärava ja `pendingCount` olekuloendi lahknemise; olemasolev test kinnitab omakorda, et suletud külastuse hiline sünk saab 409.

**Mõju.** Töötaja võib sulgeda külastuse ajal, mil püsiv 4xx-viga või kahe seadme konflikt on veel lahendamata. Sisu ei kao kohe seadmest, kuid tal puudub enam seaduslik serveritee: retry ebaõnnestub püsivalt ning märkmed, nõusolek või fail võivad jääda ainult ühte telefoni kuni kasutaja need teadlikult kustutab.

**Vastuvõtukriteerium.** Praeguse seadme sulgemisvärav peab blokeerima kõik mitteterminaalsed ja lahendamata olekud, sh `FAILED`, `CONFLICT` ja auth-park; UI peab viima kasutaja vea lahendamiseni. Mitme seadme jaoks on vaja ausat sulgemislepingut: kas serveripoolne seadme/sünk-manifest või suletud külastuse kontrollitud recovery-import, mis ei muuda ametlikku suletud sisu vaikselt. Negatiivtestid peavad katma `FAILED`, `CONFLICT`, aegunud sessiooni, teise seadme ootel üksuse ja close-vs-upload võidujooksu.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-02 — serverisse jõudnud märkmed kaovad omanikuvaatest ning „Eemalda” kustutab ainult seadmekoopia — P1

**Tõend.** Detail-API tagastab kuni 500 `FieldVisitNote` rida (`lib/field/service.js:320-329`), kuid komponent kasutab `serverNotes` loendit ainult kehtiva nõusoleku leidmiseks (`components/field/FieldVisitRoom.jsx:89-93,213-227`). Järeltöö loend renderdab ainult `sync.items` kohalikke üksusi (`:748-789`). Sünkroonitud kohalik koopia kustub retention'i järgi seitsme päeva järel, mistõttu teises seadmes või pärast kohalikku purge'i pole serverimärge enam kasutajale nähtav. Iga kohaliku üksuse „Eemalda” kutsub `sync.deleteItem()`; hook viib `SYNCED` rea ainult kohalikku `PURGE_PENDING → REMOVED` seisu ega kutsu serveri DELETE-route'i (`components/field/useFieldSync.js:490-501`). Serveri päris `deleteFieldVisitNote()` on olemas (`lib/field/service.js:800-817`), kuid UI ei kasuta seda. Samas loeb üleandmine kõik serverimärkmed ja võib need artefakti või eelpöördumise teksti kopeerida (`:853-867`). Negatiivkontroll kinnitas, et `serverNotes.map()` ega muu serverimärkmete kuvatee puudub.

**Mõju.** Omanik ei saa pärast seadmekoopia kadumist vaadata, parandada ega kustutada serveris alles olevat klienditöö sisu, kuid sama nähtamatu sisu võib jätkuvalt jõuda üleandmisse ja säilida 90 päeva. Nupp „Eemalda” võib jätta eksliku mulje, et märge eemaldati külastusest, kuigi kustus ainult ühe seadme koopia.

**Vastuvõtukriteerium.** Järeltöö peab kuvama owner-skoobitult serverimärkmed koos päritolu, revision'i, konflikti ja kustutus-/parandusolekuga ning eristama sõnastuses „eemalda sellest seadmest” ja „kustuta serverist”. Serverikustutus peab olema auditeeritud ja nõusoleku tagasivõtuga koherentne. Testida uus seade ilma kohalike kirjeteta, 7 päeva local purge, serverimärkme muutmine/kustutus, suletud külastuse read-only semantika ja seda, et üleandmise valik vastab täpselt nähtavale loendile.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-03 — offline-avaleht ei leia seadmesse võetud külastusi ja online-loend lõpeb 50 rea juures — P2

**Tõend.** Võrguta `FieldShell.loadVisits()` jätab olemasoleva Reacti loendi alles või seab selle tühjaks; ta ei loe IndexedDB `listPacks()` ridu (`components/field/FieldShell.jsx:44-58`). Seega pärast värsket käivitust või reload'i offline'is näitab `/valitoo` tühja loendit ka siis, kui seadmes on kehtiv külastuspakett. Üksiku külastuse deep-link oskab paketi avada, kuid kest ei anna sellesse sisenemisteed. Online-server tagastab vaikimisi ainult 50 viimati muudetud külastust `take: 50` abil; route'il ja UI-l puuduvad cursor, `hasMore` ja „näita rohkem” (`lib/field/service.js:302-318`; `app/api/field/visits/route.js:9-20`; `components/field/FieldShell.jsx:243-282`). Detailis on lisaks vaiksed 500 märkme ja 200 manuse laed ilma lehitsemiseta (`lib/field/service.js:320-345`). Negatiivkontroll kinnitas nii offline-tühiloendi kui cursorita 50 rea piiri.

**Mõju.** Välitöö põhieesmärgi olukorras — ühenduseta kohale jõudes — ei pruugi töötaja seadmesse võetud külastust üldse üles leida, kui tal pole täpset deep-link'i. Pikaajalisel kasutajal kaovad vanemad, sh lõpetamata kirjed omanikuvaatest; 500+ märkmega külastuse üleandmine/vaade võib olla vaikse kärpega.

**Vastuvõtukriteerium.** Offline `/valitoo` peab loetlema kehtivad kohalikud paketid minimaalse krüptitud projektsiooniga ja viima deep-link'i; online-loend vajab stabiilset cursor-paginatsiooni ning eraldi avatud/suletud filtri ausat koguarvu. Detaili märkmed/manused vajavad cursorit või selget mahuväravat. Brauseritest: fresh reload offline'is vähemalt kahe paketiga, aegunud paketi puudumine, 51+ külastust, 501+ märget ja lehekülgede vahel muutuv `updatedAt`.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-04 — üleandmise kordus loob duplikaadid ja kahe sihtkoha päring võib jääda pooleldi õnnestunuks — P1

**Tõend.** Handover POST ei võta idempotentsusvõtit, payload'i sõrmejälge, külastuse versiooni ega varasema üleandmise precondition'i (`app/api/field/visits/[id]/handover/route.js:15-27`). `toArtifact` loob igal kutsel tingimusteta uue `AgentArtifact` rea (`lib/field/service.js:853-896`). `toPreInquiry` lisab sama teksti iga kord `receiverNote` lõppu (`:899-930`); roheline test nimetab oodatud käitumiseks „a repeated pre-inquiry handover appends again instead of duplicating or replacing”. UI saadab vaikimisi artefakti ja lisatud eelpöördumisteksti korral mõlemad sihid ühe POST-iga (`components/field/FieldVisitRoom.jsx:392-423,858-895`). Need täidetakse eri tehingutes, artefakt esimesena. Kui artefakt commit'ib ja eelpöördumise workflow annab stale/404/500, vastab kogu POST veaga, kuigi artefakt on juba loodud; retry loob teise artefakti ja võib teksti uuesti lisada. Handover-templid on ainult ajatemplid, mitte kasutuskõlblikud dedupe-võtmed.

**Mõju.** Topeltklõps, aeglane vastus või pärast osalist edu tehtud retry võib tekitada mitu näiliselt eri kokkuvõtet ja korduva eelpöördumise teksti. Kasutajale kuvatakse „üleandmine ebaõnnestus”, kuigi osa andmeid on juba teise kandjasse kopeeritud.

**Vastuvõtukriteerium.** UI peab looma püsiva `clientActionId` võtme; server seob selle omaniku, visiidi, sihtide ja kanoonilise payload'i hashiga. Sama võti/sama sisu tagastab samad siht-ID-d, sama võti/eri sisu annab 409. Kahe sihi puhul peab olema kas üks atomaarne tehing või püsiv per-target saga/outbox, mille vastus näitab iga sihi `DONE/PENDING/FAILED` seisu ja mille retry jätkab ainult puuduvat osa. Testida topeltklõpsu, vastuse kaotust, stale eelpöördumist pärast artefakti loomist, auditiviga ja kahte paralleelset request'i.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-05 — fotonõusolekust saab mööduda kliendi juhitava `documentOnly` lipuga — P1

**Tõend.** Disainileping ütleb, et foto sisend ei avane ilma nõusolekuta, välja arvatud töötaja teadlik valik „kliendi dokument, kliendi palvel” (`docs/platvormi arendus/fable-5-valitoo-mobiilne-kest.md:102,122,261-263`). Tegelik UI avab kaamera alati; nõusoleku puudumisel seab ta automaatselt `documentOnly: true`, ilma eraldi valiku, kinnituse või põhjuseta (`components/field/FieldVisitRoom.jsx:229-249,680-690`). Multipart-route usaldab sama kliendivälja boole'ina (`app/api/field/visits/[id]/attachments/[clientItemId]/route.js:53-64`). Server nõuab fotonõusolekut ainult siis, kui `documentOnly` on false (`lib/field/attachments.js:154-161`), kuid ei tõenda kliendi palvet, ei talleta seda erandit `FieldVisitAttachment` real ega kirjuta eraldi auditit. Otse-API klient saab seega iga foto, sh inimesega foto, saata `documentOnly=true` abil. Pildi signatuur ja EXIF-puhastus on korrektsed, kuid need ei tõenda foto sisu ega töötlemisalust.

**Mõju.** Tundlik foto inimesest, kodust või dokumendist võib jõuda püsivasse `UserDocument` hoidlasse ilma nõusolekukirje või tõendatava erandi aluseta. Hiljem pole võimalik eristada päriselt kliendi palvel pildistatud dokumenti sellest, millele klient lihtsalt pani usaldatud lipu.

**Vastuvõtukriteerium.** Foto avamise ees peab olema serveris tõendatav nõusolekukirje või eraldi teadlik „kliendi dokument kliendi palvel” toiming koos põhjuse, aja ja auditiga; vaikimisi ei tohi nõusolekuta foto muutuda erandiks. Erand peab kanduma attachment metadata/projektsiooni ja olema tagasivõetav. Negatiivtestid: puuduv/DEVICE_ONLY/tagasivõetud/teist liiki nõusolek, otse-API `documentOnly=true`, erandita inimese foto ning erandi hilisem audit ja kustutus.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-06 — manuse faili ja DB terviklikkus pole vea järel taastatav — P1

**Tõend.** Upload avaldab lõpliku faili enne `UserDocument` + `FieldVisitAttachment` tehingut (`lib/field/attachments.js:196-239`). DB-vea catch kutsub `unlinkStored(storagePath)`, kuid ei kontrolli selle boolean-tulemust ega loo püsivat cleanup-job'i; `unlinkStored()` tagastab tavalisel failisüsteemiveal lihtsalt `false` (`:89-97,240-258`). Nii jääb DB-vea + cleanup-vea kombinatsioonis orb-fail ilma reata ja retry-ta. Kustutus teeb vastupidise lahknemise: esmalt kustutab faili (`:281-295`), seejärel alustab attachment'i, dokumendi ja kohustusliku auditirea DB-tehingut (`:297-315`). Kui DB või audit ebaõnnestub, rollback jätab read alles, kuid faili tagasi luua ei saa. Põhiauditi `SOL-FIELD-03` parandas auditi atomaarseks DB-ga, kuid ei lahenda failisüsteemi ja DB ühist commit'i; uus rada on seega sama paranduse kõrval avanenud failipiiri viga. Negatiivkontroll kinnitas mõlemad järjekorrad ja püsiva cleanup-kandja puudumise.

**Mõju.** Üleslaadimise järel võib tundlik fail jääda kettale ilma omanikuvaate, retention'i või konto kustutuse DB-sihtmärgita. Kustutamisel võib kasutajale küll tulla viga, kuid nähtav DB-rida osutab juba kadunud failile; järgmine download/transkriptsioon/OCR ebaõnnestub ja puudub automaatne parandustee.

**Vastuvõtukriteerium.** Faili loomine/kustutus vajab püsivat staging/tombstone + retry protokolli: avaldamata temp-fail, DB-s claim/soovitud seis, idempotentne failisammu job ja reconciler. Aktiivne DB-rida ei tohi kunagi osutada puuduvale failile; orb-fail peab olema töö-ID/omaniku järgi leitav ja kustutatav. Veasüstetestid peavad katkestama kirjutuse, rename'i, DB create'i, auditirea, unlink'i ja DB delete'i järel ning pärast restarti tõendama kas terviklikku aktiivset manust või lõpetatud kustutust, mitte lahknemist.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-07 — Välitöö upload avab `SOL-DOC-07` parandatud kvoodivea uuel rajal — P2

**Tõend.** Põhiauditi `SOL-DOC-07` seis on `DONE`: tavalised dokumendirajad kasutavad `withStorageQuota()` kasutajapõhist PostgreSQL advisory-lock'i ja mõõdavad/kirjutavad sama tehingu sees (`lib/documents/storageQuota.js:42-82`). Välitöö manuserada seda helperit ei kasuta. Ta loeb `getUserStorageUsageBytes()` ja päevamahu eraldi enne faili kirjutust ja DB-tehingut, seejärel loob faili/rea vana loe-summa → kirjuta mustriga (`lib/field/attachments.js:183-203`). Mõlemad mõõtmised kasutavad vaikimisi globaalset Prisma singletoni, mitte hilisema tehingu `tx` klienti (`lib/storageUsage.js:8-69,71-102`). Kaks eri `clientItemId`-ga paralleelset upload'i võivad mõlemad mahtuda sama vana summa järgi ja ühiselt ületada salvestus- või päevakvoodi. 12/min mälupõhine rate-limit ei serialiseeri kahte lubatud päringut ega kehti protsessideüleselt (`app/api/field/visits/[id]/attachments/[clientItemId]/route.js:14-16,40-46`). Auditispetsiifiline kontroll kinnitas `withStorageQuota` puudumise.

**Mõju.** Välitöö fotode/helide kaudu saab kasutaja ületada sama paketikvoodi, mille paralleelsus tavalisel dokumendirajal on juba parandatud. Selle järel võivad kõik teised faili- ja artefaktitoimingud ootamatult 413/429 taha jääda.

**Vastuvõtukriteerium.** Rakendada Välitöö attachment create samas `withStorageQuota()` lukus ja sama süstitud `tx` kliendiga; failistaging peab sobima SOL-FIELD-J-06 taastamisprotokolliga. Päris PostgreSQL-i probe peab täitma kvoodi lähedale ja saatma paralleelselt eri visiitide foto+heli ning tavalise dokumendi upload'i: võita tohib ainult mahtu jääv hulk, lõppsumma ei ületa piiri ja kaotajad ei jäta faili.

**Seis.** NOT_DONE — `SOL-DOC-07` paranduse regressioon/katmata uus kirjutusrada; runtime: not_run.

### SOL-FIELD-J-08 — mikrofon võib pärast vaate sulgemist edasi salvestada ja kohalikul salvestusel puudub kestuse/mahu piir — P1

**Tõend.** `startRecording()` hoiab `MediaStream` muutujat ainult callback'i lokaalses sulundis; ref'i pannakse `MediaRecorder`, mitte stream (`components/field/FieldVisitRoom.jsx:252-283`). Ainus `track.stop()` asub `recorder.onstop` sees (`:268-280`). Komponendil pole unmount/pagehide cleanup-effect'i, mis peataks recorder'i ja kõik track'id. Kui kasutaja navigeerib ära, brauser läheb history kaudu teisele lehele või komponent unmount'ib salvestamise ajal, ei kutsu kood `stopRecording()`-ut. Salvestusel pole taimerit, kestuselage ega kasvava `chunksRef` mahu kontrolli; kogu blob luuakse mälus ja kirjutatakse alles peatamisel IndexedDB-sse. Serveri kuni 50 MB kontroll rakendub alles pärast kohaliku blobi loomist ja multipart-keha lugemist (`lib/documents/audioWorkflow.js:20-35,54-76`; `lib/field/attachments.js:163-180`). Negatiivkontroll leidis täpselt ühe track-cleanup'i ja mitte ühtegi recorder'i unmount-cleanup'i.

**Mõju.** Tundlik vestlus võib jätkata salvestumist pärast seda, kui töötaja arvab, et lahkus Välitöö vaatest. Pikk salvestus võib kasvatada mälu/IndexedDB kasutuse väga suureks ning alles hiljem püsiva 413-ga `FAILED` seisu jääda, kulutades seadet ja jättes heli ainult kohalikku tundlikku järjekorda.

**Vastuvõtukriteerium.** Hoida nii recorder kui stream kontrollitud ref'ides; unmount, `pagehide`, visibility-/route-muutus ja veatee peavad idempotentselt peatama recorder'i ning kõik track'id. UI peab näitama kestust ja jõustama Välitöö lepinguga koherentset kohaliku/serveri mahu- ning kestuselage enne suure blobi teket. Päris Android Chrome'i ja iOS Safari/PWA test navigeerib salvestuse ajal ära, lukustab vaate ja tapab/tab taastab rakenduse; mikrofoni indikaator kustub, ükski varjatud lisasekund ei salvestu ja ülempiiril jääb kasutajale kontrollitav, kustutatav seis.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-09 — kasutaja andmekoopia jätab külastused, märkmed, nõusolekud ja ohutussignaali välja — P1

**Tõend.** `DATA_EXPORT_REGISTRY` sisaldab profiili/nõusolekuid, vestlusi, Teekondi, Tööheaolu, saatja eelpöördumisi ning dokumente/artefakte, kuid mitte `FieldVisit`, `FieldVisitNote` ega `FieldVisitAttachment` projektsiooni (`lib/dataExport/registry.js:104-178`). Välitöö foto ja heli jõuavad ZIP-i üldiste `UserDocument` failidena ning handover-artefakt üldise artefaktina, kuid nende külastuse kontekst, eesmärk, ajad, päritoluga märkmed, nõusoleku/tagasivõtu tõend, ohutussignaali seis, konflikti kõrvalversioon ja üleandmiste seis puuduvad. Konto kustutus leiab välitöö failid üldiste dokumentidena ja `FieldVisit.owner` cascade eemaldab kolm välitöömudelit; roheline privacy-test kontrollib cascade'i, kuid mitte kustutuseelset andmekoopiat. Negatiivkontroll kinnitas Field-mudelite täieliku puudumise registrist.

**Mõju.** Kasutaja ei saa enne konto kustutust kaasa oma klienditöö Välitöö tervikajalugu ega tõendada, millised nõusolekud, märkmed, konfliktid ja üleandmised tema kontoga seotud olid. Failid ilma külastuse kontekstita pole sisuliselt täielik andmekoopia.

**Vastuvõtukriteerium.** Lisada owner-skoobitud, versioonitud Välitöö eksport: külastuse meta/ajad/olek, märkmed ja päritolu, nõusoleku minimaaltõend/tagasivõtmine, attachment'i tehnilised seosed ning üleandmise seis. Kolmandate isikute sisu tuleb andmeminimeerimise reegliga eristada, mitte kogu pinda vaikselt välja jätta. Test loob märkme, konflikti, nõusoleku tagasivõtu, foto/heli ja handover'i, genereerib ZIP-i ning tõendab vajalikud väljad, storagePath/teise omaniku puudumise ja arusaadava manifesti.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-10 — turvasignaali lahendusteade võib vaikselt saatmata jääda ning eskalatsioon võib DB-vea järel korduda — P1

**Tõend.** Lahendusteate sweep claim'ib rea, seades `safetyResolvedNotifiedAt=now` enne SMTP-d (`lib/field/safety.js:245-272`). Kui saaja või transport puudub, jätab `if (recipient && transportReady)` saatmise lihtsalt vahele, kuid kirjutab best-effort auditi, suurendab `resolvedNotices` loendurit ja jätab claim'i püsivalt „teavitatud” seisu (`:273-287`). Erinevalt esmasest eskalatsioonist ei muutu see `FAILED`-iks ega lähe retry'sse. Esmase eskalatsiooni teises suunas on `sendMail()` enne `safetyEscalatedAt/status=SENT` DB-update'i (`:202-224`); kui e-kiri läheb välja, kuid järgnev DB-update ebaõnnestub, satub catch sama katse ebaõnnestunuks märkima ja järgmine sweep võib saata sama häire uuesti (`:225-241`). Koodikommentaar lubab vastupidist, kuid SMTP kõrvaltoimet ei saa DB-ga rollback'ida. Spetsiaalset safety-testi ei ole; negatiivkontroll kinnitas transporti puudumisel eduks loetava resolved-haru.

**Mõju.** Usalduskontakt võib jääda arvama, et töötaja on endiselt ohus, sest lahendusteadet ei saadetud, kuigi DB ütleb, et saadeti. Vastupidises osalise vea järjestuses võib kontakt saada sama häire mitu korda. Mõlemad õõnestavad ohutusfunktsiooni usaldusväärsust ja võivad põhjustada tarbetu eskalatsiooni.

**Vastuvõtukriteerium.** Turvasignaali e-kirjad vajavad püsivat outbox'i/state-masinat, idempotentsusvõtit ja provider-tulemuse reconciler'it; `SENT`/`resolvedNotifiedAt` tohib tekkida ainult tõendatud saatmise järel. Puuduv transport/saaja on nähtav `FAILED/PENDING`, mitte edu. Testida puuduva `EMAIL_FROM`/SMTP, timeout'i, provider-edu + DB-vea, DB-edu + worker crash'i, kahte paralleelset sweep'i ja restarti; kontakt saab iga loogilise teate maksimaalselt ühe korra ning UI näitab ausat seisu.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-FIELD-J-11 — OCR-käsku saab paralleelselt piiranguta käivitada — P2

**Tõend.** Foto upload on 12/min rate-limit'i taga, kuid omaniku OCR POST kontrollib ainult sessiooni/rolli, visiidi omandit, foto seost ja konfiguratsiooni; route'is puudub rate-limit, kasutusreservatsioon, idempotentsusvõti või ühe foto in-flight claim (`app/api/field/visits/[id]/attachments/[clientItemId]/ocr/route.js:16-47`). Iga kutse loeb kogu faili ja käivitab uue Tesseract-protsessi kuni 30 sekundiks ning 4 MB output-bufferiga (`lib/field/ocr.js:26-31,40-64`). Tulemus pole püsiv, seega reload/vastuse kao järel on ainus tee uus arvutus. Auditispetsiifiline kontroll kinnitas, et OCR-route ei kasuta ühtegi rate-limit helperit.

**Mõju.** Üks autentitud kasutaja või topeltklõps saab sama foto vastu käivitada korraga palju CPU- ja mäluintensiivseid OCR-protsesse. See võib aeglustada kogu Node-workerit või serverit ning raisata töö, kui vastus kaob.

**Vastuvõtukriteerium.** OCR vajab kasutaja/IP püsivat või vähemalt protsessideülest rate-limit'i, globaalset worker-concurrency piiri, ühe foto + sisu-SHA idempotentset in-flight/tulemusvõtit ja ausat pending/retry seisu. Koormustest käivitab sama ning eri fotode paralleelpäringud mitmes protsessis, tõendab lubatud maksimaalset protsessiarvu, 429 `Retry-After` vastust ja sama võtme ühe arvutuse/taastatava tulemuse.

**Seis.** NOT_DONE; runtime: not_run.

## Testid ja negatiivkontrollid

### Sihttestid

Eraldatud worktree's puudus algul genereeritud Prisma klient. Esimene eeljooks andis **70 PASS / 8 testifaili load-fail** veaga `ERR_MODULE_NOT_FOUND ... generated/prisma/client.ts`; see ei olnud rakenduse semantiline testitulemus. `npx prisma generate` käivitati mittetoimiva lokaalse dummy-`DATABASE_URL`-iga ainult ignoreeritud `generated/prisma` kausta jaoks: **PASS**, Prisma 7.8.0, 4,59 s; andmebaasi ei ühendatud.

Pärast testieelduse taastamist:

```text
node --import ./scripts/register-node-test-loader.mjs --test tests/field/*.test.js tests/serviceLog/fieldBridge.test.js tests/serviceLog/visitOrigin.test.js tests/serviceLog/visitDraft.test.js tests/workspaces/workspaceContract.test.js
```

Tulemus: **147/147 PASS**, 0 fail, 0 skipped, kestus **2 214,7 ms**. Jooks logis ühe teadlikult veasüstitud best-effort auditirea `audit_write_failed`, kuid test ise läbis ning globaalset andmebaasi ei kasutatud.

Päris brauserihoidla sihtsond:

```text
npm run field:pack:probe
```

Tulemus: **35/35 PASS**, 0 fail. Sond kasutas päris Chromiumi IndexedDB-d ja WebCrypto't ning tõendas paketi 72 h / DRAFT 7 päeva / CLOSED kohest purge'i, saatmata üksuse säilimist, markeri restart-püsivust ja 2xx-vs-500 markerikäitumist. See ei olnud autentitud rakenduse, API, PostgreSQL-i ega seadmemaatriksi runtime.

### Auditispetsiifilised negatiivkontrollid

Lähtekoodi semantilises negatiivsondis kontrolliti 14 lepinguvastast haru. Esimene regex oli `pendingCount` ploki piiritlemisel liiga lai ja andis **13/14**; parandatud plokipõhine sama kontroll läbis **1/1**. Konsolideeritud tulemus: **14/14 kinnitas praeguse vea kuju**, mitte parandust:

1. close-värav ignoreerib `FAILED/CONFLICT` seise;
2. `pendingCount` tõepoolest välistab need seisud;
3. serverimärkmetel puudub renderdustee;
4. offline shell asendab nimekirja tühjaga ega loe pakke;
5. visiidi list on cursorita `take:50`;
6. handover loob artefakti ilma idempotentsus-/versioonilepinguta;
7. Field-upload ei kasuta atomaarset `withStorageQuota()` helperit;
8. andmekoopia register ei tunne Field-mudeleid;
9. nõusolekuta foto saab automaatselt `documentOnly` erandi;
10. mikrofoni track-cleanup on ainult `onstop` harus;
11. attachment DELETE eemaldab faili enne DB-tehingut;
12. upload-cleanup'i `false` tulemust ei kontrollita ega panda retry-järjekorda;
13. OCR-route'il puudub rate-limit;
14. lahendusteade loetakse eduks ka puuduva SMTP-transpordi korral.

Rohelised testid ei kata neid harusid. Eriti kinnitab olemasolev handover-test praegu teadlikult korduvat append'i ning suletud-visiidi test kinnitab hilise sünki 409, kuid ükski test ei ühenda neid close-värava negatiivjuhtumiks.

## Olemasolevate leidudega kontrollitud kattuvused

- `SOL-FIELD-01` — DONE: saatmata sisu hoiatused/kinnitusega purge on koodis ja testides alles; browser-UI terviktõend jääb põhiauditi järgi `NOT_PROVEN`. Uus J-01 ei väida vaikset purge'i, vaid sulgemise järel serveritee pöördumatut sulgumist.
- `SOL-FIELD-02` — DONE: kõigi pakettide automaatne retention ja CLOSED/CANCELLED kohene eemaldus läbisid üksus- ning 35/35 Chromiumi sondi; J-03 käsitleb eraldi seda, et offline avaleht ei loetle alles olevaid pakke.
- `SOL-FIELD-03` — DONE DB/auditi tehingupiiril: close, turvasignaal, nõusoleku tagasivõtmine, handover ja attachment delete kirjutavad nõutud auditit. J-06 on eraldi regressioon samast toimingust failisüsteemi–DB piiril, mida DB-rollback ei saa taastada.
- `SOL-FIELD-04` — DONE: saabumise/lahkumise offline-marker säilib, 2xx eemaldab ja 401/403/409/429/500 jätavad tõendi alles; 35/35 päris IndexedDB sond kordas seda.
- `SOL-FIELD-05` — DONE: kinnitatud transkripti tekst ja toorheli retention-kell liiguvad samas tehingus; eraldi valelik eduteade puudub.
- `SOL-FIELD-06` — DONE: scheduler käivitab retry 5 s → 5 min ja peatub unmount'il; J-01 käsitleb pärast retry-piiri `FAILED` sisu sulgemist, mitte schedulerit.
- `SOL-DOC-07` — DONE ainult parandatud dokumendiradadel; J-07 on selgelt märgitud regressiooniks/katmata uueks Field-kirjutusrajaks, sest aktiivne kood kasutab seal vana mitteatomaarset mustrit.
- `SOL-NOTIF-06` — NOT_DONE: varasema notification-etapi viga võib Field-sweep'i üldse käivitamata jätta. J-10 ei dubleeri käivitusjärjekorda, vaid tõendab sweep'i enda SMTP–DB osalisi tulemusi.
- `SOL-SLOG-05` — NOT_DONE: `sourceFieldVisitId` on Teenuspäeviku loomisel kliendi usaldatud päritoluväide. Seda ei lisatud uuesti; Välitöö suletud visiidi link ja bridge kontrolliti ainult kattuvusena.
- Konto kustutuse dokumentide fail-closed retry ning `FieldVisit.owner` cascade kontrolliti ja uus dubleeriv leid puudub. Field-failid on üldiste `UserDocument` sihtmärkide seas; puudu on andmekoopia, mitte konto kustutuse reachability.

## Leidude koond

| Prioriteet | Arv | ID-d |
|---|---:|---|
| P0 | 0 | – |
| P1 | 8 | SOL-FIELD-J-01, -02, -04, -05, -06, -08, -09, -10 |
| P2 | 3 | SOL-FIELD-J-03, -07, -11 |
| P3 | 0 | – |
| **Kokku** | **11** | – |

Kõigi uute leidude seis on `NOT_DONE`; runtime: not_run.

## Mis jäi Välitöös tõendamata

- Autentitud täisvoog Android Chrome'is ning iOS Safari/PWA-s: install, fresh offline reload, kaamera, mikrofon, permissions denial, OS lock, tab/app kill, storage eviction ja taasavamine.
- Päris PostgreSQL-i CAS-, note conflict-, close-vs-upload-, handover-, retention- ja kvoodivõistlused ning migratsiooni tegelik rakendusbaasi seis.
- Päris SMTP puuduv/vale konfiguratsioon, provider-timeout, e-kirja edu + DB-vea järjestus, kontaktile tegelikult saabunud sõnum ja mitme worker'i samaaegsus.
- Päris Tesseract/OCR, transkriptsioon/provider, suur foto/heli, protsessi crash, temp-/orb-faili cleanup ja serveri restart.
- Kahe autentitud kasutaja owner-404, rollivahetus ning kahe sama omaniku seadme päris konflikt/reconcile.
- Konto kustutuse lõppkontroll päris failisüsteemis, RAG-is ja DB-s ning ZIP-andmekoopia tegelik sisu.
- Välitöö → AgentArtifact → Dokumendid ning Välitöö → Teenuspäevik funktsioonideülene muutumatus pärast lähtevisiidi retention'i/konto kustutust.

## Järgmine soovitatud auditimoodul

**Teenuspäevik — lõpetada esimese suure ploki järel katmata funktsioonid.** Eriti tuleb sulgeda Välitöö silla päris omandi/päritolu kontroll, kõik ülejäänud kasutaja- ja juhivaated, fail/eksport, parandused, arvelduslik muutumatus, retention, konto kustutus, andmekoopia, notification/outbox ning päris runtime. See jätkab otse Välitöö lõpetatud serverisillast ega korda `SOL-SLOG-05` ega varasema Teenuspäeviku esimese ploki juba tõendatud osi.
