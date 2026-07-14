# Opus pärast auditit — operatsioonipakett, U4 ja U8-lite

> **Staatus:** OOTAB OPUS AUDITI KVALITEEDIVÄRAVAT
>
> **Teostaja:** Claude Opus 4.8
>
> **Effort:** Max; kui Max pole saadaval, vähemalt Extra (`xhigh`)
>
> **Lähteharu:** `main`
>
> **Koostatud:** 2026-07-14
>
> **Deploy:** keelatud ilma kasutaja eraldi selge loata

## 0. Opusele antav põhikäsk

Loe enne teostamist täielikult:

1. `docs/platvormi arendus/00-uue-akna-handoff-opuse-audit-ja-jargmised-tood.md`;
2. enda kaks värsket auditiväljundit;
3. käesolev tööplaan;
4. iga paketi all nimetatud aktiivne kood, skeem, migratsioonid ja testid.

Ära kasuta vana `ef660414` seisu. Kontrolli `git log`, `git status` ja `origin/main`.

Teostusjärjekord on lukustatud:

1. **Paketivärav:** auditite P0/P1;
2. **P1:** Parimate praktikate operatsioonipakett;
3. **P2:** U4 — teenuseosutaja kättesaadavuse värskus;
4. **P3:** U8-lite — allikate usalduskiht.

Iga pakett on eraldi vertikaalne töö. Ära sega kolme paketti ühte läbipaistmatusse diffi.

## 1. Kvaliteedivärav enne uut koodi

Opus tohib P1 teostamist alustada ainult siis, kui:

- Kovisioon → Lõpetatud juhtumid → Parimad praktikad audit on lõpetatud;
- Tööheaolu → Kovisioon audit on lõpetatud;
- auditites pole lahendamata P0/P1 leidu;
- `main` sisaldab vähemalt commit'e `7f20d7ce`, `9a46192b` ja `42fe884a`;
- tööpuu kõrvalised ruumifailid on kaardistatud ja jäävad puutumata.

Kui audit leiab P0/P1:

1. ära paranda seda samas read-only auditis;
2. jäädvusta täpne leid;
3. anna Solile;
4. oota Soli parandust;
5. tee kordusaudit;
6. jätka siit alles pärast blokeerija sulgemist.

## 2. Ühised teostusreeglid

- Serveri õigused on päris värav; UI peitmine ei ole turvameede.
- Võõras ja puuduv privaatne objekt ei tohi eristuda.
- Ükski taustatöö ei töötle privaatset vabateksti, kui eesmärk on saavutatav ID-de, olekute ja ajatemplitega.
- Kõik perioodilised tööd peavad olema idempotentsed, piiratud partiiga, jälgitavad ja ohutult korduskäivitatavad.
- Kõik võrguväljakutsed vajavad timeout'i, kontrollitud retry-piiri ja püsivat veaseisu.
- Scheduler ei tohi sõltuda ühe serveriprotsessi mälutaimerist. Kasuta olemasoleva job-route/cron mustrit.
- Kuupäeva- ja aegumisotsused arvutatakse serveris; kliendi kell ei otsusta õigusi.
- Uued avalikud vead läbivad allowlist'i; suvalist `error.message` väärtust ei väljastata.
- Kõik inimeste kinnitused on versioonikindlad; stale toiming annab kontrollitud 409.
- Ära kasuta uusi PostgreSQL enum'e seal, kus rakenduskihi whitelist on tagasipööratavam.
- Ära stage'i ega commit'i kasutaja kõrvalisi faile.

## 3. P1 — Parimate praktikate operatsioonipakett

### 3.1 Eesmärk

Muuta juba valmis Parimate praktikate avaldamis- ja ülevaatusvoog operatsiooniliselt taastuvaks. Ühekordne tõrge, aegunud tähtaeg või kustunud retsensent ei tohi jätta objekti märkamatult püsivasse poolikusse olekusse.

Pakett sisaldab viit seotud osa:

1. ebaõnnestunud RAG-ingest'i automaatne taastaja;
2. ülevaatustähtaegade ja ülesannete scheduler;
3. retsensendi määramise parandaja;
4. ülevaatuse põhjenduse muutmatu ajalugu;
5. deploy-eelne RAG drain/verify värav.

### 3.2 Kohustuslik kaardistus

Loe vähemalt:

