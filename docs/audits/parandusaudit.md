# Parandusaudit — SOL-süvaauditi seis

**Tuletatud loend. Olekut kannavad auditiraportite Seis-lõigud; see fail ei ole allikas.**
`npm run sol:tally` säilitab ametliku kaheosalise reegli: DONE on ainult leid, mille Seis algab
sõnaga `DONE`, kõik ülejäänud on ametlikult lahtised. `npm run sol:progress` näitab sama allika
kolmes astmes: **DONE / PARTIAL / NOT_DONE**. DONE ja PARTIAL peavad algama vastava täpse
sõnaga; tühi Seis, `NOT_DONE` ja `BLOCKED_DECISION` jäävad NOT_DONE-iks. Vale algusega
kvalifitseeritud DONE katkestab genereerimise, mitte ei kao vaikselt valesse rühma.

**„Paranduste seis" on genereeritud** (`npm run sol:progress -- --write`) ja sisaldab nii
kolme koguarvu, peatükkide jaotust kui PARTIAL-leidude nimelist loendit. Vana
`npm run sol:tally -- --write` kirjutab sama kolmeastmelise ploki, seega ei saa hilisem
plokiring uut vaadet tagasi kaheosaliseks muuta. Värskust hoiab test: `parandusaudit.md` läheb
punaseks kohe, kui mõni Seis-lõik muutub ja plokki ei ole üle genereeritud.

