# SotsiaalAI SOL-süvaaudit — jätk: Organisatsioonide katmata vaated

**Auditi seis:** põhiõiguste ja graafiku plokist välja jäänud vaadete staatiline süvaaudit `DONE`; runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `c9cefd285e082c70ab7f573c0ab130d578f57a98`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-mat-c9cefd2` (detached HEAD). Liikuvat põhi-worktree'd ei kasutatud tõendina.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Organisatsioonide avaleht ja loomine | DONE | tööruumivahetaja, kutsed, loomise UI/POST, roll ja feature-gate |
| Struktuur, liikmed, kutsed, seaded, arveldus | DONE | lehed, capability-väravad, API-toimingud ja olemasolevate CORE-V1 testide piir |
| Vastuvõtt | DONE | loend/detail, skoobitud nähtavus, assignment/handover ja listi mahupiir |
| Tugi | DONE | kontaktid/juhiseosed, saatmine, avamine, tagasivõtt, parandus, sulgemine ja teavitus |
| Teenuspäeviku aruannete saajavaade | DONE | loend, eelvaade, CSV/PDF download ja avamisjälg; SLOG sisemine loomine ei auditeeritud uuesti |
| Audit ja eksport | DONE | capability, projektsioon, loendi kärbe, organisatsiooni manifest ja adminaudit |
| Teenuseprofiil | PARTIAL | organisatsiooni omand/recipient/editor piir kontrollitud; eraldi Teenusekaardi otsingu- ja avaldamisrajad jäävad Teenusekaardi plokki |
| Päris runtime | NOT_PROVEN | autentitud brauser, PostgreSQL, faili- ja notification runtime `not_run` |

## Auditeeritud failid ja funktsioonid

- `app/org/**`, `components/org/**`, `app/api/org/**`: kõik organisatsiooni lehed, navigeerimine, serverikontekst ja route'id.
- `lib/org/accessContext.js`, `organizations.js`, `structure.js`, `units.js`, `members.js`, `inviteService.js`, `seats.js`, `sponsorship.js`, `inbox.js`, `support.js`, `supportShare.js`, `audit.js`, `export.js`, `serviceProfile.js`.
- Seotud aruandepiir: `lib/serviceLog/reportShare.js`, `app/api/org/[orgId]/aruanded/**`, `components/org/OrgServiceReportsClient.jsx`.
- Prisma organisatsiooni-, toe-, inbox-, rahastus-, audit- ja `ServiceReportShare` mudelid/migratsioonid.
- Põhiauditi `SOL-ORG-01`–`SOL-ORG-12` kõik `Seis`-lõigud ning `SOL-SLOG-15`–`16`; `parandusaudit.md` 12/12 ORG koondseis.

## Leiud

### SOL-ORG-13 — auditi vaade ja organisatsiooni eksport kärbivad vastutusjälje vaikides — P1

**Tõend.** Auditileht küsib täpselt 100 sündmust (`app/org/[orgId]/audit/page.jsx:20-26`) ja klient renderdab ühe tabeli ilma cursori, koguarvu või „laadi veel” toiminguta (`components/org/OrgAuditClient.jsx:25-51`). API `take` on maksimaalselt 200 ning teenus tagastab ainult read, mitte `hasMore`-t (`app/api/org/[orgId]/audit/route.js:23-29`; `lib/org/audit.js:207-236`). Organisatsiooni eksport kirjeldab end kogu organisatsiooni haldus- ja töövara koondina, kuid küsib samuti ainult 200 auditirida ja manifest ei märgi kärbet (`lib/org/export.js:3-20,81-204,215-264`). Negatiivkontroll kinnitas 100/200 piiri ja paging/truncation väljade puudumise.

**Mõju.** Pärast 100 toimingut ei näe audiitor vanemat ajalugu; pärast 200 toimingut puudub see ka „kogu organisatsiooni” ekspordist. Vastutus- ja vaidlustõend näib täielik, kuigi vanemad liikme-, õiguse-, toe- või vastuvõtutoimingud on vaikides välja jäetud.

**Vastuvõtukriteerium.** Auditivaade peab kasutama stabiilset `(createdAt,id)` cursor-paginatsiooni ja serveri koguarvu/`hasMore`-t. Eksport peab läbima kogu auditi stabiilsete lehtedena või fail-closed katkema; manifest peab kandma rea arvu ja tervikluse kontrolli. Testida vähemalt 201 sündmust, võrdseid ajatempleid ning eksporti, kus esimene ja viimane sündmus mõlemad säilivad.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-ORG-14 — vastuvõtu-, toe- ja aruandeloendid kaotavad vanemad aktiivsed read — P2

**Tõend.** Vastuvõtuloend kasutab ühe päringu 100 vaike-/200 maksimumrida ning route ei võta cursorit (`lib/org/inbox.js:446-489`; `app/api/org/[orgId]/inbox/route.js:19-29`). Toe omanikuvaade lõpeb 50/200, saajavaade 100 rea juures (`lib/org/supportShare.js:255-320`); organisatsiooni leht laadib need ühe korraga (`app/org/[orgId]/tugi/page.jsx:29-45`). Teenuspäeviku saajaaruanded lõpevad 200 rea juures (`lib/serviceLog/reportShare.js:368-406`) ning UI-l pole jätkamistoimingut. Kutsed ja sponsorlused kasutavad samuti ühekordset 200 rea lõiget (`lib/org/inviteService.js:149-169`; `lib/org/sponsorship.js:162-181`). Ükski vastus ei teata kärpest. Negatiivkontroll kinnitas inboxi, toe ja aruannete piirid ning cursorite puudumise.

**Mõju.** Vanem, kuid endiselt aktiivne töö, toeavaldus või avamata aruanne võib kaduda töövaatest. Kasutaja näeb korrektset tühja/valmis vaadet ega saa teada, et DB-s on veel tema vastutust või tundlikku suhtlust.

**Vastuvõtukriteerium.** Kõik operatiivloendid vajavad staatuse/prioriteedi serverifiltrit ja stabiilset cursor-paginatsiooni koos `hasMore`-ga. Aktiivsed, avamata ja tähtaja ületanud read peavad olema leitavad sõltumata ajaloo mahust. Negatiivtestid peavad looma 201 inbox-rida, 101 saadud toeavaldust ja 201 avamata aruannet ning tõendama täielikku, duplikaadivaba läbimist.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-ORG-15 — toeavalduse terminalseid seise saab otsese API-kutsega tagasi pöörata — P1

**Tõend.** `openSupportShare()` keelab ainult `RECALLED` seisu; `CLOSED` rea puhul, mille `openedAt` on null, kirjutab ta staatuseks `OPENED` (`lib/org/supportShare.js:325-368`). `closeSupportShare()` keelab ainult juba `CLOSED` seisu ega nõua `SENT/OPENED`; nii saab sama saaja teadaoleva ID-ga `RECALLED` või `CORRECTED` rea `CLOSED`-iks muuta (`:476-504`). POST-route võtab kliendi `action` väärtuse ja kutsub neid teenuseid ilma expected-status/revision'ita (`app/api/org/[orgId]/tugi/avaldused/route.js:37-94`). In-memory negatiivkontroll teostas mõlemad ebaseaduslikud rajad: **2/2** — `RECALLED → CLOSED` ja `CLOSED → OPENED`.

**Mõju.** Saatja tagasivõtmise või paranduse ajalugu saab saaja hilise/stale päringuga üle kirjutada. UI ei pruugi sellist nuppu näidata, kuid otsene või varem avatud vaate päring muudab auditit ja kasutajatele kuvatavat lõppseisu vastuoluliseks.

**Vastuvõtukriteerium.** Defineerida suletud olekumasin; iga mutatsioon peab luku all tegema tingimusliku `updateMany` lubatud lähteseisu ja revision/`updatedAt` järgi. `RECALLED`, `CORRECTED` ja `CLOSED` peavad olema terminalsed vastavalt lepingule. Päris PostgreSQL-i test peab katma open-vs-recall, close-vs-correct ja topelt-close võidujooksud; kaotaja saab 409 ja auditirida puudub.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-ORG-16 — aruande „avatud” seis võib tekkida enne ühegi baidi väljastamist — P2

**Tõend.** Detailroute kutsub esmalt `openShareForRecipient()` ning alles seejärel loeb failisüsteemist külmutatud aruande (`app/api/org/[orgId]/aruanded/[shareId]/route.js:22-39`). Teenus muudab `SENT → OPENED` ja kirjutab best-effort auditi enne storage path'i tagastamist (`lib/serviceLog/reportShare.js:413-452`). Puuduva/katkise faili või `readStoredDocument()` vea korral saab kasutaja 404/500, kuid saatja näeb aruannet avatuna. Lisaks märgib klient CSV/PDF allalaadimislingi `onClick` ajal lokaalselt avatuks enne HTTP tulemust (`components/org/OrgServiceReportsClient.jsx:144-158`). Negatiivkontroll kinnitas mõlema ennatliku järjekorra olemasolu. Faili/DB jagamisloomise ja best-effort auditi laiem probleem on juba `SOL-SLOG-15`; seda ei dubleeritud.

**Mõju.** Töötaja võib uskuda, et juht luges aruannet, kuigi faili polnud või allalaadimine ebaõnnestus. See on sisuline vale auditijälg töö ülevaatamise kohta.

**Vastuvõtukriteerium.** Faili olemasolu, suurus ja räsi tuleb kontrollida enne avamisoleku reserveerimist; download peab väljastuse edukuse siduma taastatava delivery/audit olekuga või kasutama ausat `access_attempted` ja `delivered` eristust. UI peab seisu muutma ainult serveri kinnitatud vastusest. Veasüst peab katma puuduva faili, räsivea, stream'i katkestuse ja auditirea vea.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-ORG-17 — organisatsiooni loomisel puuduvad idempotentsus ja serveri rate-limit — P2

**Tõend.** `POST /api/org` võtab keha ja kutsub iga päringu korral `createOrganization()`-i; route'is pole idempotentsusvõtit ega kasutaja-/IP-põhist rate-limit'i (`app/api/org/route.js:34-59`). Teenus loob ühe tehinguga uue organisatsiooni, liikmesuse, kolm capability't ja auditi, kuid ei kontrolli sama klienditoimingu kordust (`lib/org/organizations.js:58-114`). UI `busy` takistab vaid sama renderi tavalist topeltklikki; võrgu retry või otsene paralleelne POST on serveris kaks eri loomist (`app/org/OrgHomeClient.jsx:34-57,166-168`). `registryCode` on ainult indeks, mitte idempotentsuspiir (`prisma/schema.prisma:4697-4744`). Staatiline negatiivkontroll kinnitas mõlema serveripiiri puudumise.

**Mõju.** Katkenud vastuse retry, mitmes sakk või automatiseeritud klient saab luua piiramatu hulga DRAFT-organisatsioone koos omanikugrantide ja auditiridadega. See tekitab eksitavad tööruumid ning haldus-/andmebaasikoormuse.

**Vastuvõtukriteerium.** Loomine peab nõudma kasutajaga seotud `clientActionId`/idempotency key'd ja sama võtme eri payload peab andma 409; lisada mõistlik serveri rate-limit. Paralleeltest peab saatma sama võtmega vähemalt neli päringut ning tõendama ühe organisatsiooni, ühe liikmesuse ja ühe audititoimingu; eri sisu ja rate-limiti negatiivjuhud peavad olema kaetud.

**Seis.** NOT_DONE; runtime: not_run.

## Testid ja negatiivkontrollid

- `node --import ./scripts/register-node-test-loader.mjs --test tests/org/*.test.js`: **165/165 passed**, 0 failed.
- Auditispetsiifiline toeolekumasina in-memory kontroll: **2/2 riskirada teostus** (`RECALLED → CLOSED`, `CLOSED → OPENED`).
- Auditispetsiifiline staatiline kontroll: **8/8 kinnitatud** — audit 100/200, ekspordi 200 auditirida, inbox 200, toe 200/100, aruanded 200, create idempotency/rate-limit puudumine ning aruande ennatlik opened-järjekord.
- Päris PostgreSQL, autentitud mitme kasutaja brauser, failiveasüst ja teavitused: **not_run**.

## Kattuvused ja tõendamata osa

- `SOL-ORG-01`–`SOL-ORG-12` on põhiauditi `Seis` järgi DONE ja aktiivne kood sisaldab nende parandusi; neid ei lisatud uute ID-dega.
- `SOL-SLOG-15` katab aruandekoopia loomise fail↔DB ja best-effort auditi; `SOL-ORG-16` käsitleb eraldi saajavaate vale avamisfakti pärast rida juba olemas on.
- Teenuseprofiili omandi/recipient'i testid kontrolliti; Teenusekaardi avalik otsing, detail, kaart ja avaldamine jäävad oma järjekorraplokki.
- NOT_PROVEN: päris DB lukud ja unique-indeksid, mitme organisatsiooniga autentitud runtime, notification delivery, faili stream'i katkestuse tulemus ning retention.

## Leidude kokkuvõte

| Prioriteet | Uusi leide |
|---|---:|
| P0 | 0 |
| P1 | 2 |
| P2 | 3 |
| P3 | 0 |
| **Kokku** | **5** |

**Järgmine auditiplokk:** Minu jagamised — kogu koondvaade ja selle allikatevaheline olekuleping.
