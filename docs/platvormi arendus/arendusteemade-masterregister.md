# SotsiaalAI arendusteemade masterregister

STATUS: ACTIVE CANONICAL THEME REGISTER

Kuupäev: 2026-07-17  
Omanik: tooteomanik + arenduskoordinaator  
Eesmärk: koondada kõigi olemasolevate auditite, tehniliste tööplaanide ja tulevikuanalüüside arendusvõimalused **teemataseme arendusteks**, mitte üksikleidude või järjest väiksemate `P0.x` ülesannete jadaks.

---

## 0. Kuidas seda faili kasutada

See on järgmise Sol/Terra arendusteema valimise põhiregister. Teised dokumendid jäävad tõenditeks ja detailseteks töölepinguteks, kuid uut ülesannet ei tuletata enam otse ühe auditi üksikust leiust.

Registril on kolm paralleelset sissepääsu:

1. **teemaperekond** — millise kasutajaeesmärgi terviklik arendus valitakse;
2. **leht või tööpind** — milline T-teema vastutab konkreetse route'i või tulevase pinna eest;
3. **detailne T-kirje** — ulatus, olemasolev kood, sõltuvused, otsused ja järgmine tulemus.

Leht ei ole automaatselt arendusteema. Üks teema võib läbida mitut lehte ning ühel lehel võib olla mitu toetavat kihti. Igal lehel on siiski **üks põhivastutaja**, et sama UI-d ei arendataks paralleelselt eri pakettides.

Tõeallikate järjekord:

1. Git ja rakenduskood — haru, commit'i ja tegeliku teostuse tõeallikas;
2. `koordinaatori-handoff-2026-07-16.md` — aktiivne töö- ja serveriseis;
3. `platvormi-arendusprogramm-2026-07-17.md` — sõltuvused, väravad ja otsused;
4. käesolev masterregister — teemade ulatus ja arendusjärjekord;
5. valdkonnaauditid — leiud, detailne leping ja sisemised kontrollpunktid.

2026-07-17 kontrollitud Git-lähtekoht:

- kohalik põhitööpuu `main @ 0da4185bfd171b5b25d684aaed8fb5239a371275` on `origin/main`-ist maas ja kasutaja muudatustega määrdunud;
- `origin/main @ fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`;
- server `main @ fe4eb4fa` on kanoonilise handoff'i kontrollitud seis;
- põhitööpuud ei puhastata, stage'ita, commit'ita ega kasutata uue arendusteema baasina;
- merge'i ega deploy'd ei tehta ilma kasutaja eraldi loata.

Käesoleva faili koostamisel rakenduskoodi, skeemi, migratsioone ega teste ei muudetud. Auditites raporteeritud teste ei korratud.

---

## 1. Teemataseme arendusreegel

### 1.1. Üks teema = üks arendustöö

Vaikimisi saab iga funktsiooniteema:

- ühe arendusülesande;
- ühe haru ja worktree;
- ühe tervikliku skoobi;
- vajaduse korral mitu sisemist commit'i;
- ühe lõpparuande;
- ühe paketipõhise sihttestide ringi teostaja poolt.

Auditite tähised `P0.1`, `P0.2`, `P1.1`, `V3`, `L4`, `U10` jne on selle ühe teema sees **kontrollpunktid**, mitte automaatselt eraldi arendusülesanded.

### 1.2. Millal võib teema jagada

Eraldi arenduspiir on põhjendatud ainult siis, kui vähemalt üks järgnevatest on tõene:

1. osa ootab päris toote-, õigus-, metoodika- või organisatsiooniotsust;
2. osa nõuab eraldi migratsiooni või pöördumatut andmekorrektsiooni;
3. osa sõltub teisest veel valmimata teemast;
4. osa vajab teadlikult eraldi deploy'd või välise süsteemi aktiveerimist;
5. üks haru ei oleks enam turvaliselt ülevaadatav ega jätkatav.

Konto või mudelilimiidi lõpp ei loo uut teemat. Uus konto jätkab sama haru ja sama teemahandoff'i.

### 1.3. Kontrollide ressursireegel

- teostaja teeb teema sihttestid ja sihtlintimise ühe koondina;
- koordinaator kontrollib vastuvõtul ainult haru/ref'i, parent'i, commit'i ja remote SHA-d;
- koordinaator ei korda teostaja teste, buildi, runtime'i ega auditit;
- puuduv tõend märgitakse `NOT_PROVEN`, mitte ei käivitata automaatselt uut täisringi;
- täissviit, koosmõju, runtime ja sõltumatu koondaudit tehakse üks kord release candidate'i lõppväravas.

---

## 2. Olekusõnastik

| Olek | Tähendus |
|---|---|
| `LIVE_BASELINE` | vajalik tuum on `origin/main`-is ja serveris; seda ei ehitata uuesti |
| `CODE_READY_PARTIAL` | osa teemast on push'itud harus, kuid kogu teemaarendus pole lõpetatud ega integreeritud |
| `READY_THEME_BUILD` | teema leping on piisav ühe tervikliku arendustöö alustamiseks |
| `READY_AFTER_DEPENDENCY` | teema on piiritletud, kuid vajab nimetatud tehnilise sõltuvuse kättesaamist või samale harule stack'imist |
| `BLOCKED_DECISION` | terviklik teema vajab enne koodi toote-/õigus-/metoodikaotsust |
| `ANALYSIS_ACTIVE` | tulevikuteema süvaanalüüs käib; kooditööd veel ei avata |
| `ANALYSIS_READY` | analüüs on valmis; järgmine samm on teemataseme arenduse või otsuste avamine |
| `DEFERRED_BY_OWNER` | tooteomanik on teema teadlikult hilisemaks jätnud |
| `FINAL_GATE` | töö tehakse alles release candidate'i lõpus |

---

## 3. Olemasolevad koodivarad — ära tee uuesti

### 3.1. Main-is ja serveris suletud alus

| Vara | Seis | Teemad, mis seda kasutavad |
|---|---|---|
| RAG-P8.0 inventuur | `LIVE_BASELINE` | RAG, materjalid, allikavärskus |
| DOK-XTEN-P0 tenant-isolatsioon | `LIVE_BASELINE` | dokumendid, süvauuring, RAG |
| Help P0 avalik privaatsusprojektsioon | `LIVE_BASELINE` | Teenusekaart, abivahendus, jagamine |
| ADMIN-P0.1/P0.1a ohtlike toimingute väravad | `LIVE_BASELINE` | Admin V1 |
| U1-V0 teavitused + U2 continuity | `LIVE_BASELINE` | Töölaud, tööruumid, sündmused |
| U3/U4/U8 varasem usalduskiht | `LIVE_BASELINE` | jagamine, teenuseinfo värskus, RAG |
| Kovisiooni kaheksaetapiline põhivoog | `LIVE_BASELINE` | Kovisioon V2, koostöö, supervisioon |

### 3.2. Külmutatud või pooleldi valmis kood, mida teemaarendus peab taaskasutama

| Teema | Olemasolev haru/commit | Käsitlus |
|---|---|---|
| Vestluse kriisifail-safe | `043f0dce` stack `ef01fc42` peal | võta `CHAT-VOICE-V1` sisendiks; ära tee uuesti |
| Profiili e-posti reauth/rate-limit | `16e688f7` | võta `ACCOUNT-V1` sisendiks |
| K1 tööruumileping | `ef5973c9` | võta `WORKSPACE-EVENTS-V1` aluscommit'iks |
| Ekspordi ausus | `65c82d04` | võta `EXPORT-V1` alusena |
| Töölaua süvalingid | `a2393301` | võta `WORKBENCH-V1` alusena |
| Meta-pealkirjad/i18n parandus | `15ab986f` | võta `A11Y-I18N-V1` ja `PUBLIC-V1` alusena |
| PERF reservatsioonid/poll/worker-hoiatus | `5459f408` | võta `PERF-OPS-V1` alusena |
| Avalik sitemap | `8cae8712` | võta `PUBLIC-V1` alusena |
| RAG-QM parandused | `be96bcce` | võta `RAG-V1` kvaliteedikihi alusena |
| Makse plan-binding | `0aca8c4b` | võta `PAYMENTS-V1` alusena |
| Supervisiooni skeemialus | lokaalne `2fc826c4`, remote puudub | push'i/stack'i `SUPERVISION-V1` alguses; ära taasteosta |
| Tööheaolu E0 | `fe8c7df2` | võta `WELLBEING-V2` alusena |
| U6 isiklik otsing | `ada42497`, kontroll `9c465922` | võta `SEARCH-LANGUAGE-V1` alusena |
| U7 selge keel | `657d3c68`, kontroll `8eb50912` | võta `SEARCH-LANGUAGE-V1` alusena |
| RV-P0 kohalik diff | kasutaja määrdunud põhitööpuus | `QUARANTINED_LOCAL`; külmuta enne A11Y/RV puutepinda |
| Rolliteadlik osalejakutse | `ead1d8d1` | võta `ROOMS-CALLS-V1`/`COLLAB-V1` sisendiks pärast rollimaatriksi otsust |

## 3.3. Teemaperekondade kiirindeks

Kõik T01–T28 teemad kuuluvad ühte põhikodusse. Teema võib toetada ka teisi pindu, kuid teda ei dubleerita teise perekonda.

