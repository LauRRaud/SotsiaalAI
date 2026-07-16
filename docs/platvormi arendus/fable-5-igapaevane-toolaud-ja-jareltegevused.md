# TÖÖLAUD-A0 — igapäevane töölaud, vastuvõtja järeltegevus ja teavitused

Read-only tervikanalüüs. Rakenduskoodi ei muudetud. Autor: Fable 5, 2026-07-16.

Skoobist väljas (ei korrata): PROF-A0 profiil/konto, RUUM-A0 ruumid ja kõnevoog, rollivahetaja tervikanalüüs, O-TK9 retention, RAG-i ja Teenusekaardi tervikanalüüsid.

---

## 0. Git-seis ja analüüsi baas

**Baas:** lokaalne `main` (HEAD `890124bd`, 2026-07-15). `origin/main` on 4 commiti võrra ees — kõik neli on RAG P8.0 dokumendi-/inventuurikommitid (`2a63fcd0`, `67c76899`, `0972fdf8`, `4c3fceb5`), skoobi failides erinevusi ei ole. Analüüsi väited kehtivad seega nii lokaalse kui origin/main-i kohta.

**Töökataloogis on committimata muudatused**, mis puudutavad skoobi faile: `components/chat/WorkspacePanel.jsx` (+53/−…), `components/workspace/WorkspaceFeaturePage.jsx`, `components/workspace/AdminRoleViewCycleButton.jsx` ning untracked `components/workspace/RoleViewSwitcher.jsx`, `components/ui/PanelInfoSlot.jsx`. Sisu: ⓘ-info kolimine PanelFrame'i slotti (`usePanelInfoSlot`), S/P/T lüliti portaalimine ja **`router.refresh()` lisamine vaaterolli vahetusse**. See viimane on sisuline parandus, mis **ei ole main-is ega ühelgi harul** — vt leid P2-1. Kus töökataloog erineb HEAD-ist, on allpool eraldi märgitud; vaikimisi kirjeldan main-i seisu.

**Ainult harudel (mitte main-is) elavad skoobiga seotud tööd:**

| Haru | Sisu | Seis |
|---|---|---|
| `origin/fable/help-listings-privacy-p0` + `codex/help-listings-privacy-p0-audit` | abikuulutuste V1+V2 privaatsuslekete server-side parandus (`lib/help/listingAccess.js`, `listingViews.js`, detail-GET ja globaalloendi fail-closed leping) | fix + sõltumatu audit olemas; **main-is lekked alles** |
| `origin/opus/u6-personal-search`, `codex/u6-independent-audit`, `codex/u6-p1-rereview` | U6 isiklik otsing: omanikuskoobiga serveriotsing (`lib/chat/conversationSearch.js`, `sidebarListState.js`, `ChatSidebar.jsx`, `app/api/chat/conversations/route.js`) | audit tegi 2 P1, need parandatud ja heaks kiidetud (`9c465922`) |
| `codex/u7-plain-language`, `opus/u7-independent-audit` | U7 selge keele režiim (`lib/chat/plainLanguage.js`, AccessibilityModal/Provider, chat route, süsteemipromptid) | „OPUS HEAKS KIIDETUD, 3 P2" (`8eb50912`) |
| `codex/role-aware-invite-copy` | U9 rollipõhine osalejakutse (`lib/invites/participantTypes.js`, `InviteModal.jsx`, `app/api/invites/route.js`, puudutab ka `WorkspacePanel.jsx` ja `workspaceDashboardCards.js`) | 1 commit, auditit ei leidu |
| `origin/fable/tooheaolu-e0` | Tööheaolu E0 detektoriparandus | tangentsiaalne (continuity `wellbeing_draft` allikas) |

U1 (teavituste vertikaal, `8e479886`) ja U2 (continuity + järgmise kontakti voog, `0afc2ff1`) **on main-is** ja produktsioonis dokumenteeritud (`736dde85`). `prod/*` harud on vana produktsiooniliini ajalugu, mitte aktiivne arendus.

Järeldus punktile 10: **U6, U7 ja U9 ei ole main-is üldse esindatud** — main-i `ChatSidebar`-is pole otsingut, selge keele režiimi pole kusagil, kutsevoog on rollivaba. Vanade dokumentide progressiprotsente ei tohi usaldada; tegelik seis on „valmis harul, mestimata".

---

## 1. Igapäevane maandumine rollide kaupa

Töölaud on vestlusakna „töölaua-nägu": `ChatBodyView.jsx:153-167` renderdab `WorkspacePanel`-i, kui `showWorkspaceFace` on tõene, `visible={workspaceSurfaceReady}`.

**Vaaterolli valik** (`WorkspacePanel.jsx:196-203, 445-448`): mitteadminil `userActualRole || userRole`, normaliseerituna `CLIENT | SOCIAL_WORKER | SERVICE_PROVIDER` hulka (tundmatu → `CLIENT`). Adminil `dashboardRole` olek, vaikimisi `SOCIAL_WORKER`, muudetav S/P/T lülitiga. `hasPaidAccess = isAdmin || subActive`.

**Kaardiread** (`lib/workspaceDashboardCards.js:123-353`):

- **Pöörduja (CLIENT):** Teekond+Teenusekaart → Abisoovid+Abipakkumised → Eelpöördumine*+Koosta dokument* → Lisa inimene*.
- **Spetsialist (SOCIAL_WORKER):** Abisoovid+Abipakkumised → Dokumendid*+Koosta dokument* → Pöördumised*+Lisa inimene* → Kovisioon*+Tööheaolu* → Materjalid*+Teenusekaart.
- **Teenuseosutaja (SERVICE_PROVIDER):** Abisoovid+Abipakkumised → Teenusekaart+Teenuseprofiil* → Dokumendid*+Koosta dokument* → Pöördumised*+Lisa inimene* → Materjalid*.

