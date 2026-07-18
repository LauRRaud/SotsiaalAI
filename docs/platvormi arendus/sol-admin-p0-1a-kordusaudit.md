# ADMIN-P0.1a sõltumatu tehniline kordusaudit

## Kokkuvõte ja otsus

**Lõppotsus: PASS.** ADMIN-P0.1a järelparandused M1, M2 ja V1 täidavad auditeeritud commiti piires nõuded. P0–P2 leide ei ole. Audit tuvastas ühe mitteblokeeriva P3 töökindlusmärkuse: kui protsess või auditirea lõppuuendus katkeb pärast reserveerimist, jääb ainus auditirida olekusse `started`. Token jääb siiski püsivalt kasutatuks, korduskatse saab 409 ning uut kirja ei saadeta; seega katkestus ei ava duplikaatsaatmise võimalust.

ADMIN-P0.1 ja ADMIN-P0.1a tervik on **integratsioonivalmis**, kuid käesoleva auditi käigus seda ei integreeritud.

## Auditi identiteet ja piir

- Auditeeritud teostusharu: `codex/admin-p0-1a-audit-followups`
- Auditeeritud commit: `5357147e1d1922bffdee333ccd748d842941d2cc`
- Otsene parent: `7d1cc4e8dcbf82c1c27043d5e67cf5636ad780a3`
- Kontrollitud vahemik: `7d1cc4e8dcbf82c1c27043d5e67cf5636ad780a3..5357147e1d1922bffdee333ccd748d842941d2cc`
- Kontrollimise ajal kinnitatud `origin/main`: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c`
- Sõltumatu auditiharu: `codex/admin-p0-1a-independent-audit`
- Eraldi värske worktree: `C:\Users\rauds\Desktop\SotsiaalAI-admin-p0-1a-audit`
- Auditi kuupäev: 2026-07-16

Worktree loodi täpselt commiti `5357147e...` pealt. Kasutaja määrdunud põhitööpuud ei kasutatud ega muudetud.

## Kontrollitud failid

Vahemik sisaldab täpselt kuut raporteeritud faili: 424 lisatud ja 47 eemaldatud rida.

1. `components/admin/AnalyticsDashboard.jsx`
2. `lib/admin/dangerousAnalyticsActions.js`
3. `messages/en.json`
4. `messages/et.json`
5. `messages/ru.json`
6. `tests/admin/dangerousAnalyticsActions.test.js`

Prisma skeemi ega migratsioone vahemikus ei muudetud.

## Auditimeetod

Audit ühendas neli kontrollikihti:

1. täpne commiti- ja kuue faili diffi ülevaatus;
2. serveri väravate, autentimise, tokeni, auditirea ja vastuse staatiline koodikontroll;
3. olemasolevad sihttestid ja kogu regressioonipakk;
4. olemasolevatest testidest sõltumatud katsed päris PostgreSQL-i ja Prisma `DataAuditLog` tabeliga, sünteetiliste kasutajate ning mälu-põhise võltsmaileriga. Reaalset e-kirja ei saadetud ja sünteetilised andmed eemaldati katsete lõpus.

## M1 — eelvaatetokeni ühekordsus

| Nõue | Tõend | Tulemus |
|---|---|---|
| Krüptograafiliselt juhuslik `jti` | `createPreview` kasutab `node:crypto` `randomUUID()` väärtust (`lib/admin/dangerousAnalyticsActions.js`, read 1 ja 69–83). Validaator nõuab UUID v4 kuju. Sõltumatu katse lõi kaks erinevat tokenit; mõlemad `jti` väärtused vastasid UUID v4 mustrile. | PASS |
| HMAC-allkiri | Payload base64url-kodeeritakse ja allkirjastatakse HMAC-SHA256-ga. `assertPreview` võrdleb allkirja `timingSafeEqual` abil ning kontrollib versiooni, `jti`, liiki, fingerprint'i, mõju, kinnitust ja aegumist (read 69–135). Muudetud allkirjastatud `impact` andis enne reserveerimist `400 DANGEROUS_PREVIEW_INVALID`. | PASS |
| Püsiv reserveerimine enne saatmist | `reserveBulkEmailPreview` teeb `DataAuditLog.create({id: jti, ... status: started})` ridadel 516–543. `executeBulkEmail` ootab reserveerimise lõppu enne esimest `mailer.sendMail` kutset ridadel 573–585. Päris andmebaasi katse kinnitas sama järjekorra. | PASS |
| Järjestikune korduskasutus | Päris PostgreSQL-i katses õnnestus esimene saatmine kahele sünteetilisele saajale; sama tokeni teine kasutus tagastas `409 DANGEROUS_PREVIEW_ALREADY_USED`. Maileri kutseid jäi kokku 2 ja auditiridu oli 1. | PASS |
| Paralleelne korduskasutus | Kahe samaaegse päringu katses täitus täpselt üks lubadus, teine tagastas `409 DANGEROUS_PREVIEW_ALREADY_USED`; maileri kutseid oli 2, mitte 4, ja auditiridu 1. | PASS |
| Korduskasutus ei saada kirja | Nii järjestikuse kui paralleelse korduse kaotanud päring ebaõnnestus `DataAuditLog.id` reserveerimisel enne saatmistsüklit. Sõltumatu maileriloendur ei suurenenud. | PASS |
| P2002 eristus | Reserveerimise püüdur teisendab ainult Prisma koodi `P2002` 409 korduskasutuseks; muu vea viskab edasi. Auditeeritud skeemis on `DataAuditLog` ainus unikaalne piirang primaarvõti `id`, kuhu kirjutatakse `jti` (`prisma/schema.prisma`, read 1416–1432). Süstinud `P2024` jäi `P2024` veaks ja mailerikutseid oli 0. | PASS |
| Täpselt üks auditirida | Reserveerimisel luuakse üks rida ning edu-, osalise vea ja täieliku vea korral uuendatakse sama rida `where: {id: preview.jti}` kaudu lõppolekusse `success`, `partial` või `failed` (read 595–613). Järjestikuse ja paralleelse katse järel oli kummaski üks auditirida. | PASS |
| Katkestuse ja vea semantika | Süstiti `DataAuditLog.update` rike pärast kahe võltskirja saatmist. Esimene käivitus ebaõnnestus, rida jäi `started`; sama tokeni kordus andis 409, maileriloendur jäi 2 ning duplikaate ei tekkinud. Reserveerimisejärgne katkestus on seega fail-closed. | PASS; vt P3 märkus |

## M2 — 500 adressaadi piir

| Nõue | Tõend | Tulemus |
|---|---|---|
| Õiged loendurid, kõik kasutajad | `resolveBulkRecipients` deduplikeerib normaliseeritud e-posti järgi, arvutab kogu kõlbliku hulga, lõikab saadetava hulga `MAX_BULK_EMAIL_RECIPIENTS = 500` järgi ja arvutab `truncated` väärtuse (read 438–465). Päris andmebaasi katses oli `eligibleRecipientCount=516`, `sendRecipientCount=500`, `truncated=true`; oodatav päringupõhine kõlblike arv oli samuti 516. | PASS |
| Õiged loendurid, valitud adressaadid | 503 sünteetilise valitud kasutaja eelvaade andis `eligibleRecipientCount=503`, `sendRecipientCount=500`, `truncated=true` ja kinnituse `SEND BULK EMAIL 500`. | PASS |
| Token seob sihtrühma, identiteediräsi ja loendurid | `bulkEmailFingerprint` sisaldab `target`, valitud kasutaja ID-sid, sisu räsi, saadetavate adressaatide identiteediräsi, mõlemat loendurit ja `truncated` väärtust (read 468–477). See fingerprint kuulub HMAC-allkirjastatud payload'i. | PASS |
| Adressaatide muudatus pärast eelvaadet | Ühe kasutaja e-posti muutmine pärast eelvaadet andis `400 DANGEROUS_PREVIEW_STALE` ja 0 mailerikutset. Üle 500 kõlbliku saaja katses lisati pärast eelvaadet veel üks kasutaja: `eligible` muutus 514→515, kuigi `send` jäi 500; vana token andis samuti `400 DANGEROUS_PREVIEW_STALE` ja 0 mailerikutset. | PASS |
| Token teise sihtrühmaga | Kõigi kasutajate tokeni kasutamine 500 valitud kasutaja sihtrühmaga andis `400 DANGEROUS_PREVIEW_STALE`. Ka valitud kasutajate hulga muutmine andis sama fail-closed tulemuse. Mailerikutseid oli 0. | PASS |
| Payload ei sisalda aadresse | Dekodeeritud payload'i võtmed olid ainult `confirmation`, `expiresAt`, `fingerprint`, `impact`, `jti`, `kind`, `v`. Payload'i serialiseering ei sisaldanud sünteetilisi e-posti aadresse; identiteet oli SHA-256 räsi. | PASS |
| UI näitab kärpimist ausalt ET/EN/RU | Dashboard kuvab eelvaate kõlblike ja tegelikult saadetavate saajate arvud ning `truncated` korral semantilise `role="alert"` hoiatuse (`AnalyticsDashboard.jsx`, read 3290–3317). ET/EN/RU võtmed `email_preview_counts` ja `email_recipient_limit_warning` nimetavad kõlblike/saatmise arvud ning 500 piiri (`messages/*.json`, read 3657–3658). `i18n:check` ja vastav sihttest läbisid. | PASS |

## V1 — andmete minimeerimine

| Nõue | Tõend | Tulemus |
|---|---|---|
| `failed[]` ei sisalda aadressi ega identifikaatorit | Saatmisvea kirje moodustatakse kujul `{recipientIndex, error: "send_failed"}` (`dangerousAnalyticsActions.js`, rida 593). Osalise ja täieliku vea sõltumatud vastused ei sisaldanud e-posti, kasutaja ID-d ega muud adressaadi identifikaatorit. | PASS |
| Vastuses ainult järjekorranumber ja üldine veakood | Osalise vea vastus oli `[{recipientIndex: 0, error: "send_failed"}]`; täieliku vea vastus sisaldas sama kahe üldise kirjega indeksitel 0 ja 1. Edu vastus sisaldas `failed: []`. | PASS |
| Audit ei sisalda sisu, aadresse, IP-d ega user-agent'i | `bulkEmailAuditMeta` salvestab põhjuse, sihtrühma liigi, koondloendurid, kärpimisnäidu ja tulemuse; see ei kopeeri subject'i, body/text/html'i, aadresse, IP-d ega user-agent'i (read 499–513). Päris andmebaasi edu-, osalise vea ja täieliku vea ridade serialiseeringutes ei leidunud neid välju ega sünteetilisi aadresse. | PASS |
| Edu, osaline ja täielik viga | Sõltumatult reprodutseeriti kõik kolm rada. Auditirea lõppolekud olid vastavalt `success`, `partial` ja `failed`; vastuste veakirjed säilitasid minimaalse kuju. | PASS |

## Regressiooni- ja piiride kontroll

- **Server on autoriteetne.** UI saadab eelvaate ja täitmise lepingu, kuid server arvutab adressaadid ning fingerprint'i uuesti, kontrollib HMAC-i, loendureid, kinnitust, aegumist ja reserveerimist. UI muutmine ei võimalda neid väravaid vahele jätta.
- **Autentimine ja autoriseerimine säilisid.** `POST /api/admin/analytics/users` hangib sessiooni ja kutsub `assertAdmin` enne request body lugemist või teenuse käivitamist (`app/api/admin/analytics/users/route.js`, read 689–719). P0.1a diff seda route'i ei muutnud; sihttest kontrollis lepingu säilimist.
- **Skeem ja migratsioonid.** Kuue faili diff ei sisalda `prisma/schema.prisma` ega `prisma/migrations` muudatusi. Prisma validate ja täielik 92 migratsiooni kett läbisid.
- **Diffi piir.** Vahemikus oli täpselt kuus raporteeritud faili; kõrvalmuudatusi ei leitud.
- **Fail-closed sidumine.** E-posti identiteedi, sihtrühma, valitud ID-de, kõlblike loenduri või allkirjastatud mõju muutmine katkestas toimingu enne reserveerimist/saatmist.

## Iseseisvalt käivitatud kontrollid

| Kontroll | Tulemus |
|---|---|
| ADMIN-P0.1/P0.1a sihttest `tests/admin/dangerousAnalyticsActions.test.js` | **20/20 PASS**, 0 fail, 0 skip |
| Kogu `npm test` | **1257/1257 PASS**, 0 fail, 0 skip |
| Sõltumatu järjestikune tokeni korduskasutus, päris PostgreSQL + Prisma | PASS: esimene saatis 2, kordus 409, kokku 2 mailerikutset, 1 auditirida |
| Sõltumatu paralleelne tokeni korduskasutus | PASS: 1 õnnestus, 1 sai 409, kokku 2 mailerikutset, 1 auditirida |
| Sõltumatu reserveerimisjärgse katkestuse katse | PASS ohutuse osas: kordus 409, uut saatmist ei toimunud, rida jäi `started` |
| Sõltumatu mitte-P2002 andmebaasivea katse | PASS: süstitud `P2024` ei maskeerunud korduskasutuseks, 0 mailerikutset |
| Sõltumatud 500 piiri katsed (`all` ja `selected`) | PASS: 516→500 ja 503→500; mõlemal `truncated=true` |
| Sõltumatud tokeni sidumise katsed | PASS: identiteet, sihtrühm, valitud hulk, loendur ja payload'i muutmine ebaõnnestusid enne saatmist |
| Sõltumatud V1 edu-/osalise-/täisvea katsed | PASS: vastus ja audit olid aadressi- ning sisuvabad |
| `npm run lint` | PASS, 0 viga; 358 olemasolevat hoiatust. Kolme muudetud JS/JSX/testifaili eraldi ESLint andis 0 viga ja 0 hoiatust. |
| `npm run i18n:check` | PASS: ET/EN/RU võtmed kattuvad |
| `npm run build` | PASS: production build ja TypeScript läbisid; 54/54 staatilist lehte genereeriti |
| `npx prisma validate` | PASS |
| `npm run db:migrate:check` | PASS: 92/92 migratsiooni rakendusid värskele ajutisele andmebaasile; skeem ajakohane |
| `git diff --check 7d1cc4e8..5357147e` | PASS |

Kõigis sõltumatutes andmebaasikatsetes kasutati ainult spetsiaalse prefiksiga sünteetilisi kasutajaid ja auditiridu. Lõpukontroll kinnitas nende arvuks 0.

## Leiud raskusastmete järgi

### P0

Leide ei ole.

### P1

Leide ei ole.

### P2

Leide ei ole.

### P3 — reserveerimisjärgse katkestuse auditirida võib jääda `started`

**Mõju:** protsessi katkemise või `DataAuditLog.update` vea korral pärast saatmist jääb ainus auditirida määramata ajaks `started`, mistõttu hilisem operatiivne uurimine ei näe automaatselt, kas saatmine oli täielik, osaline või saatmiseni ei jõutud.

**Reprodutseerimine:** loo kehtiv eelvaade, lase reserveerimisel õnnestuda, lase võltsmaileril kirjad vastu võtta ning süsti lõppuuendusse andmebaasiviga. Esimene kutse ebaõnnestub; rida jääb `started`. Sama tokeni uus kutse tagastab `409 DANGEROUS_PREVIEW_ALREADY_USED` ja mailerikutsete arv ei kasva.

**Turvahinnang:** see ei ole M1 blokeeriv puudus. Token jääb tarbituks, korduv saatmine on välistatud ja auditiridu on täpselt üks. Fail-closed ning duplikaadivaba semantika säilib.

**Soovitatav minimaalne järeltegevus (eraldi tööna):** lisada vananenud `started` ridade operatiivne seire või lepitustöö, mis märgib need selgelt `indeterminate`/`interrupted` olekusse ilma tokenit taasavatuks muutmata. Käesolevas auditis parandust ei tehtud.

## Muutmatus- ja tegevuskinnitus

- Rakenduskoodi ei muudetud.
- Audit lisas ainult käesoleva dokumentatsiooni auditiharule.
- Teostusharu `codex/admin-p0-1a-audit-followups` SHA jäi kontrollimise lõpus muutmata: `5357147e1d1922bffdee333ccd748d842941d2cc`.
- Kasutaja põhitööpuud ei muudetud.
- Merge'i ei tehtud.
- Deploy'd ei tehtud.
- ADMIN-P0.1 + P0.1a on integratsioonivalmis, kuid seda ei integreeritud.

STATUS: COMPLETE