| Teemaperekond | Kasutaja põhieesmärk | Põhiteemad | Peamised tänased või tulevased pinnad |
|---|---|---|---|
| **A. Avalik sissepääs, konto ja ligipääs** | saada tootest aru, liituda, sisse logida ja oma kontot hallata | T02, T09, T10, T15 | avaleht, registreerimine, profiil, taastamine, tellimus, avalik info ja õigustekstid |
| **B. Igapäevane abi- ja töölaud** | küsida abi, näha muutusi ning jätkata pooleli tööd | T03, T04, T05, T17, T19 | vestlus, autentitud avaleht/töölaud, teavitused, otsing ja ühine ruumiline kest |
| **C. Teekond, teenused, juhtumitöö ja välitöö** | liikuda vajadusest tegevuseni ning teha professionaalset juhtumi- ja välitööd | T06, T11, T21, T24 | Teekond, eelpöördumised, Teenusekaart, tulevane juhtumitöö stuudio ja mobiilne välitöö |
| **D. Dokumendid, meedia, teadmus ja teisaldatavus** | luua, analüüsida, säilitada, leida ja eksportida töövara | T07, T08, T16, T28 | dokumendid, artefaktid, materjalid, RAG-haldus, failid/meedia ja andmekoopia |
| **E. Ruumid ja professionaalne ühistegevus** | kutsuda osalejaid, kohtuda, teha koostööd ja lõpetada suhe ausalt | T12, T13, T20, T22, T23 | ruumid/kõne, Kovisioon, koostöö, Supervisioon ja mentorlus |
| **F. Tööheaolu, organisatsioon ja piloot** | hoida professionaalset heaolu ning saada ainult turvalist koondpilti | T14, T25, T26 | Tööheaolu, tulevane organisatsioonivaade ja partnerpiloot |
| **G. Haldus, töökindlus ja release** | hallata platvormi turvaliselt ning viia tervik kontrollitult tootmisse | T01, T18, T27 | adminiala, workerid/timerid/monitooring ja release candidate'i lõppvärav |

## 3.4. Lehtede ja tööpindade vastutuskaart

Seda tabelit kasutatakse siis, kui lähteküsimus on „mida sellel lehel arendada?”. **Põhivastutaja** määrab arendusharu. Toetav teema annab lepingu või ühiskomponendi, kuid ei ava sama lehe jaoks eraldi paralleelset paketti.

Kõiki teemasid ei sunnita kunstlikult route'iks. Leheta platvormi- ja ops-teemad (näiteks T04, T08, T15, T16, T18, T26 ja T27) jõuavad lehele toetava lepingu, ühiskomponendi või release-väravana.

| Leht või tööpind | Kasutaja eesmärk | Põhivastutaja | Toetavad teemad | Paigutusreegel |
|---|---|---|---|---|
| `/`, `/meist`, `/autorilt`, `/voimalused`, `/hinnastus` | tootest, võimalustest ja hinnast aru saada | **T10 PUBLIC-V1** | T09, T15, T19 | avalikud lubadused, SEO, sisu ja onboarding kuuluvad T10-sse; makselepingu loogika jääb T09-sse |
| `/logo-eksport` | valmistada brändivara tehnilist eksporti | **T10 PUBLIC-V1** | T15, T19 | sisemine utiliit, mitte iseseisev tootefunktsioon ega uus T-teema |
| `/registreerimine` ja sisselogimiskiht | liituda õige rolli ja ausa ootusega | **T10 PUBLIC-V1** | T02, T09, T15, T19 | registreerimise kasutajatee on T10; konto turvatoimingud T02; ühine flight/dokk T19 |
| `/profiil`, `/uuenda-epost`, `/uuenda-pin`, `/taasta-parool`, `/taasta-parool/[token]` | hallata identiteeti ja taastada ligipääs | **T02 ACCOUNT-V1** | T09, T15 | profiili-/auth-lepingut ei jagata iga route'i eraldi ülesandeks |
| `/tellimus` | näha paketti, makseolekut, piiranguid ja lõpetamist | **T09 PAYMENTS-V1** | T02, T10, T15 | avalik hinnalubadus on T10, kuid tellimuse tegelik elutsükkel T09 |
| autentitud avaleht/töölaud, teavitused ja `/minu-jagamised` | näha, mis muutus ja mida edasi teha | **T05 WORKBENCH-V1** | T04, T16, T17, T19 | töölaud kuvab teiste teemade serveritõde ega loo nende domeeniolekuid |
| `/vestlus` | küsida, saada allikapõhine vastus ning käivitada töövoog | **T03 CHAT-VOICE-V1** | T06, T07, T11, T17, T28 | vestluse UX/voice/kriis T03; RAG elutsükkel ja allikad T28; loodav tööobjekt oma sihtteemas |
| `/teekond`, `/teekond/[id]` | hoida privaatset terviklugu ja valida järgmine samm | **T06 JOURNEY-V1** | T04, T05, T16, T19 | Teekond on kandja; ruumiline esitus kasutab T19, kuid ei muutu T19 omandiks |
| `/eelpoordumised` | saata, vastu võtta, jätkata ja lõpetada pöördumine | **T06 JOURNEY-V1** | T04, T05, T20, T21 | ametliku juhtumitöö piir ja hilisem stuudio tulevad T21-st; tänane eelpöördumise elutsükkel jääb T06-sse |
| `/documents`, `/documents/artifacts/[id]`, `/dokreziim` | analüüsida, koostada, võrrelda ja jätkata dokumenti | **T07 DOCUMENTS-RESEARCH-V1** | T08, T16, T19, T28 | failikandja T08, eksport T16 ja RAG T28 toetavad; Dokumendi koostamise ruumiline näide on T19 tarbija |
| `/materjalid` | hallata kasutaja või organisatsiooni teadmusmaterjale | **T07 DOCUMENTS-RESEARCH-V1** | T08, T16, T28 | kasutaja töövoog T07; failielutsükkel T08; ingest/teadmusbaas T28 |
| `/teenusekaart`, `/teenuseprofiil` ja Help-match'i kasutajatee | leida teenus, näha kättesaadavust ja luua nõusolekuga kontakt | **T11 SERVICE-MEDIATION-V1** | T04, T10, T12, T20, T25 | avalik privaatsusprojektsioon jääb alusvaraks; koostööruum tekib T12/T20 lepinguga |
| `/rooms`, `/ruum`, `/room/[roomId]`, `/join` | liituda ruumiga, suhelda, helistada ja lahkuda | **T12 ROOMS-CALLS-V1** | T04, T08, T15, T20 | liikmesus/kõne/salvestuskandja T12; professionaalsed ülesanded ja kinnitusring T20 |
| `/kovisioon`, `/lopetatud-juhtumid`, `/teemaseemned` | läbida kaheksa etappi ja kasutada kinnitatud järelväljundit | **T13 COVISION-V2** | T04, T12, T19, T20 | route'id kasutavad Kovisiooni domeenikomponente; ühine ruumiline kest ei võta seda domeeni üle |
| `/tooheaolu`, `/tooheaolu/[tool]`, `/tooheaolu/piloot` | teha privaatseid kirjeid, märgata muutust ja naasta nädalaselt | **T14 WELLBEING-V2** | T04, T05, T15, T19, T25 | individuaalne sisu jääb T14; organisatsioon saab hiljem ainult T25 k-anonüümse koondi |
| `/parimad-praktikad` | leida ja rakendada professionaalselt üle vaadatud tööviise | **T13 COVISION-V2** | T05, T20, T21, T28 | tänane route kasutab Kovisiooni EffectivePractices domeeni; tulevased koostöö- ja teadmusseosed jäävad toetavateks |
| `/kasutusjuhend`, `/privaatsustingimused`, `/kasutustingimused`, `/tooalase-kasutuse-raamistik` | mõista kasutust, õigusi ja piire | **T10 PUBLIC-V1** | T02, T08, T09, T15, T16, T19 | lõplik õigussisu ootab vastavate andmevoogude otsuseid; lugemiskiht kasutab T19 esitluslepingut |
| admini koondnavigeerimine, `/admin/analytics`, `/admin/wellbeing`, `/admin/service-availability`, `/admin/framework-acceptances` | hallata kasutajaid, ohte, koondeid ja operatiivset tööd | **T01 ADMIN-V1-CORE** | T09, T14, T18, T25 | admin on tegevuskeskus; organisatsiooni koondloogika jääb T25 ning ops-signaal T18 |
| `/admin/rag` ja `/admin/rag/*` | hallata allikaid, ingest'i, kvaliteeti ja värskust | **T28 RAG-V1** | T01, T07, T08, T18 | RAG-i domeen T28; admini ühine ohtlike toimingute värav T01 |
| ühine ruumiline dokk, faasiriba, Fookus/Ülevaade/Võrdlus ja flat/reduced-motion | kasutada sama töögrammatikat eri funktsioonides | **T19 SPATIAL-WORKSPACE-V1** | T05, T06, T07, T10, T13, T14 | T19 omab ainult korduskasutatavat esitlusmootorit; iga näite sisu ja domeen jääb oma põhiteemale |
| tulevane juhtumitöö stuudio ja Meetodipeegel | valmistada professionaalne juhtum ette ilma registrit dubleerimata | **T21 CASEWORK-V1** | T04, T06, T20, T24 | genogramm/ökokaart on sama võrgustikuandmestiku vaated, mitte eraldi lehed/teemad |
| tulevane Supervisiooni ruum | läbida leping, töö, kohtumised ja lõpetamine | **T22 SUPERVISION-V1** | T04, T12, T14, T19, T20 | üks terviklik supervisiooniteema; P1–P10 pole eraldi lehearendused |
| tulevane mentori leidmine ja mentorlussuhe | leida sobiv mentor ning hoida suhte elutsüklit | **T23 ESTA-MENTOR-V1** | T04, T12, T20, T22 | ESTA on partnerlus-/pädevuskiht, mitte vaikimisi uus põhiroll |
| tulevane mobiilne välitöökest | valmistada külastus ette, töötada offline ja anda järeltöö üle | **T24 FIELD-V1** | T04, T06, T07, T08, T21 | välitöö on olemasolevate tööruumide mobiilne kest, mitte eraldi andmesilo |
| tulevane organisatsiooni juhtimisvaade | näha ainult piisava rühma ausat koondtrendi | **T25 ORG-V1** | T01, T11, T14, T20 | individuaalsete töötajate kirjeid ega riskinimekirju ei looda |