Tärniga kaardid on `requiresPaid` — ilma tellimuseta `disabled` + `aria-disabled` (`workspaceDashboardCards.js:5-10`, `WorkspacePanel.jsx` HEAD:632-636 / töökataloog:643-647). Pöördujal on seega ilma tellimuseta klikitavad ainult Teekond, Teenusekaart ja kuulutuste paneelid.

**Navigeerimine:** osa kaarte avab paneeli-sisese vaate (`EMBEDDED_WORKSPACE_FEATURES`, `WorkspacePanel.jsx:19-29`: documents, dokreziim, eelpoordumised, materjalid, teekond, teenuseprofiil, invite; URL-i lisatakse `?workspace=...`), osa teeb täislehe push'i (teenusekaart, tooheaolu, kovisioon — teadlik otsus 10.07, kommentaar `WorkspacePanel.jsx:23-24`). Popstate sünkroonitakse (`syncEmbeddedFeatureFromUrl`, rida 211-219), Escape viib tagasi (rida 434-443).

**Admini vaate-eelvaade** muudab kolme asja: (a) kaardiread vahetuvad `dashboardRole` järgi; (b) `JourneyDashboard` saab `roleOverride="CLIENT"` (rida 596); (c) `/eelpoordumised` pinnal valib `activeRole` selle, kas kuvatakse koostaja- või vastuvõtjavaade (`WorkspaceFeaturePage.jsx:4811-4815`). Lüliti PUT-ib `/api/profile/view-role` ja uuendab ainult kliendioleku (`AdminRoleViewCycleButton.jsx` HEAD-versioon, read 35-47) — **serverikomponendid jäävad vana rolli peale** (vt P2-1). Lisaks näitab admini vastuvõtjavaade `receiverInquiries = inquiries` kaudu ka admini *enda autoritud* kirjeid „Saabunud" nimekirjas (`WorkspaceFeaturePage.jsx:946`) — eelvaade pole puhas.

---

## 2. „Jätka siit" (continuity) — sisu tekkimine

Kett: `WorkspacePanel.jsx:364-396` → `GET /api/workspace/continuity` (`app/api/workspace/continuity/route.js:17-28`, sessioonipõhine, `no-store`) → `getWorkspaceContinuity(userId)` (`lib/workspaceContinuity.js:61-252`) → `WorkspaceContinuity.jsx` renderdab kuni 7 kirjet.

**Allikad ja prioriteedid** (väiksem = ülespoole):

| prio | kind | allikas (WHERE) | href |
|---|---|---|---|
| 0 | `next_contact` (üle tähtaja) | saadud eelpöördumine, `nextContactOn <= täna` (Tallinna kuupäev, rida 6-15) | `/eelpoordumised?openInquiry=…` |
| 1 | `practice_review` | `effectivePracticeReviewAssignment` ASSIGNED, lõpetamata | `/parimad-praktikad?practice=…` |
| 2 | `pre_inquiry_received` | `recipientOwnerId=user`, `recalledAt:null`, status SENT/READY | `/eelpoordumised?openInquiry=…` |
| 3 | `room_unread` | liikmesus + lugemata sõnumite count (rida 132-142) | `/vestlus?roomId=…` |
| 4 | `next_contact` (tulevane) / `service_availability` | `nextContactOn > täna`; PUBLISHED teenus, `availabilityCheckedAt` puudub/vanem kui 28 p | `/eelpoordumised…` / `/teenuseprofiil?profileId=…` |
| 5 | `pre_inquiry_draft` | enda DRAFT-id | `/eelpoordumised?openInquiry=…` |
| 6 | `wellbeing_draft` | kinnitamata heaolu-mustand | `/tooheaolu` |
| 7 | `journey` | enda ACTIVE teekonnad | `/teekond?journey=…` |

**Aegumine:** ainult `next_contact` kasutab kuupäevaloogikat; „üle tähtaja" tähendab `<= täna` (st täna tähtajaline on juba prioriteet 0 — ET tekst „Järgmine kontakt vajab tähelepanu" on selle jaoks aus). Muud kirjed ei aegu, vaid kaovad allika olekuga (ARCHIVED pöördumine kaob, sest continuity päring lubab ainult SENT/READY, rida 82-92).

**Deduplikatsioon:** sort + `href`-i järgi filtreerimine (rida 240-246). Sama pöördumise `next_contact` ja `pre_inquiry_received` jagavad href-i, seega kuvatakse üks (kõrgema prioriteediga). Märgid (`badgeCounts`, rida 48-59) loetakse *deduplikeeritud kogu* pealt (mitte ainult top-7) ja kuvatakse kaartidel `resolvedDashboardBadges` kaudu (`WorkspacePanel.jsx:450-456`) — serveri märgid võidavad prop'i. NB: `dashboardBadges` prop'i ei tooda ükski ülemkomponent (repo-grep: ainult pass-through `ChatBodyView.jsx:160`) — surnud tee, vt P3-5.

**Omandipiir:** iga alampäring on `userId`-skoobitud (authorId / recipientOwnerId / userId / reviewerId / providerProfile.ownerId). Rollifiltrit pole — sisu määrab omand, mitte roll; kliendile ei teki spetsialisti kirjeid, sest tal pole vastavaid ridu. Korrektne.

**Vigased lingid — kontrollitud sihtlehtede kaupa:**