- `lib/effectivePractices.js`;
- `lib/effectivePracticeApi.js`;
- `lib/privacy/deletionJobRetryService.js` ja seotud deletion-job teenused;
- `scripts/drain-effective-practice-rag-deletions.mjs`;
- `app/api/effective-practices/**` ja `app/api/covision/effective-practices/**`;
- `app/api/jobs/subscription-renewals/route.js` olemasoleva job-värava mustrina;
- `prisma/schema.prisma` mudelid `EffectivePractice*`, `PracticeCapability*` ja `DataDeletionJob`;
- migratsioonid `20260714170000_effective_practice_workflow` ning `20260714171000_effective_practice_legacy_quarantine`;
- kogu `tests/effectivePractices/**` ja seotud usage/privacy retry testid;
- `docs/platvormi arendus/05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md` §11–14.

Enne koodi kirjuta käesoleva faili progressiossa:

- praegused RAG publish/delete olekud;
- milline püsiv objekt kannab retry seisu;
- kuidas scheduler autenditakse;
- kuidas katkist assignment'i tuvastatakse;
- milline põhjendus praegu üle kirjutatakse;
- millised read-only deploy-kontrollid on juba olemas.

### 3.3 P1-A — RAG-ingest'i automaatne taastaja

Nõuded:

- ebaõnnestunud või pooleli avaldamise ingest saab püsiva retry-kirje;
- töö identiteet on deterministlik vähemalt praktika ID + avaldatav versioon + toiming;
- sama töö korduskäivitus ei loo teist RAG-dokumenti;
- retry ei avalda uuesti vana sisu, kui praktika versioon on vahepeal muutunud;
- RAG-i õnnestumine ja kohaliku `ragSourceId`/metadata sidumine lõpevad versioonikindla tehinguga;
- vastuse kadumine pärast RAG õnnestumist kasutab deterministlikku ID-d või reconcile-kontrolli;
- timeout, maksimaalne katsete arv, `nextAttemptAt`, `lastErrorCode` ja auditijälg on püsivad;
- logidesse ei lähe praktikatekst;
- admin näeb pending/failed seisu ilma privaatset sisu nägemata;
- kustutuse ja ingest'i tööd ei võistle: lahendamata vana RAG_DELETE blokeerib uue avaldamise nagu praegune leping nõuab.

Ära ehita üldist sõnumijärjekorra platvormi, kui kitsas püsiv praktikate RAG-töö täidab eesmärgi.

### 3.4 P1-B — tähtaja- ja ülesannete scheduler

Nõuded:

- leiab avaldatud praktikad, mille `nextReviewAt` on saabunud või läheneb;
- leiab aktiivsed review-assignment'id, mis on aegunud või jäänud lõpetamata;
- töötab väikeste partiidega ja stabiilse cursor'iga;
- sama scheduler'i tick ei loo duplikaatseid ülesandeid ega kirju;
- teavitus ei sisalda praktikakandidaadi privaatset teksti;
- ajavöönd ja kuupäevad arvutatakse serveris;
- scheduler'i job-route kasutab olemasolevat salajase job-värava mustrit;
- käsitsi käivitatav admini dry-run näitab ainult loendeid ja põhjuseid;
- tegelik apply-režiim on audititav.

### 3.5 P1-C — retsensendi määramise parandaja

Katkine assignment on vähemalt üks neist:

- `reviewerId` on `NULL` või kasutaja puudub;
- võimekus on tühistatud, aegunud või vale scope'iga;
- retsensent on praktika autor;
- assignment'i `contentVersion` ei vasta aktiivsele ülevaatusversioonile;
- kõrge riski praktikal ei ole nõutud erinevaid sõltumatuid retsensente;
- lõpetatud assignment ripub aktiivse tööna või aktiivsel assignment'il on vastuoluline completed-at/staatus.

Nõuded:

- read-only audit ja apply on eraldi;
- repair ei määra autorit iseenda retsensendiks;
- valik on deterministlik ja selgitatav;
- kui sobivat retsensenti pole, jääb nähtav `unassigned`/attention seis, mitte vaikne vale määrang;
- vana assignment'i ajalugu ei kustutata;
- paralleelne päris retsensendi tegevus võidab või annab repair'ile kontrollitud konflikti;
- kõik parandused saavad auditikirje.

### 3.6 P1-D — ülevaatuse põhjenduse muutmatu ajalugu

Praegune `EffectivePracticeApplication.reviewNote` või muu live-väli ei ole piisav muutmatu otsuseajalugu.

