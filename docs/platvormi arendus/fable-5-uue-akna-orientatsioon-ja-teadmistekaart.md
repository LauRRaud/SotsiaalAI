# Fable 5 uue akna orientatsioon ja teadmistekaart

Kuupäev: 14.07.2026 (õhtu)
Koostaja: Fable 5, uus tööaken
Staatus: **COMPLETE** — orientatsioon lõpetatud ja Kovisiooni sihtkontrolliga ajakohastatud.
Eesmärk: terviklik orientatsioon platvormile enne uut ideeringi. See EI ole audit, tööplaan ega ideede genereerimine.
Tõendusalus: 12 kohustuslikku dokumenti `docs/platvormi arendus/` kaustast + aktiivse `main`-i kohapealne kontroll (git-seis, Prisma skeem, marsruudid, komponendid). Iga staatuseväide kannab märgist.

Staatusemärgised:

- **[MAIN]** — aktiivses `main`-is olemas (kontrollitud sellest aknast koodi vastu; `main` @ `80848212`, puhas, võrdne `origin/main`-iga);
- **[HARUL]** — teisel harul valmis, `main`-i ühendamata;
- **[KAVAS]** — kavandatud, tööplaan või otsus olemas, koodi ei ole;
- **[IDEE]** — kontseptsioon ilma koodi ja lukustatud otsuseta;
- **[AEGUNUD]** — ajalooline väide või tõlgendus, mis enam ei kehti;
- **[OTSUS?]** — ootab tooteomaniku otsust.

---

## 1. SotsiaalAI põhimudel (7 punkti)

1. **SotsiaalAI on ruumiline abi-, töö- ja koostöökeskkond sotsiaalvaldkonnale, mitte veebilehtede kogum.** Ruum, karussell, lõuendid, liigutatavad objektid ja liikumine moodustavad kasutajaliidese; „lehed" on ruumilised tööalad (ruumilise-kogemuse-lahtekoht.md). Kesksed katsealad on Kovisiooni ja Teemaseemnete täisekraani lõuendid **[MAIN]**.
2. **Platvorm on vabalt kasutatavate, üksteist täiendavate võimekuste võrgustik, mitte kohustuslik jada.** Muster: vajadus → kasutaja valitud funktsioon → iseseisev praktiline tulemus → soovi korral järgmise võimaluse soovitus → kasutaja kontrollitud üleandmine. Iga funktsioon peab andma väärtust ka eraldi kasutades.
3. **Üleandmise etalonmuster on läbiv:** lähteobjekt → kasutaja valitud väljavõte (shareKeys) → eelvaade → kinnitus → uus minimaalne sihtobjekt; algne privaatne sisu jääb lähtekohta alles. Rakendavad: Teekond→eelpöördumine, Tööheaolu väljundmustand, eelpöördumine→kovisioon, kõnesalvestuse nõusolek **[MAIN]**.
4. **Privaatne on vaikeseis; jagamine on nähtav, loendatav ja tagasivõetav.** „Minu jagamised" koondvaade (U12), saadetud pöördumise tagasivõtt enne avamist ja parandus pärast avamist (U3) on ehitatud **[MAIN]**. Usaldusmudeli siht on valdusriba igal tööobjektil (KES NÄEB / PÄRITOLU / KEHTIVUS) — see tervikuna on veel **[KAVAS]**.
5. **AI teeb ainult mustandeid; inimene kinnitab.** AI hüpotees ei muutu automaatselt ametlikuks kirjeks; vastused on allikapõhised (RAG + kontrollitud teadmusbaas); allikaveast saab teatada (U8 source-feedback **[MAIN]**). AI ei määra meetodit, ei tee riskiskoori ega otsusta teenuseõiguse üle (püsiv keeld).
6. **STAR2 jääb ametlikuks registriks; SotsiaalAI ei loo paralleelset kliendibaasi ega juhtumiplaani koopiat.** Platvorm toetab ainult ettevalmistust ja mustandeid (`STAR_HELPER` artefakt **[MAIN]**); ülekandmise elutsükkel (transferStatus, viitenumber) on **[KAVAS/OTSUS?]**.
7. **Kolm põhikasutajatüüpi + lisatiitlid/võimekused, mitte uued kasutajagrupid.** Õigused jõustatakse serveris (omanik/osaleja/roll), mitte UI peitmisega; IDOR-piirded on runtime-tõendatud (isegi admin ei möödu osalejapiiretest). Esimene päris „võimekuse" näide on parimate praktikate retsensent (`EffectivePracticeReviewAssignment` **[MAIN]**).

