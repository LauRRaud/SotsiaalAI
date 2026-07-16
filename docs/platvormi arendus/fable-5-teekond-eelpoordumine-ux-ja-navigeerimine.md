# Teekond → eelpöördumine: UX-, navigeerimis- ja ruumilise ülesehituse analüüs

STATUS: COMPLETE

- Koostatud: 2026-07-15
- Analüüsi alus: aktiivne `main` (viimane commit 7ae76d5b)
- Skoop: pöörduja teekond Teekonna loomisest eelpöördumise saatmise ja hilisema jätkamiseni. MITTE server-/turva-/andmemudeli audit — varasemad autoriseerimise ja privaatsuse auditid kehtivad ja neid ei korratud.
- Meetod: sihitud dokumendi- ja koodilugemine + kasutaja 3 kuvatõmmist (päris brauser) + **autenditud runtime-kontroll** localhost:3000 vastu (playwright-core + päris Chrome, temp-login-tokenid; brauseripaan ei hüdreeri seda rakendust — teadaolev piirang). Kõik testandmed (1 proovi-Teekond, 5 login-tokenit) on DB-st kustutatud; pöördumisi ei loodud ega saadetud.
- Runtime-tõendite failid: sondi kuvatõmmised ja `findings*.json` sessiooni scratchpadis (ajutised; olulised väärtused on tekstis tsiteeritud).

## 0. Kokkuvõte (TL;DR)

Teekonna → eelpöördumise **serveripoolne rada töötab** (orientatsioonikaardi ptk 4 rada 1 on tõene), aga **kasutajapoolne kiht on kolmel viisil pooleli**, ja need kolm võimendavad üksteist:

1. **Kest sööb sisu ära.** Teekonna töölaud elab vestluslehe klaaspaneelis, mille `.panel-body` on `overflow: hidden` (panel.css:97); töölauapaneeli oma rullimis-häkk (WorkspacePanel.jsx:278–294) sihib elementi, mis pole scroll-konteiner → **hiire/puutega kerimine on võimatu**. Kasutaja jäi „Ülevaade enne salvestamist" ekraanil sõna otseses mõttes kinni — salvestusnupud on ekraani all, kättesaamatud. See üksi muudab voo läbimatuks.
2. **Esitluskiht on ehitamata.** Sammuriba renderdub kokkujooksva tekstireana („1Täpsusta eelinfot2Eelinfo ülevaade3Adressaat…"), kiibid kleepuvad kokku („hoolduskoormusvaimne tervis"), teekonnarada näitab „✓Olukord kirjeldatudtehtud". Markup on kirjutatud disainitud paigutuse jaoks (aside, stepper, kaardid), aga nende CSS puudub — kasutaja näeb stiilimata skeletti klaasil.
3. **Olek ei ela URL-is ja lubadused ei pea.** Loomise 3 ekraani, eelpöördumise 5+1 sammu ja mustandid on ainult React-mälus: tagasi/edasi/F5/Esc kaotab töö hoiatuseta (runtime-tõendatud). Jagamisvaliku märkeruudud EI muuda tegelikult kaasa minevat teksti (server arvestab ainult `assistiveDevices` võtit) ja sama valikut küsitakse teist korda teiste vaikeväärtustega.

**Soovitus:** üks juhitav rada „kaks ruumi, üks lävi" — privaatne Teekonna lõuend + eelpöördumise 4-sammuline koostamisrada, mille vahel on üks aus „mida võtan kaasa" lävi; iga samm on URL-is, mustand püsib, privaatsuse seis on igal sammul nähtav. Flight-esitus sobib selle raja *pealiskihiks* alles pärast oleku- ja esitluskihi valmimist, mitte asenduseks (ptk 4–5).

## 1. Aktiivse kasutajateekonna kaart

### 1.1. Konteinerarhitektuur (miks miski üldse nii välja näeb)

Kõik lehed peale avalehe elavad **ühes klaaspaneelis** (`PanelFrame` → `.panel-scrim > .panel > .panel-body`), mis hõljub ruumi (Galaxy-tähevälja) kohal. Sisu kerib paneeli **sees** (`.panel-body { overflow-y: auto }`, panel.css:383 — v.a vestlusleht, kus see on `hidden`, panel.css:90–99). Paneeli nurkades on ruumiülesed juhikud: × (sulgemisrist → enamasti avaleht), ⓘ (lehe info), üleval keskel ruumi juhtpaneeli sang. Lehe „tagasi"-nool on paneelides globaalselt peidetud (panel.css:377–381, tellija varasem otsus).

Teekonna ja eelpöördumise pinnad paiknevad **kolmes eri kestas**:

| URL | Kest | Sisu |
|---|---|---|
| `/teekond` | **redirect** → `/vestlus?workspace=journey` (app/teekond/page.jsx:4) | Teekonna töölaud vestluslehe töölauapaneeli SEES (`WorkspacePanel` → `JourneyDashboard embedded`) |
| `/teekond/[id]` | iseseisev kitsas täisleht paneelis (data-chat="1", ~680 px lai, ~700 px kõrge) | `JourneyDetail` — pikk detailvaade (runtime: 4137 px sisu 700 px kastis) |
| `/eelpoordumised` | iseseisev täisleht paneelis (data-chat="0") | `WorkspaceFeaturePage feature="pre_inquiries"` → `PreInquiriesSurface` |
| `/vestlus?workspace=pre_inquiries` | sama pind töölauapaneeli sees | sama `PreInquiriesSurface embedded` |

Sama pind avaneb eri kestas sõltuvalt sellest, kust kasutaja tuli, ja kestad käituvad kerimisel ning väljumisel erinevalt (ptk 2).

### 1.2. Teekonna loomine (kasutaja kuvatõmmiste rada)

Kõik kolm kuvatõmmist on `/vestlus?workspace=journey` vaates. `JourneyDashboard` hoiab kolme ekraani **ühe URL-i sees** React-olekus `mode: "list" | "start" | "review"` (JourneyDashboard.jsx:391):

1. **list** — kui Teekondi pole: ainult nupp „Alusta teekonda"; kui on: „Teekonna tööpind" + 4 kiirnuppu + aktiivsete/arhiveeritud loend.
2. **start** (kuvatõmmised 1–2) — tervitus, üks textarea, „Alusta teekonda" → `POST /api/journeys/draft`. NB: mustandi koostab **sünkroonne heuristika, mitte LLM** (lib/journey/draft.js) — sellest ka pinnapealsed pealkirjad („hoolduskoormus") ja üldsõnalised kiibid.
3. **review** (kuvatõmmis 3) — pealkiri, kokkuvõtte textarea, kiibiplokid, 4 „suuna" nuppu, „Salvesta teekond" → `POST /api/journeys` → redirect `/teekond/[id]`.

Paralleelselt eksisteerib **teine loomisrada vestluses**: komposeri „Teekonna režiim" (`workflow=journey`, ChatBody.jsx:2250) — AI vastab vestlussõnumis mustandiga, salvestuskäsklus salvestab. Kolmas sisenemistee on karusselli kaart „Teekond" (RoomStage.jsx:790 → `/vestlus?workspace=journey`).

### 1.3. Teekonna detailvaade `/teekond/[id]`

Üks pikk leht (JourneyDetail.jsx), järjestus: päis (Muuda/Arhiveeri) → privaatsusplokk → **Teekonnarada** (6 sammu) → Teenusekaardi plokk → [Abivahendid] → [Abivahendus] → **„Koosta eelpöördumine…"** (jagamisvaliku paneel) → **Teenuse jätkumise kontroll** (suur vorm) → [Tervisekontakt] → sisuplokid → Tehtud sammud + Seotud asjad (sh „Seotud eelpöördumised" → `/eelpoordumised?openInquiry=<id>`).

Runtime-mõõt (proovi-Teekond „hoolduskoormus": 18 `<section>`-i, 26 tegevuselementi, „Koosta eelpöördumine" 3 eksemplari, „Ava teenusekaart" 3, „Lisa dokument" 2; tingimuslike plokkide täiskomplektiga oleks rohkem). Osa sama nimega nuppe avab jagamisvaliku, osa on otse-lingid ilma selleta (JourneyDetail.jsx:1232 vs 1306).

### 1.4. Eelpöördumise pind `/eelpoordumised` (pöörduja roll)

`PreInquiriesSurface` (WorkspaceFeaturePage.jsx:666–2777) teenindab üht kolmest: pöörduja koostamisvoog, vastuvõtja töölaud, admin (rollilülitid). Pöörduja voog:

- **Alustusvalik**: 3 kaarti — „Aita mul leida, kelle poole pöörduda", „Mul on kontakt juba olemas", „Jätkan Teekonnast" (keelatud ilma `fromJourney` parameetrita, vihjega „ava eelpöördumine konkreetse Teekonna vaatest").
- **Sammuriba**: 5 vabalt klõpsatavat sammu — Täpsusta eelinfot / Eelinfo ülevaade / Adressaat / Pöördumise eelvaade / Minu eelpöördumised. Olek AINULT React-state'is.
- Peidetud **kuues samm** `journey` (Teekonnast tulles) — jagatava valiku ekraan, mida ribal EI OLE; runtime: ükski riba samm pole siis aktiivne.
- **collect**: kaks paradigmat üksteise all — struktureeritud eelkaardistus (viis, 4 välja, eluvaldkondade küsimustik `<details>`-ina) JA vestlusassistent (ConversationView + ChatComposer → `/api/pre-inquiries/assist`); vasakul (DOM-is enne sisu) „Eelinfo ülevaade" külgpaneel.
- **recipient**: KOV/teenuseosutaja filter, otsing, soovituskaardid (3→12), „Vali see kontakt" hüppab automaatselt eelvaatele.
- **preview**: teema + mustand + Teekonnast tulnud info plokk + privaatsuskontrolli 409-dialoog (Muudan teksti / Saada maskeeritult / [Saada siiski]) + „Midagi ei saadeta automaatselt" + nupud Ava e-kirjana / **Salvesta** / **Saada platvormis** / Kopeeri / Laadi alla.
- **saved**: „Minu eelpöördumised" (Ava/Muuda/Kopeeri/Laadi alla/Arhiveeri; U3 tagasivõtt/parandus elavad serveril).

### 1.5. Teekonnast eelpöördumisse üleandmine (andmevoog)

1. `/teekond/[id]` jagamisvalik → URL `share=summary,domains,...` →
2. mount'il `POST /api/journeys/[id]/pre-inquiry-draft {shareKeys}` →
3. `buildPreInquiryPrefillFromJourney` (lib/journey/preInquiryHandoff.js:99–168) → prefill (topic, situation, municipality, recipientType-heuristika, suggestedMessageDraft, sharedJourneyInfo) →
4. samm `journey`: **teine** valikukomplekt (`journeyShareSelections`, vaikimisi alati summary+domains+personWish+missingInfo) →
5. „Salvesta/Saada" filtreerib AINULT `sharedJourneyInfo` ploki (WorkspaceFeaturePage.jsx:1387–1393; 543–558); `situation`/`draft` jäävad prefilli kujule →
6. INTERNAL-saatmine → vastuvõtja vaade; side `sourceJourneyId` kaudu, tagasilink Teekonna „Seotud eelpöördumised" all.

### 1.6. Hilisem jätkamine

- Teekond → „Seotud eelpöördumised" → `openInquiry` süvalink (töötab, ka loendist väljas kirjete jaoks — WorkspaceFeaturePage.jsx:1185–1226).
- `/eelpoordumised` samm 5 → Ava/Muuda (avaneb eelvaatel).
- U2 „Jätka siit" võib viidata pöördumisele.
- **Koostamise KESKEL vahesalvestust pole**: enne „Salvesta eelpöördumine" nuppu ei eksisteeri mustandikirjet; collect/recipient sammudelt lahkumine kaotab kõik (runtime-tõendatud, ptk 2 P1-3).

## 2. Olulisemad UX- ja navigeerimisprobleemid (tõenditega)

### P1-1. Kerimine on töölauapaneelis võimatu ja täislehtedel ebausaldusväärne

- **Kood:** vestluslehe paneelikeha on `overflow: hidden` (panel.css:90–99, `[data-conversation][data-chat] .panel-body`). Töölauapaneeli rullimis-häkk (`handleEmbeddedPanelWheelCapture`, WorkspacePanel.jsx:278–294) teeb `preventDefault()` ja omistab `scrollTop`-i elemendile `.workspace-dashboard-panel`, millel pole üheski CSS-failis overflow-reeglit (workspace.css:11–22) → omistus on tulemusteta.
- **Runtime (sond, 1600×900):** review-ekraanil `panelOverflowY:"visible"`, sisu 1121 px / kast 840 px, `bodyOverflowY:"hidden"`, kaks järjestikust rattaimpulssi → `wheelMoved:false`. Kasutaja kuvatõmmis 3 = sama seis päris brauseris.
- **Täislehed:** `/teekond/[id]` keha on `overflow-y:auto` ja programmiline kerimine töötab, kuid rattasündmusi püüab aken-tasandi karussellikuulaja (GlassCarousel.jsx:309–318, `passive:false`), mille valve (`data-room-mode==="panel"`, rida 277) sõltub async-atribuudist — sond mõõtis ühel käivitusel `afterWheel:0` + `PageDown` töötab, teisel käivitusel ratas töötas. St kolm eri kerimissüsteemi (karusselli window-kuulaja, töölaua capture-häkk, paneelikeha overflow) konkureerivad; tulemus sõltub lehest ja ajastusest.
- **Mõju:** töölauapaneelis on review-ekraani salvestusnupud kättesaamatud (ka puutel — overflow:hidden blokeerib ka puutekerimise); täislehel on ratas ebausaldusväärne. See on terve voo blokeerija ja üksi piisav seletus „ei saa aru, kuidas süsteem töötab" kogemusele.

### P1-2. Jagamisvaliku lubadus ei vasta tegelikule üleandmisele

- **Kood:** server kasutab shareKeys-ist AINULT `assistiveDevices` (lib/journey/preInquiryHandoff.js:104); `situation` sisaldab alati kokkuvõtet + teemasid + soovitatud samme + **riskisignaale** (read 129–137), `sharedJourneyInfo` alati summary/domains/missingInfo/suggestedActions (139–150). Riskisignaale ei paku ükski valikuloend.
- **Runtime:** Teekonna poolel võtsin „olukorra kokkuvõte" linnukese MAHA (`share=domains,missingInfo,wish`); eelpöördumise lehel oli kokkuvõte („hooldan ema ja ei jaksa…") olemas ① „Teekonnast tulnud eelinfo" plokis, ② „Eelinfo ülevaate" külgpaneelis ja ③ genereeritud mustandis (`draft_leak_despite_uncheck:true`); teine märkeruutude komplekt näitas „olukorra kokkuvõte" uuesti LINNUTATUNA.
- **Mõju:** kaks järjestikust, eri sõnastuse ja eri tagajärgedega „vali jagatav info" ekraani, kummagi mõju tekstile pole jälgitav. Kasutaja näeb lõpptulemust eelvaates ja saab käsitsi kustutada, seega kõva piir „saatmisele eelneb eelvaade ja kinnitus" formaalselt kehtib — aga piir **„kasutaja valib teadlikult jagatavad osad" on praegu illusioon**. (Sama muster ka JourneyDetaili valikus: saadavuse-arvutus on olemas, aga kasutamata — `shareOptions` kolmas element, JourneyDetail.jsx:473–483 — st valida saab ka osi, mida Teekonnal pole.)

### P1-3. Olek ei ela URL-is; tagasi/edasi/F5/Esc kaotab töö hoiatuseta

- **Runtime:** ① „start"-ekraani textarea's Esc → URL `/vestlus`, vorm ja tekst kadunud (WorkspacePaneli window-Escape ei kontrolli fookust, WorkspacePanel.jsx:434–443; PanelFrame'i oma välistab tekstiväljad korrektselt — PanelFrame.jsx:143–144). ② Eelvaate mustandisse kirjutasin muudatuse, brauseri tagasi + edasi → muudatus kadunud, prefill jooksis uuesti, ükski samm ribal aktiivne (`editSurvived:false, activeSteps:[]`).
- **Kood:** `mode` (Teekond) ja `activeWorkflowStep` (eelpöördumine) pole URL-is; mustandi vahesalvestust (local/session/server) ei ole; `beforeunload` hoiatust ei ole.
- **Mõju:** kõige haavatavamal hetkel (tundlik olukirjeldus just kirjutatud) kaotavad kolm tavalist žesti töö jäljetult. See on ka usalduse küsimus: platvorm lubab „sinu info on sinu kontrolli all", aga kaotab selle ise.

### P1-4. Sammud, mida sammuriba ja URL ei kajasta

- **Runtime:** Teekonnast tulles on aktiivne peidetud „journey" samm — ribal pole ÜKSKI samm aktiivne; pärast back/forward sama seis. Sammuribal pole tehtud/pooleli olekuid; kõik 5 on alati klõpsatavad; „Minu eelpöördumised" on sisult arhiiv, mitte koostamise samm.
- **Mõju:** „kus ma olen / mis on järgmine samm" jääb vastuseta; koostamise ja arhiivi segunemine ähmastab, kas midagi on juba saadetud.

### P1-5. Väljumised viivad kolme eri kohta, nähtavat „tagasi" pole