Nõuded:

- iga otsus või põhjenduse muutus loob append-only sündmuse/versiooni;
- kirje sisaldab objekti, versiooni, otsuse tüüpi, põhjendust, tegijat või kustutatud tegija nullable viidet ja serveriaega;
- vana sündmust ei uuendata ega kustutata tavapärase töövoo kaudu;
- autor näeb ainult talle mõeldud tagasisidet;
- retsensendi privaatne põhjendus ei leki autorile ega avalikku serializer'isse;
- konto kustutamine nullib vajadusel identiteedi, kuid säilitab otsuse auditi;
- maksimaalne pikkus ja kontrollitud tekstiväljad on valideeritud.

Eelista olemasoleva `EffectivePracticeAuditEvent` mudeli turvalist laiendamist, kui see suudab lepingu päriselt kanda. Ära loo duplikaattabelit ilma kaardistatud põhjuseta.

### 3.7 P1-E — deploy-eelne RAG drain/verify värav

Loo read-only vaikerežiimiga kontroll, mis ebaõnnestub vähemalt siis, kui:

- praktikate RAG ingest/delete töö on pending või failed üle lubatud piiri;
- avaldatud praktika ja `ragSourceId`/versioon ei klapi;
- vana RAG_DELETE blokeerib avaldamist;
- aktiivne ülevaatus vajab repair'i;
- migratsiooniahel või Prisma skeem ei klapi;
- assignment-repair dry-run leiab parandamata kriitilise rea.

Värav peab:

- andma masinloetava kokkuvõtte ja protsessi mitte-null exit-koodi;
- mitte muutma andmebaasi;
- mitte väljastama praktikateksti, kasutaja e-posti ega muid privaatvälju;
- olema lisatav olemasolevasse quality/deploy kontrollpaketti;
- dokumenteerima, millal operaator võib erandi anda ja mida erand ei tohi vahele jätta.

### 3.8 P1 kohustuslikud testid

Vähemalt:

1. ingest retry õnnestub ja link seotakse üks kord;
2. sama retry topeltkäivitus ei dubleeri;
3. stale versiooni retry ei avalda vana sisu;
4. RAG õnnestus, DB link ebaõnnestus → reconcile taastab või jääb aus failed;
5. scheduler kordub ilma topeltülesande/-kirjata;
6. scheduler ei leki teksti;
7. null/kustunud/aegunud võimekusega retsensent parandatakse või märgitakse unassigned;
8. autorit ei määrata iseenda retsensendiks;
9. repair ja päris review mõlemas järjestuses on deterministlikud;
10. põhjenduse teine otsus ei kirjuta esimest üle;
11. serializer ei väljasta private note'i;
12. deploy-värav on roheline puhta seisu ja punane iga kriitilise jäägi korral.

### 3.9 P1 üleandmisvärav

Pärast teostust:

- uuenda selle faili progressi;
- käivita sihttestid ja kogu kontrollipakett;
- ära commit'i ega push'i enne Soli sõltumatut review'd;
- väljund: `P1 OPUS VALMIS — ootab Soli järelkontrolli`.

## 4. P2 — U4 teenuseosutaja kättesaadavuse värskus

### 4.1 Eesmärk ja rollid

- **Teenuseosutaja:** kinnitab oma teenuse tegeliku saadavuse.
- **Pöörduja:** näeb enne pöördumist, kas teenus võtab vastu.
- **Spetsialist:** ei suuna aegunud või teadmata saadavuse peale pimesi.
- **Admin:** näeb aegunud kinnitusi, kuid ei muuda teenuseosutaja nimel sisu vaikides.

### 4.2 Kohustuslik kaardistus

Loe vähemalt:

- `prisma/schema.prisma` mudelid `ServiceProviderProfile`, `ServiceProviderService` ja `ServiceMapEntry`;
- `lib/serviceProviderProfiles.js`;
- `components/workspace/WorkspaceFeaturePage.jsx` teenuse redaktor;
- Teenusekaardi serializer, kaardivaade ja `ServiceMapLeaflet`;
- eelpöördumise adressaadi valik ja saatmiseelne eelvaade;
- teenuseosutaja e-posti saatmise olemasolevad mustrid;
- admini KOV allikavärskuse monitor ainult korduvkasutatava mustrina;
- teenuseosutaja-, teenusekaardi-, RAG- ja eelpöördumise testid.

### 4.3 Lukustatud andmeleping

Väikseim versioon:

- `availabilityStatus` jääb rakenduskihi whitelistiks, mitte uueks PG enum'iks;
- kanoonilised väärtused:
  - `accepting` — võtab uusi pöördumisi vastu;
  - `waitlist` — ooteaeg;
  - `not_accepting` — praegu ei võta;
  - `unknown`/`NULL` — kinnitamata;
- lisa `availabilityCheckedAt DateTime?`;
- ooteaja kirjeldus jääb piiratud tekstiks või lisatakse väike struktureeritud hinnang ainult siis, kui kaardistus seda õigustab;
- teenuseosutaja üheklõpsu „info kehtib” toiming uuendab serveriaega ja nõuab värsket versioonisõrmejälge;
- aegumus on serveri arvutatud esitusolek, mitte andmebaasi eraldi tõeväärtus;
- kinnitusintervall on keskne konfigureeritav konstant, mitte komponentides dubleeritud number.

Olemasolevad vabad `availabilityStatus` väärtused vajavad migratsiooni-eelset read-only auditit ja kontrollitud normaliseerimisplaani. Ära muuda tundmatuid tootmisväärtusi vaikides.

### 4.4 Avalik ja kasutaja UI

Teenusekaardil ja eelpöördumise valikus kuva:

- olek tekstina ja ikooniga, mitte ainult värviga;
- vajadusel ooteaja kirjeldus;
- „kinnitatud X päeva/nädalat tagasi”;
- aegunud/teadmata info aus hoiatus;
- `not_accepting` ei peida teenust vaikimisi, vaid hoiatab enne pöördumist;
- otsest pöördumist ei blokeerita ilma eraldi tooteotsuseta.

Teenuseosutaja halduses:

- staatuse muutmine;
- üheklõpsu „Kinnitan, et info kehtib”;
- kinnitamise aeg;
- stale-konflikti korral 409 ja värske seisu laadimine;
- topeltklõps idempotentne.

### 4.5 Meeldetuletus ja admin

- perioodiline töö leiab aeguvad/aegunud kirjed;
- kiri ei sisalda pöördumisi ega kliendiandmeid;
- sama intervalli kohta ei saadeta duplikaatkirja;
- e-kirja link avab ainult autenditud teenuseosutaja enda halduse;
- adminivaade näitab teenust, omanikku/profiili, viimast kinnitust ja aegumispõhjust;
- admini nimekirjast ei saa teenuseosutaja nimel vaikides kinnitada;
- puuduv e-posti transport jätab auditeeritava `not_sent` tulemuse, mitte vale edu.

### 4.6 RAG ja serializer

- avalik serializer ja Teenusekaart kasutavad sama kanoonilist olekut;
- RAG-i teenusemeta saab oleku, kinnitamise aja ja stale-signaali;
- aegunud infot ei esitata mudelile värske faktina;
- allika uuendamine on versioonitud ning ei kopeeri eelpöördumise sisu.

### 4.7 U4 testid

Vähemalt:

1. owner uuendab/kinnitab; võõras ei saa;
2. stale fingerprint → 409 ja null kirjutust;
3. kanoonilised väärtused valideeritakse;
4. legacy/tundmatu väärtus ei kao vaikides;
5. kaart kuvab oleku + vanuse + tekstilise stale-hoiatuse;
6. eelpöördumine hoiatab `not_accepting` ja stale korral;
7. reminder on idempotentne ega sisalda kliendiinfot;
8. admin näeb stale-loendit, kuid ei saa owner-kinnitust võltsida;
9. RAG metadata märgib aegunud info aegunuks;
10. ET/EN/RU pariteet ja ligipääsetavus.

### 4.8 U4 üleandmisvärav

- P1 peab olema Soli poolt heaks kiidetud ja commit'itud enne U4 diffi alustamist;
- pärast U4 teostust uus Soli sõltumatu review;
- enne review'd ei commit'i/push'i;
- väljund: `U4 OPUS VALMIS — ootab Soli järelkontrolli`.

## 5. P3 — U8-lite allikate usalduskiht

### 5.1 Eesmärk

Kasutaja peab nägema:

1. millal vastuse allikas viimati kontrolliti;
2. kuidas teatada allika või vastuse veast;
3. milline tekst on AI mustand ja milline inimene on kinnitanud.

See on usalduskiht, mitte uus teadmushaldus- ega ticketing-platvorm.

### 5.2 Kohustuslik kaardistus

