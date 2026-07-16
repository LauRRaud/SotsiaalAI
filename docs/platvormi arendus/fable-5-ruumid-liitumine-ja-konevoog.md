# Ruumi audit

> Alustatud: 2026-07-16. Audit tehakse ükshaaval — iga osa lisatakse siia eraldi peatükina pärast valmimist.

---

## 1. `app/api/rooms/[roomId]/read/route.js` — ruumi loetuks märkimine

**Auditeeritud:** 2026-07-16 · 169 rida · ainus meetod `PUT`

### 1.1 Roll ja kontekst

Endpoint märgib ruumi praeguse kasutaja jaoks loetuks: uuendab `RoomMember.lastReadAt` ja sulgeb sama ruumi püsivad teavitused (`NotificationEvent.readAt`) ühes transaktsioonis.

- **Kutsuja:** ainult `components/rooms/useRoomMessages.js:60` (`markRead`) — fire-and-forget `fetch`, kliendipoolne throttle 5 s, vastust ei loeta.
- **`lastReadAt` tarbijad:** `app/api/rooms/route.js:169` (unreadCount = teiste autorite sõnumid, mis on uuemad kui `lastReadAt`) ja `lib/workspaceContinuity.js:139` (jätkuvuse koond).
- **Lepingutest:** `tests/notifications/notificationAdapters.test.js:106` kinnitab regex'iga, et route kutsub `markNotificationSourceRead` sourceType'iga `"ROOM"`.

### 1.2 Mis on korras

- **Auth-kett on täielik ja fail-closed:** 401 sessioonita → 404 olematu ruum → 403 mitte-liige (`leftAt: null` filter) → 403 billing-värav. Billing käib läbi jagatud `hasRoomBillingAccess` (`lib/rooms/access.js`) sama sisendikujuga nagu õdede-route'ides — õiguste drift'i pole.
- **Vesimärgi semantika on konservatiivne ja õige:** `lastReadAt` = uusima kustutamata sõnumi `createdAt` (mitte `now`), st päringu ajal saabuv uus sõnum jääb lugemata. Tühja ruumi puhul fallback `new Date()` — kahjutu.
- **Monotoonsus päringu sees:** `max(senine lastReadAt, uusim sõnum)` (read 143–146) — oma loetud seisu ei keerata tagasi.
- **Atomaarsus:** `$transaction` katab nii `lastReadAt` uuenduse kui teavituste sulgemise (read 147–161) — poolikut seisu ei teki.
- **Filtrite kooskõla:** `deletedAt: null` uusima sõnumi leidmisel ühtib unreadCount'i filtriga `app/api/rooms/route.js:164` — kustutatud sõnum ei tekita igavest "unread" seisu.
- **`"ROOM"` on valiidne sourceType** (`lib/notifications.js:74` SOURCE_TYPES sisaldab seda; valideeritakse ka runtime'is).
- **Cache-distsipliin:** `force-dynamic`, `revalidate 0`, `no-store` päised — õige kasutajapõhise oleku jaoks.
- **Params-ühilduvus:** `resolveRoomId` käsitleb nii objekt- kui Promise-kujulist `params`'it (Next 14/15).

### 1.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | Paralleelsete PUT'ide lost-update võib `lastReadAt` tagasi kerida |
| K2 | Madal | Teavituse `readAt` saab mineviku-templi (sõnumi `createdAt`), mitte tegeliku lugemisaja |
| K3 | Madal | No-op kirjutus igal PUT'il ka siis, kui midagi pole muutunud |
| K4 | Madal | Abifunktsioonid copy-paste'itud 8 API-failis (drift'irisk) |
| K5 | Info | `requireUser` catch → iga viga (ka DB-tõrge) muutub 401-ks |
| K6 | Info | `roomMember` select toob kasutamata välju |

**K1 — tagasikerimise race (read 143–156).** Stsenaarium: päring A loeb uusima sõnumi T1; saabub uus sõnum T2; päring B loeb T2 ja kirjutab `lastReadAt = T2`; A kirjutab seejärel T1, sest tema `max()` kasutas *enne* B commit'i loetud vananenud `member.lastReadAt` väärtust. Tagajärg: unreadCount hüppab hetkeks tagasi üles. Kliendi 5 s throttle teeb selle harvaks ja mõju on kosmeetiline. Parandus on odav — tingimuslik kirjutus transaktsioonis:
```js
tx.roomMember.updateMany({
  where: { roomId, userId: auth.userId, OR: [{ lastReadAt: null }, { lastReadAt: { lt: nextLastReadAt } }] },
  data: { lastReadAt: nextLastReadAt }
})
```
— monotoonsus garanteeritud DB tasandil, `max()`-loogika võib siis üldse ära jääda.

**K2 — `readAt` semantika (rida 160).** `markNotificationSourceRead` saab `now: nextLastReadAt`, st teavituse `readAt` = uusima *sõnumi* aeg, mitte hetk, mil kasutaja luges. Kuna reconciler loob ROOM_ACTIVITY event'i sõnumist hiljem, võib tekkida rida, kus `readAt < createdAt`. Täna ei tarbi miski `readAt`-i muuks kui null-kontrolliks, seega funktsionaalset viga pole — aga tulevase analüütika/sortimise jaoks on see varitsev anomaalia. Kui mineviku-tempel pole teadlik otsus, anna teavitustele päris `new Date()` ja jäta `nextLastReadAt` ainult `lastReadAt`'ile.