- **Kood + runtime:** × viib avalehele (PanelFrame.jsx:132–134; erand: töölaualt lipuga avatud alamleht → töölaud); Esc töölauapaneelis → töölaua juurvaade (andmekaoga, vt P1-3); brauseri tagasi → eelmine URL; SubpageHeaderi tagasi-nool on CSS-iga peidetud KÕIGIS paneelides (panel.css:377–381), kuigi kood renderdab selle ja `onBack` loogika on alles. `/eelpoordumised` täislehe × viib avalehele, MITTE Teekonda, kust tuldi.
- **Mõju:** ühtegi nähtavat „üks samm tagasi" affordantsi pole; × karistab (viskab maja ette); kolm nähtamatut, eri sihtidega väljumisteed = kadumistunne. Kasutaja kuvatõmmistel ongi ainsad nähtavad juhikud × ja kaks ⓘ-d.

### P1-6. Esitluskiht on nendel pindadel ehitamata

- **Runtime (kuvatõmmised):** sammuriba = kokkujooksnud tekstirida „1Täpsusta eelinfot2Eelinfo ülevaade3Adressaat4Pöördumise eelvaade 5Minu eelpöördumised"; kiibid kleepuvad („hoolduskoormusvaimne tervis"; „PrivaatnealustatudTeenusekaartUuendatud 15.07.2026"); teekonnarada „✓Olukord kirjeldatudtehtud"; „Eelinfo ülevaate" külgpaneel virnastub sisu ETTE (grid-CSS puudub); sisu voolab visuaalselt klaaspaneelist välja. JourneyDashboard/JourneyDetail/PreInquiriesSurface markup on klassideta („bare" elemendid) — paigutus on kirjutatud, aga selle CSS puudub.
- **Mõju:** kasutaja ei suuda eristada pealkirja, olekut, nuppu ja kiipi; „pooleli disain" mõjub katkisena ja lisab kognitiivset koormust rohkem kui ükski üksik viga.

### P2-1. Teekonna detailvaade on tegevuste sein; teekonnarada valetab

- **Kood:** JourneyRoadmap (JourneyDetail.jsx:302–343) märgib sammud 1–2 alati „tehtud", 3–4 „järgmine" ainult `primaryPath` järgi ega loe `linkedPreInquiries` — saadetud eelpöördumisega Teekond näitab ikka „Eelpöördumine koostatud — mitte alustatud". Runtime: 18 sektsiooni / 26 tegevust ühel 680 px kaardil.
- **Mõju:** progressinäidik, mis ei peegelda tegelikkust, on halvem kui puudumine; tegevuste sein ei vasta küsimusele „mis on JÄRGMINE samm".

### P2-2. Review-ekraani „suunanupud" näevad välja nagu tegevused, aga on vormiväli

- **Kood:** JourneyDashboard.jsx:252–264 — „Ava teenusekaart" / „Koosta eelpöördumine" / „Lisa dokument" / „Loo abisoov" teevad ainult `updateField("primaryPath", ...)`.
- **Runtime:** klõps „Ava teenusekaart" → URL ei muutu, midagi ei avane; hiljem selgus, et salvestatud Teekonna rada näitas selle klõpsu tõttu sammu 3 „järgmine soovitatud samm" — **nupp muutis vaikselt salvestatavat välja**.
- **Mõju:** esimesel kokkupuutel platvorm „ei reageeri"; tegelik kõrvalmõju on nähtamatu.

### P2-3. Kaks paralleelset sisendiparadigmat collect-sammul (+ kolmas vestluses)

- **Kood:** collect = struktureeritud eelkaardistus + vestlusassistent üksteise all (WorkspaceFeaturePage.jsx:2158–2471); Teekonna loomiseks on lisaks vestlustöövoog (ChatBody) ja komposeri režiimid. Tulemuste omavaheline suhe pole kasutajale nähtav.
- **Mõju:** kognitiivne topeltkoormus; sihtrühmale (sh eakad hooldajad) on kaks konkureerivat vormi sama asja jaoks ülekoormus.

### P2-4. Pöörduja ja vastuvõtja pind on üks 2100-realine komponent

- **Kood:** `PreInquiriesSurface` haruneb `isRecipientRole`/`isAdmin` lippudega; jagatud olekuruum. Pöörduja voo ümberehitus peab vastuvõtja haru puutumata jätma — praegune põimitus teeb selle riskantseks. (Arhitektuurimärkus, mitte vastuvõtja UI ettepanek.)

### P3-1. Katkised täpitähed ja kõvakodeeritud tekstid

- **Runtime + od-kontroll:** adressaadisammu tühiteade sisaldab literaalseid `?` märke allikas: „lisa v?hemalt piirkond v?i KOV ning l?hike olukorra kirjeldus" (WorkspaceFeaturePage.jsx:2594); privaatsusdialoogi fallback „Vali enne jatkamist… toodelda" (2620). Suur osa pöörduja raja tekste on ilma `t()`-võtmeta eesti keeles (sammuriba, alustusvalikud, read 60–84) — ru/en sellel rajal ei tööta.

### P3-2. Kaks ⓘ-nuppu kõrvuti

- **Runtime:** töölauavaates kaks info-nuppu koordinaatidel (259,43) ja (304,35) — PanelFrame'i „workspace" ⓘ + SubpageHeaderi „journey" ⓘ (workspace.css:74 välistusreegel jätab teise voolu-paigutusse). Kasutaja kuvatõmmistel nähtav.

### P3-3. Mobiili- ja klaviatuuritähelepanekud

- **Runtime:** mobiilis (375×812) on detailvaate paneel täislai, horisontaalset ülevoolu pole, keha kerib programmiliselt — puutekerimine täislehtedel eeldatavasti töötab; töölauapaneelis on sama `overflow:hidden` blokk ka puutel. PageDown kerib täislehti (klaviatuur töötab seal, kus ratas ei tööta) — aga Esc-oht (P1-3) tabab just klaviatuurikasutajat. `prefers-reduced-motion` eraldi käsitlust sellel rajal ei leidnud (kaamerasõidud elavad vestluse CSS-is).

## 3. Kognitiivse koormuse analüüs pöörduja vaatest

Hindamisraam: pöörduja on sageli koormatud (hooldaja, kriisieelne seis), kasutab platvormi harva, ei tunne mõisteid „Teekond", „eelpöördumine", „adressaat".

**1. Kus ma praegu olen?** — Vastust ei anta. URL ütleb `/vestlus`, pealkiri „Teekond"; ruum (Galaxy) on igal pool sama; kest (paneel) on igal pool sama klaas; sammuriba kas puudub (Teekond) või ei kajasta tegelikku sammu (journey-samm ribalt puudu). Ainsad püsivad orientiirid on × ja ⓘ — kumbki ei ütle asukohta.

