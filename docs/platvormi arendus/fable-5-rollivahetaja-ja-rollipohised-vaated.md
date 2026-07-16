# Rollivahetaja ja rollipõhised vaated — piiritletud analüüs

**Kuupäev:** 2026-07-16
**Analüüsi ulatus:** aktiivne `main` (60 commitit alates 07.07 „puhas algus" 64a24eb4) + vana täisajalugu `prod`-remote'is (`prod/main` jt harud).
**Küsimusepüstitus:** kasutaja tellimus 16.07 — 12 kontrollpunkti rollivahetaja teostuse, ajaloo, õiguspiiride ja rollipõhiste vaadete kohta; soovitud vaikeasukoht = lehe vasak alanurk, kui ei konflikti faasiriba/ruumidokiga.

> ### ⚠ UUENDUS 16.07 (sama päev, analüüsi järel)
> Tellija otsustas asukoha ümber — **ekraani alumine PAREM nurk** (mitte vasak), lüliti kõigile rollilehtedele.
> **RV-P0 on TEOSTATUD ja runtime-tõendatud → vt [ptk 12](#12-teostus-1607--rv-p0-tehtud-ja-runtime-tõendatud).**
> Peatükid 1–11 kirjeldavad seisu **enne** teostust ja jäävad ajaloolise kirjena alles. Aegunud on: **ptk 1 p2 ja p5**, **ptk 3.3 nähtavuse veerg**, **ptk 8 asukohareeglid** (vasak → parem) ja **ptk 10.2 RV-P0 rida**. Ptk 2, 4, 5, 6, 7, 9 (fail-closed leping) kehtivad muutumatult.

---

## 1. Kokkuvõte (TL;DR)

1. **Aktiivses `main`-is on üks ja ainus rollivahetusmehhanism: administraatori vaate-eelvaade.** See on kolme nupuga S/P/T lülitirühm ([WorkspaceRoleCycleButton.jsx](../../components/workspace/WorkspaceRoleCycleButton.jsx)), mis salvestab valiku httpOnly-küpsisesse `sotsiaalai_admin_view_role` API kaudu ([app/api/profile/view-role/route.js](../../app/api/profile/view-role/route.js)). Tavakasutajal (pöörduja, spetsialist, teenuseosutaja) rollivahetust EI OLE — roll on konto püsiomadus.
2. **Lüliti on visuaalselt nähtav ainult Töölaual** (vestlusakna töölauapaneel, alumine vasak nurk — täpselt kasutaja soovitud vaikekoht, tehtud tellija 06–07.07 otsusega). Kolmel muul pinnal (eraldi `/eelpoordumised`, `/documents`, `/dokreziim` agendivaade, `/teenusekaart` filtripaneel) komponent **renderdub DOM-i endiselt**, aga redisain (07.07) kustutas kogu positsioneeriva CSS-i (`workspace-feature-admin-role--floating/--viewport`, `documents-admin-role-menu--viewport`) — nupud jäävad stiilimata voogu ja on kasutaja jaoks „kadunud".
3. **Vana teostus on täielikult taastatav `prod/main`-ist:** enne redisaini oli lüliti fikseeritud ekraani **paremas ülanurgas** (position:fixed, z-index 92) dokumentide, agendirežiimi ja eelpöördumiste lehel; toona oli see ÜKS tsükkelnupp (`workspace-role-cycle-button`), mitte kolm.
4. **Õiguspiir on juba praegu suures osas fail-closed:** küpsist loetakse ainult siis, kui sessioon on päriselt admin (`resolveSessionRoleState`, [lib/authz.js:29](../../lib/authz.js)); admini-API-d käivad `assertAdmin`-i (päris sessioonirolli) järgi; tellimusevärav ei sõltu vaaterollist. Vaateroll muudab **sisu ja marsruutimist ka serveris** (nt `/documents` suunab CLIENT-vaate `/dokreziim`-i), aga ei anna kunagi juurde õigusi, mida sessioonil pole. Leitud kitsaskohad on eksitus-, mitte eskalatsiooniriskid (ptk 5 ja 7).
5. **Soovitus:** üks jagatud `RoleViewControl`-komponent, mis renderdub globaalselt (mitte lehe kaupa), vaikimisi vasakus alanurgas, ja taandub automaatselt, kui pinnal on faasiriba/ruumidokk või lüliti pole rollitundlikul lehel asjakohane. Teostus 4 väikese paketina (ptk 9), esimene pakett on puhas CSS+paigutus, ilma õigusloogika muutusteta.

---

## 2. Rollimudel: millised rollid on päriselt toetatud (küsimus 5)

### 2.1 Andmemudel

[prisma/schema.prisma:12](../../prisma/schema.prisma) defineerib:

```prisma
enum Role {
  ADMIN
  SOCIAL_WORKER
  SERVICE_PROVIDER
  CLIENT
}
```

`User`-mudelil ([schema.prisma:652](../../prisma/schema.prisma)) on **kaks eraldi välja**:

- `role Role @default(CLIENT)` — kasutaja äriline roll;
- `isAdmin Boolean @default(false)` — administraatoriõigus eraldi lipuna.

See tähendab, et „administraator" on platvormil kahekihiline: `role=ADMIN` **või** `isAdmin=true` ([lib/authz.js:6-10](../../lib/authz.js) `isAdmin()` aktsepteerib kumbagi). Teoreetiliselt võimalik kombinatsioon „`role=SOCIAL_WORKER` + `isAdmin=true`" töötab ja käitub adminina.

### 2.2 Toetatud rollid kokkuvõtlikult

| Roll | Kirje | Päris kasutajaroll? | Rollivahetajas valitav? |
|---|---|---|---|
| Pöörduja | `CLIENT` | jah (vaikimisi registreerumisel) | jah (P) |
| Sotsiaaltöö spetsialist | `SOCIAL_WORKER` | jah | jah (S) |
| Teenuseosutaja | `SERVICE_PROVIDER` | jah | jah (T) |
| Administraator | `ADMIN` (enum) ja/või `isAdmin=true` | jah | EI ole valitav sihtroll — admin on vahetaja *omanik* |
| Muud lisarollid | — | **puuduvad** | — |

Muid rolle (nt „mentor", „superviisor", „koordinaator") skeemis ega autoriseerimiskoodis ei ole. Supervisiooni tootemudel (vt `fable-5-supervisiooni-tootemudel-*.md`) kavandab mentorite andmebaasi ESTA-na, kuid see EI lisa uut `Role`-väärtust — analüüsi seisuga jääb neljane enum ainsaks rolliteljeks.

### 2.3 Rollinormaliseerimise kaks kihti

Oluline arhitektuurifakt, mis seletab kogu ülejäänud käitumist ([lib/authz.js:11-27](../../lib/authz.js)):

- `roleFromSession()` → tagastab **päris** rolli (`ADMIN`, kui admin);
- `normalizeRole()` → **sisurollide ruum**: `ADMIN → SOCIAL_WORKER`, ülejäänud jäävad samaks; tundmatu → `CLIENT`.

Ehk platvormi sisupind tunneb ainult kolme „töörolli" (CLIENT / SOCIAL_WORKER / SERVICE_PROVIDER); ADMIN on **õiguste**, mitte **sisu** roll. Admin näeb vaikimisi spetsialisti sisu. Sama peegeldus on kliendipoolses [useEffectiveRole.js:15-22](../../components/auth/useEffectiveRole.js) (`normalizeEffectiveRole`: `ADMIN → SOCIAL_WORKER`).

---

## 3. Aktiivse `main`-i rollivahetuse teostus ja jäänukid (küsimused 1–2)

### 3.1 Komponendiahel

```
WorkspaceRoleCycleButton  (puhas UI: 3 nuppu S/P/T, aria-pressed, data-variant)
        ▲ kasutab
AdminRoleViewCycleButton  (fetch PUT /api/profile/view-role, optimistlik olek, vearoll)
        ▲ kasutavad 4 pinda (3.3)
useEffectiveRole          (klient-hook: sessioon + adminil /api/profile päring)
resolveSessionRoleState   (serveri tõde: sessioon + küpsis → {role, effectiveRole, adminViewRole, isAdmin})
```

- [WorkspaceRoleCycleButton.jsx](../../components/workspace/WorkspaceRoleCycleButton.jsx) — kolm ümmargust nuppu tähisega S/P/T (koodikommentaar rida 38: „Tellija 06.07 öö: mitte tsükli-nupp, vaid KOLM nuppu…, aktiivne helendab"). Järjekord UI-s: S, P, T. Tundmatu väärtus normaliseerub `SOCIAL_WORKER`-iks.
- [AdminRoleViewCycleButton.jsx](../../components/workspace/AdminRoleViewCycleButton.jsx) — saadab `PUT /api/profile/view-role` `{viewRole}`, optimistliku olekuga; õnnestumisel kutsub `onRoleChanged(payload.user)`.
- [app/api/profile/view-role/route.js](../../app/api/profile/view-role/route.js) — **401 ilma sessioonita, 403 mitte-adminile** (rida 77–82); väärtus normaliseeritakse kolmese lubatud hulga vastu ([lib/adminViewRole.js:3](../../lib/adminViewRole.js)); kirjutab httpOnly, sameSite=lax, 30-päevase küpsise `sotsiaalai_admin_view_role`; tühi väärtus kustutab küpsise. **Andmebaasi EI kirjutata midagi** — vaateroll on puhas küpsiseolek.
- [useEffectiveRole.js](../../components/auth/useEffectiveRole.js) — mitte-adminil tuletab kõik sessioonist (mingit päringut ei tee); adminil laeb `/api/profile`, mis tagastab serveri arvutatud `effectiveRole`/`adminViewRole` ([app/api/profile/route.js:207](../../app/api/profile/route.js) → `resolveSessionRoleState`).

### 3.2 Serveripoolne tõde

[lib/authz.js:29-42](../../lib/authz.js):

```js
export function resolveSessionRoleState(session, cookieSource) {
  const role = roleFromSession(session);
  const admin = isAdmin(session?.user);
  const adminViewRole = admin ? getAdminViewRoleFromCookies(cookieSource) : null; // ← fail-closed
  const effectiveRole = admin ? adminViewRole || "SOCIAL_WORKER" : normalizeRole(role);
  ...
}
```

Küpsis loetakse **ainult** siis, kui sessioon on admin. Tavakasutaja, kes küpsise käsitsi endale kirjutab, ei mõjuta midagi. Vaikimisi näeb admin spetsialisti vaadet.

### 3.3 Kus lüliti praegu renderdub — neli pinda, üks nähtav

| # | Pind | Renderdustingimus | Visuaalselt nähtav? |
|---|---|---|---|
| 1 | **Töölaud** — vestlusakna töölauapaneel ([WorkspacePanel.jsx:490-499](../../components/chat/WorkspacePanel.jsx), render rida 611) | `isAdmin && activeEmbeddedFeature !== "journey"` | **JAH** — [workspace.css:27-35](../../app/styles/workspace.css) ankurdab paneeli **alumisse vasakusse nurka** (absolute; bottom/left clamp) |
| 2 | Eraldi `/eelpoordumised` ([WorkspaceFeaturePage.jsx:4816-4831](../../components/workspace/WorkspaceFeaturePage.jsx)) | `!embedded && isAdmin && featureKey === "pre_inquiries"` | **EI** — className puudub, positsioneerivat CSS-i pole; div jääb sisuvoo algusse stiilimata |
| 3 | `/teenusekaart` filtripaneel ([WorkspaceFeaturePage.jsx:3124-3133](../../components/workspace/WorkspaceFeaturePage.jsx), `.service-map-admin`) | `isAdmin` (kaardi filtripaneeli sees) | osaliselt — [workspace.css:630](../../app/styles/workspace.css) annab konteineri, aga see elab filtripaneeli kihi sees, mitte püsiva lehe-nupuna |
| 4 | `/documents` ([DocumentsPage.jsx:524-532](../../components/documents/DocumentsPage.jsx)) ja `/dokreziim` agendivaade ([AgentModePage.jsx:1609-1616](../../components/agent/AgentModePage.jsx)) | `isAdmin && !embedded` | **EI** — sama põhjus: className eemaldatud, `.admin-role-view-cycle` positsioneerimisreegel eksisteerib ainult `.workspace-dashboard-panel` lapse jaoks |

Tähtis nüanss: uues vestluspõhises disainis avanevad needsamad moodulid enamasti **Töölaua paneeli seest** (`?workspace=`-parameeter; [WorkspacePanel.jsx:24-32](../../components/chat/WorkspacePanel.jsx) `EMBEDDED_WORKSPACE_FEATURES`) `embedded`-režiimis — siis sisemine lüliti on teadlikult peidetud ja paneeli enda alumise vasaknurga lüliti (rida 1) jääb tööle **kõigil manustatud vaadetel peale Teekonna**. Probleem on seega kitsalt **eraldi täislehe-marsruutidel** (otselink, värskendus, SEO-sisenemine), kus lüliti on DOM-is, aga ilma kujunduseta.

### 3.4 Jäänukid ja surnud haagid (küsimus 2)

- `AdminRoleViewCycleButton` ilma `className`-ita kutsed pindadel 2 ja 4 — **elus kood, surnud kujundus** (vt 4.2: klassid olid, redisain kustutas).
- [WorkspacePanel.jsx:607](../../components/chat/WorkspacePanel.jsx) kommentaar viitab veel „paneeli all vasakul" lülititele — kehtiv.
- `prod/main`-is oli lüliti mähitud `styles.roleMenu` ([WorkspacePanel.module.css](../../components/chat/WorkspacePanel.module.css)) — aktiivses `main`-is mähis eemaldatud, moodulklassi jäänuk võib failis alles olla (kontrollitud: aktiivne kood seda ei kasuta).
- `JourneyDashboard` saab Töölaualt `roleOverride={isAdmin ? "CLIENT" : ""}` ([WorkspacePanel.jsx:581](../../components/chat/WorkspacePanel.jsx)) — Teekond on adminile alati pöörduja-vaates, seepärast on S/P/T lüliti seal välja lülitatud. See on kolmas, varjatud „rollivahetuse" mehhanism (vt ptk 7 eristust).
- [lib/dashboardInfoContent.js](../../lib/dashboardInfoContent.js) — ⓘ-selgitustekstid viitavad rollivahetajale Töölaua kontekstis (sisutekst, mitte loogika).

---

## 4. Git-ajalugu: millal ja kus oli rollivahetaja nähtav (küsimus 3)

### 4.1 Sünd ja areng (vana ajalugu, `prod`-remote)

| Commit | Kuupäev | Muutus |
|---|---|---|
| `90498716` | **06.05.2026** | Sünnikommit: `AdminRoleViewCycleButton`, `WorkspaceRoleCycleButton`, `useEffectiveRole`, `lib/adminViewRole.js`, view-role API. Renderdus kohe **DocumentsPage** ja **AgentModePage** peal |
| `a62e974c` | 09.05.2026 | täiendused (sama komplekt) |
| `f31862d1` | 26.05.2026 | (rollipiiride tööheaolu-moodul, mitte vahetaja) |
| `be1bc7f7` | 04.06.2026 | Lüliti lisandus **WorkspacePanel**-ile (Töölaud) ja **WorkspaceFeaturePage**-ile (eelpöördumised); kasutuskohtade hulk = tänane 4 |
| `64a24eb4` | **07.07.2026** | „Hämarikuruumi redisain — puhas algus": uus repo-ajalugu; lülitist sai 3-nupuline S/P/T rühm; **kogu vana positsioneeriv CSS jäi maha** |
| (aktiivne main) | 06–07.07 → | Töölaua paneelis viidi lüliti alumisse vasakusse nurka ([workspace.css:23-26](../../app/styles/workspace.css) kommentaar: „Admini S/P/T vaatevalik — paneeli ALUMISES VASAKUS nurgas") |

### 4.2 Kuidas vana nähtavus täpselt töötas (taastatav disain)

`prod/main` tipus (enne redisaini):

- **Eraldi lehtedel** oli lüliti `position:fixed` ekraani **paremas ülanurgas**, safe-area-teadlik, z-index 92:
  - dokumendid/agendirežiim: klassid `documents-admin-role-menu` (absolute, panel-sisene) ja `documents-admin-role-menu--viewport` (fixed) — CSS `prod/main:app/styles/features/documents/ui.css:102-117`;
  - eelpöördumised (standalone WFP): `workspace-feature-admin-role--floating` + `--viewport` — CSS `prod/main:app/styles/features/service-map/desktop/base.css:1297-1318`;
  - JSX andis klassid tingimuslikult: `embedded ? "documents-admin-role-menu" : "… --viewport"` (`prod/main:components/agent/AgentModePage.jsx:1654`; `…DocumentsPage.jsx:553`; `…WorkspaceFeaturePage.jsx:4859`).
- **Nupp ise oli teistsugune**: üks valge ümmargune **tsükkelnupp** (`workspace-role-cycle-button`, 2.42rem, klikk = järgmine roll ringis), mitte kolme nupu rühm.
- Töölaual (alates 04.06) elas lüliti `styles.roleMenu` mähises paneeli sees.

**Järeldus küsimusele 3:** rollivahetaja oli nähtav pöördumiste (`/eelpoordumised`), dokumentide (`/documents`) ja dokumendikoostamise (`/dokreziim`) lehtedel alates 06.05/04.06 kuni redisainini 07.07 (`64a24eb4`), fikseeritult paremas ülanurgas. Redisain ei eemaldanud komponente — ta jättis nad ilma CSS-ita. Vana välimus on ühe commit'i (`prod/main` failiversioonide) kaugusel taastatav, kuid tuleb kohandada uue S/P/T-rühma ja uue klaasikeele järgi (ptk 10).

---

## 5. Kas rollivahetus muudab ainult UI vaatenurka või ka serveripoolseid õigusi? (küsimus 4)

Lühivastus: **õigusi ei muuda kunagi; serveripoolset SISU ja marsruutimist muudab küll.** Need on kaks eri telge ja segiajamine oleks viga.

### 5.1 Mida vaateroll serveris PÄRISELT muudab

`resolveSessionRoleState` (küpsisega) juhib järgmisi serveripoolseid otsuseid:

| Koht | Mõju |
|---|---|
| [app/documents/page.js:31-38](../../app/documents/page.js) | `effectiveRole === "CLIENT"` → redirect `/dokreziim` (admin P-vaates ei näe dokumenditeeki üldse) |
| [lib/chat/requestBootstrap.js:196-197](../../lib/chat/requestBootstrap.js) | vestluse `normalizedRole` = effectiveRole → süsteemiprompt ([promptBuilder.js:201](../../lib/chat/promptBuilder.js)), max väljundtokenid (SOCIAL_WORKER pikem, [promptBuilder.js:28-35](../../lib/chat/promptBuilder.js)), RAG sihtrühmafilter ([retrievalContextAssembler.js:1174-1184](../../lib/chat/retrievalContextAssembler.js): CLIENT → `audience ∈ {CLIENT, BOTH}`, muidu `{SOCIAL_WORKER, BOTH}`) |
| [app/api/chat/conversations/route.js:138-141](../../app/api/chat/conversations/route.js) | vestluste loendi rollifilter (vaikimisi effectiveRole; admin ilma parameetrita näeb kõiki OMA vestlusi) |
| [app/api/wellbeing/_shared.js:31-37](../../app/api/wellbeing/_shared.js) + [app/tooheaolu/page.jsx:28-37](../../app/tooheaolu/page.jsx) | Tööheaolu värav: `canUseWellbeingRole(effectiveRole, isAdmin)` — SOCIAL_WORKER-only, **aga admin pääseb alati** ([lib/wellbeingTools.js:119-122](../../lib/wellbeingTools.js) `if (admin) return true`) |
| [app/api/tts/route.js:157](../../app/api/tts/route.js), [stt](../../app/api/stt/route.js), [analyze-file](../../app/api/chat/analyze-file/route.js) | tellimuseväravasse antav roll (adminil möödaviik nagunii) |
| [app/api/profile/route.js:207](../../app/api/profile/route.js) | profiilivastus kannab `effectiveRole`/`adminViewRole` UI-le tagasi |

### 5.2 Mida vaateroll EI muuda (õiguste kihid, mis käivad päris sessiooni järgi)

- **Admini-API-d**: 21 marsruuti `assertAdmin`-iga ([lib/authz.js:106-127](../../lib/authz.js)) + admin-lehed `requireAdminRagAccess`-iga — kõik loevad päris sessiooni (`isAdmin`), mitte küpsist. Admin P-vaates jääb adminiks.
- **Tellimusevärav**: [lib/authz.js:76-81](../../lib/authz.js) — admin möödub tellimusest ALATI, sõltumata vaaterollist.
- **Vestluse kirjutusroll**: [lib/chat/conversationRoles.js:17-22](../../lib/chat/conversationRoles.js) `resolveConversationWriteRole` — mitte-adminil ignoreeritakse kliendi saadetud `body.role` täielikult (`sessionRole` võidab). Admin saab soovi korral rolli valida.
- **Ruumiliikmesus**: [requestBootstrap.js:211-216](../../lib/chat/requestBootstrap.js) — ruumis vestlemine nõuab liikmesust; admin möödub (päris `isAdmin`, mitte vaateroll).
- **Kovisioon**: [app/kovisioon/page.jsx:26-36](../../app/kovisioon/page.jsx) ja `/lopetatud-juhtumid` — värav `canUseCovisionRole(role, admin)` kasutab **päris rolli** (SOCIAL_WORKER ∨ SERVICE_PROVIDER ∨ admin); vaateküpsist ei loeta üldse.
- **Dokumentide API-d** (7 marsruuti) ja **materjalide kvoot**: kasutavad `effectiveRoleFromSession(session)` ([lib/authz.js:25-27](../../lib/authz.js)) — **sessioonipõhine, ilma küpsiseta**.

### 5.3 Leitud kitsaskohad (eksitusriskid, MITTE eskalatsioonid)

Päris õiguste möödapääsu ega andmeleket selle analüüsi käigus **ei leitud**. Küll aga kolm ebakõla, mis teevad admini eelvaate ebatäpseks ja võivad tulevikus vigu peita:

- **K1 — kaks eri „effective role" resolverit.** Dokumentide API-d ([artifacts/generate/route.js:62](../../app/api/documents/artifacts/generate/route.js) jt 7 tk) ja materjalikvoot ([materials/route.js:209](../../app/api/materials/route.js)) kasutavad küpsiseta `effectiveRoleFromSession`-i; lehed ja vestlus kasutavad küpsisega `resolveSessionRoleState`-i. Tagajärg: admin P-vaates näeb kliendi UI-d, aga API-limiidid (nt artefakti allikdokumentide max, salvestuskvoot) arvutatakse SOCIAL_WORKER-ina. Eelvaade „valetab". Raskus: **madal** (ainult adminit eksitav); parandus kuulub paketti RV-P2 (ptk 10).
- **K2 — rollivärav ei austa vaaterolli sümmeetriliselt.** Tööheaolu ja Kovisiooni väravad lasevad admini läbi ka P/T-vaates (`admin → true`), st admin ei koge kunagi väravat, mida päris pöörduja/teenuseosutaja kogeb. Sama põhjus, sama raskus: **madal**.
- **K3 — `?role=ALL` vestluste loendis.** [conversationRoles.js:8-15](../../lib/chat/conversationRoles.js): ka mitte-admin võib `?role=ALL`-iga saada rollifiltrita loendi. Kuna päring on alati `userId: auth.userId` all ([conversations/route.js:143](../../app/api/chat/conversations/route.js)), paljastuvad ainult kasutaja ENDA teise rolli-sildiga vestlused (nt rollimuutuse eelne ajalugu). Leke puudub; disainiotsusena tasub fikseerida, kas see on taotluslik. Raskus: **info**.

---

## 6. Neli rollimehhanismi ja kolme olukorra eristus (küsimus 8)

Kasutaja palus eristada kolme olukorda; koodis on tegelikult **neli** mehhanismi:

| # | Mehhanism | Kandja | Kes saab kasutada | Olemus |
|---|---|---|---|---|
| M1 | **Päris roll** | `User.role` (+`isAdmin`) andmebaasis, sessioonis | kõik | konto püsiomadus; määratakse registreerumisel ([app/api/register/route.js:174](../../app/api/register/route.js)); rollivahetuse UI-d tavakasutajal EI OLE |
| M2 | **Admini vaate-eelvaade** | httpOnly-küpsis `sotsiaalai_admin_view_role` | ainult admin | S/P/T lüliti; muudab sisu-vaatenurka ka serveris (ptk 5.1), õigusi mitte |
| M3 | **URL-i rollisoov** `?workspaceRole=` | query-parameeter | kõik sisselogitud (piiratud toimega) | [WorkspaceFeaturePage.jsx:95-100](../../components/workspace/WorkspaceFeaturePage.jsx): mitte-adminil AINUS toime `pre_inquiries` + `CLIENT` → „koostan pöörduja vaatest" režiim (spetsialist täidab kliendi eest); adminil seemneb S/P/T algväärtuse |
| M4 | **Komponendi-prop `roleOverride`** | JSX prop | koodi sisemine | Töölaud annab Teekonnale `roleOverride="CLIENT"` adminile ([WorkspacePanel.jsx:581](../../components/chat/WorkspacePanel.jsx)) — Teekond on alati pöörduja-kogemus |

Vastavus kasutaja kolmele olukorrale:

- **„Päris rollivahetus"** — platvormil PUUDUB. Ükski kasutaja ei saa oma `User.role`-i ise vahetada (ainult registreerumisel valik; hiljem vaid admin-tööriistade/DB kaudu). See on teadlik ja õige: rollid kannavad õigusi ja andmenähtavust.
- **„Administraatori ajutine vaate-eelvaade"** — M2, ainus päris „rollivahetaja" tänases koodis. Küpsisepõhine, 30 päeva, DB-d ei puuduta.
- **„Kujunduslik/demo-roll"** — M3 ja M4 on selle sugulased: UI-vaatenurga valikud, millel pole mingit õigusjõudu. Neid ei tohi tulevases ühises mudelis M2-ga segi ajada (vt ptk 10 leping).

---

## 7. Rollipõhiste vaadete lehemaatriks (küsimused 6, 7, 10)

Veergude selgitus: **Mõjutab?** = kas roll muudab sisu/toiminguid/navi/andmeid/tööjärge sellel pinnal; **Lüliti?** = kas admini S/P/T eelvaatelüliti peab siin nähtav olema; **Asukoht** = soovitatud paigutus (VA = vasak alanurk); **Server-piir** = autoriseerimispiir, mis peab kehtima sõltumata UI-st.

| Leht / moodul | Mõjutab? Mis muutub rolliti | Rollid, mida pind tunneb | Lüliti? | Asukoht | Serveripoolne piir | Riskimärkus |
|---|---|---|---|---|---|---|
| **Töölaud** (vestlusaknas, `WorkspacePanel`) | JAH — kaardiruudustik on kolmes rollis eri koosseisuga ([workspaceDashboardCards.js:123-353](../../lib/workspaceDashboardCards.js)): P = Teekond+Teenusekaart, abisoovid/-pakkumised, Eelpöördumine+Koosta dokument, Lisa inimene; S = + Dokumendid, Kovisioon, Tööheaolu, Materjalid; T = + Teenuseprofiil, Pöördumised, Materjalid (Kovisiooni/Tööheaolu kaarte T-real EI OLE) | CLIENT / SOCIAL_WORKER / SERVICE_PROVIDER | **JAH (on olemas)** | VA (praegune, jääb) | kaartide sihtlehed väravavad ise | dashboardRole on lokaalne optimistlik olek; tõde tuleb `/api/profile`-st |
| **Vestlus** (`/vestlus`, ChatBody) | JAH — süsteemiprompt, vastuse pikkus, RAG-sihtrühm, vestluste rollisildid; vestlusrollid on ainult C/S (SERVICE_PROVIDER kukub S-iks, [conversationRoles.js:4](../../lib/chat/conversationRoles.js)) | CLIENT / SOCIAL_WORKER (+admin ALL-loend) | JAH — muidu ei saa admin klientvestlust testida | VA; EI tohi katta komposeri ega ruumidoki ala | vestluse kirjutusroll sessioonist; ruumisõnumid liikmesusega | K3 (`?role=ALL`) — info |
| **Teekond** (`/teekond` → `?workspace=journey`; `[id]` detail) | JAH — pind on pöördujakeskne; spetsialist/teenuseosutaja näevad jagatud konteksti (`isProviderAudience` tekstid [WFP:572-640](../../components/workspace/WorkspaceFeaturePage.jsx)); adminil sunnitud CLIENT (M4) | CLIENT (omanik); S/T kui vaatajad jagamise kaudu | **EI** (M4 katab); kui lüliti tuleb globaalseks, siis siin peidetud/keelatud olekus | — (faasiriba/ruumidokk hõivavad alaservad — vt ptk 8) | teekonna andmed omaniku `userId` järgi; jagamised eraldi võtmetega | shareKeys-kitsaskoht dokumenteeritud eraldi analüüsis (teekond-eelpoordumine-ux) |
| **Eelpöördumine / Pöördumised** (`/eelpoordumised`) | JAH — sama marsruut, kaks eri toodet: P = „Eelpöördumine" (koostamine), S/T = „Pöördumised" (saabunud/saadetud postkast); pealkirjad/ikoonid Töölaua kaardil rollipõhised | kõik kolm + M3 (`?workspaceRole=CLIENT` spetsialistile) | **JAH — V1 tähtsaim taastamiskoht** (siin oli see varem, praegu DOM-is stiilimata) | VA | nähtavus `listVisiblePreInquiries(userId)` — puhtalt userId, MITTE rolli järgi ([lib/preInquiries.js](../../lib/preInquiries.js), [route.js:36](../../app/api/pre-inquiries/route.js)) | rollivahetus siin EI avarda andmeid — ainult UI-vaadet; ohutu |
| **Teenusekaart** (`/teenusekaart`) | OSALISELT — kaart+kuulutused on kõigile; admini S/P/T valik elab filtripaneelis (CTA-d ja vaatenurk muutuvad); teenuseosutajal seos oma profiili/kuulutustega | kõik kolm | JAH (ühtlustada: praegu filtripaneeli sees, mitte lehe nurgas) | VA või filtripaneeli päis — mitte mõlemad | kuulutuste loend avalik sisselogitutele; V4-kaardiviga (võtab suvalise kuulutuse) dokumenteeritud teenusekaardi-analüüsis | eksitusrisk madal |
| **Teenuseprofiil** (`/teenuseprofiil`) | JAH — sisuline omanik on SERVICE_PROVIDER; teised rollid näevad tühja/piiratud vormi; serveripoolset rolliväravat lehel EI OLE | SERVICE_PROVIDER (omanik) | JAH (T-vaate testiks) | VA | profiiliandmed `userId` järgi; **puudub lehe-tasemel rollivärav** — kaaluda | tooteotsus TO-4 (ptk 11) |
| **Abisoovid / Abipakkumised** (paneelid Töölaual + kaardil) | EI rollipiira — kõik rollid näevad ja loovad; sisu sama, sisenemispunktid erinevad | kõik | kaudselt (Töölaua kaudu olemas) | — (paneelisisene) | oma mustandite/kuulutuste leke V1/V2 — **juba dokumenteeritud ja paranduses** (`fable/help-listings-privacy-p0`) | vt teenusekaardi-analüüs |
| **Dokumendid** (`/documents`) | JAH — CLIENT suunatakse `/dokreziim`-i (serveris!); S/T näevad teeki; UI-s `isClientRole` early-return tühja kestaga ([DocumentsPage.jsx:511-521](../../components/documents/DocumentsPage.jsx)) | SOCIAL_WORKER / SERVICE_PROVIDER (CLIENT välistatud) | JAH (taastada) | VA | lehe redirect kasutab küpsise-resolverit; **API-d sessioonipõhist** → K1 ebakõla | K1 — madal |
| **Dokumendi koostamine** (`/dokreziim`, AgentModePage) | JAH — dokumenditüübid/limiidid rollist ([documentOrchestration](../../lib/chat/documentOrchestration.js), artifacts-API-d); CLIENT-il kitsam valik | kõik kolm | JAH (taastada) | VA | artifacts-API-d `effectiveRoleFromSession` → K1 | K1 — madal |
| **Vestlusruumid** (`/ruum`, `/room/[roomId]`) | VÄHE — ruumiõigused on liikmesuspõhised (omanik/liige), mitte platvormirollist; rollisilte ruumis ei vahetata | liikmesus | EI (müra; ruumidokk hõivab alaserva) | peidetud | liikmesuskontroll serveris ([requestBootstrap.js:211](../../lib/chat/requestBootstrap.js)); admin möödub | — |
| **Kovisioon** (`/kovisioon`, `/lopetatud-juhtumid`, `/parimad-praktikad`) | JAH väravana — S ja T pääsevad, P mitte; sees rollierisusi vähe | SOCIAL_WORKER / SERVICE_PROVIDER | EI V1-s (värav käib päris rolliga; P-vaate eelvaade tähendaks väljaviskamist — vajab TO-2 otsust) | peidetud kuni TO-2 | `canUseCovisionRole(role, admin)` — **päris roll, küpsist ei loe** | K2 — madal |
| **Tööheaolu** (`/tooheaolu`) | JAH väravana — SOCIAL_WORKER-only (+admin); alumine faasiriba on pinna oma UI | SOCIAL_WORKER | EI V1-s (sama loogika mis Kovisioonil) + **VA on hõivatud faasiriba poolt** | peidetud VÕI doki osa (ptk 8) | `canUseWellbeingRole(effectiveRole, isAdmin)` | K2 — madal |
| **Materjalid** (`/materjalid`) | OSALISELT — leht väravata; kvoot rollist ([materials/route.js:209-210](../../app/api/materials/route.js)); Töölaual kaart ainult S/T ridades | kõik (de facto), S/T (kavatsuslikult?) | JAH kui leht jääb rollitundlikuks | VA | üleslaadimiskvoot sessioonirollist | tooteotsus TO-5: kas CLIENT peaks üldse pääsema? |
| **Adminiala** (`/admin/*`) | EI — adminipind on rolliülene; S/P/T eelvaade siin mõttetu | ADMIN | **EI — kunagi** (segadusoht: admin arvab, et haldab P-vaates „kliendina") | peidetud | `assertAdmin`/`requireAdminRagAccess` päris sessioonist | — |
| **Profiil** (`/profiil`) | VÄHE — kuvab rolli sildina (`profile.role.*`); vahetus-UI puudub | kõik | EI (aga profiilimenüü on kandidaat lüliti TEISEKS koduks, ptk 8) | — | — | — |

**Vastus küsimusele 6 kokkuvõtlikult:** rolliti erinevad (a) **sisu** — Töölaua kaardid, eelpöördumise vs pöördumiste UI, chat-prompt ja RAG-allikad, dokumenditeegi olemasolu; (b) **lubatud toimingud** — dokumendi-artefaktide limiidid, materjalikvoot, kovisiooni/tööheaolu sissepääs; (c) **navigeerimine** — Töölaua kaardikomplekt ongi peanavigatsioon, seega roll = navigatsioonipuu; (d) **andmete nähtavus** — RAG-sihtrühmafilter ja vestluste rollisildid; pöördumiste andmed on rolliüleselt userId-põhised; (e) **tööjärg** — eelpöördumise koostaja-voog (P) vs postkasti-voog (S/T), dokumendivoo kitsendused CLIENT-ile.

---

## 8. Asukohaanalüüs: millal sobib vasak alanurk, millal midagi muud (küsimus 9)

Tänane alaserva-inventuur: vestluspinnal on alumises servas **komposer** (keskel; nurgad vabad); nurga-orbid ☰/✕ ja ⓘ hõivavad **üla**nurgad ([chat.css:678](../../app/styles/chat.css), [workspace.css:66-79](../../app/styles/workspace.css)); Töölaua paneeli alumine vasak nurk on juba lüliti päralt ja alumine polster reserveerib sellele ruumi ([workspace.css:20-35](../../app/styles/workspace.css)). Sõnasõnalist „ruumidokki" ega faasiriba aktiivses koodis veel EI OLE — need on kavandatud (heaolu-faasiteekonna dokk-stiilis jaamariba; supervisiooni ruumiline teekond) ja tuleb lepinguga ette arvestada.

Reeglistik:

| Olukord | Otsus |
|---|---|
| Tööpind ilma alumise ribata (Töölaud, `/eelpoordumised`, `/documents`, `/dokreziim`, `/teenusekaart`, vestlus) | **Vasak alanurk (VA)** — paneeli- või vaateankruga, `env(safe-area-inset-*)` teadlik; z-index üle sisu, alla modaalide |
| Pinnal on/tuleb alumine faasiriba või dokk (Tööheaolu vormivood, heaolu-faasiteekond, ruumiline teekond) | lüliti **doki osa** (vasak ots) VÕI peidetud selle pinna ajaks; kaks eraldi alumist juhtelementi samas servas on keelatud |
| Kovisiooni lõuend (canvas, 0 kerimist — lõuendireegel) | peidetud; kui TO-2 otsustab väravasimulatsiooni, siis naaseb lülitiga kesta, mitte lõuendile |
| Lehe päis / parem ülanurk (vana prod-paigutus) | **mitte taastada** — võistleb ✕/ⓘ orbidega, mis on uues keeles ülanurkade omanikud |
| Profiilimenüü | teisene kodu: **püsiva vaikevaate** valik (mitte kiirlüliti) + selge indikaator „Vaatad pöördujana" |
| Teekond, ruumid, admin, avalikud/auth-lehed | peidetud (Teekonnal katab M4; ruumides pole rollil tähendust; adminis tekitaks segadust) |
| Mobiil | VA on kitsas; V1-s võib lüliti mobiilis peita (Töölaud välja arvatud) — TO-7 |

---

## 9. Fail-closed leping (küsimus 11)

Normatiivne leping, mille vastu iga tulevane muudatus tuleb üle vaadata:

1. **Õigusotsused loevad AINULT päris sessiooni.** `assertAdmin`, omanikukontrollid (`userId`), ruumiliikmesus, tellimusevärav — mitte ükski neist ei tohi kunagi lugeda vaaterolli (küpsist, query-parameetrit, propi). Tänane kood vastab sellele.
2. **Vaaterolli küpsis kehtib ainult siis, kui `isAdmin(session)` on tõene.** Invariant on koodis olemas ([lib/authz.js:32](../../lib/authz.js)); hoida regressioonitestiga (mitte-admin + käsitsi kirjutatud küpsis → küpsis ignoreeritakse).
3. **Vaateroll tohib sisu ainult kitsendada või ümber suunata, mitte kunagi avardada üle päris rolli.** Adminil on see definitsiooni järgi ohutu (admin näeb nagunii kõike). Kui kunagi antakse vaatevahetus mitte-adminile (nt topeltrolliga kasutaja), tuleb enne kirjutada eraldi õigusdisain — tänast küpsisemehhanismi EI TOHI lihtsalt lahti keerata.
4. **Kliendi saadetud rolli (body/query/header) ei usaldata üheski õigus- ega andmeotsuses.** Lubatud kasutus: UI-eelistuse seeme (M3) ja admini kirjutusrolli valik — alati normaliseerituna lubatud hulka (`normalizeAdminViewRole`, `normalizeConversationRole` mustrid).
5. **Iga pind deklareerib rollikäitumise eksplitsiitselt.** Ühises mudelis (ptk 10) on pinnaregister; deklareerimata pinnal on lüliti vaikimisi PEIDETUD — nähtavus on samuti fail-closed.
6. **Väravad ja limiidid ühest allikast.** Sisuvalikud (mida näidata) võivad kasutada `resolveSessionRoleState`-i; õigused (mida lubada) käivad päris sessiooni järgi. Kahe eri „effective role" resolveri paralleelelu (K1) tuleb lõpetada, et leping oleks kontrollitav.
7. **Testid kui lepingu valve:** (a) view-role API → 401/403 mitte-adminile; (b) mitte-admin küpsisega → `resolveSessionRoleState.adminViewRole === null`; (c) `POST /api/chat/conversations` `body.role=SOCIAL_WORKER` CLIENT-ilt → kirje roll CLIENT; (d) admin P-vaates → `assertAdmin` marsruudid endiselt avatud (õigused ei kahane — eelvaade ei tohi adminit lukustada admin-API-dest välja).

---

## 10. Ühtne rollivahetaja mudel ja teostusjärjekord (küsimus 12)

### 10.1 Sihtmudel: üks `RoleViewControl`, üks pinnaregister

Praegu on lüliti „copy-paste neljas kohas, CSS ühes kohas". Sihtmudel:

```
lib/roleView/surfaceRegistry.js      ← deklaratiivne pinnaregister
  { surface: "workspace",       show: true,  anchor: "panel-bottom-left" }
  { surface: "pre_inquiries",   show: true,  anchor: "viewport-bottom-left" }
  { surface: "documents",       show: true,  anchor: "viewport-bottom-left" }
  { surface: "document_drafting", show: true, anchor: "viewport-bottom-left" }
  { surface: "service_map",     show: true,  anchor: "viewport-bottom-left" }
  { surface: "chat",            show: true,  anchor: "viewport-bottom-left" }
  { surface: "journey",         show: false, reason: "M4 roleOverride" }
  { surface: "wellbeing",       show: false, reason: "faasiriba/dokk; TO-2" }
  { surface: "covision",        show: false, reason: "värav päris rolliga; TO-2" }
  { surface: "rooms" | "admin", show: false }

components/roleView/RoleViewControl.jsx   ← AdminRoleViewCycleButton + ankrustiilid + indikaator
```

Põhimõtted: (a) lüliti on **üks** komponent ühe CSS-lepinguga (`--viewport-bottom-left` ankur + paneeliankur Töölauale); (b) registrist puuduv pind = peidetud (leping p5); (c) lülitiga käib kaasas **indikaator** — kui `isRoleViewActive`, näita silti „Vaatad pöördujana/teenuseosutajana" + üks klõps tagasi (küpsise kustutus on API-s juba olemas: tühi `viewRole`); (d) alumise doki tulekul pind vahetab `anchor`-i väärtuseks `dock-slot`, mitte ei lisa teist elementi.

### 10.2 Teostuspaketid (väikesed, iseseisvalt tarnitavad)

| Pakett | Sisu | Puudutab | Riskiaste |
|---|---|---|---|
| **RV-P0 — nähtavuse taastamine** | Lisa positsioneeriv CSS `.admin-role-view-cycle`-ile standalone-pindadel (eelpöördumised, documents, dokreziim) vasakusse alanurka; teenusekaardil ühtlusta `.service-map-admin` sama ankru peale. AINULT CSS + (vajadusel) className-tagastus kolmes JSX-kohas. Loogikat, API-t, skeemi ei puutu | [workspace.css](../../app/styles/workspace.css) (+3 JSX-faili className) | väga madal |
| **RV-P1 — konsolideerimine** | `RoleViewControl` + pinnaregister; 4 kasutuskoha asendus; „Vaatad …-na" indikaator + kiirväljumine; Töölaua paneeliankur jääb | components/roleView/*, 4 kasutuskohta | madal |
| **RV-P2 — eelvaate täpsus** | K1: documents/materials API-d ja `/dokreziim` värav küpsise-resolverile (AINULT sisu/limiitide valikuis); K2: kovisiooni/tööheaolu väravad austavad admini vaaterolli (TO-2 otsuse järgi); leping p7 testid | lib/authz kasutuskohad, 2 väravat, testid | keskmine (vajab TO-2/TO-3) |
| **RV-P3 — puhastus ja kindlustus** | M3 (`?workspaceRole`) dokumenteerimine + kitsendus (ainult pre_inquiries); TO-6 otsus `?role=ALL` kohta; surnud prod-CSS-i jäänukite eemaldus; fail-closed regressioonipakett tervikuna | testid, väikepuhastus | madal |

Järjekord on range: P0 → P1 → P2 → P3. P0 ja P1 ei vaja ühtegi tooteotsust; P2 vajab TO-2/TO-3; migratsioone ei vaja ükski pakett.

---

## 11. Lõpetuseks

### STATUS: COMPLETE

Kõik 12 kontrollpunkti on kaetud (1→ptk 3; 2→ptk 3.4; 3→ptk 4; 4→ptk 5; 5→ptk 2; 6→ptk 7; 7→ptk 7; 8→ptk 6; 9→ptk 8; 10→ptk 7; 11→ptk 9; 12→ptk 10). Rakenduskoodi, skeemi ega migratsioone ei muudetud; analüüs oli koodi- ja ajaloopõhine (runtime-kontrolli ei tehtud — brauseripaani screenshot-piirang ja LoginTempToken-rada on teadaolevad, vt mälu).

### Soovitatud V1 leheloend (kus lüliti on nähtav)

1. **Töölaud** — olemas, jääb (paneeli VA);
2. **/eelpoordumised** — taastada (viewport-VA); tähtsaim, sest P vs S/T kogemus erineb kõige rohkem;
3. **/documents** — taastada (viewport-VA);
4. **/dokreziim** — taastada (viewport-VA);
5. **/teenusekaart** — ühtlustada filtripaneelist VA-ankrule;
6. **/vestlus** (chat) — uus lisandus (kui tooteomanik kinnitab; chat on rollitundlikem pind üldse — prompt, RAG, pikkus).

V1-s teadlikult peidetud: Teekond (M4), Tööheaolu ja Kovisioon (värav + tulevane dokk; TO-2), ruumid, Materjalid (kuni TO-5), adminiala, profiil, mobiil (TO-7).

### Taastatavad varasemad komponendid/CSS (viited täpsete failiversioonidega)

- `prod/main:app/styles/features/documents/ui.css` read 102–140 — `.documents-admin-role-menu`, `--viewport`, nupu klaasistiil;
- `prod/main:app/styles/features/service-map/desktop/base.css` read 1253–1348 — `.workspace-feature-admin-role`, `--floating`, `--viewport`, hover/teemad;
- className-mustrid: `prod/main:components/documents/DocumentsPage.jsx:553`, `…agent/AgentModePage.jsx:1654`, `…workspace/WorkspaceFeaturePage.jsx:4859`.

NB: need on **referents**, mitte copy-paste sihtmärk — vana paigutus oli parem ÜLA-nurk ja vana nupp oli üksik tsükkelnupp; uus leping on VA + kolme nupu rühm.

### Mis tuleb uuesti ehitada (mitte taastada)

- VA-ankru CSS (`viewport-bottom-left`, safe-area, z-kiht) — vana koodi selleks pole;
- `RoleViewControl` + pinnaregister (RV-P1) — uus;
- „Vaatad …-na" indikaator ja kiirväljumine — uus;
- doki-slot ankur (heaolu-faasiteekonna/ruumilise teekonna jaoks) — uus, ehitatakse alles koos dokiga.

### Tooteomaniku otsused (enne RV-P2)

- **TO-1:** kas rollivahetus jääb ainult admini eelvaateks või tuleb kunagi mitmerollisus päris kasutajaile? (Määrab, kas M2 arhitektuur vajab õigusdisaini laiendust — leping p3.)
- **TO-2:** kas admini eelvaade simuleerib ka VÄRAVAID (P-vaates Tööheaolu/Kovisioon/dokumenditeek peidus või „siin oleksid väljas" märkega) või ainult sisu?
- **TO-3:** kas dokumentide/materjalide API-limiidid peavad järgima vaaterolli (K1 ühtlustamine)?
- **TO-4:** Teenuseprofiili serveripoolne rollivärav — blokeerida P/S või näidata selgitust?
- **TO-5:** kas Materjalid on S/T-only (Töölaud arvab nii, leht mitte)?
- **TO-6:** kas `?role=ALL` vestluste loendis jääb mitte-adminile?
- **TO-7:** mobiilikäitumine — peita või profiilimenüüsse?

### Esimene teostatav koodipakett: RV-P0 (täpne retsept)

1. [app/styles/workspace.css](../../app/styles/workspace.css) — lisa üldankur (paneelireegli kõrvale):
   `body :where(.workspace-feature-admin-role-standalone) .admin-role-view-cycle { position: fixed; left: calc(env(safe-area-inset-left, 0px) + clamp(1rem, 2.6vw, 2.2rem)); bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(0.5rem, 1.2lvh, 0.9rem)); z-index: 92; }` (täpne selektor lahtine — võib ka otse `className`-iga);
2. [components/workspace/WorkspaceFeaturePage.jsx:4825](../../components/workspace/WorkspaceFeaturePage.jsx) — anna `AdminRoleSelector`-ile `className` tagasi (standalone-haru);
3. [components/documents/DocumentsPage.jsx:525](../../components/documents/DocumentsPage.jsx) ja [components/agent/AgentModePage.jsx:1610](../../components/agent/AgentModePage.jsx) — sama `className`;
4. [WorkspaceFeaturePage.jsx:3126](../../components/workspace/WorkspaceFeaturePage.jsx) — teenusekaardi `.service-map-admin` üleviimine samale ankrule;
5. kontroll: adminiga kõigil neljal lehel lüliti VA-s; mitte-adminil mitte kusagil; `npm test` (tekstikontraktid) roheline.

Hinnanguline maht: ~40–60 rida CSS-i + 4 väikest JSX-muudatust; migratsioone ega API-muudatusi ei ole.


---

## 12. TEOSTUS 16.07 — RV-P0 tehtud ja runtime-tõendatud

Tellija täpsustus analüüsi järel: *„pane kõikidele lehtedele, kus on rollid ja kus on vaja admin kasutajal muuta rolle, et näha erinevust, ekraani alla paremasse nurka või kuhugi nähtavasse kohta. S, P ja T tähega väikesed nupud."*

**Asukohaotsus muutus:** vasak alanurk (ptk 8) → **ekraani alumine PAREM nurk**, üks ja sama koht igal rollilehel. Ülanurgad on ⓘ/×/☰ orbide päralt, alaserv keskel on komposeri ja kerimisorbi päralt — parem alanurk oli ainus vaba nurk kõigil pindadel.

### 12.1 Mis muutus (5 faili + 1 uus)

| Fail | Muutus |
|---|---|
| [app/styles/workspace.css](../../app/styles/workspace.css) | Töölaua-spetsiifiline `.workspace-dashboard-panel > .admin-role-view-cycle` (absolute, vasak all) → **üks globaalne reegel** `.admin-role-view-cycle` (fixed, parem all, safe-area, z-92). Selektor on lai meelega: mähis tuleb ainult `AdminRoleViewCycleButton`'ist, seega üks reegel katab kõik kutsekohad. + mobiili-tõste `--role-switch-bottom: 5.2rem` vestluspinnal. Töölaua paneeli alumine polster taastatud committitud väärtusele (reserveeris ruumi lülitile, keda seal enam ei ole) |
| [components/workspace/AdminRoleViewCycleButton.jsx](../../components/workspace/AdminRoleViewCycleButton.jsx) | **Portaal `<body>`'sse** (`createPortal`, SSR-vali) + **`router.refresh()`** pärast rollivahetust |
| [components/workspace/RoleViewSwitcher.jsx](../../components/workspace/RoleViewSwitcher.jsx) | **UUS** — iseseisev mähis vestluspinnale (`useEffectiveRole` sees, ei nõua propse) |
| [components/alalehed/chat/ChatBodyView.jsx](../../components/alalehed/chat/ChatBodyView.jsx) | `<RoleViewSwitcher />` vestlusevaates (`showChatInterface && isAdmin && !isRoomMode`) |
| [components/workspace/WorkspaceFeaturePage.jsx](../../components/workspace/WorkspaceFeaturePage.jsx) | `showAdminRoleSelector` + `service_profile` (teenusekaart teadlikult VÄLJAS — tal on oma lüliti kaardi juhtribas, muidu kaks) |
| [components/chat/WorkspacePanel.jsx](../../components/chat/WorkspacePanel.jsx) | `showRoleMenu` väravaks lisatud `visible` (portaalitud last ei peida enam vanema `display:none`) |

### 12.2 Kaks päris viga, mis teostuse käigus leiti ja parandati

- **V1 — `position: fixed` lõks (BLOKEERIV, parandatud).** `.panel` saab lehe avanedes `panel-enter` **transformi** ([panel.css:17-22](../../app/styles/panel.css)) → transformitud esivanem muutub `fixed`-elemendi sisaldusplokiks. Mõõdetud: lüliti ankurdus paneelile (`gapRight: 287` oodatud 20 asemel) ja oleks 0.56s pärast ekraani nurka hüpanud. **Parandus:** portaal `<body>`'sse. Vana kommentaar WorkspacePanel'is („stiilimata portal jättis lehele nähtamatuid artefakte") käis stiilita portaali, mitte portaali kui tehnika kohta — globaalse `.admin-role-view-cycle` reegliga probleemi ei ole. Kinnitatud: `parent: body`, `gapRight: 20`, `gapBottom: 20` kõigil pindadel.
- **V2 — vaikiv vaateroll (parandatud).** Ilma `router.refresh()`-ita kirjutas lüliti küpsise, aga serveri-komponendid jäid vana rolli sisuga → admin klikiks S/P/T ja **midagi ei juhtuks**. Kõige valusam `/documents`-il, kus CLIENT-vaade peab suunduma `/dokreziim`-i. Kinnitatud pärast parandust: klikk „P" `/documents`-il → `effectiveRole: CLIENT` → **leht suunas `/dokreziim`-i**.

Kõrvalleid (mitte viga): `.admin-role-view-cycle` leidub DOM-is 2×, aga teine elab React'i striimimise hoidikus `div[id^="S:"]` mille `display: none` ja `checkVisibility() === false` — dev-režiimi SSR-artefakt, mitte duplikaat.

### 12.3 Runtime-tõendid (admin `claude.admin@sotsiaal.ai`, ajutine login-token, hiljem kustutatud)

| Pind | Lülitid nähtaval | Asukoht | Tulemus |
|---|---|---|---|
| `/eelpoordumised` | 1 | `body`, 20/20 | ✅ S* P T, katmata |
| `/documents` | 1 | `body`, 20/20 | ✅; klikk P → **redirect `/dokreziim`** |
| `/dokreziim` | 1 | `body`, 20/20 | ✅ P* püsis üle lehevahetuse |
| `/teenusekaart` | 1 | `body`, 20/20 | ✅ (varem filtripaneeli sees peidus) |
| `/teenuseprofiil` | 1 | `body`, 20/20 | ✅ uus pind |
| `/vestlus` | 1 | `body`, 20/20 | ✅ komposeriga ei kattu (komposer lõpeb 905px, lüliti algab 1148px) |
| `/vestlus` mobiilis 375×812 | 1 | tõste 5.2rem | ✅ `overlapsComposer: false` |
| **Töölaud** `?workspace=1` | 1 | `body`, 20/20 | ✅ **kaardid vahetuvad kohe** (allpool) |
| `?workspace=journey` | **0** | — | ✅ õige (M4 sunnib CLIENT-i) |
| `/admin/rag` | **0** | — | ✅ õige |

**Töölaua kaardiruudustik rolliti (mõõdetud, mitte oletatud):**
- **P:** Teekond, Teenusekaart, Abisoovid, Abipakkumised, Eelpöördumine, Koosta dokument, Lisa inimene
- **S:** Abisoovid, Abipakkumised, Dokumendid, Koosta dokument, Pöördumised, Lisa inimene, Kovisioon, Tööheaolu, Materjalid, Teenusekaart
- **T:** Abisoovid, Abipakkumised, Teenusekaart, **Teenuseprofiil**, Dokumendid, Koosta dokument, Pöördumised, Lisa inimene, Materjalid (Kovisioon/Tööheaolu puuduvad)

**Fail-closed leping (ptk 9) tõendatud päris tavakasutajaga** (CLIENT `isAdmin: false`, kellel oli seansist alles admini `sotsiaalai_admin_view_role` küpsis väärtusega `SERVICE_PROVIDER`):

| Kontroll | Tulemus |
|---|---|
| `serverEffectiveRole` | **`CLIENT`** — küpsis IGNOREERITI (lekke korral oleks olnud `SERVICE_PROVIDER`) |
| `serverAdminViewRole` | `null` |
| Nähtavaid lüliteid | **0** |
| `PUT /api/profile/view-role` mitte-adminina | **403** |
| Küpsis JS-ile loetav | **ei** (httpOnly) |
| Nähtud kaardid | CLIENT-i komplekt (tema päris roll) |

Leping p1, p2, p4 kehtivad runtime'is. `npm test` **1222/1222**, eslint **0 viga**. Skeemi ega migratsioone ei puudutatud. Testi-DB koristatud (3 ajutist tokenit kustutatud, ajutine test-kasutaja uut ei loodud — kasutasin olemasolevat).

### 12.4 Teadlikult VÄLJA jäetud (ja miks)

- **Tööheaolu, Kovisioon** — väravad käivad **päris rolli** järgi ja lasevad admini alati läbi (`if (admin) return true`), seega S/P/T ei muudaks seal midagi: lüliti valetaks. Tuleb koos **TO-2**-ga (kas eelvaade simuleerib väravaid) paketis RV-P2.
- **Teekond** — M4 `roleOverride="CLIENT"` sunnib niikuinii pöörduja-vaate.
- **Materjalid** — roll mõjutab ainult kvooti serveris, UI-s erinevust pole (TO-5).
- **Ruumid, adminiala, profiil** — roll ei mängi / segadusoht.

### 12.5 Järgmine samm

**RV-P1** (ühine `RoleViewControl` + pinnaregister + „Vaatad …-na" indikaator) on nüüd väiksem kui analüüsis hinnatud: globaalne CSS-reegel ja portaal on juba paigas, puudu on registri-fail ja indikaator. **Teadaolev jääkpuudus:** `useEffectiveRole` ei ole jagatud kontekst — iga kutsuja hoiab oma koopiat, seega vestluspinnal rolli vahetades jääb `ChatBody` kliendipoolne `effectiveRole` vanaks (mõjutab ainult kohatäite/tervituse teksti; vestluse päris roll tuleb serverist küpsisest). Kontekstiks tõstmine kuulub RV-P1-le.

---

## 13. TEOSTUS 16.07 (II) — üks ⓘ marsruudi kohta + valgusruumi leke

Kaks tellija leidu samal päeval, mõlemad parandatud ja runtime-tõendatud.

### 13.1 Topelt ⓘ (tellija: „eemalda topelt info ikoonid… üks igal route lehel, sulge nupu kõrval vasakul, sama suur")

**Mõõdetud algseis** (`/vestlus?workspace=pre_inquiries` = tellija ekraanipilt): **2 ikooni, mõlemad VASAKUL, eri suurusega** (48×48 PanelFrame + 37×36 lehe oma), × aga paremal (1088). Kolm eraldi juurpõhjust:

1. **Duplikaat.** [PanelFrame](../../components/room/PanelFrame.jsx) renderdab marsruudi ⓘ JA leht renderdas oma (SubpageHeader `rightSlot`). Vana CSS-kaitse [workspace.css](../../app/styles/workspace.css) `.panel:not(:has(.panel-menu--info)) .dashboard-info-trigger:not(.panel-menu)` takistas teisel ainult **positsioneerumast**, ei peitnud teda → jäi sisuvoogu.
2. **Vale pool.** [panel.css](../../app/styles/panel.css) `.panel-scrim[data-conversation="1"] .panel-menu { left: … }` on spetsiifilisusega **(0,3,0)** ja võidab `.panel-menu--info { left: auto; right: … }` **(0,1,0)** üle → vestluspinnal (Töölaud + kõik `?workspace=X`) jäi ⓘ vasakusse nurka.
3. **Vale suurus.** Lehe oma ⓘ ei saanud vestluspinna 3rem orbi-mõõtu.

**Miks lihtne kustutamine EI kõlvanud:** lehepoolsed ⓘ-d ei olnud koopiad — nad kandsid sisu, mida marsruudikaart ei tea:
- `getWorkspaceFeatureInfoId` valib **rolli järgi**: pöördujale `pre_inquiry`, spetsialistile/osutajale `intake` (PanelFrame'i staatiline kaart annab alati `intake` → pöörduja oleks saanud vale teksti);
- `/documents` ⓘ kannab **elavat** raamistiku-lisapaneeli (`detailExtras`);
- `?workspace=X` sisu sõltub avatud moodulist;
- `/teekond/[id]` ja `/tooheaolu/[tool]` **puuduvad kaardist üldse** → kustutamine oleks ⓘ sealt kaotanud.

**Lahendus — [components/ui/PanelInfoSlot.jsx](../../components/ui/PanelInfoSlot.jsx) (uus):** kontekst, mille kaudu leht ütleb PanelFrame'i **ainsale** ⓘ-le, mida näidata. `usePanelInfoSlot({infoId, title, label, detailExtras, active})`; PanelFrame loeb `usePanelInfoSlotValue()`, langeb tagasi staatilisele kaardile. Provider mähib [app/layout.js](../../app/layout.js)-is PanelFrame'i **ja** lapsi.

| Fail | Muutus |
|---|---|
| `components/ui/PanelInfoSlot.jsx` | **UUS** — kontekst + `usePanelInfoSlot` / `usePanelInfoSlotValue` |
| `app/layout.js` | `<PanelInfoSlotProvider>` ümber PanelFrame'i |
| `components/room/PanelFrame.jsx` | ⓘ loeb pesa (`title`/`label`/`detailExtras`), `key={panelInfoId}` |
| `app/styles/panel.css` | `.panel-scrim[data-conversation="1"] .panel-menu--info` → `right: … + 3.5rem` (+ ≥769px haru) — võidab spetsiifilisuse-kaotuse |
| `WorkspaceFeaturePage`, `DocumentsPage`, `AgentModePage`, `MaterialsPage`, `JourneyDashboard`, `JourneyDetail`, `WellbeingPage`, `WorkspacePanel` | `rightSlot` ⓘ eemaldatud → `usePanelInfoSlot` |

**Leping:** `active: !embedded` — manustatud moodulis on ⓘ omanik Töölaud (WorkspacePanel). Erand: `JourneyDetail` (eraldi marsruut) registreerib tingimusteta.

**Teostuse käigus leitud ja parandatud viga:** `JourneyDashboard` registreeris algul **tingimusteta** → koos WorkspacePanel'iga kaks registreerijat ühte pessa = **võidujooks** (võitis see, kelle effect viimasena jooksis). Parandus: `active: !embedded`, nagu kõigil teistel.

`detailExtras` nõuab memoiseerimist (uus viide igal renderdusel → lõputu re-registreerimine); `DocumentsPage.frameworkInfoPanel` mähitud `useMemo`-sse.

### 13.2 „Imelikud helepruunid laigud" (tellija ekraanipilt: Grupivestlus)

**Juurpõhjus:** [chat.css](../../app/styles/chat.css) `.panel-scrim[data-conversation="1"] [data-chat-container]::before` — „Hajus valgusruum", **kolm sooja radiaali** (`rgba(225,155,105,.13)` @16% 22%, `rgba(252,211,171,.07)` @78% 58%, `rgba(188,105,62,.12)` @46% 97%) + `blur(12px)`. See on 12.07 vestluse-redisaini **teadlik** element (valgus mullide taga).

**Leke:** `data-conversation="1"` seatakse **igal** `/vestlus` teel (`isConversation = path.startsWith("/vestlus")`) — seega ka KÕIGIL töölauapindadel `?workspace=X` (Töölaud, kutsed, dokumendid, eelpöördumine, teekond…). Seal pole mulle, mille taga valgus elaks → kolm laiku paljal taustal.

**Parandus:** selektor → `[data-chat-container]:not(:has(.workspace-dashboard-panel))::before`. Töölaua-nägu elab sama konteineri sees, seega glow kaob täpselt siis, kui ruudustik/moodul on ees, ja **jääb alles päris vestluses**.

Tõendatud: `?workspace=invite` → `backgroundImage: none` **ja 0 sooja radiaali kogu lehel**; `?workspace=1`, `?workspace=journey` → glow kadunud; `/vestlus` → 3 radiaali + `blur(12px)` **alles**.

### 13.3 Runtime-tõendid (admin, ajutine token, hiljem kustutatud)

| Pind | ⓘ | × kõrval vasakul | Sama mõõt | Glow | Märkus |
|---|---|---|---|---|---|
| `/vestlus?workspace=pre_inquiries` (ekraanipilt) | **1** (oli 2) | ✅ vahe 8px | ✅ 48×48 | — | parandatud |
| `/eelpoordumised` | 1 | ✅ | ✅ | — | **sisu muutub rolliga**: T→„Pöördumiste vastuvõtt…", P→„Eelpöördumises saab alustada…" |
| `/vestlus?workspace=1` (Töölaud) | 1 | ✅ | ✅ | kadunud | |
| `/vestlus?workspace=invite` | — | — | — | kadunud, 0 sooja radiaali | tellija ekraanipilt |
| `/vestlus?workspace=journey` | 1 | ✅ | ✅ | kadunud | sisu „Teekond aitab…" |
| `/teekond/[id]` | 1 | ✅ | ✅ | — | **polnud kaardis** — registreerimiseta oleks ⓘ kadunud |
| `/tooheaolu` | 1 | ✅ vahe 8px | ✅ | — | |
| `/tooheaolu/kiirkontroll` | 1 | ✅ | ✅ | — | **tööriista sisu säilis**: „Kiirkontroll aitab kiiresti märgata…" |
| `/materjalid` | 1 | ✅ vahe 8px | ✅ | — | |
| `/dokreziim` | 1 | ✅ | ✅ | kadunud | |
| `/vestlus` (päris vestlus) | — (☰) | — | — | **alles** (3 radiaali) | kujundus säilis |

Rollivahetaja töötab edasi: nurgas 20/20 `body`-s, kaardid 10 (S) ↔ 7 (P), ⓘ 1. `npm test` **1222/1222**, eslint **0 viga**. Skeemi ega migratsioone ei puudutatud; testi-DB koristatud.

### 13.4 Teadlikult puutumata

- **`HelpListingsPanel`** ja **`InviteModal`** hoiavad oma ⓘ-d: Töölaual saavad nad `hideHeader` (ⓘ omanik = WorkspacePanel'i registreering), mujal on nad paneeli-sisesed ülekattekihid, mitte marsruudid. Duplikaati ei tekita.
- **`/vestlus`** (päris vestlus): ⓘ asemel ☰ (vestluste sahtel) — PanelFrame renderdab kas-või, seega kolmandat ikooni ei lisatud.
- `dashboardInfoTriggerCornerClassName` = tühi string, nüüd kasutusel ainult `HelpListingsPanel`-is → surnud abiline, kustutamine kuulub eraldi puhastusse.
