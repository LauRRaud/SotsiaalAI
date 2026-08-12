# SotsiaalAI SOL-süvaaudit — jätk: Dokumendid

**Auditi seis:** esimese `SOL-DOC` süvaploki järel katmata omanikuvaate, faili-, jagamis-, ekspordi-, kustutus- ja retention-radade staatiline süvaaudit `DONE`; runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `a7b369ca70e2a5a871c88025de99aa8e6478ca1c`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-doc-a7b369c` (detached HEAD). Auditi ajal liikunud ja määrdunud põhi-worktree'd ega teise akna commit'imata parandusi ei kasutatud tõendina.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Kasutajale nähtav leht ja sisenemisteed | DONE | `/documents`, tööruumi embed, vestluse/koostamise/transkriptsiooni/uuringu sissepääsud, rollisuunamine ja vanad artefakti süvalingid |
| Omanikuvaade ja Reacti olek | DONE | nelja objektipere laadimine, filtrid, rename, RAG-luba, avamine, kopeerimine, allalaadimine, kustutamine, retry ja osalise vea kuvamine |
| Dokumendi API ja failid | DONE | list/get/post/patch/delete/download, autentimine, tellimus, roll, MIME/signatuur, staging, kvoot, rate-limit, audit ja veajärjekorrad |
| Artefaktid ja salvestatud analüüsid | DONE | list/detail/mutation/approve/download/delete, FINAL/CAS, allikad, `SavedAnalysis` loomine/list/detail/delete ja kohustuslik analüüsiaudit |
| Jagamine | PARTIAL | tavalisel `UserDocument`-il puudub üldine jagamisleping; koosolekukokkuvõtte ruumikoopia ja teenuspäeviku aruande koopia kontrolliti kattuvusena, kuid nende tervikvooge ei avatud siin uuesti |
| Prisma ja migratsioonid | DONE | `UserDocument`, `AgentArtifact`, `AgentArtifactSourceDocument`, `TranscriptionJob`, `DocumentAudit`, `SavedAnalysis`, seosed ning dokumentide/artefaktide/auditi/audio/analüüsi migratsioonid |
| RAG, konto kustutus ja retention | DONE | privaatne `agent_documents` indeks, kustutusjobid, faili- ja RAG-cleanup, konto kustutuse fail-closed retry, 90 päeva sweep ning varasema FAILID-A0 kattuvused |
| Andmekoopia | DONE | `documents_and_artifacts` register, algfailid, manifest, ZIP worker, omaniku download, expiry ja kustutuse-eelne koopia valik |
| Päris runtime | NOT_PROVEN | autentitud brauser, päris PostgreSQL-i samaaegsus, päris RAG, päris hoidla/ZIP ja retention-worker `not_run` |

## Auditeeritud failid ja funktsioonid

- `app/documents/page.js`, `components/documents/DocumentsPage.jsx`, `DocumentsDropdown.jsx`, `ArtifactDetailPage.jsx`; `loadWorkspace()`, nelja pere loaderid, `patchDocument()`, allalaadimis- ja kustutustoimingud, RAG-lüliti ning truncation-seis.
- `app/api/documents/route.js`, `[id]/route.js`, `[id]/download/route.js`, `audio-sources/route.js`, `[id]/audio-select/route.js`, `[id]/transcribe/route.js`, `[id]/summary/route.js`; omaniku- ja tellimuspiir, list/paginatsioon, upload, PATCH, staging, transkriptsioon, kokkuvõte, allalaadimine ja kustutus.
- `app/api/documents/artifacts/**`; list/detail/generate/refine/approve/download/delete, `expectedUpdatedAt`, idempotentsus, rate-limit, kvoot ja minimaalne projektsioon.
- `app/api/documents/analyses/**`, `lib/documents/savedAnalysis.js`; loomine, allika omandi kontroll, list/detail/delete, quota ja audit.
- `lib/documents/server.js`, `storageStaging.js`, `transcriptContent.js`, `deleteDocumentRecord.js`, `storageQuota.js`, `rateLimit.js`, `listing.js`, `workspace.js`, `presentation.js`, `audit.js`, `auditShared.js`; `lib/storageUsage.js`.
- `lib/documents/embeddings.js`, `ragService.js`, `search.js`, `sourceMaterial.js`, `generation.js`; privaatse RAG-i ID, ingest, täpne serveripoolne otsinguskoop ja eemaldamine.
- `lib/privacy/documentDeletion.js`, `fileDeletion.js`, `userDeletion.js`, `userDeletionOrchestrator.js`, `retryDeletionJob.js`; faili/RAG-i püsivad cleanup-jobid, konto kustutuse peatamine ja retry.
- `lib/retention.js`; artefaktide ja dokumentide 90 päeva sweep, väliste koopiate kustutuse eeltingimus ning auditiretention.
- `lib/dataExport/registry.js`, `service.js`, `zip.js`; dokumentide/artefaktide register, algfailide lugemine, manifest, worker, download ja expiry.
- `prisma/schema.prisma` ning migratsioonid `20260227143000_add_documents`, `20260227170000_add_agent_artifacts`, `20260227193000_add_document_audit`, `20260324143000_refine_document_audit`, `20260524143000_document_audio_workflow`, `20260811020000_sol_doc_09_analysis_audit_actions` ja seotud hilisemad dokumendimuudatused.
- Põhiauditi `SOL-DOC-01`–`09` kõik `Seis`-lõigud, `SOL-RAGSVC-09`, `SOL-SEARCH-04`, `SOL-SLOG-12`, `SOL-CHAT-10`, `SOL-CALL-06`–`10`; `parandusaudit.md`; varasem `fable-5-failide-ja-meedia-elutsukkel.md` (`F-01`–`F-16`).

## Leiud

### SOL-DOC-J-01 — omanikuvaade peidab iga objektipere vanemad kui 50 kirjet — P2

**Tõend.** `DocumentsPage` määrab aknaks 50 ja laeb dokumendid, artefaktid, analüüsid ning uuringud igaüks ainult `offset: "0"` väärtusega (`components/documents/DocumentsPage.jsx:33,100-163`). API-d annavad koguarvu ja paginatsiooni, kuid komponent talletab ainult esimese vastuse; `anyTruncated` kuvab ühe staatilise hoiatuse, mitte järgmist lehte või „laadi veel” toimingut (`:230-234,781`). Ka otsing/filtrid rakenduvad ainult juba laetud lõikele. Auditispetsiifiline negatiivkontroll kinnitas neli `offset=0` loaderit ja ühegi load-more/append/`hasNext` raja puudumise.

**Mõju.** 51. ja vanem oma dokument, lõplik artefakt, salvestatud analüüs või uuring ei ole omaniku tööruumis avatav, allalaaditav ega kustutatav. Hoiatus ütleb vaid, et nimekiri on lühendatud, kuid ei anna võimalust puuduva isikliku sisuni jõuda.

**Vastuvõtukriteerium.** Kõigil neljal perel peab olema stabiilne cursor või offset-paginatsioon ja kasutatav järgmise lehe toiming; filter/otsing peab töötama kogu serveripoolse hulga, mitte esimese 50 peal. Test peab looma igasse peresse vähemalt 51 omaniku kirjet, läbima kõik lehed ilma kadumise/duplikaadita ning avama ja kustutama 51. kirje.

**Seis (12.08.2026): DONE — omanikuvaate neli objektiperet kasutavad nüüd oma serveripoolset koguarvu ja dünaamilist offset-paginatsiooni ning ühine „laadi vanemad objektid” toiming lisab järgmised lehed ID järgi duplikaadivabalt.** Sama otsingutermin läheb kõigisse nelja API-sse enne count'i ja paginatsiooni, seega otsing ei piirdu enam esimese 50 reaga; 51. kirje jõuab samasse `renderRow` avamis-/allalaadimis-/kustutusrajale nagu esimene. Sihttest 3/3 lõi igasse peresse 51 kirjet, lisas kattuva lehe ja tõendas 204 unikaalse rea ning kõigi nelja 51. rea jõudmise ühtsesse tööruumi; dokumentide, analüüside ja uuringute otsingupäring valideeriti päris PostgreSQL-i vastu. Autentitud brauserivoog `not_run`; peatüki lõpu täissviit 4223/4223 PASS.

### SOL-DOC-J-02 — dokumendi paralleelsed muudatused kirjutavad vaikides üksteise üle — P1

**Tõend.** Dokumendi PATCH loeb rea ja arvutab uue pealkirja, liigi, malli, `agentAllowed` väärtuse ning transkripti sisu selle snapshoti põhjal (`app/api/documents/[id]/route.js:202-228`). Tavaline update sihib hiljem ainult `where: { id }`; staged tekstiuuendus saab samuti ainult ID tingimuse (`:253-279`). Route ei võta vastu `expectedUpdatedAt`/revision väärtust ning Reacti `patchDocument()` saadab ainult muudetava välja (`components/documents/DocumentsPage.jsx:285-306,612`). Erinevalt sama mooduli parandatud artefaktidest ei saa kaotaja 409. Negatiivkontroll kinnitas nii serveri CAS-tingimuse kui kliendi revision-välja puudumise.

**Mõju.** Kaks vahekaarti võivad pealkirja, dokumendiliigi, transkripti paranduse või RAG-kasutusloa teise kasutaja nähtamatu stale-väärtusega üle kirjutada. Eriti loa puhul võib hilisem vana vaade laiendada uuesti töörežiimi ligipääsu, kuigi kasutaja just keelas selle.

**Vastuvõtukriteerium.** PATCH peab nõudma omaniku nähtud revision'i/`updatedAt` väärtust ja tegema tingimusliku `id + ownerId + expected version` kirjutuse; staged failivahetus peab sama konflikti korral vana faili säilitama. Kaotaja saab 409 ja värske seisu. Päris PostgreSQL-i võistlustest peab katma kaks rename'i, kaks transkripti PATCH-i ning `agentAllowed true/false` ristvõistluse koos ketta/DB koherentsusega.

**Seis (12.08.2026): DONE — `UserDocument` PATCH nõuab nüüd kliendi nähtud `expectedUpdatedAt` versiooni ning kirjutab ühe tingimusliku `id + ownerId + updatedAt` CAS-lausega; kaotaja saab 409 koos värske dokumendiga.** Sama CAS on staged transkripti faili avaldamise ees, seega konflikt koristab kandidaadi ja jätab vana faili puutumata. Kõik Dokumendid- ja Dokirežiimi PATCH-kliendid saadavad oma nähtud revisjoni ning võtavad 409 vastusest värske rea. Sihttestid 12/12 kattis CAS-i, kohustusliku revisjoni, staged rollback'i ja varasema failikoherentsuse; `npm run doc:mutation:probe` 10/10 päris PostgreSQL-is ja päris kettal kattis kaks rename'i, kaks transkripti PATCH-i ning `agentAllowed true/false` ristvõistluse, igas täpselt ühe võitja ja 409 kaotaja. DB/fail olid koherentsed, staged jääke 0 ja sünteetilise kasutaja cleanup 0; autentitud brauserivoog `not_run`, peatüki lõpu täissviit 4223/4223 PASS.

### SOL-DOC-J-03 — RAG-kasutusloa tagasivõtmine ei eemalda juba indekseeritud koopiat — P1

**Tõend.** RAG-i kasutamisel luuakse dokumendist väline ID `agent::<documentId>::<sha256>` ja tekst saadetakse `/ingest/text` kaudu eraldi `agent_documents` kollektsiooni (`lib/documents/embeddings.js:5-23,46-74`). UI lubab `agentAllowed` lülitiga dokumendi töörežiimi jagatud otsingusse või sealt välja võtta (`components/documents/DocumentsPage.jsx:605-615`; `lib/documents/workspace.js:47-67`). PATCH muudab lüliti keelamisel ainult Prisma välja (`app/api/documents/[id]/route.js:224-225,258-278`); RAG-delete'i kutsutakse alles kogu dokumendi DELETE-rajal (`:366-374`). Negatiivkontroll kinnitas, et `true → false` rajal pole `deleteDocumentIndex`/RAG-delete'i ega püsivat cleanup-job'i. DOK-XTEN üldotsingu deny-piir hoiab selle koopia tavalisest RAG-otsingust väljas, kuid ei muuda tagasivõtmist füüsiliseks eemaldamiseks.

**Mõju.** Kasutaja selge loa tagasivõtmise järel jääb dokumendi tundlik tekst välisesse vektorhoidlasse kuni dokumendi hilisema kustutuse või retentionini. UI väide „ei lähe jagatud otsingusse” kirjeldab tulevast valikut, kuid jätab olemasoleva koopia ja selle eemaldamise seisu kasutajale nähtamatuks.

**Vastuvõtukriteerium.** `agentAllowed true → false` peab looma auditeeritud, idempotentse RAG-delete'i ja jätma loa eemaldamise oleku `pending/failed/done` kujul taastatavaks; korduslubamine tohib ingestida alles koherentse värske versiooni. Testida päris RAG-is ingest → keela → GET/search puudub, RAG-i tõrge + retry, paralleelne keela/luba ja konto kustutus. Üldotsingu deny-piir peab jääma kaitseks alles.

**Seis (12.08.2026): PARTIAL — koodis on `agentAllowed true → false` nüüd auditeeritud ja idempotentne püsiv `DataDeletionJob`: töö ning `metadata.ragRemoval=pending` sünnivad enne kaugkatset samas CAS-tehingus, tõrge jääb `failed`-ina taastatavaks ja kinnitatud kustutus liigub `done`-iks.** Lõpetamata töö blokeerib nii korduslubamise kui `ensureDocumentIndexed()` ingest'i; retry viib sama jobId-ga dokumendi seisu `done`, misjärel lubamine saab ingestida ainult värske SHA/`updatedAt` versiooni. Liides näitab pending/failed seisu ega luba seda lülitiga peita. Sihttestid 15/15 katsid järjekorra, tõrke, done-seisu, re-enable/ingest tõkke ja retry; `npm run doc:rag-removal:probe` 15/15 päris PostgreSQL-is kattis püsiva job'i, auditid, tõrke + retry, paralleelse keela/luba võistluse, idempotentsuse ning cleanup'i `users=0 jobs=0 audits=0`. Päris RAG-i ingest → keela → GET/search puudub ja konto kustutuse välisots on siiski **NOT_PROVEN**, sest kohalikus keskkonnas puuduvad RAG-võti ja kuulav teenus; leidu ei märgita enne seda DONE-iks.

### SOL-DOC-J-04 — salvestatud analüüsid puuduvad kasutaja tervikandmekoopiast — P1

**Tõend.** `SavedAnalysis` on eraldi omanikuobjekt, mille sisu on kuni 200 kB, mida kasutaja näeb Dokumendid-vaates ning mis säilib kuni kasutaja kustutuseni (`prisma/schema.prisma:3883-3897`; `lib/documents/savedAnalysis.js:7-18,54-67,75-117`). Andmekoopia `documents_and_artifacts` pind pärib ainult `userDocument` ja `agentArtifact` read; metadata sisaldab vaid `documents` ja `artifacts` massiive (`lib/dataExport/registry.js:152-176`). Auditispetsiifiline negatiivkontroll andis fake-DB-le privaatse `SavedAnalysis` rea ja tõendas, et eksport ei kutsunud mudelit ega sisaldanud selle sisu. Olemasolev andmekoopia test-fake ei defineeri samuti `savedAnalysis` mudelit ja jääb seetõttu roheliseks.

**Mõju.** „Tervikandmekoopia” võib edukalt valmida ilma kasutaja teadlikult salvestatud AI-analüüside ja nende allikaviideteta. Kasutaja ei saa enne konto kustutamist kogu oma Dokumendid-tööruumi sisu kaasa võtta ning manifest ei ütle, et see objektiklass jäeti välja.

**Vastuvõtukriteerium.** `SavedAnalysis` peab olema andmekoopia allowlistis eraldi versioonitud pinnana või dokumentide pinna osana, koos sisu, pealkirja, disclaimer'i, ajatemplite ja omaniku allikaviidetega; manifest peab näitama täpset arvu. Negatiivtest peab lisama ainult analüüsi omava kasutaja, võõra analüüsi ja kustutatud allikad ning kontrollima, et oma sisu on kaasas ja võõras mitte.

**Seis (12.08.2026): DONE — `SavedAnalysis` on nüüd andmekoopia eraldi versioonitud `saved_analyses` allowlist-pind, mis ekspordib ainult omaniku analüüsi ID, pealkirja, sisu, disclaimer'i, ajatemplid ja allikadokumendi ID-d.** Kustutatud allika ID säilib päritoluviitena, kuid võõra omaniku rida ei läbi `ownerId` filtrit; manifest loendab pinna read eraldi ja täpselt. Andmekoopia sihttestid 12/12 ning `npm run doc:saved-analysis-export:probe` 6/6 päris PostgreSQL-is tõendas ühe omaniku ja ühe võõra analüüsiga omaniku sisu, disclaimer'i, kustutatud allikaviite, võõra sisu puudumise, versiooni `1.0` ja manifesti `recordCount=1`; cleanup `users=0`.

### SOL-DOC-J-05 — puuduv algfail ei muuda andmekoopiat veaks ega ausalt osaliseks — P2

**Tõend.** Andmekoopia register püüab iga `UserDocument.storagePath` lugemisvea kinni ja jätkab ilma faili või veakirjeta (`lib/dataExport/registry.js:162-171`). `documents.json` sisaldab rida siiski edasi ning selle `count` loetakse täies mahus; manifesti pind liidab selle `recordCount` väärtusse ja loetleb ainult tegelikult lisatud ZIP-failid (`:172-176`; `lib/dataExport/service.js:135-149`). Negatiivkontroll andis ühe olematu storagePath'iga dokumendi: kogumine õnnestus, manifesti `recordCount` oli 1, aga `files/` kirjeid oli 0 ja ühtegi `missing/error/partial` markerit ei tekkinud.

**Mõju.** Failisüsteemi lahknemise või varasema cleanup-vea järel saab kasutaja READY-seisus koopia, mis näeb manifesti järgi täielik välja, kuid sisaldab ainult faili metaandmeid. Just enne konto kustutamist võib see olla kasutaja viimane võimalus algfail kätte saada ning vaikne puudumine muudab andmekao hiljem tõendamatuks.

**Vastuvõtukriteerium.** Algfaili puudumine peab kas lõpetama töö selge FAILED-seisuga või andma kasutaja kinnitatud `partial` koopia, mille manifest loetleb iga puuduva objekti stabiilse ID, põhjuse ja retry-seisu. Testida ENOENT, ligipääsuviga, containment-viga ja lugemise keskel tekkinud viga; ükski neist ei tohi anda märgistamata READY „täiskoopiat”.

**Seis (12.08.2026): DONE — Dokumendid-pinna ükskõik milline algfaili lugemisviga katkestab nüüd kogu andmekoopia töö stabiilse `documentId + reason` failureCode'iga; märgistamata READY koopiat ega ZIP-faili ei teki.** Põhjused eristavad `missing`, `access_denied`, `containment` ja muud `read_failed` vead, kuid storage path'i ega toore erindi teksti ei lekitata. Veasüsti sihttestid 13/13 katsid ENOENT, EACCES, containment'i ja keset lugemist tekkinud tõrke ning FAILED-worker'i; `npm run doc:missing-export-file:probe` 6/6 päris PostgreSQL-is kinnitas FAILED seisu, masinloetava koodi, puuduva outputPath/ZIP-i ja kohustusliku `DATA_EXPORT_FAILED` auditi, cleanup `users=0`.

### SOL-DOC-J-06 — dokumendi allalaadimise ja artefakti kustutuse audit võib vaikides puududa — P2

**Tõend.** Dokumendi ja FINAL-artefakti allalaadimisrajad loevad/genereerivad faili, kutsuvad `logDocumentsAudit()` ning tagastavad vastuse (`app/api/documents/[id]/download/route.js:48-77`; `app/api/documents/artifacts/[id]/download/route.js:84-137`). Artefakti DELETE kustutab rea enne sama logija kutsumist (`app/api/documents/artifacts/[id]/route.js:265-282`). `logDocumentsAudit()` kasutab globaalset Prismat, püüab `documentAudit.create()` vea kinni ega anna kutsujale auditikaost märku; samas moodulis olemas olev `writeDocumentAudit()` on kohustuslik fail-closed tee (`lib/documents/audit.js:23-56,59-72`). Negatiivkontroll kinnitas, et mõlemad download'id ja artefakti DELETE kasutavad ainult neelavat teed. See ei dubleeri parandatud `SOL-CHAT-10`: vestluse eksport viidi kohustuslikule teele, need Dokumendid-rajad jäid best-effort'iks.

**Mõju.** Tundliku faili väljastamine või lõpliku artefakti pöördumatu kustutamine võib API järgi õnnestuda ilma püsiva jäljeta, kes ja millal toimingu tegi. Artefakti kustutuse järel ei saa audititabeli tõrke korral toimingut enam samas katses taastada ega tõendada.

**Vastuvõtukriteerium.** Omanik peab nende toimingute auditile valima sama selge lepingu nagu vestluse ekspordil: allalaadimine fail-closed enne faili või durable transactional outbox; artefakti kustutus ja audit samas DB-tehingus. Veasüstetest peab katkestama auditirea loomise pärast faili genereerimist ja artefakti delete'i juures ning tõendama, et ei teki auditita edukat vastust ega auditita kustutust.

**Seis (12.08.2026): DONE — dokumendi ja FINAL-artefakti allalaadimine kasutavad nüüd kohustuslikku `writeDocumentAudit()` rada pärast baitide valmimist, kuid enne `Response` loomist; audititõrge katkestab väljastuse.** Artefakti kustutuse audit kirjutatakse enne DELETE-i ja mõlemad on samas tehingus: audititõrke korral rida säilib, delete-tõrke korral audit pöördub tagasi. Kuna FK `artifactId` muutub kustutamisel `SET NULL`-iks, jääb kustutatud artefakti stabiilne ID auditi metaossa `deletedArtifactId`. Sihttestid 5/5 katsid mõlema download-auditi veasüsti, vastuse järjekorra ning kustutuse edu/tõrke; `npm run doc:artifact-audit:probe` 5/5 päris PostgreSQL-is tõendas audititõrke järel alles artefakti ja 0 auditit ning eduka tehingu järel 0 artefakti ja täpselt ühe stabiilse ID-ga auditi, cleanup `users=0`.

**Paranduste peatükilõpu värav (12.08.2026):** `TZ=UTC npm test` **4223/4223 PASS**; `npm run i18n:check` puhas; Prisma **166 migratsiooni**, andmebaas ajakohane; `git diff --check` puhas. ESLint: **0 viga**, kolm varasemat selle plokiga mitteseotud hoiatust. Täissviiti jooksutati ploki lõpus, mitte iga leiu järel.

## Testid ja negatiivkontrollid

### Sihttestid

Käsk:

```text
node --import ./scripts/register-node-test-loader.mjs --test tests/documents/*.test.js tests/dataExport/dataExportService.test.js tests/privacy/accountDeletionContent.test.js tests/privacy/meetingSummaryAccountDeletion.test.js
```

Tulemus: **126/126 PASS**, 0 fail, 0 skipped, kestus **70 897 ms**. Sviit sisaldas 12 Dokumendid-testi, andmekoopia teenuse testi ning konto-/koosolekusnapshoti kustutuse sihtteste. Koosolekutestide tahtlikud veasüstid logisid RAG/DB/provideri tõrkeid; protsessi lõpptulemus oli siiski 126 PASS. Dummy-ühenduse logid ei ole päris PostgreSQL-i runtime-tõend.

Lisaks: `npx prisma generate` **PASS**, Prisma 7.8.0, genereeritud klient audit-worktree ignoreeritud `generated/prisma` kaustas; tootmisandmeid ega migratsioone ei kasutatud.

### Auditispetsiifilised negatiivkontrollid

Kõik **6/6 PASS**:

1. neli omaniku loaderit kasutavad ainult `offset=0`; load-more/append/`hasNext` rada puudub;
2. `UserDocument` PATCH ja React ei kanna revision/CAS-i;
3. `agentAllowed true → false` ei kutsu RAG-delete'i;
4. `SavedAnalysis` ei pärita ega jõua ZIP-i;
5. olematu algfailiga dokument annab eduka metadata-pinna `recordCount=1`, kuid 0 failikirjet ja 0 partial-markerit;
6. download/delete rajad kasutavad neelavat best-effort auditit ning artefakt kustutatakse enne seda.

## Olemasolevate leidudega kontrollitud kattuvused

- `SOL-DOC-01`–`09` olid fikseeritud commit'is kõik `DONE`; nende parandatud tasuarvestus, transkriptsiooni limiit/idempotentsus, artefakti FINAL-CAS, staged failikirjutus, refinement-slot, kvoodi atomaar­sus ja analüüsiaudit kontrolliti ning neid ei avatud uuesti. Uus `SOL-DOC-J-02` puudutab teist mudelit (`UserDocument`), millele artefakti CAS-parandus ei rakendu.
- FAILID-A0 `F-02` kirjeldab vana SHA-ga RAG-vektori jäämist sisu muutmisel; `SOL-DOC-J-03` on eraldi loa tagasivõtmise rada muutumatu SHA korral. Üldotsingu DOK-XTEN deny-piiri regressiooni ei leitud.
- FAILID-A0 `F-07`, põhiauditi `SOL-RAGSVC-09` ja `lib/documents/deleteDocumentRecord.js` katavad üksikdokumendi vale kustutusedu faili/RAG-i jäämisel. Sama DELETE-rada uue ID-ga ei dubleeritud.
- FAILID-A0 `F-06` (retention-sweep'i käivitamise töökindlus), `F-09` (üldised file↔DB crash-window'd), `F-14` (403/404 olemasoluoraakel), `F-15` (artefakti versioon) ja `F-16` (tuletatud vestlussisu) jäid oma varasemate ID-de alla. Dokumendi/detaili võõras ID annab selles commit'is 404.
- `SOL-SLOG-12` (7-aastase teenuspäeviku aruande üld-DELETE), `SOL-SLOG-15` (jagatud aruandekoopia) ning koosolekukokkuvõtte ruumikoopia ei saanud uusi Dokumendid-ID-sid.
- `SOL-CHAT-10` on DONE ainult vestluse ekspordi kohustusliku auditi jaoks; `SOL-DOC-J-06` tõendab sama mehhanismi katmata Dokumendid-allalaadimise ja artefakti kustutuse teedel.
- `SOL-SEARCH-04` puudutab otsingutulemuse üldist `/documents` href'i, mitte omanikuvaate 50 rea piiri, ning jäi eraldi.
- `parandusaudit.md` 104/357 koondseisu kasutati ainult kontrollindeksina; ametlikuks seisuks loeti põhiauditi `Seis`-lõik ja seejärel fikseeritud kood.

## Leidude koond

| Prioriteet | Arv |
|---|---:|
| P0 | 0 |
| P1 | 3 |
| P2 | 3 |
| P3 | 0 |
| **Kokku** | **6** |

## Mis jäi tõendamata

- Päris autentitud brauseris 51+ dokumendi/artefakti/analüüsi/uuringu omanikuvaade ja mobiili-/klaviatuurikäitumine.
- Päris PostgreSQL-is kaks konkureerivat `UserDocument` PATCH-i ning stale loa-/transkriptimuudatuse täpne ajastus.
- Päris RAG-is ingest → loa tagasivõtmine → vektorite/otsingu seis, RAG-tõrke retry ja paralleelne keela/luba.
- Päris hoidlas/andmekoopia workeris puuduva või lugematu algfaili kasutajale nähtav lõpptulemus.
- Konto kustutuse ja retention-worker'i päris faili-, RAG-, `SavedAnalysis`-cascade'i ja retry tervikahel.
- Production-migratsioonide, cron'i, SMTP-teavituse ning päris andmekoopia allalaadimise seis. Kõik need on `NOT_PROVEN`; `runtime: not_run`.

## Järgmine soovitatud auditimoodul

**Koosta dokument** — kogu kasutajaliidesest agendi, allikadokumentide/RAG-i, artefakti loomise, refinement'i, kinnitamise, ekspordi ja salvestamiseni ulatuv tervikahel. Esimese `SOL-DOC` ploki parandatud serveriprimitiive ei pea uuesti alustama, kuid nende tegelik orkestreerimine koostamisvaates vajab eraldi lõpp-lõpuni kontrolli.
