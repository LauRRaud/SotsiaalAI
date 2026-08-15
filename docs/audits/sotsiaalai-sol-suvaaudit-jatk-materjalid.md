# SotsiaalAI SOL-süvaaudit — jätk: Materjalid

**Auditi seis:** Materjalide staatiline süvaaudit `DONE`; runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `c9cefd285e082c70ab7f573c0ab130d578f57a98`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-mat-c9cefd2` (detached HEAD, auditi alguses puhas).

Audit ei kasutanud vana `SotsiaalAI-sol-audit-cfa62ea` koopiat ega põhiprojekti commit'imata muudatusi. Põhiprojekti algseis oli `main...origin/main [ahead 1]`; 10 muudetud ja 1 uus vestluse/ekspordi fail jäid puutumata. Käesolev jätkufail on ainus põhiprojekti lisatud fail; tootmiskoodi, olemasolevate leidude `Seis`-lõike, Git indexit ega ajalugu ei muudetud.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Kasutaja sisenemisteed ja leht | DONE | `/materjalid`, töölaua kaart, vestluse manustatud tööpind, hinnastuse/rolli nähtavus |
| Kasutaja toimingud ja Reacti olek | DONE | failivalik, mitme faili submit, kommentaar, edu/viga, tagasinavigatsioon; omaniku loendi/staatusvaate/withdraw puudumine |
| Admini Reacti töövoog | DONE | list/refresh, download, reviewed/imported/rejected, reviewNote, delete |
| API ja autoriseerimine | DONE | `GET/POST /api/materials`, `PATCH/DELETE /api/materials/[id]`, admin-download; rolli- ja tellimuspiir |
| `lib/materials/**` | DONE | failitee, MIME-signatuur, kirjutus/lugemine/kustutus, kommentaar, oleku normaliseerimine ja serialiseerimine |
| Prisma ja migratsioonid | DONE | `MaterialSubmission`, algmigratsioon, ownership'i tugevdus ja review-väljade migratsioon |
| Failisüsteem ↔ DB terviklikkus | DONE | upload, veapuhastus, admini kustutus, konto kustutus ja retry; crash-/veasüsti runtime puudub |
| Kvoot, samaaegsus ja idempotentsus | DONE | üld- ja päevakvoot, paralleelne upload, sha256, rate-limit, retry/topeltesitus |
| RAG ja eemaldamine | DONE | `imported`, päris ingest'i/doc_id seos, õiguste omanik, RAG-koopia eemaldamine |
| Andmekoopia ja retention | DONE | data-export registry, konto kustutus, kohaliku faili retry, staatusepõhine retention, SMTP-koopia |
| Päris HTTP/PostgreSQL/SMTP/RAG runtime | NOT_PROVEN | runtime'i ei käivitatud; `runtime: not_run` |

## Auditeeritud failid ja funktsioonid

- `app/materjalid/page.js`: `generateMetadata()`, `Page()`.
- `components/materials/MaterialsPage.jsx`: `handleSubmit()`, failivalik, submit/notice/error, embedded ja standalone sisenemistee.
- `components/materials/MaterialsAdminSubmissionsPanel.jsx`: `refreshItems()`, `handleReview()`, `handleDelete()`, download ja 100 rea render.
- `app/api/materials/route.js`: `GET()`, `POST()`, `sendMaterialUploadNotification()`, `clampLimit()`, rate-limit, kvoodid ja mitme faili tehing.
- `app/api/materials/[id]/route.js`: `PATCH()`, `DELETE()`, admini identiteet ja review update.
- `app/api/materials/[id]/download/route.js`: `GET()`, faililugemine, päised ja `FILE_DOWNLOAD_ADMIN` audit.
- `lib/materials/server.js`: salvestusjuur, tee valideerimine, `writeUploadedMaterial()`, `readStoredMaterial()`, `deleteStoredMaterial()`.
- `lib/materials/submissions.js`: staatuse/action'i normaliseerimine, `buildMaterialReviewUpdate()`, `serializeMaterialSubmission()`.
- `lib/materials/compat.js`: skeemivea tuvastus ja lokaliseeritud 503.
- `prisma/schema.prisma:3899-3922`; migratsioonid `20260313110000_add_material_submissions`, `20260423173000_strengthen_integrity_guards`, `20260502154500_add_material_submission_review`.
- Seotud piirid: `lib/documents/server.js`, `lib/documents/storageQuota.js`, `lib/documents/rateLimit.js`, `lib/rate-limit.js`, `lib/storageUsage.js`, `lib/storageGuardrails.js`, `lib/privacy/userDeletion.js`, `lib/privacy/userDeletionOrchestrator.js`, `lib/privacy/fileDeletion.js`, `lib/privacy/deletionJobRetryService.js`, `lib/dataExport/registry.js`, `lib/retention.js`, `lib/privacy/audit.js`, `lib/workspaceDashboardCards.js`, `components/room/RoomStage.jsx`, `components/alalehed/HinnastusBody.jsx`.

## Leiud

### SOL-MAT-01 — tasulise spetsialistifunktsiooni serveripiir puudub — P1

**Tõend.** Hinnastus näitab „Materjalide lisamist” ainult kahele spetsialistipaketile (`components/alalehed/HinnastusBody.jsx:54-60`), töölauakaart on `requiresPaid: true` (`lib/workspaceDashboardCards.js:313-322`, `:433-442`) ja sügavuslaud lubab kaarti ainult `SOCIAL_WORKER`/`SERVICE_PROVIDER` rollidele (`components/room/RoomStage.jsx:1070`, `:1102-1106`). `POST /api/materials` kontrollib aga ainult `session.user.id`; `effectiveRoleFromSession()` määrab üksnes kvoodi suuruse ega keela `CLIENT` rolli või aktiivse tellimuseta kontot (`app/api/materials/route.js:158-173`, `:209-230`). Leht ise ei tee serveripoolset rolli- ega tellimuskontrolli (`app/materjalid/page.js:19-24`). Negatiivkontroll kinnitas nii tellimusvärava kui spetsialistirolli värava puudumise.

**Mõju.** Iga autentitud konto saab otse-API kaudu kasutada funktsiooni, mida UI ja hinnastus esitavad tasulise spetsialisti võimalusena. Paketipiir, rollipiir ja haldusjärjekorra eeldatud allikakvaliteet ei ole serveris jõustatud.

**Vastuvõtukriteerium.** POST peab serveris nõudma aktiivset õigust ning lubatud rolli sõltumata UI-st. Omaniku hilisem GET/withdraw võib olla tellimusest sõltumatu, kuid uus üleslaadimine mitte. HTTP-negatiivtestid peavad katma autentimata, `CLIENT`, aegunud tellimuse, `SOCIAL_WORKER`, `SERVICE_PROVIDER` ja admini ning tõendama, et rolli/tellimuse muutmine sessiooni ajal ei jäta vana õigust kehtima.

**Seis.** DONE — 13.08.2026. `POST /api/materials` kasutab nüüd `requireMaterialUploadAccess()` väravat: autentimata saab 401, `CLIENT` 403, aegunud spetsialistitellimus 402 ning aktiivne `SOCIAL_WORKER`, `SERVICE_PROVIDER` ja admin pääsevad edasi. `tests/materials/routeAccess.test.js` mõõdab päris `Response.status` väärtused ja sama kasutaja rolli muutmise korduskontrolli; omaniku GET/download/withdraw jäävad tellimusest sõltumatuks. Sihttestid 15/15 PASS.

### SOL-MAT-02 — MIME-kontroll aktsepteerib päisega maskeeritud ja tühje faile — P1

**Tõend.** Materjali MIME tuletatakse nime/laiendi ja brauseri MIME järgi ning faili sisust kontrollitakse PDF-il ainult esimest viit baiti, DOCX-il ainult ZIP-signatuuri ja TXT-l ainult esimest 4096 baiti (`lib/documents/server.js:189-236`, `:239-277`; `lib/materials/server.js:60-70`). Auditi negatiivkontrollis läbisid 4/4 vigast payload'i: neljabaidine `PK\x03\x04` „DOCX”, `%PDF-not-a-real-pdf`, TXT mille NUL-bait oli pärast 4096. baiti, ja nullbaidine TXT. Materjalide testides faili sisu kontrollivaid teste ei ole (`tests/materials/submissions.test.js:1-82`).

**Mõju.** Adminile saab ülevaatamiseks saata faili, mis pole väidetud dokument. See võimaldab pahatahtliku või ressursimahuka arhiivi/PDF-i toimetada usaldatud töövoo kaudu admini seadmesse ning jätab serverisse kasutuskõlbmatu sisu, mida staatus ja MIME kirjeldavad valesti.

**Vastuvõtukriteerium.** Nullpikk fail tuleb keelata; DOCX peab sisaldama piiratud suuruse ja kirjete arvuga korrektset OOXML-paketti ning nõutud osi; PDF ja TXT vajavad kogu faili ulatuses kontrollitavat lepingut ja parseri ressursipiire. Negatiivtest peab sisaldama ainult päisega ZIP/PDF-i, ZIP-pommi, puuduvaid OOXML-osi, kontrollaknast väljaspool binaarsisu ja nullpikka faili.

**Seis.** DONE — 13.08.2026. Materjalide route valideerib nüüd kogu puhverdatud faili enne staging'ut. Nullpikk fail on keelatud; TXT läbib fatal UTF-8 dekodeerimise ja kogu faili kontrollmärkide kontrolli; DOCX kasutab kirjete arvu, tegeliku lahtipakitud mahu, tihendussuhte, tee, CRC ja puuduva OOXML-põhistruktuuri piire; PDF nõuab terviklikku xref/EOF struktuuri ning `pdf-parse` parseriga vähemalt üht ja kuni 500 lehekülge, eval keelatud ja pildipikslite lagi. Negatiivtestid katsid päisega ZIP/PDF-i, puuduva OOXML-osa, deklareeritud ZIP-pommi, hilise NUL-baidi, vigase UTF-8 ja tühjad failid; Materjalide sihttestid 20/20 PASS.

### SOL-MAT-03 — upload ja admini kustutus võivad faili ning DB-rea lahku viia — P1

**Tõend.** POST loob kõik püsifailid enne `MaterialSubmission` tehingut (`app/api/materials/route.js:232-267`). Catch proovib neid protsessimälus oleva `storedEntries` loendi järgi kustutada, kuid cleanup-vea korral ainult logib; püsivat cleanup-job'i ega käivitusjärgset orbude reconcile'i pole (`:284-290`). Protsessi surm pärast `writeUploadedMaterial()`-i ja enne DB create'i ei jõua catch'i. Admini DELETE teeb vastupidise ohtliku poole: kustutab faili enne DB-rida; DB delete'i vea korral jääb rida, allalaadimine ja staatus alles, kuid fail on pöördumatult kadunud (`app/api/materials/[id]/route.js:96-109`). Ajalooline ownership-migratsioon kustutas NULL-omanikuga DB-read failisüsteemi cleanup'ita (`prisma/migrations/20260423173000_strengthen_integrity_guards/migration.sql:1-16`), seega võimalike ajalooliste orbude olemasolu on NOT_PROVEN. See on `SOL-DOC-04`-s parandatud fail↔DB invariandi Materjalide katmata rada; põhiauditi enda `Seis` märgib, et sama muster võib mujal alles olla (`sotsiaalai-sol-suvaaudit.md:1510-1546`).

**Mõju.** DB-vea, cleanup-vea või protsessikatkestuse järel võib jääda omanikuta fail või puuduvale failile viitav aktiivne esitis. Esimene on privaatsus- ja retention-jääk, teine kaotab kasutaja saadetud materjali pärast näiliselt edukat vastuvõttu.

**Vastuvõtukriteerium.** Upload vajab ajutist faili, taastatavat PENDING/COMMITTING olekut ja crash-järgset reconcile'i; ükski püsifail ei tohi jääda ilma DB-rea või püsiva cleanup-job'ita. Admini kustutus peab olema idempotentne olekumasin, kus DB märgib kustutuse ootele, fail eemaldatakse jälgitava job'iga ja rida lõpetatakse alles kinnitatud tulemuse järel. Veasüst peab katkestama iga faili ja DB sammu ees/järel ning tõendama nii DB, kettaseisu kui retry tulemust.

**Seis.** DONE — 13.08.2026. Üleslaadimine kasutab püsivat `MaterialSubmissionBatch` + `DataDeletionJob` STAGE/PUBLISH olekumasinat; nähtavaks saab ainult avaldatud fail ning restart-reconcile lõpetab `PENDING_PUBLISH` rea. Kustutus märgib rea `DELETE_PENDING`, eemaldab faili püsiva job'iga, kirjutab kohustusliku auditi ja kustutab rea alles kinnitatud tulemuse järel. `materials:lifecycle:probe` süstis faili teise kirjutuse, DB-tehingu, publish'i ja delete'i tõrked ning tõendas cleanup'i/retry — PostgreSQL 23/23 PASS.

### SOL-MAT-04 — Materjalide kvoot on `SOL-DOC-07` DONE-seisu järel endiselt paralleelselt ületatav — P2

**Tõend.** Materjalide POST loeb üld- ja päevakasutuse paralleelselt (`getUserStorageUsageBytes`, `getUserDailyUploadBytes`), otsustab ning kirjutab failid/DB-read alles hiljem (`app/api/materials/route.js:202-230`, `:232-267`). Ta ei kasuta `withStorageQuota()`, mis võtab kasutajapõhise PostgreSQL advisory-lock'i ning mõõdab ja kirjutab samas tehingus (`lib/documents/storageQuota.js:42-86`). `SOL-DOC-07` vastuvõtukriteerium nõudis sõnaselgelt dokumente, materjale ja artefakte, kuid DONE-kirjeldus ning contract-test loetlevad ainult dokumentide neli rada (`sotsiaalai-sol-suvaaudit.md:1628-1668`; `tests/documents/documentsResearchContracts.test.js:217-233`). Negatiivkontroll kinnitas Materjalide route'is lukustatud kvooditee puudumise.

**Mõju.** Kaks sama kasutaja paralleelset materjalipakki võivad mõlemad vana summa järgi mahtuda ning ühiselt ületada nii salvestus- kui päevakvoodi. See on ametliku DONE-seisu suhtes katmata/regresseerunud serverirada ja muudab paketi mahupiiri koormuse all ebausaldusväärseks.

**Vastuvõtukriteerium.** Materjalide POST peab kasutama sama kasutajapõhist atomaarset kvoodilepingut; faili staging, kõigi ridade create ja püsifaili avaldamine peavad moodustama taastatava terviku. Päris PostgreSQL-i paralleelsustest peab täitma piiri lähedale ning saatma korraga vähemalt neli mitmefaililist upload'i; võita tohib ainult limiiti mahtuv hulk ja kaotajad ei tohi jätta faile.

**Seis.** DONE — 13.08.2026. Kõigi faili ridade loomine toimub `withStorageQuota()` sama kasutaja advisory-lock'i ja tehingu sees; kaotaja staging koristatakse püsivate job'idega. Päris PostgreSQL-i nelja paralleelse upload'i sond lubas täpselt kaks 1000-baidist võitjat 2000-baidise piiri alla, kaks said 413 ning lõppmaht jäi 2000; vana read-then-write negatiivkontroll ületas sama piiri. `materials:lifecycle:probe`: 23/23 PASS.

### SOL-MAT-05 — korduskatse loob uued failid, read, kvoodikulu ja teavituse — P2

**Tõend.** POST ei loe idempotentsusvõtit ega seo kliendi kavatsust tulemusega. `sha256` on ainult tavaline indeks, mitte unikaalsus ega duplikaadikontroll (`prisma/schema.prisma:3899-3921`); create toimub alati (`app/api/materials/route.js:245-267`). Vastuse kaotsimineku järel sama request loob uued failid ja read ning käivitab uue SMTP-teavituse (`:269-282`). Ainus sageduspiir kasutab protsessimälus `Map`-i (`lib/rate-limit.js:1-47`), seega restart või teine protsess annab uue bucket'i. Negatiivkontroll kinnitas idempotentsusvõtme ja sha-duplikaadikontrolli puudumise ning protsessimälupõhise limiteri.

**Mõju.** Tavaline võrgu-retry või topeltklõps võib kasvatada kasutaja kvoodikulu, täita adminijärjekorra duplikaatidega ja saata mitu e-kirja. Mitme instantsi või restardi korral ei ole kaheksa upload'i piir üle platvormi jõustatav.

**Vastuvõtukriteerium.** Klient peab ühe kasutajakavatsuse jooksul saatma stabiilse idempotentsusvõtme; server seob selle kasutaja, payload'i hash'i ja ühe tulemusega ning sama võtme/teise sisu korral annab 409. Sama sha256 peab vähemalt andma adminile/omanikule duplikaadiviite. Rate-limit peab olema jagatud ja atomaarne. Testid peavad katma sama võtme paralleelselt, response-loss retry, sama sha eri võtmega, eri sisu sama võtmega ning kahe protsessi bucket'i.

**Seis.** DONE — 13.08.2026. Klient säilitab ühe kasutajakavatsuse vältel UUID idempotentsusvõtme; server seob `(submittedByUserId,idempotencyKey)` payload'i hash'i ja ühe batch-tulemusega. Sama võti/teine sisu annab 409, neli sama võtme paralleelpäringut koonduvad üheks reaks, response-loss retry tagastab sama ID ning sama sha teise võtmega kannab `duplicateOfId` viidet. Jagatud rate-limit loetakse batch'idest kasutaja advisory-lock'i all. PostgreSQL-i sond 23/23 PASS.

### SOL-MAT-06 — esitaja ei näe oma esitisi, staatust ega saa esitist tagasi võtta — P1

**Tõend.** `MaterialsPage` haldab ainult valitud faile, kommentaari ning ühe POST-i edu/viga; pärast edukat submit'i kustutab ta lokaalse seisu (`components/materials/MaterialsPage.jsx:38-84`, `:116-174`). Ainus GET on `assertAdmin`-iga kogu järjekorra API (`app/api/materials/route.js:120-155`). Omaniku-skoobitud list/detail/download/withdraw route'i ega UI-d pole. Negatiivkontroll kinnitas, et kasutajapind ei kuva `submissions`, `status` või withdraw/delete toimingut ja GET on admin-only.

**Mõju.** Kasutaja ei saa tõendada, mida ta saatis, kas materjal on veel ootel, tagasi lükatud või väidetavalt imporditud, ega tundlikku või ekslikku esitist enne admini tegevust tagasi võtta. Ka aegunud tellimuse järel puudub oma andmete lugemis- ja kustutustee.

**Vastuvõtukriteerium.** Lisada omaniku minimaalse projektsiooniga pagineeritud „minu esitised” vaade, omaniku download ning idempotentne withdraw/delete. Lugemine ja oma ootel/rejected faili eemaldamine peavad olema tellimusest sõltumatud. Terminalse/imported esitise puhul peab server andma ausa eemaldamislepingu, mitte vaikse keelu. Ristkasutaja 404-negatiivtestid peavad katma list/detail/download/withdraw kõik olekud.

**Seis.** DONE — 13.08.2026. `MaterialsPage` kuvab omaniku pagineeritud esitised, seisundi, omaniku download'i ja pending/rejected tagasivõtmise; GET/download/delete kasutavad serveris omaniku skoopi ja töötavad tellimuseta. Imported tagasivõtmine annab ausa 409, ristkasutaja download/delete 404 ning korduv delete tagastab idempotentse edu. PostgreSQL-i sond tõendas eemaldamise, retry, auditi ja cross-user piiri; lõplik sond 30/30 PASS. Päris Chromiumis renderdus sünteetilise API-projektsiooniga kahe staatusega omanikuvaade ja `Näita veel`; `Võta tagasi` eemaldas ootel rea. Backend-auth ja omandipiir on eraldi HTTP/PG testidega tõendatud, brauseris production-andmeid ei kasutatud.

### SOL-MAT-07 — adminijärjekord lõpeb vaikides 100 uusima rea juures — P2

**Tõend.** API piirab `limit` alati maksimaalselt 100-ni, kasutab `take: limit` ning ei paku cursor'it, offset'i, totalit ega `hasMore` välja (`app/api/materials/route.js:27-30`, `:110-155`). Mõlemad adminipaneeli laadimised küsivad jäigalt `?limit=100` ja asendavad kogu lokaalse loendi (`components/materials/MaterialsAdminSubmissionsPanel.jsx:55-101`). Staatusefiltrit pole.

**Mõju.** 101. ja vanem ootel, rejected või imported esitis ei ole UI kaudu leitav, üle vaadatav, allalaaditav ega kustutatav. Järjekord võib näida tühi/korras samal ajal, kui vanem töö ja failid säilivad.

**Vastuvõtukriteerium.** Lisada stabiilne cursor-paginatsioon `(createdAt,id)`, `hasMore/nextCursor`, total või eraldi loendur ning staatusefilter; UI peab võimaldama kõigi lehtede läbimist. Test peab looma üle 100 rea sama ja eri ajatempliga ning tõendama, et ükski ID ei kordu ega kao.

**Seis.** DONE — 13.08.2026. Admini ja omaniku loend kasutab stabiilset kahanevat `(createdAt,id)` cursor'it, tagastab `hasMore`, `nextCursor`, `total` ja seisundiloendurid; adminipaneelil on seisundifilter ja järgmise lehe laadimine. PostgreSQL-i sond lõi 106 sama ajatempliga rida ning läbis kõik ID-d ühe korra, ilma kao või korduseta; 23/23 PASS.

### SOL-MAT-08 — `imported` on vale RAG-lubadus ilma ingest'i, `doc_id`, õiguste või eemaldamiseta — P1

**Tõend.** `mark_imported` mapib ainult stringi `imported`; `buildMaterialReviewUpdate()` tagastab staatuse, `reviewedAt`, `reviewedBy` ja `reviewNote` (`lib/materials/submissions.js:1-54`). PATCH teeb ainult `prisma.materialSubmission.update()` (`app/api/materials/[id]/route.js:46-69`). Mudelis puuduvad `ragDocId/doc_id`, ingest'i aeg/viga, versioon, autor ja õiguste omaja (`prisma/schema.prisma:3899-3922`). Negatiivkontroll kinnitas, et imported-update muudab ainult nelja review-välja ning detailroute ei kutsu ingest'i. Admini või konto kustutus saab seetõttu eemaldada ainult esitise faili/rea, mitte teise toruga loodud RAG-koopiat (`app/api/materials/[id]/route.js:96-109`; `lib/privacy/userDeletionOrchestrator.js:41-46`). Sama lünk oli varem disainidokumendis kaardistatud, kuid põhiauditis ei olnud sellel SOL-MAT leidu (`docs/platvormi arendus/fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md:149-157`, `:192-210`).

**Mõju.** Admin ja esitaja võivad näha staatust „imporditud”, kuigi RAG-is pole ühtki chunk'i; vastupidi võib käsitsi imporditud koopia jääda leitavaks pärast esitise või konto kustutamist. Õiguste omaniku ja kasutusloa puudumisel pole otsustatav, kas konto kustutus peab teadmuskoopia eemaldama või tohib see alles jääda.

**Vastuvõtukriteerium.** `imported` peab sündima ainult ühe versioonitud ingest-teenuse kinnitatud tulemuse järel ning kandma püsivat `source_id/doc_id`, sisu hash'i, collection/audience'i, `ingestedAt`, vea/retry seisu, autorit ja õiguste alust/omanikku. Kustutus/withdraw peab kasutama seotud RAG_DELETE job'i ning imported staatus ei tohi tekkida ilma `chunk_count > 0` kviteeringuta. Negatiivtestid: ingest 4xx/5xx/timeout, DB lõpuviga, null-chunk ingest, duplikaat, konto kustutus ja RAG-delete retry.

**Seis (14.08.2026): DONE.** Kinnitatud muutumatu poliitika on `rightsEvidenceMode=DOCUMENTED_LICENSE`, `collection=materials_reviewed_social_work`, `audience=SOCIAL_WORKER`, `retentionMode=DELETE_WITH_SUBMISSION_OR_ACCOUNT`, `withdrawalAuthority=SUBMITTER_RIGHTS_HOLDER_OR_ADMIN`, versioon `materials-rag-v1-2026-08`. Shared-RAG lubab ainult public domain'i, selget avatud litsentsi või dokumenteeritud luba ning keelab kliendijuhtumi, konfidentsiaalse ja isikuandmetega materjali; pelk esitaja kinnitus ei ava importi. `imported` sünnib ainult sanitiseeritud derivaadi versioonitud ingest'i, `inserted > 0` kviteeringu ja järgneva `chunks > 0` kontrolli järel. Admin näeb auditeeritud preview-rajalt ainult derivaati, mitte toororiginaali. Ebaõnnestumine, null-chunk, DB lõpuviga, withdraw ja konto kustutus kasutavad püsivaid retry/kompensatsiooni/RAG_DELETE radu.

PDF ja DOCX läbivad nüüd kohaliku Dangerzone 0.11 CDR-i: võrguta Podmani/gVisori liivakast rasterdab dokumendi, ehitab uue ohutu PDF-i, OCR-ib eesti keeles ning RAG-i jõuab ainult rangelt valideeritud UTF-8 tekst. Tootmise sünteetiline PDF/DOCX sond oli 7/7: nähtav tekst säilis, PDF-i mitterenderdatud marker ja DOCX-i pakimetaandmed ei säilinud, väljund polnud originaali koopia ning ajutine karantiin koristati. Puuduv mootor, versioonitriiv, timeout ja vigane väljund jäävad fail-closed.

Tootmises on Materjalidel eraldi LUKS2 + ext4 failipõhine köide `/dev/mapper/sotsiaalai_materials`, mount `rw,nodev,nosuid,noexec,noatime`; juur on 0750 ja `uploads`, `quarantine`, `sanitized` 0700. Boot-chain kontroll sulges mapping'u ja tõendas, et systemd avab krüptoköite, mount'ib selle, läbib fail-closed verifitseerimise ning käivitab frontendi; `noexec` ja `nodev` negatiivkontrollid ebaõnnestusid ootuspäraselt. See on sama serveriketta krüpteeritud iseseisev failisüsteem, mitte eraldi füüsiline pilveketas.

Materjalide sihttestid olid 59/59; päris PostgreSQL-i turvavärav 12/12, üleslaadimise/elutsükli sond 30/30 ja RAG-sond 20/20. Autenditud Playwrighti rada kasutas ainult lokaalset sünteetilist sotsiaaltöötaja kontot: üleslaadimine jõudis olekusse `Ootel`, näitas originaali tähtaega ja derivaadi/RAG-i `NOT_PRESENT` seisu ning tagasivõtmine eemaldas ülesandes loodud sünteetilise rea; brauserikonsoolis oli 0 viga. ClamAV/freshclam tootmistõend püsib: puhas proov `CLEAN`, EICAR `INFECTED`, Unix-socket `660`. Andmebaasis on ainult metaandmed ja kogu faili elutsükkel toimub webroot'ist väljaspool.

15.08.2026 järelparandus sulges karantiini kvoodist möödumise: vigane idempotentsusvõti lükatakse tagasi enne püsikirjet ja baitide kirjutamist ning skanneri, valideerimise, sanitiseerimise või hilisema esitise loomise tõrge eemaldab nii request'i karantiinifaili, kviteeringu kui lõpetatud cleanup-job'i. Juba lõpetatud idempotentse esitise kordus koristab enne 200 vastust just uue HTTP-katse karantiinikoopiad; koristustõrget ei neelata eduks. Nakatunud faili auditeeritud tombstone-rada säilis. Sihttestid tõendasid varase tagasilükkamise, hilise admission-tõrke, korduse koristamise ja fail-closed koristustõrke.

### SOL-MAT-09 — ülevaatuse olekumasin lubab suvalisi ja stale üleminekuid — P1

**Tõend.** PATCH lubab kliendil saata kas `action` või otse `status`; otsene lubatud staatus võidab action'i (`lib/materials/submissions.js:14-24`, `:32-54`). Funktsioon ei saa eelmist olekut ning lubab seetõttu näiteks `imported → pending/rejected` või `rejected → imported`. Prisma update sihib ainult `where: { id }`; `expectedUpdatedAt`, revision ja CAS puuduvad (`app/api/materials/[id]/route.js:46-64`). Kaks admini saavad teineteise staatuse ja märkuse vaikides üle kirjutada. DB-s on staatus vaba `String` ilma CHECK-i või enumita ning `reviewedAt/reviewedBy` kirjeldavad ühtemoodi reviewed, rejected ja imported olekut (`prisma/schema.prisma:3908-3913`; migratsioon `20260502154500_add_material_submission_review:1-8`). `reviewNote` kärbitakse 2000 märgini ilma veata (`lib/materials/submissions.js:12`, `:26-29`); negatiivkontroll tõendas nii eelneva seisuta direct-status ülemineku kui vaikse kärpe.

**Mõju.** Hilinenud brauserivastus võib kaotada teise admini otsuse, muuta väidetavalt imporditud materjali tagasi ootele või vastupidi ning jätta nähtava lõppseisu ilma usaldatava otsuseajalooga. Kärbitud põhjendus võib kaotada õiguste või tagasilükkamise olulise osa.

**Vastuvõtukriteerium.** Defineerida DB-ga jõustatud olekud ja lubatud üleminekud, eristada `reviewed`, `rejected` ja `ingested` sündmused ning nõuda `expectedRevision/updatedAt` CAS-i; kaotaja saab 409 ja värske rea. Iga üleminek ja täispikk valideeritud põhjendus peab sündima sama tehingu auditikirjes. Paralleelsustestid peavad katma iga kahe action'i võistluse, stale retry ja terminalse imported/removed oleku.

**Seis.** DONE. `MaterialSubmission.reviewRevision` ja DB CHECK/triger jõustavad lubatud olekud,
üleminekugraafi ning täpselt ühe revisjonisammu; `imported` on terminalne. PATCH nõuab
`expectedRevision`-it, teeb olekumuutuse CAS-iga ja tagastab kaotajale 409 koos värske reaga;
adminivaade võtab värske rea üle. Üle 2000 märgi pikkune põhjendus lükatakse veaga tagasi,
mitte ei kärbita. `tests/materials/reviewAudit.test.js` ja Materjalide sihttestid olid 24/24
PASS. Päris PostgreSQL-i `npm run materials:lifecycle:probe` oli 30/30 PASS: kahest sama
revisjoniga paralleelotsusest võitis üks, audit ja revisjon commit'isid koos, auditiviga
veeretas otsuse tagasi ning otsene `imported → pending` DB-möödaminek ebaõnnestus.

### SOL-MAT-10 — admini allalaadimise, ülevaatuse ja kustutuse audit pole kohustuslik — P1

**Tõend.** Download kutsub `logDataAudit()`-it (`app/api/materials/[id]/download/route.js:35-60`), kuid see helper neelab auditikirjutuse vea ja tagastab `null` (`lib/privacy/audit.js:61-79`); fail läheb seejärel ikkagi vastusesse. PATCH ja DELETE ei kirjuta üldse `DataAuditLog`-i (`app/api/materials/[id]/route.js:25-118`). `reviewedBy` on sessiooni e-post/ID vabatekstina, mitte muutumatu auditisündmus (`:21-23`, `:46-55`).

**Mõju.** Admin võib kasutaja faili lugeda, staatust muuta või selle kustutada ilma usaldusväärse „kes, millal, mida” jäljeta. Audit-DB rikke ajal on just tundliku faili allalaadimine vaikse jäljeta edukas.

**Vastuvõtukriteerium.** Download peab enne faili väljastamist kirjutama kohustusliku minimaalse auditi või keelduma; review peab kirjutama vana/uue staatuse, revision'i ja otsustaja sama DB-tehinguga; kustutus vajab püsiva deletion-job'i ning selle auditit. Negatiivtest peab süstima auditikirjutuse vea igal toimingul ja tõendama, et põhitoiming ei raporteeri edu ega kao jäljeta.

**Seis.** DONE. Faili väljastamise eel kirjutatakse nüüd kohustuslik owner/admin audit ning
auditivea korral vastust ei väljastata. Review vana/uus olek, vana/uus revisjon, otsustaja ja
valideeritud märkus kirjutatakse olekumuutusega samas tehingus. Püsiva kustutusjob'i lõpus on
kohustuslik audit; auditivea korral jääb rida retry'itavaks ega raporteeri edu.
`tests/materials/reviewAudit.test.js` süstis download-auditi vea; päris PostgreSQL-i 30/30 sond
tõendas review rollback'i, kustutusauditi rollback/retry rada ja täpselt ühe deletion-auditi.

### SOL-MAT-11 — kasutaja andmekoopia jätab esitised ja originaalfailid välja — P1

**Tõend.** `DATA_EXPORT_REGISTRY` ekspordib profiili, vestlused, Teekonna, Tööheaolu, eelpöördumised ning `UserDocument`/`AgentArtifact` objektid ja failid, kuid ei tee ühtki `MaterialSubmission` päringut ega kasuta `readStoredMaterial()`-i (`lib/dataExport/registry.js:104-178`). Negatiivkontroll kinnitas `materialSubmission/materialSubmissions` puudumise registrist. Konto kustutus kogub ja eemaldab materjalid seevastu eraldi (`lib/privacy/userDeletion.js:17-65`, `:114-122`).

**Mõju.** Inimene ei saa enne konto sulgemist koopiat enda esitatud materjalidest, kommentaaridest, staatustest, review-põhjustest ega originaalfailidest, kuigi konto kustutus võib need seejärel lõplikult eemaldada.

**Vastuvõtukriteerium.** Omaniku data export peab sisaldama minimaalse metaandmestiku ja iga allesoleva originaalfaili, imported/RAG seose ning selge manifestirea puuduva faili kohta. Review-väljadest tuleb välistada teiste isikute üleliigne info. Test peab võrdlema omaniku kahte esitist, võõrast esitist, puuduvat faili ja imported seost ZIP-i manifestiga.

**Seis.** DONE. Andmekoopia registris on owner-skoobitud `material_submissions` pind:
`materials.json` sisaldab esitise metaandmeid, staatust, review-põhjust ja retention/RAG seose
olekut, kuid mitte ülevaataja identiteeti ega storage path'i. Allesolev originaal lisatakse
ZIP-i; puuduva, ligipääsmatu või containment'i rikkuva faili kohta jääb globaalsesse manifesti
eraldi ID, põhjus ja `archivePath: null`, mitte märgistamata auk. Sihttest võrdles kahte oma
esitist, owner-filtrit, üht olemasolevat ja üht puuduvat faili ning legacy `imported` rea
`ragRelationStatus: not_recorded` märget: data-export/Materjalid plokk 39/39 PASS.

### SOL-MAT-12 — rejected/imported/pending failidel puudub retention'i tähtaeg ja sweep — P2

**Tõend.** `MaterialSubmission` mudelis pole `retentionUntil`, deleted/withdrawn markerit ega retention-klassi (`prisma/schema.prisma:3899-3922`). `lib/retention.js` ei päringuta Materjale; faili eemaldavad ainult admini DELETE ja konto kustutus. Seetõttu säilivad pending, rejected, reviewed ja imported failid tähtajatult, kui kumbagi käsitsi sündmust ei toimu. Konto kustutuse kohalik failirada on koodis fail-closed: `runUserDeletionCleanup()` kustutab materjalifailid enne user-cascade'i ja ebaõnnestumisel kasutajat ei kustuta (`lib/privacy/userDeletionOrchestrator.js:29-57`); auditi 2/2 positiivkontroll kinnitas selle järjekorra. Päris DB/kettaseisu runtime on siiski NOT_PROVEN. SMTP-teavitus sisaldab esitaja e-posti, failinimesid ja kuni 1000 märki kommentaari (`app/api/materials/route.js:57-107`); konto kustutus ei saa saaja postkasti koopiat eemaldada ega selle retention'i tõendada.

**Mõju.** Tagasilükatud või unustatud tundlik materjal võib jääda kettale määramata ajaks ning tema identifitseeriv metadata eraldi e-posti koopiasse. Platvorm ei saa öelda, millal milline koopia lõplikult kaob.

**Vastuvõtukriteerium.** Määratleda iga oleku retention (pending SLA + expiry, rejected lühike vaidlusaken, imported originaali/RAG-koopia eraldi leping), salvestada tähtaeg ja käivitada idempotentne fail+DB+RAG sweep püsiva retry/auditiga. UI ja data-export manifest peavad näitama tähtaega ning SMTP-koopia andmeminimeerimise/retention'i piiri. Kellatest peab katma kõik olekud, sweep'i crash'i ja teise jooksu.

**Seis (13.08.2026): DONE.** `MaterialSubmission` ei kasuta enam üht ühist säilituskella:
originaalil, sanitiseeritud derivaadil ja RAG-koopial on eraldi tähtaeg, seisund, ankur ning
kustutusaeg. Kinnitatud muutumatu poliitika on pending 14 päeva, rejected 30, reviewed kuid
importimata 30, edukalt ingestitud originaal 7, karantiini PENDING/FAILED/CLEAN 1 päev ning
derivaat/RAG kuni 365 päeva. Litsentsi/allika varasem lõpp ja keelatud või isikuandmetega sisu
käivitavad varasema kustutuse; withdraw ja konto kustutus kasutavad sama kihilist rada.
Püsiv worker kustutab ainult tähtaja ületanud kihi, säilitab esitise audit/provenance'i rea,
taastub fail-, RAG-, DB- ja protsessikatkestusest ning blokeerib uuesti kinnitamata RAG-i enne
aastapiiri kustutust. UI ja andmekoopia näitavad kolme kihi tähtaegu eraldi; SMTP outbox jääb
andmeminimeerituks. Negatiivkontroll tõendas vana ühe-kella sidestuse; ühendatud sihttestid
92/92 PASS, päris PostgreSQL + ketas + sünteetiline RAG-sond 21/21 PASS, isoleeritud päris
RAG/Chroma `ingest → search → delete` PASS ja migratsiooniahel 200/200 PASS. Kõik ajutised
andmebaasid, failid ja RAG-hoidlad koristati kontrollitult. 15.08 järelparandus seob
litsentsi/allika aegumise scheduler-predikaadi nüüd aktiivse derivaadi- või RAG-kihiga, mistõttu
juba kustutatud tähtajaread ei saa piiratud batch'i täita ega uuemaid kustutusi näljutada;
sihttest lukustab aktiivse kihi filtri enne `take` piiri.

### SOL-MAT-13 — SMTP-teavituse tõrge kaob logisse ja tööjärjekord ei tea sellest — P2

**Tõend.** Puuduva recipient/from seadistuse korral teavitus ainult `console.warn`-ib ja väljub (`app/api/materials/route.js:57-65`). Pärast DB commit'i käivitatakse `sendMaterialUploadNotification()` fire-and-forget kujul; rejection logitakse, kuid ei looda outbox'i, notification-job'i, delivery state'i ega retry'd ning POST vastab 201 (`:269-282`). Negatiivkontroll kinnitas, et SMTP-promise on 201 vastusest lahti seotud. UI sõnum „Materjal on saadetud” kirjeldab püsivat DB-esitist, kuid ei erista „admini teavitus edastatud / ootel / ebaõnnestus” (`messages/et.json:1654-1667`).

**Mõju.** Materjal võib jääda adminile nähtamatult 100-realisest aknast allapoole või ootele ilma SLA käivitava teavituseta. Kasutaja näeb edukat saatmist, kuid süsteem ei suuda tõendada, kas ülevaatajale üldse anti teada.

**Vastuvõtukriteerium.** DB-esitise ja teavituskavatsuse loomine peab olema üks tehing/outbox; worker kasutab stabiilset Message-ID-d, retry/backoff'i ja auditeeritud delivered/failed seisu. Kasutajale võib upload'i edu jääda ausalt eraldi, kuid admini järjekord peab näitama teavituse tõrget. Negatiivtestid: config puudu, SMTP 4xx/5xx, timeout pärast võimalikku delivery't, protsessi surm pärast commit'i ja korduv worker ilma duplikaatkirjata.

**Seis.** DONE. Upload-batch on püsiv outbox: esitised ja `PENDING` teavituskavatsus sünnivad
samast DB-töövoost, worker claim'ib CAS-iga, kasutab batch'ist tuletatud püsivat RFC Message-ID-d
ning salvestab auditeeritult `SENT`, `RETRY` või `FAILED`. Teavituse tekst sisaldab ainult failide
arvu ja adminivaate linki; esitaja e-post, failinimed ja kommentaar ei lähe SMTP-sse ega outbox'i.
Adminijärjekord näitab staatust, katseid ja veakoodi. Ühiksihttestid olid 39/39 PASS; päris
PostgreSQL-i `materials:notifications:probe` oli 8/8 PASS: kaks worker'it saatsid ühe kirja,
config-puudus jäi nähtavaks retry'ks, SMTP 451 taastus ning SMTP-järgse DB/auditi crash'i stale
claim kasutas kordusel sama Message-ID-d. `materials:notifications` on repo worker-käsk.

## Testid ja negatiivkontrollid

### Sihttestid

Käsk:

```text
node --import ./scripts/register-node-test-loader.mjs --test tests/materials/submissions.test.js tests/dataExport/dataExportService.test.js tests/usage/privacyDeletionIntegration.test.js tests/events/retentionDeletion.test.js tests/usage/adminAccountOps.test.js tests/documents/documentsResearchContracts.test.js
```

Esimene jooks: **31 passed, 2 failed** ainult seetõttu, et värskes worktree's puudus ignoreeritud `generated/prisma/client.ts`; Materjalide 4/4 testid läbisid juba selles jooksus. Esimene `prisma generate` peatus puuduva `DATABASE_URL` tõttu. Seejärel genereeriti klient audit-worktree's fiktiivse lokaalse URL-iga (ühendust andmebaasi ei tehtud) ja sama käsk jooksutati uuesti.

Lõpptulemus: **40 tests; 40 passed; 0 failed; 0 skipped; 0 todo**.

Oluline semantiline piir: Materjalide enda testifailis on ainult neli review-helperi/serialiseerimise testi. Faili valideerimise, API autoriseerimise, upload/delete veasüsti, kvoodivõistluse, omanikuvaate, RAG-ingest'i, paginatsiooni, SMTP ja retention'i Materjalide teste ei ole. Dokumentide `SOL-DOC-07` contract-test läbis, kuid ei loetle `app/api/materials/route.js`-i; roheline test ei tõenda Materjalide kvooti.

### Negatiivkontrollid

- **Failisisu 4/4 vigast payload'i aktsepteeritud:** võlts-DOCX ZIP-päisega; võlts-PDF `%PDF-` päisega; binaarne TXT pärast 4096-baidist kontrollakent; nullbaidine TXT.
- **Koodiraja 13/13 riski kinnitatud:** POST-il pole tellimus- ega spetsialistirolli väravat; kvoot loetakse lukustamata; fail enne DB-d; admini unlink enne DB delete'i; review'l pole CAS-i; imported'il pole ingest/doc linki; adminilist 100 ja cursorita; data export jätab Materjalid välja; skeemis pole RAG/rights/retention välju; download kasutab best-effort auditit; imported-update muudab ainult review-välju; direct-status ei vaja eelmist olekut.
- **Töövoo 8/8 lünka kinnitatud:** omaniku loend/staatus/withdraw puudub; GET admin-only; idempotentsusvõti puudub; sha ei dedupe'i; limiter on protsessimälus; SMTP failure on 201-st lahti seotud; retention engine ei tunne Materjale; reviewNote kärbitakse vaikides.
- **Konto kustutuse 2/2 positiivkontrolli läbitud:** materjalifaili cleanup eelneb user delete'ile; fail cleanup'i tõrge blokeerib user delete'i.

Kõik kontrollid kasutasid ainult sünteetilisi mälusisendeid või lähtekoodi. Production-andmeid, päris kasutajaid, PIN-e, SMTP-d ega RAG-i ei kasutatud.

## Prioriteedid ja kokkuvõte

| Prioriteet | Arv |
|---|---:|
| P0 | 0 |
| P1 | 8 |
| P2 | 5 |
| P3 | 0 |
| **Kokku** | **13** |

## Olemasolevate leidudega kontrollitud kattuvused

- `SOL-DOC-04` — DONE ainult nimetatud transkriptiradadel; selle Seis ütleb ise, et sama fail-enne-DB muster võib mujal alles olla. `SOL-MAT-03` on Materjalide tõendatud katmata rada, mitte uus DOC-04 ID.
- `SOL-DOC-07` — DONE ja vastuvõtukriteerium nimetas Materjale, kuid teostus/contract-test kontrollivad nelja dokumendirada. `SOL-MAT-04` on ametliku DONE suhtes eraldi tõendatud Materjalide regressioon/katmata rada.
- `SOL-DOC-09` — DONE puudutab SavedAnalysis auditit; ei kata Materjalide download/review/delete auditit.
- `SOL-RAGADMIN-*` ja `SOL-RAGSVC-*` — nende RAG ingest/delete terviklikkus ei loo `MaterialSubmission ↔ doc_id` seost ega muuda `mark_imported` semantikat.
- `SOL-REF-06` ja `SOL-SPROF-08` — eraldi objektiklasside data-export leiud; Materjalide registripuudujääk ei olnud neis kaetud.
- `parandusaudit.md` kontrolliti pärast põhiauditi Seis-lõike. See koondab `SOL-DOC-04/-07/-09` parandused, kuid ei sisalda Materjalide eraldi lõpetatud peatükki ega tõenda Materjalide route'i.
- Varasem failielutsükli audit ja RAG-elutsükli disain olid toetavad kaardistused, mitte ametlik DONE-allikas. Need mainisid Materjalide retention'i, omanikuvaate ja RAG-silla puudumist; kõik käesolevad ID-d tõendati uuesti commit'i `c9cefd…` aktiivsest koodist.

## Mis jäi Materjalides tõendamata

- päris sessiooniga HTTP-vastused kõigi rollide ja aegunud/aktiivse tellimuse korral;
- päris PostgreSQL-i paralleelne Materjalide upload ning kvoodi tegelik ületus;
- protsessi surm ja veasüst faili/DB iga piiri ees/järel, samuti võimalike ajalooliste orbude olemasolu;
- päris SMTP konfigureeritus, delivery, timeout/duplikaat ja admini tegelik review-SLA;
- kas mõni käsitsi `imported` rida vastab production RAG-i `doc_id`-le ning kas eemaldamise järel jäävad chunk'id;
- production failisüsteemi/DB/RAG/emaili retention ja konto kustutuse täielik nulljääk;
- päris brauseri omaniku/admini visuaalne ja ligipääsetavuse runtime.

Need jäävad ausalt seisuga **NOT_PROVEN; runtime: not_run**.

## Järgmine soovitatud auditimoodul

Vastavalt kinnitatud järjekorrale: **Tööheaolu** — lõpetada osaline runtime ja katmata tervikahelad. Materjalide raport ei lõpeta platvormi süvaauditit.