**Käsitsi kirjutatud jutustus on alles**, aga uue nime all („Jutustus — MIKS, mitte MIS") ja
tema roll on nüüd ainus, mida ta täita suudab: seletada, MIKS parandus selline on ja mis
kirjutamise ajal välja tuli. Olekut ega numbreid ta ei kanna.

**Loendur ise oli 11.08-ni vaikiv ja andis seetõttu vale nimetaja.** Range muster tundis
ainult kaheosalist koodi, seega jätkufaili `SOL-DOC-J-01…-06` (6 leidu) ei olnud kordagi
loenduses — sama veaklass, mille pärast loendur üldse kirjutati (SOL-MAT). Parandatud:
`-J` on tunnustatud jätku-nimeruum ja kuulub oma peatüki (`SOL-DOC`) alla, ning loendur
**kukub nüüd nimeliselt**, kui mõni `### SOL-…` pealkiri rangele mustrile ei vasta —
vaikselt väiksemat nimetajat ta enam anda ei saa (`tests/scripts/solAuditTally.test.js`).

## Kokkuvõte

Hetkeseisu kannab allolev genereeritud plokk „Paranduste seis: DONE / PARTIAL / NOT_DONE".
Siin ei ole enam käsitsi kopeeritud numbreid, peatükkide järjekorda ega deploy-SHA-d, sest kõik
kolm vananesid varem samal päeval. Järgmise tööotsa ja serveriseisu allikas on S1.0 failis
`docs/platvormi arendus/SotsiaalAI.md`; allolev ajalooline jutustus seletab ainult varasemate
otsuste põhjuseid ega kanna tänast seisu.

## SOL-WB lõpetatud (12.08) — ja kaks otsust, mis jäid omanikule

Peatükk on 18/18 ja tema kaks suuremat parandust on **osalusprojektsioon** (kirje kuulub sellesse
piloodikoondisse, kelle tööna ta sündis, ja seda ei otsusta enam kliendi saadetud string) ning
**range väljaskeem** (tundmatu ohuväärtus ei muutu enam „ohtu ei ole" vastuseks). Kolmas suurem
on **fikseeritud perioodivõrk**, mis võtab ära differencing-rünnaku eelduse.

**MÕLEMAD ALLPOOL OLNUD OTSUSED ON 12.08 ÕHTUL TEHTUD JA TEOSTATUD** (commit `285686ad`):
vaikeühik on `latest_per_person` ja lävend on 5. Otsuste sisu ja see, mis nende teostamisel välja
tuli, on leidude enda Seis-lõikudes; allolev kirjeldab, MIS otsustati.

**Üks lause allpool ei pidanud paika ja ta on mõõdetud:** „vahetus on üks rida" — `analysisUnit`
ei esinenud kordagi aruandes ega üheski ekspordis ja teda ei saanud päringuga valida, seega
vaikeväärtuse vahetus üksi oleks teinud sagedusvaate kättesaamatuks. Lävendi tõstmine kukutas
omakorda 12 testi viies failis, sest kõik fikstuurid olid ehitatud kolme inimese peale.

**Kaks asja, mis OOTASID otsust (nüüd tehtud):**

1. **SOL-WB-04 — analüüsiühik.** `analysisUnit` on nüüd andmestikus nähtav ja tal on kaks
   teostust: `record` (vaikimisi, iga sisestus loeb — näitab sagedust, on tundlik ühele väga
   aktiivsele kasutajale) ja `latest_per_person` (üks inimene, üks hääl töövoo kohta — näitab
   inimeste seisu, kaotab sageduse info). Vaikeväärtust ma ei vahetanud, sest see muudaks kõigi
   olemasolevate raportite tähendust. Vahetus on üks rida.

2. **SOL-WB-06 — kui kaugele privaatsuskaitsega minna.** Künnis (3, koodis alampiiriga) ja
   fikseeritud perioodivõrk on peal. Alles jääb see, et kaks ERI SUURUSEGA perioodi (kuu vs
   kvartal) on sisestikud. Selle vastu aitavad päringueelarve, privaatsust säilitav müra või
   „üks perioodiliik piloodi kohta" — kõik kolm kas piiravad kasutust või muudavad numbrid
   ebatäpseks, seega nad on tootevalik.

**Kolmas, väiksem:** liikmesuseta konto kirjed ei osale üheski piloodikoondis (SOL-WB-01
otsene tagajärg). Kui piloot peab katma ka üksikkasutajaid, on vaja eraldi tõendatud
osalusmehhanismi.

## Auditikorpus on nüüd ühes puus (12.08)

Kõik leide kandvad SOL-auditiraportid on nüüd `main`-is. Kuus eraldi tööpuudesse jäänud faili
andsid juurde 26 unikaalset NOT_DONE leidu: Välitöö 11, Teenuspäevik 7, Organisatsioonid 2,
Minu jagamised 2, Teenusekaart 1 ja funktsioonideülene lõpetusring 3. Tööheaolu lõpetus ei
lisanud uusi ID-sid, sest WB-15…18 olid juba põhikorpuses; register ja lõppkoond ei kanna leide.

Loendur nõuab nüüd täpselt 429 unikaalset leiu-ID-d ning katkestab nii tundmatu pealkirjavormi
kui dubleeritud ID korral. Hetkeseisu ja prioriteedid kannab allolev genereeritud plokk; vanade
eraldi tööpuude peaauditit, parandusauditit ega S1 koopiaid ei imporditud.
<!-- sol:tally algus — GENEREERITUD, ÄRA TOIMETA KÄSITSI -->

## Paranduste seis: DONE / PARTIAL / NOT_DONE

**See plokk on genereeritud** (`npm run sol:progress -- --write`) raporti enda Seis-lõikudest.
Käsitsi siia ei kirjutata. DONE algab sõnaga `DONE`, PARTIAL sõnaga `PARTIAL` ja kõik muu
on NOT_DONE. Kvalifitseeritud DONE-väide vale algusega katkestab genereerimise, et ta ei
kaoks vaikselt valesse rühma. Iga loetletud leiu lõpus on Seis-lõik **sõna-sõnalt**.

DONE **429** / 429 · PARTIAL **0** / 429 · NOT_DONE **0** / 429 · peatükke täielikult DONE **40** / 40 · ametlikult lahtiseid 0

| Peatükk | Kood | DONE | PARTIAL | NOT_DONE | Lahtiste prioriteedid | Märkus |
|---|---|---:|---:|---:|---|---|
| Skeemi ja Prisma mudeli vastavus | SOL-SCHEMA | 1/1 | 0 | 0 | – | **tehtud** |
| Build | SOL-BUILD | 1/1 | 0 | 0 | – | **tehtud** |
| Autentimine ja autoriseerimine | SOL-AUTH | 15/15 | 0 | 0 | – | **tehtud** |
| Juhtumitöö (JTA-V1) | SOL-CW | 20/20 | 0 | 0 | – | **tehtud** |
| RAG-i admin ja failihaldus | SOL-RAGADMIN | 4/4 | 0 | 0 | – | **tehtud** |
| Organisatsioonid ja skoop | SOL-ORG | 19/19 | 0 | 0 | – | **tehtud**, 7 jätkufailist |
| Välitöö | SOL-FIELD | 17/17 | 0 | 0 | – | **tehtud**, 11 jätkufailist |
| Dokumendid ja AI-kasutus | SOL-DOC | 15/15 | 0 | 0 | – | **tehtud**, 6 jätkufailist |
| Uuringud | SOL-RES | 7/7 | 0 | 0 | – | **tehtud** |
| Koosolekukokkuvõtted | SOL-MEET | 6/6 | 0 | 0 | – | **tehtud** |
| Vestlus | SOL-CHAT | 13/13 | 0 | 0 | – | **tehtud** |
| Hääl (STT/TTS) | SOL-VOICE | 3/3 | 0 | 0 | – | **tehtud** |
| Ruumid | SOL-ROOM | 7/7 | 0 | 0 | – | **tehtud** |
| Kõned ja salvestus | SOL-CALL | 13/13 | 0 | 0 | – | **tehtud** |
| Kutsed ja sponsorlus | SOL-INV | 3/3 | 0 | 0 | – | **tehtud** |
| Maksed | SOL-PAY | 11/11 | 0 | 0 | – | **tehtud** |
| Teavitused | SOL-NOTIF | 7/7 | 0 | 0 | – | **tehtud** |
| Domeenisündmused | SOL-EVENT | 1/1 | 0 | 0 | – | **tehtud** |
| Kiireloomuline abi | SOL-URG | 13/13 | 0 | 0 | – | **tehtud** |
| Tööheaolu | SOL-WB | 18/18 | 0 | 0 | – | **tehtud**, 4 jätkufailist |
| Teenuspäevik | SOL-SLOG | 31/31 | 0 | 0 | – | **tehtud**, 7 jätkufailist |
| RAG-teenus ja ingest | SOL-RAGSVC | 28/28 | 0 | 0 | – | **tehtud** |
| Migratsioonid | SOL-PRISMA | 4/4 | 0 | 0 | – | **tehtud** |
| Mentorlus | SOL-MENT | 7/7 | 0 | 0 | – | **tehtud** |
| Supervisioon | SOL-SUP | 15/15 | 0 | 0 | – | **tehtud** |
| Kovisioon | SOL-COV | 8/8 | 0 | 0 | – | **tehtud** |
| Tõenduspõhised praktikad | SOL-PRAC | 8/8 | 0 | 0 | – | **tehtud** |
| Teemaseemned | SOL-SEED | 5/5 | 0 | 0 | – | **tehtud** |
| Teekond ja jagamine | SOL-JOUR | 17/17 | 0 | 0 | – | **tehtud** |
| Eelpöördumised | SOL-PRE | 18/18 | 0 | 0 | – | **tehtud** |
| Abikuulutused | SOL-HELP | 13/13 | 0 | 0 | – | **tehtud** |
| Võrgustikutöö | SOL-NET | 13/13 | 0 | 0 | – | **tehtud** |
| Refleksioonid | SOL-REF | 9/9 | 0 | 0 | – | **tehtud** |
| Otsing | SOL-SEARCH | 7/7 | 0 | 0 | – | **tehtud** |
| Teenuseosutaja profiil | SOL-SPROF | 15/15 | 0 | 0 | – | **tehtud** |
| Dokumendi koostamine | SOL-COMP | 5/5 | 0 | 0 | – | **tehtud**, 5 jätkufailist |
| Materjalid | SOL-MAT | 13/13 | 0 | 0 | – | **tehtud**, 13 jätkufailist |
| Minu jagamised | SOL-SHARE | 7/7 | 0 | 0 | – | **tehtud**, 7 jätkufailist |
| Teenusekaart | SOL-SMAP | 9/9 | 0 | 0 | – | **tehtud**, 9 jätkufailist |
| Funktsioonideülene lõpetusring | SOL-XFUNC | 3/3 | 0 | 0 | – | **tehtud**, 3 jätkufailist |

### PARTIAL leiud peatükkide kaupa

### DONE leiud peatükkide kaupa

**Skeemi ja Prisma mudeli vastavus** (`SOL-SCHEMA`, 1/1)

- `SOL-SCHEMA-01` P0 — kohtumise märkme kirjet EI SAA päris andmebaasis luua — DONE — parandus, negatiivkontroll ja väravatest.

**Build** (`SOL-BUILD`, 1/1)

- `SOL-BUILD-01` P2 — projekti Webpack production-build ei kompileeru — DONE.

**Autentimine ja autoriseerimine** (`SOL-AUTH`, 15/15)

- `SOL-AUTH-01` P1 — ootamatu andmebaasiviga jätab JWT varasemad õigused kehtima — DONE — kood ja testid; runtime: not_run.
- `SOL-AUTH-02` P2 — aktiivsete sessioonide ülempiir ei ole paralleelsete sisselogimiste korral atomaarne — DONE — kaasa arvatud päris PostgreSQL-i runtime.
- `SOL-AUTH-03` P1 — konto taastamise ja e-posti kinnitamise bearer-tokenid on andmebaasis toorkujul — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-04` P1 — e-posti vahetuse lingi pelk avamine muudab konto identiteeti — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-05` P1 — asendatud e-posti vahetustoken võib pooleliolevas päringus siiski võita — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-06` P2 — e-posti vahetuse resend tühistab vana lingi enne uue kirja kohaletoimetamist ja raporteerib mailerivea eduna — DONE. Migratsiooni ei ole vaja, outbox'i ei ehitatud.
- `SOL-AUTH-07` P1 — profiili PIN-i muutus ei tühista enne muudatust väljastatud ajutisi sisselogimisvolitusi — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-08` P1 — kirjalinki automaatselt avav skanner võib ründaja PIN-sisselogimise teise faktori kinnitada — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-09` P1 — lühikese PIN-i brute-force kaitse on protsessimälus ja kliendi IP-päiseid usaldav — DONE. VAJAB MIGRATSIOONI (`20260811210000`, uus tabel
- `SOL-AUTH-10` P2 — login-step1 avaldab, kas e-posti aadressiga konto eksisteerib — DONE. Migratsiooni ei ole vaja (tuli koos SOL-AUTH-09 plokiga, mille
- `SOL-AUTH-11` P2 — üks kinnitatud temp-token võib enne sessiooni claim'i luua korduvalt usaldatud seadmeid — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-12` P1 — puuduva avaliku baas-URL-i korral saab login-kirja hosti päringupäisega mürgitada — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-13` P2 — login-lingi resend tühistab vana lingi enne uue kirja õnnestumist — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-14` P1 — ühe seadme logout ei garanteeri kopeeritud JWT tühistamist — DONE. Migratsiooni ei ole vaja.
- `SOL-AUTH-15` P2 — paralleelsed paroolitaaste päringud võivad mõlemad välja saadetud lingid tühistada — DONE. Vajab migratsiooni (`20260811220000`, uus tabel

**Juhtumitöö (JTA-V1)** (`SOL-CW`, 20/20)

- `SOL-CW-01` P2 — tasulise juhtumitöö UI ja serveri ligipääsureegel räägivad eri tõde — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-02` P2 — juhtumitöö suletud lehed ei ole tõendatult olematust marsruudist eristamatud — DONE — koos päris production-build'i runtime-tõendiga.
- `SOL-CW-03` P2 — READ_ONLY ja ARCHIVED juhtumite mustandid jäävad tegevuslauale — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-04` P1 — ülekandesündmus võib pärast edukat tehingut jäädavalt kaduda — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-05` P2 — uus kopeerimine võib kirjutamata kopeerimisauditi üle kirjutada — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-06` P2 — kopeerimisauditi idempotentsusvõti ei kontrolli algse payload’i vastavust — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-07` P1 — retention-hoiatuste fikseeritud batch võib uuemad juhtumid näljutada — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-08` P2 — tundmatu `retentionState` muutub kliendivea asemel 500-ks — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-09` P2 — URL-i olek ei toeta lubatud brauseri tagasinuppu — DONE — URL, vaade ja päris brauseriajalugu taastuvad kooskõlaliselt.
- `SOL-CW-10` P3 — „Näita rohkem” lubab paralleelseid sama kursori päringuid — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-11` P1 — tagasivõetud või saatmata päritoluobjektist saab endiselt juhtumi luua — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-12` P2 — juhtumi loomise kordus võib tekitada ühest lähteobjektist mitu juhtumit — DONE — kood, migratsioon ja testid; migratsiooniahel tõendatud päris PostgreSQL-i vastu, rakenduse runtime: not_run.
- `SOL-CW-13` P2 — „aktiivsed ettevalmistused” ei loe kohtumise ettevalmistusi — DONE — kood ja testid; runtime: not_run.
- `SOL-CW-14` P1 — casework'i säilitustöö ajastatud käivitamine ei ole tõendatud — DONE — omaniku kinnitatud säilituspoliitika on koodis, kasutajatekstides, privaatsusteavituses ja raamlepingus vastuoludeta; hallatav taimer on tootmises aktiveeritud ning kontrollitud systemd-jooks, tervisesond ja järgmine ajastus on tõendatud.
- `SOL-CW-15` P1 — kohtumise „kustutamatu” märkme sisu saab jäljetult muuta ja täielikult eemaldada — DONE — kood, migratsioon ja testid; migratsiooniahel tõendatud päris PostgreSQL-i vastu, rakenduse runtime: not_run.
- `SOL-CW-16` P1 — STAR2 kopeerimisaudit ei ole seotud kopeeritud tekstiversiooniga — DONE — kood, migratsioon ja testid; migratsiooniahel tõendatud päris PostgreSQL-i vastu, rakenduse runtime: not_run.
- `SOL-CW-17` P2 — workbench'i rohelised privaatsustestid ei läbi kahte uut sektsiooni — DONE — testid; tootmiskoodi see leid ei muutnud.
- `SOL-CW-18` P2 — workbench'i timeout ei lõpeta aegunud päringuid — DONE — kood, testid ja KOORMUSSOND päris PostgreSQL-i vastu; rakenduse brauseri-runtime: not_run.
- `SOL-CW-19` P1 — töötaja konto kustutamine hävitab kogu juhtumitöö ja selle auditid kohe — DONE — kehtiv kanooniline leping määrab CaseWorkAssisti töötaja rangelt isiklikuks töömaterjaliks; konto kustutus eemaldab selle tervikuna, organisatsiooni ametlik tööajalugu ja sisuvaba kustutustõend säilivad ning töötaja saab oma juhtumitöö enne kustutust andmekoopiasse.
- `SOL-CW-20` P2 — juhtumiloendi cursor tugineb muutlikule järjestusväljale — DONE — kood, testid ja päris PostgreSQL-i sond; rakenduse brauseri-runtime: not_run.

**RAG-i admin ja failihaldus** (`SOL-RAGADMIN`, 4/4)

- `SOL-RAGADMIN-01` P1 — faili metadata ja failisüsteem võivad asendamisel või kustutamisel lahkneda — DONE — protokoll, neli rada, retry-rada ja veasüstetestid; rakenduse runtime: not_run.
- `SOL-RAGADMIN-02` P1 — KOV RAG reset raporteerib edu ka kustutamata dokumentide korral — DONE — protokoll, kolm raja koristus, püsiv järjekord ja aus UI; rakenduse runtime: not_run.
- `SOL-RAGADMIN-03` P1 — `INGESTING` lukk ei ole atomaarne ega taastuv — DONE — claim + lease, lepitus, kolm rada, migratsioon, 17 testi ja 21/21 päris PostgreSQL-i sond; rakenduse runtime: not_run.
- `SOL-RAGADMIN-04` P2 — hävitav RAG reset ei seo dry-run plaani serveripoolse kinnitusega — DONE — jagatud värav, sõrmejälg täisloendina, ühekordne broneering ja 13 testi; rakenduse runtime: not_run.

**Organisatsioonid ja skoop** (`SOL-ORG`, 19/19)

- `SOL-ORG-01` P1 — töötaja kaudu tuletatud graafikuskoop lekib mitme organisatsiooni töö üle tenantide piiri — DONE — kood, migratsioon ja testid; tõendatud päris PostgreSQL-i vastu (`npm run slog:org:probe` 19/19).
- `SOL-ORG-02` P1 — graafiku kirjutusrada möödub peatatud organisatsiooni ja mooduli väravast — DONE — kood ja testid; tõendatud päris PostgreSQL-i vastu (`npm run slog:org:probe` 24/24).
- `SOL-ORG-03` P1 — töö määramine võib õnnestuda ilma kohustusliku auditijäljeta — DONE — kood (SOL-SLOG-18), veasüstetestid ja päris PostgreSQL-i tagasikerimine (`npm run slog:org:probe` 30/30).
- `SOL-ORG-04` P2 — üksuse capability ei kata graafikus lubatud alampuud — DONE — kood ja testid; tõendatud päris PostgreSQL-i vastu (`npm run slog:org:probe` 34/34).
- `SOL-ORG-05` P1 — kohaplaani limiiti ja lõpetamist saab paralleelse kohaandmisega rikkuda — DONE — kood ja paralleelsussond (`npm run org:seat:probe` 26/26; vana koodi vastu 10 punast).
- `SOL-ORG-06` P1 — sponsorluse vastuvõtmine ja tühistamine võivad anda vastuolulise lõppseisu — DONE — kood ja paralleelsussond (`npm run org:sponsor:probe` 33/33; vana koodi vastu 10 punast).
- `SOL-ORG-07` P2 — organisatsiooni sponsoreeritud tellimus kuvatakse kasutajale omamaksena — DONE — kood ja testid.
- `SOL-ORG-08` P1 — suletud või tagasivõetud pöördumise saab uuesti töötajale avada — DONE — kood, testid ja võistlussond (`npm run org:inbox:probe` 51/51).
- `SOL-ORG-09` P1 — tagasivõetud liikmekutse võib samaaegse vastuvõtmisega siiski õigused anda — DONE — kood ja paralleelsussond (`npm run org:invite:probe` 38/38; vana koodi vastu 14 punast).
- `SOL-ORG-10` P1 — offboarding võib lõppeda aktiivse töö või kohaga — DONE — kood ja paralleelsussond (`npm run org:offboard:probe` 39/39; vana koodi vastu 13 punast).
- `SOL-ORG-11` P1 — viimase organisatsiooniomaniku õiguse saab eemaldada — DONE — kood ja sond (`npm run org:offboard:probe` 48/48).
- `SOL-ORG-12` P1 — paralleelne olekusiire võib arhiveeritud organisatsiooni taas aktiveerida — DONE — kood ja sond (`npm run org:offboard:probe` 60/60; vana koodi vastu 6 punast).
- `SOL-ORG-18` P1 — konto kustutus kas jätab organisatsiooni omanikuta või ebaõnnestub ajaloolise töö tõttu — DONE — konto kustutuse eelkontroll kasutab sama organisatsiooni→liikmesuse lukujärjekorda kui offboarding ja tagastab viimase omaniku või elava töö puhul enne ligipääsu sulgemist parandatava 409 põhjuse. Lõplik User-kustutustehing kordab kontrolle luku all, lõpetab aktiivse koha, capability'd ja üksuseseosed, kirjutab kaks append-only auditifakti ning säilitab liikmesuse `ENDED` SetNull-tombstone'ina, nii et lõpetatud töö FK ei blokeeri. `npm run org:account-lifecycle:probe` läbis ajutises päris PostgreSQL-is 12/12: viimane omanik, kaks omanikku, elav/lõpetatud töö, aktiivne koht, toe- ja aruandejagamise read, idempotentne retry ning assign-vs-delete mõlemad lukujärjekorrad; orvu, kadunud ajalugu ega poolikut lõppseisu ei jäänud.
- `SOL-ORG-19` P2 — kasutaja andmekoopia jätab organisatsiooniliikmesuse, õigused ja kohaajaloo välja — DONE — kinnises andmekoopia registris on nüüd `organization_memberships` omanikuvaade. Iga rida sisaldab minimaalset organisatsiooniviidet/nime, liikmesuse staatust, seatRole'i, jobTitle'it ja aegu ning ainult küsija enda üksuse-, capability- ja kohaajaloo elutsüklit; teiste liikmete identiteedid, määramised, vabatekstilised põhjused ja organisatsiooni töövara on välistatud. Sihttestid kontrollivad owner-filtrit ja registrilepingut. Sama päris PostgreSQL-i sond võrdles aktiivse liikmesuse/õiguse/koha koopiat DB-ga ning tõendas järeltulija identiteedi ja ajaloolise töö puudumise koopiast vahetult enne konto kustutust.
- `SOL-ORG-13` P1 — auditi vaade ja organisatsiooni eksport kärbivad vastutusjälje vaikides — DONE — auditivaade kasutab stabiilset `(createdAt,id)` cursorit koos serveri `total`/`hasMore`-ga ning organisatsiooni eksport läbib kogu auditi või katkeb fail-closed; manifest kannab täielikkust ja rea arvu. `npm run org:audit:probe` 14/14 päris PostgreSQL-is (205 rida, võrdsed ajatemplid, esimene ja viimane säilisid, cleanup 0/0); käitumistest 4/4, vana koodi vastas puuduva täieliku lehitsemislepingu tõttu punane; `TZ=UTC npm test` 4182/4182.
- `SOL-ORG-14` P2 — vastuvõtu-, toe- ja aruandeloendid kaotavad vanemad aktiivsed read — DONE — vastuvõtu-, toe-, aruande-, kutse- ja sponsorlusloendid kasutavad nüüd stabiilset liitcursorit, serveri filtreid ja kasutajale nähtavat jätkamistoimingut. Sihttest 5/5 katab staatuse, saatja märgitud kiireloomulisuse, tähtaja ületuse ja avamata filtrid ning 201/101/201 rea duplikaadivaba läbimise; `npm run org:operational-pagination:probe` 6/6 kinnitas samad kolm piiri päris PostgreSQL-is ja koristas kõik sünteetilised read (0/0/0). Peatükilõpu `TZ=UTC npm test` 4199/4199; autentitud brauserivoog `not_run`.
- `SOL-ORG-15` P1 — toeavalduse terminalseid seise saab otsese API-kutsega tagasi pöörata — DONE — toeavalduse `SENT → OPENED/RECALLED`, `SENT/OPENED → CLOSED` ja `OPENED → CORRECTED` siirded on rea `FOR UPDATE` luku all ning iga kirjutus nõuab lubatud lähteseisu ja sama `updatedAt` revisjoni. `RECALLED`, `CORRECTED` ja `CLOSED` ei pöördu enam ühegi mutatsiooniga tagasi; kaotaja saab 409 ja audit tekib ainult võitjale. `npm run org:support-share:probe` 12/12 päris PostgreSQL-is kattis open-vs-recall, close-vs-correct ja topelt-close võidujooksud ning cleanup jäi `shares=0 audits=0 org=0 user=0`; terminalsete tagasipöörete sihttest 4/4. Peatükilõpu `TZ=UTC npm test` 4199/4199; autentitud brauserivoog `not_run`.
- `SOL-ORG-16` P2 — aruande „avatud” seis võib tekkida enne ühegi baidi väljastamist — DONE — aruande GET autoriseerib, loeb ja kontrollib enne väljastust külmutatud faili suuruse ning SHA-256 räsi, kirjutab kohustusliku `access_attempted` auditi ja loob `OPENED` seisu alles kogu vastuse vastuvõtu järel allkirjastatud delivery-kinnitusega. Audititõrke korral ei väljasta GET ühtegi faili baiti; pahatahtlikult kinnitamata jäetud täielik lugemine jääb ausalt ligipääsukatseks, mitte avatuks. Eelvaade ja allalaadimine kinnitavad serverile alles pärast täielikku `json()`/`blob()` lugemist; katkenud stream ei kinnita ega muuda UI seisu. Kinnitus lukustab jagamisrea ning kirjutab `OPENED` ja delivered-tähendusega auditi samas tehingus, seega selle audititõrge pöörab seisu tagasi. Veasüsti sihttest 7/7 kattis puuduva faili, räsivea, streami katkestuse, mõlema auditikihi vea ja eduka tarne; `npm run org:report-delivery:probe` 5/5 kinnitas OPENED-aatomilisuse päris PostgreSQL-is, cleanup `shares=0 audits=0 org=0 user=0`. Peatükilõpu `TZ=UTC npm test` 4199/4199; autentitud brauserivoog `not_run`.
- `SOL-ORG-17` P2 — organisatsiooni loomisel puuduvad idempotentsus ja serveri rate-limit — DONE — organisatsiooni loomine nõuab kasutaja `clientActionId`-d, mille `(createdByUserId, creationClientActionId)` unikaalsus ja payload-räsi on andmebaasi leping; sama võtme eri sisu annab 409. Muutmata vormi retry kasutab kliendis sama võtit, route rakendab kasutajapõhist ja olemasolul usaldatud-IP põhist tunnist rate-limit’i. `npm run org:create:probe` 7/7 saatis neli paralleelpäringut ning tõendas ühe organisatsiooni, ühe liikmesuse, ühe grantide komplekti ja ühe auditi; konflikt ei loonud teist rida, cleanup `org=0 audits=0 user=0`. Rate-limit’i ja kliendi retry sihttest 3/3; migratsioon `20260812200000_sol_org_17_creation_idempotency` rakendus kohalikus PostgreSQL-is ja `prisma migrate status` on puhas. Peatükilõpu `TZ=UTC npm test` 4199/4199, lint 0 viga, i18n puhas; autentitud brauserivoog `not_run`.

**Välitöö** (`SOL-FIELD`, 17/17)

- `SOL-FIELD-01` P1 — saatmata kohalik sisu võib kustuda ilma kolme kasutajale näidatud hoiatuseta — DONE — kood ja testid; brauserikiht NOT_PROVEN (vt allpool).
- `SOL-FIELD-02` P1 — tundlikud külastuspaketid ei läbi automaatset kohalikku retention’it — DONE — kood, testid ja runtime-tõend PÄRIS IndexedDB vastu.
- `SOL-FIELD-03` P1 — välitöö kohustuslik audit ei kuulu põhitehingusse ja võib vaikselt kaduda — DONE — kood ja testid; veasüstiga tõendatud, ilma globaalse ühenduseta.
- `SOL-FIELD-04` P1 — võrguühenduseta saabumise/lahkumise markerit ei salvestata ja flush võib vea järel selle kustutada — DONE — kood, testid ja runtime-tõend päris IndexedDB vastu.
- `SOL-FIELD-05` P2 — transkripti kinnituse serveriviga peidetakse ning toorheli kustutuskell ei käivitu — DONE — kood ja testid.
- `SOL-FIELD-06` P2 — lubatud automaatne retry/backoff ei käivitu tähtaja saabumisel — DONE — kood ja testid võltskella all.
- `SOL-FIELD-J-01` P1 — külastuse saab sulgeda lahendamata `FAILED/CONFLICT` sisuga ja see muutub serverisse saatmatuks — DONE — sulgemisvärav kasutab nüüd ühtset blocker-lepingut ning blokeerib `DEVICE_ONLY`, `QUEUED`, `UPLOADING`, `FAILED`, `CONFLICT` ja auth-pargi. Suletud külastuse kontrollitud recovery-import võtab vastu ainult tõendatult enne `closedAt` loodud seadmekirje, märgib `recoveryImportedAt`, on idempotentne ja kirjutab append-only auditi; hiline uus sisu jääb 409 taha. Negatiivkontroll kukkus vana koodi peal puuduva continuity-helperiga. Sihttestid läbisid, päris PostgreSQL-i close-vs-upload/recovery sond läbis 8/8; runtime: Chromiumi praeguse seadme sulgemisvärav staatiliselt/testiga tõendatud, mitme füüsilise seadme runtime not_run.
- `SOL-FIELD-J-02` P1 — serverisse jõudnud märkmed kaovad omanikuvaatest ning „Eemalda” kustutab ainult seadmekoopia — DONE — järeltöö ühendab nüüd serveri- ja seadmekirjed nähtavaks owner-skoobitud loendiks koos päritolu, revisjoni, konflikti ja asukohaga. Sõnastus eristab seadmekoopia eemaldamist serverikustutusest; serverikustutus on DB-auditiga üks tehing ning nõusolekukirje lubab ainult auditeeritud tagasivõtmist. Üleandmine kasutab sama nähtava serveriloendi ID-sid ja detail ei kärbi enam vaikse 500 piiriga. Sihttestid katsid local-copy puudumise, kustutuse/auditi, nõusoleku ja 501 märget; PostgreSQL-i sond kinnitas suletud read-only semantika ja täieliku detaili. runtime: browseri serverikirje muutmis-/kustutusklikk not_run.
- `SOL-FIELD-J-03` P2 — offline-avaleht ei leia seadmesse võetud külastusi ja online-loend lõpeb 50 rea juures — DONE — `/valitoo` loeb IndexedDB-st kõik dekrüptitud ja retention'iga kehtivad paketiprojektsioonid ning kasutab neid ka siis, kui brauser teatab ekslikult `navigator.onLine=true`, aga võrk ei vasta. Online-loendil on muutumatu `createdAt,id` cursor, `nextCursor`, ausad avatud/suletud koguarvud ja „Näita rohkem”; detaili 500/200 vaiksed laed eemaldati. Päris PostgreSQL-i sond läbis 8/8, sh 51+ rida koos lehtede vahel muutuva `updatedAt`-iga ja 501+ märget. Tootmis-buildi päris Chromiumi fresh offline reload kuvas kaks krüptitud paketti ja jättis süstitud aegunud paketi välja; sünteetilised kasutajad/visiidid koristati. runtime: Android/iOS seadmemaatriks not_run.
- `SOL-FIELD-J-04` P1 — üleandmise kordus loob duplikaadid ja kahe sihtkoha päring võib jääda pooleldi õnnestunuks — DONE — UI hoiab kanoonilise payload'i juures püsivat `clientActionId`-d, server seob võtme visiidi ja SHA-256 sõrmejäljega ning `FieldVisitHandover` kannab artefakti ja eelpöördumise eraldi `PENDING/FAILED/DONE` seisu. Artefakt kasutab lisaks DB-unikaalset idempotentsusvõtit; eelpöördumise append, tempel, audit ja saga-seis commit'ivad sama ruumiluku all. Sama võti/sama sisu tagastab samad siht-ID-d, eri sisu annab 409 ja osaline viga jätkab retry'l ainult puuduvat sihti. Sihttestid katsid vastuse kao, stale/404, auditirea vea ja hash-konflikti; päris PostgreSQL-i sondi kaks paralleelset request'i lõid ühe artefakti ning osalise vea retry ei dubleerinud valmis sihti. runtime: browser not_run.
- `SOL-FIELD-J-05` P1 — fotonõusolekust saab mööduda kliendi juhitava `documentOnly` lipuga — DONE — foto sisend on nüüd lukus, kuni leidub kehtiv serveri nõusolek või töötaja on teadlikult kinnitanud kliendi dokumendipalve ja kirjutanud kuni 500-märgilise põhjuse. Server ei usalda enam `documentOnly` boole'i üksinda: erand vajab eraldi kinnitust+põhjust, talletub `captureBasis/documentRequestReason/documentRequestAt` väljadele ning kirjutab samas tehingus ID-põhise auditi. Projektsioon näitab alust ja hilisem attachment'i kustutus võtab erandi koos failiga tagasi. Negatiivtestid katsid puuduva, DEVICE_ONLY-laadse, tagasivõetud ja vale liigi nõusoleku, otse-API lipu, erandi auditi ning kustutuse. runtime: browser camera not_run.
- `SOL-FIELD-J-06` P1 — manuse faili ja DB terviklikkus pole vea järel taastatav — DONE — upload loob enne faili püsiva `DataDeletionJob` staging-claim'i, DB-s sündiv attachment on avaldamiseni `PENDING_PUBLISH` ning download/transkriptsioon/OCR lubavad ainult `ACTIVE` kandjat. Idempotentne reconciler lõpetab rename'i või koristab orvu ka restardi järel. Kustutus märgib rea esmalt `DELETE_PENDING`-iks ja loob püsiva töö; unlink, DB-delete ja kohustuslik audit on korduskatsega lõpetatavad, mistõttu puuduvale failile osutavat aktiivset rida ei teki. Veasüstetestid katkestasid DB create'i, rename'i, unlink'i ning lõpliku DB/auditi ja tõendasid pärast uut reconciler-käiku ainult tervikliku ACTIVE manuse või lõpetatud kustutuse. Päris PostgreSQL-i sond jättis tööjärjekorra lõpus null `pending/failed` failiülesannet. runtime: filesystem injection + PostgreSQL, production filesystem not_run.
- `SOL-FIELD-J-07` P2 — Välitöö upload avab `SOL-DOC-07` parandatud kvoodivea uuel rajal — DONE — Välitöö foto ja heli loovad `UserDocument` + `FieldVisitAttachment` read nüüd olemasoleva `withStorageQuota()` kasutajapõhise advisory-lock'i all ning mõõtmine kasutab sama süstitud `tx` klienti. Staging-claim sünnib enne faili, kaotaja koristatakse püsiva töö kaudu. Päris PostgreSQL-i sond täitis 100 MiB sotsiaaltöötaja kvoodi kahe 20-baidise kirjutuse kaugusele ja käivitas paralleelselt eri visiitide foto, heli ning tavadokumendi: 2/3 võitis, kolmas sai 413, lõppsumma jäi piirile või alla, failide arv oli täpselt kaks ja ühtegi `pending/failed` FIELD failitööd ei jäänud. runtime: PostgreSQL 12/12 PASS.
- `SOL-FIELD-J-08` P1 — mikrofon võib pärast vaate sulgemist edasi salvestada ja kohalikul salvestusel puudub kestuse/mahu piir — DONE — `MediaRecorder` ja `MediaStream` elavad nüüd kontrollitud ref'ides; üks idempotentne cleanup peatab track'id `pagehide`, peidetud dokumendi, Reacti unmount/route-vahetuse, recorder'i vea ja käsitsi lõpetamise korral. Ühesekundiline `timeslice` võimaldab mahu kasvu enne suure blobi teket piirata: kohalik leping on 10 minutit / 25 MiB, piiri ületavat chunk'i ei lisata ning UI näitab jooksvat kestust ja piiri. Piiril peatatud salvestus jääb tavaliseks kasutaja kontrollitavaks DEVICE_ONLY helimustandiks; peidetud või suletud vaate salvestus lõpetatakse ja discard'itakse, et varjatud lisasekundeid ei säiliks. Sihttestid tõendasid piiriarvutuse ning kõigi cleanup-piiride olemasolu. runtime: Android Chrome ja iOS Safari/PWA not_run (pärisseadmed pole selles töökeskkonnas kättesaadavad).
- `SOL-FIELD-J-09` P1 — kasutaja andmekoopia jätab külastused, märkmed, nõusolekud ja ohutussignaali välja — DONE — andmekoopia registris on versioonitud, owner-skoobitud `field_visits` pind, mis kannab külastuse meta- ja ajavälju, märkmeid koos päritolu/konfliktiga, nõusoleku minimaaltõendit ja tagasivõttu, attachment'i tehnilisi seoseid ja alusvälju, üleandmise per-target seisu ning OCR-mustandeid. Manifest märgib pinna kolmandate isikute sisu sisaldavaks professionaalseks kirjeks; eksport ei ava võõra omaniku ridu ega `storagePath`-i. Sihttest ehitas päris ZIP-i ja tõendas nii nõutud väljad kui mõlemad negatiivpiirid. runtime: ZIP generation PASS; browser not_required.
- `SOL-FIELD-J-10` P1 — turvasignaali lahendusteade võib vaikselt saatmata jääda ning eskalatsioon võib DB-vea järel korduda — DONE — eskalatsioon ja lahendusteade kasutavad nüüd püsivat outbox'i, dedupe-võtit ning stabiilset Message-ID-d. Visiidi `SENT` ja ajatempel tekivad ainult outbox'i kinnitatud `SENT` järel; puuduv saaja/transport muutub nähtavaks `FAILED`-iks ning SMTP timeout jääb `UNKNOWN`/`AMBIGUOUS` seisu ilma tundliku kirja pimeda korduseta. Reconciler taastab worker-crash'i järel outbox'i tõe visiidile. Päris PostgreSQL-i sond tõendas kahe paralleelse sweep'i ühe kirja, lahendusteate ühe kirja, puuduva transpordi, timeout'i, crash-recovery ja dedupe'i; kogu ühine J10/J11 sond 14/14 PASS.
- `SOL-FIELD-J-11` P2 — OCR-käsku saab paralleelselt piiranguta käivitada — DONE — OCR-i töö on püsiv `FieldOcrJob`, mille idempotentsusvõti on foto attachment + sisu-SHA; valmis tulemus tuleb reload'i järel vahemälust ning nurjunud töö jääb taastatava olekuga andmebaasi. Omaniku ja IP püsiv minutipiir kasutab eraldi PostgreSQL-i lukke, globaalne protsessipiir advisory-lock'i pesasid ning üle piiri vastus on aus 429 koos `Retry-After` päisega. Päris PostgreSQL-i mitme ühenduse sond tõendas sama foto üht arvutust/ühte job ID-d, eri fotode maksimaalset kahte paralleeltööd, busy-429 ja rate-limit-429; kogu ühine J10/J11 sond 14/14 PASS.

**Dokumendid ja AI-kasutus** (`SOL-DOC`, 15/15)

- `SOL-DOC-01` P1 — AI-kasutus arvestatakse enne püsivat või kasutajale tagastatud tulemust — DONE — kood ja testid; runtime: not_run.
- `SOL-DOC-02` P1 — transkriptsiooni ja transkripti kokkuvõtte rajad mööduvad kasutuslimiitidest — DONE — kood ja testid; runtime: not_run.
- `SOL-DOC-03` P1 — paralleelne muutmine saab FINAL-artefakti pärast kinnitamist üle kirjutada — DONE — koos päris PostgreSQL-i runtime-tõendiga (33/33).
- `SOL-DOC-04` P1 — transkripti fail ja andmebaas võivad osalise vea järel eri sisu näidata — DONE — koos päris PostgreSQL-i ja päris hoidla runtime-tõendiga (17/17).
- `SOL-DOC-05` P2 — kolme refinement'i piirang pole paralleelsete päringute korral jõustatud — DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).
- `SOL-DOC-06` P1 — sama helifaili paralleelne transkribeerimine teeb mitu kallist tööd ja mitu transkripti — DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).
- `SOL-DOC-07` P2 — faili- ja salvestuskvoodid on paralleelselt ületatavad — DONE — koos päris PostgreSQL-i runtime-tõendiga (8/8).
- `SOL-DOC-08` P1 — salvestatud analüüside sisu ei lähe salvestuskvoodi arvestusse — DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).
- `SOL-DOC-09` P2 — analüüsi salvestamise ja kustutamise auditikutsed ei loo auditirida — DONE — koos päris PostgreSQL-i runtime-tõendiga (10/10). VAJAB MIGRATSIOONI.
- `SOL-DOC-J-01` P2 — omanikuvaade peidab iga objektipere vanemad kui 50 kirjet — DONE — omanikuvaate neli objektiperet kasutavad nüüd oma serveripoolset koguarvu ja dünaamilist offset-paginatsiooni ning ühine „laadi vanemad objektid” toiming lisab järgmised lehed ID järgi duplikaadivabalt. Sama otsingutermin läheb kõigisse nelja API-sse enne count'i ja paginatsiooni, seega otsing ei piirdu enam esimese 50 reaga; 51. kirje jõuab samasse `renderRow` avamis-/allalaadimis-/kustutusrajale nagu esimene. Sihttest 3/3 lõi igasse peresse 51 kirjet, lisas kattuva lehe ja tõendas 204 unikaalse rea ning kõigi nelja 51. rea jõudmise ühtsesse tööruumi; dokumentide, analüüside ja uuringute otsingupäring valideeriti päris PostgreSQL-i vastu. Autentitud brauserivoog `not_run`; peatüki lõpu täissviit 4223/4223 PASS.
- `SOL-DOC-J-02` P1 — dokumendi paralleelsed muudatused kirjutavad vaikides üksteise üle — DONE — `UserDocument` PATCH nõuab nüüd kliendi nähtud `expectedUpdatedAt` versiooni ning kirjutab ühe tingimusliku `id + ownerId + updatedAt` CAS-lausega; kaotaja saab 409 koos värske dokumendiga. Sama CAS on staged transkripti faili avaldamise ees, seega konflikt koristab kandidaadi ja jätab vana faili puutumata. Kõik Dokumendid- ja Dokirežiimi PATCH-kliendid saadavad oma nähtud revisjoni ning võtavad 409 vastusest värske rea. Sihttestid 12/12 kattis CAS-i, kohustusliku revisjoni, staged rollback'i ja varasema failikoherentsuse; `npm run doc:mutation:probe` 10/10 päris PostgreSQL-is ja päris kettal kattis kaks rename'i, kaks transkripti PATCH-i ning `agentAllowed true/false` ristvõistluse, igas täpselt ühe võitja ja 409 kaotaja. DB/fail olid koherentsed, staged jääke 0 ja sünteetilise kasutaja cleanup 0; autentitud brauserivoog `not_run`, peatüki lõpu täissviit 4223/4223 PASS.
- `SOL-DOC-J-03` P1 — RAG-kasutusloa tagasivõtmine ei eemalda juba indekseeritud koopiat — DONE — `agentAllowed true → false` loob auditeeritud ja idempotentse püsiva `DataDeletionJob`-i enne kaugkatset, hoiab tõrke `failed`-ina taastatavana, blokeerib poolelioleva eemaldamise ajal korduslubamise/ingest'i ning viib kinnitatud retry järel nii töö kui `metadata.ragRemoval` seisu `done`-iks. Turvajärelkontroll sulges sama PATCH-i sisuvahetuse erijuhu: vahetu kustutus kasutab nüüd alati enne mutatsiooni töösse salvestatud `externalRef`-i, mitte uue sisu SHA-st tuletatud identiteeti; vana koodi peal punane sihttest kinnitas vana ja uue SHA lahknemise. `npm run doc:rag-removal:live-probe` PASS tõendas isoleeritud päris runtime'is kogu välisotsa: uus ajutine PostgreSQL läbis täieliku migratsiooniahela; päris kohalik `rag-service` kasutas eraldatud Chroma salvestust ja deterministlikku ainult loopback-embeddingut, mille sõltuvused taastati ainult kohalikust wheel-cache'ist (`network=unused`). Sünteetiline ingest oli otsingus olemas, esimene tahtlik kustutustõrge jättis sama job'i retry'ks, päris retry andis GET-is `DELETED + CLEAN + chunks=0` tombstone'i ja scoped search'is 0 tulemust, värske korduslubamine ingestis sama koherentse versiooni uuesti ning konto kustutus eemaldas selle uuesti (`runtime=PROVEN ingest=present disable_retry=absent reingest=present account_delete=absent`). Lõpukoristus kinnitas nii workeris `remote=absent users=0 documents=0 jobs=0 audits=0` kui orkestreerijas `database=0 rag_storage=0`; embedding-stub sai 5 lubatud ja 0 ootamatut päringut. Sihttestid 22/22 PASS katsid püsiva töö, tõrke/retry, konto kustutuse ja range 404 või null-chunk clean-tombstone lepingu; tootmisandmeid, tootmis-RAG-i ega välisvõrku ei kasutatud. `NOT_PROVEN`: puudub.
- `SOL-DOC-J-04` P1 — salvestatud analüüsid puuduvad kasutaja tervikandmekoopiast — DONE — `SavedAnalysis` on nüüd andmekoopia eraldi versioonitud `saved_analyses` allowlist-pind, mis ekspordib ainult omaniku analüüsi ID, pealkirja, sisu, disclaimer'i, ajatemplid ja allikadokumendi ID-d. Kustutatud allika ID säilib päritoluviitena, kuid võõra omaniku rida ei läbi `ownerId` filtrit; manifest loendab pinna read eraldi ja täpselt. Andmekoopia sihttestid 12/12 ning `npm run doc:saved-analysis-export:probe` 6/6 päris PostgreSQL-is tõendas ühe omaniku ja ühe võõra analüüsiga omaniku sisu, disclaimer'i, kustutatud allikaviite, võõra sisu puudumise, versiooni `1.0` ja manifesti `recordCount=1`; cleanup `users=0`.
- `SOL-DOC-J-05` P2 — puuduv algfail ei muuda andmekoopiat veaks ega ausalt osaliseks — DONE — Dokumendid-pinna ükskõik milline algfaili lugemisviga katkestab nüüd kogu andmekoopia töö stabiilse `documentId + reason` failureCode'iga; märgistamata READY koopiat ega ZIP-faili ei teki. Põhjused eristavad `missing`, `access_denied`, `containment` ja muud `read_failed` vead, kuid storage path'i ega toore erindi teksti ei lekitata. Veasüsti sihttestid 13/13 katsid ENOENT, EACCES, containment'i ja keset lugemist tekkinud tõrke ning FAILED-worker'i; `npm run doc:missing-export-file:probe` 6/6 päris PostgreSQL-is kinnitas FAILED seisu, masinloetava koodi, puuduva outputPath/ZIP-i ja kohustusliku `DATA_EXPORT_FAILED` auditi, cleanup `users=0`.
- `SOL-DOC-J-06` P2 — dokumendi allalaadimise ja artefakti kustutuse audit võib vaikides puududa — DONE — dokumendi ja FINAL-artefakti allalaadimine kasutavad nüüd kohustuslikku `writeDocumentAudit()` rada pärast baitide valmimist, kuid enne `Response` loomist; audititõrge katkestab väljastuse. Artefakti kustutuse audit kirjutatakse enne DELETE-i ja mõlemad on samas tehingus: audititõrke korral rida säilib, delete-tõrke korral audit pöördub tagasi. Kuna FK `artifactId` muutub kustutamisel `SET NULL`-iks, jääb kustutatud artefakti stabiilne ID auditi metaossa `deletedArtifactId`. Sihttestid 5/5 katsid mõlema download-auditi veasüsti, vastuse järjekorra ning kustutuse edu/tõrke; `npm run doc:artifact-audit:probe` 5/5 päris PostgreSQL-is tõendas audititõrke järel alles artefakti ja 0 auditit ning eduka tehingu järel 0 artefakti ja täpselt ühe stabiilse ID-ga auditi, cleanup `users=0`.

**Uuringud** (`SOL-RES`, 7/7)

- `SOL-RES-01` P1 — kasutaja ei saa oma uuringut kustutada ja tellimuse lõpp sulgeb ka lugemise — DONE — koos päris PostgreSQL-i runtime-tõendiga (15/15).
- `SOL-RES-02` P1 — idempotentsusvõti seob ainult kasutusühiku, mitte uuringutöö — DONE — koos päris PostgreSQL-i runtime-tõendiga (21/21). VAJAB MIGRATSIOONI.
- `SOL-RES-03` P1 — worker-režiimis jääb päritoluprotsessi job lõpmatult vanasse olekusse — DONE — koos päris kaheprotsessilise runtime-tõendiga (8/8).
- `SOL-RES-04` P1 — lease'i kaotanud worker võib uuringut jätkata ja uue workeri tulemuse võita — DONE — fencing tõendatud kahe päris workeriga (9/9) ja kriteeriumi viimane
- `SOL-RES-05` P1 — vestlusse püsivalt salvestamise viga ei takista tasulise uuringu edukaks märkimist — DONE — koos päris PostgreSQL-i runtime-tõendiga (10/10).
- `SOL-RES-06` P1 — kasutuse lõplik commit/release on best-effort ja võib lõpptulemusest lahkneda — DONE — koos päris PostgreSQL-i runtime-tõendiga (13/13).
- `SOL-RES-07` P2 — soft-nav'i järel pole aktiivse uuringuga taasühendumise ega Stop'i kasutajateed — DONE — nõutud autentitud production-build brauserirada on päris ajutise PostgreSQL-i ja sünteetilise kohaliku kasutajaga tõendatud. Uuringu käivitamine muutis `ResearchJob`-ide arvu 0 → 1; kogu soft-nav'i, „Minu dokumentide” vaate ja vestlusse naasmise vältel jäi alles sama üks job samas vestluses ning võrgus oli täpselt üks loomise POST. Dokumentide tööruum ei avanud enam peidetud streami, vestlusse naasmine taastas progressi sama job ID GET-streamist ja Stop lõpetas sama serverirea olekuga `cancelled`. „Minu dokumentide” aktiivse rea „Ava vestluses” ja „Peata” kontrolliti samuti brauseris; rea Stop muutis oleku „Katkestatud”. Runtime paljastas ja commit `9e0912ba` parandas peidetud tööruumi duplikaatse SSE-tarbija. Production-build, sihttestid 57/57, ESLint ja diff-check on rohelised; väliseid OpenAI/RAG-kutseid ei tehtud.

**Koosolekukokkuvõtted** (`SOL-MEET`, 6/6)

- `SOL-MEET-01` P1 — snapshoti tõrge võib jätta koosolekukokkuvõtte igaveseks aktiivseks — DONE.
- `SOL-MEET-02` P1 — kokkuvõtte ühik commit'itakse enne kasutajale kuuluva dokumendi loomist — DONE — koos päris PostgreSQL-i runtime-tõendiga (12/12).
- `SOL-MEET-03` P1 — 30-minutilised tundlikud snapshotid võivad pärast restarti jääda tähtajatult alles — DONE.
- `SOL-MEET-04` P1 — ühe aktiivse töö piirang on paralleelsete POST-ide korral ületatav — DONE — koos päris PostgreSQL-i samaaegsustõendiga (16/16).
- `SOL-MEET-05` P1 — tundmatu audio kestus arvestatakse alati 60 sekundina ka pikema faili puhul — DONE.
- `SOL-MEET-06` P2 — väline veateade salvestatakse ja tagastatakse kasutajale puhastamata — DONE.

**Vestlus** (`SOL-CHAT`, 13/13)

- `SOL-CHAT-01` P1 — tasuline vestlusvastus commit'itakse enne püsivat vestlust ja salvestusviga raporteeritakse eduna — DONE — koos SOL-CHAT-02-ga üks plokk, sest neil on üks juur.
- `SOL-CHAT-02` P1 — kasutuse commit/release'i viga neelatakse alla ja vestlus jätkub vale arvestusseisuga — DONE — sama plokk mis SOL-CHAT-01, vt sealt tõendid.
- `SOL-CHAT-03` P1 — kliendi pöördel puudub stabiilne idempotentsusvõti ja Retry seos kaob — DONE — koos SOL-CHAT-04-ga üks plokk, sest mõlema kriteerium algab samast
- `SOL-CHAT-04` P1 — sama vestluse paralleelsed pöörded rikuvad järjekorda ja sessioonipiiri — DONE — sama plokk mis SOL-CHAT-03, vt sealt mudel ja sond.
- `SOL-CHAT-05` P1 — Stop võib provider'i `done` järel siiski commit'ida kasutajale kuvamata täisvastuse — DONE — kaks eraldi viga ühe pealkirja all.
- `SOL-CHAT-06` P2 — enneaegselt lõppenud SSE märgitakse kliendis edukalt lõpetatuks — DONE — kriteeriumi MÕLEMAD teed, mitte üks neist.
- `SOL-CHAT-07` P1 — platvormiadmin saab liikmesuseta suvalisse privaatsesse ruumi AI-sõnumi kirjutada — DONE — erand kustutatud ja kirjutuskohale antud oma värav.
- `SOL-CHAT-08` P1 — failianalüüsi valmis tulemus võib commit'i vea järel kaduda ja retry kulutab uue ühiku — DONE koodis, ÜKS KRITEERIUMI OSA TEADLIKULT TÄITMATA (vt allpool).
- `SOL-CHAT-09` P1 — efemeerne failianalüüs usaldab deklareeritud MIME-i ja tagastab piiramatu täisteksti — DONE, ÜKS KRITEERIUMI OSA NIMELISELT TEGEMATA (parseri timeout).
- `SOL-CHAT-10` P2 — vestluse ekspordi kohustuslik audit võib vaikselt puududa — DONE — fail-closed, sama valik mis SOL-DOC-09-l.
- `SOL-CHAT-11` P1 — üldine vestluse ID kandub konto ja rolli vahetusel valesse kasutajakonteksti — DONE — klient JA server, sest leid oli mõlemal pool.
- `SOL-CHAT-12` P2 — kattuvad ajaloo laadimised võivad uuema vestluse oleku vanema vastusega tagasi pöörata — DONE.
- `SOL-CHAT-13` P2 — ruumide külgriba laadimisviga näib tühja loendina ja asendatud päring võib uue laadimisoleku lõpetada — DONE — sama leping mõlemal rajal, mitte uus mehhanism.

**Hääl (STT/TTS)** (`SOL-VOICE`, 3/3)

- `SOL-VOICE-01` P1 — STT arvestus ei kasuta provider'i tegelikku kestust ja kliendil puudub idempotentsus — DONE, ühe kvalifikatsiooniga (vt viimane punkt). Migratsiooni ei ole vaja.
- `SOL-VOICE-02` P1 — STT ning Google/OpenAI TTS providerikutsetel puudub rakenduse timeout — DONE. Migratsiooni ei ole vaja.
- `SOL-VOICE-03` P2 — „Peata ettelugemine” ei katkesta pooleliolevat serverisünteesi — DONE, brauserikiht NOT_PROVEN. Migratsiooni ei ole vaja.

**Ruumid** (`SOL-ROOM`, 7/7)

- `SOL-ROOM-01` P1 — arhiveeritud ruum ei ole serveris tegelikult kirjutuskaitstud — DONE, HTTP-kiht NOT_PROVEN. Migratsiooni ei ole vaja.
- `SOL-ROOM-02` P1 — vana ruumi hiline laadimisvastus võib uues ruumis kuvada eelmise ruumi sõnumeid — DONE koos SOL-ROOM-03-ga, üks plokk. Migratsiooni ei ole vaja.
- `SOL-ROOM-03` P2 — sõnumihook lammutab SSE-ühenduse olekumuutustel ja võib 401/403 korral laadimistsüklisse minna — DONE koos SOL-ROOM-02-ga, üks plokk. Migratsiooni ei ole vaja.
- `SOL-ROOM-04` P1 — omanikuvahetus ja sihtliikme lahkumine võivad jätta ruumi aktiivse omanikuta — DONE koos SOL-ROOM-05-ga, üks plokk. Migratsiooni ei ole vaja.
- `SOL-ROOM-05` P1 — ruumi lõpetamise ja omanikuvahetuse kõrvalmõjud ei ole ühe ausa lõpptulemusega seotud — DONE koos SOL-ROOM-04-ga, üks plokk. Migratsiooni ei ole vaja.
- `SOL-ROOM-06` P1 — kokkuvõtte jagamine võib õnnestuda ilma hilisema privaatkoopia ja kinnitusringi kandjata — DONE. Migratsiooni ei ole vaja.
- `SOL-ROOM-07` P2 — enne ruumi lõppu lahkunud osaleja ei saa talle lubatud kokkuvõttekoopiat — DONE. Migratsiooni ei ole vaja.

**Kõned ja salvestus** (`SOL-CALL`, 13/13)

- `SOL-CALL-01` P0 — nõusoleku tagasivõtu järel võib egress edasi salvestada, kuigi API vastab eduga — DONE — tingimuslik lõppseis, kolm uut seisu, jagatud kinnitusloogika, püsiv taasproov ja 3 uut testi; rakenduse runtime: not_run.
- `SOL-CALL-02` P0 — salvestuse start võib võita hilise liituja või nõusoleku tagasivõtu ja alustada nõusolekuta — DONE — atomaarne claim, fencing-loend, tingimuslikud üleminekud ja 3 võidujooksutesti; rakenduse runtime: not_run.
- `SOL-CALL-03` P0 — provider võib salvestada ilma taastatava ACTIVE-seisuta — DONE — püsiv STARTING claim, kompensatsioon mõlemal DB-tõrkel, ruumipõhine orvukontroll ja 3 veasüstetesti; rakenduse runtime: not_run.
- `SOL-CALL-04` P1 — paralleelne salvestuse Start võib käivitada mitu egressi — DONE — katsepõhine failivõti ja idempotentne kordus; kaks varasemat märkust allpool jäävad ajalooks.
- `SOL-CALL-05` P1 — sama osaleja nõusolekurida võib paralleelselt dubleeruda — DONE — unikaalne indeks + üks jagatud `upsert`-tee, tõendatud päris PostgreSQL-is (`npm run call:consent:probe` 8/8).
- `SOL-CALL-06` P1 — salvestise kustutus ja retention raporteerivad edu ka kustutamata faili korral — DONE — astmeline `DELETE_PENDING` kustutus, mis on ise oma taasproovi allikas. Commit `74d5cc80`.
- `SOL-CALL-07` P2 — nõustunud osaleja saab „salvestis saadaval” teate, kuid fail kuulub ainult taotlejale — DONE — omaniku otsus on „ainult taotleja oma"; teade, saaja-verifitseerimine ja nõusolekutekst jõustavad nüüd ühte ja sama lepingut. Commit `4d2df0af`.
- `SOL-CALL-08` P2 — osalejapiir ja kõne algseis pole paralleelselt ega veasüstiga usaldusväärsed — DONE — koht võetakse kõneluku all, kõne sünnib ühes tehingus; `npm run call:seat:probe` 12/12 päris PostgreSQL-is. Commit `1f2df87c`.
- `SOL-CALL-09` P2 — kõnesalvestuse audit on best-effort ja võib vaikides puududa — DONE — jälg elab sama tehingu sees, mis tema otsus; `npm run call:audit:probe` 11/11 päris PostgreSQL-is. Commit `70d53835`.
- `SOL-CALL-10` P1 — piiramatu kestusega salvestis loetakse finaliseerimisel tervikuna Node'i mällu — DONE — kolm piiri, kus enne oli null. Commit `446932e6`.
- `SOL-CALL-11` P1 — ebaõnnestunud LiveKit-liitumine võib jätta mikrofoni ja serveriosaluse aktiivseks — DONE — fail-closed connect, liitumis-ID enne providerit, serveri leave veakäsitluses; brauseri veasüstetest NOT_PROVEN.
- `SOL-CALL-12` P0 — teise vahekaardi mute-nupp võib näidata mikrofoni väljas, kuigi heli läheb edasi — DONE — track'i omanik on omaette tõde, nupp on kinni ilma temata, lipp läheb DB-sse alles track'i kinnituse järel; kahe brauserikontekstiga mõõtmine NOT_PROVEN.
- `SOL-CALL-13` P1 — vana ruumi kõneseisu vastus võib uue ruumi vaate ja ühenduse üle kirjutada — DONE — põlvkond + ruumi identiteet, abort ruumivahetusel, cleanup aegunud vastuse käest ära võetud; hook-tasandi test NOT_PROVEN.

**Kutsed ja sponsorlus** (`SOL-INV`, 3/3)

- `SOL-INV-01` P1 — sponsoreeritud liikmete 50 koha piir on eri kutsete paralleelvastuvõtul ületatav — DONE — kogu liikmesuse otsus käib ruumiluku all; `npm run invite:seat:probe` 11/11 päris PostgreSQL-is. Commit `a32f4230`.
- `SOL-INV-02` P2 — kutse autoriseerimiseelne ruumisünk võib muuta teise kasutaja liikmerida — DONE — keelatud päring on kõrvalmõjuta, parandus käib autoriseerimise järel ja nimi tuleb serverist. Commit `c8048127`.
- `SOL-INV-03` P2 — e-kirja saatmise viga tagastab kutse loomise edukana ja kaotab esmase tokeni kasutajateelt — DONE — püsiv järjekord + aus vastus + idempotentne kordus; `npm run invite:mail:probe` 16/16 päris PostgreSQL-is ja päris workeriga. Commit `b7af4ec0`.

**Maksed** (`SOL-PAY`, 11/11)

- `SOL-PAY-01` P1 — kirjeldatud kordusmakse retry ei saa pärast esimest tõrget enam käivituda — DONE — valik näeb korduskatse seisu ja maksemeetod märgitakse katkiseks alles loobumisel; `npm run pay:renewal:probe` 13/13 päris PostgreSQL-is. Commit `d988ef87`.
- `SOL-PAY-02` P1 — ebamäärane provideritulemus märgitakse lõplikult FAILED-iks ja hilisem PAID webhook visatakse ära — DONE — ebamäärane tulemus on oma seis (`RECONCILE_PENDING`), millest hilisem PAID veel õiguse annab; `npm run pay:outcome:probe` 27/27 päris PostgreSQL-is päris marsruutide ja päris HTTP-provideriga. Vajab migratsiooni `20260811230000`.
- `SOL-PAY-03` P1 — tellimuse init pole idempotentne ja võib luua mitu tasutavat recurring-checkout'i — DONE — kliendi kavatsuse võti + kasutajapõhine lukustatud claim; `npm run pay:checkout:probe` 27/27 päris PostgreSQL-is, päris marsruudiga ja deterministliku võistlusega. Vajab migratsiooni `20260811230000`.
- `SOL-PAY-04` P1 — pärast sponsorluse lõppu tehtud omamakse säilitab vana sponsori allika — DONE — päritolu kirjutatakse tervikuna ja tema vahetus jätab ledgerisse jälje; `npm run pay:origin:probe` 19/19 päris PostgreSQL-is päris marsruutidega (init → PAID → cancel → refund).
- `SOL-PAY-05` P1 — allkirjastatud webhooki PAID otsus ei võrdle makstud summat ega valuutat kohaliku tellimusega — DONE — `PAID` peab enne õiguse andmist sellele maksele ja selle summa eest vastama; mittevastavus läheb `REVIEW_REQUIRED` seisu. `npm run pay:verify:probe` 19/19 päris PostgreSQL-is, iga väli eraldi muudetud. Vajab migratsiooni `20260812010000`.
- `SOL-PAY-06` P1 — osaline tagasimakse tõlgendatakse täistagastusena ja lõpetab kogu ligipääsu — DONE — osaline tagastus on oma seis oma summaga ja ta EI lõpeta ligipääsu; `npm run pay:refund:probe` 22/22 päris PostgreSQL-is päris allkirjastatud webhookidega. Vajab migratsiooni `20260812020000`.
- `SOL-PAY-07` P1 — tasutud sponsorkutse join-token võib outbox'i vea järel jäädavalt kaduda — DONE — toortoken ja tema kandja sünnivad ühes tehingus ja kordus taastab kadunud kandja ilma uue õiguse või makseta; `npm run pay:refund:probe` 22/22 (jaam 7) päris PostgreSQL-is.
- `SOL-PAY-08` P1 — makseaudit pole põhitehingu osa ja kasutab süstitud tehingu asemel globaalset Prismat — DONE — otsus ja tema püsiv jälg commit'ivad koos või mitte kumbki; `npm run pay:audit:probe` 11/11 päris PostgreSQL-is, veasüst on päris andmebaasi trigger.
- `SOL-PAY-09` P1 — konto kustutamine kaskaadib makseajaloo enne seadistatud seitsmeaastast retentsiooni — DONE mehhanismi osas; koosseisu kinnitus jääb juristile.
- `SOL-PAY-10` P2 — callback ja webhook võivad luua samale recurring-mandaadile mitu aktiivset BillingMethod rida — DONE — üks mandaat = üks rida, mõlemad rajad kasutavad sama lukustatud claim'i; `npm run pay:mandate:probe` 13/13 päris PostgreSQL-is deterministliku võistlusega. Vajab migratsiooni `20260812030000`.
- `SOL-PAY-11` P2 — e-posti outbox'i timeout/recovery võib sama kirja mitu korda saata — DONE — püsiv Message-ID + `AMBIGUOUS` oma seisuna; tundlik kiri EI lähe pimedale kordusele. Ühiktestid 8/8 (`tests/payments/emailOutboxAmbiguous.test.js`), sh timeout, mille järel esimene saatmine ikkagi õnnestub. Vajab migratsiooni `20260812040000`.

**Teavitused** (`SOL-NOTIF`, 7/7)

- `SOL-NOTIF-01` P1 — notification-worker ei anna päris SMTP-transpordile saatja aadressi — DONE — worker annab envelope-saatja ja puuduv saatja ei jää lõputusse korduskatsesse; `npm run notif:progress:probe` 14/14 päris PostgreSQL-is (jaam 4).
- `SOL-NOTIF-02` P1 — reconciler alustab igal käivitusel algusest ja võib kõik read pärast esimest 10 000 kirjet jäädavalt näljutada — DONE — allika edenemine on püsiv ja ringi käiv; `npm run notif:progress:probe` 14/14 (jaam 3). Vajab migratsiooni `20260812050000`.
- `SOL-NOTIF-03` P2 — ruumiaktiivsuse teade välistab autorid ainult ühe andmelehekülje piires — DONE — autorid välistatakse kogu akna pealt; sond 14/14 (jaam 1).
- `SOL-NOTIF-04` P2 — liikuv kuue tunni otsinguaken ja job'i kellast tuletatud dedupe-aken võivad sama tegevuse kaks korda teavitada — DONE — dedupe-aken tuleb SÜNDMUSEST, mitte worker'i kellast; sond 14/14 (jaam 2).
- `SOL-NOTIF-05` P2 — delivery timeout märgib teadmata tulemuse automaatselt retry'ks, kuigi algset SMTP saatmist ei katkestata — DONE — timeout on TEADMATUS (`UNKNOWN`), mitte pime korduskatse.
- `SOL-NOTIF-06` P1 — ühe varasema sweep'i viga jätab välitöö ohutuskontrolli ja kiire abi aegumise käivitamata — DONE — iga etapp jookseb oma veapiiri sees ja ohutusetapid käivituvad ALATI; `npm run notif:progress:probe` 14/14 (jaam 6, veasüst on päris andmebaasi trigger).
- `SOL-NOTIF-07` P2 — teavituste loendi fikseeritud kahekordne eelvalik võib peita vanemad kehtivad teated — DONE — loend liigub lehekülgede kaupa, kuni nähtavaid ridu on `limit`; sond 14/14 (jaam 5).

**Domeenisündmused** (`SOL-EVENT`, 1/1)

- `SOL-EVENT-01` P2 — domeenisündmuse idempotentsuskonflikt ei kontrolli, kas olemasolev sündmus vastab uuele teole — DONE — sama võti annab edu ainult sama teo peal, teistsugune teoidentiteet

**Kiireloomuline abi** (`SOL-URG`, 13/13)

- `SOL-URG-01` P0 — 200 ajaloolist kirjet võivad kõik uued kiireloomulised abipalved laua eest peita — DONE — töö ja ajalugu on eri päringud. Commit `0dd6bb18`.
- `SOL-URG-02` P0 — konto kustutamine jätab kiire abi nime, telefoni ja olukorra toorteksti andmebaasi — DONE — sisu ja kontaktid kaovad, vastutusjälje skelett jääb. Commit `97b28080`.
- `SOL-URG-03` P1 — server ja vorm käsitlevad vastamata ohuküsimust vastusena „ei” — DONE — edasi pääseb ainult OTSENE „ei".
- `SOL-URG-04` P1 — klient saab suvalise teksti vastuvõtjale „AI koostatud mustandina” salvestada — DONE — AI-mustandit ei võeta kliendilt.
- `SOL-URG-05` P1 — kiire abi olekumuutus ja kohustuslik vastutusjälg ei ole üks tehing — DONE — iga siire on üks tehing.
- `SOL-URG-06` P1 — olekusiirded on kontrolli järel tingimusteta kirjutused ja võivad paralleelselt üksteist üle kirjutada — DONE — oodatav seis elab WHERE-tingimuses.
- `SOL-URG-07` P1 — „Võtan” ei salvesta pöördumise vastutavat töötajat — DONE — vastutaja on põhirea peal, mitte ainult sündmuslogis.
- `SOL-URG-08` P1 — üleandmine lubab aktiivset, kuid tegelikult mittevalmis sihtlauda — DONE — siht läbib sama vastuvõtuvalmiduse kontrolli mis uue pöördumise loomine.
- `SOL-URG-09` P1 — laua valmidus võib loomise kontrolli ja kirjutuse vahel kaduda — DONE — laua rida ON valmiduse mutex.
- `SOL-URG-10` P1 — paralleelne konversioon võib luua mitu eelpöördumise mustandit ja osalise tulemuse — DONE — konversioon on täpselt üks kord.
- `SOL-URG-11` P1 — kiire abi koond kärbib 20 000 rea järel vaikides ja kasutab Eesti kellaaja asemel UTC-d — DONE — kogu valim ja Eesti kell.
- `SOL-URG-12` P1 — kiire abi partnerikinnitus ja kriitilised lauamuudatused ei salvesta otsustajat ega auditit — DONE — kinnitusel on kinnitaja ja tekstiversioon; igal adminitoimingul on jälg.
- `SOL-URG-13` P1 — tundliku pöördumise täisloendi API möödub „iga vaatamine jätab jälje” lepingust — DONE — dubleeriv täisloend on eemaldatud.

**Tööheaolu** (`SOL-WB`, 18/18)

- `SOL-WB-01` P1 — piloodi organisatsiooni- ja omavalitsusskoop ei jõua andmepäringusse — DONE — koos SOL-WB-02-ga, üks juur ja üks parandus. Vt SOL-WB-02 all.
- `SOL-WB-02` P1 — kliendi suvaline `roleGroup` määrab, millise piloodi koondisse kirje läheb — DONE — SOL-WB-01 ja SOL-WB-02 on üks juur: koond ei teadnud, kelle
- `SOL-WB-03` P1 — server kontrollib ainult väljade olemasolu ning tundmatu ohuväärtus muutub madalaks riskiks — DONE — teadmatust ei hinnata enam ohutuks.
- `SOL-WB-04` P1 — koondi `sampleSize` on inimesed, kuid meetrikad on piiramata kirjete arvud — DONE — ühik on valitud, nähtav ja valitav. Commit `285686ad`.
- `SOL-WB-05` P1 — 10 000 kirje piir kärbib tööheaolu koondit vaikides — DONE — koos SOL-WB-10-ga, üks juur: vaikne kärbe, mis esitles end
- `SOL-WB-06` P1 — künnis üksi ei kaitse kitsaste ja kattuvate koondpäringute kaudu üksikisiku tuletamise eest — DONE osas, mis on kood; üks haru jäi teadlikult lahti (vt allpool).
- `SOL-WB-07` P1 — vastatud vanad kontrollpunktid võivad hilisemad tähtajad taimerist välja näljutada — DONE — vastatud read ei ole enam kandidaadid.
- `SOL-WB-08` P2 — kirje parandamine jätab sama kontrollpunkti aktiivseks nii vanal kui uuel real — DONE — kokkulepe LIIGUB parandusega, mitte ei kopeeru.
- `SOL-WB-09` P2 — kontrollpunkti ja soovituse read-modify-write rajad võivad uuema muudatuse vana snapshotiga üle kirjutada — DONE — kokkuleppel on nüüd identiteet ja kirjutamine on jagamatu.
- `SOL-WB-10` P2 — „Kõik” tööheaolu ülevaade kasutab vaikides ainult 100 uusimat kirjet — DONE — SOL-WB-05 ja SOL-WB-10 on üks juur ja üks parandus.
- `SOL-WB-11` P2 — mitmed tööheaolu API-d tagastavad ootamatu serverivea toorsõnumi kliendile — DONE — 4xx staatus üksi ei ole enam luba rääkida.
- `SOL-WB-12` P1 — piloodivaataja ligipääsu ei saa platvormi API kaudu tühistada — DONE — koos SOL-WB-13-ga, üks plokk: andmine ja äravõtmine on sama rada
- `SOL-WB-13` P1 — piloodiscope'i loomine ja vaatajate õiguste muutmine ei jäta administraatori auditijälge — DONE — vt SOL-WB-12 plokk.
- `SOL-WB-14` P2 — piloodivaate hiline päring võib uuema filtrivaliku vana raportiga üle kirjutada — DONE — kaks väravat, sest kumbki üksi ei piisa.
- `SOL-WB-15` P2 — „Minu kirjed” ja mustandid lõpevad vaikides 100/50 rea juures — DONE — loend ei lõpe enam vaikselt.
- `SOL-WB-16` P1 — salvestatud mustandit ei saa avada, jätkata ega kustutada — DONE — mustand on nüüd avatav, jätkatav ja kustutatav.
- `SOL-WB-17` P1 — kolm neljast toevalikust ei jõua tegeliku adressaadini — DONE kriteeriumi MÕLEMA haru kaudu — üks rada ehitati, kolm said ausa nime.
- `SOL-WB-18` P1 — kasutaja andmekoopia jätab mustandid ja kirjete elutsükliandmed välja — DONE — koopia kannab nüüd elutsüklit, mitte hetketõmmist.

**Teenuspäevik** (`SOL-SLOG`, 31/31)

- `SOL-SLOG-01` P0 — seadme mustand ja saatmisjärjekord võivad järgmise konto andmed eelmise konto päevikusse saata — DONE. Seadme read on nüüd konto omad, mitte brauseri omad.
- `SOL-SLOG-02` P1 — iga 4xx vastus kustutab võrgujärjekorrast tehtud töö taastamisvõimaluseta — DONE — outbox eristab nüüd uuesti proovitavat ja parandamist vajavat tööd ning ei kustuta kumbagi vaikides. Võrguviga, 401, 403, 408, 425, 429 ja 5xx jäävad järjekorda; 400/409 liiguvad püsivasse `needs_attention` olekusse koos põhjusega. UI näitab neid eraldi ja „Tõsta vormile” taastab payload'i redigeerimiseks; alles see kasutaja toiming eemaldab vana järjekorrarealt. Reload-test tõendas 400 payload'i ja põhjuse püsimise ning olekutestid katsid kõik nõutud vastuseklassid.
- `SOL-SLOG-03` P1 — 201. võrgujärjekorra kirje kustutab vanima teenuse vaikides — DONE — 201. kirje blokeeritakse enne kirjutust ning kõik 200 varasemat payload'i jäävad muutmata alles. Sama idempotentsusvõtmega rea parandamine on endiselt lubatud, kuid uue võtme lisamine täis järjekorda tagastab nähtava täitumisvea ja vorm jääb avatuks. Piirtest võrdleb kogu järjekorda enne ja pärast 201. katset, mitte ainult pikkust.
- `SOL-SLOG-04` P1 — korduv idempotentsusvõti ei kontrolli, kas uus payload kirjeldab sama tööd — DONE — teenuskirje kannab kanoniseeritud SHA-256 sisendiräsi ning replay nõuab võtme ja sisu kokkulangevust. Sama payload tagastub idempotentselt; kliendi, kuupäeva, koguse või suunamise muutus sama `clientRequestId` all annab `409 service_log.errors.idempotency_payload_mismatch`. Nullable migratsioon säilitab vanad read ning nende esimene kordus võrreldakse rea tegelikust sisust taastatud sõrmejäljega. Sihitud testid katsid kõik neli nõutud lahknevust.
- `SOL-SLOG-05` P1 — `sourceFieldVisitId` on kliendi usaldatud päritoluväide, mitte tõendatud Välitöö seos — DONE — `sourceFieldVisitId` seos tõendatakse nüüd serveris enne teenuskirje loomist. Külastus peab kuuluma samale profiilile ja omanikule, olema `COMPLETED`, kasutamata ning vastama kliendi, kuupäeva, suunamise, teenuse ja aja põhiandmetele; olematu ja võõras ID annavad ühtemoodi 404. Negatiivtestid katsid olematut, võõrast, lõpetamata, juba kasutatud ja sisult lahknevat külastust. FK-ta retention'i piir jäi teadlikult alles, kuid päritoluväidet ei saa enam kliendist vabalt kirjutada.
- `SOL-SLOG-06` P1 — sama nimega väliskliendi suunamist saab kasutada teise välisviitega kirjel — DONE — suunamise terviklikkus võrdleb väliskliendi puhul nüüd normaliseeritud nime ja `clientExternalRef`-i paari nii loomisel kui parandamisel; sama nimi ei varja enam viite vastuolu. Suunamise päring valib välisviite mõlemal rajal ning vastuolu annab enne kirjutust `400 service_log.errors.referral_client_mismatch`. Teenuskihi negatiivtest lõi sama nimega `external-a` suunamise ja proovis seda `external-b` kirjel: vastus 400 ja kirjeid 0; õige nime-viite paar salvestus ühe reana.
- `SOL-SLOG-07` P2 — tühi tegevuskataloog muudab serveri allowlist'i vabatekstiks — DONE — tühi või puuduv tegevuskataloog lubab nüüd ainult tühja tegevusmassiivi ning kataloogiväline väärtus annab nähtava 400 valideerimisvea, mitte ei muutu vabatekstiks ega kao vaikselt. ET/EN/RU veateade nimetab, et tegevus ei kuulu teenuse kataloogi. Negatiivtestid katsid teenuseta kirje, tühja teenusekataloogi ja tundmatu väärtuse; positiivkontroll salvestas ainult kataloogis oleva tegevuse. Ploki sihttestid 29/29 PASS.
- `SOL-SLOG-08` P1 — kinnitamine ja tühistamine võivad samaaegselt üksteist tingimusteta üle kirjutada — DONE — `finalizeEntry()` ja `voidEntry()` kasutavad nüüd sama `id + providerProfileId + status + updatedAt` CAS-kirjutust; eellugemine ei anna enam õigust hiljem tingimusteta üle kirjutada. Finalize puhastab tühistusväljad ning DRAFT-ist tühistamine hoiab kirjendamisaasta/finaliseerimise väljad nullina. `npm run slog:entry:probe` 16/16 päris PostgreSQL-is tõendas finalize/finalize ja finalize/void võistlustes täpselt ühe võitja, ühe 409 kaotaja ja mõlemal juhul olekuga kooskõlalise lõpprea.
- `SOL-SLOG-09` P1 — paralleelsed kinnitatud kirje parandused ei moodusta usaldusväärset muutmisahelat — DONE — kirje PATCH nõuab nüüd kliendi nähtud `expectedUpdatedAt` versiooni ning ServiceEntry CAS ja `ServiceEntryCorrection` sünnivad samas tehingus; stale kaotaja saab 409 koos värske reaga. Paranduse `previousValues` arvutatakse ainult CAS-iga kaitstud snapshotist. Päris PostgreSQL-i sond võistles eraldi sama välja ja eri väljade parandustega: mõlemas üks võitja, üks värske reaga 409 ning täpselt üks correction, mitte kaks sama vana lähtega haru.
- `SOL-SLOG-10` P1 — osutaja saab platvormikliendi digikinnituse asemel märkida käsitsi kinnituse — DONE — paberkinnituse märge on nüüd eraldi `setManualConfirmation()` elutsüklirada, mida saab kasutada ainult FINAL väliskliendi kirjel; üld-PATCH on selle välja jaoks suletud ja platvormikliendi katse annab 409. Iga tegelik märkimine ja eemaldamine loob samas CAS-tehingus `ServiceEntryCorrection` rea, mis kannab tegijat, aega, vana boolean-väärtust ja toimingu liiki. Päeva- ja kuuvaade ei näita nuppu platvormikliendile ega mustandile. PostgreSQL-i sond tõendas platvormikliendi muutmata rea/auditite 0 ning väliskliendi true→false järel kaks järjestikust auditirida; Teenuspäeviku testslice 342/342 PASS, muudetud failide eslint ja i18n puhtad.
- `SOL-SLOG-11` P1 — kliendi kuupõhine kinnitus võib hõlmata kontrolli järel lisatud nähtamatut kirjet — DONE — kliendi kuuvaade annab nähtavate ID-de ja sisu sha256-snapshoti ning POST nõuab sama võtit, külmutab ID-loendi ja kinnitab ainult need read serialiseeritavas tehingus. Lühike PostgreSQL-i SHARE-lukk sulgeb FINAL-fantoomirea akna; enne tehingut muutunud kuu saab 409 ja UI laadib värske vaate. `npm run slog:confirmation-retention:probe` lisas FINAL-rea deterministlikult snapshoti lugemise ja update'i vahele: lisamine ootas lukku, kliendi nähtud rida kinnitus, uus rida jäi kinnitamata ning vana snapshoti kordus sai 409.
- `SOL-SLOG-12` P1 — seitsmeaastase säilitusega kuuaruande saab tavalisest dokumendi-DELETE rajast kohe kustutada — DONE — tavapärane dokumendi DELETE annab aktiivse RPS § 12 tähtajaga raportile 409 ning puuduv või vigane tähtaeg lukustab kustutuse fail-closed. Konto kustutus eraldab säilitatava faili tavakustutuse sihtidest ja teisaldab `UserDocument` rea enne kasutajakaskaadi `ServiceLogReportLegalArchive` tabelisse, millel ei ole `ownerId`-d, `userId`-d ega User-seost. Olemasolev retention-sweep kustutab pärast tähtaega esmalt faili ja siis arhiivirea. Päris PostgreSQL-i sond tõendas omaniku-`UserDocument` kadumise, identiteediväljadeta arhiivirea ja tähtajajärgse fail+DB koristuse; Teenuspäeviku ning konto-kustutuse testslice 366/366 PASS. Vajab migratsiooni `20260812213000_sol_slog_12_report_legal_archive`.
- `SOL-SLOG-13` P0 — pelk otsese juhi seos annab tundliku kliendiaruande sisuõiguse vastupidiselt org-lepingule — DONE — autoriseerib ainult capability, juhiseos võtab sõna. Commit `bcff4903`.
- `SOL-SLOG-14` P0 — aruandesaajate päring kirjutab kehtivusfiltri üle ja lubab aegunud capability — DONE — kehtivus ja skoop on ühe `AND` eri harudes. Commit `bcff4903`.
- `SOL-SLOG-15` P1 — aruande koopia failikirjutus ja jagamis-/auditirida võivad jääda lahku — DONE — jagamine loob enne failikirjutust püsiva `PREPARING` rea, kirjutab koopia staging-asukohta, promob selle lõplikuks ning commitib alles siis `SENT` siirde ja kohustusliku org-auditi samas tehingus. Store-, promote-, DB- või auditivea kompensatsioon puhastab mõlemad võimalikud failiteed; puhastuse enda tõrkel jääb `PREPARING` rida retention-sweepile taastatavaks cleanup-job'iks. P2002 tekib enne ühtegi uut faili. Ka tagasivõtmise `RECALLED` ja audit commitivad nüüd koos. Veasüstitestid katsid store→DB, DB→audit, cleanup-tõrke ja P2002; `npm run slog:share-integrity:probe` tõendas päris PostgreSQL-is SENT+auditi, staging-promote'i, failita P2002 ja RECALLED auditi rollbacki.
- `SOL-SLOG-16` P1 — liikmesuse, organisatsiooni või omaniku kustutus kaskaadib juhile saadetud külmutatud aruande — DONE — `ServiceReportShare` omaniku, organisatsiooni ja saajaliikmesuse FK-d on nüüd nullable `SetNull` seosed ning DB-trigger kirjutab iga kadunud vanema jaoks vastava erased-at ajatempli. Külmutatud fail, räsi, periood, jagamisolek ja aruandest pärit `retentionEndsAt` jäävad alles; retention-sweep kustutab faili ja rea alles tähtaja järel. Päris PostgreSQL-i sond kustutas järjest omaniku, saajaliikmesuse ja organisatsiooni: rida elas kõik kolm kaskaadi üle, iga seos muutus nulliks koos erased-at jäljega ning faili räsi ja tähtaeg säilisid. Teenuspäeviku ja konto-kustutuse testslice 373/373 PASS. Vajab migratsiooni `20260812223000_sol_slog_15_16_share_integrity`.
- `SOL-SLOG-17` P0 — mitme organisatsiooniga töötaja kaudu näeb üks juht teise organisatsiooni klienditöid — DONE. Parandatud koos SOL-SLOG-18-ga — sama juur, kaks otsa.
- `SOL-SLOG-18` P0 — ühe organisatsiooni juht saab teise organisatsiooni külastuse ümber määrata — DONE. Sama plokk mis SOL-SLOG-17 (üks juur: külastusel puudus
- `SOL-SLOG-19` P1 — „üks aktiivne külastus” on ainult võidujooksule avatud eelkontroll — DONE — kõik külastuse siirded võtavad nüüd `ServiceWorkRoute` rea `FOR UPDATE` luku ning loevad luku järel nii külastuse kui route'i uuesti. Aktiivse teise külastuse kontroll ja olekukirjutus toimuvad samas tehingus, seega kahe eri külastuse paralleelsel alustamisel saab ainult üks võita ja teine 409. `npm run slog:route-race:probe` käivitas päris PostgreSQL-is kaks sama route'i eri `PLANNED` külastust paralleelse `depart`-iga: üks õnnestus, teine sai 409 ning andmebaasi jäi täpselt üks aktiivne rida. Kogu sond 10/10 PASS.
- `SOL-SLOG-20` P1 — päeva sulgemine ja külastuse alustamine võivad jätta aktiivse külastuse suletud route'ile — DONE — `closeRoute()` ja `transitionVisit()` serialiseeruvad nüüd sama `ServiceWorkRoute` realuku kaudu; siire nõuab luku järel endiselt `OPEN` route'i. Kui sulgemine võidab, jääb visiit `PLANNED`; kui siire võidab, näeb sulgemine aktiivset visiiti ja annab 409. Päris PostgreSQL-i sond võistles eraldi `close/depart` ja `close/arrive`: mõlemas oli täpselt üks võitja, kaotaja sai 409 ning lõppseis oli vastavalt ainult `CLOSED/PLANNED` või `OPEN/EN_ROUTE|ARRIVED`, mitte kunagi aktiivne visiit suletud route'il. Struktuurivalvur hoiab mõlema toimingu ühise luku, luku järel tehtava korduslugemise ja `OPEN` kontrolli alles.
- `SOL-SLOG-21` P1 — erineva kliendi idempotentsusvõtmega saab ühest lõpetatud külastusest kaks arvekirjet — DONE — külastusest kirje loomise võti on nüüd ainult serveri tuletatud `visit-entry-<visitId>` ning sama unikaalne `sourceFieldVisitId` seob tulemuse külastusega. Kutsuja võtit API enam edasi ei anna; juba lingitud külastus tagastab sama kirje idempotentselt. `npm run slog:entry-origin:probe` läbis päris PostgreSQL-is 12/12, sealhulgas kaks paralleelset eri kliendivõtmega kutset: mõlemad said sama kirje, andmebaasi jäi üks teenuskirje ja üks tagasilink.
- `SOL-SLOG-22` P1 — suunamiseta kuunarratiiv ühendab sama nimega väliskliendid üheks looks — DONE — suunamiseta väliskliendi narratiiv kasutab nime asemel stabiilset `clientExternalRef` identiteeti. Uus osaline unikaalindeks on profiil+välisviide+aasta+kuu; vana nimepõhine indeks eemaldati. Migratsioon annab olemasolevatele nimepõhistele ridadele unikaalse `legacy:<id>` viite ja märgib need `clientIdentityNeedsReview=true`, nii et võimalikku identiteedivõlga ei peideta. `npm run slog:narrative-identity:probe` läbis päris PostgreSQL-is 6/6: kaks sama nime ja eri viitega narratiivi ning nende seed'id jäid lahus.
- `SOL-SLOG-23` P1 — hiline narratiivi vastus võib ühe kliendi teksti teise kliendi alla salvestada — DONE — seed, olemasolev narratiiv ja AI-mustand on seotud `referralId+month` sõrmejälje, request-ID ja AbortControlleriga. Valiku vahetus tühistab vana töö ning puhastab editori kohe; hiline vastus ei tohi olekut muuta ja salvestus on blokeeritud, kui editori sõrmejälg ei vasta aktiivsele valikule. Päris brauseris lahendati seed-, list- ja AI-päringud nii A→B kui B→A järjekorras: kõik kuus jätsid ekraanile viimase valiku teksti ning salvestus saatis ainult nähtava A valiku ja `A SAFE` teksti.
- `SOL-SLOG-24` P1 — kuu-, saldo- ja narratiivivaated kärbivad alusandmeid vaikides — DONE — kuu-, saldo-, suunamis- ja narratiivipäringud kasutavad nüüd stabiilset ID-kursoriga lehekülgitamist ega lõpeta vaikides vana `take` piiri juures. Ühine abifunktsioon nõuab igalt lehelt kasvavat viimast ID-d ja viskab seiskunud kursori korral, selle asemel et tagastada näiliselt täielik tulemus. Piirtestid tõendasid, et 5001. kuurida ja saldorida muudavad summat, 501. suunamine ja narratiiv jõuavad vastusesse ning 2001. seed'i kirje jõuab faktibaasi.
- `SOL-SLOG-J-01` P1 — tegelik kasutajaliides ei võimalda teenuskirjet parandada, tühistada, kustutada ega parandusajalugu vaadata — DONE — kuu kirjel on nüüd olekupõhine owner-toiming: DRAFT-i saab kogu muudetava sisuga parandada või kinnituse järel kustutada, FINAL-i saab ainult põhjusega parandada või tühistada ning VOID jääb read-only. Uus owner-skoobitud `GET /api/service-entries/[id]/corrections` kuvab põhjuse, aja ja muudetud väljad; ka tühistamine kirjutab parandustabelisse põhjuse ning võõras omanik saab 404. Auditispetsiifiline negatiivkontroll oli enne parandust 0/3 ja pärast parandust Teenuspäeviku sihtslice 40/40 PASS. Päris lokaalses sünteetilises brauserirajas läbisid DRAFT edit/reload/delete, FINAL põhjuseta paranduse tõke, põhjusega parandus/reload/ajalugu ja void; loodud kirjed, suunamine ning kaks ajaproovi koristati pärast tõendit. `npm run build`, sihitud ESLint ja i18n kontroll läbisid.
- `SOL-SLOG-J-02` P1 — suunamist saab luua ja vaadata, kuid mitte parandada ega lõpetada — DONE — aktiivse suunamise kaardil on muutmine ja teadliku kinnitusega lõpetamine; kasutamata otsuse välju saab muuta, kasutatud otsuse identiteet jääb lukku, olemasolevaid kirjeid välja jätva perioodikitsenduse veateade on nähtav ning ENDED jääb reload'i järel read-only ajalukku ega lähe uue kirje vaikimisi valikusse. Kirje loomine ja lõpetamine lukustavad sama `ServiceReferral` rea: `npm run slog:referral-race:probe` läbis päris ajutises PostgreSQL-is 11/11, sh mõlemad järjekorrad, 409 kaotaja, topeltlõpetamine sihttestis ja puhas cleanup. Lokaalne sünteetiline brauserirada tõendas muutmise püsimist, teadlikku lõpetamist ja reload'i; ülesande andmed koristati.
- `SOL-SLOG-J-03` P1 — üks tekstimuudatus kustutab AI-mustandi päritolu salvestatud kuunarratiivilt — DONE — `draftSource` kirjeldab nüüd algallikat: AI-ga alustatud narratiiv jääb `AI_MUSTAND`-märgisega ka pärast inimese toimetust ja reload'i, täiesti käsitsi alustatud tekst jääb märgiseta. Sihttestid kinnitavad olekulepingu ning ehitatud rakenduse päris brauserirajas säilis märk pärast ühe märgi muutmist, päris API-sse salvestamist ja reload'i. Lokaalne väline AI-teenus ei olnud saadaval; brauseris asendati ainult draft-endpointi vastus deterministliku `AI_MUSTAND` sünteetilise vastusega, seed, salvestus, andmebaas ja reload olid päris. Ülesande narratiiv, kirje ja suunamine koristati.
- `SOL-SLOG-J-04` P1 — kuunarratiivi paralleelsed muudatused kirjutavad üksteist revision/CAS-ita üle — DONE — GET-i `updatedAt` jõuab nüüd PUT-i `expectedUpdatedAt`-ina ning olemasoleva rea muutmine kasutab owner-skoobitud `updateMany` CAS-i. Loomise võistluse kaotaja ja stale muutja saavad 409 koos värske narratiiviprojektsiooniga; UI hoiab vana teksti vormil, näitab värsket kõrvutuseks ja laseb selle teadlikult üle võtta. `npm run slog:narrative-race:probe` läbis ajutises päris PostgreSQL-is 10/10: create/create, update/update ja AI-vastus-vs-käsimuudatus, üks CAS-võitja, värske 409 projektsioon, säilinud tekst ja puhas cleanup. Ehitatud rakenduse brauserirada tõendas stale teksti säilimise, värske teksti kõrvutuse ja teadliku ülevõtu.
- `SOL-SLOG-J-05` P1 — kasutaja andmekoopia jätab kogu Teenuspäeviku töö välja — DONE — andmekoopia registris on nüüd eraldi Teenuspäeviku pind: osutaja saab ainult enda profiili suunamised, kirjed koos parandusahelaga, narratiivid, teekonnad, külastused, ajaproovid ning saadetud/saadud aruande metaandmed; klient saab ainult tema kohta kinnitatud `FINAL` kirjed ja täpselt sama projektsiooni, mida kliendi kuuvaade (`id`, kuupäev, ühik, kogus, teenuseosutaja nimi ja kinnitus). Kliendikoopia päring ja väljund kasutavad ühist lubatud väljade loendit, mistõttu töötaja märge, mustand, narratiiv, suunamine, kliendi välisviide ja täpne asukoht ei saa koopiasse lekkida. Professionaalsest koopiast on kliendi identiteet, täpne asukoht ja failitee eemaldatud ning jagatud aruande sisu asemel väljastatakse metaandmed. Sihttestid katavad töötaja ja kliendi, paranduse, väliskliendi projektsiooni, mustandi välistamise, teenuseosutaja nime, tundlike kliendiga seotud väljade mitteläbimise ja jagamise mõlemad vaated. `npm run slog:privacy-retention:probe` tõendas päris PostgreSQL-is kaht omanikku, kliendi kinnitust, saatja/saaja vaadet ja kolmanda isiku andmete mitteläbimist.
- `SOL-SLOG-J-06` P1 — konto kustutus ei anonüümi Teenuspäeviku identiteete ja jätab külastustesse toored kasutaja-ID-d — DONE — konto lõplik kustutustehing nullib enne `User`-rida kõik Teenuspäeviku kliendi-, omaniku-, parandaja-, route/visit-, ajaproovi- ja aruandejagamise identiteedid, eemaldab kliendi snapshot'id ning kirjutab vastavad tombstone'id; loendurid jõuavad kustutuse auditi tulemusse. Töö on idempotentne ja mudeli- või User-kustutuse tõrge on fail-closed. `npm run slog:privacy-retention:probe` kustutas päris PostgreSQL-is eraldi kliendi, töötaja ja juhi ning kontrollis referral/entry/correction/narrative/route/visit/sample/share lõppseisu ja retry't; süstitud User-delete tõrge tõendas kogu tombstone'i tehingu rollback'i.
- `SOL-SLOG-J-07` P1 — seitsmeaastase klassiga Teenuspäeviku andmetel puudub tähtajajärgne retention-worker — DONE — referral, narrative, route ja visit kannavad nüüd domeeniankrust arvutatud indekseeritud `retentionEndsAt` väärtust; ankruhilisem muutus uuendab tähtaega. Üldine auditeeritud retention-worker kustutab batch'itult ja idempotentselt järjekorras kirje/parandusahel → narratiiv → külastus → teekond → suunamine ning eraldi 180 päeva ajaproovid; jagatud aruandefail jääb olemasolevale staging/retry/reconcile rajale. `npm run slog:privacy-retention:probe` läbis päris PostgreSQL-is 16/16: suunamise lõpu ankru uuendus, piir-1/piir/piir+1, DRAFT/FINAL/VOID, parandusahel, väike batch, kasutaja kustutus ja kaks samaaegset sweep'i. Sihttestid tõendasid lisaks puuduva faili, store→DB, DB→audit, cleanup-retry ja PREPARING-reconcile rajad.

**RAG-teenus ja ingest** (`SOL-RAGSVC`, 28/28)

- `SOL-RAGSVC-01` P0 — kaks ingest-rada võimaldavad kirjutada faili väljapoole RAG-hoidlat — DONE (kood); HTTP-negatiivtest deploy-järgne, vt allpool.
- `SOL-RAGSVC-02` P0 — tekstidokumendi `source_path` annab serverifaili lugemise primitiivi — DONE — HTTP-negatiivtest jooksutatud toodangus, `PROBE_OK 8/8`.
- `SOL-RAGSVC-03` P1 — puuduva teenusevõtmega lülitub RAG autentimine välja — DONE. RAG loeb käivitumisel autentimiskonfiguratsiooni
- `SOL-RAGSVC-04` P1 — üks üldine adminiproksi annab kõik RAG-i hävitavad õigused ilma toimingupõhise loata või auditita — DONE. Brauseri catch-all kasutab nüüd täpset meetod+tee maatriksit:
- `SOL-RAGSVC-05` P1 — katkine registrifail tõlgendatakse tühja registrina ja järgmine kirjutus matab vana loendi — DONE koos SOL-RAGSVC-06-ga. Register elab nüüd eraldi
- `SOL-RAGSVC-06` P1 — registri lukk ja fikseeritud `.tmp` fail ei kaitse mitme protsessi kaotatud uuenduste eest — DONE koos SOL-RAGSVC-05-ga. Protsessisisene `threading.Lock` ja ühine
- `SOL-RAGSVC-07` P1 — dokumendi vektorite asendamine võib jätta vana ja uue indeksi osaliselt kadunuks — DONE koos SOL-RAGSVC-08-ga. Asendus ei kustuta enam vana indeksit
- `SOL-RAGSVC-08` P1 — toorfail, Chroma vektorid ja JSON-register commit'ivad eri aegadel — DONE koos SOL-RAGSVC-07-ga. FILE, TEXT ja URL allikad kirjutatakse
- `SOL-RAGSVC-09` P1 — delete tagastab edu ka siis, kui vektor või allikafail jäi alles — DONE. Delete kirjutab enne hävitamist registrisse
- `SOL-RAGSVC-10` P1 — metadata patch muudab registri enne Chroma edu ja jätab vea korral lahkneva tõe — DONE. Metadata patch kasutab sama OS-ülest docId lukku ja pagib kõik
- `SOL-RAGSVC-11` P1 — failide ja tekstide suurusepiirid rakenduvad pärast kogu keha mällu laadimist või puuduvad — DONE. Nexti RAG-proksi loendab nüüd tegelikke `ReadableStream` baite
- `SOL-RAGSVC-12` P1 — deklareeritud MIME ja piiramatud dokumendiparserid võimaldavad CPU/mälu ammendamist — DONE. Signatuuri ja konteineri kontroll rakendub nüüd ka püsiva ingest'i
- `SOL-RAGSVC-13` P1 — URL-ingest'i SSRF-kaitses on DNS-rebindingu ajavahemik — DONE. URL-fetch lahendab hosti ühe korra, lükkab tagasi kogu
- `SOL-RAGSVC-14` P1 — Chroma päringuviga muutub HTTP 200 tühjaks tõendiks — DONE. Dense Chroma exception annab nüüd HTTP 503 ja stabiilse
- `SOL-RAGSVC-15` P1 — hübriidotsing tagastab rohkem tulemusi kui `top_k` lubab — DONE. Dense- ja leksikaalkandidaadid ühendatakse enne hübriidskoori;
- `SOL-RAGSVC-16` P1 — leksikaalotsing skannib vaikides ainult suvalist esimest 2000 chunk'i — DONE. Leksikaalrada pagib Chroma tulemeid offset'iga kuni korpuse
- `SOL-RAGSVC-17` P1 — artiklite ingest ei ole asendav, idempotentne ega ühe tervikuna atomaarne — DONE. Kogu artiklipakk ehitatakse nüüd mälus valmis enne esimest
- `SOL-RAGSVC-18` P1 — kliendi antud chunk-ID võib üle kirjutada teise dokumendi globaalse Chroma rea — DONE. Eksplitsiitse chunki füüsilise alus-ID tuletab server nüüd
- `SOL-RAGSVC-19` P1 — märgipõhine chunker jätab lausepiiril teksti vahele — DONE. Märgipõhise chunkeri järgmine algus arvutatakse nüüd tegelikust
- `SOL-RAGSVC-20` P1 — lühikese mitmeleheküljelise PDF-i üks chunk omistatakse ainult esimesele lehele — DONE. Single-chunk PDF kogub nüüd kõigi sisendlehtede unikaalse loendi
- `SOL-RAGSVC-21` P1 — tekstita uus versioon kustutab vana indeksi ja märgitakse siiski lõpetatuks — DONE. Ühine vektorasenduse piir annab null-chunk payload'ile enne
- `SOL-RAGSVC-22` P2 — liiga pikk eksplitsiitne chunk talletatakse muu tekstiga kui selle embedding — DONE. `/ingest/text` piirab eksplitsiitse chunki juba Pydanticu
- `SOL-RAGSVC-23` P2 — tervise- ja dokumendivaated maskeerivad Chroma vea terveks olekuks ning lekitavad siseteid — DONE. `/health` annab nii registri- kui Chroma count-tõrkel 503,
- `SOL-RAGSVC-24` P2 — tag-tokeni filter kirjutab kasutaja muu `$or` filtri üle — DONE. Otsingufiltri kompilaator lisab iga OR-rühma eraldi
- `SOL-RAGSVC-25` P2 — `tags` ja `authors` filtreid võrreldakse formaadiga, milles neid ei salvestata — DONE. Ingest kirjutab autorid 12 eraldi `author_token_N` slotti ning
- `SOL-RAGSVC-26` P2 — base64 ingest aktsepteerib tühja või vigase sisu ilma korrektse kliendiveata — DONE. JSON faili-ingest kasutab nüüd `base64.b64decode(...,
- `SOL-RAGSVC-27` P2 — üldine valideerimisvea handler annab kõigile endpointidele vale upload-lepingu — DONE. Üldine handler tagastab nüüd marsruudiklassi täpse koodi,
- `SOL-RAGSVC-28` P2 — metadata patch ei võimalda vigast väärtust eemaldada — DONE. Patch eristab nüüd puuduvat võtit ja saadetud `null` väärtust:

**Migratsioonid** (`SOL-PRISMA`, 4/4)

- `SOL-PRISMA-01` P1 — MTR-i parandav migratsioon kaotab pärandpõhjuse ja võib kinnistada vale allikatulemuse — DONE. Ajalooline migratsioon ei eelda enam tühja tabelit: ta tuletab
- `SOL-PRISMA-02` P1 — kaks HelpMatchi välisvõtit jäid püsivalt valideerimata — DONE. `HelpMatch` osapoolte ID-d on sama rea `HelpRequest.userId` ja
- `SOL-PRISMA-03` P1 — tootmisdeploy muudab skeemi enne vana rakenduse peatamist ja enne uue build'i õnnestumist — DONE. Deploy siseneb nüüd selgesse hooldusväravasse ja ehitab uue
- `SOL-PRISMA-04` P2 — migratsioonivärav tõendab tühja skeemi, kuid mitte pärandandmeid ega tootmislukke — DONE. Quality gate käivitab nüüd lisaks tühjale täisahelale päris

**Mentorlus** (`SOL-MENT`, 7/7)

- `SOL-MENT-01` P1 — aktiivse avaliku mentoriprofiili sisu saab pärast heakskiitu modereerimata ümber kirjutada — DONE — admini heakskiit külmutab avaliku snapshot'i; modereeritava välja muutus viib profiili `PENDING_REVIEW` olekusse, kuid kataloog ja taotlusrada kasutavad kuni uue otsuseni ainult eelmist kinnitatud versiooni. Test muudab korraga kõik avalikud väljad ja tõendab, et ükski uus väärtus ei leki; PostgreSQL-sond kinnitab sama päris ridadel. Vajab migratsiooni `20260814001000`.
- `SOL-MENT-02` P1 — välise mentori nõusolek ei nõua tõendit ega aegu 12 kuu järel — DONE — `CONSENTED` nõuab tüübitud tõendit ja viidet ning server kirjutab kontrolli- ja fikseerimisaja; kataloog kontrollib igal lugemisel tõendit, tulevikuaega ja 12 kuu piiri fail-closed. Sweep muudab aegunud rea ühe korra `STALE`-iks, kirjutab auditi ja püsiva adminiteavituse. Piiri mõlemad pooled ning puuduv, tulevikuline ja vigane tõend on testitud; PostgreSQL-sond kinnitab ülemineku ja teavituse. Vajab migratsiooni `20260814001000`.
- `SOL-MENT-03` P1 — mentor saab jagatud ettevalmistuse sisu lugeda enne, kui avamine fikseeritakse — DONE — tavaline suhte GET tagastab avamata ettevalmistuse metaandmed, kuid mitte `sharedContent` sisu; avamise POST fikseerib lukustatud tehingus `openedByOtherAt` enne sisu vastusesse panemist. Päris PostgreSQL-i paralleelses open/recall võistluses võidab täpselt üks rada ja lõppseis vastab võitjale.
- `SOL-MENT-04` P1 — kinnitatud kokkuvõte märgitakse asendatuks enne paranduse kinnitamist ning parandusrada puudub UI-st — DONE — paranduse mustand kannab `correctionOfId` algviidet ja kasutajaliides pakub kinnitatud kokkuvõttel uue versiooni vormi. Algne `supersededById` tekib alles paranduse teise kinnitusega samas lukustatud tehingus; discard ei muuda algset. Mõlemad jadad on kaetud ühiktesti ja päris PostgreSQL-sondiga. Vajab migratsiooni `20260814001000`.
- `SOL-MENT-05` P1 — PLATFORM_ROOM kohtumine luuakse UI-st ilma ruumita ja server ei nõua teise poole liikmesust — DONE — suhtevaade tagastab ainult mõlema poole ühised aktiivsed ruumid ning vorm nõuab PLATFORM_ROOM valikul üht neist. Server kontrollib lukustatud loomisel ja muutmisel ruumi olemasolu, arhiveerimata seisu ning mõlema suhtepoole aktiivset liikmesust; EXTERNAL nullib viite. Puuduv, ühepoolne, ühine ja lahkunud liikme juhtum on ühiktestis ja päris PostgreSQL-sondis kaetud.
- `SOL-MENT-06` P1 — `datetime-local` kohtumisaeg tõlgendatakse serveri ajavööndis — DONE — brauser teisendab `datetime-local` väärtuse enne POST-i UTC ISO-stringiks ja server aktsepteerib ainult selge `Z` või offset'iga aega. Tallinna brauserikontekstis salvestus `2026-01-15 10:30` väärtuseks `08:30Z` ning `2026-07-15 10:30` väärtuseks `07:30Z`; mõlemad kuvati tagasi kohaliku `10:30` ajana. Offsetita serverisisend on ühiktestis ja PostgreSQL-sondis tagasi lükatud.
- `SOL-MENT-07` P1 — lähenevate kohtumiste sweep võib jääda esimese 50 rea külge kinni — DONE — upcoming-sweep lehitseb kogu akna stabiilse `(occurredAt,id)` kursori järgi, loendab tööks ainult uue teavituse ning dedupe sisaldab täpset kohtumisaega. Nii ühiktest kui päris PostgreSQL-sond töötlevad 125 kohtumist 50-reases pakis, kordusjooks on vaikne ja sama päeva ümbertõstmine tekitab täpselt ühe uue teate kummalegi poolele.

**Supervisioon** (`SOL-SUP`, 15/15)

- `SOL-SUP-01` P1 — suletud protsess ei ole serveris lõplik: kutse saab vastu võtta ja uut jagatud sisu luua — DONE — jagatud protsessiala kirjutused kasutavad nüüd ühist, advisory-luku sees värskelt loetavat CLOSED-väravat; omaniku privaatne eeskamber jääb teadlikuks erandiks. Teenuse- ja HTTP-testid tõendavad kutse vastuse, kontraktikinnituse ja M7 jagamise 409-t ilma kirjutuse või auditita. `npm run supervision:integrity:probe` 18/18 päris PostgreSQL-is järjestas sulgemise enne ootel teema- ja kutsekirjutust: mõlemad hilised kirjutused kaotasid ning suletud protsessi jagatud toorsisu jäi tühjaks.
- `SOL-SUP-02` P1 — asendatud kontraktiversiooni taasaktiveerimine taastab vana nõusoleku ilma kasutaja uue kinnituseta — DONE — aktiveerimisrada võtab vastu ainult DRAFT-versiooni, kontrollib aktiivse versiooni vastu rangelt kasvavat versiooninumbrit ning jätab SUPERSEDED rea lõplikuks. Kontraktipaneel kuvab aktiveerimisnupu ainult DRAFT-reale. Teenuse- ja HTTP-test lükkavad v1 taasaktiveerimise 409-ga tagasi, osaleja vana acceptance ei taastu ning PostgreSQL-sond kinnitab, et v2 jääb aktiivseks.
- `SOL-SUP-03` P1 — superviisor ei saa jagatud teemat luua, kuigi siduv õiguste- ja API-leping lubab seda — DONE — omanik kinnitas siduva Q2 õiguse: nii SV kui kehtiva kontraktikinnitusega OS võivad M7 teemat autoreerida. Autorimudel kasutab nüüd ilma võltsosaluseta kas `authorSupervisorUserId` või `authorParticipationId` viidet; andmebaasi CHECK lubab täpselt ühe elava autoritüübi või konto kustutamisel ajatempliga anonüümse autori. Serializer eristab `SUPERVISOR`/`PARTICIPANT`/`DELETED` autorit ning SV jagamis- ja tagasivõtmisõigus on teenuse- ja UI-lepingutestiga tõendatud.
- `SOL-SUP-04` P1 — osaleja lahkumise olek on mudelis olemas, kuid sellesse jõudmise funktsioon puudub — DONE — osalejal on nüüd kahe sammuga kinnitatav lahkumistoiming, mis seab protsessiluku all `LEFT`/`leftAt`, kirjutab `PARTICIPANT_LEFT` auditi ja teavitab superviisorit ning allesjäänud aktiivseid liikmeid. Lahkunud vaade säilitab ainult lahkumiseelse sisu; võõras osalus annab HTTP 404. Viimase osaleja lahkumine lõpetab muidu kinnijääva ootel kokkuvõtte ning sama luku all värskelt kontrollitav kinnitusrada ei luba lahkunul hiljem kinnitada. Ühik- ja HTTP-plokk on 92/92 roheline; PostgreSQL-sondi deterministlik leave-vs-approve võistlus kinnitas ühe võitja, ühe lahkumisauditi ja püsiva teavituse.
- `SOL-SUP-05` P1 — läheneva supervisioonikohtumise teavitus on surnud funktsioon — DONE — olemasolev notification-job käivitab supervisiooni eraldatud etapina; sweep lehitseb 48 tunni akna stabiilse `(plannedAt,id)` võtmega ning loeb iga kandidaadi protsessi ja ACCEPTED-liikmed värskelt. Dedupe sisaldab täpset kohtumisaega, seega kordusjooks ei dubleeri, aga ümbertõstmine loob uue teate. Ühiktest katab 2,5 batch'i, korduse, ümbertõstmise, CANCELLED/CLOSED read ja lahkunud liikme; päris PostgreSQL-sond kinnitas samad põhiinvariandid.
- `SOL-SUP-06` P1 — isiklik väljund nimetab kinnitamata aktiivse lepingu kasutaja viimati aktsepteeritud lepinguks — DONE — sulgemine lubab teadlikult ka OS_STALE osalejaga lõpetada, kuid M12 `lastAcceptedContractBody` arvutatakse nüüd iga omaniku acceptance-ajaloost eraldi. Superviisor saab aktiivse versiooni, osaleja enda suurima kinnitatud versiooninumbri ning kinnitamata aktiivset teksti talle ei omistata. Grupi ühiktest ja PostgreSQL-sond tõendasid, et v2 kinnitanud osaleja saab v2 ning v1 juurde jäänud osaleja v1.
- `SOL-SUP-07` P1 — protsessilukk ei kaitse mitme teenuse pre-lock õiguse- ja olekukontrolli vananemise eest — DONE — protsessi, kontrakti, kutse, kohtumise, kokkuvõtte ja jagatud teema otsustavad õiguse- ning olekukontrollid loetakse advisory-luku callback'is samast tehingust uuesti; väljast loetud rolli või protsessi ei kasutata enam kirjutusotsuse autoriteedina. PostgreSQL-sondi kahe ühendusega deterministlik activate-vs-share võistlus peatas mõlemad kirjutajad, aktiveeris v2 esimesena ja tõendas seejärel ootel jagamise `CONTRACT_NOT_ACCEPTED` vastust ning puuduva M7 rea.
- `SOL-SUP-08` P1 — kokkuvõtte „üks kohtumise kohta / üks FINAL” kontroll pole luku sees atomaarne — DONE — `createSummary()` kordab MEETING/FINAL kardinaalsuskontrolli luku sees ja kaardistab DB `P2002` stabiilseks 409-ks. Migratsioon `20260814002000_sol_sup_summary_cardinality` asendas meetingId üldunikaalsuse kahe osalise unikaalindeksiga: üks elus kokkuvõte kohtumise kohta ja üks elus FINAL protsessi kohta; DISCARDED versiooni võib teadlikult asendada. Täis migratsioonikett oli 185/185 roheline ning kahe ühendusega PostgreSQL-võistlustes jäi nii FINAL-i kui MEETING-u puhul alles täpselt üks võitja; otsene duplikaat-FINAL kukkus DB-tõkkesse.
- `SOL-SUP-09` P1 — kasutajakonto kustutus võib kustutada kogu supervisiooniprotsessi ja selle auditi — DONE — omanik kinnitas PII-vaba tombstone'i lepingu. Konto kustutamise tehing nullib superviisori, osaleja ja superviisori-autori identiteediviited ning lisab kustutusaja, kuid säilitab jagatud protsessi, kontraktid ja acceptance'id, jagatud teemad, kinnitatud kokkuvõtted ja approval'id, closure'i ning sisuvaba auditi. M6 privaatkirjed ja M12 isiklikud pakid kustuvad koos kontoga. Privaatsuspoliitika §7.12 kirjeldab erandit ning jätab jagatud tõendi automaatse purge'i `AWAITING_POLICY` fail-closed olekusse kuni täpse tähtaja kinnitamiseni. Täis migratsioonikett on 186/186 roheline; päris PostgreSQL-i 47/47 sond tõendas eraldi superviisori ja osaleja kustutuse järel kõik säilimise, anonümiseerimise ja kustumise invariandid.
- `SOL-SUP-10` P2 — LAHK kasutaja saab sulgemise eelvaatest peidetud sisu olemasolu ja ID-sid — DONE — `closePreview()` lubab ainult SV/OS/OS† vaataja, tagastab LAHK/KUT/ADMIN/võõrale ühetaolise 404 ning ehitab mitte-SV pending-ID-d ja teema-/kokkuvõtteloendused ainult tema nähtavast vaatest. Teenusetest katab kõik keelatud rollid ning OS-i eest peidetud SUPERVISOR_ONLY teema ja SV mustandi.
- `SOL-SUP-11` P1 — pöördumatu sulgemise eelvaade ei ütle, et kogu kontraktiraam ja kinnitusfaktid jäävad alles — DONE — close-preview tagastab `retentionManifestVersion:1` manifesti kontraktiversioonide, acceptance'ide, auditirea (koos tulevase close-sündmusega), closure/faktide, APPROVED kokkuvõtete, kohtumiste, M6 ja M12 kohta ning sulgemisleht kuvab kõik objektiklassid enne kinnitamist. Lepingutest võrdleb manifesti sulgemisjärgse andmebaasiseisuga ja eraldi kontroll tõendab, et kustutusloendus hõlmab ka päriselt kustuvat DISCARDED rida.
- `SOL-SUP-12` P2 — kokkuvõtete „reaalajas” kinnitusseis ei värskene teiste osalejate tegevuse järel — DONE — protsessivaade värskendab aktiivse ja nähtava dokumendi kokkuvõtteala iga 10 sekundi järel, peatub taustal/CLOSED olekus ning teeb nähtavaks muutumisel kohe uue päringu; cleanup eemaldab taimeri ja listener'i. Kahe päris brauserikliendi läbisõit tõendas, et ühe osaleja kinnitus muutis teise vaates ilma tema toiminguta seisu `Ootab 1/2 kinnitust` ning teine kinnitus muutis esimese vaates staatuse `APPROVED`.
- `SOL-SUP-13` P1 — ootel kokkuvõtte saab API-ga discard'ida, kuid UI-st puudub ainus sulgemist vabastav parandusrada — DONE — omanik kinnitas, et PENDING rea tagasivõtmine kustutab selle kinnitused, märgib kõik ootel kokkuvõtteteavitused loetuks ja peidetuks ning kirjutab sisuvaba `SUMMARY_DISCARDED` auditi; asenduskokkuvõte alustab kinnitamist nullist. Superviisoril on DRAFT/PENDING real selge tagasivõtmisnupp koos tagajärgede kinnitusega ning aegunud teavituse serveripoolne sihtkontroll nõuab endiselt PENDING olekut ja kinnitamata osalust. Teenusetest tõendab approval'ide, teavituste ja auditi saatuse. Kahe päris konto brauserivoog tõendas `1/2` osalise kinnituse → kinnitatud discard'i → osaleja tühja kokkuvõttevaate → superviisori eduka kaheastmelise sulgemise.
- `SOL-SUP-14` P2 — protsesside „viimane tegevus” järjekord ei kajasta mitut põhitoimingut — DONE — `SUPERVISION_ACTIVITY_EVENTS` fikseerib jagatud/protsessi tegevuste kanoonilise loendi ja jätab M6 privaattoimingud teadlikult välja. Puudunud kontraktiversiooni loomine, kokkuvõtte muutmine/submit ja teema tagasivõtmine uuendavad nüüd `lastActivityAt` samas advisory-lukustatud tehingus; tabeltest kontrollib iga varem puudu olnud rada täpse ajaga ning eraldi create/update/delete M6 kontroll tõendab tegevusaja muutumatust.
- `SOL-SUP-15` P2 — continuity võib jätta aktiivsed protsessid ja järgmiste kohtumiste ettevalmistuse vaikides leidmata — DONE — continuity loeb kõik ACCEPTED osalused ja kõik PENDING kokkuvõtted stabiilses `updatedAt,id` järjekorras enne lõpliku kahe kirje valikut. Ettevalmistuse marker on nüüd kasutaja SHARED teema seos just järgmise PLANNED kohtumise `agendaTopicIds` väljaga, mistõttu eelmise kohtumise teema ei vaiki järgmist märguannet. Test leiab sihttöö 21. protsessist ning läbib kolme kohtumise jada: esimese agenda ei kata teist, teise agenda katab teise ja kolmas vajab uut markerit.

**Kovisioon** (`SOL-COV`, 8/8)

- `SOL-COV-01` P1 — konto kustutus võib anda sama e-posti uuele kontole aktiivse kovisiooni ligipääsu — DONE — konto kustutuse lõpptehing muudab kasutaja osalused `EXPIRED` tombstone'iks, eemaldab `userId` ja e-posti ning märgib `identityErasedAt`; kõik e-posti varuvasted ja jagatud actor-lookup välistavad kustutatud identiteedi. PostgreSQL-i sond kustutas ACCEPTED konto, lõi sama e-postiga uue konto ning tõendas ligipääsu puudumist shared tööruumi-, sessiooni- ja legacy-päringus; kõnerada kasutab sama parandatud actor-lookup'i.
- `SOL-COV-02` P1 — ekslikku või enam kehtivat osalejakutset ei saa tagasi võtta ega aeguma panna — DONE — server ja UI toetavad kutsutu keeldumist, juhi/kaasmoderaatori tühistamist ning kordussaatmist; kutsel on 14-päevane serveriaeg, taustasweep muudab aegunud kutsed terminalseks ja katkestab outboxi. Tühistamine sulgeb järgmise päringu kohe ning salvestab otsustaja/aja ja append-only auditi. PostgreSQL-i lukustatud revoke-vs-accept võistlus tõendas, et täpselt üks käsk võidab ja tühistamise järel on avatud vahekaardi järgmine päring 404.
- `SOL-COV-03` P1 — API lubab kutse nõustumisjärjekorrast mööda minna ja avab sisu enne valmisolekut — DONE — server nõuab monotoonselt rollikinnitust enne kokkulepet ja mõlemat enne `ready`; `ACCEPTED` ning konto sidumine tekivad alles viimasel sammul. Osaliselt kinnitatud osaleja saab ainult minimaalse sisuta vaate ja kõik muud mutatsioonid nõuavad `readyAt` olemasolu. Sihttestid katavad iga vale järjekorra ning PostgreSQL-i sond tõendab enne valmisolekut peidetud pealkirja ja read-only vaate.
- `SOL-COV-04` P1 — kovisiooni kutse võib jäädavalt kaduda, kuigi API raporteerib toimingu edukana — DONE — kutse ja `CovisionInviteDelivery` tekivad samas tehingus nii generic kui sessioonirajal. Teavitustöö claimib CAS-iga, kasutab piiratud backoff'i ja stabiilset Message-ID-d, märgib timeout'i `UNKNOWN` ning puuduva saatja `FAILED`; terminalne osalus tühistab ootel tarne. Juht näeb tarneolekut ja saab sama outbox-rida turvaliselt uuesti järjekorda panna. Sihttestid katavad env-i puudumise, SMTP retry, timeout'i, püsiva ID ja resend'i; PostgreSQL-i sond tõendab päris outboxi `SENT` lõppseisu.
- `SOL-COV-05` P1 — `private_draft` tööobjekt salvestatakse ja jagatakse tegelikult kõigile osalejatele — DONE — `private_draft` eemaldati jagatud tööobjekti serveri allowlist'ist; privaatmustandi ainus rada jääb kasutajaga seotud `SAVE_PRIVATE_STATE`/`CovisionPrivateState` mudelisse, mida teise osaleja päring ei lae. Negatiivtest saadab `private_draft` shared-käsu, saab `INVALID_WORK_STATUS` ning tõendab, et markerit, rida ega ID-d ei salvestatud.
- `SOL-COV-06` P1 — omaniku konto kustutamine hävitab kõigi osalejate lõpetatud juhtumi ja tõendusjälje — DONE — `CovisionCase` ja `CovisionClosure` omaniku FK on nüüd nullable `SetNull`; konto kustutuse samas tehingus külmutatakse rollisnapshot ja kustutusaeg. Jagatud juhtum, closure, follow-up, osalus ning sisuvaba audit säilivad, omaniku privaatne `CovisionOwnerPackage` kustub endiselt. PostgreSQL-i FK-sond tõendab kõiki neid lõppseise ning actor-seose tombstone'i.
- `SOL-COV-07` P1 — fikseeritud loendipiirid võivad peita aktiivse kutse või tähtaja ületanud järelvaate — DONE — eksitavad kõvad 100/200 lõiked eemaldati; server tagastab täieliku valimi ja sellest arvutatud täielikud loendurid. Tööruum tõstab kutsed stabiilselt ette ning closure-loendi kõik sordid kasutavad deterministlikku ID tie-break'i, tähelepanujärjestus hoiab `OVERDUE`, `DUE_TODAY` ja `DECISION_REQUIRED` ees. Mahutest leiab vana kutse 101 rea seast ning ainsa overdue closure'i ja õige loenduri 201 rea seast.
- `SOL-COV-08` P1 — osaleja- ja otsuseelutsüklil puudub taastatav auditirada — DONE — `CovisionAuditEvent` on sisuvaba append-only leping unikaalse idempotentsusvõtme, actor-rollisnapshot'i ja `SetNull` actor-seosega. Kõik sessiooni mutatsioonikäsud kirjutavad ühise tehingu lõpus auditi; eraldi sündmused katavad closure'i loomise, follow-up'i lõpetamise/ümberajastamise, lõppotsused ja arhiveerimise. Veasüstitest tõendab kutse, outboxi ja versiooni täielikku rollback'i auditiveal; PostgreSQL-i sond tõendab rolli/kokkuleppe/revoke jada ning konto kustutuse järel säilinud actor tombstone'i.

**Tõenduspõhised praktikad** (`SOL-PRAC`, 8/8)

- `SOL-PRAC-01` P1 — avaldamine arvestab aegunud, tühistatud või kustutatud retsensendi vana kinnitust — DONE — avaldamine ja READY_TO_PUBLISH parandustöö arvestavad ainult sama versiooni APPROVED otsuseid, mille taga on avaldamishetkel elus retsensent, aktiivne sama tüübi pädevus ja praktikale sobiv skoop. Madala ja kõrge riski tabeltest katab revoke'i, aegumise, vale skoobi ning REVIEWER/EDITOR/ETHICS konto kao; päris PostgreSQL-i sond tõendab, et aegunud ETHICS-kinnitus ei loo versiooni ega avalda.
- `SOL-PRAC-02` P1 — pädevuse loomulik aegumine või konto kustutus võib määratud ülevaatuse tähtajatult kinni jätta — DONE — teavituste perioodiline job käitab nüüd piiratud partiiga määranguparandust, mis tuvastab loomuliku aegumise, revoke'i, vale skoobi, autori konflikti ja konto kustutuse SetNull-rea. Parandus kasutab CAS-i, jätab asendaja puudumise nähtavalt lahendamata ja kirjutab sisuvaba auditi; päris PostgreSQL-i lukusond mõõdab nii review-first kui repair-first järjekorra ilma topeltotsuse või topeltmääranguta.
- `SOL-PRAC-03` P1 — kõvad 100/200/500 piirid peidavad praktikad, määratud tööd ja pädevused — DONE — avaliku kogu filtrid ja sortimine käivad nüüd andmebaasis ning praktika-, kandidaadi-, rakendamiskogemuse-, ülevaatus- ja pädevusloenditel on eraldi stabiilne cursor, `hasMore` ja serveri tervikloendur. Ülevaatusjärjekord lähtub otse kasutaja määrangust. Testid läbivad 201 avaldatud, 101 isiklikku ja määratud ning 501 pädevuse rida; päris PostgreSQL kinnitab otsingu, relation-count sortimise ja cursor-lepingu.
- `SOL-PRAC-04` P1 — RAG-i saadetud praktikatekst jätab välja praktika tõendus- ja õppimisaluse — DONE — RAG-tekst on väljade kaupa eelarvestatud struktureeritud dokument, milles säilivad tulemus, õppimispunktid, allikad ja tõendus koos konteksti ning piirangutega; kogu dokumendi pime lõpp-lõige eemaldati. Ingest/search adapteri integratsioonitest kasutab igas tõendusväljas unikaalset markerit ja leiab need nii saadetud tekstist kui otsingutulemusest.
- `SOL-PRAC-05` P1 — serveri „isikustamata” kontroll tunneb ainult kolme tüüpi otsest identifikaatorit — DONE — serveri riskiklassifikaator blokeerib e-posti, Eesti ja rahvusvahelise telefoni, isikukoodi, aadressi ning juhtuminumbri; nimekontekst ja asutuse-haruldase sündmuse kombinatsioon nõuavad enne avaldamist ETHICS-rolli püsivat põhjendatud privaatsusotsust. UI ütleb kolmes keeles, et automaatkontroll toetab, kuid ei asenda inimese vastutust; negatiivkorpus katab otsesed ja kaudsed taasidentifitseerimise näited.
- `SOL-PRAC-06` P1 — pikem professionaalne sisu kärbitakse salvestamisel vaikides — DONE — kandidaadi ja rakendamiskogemuse serveriteed tagastavad üle piiri sisendile stabiilse `INPUT_LIMIT_EXCEEDED` 400 koos välja ja limiidiga; teksti ega listi ei kärbita enam edukas vastuses. UI näitab teksti allesjäänud mahtu ning listi rea- ja elemendipiire. Tabeltest katab kandidaadi iga teksti/listi ja rakendamiskogemuse iga välja piir-1, piir ning piir+1 väärtusega nii loomisel kui uuesti esitamisel.
- `SOL-PRAC-07` P1 — RAG-i taastetöödel puudub repos tõendatud automaatne käivitaja — DONE — viieminutiline notification systemd service/timer on nüüd repos versioonitud ja käitab piiratud partiiga RAG-taastet: advisory-lukuga claim, aegunud claim'i ülevõtt, eksponentsiaalne backoff, `dead_letter`, terviseloendurid ning 207/systemd failed-alarm. Ühiktest katab batch'i, claim'i, backoff'i, dead-letter'i ja pooleli jäänud processorit; päris PostgreSQL-i katkestussond viib nii ingest'i kui delete'i pärast teenuse taastumist lõpuni ja eemaldab vana RAG-viite. Serveris kontrolliti timer `enabled` + `active`, viieminutiline unit ja edukas journalijooks.
- `SOL-PRAC-08` P1 — ülevaatustähtaja möödumine ei käivita uut kontrolli ega eemalda aegunud juhist RAG-ist — DONE — tähtaja saabumine loob ühe aktiivse ja skoobitud ETHICS-ülesande, mille olemasolev reconciler muudab idempotentseks teavituseks; aegunud pädevus ei saa ülesannet ning kordusjooks ei dubleeri seda. 14-päevase grace-period'i järel liigub praktika CAS-iga `RE_REVIEW` olekusse, vana tsükli ülesanded suletakse, uus rollitsükkel luuakse ja durable RAG_DELETE eemaldab aegunud juhise. Päris PostgreSQL-i 23/23 jadasond katab scheduler → assignment → notification → grace → RAG-taaste terviktee.

**Teemaseemned** (`SOL-SEED`, 5/5)

- `SOL-SEED-01` P1 — Kovisioonis, järelvaates ja suletud seemned muutuvad Teemaseemnete UI-s uuesti mustanditeks — DONE — kõik viis `TopicSeedStatus` olekut kasutavad üht kanoonilist olekukaarti, mille järgi renderdatakse silt, filter ja lubatud toimingud. `DRAFT` lubab muuta, järjekorda lisada ja kustutada; `WAITING` vaadata ja tagasi võtta; `IN_COVISION` avab seotud Kovisiooni, `FOLLOW_UP` järelvaate ning `CLOSED` on read-only ajalugu. Sihttestid 118/118; autenditud lokaalne brauser kontrollitud API-fixtuuriga näitas kõiki viit olekut ja nende eristuvaid toiminguid (`runtime: local_browser_run`, kontrollitud sünteetiline vastus).
- `SOL-SEED-02` P1 — omanik ei saa tundlikku mustandit kustutada ega WAITING üldistust tagasi võtta — DONE — omanik saab versioonikindlalt kustutada ainult sidumata `DRAFT`-seemne ning viia ainult sidumata `WAITING`-seemne tagasi privaatsesse `DRAFT`-olekusse. Mõlemad toimingud on transaktsioonilised ja auditeeritud; seotud ja hilisemates olekutes seemned on kaitstud. PostgreSQL-i sond tõendas auditi rollback'i, start/withdraw võistluse ühe võitjaga, sisurea kustumise ja sisuta auditikviitungi säilimise pärast konto kustutamist.
- `SOL-SEED-03` P1 — Kovisiooni mineva üldistuse isikustamatust tõendab ainult kliendi linnuke — DONE — enne `DRAFT → WAITING` üleminekut töötab serveripoolne deterministlik privaatsuse eelsõel. E-post, Eesti või välismaa telefon, kehtiv isikukood, nimi, täpne aadress ja juhtuminumber blokeeritakse; haruldaste kaudsete tunnuste kombinatsioon nõuab tavakinnitusest eraldi inimese privaatsusülevaadet. Püsivasse tõendisse lähevad ainult kategooriakoodid, mitte leitud isikuandmed. Negatiivkontroll tõendas, et vana rada lubas e-posti sisaldava seemne edasi.
- `SOL-SEED-04` P2 — `updatedAt`-põhine optimistlik lukk võib sama millisekundi kirjutused kokku lasta — DONE — TopicSeed kasutab monotoonset täisarvulist `version` CAS-i; `updatedAt` on ainult kuvamise metaandmed. Muutmine, järjekorda lisamine, Kovisiooni alustamine ja järjekorrast eemaldamine nõuavad oodatud versiooni ning edukas mutatsioon suurendab seda. PostgreSQL-i sond tõendas PATCH/PATCH, PATCH/queue, queue/PATCH, start/withdraw ja withdraw/start võistlustes täpselt ühe võitja; vana millisekundipõhise fingerprint'i negatiivkontroll lubas mõlemad kirjutajad läbi.
- `SOL-SEED-05` P2 — omaniku kogu Teemaseemnete ajalugu laaditakse ühe piiritlemata vastusena — DONE — omaniku ajaloo API kasutab piiratud cursor-paginatsiooni, serveripoolseid olekuloendureid ja stabiilset `updatedAt,id` järjestust; Kovisioonil on eraldi ainult sidumata `WAITING`-seemnete minimaalne järjekorra-API. PostgreSQL-i sond 20 005 reaga tõendas alla 64 KiB vastused, alla viie sekundi päringud ja duplikaadivabad cursor-lehed. Brauser renderdas algul 24 ja järgmise lehe järel 48 kaarti (`runtime: local_browser_run`, kontrollitud sünteetiline vastus).

**Teekond ja jagamine** (`SOL-JOUR`, 17/17)

- `SOL-JOUR-01` P0 — eelpöördumise teine jagamisvalik ei juhi tegelikult salvestatavat ega saadetavat teksti — DONE. Valitud on kriteeriumi TEINE haru: valikuid jääb kaks, aga
- `SOL-JOUR-02` P0 — seadmesse salvestatud tundlik Teekonna mustand võib samas vahekaardis järgmisele kontole taastuda — DONE — Teekonna kohalik mustand on kasutaja ID-ga omanikuskoobitud, omanikuta seade on lukus ning vana sildistamata rida kustutatakse. Sama vahekaardi brauserirada tõendas sünteetiliste kontodega, et A mustand taastus ainult A-le; serveripoolne sessiooni tühistamine, väljalogimine ja taaslaadimine ei näidanud seda B-le; CLIENT → SOCIAL_WORKER rollivahetus ei näidanud kliendimustandeid ning CLIENT-i naasmine ja vahekaardi taastamine tõid tagasi ainult B enda mustandi. Mõlemad sessioonid tühistati ja testandmed koristati; tootmisandmeid ei kasutatud (`runtime: local authenticated browser`).
- `SOL-JOUR-03` P1 — salvestusnormaliseerija hävitab Teekonna struktureeritud konteksti — DONE — Teekonna `context` kasutab versioonitud `schemaVersion: 1` lepingut ja väljade kaupa sügavusteadlikku normaliseerimist. `assistiveDevices`, `activityLog`, `helpMediation` ja `serviceContinuity` objektid ning objektimassiivid säilivad draft → create-normalize → serialize → update-normalize ringis; mitteskalaarsed väärtused ei muutu tekstiväljades `[object Object]` väärtuseks. Tõend: `tests/journey/contextRoundTrip.test.js`; DB-sondi ega brauserit ei ole vaja, sest invariant on deterministlikus DB-eelses normaliseerimises.
- `SOL-JOUR-04` P1 — tavaline detailvaate salvestus kustutab soovitatud tegevuste masinloetavad tüübid — DONE — detailvaate salvestus seob redigeeritud pealkirjaread olemasolevate tegevusobjektidega. Ainult pealkirja muutmisel säilivad `id`, `type` ja `description`; muutmata tegevused säilitavad kogu masinloetava struktuuri ning uus rida ei päri teise tegevuse metaandmeid. Serveri normaliseerija säilitab ka tegevuse ID. Tõend: `tests/journey/suggestedActionEditing.test.js`.
- `SOL-JOUR-05` P1 — kaks nähtavat Teekonna toimingut kirjutavad vana kliendiseisu konfliktita üle — DONE — kõik Journey PATCH-id nõuavad kliendile nähtavat `expectedUpdatedAt` versiooni; puuduv, vigane, aegunud või võistluse kaotanud versioon annab 409. Detaili teenuse jätkumise salvestus ja loendikaardi arhiveerimine saadavad versiooni kaasa. Päris PostgreSQL-i sond tõendas edit-vs-continuity, edit-vs-archive ja continuity-vs-continuity võistlustes iga kord täpselt ühe võitja ja ühe 409 kaotaja; vana rada võttis versioonita kirjutuse vastu.
- `SOL-JOUR-06` P1 — arhiveeritud Teekond jääb täielikult muudetavaks ilma taasavamata — DONE — `ARCHIVED` Teekonna sisumuudatus sulgub serveris 409-ga ning ainus lubatud muutmine on eraldi kehtiva versiooniga taasavamine; aegunud taasavamine saab samuti 409. UI peidab nii põhi- kui teenuse jätkumise redaktori ja selgitab taasavamise vajadust. Regressioonitest katab otsese PATCH-i, stale taasavamise ning archive → reopen → edit sündmusjada.
- `SOL-JOUR-07` P1 — vigane olekuväärtus taasavab Teekonna vaikimisi ACTIVE-ks — DONE — kliendi kaasa pandud `status`, `sharingStatus` ja `primaryPath` valideeritakse fail-closed: tühi või tundmatu väärtus annab stabiilse 400 väljavea ning vaikeväärtus rakendub ainult puuduvale create-väljale. Testid katavad iga enumi puuduva, tühja, kehtiva ja tundmatu väärtuse; `ARCHIVED` rea `{status:"TYPO"}` jääb muutmata. Vana normaliseerija oleks tundmatu staatuse `ACTIVE`-ks ja tundmatu suuna `null`-iks muutnud.
- `SOL-JOUR-08` P2 — klient saab Teekonna rollikontekstiks väita suvalise lubatud rolli — DONE — Journey `roleContext` pärineb ainult serveri lahendatud sessioonirollist; POST-keha samanimelist väärtust ei usaldata. Regressioonitest tõendab, et serveri CLIENT-kontekst jääb CLIENT-iks ka kliendi ADMIN, SOCIAL_WORKER, tühja või tundmatu väärtuse korral. Vana rada eelistas kliendi rolliväidet serveri faktile.
- `SOL-JOUR-09` P1 — vestluses loodud Teekond on eraldi kaduv rada ega talleta lähtevestluse seost — DONE — vestluse Journey-mustand salvestub sama vahekaardi `sessionStorage`-is omaniku ja `conversationId` järgi eraldatud võtmega ning taastub F5 ja vestluste A/B vahel liikumise järel. Salvestus tagab aktiivse vestluse olemasolu ja omandi ning edastab sama ID Journey loomisele; võõras vestlus lükatakse tagasi. PostgreSQL-i sond tõendas omaniku seose, võõra ID puhul 400 ilma Journey loomiseta ja vestluse kustutamisel `ON DELETE SET NULL` käitumise. Autenditud kohalik sama vahekaardi brauserirada tõendas F5-taaste, A/B eraldatuse ja õige päritoluseose; sünteetilised andmed koristati (`production runtime: NOT_PROVEN`).
- `SOL-JOUR-10` P1 — Abivahenduse jagamisvalikud ei mõjuta üleantavat kategooriat ega piirkonda — DONE — abisoovi handoff ei kanna enam Journey täisväärtusi URL-is. Autenditud omaniku-piiriga serverimarsruut koostab lubatud väljadest fail-closed projektsiooni ning välistab alati riskisignaalid. Autenditud kohalik runtime tõendas kõik kuus jagamisvalikut eraldi päriselt salvestatud abipalves, märkimata markerite ja riskimarkeri puudumise ning võõra või puuduva Journey üldise 404; sünteetiline sisu koristati nulljäägiga. Production runtime ja kahe eraldi konto brauseri-IDOR on NOT_PROVEN.
- `SOL-JOUR-11` P1 — ohu eitamine tekitab kriisihoiatuse ja kasutaja ei saa valet riskisignaali parandada — DONE — ohu tuletus eristab ET/EN/RU tekstis otsest vahetut ohtu, eitust, ajaloolist või võimalikku ohtu ning kolmanda isiku konteksti. Otsene vahetu oht säilitab fail-closed 112 teate ja `PRE_INQUIRY` raja; muud kontekstid ei saa valet 112 teadet ega sundrada. Teekonna omanik saab salvestatud riskisignaale detailvormis parandada või eemaldada ning positiiv- ja negatiivkorpus on roheline.
- `SOL-JOUR-12` P1 — ühe abivahendi seis omistatakse kõigile tekstist leitud abivahenditele — DONE — abivahendi seis, probleem, kasutuskontekst ja toe vajadus tuletatakse seadme lokaalsest lause- või fraasikontekstist ning lähimast seisuvihjest; usaldusväärse seose puudumisel jääb seis `UNSURE`. Vastandlike seisudega test tõendab, et katkise rollaatori olek ei kandu prillidele ega teadmata seisuga kuuldeaparaadile.
- `SOL-JOUR-13` P2 — piirkonnatuletus kohtleb Pärnut eri handoff'ides vastuoluliselt — DONE — Teenusekaardi, eelpöördumise ja abisoovi Journey-handoff'id kasutavad ühist KOV/maakonna resolverit. Resolver eristab tehnilise `municipalityId` väärtuse kuvanimest, ei esita ID-d nimena ning toetab Pärnu/Pärnus ja diakriitikata variante koos `vald`, `linn` ja `maakond` kujudega. Lepingutest tõendab sama Pärnu tulemuse kõigis kolmes handoff'is ja ID-põhise konteksti fail-closed käitumise.
- `SOL-JOUR-14` P1 — Teekonna „tehtud sammud” ei ole usaldatav tegevusajalugu — DONE — Teekonna tegevusajalugu tuleb omaniku järgi skoobitud append-only `DomainEvent` kirjetest; kliendi `context.activityLog` eiratakse loomisel ja PATCH-il. Detail kuvab serveri määratud järjestuses uusimad kaheksa lokaliseeritud sündmust ning create/update/archive/reopen kirjutavad sündmuse samas tehingus. Päris PostgreSQL-i sond tõendas 61 sündmust, uusima kaheksa järjestust ja konteksti PATCH-i võimetust ajalugu muuta.
- `SOL-JOUR-15` P2 — Teekonna põhi- ja seoseloendid kasvavad piiritlemata ning kirjutusradadel puudub mahupiir — DONE — Journey põhiloend ja seotud eelpöördumised kasutavad stabiilset `updatedAt + id` cursor-paginatsiooni, minimaalseid projektsioone, `totalCount`/`hasMore`/`nextCursor` lepingut ja olekufiltrit; UI laadib lehti nõudmisel. Draft-preview ja loomine on kasutajapõhiselt piiratud, omanikul kehtib 200 aktiivse ja 10 000 kogukirje piir ning loomine on klienditoimingu võtmega kordusohutu. PostgreSQL-i sond läbis 10 005 Journey-rida ja 10 005 seotud eelpöördumist ning viis paralleelkatset lõid ühe rea.
- `SOL-JOUR-16` P1 — enne jäädavat kustutamist pakutav eksport ei sisalda kogu Teekonda — DONE — kustutuseelne omaniku kontrollitud serverieksport annab versioonitud `sotsiaalai.journey.export` JSON-i kõigi kasutajale nähtavate väljade, struktureeritud konteksti, riskisignaalide, päritoluviite, serveriajaloo ja seotud eelpöördumiste minimaalse registriga; teadlikud väljajätud on failis nimetatud. Kohustuslik `JOURNEY_EXPORT` audit kirjutatakse enne failibaitide tagastamist samas tehingus ning auditiviga katkestab ekspordi fail-closed. Täidetud Journey võrdlustest tõendab ulatust.
- `SOL-JOUR-17` P1 — pikem Teekonna sisu ja loendid kärbitakse serveris vaikides — DONE — Journey valideerimine ei kärbi enam teksti ega loendeid vaikides. Üle piiri sisend tagastab stabiilse `JOURNEY_FIELD_TOO_LONG` või `JOURNEY_LIST_TOO_LONG` vea välja ja piiriga; UI näitab väljade piire ja kasutatud mahtu. Piiritest katab kõik teksti- ja loendiklassid väärtustel piir−1, piir ja piir+1 ning tõendab eduka normaliseerimise round-trip samasust.

**Eelpöördumised** (`SOL-PRE`, 18/18)

- `SOL-PRE-01` P0 — konto kustutamine jätab saatmata eelpöördumiste tundliku sisu autorita alles — DONE — saatmata mustandid kustutatakse samas lukustatud tehingus. Commit `97b28080`.
- `SOL-PRE-02` P0 — tagasivõetud organisatsioonipöördumise sisu saab hiljem avada ja uuesti töötajale määrata — DONE — terminalne seis ei anna sisu ega tööd. Sond `npm run org:recall:probe` 42/42 päris PostgreSQL-is.
- `SOL-PRE-03` P1 — eelpöördumine möödub teenusekaardi avaldamis- ja moderatsioonipiirist — DONE — eelpöördumise assistent ja create/update resolverid kasutavad tavakasutajale ainult `PUBLISHED` teenusekaardiridu; `NEEDS_REVIEW`, `DRAFT`, `HIDDEN` ja puuduv ID annavad ühetaolise 404 enne kirjutust. Väline saatmine kontrollib avaldamisseisu uuesti vahetult enne kõrvalmõju. `tests/preInquiries/recipientPolicy.test.js` katab rollid, kõik avaldamata seisud ning nullkirjutuse/nullsaatmise; ploki testslice 115/115 (`runtime: not_run`, invariant on serveripäringu tasandil).
- `SOL-PRE-04` P1 — klient saab teenusekaardi adressaadi e-posti ja nime serveris teise väärtusega asendada — DONE — teenusekaardi ID korral tulevad adressaadi nimi, e-post, tüüp ja platvormisisene omanik ainult värskelt avaldatud serverirealt. Vastuoluline kliendiväärtus annab 400 enne create/update kirjutust; entry A + email B ei tekita kirjet ega saatmist. Käsitsi e-post jääb eraldi rajaks ainult ilma `recipientEntryId`-ta ning saatmine võrdleb identiteeti uuesti aktuaalse avaldatud reaga. Tõend: `tests/preInquiries/recipientPolicy.test.js`, testslice 115/115 (`runtime: not_run`).
- `SOL-PRE-05` P1 — levinud eestikeelsed vägivallakirjeldused jäävad kriisiriskita — DONE — kriisirisk kasutab UTF-8 puhast ja diakriitikakindlalt normaliseeritud ühist riskiväravat. ET/EN/RU korpus katab lähisuhte- ja koduvägivalla, ähvarduse, enesevigastuse, eituse, ajaloolise juhtumi ning vahetu ohu; otsese ohu korral säilib kiire abi info sõltumata kontaktisoovitusest. Negatiivkontroll tõendas vana eestikeelse vale-negatiivse käitumise; `tests/preInquiries/assessment.test.js` on testslice'i 115/115 osa (`runtime: not_run`).
- `SOL-PRE-06` P1 — sõnad „pere”, „vanem” ja „noor” tekitavad ilma lapseta lastekaitsesuuna — DONE — lapsekaitsesuund nõuab nüüd lapse või alaealise selget semantilist konteksti; sõnad „pere”, „vanem” ja „noor” üksi seda ei käivita. Korpus eristab eakat vanemat, lapsevanemat, noort spetsialisti, noorukit, pere eelarvet ja otsest lapse turvariski ning säilitab samaaegselt muud tuvastatud eluvaldkonnad. Vana vale-positiivne käitumine kukkus negatiivkontrollis; testslice 115/115 (`runtime: not_run`).
- `SOL-PRE-07` P1 — piirkonnaga mitteseotud kontakt võib saada eksitava „kõrge kindluse” — DONE — iga soovitus kannab eraldi piirkonna-, vajaduse- ja kanalivaste tõendit ning `HIGH` on lubatud ainult nõutud vastete olemasolul. KOV-kontakt peab kattuma kasutaja KOV-iga; sama maakonna ja üleriigilise teenuse rajad on eraldi tähistatud ning puuduv piirkond või null sisulist vastet ei saa kõrget kindlust. Negatiivkontroll kattis vale KOV-i; testslice 115/115 (`runtime: not_run`).
- `SOL-PRE-08` P1 — eelpöördumise üldsalvestus kirjutab vana brauseriseisu konfliktita üle — DONE — autori PATCH nõuab nüüd `expectedUpdatedAt` väärtust ning võrdleb seda advisory lock'i all värske reaga enne CAS-kirjutust; puuduva või aegunud versiooni korral vastab server 409 ja ei kirjuta midagi. Vorm saadab kasutaja nähtud versiooni. Päris PostgreSQL-i sond kattis content-vs-content, recipient-vs-content, download-vs-edit ja archive-vs-edit võistlused: igas paaris võitis täpselt üks klient ning teine sai 409; vana tingimusteta kirjutus lasi mõlemad läbi ja kaotas esimese tulemuse. Sihttestid ja sond rohelised (`runtime: PostgreSQL probe`).
- `SOL-PRE-09` P1 — arhiveeritud saatmata eelpöördumine on endiselt muudetav ja tavalisel salvestusel taasavatav — DONE — `ARCHIVED` on üldise PATCH-i jaoks terminalne ning lubatud autori siirded on serveris tabelina jõustatud. Eraldi `/reopen` toiming viib ainult saatmata ja adressaadi poolt avamata kirje CAS-kaitstult tagasi `READY` olekusse; saadetud, avatud või asendatud kirjet autor taasavada ei saa ning tingimus on ka CAS-kirjutuses. UI ei paku arhiveeritud kirjele tavalist muutmist, vaid teadlikku taasavamist. Otsene PATCH, archive→reopen→edit, stale reopen-võistlus ja adressaadi elutsüklisse jõudnud kirje taasavamise keeld on regressioonitestidega kaetud (`runtime: not_run`; brauserit ei nõutud, sest ligipääsupiir jõustub teenuskihis).
- `SOL-PRE-10` P1 — autor saab luua vestlusruumi veel saatmata mustandist — DONE — vestlusruumi saab luua ainult sisemisest, adressaadile kohale toimetatud, tagasi võtmata ja adressaadi poolt vastu võetud eelpöördumisest. Autor ega adressaat ei saa ruumi enne vastuvõttu; tingimuste värske kontroll ja deduplikeeritud ruumiloome toimuvad samas tehingus ning route'i eraldi veaneelav järel-UPDATE on eemaldatud. Author-on-DRAFT, author-on-SENT, recipient-before/after-accept, deduplikatsioon ja veapiirid on sihttestidega kaetud (`runtime: not_run`).
- `SOL-PRE-11` P1 — välise e-kirja kasutajavoog ei märgi saatmist, serveri saatmisrada võib aga duplitseerida kirju — DONE — lukustatud leping on teadlik kasutajakinnitus pärast `mailto:` üleandmist: server ei saada selle raja kaudu ühtegi provider-kirja ega väida automaatset kättetoimetamist. Kinnitus salvestab advisory lock'i ja CAS-i all idempotentselt `SENT` oleku ning `externalSendConfirmedAt` aja; katkestus, DB-viga või aegunud versioon jätab kirje ausalt `READY` olekusse. `/send` tähendus on nüüd üksnes kasutaja välise saatmise kinnitus. Paralleel- ja veasüst-testid tõendavad null provider-send'i, ühe kinnituse ning taastatava oleku (`runtime: not_run`).
- `SOL-PRE-12` P1 — organisatsiooni vastuvõtulauda ei saa platvormi enda eelpöördumise UI-st valida — DONE — autentimist nõudev avalik organisatsiooni adressaadiprojektsioon väljastab ainult serveri postkasti-ID, avaliku nime, juriidilise liigi, piirkonna ja tegeliku `INTERNAL` kanali. UI näitab eraldi „Organisatsiooni vastuvõtutiim” valikut ning saadab `recipientOrganizationId`, mitte UI-tunnust teenusekaardi kirjena. Autenditud kohalik brauserirada saatis vormist organisatsiooni postkasti, säilitas autori eelvaates õige nime ning tõendas päris PostgreSQL-is täpselt ühe inbox-item'i ja `recipientOwnerId=null`; sünteetilised andmed koristati (`production runtime: NOT_PROVEN`).
- `SOL-PRE-13` P1 — organisatsioonile määratud mustandi tavaline PATCH kaotab organisatsiooni adressaadi — DONE — `updatePreInquiry()` loeb lukustatud värskelt realt `recipientOrganizationId` ning säilitab organisatsiooni adressaadi osalise PATCH-i korral. Adressaadi väljad kasutavad explicit-input semantikat, organisatsiooni muutus osaleb canonical-room piirangus ja suletud postkastivärav tagastab 409 ilma adressaati või sisu muutmata. Päris PostgreSQL-i kahe kliendi võistlus tõendas ühe CAS-võitja, ühe 409 kaotaja ja segunemata lõppseisu; explicit org→person vahetus on kaetud (`production runtime: NOT_PROVEN`).
- `SOL-PRE-14` P1 — organisatsioonipöördumise parandus kaotab adressaadi ega jõua postkasti — DONE — parandusrada kopeerib lukustatud serverirealt organisatsiooni adressaadi ja avaliku nime, loob paranduse inbox-item'i samas tehingus enne originaali `supersededById` sidumist ning kordusPOST tagastab sama paranduse uut kirjet loomata. Päris PostgreSQL-i sond kattis isiku- ja organisatsiooniadressaadid, ühe postkastikirje, korduskatse, autori ja organisatsiooni nähtavuse ning sunnitud postkastitõrke täieliku rollback'i (`production runtime: NOT_PROVEN`).
- `SOL-PRE-15` P1 — neli eelpöördumise route'i tagastavad avalikult toore backend-vea sõnumi — DONE — kõik eelpöördumise avalikud kirjutavad API-rajad kasutavad suletud veavastuste allowlist'i: lubatud 4xx võtmed säilitavad kontrollitud vastuse, tundmatu Prisma-, maileri- või muu sisemine viga muutub üldiseks 500 vastuseks ja logitakse `safeError` kujul. Negatiivtest süstis andmebaasiühendust ja SMTP saladust sisaldava markeri ning tõendas, et marker ei jõua vastusesse; neli varem lekkivat marsruuti ei väljasta enam `error.message` väärtust.
- `SOL-PRE-16` P1 — ühelgi 12 eelpöördumise route'il pole mahu- ega sageduspiiri — DONE — kõigil 12 kirjutaval eelpöördumise marsruudil on tegevuspõhine kasutaja- ja IP-piir koos 429, `Retry-After` ja `X-RateLimit` päistega. Aktiivseid DRAFT/READY/DOWNLOADED kirjeid võib olla kuni 250 ning piir jõustatakse kasutajapõhise PostgreSQL advisory lock'i all. Loomine kasutab kliendi UUID-võtit, sisu SHA-256 räsi ja unikaalset `[authorId, clientActionId]` piirangut: sama võti sama sisuga tagastab sama rea, teise sisuga 409. Päris PostgreSQL-i sond tõendas paralleelse loomise ühe rea, konfliktse korduse ja 251. aktiivse mustandi tagasilükkamise (`production runtime: NOT_PROVEN`).
- `SOL-PRE-17` P1 — pikk eelpöördumise sisu kärbitakse serveris vaikides — DONE — kasutaja sisendi vaikne `slice`-kärbe eemaldati eelpöördumise ja struktureeritud eelkaardistuse normaliseerijatest. Teema, olukord, mustandid, parandustekst, assistendi sisend, küsimustiku tekstiväljad ja loendid valideeritakse enne töötlemist ning piir+1 annab välja- või hindamispõhise 413 vastuse ilma sabamarkerit kaotamata. UI kannab vastavaid `maxLength` piire ja järelejäänud märkide loendureid; testid katavad piiri, piir+1, sabamarkeri ja loendimahu.
- `SOL-PRE-18` P2 — eelpöördumiste loendid lõpevad vaikides 100/250 rea juures — DONE — eelpöördumise põhiloend, Minu jagamiste eelpöördumised ja K1 vastuvõtja adapter kasutavad stabiilset `(updatedAt, id)` kursorit, piiratud projektsiooni ning `total/hasMore/nextCursor` metaandmeid; ID-detaililugeja jääb autoriteetseks detailipinnaks. Põhivaade ja K1 läbivad kõik lehed ning Minu jagamised pakub jätkulaadimist. Testid ja päris PostgreSQL-i sond tõendasid 257 kirje täieliku leidmise, võrdsed ajatemplid, duplikaatide puudumise, arhiveeritud piirirea ning üle lehepiiri kulgeva parandusahela mõlemad otsad (`production runtime: NOT_PROVEN`).

**Abikuulutused** (`SOL-HELP`, 13/13)

- `SOL-HELP-01` P1 — tavaline kuulutuse tekstiparandus võib peidetud kaardikirje uuesti avaldada — DONE — osaline kuulutuse PATCH kasutab puuduvate kaardiväljade alusena olemasolevat `HelpMapEntry` kirjet ning muudab ainult teadlikult saadetud väärtusi. Tekstiparandus säilitab nähtavuse, kaardirežiimi, kontaktiviisi, staatuse, aadressi/geokodeeringu, teenindusala ja tarneviisid; kogu PATCH nõuab sama revisjoni. Negatiivkontrollis avaldas vana kood peidetud kirje uuesti; uus request/offer test katab `HIDDEN`, `mapVisible:false`, `PHYSICAL` ja kõik kontaktiviisid.
- `SOL-HELP-02` P1 — kuulutuse ja selle kaardikirje kirjutus ei ole atomaarne — DONE — `HelpRequest`/`HelpOffer` create või update ja vastava `HelpMapEntry` upsert commit'ivad ühes Prisma tehingus. Kaardikirjutuse vea korral pöörduvad põhikirje sisu ja revisjon tagasi ning sama create kordus jätab ühe kuulutuse ja ühe kaardikirje. Vana käitumise negatiivkontroll jättis nurjunud kirjutuse järel põhikirje püsima; päris PostgreSQL-i veasüst kattis mõlema liigi create/update rollback'i ja korduspäringu.
- `SOL-HELP-03` P1 — kuulutuse redigeerimine kirjutab vana brauseriseisu konfliktita üle — DONE — PATCH nõuab kehtivat `expectedUpdatedAt` väärtust ja põhikirjutus kasutab `id + updatedAt` CAS-i samas tehingus kaardisünkrooniga. Aegunud parandus saab 409 koos värske minimaalse kuulutuse ja kaardiseadete vaatega. Kahe sama revisjoniga paralleelparanduse test ja päris PostgreSQL-i sond annavad ühe võitja ning ühe konflikti nii abisoovile kui abipakkumisele.
- `SOL-HELP-04` P1 — omanik saab API kaudu teha suvalise kuulutuse olekusiirde — DONE — üld-PATCH lükkab otsese `status` muutmise tagasi. Nimetatud `PUBLISH`, `MARK_MATCHED`, `CLOSE`, `CANCEL`, `ARCHIVE` ja `REOPEN` toimingud järgivad serveri lähte- ja sihtolekute tabelit, nõuavad põhjust ning kirjutavad samas tehingus sisuminimaalse auditi ja kaardiseisu. Testid katavad mõlema kuulutuseliigi kõik lubatud ja lubamatud lähteolekud, puuduva põhjuse, aegunud versiooni, auditivea rollback'i ja route'i otsekutse lepingu.
- `SOL-HELP-05` P1 — vana nõusolekupäringu saab vastu võtta pärast kuulutuste sulgemist, aegumist või kokkusobimatuks muutmist — DONE — ACCEPT lukustab Serializable-tehingus sobituse, abisoovi ja abipakkumise ning kontrollib uuesti olekut, aegumist, omanikke ja sobivust. Muutunud alus sulgeb PENDING-sobituse ilma ruumi loomata ja API vastab 409; varem kinnitatud pehme abi- või ajatüübi erand säilib. Negatiivkontroll kattis suletud, aegunud, kokkusobimatu ja vahetunud omanikuga aluse; päris PostgreSQL-i sond tõendas luku ootamist ja värske oleku nägemist (`production runtime: NOT_PROVEN`).
- `SOL-HELP-06` P1 — sobituse teavitus ei ole sobituse loomisega usaldusväärselt seotud — DONE — PENDING-sobitus ja `HELP_MATCH_CONSENT_REQUEST` teavitussündmus luuakse samas teenuse tehingus ning nii route kui vestluse connect-rada kasutavad sama teenust. Teavituse veasüst pöörab tagasi sobituse ja teavituse; kordus ei loo duplikaati ning taastab puuduva teavituse idempotentselt. Päris PostgreSQL-i sond kattis tehingu ja taastamise (`production runtime: NOT_PROVEN`).
- `SOL-HELP-07` P1 — sobituse API lekitab privaatse vabateksti kattuvad märksõnad — DONE — sobituse loomise ja otsuse API-vastused läbivad täpse allowlist-projektsiooni: `id`, `status`, `roomId`, `createdAt`, `updatedAt` ja `wasCreated`. `reasonsJson`, skoor, osapoolte ja kuulutuste ID-d ning vabateksti kattuvused jäävad serverisse. Tundlike kattuvussõnade ja privaatsete ID-de negatiivtest tõendab nende puudumise vastusest (`production runtime: NOT_PROVEN`).
- `SOL-HELP-08` P1 — PENDING-sobitust ei saa tagasi võtta ega automaatselt aeguma panna — DONE — algataja saab PENDING-sobituse `WITHDRAW` toiminguga terminalsesse `CLOSED` olekusse viia ning hilisem ACCEPT vastab 409 ega loo ruumi. Saabuvate nimekiri sulgeb serveris aegunud või mitteavatud allikaga PENDING-sobitused ja kasutab stabiilset `createdAt + id` cursor-pagination'it. Test ja päris PostgreSQL-i sond läbisid kõik 27 rida kahe lehega ning tõendasid aegunud sobituse eemaldamist ja sulgemist (`production runtime: NOT_PROVEN`).
- `SOL-HELP-09` P1 — kuulutuse kustutamine eemaldab accepted-match'i, kuid jätab ruumi elama — DONE — ACCEPTED-sobitusega abisoovi või abipakkumise DELETE ei tee enam kõvakustutust: kuulutus viiakse atomaarse Serializable-tehinguga `CLOSED` olekusse ja kaardikirje peidetakse, samal ajal säilivad `HelpMatch` nõusolekutõend, ruum ning mõlema osalise liikmesusajalugu teadliku `PRESERVE_ROOM_AND_MEMBERSHIP_HISTORY` poliitikaga. Enne sulgemist kontrollitakse ruumi ja osaliste liikmesuste kooskõla; puudulik seos vastab 409 ega kirjuta osalist edu. Kohustuslik põhjusega audit tekib samas tehingus ja kordus ei dubleeri seda. Mõlemad HelpMatch-allikaseosed kasutavad nüüd `ON DELETE RESTRICT`; päris PostgreSQL-i sond kattis säilimise, välisvõtme ja rollback'i (`production runtime: NOT_PROVEN`).
- `SOL-HELP-10` P1 — mitmel abi- ja aadressiotsingu rajal puudub sageduspiir — DONE — kõik leius nimetatud rajad kasutavad PostgreSQL-is jagatud kasutaja+IP+toimingu põhist limiterit; välise geokodeerija kutsel on eraldi kvoot, ületamine tagastab 429 ja salvestuskihi puudumine sulgeb raja 503-ga. Migratsioon `20260814008000_sol_help_durable_rate_limit` lisab atomaarse loenduri ning päris PostgreSQL-i koondsond tõendas kahe paralleelse protsessi ühist limiiti ja toimingute eraldi kvoote. Production runtime: NOT_PROVEN.
- `SOL-HELP-11` P1 — pikk kuulutuse sisu kärbitakse edukal salvestusel vaikides — DONE — abisoovi ja abipakkumise kasutajateksti ei kärbita enam edukal salvestamisel vaikides. Keskseid piire ületav sisend saab välja, piiri ja tegeliku pikkusega 413 vastuse; redaktor rakendab `maxLength` piirid ja näitab tähemärgiloendurit. Piir-1, piiri ja piir+1 kontrollid katavad kõik tekstiväljad ning sabamarker ei salvestu kärbitult. HELP-eelvaate vigased kodeeringufallback'id parandati ja inimkeelsed tekstid lisati ET/EN/RU kataloogidesse. Brauseri kordustest: NOT_PROVEN.
- `SOL-HELP-12` P2 — Teenusekaardi abiotsing filtreerib alles pärast 1000 uusima kirje võtmist — DONE — HELP-kaardikirjete märksõna- ja piirkonnafiltrid rakenduvad DB-päringus enne `take`-piiri ning lehitsemine kasutab stabiilset `(updatedAt,id)` cursor'it koos `page` plokiga. Päris PostgreSQL-i sond leidis täpse vanema vaste 1002 kirje tagant ning läbis võrdse `updatedAt` väärtusega read kadude ja duplikaatideta. Production runtime: NOT_PROVEN.
- `SOL-HELP-13` P2 — abi vahendamise olekumudeli mitu seisundit ei ole tootmiskoodis saavutatavad — DONE — rakendatud poliitika on üks aktiivne aktsepteeritud sobitus kuulutuse kohta. ACCEPT viib mõlemad allikad samas Serializable-tehingus `MATCHED` olekusse, peidab kaardikirjed ning loob ja seob ruumi; esimene HELP_MATCH-ruumi sõnum viib sobituse `CONTACTED` olekusse ning ruumi arhiiv lõpetab sobituse ja allikad `CLOSED` olekusse. Nõusolekutõend, ruum ja liikmesusajalugu säilivad allikakuulutuse kustutussoovi järel. Sihttestid ja päris PostgreSQL-i koondsond tõendasid olekud, kaardinähtavuse ja rollback'i. Production/browser runtime: NOT_PROVEN.

**Võrgustikutöö** (`SOL-NET`, 13/13)

- `SOL-NET-01` P0 — paralleelne muutmine võib kinnitada teksti, mida klient ei näinud — DONE — kinnitus viitab TEKSTILE, mitte reale. Sond `npm run net:share:probe` 30/30 päris PostgreSQL-is.
- `SOL-NET-02` P0 — paralleelne muutmine ja saatmine võivad edastada kinnitamata uue teksti — DONE — `SENT` nõuab sama versiooni kinnitustõendit. Sama sond, `net:share:probe` 30/30.
- `SOL-NET-03` P1 — ruum ja liikmed luuakse enne jagamise saatmisoleku commit'i — DONE — `sendNetworkShare` nõuab jagamise tingimuslikult endale ja loob `SENT` oleku, ruumi, liikmed, `roomId` seose ning sisuvaba outbox-rea ühes Serializable PostgreSQL-i tehingus. Ruumi- või outbox-tõrge pöörab kogu saatmise tagasi ning kirjutuskonflikt muutub avalikuks veaks. Migratsioon `20260813235900_sol_net_03_room_origin_unique` laiendab osalise unikaalindeksi `NETWORK_SHARE` päritolule. Päris PostgreSQL-i sond tõendas rollback'id, kahe paralleelse saatmise ühe võitja ja DB-tasandi ühe ruumi piiri. NOT_PROVEN: toodangu migratsioon ja deploy.
- `SOL-NET-04` P1 — saaja loeb kogu sisu enne, kui süsteem märgib selle avatuks — DONE — saaja nimekiri tagastab enne avamist ainult sisuvaba ümbriku; tundlik sisu ja ruumiviide jõuavad brauserisse eraldi `/open` operatsiooni vastuses pärast tingimuslikku `OPENED` kirjutust. Keskne ruumivärav keelab saaja `SENT` ruumi otselingi ning tagasivõtmine eemaldab avamata saaja ruumiligipääsu samas tehingus. Sihttestid ja päris PostgreSQL-i sond tõendasid ümbriku, avamise, detaili, otselingi ning avamise/recall'i võistluse. Autenditud visuaalne brauserirada ja production runtime: NOT_PROVEN.
- `SOL-NET-05` P1 — kohustuslik kaasamise lõppkuupäev ei lõpeta ligipääsu — DONE — lõppkuupäev on serveripoolne ligipääsupiir: saatmine ja avamine keelduvad tähtajale järgneval UTC päeval, detailiprojektsioon ja keskset väravat kasutavad ruumirajad sulguvad ning lõppkuupäeva enda jooksul jääb ligipääs kehtima. Teavitustööga ühendatud idempotentne sweep viib aegunud jagamise `ENDED` olekusse, eemaldab aktiivsed ruumiliikmed ja arhiveerib ruumi ühes tehingus; tõrke järel saab töö korduda. Sihttestid ja päris PostgreSQL-i sond tõendasid piire, rollback'i ja kordust. Production cron ja monitooring: NOT_PROVEN.
- `SOL-NET-06` P1 — välise kliendi raamlepingut kontrollitakse ainult mustandi loomisel — DONE — välise kliendi rajal kontrollitakse töötaja ja saaja kehtivat praeguse versiooni raamlepingu aktsepti uuesti nii kliendi otsuse ülekandmisel kui ka Serializable saatmistehingu sees enne `SENT`, ruumi ja outbox'i loomist. Sihttestid ja päris PostgreSQL-i sond tõendasid töötaja aktsepti kadumist pärast DRAFT-i ning saaja aktsepti kadumist pärast CONFIRMED olekut; mõlemad suleti 403 veaga ilma ruumi või saatmisolekuta. Production runtime ja deploy: NOT_PROVEN.
- `SOL-NET-07` P1 — tagasivõetud või saatmata eelpöördumisest saab luua uue võrgustikujagamise — DONE — võrgustikujagamise loomine ja saatmine kontrollivad esialgsel laadimisel ja tehingu sees, et lähte-eelpöördumine kuulub praegusele töötajale, on päriselt saadetud, pole tagasi võetud ega uuema parandusega asendatud. Sihttestid ja päris PostgreSQL-i sond tõendasid RECALLED-, superseded- ja saatmata allika fail-closed keeldumist. Production runtime: NOT_PROVEN.
- `SOL-NET-08` P1 — rolli kaotanud endine töötaja säilitab jagamiste täisvaate ja muutmistoimingud — DONE — töötaja täisdetail, PATCH, submit, attestation, send ja recall kontrollivad lisaks algsele `workerId` seosele sessiooni praegust lubatud töötajarolli. Rolli kaotanud konto detail sulgub üldise 404-ga ja mutatsioonid 403-ga; sessioonist sõltumatu serveritest kontrollib väravat kõigis töötajaradades. Production autentitud runtime: NOT_PROVEN.
- `SOL-NET-09` P1 — kontoga klient saab otse-API kaudu näha veel esitamata töötaja mustandit — DONE — kliendi list ja detail kasutavad sama allowlist-projektsiooni ning lubavad ainult `AWAITING_CLIENT` ja teadlikult defineeritud hilisemad olekud. DRAFT ei jõua kummastki otse-API pinnast kliendini; negatiivtest tõendab fail-closed null/404 käitumist. Production autentitud runtime: NOT_PROVEN.
- `SOL-NET-10` P1 — võrgustikujagamise elutsüklis puuduvad teavitused, outbox ja audit — DONE — CREATE, UPDATE, SUBMIT, DECIDE, ATTEST, SEND, OPEN, RECALL, RESPOND ja END siirded kirjutavad olekuga samas DB-tehingus minimaalse `DomainEvent`/outbox-rea ja `DataAuditLog`-i ilma vabatekstita. Projector loob adressaadipõhised idempotentsed teavitused; testid ja päris PostgreSQL tõendasid projectori seisu, kordust ning osalise tarne vea järel taastumist. Production projectori käitus: NOT_PROVEN.
- `SOL-NET-11` P1 — ühelgi kaheksast võrgustikujagamise route'il pole sageduspiiri — DONE — kõik võrgustikujagamise route'id kasutavad püsivat PostgreSQL-i kasutaja+toimingu piirangut ning usaldatud proxy-aadressi korral ka IP+toimingu piirangut. Mutatsioonid nõuavad `Idempotency-Key` päist, leiavad püsiva replay uues protsessis ja seovad korduse õige ressursiga. PostgreSQL-i sondi kaheksa eraldi protsessi lubasid täpselt kolm katset ja tõrjusid viis; ühine IP-piir rakendus eri kasutajatele. Production proxy-headeri seadistus: NOT_PROVEN.
- `SOL-NET-12` P2 — võrgustikujagamise loendid lõpevad 100 rea juures ilma paginatsioonita — DONE — worker-, client- ja recipient-loendid kasutavad stabiilset `updatedAt + id` cursor-paginatsiooni, serveripoolseid source/status filtreid, rollipõhist minimaalset projektsiooni ja `nextCursor` vastust. Mõlemad UI-tarbijad loevad kõik lehed; PostgreSQL-i sond ja sihttest tõendasid 103 võrdse ajatempliga kirje täielikku duplikaadivaba läbimist. Production suurandmete runtime: NOT_PROVEN.
- `SOL-NET-13` P2 — `RESPONDED` ja `ENDED` olekud ning tähtajaline ligipääsu lõpetamine on teostamata — DONE — saaja esimene lubatud ruumisõnum viib seotud jagamise idempotentselt `RESPONDED` olekusse samas sõnumitehingus. Tähtaja sweep viib jagamise `ENDED` olekusse, kirjutab elutsüklisündmuse ja lõpetab samas tehingus aktiivsed ruumiliikmesused. Sihttestid ja PostgreSQL-i sond tõendasid RESPONDED siirde, ENDED rollback/retry ning kogu ruumipääsu eemaldamise. Production ajastatud sweep: NOT_PROVEN.

**Refleksioonid** (`SOL-REF`, 9/9)

- `SOL-REF-01` P1 — sama refleksiooni paralleelsed muutmised kirjutavad üksteise vaikides üle — DONE — PATCH nõuab `expectedUpdatedAt` väärtust ja teeb omanikuskoobitud CAS-kirjutuse. Aegunud kirjutus tagastab 409 koos serveri praeguse avaliku kirjega; UI säilitab kasutaja mustandi ning kuvab kohaliku ja serveri versiooni kõrvuti. Kahe ühenduse PostgreSQL-i sond kinnitas täpselt ühe võitja ja ühe 409 ning brauseritõend mõlema konfliktiteksti säilimise.
- `SOL-REF-02` P2 — Meetodipeegel talletab kontrollimata allikaviite ja kolm lubatud allikaliiki on kasutajateelt sisuliselt surnud — DONE — uute allikaviidete leping piirati päriselt kasutajateega `PRE_INQUIRY` liigile; enneaegsed ARTIFACT, MEETING ja CALL liigid lükatakse 400-ga tagasi. PRE_INQUIRY olemasolu ja adressaadipoolne omand kontrollitakse serveris ning puuduv ja võõras allikas annavad sama üldise 404. PostgreSQL-i sond kinnitas omandipiiri ja allika hilisema kustutuse järel refleksiooni säilimise `deleted` olekuga; ajalooliste liikide lugemistugi säilis.
- `SOL-REF-03` P2 — vigane allikafilter avardub vaikides kõigile omaniku refleksioonidele — DONE — mõlema allikaparameetri puudumine tähendab filtreerimata omanikuloendit, kuid ainult ühe parameetri olemasolu või tundmatu liik annab 400. Sihttest katab puuduvad, poolikud ja tundmatu liigi kombinatsioonid; vigane filter ei saa enam päringut kõigile omaniku kirjetele laiendada.
- `SOL-REF-04` P2 — Meetodipeegli loend lõpeb 50 kirje juures ja veab iga rea täissisu brauserisse — DONE — refleksiooniloend kasutab stabiilset `(createdAt DESC, id DESC)` keyset-cursorit, tagastab `page.nextCursor` ning laeb ainult kaardivaate minimaalsed väljad. UI-l on „Näita veel” ja ID-põhine deduplikatsioon. PostgreSQL-i sond läbis 51+ sama ajatempliga kirjet kadude ja duplikaatideta; brauseritõend kinnitas järgmise lehe lisamise ja kattuva ID deduplikatsiooni.
- `SOL-REF-05` P2 — tühje ja korduvaid refleksioone saab piiramatult luua — DONE — loomine nõuab vähemalt üht sisulist välja ja `Idempotency-Key` päist. `(ownerUserId, idempotencyKey)` unikaalsus ja päringuräsi muudavad korduse replay-safe'iks ning sama võtme erinev sisu annab 409; kasutaja+toimingu mahupiir püsib PostgreSQL-is. Päris DB sond kinnitas paralleelse sama võtmega loomise üheks reaks, erineva sisu konflikti, tühikukirje keelu ning 21. katse täieliku rollback'iga blokeerimise.
- `SOL-REF-06` P1 — kasutaja andmekoopia jätab kõik Meetodipeegli kirjed välja — DONE — andmekoopia sisaldab nüüd omaniku aktiivseid ja taastamisaknas olevaid `PracticeReflection` kirjeid koos sisu, allikaviidete ning ajatemplitega. Teise omaniku read ja sisemised idempotentsus-/retention-väljad jäävad välja. Registritest ning päris PostgreSQL-i sond tõendasid omaniku täieliku koopia enne kustutamist ja võõra sisu puudumise.
- `SOL-REF-07` P1 — privaatse mooduli lepingulise tähtaja lõpp ei käivita refleksioonide retention'it — DONE — jälgitava retention-tähtaja autoritatiivne allikas on omaniku privaatmooduli tellimuse `endsAt`; aktiivse lepingu pikenemine nihutab tähtaega edasi. Idempotentne monitooritud worker jätab tähtajaeelsed read alles, eemaldab aegunud read, salvestab nurjunud batch'i ning võimaldab kontrollitud retry. Päris PostgreSQL-i sond kinnitas tähtaja mõlemad pooled, kasutaja varasema kustutuse, konto FK-kaskaadi, lepingu pikenemise ja tõrkejärgse korduskatse. Tootmistaimeri tegelik jooks on `NOT_PROVEN`.
- `SOL-REF-08` P2 — kustutamisnupp eemaldab privaatse refleksiooni kohe ilma kinnituse või taastamiseta — DONE — kustutamine kasutab refleksioonisisu mittekordavat kinnitust, owner-skoobitud pehmet kustutust ja lühikest taastamisakent. Korduskinnitus on replay-safe ning võõras või puuduv ID ei avalda olemasolu. Regressioonitestid ja päris PostgreSQL-i sond katsid cancel/confirm-tee, topeltkinnituse, omaniku taastamise, aegunud undo ning võõra ID. Autenditud brauserirada jäi selles plokis `NOT_PROVEN`, kuid sama UI-olekumasin on deterministliku testiga lukustatud.
- `SOL-REF-09` P2 — aeglasem vana detailipäring võib uuema valiku vormi üle kirjutada — DONE — detailivaade katkestab eelmise päringu ja kasutab monotonset päringu-ID väravat, mistõttu ainult viimane valik tohib vormi kirjutada. Regressioonitest lõpetab A→B päringud järjekorras B→A ning kinnitab, et aktiivseks jäävad B vorm ja ID. Autenditud brauserirada jäi selles plokis `NOT_PROVEN`.

**Otsing** (`SOL-SEARCH`, 7/7)

- `SOL-SEARCH-01` P1 — autentimata otsingupäring võib enne 401 vastust käivitada kogu platvormi retention-cleanup'i — DONE — `/api/otsi` autentib kasutaja enne jagatud limiterit ega käivita enam säilitustööd avaliku lugemise kõrvalmõjuna. Eraldi autentitud retention-POST kasutab kogu sweep'i vältel PostgreSQL-i sessioonipõhist advisory-lock'i; konkureeriv protsess saab kontrollitud `202 already_running` vastuse ja retry-aja. Negatiivkontroll tõendab, et anonüümne päring ei jõua limiteri ega otsinguni; päris PostgreSQL-i kahe protsessi sond tõendas ühe aktiivse sweep'i, kontrollitud kaotaja ning õnnestunud korduskatse.
- `SOL-SEARCH-02` P2 — privaatne otsingutekst liigub URL-i query-string'is — DONE — isiklik otsing kasutab nüüd `no-store` POST-päringut JSON-kehaga ning GET tagastab 405; privaatne otsingutekst ei lähe URL-i. Autenditud lokaalne brauserirada sünteetilise markeriga tõendas puhta `/otsi` aadressi, markerita `POST /api/otsi` URL-i ja 0 markerivastet rakenduse arenduslogis. Toodangu proxy-, APM- ja systemd-logipinnad jäid `NOT_PROVEN`; deploy'd ei tehtud.
- `SOL-SEARCH-03` P2 — iga objektitüübi üheksas ja vanem vaste kaob ilma paginatsiooni või hoiatuseta — DONE — vestlusel, Teekonnal ja dokumendil on eraldi stabiilne ID-kursor, deterministlik ajatempel+ID järjestus, ühe rea lookahead ning aus `hasMore`/`nextCursor`; lõppenud liik ei alusta järgmisel lehel uuesti. Päris PostgreSQL-i sond läbis iga liigi üheksa võrdse ajatempliga rida kahe lehe kaudu: 27 tulemust, 27 unikaalset sihtmärki, duplikaate ega kadusid ei olnud.
- `SOL-SEARCH-04` P2 — dokumendi otsingutulemus ei ava leitud dokumenti — DONE — dokumendi otsingutulemus viib nüüd omaniku kontrollitud `/documents/[id]` detailvaatesse, mitte konstantsesse loendisse. Päris PostgreSQL tõendas eri dokumentidele eri sihtmärgid ja võõra omaniku kirje puudumise otsingust; autentitud brauser avas oma dokumendi detaili ning võõras ja olematu ID andsid sama üldise „Dokumenti ei leitud” vastuse.
- `SOL-SEARCH-05` P2 — ühe objektitüübi rike muudab kõik ülejäänud otsingutulemused kättesaamatuks — DONE — kolm otsinguallikat täidetakse paralleelse `Promise.allSettled` lepinguga. Ühe tehnilise allika tõrge tagastab ülejäänud tulemused koos `partial: true` ja täpse `unavailableKinds` loendiga, mida UI kasutajale lokaliseeritult näitab; vestluse, Teekonna ja dokumendi tõrget testiti eraldi. Autentimis- või õigusetõrge ei muutu osatulemuseks, vaid katkestab vastuse fail-closed.
- `SOL-SEARCH-06` P2 — otsingu limiter on protsessimälus ja seob kliendi juhitava IP-päise bucket'i — DONE — isiklik otsing kasutab protsessiüleselt atomaarset PostgreSQL-i bucket'it kasutaja+toimingu ja ainult usaldatud proxy päisest saadud IP järgi; seadistamata või kliendi muudetavad `x-forwarded-for`/`x-real-ip` päised ei loo uusi bucketeid. Päris PostgreSQL-i kaks eraldi protsessi tegid vahelduvate spoof-päistega 40 katset: täpselt 30 lubati ja ülejäänud piirati ühise kvoodi järgi; storage'i tõrge sulgeb otsingu 503-ga. Toodangu proxy-seadistus ja mitme sõlme deploy-järgne rada jäid `NOT_PROVEN`.
- `SOL-SEARCH-07` P3 — pealkirjata tulemuse serveritagavara on kõigis keeltes eestikeelne — DONE — server tagastab pealkirjata objekti puhul `title: null`, mitte eestikeelset fallback'i. Klient tõlgib pealkirjata vestluse, Teekonna ja dokumendi ET/EN/RU kataloogist; kataloogisümmeetria ja kõik kolm lokaliseeritud võtmerühma on testitud.

**Teenuseosutaja profiil** (`SOL-SPROF`, 15/15)

- `SOL-SPROF-01` P0 — konto kustutamine jätab SOLO-teenuseprofiili avalikuks ja RAG-i — DONE — kood, testid ja päris PostgreSQL-i runtime (`npm run sprof:consent:probe` 22/22).
- `SOL-SPROF-02` P0 — soovitusloa tagasivõtmine võib vastata eduga, kuigi vana RAG-dokument jääb aktiivseks — DONE — kood, testid ja päris PostgreSQL-i runtime (`npm run sprof:consent:probe` 22/22).
- `SOL-SPROF-03` P1 — nähtav teeninduskoht võib avalikustada temaga seotud peidetud teenuse — DONE — avalik profiili- ja asukohaprojektsioon lahendab teenuselingid ainult samast kesksest allowlist'ist, kus teenus on `PUBLISHED` ja `mapVisible:true`; piiranguta `providerService` varuteed enam pole. Regressioonitest ja päris PostgreSQL-i sond sidusid nähtava asukohaga avaliku, peidetud, mustandi ning kaardilt eemaldatud teenuse ja kinnitasid, et vastuses säilis ainult avalik teenus ning ainult selle seose-ID.
- `SOL-SPROF-04` P1 — RAG metadata saadab peidetud ja mustandteenuste täissisu — DONE — RAG-i tekst, metadata ja loendurid kasutavad keskset avalikku teenuseprojektsiooni. Eraldatud päris RAG-teenuse ja Chroma runtime koos kohaliku deterministliku embedding-teenusega ingestis sünteetilise segaprofiili: avalik marker oli otsingus leitav, kuid HIDDEN-, DRAFT- ega `mapVisible:false` marker ei esinenud otsinguvastustes.
- `SOL-SPROF-05` P1 — vana täisvorm võib uuema profiili, teenused ja asukohad vaikides üle kirjutada — DONE — PUT nõuab `expectedUpdatedAt` väärtust ning lukustab profiili ja lapsread sama atomaarse CAS-i sisse. Päris PostgreSQL-i kahe konkureeriva täisvormi sond lubas täpselt ühe commit'i, tagastas kaotajale 409 ning kinnitas, et profiil, teenused ja asukohad pärinevad samast võitnud revision'ist. UI säilitab kohaliku vormi ja näitab serveri värske seisuga konfliktivaadet.
- `SOL-SPROF-06` P1 — klient saab suvalised koordinaadid serveris ametlikuks `MATCHED` asukohaks muuta — DONE — server väljastab omaniku ja kõigi autoritatiivsete aadressiväljadega seotud lühiealise allkirjastatud suggestion-tokeni; ainult kehtiv token võib salvestada `MATCHED` koordinaadid ja provider'i. WGS84/Eesti piiri, NaN/Infinity, omanikuvahetuse, võltsitud `adsObjectId` ja aegumise kontrollid sulguvad fail-closed. PostgreSQL-i sond kinnitas, et võltsitud toorsisend jääb koordinaatideta `PENDING` olekusse.
- `SOL-SPROF-07` P1 — RAG-i edukas ingest ja kohaliku profiililingi kirjutus ei ole taastatav tervik — DONE — profiili RAG-sünk kasutab deterministliku dokumendi-ID, payload-räsi ja revision'iga püsivat `ServiceProviderProfileRagJob` järjekorda. Leasitud worker teeb retry, märgib aegunud töö `SUPERSEDED` ning uuendab profiililinki ainult sama revision'i CAS-iga; reconcile võrdleb püsivat snapshot'i RAG-registriga. PostgreSQL-i sond kattis ingest-edu+järgne DB-vea, vastuse kao, restardi, stale-job'i ja uue revision'i võidu. Välise production-RAG-i tegelik worker/reconcile jooks jäi `NOT_PROVEN`.
- `SOL-SPROF-08` P1 — kasutaja andmekoopia jätab tema SOLO-teenuseprofiili välja — DONE — andmekoopia sisaldab nüüd owner-skoobitud SOLO-teenuseprofiili koos teenuste, asukohtade, seoste, avaldamis-/soovitusvalikute ning ajatemplitega; sisemised registri- ja tööjärjekorraväljad on eraldi projektsiooniga välistatud. PostgreSQL-i sond tõendas kahe omaniku eraldatust, omanikuta ja organisatsiooniprofiili puudumist ning koopia kättesaadavust vahetult enne konto kustutust.
- `SOL-SPROF-09` P2 — server kärbib teksti ja kukutab üleliigsed teenused/asukohad ilma hoiatuseta — DONE — server lükkab üle piiri sisendi tagasi ega kärbi teksti või lapsridu vaikides; UI kuvab piirid ja keelab lisamise nende täitumisel. Autenditud production-build brauserirada täitis profiili täpselt 8000 märgi, 40 teenuse ja 30 asukohani. Reload ning päris PostgreSQL kinnitasid kriitilise tekstisaba, viimase teenuse, viimase asukoha ja varasemate HIDDEN/DRAFT/kaardilt peidetud ridade säilimise.
- `SOL-SPROF-10` P2 — profiili- ja kättesaadavusroute võivad tagastada kliendile toore serverivea — DONE — tundmatud serverivead ei jõua autentitud kliendile toortekstina. Prisma unikaalse salajase markeriga veasüst andis üldise lokaliseeritud 500 vastuse ja päisega kattuva korrelatsiooni-ID; marker puudus HTTP-kehas ja UI-s. RAG-i markeriga veasüst jäi püsivas tööjärjekorras ohutuks `rag_ingest_failed` koodiks ning marker puudus vastusest, UI-st ja tööjärjekorra kirjest; järgnev taastöö õnnestus.
- `SOL-SPROF-11` P2 — avaldamise ja AI-soovitusloa muutmisel puudub püsiv auditijälg — DONE — avaldamise ja assistendi soovitusloa siirded kirjutatakse profiili, lapsridade ja RAG-tööga samas tehingus sisutu `DomainEvent`-ina koos actor'i, profiili ID, vana/uue oleku, revision'i ja korrelatsiooni-ID-ga. PostgreSQL-i sond tõendas auditivea täielikku rollback'i, kordussalvestuse duplikaadivabadust, tagasivõtmise järjekorda ning seda, et kirjeldusi ega kontakte auditisse ei kopeerita.
- `SOL-SPROF-12` P2 — kulukatel profiili-, RAG- ja aadressitoimingutel puudub ühine serveripoolne koormuspiir — DONE — profiili GET/PUT, kättesaadavuse kinnitus ja aadressiotsing kasutavad püsivat kasutaja+toimingu koormuspiiri; aadressipäringul on pikkusepiir ning profiili PUT nõuab replay-kindlat `Idempotency-Key` lepingut. PostgreSQL-i mitme protsessi sond tõendas ühist 429 piiri ning sama võtmega samaaegsete ja korduvate PUT-ide puhul ühe profiilirevision'i, receipt'i ja RAG-töö; erineva kehaga sama võti saab 409 konflikti.
- `SOL-SPROF-13` P2 — MTR-i 15 minuti jahtumise vastus näitab ainult kuupäeva ja alati eesti formaati — DONE — MTR-i jahtumise 429 vastus annab standardse `Retry-After` päise ning UI vormindab retry-hetke kasutaja ET/EN/RU lokaadi, kuupäeva, kellaaja ja `Europe/Tallinn` ajavööndi järgi. Sihttestid katavad sama päeva, järgmise päeva ja Tallinna suveajapiiri.
- `SOL-SPROF-14` P2 — profiili tavapärane salvestus võib individuaalselt peidetud teenuse või asukoha uuesti avaldada — DONE — profiili tavapärane salvestus säilitab olemasoleva teenuse ja asukoha individuaalse staatuse ning UI võimaldab lapsrea staatust eraldi hallata; üldprofiili avaldamine ei kirjuta enam kõiki lapsi automaatselt `PUBLISHED`/`DRAFT` olekusse. PostgreSQL-i sond tõendas, et telefoninumbri muutmise järel jäävad HIDDEN teenus ja asukoht peidetuks.
- `SOL-SPROF-15` P2 — avaldamise kontrollid on informatiivsed, server lubab tühja teenuseprofiili RAG-i — DONE — serveripoolne avaldamisleping nõuab avaldamiseks sobivat teenust ja teadlikku ligipääsuteed. Autenditud route-taseme otse-PUT tühja `PUBLISHED`+AI payload'iga tagastas 400 `service_provider_profile.errors.publish_service_required` ning ei muutnud olemasolevat profiili ega lapsridu.

**Dokumendi koostamine** (`SOL-COMP`, 5/5)

- `SOL-COMP-01` P1 — refinement'i tasuline tulemus kaob reload'i, vastuse kao või Stop-toimingu järel — DONE — refinement'i kavatsus on nüüd omaniku ja idempotentsusvõtmega püsiv
- `SOL-COMP-02` P2 — refinement ei nõua DRAFT-seisu ega artefakti nähtud versiooni — DONE — refine nõuab nüüd `artifactId`, `expectedUpdatedAt`, idempotentsusvõtit ning
- `SOL-COMP-03` P2 — protsessi katkemine võib jätta refinement-slot'i jäädavalt kasutatuks — DONE — poolelioleval refinement'il on nüüd lease, claim-token, katseloendur ja olek;
- `SOL-COMP-04` P1 — kliendi lähtefail võib jääda peidetult alles ja kasutajal puudub selle haldamisvaade — DONE — kliendi upload saadab nüüd soovitud `agentAllowed:true` POST-is ning server
- `SOL-COMP-05` P1 — FINAL-artefakti provenants ja allalaaditav dokument ei ole kinnitamise hetke suhtes muutumatud — DONE — FINAL-kinnitus loob nüüd sama tehingu sees muutumatu

**Materjalid** (`SOL-MAT`, 13/13)

- `SOL-MAT-01` P1 — tasulise spetsialistifunktsiooni serveripiir puudub — DONE — 13.08.2026. `POST /api/materials` kasutab nüüd `requireMaterialUploadAccess()` väravat: autentimata saab 401, `CLIENT` 403, aegunud spetsialistitellimus 402 ning aktiivne `SOCIAL_WORKER`, `SERVICE_PROVIDER` ja admin pääsevad edasi. `tests/materials/routeAccess.test.js` mõõdab päris `Response.status` väärtused ja sama kasutaja rolli muutmise korduskontrolli; omaniku GET/download/withdraw jäävad tellimusest sõltumatuks. Sihttestid 15/15 PASS.
- `SOL-MAT-02` P1 — MIME-kontroll aktsepteerib päisega maskeeritud ja tühje faile — DONE — 13.08.2026. Materjalide route valideerib nüüd kogu puhverdatud faili enne staging'ut. Nullpikk fail on keelatud; TXT läbib fatal UTF-8 dekodeerimise ja kogu faili kontrollmärkide kontrolli; DOCX kasutab kirjete arvu, tegeliku lahtipakitud mahu, tihendussuhte, tee, CRC ja puuduva OOXML-põhistruktuuri piire; PDF nõuab terviklikku xref/EOF struktuuri ning `pdf-parse` parseriga vähemalt üht ja kuni 500 lehekülge, eval keelatud ja pildipikslite lagi. Negatiivtestid katsid päisega ZIP/PDF-i, puuduva OOXML-osa, deklareeritud ZIP-pommi, hilise NUL-baidi, vigase UTF-8 ja tühjad failid; Materjalide sihttestid 20/20 PASS.
- `SOL-MAT-03` P1 — upload ja admini kustutus võivad faili ning DB-rea lahku viia — DONE — 13.08.2026. Üleslaadimine kasutab püsivat `MaterialSubmissionBatch` + `DataDeletionJob` STAGE/PUBLISH olekumasinat; nähtavaks saab ainult avaldatud fail ning restart-reconcile lõpetab `PENDING_PUBLISH` rea. Kustutus märgib rea `DELETE_PENDING`, eemaldab faili püsiva job'iga, kirjutab kohustusliku auditi ja kustutab rea alles kinnitatud tulemuse järel. `materials:lifecycle:probe` süstis faili teise kirjutuse, DB-tehingu, publish'i ja delete'i tõrked ning tõendas cleanup'i/retry — PostgreSQL 23/23 PASS.
- `SOL-MAT-04` P2 — Materjalide kvoot on `SOL-DOC-07` DONE-seisu järel endiselt paralleelselt ületatav — DONE — 13.08.2026. Kõigi faili ridade loomine toimub `withStorageQuota()` sama kasutaja advisory-lock'i ja tehingu sees; kaotaja staging koristatakse püsivate job'idega. Päris PostgreSQL-i nelja paralleelse upload'i sond lubas täpselt kaks 1000-baidist võitjat 2000-baidise piiri alla, kaks said 413 ning lõppmaht jäi 2000; vana read-then-write negatiivkontroll ületas sama piiri. `materials:lifecycle:probe`: 23/23 PASS.
- `SOL-MAT-05` P2 — korduskatse loob uued failid, read, kvoodikulu ja teavituse — DONE — 13.08.2026. Klient säilitab ühe kasutajakavatsuse vältel UUID idempotentsusvõtme; server seob `(submittedByUserId,idempotencyKey)` payload'i hash'i ja ühe batch-tulemusega. Sama võti/teine sisu annab 409, neli sama võtme paralleelpäringut koonduvad üheks reaks, response-loss retry tagastab sama ID ning sama sha teise võtmega kannab `duplicateOfId` viidet. Jagatud rate-limit loetakse batch'idest kasutaja advisory-lock'i all. PostgreSQL-i sond 23/23 PASS.
- `SOL-MAT-06` P1 — esitaja ei näe oma esitisi, staatust ega saa esitist tagasi võtta — DONE — 13.08.2026. `MaterialsPage` kuvab omaniku pagineeritud esitised, seisundi, omaniku download'i ja pending/rejected tagasivõtmise; GET/download/delete kasutavad serveris omaniku skoopi ja töötavad tellimuseta. Imported tagasivõtmine annab ausa 409, ristkasutaja download/delete 404 ning korduv delete tagastab idempotentse edu. PostgreSQL-i sond tõendas eemaldamise, retry, auditi ja cross-user piiri; lõplik sond 30/30 PASS. Päris Chromiumis renderdus sünteetilise API-projektsiooniga kahe staatusega omanikuvaade ja `Näita veel`; `Võta tagasi` eemaldas ootel rea. Backend-auth ja omandipiir on eraldi HTTP/PG testidega tõendatud, brauseris production-andmeid ei kasutatud.
- `SOL-MAT-07` P2 — adminijärjekord lõpeb vaikides 100 uusima rea juures — DONE — 13.08.2026. Admini ja omaniku loend kasutab stabiilset kahanevat `(createdAt,id)` cursor'it, tagastab `hasMore`, `nextCursor`, `total` ja seisundiloendurid; adminipaneelil on seisundifilter ja järgmise lehe laadimine. PostgreSQL-i sond lõi 106 sama ajatempliga rida ning läbis kõik ID-d ühe korra, ilma kao või korduseta; 23/23 PASS.
- `SOL-MAT-08` P1 — `imported` on vale RAG-lubadus ilma ingest'i, `doc_id`, õiguste või eemaldamiseta — DONE. Kinnitatud muutumatu poliitika on `rightsEvidenceMode=DOCUMENTED_LICENSE`, `collection=materials_reviewed_social_work`, `audience=SOCIAL_WORKER`, `retentionMode=DELETE_WITH_SUBMISSION_OR_ACCOUNT`, `withdrawalAuthority=SUBMITTER_RIGHTS_HOLDER_OR_ADMIN`, versioon `materials-rag-v1-2026-08`. Shared-RAG lubab ainult public domain'i, selget avatud litsentsi või dokumenteeritud luba ning keelab kliendijuhtumi, konfidentsiaalse ja isikuandmetega materjali; pelk esitaja kinnitus ei ava importi. `imported` sünnib ainult sanitiseeritud derivaadi versioonitud ingest'i, `inserted > 0` kviteeringu ja järgneva `chunks > 0` kontrolli järel. Admin näeb auditeeritud preview-rajalt ainult derivaati, mitte toororiginaali. Ebaõnnestumine, null-chunk, DB lõpuviga, withdraw ja konto kustutus kasutavad püsivaid retry/kompensatsiooni/RAG_DELETE radu.
- `SOL-MAT-09` P1 — ülevaatuse olekumasin lubab suvalisi ja stale üleminekuid — DONE. `MaterialSubmission.reviewRevision` ja DB CHECK/triger jõustavad lubatud olekud,
- `SOL-MAT-10` P1 — admini allalaadimise, ülevaatuse ja kustutuse audit pole kohustuslik — DONE. Faili väljastamise eel kirjutatakse nüüd kohustuslik owner/admin audit ning
- `SOL-MAT-11` P1 — kasutaja andmekoopia jätab esitised ja originaalfailid välja — DONE. Andmekoopia registris on owner-skoobitud `material_submissions` pind:
- `SOL-MAT-12` P2 — rejected/imported/pending failidel puudub retention'i tähtaeg ja sweep — DONE. `MaterialSubmission` ei kasuta enam üht ühist säilituskella:
- `SOL-MAT-13` P2 — SMTP-teavituse tõrge kaob logisse ja tööjärjekord ei tea sellest — DONE. Upload-batch on püsiv outbox: esitised ja `PENDING` teavituskavatsus sünnivad

**Minu jagamised** (`SOL-SHARE`, 7/7)

- `SOL-SHARE-06` P1 — isikuandmete koopia jätab jagamisregistri ja selle saajaajaloo välja — DONE. Üks jagamisregister toidab nii koondit kui versioonitud `sharing_history` 1.0 andmekoopia pinda; eksport on UI lehepiiridest sõltumatu, omaniku-skoobitud ning sisaldab ainult normaliseeritud jagamisfakti, mitte jagatud sisu ega saaja töövoomärkmeid. Fake-DB test katab kõik kanoonilised mudelid/suunad ja päris PostgreSQL-i sond tõendas oma rea kaasamise, võõra rea ja tundliku snapshot'i puudumise ning manifestiga ZIP-sisu koostamise.
- `SOL-SHARE-07` P1 — toe külmutatud jagamiskoopia kaob omaniku, saajaliikmesuse või organisatsiooni kustutamisel — DONE. Omanikuotsus on rakendatud kahekihiliselt: olekupõhine sisu kuni 30 päeva / sulgemine + 90 päeva ja alati kuni 12 kuu ülempiirini ning piiratud sisuvaba jagamiskviitung kolm aastat viimasest sündmusest; tagasivõtt, saajaliikmesuse või organisatsiooni kustutus puhastab sisu kohe, avamata omaniku konto kustutus võtab jagamise tagasi ning avatud koopia säilib üksnes lühikese tähtajani. Kolm vanemseost on `SET NULL`, kustutustriggerid lõpetavad ligipääsu ilma uuele adressaadile ülekandeta, retention-sweep puhastab esmalt sisu ja hiljem kviitungi ning eraldi legal hold peatab mõlemad. Privaatsus- ja jagamiseelne teavitus on versioonitud; ajaloolistele ridadele ei rakendata uut avatud sisu erandit tagasiulatuvalt. Migratsiooniahel on puhas ja päris PostgreSQL-i sond andis 14/14 PASS, sh kõik kolm vanemkustutust, avatud/avamata eristus, sisu- ja kviitungitähtaeg, legal hold, omaniku-skoobitud eksport ning vana CASCADE negatiivkontroll. Kolme aasta pikkuse, konto kustutuse järgse avatud sisu tähtaja ja töötlejarollide juristikinnitus jääb enne production-poliitika jõustamist väljalaske kontrollpunktiks, mitte määratlemata koodikäitumiseks.
- `SOL-SHARE-01` P1 — koond jätab välja mitu päris platvormisisest jagamisklassi — DONE. Kanooniline `SHARING_TYPE_REGISTRY` seob kõik platvormi jagamismudelid ja suunad nii koondvaate kui andmekoopia adapteritega; `WellbeingSupportShare`, `ServiceReportShare`, töötaja saadetud `NetworkShare` ja ruumi külmutatud kokkuvõtted on omanikuvaates ning framework-kinnitus on selgelt privaatne mittejagamine. Registry-contract ja omaniku projektsioonide sihttestid on rohelised; päris PostgreSQL-i sond tõendas oma toejagamise kaasamise ning võõra rea välistamise.
- `SOL-SHARE-02` P1 — ühe allika tavaviga võtab maha kogu jagamiste läbipaistvusvaate — DONE. Iga allikas laetakse eraldi staatuse, veakoodi ja paging-ümbrisega; tavaviga või timeout jätab edukad sektsioonid nähtavaks, kuid 401/403 sulgeb vastuse tervikuna. Dev-brauseris säilisid edukad eelpöördumise ja mentorluse kaardid, vigane abi-sektsioon näitas ausat tõrget ning ainult selle sektsiooni retry taastas andmed teisi kaarte kaotamata.
- `SOL-SHARE-03` P2 — puuduva tabeli/veeru korral näidatakse sektsiooni ausa tõrke asemel tühjana — DONE. P2021/P2022 annab nüüd `UNAVAILABLE`, timeout `TIMEOUT` ja päriselt null rida `READY`; production-logi kannab ainult sektsiooni ja stabiilset veakoodi. Contract-testid eristavad skeemi-, ühendus-, timeout- ja autoriseerimisvigu ning dev-brauser kinnitas eraldi tõrkepaneeli ja sektsioonipõhise taastumise.
- `SOL-SHARE-04` P2 — abi-kuulutus märgitakse alati avalikul kaardil nähtavaks — DONE. Koond kasutab sama puhast avalikkuse klassifikaatorit mis Teenusekaardi tegelik projektsioon ning eristab `PUBLIC`, `HIDDEN`, `REVIEW`, `EXPIRED`, `MISSING` ja `OUT_OF_SYNC` seisu. Kombinatsioonitabeli sihttest ja dev-brauser kinnitasid, et silt tuleneb kaardirea tegelikust olekust; ET/EN/RU üldväited parandati.
- `SOL-SHARE-05` P2 — mentorluse tagasivõetav ettevalmistus ei ole koondvaates tagasivõetav — DONE. Avamata ettevalmistusel on koondis kinnitusega päris tagasivõtt; puuduva suhteviite korral näidatakse toimingu puudumise põhjust. Avamise ja tagasivõtu advisory-lock'i võistlussond andis mõlemas järjekorras ühe võitja ning koherentse märkme, auditi ja teavituse; dev-brauseris sulges 409 dialoogi, värskendas avatuks muutunud seisu ja eemaldas surnud nupu.

**Teenusekaart** (`SOL-SMAP`, 9/9)

- `SOL-SMAP-09` P2 — kaardi vaateala liigub otse välisele tile-serverile ilma Teenusekaardi-põhise teavituseta — DONE. Algne otsene lõppkasutaja võrgu- ja vaatealainfo leke on proxy'ga suletud, välisteenuse rike ei muuda tulemuste loendit kasutamatuks, ametlik integratsiooniõigus ja allikaviite nõue on dokumenteeritud ning nähtav atributsioon on parandatud. Avaldamata upstream-logide täpne säilitusaeg ei blokeeri seda leidu, sest proxy ei saada upstream'i Teenusekaardi lõppkasutaja identifikaatorit ega otsingusisu.
- `SOL-SMAP-01` P1 — aadressi automaatne vaste avaldab ülevaatamata kaardikirje — DONE. Geokodeerija kirjutus ei sisalda enam moderatsiooniseisu ning kõik 12 `DRAFT/NEEDS_REVIEW/PUBLISHED/HIDDEN × MATCHED/AMBIGUOUS/FAILED` kombinatsiooni säilitavad seisu. Avaldamine on adminiõiguse, põhjuse ja revision-CAS-iga tehing, mis kirjutab sama tehingu auditi; päris PostgreSQL-i sondis võitis kahest paralleelsest otsusest täpselt üks ja tekkis üks audit. Sihttestid ja `service-map:lifecycle:probe` 5/5 PASS.
- `SOL-SMAP-02` P1 — allikast kadunud RAG- ja KOV-kontaktid jäävad Teenusekaardile avalikuks — DONE. Igal autoriteetsel allikal on eraldi namespace, collision-free ID, generatsioon ja PostgreSQL advisory-lock; terviklik reconcile peidab puuduvad ja ka vana NULL-generatsiooniga read, logides peidetud ID-d, kuid vigane/osaline allikavastus ei reconcile'i. Taasilmunud tombstone läheb uuesti ülevaatusele. Migratsioon kõrvaldab vana segapäritoluga KOV-ridade avaliku duplikaadiriski. Päris PostgreSQL-i sond tõendas stale/legacy peitmise, auditidentiteedid ja paralleelsete generatsioonide serialiseerimise (5/5 PASS).
- `SOL-SMAP-03` P1 — kaart pakub keelatud teenusele e-posti ja pöördumise toimingut — DONE. Ühine serveripoolne teenuse+asukoha kontaktipoliitika projitseerib toimingud ning server kontrollib valitud teenuse ja asukoha kuuluvust nii salvestamisel, parandamisel kui vahetult enne e-kirja saatmist; ajalooline ID-deta teenuseosutaja mustand on fail-closed. Profiili/teenuse true/false/null maatriks, võõras seos ja send-time policy switch on sihttestidega kaetud. Päris brauseris oli teenuse lubatud platvormitoiming detailis olemas ning süvalink avas sama poliitikaga detaili.
- `SOL-SMAP-04` P2 — otsing ja tulemuste loend on vaikides osalised — DONE. Märksõna, piirkond ja täpne allikas lähevad serverisse; opaque cursor on seotud allika, filtrite ja preview-skoobiga ning UI lehitseb, deduplikeerib ja tõrjub hilise vana vastuse. Päris PostgreSQL-i 502-realises sondis läbiti 501 avalikku rida täpselt üks kord, peidetud rida jäi välja ja 501. märksõnavaste leiti enne `take`-piiri (4/4 PASS). Brauseris laeti 24→30 tulemust ausa loenduriga.
- `SOL-SMAP-05` P2 — sama koordinaadiga kontaktidel kaovad teenuse detail ja platvormipöördumine — DONE. Grupikontakt kasutab iga kirje jaoks sama täisdetaili ja kanalipoliitika renderdajat kui üksikpopup ning eraldi „Tagasi kontaktide juurde” toiming sulgeb detaili, säilitab grupi ja taastab fookuse. Päris Chromiumi fixture tõendas grupi avatuks jäämise, teise kontakti kättesaadavuse ja teenuseosutaja poliitikatoimingu.
- `SOL-SMAP-06` P2 — „Vaata teenusekaardil” süvalink ei ava viidatud kirjet — DONE. Serveripoolne resolver lahendab täpselt ühe `entryId|listing|match` sihi kanoonilise avalikkuse ja kasutaja-skoobiga, liit-ID seob õige teeninduskoha ning peidetud/võõras siht normaliseerub neutraalseks 404-ks. Klient valib resolveri tüübi, lisab sihi leheväliselt ja avab markeri/popupi. Sihttestid, päris PostgreSQL-i peidetud sihi kontroll ning brauseri provider-location süvalink PASS.
- `SOL-SMAP-07` P2 — ühe andmeallika viga võtab maha kogu Teenusekaardi — DONE. Omanik kinnitas osalise tulemuse lepingu: kombineeritud „Kõik” vaates jätab ühe sõltumatu tehnilise allika rike terve allika tulemused nähtavaks koos `partial` hoiatuse ja stabiilse allikakoodiga; mõlema allika rike, sessiooniteenuse tõrge, 401/403 ning andmebaasi õigusevead jäävad kogu vastuse ulatuses fail-closed. Kahe allika eraldi, filtriga seotud cursorid lehitsevad terveid allikaid ilma esimese lehe korduseta; vigane alamcursor annab 400 ning püsiv allikatõrge ei tekita lõputut „Laadi veel” tsüklit. Sihtlõige 86/86 PASS. Päris Chromium tõendas terve rea + osalise hoiatuse, osalise nulltulemuse ausa teksti, järgmise täisvastuse hoiatuse kadumise ning hilise vana 500/append-vastuse tõrjumise; sisemine veatekst ei jõudnud vastusesse ega logisse.
- `SOL-SMAP-08` P2 — anonüümsele kasutajale näidatakse keelatud abikuulutuste filtreid tühja tulemusena — DONE. Peer-kuulutuste võimekus tuleb serverist ega sõltu kirjete arvust; anonüümsele ei laadita peer-andmeid ega näidata nende filtreid või nulltulemust, vaid invariantset sisselogimisselgitust. Päris PostgreSQL-i sondis olid anonüümsed vastused enne ja pärast peer-rea lisamist identsed, autenditud null säilitas võimekuse ja autenditud olemasolev rida tagastati turvalise projektsioonina (4/4 PASS). Brauser kinnitas anonüümse piiri.

**Funktsioonideülene lõpetusring** (`SOL-XFUNC`, 3/3)

- `SOL-XFUNC-01` P2 — Haldus on URL-ita ajutine olek ja jätab kolm päris halduspinda menüüst välja — DONE — commit `84afee74` lisab serveris autentiva päris `/admin` hub-route'i ning kanoonilise `ADMIN_SURFACES` registri, mida kasutavad nii hub kui Haldus-dokk. Contract-test võrdleb registrit kõigi 13 tegeliku `app/admin//page.jsx` pinnaga. Autenditud lokaalses brauseris avanes 13/13 pinda, `/admin/wellbeing` säilitas F5 järel Haldus-doki, tundmatu adminitee oli 404 ning mitteadmin suunati fail-closed avalehele. Tootmisruntime ja deploy jäid `NOT_PROVEN`.
- `SOL-XFUNC-02` P2 — Ruumid ignoreerib serveri tegevuslepingut ning peidab keelatud kustutuse vea — DONE — commit `84afee74` eemaldab `RoomsPage`-i rollipõhise õiguste tuletuse ja kasutab ainult serveri `canInvite`, `canLeave`, `canDelete` ning `canArchive` lippe. UI pakub PATCH-arhiveerimist, ei kuva keelatud kutset/kustutust ning säilitab GET/PATCH/DELETE tõrke nähtava taastatava seisuna. Autenditud brauserirada kattis `MANUAL_INVITE`, `PRE_INQUIRY`, `HELP_MATCH`, arhiveeritud ruumi ning omaniku/moderaatori/liikme; päris PostgreSQL-i kahe sünteetilise konto sond kinnitas ühe kustutuse, ühe arhiveerimise ja kahe kontrollruumi muutumatuse (`PROBE_OK accounts=2 delete=1 archive=1 unchanged=2`). Tootmisruntime ja deploy jäid `NOT_PROVEN`.
- `SOL-XFUNC-03` P1 — isikuandmete koopia registril puudub täielikkusleping ning uus kasutajapind jääb vaikimisi välja — DONE — kasutajaandmete masinloetav pinnaregister klassifitseerib kõik praegused 157 Prisma `User`-seost ning 41 skeemist avastatavat ja kaks koodipõhist faili-, RAG- või väliskoopia pinda omaniku, projektsiooni, kolmanda isiku filtri, retention-klassi ja ekspordiotsusega. Iga kirje kannab positiivse ja negatiivse kontrolli lepingut; uus või ümber nimetatud kasutajaseos või koopiamarker muudab CI-värava punaseks, kuni register on teadlikult uuendatud. Sünteetilise kasutaja ZIP-integratsioon nõuab manifesti täpset vastavust kõigile 15 käivitatud ekspordipinnale. Negatiivkontroll vana käitumise vastu kukkus ootuspäraselt; päris PostgreSQL oli `not_run`, sest invariant on skeemi- ja manifestipõhine. Production-andmekoopia jäi `NOT_PROVEN`.

<!-- sol:tally lõpp -->

## Jutustus — MIKS, mitte MIS

**Ülalolev genereeritud plokk ütleb, MIS on tehtud, ja ta on alati värske.** Allolev jutustus
ütleb, MIKS ja mis paranduse kirjutamisel välja tuli — ta on käsitsi kirjutatud, ta **lõpeb
SOL-CHAT-08 juures** ja tema järelejõudmine on eraldi töö. Ta ei kanna olekut ega numbreid;
kui ta millegagi vastuollu läheb, kehtib genereeritud plokk ja tema taga raport.

- **SOL-SCHEMA-01** · **SOL-BUILD-01**
- **SOL-AUTH-01, AUTH-02**
- **SOL-AUTH-03** (11.08) — `VerificationToken.token` kandis paroolitaaste ja e-posti kinnituse
  bearer-tokenit **toorkujul**: andmebaasi lugemisõigus, varukoopia või diagnostikaväljavõte
  andis töötava lingi. Kirja läheb nüüd `raw`, ritta `v2:` + sha256; veerg ise ei muutunud,
  seega migratsiooni ei ole. **Prefiks ei ole dekoratsioon, vaid kogu üleminekumehhanism:**
  pärandread kannavad toorväärtust ja neid otsitakse ka verbatim, AGA ainult siis, kui sisend
  ei ole juba salvestuskujul — ilma selle väravata saaks lugeja kleepida rea väärtuse lingi
  asemele ja leid oleks paranduse enda sees tagasi. Tarbimine sai atomaarse ühekordse claim'i
  (vana `delete` tehingu lõpus tegi topeltklikist 500). `npm run auth:token:probe` **26/26**
  päris PostgreSQL-is, kaks negatiivkontrolli. **Kõrvalleid:** konto kustutus ei tühjendanud
  `password-reset:<email>` nimeruumi.
- **SOL-AUTH-04 + -05 + -06** (11.08) — **üks juur: kinnitus otsustas asjade üle, mida ta ei
  hoidnud kinni.** `-04`: kinnituslingi pelk AVAMINE vahetas identiteedi, seega skanner tegi
  seda kasutaja eest; GET annab nüüd vahelehe ja POST vahetab — muster oli koodibaasis olemas
  (`verify-email`), uut ei ehitatud, ja GET ei tee ühtki DB-päringut. `-05`: `id` ei ole siin
  identiteet, sest resend kirjutab SAMA rea peale ümber — kõik on nüüd ühes tehingus, rea lukk
  tuleb lugemise ETTE ja tarbimine on tingimuslik `deleteMany({ id, tokenHash })`; eraldi
  versiooniveergu ei tehtud, sest `tokenHash` ise on versioon. `-06`: parandus on **järjekord** —
  mint → SAADA → alles siis rotatsioon, seega vana link elab kuni uus on teele läinud; vale
  eduteade asendus 502-ga ja esmane PUT kannab ausat `emailDelivery` seisu.
  `npm run auth:emailchange:probe` **27/27** päris PostgreSQL-is, **kolm negatiivkontrolli**:
  vana GET-rada vahetab identiteedi pelgalt avamisel · vana kinnitusmuster vahetab VANA
  aadressi peale ja hävitab värske tokeni · vana resend-järjekord tapab varem kohale jõudnud
  lingi.
- **SOL-AUTH-07 + -11** (11.08) — **`LoginTempToken` elutsükkel, üks plokk.** `-07`: PIN-i
  vahetus kasvatas ainult `sessionVersion`-it, aga vana PIN-iga alustatud sisselogimine loeb
  tarbimisel KÄESOLEVAT versiooni — rotatsioon nägi välja nagu tühistaks kõik ja ei tühistanud.
  Nüüd kustutatakse samas tehingus `LoginTempToken`, `EmailOtpCode`, `TrustedDevice` ja
  `Session`; sama leping oli kõrval juba kaks korda olemas (paroolitaaste, e-posti vahetus) ja
  PIN-i vahetus oli ainus credential-rotatsioon, mis seda ei teinud. `-11`: sama katse sai
  väljastada mitu usaldatud seadet, sest `usedAt` täideti alles NextAuthis — nüüd tingimuslik
  claim `trustedDeviceId: null` peal (kaotaja seaderida rullub tagasi) + kasutajapõhine
  nõuandelukk `4712`. `npm run auth:attempt:probe` **19/19** päris PostgreSQL-is; tõend on
  **NextAuthi päris `authorize()` vastus**, mitte rea puudumine. Kaks negatiivkontrolli: ainult
  `sessionVersion` EI tühista pooleliolevat sisselogimist · vana muster väljastab samast
  katsest KAKS seadet. **Sond leidis lõksu, mis oleks tõendi tühjaks teinud:**
  `provider.authorize` on next-auth'i tühi stub ja päris funktsioon on
  `provider.options.authorize` — kinni püüdis baasjoone kontroll „enne vahetust ANNAB".
- **SOL-AUTH-08 + -12 + -13** (11.08) — **sisselogimise e-kirja link, üks plokk, ja kõigil
  kolmel oli kõrval juba lahendatud vaste.** `-08`: kinnituslingi pelk AVAMINE kinnitas teise
  faktori, seega postkasti turvaskanner tegi seda konto omaniku eest ja PIN-i teadnud ründaja
  sai oma brauseris sessiooni — GET annab nüüd vahelehe ja POST kinnitab (muster
  `verify-email`-ist, AUTH-04 kaudu), aga **siin ilma auto-submit'ita**: ohver ise võib lingi
  avada, seega ta peab NÄGEMA seadet, aega ja IP-d, mille katset ta kinnitab. `-12`: turvalingi
  origin langes puuduva baas-URL-i korral tagasi kliendi `Host`-päisele — nüüd tuleb ta ainult
  `resolveBaseUrl()`-ist ja funktsiooni allkirjast kadus `request` (päist, mida ei anta, ei saa
  usaldada); ilma originita jääb kiri saatmata ja teist faktorit ei saa läbida. `-13`: resend
  kirjutas uue räsi reale enne maileri kutset, seega SMTP-tõrge tappis kohale jõudnud lingi —
  järjekord on nüüd mint → SAADA → rotatsioon (sama, mis AUTH-06 e-posti vahetuses) ja tõrge
  annab 502 koos ausa tekstiga „varem saadetud link kehtib edasi".
  **`npm run auth:emaillink:probe` 27/27 päris PostgreSQL-is**, kutsudes marsruudi PÄRIS `GET`-i
  ja `POST`-i; kaks negatiivkontrolli: vana GET-rada kinnitab pelgalt avamisel · vana järjekord
  tapab lingi juba enne saatmiskatset. Ühikuid 9. **Brauseris läbi käidud** päris reaga:
  vahelehel `scripts: 0` (ühtki skripti, seega ka mitte auto-submit'i) ja pärast nupuvajutust
  töötab endine ootamis- ja handoff-loogika muutumatuna. Hind on **üks klikk** — omaniku 28.07
  vastuväide käis kinnituse-JÄRGSE kliki kohta, mis jääb lahendatuks.
- **SOL-AUTH-09 + -10** (11.08) — **kaks leidu, mida ei saa eraldi parandada.** `-09`:
  PIN-katsete loendur elas mooduli mälus, seega iga instants pidas oma arvet ja iga restart
  nullis kõik — neljakohalise PIN-i 10 000 variandi juures oli see ainus kaitse. Nüüd on ta
  andmebaasis (`AuthThrottleCounter`, migratsioon **`20260811210000`**), kasutajapõhise
  nõuandeluku `4713` taga, aeglustuse ja turvalise taastamisega; IP tuleb ainult
  konfigureeritud edge-päisest (`TRUSTED_PROXY_IP_HEADER`) ja sealt VIIMASEST väärtusest,
  ilma konfiguratsioonita IP-piiri ei tehta. `-10`: `EMAIL_NOT_FOUND` ja `PIN_INCORRECT`
  asendas üks `INVALID_CREDENTIALS`, **ja ajastus ühtlustus peibutusräsiga** — bcrypt cost 12
  jookseb nüüd ka tundmatul kontol, muidu oleks vastus kordades kiirem ja lekitaks konto
  puudumise ka identse tekstiga. **Kokkupuutepunkt:** loenduri subjekt on e-posti räsi, MITTE
  kasutaja ID — konto järgi käiv lukustus oleks teinud 429-st uue oraakli.
  **`npm run auth:throttle:probe` 23/23 päris PostgreSQL-is**, sh **päris teine protsess**
  (`spawn`, pid kontrollitud) ja restart; negatiivkontrollid: vana mälupõhine loendur annab
  igale instantsile oma täie limiidi · ilma peibutusräsita on tundmatu konto rada kordades
  kiirem. Ühikuid 12. **Brauseris mõõdetud päris HTTP kaudu**: tundmatu 440/442/413 ms vs
  vale PIN 441/437/436 ms, mõlemal sama kood ja sõnum; 9. katse annab 429.
- **SOL-AUTH-14** (11.08) — **väljalogimine ütles „tehtud" enne, kui midagi oli tehtud.**
  NextAuthi `signOut` event kustutas jälgitava sessiooni best-effort'ina ja neelas iga vea
  peale `P2025`: kasutaja kaotas küpsise ja nägi end väljas, aga sama JWT varem kopeerinud
  osapool autoriseeris edasi. Nüüd tühistab `POST /api/profile/logout` rea ENNE küpsise
  eemaldamist ja klient kutsub `signOut()` ainult kinnituse peale — **muster oli olemas ja
  kasutamata**, `logout-all` teeb täpselt sama. `sessionRecordId` loetakse tokenist, mitte
  kliendi kehast, ja kustutus on tingimuslik (`{ id, userId }`), sest `count === 0` tähendab
  kahte vastupidist asja: juba kadunud rida või VÕÕRAS rida. **`npm run auth:logout:probe`
  14/14 päris PostgreSQL-is**; tõend on `refreshTokenAuthorization()` vastus, mitte rea
  puudumine — enne annab, pärast `SESSION_REVOKED`, teine seade jääb sisse. Kaks
  negatiivkontrolli vana raja koodiga: ta raporteeris tõrke kiuste edu · ta kustutas võõra
  sessiooni omanikku küsimata. **Brauseris päris sessiooniga:** `/api/auth/session` annab
  pärast väljalogimist `null` ka siis, kui küpsist ei eemaldatud.
- **SOL-AUTH-15** (11.08) — **peatüki lõpetas leid, kus järjekord oli õige ja omand puudus.**
  Iga paroolitaaste-POST mintis tokeni, saatis lingi ja kustutas siis „kõik ülejäänud" —
  aga „ülejäänud" hulka kuulus ka see token, mille teine samaaegne päring oli just välja
  saatnud. Kaks näiliselt edukat kirja, null töötavat linki; topeltklikk või aeglane tarne
  muutis konto taastamise juhuslikult võimatuks. `mint → SAADA → rotatsioon` (SOL-AUTH-06,
  -13) jäi puutumata; juurde tuli **omand**: identifikaatoripõhine nõuandelukk `4714` ja
  claim'i jälg `VerificationLinkDispatch` (migratsioon `20260811220000`), mis ütleb, MILLINE
  token teele läks. Rotatsioon kustutab ainult neid, mille peale rida ei näita, ja ainult
  siis, kui rida näitab veel minu peale — `count === 0` loetakse siin sama rangelt kui
  AUTH-14-s. Teine samaaegne päring on **idempotentne** (ei mindi, ei saada, vastab `ok`).
  Vananemisaken 2 min on lepingu osa, muidu lukustaks surnud saatja konto igaveseks.
  **`npm run auth:reset:probe` 31/31 päris PostgreSQL-is**; tõend on sama marsruudi `PUT` —
  kasutaja kliki rada — ja token loetakse VÄLJA SAADETUD KIRJAST. Negatiivkontroll jooksutab
  vana rada samas harnessis: mõlemad raporteerivad edu, mõlemad kirjad lähevad teele ja
  andmebaasi ei jää ühtki tokenit. **Kõrvalparandus:** puuduv baas-URL või saatja andis 500
  ainult olemasolevale kontole — konfiguratsioonivea kujul sama oraakel, mille AUTH-10 sulges;
  kontroll käib nüüd enne kasutaja otsimist. **Sama muster elas veel `verify-email` resend'is
  ja registreerimises — mõlemad on nüüd samal rajal** (auditis neid ei ole; tagajärg oli sama:
  kaks paralleelset „saada uuesti" jätsid konto ilma töötava kinnituslingita). Sond mõõdab
  `verify-email`-i eraldi jaamana, **`npm run auth:reset:probe` 35/35**, ja ühiktest nõuab
  jagatud rada kõigilt kolmelt marsruudilt.
- **SOL-VOICE-01, -02, -03** (11.08) — **kogu häälepeatükk ühe plokina, sest kõik kolm elasid
  ühes voos.** `-01`: tundmatu formaadi korral maksis kuni 12 MB tihendatud kõne täpselt
  minuti ühikuid (`|| 60`) ja provideri kinnitatud kestust ei kasutatud arvestuses kunagi —
  lahendus oli koodibaasis olemas ja kasutamata (`lib/usage/sttDuration.js`, SOL-DOC-02).
  Lisaks kadus lipp `transcriptionCompleted`, mis pani commit'i vea kasutaja arvele:
  reservatsioon jäi rippuma JA valmis transkript visati ära. `-02`: neljal providerikutsel ei
  olnud ajapiiri ega päringu signaali — aeglane provider hoidis Next-i töölõnga, liidest ja
  reservatsiooni määramata aja kinni, sest vabastus elab `catch`-is, kuhu igavesti ootel
  promise ei jõua. Nüüd kannab üks signaal kahte ERISTATAVAT sündmust (meie ajapiir → 504,
  kasutaja Stop → 499) ja `withAbort` hoiab piiri ka siis, kui SDK signaali eirab. `-03`:
  „Peata ettelugemine" ei teadnud pooleliolevast serverikutsest midagi — heli võis hakata
  mängima pärast Stop'i, ka pärast lehelt lahkumist; primitiiv oli olemas ja kasutamata
  (`lib/client/latestRequestGate.js`), ja otsus „kas ma tohin veel heli teha" tehakse nüüd
  VASTUSE saabudes. **`npm run voice:settle:probe` 15/15 päris PostgreSQL-is MITTE KUNAGI
  LAHENEVA provideriga**; tõend on `UsageReservation` rida ja ämbri seis. Negatiivkontroll
  sama ämbri peal: vana commit ilma tegeliku kestuseta võtab kogu reservatsiooni, ja 12 MB
  fail, mis vanas rajas maksis 60 sekundit, ei mahu enam 900-sekundilise limiidi sisse.
  **NOT_PROVEN jääb brauserikiht** (DOM-testisviiti ei ole) ja `-01` „transkripti taastamine"
  ainult arvelduse mõttes — teksti ennast `/api/stt` ei püsista, vt leiu Seis-lõiku.
- **SOL-ROOM-01…-07** (11.08) — **kogu ruumipeatükk, neli plokki ühe päevaga.** `-01`: sama
  „leia ruum → leia liikmesus → kontrolli arveldust" otsus elas neljas käsitsi hoitud
  koopias ja KÕIK valisid ruumist ainult `id` ja `helpMatch`, seega `archivedAt` ei jõudnud
  otsuseni kordagi — lõpetatud ruumi sai otse API kaudu edasi kirjutada. Uus jagatud värav
  `lib/rooms/accessGuard.js` eristab kolme lepingut ja kolmas neist (`ROOM_WIND_DOWN`)
  tekkis paranduse kirjutamise ajal: kui kõik kõnemarsruudid oleksid kirjutused, jääks
  arhiveerimise hetkel käimasoleva kõne osaleja LUKKU. **Katvustest käib läbi kõik
  `app/api/rooms` marsruudid** ja erandid on nimeline loend põhjustega. `-02`/`-03`: hiline
  vastus kirjutas teise ruumi vaatesse võõra ajaloo ja SSE lammutas iseennast; otsused
  kolisid Reactist välja (`lib/rooms/roomMessageSession.js`), sest leid ON ajastus. `-04`:
  omanikuvahetus ja lahkumine jätsid ruumi ilma aktiivse omanikuta — mõlemad võtavad nüüd
  sama ruumiluku ja kirjutus on kohtunik; **`npm run room:owner:probe` 22/22 päris
  PostgreSQL-is, deterministlike võistlustega mõlemas järjekorras**, negatiivkontroll rikub
  invariandi. `-05`: kolm elutsüklisiiret said jälje samasse tehingusse, tõend on ROLLBACK.
  `-06`: jagamise kandja kirjutamise vaikiv tõrge jättis kõik ilma privaatkoopiata — nüüd
  üks tehing ja VISKAB. `-07`: saajate ring on jagamise hetk, mitte ruumi lõpp.
  **Kaks testi lukustasid VALE käitumise ja on ümber pööratud.** NOT_PROVEN: HTTP- ja
  brauserikiht.
- **SOL-CW-01…CW-08, CW-10…CW-13, CW-15…CW-18, CW-20** (17 leidu)
- **SOL-RAGADMIN-01, -02, -03, -04** (peatükk lõpuni)
- **SOL-CALL-01, -02, -03** — igal kolmel on vastuvõtukriteeriumist osa katmata, vt leidude
  Seis-lõike.
- **SOL-CALL-04, -05** (10.08) — üks plokk: mõlemad ütlevad, et salvestuse alustamise rajal
  loetakse asju ÜHEKS, ilma et miski neid üheks hoiaks. CALL-04 sai katsepõhise failivõtme ja
  idempotentse korduse; CALL-05 sai unikaalse indeksi + jagatud `upsert`-tee ja on **ainus
  selle päeva parandus, mis on tõendatud päris PostgreSQL-is** (`npm run call:consent:probe` 8/8).
- **SOL-CALL-06** (10.08) — kustutus sai astmelise `DELETE_PENDING` seisu ja lõpetas
  `ok:true` vastamise kustutamata faili kohta. Parandust kirjutades tuli välja **teine,
  raportis kirjas mitte olnud leid**: karantiini pandud toorest egress-faili ei kustutanud
  keegi, sest ta saadeti dokumendisalvestuse teele, kus ta andis neelatud tee-vea. Sama
  neelamine oli teinud `discardActiveRecording()` `DELETED`/`QUARANTINED` valiku surnud
  koodiks. Ketast ennast tõendab ainult mock — vt Seis-lõigu NOT_PROVEN.
- **SOL-CALL-10** (10.08) — salvestis sai kolm piiri, kus enne oli null: voogedastav
  finaliseerimine (mälukulu ei sõltu enam salvestise pikkusest), kestuselagi koos serveri
  automaatse peatamisega ja kvoodireserv enne providerit. Kriteeriumi osa **„jõustada
  maksimaalne kestus provideris"** ei ole teostatav — LiveKit'i egress ei tunne sellist
  seadet — ja ta on Seis-lõigus nimeliselt asendatud serveripoolse valvega.
- **SOL-URG-01** (10.08) — laua järjekord võttis kõik pöördumised vanimast alates ja lõikas
  200 peal, seega ajaloos 200 vanema rea taha jäi iga uus abipalve **deterministlikult**
  nähtamatuks. Töö ja ajalugu on nüüd eri päringud, loendurid tulevad andmebaasist ja kärbe
  ütleb ennast välja. Sama parandus kattis ka `GET /api/urgent-requests?role=desk`, kus oli
  teine koopia samast valikureeglist.
- **SOL-URG-02 + SOL-PRE-01** (10.08) — **kaks P0-d eri peatükkidest, üks tehing.** Konto
  kustutus vastas `ok: true` töö kohta, mida ta ei teinud: kiire abi verbatim-tekst, nimi ja
  telefon jäid alles, saatmata eelpöördumiste mustandid samuti. Neid ei saanud eraldi
  parandada, sest konversioon kopeerib kiire abi teksti mustandisse — ainult ühe sulgemine
  oleks jätnud samad sõnad teise tabeli alla. **Omanikule jääb lahtiseks retentsiooni
  tähtaeg**, vt URG-02 Seis-lõiku.
- **SOL-SLOG-13 + SOL-SLOG-14** (10.08) — kaks P0-d, üks loend. `listShareRecipients()` ei
  ole ainult UI valik, vaid ka saatmise autoriseerimise alus, seega mõlemad andsid ÕIGUST
  kliendinimedega aruandele. SLOG-13: juhiseos lisas saaja ise, vastu mudeli enda invarianti
  („EI ANNA SISUÕIGUSI"). SLOG-14: kaks `OR`-i ühes objektis — teine kirjutas esimese üle ja
  `validUntil` kontroll kadus päris WHERE-st, seega aegunud luba töötas edasi. Kehtivus ja
  skoop on nüüd ühe `AND` harudena: struktuur ise välistab vea.
- **SOL-SLOG-01** (10.08) — seadme `localStorage` oli BRAUSERI oma, mitte konto oma: jagatud
  arvutis nägi järgmine töötaja eelmise kliendi nime ja märkust, ja võrgujärjekord saatis
  need kirjed UUE töötaja teenuskirjeteks. Read on nüüd omaniku ID järgi eraldatud ühe
  jagatud värava taga (`lib/serviceLog/deviceStore.js`), mis annab omanikuta **`null`** —
  identiteedita on seade lukus. Parandus on **tõendatud päris brauseris päris sessiooniga**
  ja tõi välja **kaks raportis kirjas mitte olnud leidu**: mustand kustus lehe avamisel
  (lipp oli viide ja jooksis taastatud väärtustest ette) ning üks ootel kirje läks teele
  kolme POST-iga (voo-lukk puudus). Mõlemad parandatud.
- **SOL-SLOG-17 + SOL-SLOG-18** (10.08) — **kaks P0-d, üks juur.** Külastus ei kandnud
  organisatsioonilist päritolu ja juhi tahvel tuletas skoobi INIMESE kaudu. Kahes majas
  töötaval inimesel on aga üks SOLO-profiil ja üks tööpäev, seega org A juht nägi org B
  klientide nimesid (-17) ja sai teadaoleva `visitId` abil org B töö oma töötajale ümber
  määrata (-18). Neid ei saanud eraldi parandada: mõlema kriteerium algab samast
  külmutatud väljast. `ServiceVisit.assignedOrganizationId` (migratsioon `20260810160000`)
  kirjutatakse seal, kus ta on tõendatud; `NULL` tähendab „mitte kellelegi", mitte
  „kõigile". Ümbermääramine annab võõrale päritolule **404** enne olekukontrolli, ja audit
  on nüüd `$transaction`-is, mitte `.catch(() => {})` taga. Tõendatud päris PostgreSQL-is
  (üks teekond, kaks maja + päritoluta rida; `EXPLAIN` = Index Scan).
- **SOL-RAGSVC-01 + SOL-RAGSVC-02** (10.08) — **kaks P0-d, üks viga:** kliendi tekst
  kasutati failiteena ilma tõendamata, et ta jääb hoidlasse. `-01` andis kirjutamise
  (`raw_path = d / file_name`, kus Pythoni `/` viskab absoluutse parema poole korral vasaku
  ära), `-02` lugemise (kliendi `source_path` → registri `path` → `FileResponse`). Uus
  `rag-service/storage_paths.py` on eraldi moodul, sest `main.py` sõltuvusi ei saa
  ühiktestis laadida — **piir, mida ei saa testida, ei ole piir**. `/ingest/text` salvestab
  nüüd allikateksti ise. Auditis nimetatud ühe lugemiskoha asemel leidsin **kuus**: sama
  registri `path` avatakse ka `reindex`-i kolmes harus, artiklite ingestis ja metaandmete
  uuenduses. **HTTP-negatiivtest on kirjutatud, aga teadlikult jooksmata** — enne deploy'd
  oleks ta ise rünnak päris serveri vastu; `npm run rag:path:probe` ootab deploy-järgset
  käivitust.
- **SOL-JOUR-01** (10.08) — eelpöördumise jagamisvalikuid oli KAKS ja ainult esimene juhtis
  teksti. Teine — see, mida kasutaja näeb vahetult enne adressaadi valikut — filtreeris
  ainult manifesti koopiat; `topic`, `situation` ja kirjamustand jäid esimese projektsiooni
  kujule. Linnuke läks maha, tekst läks adressaadile. Nüüd küsib iga muutus serverilt uue
  projektsiooni ja kõik püsivad väljad tulevad sellest ühest vastusest; kliendipoolne filter
  on kustutatud, mitte parandatud. Vana vaikehulk `personWish` ei kuulunud isegi serveri
  sõnavarasse. **Tõendatud lõpuni: salvestatud andmebaasireas eemaldatud võtme markerit EI
  OLE**, `confirmedKeys` vastab täpselt projektsioonile.
- **SOL-NET-01 + SOL-NET-02** (10.08) — **kaks P0-d, üks juur:** kogu `lib/network/share.js`
  kirjutas mustriga „loe rida → kontrolli mälus → kirjuta `where:{id}`", seega kinnitus
  viitas REALE, mitte tekstile. Parandus on kaks veergu (`contentHash`,
  `confirmedContentHash`, migratsioon `20260810180000`) ja üks primitiiv `commitOnce`, mida
  kasutavad kõik kuus kirjutavat rada. Saatmine nõuab rea tingimuslikult endale **enne**
  ruumi loomist ja teeb mõlemad ühes tehingus — vana järjekord jättis kaotanud saatmise
  järel orvu ruumi ja ruumitõrke järel `CONFIRMED` rea koos ruumiga. Kanooniline räsi-string
  on JS-is ja SQL-is sama; pariteet **mõõdetud**, mitte eeldatud. Sama klassi leid, mida
  raportis ei olnud: avamine-vs-tagasivõtmine, kus mõlemad lähtusid seisust `SENT`.
  Sond `npm run net:share:probe` **30/30 päris PostgreSQL-is**, deterministlike
  lukuvõistlustega mõlemas järjestuses; **vana käitumise vastu 14 passed / 16 failed**.
  Ühiktestide fake sai parandatud (tagastas lugemisel sama objektiviite — just see peitis
  selle veaklassi).
- **SOL-PRE-02** (10.08) — tagasivõetud pöördumise pakett oli organisatsioonile endiselt
  avatav ja uuesti määratav. Parandus on üks invariant kahes tükis: **sisu** peatab
  `projectSourcePackage()` (`recalledAt` → `null`, värav on ainsa ukse sees, mitte
  kutsujates) ja **töö** peatab `isTerminalInboxStatus()`, mis on **tuletatud
  seisumasinast**, mitte teine käsitsi hoitud loend. Kirjutavad rajad võtavad nüüd
  `FOR UPDATE` postkastikirje real **enne lugemist** — seisukontroll üksi ei püüa
  võistlust, sest ta mõõdab hetke, mis on möödas enne, kui ta jõuab otsustada.
  Avamise rajal on **kirjutus kohtunik**: kui `updateMany({openedAt: null, recalledAt:
  null})` ei kirjutanud, loetakse värskelt üle, MIKS. Kolm leidu, mida raportis ei olnud:
  saatja kiirusmärge elas org-tabelis koopiana (kustutatakse tagasivõtmisel + maskeeritakse
  vanadel ridadel), vananenud lugemine oleks andnud sisu ka pärast tagasivõtmist, ja
  `respondToAssignment` sõltus tuletisest. Sond `npm run org:recall:probe` **42/42 päris
  PostgreSQL-is**, deterministlike lukuvõistlustega mõlemas järjestuses; **vana koodi vastu
  21 passed / 21 failed**. Brauseris läbi käidud kahe kirjega kõrvuti.
- **SOL-JOUR-02** (10.08) — Teekonna mustand elas globaalse `sessionStorage` võtme all ilma
  kasutaja ID-ta; sama vahekaardi kontovahetus taastas eelmise inimese olukirjelduse.
  Sama viga mis SOL-SLOG-01, seega kaitse kolis ühte kohta
  (`lib/device/ownerScopedStorage.js`) ja teenuspäevik delegeerib sinna. Tõendatud brauseris:
  vana sildistamata rida kustutati, võõra omaniku rida jäi puutumata ja kummastki ei jõudnud
  ekraanile midagi.
- **SOL-CALL-11, -12, -13** (10.08) — kõneklienti puudutav plokk: kolm leidu elasid kõik
  `components/rooms/useRoomCall.js`-is ja neid parandati koos, sest üks fail on üks sidus
  funktsiooniplokk. **Dokumendi järjekorrast tehti siin teadlik erand**: CALL-12 oli
  peatüki ainus lahtine P0 ja CALL-04…-10 (P1/P2) jäid tema taha ootele. Otsused kolisid
  hookist välja `lib/calls/clientState.js`-i, sest testijooksja ei renderda React-hooke —
  seesama muster, mis JTA E2-s (laua sektsiooni olek). Kõigil kolmel on runtime katmata,
  vt Seis-lõike.

**SOL-SPROF-01 ja -02 (10.08): kood tehtud, seis KVALIFITSEERITUD.** Mõlema juur oli sama —
profiil ütles „eemaldatud" enne, kui midagi oli eemaldatud, ja kaotas seejuures ainsa viida
orvule. Uus jagatud moodul `lib/privacy/serviceProfileRagRemoval.js` kirjutab püsiva
`RAG_DELETE` töö **enne** kustutuskatset ja kustutab `ragSourceId` **ainult kinnitatud
kustutuse järel**; puuduv RAG-võti ei ole enam „skipped". Konto kustutus peidab SOLO-profiili
ja tema kaardikirjed ning kirjutab töö — kõik enne `user.delete`-i, samas lukustatud
tehingus. Uut töölist ei ehitatud: `DataDeletionJob` + `deletionJobRetryService` +
deploy-värav olid olemas. Kolm puuduvat otsa said **10.08 õhtul** kaetud: päringuaegne
fail-closed nõusolekuvärav (`lib/privacy/serviceProfileRetrievalGuard.js`), aus
pending/failed seis liideses ja runtime-tõend päris PostgreSQL-i vastu
(`npm run sprof:consent:probe` 22/22). Ühiktest leidis seejuures, et esimene värav oli
**vales kohas** — `searchRagQueries` tagastab kahest kohast ja ühe päringu kiirtee käis
mööda; värav kolis `searchRagDirect`-i. Teine, seni märkamata uks oli **kovisiooni
teadmusotsing**, mis käib sama RAG-indeksi peal ilma kollektsioonifiltrita.

**Kogu SOL-ORG peatükk (01…12) on 10.08 õhtul tehtud** — auditi neljas lõpuni viidud
peatükk. Muster kordus enamikus: loe seis → otsusta → kirjuta tingimusteta; parandus on kas
`updateMany ... WHERE <eeldatav seis>` või rea lukk ENNE lugemist. Viis uut sondi, kõik päris
PostgreSQL-i vastu (`slog:org:probe` 34/34 · `org:seat:probe` 26/26 · `org:sponsor:probe`
33/33 · `org:inbox:probe` 51/51 · `org:invite:probe` 38/38 · `org:offboard:probe` 60/60) ja
**iga sond jooksutati ka vana koodi vastu**, punaste arv on kirjas iga leiu Seis-lõigus.
Neli asja tulid välja alles sondiga ja audit ise neid ei nimetanud: korduv sponsorluse
vastuvõtmine tegi kaks tellimusrida · korduv kutse vastuvõtmine oleks teinud kaks liikmesust ·
`REVOKED` kutse all oli aktiivne liikmesus koos õigustega · ühest olekumuutusest jäi auditisse
kaks sündmust. Migratsioon `20260810200000` teeb külastuse organisatsioonilise päritolu
andmebaasi tasemel muutumatuks.

**SOL-FIELD-01 ja -02 (10.08): kaks sama klassi leidu vastupidises suunas.** FIELD-01-l oli
otsus õige, aga teda TOITEV loendur luges vale asja — hoiatuste loendurit kasvatas taustakäik,
mida mitte ükski komponent ei kuvanud („kolm hoiatust" = „rakendus avati kolmel eri päeval").
FIELD-02-l on otsus õige ja teda ei kutsu mitte keegi: `fieldPackPurgeDue()` oli olemas, aga
ainus automaatne säilituskäik luges `items`, mitte pakke — ohutusinfot kandev külastuspakett
kadus seadmest ainult käsitsi. FIELD-02 sond käib **päris Chromiumi päris IndexedDB ja
WebCrypto vastu** (`npm run field:pack:probe` 26/26), sest fake-hoidla ei tõenda seda, et
otsus tuleb toime ainult metaandmetega — sisu on seadmes krüptitud. Vana koodi vastu 6 plokki
punast. FIELD-01 brauserikiht jääb `NOT_PROVEN`.

**SOL-FIELD-03 (10.08): audit kirjutas alati globaalse ühenduse kaudu ja neelas iga vea.**
Nüüd on kaks eksporti ja kaks lepingut — `writeDataAudit()` võtab `db` süstituna ja VISKAB,
`logDataAudit()` jääb best-effort'iks. Viis kohustuslikku välitöö rada on põhitehingus;
turvahoiatuse ja säilituskäigu kirjed said süstitud kliendi, aga jäid teadlikult
best-effort'iks, sest seal on kiri juba saadetud ja fail juba kustutatud — rollback teeks
rohkem kahju. Teine pool leidu oli TESTIDES: fake-DB-ga roheline test proovis vaikselt päris
andmebaasi kirjutada (mõõdetud: 241 ms esimesel kirjutusel). Fake-hoidla ise pidi saama
päris rollback'i ja pesastatud seose-projektsiooni — mõlemad peitsid veaklassi. Vana koodi
vastu **8/12 punast**.

**SOL-FIELD-04 (10.08): marker kadus kolmel viisil, millest üks oli raportist väljas.**
Kinnine väljaloend ei kopeerinud teda (kolmas kord samas failis), flush eemaldas ta pärast
IGA täidetud päringut staatust vaatamata — ja võrguta kinnitus kutsus `storePack`-i
**võltsvisiidiga**, mis kirjutas üle terve ettevalmistuspaketi, sealhulgas OHUTUSINFO.
Marker on nüüd versioonitud pakiskeemi osa ja kaob ainult 2xx või tõendatud sündmuse peale;
kõik muu jätab ta alles nähtava tõrkeseisu ja korduskatsega. Sond **35/35** päris IndexedDB
vastu (sh rakenduse taasavamine), ühikuid **18**. Mõõtmise aus piir on Seis-lõigus: vanal
koodil ei olnud moodulipiiri, mille vastu jooksutada.

**SOL-FIELD-05 ja -06 (10.08) lõpetasid peatüki.** FIELD-05: teksti vastuvõtmine ja toorheli
kustutuskell olid kaks eraldi päringut, millest teise viga neelati ja eduteade anti alati —
nüüd on nad **üks idempotentne serveritoiming** (märge kannab viidet salvestisele, kell
käivitub samas tehingus) ja eduteade tuleb ainult siis, kui kirje jõudis `SYNCED`-i. Vana
koodi vastu 4/9 punast; kolm rohelist on seal **tühjalt** rohelised, sest kella ei
käivitatud kunagi. FIELD-06: lubatud 5 s → 5 min backoff oli olemas ainult arvutusena —
ükski taimer ei käivitanud kordust. Uus `lib/field/syncScheduler.js` on Reactist väljas ja
tema kell on süstitav, seega **viis automaatset katset, backoff, peatumine, parkimine ja
unmount'i koristus on mõõdetud võltskella all**, ilma ühegi päris ootamiseta.

**SOL-DOC-01 (11.08) avas dokumendipeatüki: tasu võeti enne, kui tulemus oli olemas.** Kolm
rada arvestasid kasutuse maha kohe pärast mudelikutset ja märkisid siis „valmis" lipu, mis
keelas hilisema vabastuse — mustandi loomise viga, üle kvoodi jäänud sisu (413) või auditirea
viga tuli juba arvestatud ühiku otsa. Järjekord `reserve → produce → persist → commit` on nüüd
omaette moodulis (`lib/usage/paidResult.js`) kahe piiriga: viga enne tasu vabastab, tasu enda
viga EI vabasta (püsiv tulemus on juba omaniku oma). Refine'i puhul on püsiv asi **auditirida**
— ühtlasi kolme refinement'i loenduri ainus allikas — seega käivad audit ja tasu ühes tehingus.
Parandus ise oleks tekitanud uue lõksu (stabiilne kliendivõti + vabastus = igaveseks surnud
kavatsus), nii et vabastatud võti on nüüd sama perioodi sees uuesti reserveeritav. Vana koodi
vastu kolm punast ja **üks, mis ei kuku, vaid lukustub** — vana `commit` avab alati oma
tehingu, ja just see lukk on tõend, miks audit ja tasu ei saanud varem üks toiming olla.

**SOL-DOC-02 (11.08): kaks otsepunkti väljaspool lepingut.** Helifaili transkriptsioon kutsus
päris teenusepakkujat ilma ühegi `STT_SECONDS` reservatsioonita ja transkripti kokkuvõte tegi
AI-genereerimise ilma `DOCUMENT_GENERATE` lepinguta; mõlemal oli ainult minutipõhine
**mälupõhine** rate-limit, mis ei ole perioodikvoot. Uus `lib/usage/sttDuration.js` hoiab lahus
kaks eri küsimust: **enne** kutset vastust ei ole, seega reserveeritakse turvaline ülempiir
(kõnesalvestise teadaolev kestus → failist loetud kestus → baitidest tuletatud piir kõne
madalaima usutava bitikiiruse järgi); **pärast** kutset on vastus olemas, seega arvestatakse
tegelik kestus — piiratud reserveeritud mahuga, et vale hinnang ei muutuks 500-ks kasutajale,
kelle transkript on juba olemas. Olemasoleva transkripti tagastamine ei reserveeri midagi.
Limiidi ületamise negatiivne rada on tõendatud ahelana (teenus viskab → deskriptor teeb 429 →
leping mõõdab, et marsruut seda kasutab), mitte ühe HTTP-testiga.

**SOL-DOC-03 (11.08): kontroll oli olemas — lihtsalt vales kohas.** Nii artefakti muutmine
kui kinnitamine lugesid seisu eraldi päringuga ja kontrollisid mälus, et rida on `DRAFT`, aga
kirjutus tuli hiljem ja sihtis ainult `where: { id }`. Kahe vahekaardi tavaline kasutus piisas:
kui kinnitus jõudis vahele, muutis hilinenud salvestus **juba kinnitatud dokumendi sisu**.
Kontroll ja kirjutus on nüüd üks tingimuslik lause (`id + ownerId + status + oodatud versioon`,
versiooniks `updatedAt`, migratsiooni ei vaja) ja kinnitamine võib kliendi sisu kaasa võtta,
nii et detailivaate kaks päringut said üheks. **`npm run artifact:race:probe` 33/33 päris
PostgreSQL-is**, sealhulgas negatiivkontroll: sond jäljendab samas harnessis vana mustrit ja
nõuab, et see FINAL-i ära rikuks — rikub, seega on võistlus päris ja ülejäänud rohelised on
paranduse teene.

**SOL-DOC-04 (11.08): kaks tõde ühest dokumendist.** Transkripti muutmine kirjutas uue teksti
vana faili PEALE ja alles siis andmebaasi: DB-vea korral luges allalaadimine juba uut sisu, aga
API ja AI-kokkuvõte vana `content` välja. Uue transkripti rada kirjutas faili enne rea loomist ja
catch ei teadnud loodud teed — tundlik tekst jäi kettale ilma omaniku- ja retention-reata.
Järjekord on nüüd ümber: uus sisu läheb ajutisse faili ja avaldatakse `rename`-ga **tehingu sees
viimase sammuna**, ülekirjutusel hoitakse vana varukoopiana, et ka „rename õnnestus, tehing
kukkus" aken taastuks. **`npm run doc:staging:probe` 17/17** päris hoidla ja päris tehinguga,
kolm veasüsti: viga enne avaldamist, viga PÄRAST avaldamist, ja loomise viga (orbfaili ei teki).

**SOL-DOC-05 (11.08): piir oli loendus, mitte koht.** Kolme paranduse limiit luges auditiread
kokku ENNE AI-kutset, aga auditirida lisandus alles PÄRAST — kaks samaaegset päringut lugesid
sama arvu, mõlemad nägid ruumi ja mõlemad said läbi. Koht võetakse nüüd enne kutset ja on püsiv
rida; kontrolli ja kirjutuse tehingut serialiseerib artefaktipõhine nõuandelukk
(`pg_advisory_xact_lock`, ainult `$executeRaw` kaudu). Reserveeritud rida kannab `pending: true`
ja kustutada saab AINULT kinnitamata koha, seega päris auditijälge see tee ei puuduta.
**`npm run refine:slot:probe` 13/13**: 2/3 täis + neli võistlejat → võidab täpselt üks; tühi
artefakt + kuus võistlejat → võidab täpselt kolm. Negatiivkontroll näitab, et vana muster laseb
sama samaaegsuse all limiidist üle.

**SOL-DOC-06 (11.08): kaks paralleelset esmakutset nägid mõlemad tühja lauda.** Marsruut
kontrollis „kas transkript on olemas", ja kui ei olnud, lõi job'i ning kutsus teenusepakkujat —
ilma ühegi unikaalsuseta aktiivsele tööle. Üks kasutajategevus võis seega teha mitu välist kulu
ja mitu eri sisuga transkripti. Otsus ja tema jälg on nüüd ühes allikapõhise nõuandelukuga
tehingus: valmis transkript → taaskasutus ilma kutseta, aktiivne töö → 409, muidu claim, milleks
ON job ise. Vananemisaken on lepingu osa — ilma temata lukustaks surnud protsess allika
igaveseks. **`npm run transcribe:claim:probe` 13/13**: neli esmakutset annavad ühe töö, täisvoog
võltspakkujaga ühe kutse ja ühe transkripti; negatiivkontroll näitab, et vana muster teeb sama
samaaegsuse all mitu.

**SOL-DOC-07 (11.08): kvoot kehtis ainult ühele päringule korraga.** Neli rada — tavaline ja
helifaili üleslaadimine, artefakti loomine ja muutmine — lugesid senise mahu agregaatpäringuga ja
lõid rea alles hiljem, seega kaks päringut mahtusid mõlemad vana summa järgi ära ja ületasid koos
limiidi. Mõõtmine ja kirjutus käivad nüüd ühes kasutajapõhise nõuandelukuga tehingus
(`write(tx)` jookseb luku SEES — kui ta jookseks väljaspool, oleks tulemus täpselt vana kood).
Loenduriveergu teadlikult ei tehtud: kanooniline maht on tuletatav summa mitmest tabelist ja
eraldi loendur oleks neljas koht, mille lahknemine oleks nähtamatu. **`npm run
storage:quota:probe` 8/8**: ruumi kahele + neli võistlejat annab täpselt kaks võitjat ja lõppsumma
ei ületa limiiti; negatiivkontroll näitab, et vana muster ületab. Üleslaadimine sai ühtlasi
SOL-DOC-04 lepingu, seega kvoodi 413 ei jäta enam faili kettale.

**SOL-DOC-08 (11.08): kontroll, mis iseennast ei näinud.** Salvestatud analüüsi loomine
kontrollis kasutaja üldist salvestusmahtu, aga see summa luges ainult dokumente, materjale ja
artefakte. Analüüs võib olla kuni 200 kB ja ükski neist ei muutnud järgmise kontrolli sisendit —
neid sai järjest salvestada piiramatult, ilma 413-ta. Analüüs on nüüd kanoonilise summa neljas
pott ja salvestamine kasutab sama atomaarset reservatsiooni. Sondis mõõdetud: kaks analüüsi
annavad oma baidid nii omas potis kui kogusummas, täis kvoodi all saab järgmine 413, kustutamine
vabastab mahu. **Kõrvalleid:** kõneteenuse fake-klient ei tundnud `savedAnalysis` mudelit ja
puuduv pott ei andnud seal nulli, vaid krahhi — see oleks maskeerinud kvoodikeelu millekski muuks.

**SOL-DOC-09 (11.08) lõpetas peatüki: vaikus oli leiu tuum.** Analüüsi salvestus ja kustutus
kutsusid auditit sündmustega, mida auditikaardis ei olnud — tundmatu sündmus andis `null` ja
logifunktsioon lõpetas kirjutamata. Toiming paistis koodis auditeerituna, aga ühtki rida ei
jäänud, ja funktsioonikutset kontrolliv test oleks olnud roheline kogu selle aja. Skeem sai kaks
oma action'it (ainus migratsiooni vajav leid selles peatükis), `writeDocumentAudit()` on
kohustuslik tee, mis kaardistamata sündmuse ja kirjutuse vea peale VISKAB, ja kustutus koos oma
jäljega on üks tehing. **`npm run analysis:audit:probe` 10/10**, sh „olematu analüüsi kustutus ei
loo jälge".

**SOL-RES-01 (11.08): kaks eri asja olid ühte aetud.** Kogu uuringupind käis läbi värava, mis
nõudis alati aktiivset tellimust — aegunud tellimusega inimene ei näinud oma uuringu sisendit,
tulemust ega olekut ja ei saanud teda ka koristada, kuigi dokumentidel on sama küsimus juba
lahendatud kõva reegliga. Ja `DELETE` kutsus ainult `cancelResearchJob()`, mis terminaltöö puhul
väljus kohe midagi muutmata, aga marsruut vastas ikkagi eduga: kasutajale öeldi „kustutatud" ja
rida ilmus kohe uuesti. Nüüd on lugemine, peatamine ja kustutamine tellimusevabad (POST jääb
värava taha, mõlemad ühes failis kõrvuti), peatamiseks on oma marsruut ja DELETE eemaldab rea
päriselt; aktiivne töö annab 409 „peata enne". **`npm run research:delete:probe` 15/15** kõigis
viies olekus. Sond tõi välja fakti, mida raportis ei olnud: andmebaasis on osaline unikaalne
indeks „üks aktiivne töö kasutaja kohta".

**SOL-RES-02 (11.08): idempotentsus toimis kahes kihis vastupidise tähendusega.** Võti sidus
kasutusühikut, aga töö loodi alati uue UUID-ga — sama võtit teadlikult korrates sai ühe ühikuga
käivitada järjest uusi täismahus uuringuid, samas kui tavaklient ei saatnud võtit üldse ja
võrguvea kordus lõi uue tasulise töö. Kavatsus sai oma veeru ja unikaalse `(userId,
clientIntentKey)` paari; sama võti tagastab olemasoleva töö ka pärast lõppu, teine sisend annab
409. **`npm run research:intent:probe` 21/21.** Sond leidis kohe ühe päris vea paranduse enda
sees: taaskasutatud töö tuli protsessimälust ja kandis vana seisu — lõppseisu autoriteet on nüüd
andmebaas.

**SOL-RES-03 (11.08): kaks protsessi, kaks tõde.** Töö loonud frontend pani iga uue töö oma
lokaalsesse Map'i, aga worker-režiimis jooksutab tööd hoopis teine protsess — päritoluprotsess ei
saanud tema sündmusi kunagi ja andis detailis ning voos lõputult `queued`, kuigi töö oli
andmebaasis ammu lõppenud. Parandus on OMANDI küsimus, mitte sünkroonimise oma: runtime-objekt on
ainult sellel protsessil, kes tööd päriselt jooksutab; teised loevad andmebaasist. SSE tuleb kaasa
ilma eraldi mehhanismita, sest voog valib andmebaasi pollimise täpselt siis, kui lokaalset objekti
ei ole. **`npm run research:worker:probe` 8/8 PÄRIS kahe protsessiga** (sond kontrollib, et lapse
pid on teine); negatiivkontroll näitab, et oma runtime-objektiga protsess näeb ikka vana seisu.

**SOL-RES-04 ja -05 (11.08) käivad kokku.** RES-04: heartbeat uuendas rida tingimusel `workerId`,
aga ei vaadanud kunagi `updateMany.count` väärtust, progress kirjutas tingimusteta ja kirjutas vana
lease'i tagasi, terminalsiire nõudis ainult aktiivset staatust — pausi järel jätkas vana worker
mudeli- ja RAG-kutseid ning võis tulemuse esimesena commit'ida. Fencing käib nüüd `workerId` järgi
(eraldi veergu ei ole vaja) ja `count === 0` katkestab töö; TÜHISTUS jäi teadlikult fence'imata,
sest Stop tuleb frontendist, kes ei ole kunagi omanik. **`npm run research:lease:probe` 9/9 kahe
päris workeri ja kahe protsessiga.**

RES-05: `persistDone` neelas DB-vead ja pipeline ei vaadanud tagastusväärtust — uuring märgiti
`done` ja kasutus commit'iti ka siis, kui vestlusse ei jäänud raportist jälgegi. Lõpp on nüüd
seotud KINNITATUD koopiaga; kui teda ei ole, jääb töö aktiivseks ja kasutust ei arvestata. Kirjutus
on job-idempotentne (`persistKey`), mis kattis ühtlasi RES-04 kriteeriumi viimase lause. **`npm run
research:persist:probe` 10/10.**

**SOL-RES-06 (11.08): vaikus oli kogu mehhanism.** Arveldus käis pärast `done`-iks märkimist ja
tema vead neelati täielikult: edukaks märgitud töö võis jääda RESERVED-iks ja reaper vabastas ta
hiljem kui kasutamata ühiku. Tühistatud töö arveldust ei saanud snapshot'ist üldse teha, sest võtit
otsiti payload'ist, mida snapshot ei säilita. Nüüd loetakse võti vajadusel reast juurde, arvelduse
tulemus jääb reale kirja ja pooleli jäänud arveldusi korratakse oma tempos. **`npm run
research:settle:probe` 13/13**; migratsiooni ei olnud vaja.

**SOL-MEET-01 (11.08): kaks vaikset viga, üks tagajärg — kasutaja jäi lukku.** Töö pandi protsessi
Map'i ENNE snapshoti kirjutamist, seega kirjutuse vea korral jäi `queued` töö sinna igaveseks
(sweep ei kustuta queued/running olekut) ja aktiivse töö limiit oli protsessi elueaks kinni. Teiseks
seisid running-märge, tema snapshot ja `import("openai")` `try`-plokist väljas — nende viga jõudis
ainult logisse, tööd ei märgitud error'iks ega vabastatud kasutust. Nüüd kirjutatakse enne ja
tehakse nähtavaks pärast, kogu jooksu algus on ühe fail-closed katuse all ja terminalolek pannakse
paika mälus enne ketast. **4/4 veasüstetesti päris fs-vigadega** (`EEXIST` `mkdir`-il, `EPERM`
`rename`-il); igal testil on negatiivkontroll. Migratsiooni ei ole vaja.

**SOL-MEET-02 (11.08): lahendus oli koodibaasis olemas ja kasutamata.** `usageService.commit()`
võtab `tx` parameetri just selleks, et arveldus saaks kuuluda kutsuja püsiva kirjutusega ühte
tehingusse — ja see moodul oli kogu koodibaasis ainus kutsuja, kes seda ei kasutanud. Nüüd sünnivad
kvoodikontroll, `UserDocument` rida ja ühiku commit ühes tehingus: kas kõik kolm või mitte ükski.
Kvooti saab jõustada just sellepärast, et commit on tehingu sees. `commit_pending` oli olemas, aga
seda ei lugenud keegi tagasi — nüüd on püsiv kordus, ja sama sweep ei tohi enam pooleli arveldusega
snapshotit ära visata. **`npm run meeting:summary:probe` 12/12** päris PostgreSQL-is, sh päris
rollback. Migratsiooni ei ole vaja.

**SOL-MEET-03 (11.08): TTL kehtis täpselt nii kaua, kuni server ei taaskäivitunud.** Koristus käis
läbi protsessi mälu ja kustutas snapshoti ainult sealt leitud terminaaltöö puhul; pärast restarti on
see mälu tühi, aga snapshot kannab valmis kokkuvõtte teksti — seega jäi kohtumise tundlik sisu
kettale tähtajatult. Nüüd loeb sweep kataloogi ennast: kehtiv terminalkirje aegub oma `endedAt`
järgi, rippuma jäänud `queued`/`running` katkestatakse ja vabastab kvoodi, ning loetamatu `.json`
ja orb `.tmp` kaovad **fail-closed** faili vanuse järgi — tundliku teksti puhul on „ei suutnud
lugeda" argument kustutamise POOLT. **7 uut testi**; negatiivkontroll kukutab 5 seitsmest.
Migratsiooni ei ole vaja.

**SOL-MEET-04 (11.08): loendus oli leiu põhjus, seega ta on kadunud, mitte parandatud.** Aktiivsete
tööde arvu loeti protsessi mälust ja kataloogist ning uus töö lisati alles hiljem — kaks põimuvat
POST-i lugesid mõlemad „aktiivseid ei ole". `MeetingSummaryJobClaim.userId` unikaalsus on ainus
koht, kus see võidujooks päriselt lõpeb; aegunud claim on üle võetav ainult compare-and-swap'iga.
**Paranduse kirjutamise ajal tuli välja auk, mida raportis ei olnud:** kui claim'i `updatedAt` jääks
loomise hetke peale seisma, muutuks üle 15 minuti kestev töö „aegunuks" ja teine POST võiks ta
ELUSALT üle võtta — südamelöök käib nüüd jooksu kahes punktis. **`npm run meeting:summary:probe`
16/16** päris PostgreSQL-is, sh kaks `Promise.all`-iga samaaegset loomist. **Vajab migratsiooni**
(`20260811120000`, uus tabel; olemasolevaid ridu ei puudutata).

**SOL-MEET-05 (11.08): fikseeritud 60 sekundit ei olnud konservatiivne oletus, vaid möödapääs.**
Tundmatu kestusega fail — kuni 12 MB, seega potentsiaalselt tunnipikkune — reserveeris alati täpselt
minuti, ja commit tehti ilma tegeliku mahuta, seega võeti alati kogu reserv. Nüüd tuleb tundmatu
kestuse reserv failimahust (ohutu ülempiir, vaikimisi 32 kbps põrand) ja commit kannab mõõdetud
tegelikku, klammerdatuna reservatsiooni piiri. **Hind on teadlik:** kliendi kuulimiit on 900 s ja
12 MB tundmatu fail annab üle 3000 s, seega selline üleslaadimine lükatakse tagasi — 60-sekundilise
reserviga läbi lastud tunnipikkune fail oligi see viga. 10 testi; negatiivkontroll kukutab kolm.

**SOL-MEET-06 (11.08): toorviga läks kahte kohta korraga** — kasutajale HTTP vastuses ja PÜSIVASSE
JSON-snapshoti. Nüüd käib avalik viga `publicErrorMessageKey()` allowlist'ist läbi ja toorviga
ainult `safeError()`-iga redigeeritud logisse. Teel ühtlustus ka välja kuju: sama `error` väli
kandis kolme eri asja (võti, tõlgitud lause, toortekst) — nüüd on kõik võtmed. Test kontrollib
markeri puudumist eraldi ka kettalt, sest just snapshot on püsiv.

**SOL-CHAT-01 ja -02 (11.08): tasu võeti püsivast kirjutusest LAHUS ja iga viga neelati.** Commit
käis kohe pärast providerit ja püsistus tuli alles pärast seda, seega üks pööre sai lõppeda kolmel
parandamata viisil: limiit kulus ja vastust ei olnud kuskil · vastus oli ja limiit kulumata ·
katkestatud pööre jäi TTL-ini kinni. Arveldus on nüüd `persistDone`-i TEHINGUS — kas terminalmarker
ja tasu mõlemad või mitte kumbki. `usageService.release` sai `tx` toe (commit'il oli ta olemas).
Kinnitamata püsistus ei anna enam `done`-i. **`npm run chat:settle:probe` 23/23 päris
PostgreSQL-is**, sondi tuum on ROLLBACK, mida fake-Prisma ei saa tõendada; negatiivkontroll näitab,
et vana järjekord tekitab arvestatud ühiku ilma vastuseta.

**SOL-CHAT-05 (11.08): kaks viga ühe pealkirja all.** `streamFinalized = true` pandi
finaliseerimisse SISENEMISEL, seega hilisem `finalizeStreamAbort()` oli surnud kood; ja püsistati
`accumulated` (provideri puhver), mitte seda, mida kasutaja nägi. Nüüd kasvab `emitted` ainult
õnnestunud `enqueue` peale ja edurajal on kaks abordikontrolli. Neli testi neljale ajastusele, kaks
neist **enesekontrolliga** (`discardedChars > 0` ja `rag_trace` await'i olemasolu) — muidu oleksid
nad vaikselt rohelised.

**SOL-CHAT-03 ja -04 (11.08): pöördel ei olnud rida, mille külge kinnituda.** Uus mudel `ChatTurn`
(migratsioon `20260811160000`): `(userId, clientTurnKey)` unikaalsus = üks kavatsus, üks rida.
Sessioonipiiri lugemine ja kirjutamine käivad ühes tehingus vestlusepõhise `pg_advisory_xact_lock`
all; üks aktiivne pööre vestluse kohta; aegunud RUNNING suletakse ausalt ERROR-iks. Klient hoiab
kavatsuse võtit kuni lahenduseni ja sama võti läheb ka kasutusarvestusse — **primitiiv
`resolveIntentKey` oli koodibaasis olemas (SOL-DOC-01) ja teda ei kirjutatud teist korda.**
`retryOf` tüübiviga parandatud seal, kus ID sünnib. **`npm run chat:turn:probe` 20/20 päris
PostgreSQL-is** + negatiivkontroll: vana muster ületab sessioonipiiri.

**SOL-CHAT-06 (11.08): EOF ilma `done`-ita märgiti alati eduks.** Nüüd küsitakse serverilt
kinnitust (`readPersistedConversationResult` oli olemas, aga kasutusel ainult uuringu rajal) ja
kinnituseta EOF annab nähtava vea koos Retry-nupuga. Kaasa tuli **SOL-CHAT-04 kriteeriumi viimane
lause**: `/api/chat/run` loeb seisu nüüd `ChatTurn` realt, mitte „viimane sõnum oli kasutajalt"
heuristikast.

**SOL-CHAT-07 (11.08): leid oli KAHE REEGLI VAHE.** Ruumisõnumite API nõuab liikmesust kõigilt,
chat bootstrap tegi adminile erandi, ja sõnumi kirjutaja ise ei kontrollinud midagi. Erand
kustutatud; `saveAssistantRoomMessage()` kontrollib nüüd ise ja **VISKAB** — kirjutus on ainus koht,
kust mööda ei saa. Break-glass jäeti teadlikult ehitamata.

**SOL-CHAT-08 (11.08): commit'i viga viskas valmis analüüsi ära.** `analysisCompleted` lipp keelas
vabastuse JA `catch` tagastas vea, seega kasutaja kaotas tulemuse ja reservatsioon jäi kinni. Nüüd
kehtib `paidResult` teine piir: tasu viga ei vabasta ega tühista tulemust. Klient saadab
failipõhise kavatsuse võtme. **Üks kriteeriumi lause jäi teadlikult täitmata** (kordus parsib faili
uuesti), sest analüüs on lepingu järgi efemeerne — vt leiu Seis-lõiku.

## Lahtised, mis EI OLE lihtsalt tegemata

Neli PARTIAL-leidu ootavad veel runtime- või välisteenuse tõendit ja üks leid omaniku otsust.
Neid ei käsitleta uue tavaparanduse plokina. **SOL-PAY-09 langes 12.08 õhtul siit välja** —
blokk osutus kitsamaks kui kirjeldus:

- ~~**SOL-PAY-09**~~ — **12.08 õhtul TEHTUD, peatükk 11/11.** Blokk oli kitsam, kui siin kirjas:
  mehhanism ei sõltunud otsusest üldse ja kriteeriumi tähtaja-pool oli juba vastatud
  (privaatsustingimuste p 7.9 on avaldatud). Külmutatud koosseis on ühes konstandis ja jurist
  saab teda muuta ilma, et miski muu liiguks. `npm run pay:archive:probe` **24/24** päris
  PostgreSQL-is, kaks negatiivkontrolli. Vt leiu Seis-lõiku raportis.

- **SOL-CW-09** (P2, PARTIAL) — *kood DONE, brauseritest NOT_PROVEN.* Parandus on olemas, aga
  tagasinupu käitumist ei ole päris brauserist läbi käidud. Loendis on ta seepärast lahtine.
- **SOL-CW-14** (P1, PARTIAL) — *mehhanism DONE ja alarm tõendatud päris PostgreSQL-is; taimeri
  LUBAMINE ootab omaniku enda lukustatud järjekorda* (Õ2/Õ3 andmekaitseanalüüs → cron →
  kuivjooks → aktiveerimine). Unit-failid on serveris paigaldatud, taimer on `disabled`.
- **SOL-RES-07** (P2, PARTIAL) — *kood/refaktor DONE; brauserirada NOT_PROVEN.* Sama töö
  edenemisvoog taastub ning create/Stopi ja vestlusevahetuse võistlused on suletud; eraldi
  päris brauseri start → soft-nav → tagasi → progress → Stop rada jäi hydration'i tõrke taha.
- **SOL-DOC-J-03** (P1, PARTIAL) — püsiv RAG-kustutustöö, retry, ligipääsutõkked ja päris
  PostgreSQL on tõendatud; päris RAG-i ingest → keela → GET/search puudub ja konto kustutuse
  välisots on teenusevõtme ning kuulava RAG-teenuse puudumise tõttu NOT_PROVEN.
- **SOL-CW-19** (P1) — *BLOCKED_DECISION.* Leid on mõõdetud ja tõene, aga kriteerium algab
  tooteotsusest, mis on omaniku oma. Koodi ei ole muudetud.

## Kuidas seda loendit lugeda

- **Loend on mehaaniline ja jooksutatav.** `npm run sol:tally` säilitab ametliku DONE/lahtise
  vaate. `npm run sol:progress` eristab kolm täpset algussõna: `DONE`, `PARTIAL` ja kõik muu
  `NOT_DONE`. Vale algusega kvalifitseeritud `DONE` katkestab progressi genereerimise, et ta ei
  kaoks vaikselt valesse rühma. Praegused neli PARTIAL-leidu on ülal nimetatud.
- **Loendur loeb ka jätkufaile** (`…-jatk-*.md`) ja just nende puudumine oli senise loenduse
  suurim viga: SOL-MAT peatükk (13 leidu) ei olnud siin tabelis kordagi. Kui uus jätkufail
  lisandub, muutub nimetaja — jooksuta loendur uuesti, ära paranda numbrit käsitsi.
- **Loenduri enda veaklass on vaikimine, mitte vale arvutus.** Sama viga kordus 11.08 teist
  korda kitsamalt: `SOL-DOC-J-01…-06` ei vastanud rangele mustrile ja kadus. Nüüd nõuab
  loendur, et **iga** `### SOL-…` pealkiri oleks arvestatud, ja kukub muidu nimeliselt —
  seega „numbrid on raportist loetud" on kate ka tulevaste ID-vormingute peal.
- **Seisu määrab Seis-lõigu algussõna, mitte vabateksti üksik runtime-märge.** DONE-leiu
  lisamärge `runtime: not_run` ei ava leidu; PARTIAL algab sõnaga PARTIAL siis, kui täitmata
  runtime on vastuvõtukriteeriumi osa.
- **Järjekorra reegel: P0 EES, dokumendi järjekord on tasavägiste vahel otsustaja.** Reegel
  tekkis 09.08, sest pelk dokumendijärjekord ei kannatanud tabelit välja. **P0-sid ei ole
  auditis enam ühtegi** (viimased kaks olid SPROF-01 ja -02, mõlemad 10.08 kaetud), seega
  järjekord ON langenud tagasi puhtale dokumendijärjekorrale. **SOL-AUTH on 11.08 lõpetatud**,
  ja järgmine peatükk sõltub nüüd otseselt allolevast jätkufailide otsusest.
- **Reegel ei ütle veel midagi jätkufailide kohta ja see on lahtine otsus.** Kui nad
  liidetakse peaauditi järjekorda, tuleb SOL-ORG-13…-17 ette SOL-AUTH-i sabast; kui nad
  jäävad eraldi järjekorraks, tuleb kokku leppida, millal seda tehakse.
- **Uue ploki alustamisel loe ENNE raportist**, mis juba tehtud on. Genereeritud plokk
  („Paranduste seis: DONE / PARTIAL / NOT_DONE") on raportiga alati sünkroonis ja tema all olev jutustus EI OLE — kui nad
  lahku lähevad, kehtib plokk ja tema taga raport.
- **Kui muudad mõne leiu Seis-lõiku, jooksuta `npm run sol:progress -- --write`.** Muidu läheb
  `tests/scripts/solAuditTally.test.js` punaseks — see on tahtlik ja ta on ainus asi, mis
  hoiab seda faili raporti küljes. Käsi ploki sisse ei lähe.
