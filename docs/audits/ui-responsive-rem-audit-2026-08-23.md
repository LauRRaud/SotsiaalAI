# SotsiaalAI UI responsiivsuse, skaleeruvuse ja CSS-mõõtühikute koodipõhine süvaaudit

Kuupäev: 2026-08-23

Algne ulatus: staatiline koodiaudit. 2026-08-23 järgnenud parandusetapis muudeti rakenduse koodi leidude `UI-RESP-01`–`UI-RESP-10` ulatuses; `UI-RESP-11` kujundusprogramm jäi järgmisse etappi.

Runtime: `not_run`

Automaattestid: `not_run` — neid ei loodud ega käivitatud vastavalt ülesandele ja `AGENTS.md`-le

Parandusetapi staatilised väravad: `eslint` **DONE**, `i18n:check` **DONE**, tootmisbuild **DONE**, `git diff --check` **DONE**. Brauseri-, zoom'i-, klaviatuuri- ja abitehnoloogia runtime jääb `NOT_PROVEN`.

## 1. Lühijäreldus

Auditi algseisus kasutas SotsiaalAI `rem`-i arvuliselt palju, kuid mitte piisavalt süsteemselt: `rem` oli ankurdatud kõva `16px` juurväärtuse külge, puutesihtidel puudus ühine 44 CSS-piksli miinimum, kitsas paneel ei käivitanud enamiku komponentide viewport-breakpoint'e ning mobiilse vestluskomposeri kihistusleping oli katki. Parandusetapp viis juurfondi `100%`-põhiseks, lisas skaleeruva puutesihi tokeni, embedded-pindade container query'd ja vestluse nimelise sibling-layer lepingu. Nende runtime-maatriks ei ole siiski käivitatud.

Responsiivsusvõlale lisandub eraldi kujundusvõlg. 22.08 kujundamata vaadete audit loetleb 30 lõpetamata kasutajavaadet: 18 vaates puudub või killustub terviklik sisupind ja 12 vaates on väline klaaspind olemas, kuid töövoo sisemine kompositsioon on kujundamata (`C:/Users/rauds/Desktop/SotsiaalAI/docs/audits/kujundamata-lehed-2026-08-22.md:28-75`). See ei ole üksnes visuaalne kõrvalteema: ilma ühise lehe-, sektsiooni-, loendi- ja vormipaigutuse lepinguta ei saa nende vaadete reflow'd, suure teksti taluvust ega konteineripõhist käitumist süsteemselt tagada. Uut kujundust ei tohi ehitada 30 eraldiseisva kohaliku CSS-süsteemina; see peab kasutama platvormi olemasolevaid komponente ja primitiive ning puuduv primitiiv tuleb esmalt lõpetada ühises kihis.

Kõige raskem algne leid oli `UI-RESP-01`: mobiilseks liigitatud vaates muutus komposer absoluutseks, kuid tema ees olev sõnumiala sai samas isoleeritud stacking context'is `z-index: 1`. Komposeri `z-index` jäi `auto`; ainult `+`-nupu ümbris oli `z-index: 2`. Parandus määrab nüüd samas isoleeritud komponendis backdrop/content/composer/floating/overlay/modal kihid ja asetab komposeri sisukihist ette (`app/styles/chat.css:77-102`).

Peamine algne probleem ei olnud „px versus rem”, vaid ühiste paigutuslepingute puudumine:

- viewport'i ja komponendi tegeliku laiuse eristamine;
- sibling-kihtide nimeline järjestus isoleeritud komponentides;
- dünaamilise kõrguse, mobiiliklaviatuuri ja safe-area ühine block-size leping;
- skaleeruva puutesihi miinimum;
- modaali fookuse, sulgemise ja kerimise ühine primitiiv;
- lõpetamata vaadete ühine lehe-, sektsiooni-, loendi-, vormi- ja tühiseisundiprimitivide leping;
- 200% suumi korral reflow, mitte globaalse `overflow-x: clip`-iga peitmine.

Audit ei ole täielik visuaalne ega runtime-tõend. Brausereid, 200% suumi, abitehnoloogiaid, virtuaalklaviatuuri ega kõiki in-app paneelisuurusi selles töös ei käivitatud.

## 2. Tõendipiir, lähtepunkt ja seis

### 2.1 Loetud juhised ja tooteleping

Enne auditit loeti täielikult tööpuu `AGENTS.md` ning `docs/platvormi arendus/SotsiaalAI.md` failist S1.0, S11, S2, S3 ja S9 asjakohased osad. Tooteleping ütleb, et komposeri tekstiväli on alati nähtav ning mikrofon on selle kõrval lisavõimalus (`docs/platvormi arendus/SotsiaalAI.md:1957-1963`). S9 väidab, et ekraanilugeja ja klaviatuurinavigatsioon on arvesse võetud (`docs/platvormi arendus/SotsiaalAI.md:2874-2877`).

### 2.2 Giti algseis

Audit algas järgmise mõõdetud seisuga:

| Mõõde | Tulemus |
|---|---|
| Kohalik HEAD | `bdaa8afda3e05a993b3ddea6ff2078ee894ebfa8` |
| Haru | `codex/rag-source-panel-keyboard-20260823` |
| Kohalik `origin/main` | `bdaa8afda3e05a993b3ddea6ff2078ee894ebfa8` |
| Kaugserveri `refs/heads/main` (`git ls-remote`) | `bdaa8afda3e05a993b3ddea6ff2078ee894ebfa8` |
| Tööpuu | alguses puhas |

Auditi kirjutamise eel ilmus tööpuusse kõrvalise sessiooni muudatus `lib/chat/messageMarkdown.js`. See ei pärine auditist, ei kattunud raportifailiga ja jäeti puutumata. Seejärel liikusid HEAD, kohalik `origin/main` ja kaugserveri `main` välise commit'iga `429469dd32236027e9073ca07b4b15c683b2fa14` peale (`fix(chat): keep spaced markdown items in one ordered list`). Vana ja selle lähtepunkti vahel muutusid ainult `lib/chat/messageMarkdown.js` ja `lib/chat/questionPlanner.js`; ükski auditeeritud UI-, CSS- ega paigutusfail ei muutunud. Lõppkontrolli ajal liikusid kõik kolm viidet veel kord SHA-le `d7c35346f96a5f835d03643c1b97bdea75b4ce50`. Vahemikus `429469dd..d7c35346` muutusid ainult `lib/chat/openaiRuntime.js`, `lib/chat/promptBuilder.js`, `lib/openaiUsage.js` ja `lib/rag/riskPolicy.js`; ka selles vahemikus ei muutunud ükski auditeeritud UI-, CSS- ega paigutusfail. Raport kontrolliti lõplikult SHA `d7c35346f96a5f835d03643c1b97bdea75b4ce50` vastu ning tööpuu ainus muudatus oli käesolev uus raport.

Parandusetapp rebase'iti enne lõppväravat värskele `origin/main`-i lähte-SHA-le `fa39422f6ce5dbdb9a79f554623347641f57e290`. Upstream'i häälerežiimi muudatused puudutasid muu hulgas `app/styles/voice-mode.css` ja `SotsiaalAI.md`, kuid rakendusid konfliktita: upstream'i avatari grid'i/olekuülekate ja tootmisseis jäid alles, käesolev töö lisas nende kõrvale chat'i z-kihilepingu ning UI-seisu. Lõplikud staatilised väravad käivitati rebase'itud muutumatu koodipuu peal.

### 2.3 Seisumärgendite tähendus

Selles raportis kirjeldab **tõendiseis** algse leiu tõendatuse astet:

- `DONE` — veaahel või omadus on staatilisest koodist lõpuni tõendatud;
- `PARTIAL` — risk ja seda tekitav kood on tõendatud, kuid nähtava mõju ulatus vajab runtime'i;
- `NOT_PROVEN` — järeldus vajab brauseri, seadme või abitehnoloogia runtime-tõendit.

Paranduse valmidust kannab eraldi **paranduse seis**. `DONE` tähendab siin, et leiu kirjeldatud kooditee on muudetud ja staatilised väravad läbitud; see ei muuda brauseri runtime'i automaatselt tõendatuks.

### 2.4 Auditi ulatus

`app/styles/globals.css:6-38` impordib platvormi globaalse stiilikihi. Inventuur hõlmas kõiki `app` ja `components` all leitud 46 CSS/SCSS faili ning responsiivsust mõjutavaid Reacti komponente. Mõõtühikute arvud on kommentaaridest puhastatud lähtekoodi leksikaalsed esinemised, mitte brauseri computed-style väärtused. Üks deklaratsioon võib sisaldada sama ühikut mitu korda.