Loe vähemalt:

- `components/chat/hooks/useConversationSources.js`;
- `components/chat/utils/sources.js`;
- `components/alalehed/chat/ChatSourcesPanel.jsx` ja `ChatMessageItem.jsx`;
- `lib/rag/sourceMetadata.js`, `sourceFreshness.js`, `sourceAttribution.js`;
- chat API `displayed_sources` koostamine ja serialiseerimine;
- olemasolevad `checkedAt`, `last_checked`, validity/status metadata väljad;
- admini source-monitor ja source-package review vood;
- `generatedDraft`, `userEditedDraft`, `userConfirmed` kasutavad tööobjektid;
- allika-, attribuutika-, privaatsus- ja i18n-testid.

### 5.3 Allika kontrollimise kuupäev

- loo üks keskne normaliseerija olemasolevatele `checkedAt`/`last_checked`/validity väljadele;
- API tagastab ainult normaliseeritud, usaldusväärse kuupäeva ja freshness-seisundi;
- kuupäeva puudumisel kuva „kontrollimise aeg teadmata”, mitte tänane kuupäev;
- ajalooline/inaktiivne allikas saab selge hoiatuse;
- kasutaja locale määrab kuupäeva esituse, mitte serverisse salvestatud sisu;
- värskus ei tohi muuta nõrka allikat automaatselt tugevaks ega vastupidi — see täiendab olemasolevat attribuutikat.

### 5.4 „Teata veast”

Väikseim kasulik voog:

- toiming elab konkreetse kuvatud allika juures;
- server saab stabiilse allika identiteedi, vea kategooria ja valikulise lühikese märkuse;
- klient ei tohi saata kogu vestlust, prompti ega privaatset dokumenti;
- server ei usalda kliendi allikapealkirja kui identiteeti;
- rate-limit ja duplikaadikaitse;
- kasutaja näeb ausat saadetud/ebaõnnestunud olekut;
- admin saab avatud teated läbi vaadata ja sulgeda;
- reporter näeb ainult enda teadet, admin kõiki;
- võõras teate ID ei leki;
- allika parandamine ei muuda automaatselt varasemaid vastuseid ega peida ajalugu.

Kui minimaalne püsiv `SourceFeedback`-laadne mudel on vajalik, hoia see kitsas: reporter, stabiilne source ID/type, kategooria, märkus, olek, ajad ja admini lahendus. Ära salvesta vastuse täisteksti.

### 5.5 AI mustandi eristus

- loo taaskasutatav visuaalne ja semantiline olek vähemalt objektidele, millel on päriselt `generatedDraft`/`userEditedDraft`/`userConfirmed` leping;
- staatused on sisuliselt `AI mustand`, `inimese muudetud`, `inimese kinnitatud`;
- AI ise ei tohi muuta objekti kinnitatuks ega jagatuks;
- ekraanil peab olema tekstiline silt, mitte ainult värv/raam;
- ekraanilugeja saab staatuse;
- kinnituse tühistav sisumuutus viib oleku tagasi mustandiks;
- ära väida inimese kinnitust kohtades, kus andmemudelis vastavat fakti pole.

### 5.6 U8-lite testid

Vähemalt:

1. kuupäev normaliseerub kõigist toetatud metadata alias'test;
2. puuduv kuupäev jääb teadmata;
3. ajalooline/inaktiivne allikas saab hoiatuse;
4. report endpoint ei võta vastu vestluse täisteksti ega võltsitud välju;
5. rate-limit ja duplikaat;
6. owner/admin/no-leak õigused;
7. admini resolve on auditeeritav;
8. AI mustand ei esine kinnitatud tekstina;
9. sisumuutus tühistab kinnituse;
10. ET/EN/RU ja ligipääsetavus;
11. olemasolev `displayed_sources` attribuutika ei regressi.

### 5.7 U8-lite üleandmisvärav

- P1 ja U4 peavad olema eraldi Soli review läbinud ning commit'itud;
- U8-lite lõpus uus Soli sõltumatu review;
- enne review'd ei commit'i/push'i;
- väljund: `U8-LITE OPUS VALMIS — ootab Soli järelkontrolli`.

## 6. Kontrollipakett iga osa järel

Käivita vähemalt:

```text
sihttestid
npm test
npm run i18n:check
npm run lint
npx prisma validate
npx prisma generate
npm run db:migrate:check
npm run build
git diff --check
runtime-smoke muudetud marsruutidele
```

