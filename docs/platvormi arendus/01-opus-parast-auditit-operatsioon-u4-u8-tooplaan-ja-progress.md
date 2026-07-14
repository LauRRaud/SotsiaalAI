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

### 2026-07-14 — OPUS — P1 Etapp 0 kaardistus (read-only, enne koodi)

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Claude Opus 4.8, Extra (`xhigh`).
- Aktiivne pakett ja etapp: **P1 Parimad praktikad — Etapp 0 kaardistus valmis; koodi EI muudetud.**
- Lähte-HEAD: `main` @ (jooksev; auditijärgne).
- Loetud/kontrollitud (§3.2): `lib/effectivePractices.js`, `lib/covisionKnowledge.js`, `lib/privacy/deletionJobRetryService.js`, `lib/privacy/deletionJobs.js`, `scripts/drain-effective-practice-rag-deletions.mjs`, `scripts/repair-effective-practice-assignments.mjs`, `app/api/jobs/subscription-renewals/route.js`, skeem `EffectivePractice*`/`PracticeCapability*`/`DataDeletionJob`, migratsioonid 170000/171000, `tests/effectivePractices/**`.

**6 nõutud kaardistuspunkti:**
1. **RAG publish/delete olekud:** publish = kahefaasiline guard-kaitstud. `publishCandidate` kirjutab muutmatu `EffectivePracticeVersion`, seab `PUBLISHED` + `ragSourceId=null` + `ragMetadata.syncStatus="pending"`, loob püsiva **guard-rea** (`DataDeletionJob action=RAG_DELETE, externalRef=deterministicRagDocumentId(publicId,version), status="guard"`). Tehingu VÄLJASPOOL: `actionCandidate` teeb ingesti (`syncPublishedSnapshot` → `POST /ingest/text`), kontrollib docId, siis **teises tehingus** versioonikindla lingi (`updateMany WHERE status=PUBLISHED, publishedVersion → ragSourceId=docId`, `count!==1`→`PUBLISH_LINK_STALE`) + märgib guardi `done`. Vastuse-kao kompensatsioon kustutab võimaliku orvu (`publish_response_unknown`). Delete = `RAG_DELETE` DataDeletionJob (`re_review`/accepted-risk), `processRagDeletion` (`removePublishedSnapshot` → 404-idempotentne), `done` + `ragSourceId=null` ühes tehingus.
2. **Retry-olek:** **ainus kandja on `DataDeletionJob`** (`attempts`, `lastError`, `status`-string). **PUUDU:** `nextAttemptAt`, `lastErrorCode`, max-attempts; **ingest-retry objekti EI OLE — ainult DELETE.** Poolik ingest jätab jälje ainult `ragMetadata.syncStatus ∈ {pending,failed}` + guard-rida (kustutuskäepide, mitte re-ingest-käsk).
3. **Job-autentimine:** ainus job-route `app/api/jobs/subscription-renewals/route.js` — env `*_JOB_KEY`, mitme-headeri (`x-*-key`/`x-cron-key`/`x-api-key`) **timingSafeEqual** värav, `?dryRun`, `take=batch`, `orderBy` aja-cursor, feature-flag → 503. **P1-B kloonib selle mustri.**
4. **Katkine assignment:** `repairAssignments` (`:1690`, admin, **apply-only, dry-run puudub**). Tuvastab: reviewerId-null, revoked/expired/wrong-scope võimekus, kõrge-riski 2-retsensenti. **EI tuvasta (lüngad):** autor-on-retsensent, `contentVersion`-mismatch, dangling-completed. `PracticeCapability`: `revokedAt/validFrom/validUntil/scope`; `EffectivePracticeReviewAssignment`: `contentVersion/status/completedAt`.
5. **Ülekirjutatav põhjendus:** `EffectivePracticeApplication.reviewNote` — **ülekirjutatakse** (`updateMany`, RESUBMIT null-ib). `EffectivePracticeReview` = DB-append aga latest-wins per reviewer. **`EffectivePracticeAuditEvent` on olemasolev append-only mudel** (`recordAudit` = alati `.create`, `actorId onDelete SetNull`, `contentVersion`, `createdAt`) — salvestab praegu ainult staatuse-üleminekud + metadata, MITTE vaba-teksti põhjendust. **P1-D laiendab seda, mitte uut tabelit.**
6. **Deploy-eelsed read-only kontrollid:** `practices:rag:verify` (`--verify-only`) on ainus päris read-only — loeb `remaining` (pending/failed/stale-guard) + `staleReferences`, `exitCode=1` kui >0, DB-d ei muuda. `practices:rag:drain` (muteerib), `practices:repair-assignments` (muteerib, dry-run puudub). **Aggregaat-deploy-väravat pole** (P1-E ehitab verify peale).

**Teostuskohad (laienda, ära dubleeri):** P1-A → `DataDeletionJob`-i `INGEST` tee + `nextAttemptAt`/`lastErrorCode`/`maxAttempts`, laienda `processRagDeletion`/link-blokki + drain; re-ingest peab re-lugema jooksva snapshot'i (`publishedVersion` guard). P1-B → uus `app/api/jobs/…` route subscription-renewals mustril, allikad `EffectivePractice.nextReviewAt` + `EffectivePracticeReviewAssignment`. P1-C → laienda `repairAssignments` (dry-run + 3 puuduvat detektorit), `assignReplacementReviewerTx` + `recordAudit` taaskasuta. P1-D → laienda `EffectivePracticeAuditEvent` (põhjendus + author-visible-vs-private lipp), emiteeri `reviewCandidate`/`reviewApplication`-ist. P1-E → laienda `practices:rag:verify` (published↔ragSourceId/version mismatch, P1-C read-only audit, migrate status). **Gotcha:** `deterministicRagDocumentId` vs `buildEffectivePracticeRagDocId` (`covisionKnowledge.js:142`) lahknevad `::v0`-l — vali üks reconcile'iks; publish-blokk `status∈{guard,pending,failed}` säilita; logidesse ei lähe praktikatekst.

