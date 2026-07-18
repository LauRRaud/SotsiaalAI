# ÜLESANNE: T11 `SERVICE-MEDIATION-V1` — Teenusekaart, teenuseprofiil ja nõusolekuga kontakt

**Olek:** `READY_TO_ASSIGN`  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Opus või Sol Medium  
**Järjekord:** T17 on valmis `codex/search-language-v1 @ ed95d6aab12722496f97ba8fafb13201767e74ce`; kasuta seda sama stack'i alusena, sest mõlemad puudutavad `WorkspaceFeaturePage.jsx`-i. T02-ga otsest failikonflikti ei ole.

## Eesmärk

Inimene leiab teenusekaardilt KOV-i või teenuseosutaja, saab alustada õiget pöördumisrada ning näeb teenuseid ka ilma kaardita. Abisoov ja abipakkumine aitavad kahte inimest kokku viia, kuid ei avalda haavatava inimese kuulutust anonüümsele veebile ega ava teisele poolele ruumi enne tema teadlikku nõusolekut.

Valmis teema tähendab:

1. KOV-i ja teenuseosutaja avalik teenuseinfo on kaardil ja alati kasutatavas loendivaates leitav;
2. peer-abikuulutused on nähtavad vaid autenditud kasutajale, on jämedateralise asukohaga ning ei leki mustandi, suletud või omaniku toorandmeid;
3. kaardilt algab KOV-i/teenuseosutaja puhul eelpöördumine ning abikuulutuse puhul vastaskirje teadlik valik;
4. match liigub `PENDING → ACCEPT | DECLINE`; ruum sünnib ja teine pool pääseb ligi alles pärast ACCEPT-i;
5. kõik teenusekaardi tüübid on eristatavad sümboli, teksti ja värviga ning kaart ei ole ainus kasutusviis;
6. ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja reduced-motion on samas teemas tehtud.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md` — tervikuna; eriti A8–A12, B5, B9-lisa, B10 ja B11.13–B11.14
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T11
5. `docs/platvormi arendus/tehis-testkontod.md`
6. olemasolev Help P0 avaliku projektsiooni kiht ning selle testid; ära dubleeri seda projektsiooni
7. `components/workspace/WorkspaceFeaturePage.jsx`, `components/workspace/ServiceMapLeaflet.jsx`, `app/styles/workspace.css`
8. `app/api/service-map/entries/route.js`, `app/api/help/listings/**`, `app/api/help/matches/**`, `app/api/pre-inquiries/**`, `lib/help/**`, `lib/serviceProviderProfiles.js`, `lib/serviceMap/**`, olemasolev teavituste kiht
9. markerite alus `origin/codex/service-map-marker-css @ ec37b39d6ad35a27460661189c81999ca938a885` ja selle parent `8fb09367e6f02b7aaf250fc0a1090464ad8e1f11`.

## Alus ja worktree

1. Kontrolli enne alustamist `origin/main` SHA-d ja T17 remote SHA-d `ed95d6aab12722496f97ba8fafb13201767e74ce`. T17 peab jääma samasse stack'i; ära korda selle otsingu-/selge-keele diffi.
2. Ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`.
3. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-service-mediation-v1`, ja haru `codex/service-mediation-v1` T17 kinnitatud commit'ist `ed95d6aa`.
4. Too markerite alus samasse harusse `cherry-pick -x ec37b39d6ad35a27460661189c81999ca938a885`. Kui see ei rakendu puhtalt, lahenda konflikt ainult T11 pinna piires, säilita nii T17 kui markerite semantiline test ning ära rebase'i ega muuda algset markeriharu.
5. Help P0 on `origin/main`-i live-baseline. Ära cherry-pick'i seda uuesti ega nõrgenda selle projektsiooniallowlist'i.

## Lukustatud V1 valikud

| Otsus | V1 valik |
|---|---|
| O1 markerid | Kasuta `ec37b39d` taastatud kaardikeelt: KOV `K`, teenuseosutaja `T`, abisoov `?`, abipakkumine `+`; värv ei kanna tähendust üksi. Hilisem ruumiline ümberkujundus ei kuulu T11-sse. |
| O2 kontaktitee | KOV ja teenuseosutaja → eelpöördumine `recipientEntryId`-ga; abisoov/abipakkumine → vastaskirje valik ja nõusolekuga match. |
| O3 nõusolek | `PENDING → ACCEPT | DECLINE`. Matchi loomine ei loo veel ühist ruumi ega lisa teist inimest liikmeks. |
| O4 nähtavus | KOV-i ja teenuseosutaja kirjed on avalikud. Abisoovid/-pakkumised on ainult autenditud kasutajale; anonüümne vastus ei vihja nende arvule ega olemasolule. |
| O5 loend | Loend on alati olemas, serveripoolse lehitsemise ja mõistliku piiriga. See on kaardi täisväärtuslik alternatiiv, mitte ainult otsingu järel kuvatav riba. |
| O6 filtrid | Neli eraldi filtrit: KOV, teenused, abisoovid, abipakkumised. |
| Asukoht ja tekst | Peeri kirje asukoht on maksimaalselt KOV/piirkonna täpsusega; `rawPlace`, täpne aadress, kontakt ning kuulutuse toortekst ei leki mitte-omanikule. |
| Auditi- ja teavitusandmed | Logi ainult tegevus, osaliste ID-d, kirje ID ja kategooriakood. Ära kopeeri kirjeldust, olukorda ega `rawPlace`-i auditisse või teavitusse. |
| Platvormi lubadus | PAID/MIXED kuulutusel on nähtav lahtiütlus: platvorm tutvustab, ei kontrolli ega vahenda makset. |

## Teostus

### E1 — privaatsuspiir ja nähtavus

- Jõusta serveris, et võõras ei saa detailist ega globaalsest loendist DRAFT, CLOSED, CANCELLED või ARCHIVED peer-kuulutust. Omanik näeb oma objekte; administraatori erand peab kasutama olemasolevat autoriteetset reeglit ning olema eraldi testitud.
- Kaardikirjete avalik projektsioon tagastab anonüümsele kasutajale ainult KOV-i ja teenuseosutaja kirjed. Autenditud kasutaja saab lisaks ainult avaldatud/aegumata peer-kirjed ning mitte ühegi toorvälja.
- Piira detailsed peer-kirjed, entries- ja match-päringud olemasoleva rate-limit mustriga. Tühi, aegunud või ligipääsuta tulemus on turvaline 404/tühi loend — mitte olemasolu-oraakel.
- Paranda teeninduskoha liit-ID (`<entryId>:location:<locationId>`) nii, et eelpöördumise adressaadiks jõuab õige baaskirje ja INTERNAL rada ei kuku vaikselt e-posti/üldraja peale.

### E2 — kaardilt õige kontaktiraja alustamine

- KOV-i ja teenuseosutaja popup ning loend annavad „Alusta pöördumist” süvalingi olemasolevale eelpöördumiste pinnale. Server kinnitab adressaadi ning klient ei tee kasutaja sisendist vaba URL-i.
- Abisoovi või abipakkumise „Võta ühendust” laadib algataja enda vastastüüpi OPEN kirjed. Kui neid on mitu, peab inimene ühe valima; esimest kirjet ei valita vaikimisi.
- Kuvatakse arusaadavalt, mis juhtub järgmisena: eelpöördumine saadetakse adressaadile; peeri kontaktis saadetakse teisele poolele nõusolekupäring. Viga, tühi vastaskirjete loend, laadimine ja kordus on eri olekud.

### E3 — nõusolekuga match ja ruumi loomine

- `POST /api/help/matches` kontrollib polaarsust, eri omanikku, OPEN/aegumata olekut, blokeeringuid ning sobivust serveris. Edukas esimene samm loob või idempotentselt taastab ainult `PENDING` matchi.
- Teine pool saab minimaalse teavituse: kategooria ja üldistatud piirkond, mitte kirjeldus, `rawPlace` ega kontakt. Teavitusel on turvaline süvalink otsustamiseks.
- Loo vastuvõtja autoriseeritud ACCEPT/DECLINE API ja kasutajaliides. ACCEPT teeb ühes tehingus matchi aktiivseks, loob ruumi, lisab mõlemad liikmed ja saadab mõlemale neutraalse teavituse. DECLINE ei loo ruumi ega lase sama algataja päringul kasutajat spämmida.
- Mõlemal poolel on selge sulgemis-/väljumisrada; blokeeritud osapooled ei saa luua matchi, jõuda ruumi ega saata uusi sõnumeid. Kasuta olemasolevaid Roomi/teavituse kihte, ära ehita uut üldist kõne- või koostööruumi loogikat.

### E4 — kaart, loend ja tähenduslikud markerid

- Säilita markerite aluscommit, legend ja kahekanaliline tähendus. Valitud/fookustatud olek ei toetu üksnes värvile.
- Tee alati nähtav lehitsetav loend, kus iga rida sisaldab tüüpi, pealkirja, piirkonda, kasutajale nähtavat saadavus-/olekuteavet ning sama turvalist kontakti-/detailiteed nagu marker. Loendist valimine viib kaardil õige markerini; kaardil valimine sünkroniseerib loendiga.
- Lisa ausad laadimis-, tühja- ja nulltulemuse olekud ning neli filtrit. Filtri ja otsingu seis on URL-is taastatav/jagatav ainult avalike filtriväärtuste kaudu.
- Lisa kauguspõhine klasterdamine või samaväärne ligipääsetav koond, et tihedas alas ei jääks markerid kattuma. Klaster ei tohi muuta üksikkirjeid klaviatuuriga leidmatuks.

### E5 — teenuseprofiil, keele- ja kasutatavusleping

- Teenuseosutaja profiili avaldamise, geokoodi ja saadavuse olemasolevad serverireeglid säilivad. Kaart ei väida, et `NEEDS_REVIEW`, `DRAFT` või kinnitamata asukoht oleks avalik teenus.
- Lisa kõik uus copy ET/EN/RU sümmeetriliselt. Põhjused, miks kontakt, match või kaart pole saadaval, on tekstina nähtavad — mitte üksnes disabled-värv/tooltip.
- Kontrolli klaviatuuri rada loend → marker → popup → tegevus, ekraanilugeja nimed/olekud, 200% tekst, 375 px mobiil ning reduced-motion tasane tee.

## Selgelt väljas

- T12 üldine ruumide/kõne/salvestuse ümberteostus; T11 kasutab ainult help-match'i konkreetset ruumihetke.
- T20 professionaalne koostöö, T24 välitöö, T25 organisatsiooni analüütika ja T19 ruumimootor.
- Uus makse-, usaldusmärgise-, taustakontrolli- või reitingusüsteem; platvorm ei tee peer-makset.
- Päris Maa- ja Ruumiameti või muu välise süsteemi masspäring, tootmisandmete lugemine ja päris kasutajate kontaktimine.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

1. Anonüümne `service-map/entries` ei sisalda `HELP_REQUEST` ega `HELP_OFFER`; autenditud tulemus ei sisalda võõra mustandi/suletud kirjet.
2. Võõras detail-GET DRAFT/CLOSED/CANCELLED/ARCHIVED kirjele on 404 või autoriseerimiskeeld; `rawPlace`, täpne aadress ja toorväljad ei leki mitte-omanikule.
3. Globaalses peer-loendis on ainult OPEN/aegumata kirjed ning lehitsemine, tüüp ja filter jäävad serveripoolseks.
4. Teeninduskoha liit-ID-ga KOV/teenuseosutaja pöördumine valib õige baaskirje ja jääb INTERNAL-rajale.
5. Kaardilt kontaktimine mitme vastaskirjega nõuab valikut; nulli korral ei looda matchi; võõra/vääratüübi kirjet ei saa käsitsi POST-iga sobitada.
6. Matchi loomisel jääb teine pool enne ACCEPT-i ruumist ja sõnumitest välja; ACCEPT loob ühe ruumi, DECLINE ei loo ühtegi; duplikaat ei loo teist ruumi.
7. Nõusoleku- ja ruumisündmuse teavitused ei sisalda kuulutuse kirjeldust, olukorda, `rawPlace`-i ega kontakti; auditikirjed sisaldavad ainult ID-sid ja kategooriakoodi.
8. Blokeeritud osapooled ei saa luua matchi ega ruumis suhelda; suletud ruumis ei saa kumbki osapool sõnumit postitada; rate-limit annab 429.
9. Neli markerit, legend, alati nähtav loend, filtrid, null-/veaolek, URL-i taastamine ning marker/loend sünkroniseerimine töötavad; värv ei ole ainus tüübikandja.
10. ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja reduced-motion on T11 muudetud pindadel kaetud.

Käivita vähemalt T11 sihttestid, muudetud failide lint, `npm run i18n:check`, Prisma validate ja migratsiooniahela kontroll, kui skeemi muudetakse, `git diff --check` ning production build. Täissviit ja sõltumatu release-audit jäävad T27-sse, kui neid eraldi ei nõuta.

## Sünteetiline runtime

Kasuta ainult lokaalset sünteetilist keskkonda ning olemasolevaid tehis-testkontosid vastavalt `docs/platvormi arendus/tehis-testkontod.md`. Loo vajadusel kaks ülesande ajutist peer-kuulutust, KOV/teenuseosutaja näidiskirje ning üks teeninduskoht. Tõenda anonüümne vs autenditud kaart, mustandi lekke-keeld, valikuga kontakt, PENDING→ACCEPT ja DECLINE, ruumi liikmesuse piir, marker/loend mobiilis ning cleanup. Päris e-kirju, makseid, partnerikontakte ega tootmisandmeid ei kasutata. Kui ohutu runtime ei ole võimalik, raporteeri ausalt `NOT_RUN`/`NOT_PROVEN`.

## Definition of Done

1. E1–E5 on samas harus teostatud ning markerite aluscommit on stack'is.
2. Avalik teenuseinfo ja kaitstud peer-kuulutused on serveris selgelt eristatud.
3. Match ei ava ruumi ega suhtlust enne teise poole ACCEPT-i.
4. Kaardilt, loendist ja detailist saab käivitada õige nõusolekupõhise järgmise sammu.
5. Kaart ei ole ainus kasutustee; markerid, loend ja filtrid on ligipääsetavad kolmes keeles.
6. Worktree on puhas, muudatused on commit'itud ja remote-harusse push'itud.
7. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne koordinaatorile

Esita worktree, haru, täpne baas-SHA, markerite cherry-pick SHA, lõppcommit/remote SHA, migratsiooni nimi või kinnitus et migratsiooni pole; E1–E5 kasutajateekonna kokkuvõte; testide/lindi/i18n/Prisma/diff-check/buildi tulemused; runtime/cleanup või `NOT_RUN`/`NOT_PROVEN`; PENDING→ACCEPT/DECLINE ja avaliku nähtavuse tõend; ning kinnitus, et põhitööpuud, `main`-i, serverit, merge'i ega deploy'd ei muudetud.

Pärast arendaja lõpparuannet teeb Fable ainult fokuseeritud kontrolli: avaliku projektsiooni piir, nõusolek enne ruumi, audit/teavituse sisuminimeerimine ning loend/kaardi ligipääsetavus. Täissviiti ega uut tervikauditit vaikimisi ei korrata.