Kui lisandub cron/job route, testi eraldi:

- puuduv/vigane secret;
- dry-run;
- apply;
- topeltkäivitus;
- osaliselt ebaõnnestunud partii;
- timeout/retry;
- logide privaatsus.

Autenditud brauserikontroll:

- U4: teenuseosutaja haldus + avalik kaart + eelpöördumise hoiatus;
- U8: allikakaart, error-report, admini järjekord ja klaviatuur/fookus;
- kasuta ainult QA-andmeid ja eemalda need pärast kontrolli.

## 7. Commit, push ja deploy

- Audit on alati read-only.
- Iga teostuspakett antakse esmalt commit'imata Solile kontrollimiseks.
- Pärast Soli heakskiitu võib teha ainult selle paketi täpse commit'i ja push'i kasutaja kinnitatud töövoo järgi.
- Ära kasuta `git add .`.
- Deploy on kõigi kolme paketi puhul eraldi kasutajaotsus.

## 8. Tööpuu piirid

Ära lisa:

```text
public/room/frame-*.webp
output/imagegen/room-walk-v8-natural-2026-07-13/**
output/imagegen/room-walk-v9-locked-2026-07-13/**
scripts/build-room-locked-frames.mjs
```

Kui nende seis muutub, jäädvusta see, kuid ära taasta, kustuta, stage'i ega commit'i neid.

## 9. Progressipäevik

Opus uuendab seda osa pärast iga suuremat sammu.

### Algseis

- Etapp: ootab kahe auditi lõppotsust.
- Main lähte-HEAD: täita auditi järel.
- Tööpuu kõrvalised failid: kontrollida ja loetleda.
- Aktiivne pakett: puudub.
- Järgmine samm: auditite lõpetamine ning P0/P1 värava otsus.

### 2026-07-14 — OPUS — PAKETIVÄRAV: BLOKEERITUD (2 P1)

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Claude Opus 4.8, Extra (`xhigh`).
- Aktiivne pakett ja etapp: §1 kvaliteedivärav — **read-only audit lõpetatud**; uut koodi EI alustatud.
- Lähte-HEAD: `main` @ `3b52f399` (auditeeritud fikseeritud `7f20d7ce` ja `9a46192b`).
- Loetud/kontrollitud: vt auditidokid `06-opus-...jarelkontroll.md` (Audit A) ja `07-opus-...jarelkontroll.md` (Audit B) — täielikud, 6 sõltumatut adversaalset lugejat + Opuse objektiivsed kontrollid + migratsioonide struktuurne audit + 401 runtime-smoke.
- Tehtud muudatused: ainult kaks auditi-väljunddokki + see progressikirje. **Koodi EI muudetud.**
- Käivitatud kontrollid ja täpsed tulemused: `npm test` 1070/1070; `i18n:check` OK; `lint` 0 viga / 359 hoiatust; `prisma validate`/`generate` OK; `db:migrate:check` 87 migratsiooni, drift puudub; `build` OK; `git diff --check` puhas; runtime-smoke uued marsruudid → 401.
- Leitud riskid/P0/P1/P2: **P0 puudub.** 2 kitsast P1: **A-P1-1** (`lib/calls/service.js` `serializeCallSession` väljastab sisemised `userId`-d covision-kõne osalejatele) ja **B-P1-1** (`SupportRequestPanel.jsx` mustandi-salvestusel puudub request-gate → hiline vastus taastab oleku). Ülejäänu P2 (valikuline/edasilükatu; sh RAG-reconcile-lüngad, mis kattuvad selle paketi P1-A/P1-E-ga).
- Kõrvaliste failide seis: `public/room/frame-*.webp`, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs` — puutumata, stage'imata.
- Järgmine konkreetne samm: **Sol parandab mõlemad P1 + lisab regressioonitestid + teeb täieliku kontrollipaketi.** Seejärel Opus teeb paranduste kordusauditi. **Operatsioonipakett (P1) algab alles pärast mõlema P1 sulgemist** (doc 01 §1).
- Commit/push/deploy seis: TEGEMATA (kasutaja otsus: peatu).

### 2026-07-14 — OPUS — PAKETIVÄRAV: AVATUD (mõlemad P1 suletud)

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Claude Opus 4.8, Extra (`xhigh`).
- Aktiivne pakett ja etapp: §1 kvaliteedivärav — **kordusaudit läbitud**; algab P1 Parimate praktikate operatsioonipakett.
- Lähte-HEAD: `main` @ `d6c2c695` (`Fix audited Covision privacy and wellbeing races`).
- Loetud/kontrollitud: Sol'i parandus-commit `d6c2c695` diff (`lib/calls/service.js`, `SupportRequestPanel.jsx`) + uued testid; auditidokkide 06/07 „Soli paranduse üleandmine" osad; choke-point-analüüs (kõik covision-kõne vastused läbi `serializeCallSession`-i).
- Tehtud muudatused: ainult kordusauditi tulemus dokkidesse (06 §10, 07 §9, see kirje). **Koodi EI muudetud.**
- Käivitatud kontrollid ja täpsed tulemused: sihttestid (calls/service + covisionCallContracts + wellbeing/covisionHandoffContracts) 35/35; `npm test` **1074/1074**; ESLint muudetud koodifailidel 0/0; `i18n:check` OK; `npm run build` OK; `git diff --check` puhas.
- Leitud riskid/P0/P1/P2: **mõlemad P1 SULETUD** (A-P1-1 covision-kõne serializer; B-P1-1/B-P2-1 SupportRequestPanel request-gate) — sõltumatult koodist + testidest verifitseeritud. **P0/P1 blokeerijaid ei ole.** Allesjäänud leiud P2 (valikuline/edasilükatu; sh RAG-reconcile A-P2-9/-10, mis on selle paketi P1-A/P1-E sisu).
- Kõrvaliste failide seis: `public/room/frame-*.webp`, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs` — puutumata, stage'imata.
- Järgmine konkreetne samm: commit'i + push'i AINULT auditi/progressi dokid; seejärel alusta P1 operatsioonipaketti Etapp 0 kaardistusega (doc 01 §3.2).
- Commit/push/deploy seis: dokid commit'itakse+push'itakse; kood/deploy TEGEMATA.

