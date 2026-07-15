STATUS: COMPLETE

# Fable 5 — Tööheaolu tervikloogika ja jätkuteed

Kuupäev: 15.07.2026
Koostaja: Fable 5
Alus: aktiivne `main` (7ae76d5b) + Tööheaolu alusmaterjalid (`docs/platvormi arendus/tööheaolu/`) + ideed.md §2.11/§19/§20–21 + ruumilise-kogemuse-lahtekoht.md + orientatsioonikaart 14.07.
Kontrolliviis: kõigi 14 `components/wellbeing/` faili, `lib/wellbeing/*` teenuste, `app/api/wellbeing/*` marsruutide, `app/tooheaolu/*` lehtede, Prisma skeemi ja navigatsioonikihi (PanelFrame, WorkspacePanel, RoomStage) staatiline lugemine + autenditud runtime-kontroll päris Chrome'is (playwright-core + LoginTempToken; tulemused ptk 15).

---

## 0. Kokkuvõte — vastus põhiküsimusele

**Praegused Tööheaolu alalehed on kümme korralikult ehitatud, kuid omavahel nõrgalt seotud vormi, mitte üks arusaadav rakendus.** Iga üksik tööriist on sisemiselt loogiline (standardväljad → elav signaal → mallväljundid → privaatne salvestus → teadlik jagamisvoog) ja privaatsuskiht on serveripoolselt eeskujulik. Kuid tervik ei tööta kolmel põhjusel:

1. **Ring ei sulgu.** Kasutaja salvestab kirje — ja kirje kaob. Üksikkirjeid ei saa hiljem vaadata, muuta ega kustutada (API-s puudub lugemis-/kustutusrada, UI-s puudub loend). Ülevaade näitab ainult anonüümset koondmustrit. „Salvesta ja määra kontrollkuupäev", „muuda või kustuta sisestus" (ideed §19.5) ja järelkontroll puuduvad täielikult. Seega põhilubadus — *märkan → mõtestan → plaanin → tulen tagasi ja vaatan, kas muutus* — katkeb pärast esimest sammu.
2. **Soovitussüsteem räägib kahte keelt ja ainus automaatne jätkutee on de facto blokeeritud.** Sama nimega nupp teeb eri asju: tööriista soovitusnupp „Koosta kovisiooni sisend" (WellbeingActionList) viib otse `/kovisioon` lehele ilma sisendita; sama sõnastusega nupp sealsamas all (SupportRequestPanel) käivitab õige mustand→kinnitus→üleandmine voo. Ülevaate „Soovitatud järgmised töövood" kuvab toorvõtmeid (`recovery`, `work-processes`) ilma linkideta. Vaikeväärtused täidavad vormid enne kasutajat (Kiirkontroll avaneb signaaliga „Kollane" ja soovitab „vali üks järgmine samm", pakkumata ühtegi). Ja kõige teravam runtime-leid: **Kovisiooni üleandmine — komplekti ainus päris automaatne jätkutee — ebaõnnestub standardse genereeritud malliga alati**, sest anonüümsusdetektori „nime" regex loeb üle reavahetuse kaks suurtähelist sõna („…Kiirkontroll↵Olukorra…") nimeks (V17); kasutajale kuvatakse ainult üldine „tekstis võib olla tuvastajaid", ilma leitud kohta näitamata.
3. **Sisenemine ei aita olukorda ära tunda.** Avaleht on 10 ühesugust kaarti (karussellis lisaks sama ikooniga); olukorrakirjeldus on ainult aria-label'is, mitte nähtaval. ideed §19.3 kolme valiku struktuur (kontrollin üldist / mul on konkreetne olukord / vaatan varasemat) on dokumenteeritud, aga ehitamata.

**Soovitatud tervikmudel (ptk 8): üks privaatne tsükkel „Märkan → Mõtestan → Süvenen → Plaanin → Tulen tagasi → (erandina) Jagan"**, kus Kiirkontroll on uks, seitse teematööriista on ühe ühise 5-sammu rütmiga töötoad, iga salvestus saab vabatahtliku kontrollkuupäeva, „Minu kirjed" teeb ajaloo nähtavaks ja jagamine jääb praeguse kinnitusahela peale. See on saavutatav olemasoleva koodi ümberkorraldamisega (mitte ümberkirjutamisega): andmemudel juba talletab kõik vajaliku (recommendedActions, computedSignal, period), puudu on lugemiskiht ja ühtne voog.

---

## 1. Metoodikast tuletatud Tööheaolu invariandid

Tuletatud alusmaterjalidest (tööheaolu materjalid.md; üldine tööheaolu.md; ideed.md §19–21; ruumilise-kogemuse-lahtekoht.md §7.6). Iga invariandi juures seis aktiivses koodis.