Läbiv hügieenikiht: püsiv sündmuse- ja teavituskiht (U1) + „Jätka siit" tööjärg (U2) on `main`-is ja produktsioonis **[MAIN]**; U1 valikulised e-kirjad on vaikimisi väljas (teadlik opt-in-otsus).

## 2. Kolm põhikasutajarolli ja tähtsamad vajadused

### Eluküsimusega pöörduja (CLIENT)

- saada selgust oma olukorras (vestlus allikatega, selge keel — U7 **[HARUL]**);
- hoida oma samme privaatselt koos (Teekond, rangelt PRIVATE);
- valmistada ette ja saata eelpöördumine, kontrollides täpselt, mida jagab; vajadusel võtta tagasi või parandada (U3 **[MAIN]**);
- leida teenus/kontakt (Teenusekaart + kättesaadavuse värskus U4 **[MAIN]**);
- esitada abisoov/abipakkumine ja jõuda sobitusruumi;
- mõista dokumente ja koostada neid (üleslaadimine, analüüs, mustandid);
- teha koostööd spetsialisti või teenuseosutajaga ühises ruumis; saada kohtumise kokkuvõte selges keeles (U10 **[MAIN]**);
- näha, mida ta on jaganud ja kellele (Minu jagamised U12 **[MAIN]**), ning saada teada, kui midagi juhtub (U1 **[MAIN]**).

### Sotsiaaltöö spetsialist (SOCIAL_WORKER)