### 2026-07-14 — SOL — 2 P1 PARANDATUD, OOTAB OPUSE KORDUSAUDITIT

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Sol 5.6, väga kõrge.
- Aktiivne pakett ja etapp: §1 kvaliteedivärava parandusring; uut operatsioonipaketi arendust ei alustatud.
- Lähte-HEAD: `main` @ `11381100` (paralleelne dokumentatsiooni-commit oli enne parandust juba HEAD-is).
- Loetud/kontrollitud: Opuse Audit A ja Audit B täielikud P1 kirjeldused; kõneserializer, Kovisiooni kõne API teed, tavaruumi kõneklient, `SupportRequestPanel`, jagatud `latestRequestGate` muster ja olemasolevad testid.
- Tehtud muudatused: A-P1-1 sulgemine kontekstipõhise opaakse kõneosaleja-ID lepinguga + e-posti fallbacki eemaldus; B-P1-1/B-P2-1 sulgemine request-generatsiooni värava, abortimise, aegunud vastuse kontrolli ja sisendite külmutamisega; regressioonitestid mõlemale.
- Käivitatud kontrollid ja täpsed tulemused: sihttestid 35/35; `npm test` 1074/1074; `i18n:check` OK; muudetud failide ESLint 0 viga/0 hoiatust; kogu lint 0 viga; build OK; `db:migrate:check` 87 migratsiooni, drift puudub; `git diff --check` kontrollitakse vahetult enne commit'i.
- Leitud riskid/P0/P1/P2: uusi P0/P1 leide ei tekkinud. A-P1-1, B-P1-1 ja sama juurega B-P2-1 on koodis parandatud; lõplik staatus jääb Opuse kordusauditi otsustada.
- Kõrvaliste failide seis: `public/room/frame-*.webp`, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs` — puutumata ja jäävad commit'ist välja.
- Järgmine konkreetne samm: täpne commit + push; seejärel Opus auditeerib paranduste commit'i. Operatsioonipakett püsib kuni heakskiiduni ootel.
- Commit/push/deploy seis: commit/push tehakse pärast lõpp-diffi; deploy'd ei tehta.

### Kohustuslik sissekandevorm

```text
Kuupäev/kell:
Mudel/effort:
Aktiivne pakett ja etapp:
Lähte-HEAD:
Loetud/kontrollitud:
Tehtud muudatused:
Käivitatud kontrollid ja täpsed tulemused:
Leitud riskid/P0/P1/P2:
Kõrvaliste failide seis:
Järgmine konkreetne samm:
Commit/push/deploy seis:
```