Kasutaja viidatud `C:/Users/rauds/Desktop/SotsiaalAI/docs/audits/kujundamata-lehed-2026-08-22.md` loeti tõendiallikana, mitte tegevusjuhisena. Selle 30 vaate loend ühendab 22.08 `LIVE`, `KUVA` ja `KOOD` tõendeid; käesolev audit ei korranud neid runtime-vaatlusi. Seetõttu on kujundusvõla olemasolu ja koodiahel staatiliselt tõendatud, kuid loendi täielik praegune runtime-katvus jääb `NOT_PROVEN`.

## 3. Leidude koond

| ID | Raskus | Tõendiseis | Paranduse seis | Lühinimi |
|---|---:|---|---|---|
| UI-RESP-01 | P0 | DONE | DONE | Mobiilse vestluskomposeri ees on sõnumiala klikikiht |
| UI-RESP-02 | P1 | DONE | DONE | `rem`-süsteemi juur on kõva `16px` ja eirab brauseri baasfondieelistust |
| UI-RESP-03 | P1 | DONE | DONE | Embedded-komponendid reageerivad valdavalt viewport'ile, mitte oma konteinerile |
| UI-RESP-04 | P1 | PARTIAL | DONE | Login võib madalas aknas, suure tekstiga või klaviatuuri ajal sisu ära lõigata |
| UI-RESP-05 | P1 | DONE | DONE | Puutesihtide miinimum pole süsteemne ja mitu aktiivset kontrolli jääb alla 44 × 44 |
| UI-RESP-06 | P1 | PARTIAL | DONE | Dünaamiline viewport, virtuaalklaviatuur ja alumine safe-area on lahendatud peamiselt ainult vestluses |
| UI-RESP-07 | P1 | DONE | DONE | `GlassModal` ei täida klaviatuuri- ega modaali sulgemislepingut |
| UI-RESP-08 | P1 | DONE | DONE | Dokumendimustandi pealkirja- ja sisuväljal puudub programmiline silt |
| UI-RESP-09 | P1 | PARTIAL | DONE | 200% reflow vigu võib `overflow-x: clip` varjata ning kaardisisu võib lõikuda |
| UI-RESP-10 | P2 | PARTIAL | DONE | Kihid ja overlay'd kasutavad osaliselt ühiseid tokeneid, osaliselt lokaalseid maagilisi tasemeid |
| UI-RESP-11 | P1 | PARTIAL | PARTIAL | 30 lõpetamata vaadet ei ole seotud tervikliku jagatud lehe- ja sisukompositsiooni lepinguga |

## 4. Üksikasjalikud leiud

### UI-RESP-01 — mobiilse vestluskomposeri ees on sõnumiala klikikiht

- **Raskus / seis:** `P0` / `DONE`.
- **Kasutajale nähtav mõju:** väikese in-app akna või mobiilseks liigitatud vaate korral on tekstiväli, mikrofon ja häälvestluse nupp nähtavad, kuid ei saa klikki ega puudet. Põhifunktsioon — vestluse alustamine või jätkamine — muutub kasutamatuks. Ainult `+` töötab.
- **Täpsed failid ja read:** `components/alalehed/chat/ChatBodyView.jsx:138-193`, `components/alalehed/chat/ConversationView.jsx:226-256`, `components/alalehed/chat/ChatComposer.jsx:729-739`, `components/alalehed/chat/chatLayoutVars.js:185-202`, `app/styles/chat.css:30-41`, `app/styles/chat.css:161-181`, `app/styles/chat.css:766-780`, `app/styles/voice-mode.css:83-96`, `app/styles/chat.css:1681-1723`.
- **Veaahel:** `[data-chat-container]` on flex-konteiner, mille `main` täidab vaba ruumi (`chat.css:30-41`). `ChatBodyView` renderdab `ConversationView`-st tuleva `main`-i enne `ChatComposer`-it (`ChatBodyView.jsx:189-193`). Mobiilivaates viib `ChatComposer` vormi voost välja `position: absolute` abil, kuid ei määra `z-index`-it (`ChatComposer.jsx:729-739`). Kogu vestluskonteiner loob `isolation: isolate` abil kohaliku stacking context'i (`chat.css:766-780`). Globaalselt imporditud `voice-mode.css` tõstab iga `[data-chat-container] > main` elemendi `z-index: 1` tasemele, sõltumata sellest, kas häältaust on aktiivne (`voice-mode.css:83-96`). Vorm jääb `z-index: auto` tasemele ja tema kattuv osa maalitakse `main`-i alla. `#chat-window-scroll` täidab `main`-i ning saab pointer-hit'i. Vormi esimene laps — `+` ümbris — on eraldi positsioneeritud ja `z-index: 2` (`chat.css:174-181`), mistõttu ainult see pääseb `main`-ist ette.
- **Mõjutatud tingimus:** `detectMobileViewport()` tagastab tõese viewport'i laiusega kuni 768 px ning ka coarse-pointer püstise vaate korral kuni 1024 px (`chatLayoutVars.js:185-202`). CSS-i reserv peegeldab sama tingimust (`chat.css:1681-1688`), kuid mobiili visuaalreeglite teine plokk kehtib ainult kuni 768 px (`chat.css:1692-1723`). Kõrgus ei ole mobiilirežiimi värav; madal kõrgus teeb vea eriti ilmseks. Kasutaja esitatud runtime-mõõt 639 × 486 sobib täpselt sellesse harusse. Runtime'i ulatust ei korratud selles auditis.
- **Parandussuund:** defineerida vestluskonteineri nimeline sibling-kihtide leping, näiteks backdrop 0, message-scroll 1, composer 2, lokaalsed popover'id 3 ja portaalid globaalses overlay-kihis. Rakendada see konteineri otsestele lastele ning siduda `main`-i tõstmine häältausta tegeliku olekuga. Komposeri kõrgem `z-index` on vajalik, kuid üksi ei ole piisav arhitektuur: reegel peab katma ka notice'id, allikapaneeli, tööriistamenüü ja tulevased sibling-overlay'd.
- **Ulatus:** vajab ühist vestluse paigutus- ja kihistuslepingut, mitte ainult lokaalset ühe rea parandust.
- **Runtime piir:** kasutaja esitatud juhtum toetab staatilist ahelat; sõltumatud brauseri hit-test'id on `NOT_PROVEN`.
- **Paranduse seis (2026-08-23):** `DONE` koodis. `[data-chat-container]` kannab nüüd kohalikke nimega kihte ning otsene komposer on `content`-kihist kõrgemal (`app/styles/chat.css:77-102`); voice-overlay ja allikad kasutavad sama lepingut (`app/styles/voice-mode.css:15`, `app/styles/chat.css:1768-1780`). 639 × 486 sõltumatu hit-test on `NOT_PROVEN`.

### UI-RESP-02 — `rem`-süsteemi juur on kõva `16px`

- **Raskus / seis:** `P1` / `DONE`.
- **Kasutajale nähtav mõju:** rakendus skaleerub oma sisemise tekstisuuruse seadega ja brauseri zoom'iga, kuid brauseri kasutaja muudetud baasfondisuurus ei saa olla `rem`-i loomulik alus. Suur osa `rem`-põhisest süsteemist on seetõttu endiselt kaudselt pikslitesse lukustatud.
- **Täpsed failid ja read:** `app/styles/tokens.css:20-23`, `app/styles/base.css:14-18`, `components/accessibility/AccessibilityProvider.jsx:77-90`, `components/accessibility/AccessibilityProvider.jsx:225-240`, `app/layout.js:30-85`, `app/layout.js:264-271`.
- **Veaahel:** `--base-rem: 16px` ning `html { font-size: calc(var(--base-rem) * var(--ui-scale)) }` asendavad brauseri loomuliku `100%` juurfondi. Rakenduse tekstiskaala (`0.9375`, `1`, `1.125`, `1.25`) korrutatakse ekraaniprofiiliga (`1`, `1.18`, `1.25`), mistõttu võimalik maksimum on 1.5625 ehk 25 px juur. See on sisemine skaleerimine, mitte kasutaja brauseri baasfondieelistuse austamine. Positiivne kontroll: viewport ei määra `maximum-scale` ega `user-scalable=no`; brauseri zoom'i pole koodis keelatud (`layout.js:264-271`).
- **Mõjutatud tingimus:** kasutaja, kes on brauseri vaikefondi muutnud; rakenduse `lg`/`xl` tekstiskaala koos `mac`/`lg` profiiliga; 200% zoom, kus fikseeritud px-laed ei kasva koos `rem`-sisuga.
- **Parandussuund:** kasutada juurel `100%`-põhist alust ja rakendada tooteskaala sellele korrutisena, näiteks `font-size: calc(100% * var(--ui-scale))`. Eraldada semantiliselt tekstiskaala ja ekraanitihedus, et mõlemat ei rakendataks tahtmatult kogu geomeetriale topelt. Kontrollida pärast muudatust kõik px-laega modaalid ja breakpoint'id.
- **Ulatus:** ühine disainitokeni ja skaleerimisleping.
- **Paranduse seis (2026-08-23):** `DONE` koodis. `--base-rem` on `1rem`, juurfont `100% × --ui-scale` ning teksti- ja ekraaniprofiil on eraldi tokenid (`app/styles/tokens.css:24-28`, `app/styles/base.css:19`, `app/layout.js:60-64`, `components/accessibility/AccessibilityProvider.jsx:243-246`). Brauseri muudetud baasfondi maatriks on `NOT_PROVEN`.

