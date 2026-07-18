# Fable 5: Tööheaolu V2 — iganädalane püsiruum (WELLBEING-V2-A0)

Kuupäev: 17.07.2026
Koostaja: Fable 5 (analüüsirada)
Alus: master-register (`fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md`), ülesanne CASEWORK-A0 ptk 11.6.
Reeglid: read-only analüüs — rakenduskoodi, skeemi, migratsioone ega teste ei muudeta; ei commit'ita ega deploy'ta;
määrdunud kohalikku `main`-i ei kasutata (loetakse `origin/main` + harud + server). TO-2 ja org-nähtavus on
tooteotsused, mitte vaikimisi tehnilised valikud; üksikkirje ei jõua KUNAGI ühtegi koondisse ilma k-anonüümsuse läveta.

## Edenemistabel

| # | Etapp | Seis | Tulemus |
|---|---|---|---|
| 1 | Tõeallikate kontroll (origin/main, server, haru, K1-P0 haru, toodangu DB) | TEHTUD | ptk 0 |
| 2 | Sisenddokumendid (tervikanalüüs, K1-U1, RUUM-VIS 6.2, CASEWORK 3.2/3.6, ideed 19–21, koondseis) | TEHTUD | läbivalt viidatud |
| 3 | Püsiruumi määratlus ja nelja kihi eristus (main/server/haru/visioon) | TEHTUD | ptk 1–2 |
| 4 | Kerge nädalarütm ja küsimustikuväsimuse vältimine | TEHTUD | ptk 3 |
| 5 | Privaatsus, anti-jälgimise invariandid, üksikkirje-keelu auguanalüüs | TEHTUD | ptk 4 |
| 6 | Trend, tugi ja eskaleerumise piirid | TEHTUD | ptk 5 |
| 7 | Nähtavusmaatriks (töötaja/org/vaatleja/admin) | TEHTUD | ptk 6 |
| 8 | `wellbeing_space` adapteri koondireeglid ([TECH-OPEN] vastus) + `weekly_checkin_due` leping | TEHTUD | ptk 7 |
| 9 | Seosed (CASEWORK, K1/U1, E0, olemasolevad vormid, SUP/KOV, ORG, EXPORT, VEST) | TEHTUD | ptk 8 |
| 10 | Otsuste register (toode/õigus/metoodika/org) | TEHTUD | ptk 9 |
| 11 | Rakenduspaketid WB-V2-P0…P5 + esimene rakendusvalmis pakett | TEHTUD | ptk 10, 11.4 |
| 12 | Lõppväljund + master-registri uuendus + memory | TEHTUD | ptk 11, Jätkamispunkt |

## 0. Tõeallikad (kontrollitud 2026-07-17, read-only)

