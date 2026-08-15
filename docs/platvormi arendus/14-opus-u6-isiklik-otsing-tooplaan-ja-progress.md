# U6 — isiklik otsing enda objektide üle

> **Staatus:** TÖÖPLAAN LUKUSTATUD — teostus algab
>
> **Koostatud:** 2026-07-14
>
> **Teostaja:** Claude Opus 4.8, Extra (`xhigh`) — iseseisev arenduspakett
>
> **Sõltumatu järelkontroll:** Sol (pärast paketi külmutamist)
>
> **Haru:** `opus/u6-personal-search` · **Worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-u6`
>
> **Baas:** `origin/main` @ `aef93393`
>
> **Merge ja deploy:** KEELATUD. Commit ja push on lubatud.
>
> **Paralleeltöö piir:** Sol teeb samal ajal U7. **Ei tohi puutuda:** U7 progressidokk, `AccessibilityProvider`, `plainLanguage` eelistus, U7 prompt-adapter, juhendatud eelpöördumise U7 vaade.

## 1. Probleem — mida täpselt parandatakse

Praegune „otsing" on **kliendipoolne filter juba laetud lehe peal** (`components/ChatSidebar.jsx:626–633`):

```js
const filteredConversations = useMemo(() => {
  if (!normalizedSearchQuery) return sortedConversations;
  return sortedConversations.filter(item => {
    const haystack = [item?.title, item?.preview, item?.id].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedSearchQuery);
  });
}, [normalizedSearchQuery, sortedConversations]);
```

`sortedConversations` tuleb `items`-ist, mille laadib `GET /api/chat/conversations` **vaikimisi 30 kirje kaupa** (`app/api/chat/conversations/route.js:135`, cursor-lehitsemine).

**Tagajärg: vale negatiivne.** 200 vestlusega kasutaja otsib „eluase", vestlus on olemas, aga asub 47. kohal → **tühi tulemus**. Kasutaja järeldab, et vestlust ei ole. See on usaldusmudeli seisukohalt halvem kui otsingu puudumine: süsteem vastab enesekindlalt ja valesti.

Lisaks: `activeView !== "conversations"` korral tühjendatakse päring (`:282–286`) ja **ruume ei filtreerita üldse** (`currentItems = isConversationView ? filteredConversations : sortedRooms`).

## 2. Tõendatud otsustusruum — mida v1 otsib

### 2.1 Otsustav leid: „metaandmete otsing" oleks REGRESSIOON

`GET /api/chat/conversations` **ei tagasta DB-veerge otse** (`route.js:218–221`):

```js
const previewSource = row.messages?.[0]?.content || row.summary || "";
const preview = trimPreview(previewSource);
const title = row.title || fallbackTitle(previewSource) || null;
```

Seega:

- **`preview` ON viimase sõnumi sisu**, mitte eraldi veerg — `Conversation`-il **ei ole** `preview` veergu;
- **`title` tuletatakse viimase sõnumi sisust**, kui `Conversation.title` on `null`.

→ Kui v1 otsiks ainult `title`/`summary` veergudest, **ei leiaks kasutaja vestlust selle pealkirja järgi, mida talle ekraanil näidatakse**. Otsing peab katma vähemalt selle, mis on täna nähtav ja otsitav.

**Lukustatud otsus:** v1 otsib `Conversation.title` **∪** `Conversation.summary` **∪** `ConversationMessage.content`. Sõnumisisu kaudu on kaetud nii `preview` kui tuletatud pealkiri; eraldi „viimase sõnumi" eritee ei ole vajalik ega Prismas puhtalt väljendatav.

### 2.2 Millised MUUD isiklikud objektid v1 hõlmab: **mitte ükski.** Tõendid iga välistuse kohta

| Kandidaat | Omanikuväli | Miks v1-st VÄLJA |
|---|---|---|
| `UserDocument` | `ownerId` (`@@index([ownerId, updatedAt])`) | Puhas omanikuskoop ja `title String` on olemas — **tehniliselt valmis**, aga tulemusel puudub sihtpind: ChatSidebar renderdab vestluskirjeid, dokumendil oleks vaja oma marsruuti ja kirjekuju. Globaalset otsingulehte ei ole olemas. v1 skoop on **vale negatiivse parandamine**, mitte uue ristotsingu-toote leiutamine. |
| `Journey` | `ownerUserId` | Sama: puhas skoop (`title`, `summary` mõlemad NOT NULL), aga sama puuduv sihtpind. |
| `PreInquiry` | `authorId` **ja** `recipientOwnerId` | **Väline põhjus, mitte mugavus.** Just ühendati audience-leping (`serializePreInquiry(inquiry, { viewerId })`, U1/U2 `SOL-U1U2-P1-1`), mis piirab teadlikult, mida kumbki pool näeb. Saadud pöördumise **keha** on teise inimese tekst minu objektis. Otsingu lisamine nõuab oma audience-otsust ja regressioonteste — see ei mahu selle paketi alla. |
| `Room` / `RoomMessage` | jagatud | Sisu on **teiste inimeste sõnumid**. „Enda objektide otsing" ei tähenda kaasvestlejate teksti indekseerimist. |
| `WellbeingOutputDraft` | `userId` | Tehniliselt omanikuskoobis, kuid privaatne eneserefleksiooni tekst. Selle toomine üldisesse otsingukasti on **tooteotsus**, mitte tehniline samm (vrd doc 10 §3.8: „olemasolu, pealkiri ega olek ei leki teisele rollile"). |
| `CovisionCase`, `TopicSeed` | omanik | Jagatud/erialane sisu; sama loogika mis ruumidel. |

**Lukustatud otsus:** **v1 = ainult vestlused.** Iga välistus on ülal põhjendatud. `UserDocument` ja `Journey` on lähimad v2 kandidaadid ning nende ainus takistus on UI sihtpind, mitte skoop ega turvalisus.

### 2.3 Lahknevus varasemast soovitusest (aus märge)

Doc 13 §12.4 / Soli §6.2 pakkusid **uut endpoint'i** `/api/workspace/search` nelja eraldi päringuga. **Kaldun sellest kõrvale.**

Põhjendus: `GET /api/chat/conversations` **omab juba tervet lepingut**, mida otsing vajab — autentimine, rate limit (`conversations_get`), omanikuskoop (`userId` + `archivedAt` + `expiresAt`), rollifilter, kolmeosaline keyset-cursor `(isPinned, lastActivityAt, id)` ning `preview`/`title` tuletus. Uus endpoint dubleeriks kõik need ja triiviks ajapikku laiali. Kuna v1 skoop on ainult vestlused, on **`q` parameetri lisamine olemasolevale route'ile** väiksem, ohutum ja ei loo teist tõeallikat.

Kui v2 lisab dokumendid/Teekonna, on `/api/workspace/search` siis õige koht — aga alles siis, kui on olemas sihtpind, mis neid kuvab.

## 3. Lukustatud tehniline leping

### 3.1 Server

- `GET /api/chat/conversations?q=...` — **olemasolev route, uus valikuline parameeter**;
- otsinguloogika elab eraldi puhtas moodulis `lib/chat/conversationSearch.js` (süstitav db + testitav ilma route'ita);
- `where` ehitatakse **olemasoleva `baseWhere` PEALE**, mitte selle asemel → omanikuskoop (`userId`), `archivedAt: null`, `expiresAt` ja rollifilter jäävad **muutmata kehtima**;
- otsingutingimus: `OR: [ {title: contains}, {summary: contains}, {messages: {some: {content: contains}}} ]`, kõik `mode: "insensitive"`;
- **järjestus ja cursor jäävad identseks** olemasolevaga (`[isPinned desc, lastActivityAt desc, id desc]`) → otsingutulemused on samas järjekorras kui loend ja `nextCursor` töötab muutmata kujul;
- `q` normaliseerimine: `trim()`; tühi/tühikutest koosnev `q` = **filtrit ei rakendata** (tavaline loend);
- pikkusepiir: **200 tähemärki**; ületamisel kontrollitud **400** `api.chat.search_query_too_long`;
- ILIKE-muster on Prisma `contains` (parameetriline) → SQL-injektsiooni pinda ei teki; `%`/`_` on PostgreSQL `LIKE`-mustris metamärgid, kuid Prisma `contains` escape'ib need ise.

**Pretsedent:** `lib/covisionCompletedCases.js:391–392` teeb juba täpselt sama kuju (mitme välja `OR` + `contains` + `mode: "insensitive"`) omanikuskoobi sees. Mustrit ei leiutata.

### 3.2 Jõudlus — teadlik piir

`messages: { some: { content: { contains } } }` genereerib `EXISTS`-alampäringu. Skann on **alati piiratud kasutaja enda vestlustega** (`userId` on `where`-i esimene tingimus ja indeksis `@@index([userId, isPinned, lastActivityAt])`). `ConversationMessage.content` on `@db.Text` ilma indeksita → suure ajalooga kasutajal on see seq-scan filtreeritud hulga peal.

**Otsus:** v1 ei lisa `pg_trgm`-i ega otsinguindeksit. Põhjendus: indeks ilma mõõdetud vajaduseta on spekulatsioon, ja `pg_trgm` nõuab eraldi migratsiooni + extensioni õigusi tootmises. Kui mõõdetud latents muutub probleemiks, on see eraldi ring. **See piirang on siin kirjas, mitte peidetud.**

### 3.3 UI

- `components/ChatSidebar.jsx` — kliendipoolne `filteredConversations` **asendatakse** serveripäringuga;
- päring on **debounce'itud** (250 ms) ja kasutab **`createLatestRequestGate`** mustrit (`lib/client/latestRequestGate.js`) → hiline vastus ei kirjuta uuemat üle;
- olekud: **laadimine**, **tühi tulemus** (eristub selgelt „pole vestlusi" ja „otsing ei andnud tulemusi"), **viga** (kordusvõimalusega);
- otsingurežiimis kuvatakse serveri tulemused; `q` tühjendamisel taastub tavaline cursor-loend;
- ruumide vaates otsingut v1-s ei muudeta (jääb praegune käitumine).

### 3.4 i18n

Uued võtmed ET/EN/RU pariteediga: `chat.sidebar.search.loading`, `chat.sidebar.search.no_results`, `chat.sidebar.search.error`, `chat.sidebar.search.retry`, `api.chat.search_query_too_long`.

## 4. Kohustuslikud testid

**Server (`tests/chat/conversationSearch.test.js`, süstitud fake-db):**

1. **ristkasutaja leke fail-closed:** teise kasutaja vestlus sobiva pealkirjaga **ei** tule tagasi; `where` sisaldab alati `userId`;
2. **vaste pärast esimest 30 kirjet:** 40 vestlust, vaste 35. kohal → leitakse (tõendab vale negatiivse kadumist);
3. otsib pealkirjast, kokkuvõttest **ja sõnumi sisust** (kolm eraldi juhtumit);
4. tühi/tühikutest `q` → filtrit ei rakendata;
5. üle 200 tähemärgi → 400, päringut ei tehta;
6. `q` ei tühista `archivedAt`/`expiresAt`/rolli skoopi;
7. cursor-lehitsemine töötab koos `q`-ga; järjestus stabiilne;
8. `mode: "insensitive"` — suur/väike täht ei loe.

**UI (source-contract, olemasoleva mustri järgi):** latest-request gate on kasutusel; laadimis-/tühja-/veaolek on eraldi renderdatud; badge/olek ei sõltu ainult värvist.

**i18n:** `npm run i18n:check`.

## 5. Kontrollipakett

`node --test` sihttestid → `npm test` → `npm run i18n:check` → `npm run lint` → `npm run build` → `git diff --check`.

## 6. Mitte-eesmärgid

- ei `pg_trgm`, otsinguindeksit ega ranking'ut;
- ei snippet'i/esiletõstet (nõuab eraldi privaatsusotsust);
- ei ristobjekti-otsingut (vt §2.2);
- ei ruumide/võõra sisu otsingut;
- ei migratsiooni — **skeemi ei muudeta**.

## 7. Progressipäevik

### 2026-07-14 — tööplaan lukustatud

- Baas: `origin/main` @ `aef93393`, worktree `SotsiaalAI-u6`, haru `opus/u6-personal-search`.
- Kaardistatud aktiivsest koodist: `ChatSidebar.jsx:620–633`, `app/api/chat/conversations/route.js:135–255`, `Conversation`/`ConversationMessage`/`UserDocument`/`Journey` mudelid, `lib/covisionCompletedCases.js:391–392`.
- Otsustav leid: `preview` = viimase sõnumi sisu, `title` tuletatakse sellest → ainult veerupõhine otsing oleks regressioon (§2.1).
- Lukustatud skoop: **ainult vestlused**, otsing üle `title ∪ summary ∪ messages.content`; iga muu objekti välistus on §2.2-s tõendatud.
- Lahknevus varasemast soovitusest: `q` olemasolevale route'ile, mitte uus `/api/workspace/search` (§2.3).
- Koodi veel ei muudetud.
- **Järgmine samm:** `lib/chat/conversationSearch.js` + route'i `q` + sihttestid.

### 2026-07-14 — teostus valmis, pakett KÜLMUTATUD, ootab Soli sõltumatut järelkontrolli

**Verdikt: OPUS VALMIS.** Haru ei ole `main`-i ühendatud ega deploy'itud.

- **Baas ja lõpp-HEAD:** `origin/main` @ `aef93393` → haru `opus/u6-personal-search`.
- **Muudetud failid:**
  - uus `lib/chat/conversationSearch.js` — puhas, süstitav otsingumoodul;
  - `app/api/chat/conversations/route.js` — valikuline `q`, 400 üle piiri, otsing ANDitakse omanikuskoobi peale;
  - `components/ChatSidebar.jsx` — kliendipoolne filter **eemaldatud**, asendatud debounce'itud serveripäringuga;
  - `messages/{et,en,ru}.json` — `api.chat.search_query_too_long` kõigis kolmes;
  - uued testid `tests/chat/conversationSearch.test.js` (11) ja `tests/chat/conversationSearchUi.test.js` (5).
- **Migratsioone ei ole. Skeemi ei muudetud.**

**Kontrollid (kõik ise jooksutatud):**

| Kontroll | Tulemus |
|---|---|
| U6 sihttestid | **16/16** |
| `npm test` | **1238/1238** (baasil 1222 → +16 on täpselt uued testid) |
| `npm run i18n:check` | OK (en/ru = et) |
| `npm run lint` (muudetud failid) | 0 viga |
| `npm run build` | läbis |
| `git diff --check` | puhas |

**Keskkonnamärkus:** värskes worktree's ebaõnnestusid `npm test` ja `build` esmalt genereerimata Prisma kliendi tõttu (`generated/prisma/client.ts` puudus; `.env` puudub worktree's). Lahendus: `DATABASE_URL="postgresql://placeholder..." npx prisma generate` — `generate` ei ühendu andmebaasiga, seega päris mandaate worktree'sse ei toodud. **Need tõrked ei olnud koodist.**

**Lahknevus lukustatud tööplaanist (§3.3) — aus märge:**

Tööplaan lubas `createLatestRequestGate` mustrit. **Ei kasutanud.** Põhjus: `fetchList` kutsub juba `abortRef.current?.abort()` **sünkroonselt enne** uue päringu alustamist, mis annab sama garantii (vanem päring katkeb enne, kui uuem algab), ja see on **kogu faili ühtne muster** kõigi selle fetch'ide jaoks. Teise mehhanismi toomine ainult ühte kutsekohta oleks tekitanud kaks konkureerivat konventsiooni samas komponendis. Latest-request gate jääb õigeks valikuks seal, kus abort'i mustrit ei ole.

**Mida Sol peaks järelkontrollis eriti vaatama:**

1. `applyConversationSearch` ANDib alati omanikuskoobi peale — kontrolli, et ükski tee ei saa `where`-i asendada (`conversationSearch.js:48–52`);
2. `messages: { some: { content } }` genereerib `EXISTS`-alampäringu — **teadlik jõudluspiir** on kirjas §3.2-s (ei `pg_trgm`, ei indeksit; skann on alati `userId`-skoobis);
3. `q` + cursor koos: järjestus ja keyset jäid muutmata, otsing ainult kitsendab;
4. üle 200 tähemärgi → 400 **enne** ühtegi DB-päringut (`route.js`, kontrollitud testiga);

## 11. Aardvarki käideldavusparandus (2026-08-15)

**TEHTUD.** Hilisem turvakontroll näitas, et §3.2 teadlik jõudluspiir võimaldas autentitud
kasutajal ühe märgi päringutega sundida `ConversationMessage.content` ajaloo kallist
alam-päringut. Parandus säilitab lukustatud U6 otsinguväljad, kuid seab indeksi tegeliku
kasutuspiiri järgi minimaalseks päringu pikkuseks kolm märki ning ei saada pooleliolevat
lühemat sisestust UI-st serverisse. `Conversation.title`, `Conversation.summary` ja
`ConversationMessage.content` said `pg_trgm` GIN-indeksid. API lükkab lühema otsepäringu
400-ga tagasi enne Prisma tööd; negatiivkontroll oli vana koodi peal punane.
5. tühi/tühikutest `q` = filtrit ei rakendata (mitte „tulemusi ei ole");
6. UI: `hasConversationSearch` kasutab `committedSearch`-i (seda, mida serverilt küsiti), mitte `searchQuery`-t (seda, mida parasjagu tipitakse) — muidu vilguks „tulemusi ei leitud" tippimise ajal.

**Teadlikud piirangud (dokumenteeritud, mitte peidetud):**

- v1 otsib **ainult vestlusi**; iga muu objekti välistus on §2.2-s tõendatud;
- jõudlus: `EXISTS` sõnumisisu peal ilma otsinguindeksita (§3.2);
- ei snippet'i/esiletõstet;
- ruumide vaates otsingut ei muudetud;
- kliendipoolne `sortedConversations` re-sort ignoreerib serveri `isPinned`-järjestust — **see on pre-existing käitumine**, mida ma ei muutnud.

**Commit/push/merge/deploy seis:** commit + push tehtud; **merge ja deploy TEGEMATA** (keelatud).

**Järgmine samm:** Sol teeb sõltumatu järelkontrolli. Opus auditeerib Soli U7 paketti alles siis, kui Sol märgib selle valmis ja külmutatuks.

---

## 9. OPUS — SOL-U6-P1-1 ja SOL-U6-P1-2 parandusring (2026-07-14)

**Mõlemad P1-d suletud. Verdikt: OPUS PARANDATUD, ootab Soli sihitud korduskontrolli.**

Soli mõlemad leiud olid **tõesed ja teravad**. Kontrollisin need ise koodist üle enne parandamist; kumbagi ei vaidlusta.

### 9.1 SOL-U6-P1-1 — suletud

**Kinnitasin:** `route.js:72` kutsus `isPlausibleConversationId`, mida fail ei impordi ega defineeri (import real 9 toob `isPlausibleChatId`). Viga oli `origin/main`-is juba enne minu diffi (`git show origin/main:app/api/chat/conversations/route.js:71`).

**Sol-il on õigus, et see on sellegipoolest minu paketi kohustus:** minu lukustatud §3.1 väidab, et otsing töötab koos cursoriga, ja minu UI saadab teisel lehel `q`+`cursor` koos. Katkise route'i peale ei saa seda lepingut heaks kiita.

- **Parandus:** `isPlausibleChatId` (`route.js:72`) — sama validaator, mida fail juba impordib ja mida ülejäänud route kasutab.
- **Regressioon:** `tests/chat/conversationSearchRoute.test.js` — **5 testi, mis kutsuvad päris `GET` eksporti** süstitud sõltuvustega (`deps.requireUser`, `deps.prisma`, `deps.enforceChatRateLimit`, rolli-resolverid). Katab: päris cursor-päring ei viska ja jõuab DB-ni; leht 1 → `nextCursor` → leht 2 koos `q`-ga; omanikuskoop mõlemal lehel; `archivedAt`/`expiresAt` säilivad; identne `orderBy` mõlemal lehel; **vigane cursor fail-closed** (5 kuju, route ei kuku); ülipikk `q` → 400 ilma DB-kutseta.

**Tõestasin, et test püüab vea päriselt:** keerasin paranduse ajutiselt tagasi → **4/5 testi kukkusid** `ReferenceError: isPlausibleConversationId is not defined`-iga; parandusega **5/5 roheline**.

**Miks minu eelmine test oli valepositiivne — õppetund, mille kirjutan välja:** `search keeps working alongside cursor pagination` **koostas `where`-objekti käsitsi** ega käivitanud kunagi `parseCursor`-it. See testis minu enda mudelit koodist, mitte koodi. Puhta mooduli test ja lähtekooditeksti test **ei asenda integratsioonipiiri läbivat testi**. 1238/1238 roheline oli selle vea suhtes sisutu.

### 9.2 SOL-U6-P1-2 — suletud

**Kinnitasin mõlemad harud:**

1. `finally { setBusy(false) }` oli **tingimusteta** → asendatud päring A sai kustutada laadimislipu ajal, mil B veel käis → UI renderdas kindla väite „Otsingule vastavaid vestlusi ei leitud" **poolelioleva otsingu peale**;
2. tehnilise vea korral renderdusid **korraga** `role="alert"` veateade **ja** `no_matches` → tehniline viga muutus sisuliseks valenegatiivseks. See on **täpselt see vea klass, mille eemaldamiseks U6 üldse olemas on** — oleksin selle veapoolel taastanud.

Lisaks: lukustatud §3.3 nõudis eraldi veaolekut **kordusvõimalusega** ja viit i18n-võtit; tarnisin ühe võtme ja mitte ühtegi kordusnuppu. Soli etteheide on põhjendatud.

**Parandus:**

- uus **puhas moodul** `lib/chat/sidebarListState.js` kahe otsusega:
  - `shouldSettleRequest(activeToken, token)` — ainult aktuaalne päring tohib olekut kirjutada;
  - `resolveListState({ busy, error, itemCount, hasSearch })` — **`loading` > `error` > `results` > `no_matches` > `empty`**. `error` edestab `no_matches`-i teadlikult: ebaõnnestunud päring **ei tõesta midagi** tulemuste olemasolu kohta.
- `ChatSidebar` kutsub mõlemat: `finally` on gate'itud, ka `setError` on gate'itud (asendatud päring ei kirjuta enam viga), render käib `listState` kaudu;
- **kordusnupp** veaoleku juures → `fetchList({ reset: true })` sama viimase `q`-ga;
- `chat.sidebar.search.retry` lisatud ET/EN/RU.

**Regressioon:** `tests/chat/sidebarListState.test.js` — **10 testi**, sh Soli nõutud stsenaarium juhitavate märkidega: A pooleli → B asendab A → A katkeb → **UI jääb `loading`-usse, `no_matches` ei teki**; 500/network → `error` nähtav, `no_matches` puudub; kordus → uus päring, vana viga kaob; ning eraldi test, mis **jäädvustab vana vigase käitumise** („ilma gate'ita väidab UI poolelioleva otsingu peale, et tulemusi ei ole"), et valve ei saaks vaikselt kaduda.

**Miks otsused on eraldi moodulis:** Sol-il on õigus, et source-regex ei tõenda seda lepingut. Repos ei ole jsdom-i ega testing-library't, seega ei saa komponendi olekut otse juhtida. Tõin mõlemad otsused sinna, kus neid **saab deterministlikult juhtida**, ja jätsin komponenti ainult juhtmestuse — mida lepingutest omakorda kontrollib.

### 9.3 Kontrollid pärast parandusi

| Kontroll | Enne | Pärast |
|---|---|---|
| `npm test` | 1238/1238 (valepositiivne) | **1255/1255** (+17: 5 route, 10 olek, 2 lepingut) |
| U6 sihttestid | 16 | **31** |
| Regressiooni tõendatus | — | **vigase koodi vastu 4/5 kukub, parandusega 5/5** |
| `i18n:check` | OK | OK (retry ET/EN/RU) |
| lint / build / `diff --check` | OK | **0 viga / kompileerus / puhas** |

### 9.4 Soli mitteblokeerivad tähelepanekud

Vaatasin need üle; ükski ei muuda paranduse suunda. Jäävad teadlikeks follow-up'ideks samas vormis nagu §7 piirangud.

### 9.5 Aus märge ulatuse kohta

`isPlausibleConversationId` viga **puudutab ka tavalist „laadi veel" teed**, mis oli katki juba enne U6-t. Parandasin selle, sest minu pakett sõltub sellest lepingust — aga see tähendab, et **see haru parandab ka pre-existing vea väljaspool U6 algset skoopi**. See on teadlik ja siin kirjas, mitte peidetud.

**Commit/push/merge/deploy:** commit + push tehtud; **merge ja deploy TEGEMATA**.

---

## 10. SOL — P1 parandusringi sihitud korduskontroll (2026-07-14)

**Auditeeritud commit:** `ada42497` (`opus/u6-personal-search`)

**Verdikt: SOL HEAKS KIIDETUD — SOL-U6-P1-1 ja SOL-U6-P1-2 on suletud; P0/P1 puuduvad; merge lubatud.**

### 10.1 SOL-U6-P1-1 — suletud

- `parseCursor` kasutab nüüd failis päriselt imporditud `isPlausibleChatId` validaatorit.
- Uus regressioon ei koosta enam oletuslikku `where`-objekti, vaid kutsub päris `GET` eksporti ning läbib `parseCursor`-i.
- Leht 1 → päris `nextCursor` → leht 2 koos `q`-ga jõuab DB-adapterini, säilitades omaniku-, arhiivi-, aegumise- ja järjestuslepingu.
- Vigane cursor ei põhjusta enam `ReferenceError`-it; ülipikk päring peatub enne DB-kutset.

### 10.2 SOL-U6-P1-2 — suletud

- Asendatud päringu `catch` ja `finally` kirjutused on seotud aktiivse `AbortController`-i identiteediga; eelkäija ei saa enam uue päringu laadimisolekut lõpetada ega viga üle kirjutada.
- Renderdusotsus on deterministlik: `loading > error > results > no_matches > empty`. Tehniline viga ei renderdu enam samaaegselt faktilise „tulemusi ei leitud” väitena.
- Kordusnupp käivitab sama aktiivse otsingu uuesti esimeselt lehelt ja retry-copy on ET/EN/RU kataloogis.
- Puhta olekumooduli testid katavad A → B → A abort → B error → retry → result järjestuse; komponendi lepingutest kinnitab, et komponent kasutab neid otsuseid päriselt.

### 10.3 Kontrollid

| Kontroll | Soli tulemus |
|---|---|
| U6 sihttestid | **33/33** |
| `npm test` | **1255/1255** |
| sihitud ESLint | **0 viga** |
| `npm run i18n:check` | **OK** |
| `npm run build` | **läbis** |
| `git diff --check 21b9f62f..ada42497` | **puhas** |

### 10.4 P2 — `contains` metamärkide test ja dokumentatsioon väidavad valet

`tests/chat/conversationSearch.test.js` väidab, et Prisma `contains` escape'ib `%` ja `_` automaatselt ning kontrollib selle tõendina ainult seda, et töötlemata tekst jõuab `contains` välja. Prisma ametlik PostgreSQL/MySQL dokumentatsioon ütleb vastupidist: `contains` kasutab `LIKE`/`ILIKE` mustrit, `%` ja `_` on metamärgid ning literaalse vaste jaoks tuleb need ise escape'ida. Seega test tõendab praegu täpselt vigast kuju; näiteks `_` võib vastata suvalisele märgile ja `%` suvalisele märgijadale.

See ei ole SQL-süst ega omanikuskoobi leke, sest väärtus on parameetriline ja `userId`-skoop säilib. Mõju on otsingu valepositiivsed vasted erimärke sisaldava päringu puhul, mistõttu ei blokeeri see merge'i. Parandus: lisa üks keskne LIKE-metamärkide escape-helper, kasuta seda kõigis kolmes `contains` harus ning testi helperi väljundit; enne deploy'd kinnita käitumine päris PostgreSQL-i vastu. Allikas: https://docs.prisma.io/docs/orm/v6/prisma-client/queries/filtering-and-sorting#filtering-faqs

### 10.5 P2 — edukas vastusetee tugineb ainult Fetch abort-lepingule

`ChatSidebar.fetchList` kontrollib aktiivse päringu identiteeti `catch`-is ja `finally`-s, kuid edukad `setItems`, cursor ja `setHasMore` kirjutused ei läbi `shouldSettleRequest` valvurit. Standardses brauseri Fetch-teostuses katkestab `AbortController` ka poolelioleva body lugemise ning JavaScript ei lase sündmusel katkestada juba jätkuvat sünkroonset setterite plokki; seetõttu ei tuvastanud ma sellest uut reprodutseeritavat P1-viga.

Siiski on dokumenteeritud väide „ainult aktuaalne päring tohib olekut kirjutada” koodis tugevam kui testitud garantii. Odav kaitsekindlus on lisada pärast body lugemist ja enne esimest edukat setterit `if (!shouldSettleRequest(abortRef.current, ac)) return;` ning lukustada selle juhtmestus regressiooniga. See muudab lepingu sõltumatuks fetch-adapteri või tulevase refaktori abort-käitumisest.

### 10.6 P3 — sihttestide arv

Parandusringi tabel ütleb 31, kuid paketi tegelik sihtkomplekt (`conversationSearch*` + `sidebarListState`) annab **33/33**. Täiskomplekti 1255/1255 number on korrektne.

**Täpne jätkamispunkt:** U6 võib merge'i minna. P2 metamärkide escape tuleks teha enne, kui otsingu erimärgikäitumist kasutajale rangelt literaalsena lubatakse; eduka vastusetee gate on soovitatav samas väikeses paranduses. U7 kordusauditit ei ole vaja teha — selle sõltumatu `OPUS HEAKS KIIDETUD` otsus jääb jõusse.