- Dok-vs-kood erinevused: puuduvad (spec + kood klapivad; olemasolevad mudelid katavad P1-A/D lepingut laiendamisega).
- Käivitatud kontrollid: read-only kaardistus (agent + Opus).
- Leitud riskid/P0/P1/P2: —
- Kõrvaliste failide seis: puutumata.
- Järgmine konkreetne samm: **Etapp 1 — skeem/migratsioon** (`DataDeletionJob` ingest-retry väljad + `EffectivePracticeAuditEvent` põhjendus-väljad), seejärel P1-A..E vertikaalidena; iga osa lõpus kontrollipakett, commit'imata Solile.
- Commit/push/deploy seis: kaardistus dokis; kood TEGEMATA.

### 2026-07-14 — OPUS — Etapp 1 VALMIS (skeem + migratsioon) + P1-A..E disain

- **Tehtud (kood, commit'imata):**
  - `prisma/schema.prisma`: `DataDeletionJob` + `nextAttemptAt DateTime?`, `lastErrorCode String?`, `maxAttempts Int?` + indeks `[action, status, nextAttemptAt]`; `EffectivePracticeAuditEvent` + `decisionType String?`, `justification String? @db.Text`, `justificationVisibility String?`.
  - Migratsioon `20260714230000_practice_ops_retry_and_justification` — **additiivne** (ainult nullable veerud + 1 indeks; enum'i ei muudeta, backfill'i pole).
- **Kontrollid:** `prisma validate` OK; `prisma generate` OK; `db:migrate:check` **88 migratsiooni** rakendus puhtalt (drift puudub).
- **P1-A disain (lukustatud):** ingest-tõrkel (`actionCandidate` catch, `effectivePractices.js:1284`) praegu kompenseerib-kustutab-loobub → **asenda: teisenda guard-rida RAG_INGEST retry-jobiks** (`action="RAG_INGEST"`, `status="pending"`, `nextAttemptAt=now+backoff`, `maxAttempts`, `lastErrorCode`, `attempts++`; practice `ragMetadata.syncStatus="ingest_retry_pending"`). Uus `processRagIngest(job)`: loe `EffectivePracticeVersion` (muutmatu avaldatud snapshot) versiooni järgi `storagePath`-ist; **versioonivalve** — ainult kui practice on ikka `PUBLISHED` sellel `publishedVersion`-il, siis re-ingest (deterministlik doc_id = upsert, dupli ei teki) → link (`ragSourceId`, guard→`done`); kui `publishedVersion` muutunud → job `done` (superseded, aegunud loobutakse); tõrkel `attempts++` + backoff; `attempts>=maxAttempts` → `status="failed"` (verify-värav pindab). Drain-skript (`scripts/drain-...mjs`) laieneb RAG_INGEST töödele. „Vana RAG_DELETE blokeerib publish" leping säilib (query on `action="RAG_DELETE"`).
- **P1-B..E disain:** P1-B uus `app/api/jobs/practice-reviews/route.js` (`subscription-renewals` mustril: `PRACTICE_REVIEW_JOB_KEY` + timingSafeEqual + `?dryRun` + batch/cursor), allikad `nextReviewAt` + aegunud `EffectivePracticeReviewAssignment`. P1-C laienda `repairAssignments` (dry-run param + `practices:repair-assignments:check` skript + 3 detektorit: autor-on-retsensent, `contentVersion`-mismatch, dangling-completed). P1-D emiteeri `justification` (+ visibility) `reviewCandidate`/`reviewApplication`-ist `EffectivePracticeAuditEvent`-i; serializer gate'ib reviewer-private teksti. P1-E laienda `practices:rag:verify` (published↔ragSourceId/version mismatch, P1-C read-only audit, `migrate status`) aggregaat-väravaks + `check` skripti.
- **Kõrvaliste failide seis:** puutumata, stage'imata.
- **Järgmine konkreetne samm:** P1-A teenusekiht (`queueRagIngestRetryTx` + `processRagIngest` + `actionCandidate` catch) + drain-laiendus + P1-A testid; seejärel P1-B..E.
- **Commit/push/deploy seis:** Etapp 1 kood commit'imata; TEGEMATA.

### 2026-07-14 — OPUS — P1-A VALMIS (RAG-ingest'i automaatne taastaja)

- **Tehtud (kood, commit'imata):**
  - `lib/effectivePractices.js`: module-helperid (`DEFAULT_MAX_RAG_INGEST_ATTEMPTS=8`, `ragIngestBackoffMs` capped-eksponentsiaalne, `parseReleaseVersionFromStoragePath`, `classifyRagIngestErrorCode`); teenusekihi `processRagIngest(job)` (versioonivalve: ainult `PUBLISHED` + sama `publishedVersion`; idempotentne `already_linked`; re-ingest MUUTMATUST `EffectivePracticeVersion` snapshot'ist deterministliku doc_id-ga = upsert; link + guard→done ühes tehingus; superseded → done; snapshot puudub/vigane job → fail-closed; backoff + `maxAttempts` → failed); `actionCandidate` catch teisendab guard-rea **RAG_INGEST retry-jobiks** (loobumise/kustutamise asemel); teenus + eksport `retryEffectivePracticeRagIngest`, `DEFAULT_MAX_RAG_INGEST_ATTEMPTS`.
  - `scripts/drain-effective-practice-rag-deletions.mjs`: RAG_DELETE pending/failed → deletion-retry; **RAG_INGEST due + crash-stale publish-guardid → `processRagIngest`** (re-ingest); `remaining` count kaasab nüüd ingest'i (verify-värav ausam).
  - Testid: `tests/effectivePractices/ragIngestRetry.test.js` (9 juhtu: ingest, idempotentne, superseded, transient-retry, exhausted→failed, doc-id-mismatch, rag_key_missing skip, snapshot-missing fail-closed, malformed); uuendatud 2 olemasolevat teenusetesti (vana kompensatsioon-kustuta → ingest_retry_pending).
- **Otsused:** guard-rida taaskasutatakse retry-kandjaks (deterministlik doc_id = upsert → orb kirjutatakse üle, ei dubleeru); „vana RAG_DELETE blokeerib publish" leping säilib; logidesse ei lähe praktikatekst (ainult `lastErrorCode`). Notification-**edastuse** kanal (email/in-app) on teadlik follow-up — P1-B teeb idempotentse markeri, mitte uut teavituskanalit.
- **Kontrollid:** ragIngestRetry 9/9; effectivePractices service+contract 30/30; `npm test` **1083/1083**; ESLint (muudetud) 0 viga/0 hoiatust; `db:migrate:check` 88 migratsiooni; `npm run build` OK.
- **Kõrvaliste failide seis:** puutumata.
- **Järgmine konkreetne samm:** P1-B review-tähtaja/ülesannete scheduler (`app/api/jobs/practice-reviews/route.js` + service tick + testid).
- **Commit/push/deploy seis:** kood commit'imata; TEGEMATA.

### 2026-07-14 — OPUS — P1-B VALMIS (review-tähtaja/ülesannete scheduler)

- **Tehtud (kood, commit'imata):** `lib/effectivePractices.js` teenus `runPracticeReviewSchedulerTick({now, batchSize, dryRun, overdueDays, dueWithinDays})` — leiab PUBLISHED praktikad `nextReviewAt <= now(+dueWithinDays)` (marker `REVIEW_DUE`, idempotentne guard `createdAt >= publishedAt` = üks per avaldamistsükkel) + aegunud ASSIGNED assignment'id (`completedAt=null`, `assignedAt <= now-overdueDays`, grupeeritud practice+contentVersion, marker `ASSIGNMENT_OVERDUE`, idempotentne per tsükkel); durable marker on append-only `EffectivePracticeAuditEvent` **ilma kandidaaditekstita** (ainult id-d/versioonid/loendurid); server-aeg, batch (≤500). Uus route `app/api/jobs/practice-reviews/route.js` (`PRACTICE_REVIEW_JOB_KEY` + timingSafeEqual multi-header + `?dryRun`/`overdueDays`/`dueWithinDays` + no-store; 401/500 allowlist). Eksport `runEffectivePracticeReviewScheduler`.
- **Otsused:** notification-**edastuse** kanal (email/in-app) on teadlik follow-up — scheduler teeb idempotentse auditeeritava markeri (mitte uut teavituskanalit; väldib tooteotsust „kellele/kuidas teavitada").
- **Kontrollid:** reviewScheduler 6/6; `npm test` **1089/1089**; ESLint (muudetud) 0 viga; `npm run build` OK (`/api/jobs/practice-reviews` registreeritud).
- **Järgmine konkreetne samm:** P1-C retsensendi-määramise parandaja (`repairAssignments` dry-run + 3 detektorit + `:check` skript).
- **Commit/push/deploy seis:** kood commit'imata; TEGEMATA.

### 2026-07-14 — OPUS — P1-C VALMIS (retsensendi-määramise parandaja)

- **Tehtud (kood, commit'imata):** `lib/effectivePractices.js` `repairAssignments(actor, {dryRun})` — read-only audit vs apply eraldi; 3 uut detektorit lisatud olemasolevatele (võimekus-kehtetus/scope): **autor-on-retsensent** (`reviewerId === practice.authorId`), **stale contentVersion** (aegunud review-tsükkel → DECLINED), **contradictory ASSIGNED+completedAt** (→ COMPLETED normaliseeritud); tagastab `{dryRun, candidateRepairs, applicationRepairs, unresolved, findings[]}`; sobiva retsensendi puudumisel jääb rida nähtavalt `DECLINED`/unassigned (attention), mitte vaikne vale määrang; optimistlikud `updateMany`-guardid (paralleelne päris-review võidab). `scripts/repair-effective-practice-assignments.mjs` `--check` (dry-run) + exit≠0 leidudel; `package.json` `practices:repair-assignments:check`.
- **Kontrollid:** assignmentRepair 7/7; `npm test` **1096/1096**; ESLint (muudetud) 0 viga; `npm run build` OK.
- **Järgmine konkreetne samm:** P1-D muutmatu põhjenduse-ajalugu (`EffectivePracticeAuditEvent` emissioon `reviewCandidate`/`reviewApplication`-ist + gate'itud serializer).
- **Commit/push/deploy seis:** kood commit'imata; TEGEMATA.

### 2026-07-14 — OPUS — P1-D VALMIS (muutmatu põhjenduse-ajalugu)

- **Tehtud (kood, commit'imata):** `lib/effectivePractices.js` — `recordJustification(tx, practice, actorId, {decisionType, justification, visibility})` helper (append-only `EffectivePracticeAuditEvent action=REVIEW_JUSTIFICATION`, `decisionType`/`justification`/`justificationVisibility`, actor nullable); emissioon `reviewCandidate`-ist (authorFeedback → visibility `author`, privateNotes → `private`) ja `reviewApplication`-ist (reviewNote → `author`, asendab ülekirjutatava `Application.reviewNote` sõltuvuse); teenusemeetod `getJustificationHistory(actor, publicId)` gate'iga (autor näeb ainult autori-nähtavat; retsensent näeb enda autori+privaat kirjeid; teise retsensendi privaat EI leki; võõras → no-leak 404; avalik serializer ei kanna seda); eksport `getEffectivePracticeJustificationHistory`.
- **Kontrollid:** justificationHistory 5/5; `npm test` **1101/1101**; ESLint (muudetud) 0 viga; `npm run build` OK.
- **Järgmine konkreetne samm:** P1-E deploy-eelne aggregaat RAG drain/verify värav.
- **Commit/push/deploy seis:** kood commit'imata; TEGEMATA.

### 2026-07-14 — OPUS — P1-E VALMIS + `P1 OPUS VALMIS — ootab Soli järelkontrolli`

- **Tehtud (kood, commit'imata):** `lib/practiceDeployGate.js` `buildPracticeDeployGateReport({db, service, now, maxRagResidue})` — read-only aggregaat: RAG-delete-residüü (pending/failed + stale-guard >10min), RAG-ingest-residüü (pending/failed), stale-viited (mitte-PUBLISHED + ragSourceId), published↔`deterministicRagDocumentId`-versiooni-mismatch, assignment-repair dry-run findings; `publishedUnlinked` informatiivne (RAG-disabled env ei kuku); tagastab `{ok, failures[], checks{}}` ainult loenduritega (ei teksti/e-posti/PII); `deterministicRagDocumentId` eksporditud. `scripts/practice-deploy-gate.mjs` (õhuke wrapper + `prisma migrate status` drift-kontroll + operaatori-erandi reegel: erand ainult teadaoleva transiidi-RAG-backlogile, MITTE stale/mismatch/repair-integ­riteedile) + `package.json` `practices:deploy-gate`. (Eraldiseisev, ei muuda lint-only `check`-i; kuulub deploy-järjestusse doc 05 §11.)
- **Kontrollid:** deployGate 9/9.
- **P1 paketi lõppkontroll:** `npm test` **1110/1110**; `i18n:check` OK; `npm run lint` **0 viga** (359 varasemat hoiatust); `prisma validate`/`generate` OK; `db:migrate:check` **88 migratsiooni** (uus `20260714230000` puhtalt); `npm run build` OK (`/api/jobs/practice-reviews` registreeritud); `git diff --check` puhas (ainult LF/CRLF).

## P1 PAKETI ÜLEANDMINE — `P1 OPUS VALMIS`

**Alampaketid (kõik commit'imata, Solile):**
- **Etapp 1** — skeem/migratsioon `20260714230000_practice_ops_retry_and_justification` (`DataDeletionJob`: `nextAttemptAt`/`lastErrorCode`/`maxAttempts` + indeks; `EffectivePracticeAuditEvent`: `decisionType`/`justification`/`justificationVisibility`); additiivne, backfill puudub.
- **P1-A** — RAG-ingest'i automaatne taastaja (`processRagIngest` versioonivalve + muutmatu snapshot re-ingest + backoff; guard→RAG_INGEST teisendus; drain-laiendus). 11 testi (9 uut + 2 uuendatud).
- **P1-B** — review-tähtaja/ülesannete scheduler (idempotentne marker `EffectivePracticeAuditEvent`; job-route `PRACTICE_REVIEW_JOB_KEY`). 6 testi.
- **P1-C** — retsensendi-määramise parandaja (dry-run + 3 detektorit; `:check` skript). 7 testi.
- **P1-D** — muutmatu põhjenduse-ajalugu (gate'itud `getJustificationHistory`). 5 testi.
- **P1-E** — deploy-eelne aggregaat-värav (`practices:deploy-gate`). 9 testi.

**Muudetud/uued failid:** `prisma/schema.prisma`, `prisma/migrations/20260714230000_.../migration.sql` (uus), `lib/effectivePractices.js`, `lib/practiceDeployGate.js` (uus), `scripts/drain-effective-practice-rag-deletions.mjs`, `scripts/repair-effective-practice-assignments.mjs`, `scripts/practice-deploy-gate.mjs` (uus), `app/api/jobs/practice-reviews/route.js` (uus), `package.json`, `tests/effectivePractices/{ragIngestRetry,reviewScheduler,assignmentRepair,justificationHistory,deployGate}.test.js` (uued) + 2 uuendatud teenusetesti.

**Teadlik follow-up (mitte tooteotsuse-blokeerija):** notification-**edastuse** kanal (email/in-app) — scheduler ja audit-markerid on olemas; kanal on eraldi UI/tooteotsus.

- **Järgmine samm:** **Soli sõltumatu järelkontroll (P1).** doc 01 §4.8: U4 (P2) algab alles pärast P1 Soli heakskiitu + commit'i. Enne Soli review'd EI commit'i/push'i/deploy'i.
- **Kõrvaliste failide seis:** puutumata, stage'imata.
- **Commit/push/deploy seis:** kogu P1 commit'imata; TEGEMATA.

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

### 2026-07-14 — SOL — P1 JÄRELKONTROLL: PARANDUSED VAJALIKUD

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Sol 5.6, väga kõrge.
- Aktiivne pakett ja etapp: P1 Parimate praktikate operatsioonipaketi sõltumatu commit-eelne järelkontroll.
- Lähte-HEAD: `main` @ `df2f45c0`; kogu P1 diff commit'imata.
- Loetud/kontrollitud: skeem ja migratsioon; P1-A ingest/retry/drain; P1-B scheduler ja job-route; P1-C repair; P1-D audit ledger ja serializer; P1-E deploy-gate; kõik uued testid ja seotud olemasolev teenusekood.
- Käivitatud kontrollid: P1 sihttestid **55/55** rohelised; `git diff --check` puhas. Rohelised testid ei kata allolevaid võistlus-/partii-/skoobiteid.
- **P0 puudub. P1 paketti ei tohi veel commit'ida.** Sulgeda tuleb viis leidu:

1. **SOL-P1-1 — superseded RAG-ingest märgitakse `done`, kuigi deterministlik orbdokument võib RAG-i jääda** (`lib/effectivePractices.js:839–846`). Ingest võib serveris õnnestuda ja vastus/link kaduda; kui praktika läheb enne retry'd `RE_REVIEW`-sse või uuele versioonile, praegune haru ei tee vana `expectedDocId` kustutust ja deploy-gate ei näe seda enam. Superseded töö peab minema idempotentsesse `RAG_DELETE` cleanup-teesse (või kustutama sama doc-id enne `done`), ilma vana sisu uuesti ingest'imata. Lisa regressioon: ingest-õnnestus/link nurjus → re-review/new version → retry eemaldab vana doc-id ning töö ei kao roheliseks enne cleanup'i.
2. **SOL-P1-2 — scheduler pole üle partii resumable ega paralleelselt idempotentne** (`effectivePractices.js:931–995`). Iga tick loeb alati esimese `take=size` rea; juba markeriga esimesed read jäävad järgmistes tick'ides ette ja hilisemad read nälgivad. `findFirst → create` pole DB-unikkaalsuse/advisory-lock'iga kaitstud, seega kaks samaaegset tick'i võivad teha topeltmarkeri. Assignment-partii võib lisaks ühe tsükli pooleks lõigata ja jäädvustada vale lõpliku loenduri. Lisa stabiilne cursor/skannimine + DB-tasemel või jagatud lukuga idempotentsus ning testid `>batchSize` ja kahe juhitud paralleelkäivituse kohta.
3. **SOL-P1-3 — repair võib päris review võidu järel ikkagi uue retsensendi määrata ja enamik repair'e ei saa auditikirjet** (`effectivePractices.js:1943–2076`). Invalid-assignmenti `updateMany` tulemust ei kontrollita enne `assignReplacementReviewerTx`-i: kui reviewer lõpetab rea vahepeal, `count=0`, kuid repair loob siiski uue `ASSIGNED` rea. Kontrolli CAS-i tulemust ja määra asendaja ainult `count===1` korral; lisa mõlemad ordering-testid. Lisa auditikirje igale päriselt rakendatud assignment/application parandusele. Kõrge riski kontroll peab lugema ainult `reviewedVersion === practice.contentVersion` otsuseid, mitte vanade tsüklite approvals'e.
4. **SOL-P1-4 — põhjendusajaloo reviewer-värav ignoreerib scope'i** (`effectivePractices.js:2086–2101`). Suvaline aktiivse REVIEWER/EDITOR/ETHICS/APPROVER võimekusega kasutaja saab mis tahes praktika `publicId` järgi selle author-facing põhjendused, ka siis, kui võimekuse scope sellele praktikale ei sobi. Rakenda vähemalt `scopeMatchesPractice` (ja säilita own-event ligipääs); lisa vale-scope regressioonitest.
5. **SOL-P1-5 — deploy-gate lubab avaldatud, kuid RAG-iga sidumata praktikad ning vigane residue-limit võib fail-open olla** (`lib/practiceDeployGate.js:47–55`, `scripts/practice-deploy-gate.mjs:16`). §3.7 nõuab published↔`ragSourceId`/versiooni mittevastavuse korral punast väravat; praegu on `publishedUnlinked` alati informatiivne. Tee see vaikimisi blokeerivaks (RAG-disabled erand ainult sõnaselge, masinloetava ja auditeeritava valikuna). Valideeri `PRACTICE_DEPLOY_MAX_RAG_RESIDUE` finite mitte-negatiivseks arvuks; `NaN` ei tohi mõlemat residue-võrdlust vahele jätta. Lisa testid.

- Teadlik P2/follow-up ei blokeeri seda parandusringi: notification-edastuse kanali tooteotsus; põhjendusajaloo UI/route'i eraldi nähtavaks tegemine; scheduler'i detailse teavituse UX.
- Kõrvaliste failide seis: ruumipildid, `output/imagegen/**` ja `scripts/build-room-locked-frames.mjs` puutumata/stage'imata.
- Järgmine konkreetne samm: Opus parandab SOL-P1-1…5, lisab nimetatud regressioonitestid, kordab kogu kontrollipaketti ja annab sama commit'imata P1 diffi Solile kordusauditiks. U4 ei alga; commit/push/deploy jäävad ootele.
- Commit/push/deploy seis: TEGEMATA.

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

### 2026-07-14 — CODEX — SOL-P1-1…5 PARANDATUD, KORDUSAUDITIKS VALMIS

- Kuupäev/kell: 2026-07-14 11:06, Europe/Tallinn.
- Mudel/effort: Codex, väga kõrge.
- Aktiivne pakett ja etapp: Opuse pooleli jäänud P1 Parimate praktikate
  operatsioonipaketi järelparanduste lõpetamine; commit-eelne auditipakk.
- Lähte-HEAD: `main` @ `df2f45c0`; P1 diff on endiselt commit'imata.
- Loetud/kontrollitud: SOL-i järelkontrolli kirje tervikuna; RAG ingest/delete
  durable töövoog; scheduler ja job-route; assignment/application repair;
  justification ledger; deploy-gate; migratsioon; CSS budget generaator.
- Tehtud muudatused:
  1. **SOL-P1-1 suletud:** superseded `RAG_INGEST` teisendatakse samal durable
     real `RAG_DELETE` cleanup'iks. Deterministlik võimalik orbdokument
     eemaldatakse idempotentselt ja töö ei saa `done` staatust enne edukat
     cleanup'i; ebaõnnestumine jääb deploy-gate'ile nähtavaks.
  2. **SOL-P1-2 suletud:** scheduler kasutab stabiilset unique-ID cursor'it üle
     kõigi `batchSize` lehtede, koondab assignment-tsükli üle lehepiiride ning
     töötab PostgreSQL transaction-scoped advisory lock'i all. Paralleelne tick
     loeb esimese tick'i commit'itud markerid ega loo duplikaati.
  3. **SOL-P1-3 suletud:** assignment'i ja application'i parandused on CAS-iga
     kaitstud; kaotatud CAS ei loo asendajat ega auditit. Iga tegelikult
     rakendatud repair saab auditirea. High-risk ahel loeb ainult
     `reviewedVersion === practice.contentVersion` otsuseid.
  4. **SOL-P1-4 suletud:** reviewer'i põhjendusajaloo ligipääs nõuab praktikale
     sobivat capability scope'i; own-event ligipääs säilib.
  5. **SOL-P1-5 suletud:** `publishedUnlinked` on vaikimisi punane deploy-värav,
     RAG-disabled erand on ainult explicit `true` ja väljundis auditeeritav;
     vigane/NaN/negatiivne residue-limit langeb fail-closed nullpiirile.
  6. **CSS budget fail suletud:** `--set` loob nüüd puuduva sihtkataloogi;
     commititav lagi on `52` ning tavaline kontroll läbib `52/52`.
- Lisatud regressioonid: superseded orphan cleanup'i edu/ebaõnnestumine;
  `>batchSize` cursor-skannimine; kaks paralleelset scheduler tick'i;
  assignment repair'i mõlemad ordering'ud; application CAS; repair-auditid;
  old-version high-risk approvals; vale scope; published-unlinked opt-out ja NaN
  residue fail-closed.
- Käivitatud kontrollid ja täpsed tulemused:
  - P1 sihttestid: **67/67 läbitud**;
  - kogu `npm test`: **1122/1122 läbitud**;
  - `npm run css:budget`: **52/52 läbitud**;
  - `npx prisma validate` ja `npx prisma generate`: läbitud;
  - `npm run db:migrate:check`: **88 migratsiooni** puhas ahel läbitud ja ajutine
    kontrollandmebaas eemaldatud;
  - `npm run lint`: **0 viga**, repo baastaseme 359 warning'ut;
  - `npm run build`: läbitud, 52 staatilist lehte genereeritud ning
    `/api/jobs/practice-reviews` route buildis nähtav;
  - `npm run i18n:check`, `npm run ci:smoke` ja `git diff --check`: läbitud.
- Leitud riskid/P0/P1/P2: uusi P0 või P1 leide ei jäänud. Varasem teadlik P2
  (notification-kanal, justification-history eraldi UI/route ja scheduler'i
  detailne teavitus-UX) ei laienda seda paketti.
- Kõrvaliste failide seis: ruumipiltide kustutused, `output/imagegen/**` ja
  `scripts/build-room-locked-frames.mjs` jäid puutumata ning stage'imata.
- Järgmine konkreetne samm: Sol/Opus teeb sama commit'imata P1 diffi sõltumatu
  kordusauditi. Commit/push/main-merge/deploy alles pärast auditi luba.
- Commit/push/deploy seis: **TEGEMATA**.

### 2026-07-14 — OPUS — P1 KORDUSAUDIT: SOL-P1-1…5 SULETUD, ÜKS UUS P1 BLOKEERIB

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Opus 4.8, Extra (xhigh). Sõltumatu read-only kordusaudit.
- Aktiivne pakett ja etapp: P1 Parimate praktikate operatsioonipakett, commit-eelne kordusaudit Codexi paranduste järel.
- Lähte-HEAD: `main` @ `df2f45c0`; kogu P1 diff commit'imata (8 muudetud + 9 uut rada).
- Loetud/kontrollitud: `lib/effectivePractices.js` (processRagIngest/processRagDeletion, scheduler, repairAssignments, getJustificationHistory, publish), `lib/practiceDeployGate.js`, `scripts/practice-deploy-gate.mjs`, `scripts/drain-effective-practice-rag-deletions.mjs`, `lib/privacy/retryDeletionJob.js` + `deletionJobRetryService.js`, `lib/documents/ragService.js` (deleteRagDocument), `lib/privacy/effectivePracticeAccountCleanup.js`, skeem + migratsioon, kõik uued testid.
- Käivitatud kontrollid ja täpsed tulemused: `tests/effectivePractices/*.test.js` **81/81 läbitud**; kogu `npm test` **1122/1122 läbitud** (exit 0). Testid loetud sisuliselt, mitte ainult loenduri järgi.

**SOL-P1-1…5 — KÕIK SULETUD (kinnitatud koodist, mitte väitest):**

1. **SOL-P1-1 SULETUD.** Superseded ingest konverteerib SAMA durable rea `RAG_DELETE`-ks (`effectivePractices.js:850–872`) enne kui rida saab `done`. Orbdokumendi kustutus on idempotentne (`ragService.js:146` — 404 → `ok`), nii et healoomuline juhtum (ingest ei õnnestunudki) ei jää igavesti punaseks. Ebaõnnestumine jääb `pending`/`failed`-ina nähtavaks nii drain'ile kui väravale. Kinnitasin ka integratsiooni: drain saadab konverteeritud rea `retryDeletionJob`-i, mis käsitleb `RAG_DELETE` + `externalRef` korrektselt ja teeb unlink'i `ragSourceId`-guardiga (`deletionJobRetryService.js:11–19, 80–91`) — st vana orvu koristus EI saa lahti siduda praktika kehtivat uue versiooni linki.
2. **SOL-P1-2 SULETUD.** Cursor-lehitsemine käib üle kõigi lehtede unikaalse tiebreaker'iga (`[nextReviewAt asc, id asc]` + `cursor:{id}`, Prisma ehitab korteaži-võrdluse); assignment-tsüklid koondatakse üle lehepiiride; `pg_advisory_xact_lock(hashtext(...))` on transaktsiooni-skoobis samas tx-is → paralleelne tick blokeerub ja loeb seejärel commit'itud markerid. Kontrollisin eraldi ka markeri „already"-värava loogika: `nextReviewAt` kirjutatakse AINULT koos värske `publishedAt`-iga (publish, `:1430–1442`), seega `createdAt >= publishedAt` värav nullistub iga avaldamistsükliga korrektselt ega vaigista teist tsüklit.
3. **SOL-P1-3 SULETUD.** CAS kontrollitakse enne asendaja loomist (`:2069–2073`) ja kõigil kolmel kandidaadiharul; application-CAS sisaldab `assignedReviewerId`/`assignedCapabilityType` WHERE-s (`:2141–2154`); `chooseApplicationReviewerTx` on puhas lugemine, seega kaotatud CAS ei jäta kõrvalmõju; auditirida tekib igale rakendatud parandusele; high-risk ahel filtreerib `reviewedVersion === contentVersion` (`:2096–2098`). Mõlemad ordering-testid on olemas ja sisulised. Kontrollisin ka, et `practice`-relatsioonid on skeemis kohustuslikud → `recordAudit` ei saa null-dereferentsi.
4. **SOL-P1-4 SULETUD.** `scopeMatchesPractice(item.scope, practice)` on reviewer-väraval (`:2180`), own-event ligipääs säilib, vale scope → 404. Testid katavad mõlemat suunda.
5. **SOL-P1-5 SULETUD.** `residueLimit` fail-closed coercion ja mõlemad võrdlused kasutavad seda; `published_unlinked` blokeerib vaikimisi, erand ainult `allowRagDisabled !== true` ja on väljundis auditeeritav; skript valideerib env-i ja tuletab erandi eraldi masinloetavast lipust. Testid katavad `NaN`/`-3`/`Infinity`/`"abc"`/`undefined`.

**UUS P1 — OPUS-P1-6 (BLOKEERIB COMMIT'I): P1-D põhjendusledger rikub konto kustutamise kustutuslepingut.**

- Failid/read: kirjutus `lib/effectivePractices.js:1299–1300` (`authorFeedback` → visibility `author`, `privateNotes` → visibility `private`) ja `:1776` (application `reviewNote`); kustutusleping `lib/privacy/effectivePracticeAccountCleanup.js:117–120`.
- Käivitustingimus: retsensent kirjutab tagasiside/privaatmärkuse → tekst salvestub NÜÜD KAHTE kohta: `EffectivePracticeReview` JA uus `EffectivePracticeAuditEvent.justification`. Kui praktika **autor** kustutab konto, `scrubOrDeleteEffectivePracticesTx` nullib ainult review-koopiad (`authorFeedback: null, privateNotes: null, conflictNote: null`); avaldatud praktika rida jäetakse alles (`status` jääb `PUBLISHED`, `authorId` → null), seega `onDelete: Cascade` ei käivitu ja ledgeri koopia jääb igaveseks alles.
- Mõju: tekst, mida koodibaas ise käsitleb kustutamisele kuuluvana (leping on lukus testiga `tests/effectivePractices/effectivePracticeAccountDeletion.test.js:83–86`), säilib pärast konto kustutamist ja on `getJustificationHistory` kaudu endiselt loetav igale scope'i-sobivale retsensendile (`isAuthor` muutub `false`-ks, `isReviewer` jääb `true`-ks). See on selle paketiga sisse toodud GDPR-kustutamise regressioon, mitte varasem võlg.
- Oodatav parandus: `scrubOrDeleteEffectivePracticesTx`-i lisada review-scrub'i järele `tx.effectivePracticeAuditEvent.updateMany({ where: { practiceId: practice.id, action: "REVIEW_JUSTIFICATION" }, data: { justification: null } })` (otsuse/versiooni auditijälg jääb alles, kaob ainult vabatekst). Kustutatud praktika haru katab Cascade juba.
- Nõutav regressioonitest: autori konto kustutamine avaldatud praktikaga → ükski `REVIEW_JUSTIFICATION` vabatekst ei jää alles; auditirida (decisionType/contentVersion) jääb alles.
- Tooteotsuse koht: alternatiiv on otsustada, et ledger ON juriidiline säilitatav kirje — siis tuleb muuta review-scrub'i lepingut ja seda teadlikult dokumenteerida. Vaikimisi soovitan ülal kirjeldatud kustutuse, sest see hoiab olemasoleva lepingu.

**P2 (ei blokeeri seda ringi):**

- **P2-1 (scheduler skaala):** `batchSize` on nüüd ainult lehesuurus — kogu backlog töödeldakse ÜHES interaktiivses transaktsioonis. `lib/prisma.js` ei sea `transactionOptions`, seega kehtib Prisma vaikimisi 5 s timeout. Tähtaja ületanud read ei lahku skannikomplektist enne uuesti avaldamist ja iga rida maksab tick'i kohta ühe `findFirst`-i → piisavalt suure kuhjumise korral tx ei jõua enam commit'ida, kogu tick rullub tagasi ja markereid ei teki üldse, ilma et jääks ühtki piiramise hooba. Ebaõnnestub turvaliselt (500 + rollback), pilootmahus ei avaldu. Soovitus: commit lehe kaupa VÕI selge töömaht + `truncated` lipp vastuses, pluss eksplitsiitne `transactionOptions`.
- **P2-2 (tõestusjõud):** paralleelse tick'i test tõestab serialiseerimist ainult fake-i enda `$transaction`-ahela kaudu (`reviewScheduler.test.js:53–59`); advisory lock'i garantiid ise ei testita (repo reegel: testides ei ole elavat DB-d). Aktsepteeritav, kuid dokis ei tohiks väita rohkemat kui „lock-lause väljastatakse ja serialiseeritud täitmisel duplikaati ei teki".
- **P2-3 (värava kasutatavus):** `maxRagResidue` tolerants on oma sihtjuhtumi jaoks tühistatud — publish seab `ragSourceId: null` (`:1439`), seega iga talutud lennus-olev ingest loeb ka `publishedUnlinked` sisse ja värav on punane sõltumata residue-limiidist; ainus pääsetee on nüri `allowRagDisabled`. Soovitus: jätta `publishedUnlinked`-ist välja praktikad, millel on avatud `RAG_INGEST` töö, või laiendada residue-tolerants ka sellele.

- Leitud riskid/P0/P1/P2: **P0 puudub. P1 = OPUS-P1-6 (uus, blokeerib). P2 = 3 ülalkirjeldatut.** SOL-P1-1…5 on kinnitatud suletuks.
- Kõrvaliste failide seis: `public/room/frame-*.webp`, `output/imagegen/**`, `scripts/build-room-locked-frames.mjs` — puutumata, stage'imata.
- Järgmine konkreetne samm: OPUS-P1-6 parandus + regressioonitest, seejärel sama diffi lühike kordusaudit. Kuni selleni P1 pakett EI lähe commit'i.
- Commit/push/deploy seis: **TEGEMATA** (auditis koodi ei muudetud).

### 2026-07-14 — CODEX — OPUS-P1-6 PARANDATUD, KORDUSAUDITIKS VALMIS

- Kuupäev/kell: 2026-07-14 13:02, Europe/Tallinn.
- Mudel/effort: Codex, väga kõrge.
- Aktiivne pakett ja etapp: P1 Parimate praktikate operatsioonipaketi
  konto-kustutuse regressiooni parandusring.
- Lähte-HEAD: `main` @ `df2f45c0`; kogu P1 pakett on endiselt commit'imata.
- Tehtud muudatus: avaldatud praktika autori konto kustutamisel nullib
  `scrubOrDeleteEffectivePracticesTx` samas transaktsioonis lisaks review-koopiale
  kõik selle praktika `REVIEW_JUSTIFICATION` vabatekstid. Auditirea
  `decisionType`, `contentVersion`, tegevus ja ajajälg säilivad.
- Lisatud regressioon: säilitatava avaldatud praktika auditivabatekst kaob,
  otsuse ja versiooni auditijälg säilib ning kõrvaline auditirida ei muutu.
- Käivitatud kontrollid:
  - konto kustutamine + põhjendusajalugu: **10/10 läbitud**;
  - kogu `npm test`: **1122/1122 läbitud**;
  - sihtfailide ESLint: **0 viga**;
  - `git diff --check`: puhas (ainult Windowsi reavahetuse hoiatused).
- Leitud riskid/P0/P1/P2: OPUS-P1-6 on parandatud. Opuse varasemad kolm P2
  jäävad mitteblokeerivateks järeltegevusteks; selle paranduse ulatust nendega
  ei laiendatud.
- Kõrvaliste failide seis: olemasolevad ruumipiltide kustutused,
  `output/imagegen/**`, `reports/**` ja `scripts/build-room-locked-frames.mjs`
  jäid puutumata ning stage'imata.
- Järgmine konkreetne samm: Opuse kitsas OPUS-P1-6 kordusaudit. P1 paketti ei
  commit'ita ega push'ita enne auditi luba.
- Commit/push/main-merge/deploy seis: **TEGEMATA**.

### 2026-07-14 — SOL — P1 PAKETT ERALDATUD, TESTITUD JA KASUTAJA POOLT AKTSEPTEERITUD

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Aktiivne pakett ja etapp: P1 Parimate praktikate operatsioonipaketi ohutu
  eraldamine dirty `main` tööpuust pärast OPUS-P1-6 parandust.
- Kasutaja otsus: OPUS-P1-6 ning varasemad SOL-P1-1…5 parandused aktsepteeriti
  ilma uue kordusauditita. Märgend on
  `SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA`; see ei võrdu
  märgendiga `OPUS HEAKS KIIDETUD`.
- Lähtebaas: värske `origin/main` @ `df2f45c0`.
- Eraldi tööpuu ja haru:
  `C:/Users/rauds/Desktop/SotsiaalAI-p1`, `codex/p1-ops-final`.
- Isolatsioon: ajutise Git-indeksiga tõsteti eraldi harule ainult 20 P1 rada —
  operatsioonikood, job-route, migratsioon, deploy-värav, regressioonitestid,
  käskude paketikirjed, progressidokument ning kasutaja nõutud CSS budget
  generaator/52-baastase. Dirty `main` HEAD ja päris staging-ala ei muutunud.
- Kõrvaliste failide seis: U12/U3 auditidokk, U1/U2/Opuse dokid,
  `public/room/frame-*.webp`, `output/imagegen/**` ja
  `scripts/build-room-locked-frames.mjs` jäid paketist välja ning puutumata.
- Käivitatud kontrollid:
  - `tests/effectivePractices/*.test.js`: **81/81 läbitud**;
  - kogu `npm test`: **1122/1122 läbitud**;
  - `npm run css:budget`: **52/52 läbitud**;
  - `npx prisma validate`: skeem korras;
  - `git diff --check`: puhas.
- Leitud riskid: uusi P0/P1 leide ei tekkinud. `npm ci` raporteeris baasi
  sõltuvuspuus 7 mõõdukat auditileidu; lukufaili selles paketis ei muudetud.
- Commit/push/main-merge/deploy seis: P1 snapshot-commit `5b18e5d0` loodud;
  lõplik progressidoki commit ja push järgnevad. Main-i ühendamist ega deploy'd
  ei tehta.
- Järgmine konkreetne samm: P1 haru push; seejärel nelja aktsepteeritud paketi
  integratsioonirehearsal värskest `origin/main`-ist eraldi harul.
