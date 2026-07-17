# T02 `ACCOUNT-V1` — teostuse progress & jätkamishandoff

STATUS: IN_PROGRESS
Alustatud: 2026-07-17
Teostaja: Claude (Opus 4.8) Claude Code'is
Alusleping: [`t02-account-v1-ulesanne.md`](./t02-account-v1-ulesanne.md) — see fail on tõeallikas skoobile, keeldudele, lukustatud otsustele ja Definition of Done'ile.
Analüüsiallikas: [`fable-5-profiil-ja-konto-elutsukkel.md`](./fable-5-profiil-ja-konto-elutsukkel.md) (leiud PROF-P1…P3).

> Selle faili eesmärk: iga järgmine sessioon/konto saab **sama worktree'st ja harust** jätkata ilma konteksti kaotamata. Loe kõigepealt alusleping, siis see progress-fail, siis kontrolli Git-seisu (allpool ptk 0).

---

## 0. Git-seis ja worktree (kontrolli alati esimesena)

| Fakt | Väärtus |
|---|---|
| Worktree | `C:\Users\rauds\Desktop\SotsiaalAI-account-v1` |
| Haru | `codex/account-v1` |
| Baas (origin/main) | `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` — kontrollitud `git ls-remote origin` = sama |
| PROF-P1 cherry-pick (`-x`) | algne `16e688f7` → siin `69c11be0` (E1) |
| Migratsioon | **veel tegemata** (E2 toob teema ainsa migratsiooni) |
| main / server / merge / deploy | **PUUTUMATA** — ei tehta ilma tooteomaniku eraldi loata |

Jätkamiskäsklused:
```bash
cd "C:/Users/rauds/Desktop/SotsiaalAI-account-v1"
git status -sb            # eeldus: haru codex/account-v1, puhas või ainult ootuspärane WIP
git log --oneline -8      # kontrolli, kuhu E-etapid on jõudnud
```
Ära puhasta/lähtesta/rebase'i pooleliolevat diffi. Ära ava uut paralleelset konto-haru. (Vt `teemaarenduse-jatkamise-kord.md`.)

---

## 1. Lukustatud V1 otsused (aluslepingust — ei vaja uut otsust)

- **E-post:** verify-then-swap. `User.email` jääb vanaks login-identiteediks kuni uus aadress on kinnitatud.
- **Turvateavitused:** e-posti muutuse *kinnitumisel* kiri VANALE aadressile; PIN-i muutumisel kiri kontol kehtivale aadressile. Kirjas EI ole PIN-i, tokenit ega uut e-posti.
- **Paroolita konto:** e-posti muutus ja kustutus vajavad esmalt PIN-i loomist olemasoleva e-posti taastamisraja kaudu; ainult sessioon ei piisa.
- **Aegunud tellimus:** selge „tellimus aegus {kuupäev}" + paketihalduse CTA. T09 arveldus-/õigusteolekut EI muudeta.
- **Admini eelvaade:** informatiivne riba (tegelik konto- + aktiivne vaateroll); õigused ei muutu.
- **Kustutuse `202`:** väljalogimise järel anonüümne lokaliseeritud kinnitusvaade; `deletionJobId`/kontoandmed EI jõua URL-i, DOM-i ega logisse.

---

## 2. Etappide seis (E1–E6)