- `/eelpoordumised?openInquiry=` — loetakse (`WorkspaceFeaturePage.jsx:1185-1226`), aga fallback-fetch aktsepteerib ainult autori kirjeid (`requestedInquiry.authorId !== currentUserId` → loobumine, rida 1208-1214). Vastuvõtja süvalink >100-kirje-lehe taha = vaikne no-op (P2-2).
- `/parimad-praktikad?practice=` — **`EffectivePracticesPage.jsx` ei loe `practice` parameetrit üldse** (grep: 0 vastet). Prioriteet-1 kirje klikk maandub üldloendisse (P1-1).
- `/teekond?journey=` — `JourneyDashboard.jsx` ei loe `journey` parameetrit (0 vastet); olemas oleks `/teekond/[id]` marsruut. Param ignoreeritakse (P1-1).
- `/teenuseprofiil?profileId=` — parameetrit ei loeta; leht laeb omaniku enda profiili, seega tulemus on juhtumisi õige (P3).
- `/vestlus?roomId=` — loetakse (`ChatBody.jsx:408-412`). Töötab.
- `/tooheaolu` — parameetrita, töötab.

**Laadimisstrateegia:** fetch käib igal `visible && !activeEmbeddedFeature` üleminekul (embedded-vaatest naastes värskendatakse), pollimist pole; `AbortController` katkestab. Katkine vastus → `status:"error"`.

---

## 3. Vastuvõtja eelpöördumiste töövoog

Marsruut `/eelpoordumised` (`app/eelpoordumised/page.jsx`) renderdab `WorkspaceFeaturePage feature="pre_inquiries"` → `PreInquiriesSurface` (`WorkspaceFeaturePage.jsx:666-2048`). Vastuvõtjavaade kuvatakse, kui `activeRole ∈ {SOCIAL_WORKER, SERVICE_PROVIDER}` (rida 945-947, 1857).

**Saabumine.** `GET /api/pre-inquiries` → `listVisiblePreInquiries` (`lib/preInquiries.js:592-604`, limit 100): nähtavad on enda autoritud + saadud (`visiblePreInquiryWhere`, rida 576-590: `recipientOwnerId=user`, `recalledAt:null`, saadetud). Vastuvõtt eeldab kas kasutaja `acceptsPreInquiries` opt-in'i (spetsialist; checkbox „Vastuvõtt" plokis, rida 1878-1906, `PUT /api/pre-inquiries/preferences`) või osutaja profiili `acceptsPlatformPreInquiries` (`resolveRecipient`, rida 447-505). Saatmisel läheb kohe best-effort teavitus-e-kiri ilma sisuta (`dispatchInternalArrivalEmail`, rida 1477-1487; sisupiirang kommenteeritud rida 1429-1434).

**Hindamine.** „Valitud eelpöördumine" plokk (rida 1957-1986): olukord, Teekonna jagatud info (audience-filter, rida 955-960), eelkaardistuse tekstieksport ja mustand read-only kujul; struktureeritud ülevaade `PreInquiryAssessmentReviewSection` (rida 2037-2045). Serialiseerimine peidab autori e-posti vastuvõtja eest (`serializePreInquiry`, `lib/preInquiries.js:548-554` — email ainult `isAuthor`); vastuvõtja-väljad (`receiverNote`, `receiverChecklist`, `nextContactOn`) serveeritakse ainult `isRecipient` korral (rida 565-572).

**Töömärkmed.** Kontroll-loend genereeritakse serveris hindamisseisust (`lib/preInquiryReceiverWorkflow.js:35-64` — riskisõnum ja puuduvad vastused muudavad punktide sõnastust), UI-s `receiverChecklistDraft` + sisemine märge + järgmise kontakti kuupäev (rida 1988-2035). Salvestus `PATCH /api/pre-inquiries/[id]/workflow` → `updatePreInquiryReceiverWorkflow` (`lib/preInquiries.js:1288-1360`): advisory-lock, `expectedUpdatedAt` CAS (rida 1318-1320), staatus normaliseeritakse hulka `READY|ARCHIVED` (rida 1313-1314). **Tähelepanek:** SENT-kirje puhul läheb tavaline „Salvesta tööplaan" fallback'iga READY-sse ja paneb `openedAt` — märkme salvestamine on implitsiitne vastuvõtmine, mille autor näeb „avatud" olekuna (vt Otsus 5). `nextContactOn` muutus tühistab vanad `NEXT_CONTACT_DUE` teavitused (rida 1339-1357).