### UI-RESP-03 — embedded-komponendid reageerivad viewport'ile, mitte oma konteinerile

- **Raskus / seis:** `P1` / `DONE`.
- **Kasutajale nähtav mõju:** laias brauseris asuv kitsas in-app paneel võib säilitada kaheveerulise või horisontaalse desktop-paigutuse, kuigi komponendil endal pole selleks ruumi. Sisendid, filtrid, kaardid ja tegevusnupud võivad lõikuda või minna horisontaalselt kättesaamatuks.
- **Täpsed failid ja read:** `app/styles/workspace.css:245-260`, `app/styles/workspace.css:992-998`, `app/styles/workspace.css:1026-1075`, `app/styles/workspace.css:1575-1607`, `components/sharings/MySharingsPage.module.css:206-219`, `components/mentoring/MentoringPage.module.css:257-270`, `components/supervision/SupervisionPage.module.css:372-390`, `components/reflection/ReflectionPage.module.css:214-217`, `app/styles/covision-workspace.css:274-298`, `app/styles/completed-cases.css:812-838`, `app/styles/effective-practices.css:823-833`.
- **Veaahel:** inventuuris on 102 `@media` ja ainult 3 tegelikku `@container` päringut. `cqw`/`cqh` kasutust pole. Töölaua grid püsib kahes veerus, kuni kogu viewport langeb alla 768 px. Teenusekaardi väljade plokk nõuab `min-width: 24.5rem` ja kahe veeru miinimumid 13rem + 11rem, kuid läheb üheveeruliseks ainult viewport'i 768 px juures. Seega võib näiteks 360–500 px laiune embedded-paneel eksisteerida 1200 px viewport'is desktop-reeglitega. Sama muster kordub jagamistes, mentorluses, supervisioonis, refleksioonis ja kovisiooni tööruumis.
- **Mõjutatud tingimus:** in-app paneel, split view, külgpaneel, kitsas modaal või töölaud laias brauseris; suur tekstiskaala, mis kasvatab `rem`-miinimumid enne viewport-breakpoint'i; 200% zoom koos lokaalse paneeliga.
- **Parandussuund:** anda embedded-pinna juurele `container-type: inline-size` ja nimeline konteiner; viia komponendi sisemised veeru-, header'i-, filter- ja action-breakpoint'id `@container` päringuteks. Viewport-media peab jääma ainult rakenduse shell'i, safe-area, sisendseadme ja päriselt viewport'ist sõltuvate otsuste jaoks. Head olemasolevad eeskujud on `.cvs` (`app/styles/covision.css:19-26`, `:715-728`) ja `.ts-shell` (`app/styles/teemaseeme.css:25-31`, `:741-753`, `:1047-1059`). `carousel.css:544` deklareerib konteineri, kuid ei kasuta ühtegi `@container` päringut.
- **Ulatus:** ühine embedded-layout'i leping; rakendamine moodulite kaupa.
- **Paranduse seis (2026-08-23):** `DONE` auditeeritud pindadel. Container-root ja reflow-query'd lisati workspace'i/teenusekaardi, jagamiste, mentorluse, supervisiooni, refleksiooni, kovisiooni, lõpetatud juhtumite ning praktikate pindadele (`app/styles/workspace.css:17,1005-1010,1595-1688`; `components/sharings/MySharingsPage.module.css:10,222-234`; `app/styles/covision-workspace.css:24,286-310`). Kitsaste embedded-paneelide brauserimaatriks on `NOT_PROVEN`.

### UI-RESP-04 — login võib madalas aknas või suure tekstiga sisu lõigata

- **Raskus / seis:** `P1` / `PARTIAL`.
- **Kasutajale nähtav mõju:** PIN-klahvistiku veerud, saatmisnupp, OTP tegevused või veateade võivad madalas aknas, suure tekstiskaalaga või mobiiliklaviatuuri ajal modaalist välja jääda. Sisselogimine võib muutuda lõpetamatuks.
- **Täpsed failid ja read:** `app/styles/login.css:30-73`, `app/styles/login.css:179-207`, `app/styles/login.css:452-520`, `app/styles/login.css:548-560`, `components/accessibility/AccessibilityProvider.jsx:77-90`.
- **Veaahel:** `.login-modal-shell` piirab kõrguse `min(92lvh, 40rem)`-iga ja kasutab `overflow: hidden`. Vormi ega shell'i sees pole üldist vertikaalset scroll-konteinerit. Klahvistik on `repeat(3, max-content)` ning selle nupud ja vahed kasvavad `rem`/`vh` kaudu. Väikese viewport'i reegel piirab laiuse `min(94vw, 400px)`-ga, kuid ei lahenda kõrgust ega virtuaalklaviatuuri. Kommentaar `login.css:548-552` väidab, et kaart kasutab `container-type: size` ning `cqh/cqw` ühikuid; tegelikus lähtekoodis pole ühtegi neist. Maksimaalse 1.5625 UI-skaala korral kasvavad klahvid, tekst ja vahed, kuid 400/`lvh` piir ning `overflow: hidden` ei kasva sama lepinguga.
- **Mõjutatud tingimus:** madal in-app aken, maastikutelefon, Windowsi suur tekst/DPI, rakenduse `xl` tekst + suur profiil, e-posti või OTP virtuaalklaviatuur.
- **Parandussuund:** teha shell'i block-size dünaamilise viewport'i järgi (`dvh`/visual viewport fallback), anda sisule toimiv `overflow-y: auto` ja `min-height: 0`, säilitada sulgemis- ja põhitegevusnupp kättesaadavana ning kasutada päriselt suuruskonteinerit, kui geomeetria peab sõltuma kaardist. Eemaldada või parandada väär cqh-kommentaar.
- **Ulatus:** lokaalne loginiparandus koos ühise modaali block-size lepinguga.
- **Runtime piir:** täpne lõikumise hetk ja mobiiliklaviatuuri käitumine on `NOT_PROVEN`.
- **Paranduse seis (2026-08-23):** `DONE` koodis. Login kasutab ühist dünaamilist saadaolevat kõrgust, sisemist vertikaalkerimist ja madala akna tsentreerimist (`app/styles/login.css:53-60,555-559`); väär cqh-kommentaar eemaldati. Klaviatuuri tegelik occlusion on `NOT_PROVEN`.

### UI-RESP-05 — puutesihtide miinimum pole süsteemne

- **Raskus / seis:** `P1` / `DONE`.
- **Kasutajale nähtav mõju:** olulisi ikoonnuppe on raske puudutada, eriti liikumis-, nägemis- või täpsuspiiranguga kasutajal. Väike in-app paneel ei paranda seda; mõned juhtelemendid on alla soovitusliku 44 × 44 CSS-piksli ka siis, kui ümber on vaba ruumi.
- **Täpsed failid ja read:** `app/styles/chat.css:174-203`, `app/styles/chat.css:1076-1102`, `app/styles/chat.css:1310-1339`, `app/styles/chat.css:1432-1447`, `app/styles/glass.css:360-383`, `app/styles/workspace.css:71-98`, `app/styles/login.css:421-447`, `app/styles/glass.css:61-76`, `app/styles/field.css:108`, `app/styles/pwa-install.css:1-10`.
- **Veaahel:** komposeri `+` baasmõõt on 2.35rem ehk vaikejuurel 37.6 px; vestluse `+`, mikrofon ja saatmisnupp on 2.5rem ehk 40 px; assistendi tegevusnupud 2rem ehk 32 px; ühine `.glass-iconbtn` 2.6rem ehk 41.6 px; admini S/P/T lüliti nupud 1.85rem ehk 29.6 px; login-abi sulgemisnupp 1.7rem ehk 27.2 px. Samal ajal tõendab input-baas ise, et 44 px puutesiht on teadlik eesmärk (`glass.css:70-75`), ning mõnes väljas/PWA-kontrollis kasutatakse 44–56 px miinimume.
- **Mõjutatud tingimus:** touch/coarse pointer, ühe käega kasutus, väike paneel, motoorikapiirang. Suur rakendusesisene tekstiskaala kasvatab osa `rem`-sihtidest, kuid vaikeoleku puudujääki see ei kõrvalda.
- **Parandussuund:** lisada jagatud `--hit-target-min: 2.75rem` või samaväärne token ning rakendada `min-inline-size`/`min-block-size`, mitte kõigile jäik width/height. Visuaalne glüüf võib jääda väiksemaks; tabamisala peab kasvama. Erandid peavad olema põhjendatud ja saama spacing-erandi.
- **Ulatus:** ühine disainitoken ja juhtkomponentide leping.
- **Paranduse seis (2026-08-23):** `DONE` auditis nimetatud kontrollidel. Ühine miinimum on `--hit-target-min:2.75rem` (`app/styles/tokens.css:28`) ning see rakendub ühistele klaas-/variandinuppudele, chat'i tegevustele, admin-rollivahetile ja login-abi sulgemisele (`app/styles/glass.css:363-382`; `app/styles/chat.css:209-216,354-372`; `app/styles/workspace.css:95-102`; `app/styles/login.css:429-436`). Puuteseadme käsitsi kontroll on `NOT_PROVEN`.