### 3.4.1. Lehepõhise töö suunamisreegel

1. Leia tabelist lehe **põhivastutaja** ja ava töö selle T-teema sees.
2. Kui muudatus puudutab ainult toetava teema ühist lepingut, tee see toetava teema harus ning tarbiva lehe ühendus sama teema vastuvõtukriteeriumina.
3. Kui üks kasutajaeesmärk läbib mitut route'i, jääb see üheks teemaarenduseks.
4. Kui samal lehel on mitu sõltumatut domeeni, ei ühendata neid ainult failikattuvuse tõttu; integratsioonipuutepind kirjeldatakse mõlema teema lepingus.
5. ET/EN/RU, ligipääsetavus, mobiil, veaseisud ja reduced-motion on iga kasutajale nähtava teema Definition of Done, mitte uus hiline leheaudit.

---

## 4. Olemasoleva platvormi arendusteemad — T01–T19 ja T28

### T01 — `ADMIN-V1-CORE`: turvaline ja usaldusväärne adminiala

- **Olek:** `CODE_READY`; `codex/admin-v1-core @ f5e20b2190ec043b8c598cd81c77cc844575b10b`, otsene parent `fe4eb4fa`, local=remote, worktree puhas; 16 faili, +1183/−283; main/server/merge/deploy puuduvad.
- **Allikad:** admini analüütika audit; handoff; arendusprogramm.
- **Üks arendus:** teosta ühe haruna `P0.2 + P0.1b + P0.3 + P1.1 + P1.3 + P1.4`: kriisisündmuste count-only piir, masskustutuse serverivärav, ühtne e-posti projektsioon, basis/degradatsioon, ausad mõõdikud ja operatiivloendurid.
- **Sisemised võimalused:** materjalide/source-feedback/deletion/teenusekinnituste/eelpöördumiste tegevusloendurid; nulli ja puuduva andme eristus; audititav haldus.
- **Väljas päris põhjusel:** P0.4 capability-migratsioon ootab esimeste grantide nimekirja; P1.2 ChatLog-retention ootab tähtaegu. P2/P3 adminikeskus tuleb nende järel sama teema hilisema otsusega, mitte kuue mikropaketina.
- **Teostaja tõend:** 67/67 siht- ja regressioonitesti; muudetud JS/JSX lint 0/0; i18n ja diff-check PASS; runtime `not_run`; full suite, full lint, build ja sõltumatu audit jäid teadlikult T27 lõppväravasse.

### T02 — `ACCOUNT-V1`: konto, profiil, taastamine ja turvateavitused

- **Olek:** `CODE_READY @ 929793f1`; worktree `C:\Users\rauds\Desktop\SotsiaalAI-account-v1`, haru `codex/account-v1`, baas `fe4eb4fa`, local=remote ja worktree puhas. Kümne commit'i stack sisaldab PROF-P1 `16e688f7 → 69c11be0` cherry-pick'i ning T02 E2–E6 teostust.
- **Allikad:** profiili/konto elutsükli audit; A11Y audit; avalike pindade audit.
- **Üks arendus:** võta samasse stack'i PROF-P1; lõpeta verify-then-swap e-post, PIN-i/taastamise sessioonilõpp, turvateavitused, paroolita konto step-up, kustutuse `202 pending` aus seis, aegunud tellimuse seis ning profiilimodaalide ligipääsetavus.
- **Lukustatud V1 valikud:** verify-then-swap; vana aadressi turvateavitus; selgelt aegunud tellimuse seis; admini aktiivse eelvaaterolli läbipaistvus. Need on ülesandefailis kirjas, et teostus ei peatuks keset teemat eraldi otsuse taha.
- **Teostaja tõend:** 1314/1314 testid, muudetud/uutel failidel lint 0/0, i18n, Prisma validate, 93 migratsiooni ahel ja build PASS. Isolatsioonis sünteetiline verify-then-swap/reset runtime ning cleanup on `PROVEN`; brauseri klaviatuuri-/mobiili-QA jääb T27-sse `NOT_PROVEN`.
- **Piir:** konto retention ja maksekirjed lahendatakse koos T09/T16 otsustega, mitte profiili UI-s oletades. Main/server/merge/deploy puuduvad; täissviit ja sõltumatu koondkontroll jäävad T27-sse.

### T03 — `CHAT-VOICE-V1`: vestlus, kriisirada, hääl ja töövoogude käivitamine

- **Olek:** `READY_TO_ASSIGN`; tervikülesanne on `t03-chat-voice-v1-ulesanne.md`. T17 `ed95d6aa` on valmis aluscommit samasse stack'i.
- **Allikad:** vestlus/hääl/töövood; ligipääsetavus; jõudlus; usaldusmudel.
- **Üks arendus:** stack'i VEST-P0/P0a T17 lõppharu peale; lisa mitmekeelne kriisituvastus, aus retry/error/elutsükkel, tegelik Stop/abort, STT/TTS võrdsus, hääle veaseisud ja töövoo käivitamise püsivus.
- **Lukustatud V1 valikud:** kriisitekst, regex-tuvastus, ABORTED osalise püsistus, 4000 märgi piir, tasuta abi predikaat, TTS fallback ja sisuta logid on ülesandefailis siduvad.
- **Piir:** reaalaja kõne ruumis kuulub T12-sse; välitöö voice/OCR T24-sse.

### T04 — `WORKSPACE-EVENTS-V1`: ühine tööruumileping, sündmused ja teavitused

- **Olek:** `CODE_READY`; `codex/workspace-events-v1 @ 87d9a141ee609597844912dcc37ca949a13c3329`, parent K1 `ef5973c9`, local=remote, 32 faili +1797/−31, worktree puhas; main/server/merge/deploy puuduvad.
- **Allikad:** K1/U1 analüüs; RUUM-VIS; koostöö ja juhtumitöö analüüsid.
- **Üks arendus:** loo üks stack/haru, mis sisaldab K1 registry/descriptor/read-adaptereid, DomainEvent outbox'i, projektorit, eelpöördumise vertikaali, ack'i ja minimaalse teavituskeskuse; säilita olemasoleva U1-V0/U2 funktsioonid ega dubleeri neid.
- **Kinnitatud otsused:** K1 variant A; U1 variant B; retention `standard90/short30/audit_long`; esimene emitter eelpöördumise staatusemuutus.
- **Tulemus:** järgmised professionaalsed ruumid saavad sama eesmärgi/faasi/osaleja/sündmuse/järgmise sammu lepingu.

### T05 — `WORKBENCH-V1`: igapäevane töölaud, „Jätka siit” ja järeltegevused

- **Olek:** `CODE_READY @ 33f7fb82`; haru `codex/workbench-v1`, otsene parent/cherry-pick `6fa84ffa` (T04 `87d9a141` stack), local=remote ja worktree puhas. TÖÖLAUD-P1 `a2393301` on samaväärse patch-id-ga portitud; stack'i diff T04-st 16 faili `+679/−76`.
- **Teostaja tõend:** 49/49 siht- ja regressioonitesti, muudetud failide lint, ET/EN/RU, diff-check ja production build PASS; autentitud sünteetiline runtime läbitud kõigil neljal rollil, mobiilivaade ja cleanup 0 jäägiga. Täissviit, sõltumatu audit ning eraldi feature-flag-off runtime jäävad T27 koondväravasse.
- **Allikad:** igapäevase töölaua audit; U1/U2; A11Y; rollivaade.
- **Üks arendus:** taaskasuta süvalingiparandused; koonda rollipõhine prioriseerimine, continuity, badge'id, ootel tegevused, „mis muutus”, „Minu jagamised” ja teavituste tegevusnupud üheks töölauaks.
- **Piir:** töölaud ei loo uusi domeeniolekuid; ta kuvab teiste teemade serveritõendatud seisud.
- **Võimalused:** isiklik otsing T17-st, Animated List tüüpi „mis muutus” pind ja tööobjektide karussell ühise prototüübi lepinguga.

### T06 — `JOURNEY-V1`: Teekond, eelpöördumine ja adressaadi töövoog

