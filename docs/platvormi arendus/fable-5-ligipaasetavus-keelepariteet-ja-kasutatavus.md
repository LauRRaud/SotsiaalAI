# A11Y-I18N-A0 — platvormiülene ligipääsetavuse, keelepariteedi ja kasutatavuse tervikaudit

STATUS: COMPLETE

Alustatud ja lõpetatud: 2026-07-16
Auditeerija: Claude (Fable 5), read-only analüüs
Ülesanne: A11Y-I18N-A0

> Skoobipiir: RUUM-A0, admini analüütika monoliit, AVALIK-A0, MAKSED-A0, rollivahetaja,
> O-TK9, RAG-i ja Teenusekaardi äriloogika tervikanalüüsid on teistes lõimedes —
> siin kontrollitakse nende pindade puhul AINULT a11y/keele/kasutatavuse ristkihti.

---

## 1. Seisumaatriks: Git / main / server (kontrollitud 16.07.2026)

| Kiht | Seis | Kommentaar |
|---|---|---|
| Lokaalne `main` | `890124bd` (AI update 2026-07-15 14:51) | Audit tehakse selle vastu |
| `origin/main` | `2a63fcd0` | +4 commit'i lokaalse ees, **kõik RAG-P8 docs/inventuur** (`0972fdf8`, `4c3fceb5`, merge'id) — UI/a11y/i18n koodi ei puuduta; lokaalne main 0 ees |
| Tootmisserver `/home/ubuntu/apps/sotsiaalai` | `890124bd` | **= lokaalne main.** Serveri töökataloog puhas (status kontrollitud SSH kaudu) |
| Lokaalne töökataloog | määrdunud | Commit'imata **RV-P0** (rollilüliti: `AdminRoleViewCycleButton`, `RoleViewSwitcher.jsx`, `PanelInfoSlot.jsx`, workspace/panel/chat/carousel CSS, 12 komponenti) + docs. Audit EI puutu neid muudatusi; kus leid sõltub määrdunud failist, on see märgitud |
| Asjakohased harud | `codex/*` (admin-P0-1, help-listings-privacy, documents-cross-tenant, rag-qm), `fable/tooheaolu-e0` | Ükski ei ole a11y/i18n-suunitlusega; sisaldavad turva/äriloogika parandusi, mis EI ole main'is |

Järeldus: **main = server**, seega leiud kehtivad üheaegselt nii koodibaasi kui toodangu kohta.
Ainus erand on commit'imata RV-P0 kiht, mis on ainult lokaalses töökataloogis.

## 2. Metoodika, skoop ja välistused