### UI-RESP-06 — dünaamiline viewport ja mobiiliklaviatuur on lahendatud peamiselt ainult vestluses

- **Raskus / seis:** `P1` / `PARTIAL`.
- **Kasutajale nähtav mõju:** mobiiliklaviatuur võib katta fookuses sisendi järel olevad tegevused, alumise doki või modaali põhja. Paneel võib jätkata `lvh` kõrguses ajal, mil tegelik nähtav viewport on klaviatuuri tõttu oluliselt väiksem.
- **Täpsed failid ja read:** `app/styles/panel.css:17-24`, `app/styles/panel.css:167-196`, `app/styles/panel.css:1040-1086`, `app/styles/chat.css:43-79`, `components/alalehed/ChatBody.jsx:685-1021`, `app/styles/login.css:51-61`, `app/styles/glass.css:398-418`, `app/styles/chat.css:1736-1758`.
- **Veaahel:** kommentaaridest puhastatud CSS-is on 74 `lvh`, 10 `dvh` ja 1 `svh` kasutust. Vestlus arvutab `100lvh - 100dvh`, kasutab safe-area bottom'it ning `VisualViewport`-i; see on sihipärane erand. Üldpaneelid lähevad mobiilis `height: 100lvh` peale, login `92lvh` peale ja allikapaneel kasutab `84vh`; neil pole sama klaviatuurilepingut. `panel-body` kerib ja `min-height: 0` on hea kaitse, kuid see ei tõenda, et fookuses väli ning selle submit jäävad virtual keyboard'i kohal nähtavaks. Safe-area kasutus on tugev ruumi/doki pindadel, kuid pole ühtne kõigi fixed-overlay'de alumise ääre leping.
- **Mõjutatud tingimus:** iOS/Android brauseririba, ekraaniklaviatuur, landscape, PWA `viewport-fit: cover`, lühike viewport.
- **Parandussuund:** luua ühine `--app-dynamic-block-size`/`--overlay-available-block-size` leping `dvh` + fallback'iga; anda vormimodaalidele sisemine scroll ja safe-area padding; jätta `lvh` stseenidele, mille puhul hüppamise vältimine on teadlik nõue. Vestluse VisualViewport-loogika ei tohiks jääda kopeeritavaks erandiks, vaid olla jagatud utiliit või dokumenteeritud primitiiv.
- **Ulatus:** ühine viewport-/overlay-leping; lokaalsed tarbijad.
- **Runtime piir:** tegelik keyboard-occlusion väljaspool vestlust on `NOT_PROVEN`.
- **Paranduse seis (2026-08-23):** `DONE` ühises koodilepingus. `--app-dynamic-block-size` kasutab `dvh`-d fallback'iga ja `--overlay-available-block-size` arvestab safe-area't (`app/styles/panel.css:13-25`); paneelid ja overlay'd tarbivad neid ning viewport meta kasutab `interactive-widget=resizes-content` (`app/layout.js:265-270`). Toetamata brauserid ja päris mobiiliklaviatuur on `NOT_PROVEN`.

### UI-RESP-07 — `GlassModal` ei täida modaali klaviatuurilepingut

- **Raskus / seis:** `P1` / `DONE`.
- **Kasutajale nähtav mõju:** klaviatuuri- või ekraanilugejakasutaja fookus võib liikuda modaali taha, sulgemiseks puudub nähtav/fookustatav nupp ning sulgemise järel ei taastata fookust avajale. Puutekasutajal on väljaklikk, klaviatuuril Escape, kuid sisendviiside pariteet pole täielik.
- **Täpsed failid ja read:** `components/glass/GlassModal.jsx:13-50`, `components/room/RoomStage.jsx:1853-1876`, `components/ui/Modal.jsx:46-70`, `components/ui/Modal.jsx:81-138`.
- **Veaahel:** `GlassModal` fokuseerib dialoogi shell'i ja kuulab globaalselt Escape'i, kuid ei kogu fookustatavaid elemente, ei trap'i Tab-klahvi, ei muuda tausta inertseks, ei lukusta taustakerimist ega taasta avaja fookust. Komponendis pole sulgemisnuppu; kommentaar viitab välisele tagasi-noolele, kuid modaali enda semantiline `aria-modal=true` leping ei tohi sõltuda taustal olevast juhtnupust. Seda kasutatakse kontakti ja PWA paigalduskaardi jaoks. Repos olev `components/ui/Modal.jsx` juba tõendab korrektsema fookuse sisseviimise, trap'i ja taastamise mustrit.
- **Mõjutatud tingimus:** Tab/Shift+Tab, ekraanilugeja, switch control, suurendusega kasutaja, kes ei näe läbipaistva overlay serva väljaklikiks.
- **Parandussuund:** ühendada `GlassModal` ühise modaali käitumisprimitiiviga, säilitades visuaalse shell'i. Lisada nähtav ja programmiline sulgemisnupp, fookusetrap, inert/background lock, opener-focus restore ja scroll lock.
- **Ulatus:** ühine modaali käitumisleping; visuaalne CSS võib jääda lokaalseks.
- **Paranduse seis (2026-08-23):** `DONE` koodis. `GlassModal` komponeerib nüüd ühist `Modal`-i ja nähtavat `IconButton` sulgemist (`components/glass/GlassModal.jsx:20-37`, `app/styles/glass.css:477-482`); ühine primitiiv trap'ib Tab-i, taastab avaja fookuse, muudab tausta inertseks ja lukustab body kerimise (`components/ui/Modal.jsx:44-103,113-168`). Klaviatuuri ja ekraanilugeja runtime on `NOT_PROVEN`.

### UI-RESP-08 — dokumendimustandi väljad on programmilise sildita

- **Raskus / seis:** `P1` / `DONE`.
- **Kasutajale nähtav mõju:** ekraanilugeja või häälsisestus ei saa usaldusväärselt eristada dokumendimustandi pealkirja ja sisu välja. Klaviatuuriga saab väljadele liikuda, kuid nende eesmärk pole programmiliselt nimetatud.
- **Täpsed failid ja read:** `components/documents/ArtifactDetailPage.jsx:232-244`, `components/ui/Input.jsx:31-54`, `components/ui/Textarea.jsx:1-10`.
- **Veaahel:** draft-vaates renderdatakse `Input` ainult placeholder'iga ja selle järel paljas `textarea`. Neid ei ümbritse `label`, neil pole `id`/`htmlFor`, `aria-label` ega `aria-labelledby`. Ühised `Input` ja `Textarea` komponendid kannavad atribuudid läbi, kuid ei nõua accessible name'i.
- **Mõjutatud tingimus:** screen reader, voice control, vormivigade navigeerimine; visuaalselt ei pruugi viga olla nähtav.
- **Parandussuund:** lisada nähtavad või põhjendatult `sr-only` sildid ning kirjeldused; luua vormivälja wrapper, mis seob label'i, vea ja character limit'i ID-dega. Placeholder ei asenda label'it. Staatiline lint/komponendileping võiks tulevikus nime puudumise kinni püüda, kuid käesolev audit ei lisa teste.
- **Ulatus:** lokaalne parandus, soovitatavalt ühise vormivälja lepinguga.
- **Paranduse seis (2026-08-23):** `DONE`. Mustand kasutab nüüd ühiseid `Input` ja `Textarea` primitiive, nähtavaid `label`-eid, stabiilseid ID-sid ning ühist kirjeldust (`components/documents/ArtifactDetailPage.jsx:239-263`); `content_label` lisati kõigisse keelekataloogidesse. Ekraanilugeja runtime on `NOT_PROVEN`.

### UI-RESP-09 — 200% reflow vigu võib globaalne clip varjata