**K3 — puuduv no-op kiirtee.** Iga aktiivne vaataja käivitab ≤5 s tagant täistsükli: 4 lugemispäringut + transaktsioon 2 kirjutusega, ka siis kui uusi sõnumeid pole. `roomMember.update` kirjutab siis identse väärtuse üle. Lihtsaim võit: kui `member.lastReadAt >= latestReadAt`, jäta `roomMember.update` vahele ja jooksuta ainult teavituste `updateMany` (see peab jääma — reconciler võib olla loonud event'e ka pärast viimast lugemist). Oluline alles skaalal; praegu pigem märkus kui nõue.

**K4 — duplikatsioon.** `hasActiveSubscription`, `requireUser`, `json`/`errorJson`, `resolveRoomId` on identsetena kopeeritud 8 failis (`app/api/rooms/**`, `app/api/invites/**`). Ühe koopia muutmine (nt K5 parandus) tekitab vaikse käitumiserinevuse teistes. Soovitus: tõsta jagatud helperisse (nt `lib/api/roomAuth.js`) — eraldi refaktor, mitte selle faili sisene parandus.

**K5 — 401 varjab 500 (read 45–51).** `requireUser` catch-plokk tagastab iga erandi (sh sessioonipoe/DB tõrke) korral 401. *Selle* route'i puhul mõju puudub — kutsuja ignoreerib vastust täielikult —, aga sama koopia elab ka `messages`-route'is, kus klient reageerib 401-le login-vaate näitamisega. Ehtsa taustsüsteemi tõrke ajal näeks kasutaja "logi sisse" ekraani. Märkida drift'ina K4 refaktori jaoks.

**K6 — üleliigne select (read 108–115).** `role`, `roomId`, `userId`, `leftAt` tuuakse, aga route ei kasuta; `hasRoomBillingAccess` vajab ainult `billingSource`'i (ja objekti olemasolu). Tühine — parandada möödaminnes, kui faili nagunii puututakse.

### 1.4 Kokkuvõte

Route on tootmiskindel: turvakett terviklik, transaktsioon õige, semantika teadlikult konservatiivne. Kriitilisi ega keskmisi vigu pole. Kaks madalat robustsusparandust (K1 tingimuslik kirjutus, K2 `readAt` ajatempel) on mõlemad ühe-realised ja tasuks teha; K3–K6 on hügieen, mis sobib laiema room-API refaktori sisse.

---

## 2. `app/api/rooms/[roomId]/messages/[msgId]/route.js` — sõnumi kustutamine

**Auditeeritud:** 2026-07-16 · 175 rida · ainus meetod `DELETE` (soft-delete)

### 2.1 Roll ja kontekst

Endpoint kustutab ruumisõnumi pehmelt (`deletedAt` tempel) ja teatab sellest SSE kaudu (`publishRoomEvent` → `{type:"delete", id}`).

- **Kutsuja: PUUDUB.** Ükski frontend-kood ei tee `DELETE /api/rooms/{roomId}/messages/{msgId}` päringut (kontrollitud kõik `method: "DELETE"` fetch'id `components/` all). Vastuvõtupool on samas valmis: SSE delete-event'i käsitleja on olemas (`components/rooms/useRoomMessages.js:145–147`) ja i18n võtmed kõigis 3 keeles (`api.rooms.message_not_found`, `delete_message_failed`).
- **Õigusmudel:** ruumiroll (`RoomRole`: OWNER/MODERATOR/MEMBER, `prisma/schema.prisma:126`) — OWNER/MODERATOR kustutab kõike, MEMBER ainult enda oma.
- **Konvergents:** GET `messages` filtreerib `deletedAt: null` (`messages/route.js:212`) — ka polling-klient näeb kustutust, mitte ainult SSE.

### 2.2 Mis on korras

- **Auth-kett fail-closed:** 401 → liikmesus 403 (`leftAt: null`) → ruum 404 → billing 403 (jagatud `hasRoomBillingAccess`) → sõnum 404 → rollikontroll 403.
- **Sõnumipäring on ruumi-skoobitud** (`{id: msgId, roomId}`, read 130–134) — URL-i roomId/msgId ristsobitamisega ei saa võõra ruumi sõnumit kustutada.
- **Rollikontroll on tulevikukindel:** tundmatu roll ei saa mingeid õigusi; assistendi sõnumeid (authorId null) MEMBER kustutada ei saa, OWNER/MODERATOR saab.
- **Idempotentne vastus:** juba kustutatud sõnum → `ok: true` ilma uue kirjutuseta (read 143–149).
- **SSE distsipliin:** publish alles pärast DB-kirjutust, try/catch'is — striimitõrge ei kuku päringut; event'i kuju `{type:"delete", id}` klapib kliendi käsitlejaga täpselt.
- **Väike paralleelsus-pluss:** ruum + tellimus tuuakse `Promise.all`-iga (read 107–120) — read-route teeb samad päringud järjest.

### 2.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal (tooteotsus) | Endpoint on UI-st orvuks jäänud — kustutusnuppu pole kunagi külge ühendatud |
| K2 | Madal | find-then-update race: topelt-DELETE kirjutab `deletedAt` üle ja publitseerib SSE-event'i kaks korda |
| K3 | Madal | Olematu ruum annab siin 403, read-route'is 404 — õdede-endpoint'ide signaalid lahknevad |
| K4 | Madal | `canDelete` hügieen: asjatu `async`, kasutamata `roomId` param, eksitav nimi `userRole` |
| K5 | Info | Platvormi ADMIN-il pole modereerimisõigust ja admin-moderatsioonirada puudub üldse |
| K6 | Info | Juba-kustutatud vastus tuleb enne õiguskontrolli — liige saab sondeerida kustutusseisu |
| K7 | Info | Sama helper-duplikatsioon mis ptk 1 K4; `membership` findFirst ilma `select`'ita toob kõik veerud |

**K1 — orb-endpoint.** Kogu kustutusahel on kolmest otsast valmis (API, SSE-käsitleja, i18n), aga UI-nuppu pole — funktsioon jäi poolele teele. Kaks võimalust: (a) ühendada UI külge (sõnumi kontekstimenüü ruumivaates) või (b) teadlikult markeerida "tulevikuks valmis". Kuni otsuseta on see testimata, aga autenditud kasutajaile kättesaadav pind. Seotud tooteteema: soft-delete jätab sisu DB-sse/varukoopiatesse igaveseks (purge-poliitikat pole) — sama „vaikiv kustutusjääk" muster, mis on platvormil juba tuvastatud RAG-i poolel.

**K2 — kustutuse race (read 130–165).** Kaks paralleelset DELETE'i sama sõnumi pihta: mõlemad läbivad `findFirst` kontrolli enne kirjutust, mõlemad teevad `update` (teine kirjutab esimese `deletedAt` üle hilisema ajaga) ja mõlemad publitseerivad SSE-event'i. Klient on filtri tõttu idempotentne, seega nähtav kahju puudub — aga parandus teeb koodi ka lihtsamaks: asenda findFirst+deletedAt-haru+update atomaarse
```js
const result = await prisma.roomMessage.updateMany({
  where: { id: msgId, roomId, deletedAt: null },
  data: { deletedAt: new Date() }
});
// result.count === 0 → kas juba kustutatud või olematu (eelnev findFirst eristab)
```
NB: `canDelete` vajab `authorId`-d, seega üks eelnev loetud päring jääb — aga kirjutus muutub tingimuslikuks ja topelt-event kaob (publitseeri ainult kui `count > 0`).

**K3 — 403 vs 404 lahknevus.** Siin kontrollitakse liikmesust *enne* ruumi olemasolu (read 98–105 vs 107–121), read-route'is vastupidi. Olematu roomId → siin 403 ("forbidden"), seal 404 ("not_found"). Kumbki pole vale (403 lekib vähem), aga sama olukorra eri signaalid õdede-route'ides ajavad kliendi ja testid segadusse. Vali üks järjekord ja ühtlusta — loomulik koht on K7 jagatud helper.

**K4 — `canDelete` hügieen (read 54–57).** Funktsioon on `async` ilma ühegi `await`'ita, võtab `roomId` mida ei kasuta, ja parameeter `userRole` saab tegelikult *ruumirolli* (`membership.role`), samas kui route'is tähendab `auth.role` *globaalset* rolli. Nimi kutsub tulevast viga: kui keegi annab sisse `auth.role`, läheb kõik vaikselt fail-closed lukku (globaalsed rollid ei kattu RoomRole väärtustega). Ümbernimetus `memberRole` + `async`/`roomId` eemaldus on 2-minuti parandus.

**K5 — moderatsioonirada puudub.** Globaalne ADMIN saab billing-möödapääsu, aga kustutamisel erikohtlust ei saa: mitte-liikmena blokeerub 403-ga, liikmena kehtib talle tavaline MEMBER-reegel. Admin-API-s ei puutu roomMessage'it ükski route peale analüütika (kontrollitud `app/api/admin/**`). Kui "ka admin ei näe/ei muuda ruumide sisu" on teadlik privaatsusotsus, väärib see dokumenteerimist; kui mitte, on moderatsioonivõimekus (nt õigusvastase sisu eemaldamine) lihtsalt puudu.

**K6 — kustutusseisu sondeerimine (read 143–149).** Juba-kustutatud sõnumi `ok: true` tagastatakse enne `canDelete` kontrolli — iga billing'ut läbiv liige saab msgId kaupa küsida, kas sõnum on kustutatud. Ruumi sees on see sisuliselt ohutu (liige näeb sõnumeid nagunii ja kustutatu kadumine on GET-ist näha), aga kontrollide järjekord on põhimõtteliselt tagurpidi. K2 atomaarse ümberehitusega kaob haru iseenesest.

**K7 — duplikatsioon ja select.** `requireUser`/`hasActiveSubscription`/`json`/`errorJson` on sama copy-paste pere, mis ptk 1 K4 (8 faili). Lisaks toob `membership` findFirst (read 98–104) ilma `select`'ita kõik RoomMember veerud, sh sponsorväljad, mida vaja pole — read-route'is on select olemas. Läheb sama jagatud-helperi refaktori sisse.

### 2.4 Kokkuvõte

Tehniliselt on route korras: turvakett terviklik, ruumi-skoobitud päring välistab ristkustutuse, SSE-leping klapib kliendiga ja soft-delete konvergeerub ka polling'us. Ühtegi kriitilist ega keskmist viga pole. Suurim asi pole kood, vaid seis: **endpoint on UI-st orvuks jäänud** — kustutusfunktsioon tuleb kas lõpuni ühendada või teadlikult parkida, ja platvormi ADMIN-i moderatsiooniküsimus (K5) vajab tooteotsust. Koodiparandused (K2 atomaarne updateMany, K3 järjekorra ühtlustus, K4 ümbernimetus) on kõik väikesed ja sobivad ühte commit'i.

---

## 3. `app/api/rooms/[roomId]/calls/route.js` — aktiivse kõne seis

**Auditeeritud:** 2026-07-16 · 29 rida route'is (sisu elab `lib/calls/roomRoutes.js` + `lib/calls/service.js`) · ainus meetod `GET`

### 3.1 Roll ja kontekst

Tagastab ruumi aktiivse kõne täisseisu (osalejad, sõnavõtusoovid, salvestustaotlus koos nõusolekutega) või `call: null`, pluss runtime-konfiguratsiooni (provider, maxParticipants, salvestuslipud) ja `canModerate` lipu.

- **Kutsuja:** ainult `components/rooms/useRoomCall.js` `load()` — pollib iga 5 s, kui ruumivaade on lahti, pluss iga kõnetoimingu järel.
- **Arhitektuurikontrast ptk 1–2-ga:** kõnede pere kasutab **jagatud helpereid** (`lib/calls/roomRoutes.js`: `requireRoomCallAccess`, `callJson`, `statusForCallError` jt) copy-paste asemel — ptk 1 K4 refaktorisoovitus on siin sisuliselt juba teostatud. Auth-järjekord on ka "õige": ruum 404 *enne* liikmesuse 403 (nagu ptk 1; ptk 2 K3 anomaalia kinnitub).

### 3.2 Mis on korras

- **Auth-kett fail-closed** (`requireRoomCallAccess`): 401 → 400 tühi id → 404 ruum → 403 mitte-liige → 403 billing (sama jagatud `hasRoomBillingAccess`).
- **Privaatsusteadlik serialiseerimine:** e-mail tuuakse DB-st (requestedBy/consents include), aga **ei jõua kunagi väljundisse** — `displayNameFor` kasutab ainult displayName'i või profiilinime; kovisiooni kõnedes asendatakse userId-d participantId-dega ja recording eemaldatakse üldse.
- **Config-plokk ei leki saladusi** — ainult feature-lipud (providerKey, maxParticipants, recordingEnabled, egress).
- **Klient on kaitstud:** `readPayload` talub mittevastavat vastusekeha ja iga toiming setib vea-oleku; polling konvergeerib kõneseisu ka SSE-välise kliendi jaoks.
- **`canModerate`** arvutatakse serveris ja klient usaldab seda ainult UI näitamiseks — päris õiguskontroll on igal POST-route'il eraldi.

### 3.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | GET-il puudub try/catch — DB-tõrge murrab `{ok, messageKey}` vealepingu, mida kõik õed-route'id hoiavad |
| K2 | Madal | `call.providerAvailable` valetab: getRoomCall ei edasta lippu → serialiseerub alati `true` |
| K3 | Madal | `recording.myConsent` on selles voos surnult `null` — klient kompenseerib fallback-otsinguga |
| K4 | Info | Nähtavate salvestusstaatuste loend dubleeritud (service.js:19 vs roomRoutes.js:178) — praegu sünkroonis, drift'irisk |
| K5 | Info | Kaks paralleelset "kõne → vastus" laadijat (service `loadCallState` vs roomRoutes `loadCallForResponse`) |
| K6 | Info | ADMIN-i tellimuspäring jookseb asjata; moderatsioonifilosoofia lahkneb sõnumite omast |

**K1 — puuduv try/catch (route read 13–15).** `service.getRoomCall` Prisma-päringud on ilma püünisteta: DB-tõrge annab Next'i vaikimisi 500 ilma `{ok:false, messageKey}` kujuta. Kõrvalseisev `start`-route teeb täpselt õigesti (try/catch + `statusForCallError`), nii et parandus on 3 rida sama mustrit. Kasutajamõju on täna leebe — kliendi `readPayload` viskab generic-vea ja UI näitab "call.request_failed" —, aga leping on katki ja polling logib iga 5 s serveri-erindi.

**K2 — valetav `providerAvailable` (service.js:909–919, 210).** `getRoomCall` ei anna `serializeCallSession`'ile `providerAvailable` extrat, mistõttu vaikeväärtus `extras.providerAvailable !== false` → alati `true`, ka siis kui LiveKit on seadistamata. Route'i eraldi `config.providerAvailable` on õige ja klient kasutab täna just seda (`RoomCallBar.jsx:80`) — kasutajaviga pole, aga väli on miin igale tulevasele tarbijale, kes loeb `call.providerAvailable`. Parandus: edasta `providerAvailable: getCallRuntimeConfig().callServiceConfigured` (või konsolideeri K5 kaudu).

**K3 — surnud `myConsent` (service.js:142–144, 909–919).** `getRoomCall` ei saa `currentUserId`-d, seega `recording.myConsent` on ruumi-GET-is alati `null`; klient teeb ise `consents.find(c => c.userId === userId)` (`RoomCallBar.jsx:86`). Kaks puhastusvarianti: anna `access.userId` route'ist läbi (`getRoomCall({ roomId, currentUserId })`) või eemalda väli sellest rajast. NB kui väli kunagi täituma hakkab: praegune implementatsioon tagastaks *toore* consent-rea (mitte mapitud kuju nagu `consents[]` massiivis) — ühtlusta samal käigul.

**K4 — staatuste loendi duplikaat.** `VISIBLE_RECORDING_STATUSES` (service.js:19) ja roomRoutes.js:178 kõva loend on täna identsed (7 staatust), aga keegi ei valva sünkroonsust. Ekspordi konstant service'ist ja kasuta mõlemas.

**K5 — kaks laadijat.** `getRoomCall` → `loadCallState` + serialize (service'i sees) ja `loadCallForResponse` (roomRoutes, kasutavad POST-route'id) teevad sama asja eri nüanssidega: viimane edastab `providerAvailable` õigesti, esimene mitte (→ K2); staatuste loend on kummalgi oma (→ K4). Üks kanooniline laadija service'is kaotaks K2 ja K4 juurpõhjuse.

**K6 — ADMIN-i nüansid.** (a) `requireRoomCallAccess` käivitab `hasActiveSubscription` alati (roomRoutes.js:112), ka ADMIN-ile, kelle tulemus visatakse billing-väravas nagunii minema — ptk 1/2 route'id skipivad selle päringu ADMIN-i puhul. Üks tingimus säästaks päringu igalt pollilt. (b) `canModerate` annab globaalsele ADMIN-ile kõnede üle moderaatoriõiguse (roomRoutes.js:123), samas kui sõnumite kustutuses (ptk 2 K5) ADMIN-il eriõigusi pole — kaks featuret kannavad eri moderatsioonifilosoofiat, vali teadlikult üks. (c) Pisiasi: admini tuvastus käib kahe eri signaaliga (`session.user.isAdmin === true` ja `userRole === "ADMIN"`) — kui üks neist on legacy, koonda.

### 3.4 Kokkuvõte

Kõnede GET on ptk 1–2 route'idest küpsema arhitektuuriga: jagatud helperid, õige kontrollijärjekord, privaatsusteadlik serialiseerimine (e-mailid ei leki, kovisioon pseudonümiseeritud). Kriitilisi ega keskmisi vigu pole. Kolm madalat on kõik "viimistlemata serialiseerimislepingu" pere: puuduv try/catch (K1, 3-realine parandus kohe), valetav `providerAvailable` (K2) ja surnud `myConsent` (K3) — K5 konsolideerimine laheneks K2+K4 juurpõhjusena. Tooteotsusena vajab ühtlustamist moderatsioonifilosoofia (K6b): kõnedes ADMIN modereerib, sõnumites mitte.

---

## 4. `calls/join|leave|end/route.js` — kõnega liitumine, lahkumine, lõpetamine

**Auditeeritud:** 2026-07-16 · 3 route'i (43+41+39 rida) + service-funktsioonid `joinCall`/`leaveCall`/`endCall` (`lib/calls/service.js:1009–1097`) ja `ensureParticipant`/`endCallAndWriteSystemMessage` (read 316–356)

### 4.1 Roll ja kontekst

Kolm POST-route'i jagavad identset skeletti: `readRoomId` → `requireRoomCallAccess` → body-parse → `callSessionId` (body-st või aktiivse kõne fallback) → `requireCallInRoom` (ruumi-skoobitus) → service-toiming try/catch + `statusForCallError` sees. Kutsuja: `useRoomCall.js` (`start`→`join` ahel, `leave`, `end`).

- **join:** cap-kontroll → `ensureParticipant` (HOST alustajale) → avatud salvestustaotluse korral consent-ridade loomine → LiveKit token → värske seis vastusesse.
- **leave:** osaleja `leftAt` (atomaarne updateMany, idempotentne) → sõnavõtusoovi tühistus → kui aktiivseid 0, salvestuse stopp + kõne lõpp + süsteemsõnum ruumi.
- **end:** ainult alustaja või `canModerate` → salvestuse stopp → kõik osalejad välja → sõnavõtusoovid tühistatud → kõne ENDED + süsteemsõnum.

### 4.2 Mis on korras

- **Vealeping terviklik:** kõik kolm on try/catch + `statusForCallError` sees — täpselt see muster, mille puudumist ptk 3 K1 GET-ile ette heitis.
- **Ruumi-skoobitus:** `requireCallInRoom({id, roomId})` välistab võõra ruumi kõne manipuleerimise ka siis, kui callSessionId tuleb body-st.
- **Õigusmudel loogiline:** liituda/lahkuda saab iga billing'ut läbiv liige; lõpetada ainult alustaja või moderaator; HOST-roll taastub alustaja taasliitumisel (oluline, sest salvestustaotlus nõuab HOST-i või moderaatorit).
- **Lahkumine on idempotentne** (updateMany ei nõua osaleja olemasolu) ja viimase lahkuja auto-lõpetamine hoiab ära ripakil "tühjad aktiivsed kõned" — tavajuhul.
- **Tühja kõne lõpp koristab kõik:** osalejad, sõnavõtusoovid, aktiivne salvestus.
- **`join` vastus on ainuke, kus `myConsent` päriselt täitub** (serialize saab `currentUserId`, service.js:1040) — token ja `livekitUrl` lähevad ainult õigustatud liitujale.

### 4.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** | Hiline liituja salvestatakse ilma nõusolekuta — ACTIVE salvestus ei peatu ega väravata liitumist |
| K2 | Madal | Vastuseta lahkuja consent-rida lukustab salvestustaotluse igaveseks (readiness ei arvutata leave'il ümber) |
| K3 | Madal | `CallParticipant`-il pole unikaalsuspiirangut + find-then-create → topeltliitumise duplikaatread; cap-kontroll TOCTOU |
| K4 | Madal | Kahe viimase üheaegne lahkumine (või end∥leave race) lõpetab kõne topelt → süsteemsõnum dubleerub |
| K5 | Madal | Süsteemsõnum kõvakodeeritud eesti keeles + Tallinna ajas; `senderType: ASSISTANT` inimese `authorId`-ga |
| K6 | Madal | `endCall` = 4+ kirjutust ilma transaktsioonita — poolik seis võimalik |
| K7 | Info | `emitCallEvent` fanout on tarbijata — klient ignoreerib `type:"call"` event'e, kogu sünk on 5 s polling |
| K8 | Info | `call.not_active` staatus lahkneb (404 route'is vs 409 service'is); `myConsent` täitub ainult join-vastuses |

**K1 — nõusolekuta salvestamine (service.js:1022–1029, 18).** Salvestusmudel lubab: salvestus algab alles siis, kui *kõik* osalejad on andnud selge nõusoleku (readiness-värav + nõusolekutekst "Kas nõustud selle helikõne salvestamisega?"). Aga `OPEN_RECORDING_STATUSES` sisaldab `ACTIVE`-t ja join loob hilisele liitujale lihtsalt REQUESTED consent-rea — **salvestus jätkub katkematult, kuigi uus inimene pole nõustunud** (readiness-recalc alandab ainult READY_TO_RECORD→REQUESTED, mitte ACTIVE-t; service.js:494). Tundliku sisuga platvormil on see privaatsuslubaduse rikkumine, mida UI-bänner ei asenda — server on lepingu autoriteet. Parandusvariandid: (a) blokeeri liitumine kuni salvestus käib ("kõne on salvestamisel, oota"), (b) pausi salvestus uue liituja nõusolekuni, või (c) nõua liitumisel eksplitsiitne "liitun ja nõustun" samm, mis kirjutab CONSENTED enne osalejaks saamist. Seotud lahtine küsimus (kuulub salvestus-route'ide auditisse): kas DECLINE keset ACTIVE salvestust peatab ka päris egress'i.

**K2 — readiness-tupik lahkumisel (service.js:1047–1072 vs 478–501).** Readiness nõuab, et *iga* consent-rida oleks CONSENTED, aga `leaveCall` ei puuduta salvestusseisu. Stsenaarium: A+B+C kõnes, A taotleb salvestust, C lahkub vastamata → C rida jääb REQUESTED → taotlus ripub "2/3 nõus" igavesti, kuigi kõnes on 2 inimest, kes mõlemad nõustusid. Taastatav ainult käsitsi (tühista + uus taotlus, mis loob read ainult kohalolijaile) — kasutajale arusaamatu. Parandus: leave'il eemalda lahkuja REQUESTED-rida (või markeeri kõrvale) ja kutsu `updateRecordingReadiness`; NB mitte märkida WITHDRAWN-iks — see DECLINE-iks kogu taotluse (rida 482).

**K3 — liitumise race'id (service.js:316–334, 1012–1015; schema.prisma:2903–2920).** `CallParticipant`-il on ainult tavaindeksid, unikaalsuspiirangut (callSessionId, userId, aktiivne) pole; `ensureParticipant` on find-then-create. Topeltklõps/kaks tabi → kaks aktiivset osalejarida samale kasutajale (participantCount +1 fantoom; leave'i updateMany koristab mõlemad — isetervenev). Cap-kontroll on samuti TOCTOU: kaks üheaegset liitujat mahuvad mõlemad "viimasele kohale". Nõusolekuread õnneks ei dubleeru (dedup userId järgi, service.js:505). Korralik parandus: osaline unikaalindeks `(callSessionId, userId) WHERE leftAt IS NULL` (raw migratsioon) + create-conflict'i püüdmine; kerge parandus: transaktsioon + uuesti-loend.

**K4 — topelt-lõpetamise race (service.js:1061–1070, 336–356).** Kaks viimast lahkuvad üheaegselt: mõlemad updateMany'vad oma rea, mõlemad loevad activeCount=0, mõlemad jooksutavad `endCallAndWriteSystemMessage` → `status: ENDED` kirjutatakse kaks korda (kahjutu) ja **"Helikõne toimus …" sõnum tekib ruumi kaks korda** (nähtav artefakt). Sama juhtub end∥leave paralleelsusega. Parandus samast perest nagu ptk 1 K1 / ptk 2 K2: tee lõpetamine tingimuslikuks (`updateMany({where: {id, status: "ACTIVE"}, data: {status: "ENDED"}})` ja kirjuta süsteemsõnum ainult siis, kui `count === 1`).

**K5 — süsteemsõnumi sisu (service.js:345–354).** Kolm asja ühes reas: (a) tekst on kõvakodeeritud eesti keeles, kuigi platvorm on 3-keelne ja lint keelab hard-coded JSX-teksti — serveripoolne sisu läheb lindist mööda; RU/EN kasutaja saab eestikeelse sõnumi; (b) `toLocaleString("et-EE", {timeZone: "Europe/Tallinn"})` naelutab ajavööndi; (c) `senderType: "ASSISTANT"`, aga `authorId` = kõne alustaja inimene — alustaja saab oma "süsteemsõnumit" ise kustutada (ptk 2 reegel MEMBER∧author) ja unreadCount käsitleb seda tema sõnumina. Puhtam: authorId null + senderType SYSTEM (kui enum lubab) või vähemalt i18n-võti + ISO-aeg, mille klient ise lokaliseerib.

**K6 — `endCall` pole transaktsioon (service.js:1074–1097).** Jada salvestus-stopp → osalejad välja → soovid tühistatud → ENDED+sõnum; kukkumine keskel jätab nt "kõik väljas, aga kõne ACTIVE" (järgmine leave küll lõpetaks) või "salvestus peatatud, kõne käib". Enamik seise on isetervenevad, aga `$transaction` ümber DB-sammude (provider-stopp väljas) oleks odav kindlustus — ja annaks K4 parandusele loomuliku koha.

**K7 — surnud fanout.** `emitCallEvent` publitseerib `{type:"call", call}` ruumi SSE-sse igal join/leave/end'il, aga ainus SSE-klient (`useRoomMessages.js:139–149`) käsitleb ainult `message` ja `delete` tüüpe — kõne-event'id liiguvad üle võrgu igasse lahtisesse ruumi-tabi ja visatakse minema. Kõnede UI sünkroonib ainult 5 s polling'uga (`useRoomCall.js:92–96`). Kas ühenda klient (kiirem kõne-UI, vähem polling'ut) või eemalda publish — praegu on see illusioon reaalajasüngist.

**K8 — pisilahknevused.** (a) Sama viga, kaks staatust: aktiivse kõne puudumine on route'is 404 (`join/route.js:29`), service-throw'na 409 (`statusForCallError`) — klient näitab sama teksti, aga status-põhine loogika käituks eri radadel erinevalt. (b) `myConsent` täitub ainult join-vastuses; GET (ptk 3 K3) ja leave (`loadCallForResponse`) annavad null — nüüd on kolm eri serialiseerimisvarianti sama objekti jaoks, mis kinnitab ptk 3 K5 konsolideerimisvajadust.

### 4.4 Kokkuvõte

Route'i-kiht ise on eeskujulik (jagatud helperid, ruumi-skoobitus, ühtne vealeping) — kõik sisulised leiud elavad service-kihis. **Üks keskmine viga: hiline liituja salvestatakse ilma nõusolekuta (K1)** — see väärib parandust enne, kui salvestusfunktsioon päris kasutusse läheb, sest see murrab nõusolekumudeli enda lubadust. Sellega külgneb K2 readiness-tupik (lahkuja lukustab taotluse). Ülejäänu on tuttav race-perekond (K3/K4 find-then-create → tingimuslikud kirjutused parandavad), i18n-võlg süsteemsõnumis (K5) ja kaks arhitektuurimärkust (K7 surnud fanout, K8 serialiseerimisvariandid). Läbiv niit ptk 1–4: **kirjutused vajavad tingimuslikke where-klausleid** — sama muster parandaks ptk 1 K1, ptk 2 K2, siin K3 ja K4.

---

## 5. `calls/[callSessionId]/recording/**` — salvestuse nõusolekuvoog (request/consent/decline/withdraw/cancel/start/stop)

**Auditeeritud:** 2026-07-16 · 7 route'i (identne skelett, à ~44 rida) + service-funktsioonid `createRecordingRequest`, `respondToRecordingConsent`, `cancelRecordingRequest`, `startRecording`, `stopRecording`, `stopActiveRecordingForCall` (`lib/calls/service.js:528–907`) + UI `RoomCallBar.jsx`

### 5.1 Roll ja elutsükkel

Nõusolekumudel: taotleja (HOST/moderaator) loob taotluse → igale aktiivsele osalejale consent-rida (REQUESTED) → kõik CONSENTED → READY_TO_RECORD → start (LiveKit egress) → ACTIVE → stop → finalize + `UserDocument` taotlejale (kind CALL_AUDIO_RECORDING, `agentAllowed: false`) → COMPLETED. Iga üleminek kirjutab `dataAuditLog` kirje; consent-rida talletab tekstisnapshoti, versiooni ja räsitud IP/UA tõendi.

### 5.2 Mis on korras

- **Route-kiht on ühtlane ja topelt-skoobitud:** kõik 7 kontrollivad `requireRoomCallAccess` + `requireCallInRoom`, service-päringud skoobivad `recordingRequestId` alati `callSessionId`-ga — ristviitamine võimatu; kõik try/catch + `statusForCallError` sees.
- **Start valideerib nõusolekud uuesti hetkeosalejate vastu** (`allRequiredConsentsPresent`, service.js:710–718) — enne starti liitunud nõusolekuta inimene blokeerib käivituse. Elutsükli esimene pool on aus.
- **Mock-režiimis ei saa midagi salvestada:** egress `configured` nõuab RECORDING_ENABLED + LIVEKIT_EGRESS_ENABLED + LiveKit-конfi, muidu 503 — salajast salvestust dev-keskkonnas ei eksisteeri.
- **Tõendidistsipliin:** consent-tekst snapshotitakse versiooniga; IP/UA räsitakse (mitte toorelt); auditikirjed igal üleminekul; egress-tõrge markeerib faili/taotluse FAILED.
- **Dokument on privaatne:** ainult taotleja omanikuks, `agentAllowed: false` klapib lubadusega "ei transkribeerita automaatselt".
- **Õnnelik juhus:** cancel ei nõua aktiivset osalust → lahkunud taotleja saab kinnijooksnud taotluse (ptk 4 K2 tupik) ise tühistada.

### 5.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** (toodangus egress'iga **kriitiline**) | ACTIVE salvestuse saab viia lõppolekusse ilma egress'i peatamata — lint jookseb edasi ja muutub API kaudu peatamatuks |
| K2 | **Keskmine** | Nõusoleku tagasivõtmine puudub UI-st täielikult; ACTIVE ajal ei näe keegi ei nõusolekuküsimust ega väljapääsu |
| K3 | Madal | Topelt-request ja topelt-start race'id: kummitustaotlused + kaks egress-jobi ühe failirea peale |
| K4 | Madal | Nõusolekusnapshot on alati eestikeelne ja võib lahkneda UI-s näidatud i18n-tekstist — tõendi ja nähtu erinevus |
| K5 | Info | Request-voog pole `recordingEnabled`-väravaga; UI näitab salvestuskontrolle alati → 503 alles start'il |
| K6 | Info | IP/UA tõendiräsi on soolamata sha256 ja päised kliendi võltsitavad — tõendi kvaliteet sõltub proxy-kihist |

**K1 — orvustatud egress (service.js:580–646, 648–681 vs 835–907).** Kolm rada viivad ACTIVE salvestuse lõppolekusse ilma füüsilist lindistust peatamata:
- *decline/withdraw ACTIVE ajal:* `respondToRecordingConsent` lubab vastust kõigis OPEN-staatustes (sh ACTIVE) → `updateRecordingReadiness` → taotlus DECLINED. Egress'i ei puudutata.
- *cancel ACTIVE ajal:* `cancelRecordingRequest` lubab samuti OPEN-staatusi → STOPPED. Egress'i ei puudutata.

Pärast seda on lint **püsivalt peatamatu**: stop-route nõuab `status === "ACTIVE"` (rida 844 → 409) ja kõne lõpu `stopActiveRecordingForCall` otsib ainult ACTIVE-taotlust (rida 739) → ei leia midagi. LiveKit egress jätkab kogu ülejäänud vestluse salvestamist, kuni LiveKit ise ruumi sulgeb; toorheli maandub storage'isse, failirida jääb igaveseks PROCESSING, finalize/dokument ei teki — **kasutaja võttis nõusoleku tagasi, aga lindistus jätkus ja andmed püsivad**. Saavutatavus: withdraw/decline ACTIVE ajal on täna API-only (UI nuppe ei paku), aga **cancel-during-ACTIVE juhtub tavakasutuses**: moderaatori UI värskeneb 5 s polling'uga — "Tühista taotlus" nupp on veel ekraanil, kui server on juba ACTIVE. Parandus: kui taotlus on ACTIVE, suuna decline/withdraw/cancel läbi stop-voo (egress stopp + finalize või kustutus) ja alles siis markeeri lõppolek; või keela need üleminekud ACTIVE-l (409 "peata enne salvestus"). NB: kuna egress on praegu konfigureerimata (mock ei salvesta), on viga uinuv — **paranda enne RECORDING_ENABLED=true toodangut.**

**K2 — tagasivõtmatu nõusolek (RoomCallBar.jsx:87, 196–201, 275–289).** Withdraw-route on orb-endpoint (ptk 2 K1 muster): hook toetab WITHDRAWN-otsust, aga ükski nupp seda ei kutsu. Consent-dialoog kuvatakse ainult `status === "REQUESTED"` ajal — niipea kui salvestus käib, ei näe ükski osaleja (sh ptk 4 K1 hiline liituja, kellelt pole kunagi küsitudki) ei küsimust ega väljapääsu; ainus ACTIVE-aegne nupp on moderaatori "Lõpeta salvestamine". Tavaosaleja õiguskaitseahel on seega: stop-õigust pole (ainult taotleja/HOST/moderaator, rida 701–708) → withdraw on ainus vahend → withdraw'd pole UI-s → ja kui oleks, põrkaks K1 vastu. GDPR-vaates peab antud nõusolek olema sama lihtsalt tagasivõetav kui antav — praegu pole üldse. Parandus koos K1-ga: ACTIVE-aegne "Võta nõusolek tagasi" nupp, mis serveris peatab egress'i puhtalt.

**K3 — race-pere (service.js:545–546, 758–833).** (a) Kaks üheaegset taotlust: mõlemad `findOpenRecordingRequest` → null → kaks avatud taotlust; UI ja kõik lugejad näevad ainult uusimat (`findFirst` desc), kummitus jääb igavesti REQUESTED-iks. (b) Kaks üheaegset starti READY hetkel: mõlemad läbivad kontrollid → **kaks LiveKit egress-jobi**, aga üks failirida — teine `update` kirjutab `egressId` üle ja esimene egress orvustub (sama tagajärg kui K1). Parandus: osaline unikaalindeks (callSessionId, avatud staatus) + olekuüleminekud tingimusliku `updateMany`'ga (`where status: "READY_TO_RECORD"`) — sama retsept, mis ptk 1–4 race'idel.

**K4 — snapshoti keel (service.js:97–107).** `buildRecordingConsentText` on kõvakodeeritud eesti keel; snapshot talletatakse tõendina, mida kasutaja "nägi ja kinnitas". Aga UI renderdab omaenda i18n-võtmed (`calls.recording_consent_*`), st RU/EN kasutajale *näidatav* tekst ja *talletatav* tõend võivad lahkneda — ja eestikeelse teksti kinnitamine keeleoskamatuna õõnestab "informeeritud nõusoleku" sisu. Parandus: genereeri snapshot kasutaja keeles samadest i18n-võtmetest ja talleta koos keelekoodiga (versioon juba on).

**K5 — puuduv feature-värav.** `createRecordingRequest` ei kontrolli `recordingEnabled`-t; klient ei loe `config.recordingEnabled`-t üldse (`allowRecordingControls` on default-true prop, `ChatBody.jsx:2699` ei sea seda) → kasutajad saavad läbida kogu nõusolekutantsu keskkonnas, kus salvestus on välja lülitatud, ja moderaator saab 503 alles "Alusta" nupul. Värava õige koht on request-route (409/503 kohe) + UI peitmine config'i järgi.

**K6 — tõendi kvaliteet.** `ipFromRequest` usaldab `x-real-ip`/`x-forwarded-for` päiseid (kliendi setitavad, kui proxy neid üle ei kirjuta) ja sha256 ilma soolata on IPv4 ruumis pöörduv. Nõusolekutõendina piisav ainult koos usaldusväärse proxy-kihiga — dokumenteeri eeldus või lisa sool/HMAC.

### 5.4 Kokkuvõte

Elutsükli esimene pool (taotlus → nõusolekud → readiness → start koos ümbervalideerimisega) on hoolikalt ehitatud: snapshotid, versioonid, auditilog, topelt-skoobitus, mock-ohutus. Teine pool — **mis juhtub, kui keegi ACTIVE salvestuse ajal meelt muudab — on katki kolmes kohas korraga**: üleminekud ei peata egress'i (K1), tagasivõtmisvõimalust pole UI-s (K2) ja hilinenult pole kunagi küsitudki (ptk 4 K1). Koos moodustavad need ühe loo: nõusolekumudel kehtib ainult salvestuse *alustamise*, mitte *kestmise* kohta. Kuna egress on täna konfigureerimata, on kõik kolm uinuvad — aga need on täpselt need vead, mis tuleb parandada *enne* RECORDING_ENABLED=true otsust, mitte pärast esimest kaebust. Ülejäänu (K3 race'id, K4 snapshoti keel, K5 värav, K6 tõendiräsi) sobib samasse parandustsüklisse.

---

## 6. `app/api/invites/[id]/resend/route.js` — kutse uuesti saatmine

**Auditeeritud:** 2026-07-16 · 235 rida · ainus meetod `POST` · UI-kutsuja olemas (`components/invite/InviteModal.jsx:332–333`)

### 6.1 Roll ja kontekst

Genereerib ootel (SENT) kutsele uue tokeni, saadab meili ja kirjutab uue räsi üle vana — vana link sureb, kehtiv link on alati viimane. Õigus: ruumi omanik või aktiivne OWNER/MODERATOR-liige. Võrdluseks loetud ka loomise-route (`app/api/invites/route.js`) ja accept-voo staatusemasin.

### 6.2 Mis on korras

- **Seni küpseim veapind:** rate-limit (429 + retryAfterSec), lokaliseeritud veateated (`serverT` + korralik accept-language parsimine), stabiilne `code`-väli kliendile, `safeError` logides — ükski varasem auditeeritud route ei paku seda taset.
- **Tokenidistsipliin eeskujulik:** 48 B juhuslikkust base64url-ina, DB-s ainult sha256-räsi (`tokenHash @unique`), toorväärtust ei tagastata vastuses; roteerimine resend'il tähendab, et ringluses on korraga täpselt üks kehtiv link.
- **Õiguskontroll fail-closed:** `["OWNER","MODERATOR"].includes(undefined)` → false; omanikutee kontrollib `room.ownerId` otse (skeem garanteerib room'i olemasolu — `onDelete: Cascade`).
- **Staatusevärav peab transitiivselt:** resend lubab ainult SENT-i; accept lülitab ammendunud kutse ACCEPTED-iks (`accept/route.js:372`), seega ka multi-use kutsed on pärast ammendumist resend-kindlad.
- **Enumeratsioon maksab:** rate-limit võetakse enne olemasolukontrolle — ID-de sondeerimine kulutab sondeerija eelarvet.

### 6.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | Staatusekontroll enne õiguskontrolli — iga autenditud kasutaja saab sondeerida kutse olemasolu ja ootel-seisu |
| K2 | Madal | Meil enne DB-kirjutust: update-tõrke korral on saaja postkastis surnud link |
| K3 | Madal | Resend ei pikenda `expiresAt`-i — värskelt saabunud kiri võib sisaldada homme aeguvat linki |
| K4 | Madal | Rate-limit on protsessisisene ja IP-võti kliendi võltsitav — päisega roteerides piiramatu resend |
| K5 | Info | Helper-duplikatsioon invites-pere sees; loomise-route'i `sendInviteEmail` juba toetab resend-template'i |
| K6 | Info | `inviterName = auth.email` — saatja e-mail muutub kuvanimeks; moderaatori resend omistab kutse valele inimesele |

**K1 — kontrollide järjekord (read 171–189).** `status !== "SENT"` → 400 tuleb *enne* omaniku/moderaatori kontrolli → 403. Iga autenditud kasutaja eristab suvalise ID kohta: olematu (404) / ootel võõras kutse (403 alles siis, kui staatus on SENT… tegelikult vastupidi — mitte-SENT võõras kutse annab 400, SENT võõras 403), st nii olemasolu kui ootel-seis lekivad. Cuid-entroopia teeb massenumeratsiooni ebapraktiliseks, aga järjekord on põhimõtteliselt sama tagurpidi nagu ptk 2 K6. Tõsta 403 ette; 404/403 ühtlustamine (mõlemale "not_found") oleks veel tihedam.

**K2 — meil-enne-kirjutust (read 197–212).** Kui `sendInviteEmail` õnnestub ja `prisma.invite.update` kukub, on saaja postkastis kiri, mille link ei tööta kunagi (uut räsi ei salvestatud; *eelmine* link jääb töösse). Valitud järjekord on kahest halvast parem — tõrge "avaneb" vana lingi kasuks, mitte "kõik lingid surnud" suunas —, aga surnud-link-postkastis on klienditoe piletite generaator. Kui järjekord ümber pöörata (kirjuta enne, saada pärast), muutub tõrkepilt sümmeetriliselt: uus räsi DB-s, kirja pole — järgmine resend parandab. Kumbki valik vajab vaid teadlikku dokumenteerimist; range lahendus oleks outbox-muster, mis on siin ilmselt üle võlli.

**K3 — aegumist ei pikendata (read 191–195, 206–212).** Update puudutab ainult `tokenHash`+`status`. Päev enne aegumist resend'itud kutse saabub värske kirjana, mille link sureb 24 h pärast — saaja jaoks arusaamatu. Tooteotsus: kas resend nullib aegumise (nt +168 h, lae ülempiiriga) või kiri näitab kehtivusaega. Ristmärkus loomise-route'ist: `expires_in_hours` on alt piiratud (`Math.max(1, …)`), aga **ülempiiri pole** (route.js:488–493) — API kaudu saab luua aastakümneid kehtiva bearer-lingi; väärib lage (nt 720 h).

**K4 — rate-limiti kaks auku.** (a) `consumeRateLimit` on protsessisisene `Map` (`lib/rate-limit.js`) — mitme instantsi/restardi korral eelarved ei jaga ega püsi; (b) võtme IP-osa tuleb `x-real-ip`/`x-forwarded-for`-ist, mida klient saab ise saata (`lib/request-ip.js:8–13` usaldab neid pimesi) → autenditud kasutaja roteerib päist ja saab igale võltsile-IP-le värske 20/min eelarve → adressaadi postkasti saab spämmida piiramatult (iga kiri roteerib ühtlasi tokeni). Kui toodang on nginx'i taga, mis `x-real-ip` üle kirjutab, on auk kinni — see eeldus vajab dokumenteerimist; vöö-ja-traksid: võta IP võtmest välja (userId-st piisab) või lisa kutse-ID võtmesse.

**K5 — duplikatsioon pere sees.** Resend-route defineerib oma `sendInviteEmail`/`randomToken`/`hashToken`/`buildJoinLink`/`localeFromRequest`/`errorJson`/`requireUser` koopiad, kuigi loomise-route'i `sendInviteEmail` (route.js:282–314) juba võtab `template`-parameetri ja tunneb `email.invite.resend.*` võtmeid — resend-route'i eksisteerimine sundis kunagi jagatud template-toe looma, aga route ise ei kasuta seda. Drift on juba nähtav: loomine neelab meilitõrke vaikselt (invite jääb alles, ainult logi), resend kukub 500-ga. Sama teema mis ptk 1 K4 — invites-pere pole calls-pere (ptk 3) kombel jagatud helperitesse tõstetud.

**K6 — saatja identiteet.** `inviterName: auth.email || "SotsiaalAI"` (rida 202; loomises identne, route.js:546): (a) saaja näeb kuvanimena e-maili aadressi — profiilinimi jääb kasutamata (calls-peres on `requesterDisplayName` täpselt selle jaoks olemas); (b) kui *moderaator* resend'ib *omaniku* kutset, väidab kiri, et kutsub moderaator — `invite.inviterId` (algne kutsuja) jääb kasutamata. Väike, aga kirja usaldusväärsus on kutse konversiooni tuum.

### 6.4 Kokkuvõte

Selgelt kõige küpsem seni auditeeritud route: token-hügieen, rate-limit, lokaliseeritud vead ja staatusemasin on kõik õigesti mõeldud. Kriitilisi ega keskmisi vigu pole. Neli madalat on kõik "viimase 10%" viimistlus: kontrollide järjekord (K1), meili/kirjutuse tõrkeaken (K2), aegumise UX (K3) ja rate-limiti infra-eeldused (K4). Kaks süsteemset niiti korduvad: helper-duplikatsioon (K5, sama mis ptk 1/2) ja identiteedi kuvamine e-mailina (K6). Eraldi väärib kinnitamist teadliku otsusena, et **resend ei nõua billing-väravat** (ruumi-API nõuab kõikjal) — ilmselt õige, sest kutsumine on ruumihaldus, mitte sisuligipääs, aga see erand tasub dokumenteerida.

---

## 7. `app/api/invites/sponsored/init/route.js` + `sponsored/callback/route.js` — sponsoreeritud kutse makseahel

**Auditeeritud:** 2026-07-16 · init 660 rida (`POST`) + callback 113 rida (`GET`+`POST`) · UI: `InviteModal.jsx`
**Skoobipiirang:** `app/api/subscription/webhook/route.js` on kasutaja korraldusel auditist väljas. Sealt on kasutatud ainult ühte fakti, mis oli init'i tokenikäsitluse hindamiseks vältimatu: makse õnnestumisel vermitakse *uus* token ja kutse läheb SENT-olekusse — st init'i placeholder-räsi on taotluslik. Webhook'i enda korrektsust ei hinnatud.

### 7.1 Roll ja voog

Init: sponsor (aktiivse plaaniga omanik/moderaator, admin-möödapääsuga) algatab teisele inimesele tasutud kutse — valideerimised → (vajadusel uue ruumi loomine) → kutse `PENDING_PAYMENT` + *pime* tokenräsi (toorväärtust ei tea keegi) → makserida INITIATED → Maksekeskuse checkout-URL kliendile. Täitmine (token + meil + SENT) toimub mujal pärast makset; tühistus/tõrge → REVOKED. Callback: puhas brauseri-tagasisuunaja — ei kirjuta midagi, POST verifitseerib MAC-i ja suunab `/vestlus?invitePayment=<state>`.

### 7.2 Mis on korras

- **Hinda ei saa klient mõjutada:** summa arvutatakse serveris rollist (`getSponsoredInviteAmount(targetRole)`), valuuta env-ist — makseturbe tuum on õige.
- **Pime-tokeni muster on elegantne:** init salvestab räsi, mille toorväärtus visatakse minema (rida 479) — kutse on kuni makseni matemaatiliselt vastuvõetamatu; kehtiv token tekib alles täitmisel. Ei mingit "aktiveerimata, aga toimiv link" vaheolekut.
- **Väravad enne raha:** acceptedTerms nõutav (+ talletatakse payment.raw-s), sponsoril peab olema aktiivne plaan (409), juba tellimusega invitee blokeeritakse (409), mahupiirang 50.
- **Kompensatsioon checkout-tõrkel:** makse → FAILED, kutse → REVOKED, äsja loodud ruum kustutatakse (read 608–641) — pooleli jäänud ostu jäljed koristatakse.
- **Callback ei muuda olekut:** ainuke tõeallikas on MAC-verifitseeritud kanal; isegi kuvamiseks loetav POST-payload MAC-itakse enne (rida 88). Arhitektuuriliselt õige tööjaotus.
- Küps veapind nagu ptk 6: rate-limit, lokaliseeritud vead, `code`-väljad, `safeError`, `fail()` status+messageKey kandjana.

### 7.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** | Init kirjutab võõra ruumi *omaniku* liikmesuse üle (displayName + `leftAt: null`) enne õiguskontrolli — ja ka legitiimsel moderaatoril valele inimesele |
| K2 | Madal | Loodud ruum jääb tõrke korral maha — ainult checkout-tõrge koristab, capacity-409 ja invite/payment-tõrked mitte |
| K3 | Madal | Mahupiirang on TOCTOU ja loeb ainult vastuvõetud liikmeid — ootel kutsed mahtu ei kuluta |
| K4 | Madal | `expires_in_hours` on jälle ülempiirita (sama pere: ptk 6 K3) |
| K5 | Info | `ensureRoom` kaks haru on siin surnud kood; helper kopeeritud `invites/route.js`-ist, kus need elavad |
| K6 | Info | Invitee-tellimuse kontroll vaatab ainult 5 uusimat rida; init pole idempotentne (topeltklõps → 2 ootel kutset + 2 checkout'i) |
| K7 | Info | Callback-GET usaldab query-staatust ja UI kuvab "makse õnnestus" verifitseerimata parameetri pealt |
| K8 | Info | POST-callback suunab 302-ga (õigem 303); pisiasi |

**K1 — vale sihtmärgiga kirjutus enne autoriseerimist (read 150–172, 174–185, 437).** `ensureRoom` olemasoleva `roomId` harus kutsub `ensureOwnerMembership(room.id, room.ownerId, ownerDisplayName)` — upsert käib **ruumi omaniku** rea peale, aga `ownerDisplayName` on *kutsuja* sisestatud `host_display_name` ("Sinu nimi vestluses"). Kaks viga korraga:
1. *Autoriseerimata kirjutus:* õiguskontroll (omanik/moderaator → muidu 403) jookseb alles `requireRoomRole`'is *pärast* seda upsert'i. Iga aktiivse plaaniga kasutaja, kes teab suvalise ruumi ID-d (ID-d liiguvad URL-ides, sh sama callback'i redirect'is), saab payload'iga `{room_id: <võõras>, host_display_name: "X", …}` kirjutada võõra ruumi omanikule uue kuvanime ja äratada ellu lahkunud omaniku liikmesuse (`leftAt: null`) — saab küll lõpuks 403, aga kirjutus on juba tehtud, vaikselt (`catch {}` neelab ka vead).
2. *Vale sihtmärk ka legitiimselt:* kui *moderaator* kasutab init'i võõra omandis ruumiga, saab **omanik** endale moderaatori nime — kutsuja enda rea kirjutab alles teine upsert (read 446–465).
Parandus: eemalda `ensureOwnerMembership` roomId-harust täielikult (omaniku liikmesuse "parandamine" ei ole selle voo töö; kutsuja displayName'i katab hilisem upsert, mis jookseb õigustatult pärast õiguskontrolli). Kui omaniku-rea remont on kusagil vajalik, tehku seda eraldi hooldusrada.

**K2 — maha jäävad ruumid.** `requireRoomRole` võib luua uue ruumi (read 437–444), aga koristus elab ainult checkout-tõrke catch'is (632–638). Kui pärast loomist kukub mahukontroll (409, read 467–472) või `invite.create`/`payment.create` (välimine catch, 642), jääb tühi ruum kasutaja nimekirja. Elegantne parandus: kontrolli mahtu *enne* `requireRoomRole`'i, kui `roomId` on antud (värskel ruumil on maht alati olemas) — siis ei teki loomise-järgset tõrkeakent üldse; lisaks tõsta ruumi-koristus välimisse catch'i.

**K3 — mahu-TOCTOU.** `hasSponsorCapacity` loeb ainult liikmeid (`billingSource: SPONSORED_BY_HOST, leftAt: null`) — N üheaegset init'i läbivad kõik sama loenduse ja ootel `PENDING_PAYMENT`/SENT kutsed ei kuluta mahtu üldse: 49 liikme juures saab algatada kuitahes palju makseid, mis kõik hiljem vastuvõtul üle piiri lähevad (kui accept-pool uuesti ei loe — see on väljaspool selle peatüki skoopi). Kui 50 on äriline lagi, peab loendus arvestama ka ootel kutseid ja/või accept-pool peab piiri uuesti kontrollima.

**K4 — aegumise ülempiir puudub** (read 480–488): `Math.max(1, …)` kaitseb alt, üleval lage pole — sama muster, mille ptk 6 K3 juba fikseeris loomise-route'is. Väärib ühte jagatud konstanti (nt max 720 h) kõigis kolmes kohas.

**K5 — surnud harud.** `ensureRoom`'i "võta vanim ruum" (211–221) ja "loo fallback-tiitliga ruum" (223–243) on siin saavutamatud, sest rida 405 nõuab roomId VÕI roomTitle'i. Kood on koopia `invites/route.js`-ist, kus harud on elus — järjekordne kinnitus ptk 6 K5 leiule, et invites-pere vajab jagatud helpereid; surnud autoriseerimis-lähedane kood on eriti halb kandidaat vaikseks driftiks.

**K6 — kaks pisiauku.** (a) `inviteeHasActiveSubscription` võtab `take: 5` uusimat tellimust — rohkem kui 5 reaga kasutajal võib aktiivne rida välja jääda → sponsor maksab inimese eest, kellel plaan juba on (kontroll on nagunii nõuandev: invitee võib tellida init'i ja makse vahel). (b) Idempotentsust pole: topeltklõps enne redirect'i loob kaks kutset + kaks checkout'i; rate-limit (10/min, sama võltsitava IP-võtme hoiatus mis ptk 6 K4) seda ei takista. Mõlemad taluvad ootamist, aga väärivad teadvustamist.

**K7 — kuvamis-usaldus.** GET-callback mapib `?status=` parameetri (kasutaja käes!) success/failed/canceled-iks ja `InviteModal.jsx:123–125` kuvab selle pealt `invite.sponsored.payment_success` teate — kasutaja saab endale ise "makse õnnestus" ekraani meisterdada. Serveripoolset olekut see ei muuda (täitmine on MAC-kanalis), seega kahju piirdub eksitava teatega — aga teade võiks olla mitteautoriteetne ("makse töötlemisel…") või kinnitada kutse tegelikku staatust API-st.

### 7.4 Kokkuvõte

Makseahela *raha-pool* on korralikult ehitatud: server määrab hinna, pime-token lukustab kutse kuni makseni, callback ei muuda olekut ja tõrgetel on kompensatsioon. **Üks keskmine viga on autoriseerimispiiri vale pool:** võõra roomId-ga init kirjutab ruumi omaniku liikmesusse enne õiguskontrolli — ja sama upsert paneb ka legitiimse moderaatori nime valele inimesele (K1); parandus on ühe funktsioonikutse eemaldamine. Ülejäänu on tuttavad pered: koristamata tõrkerajad (K2), TOCTOU-mahud (K3), piiramata aegumine (K4) ja invites-pere copy-paste (K5). Läbivalt kordub ka ptk 6 rate-limiti IP-hoiatus. Webhook-pool jäi teadlikult auditeerimata — kui see kunagi skoopi tuleb, on esimesed küsimused sealse tokenivahetuse atomaarsus ja meili saatmise tõrkekäitumine.

---

## 8. `lib/rooms/meetingSummaryShare.js` — kinnitatud kohtumise kokkuvõtte jagamine ruumi (U10)

**Auditeeritud:** 2026-07-16 · 61 rida · integratsioonid: `app/api/rooms/[roomId]/messages/route.js:283–334` (POST), `components/documents/MeetingSummaryRoomShare.jsx`, testid `tests/rooms/meetingSummaryShare.test.js`

### 8.1 Roll ja piir

Resolver, mis lubab spetsialistil (SOCIAL_WORKER/SERVICE_PROVIDER/ADMIN) postitada ruumi *ainult* enda omanduses oleva, FINAL-staatuses MEETING_SUMMARY artefakti sisu. Moodul lahendab ainult sisu; postitus käib messages-route'i tavalise konveieri kaudu (liikmesus+billing `ensureAccess`, privaatsuskontroll, rate-limit 20/min, SSE broadcast). Doc-kommentaari väidetud piir vastab tegelikkusele — kontrollitud route'i vastu.

### 8.2 Mis on korras

- **Väravate järjekord on õige ja lekkevaba:** tühjad ID-d → 404; roll → 403 (enne DB-d); omanik-skoobitud `findFirst({id, ownerId})` → võõras artefakt on eristamatu olematust (404, anti-enumeratsioon — dokumenteeritud JA testitud); tüüp → 400; FINAL → 409; tühi sisu → 400.
- **Seni parim testikate:** 8 stsenaariumi — õnnelik tee, võõras omanik, olematu ID, vale tüüp, kinnitamata, tühi sisu, tühjad argumendid, rollimaatriks (sh CLIENT → false/403). Fake-db süstimine (`{db=prisma}`) järgib projekti konventsiooni.
- **Fail-closed rollivärav** Set'iga + normaliseerimine (trim/uppercase); ADMIN saab jagada ainult *enda* artefakte (omandikontroll kehtib kõigile).
- **UI on hoolikas:** ruumi peab valima eksplitsiitselt (vaikevalikut ei tehta — kommentaar põhjendab privaatsusega), näidatakse ainult >1 liikmega ruume, `canShare` peidab kogu ploki.

### 8.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | Route edastab resolveri *iga* erindi sõnumi kliendile — DB-tõrge lekitab toore veateksti |
| K2 | Madal | Jagamine ei jäta auditijälge — ainus auditeerimata artefaktisündmus on kõige privaatsustundlikum |
| K3 | Madal | UI eel-vastab privaatsusvärava (`send_original` alati kaasas) — teadlik, aga lepingut nõrgendav otsus |
| K4 | Info | Sõnumi pikkusepiirangut pole — FINAL kokkuvõte võib olla hiigelsõnum SSE-fanout'is |
| K5 | Info | Pisiasjad: tiitel ei liigu kaasa; kolmas `Error+status` idioomikoopia; ruumivalik ei tea, kas klient on sees |

**K1 — läbipaistev veaedastus (`messages/route.js:307–309`).** `errorJson(shareError?.message || …, Number(shareError?.status) || 500)` — resolveri *oodatud* vead (message = i18n-võti, status olemas) on korras, aga kui `db.agentArtifact.findFirst` viskab infra-erindi, saab klient status 500 + `messageKey`-ks toore Prisma veateksti (nt ühendusinfo). Kõik teised auditeeritud route'id kasutavad siin `safeError` + fikseeritud võtit. Parandus: edasta ainult siis, kui `error.status` on olemas; muidu logi `safeError`-iga ja tagasta `api.rooms.summary_share_failed`.

**K2 — auditijälje auk (`schema.prisma:629–640`).** `DocumentAuditAction` katab ARTIFACT_CREATE/UPDATE/REFINE/APPROVE/DOWNLOAD/DELETE — iga artefaktisündmus *peale jagamise* auditeeritakse. Kliendi kohtumise kokkuvõtte postitamine mitmeliikmelisse ruumi on artefakti elukaare kõige privaatsustundlikum hetk ja ainus, millest ei jää `DocumentAudit` rida. Kõnesalvestuste pere (ptk 5) auditeerib iga ülemineku — muster on platvormil olemas. Lisa `ARTIFACT_SHARE` + `meta: {roomId, messageId}` route'i POST-harru.

**K3 — eel-vastatud privaatsusvärav (`MeetingSummaryRoomShare.jsx:67–72`).** UI saadab alati `privacyDecision: {action: "send_original"}`, st serveri privaatsuskontrolli 409-kinnitusring ei käivitu kunagi jagamise jaoks — kasutaja ei näe hoiatust ka siis, kui kokkuvõte sisaldab isikuandmeid. Otsus on koodis põhjendatud (FINAL-kinnitus + eksplitsiitne jagamisnupp = topeltkinnitus) ja kuna `privacyDecision` on nagunii kliendi antav, ei ava see uut auku — värav on kogu route'is nõuandev. Aga mooduli kommentaari lubadus "postitab läbi olemasoleva privaatsuskonveieri" on jagamise puhul de facto tühi. Vääriks lause-täpsustust kommentaaris + teadvustamist, et kui privaatsusvärav kunagi serveripoolseks/kohustuslikuks muutub, tuleb see erand üle vaadata.

**K4 — piiramata sõnumisuurus.** `RoomMessage.content` on `@db.Text` ja POST ei kärbi midagi — realistlik suure sisu allikas ongi just kokkuvõtte jagamine (agendi genereeritud FINAL võib olla kümneid kB). Üks hiigelsõnum kordub igas GET-vastuses ja SSE-fanout'is kõigile liikmetele. Kaalu lage (nt 32k tähemärki) või kärbi + viita artefaktile.

**K5 — pisiasjad.** (a) Resolver tagastab palja sisu — artefakti tiitel ("Kohtumise kokkuvõte …") ruumi ei jõua, kui sisu ise päist ei sisalda; (b) `shareError` on kolmas sõltumatu koopia "Error koos status'ega" idioomist (`notificationError`, invites `fail()`) — üks jagatud `httpError(key, status)` kataks kõik; (c) UI `memberCount > 1` filter ei tea, kas valitud ruumis on just *see* pöörduja — teadlikult lahendatud eksplitsiitse valikuga, jäägu nii, aga tasub meeles pidada, kui ruumide arv kasvab.

### 8.4 Kokkuvõte

Seni puhtaim auditeeritud üksus: moodulis endas sisulisi vigu pole — väravad on õiges järjekorras, lekkevabad, fail-closed ja täielikult testitud; doc-kommentaar vastab koodile. Kõik neli leidu elavad *integratsiooniõmblustel*: veaedastus (K1, 3-realine parandus), puuduv auditikirje (K2, väike lisa olemasolevasse mustrisse), eel-vastatud privaatsusvärav (K3, vajab ainult ausamat dokumenteerimist) ja sõnumisuurus (K4). See peatükk on ühtlasi hea kontrast: kui ptk 1–2 route'id kannatasid copy-paste anarhia käes, siis U10 näitab, kuidas väike leping-moodul + testid + kommenteeritud piir välja näeb.

---

## 9. `lib/roomStream.js` — ruumi-sündmuste pub/sub

**Auditeeritud:** 2026-07-16 · 54 rida · koos naabritega `lib/redis.js` (26 rida) ja ainsa tellijaga `app/api/rooms/[roomId]/messages/stream/route.js` (192 rida)

### 9.1 Roll ja leping

Protsessisisene tellijate register (Map roomId → Set<fn>) + valikuline Redis-relee mitme node'i jaoks. Leping praktikas:

| Event | Publitseerijad | Tarbija käsitleb? |
|---|---|---|
| `{type:"message", message}` | messages POST (`route.js:383`), assistendi sõnumid (`mainRouteRuntime.js:96`) | jah (merge + markRead) |
| `{type:"delete", id}` | sõnumi kustutus (`[msgId]/route.js:161`) | jah (filter) |
| `{type:"call", call}` | `emitCallEvent` (`roomRoutes.js:150`) | **ei** (ptk 4 K7) |

Ilma `REDIS_URL`-ita töötab puhtalt lokaalses režiimis — üks node, null konfiguratsiooni.

### 9.2 Mis on korras

- **Mitme node'i disain on õige:** publish emiteerib lokaalselt sünkroonselt + saadab Redisesse `nodeId`-ga; vastuvõtja dedupeb enda saadetu (`node === nodeId → return`) — lokaalset topeltkohaletoimetust ei teki.
- **Tõrgete isolatsioon:** iga tellija-callback on eraldi try/catch'is — üks katkine SSE-ühendus ei murra teisi; parse-vead logitakse.
- **Register koristab enda järelt:** unsubscribe eemaldab fn-i ja tühja Set'i korral Map-kirje; JS-i ühelõimelisus teeb register-operatsioonid race-vabaks; topelt-unsubscribe on kahjutu.
- **Tellija (SSE-route) on distsiplineeritud:** unsubscribe+taimerite puhastus igal tõrkerajal (`doCleanup`), `cancel()`-hook, ja — parim omadus — **ligipääsu taaskontroll iga 20 s järel**: ruumist eemaldatud või billing'u kaotanud liikme striim katkeb ≤20 s (turvaomadus, mida polling-fallback annab tasuta).
- Redis-klientide vead logitakse; `lazyConnect` + ioredis vaikimisi offline-queue → alglaadimisaegne Redis-tõrge taastub ise (subscribe jääb järjekorda ja täitub ühendumisel).

### 9.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | Moodulitaseme kõrvalmõjud ilma `globalThis`-kaitsmeta — dev-HMR kuhjab Redis-kuulajaid ja orb-registreid |
| K2 | Madal | Kanal `"room-events"` on keskkonna-eesliiteta — jagatud Redis ristab keskkondade sündmused |
| K3 | Info | Publish-tõrked neelatakse hääletult; taastumine toetub dokumenteerimata ioredis-vaikeväärtustele |
| K4 | Info | Payload-lepingut ei valideerita; üks globaalne kanal toob igale node'ile kõigi ruumide sündmused |
| K5 | Info | Tellija-route'i märkused: puuduv `X-Accel-Buffering`, helper-koopia, ADMIN-i asjatu tellimuspäring |

**K1 — HMR-kuhjumine (roomStream.js:3–25, redis.js:2–3).** Mõlemad moodulid hoiavad olekut moodulimuutujates ja roomStream teeb impordil kõrvalmõju (`redisSub.on("message", …)` + subscribe). Next'i dev-HMR re-evalueerib mooduleid: kui roomStream re-evalueerub, aga redis.js püsib vahemälus, saab *sama* sub-klient teise "message"-kuulaja värske (orb-)registriga; kui redis.js re-evalueerub, tekivad uued ühendused ja vanad jäävad rippuma. Tulemus dev'is: kuulajate kuhjumine, MaxListenersExceededWarning, fantoom-emitid. Toodangus (üks evaluatsioon) probleemi pole. Parandus on repo enda konventsioon: `lib/prisma.js:22` kasutab `globalThis`-singletoni — rakenda sama redis-klientidele ja roomStream'i registrile+kuulajale.

**K2 — kanali nimeruum.** `CHANNEL = "room-events"` on fikseeritud. Kui staging ja toodang jagavad üht Redist ja staging'u DB on toodangu koopia (samad roomId-d — tavaline ops-muster), jõuavad ühe keskkonna sõnumid teise keskkonna SSE-klientidele. Parandus: `const CHANNEL = \`${process.env.REDIS_CHANNEL_PREFIX || ""}room-events\`` või keeldu jagatud Redisest dokumentatsioonis.

**K3 — vaikiv relee-tõrge.** `redisPub.publish(...).catch(() => {})` (rida 42) — kui Redis kukub, jätkab iga node lokaalselt ja *ristnode'i kohaletoimetus lihtsalt kaob*, ilma ühegi logireata (subscribe-tõrge logitakse, publish-tõrge mitte). Kasutajasümptom: "teine kasutaja ei näe sõnumit enne polling'ut" — raskesti diagnoositav. Lisa (trottitud) `console.error`. Taastumine töötab tänu ioredis offline-queue'le ja auto-resubscribe'ile — kirjuta see eeldus kommentaari, et keegi `enableOfflineQueue: false`-iga seda kogemata ei murraks.

**K4 — leping on aumärkidel.** `emitLocal` edastab kanalilt tulnu muutmata kujul otse SSE `data:`-kaadritesse — usalduspiir on Redis-ligipääs ise (aktsepteeritav, aga väärib lauset koodis). Üks globaalne kanal tähendab ka, et iga node saab *kõigi* ruumide sündmused ja filtreerib lokaalselt — praeguses mahus õige lihtsus; kui kõne-payload'id (täisosalejate nimekirjad) kunagi tarbija saavad (ptk 4 K7), kaalu ruumipõhiseid kanaleid või õhemaid event'e.

**K5 — tellija-route'i märkused.** (a) `sseHeaders()` ei sea `X-Accel-Buffering: no` — nginx'i vaikimisi puhverdamine võib SSE ära lämmatada; kui toodangus töötab, on nginx eraldi konfitud, aga päis on odav kindlustus. (b) `requireUser`/`hasActiveSubscription`/`ensureAccess` on sama copy-paste pere liige, mille ptk 1 K4 juba kaardistas (see fail oli 8 hulgas). (c) `ensureAccess` käivitab tellimuspäringu ka ADMIN-ile, kelle tulemust `hasRoomBillingAccess` eirab — sama muster mis ptk 3 K6a; taaskontroll teeb 3 DB-päringut / 20 s / ühendus, ADMIN-möödapääs säästaks ühe.

### 9.4 Kokkuvõte

Väike moodul, mis teeb õiget asja õigesti: sünkroonne lokaalne fanout + nodeId-dedup'iga Redis-relee on täpselt see arhitektuur, mida üks VPS-esimene, aga skaleeritav SSE-kiht vajab, ja graatsiline degradeerumine ilma Redis'eta on boonus. Sisulisi vigu pole; mõlemad madalad leiud on *keskkonna*-küsimused (dev-HMR kuhjumine K1, jagatud-Redis'e nimeruum K2), mille parandused on paar rida ja repo konventsioon on juba olemas. Tähelepanuväärseim avastus on hoopis tellija poolel: 20-sekundiline ligipääsu taaskontroll on vaikselt üks platvormi paremaid turvaomadusi — väärib säilitamist, kui SSE-kihti kunagi ümber ehitatakse.

---

## 10. `components/rooms/useRoomMessages.js` + `useRoomCall.js` + `RoomCallBar.jsx` — ruumi kliendipool

**Auditeeritud:** 2026-07-16 · 211 + 409 + 325 rida · ruumivestluse ja kõne-UI kolm sammast (kasutab ptk 1, 3, 4, 9 serverileide ristviidetena)

### 10.1 Roll ja arhitektuur

`useRoomMessages` = sõnumite kahe-režiimiline sünk (SSE esmane, 3 s polling fallback) + loetuks märkimine (5 s throttle). `useRoomCall` = kõneseisu 5 s polling + LiveKit-ühenduse elutsükkel + kõik kõnetoimingud. `RoomCallBar` = kõneriba UI (liitu/lahku/lõpeta, sõnasoovid, salvestusvoog).

### 10.2 Mis on korras

- **Failover-masin on ehtne:** SSE avanemisel polling seiskub, vea korral taaskäivitub + eksponentsiaalne reconnect (2 s → ×2 → lagi 30 s); 401 (authRequired) ja 403 (blocked) on eristatud olekud, mis peatavad ka reconnect'i. Koos serveri 20 s taaskontrolliga (ptk 9) konvergeerub eemaldatud liige kiiresti.
- **`mergeById` teeb SSE+polling kattumise ohutuks:** id-dedup, väljade merge, stabiilne sort (createdAt + id tiebreaker) — topeltsõnumeid ei teki ka siis, kui mõlemad kanalid sama sõnumi toovad.
- **`metaMatchesRoom` valve** (read 192–198) — eelmise ruumi tiitel/roll ei leki uue ruumi renderisse; peen ja õige.
- **LiveKit-koristus on õnnelikel radadel distsiplineeritud:** remote-audio elemendid võtmestatud ja eemaldatakse, track stopitakse, ruum disconnect'itakse — ka siis, kui poll avastab kõne-ID vahetuse (read 73–78).
- **UI usaldab õiget allikat:** `config.providerAvailable` (mitte ptk 3 K2 valetav `call.providerAvailable`); `canModerate` on ainult kuvamise jaoks, server kontrollib igal POST-il päriselt.

### 10.3 Leiud

| # | Fail | Raskus | Leid |
|---|---|---|---|
| K1 | useRoomMessages | Madal | Ebastabiilsed effect-sõltuvused: iga SSE-oleku muutus lammutab kõik maha — sõnumilist vilgub, EventSource tehakse topelt |
| K2 | useRoomMessages | Madal | Cursor-loogika on semantiliselt vale ja ajaloo pagineerimist pole UI-s üldse |
| K3 | useRoomCall | Madal | Ebaõnnestunud liitumine jätab mikrofoni kinni püütuks — track'i ei stopita tõrke korral |
| K4 | useRoomCall | Madal | Teises tabis liitunu näeb "liitunud" olekut, mille mute-nupp juhib olematut lokaalset track'i |
| K5 | useRoomCall | Info | Kõne-poll ei puhka kunagi (5 s ka siis, kui kõnet pole) — ptk 4 K7 SSE ühendamine kaotaks selle |
| K6 | useRoomCall | Info | Toored veavõtmed jõuavad kasutajani (`call.participants_full` jms) — tõlgitakse ainult üks |
| K7 | RoomCallBar | Madal | i18n-mööda: salvestusstaatuse tekstid ja eesmärgi-rippmenüü on puhas kõvakodeeritud eesti keel |
| K8 | RoomCallBar | Info | UX: "Lõpeta kõne" ilma kinnituseta; nõusolekudialoogis pole neutraalset valikut |

**K1 — effect-lammutustsükkel (useRoomMessages.js:154–191).** Peaeffect sõltub `load`-ist ja `connectSse`-st, mis omakorda sõltuvad `useSse`/`blocked`/`authRequired` olekutest. Iga SSE avanemine (`setUseSse(true)`) käivitab ahela: callback'id luuakse uuesti → effect teardown (interval + EventSource suletakse!) → uuesti üles (**`setMessages([])`** + load(true) + UUS EventSource). Tagajärg: igal ruumi avamisel tehakse SSE-ühendus kaks korda, sõnumilist tühjeneb ja täitub uuesti (vilkumisvõimalus), ja iga SSE tõrge/taastumine kordab kogu tsüklit. Süsteem on ise-korrigeeruv, aga churn on asjatu. Parandus: lahuta ühenduse-elutsükkel (võti ainult `roomId`) andme-callback'idest ref'idega, või stabiliseeri callback'id.

**K2 — segaduses cursor + puuduv ajalugu (useRoomMessages.js:67–70, 99 vs messages/route.js:209–228).** Serveri `cursor` on *tagasisuunas* pagineerimine (`createdAt < cursor.ts` — vanemad sõnumid), aga klient saadab seda SSE-režiimi load'ides justkui järjejätku jaoks — ainus efekt on vanemate lehtede asjatu ümbertoomine üleminekuaknas (mergeById peidab kahju). Sisulisem pool: **ühelgi UI-rajal pole "lae vanemad sõnumid" võimalust** — ruum näitab igavesti ainult uusimat lehte; vanem ajalugu on DB-s kättesaamatu. Kas ehita üles-kerimise laadija (cursor on serveripoolselt valmis!) või kustuta cursor-haru kliendist ja tunnista piir teadlikult.

**K3 — mikrofon jääb kinni tõrkel (useRoomCall.js:112–174).** `connectLiveKit` seab `roomRef.current` *enne* `connect()`-i ja loob mic-track'i *enne* `publishTrack`'i; kui ükskõik milline hilisem samm viskab, püüab välimine catch (start/join) ainult `setError` — **track'i ei stopita → brauseri mikrofoni-indikaator jääb põlema**, kuni kasutaja lahkub või komponent unmount'ib; kordusliitumisel kirjutatakse ka `roomRef` üle ilma eelmist instantsi disconnect'imata (kuulajad ripakil). Tundliku platvormi jaoks on "mikrofon näiliselt aktiivne pärast ebaõnnestunud liitumist" halb signaal, kuigi midagi ei edastata. Parandus: `connectLiveKit` sisemine try/catch, mis tõrke korral stopib track'i + disconnect'ib + nullib ref'id (sisuliselt `cleanupLiveKit()` enne re-throw'd).

**K4 — mitme tabi illusioon (useRoomCall.js:388–389, 256–272).** `joined: joined || Boolean(joinedParticipant)` — kui kasutaja liitus kõnega teises tabis, näitab ka see tab "liitunud" koos mikrofoninupuga. Nupp muteerib `audioTrackRef.current?.mute?.()` — mis on siin tabis `null` (vaikne no-op) — ja PATCH'ib serveri `micMuted` lipu. Tulemus: server + UI väidavad "mikrofon väljas", aga *teise tabi* track edastab edasi. Parandus: eralda "serveris osaleja" ja "selles tabis ühendatud" olekud; mute-nupp vajab lokaalset ühendust (või PATCH + teise tabi sünk läbi SSE).

**K5–K6 — pisiasjad kõne-hookis.** (a) 5 s poll jookseb ka kõneta ruumis igavesti; `type:"call"` SSE-sündmused juba publitseeritakse (ptk 4 K7) — nende tarbimine lubaks polli magama panna. (b) `readPayload` viskab `payload.message || messageKey` — RoomCallBar tõlgib ainult `call.livekit_not_configured` (rida 141), kõik muu (nt `call.participants_full`, `call.recording_forbidden`) kuvatakse kasutajale toore võtmena.

**K7 — i18n-mööda (RoomCallBar.jsx:9–17, 29–39, 93).** `recordingStatusText` tagastab puhta kõvakodeeritud eesti keele ilma `t()`-ta (7 staatuseteksti), `RECORDING_PURPOSE_OPTIONS` sildid samuti, ja sektsiooni `aria-label="Helikõne"`. Lint keelab kõvakodeeritud JSX-teksti, aga need elavad JS-konstantides/funktsioonides ja lipsavad läbi — RU/EN kasutaja näeb salvestusribas eesti keelt. Sama pere mis ptk 4 K5 (serveripoolne süsteemsõnum); vii `t()`-le nagu failis mujal juba tehtud.

**K8 — UX-märkused.** (a) Moderaatori "Lõpeta kõne" lõpetab kõigi jaoks ühe klõpsuga, kinnituseta (RoomsPage'i ruumikustutusel on kinnitus olemas — muster on repos). (b) Nõusolekudialoog pakub ainult "Nõustun"/"Ei nõustu" — keeldumine tapab taotluse *kõigi* jaoks (server: iga DECLINED → kogu taotlus DECLINED) ja "otsustan hiljem" puudub; koos ptk 4 K2-ga (vastuseta lahkuja lukustab taotluse) on kõhkleja jaoks kõik teed halvad. Tooteotsus, mis väärib disaini-ringi.

### 10.4 Kokkuvõte

Kliendipool on korralik inseneritöö: failover-masin, dedup-merge ja LiveKit-koristus on kõik päriselt läbi mõeldud, ja UI usaldab serverit õigetes kohtades. Neli madalat jagunevad kaheks pereks: **elutsükli-tõrkerajad** (K1 effect-churn, K3 mikrofon kinni tõrkel, K4 mitme tabi illusioon — kõik "õnnetu tee" puudujäägid samas kvaliteetses koodis) ja **poolikult ühendatud võimekused** (K2 cursor/ajalugu, K5 kõne-SSE) — viimane haakub otse ptk 4 K7-ga: serveripoolne reaalajasünk on olemas, klient lihtsalt ei tarbi seda. K7 i18n-mööda on sama võla kliendipoolne pool, mille ptk 4 K5 serveris fikseeris. Kiireim väärt parandus on K3 (mikrofoni-indikaator on kasutaja usalduse küsimus), suurim arhitektuurivõit oleks `type:"call"` SSE ühendamine, mis lahendaks K5 ja vähendaks ptk 3 kirjeldatud polling-koormust.

---

## 11. `lib/calls/egress.js` — LiveKit egress-provider (salvestuse start ja stopp)

**Auditeeritud:** 2026-07-16 · 59 rida · ainus kasutaja `lib/calls/service.js` (read 698, 772, 791, 851) · abifail `lib/calls/recordingStorage.js` · SDK-kasutus verifitseeritud paigaldatud `livekit-server-sdk@2.15.3` koodi vastu · külgneb ptk 5 salvestusvoo-auditiga

### 11.1 Roll ja kontekst

Õhuke adapter LiveKiti EgressClient'i ümber: `createConfiguredEgressProvider(env)` → `{configured, startAudioRecording, stopRecording}`. `configured` on kolme lipu konjunktsioon (`RECORDING_ENABLED` ∧ `LIVEKIT_EGRESS_ENABLED` ∧ LiveKit-kredentsiaalid). Start käivitab room-composite egress'i (audioOnly, OGG) failiteega, mille ehitab `resolveEgressOutputFilePath` (recordingStorage.js:46); stopp kutsub `stopEgress`. Taustaks egress'i elutsükkel LiveKitis: STARTING → ACTIVE → ENDING → COMPLETE/FAILED/ABORTED, ja võtmeomadus: **room-composite egress lõpeb automaatselt, kui ruum sureb**. Failil endal ühikteste pole; integratsiooni katab `tests/calls/service.test.js` fake-provideriga.

### 11.2 Mis on korras

- **Fail-closed konfiguratsioon:** kõik kolm lippu vaikimisi väljas, ainult literaalne `"true"` lubab; topeltvärav (service.js:772 + provider ise mõlemas meetodis) — ptk 5 kinnitus „mock-režiimis ei saa midagi salvestada" toetub just sellele.
- **SDK-kasutus on korrektne:** signatuur `(roomName, {file: {filepath, fileType}}, {audioOnly: true})` klapib 2.15.3-ga ja plain-object teisendatakse protobuf-sõnumiks õigesti (kontrollitud paigaldatud paketi `EgressClient.getOutputParams` + PartialMessage-konstruktori vastu); OGG + audioOnly on omavahel kooskõlas.
- **Path-traversal maandatud kahekordselt:** failinimi sanitiseeritakse juba loomisel (`buildRecordingFileName`, recordingStorage.js:36) ja `path.basename` lõikab kataloogiosad (recordingStorage.js:49).
- **Saladused ei leki:** võtmeid ei logita ega tagastata; veakood `call.recording_disabled` järgib teenuse i18n-võtmete stiili.
- **DI-disain:** `env`-parameeter + service'i `egress`-süst teevad kihi testitavaks ja service.test.js kasutab seda päriselt (READY_TO_RECORD → start, stopi-tõrge → FAILED); klient luuakse kutse kohta, olekut ei hoita.

### 11.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** (uinuv kuni egress konfitakse) | Juba lõppenud egress'i stopp viskab → *õnnestunud* salvestus märgitakse FAILED ja valmis fail orvustub |
| K2 | **Keskmine** (uinuv) | Käivituse järel ei jälgi egress'i staatust keegi — vaikselt kukkunud egress selgub alles stopil, 15 s bloki järel |
| K3 | Madal | Egress'i failitee ehitatakse äpi-masina path-semantikaga; jagatud ketta deploy-leping on dokumenteerimata |
| K4 | Madal | Lippude parsimine dubleeritud service'iga ja juba triivinud (trim vs no-trim) |
| K5 | Madal | Stop-raja kaks auku: ID-ta egress on vaikselt peatamatu; väljalülitatud feature blokeerib ka olemasoleva salvestuse peatamise |
| K6 | Info | Dünaamiline `import("livekit-server-sdk")` ei anna midagi — ainus kasutaja impordib sama SDK staatiliselt |

**K1 — stopp ei talu terminaalset staatust (read 51–57; service.js:851, 893–906).** Room-composite egress lõpeb LiveKitis ise, kui ruum tühjeneb — tüüpstsenaarium: viimane osaleja sulgeb brauseriakna (leaveCall'i ei tule), LiveKit koristab ruumi, egress läheb COMPLETE ja OGG on kettal valmis. Kui seejärel keegi kutsub stopi — moderaatori nupp või ptk 4 auto-stopp (service.js:1068, 1078) — viskab `stopEgress` twirp-vea kujul „egress with status EGRESS_COMPLETE cannot be stopped" (sama veakuju, mida repo test EGRESS_FAILED kohta juba kodifitseerib: service.test.js:490); service'i catch märgib faili JA taotluse FAILED. Tulemus: **kasutaja kaotab salvestuse, mis tegelikult õnnestus**, ja valmis fail jääb storage'isse viiteta orvuna — sama jääk-muster, mille ptk 5 K1 fikseeris vastassuunast. Parandus kuulub siia faili: stopEgress'i tõrke korral küsi `listEgress({egressId})` ja hargne staatuse järgi — COMPLETE/ENDING → tagasta normaalselt (finalize jätkub; failikontroll recordingStorage'is on nagunii tegelik kohtunik), FAILED/ABORTED → viska edasi (olemasolev test jääb roheliseks). Veateksti parsimine oleks habras, staatusepäring mitte.

**K2 — staatust ei lepitata (read 33–48; recordingStorage.js:73–99).** `startRoomCompositeEgress` tagastab STARTING-oleku ja sellega egress'i käekäigu jälgimine lõpeb: repos pole ei `WebhookReceiver`'it, `egress_updated/ended` webhook-route'i ega `listEgress`-pollimist (kontrollitud üle repo). Kui egress-worker on maas või valesti seadistatud (deploy-klassika), näitab UI tervet seanssi „salvestab" — inimesed räägivad salvestuse eeldusega, aga lindistust ei teki (ptk 5 K1 peegelpilt: seal salvestus käib ilma nõusolekuta, siin nõusolek käib ilma salvestuseta). Viga selgub alles stopil: `waitForReadableStableFile` hoiab stop-HTTP-päringut 15 s kinni ja kukub siis `call.recording_file_not_ready` → FAILED. Miinimumparandus: kohe pärast starti (või kõneseisu esimesel pollil) üks `listEgress`-kinnitus, et staatus jõudis ACTIVE-sse — tõrge selguks sekunditega, mil osalejad saavad veel reageerida; täislahendus on LiveKiti webhook, mis annaks ühtlasi K1-le puhta lepitusmehhanismi.

**K3 — failitee semantika ja dokumenteerimata leping (recordingStorage.js:46–50).** `resolveEgressOutputFilePath` jookseb *äpi* protsessis (`path.resolve`/`path.join`), aga tulemus saadetakse *egress-worker'i* failisüsteemi jaoks. Windowsi dev-masinas (see repo!) tekib `C:\...\fail.ogg`, mis Linuxi egress-konteineris on kehtetu — salvestusvoogu ei saa lokaalselt läbi proovida; toodangus (Linux) on asi uinuv. Sügavam probleem on vaikiv deploy-leping: egress-worker ja äpp peavad jagama ketast, `RECORDING_EGRESS_OUTPUT_DIR` = *worker'i-poolne* mountpunkt, `RECORDING_STORAGE_DIR` = *äpi-poolne* sama kataloog. Seda ei ütle ükski koht — repos pole `.env.example`'it (kontrollitud) ega failis kommentaari. Kirjuta leping vähemalt faili päisesse, ideaalis env-dokumentatsiooni.

**K4 — lippude drift (read 3–10 vs service.js:45, 52–53).** Sama kolme lipu parsimine elab kahes kohas ja on juba lahknenud: siinne `envEnabled` teeb `.trim()`, `getCallRuntimeConfig` mitte; ka `liveKitConfigured` arvutatakse mõlemas. `RECORDING_ENABLED="true "` (lõputühik — .env-failis kergesti tekkiv) korral ütleb config-API (ptk 3 `config`-plokk) „väljas", aga egress lubab. Täna maskeerib lahknevust ptk 5 K5 (UI ei loe lippu nagunii), kuid kaks tõeallikat sama fakti jaoks on sama pere, mille ptk 3 K4 juba fikseeris. Ekspordi `getRecordingRuntimeConfig` siit ja kasuta service'is.

**K5 — stop-raja kaks auku (read 47, 51–53).** (a) `egressId: info?.egressId || ""` + stopi `if (!egressId) return null` — kui LiveKit ID-d ei tagastaks, on tulemus egress, mida *ei saa kunagi peatada*, ja stopp läheb vaikselt edasi finalize'i, mis kukub alles 15 s pärast (fail kasvab, suurus ei stabiliseeru). Ausam: viska juba start'is, kui ID puudub. (b) Stopp nõuab `config.configured` (rida 52) — kui ops keerab lipud maha ajal, mil salvestus on ACTIVE (intsidendistsenaarium), muutub see salvestus API kaudu peatamatuks (`call.recording_disabled`) ja jookseb ruumi surmani. Olemasoleva egress'i *peatamine* peab olema lubatud ka väljalülitatud feature'iga — värav kuulub ainult start'ile.

**K6 — kasutu laiskus (read 30, 54 vs service.js:3).** Dünaamiline `await import("livekit-server-sdk")` vihjab kavatsusele SDK-d mitte laadida, kui salvestus pole konfitud — aga ainus kasutaja service.js impordib sama paketti staatiliselt (`TrackSource`) juba moodulipäises, nii et SDK on mälus nagunii. Kaks importstiili sama sõltuvuse jaoks on müra: tee mõlemad staatiliseks või (kui bundle-suurus kunagi loeb) vii ka `TrackSource` dünaamiliseks.

### 11.4 Kokkuvõte

Adapter ise on distsiplineeritud: fail-closed kolmiklipp, korrektne SDK-kasutus (verifitseeritud paigaldatud versiooni vastu), traversal-kaitse ja DI-testitavus. Mõlemad keskmised leiud on ühe juurprobleemi kaks nägu: **LiveKit on teine tõeallikas, mida keegi ei lepita** — egress võib lõppeda ise (K1) või mitte kunagi käima minna (K2), ja kummalgi juhul valetab meie DB-olek. K1 on neist kibedam, sest karistab õnnestumist: valmis salvestus märgitakse FAILED-iks. Kuna egress on täna konfigureerimata, on kõik uinuv — aga K1+K2 kuuluvad täpselt samasse „enne RECORDING_ENABLED=true" parandustsüklisse, mille ptk 5 kokkuvõte juba defineeris; sealt lisandub siit COMPLETE-tolerants ja ACTIVE-kinnitus. Ülejäänu on hügieen: dokumenteerimata ketta-leping (K3), lipu-drift (K4, ühe ekspordi parandus), stop-värava viga (K5b) ja topelt-importstiil (K6).

---

## 12. `lib/calls/recordingStorage.js` — salvestusfailide ladustus ja finaliseerimine

**Auditeeritud:** 2026-07-16 · 141 rida · integratsioonid: `lib/calls/service.js:774–907` (start/stop), `lib/calls/egress.js:32` (LiveKit väljundrada), `lib/documents/server.js` (sihtladustus), test `tests/calls/recordingStorage.test.js`

### 12.1 Roll ja kontekst

Ptk 5 nõusolekuvoo ladustuskiht: ehitab salvestise failinime, ootab LiveKit egress-i väljundfaili valmimist ja tõstab selle dokumendisüsteemi. Voog: `buildRecordingFileName` → egress kirjutab jagatud kausta → stop-toimingul `finalizeRecordingFile` (oota stabiilset faili → loe → sha256 → kopeeri `uploads/<uuid>.ogg` → kustuta allikas) → service loob `UserDocument`-i ja markeerib failirea AVAILABLE. Kaks env-juhitavat kataloogi: `RECORDING_EGRESS_OUTPUT_DIR` (kuhu egress kirjutab) ja `RECORDING_STORAGE_DIR` (kust finalize loeb); failinimi on ainus võti nende vahel.

### 12.2 Mis on korras

- **Path-traversal kaitse mõlemas suunas:** allikal `basename` + prefiks-konteinment (read 55–58), egress-väljundil `basename` (rida 49), sihil dokumendimooduli enda konteinment (`resolveAbsoluteDocumentPath`, server.js:286–296).
- **Failinimi ehitatakse whitelist-sanitiseeritud ID-dest** (read 27–38) — injektsioonivaba ka siis, kui ID-allikas peaks muutuma.
- **Checksum on kooskõlaline:** sha256 arvutatakse täpselt neist baitidest, mis sihile kirjutatakse — kirje ja fail ei saa lahkneda (allika kohta vt K3 hoiatus).
- **Stabiilsusootamise *olemasolu* on õige disain:** LiveKit `stopEgress` tagastub enne faili lõplikku flush'i, naiivne kohe-lugemine oleks süstemaatiliselt katki; timeout/poll on env-häälestatavad ja parsitakse defensiivselt (NaN/negatiivne → default).
- **Sama-raja `unlink`-guard** (rida 129) väldib äsja kirjutatud faili kustutamist konfiguratsioonis, kus allikas = siht; `ensureReady` on idempotentne.

### 12.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** | `retentionUntil` on jõustamata lubadus — kuvatakse kasutajale, aga päris kustutus tiksub teise kella järgi (üldsweep `updatedAt` + `DATA_RETENTION_DAYS`) ja failirida jääb pärast kustutust rippuma |
| K2 | **Keskmine** | Tõrkerajad jätavad helisalvestise kettale järelevalveta — timeout, crash-aken ja ptk 5 orvustatud egressid maanduvad kõik koristamata failidena |
| K3 | Madal | 250 ms stabiilsusaken võib pooliku faili lõplikuks lugeda ja *allika kustutada* — jäädav andmekadu, mida checksum "kinnitab" |
| K4 | Madal | `durationSecondsBetween` annab puuduva `startedAt` korral ~56 aastat, mitte `null` |
| K5 | Madal | Kahe env-kataloogi vaikiv sidusus — lahknemisel kukub iga stop 15 s timeout'iga ja viga ei ütle põhjust |
| K6 | Madal | Finalize I/O: kogu fail Bufferis + mitteatomaarne kirjutus |
| K7 | Info | Sisu ei valideerita — suvalised baidid registreeritakse `audio/ogg` dokumendina, kuigi üleslaadimisrajal signatuurikontroll on |
| K8 | Info | Pisiasjad: `safeTimestamp` viskab Invalid Date'il, eksitav `lastError`, kataloogiloogika duplikaat, testkate ainult õnnelikul rajal |

**K1 — retention on kahe kellaga illusioon (read 101–105; retention.js:17, 325–394).** `retentionUntilFromEnv` (vaikimisi +90 päeva) salvestatakse failireale (service.js:777, 857) ja kuvatakse dokumendipoolel (audioWorkflow.js:162) kui lubadus „säilib kuni X" — aga **ükski kustutusrada seda väärtust ei loe**. Päris kustutus on olemas, kuid tiksub teise kella järgi: üldine retention-sweep (`maybeRunRetentionCleanup`, 6 h laisk tsükkel) kustutab salvestise `UserDocument`'i (RAG+fail+DB, fail-closed) siis, kui `updatedAt` on vanem kui `DATA_RETENTION_DAYS` — teine env-nupp ja teine ankur (dokumendi muutmisaeg, mitte salvestuse aeg ega lubatud tähtaeg). Täna langevad vaikeväärtused (90/90) kokku ja lubadus täitub ligikaudu — juhuslikult; niipea kui kumbagi nuppu keeratakse või dokument saab vahepeal update'i, lahknevad lubadus ja tegelikkus kummaski suunas (kustub varem kui lubatud / püsib kauem kui lubatud). Kustutuse järel — nii retention-sweep'is kui kasutaja käsitsi kustutusel (`documents/[id]` DELETE) — jääb `callRecordingFile` kirje AVAILABLE-iks surnud `filePath`'iga (`createdDocumentId` → `SetNull`, schema.prisma:3007): süsteemi ametlik salvestisekirje väidab faili olemasolu pärast selle kustutamist. FAILED-staatuses vahefailid (K2) ei allu kummalegi kellale. Tundlike kõnesalvestiste puhul on täitmata per-fail lubadus GDPR-i säilituspiirangu riive niipea, kui esimene päris salvestis tekib. Sama „vaikiv kustutusjääk" muster, mille ptk 2 K1 fikseeris sõnumite soft-delete'il ja mis on platvormil tuvastatud RAG-i poolel. Parandus: jõusta `retentionUntil` sweep'is eksplitsiitselt (retentionUntil < now → kustuta fail + dokument + markeeri kirje + auditikirje) või loobu per-fail lubadusest ja kuva üldpoliitika; igal juhul seo või dokumenteeri kaks env-nuppu (`RECORDING_DEFAULT_RETENTION_DAYS` vs `DATA_RETENTION_DAYS`) — ja sama töö on ühtlasi loomulik koht K2 orvukoristusele.

**K2 — järelevalveta helifailid (read 97–98, 124–131).** Kolm rada toodavad heli, mida ükski protsess ei korista:
- *Timeout-rada:* kui `waitForReadableStableFile` aegub (egress viibib üle 15 s), läheb kirje FAILED — aga sekundeid hiljem valmiv `.ogg` jääb egress-kausta; kirjel on küll `filePath`, kuid FAILED-faile ei vaata mitte miski ja K1 tõttu ei kehti neile ka retention.
- *Crash-aken:* protsess sureb pärast `writeFile`'i (rida 128) ja enne service'i DB-update'e → `uploads/` all on UUID-nimeline koopia, millele ei osuta mitte ükski kirje (nimi on juhugenereeritud), ja allikas jääb samuti alles.
- *Ptk 5 pärand:* K1/K3b orvustatud egressid kirjutavad pärast taotluse lõppolekusse viimist edasi — väljundfail ei jõua kunagi finalize'ni.

Privaatsusvaates on kõik kolm "helisalvestis, mille olemasolust süsteem ei tea". Parandus: perioodiline egress-kausta inventuur (fail vanem kui X ja ilma PROCESSING-kirjeta → kustuta + logi) K1 purge-töö osana.

**K3 — pooliku faili finaliseerimine + allika kustutamine (read 81–95, 130).** Fail loetakse valmiks, kui kaks `stat`'i `min(pollMs, 500)` = vaikimisi 250 ms vahega annavad sama suuruse. Kui egressi kirjutus seiskub üle selle (võrguketas, flush-paus, IO-throttle), finaliseeritakse poolik fail: checksum arvutatakse kärbitud sisult — andes kärbitud failile "tervikluse tõendi" — ja **allikas kustutatakse** (rida 130): originaal on läinud, jäädav andmekadu, mis avastatakse alles salvestist kuulates. Tõenäosus on madal (finalize käib pärast `stopEgress`'i, mil fail on enamasti täielik), aga tagajärg maksimaalne. Parandusvariandid tugevuse järjekorras: küsi LiveKit API-lt egressi staatust (EGRESS_COMPLETE on autoriteetne signaal, mida failisuuruse heuristika ainult asendab); pikenda stabiilsusakent (≥1 s); lükka allika kustutamine service'i õnnestunud DB-update'i järele.

**K4 — kestuse epohhiviga (read 62–67).** `startedAt ? getTime : 0` — puuduv `startedAt` muutub epohhiks, `Number.isFinite(0)` läbib ja `stop > start` annab kestuseks ~1,7 miljardit sekundit `null`-i asemel. Täna kaitseb ainult see, et `startRecording` seab `startedAt` enne ACTIVE-staatust — funktsiooni enda leping on katki. Parandus üherealine: kumbki puudub → `null`.

**K5 — env-kataloogide vaikiv leping (read 46–50 vs 52–60).** `resolveEgressOutputFilePath` (kuhu egress kirjutab) ja `resolveRecordingSourcePath` (kust finalize loeb) on kaks sõltumatut env-otsust, mis peavad osutama samale füüsilisele kataloogile. Kavatsus on ilmselt konteineripiir (egress näeb jagatud köidet ühe rajana, äpp teisena) — aga lahknemisel kukub iga stop 15 s timeout'iga ja `call.recording_file_not_ready` ei ütle kummagi raja kohta midagi; suhteline egress-rada resolvitakse pealegi *äpi* CWD vastu (rida 11), kuigi seda tarbib egress-protsess omas namespace'is. Parandus: startup-validatsioon või vähemalt env-lepingu kommentaar failis + timeout-veale diagnostika (otsitud rada, kataloogi olemasolu).

**K6 — finalize I/O hügieen (read 124–128).** Kogu fail loetakse Bufferisse ja kirjutatakse täiskoopiana — tunnipikkune OGG-kõne on suurusjärgus kümneid megabaite, paralleelsed finalize'd liituvad Node'i heap'is. Kirjutus pole ka atomaarne: crash `writeFile`'i keskel jätab pooliku sihtfaili (seos K2 crash-aknaga). Üks parandus katab mõlemad: stream-kopeerimine (`pipeline` + `createHash` läbivooluna) temp-nimele samas kataloogis + `fs.rename` — konstantne mälu, atomaarne siht, checksum samadelt baitidelt.

**K7 — signatuurikontrolli asümmeetria.** Dokumentide üleslaadimisrada valideerib failisignatuuri (`assertMimeMatchesBuffer`, server.js:257), salvestusrada mitte — finalize registreerib suvalised baidid `audio/ogg` dokumendina. Egress on ainus kirjutaja, seega risk on korruptsioon/misconfig, mitte rünne; 4-baidine `OggS` kontroll enne checksummi püüaks vale sisu varakult. Ei asenda K3-e (poolik OGG algab samuti OggS-iga).

**K8 — pisiasjad.** (a) `safeTimestamp` (read 32–34) viskab Invalid Date'il RangeError'i — nimi lubab vastupidist. (b) `lastError` eelistus (rida 97): kui varane poll sai ENOENT ja fail hiljem ilmus, aga ei stabiliseerunud, visatakse aegunud ENOENT `recording_file_not_ready` asemel — diagnostika eksitab. (c) `resolveLocalDocsStorageDir` (read 18–25) dubleerib `resolveDocsStorageDir`'i (server.js:136), kuigi sama moodul laetakse niikuinii dünaamiliselt (rida 14) — sama drift-pere mis ptk 1 K4. (d) Testkate: ainult `waitForReadableStableFile` õnnelik rada; finalize (konteinment, checksum, unlink, timeout-rada) on katmata — service-testid mockivad kogu storage'i.

### 12.4 Kokkuvõte

Fail ise on hoolikalt kirjutatud — konteinment mõlemas suunas, sanitiseeritud nimed, defensiivne env-parsing — ja leiud elavad elutsükli *lõpus* ja *tõrkeradades*. Kaks keskmist moodustavad ühe loo ptk 5 järelloona: salvestise **sünd** on väravatatud, auditeeritud ja snapshotitud, aga **surm** on juhuse hooleks — kuvatavat säilitustähtaega ei jõusta miski (kustutus tiksub teise kella järgi, K1) ja tõrkerajad jätavad heli kettale järelevalveta (K2). Sama „enne RECORDING_ENABLED=true" värav, mille ptk 5 kokkuvõte püstitas nõusolekumudelile, peab katma ka need kaks pluss K3 andmekao-akna — kõik kolm on täna uinuvad, sest egress on konfigureerimata. Ülejäänu (K4 lepinguviga, K5 env-leping, K6 I/O, K7 signatuur) on väikesed ja sobivad samasse parandustsüklisse. Konkreetseim järgmine samm: **üks purge/inventuuri-töö sulgeks korraga K1 ja K2** — ja annaks platvormile esimese päriselt töötava „ausa kustutuse" näite, mida RAG-i pool (P0) samuti ootab.

---

## 13. `app/api/covision/[id]/calls/**` — kovisiooni kõnede õhukesed wrapperid

**Auditeeritud:** 2026-07-16 · 9 route'i (à 32–59 rida) + jagatud kiht `lib/calls/covisionRoutes.js` (93 rida) ja `lib/calls/covisionLifecycle.js` (67 rida) · service-funktsioonid kattuvad ptk 4–5-ga (sama `lib/calls/service.js`)

### 13.1 Roll ja arhitektuur

Kovisiooni helikõne pere: `GET calls` (seis) + `POST start/join/end/leave` + `PATCH mute` + sõnavõtusoovid (`POST`, `DELETE me`, `PATCH resolve`). Route'id on päriselt õhukesed — kogu sisu elab kolmes kihis:

1. **`covisionRoutes.js`** — re-ekspordib ruumipere primitiivid (`callJson`/`callError`/`loadCallForResponse`/`statusForCallError`) ja lisab kovisiooni-spetsiifika: `requireCovisionCallAccess` (sessioon → kovisiooni rollivärav → juhtumi nähtavus → terminal-kontroll) ja `withCovisionCallMutation`.
2. **`covisionLifecycle.js`** — iga mutatsioon jookseb transaktsioonis `pg_advisory_xact_lock(hashtext('covisionSession:<caseId>'))` all, mille sees juhtum+osaleja+terminal **loetakse uuesti** värske DB-seisu pealt. Sama lukuvõtit kasutavad seansimasin (`covisionSession.js:1264`), atomaarne sulgemine (`covisionCompletedCases.js:713`) ja legacy-kirjutused — kõnemutatsioonid serialiseeruvad juhtumi elutsükliga täielikult.
3. **`service.js`** — kontekstipõhised funktsioonid (`getContextCall`/`startContextCall` + ptk 4-s auditeeritud join/leave/end/mute/speak).

Lisatud commit'is `7f20d7ce` ("Kovisioon: complete live workflow"). Lepingutestid on olemas: `tests/calls/covisionCallContracts.test.js` (5 testi, regex-kontraktid).

- **Kutsuja: PUUDUB.** Ükski klient ei kutsu ühtegi neist 9 route'ist (kontrollitud `components/` + `app/` kõik fetch-mustrid ja `basePath` kasutused). `RoomCallBar`/`useRoomCall` toetavad `basePath` parameetrit ja COVISION-konteksti sisu poolest, aga ainus instantseering (`ChatBody.jsx:2699`) on ruumirežiimis ilma basePath'ita; `CovisionWorkspace` pollib ainult seansiseisu (5 s), mis kõnet ei sisalda.

### 13.2 Mis on korras

- **Seni tugevaim ligipääsukett, fail-closed igas lülis:** 401 sessioonita → 403 vale globaalne roll (`requireCovisionRole`: SOCIAL_WORKER/SERVICE_PROVIDER/admin) → 404 nähtamatu juhtum (`visibleCaseWhere`, covision.js:372: omanik VÕI ACCEPTED-osaleja — **admini-möödapääsu pole üldse**, platvormi ADMIN ei näe võõra juhtumi kõneseisu; kooskõlas kovisiooni privaatsusmudeliga) → 409 terminal → ja mutatsioonis kordub kõik värskena luku all (`covisionLifecycle.js:39–52`; PENDING-kutsega osaleja põrkub mõlemas kihis).
- **TOCTOU on päriselt lahendatud, mitte loodetud:** ruumipere race-perekond (ptk 4 K3 topeltliitumine, K4 topelt-lõpetamine) on kovisioonis advisory-lockiga **neutraliseeritud** — üks aktiivne kõne juhtumi kohta on siin garantii, ruumides vaid parim-pingutus. Ainus auditeeritud pere, kus „tingimuslike kirjutuste" läbivat soovitust polegi vaja.
- **Sulgemine koristab atomaarselt sama luku all:** `purgeSessionDetailTx` kustutab kõik juhtumi CallSession'id (`covisionCompletedCases.js:573–575`), FK-kaskaadid katavad osalejad/soovid (schema:2914, 2933). Terminal-semantika on aus: GET → `call: null`, end/leave/cancel → idempotentne `onTerminal` ilma ühegi kirjutuseta — ja kuna sulgemine on sama lukuga atomaarne, ei saa tekkida „terminal, aga kõne ripub" vaheseisu.
- **Juhtumi-skoobitus:** body/URL-ist tulev `callSessionId` seotakse alati `contextType: COVISION + contextId: caseId` päringuga (`requireCallInCovision`), tx-sisese db-ga — võõra juhtumi/ruumi kõnet manipuleerida ei saa.
- **Salvestuskeeld kolmes sõltumatus kihis:** route'i config (`recordingEnabled: false`), serialiseerija (`recording: null`, `recordingAllowed: false`, service.js:208–209) ja service-värav (`call.recording_not_allowed`, service.js:540). Ptk 5 nõusolekuvea pere kovisiooni ei puuduta.
- **Pseudonümiseerimine API-kihis:** kovisiooni kõnes asendatakse kasutaja-ID-d `participantId`-dega (service.js:178–205) ja lepingutest valvab seda regex'iga.
- **Ptk 4 pärandvead ei kandu:** süsteemsõnumi et-EE kõvakodeering ei rakendu (covision-kõnel `roomId: null` → `endCallAndWriteSystemMessage` jätab sõnumi vahele, service.js:345); HOST-roll taastub taasliitumisel; token vermitakse ainult join'is pärast mõlemat kontrollikihti, JWT-sign on lokaalne (võrguta, providers.js:52–58).
- **Vealeping mutatsioonidel ühtlane:** kõik 8 mutatsiooni on try/catch + `statusForCallError` sees; body-parse on tolerantne (`req.json().catch(() => ({}))` — vigane JSON ei anna 500); `callJson` paneb no-store päised; params-lugejad taluvad Promise-kuju (Next 14/15).

### 13.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal (tooteotsus) | Kogu 9-route'iline API on UI-orb — server valmis, lepingutestid valmis, klienti pole; `emitCovisionCallEvent` on tühi stub |
| K2 | Madal | Vealeping lekib ja vaikib: tundmatu erind → toores `error.message` kliendile 500-ga, ilma ühegi serveri-logireata; access-catch kodeerib DB-tõrke 401-ks |
| K3 | Madal | GET on ilma try/catch'ita — ptk 3 K1 peegelpilt kovisioonis |
| K4 | Madal | Kõnesoovi saab luua kõnega liitumata ja ka lõppenud kõnele — service ei kontrolli osalust ega staatust (jagatud auk ruumidega) |
| K5 | Madal | LiveKit-identiteet = toores konto-ID — API peidab kovisioonis kasutaja-ID-sid teadlikult (lepingutest valvab!), provider-kanal paljastaks need |
| K6 | Info | Mute-PATCH: puuduv/rikutud body = vaikne unmute (`micMuted === true` on ainus kontroll) |
| K7 | Info | Juhtumi-lukk + rate-limiti puudumine: iga osaleja saab kõnemutatsioonidega seansimasina kirjutusrada pidurdada; tx sees tehakse ka asjatu täislaadimine; Prisma 5 s vaikimisi timeout teeb ootajaist 500-d |
| K8 | Info | Peegel-duplikaadid ruumiperega (identne livekitUrl-rida, ümberdefineeritud params-lugejad) — drift'i-seeme |

**K1 — orb-perekond (ptk 2 K1 muster, aga terve feature).** Kõik kolm otsa on valmis peale ühe: API (9 route'i), serialiseerija COVISION-tugi, `RoomCallBar`/`useRoomCall` `basePath`-parameeter — aga ükski kovisiooni pind ei renderda kõneriba ega fetchi kõneseisu. Sama lugu kinnitab `emitCovisionCallEvent` (`covisionRoutes.js:93`): tühi `async function () {}`, mida kõik route'id kohusetundlikult await'ivad — ruumide vaste publitseerib SSE-sse (mille sealne klient omakorda ignoreerib, ptk 4 K7; reaalajasünk on nüüd *kahes* peres illusioon, kummaski eri otsast poolik). Kuni otsuseta on see 9 endpoint'i autenditud kasutajaile kättesaadavat, testimata kasutajarajaga pinda. Otsus nagu ptk 2 K1: (a) ühenda `CovisionWorkspace`'i (RoomCallBar + `basePath={/api/covision/${caseId}/calls}` on disainitud täpselt selleks) või (b) pargi teadlikult — ja siis kaalu route'ide feature-lippu, et pind poleks asjata lahti.

**K2 — vealeping lekib ja vaikib (roomRoutes.js:209–227, covisionRoutes.js:50–52).** Kaks jalga:
- *(a) Tundmatu erind:* `statusForCallError` fallback tagastab `{message: String(error.message), status: 500}` ja `callError` saadab selle kliendile `messageKey`-na — Prisma/infra veatekst (nt P2028 transaktsiooni-timeout, ühendusviga) jõuab toorelt vastusesse. Ja **mitte ükski calls-pere route (ei kovisioonis ega ruumides) ei logi erindit** — catch neelab, 500 on serveripoolselt nähtamatu. Kontrast on repo enda konventsiooniga: kõik teised kovisiooni route'id käivad läbi `covisionErrorResponse`'i, mis ≥500 puhul logib `safeError`-iga JA maskeerib sõnumi üldvõtmega (`covisionApi.js:27–35`).
- *(b) Access-catch:* `requireCovisionCallAccess` püüab *iga* erindi ja tagastab `Number(error?.status) || 401` + toore `error.message` — `getVisibleCovisionCase`'i DB-tõrge muutub 401-ks (klient näitaks login-vaadet, sama pere mis ptk 1 K5) ja veatekst lekib jälle.
Parandus on keskne ja väike: `statusForCallError` fallback-harusse `console.error(safeError(error))` + fikseeritud võti (`api.common.server_error`), ja access-catch'is edasta sõnum ainult siis, kui `error.status` on olemas. Parandab korraga mõlemad pered.

**K3 — GET ilma püüniseta (calls/route.js:8–32).** `requireCovisionCallAccess` on ise try/catch'is (→ K2b), aga sealt edasi — `createCovisionCallService()` + `getContextCall` (4 Prisma-päringut) + `getCallRuntimeConfig` — jookseb lageda taeva all: DB-tõrge annab Next'i vaikimisi 500 ilma `{ok, messageKey}` kujuta. Täpselt sama leid oli ruumide GET-il (ptk 3 K1); parandus on sama 3-realine muster, mis mutatsioonidel juba on.

**K4 — valveta kõnesoov (service.js:358–375 vs 1099–1112).** `createSpeakRequest` ei kontrolli ei seda, et kasutaja on kõne aktiivne osaleja (mida `setMuted` teeb — `call.participant_not_found`), ega kõne staatust (mida `joinCall` teeb — `call.not_active`); `requireCallInCovision` ei filtreeri samuti staatust. Tagajärg: juhtumi ACCEPTED-osaleja saab tõsta kätt kõnes, millega ta pole liitunud — kovisiooni serialiseerija annab sellisele soovile `participantId: null` (kasutajat pole osalejate seas), mida ükski UI-leping ei oota; ja LÕPPENUD (veel purgemata) kõnele saab luua igavesti ACTIVE-soove (prügi, mis õnneks GET-is ei paista, sest GET näitab ainult aktiivset kõnet). Ruumipere route on identne (`app/api/rooms/.../speak-requests/route.js:28`) — auk on service-tasemel ja parandus käib sinna: nõua aktiivset osalust + `status === "ACTIVE"` nagu `setMuted`/`joinCall`.

**K5 — pseudonüümsuse leke provider-kihis (providers.js:52–58 vs service.js:178–205).** API-kiht asendab kovisioonis kasutaja-ID-d hoolikalt `participantId`-dega ja lepingutest (`covisionCallContracts.test.js:40–50`) valvab, et konto-ID-d väljundisse ei jõua. Aga LiveKit-tokenisse kirjutatakse `identity: userId, name: userId` — LiveKit-ruumis näevad kõik osalejad üksteise identity't kliendi-SDK kaudu, st toores konto-cuid liigub igale kaasosalejale. DisplayName'id on kovisioonis niigi nähtavad (pärisnimed), seega leke on „ainult" sisemine ID — aga see on täpselt see väli, mille väljajätmiseks keegi lepingutesti kirjutas. Uinuv kuni K1 lahenduseni; parandus: identity = `CallParticipant.id` (opaakne, unikaalne) ja mapping serveris — nõuab, et join tagastaks tokeni alles pärast `ensureParticipant`'i (juba nii on).

**K6 — mute-body valideerimata (mute/route.js:29).** `micMuted: body?.micMuted === true` — puuduv väli, typo (`"micMuted": "true"` stringina) või tühi body tähendab vaikselt *unmute*. Mõju on ainult enda olekule (service on self-only), aga leping oleks ausam 400-ga, kui `typeof body?.micMuted !== "boolean"`.

**K7 — luku hind ja puuduv piire.** Iga kõnemutatsioon hoiab `covisionSession:<id>` lukku terve transaktsiooni vältel — sama lukku, mida vajavad seansimasina faasisiirded ja sulgemine. Rate-limit'i pole ühelgi calls-route'il (invites-peres on, ptk 6), nii et üks pahatahtlik-või-katkine ACCEPTED-osaleja saab mute-toggle'i spämmiga juhtumi kirjutusraja püsivalt hõivata; ootajate transaktsioonid ületavad Prisma vaikimisi 5 s timeout'i → P2028 → K2a kaudu toores veatekst kliendile. Samasse ritta: join/end/leave lahendavad puuduva `callSessionId` transaktsiooni **sees** `service.getContextCall`'iga, mis teeb täislaadimise + serialiseerimise (~4 päringut, sh salvestuse-join) ainult `.id` kättesaamiseks — `findActiveContextCall` teeks sama ühe päringuga. Koos K1-ga uinuv; ühendamisel vääriks mutatsioonid kerget rate-limit'i ja tx-sisese laadimise õhendamist.

**K8 — peegel-duplikaadid.** `livekitUrl`-rida on tähemärgi täpsusega sama kovisiooni ja ruumi join'is (`join/route.js:38` mõlemas peres); `readCallSessionId`/`readRequestId` on covisionRoutes'is ümber defineeritud, kuigi identsed eksisteerivad roomRoutes'is, kust fail nagunii impordib nelja teist helperit. Sama drift'i-seeme, mille ptk 1 K4 / ptk 6 K5 juba kaardistasid — kui kunagi tekib kolmas kõnekontekst (nt supervisioon), tõsta `livekitUrl`-arvutus ja lugejad ühte kohta.

### 13.4 Kokkuvõte

Irooniline tulemus: **kõige kaitstumalt ehitatud pere kogu auditis — ja ainus, mida keegi ei kasuta.** Ligipääsukett on fail-closed ilma admini-erandita, TOCTOU on advisory-lockiga päriselt lahendatud (ruumipere race-perekond siin ei eksisteeri), sulgemine koristab atomaarselt, salvestuskeeld on kolmekordne ja pseudonümiseerimist valvab lepingutest. Sisulised leiud on kaks jagatud-kihi auku, mis parandavad ühtlasi ruume (K2 vealeping + logimatus, K4 valveta kõnesoov), üks peegelviga (K3 GET-püünis) ja üks provider-kihi lubaduserikkumine (K5 LiveKit-identiteet). Kõik on uinuvad, kuni K1 tooteotsus — ühendada `CovisionWorkspace`'i või parkida — on tegemata; kui ühendamine tuleb, tee enne K2/K3/K4/K5 ära (kõik on väikesed) ja lisa mutatsioonidele rate-limit (K7). Läbiv niit ptk 4 K7-ga: reaalajasünk on nüüd kahes peres poolik eri otsast — ruumides publitseeritakse event'e, mida klient ei kuula; kovisioonis on publish ise tühi stub.

---

## 14. `components/alalehed/chat/ChatBodyView.jsx` — ruumirežiimi liidesekoht

**Auditeeritud:** 2026-07-16 · 215 rida · puhas esitluskomponent (0 hooki, 0 olekut) · ~110 propi, neist 12 ruumi-spetsiifilist + abistaja-edastuse pere (`sendToAssistant`/`setSendToAssistant`/`aiNote`)

### 14.1 Roll ja kontekst

ChatBodyView on „jagaja": võtab ChatBody mootorilt (2780 rida) kogu oleku propidena ja monteerib näod — profiilinägu vs vestlusenägu (`showChatFace = !profileOpen`, rida 119), vestlusenäo sees töölauanägu vs vestlusliides (`showChatInterface = !workspaceOpen`, rida 124). Ruumirežiimi jaoks on see *ainus* koht, kus serveri ruumiolek (tiitel, päritolu, blokeering, kõneriba) füüsiliseks DOM-iks saab.

- **Ruumi-mootor elab õigel pool piiri:** `useChatRoomMode` → `useRoomMessages` (SSE/polling/markRead, ptk 10) kutsutakse ChatBody's (`ChatBody.jsx:448–470`) — nägude vahetamine EI lammuta sõnumisünki. `RoomCallBar` seevastu luuakse ChatBody's elemendina (`ChatBody.jsx:2698–2705`), aga monteeritakse siin tingimuslikult (rida 180) — kõne-hook elab näo *sees* (→ K1).
- **Ruumi-propid ja sihtkohad:** `ChatTopNotices` (tiitel/päritolu/kriis, rida 178) · `roomCallNode` (rida 180) · `ChatComposer` (keelamine, režiimisilt, help-edastus; rida 186 + identiteedivõti `room:${roomId}:${isHelpMatchRoom ? "help" : "standard"}`) · `RoleViewSwitcher` värav `!isRoomMode` (rida 174, RV-P0 lisa) · `spatialEntry = !isRoomMode && !embedded` (`ChatBody.jsx:2643`).
- **Sisenemisrajad:** `/vestlus?roomId=…&roomKind=help-match` (kanooniline, `lib/roomPath.js`), `/room/<id>` → redirect *ilma* `roomKind`'ita (`app/room/[roomId]/page.jsx:14`), join-voog samuti ilma (`app/join/page.jsx:68`).

### 14.2 Mis on korras

- **Tööjaotus on põhimõtteliselt õige:** mootor (hookid, olek, SSE) ChatBody's, esitlus siin — töölaua või profiili avamine ei katkesta ruumi sõnumivoogu, markRead-tsüklit ega SSE-ühendust; ainuke kestev-olekuga asi, mis näo sisse lõksu jäi, on kõneriba (K1).
- **`roomCallNode` värav ChatBody's on fail-closed:** `isRoomMode && sessionUserId && !roomBlocked && !roomAuthRequired` — blokeeritud või autentimata kasutajale kõneriba ei monteerita üldse.
- **Composeri keelamine on järjekindel:** blocked/auth keelab textarea, mikrofoni, saatmisnupu ja manuste nupu sama tingimusega (`ChatComposer.jsx:874, 910, 914–915`) — poolikut „saab tippida, aga mitte saata" seisu pole.
- **RoleViewSwitcher'i värav (värske RV-P0 rida 174) on põhjendatud ja kommenteeritud:** ruumis roll ei mängi (liikmesuspõhine ligipääs), töölaual on oma lüliti — kolmiktingimus `showChatInterface && isAdmin && !isRoomMode` on täpselt õige.
- **Kaheikooniline sisenemine on ruumis teadlikult väljas** (`spatialEntry`), kommentaar dokumenteerib tellija otsuse — sisendriba peab ruumis alati nähtav olema.
- **Tiitlikoordinatsioon ei dubleeri:** `hideRoomTitle = Boolean(roomModeLabel)` (`ChatBody.jsx:2297`) — kui composer näitab ruumisilti, ei näita ChatTopNotices sama tiitlit teist korda; kompaktne tuletus (`getCompactRoomTitle`) lõikab asukoha ja soov/pakkumine-sabad.
- **Päritolu-privaatsuslause** (PRE_INQUIRY/SERVICE_PROVIDER_INQUIRY/JOURNEY korral „privaatset Teekonda ei jagata automaatselt", `ChatNotices.jsx:55–60`) on hea läbipaistvusmuster.
- **Per-ruumi composer-remount on õigustatud strateegia:** ruumi vahetudes ei rända eelmise ruumi mustand kaasa (K4 puudutab ainult võtme *help-osa* hilist flippi).

### 14.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** | Näo-lülitid katkestavad aktiivse kõne hääletult ja jätavad serverisse fantoom-osaleja — viimase osaleja puhul jääb kõne igavesti ACTIVE |
| K2 | **Keskmine** | Ruumirežiimi visuaalkiht on redisainis katmata: liikme sõnum, ruumi tiitel/päritolu ja kõneriba renderduvad ilma ühegi CSS-reeglita |
| K3 | Madal | `roomBlocked`/`roomAuthRequired` selgitus ei jõua kunagi kasutajani — ChatTopNotices viskab propid maha, i18n-võtmed on olemas ja kasutuseta |
| K4 | Madal | Composeri identiteedivõti remount'ib sisendi, kui help-match tuvastus saabub URL-ist hiljem — mustand ja fookus kaovad |
| K5 | Madal | `aiVisible` läbipaistvusmärgis arvutatakse ja edastatakse, aga ChatMessageItem viskab selle minema — „kas AI nägi seda" info kadus UI-st |
| K6 | Info | Rudimentide kiht: kasutamata propid, konstantsed `aria-hidden`'id, ChatMobileTopNav'i surnud workspace-haru, tühi `<footer />`, surnud `chat-container` klass |
| K7 | Info | markRead jookseb ka siis, kui sõnumid on töölaua/profiilinäo taga peidus — „loetud" ilma nägemata |

**K1 — kõne elab vales kihis (rida 180 + `ChatBody.jsx:2698` + `useRoomCall.js:98–100`).** `{showChatInterface ? roomCallNode : null}` ja kogu vestlusenäo `showChatFace`-värav tähendavad: töölaua VÕI profiili avamine unmount'ib RoomCallBar'i, mille sees elab `useRoomCall` → unmount-cleanup teeb *ainult* lokaalse `cleanupLiveKit()` (track stopp + disconnect), serveri `leave`-POST'i ei tehta. Tagajärjed keset aktiivset kõnet:
1. *Heli kaob hoiatuseta* — kasutaja arvates on ta endiselt kõnes (ta ju ainult vaatas töölauda);
2. *Server näitab teda aktiivse osalejana* (leftAt saab ainult leave-rajalt, ptk 4) — teised näevad „tumma" osalejat;
3. *Naastes tekib ptk 10 K4 illusioon sama tabi sees:* RoomCallBar remount → poll näeb osalejarida → `joined: true` → mute-nupp juhib olematut lokaalset trackki;
4. *Kui ta oli viimane osaleja, ei käivitu auto-lõpp* (see elab leave-rajal, `service.js:1061`) — kõne jääb ACTIVE, kuni keegi käsitsi lõpetab.
Stsenaarium on argine: mobiili topnav'is on „Töölaud" tavaline navigatsioonisiht ja kõne ajal töölaua/profiili piilumine on loomulik käitumine. Parandus arhitektuurne, mitte kosmeetiline: kõne kui *kestev seansiolek* peab elama nägudest väljaspool — tõsta `useRoomCall` ChatBody tasemele (hook alati elus, kui `isRoomMode && sessionUserId`) ja anna RoomCallBar'ile seis propidena; või vähemalt teadlik vahevariant: unmount'il POST `leave` (paneelivahetus = kõnest lahkumine, üllatav aga aus) või blokeeri näovahetus aktiivse kõne ajal kinnitusdialoogiga. Praegune vaikne variant on kolmest halvim.

**K2 — liides annab kõik edasi, visuaalkiht võtab vastu ainult pool (`PanelFrame.jsx:87,204` + `chat.css`).** `data-conversation="1"` kehtib kogu `/vestlus` teel, sh `?roomId=` — st kaamerasõidu-lavastus, orb-avatar ja vedelklaas-mullid käivituvad ka ruumirežiimis. Aga uue kujunduse sõnumileping katab ainult kaks rolli: `data-role="ai"` (29 selektorit) ja `data-role="user"` (7). Ruumirežiimi kolmas roll **`data-role="member"` — teise inimese sõnum — 0 selektorit**; ruumi tiitel ja päritolulause (ChatNotices klassita `<div>`-id) — 0; RoomCallBar (`section[aria-label="Helikõne"]`, samuti klassita) — 0. Ainus, mis riietub, on kriisi/vea `role="alert"` läbi panel.css:759 üldreegli. Praktikas: mitmeliikmelises ruumis renderdub kaasliikme sõnum stiilita toortekstina keset viimistletud lavastust, kõneriba on kuhi stiilimata nuppe. (Kinnitatud ammendava selektoriotsinguga üle `app/styles/`; runtime-pilti ei tehtud — ruumitaustaga lehe screenshot hangub teadaolevalt.) Tõenäoliselt teadlik „redisain pooleli" seis — aga see vajab kirjapanekut ruumirežiimi *lepinguna*: enne kui help-match ruumid päriskasutajaid näevad, vajab `member`-roll mullistiili (kavand: nagu `user`, aga vastasjoondusega + autorinimi), tiitel/päritolu klassid või data-atribuudid ja kõneriba oma ptk-i disainisüsteemis.

**K3 — nähtamatu blokeering (rida 178 + `ChatNotices.jsx:39–48` + `useChatStream.js:210–248`).** ChatBodyView annab `roomBlocked`/`roomAuthRequired` ChatTopNotices'ile edasi, aga komponent ei destruktureeri kumbagi — propid kukuvad vaikselt maha. Võtmed `chat.room.blocked` („Vestluses osalemine ei ole hetkel võimalik…") ja `chat.room.auth_required` („Sessioon aegus. Palun logi uuesti sisse.") on kõigis keeltes olemas ja kasutusel *ainult* assistendi-striimi vearajal (`useChatStream.js:662–694`) — passiivsel vaatamisel ei kasuta neid miski. Tulemus: väljalogitud kasutaja avab ruumilinigi (`/room/<id>` → `?roomId=` ilma login-parameetrita) → GET 401 → tühi vestlusaken + hall keelatud sisendriba + **mitte ühtegi selgitavat sõna ega login-nuppu** (LoginModal avaneb ainult `?login=1` parameetri või assistendi-saatmise 401 kaudu — aga saatmine on juba keelatud). Eemaldatud/blokeeritud liige näeb sama tumma seina. Lisaks on ruumi-saatmisrada ise vaikiv: `sendMessage` tagastab blocked/auth/403/401 korral lihtsalt `false` (read 211–216, 232–237) — banner'it ei seata (alles muu tõrge annab `chat.room.send_error`). Parandus väike ja lokaalne: ChatNotices võtku propid vastu ja renderdagu olemasolevate võtmetega bänner (auth-juhul + login-CTA, mis avab LoginModal'i); send-rajale needsamad võtmed `setErrorBanner`'isse.

**K4 — võtme-flip sööb mustandi (rida 186 + `ChatBody.jsx:413–416` + `useRoomMessages.js:89–95`).** Composeri `key` sisaldab `isHelpMatchRoom`'i, mille algväärtus tuleb URL-i `roomKind`-parameetrist. Kanoonilised lingid (`lib/roomPath.js`, ChatSidebar) panevad parameetri kaasa, aga `/room/<id>` lühilink ja join-voog navigeerivad ilma → algväärtus `false` → esimene GET toob meta (`isHelpMatchRoom: true`) → key flip `room:X:standard` → `room:X:help` → **ChatComposer unmount+remount**: pooleli tipitud tekst kaob, fookus kaob, tööriistariba hüppab (`hideComposerTools` flip). Aken on esimese laadimise sekund, aga deterministlik igal lühilingi/kutse-sisenemisel help-match ruumi — täpselt see hetk, mil uus kasutaja esimest korda tippima hakkab. Parandus: võta `isHelpMatchRoom` võtmest välja (`room:${roomId}` piisab — help/standard erinevused on propid, mitte identiteet; `sendToAssistant` nullimise teeb useChatRoomMode effect juba ise) ja/või lisa `roomKind` ka `/room/<id>` redirect'ile ja join'ile.

**K5 — läbi lõigatud läbipaistvusmärgis (`useChatRoomMode.js:45,53` → `ChatBody.jsx:2270` → `ChatMessageItem.jsx:98`).** Ruumis, kus osa sõnumeid edastatakse assistendile (help-edastuse lüliti) ja osa mitte, peab kasutaja teadma, *millised* sõnumid AI nägi. Selle jaoks on terve konveier: `aiVisibleByMessageId` kaart, `onRoomMessageSent` markeering, iga sõnumi `aiVisible` lipp mappimisel ja `aiVisible={!!msg.aiVisible}` prop — mille ChatMessageItem võtab vastu kujul `aiVisible: _aiVisible` ehk **viskab minema** (nagu ka `authorRole` ja `isRoomMode`). Märgis oli kunagi olemas või pole kunagi ühendatud — kummalgi juhul on praegu privaatsusläbipaistvuse info olemas mudelis ja puudu ekraanilt. Tooteotsus: kas renderda (väike ikoon + tooltip „assistent näeb seda sõnumit" — koht on olemas, autorirea kõrval) või kustuta kogu konveier kolmes failis. Sama „valmis torustik, ühendamata ots" pere nagu ptk 2 K1 ja ptk 4 K7.

**K6 — rudimentide kiht.** (a) `isEntering` ja `mobileRailVisible` destruktureeritakse, aga keha ei kasuta kumbagi; `hasAllConversationSources` on alakriipsuga teadlikult pargitud. (b) `aria-hidden={profileOpen ? "true" : "false"}` (read 130, 209) elab harudes, kus tingimus on definitsiooni järgi konstantne (`showChatFace = !profileOpen`) — mõlemad annavad alati `"false"`; jäänuk ajast, mil mõlemad näod olid korraga DOM-is. (c) ChatMobileTopNav renderdub ainult `showChatInterface` (= töölaud kinni) sees, seega `rightRailActiveKey={workspaceOpen ? "workspace" : …}` (rida 145) ja topnav'i sisemine `workspaceOpen`-skaala (`ChatMobileTopNav.jsx:399`) on surnud harud; ühtlasi kaob mobiilis topnav töölaua avamisel üldse — ainus tagasitee on WorkspacePanel'i enda sulgur (kui see on teadlik, väärib kommentaari). (d) Rida 133 kordab `!profileOpen`'i, mille väline haru juba garanteerib. (e) Tühi `<footer />` (rida 189) ja `chatContainerClassName="chat-container"` — klass, mida ükski elav selektor ei kasuta (ainus viide `tailwind.css:10` nõuab ka `.glass-box`'i, mida elemendil pole). Kõik koristatav ühe hügieeni-commit'iga; alternatiiv on (b) puhul naasta „mõlemad näod DOM-is, aria-hidden juhib" mustri juurde, mis oleks oleku-säilituse mõttes isegi parem — aga see on juba disainiotsus.

**K7 — markRead ilma nägemata.** Kuna useRoomMessages elab ChatBody's (mis on K1 valguses *õige*), jookseb polling + markRead ka siis, kui sõnumid on töölaua- või profiilinäo taga: kasutaja avab ruumi, lülitub kohe töölauale, vahepeal saabuvad sõnumid märgitakse ≤5 s throttle'iga loetuks (`useRoomMessages.js:54–64` → ptk 1 route) ja teavitused sulguvad, kuigi silm pole neid näinud. Tänase unread-täpsusnõude juures kosmeetiline; kui teavituste UX muutub olulisemaks, seo markRead nähtavusega (`showChatInterface && !profileOpen && document.visibilityState === "visible"` — lipp tuleks ChatBodyView'st ChatBody'sse tagasi anda või tuletada samast olekust, mis nägusid juhib).

### 14.4 Kokkuvõte

Liidesekoha *arhitektuur* on õige: mootor ChatBody's, esitlus siin, ja ruumi-propide plumbing ise on korrektne (väravad fail-closed, keelamised järjekindlad, värske RoleViewSwitcher-värav eeskujulikult kommenteeritud). Kaks keskmist viga on mõlemad „piiri valel poolel" vead: **kõne elab näo sees** (K1 — paneelivahetus katkestab heli ja külvab fantoom-osalejaid; kestev seansiolek tuleb hook'ina mootorikihti tõsta) ja **visuaalne leping katab ruumirežiimist ainult assistendi-poole** (K2 — `member`-roll, tiitel, päritolu ja kõneriba on uues kujunduses stiilita). Kolm madalat on sama loo väiksemad peatükid: blokeeringu-selgitus kaob liideses (K3), composeri identiteedivõti flipib lühilingi-sisenemisel (K4) ja aiVisible-märgis on läbi lõigatud (K5) — kõik kolm on „torustik olemas, viimane meeter ühendamata" muster, mida see audit on näinud juba ptk 2 K1-s ja ptk 4 K7-s. Ruumirežiimi UI-poole tervikpilt kahe peatüki peale (ptk 10 kliendipool + siinne liidesekoht): serveripool on küps, kliendipool insenertehniliselt korralik, aga *ruumi kui toote* viimistlus — nähtavus, selgitused, visuaalne keel — on redisaini järjekorras seni vahele jäänud.

---

## 15. `app/api/rooms/route.js` — ruumide loend (GET)

**Auditeeritud:** 2026-07-16 · 205 rida · ainus meetod `GET` · kutsujad: `components/rooms/RoomsPage.jsx:171`, `components/ChatSidebar.jsx:177`, `components/documents/MeetingSummaryRoomShare.jsx:37`

### 15.1 Roll ja kontekst

Tagastab sisseloginud kasutaja aktiivsete liikmesuste ruumid (pealkiri, päritolu, roll, liikmete arv, viimane sõnum, unread-loendur). See on ruumide UI „koduekraan" — nii ruumileht, külgriba kui U10 jagamisdialoog ehitavad valiku selle vastuse pealt.

### 15.2 Mis on korras

- **Fail-closed billing-filter:** iga liikmesus käib läbi jagatud `hasRoomBillingAccess` (read 128–141) — sama värav, mida sõnumi- ja kõne-route'id jõustavad; loend ei näita kunagi ruumi, kuhu sisenemine 403 annaks.
- **ADMIN-i tellimuspäring skipitakse** (rida 83) — täpselt see optimeering, mille puudumist ptk 3 K6a kõnede-perele ette heitis; siin on see tehtud.
- **Unread-semantika kooskõlas ptk 1-ga:** `authorId not me` + `deletedAt: null` + `createdAt > lastReadAt || epoch` (read 161–173) — sama filtrikolmik, mis read-route'i vesimärk; kustutatud sõnum ei tekita igavest unread'i.
- **roomId normaliseeritakse ja tühjad/ruumita liikmesused filtreeritakse** (read 128–134) — defensiivne ka andmeprügi vastu.
- **Viimane sõnum tuuakse `take: 1` include'iga** (read 108–119), mitte eraldi päringuga — õige suund (kontrastina K1-le).
- **Terve handler on try/catch + `safeError` sees** (read 201–204) — vealeping `{ok, messageKey}` püsib ka DB-tõrkel; õed-route'id (ptk 17–18) seda ei tee.

### 15.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | N+1: kaks count-päringut ruumi kohta, pagineerimata — 30 ruumiga 60+ päringut igal loendilaadimisel |
| K2 | Madal | Tellimuse aegumisel ruumid lihtsalt *kaovad* loendist — kasutajale ei jää ühtegi selgitust ega jälge |
| K3 | Info | `lastMessage.content` läheb loendisse täispikkuses — kärbe puudub |
| K4 | Info | Surnud/rudimentne kiht: `canTrackUnread = true` konstant, `rawMemberships` alias, helper-koopiad (ptk 1 K4 pere) |

**K1 — loenduri-N+1 (read 150–174).** Iga liikmesuse kohta jooksevad `roomMember.count` + `roomMessage.count` eraldi (küll `Promise.all`-is, aga ruumide kaupa järjest genereeritult) ja pagineerimist pole — kasutaja 30 ruumiga maksab ~62 päringut igal külgriba-avamisel; `MeetingSummaryRoomShare` teeb sama hinna dialoogi avamisel, kuigi vajab ainult id+title'it. Parandus on standardne: kaks `groupBy` päringut (`roomMember.groupBy({by: ['roomId'], where: {roomId: {in: ids}, leftAt: null}, _count})` ja sama sõnumitele `createdAt > lastReadAt` tingimusega liikmesuse kaupa — viimane vajab kas per-ruum OR-klauslit või raw-päringut) või vähemalt `Promise.all` üle *kõigi* ruumide korraga praeguse kaupa-kaupa asemel. Skaala on täna väike (ruume tekib kutse/sobituse kaupa), seega Madal — aga see on esimene route, mis muutub aeglaseks, kui ruumide arv kasvab.

**K2 — vaikiv kadumine billing-väraval (read 128–141).** Kui tellimus aegub, filtreerib loend mitte-helpMatch ruumid lihtsalt välja: kasutaja vaatest ruum *kadus ära* — kaarti, halli olekut ega „vajab aktiivset tellimust" selgitust pole, ja et sama kasutaja `messages`-GET annaks 403 `join_unavailable` (millel on i18n-selgitus olemas), ei jõua ta kunagi isegi selle veani, sest tal pole enam linki, mida avada. Teised liikmed näevad teda samal ajal edasi liikmena. Fail-closed on *õige* — aga aus UX oleks tagastada need liikmesused `accessible: false` lipuga (või eraldi massiivina) ja näidata halli kaarti selgitusega. Tooteotsus, mitte kohustus; dokumenteerimist väärib mõlemal juhul.

**K3 — kärpimata eelvaade.** `lastMessage.content` (read 185–191) on RoomMessage täistekst (`@db.Text`, piiramata — vt ptk 18 K2): üks 50 kB sõnum paisutab iga loendivastuse, kuigi UI näitab üherealist eelvaadet. `content.slice(0, ~200)` serialiseerimisel piisaks.

**K4 — rudimendid.** `canTrackUnread` on alati `true` (rida 152) ja valib ternary'ga haru, mida teist pole; `rawMemberships = memberships` (rida 126) on alias ilma põhjuseta; `requireUser`/`hasActiveSubscription`/`json`/`errorJson` on ptk 1 K4 kaardistatud koopiapere liikmed. Koristada möödaminnes.

### 15.4 Kokkuvõte

Sisuliselt terve route: värav õige, unread-semantika kooskõlas, vealeping peetud, ADMIN-optimeering olemas. Mõlemad madalad on kasvuvalud — loenduri-N+1 (K1) lööb välja ruumide arvu kasvades ja billing-kadumine (K2) esimese aeguva tellimusega. Kumbki ei blokeeri midagi täna; mõlemad tasub lahendada enne, kui ruumid muutuvad põhivooks.

---

## 16. `app/api/rooms/[roomId]/route.js` (DELETE) + `[roomId]/leave` — ruumi kustutamine ja lahkumine

**Auditeeritud:** 2026-07-16 · 84 + 94 rida · kutsuja mõlemal: `components/rooms/RoomsPage.jsx` (leave read 106–129, delete read 141–163)

### 16.1 Roll ja kontekst

Ruumi elutsükli lõpp: omanik kustutab ruumi jäädavalt (hard-delete, kaskaadid skeemis), liige/moderaator lahkub (soft, `leftAt`). UI-s on kustutusel kinnitusdialoog (`confirmRoom`), lahkumine on **ühe klõpsuga**, ilma kinnituseta.

### 16.2 Mis on korras

- **Omanikukontroll on serveris** (`room.ownerId !== auth.userId` → 403, read 69–71) — mitte UI usaldusel; olematu ruum annab 404 enne omanikukontrolli.
- **Kustutuse kaskaadid katavad vestlusandmed:** `RoomMember`, `RoomMessage`, `Invite` on `onDelete: Cascade` (schema.prisma:2791–2794, 2817, 2846, 2868) — sõnumijääke ei teki.
- **Lahkumine on fail-open õiges suunas:** leave **ei nõua** billing-väravat — aegunud tellimusega kasutaja saab ruumist ikka lahkuda (vrd ptk 15 K2: ta küll ei näe ruumi loendis, aga API-rada on olemas). Teadlikkus väärib kommentaari koodis.
- **OWNER ei saa lahkuda** (409 `owner_cannot_leave`, read 71–73) — ruum ei jää kunagi peremeheta; kordus-leave annab puhta 404 `not_member`.
- **SSE-järelkoristus töötab:** lahkunu striim sulgub ≤20 s taaskontrolliga (ptk 9) ja `requireRoomCallAccess`/`ensureAccess` blokeerivad ta edasised päringud kohe (`leftAt: null` filter).
- Mõlemad route'id on try/catch sees ja leave kasutab õigesti liit-unikaalvõtit `roomId_userId` (read 75–85).

### 16.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | **Keskmine** | Aktiivse kõnega ruumi kustutamine orvustab kõne jäädavalt — `roomId → null` teeb kõne API kaudu lõpetamatuks; käiva salvestusega ühineb see ptk 5 K1 peatamatu egress'iga |
| K2 | **Keskmine** (tooteotsus) | HELP_MATCH-ruumi saab omanik ühepoolselt hävitada — teise poole vestlusajalugu kaob, match jääb ruumita ripakile |
| K3 | Madal | Ruumist lahkumine ei korista kõneosalust — fantoom-osaleja hõivab kohta, blokeerib salvestuse readiness'e ja hoiab kõne igavesti ACTIVE |
| K4 | Madal | Hard-delete ilma auditijäljeta — salvestustel on `dataAuditLog` igal üleminekul, terve ruumi ajaloo hävitamisel null rida |
| K5 | Madal | UI ja serveri kustutusvärav käivad eri andmete pealt: `role === "OWNER" \|\| "ADMIN"` (surnud väärtus) vs `ownerId` |
| K6 | Info | Omaniku ainus väljapääs on ruumi hävitamine — omanikuvahetuse rada puudub; leave on UI-s kinnituseta ja mõlema toimingu tõrge neelatakse `console.warn`'i |
| K7 | Info | `console.error("[room delete] failed", err)` toores err (safeError-drift, sama ptk 2 K4 pere) |

**K1 — kustutus keset kõnet (route read 73–75; schema.prisma:2891; roomRoutes.js:129–137).** `CallSession.roomId` on `onDelete: SetNull` — ruumi kustutamine jätab kõneseansi alles, aga nullib ta ruumiviite. Kui kõne on sel hetkel **ACTIVE**: (a) `requireCallInRoom(callSessionId, roomId)` ei matchi enam kunagi (`roomId` on null) → ei `leave`, `end` ega `mute` tööta — osalejad ei saa kõnet API kaudu isegi lõpetada; (b) auto-lõpp ei käivitu kunagi (see elab leave-rajal, mis on nüüd suletud) → kõne jääb igavesti ACTIVE koos `leftAt: null` osalejaridadega; (c) LiveKit-ühendused elavad serveri teadmata edasi, kuni klient ise katkestab; (d) kui käis **salvestus**, siis `stopActiveRecordingForCall` ei jookse kunagi — see on ptk 5 K1 peatamatu egress *ilma ühegi osaleja veata*, puhtalt omaniku kustutusklõpsust. Kustutav omanik on pealegi tõenäoliselt ise kõnes — UI ei hoiata. Parandus: DELETE-handler'is enne `room.delete`'i lõpeta aktiivsed kõned sama teenusega (`findActiveRoomCall` → `endCall({canModerate: true})`, mis koristab osalejad, sõnavõtusoovid ja salvestuse) — või konservatiivsem variant: 409 „ruumis käib kõne", kuni kõne on lõpetatud. Esimene on parem: omanik ei peaks saama blokeeritud omaenda ruumi kustutamisel kinni jääda.

**K2 — abisobituse ruumi ühepoolne häving (schema.prisma:2759, 2770).** `HelpMatch.roomId` on `SetNull` — kustutus jätab sobituse alles, aga *ruumita*: abivajaja ja aitaja ühine vestlusajalugu (sh kokkulepped, mida võidi hiljem vajada) kustub kaskaadiga jäädavalt, ja match'i kirje ripub edasi ilma suhtluskanalita. Ruumi omanik on kummalgi juhul üks pool kahest — st **üks osapool saab teise poole nõusolekuta hävitada mõlema ühise ajaloo**. Sama kehtib PRE_INQUIRY ja SERVICE_PROVIDER_INQUIRY päritolu ruumidele (kliendi pöördumisajalugu). `hasRoomBillingAccess` kohtleb helpMatch-ruume erilistena (tasuta), aga kustutusrada ei tee päritolul mingit vahet. Tooteotsus, mis vajab teadlikku vastust: (a) keela flow-põhiste ruumide (`originType !== MANUAL_INVITE`) omaniku-kustutus ja paku „arhiveeri/lahku" asemele; (b) või nõua mõlema poole kinnitust; (c) või vähemalt soft-delete + taasteaken. Vrd teenusekaart-tervikvoo auditi leiuperega (V1–V6): abivahenduse andmete elutsükkel on tundlik pind.

**K3 — fantoom-osaleja pärast ruumist lahkumist (leave route vs service.js:1013, 710–718, 1061–1067).** `leave` paneb `RoomMember.leftAt`'i, aga **ei puuduta `CallParticipant`'i**. Kui lahkuja oli parajasti kõnes: (a) tema osalejarida jääb `leftAt: null` — `participantCount` valetab ja **ta hõivab `maxParticipants` kohta** (join-cap loeb aktiivseid ridu, service.js:1013); (b) ta ise ei saa enam kõnest lahkuda — `requireRoomCallAccess` annab liikmesuse kaotanule 403 (`roomRoutes.js:100–107`) — st rida on *püsivalt* koristamatu tavaradadel; (c) viimase päris-osaleja lahkumisel auto-lõpp ei käivitu (`activeCount` loeb fantoomi sisse) → kõne jääb ACTIVE, kuni keegi õigustatud kasutaja käsitsi `end`'ib; (d) kui käib salvestustaotlus, jääb tema REQUESTED consent-rida readiness'e ette (ptk 4 K2 tupik, aga nüüd tekitab selle *ruumist*, mitte kõnest lahkumine). Parandus peegeldab K1 oma: leave-handler kutsub enne liikmesuse sulgemist `leaveCall`'i kasutaja aktiivsete kõneseansside jaoks (leia `callParticipant.findMany({userId, leftAt: null, callSession: {roomId, status: "ACTIVE"}})`). Sama koristus kuulub tegelikult *igasse* liikmesuse lõppu — kui kunagi tekib „eemalda liige" (kick) endpoint, on tal sama auk sünnist saati.

**K4 — auditivaikus.** Salvestusvoog kirjutab `dataAuditLog` rea igal üleminekul (ptk 5), konto-kustutusel on deletion-job'id — aga terve ruumi + kogu sõnumiajaloo + liikmesuste jäädav hävitamine ei jäta süsteemi **mitte ühtegi jälge** (kes, millal, mis ruumi, mitu sõnumit). Vaidluse („kuhu meie vestlus kadus?") või intsidendi korral pole midagi vaadata. Üks `dataAuditLog.create({action: "ROOM_DELETED", meta: {roomId, title, originType, memberCount, messageCount}})` enne kustutust on viis rida.

**K5 — värava-mismatch (RoomsPage.jsx:90–93 vs route read 69–71).** UI näitab kustutusnuppu ruumirolli järgi (`role === "OWNER" || role === "ADMIN"` — teist väärtust `RoomRole` enum'is ei eksisteeri, surnud haru), server otsustab `Room.ownerId` järgi. Täna langevad OWNER-roll ja ownerId kokku (mõlemad tekivad koos ruumi loomisel), aga need on kaks eri andmevälja ilma ühegi invariandi-valveta — esimene omanikuvahetuse/migratsiooni implementatsioon, mis uuendab üht ja unustab teise, tekitab kas nähtamatu kustutusõiguse või 403-põrkuva nupu. Puhtaim parandus: server juba teab vastust — lisa ptk 15 loendivastusesse `canDelete` lipp ja UI usaldagu ainult seda; surnud `"ADMIN"` haru kustuta.

**K6 — väljumis-UX.** (a) OWNER ei saa lahkuda (õige) ja omanikuvahetust pole — kui omanik tahab ruumist välja, on ta ainus rada kogu ruumi hävitamine kõigi jaoks. MANUAL_INVITE ruumides on see reaalne stsenaarium (kutsuja kaotab huvi, grupp tahab jätkata). Omanikuvahetuse endpoint (OWNER → valitud MODERATOR/MEMBER) on puuduv tükk. (b) Lahkumine on ühe klõpsuga ilma kinnituseta (RoomsPage.jsx:106) — tagasitee on ainult uue kutse kaudu; kustutus sai kinnitusdialoogi, lahkumine vääriks sama. (c) Mõlema toimingu tõrge läheb `console.warn`'i (read 123, 156) — kasutajale ei näidata midagi; spinner lihtsalt kaob ja ruum jääb alles. `setError`-olek on failis olemas (laadimisveaks), taaskasuta.

**K7 — logidrift.** Rida 81 logib toore `err`'i; sama faili õed kasutavad `safeError`'i (ptk 2 K4, ptk 15 teeb õigesti). Ühtlusta.

### 16.4 Kokkuvõte

Mõlemad route'id on kitsalt võetuna korrektsed — väravad õiged, kaskaadid katavad vestlusandmed, idempotentsus olemas. Mõlemad keskmised vead on **elutsüklite ristkoristuse** puudumine: ruumi surm ei koorita kõnet (K1) ja liikmesuse surm ei koorita kõneosalust (K3) — sama juurmuster, mille ptk 4 K2 fikseeris kõnest-lahkumisel salvestuse suunas. Kolmik K1+K3+ptk4-K2 väärib ühte parandust: *liikmesuse/ruumi/kõne lõpp kutsub alati järgmise kihi koristuse* (teenusfunktsioonid on kõik olemas, puudu on ainult sidumised). K2 on tooteotsus, mis tuleb teha enne help-match ruumide päriskasutust: kas üks pool tohib ühise ajaloo hävitada. Ülejäänu (auditijälg, värava-mismatch, omanikuvahetus) on väikesed, aga kõik sama loo — „kustutamine on platvormi kõige järelemõtlematum rada" — peatükid.

---

## 17. `app/api/rooms/[roomId]/members/route.js` — liikmete loend

**Auditeeritud:** 2026-07-16 · 167 rida · ainus meetod `GET`

### 17.1 Roll ja kontekst

Tagastab ruumi aktiivsed liikmed (userId, ruumiroll, kuvanimi) + päise-metaandmed (tiitel, päritolu, isHelpMatch). Kutsuja: ruumivaate liikmete-paneel; `isCurrentUser` lipp arvutatakse serveris.

### 17.2 Mis on korras

- **Auth-kett täielik ja õiges järjekorras:** 400 tühi id → 401 → 403 mitte-liige → 404 olematu ruum → 403 billing; ADMIN-i tellimuspäring skipitakse (rida 117, nagu ptk 15).
- **E-maile ei leki:** nimi tuletatakse `displayName || profiilinimi` ahelaga (rida 163), e-maili fallback'i pole — kitsam ja parem kui kõnede `requesterDisplayName` (mis kukub e-mailile, `roomRoutes.js:195–207`).
- **`leftAt: null` filter** hoiab lahkunud liikmed loendist väljas; `isCurrentUser` serveris tähendab, et klient ei pea oma userId-d teadma.

### 17.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | Kogu handler on ilma try/catch'ita — DB-tõrge murrab `{ok, messageKey}` vealepingu (ptk 3 K1 pere) |
| K2 | Info | `Promise.all([Promise.resolve(room), …])` rudiment — kunagise paralleelpäringu kest |
| K3 | Info | `userId` eksponeeritakse kõigile liikmetele — vajalik (kõne-UI matchib osalejaid userId järgi), aga teadlikuks märkimist väärt |

**K1 — püünisteta GET (read 82–167).** Sama leid kolmandat korda (ptk 3 K1 kõnede-GET, ptk 13 K3 kovisiooni-GET): kõik kirjutavad route'id hoiavad vealepingut, lugevad mitte. Siin on 4 järjestikust Prisma-päringut lageda taeva all. Sama 3-realine parandus.

**K2 — rudiment (read 128–152).** `Promise.all`, mille esimene haru on `Promise.resolve(room)` ja tulemus visatakse `[, members]` destruktureerimisega minema — ilmselgelt jäänuk ajast, mil room-päring jooksis siin paralleelis. Asenda otse `findMany`'ga.

**K3 — userId nähtavus.** Iga liige näeb kaasliikmete püsivaid konto-ID-sid. Ruumikontekstis vajalik (kõneosalejate, sõnavõtusoovide ja `isCurrentUser` matchimine käib userId kaudu) ja liikmed näevad niigi üksteise nimesid — aga kontrastiks kovisioon pseudonümiseerib sama asja `participantId`-dega (ptk 13). Kui ruumidesse tuleb kunagi anonüümsem režiim, on see esimene lekkekoht.

### 17.4 Kokkuvõte

Väike ja korras route; ainus sisuline viga on vealepingu-püünise puudumine (K1), mis on juba kolmanda esinemisega kinnistunud *lugevate route'ide mustriveaks* — väärib ühte läbivat parandusringi (ptk 3 K1 + 13 K3 + siin + ptk 18 K1 korraga, sama 3 rida igasse).

---

## 18. `app/api/rooms/[roomId]/messages/route.js` — sõnumivoog (GET/POST)

**Auditeeritud:** 2026-07-16 · 393 rida · GET (kursor-pagineeritud ajalugu) + POST (saatmine; privaatsusvärav, U10 kokkuvõtte jagamine, rate-limit, SSE-publish) · kutsujad: `useRoomMessages.js` (polling + saatmine), `MeetingSummaryRoomShare.jsx` (U10)

### 18.1 Roll ja kontekst

Ruumi tuumtoiming. GET tagastab lehe sõnumeid (max 50) stabiilse liitkursoriga; POST saadab kas vaba teksti või U10-rajal spetsialisti kinnitatud kohtumise kokkuvõtte (`summaryArtifactId`), laseb sisu läbi privaatsusdetektori (409-kinnitusvoog), tarbib rate-limiti ja publitseerib SSE-sse.

### 18.2 Mis on korras

- **Kursor-pagineerimine on õigesti ehitatud:** liitjärjestus `(createdAt desc, id desc)` + kursoriks `(ts, id)` paar + `take: limit+1` hasMore-tuvastus (read 158–174, 214–257) — sama-ajatempliga sõnumid ei dubleeru ega kao; `limit` on клампitud 1..50 (rida 208). Indeks `@@index([roomId, id])` + `@@index([roomId, createdAt])` toetab.
- **U10-rada on õigesti kihistatud:** `resolveConfirmedMeetingSummaryContent` jõustab omandi (404 võõra artefakti puhul — eristamatu olematust), tüübi, FINAL-staatuse ja rolli (ptk 8) — route lisab ainult liikmesuse/billing'u/rate-limiti, uut õigusmudelit ei teki.
- **Privaatsusvärav on enne talletust:** `evaluateTextPrivacy` + 409 `privacyConfirmationResponsePayload` + `processedText` (võimalik redigeeritud variant) asendab originaali (read 313–321) — isikuandmete kinnitusvoog töötab ruumisõnumitel samamoodi nagu mujal platvormil.
- **Lahkunud liikme nimi säilib ajaloos:** `getMemberDisplayNames` ei filtreeri `leftAt`'i (read 97–112) — vana sõnumi autor ei muutu tagantjärele anonüümseks; ASSISTANT-sõnumid saavad tühja nime (klient lokaliseerib ise).
- **Rate-limiti aken ja määr on env-häälestatavad** (read 19–20); POST on try/catch + `safeError` sees; SSE-publish on isoleeritud try/catch'is (read 382–387) — striimitõrge ei kuku saatmist.

### 18.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | GET on püünisteta (vealepingu-pere) ja teeb topelt-room-päringu — `ensureAccess` luges sama rea äsja |
| K2 | Madal | Sõnumi pikkusel pole ülempiiri — `@db.Text` võtab megabaidid vastu; koos K3-ga tähendab see limiidita CPU+DB tööd |
| K3 | Madal | Rate-limit tarbitakse alles *pärast* kalleimat tööd: privaatsusdetektorid + U10 artefaktipäring jooksevad piiramatult; 409-tsükkel ei tarbi limiiti kunagi |
| K4 | Madal | Rate-limiti võti sisaldab võltsitavat IP-d — `x-forwarded-for` roteerimine annab värskeid ämbreid; userId on võtmes juba olemas, IP ainult *nõrgendab* |
| K5 | Info | Limiter on protsessisisene Map — mitme node'i/restardi puhul limiit nullub (Redis on stack'is olemas, aga kasutamata) |
| K6 | Info | `roomRole` fallback segab kaht sõnavara (`RoomRole` vs platvormi `Role`); POST teeb liigse displayName-päringu, kuigi `access.member` kannab sama rida |

**K1 — püünis + topeltpäring (read 181–281).** GET on neljas vealepingu-pere liige (ptk 3 K1, 13 K3, 17 K1) — ja lisaks loeb ruumi kaks korda: `ensureAccess` teeb `room.findUnique` (read 114–125) ja kohe järgmisena teeb GET oma `room.findUnique` laiema select'iga (read 189–203). Liida: laienda `ensureAccess`'i select'i (title, origin-väljad) ja tagasta room koos access'iga — üks päring vähem igal 5-sekundilisel pollil, iga lahtise ruumitabi kohta.

**K2 — piiramata sisu (read 311, 321, 337).** Ei `rawContent`'il ega `processedText`'il pole pikkusekontrolli; `RoomMessage.content` on `@db.Text`. Liige saab postitada megabaidise sõnumi, mis (a) jookseb täies pikkuses läbi privaatsus-regexite (CPU, vt K3), (b) talletub, (c) broadcast'itakse SSE kaudu igale lahtisele tabile ja (d) tuleb ptk 15 K3 kaudu loendivastustesse tagasi. Deploy-proxy (nginx `client_max_body_size`) on ainus tegelik piir ja see pole rakenduse leping. Platvormi teised sisendid on piiratud; ruumisõnum vääriks sama (nt 8 000 tähemärki, 413/400 üle selle) — kontroll käib *enne* privaatsusevalit, mis lahendab poole K3-st tasuta.

**K3 — limiter vales kohas (read 292–334).** Järjekord on: body-parse → U10 artefaktipäring → privaatsusdetektorid → 409-võimalus → **alles siis** `consumeRateLimit` → talletus. Tähendab: (a) 409-kinnitustsükkel (mis on disainitud korduma!) ei tarbi kunagi limiiti — detektoreid saab põristada piiramatult; (b) U10 DB-päring on samuti väravata; (c) limiit kaitseb ainult kirjutust+broadcast'i, st odavaimat osa. Tõsta `consumeRateLimit` kohe pärast `ensureAccess`'i (enne body-parse'i ei saa — võti ei vaja body'st midagi, seega saab küll: `roomId` ja `userId` on olemas) — siis katab üks värav kogu kalli toru. Koos K2 pikkuspiiriga muutub rada odavaks ka väärkasutuse all.

**K4 — võti nõrgendab iseennast (rida 324; `request-ip.js`).** `roommsg:${roomId}:${userId}:${ip}` — IP tuleb `x-real-ip`/`x-forwarded-for`'ist, mida klient saab ise saata, kui proxy üle ei kirjuta (sama usaldusküsimus, mille ptk 5 K6 fikseeris consent-tõendil). Kuna userId on võtmes nagunii, ei lisa IP midagi — ta ainult *jagab* ühe kasutaja limiidi võltsitavate alamämbrite vahel: roteeri päist, saa 20 sõnumit minutis ämbri kohta. Võta IP võtmest välja (jäta `roomId:userId`) või kasuta IP-d ainult autentimata radadel.

**K5 — limiteri horisont (lib/rate-limit.js).** Protsessisisene Map tähendab: restart nullib, mitu node'i = mitmekordne limiit, ja MAX_BUCKETS=10k ületäitel kustutatakse *suvalisi* ämbreid (insertion-order, read 14–21) — sh äsja täis saanud ründaja oma. Praeguse ühe-VPS-i seadistuse jaoks õige lihtsus; kirja tasub panna, et mitme node'i tulevik vajab Redis-limiteri (klient on `lib/redis.js`-is juba olemas).

**K6 — pisiasjad.** (a) `roomRole: access.member?.role || auth.userRole` (rida 264) — fallback ei käivitu kunagi (`ensureAccess` garanteerib member'i), aga kui käivituks, lekiks platvormiroll (`SOCIAL_WORKER`) `RoomRole` välja kliendile, kes ootab OWNER/MODERATOR/MEMBER sõnavara. Kustuta fallback või normaliseeri teadlikult. (b) POST teeb pärast create'i eraldi `roomMember.findFirst` displayName'i jaoks (read 364–372), kuigi `access.member` (täisrida, `getMembership` on select'ita) kannab sama `displayName`'i — üks päring vähem igalt sõnumilt.

### 18.4 Kokkuvõte

Tuumrada on tugev: pagineerimine on õpiku järgi, U10-kihistus puhas, privaatsusvärav õigel pool talletust ja ajaloo-semantika (lahkunud liikme nimi) läbi mõeldud. Kõik neli madalat on sama teema — **ressursivärav on olemas, aga valesti paigutatud**: piiramata sisu (K2) jookseb läbi väravata detektorite (K3) võltsitava võtme (K4) protsessisisese limiteri (K5) poole. Ükski pole täna ärakasutatav rohkemaks kui ühe node'i koormamine autenditud liikme poolt — aga parandus on kokku ~15 rida (pikkuspiir + limiteri ümbertõstmine + IP võtmest välja) ja sulgeb terve pere korraga.

---

## 19. `calls/start` + `calls/[callSessionId]/mute` + `speak-requests/**` — kõne käivitus, vaigistus, käetõstmine

**Auditeeritud:** 2026-07-16 · 5 route'i (31+37+36+36+43 rida) + service-funktsioonid `startRoomCall` (read 933–969), `setMuted` (1099–1112), `createSpeakRequest`/`cancelSpeakRequest`/`resolveSpeakRequest` (358–389, 1114–1132) — sulgeb kõnede-pere route-kihi auditi (ptk 3–5 + siinsed = kõik 16 calls-route'i kaetud)

### 19.1 Roll ja kontekst

`start` loob ruumi aktiivse kõneseansi (või tagastab olemasoleva) ja teeb alustajast HOST-i; `mute` on enda mikrofonioleku *nõuandev* lipp; speak-requests on käetõstmise kolmik (loo / võta tagasi / moderaator resolvib). Kõik viis järgivad ptk 4 skeletti: `requireRoomCallAccess` → `requireCallInRoom` (kus asjakohane) → service → `loadCallForResponse` → `emitCallEvent`.

### 19.2 Mis on korras

- **Idempotentsus õigetes kohtades:** korduv `start` tagastab olemasoleva aktiivse kõne (rida 934–935); korduv käetõstmine tagastab olemasoleva ACTIVE-soovi (read 359–366); käe tagasivõtt on `updateMany` (võib olla 0 rida, ei viska).
- **Resolve on korralikult väravatatud:** ainult `canModerate` (service viskab `call.forbidden` enne igasugust päringut, rida 1115) ja `requestId` on alati `callSessionId`-skoobitud (read 1116–1122) — võõra kõne soovi ei saa resolvida.
- **Mute on rangelt enda kohta:** `setMuted` otsib osaleja `(callSessionId, userId, leftAt: null)` järgi — moderaator ei saa teisi vaigistada (privaatsuspositiivne vaikeseis) ja lahkunud/võõras osaleja saab 404.
- **`start` järgib create-race'i teadlikkust:** create on try/catch'is, mis konflikti korral loeb aktiivse kõne üle (read 952–956) — kavatsus on õige (vt K1 selle piiridest).
- Kõik viis on try/catch + `statusForCallError` sees; `mute`/`speak-requests` nõuavad `requireCallInRoom`'i — võõra ruumi kõnet ei saa manipuleerida ka body/URL-i kaudu.

### 19.3 Leiud

| # | Raskus | Leid |
|---|--------|------|
| K1 | Madal | `startRoomCall` find-then-create race → kaks ACTIVE kõnet samale ruumile; catch-recheck ei päästa, sest unikaalsuspiirangut pole ja create ei viska |
| K2 | Madal | Kõne sünd on kahesammuline (create → providerRoomName update) ilma transaktsioonita — vahetõrge jätab ACTIVE kõne tühja LiveKit-ruuminimega |
| K3 | Madal | Käetõstmine ei nõua kõnes osalemist ega ACTIVE-staatust — ptk 13 K4 service-augu ruumipoolne kinnitus |
| K4 | Info | `micMuted` on aumärgi-lipp: LiveKit-grant lubab publish'i alati, serveri väli ei jõusta midagi; `body?.micMuted === true` teeb puuduvast/vigasest väljast vaikselt unmute'i (ptk 13 K6 peegel) |
| K5 | Info | Kõik viis emiteerivad täispayload'i surnud fanout'i (ptk 4 K7); `loadCallForResponse` ilma `currentUserId`-ta → `myConsent` null (ptk 3 K3 pere) |

**K1 — kahe aktiivse kõne race (service.js:933–956; schema.prisma:2875–2901).** Kaks liiget vajutavad „Alusta kõne" üheaegselt: mõlemad `findActiveRoomCall` → null → mõlemad `create` → **kaks ACTIVE seanssi samale ruumile**. Koodis olev catch-recheck (read 952–956) töötaks ainult siis, kui teine create *viskaks* — aga `CallSession`'il pole ühtegi unikaalsuspiirangut peale PK (ainult tavaindeksid), seega ei viska kunagi. Tagajärg: `getRoomCall` näitab kõigile uusimat (orderBy startedAt desc), aga varasema loonud kasutaja on *teises* seansis HOST — kaks LiveKit-ruumi, osalejad lõhestatud, teise seansi auto-lõpp ei käivitu kunagi (keegi ei näe teda UI-s, et lahkuda). Sama retsept, mille ptk 4 K3 / 5 K3 juba kirjutasid: osaline unikaalindeks `CREATE UNIQUE INDEX ... ON "CallSession"("roomId") WHERE status = 'ACTIVE' AND "contextType" = 'ROOM'` (raw-migratsioon; kovisioonile sama `contextId` peal) — siis muutub olemasolev catch-recheck päriselt funktsionaalseks.

**K2 — kahesammuline sünd (read 938–961).** `providerRoomName` vajab `call.id`-d, seega luuakse seanss tühja nimega ja uuendatakse järel. Kui update kukub (ühenduskatkestus), jääb ACTIVE kõne, mille `providerRoomName: ""` — `createJoinToken` annab grant'i tühjale ruuminimele ja iga liituja kukub LiveKit-i vastu arusaamatult; kõne ise ripub, kuni keegi `end`'ib. Parandus ilma skeemita: genereeri id ise (`crypto.randomUUID()`/cuid) ja loo kirje ühe insert'iga koos nimega; või pane create+update `$transaction`'i. Haakub K1 indeksiga — sama migratsiooniring.

**K3 — valveta käetõstmine (service.js:358–375; speak-requests/route.js:28).** Kinnitus ruumipoolel sellele, mille ptk 13 K4 kovisioonis fikseeris: `createSpeakRequest` ei kontrolli ei aktiivset osalust (nagu `setMuted` teeb) ega kõne staatust (nagu `joinCall` teeb). Ruumi liige, kes pole kõnega liitunud, saab tõsta kätt — tema nimi ilmub kõneribale soovide nimekirja, kuigi teda kõnes pole (UI kuvab `displayName` + userId-matchi kaudu „võõra" rea); ENDED kõnele saab luua igavesti ACTIVE-ridu (nähtamatu prügi). Parandus on service-tasemel üks: `activeParticipantFor` + `status === "ACTIVE"` kontroll `createSpeakRequest`'i algusse — parandab mõlemad pered korraga.

**K4 — mute on deklaratsioon, mitte mehhanism (providers.js:66–74; service.js:66–75).** LiveKit-grant on kõigil identne (`canPublish: true`, mikrofoniallikas) — vaigistus toimub kliendis track'i peatamisega ja serveri `micMuted` on ainult UI-sünkroniseeritav lipp. See on helikõne puhul mõistlik disain (moderaator-sundvaigistus oleks eraldi feature), aga väärib koodikommentaari, et keegi ei ehitaks `micMuted`'i peale turvaomadust („ta on ju mute'is"). Body-parse'i nüanss on sama, mis ptk 13 K6: iga mitte-`true` väärtus (typo, tühi body) tähendab vaikselt unmute'i — `typeof !== "boolean"` → 400 oleks ausam leping.

**K5 — ristviited.** Kõik viis route'i publitseerivad täis-kõnepayload'i SSE-sse, mida ükski klient ei kuula (ptk 4 K7 — sünk käib 5 s polling'uga), ja kõik kasutavad `loadCallForResponse`'i ilma `currentUserId`-ta, mistõttu `recording.myConsent` on vastustes surnult null (ptk 3 K3/K5 konsolideerimiskandidaat). Uut parandust siin ei lisandu — ainult kinnitus, et muster katab kogu perekonda.

### 19.4 Kokkuvõte

Viimane kõnede-pere viilukas kinnitab pilti: route-kiht on ühtlane ja õigesti skoobitud, aga service-kihi *sünni- ja olekukontrollid* on ebaühtlased — join ja setMuted kontrollivad osalust/staatust, createSpeakRequest ei kontrolli kumbagi (K3), ja kõne enda sünd on ainus create-rada ilma toimiva race-kaitsmeta (K1+K2). Kõik kolm parandust on väikesed ja elavad samas failis; K1 unikaalindeks on sama migratsiooniring, mida ptk 4 K3 (CallParticipant) juba ootab — teha koos. Sellega on kõik 16 `app/api/rooms/**/calls/**` route'i auditeeritud.

---

## 20. Koondvaade: `app/api/rooms/**` — kaetus, pingerida ja läbivad mustrid

**Seisuga 2026-07-16.** Kõik 24 route'i kataloogis `app/api/rooms/**` on auditeeritud (ptk 1–5, 15–19) koos kandva jagatud kihiga (`lib/rooms/*`, `lib/calls/*`, `lib/roomStream.js`, `lib/rate-limit.js` — ptk 8, 9, 11, 12) ja kliendipoolega (ptk 10, 14). Külgnevad pered: invites (ptk 6–7), kovisiooni kõned (ptk 13).

### 20.1 Kaetuskaart

| Route | Ptk |
|---|---|
| `rooms` GET (loend) | 15 |
| `[roomId]` DELETE | 16 |
| `[roomId]/leave` POST | 16 |
| `[roomId]/members` GET | 17 |
| `[roomId]/read` PUT | 1 |
| `[roomId]/messages` GET/POST | 18 |
| `[roomId]/messages/[msgId]` DELETE | 2 |
| `[roomId]/messages/stream` GET (SSE) | 9 |
| `calls` GET | 3 |
| `calls/start`, `calls/join`, `calls/leave`, `calls/end` | 19, 4, 4, 4 |
| `calls/[id]/mute` PATCH | 19 |
| `calls/[id]/speak-requests` POST/DELETE(me)/PATCH(resolve) | 19 |
| `calls/[id]/recording/**` (7 route'i) | 5 |

Ruumi **loomise** endpoint'i ei eksisteeri teadlikult — ruumid sünnivad ainult voogudest (kutse aktsepteerimine, abisobitus, eelpöördumine; `lib/rooms/preInquiryRoom.js` on auditeerimata jääk, kuulub eelpöördumise perre).

### 20.2 Pingerida (keskmised ja kõrgemad, kogu pere peale)

Toodangu-eelse tähtsuse järjekorras:

1. **Salvestuse nõusolekumudel kehtib ainult alustamise, mitte kestmise kohta** — ptk 5 K1 (kolm rada viivad ACTIVE salvestuse lõppolekusse egress'i peatamata), ptk 4 K1 (hiline liituja salvestatakse küsimata), ptk 5 K2 (withdraw puudub UI-st). **Värav: enne `RECORDING_ENABLED=true`.**
2. **Salvestuse failipool toetub kontrollimata eeldustele** — ptk 12 K1–K3, K5 (retention'i ei jõusta miski; tõrkerajad jätavad heli järelevalveta; stabiilsusheuristika võib kärpida ja allika kustutada; kataloogipaar valveta). Sama värav.
3. **Ruumi kustutamine keset kõnet orvustab kõne jäädavalt** — ptk 16 K1 (`SetNull` + suletud API-rajad; käiva salvestusega = punkt 1 ilma kasutajaveata). Paranda koos punktiga 4.
4. **Liikmesuse lõpp ei korista kõneosalust** — ptk 16 K3 (fantoom-osaleja: hõivatud koht, blokeeritud readiness, igavene ACTIVE-kõne) + ptk 4 K2 (lahkuja consent-rida lukustab taotluse).
5. **HELP_MATCH-ruumi ühepoolne häving** — ptk 16 K2 (tooteotsus: kas üks pool tohib ühise ajaloo kustutada).
6. **Kõne elab kliendis vale kihi sees** — ptk 14 K1 (näovahetus katkestab heli vaikselt ja külvab fantoom-osalejaid — sama fantoom, mida punkt 4 serveris koristamata jätab).
7. **Ruumirežiimi visuaalne leping on pooleli** — ptk 14 K2 (`member`-roll, tiitel, kõneriba stiilita) — enne help-match ruumide päriskasutust.

### 20.3 Läbivad mustrid (parandusretseptid)

- **Find-then-create/TOCTOU pere → tingimuslikud kirjutused + osalised unikaalindeksid.** Esinemised: ptk 1 K1 (lastReadAt), 2 K2, 4 K3/K4 (osaleja, topelt-lõpp), 5 K3 (topelt-taotlus/start), 19 K1/K2 (topelt-kõne). Üks migratsiooniring: partial-unique `CallSession(roomId) WHERE ACTIVE`, `CallParticipant(callSessionId, userId) WHERE leftAt IS NULL`, `CallRecordingRequest(callSessionId) WHERE status IN (avatud)` + `updateMany`-üleminekud staatuse-where'iga.
- **Elutsüklite ristkoristus puudub.** Ruum ei lõpeta kõnet (16 K1), liikmesus ei lõpeta osalust (16 K3), kõnest lahkumine ei vabasta consent-rida (4 K2), dokumendi kustutus ei sule failirida (12 K1). Retsept: iga „X lõppes" teenusrada kutsub järgmise kihi koristuse — funktsioonid on olemas, puudu on sidumised.
- **Lugevad route'id on püünisteta** (vealeping `{ok, messageKey}` katkeb 500-l): ptk 3 K1, 13 K3, 17 K1, 18 K1. Üks parandusring, 3 rida igasse; ühes sellega `statusForCallError` fallback'i logimine + maskimine (13 K2).
- **Helper-copy-paste 8+ failis** (ptk 1 K4): `requireUser` (mille catch teeb DB-tõrkest 401 — ptk 1 K5), `hasActiveSubscription`, `json`/`errorJson`, `resolveRoomId`. Kandidaat: `lib/api/roomAuth.js`; kõnede pere näitab, et jagatud kiht (`roomRoutes.js`) töötab.
- **Serveripoolne eestikeelne sisu** i18n-platvormil: süsteemsõnum (4 K5), consent-snapshot (5 K4). Mõlemad vajavad võti+keel lahendust enne RU/EN kasutajaid.
- **Surnud reaalajakiht:** publish ilma kuulajata (4 K7), tühi stub (13 K1), `myConsent`/`providerAvailable` serialiseerimislahknevused (3 K2/K3/K5) — otsusta, kas SSE kannab kõneseisu või mitte, ja koonda serialiseerimine ühte laadijasse.
- **Ressursiväravad valesti paigutatud:** rate-limit pärast kallist tööd + võltsitav IP võtmes + piiramata sisu (18 K2–K4); calls-mutatsioonidel limiiti pole üldse (13 K7).

### 20.4 Auditi käigus lisandunud täiendused varasematele peatükkidele

- **Ptk 5 K1 neljas rada:** ka *positiivne* otsus orvustab egress'i — kui hiline liituja annab ACTIVE salvestuse ajal nõusoleku (API kaudu; UI seda ei paku), muutuvad kõik consent-read CONSENTED-iks ja `updateRecordingReadiness` (service.js:488–493) **demoteerib taotluse ACTIVE → READY_TO_RECORD**: stop nõuab ACTIVE'it (409), auto-stopp ei leia ACTIVE'it, ja `startRecording` on taas avatud — teine egress sama failirea peale (= ptk 5 K3b tagajärg). Parandus on sama, mis K1-l: readiness-recalc ei tohi ACTIVE-staatust puudutada.
- **Ptk 5 pisitäiendus:** `createRecordingRequest` ei piira `purposeText` pikkust (service.js:559) — vabatekst maandub `consentTextSnapshot`'i ja iga osaleja consent-rea snapshot'i piiramatult; sama pikkuspiiri-pere mis ptk 18 K2.
- **Ptk 3/9 kinnitus:** `hasRoomBillingAccess` ei loe `RoomMember.billingSource`/sponsor-välju kunagi otsustamisel (ainult tagastab tõrke-infona) — sponsoreeritud kasutus toimib ainult läbi sponsori loodud `Subscription` rea (ptk 7 ahel). St skeemi sponsor-väljad liikmesusel on informatiivsed, mitte õigusi andvad; kui kunagi tekib „sponsor maksab ruumi, mitte kasutaja tellimuse" mudel, on see funktsioon ainus koht, mida muuta.

### 20.5 Soovitatud parandusjärjekord

1. **Enne `RECORDING_ENABLED=true`** (uinuvad, aga lepingumurdvad): 20.2 punktid 1–2 tervikuna — egress-peatamise rajad, hilise liituja värav, withdraw-UI, retention-purge, kataloogileping.
2. **Elutsükli koristusring** (väike, kohe tehtav): ruumi-DELETE lõpetab kõned; leave koristab osaluse + consent-rea; + auditikirje kustutusele (16 K4).
3. **Race-migratsiooniring:** osalised unikaalindeksid + tingimuslikud üleminekud (üks migratsioon + ~6 väikest service-muudatust).
4. **Vealepingu- ja väravaring:** GET-püünised, limiteri ümberpaigutus + pikkuspiirid, IP võtmest välja.
5. **Tooteotsused** (vajavad omanikku, mitte koodi): HELP_MATCH-kustutus (16 K2), billing-kadumise UX (15 K2), omanikuvahetus (16 K6), moderatsioonifilosoofia ühtlustus (3 K6b), SSE vs polling (4 K7).

---

STATUS: COMPLETE