**Staatused.** `DRAFT → READY → SENT → (vastuvõtja: READY → ARCHIVED)`, autori paralleelharu `DOWNLOADED` (ainult allalaadimis-endpoint'i kaudu, PATCH-kanal suletud — rida 1199-1206 ja `resolvePreInquiryEditStatus` rida 648-660). „Märgi vastuvõetuks" on olemas **kahes kohas eri endpointidega**: loendinupp → `POST /accept` (`acceptPreInquiry`, rida 740-783, idempotentne, ei taasta ARCHIVED-t) ja tööplaani nupp → workflow-PATCH `status:"READY"` (P3-2).

**Ruumi loomine.** „Ava vestlusruum" → `POST /api/pre-inquiries/[id]/room` → navigeerimine ruumi (rida 1638-1665). Ruumi olemasolu lukustab adressaadivahetuse (`assertRecipientChangeAllowed`, rida 1079-1090) ja blokeerib tagasikutsumise (`recallPreInquiry` rida 712-714). Ruumi sisemine voog on RUUM-A0 teema — siin ainult piirid.

**Jätkamine ja sulgemine.** Jätkamine = continuity `next_contact`/`pre_inquiry_received` kirjed + `NEXT_CONTACT_DUE` teavitus reconcilerist (OPTIONAL e-post). Sulgemine = „Arhiveeri" (workflow-PATCH ARCHIVED): kirje jääb vastuvõtja loendisse (visible-WHERE ei filtreeri ARCHIVED-t välja), kaob continuity'st, autor saab `PRE_INQUIRY_STATUS_CHANGED` sündmuse (reconciler, ainult `openedAt` + READY/ARCHIVED korral).

**Autoripoolsed järeltegevused** (kontekstiks): recall enne avamist (`recallPreInquiry`, rida 689-737 — INTERNAL, avamata, CAS), parandus pärast avamist (`sendPreInquiryCorrection`, rida 790-898 — loob uue SENT-kirje, seob `supersededById`, saadab uue saabumisteate), allalaadimise elutsükkel (rida 900-964).

---

## 4. Teavituste elutsükkel

**Loomine.** Kaks teed: (a) sünkroonsed sisuta e-kirjad saatmisel (`shouldSendInternalArrival` + `dispatchInternalArrivalEmail`); (b) `NotificationEvent` kirjed, mida loob **ainult** reconciler-job (`lib/notificationReconciler.js:37-180`) — 9 tüüpi (`lib/notifications.js:4-14`), igal spec (sourceType/targetKind/labelKey/badgeKey, rida 16-71). Loomine on dedupe-võtmega idempotentne (`dedupeKey = type:sourceId:userId:suffix`, unique-constraint püütakse kinni, rida 200-243) ja saajaõigus verifitseeritakse loomisel (`assertNotificationRecipient`, rida 112-156).

**Lugemine.** `GET /api/notifications` (limit ≤100, unread-filter) verifitseerib iga rea saajaõiguse *uuesti* lugemishetkel (rida 261-277 — tagasivõetud pöördumise teavitus kaob) ja tagastab `notificationBadges`. `PATCH` märgib loetuks üksikult või allika kaupa. **Ühtegi UI-tarbijat pole** (repo-grep: ainult `WorkspacePanel` preferences-fetch): in-app teavituste loendit, kellukest ega badge'i sellest allikast ei eksisteeri. Ainus automaatne loetuks-märkija on ruumi lugemis-route (`app/api/rooms/[roomId]/read/route.js:157-161`, transaktsioonis `lastReadAt`-iga) ja `NEXT_CONTACT_DUE` tühistus kuupäevamuutusel. `PRE_INQUIRY_ARRIVED` / `PRE_INQUIRY_STATUS_CHANGED` / `PRACTICE_*` jäävad igaveseks lugemata (vt P1-2).

**Badge'id.** Töölaua badge'id tulevad tegelikult continuity-vastusest (DB-derived), mitte teavitussündmustest — kaks paralleelset badge-allikat, millest kasutusel on üks. `badgeKey` väärtused kaardistuvad kaardialiaste kaudu (`workspaceDashboardCards.js:14-27`): `room_unread`/ROOM_* → `add_person` kaart („Lisa inimene") — semantiliselt eksitav (P2-3); `effective_practices` võtmele **ei vasta ükski kaart** — badge ei jõua kuhugi (P3-1).

**Eelistused.** `User.notificationEmailEnabled` (tri-state, vaikimisi null=väljas) + `notificationPreferenceVersion` CAS (`lib/notifications.js:318-355`). UI: checkbox continuity-plokis (`WorkspaceContinuity.jsx:46-59`), optimistlik uuendus + rollback (`WorkspacePanel.jsx:398-419`) — aga vea-olekut kasutajale ei näidata (P3-4).

**Saatmine ja korduskatsed.** `runNotificationDelivery` (`lib/notificationDelivery.js:56-173`): claim-CAS (`updateMany` PENDING/RETRY → SENDING, attempts++), saaja/eelistuse re-check saatmishetkel, 15 s timeout, lokaliseeritud miinimumsisu (`emailContent` — pealkiri, sündmuse silt, link `/vestlus`; keel `frameworkAcceptance` viimasest lokaadist, rida 37-44), õnnestumine → SENT, viga → RETRY eksponentsiaalse backoff'iga (5 min · 2^n, lagi 24 h) kuni 3 katset → FAILED. Kinnijäänud SENDING üle 10 min lease → **UNKNOWN** (`AMBIGUOUS_AFTER_LEASE`), mida ükski päring enam ei korja — terminaalne, ilma admin-vaateta (P2-4). `emailMessageId` on dedupe-võtme hash — kordussaatmise idempotentsus posti tasandil.

**Käivitus.** `POST /api/jobs/notifications` (`app/api/jobs/notifications/route.js`): `NOTIFICATION_JOB_KEY` timing-safe võrdlus; **võtme puudumisel alati 401** — kogu konveier (sh NEXT_CONTACT_DUE, STATUS_CHANGED) on siis vaikselt surnud; repo ei sisalda cron-seadistust, ainult `npm run notifications:dispatch` (`scripts/notification-job.mjs`) (P2-5). Reconcile + delivery lehekülgedena (max 100 lehte kummalegi), `truncated` lipp vastuses.

**Tõrkeolukorrad kokkuvõttes:** e-kirja tõrge ei kuku kunagi salvestust läbi (best-effort saabumiskiri; event-kanal retry'b); topelt-e-kirja välistab dedupe + NONE-poliitika reconcileri arrival-sündmusel; ebaselge saatmine pargitakse UNKNOWN-i (teadlik „pigem mitte topelt" valik).

---

## 5. „Minu jagamised"

`/minu-jagamised` → `MySharingsPage.jsx` → `GET /api/my-sharings` → `loadMySharings` (`lib/mySharings.js:100-256`). Viis sektsiooni: saadetud eelpöördumised, ruumid, kutsed, abikuulutused, raamistikunõustumised — kõik rangelt `userId`-skoobitud päringud.

**Omand ja nähtavus.** Igal kaardil `OwnershipBar` (nähtavus/päritolu/kehtivus). Eelpöördumise kehtivusloogika (`preInquiryValidity`, `MySharingsPage.jsx:224-230`): recalled → superseded → external_final → opened → until_recall.

**Tagasikutsumine.** `canRecall` (`mySharings.js:37-45`): INTERNAL + SENT + avamata + tagasi kutsumata + asendamata + **ilma kanoonilise ruumita** (tuletatakse enda liikmesuste `originType/originId` kaudu, rida 231-238 — optimistlik; server re-checkib lukus). Kinnitusmodaal + CAS (`expectedUpdatedAt`) + 404/409 eristus serveris.

**Parandamine.** `canCorrect` = INTERNAL + avatud + tagasi kutsumata + asendamata; inline-vorm (topic/situation/tekst) → `POST /api/pre-inquiries/[id]/corrections`, privaatsuskontrolli 409-vahekäik (`needsPrivacyConfirmation` → „kasuta redigeeritut / saada originaal", rida 325-334).

**Lahkumine ja tühistamine.** Ruumist lahkumine (`canLeave = role !== "OWNER"`), kutse tagasivõtt (`canRevoke` = ruumi omanik või OWNER/MODERATOR liige, `mySharings.js:239-244`). Mutatsioonid on `mutationInFlightRef`-iga topeltklikikaitsega, tulemus refetch'itakse `preserveData` režiimis.

**Seos töölauaga.** Nõrk: „Minu jagamised" on profiilialune leht (back → `/profiil`), töölaualt otselinki pole; continuity ei vii kunagi siia. Autori saadetud kirjete järelseis (avatud/arhiveeritud) elab ainult siin — töölaud autorile seda ei näita (seotud P1-2).

**Privaatsuspiir abikuulutustel:** loend ise on omaniku-skoobitud ja korrektne, aga kuulutuste avalikud otspunktid, kuhu töölaua „Abisoovid/Abipakkumised" kaardid viivad, lekivad main-is võõraste mustandeid/suletud kirjeid ja täpset asukohta — parandus on ainult harul (P0-1).

---

## 6. Dubleerimine ja vastuolud (punkt 6)

1. Sama pöördumise „ava" on kolmes kohas eri käitumisega: töölaua kaart avab **paneeli-sisese** vaate (`?workspace=pre_inquiries`), continuity-kirje teeb **täislehe push'i** `/eelpoordumised?openInquiry=…` (`openContinuityItem`, `WorkspacePanel.jsx:466-470` — ei kasuta `navigateTo` embedded-loogikat), teavituse `targetHref` sama täisleht. Tagasi-käitumine erineb (embedded back vs brauseri back).
2. „Märgi vastuvõetuks" kaks korda eri endpointidega (accept vs workflow-PATCH) — vt P3-2.
3. Badge-allikaid on kaks (continuity `badgeCounts` ja kasutamata `notificationBadges`) — sisult sarnased, aga mitte identsed (nt continuity loeb DRAFT-e, teavitused mitte).
4. Admini vastuvõtjavaates segunevad enda autoritud kirjed saabunutega (`WorkspaceFeaturePage.jsx:946`) ja neil renderdub ka „Kirjuta e-kiri" mailto (autori e-post on adminil endal nähtav) — päris vastuvõtjal see nupp kunagi ei renderdu (P3-3).

## 7. Seisundid (punkt 7)

- **Continuity:** loading (`aria-busy`, „Koondan…"), error („koond ei ole praegu saadaval"), empty („Hetkel ei ole pooleliolevaid tegevusi") — kõik olemas (`WorkspaceContinuity.jsx:61-86`). Osaliselt lõpetatud seisundeid (nt continuity ok / preferences fail) käsitletakse: preference jääb lihtsalt kuvamata.
- **Eelpöördumised:** loading/error/notice lõigud (rida 1866-1876); tühi saabunute loend selgitava tekstiga (rida 1952). Nuppudel per-kirje busy-olekud (`acceptingInquiryId` jt). Vead kuvatakse tekstina, ilma retry-nuputa.
- **Minu jagamised:** loading, load-error + „Proovi uuesti", täis-tühi, sektsiooni-tühjad, action-error/feedback fookusega live-regionis (`MySharingsPage.jsx:242-260`).
- **Aegunud/vananenud:** CAS-konfliktid annavad 409 → kasutajale üldine veatekst; continuity badge võib olla laest vananenud kuni paneeli taasavamiseni (pollimist pole) — aktsepteeritav.
- **Nõrgim koht:** eelistuse-checkboxi vaikne tagasipööre veal (P3-4) ja deep-linkide vaikne no-op (P1-1, P2-2) — kasutaja ei saa teada, et midagi läks nihu.

## 8. Mobiil, klaviatuur, fookus, ekraanilugeja, ET/EN/RU (punkt 8)

- **Klaviatuur/fookus:** kaardid on päris `<button>`-id `aria-label`-iga (`formatDashboardCardAriaLabel`), badge on `aria-hidden` ja sisaldub label'is; `:focus-visible` stiilid olemas (`workspace.css:242,263,371`); sr-only `h1` (HEAD:608, töökataloog:619); Escape töötab tagasi-liigutusena. Miinus: Escape-kuular on globaalne `window.keydown` + `preventDefault` kõigil Escape'idel, kuni töölaua-nägu on monteeritud — võib süüa pesastatud dialoogide Escape'i (P3-6).
- **Ekraanilugeja:** continuity `role="status"`/`aria-busy`, MySharings live-region + fookuse suunamine, `<time dateTime>` mõlemas. Vastuvõtja kuupäevaväli on toores `input[type=date]` ilma formaadivihjeta — kasutatav.
- **Mobiil:** kaardipaneelil on media-query'd (`workspace.css:39` jj), wheel-capture ainult desktop-probleem; eraldi mobiilihaaret ei auditeerinud runtime'ita — visuaalset kontrolli ei tehtud (not_run).
- **ET/EN/RU:** tõlkefailide *võtmed* on pariteedis (`workspace_continuity` 14/14/14, `notifications` + `events` 9/9/9, `my_sharings` 17/17/17, `pre_inquiries` 34/34/34; test „ET/EN/RU contain every new notification and continuity key" läbib). **Sisuline pariteet on katki koodi-hardcode'ide tõttu:** eelpöördumise sammunimed ja alustusvalikud (`WorkspaceFeaturePage.jsx:60-84`), külgpaneeli „Eelinfo ülevaade" read (rida 970-1010, 2085-2088), assistendi vahetekstid („Märksõnad:", „Vasta järgmistele küsimustele:", rida 846-855), vastuvõtja kontroll-loendi sildid (DB-sse salvestatuna ET, `preInquiryReceiverWorkflow.js:3-24`), kogu ruuting/kindlus/hoiatustekstid (`preInquiryRouting.js`, `preInquiries.js:386-445, 1733-1739`) ja badge'ide vaike-aria-sildid („uut sündmust", `workspaceDashboardCards.js:61-95`) on ET-only (P2-6/P3-7).

## 9. Privaatsus ja õigused (punkt 9)

Tugev üldpilt: continuity ja my-sharings on rea-tasemel omaniku-skoobitud; `serializePreInquiry` peidab e-postid ja vastuvõtjaväljad vaataja rolli järgi; teavituste loend re-verifitseerib saajaõiguse igal lugemisel; `markPreInquiryDownloaded`/`recall`/`correction` kasutavad 404-t võõra olemasolu varjamiseks ja CAS-i; teavitus-e-kirjad ei kanna sisu; `safeError` logides. Kaks auku: (1) main-i abikuulutuste V1+V2 lekked, mille parandus on harul (P0-1); (2) vaikimisi teavituskiri sisaldab ainult sündmuse *tüüpi* — korras, aga `next_contact_due` tüüp iseendas ei lekita midagi. Kontrollitud.

---

## 10. Leiud P0–P3

### P0

- **P0-1 · Abikuulutuste privaatsuslekked main-is; parandus mestimata.** `git diff origin/main origin/fable/help-listings-privacy-p0`: main-i `GET /api/help/listings/[kind]/[id]` tagastab võõrale omanikuprojektsiooni (rawPlace, täpne asukoht, mustandid) ja `scope=global` loend lekitab võõraste DRAFT/CLOSED/CANCELLED/ARCHIVED kirjeid. Fix (`3479a447`, server-side visibility contract: `lib/help/listingAccess.js`, `listingViews.js`, fail-closed OPEN-põrand) + sõltumatu audit (`2f9323a6`) on harudel valmis. Töölaua „Abisoovid/Abipakkumised" kaardid viivad otse sellesse pinda. **Tegevus: mestimine, mitte uus arendus.**

### P1

- **P1-1 · Järeltegevuse süvalingid ei vii sihile.** `lib/notifications.js:92-106` (`targetHref`) ja `lib/workspaceContinuity.js:176,199,232` genereerivad `/parimad-praktikad?practice=…`, `/teekond?journey=…`, `/teenuseprofiil?profileId=…` — ühtegi neist parameetritest ei loe ükski komponent (grep: 0 tarbijat; `/teekond/[id]` marsruut on olemas, aga linki ei kasutata). Prioriteet-1 continuity-kirje (praktikaülevaatus) ja PRACTICE_* teavituste href on katteta lubadus: klikk maandub üldvaatesse ilma selgituseta.
- **P1-2 · In-app teavitustel puudub pind; autori järelseis nähtamatu.** `GET/PATCH /api/notifications` on ilma UI-tarbijata; `PRE_INQUIRY_STATUS_CHANGED` (autor: „sinu pöördumine avati/arhiveeriti") ei jõua kasutajani üheski vaates peale „Minu jagamised" kehtivusrea; `NEXT_CONTACT_DUE`/`PRACTICE_*` jõuavad kohale ainult siis, kui e-posti opt-in on tehtud (vaikimisi väljas) või continuity-plokk juhtub kirjet näitama. U1 vertikaal on serveri poolelt valmis, UI poolelt pooleli — see on teadlik-poolik, mitte regressioon (U1 commit ei sisaldagi inbox-UI-d), aga igapäevatöölaua lubaduse mõttes lünk.

### P2

- **P2-1 · Admini vaatelüliti ei värskenda serverisisu (main).** `AdminRoleViewCycleButton.jsx` (HEAD) teeb PUT `/api/profile/view-role` + `onRoleChanged`, aga mitte `router.refresh()` — küpsisest rolli lugevad serverikomponendid jäävad vanale rollile kuni järgmise täislaadimiseni. Parandus (+ `service_profile` lülitikoht) eksisteerib **ainult committimata töökataloogis** — commitimata kadumise risk. (Rollivahetaja tervikanalüüs on eraldi teema; siin ainult töölaua-mõju.)
- **P2-2 · Vastuvõtja `openInquiry` süvalingi fallback toetab ainult autorit.** `WorkspaceFeaturePage.jsx:1200-1226`: kui kirje pole esimese 100 hulgas, fetch'itakse üksikkirje, aga visatakse minema kui `authorId !== currentUserId`. Continuity `next_contact` (prio 0!) link võib vastuvõtjal vaikselt mitte midagi teha.
- **P2-3 · `room_unread` ja ROOM_*/HELP_MATCH badge'id maanduvad „Lisa inimene" kaardile.** `workspaceContinuity.js:192` (`badgeKey:"add_person"`) + aliased `workspaceDashboardCards.js:15`. Lugemata sõnumite number kutsekaardil, mille klikk avab kutsevormi — eksitav.
- **P2-4 · `UNKNOWN` e-kirjaolek on terminaalne ja nähtamatu.** `notificationDelivery.js:76-82`: lease'i ületanud SENDING → UNKNOWN, mida delivery-päring (`emailStatus in [PENDING,RETRY]`) enam ei korja; admin-vaadet ega requeue-teed pole.
- **P2-5 · Teavituskonveieril puudub repo-sisene käivitusgarantii.** `NOTIFICATION_JOB_KEY` puudumisel 401 (`app/api/jobs/notifications/route.js:17-25`); crontab/scheduler-seadistust repos pole, ainult käsitsi `npm run notifications:dispatch`. Kui ops-pool pole seadistatud, ei teki ühtegi sündmust ega kirja — vaikselt.
- **P2-6 · Eelpöördumise voo ET-hardcode'id murravad EN/RU pariteedi.** Loetelu §8-s; sh DB-sse püsivalt salvestuvad ET kontroll-loendi sildid (`preInquiryReceiverWorkflow.js:3-24`) — hilisem tõlkimine nõuab andmemigratsiooni või label-võtmestamist.
- **P2-7 · Tasuvärav on ainult kaardikihis.** `requiresPaid` blokeerib kaardi (`workspaceDashboardCards.js:5-10`), aga `/eelpoordumised` leht, `/api/pre-inquiries*` ja continuity-lingid tellimust ei kontrolli — ilma tellimuseta kasutaja jõuab funktsioonini otse-URL-i või continuity kaudu. Kas viga kaardis (liigne värav) või lehes (puuduv värav) — vajab tooteotsust (Otsus 1).

### P3

- **P3-1 · `effective_practices` badge-võti on orb.** `notifications.js:57,63` ja `workspaceContinuity.js:180` toodavad võtit, millele ei vasta ükski kaart ega alias (`workspaceDashboardCards.js:14-27`) — praktikaülevaatuse märk ei jõua kunagi töölauale.
- **P3-2 · Kaks „Märgi vastuvõetuks" eri endpointidega.** `WorkspaceFeaturePage.jsx:1934-1938` (accept) vs `2027-2029` (workflow READY) — sama silt, eri kõrvalmõjud (workflow salvestab ka mustandiväljad).
- **P3-3 · „Kirjuta e-kiri" surnud haru päris vastuvõtjal.** `buildPreInquiryReplyMailto` (rida 500-516) vajab `inquiry.author.email`-i, mida vastuvõtja-serialiseerimine kunagi ei anna (`lib/preInquiries.js:548-554`) — nupp renderdub ainult admini enda-kirjete eelvaates.
- **P3-4 · E-posti eelistuse viga on vaikne.** `WorkspacePanel.jsx:413-418` paneb `status:"error"`, aga `WorkspaceContinuity.jsx` ei renderda seda kuidagi; checkbox lihtsalt hüppab tagasi.
- **P3-5 · `dashboardBadges` prop on surnud.** Ükski ülemkomponent seda ei tooda (ainult pass-through `ChatBodyView.jsx:160`); kogu badge-sisu tuleb continuity'st. Eemaldada või dokumenteerida.
- **P3-6 · Globaalne Escape-kuular.** `WorkspacePanel.jsx:434-443` `preventDefault`-ib kõik Escape'id, ka siis kui `visible=false` või fookus pesastatud dialoogis (nt embedded InviteModal).
- **P3-7 · Badge'ide vaike-aria-sildid ET-only** (`workspaceDashboardCards.js:61-95`: „uut sündmust", „vajab tähelepanu") ja badge-arv võib take-cappide (20/30) tõttu alahinnata.

---

## 11. Runtime-kontroll

- **Ühiktestid (ilma DB-ta, süstitud fake-db):** `tests/notifications/*` — **21/21 pass**; `tests/preInquiries/*` — **97/97 pass** (sh trustLifecycle, recipientRoomLock, downloadedLifecycle, workspaceContinuity + UI-leping, ET/EN/RU võtmepariteet). Käivitatud `node --test` kaudu; protsessid lõppesid ise, ridu ei loodud (testid ei puuduta päris DB-d).
- **Päris-DB runtime (sünteetilised kasutajad, API-vood, brauserikontroll):** **not_run** — `DATABASE_URL` osutab `localhost:5432`-le, mis analüüsikeskkonnast ei ole kättesaadav (ECONNREFUSED). Väiteid selle kohta, *kuidas* vood päriselt renderduvad (mobiilipaigutus, fookusjärjekord ekraanilugejas, e-kirja tegelik kohaletoimetus), selles dokumendis ei esitata runtime-tõendina.
- Koristus: midagi ei loodud — koristada pole vaja. Git-seisu ei muudetud (ei stage'itud, commititud, push'itud).

---

## 12. Praeguse töövoo lühihinnang

Serveripool on selgelt üle keskmise: omandipiirid, CAS-versioonikaitsed, idempotentsus ja privaatsusdistsipliin (sisuta kirjad, rolli järgi serialiseerimine, re-verifitseeriv teavitusloend) on läbivalt korralikud ja testidega kaetud (118 pass). Igapäevase töölaua *lubadus* — „maandud, näed järgmisi samme, klikid ja jätkad" — täitub aga ainult osaliselt: kolm continuity-sihtmärki neljast ei vii kirjeni (P1-1, P2-2), autori järelseis ja pool teavitustüüpidest ei jõua ühelegi ekraanile (P1-2), ja EN/RU kasutaja saab eelpöördumise voos segakeelse kogemuse (P2-6). Kõige teravam üksikrisk pole töölauas endas, vaid sealt avatavas kuulutuste pinnas (P0-1 — fix ootab mestimist). U6/U7/U9 on valmis või peaaegu valmis, aga eranditult harudel.

## 13. Hästi töötavad osad

Eelpöördumise elutsükkel lukustuse ja `expectedUpdatedAt` CAS-idega (recall/accept/correction/downloaded); DOWNLOADED-oleku külgkanali sulgemine ja sisumuutuse-põhine READY-taandus; teavituste dedupe-võti + loomis- ja lugemisaegne saajaverifikatsioon; delivery claim-CAS, backoff ja teadlik UNKNOWN-parkimine topeltkirja vältimiseks; continuity omaniku-skoobitud allikad, Tallinna-kuupäevaloogika ja href-dedup; „Minu jagamised" omandiriba, kinnitusmodaalid, privaatsus-vahekäik ja fookusehaldus; sisuta teavitus-e-kirjad kolmes keeles; tõlkevõtmete pariteet ja seda valvav test.

## 14. Tooteomaniku otsused

1. **Tasuvärav:** kas eelpöördumine (eriti pöördujale) on tasuline funktsioon? Praegu kaart blokeerib, leht/API/continuity mitte (P2-7). Vastus määrab, kumb pool ühtlustatakse.
2. **In-app teavituste pind:** kas ehitada teavituste loend/kelluke `/api/notifications` peale või jääda continuity-põhiseks ja kustutada kasutamata endpoint-osa? (P1-2)
3. **Ruumimärkide kodu:** kas `room_unread`/ROOM_* badge vajab oma „Ruumid/Vestlused" kaarti või tõstetakse kutse-kaardi alt mujale? (P2-3)
4. **Implitsiitne vastuvõtt:** kas tööplaani salvestamine SENT-kirjel tohib panna `openedAt`+READY (autor näeb „avatud") või peab enne olema eksplitsiitne accept? (§3)
5. **U6/U7/U9 mestimisjärjekord** ja U9 auditi vajadus enne mestimist.
6. **UNKNOWN-kirjade protseduur:** kas piisab admin-loendist + käsitsi requeue'st või on vaja automaatset re-kontrolli? (P2-4)
7. **Kontroll-loendi keelestrateegia:** label-tekstide asemel võtmed DB-s (migratsioon) või jäädakse ET-kesksele töövaatele? (P2-6)

## 15. Rakenduspaketid

### TÖÖLAUD-P0 — kuulutuste privaatsusparanduse mestimine
Sisu: `origin/fable/help-listings-privacy-p0` (või `codex/help-listings-privacy-p0-audit` koos auditiga) mestimine main-i; konfliktikontroll `lib/help/*` vs main-i vahepealsed muutused. Failid: `app/api/help/listings/route.js`, `app/api/help/listings/[kind]/[id]/route.js`, `lib/help/{index,listingAccess,listingViews,offers,requests}.js`. Testid: haru 26 regressioonitesti + olemasolev testikomplekt. Sõltuvused: puudub (audit tehtud). Välistatud: kuulutuste UI muutmine, matching-loogika.

### TÖÖLAUD-P1 — järeltegevuse linkide terviklus *(esimene väike pakett, vt §16)*

### TÖÖLAUD-P2 — nähtavus ja järjepidevus
(a) admini vaatelüliti `router.refresh()` paranduse commitimine kooskõlas käimasoleva rollivahetaja-tööga (`AdminRoleViewCycleButton.jsx`); (b) UNKNOWN/FAILED kirjete admin-loend + requeue (uus admin-route + `notificationDelivery.js` väike laiendus; testid `tests/notifications/notificationDelivery.test.js` kõrvale); (c) deploy-dokumenti/`.env.example`-isse `NOTIFICATION_JOB_KEY` + cron-nõue; (d) otsusest 1 sõltuv väravaühtlustus; (e) otsusest 3 sõltuv badge-ümberpaigutus; (f) otsusest 7 sõltuv i18n-väljatõste (`WorkspaceFeaturePage.jsx` hardcode'id + `preInquiryRouting.js` + `preInquiryReceiverWorkflow.js` võtmestamine, `messages/*` täiendus). Välistatud: teavituste inbox-UI enne otsust 2.

### TÖÖLAUD-P3 — puhastus
Orb-badge'i kaardistus või eemaldus (`effective_practices`); topelt-„Märgi vastuvõetuks" ühendamine workflow-endpointi peale; surnud `dashboardBadges` prop'i ja surnud mailto-haru eemaldus; Escape-kuulari skoopimine (`visible` + fookusekontroll); eelistuse-vea kuvamine `WorkspaceContinuity`-s; badge-aria-siltide võtmestamine. Testid: `tests/notifications/workspaceContinuityUi.test.js` laiendus. Sõltuvused: puudub.

## 16. Esimene väike rakendusvalmis pakett (ei vaja tooteotsust)

**TÖÖLAUD-P1: „iga järgmine samm viib kirjeni"** — kolm kirurgilist muudatust, käitumuslikult vaieldamatud:

1. `lib/workspaceContinuity.js:232` — teekonna href `/teekond?journey=ID` → olemasolevale marsruudile `/teekond/ID` (marsruut `app/teekond/[id]` on olemas).
2. `components/covision/EffectivePracticesPage.jsx` — lugeda mount'il `?practice=` parameeter ja avada vastav praktika (komponendil on detailivaade juba olemas, puudub ainult URL-ist avamine); katab nii continuity kui `lib/notifications.js` PRACTICE-href'id.
3. `components/workspace/WorkspaceFeaturePage.jsx:1208-1214` — `openInquiry` fallback aktsepteerib ka `recipientOwnerId === currentUserId` kirje (ja valib siis vastuvõtjavaate aktiivkirje).

Testid: `tests/notifications/workspaceContinuity.test.js` (href-leping), uus `tests/chat/`-laadne UI-leping praktika-parameetrile, `tests/preInquiries/` väike lisatest fallback-omandile. Sõltuvused: puuduvad. Välistatud skoop: `/teenuseprofiil?profileId=` (juba juhtumisi õige sihtkoht), badge-ümberkorraldused, inbox-UI, gating.

---

STATUS: COMPLETE
