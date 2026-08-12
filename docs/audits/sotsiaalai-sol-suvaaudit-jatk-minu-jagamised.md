# SotsiaalAI SOL-süvaaudit — jätk: Minu jagamised

**Auditi seis:** koondvaate ja selle serveripoolsete allikate staatiline süvaaudit `DONE`; runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `c9cefd285e082c70ab7f573c0ab130d578f57a98`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-mat-c9cefd2` (detached HEAD). Audit ei kasutanud põhiprojekti samaaegseid commit'imata parandusi.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Sisenemisteed | DONE | `/minu-jagamised`, profiil, töölaud, continuity-link ja töölauakaart kõigile rollidele |
| React ja olek | DONE | laadimine/retry, üheksa sektsiooni, kinnitused, paranduse privacy prompt, tagasivõtt, leave/revoke ja refresh |
| Koond-API | DONE | sessioon, veaprojektsioon, `loadMySharings()` üheksa päringut, allowlist-serialiseerimine |
| Allikavood | DONE | eelpöördumised, ruumid, kutsed, abi-kuulutused, frameworkid, mentorluse ettevalmistus, võrgustikujagamine ja kiire abi |
| Tegelike jagamisklasside täielikkus | DONE | Prisma jagamismudelid ning omaniku list/recall teenused võrreldi koondregistriga |
| Paginatsioon ja mahupiirid | DONE | kõik `take` piirid ja prioriseerimise järjekord; olemasolevaid PRE/NET leide ei dubleeritud |
| Konto kustutus, andmekoopia ja retention | PARTIAL | allikmudelite FK-käitumine kontrollitud; iga allikavoo poliitikat ei avatud uuesti |
| Päris runtime | NOT_PROVEN | autentitud brauser, PostgreSQL ja mitme allika osaline rike `not_run` |

## Auditeeritud failid ja funktsioonid

- `app/minu-jagamised/page.jsx`, `app/api/my-sharings/route.js`.
- `components/sharings/MySharingsPage.jsx`, `OwnershipBar.jsx`, CSS moodul; kõik nähtavad sektsioonid ja action-handlerid.
- `lib/mySharings.js`: serialiseerijad, `tolerateMissingSchema()`, `loadMySharings()` ning iga Prisma select/where/order/take.
- Allikate serveripiirid: eelpöördumise recall/correction, ruumi leave, kutse revoke, võrgustiku decision, kiire abi recall ja mentorluse preparation recall.
- Võrdluseks `WellbeingSupportShare`, `ServiceReportShare`, `NetworkShare`, `RoomSharedSummary` ja nende omanikuvaated.
- Põhiauditi `SOL-PRE-18`, `SOL-NET-12`, `SOL-SLOG-15`–`16`, `SOL-MENT-03` ning parandusauditi vastavad koondseisud.

## Leiud

### SOL-SHARE-01 — koond jätab välja mitu päris platvormisisest jagamisklassi — P1

**Tõend.** Lehe infotekst lubab: „Siin näed ühes kohas, kellele oled infot jaganud” ja „Loend katab platvormi enda jagamised” (`lib/dashboardInfoContent.js:715-731`). `loadMySharings()` pärib aga ainult `PreInquiry`, `RoomMember`, `Invite`, abi-kuulutused, framework-kinnitused, mentorluse märkmed, `NetworkShare` kliendivaate ja `UrgentRequest` (`lib/mySharings.js:200-387`). Ta ei päri `WellbeingSupportShare` omanikuvaadet ega `ServiceReportShare` omanikuvaadet, kuigi mõlemal on kasutajapõhine list ja tagasivõtt (`lib/org/supportShare.js:255-303,377-406`; `lib/serviceLog/reportShare.js:329-357,455-478`). Võrgustikujagamise päring on ainult `clientUserId=ownerId`; töötaja enda algatatud/sent `workerId` jagamised puuduvad (`lib/mySharings.js:341-364`; `prisma/schema.prisma:5878-5950`). Samal ajal sisaldab koond privaatseid framework-kinnitusi, mis ei ole kellelegi jagatud (`lib/mySharings.js:316-327,415`). Staatiline negatiivkontroll kinnitas kõik kolm puuduvat päringurada.

**Mõju.** Kasutaja privaatsusregister väidab tühjust või osalist ajalugu, kuigi tema Tööheaolu kokkuvõte, kliendiaruanne või töötajana tehtud võrgustikujagamine on teise inimese käsutuses. Ta peab mäletama eri moodulite eraldi lehti, et leida tagasivõtu- või olekuinfo.

**Vastuvõtukriteerium.** Defineerida kanooniline jagamistüüpide register ja lisada kõik platvormisisesed adressaadiga koopiad suuna, saaja, nähtavuse, aluse, saatmis-/avamise-/tagasivõtuaja ja lubatud toiminguga. Privaatne mittejagatud kirje peab olema eraldi kategoorias, mitte täitma jagamisregistrit. Contract-test peab võrdlema registrit Prisma/teenuse jagamismudelite allowlistiga ning kukkuma uue klassi lisamisel.

**Seis.** DONE. Kanooniline `SHARING_TYPE_REGISTRY` seob kõik platvormi jagamismudelid ja suunad nii koondvaate kui andmekoopia adapteritega; `WellbeingSupportShare`, `ServiceReportShare`, töötaja saadetud `NetworkShare` ja ruumi külmutatud kokkuvõtted on omanikuvaates ning framework-kinnitus on selgelt privaatne mittejagamine. Registry-contract ja omaniku projektsioonide sihttestid on rohelised; päris PostgreSQL-i sond tõendas oma toejagamise kaasamise ning võõra rea välistamise.

### SOL-SHARE-02 — ühe allika tavaviga võtab maha kogu jagamiste läbipaistvusvaate — P1

**Tõend.** Kõik üheksa päringut jooksevad ühes `Promise.all()`-is (`lib/mySharings.js:208-387`). Ainult `NetworkShare` ja `UrgentRequest` P2021/P2022 skeemivead talutakse; preInquiry, room, invite, help, framework või mentoring päringu ükskõik milline viga reject'ib kogu funktsiooni (`:131-143`). Route tagastab siis ühe üldise 500 (`app/api/my-sharings/route.js:17-23`) ning React asendab kogu registri veapaneeliga (`components/sharings/MySharingsPage.jsx:79-108,339-349`). Auditispetsiifiline negatiivkontroll süstis ainult `helpRequest.findMany` vea ja kinnitas, et ükski ülejäänud kaheksa edukat loendit vastusesse ei jõua.

**Mõju.** Ühe kõrvalmooduli ajutine DB-/skeemiviga peidab kasutajalt ka kiire abipalve, tagasivõetava eelpöördumise ja otsust ootava jagamise. Just vea ajal kaob kontroll andmete liikumise üle tervikuna.

**Vastuvõtukriteerium.** Koond peab tagastama sektsioonipõhise tulemuse (`items`, `status`, `errorCode`, paging), säilitades edukad andmed; turva- või autoriseerimisvead peavad endiselt fail-closed olema. UI peab selgelt märkima mittelaadunud sektsiooni ning võimaldama selle eraldi retry'd. Negatiivtest peab süstima iga allika 500, timeout'i ja auth-vea ning kontrollima, millal lubatakse osaline vaade ja millal kogu vastus suletakse.

**Seis.** DONE. Iga allikas laetakse eraldi staatuse, veakoodi ja paging-ümbrisega; tavaviga või timeout jätab edukad sektsioonid nähtavaks, kuid 401/403 sulgeb vastuse tervikuna. Dev-brauseris säilisid edukad eelpöördumise ja mentorluse kaardid, vigane abi-sektsioon näitas ausat tõrget ning ainult selle sektsiooni retry taastas andmed teisi kaarte kaotamata.

### SOL-SHARE-03 — puuduva tabeli/veeru korral näidatakse sektsiooni ausa tõrke asemel tühjana — P2

**Tõend.** `tolerateMissingSchema()` muudab `P2021` ja `P2022` vead tühjaks massiiviks; production'is ei logita isegi hoiatust (`lib/mySharings.js:123-143`). Seda rakendatakse võrgustikujagamisele ja kiirele abile (`:341-386`). API vastus ei kanna degraded-, unavailable- ega migration-required olekut ning UI kuvab tavalise „pole kirjeid” teksti. Olemasolevad testid kinnitavad teadlikult just tühja massiivi ja ülejäänud lehe edu (`tests/sharings/mySharings.test.js:367-390,434-445`).

**Mõju.** Migratsioonivea või osaliselt uuendatud keskkonna korral saab kasutaja vale privaatsusväite, et tal pole jagamisi/abipalveid. Operatsiooniline rike jääb kasutaja ja production-observability eest varju.

**Vastuvõtukriteerium.** Skeemi puudumine peab säilitama ülejäänud registri, kuid sektsioon peab olema `NOT_PROVEN/unavailable`, mitte tühi. Production'is peab tekkima struktureeritud alert/metric. Contract-test peab eristama päriselt null rida, P2021, P2022 ja ühendusviga ning UI peab iga seisundi eri tekstiga kuvama.

**Seis.** DONE. P2021/P2022 annab nüüd `UNAVAILABLE`, timeout `TIMEOUT` ja päriselt null rida `READY`; production-logi kannab ainult sektsiooni ja stabiilset veakoodi. Contract-testid eristavad skeemi-, ühendus-, timeout- ja autoriseerimisvigu ning dev-brauser kinnitas eraldi tõrkepaneeli ja sektsioonipõhise taastumise.

### SOL-SHARE-04 — abi-kuulutus märgitakse alati avalikul kaardil nähtavaks — P2

**Tõend.** HelpRequest/HelpOffer päring valib ainult põhirea väljad ega loe seotud `HelpMapEntry.mapVisible` või `status` väärtust (`lib/mySharings.js:278-315`). Serialiseerija ei kanna kaardi seisundit (`:78-87`). UI kuvab iga sellise rea nähtavuseks tingimusteta `my_sharings.ownership.public_map` (`components/sharings/MySharingsPage.jsx:569-574`). Andmemudel lubab `HelpMapEntry.mapVisible=false` ja staatusi `REVIEW/HIDDEN/...` (`prisma/schema.prisma:3275-3311`), seega kinnitatud OPEN/MATCHED põhikirje ei tõenda avalikku kaarti. Negatiivkontroll kinnitas mapEntry projektsiooni puudumise ja tingimusteta avaliku sildi.

**Mõju.** Kasutajale öeldakse, et tema kuulutus on avalik, kuigi see võib olla peidetud või ootel; vastupidise tulevase sünkroonivea korral ei suuda koond tegelikku nähtavust samuti näidata. See muudab privaatsusotsuse kontrollimise ebausaldusväärseks.

**Vastuvõtukriteerium.** Koond peab lugema minimaalse mapEntry projektsiooni ning eristama `public`, `hidden`, `review`, `expired` ja `missing/out_of_sync` seisu. Testida OPEN+hidden, OPEN+review, MATCHED+public, puuduva mapEntry ja aegunud kaardirea kombinatsioonid; UI silt peab vastama serveri tegelikule avalikule projektsioonile.

**Seis.** DONE. Koond kasutab sama puhast avalikkuse klassifikaatorit mis Teenusekaardi tegelik projektsioon ning eristab `PUBLIC`, `HIDDEN`, `REVIEW`, `EXPIRED`, `MISSING` ja `OUT_OF_SYNC` seisu. Kombinatsioonitabeli sihttest ja dev-brauser kinnitasid, et silt tuleneb kaardirea tegelikust olekust; ET/EN/RU üldväited parandati.

### SOL-SHARE-05 — mentorluse tagasivõetav ettevalmistus ei ole koondvaates tagasivõetav — P2

**Tõend.** `serializeMentoringPreparation()` arvutab `canRecall=true`, kui ettevalmistus on jagatud, avamata ja tagasivõtmata (`lib/mySharings.js:90-99`). Mentorluse sektsioon kuvab staatuse ja „Ava suhe” nupu, kuid ei kasuta `item.canRecall`-i ega kutsu mentorluse recall-route'i (`components/sharings/MySharingsPage.jsx:578-620`). Tegelik recall on olemas suhte detailis ja API-s (`components/mentoring/MentoringRelationPage.jsx:539-580`; `app/api/mentoring/relations/[relationId]/preparation/route.js:35-47`). Staatiline negatiivkontroll kinnitas, et serverist koondile antud tegevusluba on UI-s surnud.

**Mõju.** Koond lubab näidata, „mida saad veel kontrollida”, kuid tundliku avamata ettevalmistuse puhul sunnib kasutajat leidma teise mooduli detaili. Kui `relationId` puudub või süvalink ei avane, pole koondist tagasivõtu rada üldse.

**Vastuvõtukriteerium.** Kui `canRecall=true`, peab koond pakkuma kinnitusega recall-toimingut, kasutades sama serveriteenust ja värskendades sektsiooni serverivastusest; kui tegevus peab teadlikult jääma suhte detaili, peab `canRecall` asemel olema toimiv deep link ja selge juhis. Testida avamata, avatud, juba tagasi võetud, puuduva relationId ja stale samaaegse avamise juhud.

**Seis.** DONE. Avamata ettevalmistusel on koondis kinnitusega päris tagasivõtt; puuduva suhteviite korral näidatakse toimingu puudumise põhjust. Avamise ja tagasivõtu advisory-lock'i võistlussond andis mõlemas järjekorras ühe võitja ning koherentse märkme, auditi ja teavituse; dev-brauseris sulges 409 dialoogi, värskendas avatuks muutunud seisu ja eemaldas surnud nupu.

## Testid ja negatiivkontrollid

- `node --import ./scripts/register-node-test-loader.mjs --test tests/sharings/mySharings.test.js tests/preInquiries/trustPackageContracts.test.js tests/workbench/workbenchContract.test.js`: **26/26 passed**, 0 failed.
- Auditispetsiifiline negatiivkontroll: **9/9 kinnitatud** — toe- ja aruandejagamise puudumine, worker-võrgustikujagamise puudumine, help map state puudumine ja vale avalik silt, mentorluse surnud `canRecall`, paging/truncation metadata puudumine, päris share-mudelite olemasolu ning ühe allika vea kogu koondit katkestav käitumine.
- Olemasolevates testides P2021/P2022 degradatsioon: **2/2** juhtumit muudetakse tühjaks sektsiooniks.
- Päris autentitud brauser/PostgreSQL ja ühe allika reaalse katkestuse runtime: **not_run**.

## Kattuvused ja tõendamata osa

- `SOL-PRE-18` juba katab eelpöördumiste 250 rea piiri „Minu jagamistes”; `SOL-NET-12` katab võrgustikujagamiste 100 rea piiri. Koondil puudub tervikuna paging/truncation metadata ja ka teistel allikatel on 20/50/100/250 piirid, kuid sama juurt ei dubleeritud uue leiuna.
- `SOL-SLOG-15`–`16` käsitlevad aruandejagamise terviklikkust/retention'it; siin on uus ainult selle täielik puudumine koondregistrist.
- `SOL-MENT-03` käsitleb mentori lugemisjälge; `SOL-SHARE-05` on omaniku koondvaate tegevusraja puudumine.
- NOT_PROVEN: osalise vastuse soovitud UX päris brauseris, production-schema seis, suurte loendite runtime, konto kustutuse järel koondi semantika ja retention-järgsete ridade kuvamine.

## Leidude kokkuvõte

| Prioriteet | Uusi leide |
|---|---:|
| P0 | 0 |
| P1 | 2 |
| P2 | 3 |
| P3 | 0 |
| **Kokku** | **5** |

**Järgmine soovitatud auditimoodul:** Teenusekaart — esimese süvaploki järel katmata otsingu-, detaili-, kaardi-, adressaadi- ja avaldamisrajad.
