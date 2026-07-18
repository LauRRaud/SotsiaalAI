# ÜLESANNE: T12 `ROOMS-CALLS-V1` — ruumid, kutsed, kõne, salvestus ja kohtumise kandjad

**Olek:** `READY_TO_ASSIGN` — järgmine täisteema (omaniku prioriteet 18.07: funktsioonid enne release'i). T07 on suletud, ükski kooditeema pole aktiivne.
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine.
**Soovitatud teostaja:** Sol High või Fable 5 High (salvestuse nõusolekumudel + egress + retention + mitme tabi olekumasin = kõrge privaatsus-/turva-/olekuraskus).
**Alus:** kogu `app/api/rooms/**` on tervikuna auditeeritud — `docs/platvormi arendus/fable-5-ruumid-liitumine-ja-konevoog.md` (20 ptk, pingerida 20.2, parandusretseptid 20.3, parandusjärjekord 20.5). See leping jälgib auditi parandusjärjekorda ja lukustab omaniku 18.07 otsused.

## Eesmärk

Kasutajal on üks aus ruumi- ja kõneelutsükkel: ta liitub ruumiga, suhtleb, helistab, salvestab **selge jätkuva nõusolekuga** ning lahkub või lõpetab suhte nii, et ükski kiht ei jää orvuks. Ruumi, liikmesuse ega kõne lõpp ei jäta rippuvaid kõnesid, fantoom-osalejaid ega peatamatut salvestust. Voo-põhise ruumi ühist ajalugu ei saa üks pool teise nõusolekuta hävitada. Salvestisele pääseb ligi ainult see, kes oli kohal ja andis nõusoleku, ning see kustub tähtajaliselt. Kohtumise kokkuvõte jääb igale osalejale tema enda privaatsesse ruumi.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-ruumid-liitumine-ja-konevoog.md` — **tervikuna**, eriti ptk 4–5 (salvestuse nõusolek), 12 (failipool), 16 (kustutus/lahkumine), 19 (kõne race), 20 (koondvaade + parandusjärjekord).
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T12 (rida 290).
5. `app/api/rooms/**`, `lib/rooms/**` (sh `preInquiryRoom.js`, mis on auditeerimata — eelpöördumise pere), `lib/server/roomRoutes.js`, `lib/rooms/service.js`, `schema.prisma` ruumi-/kõne-/salvestusmudelid, `components/alalehed/chat/ChatBodyView.jsx`, `RoomsPage.jsx`.
6. LiveKit egress-rada (`lib/rooms/egress.js`, `recordingStorage.js`) ja `RECORDING_ENABLED` lipu kõik lugejad.
7. `docs/platvormi arendus/tehis-testkontod.md` enne lokaalset autentitud kontrolli.

## Alus ja worktree

> **JADATÖÖ REEGEL (18.07, ülimuslik).** Korraga kirjutab koodi ainult üks teema. T12 on järgmine; ükski teine kooditeema ei jookse paralleelselt.

1. **Baas = `main`-i PRAEGUNE tipp alustamise hetkel.** Jooksuta `git rev-parse main` ja raporteeri kasutatud SHA. Ülesande koostamise ajal oli `main` = `63152fef` (T07 suletud). Ära hargne vanast SHA-st. Põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI` kasutatakse ainult read-only baasina.
2. Loo uus worktree kohalikust `main`-ist: `git worktree add ../SotsiaalAI-rooms-calls-v1 -b codex/rooms-calls-v1 main`.
3. **Migratsioon:** uued indeksid/väljad tuleb nimetada `main`-i uusimast migratsioonist HILISEMAKS (praegu tipp `20260719150000_documents_research_v1`) — kasuta `20260720xxxxxx_rooms_calls_v1`. Muidu sorteerub see juba rakendatud migratsioonide ette (T24/T07 õppetund).
4. Tõlkefailid `messages/*.json` — hoia muudatused ainult T12 võtmetes, diff loetavaks.
5. Lõpetamisel: väravad rohelised → merge `main`-i **samal päeval**. `main`, server, merge ja deploy jäävad puutumata kuni omaniku eraldi loani.

## Lukustatud V1 valikud (omaniku otsused 18.07)

| Teema | V1 leping |
|---|---|
| **Salvestus SEES** | V1 lülitab `RECORDING_ENABLED=true` **alles siis, kui E5+E6 on täielikult tõendatud**. Nõusolek kehtib salvestuse **kogu kestuse**, mitte ainult alustamise kohta. Auditi #1/#2 (ptk 4–5, 12) on V1 tuum, mitte edasilükatud. |
| **Salvestise ligipääs + retention** | Ligipääs ainult neil, kes olid **kohal JA andsid nõusoleku**. Withdraw katkestab tulevase salvestuse ja eemaldab ligipääsu. Auto-purge **vaikimisi 90 päeva** (ühtne dokumentide retention'iga); omanik saab ka käsitsi kustutada. |
| **Voo-ruumi kustutus** | Voo-põhises ruumis (`originType !== MANUAL_INVITE` — HELP_MATCH, PRE_INQUIRY, SERVICE_PROVIDER_INQUIRY) omanik **EI saa ühepoolselt kustutada**; pakutakse „arhiveeri" või „lahku". Ühine ajalugu säilib. Ainult `MANUAL_INVITE` ruumis jääb omaniku-kustutus alles (koos elutsükli koristuse ja auditijäljega). |
| **Kohtumise kokkuvõte** | Ruumi lõppedes kopeeritakse kokkuvõte **igale osalejale tema enda privaatsesse ruumi** (Minu dokumendid, T07 pind). Ruumi kustutus/arhiveerimine ei võta seda ära. |
| **Kutseõigus** | **Ainult OWNER kutsub** liikmeid. MODERATOR/MEMBER ei kutsu. Sponsoreeritud kasutaja liitub sponsori loodud `Subscription` kaudu (audit 20.4: liikmesuse sponsor-väljad on informatiivsed, mitte õigusi andvad). |
| **Omanikuvahetus** | OWNER saab enne lahkumist rolli üle anda (MODERATOR/MEMBER seast); ruum ei jää orvuks. Katab auditi 16 K6. |
| Kergemad vaikeväärtused (omanik võib üle vaadata) | **Billing-kadumine (15 K2):** kuva aus „ligipääs lõppes" olek, mitte vaikne kadumine. **Moderatsioon (3 K6b):** V1 ühtlustab olemasoleva filtriga, ei muuda filosoofiat. **Reaalajakiht (4 K7):** V1 EI laienda SSE-d kõneseisu kandma; koondab serialiseerimise ühte laadijasse ja eemaldab kuulajata publish'id. |

## Teostus

### E1 — Elutsükli ristkoristus (audit 20.5 #2)

- Ruumi DELETE lõpetab enne kustutust **kõik aktiivsed kõned** sama teenusega (`findActiveRoomCall` → `endCall({canModerate: true})`, mis koristab osalejad, sõnavõtusoovid ja salvestuse). Omanik ei jää oma ruumi kustutamisel kinni (16 K1).
- Ruumist/kõnest lahkumine ja liikmesuse lõpp koristavad **kõneosaluse** (`CallParticipant.leftAt`) ja **consent-rea** — fantoom-osaleja ei hõiva kohta, ei blokeeri readiness'e ega hoia kõne igavesti ACTIVE (16 K3, 4 K2). Sama koristus on jagatud helperis, nii et tulevane „eemalda liige" (kick) pärib selle sünnist.
- Klient: näovahetus (`ChatBodyView`) ei katkesta heli vaikselt ega külva fantoom-osalejaid (14 K1).
- Iga kustutus kirjutab **auditijälje** enne hävitamist (`dataAuditLog` `ROOM_DELETED` meta: roomId, title, originType, memberCount, messageCount) (16 K4).

### E2 — Race-migratsioon: tingimuslikud kirjutused (audit 20.5 #3)

- Üks migratsiooniring osaliste unikaalindeksitega: `CallSession(roomId) WHERE status = ACTIVE`, `CallParticipant(callSessionId, userId) WHERE leftAt IS NULL`, `CallRecordingRequest(callSessionId) WHERE status IN (avatud olekud)`.
- Kõik staatuse-üleminekud `updateMany` + staatuse-where'iga (TOCTOU-kindel). Katab: lastReadAt (1 K1), sõnumikustutus (2 K2), osaleja/topelt-lõpp (4 K3/K4), topelt-taotlus/start (5 K3), topelt-ACTIVE-kõne (19 K1/K2).

### E3 — Vealeping ja ressursiväravad (audit 20.5 #4)

- Lugevad GET-route'id saavad püünise, mis hoiab `{ok, messageKey}` lepingu ka 500-l (3 K1, 13 K3, 17 K1, 18 K1).
- `statusForCallError` fallback logitakse ja maskitakse (13 K2).
- Rate-limit **enne** kallist tööd; IP-võti pole kliendi võltsitav; `purposeText`/sõnumi sisu saavad pikkuspiiri (18 K2–K4, 13 K7, 5 pisitäiendus). Calls-mutatsioonidele lisandub limiit.

### E4 — Rolliteadlik kutse, kustutuspoliitika ja omanikuvahetus

- **Ainult OWNER kutsub** — kutse-endpoint kontrollib `ownerId`, mitte rolli-loendit; MODERATOR/MEMBER saab 403 ausa sõnumiga.
- **Voo-ruumi kaitse:** DELETE keeldub `originType !== MANUAL_INVITE` ruumides (409 + „arhiveeri/lahku" alternatiiv). `HelpMatch`/`PreInquiry`/`ServiceProviderInquiry` ühine ajalugu ei kustu ühe poole klõpsust (16 K2). Lisa `archivedAt` olek (soft-arhiiv, mitte kustutus).
- **Omanikuvahetus:** uus endpoint OWNER → valitud MODERATOR/MEMBER; tingimuslik kirjutus (ei kaota omanikku race'is). Pärast vahetust saab vana omanik lahkuda (16 K6).
- **canDelete server-tõde:** ruumiloendi vastus kannab `canDelete`/`canInvite`/`canTransfer` lipud; UI usaldab ainult neid; surnud `role === "ADMIN"` haru kustutatakse (16 K5). Lahkumine saab kinnitusdialoogi + ausa veakuva (16 K6b/c).

### E5 — Salvestuse nõusolekumudel: kestev, mitte hetkeline (audit 20.5 #1)

- **Nõusolek kehtib salvestuse kogu kestuse.** Sule kolm+üks rada, mis viivad ACTIVE salvestuse lõppolekusse egress'i peatamata (5 K1): (a) tavarajad, (b) hiline liituja salvestatakse küsimata (4 K1 — hiline liituja väravatakse: ACTIVE salvestus peatub või uus liige ootab nõusolekut), (c) withdraw puudub (5 K2 — lisa withdraw-UI, mis katkestab tulevase salvestuse), (d) **positiivne otsus** ei tohi demoteerida taotlust ACTIVE → READY_TO_RECORD: `updateRecordingReadiness` (service.js:488–493) ei puuduta ACTIVE-staatust (audit 20.4).
- **Ligipääs:** salvestisele pääseb ainult see, kes oli **kohal ja andis nõusoleku**; withdraw eemaldab ligipääsu.
- Consent-snapshot ja süsteemsõnumid võti+keel taha (4 K5, 5 K4) — enne RU/EN kasutajaid.

### E6 — Salvestuse failipool, egress ja retention (audit 20.5 #1 jätk)

- Egress-peatamise rajad finaliseeruvad **igal** kõne/ruumi/salvestuse lõpul (seotud E1 ristkoristusega). Tõrkerada ei jäta heli järelevalveta (12 K2).
- **Retention jõustatakse:** auto-purge vaikimisi 90 päeva; omaniku käsitsi kustutus; purge kustutab nii DB-rea, chunk'id kui failiobjekti (12 K1).
- Stabiilsusheuristika ei kärbi ega kustuta allikat vaikselt (12 K3); kataloogipaar on valvega leping (12 K5).
- `RECORDING_ENABLED=true` lülitatakse sisse **alles siis, kui E5+E6 on tõendatud** (sünteetiline runtime + mutatsioonikontroll). Enne seda jääb salvestus uinuvaks, kuid kood on paigas.

### E7 — Kohtumise kokkuvõtte kandja ja sündmused

- Ruumi lõppedes/arhiveerimisel kopeeritakse kokkuvõte **igale osalejale tema privaatsesse Minu dokumentide ruumi** (T07 pind; kasuta olemasolevat SavedAnalysis-/dokumendimustrit, owner-scoped). Koopia elab üle ruumi kustutuse/arhiveerimise.
- Lisa vajalikud minimaalsed **T04 sündmused/teavitused** ruumi/kõne/salvestuse elutsükli kasutajateele. Payloadis ainult ID, olek ja ohutu sihtlink — mitte sõnumi sisu, salvestise ega kokkuvõtte tekst.
- Reaalajakiht: koonda serialiseerimine ühte laadijasse, eemalda kuulajata publish'id; **ära** laienda SSE-d kõneseisu kandma (4 K7 vaikevalik).

## Selgelt väljas

- Professionaalne kinnitusring ja ülesanded (T20 COLLAB) — kasutavad seda ruumituuma, aga ei kuulu T12-sse.
- Kovisiooni ruumiline V2 (T13), supervisiooni ruum (T22), mentorluse ruum (T23).
- Uued LiveKit-funktsioonid (breakout, video-layout), AV-skann, transkriptsiooni ümberkirjutus (T07/T24 pind).
- Moderatsioonifilosoofia muutus, SSE kõneseisu-laiendus, sponsor-maksab-ruumi mudel (audit 20.4: praegu Subscription-põhine).
- Merge, deploy, PR, põhitööpuu puhastus, force-push, tootmisandmete lugemine, päris kasutajate testimine.

## Nõutud testilepingud

1. Aktiivse kõnega ruumi kustutamine lõpetab kõne, koristab osalejad ja peatab salvestuse; omanik ei jää kinni; auditirida tekib.
2. Ruumist/kõnest lahkumine koristab `CallParticipant` + consent-rea; viimase päris-osaleja lahkumisel käivitub auto-lõpp; fantoom-osalejat ei teki.
3. Race: topelt-ACTIVE-kõne, topelt-osaleja, topelt-salvestustaotlus ei teki (osalised unikaalindeksid + tingimuslikud üleminekud); mutatsioonikontroll indeksi eemaldamisel kukutab testi.
4. Voo-põhise ruumi (HELP_MATCH/PRE_INQUIRY/SERVICE_PROVIDER) omaniku-DELETE keeldub (409); ühine ajalugu säilib; `MANUAL_INVITE` kustutus töötab koristusega.
5. Ainult OWNER kutsub (MODERATOR/MEMBER 403); omanikuvahetus annab rolli üle tingimuslikult; `canDelete`/`canInvite`/`canTransfer` tulevad serverist.
6. Salvestus: hiline liituja ei salvestu küsimata; withdraw katkestab tulevase salvestuse + eemaldab ligipääsu; positiivne consent-otsus ei demoteeri ACTIVE-taotlust; egress peatub igal lõpurajal.
7. Salvestise ligipääs ainult kohal-olnud-ja-nõustunud kasutajal; auto-purge kustutab DB+chunk+faili 90 päeva pärast; omaniku käsitsi kustutus töötab.
8. Kohtumise kokkuvõte kopeeritakse igale osalejale privaatselt ja elab üle ruumi kustutuse.
9. GET-route'id hoiavad vealepingu 500-l; rate-limit enne kallist tööd; IP-võti pole võltsitav; pikkuspiirid kehtivad.
10. ET/EN/RU pariteet (sh consent-snapshot + süsteemsõnumid), klaviatuur, fookus, aria-live, mobiil ja reduced-motion katavad ruumi-, kõne- ja salvestusteed.

Käivita T12 sihttestid ja kahjustatud regressioonid (kovisiooni pere jagab `roomRoutes.js`/`service.js`-i — kontrolli, et ei murdu), muudetud failide lint, `npm run i18n:check`, Prisma validate + `db:migrate:check` migratsiooniahel, `git diff --check` ning production build. Täissviit ja sõltumatu release-audit jäävad T27-sse.

## Sünteetiline runtime ja DoD

Kasuta ainult lokaalset sünteetilist DB-d ja olemasolevaid testidentiteete. Tõenda: elutsükli ristkoristus (ruumi/kõne/liikmesuse lõpp), race-indeksite käitumine, salvestuse nõusoleku kestvus + withdraw + egress-peatus + retention-purge (kui LiveKit-fixture ohutult käivitatav; muidu `NOT_PROVEN`), voo-ruumi kustutuskaitse, omanikuvahetus ja kokkuvõtte privaatkoopia. Korista kõik loodud ruumid, kõned, osalejad, salvestused, jobid ja failid. Päris LiveKit egress, päris salvestusfailid ja `RECORDING_ENABLED=true` tootmises on `NOT_PROVEN` → T27.

Valmis on siis, kui E1–E7 on samas harus, elutsükli ristkoristus on serveris testitud, race-indeksid on paigas, salvestuse nõusolek kehtib kestuse ja withdraw toimib, voo-ruumi ühist ajalugu ei saa ühepoolselt hävitada, kokkuvõte jääb igale osalejale privaatselt, worktree on puhas ning commit/push tehtud. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne

Esita worktree, haru, kasutatud `main`-baasi SHA, lõppcommit/remote SHA, migratsioonid, E1–E7 kokkuvõte, testid/lint/i18n/Prisma/diff-check/build, sünteetiline runtime/cleanup või `NOT_RUN`/`NOT_PROVEN`, `RECORDING_ENABLED` seis, välja jäetud osad ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

Pärast lõpparuannet teeb Fable fokuseeritud lepingu kontrolli: elutsükli ristkoristus, race-indeksid, salvestuse nõusoleku kestvus + egress-peatus, voo-ruumi kustutuskaitse ja kokkuvõtte privaatkoopia. Ta ei korda täissviiti, buildi ega tervikauditit.

## Lõpetamisel: uuenda AINULT `SEIS.md`

Kui töö on valmis, katkeb või jääb pooleli, uuenda [`SEIS.md`](./SEIS.md) — **ja mitte ühtki teist registrit**:

1. **Seisutabeli rida** → uus olek, haru + lõppcommit SHA, kasutatud baas-SHA, väravate tulemus, mis jäi `NOT_PROVEN`.
2. **Järjekord** → mis avanes, mis on järgmine.
3. **Vananenud väide** → kui selgus, et mõni SEIS.md lause on vale, paranda kohe seal.

Masterregistrit, arendusprogrammi ega omanikuvaadet **ei uuendata teema oleku pärast**. **Kirjuta SEIS.md-sse ka pooleliolek.**