- **Raskus / seis:** `P1` / `PARTIAL`.
- **Kasutajale nähtav mõju:** 200% zoom'i või väga suure teksti korral võib sisu minna ekraani serva taha ilma horisontaalse kerimisvõimaluseta. Töölaudade kaardinimed ja badge'id võivad kattuda või lõikuda.
- **Täpsed failid ja read:** `app/styles/base.css:20-32`, `app/styles/workspace.css:245-260`, `app/styles/workspace.css:275-297`, `app/styles/workspace.css:352-379`, `app/styles/workspace.css:992-998`, `app/styles/workspace.css:1057-1075`.
- **Veaahel:** `body { overflow-x: clip }` peidab dokumendi taseme horisontaalse overflow. Töölaud jääb viewport'i järgi kahte veergu; kaart kasutab `overflow: hidden`, tsentreeritud teksti ja absoluutselt paremale kinnitatud badge'i, millele pole sisus reserveeritud ruumi. Teenusekaardi väljad kannavad 24.5rem miinimumi. Kui tekst/rem kasvab või komponent ise on kitsas, võib overflow olla mitte keritav, vaid nähtamatult lõigatud.
- **Mõjutatud tingimus:** 200% browser zoom, `xl` tekstiskaala, pikemad vene/inglise sildid, 320–500 px embedded-paneel, süsteemi suurem font.
- **Parandussuund:** eemaldada globaalse clip'i roll reflow-strateegiana; lahendada overflow komponendis, lubada wrapping/`overflow-wrap:anywhere`, reserveerida badge'i ala või viia badge voogu ning lülitada grid konteineri laiuse järgi üheveeruliseks. Horisontaalne scroll peab jääma ainult semantiliselt kahemõõtmelistele pindadele.
- **Ulatus:** ühine overflow/reflow leping ja lokaalsed kaardipaigutused.
- **Runtime piir:** tegelik 200% pildistus ja horisontaalse scroll'i olemasolu on `NOT_PROVEN`.
- **Paranduse seis (2026-08-23):** `DONE` koodis. Globaalne `body` clip eemaldati (`app/styles/base.css:26-34`), horisontaalne overflow lahendatakse nüüd komponentides, workspace'i grid ja badge reageerivad konteineri laiusele ning tekst wrap'ib (`app/styles/panel.css:558-564`, `app/styles/workspace.css:291-297,1005-1010,1675-1688`). 200% visuaalne reflow jääb `NOT_PROVEN`.

### UI-RESP-10 — kihistus- ja pointer-leping on osaliselt ad hoc

- **Raskus / seis:** `P2` / `PARTIAL`.
- **Kasutajale nähtav mõju:** uue overlay, pseudoelemendi või fixed-kontrolli lisamine võib olemasoleva nupu nähtavaks jätta, kuid hit-test'i ära võtta. Vestlus on selle klassi tõendatud näide; teistes pindades on kaitsed ebaühtlased.
- **Täpsed failid ja read:** `app/styles/tokens.css:179-185`, `app/styles/voice-mode.css:7-25`, `app/styles/chat.css:1736-1758`, `app/styles/workspace.css:71-98`, `app/styles/workspace.css:1174-1187`, `app/styles/workspace.css:1319-1327`, `app/styles/a11y-modal.css:12-20`, `app/styles/panel.css:118-126`, `app/styles/chat.css:525-537`, `app/styles/glass.css:102-113`.
- **Veaahel:** ühised tokenid defineerivad tasemed 0/20/30/60/80/100, kuid aktiivsed komponendid kasutavad lisaks lokaalseid 36, 70, 90, 500 ja 510 tasemeid. Mõned dekoratiivkihid on õigesti `pointer-events: none` (paneli ja draweri pseudoelemendid, specular canvas, voice backdrop); teenusekaardi status-overlay püüab pointer'i tahtlikult. Ligipääsetavuse overlay valitakse väga laia selektoriga `div[role="presentation"][aria-hidden="true"]`, mis muudaks sama märgendikombinatsiooniga tulevase dekoratiivse div'i täisekraan-overlayks. Sama täpset sibling-inversiooni nagu vestluses teises aktiivses paneelis staatiliselt ei tõendatud.
- **Mõjutatud tingimus:** fixed/absolute sibling'id, uus overlay, portaal, kaardil või paneelil olev WebGL/canvas, tulevane aria-markup'i muudatus.
- **Parandussuund:** defineerida kihid rolli ja stacking context'i kaupa, mitte globaalse „suurema numbri” järgi; scope'ida overlay-selektorid klassile/data-atribuudile; nõuda dekoratiivkihil `pointer-events:none`; dokumenteerida, milline element loob `isolation`/transform/filter tõttu uue konteksti.
- **Ulatus:** ühine kihistusleping; lokaalsed selector-fix'id.
- **Runtime piir:** teise sama klassi aktiivse hit-test vea olemasolu on `NOT_PROVEN`.
- **Paranduse seis (2026-08-23):** `DONE` auditis tuvastatud riskidel. Globaalsed overlay-rollid said tokenid (`app/styles/tokens.css:188-193`), lokaalsed chat-kihid nimega lepingu, ligipääsetavuse overlay selektor scobiti `.a11f-veil` klassile (`app/styles/a11y-modal.css:13`) ning Leafleti 500/510 tasemed dokumenteeriti kohaliku kaardiskaalana (`app/styles/workspace.css:1192,1340`). Muude tulevaste/avastamata overlay'de runtime jääb `NOT_PROVEN`.

### UI-RESP-11 — lõpetamata vaated ei kasuta terviklikku jagatud kompositsioonilepingut

- **Raskus / seis:** `P1` / `PARTIAL`.
- **Kasutajale nähtav mõju:** paljud põhivood näivad lõpetamata: sisu seisab mustal taustal või ühes pikas toorvoos, tööetapid, olekud ja põhitegevused ei moodusta arusaadavat hierarhiat ning sama tüüpi vorm või loend käitub eri lehtedel erinevalt. Kitsas paneel, suur tekst ja 200% zoom muudavad selle võla suuremaks, sest puudu pole ainult ilme, vaid ka ühine wrap'i, veergude, scroll'i, tühiseisundi ja tegevusriba leping.
- **Täpsed failid ja read:** `C:/Users/rauds/Desktop/SotsiaalAI/docs/audits/kujundamata-lehed-2026-08-22.md:28-75`, `components/workspace/WorkspaceFeaturePage.jsx:12-22`, `components/workspace/WorkspaceFeaturePage.jsx:61-65`, `components/workspace/WorkspaceFeaturePage.jsx:174-197`, `components/chat/WorkspacePanel.jsx:564-650`, `components/room/PanelFrame.jsx:152-166`, `components/wellbeing/WellbeingPage.jsx:91-170`, `components/ui/glassPageStyles.js:3-53`, `components/ui/SubpageHeader.jsx:214-239`, `components/ui/Button.jsx:7-69`, `components/ui/Input.jsx:31-55`, `components/ui/Form.jsx:38-87`, `components/glass/GlassSurface.jsx:9-28`, `app/styles/glass.css:7-36`.
- **Veaahel:** `PanelFrame` annab välise paneeli ja scroll-body, `WorkspacePanel` lisab alamlehe päise ning renderdab selle sees dokumendid, materjalid või `WorkspaceFeaturePage`-i. See ei anna funktsioonisisule sektsiooni- ega töövoopaigutust. `WorkspaceFeaturePage` kasutab küll olemasolevaid `Button`, `Input`, `Checkbox`, `Form`, `OptionCard` ja `SubpageHeader` komponente, kuid kood ütleb otseselt, et kujundus on stripitud; paigutuse klassikonstandid on tühjad ning `SectionCard`/`ServiceProfileSection` renderdavad ainult klassita semantilise `<section>`-i. Ka `glassPageStyles.js` ekspordib peaaegu kogu lehe- ja alamlehekesta klassisõnavara tühjade stringidena, mistõttu `SubpageHeader` ei saa sealt vaikimisi paigutust. Globaalne `glass.css` suudab anda üksikule väljale või nupule ühise materjali, kuid ei loo tööetappide, sektsioonide, loendite, olekute ja tegevuste kompositsiooni. Tulemuseks võib olla tehniliselt ühise kontrolliga, kuid visuaalselt ja responsiivselt kujundamata leht.
- **Mõjutatud tingimus:** vähemalt viidatud auditi 18 puuduva/killustunud pinnaga ja 12 sisemiselt kujundamata vaadet; eriti embedded-paneel, 320–600 px komponendilaius, madal aken, pikk lokaliseeritud tekst, `lg`/`xl` tekstiskaala, puude- ja klaviatuurikasutus ning 200% zoom. Iga 30 vaate praegust runtime-seisu selles auditis ei korratud.
- **Parandussuund:** alustada mitte lehekaupa dekoratiiv-CSS-ist, vaid olemasoleva primitiivikihi kaardistamisest ja lõpetamisest. Juhtimiseks tuleb taaskasutada `Button`, `Input`, `Textarea`, `Dropdown`, `DateField`, `Checkbox`, `OptionCard` ja `Form`; pinna ning päise jaoks `PanelFrame`, `Panel`, `GlassSurface` ja `SubpageHeader`; materjal, fookus, veaseisund ja mõõdud peavad jääma `tokens.css`/`glass.css`/`field.css` ühisesse kihti. Tühjad `glassPageStyles` lepingud ning klassita `SectionCard`/loendi-/olekumustrid tuleb lõpetada või ühendada olemasoleva jagatud komponendiga üks kord. Funktsioonilehe CSS võib juhtida ainult semantilist paigutust ja olekut; ta ei tohi dubleerida klaasimaterjali, kontrollide ilmet, fookust, puutesihti, modaali käitumist ega spacing-tokenite süsteemi.
- **Ulatus:** vajab ühist disainisüsteemi ja embedded-paigutuse lepingut, millele järgneb lokaalne migratsioon vaadete kaupa. See ei ole 30 sõltumatu lokaalse kujunduse töö.
- **Runtime piir:** 22.08 audit annab segatüüpi varasema tõendi; praeguse HEAD-i kõigi rollide ja vaadete visuaalne valmidus, primitive-adoption ning responsiivsus on `NOT_PROVEN`.
- **Paranduse seis (2026-08-23):** `PARTIAL`. Käesolev esimene parandusetapp lõpetas ühised responsiivsus-, mõõdu-, overlay- ja vormilepingud, mida 30 vaate kujundamisel tuleb kasutada, kuid nende vaadete terviklikku disainimigratsiooni ei tehtud. See on järgmine eraldi plokk; uusi lehekohaseid kontrolli- ega klaasisüsteeme ei tohi luua.

