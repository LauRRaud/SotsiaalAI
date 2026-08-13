# SotsiaalAI SOL-süvaaudit — jätk: Teenuspäevik

**Auditi seis:** Teenuspäeviku kasutaja- ja kliendivaated, suunamised, teenuskirjed, parandused, kuukoond, narratiiv, AI-mustand, eksport, aruandearhiiv, juhile jagamine, päevateekond, külastused, asukoht, marsruutimine, mõõtmine, Prisma kandjad, konto kustutus, andmekoopia ja retention on staatiliselt tervikahelana `DONE`; päris autentitud brauseri-, PostgreSQL-i, failisüsteemi-, SMTP-, in-ADS- ja OSRM-runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `11bc4f399c94565db23a725a3b3ec92dbc534636`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-slog-11bc4f3` (detached HEAD). Audit ei kasutanud tõendina põhiprojekti hilisemaid commit'e, commit'imata parandusi ega vana `SotsiaalAI-sol-audit-cfa62ea` koopiat. Ignoreeritud Prisma klient genereeriti ainult audit-worktree'sse testide käivitamiseks; skeemi ega tootmiskoodi ei muudetud.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Lehed ja sisenemisteed | DONE | `/teenuspaevik`, töölauakaart, serveri- ja proxy-värav, SERVICE_PROVIDER/CLIENT rollid, päeva/suunamiste/aruannete vahekaardid ning organisatsiooni juhile saadetud aruande saajavaade |
| React ja olekuhaldus | DONE | päeva vorm ja offline-outbox, mustandi taastamine, neli ajatemplit, käsikinnitus, kuuvaade, suunamised, narratiiv, AI-mustand, eksport, arhiveeritud aruanded, jagamine/tagasivõtmine, päevateekond, külastuste olekud, aadressiotsing ja navigatsioon |
| API ja autoriseerimine | DONE | `service-entries`, `service-referrals`, `service-narratives`, `service-reports/export`, `service-log/client|month|measure|report-share`, `service-visits` ning organisatsiooni aruande avamine; feature gate, sessioon, efektiivne roll, owner-/client-/membership-skoop ja rate-limit |
| Äriloogika ja samaaegsus | DONE | kirje loomine/muutmine/kinnitamine/tühistamine/kustutamine, parandusahel, idempotentsus, referral-integrity ja saldo, kliendi kuuekinnitus, narratiivi upsert/seed, ekspordimallid, aruandearhiiv/jagamine, route/visit masin, järjestus, läbisõit ja dispatch |
| Prisma ja migratsioonid | DONE | `ServiceProviderProfile`, `ServiceReferral`, `ServiceEntry`, `ServiceEntryCorrection`, `ServiceMonthlyNarrative`, `ServiceLogTimeSample`, `ServiceReportShare`, `ServiceWorkRoute`, `ServiceVisit`, seosed, indeksid, osalised unikaalsused ja Teenuspäeviku migratsioonid |
| Failid ja välised koopiad | DONE | CSV/DOCX/PDF/STAR, `UserDocument` aruandearhiiv, juhile külmutatud failikoopia, download/open-audit, GPS punktid, in-ADS aadress, OSRM marsruut ja AI genereerimine/kvoot |
| Konto kustutus, andmekoopia ja retention | DONE | User FK-d ja tombstone-väljad, konto kustutuse kogur/orkestreerija/retry, `DATA_EXPORT_REGISTRY`, üldine retention-worker, 7 aasta arvestusankur ning aruande/jagatud koopia elutsükkel |
| Päris runtime | NOT_PROVEN | autenditud ET/EN/RU brauser, kaks kontot, päris PostgreSQL-i võistlused, protsessideülene rate-limit, failisüsteemi veasüst, SMTP, in-ADS/OSRM ja cron-worker `not_run` |

## Auditeeritud failid ja funktsioonid

- `app/teenuspaevik/page.jsx`, `components/serviceLog/ServiceLogShell.jsx`, `ServiceLogDay.jsx`, `ServiceLogReferrals.jsx`, `ServiceLogMonth.jsx`, `ServiceLogNarrative.jsx`, `ServiceLogExport.jsx`, `ServiceLogShare.jsx`, `ServiceLogClientMonth.jsx`, `ServiceLogRoute.jsx`, `ServiceLogRouteMap.jsx`, `ServiceLogBaseline.jsx`; kõik kasutajale nähtavad sisendid, olekud, toimingud ja veateated.
- `app/api/service-entries/**`, `service-referrals/**`, `service-narratives/**`, `service-reports/export/route.js`, `service-log/client|month|measure|report-share/**`, `service-visits/**`; meetodid, sisendid, guard'id, lokaliseeritud vead, omanikupiirid ja rate-limit.
- `app/org/[orgId]/aruanded/page.jsx`, `app/api/org/[orgId]/aruanded/**`; saaja membership-skoop, loend, külmutatud faili avamine ning avamismarker/audit.
- `lib/serviceLog/access.js`, `flags.js`, `entries.js`, `referrals.js`, `saldo.js`, `monthlyView.js`, `monthReport.js`, `clientView.js`, `narratives.js`, `narrativeSeed.js`, `narrativeDraft.js`; põhiandmed, olekud, parandused, kinnitus, mahud, koondid, kliendivaade ja AI sisend/päritolu.
- `lib/serviceLog/exportService.js`, `export/**`, `reportArchive.js`, `reportShare.js`; saaja- ja referral-skoop, kärpevärav, neli vormingut, failinimed, säilituse metaandmed, kordusväljastus, jagamine, saajaprojektsioon, avamine ja tagasivõtmine.
- `lib/serviceLog/dayRoute.js`, `dayRouteMachine.js`, `routing.js`, `routeOrder.js`, `mileage.js`, `geolocation.js`, `dispatchBoard.js`, `dispatchAssign.js`, `visitDraft.js`, `visitOrigin.js`; tööpäev, paus, külastus, asukohatempel, aadress/navigatsioon, ühe kirje sild ja organisatsioonisnapshot.
- `lib/serviceLog/deviceStore.js`, `outbox.js`, `timeSamples.js`, `measurement.js`; omanikuskoobitud seadmeolek, retry, mahupiir ja piloodimõõtmine.
- `lib/privacy/userDeletion.js`, `userDeletionOrchestrator.js`, `effectivePracticeAccountCleanup.js`, `lib/dataExport/registry.js`, `service.js`, `lib/retention.js`, `lib/documents/server.js`, `app/api/documents/[id]/**`; konto kustutus/retry, andmekoopia, retention ning aruandedokumendi fail/DB rada.
- `prisma/schema.prisma` ja Teenuspäeviku migratsioonid `20260802100000_service_log_v1`, `20260802140000_service_log_correction_trail`, `20260803000000_service_report_share`, `20260803120000_service_day_route`, `20260810160000` ja `20260810200000` organisatsioonipäritolu muudatustega.
- Põhiauditi `SOL-SLOG-01`–`24` iga leiu tõend ja `Seis`, parandusauditi Teenuspäeviku koond ning continuation-raportite asjakohased `SOL-COMP-01`, `SOL-FIELD-J-06/07` ja konto-/andmekoopia leiud.

## Leiud

### SOL-SLOG-J-01 — tegelik kasutajaliides ei võimalda teenuskirjet parandada, tühistada, kustutada ega parandusajalugu vaadata — P1

**Tõend.** Serveris on omaniku `PATCH` ja `DELETE`, lifecycle'i `void` ning `listEntryCorrections()` (`app/api/service-entries/[id]/route.js:34-66`; `[id]/lifecycle/route.js:26-55`; `lib/serviceLog/entries.js:609-783,860-905`). Päeva- ja kuuvaade kutsuvad aga kirje peal ainult `confirm_manual`, `unconfirm_manual` ja `finalize` toiminguid; neis pole redigeerimisvormi, põhjuse sisendit, `PATCH`/`DELETE` kutset, `void` nuppu ega paranduste ajaloo laadimist (`components/serviceLog/ServiceLogDay.jsx:1182-1274`; `ServiceLogMonth.jsx:88-126,228-282`). Ükski `app/api/**/route.js` ei impordi `listEntryCorrections()` funktsiooni, mistõttu paranduste ajalugu pole isegi otsese owner-API kaudu loetav. Auditispetsiifiline negatiivkontroll kinnitas korraga serverifunktsioonide olemasolu ja kasutaja-/API-tee puudumise.

**Mõju.** Eksliku mustandi ainus praktiline tee on see kinnitada või jätta igaveseks alles; kinnitatud arve alusdokumenti ei saa tooteliidesest RPS §10 järgi põhjusega parandada ega tühistada. Isegi otsese API-ga tehtud paranduse puhul ei saa omanik hiljem vaadata, mis, miks ja kelle poolt muutus. See muudab olemasoleva parandustabeli tavakasutuses sisuliselt kättesaamatuks.

**Vastuvõtukriteerium.** Päeva- või kuuvaates peab olema owner-only detail/toiming, mis lubab DRAFT-i redigeerida/kustutada ning FINAL-rida põhjusega parandada või tühistada; enne kinnitamist peab kuvama kogu muudetava sisu. Lisada owner-skoobitud paranduste ajaloo GET ja nähtav ajajoon. Negatiivtestid: võõras kirje 404, DRAFT delete, FINAL delete enne tähtaega 409, põhjuseta parandus/void 400, VOID muutmine 409, stale revision 409 ja parandusajaloo reload.

**Seis.** DONE — kuu kirjel on nüüd olekupõhine owner-toiming: DRAFT-i saab kogu muudetava sisuga parandada või kinnituse järel kustutada, FINAL-i saab ainult põhjusega parandada või tühistada ning VOID jääb read-only. Uus owner-skoobitud `GET /api/service-entries/[id]/corrections` kuvab põhjuse, aja ja muudetud väljad; ka tühistamine kirjutab parandustabelisse põhjuse ning võõras omanik saab 404. Auditispetsiifiline negatiivkontroll oli enne parandust **0/3** ja pärast parandust Teenuspäeviku sihtslice **40/40 PASS**. Päris lokaalses sünteetilises brauserirajas läbisid DRAFT edit/reload/delete, FINAL põhjuseta paranduse tõke, põhjusega parandus/reload/ajalugu ja void; loodud kirjed, suunamine ning kaks ajaproovi koristati pärast tõendit. `npm run build`, sihitud ESLint ja i18n kontroll läbisid.

### SOL-SLOG-J-02 — suunamist saab luua ja vaadata, kuid mitte parandada ega lõpetada — P1

**Tõend.** Server toetab suunamise `PATCH`-i, sh mahu, eesmärkide ja perioodi parandamist, ning `action:"end"` lõpetamist (`app/api/service-referrals/[id]/route.js:32-70`; `lib/serviceLog/referrals.js:197-305`). `ServiceLogReferrals` teeb ainult loendi GET-i ja loomise POST-i; olemasoleva kaardi juures kuvatakse saldo ja ENDED-silt, kuid ühtegi muutmise või lõpetamise toimingut pole (`components/serviceLog/ServiceLogReferrals.jsx:68-143,299-357`). Negatiivkontroll tõendas, et komponendis pole `PATCH`-i ega end-toimingut, kuigi sama serverirada on aktiivses koodis olemas.

**Mõju.** Vale maht, eesmärk või periood jääb kuukoondi, saldo ja narratiivi aluseks ning lõppenud KOV-i otsuse alla saab kasutajaliidesest jätkata uute kirjete tegemist. Töötaja ei saa ka serveri nõutud korrektset rada „lõpeta vana ja loo uus” tegelikust tootest kasutada, mistõttu aruanded võivad jääda vale otsuse külge või kasutaja peab pöörduma otse API/manuaalse andmeparanduse poole.

**Vastuvõtukriteerium.** Iga aktiivse suunamise juures peab olema muutmine ja teadliku kinnitusega lõpetamine; serveri lukureeglid tuleb kuvada arusaadava põhjusena ning lõpetatud suunamine jääb read-only ajalukku. Testida kasutamata ja kasutatud suunamise muutmist, perioodi kitsendamist üle olemasoleva kirje, end-vs-create võidujooksu, topeltlõpetamist, reload'i ja seda, et ENDED suunamine ei ilmu uue kirje valikusse.

**Seis.** DONE — aktiivse suunamise kaardil on muutmine ja teadliku kinnitusega lõpetamine; kasutamata otsuse välju saab muuta, kasutatud otsuse identiteet jääb lukku, olemasolevaid kirjeid välja jätva perioodikitsenduse veateade on nähtav ning ENDED jääb reload'i järel read-only ajalukku ega lähe uue kirje vaikimisi valikusse. Kirje loomine ja lõpetamine lukustavad sama `ServiceReferral` rea: `npm run slog:referral-race:probe` läbis päris ajutises PostgreSQL-is **11/11**, sh mõlemad järjekorrad, 409 kaotaja, topeltlõpetamine sihttestis ja puhas cleanup. Lokaalne sünteetiline brauserirada tõendas muutmise püsimist, teadlikku lõpetamist ja reload'i; ülesande andmed koristati.

### SOL-SLOG-J-03 — üks tekstimuudatus kustutab AI-mustandi päritolu salvestatud kuunarratiivilt — P1

**Tõend.** AI-route tagastab mustandi `provenance: AI_MUSTAND` märgisega ja skeemi/teenuse kommentaarid ütlevad, et `draftSource` peab näitama, kas lõpptekst sündis mustandist (`app/api/service-narratives/draft/route.js:107-116`; `lib/serviceLog/narrativeDraft.js:151-169`; `lib/serviceLog/narratives.js:39-55`; `prisma/schema.prisma:5571-5574`). UI seab genereerimise järel `isAiDraft=true`, kuid iga textarea `onChange` — ka ühe tähe või tühiku muutus — seab selle kohe `false`; salvestus saadab sel juhul `draftSource:null` (`components/serviceLog/ServiceLogNarrative.jsx:57-79,138-153,239-249`). Olemasolev test kinnitab ainult route'i ümbrise märgistust, mitte toimetatud teksti salvestust (`tests/serviceLog/narrativeDraft.test.js:89-96`). Auditispetsiifiline kontroll kinnitas selle täpse olekusiirde ja payload'i.

**Mõju.** Peaaegu täielikult AI kirjutatud sisuaruanne võib ühe kosmeetilise paranduse järel näida andmebaasis täielikult inimese loodud tekstina. KOV-i otsuse aluseks oleva narratiivi päritolu, kvaliteedikontroll ja hilisem vastutusjälg muutuvad eksitavaks just normaalsel „genereeri → toimetan → salvesta” rajal.

**Vastuvõtukriteerium.** `draftSource` peab tähistama teksti päritolu, mitte seda, kas baitidentne mustand on puutumata; AI-st alustatud narratiiv jääb AI-abistatuks ka pärast toimetamist. Kui soovitakse eristada ulatuslikku ümberkirjutust, vajab see eraldi tõendatavat olekut, mitte esimest klahvivajutust. Komponendi-/brauseritest peab genereerima, muutma ühe märgi, salvestama, reload'ima ja tõendama AI-abistatuse säilimist; täiesti käsitsi alustatud tekst peab jääma `null`-iks.

**Seis.** DONE — `draftSource` kirjeldab nüüd algallikat: AI-ga alustatud narratiiv jääb `AI_MUSTAND`-märgisega ka pärast inimese toimetust ja reload'i, täiesti käsitsi alustatud tekst jääb märgiseta. Sihttestid kinnitavad olekulepingu ning ehitatud rakenduse päris brauserirajas säilis märk pärast ühe märgi muutmist, päris API-sse salvestamist ja reload'i. Lokaalne väline AI-teenus ei olnud saadaval; brauseris asendati ainult draft-endpointi vastus deterministliku `AI_MUSTAND` sünteetilise vastusega, seed, salvestus, andmebaas ja reload olid päris. Ülesande narratiiv, kirje ja suunamine koristati.

### SOL-SLOG-J-04 — kuunarratiivi paralleelsed muudatused kirjutavad üksteist revision/CAS-ita üle — P1

**Tõend.** `PUT /api/service-narratives` ei võta `expectedUpdatedAt`, revision'i ega ETag'i (`app/api/service-narratives/route.js:59-75`). `upsertNarrative()` lahendab loomise unikaalsusvõistluse, kuid olemasoleva rea korral otsib ID ja teeb tingimusteta `update({where:{id}})` (`lib/serviceLog/narratives.js:127-211`). UI laadib küll `loadedId`, kuid ei saada seda ega loetud `updatedAt` väärtust salvestusel (`components/serviceLog/ServiceLogNarrative.jsx:81-125,131-168`). Auditispetsiifiline fake-DB semantikaproov saatis kaks samast vanast vaatest pärit muudatust: mõlemad vastasid eduna ja teise tekst jäi lõppreale (`STALE_NARRATIVE_OVERWRITE PASS`).

**Mõju.** Kaks vahelehte või aeglane vana seanss võivad kustutada teise töötlemise tulemuse ilma konfliktita. Kuna narratiiv sisaldab kliendi lugu ja teenuse jätkamise/muutmise/lõpetamise ettepanekut, võib kaduda sisuline täiendus, risk või otsuse põhjendus, samal ajal kui mõlemale kasutajatoimingule näidati edu.

**Vastuvõtukriteerium.** GET peab tagastama revision'i/`updatedAt`, PUT nõudma seda ning tegema tingimusliku update'i; stale kirjutaja saab 409 koos värske projektsiooniga ja saab teadlikult ühendada. Loomise upsert ja muutmise CAS peavad jääma eri lepinguteks. Päris PostgreSQL-i test peab võistlema create/create, update/update ja AI-vastus-vs-käsimuudatus ning tõendama, et ükski kinnitatud tekst ei kao vaikides.

**Seis.** DONE — GET-i `updatedAt` jõuab nüüd PUT-i `expectedUpdatedAt`-ina ning olemasoleva rea muutmine kasutab owner-skoobitud `updateMany` CAS-i. Loomise võistluse kaotaja ja stale muutja saavad 409 koos värske narratiiviprojektsiooniga; UI hoiab vana teksti vormil, näitab värsket kõrvutuseks ja laseb selle teadlikult üle võtta. `npm run slog:narrative-race:probe` läbis ajutises päris PostgreSQL-is **10/10**: create/create, update/update ja AI-vastus-vs-käsimuudatus, üks CAS-võitja, värske 409 projektsioon, säilinud tekst ja puhas cleanup. Ehitatud rakenduse brauserirada tõendas stale teksti säilimise, värske teksti kõrvutuse ja teadliku ülevõtu.

### SOL-SLOG-J-05 — kasutaja andmekoopia jätab kogu Teenuspäeviku töö välja — P1

**Tõend.** `DATA_EXPORT_REGISTRY` kogub ainult profiili/nõusolekud, vestlused, Teekonnad, Tööheaolu, saatja eelpöördumised ning dokumendid/artefaktid; registris pole `ServiceReferral`, `ServiceEntry`, parandusi, narratiive, marsruute, külastusi, mõõtmisproove ega jagamiste saatjavaadet (`lib/dataExport/registry.js:1-178`). Aruandefail võib küll `documents_and_artifacts` kaudu ZIP-i sattuda, kuid tema Teenuspäeviku metaandmeid projektsioon ei väljasta ning alusandmeid see ei asenda. Andmekoopia 6 põhitesti ja üks UI-pariteeditest läbivad, sest ükski ei oota Teenuspäeviku pinda (`tests/dataExport/dataExportService.test.js`). Negatiivkontroll kinnitas kõigi Teenuspäeviku mudelite puudumise registrist.

**Mõju.** Töötaja ei saa enne konto sulgemist kaasa oma suunamisi, arve alusdokumente, paranduste ajalugu, narratiive ega päevateekondi; platvormiklient ei saa oma teenuskirjeid ja kuukinnitusi. Samal ajal võivad samad andmed platvormil 7 aasta klassiga edasi säilida. ZIP-i manifest väidab edukalt täieliku toetatud pindade kogu, kuid Teenuspäevikut seal pole.

**Vastuvõtukriteerium.** Lisada rolli- ja omandipõhised Teenuspäeviku eksportpinnad: töötaja professionaalne kirje/referral/narrative/route/visit/correction ning kliendi minimaalne enda kirje/kinnitus; kolmandate isikute andmed tuleb projitseerida või selgelt põhjendatult välistada. Testida töötajat ja klienti, kahte omanikku, välisklienti, jagatud aruande saatja/saaja vaadet, parandusi, faili metaandmeid ning koopiat vahetult enne konto kustutust.

**Seis.** DONE — andmekoopia registris on nüüd eraldi Teenuspäeviku pind: osutaja saab ainult enda profiili suunamised, kirjed koos parandusahelaga, narratiivid, teekonnad, külastused, ajaproovid ning saadetud/saadud aruande metaandmed; klient saab ainult read, kus tema on klient. Professionaalsest koopiast on kliendi identiteet, täpne asukoht ja failitee eemaldatud ning jagatud aruande sisu asemel väljastatakse metaandmed. Sihttestid katavad töötaja ja kliendi, paranduse, väliskliendi projektsiooni ja jagamise mõlemad vaated. `npm run slog:privacy-retention:probe` tõendas päris PostgreSQL-is kaht omanikku, kliendi kinnitust, saatja/saaja vaadet ja kolmanda isiku andmete mitteläbimist.

### SOL-SLOG-J-06 — konto kustutus ei anonüümi Teenuspäeviku identiteete ja jätab külastustesse toored kasutaja-ID-d — P1

**Tõend.** `ServiceReferral`, `ServiceEntry` ja `ServiceMonthlyNarrative` kannavad teadlikult `clientErasedAt`; kirje kannab lisaks `ownerErasedAt` ja parandaja `actorErasedAt` (`prisma/schema.prisma:5320-5356,5400-5513,5536-5556,5562-5601`). Konto kustutuse kogur ja orkestreerija ei küsi ega uuenda ühtegi Teenuspäeviku tabelit; eraldi käsitletakse ainult Juhtumitöö kliendiviiteid (`lib/privacy/userDeletion.js:17-65,89-158`; `userDeletionOrchestrator.js:1-76`). User FK `SetNull` eemaldab osalt ID, kuid ei määra erased-at välja ega kustuta `clientDisplayName`/`clientExternalRef` snapshot'i. `ServiceWorkRoute.workerUserId` ning `ServiceVisit.ownerUserId` ja `clientUserId` pole üldse User FK-d ega saa User-kustutusel automaatselt nulliks (`prisma/schema.prisma:5703-5728,5736-5844`; `20260803120000_service_day_route/migration.sql`). Negatiivkontroll kinnitas nii Teenuspäeviku cleanup'i puudumise kui nende kolme FK puudumise. `SOL-SLOG-12` katab aruandedokumendi enneaegse kustumise ja `SOL-SLOG-16` jagatud külmutatud koopia cascade'i; kumbki ei kata neid alusandmete identiteedi- ja tombstone-radu.

**Mõju.** Konto kustutanud kliendi nimi/välisviide võib jääda suunamistesse, kirjetele ja narratiividesse ilma markerita, mis eristaks kustutatud klienti aktiivsest väliskliendist. Tööpäev ja külastus võivad säilitada kustutatud kasutaja toore sisemise ID määramata ajaks. Töötaja/parandaja seos kaob osas tabelites vaikse `SetNull`-ina ilma olemasolevate erased-at väljade kasutamiseta, mistõttu retentsioonijälg ei ütle ausalt, et identiteet kustutati.

**Vastuvõtukriteerium.** Konto kustutuse tehing peab enne User-rida idempotentselt töötlema kõik Teenuspäeviku rollid: kliendi snapshot'id minimeerida/anonüümida vastavalt õiguslikule alusele ja seada `clientErasedAt`; omaniku/parandaja seosed nullida koos vastava tombstone'iga; route/visit toored kasutaja-ID-d nullida või muuta tõendatud retentsioonisnapshot'iks. Retry peab olema fail-closed ning tagastama loendurid. Päris FK-test peab kustutama eraldi kliendi, töötaja ja juhi konto ning kontrollima kõiki mudeleid, aruandefaile ja jagatud koopiat enne/pärast retry'd.

**Seis.** DONE — konto lõplik kustutustehing nullib enne `User`-rida kõik Teenuspäeviku kliendi-, omaniku-, parandaja-, route/visit-, ajaproovi- ja aruandejagamise identiteedid, eemaldab kliendi snapshot'id ning kirjutab vastavad tombstone'id; loendurid jõuavad kustutuse auditi tulemusse. Töö on idempotentne ja mudeli- või User-kustutuse tõrge on fail-closed. `npm run slog:privacy-retention:probe` kustutas päris PostgreSQL-is eraldi kliendi, töötaja ja juhi ning kontrollis referral/entry/correction/narrative/route/visit/sample/share lõppseisu ja retry't; süstitud User-delete tõrge tõendas kogu tombstone'i tehingu rollback'i.

### SOL-SLOG-J-07 — seitsmeaastase klassiga Teenuspäeviku andmetel puudub tähtajajärgne retention-worker — P1

**Tõend.** Teenuskirje arvutab `recordedFiscalYear` järgi säilitustähtaja ja lubab omaniku hard-delete'i pärast seda; referral ja narratiiv kannavad ainult stringi `retentionClass:"accounting7y"` (`lib/serviceLog/entries.js:786-825,881-905`; `prisma/schema.prisma:5346-5348,5473-5476,5580-5584`). Üldine `runRetentionCleanup()` töötleb sündmusi, andmekoopiat, kõnesalvestisi, konto-kustutuse retry'sid, vestlusi, dokumente, Välitööd, auditeid ja makseid, kuid mitte ühtegi Teenuspäeviku tabelit ega jagatud aruandefaili (`lib/retention.js:119-430`). Pärast tähtaega kustub kirje ainult siis, kui omanik teab ID-d ja kutsub otsest DELETE-i — J-01 tõttu puudub selleks UI; referral'il, narratiivil, route'il, visit'il ja share'il pole isegi vastavat retention-käsku. Negatiivkontroll kinnitas kõigi Teenuspäeviku mudelite puudumise worker'ist.

**Mõju.** „accounting7y” toimib minimaalse kustutuslukuna, mitte säilituse täislubadusena: tundlikud kliendinimed, märkmed, narratiivid, asukohapunktid, marsruudid ja külmutatud failikoopiad võivad jääda pärast õigusliku/töötluseesmärgi lõppu määramata ajaks. Konto kustutuse puudulik rada ei ole selle asendus.

**Vastuvõtukriteerium.** Defineerida iga Teenuspäeviku objekti retention-ankur ja sõltuvusjärjekord ning lisada batch'itud, idempotentne, auditeeritud sweep koos failide staging/retry/reconcile'iga. Referral/narrative/route/visit/share ei tohi kustuda enne sõltuvat raamatupidamistõendit ega jääda pärast enda lubatud tähtaega. Testida piir-1/piir/piir+1, VOID/FINAL/DRAFT, parandusahel, suunamise lõpp, kasutaja kustutus, puuduva faili/DB vea retry, üle batch-piiri nälgimine ja päris PostgreSQL-i samaaegsus.

**Seis.** DONE — referral, narrative, route ja visit kannavad nüüd domeeniankrust arvutatud indekseeritud `retentionEndsAt` väärtust; ankruhilisem muutus uuendab tähtaega. Üldine auditeeritud retention-worker kustutab batch'itult ja idempotentselt järjekorras kirje/parandusahel → narratiiv → külastus → teekond → suunamine ning eraldi 180 päeva ajaproovid; jagatud aruandefail jääb olemasolevale staging/retry/reconcile rajale. `npm run slog:privacy-retention:probe` läbis päris PostgreSQL-is **16/16**: suunamise lõpu ankru uuendus, piir-1/piir/piir+1, DRAFT/FINAL/VOID, parandusahel, väike batch, kasutaja kustutus ja kaks samaaegset sweep'i. Sihttestid tõendasid lisaks puuduva faili, store→DB, DB→audit, cleanup-retry ja PREPARING-reconcile rajad.

## Testid ja negatiivkontrollid

### Sihttestid

- Esimene jooks: `node --import ./scripts/register-node-test-loader.mjs --test <31 tests/serviceLog/*.test.js faili>` — **192/205 PASS, 13 FAIL**, kestus 21,3 s. Kõik 13 ebaõnnestumist olid käivituskeskkonna `ERR_MODULE_NOT_FOUND` vead puuduva ignoreeritud `generated/prisma/client.ts` tõttu; see jooks ei ole tootmiskoodi regressioonitõend.
- Audit-worktree's käivitati dummy kohaliku URL-iga `npx prisma generate --schema prisma/schema.prisma` — Prisma Client **7.8.0 genereeritud**, `git status` jäi puhtaks.
- Sama Teenuspäeviku täissviidi kordus: **331/331 PASS**, 0 fail/skip/todo, kestus **62,9 s**. `reportArchive` testide best-effort dokumentide audit proovis globaalse Prisma kaudu ühendust ja logis `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`; süstitud teenusetestid jäid roheliseks. See ei ole päris DB-auditi tõend.
- Konto kustutuse ja andmekoopia lisasviit (`dataExportService`, `accountDeletionContent`, `effectivePracticeAccountDeletion`): **19/19 PASS**, kestus **1,20 s**. Roheline kogum ei oota Teenuspäeviku ridu ning seetõttu ei tühista J-05/J-06.
- `npx prisma validate --schema prisma/schema.prisma`: **PASS**, `The schema ... is valid`.

### Auditispetsiifilised negatiivkontrollid

Kõik **12/12 PASS** ehk kontroll tõendas kirjeldatud puuduse olemasolu:

1. suunamise UI ei tee PATCH-i;
2. serveri end-toiming on olemas, UI-s puudub;
3. kirje UI ei tee edit/delete/void toimingut;
4. `listEntryCorrections()` pole ühegi API-route'iga ühendatud;
5. andmekoopia registris pole ühtegi Teenuspäeviku mudelit;
6. konto kustutuse kogur/orkestreerija ei töötle Teenuspäevikut;
7. konto kustutus ei kirjuta Teenuspäeviku tombstone-välju ega puhasta snapshot'e;
8. route/visit kasutaja-ID-del puuduvad User FK-d;
9. üldine retention-worker ei töötle Teenuspäevikut;
10. narratiivi esimene tekstimuutus seab AI-oleku false'iks ja payload'i `draftSource:null`;
11. olemasoleva narratiivi update'il puudub revision/CAS;
12. semantikaproovis võeti kaks stale narratiivisalvestust vastu ja viimane kirjutas esimese üle (`STALE_NARRATIVE_OVERWRITE PASS`).

Need kontrollid on staatilised või süstitud fake-DB semantikaproovid. Need ei asenda päris PostgreSQL-i, brauseri ega väliste teenuste runtime'i.

## Leidude arv

| Prioriteet | Uusi leide |
|---|---:|
| P0 | 0 |
| P1 | 7 |
| P2 | 0 |
| P3 | 0 |
| **Kokku** | **7** |

Kõigi uute leidude seis on `NOT_DONE`; `runtime: not_run`.

## Olemasolevate leidudega kontrollitud kattuvused

- Ametlik Teenuspäeviku seis on **5/24 DONE, 19/24 lahti**. DONE leiud `SOL-SLOG-01`, `13`, `14`, `17` ja `18` kontrolliti fikseeritud koodis ega avatud uue ID-ga.
- Lahtised `SOL-SLOG-02`–`12`, `15`–`16` ja `19`–`24` kontrolliti aktiivses koodis. Neid ei dubleeritud: 4xx outbox, 200 rea väljatõrje, payload'ita idempotentsus, Välitöö päritolu, väliskliendi identiteet, tühi activity allowlist, lifecycle/paranduse võidujooks, vale käsikinnitus, kliendi kuukinnitus, aruande enneaegne kustutus, fail/DB/audit lahknemine, share-cascade, route/visit võidujooksud, topelt arvekirje, sama nimega narratiiv, A→B hiline vastus ja vaiksed mahupiirid jäävad oma seniste ID-de alla.
- `SOL-SLOG-J-01` ei dubleeri `SOL-SLOG-09`: vana leid käsitleb serveris tehtava paranduse paralleelsust; uus tõendab, et päris kasutajal pole parandamise ega ajaloo lugemise tervikteed üldse.
- `SOL-SLOG-J-04` ei dubleeri `SOL-SLOG-23`: vana leid on A kliendi hilise vastuse salvestamine B kliendi alla; uus on sama narratiivi kahe seadusliku muutja last-write-wins ilma revision'ita.
- `SOL-SLOG-J-06` ei dubleeri `SOL-SLOG-12/16`: need katavad vastavalt omaniku aruandedokumendi enneaegse kustutuse ja juhile saadetud külmutatud koopia cascade'i; uus katab alusandmete kliendi/töötaja/parandaja tombstone'id ning route/visit toored ID-d.
- `SOL-COMP-01` katab juba response-only tasulise AI-tulemuse reload/vastuse-kao klassi. Teenuspäeviku AI-mustand commit'ib kasutuse enne response-only teksti tagastamist, kuid sellele ei loodud uut ID-d; see jääb olemasoleva klassi moodulispetsiifiliseks kattuvuseks.
- `SOL-FIELD-J-06/07` failiterviklikkuse ja kvoodi regressioonid on Välitöö attachment'i rajad, mitte Teenuspäeviku enda failikirjutus. Teenuspäeviku aruandefaili/jagamise vastavad probleemid jäävad `SOL-SLOG-12`, `15` ja `16` alla.
- Teiste moodulite andmekoopia puuduvad pinnad ei kata Teenuspäeviku oma andmeid. J-05 sai eraldi moodulispetsiifilise ID, sest vajalik omandi- ja kolmanda isiku projektsioon on erinev.

## Mis jäi Teenuspäevikus tõendamata

- Päris SERVICE_PROVIDER ja CLIENT kontoga ET/EN/RU brauseri kogu rada: offline → online, päeva vorm, suunamine, kuu kinnitamine, narratiiv, eksport, download, juhile saatmine, avamine ja tagasivõtmine.
- Päris PostgreSQL-i finalize/void, parandus, narratiiv, route close/start, visit start, create-entry-from-visit, kliendi kuuekinnituse ja jagamise paralleelsus ning partial unique indeksite tegelik käitumine.
- Päris failisüsteemis aruandearhiivi ja jagatud koopia store/DB/audit veasüst, restart/reconcile, konto kustutuse retry ning tähtajajärgne purge.
- Päris SMTP-d Teenuspäevik ise aktiivses kasutajavoo koodis ei käivita; organisatsiooni audit/outbox'i ja võimalike teavituste tootekäitumine jäi `NOT_PROVEN`.
- Päris in-ADS aadressiotsing, OSRM marsruut, Leafleti kaart, GPS loa eitamine/täpsus mobiilseadmes ja navigatsiooni süvalingid.
- Päris OpenAI genereerimine, võrgu katkemine pärast mudelit, usage commit'i viga ning genereeritud väidete sisuline vastavus alusmärkmetele.
- Teenuspäeviku migratsioonide upgrade olemasolevate pärandandmetega, lock/kestus ja rollback; valideeriti ainult skeemi kuju.
- Retention'i õiguslik eeldus, et majandusaasta võrdub kalendriaastaga, vajab endiselt omaniku/juristi kinnitust.

## Järgmine soovitatud auditiplokk

Kasutaja määratud üheksa põhimooduli staatilised jätkuauditid on nüüd tehtud. Järgmine plokk peaks olema punkt 10: **`PARTIAL`/`NOT_PROVEN` sulgemisaudit**, alustades Tööheaolu autenditud tervikahelast (piloodiskoop, koondid, parandused, eksport, konto kustutus ja päris runtime), seejärel sama tõenditaseme kontroll Organisatsioonide, Minu jagamiste, Teenusekaardi, Dokumentide, Koosta dokumendi ja Välitöö jaoks. Alles pärast seda on mõistlik teha funktsioonideülene lõppkoond.