- võtta vastu eelpöördumisi (vastuvõtutöövoog: märkmed, kontrollnimekiri, „järgmine kontakt" kuupäev U2 **[MAIN]**);
- alustada tööpäeva „Jätka siit" tööjärjega (U2 **[MAIN]**);
- valmistada kohtumist ette ja koostada STAR2 jaoks kontrollitud mustandeid ilma paralleelregistrita;
- kasutada Kovisiooni: Teemaseemned → juhtum → sessioon (etapid) → kokkuvõte → lõpetatud juhtumid → parimad praktikad **[MAIN, etappide ulatus ptk 6]**;
- kasutada privaatset Tööheaolu (10 tööriista; k-anonüümne koond juhtimisvaatesse);
- esitada materjale teadmusbaasi (ülevaatusega);
- leida teenuseid ja koostööpartnereid Teenusekaardilt;
- (tulevik) Meetodipeegel, Supervisioon, võrgustikutöö, Juhtumitöö assistent **[IDEE]**.

### Teenuseosutaja (SERVICE_PROVIDER)

- hallata teenuseprofiili (teenused, asukohad, kanalid) ja olla Teenusekaardil leitav;
- hoida kättesaadavuse signaali värskena (kolmeväärtuseline signaal + kinnituskuupäev + meeldetuletus, U4 **[MAIN]**);
- võtta vastu talle suunatud pöördumisi;
- osaleda kutse alusel vestlus-/koostööruumis; näha ainult talle jagatud infot;
- osaleda Kovisioonis (API lubab; loomis- vs osalusõiguse jaotus — `assertCovisionCreator` on koodis **[MAIN]**, täpne rollipoliitika vt ptk 7).

Lisaks: **ADMIN** on haldusõigus, mitte avalik persona (RAG-haldus, KOV-allikad, ülevaatused, koondid, source-feedback ja service-availability admin-vaated **[MAIN]**). KOV-juht, superviisor, ESTA liige jm on tulevased kontrollitavad lisatiitlid **[IDEE]**.

## 3. Platvormi põhimoodulite kaart

| Moodul | Marsruut/komponent | Seis |
|---|---|---|
| Vestlus + RAG (SSE, allikad, kriisituvastus, töövood) | `/vestlus`, `POST /api/chat` | **[MAIN]** töötab |
| Teekond | `/teekond`, `/api/journeys*` | **[MAIN]** töötab, rangelt privaatne; seosekirje eelpöördumisega (`sourceJourneyId`) skeemas |
| Eelpöördumine (3 algusviisi, privaatsuse eelkontroll, INTERNAL/EXTERNAL_EMAIL) | `/eelpoordumised`, `/api/pre-inquiries*` | **[MAIN]** töötab; + U3 recall/correction/openedAt; + `nextContactOn`; vaatajapõhine serializer (P1-1 suletud) |
| Pöördumiste vastuvõtt (märkmed, checklist, ruumi avamine) | sama leht, saaja roll | **[MAIN]** töötab |
| Abisoovid/abipakkumised + sobitus → tasuta ruum | vestluse töövoog + `/api/help/*` | **[MAIN]** töötab (HELP_MATCH_FREE) |
| Ruumid + kutsed + kõned + nõusolekupõhine salvestus | `/ruum`, `/room/[id]`, `/api/rooms/*`, `/api/invites/*` | **[MAIN]** töötab |
| Dokumendid (üleslaadimine, analüüs, transkriptsioon) | `/documents`, `/api/documents/*` | **[MAIN]** töötab |
| Dokumendi koostamine / artefaktid (11 tüüpi, sh STAR_HELPER, MEETING_SUMMARY) | `/dokreziim` | **[MAIN]** töötab |
| Kohtumise kokkuvõte pöördujale ruumi (U10) | artefakt → ruumisõnum | **[MAIN]** |
| **Kovisiooni perekond:** Teemaseemned (TopicSeed, omanik-only, jagamisjärjekord) → juhtum → sessioon (SessionState, StageSnapshot, WorkItem, PrivateState/OwnerPackage) → kokkuvõte → Lõpetatud juhtumid (Closure, FollowUp) → Parimad praktikad (retsensendid, review-scheduler, RAG-sünk) | `/teemaseemned`, `/kovisioon`, `/lopetatud-juhtumid`, `/parimad-praktikad`; `/api/topic-seeds*`, `/api/covision*`, `/api/effective-practices*` | **[MAIN]** andmestatud ja seotud; **kõik 8 sessioonietappi + atomaarne sulgemine on ehitatud ja runtime-tõendatud** (14.07 õhtu sihtkontroll, vt ptk 8) |
| Tööheaolu (10 töövoogu; väljundmustandid; k-anonüümne koond) | `/tooheaolu`, `/api/wellbeing/*` | **[MAIN]** töötab; ainult SOCIAL_WORKER |
| Materjalid (esitus → ülevaatus) | `/materjalid`, `/api/materials/*` | **[MAIN]** töötab; ülevaatus→ingest käsitsi |
| Teenuseprofiil + Teenusekaart (+ RAG-sünk, U4 kättesaadavus) | `/teenuseprofiil`, `/teenusekaart`, `/api/service-map/*` | **[MAIN]** töötab |
| STT/TTS (dikteerimine + ettelugemine) | `/api/stt`, `/api/tts` | **[MAIN]** töötab (kasutusarvestusega) |
| Süvauuring | `/api/research/jobs/*` | **[MAIN]** töötab |
| Minu jagamised (U12) | `/minu-jagamised`, `/api/my-sharings` | **[MAIN]** |
| Allika-tagasiside (U8-lite) | allikakaart → `/api/source-feedback` → admin | **[MAIN]** |
| Teavitused + „Jätka siit" (U1/U2) | `/api/notifications*`, `/api/workspace/continuity`, `POST /api/jobs/notifications` + 5-min timer | **[MAIN]**, produktsioonis; e-kirjad opt-in, vaikimisi väljas |
| Admin (RAG, KOV-allikad, analüütika, koondid, kinnitused) | `/admin/*` | **[MAIN]** töötab |

## 4. Peamised kasutajateekonnad moodulite vahel

1. **Pöörduja põhirada (serveris otsast lõpuni tõendatud):** Vestlus → Teekonna mustand → kasutaja kinnitusel salvestatud Teekond → shareKeys-eelvaatega eelpöördumise eeltäide → privaatsuse eelkontroll → saatmine (INTERNAL/e-post) → spetsialisti vastuvõtt (accept, märkmed, checklist, järgmine kontakt) → ühine ruum → kohtumine → kohtumise kokkuvõte ruumi (U10) → pöörduja „sain aru / mul on parandus". Tagasivõtt enne avamist, parandus pärast (U3). **[MAIN]**
2. **Kogukonnarada:** abisoov/abipakkumine (vestlustöövoog) → avaldamine → sobitusskoor → HelpMatch → automaatne tasuta ühine ruum. **[MAIN]**
3. **Teenuserada:** teenuseprofiil → avaldamine → Teenusekaart + RAG (assistendi soovitus) → pöörduja kontakt/pöördumine eeltäidetud adressaadiga; kättesaadavuse signaal ja värskuskinnitus (U4). **[MAIN]**
4. **Spetsialisti professionaalne rada:** Teemaseeme (privaatne) → jagamisjärjekord → kovisiooni juhtum (anonüümsuskontrolliga; ka eelpöördumisest — marsruut parandatud) → kõik 8 serveriväravatega sessioonietappi → atomaarne sulgemine → lõpetatud juhtum + järelvaade → parima praktika kandidaat → retsenseerimine (määratud retsensent, tähtajad, U1 teavitused) → PUBLISHED → RAG-i tööjärjekord. **[MAIN; runtime-tõendatud kuni võtmeta `skipped`-haruni, päris ingest võtmega keskkonnas kontrollimata]**
5. **Tööheaolu rangelt piiratud rada:** privaatne kirje → (soovi korral) kasutaja kinnitatud üldistatud väljundmustand (covision_input/supervisioni küsimus) → käsitsi kasutamine; vabatahtlik standardiseeritud osa → k-anonüümne koond (pilootvaatajad). Toorkirjed ei liigu kunagi edasi. **[MAIN]**; automaatne üleandmine Kovisiooni eeltäiteks **[OTSUS?/KAVAS]** (O7).
6. **Dokumendirada:** fail → analüüs → artefakt (sh STAR_HELPER mustand STAR2 jaoks; heli → transkript → koosoleku kokkuvõte) → allalaadimine või ruumi jagamine. **[MAIN]**
7. **Läbiv teavitusrada (U1/U2):** ärisündmus → NotificationEvent (fakt + viide, ilma sisuta) → badge'id + „Jätka siit" (kuni 7 kirjet, deterministlik järjestus) → opt-in e-kiri. **[MAIN]**

## 5. Privaatse, jagatud ja ametliku info piirid

**Privaatne (ainult omanik; server jõustab, isegi admin ei möödu):**
Teekond (JourneySharingStatus = ainult PRIVATE); Tööheaolu kirjed ja mustandid; vestlused ja dokumendid; Teemaseemned; kovisiooni privaatala (CovisionPrivateState, OwnerPackage) ja retsensendi märkus; kõik kinnitamata mustandid. Teavitus kannab ainult fakti ja viidet, mitte sisu; e-kiri on sisuvaba.

**Jagatud (konkreetne, eesmärgipõhine, loendatav):**
eelpöördumine (autor + adressaat; vaatajapõhine serializer — kumbki pool ei näe teise sisemist tööinfot ega konto-e-posti); ruumid (liikmed; päritolu origin-väljadega); kovisiooni juhtum (osalejad rollidega); avaldatud kuulutused ja teenusekirjed (avalikud); kohtumise kokkuvõte ruumis; „Minu jagamised" näitab tervikut + tagasivõtu/lahkumise toimingud.

**Anonüümne koond (k-summutusega, väikesed grupid peidetakse):**
Tööheaolu koond (WellbeingPilotScope/Viewer; eksplitsiitne vaatajate lubatud-nimekiri); sama muster on etalon tulevastele koonditele (U5 teenusepuudujääk, valdkondlik baromeeter **[IDEE/KAVAS]**).

**Ametlik:**
STAR2 on ametliku kliendiinfo, hindamise, juhtumiplaani ja otsuste ainus süsteem — väljaspool platvormi. SotsiaalAI hoiab ainult ettevalmistavaid mustandeid ja (tulevikus) käsitsi ülekandmise märget **[OTSUS?]**. Platvormil ei ole ametlikku menetlusolekut; eelpöördumise õiguslik staatus partner-KOV-iga on lukustamata **[OTSUS?]**.

**Rollide eriline piir:** organisatsiooni-/liikmesuskihti ei ole (teadlik otsus: mitte enne esimest pilooti); KOV-juhi koondvaade töötab lubatud-nimekirjaga; ESTA-l pole koodis ühtegi jälge.

## 6. Mis on aktiivne toode ja mis veel idee

### Aktiivses main-is ja produktsioonis (14.07.2026 õhtu)

- Kogu ptk 3 tabeli **[MAIN]** sisu, sh U-tööd: **U3, U4, U8-lite, U10, U12, U1, U2** (kõik `main`-is ja deploy'itud; U1/U2 Opuse heakskiiduga, U4/U8 kasutaja aktsepteeritud parandustega).
- **Kovisiooni suund on pärast 12.07 raporteid põhjalikult muutunud:** Teemaseemned on andmestatud (DEMO_SEEDS eemaldatud; TopicSeed + jagamisjärjekord + seemnest-juhtumiks rada); Kovisiooni lõuend on seotud päris andmekihiga (`CovisionWorkspace` → `/api/covision/[id]/session` + `actions`); uued mudelid katavad varem puudunud mõisted (etapiseis, osalejate valmisolek, tööobjektid, privaatpakk, sulgemine, järelvaade); Lõpetatud juhtumid ja Parimad praktikad on päris lehed; retsensendisüsteem + review-scheduler + tähtajateavitused töötavad. Karusselli alamkaardid viivad päris sihtidele. **14.07 õhtu sihtkontroll tõendas: kõik 8 sessioonietappi on serveripoolsete väravatega ehitatud ning etapi 8 lõpetamine teeb atomaarse sulgemise (closure + omanikupakk + järeltegevus + praktikakandidaat + seemne olekumuutus + detailandmete kustutus ühes tehingus)** — varasem memory-väide „etapid 1–4, etapp 5 järgmine" oli aegunud (vt ptk 8).
- Eelpöördumine→Kovisioon marsruut on ümber ehitatud (varasem alati-400 defekt R4 on kõrvaldatud; anonüümsuse sisend liigub kehast; loomisõigust kontrollib `assertCovisionCreator`).
- P1-eeltingimused suletud: vaatajapõhine `serializePreInquiry` (sh konto-e-postide leke suletud) ja tootmises fail-closed mailer.

### Teisel harul valmis (main-i ühendamata)

- **U6 isiklik otsing** — `opus/u6-personal-search` @ `ada42497`: omanik-skoobiga serveriotsing asendab eksitava külgriba-filtri; auditi P1-d suletud; `codex/u6-p1-rereview` kiitis parandused heaks. **[HARUL]**
- **U7 selge keele režiim** — `codex/u7-plain-language` @ `657d3c68`: ehitatud; `opus/u7-independent-audit`: OPUS HEAKS KIIDETUD, 3 P2. **[HARUL]**
- **Rollipõhine osalejakutse** — `codex/role-aware-invite-copy` @ `ead1d8d1` (14.07 21:21, värskeim töö): `lib/invites/participantTypes.js` — pöörduja saab kutsuda ainult professionaali (COLLEAGUE→spetsialist/teenuseosutaja); professionaal saab kutsuda pöörduja või professionaali; UI/tekstid/sponsoreeritud rollid rollipõhised. Auditeerimata. **[HARUL]** — see teostab uue tooteotsuse (vt allpool).

### Tooteotsusega ümber lükatud tõlgendus

- **[AEGUNUD]** Varasem U9 „tugiisiku kaasamise rada" (fable-5-avastamata-vajadused ptk U9; doc 13 §6.4) **ei ole enam õige tõlgendus.** Kehtiv otsus: osalejakutse on mõeldud (a) pöörduja ↔ spetsialist/teenuseosutaja koostööks ja (b) professionaalide omavaheliseks koostööks valitud ruumis. See EI ole kahe pöörduja ega mitteametliku tugiisiku vestlusrada. `role-aware-invite-copy` haru on selle otsusega kooskõlas (CLIENT ei saa kutsuda teist CLIENT-i). Dokumentides olev U9-kirjeldus tuleb edaspidi lugeda ajalooliseks.

### Kavandatud (otsus/plaan olemas, teostamata)


- U1 e-kirjade laiem sisselülitamine (enne soovitatud P2-1 ruumi-digesti aken ja P2-2 „läheneva tähtaja" dedupe-parandus) **[KAVAS]**;
- U5 teenusepuudujäägi märge ja koond (ootab k-läve ja nähtavuse otsust) **[KAVAS/OTSUS?]**;
- U11 töö üleandmine kolleegile (sõltub U1-st + ruumiligipääsu tooteotsusest; „kaks PATCH-i" hinnang oli vale — töö on suurem) **[KAVAS/OTSUS?]**;
- Häälvestluse režiim (STT→RAG→TTS sessioonikiht; muudatuskaart olemas, 3–6 päeva; O10 otsus ees) **[KAVAS]**;
- Kohtumise ühisvaade (null uut andmemudelit; rühm 2) **[KAVAS]**;
- STAR2 mustandi elutsükkel (transferStatus metadata-JSON-is; ootab ideed.md ptk 17 otsuseid) **[KAVAS/OTSUS?]**;
- Esimene päris piloot („eakas/hooldaja pöördub KOV-i"; 1 KOV, 2–4 töötajat, 10–30 pöördujat) ja ESTA tutvustuspäev — soovitusena kirjas, otsustamata **[OTSUS?]**.

### Idee (kontseptsioon, koodi ei ole)

Juhtumitöö assistent (JTA); Meetodipeegel; Supervisiooni moodul; võrgustikutöö moodul (kaart, DisclosureGrant, kokkulepped); ESTA kõik osad (liikmesus, foorum, piirkonnad, 1-euro mudel — 0 koodivastet, partnerlus kinnitamata); organisatsiooni-/meeskonnakiht (2 tabelit disainitud, 4 päästikut defineeritud); ametlik STAR2 API-liidestus; lokaalsed mudelid ja multimodaalsus (MediaPipe näpistus, Silero VAD, Whisper isemajutus, Tesseract OCR, väike käsuklassifikaator); kaamerarežiim; valdusriba täiskuju; „usalduse leht" avalik tekst; genogramm/ökokaart; KOV kuukoond ja valdkondlik baromeeter.

### Teadlikult mitte ehitada (püsiv nimekiri)

Broneerimis-/kalendrisüsteem; STAR2 menetluse peegel; üldine DM-süsteem; avalik pöördujate foorum; AI-triaaž/riskiskoor; teenuseosutaja CRM; vaikimisi automaatne transkriptsioon+AI-kokkuvõte kõnedes; töötajate edetabelid/seire; emotsioonituvastus; pilguga kinnitamine; äratussõna; speech-to-speech enne ahelaga häälvestlust.

### Ajaloolised/aegunud väited (mitte kasutada tooteseisu tõendina)

- 12.07 ülevaate ja max-täienduse väited „Kovisioon on UI-demo", „Teemaseemned kaotavad andmed", „Parimad praktikad kaart on näiline ühendus", „R4 alati-400", „serializer lekitab", „mailer fail-open", „badge-konks tootjata" — kõik on tänaseks lahendatud või asendunud **[AEGUNUD]**;
- vana U9 tugiisiku tõlgendus **[AEGUNUD]** (vt ülal);
- `docs/audits` kaust ja vanad raportid — ajalooline taust;
- `CovisionSession.jsx` (vana demolõuend) püsib repos, aga ükski komponent ei impordi seda — surnud-koodi kandidaat **[OTSUS?]**.

## 7. Vastuolud ja küsimused, mis vajavad kasutaja vastust

Tähtsuse järjekorras:

1. **Osalejakutse haru integratsioon.** `codex/role-aware-invite-copy` (@ `ead1d8d1`) teostab uue tooteotsuse (pöörduja kutsub ainult professionaali). Kas (a) tellida sõltumatu audit ja ühendada `main`-i; (b) enne täiendada? Küsimus ka: kas professionaal→pöörduja kutse (nt spetsialist kutsub oma kliendi ruumi) katab kõik soovitud koostöömustrid, sh professionaal↔professionaal valitud ruumis?
2. **U6 ja U7 merge.** Mõlemad on teisel harul valmis ja auditeeritud (U6: P1-d suletud + re-review heakskiit; U7: OPUS HEAKS KIIDETUD, 3 P2). Kas ühendada ja deploy'ida, ja millises järjekorras (haruesitused põhinevad main @ `66386421`/`80848212`, konfliktioht väike)?
3. **Kovisiooni järgmine tootesamm.** Kõik 8 etappi ja lõpetamise/praktika serverirada on valmis. Kas järgmine samm on kasutajapoolse tervikvoo ja ruumilise esituse täiendamine, päris piloot või KOV-P3-1 ADMIN-rolli ühtlustamise otsus?
4. **U1 e-kirjade sisselülitamine.** Kõik U1 valikulised e-kirjad on vaikimisi väljas. Kas parandada P2-1 ja P2-2 ning lülitada sisse — ja kellele (kõik kasutajad opt-in-lülitiga on juba olemas)?
5. **Tasuta tuuma piir (O12).** Koodist tuletatav piir (Teekond/eelpöördumised/Kovisiooni API tellimuseta; vestlus/dokumendid/Tööheaolu/kõned tellimusega) on endiselt kirjalikult fikseerimata. Kas kinnitada see teadliku tasuta paketina?
6. **STAR2 mustandi elutsükkel (O5) ja eelpöördumise õiguslik staatus (ideed 17 k1).** Need blokeerivad JTA suunda ja piloodi partner-KOV lepingut. Kas alustada nende otsuste ettevalmistust?
7. **Piloot ja ESTA päev.** Fable soovitus (üks KOV-osakond, pöörduja täisrada; ESTA poolepäevane tutvustus enne pilooti) ootab otsust. Kas see on lähikuu siht — see määraks, kas järgmised arendused valitakse piloodi-eelduste järgi (nt eelpöördumise 1536×864 paigutus, kriisiprotseduur KOV-iga)?
8. **Väiksemad koristusotsused:** kas kustutada surnud `CovisionSession.jsx`; kas `ConversationRun` pärandmudel eemaldada; kas O3 (teenuseosutaja Kovisioonis) on `assertCovisionCreator`-iga lõplikult otsustatud kujul, mida soovisid?

---

## 8. Sihtkontroll 14.07 õhtul: Teemaseeme → etapid 1–8 → sulgemine → Lõpetatud juhtum → praktika → avaldamine → RAG

Terve rada verifitseeriti aktiivse `main`-i vastu: staatiline kood + 265/265 sihttesti (`tests/topicSeeds`, `tests/covision`, `tests/effectivePractices`) + autenditud runtime-e2e lokaalse dev-serveri ja päris Postgresi vastu (temp-login-tokenid, kaks kontot; sünteetilised andmed kustutatud, roll taastatud).

**Runtime-tõendatud (otsast lõpuni):** seemne loomine → järjekorda panek (anonüümsuskinnitus kohustuslik; kinnituseta 400; idempotentne; külmutatud snapshot) → seemnest juhtum (atomaarne, CAS-fingerprint, kordus tagastab sama juhtumi) → kõik 8 etappi (faasisiirded ainult samm-sammult; **COMPLETE_STAGE väravad arvutatakse serveris andmebaasist, klienditõendeid ei usaldata**; versiooni-CAS + advisory lock igal actionil) → etapi 8 sulgemine ühes tehingus: `CovisionClosure` + järeltegevus + omanikupakk + praktikakandidaat (`practiceDecision=create_draft`) + seeme `FOLLOW_UP` + **detailandmete kustutus** (tööobjektid, privaatseisud, etappide 1–7 snapshotid, sõnumid, osapooled, sammud, kõned; juhtumi kirjeldusväljad tühjendatakse, pealkiri asendatakse üldistatuga — DB-tasandil kinnitatud) → sulgemisjärgne action 409 → järeltegevuse lõpetamine (`DECISION_PENDING`) → otsus „jätkan" (`CONTINUATION_PENDING` + uus jätkuseeme DRAFT + vana seeme CLOSED) → praktika: võimekuste GRANT (admin-only, tähtaja+alusega) → submit (3 määrangut) → 3 rolli heakskiit (REVIEWER/EDITOR/ETHICS → READY_TO_PUBLISH) → autor-publish 403 → teise kasutaja publish → PUBLISHED v1 + muutumatu versioonisnapshot + `nextReviewAt` → RAG võtmeta keskkonnas `syncStatus:skipped/rag_key_missing` (ohutu haru; deterministlik doc-id guard-jobis) → archive-after-publish 409. IDOR: mitteosaleja (ka ADMIN) sai juhtumile/sessioonile/võõrale seemnele/closure'ile läbivalt 404; loendid omaniku-skoobis.

**Leiud:**

1. **(Keskkond, lahendatud)** Lokaalne dev-DB oli 6 migratsiooni main-ist maas (U3, U8-lite, P1, U4, U1/U2, wellbeing_covision_handoff) — see põhjustas mh `GET /api/service-map/entries` 500. Rakendasin `prisma migrate deploy` (92/92, "up to date"); service-map nüüd 200. Reegel edaspidiseks: pärast main-i uuendust jooksuta lokaalis migratsioonid.
2. **(P3, väike ebasümmeetria)** ADMIN võib olla kovisiooni juhtumi omanik (`assertCovisionCreator` lubab ADMIN — lib/covisionSession.js:258–262) ja sulgemine loob talle praktikakandidaadi, kuid effective-practices autoriteed (getDetail/update/submit — lib/effectivePractices.js:1142, 1165, 1213, 1223) nõuavad rolli SOCIAL_WORKER|SERVICE_PROVIDER → ADMIN-autor saab omaenda kandidaadile 404 ega saa seda hallata. Mõjutab ainult admin-kontosid; tavakasutajail probleemi pole.
3. **(P3, väravadetail)** Kovisiooni-lehtede autentimisvärav on streaming-redirect: autentimata `GET /teemaseemned|/kovisioon|/lopetatud-juhtumid|/parimad-praktikad` → HTTP 200, mille kehas on NEXT_REDIRECT-marker + staatiline SSR-shell (nupunimed, 0-loendurid). Andmeid ei leki (kõik andme-API-d on 401; SSR ei sisalda kirjeid), kuid puhas 307 eeldaks sessioonikontrolli enne esimest flush'i.
4. **(Keskkonnapiirang, mitte koodileid)** Brauseripaanis selle rakenduse route-segmentide klient-hüdratsioon ei käivitu (nuppudel puuduvad React-handlerid, UI fetch'e ei toimu) — UI-kihi visuaalne kontroll jääb päris brauseri sessioonidele (varasemad 12.–14.07 kontrollid); käesolev kontroll kattis SSR-i, API-d ja andmekihi.
5. **(Märkus)** `review`-action nõuab alati `conflictStatus` välja (ka APPROVED puhul) — API-lepingu eripära, mitte viga.

*Selle kaardi koodiväited on kontrollitud `main` @ `80848212` vastu 14.07.2026 õhtul (git-seis, Prisma skeem, marsruudid, komponentide impordid; ptk 8 rada lisaks runtime-e2e-ga). Dokumentides kirjeldatud, kuid siin [AEGUNUD] märgitud väiteid ei tohi uues ideeringis kasutada aktiivse tooteseisu tõendina.*