## 5. Mõõtühikute inventuur valdkondade kaupa

Arvud on CSS-kommentaaridest puhastatud lähtekoodi esinemised. `%` hõlmab ka gradientide ja transformide protsente; `px` hõlmab piire, varje, raadiusi, rasterdetaile ja breakpoint'e. Seetõttu ei võrdu suur arv automaatselt probleemiga.

| Valdkond | Faile | rem | em | px | % | fr | vw | vh | dvh | svh | lvh | cqw | cqh | clamp() | min() | max() | calc() | @media | @container |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Funktsiooni- ja adminivaated | 12 | 680 | 80 | 225 | 96 | 62 | 32 | 6 | 0 | 0 | 6 | 0 | 0 | 39 | 28 | 0 | 11 | 20 | 0 |
| Kest, vormid ja modaalid | 17 | 390 | 90 | 262 | 365 | 4 | 55 | 10 | 4 | 1 | 13 | 0 | 0 | 45 | 30 | 6 | 40 | 17 | 0 |
| Paneelid ja töölauad | 15 | 2031 | 313 | 741 | 544 | 100 | 174 | 15 | 3 | 0 | 44 | 0 | 0 | 185 | 79 | 15 | 118 | 54 | 3 |
| Vestlus ja hääl | 2 | 355 | 50 | 134 | 175 | 7 | 18 | 5 | 3 | 0 | 11 | 0 | 0 | 27 | 16 | 5 | 17 | 11 | 0 |
| **Kokku** | **46** | **3456** | **533** | **1362** | **1180** | **173** | **279** | **36** | **10** | **1** | **74** | **0** | **0** | **296** | **153** | **26** | **186** | **102** | **3** |

### 5.1 Pikslikasutuse liigitus

Kommentaaridest puhastatud koodis leiti 1089 deklaratsiooni, mis sisaldavad vähemalt ühte `px` väärtust. Neist 331 on `border`, 238 `border-radius` ja 110 `box-shadow`; ainult kaks on `font-size`, mõlemad aktiivsest rakendusest viiteta komponentides. See kinnitab, et toote aktiivne tekst ei ole üldiselt px-fontidesse lukustatud.

| Klass | Hinnang | Näited |
|---|---|---|
| Põhjendatud | täpne visuaalne/rasterdetail või teadlik puutepõrand | 1px piirid ja abijooned; map-marker'i detailid; 44/48/56px väljade ja PWA tegevuste miinimum; visuaalse intro px-clamp |
| Küsitav | väärtus võib olla sobiv, kuid vajab skaleerumislepingut | 720/760px modaali kõrguslaed, kui sisemine scroll toimib; 400px login-laiuse lagi; viewport'i 640/768/900/1120px breakpoint'id embedded-komponentides |
| Ohtlik | väärtus osaleb nähtava sisu lõikamises või skaleerumise blokeerimises | `--base-rem:16px`; login'i 400px lagi koos `overflow:hidden` ja `lvh` kõrgusega; embedded-paigutuse px-breakpoint, mis ei näe tegelikku konteinerit |

## 6. Ohtlikud kõvad pikslimõõdud

| Väärtus | Fail ja rida | Klass | Miks riskantne | Parandussuund |
|---|---|---|---|---|
| `--base-rem: 16px` | `app/styles/tokens.css:20-23`, `app/styles/base.css:14-18` | ohtlik | kõik `rem` väärtused ankurduvad rakenduse px-baasi, mitte brauseri `100%` baasi | `100% × --ui-scale`; eralda tekst ja profiil |
| `max 400px` login-shell | `app/styles/login.css:555-560` | ohtlik koos kaskaadiga | suur `rem` sisu + `overflow:hidden` + madal `lvh` võib klahvistiku/saatmise lõigata | dünaamiline block-size + sisemine scroll/container |
| `768px` ja `1120px` workspace breakpoint'id | `app/styles/workspace.css:992-998`, `:1575-1607` | ohtlik embedded-kontekstis | viewport võib olla lai, kuigi komponent on kitsas | container query |
| `768px` / `1024px` mobiilipredikaat | `components/alalehed/chat/chatLayoutVars.js:185-202`, `app/styles/chat.css:1681-1692` | ohtlik koos kihistusega | lülitab komposeri absoluutseks; CSS-i visuaalharud pole kõik sama predikaadiga | üks jagatud container/input predicate + layer contract |
| `1560 × 1100px` canvas-plane | `app/styles/workspace.css:1883-1893` | küsitav, hetkel viiteta | väga suur kahemõõtmeline pind eeldab kerimist; JSX kasutust ei leitud | enne taasaktiveerimist semantiline pan/zoom + keyboard; mitte pime rem-konversioon |
| `720/760px` modaalilaed | `app/styles/a11y-modal.css:33-55`, `app/styles/workspace.css:1794-1813` | põhjendatud kaitsega | outer cap ise pole viga, sest sisemine sisu kerib; runtime siiski kontrollimata | hoida cap, eelistada `dvh`, säilitada scroll |

## 7. Stacking context'i ja `pointer-events` riskid

| Pind | Fail ja rida | Kihistus/pointer | Hinnang |
|---|---|---|---|
| Vestlus | `chat.css:766-780`, `voice-mode.css:83-96`, `chat.css:174-181` | isolated container; `main` z1; form auto; `+` z2 | **P0 tõendatud hit-test viga** |
| Voice backdrop | `voice-mode.css:83-90` | absolute z0, `pointer-events:none` | korrektne dekoratiivkiht |
| Paneli läige | `panel.css:118-126` | absolute pseudo z1, `pointer-events:none`; body z2 | korrektne lokaalne kaitse |
| Draweri läige | `chat.css:525-537` | pseudo z1, pointer none; sisu z2 | korrektne lokaalne kaitse |
| Specular canvas | `glass.css:102-113`, `components/SpecularButton/SpecularButton.css:64-80` | väga kõrge fixed canvas või nupu fx; pointer none | hit-test'i ei püüa; z-tase vajab tokenilepingut |
| Ligipääsetavuse overlay | `a11y-modal.css:12-20`, `AccessibilityModal.jsx:687-695` | väga lai atribuudiselektor teeb fixed overlay | praegu üks teadlik kasutus; tulevane selector-collision risk |
| Teenusekaardi status | `workspace.css:1319-1327` | inset overlay z510 | pointer blokeerib kaarti tahtlikult; laadimisoleku kadumine vajab runtime'i |
| Chat sources | `chat.css:1736-1758` | body-portaal z90 | modal-tase toimib, kuid ei kasuta `--z-modal` tokenit |
| Login close | `login.css:97-117` | absolute z6 üle sibling-sisu | korrektne lokaalne parandus sama klassi varasemale kattumisele |

## 8. Hover'i, puute ja klaviatuuri pariteet

| Funktsioon | Tõend | Hiir | Puude | Klaviatuur | Hinnang |
|---|---|---|---|---|---|
| Vestluse sisend/mikrofon/hääl | `ChatComposer.jsx:817-875`; stacking ahel UI-RESP-01 | klikk on olemas, aga mobile hit-test blokeerib | blokeeritud samas alas | label ja focus on olemas, kuid pointer-viga ei kirjelda kõiki AT radu | **viga** |
| Assistendi Kuula/Kopeeri/Allikad | `chat.css:1065-1149` | hover avab | touch'il alati nähtav | `:focus-within` avab | pariteet olemas; 32px siht on liiga väike |
| Workspace-kaart | `workspace.css:309-349` | hover + click | click | `:focus-visible` + click/Enter | pariteet olemas |
| Ruumi quickbar | `RoomQuickbar.jsx:28-127`, `room.css:659-679`, `:746-750` | hover/klikk | `data-open` click; coarse siht 2.75rem | focus-within/klikk | pariteet olemas |
| Dropdown | `components/ui/Dropdown.jsx:13-26`, `:120-147` | click/pointerdown | pointer | nooled, Home/End, Enter, Space, Esc, typeahead | pariteet olemas |
| Teemaseemne/kovisiooni kaardi liigutus | `TeemaseemnedPage.jsx:983-994`, `:1120-1131`; `CovisionLiveSession.jsx:650-661` | pointer drag | pointer drag | nudge/resize `onKeyDown` | pariteet olemas |
| `GlassModal` sulgemine | `GlassModal.jsx:16-50` | overlay click/Esc | overlay tap | Esc, kuid pole close button/focus trap/restore | **viga** |
| Dokumendimustandi väljad | `ArtifactDetailPage.jsx:232-244` | visuaalne sisestus | visuaalne sisestus | tabitav, kuid accessible name puudub | **viga** |
| Ikoonnupud põhiteedel | `ChatComposer.jsx:830-867`, `ConversationDrawer.jsx:239-257`, `HinnastusBody.jsx:252-357` | click | click | native button + aria-label | kontrollitud valimis korras; süsteemne täielikkus `NOT_PROVEN` |