| # | Invariant | Allikas | Seis main'is |
|---|---|---|---|
| I1 | Tööheaolu on töötaja privaatne töölaud; juht/kolleeg/organisatsioon ei näe individuaalseid vastuseid; server jõustab | ideed §19.1; §21.7 | **TÄIDETUD** — `visibility:"private"`, omanik-skoop kõigis päringutes, admin ei möödu |
| I2 | Jagamine on erand: eraldi üldistatud tekst, kasutaja vaatab üle ja kinnitab; midagi ei saadeta automaatselt | ideed §19.7 | **TÄIDETUD** väljundmustandites (review+confirm+trust badge; covision-handoff nõuab lisaks tuvastajate kinnitust ja `detectAnonymityIssues`) |
| I3 | Kaks kasutusviisi: perioodiline kiirkontroll + olukorrapõhine tööriist | ideed §19.2 | **OSALINE** — mõlemad olemas, aga avaleht ei erista; perioodilisuse tuge (meeldetuletus, rütm) pole |
| I4 | Kõigil töövoogudel sama rahulik loogika: Mis toimub? → Kuidas mõjutab? → Mida vajan? → Mis on järgmine samm? → Kas/millal tulen tagasi? | ideed §19.5 | **EI OLE** — igal tööriistal oma väljade jada ühe kerimisena; 5. küsimus („millal tagasi") puudub kõigil peale Recovery (`nextCheckpoint`) ja WorkBoundaries (`reviewTime`); needki väärtused salvestuvad kirjesse, aga midagi ei juhtu nendega |
| I5 | Lõpuvalikud: salvesta privaatselt / salvesta + kontrollkuupäev / muuda või kustuta / koosta jagatav mustand | ideed §19.5 | **OSALINE** — salvesta + jagatav mustand on; kontrollkuupäev, muutmine ja kustutamine PUUDUVAD (API-s pole GET/PATCH/DELETE kirjetele) |
| I6 | Ülevaade = kirjeldav muster, mitte diagnoos ega väärtustav üldskoor | ideed §19.4 | **OSALINE** — koondsignaal + top-tegurid on kirjeldavad; AGA perioodisignaal on „1 punane kirje = punane periood" (üksik halb päev domineerib) ja tööriistade sees on signaal skoorisumma künnistelt (nt Kiirkontroll ≥8 → kollane), mis vaikeväärtustega annab „Kollane" enne ühtegi vastust |
| I7 | Tööheaolu ei dubleeri klienditööd: käsitleb mõju töötajale; kliendi faktid kuuluvad STAR2-te | ideed §19.6 | **TÄIDETUD tekstides** (üldistatud kirjelduse juhised, neutraalsed mallid); vabatekstiväljad võimaldavad kliendiandmeid, aga kontroll (`detectAnonymityIssues`) rakendub ainult Kovisiooni-üleandmisel — privaatses kihis aktsepteeritav |
| I8 | Taastumine = psühholoogiline eemaldumine + taastumiskogemused (Sonnentag-Fritz; REQ 4 kogemust; recovery paradox; DRAMMA) | materjalid.md „Taastumine" | **EI OLE** — Taastumise tööriist on 24–72h ülesannete triaaž (vältimatu/edasilükatav/ümberjagatav). See on koormuse prioriseerimine, mitte taastumine; eemaldumise, lõõgastuse, meisterlikkuse, kontrolli dimensioone ei küsita üldse |
| I9 | Töövägivald: ohutus ennekõike (OSHA raamistik; SKA 92,6% kokkupuude) | materjalid.md „Töövägivald" | **OSALINE** — ohutustekst kuvatakse, KUI kasutaja märgib ohu kestvaks/ebakindlaks; aga vaikeväärtus on „Ei kesta" ja ohuküsimus on vormi sees, mitte esimene lävi. Kiirkontrollis turvalisuse küsimust pole, kuigi 92,6% statistika järgi peaks märkamiskiht seda katma |
| I10 | Katkestused ja Tööprotsessid on lähedased (jagavad allikaid), aga eri fookusega: killustatus+kokkulepe vs ajaröövlid+lihtsustus | materjalid.md | **OSALINE** — mõlemad olemas, fookused sõnastatud, aga sisuline kattuvus suur (mõlemas dokumenteerimine, kanalireeglid, fookusaeg; vt V8) |
| I11 | Rollipiirid: rolliselgus on ennetav; ootus/roll/vastutus tuleb lahutada | QIC-WD; Springer | **TÄIDETUD** — parim metoodiline teostus komplektis (ootuse allikas → mida oodatakse → minu roll → mis ei ole minu roll → kelle panus) |
| I12 | Alustaja tugi = struktureeritud KORDUV protsess (ASYE: mentor, vähendatud koormus, regulaarne refleksioon esimesel aastal) | materjalid.md „Alustaja tugi" | **OSALINE** — ühekordne plaan (nädal/kuu/100 päeva mallid) on; kordumine, järelkontroll ja plaani juurde naasmine puuduvad (sama juurprobleem mis I5) |
| I13 | Anonüümne koondkiht on rangelt eraldi; osalemine vabatahtlik; „jääb ainult mulle" vs „võib osaleda koondis" nähtavalt eristatud; k-kaitse | ideed §20 | **OSALINE** — pilot-koond on eraldi leht (`/tooheaolu/piloot`), nähtav ainult lubatud vaatajaile, min-grupp 3, summutamine toimib; AGA `aggregationEligible` on alati `true`, kasutajal pole valikut ega teadmist, et tema standardväljad koondisse lähevad (§20.6 rikutud) |
| I14 | Kasutaja andmekontroll: enda andmete muutmine, allalaadimine, kustutamine | ideed §19.8 | **PUUDUB** täielikult |
| I15 | Ükski tööriist ei esine valideeritud instrumendina (CBI/ProQOL/BAT/REQ on taustaallikad, mitte implementatsioon); ei diagnoosi | materjalid.md; ideed §19.4 | **TÄIDETUD** — ⓘ-tekstid ütlevad selgelt „ei ole diagnoos ega ametlik riskihindamine"; väljad on töökorralduslikud, mitte kliinilised |

---

## 2. Aktiivse rakenduse kaart

### 2.1. Sisenemisteed

1. **Ruumikarussell:** Töö → Töölaud-komplekt → kaart „Tööheaolu" → avaneb **Tööheaolu alamkarussell**, kus kõik 10 tööriista on lamedalt järjest, **kõigil sama ikoon** (`WellbeingIcon`), ainult pealkirjad + „Tagasi" kaart (`RoomStage.jsx:807–818`). Kaardid viivad otse `/tooheaolu/<slug>`.
2. **Töölaud-paneel** (`/vestlus?workspace=1`): kaart „Tööheaolu" → `activateDashboardCard` → täismarsruut `/tooheaolu` + sessionStorage'i sisenemismarker (WorkspacePanel → PanelFrame `cameFromWorkspace`).
3. **Otselink/järjehoidja:** `/tooheaolu` ja `/tooheaolu/<slug>` töötavad; serveripoolne värav: sessioon + roll SOCIAL_WORKER (või admin) + aktiivne tellimus, muidu redirect `/vestlus` või `/tellimus`.
4. **„Jätka siit" (U2):** kinnitamata väljundmustand tekitab jätkukirje — aga selle `href` on üldine `/tooheaolu` (workspaceContinuity.js:221), kus mustandit kuidagi ei kuvata (vt V6).

### 2.2. Avaleht `/tooheaolu`

- Pealkiri on ekraanilugeja-ainus (`sr-only`, tellija 07.07 otsus — nagu Töölaud); ⓘ tuleb PanelFrame'ist (id `wellbeing`, sisu `lib/dashboardInfoContent.js:257` — eesmärk, kasutaja kontroll, oluline piir; sisuliselt hea tekst).
- Sisu: `workspace-dashboard-grid`, 10 kaarti järjekorras kiirkontroll, ülevaade, raske juhtum, töövägivald, taastumine, tööpiirid, katkestused, tööprotsessid, rollipiirid, alustaja tugi. **Nähtav ainult pealkiri** (`<span>{tool.title}</span>`); kirjeldus on ainult `aria-label`'is. Grupeerimist, soovitust ega seisundit (nt „viimane kiirkontroll 3 päeva eest") ei ole.
- Privaatsuslubadust avalehel nähtavalt EI ole (see on ⓘ taga ja iga tööriista jaluses).

### 2.3. Tööriistalehe anatoomia (ühine muster kõigil kümnel)

```
SubpageHeader (← Tagasi + pealkiri + ⓘ)
Intro-lõik + ELAV SIGNAAL (arvutatakse igal muudatusel vaikeväärtustest alates)
[Ohutustekst — ainult hard-case/violence, kui oht märgitud]
Fieldset 1 „Olukord" (5 selecti)
Fieldset 2 „Koormus ja tugi / Kokkuleppe raam" (4–5 selecti + checkboxid)
[Vabatekstid / multi-valikud — tööriistati]
„Praktiline väljund" (2–6 malliteksti kaarti <pre>)
[Salvesta <tööriist>] + WellbeingActionList (soovitusnupud) | „ei ole soovitusi" tekst
role=status salvestusteade
Privaatsuslause
SupportRequestPanel („Soovin tuge küsida"): Jäta privaatseks | Koosta juhiga arutelu memo |
  Koosta kovisiooni sisend | Koosta abipalve | Ava Taastumine
  → eelvaade-textarea → Salvesta privaatne mustand → 2 kinnituslinnukest →
  Kinnita jagatav versioon → [ainult covision_input: tuvastajate linnuke → Loo Kovisioon ja ava]
```

Erandid: Overview'l pole SupportRequestPanelit (tal on oma juhimemo-mustandi plokk sama API peal); Recovery EI kuva WellbeingActionListi (kuigi lib arvutab soovitused ja need salvestuvad kirjesse!) — asemel kõva nupp „Ava tööpiirid".

### 2.4. Jätkuteede graaf (soovitusnupud tööriistast tööriista)

Iga tööriist soovitab tingimuslikult (lib `recommendedActions`) ja lisab peaaegu alati „Jälgi mustrit Ülevaates":

```
kiirkontroll ──► raske-juhtum | tooprotsessid | katkestused | taastumine |
                 toopiirid | rollipiirid | KOVISIOON(otse /kovisioon!)
raske-juhtum ──► taastumine | KOVISIOON(otse!) | rollipiirid | ulevaade
toovagivald ──► taastumine | KOVISIOON(otse!) | toopiirid | ulevaade
taastumine ──► [soovitusi EI kuvata; kõva nupp: toopiirid]   (lib arvutab: toopiirid|kovisioon|ulevaade)
toopiirid ──► taastumine | tooprotsessid | ulevaade
katkestused ──► toopiirid | tooprotsessid | taastumine | ulevaade
tooprotsessid ──► katkestused | toopiirid | rollipiirid | ulevaade
rollipiirid ──► toopiirid | tooprotsessid | katkestused | KOVISIOON(otse!) | ulevaade
alustaja-tugi ──► rollipiirid | tooprotsessid | toopiirid | KOVISIOON(otse!) | ulevaade
ulevaade ──► (toorvõtmete loend, EI OLE lingid)
```

Tähelepanekud:
- **Keegi ei soovita kunagi** `toovagivald` ega `alustaja-tugi` — need on ainult avalehe kaudu leitavad (töövägivalla puhul mõistetav — spetsiifiline sündmus —, aga Kiirkontroll ei küsi turvalisuse kohta üldse, seega märkamiskiht ei kata SKA 92,6% probleemi);
- „covision"-soovitus navigeerib **otse `/kovisioon` lehele** — sisendit kaasa ei lähe, kinnitusahel jääb vahele (vt V1);
- graaf on tihe, aga suunatu: puudub mõiste „mille juurest ma tulin ja kas eelmine samm sai valmis".

### 2.5. Andme- ja teenuskiht

- **`WellbeingRecord`** (schema:1241): omanik, workflowType, standardizedFields, computedSignal, load/resource/riskFactors, recommendedActions, `visibility:"private"`, `aggregationEligible@default(true)`. **Ainult CREATE** (`POST /api/wellbeing/<tool>`) ja koondlugemine Ülevaate kaudu; kirje-tasandi GET/PATCH/DELETE puudub.
- **`WellbeingOutputDraft`** (schema:1267): mustandi elutsükkel `draft → ready_to_share → in_covision`; CAS (`expectedUpdatedAt`), advisory-lock, idempotentne handoff. `sourceRecordId` on skeemis olemas, aga **UI ei saada seda kunagi** (kõik paneelid annavad `context`'ina elava vormi, mitte salvestatud kirje) → mustand ei viita kirjele.
- **Kovisiooni üleandmine** (`covisionHandoff.js`): omanik-only, atomaarne, idempotentne; kinnitatud tekst → privaatse Kovisiooni juhtumi 2. etapi privaatne eeltäide (`case_anchor`); jagatud ankrut ei mündita. Disainilt platvormi etalonmustri (lähteobjekt→väljavõte→eelvaade→kinnitus→uus minimaalne sihtobjekt) korrektne teostus — **aga praktikas blokeeritud detektori valepositiivi tõttu (V17)**.
- **Koondkiht**: `buildWellbeingOverviewForUser` (privaatne, kasutajapõhine) ja `aggregate.js` (piloot, min-grupp 3, summutamine, `/tooheaolu/piloot` ainult lubatud vaatajaile + admin). Kaks eraldi maailma — kooskõlas ideed §20 kihtidega 1 ja 3; kiht 2 (kinnitatud jagamine) elab output-drafts'is.
- **Teavituskiht:** U2 „Jätka siit" näeb kinnitamata mustandeid (aga link on tühi avaleht); „Minu jagamised" (U12) EI kata Tööheaolu üldse (mySharings.js — 0 vastet) — kinnitatud/üleantud mustand ei paista kusagil kasutaja jagamiste koondis.

---

## 3. Tööriistade tabel: eesmärk, sisend, väljund, järgmine samm

| Tööriist | Millal alustada (kasutaja vajadus) | Sisend (vorm) | Väljund (mallid) | Kuhu kasutaja PÄRAST salvestamist liigub | Dubleerib? |
|---|---|---|---|---|---|
| **Kiirkontroll** | perioodiline „kuidas mul läheb?" | 11 selecti (6 nõudmist, 5 ressurssi) + 3 riskilinnukest — KÕIK eeltäidetud keskväärtustega | koormustegurite/ressursside/riskide loend (mitte mallitekst) | ei kuhugi — „salvestati privaatselt" rida; soovitusnupud viivad süvatööriista (kaotades salvestamata konteksti seose) | — |
| **Ülevaade** | „mis mustrid mul korduvad?" | periood (Kõik/Nädal/Kuu) | signaalide loendus, top-tegurid, töövoogude arvud, koond-juhimemo | ei kuhugi; soovitatud töövood = toorvõtmed ilma linkideta | juhimemo dubleerib SupportRequestPaneli memo-voogu (eri tekstipõhi, sama outputType) |
| **Raske juhtum** | juhtum jäi emotsionaalselt koormama | 8 selecti + 2 linnukest + üldistatud kirjeldus (EELTÄIDETUD näitetekstiga!) + 24h vajaduste linnukesed | 24h järelplaan, neutraalne kokkuvõte, juhimemo, kovisiooni sisend | soovitusnupud (taastumine / OTSE /kovisioon / rollipiirid / ülevaade) | kovisiooni-sisendi mall dubleerib SupportRequestPaneli covision_input'i (eri tekst!) |
| **Töövägivald** | ähvardus/agressioon/jälitamine/oht | 9 selecti + linnuke + neutraalne kirjeldus (eeltäidetud) | neutraalne juhtumikirjeldus, turvalisuse kokkuleppe sisend, juhimemo, kovisiooni sisend, töökorralduse soovitus | sama muster | sama dubleerimine |
| **Taastumine** | kurnatus, vajan taastumisplaani | 5 selecti + koormustegurite linnukesed + 3 ülesannete-tekstivälja (eeltäidetud näidetega) | 24–72h taastumisplaan, juhimemo | kõva nupp „Ava tööpiirid"; arvutatud soovitusi EI kuvata | sisuliselt koormustriaaž — kattub Tööpiiride ja Tööprotsesside teemaga rohkem kui taastumisteadusega (I8) |
| **Tööpiirid** | tööväline kättesaadavus, pausid, asendus | 9 selecti + 3 vabateksti (mure/põhimõte/erandid, eeltäidetud) | kokkuleppe mustand, juhimemo, dokumendi-koostamise sisend | soovitusnupud | „dokumendi sisend" viitab Dokreziimile, aga linki pole |
| **Katkestused** | killustatud tööpäev | 9 selecti + allikate linnukesed + 1 linnuke | katkestuste kaart, fookusaja kokkulepe, kanalite kokkulepe, juhimemo | soovitusnupud | suur kattuvus Tööprotsessidega (V8) |
| **Tööprotsessid** | „mis võtab aja ära?" audit | 5 selecti + 6 multi-valikut (KÕIK EELVALITUD vaikekomplektiga!) | protsessikaart, top-3 ajaröövlit, lihtsustusettepanek, infoliikumise kokkuvõte, juhimemo | soovitusnupud | vt V8 |
| **Rollipiirid** | minult oodatakse rollivälist | 9 selecti + 2 linnukest | rollipiiride analüüs, kliendiselgitus, partneriselgitus, saan/ei-saa tekst, juhimemo | soovitusnupud | — (metoodiliselt tugevaim) |
| **Alustaja tugi** | uus töötaja / uus roll | 3 selecti + 3 linnukest + 5 multi-valikut (eelvalitud) | 1. nädala plaan, 1. kuu fookused, 100 päeva plaan, mentori küsimused, kovisiooni kontroll, tööpiiride mustand | soovitusnupud | tööpiiride mustand dubleerib Tööpiiride tööriista väljundit |

**Läbiv muster:** ühegi tööriista „järgmine samm" ei sõltu salvestamisest — soovitusnupud on nähtavad ja klikitavad ka ilma salvestamata; salvestamine ise ei vii kuhugi ega kinnita, kuhu kirje läks.

---

## 4. Dubleerimised, vastuolud ja katkised jätkuteed

**V1 — „Koosta kovisiooni sisend" tähendab kaht eri asja (kriitiline).** WellbeingActionListi soovitusnupp (nt raske juhtumi järel, label „Koosta kovisiooni sisend") navigeerib `actionRoutes.covision = "/kovisioon"` — otse Kovisiooni lehele, ilma sisendita, ilma kinnitusteta. Sama sõnastusega nupp SupportRequestPanelis sealsamas allpool teeb õige asja (mustand → kinnitused → tuvastajate kontroll → atomaarne üleandmine → `/kovisioon?case=<id>`). Kasutaja ei saa eristada; vale tee möödub kogu privaatsusahelast (midagi ei leki, aga kasutaja jõuab tühja Kovisiooni lehele ja tema ettevalmistus jääb maha).

**V2 — Juhimemo elab kolmes kohas.** (a) Iga tööriista „Praktiline väljund" kaart „Juhiga arutelu memo" (mall, ainult loetav); (b) SupportRequestPaneli `manager_memo` mustandivoog (teine mall, salvestub); (c) Ülevaate „Juhiga jagatav memo" (kolmas, koondmall + oma mustandiplokk sama API peal). Kolm eri teksti sama nime all; väljundkaardi malli EI saa otse mustandiks teha (kasutaja peab SupportRequestPanelis nullist sama asja uuesti genereerima).

**V3 — Ülevaate soovitused on toorvõtmed.** `OverviewWorkflow.jsx:321` renderdab `<li>{workflowType}</li>` — kasutaja näeb „recovery", „work-processes" (inglise keeles, tõlkimata, mitteklikitavad), kuigi `workflowLabels` sõnastik on samas failis olemas ja marsruudid teada. Ainus koht, kus kõik soovitused kokku jooksevad, on tupik. (Sama andmeväli kannab endas ka vastuolu: `recommendedActions` on kirjes talletatud, aga nende „tehtud/tegemata" olekut ei jälgita — järelkontrolli tuum puudub andmemudelist.)

**V4 — Vaikeväärtused genereerivad sisu enne kasutajat.** Kõigil kümnel vormil on täielik eeltäide: Kiirkontroll = kõik keskmised → avaneb signaaliga **„Kollane"** + „Vali üks konkreetne järgmine samm", kuid soovitusi 0 ja all tekst „Jätka praeguste kokkulepete hoidmist" (vastuoluline kolmik, kinnitatud kuvatõmmisega ja runtime'is); Raske juhtum avaneb `shouldNotCarryAlone=true, covisionNeed=true` + valmis kirjeldustekstiga; Tööprotsessid avaneb 13 eelvalitud markeriga („audit" on enne algust „leidnud" dubleerimise). Kasutaja, kes vajutab kohe „Salvesta", talletab süsteemi arvamuse, mitte enda oma — ja see läheb `aggregationEligible=true` kirjena ka koondstatistikasse.

**V5 — Salvestus on tupik ja duplitseeriv.** Iga „Salvesta" loob UUE kirje (runtime: kaks klikki = 2 kirjet, mõlemad „salvestati privaatselt"); mingit „see kirje on olemas, ava/muuda" olekut pole. Kirjete vaatamise UI puudub; ainus jälg on Ülevaate loendurid.

**V6 — „Jätka siit" viib tühjusse.** Kinnitamata mustand tekitab U2 jätkukirje `href:"/tooheaolu"` — avalehel pole ühtegi mustandite loendit ega viidet; `GET /api/wellbeing/output-drafts` on olemas, aga **ükski komponent ei kutsu seda**. Mustandid on UI vaatest kirjuta-ainult: hiljem ei saa neid avada, muuta, kustutada ega uuesti kinnitada.

**V7 — Abipalve rada katkeb poolel teel.** `support_request` (saaja `pilot_support_contact`) saab kinnitada — ja kõik. Kellele see läheb, kust see hiljem leitav on, mida „piloodi tugikontakt" tähendab — UI ei ütle; „Minu jagamised" seda ei näita (mySharings ei kata Tööheaolu üldse). Kinnitatud tekst tuleb kasutajal käsitsi kopeerida enne lehelt lahkumist, muidu on see kadunud.

**V8 — Katkestused ↔ Tööprotsessid kattuvus.** Mõlemad küsivad dokumenteerimissüsteemi katkestusi, kanaleid, fookusaega/lihtsustust; Katkestuste `neededAgreement:"process_change"` viitab otse teise tööriista teemale ja vastupidi (`simplificationNeeds`). Materjalid ütlevad ausalt, et need kaks paani jagavad allikaid. Praegu peab kasutaja ise teadma, kumb on „tema" vorm; vale valik annab peaaegu sama tulemuse teiste mallidega.

**V9 — Signaalisõnavara on tööriistati eri.** green/yellow/red; no_immediate_danger/needs_attention/urgent_attention; manageable/prioritize/organizational_support; clear/needs_clarification/needs_agreement; jne — kokku 6 eri kolmikut. Ülevaade normaliseerib need liiklusvärvideks, aga kasutaja jaoks ei ole „Vajab prioriseerimist" (Taastumine) ja „Kollane" (Kiirkontroll) ilmselgelt sama tasand. Ühtset legendi kusagil pole.

**V10 — Nupusõnastik on kirev.** „Salvesta kiirkontroll / 24h järelplaan / töövägivalla järeltegevus / taastumisplaan / tööpiiride kokkulepe / katkestuste kokkulepe / tööprotsessi audit / rollipiiride selgitus / alustaja töötoe plaan" — 9 eri objektinime sama tegevuse kohta (privaatne kirje). „Koosta" tähendab mustandi genereerimist (SupportRequestPanel), aga soovitusnuppudel ka pelgalt navigeerimist („Koosta taastumise plaan" → avab lehe). „Ava Taastumine" on jagamisvalikute rühmas neljas nupp, kuigi see ei jaga midagi — kategooriaviga paneelis „Soovin tuge küsida".

**V11 — Recovery peidab omaenda soovitused.** Lib arvutab (toopiirid/kovisioon/ülevaade) ja need salvestuvad kirjesse (mõjutades Ülevaate soovituste loendit), aga komponent ei renderda WellbeingActionListi — kasutaja näeb ainult kõva „Ava tööpiirid" nuppu. Andmed ja UI räägivad eri juttu.

**V12 — Tiitli ja ⓘ dubleerimine tööriistalehel.** SubpageHeader kuvab „Kiirkontroll" ja kohe all sisu-h2 „Kiirkontroll" (kuvatõmmisega kinnitatud). Väike, aga annab „kokku kleebitud" mulje.

**V13 — Avalehe kaardid ei kanna nähtavat kirjeldust.** Kirjeldus on ainult aria-label'is; ideed §19.3 nõuab nime kõrvale lühikest olukorrakirjeldust nähtavalt. Karussellis lisaks kõigil sama ikoon → 10 eristamatut klaasikaarti.

**V14 — aggregationEligible ilma kasutaja teadmiseta.** Iga kirje on koondikõlblik (`@default(true)`, UI-lülitit ega mainimist pole). Ekspositsioon on piiratud (koond ainult lubatud pilootvaatajaile, min-grupp 3), aga ideed §20.6 lubadus („töötaja valib, kas tema standardiseeritud kirjed osalevad") on täitmata ja privaatsuslubadus („ainult sina näed") on koondi võrra ebatäpne.

**V15 — Nähtavat tagasi-teed EI OLE (runtime-tõendatud).** „Tagasi" nupp on DOM-is olemas (nii tööriistalehel kui avalehel), aga **visuaalselt peidetud** — Playwright: `boundingBox: null`, klikk keeldub „Element is not visible" (1600×900, autenditud Chrome); ka kasutaja enda kuvatõmmistel pole noolt näha. Koodis olev tagasi-loogika (tööriist → `/tooheaolu`; avaleht → Töölaud/`router.back()`) on hiirekasutajale kättesaamatu. Ainus nähtav väljapääs on X („Sulge ja naase ruumi"), mis tööriistalehel viib runtime-tõendatult **ruumi peavalikusse `/`** — mitte Tööheaolu avalehele ega Töölauda (sisenemismarker salvestatakse teele `/tooheaolu`, alamleht ei klapi; `cameFromWorkspace` võrdleb täpset teed). Tulemus: kasutaja, kes on kolm taset sügaval (Töölaud → Tööheaolu → Kiirkontroll), saab ühe klõpsuga liikuda ainult kõige algusesse.

**V16 — Olek ei ole URL-is.** Vormi seis, valitud jagamisvalik ja kinnituste faas elavad ainult React-olekus: refresh, brauseri tagasi või soovitusnupu klikk kaotab kõik (runtime C3–C5: soovituse klikk viis `/tooheaolu/raske-juhtum`, brauseri tagasi taastas Kiirkontrolli **vaikeseisus** — kasutaja tehtud valikud ja soovitusnupud kadunud). Sama juurviga, mis Teekonna/eelpöördumise analüüsis (15.07) — siin ilma kerimisblokita, aga sama „üks vale klikk nullib töö" tagajärg.

**V17 — Kovisiooni üleandmise õnnetee on standardmalliga blokeeritud (runtime + üksuse tasand tõendatud, kriitiline).** ➜ **SEIS 15.07.2026: PARANDATUD harus `fable/tooheaolu-e0` @ fe8c7df2 (E0 pakett: regex + lekketa tüübivihjed + salvestuse idempotentsus; täissviit 1238/1238, runtime-tõendus pordil 3001) — ootab sõltumatut järelkontrolli ja merge'i; main-is viga veel kehtib.** Serveri anonüümsusdetektori „nime" reegel `/\b[Suurtäht][väiketähed]{2,}\s+[Suurtäht][väiketähed]{2,}\b/` (lib/covisionShared.js:34) kasutab `\s+`, mis haarab ka **reavahetuse** — genereeritud malli read „Teema: Kiirkontroll" + „Olukorra üldistatud kirjeldus: …" annavad vaste „Kiirkontroll Olukorra" → `identifiers_detected` → handoff 400. Kõigi töövoogude mallid algavad „Teema: <Suurtäheline pealkiri>" + järgmine rida „Olukorra…", seega **muutmata (ja enamik kergelt muudetud) malle kukub alati läbi**. API tagastab ainult veakoodi (`wellbeing.errors.identifiers_detected`) ilma detektori leitud lõigu ja soovituseta (mis on serveris olemas: snippet + suggestion), nii et paneel saab näidata vaid „Tekstis võib olla otseseid tuvastajaid. Eemalda või üldista…" — kasutaja on pimedas tsüklis: muudab teksti (kinnitused nullitakse), kinnitab uuesti, saab sama vea. Tõendus: API-jada create(201) → confirm(200, ready_to_share) → handoff(400 identifiers_detected); `detectAnonymityIssues` üksuskutse tagastab `type:"name", snippet:"…Kiirkontroll Olukorra üldistatud…"`. Parandusvariandid (järgmisse teostuspaketti): (a) regexis `\s+` → `[^\S\n]+` (nimi ei ulatu üle rea); (b) handoff-vastusesse detektori `issues` massiiv + paneelis kuvamine; (c) regressioonitest „iga töövoo standardmall läbib handoff-värava".

---

## 5. Kasutaja kognitiivne koormus ja navigeerimine

**Sisenemisel:** valik 10 võrdse kaardi vahel ilma olukorrakirjelduseta (nähtavalt) või grupeerimiseta. ideed §19.2 tabel („Olukord → Sobiv tööriist") on olemas dokumendis, aga mitte tootes. Karussellis on kaardid lisaks ühesuguse ikooniga. Esmakasutaja peab avama ⓘ või proovima järjest.

**Tööriistas:** 10–14 sisendit ühe pika kerimisena (kuvatõmmis: üks select-riba ekraani laiuselt üksteise all), elav signaal ülal arvutab iga muudatusega. Mõtteline järjekord (mis toimub → kuidas mõjutab → mida vajan → mis edasi) on väljade paigutuses aimatav, aga vormistamata: pole samme, pole progressi, pole „nüüd oled valmis" hetke. Väljundkaardid dubleerivad vormi sisu mallitekstina — kasutaja loeb sama info kaks korda; mallid muutuvad iga klõpsuga, mis vähendab „minu tehtud otsuse" tunnet.

**Signaal enne vastuseid:** kuna signaal arvutatakse vaikeväärtustest, algab iga tööriist väitega kasutaja olukorra kohta. Skoorikaartide järgi avanevad **kõik 9 vormitööriista mitte-rohelises signaalis** (Kiirkontroll 11p → „Kollane"; Raske juhtum 9p → „Vajab tähelepanu"; …), neist **Tööprotsessid (8p) ja Rollipiirid (≥7p) koguni punase taseme signaalis** („Vajab töökorralduslikku muutust", „Vajab võrgustiku arutelu") — enne, kui kasutaja on ainsatki valikut teinud. See pöörab metoodika pea peale: tööriist peaks peegeldama kasutaja vastuseid, mitte esitama seisukohta, mida kasutaja hakkab parandama.

**Väljumisel:** salvestusteade on ainus tagasiside; edasi-tee on soovitusnuppude rida, mille klikk kaotab praeguse lehe oleku (V16). „Kus ma tervikus olen" vastust ei anta kusagil: pole leivapuru, pole „sinu viimased kirjed", pole seost eelmise sammuga (nt „tulid kiirkontrollist, kus märkisid kõrge emotsionaalse koormuse").

**Terminite koormus:** salvesta/koosta/kinnita/ava segunevad (V10); „mustand", „jagatav versioon", „sisend" ja „memo" on neli sõna kolme asja kohta.

---

## 6. Privaatsus ja jagamise nähtavus

**Tugevused (säilitada muutmata kujul):**
- serveripoolne omanik-skoop kõigil andmeteedel; `visibility:"private"` vaikimisi; roll+tellimuse värav;
- kahe linnukesega kinnitusahel + ContentTrustBadge (genereeritud vs muudetud vs kinnitatud) + CAS-konfliktikäsitlus (409 → arusaadav teade);
- Kovisiooni üleandmine: kolmas linnuke (i18n-tekst: „…ei sisalda nime, isikukoodi, täpset aadressi ega muud otsest tuvastajat"), serveripoolne `detectAnonymityIssues`, atomaarsus, idempotentsus, algne kirje jääb alles; **disainilt on see platvormi üleandmis-etalonmustri korrektne teostus ja peaks olema kogu Tööheaolu jagamise ainuke muster** (teostuse defekt V17 tuleb enne parandada);
- pilootkoond: eraldi leht, lubatud vaatajad, min-grupp 3, summutamine, CSV/XLSX eksport ainult koondist;
- ⓘ-tekstid ütlevad õiged asjad õiges toonis (privaatsus, mitte-diagnoos, kriisipiir).

**Nõrkused:**
- privaatsuslubadus ei ole seal, kus kasutaja alustab (avalehel nähtamatu; tööriistas jaluses, allpool salvestusnuppu) — ideed §19.1 nõuab nähtavat selgitust enne alustamist;
- `aggregationEligible` vaikimisi-true ilma valiku ja mainimiseta (V14) — „Sinu isiklikke vastuseid ei näe juht" on tõsi, aga „sinu standardväljad lähevad k-anonüümsesse koondi" jääb ütlemata;
- kinnitatud mustandite hilisem nähtavus on null: ei „Minu jagamised", ei mustandite loendit, ei Kovisiooni-üleandmise ajalugu („see kirje viidi Kovisiooni 12.07") — kasutaja ei saa hiljem kontrollida, mida ta on välja andnud (kuigi DB seda teab: status, covisionCaseId, handedOffAt);
- kustutamisõigus puudub (I14) — privaatse refleksiooni tööriistas eriti oluline;
- abipalve adressaat on määratlemata mõiste (V7).

---

## 7. Metoodiline terviklikkus: mida tööriistad alusmaterjalidega võrreldes teevad õigesti ja valesti

**Kategoriseering (ülesande §5 eristused):**
- *Põhjendatud eneserefleksioon:* Kiirkontroll (nõudmised-ressursid raam on JD-R-i kooskõlas; Toros/TAI teemad — koormus, otsustusvabadus, dokumenteerimine — on väljadena olemas), Rollipiirid (parim), Raske juhtumi koormuse-osa (eetiline pinge / moraalne stress / traumaga kokkupuude eristus on ProQOL/STS kirjandusega kooskõlas).
- *Töökorralduslik probleem:* Tööpiirid, Katkestused, Tööprotsessid, Ülevaade — õigesti raamistatud organisatsiooni, mitte indiviidi veana (TAI juhtmõte).
- *Taastumisvajadus:* Taastumine on praegu VALES kategoorias — sisult töökorralduslik triaaž, mitte taastumine (I8). Recovery-teaduse tuum (eemaldumine!) puudub kogu komplektist.
- *Eetiline/professionaalne refleksioon:* Raske juhtumi eetilise pinge väljad + Rollipiiride eetiline keerukus — olemas, piisav; süvem eetikarefleksioon kuulub Kovisiooni/Supervisiooni (õige piir).
- *Töövägivald/ohutus:* olemas, aga ohutusküsimus pole esimene lävi (I9) ja märkamiskihis (Kiirkontroll) puudub üldse.
- *Kliendijuhtumi andmed:* kõik mallid suunavad üldistamisele; kõva kontroll ainult Kovisiooni-üleandmisel — piisav, sest mujale tekst automaatselt ei liigu.

**Konkreetsed metoodilised vead (ülesande §5 loend):**
1. *Põhjendamatu järeldus alusmaterjalist:* Kiirkontrolli summaarne skoor (boolean=2p, kõik väljad võrdse kaaluga, künnised 8/18) ei tugine ühelegi viidatud instrumendile — see on leiutatud heuristika, mis esitab end signaalina. Aktsepteeritav ainult siis, kui vaikeseis on neutraalne ja kasutajale öeldakse, et tegu on markerite loendamise, mitte mõõtmisega.
2. *Keeruka olukorra lihtsustamine skooriks:* perioodisignaal „üks punane = punane periood" (overview.js:139); „insufficient_data" künnist peale ≥1 kirje pole. Kalibratsioon on ühtlasi viltu mõlemas suunas: keskmised vaikeväärtused annavad „tasuta" 11 punkti (kollane künnisel 8), aga punane (≥18 või kriitiline+taastumiseta kombo) on peaaegu kättesaamatu — runtime-katses jäi ka „emotsionaalne koormus kõrge + taastumine puudub + raske juhtumi marker" profiil (16p) kollaseks. Tulemus: signaal on praktiliselt alati kollane ehk ei ütle midagi.
3. *Liiga automaatne soovitus:* eeltäidetud `covisionNeed=true` (Raske juhtum) tähendab, et „vajad kovisiooni" on vaikimisi väide; soovitusnupud ilmuvad enne, kui kasutaja on midagi kinnitanud.
4. *Juhuslik järgmine tööriist:* actionPriority järjekord (hard-case > work-processes > interruptions > recovery > ...) on kõva massiiv — st kui kasutajal on 4 tegurit, määrab nuppude järjekorra kood, mitte vastuste raskus; Ülevaate toorvõtmete loend on sama probleemi hullem vorm.
5. *Töötaja heaolu vs kliendijuhtum:* piir on hoitud (I7) — see on komplekti tugevaim metoodiline omadus.

---

## 8. Soovitatud Tööheaolu tervikmudel

### 8.1. Põhitsükkel (üks mudel, kuus seisundit)

```
        ┌────────────── MÄRKAN ──────────────┐
        │  Kiirkontroll (3+N adaptiivset küsimust) │
        └──────────────┬─────────────────────┘
                       ▼
        MÕTESTAN — tulemuse leht (mitte vormi jalus):
        minu vastustest tulenev pilt + 0–3 soovitust põhjendusega
        + „salvesta & määra kontrollpunkt" + „ava sobiv töötuba"
                       ▼
        SÜVENEN — 7 teematöötuba ühise 5-sammu rütmiga
        (Mis toimub? → Kuidas mõjutab? → Mida vajan? →
         Mis on järgmine samm? → Millal vaatan üle?)
                       ▼
        PLAANIN — iga töötuba lõpeb SAMMUDE (mitte mallide) valikuga;
        sammud + kontrollkuupäev = „Minu plaan" kirje
                       ▼
        TULEN TAGASI — Minu kirjed / kontrollpunkti meeldetuletus →
        ava kirje → „kas pidas?" (jah/osaliselt/ei) → muster Ülevaates
                       ▼
        (erand) JAGAN — praegune mustand→kinnitus→üleandmine ahel,
        nüüd kirjega seotud (sourceRecordId) ja hiljem leitav
```

Kõik kuus seisundit on juba andmemudelis esindatavad (recommendedActions, period, nextCheckpoint/reviewTime väljad standardizedFields'is, output-draft staatused) — puudu on lugemiskiht, kirje-detailvaade ja kontrollpunkti mehaanika.

### 8.2. Rollijaotus (mis-on-mis, et dubleerimine kaoks)

- **Kiirkontroll** = ainuke sisenemis-mõõdik. Lisada 1 turvalisuse küsimus („Kas viimasel perioodil on olnud ähvardavat või vägivaldset olukorda?" → jah avab Töövägivalla soovituse) — katab I9 märkamiskihis.
- **Ülevaade → „Minu muster ja kirjed"** = peegel + arhiiv: mustrid (praegune koond) + kirjete kronoloogia (avatav, muudetav, kustutatav) + avatud kontrollpunktid + jagamiste ajalugu. Juhimemo-plokk kolib siit ära (jagamine on üks, mitte kaks kohta).
- **7 töötuba**: Raske juhtum; Töövägivald; Taastumine (ümber ehitatud: eemaldumine+taastumiskogemused; 24-72h triaaž jääb alamplokiks); Tööpiirid; Töökorraldus (= Katkestused + Tööprotsessid ÜHENDATUNA, kahe sisenemisfookusega); Rollipiirid; Alustaja tugi (korduva kontrollpunktiga plaan).
- **Jagamine** = üks paneel (praegune SupportRequestPanel) + üks väljundtüüpide loend (memo / kovisiooni sisend / supervisiooni küsimus / abipalve-määratletud-adressaadiga / kopeeri-laadi-alla). „Ava Taastumine" kaob jagamisvalikute seast (see on soovitus, mitte jagamine).
- **Soovitusnupud** = alati sama komponent, alati sama tähendus („avab töötoa"), MITTE kunagi otse `/kovisioon`; kovisiooni-soovitus avab jagamispaneeli covision_input eelvalikuga.

### 8.3. Vormifaktori hinnang (lehed / töölaud / flight / hübriid / „nupu-lahtrijada teisiti")

1. **Tavalised järjestikused lehed (praegune):** töötab, odav, aga pikk vorm ühe kerimisena on selle mudeli halvim esitus — kõik korraga, signaal enne vastuseid, tulemus vormi jaluses.
2. **Üks privaatne töölaud + vahetuvad lõuendid:** sobib „Minu muster ja kirjed" keskvaatele (kirjed, plaanid, kontrollpunktid ühel pinnal); EI sobi küsimisvooks — Tööheaolu põhitegevus on üks juhitud mõttekäik korraga, mitte mitme objekti paralleelne paigutamine. Lõuend lisaks kognitiivset koormust just seal, kus vaja on rahu.
3. **Flight-rada (sisupinnad sügavuses):** sobib HÄSTI 5-sammu töötoavoole — üks küsimusteplokk korraga on täpselt flight-sisuteekonna kasutusjuht (ruumilise-kogemuse-lahtekoht §4.3: „sisend → analüüs → otsus → tulemus"). Kohustuslikud piirid kehtivad täies mahus: iga samm otselingiga/ankruga, brauseri tagasi-edasi töötab, reduced-motion = sama sisu lame järjestus, kinnitus-checkboxid ja ohutustekstid EI tohi olla animatsiooni taga; Töövägivalla ohutuslävi peab olema nähtav enne esimest „lendu". Flight EI sobi avalehele (kiire äratundmine + otsevalik) ega jagamispaneelile (õiguslik kinnitus = rahulik staatiline vorm).
4. **Hübriid (SOOVITUS):** avaleht = rahulik ruumivaade 3 valikuga; töötuba = 3–5 sammuline juhitud voog (teostus kas flight'ina VÕI lihtsa sammuvahetusega — otsustada prototüübiga, mitte efekti pärast; sisujaotus on mõlemal sama); Minu muster = üks vaade (tavaline leht või kerge lõuend); jagamine = staatiline kinnituspaneel. See vastab ka ruumilise-kogemuse-lahtekoht §12 loetelule, kus Tööheaolu on nimetatud prototüübikandidaat („küsimustikust saab olukorrast lähtuv privaatne refleksiooniruum").
5. **„Nupu- ja lahtrijada teisiti" (kasutaja lisaküsimus):** jah, ja sõltumata vormifaktorist:
   - **asenda 3–4-valikulised dropdownid nähtavate segmentnuppudega** (üks rida = üks klikk; dropdown nõuab 2 klikki + varjab valikud; 10 dropdowni järjest on praeguse UI suurim hõõrdumine — kuvatõmmis kinnitab);
   - **neutraalne algseis**: ükski väli pole eelvalitud; signaal ja väljundid ilmuvad alles pärast miinimumvastuseid (nt 3 esimest); „Salvesta" on keelatud kuni miinimumini;
   - **adaptiivne pikkus**: alusta 3 tuumaküsimusega (koormus / taastumine / tugi + turvalisuse marker); lisaplokid („dokumenteerimine", „katkestused", „rollid") avanevad ainult, kui tuumvastus sinna osutab — Kiirkontroll lüheneb enamikul kordadel 3–5 vastuseni;
   - **tulemus eraldi sammuna**, mitte vormiga samal ekraanil võistlemas;
   - **mallitekstide asemel sammud**: väljundkaartide sisu muutub „Minu plaani" punktideks, mida saab linnutada; täistekst (memo jne) tekib alles jagamispaneelis.

---

## 9. Soovitatud avalehe ja alalehtede hierarhia

```
/tooheaolu — AVALEHT
├─ Privaatsusriba (1 lause + ⓘ): „See ruum on ainult sinu oma. Jagamine
│  tekib ainult sinu koostatud ja kinnitatud tekstina."
├─ [1] KONTROLLIN ÜLDIST — Kiirkontroll (CTA + „viimati: 3 päeva eest, roheline")
├─ [2] MUL ON KONKREETNE OLUKORD — 7 töötuba, 4 rühmas, igal 1 olukorralause
│      (laused on ideed §19.2 tabelis valmis):
│      • Juhtum ja turvalisus: Raske juhtum · Töövägivald
│      • Koormus ja taastumine: Taastumine · Tööpiirid
│      • Töökorraldus: Töökorraldus ja ajaröövlid (=Katkestused+Tööprotsessid)
│      • Roll ja areng: Rollipiirid · Alustaja tugi
├─ [3] VAATAN OMA VARASEMAT — Minu muster ja kirjed
│      (+ avatud kontrollpunktid badge; + pooleliolevad jagamismustandid)
└─ (ainult lubatud vaatajaile: link KOV piloodi koondvaatele — selgelt eristatud
   „see on anonüümne koond, mitte sinu andmed")

/tooheaolu/kiirkontroll — 2–3 sammu (tuum → [laiendused] → tulemus+valikud)
/tooheaolu/<töötuba>   — 3–5 sammu ühise rütmiga; viimane samm = plaan+kontrollpunkt
/tooheaolu/minu        — kirjed (avatav detail: vastused, plaan, „kas pidas?",
                          muuda/kustuta), mustrid (praegune Ülevaade), jagamised
/tooheaolu/piloot      — muutmata (eraldi kiht)
```

Alamlehe sees: leivapuru „Tööheaolu → Töötuba → samm 2/4"; nool ← = samm tagasi (mitte lehelt välja); „Katkesta" = selgelt eraldi, hoiatusega kui vastused kaovad; X (PanelFrame) = tagasi sinna, kust sisenesid (Töölaud VÕI ruum — marker peab katma ka alamlehed, vt V15).

---

## 10. Kasutajateekonnad (tekstilised, 5 lähteolukorda)

**T1 — Perioodiline enesekontroll (roheline).** Reede pärastlõuna. Mari avab Töölaualt Tööheaolu → „Kontrollin üldist" (näeb: „viimati 2 nädalat tagasi, kollane"). Kolm tuumaküsimust: koormus mõõdukas, taastumine piisav, tugi olemas; turvalisuse marker: ei. Tulemus: roheline; võrdlus: „eelmisel korral märkisid vähese taastumise — nüüd piisav." Salvestab, kontrollpunkti ei määra. Kirje ilmub „Minu kirjed" kronoloogiasse. Kogu teekond < 2 minutit, 0 jagamist.

**T2 — Raske juhtum õhtul.** Peeter lõpetas raske kodukülastuse. Avaleht → „Juhtum ja turvalisus" → Raske juhtum (olukorralause aitas ära tunda). Samm 1: mis juhtus (tüüp, ohutuse kontroll — vahetut ohtu pole); samm 2: mis jäi koormama (eetiline pinge kõrge, ei peaks üksi kandma — TEMA linnutab, mitte vaikeväärtus); samm 3: 24h vajadused (juhiga järelkontakt, faktid kirja); samm 4: plaan — 3 sammu + kontrollpunkt „homme õhtul". Salvestab. Soovitus põhjendusega: „Märkisid, et ei peaks üksi kandma → koosta kovisiooni sisend" → avab jagamispaneeli (mitte /kovisioon lehte), genereerib, üldistab, kinnitab 3 linnukest, „Loo Kovisioon ja ava" → maandub Kovisiooni juhtumis, kus tema tekst on 2. etapi privaatne eeltäide. Homme õhtul U1-teavitus: „kontrollpunkt: raske juhtumi järelplaan" → avab kirje → märgib „juhiga räägitud: jah; koormus: langenud".

**T3 — Töövägivald.** Kasutajat ähvardati telefonis. Avaleht → Töövägivald. Samm 0 (lävi, alati esimene): „Kas oht kestab praegu?" — „Pole kindel" → ohutustekst + töökoha ohutuskorra meeldetuletus NÄHTAVALT, alles siis vorm. Neutraalne kirjeldus (tühi väli, placeholder-juhis, mitte eeltäidetud tekst), dokumenteerimise seis, järgmine samm = juhiga järelkontakt + turvalisuse kokkulepe. Plaan: 2 sammu + kontrollpunkt „2 päeva". Jagamispaneelist juhimemo (neutraalne, ilma kliendi nimeta), kinnitab, kopeerib e-kirja. „Minu kirjed" näitab hiljem: kirje + jagatud memo 14.07 + kontrollpunkt täidetud.

**T4 — Killustatud nädal.** Kiirkontroll: katkestused kõrged, dokumenteerimiskoormus kõrge, taastumine osaline. Tulemus: kollane; 2 soovitust põhjendustega: „katkestused killustavad → Töökorraldus (katkestuste fookus)", „taastumine väheneb → Taastumine". Valib Töökorralduse → allikate kaardistus (telefon, kolleegide küsimused, dok-süsteem) → vajalik kokkulepe: fookusaeg → plaan: „T ja N 9–11 dokumenteerimise fookusaeg; erandid: vahetu oht" + osapool: tiim + kontrollpunkt 2 nädalat. Jagamispaneelist „töökorralduslik ettepanek" tiimile. 2 nädala pärast: kirje avaneb kontrollpunktist → „pidas osaliselt" → muster Ülevaates näitab katkestuste languse trendi.

**T5 — Alustaja.** Liis on 3. nädalat lastekaitses. Avaleht → „Roll ja areng" → Alustaja tugi. Etapp: esimene kuu; ebaselged teemad: dokumenteerimine, võrgustikutöö (TEMA valib, mitte eelvalik). Plaan: mentori küsimused + 100 päeva verstapostid + kontrollpunkt „kuu lõpus". Soovitus: „rolliootused ebaselged → Rollipiirid". Kuu lõpus naaseb SAMA kirje juurde (mitte uus vorm!), märgib edenemise, plaan uueneb — ASYE-mustri kohane korduv tugi.

---

## 11. Mida säilitada, ühendada, ümber nimetada, ümber järjestada, eemaldada

**Säilitada muutmata:**
- kogu serveripoolne privaatsus- ja kinnituskiht (records omanik-skoop; output-drafts CAS+lukk; covision handoff; pilot k-kaitse);
- 5-sammu jagamisahel (vali → eelvaade → muuda → 2 linnukest → kinnita [→ tuvastajad → üleandmine]);
- ⓘ-tekstide sisu; ohutustekstide sõnastus; „Jäta privaatseks" nupp;
- standardväljade sõnastik (scoreMaps/factorLabels) — koondmustri järjepidevuseks.

**Ühendada:**
- Katkestused + Tööprotsessid → üks töötuba „Töökorraldus ja ajaröövlid" kahe sisenemisfookusega (küsimused kattuvad juba praegu ~40%);
- kolm juhimemo-kohta → üks jagamispaneel (väljundkaardi „memo" muutub „ava jagamispaneelis selle põhjaga" nupuks);
- WellbeingActionList + SupportRequestPanel covision-teed → üks käitumine (alati mustand-ahel).

**Ümber nimetada:**
- „Ülevaade" → „Minu muster ja kirjed" (või „Minu tööheaolu") — praegune nimi lubab vähem, kui vaja;
- „Koosta abipalve" → adressaadiga nimi (nt „Sõnasta abipalve (kellele: …)") või eemaldada kuni adressaadimehaanika on olemas;
- salvestusnuppude objektinimed ühtlustada: „Salvesta kirje" + kirjetüüp pealkirjas (või kõikjal „Salvesta plaan").

**Ümber järjestada:**
- ohutusküsimus (hard-case, violence) vormi algusesse eraldi läveks;
- tulemus/signaal vormi järele (eraldi samm), mitte ette;
- privaatsuslause enne esimest sisendit, mitte jalusesse;
- avalehe kaardid kolme valiku + nelja rühma struktuuri (ptk 9).

**Eemaldada:**
- kõik sisulised vaikeväärtused (eeltäidetud selectid, linnukesed, näidistekstid textarea'des → placeholder'iteks);
- „Ava Taastumine" jagamisvalikute rühmast (viia soovituste ritta);
- actionRoutes'i `covision: "/kovisioon"` otsetee;
- Ülevaate toorvõtmete loend (asendada lingitud kaartidega);
- topeltpealkiri tööriistalehel.

---

## 12. Tooteotsused

Nummerdatud otsused, mis vajavad tooteomaniku kinnitust ENNE teostuspaketti:

**TO-1. Kirjete elutsükkel.** Kas kasutaja saab kirjeid (a) vaadata + kustutada; (b) vaadata + muuta + kustutada; või (c) vaadata + „paranda uue kirjena" + kustutada? — *Soovitus: (c)* — muutmise asemel versioonltus hoiab mustri-statistika ausana ja on lihtsam; kustutamine on §19.8 lubadus ja peab olema päris kustutamine (koos koondist eemaldumisega järgmisel arvutusel).

**TO-2. Kontrollpunkt ja meeldetuletus.** Kas kontrollpunkt tekitab U1-teavituse (kanal on olemas, e-kiri opt-in) või ainult badge'i „Minu kirjed" vaates? — *Soovitus: U1 sündmus + badge; ilma e-kirjata vaikimisi.* Ei mingit tööandja-poolset rütmi (ideed §19.2 keeld).

**TO-3. aggregationEligible.** Kas (a) lisada kasutajale lüliti „osalen anonüümses koondis" (vaikimisi väljas → uus vaikeväärtus false) või (b) vaikimisi sees, aga nähtava selgituse ja väljalülitusega? — *Soovitus: (b) piloodi ajal, (a) enne laiemat kasutust*; mõlemal juhul lause privaatsusribale. (§20.6: keeldumine ei tohi piirata kasutamist.)

**TO-4. Katkestused+Tööprotsessid ühendamine.** Kas ühendada (soovitus) või hoida eraldi selgema piiritekstiga? Mõjutab slugisid ja koondstatistika järjepidevust (workflowType väärtused säilitada andmetes, UI ühendab).

**TO-5. Taastumise ümberehitus.** Kas Taastumine saab taastumiskogemuste sisu (eemaldumine jt) + triaaž alamplokina (soovitus), või jääb triaažiks ja „taastumiskogemused" tuleb eraldi väikese harjutusena? Metoodiliselt esimene; mahult teine on väiksem.

**TO-6. Abipalve adressaat.** Kellele `support_request` tegelikult läheb (piloodi tugikontakt? juht? vaba tekst kasutajale kopeerimiseks?) — enne vastust nupp kas ümber nimetada „Sõnasta abipalve (kopeeritav tekst)" või peita.

**TO-7. Supervisiooni väljund.** `recipientType:"supervisor"` on tüübistikus olemas; ideed §19.7 loetleb supervisiooni küsimuse. Kas lisada neljas jagamisvalik „Koosta supervisiooni küsimus" (ainult tekst, ilma üleandmiseta — Supervisiooni moodulit pole)? — *Soovitus: jah, odav ja täidab metoodilise lünga.*

**TO-8. Vormifaktor.** Kas töötoa 3–5 sammu teostatakse (a) lihtsa sammuvahetusega (odav, kindel) või (b) flight-prototüübina (ruumilise suuna kandidaat)? — *Soovitus: (a) kõigepealt; flight ainult siis, kui eraldi prototüüp tõestab arusaadavuse võidu (ruumilise-kogemuse-lahtekoht §12 tingimused).* Otsus ei blokeeri sisulist ümberkorraldust — sammujaotus on sama.

**TO-9. Kiirkontrolli turvalisuse küsimus.** Kas lisada (soovitus: jah, 1 jah/ei marker, jah → Töövägivalla soovitus + ohutustekst)? Mõjutab koondmõõdikuid (uus marker).

**TO-10. Karusselli alamkarussell.** Kas Tööheaolu alamkarussell ruumis jääb (siis vajab rühmituse ja eri ikoonide peegeldust) või asendub ühe kaardiga, mis viib avalehele? — *Soovitus: üks kaart → avaleht; alamkarussell dubleerib avalehe rolli halvemini.*

---

## 13. Järgmine teostuspakett (väikesed rakendatavad etapid)

Järjestatud nii, et iga etapp annab iseseisva väärtuse ja on eraldi mergitav. Ükski ei muuda andmebaasi peale E2 (lisaväljad on juba olemas v.a. märgitud).

**E0 — Kiirparandused (0 uut kontseptsiooni, ~1–2 päeva):** ➜ **TEOSTATUD 15.07.2026 harus `fable/tooheaolu-e0` @ fe8c7df2 (punktid 1–3 + E0-lepingu testid; punktid 4–7 alles tegemata, kuulusid E0-lepingu skoobist välja); ootab järelkontrolli.**
1. **V17 parandus (kõige kiireloomulisem):** anonüümsusdetektori „name"-reegel `\s+` → `[^\S\n]+` (nimi ei ulatu üle reavahetuse); handoff-veavastusesse `issues` (snippet + suggestion) ja nende kuvamine SupportRequestPanelis; regressioonitest „iga töövoo standardmall läbib värava"; *(teostuses täpsustus: vastuses AINULT issueTypes+issueCount, snippet jäeti teadlikult välja — vt E0.2 leping)*;
2. Ülevaate soovitused: toorvõtmed → tõlgitud pealkirjad + lingid (`workflowLabels` + `wellbeingTools.route` on failis olemas) [V3];
3. actionRoutes `covision` → ava jagamispaneel covision_input-eelvalikuga (või vahelahendusena: nupu label „Ava Kovisioon" kui sihiks jääb /kovisioon) [V1];
4. tagasi-tee nähtavaks: kas SubpageHeaderi noole peidust võtmine paneelis VÕI X-i sihi parandus alamlehtedel (sisenemismarker katma ka `/tooheaolu/<slug>`) — miinimum: tööriistalehe X → `/tooheaolu`, mitte `/` [V15];
5. topeltpealkirja eemaldus [V12]; „Ava Taastumine" välja jagamisrühmast [V10];
6. avalehe kaartidele nähtav olukorralause (tekstid ideed §19.2 tabelist) [V13];
7. privaatsuslause avalehe päisesse ja tööriistas vormi ette [I1 nähtavus].

**E1 — Neutraalne algseis (~1–2 päeva):**
1. kõik vaikeväärtused → valimata/tühjad; placeholder-juhised textarea'desse;
2. signaal + väljundkaardid + soovitused renderduvad alles pärast miinimumvastuseid; „Salvesta" keelatud enne;
3. Kiirkontrolli vastuoluline kolmik (kollane + 0 soovitust + „jätka hoidmist") lahendatud: kollane ilma soovitusteta → „vali, mis teemat täpsustad" + 2 üldist linki;
4. salvestusteade → kviitung: „Salvestatud [Minu kirjetesse] · [Ava kirje]" (eeldab E2 detailvaadet; vahepeal link Ülevaatesse).

**E2 — Kirjete lugemiskiht = „Minu kirjed" (~3–4 päeva; ainus uus API-pind):**
1. `GET /api/wellbeing/records` (list, omanik-skoop; lib-funktsioon olemas) + `GET/DELETE /api/wellbeing/records/[id]`; kustutus = päris kustutus;
2. Ülevaade → „Minu muster ja kirjed": mustriplokk (olemasolev) + kirjete kronoloogia + kirje detailvaade (vastused + signaal + soovitused + seotud mustandid);
3. mustandite loend samas vaates (`GET output-drafts` on olemas, UI puudub) + „Jätka siit" href → konkreetne mustand [V6];
4. topelt-salvestuse kaitse: sama tööriista kirje < 2 min vahega → „kas uuendada äsjast kirjet?" [V5].

**E3 — Kontrollpunkt ja plaan (~3 päeva; TO-1/TO-2 järel):**
1. ühine „järgmine samm + kontrollkuupäev" plokk kõigi tööriistade lõppu (andmed lähevad standardizedFields'i — skeemimuutust pole);
2. kontrollpunkti U1-sündmus + badge; kirje avamisel „kas pidas?" märge (uus kirjeväli `followUp` JSON-is — pehme lisa);
3. soovituste „tehtud" olek: klikk soovitusel + naasmine märgib recommendation-follow'i (kirje metadata).

**E4 — Vormi rütm (~1 nädal; TO-8):**
1. tööriistavormid 3–5 sammuks (sisujaotus ptk 8.3; komponentide fieldset-struktuur juba vihjab jaotust);
2. segmentnupud dropdownide asemel 3–4-valikulistel; sammu-URL (`?samm=2`) — olek URL-is [V16];
3. ohutuslävi hard-case/violence algusesse.

**E5 — Ühendamised ja uued väljundid (TO-4/TO-5/TO-7 järel):**
1. Töökorraldus-töötuba (Katkestused+Tööprotsessid); slug-redirectid;
2. Taastumise taastumiskogemuste plokk;
3. supervisiooni küsimuse jagamisvalik; abipalve adressaadi lahendus (TO-6);
4. Kiirkontrolli turvamarker (TO-9); aggregationEligible lüliti (TO-3).

**E6 — (valikuline, eraldi prototüüp) flight-teostus töötoa sammudele** ruumilise-kogemuse-lahtekoht §4.3 piiridega; mõõda arusaadavus enne kasutuselevõttu.

Iga etapi järel: `npm test` (tests/wellbeing/ 26 failis on lepingu-testid, mis kaitsevad API-käitumist; E2 uus API vajab uusi teste samas mustris).

---

## 14. Kas mõni oluline tööheaolu meetod või funktsioon võiks veel olla?

Alusmaterjalidest põhjendatud, praegu puuduvad (järjekorras: väärtus/kulu):

1. **Psühholoogilise eemaldumise mikroplokk** (Sonnentag-Fritz stressor-detachment; REQ) — Taastumise töötoa 2–3 küsimust („kas suutsid tööst mõtetes eemalduda?") + 1 väike õhtune valik. Kõige suurema tõenduspõhjaga puuduv element (I8).
2. **Järelkontroll / „kas pidas?"** — mitte uus meetod, vaid iga plaani teine pool; ilma selleta on kõik tööriistad ühekordsed (ASYE, recovery-paradoks ja §19.8 kõik osutavad siia).
3. **Vabatahtlik rütm** — kasutaja valitud meeldetuletus kiirkontrolliks (kord nädalas/kuus/väljas; §19.2). U1 kanal olemas; rangelt kasutaja, mitte tööandja seadistatav.
4. **Supervisiooni küsimuse väljund** (TO-7) — tüübistikus juba olemas, UI puudub; Narusbergi lõputöö ja SKA materjal seovad tööheaolu otse supervisiooniga.
5. **Kaastundeväsimuse / teisese trauma / läbipõlemise eristuse selgitus** — mitte mõõdik, vaid lühike psühhoedukatiivne tekst (⓵-laiendus või RAG-viitega kaart) Raske juhtumi ja Taastumise juures; allikad korpuses (ProQOL kontekst, SocialWorker.com artikkel). Hoiab kasutaja ootuse õigena: tööriist märkab, spetsialist hindab.
6. **Enesekaastunde mikroharjutus raske juhtumi järel** (PMC süstemaatiline ülevaade STS-i kohta) — valikuline 1-minuti samm 24h plaanis; rangelt mitte-kliiniline sõnastus.
7. **Andmete eksport** (JSON/tekst) — §19.8 „allalaadimine"; GDPR-hügieen; odav.
8. **(Tulevik, eraldi otsustusring)** anonüümse koondi laiendused (§20.4 näitajad, §21 kuuraport) — alles pärast TO-3 ja piloodi kogemust; mitte privaatse tööriista varjatud kõrvalprodukt.

Mitte lisada (kooskõlas püsiva „teadlikult mitte ehitada" nimekirjaga): valideeritud kliinilisi instrumente (CBI/ProQOL) skoorimisena, AI-riskiskoori, tööandja vaadet üksikvastustele, kohustuslikku rütmi, edetabeleid.

---

## 15. Runtime-tõendus (autenditud brauser)

Metoodika: lokaalne dev-server (port 3000, kasutaja enda käivitatud) + **playwright-core + installitud Chrome** (headless, 1600×900, et-EE) + `LoginTempToken` (sha256, ühekordne) ADMIN-kontoga `claude.admin@sotsiaal.ai` (wellbeing lubatud, tellimusevärav bypass; rolle ei muudetud) — retsept `Kovisioon/HANDOFF-paris-ui-kuvatoendid.md` järgi, sest brauseripaanis selle rakenduse hüdratsioon ei käivitu. Kõik loodud andmed (5 kirjet, 4 mustandit, 3 tokenit; Kovisiooni juhtumeid ei tekkinud) kustutati skriptide koristusfaasis; DB-kontroll enne ja pärast: puhas. Lisatõend: 3 kasutaja enda kuvatõmmist (`docs/platvormi arendus/tööheaolu/Kuvatõmmis …011612/011619/011628.png`) + skriptide kuvatõendid scratchpadis.

| # | Kontroll | Tulemus | Kinnitab |
|---|---|---|---|
| A1 | `/tooheaolu` avalehe kaardid | 10 kaarti, **nähtav ainult pealkiri**; kirjeldus ainult aria-label'is | V13 |
| A3 | „Tagasi" nupp avalehel | DOM-is 1 tk, **boundingBox null → nähtamatu** | V15 |
| B1 | Kiirkontrolli vaikeseisu signaal | **„Kollane"** enne ühtegi kasutaja valikut | V4 |
| B2 | Vaikeseisu soovitused | 0 soovitust + „Jätka praeguste kokkulepete hoidmist…" (vastuolus kollase signaali üleskutsega) | V4 |
| B4/B5 | Kaks „Salvesta" klikki järjest | mõlemad õnnestuvad → **2 identset kirjet** | V5 |
| C1 | Kõrge koormus (emots. kõrge + taastumine puudub + raske juhtumi marker) | 2 soovitusnuppu põhjendustega („Ava raske juhtumi töövoog", „Koosta taastumise plaan") | ptk 2.4 |
| C2 | Sama profiili signaal (16 p) | endiselt **„Kollane"** — punane on praktiliselt kättesaamatu | ptk 7 p 2 |
| C3 | Soovitusnupu klikk | navigeerib `/tooheaolu/raske-juhtum` (salvestamata kontekst ei liigu kaasa) | ptk 3 |
| C4/C5 | Brauseri „tagasi" | Kiirkontroll avaneb **vaikeseisus**: valikud ja soovitused kadunud | V16 |
| D1 | Ülevaade pärast 3 salvestust | „Töövoo kirjeid: 3, Kiirkontrolle: 3"; signaalid 0/3/0 | ptk 3 |
| D2 | „Soovitatud järgmised töövood" | kuvab „hard-case", „recovery" — **toorvõtmed, mitte lingid** | V3 |
| D3 | Juhimemo Ülevaates | koondmall genereerub markeritest | V2 |
| E1/E2 | „Tagasi" nool tööriistalehel ja avalehel | element DOM-is, **„Element is not visible"** — klikk võimatu | V15 |
| E3 | X („Sulge ja naase ruumi") tööriistalehel | viib **`/` ruumi peavalikusse** (mitte /tooheaolu ega Töölaud) | V15 |
| F1–F3 | Juhimemo mustand: eelvaade → salvesta → 2 linnukest → kinnita | töötab; staatused õiged („…ei saadeta automaatselt") | I2 |
| F4 | Mis juhtub kinnitatud memoga edasi | **mitte midagi** — edasi-teed pole; hiljem pole mustand üheski vaates leitav | V6/V7 |
| G0 | Kovisiooni-sisendi kinnituse järel | tuvastajate linnuke + hoiatus + „Loo Kovisioon ja ava" renderduvad korrektselt | I2 |
| G1 | „Loo Kovisioon ja ava" standardmalliga | **jääb lehele; juhtumit ei looda** | **V17** |
| API | create(201) → confirm(200 ready_to_share) → handoff | **400 `identifiers_detected`**; vastuses pole detektori leide | **V17** |
| Üksus | `detectAnonymityIssues(standardmall)` | `type:"name", snippet:"…Kiirkontroll Olukorra üldistatud…"` — reavahetust ületav valepositiiv | **V17 juurpõhjus** |
| H1 | `GET /api/wellbeing/output-drafts` | töötab; mustandi `sourceRecordId: null` | ptk 2.5 |
| H2 | `GET /api/wellbeing/quick-check` | **405** — kirjete lugemise API-d ei ole | V5/I5 |

Piirangud: navigatsioonikontrollid tehti töölauamõõdus vaates (1600×900); karusselli-sisenemist (RoomStage alamkarussell) ja piloodivaadet runtime'is ei sõidetud (staatiline kaardistus ptk 2.1/2.5); „Tagasi" nupu nähtamatuse põhjust (CSS-reegel) koodini välja ei jälitatud — fakt on mõõdetud kahes eri vaates ja kattub kasutaja kuvatõmmistega.

---

## Töö seis

- [x] Alusmaterjalid loetud (orientatsioonikaart; tööheaolu materjalid.md; üldine tööheaolu.md; ruumilise-kogemuse-lahtekoht.md; ideed.md §2.11, §19, §20–21)
- [x] Komponendid kaardistatud (kõik 14 components/wellbeing/ + lib/wellbeingTools.js)
- [x] Teenuskiht loetud (lib/wellbeing/*, app/api/wellbeing/*, app/tooheaolu/*, dashboardInfoContent, Prisma skeem, PanelFrame/WorkspacePanel/RoomStage, workspaceContinuity, mySharings)
- [x] Kasutaja kuvatõmmised analüüsitud (3 tk)
- [x] Runtime-kontroll autenditud Chrome'is tehtud, andmed koristatud (ptk 15; sh V17 juurpõhjuse üksusetõendus)
- [x] Jaotised 0–15 kirjutatud; V-leiud runtime'iga sünkroonis
- [x] STATUS → COMPLETE

Analüüs on terviklik. Järgmise ülesande (rakenduskoodi parandamine) sisend: ptk 12 „Tooteotsused" (10 otsust) + ptk 13 „Järgmine teostuspakett" (E0–E6); E0 punkt 1 (V17) on kiireloomulisim. E0 täpne, aktiivse `main`-i vastu kontrollitud paranduskokkulepe on eraldi peatükis faili lõpus.

---

## E0 — rakendusvalmis paranduskokkulepe

Lisatud 15.07 teise ülesandena; kõik failiviited kontrollitud aktiivse `main`-i (7ae76d5b) vastu. Skoop on rangelt E0: V17 + veateade + „Salvesta" idempotentsus. MITTE: kirjete arhiiv, uus kujundus, E1–E6.

### E0.1. V17 juurpõhjus ja väikseim turvaline paranduspind

**Juurpõhjus (tõendatud üksuskutsega):** `lib/covisionShared.js:34`, ANONYMITY_RULES „name"-reegel:

```
pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{Ll}õäöüšž-]{2,}\s+[\p{Lu}ÕÄÖÜŠŽ][\p{Ll}õäöüšž-]{2,}\b/gu
```

`\s+` haarab ka reavahetuse, mistõttu iga rida, mis LÕPEB suurtähelise sõnaga (≥3 tähte), millele järgneb rida, mis ALGAB suurtähelise sõnaga, loetakse „nimeks". Kõik `buildWellbeingShareableDraft` covision_input mallid (lib/wellbeing/supportDraftText.js:81–94) sisaldavad paari „Teema: <Suurtäheline töövoopealkiri>" ↵ „Olukorra üldistatud kirjeldus:…" → vaste on garanteeritud igal töövool.

**Väikseim turvaline parandus:** AINULT „name"-reegli vahemuster `\s+` → `[^\S\r\n]+` (horisontaalne tühik; ei ületa \n ega \r\n):

```
pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{Ll}õäöüšž-]{2,}[^\S\r\n]+[\p{Lu}ÕÄÖÜŠŽ][\p{Ll}õäöüšž-]{2,}\b/gu
```

Põhjendus, miks see on piisav ja ohutu:
- päris nimi („Mari Mets") on praktikas ühel real — ühe rea sees jääb tuvastus identseks (olemasolev test `tests/covision/shared.test.js:12` jääb roheliseks);
- teised `\s+`-i kasutavad reeglid (address:29, small_place:39, institution:44) EI vaja E0-s muutmist: mallid ei sisalda nende võtmesõnu (tn/küla/kool jne) ning tõendatud valepositiiv puudub — sama asenduse võib teha hiljem eraldi otsusena, mitte selle paranduse osana;
- muudatus mõjutab kõiki `detectAnonymityIssues` kutsujaid ühtemoodi leebemaks AINULT üle-rea-piiri juhul: lib/wellbeing/covisionHandoff.js:107 (V17 värav), lib/covisionShared.js:280 (`buildCaseFromPreInquiryDraft` — mitteblokkeeriv, kuvab issues-loendi mustandil), lib/covision.js:840 (kovisiooni anonüümsuskontrolli action). Üle-rea-„nimi" ei ole üheski neist soovitud tuvastus, seega leevendus on kõigis kolmes korrektne.

**Alternatiiv, mida MITTE teha E0-s:** malliteksti ümbersõnastus (nt „Teema:" väiketäheliseks) jätaks vea alles kõigile kasutaja kirjutatud mitmerealistele tekstidele; detektori parandus on juurpõhjuse parandus.

### E0.2. Kasutajale nähtav veateade (ilma tuvastatud väärtust lekkimata)

Praegu: route tagastab ainult `{ ok:false, message:"wellbeing.errors.identifiers_detected" }` (app/api/wellbeing/output-drafts/[id]/covision/route.js:37) ja paneel kuvab üldise rea (SupportRequestPanel.jsx:394–395). Detektoril on serveris olemas `type/label/snippet/suggestion` (covisionShared.js:122–127), kuid `snippet` sisaldab tuvastatud väärtust ennast — seda EI TOHI vastusesse panna (vastusekehad võivad sattuda logidesse/monitooringusse; ülesande nõue keelab väärtuse tagastamise).

**Leping:**
- `covisionHandoff.js` `finalDraftText` (rida ~107–109): viska senine viga, aga lisa `error.details = { issueTypes: [...new Set(issues.map(i => i.type))].slice(0, 8), issueCount: issues.length }` — AINULT tüübid ja arv, ei snippet'it, ei label'it, ei positsiooni;
- `wellbeingCovisionHandoffPublicError` (covisionHandoff.js:93–98): tagasta `details` AINULT siis, kui `messageKey === "wellbeing.errors.identifiers_detected"` (whitelist — ükski teine veatee ei saa kogemata midagi kaasa anda);
- route (rida 37): `wellbeingJson({ ok:false, message: messageKey, ...(details ? { details } : {}) }, status)`;
- SupportRequestPanel `startCovision` catch (read 220–229): salvesta `payload?.details?.issueTypes` olekusse; `status === "covision_identifiers"` haru (394–395) kuvab senise üldrea + tüüpide loendi i18n-võtmetest.

**Kuvatav tekst (i18n; kood ei tohi sisaldada hard-coded JSX-teksti — lint):** olemasolev üldrida jääb; alla lisandub kuni 3 rida kujul „<tüübinimi>: <soovitus>", nt:

> Tekstis võib olla otseseid tuvastajaid. Eemalda või üldista need ja kinnita tekst uuesti.
> • Võimalik nimi — asenda nimi rolliga (nt klient, lapsevanem, kolleeg).
> • Võimalik telefoninumber — jäta ainult kontaktikanali kirjeldus.

Uued võtmed (lisada `messages/et.json` baasi + en/ru pariteet, `npm run i18n:check`): `wellbeing.support.identifier_types.{name,personal_code,email,phone,exact_date,address,small_place,institution}` ja `wellbeing.support.identifier_suggestions.{samad}` (tekstid võib üle võtta `anonymitySuggestion`-ist, covisionShared.js:134–144). Serveri `label/suggestion` stringe klient EI kasuta — tüüp on ainus leping.

### E0.3. „Salvesta" idempotentsus (topeltklikk + paralleelpäring)

Praegu loob iga `POST /api/wellbeing/<tool>` tingimusteta uue kirje (records.js `create*ForUser` → `prisma.wellbeingRecord.create`); nupp on keelatud ainult `saving`-oleku ajal, `saved`-olekus uus klikk dubleerib (runtime-tõendus B4/B5).

**Leping — serveripoolne, ilma skeemimuutuseta:**
- uus abifunktsioon `lib/wellbeing/records.js`-i: `createWellbeingRecordDeduped(prisma, data)`:
  1. võti `wellbeingRecord:<ownerUserId>:<workflowType>`;
  2. `db.$transaction(tx => { tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${key}))\`; … })` — täpselt sama muster ja fake-prisma tagavaratee (`if (typeof db?.$transaction !== "function") return callback(db)`) nagu `withWellbeingOutputDraftLock` (lib/wellbeing/outputDraftLock.js:1–11); soovitatav üldistada see helper samasse faili (nt `withWellbeingAdvisoryLock(db, key, cb)`), et mitte kopeerida;
  3. luku sees: `findFirst({ where: { ownerUserId, workflowType, createdAt: { gte: now−30 s } }, orderBy: { createdAt: "desc" } })`;
  4. kui leitud kirje `standardizedFields`, `period` ja `roleGroup` on kanooniliselt võrdsed (sügavvõrdlus, nt `node:util isDeepStrictEqual` — MITTE võtmejärjestusest sõltuv stringify), tagasta `{ record: existing, deduplicated: true }`;
  5. muidu loo ja tagasta `{ record, deduplicated: false }`;
- kõik 9 `create*ForUser` funktsiooni (records.js:164–450) kutsuvad seda senise otse-`create` asemel — mehaaniline asendus samas failis;
- route'id (nt app/api/wellbeing/quick-check/route.js:15–16): dedupe puhul staatus **200** + `deduplicated: true` kehas, uue kirje puhul senine **201** — leping fikseerida `tests/wellbeing/apiContracts.test.js`-is;
- kliendikomponente E0-s EI muudeta (9 faili jääb puutumata; server annab garantii). Teadlik semantika: identne uuesti-salvestus >30 s pärast LOOB uue kirje — see jääb nii kuni E2 („kas uuendada äsjast kirjet?" UI).

Miks mitte kliendi idempotentsusvõti kehas: nõuaks kas uut veergu (migratsioon — E0-s keelatud kulu) või `standardizedFields` saastamist, mille võtmeloendit valideeritakse ja mis läheb koondistatistikasse. Advisory-lock + sisuvõrdlus katab nii topeltkliki kui päris paralleelpäringud (lukk serialiseerib; teine päring näeb esimese kirjet).

### E0.4. Muutumatud invariandid (kontrolli enne merge'i, et ükski ei murdunud)

1. Omanik-skoop kõigis päringutes (`ownerUserId`/`userId` where-klauslites); võõra kasutaja kirje/mustand → 404, loendid ainult enda omad.
2. `visibility:"private"` vaikimisi kõigil kirjetel ja mustanditel; ükski E0 muudatus ei loo uut nähtavusrada.
3. Kinnitusahel: mustand → `ready_to_share` AINULT `PATCH` kaudu, kus `userReviewed===true && userConfirmed===true` + CAS `expectedUpdatedAt`; iga tekstimuudatus nullib kinnitused (kliendipool jääb puutumata).
4. Handoff-värav: `confirmedNoIdentifiers===true` kohustuslik (normalizeWellbeingCovisionHandoffRequest:69–74); staatus `ready_to_share`; CAS `expectedUpdatedAt` (sameInstant); idempotentsus — olemasoleva `covisionCaseId`-ga mustand tagastab sama juhtumi (covisionHandoff.js:167–169); atomaarsus (üks tehing, withWellbeingOutputDraftLock).
5. Detektor blokeerib endiselt kõik ühe-rea päristuvastajad (nimi, isikukood [1-6]+10 numbrit, e-post, telefon, kuupäev, aadress, väike asula, asutus) — leevendus puudutab AINULT üle-reavahetuse „nime".
6. Midagi ei saadeta automaatselt; handoff loob ainult PRIVATE Kovisiooni juhtumi, kus omanik on kasutaja ise ja eeltäide on tema kinnitatud tekst (`case_anchor`, stage 2).
7. Roll+tellimuse värav (`requireWellbeingApiUser`: sessioon → roll SOCIAL_WORKER/admin → `requireSubscription`) kõigil wellbeing-API-del, ka uutel vastuseharudel.
8. `aggregationEligible`, koondi min-grupp ja piloodivaade — E0 EI puuduta (TO-3 on eraldi otsus).
9. Vastuse turvapäised (`wellbeingJson` NO_STORE_HEADERS) kõigil harudel, ka dedupe-200-l.
10. Veakehades ei ole kunagi kasutaja teksti ega tuvastatud väärtust (E0.2 whitelist tagab).

### E0.5. Failide ja funktsioonide loend (tõenäoline täielik puutepind)

| Fail | Koht | Muudatus |
|---|---|---|
| lib/covisionShared.js | ANONYMITY_RULES „name" pattern (:34) | `\s+` → `[^\S\r\n]+` |
| lib/wellbeing/covisionHandoff.js | finalDraftText (:100–111); wellbeingCovisionHandoffPublicError (:93–98) | `error.details = {issueTypes, issueCount}`; details läbi ainult identifiers-võtmel |
| app/api/wellbeing/output-drafts/[id]/covision/route.js | POST catch (:32–38) | `details` kaasa 400-vastusesse |
| components/wellbeing/SupportRequestPanel.jsx | startCovision catch (:220–229); status-rida (:394–395) | issueTypes olekusse; tüüpide loend i18n-võtmetest |
| messages/et.json, en.json, ru.json | wellbeing.support.* | 16 uut võtit (types + suggestions × 8) |
| lib/wellbeing/outputDraftLock.js | uus üldine `withWellbeingAdvisoryLock(db, key, cb)` (olemasolev funktsioon delegeerib) | luku taaskasutus |
| lib/wellbeing/records.js | uus `createWellbeingRecordDeduped`; 9× `create*ForUser` (:164–450) kutsuvad seda | dedupe-loogika |
| app/api/wellbeing/{quick-check,hard-case,workplace-violence,recovery,work-boundaries,interruptions,work-processes,role-boundaries,starter-support}/route.js | POST vastus | 200+`deduplicated:true` dedupe puhul (9 väikest ühesugust muudatust) |
| tests/wellbeing/* | vt E0.6 | uued/laiendatud testid |

Mitte ühtegi Prisma skeemi- ega migratsioonimuudatust. Mitte ühtegi muudatust töövookomponentides (9 vormi), aggregate/pilot-kihis, overview's.

### E0.6. Kohustuslikud regressioonitestid (node:test, süstitud fake-prisma; sama muster nagu olemasolevad tests/wellbeing/*)

1. **Standardmall ei anna valepositiivi** — uus `tests/wellbeing/templateAnonymity.test.js`: iga `sourceWorkflowType` (10 tk) × `buildWellbeingShareableDraft({outputType:"covision_input", recipientType:"covision", context:{}})` → `detectAnonymityIssues(generatedText)` on `[]`; lisaks manager_memo/support_request mallid (tulevikukindlus, kui väravaid laiendatakse).
2. **Päris tuvastajad blokeeritakse endiselt** — laienda `tests/covision/shared.test.js` juhtumit või peegelda wellbeing-poolel: „Klient Mari Mets elab aadressil Tamme tn 12, telefon +372 5123 4567, isikukood 48901011234, e-post mari@example.ee" → tüübid {name, address, phone, personal_code, email} KÕIK olemas (olemasolev test :12–23 peab jääma roheliseks); + handoff-tasand: `startCovisionFromWellbeingDraft` nimega tekstil → viskab `wellbeing.errors.identifiers_detected` JA `error.details.issueTypes` sisaldab `"name"` ja EI sisalda snippet'it/väärtust.
3. **Topeltklikk loob ühe kirje** — `tests/wellbeing/records.test.js`: kaks järjestikust `createQuickCheckRecordForUser` sama kasutaja + identsete `standardizedFields`-iga (fake-prisma kirjetega, mille createdAt ← 30 s aknas) → teine tagastab `deduplicated:true` ja sama `record.id`; store'is 1 kirje.
4. **Paralleelsed korduspäringud loovad ühe kirje** — sama fail: fake-prisma `$transaction`, mis serialiseerib (järjekorratest: lukukutse registreeritakse enne callback'i); käivita `Promise.all([create, create])` → täpselt 1 `create`-kutse, teine haru dedupe. (Päris-paralleelsuse garantii kannab `pg_advisory_xact_lock`; märgi testis kommentaariga, et elusa DB serialiseerimist unit-test ei simuleeri — sama piirang on olemasoleval outputDraftLock testil.)
5. **Võõra kasutaja andmeid ei avaldata** — records.test.js: kasutaja B identsete väljadega „dedupe-sond" 30 s aknas EI tagasta kasutaja A kirjet (võti sisaldab ownerUserId); apiContracts/covisionHandoffContracts: võõra mustandi handoff → 404, `details` puudub; `GET /api/wellbeing/output-drafts` tagastab ainult enda mustandid (olemasolev leping — kinnita, et ei murdunud).
6. **Edukas kinnitatud üleandmine töötab lõpuni** — `tests/wellbeing/covisionHandoff.test.js`: mustand `ready_to_share` + `userReviewed/userConfirmed=true` + STANDARDMALLI tekst (mitte enam käsitsi „puhas" tekst!) + `confirmedNoIdentifiers:true` + õige `expectedUpdatedAt` → tagastab `covisionCaseId`; mustand → `in_covision`, `handedOffAt` täidetud; CovisionCase PRIVATE + participant OWNER + sessionState stage 1 + privateState stage 2 `case_anchor` == kinnitatud tekst; kordus-kutse tagastab SAMA `covisionCaseId` (`created:false`).
7. **API-leping** — `tests/wellbeing/apiContracts.test.js`: quick-check POST uus kirje → 201 ilma `deduplicated`-ta; kordus 30 s aknas → 200 + `deduplicated:true`; identifiers-400 kehas on `details.issueTypes` (massiiv stringe) ja EI OLE ühtegi muud välja peale `ok/message/details`.

### E0.7. Valmisoleku kontrollnimekiri

- [ ] `npm test` roheline (sh KÕIK punktid E0.6; enne parandust kirjuta test 1 punaseks → pärast roheliseks);
- [ ] `npm run i18n:check` roheline (16 uut võtit et+en+ru pariteedis);
- [ ] lint roheline (uued UI-read ainult i18n kaudu, mitte hard-coded);
- [ ] migratsioone EI tekkinud (`prisma/migrations` diff tühi; `npm run db:migrate:check` käitumine muutumatu);
- [ ] käsitsi e2e HANDOFF-retseptiga (playwright-core + LoginTempToken + päris Chrome; brauseripaani MITTE kasutada): (a) Kiirkontroll → kovisiooni sisend → muutmata mall → kinnitused → „Loo Kovisioon ja ava" → maandub `/kovisioon?case=<id>`; (b) sama voog tekstiga „Mari Mets helistas" → 400 + paneelis nähtav „Võimalik nimi" rida, väärtust ei kuvata vastuses; (c) topeltklikk „Salvesta kiirkontroll" → Ülevaates `Töövoo kirjeid: 1`; (d) loodud test-andmed ja token kustutatud, DB-kontroll puhas;
- [ ] E0.4 invariandid üle käidud (eriti: idempotentse handoff'i korduskutse, CAS-konfliktid 409, no-store päised);
- [ ] dokumentatsioonirida: selle faili V17 staatus → „parandatud <commit>" + memory-märkme uuendus (`tooheaolu-tervikanalyys.md`).

**Jätkamispunkt järgmisele aknale:** teosta E0 täpselt selle peatüki järgi, järjekorras E0.1 (regex + test 1 punane→roheline) → E0.2 (details-ahel + i18n) → E0.3 (dedupe) → E0.6 ülejäänud testid → E0.7 kontrollnimekiri; ära laienda skoopi (kirjete arhiiv = E2, kujundus = E4). Kõik failiviited ülal on kontrollitud `main` @ 7ae76d5b vastu 15.07.2026.

---

## Lisa: kümne alalehe teisendus seitsmeks töötoaks (vastavuskaart)

Vastab küsimusele: kuidas jõuda praegusest 10 alalehest ptk 8.2 struktuurini (**uks + peegel + 7 töötuba**) nii, et ükski vajalik funktsioon ega senise kasutajaandme tähendus ei kao. Arvestus: 10 alalehte = 1 sissepääs (Kiirkontroll) + 1 peegel (Ülevaade) + 8 teemalehte; 8 → 7 tuleb ainsast liitmisest (Katkestused + Tööprotsessid). Ühtegi funktsiooni ei eemaldata; „eemaldamised" on elemenditasandil (ptk 11: vaikeväärtused, topelt-kovisioonitee, „Ava Taastumine" jagamisrühmast).

### Vastavustabel

| Praegune alaleht | Tulevane asukoht | Staatus | Olukord, mis sinna juhib (ideed §19.2) | Väljund/jätkutee, mis PEAB säilima |
|---|---|---|---|---|
| **Kiirkontroll** | Sissepääs „Kontrollin üldist" (mitte tavaline kaart kaartide seas) | **Säilib**, roll täpsustub; +turvamarker (TO-9) | „Soovin üldiselt kontrollida, kuidas mul läheb" | signaal + tegurid; kirje (workflowType `quick-check`) koondisse; soovitused → töötuba PÕHJENDUSEGA; jagamispaneel |
| **Ülevaade** | „Minu muster ja kirjed" (peegel + arhiiv E2-st) | **Nimetatakse ümber**, laieneb | „Soovin näha enda varasemaid mustreid" / „kus mu salvestused on?" | mustriplokk + perioodifilter; koond-juhimemo VÕIMEKUS (kolib jagamispaneeli, `sourceWorkflowType:"overview"` jääb); edaspidi kirjete kronoloogia |
| **Raske juhtum** | Töötuba „Raske juhtum" | **Säilib** (+ ohutusküsimus voo algusesse, E4) | „Juhtum jäi mind emotsionaalselt mõjutama" | 24h järelplaan, neutraalne kokkuvõte, juhimemo, kovisiooni sisend + handoff; ohutustekst; kirjetüüp `hard-case` |
| **Töövägivald** | Töötuba „Töövägivald" — ühtlasi ERALDI TURVARADA | **Säilib** eraldi kaardi ja marsruudina | „Kogesin ähvardust, solvamist, jälitamist või vägivalda" (+ Kiirkontrolli turvamarker juhib siia) | ohutuslävi ENNE vormi; neutraalne juhtumikirjeldus, turvalisuse kokkuleppe sisend, juhimemo, kovisiooni sisend, töökorralduse soovitus; kirjetüüp `workplace-violence` |
| **Taastumine** | Töötuba „Taastumine" (ümberehitus TO-5: taastumiskogemused + senine triaaž alamplokina) | **Säilib**, sisu täieneb | „Olen kurnatud või vajan taastumisplaani" | 24–72h triaaž (vältimatu/edasilükatav/ümberjagatav) EI KAO — jääb alamplokiks; juhimemo; jätk Tööpiiridesse; vanad kirjed jäävad kehtima (vt andmereeglid) |
| **Tööpiirid** | Töötuba „Tööpiirid" | **Säilib** | „Olen liiga palju tööväliselt kättesaadav" | kokkuleppe mustand, juhimemo, dokumendi-koostamise sisend (viide Dokreziimi); kirjetüüp `work-boundaries` |
| **Katkestused** | Töötuba „Töökorraldus ja ajaröövlid", sisenemisfookus A | **Liidetakse** (ainult UI/navigatsioon) | „Tööpäev on pidevalt killustatud" | katkestuste kaart, fookusaja kokkulepe, kanalite kokkulepe, juhimemo; kirjed salvestuvad ENDISELT tüübiga `interruptions` |
| **Tööprotsessid** | Sama töötuba, sisenemisfookus B | **Liidetakse** (ainult UI/navigatsioon) | „Töökorraldus või dokumenteerimine võtab ebamõistlikult palju aega" | protsessikaart, top-3 ajaröövlit, lihtsustusettepanek, infoliikumise kokkuvõte, juhimemo; kirjed tüübiga `work-processes` |
| **Rollipiirid** | Töötuba „Rollipiirid" | **Säilib** | „Minult oodatakse midagi, mis ei kuulu minu rolli" | rollianalüüs, kliendiselgitus, partneriselgitus, „saan/ei saa" tekst, juhimemo; kovisiooni-soovitus AINULT mustandi-ahela kaudu |
| **Alustaja tugi** | Töötuba „Alustaja tugi" (korduva kontrollpunktiga, E3) | **Säilib** | „Olen uus või uues ametialases rollis" | nädala/kuu/100 päeva plaanid, mentori küsimused, kovisiooni-vajaduse kontroll; „alustaja tööpiiride mustand" muutub VIITEKS Tööpiiride töötuppa (mitte paralleelväljund) |

### 1. Mida saab ühendada ainult kujunduse ja navigeerimise tasandil

- **Katkestused + Tööprotsessid → üks töötuba:** üks kest, ühine sissejuhatus ja plaani-samm; küsimusteplokid hargnevad valitud fookuse järgi; kaks avalehe-olukorralauset viivad sama töötoa eri fookusesse. Vanad marsruudid `/tooheaolu/katkestused` ja `/tooheaolu/tooprotsessid` jäävad redirect'idena alles (järjehoidjad, „Jätka siit" viited).
- **Avalehe rühmitus** (Juhtum ja turvalisus / Koormus ja taastumine / Töökorraldus / Roll ja areng) — puhtalt navigatsioon.
- **Ülevaate ümbernimetamine** „Minu mustriks ja kirjeteks" — UI-tekst; kõik andmeviited jäävad.
- **Jagamispaneeli ühtlustamine** (kolm juhimemo-kohta → üks paneel; väljundkaardid muutuvad „ava jagamispaneelis selle põhjaga" nuppudeks) — komponenditasand.
- **Kiirkontrolli esiletõst** sissepääsuna ja soovitusnuppude ühtne tähendus („avab töötoa") — navigatsioon.

### 2. Mida EI TOHI andmemudelis kokku sulatada

- **`workflowType` väärtused jäävad muutmata** (`quick-check`, `overview`, `hard-case`, `workplace-violence`, `recovery`, `work-boundaries`, `interruptions`, `work-processes`, `role-boundaries`, `starter-support`). Nende peal seisavad: senised WellbeingRecord-read, output-draftide `sourceWorkflowType`, Ülevaate töövoo-loendurid, koondmõõdikute võtmed ja pilootvaate filtrid, lepingutestid. Uut ühistüüpi (nt „work-organization") EI looda — liidetud töötuba salvestab kirje valitud fookuse järgi kas `interruptions` või `work-processes` tüübiga. Nii jäävad vanade ja uute kirjete mustrid võrreldavaks.
- **Skoorisõnastikud ja `scoringVersion` tüübi kaupa lahus.** Katkestuste ja Tööprotsesside signaalid (`needs_workflow_clarification` vs `needs_simplification` jne) tähendavad eri asju; koond normaliseerib need niikuinii liiklusvärvideks. Ühine skoor looks vale ajaloo.
- **Taastumise ümberehitus = uus versioon, mitte ümbertõlgendus.** Uued taastumiskogemuste väljad → `scoringVersion: "recovery-v2"` (ja vajadusel `schemaVersion` tõste); vanad `recovery-v1` kirjed jäävad tähendama 24–72h triaaži ning Ülevaade/koond loevad mõlemat versiooni, sulatamata neid üheks mõõdikuks.
- **Väljundmustandite `outputType`/`recipientType` loendid** (supportDrafts.js) jäävad samaks; „supervisiooni küsimus" (TO-7) lisandub olemasoleva `supervisor` saajatüübi peale, mitte uue paralleelmõistena.
- **Ümbernimetamised ei muuda salvestatud stringe:** „Minu muster ja kirjed" on ainult kuvanimi; `overview` jääb andmetes; sama kehtib töötubade pealkirjade kohta.

### 3. Mis jääb eraldi kiireks kriisi- või turvarajaks

- **Töövägivald** — oma kaart, oma marsruut, mitte kunagi peidetud liidetud töötoa ega sammuvoo taha; ohutusküsimus ja ohutustekst (töökoha ohutuskord, hädaabi) on voo ESIMENE lävi ja nähtavad ilma ühegi lisaklikita; Kiirkontrolli turvamarker (TO-9) juhib otse siia. Flight'i/sammuanimatsiooni sellel rajal ei kasutata (ptk 8.3 piirang: kinnitused ja ohutustekstid ei tohi olla animatsiooni taga).
- **Raske juhtum** — jääb eraldi sissepääsuga akuutrajaks (24h järelplaan on ajakriitiline); tema „vahetu oht" küsimus + eskalatsioonitekst säilivad muutumatul kujul ja liiguvad voo algusesse.
- **Kiirkontroll** ei ole kriisirada, aga on kiirtee: 3 tuumaküsimust + turvamarker peavad olema läbitavad alla minutiga ka pärast kõiki ümberkorraldusi.

Teisenduse järjekord sõltub E2-st (kirjete lugemiskiht) ja TO-4/TO-5 otsustest — see kaart on nende otsuste sisend, mitte asendus. Jätkamispunkt püsib sama: kõigepealt E0 (eelmine peatükk), siis TO-otsused, siis see teisendus E4/E5 raames.