- **Olek:** `CODE_READY @ f17a3c36`; haru `codex/journey-v1`, baas T05 `33f7fb827ec35bbde3e7ce5a190213eb1c1174dc`, neli järjestikust commit'i, local=remote, ahead/behind `0/0`, worktree puhas; diff 32 faili `+1062/−114`.
- **Teostaja tõend:** markertestid enne 5 punast ja pärast 14/14 rohelist; koond-sihttestid 52/52, ET/EN/RU, Prisma validate/client, lint, diff-check ja production build PASS. Autenditud kahe konto runtime, mobiili-/URL-/taastesond, O-J1=B kustutussond, runtime cleanup ning migratsiooni rakendamise DB-seis on `NOT_RUN/NOT_PROVEN` ja lähevad T27 koondväravasse.
- **Allikad:** Teekonna/eelpöördumise audit (ptk 13.5/14/15 = TK-P0 leping); O-TK9 otsustusdokument; TÖÖLAUD-A0; K1-U1; PILOT-A0 (G3 sõltuvus); eksport.
- **Üks arendus:** üks haru, üks lõppüleandmine, sisemised etapid E1–E7 (katavad TK-P0…P5 + TK-R1 kontrollpunktid; eraldi TK-pakette EI avata): E1 fail-closed jagamispiir serveris (otsustevaba; markeri-testid), E2 elutsükli teenuskiht (sündmuslogi, aus rada päris seostest, vestlusseos, kustutus-/taasavamis-API, T04 emit-punktid + K1 journeyAdapter), E3 kinnitatud O-J1=B SENT-retention (teema ainus migratsioon), E4 püsivus/kerimine/URL-sammud/autosave, E5 üks lävi + aus autorivoog + eksport/kustutus, E6 esitluskiht + ET/EN/RU + a11y + mobiil (flat; T19-valmidus ilma flightita), E7 koondkontroll + markerisondi kordus.
- **Kiire turvapiir:** märkimata Teekonna sisu ei tohi eelpöördumisse, abisoovi ega sündmuste metadata'sse sattuda; riskisignaalid ei liigu mitte ühegi võtmega; eelvaade ja saatmine kasutavad sama serveriprojektsiooni. TK-P0 leping on otsustevaba ja üheselt määratud (lepingu ptk 5); see on ühtlasi T26 piloodi G3 värava nimeline eeldus.
- **Otsused:** O-TK1…O-TK8 vaikimisi lepingud ning JOURNEY-D1 on kinnitatud 17.07.2026: **O-J1=B** (anonüümitud faktikiht + adressaadi märkmed), **O-J2** (iseseisev leht + rajasisene „← Eelmine samm") ja **O-J3** (2-sammuline kustutamine + eksport). Enne merge'i kinnitatakse ainult O-J1 §7.7 ja kustutusdialoogi täpne sõnastus.
- **Sõltuvused ja piirid:** kood on külmutatud `codex/journey-v1 @ f17a3c36`; T04 sündmuskihti, teavituskeskust ega T05 töölauda ei dubleeritud; T19 flight jäi välja; täissviit, autentitud runtime, migratsiooni päris rakendus ja sõltumatu koondkontroll tehakse T27 lõppväravas. Main/server/merge/deploy puuduvad.
- **Võimalus (hilisem järg, mitte V1):** vastuvõtja töölaud ja menetluseelne koostöö, mitte ainult autori vorm.

### T07 — `DOCUMENTS-RESEARCH-V1`: dokumendid, analüüs, koostamine ja süvauuring

- **Olek:** `READY_TO_ASSIGN`; kopeeritav tervikülesanne on [`t07-documents-research-v1-ulesanne.md`](./t07-documents-research-v1-ulesanne.md). T28 `RAG-V1 @ 8c3e5f77` ja T17 `ed95d6aa` on samasse stack'i võetavad aluscommit'id.
- **Allikad:** dokumentide/süvauuringu tervikvoog; FAILID; PERF; EXPORT; ruumilised faasid.
- **Üks arendus:** säilita DOK-XTEN isolatsioon; sulge serveris cross-tenant agent-dokumendi retrieval, tee genereeritud mustand püsivalt jätkatavaks, paranda Teekond→analüüs rada, kujunda analüüs leitavaks objektiks, ühtlusta owner-404, korista meeting-summary snapshotid ning tee süvauuring navigeerimisel jätkuvaks ja katkestatavalt ausaks.
- **Lukustatud V1 piir:** agent-dokumendid on rangelt omaniku-privaatsed, analüüs salvestub ainult kasutaja sõnaselgel toimingul ja uuring kasutab vaid olemasolevat RAG-i. Worker/flag'i aktiveerimine, päris korje ning T08 failielutsükkel on väljas.
- **Sõltuvus:** T17 lõppcommit; T28 `8c3e5f77`; research-worker T18/TE1 on runtime/ops-piir, mitte kooditöö blokk; faili elutsükkel T08 ja eksport T16 jäävad eraldi teemadeks.
- **Võimalus:** ühise ruumilise töölaua Dokumendi koostamise näide — versioonid, lähtedokumendid ja võrdlus, mitte eraldi lehedemo.

### T08 — `FILES-MEDIA-V1`: failide, heli, salvestiste ja meedia elutsükkel

- **Olek:** `DEFERRED_BY_OWNER`; analüüs valmis.
- **Allikad:** FAILID-A0; ruumide/kõne audit; dokumentide voog; eksport.
- **Üks arendus:** koonda P0…P3 teemaks: nõusoleku tagasivõtu kohene egress-stop ja temp-cleanup, RAG-versioon/delete, durable retention worker, parseri/ZIP/AV kaitse, atomaarne file-create/reconciler, transkriptsiooni CAS/quota, materjalide self-delete, admin source kompensatsioon, metadata minimeerimine ja owner-404.
- **Otsused:** O-F1…O-F12 — AV ulatus, aktiivsisu, kandjate retention, scheduler, audio saatus, artefaktivisioon ja jagatud koopiad.
- **Piir:** praegu ei avata; kui avatakse, tehakse ühe failielutsükli teemana, mitte ainult P0.1-na.

### T09 — `PAYMENTS-V1`: tellimus, maksed ja sponsoreeritud kasutus

- **Olek:** `READY_TO_ASSIGN`; tervikülesanne on `t09-payments-v1-ulesanne.md`. T02 `929793f1` konto-/step-up-alus on valmis.
- **Allikad:** maksete/tellimuse audit; avalikud hinnad; konto; admin.
- **Üks arendus:** stack'i P1a serveripoolne plan-binding; lisa reconciliation, webhook/callback idempotentsus, saladuste ja raw payload'i minimeerimine, PAST_DUE kasutajavaade, sponsoreeritud clawback, tühistuse/revoke leping ning e-kirja outbox/retry.
- **Lukustatud V1 valikud:** O-M1…O-M6 ja O-J1…O-J4 vaikemudel on ülesandefailis siduv; päris makseid, finantskorrektsiooni ega juristi/PCI lõppkinnitust see ei tee.
- **Piir:** päris makseid ega korrektsioone ei käivitata arendustöö osana.

### T10 — `PUBLIC-V1`: avalikud pinnad, liitumine, hinnastus, juhend ja õigusinfo

- **Olek:** `READY_TO_ASSIGN` — meta `15ab986f` ja sitemap `8cae8712` on aluscommit'id; kopeeritav tervikülesanne on [`t10-public-v1-ulesanne.md`](./t10-public-v1-ulesanne.md). T02 `929793f1` registreerimis-/LoginModal-puuteala on lõppenud.
- **Allikad:** avalike pindade audit; konto; maksed; A11Y; prototüüpide register.
- **Üks arendus:** stack'i meta- ja sitemap-alused; tee avaleht, võimalused, hinnastus ja registreerimine ühe-fookuse etapiteekonnaks ning Meist/Autorilt/juhend/õigusinfo leitavaks lugemiskihiks; lisa serveritõene registreerimise seis, rollipõhine onboarding, nõustumiste tõend, ausad disabled-seisud, juhendi avalik otsing ning SEO/jagamine.
- **Lukustatud V1 valikud:** registreerimislehe laadne avalik teekond; registreerimine vaikimisi suletud ja üks serveritõde; tasuta pakett jääb; kriisiinfo on praeguse käitumise suhtes aus; cookie-lokaadid ja lokaadineutraalne sitemap; `/autorilt` jääb nähtavaks; õigustekstid saavad tehnilise tõendi/versiooni, kuid mitte juristi lõplikku märget.
- **Õigusosa:** T10 parandab tõendatavad faktivead ja nõustumise tehnilise jälje; juristi sisu- ja töötlejarolli lõppkinnitus jääb eraldi `NOT_PROVEN` piiriks.

### T11 — `SERVICE-MEDIATION-V1`: Teenusekaart, teenuseprofiil ja abivahendus

- **Olek:** `CODE_READY @ 7acb7a33`; worktree `SotsiaalAI-service-mediation-v1`, remote=local; parent markerite cherry-pick `7afa8c37` T17 `ed95d6aa` järel. Tervikülesanne on `t11-service-mediation-v1-ulesanne.md`; runtime/migratsiooniahel jäävad T27 või sünteetilise DB väravasse.
- **Allikad:** Teenusekaardi/abivahenduse audit; U4/U5; avalik; koostöö.
- **Üks arendus:** säilita Help P0 projektsioon; stack'i markerite alus ning tee teenusekaart, teenuseprofiil ja nõusolekuga contact üheks turvaliseks kasutusteeks: liit-ID, pöördumine, vastaskirje valik, PENDING→ACCEPT/DECLINE, loend, klaster, marker/legend ja ausad olekud.
- **Lukustatud V1 valikud:** O1–O6 soovitatud vaikemudel on ülesandefailis siduv: markerite aluscommit, kaks kontaktirada, nõusolek enne ruumi, avalik teenuseinfo/ainult-autenditud peer-kuulutused, alati nähtav lehitsetav loend ja neli filtrit.
- **Võimalused:** teenuseinfo elav kättesaadavus U4, anonüümne puudujäägikoond U5, väline Maa- ja Ruumiameti 3D-link; 3D ei ole kunagi ainus kasutustee.

### T12 — `ROOMS-CALLS-V1`: ruumid, kutsed, kõne ja kohtumise kandjad

- **Olek:** `CODE_READY_PARTIAL` role-aware invite; kõne- ja salvestusvõlg analüüsitud.
- **Allikad:** RUUM-A0; vestlus; FAILID; COLLAB; A11Y.
- **Üks arendus:** koonda `/join`, `/rooms`, `/ruum`, `/room/[id]` üheks liikmesus- ja nõusolekuvooks; rolliteadlik kutse, vale konto/rolli käsitlus, mitme tabi kõneolek, veamask/rate-limit, terminaalse egressi finaliseerimine, retention/purge ja kohtumise kokkuvõtte kandja/revoke.
- **Otsused:** sponsoreeritava rolli maatriks, salvestise omanik/ligipääs/retention ja kokkuvõtte koopia saatus.
- **Piir:** professionaalne kinnitusring ja ülesanded kuuluvad T20 COLLAB-i, kuid kasutavad seda ruumituuma.

### T13 — `COVISION-V2`: Kovisiooni ruumiline tervik

- **Olek:** `DEFERRED_BY_OWNER`; töötav põhivoog on `LIVE_BASELINE`.
- **Allikad:** Kovisiooni teadmistekaart Q1/Q2/KOV-R; ruumilised faasid; prototüüpide register.
- **Üks arendus:** säilita 8-etapi serveriloogika; teosta R12 ühe teemana: aus sisenemine, ruumikest/dokk, kõrgusmudel, ankur/faasiriba, Ühine/Minu leht, etapikatted, privaatsusläved, mobiil/reduced-motion, URL/jätkamine ja visuaalne viimistlus.
- **Enne tootmiskoodi:** ühine näitevalikuga prototüüp, mitte ainult Kovisiooni demo.
- **Otsused:** R13-D1…D8; eriti ettevalmistusraja kärbe, kellaloogika ja refleksiooniringi serveripiir.

### T14 — `WELLBEING-V2`: Tööheaolu iganädalane püsiruum

- **Olek:** `CODE_READY_PARTIAL` E0 + `READY_AFTER_DEPENDENCY` V2.
- **Allikad:** Tööheaolu tervikanalüüs, E0, V2 püsiruum, K1/U1.
- **Üks arendus:** taaskasuta E0; koonda V2-P0…P5: „Minu kirjed”, K1 adapter, kontrollpunkt „kas pidas?”, nädalane rütm, vormide naasmiskogemus, uued väljundid ning koondi auditijälg.
- **Kõva privaatsuspiir:** juht/organisatsioon ei näe kunagi individuaalseid kirjeid; ainult k-anonüümne koond pärast otsuseid.
- **Otsused/sõltuvused:** TO-1…10, O-WB-1…5; K1/U1 alus on T04-s valmis `87d9a141`; E0 tuleb võtta stack'i, mitte uuesti analüüsida.

### T15 — `A11Y-I18N-V1`: ligipääsetavus, keelepariteet ja rollivaade

- **Olek:** `CODE_READY_PARTIAL` (P0 meta valmis; RV-P0 lokaalne karantiin).
- **Allikad:** A11Y/I18N audit; profiil; rollivahetaja; ruumilised prototüübid.
- **Üks arendus:** stack'i meta; külmuta RV-P0; loo ühine dialoogiprimitiiv (fookus, Escape, inert, restore), paranda landmarkid/h1/failiinput/login restore, registreerimise sildid, PIN live-region, kõnesõnumite i18n, hardcode ja mitmus.
- **Otsused:** O-AI-1…5 ja RV TO-1…7.
- **Püsiv DoD:** ET/EN/RU, klaviatuur, ekraanilugeja, 200% tekst, mobiil ja reduced-motion on sama teema, mitte hilisem eraldi „a11y audit”.

### T16 — `EXPORT-V1`: eksport, andmekoopia ja koostalitlus

- **Olek:** `IN_PROGRESS_PAUSED`; jätka ainult worktree's `C:\Users\rauds\Desktop\SotsiaalAI-export-v1`, harus `codex/export-v1 @ 4be2153f` (kohalik upstream puudub; remote SHA tõendamata). Jätkuülesanne on `t16-export-v1-jatkuulesanne.md`; T02 `929793f1` step-up'i ja kustutuse-eelse kontoaluse sõltuvus on täidetud.
- **Allikad:** ekspordi audit; Teekond; FAILID; K1; supervisioon.
- **Üks arendus:** taaskasuta aus PDF/DOCX/CSV/auditikiht; lisa `DataExportJob`, piiratud pindade register, manifest, kasutaja enda andmekoopia, valmisolekuteade ja kustutuse-eelne koopiavalik. Koostööpakett jääb järgmiseks etapiks.
- **Lukustatud V1 valikud:** MVP sisu, 7-päevane allalaadimine/ooteaken ja kolmandate isikute välistus on ülesandefailis siduvad; juristi lõpppiir on `NOT_PROVEN` ning blokeerib vaid välja jäetud sisu/rollout'i.
- **Piir:** andmekoopia ei ole sama mis üksiku artefakti allalaadimine; mõlemad peavad UI-s eristuma.

### T17 — `SEARCH-LANGUAGE-V1`: isiklik otsing ja selge keel

- **Olek:** `CODE_READY @ ed95d6aa`; worktree `C:\Users\rauds\Desktop\SotsiaalAI-search-language-v1`, haru `codex/search-language-v1`, baas `fe4eb4fa`, local=remote ja worktree puhas. Neli commit'i (`b4cab70`, `29ff771`, `adf75782`, `ed95d6aa`) sisaldavad U6/U7 alust ja tervikteemat.
- **Allikad:** U6/U7 paketid; töölaud; A11Y; vestlus.
- **Üks arendus:** too U6/U7 aluscommit'id ning tee neist üks kasutajale leitav teema: vestluseotsing + oma Teekonna/dokumendi turvaline metaotsing, selge keele režiim ning nõusolekupõhine „Selgita lihtsalt”.
- **Teostaja tõend:** 23 uut T17 testi + 30 U6/U7 testi, i18n, Prisma validate, lint, diff-check ja production build PASS. Kahe kasutajaga live-runtime jäi worktree DB/env puudumise tõttu `NOT_PROVEN`; turvapiirid on route-/ühiktestidega tõendatud.
- **Piir:** otsing ei laienda õigusi ega loo koondindeksit privaatse sisu üle; eelpöördumiste, ruumide, heaolu ja võõrast sisu ei otsita. Selge keel ei asenda kriisi-, õigus- ega ametlikku teksti. Fable'i kitsas lepingukontroll on `t17-search-language-v1-fable-piirikontroll.md`; see ei korda teostaja kontrolle.

### T18 — `PERF-OPS-V1`: jõudlus, kulu, workerid ja tehniline töökindlus

- **Olek:** `CODE_READY_PARTIAL` (`PERF-P0 @ 5459f408`).
- **Allikad:** jõudluse/kulu audit; FAILID; RAG; vestlus; OPS-programm.
- **Üks arendus:** taaskasuta reservatsiooni TTL/reaper/poll/worker-hoiatus; lisa repo-hallatud research-worker unit, Stop-semantika, RAG otsingueelarve/deadline, püsivad kuluagregaadid, SSE/poll koormus, vajalikud indeksid ning durable retention/orphan worker.
- **Otsused:** TE1 research-worker (soovitus eraldi systemd unit), T1 Stop-usage leping ja T4 kuluajaloo horisont.
- **Piir:** `OPS-FINAL-A0` ei kuulu siia; see jääb T27 lõppväravaks.

### T19 — `SPATIAL-WORKSPACE-V1`: ühine ruumiline töölaud ja esitlusmootor

- **Olek:** `ANALYSIS_READY`; alusproovid olemas, tootmiskoodi luba puudub.
- **Allikad:** RUUM-VIS; ruumilised lehefaasid; prototüüpide README; ruumilise kogemuse lähtekoht.
- **Üks arendus:** esmalt üks `ruumilise-toolaua-prototuup.html`, mille valikus on Dokumendi koostamine, Tööheaolu, Teekond, Kovisioon, Registreerimine ja lugemiskiht; sama dokk, faasiriba, Fookus/Ülevaade/Võrdlus, URL ja flat/reduced-motion kõigis näidetes.
- **Referentsid:** Carousel tööobjektide/versioonide sirvimiseks ja Animated List sündmuste/„mis muutus” jaoks; need pole uued lehed ega sõltuvusluba.
- **Pärast prototüüpi:** üks ühine production-komponentide teema, mitte iga route'i eraldi flight-demo.

### T28 — `RAG-V1`: teadmusbaasi elutsükkel, kvaliteet ja automaatne allikavärskus

- **Olek:** `CODE_READY @ 8c3e5f77`; worktree `C:\Users\rauds\Desktop\SotsiaalAI-rag-v1`, haru `codex/rag-v1`, baas T06 `f17a3c36`, otsene parent `77510353`, local=remote, tööpuu puhas, viis commit'i ja 35 faili `+6287/−18`. RAG-QM-P0/P0a on porditud commit'ideks `da7f08ac` → `bc4db109`, seejärel `39e721a9`, `77510353` ja `8c3e5f77`.
- **Allikad:** RAG materjalide elutsükkel/P8 tööplaan; RAG kvaliteet; FAILID; Admin.
- **Üks arendus:** stack'i kvaliteediparandused; teosta registry-reference allasurumine, turvaline URL-fetch/kandidaadid, `html_or_topic`, versioonivahetus, dedupe/adoption, seire/taimer, privaatsusturvaline baasjoon ja admini tööjärjekord.
- **Lõpptulemus:** iga master-registri kirje on täpselt ühes olekus ning registri PDF ei saa olla vastuse ainus sisuline allikas.
- **Otsused:** produktsioonivestluste sisuline kvaliteedihindamine vajab eraldi privacy-luba; masskorje ja adminivaade tulevad pärast põhilepingut.
- **U8 omanik:** allikavärskus kuulub siia; T07 tarbib RAG-i, T18 tagab workerite töökindluse.
- **Kontrollipiir:** RAG-QM auditit ei korrata eraldi; sihttestid/build teeb teostaja, täissviit ja sõltumatu koondkontroll jäävad T27-sse. Produktsioonivestluste sisu ega kasutajaandmeid ei loeta.
- **Lõppüleandmine:** registriviite allasurumine, supersede'itud versiooni retrieval-välistus, safe-fetch/dry-run, `html_or_topic` kinnitatud ingest, retry/dead-letter + advisory-lock/CAS, turvaline versioonivahetus/RAG_DELETE, recheck/gone/redirect seire ja mitteaktiveeritud systemd oneshot/timeri mallid on valmis. Teostaja tõend: 18/18 siht-/seotud RAG-testi, lint/i18n/Prisma/diff-check/build PASS; v1→v2→delete fixture-RAG runtime ja cleanup `PROVEN`. P8.6 päris kümne allika proovipakk on `NOT_DONE — OWNER_DECISION`; päris URL-korje, väline ingest ja timeri install/aktiveerimine on `NOT_RUN`; täissviit ja sõltumatu audit T27-s.

---

## 5. Tulevikufunktsioonide teemad — T20–T27

### T20 — `COLLAB-V1`: professionaalne ühistegevus, võrgustikutöö ja kohtumise ühisvaade

- **Olek:** `ANALYSIS_READY`; COLLAB-A0 complete.
- **Üks arendus:** osaleja-/jagamisleping, püsiruum, kinnitusring, ühine kohtumislaud, kokkulepped, ülesanded, kolleegile üleandmine U11 ja artefakt→ruumisõnum U10.
- **Sõltuvused:** T04 K1/U1 alus on valmis `87d9a141`; järele jääb T12 ruumituum.
- **Otsused:** O-CO-1…10; esimesena ruumi lõpetamine/omanikuvahetus, kinnitusring ja kliendi positsioon.
- **Piir:** kolmandate isikute püsikirjed ei kuulu V1-sse enne õigusanalüüsi.

### T21 — `CASEWORK-V1`: juhtumitugi, Meetodipeegel, genogramm ja ökokaart

- **Olek:** `ANALYSIS_READY`; CASEWORK-A0 complete.
- **Üks arendus:** privaatne juhtumitöö ettevalmistus, päritolumärgistus, STAR2 käsitsi ülekandmise olek, Meetodipeegel ning sama võrgustikuandmestiku genogrammi-/ökokaardivaated.
- **Sõltuvused:** T04 alus on valmis `87d9a141`; järele jääb T20. K1 sõnastik/adapterid on alus.
- **Otsused:** O-CW-1…10; eriti ametliku registri mittedubleerimine, STAR2 ülekande tõend, kliendi vaade ja kolmandate isikute õiguslik alus.
- **Kõva piir:** SotsiaalAI ei muutu STAR2 paralleelregistriks ega automaatseks riskiskoorijaks.

### T22 — `SUPERVISION-V1`: supervisiooni ruum ja elutsükkel

- **Olek:** `CODE_READY_PARTIAL`; SUP-P0 lokaalne commit olemas, remote puudub.
- **Üks arendus:** taaskasuta P0 skeem; teosta P1…P10 ühe teemaharuna: grant, protsess/kontrakt/kutse/nõusolek, eeskamber, teadlik jagamine, kohtumised, kinnitatud kokkuvõtted, sulgemine/purge/pakid, U1/U2, Tööheaolu üleandmine ja V0 UI.
- **Otsused:** grandi tõendusstandard enne päris granti, retention enne automaatkustutust ja piloodi ulatus enne rollout'i.
- **Piir:** P11 on release candidate'i teemakontroll, mitte uus arenduspakett.

### T23 — `ESTA-MENTOR-V1`: ESTA partnerlus ja mentorlus

- **Olek:** `IN_PROGRESS_LOCAL`; ESTA-MENTOR-A0 valmis (17.07.2026) — `fable-5-esta-ja-mentorlus.md` (12 ptk; kopeeritav arendusülesanne ptk 11). Teostus on juba olemas worktree's `C:\Users\rauds\Desktop\SotsiaalAI-esta-mentor-v1`, harus `codex/esta-mentor-v1 @ 33f7fb82` (T05 baas): 12 muudetud faili ning mentorluse API/UI/teenuse/migratsiooni uued failid on commit'imata; remote-haru puudub. Jätkata samast worktree'st, mitte avada uut haru.
- **Üks arendus:** teosta ühe haruna etapid E1–E9: mentoriprofiil + kataloogimoderatsioon, taotlus→mõlemapoolne nõusolek→suhe→kokkulepe, kohtumiste faktikirjed (valikuline Room-link), kahepoolselt kinnitatud kokkuvõtted, privaatmärkmed, Tööheaolu Alustaja toe sild (`recipientType="mentor"`), sulgemine+purge, teavitused olemasoleval NotificationEvent-kihil, ESTA seed-i admin-import nõusolekulepinguga, ET/EN/RU + a11y + admin.
- **Kinnitatud otsused (analüüsi vaikevalikud O-EM-1…10, ükski ei blokeeri):** mentorlus = COLLAB perekonna B kaitstud vorm oma konteineriga (8 uut mudelit; SUP tabelitega EI jagata); uut globaalset rolli EI looda; mentor pole kvalifikatsioonitiitel (kataloogivärav = admini moderatsioon); CLIENT väljas; 0 arveldust; kliendiandmete keeld suhtes; ESTA V1 = väline viide + mentori individuaalse nõusolekuga EXTERNAL_REFERENCE — **partnerilepet ega ESTA API-t V1 EI vaja** (partneri-neutraalsus tõendatud doc ptk 6.2).
- **Sõltuvused:** mitte ühtegi blokeerivat — K1-P0/U1-P0 EI ole eeldused (K1 adapter on tingimuslik etapp E6); T20/T22 on piirinaabrid, mitte eeldused.
- **Piir:** ESTA ei ole rakenduseroll; märgised/liikmestaatus/liikmeala/piirkonnaruumid/ESTA halduskonto = partnerlusleppe taga, V1-st väljas; grupimentorlus ja integreeritud kõne (`CallContextType.MENTORING` aktiveerimine) hilisemad.

### T24 — `FIELD-V1`: välitöö mobiilne kest

- **Olek:** `IN_PROGRESS` (Fable'i teostus pausil testide alguses; lõppcommit'i ega remote SHA-d pole veel üle antud). FIELD-A0 on valmis (17.07.2026) — `fable-5-valitoo-mobiilne-kest.md` (kopeeritav arendusülesanne ptk 11 sisaldab kinnitatud otsuste väärtusi ega nõua uusi otsuseid).
- **Üks arendus:** teosta ühe haruna E1–E10: 3 uut mudelit + `FIELD_PHOTO`, krüptitud IndexedDB ja 9-olekuline sünkroonimismasin, idempotentne/atomaarne serverirada, külastuse PWA-kest, tekst/voice/foto/OCR, review-värav, üleandmine olemasolevasse tööruumi, turvasignaal, retention ja ET/EN/RU+a11y+mobiil.
- **Kinnitatud otsused (FIELD-D0, 17.07.2026):** O-FD-1 retention = analüüsi ptk 4.5/4.8 vaikeväärtused (sünkroonitud kohalikud koopiad 7 p; saatmata sisu kuni 30 p + hoiatused, kustutus 37. päeval; serveris külastus ja märkmed 90 p pärast sulgemist; toorheli 7 p või kustutus kohe pärast kinnitatud transkripti); O-FD-2 V1 piloot = WebCrypto + seadme ekraanilukk + automaatne kustutamine (rakenduse PIN-lukk = laia kasutuselevõtu hilisem otsus); O-FD-3 turvasignaal = vabatahtlik, saaja = töötaja määratud usalduskontakt (asutuse keskne kontakt = T25 organisatsioonikihi hilisem võimalus). O-FD-4…10 fikseeriti analüüsis vaikevalikuga; lahtisi otsuseid ei ole.
- **Sõltuvused:** tehnilisi blokeerijaid pole; K1-P0, CASEWORK-P0 ja U1-P0 adapterid on tingimuslikud, mitte eeldused; haru avamise järjekord on koordinaatori otsus (ptk 8).
- **Piir:** välitöö on olemasolevate tööruumide mobiilne kest, mitte uus andmesilo; geolokatsiooni API-t V1 ei kasutata; kaamera/voice pole ainus kasutustee.

### T25 — `ORG-V1`: organisatsioonikiht, k-anonüümne analüütika ja baromeeter

- **Olek:** `ANALYSIS_READY`; ORG-A0 valmis (17.07.2026) — `fable-5-organisatsiooni-analuutika.md` (643 rida; kopeeritav arendusülesanne ptk 18).
- **Üks arendus:** teosta ühe haruna E1–E10: 5-tabeline õhuke organisatsiooni-/liikmesuskiht, liikmesuse-põhised capability'd, kutsed, org-kontekst, teenuseprofiili toimetamine, töö üleandmine, fikseeritud vaadetega külmutatud `k≥5` koondimootor, baromeeter/eksport ning ET/EN/RU+a11y+mobiil.
- **Kinnitatud vaikevalikud:** ORG-INV-1…12; hierarhiata tööüksus; URL-põhine org-kontekst; kirjele org-võtit ei lisata; fikseeritud koondivaated ja külmutatud perioodid; avalik org-kataloog, org-arveldus, ORG_META, indiviidi sooritus/riskinimekiri ja privaatkirjete ligipääs on väljas.
- **Sõltuvused:** tehnilisi blokeerijaid pole; partnerlepet ei vajata koodi kirjutamiseks. O-ORG-1/2/3 piiravad ainult päris org-i kinnitamist, heaolukoondi aktiveerimist ja päris ANALYTICS_VIEWER granti.
- **Kõva keeld:** individuaalne töötaja sooritus, riskinimekiri või tööandja ligipääs privaatkirjetele.

### T26 — `PILOT-PARTNER-V1`: esimene KOV-piloot ja partneri kasutuselevõtt

- **Olek:** `ANALYSIS_READY`; PILOT-PARTNER-A0 valmis (17.07.2026) — `fable-5-esimese-partnerpiloodi-ja-kasutuselevotu-mudel.md` (12-etapiline piloodimudel väravatega G0–G5, STOP-/rollback-rada, andmekaitse- ja lepingumaatriks, `k≥5` mõõdikuleping ilma privaatset sisu lugemata).
- **Üks töö:** viia üks partner 12-etapilise mudeli kaudu hindamisest teadliku laienemisotsuseni: partnerihindamine → skoobivalik → leping/DPIA → partneri piloodijuht → sünteetiline proov → koolitus → piiratud päris piloot → iganädalane seire → vahehindamine → jätka/muuda/peata → lõpetamine (eksport+kustutus+sulgemine) → laienemisotsus. Soovitatud väikseim ulatus: 1 KOV sotsiaaltööosakond, 2–4 töötajat + 10–30 pöördujat, olemasolev eelpöördumise täisrada (vestlus→Teekond→eelpöördumine→vastuvõtulaud→ruum→U10 kokkuvõte→U12/U3); teenuseosutaja, salvestus, maksed, süvauuring ja kõik T20–T25 teemad väljas.
- **Kinnitamata otsused:** O-PP-1 (partneriprofiil + funktsioonikomplekt; vaikevalik doc ptk 3), O-PP-2 (õiguslik pakett: töötlejarollid „kaks iseseisvat vastutavat töötlejat", eelpöördumise menetlusstaatus, DPIA, pilootleping), O-PP-3 (päris aktiveerimise värav G3 checklisti PASS-iga). Ükski ei blokeeri ettevalmistust; kõik blokeerivad päris kasutajate kaasamist.
- **Sõltuvused:** valitud funktsioonikomplekt peab olema release candidate'is (T27 OPS-värav); soovitatud skoobi nimelised eeldused on TK-P0 jagamispiir (T06 — serveris lekkega rada piloodi tuumvoos) ja U1-P0 mõõtesündmused (T04); ORG-V1/FIELD-V1/ESTA-MENTOR-V1 EI ole eeldused. Teise organisatsiooni liitumine on ORG-V1 ehituspäästik.
- **Piir:** piloot ei luba tootmisandmeid auditiks ega laia rollout'i vaikimisi; turva-/privaatsusintsident peatab piloodi (STOP-rada); mõõdikud ainult sündmustest/loenduritest/vabatahtlikust tagasisidest; Tööheaolu kasutusfakti ei mõõdeta. Uut koodi enne release candidate'i ei vajata — PILOT-PARTNER-V1 kood on ainult tingimuslik väike tagasisidevormide pakett omaniku soovil (doc ptk 16).

### T27 — `OPS-RELEASE-FINAL`: operatiivne lõppvalmidus

- **Olek:** `FINAL_GATE`; `OPS-FINAL-A0` ei alga praegu.
- **Üks lõppvärav:** release candidate'i koondtest, sõltumatu koondaudit, migratsiooniahel, backup/restore, workerid/timerid, health-check'id, monitooring, alertide omanik, deploy/rollback ja post-deploy smoke.
- **Käivitaja:** ainult tooteomanik, kui platvorm on funktsionaalselt terviklik.

---

## 6. Avastamata vajaduste U1–U12 paigutus

Ükski U-number ei saa enam automaatselt eraldi arenduspaketti; ta kuulub järgmisse teemasse.

| Vajadus | Teema | Arendusroll |
|---|---|---|
| U1 sündmused ja teavitused | T04 | DomainEvent, projektor, teavituskeskus |
| U2 „Jätka siit” | T05 | serveritõendatud continuity ja süvalink |
| U3 jagamise tagasivõtmine | T04/T16/T20 | kandja, revoke ja auditijälg |
| U4 teenuse elav kättesaadavus | T11 | kinnitus, aegumine, meeldetuletus |
| U5 teenusepuudujäägi anonüümne koond | T11/T25 | k-lävi ja organisatsioonikoond |
| U6 isiklik otsing | T17 | omandipiiriga platvormiotsing |
| U7 selge keel | T17 | kasutaja valitav esitusrežiim |
| U8 allikavärskus | T28 | allika kontroll, kandidaat, review/apply ja re-ingest |
| U9 rolliteadlik osalejakutse | T12/T20 | rollimaatriks ja kutseleping |
| U10 artefakt ruumisõnumiks | T20 | 0-uue-mudeli kohtumise ühisvaate vertikaal |
| U11 kolleegile üleandmine | T20/T21 | vastutuse üleminek ja audit |
| U12 „Minu jagamised” | T04/T16 | nähtavus, aegumine, revoke ja kandja |

---

## 7. Otsusepered, mis võivad teemat päriselt piirata

| Teema | Otsusepere | Mida otsus avab |
|---|---|---|
| T01 Admin | grantide nimekiri; ChatLog retention; reset/mass-e-kirja lõppsaatus | capability, retention ja Admin V1 P2/P3 |
| T02 Konto | e-posti vahetusmudel; turvateavitused; aegunud tellimus | konto elutsükli lõppkuju |
| T03 Vestlus | kriisitekst; Stop-usage; kõnesõnumi keel | VEST/voice lõppleping |
| T06 Teekond | O-TK1…9 | kustutamine, jagamine, sündmused ja esitlus |
| T08 Failid | O-F1…12 | AV, retention, audio, versioonid ja jagatud koopiad |
| T09 Maksed | O-M1…6 + O-J1…4 | reconciliation, tühistus, clawback, token/PII |
| T10 Avalik | O-AV1…6 + O-AV-J1…3 | tõesed hinnad/juhend/SEO/õigustekst |
| T11 Teenusekaart | O1…O6 | nõusolek, avalikkus, loend, filtrid, markerid |
| T12 Ruumid | rollimaatriks; salvestise/kokkuvõtte kandja | kutsed, egress ja revoke |
| T13 Kovisioon | R13-D1…D8 | ruumilise V2 lõppmudel |
| T14 Tööheaolu | TO-1…10 + O-WB-1…5 | rütm, väljundid, koond ja integratsioonid |
| T15 A11Y/RV | O-AI-1…5 + RV TO-1…7 | tõlkestrateegia, vormid, rollivaade |
| T16 Eksport | O-E1…7 + O-TK9 | andmekoopia, kustutuseelne eksport, koostööpakett |
| T18 PERF | TE1, T1, T4 | worker, Stop-leping ja kuluajalugu |
| T20 COLLAB | O-CO-1…10 | püsiruum, kinnitusring ja kliendi positsioon |
| T21 CASEWORK | O-CW-1…10 | STAR2 piir, Meetodipeegel ja kolmanda isiku kaardid |
| T22 Supervisioon | retention, grandi tõend, piloodi ulatus | päris grant, purge ja rollout |
| T23 ESTA | partnerlus- ja vastutusmudel | mentorlussuhe ja organisatsioonidevaheline kasutus |
| T25 ORG | org-mudel, k-lävi, koondi omanik | aus organisatsioonianalüütika |

Otsuseta alametappe võib teha ainult siis, kui need jäävad sama teemaharusse või on juba olemasolev külmutatud kood. Neist ei tekitata vaikimisi uut ülesannete jada.

---

## 8. Soovitatud teemajärjekord

See on teemade, mitte auditite või testiringide järjekord.

### Nüüd

1. **T01 `ADMIN-V1-CORE`** — `CODE_READY @ f5e20b21`; hoia haru muutmata ja lisa T27 release-kontrolli.
2. **T23 `ESTA-MENTOR-V1`, T24 `FIELD-V1` ja T25 `ORG-V1` analüüsid on VALMIS.** T23 on `IN_PROGRESS_LOCAL` olemasolevas mentorluse worktree's, T24 on `IN_PROGRESS` samas Fable'i worktree's ning T25 on `ANALYSIS_READY`. FIELD-D0 otsustusring suleti 17.07.2026 (O-FD-1/2/3 kinnitatud analüüsi vaikevalikutega). Uut sõltumatut süvaanalüüsi ei avata enne SUP-V1-A0 sõltuvuse täitumist või KOV-V2-A0 taasavamist.

### Järgmised otsuseta või stack'itavad teemad

3. **T04 `WORKSPACE-EVENTS-V1`** — `CODE_READY @ 87d9a141`; hoia haru muutmata ja säilita täissviit/sõltumatu audit T27 koondväravaks.
4. **T05 `WORKBENCH-V1`** — `CODE_READY @ 33f7fb82`; hoia haru muutmata kuni T27 koondväravani.
5. **T06 `JOURNEY-V1`** — `CODE_READY @ f17a3c36`; hoia haru muutmata ning sulge runtime-/migratsioonitõend T27 koondväravas.
6. **T28 `RAG-V1`** — `CODE_READY @ 8c3e5f77`; hoia haru muutmata T27 koondväravani. P8.6 päris proovipakk avaneb ainult omaniku ingest-otsusega.
7. **T09 `PAYMENTS-V1`** — kasuta valmis plan-binding'ut ning lahenda enne ülejäänut makseotsused.
8. **T02/T03 `ACCOUNT-V1` ja `CHAT-VOICE-V1`** — lõpeta olemasolevad valmis turvaharud teematasemel.

### Pärast aluskihti

9. T07 Dokumendid/süvauuring, T10 Avalik/onboarding, T11 Teenusekaart, T12 Ruumid/kõne, T15 A11Y/I18N, T16 Eksport, T17 Otsing/selge keel ja T18 PERF/OPS.
10. T14 Tööheaolu V2 ja T22 Supervisioon, kasutades T04 aluskihti.
11. T20 COLLAB ja T21 CASEWORK.
12. T24 FIELD on otsustevalmis (`READY_THEME_BUILD`; FIELD-D0 suletud 17.07.2026); T25 ORG on analüüsivalmis ja võib avaneda hilisemas organisatsioonilaines ilma tehnilise eelduseta.
12. T13 Kovisioon V2 siis, kui tooteomanik selle uuesti avab.
13. T26 piloot ja T27 release-final alles funktsionaalselt tervikliku kandidaadi järel.

T08 FAILID jääb tooteomaniku otsusel hilisemaks, kuid selle riskid ei kao registrist.

---

## 9. Auditite ja analüüside katvusindeks

| Allikadokument | Registri teema(d) |
|---|---|
| `fable-5-admini-analuutika-haldus-ja-koondvaated.md` | T01, T25 |
| `fable-5-andmete-eksport-teisaldatavus-ja-koostalitlus.md` | T16 |
| `fable-5-avalikud-turunduslikud-ja-oiguslikud-pinnad.md` | T10 |
| `fable-5-avastamata-vajadused-ja-uued-voimalused.md` | T04–T06, T11, T17, T20, T24, T25, T28 |
| `fable-5-esta-ja-mentorlus.md` | T23 |
| `fable-5-organisatsiooni-analuutika.md` | T25 |
| `fable-5-valitoo-mobiilne-kest.md` | T24 |
| `fable-5-failide-ja-meedia-elutsukkel.md` | T08, T12, T18 |
| `fable-5-igapaevane-toolaud-ja-jareltegevused.md` | T05 |
| `fable-5-joudlus-kulu-ja-skaleeruvus.md` | T18 |
| `fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` | T21 |
| `fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md` | T04 |
| `fable-5-kovisiooni-tervikvoo-teadmistekaart.md` | T13 |
| `fable-5-ligipaasetavus-keelepariteet-ja-kasutatavus.md` | T15 |
| `fable-5-lisavastused-organisatsioon-ja-piloot.md` | T25, T26 |
| `fable-5-maksed-tellimus-ja-sponsoreeritud-kasutus.md` | T09 |
| `fable-5-platvormi-loogika-brief.md` | kõigi teemade algne platvormipiir ja rollid |
| `fable-5-platvormiloogika-ulevaade.md` | T04, T05, T11, T12, T17; tänase mooduliseose ajalooline alus |
| `fable-5-platvormiloogika-max-taiendus.md` | T04, T05, T11, T13, T17; varasemate võimaluste ja puuduste süntees |
| `fable-5-platvormiloogika-max-jarelkontroll.md` | registri `LIVE_BASELINE` ja valmis/pooleli piiride ajalooline kontroll |
| `fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md` | T20 |
| `fable-5-profiil-ja-konto-elutsukkel.md` | T02 |
| `fable-5-rag-kvaliteedi-mootmine-ja-otsingu-arendus.md` | T28 |
| `fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md` | T28 |
| `fable-5-rag-p8-url-korje-tehniline-tooplaan.md` | T28 |
| `fable-5-rollivahetaja-ja-rollipohised-vaated.md` | T15 |
| `fable-5-ruumid-liitumine-ja-konevoog.md` | T12, T08 |
| `fable-5-ruumilise-platvormi-elav-visioon-ja-arendusteed.md` | T04, T13, T14, T19–T25 |
| `fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md` | T22 |
| `fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md` | T06 |
| `fable-5-teekond-o-tk9-sent-retention-otsus.md` | T06, T16 |
| `fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md` | T11 |
| `fable-5-tooheaolu-e0-progress.md` | T14 |
| `fable-5-tooheaolu-koondseis-ja-jatkamispunkt.md` | T14 |
| `fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` | T14 |
| `fable-5-tooheaolu-v2-iganadalane-pusiruum.md` | T14 |
| `fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md` | T20–T25 |
| `fable-5-usaldusmudel.md` | kõikide teemade privaatsus-, nähtavus- ja AI-vastutuse piir |
| `fable-5-uue-akna-orientatsioon-ja-teadmistekaart.md` | kõigi teemade repo-, rolli-, route'i- ja funktsiooniseoste orientatsioon |
| `fable-5-vestlusaken-haalvestlus-ja-toovoogude-kaivitamine.md` | T03, T07 |
| `lisafunktsioonid/fable-5-dokumendid-analuus-ja-syvauuring-tervikvoog.md` | T07 |
| `ruumilised-lehe-faasid.md`, `prototyybid/README.md`, `ruumilise-kogemuse-lahtekoht.md` | T19, T13, T14 |
| `fable-5-teemade-katvusekaart.md` | kogu registri inventuurialus; vanad KATMATA-märked lahendatakse käesoleva registri värskema seisuga |
| `koordinaatori-handoff-2026-07-16.md` ja `platvormi-arendusprogramm-2026-07-17.md` | kõigi teemade Git-, järjekorra- ja väravaseis |

`ideed.md`, `funktsioonide-ja-ux-kaardistus.md` ning vanemad Opuse/Soli progressi- ja auditihandoff'id on visiooni-, rakendusajaloo- ja tõendiallikad. Need ei loo eraldi arendusteemasid; nende jätkuvalt kehtivad võimalused on paigutatud T01–T28 alla ning valminud koodivarad ptk 3 alla.

---

## 10. Jätkamispunkt

1. T01 `ADMIN-V1-CORE` on `CODE_READY @ f5e20b21`; teostaja kontrolliaruanne on vastu võetud, runtime jäi `not_run` ning koordinaator kordusteste ei tee.
2. T23 `ESTA-MENTOR-V1` on `IN_PROGRESS_LOCAL` olemasolevas `SotsiaalAI-esta-mentor-v1` worktree's (commit'imata diff, remote puudub); T25 `ORG-V1` on `ANALYSIS_READY` ning T24 `FIELD-V1` on `IN_PROGRESS` samas Fable'i worktree's ja pausil testide alguses — lõppcommit'i ega remote SHA-d pole veel üle antud. FIELD-D0 sulges 17.07.2026 O-FD-1/2/3 (väärtused analüüsidoki ptk 10/11 ja T24 kirjes). T26 `PILOT-PARTNER-V1` on `ANALYSIS_READY` — PILOT-PARTNER-A0 (17.07.2026, `fable-5-esimese-partnerpiloodi-ja-kasutuselevotu-mudel.md`) andis 12-etapilise piloodimudeli, soovitatud väikseima ulatuse (1 KOV-osakond + olemasolev eelpöördumise täisrada; 2–4 töötajat + 10–30 pöördujat) ja otsused O-PP-1/2/3; päris aktiveerimine jääb T27 release candidate'i + G3 checklisti (sh TK-P0, U1-P0 release'is) taha; uut koodi enne release candidate'i ei vajata. Uut sõltumatut süvaanalüüsi ei avata enne SUP-V1-A0 sõltuvuse täitumist või KOV-V2-A0 omaniku taasavamist.
3. T04 `WORKSPACE-EVENTS-V1`, T05 `WORKBENCH-V1`, T06 `JOURNEY-V1` ja T28 `RAG-V1` on `CODE_READY`; ükski pole main'is ega serveris. T28 `codex/rag-v1 @ 8c3e5f77` on remote'il, local=remote ja P8.6 jääb omaniku otsuseks.
4. Iga järgmise töö lõpparuande järel uuendatakse siin ainult vastava T-teema olekut, olemasolevat koodivara, otsuseid, lehevastutuse võimalikku muutust ja järgmist teemataseme sammu.
5. Uut T-ID-d luuakse ainult päriselt uue kasutajaeesmärgi või tooteala jaoks — mitte ühe lehe, leiu, testi, auditi või commit'i jaoks.
6. Kui mõni auditist leitud võimalus ei mahu ühegi T-teema alla, lisatakse see esmalt käesoleva registri „katmata võimaluste” reale; Sol/Terra ülesannet ei looda enne teema piiri määramist.
7. Release'i täissviit ja sõltumatu audit jäävad T27 lõppväravaks.