Koodist ei leitud aktiivsel põhiteel funktsiooni, mis oleks käivitatav ainult hover'iga. Hover-only efektid on valdavalt visuaalsed ja võtmeteedel on `:focus-visible`, `:focus-within`, click-state või coarse-pointer haru. See ei tõenda kogu rakenduse runtime-pariteeti.

## 9. Viewport-media query'd, mis peaksid tõenäoliselt olema container query'd

| Prioriteet | Praegune reegel | Fail ja rida | Miks container query |
|---:|---|---|---|
| 1 | workspace 2 → 1 veerg `max-width:768px` | `workspace.css:245-260`, `:992-998` | töölaud elab chat/panel embedded-pinnal |
| 2 | service-map 1120/768 | `workspace.css:1057-1075`, `:1575-1607` | 24.5rem min-width peab reageerima teenusekaardi enda laiusele |
| 3 | chat/voice 768/640 | `chat.css:1681-1723`, `voice-mode.css:199-225` | chat võib olla kitsas paneelis laias viewport'is; JS vaatab `window.innerWidth` |
| 4 | MySharings 760 | `MySharingsPage.module.css:206-219` | embedded tööpind ja modaal võivad olla viewport'ist kitsamad |
| 5 | Mentoring 640 | `MentoringPage.module.css:257-270` | kaardigrid ja actions sõltuvad mooduli laiusest |
| 6 | Supervision 640 | `SupervisionPage.module.css:372-390` | kaardid/manifest/actions sõltuvad mooduli laiusest |
| 7 | Reflection 640 | `ReflectionPage.module.css:214-217` | conflict-columns sõltub komponendi laiusest |
| 8 | CovisionWorkspace 980/680 | `covision-workspace.css:274-298` | tööruum on paneelisisene; viewport ei kirjelda saadaolevat ruumi |
| 9 | CompletedCases 1100/760 | `completed-cases.css:812-838` | layout/header/detail elavad tööruumi sees |
| 10 | EffectivePractices 900 | `effective-practices.css:823-833` | detail/form/context grid sõltub dialoogi/paneeli laiusest |

Viewport-media peab alles jääma päriselt seadme või viewport'i omadustele: safe-area, pointer/hover, reduced motion/contrast, PWA shell ja täisekraani stseen. Komponendi veerud, header, filtrid ja action-reflow peaksid lähtuma konteinerist.

## 10. Kümme kõige olulisemat parandust soovitatud järjekorras

2026-08-23 parandusetapis tehti järjekorra punktid 1–2 ja 4–10 koodis; punkti 3 vormi-label'i osa on tehtud, kuid `UI-RESP-11` 30 vaate ühine disainimigratsioon jääb järgmisse plokki. Käsitsi runtime-maatriks ei ole selle staatilise parandusetapi osa ja jääb `NOT_PROVEN`.

| Järk | Parandus | Katab | Lepingu tüüp |
|---:|---|---|---|
| 1 | Kehtesta chat'is backdrop/content/composer/overlay nimeline sibling-layer contract ja tõsta komposer sisualast ette | UI-RESP-01 | ühine chat layout |
| 2 | Tee login-shell dünaamilise kõrgusega, keritavaks ja klaviatuurikindlaks; eemalda vale cqh-kommentaar | UI-RESP-04, UI-RESP-06 | modal + lokaalne login |
| 3 | Lõpeta olemasolev lehe-/sektsiooni-/vormi-/loendi-/olekuprimitiivide kiht ja migreeri 30 lõpetamata vaadet selle kaudu; lisa vormilepingusse puuduvad label'id | UI-RESP-11, UI-RESP-08 | ühine disainisüsteem + lehekaupa kompositsioon |
| 4 | Loo embedded-surface container contract ja teisenda workspace/service-map breakpoint'id esimesena | UI-RESP-03, UI-RESP-09, UI-RESP-11 | ühine layout |
| 5 | Muuda juurfondi alus `100%`-põhiseks ja eralda teksti- ning ekraaniprofiili skaalad | UI-RESP-02 | disainitoken |
| 6 | Lisa 2.75rem puutesihi miinimumtoken ja rakenda see chat'i, IconButtoni, admin-role'i ning login-abi kontrollidele | UI-RESP-05 | disainitoken |
| 7 | Loo `dvh`/VisualViewport/safe-area ühine available-block-size leping vormipaneelidele ja overlay'dele | UI-RESP-06 | viewport/layout |
| 8 | Ühenda `GlassModal` ühise modaali käitumisprimitiiviga: close, trap, inert, scroll lock, focus restore | UI-RESP-07 | modal behavior |
| 9 | Asenda globaalne overflow'i peitmine komponentide reflow/scroll-lepinguga; tee badge paigutus skaleeruvaks | UI-RESP-09 | overflow/layout |
| 10 | Normaliseeri z-index'id rollitokeniteks ja scope'i overlay-selektorid; tee käsitsi hit-test maatriks | UI-RESP-10 | kihistusleping |

## 11. Kujundamata vaadete disainivõlg ja primitiivide taaskasutuse leping

22.08 audit eristab õigesti kahte eri probleemi. Must taust, üldine lehekest, alumine kiirmenüü või üksik kujundatud nupp/väli ei tähenda veel, et vaade ise on kujundatud (`C:/Users/rauds/Desktop/SotsiaalAI/docs/audits/kujundamata-lehed-2026-08-22.md:9-25`).

| Kategooria | Vaateid | Tõendallikas | Puuduv leping | Soovitatud ühine alus |
|---|---:|---|---|---|
| Sisu ümbritsev klaaspind puudub või on killustunud | 18 | `kujundamata-lehed-2026-08-22.md:28-53` | page/surface shell, sisemine scroll ja tegevuste paiknemine | `PanelFrame` + `Panel`/`GlassSurface` + `SubpageHeader`; sama container-, block-size- ja overflow-leping |
| Klaaspind on olemas, sisukujundus puudub | 12 | `kujundamata-lehed-2026-08-22.md:55-75` | sektsioonid, tööetapid, loendid, olekud, tegevusrida, vormihierarhia | olemasolevad `Button`/`Input`/`Textarea`/`Dropdown`/`DateField`/`Checkbox`/`OptionCard`/`Form` + üks ühine Section/List/State kompositsioonikiht |
| Kontrollitud ja nimekirjast välja jäetud | eraldi loend | `kujundamata-lehed-2026-08-22.md:77-100` | ei ole selle võla alusnimekiri | kasutada neid vaateid olemasolevate platvormimustrite lähtepunktina; vestlus jääb teadlikuks klaaspinna erandiks |

Taaskasutusnõue peab olema tulevase kujundustöö vastuvõtukriteerium:

1. Enne vaate kujundamist tehakse olemasolevate komponentide ja primitiivide map; raw `<button>`, `<input>`, `<textarea>` või `<select>` on erand, mitte vaikimisi lahendus.
2. Kui vajalik variant puudub, laiendatakse esmalt olemasolevat jagatud primitiivi. Leht ei loo oma nupu-, välja-, klaasi-, fookuse-, vea-, puutesihi- ega modaalsüsteemi.
3. Jagatud primitiiv peab sisaldama materjali ja käitumist; funktsioonikomponent määrab sisu, semantilise rühmituse, oleku ning lokaalse grid/flex-paigutuse.
4. Lehe- ja sektsiooniprimitivide responsiivsus lähtub tegelikust konteinerist. Viewport-media jääb shell'ile ja seadme omadustele.
5. Vaade ei ole `DONE` ainult sellepärast, et ühised nupud ja väljad on nähtavad. Vajalikud on terviklik pind, töövoo hierarhia, tühised/vea/laadimise/õnnestumise seisundid, klaviatuuri- ja puutepariteet ning käsitsi reflow-kontroll.

