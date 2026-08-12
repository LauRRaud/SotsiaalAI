# SotsiaalAI SOL-süvaaudit — jätk: Organisatsioonide lõpetus

**Auditi seis:** organisatsioonide lehed, toimingud ja serveripoolsed tervikahelad staatiliselt `DONE`; konto-kustutuse ja andmekoopia sihitud PostgreSQL-runtime `DONE`; anonüümne HTTP-piir `DONE`; autentitud mitme kasutaja brauseriruntime `NOT_PROVEN`; `runtime: PARTIAL`.

**Fikseeritud audit-commit:** `a4e00e43ea72e6d0e08a09103df804d14123dbb0`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-orgclose-a4e00e4` (detached HEAD). Põhiprojekt oli auditi alguses puhas ja selle `HEAD` oli sama täielik hash. Liikuvat põhitööpuud, teise akna commit'imata parandusi ega vana `SotsiaalAI-sol-audit-cfa62ea` koopiat tõendina ei kasutatud.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Avaleht, tööruumivahetus ja loomine | DONE | `/org`, kutsed, loomise UI/POST, feature-gate, roll ja tellimuskontekst |
| Struktuur, liikmed, õigused, kutsed ja arveldus | DONE | üksused, membership, capability, seat, sponsorship, seadistus ja elutsükkel |
| Vastuvõtt ja töö määramine | DONE | loend/detail, assignment, respond, handover, recall/close ja tenant-skoop |
| Tugi ja toeavaldused | DONE | kontaktid, juhiseosed, saatmine, avamine, tagasivõtmine, parandus, sulgemine ja teavituse piir |
| Teenuspäeviku aruannete saajavaade | DONE | loend, eelvaade, CSV/PDF allalaadimine, avamisfakt ja faili/DB järjekord |
| Audit, organisatsiooni eksport ja isiku andmekoopia | DONE | capability, projektsioon, mahupiirid, manifest ning kasutaja GDPR-koopia register |
| Konto kustutus ja retention | DONE | membership/capability/seat/work FK-d, viimane omanik, ajalooline töö, report/support cascade ja retry tagajärg |
| Teenuseprofiil | PARTIAL | organisatsiooni omand, adressaat ja editor kontrollitud; avalik otsing/kaart/avaldamine jääb Teenusekaardi plokki |
| Autenditud kohalik runtime | NOT_PROVEN | jagatud sünteetilised kontod on olemas, kuid 0/5 dokumenteeritud credential'ist vastas salvestatud räsile |

## Auditeeritud failid ja funktsioonid

- `app/org/**`, `components/org/**`, `app/api/org/**`: kõik organisatsiooni lehed, navigeerimine, loomine, struktuur, liikmed, kutsed, rahastus, vastuvõtt, tugi, aruanded, audit ja eksport.
- `lib/org/accessContext.js`, `organizations.js`, `structure.js`, `units.js`, `members.js`, `inviteService.js`, `seats.js`, `sponsorship.js`, `inbox.js`, `support.js`, `supportShare.js`, `audit.js`, `export.js`, `serviceProfile.js`.
- `lib/serviceLog/reportShare.js`, `app/api/org/[orgId]/aruanded/**`, `components/org/OrgServiceReportsClient.jsx`: saaja loend, avamine, faili väljastus ja avamisjälg.
- `lib/privacy/effectivePracticeAccountCleanup.js`, `lib/privacy/userDeletion.js`, `lib/privacy/userDeletionOrchestrator.js`: konto kustutuse lõpptehing, retry ja organisatsiooniseoste tegelik mõju.
- `lib/dataExport/registry.js`, `lib/dataExport/service.js`: inimese andmekoopia pinnaregister, manifest ja ZIP-i sisu.
- `prisma/schema.prisma:4697-5269,5657-5659` ning organisatsiooni-, toe- ja aruandejagamise migratsioonid; eraldi kontrolliti `OrganizationMembership.user` Cascade'i ja `OrganizationWorkAssignment.assignee` Restrict'i.
- `tests/org/**`, `tests/serviceLog/reportShare.test.js`, `tests/serviceLog/reportArchive.test.js`, `tests/dataExport/dataExportService.test.js`, `tests/privacy/accountDeletionContent.test.js`, `tests/usage/privacyDeletionIntegration.test.js`.

## Kattuvuskontroll

- Põhiauditi `SOL-ORG-01`–`SOL-ORG-12` kõigi leidude `Seis` on 10.08.2026 kuupäevaga DONE; aktiivne kood ja nende nimetatud testid/proobiskriptid on olemas. Neid ei lisatud uute ID-dega.
- Varasema jätkuauditi `SOL-ORG-13`–`SOL-ORG-17` kontrolliti aktiivse koodi vastu. Võrdlus varasema audit-commit'iga `c9cefd285e082c70ab7f573c0ab130d578f57a98` ei näidanud organisatsiooni tootmiskoodis ühtki muudatust; kõik viis leidu on endiselt `NOT_DONE`.
- `parandusaudit.md` koondrida `Organisatsioonid ja skoop | SOL-ORG | 12/17` vastab sellele seisule.
- Uus `SOL-ORG-18` on konto-kustutuse rajal eraldi regressioon/teine uks DONE-leidude `SOL-ORG-10` ja `SOL-ORG-11` invariantidesse. See ei muuda nende olemasolevaid `Seis`-lõike.
- `SOL-SLOG-16` katab teenuspäeviku külmutatud aruande kaskaadse kadumise; seda `SOL-ORG-18` all uuesti ei raporteerita.
- `SOL-ORG-19` ei dubleeri `SOL-ORG-13`: viimane käsitleb ORG_OWNER-i organisatsioonieksporti ja auditikärbet, uus leid kasutaja enda GDPR-andmekoopiat.

## Uued leiud

### SOL-ORG-18 — konto kustutus kas jätab organisatsiooni omanikuta või ebaõnnestub ajaloolise töö tõttu — P1

**Tõend.** Tavapärane `endMembership()` lukustab organisatsiooni ja liikmesuse, keelab viimase `ORG_OWNER` lahkumise, blokeerib elava töö, lõpetab kohad/õigused/üksuseseosed ning kirjutab auditi (`lib/org/members.js:450-528`). Konto kustutuse lõpptehing lukustab ainult User-rea, teeb muud privaatsuspuhastused ja kutsub otse `tx.user.delete()`; organisatsiooni offboardingut, omaniku kontrolli ega auditit selles ahelas pole (`lib/privacy/effectivePracticeAccountCleanup.js:144-148,225-283`). `OrganizationMembership.user` on `onDelete: Cascade`, kuid kõik `OrganizationWorkAssignment.assignee` seosed — ka `ENDED` ajalugu — on `onDelete: Restrict` (`prisma/schema.prisma:4800-4823,5071-5095`; migratsioonid `20260801000000...:285` ja `20260801120000...:239`).

Värske lokaalne PostgreSQL-proov rakendas kõik 151 migratsiooni ja kutsus päris `deleteUserAfterFinalPracticeSweep()` teenust kahes olukorras. Viimase omaniku puhul ilma tööajaloota oli lõppseis `userCount=0`, `organizationCount=1`, `membershipCount=0`, `activeOwnerCount=0`: kustutus möödus DONE `SOL-ORG-11` kaitsest. Teisel kasutajal oli üks lõpetatud (`ENDED`) töömääramine; kustutus tagastas Prisma `P2003` piirangu `OrganizationWorkAssignment_assigneeMembershipId_fkey` tõttu ning tehing keriti tagasi (`userCount=1`, `membershipCount=1`, `assignmentCount=1`).

**Mõju.** Sama konto-kustutuse soov annab kasutaja ajaloost sõltuvalt kaks vastandlikku katkist tulemust: organisatsioon võib jääda ilma ühegi aktiivse omanikuta ja tavahalduseta või kustutus/retry võib jääda tähtajatult ebaõnnestuma ka ammu lõpetatud töö tõttu. Mõlemad mööduvad auditeeritud offboardingust; liikmesuse kaskaad võib lisaks kustutada koha-, õiguse-, toe- ja aruandeseoseid, mille eraldi retentsiooniprobleemi katab osaliselt `SOL-SLOG-16`.

**Vastuvõtukriteerium.** Konto kustutus peab enne User-rea eemaldamist läbima iga organisatsiooni kohta sama lukuprotokolli ja offboardingulepingu: viimane omanik peab andma omandi kontrollitud järeltulijale või kustutus peab selge parandatava seisuga peatuma; elav töö tuleb teadlikult üle anda; kohad ja aktiivsed õigused lõpetada ning append-only audit kirjutada põhitehingus. Ajalooline lõpetatud töö ei tohi kustutust FK-ga blokeerida: kasutada säilivat liikmesuse/tegija tombstone'i, SetNull-snapshot'i või muud dokumenteeritud retentsioonimudelit. Retry peab olema idempotentne. Päris PostgreSQL-testid peavad katma viimase omaniku, kahe omaniku, elava ja lõpetatud töö, aktiivse koha, report/support seosed ning delete-vs-assign/offboard võistluse.

**Seis.** NOT_DONE; runtime: PostgreSQL reproduced.

### SOL-ORG-19 — kasutaja andmekoopia jätab organisatsiooniliikmesuse, õigused ja kohaajaloo välja — P2

**Tõend.** Isikuandmete ekspordi kinnine register sisaldab ainult kuut pinda: profiil/nõusolekud, vestlused, teekonnad, tööheaolukirjed, eelpöördumised ning dokumendid/artefaktid (`lib/dataExport/registry.js:104-179`). Seal pole ühtki `organizationMembership`, capability, membership-unit, seat-assignment, kutse või sponsorship päringut. Organisatsiooni eraldi eksport ei asenda inimese koopiat: seda saab käivitada ainult `ORG_OWNER` ja see koondab kogu organisatsiooni, mitte kasutaja isikuandmeid (`app/api/org/[orgId]/eksport/route.js:14-27`).

Värske PostgreSQL-proovi kasutajal oli aktiivne organisatsiooniliikmesus, `ORG_OWNER` grant ja lõpetatud töömääramine. Päris `collectExportEntries()` koostas failid `manifest.json`, `profile.json`, `conversations.ndjson`, `journeys.ndjson`, `wellbeing-records.ndjson`, `pre-inquiries.ndjson`, `documents.json`; manifestis olid samad kuus pinda ja kasutaja membership ID puudus baitidest. Staatiline kontroll kinnitas samuti `ORGANIZATION_MEMBERSHIP_SURFACE=MISSING`.

**Mõju.** Kasutaja ei saa oma andmekoopiast tõendada, millistes organisatsioonides, rollis ja ajavahemikus ta oli, millised õigused või üksused talle anti/tühistati ega milline organisatsioon tema kohta tasulist kohta hoidis. Konto kustutuse järel kaskaadib osa neist ridadest ära, mistõttu hilisem koopia ei saa puuduvat ajalugu taastada.

**Vastuvõtukriteerium.** Isikuandmete registry peab lisama omaniku allowlist-projektsiooni: minimaalse organisatsiooniviite/nime, membership staatuse, seatRole/jobTitle ja ajad, kasutaja enda üksuseseosed, capability grantide kehtivus/tühistamine ning seat-assignment'i elutsükkel; teiste liikmete andmed ja organisatsiooni privaatne töövara tuleb välistada. Test peab kasutama kahte kasutajat kahes organisatsioonis, aktiivset ja lõppenud liikmesust, revokitud õigust ning lõppenud kohta, võrdlema koopiat DB omanikuvaatega ja tõendama võõraste andmete puudumise.

**Seis.** NOT_DONE; runtime: PostgreSQL export reproduced.

## Testide täpsed tulemused

1. `node --import ./scripts/register-node-test-loader.mjs --test tests/org/*.test.js` — **165/165 passed**, 0 failed/skipped/todo; kestus 1615,74 ms.
2. Laiendatud organisatsiooni-, aruande-, andmekoopia- ja konto-kustutuse komplekt — **197/197 passed**, 0 failed/skipped/todo; kestus 62 247,22 ms. `reportArchive` testide best-effort globaalse auditi ühendushoiatused jäid stdout'i, kuid testid süstisid oma DB ja jooks lõppes 0-ga; neid ei kasutatud PostgreSQL-tõendina.
3. `prisma validate` — **PASS**, skeem valid.
4. Värskes isoleeritud andmebaasis `prisma migrate deploy` — **151/151 migratsiooni rakendati edukalt**.

Rohelised testid ei kata `SOL-ORG-18` ega `SOL-ORG-19` negatiivjuhte: olemasolev konto-kustutuse testikomplekt ei loo organisatsiooniliikmesust ja andmekoopia test kinnitab ainult registris juba olevaid pindu.

## Negatiivkontrollid ja runtime

- Staatilised jätkuleidude kontrollid: **10/10 PASS** — audit 100/200, ekspordi 200 auditirida ilma truncation'ita, inbox 200 ilma cursorita, toe 200/100, aruanded 200, loomise idempotentsuse ja rate-limit'i puudumine, faili avamisfakt enne faili lugemist ning UI enneaegne `markOpened`.
- Toeolekumasina in-memory negatiivkontroll: **2/2 riskirada reprodutseerus** — `RECALLED → CLOSED` ja `CLOSED → OPENED`.
- Fikseeritud koopia käivitus eraldi `localhost:3003` aadressil: Next.js 16.2.10, webpack, Ready 763 ms.
- Anonüümsed GET/POST kontrollid `/api/org`, audit, inbox, toeavaldused ja aruanded: **7/7 HTTP 401**; autentimisvärav rakendus enne organisatsiooni olemasolu või payload'i avaldamist.
- Jagatud sünteetiliste kontode read-only kontroll: kõik viis kontot, oodatud rollid ja aktiivsed tellimused olid olemas, kuid **0/5 credential'i oli kehtiv**. Kontode taastamist ega aktiivsete seansside kustutamist ei tehtud.
- PostgreSQL konto-kustutuse sond: **2/2 katkist lõppseisu reprodutseerus** — viimane omanik kadus ja ajalooline töö blokeeris kustutuse `P2003`-ga.
- PostgreSQL andmekoopia kontroll: **membership puudus 7/7 loodud failist** ja kuuest manifestipinnast.
- Auditiserver peatati. Täpselt nimetatud sünteetiline prooviandmebaas `sotsiaalai_audit_orgdelete_a4e00e4` eemaldati pärast kontrolle; seal polnud päris ega jagatud arendusandmeid.

**Runtime'i lõppseis:** anonüümne auth-piir ja kaks uut PostgreSQL-i negatiivjuhtu `DONE`; autentitud mitme kasutaja UI, notification delivery ning varasemate viie leiu võistlus-/failiruntime `NOT_PROVEN`; `runtime: PARTIAL`.

## Leidude koondseis

| Allikas | P0 | P1 | P2 | P3 | Kokku |
|---|---:|---:|---:|---:|---:|
| Põhiaudit `SOL-ORG-01`–`12` — DONE | 0 | 0 | 0 | 0 | 0 avatud |
| Varasem jätkuaudit `SOL-ORG-13`–`17` | 0 | 2 | 3 | 0 | 5 |
| Käesolev lõpetus `SOL-ORG-18`–`19` | 0 | 1 | 1 | 0 | 2 |
| **Kokku aktiivselt avatud** | **0** | **3** | **4** | **0** | **7** |

## Mis jäi Organisatsioonides tõendamata

- autentitud kahe kasutaja ja kahe organisatsiooni brauserivaated, tegelik navigeerimine ja capability-põhine nähtavus;
- varasemate `SOL-ORG-13`–`17` päris mahu-, paralleelsus-, failivea- ja rate-limit runtime;
- notification event'i tegelik tarne, retry ja SMTP/kanaliviga;
- puuduva/rikutud aruandefaili ning katkestatud stream'i avamisfakti lõpptulemus;
- organisatsiooniliikmesuse, grantide, kohtade ja auditite õiguslik/äriline retention-tähtaeg; koodis pole ühtset poliitikat;
- tootmisandmebaasi migratsiooniseis ja päris kasutajad — tootmisandmeid ei kasutatud.

## Järgmine auditiplokk

**Minu jagamised** — kogu koondvaade, selle allikatevaheline olekuleping, paginatsioon, omanikunähtavus, tagasivõtmine/parandus, andmekoopia ja konto-kustutuse mõju.
