# SotsiaalAI SOL-süvaaudit — jätk: Minu jagamised, lõpetus

**Auditi seis:** koondvaate serveri-, kasutajaliidese-, andmekoopia- ja kontoelutsükli staatiline süvaaudit `DONE`; lokaalne PostgreSQL-i ja anonüümse HTTP runtime `PARTIAL`; autentitud kasutajate runtime `NOT_PROVEN`.

**Fikseeritud audit-commit:** `a4e00e43ea72e6d0e08a09103df804d14123dbb0`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-shares-a4e00e4` (detached HEAD). Põhiprojekti samaaegseid commit'imata PWA-, test- ega auditiskripti muudatusi ei kasutatud tõendina.

## Katvustabel enne lõpetusleide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Sisenemisteed ja koondleht | DONE | `/minu-jagamised`, profiili- ja töölaualingid, laadimine, retry, teated ja kõik nähtavad sektsioonid |
| Reacti toimingud ja olek | DONE | võrgustikujagamise otsus, kiire abi ja eelpöördumise tagasivõtt, parandus, ruumist lahkumine, kutse tühistamine ning refresh'i osaline viga |
| API ja autoriseerimine | DONE | `GET /api/my-sharings`, sessioonivärav, veaprojektsioon ning allikate owner-skoop |
| Koondäriloogika | DONE | kõik serialiseerijad, üheksa paralleelpäringut, minimaalsed projektsioonid, olekud, tegevuslipud ja skeemidegradatsioon |
| Jagamisklasside täielikkus | DONE | `PreInquiry`, `RoomMember`, `Invite`, abi-kuulutused, mentorluse ettevalmistus, `NetworkShare`, `UrgentRequest`, `WellbeingSupportShare`, `ServiceReportShare` ja `RoomSharedSummary` |
| Paginatsioon ja mahupiirid | DONE | kõik `take` piirid, kärpeinfo puudumine ning olemasolevate `SOL-PRE-18` ja `SOL-NET-12` kattuvus |
| Andmekoopia | DONE | kuus ekspordiregistri pinda, nende owner-filtrid/projektsioonid ja üheksa jagamisallika puudumine |
| Konto kustutus ja retention | DONE | jagamismudelite FK-käitumine, lõppkustutuse tehing ning toe-snapshot'i kolm vanemkustutust päris PostgreSQL-is |
| Päris runtime | PARTIAL | värske 151 migratsiooniga PostgreSQL ja anonüümne HTTP läbitud; autentitud mitme kasutaja brauserivoog `NOT_PROVEN` |

## Auditeeritud failid ja funktsioonid

- `app/minu-jagamised/page.jsx`, `app/api/my-sharings/route.js`; lehe sisenemine ja `GET`-route'i sessioonivärav.
- `components/sharings/MySharingsPage.jsx`, `OwnershipBar.jsx`, `MySharingsPage.module.css`; `loadSharings()`, kõik action-handlerid, kinnitused, säilitatud vaade refresh'i vea ajal ja üheksa sektsiooni renderdus.
- `lib/mySharings.js`; kõik serialiseerijad, `tolerateMissingSchema()` ja `loadMySharings()` üheksa allikapäringut.
- Allikate serverirajad: eelpöördumise recall/correction, ruumi leave, kutse revoke, võrgustikujagamise decision/recall, kiire abi recall ning mentorluse ettevalmistuse recall.
- `lib/dataExport/registry.js`, `lib/dataExport/service.js`; registri kuus pinda, `collectExportEntries()`, worker, manifest, allalaadimine ja seitsmepäevane ZIP-retention.
- `lib/privacy/userDeletion.js`, `lib/privacy/userDeletionOrchestrator.js`, `lib/privacy/effectivePracticeAccountCleanup.js`; sihtide kogumine, retry ja `deleteUserAfterFinalPracticeSweep()`.
- `lib/org/supportShare.js`, `lib/serviceLog/reportShare.js`, `lib/network/share.js`, `lib/mentoring/preparationService.js`, ruumi-, abi- ja kiire abi teenused omanikuvaate ning elutsükli võrdluseks.
- Prisma mudelid ja migratsioonid: `RoomMember`, `Invite`, `RoomSharedSummary`, `HelpRequest`, `HelpOffer`, `FrameworkAcceptance`, `MentoringPrivateNote`, `NetworkShare`, `UrgentRequest`, `WellbeingSupportShare`, `ServiceReportShare`, `Organization` ja `OrganizationMembership`.

## Eelmise ploki ametlik seis

Fikseeritud koodis ei ole eelmise auditi commit'ist `c9cefd285e082c70ab7f573c0ab130d578f57a98` kuni käesoleva commit'ini `lib/mySharings.js`, koond-API ega Reacti koondvaade sisuliselt muutunud. Põhiauditist ja `parandusaudit.md`-st kontrolliti enne uute ID-de lisamist kattuvusi; parandusauditi koondseis on endiselt `SOL-SHARE 0/5`.

| Leid | Seis fikseeritud koodis |
|---|---|
| `SOL-SHARE-01` — koond jätab välja päris jagamisklasse | NOT_DONE |
| `SOL-SHARE-02` — ühe allika viga võtab maha kogu koondi | NOT_DONE |
| `SOL-SHARE-03` — P2021/P2022 muutub eksitavalt tühjaks sektsiooniks | NOT_DONE |
| `SOL-SHARE-04` — abi-kuulutus märgitakse alati avalikuks | NOT_DONE |
| `SOL-SHARE-05` — mentorluse `canRecall` on koondis kasutamata | NOT_DONE |

Neid leide ei dubleeritud. Täielik tõend ja vastuvõtukriteerium on failis `docs/audits/sotsiaalai-sol-suvaaudit-jatk-minu-jagamised.md`.

## Uued lõpetusleiud

### SOL-SHARE-06 — isikuandmete koopia jätab jagamisregistri ja selle saajaajaloo välja — P1

**Tõend.** „Minu jagamised” lubab näidata ühes kohas, kellele kasutaja infot jagas, millal see juhtus ja mida ta veel kontrollida saab (`lib/dashboardInfoContent.js:715-741`). Andmekoopia `DATA_EXPORT_REGISTRY` sisaldab ainult profiili/nõusolekuid, vestlusi, Teekondi, Tööheaolu kirjeid, saatja eelpöördumisi ning dokumente/artefakte (`lib/dataExport/registry.js:104-178`). Ta ei päri `RoomMember`, `Invite`, `HelpRequest`, `HelpOffer`, `MentoringPrivateNote`, `NetworkShare`, `UrgentRequest`, `WellbeingSupportShare` ega `ServiceReportShare` ridu. Auditispetsiifiline fake-DB negatiivkontroll andis kõigile üheksale mudelile eristatava jagamissündmuse: eksport ei kutsunud ühtegi neist, kuus registry-pinda valmisid edukalt ja ükski sentinel ei jõudnud koopiasse. Eelpöördumine ning framework-nõusolek on olemas teistes pindades, kuid koopia ei sisalda ülejäänud koondis nähtavat jagamis-/liikmesus-/kutseajalugu, saajaid, saatmise/avamise/tagasivõtu aegu ega suunda.

**Mõju.** Kasutaja võib saada eduka „andmekoopia” ja seejärel konto kustutada, kuigi tal puudub masinloetav tõend suure osa tema andmete liikumisest, saajatest ja kehtivatest tagasivõtuvõimalustest. Osa ridu kaskaadib konto kustutamisel kohe ning osa jääb teise osapoole töövoogu, mistõttu hiljem ei saa koopiat sama seisuga taastada.

**Vastuvõtukriteerium.** Kanooniline jagamistüüpide register peab toitma nii „Minu jagamisi” kui versioonitud owner-skoobitud andmekoopia pinda. Eksport peab sisaldama vähemalt tüüpi, suunda, adressaadi minimaalset identifikaatorit/snapshot'i, olekut, saatmise, avamise, tagasivõtu ja kehtivuse aegu ning päritolu ilma kolmanda isiku privaatse sisuta. Negatiivtest peab looma kõik jagamisklassid kahele omanikule, tõendama ainult oma registri kaasamise, võõra sisu puudumise ja koopia valmimise vahetult enne konto kustutust.

**Seis.** NOT_DONE; runtime `PARTIAL` (registry käitumine käivitati fake-DB-ga, production-andmekoopia worker `NOT_PROVEN`).

### SOL-SHARE-07 — toe külmutatud jagamiskoopia kaob omaniku, saajaliikmesuse või organisatsiooni kustutamisel — P1

**Tõend.** `WellbeingSupportShare` on külmutatud `sharedSnapshotJson`-iga jagamisfakt, millel on saatmise, avamise, tagasivõtu, parandamise ja sulgemise ajad (`prisma/schema.prisma:5238-5273`). Kõik kolm vanemseost — omanik `User`, `Organization` ja saaja `OrganizationMembership` — kasutavad `onDelete: Cascade` (`:5263-5266`). Konto lõppkustutus puhastab eelpöördumisi, kiire abi ja SOLO-teenuseprofiile ning kustutab seejärel User-rea, kuid `WellbeingSupportShare` jaoks ei ole anonümiseerimist, retentsiooniarhiivi ega deletion-job'i (`lib/privacy/effectivePracticeAccountCleanup.js:79-176`). Värskel eraldatud PostgreSQL-il rakendati 151/151 migratsiooni. Täisfunktsioon `deleteUserAfterFinalPracticeSweep()` kustutas omaniku (`ownerCount=0`) ning toe-snapshot'i (`supportShareCount=0`), kuigi saaja liikmesus jäi alles (`recipientMembershipCount=1`). Eraldi kontrollides kustutas nii saajaliikmesuse kui organisatsiooni kustutamine jagamisrea (`supportShareCount=0`), jättes omaniku alles (`ownerCount=1`).

**Mõju.** Ühe osapoole konto- või organisatsioonihalduse tehniline kustutus eemaldab teisele osapoolele juba saadetud toeavalduse külmutatud koopia ja kogu saatmise/avamise/tagasivõtu tõendi. Saaja tööjärg võib kaduda ilma sisulise sulgemise või retention-otsuseta ning hilisem audit ei erista „ei jagatud” ja „jagati, kuid vanemobjekt kustutati”.

**Vastuvõtukriteerium.** Jagatud toe-snapshot'i elutsükkel tuleb eraldada kasutaja-, liikmesus- ja organisatsioonirea tehnilisest elutsüklist: kasutada otsustatud retention'i piires `SetNull`/erased-at identiteedisnapshot'i või eraldi retentsiooniarhiivi. Konto kustutuse ja organisatsiooni offboard/delete rajad peavad säilitama või nõuetekohaselt puhastama nii sisu kui sisuvaba tõendi ühe dokumenteeritud poliitika järgi. Päris PostgreSQL-i integratsioonitest peab katma omaniku, saajaliikmesuse ja organisatsiooni kustutuse, parandusahela, juba tagasi võetud rea ning deletion-job'i retry; üheski harus ei tohi toimuda vaikset jälje kadu.

**Seis.** NOT_DONE; runtime `PARTIAL` (kolm vanemkustutust tõendatud lokaalsel PostgreSQL-il, production retention ja retry `NOT_PROVEN`).

## Testide täpsed tulemused

- `node --import ./scripts/register-node-test-loader.mjs --test tests/sharings/mySharings.test.js tests/preInquiries/trustPackageContracts.test.js tests/workbench/workbenchContract.test.js tests/dataExport/dataExportService.test.js tests/effectivePractices/effectivePracticeAccountDeletion.test.js tests/org/supportShareProjection.test.js tests/serviceLog/reportShare.test.js tests/network/share.test.js`: **97/97 PASS**, 0 fail, 0 skipped, Node'i kogukestus **1905.4333 ms**.
- `npx prisma validate`: **PASS**, skeem kehtiv.
- Eraldatud PostgreSQL `prisma migrate deploy`: **151/151 migratsiooni rakendatud**, 0 migratsiooniviga.
- Esimene sünteetilise `ACTIVE` organisatsiooni fixture lükati oodatult tagasi DB kontrolliga `Organization_active_requires_verification_chk`, sest fixture'il puudus verifitseerimine. Seda ei loetud tootetesti tulemuseks; parandatud `DRAFT` fixture'il tehti allpool kirjeldatud kolm elutsüklitesti.
- Webpack-dev serveri `GET /api/my-sharings` ilma sessioonita: **401**, `messageKey="api.common.unauthorized"`.
- Turbopack-dev ei käivitunud audit-worktree välise `node_modules` junction'i tõttu (`Symlink ... points out of the filesystem root`); see on auditikeskkonna piirang, mitte tootmisleid. Sama route käivitati Webpackiga edukalt.

## Negatiivkontrollide tulemused

- Koondvaate staatilised ja semantilised negatiivkontrollid: **10/10 kinnitatud** — toe- ja aruandejagamise puudumine, worker-suunalise `NetworkShare` puudumine, help-map oleku puudumine ja tingimusteta avalik silt, mentorluse toodetud kuid kasutamata `canRecall`, ühe `Promise.all`-i fail-fast, paging/truncation metadata puudumine ning ainult `HelpRequest` vea tõttu kogu koondi rejection. Vea süstimisel käivitusid kõik üheksa allikapäringut, kuid vastust ei tekkinud.
- Andmekoopia negatiivkontroll: **9/9 mudelit välja jäetud**; mudelipäringuid **0**, registry-pindu **6**.
- PostgreSQL-i toe-snapshot'i elutsükkel: **3/3 puudust taasesitatud** — omaniku konto kustutus, saajaliikmesuse kustutus ja organisatsiooni kustutus eemaldasid jagamisrea.
- Olemasolevates sihttestides P2021 degradatsioon: **2/2** juhtumit muutuvad tühjaks sektsiooniks; see kinnitab `SOL-SHARE-03`, mitte selle parandust.
- Anonüümne HTTP autoriseerimisnegatiivkontroll: **1/1 PASS**, 401.

## Olemasolevate leidudega kontrollitud kattuvused

- `SOL-PRE-18` katab eelpöördumiste 250 rea piiri ja `SOL-NET-12` `NetworkShare` 100 rea piiri. Neid ei dubleeritud.
- `SOL-SLOG-15`–`16` katavad aruandejagamise fail/DB terviklikkuse ja `ServiceReportShare` kaskaadi. `SOL-SHARE-07` käsitleb eraldi `WellbeingSupportShare` snapshot'i ning seda ei laiendatud aruandefailile.
- `SOL-WB-18` katab Tööheaolu mustandite ja kirjete puudumise andmekoopiast. `SOL-SHARE-06` ei korda nende toorsisu, vaid katab funktsioonideülese jagamisregistri saaja- ja elutsükliandmed.
- `SOL-MENT-03` käsitleb mentori lugemisjälge; `SOL-SHARE-05` jääb omaniku koondvaate tegevusraja puudumiseks.
- Sama auditiseansi Organisatsioonide lõpetusleid `SOL-ORG-19` katab organisatsiooniliikmesuse, capability- ja kohajaloo puudumise isikuandmete koopiast. `SOL-SHARE-06` ei loe organisatsioonihaldust uuesti, vaid käsitleb platvormi jagamissündmuste ühist registrit.
- `SOL-SHARE-01` hõlmab `WellbeingSupportShare` puudumist koondvaatest; `SOL-SHARE-07` on eraldi konto-/organisatsioonielutsükli andmekao rada, mis esineb ka siis, kui koondvaate täielikkus parandada.

## Leidude kokkuvõte

| Prioriteet | Varasemad avatud | Uued | Kokku avatud |
|---|---:|---:|---:|
| P0 | 0 | 0 | 0 |
| P1 | 2 | 2 | 4 |
| P2 | 3 | 0 | 3 |
| P3 | 0 | 0 | 0 |
| **Kokku** | **5** | **2** | **7** |

## Mis jäi tõendamata

- Kahe või enama autentitud sünteetilise kasutaja brauserivoog: kõik sektsioonid korraga, tegelik tagasivõtt/otsus/leave/revoke ning pärast toimingut värskendatud serveriseis.
- Production-andmebaasi migratsiooniseis, suured päris loendid ja sektsioonipõhise tõrke kasutajakogemus. Production-andmeid ei kasutatud.
- Päris andmekoopia workeri ZIP, milles on sama kasutaja eri jagamisklassid; staatiline/fake-DB tõend kinnitab praeguse registri väljajätu, mitte production-job'i käitamist.
- Konto kustutuse orkestreerija `FAILED` → retry tervikahel toe-snapshot'i, teavituse ja auditikirjutuse osalise vea ajal. Praeguses koodis ei ole share-spetsiifilist retry-sammu, kuid production workerit ei käivitatud.
- Jagatud ridade õiguslik retention-tähtaeg, adressaadi andmekoopia ja see, milline minimaalne sisuvaba audit peab pärast mõlema poole konto kustutust säilima.

**Runtime'i koondseis:** `PARTIAL`; autentitud runtime `NOT_PROVEN`.

**Järgmine soovitatud auditimoodul:** Teenusekaart — lõpetada esimese süvaploki järel katmata otsingu-, detaili-, kaardi-, adressaadi- ja avaldamisrajad.