| Kiht | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa` | `git fetch` + `git log origin/main` 17.07.2026 |
| Live-server | `fe4eb4fa` = origin/main; tööpuu puhas; `sotsiaalai-frontend` ja `sotsiaalai-rag` aktiivsed | SSH `/home/ubuntu/apps/sotsiaalai` 17.07.2026 |
| **Toodangu DB** | **`WellbeingRecord` = 0 rida, `WellbeingOutputDraft` = 0, `WellbeingPilotScope` = 0** | SSH + psql (read-only count) 17.07.2026 |
| Haru `fable/tooheaolu-e0` | `fe8c7df2` — kohalik JA `origin`-is; EI merge'itud (main-is V17 kehtib); diff = 22 faili, rangelt E0 skoop | `git branch -a`, `git diff --stat origin/main...fable/tooheaolu-e0`; regex-parandus `[^\S\r\n]+` ja `templateAnonymity.test.js` (10 töövoogu × 3 väljundit) haru pealt üle loetud |
| K1-P0 haru | `codex/k1-p0-workspace-contract @ ef5973c9`: registry sisaldab `WELLBEING_SPACE: "wellbeing_space"` staatusega `RESERVED` (adapter `null`) | `git show ef5973c9:lib/workspaces/registry.js` |
| Kohalik `main` | `0da4185b`, määrdunud tööpuu — EI kasutatud | `git status` snapshot |
| Otsustusleht | `fable-5-tooheaolu-tooteotsuste-otsustusleht.md` **PUUDUB** — TO-1…TO-10 on kõik vastuseta | `ls docs/platvormi arendus` |

Kood [MAIN], mis selle analüüsi jaoks täies mahus või sihitult üle loeti: `prisma/schema.prisma`
(WellbeingRecord, WellbeingOutputDraft, WellbeingPilotScope/Viewer), `lib/wellbeing/aggregate.js` (täismahus, 175 rida),
`lib/wellbeing/pilotAccess.js`, `lib/wellbeing/pilotReport.js` ja `aggregateExport.js` (funktsioonipinnad),
`app/api/wellbeing/*` (15 route'i loend), `lib/workspaceContinuity.js` (wellbeing_draft haru),
`lib/wellbeing/overview.js` (periodSignal + juhimemo). Dokumendid: Tööheaolu tervikanalüüs (647 r, sh E0-leping ja
10→7 vastavuskaart), Tööheaolu koondseis, K1-U1-A0 (ptk 3/4/7/10/11), RUUM-VIS ptk 6.2, CASEWORK-A0 ptk 3.2/3.6/11,
ideed ptk 19–21.

**Kihi-eristus, mida kogu dokument kasutab:** [MAIN] = origin/main `fe4eb4fa` = [SERVER] (kood identne; andmeid null);
[BRANCH] = `fable/tooheaolu-e0` (E0 parandused, järelkontrolli ootel); [K1-BRANCH] = K1-P0 registry;
[VISION] = RUUM-VIS 6.2 + ideed 19–21 sihtolek; [DOC] = varasemad analüüsid.

---

## 1. Mis on „iganädalane püsiruum" — määratlus ja piir

### 1.1. Kasutaja vajadus ja ruumi olemus

RUUM-VIS 6.2 sõnastab vajaduse, mida ükski praegune vorm ei täida: spetsialist vajab kohta, kuhu **regulaarselt
naasta** — mis nädalal juhtus, kui koormatud ma olen, kas taastun, kus mu piirid pidasid, mis on muutunud — **ilma
et sellest saaks aruanne kellelegi**. Tervikanalüüsi diagnoos on sama asja tehniline pool: 10 head vormi ilma
tervikuta; ring ei sulgu, sest kirjeid ei saa hiljem vaadata (lugemisrada puudub), naasmise rütmi pole ja „Jätka
siit" viib tühjale avalehele (V5/V6/I5/I14).

**Püsiruum** erineb platvormi senistest protsessiruumidest (Kovisioon: DRAFT→…→CLOSED+purge) selle poolest, et ta
**ei sulgu kunagi**: tal pole lõppväravat, pole „valmis" olekut, pole purge-tseremooniat. K1 sõnastikus on ta
mittelineaarse profiiliga tarbija (K1-U1 ptk 3 tabel: „rütm kui faasivariant — K1 lubab mittelineaarse profiili").
Sisu on RÜTM, mitte teekond: sisenemine („kuidas läheb?") → nädala sündmuste märkimine → vajadusel sügavam vorm
(olemasolevad 10) → piiride/toe ülevaade → järgmine samm → lahkumine kokkuvõttega (RUUM-VIS 6.2 põhifaasid).

### 1.2. Neli kihti — mis on kus PÄRISELT

| Kiht | Mis seal on | Mida seal EI OLE |
|---|---|---|
| [MAIN]=[SERVER] | 10 vormi, privaatne salvestus (ainult CREATE), Ülevaate koond, mustandi→Kovisiooni handoff (V17 tõttu standardmalliga blokeeritud), k-anonüümne pilootagregaat + eksport | kirjete lugemis-/muutmis-/kustutamisrada; rütm/meeldetuletus; naasmispunkt; „Minu jagamised" kate; TO-otsused |
| [SERVER, andmed] | **0 heaolukirjet, 0 mustandit, 0 pilootskoopi** — funktsioon on toodangus, aga kasutuseta | mitte ühtegi päriskasutuse mustrit; agregaat ei ole kunagi päris andmetega töötanud |
| [BRANCH e0] | V17 detektoriparandus, lekketa tuvastajavihjed, 9 salvestustee 30 s idempotentsus; 1238/1238 testi | järelkontroll + merge; kõik muu (E1–E6) on teadlikult väljas |
| [VISION] | nädalarütm, naasmispunkt, „minu nädal" ajajoon, tööobjektid (nädalakirje, tööpiir, tugikontakt, muutuse tähis), U1 meeldetuletus, ruumiline tuba | ükski neist pole koodis; `wellbeing_space` on registris ainult RESERVEERITUD kind [K1-BRANCH] |

**Toodangu null-seisu tähendus (uus leid):** kuna päriskirjeid pole, on V2 kujundamisel erakordne vabadus —
ükski andmemudeli või vaikeväärtuse otsus (sh TO-3 `aggregationEligible` vaikeseade) ei nõua backfilli ega
ümberklassifitseerimist, KUI see tehakse enne esimesi päriskasutajaid. See aken sulgub esimese päriskirjega;
otsuste edasilükkamisel on nüüd mõõdetav hind.

### 1.3. Mida iganädalane püsiruum EI OLE (koondatud keelud)

1. **Ei aruandekanal:** mitte kunagi tööandja dashboard, „heaoluskoor", automaatne HR-teavitus ega individuaalne
   nähtavus juhile (RUUM-VIS 6.2 „mitte ehitada"; ideed 21.7; U1 11.3 p1 arhitektuuriline keeld).
2. **Ei kohustus:** rütm on kutse; mingit tööandja-poolset ega platvormi-poolset sundi, tähtaega, „võlga" ega
   punast häbimärki vahelejäänud nädala eest (ideed 19.2).
3. **Ei mõõteriist:** ükski vaade ei esine valideeritud instrumendina ega anna diagnoosi/töövõimehinnangut (I15);
   trend on kirjeldav muster, mitte üldskoor (ideed 19.4).
4. **Ei klienditöö:** kliendi faktid kuuluvad STAR2/juhtumitöösse; siin on ainult mõju töötajale (I7; ideed 19.6);
   Meetodipeegli (töötaja VALIK) ja Tööheaolu (töötaja KOORMUS) kirjed ei liitu ega viita teineteisele vaikimisi
   (CASEWORK 3.2).
5. **Ei uus andmeladu:** V2 ehitub olemasoleva `WellbeingRecord`/`WellbeingOutputDraft` peale; konteinertabelit ei
   looda enne TH-RUUM otsuseid (K1-U1 ptk 3: „adapter, mitte uus tabel"); `workflowType` väärtusi ei liideta ega
   nimetata ümber (tervikanalüüsi Lisa, kõva reegel).

---

## 2. Lähteseisu kaart (kood + andmed)

### 2.1. Andmemudel [MAIN] — mida V2 juba tasuta saab

`WellbeingRecord` (schema): `workflowType`, `period String?`, `roleGroup String?`, `standardizedFields Json`,
`computedSignal Json`, `loadFactors/resourceFactors/riskMarkers Json`, `recommendedActions Json`,
`visibility @default("private")`, `aggregationEligible @default(true)`, indeksid
`(ownerUserId, workflowType, createdAt)` + `(aggregationEligible, workflowType, createdAt)`. Nädalavaate jaoks
vajalik on KÕIK olemas: ajatelg (`createdAt` + omaniku indeks), kirje sisu, soovitused, isegi kontrollpunkti
kandidaatväljad (`nextCheckpoint`, `reviewTime` salvestuvad `standardizedFields`'i kahel tööriistal, I4). Puudu on
ainult LUGEMISKIHT — st V2 esimene kiht on API+UI, mitte skeem.

`WellbeingOutputDraft`: elutsükkel `draft → ready_to_share → in_covision`, CAS, advisory-lock, `covisionCaseId
@unique`, `handedOffAt`; `sourceRecordId String?` on skeemis, aga UI ei saada seda kunagi (tervikanalüüs 2.5) —
nädalavaate „kirje → temast tehtud mustandid" side on skeemis valmis, kasutamata.

### 2.2. API-pind [MAIN] — kinnitatud auk

`app/api/wellbeing/` sisaldab: 9 vormi-POST-i, `overview` GET, `output-drafts` GET/PATCH + `[id]` + `[id]/covision`
POST, `pilot/aggregate` GET. **Kirje-tasandi GET/PATCH/DELETE puudub täielikult** — sama seis, mille tervikanalüüs
fikseeris (H2: `GET /api/wellbeing/quick-check` → 405). `workspaceContinuity.js` loeb kinnitamata mustandeid
(prio 6), aga `href: "/tooheaolu"` on tühi sihtkoht (V6).

### 2.3. E0 seis [BRANCH] — järelkontrolli ootel, merge on V2 järjestussõltuvus

`fable/tooheaolu-e0 @ fe8c7df2` (kohalik + origin): (1) detektori name-regex `\s+` → `[^\S\r\n]+` (üle loetud haru
pealt, kommentaariga); (2) lekketa `details = {issueTypes, issueCount}` ainult identifiers-võtmel + 16×3 i18n võtit;
(3) kõigi 9 salvestustee advisory-lock + 30 s sisuvõrdlus (200+`deduplicated:true`); testid sh
`templateAnonymity.test.js` (10 töövoogu × covision_input/manager_memo/support_request). **Kaks V2-järeldust:**
(a) kuni merge'ita on main-is Kovisiooni-üleandmine — komplekti AINUS automaatne jätkutee — standardmalliga
katki (V17), st iga „nädalaruum suunab toe juurde" lugu lõpeb praegu 400-veaga; (b) E0 kirjutas
`lib/wellbeing/records.js` sisuliselt ümber (323 muudetud rida) — kirjete lugemiskihi (WB-V2-P0) töö SAMAS failis
enne E0 merge'i tekitaks tarbetu konflikti. Seega E0 järelkontroll+merge on V2 raja samm 0.

### 2.4. Pilootkiht [MAIN] — ligipääs ja raport

`resolveWellbeingPilotAccess`: (1) admin → täisligipääs koondile **ilma roleGroup-piiranguta**; (2) DB
`WellbeingPilotScope.viewers` (userId/email, ajaaknaga); (3) env-fallback `WELLBEING_PILOT_VIEWER_EMAILS` +
`WELLBEING_PILOT_ROLE_GROUPS`. Toodangus pole ühtegi pilootskoopi — st täna näeb koondvaadet ainult admin.
`pilotReport.js` ehitab ÜHE hetke koondist juhtkokkuvõtte (prioriteedid, soovitatud kokkulepped);
**ajavõrdlust („muutus ajas", ideed 21.2) ei ole üldse** — raport on hetketõmmis. CSV/JSON/XLSX eksport käib sama
k-läve alt (`aggregateExport.js`).

---

## 3. Kerge nädalarütm ja küsimustikuväsimuse vältimine

### 3.1. Rütm on kutse — metoodiline leping

ideed 19.2 on siduv: kasutaja valib sageduse (nädal / kuu / pärast pingelist perioodi / ainult vajadusel) ja
kas ta üldse meeldetuletust tahab; „perioodiline kontroll ei tohi muutuda tööandja kohustuslikuks mõõtmiseks ega
töötaja jälgimiseks". Sellest tuleneb kolm kujundusreeglit, mis on invariandi jõuga (ptk 4.2 W-INV-3):

1. **Vaikeseade ei tekita survet.** Rütmi-meeldetuletus ei ole vaikimisi sees; esmakasutusel KÜSITAKSE (mitte ei
   eeldata). Täpne vaikeseade on TO-2 tooteotsus — siin fikseeritakse ainult keeld „vaikimisi sisse ilma
   küsimata". E-kiri on alati eraldi opt-in (U1 7.9).
2. **Vahelejätmine on võrdväärne tulemus.** `weekly_checkin_due` ack = kirje loomine VÕI dismiss (U1 7.9);
   vahelejäänud nädalad EI kuhju „võlaks", EI kuvata punase loendurina ega „streak'i" katkemisena. Nädalavaade
   näitab olemasolevaid kirjeid, mitte auke.
3. **Rütm on kasutaja, mitte kalendri oma.** „Reede lõuna" on näide, mitte süsteemi kell; meeldetuletuse
   nädalapäev/kellaaeg on kasutaja seadistus (TO-2 detail), dedupe käib ISO-nädala võtmega (`userId:weekKey`).

### 3.2. Nädalakirje kuju — kaks varianti (O-WB-1)

Visioon (RUUM-VIS 6.2 tooteotsuste rida) jätab lahtiseks: kas nädalakirje on eraldi kergvorm või Kiirkontrolli
evolutsioon. Variandid selle analüüsi valguses:

| | (a) Eraldi kergvorm „nädalakirje" | (b) Kiirkontrolli adaptiivne evolutsioon (SOOVITUS) |
|---|---|---|
| Andmemudel | uus `workflowType` (nt `weekly-note`) — lubatav (vastavuskaardi keeld puudutab olemasolevate LIITMIST), aga vajab koondi, testide, Ülevaate ja pilootfiltri laiendust | 0 uut tüüpi; kirje jääb `quick-check` + `scoringVersion` tõste, kui küsimused muutuvad (recovery-v2 pretsedent) |
| Metoodika | risk: kaks „kuidas läheb?" ust (Kiirkontroll JA nädalakirje) taastekitaks dubleerimise, mille tervikanalüüs 8.2 just kaotas (Kiirkontroll = AINUS sisenemis-mõõdik) | kooskõlas 8.2 rollijaotusega; tervikanalüüsi 8.3 adaptiivne tuum (3 küsimust: koormus/taastumine/tugi + TO-9 turvamarker) ONGI nädalakirje |
| Koondstatistika | uue tüübi baasjoon algab nullist | `quick-check` aegrida jääb katkematuks (toodangus küll 0 kirjet, aga leping-testid ja pilootfiltrid on tüübipõhised) |
| Kulu | uus vorm + uus lib + uued testid | E1 (neutraalne algseis) + E4 (sammud) juba plaanis; nädalakirje = sama töö |

Soovitus: **(b)** — nädalarütmi „kerge uks" on Kiirkontrolli 3-küsimuse tuum, mitte uus objekt. Kui hilisem
kogemus näitab, et nädala vabamärge (üks tekstiväli „mis sel nädalal juhtus") vajab oma kohta, on see
`standardizedFields`'i lisaväli, mitte uus tüüp.

### 3.3. Naasmispunkt — „uks avaneb sinna, kus pooleli jäi"

Visiooni lause on teostatav kolme olemasoleva andmega, ilma uue olekuta: (1) kinnitamata mustandid
(`output-drafts GET` on olemas, UI puudub); (2) viimane kirje + selle `recommendedActions` („eelmisel korral
märkisid X"); (3) avatud kontrollpunktid (`nextCheckpoint`/`reviewTime` väljad, mis täna salvestuvad ja unustatakse,
I4). Naasmisvaade = nende kolme loend ühe pinnana; „Jätka siit" continuity-kirje href peab osutama konkreetsele
mustandile/kirjele, mitte avalehele (V6 parandus). See on WB-V2-P0 sisu — null uut vormi, null migratsiooni
(RUUM-VIS 6.2 „väikseim kasulik prototüüp" ütleb sedasama).

### 3.4. Küsimustikuväsimuse kaitsemehhanismid (koondloend)

1. **≤1 minut põhirada:** 3 tuumaküsimust + turvamarker; lisaplokid avanevad ainult vihje peale (tervikanalüüs 8.3).
2. **Neutraalne algseis on rütmi eeltingimus (E1):** kui iga nädal avaneb vorm signaaliga „Kollane" enne ühtegi
   vastust (V4, runtime-tõendatud), muutub nädalarütm „süsteem ütleb igal nädalal, et mul on kollane" koormaks —
   E1 peab olema tehtud ENNE rütmi sisselülitamist (paketijärjekord, ptk 10).
3. **Signaali kalibratsioon:** „punane peaaegu kättesaamatu, kollane alati" (tervikanalüüs 7 p2) tähendab, et
   rütmi korduskasutuses signaal ei ütle midagi — kalibratsioon (või signaali kuvamise vähendamine „markerite
   loenduseks") kuulub E1/E4 skoopi.
4. **Sügavus valikuna, mitte vaikimisi:** nädalarütm EI ava kunagi automaatselt 10–14-väljalist vormi; süvavorm
   on soovitus põhjendusega („märkisid kolmandat nädalat unehäireid → kas tahad vaadata taastumise tuge?" —
   RUUM-VIS 6.2 AI-piiri näide).
5. **Kordumise väärtus nähtavaks:** ainus asi, mis hoiab nädalarütmi elus, on et eelmise nädala sisend MUUTUB
   järgmisel nädalal nähtavaks väärtuseks (võrdlus, kontrollpunkti „kas pidas?", trend) — ilma lugemiskihita
   (P0) on rütm ainult uus kohustus. Seepärast on paketijärjekorras lugemiskiht ENNE rütmi.

---

## 4. Privaatsusarhitektuur ja anti-jälgimise invariandid

### 4.1. Mis on juba õigesti [MAIN] (säilitada muutmata)

Serveripoolne omanik-skoop kõigil andmeteedel; `visibility:"private"` vaikimisi; roll+tellimuse värav; mustandi
kahe-linnukese kinnitusahel + CAS; Kovisiooni-üleandmise kolmas linnuke + serveripoolne detektor + atomaarsus +
idempotentsus; pilootkoond eraldi lehel, lubatud vaatajad, min-grupp, summutamine; algne kirje jääb alati
privaatseks (tervikanalüüs ptk 6 „tugevused"). K1 leping on selle juba üldistanud: PRIVATE-klassi definitsiooni
rida VIITAB WellbeingRecord'ile ja invariant 4.10 p8 nimetab Tööheaolu summutusmustri kogu platvormi referentsiks.

### 4.2. Anti-jälgimise invariandid V2-le (CASEWORK 3.6 klassi laiendus heaoluandmetele)

CASEWORK-A0 ptk 11.5 andis selle analüüsi piiriks, et refleksiooniandmete anti-jälgimise invariandid kehtivad
samal kujul heaoluandmetele. Normatiivne loend (W-INV):

1. **W-INV-1 — üksikkirje-keeld koondis:** ükski üksikkasutaja kirje, signaal ega marker ei jõua ühtegi koondisse,
   vaatesse ega eksporti ilma k-anonüümsuse läveta (K1 4.10 p8; teostuse augud ptk 4.3).
2. **W-INV-2 — kasutusfakti nähtamatus:** Tööheaolu KASUTAMISE fakt (kirjete olemasolu, arv, ajad, rütmi olek,
   meeldetuletuse olemasolu) ei ole nähtav kellelegi peale omaniku — ka adminile mitte (CASEWORK 3.6 p3 klass;
   U1 7.9 sõnaselgelt). See kehtib KA tehnilistele kõrvalradadele: U1 tõrke-/requeue-loend, logid, monitooring
   (vt ptk 7.2 maskimisreegel — täna lahtine auk tulevases TH-U1 paketis).
3. **W-INV-3 — rütm ilma surveta:** meeldetuletus ainult kasutaja seadistusel; vahelejätmine ei genereeri võlga;
   tööandja-poolset rütmi ei eksisteeri üheski vormis (ideed 19.2).
4. **W-INV-4 — trend ainult omanikule ja kirjeldavana:** mustrivaade näitab AINULT töötajale endale tema
   mustreid; mitte ühtegi üle-töötajate agregaati, edetabelit ega võrdlust ühelegi rollile (CASEWORK 3.6 p1
   analoog; RUUM-VIS „mitte-ehitada nr 8").
5. **W-INV-5 — eskaleerumine ainult kasutaja algatusel:** platvorm ei teavita kunagi kolmandat osapoolt
   heaolusignaalist (ptk 5.3).
6. **W-INV-6 — jagatav on ainult külmutatud+deidentifitseeritud+kinnitatud tuletis:** olemasolev mustand→kinnitus→
   handoff ahel on ainus jagamismuster (I2; K1 4.7); ka V2 uued väljundid (nt supervisiooni küsimus, TO-7)
   käivad sama ahela kaudu.
7. **W-INV-7 — descriptor ja sündmuse payload ilma heaolusisuta:** `wellbeing_space` descriptor ega ükski U1
   sündmus ei kanna workflowType'i, signaali, skoori ega vaba teksti (ptk 7.1/7.2; U1 6.4 payload-reegel).
8. **W-INV-8 — turvarajad rütmist väljas:** Töövägivald ja Raske juhtum jäävad eraldi kiirteks sissepääsudeks;
   neid ei peideta kunagi nädalarütmi, sammuvoo ega animatsiooni taha (tervikanalüüsi Lisa p3).

### 4.3. Üksikkirje-keelu teostus TÄNA — auguanalüüs (aggregate.js vs ideed 20.7)

`buildWellbeingAggregateDataset` [MAIN] loeb `aggregationEligible:true` + `visibility:"private"` kirjed
(max 10 000), arvutab `sampleSize` = **eristuvate omanike arv** (õige: inimesed, mitte kirjed) ja kui
`sampleSize < minimumGroupSize` (vaikimisi 3; `WELLBEING_MIN_GROUP_SIZE` env), tagastab `suppressed:true` ILMA
mõõdikuteta — kõik-või-mitte-midagi summutus. Mõõdikud: signaalide arvud+osakaalud, workflow/demand/resource/risk
loendurid. Võrdlus ideed 20.7 nõuetega:

| ideed 20.7 nõue | Seis [MAIN] | Auk |
|---|---|---|
| avaldamise minimaalne grupisuurus | OLEMAS (3, env-iga tõstetav) | — |
| eristuvate inimeste, mitte kirjete arvestamine | OLEMAS läves (distinct ownerUserId) | **A1: mõõdikud on kirjepõhised** — üks aktiivne kasutaja (nt 10 kirjet kolmest kasutajast) domineerib jaotusi; osakaalud arvutatakse `records.length`, mitte inimeste suhtes |
| väikeste gruppide summutamine | OLEMAS (kogu vastus) | — |
| täiendav summutamine (peidetut ei saa kogusummast arvutada) | **PUUDUB** | **A2: komplement-lahutus** — kaks lubatud filtripäringut (nt „kõik" ja „roleGroup=X"), mõlemad ≥3 kasutajaga, lubavad lahutamise teel tuletada 1–2 kasutaja alamgrupi tulemuse |
| ohtlike filtrikombinatsioonide keelamine | OSALINE (filtreid on vähe: periood/roleGroup/workflowType; lävi kehtib filtreeritud hulgale) | **A3: kitsas periood × roleGroup × workflowType** võimaldab sihitud viilutamist; keelureeglit ega päringulogi pole |
| vahemikud arvude asemel | PUUDUB | **A4: täpsed count'id ja share'id** ka väikseima lubatud grupi (3) peal |
| harva esinevate sündmuste eraldi kaitse | **PUUDUB** | **A5: `risk_event.X.count = 1`** avaldatakse, kui grupis on ≥3 kasutajat — „vähemalt üks kolmest on märkinud töövägivalla" on tundlik väide väikeses meeskonnas |
| pikem periood väikese meeskonna korral | PUUDUB automaatikana | summutatud vastus ei paku perioodi laiendust (ideed 21.5 teade on kujundamata) — UX-lünk, mitte leke |

**Hinnang:** sisepiloodi tööriistana (admin + käsitsi hallatud vaatajad, 0 päriskirjet) on teostus piisav ja
ideed 20.7 ütleb ise, et pilootlävi 3 EI ole automaatselt sobiv väliseks KOV/ESTA/ministeeriumi aruandluseks.
**V2 kõva reegel: ideed 21 KOV-kuukoondit EI avata praeguse agregaadi peal enne, kui A1–A5 on suletud ja väline
lävi on eraldi privaatsusanalüüsiga määratud (O-WB-3/O-WB-4).** Lisapuudus, mis tuleb sulgeda juba sisepiloodis:
**koondpäringutel puudub auditijälg** (kes, mis filtritega, millal pilootagregaati küsis) — A2/A3 kuritarvitus
oleks täna nähtamatu. NB: kuna agregaat arvutatakse igal päringul elusalt DB-st (materialiseeritud kihti pole),
toimib kirje kustutamine (P0 lugemisrada) automaatselt ka „koondist eemaldumisena" — TO-1 lubadus ei vaja
lisamehaanikat.

### 4.4. `aggregationEligible` ja TO-3 — nüüd on odav hetk

Väli on `@default(true)` ja UI-lülitit pole (V14; ideed 20.6 rikutud). Kuna toodangus on 0 kirjet, saab TO-3
otsustada (soovitus tervikanalüüsist: piloodi ajal (b) „vaikimisi sees + nähtav selgitus + väljalülitus", laiema
kasutuse eel (a) opt-in) **ilma ühegi olemasoleva kirje ümberklassifitseerimiseta**. Iga edasilükatud nädal pärast
esimesi päriskasutajaid muudab vaikeseademuutuse andmemigratsiooni- ja usaldusküsimuseks. Privaatsuslubaduse lause
(„sinu standardväljad võivad osaleda anonüümses koondis — saad selle välja lülitada") kuulub avalehe
privaatsusribale (E0 p7 / ptk 9 hierarhia).

---

## 5. Trend, tugi ja eskaleerumise piirid

### 5.1. Trend = kirjeldav muster kasutaja OMA kirjetest

Lubatud kuju (ideed 19.4): „Viimase kuu kolmes kontrollis oled märkinud vähese taastumise ja sagedased
katkestused." Nädalaruumi trend on sama lause aeg-teljel: nädalakaupa rühmitatud markerid + „mis on muutunud"
võrdlus eelmise kirjega (T1 teekond). Andmed on olemas (`createdAt` + markerid); arvutus on `overview.js` laiendus
nädala-lõikes. **Kaks eeltingimust enne trendi ehitamist:** (1) `periodSignal` „üks punane = punane periood" ja
signaalide kalibratsiooniviga (kollane künnisel 8, punane ≥18 praktiliselt kättesaamatu — tervikanalüüs 7 p2)
tuleb parandada, muidu trend võimendab müra; (2) trend vajab ≥2 kirjet — „insufficient_data" künnis (täna
puudub peale ≥1) peab muutuma ausaks („veel vara mustrit näidata").

Keelatud kuju (W-INV-4): üldskoor, „heaoluindeks", ajas kasvav/kahanev NUMBER, võrdlus teiste kasutajate või
„keskmisega", prognoos („järgmisel kuul oled punases").

### 5.2. AI roll ja piir

RUUM-VIS 6.2: AI peegeldab mustreid kasutaja OMA kirjetest, pakub vorme ja allikaid; EI diagnoosi, EI teavita
kedagi, EI hinda töövõimet. Sellele lisanduvad CASEWORK 3.4 pretsedendist tuletatud täpsustused: AI väljund on
alati ETTEPANEK, mis ei muutu kirjeks ilma kasutaja kinnituseta; AI ei skoori kasutaja valikuid tagantjärele
(„õigesti/valesti taastusid"); heaolu-AI ei kasuta RAG-i kliendinõustamise sisu, vaid metoodika-/tugiallikaid.
Deidentifitseerimise abi mustandi koostamisel on lubatud (sama piir mis Meetodipeeglil: abi toimub ENNE
Kovisiooni/Supervisiooni viimist, mitte nende sees).

### 5.3. Eskaleerumine — kolm rada, kõik kasutaja algatatud

1. **Professionaalne tugi:** kovisiooni sisend / supervisiooni küsimus (TO-7) / juhimemo — alati mustand→
   kinnitus→(handoff|kopeeritav tekst) ahel; platvorm ise ei saada midagi (I2). Juhimemo on teadlikult
   „kopeeritav tekst väljapoole", MITTE org-vaade platvormil.
2. **Abipalve:** `support_request` rada on olemas, aga adressaat on määratlemata (V7/TO-6) — kuni TO-6 vastuseta
   jääb see „sõnasta ja kopeeri" väljundiks; nädalaruum ei tohi luua muljet, et „abipalve läks kellelegi".
3. **Kriisisignaal:** kui kasutaja märgib ägeda ohu (Töövägivalla lävi, Raske juhtumi „vahetu oht"), kuvatakse
   abikontaktid ja töökoha ohutuskord KOHE, ilma salvestamis- või kinnitusväravata (W-INV-8). See on SAMA
   kriisirada, mis vestluses — VEST-A0 tõendas 4 katkekohta ja VEST-P0 parandab neid; Tööheaolu kriisikuva peab
   TAASKASUTAMA parandatud rada, mitte kloonima praegust (RUUM-VIS 6.2 „VEST-P0a järel"). U1 kaudu kriisisignaale
   EI kanaliseerita (U1 11.3 p3).

**Automaatset eskaleerumist ei ole üheski vormis:** mitte „3 punast nädalat → teavita juhti", mitte „töövägivalla
marker → teavita adminit", mitte „pole 2 kuud käinud → teavita kedagi". Ainus, mida süsteem ise teeb, on
kasutajale ENDALE nähtav pakkumine (soovitus põhjendusega) ja tema seadistatud meeldetuletus.

---

## 6. Nähtavusmaatriks: töötaja / organisatsioon / vaatleja / admin

| Vaataja | Üksikkirje / vabatekst | Mustand / jagamislugu | Trend („minu muster") | K-koond | Kasutusfakt (et üldse kasutab) |
|---|---|---|---|---|---|
| **Töötaja ise** | ✓ (P0 lugemisrada lisab; täna kirjuta-ainult) | ✓ (P0 lisab loendi + „viidi Kovisiooni" ajaloo) | ✓ (ainult tema oma) | ainult kui on ka pilootvaataja | ✓ |
| **Juht / organisatsioon** | ✗ IGAVESTI (arhitektuuriline keeld, U1 11.3 p1) | ✗ platvormil (kasutaja võib ISE memo teksti väljaspool platvormi edastada — see on tema tegu, mitte platvormi vaade) | ✗ | AINULT k-anonüümne, partnerleppe + O-WB-3/4 järel; ORG_META klass on K1-s [TULEVIK, blokeeritud org-otsusega] | ✗ (ideed 21.2: „juht ei näe, kes täitis või ei täitnud") |
| **Pilootvaataja** (WellbeingPilotScope viewer) | ✗ | ✗ | ✗ | ✓ (k≥3, oma roleGroup-skoobis) | ✗ (koond ei nimeta osalejaid; sampleSize on ainus arv) |
| **Admin** | ✗ sisuvaates (üksikkirje API-sid ei eksisteeri; K1 4.10 p7: admini eelvaade ei ava kunagi PRIVATE sisu) | ✗ | ✗ | ✓ [MAIN]: piiranguta filtritega (ptk 2.4) — vajab auditilogi (O-WB-2) | ⚠ kaudselt võimalik: DB-tase + tulevase U1 tõrkeraja kaudu — maskimisreegel on TH-U1 kohustus (ptk 7.2) |
| **Kovisioon/Supervisioon** | ainult kasutaja kinnitatud deidentifitseeritud tuletis (handoff; case_anchor) | handoff-staatus draft'i küljes (kasutaja oma) | ✗ | ✗ | kaudselt: juhtumi tekst ütleb, mida kasutaja ise ütles |

Kaks kohta, kus tabel EI ole täna koodiga kaetud ja mis on V2 kohustused: (1) töötaja enda veerg — lugemisrada
puudub (P0); (2) admini kaudse kasutusfakti rida — U1 tulevase tõrke-/requeue-loendi maskimine (ptk 7.2) ja
koondpäringute auditijälg (ptk 4.3). Mõlemad on lüngad OMANIKU KASUKS kehtestatud reeglites, mitte uued õigused
kellelegi teisele.

---

## 7. `wellbeing_space` adapter ja `weekly_checkin_due` — tehniline leping

### 7.1. Adapteri koondireeglid — [TECH-OPEN] vastus

K1-U1 jättis lahtiseks: „`wellbeing_space` adapteri koondireeglid enne TH-RUUM otsuseid" (4.12). K1-P0 registry
[K1-BRANCH] reserveerib kind'i, adapterit pole. Normatiivne ettepanek (rakendatav WB-V2-P1 paketis, PÄRAST K1-P0
PASS+merge'i; ei vaja ühtegi TO-otsust, sest on read-only ja sisutu):

- **Singleton-ruum kasutaja kohta:** `ref = {kind: "wellbeing_space", id: <ownerUserId>}`. Konteinertabelit pole
  (K1-U1 ptk 3: „adapter kirjete koondist, mitte uus tabel"); id = omaniku userId on ainuvõimalik püsiv võti.
  Adapter tagastab descriptor'i AINULT päringu teinud omanikule (`listWorkspaces(userId)` leping, K1 4.9);
  võõrale — sh adminile — 0 rida (K1-P0 testimuster „võõras kasutaja saab tühja loendi").
- **Descriptor'i väljad (W-INV-7 all — sisutu):**
  - `title`: staatiline `labelKey` (nt `wellbeing.space.title`) — MITTE kasutajateksti ega viimase kirje infot;
  - `ownerId = responsibleId = userId`; `participants: {active: 1, invited: 0}` alati (kutseid ei eksisteeri);
  - `lifecycle`: `ACTIVE` konstant V1-s; pärast TO-2 võib `PAUSED` = „rütm välja lülitatud" (K1 4.2.2 p5 ütleb
    täpselt õige semantika: PAUSED ei muuda õigusi ega nähtavust, ainult rütmi — meeldetuletused vaikivad).
    `CLOSED/ARCHIVED/DELETED` üleminekuid EI OLE (püsiruum; kaob ainult konto kustutamisega, cascade on skeemis);
  - `phase: null` (rütm ei ole faas; „faasideta ruumid väljastavad ainult asjakohased sündmused" — K1 4.8);
  - `goal: null`; `progress: null` (nädalate loendamine oleks skoor — W-INV-4 vastane);
  - `nextAction`: `null` V1-s; pärast TO-2/WB-V2-P2 = järgmine avatud kontrollpunkt kujul
    `{labelKey: "wellbeing.space.checkpoint", dueOn}` — kuupäev JAH, workflowType/sisu EI (kontrollpunkti
    OLEMASOLU on omanikule-ainult descriptor'is lubatud, sisu mitte);
  - `visibility: "PRIVATE"` — ainus lubatud väärtus; klassi tõstmine on keelatud (mitte värav, vaid puuduv tee);
  - `lastMeaningfulActivityAt`: max(viimane `WellbeingRecord.createdAt`, viimane `WellbeingOutputDraft.updatedAt`)
    — kaks indekseeritud päringut, arvuta-päringul-strateegia (K1 [TECH-OPEN] vaikevalik, continuity pretsedent);
  - `href: {action: "open_wellbeing", target: "wellbeing_space:<userId>"}` — action-register (U1 8.1) juba
    loetleb `open_wellbeing` olemasoleva marsruudi peale.
- **Mida adapter EI tee:** ei loe `standardizedFields`/vabatekste; ei arvuta signaale ega kirjete arvu; ei
  materialiseeri midagi; ei väljasta sündmusi (sündmused tulevad alles TH-U1 paketiga TO-2 järel). Kui kasutajal
  pole ühtegi kirjet ega mustandit, tagastab adapter descriptor'i ikkagi (ruum eksisteerib konto loomisest —
  „tühi tuba", `lastMeaningfulActivityAt: null`) — see hoiab töölaua/kompassi loogika lihtsana ega lekita
  „kas ta on kasutanud" fakti pindadele, mis descriptor'it näitavad… mis on nagunii ainult omaniku omad.

### 7.2. `weekly_checkin_due` leping (U1 7.9 baasil, TO-2 taga)

U1 kataloogi kirje on juba normatiivne: taimer-tootja; adressaat AINULT owner; meta `weekKey`; kanal N (✉ ainult
opt-in); action `open_wellbeing`; dedupe `userId:weekKey`; ack = nädala kirje loomine VÕI dismiss; retention
short30; risk — sündmuse OLEMASOLU ütleb „kasutab Tööheaolu", nähtav AINULT kasutajale endale, EI KUNAGI
koond-/org-projektsiooni üksikkirjena. Siia lisanduvad selle analüüsi täpsustused:

1. **Järjekord on lukus:** TO-2 otsus → U1-P0 (eelpöördumise vertikaal — Tööheaolu rütm KAALUTI ja LÜKATI
   esimese vertikaalina tagasi, sest ta on taimer- mitte äritehing, uus andmekategooria ja TO-2 taga; K1-U1 ptk 10
   võrdlustabel) → U1-P1 (teavituskeskus) → … → TH-U1 adapterite järjekorra lõpus. TO-2 keeld (U1 11.3 p2) on
   absoluutne: ühtegi heaolusündmust ei tekitata enne otsust ka „tehniliselt lihtsa" lisana.
2. **weekKey = Europe/Tallinn ISO-nädal** (nt `2026-W29`) — sama tallinnDate-muster, mida U1 7.2 taimer kasutab;
   dedupe garanteerib max 1 sündmuse nädalas ka taimeri topeltkäivitusel. Tehniline kandevõime on toodangus
   olemas: notifications-timer töötab iga ~5 min (K1-U1 kontroll 17.07).
3. **Tootmisreegel:** sündmus tekib AINULT kui (rütm on kasutaja seadistuses sees) JA (descriptor.lifecycle =
   ACTIVE, mitte PAUSED) JA (selle weekKey kohta pole veel kirjet). Kirje olemasolu kontroll on sama päring, mida
   adapter nagunii teeb — EI mingit uut „aktiivsuse jälgimise" kihti.
4. **Maskimisreegel (UUS, O-WB-2):** U1-P1 admin-tõrkeloend (UNKNOWN/FAILED + requeue) EI TOHI kuvada
   wellbeing-perekonna sündmusi kujul „tüüp + adressaat" — see paljastaks adminile kasutusfakti (W-INV-2
   rikkumine). TH-U1 pakett peab kas (a) kuvama wellbeing-tõrked ainult koondarvuna + jobId-põhise requeue'ga
   (identiteedita) või (b) jätma wellbeing-perekonna admin-loendist välja (ainult automaatne retry). Soovitus: (a).
5. **Ack-semantika:** „nädala kirje loomine" = mistahes WellbeingRecord selle weekKey sees (mitte ainult
   quick-check — kasutaja, kes avas Raske juhtumi, ON nädala eest „kohal"); dismiss on võrdväärne ja vaikne.

### 7.3. Kaks eri „TO-2" — nimeruumi hoiatus

Selles rajas tähendab TO-2 alati **Tööheaolu tervikanalüüsi ptk 12 otsust** (kontrollpunkt ja meeldetuletus — U1
sündmus + badge, ilma e-kirjata, ei mingit tööandja-rütmi). Rollivahetaja analüüsil on OMA TO-2 (admini eelvaate
väravasimulatsioon), mis puudutab Tööheaolu ainult värava kuvamise kaudu (RV-P2). Need on eri registrid — viidetes
kasutada „TO-2 (TH)" ja „TO-2 (RV)", kui kontekst pole ühene.

---

## 8. Seosed teiste analüüside ja moodulitega

| Moodul/analüüs | Seos ja siduv reegel |
|---|---|
| **Tööheaolu E0 [BRANCH]** | Samm 0: sõltumatu järelkontroll (fookused: detektori 3 kutsujat, dedupe-semantika, 200/201 leping — koondseis ptk 2) + merge. Kuni selleta on main-i ainus automaatne jätkutee (Kovisiooni handoff) standardmalliga katki (V17) ja `records.js` ümberkirjutus blokeerib P0 tööd samas failis (ptk 2.3). |
| **Tervikanalüüsi E-seeria [DOC]** | V2 paketid EI asenda E-seeriat, vaid kaardistuvad sellele: P0⊂E2, P2=E3, P4⊃E4, P5⊃E5 (ptk 10 tabel). E1 (neutraalne algseis) on rütmi eeltingimus (ptk 3.4). 10→7 vastavuskaardi kõvad reeglid (workflowType stringe ei liideta; recovery-v2 versioonimine; Töövägivald/Raske juhtum eraldi turvarajad) kehtivad V2-s muutmata. |
| **K1 [DOC + K1-BRANCH]** | `wellbeing_space` on RESERVED kind; adapter = ptk 7.1 leping (WB-V2-P1, K1-P0 PASS+merge järel). Tööheaolu on K1-le DOONOR nähtavusklassis „üksik privaatne + koond anonüümne" (K1 ptk 3) — st V2 privaatsusreeglid ei ole lokaalsed, nad on platvormi referents (K1 4.10 p8). PAUSED-semantika = rütm väljas (ptk 7.1). |
| **U1 [DOC]** | `weekly_checkin_due` on kataloogis 7.9, TO-2 taga; TH-U1 on adapterite järjekorra viimane; U1-P3 kanalieelistused katavad wellbeing.weekly e-posti opt-in'i. TO-2 keeld on U1 11.3 p2. Maskimisreegel (ptk 7.2 p4) tuleb TH-U1 lepingusse. |
| **CASEWORK-A0 [DOC]** | Piir 3.2: HardCaseWorkflow = töötaja KOORMUS, Meetodipeegel = töötaja VALIK; sama juhtum võib avada mõlemad kasutaja VALIKUL, andmesidet ega vaikeviiteid ei ole (heaoluandmed on eraldi tundlikkusklass). „Vajan tuge" järeldus refleksioonist = navigatsiooniline link heaoluvormi, mitte andmeside (3.5). Anti-jälgimise invariandid 3.6 = W-INV klassi allikas. |
| **Kovisioon** | Handoff-muster (case_anchor, privaatne eeltäide) on platvormi üleandmis-etalon — V2 ei muuda seda, ainult parandab (E0) ja teeb hiljem leitavaks („viidi Kovisiooni 12.07" kirje detailvaates, P0). WellbeingActionListi otse-`/kovisioon` tee kaob (E0 p3/V1). |
| **Supervisioon [SUP-BRANCH lokaalne]** | TO-7 (supervisiooni küsimuse väljund) on odav ja metoodiliselt põhjendatud; `recipientType:"supervisor"` on tüübistikus olemas. Üleandmis-rada (à la covision handoff) alles SUP-P0 merge järel; enne seda ainult tekst. |
| **ORG-A0 (register rida 8, ootab SEDA analüüsi)** | Sisendiks: org-analüütika AINUS lubatud heaoluandmete kuju on k-anonüümne koond A1–A5 aukude sulgemise ja O-WB-3/4 järel; individuaaltase on arhitektuuriliselt võimatu (mitte seadistatav); ORG_META klass (K1 4.4) on maksimaalne tulevik („toimumise fakt", mitte sisu) ja SEEGI blokeeritud org-otsusega. Ideed 21 kuukoond (sh „muutus ajas", mida pilotReport täna ei oska) on ORG-A0 + O-WB-4 skoop, mitte V2 oma. |
| **EXPORT-A0 [DOC]** | E-1 (GDPR-andmekoopia rada puudub) katab ka heaoluandmed — kasutaja „laadi oma andmed alla" (ideed 19.8) kuulub EXPORT-P0 radadele; V2 ei ehita eraldi eksporti, aga P0 lugemis-API on eelduskiht. PDF-ide Latin-1 piirang (kirillitsa) kehtib ka heaolu-väljundeile. |
| **VEST-A0/P0 [DOC]** | Kriisikontaktide kuva Tööheaolus taaskasutab vestluse parandatud kriisirada (VEST-P0a järel), mitte oma koopiat (ptk 5.3). |
| **A11Y-I18N [DOC]** | V2 UI-tekstid rangelt i18n (lint keelab hard-coded JSX-i); NB genereeritud mallid/memod on serveris teadlikult eestikeelsed kasutajatekstid — nädalakokkuvõtte genereerimine peab minema sama mallikihi kaudu, mitte uue hard-code'ina. Modal-/fookuseleping kehtib nädalaruumi dialoogidele. |
| **Rollivahetaja [DOC]** | Tööheaolu värav käib päris rolliga (admin läbi); S/P/T eelvaade ei simuleeri seda enne TO-2 (RV) — vt ptk 7.3 nimeruumi hoiatus. |
| **Ruumilise töölaua faasiliikumine / flight [memory + koondseis]** | Vormifaktor on TO-8: sammuvahetus enne, flight ainult siis, kui platvormiülene näitevalikuga prototüüp tõestab arusaadavuse võidu. Olemasolev `prototyybid/ruumilise-toolaua-faasiliikumise-prototuup.html` kasutab Tööheaolu ainult testandmestikuna; see ei ole eraldi heaolu demo. Kohustuslikud piirid (reduced-motion, olek URL-is, väravad/ohutustekstid animatsioonita) on fikseeritud koondseisu ptk 4 kujunduslepingus ja `prototyybid/README.md` näitelepingus. |

---

## 9. Otsuste register

### 9.1. Olemasolevad otsused (Tööheaolu tervikanalüüsi TO-1…TO-10) — seis

Otsustusleht `fable-5-tooheaolu-tooteotsuste-otsustusleht.md` on koondseisus kokku lepitud, aga **kirjutamata**;
ükski TO-1…TO-10 pole vastust saanud. V2 vaatest kriitiline alamhulk ja järjekord (koondseis ptk 5 kinnitusega):
TO-1 (kirjete elutsükkel — P0 kustutuse/muutmise kuju), **TO-2 (kontrollpunkt ja meeldetuletus — kogu rütmikihi
värav)**, TO-3 (aggregationEligible — otsusta enne esimesi päriskasutajaid, ptk 4.4), TO-4/TO-5 (töötubade
liitmine/taastumise v2 — P5), TO-8 (vormifaktor — P4). TO-6/TO-7/TO-9/TO-10 järgnevad.

### 9.2. Uued otsused (O-WB-1…O-WB-5)

| ID | Otsus | Variandid | Soovitus | Kellel | Viimane hetk |
|---|---|---|---|---|---|
| O-WB-1 | Nädalakirje kuju | (a) eraldi kergvorm (uus workflowType); (b) Kiirkontrolli adaptiivne evolutsioon | **(b)** — 0 uut tüüpi, aegrea järjepidevus, kooskõla 8.2 rollijaotusega (ptk 3.2) | tooteomanik | enne WB-V2-P2/P3 (rütmi sihtvorm) |
| O-WB-2 | Kasutusfakti kaitse tehnilistel kõrvalradadel: U1 admin-tõrkeloendi maskimine + koondpäringute auditilogi | maskimine (a) koondarv+jobId-requeue / (b) wellbeing välja admin-loendist; auditilogi (jah/ei) | **(a) + auditilogi jah** (olemasoleva admin-auditi mustri järgi) | tooteomanik + tehniline | maskimine: TH-U1 leping; auditilogi: enne pilootvaatajate lisamist |
| O-WB-3 | Heaoluandmete õiguslik klassifikatsioon ja välise koondi lävi | kas WellbeingRecord markerid (unehäired, kurnatus, trauma-kokkupuude) on GDPR art 9 terviseandmed; õiguslik alus; välise (KOV/ESTA/SoM) koondi anonüümsuslävi ja lisakaitsed (AKI pöördumatuse nõue, ideed 20.7/20.8) | õigusanalüüs ENNE mistahes org-suunalist koondit; sisepiloot k=3 jääb sisemiseks | õigusabi + tooteomanik | enne O-WB-4; ei blokeeri P0–P4 |
| O-WB-4 | KOV-kuukoondi (ideed 21) avamise tingimused | partnerlepe; töötajad näevad sama koondit (21.4); A1–A5 aukude sulgemine; „muutus ajas" teostus; aruandlussagedus (21.6) | BLOKEERITUD kuni O-WB-3 + org-mudel (ORG-A0) | tooteomanik + partner-KOV | enne ORG-suunalist arendust |
| O-WB-5 | Püsiruumi PAUSED = „rütm väljas" semantika kinnitus (K1 kaardistus) | (a) ACTIVE⇄PAUSED ainult rütmi tähenduses; (b) rütmiolek descriptor'ist väljas | **(a)** — kasutab K1 4.2.2 p5 täpselt sihitud tähendust | tooteomanik (koos TO-2-ga) | TH-U1 / WB-V2-P3 |

Ükski O-WB otsus ei blokeeri WB-V2-P0 ega P1 (ptk 10). TO-2 ja org-nähtavus jäävad tooteotsusteks — see analüüs
annab variandid ja soovitused, mitte vastuseid.

### 9.3. Metoodikaotsused (mitte-blokeerivad, aga kirjas)

Nädalarütmi metoodiline sisu: 3-küsimuse tuum (koormus/taastumine/tugi) + TO-9 turvamarker; taastumise v2
(eemaldumine + taastumiskogemused — I8/TO-5) on nädalarütmi väärtuse võti, sest „kas taastun?" on nädalaküsimus
nr 1; signaalikalibratsioon (ptk 5.1). Kõik kolm elavad tervikanalüüsi metoodikaosas — siin ainult järjestatud.

---

## 10. Rakenduspaketid (WB-V2-P0…P5)

Kaardistus tervikanalüüsi E-seeriale on sulgudes; „0 otsust" = ei sõltu ühestki TO/O-WB vastusest.

**Samm 0 (eeldus, mitte pakett): E0 sõltumatu järelkontroll + merge.** Fookused koondseisu ptk 2 järgi; ilma
selleta on handoff main-is katki ja `records.js` konfliktne (ptk 2.3).

**WB-V2-P0 — kirjete lugemisrada + „Minu kirjed" naasmisvaade (E2 tuum; ESIMENE, rakendusvalmis).**
- Sisu: `GET /api/wellbeing/records` (loend, omanik-skoop, workflowType/perioodi filter) + `GET/DELETE
  /api/wellbeing/records/[id]` (kustutus = päris kustutus; koondist eemaldumine on automaatne, sest agregaat
  arvutab elusalt — ptk 4.3); mustandite loend + kirje↔mustandi side UI-s (draft'il `sourceRecordId` juba skeemis;
  loomisel hakkab UI seda saatma); „Jätka siit" continuity href → konkreetne mustand/kirje (V6); Ülevaate laienemine
  „Minu muster ja kirjed" vaateks (kronoloogia + detail: vastused, signaal, soovitused, seotud mustandid,
  handoff-ajalugu „viidi Kovisiooni <kuupäev>").
- Piirid: 0 migratsiooni (mudelid+indeksid olemas); 0 lahtist otsust — loend+detail+kustutus on TO-1 KÕIGI
  variantide ühisosa; muutmine/„paranda uue kirjena" JÄÄB VÄLJA (TO-1 taga). Testid: omanik-skoop (võõras → 404,
  loendid ainult enda omad), kustutuse mõju koondile, API-leping (tests/wellbeing mustris). i18n täies mahus.
- Sõltuvused: E0 merge (failikonflikt + V17); EI sõltu K1-P0-st ega ühestki TO-st.
- Väärtus: sulgeb tervikanalüüsi juurvea nr 1 (ring ei sulgu), täidab ideed 19.8 lubadustest kolm (varasemate
  vaatamine, kustutamine, jagamise eraldatus nähtavana) ja on rütmikihi eeltingimus (ptk 3.4 p5).

**WB-V2-P1 — `wellbeing_space` K1 read-adapter (K1-P0 PASS+merge järel; 0 migratsiooni, 0 otsust).**
- Sisu: adapter ptk 7.1 koondireeglitega + registry kind RESERVED→SUPPORTED + K1-P0 mustri testid (descriptor-
  validaator, võõras→tühi loend, sisutuse kontroll: descriptor EI sisalda workflowType'i/signaale/arve).
- Sõltuvus: K1-P0 PASS+merge. Paralleelne P0-ga (eri failid).

**WB-V2-P2 — kontrollpunkt ja „kas pidas?" (E3; TO-1+TO-2 järel; 0 migratsiooni).**
- Ühine „järgmine samm + kontrollkuupäev" plokk; kirje avamisel „kas pidas?" märge (`followUp` JSON);
  soovituse „tehtud" olek. Badge „Minu kirjed" vaates (TO-2 badge-pool töötab ka ilma U1-ta).

**WB-V2-P3 — nädalarütm + `weekly_checkin_due` (TO-2 + U1-P0/P1 + TH-U1 järjekorras).**
- Rütmiseadistus (sees/väljas, päev; PAUSED-semantika O-WB-5); taimer-tootja ptk 7.2 lepinguga; admin-loendi
  maskimine (O-WB-2a); e-post ainult U1-P3 kanalieelistuste kaudu. EELDUS: E1 (neutraalne algseis) tehtud —
  rütm ilma selleta võimendab V4 viga (ptk 3.4 p2).

**WB-V2-P4 — nädalaruumi vormirütm ja naasmiskogemus (E4 + TO-8).**
- Töötoad 3–5 sammuks, olek URL-is, segmentnupud, ohutuslävi ette (W-INV-8); „uks avaneb sinna, kus pooleli jäi"
  täiskuju (naasmisvaade → viimane samm). Flight AINULT eraldi prototüübi tõestuse järel (koondseisu kujundusleping).

**WB-V2-P5 — ühendamised, uued väljundid ja koondi tugevdamine (E5; TO-3/4/5/7/9 + O-WB-2 auditilogi).**
- Töökorraldus-töötuba (TO-4), taastumise v2 (TO-5, `scoringVersion: recovery-v2`), supervisiooni küsimus (TO-7),
  turvamarker (TO-9), aggregationEligible lüliti+lause (TO-3); pilootagregaadi auditilogi; A1–A5 aukude sulgemise
  tehniline ettevalmistus (per-mõõdik läved, harv-sündmuse kaitse, vahemikud) — AVALIKUKS org-koondiks alles
  O-WB-3/4 järel.

Järjekorra põhjendus: P0 enne kõike (väärtus + kõigi järgnevate eeldus); P1 kohe kui K1-P0 valmis (paralleelne);
P2–P3 alles otsuste järel, sest rütm ilma lugemiskihita on tühi kohustus (ptk 3.4); P4 kujundus alles siis, kui
sisu töötab; P5 koos otsuste laine ja koondi tugevdamisega.

---

## 11. Lõppväljund

### 11.1. Peamised järeldused

1. **Püsiruum on lugemiskiht + rütm olemasoleva peal, mitte uus moodul.** Andmemudel kannab juba kõike (kirjed,
   soovitused, kontrollpunkti väljad, mustandi-side); puudu on kirjete lugemisrada (API+UI), naasmispunkt ja
   rütmisündmus. Konteinertabelit ei looda; `wellbeing_space` on adapter kirjete koondist (K1 kinnitatud kuju).
2. **Toodang on tühi — otsuste aken on lahti.** Serveri DB-s on 0 heaolukirjet: TO-3 vaikeseade,
   nädalakirje kuju (O-WB-1) ja signaalikalibratsioon on praegu tasuta muudatused; pärast esimesi päriskasutajaid
   muutuvad nad migratsiooni- ja usaldusküsimusteks. Samas tähendab null-kasutus, et k-agregaat pole kunagi päris
   andmetega töötanud — pilootlävi on testitud ainult testides.
3. **Anti-jälgimine on olemas põhiteel, aga mitte kõrvalradadel.** Omanik-skoop, k-lävi (eristuvatel inimestel) ja
   kõik-või-mitte-midagi summutus on korras; augud on mõõdiku-tasandil (A1 kirjepõhised jaotused, A2
   komplement-lahutus, A3 filtrikombod, A4 täpsed arvud, A5 harv sündmus count=1), koondpäringute auditijäljes ja
   tulevases U1 admin-tõrkerajas (kasutusfakti leke). KOV-kuukoond (ideed 21) EI avane enne nende sulgemist +
   õigusanalüüsi (O-WB-3/4) — ja „muutus ajas" puudub pilotReportist täielikult.
4. **Rütm on kutse ja tema väärtus tuleb lugemiskihist.** Meeldetuletus ilma „minu kirjete" vaateta oleks tühi
   kohustus; järjekord on lukus: lugemisrada (P0) → otsused (TO-1/TO-2) → rütm (P3). TO-2 keeld kehtib
   absoluutselt: ühtegi heaolusündmust ei tekitata enne tooteotsust; U1-P0 vertikaal on teadlikult eelpöördumine.
5. **E0 on samm 0.** Järelkontroll+merge avab nii ainsa automaatse jätkutee (V17) kui P0 töö `records.js`-is;
   otsustusleht TO-1…TO-10 on endiselt kirjutamata ja on tooteomaniku järgmine dokument.

### 11.2. Sõltuvused

| Sõltuvus | Suund |
|---|---|
| E0 järelkontroll + merge (`fable/tooheaolu-e0 @ fe8c7df2`, origin'is) | → WB-V2-P0 (records.js + V17) — samm 0 |
| K1-P0 PASS + merge (`ef5973c9`) | → WB-V2-P1 adapter (kind on registris RESERVED) |
| TO-1, TO-2 (otsustusleht kirjutamata) | → WB-V2-P2 (kontrollpunkt), P3 (rütm) |
| U1-P0 → U1-P1 → TH-U1 (adapterite järjekorra lõpp) | → WB-V2-P3 sündmusekiht |
| E1 (neutraalne algseis, tervikanalüüsi pakett) | → P3 rütmi sisselülitamine (V4 võimendus) |
| VEST-P0 kriisiraja parandused | → kriisikontaktide kuva taaskasutus (ptk 5.3) |
| O-WB-3 õigusanalüüs + ORG-A0 org-mudel | → O-WB-4 KOV-koond; EI blokeeri P0–P4 |
| SUP-P0 push+audit+merge | → supervisiooni ülekande-rada (enne seda TO-7 ainult tekstina) |
| EXPORT-P0 | → heaoluandmete GDPR-andmekoopia (P0 lugemis-API on eelduskiht) |

### 11.3. Otsuste register

TO-1…TO-10 [DOC, kõik lahtised — otsustusleht puudub]; uued O-WB-1…O-WB-5 (ptk 9.2): nädalakirje kuju (soovitus:
Kiirkontrolli evolutsioon), kasutusfakti kaitse kõrvalradadel (maskimine + auditilogi), heaoluandmete õiguslik
klassifikatsioon + välise koondi lävi, KOV-koondi tingimused [BLOKEERITUD], PAUSED-semantika. Ükski ei blokeeri
P0/P1. TO-2 ja org-nähtavus jäid tooteotsusteks, nagu ülesanne nõudis.

### 11.4. Esimene rakendusvalmis pakett

**WB-V2-P0 — kirjete lugemisrada + „Minu kirjed" naasmisvaade** (ptk 10): 3 uut/laiendatud API-rada (loend,
detail, kustutus) + mustandite loend + continuity-href parandus + Ülevaate laiendus; 0 migratsiooni, 0 lahtist
otsust (TO-1 variantide ühisosa); ainus eeldus on E0 järelkontroll+merge. Testid tests/wellbeing mustris
(omanik-skoop, kustutuse koondimõju, API-leping). See sulgeb tervikanalüüsi juurvea nr 1 ja on iga järgneva
rütmi-/ruumikihi eeltingimus.

### 11.5. Soovitatud järgmine süvaanalüüs

Master-registri järjekorras on rida 4 **SUP-V1-A0**, aga selle sõltuvus (SUP-P0 skeemialus push+audit) on
täitmata — SUP-P0 on endiselt ainult lokaalne haru. Seega soovitus: **KOV-V2-A0 — Kovisiooni uus ruumikogemus**
(rida 5; sõltuvused COMPLETE: Kovisiooni teadmistekaart + KOV-R seis). Märkus: ka ORG-A0 (rida 8) sõltuvused on
nüüd formaalselt täidetud (WELLBEING-V2-A0 + admini analüütika), aga tema sisu on O-WB-3/4 ja org-mudeli otsuste
taga — enne neid jääks analüüs spekulatiivseks.

### 11.6. Kopeeritav jätkamisülesanne

```
ÜLESANNE: KOV-V2-A0 — Kovisiooni uus ruumikogemus (süvaanalüüs)
Loe enne: docs/platvormi arendus/fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md (master-register);
docs/platvormi arendus/fable-5-kovisiooni-tervikvoo-teadmistekaart.md (tervikvoo kaart; CovisionWorkspace on
tõeallikas, CovisionSession.jsx on surnud demo); memory kovisiooni-louend (lõuendireegel + KOV-R R1-P0 rikkumine
covision-live.css shell overflow, parandus pakett P2); fable-5-ruumilise-platvormi-elav-visioon-ja-arendusteed.md
ptk 6.3 (lavastuse, mitte loogika vahetus; privaatne märkmik = suurim ruumiline lisandus; Kovisioon on K1 lepingu
DOONOR — loogikat ei kirjutata ümber ühiskihi nimel); fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md
ptk 3/4 (Kovisioon doonorina; ta EI väljasta ühtegi sündmust — KOV-U1 adapteripakett) ja ptk 10 (KOV-U1 4 sündmust);
fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md (kokkuvõtte kinnitusring);
fable-5-tooheaolu-v2-iganadalane-pusiruum.md ptk 8 (heaolu→Kovisiooni handoff kui etalon; E0 seis).
Kontrolli read-only: värske origin/main + live-server; KOV-R pakettide seis (kas R1-P0/P2 on liikunud);
CovisionWorkspace/covision-live.css tegelik kood; 8 etapi + purge + praktika-retsensiooni runtime-seis.
Analüüs peab käsitlema: lavastuse-ümberkujunduse piire (loogika = K1 doonor, ei muutu); privaatset märkmikku (K8);
etappide ruumilist esitust + lõuendireeglit; fassilitaatori rolli otsust; sündmuste väljastust (KOV-U1);
deidentifitseerimise kvaliteeti ja õppimisvara tagasi-identifitseerimise riski; seoseid Tööheaolu/Meetodipeegli
sisenditega; toote-/metoodikaotsuseid; esimest rakendusvalmis paketti.
Väljund: docs/platvormi arendus/fable-5-kovisioon-uus-ruumikogemus.md (edenemistabel alguses; lõpus järeldused,
sõltuvused, otsused, esimene pakett, järgmine analüüs, jätkamisülesanne, Jätkamispunkt, STATUS: COMPLETE).
Uuenda master-registrit alguses (IN_PROGRESS) ja lõpus (COMPLETE).
Reeglid: rakenduskoodi/skeemi/teste ei muudeta; ei commit'ita; määrdunud main-i ei puututa; Kovisiooni 8 etapi
loogika on K1 doonor — ümberkujundus on lavastus, mitte loogikavahetus; fassilitaatori roll ja transkriptsioon
on tooteotsused, mitte vaikimisi tehnilised valikud.
```

## Jätkamispunkt

- **Seis:** kõik 12 etappi TEHTUD (vt Edenemistabel); esimene täisring COMPLETE; dokument jääb elavaks — uus
  töökord lisab uue kuupäevaga rea, ei muuda ptk 0 lukustatud kontrolle.
- **Kontrollitud allikad (17.07.2026):** git fetch + origin/main `fe4eb4fa` = server (SSH: HEAD, puhas tööpuu,
  frontend/rag aktiivsed); **toodangu DB read-only loendus: WellbeingRecord=0, WellbeingOutputDraft=0,
  WellbeingPilotScope=0**; haru `fable/tooheaolu-e0 @ fe8c7df2` (kohalik+origin, 22 faili, regex+testid üle
  loetud); K1-P0 `ef5973c9` registry (`wellbeing_space` RESERVED); otsustusleht puudub. Kood [MAIN] täies mahus:
  aggregate.js (175 r), pilotAccess.js, schema (3 wellbeing-mudelit), API-route'ide loend, workspaceContinuity
  wellbeing-haru, overview periodSignal, pilotReport/aggregateExport pinnad. Dokumendid: tervikanalüüs 647 r
  (sh E0-leping + vastavuskaart), koondseis, K1-U1 ptk 3/4/7/10/11, RUUM-VIS 6.2, CASEWORK 3.2/3.6/11,
  ideed 19–21 täies mahus.
- **Peamised tulemused:** püsiruum = lugemiskiht + rütm olemasoleva peal (ptk 1); nelja kihi eristus + toodangu
  null-seisu aken (ptk 1.2/2); rütm kui kutse + küsimustikuväsimuse 5 kaitset (ptk 3); W-INV-1…8 + agregaadi
  auguanalüüs A1–A5 + auditilogi vajadus (ptk 4); trendi/toe/eskaleerumise piirid (ptk 5); nähtavusmaatriks
  (ptk 6); `wellbeing_space` adapteri koondireeglid ([TECH-OPEN] vastus) + `weekly_checkin_due` täpsustused sh
  maskimisreegel (ptk 7); O-WB-1…5 (ptk 9); paketid WB-V2-P0…P5, esimene = P0 lugemisrada (ptk 10/11.4).
- **Järgmine töökord siin dokumendis:** (1) kui E0 saab järelkontrolli+merge, märgi ptk 2.3 seis ja ava WB-V2-P0
  teostuseks; (2) kui K1-P0 merge'itakse, ava WB-V2-P1 (ptk 7.1 leping on teostusvalmis); (3) kui otsustusleht
  TO-1…TO-10 valmib, kanna vastused ptk 9.1 ja ava P2/P3 read; (4) kui O-WB-3 õigusanalüüs algab, anna talle ptk
  4.3 auguloend sisendiks; (5) iga muudatus = uus kuupäevaga rida, ptk 0 kontrolle ei muudeta.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; git/serveri/DB kontrollid on lukus 17.07 seisuga —
  uus sessioon teeb UUE kontrolli ja lisab uue rea, mitte ei muuda vana.

STATUS: COMPLETE
