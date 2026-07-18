# ÜLESANNE: T09 `PAYMENTS-V1` — tellimuse, makse ja sponsoreeritud kasutuse terviklik elutsükkel

**Olek:** `READY_TO_ASSIGN`  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Opus või Sol Medium  
**Järjekord:** T02 `ACCOUNT-V1 @ 929793f1` on valmis ja tuleb samasse stack'i võtta, sest mõlemad puudutavad tellimuse seisude kasutajavaadet. Päris Maksekeskuse makseid, webhook'e ega tagasimakseid ei käivitata.

## Eesmärk

Kasutaja näeb ausalt, kas tema tellimus on aktiivne, lõppemas, maksehäires või tühistatud. Server ei võta paketti ega hinda kunagi kliendilt; makse tagasiside on idempotentne, saladused ja provideri toorandmed on minimeeritud, sponsoreeritud ligipääs ei ärka tühistuse järel uuesti ning e-kiri ei ole ainus tõend sellest, et tellimuse seis muutus.

Valmis teema tähendab:

1. serveripoolne roll→pakett sidumine on T09 stack'is ning klient ei saa paketti eskaleerida;
2. makse algatus, callback, webhook, uuenduskatse ja reconciliation on korduskindlad ning järjekorrakindlad;
3. `PAST_DUE`, perioodi lõpus tühistamine ja lõplik aegumine on kasutajale eristatavad;
4. sponsoreeritud kutse ei loo õigust enne makset ja accept'i ega taastu pärast hosti revoke'i; tagasimaksega kaasnev ligipääsu revoke on tehniliselt üheselt määratud;
5. raw payload, token, e-kiri ja audit on minimeeritud; e-kiri käib outbox'i kaudu ning ei otsusta tellimuse tõde;
6. kõik uued tekstid on ET/EN/RU ja ligipääsetavad; päris makseaktiveerimine jääb eraldi luba-/õigusväravaks.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-maksed-tellimus-ja-sponsoreeritud-kasutus.md` — tervikuna; eriti ptk 3–13, 15–21 ja otsused O-M1…O-M6/O-J1…O-J4
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T09
5. T02 lõpparuanne: `codex/account-v1 @ 929793f1339ce5754ae0206b87450e8ee1689e48` ning selle konto-/step-up-/kustutusleping.
6. valmis aluscommit `0aca8c4bc424a42d90c730048196fccdc9b4e3e4` (`MAKSED-P1a`), selle audititõend ja olemasolevad `tests/usage/**`, `tests/subscription/**`, `tests/invites/**`
7. `app/api/subscription/**`, `app/api/invites/sponsored/**`, `lib/payments/**`, `lib/subscriptionPlans.js`, `lib/subscriptionStatus.js`, `lib/usage/**`, `lib/retention.js`, `components/alalehed/TellimusBody.jsx`, admini maksevaated ning olemasolev e-posti/teavituste outbox.

## Alus ja worktree

1. Kontrolli enne alustamist `origin/main` SHA-d. Ülesande koostamise hetkel on see `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`.
2. Ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`.
3. Kui T02 on enne alustamist saanud valmis remote-haru, loo T09 värskest `origin/main`-ist ning cherry-pick'i T02 ainult pärast eraldi koordinaatori integratsiooniotsust. T09 ei tohi oletada, et T02 on main'is.
4. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-payments-v1`, ja haru `codex/payments-v1` värskest `origin/main`-ist.
5. Too samasse harusse `cherry-pick -x 0aca8c4bc424a42d90c730048196fccdc9b4e3e4`. Ära muuda algset MAKSED-P1a haru. Konfliktis säilita serveri rolli autoriteetsus ning raporteeri kõrvalekalle.

## Lukustatud V1 valikud

| Otsus | V1 valik |
|---|---|
| O-M1 / O-J4 | P1a roll→pakett sidumine on kohustuslik. Olemasolevaid tootmistellimusi ei loeta ega korrigeerita selles töös; lisatakse ainult admini mittesiduv anomaalia-indikaator/sünteetiline kontroll. |
| O-M2 | Reconciliation on repo-hallatud, vaikimisi mitteaktiveeritud worker/oneshot: see töötleb ainult aegunud `INITIATED` kirjeid idempotentselt ja küsib providerit ainult selge serveri konfiguratsiooni ning operaatori loaga. Admin näeb minimaalseid stuck-loendureid, kuid ei saa käsitsi olekut „PAID” teha. |
| O-M3 / O-J2 | Pärast sponsoreeritud makse tagasimakset revoke'itakse veel aktiivne sponsoreeritud tellimus ja selle `RoomMember` õigused atomaarse lõpptehinguga; raha arvestuse/prorata otsust ei automatiseerita. |
| O-M4 / O-J3 | Kasutaja tühistus tähendab `cancelAtPeriodEnd`: makstud ligipääs kestab `validUntil`-ini, uusi uuendusmakseid ei alustata. Kohene revoke jääb ainult admini/turva- või tagasimakse rajale ning on auditeeritud. |
| O-M5 | `PAST_DUE` on kasutajale selgelt nähtav: viimane ebaõnnestumine, järgmine automaatne katse või lõppkuupäev ja aus „vajadusel pöördu toe poole” rada. Uut päris makseviisi muutmise checkout'i ei avata. |
| O-M6 | Hosti `REVOKED` kutse ei ärka hilisema PAID webhook'iga. Makse jääb operatiivseks erandiks/minimaalseks auditikirjeks, mitte aktiivseks kutseks; automaatset tagasimakset ei saadeta. |
| O-J1 | `Payment.raw` salvestab ainult rangelt allowlistitud tehnilised väljad ja kärbitakse kiiresti; provider token on krüptitud eraldi serverivõtmega. Kui vajalik krüptovõti puudub, recurring-tokeni vastuvõtt ebaõnnestub fail-closed ning korduvmakse ei aktiveeru. Juristi/PCI lõppkinnitus on `NOT_PROVEN` ja blokeerib ainult päris rollout'i. |
| E-kirjad | Tellimuse seis on DB-s ja UI-s tõde; e-kiri on outbox'i töö. Ebaõnnestunud saatmist kordab tööline, kuid see ei korda makset ega õiguse andmist. |

## Teostus

### E1 — P1a alus ja ühine olekumudel

- Too P1a stack'i ning säilita range serveripoolne roll→pakett ja `planDefinitionId` kontroll kõigil aktiveerimisradadel. Kliendi `plan`, legacy väärtus, tühi või mittetekstiline väärtus ei anna kõrgemat paketti ega `admin_internal` õigust.
- Koonda tellimuse kasutajale nähtavad seisud ühte serialiseerijasse: ACTIVE, `cancelAtPeriodEnd`, PAST_DUE koos retry-aknaga, CANCELED/EXPIRED ning sponsoreeritud päritolu. Admini eelvaade ei tohi muuta päris kasutaja seisusid.
- Ära loe ega paranda tootmisandmeid. Lisa ainult turvaline anomaaliaarvestus/raportiliides, mis ei avalda teiste kasutajate makseinfot tavakasutajale.

### E2 — callback, webhook ja reconciliation

- Callback- ja webhook-rajad keelduvad, kui vajalik shared secret/krüptovõti puudub; mitte ükski tühi saladus ei tohi verifitseerimist vaikimisi läbida.
- Tee provider-sündmuse töötlemine korduskindlaks ja järjekorrakindlaks: lukusta makseea kirje või kasuta samaväärset compare-and-set/sündmuse registrit, nii et samaaegne PAID/CANCELED/REFUNDED ei jäta vastuolulist õigust.
- Lisa idempotentne reconciliation-worker ja administraatori ainult-vaateloendur. Worker ei tohi olla Next.js pikas protsessis, ei lähe vaikimisi tootmises tööle ning iga provider-kutse vajab selget konfiguratsiooni. Stuck INITIATED kirje ei muutu kunagi admini nupust tasutuks.
- Maksealert ja sündmusmõõdik eristavad päriselt töödeldud makset idempotentsest kordusest; kordus ei kasvata paid conversion'i.

### E3 — makseandmete minimeerimine ja retention

- Asenda provider payload'i toorsalvestus rangelt allowlistitud maksetehnilise projektsiooniga. API- ega adminivastus ei väljasta tokenit, e-posti, nime, kaardi last4 või raw payload'i.
- Krüpti recurring `providerToken` serveris; võtme identifikaator võib olla kirjes, võti ega plaintext mitte. Rakenda võtmepöörde-/puuduva-võtme selge fail-closed seis ning testitav decrypt tee renewal-workerile.
- Retention eemaldab technical raw projektsiooni ja krüptitud mandaadi, kui see pole enam aktiivseks recurring'uks vajalik. Raamatupidamisrea seaduslikku säilitust ega selle sisu ei muudeta ilma juristi otsuseta.
- Auditikirjed sisaldavad makse/subscribe/invite ID-d, tegevust ja tulemust; ei payload'i ega maksevahendi sisu.

### E4 — kasutaja tellimuse aus käik

- `PAST_DUE` näitab kasutajale eristatavat selgitust, ajaraami ja järgmist sammu. Viga ei esitle ligipääsu aktiivsena ega palu kasutajal uuesti maksta, kui automaatne retry veel töötab.
- Tühistamine seab perioodi lõpu märgi, peatab uue renewal'i ja hoiab õiguse kuni `validUntil`-ini. UI, API ja usage-värav kasutavad sama serveritõde; perioodi lõpus toimub idempotentne revoke.
- Täielik/ turvaline revoke ja REFUNDED rada annab kasutajale ausa põhjuse ning ei jäta töötavat piiramatut tellimust. Ära muuda avaliku hinnastuse ega juriidilise copy lõpptekste — T10/jurist kinnitab need hiljem.

### E5 — sponsoreeritud kutse tervik

- Hosti revoke on terminaalne kutseolek: hiline PAID callback/webhook ei sea kutset tagasi SENT-iks ega väljasta uut tokenit.
- Accept nõuab õiget e-posti/rolli, tasutud kutset ja kehtivat tokenit. Selle järel antav tellimus/ruumiliikmesus on idempotentne.
- REFUNDED pärast accept'i revoke'ib sponsoreeritud õigused ja ruumiliikmesuse ühes lukustatud tehingus; audit on sisuminimeeritud ning e-kiri teavitab outbox'i kaudu. Topelt-refund ega retry ei tohi topeltkustutada ega anda õigust tagasi.
- Resend roteerib tokeni ja salvestab uue kehtiva hash'i enne outbox'i saatmist. E-kirja tõrge jätab ausa retry-seisu, mitte kehtetu vaikiva lingi.

### E6 — outbox, keeled ja kasutatavus

- Kõik makse-/kutse e-kirjad lähevad olemasoleva või samas teemas loodud idempotentse outbox'i kaudu. Kirjetel on dedupe-võti, retry/backoff, terminalne failure ja minimaalne payload; worker on mitteaktiveeritud repo-hallatud üksus.
- Lisa ET/EN/RU copy kõigile PAST_DUE, perioodi lõpu, refund/revoke, sponsorkutse ja e-kirja läbikukkumise seisudele. Kasutaja saab klaviatuuriga vaadata seisundit ja järgmist sammu; olulised muutused on ekraanilugejale teavitatud.
- Mobiilis jääb tellimuse kehtivus, järgmine tegevus ja turvaline tühistus üheselt nähtavaks; disabled olek on tekstina põhjendatud.

## Selgelt väljas

- Päris Maksekeskuse või muu pakkuja makse, callback, webhook, refund, recurring-charge või e-kirja saatmine.
- Tootmisandmete lugemine, olemasolevate tellimuste finantskorrektsioon, tagasimakse summa otsustamine ja juristi/PCI lõppkinnitus.
- Uus maksepakkuja, hinnamudel, kupongid, käibemaksuarvestus, makseviisi UI-change checkout või avaliku hinnastuse lõppcopy.
- T02 konto turvateekonna, T10 avaliku onboarding'u, T16 andmekoopia või T18 üldise ops-kihi ümberteostus.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

1. CLIENT/SOCIAL_WORKER/SERVICE_PROVIDER crafted `plan` ei eskaleeri serveri paketti; `admin_internal`, tühi, legacy ja mittetekstiline väärtus on fail-closed.
2. Callback ja webhook keelduvad puuduva saladuse või vigase MAC-i korral enne tokeni/tellimuse muutmist.
3. Sama webhook'i kordus on idempotentne; samaaegne PAID/CANCELED/REFUNDED terminalijärjestus ei jäta vastuolulist `Subscription` ega õigust.
4. Reconciliation valib ainult aegunud INITIATED kirjed, ei aktiveeri kunagi ilma verifitseeritud provideritulemuseta, on korduskäivitatav ning vaikimisi mitteaktiivne.
5. `Payment.raw`, API serialiseerijad, audit, outbox ja adminivaated ei sisalda provideri toorpayload'i, e-posti, tokenit, nime ega kaardiinfot. Plaintext tokenit ei jää andmebaasi.
6. PAST_DUE, retry, cancel-at-period-end, expiry ja admini/turvarevoke annavad õiged kasutaja/API/usage seisud.
7. REVOKED sponsorkutse ei ärka PAID sündmusel; accept on õige e-posti/rolli/tokeni/maksega idempotentne; REFUNDED pärast accept'i revoke'ib tellimuse ja liikmesuse üks kord.
8. Resend salvestab tokeni enne outbox'i ning outbox retry ei korda makset või õiguse andmist.
9. ET/EN/RU pariteet, klaviatuur, ARIA olekud, reduced-motion ja mobiilivaade on uutel tellimuse/kutse pindadel kaetud.

Käivita vähemalt T09 sihttestid, muudetud failide lint, `npm run i18n:check`, Prisma validate ja migratsiooniahela kontroll, `git diff --check` ning production build. Täissviit ja sõltumatu release-audit jäävad T27-sse, kui neid eraldi ei nõuta.

## Sünteetiline runtime

Kasuta ainult lokaalset sünteetilist DB-d, maksepakkuja HTTP stube ja testkontosid vastavalt `docs/platvormi arendus/tehis-testkontod.md`. Tõenda kliendipoolse paketi eskaleerimise keeld, PAST_DUE/period-end kasutajavaade, webhooki kordus/race, revoked sponsor-kutse, accept, refund-clawback ja outbox retry. Ära kutsu päris providerit ega saada e-kirja. Korista ülesande loodud tellimused, maksed, kutsed, liikmesused ja outbox-kirjed. Kui ohutu runtime ei ole võimalik, raporteeri ausalt `NOT_RUN`/`NOT_PROVEN`.

## Definition of Done

1. E1–E6 on samas harus; P1a aluscommit on stack'is ja selle autoriteetne roll→pakett leping säilinud.
2. Makse seis, õigused, providerisündmused ja kasutajavaade ei lähe omavahel lahku.
3. Toorandmed ja tokenid ei leki ning puuduv krüptovõti/saladus peatab tundliku raja.
4. Sponsoreeritud õigus sünnib ainult õigel accept'il ning kaob järjekindlalt revoke/refundi järel.
5. E-kiri on usaldusväärselt korduv teavitus, mitte makse või õiguse tõeallikas.
6. ET/EN/RU, a11y, mobiil ja reduced-motion on T09 muudetud pindadel tõendatud.
7. Worktree on puhas, muudatused commit'itud ja remote-harusse push'itud; `main`, server, merge ja deploy on puutumata.

## Lõpparuanne koordinaatorile

Esita worktree, haru, täpne baas-SHA, P1a cherry-pick SHA, lõppcommit/remote SHA, migratsioonid; E1–E6 kokkuvõte; testide/lindi/i18n/Prisma/diff-check/buildi tulemused; sünteetilise runtime'i ja cleanup'i tõend või `NOT_RUN`/`NOT_PROVEN`; kasutatud fail-closed krüptovõtme/secret'i põhimõte ilma saladusi avaldamata; ning kinnitus, et päris makseid, e-kirju, tootmisandmeid, põhitööpuud, `main`-i, serverit, merge'i ega deploy'd ei muudetud.

Pärast lõpparuannet teeb Fable fokuseeritud kontrolli: paketi autoriteet, webhooki terminalrass, sponsorite õiguse lõpp ning payload/tokeni minimeerimine. Ta ei korda automaatselt täissviiti ega tee uut üldist makseauditit.
