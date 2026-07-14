# SOL — U7 selge keele režiim: tööplaan ja progress

> **Kuupäev:** 2026-07-14
> **Teostaja:** Sol / Codex, väga kõrge effort
> **Haru:** `codex/u7-plain-language`
> **Baas:** `origin/main @ aef93393`
> **Worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-u7`
> **Seis:** SOL VALMIS — TESTITUD — OOTAB OPUSE SÕLTUMATUT AUDITIT
> **Merge/deploy:** enne Opuse sõltumatut auditit keelatud

## 1. Eesmärk

U7 v1 lisab kasutaja juhitava selge keele esitusrežiimi. Režiim aitab teksti
lugeda ja töövoogu sammhaaval läbida, kuid ei muuda õigusi, retrieval'it,
allikavalikut, salvestatud eelpöördumise sisu ega inimese eest tehtavaid
otsuseid.

Teostus lähtub faili 13 §7 ja Opuse §13 sisendist.

## 2. Lukustatud ulatus

U7 v1 sisaldab:

1. üht ranget boolean-eelistust `plainLanguage` olemasolevas
   `AccessibilityProvider` cookie/localStorage lepingus;
2. serveri allowlist'itud ET/EN/RU prompt-instruktsiooni tavavestluse jaoks;
3. chat-kliendi request-adapterit, mis saadab ainult `true` või `false`;
4. juhendatud eelpöördumise väiksema samaaegse infotihedusega vaadet;
5. ET/EN/RU UI-tekste;
6. masinloetavaid golden-, privaatsus-, hydration- ja UI-lepinguteste.

U7 v1 **ei sisalda**:

- dokumentide ega U10 `tone=plain` vaikeväärtuse muutmist;
- teenuseosutaja `communication_support_options.simple_language` filtri või
  kuvamise sidumist kasutaja eelistusega;
- uut DB mudelit, veergu ega migratsiooni;
- vabatekstilist prompti, kasutaja küsimuse uut logimist ega serveripoolset
  tundliku profiili lugemist;
- kriisi-, nõusoleku-, privaatsus-, riski- või kohustuslike väljade peitmist.

## 3. Teostusplokid

### U7-A — eelistus ja hydration

- lisa `plainLanguage: false` vaike-eelistusse;
- normaliseeri väärtus rangelt `=== true`;
- kanna väärtus cookie's, localStorage'is, esmase renderi DOM dataset'is ja
  `AccessibilityModal` salvestus-/preview-lepingus;
- puuduv legacy-väli jääb `false`-ks;
- hiline hydration ei tohi uuemat kasutaja valikut tagasi kirjutada;
- UI-s on tekstiline nimi ja mõju selgitus, mitte ainult ikoon.

### U7-B — chat

- `ChatBody -> useChatStream` annab edasi ainult normaliseeritud booleani;
- `bootstrapChatRequest` loeb ainult literal `true`; string, objekt või muu kuju
  ei aktiveeri režiimi;
- server lisab ET/EN/RU konstantse `PLAIN_LANGUAGE_MODE` instruktsiooni;
- instruktsioon nõuab lühikesi lauseid, üht mõtet lõigus, seletatud termineid ja
  konkreetseid samme, kuid keelab tingimuste, erandite, ebakindluse, numbrite,
  kuupäevade, allikaviidete või kriisijuhiste eemaldamise;
- dokumentide genereerimise haru ei saa U7 instruktsiooni.

### U7-C — juhendatud eelpöördumine

- sama töövoog, küsimused ja salvestuskuju;
- selge keele režiimis on kogumise etapis korraga nähtav kas põhiinfo või
  assistendi täpsustusvaade;
- mõlemad vaated on tekstiliste nuppudega alati avatavad;
- põhiinfo vaikevaade sisaldab nõusoleku-, kiireloomulisuse-, riski- ja
  olukorravälju;
- ülevaade, adressaat, eelvaade ja saatmine jäävad samasse sammuahelasse;
- režiim ei kirjuta ega lihtsusta kasutaja teksti automaatselt.

### U7-D — i18n, kvaliteediväravad ja regressioonid

- ET/EN/RU võtmepariteet;
- preference parse/save/hydration ja DOM dataset;
- request-to-prompt integratsioon ja prompt-injection'i negatiivne test;
- 12 golden-juhtumit: allikaviited, numbrid, tähtajad, tingimused,
  ebakindlusmarkerid ning kriisijuhis;
- eelpöördumise density-test tõendab, et korraga on üks kogumisvaade, aga
  kaitseküsimused ja mõlemad avamisnupud säilivad;
- regressioonitest tõendab, et `plainLanguage` ei ole seotud
  `simple_language` teenusefiltriga;
- muudetud failide lint, sihttestid, kogu testikomplekt, i18n, Prisma validate,
  CSS budget ja production build.

## 4. Privaatsus- ja turvaleping

1. `plainLanguage` on esitus-eelistus, mitte autoriseerimisotsus.
2. Server ei usalda kliendi teksti ega lisa seda süsteemiprompti.
3. Režiim ei muuda andme- ega allikaskoopi.
4. Allikad, tähtajad, arvud, tingimused, erandid ja ebakindlus peavad säilima.
5. Otsese ohu 112-juhis jääb prioriteetseks ja muutmata.
6. Eelpöördumise privaatsus- ja nõusolekuväravad jäävad nähtavaks.
7. Kasutaja algtekst ja salvestatud mustand ei muutu režiimi lülitamisel.

## 5. Visuaalne suund

U7 ei loo eraldi “lihtsat rakendust”. Visuaalne suund on olemasoleva SotsiaalAI
rahuliku ja sooja tööruumi **toimetatud selgus**:

- vähem korraga konkureerivaid plokke;
- üks nähtav valik korraga, selge aktiivne olek ja tugev tekstiline hierarhia;
- olemasolevad tokenid, fookuserõngad ja reduced-motion leping;
- desktop ja mobile kasutavad sama semantikat.

## 6. Failipiirid Opuse paralleelse U6 tööga

Soli U7 omab accessibility providerit/modaali, chat request bootstrap'i ja
prompt-adapterit, eelpöördumise U7 vaadet, U7 i18n võtmeid ning U7 teste.

Opuse U6 ei tohi neid faile muuta. Sol ei muuda U6 vestlusloendi otsingu API-t,
ChatSidebari otsingut ega U6 progressidokki. Jagatud i18n failide konflikt
lahendatakse alles pärast mõlema külmutatud paketi sõltumatut kontrolli.

## 7. Progressipäevik

### 2026-07-14 — Etapp 0

- eraldi worktree ja haru loodud värskest `origin/main`-ist;
- faili 13 §7 ja §13 täielik U7 sisend loetud;
- olemasolev cookie/localStorage hydration, chat request/prompt ja
  eelpöördumise sammumudel kaardistatud;
- kinnitatud: skeemi/migratsiooni pole vaja;
- tööplaan lukustatud; rakenduskoodi pole veel muudetud.

## 8. Täpne jätkamispunkt

### 2026-07-14 — U7-A preference ja hydration

- `plainLanguage` lisatud legacy-safe vaikeväärtusega `false`;
- cookie, localStorage, server-renderi DOM dataset, hydration, preview ja save
  normaliseerivad väärtuse rangelt `=== true`;
- ligipääsetavuse dialoogis on tekstiline nimi, valik ja mõju selgitus;
- brauserikontrollis muutus `data-plain-language` kohe väärtuseks `1` ning jäi
  pärast salvestamist ja reload'i väärtuseks `1`;
- 390×844 vaates oli dialoogi laius 360 px ja `scrollWidth === clientWidth`,
  seega uut horisontaalset ülevoolu ei tekkinud.

### 2026-07-14 — U7-B chat

- `ChatBody -> useChatStream -> bootstrapChatRequest` saadab ja loeb ainult
  literal booleani;
- string `"true"`, arv, objekt, massiiv ja promptilaadne tekst jäävad `false`;
- server lisab tavavestluse põhivastuse teele lokaliseeritud
  `PLAIN_LANGUAGE_MODE` konstandi;
- dokumentide ja help-workflow varased harud lõppevad enne U7 instruktsiooni
  lisamist; dokumendi tooni ei muudeta;
- prompt nõuab selgeid samme ja terminite selgitamist, aga keelab allikate,
  kuupäevade, tähtaegade, arvude, tingimuste, erandite, ebakindluse ja
  112-juhise muutmise või eemaldamise;
- preference'i ega kasutaja küsimust ei lisatud uude logisse.

### 2026-07-14 — U7-C juhendatud eelpöördumine

- selge keele režiimis kuvatakse kogumisetapis korraga üks kahest vaatest:
  `Täida põhiinfo` või `Küsi assistendilt`;
- mõlemal tekstinupul on `aria-pressed`, tugev fookusolek ja mobiilis
  üheveeruline paigutus;
- põhiinfo on vaikevaade ning sisaldab sama nõusoleku-, kiireloomulisuse-,
  riski- ja olukorrakontrolli;
- mõlemad vaated kasutavad senist state'i, küsimusi, assistenti ja
  salvestuspayloadi; lülitamine ei kirjuta kasutaja teksti ümber;
- teenuseosutaja `communication_support_options.simple_language` jääb eraldi
  võimekuseks ega mõjuta U7 eelistust või teenusekaardi filtreid.

### 2026-07-14 — U7-D i18n ja kvaliteediväravad

- ET/EN/RU dialoogi-, eelpöördumise- ja kasutusjuhendi tekstid lisatud;
- lisatud 12 masinloetavat golden-juhtumit ja fail-closed negatiivsed
  invariant-testid;
- lisatud bootstrap'i prompt-injection, persistence/hydration,
  request-serialiseerimise, eelpöördumise density ning `simple_language`
  eraldatuse regressioonitestid.

## 9. Lõppkontroll

Kõik kontrollid jooksid U7 worktree's pärast viimast rakenduskoodi ja i18n
muudatust.

| Kontroll | Tulemus |
|---|---|
| U7 sihttestid | **12/12 roheline** |
| kogu repo `npm test` | **1234/1234 roheline** |
| muudetud failide ESLint | **0 viga**; 27 varasemat hardcoded-string hoiatust suures `WorkspaceFeaturePage.jsx` failis |
| `npm run i18n:check` | **ET/EN/RU OK** |
| `npm run css:budget` | **52/52, OK** |
| `prisma validate` | **skeem valid** |
| `npm run build` | **production build OK** |
| `git diff --check` | **OK** |
| brauser: desktop + 390×844 | **toggle, reload-püsivus ja mobiili ülevool OK** |

Prisma generate jaoks kasutati ainult lokaalselt sünteetilist ühendusstringi;
andmebaasiga ühendust ei loodud. U7 ei muuda skeemi, migratsioone ega env-faile.

## 10. Muudetud vertikaal

### Runtime

- `components/accessibility/AccessibilityProvider.jsx`
- `components/accessibility/AccessibilityModal.jsx`
- `app/layout.js`
- `components/alalehed/ChatBody.jsx`
- `components/chat/hooks/useChatStream.js`
- `lib/chat/plainLanguage.js`
- `lib/chat/requestBootstrap.js`
- `lib/chat/mainRouteRuntime.js`
- `app/api/chat/route.js`
- `lib/chat/systemPrompts/et.js`
- `lib/chat/systemPrompts/en.js`
- `lib/chat/systemPrompts/ru.js`
- `components/workspace/WorkspaceFeaturePage.jsx`
- `app/styles/workspace.css`
- `messages/et.json`, `messages/en.json`, `messages/ru.json`

### Testid

- `tests/chat/plainLanguage.test.js`
- `tests/chat/plainLanguageRequest.test.js`
- `tests/workspace/plainLanguagePreferenceContract.test.js`
- `tests/preInquiries/plainLanguageModeContract.test.js`

## 11. OPUSE SÕLTUMATU AUDITI ÜLEANDMINE

Auditeeri haru `codex/u7-plain-language` aktiivse koodi vastu. Prioriteetsed
kontrollid:

1. tõenda request-to-prompt ahel ning literal-boolean fail-closed piir;
2. kontrolli, et U7 instruktsioon ei jõua dokumendi genereerimise harusse ega
   muuda retrieval'it, allikaskoopi või õigusi;
3. kontrolli ET/EN/RU promptide invariantide täielikkust, eriti uncertainty,
   tingimusi ja sõna-sõnalist 112-juhist;
4. kontrolli cookie/localStorage/SSR/hydration latest-value käitumist;
5. kontrolli eelpöördumises mõlema vaate avatavust ning seda, et consent,
   urgency, risk ja salvestuspayload ei kao ega muutu;
6. kontrolli, et U7 `plainLanguage` ja teenuseosutaja `simple_language` ei ole
   seotud;
7. korda sihttestid, kogu testikomplekt, i18n ja build.

Merge main-i ja deploy on enne `OPUS HEAKS KIIDETUD` otsust keelatud. U7 ei
vaja DB migratsiooni ega env-muudatust. Täpne jätkamispunkt on Opuse audit;
Soli teostuses ei ole teadaolevat P0/P1 blokeerijat.

---

## OPUSE SÕLTUMATU AUDIT — U7 (2026-07-14)

> **VERDIKT: `OPUS HEAKS KIIDETUD`** — P0 puudub, P1 puudub. Merge on lubatud.
> Kolm P2-tähelepanekut allpool; ükski ei blokeeri.

- Auditeeritud: `codex/u7-plain-language` @ `657d3c68`, baas `aef93393`. Read-only.
- Mudel/effort: Opus 4.8, Extra (xhigh).
- Jooksutasin ise: U7 sihttestid **12/12**, kogu repo `npm test` **1234/1234**, `i18n:check` OK.

### 1. Kõik neli minu §13 sisendi muudatust on rakendatud

| Minu nõue (doc 13 §13) | Teostus | Otsus |
|---|---|---|
| Golden-testid vajavad **masinloetavat negatiivset invarianti** | `lib/chat/plainLanguage.js` — `evaluatePlainLanguageInvariant` viie kaitstud klassiga: allikaviited, arvud/tähtajad, tingimuslaused, ebakindluse markerid, kriisijuhis | ✅ |
| **U7-D (dokumendid/U10) v1-st välja** | dokumendi-/generation-/meeting-faile diffis **ei ole** (kontrollisin faililoendit) | ✅ |
| Test, et `plainLanguage` **ei ole seotud** `simple_language` filtriga | `tests/preInquiries/plainLanguageModeContract.test.js` — „reader preference is not coupled to provider simple-language capability": eelpöördumise pind ei viita `simple_language`-le, teenuseprofiil ei viita `plainLanguage`-le, ja `simple_language` on endiselt osutaja võimekusena alles | ✅ |
| U7 võib alata **U1/U2-st sõltumatult** | baas `aef93393`, ei puuduta ühtegi U1/U2 faili | ✅ |

### 2. Turvakontroll — puhas

- **Prompt-injektsioon on võimatu.** `normalizePlainLanguagePreference(value) → value === true` (`plainLanguage.js:26`) ja `requestBootstrap.js:155` kutsub seda kliendi payload'i peal. **Iga mitte-`true` väärtus — string, objekt, süstitud tekst — muutub `false`-iks.** Kliendilt ei jõua promptini ühtegi baiti teksti.
- **Instruktsioon on serveri oma.** `buildPlainLanguageSystemInstruction(replyLang)` → `buildLocalizedExtraSystemInstruction("PLAIN_LANGUAGE_MODE")` → külmutatud ET/EN/RU kataloog. Test tõendab, et instruktsioon jõuab `input.at(-2)` system-rolli sõnumina täpselt sellisena.
- **Adapter on päriselt juhtmestatud** — `app/api/chat/route.js:319`: `...(plainLanguage ? [buildPlainLanguageSystemInstruction(replyLang)] : [])`. (Kontrollisin seda eraldi, sest just selle klassi viga — valmis moodul, mida keegi ei kutsu — oli U4-P1-1 ja U8-P1-1 juur.)
- **Eelistus ei anna uusi õigusi ega jäta jälge:** `plainLanguage` ei salvestata andmebaasi, ei logita ega lisata metadata'sse (kontrollisin `console.`/`prisma.`/`create(`/`update(`/`log`/`metadata` mustrite vastu). **Skeemi ei muudetud** — nagu §13-s soovitasin.
- **Hydration fail-closed:** vaikeväärtus `plainLanguage: false`, ja **iga** lugemiskoht kasutab `=== true` (cookie, DOM-dataset, merge, preview). Puuduv väli → `false`.
- **Juhendatud eelpöördumine ei peida kohustuslikku:** test tõendab `fields.consent`, `fields.urgency`, `riskGate.userVisibleMessage` ja muutmata `assessmentState` salvestuspayload'i säilimist. Režiim ei muuda salvestatud sisu.

### 3. Golden-invariant — korrektne mõlemas suunas

12 golden-juhtumit tõendavad, et kontrollija **ei anna valepositiive** legitiimsete lihtsustuste peal; „invariant gate fails closed" tõendab viie kaitstud klassi kohta eraldi, et kontrollija **püüab** rikkumise (`[SHS § 15]` → „seadust", `10 päeva` → „varsti", `kui` kaob, `võib` → `muutub`, kriisitekst asendatud). Kriisijuhis võetakse päris prompt-kataloogist (`langStrings(locale, "CLIENT").crisis`), mitte fixture'ist.

### 4. P2 — kolm tähelepanekut (ei blokeeri)

1. **Golden-testid tõendavad kontrollijat, mitte mudelit.** `GOLDEN_CASES` on **käsitsi kirjutatud** source/candidate paarid; mudelit testis ei kutsuta (repos ei ole live-mudeli teste, samamoodi nagu ei ole elavat DB-d). See on õige ja aus viis seda CI-s teha, ja **dokk ei ülepaku** — ütleb „masinloetavad golden-testid", mitte „tõendab, et mudel säilitab faktid". **Aga:** §7.4 valmisoleku kriteerium („golden testid näitavad, et faktid/allikad/erandid ei kao") on praegu täidetud ainult **tööriista tasemel**. Enne kui režiimi saab pidada tootmises tõendatuks, tuleb harness päris mudeli väljundite vastu jooksutada — see eval on veel võlgu. Soovitan selle kirjutada §7.4 juurde ausalt välja.
2. **Kriisijuhise invariant kontrollib olemasolu, mitte asukohta.** ET-prompt nõuab: „säilita see juhis sõna-sõnalt **ja esimesena**". `evaluatePlainLanguageInvariant` kontrollib ainult `candidateText.includes(exactCrisisInstruction)` (`plainLanguage.js:34–38`). Ümbersõnastus, mis matab 112-juhise vastuse lõppu, **läbib värava**. Kontrollija katab „sõna-sõnalt", mitte „esimesena" — lubaduse ja tõendi vahel on vahe. Parandus on väike (positsioonikontroll), aga see on tooteotsus: kas „esimesena" on kõva nõue või juhis.
3. **Merge-konflikti risk U6-ga.** U7 ja minu U6 muudavad mõlemad `messages/{et,en,ru}.json`. Konflikt on ootuspärane ja triviaalne, aga integratsiooni järjekord tuleb teadlikult valida.

### 5. Otsus

Merge on lubatud. P2-2 (kriisijuhise positsioon) tasub sulgeda enne, kui režiim laiemalt sisse lülitatakse; P2-1 (päris eval) on U7 valmisoleku aus järelejäänud võlg, mitte selle haru defekt.