**2. Mida ma siin teen?** — Alustusekraan on voo parim hetk: üks küsimus, üks väli, selge lubadus („Sa ei pea kõike teadma…"). Review-ekraan ja detailvaade vastavad halvasti: pealkiri ütleb „vaata üle", aga ekraan pakub 4 pettvat suunanuppu, 20+ tegevust ja stiilimata kiipe; eelpöördumise collect pakub kaht paradigmat korraga.

**3. Mis on järgmine samm?** — Kolm eri „järgmise sammu" süsteemi räägivad läbisegi: Teekonna roadmap (valetab), review suunanupud (vormiväli), eelpöördumise sammuriba (vaba klõpsimine, olekuta). Ükski ei ole autoriteetne. Lisaks katkeb rada füüsiliselt (kerimisblokk) enne salvestusnuppe.

**4. Mis jääb privaatseks, mis läheb edasi?** — Tekstilubadused on olemas ja korrektsed igal ekraanil („Teekond on privaatne", „Midagi ei saadeta automaatselt", vaatajapõhised privaatsusmärkused JourneySharedInfoBlockis). Käitumuslik kinnitus aga puudub: valik ei muuda nähtavalt midagi (P1-2), sama küsitakse kaks korda, riskisignaalid liiguvad ilma küsimata prefilli. Privaatsuse eelkontroll (409 + „Saada maskeeritult") on tugev ja päriselt töötav muster — aga see käivitub alles salvestamisel, mitte info kaasavõtmisel.

**Koormuse allikad kokkuvõttes:** (a) füüsiline blokk (kerimine); (b) esitluse müra (stiilimata fragmentide sein); (c) otsustuskohtade üleküllus (3 loomisrada, 3 alustusviisi, 2 valikuekraani, 5+1 sammu, 20+ nuppu detailis); (d) tagasiside puudumine (vaiksed kõrvalmõjud, kadunud töö); (e) mõistete koorem (Teekond vs eelpöördumine vs eelkaardistus vs eelinfo — 4 sarnast sõna ühel rajal).

## 4. Kolme ülesehitusvariandi võrdlus

### V1: Selge järjestikune sammuriba / juhendatud viisard

Klassikaline 4–5-sammuline viisard mõlemale poolele (Teekonna loomine 2 sammu; eelpöördumine 4), URL-põhine olek, lineaarne edasi/tagasi, külgriba kokkuvõte.

- **Plussid:** madalaim teostusrisk; parim ligipääsetavus (teadaolevad mustrid, fookusjärjekord, SR-tugi); vastab otse küsimustele 1–3; URL-leping tuleb loomulikult; mobiilis triviaalne.
- **Miinused:** ei kasuta ruumilist identiteeti (jääb „vorm klaasil"); lineaarne jäikus võib sundida järjestust seal, kus kasutaja tahab hüpata (adressaat enne sisu on legitiimne rada — praegune known_contact); Teekonna-poolne „tegevuste sein" jääks lahendamata (viisard katab ainult koostamise).
- **Riskid kõva piiri suhtes:** madalad; privaatsuslävi on lihtsalt üks samm.

### V2: Flight-tüüpi ruumiline rada (sügavuses vahetuvad lõuendid)

Iga tööetapp on ruumi sügavusse paigutatud lõuend (`public/room/flight-effect.md` tehnika); kerimine/klõps/klaviatuur liigutab järgmise lõuendi ette, eelmised taanduvad.

- **Plussid:** lahendab otseselt „kõik korraga ühel ekraanil" probleemi (üks ülesanne korraga = P2-1/P2-3 ravim); annab ruumilise mälu („minu privaatne on taga, saatmine on ees"); ühtib platvormi põhiotsusega (ruum on liides) ja lähtekohadokumendi sooviga („eelpöördumine: pikk sisestusvoog → rahulik lõuendite teekond").
- **Miinused ja ausad riskid:** ① flight EI paranda ühtegi praegust juurviga — oleku-URL-i, mustandikaitse, jagamislepingu ja esitluskihi puudumine jäävad; ② kerimine kui primaarne navigatsioon on JUST SEE sisend, mis praegu on katki ja mille eest võistleb juba kaks süsteemi (karussell + paneel) — kolmanda kerimistarbija lisamine ilma sisendi-omandiõiguse reeglita süvendaks P1-1; ③ asukohakaotuse oht ilma püsiva sammuindikaatorita; ④ ligipääsetavuse erirada (reduced-motion lame variant, iga lõuendi otselink) on kohustuslik lisatöö; ⑤ kõva piir „midagi tundlikku ei juhtu kerimisega" tähendab, et flight tohib ainult VAHETADA VAADET, mitte kinnitada valikuid — st saatmisele eelnevad sammud vajavad ikkagi eksplitsiitseid nuppe.
- **Kus flight päriselt aitab:** collect-sammu eluvaldkondade küsimustik (praegu `<details>` kuhil), detailvaate sektsioonide jada, eelvaate „mida adressaat näeb" stseen. Kus ei aita: adressaadi otsing (vajab võrdlemist), salvestatud loend (vajab skaneerimist), kriisiinfo (peab olema alati kättesaadav ilma läbimiseta).

### V3 (soovitatav): Hübriid „kaks ruumi, üks lävi"

Struktuur V1-lt (URL-põhised sammud, eksplitsiitsed kinnitused), ruumiline tähendus V2-lt (kaks selgelt eristuvat ala + nähtav üleminek), flight ainult esituskihina hiljem.

- **Idee:** pöörduja maailmas on KAKS kohta — ① „Minu Teekond" (privaatne ruum: loend + detail ühe lõuendina, rahulik valgus, privaatsuse valdusmärk) ja ② „Pöördumise koostamine" (juhitav 4-sammuline rada: Sisu → Adressaat → Eelvaade → Kinnitus). Nende vahel on **üks lävi** — „Mida võtan kaasa?" ekraan, mis ON seesama jagamisvalik (ainus!), ausa lepinguga (valik = tegelik payload). Lävi on ka ruumiline signaal: valgus/foon muutub, tekstiline kinnitus „Sellest hetkest koostad dokumenti, mida näeb [adressaat]".
- **Plussid:** vastab kõigile 4 küsimusele; lahendab topeltvaliku (P1-2) struktuurselt; lubab hüpata (adressaat enne sisu = sammud on URL-is, järjekord soovituslik); ruumiline keel toetab privaatsuspiiri mõistmist; flight'i saab hiljem lisada raja esitusena ilma struktuuri muutmata.
- **Miinused:** rohkem tööd kui V1 (läve-ekraan + kaks ala); nõuab kestaotsust (kas Teekond jääb /vestlus paneeli — vt Tooteotsused).

**Hinnang:** V2 puhtal kujul praegu kahjulik (võimendaks P1-1 ja P1-3); V1 oleks kiire, aga jätaks Teekonna-poole seina alles ja ei kasutaks platvormi ruumilist keelt; **V3 on õige siht** — kusjuures selle esimene teostusetapp ON sisuliselt V1 (lame, URL-põhine, kinnitustega) ja flight tuleb pealiskihina alles siis, kui sisendi-omandiõigus ja reduced-motion rada on paigas.

## 5. Soovitatud põhimudel

**„Kaks ruumi, üks lävi, üks rada."**

1. **Minu Teekond** (privaatne ala): üks lõuend, mille keskmes on OLUKORD (kokkuvõte + kiibid) ja mille ainus progressinäidik on **aus teekonnarada** (arvutatud päris andmetest: linkedPreInquiries, seotud dokumendid, ruumid). Iga rajasamm kannab max 1–2 tegevust; abitööriistad (jätkumiskontroll, tervisekontakti küsimused, abivahendus) on kokkupandavad „tööriistakaardid", MITTE järjestikused sektsioonid. Detailvaade ja loend on sama ruumi kaks fookusseisundit (loend = kaugvaade, detail = lähivaade).
2. **Lävi „Mida võtan kaasa?"**: ainus jagamisvalik. Iga valik näitab kohe elavat eelvaadet kaasamineva teksti muutusest (valik = payload; `assistiveDevices`-laadne serverileping kõigile võtmetele). Riskisignaalid EI liigu kunagi vaikimisi; kui kasutaja tahab, lisab käsitsi. Läve läbimine = nähtav ruumi/valguse muutus + tekstiline kinnitus, kes hakkab nägema.
3. **Koostamise rada** (4 sammu, iga samm = oma URL): ① Sisu (ÜKS paradigma: vestluslik täpsustaja, mille kõrval elab struktuurne kokkuvõte — mitte kaks eraldi vormi); ② Adressaat; ③ Eelvaade ja privaatsuskontroll (näita TÄPSELT saadetavat versiooni + „adressaat näeb" simulatsioon + 409-maskeerimisdialoog praegusel kujul); ④ Kinnitus/Tulemus (saadetud/salvestatud/allalaaditud + „mis edasi" + tagasivõtu õppetund U3-st). „Minu eelpöördumised" EI ole raja samm — see on eraldi arhiivivaade (kest: sama ala, eraldi sissepääs).
4. **Sammuseis on alati nähtav ja aus:** rajasammud koos tehtud/pooleli/ees olekutega; peidetud samme ei eksisteeri; katkestamine ja jätkamine käib sammu URL-i kaudu.

Kriisirada: igal raja sammul püsiv, rajast sõltumatu „Kiire abi" riba (112/Lasteabi/Ohvriabi), mis EI OLE raja samm ega sõltu kerimisest/animatsioonist — vastab kõvale piirile „kriisirada eristub tavavoost".

## 6. Ekraanide/lõuendite järjestus (tekstiline)

```text
[A] Minu Teekond (loendi-fookus)            URL: /teekond
    – aktiivne Teekond + „Jätka" + „Alusta uut"
    – arhiiv kokkupandav; privaatsuse valdusmärk alati nähtav

[B] Teekonna loomine, samm 1: Kirjeldus     URL: /teekond/uus
    – üks textarea (praegune parim ekraan jääb)
    – mustand autosalvestub lokaalselt (taastatav)

[C] Teekonna loomine, samm 2: Ülevaade      URL: /teekond/uus?samm=ulevaade
    – pealkiri, kokkuvõte, kiibid; MITTE ühtegi „suunanuppu"
    – „Salvesta teekond" / „Muuda kirjeldust" / „Loobu"

[D] Teekonna detail (lähivaade)             URL: /teekond/[id]
    – olukord + aus rada + tööriistakaardid
    – „Koosta eelpöördumine" TÄPSELT ÜKS kord (raja sammul)

[E] Lävi: Mida võtan kaasa?                 URL: /eelpoordumised/uus?fromJourney=ID&samm=lavi
    – ainus jagamisvalik; elav payload-eelvaade; ruumi/valguse muutus

[F] Rada 1/4: Sisu                          URL: /eelpoordumised/uus?samm=sisu
    – vestluslik täpsustaja + struktuurne kokkuvõte kõrvuti (üks süsteem)
    – ilma Teekonnata sisenejal algab siit (fromJourney puudub → lävi vahele)

[G] Rada 2/4: Adressaat                     URL: /eelpoordumised/uus?samm=adressaat
    – KOV/teenuseosutaja, otsing, soovitused + kättesaadavus (praegune sisu)
    – „known_contact" sisenemine hüppab siia (recipientEntryId eeltäidetud)

[H] Rada 3/4: Eelvaade ja privaatsus        URL: /eelpoordumised/uus?samm=eelvaade
    – saadetav versioon 1:1; „adressaat näeb" plokk; 409-maskeerimine;
      saatmisviisi selgitus (platvorm / e-kiri / ainult fail)

[I] Rada 4/4: Kinnitus ja tulemus           URL: /eelpoordumised/uus?samm=kinnitus
    – eksplitsiitne „Saada" / „Salvesta mustandina" / „Laadi alla"
    – tulemus + tagasivõtu/paranduse selgitus + „tagasi Teekonda" link

[J] Minu eelpöördumised (arhiiv)            URL: /eelpoordumised
    – loend + staatused; „Ava" → [H] vaates; vastuvõtja vaade jääb eraldi
      (sama URL, teine roll — EI muudeta selles töös)
```

Flight-esitus (hiljem, valikuline): [E]→[F]→[G]→[H]→[I] võivad olla sügavuses vahetuvad lõuendid; [A]/[D] jäävad püsiruumiks. Reduced-motion = sama jada lamedalt.

## 7. Navigeerimisreeglid

1. **URL on tõde:** iga ekraan/samm ptk 6 jadast on oma URL-iga avatav, värskendatav ja jagatav (süvalink taastab sammu + mustandi).
2. **Brauseri tagasi/edasi** liigub sammude vahel ega kaota kunagi sisestust (mustand elab sammudest sõltumatult).
3. **Mustand:** Teekonna kirjeldus ja eelpöördumise koostamisseis autosalvestuvad (min: sessionStorage; soovituslik: serverimustand alates lävest — vt Tooteotsused T4). Naasmisel pakutakse taastamist („Sul on pooleli…" — U2 „Jätka siit" kirje).
4. **Katkestamine:** igal sammul nähtav „Katkesta" viib tagasi lähtekohta ([D] või [A]) JA ütleb, mis mustandist saab. × (paneeli rist) järgib sama reeglit — mitte kunagi vaikselt avalehele, kui rajal on salvestamata sisu (kinnitusdialoog).
5. **Esc:** ei sulge midagi, kui fookus on sisestusväljas (WorkspacePaneli käitleja viga parandada); mujal = sama, mis „Katkesta".
6. **Tagasi-affordants:** rajal on nähtav „← Eelmine samm"; paneeli globaalne tagasi-noole peitmine (panel.css:379) selle raja kestas ei kehti (vajab tellija kinnitust — vt Tooteotsused T5).
7. **Kerimine:** ainult ÜKS kerimisomanik korraga — raja kestas on selleks lehe sisu; karusselli window-wheel kuulaja peab olema paneelirežiimis deterministlikult väljas (mitte async-atribuudi taga); töölauapaneeli wheel-capture häkk eemaldatakse, kui kest saab päris scroll-konteineri.
8. **Automaatsete hüpeteta:** adressaadi valik EI vaheta ise sammu (praegune `handleSelectRecipient` hüppab eelvaatele) — samm vahetub kasutaja „Edasi" peale; ükski klõps ei muuda vaikselt salvestatavaid välju.

## 8. Privaatsuse nähtavaks tegemise reeglid

1. **Valdusriba-lite igal raja sammul:** püsiv kiibirida „Kaasas: olukorra kokkuvõte · seotud teemad · …" — täpselt need osad, mis läve valikust läbi tulid; kiibi eemaldamine sammul = eemaldub ka payload'ist.
2. **Valik = payload:** serverileping laieneb kõigile share-võtmetele (praegu ainult `assistiveDevices`); riskisignaalid ei liigu kunagi automaatselt.
3. **Üks valikukoht:** jagamisvalik küsitakse üks kord (lävel); hilisem muutmine käib sama läve uuesti avades, mitte teise loendiga.
4. **Eelvaade = saadetav versioon:** [H] näitab baittäpselt sama teksti/plokke, mida adressaat näeb (sama serializer), koos vaatajapõhise selgitusega (olemasolev JourneySharedInfoBlock keel on hea ja jääb).
5. **Kinnitus on eksplitsiitne:** saatmine ainult nupust, mitte kunagi kerimise/animatsiooni/sammuvahetuse kõrvalmõjuna; 409-privaatsusdialoog (maskeeri/muuda/saada) jääb praegusel kujul.
6. **Pärast saatmist:** tulemus ütleb, kes näeb, mida saab tagasi võtta (U3) ja kust seda hiljem leiab („Minu jagamised" + Teekonna seotud loend).
7. **AI-päritolu märgistus:** AI koostatud mustanditekst kannab kuni kasutaja esimese muudatuseni märget „SotsiaalAI mustand — vaata üle"; kinnitamata mustandit ei saa saata (nupp aktiveerub pärast eelvaate avamist).

## 9. Mobiili- ja ligipääsetavusreeglid

1. Iga samm mahub mobiilivaates ühele veerule ilma horisontaalse ülevooluta (runtime: detailvaade juba vastab; töölauapaneeli kest mitte — kest tuleb parandada).
2. Kerimine töötab puutega, rattaga JA klaviatuuriga (PageDown/nooled) igas kestas; scroll-konteiner on fookustatav.
3. Sammuriba on `<nav>` + `aria-current="step"`; tehtud/aktiivne/ees olekud ka tekstina (mitte ainult värv — kooskõlas „värv pole ainus staatuse kandja" printsiibiga).
4. Fookusjärjekord järgib visuaalset järjekorda; sammu vahetusel liigub fookus sammu pealkirjale; Esc-i käitumine vastavalt ptk 7 p 5.
5. `prefers-reduced-motion`: läve/raja üleminekud ilma liikumiseta (hetkvahetus + tekstiline kinnitus); tulevane flight-esitus = sama sisu lame jada (flight-effect.md piirid 1–7 on kohustuslikud).
6. Puutealad ≥ 44×44 px; kiibiread murduvad; „Kiire abi" riba on esimene fookuselement iga sammu alguses SR-kasutajale.
7. Tekstid läbivad `t()`-kihi (P3-1 kõvakodeeringud ja mojibake parandatakse); selge keele režiim (U7, harul) sobib selle raja tekstidele esimeseks rakendusalaks.

## 10. Säilita / paiguta ümber / ühenda / eemalda

**Säilita (töötab, väärtuslik):**
- serveri üleandmisleping tervikuna (prefill-route, `sourceJourneyId`, vaatajapõhine serializer, U3 tagasivõtt/parandus, „downloaded" versiooniturve);
- privaatsuse 409-eelkontroll dialoogi kolme valikuga;
- JourneySharedInfoBlocki vaatajapõhised privaatsustekstid;
- alustusekraani toon ja lihtsus (kuvatõmmis 1);
- adressaadikaartide sisu (kättesaadavusmärgid, suunamisviited, „vaata teenusekaardil");
- kolm alustusviisi kontseptina (leia adressaat / tean kontakti / jätkan Teekonnast);
- `openInquiry` süvalink ja Teekonna „Seotud eelpöördumised" plokk.

**Paiguta ümber:**
- „Minu eelpöördumised" sammuribalt eraldi arhiivivaateks;
- jagamisvalik JourneyDetaili seest läve-ekraaniks (üks koht);
- abitööriistad (jätkumiskontroll, tervisekontakt, abivahendus) sektsioonivirnast kokkupandavateks tööriistakaartideks;
- vestlusassistent collect-sammu KÕRVALT sammu SISSE (üks paradigma, mille väljund on nähtav struktuurne kokkuvõte).

**Ühenda:**
- kaks jagamisvaliku komplekti (JourneyDetail `share` + journey-sammu `journeyShareSelections`) üheks lepinguks ühtsete võtmetega (`wish` vs `personWish`, `document` vs `contextNote` ebakõla kaotada);
- kolm Teekonna loomise rada (töölauavorm, vestlustöövoog, komposeri režiim) üheks rajaks, mille sees on vestluslik JA vormiline sisend sama oleku peal;
- Teekonna roadmap + tegelikud seosed (linkedPreInquiries jm) üheks ausaks rajaks.

**Eemalda:**
- review-ekraani 4 „suunanuppu" (primaryPath jäägu tuletatavaks/valitavaks detailvaate rajal, mitte pettenupuna);
- töölauapaneeli wheel-capture häkk (koos kestaparandusega);
- topelt-ⓘ (üks infoallikas kesta kohta);
- sammuriba „vaba klõpsimise" semantika peidetud sammudega (samm on kas rajal ja nähtav või pole samm);
- `shareOptions` kasutamata saadavusarvutus (asendub päris saadavus-olekutega läve-ekraanil).

## 11. Tooteotsused (ainult koodist/dokumentidest mittetuletatavad küsimused)

- **T1. Teekonna kest:** kas „Minu Teekond" jääb vestluslehe töölauapaneeli sisse (praegune `/teekond` → redirect) või saab tagasi oma täislehe? Ruumiline visioon („pöörduja rahulik isiklik ruum") viitab eraldi alale, aga tellija varasemad otsused on töölaua-keskseid teid eelistanud. See määrab kogu kerimisparanduse koha.
- **T2. Loomisradade konsolideerimine:** kumb jääb esmaseks — vestluslik loomine (chat-workflow) või vormipõhine? Ptk 5 eeldab ühendamist, aga kumb keel on esmane, on tootevalik.
- **T3. Tagasi-noole taastamine:** kehtiv tellijaotsus on „paneelis tagasi-noolt EI kuvata, × täidab rolli" (panel.css:377–381). Juhitav rada vajab nähtavat „← Eelmine samm". Kas otsus kehtib ka mitmesammulise raja sees?
- **T4. Mustandi serveripüsivus enne kinnitust:** praegu ei salvestu Teekonna mustand ega eelpöördumise koostamisseis enne kasutaja eksplitsiitset salvestust. Autosalvestus serverisse muudaks privaatsuslepingut („kinnitamata mustand on serveris"). Kas lubada serverimustand (parem jätkamine, U2-kirje) või ainult seadmesisene taaste?
- **T5. Kus kriisiriba elab:** kiireloomulisuse tuvastus on assist-vastustes (warnings) olemas; kas püsiv „Kiire abi" riba kuvatakse kogu koostamisraja vältel või ainult riskisignaali korral? (Mõjutab rahulikkuse vs turvalisuse tasakaalu.)
- **T6. Flight-prototüübi sihtleht:** ruumilise lähtekoha järgi on eelpöördumine flight-kandidaat; käesolev analüüs soovitab flight'i alles pärast oleku/esitluse etappe. Kas esimene flight-prototüüp tehakse sellel rajal või Kovisiooni/Teemaseemnete peal (kus lõuendikeel on juba olemas)?
- **T7. „Minu eelpöördumised" vs „Minu jagamised":** kas pöörduja saadetud eelpöördumiste arhiiv jääb eelpöördumiste lehele, kolib „Minu jagamiste" (U12) alla või kuvatakse mõlemas? Praegu on kaks osaliselt kattuvat kohta.
- **T8. Sammuriba sildid kasutaja keeles:** „Eelpöördumine", „eelkaardistus", „eelinfo", „adressaat" on ametnikukeel. Kas toode lubab lihtsustatud silte („Kirjelda", „Kellele", „Vaata üle", „Saada")? Tõlkevõtmete töö (P3-1) sõltub sellest.

## 12. Järgmise teostusülesande soovituslik etapiviisiline skoop

Iga etapp on eraldi tellitav, testitav ja mitte-lõhkuv; vastuvõtja vaadet ei puudutata üheski.

- **Etapp 0 — kerimise ja kesta kiirparandus (blokeerija).** `.workspace-dashboard-panel` saab päris scroll-konteineriks (või embedded-sisu saab oma keriva mähise); wheel-capture häkk eemaldatakse; WorkspacePaneli Escape hakkab välistama sisestusvälju; karusselli window-wheel kuulaja välistab paneelirežiimi deterministlikult. Kontroll: kasutaja kuvatõmmise 3 stsenaarium (review-ekraan 1600×900) keritav ratta, puute ja klaviatuuriga; PageDown/ratas käituvad ühtemoodi /teekond/[id] peal.
- **Etapp 1 — oleku-URL-i leping + mustandikaitse.** Teekonna loomise sammud ja eelpöördumise sammud URL-i (`?samm=`); back/forward liigub sammude vahel; sessionStorage-taaste mõlemale mustandile; „journey" samm kaob (läve-URL asemele); katkestamise kinnitusdialoog salvestamata sisuga. (T4 otsus määrab, kas lisandub serverimustand.)
- **Etapp 2 — aus jagamisleping.** `buildPreInquiryPrefillFromJourney` hakkab austama KÕIKI shareKeys võtmeid (sh riskisignaalide vaikimisi väljajätt); topeltvalik ühendatakse üheks läve-ekraaniks; payload-eelvaade valikute kõrval; ühtsed võtmenimed. Testid: olemasolev tests/journey + uus leping-test iga võtme kohta.
- **Etapp 3 — esitluskiht.** Sammuriba, kiibid, roadmap, külgpaneel, tööriistakaardid saavad disainisüsteemi (kanooniline klaas/nupukeel on olemas — glass.css); mojibake ja kõvakodeeritud tekstid `t()`-võtmetesse; topelt-ⓘ kaob; detailvaate sektsioonivirn → rada + tööriistakaardid (P2-1).
- **Etapp 4 — lävi ja ruumiline keel.** Läve-ekraan valguse/kinnituskeelega; „Kaasas:" valdusriba-lite rajal; kriisiriba (T5 otsuse järgi); seejärel valikuline flight-esitus raja pealiskihina (flight-effect.md piiridega, reduced-motion lame variant) — eraldi prototüübina, mõõdetuna enne kasutuselevõttu.

Iga etapi järel: autenditud runtime-kontroll sama sondimustri järgi (temp-login + playwright; sondiskriptid on taasloodavad selle dokumendi ptk „Meetod" kirjelduse põhjal) + kasutaja enda läbimängu kordus (kuvatõmmiste stsenaarium).

---

*Koodiviited on kontrollitud `main` @ 7ae76d5b vastu 15.07.2026; runtime-väited mõõdetud lokaalse dev-serveri vastu (localhost:3000, autenditud sessioon, viewport 1600×900 ja 375×812). Testandmed kustutatud (1 Teekond, 0 pöördumist, 5 login-tokenit). Rakenduskoodi ei muudetud.*

## 13. Jagamisvaliku usaldus- ja privaatsusjärelkontroll

JÄRELKONTROLLI STATUS: COMPLETE (15.07.2026 õhtu)

Küsimus: kui kasutaja eemaldab „Mida võtan kaasa?" valikust ühe või mitu välja, siis mida näeb adressaat pärast saatmist tegelikult?

**Kontrollimeetod (runtime, otsast lõpuni):** kaks kontot lokaalse dev-serveri vastu. Autor lõi rikka sisuga privaatse Teekonna (kokkuvõte + teemad + puuduolev info + riskisignaal + serviceContinuity + personContext „Ema on 84-aastane, dementsuse diagnoosiga…"), valis 1. kihis AINULT „inimese soov" (`shareKeys=["wish"]`), 2. kihis (journey-samm) võttis maha **kõik viis** märkeruutu, ja saatis pöördumise päriselt INTERNAL-kanalis (`status:"SENT"`, adressaat = konto-e-postiga seotud vastuvõtja, `acceptsPreInquiries` ajutiselt true). Seejärel loeti adressaadi sessioonis `GET /api/pre-inquiries`. Kõik testandmed kustutati (0 jääki; preference taastatud false'iks; tokenid kustutatud). Saatmise payload koostati üks-ühele UI `handleSave` koodiraja järgi (WorkspaceFeaturePage.jsx:1375–1414), sh sama `filterJourneySharedInfoForPreInquiry` loogika.

### 13.1. Millised eemaldatud väljad jõuavad siiski serverisse? — Kõik

Salvestuspäring kannab eemaldatud sisu **neljas konteineris**, millest valikud kontrollivad ainult ühte:

| Konteiner | Sisu (eemaldatud väljadest) | Keda valik mõjutab |
|---|---|---|
| `situation` | kokkuvõte + serviceContinuity plokk + teemad + soovitatud sammud + **riskisignaalid** | mitte keegi (prefill ehitab tingimusteta, preInquiryHandoff.js:129–137) |
| `userEditedDraft` / `generatedDraft` | kogu ülaltoodu + teema + **puuduoleva info** loend | mitte keegi (suggestedMessageDraft, read 80–97, 160–164) |
| `assessmentState.supportContext.personWish` + `subject.municipalityText` | **personContext** (kolmanda isiku kirjeldus!) + KOV | mitte keegi (UI prefill-efekt, WorkspaceFeaturePage.jsx:1096–1098) |
| `assessmentState.sharedJourneyInfo` | kokkuvõte/teemad/puuduolev/sammud/kontekstimärge | **ainus filtreeritav** — 2. kihi märkeruudud (rida 1387–1393) |

1. kihi `shareKeys`-ist austab server ainult `assistiveDevices` (preInquiryHandoff.js:104). Salvestus-API-l (`createPreInquiry`, lib/preInquiries.js:996) **ei ole shareKeys parameetrit üldse** — server ei saa teada, mida kasutaja valis.

### 13.2. Millised neist salvestatakse mustandisse? — Kõik neli konteinerit, muutmata kujul

`createPreInquiry` (lib/preInquiries.js:1036–1053) kirjutab DB-sse `situation` (kohustuslik), `assessmentState` (terve JSON), `generatedDraft`, `userEditedDraft` täpselt nii, nagu klient saatis. Ainus sisuteisendus on PII-skanner (`evaluatePreInquiryPrivacy`, 409 → „Saada maskeeritult") — see otsib mustripõhiseid isikuandmeid, MITTE Teekonna-päritolu. **Runtime-katses skanner ei käivitunudki**: „MTÜ Koduhooldus", „84-aastane", „dementsuse diagnoosiga", „läbipõlemise oht" läbisid puhtalt (saatmine õnnestus esimese päringuga, 201). Viimane turvavõrk ei püüa seda leket.

### 13.3. Millised jõuavad adressaadi API-vastusesse ja UI-sse? — Kõik peale sharedJourneyInfo

`serializePreInquiry` (lib/preInquiries.js:507–574) tagastab **igale volitatud vaatajale, sh adressaadile**: `topic`, `situation`, `assessmentState` (TERVIKUNA), `generatedDraft`, `userEditedDraft`. Vaatajapõhisus piirab ainult e-posti aadresse ja vastuvõtja töövoo välju — sisu ei filtreerita.

Runtime-markerid adressaadi `GET /api/pre-inquiries` vastuses (kõik valikust EEMALDATUD või üldse mitte pakutud):

```text
summary_unchecked:          true  („raha on väga vähe")
riskSignal_never_offered:   true  („läbipõlemise oht")
continuity_never_offered:   true  („koduteenus", „MTÜ Koduhooldus", lõppkuupäev, eesmärk)
personContext_unchecked:    true  („84-aastane", „dementsuse diagnoosiga")
missingInfo_unchecked:      true  („omastehooldaja toetus" — mustandis)
domains_unchecked:          true  („hoolduskoormus, vaimne tervis")
suggestedActions_unchecked: true
sharedJourneyInfo:          null  (AINUS maha võetud asi)
```

Adressaadi UI renderdab needsamad väljad otse: `situation` lõik (WorkspaceFeaturePage.jsx:1966), eelkaardistuse tekstieksport koos `personWish`-iga (1970–1980), mustandi tekstiala (1981–1983). Iroonia: ainus plokk, mille valik päriselt maha võttis, on seesama „Teekonnast tulnud eelinfo" plokk, mille küljes on privaatsuslubadus — **lubaduse kandja kadus, sisu jäi**.

### 13.4. Ainult kokkuvõte? — Ei: ka kõige tundlikumad väljad

Eemaldatud/mittepakutud väljadest liiguvad läbi:

- **riskisignaalid** — AI hüpoteesid inimese seisundi kohta („läbipõlemise oht"); neid EI paku kumbki valikukiht üldse; rikub vaimus printsiipi „AI mustand ei muutu automaatselt inimese kinnitatud väiteks" (adressaat näeb neid kasutaja pöördumises tema väidetena);
- **personContext** — sageli KOLMANDA isiku (hooldatava) tervisekirjeldus; liigub `personWish` välja kaudu, mida kuvatakse adressaadi eelkaardistuse ekspordis;
- **serviceContinuity** — teenus, teenuseosutaja, kuupäevad, kasutaja eesmärk;
- puuduolev info, teemad, soovitatud sammud, KOV/piirkond.

Ainus päriselt austatud võti on `assistiveDevices` (1. kiht). Lisaks on 2. kihi märgistus eksitav: „inimese soov" märkeruut kontrollib tegelikult `suggestedActions` välja (WorkspaceFeaturePage.jsx:552), mitte inimese soovi; „seotud dokument või kontekst" kontrollib `contextNote`'i.

### 13.5. Fail-closed serverilepingu ettepanek

Põhimõte: **Teekonnast pärit sisu tohib eksisteerida ainult ühes, päritolumärgisega konteineris, mille iga osa on võtmega kaetud.** Konkreetselt:

1. **Prefill on puhas funktsioon (journey, shareKeys) → payload:** `buildPreInquiryPrefillFromJourney` väärtustab IGA fragmendi ainult siis, kui vastav võti on shareKeys-is: `summary`, `domains`, `missingInfo`, `wish` (=personWish + personContext), `serviceContinuity` (uus võti), `municipality` (uus võti või seotud `serviceContinuity`/`summary`-ga), `assistiveDevices` (juba töötab), `document`. Võtmeta fragment ei satu `situation`'i, mustandisse ega `sharedJourneyInfo`'sse. **Riskisignaalid eemaldatakse prefillist täielikult** — kui toode tahab neid jagatavaks, on see eraldi eksplitsiitne võti eraldi eelvaatega (vaikimisi väljas).
2. **Salvestus talletab kinnitatud manifesti:** `sharedJourneyInfo` (juba `userConfirmed:true` väljaga) muutub ainsaks Teekonna-andmete kandjaks; `situation` on kasutaja ENDA tekst (tema kirjutatud/muudetud), mitte Teekonna koopiamasin. Server salvestab shareKeys-manifesti pöördumise juurde — nii on hiljem tõendatav, mida kasutaja kinnitas.
3. **Kohustuslikke Teekonna-välju ei ole.** Ainsad kohustuslikud osad on kasutaja enda kirjutatud/üle vaadatud olukorra tekst ja teema — need on nähtavad ja muudetavad eelvaates. Kõik Teekonnast pärit osad on rangelt opt-in. (KOV/piirkond on soovituslik marsruutimiseks — kui kasutaja seda ei jaga, väheneb soovituste täpsus, mitte saadetavus.)
4. **Kaks valikukihti → üks.** Läve-ekraan (ptk 5) on ainus valikupunkt; journey-sammu teine loend kaob; võtmenimed ühtlustatakse (`wish` vs `personWish`, `document` vs `contextNote`).
5. Kliendipoolne filter jääb ainult esituse abiks; **jõustamine on serveris** (prefill + salvestusleping) — praegune ainus jõustuspunkt on kliendi JS, mida iga teine klient (või vana sakk) võib eirata.

### 13.6. Kohustuslikud regressioonitestid

Testitaristu: `npm test` = node:test süstitud fake-prismaga (`{db}` parameetrid on `createPreInquiry`-l jt juba olemas); markeritehnika = unikaalsed fraasid igas Teekonna väljas, siis `JSON.stringify(serialized)` EI TOHI sisaldada märkimata fraase.

1. **Ühiktest (prefill, iga võti eraldi):** `buildPreInquiryPrefillFromJourney(journey, {shareKeys:[K]})` — tabelipõhine: iga võtme K korral sisaldab väljund AINULT K fragmenti; `situation`, `suggestedMessageDraft`, `sharedJourneyInfo`, `personContext`, `municipality` on teiste võtmete markeritest puhtad. Eraldi juht: `shareKeys=[]` → mitte ühtegi Teekonna markerit üheski väljas.
2. **Ühiktest (riskisignaalid):** ühegi shareKeys-kombinatsiooniga ei sisalda ükski prefilli väli `riskSignals` markerit.
3. **Lepingutest (salvestus):** `createPreInquiry` + `sourceJourneyId` + manifest → salvestatud kirje `situation/generatedDraft/userEditedDraft/assessmentState` ei sisalda manifestist puuduvate võtmete markereid (fake-prisma capture'iga).
4. **Serialiseerimistest (adressaadi vaade):** `serializePreInquiry(inquiry, {viewerId: recipientId})` täisstring ei sisalda ühtegi märkimata markerit — laiendus olemasolevale `tests/preInquiries/audienceSerialization.test.js`-ile.
5. **Integratsioonitest (selle järelkontrolli kordus):** autor → minimaalsete võtmetega SENT → adressaadi `listVisiblePreInquiries` → markerite puudumise assert (sama 7-markeri komplekt, mis runtime-sondis).
6. **UI-leping:** läve-ekraani valikud eeltäidavad URL-i `share=` võtmetest; iga linnukese muutus muudab nähtavat payload-eelvaadet (võib katta komponenditestiga või e2e-ga hiljem).
7. **Olemasolevate testide laiendus:** `tests/journey/sourceJourneyLink.test.js` (link säilib, aga sisu on manifesti-põhine) ja `tests/preInquiries/trustPackageContracts.test.js` (usalduspaki invariandid + „märkimata ⇒ nähtamatu" invariant).

### 13.7. Homme rakendatav paranduste järjekord

1. **P0 — usaldus- ja privaatsusparandus (see peatükk):** prefill austab kõiki shareKeys võtmeid; riskisignaalid prefillist välja; personContext/serviceContinuity võtmete taha; kaks valikukihti üheks; markeripõhised regressioonitestid (13.6 p 1–5). Väike, serveripoolne, skeemimuutuseta — tehtav ühe päevaga ja iseseisvalt väärtuslik ka siis, kui UI-d ei puututa.
2. **P1 — nähtavuse tugi:** eelvaates „Kaasas Teekonnast: …" kiibirida (payload-põhine, mitte lubadusepõhine); PII-skanner jääb teiseks võrguks.
3. **Etapp 0 — kerimise blokeerija** (ptk 12; eraldi ülesandena juba pakutud): paneelikeha/wheel-häkk/Escape/karusselli valve.
4. **Aus 4-sammuline põhivoog** (ptk 5–6): peidetud „journey" samm kaob läve kasuks; sammuriba olekutega; automaatsed hüpped maha.
5. **Oleku püsimine:** sammud URL-i, mustand sessionStorage'i (+ T4 otsus serverimustandi kohta).
6. **Esitluskiht:** stepperi/kiipide/roadmapi CSS, i18n-võtmed, mojibake, topelt-ⓘ.
7. **Alles seejärel Flight** — pealiskihina, flight-effect.md piiridega.

Järjekorra loogika: 1–2 sulgevad usalduspiiri (väikseim töö, suurim risk maas), 3 avab voo füüsiliselt, 4–5 teevad selle mõistetavaks, 6 loetavaks, 7 ruumiliseks.

*Järelkontrolli koodiviited: `main` @ 7ae76d5b; runtime 15.07.2026 õhtul, localhost:3000, kaks autenditud sessiooni (autor + adressaat). Testandmed: 1 Teekond + 1 SENT-pöördumine + 2 tokenit — kõik kustutatud, adressaadi `acceptsPreInquiries` taastatud algseisu (false), teavituskirjed puhastatud. Rakenduskoodi ei muudetud.*

### 13.8. Ajutine piiritõmme: minimaalne serveripoolne eemaldus (analüüs, mitte tööplaan)

Küsimus: kui homme on vaja leke sulgeda ühe väikese muudatusega, siis kus täpselt ja mis hinnaga? Kontrollitud `main` @ 7ae76d5b vastu, küsimus­haaval.

**1) Kus piir tõmmata?** Ainuke serverifunktsioon, kus Teekonna SISU üldse eelpöördumise voogu siseneb, on `buildPreInquiryPrefillFromJourney` (lib/journey/preInquiryHandoff.js:99) — ainus kasutuskoht on prefill-marsruut `POST /api/journeys/[id]/pre-inquiry-draft` (route.js:47; grep kinnitas, et teisi tootekoodi kasutajaid pole, ainult tests/journey/assistiveDevices.test.js). `createPreInquiry`-s Teekonda sisuliselt ei loeta — `resolveSourceJourneyId` (lib/preInquiries.js:975–993) valideerib ainult ID omanikluse ja talletab ID. Seega piir tõmmatakse **prefill-funktsioonis endas** — `createPreInquiry`-s pole see võimalik, sest seal ei ole enam eristatav, milline tekst on Teekonnast ja milline kasutaja oma.

**2) Mis tuleb ajutiselt täielikult eemaldada?** Prefilli tagastusobjektist (preInquiryHandoff.js:152–167) on sisukandjad, mis tuleb tühjendada: `situation` (kokkuvõte + jätkumiskontroll + teemad + sammud + riskisignaalid, read 129–137), `suggestedMessageDraft` ja `missingInfoNotes` (read 138, 160–164), `personContext` (rida 157), `sharedJourneyInfo` → `null` (read 139–150), `municipality` (tuletatakse context'ist/jätkumiskontrollist/kokkuvõtte regex-ist, read 117–122) ning `topic` Teekonna-tuletis — praegune topic lekib jätkumiskontrolli teenusenime („Teenuse jätkumise täpsustamine: <serviceName>", read 114–116) või Teekonna pealkirja; ajutiselt asendada üldsõnaga (nt tühi või „Eelpöördumine"). Alles jäävad ainult mittesisulised väljad: `sourceJourneyId` (side „Seotud eelpöördumised" loendiga), `sourceNotice` ja soovi korral `recipientType` (väljastab ainult enum-väärtuse KOV_CONTACT/SERVICE_PROVIDER, mitte sisu).

**3) Kas käsitsi kirjutatud tekst ja tavaline vormirada jäävad tööle?** Jah, mõlemad, ilma UI-muudatusteta. Tavarajad (find_recipient, known_contact) ei kutsu prefill-marsruuti üldse — `journeyPrefillLoadedRef` efekt käivitub ainult `fromJourney` parameetriga (WorkspaceFeaturePage.jsx:1063–1066). Teekonnast tulija saab tühjad väljad: kõik setterid taluvad tühja väärtust; journey-sammul on null-`sharedJourneyInfo` jaoks olemas fallback-tekst „Teekonna kokkuvõtet ei ole veel kaasa tulnud…" (rida 2125); lokaalne mustandiehitaja `buildLocalPreInquiryDraft` töötab tühjade sisenditega (fallback-teema „Eelpöördumine", read 374–398). Salvestus/saatmine nõuab niikuinii mittetühja olukorrateksti — nupp on keelatud, kuni kasutaja ise kirjutab (`!effectiveSituation.trim()`, rida 2673; server: `normalizeRequiredText(situation)`, lib/preInquiries.js:1008). St kasutaja OMA tekst muutub ainsaks sisuks — täpselt soovitud ajutine seis.

**4) Kas ilma skeemi ja migratsioonita?** Jah. Prefill-marsruut ei salvesta midagi (`persisted:false`, route.js:50–55) — muudatus on puhas arvutusfunktsiooni kärbe. `PreInquiry` skeem (schema.prisma:1864–1889) jääb puutumata: `topic` on nagunii `String?`, `assessmentState` on `Json?` (null-`sharedJourneyInfo` elab selle sees), mustandiväljad on `String?`, `situation` jääb kohustuslikuks ja tuleb kasutajalt; `sourceJourneyId String?` side säilib. Ka API-vastuse KUJU ei muutu (samad võtmed, tühjad väärtused) — klient töötab olemasoleva koodiga edasi (Q3 fallback'id).

**5) Millised 3–5 testi tõendavad lekke sulgumist?** (taristu: `npm test` = node:test, fake-prisma süstimine `{db}` kaudu on `createPreInquiry`-l olemas; markeritehnika = unikaalne fraas igas Teekonna väljas)

1. **Prefill-markeri ühiktest** (uus fail tests/journey kõrvale): rikas Teekond markeritega kõigis väljades (summary, domains, missingInfo, riskSignals, suggestedActions, serviceContinuity, personContext, municipality, title) → `buildPreInquiryPrefillFromJourney(journey, {shareKeys: <iga kombinatsioon, ka kõik>})` → `JSON.stringify(prefill)` ei sisalda ÜHTEGI markerit; lubatud on ainult `sourceJourneyId`, `sourceNotice`, `recipientType`, üldsõnaline topic.
2. **Salvestus + adressaadi serialiseerimine** (laiendus tests/preInquiries/audienceSerialization.test.js): `createPreInquiry` fake-prismaga, sisend = kasutaja oma tekst markeriga `OMA-TEKST` + `sourceJourneyId` → `serializePreInquiry(inquiry, {viewerId: recipientId})` täisstring sisaldab `OMA-TEKST`, ei sisalda ühtegi Teekonna markerit.
3. **Elav integratsioon** (ptk 13 sondi kordus): autor → SENT INTERNAL → adressaadi `GET /api/pre-inquiries` → sama 7-markeri komplekti puudumise assert + kasutaja oma teksti kohalolu.
4. **Tavaraja regressioon:** known_contact/find_recipient rada (prefill-marsruudita) — salvestus ja saatmine töötavad, sisu = ainult kasutaja sisestus; kinnitab, et kärbe ei murra tavavoogu.
5. **Teadlik ootusmuudatus:** tests/journey/assistiveDevices.test.js — `withSelection` ootus muutub (abivahendite tekst EI ole ajutiselt prefillis); testi uuendamine dokumenteerib kao teadlikuna, mitte regressioonina.

**6) Milline funktsionaalsus ajutiselt kaob?**

- Kogu Teekonna eeltäite väärtus: kokkuvõte, mustand, puuduolev info, jätkumiskontrolli plokk — kasutaja kirjutab ise (või kopeerib oma Teekonna vaatest käsitsi);
- `assistiveDevices` opt-in eeltäide — ainus praegu korrektselt töötav võti kaob koos `situation` tühjendusega;
- „Teekonnast tulnud eelinfo" plokk autori JA adressaadi vaates (sharedJourneyInfo=null) koos oma privaatsusselgitusega;
- journey-sammu 5 märkeruutu muutuvad sisutuks (filtreerivad nulli; samm näitab fallback-teksti) ja JourneyDetaili jagamisvaliku paneel muutub mittetoimivaks lubaduseks — miinimumina tasub selle saateteksti üherealiselt muuta („eeltäide on ajutiselt väljas"), mis on ainus soovitatav UI-puude;
- KOV/piirkonna eeltäide adressaadiotsingusse (`recipientQuery`) — soovituste täpsus langeb, kasutaja tipib piirkonna ise;
- teema eeltäide — „Seotud eelpöördumised" ja „Minu eelpöördumised" loendis võib kirje olla „Pealkirjata", kuni kasutaja teema kirjutab.

**Säilib täielikult:** side ise (`sourceJourneyId` → „Seotud eelpöördumised" + `openInquiry` tagasilink), tavaline vormirada, vestlusassistent, adressaadivalik ja kättesaadavusmärgid, privaatsuse 409-kontroll, salvestamine/saatmine/allalaadimine/koopia, U3 tagasivõtt ja parandus, vastuvõtja töövoog. Kärbe on ühesuunaline ja tagasipööratav: kui ptk 13.5 fail-closed leping valmis saab, taastuvad eeltäited võti võtme haaval koos ptk 13.6 testidega.

*13.8 kontrollitud `main` @ 7ae76d5b vastu 15.07.2026 (grep-kasutuskohad, prefill-tagastusobjekt, UI-fallback'id, skeem 1864–1889, testifailide olemasolu). See on piiritõmbe analüüs, mitte teostus — koodi ei muudetud.*

## 14. Teekonna puuduv funktsionaalsus ja tulevikumudel

PEATÜKI STATUS: COMPLETE (15.07.2026 öö)

Skoop: mida peab Teekond kasutajale terviklikult võimaldama ja mis on aktiivses `main`-is puudu — sh võimalused, mida senised dokumendid ei nimeta. UX-, kerimis- ja jagamislekke analüüsi (ptk 1–13) EI korrata; ptk 13.8 jääb ajutise fail-closed piiri kanooniliseks lähtekohaks. Sihitud kontrollid selle peatüki tarbeks: Journey mudel + enum'id (schema.prisma:1214–1239, 294–302), API-pind (`app/api/journeys` — ainult GET/POST/PATCH + 2 draft-marsruuti), teenusekiht (lib/journey/service.js), valideerimine (validation.js:135–188), U2 tööjärg (lib/workspaceContinuity.js:105, 228–236), teavituskiht (lib/notifications.js — 0 journey-vastet), vestlustöövoo salvestus (ChatBody.jsx:2132–2145), seotud objektide kirjutajad (grep: `linked*Ids` ainult lugejas JourneyDetail.jsx:414–418), sündmuslogi kirjutajad (draft.js:254; JourneyDashboard.jsx:59–68), kustutusrajad (grep: `journey.delete` — 0 vastet tootekoodis) ja avalik lubadus (messages/et.json:4572 → VoimalusedBody.jsx:31–32).

### 14.1. Teekonna selge tooteroll

**Mis Teekond ON:** kasutaja privaatne, ajas püsiv olukorra-mälu — koht, kus tema elusituatsiooni kirjeldus, senised sammud, seotud materjalid ja järgmised valikud püsivad koos, ning ainus koht, kust ta saab teha kontrollitud, külmutatud väljavõtteid teistele (eelpöördumine, abisoov).

**Mis Teekond EI OLE:** mitte juhtumitoimik (ametlik menetlus ja hindamine elavad STAR2-s — püsiv piir); mitte AI hinnang ega triaaž (püsiv keeld); mitte suhtluskanal (selleks on pöördumised ja ruumid); mitte spetsialisti tööriist inimese KOHTA (vastuvõtja ei näe Teekonda kunagi); mitte kohustuslik eeltingimus teiste funktsioonide kasutamiseks (ruumilise lähtekoha §7.1).

**Lahendatav kasutajaprobleem:** abivajaduse hajusus. Info, tehtud katsed, kontaktid, dokumendid ja vastused on laiali peas, paberites ja postkastis; iga uus pöördumine algab nullist ümberjutustamisest. Teekond kaotab „räägi kõik uuesti" koormuse ja annab pikas protsessis järjepidevuse.

**Erinevus naabritest:** vestlus on *hetkeline mõtestamine* (voolav, konteksti kaotav); eelpöördumine on *ühekordne külmutatud väljavõte adressaadile*; ülesannete loend on *kohustuste haldus ilma loota*; juhtumitoimik on *teise osapoole tööriist inimese kohta*. Teekond on *inimese enda jätkuv seis ja suund* — ainus neist, mille omanik, toimetaja ja jagamisotsustaja on läbivalt kasutaja ise.

**Üks olukord, eesmärk või protsess?** Soovitus: Teekond = **üks elusituatsioon**, mis võib kesta kaua ja sisaldada mitut suunda (praegune `primaryPath` on üks väli — st kood toetab täna üht suunda korraga; mitu aktiivset Teekonda on juba lubatud). Mitu sõltumatut muret = mitu Teekonda; ühe olukorra harud (nt „ema hooldus" sees koduteenus JA toetus) vajavad tulevikus kerget alamstruktuuri (vt 14.4/14.5), mitte eraldi Teekondi.

**Ühe lause lubadus (ettepanek):** „See on sinu privaatne Teekond: sinu olukord, sammud ja järgmised valikud püsivad siin koos, ja midagi ei liigu siit edasi ilma sinu kinnituseta." — sisult sama, mis avalik lubadus /voimalused lehel (et.json:4572), kuid lühem; NB: ptk 14.9 näitab, et praegune teostus seda lubadust veel ei täida.

### 14.2. Praegune funktsionaalne elutsükkel (aktiivse koodi vastu)

| Võime | Seis | Tõend |
|---|---|---|
| Loomine | **OLEMAS** | 3 rada: töölauavorm (`POST /api/journeys/draft` heuristika + `POST /api/journeys`), vestlustöövoog (ChatBody.jsx:2132), API. NB: „AI korrastab" on sünkroonne reegel, mitte LLM (lib/journey/draft.js) |
| Nimetamine ja kokkuvõte | **OLEMAS** | review-ekraani pealkiri+kokkuvõte; heuristiline pealkiri nõrk („hoolduskoormus") |
| Muutmine | **OSALINE** | detailvaate vorm katab title/summary/primaryPath/domains/missingInfo/suggestedActions; `riskSignals` on UI-s ainult loetav (PATCH lubaks, validation.js:186); context'i muudab ainult jätkumiskontrolli vorm |
| Salvestamine | **OLEMAS** (automaatsalvestus **PUUDUB**) | eksplitsiitne salvestus töötab; mustand kaob tagasi/F5/Esc-iga (ptk 2 P1-3) |
| Jätkamine | **OSALINE / EKSITAVALT LUBATUD** | loend + „Jätka viimast" OLEMAS; U2 „Jätka siit" kirje viitab `/teekond?journey=<id>` (workspaceContinuity.js:232), aga redirect kaotab parameetri (app/teekond/page.jsx:4) ja ükski komponent ei loe seda — süvalink viib loendisse, mitte Teekonda |
| Järgmised sammud | **EKSITAVALT LUBATUD** | roadmap ei loe päris andmeid (P2-1), review-suunanupud on vormiväli (P2-2); suggestedActions on pelgalt tekstiread |
| Eelpöördumise alustamine | **OLEMAS** (leping vigane) | share-panel + prefill töötavad; sisu liigub valikust sõltumata (ptk 13; ajutine piir 13.8) |
| Jagamine (Teekond ise) | **PUUDUB** (teadlikult) | `JourneySharingStatus` enum = ainult PRIVATE (schema:300–302); jagatav on ainult väljavõte pöördumise kujul |
| Hilisem tagasivõtmine | **OSALINE** | pöördumise U3 recall/parandus OLEMAS (pöördumise poolel); Teekonna-poolset „mida ma jaganud olen" koondvaadet pole (on üldine „Minu jagamised") |
| Lõpetamine | **PUUDUB** | pole lõpetatud-olekut, lõpetamispõhjust ega kasutaja hinnangut tulemusele; ainus väljund on ARCHIVED ilma põhjuseta |
| Taasavamine | **OSALINE** | PATCH lubab status→ACTIVE (validation.js:172–173), aga UI-s taasavamise nuppu pole (JourneyCard/detail pakuvad ainult „Arhiveeri") |
| Arhiveerimine | **OLEMAS** | PATCH status=ARCHIVED + UI nupud mõlemas vaates |
| Kustutamine | **PUUDUB** | ei API-t, ei UI-d (`journey.delete` — 0 vastet); ainus rada on konto kustutamise kaskaad (schema onDelete: Cascade) |
| Ajalugu / versioonid | **EKSITAVALT LUBATUD** | „Tehtud sammud" paneel kuvab activityLog'i, kuid kirjutajaid on ainult loomishetkel (draft.js:254; JourneyDashboard.jsx:59–68) — logi ei kasva kunagi; versioone ei ole (ainult updatedAt) |
| Seotud objektid (dokumendid, kontaktid, ruumid, abisoovid) | **EKSITAVALT LUBATUD** | „Seotud asjad" paneel loeb `context.linked*Ids` võtmeid, mida ükski koodirada ei kirjuta (ainus vaste = lugeja ise, JourneyDetail.jsx:414–418); ainus PÄRIS seos on `PreInquiry.sourceJourneyId` |
| Vestlusega sidumine | **OSALINE** | andmemudel valmis (`conversationId` + ensureOwnedConversation, service.js:17–52), aga ükski voog ei saada seda — ka vestlustöövoost salvestatud Teekond jääb vestlusega sidumata (ChatBody.jsx:2132–2145 ei pane conversationId kaasa) |
| Teavitused / „mis muutus" | **PUUDUB** | lib/notifications.js ei tunne ühtegi journey-sündmust; Teekond ei tekita ega saa teavitusi (U2 tööjärje-kirje on ainus, ja selle link on katki) |

### 14.3. Kasutaja tegelikud tööd (kus Teekond aitab, kus katkeb)

1. **„Ma ei tea, kuhu pöörduda."** Aitab: alustusekraan + heuristiline korrastus + teenusekaardi/eelpöördumise CTA-d. Katkeb: „järgmine samm" on kolme vastuolulise süsteemi vahel (P2-1/P2-2); adressaadi leidmise abi elab alles eelpöördumise pinnal, mitte Teekonnal.
2. **Olukord areneb mitu nädalat.** Aitab: Teekond püsib loendis, „Jätka viimast" olemas. Katkeb: naastes pole „mis vahepeal muutus" vaadet; sündmuslogi ei kasva; U2 süvalink viib valesse kohta; saadetud pöördumise seis ei peegeldu Teekonnale (roadmap valetab).
3. **Korraga mitu seotud muret.** Aitab: mitu aktiivset Teekonda on lubatud. Katkeb: ühe olukorra sees pole harusid; kaks Teekonda ei tea teineteisest midagi; sama dokument/kontakt ei ole kummagagi seotav (linked*Ids surnud).
4. **Osa samme ise, osa spetsialistiga.** Aitab: väljavõtte-põhimõte (ainult kinnitatud osa liigub) on disainis olemas. Katkeb: leping ei pea (ptk 13, kuni 13.8 piir kehtib); privaatmärkmete ja jagatava sisu eristust Teekonna sees pole — kõik väljad on ühesuguse staatusega.
5. **Katkestab ja tuleb hiljem tagasi.** Aitab: salvestatud Teekond püsib. Katkeb: salvestamata mustand kaob jäljetult (P1-3); pooleliolevat eelpöördumist ei saa Teekonnalt jätkata (koostamisseis pole püsiv); „kus ma pooleli jäin" vastust ei anta.
6. **Pöördumine ei aidanud, vaja uut rada.** Aitab: võib alustada uue pöördumise. Katkeb: tulemust („ei vastatud", „ei sobinud") ei saa kuhugi kirja panna; süsteem ei paku alternatiivi (teenusekaart, abisoov) senise katse KONTEKSTIS; iga uus katse algab taas tühjalt.
7. **„Mis on vahepeal muutunud?"** Katkeb täielikult: teavitusi journey-sündmustest pole, avamiste/vastuste diff'i pole; ainus signaal on pöördumise staatusesilt teisel lehel.
8. **Teekond puudutab last/hooldatavat.** Aitab: personContext väli eksisteerib. Katkeb: kolmanda isiku andmed ei ole kuidagi märgistatud ega erikaitstud — runtime-tõend (ptk 13.3) näitas, et just see väli lekkis adressaadile („84-aastane, dementsuse diagnoosiga"); jagamislävel pole kolmanda isiku hoiatust.

### 14.4. Puuduvad põhivõimed (väärtus / risk / etapp)

Väärtus ja risk skaalal K/keskmine/M; etapid: **P0** (= ptk 13.7/13.8), **V1** (enne pilooti), **PILOOT** (piloodi käigus katsetatav), **HILISEM**, **VÄLISTATUD**.

| Võime | Väärtus | Peamine risk | Etapp |
|---|---|---|---|
| Automaatsalvestus + taastatav mustand | K (P1-3 andmekao ravim) | serverimustandi privaatsusleping (T4) — algul seadmesisene | **V1** |
| Tegevuste ajajoon (päris sündmuslogi kirjutajatega) | K (elutsükli selgroog) | ei tohi muutuda jälgimislogiks — ainult kasutaja enda ja tema algatatud sündmused | **V1** |
| „Mis muutus pärast viimast korda?" | K | ainult loetav diff, mitte push-surve | **PILOOT** (eeldab ajajoont) |
| Järgmise sammu teadlik valimine (rada päris andmetest, 1 samm = 1 tegevus) | K | soovitus ≠ kohustus; mitte survestada | **V1** |
| Tähtajad ja meeldetuletused (kasutaja seatud) | keskmine | survestamise oht; U1 opt-in leping | **PILOOT** |
| Kontaktide/teenuste sidumine (viitena) | keskmine | viide, mitte koopia; kontakti kadumisel SetNull-loogika | **PILOOT** |
| Dokumentide sidumine (viitena) | K (praegu surnud lubadus) | dokumendi kustutamise käitumine; mitte kopeerida sisu | **V1** (kirjutajad linked*Ids-ile või selle asendus) |
| Vestluste sidumine (conversationId kasutusele) | keskmine | ainult viide „pärineb vestlusest"; vestluse kustutus → SetNull (skeemis valmis) | **PILOOT** |
| Eelpöördumiste JA nende tulemuste sidumine | K (kasutuslugu 6) | tulemus on kasutaja OMA hinnang, mitte adressaadi kohustus | **V1** (staatuse peegeldus) + **PILOOT** (tulemuse kirje) |
| Mitu paralleelset eesmärki/haru ühe Teekonna sees | keskmine | struktuuri ülekaal lihtsuse arvelt; MITTE juhtumiplaani jäljendus | **HILISEM** |
| Lõpetamise põhjus + kasutaja hinnang tulemusele | keskmine | hinnang on vabatahtlik, mitte skoor | **PILOOT** |
| Jätkamise soovitus pärast ebaõnnestunud pöördumist | keskmine | soovitus konteksti põhjal, mitte automaatne eskalatsioon | **PILOOT** |
| Privaatmärkmed (väli, mis EI OLE kunagi jagatav) | keskmine | selgus, et „privaatne on vaikimisi kõik" — märkmete eriklass alles siis, kui jagamine taastub | **PILOOT** |
| Jagatud väljavõte (külmutatud snapshot) | K | ptk 13.5 leping on eeldus | **V1** (= P0 jätk) |
| Jagamise manifest + hilisem tagasivõtmine Teekonna vaatest | K | U3 olemas pöördumise poolel; Teekonnale ainult koondvaade viidetega | **PILOOT** |
| Ajaloo/versioonide vaatamine | M–keskmine | versioonihoidla maksumus; enne piisab sündmuslogist | **HILISEM** |
| Eksport (tekst/fail „minu kaust") | keskmine (omanditunne, paberil kaasavõtt) | sama allalaadimisleping mis pöördumisel (A3 muster olemas) | **V1** (lihtne tekst) |
| Kustutamine + retention | K (õiguslik ja usalduse baas) | seotud pöördumiste side (sourceJourneyId SetNull on skeemis olemas); vajab O-TK2 otsust | **V1** |
| Ligipääsetav lihtvaade (1 veerg, suur kiri, TTS) | keskmine | mitte eraldi „vaene versioon", vaid sama struktuuri teine esitus | **PILOOT** |

### 14.5. Funktsioonid, millele me pole veel mõelnud (ideering)

Kümme ideed, mida senised Teekonna-dokumendid (ideed.md §2.3, ruumiline lähtekoht §7.1, teadmistekaart) otseselt ei kirjelda. Välistatud on pingeread, survestavad skoorid, kasutaja teadmata jagamine ja automaatsed otsused.

1. **Pöördumise tulemuse kirje** („sain vastuse / ei vastatud / ei sobinud / sain abi"). Probleem: tsükkel ei sulgu, iga katse kaob. Kellele: pöörduja. Kontroll: tugevdab (kasutaja enda hinnang, vabatekst + valik). Etapp: **V1-lähedane (PILOOT)**.
2. **Ootel-kaardid** („Ootan vastust Harku vallalt — saadetud 6 päeva tagasi" + kasutaja seatav meeldetuletus). Probleem: ootamise ebamäärasus, unustamine. Kellele: pöörduja. Kontroll: tugevdab, KUI meeldetuletus on kasutaja seatud ja vaikselt platvormisisene. Etapp: **PILOOT**.
3. **Käsitsi ajajoone-sissekanne** („käisin kohapeal, kokkulepe oli…"). Probleem: päris elu sammud (kõne, visiit, paberkiri) ei jõua Teekonnale. Kellele: pöörduja. Kontroll: tugevdab (ainult kasutaja sisestatud). Etapp: **PILOOT**.
4. **Kolmanda isiku märgis** (väli/plokk „puudutab teist inimest: laps/hooldatav/muu") + eraldi hoiatus jagamislävel. Probleem: 14.3 lugu 8 ja ptk 13 leke näitavad, et kõige tundlikum info on kellegi teise oma. Kellele: hooldajad, lapsevanemad. Kontroll: tugevdab. Etapp: **V1 märgisena lävel, PILOOT täiskujul**.
5. **Selgituskaart** — kasutaja koostatud taaskasutatav lühitutvustus („mida olen juba selgitanud"), mida saab külmutatud väljavõttena lisada eri pöördumistesse. Probleem: „räägi kõik uuesti" korduvus eri adressaatidega. Kontroll: tugevdab (üks tekst, kasutaja hallatav). Etapp: **HILISEM** (eeldab manifest-jagamist).
6. **„Kui vastust ei tule" turvavõrk** — kasutaja seatav reegel „kui N päeva pole vastust, NÄITA mulle alternatiive" (teenusekaart, abisoov, uus adressaat). Probleem: ummikusse jäämine. Kontroll: piiripealne — lubatud ainult kuvamisena, mitte automaatse tegevusena. Etapp: **PILOOT/HILISEM**.
7. **Kriisi-kiirkaart kasutajale endale** — kui riskisignaal tuvastatakse, kuvatakse see KASUTAJALE rahuliku „kiire abi" kaardina (112, ohvriabi, kriisiliinid), mitte kunagi adressaadile. Probleem: praegu riskisignaalid ainult lekivad väljapoole ega aita inimest ennast. Kontroll: tugevdab (info inimesele endale). Etapp: **V1** (odav, olemasolev tuvastus).
8. **Kohtumise ettevalmistuskaart** — enne kokkulepitud kohtumist koostab kasutaja kinnitusel ühe „kaasavõtu-lehe" (minu küsimused, dokumendid, soovid); allalaaditav/prinditav. Probleem: kohtumisel unustamine; U10 katab kohtumise JÄRELpoole, mitte pöörduja EELpoolt. Kellele: pöörduja (ja kaudselt spetsialist). Kontroll: tugevdab. Etapp: **PILOOT**.
9. **„Loe ette" Teekonna vaates** — olemasoleva TTS-API (/api/tts) rakendus kokkuvõttele ja järgmistele sammudele. Probleem: lugemisraskus/väsimus sihtrühmas. Kontroll: neutraalne. Etapp: **PILOOT** (tehniliselt odav, kasutab olemasolevat).
10. **Paberilt Teekonnale** — foto/skaneeringu lisamine sündmuseks (olemasolev dokumendianalüüs teeb kokkuvõtte; Teekonnale jääb VIIDE dokumendile, mitte koopia). Probleem: ametlik suhtlus käib sageli paberil. Kontroll: tugevdab. Etapp: **HILISEM**.
11. **Teekonna ühisvaade lähedasega** (vaatamisõigus usaldusisikule). Probleem: eakas kasutaja tahab, et tütar näeks seisu. Kontroll: OHTLIK ilma rolli- ja audience-lepinguta (kehtiv tooteotsus: pöörduja↔pöörduja rada EI ole toetatud). Etapp: **TEADLIKULT VÄLJA JÄTTA** kuni eraldi otsus; vahevorm = eksport/allalaadimine, mida inimene ise näitab.
12. **Anonüümsed rajamustrid** („sinu olukorras aitas teisi sageli X") koondstatistikast. Probleem: teadmatus, mis üldse võimalik on. Kontroll: automatiseerimise ja normaliseerimise risk (varjatud soovitusskoor). Etapp: **TEADLIKULT VÄLJA JÄTTA** V1/piloodist; kaaluda alles k-anonüümse kihi ja eetikaotsusega.

### 14.6. Seosed ülejäänud platvormiga (seosekaart)

Iga rida: mis liigub / kelle kinnitusel / originaal–viide–külmutatud / kuidas eemaldatakse / mida teine pool näeb / tõeallikas. PRAEGU = aktiivne kood; SIHT = soovitatav leping.

| Ühendus | Mis liigub | Kinnitus | Kuju | Eemaldamine | Teine pool näeb | Tõeallikas |
|---|---|---|---|---|---|---|
| Vestlus → Teekond | olukorra tekst mustandiks | kasutaja („Salvesta teekond") | külmutatud sisend loomisel | Teekonna kustutus (O-TK2) | — (mõlemad kasutaja omad) | Teekond |
| Teekond → vestlus (SIHT) | viide „pärineb vestlusest" (conversationId, skeemis valmis) | kasutaja | viide | vestluse kustutus → SetNull | — | vestlus |
| Teekond → eelpöördumine | valitud väljavõte (PRAEGU: kõik, vt ptk 13; 13.8 piir; SIHT: manifest-põhine snapshot) | kasutaja lävel + saatmisel (2 kinnitust) | **külmutatud väljavõte** + viide sourceJourneyId | U3 tagasivõtt enne avamist; side katkeb SetNull-iga Teekonna kustutusel | ainult kinnitatud väljavõtte | pöördumine (saadetud versioon) |
| Eelpöördumine → Teekond (tagasiside) | staatus/tulemus (PRAEGU: ainult loend „Seotud eelpöördumised"; SIHT: staatuse peegeldus rajal + tulemuse kirje) | automaatne staatus, kasutaja hinnang käsitsi | viide | pöördumise arhiveerimine | — | pöördumine |
| Teekond → Teenusekaart | filtrivihjed (teemad, piirkond) URL-parameetritena | kasutaja (klõps) | tuletis, ei salvestu | — (stateless) | mitte midagi (teenusekaart ei näe Teekonda) | Teekond |
| Teenusekaart → Teekond (SIHT) | valitud kontakt viitena („Seo Teekonnaga") | kasutaja | viide | kasutaja eemaldab; kirje kadumisel SetNull | — | teenusekaart |
| Teekond ↔ dokumendid | PRAEGU: mitte midagi (linked*Ids surnud); SIHT: dokumendiviide + jagamisel dokumendi LISAMINE väljavõttesse eraldi kinnitusega | kasutaja | viide (privaatselt); külmutatud koopia ainult saadetud pöördumises | viite eemaldamine; dokumendi kustutus → viide kaob | adressaat näeb ainult pöördumisse kinnitatud dokumenti | dokumendihoidla |
| Teekond → abisoov/abipakkumine | valitud väljavõte (shareKeys-muster olemas HelpRequestSharePanel-is; sama lekkerisk — kontrollimata selles analüüsis, märgitud ptk 14.10 TK-P0 laienduseks) | kasutaja + avaldamise kinnitus | külmutatud väljavõte | kuulutuse mahavõtt | avalik kaart näeb ainult kuulutust | kuulutus |
| Eelpöördumine → vestlusruum | ruumi loomine vastuvõtja poolt; pöördumise sisu EI kopeeru ruumi | vastuvõtja avab, pöörduja osaleb | viide (ruum ↔ pöördumine) | ruumist lahkumine / U12 | ruumi liikmed näevad ruumi sisu, mitte Teekonda | ruum |
| Teekond ↔ teavitused | PRAEGU: ainult U2 tööjärje-kirje (katkise lingiga); SIHT: journey-sündmused (vastus saabus, tähtaeg läheneb) fakti+viitena, sisuta | süsteem (fakt), kasutaja avab | viide | teavituse lugemine/aegumine | — | sündmuse allikas |

Läbiv reegel: **Teekonna sisu originaal ei lahku kunagi Teekonnalt**; teistesse moodulitesse liigub kas tuletis (filtrivihje), viide (id) või kasutaja kinnitatud külmutatud väljavõte. Ükski sissetulev ühendus ei kirjuta Teekonda ilma kasutaja tegevuseta.

### 14.7. Privaatne tööruum ja jagatav väljund

Neli rangelt eristatud kihti:

1. **Privaatne Teekond** — elav, muudetav, ainult omanik. Sisaldab ka AI tuletisi (riskisignaalid, soovitused), mis on märgistatud AI omadena ja EI OLE kunagi vaikimisi jagatavad.
2. **Kinnitatud jagatav väljavõte** — kasutaja lävel kokku pandud **külmutatud snapshot + manifest** (millised võtmed, mis ajahetkel, mis sisuga). See on AINUS koht, kus Teekonna sisu tohib duplitseeruda. Tehniliselt on kandja juba olemas: `assessmentState.sharedJourneyInfo` (`userConfirmed:true`) — see tuleb muuta ainukanaliks (ptk 13.5), mitte lisada uut skeemi.
3. **Saadetud eelpöördumine** — väljavõtte kandja koos kasutaja OMA kirjutatud tekstiga. Pärast saatmist külmutatud (U3 parandus loob uue versiooni, mitte ei muuda vana); viide `sourceJourneyId` seob tagasi ilma sisu jagamata.
4. **Saatmisjärgne uus info** — adressaadi märkmed/checklist jäävad adressaadi poolele (juba nii: receiverNote on vaatajapõhine); kasutaja uus info EI voola pöördumisse ega Teekonda automaatselt — kasutaja lisab ise (parandus U3 kaudu pöördumisse; sündmus/tulemus Teekonda).

Mudel ühe lausega: **üks allikas (Teekond) → üks külmutus (manifest-väljavõte) → üks kandja (pöördumine); tagasi liiguvad ainult faktid ja viited, mitte sisu.** See kaotab praeguse nelja-konteineri-kopeerimise (ptk 13.1) ilma uue andmemudelita; ptk 13.5 fail-closed leping on selle kohustuslik eeldus.

### 14.8. Kolm võimalikku tulevikumudelit

**M1 — lihtne kronoloogiline ajajoon.** Teekond = sündmuste jada (kirjeldused, pöördumised, vastused, märkmed), uusim üleval.
- Pluss: kõige arusaadavam metafoor; „mis on juhtunud" saab lõpliku vastuse; tehniliselt odav (sündmuslogi + kirjutajad).
- Miinus: ei vasta „mis edasi?"; pika venimise korral muutub logiks, mille algusest kaob ülevaade; olukorra HETKESEIS (kokkuvõte, teemad) jääb kirjete alla mattuma.

**M2 — eesmärkide ja järgmiste sammude töölaud.** Teekond = eesmärgid, sammud olekutega (kavas/tehtud), tähtajad.
- Pluss: tegevuskeskne, vastab „mis edasi?" otse.
- Miinus: suurim risk muutuda varjatud juhtumiplaaniks/ülesannete-halduriks — spetsialisti loogika hiilib kasutaja privaatruumi; „eesmärkide" keel on koormatud inimesele võõras ja survestav; tegemata sammud muutuvad süütundegeneraatoriks. Vastuolus piiranguga „mitte varjatud juhtumitoimik".

**M3 — privaatne olukorralõuend + külmutatud jagatavad väljavõtted.** Keskmes olukorra HETKESEIS (kokkuvõte, teemad, seotud asjad viidetena), mille küljes on väljavõtete/jagamiste ajalugu.
- Pluss: vastab platvormi ruumilisele keelele (ptk 5 „kaks ruumi, üks lävi" jätkub loomulikult); privaatsuspiir on struktuuris endas (lõuend = privaatne, väljavõte = jagatud); praegune andmemudel katab pea kõik.
- Miinus: üksi ei vasta „mis on juhtunud/muutunud" — vajab ajaloo-selgroogu.

**M4 (soovitus) — olukorralõuend, mille selgroog on ajajoon:** M3 + M1 kombinatsioon, M2 teadlikult kõrvale jättes. Lõuend näitab HETKESEISU ja kuni kaht järgmist VALIKUT (mitte ülesannet); ajajoon (kasutaja ja tema algatatud sündmused + pöördumiste faktid) elab lõuendi all/kõrval ja toidab „mis muutus" vaadet; jagatavad väljavõtted on lõuendi servas külmutatud kaartidena (manifest + staatus + tagasivõtu viide).
- **Põhjendus:** (a) *arusaadavus* — kolm põhiküsimust saavad igaüks oma koha (seis=lõuend, minevik=ajajoon, edasi=valikud); (b) *privaatsus* — jagatu on füüsiliselt eraldi kaardirida, mitte lõuendi sees laiali; (c) *teostatavus* — Journey mudel + sharedJourneyInfo + sündmuslogi kirjutajad katavad selle ilma skeemimuutuseta (versioonid hiljem); (d) *ühendatavus* — viidete-põhine seosekaart (14.6) sobib dokumentide, teenusekaardi, ruumide ja U1/U2-ga; kovisiooni „privaatala + jagatud objektid" muster on sama grammatika.

### 14.9. Soovitatud minimaalne tervikversioon (aus lubadus)

Avalik lubadus (messages/et.json:4572, kuvatakse /voimalused lehel): *„Sinu sammud püsivad Teekonnal koos: kokkuvõte senisest, seotud teemad, puuduolev info ja järgmised sammud. Teekond on privaatne. Sina otsustad, kas ja kellega seda jagad, ning midagi ei liigu edasi ilma sinu kinnituseta."* Praegu on sellest aus ainult „kokkuvõte + teemad püsivad" osa; „sammud püsivad koos", „järgmised sammud" ja „midagi ei liigu ilma kinnituseta" ei ole täidetud (14.2, ptk 13).

**Enne pilooti vajalik (= lubaduse miinimum):**
1. jagamislekke P0 suletud (13.7 p 1 või 13.8 ajutine piir) — „midagi ei liigu ilma kinnituseta" muutub tõeseks;
2. kerimisblokk parandatud (Etapp 0) — voog on füüsiliselt läbitav;
3. automaatsalvestus + oleku-URL + U2 süvalingi parandus — „püsivad" muutub tõeseks ka poolelioleva töö kohta;
4. aus rada: roadmap loeb linkedPreInquiries + pöördumise staatust; review-suunanupud eemaldatud; „Tehtud sammud" saab päris kirjutajad (loomine, muutmine, pöördumine saadetud/vastu võetud);
5. kustutamine (O-TK2 vaikevariandiga) + lihtne teksti-eksport — omanditunne ja õiguslik baas;
6. kriisi-kiirkaart kasutajale endale (14.5 idee 7) — riskisignaalid hakkavad inimest ennast teenima.

**Piloodi käigus katsetatav:** ootel-kaardid + tulemuse kirje; „mis muutus" vaade; käsitsi ajajoone-sissekanne; kolmanda isiku märgis lävel; dokumendiviited; kohtumise ettevalmistuskaart; lihtvaade + „loe ette".

**Hilisem:** harud/peatükid; selgituskaart; versioonivaade; teenusekaardi kontakti sidumine; „kui vastust ei tule" turvavõrk; paberilt-sisse.

**Teadlikult välistatud:** edenemis-/riskiskoorid ja pingeread; adressaadile nähtav Teekonna vaade mis tahes kujul; lähedase vaatamisõigus ilma eraldi rollilepinguta; automaatsed otsused/saatmised; anonüümsed rajamustrid enne k-anon+eetika otsust.

### 14.10. Rakendamise järjestus (sõltuvusteadlikud paketid)

Etteantud piirangud: (1) jagamislekke P0 enne uut jagamisfunktsionaalsust; (2) kerimisblokk enne ruumilist prototüüpi; (3) automaatsalvestus/taastatav olek enne Flight- või faasiliikumist; (4) Teekond ei tohi muutuda varjatud juhtumitoimikuks; (5) vastuvõtja vaadet ei laiendata ilma eraldi audience-lepinguta.

- **TK-P0 — usalduspiir** (= ptk 13.7 p 1 / 13.8; kiip olemas): prefill fail-closed VÕI ajutine kärbe + markeri-testid. *Laiendus:* sama kontroll abisoovi-üleandmisele (HelpRequestSharePanel, 14.6 rida 8). DoD: adressaadi serialiseering ei sisalda ühtegi märkimata Teekonna markerit.
- **TK-P1 — füüsiline ligipääs** (= Etapp 0; kiip olemas): kerimine + Esc + karusselli valve. DoD: review-ekraan ja detailvaade läbitavad ratta/puute/klaviatuuriga.
- **TK-P2 — püsivus:** automaatsalvestus (seadmesisene), sammud URL-i, U2 süvalink (`/teekond/[id]` või parameetri lugeja), taasavamise nupp. Sõltub: TK-P1 (muidu parandatakse lehte, mida ei saa kasutada). DoD: F5/tagasi/Esc ei kaota kunagi sisestust; „Jätka siit" avab õige Teekonna.
- **TK-P3 — aus elutsükkel:** sündmuslogi kirjutajad; roadmap päris andmetest; suunanuppude eemaldus; pöördumise staatuse peegeldus; kustutamine + eksport; kriisi-kiirkaart. Sõltub: TK-P2 (sündmused vajavad püsivat olekut). Piirang 4 valve: sündmused on ainult kasutaja omad ja tema algatatud; ei mingeid olekuid „täidetud/täitmata" kohustuste keeles. DoD: 14.2 tabelis kaovad kõik EKSITAVALT LUBATUD read.
- **TK-P4 — sidumised ja manifest-jagamine:** dokumendiviited; väljavõtte-manifest ainukanalina + võtmehaaval taastatud eeltäited (kui TK-P0 oli ajutine kärbe); „mida olen sellest Teekonnast jaganud" koondplokk; kolmanda isiku märgis lävel. Sõltub: TK-P0 + TK-P3. Piirang 5 valve: adressaadi vaade EI muutu — kõik uus on autori-poolne. DoD: 13.6 täistestid rohelised; JourneyDetaili „Seotud asjad" näitab ainult päris seoseid.
- **TK-P5 — esitluskiht ja ruumiline keel:** stepperi/kiipide/roadmapi CSS, i18n, topelt-ⓘ; seejärel lõuend+lävi (ptk 5–6) ja ALLES SIIS flight-prototüüp (piirang 2+3 täidetud). DoD: ptk 12 Etapp 3–4 kriteeriumid.

Paketid TK-P0 ja TK-P1 on juba eraldi ülesannetena pakutud (kiibid); TK-P2 on järgmise teostaja esimene uus ülesanne (vt 14.12).

### 14.11. Tooteomaniku otsused (mittetuletatavad; soovitatud vaikevariant + tagajärg)

- **O-TK1. Teekonna granulaarsus:** üks Teekond = üks elusituatsioon (mitu aktiivset lubatud) VÕI üks üldine „minu teekond"? *Vaikevariant:* üks olukord, mitu lubatud. *Tagajärg:* loend jääb; harud (14.4) muutuvad hilisemaks alamstruktuuriks, mitte uuteks Teekondadeks.
- **O-TK2. Kustutamine ja retention:** kas kasutaja saab Teekonna jäädavalt kustutada, ja mis saab seotud pöördumistest? *Vaikevariant:* jah, kahesammulise kinnitusega; pöördumised jäävad (õiguslik jälg adressaadi jaoks), side katkeb (`sourceJourneyId` SetNull on skeemis juba olemas); arhiveerimine jääb pehmeks vaikevalikuks. *Tagajärg:* „Seotud eelpöördumised" tagasilink kaob kustutatud Teekonnalt; retention-tähtaega (nt arhiveeritud N kuud) saab lisada hiljem.
- **O-TK3. AI riskisignaalide saatus:** kas need jäävad kasutajale nähtavaks kihiks („ettevaatlikud tähelepanekud" + kriisi-kiirkaart) ja mitte kunagi automaatselt väljavõttesse? *Vaikevariant:* jah. *Tagajärg:* 13.5 leping fikseerib; kui kasutaja tahab neid jagada, kirjutab oma sõnadega.
- **O-TK4. Vestlusseose sisselülitamine:** kas vestlusest loodud Teekond seotakse conversationId-ga ja kuvatakse viide „pärineb vestlusest"? *Vaikevariant:* jah, viitena (mudel valmis, service.js:17–52). *Tagajärg:* vestluse kustutus → SetNull; vestluse SISU Teekonnale ei kopeeru.
- **O-TK5. Meeldetuletuste kanal:** kas Teekonna tähtajad/ootel-kaardid kasutavad U1 kihti (platvormisisene + olemasolev opt-in e-kiri) või ainult platvormisisest? *Vaikevariant:* U1 platvormisisene; e-kiri ainult üldise opt-in'iga, sisuvaba. *Tagajärg:* uusi kanaleid ei teki; survestamise risk püsib madal.
- **O-TK6. Kolmanda isiku märgis:** vabatahtlik või kohustuslik küsimus? *Vaikevariant:* V1-s vabatahtlik Teekonnal, KOHUSTUSLIK kinnitus jagamislävel, kui personContext/laps-signaal olemas. *Tagajärg:* lävele lisandub üks tingimuslik samm; loomata jääb „laste-erirežiim" enne eraldi analüüsi.
- **O-TK7. Avaliku lubaduse ajastus:** kas /voimalused s3 tekst pehmendatakse kuni TK-P3 valmimiseni? *Vaikevariant:* jah (nt „hakkavad püsima" asemel praegune absoluutne sõnastus maha). *Tagajärg:* turundus ja tegelikkus on kooskõlas; pärast TK-P3 taastatakse täislubadus.
- **O-TK8. Ajutise kärpe valik (13.8 vs kohene täisparandus):** kas homme rakendatakse 13.8 kärbe (eeltäited kaovad ajutiselt) või minnakse otse 13.5 täislepingule? *Vaikevariant:* 13.8 kohe + täisleping TK-P4-s, KUI täisparandust ei jõuta ühe päevaga testida; muidu otse täisleping. *Tagajärg:* vahepealsel perioodil on Teekonnast-alustamine tühja vormiga (funktsionaalsuse ajutine kadu, 13.8 p 6).

### 14.12. Lõpphinnang ja jätkamispunkt

- **Kas praegune tootelubadus on täidetud?** Ei. Neljast lubaduse osast peab ainult „kokkuvõte ja teemad püsivad": „sammud püsivad koos" (sündmusi ei koguta, seosed on surnud võtmed), „järgmised sammud" (kolm vastuolulist ja osalt petlikku süsteemi) ja „midagi ei liigu ilma kinnituseta" (ptk 13 runtime-tõend) ei pea. Lisaks on voog töölauapaneelis füüsiliselt läbimatu (kerimisblokk).
- **Kolm suurima väärtusega puuduvat võimet:** (1) automaatsalvestus + taastatav olek (iga teine võime on kasutu, kui sisestus kaob); (2) aus sündmuste- ja seosekiht (päris ajajoon + pöördumise staatuse peegeldus → „mis muutus"); (3) manifest-põhine jagamisväljavõte (13.5) — usalduse alus.
- **Seni nimetamata funktsioon, mis väärib kõige rohkem prototüüpi:** ootel-kaardid + pöördumise tulemuse kirje (14.5 ideed 1–2) — see sulgeb kasutaja põhitsükli (saatsin → ootan → sain/ei saanud → mis edasi), mida ükski praegune moodul ei kata.
- **Ohtlik või eksitav, teadlikult välja jätta:** M2-stiilis eesmärkide/ülesannete töölaud kohustuste keeles (varjatud juhtumiplaan + süütunde-generaator); edenemis-/riskiskoorid ja pingeread; adressaadile nähtav Teekonna vaade; lähedase vaatamisõigus ilma rollilepinguta; anonüümsed rajamustrid enne k-anon+eetika otsust. Ohtlik on ka praegusel kujul JÄTTA alles asju, mis teesklevad töötamist (surnud „Seotud asjad", kasvamatu „Tehtud sammud", valetav rada) — eemaldamine on odavam kui usalduse kaotus.
- **Järgmise teostaja esimene piiritletud ülesanne pärast jagamislekke parandust:** **TK-P2 püsivuspakett** — Teekonna mustandi automaatsalvestus (seadmesisene), loomise/koostamise sammud URL-i, U2 süvalingi parandus, taasavamise nupp. Väike, mõõdetav, disainist sõltumatu; DoD: F5/tagasi/Esc ei kaota sisestust ja „Jätka siit" avab õige Teekonna.

**Jätkamispunkt järgmisele aknale:** ptk 14 on COMPLETE seisuga 15.07.2026 öö, `main` @ 7ae76d5b. Kontrollimata jäi kaks kõrvalharu, mis tasub järgmisena üle vaadata: (a) abisoovi-üleandmise (`buildHelpMediationHandoff` + HelpRequestSharePanel) shareKeys-lekke kontroll sama markeritehnikaga (14.6 eeldab, et muster kordub); (b) DataDeletionJob/konto-kustutuse rada Teekonna andmete osas (skeemi kaskaad on olemas, töövoo käitumine kontrollimata). Tooteomaniku laual: O-TK1…O-TK8 (eriti O-TK2 kustutamine ja O-TK8 ajutise kärpe valik). **See peatükk on analüüs ja soovitus — mitte rakendamise, merge'i ega deploy otsus; rakenduskoodi, skeemi ega migratsioone ei muudetud.**

# 15. TK-P0 turvasabade järelkontroll ja rakendusvalmis leping

PEATÜKI STATUS: COMPLETE (15.07.2026 öö). Skoop: AINULT ptk 14.12 kaks kontrollimata saba + nende põhjal TK-P0 lõplik leping. Ptk 1–14 ja Teenusekaardi üldanalüüsi ei korrata; teadaolevat V1/V2 help-listingu mustandinähtavuse leidu (memory: teenusekaart-abivahendus tervikvoog) ei dubleerita.

## 15.1. Teekond → abisoov või abipakkumine

**Tulemus ette: Teekonna SISU siin EI leki — voog on pre-inquiry vastand.** Pre-inquiry rajal voolas kõik võtmetest hoolimata; siin ei voola valitud võtmetega MITTE MIDAGI. Kontroll oli staatiline ja ammendav: `lib/help/` kataloogis pole ühtegi `journey`-viidet (grep: 0 vastet) — help-torustikul puudub üldse koodirada Journey ridade lugemiseks. Runtime-markerikatse polnud seetõttu vajalik: leket ei saa käivitada, sest lugejat ei eksisteeri.

Andmevoog lülihaaval (`main` @ 7ae76d5b):

1. **Teekonna väljad → handoff:** `buildHelpMediationHandoff` LOEB kogu Teekonna teksti (title, summary, domains, missingInfo, **riskSignals**, suggestedActions, context.needTags/keywords — helpMediationHandoff.js:40–52), kuid AINULT regex-klassifikatsiooniks. Väljund (read 92–101) sisaldab ainult: `categoryCode` (enum), `taxonomy` (staatiline sild), `municipalityName` (context'ist, read 62–73) ja URL-id. Ükski sisulause ei välju.
2. **shareKeys, mida kasutaja näeb:** HelpRequestSharePanel 6 märkeruutu — summary, category, region, timing, conditions, ownWords (JourneyDetail.jsx:535–542) → URL `share=...`.
3. **Mida server jõustab:** mitte midagi — `share` parameeter jõuab AINULT literaalse stringina `draft.extraNotes` välja („fromJourney:<id>; share:<võtmed>", ChatBody.jsx:144–147). Ükski võti ei juhi ühtegi andmevoogu. Märkeruudud on **teater mõlemas suunas**: valimine ei too midagi kaasa, mittevalimine ei hoia midagi tagasi (sest midagi ei liigugi).
4. **Mis salvestatakse:** kuulutuse loomine (lib/help/requests.js:203–236, offers.js:202) ei võta vastu ega salvesta ÜHTEGI Teekonna välja; `HelpRequest`/`HelpOffer` mudelitel (schema:2586–2668) pole `extraNotes` ega `sourceJourneyId` veergu — extraNotes jääb vestlustöövoo mustandiolekusse ega jõua kuulutusse.
5. **Nähtavus:** omanik näeb oma kuulutust; teine autenditud kasutaja ja autentimata kaardikülastaja näevad kuulutust/kaardikirjet (`HelpMapEntry`: kategooria, piirkond, taksonoomia needTags — schema:2669–2708) — Teekonna sisu pole üheski. Teadaolevat V1/V2 mustandinähtavuse leidu see EI muuda ega võimenda: Teekonna handoff ei lisa sellele eraldi sisuleket.
6. **Külmutatud snapshot/manifest:** PUUDUB, sest sidet ennast ei salvestata — kuulutus ei tea, et ta Teekonnast alguse sai (kooskõlas 14.2 leiuga: Teekonna „Seotud abisoovid" jääb igavesti tühjaks).
7. **Eemaldamine:** kuulutuse kustutus kustutab kaardikirje ja sobitused kaskaadiga (`HelpMapEntry.request/offer onDelete: Cascade`; `HelpMatch.request/offer Cascade`, schema:2697–2698, 2768–2769); sobitusruum jääb alles (`HelpMatch.room SetNull`), kuid ei sisalda Teekonna sisu. Kuna Teekonna sisu koopiat ei teki, pole midagi, mis „järele jääks".

**Mis siiski liigub (tuletised, mitte sisu):** (a) `categoryCode` — tuletatakse regex-iga ka **riskisignaalidest** (helpMediationHandoff.js:47): AI hüpotees võib üksi lülitada kategooria (nt CARE_SUPPORT) sisse — kategooria-tasemel minimaalne infovihje, mille kasutaja töövoo väljal näeb ja enne avaldamist kinnitab; (b) `municipalityName` — asukoht, samuti nähtav ja kinnitatav (`rawPlace` väli + confirmationPending enne avaldamist); (c) **Teekonna ID + share-valikute string** draft-olekus (`extraNotes`) — ei persisti kuulutusse, jääb kasutaja enda vestlustöövoo olekusse; leke puudub, aga sisemine ID võõras kohas on kraam, mille TK-P0 võib ühes käigus koristada.

**15.1 leiud:** L1 (UX, mitte leke): 6 jagamis-märkeruutu ilma ühegi juhtmeta — sama muster mis P2-2 „suunanupud"; irooniline pööre: paneeli privaatsuslubadus („kogu Teekonda ei kopeerita kuulutusse") on siin sõna-sõnalt TÕENE. L2 (nüanss): kategooria tuletamine riskisignaalidest — soovitus piirata tuletuse sisend summary+domains-iga. L3 (hügieen): `fromJourney`/`share` stringid extraNotes'is — eemaldada või asendada puhta viitega, kui side kunagi päriselt ehitatakse.

## 15.2. Konto kustutamine ja Teekonna andmed

**Teenusejada (lib/privacy/userDeletion.js:179–275):** `deleteUserWithPrivacyCleanup` → DataDeletionJob (PENDING) + ligipääsu peatamine + sessioonide kustutus → `performUserPrivacyCleanup` (read 68–140: dokumentide RAG-viited ja failid, materjalifailid, artefaktide märge, verifitseerimistokenid, **chatLogs kustutatakse eksplitsiitselt**, praktikakandidaatide scrub) → lõpuks `user.delete` → **kõik ülejäänu teeb Prisma kaskaad**. Teenuses pole ühtegi journey-viidet (grep: 0) — Teekond toetub täielikult skeemile.

**Runtime-tõend (sünteetilised kasutajad, otse kaskaadi vastu; kõik koristatud, 0 jääki):** autori kustutamisel `journey_cascades:true`, `sent_inquiry_cascades_with_recipient_note:true`; vastassuunal `reverse_setnull_keeps_deleted_users_note:true`.

Andmeklasside kaupa:

| Andmeklass | Saatus autori konto kustutamisel | Alus |
|---|---|---|
| Journey (privaatne originaal, sh `context`/`personContext`/`activityLog`/riskisignaalid) | **kustub** (Cascade) | schema:1232; runtime-tõend |
| Teekonna mustandid (pooleliolev olek) | serveris ei eksisteerigi (14.2); kliendi sessionStorage jääb SEADMESSE — väljaspool serveri vastutust | ptk 14.2 |
| Teekonnast loodud eelpöördumised (ka **SENT**, adressaadi kätte jõudnud) | **kustuvad täielikult** (author Cascade) — koos külmutatud väljavõttega (`assessmentState.sharedJourneyInfo`) JA **adressaadi enda receiverNote/checklist/nextContactOn väljadega**, mis elavad samal real | schema:1891; runtime-tõend |
| Saadud pöördumised (kustutatav kasutaja oli adressaat) | jäävad autorile, `recipientOwnerId` → null (SetNull); **kustutatud kasutaja kirjutatud receiverNote JÄÄB reale alles** — serializer ei näita seda enam kellelegi (isRecipient ei saa enam tõeseks), aga tekst püsib DB-s orvuna | schema:1892; serializePreInquiry:565–572; runtime-tõend |
| Teekonnast alustatud abisoovid/abipakkumised | **kustuvad** (user Cascade) + kaardikirje ja sobitused kaskaadiga; sobitusruum jääb (SetNull) — Teekonna sisu seal pole (15.1) | schema:2612, 2697–2698, 2768–2769 |
| Seotud dokumendiviited | Teekonnal päris dokumendiviiteid ei eksisteeri (14.2 surnud võtmed); dokumendid ise kustutatakse teenuses (failid + RAG-viited) | userDeletion.js:88–107 |
| Teavitused (kasutaja enda) | **kustuvad** (Cascade) | schema:1935 |
| Teavitused (TEISTE kasutajate omad, mis viitavad kustutatud objektidele, nt adressaadi „uus pöördumine saabus") | jäävad alles **rippuva `sourceId` viitega** — sisu ei leki (U1 kannab ainult fakti+viidet), aga sihtobjekti avamine annab tühja/404 | NotificationEvent mudel (sourceId ilma FK-ta) |
| Auditikirjed (DataAuditLog, DataDeletionJob) | jäävad alles õigusliku kandjana — sisaldavad ainult ID-sid ja metat, MITTE sisu | schema:1416–1432; userDeletion.js:203–214 |
| Otsingu-/RAG-jäljed | Teekond ei sisene RAG-i üheski koodirajas; vestluslogid kustutatakse eksplitsiitselt; U6 isiklik otsing on harul, mitte main-is | grep + userDeletion.js:134 |
| Pöördumisest avatud ruum | ruum püsib (iseseisev objekt); `originId` võib jääda rippuma kustutatud pöördumisele — ruumi SISU on osaliste oma, Teekonna sisu seal pole | Room.origin* väljad |

**Kolme kihi eristus:** (1) *privaatne originaal* (Journey) kustub õigesti ja täielikult; (2) *kasutaja kinnitatud snapshot* elab ainult pöördumise real ja kustub koos sellega — st kustub KA adressaadi käest; (3) *teise osapoole õiguspäraselt säilitatav saadetud pöördumine* — **sellist kihti praegu ei eksisteeri**: autori kustutus võtab adressaadilt kätte saadud dokumenteeritava kontakti (ideed.md §11.8 ootus) ja hävitab adressaadi ENDA töömärkmed. Vastupidises suunas jääb kustutatud inimese kirjutatud märge põhjendamatult orvuks.

**15.2 leiud:** L4 — autori Cascade hävitab adressaadi kättesaadud SENT-pöördumise + adressaadi töömärkmed (andmekadu teisele osapoolele; retention-tooteotsus); L5 — kustutatud adressaadi receiverNote jääb autori kirje külge nähtamatu orvuna (põhjendamatu jääk); L6 — teiste kasutajate teavitused jäävad rippuvate viidetega (sisulekketa orb; UX-serv).

## 15.3. Leidude raskusaste

Kontekstiks: ptk 13 pre-inquiry leke jääb ainsaks **kinnitatud aktiivseks lekkeks** (P0). Selle peatüki UUED leiud:

| # | Leid | Raskus | Klass ja põhjendus |
|---|---|---|---|
| L1 | Abisoovi jagamis-märkeruudud (6 tk) ilma ühegi juhtmeta | **P3** | puhas UX-puudus; ohutu suund (midagi ei liigu); sama pere mis P2-2 teater, aga privaatsuslubadus on siin tõene |
| L2 | Abi-kategooria tuletatakse regex-iga ka riskisignaalidest | **P3** | teoreetiline tuletise-vihje (enum, mitte sisu); kasutaja näeb ja kinnitab kategooria enne avaldamist; mitte käivitatav lekkena |
| L3 | `fromJourney:<id>; share:<võtmed>` literaalstring draft-oleku `extraNotes` väljas | **P3** | hügieen; ei persisti kuulutusse (mudelil pole veergu); kontrollimata jäi, kas draft-väljad lähevad AI-patcheri prompti — ka siis on sisu vaid ID-string |
| L4 | Autori konto kustutus hävitab adressaadi kättesaadud SENT-pöördumise + adressaadi enda töömärkmed (runtime-tõendatud) | **P1** | tooteotsust vajav retention-küsimus (uus otsus **O-TK9**); privaatsus-esimene vaikimisi kustutus on kaitstav, aga TEISE osapoole töö ja §11.8 „dokumenteeritava kontakti" hävimine ei ole teadlikult otsustatud |
| L5 | Kustutatud adressaadi kirjutatud receiverNote jääb autori kirje külge nähtamatu orvuna (runtime-tõendatud) | **P2** | põhjendamatu privaatandmete jääk — kustutatud inimese tekst püsib DB-s; parandus väike ja serveripoolne |
| L6 | Teiste kasutajate teavitused jäävad kustutatud objektidele rippuvate viidetega | **P3** | sisulekketa orb (U1 kannab ainult fakti+viidet); UX-serv sihtobjekti avamisel |

## 15.4. TK-P0 lõplik parandusleping (fail-closed)

Väikseim serverileping, mis sulgeb neli asja: (1) Teekond→eelpöördumine sisulekke; (2) Teekond→abisoov suuna — **lekkena EI kinnitunud**, seega siin ainult regressioonivalve + hügieen, et see nii jääks; (3) markerita/tundmatu välja vaikimisi edasiliikumise; (4) kustutuse põhjendamatud jäägid (L5; L4 jääb tooteotsuseks O-TK9).

**Jõustamiskohad (täpselt kolm + valikuline neljas):**
1. `buildPreInquiryPrefillFromJourney` (lib/journey/preInquiryHandoff.js) — muutub puhtaks funktsiooniks `(journey, shareKeys ⊆ ALLOWLIST) → prefill`; iga fragment väärtustatakse AINULT oma võtmega; ilma võtmeta fragment ei satu `situation`'i, mustandisse, `sharedJourneyInfo`'sse, topic'usse ega municipality'sse.
2. `POST /api/journeys/[id]/pre-inquiry-draft` (route.js) — valideerib võtmed: tundmatud võtmed EIRATAKSE (fail-closed: käsitle kui puuduvat) ja tagastatakse vastuses `ignoredKeys` loeteluna (läbipaistvus ilma käitumist avamata); mitte-massiiv → 400.
3. `normalizePreInquiryJourneySharedInfo` (lib/preInquiryJourneySharedInfo.js) — manifest muutub püsivaks: `sharedJourneyInfo.confirmedKeys: string[]` (elab olemasoleva `assessmentState` Json-i sees) salvestub koos sisuga `createPreInquiry`/`updatePreInquiry` kaudu — hiljem tõendatav, mida kasutaja kinnitas. Serializeri vaatajaloogikat EI muudeta.
4. *(valikuline D-plokk, L5)* `lib/privacy/userDeletion.js` — adressaadi kustutamisel nullitakse tema kirjutatud `receiverNote`/`receiverChecklist`/`nextContactOn` väljad ridadel, kus ta oli `recipientOwnerId` (üks `updateMany` enne `user.delete`'i).

**Lubatud võtmete ALLOWLIST (ainus lubatud hulk):** `summary`, `domains`, `missingInfo`, `wish` (ainult supportContext.personWish tekst kasutaja soovina), `personContext` (**eraldi võti eraldi kinnitusega — kolmanda isiku info**; `wish` EI too seda kaasa), `assistiveDevices`, `serviceContinuity`, `municipality`, `document` (=contextNote), `title` (topic'u eeltäide). **`riskSignals` EI OLE allowlistis** — ei liigu mitte ühegi võtmega; kui toode tahab neid kunagi jagatavaks, on see eraldi otsus eraldi eelvaatega.

**Tühi või vigane manifest:** `shareKeys=[]` (või kõik tundmatud) → prefill = ainult `sourceJourneyId`, `sourceNotice`, `recipientType`; kõik sisukandjad tühjad/null. See on ka 13.8 ajutise kärpe püsiv erijuht — kärbe JA täisleping annavad tühja manifesti korral identse tulemuse.

**Kliendi roll:** klient võib kuvada märkeruute, elavat payload-eelvaadet ja „Kaasas:" kiipe, kuid EI OLE turvapiir — `filterJourneySharedInfoForPreInquiry` kliendifiltrina kaotab turvatähenduse (võib jääda esituseks); topeltvalik (journey-samm) kaob ühe läve kasuks. Ükski kliendi saadetud „lisasisu" ei saa taastada võtmeta fragmente, sest server ei pane neid prefilli — kasutaja OMA kirjutatud tekst on tema oma (seda ei politseita).

**Abisoovi suund:** uus invariant — help-torustikku (lib/help/) ei tohi tekkida ühtegi Journey-lugejat ilma sama allowlist-väravata (regressioonivalve testiga); hügieen: `extraNotes` ei kanna enam `fromJourney`/`share` stringe (ChatBody.jsx:144–147 eemaldus) ja kategooria-tuletuse sisend piiratakse `summary+domains`-iga (L2).

**Skeem/migratsioon:** EI OLE VAJA — allowlist elab koodis, manifest `assessmentState` Json-i sees, side `sourceJourneyId` on olemas; D-plokk on `updateMany`. Taaskasutatavad väljad: `sharedJourneyInfo` (+confirmedKeys), `sourceJourneyId`, `userConfirmed`. Kontroll: `npx prisma migrate status` peab jääma puhtaks.

**Vastuvõetav ajutine kadu:** kui teostatakse kõigepealt 13.8 kärbe, kaovad eeltäited (sh assistiveDevices) kuni täislepingu valmimiseni; täislepinguga taastuvad võtmehaaval. Muud kadu ei ole — tavarada, käsitsi tekst, saatmine, U3 ja vastuvõtja vaade ei muutu.

## 15.5. Kohustuslikud regressioonitestid

Taristu: `npm test` (node:test, süstitav `{db}` fake-prisma); kaskaadid EI OLE fake-prismaga testitavad → kustutustestid on env-väravaga integratsiooniklass (jooksevad ainult kui test-Postgres on saadaval; sama muster mis `db:migrate:check`). Markeritehnika = ptk 13.6.

1. **`shareKeys=[]` → 0 Teekonna markerit** üheski prefilli väljas (uus `tests/journey/preInquiryHandoffContract.test.js`, tabelipõhine).
2. **Iga allowlist-võti liigub ainult oma võtmega** — võti K sees ⇒ ainult K markerid; teised väljad puhtad (sama fail, iga võtme rida).
3. **Tundmatu võti ei liigu** — `shareKeys:["summary","xyz"]` ⇒ ainult summary; route-vastuses `ignoredKeys:["xyz"]`.
4. **`riskSignals` ei liigu MITTE ÜHEGI kombinatsiooniga** (kõik allowlist-alamhulgad; property-stiilis loop).
5. **`personContext` nõuab oma võtit** — `wish` üksi EI too personContexti; `personContext` võti toob.
6. **Autor ja adressaat näevad ainult oma audience'i** — `serializePreInquiry` laiendus (tests/preInquiries/audienceSerialization.test.js): confirmedKeys nähtav mõlemale, receiverNote ainult adressaadile, konto-e-postid nagu seni.
7. **Avalik kaart ei näe Teekonna sisu** — `buildHelpMediationHandoff` markeri-unit (tests/journey/helpMediation.test.js laiendus): väljund ei sisalda ühtegi journey-teksti markerit; + invariant-test, et handoff'i väljundvõtmete hulk on suletud loend.
8. **Topelt-handoff on idempotentne** — kaks järjestikust prefill-kutset sama (journey, keys) paariga → deepEqual; DB kirjete arv ei muutu (persisted:false püsib).
9. **Konto kustutamine eemaldab privaatse originaali** — integratsioonitest (UXPROBE3 sondi kuju): autori kustutus ⇒ journey 0, authored preInquiry 0 (fikseerib KEHTIVA kaskaadi kuni O-TK9 otsuseni).
10. **Õiguspäraselt säiliv objekt ilma põhjendamatu privaatkoopiata** — pärast adressaadi kustutust: kirje jääb autorile, `recipientOwnerId=null` JA (D-ploki järel) `receiverNote/checklist/nextContactOn = null`.
11. **Orphan-kirjeid ei jää** — pärast autori kustutust: 0 journey/preInquiry ridu markeriga; teavituste rippuvad `sourceId` viited on kas koristatud (kui D-plokk laieneb) või dokumenteeritult fakti-only (test fikseerib valitud käitumise).
12. **ET/EN/RU ja ligipääsetav jagamisvärav** — läve/checkboxide tekstid `t()`-võtmetega (P3-1 kõvakodeeringud kaovad sellel pinnal), `npm run i18n:check` pariteet; render-test: igal märkeruudul on label ja värava kinnitusnupul aria-nimi.

## 15.6. Täpne teostuspakett (järgmisele teostajale)

**Puutepind (failid/funktsioonid):** lib/journey/preInquiryHandoff.js (`buildPreInquiryPrefillFromJourney` — allowlist); app/api/journeys/[id]/pre-inquiry-draft/route.js (võtmete valideerimine + ignoredKeys); lib/preInquiryJourneySharedInfo.js (confirmedKeys manifest); components/journey/JourneyDetail.jsx (share-paneeli võtmenimed allowlisti järgi; personContext eraldi ruut + kolmanda isiku hoiatustekst); components/workspace/WorkspaceFeaturePage.jsx (journey-sammu topeltvaliku eemaldus VÕI selle muutmine puhtaks eelvaateks — minimaalne UI-puude); lib/journey/helpMediationHandoff.js (tuletuse sisend summary+domains); components/alalehed/ChatBody.jsx:144–147 (extraNotes stringide eemaldus); *(D-plokk)* lib/privacy/userDeletion.js (receiverNote-orvu nullimine); testid: tests/journey/preInquiryHandoffContract.test.js (uus), tests/journey/assistiveDevices.test.js (ootuste uuendus), tests/journey/helpMediation.test.js (markerid), tests/preInquiries/audienceSerialization.test.js (laiendus), tests/privacy/journeyDeletionCascade.integration.test.js (uus, env-väravaga).

**Tööjärjekord (punane → roheline):**
1. Kirjuta testid 15.5 p 1–5 ja 7–8 UUE lepingu ootustega → punased (fikseerivad praeguse lekke).
2. Allowlist-värav handoff'i (p 1–2, 4–5 rohelised).
3. Route'i võtmevalidatsioon + ignoredKeys (p 3 roheline).
4. Manifest confirmedKeys normalizesse + save-rajale (p 6 laiendus roheline).
5. UI võtmete ühtlustus + topeltvaliku eemaldus/eelvaadeks muutmine (visuaalne kontroll; mitte turvapiir).
6. Help-hügieen (extraNotes + tuletuse sisend) (p 7 roheline).
7. Integratsioonitestid 9–11 (env-väravaga; D-plokk kui O-TK9/L5 heaks kiidetud — muidu p 10 fikseerib kehtiva käitumise).
8. i18n-võtmed + render-test (p 12), `npm run i18n:check`.

**Kontrollkäsud:** `npm test`; `npm run i18n:check`; `npx prisma migrate status` (peab olema puhas — skeemimuutust ei tohi tekkida); lõpuks ptk 13 meetodil käsitsi SENT-markerisond (kaks kontot, minimaalsed võtmed, adressaadi GET).

**Teadlikult EI muudeta:** `serializePreInquiry` vaatajaloogika; vastuvõtja UI ja töövoog; retention-/kustutuskäitumine peale L5 D-ploki (L4/O-TK9 on tooteotsus); Teenusekaardi V1/V2 mustandinähtavuse leiud (eraldi töö); kerimisblokk (TK-P1 kiip); Teekonna UI ümberdisain (TK-P2+).

**Lõpetamiskriteeriumid:** kõik 15.5 testid rohelised; korratud SENT-markerisond annab adressaadi vastuses 0 märkimata markerit; prefill idempotentne; migrate status puhas; i18n pariteet; `npm test` täiskomplekt roheline (sh vanade testide teadlikud ootuse-uuendused dokumenteeritud commit-sõnumis).

**Sõltumatu järelkontrolli fookus:** (a) korda markerisondi teise akna poolt; (b) grep, et help-/muudesse torudesse pole tekkinud uusi Journey-lugejaid; (c) kontrolli, et journey-sammu muudatus ei murdnud salvestatud pöördumise avamist (`workflowMode:"existing"`); (d) kinnita, et ignoredKeys ei avalda midagi peale staatiliste võtmenimede.

**Jätkamiskäsk järgmisele koodi teostavale aknale (kopeeritav):**

```text
Loe docs/platvormi arendus/fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md peatükid 13.5, 13.8 ja 15.4–15.6 ning teosta TK-P0 pakett täpselt 15.6 tööjärjekorras (punane→roheline). Piirid: ära muuda serializePreInquiry vaatajaloogikat, vastuvõtja UI-d, retention-käitumist (v.a L5 D-plokk, kui tellija kinnitab) ega skeemi/migratsioone. Lõpuks: npm test, npm run i18n:check, npx prisma migrate status, ja korda ptk 13 SENT-markerisondi kahe kontoga (sünteetilised andmed, korista kõik).
```

PEATÜKI 15 STATUS: **COMPLETE** — blokeerijaid ei ole. Mõlemad 14.12 sabad on suletud: abisoovi suund EI leki (staatiliselt ammendav tõestus + kolm P3 kõrvalleidu), kustutuse suund andis kaks uut leidu (L4 = tooteotsus O-TK9: kas SENT-pöördumine peab autori kustutuse üle elama anonüümitud/õigusliku kandjana; L5 = väike D-plokk paketis). See peatükk on sihitud turvajärelkontroll ja tööleping — MITTE koodi rakendamise, merge'i ega deploy otsus; rakenduskoodi, skeemi ega migratsioone ei muudetud; runtime-katsed kasutasid ainult sünteetilisi andmeid ja kõik loodud kirjed on kustutatud (cleanup: users=1 järelejäänu kustutatud, 0 jääki).