**Meetodid:**
1. Staatiline JSX/HTML/CSS analüüs (Grep/Read kogu `app/` + `components/` peal).
2. `npm run i18n:check` + sihitud hardcode-otsing + lokaliseerimis-API-de inventuur.
3. Olemasolevate testide inventuur ja asjakohaste jooksutamine.
4. Runtime-smoke päris brauseriga (playwright-core + LoginTempToken), desktop 1280px + mobiil 375px.
5. Varasemate analüüside ristviited (katvusekaart ptk 3/4: „Ligipääsetavus … OSALISELT KAETUD põhimõttena" — see audit täidab selle lünga).

**Välistused (teistes lõimedes, siin ainult a11y/i18n/kasutatavuse ristkiht):**
RUUM-A0 (ruumid/liitumine/kõnevoog), admini analüütika monoliit, AVALIK-A0 (õigustekstid),
MAKSED-A0 (makse-elutsükkel), rollivahetaja äriloogika (RV-analüüs 16.07), O-TK9, RAG-i
äriloogika, Teenusekaardi äriloogika (TK-analüüs 15.07).

**Varasemad kattuvad leiud, mida siin EI korrata, vaid viidatakse:**
- Vestlusaken: VEST-L2 (kriisiregex ainult ET) ja L10 (PII-hoiatus serverist ET-keelne) — keelepariteedi leidudena kuuluvad ka siia koondisse (ptk 8), detailid `fable-5-vestlusaken-…md`.
- Teekond: kerimisblokk `panel.css` + wheel-häkk — kasutatavuse juurviga, detailid `fable-5-teekond-eelpoordumine-…md`.
- Kovisioon: lõuendireegel rikutud cvl-kestas (KOV-R R1-P0) — detailid teadmistekaardis.

## 3. Keeletaristu arhitektuur (kontrollitud staatiliselt)

**Toimiv tervikpilt — see on platvormi tugevaim kiht:**

| Mehhanism | Fail | Seis |
|---|---|---|
| Lokaadi allikas | `NEXT_LOCALE` küpsis, fallback `et` | ✅ `lib/i18n.js:3` `getLocaleFromCookies` |
| `html lang` | serveripoolne `app/layout.js:325` + kliendipoolne uuendus keelevahetusel | ✅ |
| Sõnumite laadimine | server: `getMessagesSync` (fallback et→{}); klient: dünaamiline import | ✅ |
| Keelevahetus | `AccessibilityModal.jsx:285` `save()`: `setLocale` (lang-atribuut + küpsis + localStorage) → `setMessages` (uus sõnastik) → `router.replace` + `router.refresh` (serverikomponendid uuenevad) | ✅ täielik, ilma täislaadimiseta |
| Keele-eelvaade | modalis elav eelvaade + taastamine sulgemisel (`AccessibilityModal.jsx:80–105, 330–343`) | ✅ |
| Vahetuse teavitus | `I18nProvider.jsx:41` aria-live announcer „Language changed: …" | ✅ |
| URL-strateegia | lokaadineutraalne (`lib/localizePath.js:18` — keel AINULT küpsises; `/et|/ru|/en` prefiks strip'itakse) | ✅ teadlik otsus |
| Lehe `<title>`/metadata | `lib/metadata.js` `buildLocalizedMetadata` (canonical + hreflang alternates); 46/50 lehel | ✅ muster eeskujulik |
| Serveri veateated | `lib/i18n/serverMessages.js` `serverT(locale,key)` + kliendi `resolveApiMessage` (messageKey-leping); 79 API-failis messageKey | ✅ |
| Font | Exo 2 subsets `latin`+`latin-ext`+`cyrillic` (`app/layout.js:20`) | ✅ RU kaetud |
| STT/TTS | `components/chat/hooks/useSpeech.js:152–169` hääle-eelistused keele kaupa + fallback; STT saadab `locale` serverisse | ✅ (RU/EN TTS kvaliteedierinevus = VEST-L8, teises lõimes) |

**`npm run i18n:check`: PASS** — et/en/ru täielik võtmepariteet (4318 võtit, 0 puuduvat, 0 liigset).

## 4. I18N leiud (staatiline)

### 4.1 Tõlkefailide sisu kvaliteet — väga hea

Sügavskaneering (4318 võtit × 3 keelt): 0 mojibake't, 3 tühja väärtust
(`profile.role_short.unknown` et+en — tõenäoliselt taotluslik; `role.unknown` en="" vs et="—"),
~25 identset et==en väärtust, mis on kõik legitiimsed (brändinimed, `docId`-laadsed
tehnilised terminid, placeholderid). RU-väärtustest ainult 12 ilma kirillitsata — kõik
legitiimsed (SotsiaalAI, e-posti näidised, tehnilised loendid).

### 4.2 Leid I18N-1 (P1): mitmusemehhanism puudub — RU grammatika katki loenduritel

- `I18nProvider.jsx:14` `interpolate()` toetab ainult `{var}` asendust; `Intl.PluralRules` ei ole kasutusel kusagil; sõnumifailides pole ühtegi one/few/many varianti.
- 46 `{count}`-võtit kasutavad üht vormi. RU-tõlgetest ~pooled kasutavad kooloni-stiili („Источников: {count}" — korrektne töövõte), ~pooled genitiiv-mitmust, mis on **vale count=1 ja 2–4 puhul**: „Я нашёл {count} возможных предложений" (1 предложений ✗), „{count} файлов выбрано" (2 файлов ✗), „{count} контакта" (vale 1 ja 5+ puhul), „{count} участников" (1 участников ✗).
- ET-l sama klass kergemal kujul: „Kinnitatud {count} nädalat tagasi" → „1 nädalat tagasi" ✗.
- Nähtavad pinnad: abivahenduse vestlusvoog (foundOffers/foundRequests), materjalid, teenusekaart (marker_group_title), kovisioon (participants_count), dokumendid.
- **Juurpõhjus on jagatud** (t()-mootoril pole mitmust), mitte üksikute tõlgete viga. Parandusvariandid: (a) `Intl.PluralRules` + võtmevariandid; (b) kõigi loendurivõtmete ümbersõnastus kooloni-stiili (odavam, ei vaja mootorimuudatust). → Tooteotsus O-AI-2, paketistus ptk-s lõpus.

### 4.3 Leid I18N-2 (P1): elusa pinna hardcode'id — TeemaseemnedPage + WorkspaceFeaturePage

ESLint `no-restricted-syntax` („Hardcoded UI string") kogu repo peale: **315 hoiatust, aga jaotus on kontsentreeritud:**

| Fail | Hoiatusi | Staatus |
|---|---|---|
| `components/covision/CovisionSession.jsx` | 224 | **SURNUD KOOD** (import-otsing: 0 kasutajat; kinnitab ka kovisiooni-mälu „vana demo") — kasutajaid ei mõjuta, aga saastab lint-signaali |
| `components/teemaseeme/TeemaseemnedPage.jsx` | 63 | **ELUS** (`app/teemaseemned/page.jsx`) — terve leht ET-keelne ka RU/EN kasutajale |
| `components/workspace/WorkspaceFeaturePage.jsx` | 27 | **ELUS, juba main'is** (kontrollitud `git show main:` vastu) — eelpöördumis-/töövoopindade abitekstid („Eelinfo ülevaade", „Täpsusta eelinfot", „Midagi ei saadeta automaatselt") |
| `components/brand/LogoExportStage.jsx` | 1 | sisemine logo-eksporditööriist, mitteoluline |

### 4.4 Leid I18N-3 (P2): mojibake main'is — nähtavad küsimärgid kasutajatekstis

`components/workspace/WorkspaceFeaturePage.jsx:2594` sisaldab **literaalseid ASCII `?` baite**
(od-kontrollitud): „Kontaktide soovitamiseks lisa v?hemalt piirkond v?i KOV ning l?hike
olukorra kirjeldus." — peaks olema „vähemalt/või/lühike". Kasutaja näeb küsimärke.
Kogu repo peale AINUS selline rida (sihitud mojibake-otsing 25+ katkise sõnavormiga: 1 vaste).

### 4.5 Leid I18N-4 (P2): kõnede süsteemisõnumid alati eesti keeles

`lib/calls/service.js:351` kirjutab vestlusesse `Helikõne toimus <et-EE kuupäev>.` ja
`:725` salvestise pealkirja `Helikõne salvestus – <et-EE kuupäev>` — kõvakodeeritud ET
sõltumata kasutaja keelest. (Kõnevoo äriloogika = RUUM-A0; siin ainult keelekihi leid.)

### 4.6 Leid I18N-5 (P3): pisiaugud

- `api.common.not_found` messageKey't kasutab 8 admin-RAG endpointi, aga **võtit pole üheski tõlkefailis** → admin näeb võtmeteksti. (`app/api/admin/rag/kov/[slug]/files/route.js:37` jt.)
- ET-baastekstis kirjaviga: `api.common.forbidden` = „Sul puudub selle tegevuse jaoks **oigus**" (peab: „õigus") — sama viga võib olla kopeeritud EN/RU tõlgete kõrval ka mujale.
- `LoginModal.jsx:1030–1035` kolmkeelne `helpSubmitHint` if/else-hardcode JS-is (töötab, aga mööda sõnumifaile — lint ei näe).
- Jagatud komponentide ET-vaikesildid: `ModalConfirm.jsx:11–13` („Jah"/„Katkesta"), `GlassModal.jsx:15` („Sulge"), aria-fallback „Confirm dialog" (EN) — **kõik praegused kutsujad annavad tõlgitud sildid ise** (kontrollitud), seega latentne risk uutele kutsujatele, mitte aktiivne viga.
- Serveri `serverT` fallback on EN (`serverMessages.js:44`), kliendi/küpsise fallback ET — ebajärjekindel vaikimisi keel äärejuhtudel.

### 4.7 Kuupäevad, arvud, raha (punkt 14) — valdavalt korras

- 28 kohta kasutavad `Intl.*Format(locale)` muutujaga (õige muster; nt LoginModal OTP-tähtaeg `LoginModal.jsx:203`).
- Kõvakodeeritud lokaadiga kohad on õigustatud: `en-CA` = ISO-kuupäevatrikk perioodivõtmeteks (`lib/usage/periods.js`, `lib/workspaceContinuity.js`, `lib/notificationReconciler.js`); `et-EE` promptBuilderis (AI-konteksti kellaaeg) ja 3 admin-RAG paneelis (admin-only). Erand mis vajab parandust = I18N-4 (kõned).

## 5. A11Y arhitektuur ja jagatud mustrid (staatiline)

### 5.1 Hästi töötavad ühised mustrid — neid EI tohi „parandada"

| Muster | Kus | Detail |
|---|---|---|
| Skip-link | `components/room/SkipLink.jsx` | kontekstitundlik: avalehel `#room-menu` (karussell), mujal `#main`; nähtav fookusel (`base.css:315`) |
| Peasisu landmark | `app/layout.js:359` | `<main id="main" role="main" tabIndex={-1}>` — skip-linki sihtmärk fokusseeritav |
| Fookusering | `base.css:272–281` | globaalne `:focus-visible` kaksik-box-shadow (`--focus-ring`, tume+hele ring — näha igal taustal); `:focus { outline:none }` on teadlik asendus, mitte kustutus |
| Reduce-motion | `base.css:353–371` | **topelt kill-switch**: nii OS `prefers-reduced-motion` KUI kasutaja `data-reduce-motion="1"` → kõik animatsioonid/transitionid 0.01ms üle kogu platvormi; + 45 failispetsiifilist täpsustust (chat 26, carousel 9, room 7) |
| A11y-eelistused | `app/layout.js:29–158` + `AccessibilityProvider` | tekstiskaala sm/md/lg/xl (0.94–1.25×), ekraaniprofiil, kontrast `hc`, reduce-motion, reduce-transparency; serveri-küpsis + localStorage + FOUC-vaba inline-init; **fookuse taastamine avajale olemas** (`AccessibilityProvider.jsx:584`) |
| Kõrgkontrast | `tokens.css:252–263` | hc: klaas ~läbipaistmatu (0.97–1.0), äärised 0.8 alpha, tekst #fff; grain-veil peidetakse (`base.css:348`) |
| Dialoogi tippteostused | `LoginModal.jsx`, `AccessibilityModal.jsx`, `ConversationDrawer.jsx` | LoginModal: täielik fookuselõks + `main` saab `inert`+`aria-hidden` + klahvistiku noolenavigatsioon + `role=alert/status` regioonid. ConversationDrawer: lõks + Escape + inert-taust + **fookuse taastamine avajale** + suletud olekus `inert` |
| Ikoon-nupp | `components/glass/IconButton.jsx` | `aria-label` KOHUSTUSLIK (dev-hoiatus puudumisel); 2.6rem ≈ 42px puuteala |
| Valikukaart | `components/ui/OptionCard.jsx` | päris `input` + `label` (native semantika), sr-only input, focus-visible kandub data-atribuudiga kaardile |
| Nupp | `components/ui/Button.jsx` | `disabled` + `aria-disabled` koos; lingina (`as="a"`) disabled → `tabIndex=-1` |
| Vestlusvoog | `ConversationView.jsx:227` | `role=region` + `aria-label` + `aria-live=polite` + `aria-busy` streamimisel; kriisibänner `role=alert` (`ChatNotices.jsx:61`); STT-salvestus `role=status` |
| Karussell | `components/room/GlassCarousel.jsx` | roving tabindex, `aria-current`, eelmine/järgmine nimetatud, sr-only `aria-live` positsiooniteade, **autoplay'd EI OLE** |
| Keelevahetuse teade | `I18nProvider.jsx:86` | püsiv sr-only `aria-live=polite` announcer |
| Pildid | `RoomStage.jsx:1189,1226` | dekoratiivsed: `alt=""` + `aria-hidden` konteiner — leping peetud (eslint `no-img-element` hoiatab ainult optimeerimist, mitte a11y-t) |

Kokku: **fookusehaldus, live-regionid ja reduce-motion on selle platvormi tugevused** —
tase, mida kohtab harva. Probleemid on kontsentreeritud jagatud primitiivide alumisse otsa
(ptk 5.2) ja üksikutesse vormidesse (5.3).

### 5.2 Leid A11Y-1 (P1): jagatud Modal-primitiivid nõrgemad kui eriteostused — jagatud juurpõhjus

`components/ui/Modal.jsx` (baasmodaal): on `role=dialog aria-modal` + portaal, aga
**puudub fookuselõks, Escape, algfookus, fookuse taastamine ja tausta inert**. Tagajärg:
`aria-modal="true"` LUBAB ekraanilugejale modaalsust, mida klaviatuur ei jõusta — Tab kõnnib
taustale. Pärijad (7 kutsujat):

| Kutsuja | Oma kompensatsioon | Jääkrisk |
|---|---|---|
| `components/invite/InviteModal.jsx` | **mitte midagi** (0 Escape/focus/trap) | täisrisk — ruumikutse voog |
| `components/ui/ModalConfirm.jsx` (6 kasutuskohta: ChatSidebar, ProfiilBody 2×, RoomsPage, MySharingsPage, RagAdminDocumentsView, ChatBody) | Escape + scroll-lock + busy `role=status` | lõks/algfookus/taastamine puudub; busy-olekus nupud kaovad → fookus võib kaduda body'le |
| `ProfiilBody`, `KasutusjuhendBody`, `HelpListingsPanel`, `SelectedListingContext`, `RagAdminDetailModal` | osaline (mõnel Escape) | lõks/taastamine puudub |

`components/glass/GlassModal.jsx`: Escape ✅, algfookus ✅, aga lõks + taastamine puudub
(2 kasutuskohta RoomStage'is). **Parandus kuulub primitiivi, mitte 9 kutsujasse** —
üks `useModalA11y`-laadne hook või Modal.jsx täiendus katab kõik korraga.

### 5.3 Leid A11Y-2 (P1): registreerimisvormi väljadel pole püsivat ligipääsetavat nime

`components/alalehed/RegistreerimineBody.jsx:763–822`: e-posti ja PIN-väljal **ei ole
`<label>`-it ega `aria-label`-it** — ligipääsetav nimi tuleb ainult `placeholder`-ist,
ja **veaolekus placeholder asendatakse tühjaga** (`placeholder={fieldErrors.email ? "" : …}`),
st täpselt hetkel, kui kasutaja vajab välja nime + viga, jääb väli **ilma nimeta**
(WCAG 4.1.2 + 3.3.2). Heas seisus osa: `aria-invalid` + `aria-describedby` → veatekst,
üldviga `role=alert`, nõusolekud OptionCard'iga (native checkbox). Puudub ka fookuse
viimine esimesele veale submit'il. Sama „placeholder-nimi" muster (ilma
placeholder-eemaldamiseta ja `aria-label`-iga kompenseeritud) on LoginModalis — seal korras.

### 5.4 Leid A11Y-3 (P2): PIN-sisestuse edenemine ekraanilugejale hääletu (LoginModal)

PIN-täpid on `aria-hidden` (`LoginModal.jsx:1163`), desktop-klahvisisestus fokusseerib
`aria-hidden="true"` peidetud inputi (`:1088`, fokusseeritav aria-hidden = ARIA rikkumine)
ja ükski live-region ei teata sisestatud numbrite arvu. SR-kasutaja ei tea, mitu numbrit
on sisestatud ega millal PIN täis. (Klahvistik ise on eeskujulikult margistatud.)

### 5.5 Väiksemad a11y-leiud (P3)

- `LoginModal.jsx:1349–1359` „registreerimine suletud" = `<span role="link" aria-disabled>` ilma `tabIndex`-ita — klaviatuuriga kättesaamatu; kuna sihilikult inaktiivne, piisaks `role` eemaldamisest või `<p>`-st.
- `ModalConfirm` aria-label fallback `"Confirm dialog"` (EN) + ET-vaikesildid — latentsed (kõik kutsujad annavad ise; vt I18N-5).
- Lehed ilma `metadata`-ta: `app/teekond/page.jsx`, `app/join/page.jsx`, `app/rooms/page.js`, `app/room/[roomId]/page.jsx` → brauseri vaikepealkiri „SotsiaalAI" ilma leheinfota (teekond = suur pind; join/rooms/room = RUUM-A0 ristkiht).
- `base.css:373` liigne sulg `}` faili lõpus — parserid taastuvad, kahjutu, aga hügieen.

## 6. CSS/visuaalne kiht (staatiline)

- **Kontrastitokenid:** põhitekst `--text-warm #f4f1ec` tumedal (≈13:1), teisene 0.76, summutatud `--text-dim` 0.55 (≈5.4:1 — AA piires normaaltekstile). hc-režiim tõstab kõik ≥0.75 alpha'le. Värvist sõltumatu tähendus vajab pinnapõhist runtime-kontrolli (ptk 8).
- **Reduce-motion:** topelt kill-switch (ptk 5.1) — failipõhiste reeglite puudumine login/panel/workspace.css-is EI ole viga, sest globaalne reegel katab kõik.
- **Puutealad:** `--glass-iconbtn` 2.6rem ≈ 42px; nupud 0.62em–0.95em padding → ≥40px. WCAG 2.5.8 (24px) täidetud varuga; 44px-soovitusest napilt allpool ikoonnuppudel.
- **Import-järjekord** `globals.css` kommenteeritud ja teadlik (tokenid → tailwind → base → …).
- 200% zoom / kitsas vaade / ümbervool = runtime (ptk 8).

## 7. Runtime-smoke (päris brauser, 16.07.2026)

**Keskkond:** playwright-core + kanal Chrome (headless), dev-server **port 3001** (kasutaja
juba töötav server; CLAUDE.md keelab duplikaadi). NB: server teenindab **määrdunud tööpuud
(main 890124bd + commit'imata RV-P0)** — kus leid võiks sellest sõltuda, on märgitud.
Login: olemasolev test-admin + LoginTempToken (raw SQL; fetch-login retsept). Vestlussõnumeid
EI saadetud (0 OpenAI kulu). Screenshot'e EI tehtud (teadaolev hang — mõõdeti ainult DOM-i).
**Sünteetika: 1 LoginTempToken, kustutatud auditi lõpus (deleted=1, remaining=0); admini
vaaterolli küpsis lähtestati (`PUT view-role null`); kasutajaid/kirjeid EI loodud.**

### 7.1 Tulemused — kontrollpunktide kaupa

| Kontroll | Tulemus | Tõend |
|---|---|---|
| `html lang` küpsisest, kõigil lehtedel | **PASS** | et → kõik 18 auditeeritud marsruuti `lang=et`; RU-küpsisega `lang=ru` |
| Skip-link esimene Tab + sihtmärk olemas | **PASS** | avalehel `#room-menu` (olemas), paneelidel `#main` (olemas); fookusering nähtav |
| LoginModal klaviatuur | **PASS** | algfookus e-posti väljas, `main` sai `inert`+`aria-hidden=true`, 18 Tab-sammu KÕIK modalis (lõks peab), fookusering igal peatusel, Escape sulgeb |
| LoginModal fookuse taastamine sulgemisel | **FAIL (P3)** | pärast Escape'i `activeElement=BODY` — avajanuppu ei taastata (A11Y-4) |
| Nimeta juhtelemendid (nupud/lingid/väljad) | **PASS** (1 erand) | 18 marsruudil 0 nimeta elementi; ainus: `/documents` sr-only failiinput (`DocumentsPage.jsx:625`, A11Y-5) |
| Pildid ilma alt'ita | **PASS** | 0 kõigil lehtedel |
| Horisontaalne ülevool 1280px | **PASS** | 0 kõigil |
| Horisontaalne ülevool **375px mobiil** | **PASS** | 0 kõigil (/, vestlus, Töölaud, documents, profiil, registreerimine) — ümbervool töötab |
| Ülevool **640px (200% lähend)** | **PASS** | 0 (profiil, documents, Töölaud) |
| `prefers-reduced-motion` runtime | **PASS** | avalehel 0 animatsiooni >100ms (kill-switch toimib); NB: 2 canvas'it (Galaxy) — WebGL-loop'i seiskumist DOM-ist ei mõõda (not_run, ptk 11) |
| Vestluse komposer | **PASS** | textarea nimi „Kirjuta siia", 6/6 nuppu nimega |
| Lehe `<title>` | **FAIL (P1)** | tühi 7/18 marsruudil: `/vestlus`, `/vestlus?workspace=1`, `/profiil`, `/hinnastus`, `/voimalused`, `/tellimus`, `/kasutustingimused` — juurpõhjus I18N-6 (meta.* puudub) |
| `<h1>` olemasolu | **PASS** (2 erandit) | `/profiil` h1=0 (A11Y-6); `/vestlus?workspace=1` h1=2 (topelt) |
| Landmark-struktuur | **OSALINE** | `/vestlus` main=2 (`ConversationView.jsx:225` `<main>` layout'i `<main#main>` sees), `/kovisioon` main=2 + banner=3 (`CovisionWorkspace.jsx:347`) — A11Y-7 |
| Admin S/P/T eelvaade (#17) | **PASS** | `PUT view-role` CLIENT→200, SOCIAL_WORKER→200; `lang` ei muutu, live-regionite arv stabiilne, 1 nähtav lüliti (SSR-duplikaat filtreeritud `checkVisibility()`-ga); eksitavat a11y/keeleolekut ei teki. NB: lüliti ise = commit'imata RV-P0 |
| RU-lokaat: tõlgitud pind | **PASS** | `/vestlus?workspace=1` täisvene (41 RU-sõna, 0 ET) |
| RU-lokaat: hardcode-pind | **FAIL (P1, kinnitab I18N-2)** | `/teemaseemned` RU-vaates segakeelne: „Juhtumi märkamisest kovisioonini", „Kovisiooni ruum" jm ET-ribad RU-sisu kõrval |
| Registreerimisvorm | **FAIL (P1, kinnitab A11Y-2)** | runtime: e-posti+PIN väljad `placeholderOnly` — nimi ainult placeholder'ist |
| Puutealad | vaatlus | „tiny" loendur (19 avalehel, 14 documents) sisaldab sr-only 1px-elemente → EI ole usaldusväärne leid; visuaalsed nupud ≥40px (ptk 6) |

### 7.2 Käivitatud käsud ja testid

| Käsk | Tulemus |
|---|---|
| `npm run i18n:check` | **PASS** — en OK, ru OK, kõik vastavad et-baasile |
| `npm test` (täissuite, määrdunud tööpuu) | **1222/1222 PASS** (6.7s) |
| `tests/i18n/*.test.js` (4 faili, 6 testi) | **PASS** — võtmelepingud: covision workflow, privacy title, rollisildid, workspace võtmed |
| ESLint kogu repo | 315 hardcode-hoiatust (jaotus ptk 4.3), 41 unused-vars, 2 no-img-element; **0 errorit** |
| Runtime-smoke (ülal) | 47 mõõtepunkti, stderr tühi |

**Testide inventuur a11y/i18n vaatest:** i18n-võtmelepinguid on 4 faili (kitsas, aga päris);
**a11y-teste ei ole ühtegi** (0 axe/aria-lepingut); `npm run test:e2e` (playwright) on
**konfigureerimata jäänuk** — playwright.config puudub, spec-faile pole.

## 8. Pinnapõhine A11Y × I18N kontrollmaatriks

Legend: ✅ korras · ⚠️ leid(e) · ❌ oluline leid · — ei kohaldu. „Pealkiri" = runtime `<title>`.

| Pind | Pealkiri | h1 | Landmark | Klaviatuur/fookus | Nimed/alt | Ülevool 375px | I18N | Märkus |
|---|---|---|---|---|---|---|---|---|
| Avaleht `/` | ✅ | ✅ | ✅ (nav+main) | ✅ skip→`#room-menu` | ✅ | ✅ | ✅ | karussell a11y-eeskuju (ptk 5.1); RUUM-A0 ristkiht |
| `/meist`, `/kasutustingimused` | ⚠️ terms tühi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | I18N-6 |
| `/voimalused`, `/hinnastus` | ❌ tühi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | I18N-6; AVALIK-A0 ristkiht |
| Registreerimine | ❌ tühi | ✅ | ✅ | ⚠️ veafookus puudub | ❌ placeholder-nimed | ✅ | ✅ | A11Y-2 + I18N-6 |
| LoginModal | — | — | ✅ dialog | ✅ lõks+Esc+inert (runtime) | ✅ | ✅ | ⚠️ helpSubmitHint JS-is | A11Y-3 (PIN SR-vaikus), A11Y-4 (restore) |
| Vestlus `/vestlus` | ❌ tühi | ✅ | ⚠️ main=2 | ✅ komposer + drawer eeskujulik | ✅ | ✅ | ✅ (VEST-L2/L10 viited ptk 2) | A11Y-7, I18N-6 |
| Töölaud `?workspace=1` | ❌ tühi | ⚠️ h1=2 | ⚠️ banner=2 | ✅ | ✅ | ✅ | ✅ täisvene OK | I18N-6 |
| Dokumendid | ✅ | ✅ | ✅ | ✅ | ⚠️ 1 failiinput | ✅ | ✅ | A11Y-5 |
| Eelpöördumised + töövoopinnad | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ 27 hardcode'i + mojibake | I18N-2/3 (WorkspaceFeaturePage) |
| Teekond (`→ ?workspace=journey`) | ❌ (pärib vestluse tühja) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | teekonna-UX juurvead = teises lõimes (ptk 2) |
| Tööheaolu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | töövood aria-live'iga (58 faili koond) |
| Kovisioon | ✅ | ✅ | ⚠️ main=2, banner=3 | ✅ | ✅ | ✅ | ✅ | A11Y-7; lõuendireegel = KOV-R lõim |
| Teemaseemned | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ 63 hardcode'i (runtime-tõendatud RU-s) | I18N-2 |
| Teenusekaart | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ RU mitmus (marker_group_title) | I18N-1; äriloogika = TK lõim |
| Profiil | ❌ tühi | ❌ h1=0 | ✅ | ✅ | ✅ | ✅ | ✅ | A11Y-6 + I18N-6 |
| Tellimus | ❌ tühi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | I18N-6; MAKSED-A0 ristkiht |
| Minu jagamised, Materjalid | ✅ | ✅ | ✅ | ✅ | ✅ (1 ⚠️ textarea placeholder-nimi materjalidel) | ✅ | ✅ | |
| Jagatud modalid/drawer/karussell/toast | — | — | ✅/⚠️ | ⚠️ Modal.jsx-i pärijad (A11Y-1) | ✅ | ✅ | ⚠️ ET-vaikesildid latentsed | ConversationDrawer + AccessibilityModal eeskujud |
| Admin (ristkiht) | ✅ | ✅ | ✅ | — | — | — | ⚠️ not_found võti puudub (P3) | monoliit = teises lõimes |

## 9. Leidude register P0–P3

**P0 uusi leide ei ole.** Kõige raskem keelepariteedi auk platvormil on kriisituvastuse
ET-ainsus (RU/EN kriisisõnum ei käivita kriisirada) — see on **VEST-L2** ja kuulub
VEST-P0 paketti (teine lõim); siin ainult ristviide, mitte duplikaat.

| ID | Aste | Leid | Failid | Juurpõhjus |
|---|---|---|---|---|
| **I18N-6** | **P1** | 16 lehe `generateMetadata` loeb `messages.meta.*`, mida **pole üheski tõlkefailis** → tühi `<title>`+description (runtime-tõendatud 7 marsruudil; WCAG 2.4.2) | `app/vestlus/page.js:15`, `app/profiil/page.js:17`, `app/hinnastus/page.jsx:10`, `app/voimalused/page.jsx:10`, `app/tellimus/page.js:10`, `app/kasutustingimused/page.js:9`, `app/page.js:9`, `app/registreerimine/page.js:19`, `app/privaatsustingimused/page.js:9`, `app/kasutusjuhend/page.jsx:10`, `app/autorilt/page.jsx:10`, `app/ruum/page.js:12`, `app/taasta-parool/page.jsx:10` + `[token]`, `app/uuenda-epost/page.js:9`, `app/uuenda-pin/page.js:9` | **JAGATUD** — üks puuduv sõnumisektsioon; kood on õige, sisu puudub. (Kontrast: `/documents` loeb `documents.meta` → töötab) |
| **I18N-1** | **P1** | Mitmusemehhanism puudub → RU grammatika vale count=1/2–4 puhul 20+ võtmel; ET „1 nädalat tagasi" | `components/i18n/I18nProvider.jsx:14` + 46 `{count}`-võtit (ptk 4.2) | **JAGATUD** (t()-mootor) |
| **I18N-2** | **P1** | Elusad ET-hardcode-pinnad: Teemaseemned (63) + WorkspaceFeaturePage (27, juba main'is) — RU/EN kasutaja näeb segakeelt (runtime-tõendatud) | `components/teemaseeme/TeemaseemnedPage.jsx`, `components/workspace/WorkspaceFeaturePage.jsx` | kaks üksiklehte (mitte jagatud) |
| **A11Y-1** | **P1** | Jagatud Modal-primitiividel pole fookuselõksu/algfookust/taastamist (Modal.jsx ka Escape'ita); `aria-modal=true` lubab modaalsust, mida ei jõustata; 9 pärijat, halvim InviteModal (0 kompensatsiooni) | `components/ui/Modal.jsx`, `components/glass/GlassModal.jsx`, `components/ui/ModalConfirm.jsx`, `components/invite/InviteModal.jsx` | **JAGATUD** primitiiv |
| **A11Y-2** | **P1** | Registreerimisvormi väljadel nimi ainult placeholder'ist, mis veaolekus eemaldatakse; veafookus puudub (runtime-tõendatud) | `components/alalehed/RegistreerimineBody.jsx:763–822` | üksikleht |
| **I18N-3** | **P2** | Mojibake main'is: literaalsed `?` („v?hemalt piirkond v?i KOV ning l?hike") — ainus terves repos | `components/workspace/WorkspaceFeaturePage.jsx:2594` | üksikrida |
| **I18N-4** | **P2** | Kõne süsteemisõnumid/salvestise pealkirjad alati ET (`Helikõne toimus …` et-EE) | `lib/calls/service.js:351,725` | üksikmoodul (RUUM-A0 ristkiht) |
| **A11Y-3** | **P2** | PIN-sisestuse edenemine SR-ile hääletu; skript fokusseerib `aria-hidden` inputi | `components/LoginModal.jsx:1088,1163` | üksikkomponent |
| **A11Y-6** | **P2** | `/profiil` ilma `<h1>`-ta (runtime h1=0) + tühi title (I18N-6 osa) | `components/alalehed/ProfiilBody.jsx` (h1 on failis olemas — ei renderdu profiili juurvaates; kontrolli tingimusharu) | üksikleht |
| **A11Y-7** | **P2** | Topelt-`main` landmark: vestlus (2), kovisioon (2, +3 banner'it); Töölaud h1=2 | `components/alalehed/chat/ConversationView.jsx:225`, `components/covision/CovisionWorkspace.jsx:347` | kaks komponenti, sama muster (sisemine `<main>` layout'i `main#main` sees) |
| A11Y-4 | P3 | LoginModali sulgemisel fookus ei taastu avajale (runtime: BODY) — AccessibilityModal'il ja ConversationDrawer'il taastamine ON | `components/LoginModal.jsx` | üksik |
| A11Y-5 | P3 | Nimeta sr-only failiinput | `components/documents/DocumentsPage.jsx:625` | üksik |
| I18N-5 | P3 | `api.common.not_found` võti puudub (8 admin-endpointi); `role.unknown` EN tühi; ET „oigus"-kirjaviga; `helpSubmitHint` JS-hardcode; ET-vaikesildid jagatud komponentides (latentsed) | ptk 4.6 | pisikogum |
| A11Y-8 | P3 | `<span role="link" aria-disabled>` ilma tabindex'ita (reg. suletud teade); `base.css:373` liigne `}`; CovisionSession.jsx surnud fail saastab lint-signaali (224 hoiatust) | `components/LoginModal.jsx:1349`, `app/styles/base.css:373`, `components/covision/CovisionSession.jsx` | pisikogum |

**Jagatud juurpõhjus vs üksikleht — kokkuvõte:** kolm süsteemset juurt annavad enamiku
kaalust: (1) puuduv `meta.*` sektsioon → 16 lehte; (2) mitmuseta t() → 46 võtit;
(3) trap'ita Modal-primitiiv → 9 pinda. Ülejäänu on üksiklehtede sisu.

## 10. ET/EN/RU pariteedi ja hardcode'ide koond

- Võtmepariteet: **täielik** (i18n:check PASS, 4318 võtit ×3).
- Sisu kvaliteet: suurepärane (0 mojibake't tõlkefailides, identsed väärtused legitiimsed, RU kirillitsa-katvus täielik).
- Hardcode'id JSX-is: 315 lint-hoiatust → tegelik elus jalajälg **90 rida 2 failis** (63 Teemaseemned + 27 WorkspaceFeaturePage); 224 surnud failis; 1 logo-tööriistas.
- Hardcode'id väljaspool lint'i haaret: `helpSubmitHint` (LoginModal), kõnede sõnumid (lib/calls), jagatud komponentide vaikesildid (latentsed), 1 admin-RAG ET-string.
- Vale keele fallback: server EN vs klient ET (äärejuht); `getMessagesSync` fallback et→{} on korrektne ahel.
- Segakeelsed vastused/AI-keel: vestluse enda keelekäitumine = VEST-lõim (L2/L10 viidatud); UI-kihi segakeelsus tuvastatud ainult hardcode-lehtedel.

## 11. Runtime / testid / not_run register

| Kontroll | Staatus | Põhjus/detail |
|---|---|---|
| i18n:check, npm test (1222), i18n-testid (6), ESLint, runtime-smoke 18 marsruuti ×3 vaadet (1280/375/640), LoginModal klaviatuur, reduced-motion, RU-lokaat, S/P/T eelvaade | **run** | ptk 7 |
| axe-core / WCAG täisskaneering | **not_run** | axe pole projektis ega auditi tööriistakastis paigaldatud; nime/landmark/fookuse kontrollid tehti käsitsi-skriptiga (kitsam, aga päris) |
| Päris ekraanilugeja (NVDA/VoiceOver) | **not_run** | ei ole selles keskkonnas automatiseeritav; SR-järeldused tuletatud ARIA-semantikast |
| Piksli-põhine kontrastimõõtmine | **not_run** | screenshot hangub SotsiaalAI lehtedel (teadaolev keskkonnapiirang, mälufail); kontrast hinnatud tokenite arvutusega (ptk 6) |
| Päris 200% brauseri-zoom | **not_run** (lähend run) | kasutasin 640px vaadet (layout-efekt sama); pinch/Ctrl-pluss käitumist ei mõõdetud |
| Galaxy WebGL seiskumine reduced-motion all | **not_run** | canvas-sisemus pole DOM-ist mõõdetav; RoomStage JS arvestab `reducedRef`-iga (RoomStage.jsx:285–607) — osaline staatiline tõend |
| hc-kontrastiteema runtime-lülitus | **not_run** | kontrollitud tokenid + init-skript staatiliselt; runtime-lülituse smoke jäi mahu piiresse |
| STT/TTS päris häälega | **not_run** | lokaalses .env-is pole kõnevõtmeid (VEST-retsept kinnitab); keelevalik kontrollitud staatiliselt (useSpeech.js) |
| CLIENT/SOCIAL_WORKER **päris kontodega** | **not_run** | kasutasin admini S/P/T vaate-eelvaadet (RV-mehhanism, #17 nõue täidetud); päris rollikontode väravakäitumine = RV-P2 lõim; sünteetiliste kontode loomine polnud vajalik |
| Kriisiraja RU/EN runtime | **not_run siin** | VEST-A0 juba tõendas (L2); ei dubleeri |
| NOT_READ — SAFEGUARD | **mitte ükski** | safeguard ei blokeerinud ühtegi faili; Sol/Codex eraldi kontrolli nimekiri on tühi |

## 12. Tooteomaniku otsused (blokeerivad vastava paketi)

| ID | Otsus | Mõjutab |
|---|---|---|
| O-AI-1 | Kas Teemaseemned + eelpöördumiste abitekstid tõlgitakse RU/EN või on need teadlikult ET-ainsad kutsetöö pinnad? (Teemaseemned on SOCIAL_WORKER-pind; RU-keelseid spetsialiste on sihtrühmas) | I18N-2 → P3-pakett |
| O-AI-2 | Mitmusestrateegia: (a) `Intl.PluralRules` + one/few/many võtmevariandid (õige, kallim) või (b) kõigi 46 loendurivõtme kooloni-ümbersõnastus (odav, stiilipiirang) | I18N-1 → P3-pakett |
| O-AI-3 | Kõnede süsteemisõnumid: salvestada võti+parameetrid (lugeja keeles renderdatav) või kirjutaja-hetke keeles tekst? (tagantjärele tõlkimatu) | I18N-4 → P2-pakett |
| O-AI-4 | Registreerimisvormi disain: kas nähtavad sildid (WCAG-soovitus) või jääb placeholder-minimalism + püsiv `aria-label`+veaolekus-placeholder parandus? | A11Y-2 → P2-pakett |
| O-AI-5 | Kas `<title>`-strateegia kinnitatakse: „iga leht lokaliseeritud pealkirjaga" (I18N-6 paketi sisu tõlked vajavad sisuomaniku pilku, EN/RU sõnastus) | A11Y-I18N-P0 sisu, EI blokeeri paketti (tõlked saab kinnitada PR-is) |

## 13. Paketistus A11Y-I18N-P0…P3

| Pakett | Sisu | Sõltuvus | Maht |
|---|---|---|---|
| **P0 — pealkirjad + tõlkefailide sisuparandused** | I18N-6 (meta.* 16 gruppi ×3 keelt) + I18N-5 võtmeparandused (`api.common.not_found`, `role.unknown` EN, „oigus"→„õigus") + 1 uus võtmelepingu-test | **EI vaja tooteotsust** | ~0,5–1 päev |
| **P1 — jagatud dialoogiprimitiiv** | A11Y-1: üks `useModalA11y` hook (lõks+Escape+algfookus+taastamine+inert) Modal.jsx/GlassModal/ModalConfirm sisse; InviteModal pärib; + A11Y-7 topelt-main (2 faili `<main>`→`<section>`/`<div role="region">`; NB kontrolli chat.css `main`-selektorid!) + A11Y-6 profiili h1 + A11Y-5 failiinputi nimi + A11Y-4 LoginModal restore | EI vaja tooteotsust; vajab regressioonismoke'i (dialoogid + chat-CSS) | 1–2 päeva |
| **P2 — vormid ja kõne** | A11Y-2 (vajab O-AI-4), A11Y-3 PIN-progressi live-region, I18N-3 mojibake-rida (**alles PÄRAST RV-P0 commit'i** — fail on praegu määrdunud tööpuus), I18N-4 (vajab O-AI-3) | O-AI-3, O-AI-4; RV-P0 commit | 1–2 päeva |
| **P3 — keelevõlg** | I18N-2 hardcode-migratsioon (vajab O-AI-1), I18N-1 mitmus (vajab O-AI-2), CovisionSession.jsx surnud faili kustutus, A11Y-8 pisiasjad | O-AI-1, O-AI-2 | 2–4 päeva |

## 14. Esimene rakendusvalmis pakett: **A11Y-I18N-P0**

**Ei vaja ühtegi tooteotsust.** Ainult tõlkefailid + 1 uus testifail — ei puuduta
rakenduskoodi, CSS-i ega kasutaja määrdunud tööpuu faile.

**Täpsed failid:**
1. `messages/et.json` — lisa sektsioon `meta` alamgruppidega: `home, chat, profile, pricing, features, register, subscription, terms, privacy, guide, author, rooms, reset, email_update, pin_update` (15 gruppi; `uuenda-pin` loeb `pin_update || reset`), igas `title` + `description`. Väärtuste lähtekoht: olemasolevad lehe-h1-d ja AVALIK-A0 sõnastused.
2. `messages/en.json`, `messages/ru.json` — samad võtmed (i18n:check jõustab).
3. Samas failis: `api.common.not_found` (et/en/ru), `role.unknown` EN väärtus („—"), `api.common.forbidden` ET „oigus"→„õigus".
4. UUS `tests/i18n/metaTitles.test.js` — leping: iga `app/**/page.js*`-is loetav `messages?.meta?.<key>` alamgrupp eksisteerib et.json-is mitte-tühja `title`-iga (skaneerib lehefailide mustrit nagu olemasolevad tests/i18n testid).

**Välistatud skoop:** `WorkspaceFeaturePage.jsx` (määrdunud, RV-P0), kõik .jsx/.css failid,
mitmus (O-AI-2), hardcode-migratsioon (O-AI-1), teekonna/ruumide title-erijuhud
(join/rooms/room — RUUM-A0 lõim otsustab sõnastuse).

**Testid:** `npm run i18n:check` (PASS-nõue), `npm test` (1222 + uus test), `npm run lint`.

**Runtime-vastuvõtukriteeriumid (AC):**
- AC1: `/vestlus`, `/profiil`, `/hinnastus`, `/voimalused`, `/tellimus`, `/kasutustingimused` — `document.title` mitte-tühi ET-küpsisega.
- AC2: sama RU-küpsisega → venekeelne title (`lang=ru` + title kirillitsas või brändinimi).
- AC3: `/documents` title jääb muutumatuks („Dokumendid") — regressioonivalve olemasolevale mustrile.
- AC4: `i18n:check` PASS (pariteet ei purune).

**Hinnanguline maht:** ~100 tõlkerida + 1 test ≈ 0,5–1 päev (koos EN/RU sõnastuse kontrolliga).

**Kontrollitase:** piisab **Soli tehnilisest kontrollist** (deterministlikud testid + AC-d
skriptitavad; muudatus on puhas sisu-lisandus). Sõltumatut auditit pole vaja; EN/RU
tõlgete keeleline kvaliteet väärib sisuomaniku pilku PR-is (O-AI-5, ei blokeeri).

## 15. Kokkuvõte

Platvormi a11y/i18n vundament on **erakordselt tugev**: täielik võtmepariteet, läbimõeldud
keelevahetus ilma täislaadimiseta, topelt-kill-switch reduce-motion'ile, globaalne
fookuseringisüsteem, kolm eeskujulikku dialoogiteostust, IconButton'i sunnitud nimed,
0 ülevoolu isegi 375px vaates ja 0 nimeta juhtelementi runtime'is. Võlg on kontsentreeritud
kolme jagatud juurde (meta-pealkirjad, mitmus, Modal-primitiiv) ja kahte hardcode-lehte —
kõik piiritletud, paketistatud ja suures osas tooteotsusteta parandatavad.

Auditeeris: Claude (Fable 5), 16.07.2026. Runtime: määrdunud tööpuu (main 890124bd + RV-P0)
port 3001; main = tootmisserver. Sünteetika koristatud nullini. Safeguard-blokke ei esinenud.

STATUS: COMPLETE