Olemasolev baas on kasutatav, kuid ebaühtlaselt lõpetatud: `Button`, `Input` ja `Form` kannavad ühiseid käitumislepinguid; `glass.css` kannab materjali; `PanelFrame` kannab paneelikesta. Samal ajal on `glassPageStyles.js:3-53` lehekompositsiooni klassid peaaegu kõik tühjad ning `WorkspaceFeaturePage.jsx:61-65,174-188` säilitab teadlikult kujunduseta struktuuri. Seega tähendab “kasuta olemasolevaid primitiive” ka nende puuduvate ühiste lepingute lõpetamist, mitte ainult praeguste tühjade wrapper'ite importimist.

## 12. Staatiliselt tõendatud positiivsed omadused

- Viewport ei keela zoom'i (`app/layout.js:264-271`).
- Põhitekst, spacing ja enamik paneelimõõte on `rem`/`em`/`clamp()` põhised; aktiivses koodis leiti ainult kaks px `font-size` deklaratsiooni ning mõlemad on viiteta komponentides (`components/CurvedInput/CurvedInput.css:56-70`, `components/TiltedCard/TiltedCard.css:53-64`).
- Flex/grid kokkusurumist on laialt arvestatud: inventuur leidis 105 `min-width:0` ja 66 `min-height:0` kasutust. Näiteks chat'i sisendimähised (`chat.css:205-227`), panel-body (`panel.css:544-551`) ja workspace-grid (`workspace.css:229-260`) kasutavad neid õigesti.
- Grid kasutab mitmel olulisel pinnal `minmax(0, 1fr)` ja `auto-fit/minmax` mustreid; kovisioon ja teemaseeme on olemasolevad head container-query eeskujud.
- Enamik dekoratiivseid pseudo-/canvas-kihte kasutab `pointer-events:none`.
- Chat'is on olemas `dvh`, safe-area ja VisualViewport'i sihipärane mobiiliklaviatuuri käsitlus; probleem on selle kohal olev stacking contract, mitte dünaamilise viewport'i täielik puudumine.
- Key interaction sample'is on ikoonnuppudel `aria-label`, chat textarea'l `label`, dropdownil täielik klaviatuurirada ja ruumi quickbar'il hover/focus/click/coarse-pointer pariteet.
- Platvormil on juba lai ühine kontrollikiht: `Button`, `Input`, `Textarea`, `Dropdown`, `DateField`, `Checkbox`, `OptionCard`, `Form`, `Modal`, `PanelFrame` ja `SubpageHeader`. `WorkspaceFeaturePage` kasutab neist mitut; UI-RESP-11 probleem on ennekõike puuduvas kompositsiooni- ja taaskasutuslepingus, mitte vajaduses luua nullist uus visuaalne süsteem.

## 13. Runtime'is kontrollimata maatriks

Kõik järgmised kontrollid jäävad selle koodipõhise auditi järel `NOT_PROVEN`:

| Kontroll | Vajalik käsitsi runtime-tõend |
|---|---|
| Tuntud chat'i juhtum 639 × 486 | hit-test inputi, mikrofoni, voice-trigger'i ja `+` keskpunktis; sõltumatu kordus |
| Mobiil 320/360/390 CSS px | kõik sisendid, submit, close/info/menu, drawer ja sources panel |
| Tahvel 769–1024 coarse portrait | JS-i mobile haru versus ainult 768 CSS haru; komposer ja voice-mode |
| Kitsas embedded-paneel laias viewport'is | 320/400/480/600 px container, viewport vähemalt 1200 px |
| App tekstiskaala `lg`/`xl` ja profiil `mac`/`lg` | login, workspace-grid, teenusekaart, modaalid, drawer |
| Brauseri baasfont > 16 px | kas uus `100% × --ui-scale` leping austab eelistust kõigis toetatud brauserites |
| 200% zoom | horisontaalne scroll, kadunud tegevused, badge/text collision, sticky/fixed juhtelemendid |
| Mobiiliklaviatuur | login email/OTP, üldpaneelide vormid, GlassModal/InviteModal, chat |
| Safe-area/PWA | iPhone notch/home-indicator; landscape left/right inset |
| Abitehnoloogiad | screen reader accessible names, modal focus order, switch/voice control |
| 30 kujundamata vaate praegune seis | iga rolli vaated eraldi; terviklik pind, töövoohierarhia, jagatud primitiivide kasutus, 320/600/desktop, suur tekst ja 200% reflow |

## 14. Lõpphinnang

### Kas SotsiaalAI kasutab `rem`-i piisavalt?

**Auditi algseisus arvuliselt jah, süsteemselt mitte; pärast parandusetappi on põhileping piisav, runtime-tõend mitte.** Baseline'is oli `rem`/`em` esinemisi 3989 võrreldes 1362 `px` esinemisega ning aktiivsed fondisuurused olid peaaegu täielikult suhtelised, kuid juur oli 16px ankrus. Nüüd on juur `100%`-põhine, teksti- ja ekraaniskaala eraldi ning puutesihi miinimum suhteline. Allesjäänud px-väärtused ei vaja pimesi teisendamist; riskikoht on eelkõige UI-RESP-11 lõpetamata vaadete kompositsioon ja selle tulevane runtime-maatriks.

### Kas probleem on peamiselt mõõtühikutes või paigutuslepingutes?

**Peamiselt paigutus- ja kompositsioonilepingutes.** Kõige kriitilisem viga tuli sibling-stacking context'ist, mitte ühikust; embedded-pindade probleem viewport-query kasutamisest container-query asemel. Parandusetapp lõi neile ühised põhilepingud, kuid 30 lõpetamata vaate probleem ei lahene px→rem teisendusega: välise pinna, tööetappide, sektsioonide, loendite, vormihierarhia ja olekute ühine kompositsioon on endiselt osaliselt puudu.

### Millised vead võivad teha funktsiooni väikeses aknas täiesti kasutamatuks?

Algseisus võisid funktsiooni täiesti kasutamatuks teha `UI-RESP-01` chat'i pointer-blokeering, `UI-RESP-04` login'i lõikumine, `UI-RESP-03` + `UI-RESP-09` embedded-sisu kadumine ning `UI-RESP-07` modaali puuduv klaviatuurileping. Nende konkreetsed koodiahelad on parandatud. Kuna 639 × 486 hit-test'i, madala login'i, mobiiliklaviatuuri, 200% suumi ja abitehnoloogia runtime'i ei käivitatud, jääb nähtava tulemuse sõltumatu kinnitus `NOT_PROVEN`.

`UI-RESP-11` teeb paljud vaated lõpetamata ja suurendab väikese konteineri riski, kuid staatiline kood üksi ei tõenda, et kõik need vaated muutuvad täiesti kasutamatuks.

### Milline on mõistlik skaleeruva CSS-i sihtarhitektuur?

- juurfont `100% × kasutaja tekstiskaala`, ekraaniprofiil eraldi tokenina;
- spacing, tüpograafia ja kontrolli mõõdud `rem`/`em`, kuid 1px servad ja rasterdetailid jäävad px-iks;
- neljakihiline taaskasutusleping: tokenid/materjal → kontrollid ja käitumine → pind/lehekest/sektsioon → funktsioonilehe semantiline kompositsioon;
- olemasolevad `Button`/`Input`/`Form`/`PanelFrame`/`SubpageHeader`/klaasiprimitiivid jäävad kanooniliseks; puuduv variant lisatakse ühisesse kihti, mitte lehe lokaalse koopiana;
- app-shell viewport query'd, embedded-komponentidel nimelised container query'd;
- grid/flex leping: `minmax(0,1fr)`, vajalik `min-width:0`/`min-height:0`, sisu wrap ja lokaalne overflow;
- jagatud `--hit-target-min`, `--overlay-available-block-size`, safe-area ja dock-reserve tokenid;
- igas isoleeritud komponendis nimelised layer'id, portaalidel üks globaalne overlay-skaala;
- üks modaali käitumisprimitiiv ning visuaalsed modal-shell variandid selle peal;
- `lvh` ainult teadliku stseeni stabiilsuse jaoks, vormid ja overlay'd `dvh`/VisualViewport lepingu järgi.

### Mis on staatiliselt tõendatud ja mis mitte?

`DONE` on nii algsete UI-RESP-01–10 veaahelate staatiline tõend kui ka nende kirjeldatud koodiparandused: chat'i kihileping, `100%` juurfont, puutesihi token, container-query reflow, dünaamiline block-size, modaali ühine käitumine, dokumendiväljade label'id, lokaalne overflow ja scobitud overlay-rollid. Tootmisbuild, lint, i18n ja diff-kontroll tõendavad ainult kompileerumist ning kitsast staatilist pinda. `PARTIAL` on UI-RESP-11 30 vaate disainimigratsioon. Login'i nähtav lõikumine, üldpaneelide mobiiliklaviatuuri occlusion, 200% zoom, chat'i sõltumatu hit-test ning brauseri-/seadme-/abitehnoloogia maatriks jäävad `NOT_PROVEN`.
