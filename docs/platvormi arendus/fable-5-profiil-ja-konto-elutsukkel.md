# Profiil ja konto elutsükkel — tervikanalüüs

**Kuupäev:** 2026-07-16
**Analüüsi teostaja:** Claude (Fable 5)
**Iseloom:** piiritletud analüüs. Rakenduskoodi, Prisma skeemi ega migratsioone EI muudetud; commit'e, merge'e, push'e ega deploy'd EI tehtud.
**Tõeallikas:** aktiivne `origin/main` @ `2a63fcd0` (lokaalne `main` @ `890124bd` on 4 commit'i taga; kõik neli on RAG-P8.0 inventuur/audit — profiilipinda ei puuduta). Profiili põhifailide viimased sisulised muudatused: `app/api/profile/route.js` @ `cb914cee` (11.07), `components/profile/UsageOverview.jsx` @ `cb914cee` (11.07), `app/api/my-sharings/route.js` @ `c21883b2` (14.07), `lib/mySharings.js` @ `2d889a81` (14.07). Töötööpuu määrdunud failid (carousel/panel CSS, RV-komponendid) ei puuduta profiili- ega kontopinda.

## Skoop

Fookuses: `/profiil`, `app/profiil/page.js`, `components/alalehed/ProfiilBody.jsx`, `app/api/profile/route.js`, `app/api/profile/logout-all/route.js`, profiililt avanevad tundlikud konto- ja sessioonitoimingud (`/uuenda-pin`, `/uuenda-epost`, konto kustutamine), `components/profile/UsageOverview.jsx` + `app/api/me/usage/route.js`, `/api/my-sharings` + `components/sharings/MySharingsPage.jsx` kasutajateekonna ulatuses, tellimuse tegeliku seisu kuvamine profiilis.

Skoobist väljas: ruumide audit, Teenuseprofiili uus tervikanalüüs, rollivahetaja analüüsi kordamine (vt `fable-5-rollivahetaja-ja-rollipohised-vaated.md`), registreerimise ja paroolitaaste täielik audit, `/hinnastus` ja `/tellimus` tervikaudit, rakenduskoodi/skeemi/migratsioonide muutmine. Konto kustutamise pöördumis- ja teisele osapoolele kuuluvate andmete detailne käitumine on juba lahendatud dokumendis `fable-5-teekond-o-tk9-sent-retention-otsus.md` — siin viidatakse sellele, mitte ei korrata.

---

## 1. Kokkuvõte (TL;DR)

1. **Profiili lugemispool on IDOR-kindel ja fail-closed.** Iga marsruut (`GET/PUT/DELETE /api/profile`, `/api/me/usage`, `/api/my-sharings`, `/api/profile/logout-all`) nõuab `getServerSession`-i ja seob KÕIK päringud `session.user.id`-ga; kasutaja ei saa kunagi anda võõrast id-d. Rolli profiililt muuta ei saa. `view-role` on `isAdmin`-väravaga.
2. **„Logi kõikjalt välja" töötab päriselt ja lõpetab ka praeguse sessiooni.** `sessionVersion++` mitmestab kõik JWT-d (sh oma), lisaks kustutatakse transaktsioonis kõik `Session`-, `TrustedDevice`-, `LoginTempToken`- ja `EmailOtpCode`-kirjed ning nullitakse seadmeküpsis. See on üks dokumendi tugevamaid kohti.
3. **Kõige tähtsam leid — PROF‑P1: e-posti muutmine EI kontrolli serveripoolel PIN-i.** `PUT /api/profile` seab uuesti-autentimise nõude (`mustCheckCurrent`) ainult PIN-i muutmise harus; **e-posti-only muudatus vahetab login-identiteedi ilma ühegi PIN-kontrollita** ([route.js:278-326](../../app/api/profile/route.js)). UI kogub PIN-i, aga server viskab selle ära. Koos paroolitaaste-vooga annab see täisülevõtuahela olemasoleva sessiooni pealt. Lisaks pole üheski profiili-mutatsioonis brute-force'i piirangut.
4. **Konto kustutamine on hoolikalt ehitatud:** suspendeeri-kohe muster (`accessSuspendedAt` + `sessionVersion++` + sessioonide kustutus ühes transaktsioonis) enne pikka privaatsuskoristust, `DataDeletionJob` + `DataAuditLog` auditijälg, osalise ebaõnnestumise korral `202 pending` ja korduskatse. Andmevoog kaardistatud ptk 7-s; pöördumiste/teise osapoole saatus → vt O‑TK9.
5. **Kuvamine on kasutajasõbralik ja lekketa:** kasutusmõõdikud on inimloetavad (baidid→MB, sekundid→minutid), sisemine `RAG_SEARCH` peidetud, arveldusallikas sõnastatud (Sisemine/Sponsoreeritud/Tasuta/hind), ET/EN/RU on **täielikus pariteedis** (204 profiili+jagamiste võtit igas keeles). Peamised puudused on modaalide fookushaldus (P2) ja aegunud tellimuse eristamatus (P3).

---

## 2. Praeguse profiiliteekonna kaart

```
/profiil (app/profiil/page.js → ProfiilBody.jsx)
│  SSR: tuvastab mobiili (user-agent/sec-ch-ua-mobile), annab initialIsMobileProfileMenu
│  Klient: useSession() → kui unauthenticated → LoginModal
│  Andmed: GET /api/profile (no-store) → { email, role, effectiveRole, adminViewRole,
│          isAdmin, isRoleViewActive, hasPassword, activeSessionLimit,
│          trustedDeviceLimit, trustedDevices[] }
│
├─ Vaikevaade (menüü)
│   ├─ Teema/kontrast (klient, a11y-eelistus — server ei puutu)
│   ├─ „Muuda PIN"        → /uuenda-pin  (UuendaPinBody → PUT /api/profile {password,currentPassword})
│   ├─ „Muuda e-post"     → /uuenda-epost (UuendaEpostiBody → PUT /api/profile {email,currentPassword})
│   ├─ „Konto seaded"     → modaal: Logi välja / Logi kõikjalt välja / Kustuta konto
│   ├─ „Kasutus"          → modaal: UsageOverview (GET /api/me/usage)
│   ├─ „Minu jagamised"   → /minu-jagamised (MySharingsPage → GET /api/my-sharings)
│   ├─ „Halda tellimust"  → /tellimus  (skoobist väljas)
│   └─ „Eelistused"       → a11y-modaal (AccessibilityProvider)
│
├─ ?sektsioon=konto  → ainult kontotoimingud (karusselli „Konto seaded" kaardilt)
│   ├─ Logi välja           → signOut()
│   ├─ Logi kõikjalt välja  → POST /api/profile/logout-all → signOut()
│   └─ Kustuta konto        → ModalConfirm(PIN) → DELETE /api/profile → signOut()+redirect
│
└─ ?sektsioon=kasutus → UsageOverview täislehena
```

Manustatud režiim: needsamad moodulid avanevad ka Töölaua paneeli seest (`embedded`), kuid tundlikud kontotoimingud (kustutus, logout-all) käivad alati sama API vastu — teekonna kaks sisenemist (täisleht vs manustatud) jõuavad samasse serverikihti.

---

## 3. Rolli- ja õiguste maatriks (küsimused 1–2)

### 3.1 Millist profiiliinfot näevad rollid (küsimus 1)

`GET /api/profile` tagastab **kõigile rollidele struktuurselt sama väljakomplekti** ([route.js:211-232](../../app/api/profile/route.js)) — profiiliinfo ei ole rollipõhiselt filtreeritud, sest see on alati kasutaja ENDA info:

| Väli | CLIENT | SOCIAL_WORKER | SERVICE_PROVIDER | Admin |
|---|---|---|---|---|
| `email`, `hasPassword` | ✅ enda | ✅ enda | ✅ enda | ✅ enda |
| `role` (tegelik konto roll) | CLIENT | SOCIAL_WORKER | SERVICE_PROVIDER | ADMIN |
| `effectiveRole` / `adminViewRole` / `isRoleViewActive` | = role / null / false | = role / null / false | = role / null / false | **vaateküpsisest** (S/P/T) |
| `isAdmin` | false | false | false | true |
| `activeSessionLimit` / `trustedDeviceLimit` | tava (vaikimisi 3/3) | tava | tava | **kõrgem** (admin 5/5, [pin-login.js:14-24](../../lib/auth/pin-login.js)) |
| `trustedDevices[]` (nimi, `ipRange` /24, ajatemplid, `isCurrentDevice`) | ✅ enda seadmed | ✅ | ✅ | ✅ |

UI-s (`ProfiilBody`) kuvatakse tegelikkust ainult **lühike rollisilt** (`roleLabel`) ja e-post; ülejäänud väljad juhivad menüüd ja piire. Kolm mitte-admin rolli näevad identset profiili­struktuuri; erineb ainult rollisildi tekst ja allavoolu paketi-/kvoodikuvamine. Admin näeb lisaks kõrgemaid seadme-/sessioonipiire.

### 3.2 Kas kuvatav roll, tegelik roll, `isAdmin` ja eelvaateroll on ausalt eristatud? (küsimus 2)

**Osaliselt.** API tasandil on eristus olemas ja korrektne (`role` vs `effectiveRole` vs `adminViewRole` vs `isAdmin`). Aga **profiili UI kuvab ainult tegeliku konto rolli** ([ProfiilBody.jsx:153-157](../../components/alalehed/ProfiilBody.jsx): `actualRole = normalizeProfileRole(profileUser?.role || …)` → `roleLabel`, render rida 522). Tagajärjed:

- **Aus:** admin näeb profiilil sildi „Admin", mitte eelvaaterolli — profiil ei valeta tegeliku rolli kohta. Mitte-adminil `effectiveRole === role`, seega ühtegi ebakõla pole.
- **Puudujääk (P3):** kui admin on aktiveerinud S/P/T eelvaate, siis **profiil ei näita seda kuidagi** — ei „vaatad praegu pöörduja vaates", ei effectiveRole'i. Mujal rakenduses eelvaade sisu muudab, profiil aga mitte. Admin ei saa profiililt aru, kas eelvaade on aktiivne. See on läbipaistvusnõrkus, mitte turvaauk (õigusi eelvaade ei muuda — vt rollivahetaja fail-closed leping). Seob tooteotsusega **TO‑P3**.

Rollivahetaja mehaanikat ennast siin ei korrata — vt `fable-5-rollivahetaja-ja-rollipohised-vaated.md`. Kinnitus skoobi piires: profiili GET kannab `resolveSessionRoleState` väljundi ([route.js:207-219](../../app/api/profile/route.js)) muutumatult UI-le tagasi ja **ei tee ühtegi õigusotsust** vaaterolli põhjal — see on ainuüksi kuvakiht.

---

## 4. Kontoandmete muutmine ja sessioonide elutsükkel (küsimused 3–5)

### 4.1 Muudetavad väljad ja serveriväravad (küsimus 3)

| Väli | Marsruut | Serveriväravad | Sessioonimõju |
|---|---|---|---|
| E-post | `PUT /api/profile` | sessioon + `@`-kontroll + unikaalsus (`P2002`/eelkontroll) + `emailVerified=null` + verifitseerimiskiri uuele aadressile. **PIN-i EI kontrollita** (PROF‑P1) | `sessionVersion++` → kõik sessioonid välja |
| PIN | `PUT /api/profile` | sessioon + `isValidPin` (4–8 numbrit) + **`currentPassword` kontroll kui `passwordHash` olemas** + `bcrypt(12)` | `sessionVersion++` → kõik sessioonid välja |
| Konto kustutus | `DELETE /api/profile` | sessioon + **`currentPassword` kontroll kui `passwordHash` olemas** | suspend + `sessionVersion++` + sessioonid kustutatud |
| Roll | — | **ei ole profiililt muudetav** (server-kontrollitud) | — |
| Teema/kontrast | klient (`AccessibilityProvider`) | pole vaja | — |
| Keel | `NEXT_LOCALE` küpsis ([proxy.js:59](../../proxy.js)) | pole tundlik | — |
| Vaateroll (admin) | `PUT /api/profile/view-role` | `isAdmin` (403 muidu) + `normalizeAdminViewRole` | ainult küpsis |

### 4.2 Kas tundlike andmete muutmine nõuab piisavat uuesti-autentimist, teavitust ja sessioonide tühistamist? (küsimus 4)

| Toiming | Uuesti-autentimine | Teavitus | Sessioonide tühistus |
|---|---|---|---|
| **PIN-i muutmine** | ✅ server kontrollib `currentPassword` (kui hash olemas) | ❌ vana ega uut aadressi ei teavitata PIN-i vahetusest | ✅ `sessionVersion++` |
| **E-posti muutmine** | ❌ **server ei kontrolli PIN-i** (PROF‑P1) — UI kogub, server ignoreerib | ⚠️ kiri **ainult uuele** aadressile; **vana aadressi ei hoiatata** | ✅ `sessionVersion++` |
| **Konto kustutus** | ✅ server kontrollib `currentPassword` (kui hash olemas) | ✅ „konto kustutatud" kiri | ✅ suspend + kustutus |
| **Logi kõikjalt** | ⚠️ ei nõua PIN-i (aga toiming on ohutu — ainult väljalogimine) | — | ✅ täielik |

Puudused: (a) e-posti muutmise serveripoolne uuesti-autentimine puudub täielikult (PROF‑P1); (b) ei e-posti ega PIN-i muutmisel ei saadeta turvasündmuse teavitust **vanale** aadressile — standardne ülevõtu-hoiatus puudub (kuulub tooteotsuse **TO‑P2** alla); (c) ükski mutatsioon pole brute-force'i-piiratud (PROF‑P1).

### 4.3 Kas „logi kõikjalt välja" lõpetab päriselt kõik sessioonid, sh praeguse? (küsimus 5)

**Jah — täielikult ja tõendatavalt koodist.** [logout-all/route.js:67-114](../../app/api/profile/logout-all/route.js) teeb ühes `$transaction`-is:

```
user.sessionVersion += 1            // → JWT-d ei valideeru enam (auth.js:310-312 SESSION_REVOKED)
trustedDevice.deleteMany(userId)    // usaldusseadmed maha
session.deleteMany(userId)          // kõik DB-sessioonid, sh praegune
loginTempToken.deleteMany(userId)   // pooleliolevad login-tokenid
emailOtpCode.deleteMany(userId)     // OTP-koodid
```
seejärel nullitakse `DEVICE_COOKIE` (`maxAge:0`) ja klient kutsub `signOut`. **Praegune sessioon ei ole erand:** `sessionVersion` mismatch tabab ka kutsuja enda JWT-d järgmisel valideerimisel ([auth.js:310-312](../../auth.js)), ja tema `Session`-rida on kustutatud. See on korralik, täielik ja idempotentne lahendus.

---

## 5. Tellimuse ja kasutusmahtude kuvamise hinnang (küsimused 6–7)

### 5.1 Kuidas kuvatakse tellimuse eri seisud (küsimus 6)

`UsageOverview` ([UsageOverview.jsx:109-141](../../components/profile/UsageOverview.jsx)) + `usageSnapshotService` ([snapshot.js:171-213](../../lib/usage/snapshot.js)):

| Seis | Kuidas kuvatakse | Allikas |
|---|---|---|
| **Aktiivne (tasuline)** | plaani nimi + `{hind} / kuu` + „Järgmine arveldus {kuupäev}" (`nextBilling`) | `activeSubscription` (validUntil > now) |
| **Ligipääs kuni** (tühistatud, veel kehtiv) | „Ligipääs kuni {kuupäev}" (`validUntil`, kui `nextBilling` puudub) | sama |
| **Sponsoreeritud** | „Sponsoreeritud" (hinna asemel) | `billingSource === "SPONSORED_BY_HOST"` |
| **Tasuta / puuduv** | „Tasuta" + `free_description`, tühjad mõõdikud | `status NONE` / `plan free` |
| **Admin (sisemine)** | „Sisemine", halda-nuppu ei kuvata | `plan.key === "admin_internal"` |
| **⚠️ Aegunud** | **eristamatu** — langeb vaikselt tagasi `latestSubscription`-ile või tasuta plaanile; puudub selge „tellimus aegus {kuupäev}" | `activeSubscription===null` → `latestSubscription` |

**Puudus (P3):** möödunud `validUntil`-iga (aegunud) tellimusel puudub eristuv seis — kasutaja ei näe selgelt, et tellimus lõppes. `access_until` katab ainult tulevikus kehtivat aknalõppu. Seob tooteotsusega **TO‑P4**.

### 5.2 Kas mahud, piirid ja arveldusallikas on arusaadavad ega leki sisemisi väärtusi? (küsimus 7)

**Jah — hea lahendus.** [UsageOverview.jsx:7,19-51](../../components/profile/UsageOverview.jsx):
- Sisemine mõõdik `RAG_SEARCH` on **peidetud** (`HIDDEN_METRICS`).
- Toorbaidid → `B/KB/MB/GB/TB`; STT sekundid → minutid; TTS märgid → lokaliseeritud „märki"; loendid `Intl.NumberFormat`-iga.
- Piirid kuvatakse „kasutatud X / Y" kujul (kasutaja enda kvoot — ei ole sisemine saladus); protsent + seis (`normal/notice/warning/blocked`) lokaliseeritud märkusega.
- Arveldusallikas sõnastatud (Sisemine/Sponsoreeritud/Tasuta/hind), **mitte toor-`billingSource`**.
- `overridden` (admini käsitsi override'i olemasolu) on API-vastuses, aga **UI-s ei kuvata** — ei leki visuaalselt.

Sisemiste tehniliste väärtuste leket kasutajale ei leitud. `me/usage` tagastab `debug`-välja ainult siis, kui `NODE_ENV !== "production"` ([me/usage/route.js:42-47](../../app/api/me/usage/route.js)) — tootmises ohutu; kinnitada, et prod-keskkond seab `NODE_ENV=production`.

---

## 6. „Minu jagamised" profiililt (küsimus 8)

**Leitav ja arusaadav.** Profiilimenüü „Minu jagamised" → `/minu-jagamised` ([ProfiilBody.jsx:314-316](../../components/alalehed/ProfiilBody.jsx)). `MySharingsPage` grupeerib viide sektsiooni ja teeb tagasivõetavuse kasutajale selgeks `OwnershipBar`-i kaudu (nähtavus / päritolu / kehtivus):

| Sektsioon | Saab tagasi võtta? | Serveritõde |
|---|---|---|
| Eelpöördumised | **Tühista** (kui `canRecall`) / **Paranda** (kui `canCorrect`) — ainult INTERNAL, avamata, tühistamata | [mySharings.js:37-52](../../lib/mySharings.js) |
| EXTERNAL_EMAIL pöördumine | **Ei** — märgitud „external_final" (kiri on platvormilt lahkunud) | [MySharingsPage.jsx:227](../../components/sharings/MySharingsPage.jsx) |
| Ruumid | **Lahku** (kui mitte-omanik) | `canLeave = role !== "OWNER"` |
| Kutsed | **Tühista** (kui omanik/moderaator) | [mySharings.js:239-244](../../lib/mySharings.js) |
| Abikuulutused | vaade (ei kutsu tagasivõttu selles vaates) | — |
| Raamistiku-nõusolekud | vaade (ajalooline kirje) | — |

Mida saab ja ei saa tagasi võtta on `canRecall`/`canCorrect`/`canRevoke`/`canLeave` lippudega **serveripoolel** arvutatud, mitte kliendi otsustada. „Mälu" märkus (`notice.memory`) selgitab, et vastuvõtja võis sisu juba näha. See on ühtlane ja aus. **Andmete saatus konto kustutamisel** (SENT-pöördumised, vastuvõtja märkmed) → vt O‑TK9 (leiud L4/P1 ja L5/P2), siin ei korrata.

---

## 7. Konto kustutamise andmevoog (küsimus 9)

`DELETE /api/profile` → `deleteUserWithPrivacyCleanup` ([userDeletion.js:179-294](../../lib/privacy/userDeletion.js)). Kaks faasi:

**Faas 1 — kohene lukustus (transaktsioon, [userDeletion.js:203-225](../../lib/privacy/userDeletion.js)):**
```
DataDeletionJob(action=USER_DELETE, status=PENDING) loodud
user.accessSuspendedAt = now; accessSuspendedReason = "deletion_pending:…"; sessionVersion++
session.deleteMany(userId)          // kohe välja logitud kõikjalt
```
→ Isegi kui faas 2 pooleli jääb, on konto juba ligipääsmatu (suspend + JWT revoke).

**Faas 2 — privaatsuskoristus ([userDeletion.js:68-138](../../lib/privacy/userDeletion.js) + orkestraator):**

| Andmeliik | Käitumine | Alus |
|---|---|---|
| Dokumendid (`UserDocument`) | RAG-viide kustutatud + failihoidla fail kustutatud + DB kaskaad | `ownerId … Cascade` (schema:1701) |
| Materjaliesitused | failihoidla fail kustutatud + DB | `submittedByUserId` |
| Agendi-artefaktid | `ARTIFACT_DB_DELETE` kirje (SKIPPED, „database_cascade_only") + DB kaskaad | `ownerId … Cascade` |
| Vestluslogid | `chatLog.deleteMany(userId)` | eksplitsiitne |
| Verifitseerimistokenid | `deleteMany` (e-post + `email-verify:` prefiks) | eksplitsiitne |
| Tõhusa praktika kandidaadid | `scrubOrDeleteEffectivePractices` (autor → SetNull/scrub) | `author … SetNull` (schema:2365) |
| Sessioonid, seadmed, OTP, temp-tokenid, tellimused, maksed, kasutusämbrid, ruumiliikmesused, omatud ruumid+sõnumid, saadetud kutsed, topic-seed'id, kovisioonijuhtumid, abikuulutused, RAG-dokumendid | **skeemikaskaad** `onDelete: Cascade` (171 relatsiooni skeemis) | `prisma/schema.prisma` |
| Sponsorviited (`sponsorUser`, `sponsoredBy`, `acceptedBy`, `recipientOwner`) | **SetNull** — teise osapoole kirje jääb, viide nullitakse | schema:25, 1892 jt |
| **Pöördumised (`PreInquiry.author`)** | **Cascade** — hävib kõik, sh vastuvõtjale kohale toimetatud SENT | schema:1891 → **vt O‑TK9 L4/P1** |
| Vastuvõtja töömärkmed autori kirjel | orvuks jäävad / hävivad koos autori reaga | **vt O‑TK9 L5/P2** |

**Kinnitus (`ModalConfirm`):** eraldi PIN-sisend + `delete_confirm` sõnum + `deleting`-olek; edu korral klient `signOut` + `window.location.href` ümbersuunamine ([ProfiilBody.jsx:653-723](../../components/alalehed/ProfiilBody.jsx)).

**Audit:** `DataAuditLog` (`USER_DELETE_SELF` → `USER_DELETE_DONE` või `USER_DELETE_PENDING`) + `DataDeletionJob` (`PENDING`→`DONE`/`FAILED`), IP+UA logitud. Osalisel ebaõnnestumisel `202` + `deletionJobId` + korduskatse (`retryUserPrivacyDeletion`).

**Puudus (P3):** klient käsitleb iga `res.ok`-i (200 JA 202) edu­na ja logib välja ([ProfiilBody.jsx:674-690](../../components/alalehed/ProfiilBody.jsx)) — **`202 pending` seisu kasutajale ei kommunikeerita**. Konto on suspenditud (õige), aga kasutaja ei tea, et osa andmete koristus on veel järjekorras.

---

## 8. Turvariskid — profiil (küsimus 10)

| Vektor | Seis | Tõend |
|---|---|---|
| **IDOR** | ✅ kaitstud — kõik lugemised seotud `session.user.id`-ga, kasutaja-antud id-d ei loeta | [route.js:169](../../app/api/profile/route.js), [me/usage:37](../../app/api/me/usage/route.js), [my-sharings:14-18](../../app/api/my-sharings/route.js), [mySharings.js:101-107](../../lib/mySharings.js) |
| **Rollitõus** | ✅ roll pole profiililt muudetav; `view-role` `isAdmin`-väravaga; vaateroll ei anna õigusi | [view-role:80-82](../../app/api/profile/view-role/route.js) |
| **CSRF** | ✅ piisav — next-auth sessiooniküpsis on vaikimisi `sameSite=lax` + `httpOnly`; PUT/DELETE/POST ei kanna küpsist üle domeeni. ⚠️ eksplitsiitne CSRF-token/Origin-kontroll puudub (kaitse toetub `sameSite`-ile) | `auth.js` (kohandatud küpsisekonfiguratsiooni pole → next-auth vaikeväärtus) |
| **Brute-force** | ❌ **PUUDUB piirang** `PUT`/`DELETE` PIN-kontrollil (`bcrypt.compare`) — login-marsruudid on `consumeRateLimit`-iga, profiil mitte | [route.js:320,409](../../app/api/profile/route.js); vrd [auth/login-step1:194](../../app/api/auth/login-step1/route.js) |
| **Toore veateate leke** | ✅ `safeError` + tõlgitud `messageKey`-d; prod-is `debug` puudub | route.js läbivalt |
| **Privaatandmete leke** | ✅ ainult enda andmed (sh oma seadmete `ipRange` /24); võõraid ei paljastu | [route.js:223-231](../../app/api/profile/route.js) |

**Ülevõtuahel (PROF‑P1 tagajärg):** olemasoleva sessiooni pealt → `PUT /api/profile {email:"ründaja@x"}` (PIN-i ei küsita) → login-identiteet vahetub → paroolitaaste ([auth/password/reset](../../app/api/auth/password/reset/route.js)) saadab lähtestuse ründaja aadressile → uus PIN → **täisülevõtt, algset PIN-i teadmata**. Eeltingimus on aktiivne sessioon (laenatud/lukustamata seade, leaked-sessioon või XSS), mistõttu raskus on **P1**, mitte P0 — aga see on dokumendi kõige olulisem parandus.

---

## 9. Ligipääsetavus ja keeleline pariteet (küsimus 11)

| Aspekt | Seis | Märkus |
|---|---|---|
| **ET/EN/RU sisupariteet** | ✅ **täielik** — 204 `profile.*` + `my_sharings.*` võtit igas kolmes keeles, puuduvaid võtmeid 0 | kontrollitud skriptiga; ka `usage.internal/sponsored/free` olemas |
| **Klaviatuur** | ✅ menüü on `<button>`-id; vormidel `<label>` (sr-only); PIN-sisendil `aria-describedby` veale | ProfiilBody, UuendaPin/Epost |
| **Ekraanilugeja** | ✅ enamjaolt — `role="dialog" aria-modal`, `role="alert"` vigadel, `role="progressbar"` mõõdikutel, `aria-busy` | UsageOverview, Modal |
| **Fookushaldus (modaalid)** | ❌ **P2** — `Modal` ei liiguta fookust dialoogi sisse avamisel, **ei loksusta (trap) ega taasta** fookust sulgemisel; tavaline `Modal` (Kasutus/Konto seaded) ei püüa Esc-i (ainult `ModalConfirm` lisab Esc) | [Modal.jsx:24-32](../../components/ui/Modal.jsx) |
| **Mobiil** | ✅ `detectMobileProfileMenu` + SSR-deterministlik esmarender, reconcile mountimisel (väldib hüdratsioonikonflikti) | [ProfiilBody.jsx:27-36,116-139](../../components/alalehed/ProfiilBody.jsx) |
| **200% tekst / reflow** | ⚠️ **vajab visuaalset kontrolli** — JSX-is fikseeritud kõrgusi ei nähtud, kuid CSS-i (workspace/panel) ei auditeeritud selle skoobis; ei saa staatiliselt kinnitada | — |

Fookushalduse puudus tähendab, et klaviatuuri-/ekraanilugejakasutaja saab modaali taustale välja liikuda (WCAG 2.4.3 fookusjärjekord). Klaviatuurilõksu (2.1.2) rikkumist ei ole — probleem on vastupidine (fookus ei püsi dialoogis).

---

## 10. Head lahendused

1. **`logout-all` on eeskujulik** — `sessionVersion++` + neli `deleteMany`-t transaktsioonis + küpsise null; lõpetab tõendatavalt ka praeguse sessiooni.
2. **Suspendeeri-enne-koristust kustutusmuster** — konto muutub ligipääsmatuks kohe, enne pikka privaatsuskoristust; osaline tõrge ei jäta „pooleldi elavat" kontot.
3. **Terviklik privaatsuskoristus + auditijälg** — RAG-viited, failid, artefaktid, chatlog'id, tokenid, tõhusad praktikad; `DataDeletionJob` + `DataAuditLog` + korduskatse.
4. **IDOR-kindlus läbivalt** — iga profiili-/kasutuse-/jagamiste-päring on `session.user.id`-ga seotud.
5. **Kasutuskuvamise lekketa disain** — sisemine `RAG_SEARCH` peidetud, toorväärtused inimloetavaks teisendatud, arveldusallikas sõnastatud.
6. **ET/EN/RU täielik pariteet** (204 võtit) — haruldaselt puhas kolmekeelne kate.
7. **PIN-i muutmine ja kustutus nõuavad serveripoolset uuesti-autentimist** (`currentPassword` kontroll) — õige muster, mida e-posti muutmine paraku ei järgi.

---

## 11. Leiud (P0–P3, täpse failirea tõendiga)

### PROF‑P1 — E-posti muutmine ei nõua serveripoolel uuesti-autentimist + brute-force'i piirang puudub  · **P1**
- **Tõend:** [app/api/profile/route.js:278-296](../../app/api/profile/route.js) (e-posti haru seab ainult `requiresReauth=true`, MITTE `mustCheckCurrent`), vrd [route.js:298-311](../../app/api/profile/route.js) (PIN-i haru seab `mustCheckCurrent`), kontroll [route.js:313-326](../../app/api/profile/route.js). Kliendi `UuendaEpostiBody` kogub PIN-i ([UuendaEpostiBody.jsx:99-108](../../components/alalehed/UuendaEpostiBody.jsx)), aga server ignoreerib seda e-posti-only muudatusel. Rate-limit puudub kogu failis (võrdle `consumeRateLimit` login-marsruutides).
- **Mõju:** login-identiteedi (e-posti) vahetus ilma PIN-ita olemasoleva sessiooni pealt → koos paroolitaastega täisülevõtuahel; PIN on 4–8 numbrit ja kustutus/e-post pole brute-force'i-piiratud.
- **Eeltingimus:** aktiivne autenditud sessioon.

### PROF‑P2 — Modaalidel puudub fookuslõks ja fookuse taastamine  · **P2**
- **Tõend:** [components/ui/Modal.jsx:24-32](../../components/ui/Modal.jsx) — `role="dialog" aria-modal="true"`, kuid fookust ei liigutata dialoogi, ei lõksustata ega taastata; tavaline `Modal` (Kasutus, Konto seaded) ei püüa Esc-i.
- **Mõju:** klaviatuuri-/ekraanilugejakasutaja triivib modaali taustale; WCAG 2.4.3.

### PROF‑P2 — E-posti/PIN-i muutmisel puudub turvateavitus vanale aadressile  · **P2**
- **Tõend:** [route.js:354-360](../../app/api/profile/route.js) saadab kirja ainult UUELE aadressile; vana aadressi ei teavitata; PIN-i muutmisel ei saadeta kirja üldse. (Kustutamisel `sendAccountDeletedEmail` on olemas — [route.js:425-431](../../app/api/profile/route.js).)
- **Mõju:** ülevõtu vaikne toimumine; standardne hoiatuskiri puudub. Seob TO‑P2.

### PROF‑P3 — Aegunud tellimusel puudub eristuv kuvaseis  · **P3**
- **Tõend:** [snapshot.js:171-213](../../lib/usage/snapshot.js) langeb aegunud `validUntil` korral vaikselt `latestSubscription`/tasuta plaanile; [UsageOverview.jsx:123-141](../../components/profile/UsageOverview.jsx) `access_until` katab ainult tuleviku-akna.
- **Mõju:** kasutaja ei näe selgelt „tellimus aegus {kuupäev}". Seob TO‑P4.

### PROF‑P3 — `202 pending` kustutusseisu ei kommunikeerita kasutajale  · **P3**
- **Tõend:** [ProfiilBody.jsx:674-690](../../components/alalehed/ProfiilBody.jsx) käsitleb 200 ja 202 identselt (`res.ok`) ja logib välja; `pending`/`deletionJobId` jäetakse kasutamata.
- **Mõju:** kasutaja arvab, et kustutus on lõplik, kuigi koristus on järjekorras (konto on siiski suspenditud).

### PROF‑P3 — Paroolita konto möödub kustutuse/PIN-i uuesti-autentimisest  · **P3 (latentne)**
- **Tõend:** [route.js:402](../../app/api/profile/route.js) (`if (current.passwordHash)`) ja [route.js:306](../../app/api/profile/route.js) — kui `passwordHash` puudub, DELETE ei nõua kinnitust ja PUT seab uue PIN-i ilma vana kontrollita.
- **Mõju:** täna latentne — ainus kasutajaloomistee ([register:235](../../app/api/register/route.js)) seab alati `passwordHash`. Kaitseks tasub lisada eksplitsiitne „PIN puudub → nõua muud kinnitust" haru, et seemne-/adminiloodud kontod ei jääks katteta.

### Info — kaks „effective role" resolverit puudutavad ka profiili GET-i
Profiili GET kasutab küpsisepõhist `resolveSessionRoleState`-i (õige kuvakiht). Laiem K1-ebakõla (dokumendi-/materjali-API-d küpsiseta `effectiveRoleFromSession`-iga) on **rollivahetaja dokumendi** teema (K1, RV‑P2) — siin ei korrata.

---

## 12. Töötav / katkine / puuduv / tulevikusoov (küsimus 12)

- **Töötab:** logi-kõikjalt-välja (sh praegune); PIN-i muutmise ja kustutuse serveripoolne uuesti-autentimine; kustutuse andmevoog + audit + korduskatse; kasutuskuvamine lekketa; „Minu jagamised" tagasivõtu-semantika; ET/EN/RU pariteet; IDOR-kindlad lugemised; `view-role` isAdmin-värav.
- **Katkine:** e-posti muutmine ignoreerib serveripoolset PIN-i (PROF‑P1); brute-force'i piirang puudub (PROF‑P1); modaalide fookushaldus (PROF‑P2).
- **Puudub:** turvateavitus vanale aadressile (P2); aegunud tellimuse eristus (P3); `202 pending` kuvamine (P3); admini eelvaaterolli indikaator profiilil (P3); paroolita konto uuesti-autentimise haru (P3).
- **Tulevikusoov:** eksplitsiitne CSRF-token/Origin-kontroll kaitse süvenduseks; effectiveRole/adminViewRole läbipaistev kuvamine adminile profiilil (seob rollivahetaja TO‑2).

---

## 13. Tooteomaniku otsused

- **TO‑P1 — e-posti muutmise mudel:** kas uus e-post tuleb **enne** login-identiteediks saamist ära verifitseerida (verify-then-swap), või jääb praegune swap-then-verify? (Mõjutab lukustusriski ja ülevõtuahelat. Sõltumata valikust tuleb PROF‑P1 serveripoolne PIN-kontroll lisada.)
- **TO‑P2 — turvateavitused:** kas saata hoiatuskiri **vanale** aadressile e-posti muutmisel ja teavitus PIN-i muutmisel?
- **TO‑P3 — admini eelvaate läbipaistvus:** kas profiil peab näitama aktiivset eelvaaterolli (effectiveRole/adminViewRole), või jääb see profiililt nähtamatuks? (Seob rollivahetaja TO‑2.)
- **TO‑P4 — aegunud tellimus:** kas kuvada eristuv „tellimus aegus {kuupäev}" seis vs vaikne tagasilangus tasuta plaanile?

---

## 14. Rakenduspaketid

### PROF‑P1 — Serveripoolne uuesti-autentimine e-posti muutmisel + brute-force'i piirang  *(esimene rakendusvalmis pakett, ei vaja tooteotsust)*

Puhas turvaparandus, ei muuda skeemi ega tootekäitumist (UI juba kogub PIN-i):

1. [app/api/profile/route.js](../../app/api/profile/route.js) — laienda `mustCheckCurrent` loogikat: sea see `true` ka siis, kui `nextEmail && nextEmail !== current.email && current.passwordHash` (praegu ainult PIN-i harus). Nii kontrollitakse e-posti muutmisel sama `currentPassword`-plokk, mis juba eksisteerib (route.js:313-326) — muudatus ~2 rida.
2. [app/api/profile/route.js](../../app/api/profile/route.js) — lisa `consumeRateLimit` (`@/lib/rate-limit`, sama muster kui [auth/login-step1:194-206](../../app/api/auth/login-step1/route.js)) `PUT`-i ja `DELETE`-i `currentPassword`-kontrolli ette: IP + userId võtmega, nt 10 katset / 10 min; ületusel `429 api.common.rate_limited`.
3. Kontroll (lokaalne, sünteetiline kasutaja): (a) `PUT {email}` ilma õige PIN-ita → `401 CURRENT_PASSWORD_INVALID` (enne: 200); (b) `PUT {email}` õige PIN-iga → 200 + `sessionVersion++`; (c) 11. vale katse → `429`; (d) olemasolevad testid (i18n-kontraktid) rohelised.

Hinnanguline maht: ~15–25 rida, 1 fail, 0 migratsiooni, 0 tooteotsust. **Soovitus: teostada esimesena.**

### PROF‑P2 — Modaalide fookushaldus
[components/ui/Modal.jsx](../../components/ui/Modal.jsx) — avamisel liiguta fookus dialoogi (esimene fookustatav / konteiner `tabIndex=-1`), lõksusta Tab dialoogi sisse, taasta fookus avajale sulgemisel, lisa Esc-käsitlus `Modal`-i tasemel (mitte ainult `ModalConfirm`-is). Puudutab profiili Kasutus- ja Konto-seaded-modaale. Ei vaja tooteotsust.

### PROF‑P3 — Kuvamise ja teavituse täpsustused (osaliselt tooteotsuse taga)
Aegunud tellimuse eristav seis (TO‑P4 järel), `202 pending` kustutusseisu kuvamine, turvateavitused vanale aadressile (TO‑P2 järel), paroolita konto uuesti-autentimise haru. Väiketööd, mis grupeeruvad pärast tooteotsuseid.

---

## 15. Runtime-kontrolli teostatavus ja andmepuhtus

**Otsus: käesolevas keskkonnas ei olnud turvaline lokaalne runtime-kontroll teostatav; analüüs põhineb staatilisel koodi-, skeemi- ja Git-ajaloo tõendil.** Põhjendus:

- `DATABASE_URL` osutab kasutaja masina `localhost:5432`-le; analüüsi-sandbox on eraldi Linux-VM, kust see port on kättesaamatu (kontrollitud: `Connection refused`). Rakenduse dev-serverit (`npm run dev`, port 3000) siit käivitada ega andmebaasi ühendada ei saa.
- Seetõttu ei loodud ühtegi sünteetilist kasutajat, sessiooni ega tokenit. **Nulljääk on triviaalselt tagatud: midagi ei loodud, seega midagi ei ole koristada.** Tootmisandmeid ei loetud ega muudetud.
- Varasemad runtime-tõendid samas projektis (rollivahetaja ptk 12.3, O‑TK9 ptk 1) tehti Claude Code'i keskkonnas, kus DB oli kättesaadav. Käesoleva skoobi leiud on staatiliselt üheselt kinnitatavad täpsete failiridade põhjal ega vaja runtime't; PROF‑P1 vastuvõtukriteeriumid (ptk 14) on kirjeldatud lokaalse sünteetilise kasutajaga käivitatavatena, kui teostaja keskkonnas on DB ligipääs.

Kui tooteomanik soovib runtime-kinnitust enne PROF‑P1 teostust, saab selle teha lokaalselt: (1) loo sünteetiline kasutaja teadaoleva PIN-iga; (2) autendi; (3) `PUT /api/profile {email:"uus@x"}` **ilma** `currentPassword`-ita → tänane kood tagastab 200 ja vahetab e-posti (tõendab PROF‑P1); (4) kustuta sünteetiline kasutaja `DELETE /api/profile`-ga ja kinnita nulljääk (`user`, `session`, `verificationToken` read = 0).

---

STATUS: COMPLETE