| Etapp | Sisu | Seis | Commit |
|---|---|---|---|
| **E1** | PROF-P1 samas teemas (serveripoolne PIN-kontroll e-posti muutmisel + rate-limit enne bcrypti; sama e-post ei reauth'i) | ✅ olemas (cherry-pick) — vt märkus E2 all | `69c11be0` |
| **E2** | verify-then-swap e-posti elutsükkel (uus mudel + migratsioon + kinnitusendpoint + UI „ootab kinnitust") | ⬜ TEGEMATA | — |
| **E3** | PIN, taastamine ja sessioonid (reset PUT tühistab kõik vanad sessioonid; PIN-muutuse turvateade; paroolita step-up) | 🔨 TÖÖS (disain ptk 4) | — |
| **E4** | Profiili ausad olekud (aegunud tellimus, admini eelvaateriba, kustutuse 202 pending) | ⬜ TEGEMATA (disain ptk 5) | — |
| **E5** | Konto dialoogide ligipääsetavus (Modal fookuslõks/-taaste/Escape; busy ei sulgu) | 🔨 TÖÖS (disain ptk 6) | — |
| **E6** | Keeled (ET/EN/RU pariteet uutele tekstidele) + mobiil/klaviatuur | ⬜ jookseb E2–E5 kõrval; lõppkontroll enne DoD-i | — |

> **NB E1 vs E2:** PROF-P1 (`69c11be0`) teostab praegu **swap-then-verify** — `updateProfileForUser` seab e-posti haru korral kohe `data.email = nextEmail`. E2 asendab selle harul verify-then-swap loogikaga (e-post EI muutu enne kinnitust). PROF-P1 rate-limit + reauth + „sama e-post = no-op" jäävad kehtima. E1 vastuvõtukriteeriumid (õige/vale PIN, rate-limit enne bcrypti) tuleb pärast E2-t uuesti roheliseks tõestada.

---

## 3. E2 — verify-then-swap: tehniline disain (järgmise sessiooni põhitöö)

### 3.1 Uus Prisma mudel (teema AINUS migratsioon)
```prisma
model PendingEmailChange {
  id          String   @id @default(cuid())
  userId      String   @unique          // üks pooleliolev muudatus kasutaja kohta
  newEmail    String                     // normaliseeritud sihtaadress (lowercase, trimmed)
  tokenHash   String   @unique           // sha256(token); toortoken ainult e-kirja lingis
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  requestedIp String?
  requestedUa String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([expiresAt])
}
```
+ `User`-mudelile relatsioon: `pendingEmailChange PendingEmailChange?`
Migratsiooni nimi (soovitus): `add_pending_email_change`. Rakenda `npx prisma migrate dev --name add_pending_email_change` alles siis, kui localhost Postgres on käes; muidu jäta `NOT_RUN` ja märgi siia.

### 3.2 Taotluse rada (`PUT /api/profile`, e-posti haru — `lib/profile/accountLifecycle.js`)
- Reauth + rate-limit (PROF-P1) jäävad. Kandidaat-e-post `@`-kontroll + normaliseerimine.
- Unikaalsuse kontroll **kahe** allika vastu: (a) aktiivsed `User.email`; (b) teiste `PendingEmailChange.newEmail` (mitte-aegunud).
- **EI muuda** `user.email`, `emailVerified`, `sessionVersion`. Loob/asendab `PendingEmailChange` (upsert userId järgi), `tokenHash = sha256(token)`, `expiresAt = now + EMAIL_CHANGE_HOURS (vaikimisi 24)`.
- Saadab **uuele** aadressile ainult muutuse kinnituse lingi (`/api/profile/email-change/confirm?token=…&locale=…`). Saatmise rike ei tohi jätta „poolt" olekut — kui mail ebaõnnestub, kustuta pending või jäta kehtima + logi turvaliselt (otsusta: jäta kehtima, UI pakub kordussaatmist).
- Tagastab UI-le `{ ok, pendingEmail: masked, requiresReauth:false }` (login-identiteet ei muutunud → sessioone ei tühistata selles faasis).

### 3.3 Kinnitusendpoint (uus `app/api/profile/email-change/confirm/route.js`, avalik GET nagu verify-email)
- Token = ainus tõend uue aadressi valdamisest (link läks uuele postkastile). Ei nõua aktiivset profiili-sessiooni.
- Hashib sissetuleva tokeni, leiab `PendingEmailChange` tokenHash järgi. Kontrollib: eksisteerib, mitte-aegunud, omanik (userId) kehtiv kasutaja.
- **Aatomne tehing:** re-check unikaalsus (newEmail ikka vaba) → `user.email = newEmail`, `emailVerified = now`, `emailVerificationSentAt = null` → kustuta `PendingEmailChange` → `sessionVersion++` + kustuta `Session/TrustedDevice/LoginTempToken/EmailOtpCode` (nagu logout-all, sest login-identiteet muutus).
- Pärast tehingut: turvateade **vanale** aadressile (ilma saladusteta; kasuta `summarizeUserAgent`/`formatSecurityEventTime`). Saatmise rike EI keri muutust tagasi.
- Korduskasutatud/aegunud/võõras/võistlev token → geneeriline viga, konto olemasolu EI leki. Renderdab HTML-lehe verify-email stiilis (või lokaliseeritud JSON, kui UI-voog seda kasutab).

### 3.4 UI (`components/alalehed/UuendaEpostiBody.jsx` + „Minu jagamised"/profiil)
- Pärast edukat taotlust: „Ootab kinnitust {masked new email}" seis; nupud „Saada uuesti" (rate-limit) ja „Katkesta" (kustutab pending enne kinnitust). Tühja-/laadimis-/veaolekud.
- Kinnitamata olekus vana e-post + sisselogimine jäävad tööle.

### 3.5 E2 testikontrahid (`tests/profile/accountLifecycle.test.js` + uus confirm-test)
1. Õige PIN → loob pending, `user.email` ei muutu, `emailVerified` säilib, `sessionVersion` ei muutu, kiri läheb uuele aadressile.
2. Vale/puuduv PIN → ei loo pending'it, 0 kirja (E1 kehtib).
3. Kinnitus vahetab e-posti täpselt üks kord, tühistab sessioonid, saadab vanale aadressile turvateate ilma saladusteta.
4. Aegunud / korduskasutatud / võõras / võistlev token ei muuda ühtegi kontot.
5. Sama e-post = no-op (ei pending, ei kiri).

---

## 4. E3 — PIN, taastamine ja sessioonid: disain

**Peamine leid (koodist tõendatud):** `PUT /api/auth/password/reset` (`app/api/auth/password/reset/route.js:281–294`) uuendab ainult `passwordHash` + kustutab tokeni. **Ei tühista vanu sessioone** (`sessionVersion`, `Session`, `TrustedDevice`, `LoginTempToken`, `EmailOtpCode`). See on E3 põhiparandus.

- Muuda reset PUT tehing samaks kui `logout-all` (`app/api/profile/logout-all/route.js:67–102`): `passwordHash` uuendus + `sessionVersion++` + neli `deleteMany` ühes `$transaction`-is + tokeni kustutus. Token = ühekordne (juba nii).
- PIN-i muutmine profiililt (`updateProfileForUser`): pärast edukat muutust saada turvateade kontol kehtivale e-postile (reuse mailer; ilma PIN/token/saladus).
- Paroolita konto step-up: `passwordHash == null` korral tagastavad e-posti muutus ja kustutus serveris kontrollitud step-up vastuse (messageKey → UI juhatab PIN-i taastamisele). Klient ei möödu lipuga.
- Eelistus: tõsta reset-PUT sessioonitühistus testitavaks funktsiooniks (nt `lib/auth/passwordResetLifecycle.js` või laienda accountLifecycle't), et `node:test` saaks süstitud fake-prismaga tõestada ilma DB-ta.

**E3 testid:** (a) reset PUT tühistab kõik sessiooniseisud + token ühekordne; (b) PIN-muutus saadab turvateate; (c) paroolita konto ei saa e-posti muuta/kustutada ilma taastamiseta.

---

## 5. E4 — profiili ausad olekud: disain

- **Aegunud tellimus:** `lib/usage/snapshot.js` (~171–213) lisab eristatava seisu, kui `validUntil < now` (mitte vaikne tagasilangus). `components/profile/UsageOverview.jsx` kuvab „tellimus aegus {kuupäev}" + halda-CTA. **T09 õigusteolekut ei muudeta** — ainult kuvakiht.
- **Admini eelvaateriba:** profiilis mitteinteraktiivne indikaator (tegelik roll + aktiivne `adminViewRole`). Mitte-admin päring ei saa lisainfot/õigusi. Andmed juba GET-vastuses (`effectiveRole`/`adminViewRole`/`isRoleViewActive`).
- **Kustutuse 202:** `ProfiilBody.jsx` (~674–690) eristab `res.status === 202` → anonüümne „kustutus pooleli" kinnitusvaade; `deletionJobId` ei lähe DOM-i/URL-i. `200` → lõplik kinnitus.

**E4 testid:** aegunud vs aktiivne vs tulevikus-kehtiv vs tasuta snapshot erinevad; 202 ei avalda job-id'd; admini riba kasutab ainult serveritõde.

---

## 6. E5 — Modal ligipääsetavus: disain

**Praegu:** `components/ui/Modal.jsx` on minimaalne — `role="dialog" aria-modal`, aga fookust ei liiguta, ei lõksusta ega taasta; tavaline `Modal` (Kasutus/Konto seaded) ei püüa Escape'i (ainult `ModalConfirm`).

- Lisa `Modal`-i tasemel: avahetke algfookus dialoogi (esimene fookustatav või konteiner `tabIndex=-1`), Tab/Shift+Tab fookuslõks, Escape (kui `onClose` lubatud), avaja fookuse taastamine sulgemisel.
- `busy`/`deleting` olekus Escape + overlay EI sulge pooleliolevat toimingut (prop nt `dismissible=false`).
- Skoop = konto kasutusjuhud; **mitte** T15 platvormiülene a11y-audit.

**E5 testid:** fookus liigub sisse; Tab-ring jääb dialoogi; Escape taastab fookuse avajale; busy dialoog ei sulgu. (Kui DOM-testid pole seadistatud, tõesta käsitsi klaviatuuriga runtime's + dokumenteeri.)

---

## 7. E6 — keeled ja mobiil

- Iga uus kasutaja-/e-kirjatekst sümmeetriliselt `messages/et.json`, `en.json`, `ru.json`. Server `messageKey` ei tohi olla kasutajale nähtav.
- `npm run i18n:check` peab olema roheline (ET-baasi pariteet).
- Klaviatuuriga: e-posti muutus, PIN-muutus, taastamine, kustutus, modaali sulgemine; 375 px mobiil; reduced-motion rahulik.

---

## 8. Kontrollid enne iga commit'i / DoD

Käivita (alusleping ptk „Nõutud testilepingud"):
```bash
cd "C:/Users/rauds/Desktop/SotsiaalAI-account-v1"
node --test tests/profile/ tests/auth/ 2>&1 | tail -30   # + kasutuse/modaali sihttestid
# muudetud failide lint; npm run i18n:check
# skeemi korral: npx prisma validate + migratsiooniahela kontroll
git diff --check
# production build
```
Täissviit ja sõltumatu audit jäävad T27-sse, kui eraldi ei nõuta.

## 9. Sünteetiline runtime
Kasuta ainult lokaalseid sünteetilisi testkontosid (`docs/platvormi arendus/tehis-testkontod.md`, `.env.ai-test.local`; PIN-e ei väljastata). Ära loo uusi kontosid ega kasuta tootmisandmeid. E-posti vahetuse/kustutuse täisrada vajab lokaalset DB-d; kui pole turvaliselt käes → `NOT_RUN`/`NOT_PROVEN`.

## 10. Jätkamise kontroll-loend (järgmine sessioon)
1. [ ] Kontrolli ptk 0 Git-fakte.
2. [ ] Kui E3/E5 on committimata WIP → jätka samast; kui committed → vaata `git log`.
3. [ ] E2 migratsioon: rakenda ainult DB-ga; muidu skeem + kood valmis, migratsioon `NOT_RUN`.
4. [ ] Uuenda seda faili (ptk 2 tabel + commit-veerg) iga lõpetatud etapi järel.
5. [ ] Lõpparuanne koordinaatorile aluslepingu vormingus.

---

## 11. Muudatuste logi (selle faili)
- 2026-07-17: fail loodud; worktree/haru/cherry-pick seadistatud (E1 `69c11be0`); E2–E6 disain kirja pandud. E3/E5 teostus algab.
