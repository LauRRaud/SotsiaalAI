# 08 — Sol: U12 + U3 „Minu jagamised” ja eelpöördumise tagasivõtmine

> **Staatus:** SOL VALMIS ÜLEANDMISEKS — täisvertikaal harul teostatud, kontrollitud ja push'itud; main-i ei ole ühendatud; Opuse kordusaudit ning sõltumatu U12+U3 järelkontroll on veel avatud väravad
>
> **Mudel / effort:** Codex, väga kõrge
>
> **Alus:** `origin/main` @ `11381100` (`Docs: allow parallel U12 U3 worktree`)
>
> **Worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-u12-u3`
>
> **Haru:** `codex/u12-u3-trust-package`
>
> **Alustatud:** 2026-07-14 EEST
>
> **Põhiroll:** pöörduja (`CLIENT`); koond jääb serveris rangelt sisselogitud kasutaja enda objektide skoopi ja töötab sama lepinguga ka teistel rollidel.
>
> **Deploy:** ei kuulu sellesse töösse ja seda ei tehta.

## 1. Eesmärk ja piir

Valmiv usalduspakett vastab ühes kohas küsimusele: „Kes minu infot praegu näeb ja mida ma saan veel kontrollida?”

Pakett sisaldab:

1. profiilist avatavat „Minu jagamised” koondvaadet;
2. saadetud eelpöördumiste adressaati, saatmisaega, olekut ja valdusriba;
3. INTERNAL eelpöördumise tagasivõtmist enne serveris kinnitatud avamist;
4. avatud eelpöördumise paranduse saatmist uue, eelmisega seotud versioonina;
5. aktiivseid ruumiliikmesusi koos olemasoleva „Lahku” toiminguga seal, kus liikmeroll seda lubab;
6. aktiivseid kasutaja saadetud kutseid koos olemasoleva tagasivõtuga;
7. kasutaja avaldatud abisoove ja -pakkumisi koos aegumisega;
8. raamistikukinnitusi eraldi informatiivse plokina.

See ei ole tehniline auditilogi, GDPR-eksport, uus teavituskeskus, ruumi omandi üleandmine ega välise e-kirja tagasikutsumise lubadus. EXTERNAL_EMAIL kanalil ei ole platvormil usaldusväärset avamise ega tagasikutsumise kontrolli, mistõttu kuvatakse see ausalt pöördumatu välissaatmisena.

## 2. Kohustuslikult loetud alus

- `docs/platvormi arendus/00-uue-akna-handoff-opuse-audit-ja-jargmised-tood.md` — §6 tööleping, skoop ja paralleeltöö piirid.
- `docs/platvormi arendus/fable-5-avastamata-vajadused-ja-uued-voimalused.md` — U3 ja U12 minimaalne kasulik versioon.
- `docs/platvormi arendus/fable-5-usaldusmudel.md` — valdusriba, jagamise pearaamat ja kontrollitavus.
- `docs/platvormi arendus/fable-5-platvormiloogika-max-taiendus.md` — aktiivse eelpöördumise, rollide, migratsioonide ja privaatsuspiiride tõendid.
- `docs/platvormi arendus/fable-5-lisavastused-organisatsioon-ja-piloot.md` — pöörduja piloodirada ja usalduspaketi koht selles.
- `prisma/schema.prisma`, `lib/preInquiries.js`, `lib/rooms/preInquiryRoom.js` ning eelpöördumise accept/workflow/room marsruudid.
- kutse revoke-, ruumi leave-, ruumiloendi, abikirjete loendi ja profiili aktiivne klient/server.
- `components/alalehed/ProfiilBody.jsx`, `lib/workspaceDashboardCards.js` ja ET/EN/RU sõnastikud.

## 3. Aktiivse koodi kaardistus

### 3.1 Eelpöördumine

- `PreInquiry` eristab autorit ja platvormiadressaati (`authorId`, `recipientOwnerId`) ning kanalit (`INTERNAL`, `EXTERNAL_EMAIL`).
- `lib/preInquiries.js` teeb nähtavusfiltri autorile või adressaadile ja serialiseerib praegu sama kirje mõlemale.
- INTERNAL saatmine võib sündida nii loomisel kui PATCH-i olekumuutusel. Praegune kood ei täida neil radadel järjekindlalt `sentAt`; see parandatakse samas vertikaalis.
- SENT kirje on praegu autorile muutmatu. Eraldi recall/correction teenuseid ega marsruute pole.
- Vastuvõtu POST ja tööplaani PATCH kirjutavad praegu ilma eelpöördumise ühise lukuta. Need viiakse recall/open võistluse jaoks sama lukule.
- `withPreInquiryRoomLock` on olemas, seda kasutavad juba ruumi loomine, adressaadi muutmine ja allalaadimisolek. Sama võtme kasutamine hoiab recipient/room/open/recall järjestused ühe deterministliku lepingu all.
- Kanooniline eelpöördumise ruum on `originType + originId` järgi 1:1 ning ruumi loomine loeb osapooled lukust värskelt.

### 3.2 Koondatavad olemasolevad jagamised

- aktiivne ruumiliikmesus: `RoomMember.userId`, `leftAt: null`, ruumi pealkiri ja roll; olemasolev leave POST keelab OWNER rolli lahkumise;
- aktiivne kutse: `Invite.inviterId`, `status: SENT`, tulevane `expiresAt`; olemasolev revoke POST nõuab ruumi OWNER/MODERATOR õigust;
- avaldatud abisoov/-pakkumine: kasutaja oma `HelpRequest` / `HelpOffer`, `userConfirmedAt`, `status: OPEN`, `expiresAt`;
- raamistikukinnitus: `FrameworkAcceptance.userId`, versioon, tüüp ja `acceptedAt`.

### 3.3 Kliendi sisenemiskoht

- `/profiil` menüü on aktiivne ja rolliülene; sinna lisatakse „Minu jagamised”.
- koond ise saab eraldi lokaliseeritava `/minu-jagamised` lehe, et värskendus, fookus ja brauseriajalugu ei sõltuks profiili modaalist.
- andmed tulevad ühest koond-API-st; klient ei tee viie eraldi loendi waterfall'i.

## 4. Lukustatud oleku- ja õiguseleping

### 4.1 U3 olek

Skeemi lisatakse nullable väljad:

- `recalledAt`: autor võttis INTERNAL saadetise tagasi enne avamist;
- `openedAt`: adressaadi usaldusväärne serveritoiming avas pöördumise;
- `supersededById`: vana avatud versioon osutab uuele parandatud saadetisele.

Postgresi `PreInquiryStatus` enum'i ei laiendata. Tagasivõtt, avamine ja parandusahel on ortogonaalsed ajatemplid/viide, mitte uus põhistaatus.

Avamise usaldusväärsed sündmused v1-s:

1. adressaat kinnitab vastuvõtu;
2. adressaat salvestab tööplaani esimest korda;
3. adressaat loob või taasavab eelpöördumise kanoonilise ruumi.

Pelgalt loendi GET ei kirjuta avamist: lugemispäring jääb kõrvalmõjuta. UI ütleb seepärast ka enne avamist ausalt, et tagasivõtmine eemaldab kirje aktiivsest loendist ja säilitab auditijälje, kuid ei saa kustutada infot, mida inimene võis juba ekraanil näha või mäletada.

### 4.2 Recall

- lubatud ainult autorile;
- lubatud ainult `INTERNAL` kanalil, saadetud ja veel avamata kirjel;
- puuduv või võõras objekt annab sama 404 ega leki olemasolu;
- juba tagasi võetud kirje korduspäring on idempotentne ja tagastab sama seisu;
- avatud kirje annab kontrollitud 409 ja suunab paranduse saatmisele;
- juba loodud kanooniline jagatud ruum sulgeb recall'i ka siis, kui `openedAt` pole veel tekkinud, sest adressaadile on eraldi ligipääs juba loodud;
- tagasi võetud kirje kaob adressaadi aktiivsest eelpöördumiste loendist, kuid jääb autorile „Minu jagamistes” nähtavaks;
- recall ei kustuta rida ega sisu.

### 4.3 Open

- ainult kirje värske `recipientOwnerId` võib avamise sündmuse tekitada;
- accept/workflow/recipient-room toiming loeb kirje lukus uuesti;
- tagasi võetud kirje annab adressaadile üldise 404;
- esimene sündmus seab `openedAt`; kordussündmus säilitab algse aja;
- accept seab olemasolevalt `READY`; tööplaan säilitab oma olemasoleva READY/ARCHIVED lepingu.

### 4.4 Parandus

- lubatud ainult autorile, ainult avatud ja mitte tagasi võetud INTERNAL kirjel;
- server võtab adressaadi, kanali ja lähtekonteksti vanast kirjest; klient ei saa parandusega adressaati ümber määrata;
- klient saadab parandatud pealkirja/teksti, privaatsusotsuse ja vana kirje `expectedUpdatedAt` sõrmejälje;
- server kontrollib sisu sama privaatsusväravaga nagu tavalist eelpöördumist;
- tehing loob uue SENT kirje värske `sentAt` väärtusega ja seob vana `supersededById` väljaga;
- vana kirje jääb alles ning adressaat näeb nii ajalugu kui parandatud versiooni;
- topeltpäring tagastab esimese loodud paranduse ega loo duplikaati.

### 4.5 U12 koond

- koond nõuab autentimist ja kõik päringud filtreeritakse serveris `userId` järgi;
- eelpöördumistest loetakse ainult autori enda saadetud kirjed; vastuvõtja privaatset märkust või checklisti koondisse ei väljastata;
- ruumidest loetakse ainult kasutaja aktiivne liikmesusrida;
- kutsetest loetakse ainult kasutaja enda saadetud aktiivsed kutsed;
- kuulutustest loetakse ainult kasutaja enda kinnitatud avaldatud kirjed;
- raamistikest loetakse ainult kasutaja enda kinnitused;
- koond ei kasuta ADMIN möödapääsu võõraste andmete lugemiseks.

## 5. Skeemi ja migratsiooni otsus

Üks edasiühilduv migratsioon:

1. kolm nullable `PreInquiry` veergu (`recalledAt`, `openedAt`, `supersededById`);
2. self-FK `supersededById -> PreInquiry.id` `ON DELETE SET NULL`;
3. UNIQUE indeks `supersededById` peal, et ühel vanal versioonil saaks olla ainult üks otsene parandaja;
4. indeksid autori jagamisloendi ning recipient + recall aktiivloendi jaoks vastavalt tegelikule päringule;
5. olemasolevaid ridu ei märgita oletuslikult avatuks ega tagasi võetuks; ajaloolisele INTERNAL `SENT` kirjetele võib täita ainult üheselt puuduva `sentAt` väärtuse, kui migratsiooni ülevaatus kinnitab, et see ei valeta.

Migratsioon on additive ja rollback'itav. Enum'i ei muudeta ning sisu ei kustutata.

## 6. Paralleelsed järjestused

### 6.1 Recall enne open

1. autor ja adressaat alustavad sama SENT / `openedAt = null` snapshot'iga;
2. recall võtab advisory-lock'i, loeb värske rea ja seab `recalledAt`;
3. open saab luku järgmisena, loeb `recalledAt` ning tagastab 404 ilma olekut muutmata;
4. adressaadi järgmine loend ei sisalda kirjet; autor näeb tagasivõtu aega.

### 6.2 Open enne recall

1. open võtab sama advisory-lock'i ja seab esimese `openedAt` väärtuse;
2. recall saab luku järgmisena, loeb värske `openedAt` ning tagastab 409;
3. ajalugu jääb alles; autorile avaneb „Saada parandus”.

### 6.3 Kaks paranduse saatmist

1. esimene correction saab luku, loob uue rea ja seob `supersededById`;
2. teine saab luku, näeb olemasolevat seost ja tagastab sama paranduse;
3. UNIQUE FK kaitseb ka rakenduskihi vea korral duplikaadi eest.

### 6.4 Recall ja correction eri versioonidel

Parandus on eraldi uus SENT kirje. Seda saab enne tema enda avamist tagasi võtta. Vana avatud versiooni ei kustutata ega „muudeta tagasi”; selle `supersededById` seos säilitab ajaloo.

## 7. Kliendi ajaloo-, värskendus- ja topeltklõpsureeglid

- `/minu-jagamised` on päris URL; profiilist sisenemine teeb ühe navigeerimise ja tagasi viib profiili/töölauale.
- filtri- ja avatud parandusevormi olek ei lisa brauseriajalukku uusi kirjeid.
- kõik andmed laaditakse ühe no-store koondpäringuga; sõltumatud DB-lugemised jooksevad serveris paralleelselt.
- õnnestunud recall/revoke/leave/correction järel värskendatakse sama koondit ilma täislehe navigeerimise ja scrolli nullimiseta.
- korraga võib töötada ainult üks mutatsioon; sama rea nupud on selle ajal blokeeritud.
- topeltklõps ei tekita teist päringut kliendis; serveri recall ja correction jäävad sellest sõltumata idempotentseks.
- mutatsiooni tulemus läheb `aria-live` olekusse; vea korral säilib kasutaja parandustekst.
- paranduse tekst ei sulgu ega kao enne serveri kinnitatud edu.
- kuupäevad vormindatakse aktiivse lokaadi järgi; värv ei ole ühegi oleku ainus kandja.

## 8. Teostusplaan ja hetkeseis

- [x] Etapp 0 — handoff ja neli Fable'i alusdokumenti täielikult loetud.
- [x] Etapp 0 — `origin/main` värskendatud; eraldi puhas worktree ja haru loodud enne failimuudatusi.
- [x] Etapp 0 — aktiivne kood, õigused, olemasolevad toimingud ja UI sisenemiskoht kaardistatud.
- [x] Etapp 0 — oleku-, skeemi-, võistlus- ja kliendileping lukustatud sellesse progressidokki enne rakenduskoodi.
- [x] Etapp 1 — Prisma skeem ja migratsioon.
- [x] Etapp 2 — recall/open/correction serveriteenus ühise luku, CAS-i ja idempotentsusega.
- [x] Etapp 3 — accept/workflow/room marsruutide avamissündmus ja recalled no-leak piir.
- [x] Etapp 4 — owner-only „Minu jagamised” koond-API.
- [x] Etapp 5 — `/minu-jagamised` UI, valdusriba, profiili sisenemiskoht ja ET/EN/RU.
- [x] Etapp 6 — siht- ja regressioonitestid.
- [x] Etapp 7 — lint, i18n, Prisma, migratsioon, täistestid, build ja lokaalne runtime/visuaalkontroll.
- [x] Etapp 8 — lõppüleandmine, commit ja push; main-i ei ühendata.

## 9. Kohustuslikud testid ja kontrollid

### 9.1 Server ja turva

- owner saab avamata INTERNAL kirje tagasi võtta;
- recipient ja võõras kasutaja ei saa recall'i teha; võõras/puuduv ei leki;
- EXTERNAL_EMAIL recall on keelatud ausa kontrollitud veaga;
- recall kordus on idempotentne;
- recall→open ja open→recall järjestused on deterministlikud;
- accept, esimene workflow-save ja recipient-room seavad `openedAt` ainult ühe korra;
- recalled kirje on recipient loendist väljas ning accept/workflow/room annavad 404;
- avatud kirje parandamine loob ühe uue SENT versiooni ja vana ajaloo säilib;
- correction topeltklõps/paralleelpäring loob ühe rea;
- stale `expectedUpdatedAt` ei loo parandust;
- parandusega ei saa võltsida adressaati ega võtta üle võõrast kirjet;
- tehingu viga veeretab tagasi nii uue rea kui vana seose;
- koond ei väljasta receiverNote/checklisti ega teiste kasutajate objekte;
- ADMIN saab koondis ainult enda jagamised.

### 9.2 Klient ja i18n

- loading/empty/error/ready olekud;
- recall, correction, invite revoke ja room leave kasutavad õigeid endpoint'e ning värskendavad koondit;
- OWNER ruum ei luba eksitavalt „Lahku”;
- INTERNAL unopened/opened/recalled/superseded ning EXTERNAL olekud annavad ausad tegevused ja tekstid;
- valdusriba vastab iga objekti puhul „kes näeb / päritolu / kehtivus” küsimustele;
- ET/EN/RU võtmed on pariteedis;
- profiililink ja lehe meta on lokaliseeritud;
- klaviatuurifookus, `aria-live`, nähtavad fookusolekud ja mobiilipaigutus kontrollitud.

### 9.3 Täiskontroll

- sihttestid;
- kogu `npm test`;
- `npm run i18n:check`;
- muudetud failide ESLint ja kogu repo lint;
- `prisma validate` + `prisma generate`;
- `npm run db:migrate:check`;
- `npm run build`;
- `git diff --check`;
- autentimata API smoke (401 JSON);
- lokaalne visuaalkontroll töölaua- ja mobiililaiusel, kui runtime on töökindlalt käivitatav.

## 10. Riskid ja teadlikud piirid

1. **Ajalooline `sentAt`:** varasem INTERNAL loomine ei täitnud seda alati. Migratsioon ei tohi oletada avamise aega; koond peab vajadusel näitama ausat „saatmisaeg teadmata”.
2. **GET võib olla juba nähtud:** server ei saa tõendada inimese mälu. Seepärast ei lubata ka unopened recall'i puhul „kustutamist”, vaid ainult aktiivsest loendist eemaldamist.
3. **Väline e-kiri:** recall ja usaldusväärne open puuduvad; UI ei tohi jätta vastupidist muljet.
4. **OWNER ruumist lahkumine:** olemasolev server keelab selle. U12 kuvab omandi informatiivselt ega ehita siia omandi üleandmist/kustutamist.
5. **Paranduse semantika:** v1 on lineaarne üks-ühele parandusahel, mitte üldine versioonihaldus.
6. **Paralleelne Opuse rada:** selle haru tööd ei merge'ita, rebase'ita ega cherry-pick'ita main-i enne auditite ja sõltumatu U12/U3 järelkontrolli lõppu.

## 11. Tööpäevik

### 2026-07-14 — lähte- ja lepinguetapp

- Handoff loeti täielikult.
- Kontrolliti, et `848de7a6`, `7f20d7ce`, `9a46192b` ja `42fe884a` on main-i esivanemad.
- `git fetch origin main` kinnitas `origin/main` tipu `11381100`.
- Loodi worktree `C:\Users\rauds\Desktop\SotsiaalAI-u12-u3` ja haru `codex/u12-u3-trust-package`.
- Põhitööpuu stage'imata `public/room/frame-*.webp`, `output/imagegen/**` ja `scripts/build-room-locked-frames.mjs` jäid puutumata.
- Loeti täielikult §2 alusdokumendid ja kaardistati aktiivsed serveri-, skeemi-, UI- ning i18n-liitekohad.
- Lukustati recall/open/correction võistlusleping ja koondvaate owner-only piir.

### 2026-07-14 — teostus ja kontroll

- Lisati `PreInquiry.openedAt`, `recalledAt` ja unikaalne `supersededById` self-seos koos kahe päringuindeksiga.
- Lisati additive migratsioon `20260714220000_pre_inquiry_recall_and_correction`; ajalooliselt täidetakse ainult üheselt `SENT` olevate ridade puuduv `sentAt`, avamist ega tagasivõtmist ei oletata.
- Recall, accept, recipient workflow, recipient room-open ja correction jooksevad sama eelpöördumise advisory-lock'i all. Recall ja correction kasutavad CAS-kirjutusi; paranduse loomine ja vana rea sidumine on üks tehing.
- Adressaadi nähtavus on piiratud päriselt saadetud ridadele; pelgalt adressaadiga DRAFT ei leki vastuvõtja loendisse. Recall kontrollib sama luku all ka kanoonilise ruumi puudumist.
- Recalled kirje eemaldati adressaadi nähtavusfiltrist ning accept/workflow/room annavad selle kohta no-leak 404.
- Parandus kopeerib adressaadi ja lähtekonteksti serveri lukustatud realt, läbib privaatsusvärava, ei kopeeri receiverNote/checklisti ega assessmentState'i ning saadab uue sisuvaba saabumisteavituse.
- Lisati üks autentitud `/api/my-sharings` koond, mille kuus sõltumatut owner-scoped päringut jooksevad paralleelselt. Eelpöördumiste select ei sisalda vastuvõtja privaatset töövoogu.
- Lisati `/minu-jagamised`, profiili sisenemiskoht, viie jaotise valdusribad, loading/empty/error olekud, recall/revoke/leave kinnitused, inline correction + privaatsusotsus ning lokaadipõhised kuupäevad.
- Lisati täielik ET/EN/RU sõnastik ja lokaliseeritud metadata.
- Runtime-kontroll leidis esimesel katsel `SubpageHeader` ankurdusest Reacti mõõtmistsükli; selle lehe jaoks eemaldati ebavajalik `anchorBack`. Samuti lisati `ModalConfirm`-ile lehepõhised overlay/content/actions klassid, et dialoog oleks päriselt fikseeritud ja mobiilis nähtav.
- Playwrighti semantilise snapshot'i ja ekraanipildiga kontrolliti 1440 px ning 390 px laiust, kõiki viit jaotist, INTERNAL unopened/opened ja EXTERNAL eristust, paranduse vormi ja recall-kinnitust. Kontrollkasutaja koondvastus mock'iti ainult brauseri renderduseks; serveri owner/no-leak lepingut kontrollivad teenusetestid.
- Autentimata smoke andis 401 nii `GET /api/my-sharings` kui vigase JSON-kehaga recall/correction POST-i puhul, kinnitades autentimise enne body-parsimist.

## 12. Kontrolltulemused

- `node --import ./scripts/register-node-test-loader.mjs --test tests/preInquiries/trustLifecycle.test.js tests/preInquiries/trustPackageContracts.test.js tests/sharings/mySharings.test.js` — **16/16 läbis**.
- eelpöördumise ja kanoonilise ruumi regressioonikomplekt — **92/92 läbis**.
- `npm test` — **1086/1086 läbis** pärast runtime- ja lõpliku ruumipiiri parandusi.
- muudetud JS/JSX failide ESLint — **0 viga, 0 hoiatust**.
- `npm run lint` — **0 viga**; kogu repos jäi **359 olemasolevat hoiatust** kõrvalistes failides.
- `npm run i18n:check` — ET/EN/RU pariteet korras.
- `npx prisma validate` ja `npx prisma generate` — korras.
- `npm run db:migrate:check` — kõik **88 migratsiooni** rakendusid puhtasse ajutisse lokaalsesse PostgreSQL andmebaasi; skeem ajakohane ja proovibaas eemaldatud.
- `npm run build` — Next 16.2 Turbopack build läbis; `/minu-jagamised`, `/api/my-sharings`, recall ja corrections marsruudid on buildi route-loendis.
- runtime console pärast parandusi — **0 viga, 0 hoiatust**.
- `git diff --check` — korras.

## 13. Üleandmise failid

Põhifailid sõltumatuks järelkontrolliks:

- skeem/migratsioon: `prisma/schema.prisma`, `prisma/migrations/20260714220000_pre_inquiry_recall_and_correction/migration.sql`;
- server: `lib/preInquiries.js`, `lib/rooms/preInquiryRoom.js`, `lib/mySharings.js`;
- API: `app/api/my-sharings/route.js`, `app/api/pre-inquiries/[id]/recall/route.js`, `app/api/pre-inquiries/[id]/corrections/route.js`, uuendatud accept-route;
- UI: `app/minu-jagamised/page.jsx`, `components/sharings/*`, `components/alalehed/ProfiilBody.jsx`;
- i18n: `messages/et.json`, `messages/en.json`, `messages/ru.json`;
- testid: `tests/preInquiries/trustLifecycle.test.js`, `tests/preInquiries/trustPackageContracts.test.js`, `tests/sharings/mySharings.test.js` ning kaks uuendatud regressioonifaili.

## 14. Jätkamiskoht

**Hetk:** U12+U3 täisvertikaal on harul `codex/u12-u3-trust-package` teostatud, testitud ja commit'iga `c21883b2` originisse push'itud. Põhitööpuu teadaolevad ruumikaadrite muudatused jäid samaks ning neid ei puudutatud.

**Järgmine konkreetne samm:** Opuse auditite lõppedes teha selle haru sõltumatu U12+U3 järelkontroll, pöörates eraldi tähelepanu recall/open/correction paralleeljärjestustele, owner-only koondile, privaatsusväravale ja päris autentitud andmetega UI-le. Alles seejärel otsustada merge/cherry-pick.

**Ära tee jätkamisel:** ära ühenda main-i enne auditite ja sõltumatu järelkontrolli lõppu; ära deploy; ära muuda Opuse auditidokumente ega kõrvalisi ruumifaile.

## 15. 2026-07-14 jätkukontroll pärast `origin/main` edenemist

- Värske `origin/main` tipp on `d6c2c695` (`Fix audited Covision privacy and wellbeing races`); U12+U3 haru alus jääb teadlikult `11381100` peale ning haru ei rebase'itud ega ühendatud main-iga.
- `11381100..origin/main` ja `11381100..codex/u12-u3-trust-package` muudetud failide nimekirjadel puudub kattuvus. Main-i uus commit puudutab Kovisiooni kõneserializerit, Tööheaolu paneeli, nende teste ja Opuse auditidokumente, mitte U12+U3 vertikaali faile.
- Opuse auditid `06-opus-kovisioon-lopetatud-juhtumid-parimad-praktikad-jarelkontroll.md` ja `07-opus-tooheaolu-kovisioon-jarelkontroll.md` ning operatsiooniprogress `01-opus-parast-auditit-operatsioon-u4-u8-tooplaan-ja-progress.md` loeti värskelt `origin/main`-ist lõpuni.
- Dokumenteeritud väravaseis on endiselt **ootab Opuse kordusauditit**: Soli A-P1-1 ning B-P1-1/B-P2-1 parandused on main-is ja testitud, kuid sõltumatu Opuse kordusauditi lõppotsust ei ole neisse dokumentidesse veel lisatud. Commit'i pealkirja ei käsitleta auditi heakskiiduna.
- Seetõttu ei tehta merge'i, rebase'i, cherry-pick'i ega deploy'd. Järgmine lubatud kvaliteedisamm on Opuse kordusauditi lõppotsus; pärast selle sulgumist peab U12+U3 haru kontrollima teine sõltumatu ülevaataja. Käesolev Soli/Codexi enesekontroll ei kvalifitseeru sõltumatuks järelkontrolliks.

## 16. 2026-07-14 adversaalne enesekontroll ja teine parandusring

See ring parandab haru enne sõltumatut ülevaatust, kuid **ei asenda sõltumatut U12+U3 järelkontrolli**.

### Leitud ja suletud vead

1. Korduv vastuvõtu POST võis juba arhiveeritud receiver-workflow tagasi `READY` olekusse viia. `acceptPreInquiry` on nüüd pärast esimest avamist idempotentne, säilitab `ARCHIVED` oleku ja ei tee kordusel kirjutust. Vastuvõtja UI ei paku `READY` ega `ARCHIVED` reale uut vastuvõtutoimingut.
2. `busyKey` Reacti state ei olnud üksi sünkroonne topeltklõpsuvärav. Recall/revoke/leave/correction kasutavad nüüd kohe seatavat `mutationInFlightRef` väravat; enne esimest renderdust saabuv teine sündmus ei tee teist päringut.
3. Paranduse teksti sai correction POST-i ajal edasi muuta, mis võimaldas hilise edu järel uuema lokaalse teksti kadumist. Kõik paranduse sisendid on päringu ajal külmutatud ja kannavad serveri pikkuspiiridega samu `maxLength` väärtusi.
4. Koond võis näidata recall-nuppu ka siis, kui kanooniline eelpöördumise ruum oli juba olemas. Aktiivse ruumiliikmesuse päringust tuletatakse nüüd kanoonilise ruumi päritolu-ID ning selline rida ei paku eksitavat recall-toimingut; serveri ruumiguard jääb autoriteetseks.
5. Kasutaja enda saadetud kutse võis jääda koondisse pärast ruumi moderaatoriõiguse kaotamist, kuid UI pakkus endiselt revoke-nuppu, mille server õigesti keelaks. Koond arvutab nüüd `canRevoke` väärtuse värskest ruumi omandist või aktiivsest OWNER/MODERATOR liikmesusest; kutse ajalugu jääb nähtavaks, lubamatu toiming mitte.
6. Accept-route'i 4xx vead ei läbinud eraldi avalikku allowlist'i. Nüüd väljastatakse ainult `not_found`, `not_sent` ja `open_conflict`; kõik muu saab üldise `accept_failed` võtme.

### Ajaloolise andmestiku fail-closed piir

Enne seda haru ei täitnud INTERNAL saatmisteed järjekindlalt `sentAt` väärtust ning vastuvõtt muutis `SENT` rea `READY`-ks. Seetõttu ei saa vanast paljast `READY` või `ARCHIVED` reast alati tõendada, kas adressaat sai selle päriselt või oli see autori saatmata ettevalmistus. Migratsioon backfill'ib ainult üheselt `SENT` read; ebakindlaid ajaloolisi ridu adressaadile oletuslikult ei avaldata. See võib jätta mõne vana vastuvõetud rea nii recipient-loendist kui ka autori U12 ajaloolisest koondist välja, kuid väldib saatmata mustandi privaatsusleket ja vale jagamisväidet. Laiem ajalooline taastamine vajab eraldi toote-/andmeotsust või usaldusväärset audititõendit.

### Teise ringi kontrolltulemused

- täiendatud sihttestid: **20/20**;
- kogu `npm test`: **1090/1090**;
- `npm run i18n:check`: ET/EN/RU pariteet korras;
- Prisma `validate` ja `generate`: korras;
- `npm run db:migrate:check`: kõik **88 migratsiooni** rakendusid puhtasse ajutisse localhost-PostgreSQL andmebaasi, skeem ajakohane ja proovibaas eemaldatud;
- `npm run lint`: **0 viga**, 359 varasemat hoiatust; muudetud `WorkspaceFeaturePage.jsx` failis on 27 varasemat hardcoded-string hoiatust, selle ringi read uusi hoiatusi ei lisanud;
- `npm run build`: läbis, U12/U3 leht ja API marsruudid route-loendis;
- runtime-smoke: `/minu-jagamised` → 200; autentimata `/api/my-sharings`, recall, correction ja accept → 401 enne keha/objekti töötlemist; kontrollport suleti;
- `git diff --check`: puhas.

## 17. 2026-07-14 Opuse sõltumatu järelkontrolli parandusring

Värske `origin/main` tipp `df2f45c0` lisas sõltumatu auditi `09-opus-u12-u3-jarelkontroll.md` otsusega **OPUS PARANDUSED VAJALIKUD**. Audit ei leidnud P0-turvaviga, kuid kasutaja määras F1 otsese post-open PATCH-i ajaloo tervikluse tõttu blokeerivaks P1-ks. Käesolev ring sulgeb F1 ja F2 ning samas ringis ka auditi U1 ja U2 kasutatavusleiud. Opuse auditidokumenti sellel harul ei muudeta ja see enesekontroll ei asenda nõutud uut sõltumatut järelkontrolli.

### Suletud leiud

1. **F1 — avatud või asendatud pöördumise otsene PATCH:** `updatePreInquiry` keeldub nüüd kontrollitud 409 võtmega `pre_inquiries.errors.opened_cannot_be_edited`, kui `openedAt` on täidetud või `supersededById` on olemas. Sama kontroll jookseb nii enne lukku kui ka advisory-lock'i all värskelt loetud real, mistõttu kahe kontrolli vahel toimuv avamine ei luba ajalugu tagantjärele ümber kirjutada. Avamisjärgne muudatus jääb ainult `sendPreInquiryCorrection` uue SENT-versiooni teeks.
2. **F2 — puuduva olukorra tõlge:** `pre_inquiries.errors.situation_required` on lisatud ET/EN/RU kataloogidesse. Samades kataloogides on F1 uus avalik veavõti.
3. **U1 — modaalis nähtav toimingu viga:** recall/revoke/leave serveriviga kuvatakse kinnituskasti sees `role="alert"` olekus; dialoog jääb avatuks ja toimingut saab korrata. Taustal oleva live-region'i fookust ei liigutata avatud modaali taha. Uue kinnituse avamine puhastab varasema toimingu või värskenduse teate, et vana viga ei kanduks järgmisse dialoogi.
4. **U2 — mutatsioon õnnestub, koondi värskendus ebaõnnestub:** järelvärskendus kasutab `preserveData` režiimi. Olemasolev ledger jääb nähtavaks ning kasutaja saab eraldi lokaliseeritud `my_sharings.errors.refresh_failed` teate; leht ei kuku eksitavalt alglaadimise täisvea olekusse.

### Lisatud regressioonipiirid

- avatud READY otsene PATCH → 409, null kirjutust ja muutumatu sisu;
- superseded vana rida → 409 ja null kirjutust;
- luku-eelse kontrolli järel konkureeriv avamine → luku all 409 ja null sisukirjutust;
- avamata DRAFT ja READY jäävad otse muudetavaks;
- correction loob endiselt ühe uue SENT-versiooni ja vana `supersededById` seose;
- avamata SENT recall jääb idempotentselt toimivaks;
- tühi correction-situation tagastab 400 `situation_required` võtme;
- UI lepingutestid katavad modaalivea, fookuse, säilitatud ledger'i, eraldi refresh-vea ja vana teate puhastamise;
- ET/EN/RU lepingutest kinnitab kõigi kolme uue võtme olemasolu igas kataloogis.

### Kolmanda ringi kontrolltulemused

- U12/U3 sihttestid: **26/26 läbis**;
- kogu `npm test`: **1096/1096 läbis**;
- muudetud JS/JSX failide ESLint: **0 viga, 0 hoiatust**;
- `npm run lint`: **0 viga**, repos püsib **359 varasemat hoiatust**;
- `npm run i18n:check`: ET/EN/RU pariteet korras;
- Prisma `validate` ja `generate`: korras;
- `npm run db:migrate:check`: kõik **88 migratsiooni** rakendusid puhtasse ajutisse PostgreSQL andmebaasi, skeem oli ajakohane ja proovibaas eemaldati;
- `npm run build`: Next 16.2 Turbopack build läbis ning `/minu-jagamised` ja U12/U3 API marsruudid on route-loendis;
- production-runtime smoke: `/minu-jagamised` → 200; autentimata koond-GET, otsene PATCH ja vigase JSON-kehaga correction-POST → 401 JSON enne objekti või keha töötlemist;
- Playwright CLI kontroll: 1440 px ja 390 px vaates jäi toimingu viga dialoogi sisse, korduskatse oli alles, nurjunud järelvärskendus säilitas ledgeri ning järgmine dialoog ei pärinud vana teadet. API vastused mock'iti ainult nende kahe deterministliku UI veaoleku esilekutsumiseks;
- `git diff --check`: puhas.

### Värava hetkeseis

F1, F2, U1 ja U2 on Soli harul parandatud ning lokaalselt täielikult kontrollitud. Haru ei ühendata, rebase'ita ega deploy'ta. Järgmine lubatud samm on selle parandusringi commit ja push samale `codex/u12-u3-trust-package` harule, seejärel uus sõltumatu U12+U3 järelkontroll. Main-i ühendamise otsus jääb selle järelkontrolli taha.
