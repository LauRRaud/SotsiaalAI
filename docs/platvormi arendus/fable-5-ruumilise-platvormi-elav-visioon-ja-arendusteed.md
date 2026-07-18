# Fable 5: SotsiaalAI ruumilise platvormi elav visioon ja arendusteed (RUUM-VIS-A0)

STATUS: COMPLETE (esimene täisring 16.07.2026 — kõik nõutud teemad on tervikseose ja arengutee tasemel kaetud; dokument JÄÄB elavaks: iga järgmine töökord täpsustab edenemistabeli ja Jätkamispunkti kaudu. COMPLETE ei tähenda, et ükski funktsioon on koodina valmis, ega anna ühelegi teemale arendusluba.)

Kuupäev: 16.07.2026 (esimene töökord)
Autor: Fable 5 (analüüs; rakenduskoodi ei muudeta)
Roll: platvormiülene ruumilise edasiarenduse masterkaart — seob praegused funktsioonid, tulevikuvisiooni, ruumilised tööalad ja ühise platvormiarhitektuuri üheks pidevalt täienevaks dokumendiks. See on koordinaatori handoff'is nimetatud „RUUM-V2 süntees": olemasolevaid tervikanalüüse ei korrata, nende V2-osad sünteesitakse üheks suunaks.

---

## 0. Edenemistabel

| Peatükk | Seis | Kontrollitud allikad | Peamine tulemus | Täpne järgmine tegevus |
|---|---|---|---|---|
| 1. Tööviis | COMPLETE | ülesande lähteülesanne | tööreeglid ja olekusõnastik paigas | uuenda iga töökorra lõpus |
| 2. Töö piirid ja tõeallikad | COMPLETE | git fetch origin; origin/main log; git branch -r --no-merged; SSH live-serverisse; koordinaatori-handoff-2026-07-16.md | origin/main `fe4eb4fa` = server; lokaalne main `0da4185b` (1 ees, 22 taga); tõeallikate hierarhia fikseeritud | korda Git/serveri kontrolli iga uue töökorra alguses |
| 3. Platvormi lähtekoht | COMPLETE | /meist (page.jsx, MeistBody.jsx, et.json meist.*); ruumilise-kogemuse-lahtekoht.md; sonum-slogan-ja-tulevikuvisioon.md; ideed.md (29 ptk); avastamata-vajadused (U1–U12); lokaalsed-mudelid; koordinaatori handoff | visioon on sisemiselt kooskõlas; 4 ruumimudelit + grammatika + tööruumileping moodustavad ühe terviku; vastuolusid ei leitud, 2 täpsustuskohta | — |
| 4. Praeguse ja tulevase piir | COMPLETE | origin/main ajalugu; merge'imata harud; 14 valdkonna tervikanalüüsid; memory-kaardid | piirimaatriks 14 funktsioonireaga; tulevik alustab töötavast tuumast, mitte nullist | uuenda pärast iga suuremat merge'i |
| 5. Ühine ruumiarhitektuur | COMPLETE | Prisma-mudelite seis analüüsidest; Room/Kovisioon/PreInquiry/Journey mustrid; U1–U12; handoff'i tööruumileping | 8 ühiskihti, 4 vastust; väikseim ühine alus = sündmuskiht + tööruumileping + osaleja/jagamise ühtlustus + jagamise elutsükli lõpuleviimine | valideeri leping SUP-V0 ja Kovisiooni vastu enne esimest aluskihi paketti |
| 6.1 Teekonna kompass / elusündmuse tööruum | COMPLETE | fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md; handoff'i Teekonna-lõik; ideed 2.3/11 | Teekond = andmetuum, kompass = navigeerimiskiht, elusündmuse ruum = sama objekti ruumiline kest — EI dubleerita | O-TK9 otsus enne teostuspaketti |
| 6.2 Tööheaolu püsiruum | COMPLETE | fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md; ideed 19–21; E0 haruseis | nädalarütmiga privaatne ruum olemasolevate vormide peale; jälgimiskeeld arhitektuuriline, mitte lubadus | E0 merge enne uut kihti |
| 6.3 Kovisioon | COMPLETE | fable-5-kovisiooni-tervikvoo-teadmistekaart.md; ruumilise-kogemuse-lahtekoht 7.5 | töötav 8-etapi voog = faaside referentsteostus; ruumiline ümberkujundus = lavastuse, mitte loogika vahetus | KOV-R P2 (lõuendireegel) enne ruumilist ümberehitust |
| 6.4 Supervisioon | COMPLETE | supervisioon-tootemudel (Q1+Q2, SUP-P0…P11); ideed 22–23; SUP-P0 haruseis | SUP on ruumilepingu teine tarbija; V0 skeem valideerib osaleja/faasi/purge mustrid | SUP-P0 push + audit; ruumileping enne SUP-P2 UI-d |
| 6.5 Koostöövariandid | COMPLETE | ideed 5/22–27; RUUM-A0 (fable-5-ruumid-liitumine-ja-konevoog.md); U11 | koostöö = ruumi elutsükli pikendus (eesmärk+lõpetamine), mitte uus moodul; püsiruum vajab arhiveerimislepingut | otsus O-KO1 (püsiruumi omanikuvahetus) |
| 6.6 ESTA | COMPLETE | ideed 25–27; supervisioon-tootemudeli ESTA-piir | ESTA = partner ja liikmesuskiht, MITTE uus roll; piirkonnaruumid = sama ruumimudel + liikmesusvärav; midagi pole kokku lepitud | partnerlusotsus enne igasugust teostust |
| 6.7 Meetodipeegel | COMPLETE | ideed 8; ruumilise-kogemuse-lahtekoht 7.3 | refleksioonikiht, mitte eraldi moodul: sama kirjemudel teenindab JTA-d, Kovisiooni, Supervisiooni, Tööheaolu | ehitamine alles pärast JTA õhukest tuuma |
| 6.8 Võrgustikutöö | COMPLETE | ideed 5/9; avastamata-vajadused U9 | võrgustikuruum = jagatud lõuend + range 3-taseme nähtavus; genogramm/ökokaart on sama ruumi vaated | Etapp-4 MVP alles pärast osalejakihti |
| 6.9 Juhtumitöö assistent | COMPLETE | ideed 4/10–12; STAR2-piir | JTA = spetsialisti privaatne ettevalmistusruum, „Kopeeri STAR2 jaoks", mitte register; päritolumärgistus on JTA tuum | Etapp-0 õiguslikud otsused (ideed 17) |
| 6.10 Genogramm ja ökokaart | COMPLETE | ideed 7 (meetodid 7–8), 9; võrgustikuruumi mudel | kaks vaadet võrgustikuruumi andmetele; kolmandate isikute andmed = suurim õiguslik risk, vajab eraldi analüüsi | ära alusta enne 6.8 aluskihti + õigusanalüüsi |
| 6.11 Kohtumise ühisvaade | COMPLETE | U10; ideed 11.5; ruumigrammatika „kokkulepe seinal" | v1 = U10 (artefakt→ruumisõnum, 0 uut mudelit); täisvaade = hilisem ruumilepingu tarbija | U10 võib minna P0-järgselt kohe |
| 6.12 Organisatsiooni analüütika | COMPLETE | admini-analuutika 12 ptk; ideed 20–21; Admin P0.1 merge-seis | org-kiht puudub [DECISION]; ainus lubatav kuju = k-anonüümne koond; töötaja jälgimist ei ehitata kunagi | org-mudeli tooteotsus |
| 6.13 Osalejate/jagamise/nõusoleku kiht | COMPLETE | Room/Invite/PreInquiry/Help/dokumentide jagamisvood analüüsidest; U3/U12 | 9 nõuet ühisele kihile; Room+Invite on õige alus; suurim auk = tagasivõtmise ebaühtlus | ühiskihi leping ptk 5 järgi; U3+U12 esimesena |
| 7. Välitöö ja mobiilne ruum | COMPLETE | avastamata-vajadused (offline/PWA seis); lokaalsed-mudelid (voice välitööl); ideed 7 meetod 32 | välitöö = sama tööruumileping mobiilse kestaga; offline-mustand + fakti/tõlgenduse eristus on tuum; asukoht rangelt vabatahtlik | eraldi analüüs enne teostust; sõltub U1+ruumilepingust |
| 8. Teenusekaart 3D | COMPLETE | teenusekaart-abivahendus-tervikvoog; 3d.maaruum.ee runtime-kontroll (ArcGIS 4.18 + Web AppBuilder; ise „prototüüp"; LOD2+punktipilved); Geo3D andmed + CC BY 4.0 litsents (veebikontroll 16.07) | 3 varianti võrreldud; soovitus = variant 1 (väline 3D-link) kohe, variant 2 (põimitud stseen) mitte prototüübi peale; 3D ei ole kunagi ainus tee | `?find=` visuaalne lõpptest; O-3D1 otsus |
| 9. Teenusele jõudmine ja kogukonna elav kaart | COMPLETE | U4/U5; teenusekaart-tervikvoog; ideed 2.13 | „elav kättesaadavus" (U4) + „puudujäägi koond" (U5) = platvormi unikaalseim andmekiht; navigaator = juhis, mitte GPS-jälgimine | U4 enne U5; koondi avaldamislävi = otsus |
| 10. Kaamera ja hääl ruumilise sisendina | COMPLETE | lokaalsed-mudelid (VAD/Whisper/MediaPipe/ahel-häälvestlus); VEST-A0 kriisirajaseis; ruumilise-kogemuse-lahtekoht 9.3–9.5 | voice V1 = ahelaga häälvestlus olemasoleva RAG-i peal; olekud, piirid ja V1-pakett määratud; kaamera-näpistus = eraldi hilisem prototüüp | VEST-P0a PASS enne voice V1 arendust |
| 11. Tervikseoste maatriks | COMPLETE | ptk 4–10 süntees | 7 suunda koonduvad 5 põhikeskkonnaks; ühiskihtide sõltuvusjärjekord selge | uuenda, kui ptk 6 alapeatükid täienevad |
| 12. Arendusjärjekord | COMPLETE | koordinaatori handoff (korvid, väravad); ptk 5/11 süntees | 3 horisonti: A stabiliseerimine (käib), B ühine ruumialus (4 paketti), C tulevikuruumid (järjestatud) | tooteomaniku kinnitus horisont B alustamisele |
| 13. Töökorra lõppvastus | COMPLETE | — | vt dokumendi lõpp | uuenda iga töökorra lõpus |

---

## 1. Tööviis

- See on **elav dokument**: iga töökord uuendab edenemistabelit ja Jätkamispunkti. Dokument peab olema igal hetkel kasutatav ja jätkatav.
- Lubatud peatükiseisud: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `BLOCKED_DECISION`, `NOT_APPLICABLE`.
- `STATUS: COMPLETE` dokumendi tasandil pannakse alles siis, kui kõik nõutud teemad on vähemalt tervikseose ja arengutee tasemel kaetud. Analüüsi valmimine EI anna ühelegi teemale arendusluba — teostuspakett otsustatakse eraldi (koordinaatori handoff'i „paketi arendusvalmiduse värav").
- Olekumärgised: `[MAIN]` aktiivses origin/main-is · `[BRANCH]` ainult harus · `[SERVER]` serveris kontrollitud · `[DOC]` dokumenteeritud · `[VISION]` tulevikunägemus · `[DECISION]` vajab tooteomaniku otsust · `[UNKNOWN]` pole veel tõendatud.
- Neli eri valmidusseisundit ei võrdu kunagi: analüüs `COMPLETE` ≠ push'itud haru ≠ main ≠ server.

## 2. Töö piirid ja tõeallikad

### 2.1. Kontrollitud Git- ja serveriseisund (16.07.2026)

Kontrollitud käsklustega `git fetch origin`, `git log origin/main`, `git rev-list --left-right --count`, `git branch -r --no-merged origin/main` ning SSH-ga live-serverisse (`/home/ubuntu/apps/sotsiaalai`):

| Seisund | Väärtus | Märkus |
|---|---|---|
| GitHub `origin/main` | `fe4eb4fa` | sisaldab värsket turvarelease'i: Admin P0.1 väravad, Help-listings privacy P0 (V1+V2+workflow-leke suletud), DOK-XTEN P0 (privaatsete agent-dokumentide RAG-isolatsioon), RAG P8.0 inventuur |
| Live-server | `fe4eb4fa` [SERVER] | SSH-kontroll 16.07: server = origin/main; kooskõlas koordinaatori handoff'iga (frontend 200, RAG health ok) |
| Lokaalne kasutaja main | `0da4185b` | 1 commit ees (AI update 16.07 — CSS/registreerimislend jm), **22 commit'i taga** origin/main-ist |
| `prod` remote | `b8ca6cae` | **aegunud jäänuk-remote** (2617/82 lahknevust) — serveriseisu sellest EI tuletata |
| Määrdunud tööpuu | 13 muudetud + 4 uut faili | sh RV-P0 ja registreerimise jaamalend; neid EI puututa |

Merge'imata harud, mis selle dokumendi teemasid otseselt puudutavad: `codex/vest-p0-crisis-failsafe` (`ef01fc42`, sõltumatu audit CHANGES_REQUIRED), `fable/tooheaolu-e0` (`fe8c7df2`), `codex/supervision-v0-p0-schema` (`2fc826c4`, **lokaalne, push'imata**), `codex/u7-plain-language` + `opus/u6-personal-search` (auditeeritud, merge-loa ootel), `codex/service-map-marker-css`, `codex/rag-qm-p0-baseline(+p0a)`, `codex/spatial-flight-effect-note`.

### 2.2. Töö piirid

- Rakenduskoodi, Prisma skeemi, migratsioone ega teste ei muudeta. Commit/push/merge/deploy'd ei tehta. Kasutaja määrdunud faile ei puututa. Ainus lubatud muudatus on see dokument.
- Git ja aktiivne kood on praeguse teostuse tõeallikas; varasemad analüüsidokumendid on tõendid analüüsi, mitte koodi valmiduse kohta.
- `docs/ruum-audit.md` **ei eksisteeri** selle rajaga (kontrollitud Glob'iga; docs/ juurkataloogis pole .md faile). Ruumide hetkeseisu kanooniline audit on koordinaatori handoff'i järgi `fable-5-ruumid-liitumine-ja-konevoog.md` (RUUM-A0); mälumärge rajast `docs/ruum-audit.md` viitab tõenäoliselt varasemale tööpealkirjale [UNKNOWN — ei mõjuta seda dokumenti].

### 2.3. Peamised sisendanalüüsid (kõik [DOC], origin/main-is kui pole märgitud teisiti)

Visiooniallikad: `ruumilise-kogemuse-lahtekoht.md` (ruumigrammatika, 4 ruumimudelit, 13 ptk) · `sotsiaalai-sonum-slogan-ja-tulevikuvisioon.md` (visioonilõik + „Abi algab selgusest") · `ideed.md` (29 ptk: tervikpilt, JTA/STAR2, võrgustikutöö, Meetodipeegel, Tööheaolu 19–21, Supervisioon 22–23, ESTA 25–27, ruumitäpsustus 28, ühendamisreegel 29) · `fable-5-avastamata-vajadused-ja-uued-voimalused.md` (U1–U12 + „mitte ehitada") · `lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md` (voice/kaamera/OCR/lokaalsed mudelid) · `koordinaatori-handoff-2026-07-16.md` (kanooniline töölaud, ruumilise platvormi strateegiline siht, A/B/C/D-korvid, V1/V2 eristus).

Funktsioonianalüüsid (14 põhivoo perekonda, kate ~100%): Teekond/eelpöördumine, Tööheaolu, Kovisioon, Supervisioon, Teenusekaart/abivahendus, vestlus/hääl, dokumendid/süvauuring, ruumid/kõne, konto elutsükkel, igapäevane töölaud, avalikud pinnad, maksed, A11Y/I18N, RAG (elutsükkel + kvaliteet + P8) — igaühel oma `fable-5-*.md` fail.

## 3. Platvormi lähtekoht

### 3.1. Mis SotsiaalAI praegu on (/meist, [MAIN][SERVER])

Ametlik enesekirjeldus (`messages/et.json` → `meist.p1–p8`, renderdatud `MeistBody.jsx` kaudu): SotsiaalAI on sotsiaalvaldkonna digikeskkond, mis koondab usaldusväärse info, AI toe, töövahendid ja suhtluse kolmele kasutajale — **pöörduja, sotsiaaltöö spetsialist, teenuseosutaja**. Tuumafunktsioonid, mille ümber kogu tulevikuanalüüs käib:

1. **Vestlusaken** — „selguseni peaks jõudma küsides, mitte otsides"; iga vastuse juures allikad (p3);
2. **Töölaud** — rollipõhine tegutsemiskoht: abisoovid/-pakkumised, dokumendid, pöördumiste vastuvõtt, kovisioon, teenuseprofiil, tööheaolu (p5);
3. **Vestlusruumid** — küsimuse lahendamine koos teistega, kutsutavad kõik kolm rolli (p6);
4. **Teenusekaart** — ametlik ja kogukondlik tugi ühel kaardil (p7);
5. Põhimõtted: otsused jäävad inimesele, AI valmistab ette; kriisi korral kohe suunamine; sotsiaalne ettevõte; turvalisus, andmekaitse, selged reeglid (p4, p8).

Tulevikuvisioon **ei alusta nullist** — see areneb sellest platvormist. Iga siinne suund peab näitama, millisest töötavast osast ta alustab (ptk 4 maatriks).

### 3.2. Visiooni tuum ja sisemine kooskõla

Kontrollisin visiooniallikate omavahelist kooskõla. Tulemus: **visioon on sisemiselt kooskõlas** — kõik allikad kannavad sama põhiotsust eri tasanditel:

- **Tooteluse** (ruumidoc ptk 13): „SotsiaalAI ei ole sotsiaalvaldkonna funktsioonidega veebileht, vaid ruumiline abi-, töö- ja koostöökeskkond, kus vestlusest võivad kasutaja kontrolli all saada tööobjektid, objektidest seosed ning seostest järgmised sammud."
- **Visioonilause** (slogan-doc): „SotsiaalAI ei asenda ei inimest ega riiki, vaid teeb nähtavaks ja kergemaks kõik selle, mis seni on kahe vahele ära kadunud." Peaslogani kandidaat: „Abi algab selgusest."
- **Ruumigrammatika** (ruumidoc ptk 3): sein = aktiivne tööpind, laud = pooleliolev töö, kapp = arhiiv, uks/portaal = tähendusega üleminek (ruum/osalejad/nähtavus muutub), aken = välismaailm (Teenusekaart, kogukond), kaugus/valgus = tähendus, mitte dekoratsioon.
- **4 ruumimudelit** (ruumidoc ptk 4): püsiv maja (orientatsioon + ruumiline mälu) · muutuv stuudio (tegevus kujundab ruumi) · lennuteekond (juhendatud faasid sügavuses; **registreerimise jaamalend on selle esimene päris teostus** — lokaalne, commit'imata) · vaba lõuend (kasutaja loob ise seoseid; Kovisioon + Teemaseemned on eelkäijad).
- **Koordinaatori strateegiline siht** (handoff): funktsioonid → **faasipõhised toetatud tööruumid**; kasutaja omab eesmärki ja otsuseid; ühine minimaalne tööruumileping (eesmärk, faasid, seis, kasutaja märgitud oluline, tegevused, otsused, osalejad, ajajoon, järgmine samm, lõpetamistingimus); Teekond jääb privaatseks tervikobjektiks.
- **Visuaalne lähtekoht** (tellija, 16.07): järveäärne rahulik tuba, tugitool, maal vastasseinal; digikiht ilmub AR/VR-kihina (klaaskaardid, tööobjektid, sissepääsud); kasutaja juhib, millal kiht avaneb ja mis jääb privaatseks. Kaadrid `Kaader ruum.png` (3 klaaskaarti RUUMID/TÖÖLAUD/VESTLUS + dokk) ja `kaader ruum 2.png` (ON-nupp „Ühenda SotsiaalAI platvormiga") on **tunnetuse näited, mitte kohustuslik disain**.

Kaks täpsustuskohta (mitte vastuolud):

1. **„Lennuteekond" tähendab kahte eri asja**, mis on nüüdseks teadlikult eristatud (ruumidoc 4.3 täiendus): (a) *ruumikaadrite teekond* — ruumi enda visuaal muutub kerides (sisenemiskogemus tugitooli suunas); (b) *flight-sisuteekond* — päris sisupinnad vahetuvad sügavuses (registreerimislend, tulevased vormiteekonnad). Neid prototüüpitakse eraldi; samal lehel ei tohi kaks süsteemi korraga kerimist juhtida.
2. **Kerimine vs valik liikumismootorina**: ruumidoc 4.3 lubab kerimist kui üht liikumisviisi; registreerimislennu teostus (useStationFlight) valis teadlikult *valikupõhise* liikumise (kaamera siht = aktiivse jaama indeks, MITTE scrollY) — edasi viib vastamine. See on täpsustus, mitte vastuolu: juhendatud vormis on samm = sisuline otsus; vabas sisus võib kerimine jääda. Mõlemal juhul kehtivad ruumidoc'i kohustuslikud piirid (otselingid, klaviatuur, reduced-motion → flat, seisu säilimine).

### 3.2.1. Prototüüpide ühine näiteleping — tooteomaniku täpsustus 17.07.2026

Ruumilise kogemuse siht ei ole ühe lehe kaupa nimetatud demode kogum. Ükski praegune HTML-alusproov ei „kuulu” Dokumendi koostamisele, Tööheaolule, Registreerimisele ega Kasutusjuhendile ainult seetõttu, et selle mock-sisu kasutab vastavat näidet.

- Praegused käitumispõhised alusproovid on `prototyybid/ruumilise-toolaua-fookuse-ja-vordluse-prototuup.html`, `prototyybid/ruumilise-toolaua-faasiliikumise-prototuup.html` ja `prototyybid/ruumilise-toolaua-lugemiskihi-prototuup.html`.
- Kanooniline järgmine HTML on `prototyybid/ruumilise-toolaua-prototuup.html`: see avaneb näitevalikusse ja koondab sama kesta alla vähemalt Dokumendi koostamise, Tööheaolu, Teekonna, Kovisiooni, Registreerimise/sisenemise ning Kasutusjuhendi/lugemiskihi.
- Ühine on dokk, faasiriba, fookus, ülevaade, võrdlus, URL-olek, liikumis-/flat-mootor ja ligipääsetavus. Näiteadapter määrab ainult sisu, faasid, tööobjektid, väravad, võrdluspaarid ning nähtavus-/privaatsussildid.
- Uus töövoonäide lisatakse samasse valikusse; sellele ei looda uut lehespetsiifilise nimega demoarhitektuuri.
- React Bitsi `Carousel` ja `Animated List` on lisatud ainult ühise prototüübi **käitumisreferentsideks**: esimene võib sirvida tööobjekte/versioone, teine kuvada sündmusi või „mis muutus” loendit. Need ei ole uued näited, ei asenda dokki/faasiriba ega anna luba lisada tootmiskoodi sõltuvust; detailne rolli- ja ligipääsetavuspiir on prototüüpide registris.

Detailne inventuur ja jätkamispunkt on `prototyybid/README.md`. See täpsustus muudab prototüüpide pakendamist ja nimetust, mitte ühegi töötava funktsiooni serveri-, õiguste- ega andmelepingut.

### 3.3. Mida visioon EI luba (läbivad keelud, korduvad kõigis allikates)

- Tavaline dashboard või pikkade vormide kogum; „iga info korraga ühel ekraanil".
- STAR2 paralleelregister, ametliku juhtumiplaani koopia, automaatne riskiskoor/triaaž, AI otsustajana.
- Töötaja individuaalne jälgimine (tootlikkus, tööheaolu, „aktiivsus") — ainus lubatav kuju on k-anonüümne koond.
- Vaikimisi jagamine; jagamine ilma eelvaate, eesmärgi ja tagasivõtmiseta; ruumivahetus privaatsuspiiri ainsa selgitusena.
- Pidev taustal kuulamine, äratussõna V1-s, emotsiooni-/seisunditurvastus häälest või näost, pilguga kinnitamine.
- Efekt efekti pärast: sügavus ja liikumine peavad kandma töövoo tähendust; kui sakid/akordion on selgemad, ei kasutata lendu (ruumidoc 4.3 piirid).

## 4. Esimene töö: praeguse ja tulevase platvormi piir

Maatriks fikseerib, **millest tulevikuvisioon päriselt alustab**. „Praegu main-is" = origin/main `fe4eb4fa` (= server). See EI ole uus tehniline audit — read toetuvad valmis tervikanalüüsidele ja Git-kontrollile.

| Funktsioon | Praegu main-is [MAIN] | Harudel ootav [BRANCH] | Analüüsitud tulevik [DOC] | Soovitud ruumiline siht [VISION] |
|---|---|---|---|---|
| **Teekond ja eelpöördumine** | täisvoog runtime-tõendatud: vestlus→Teekond→eelpöördumine→vastuvõtulaud→ruum; shareKeys-jagamine; 3 UX-juurviga (kerimisblokk panel.css, shareKeys katab ainult osa, olek pole URL-is) | — (O-TK9 otsustuspakett on doc, mitte kood) | teekond-eelpoordumine-ux COMPLETE; soovitus „kaks ruumi, üks lävi"; O-TK9 A/B/C lahtine [DECISION] | elusündmuse püsiruum + Teekonna kompass navigeerimiskihina (ptk 6.1); eelpöördumine = lennuteekond |
| **Tööheaolu** | 10 vormi + privaatsed kirjed + k-anonüümne agregaat; kirjete lugemisrada puudub | E0 detektoriparandus `fe8c7df2` (1238/1238 testi, ootab ristkontrolli+merge'i) | tervikloogika COMPLETE: E1–E6 jätkuteed; ideed 19–21 (kaks kasutusviisi, KOV-koond, jälgimiskeelud) | iganädalane privaatne püsiruum, olukorrast lähtuv (ptk 6.2) |
| **Kovisioon** | 8 etappi + atomaarne sulgemine + purge + lõpetatud juhtumid + praktika-retsensioon + RAG — kõik runtime-tõendatud (CovisionWorkspace); cvl-kesta lõuendireegel rikutud (covision-live.css overflow) | — | tervikvoo teadmistekaart COMPLETE; KOV-R parandusjärjekord (R1-P0 lõuend = pakett P2) | ühine laud + privaatne märkmik + etapid ruumis (ptk 6.3); faaside referentsteostus kogu platvormile |
| **Supervisioon** | mitte midagi | SUP-P0 V0-skeem `2fc826c4` — **lokaalne haru, push'imata, auditita** | tootemudel Q1+Q2 COMPLETE: 13 mudelit, purge-tehing, SUP-P0…P11; ESTA = mentorite andmebaas, register = ESCÜ/ANSE | individuaalne/grupi/org-supervisioon sama ruumilepingu peal (ptk 6.4) |
| **Teenusekaart + teenuseprofiil** | kaart+filtrid+avalik API; profiil→kaart→RAG sünk; **Help P0 privaatsuslekked SULETUD** (V1/V2 + workflow-võtmed — `3479a447`, `56b70fe2`, `fb451593`) | markerite CSS (`codex/service-map-marker-css`) | teenusekaart-abivahendus-tervikvoog COMPLETE; V3 liit-ID, V4 kaart-suvaline-kuulutus, V5 popup→pöördumine lahtised; O1–O6 otsused | 2D⇄3D seotud vaated (ptk 8); elav kättesaadavus U4 + puudujäägid U5 (ptk 9); „aken" välismaailma |
| **Abisoovid ja abipakkumised** | loomine→kaart→sobitus→ühisruum runtime-tõendatud; INTERNAL-kanal | (osa V-parandusi Help P0-s juba main-is) | sama tervikvoo dok; V3–V5 katkekohad | kogukondlik tugi kaardil + sobitusruumid; EI ehitata avalikku foorumit (mitte-ehitada nr 4) |
| **Vestlus ja hääl** | tekstivestlus + RAG + allikakaardid + STT (dikteerimine) + TTS (ettelugemine nupust) — eraldi toimingutena; kriisiraja 4 katkekohta runtime-tõendatud (VEST-A0); kursor-500; Stop-illusioon | VEST-P0 kriisiparandus `ef01fc42` — sõltumatu audit **CHANGES_REQUIRED** (tühi provider-vastus ilma kriisinumbriteta); järgmine VEST-P0a | VEST-A0 COMPLETE; O-V1…O-V7 otsused; häälvestluse arhitektuur lokaalsed-mudelid ptk 7 | vestlus kui ruumi loomise algus (ruumidoc ptk 6); ahelaga häälvestlus eraldi režiimina (ptk 10) |
| **Dokumendid ja süvauuring** | üleslaadimine, analüüs, artefaktid, transkriptsioon; **DOK-XTEN P0 merge'itud**: privaatsed agent-dokumendid RAG-ist isoleeritud (`f5d2f7b9`) | — | FAILID-A0 **pooleli** (79 rida, limiit katkestas); failide elutsükli analüüs osaline | kapp/arhiiv + lauale tõstmine = dokumendi töösse võtmine (ruumigrammatika); dokument kui ruumiobjekt |
| **Ruumid ja osalejad** | Room + RoomMember + kutsed (aegumine/revoke/resend) + kõne nõusolekuga + lastReadAt; origin-tüübid (abivahendus, teenuseosutaja-pöördumine) | — | RUUM-A0 = fable-5-ruumid-liitumine-ja-konevoog.md COMPLETE (staatiline audit; kahe kasutaja runtime-tõend puudub) | AINUS üldistatav osalejakihi alus (ptk 5, 6.13); uks/portaal-grammatika kandja |
| **Professionaalne koostöö** (püsiv) | ainult ruumid + Kovisioon; püsivaid kogukondi/koostööruume pole | — | ideed 22–27 (Supervisioon, ESTA foorumid/piirkonnad); U11 töö üleandmine | ajutine vs püsiv koostööruum sama elutsüklilepinguga (ptk 6.5); ESTA-alad liikmesusväravaga (ptk 6.6) |
| **Admin ja organisatsioon** | RAG-admin (ra-*), analüütika, **Admin P0.1 ohtlike toimingute väravad merge'itud** (`7d1cc4e8` + `5357147e`); org-/üksusemudelit POLE | — | admini-analuutika 12 ptk COMPLETE; M1 (bulk-email tokeni replay) ja M2 (vaikiv 500-lagi) keskmised leiud; 7 lahtist otsust | org-analüütika = ainult k-anonüümsed koondid (ptk 6.12); org-mudel on eraldi suur otsus [DECISION] |
| **RAG / teadmusbaas** | ingest→retrieval→allikad; P8.0 master-inventuur (323 kirjet) CLI; kov-source-monitor; rag_trace ChatLog'is | RAG-QM-P0 baasjoon + P0a (Opuse kordusauditi ootel); P8.1–P8.7 kood puudub | elutsükkel + kvaliteedimõõtmine + P8 tööplaan COMPLETE; 3 pearski (kustutusjääk, versioonita ülekirjutus, väravata deploy) | teadmus kui ruumi nähtamatu tugi; allika-tagasiside silmus U8; allikakaardid jäävad igas režiimis |
| **Rollivahetaja** | fail-closed rollipõhisus olemas; vahetaja UI puudub main-ist | **ainult lokaalses määrdunud tööpuus** (RV-P0, commit'imata!) — handoff: diff tuleb enne integratsiooni eraldada | rollivahetaja-analüüs COMPLETE; TO-1…TO-7 otsused | rollid samas maailmas, eri ruumid (ruumidoc ptk 8); vahetaja = vaatevahetus, mitte õigustevahetus |
| **Registreerimine / sisenemine** | tavaline vorm (suletud registreerimine) | **ainult lokaalses määrdunud tööpuus**: jaamalend (useStationFlight + register-flight.css) — flight-mootori esimene päris sisuteostus | ruumilised-lehe-faasid.md; flight-effect.md spetsifikatsioon | sisenemiskogemus = ruumikaadrite teekond tugitooli (kaadrid on näited); vormid = jaamalennud; ON-nupp/“Selguse väli” avastseen |

**Peamine järeldus:** tulevikuvisioon ei alusta tühjalt kohalt üheski reas. Kõige küpsem alus on Kovisioon (faasid), Room-süsteem (osalejad), PreInquiry (jagamise elutsükkel) ja Teekond (privaatne tuum) — need neli mustrit ON ühise ruumiarhitektuuri toormaterjal. Kõige suurem vahe visiooni ja koodi vahel on läbivates kihtides (sündmused, tegevused, ajajoon, ühtne tagasivõtmine), mitte üksikfunktsioonides.

## 5. Ühine ruumiarhitektuur

Küsimus: millised komponendid ehitatakse kogu platvormile **üks kord**, mitte igas funktsioonis eraldi? Vastamise distsipliin tuleb koordinaatori handoff'ist: täismooduleid ei peatata lõputu universaalse platvormikihi ootele — aluskihiks kvalifitseerub ainult võime, mida **vähemalt kaks kinnitatud töövoogu päriselt vajavad**.

### 5.1. Olemasolevad mustrid, millest üldistada (inventuur)

| Muster main-is | Kus elab | Mida ta juba tõestab |
|---|---|---|
| Faasid + atomaarne sulgemine + purge | CovisionWorkspace (8 etappi) | faasipõhine tööruum TÖÖTAB tootmises; sulgemine ja andmete kustutus on tehinguna võimalik |
| Liikmelisus + rollid + kutsed (aegumine/revoke/resend) + lugemata-märk | Room / RoomMember / RoomInvite | ainus üldistatav osalejakiht; origin-tüübid näitavad, et sama ruum teenindab mitut töövoogu |
| Külmutatud jagatud väljund | PreInquiry → SharedVersion → Receipt → StatusEvent | „privaatne algmaterjal + kinnitatud külmutatud koopia adressaadile" on õige jagamismuster |
| Privaatne tervikobjekt + valikuline väljajagamine | Journey (shareKeys) | kasutaja kontrollitud osaline jagamine on teostatav |
| Privaatkirjed + k-anonüümne agregaat | Tööheaolu | „üksik on privaatne, koond on anonüümne" arhitektuur töötab |
| Auditijälg | DocumentAudit + DataAuditLog (2 eri süsteemi) | jälg on olemas, aga killustatud ja kasutajale nähtamatu |
| Nõusoleku kirje | FrameworkAcceptance; kõne salvestusnõusolek | kinnitusmustrid on järjekindlad, kuid iga voog teeb oma |
| Ruumiline faasiliikumine UI-s | useStationFlight (lokaalne) + RoomStage translateZ [MAIN] | flight-mehaanika on tehniliselt tõestatud; jaam = faas on loomulik esitus |

### 5.2. Kaheksa ühiskihti

Ülesande ~20 komponenti koonduvad kaheksaks kihiks. Iga kihi juures: tarbijad (≥2 = kvalifitseerub) ja seis.

**K1. Tööruumileping** — ruum/tööruum, tüüp, eesmärk, faasid, väravad, praegune seis, lõpetamis-/jätkamistingimus.
Leping (handoff'i sõnastuses): eesmärk · faasid · praegune seis · kasutaja märgitud oluline · tegevused · otsused · seotud inimesed/teenused/dokumendid · ajajoon · järgmine samm · lõpetamise või jätkamise tingimus. Faasid on **toetavad, mitte sundivad**: kasutaja saab peatuda, tagasi minna, vahele jätta, mitut rada paralleelselt hoida; platvorm ei lõpeta faasi vaikimisi. Värav = koht, kus edasiminek nõuab kasutaja teadlikku kinnitust (nt „saada", „sulge", „jaga") — mitte animatsioon, vaid otsus.
*Tarbijad:* Kovisioon (on juba), Supervisioon SUP-V0 (plaanis), elusündmuse ruum (6.1), Tööheaolu püsiruum (6.2), eelpöördumise lend, välitöö külastus (ptk 7), registreerimislend (lokaalne teostus). **Kvalifitseerub ilmselgelt.**
*Seis:* [MAIN] üks teostus (Kovisioon, oma tabelites) + [BRANCH lokaalne] UI-mootor; ühist lepingut pole [VISION].

**K2. Ruumiobjektid päritolumärgistusega** — kaart, dokument, märge, küsimus, kokkulepe, sündmus, eesmärk, meetod, teenus, inimene.
Objekt on püsiv (ruumi naastes alles), liigutatav (asukoht kannab tähendust), ühendatav (seosed) ja üleantav ainult kasutaja kinnitusel (ideed ptk 29 kuus küsimust). Iga sisuline väide kannab päritolu: kliendi öeldud / kliendi kinnitatud / dokumendist / teise spetsialisti info / töötaja tähelepanek / töötaja tõlgendus / **AI mustand** / teadmusbaasi allikas — see on AI-ettepanekute, inimotsuste ja allikate eristamise struktuurne alus, mitte UI-silt.
*Tarbijad:* Kovisiooni lõuend (on), Teemaseemned (on, demo), JTA (6.9), Meetodipeegel (6.7), võrgustikukaart (6.8), kohtumise ühisvaade (6.11). **Kvalifitseerub.**
*Seis:* killustatud teostused [MAIN]; ühine objektileping [VISION]. NB: see on *leping ja komponendikiht*, MITTE üks polümorfne supertabel (vt 5.4 anti-lukustus).

**K3. Osalejad, liikmelisus, rollid, õigused, kutsed** — kes ruumis on, mis rollis, mida tohib, kuidas sisse sai.
Room+RoomMember+RoomInvite on õige alus: aegumine, tagasivõtt, taassaatmine, rollid, lastReadAt on olemas. Puudu: rollimuutus ruumis (omanikuvahetus → U11), liikmelisuse lõppemise järelmõjud, „liige ≠ ligipääs päritoluobjektile" põhimõtte üldistus (ideed 5.2: ruumi kutsumine ei anna ligipääsu juhtumile).
*Tarbijad:* kõik jagatud ruumid — vestlusruumid (on), Kovisioon (on, oma), võrgustikutöö, supervisioon, kohtumine, ESTA-alad. **Kvalifitseerub.**
*Seis:* [MAIN] tugev üksikteostus; üldistus [VISION].

**K4. Jagamine, nõusolek, tagasivõtmine, ligipääsu kestus** — eesmärgipõhine nõusolek, kestus, tagasivõtmine, lahkumine, kustutusjärgne kandja.
Põhimõtted (ideed 13.1): privaatne on vaikeseis; jagamine on konkreetne ja eesmärgipõhine; ligipääs on seotud rolli, organisatsiooni, juhtumi ja AJAGA; säilitamine ja ligipääs ei ole sama asi. Suurim auk täna: **tagasivõtmise ebaühtlus** — kutsetel revoke on, saadetud pöördumisel pole (U3); kasutajal pole kohta, kus ta oma jagamisi NÄEKS (U12). Kustutusjärgne kandja: mida adressaat säilitab pärast jagaja konto kustutamist — vajab ühte reeglit, mitte moodulipõhist juhust.
*Tarbijad:* pöördumised, ruumikutsed, dokumendid, abivahendus, tulevased võrgustik/supervisioon/kohtumine. **Kvalifitseerub; osaliselt olemas.**
*Seis:* mustrid [MAIN], elutsükli lõpuleviimine U3+U12 [DOC], üldistus [VISION].

**K5. Sündmused, teavitused, ajajoon, auditijälg** — mis juhtus, kes peab teada saama, mis järjekorras, mis jälje see jättis.
U1 sündmuskiht on avastamata-vajaduste analüüsi keskne leid: read „teavituskeskus puudub", „mis-on-muutunud puudub", „ajalugu nähtamatu" taanduvad samale alusele. Ajajoon (kasutaja/juhtumi sündmuste järjestus) ja auditijälg (kes-mida-millal, õiguslik) on sama voo kaks esitust eri publikule. Teavitus kannab fakti ja viidet, MITTE sisu.
*Tarbijad:* kõik — pöörduja ooteperiood, spetsialisti „mis muutus", U2 tähtajad, U3 tagasivõtuteated, U10 kättetoimetamine. **Kvalifitseerub; on eeltingimus enamikule ptk 6 suundadest.**
*Seis:* auditikirjed osaliselt [MAIN]; sündmuskiht puudub — U1 [DOC].

**K6. Tegevused ja järgmised sammud** — ülesanded, „järgmine kontakt", tähtajad, „jätka siit".
U2: mitte task-manager, vaid pooleliolev töö + üks kuupäevaväli („järgmine kontakt"), mis tõuseb koondisse ja U1 tähtajasündmuseks. Ruumigrammatikas: LAUD kannab pooleliolevat tööd.
*Tarbijad:* spetsialisti tööpäev, pöörduja naasmine, JTA ettevalmistus, välitöö külastusplaan. **Kvalifitseerub.**
*Seis:* puudub; U2 [DOC] on väikseim algus.

**K7. Säilitamine, arhiveerimine, kustutamine** — elutsükli lõpp iga objekti ja ruumi jaoks.
Kovisiooni atomaarne sulgemine+purge on referents; RAG-elutsükli analüüs leidis vaikiva kustutusjäägi — sama risk kordub igas uues moodulis, kui elutsükkel pole lepingus. Reegel: iga uus ruum/objekt defineerib SÜNNIL oma lõpu (mis säilib, mis anonüümitakse, mis kustub; kes otsustab; mis tähtajaga). Arhiiv on ruumigrammatikas KAPP — valmis töö liigub rahulikku arhiivi, mitte ei kao.
*Tarbijad:* kõik moodulid; eriti võrgustik (osaleja lahkub), supervisioon (leping lõpeb), Tööheaolu (isiklik ajalugu).
*Seis:* mustrid [MAIN] (Kovisioon, purge), leping [VISION].

**K8. Esituskihid: privaatne/ühine pind, geograafiline/3D, ligipääsetav 2D** — sama sisu kolm esitusviisi.
(a) Igal jagatud ruumil on privaatne KÕRVALPIND (minu märkmed kovisioonis, töötaja refleksioon kohtumisel) — privaatne ja ühine on sama ruumi kaks kihti, mitte kaks eri kohta; piir peab olema nähtav tekstina, mitte ainult asukohana. (b) Geograafiline kiht (Teenusekaart, tulevane 3D) on „aken" — väline maailm, mitte eraldi rakendus (ptk 8–9). (c) **Ligipääsetav 2D/loendi/klaviatuurivaade ei ole eraldi vana veebileht, vaid sama ruumilise struktuuri teine esitus** (ruumidoc ptk 10): flat-režiim (registreerimislennu perspectiveWorks-proov + reduced-motion → sama jaamamudel ristsulandusega) on selle kehtiv referentsteostus.
*Tarbijad:* kõik ruumid. **Kvalifitseerub lepinguna** (mitte koodikihina — iga ruum teostab, leping ütleb MIDA).

### 5.3. Neli vastust

**1. Millised funktsioonid on sama ruumimudeli erinevad rakendused?**

| Ruum | K1 faasid | K2 objektid | K3 osalejad | K4 jagamine | eripära |
|---|---|---|---|---|---|
| Kovisioon [MAIN] | 8 etappi | juhtumilõuend | grupp | deidentifitseeritud sisend | referentsteostus |
| Supervisioon [BRANCH skeem] | lepingust lõpetamiseni | lõuend+refleksioonikaardid | üksik/grupp/org | superviisor-piirid | tasuline/lepinguline kiht |
| Elusündmuse ruum / Teekond (6.1) | elusündmuse faasid | sündmused, vajadused, eesmärgid, teenused | vaikimisi AINULT omanik | shareKeys→külmutatud väljavõtted | privaatsuse etalon |
| Tööheaolu püsiruum (6.2) | nädalarütm, mitte lineaarsed faasid | kirjed, piirid, taastumisplaan | ainult omanik | erand, mitte vaikeseis | jälgimiskeeld arhitektuuris |
| Kohtumise ühisvaade (6.11) | enne/ajal/järel | päevakord, küsimused, kokkulepe | pöörduja+spetsialist(+tugiisik) | kinnitatud kokkuvõte | U10 on selle v1 |
| Võrgustikuruum (6.8) | kaardistus→kokkulepped→seire | osalejakaart, kokkulepped, ülesanded | mitu organisatsiooni | 3-taseme nähtavus | rangeim piirimudel |
| Välitöö külastus (ptk 7) | ettevalmistus→kohal→järel | minimaalne kaasavõetav info, faktimärkmed | töötaja(+kaugtugi) | offline-mustand | mobiilne kest |
| ESTA piirkonnaruum (6.6) | — (pidev) | postitused, ettepanekud | liikmesusvärav | avalik/liikmete/konfidentsiaalne | partnertingimuslik |

Kõik kaheksa on K1–K4 kombinatsioonid. See EI tähenda, et nad ehitatakse ühe tabelina — see tähendab, et nad järgivad üht lepingut ja taaskasutavad samu komponente.

**2. Mida EI tohiks ehitada enne ühist ruumi- ja osalejakihti?**

- Võrgustikutöö täis-MVP (6.8) — vajab K3+K4 rangeimat vormi; enne ühiskihti tekiks kolmas paralleelne liikmelisussüsteem.
- Kohtumise ühisvaate täisversioon (6.11) — v.a U10 sild, mis kasutab olemasolevat ruumi.
- ESTA kogukonnaruumid (6.6) — liikmesusvärav vajab K3 + partnerlusotsust.
- Genogramm/ökokaart jagamisega (6.10) — K2+K4 + kolmandate isikute õigusanalüüs.
- Organisatsiooniline supervisioon ja org-analüütika (6.4, 6.12) — org-mudel on eraldi otsus; k-anonüümsuse muster on olemas, aga org-seos mitte.
- Püsivad professionaalsed koostööruumid (6.5) — elutsüklileping (K7) enne.
- Teekonna kompassi TÄIS-versioon enne O-TK9 otsust ja K5 sündmuskihta (kompass ilma sündmusteta oleks staatiline pilt).

**3. Milliseid olemasolevaid funktsioone saab säilitada ja hiljem ühisele alusele tõsta?**

Kõik. Mitte ühtegi töötavat voogu ei pea ümber kirjutama enne ühiskihti:

- **Kovisioon** — säilib; temast EKSTRAKTITAKSE leping (faasid, sulgemine, purge). Hilisem tõstmine = refaktor, mitte ümberehitus. Enne seda ainult KOV-R parandused (lõuendireegel).
- **Room-süsteem** — säilib ja LAIENEB (tüüp, eesmärk, elutsükkel) — mitte ei asendata uue „Space"-mudeliga.
- **PreInquiry** — säilib; SharedVersion-muster üldistatakse K4 lepinguks; U3 (tagasivõtt) lisandub kohale.
- **Teekond** — säilib privaatse tuumana; kompass ehitatakse TEMA PEALE, mitte asemele (6.1).
- **Tööheaolu vormid** — säilivad; püsiruum on nende ümber, mitte asemel (6.2). E0 merge enne.
- **Teenusekaart** — säilib; 3D on seotud vaade, mitte asendus (ptk 8).
- **Registreerimislend** — flight-mootor üldistatakse teekonna-esituseks (K1 UI-pool) pärast commit'i ja kontrolli.

**4. Milline on väikseim ühine ruumiarhitektuur, mis ei lukusta platvormi liiga vara?**

Neli sammu, selles järjekorras:

1. **K5 miinimum = U1 sündmuskiht** (sündmusetabel + 5 tüüpi + e-kiri + badge-tootja). Kõige väiksem, kõige rohkem tarbijaid, ei lukusta midagi — sündmusetüüpe saab alati lisada.
2. **K1 = tööruumileping DOKUMENDINA + JSON-kontraktina**, mitte andmebaasi supertabelina. Iga moodul hoiab oma tabelid; leping ütleb, millised väljad/olekud/üleminekud peavad olemas olema ja kuidas nad K5 sündmusteks tõlgitakse. Valideeritakse KAHE tarbija vastu: Kovisioon (olemas) + SUP-V0 (skeem harus) — kui leping katab mõlemad, on ta piisavalt üldine.
3. **K3/K4 = Room+Invite ühtlustus**: rollivahetus/üleandmine (U11), „liige ≠ päritoluligipääs" reegli eksplitsiit, jagamise elutsükli lõpuleviimine (U3 pöördumise tagasivõtt + U12 „Minu jagamised").
4. **K2 = objektilepingu esimene komponentversioon** ühe päris tarbija vajaduses (tõenäoliselt kohtumise kokkulepe U10 või Kovisiooni lõuendi kaardid) — mitte enne.

**Anti-lukustuse reeglid** (mida teadlikult MITTE teha):

- EI ühte polümorfset `SpaceObject`-supertabelit — iga objektitüüp oma tabelis, ühine on leping ja UI-komponendid.
- EI PostgreSQL enum'e faasidele/olekutele (enum-laiendus on tagasipööramatu — kinnitatud reegel); olekud rakenduskihi konstantidena.
- EI org-mudelit enne tooteomaniku otsust — U11 v1 töötab „käsitsi valitud kolleegile" ilma hierarhiata.
- EI universaalset õigustemudelit (RBAC-raamistikku) — ruumipõhised rollid + omanikupiirded on piisavad, kuni ESTA/org-vajadus on kinnitatud.
- EI geo/3D-kihti alusarhitektuuri — see on esituskiht (K8), mis loeb samu andmeid.

## 6. Tulevikusuundade töölaud

Iga teema täidab sama malli: kasutaja tegelik vajadus · praegune teostus · soovitud ruumiline kogemus · põhifaasid · püsivad tööobjektid · osalejad ja rollid · privaatne/jagatud kiht · AI roll ja piir · seos teiste ruumidega · ühised platvormikomponendid (K1–K8) · privaatsus- ja turvariskid · tooteomaniku otsused · väikseim kasulik prototüüp · võimalik esimene arenduspakett · mida praegu teadlikult mitte ehitada.

### 6.1. Teekonna kompass / elusündmuse tööruum

- **Kasutaja tegelik vajadus:** „kus ma oma loos olen, mis on muutunud, mis on võimalik, mis on järgmine samm?" — elusündmuse (lahutus, töökaotus, lähedase hooldus, laste heaolu) mõtestamine aja jooksul, mitte ühe vestluse sees.
- **Praegune teostus [MAIN]:** Journey töötab: vestlusest kokkuvõte, kinnitamine, shareKeys-jagamine eelpöördumisse; „Jätka viimast". UX-juured (teekond-analüüs): olek pole URL-is, kerimisblokk, shareKeys katab ainult assistiveDevices. O-TK9 (SENT-teekonna säilitus) lahtine [DECISION].
- **Soovitud ruumiline kogemus [VISION]:** Teekond EI muutu uueks mooduliks — see saab kolm kihti: (1) **Teekond** = privaatne andmetuum (jääb); (2) **elusündmuse tööruum** = sama objekti ruumiline kest, kus sündmused, vajadused, tugevused, takistused, eesmärgid ja teenused on liigutatavad objektid ajajoonel/kaardil; (3) **Teekonna kompass** = navigeerimiskiht, mis vastab neljale küsimusele (kus olen / mis on oluline või muutunud / millised suunad / mis järgmiseks). Kompass on esimene asi, mida naasev kasutaja näeb — mitte loend, vaid tema oma ruum.
- **Põhifaasid:** kirjeldamine → olulise märkimine → vajaduste/tugevuste pilt → eesmärgi valik → sammud (teenused, pöördumised, inimesed) → seire/naasmine. Faasid on Z-teljel külastatavad, mitte lineaarselt sunnitud; kasutaja võib mitut rada paralleelselt hoida (handoff'i põhimõte).
- **Püsivad tööobjektid:** sündmus (ajajoonel), vajadus, tugevus, takistus, eesmärk, valitud teenus/kontakt, kinnitatud kokkuvõte, jagatud väljavõte (külmutatud).
- **Osalejad ja rollid:** vaikimisi AINULT omanik. Teisi inimesi EI OLE selles ruumis — jagamine toimub väljavõtete kaudu (eelpöördumine, tugiisiku ruum), mitte ruumi kutsumisega. See on põhimõtteline erinevus võrgustikuruumist.
- **Privaatne/jagatud kiht:** kogu ruum privaatne; jagatav on ainult kasutaja koostatud külmutatud väljavõte (PreInquiry SharedVersion-muster). Kompass näitab, MIS on jagatud ja kellele (U12 integratsioon).
- **AI roll ja piir:** struktureerib kirjeldust, pakub kaalumiseks vajadusi/suundi/allikaid, koostab väljavõtte mustandi; EI otsusta eesmärki, EI saada midagi, EI lisa kinnitamata infot. Iga AI-ettepanek kannab mustandi-märgist kuni kasutaja kinnituseni (K2 päritolu).
- **Seos teiste ruumidega:** kompass on pöörduja „maja" keskpunkt — sealt avanevad uksed vestlusesse, eelpöördumisse, dokumentidesse, Teenusekaardile, tugiisiku ruumi; iga funktsiooni tulemus võib kasutaja kinnitusel saada Teekonna sündmuseks (K5).
- **Ühised platvormikomponendid:** K1 (faasid), K2 (objektid+päritolu), K4 (väljavõtete jagamine), K5 (sündmused — kompassi „mis on muutunud" EI TÖÖTA ilma selleta), K6 (järgmine samm), K8 (ajajoon + loendivaade).
- **Privaatsus- ja turvariskid:** elusündmuse ruum koondab inimese kõige tundlikuma loo ühte kohta — kompromiteeritud konto kahju kasvab; säilitusreegel (O-TK9) muutub veel olulisemaks; „jaga kogu Teekond" nuppu ei tohi kunagi tekkida (ainult väljavõtted).
- **Tooteomaniku otsused:** O-TK9 A/B/C (SENT-säilitus) [DECISION]; kas elusündmusi võib olla mitu paralleelset (soovitus: jah, aga v1-s üks aktiivne); kompassi nimi kasutajale.
- **Väikseim kasulik prototüüp:** kompass-vaade OLEMASOLEVA Teekonna peale: ajajoon + „muutunud pärast viimast külastust" (vajab U1) + järgmine samm + jagamiste seis. Ilma uue andmemudelita.
- **Võimalik esimene arenduspakett:** TK-KOMPASS-P0 — kompassi lugemisvaade (U1+U2 peal), URL-olek, kerimisbloki parandus. Eeldused: U1, O-TK9.
- **Mida teadlikult MITTE ehitada:** elusündmuse „liigituspuud" (elusündmus on kasutaja sõnades, mitte taksonoomias); automaatset faasivahetust; Teekonna ja elusündmuse ruumi KAHTE eraldi objekti (see ongi dubleerimise oht, mida ülesanne keelab — üks objekt, kolm kihti).

### 6.2. Tööheaolu iganädalane püsiruum

- **Kasutaja tegelik vajadus:** spetsialist vajab kohta, kuhu regulaarselt (nt reede lõuna) naasta: mis nädalal juhtus, kui koormatud ma olen, kas taastun, kus mu piirid pidasid, mis on muutunud — ILMA et sellest saaks aruanne kellelegi.
- **Praegune teostus:** [MAIN] 10 põhjalikku vormi (kiirkontroll, raske juhtum, töövägivald, taastumine, piirid, alustaja tugi jm) + privaatsed kirjed + k-anonüümne agregaat; [BRANCH] E0 detektoriparandus `fe8c7df2` (V17 valepositiiv, 1238/1238) ootab merge'i. Analüüsi leid: 10 head vormi ILMA tervikuta — kirjete lugemisrada puudub, vormide vahel pole seost, naasmise rütmi pole.
- **Soovitud ruumiline kogemus [VISION]:** privaatne TUBA (ruumigrammatikas: Tööheaolu on maja privaatne ruum, „sama maja privaatne tuba, mitte järelmõte"). Ruum muutub vastavalt sellele, mis kasutaja sinna tõi (ideed 7.6): raske juhtum toob teistsuguse ruumi kui taastumine. Nädalane naasmine = uks avaneb sinna, kus eelmine kord pooleli jäi; ajas muutumine on NÄHTAV (minu koormuse/taastumise lugu, mitte punktmõõtmised).
- **Põhifaasid:** mitte lineaarne teekond, vaid RÜTM: sisenemine („kuidas läheb?") → nädala sündmuste märkimine → vajadusel sügavam vorm (olemasolevad 10) → piiride/toe ülevaade → järgmine samm (sh Kovisiooni/Supervisiooni sisendi loomine) → lahkumine kokkuvõttega.
- **Püsivad tööobjektid:** nädalakirje, sündmus (raske juhtum, õnnestumine), koormuse/taastumise märge, tööpiir (kokkulepe iseendaga), tugikontakt, muutuse tähis.
- **Osalejad ja rollid:** AINULT omanik. Mitte kunagi tööandja, mitte kunagi admin sisuvaates.
- **Privaatne/jagatud kiht:** kõik privaatne; AINSAD väljundid on (a) k-anonüümne agregaat (olemas) ja (b) kasutaja enda algatatud deidentifitseeritud sisend Kovisiooni/Supervisiooni (ideed 19.7: jagamine on erand).
- **AI roll ja piir:** peegeldab mustreid kasutaja OMA kirjetest („kolmandat nädalat järjest märgid unehäireid — kas tahad vaadata taastumise tuge?"), pakub vorme ja allikaid; EI diagnoosi, EI teavita kedagi, EI hinda töövõimet. Kriisisignaalide korral näitab abikontakte (sama kriisirada mis vestluses — VEST-P0a järel).
- **Seos teiste ruumidega:** sisend Kovisiooni/Supervisiooni ettevalmistusse (deidentifitseeritud, kasutaja algatusel); raske juhtumi järel välitööst/kohtumisest võib kasutaja luua Tööheaolu kirje (ptk 7); KOV-koond (ideed 21) ainult k-anonüümselt.
- **Ühised platvormikomponendid:** K1 (rütm kui faasivariant), K5 (nädala-meeldetuletus = U1 sündmus; „mis on muutunud"), K7 (isikliku ajaloo säilitusreegel), K8 (privaatne pind; loendivaade).
- **Privaatsus- ja turvariskid:** SUURIM risk on funktsiooni USALDUSE kaotus — kui töötaja kahtlustab, et juht näeb, on kiht surnud. Jälgimiskeeld peab olema arhitektuuriline (mitte-ehitada nr 8: edetabelid/võrdlused keelatud; ideed 21.7 juhi piirid). Agregaadi väikeste gruppide kaitse (olemas) peab säilima iga uue näitajaga.
- **Tooteomaniku otsused:** nädalarütmi vaikeseade (meeldetuletus sisse/välja); kas nädalakirje on eraldi kergvorm või kiirkontrolli evolutsioon; KOV-koondi avamise tingimused (ideed 21 — partnerleppega).
- **Väikseim kasulik prototüüp:** „minu nädal" vaade olemasolevate kirjete PEALE: ajajoon + rütmi-meeldetuletus (U1) + „jätka pooleli vormiga". Null uut vormi.
- **Võimalik esimene arenduspakett:** E0 merge (eeldus!) → TH-RUUM-P0: nädalavaade + naasmispunkt + U1 meeldetuletus. E1–E6 (tervikloogika analüüsist) mahutuvad selle taha.
- **Mida teadlikult MITTE ehitada:** tööandja dashboard'i; „heaoluskoori"; automaatset HR-teavitust; kohustuslikku täitmist (rütm on kutse, mitte kohustus); seost individuaalse töötaja ja juhtumite statistika vahel.

### 6.3. Kovisioon

- **Kasutaja tegelik vajadus:** juhtumi kolleegidevaheline mõtestamine turvalises struktuuris: keskne küsimus, vaatenurgad, pimekohad, meetodid, järeldused — ja et lõpetatud juhtumitest jääks õppimisvara.
- **Praegune teostus [MAIN]:** KÕIGE KÜPSEM ruumiline funktsioon — 8 etappi, atomaarne sulgemine, purge, lõpetatud juhtumid, praktika-retsensioon, RAG-tugi; kõik runtime-tõendatud (CovisionWorkspace; vana CovisionSession.jsx on surnud demo). Teada viga: cvl-kesta lõuendireegel rikutud (covision-live.css overflow — KOV-R R1-P0, parandus paketis P2).
- **Soovitud ruumiline kogemus [VISION]:** ümberkujundus on LAVASTUSE, mitte loogika vahetus (ruumidoc 7.5): etapid võivad paikneda ruumi eri osades, kaamera/fookus liigub tööga; ühine laud (juhtumilõuend) + iga osaleja privaatne märkmik (K8 privaatne kõrvalpind); kokkulepped tõusevad „seinale" (nähtav ja kinnitatav); refleksioon on eraldi rahulik ala. Kõik 8 etappi EI PEA olema korraga nähtavad — ruum toob esile aktiivse.
- **Põhifaasid:** olemasolevad 8 etappi ON faasid — need on kogu platvormi K1 lepingu referents. Ei muudeta enne, kui leping on neist ekstraktitud.
- **Püsivad tööobjektid:** juhtumikaart (deidentifitseeritud), vaatenurk, pimekoht, meetod, kokkulepe, järeldus, retsensioon.
- **Osalejad ja rollid:** grupp (olemas); juhi/fassilitaatori roll [DECISION — kas eristada].
- **Privaatne/jagatud kiht:** ühine lõuend + TULEVIKUS privaatne märkmik (praegu puudub — see on suurim ruumiline lisandus); sisend Tööheaolust/Meetodipeeglist tuleb deidentifitseeritult kasutaja kinnitusel.
- **AI roll ja piir:** RAG-tugi on olemas (metoodikaallikad); AI võib pakkuda refleksiooniküsimusi ja meetodivihjeid; EI hinda juhtumit, EI tee kokkuvõtet automaatselt jagatavaks.
- **Seos teiste ruumidega:** Meetodipeegel (6.7) annab ettevalmistatud sisendi; Tööheaolu (6.2) raske juhtumi järel; Supervisioon (6.4) kui kovisioonist ei piisa; lõpetatud juhtumid → õppimisvara (olemas).
- **Ühised platvormikomponendid:** ANNAB K1 lepingu (faasid+sulgemine+purge); tarbib K3 (osalejad — praegu oma, hiljem ühine), K5 (kutse/algus/kokkuvõte sündmused), K8 (privaatne märkmik).
- **Privaatsus- ja turvariskid:** deidentifitseerimise kvaliteet on inimese vastutus — AI-eelkontroll (piiFilter) toetab; lõpetatud juhtumite õppimisvara ei tohi olla tagasi-identifitseeritav.
- **Tooteomaniku otsused:** fassilitaatori rolli eristamine; privaatse märkmiku säilitusaeg; ruumilise ümberkujunduse järjekord (enne/pärast ühiskihti — soovitus: PÄRAST, sest Kovisioon on lepingu doonor, mitte esimene tarbija).
- **Väikseim kasulik prototüüp:** privaatne märkmik olemasoleva lõuendi kõrvale (K8 muster ühe funktsiooni sees); üks etapp „ruumis eraldi alana" (nt refleksioon) flight-üleminekuga.
- **Võimalik esimene arenduspakett:** KOV-R P2 (lõuendireegli parandus — juba järjekorras) → seejärel märkmik. Ruumiline täisümberkujundus alles horisont C-s.
- **Mida teadlikult MITTE ehitada:** automaatset transkriptsiooni+kokkuvõtet vaikimisi (mitte-ehitada nr 7); etappide vahelejätmise sundi ega lukustust; Kovisiooni loogika ümberkirjutust ühiskihi nimel (leping võetakse TEMALT).

### 6.4. Supervisioon

- **Kasutaja tegelik vajadus:** töötaja-kliendi suhte, emotsionaalsete reaktsioonide, töömustrite, professionaalse identiteedi ja läbipõlemisriski käsitlemine kvalifitseeritud superviisoriga — individuaalselt, grupis või organisatsioonis.
- **Praegune teostus:** [MAIN] mitte midagi; [BRANCH] SUP-P0 V0-skeem `2fc826c4` — **lokaalne, push'imata, auditita**. Analüüs COMPLETE: tootemudel Q1+Q2 (13 mudelit, 27 rida, purge-tehing, 18 testi, paketid SUP-P0…P11). Rollipiir fikseeritud: ESTA = mentorite andmebaas (MITTE teenuseosutaja); superviisorite register = ESCÜ/ANSE.
- **Soovitud ruumiline kogemus [VISION]:** supervisiooniRUUM kui keskne töövorm (ideed 23: kohtumine EI OLE keskne objekt — ruum on): eesmärk ja kokkulepe ruumi „seinal", supervisioonilõuend, kirjalik koostöö kohtumiste vahel, refleksioonikaardid, privaatne ja jagatud ala eristatud. Individuaalne ruum on kahene (supervisant + superviisor); grupiruum lisab liikmed; org-ruum lisab tellija, kes EI näe sisu.
- **Põhifaasid:** leping (eesmärk, konfidentsiaalsus, maht) → töö (kohtumised + vahepealne kirjalik) → vahehindamine → lõpetamine (kokkuvõte, mida supervisant kontrollib) → purge-reegel.
- **Püsivad tööobjektid:** supervisioonileping, teema/juhtum (deidentifitseeritud), refleksioonikaart, kokkulepe, kohtumismärge, lõpukokkuvõte.
- **Osalejad ja rollid:** supervisant, superviisor (kontrollitud tiitel, mitte uus põhiroll — ideed 3.3), grupiliikmed; org-tellija AINULT metatasandil (toimumine, mitte sisu).
- **Privaatne/jagatud kiht:** supervisandi privaatne ettevalmistus / ühine tööala / superviisori privaatsed märkmed — kolm kihti; org-tellija ei näe ühtegi sisukihti [threshold sama mis Tööheaolu jälgimiskeeld].
- **AI roll ja piir:** ettevalmistuse struktureerimine (Tööheaolu/Meetodipeegli sisendist), refleksiooniküsimused; EI analüüsi supervisiooni sisu, EI tee superviisori tööd, EI hinda supervisanti.
- **Seos teiste ruumidega:** sisendid Tööheaolust/Kovisioonist/Meetodipeeglist (kasutaja algatusel, deidentifitseeritult); Kovisioon → Supervisioon eskalatsioonitee; ESTA (6.6) kui mentorite/superviisorite leidmise partner.
- **Ühised platvormikomponendid:** K1 lepingu TEINE valideerija (vt 5.4 samm 2); K3 (osalejad), K4 (org-tellija piiratud nähtavus on jagamislepingu erijuht), K7 (lepingu lõpp + purge).
- **Privaatsus- ja turvariskid:** tasuline/lepinguline suhe toob maksete ja vastutuse küsimused; org-tellitud supervisioonis on jälgimisrisk sama terav kui Tööheaolus; superviisori kvalifikatsiooni kontroll (register).
- **Tooteomaniku otsused:** tasumudel (kes maksab: töötaja/KOV/ESTA-pakett — ideed 26 „ühe euro mudel" on ettepanek, MITTE kokkulepe); superviisorite registri liidestus; SUP-P0 auditijärjekord.
- **Väikseim kasulik prototüüp:** individuaalne ruum: leping + kirjalik koostöö + lõpetamine (SUP-P0 skeemi peal, ilma grupi/org-kihita).
- **Võimalik esimene arenduspakett:** SUP-P0 push + sõltumatu audit (handoff'i järjekorras) → SUP-P1 (individuaalne tuum). Grupi/org-kihid alles pärast K3 ühtlustust.
- **Mida teadlikult MITTE ehitada:** org-supervisiooni enne org-mudeli otsust; superviisori „turgu"/hinnavõrdlust; supervisiooni sisu jõudmist ühegi koondi/analüütika kihti; ESTA partnerlust eeldavaid funktsioone enne lepet (6.6).

### 6.5. Koostöövariandid ja professionaalne ühistegevus

- **Kasutaja tegelik vajadus:** kolleegidega töötamine juhtumi, teema või piirkonna ümber — vahel ühe küsimuse ajaks, vahel püsivalt (töörühm, praktikakogukond); ning töö üleandmine puhkuse/lahkumise korral.
- **Praegune teostus [MAIN]:** vestlusruumid (ajutine koostöö toimib), Kovisioon (struktureeritud grupivorm); püsivaid koostööruume, kogukondi ega üleandmist pole. U11 (töö üleandmine) analüüsitud [DOC].
- **Soovitud ruumiline kogemus [VISION]:** koostöö = ruumi ELUTSÜKLI pikendus, mitte uus moodul. Ajutine ruum (küsimus → lahendus → sulgemine) ja püsiv ruum (eesmärk → pidev töö → arhiveerimine) on sama K1 lepingu kaks profiili. Püsiruumis lisanduvad: ühised tööobjektid (dokumendid, kokkulepped, ülesanded), rollide rotatsioon, liikmete tulek-minek ilma ruumi surmata.
- **Põhifaasid:** loomine (eesmärk+tüüp) → liikmete kutse → töö → (ajutisel) sulgemine kokkuvõttega / (püsival) perioodiline ülevaatus „kas ruum elab?" → arhiveerimine.
- **Püsivad tööobjektid:** ruumi eesmärk, kokkulepped, ühised dokumendid (viidetena, K4 kaudu), ülesanded (K6), kohtumismärkmed.
- **Osalejad ja rollid:** looja/omanik, liikmed; omanikuvahetus (U11 ruumi-pool) on püsiruumi eeltingimus — muidu sureb ruum omaniku lahkumisega.
- **Privaatne/jagatud kiht:** ruum on liikmetele ühine; iga liikme privaatne märkmik (K8) kehtib ka siin; ruumi kutsumine ei anna ligipääsu liikmete muudele objektidele (K3 reegel).
- **AI roll ja piir:** kokkuvõtete mustandid, päevakorra ettevalmistus; EI modereeri sisu, EI hinda liikmete aktiivsust.
- **Seos teiste ruumidega:** Kovisioon ja Supervisioon on selle mudeli STRUKTUREERITUD erijuhud; ESTA teemakogukonnad (6.6) on liikmesusväravaga variant; võrgustikuruum (6.8) on kliendikeskne variant rangema piirimudeliga.
- **Ühised platvormikomponendid:** K1 (elutsükliprofiilid), K3 (rollid+omanikuvahetus), K5 (ruumi sündmused), K6 (ülesanded), K7 (arhiveerimine — MITTE kustutamine vaikimisi).
- **Privaatsus- ja turvariskid:** püsiruumi „unustatud liikmed" (inimene lahkus töölt, ligipääs jäi) — perioodiline liikmeülevaatus; juhtumiinfo lekkimine üldkogukonda (deidentifitseerimispiir sama mis Kovisioonis).
- **Tooteomaniku otsused:** O-KO1: kas püsiruumi omanikuvahetus nõuab mõlema kinnitust; kogukonnaruumide moderatsioonimudel; kas püsiruumid on v1-s ainult professionaalidele (soovitus: jah).
- **Väikseim kasulik prototüüp:** olemasoleva ruumi „ei sulgu automaatselt" profiil + omanikuvahetus + liikmeülevaatuse meeldetuletus (U1).
- **Võimalik esimene arenduspakett:** U11 (üleandmine: pöördumine + ruumi omanikuroll) — väike, auditeeritav, iseseisev väärtus.
- **Mida teadlikult MITTE ehitada:** üldist DM-süsteemi (mitte-ehitada nr 3); avalikku foorumit pöördujatele (nr 4); org-hierarhiat enne org-otsust; „aktiivsuse" mõõdikuid.

### 6.6. ESTA

- **Kontekst:** ESTA = Eesti Sotsiaaltöö Assotsiatsioon — VÕIMALIK tulevane erialane koostööpartner, MITTE uus põhikasutajaroll ega kokkulepitud partnerlus. Kõik siinne on [VISION][DECISION]; midagi ei esitata kokkulepituna.
- **Kasutaja tegelik vajadus:** erialane kuuluvus ja professionaalne kogukond: piirkonna kolleegid, teemakogukonnad, metoodikaülevaatus, liikmehüved (nt supervisioonipakett), huvikaitse hääl.
- **Praegune teostus [MAIN]:** mitte midagi ESTA-spetsiifilist; ideed 25–27 kirjeldavad partnerluse põhimõtet, liikmepaketti („ühe euro mudel"), foorumit, piirkonnaruume, teemakogukondi, ligipääsutasemeid.
- **Soovitud ruumiline kogemus [VISION]:** ESTA-alad on ruumigrammatika „AKEN + UKS" kombinatsioon: spetsialisti majast avaneb vaade erialasesse maailma (piirkonnaruum, teemakogukonnad), sissepääs liikmesusväravaga. Ruumid ISE on 6.5 püsiruumi mudel + liikmesuskontroll — mitte uus arhitektuur.
- **Põhifaasid:** liikmestaatuse kinnitus → piirkonna/teemadega liitumine → osalus (postitused, küsimused, ettepanekud) → (ettepaneku teekond: piirkondlik → üleriigiline).
- **Püsivad tööobjektid:** liikmestaatus (kontrollitud tiitel), postitus, konfidentsiaalne liikmeküsimus, piirkondlik ettepanek, metoodikaülevaatuse kirje.
- **Osalejad ja rollid:** ESTA liige = TIITEL olemasoleval kasutajal (ideed 3.3 — mitte uus konto ega roll); piirkonna moderaator = tiitel + ruumiroll; ESTA org ise = partneri haldusvaade [DECISION].
- **Privaatne/jagatud kiht:** kolm ligipääsutaset (ideed 27.5): avalik / liikmete / konfidentsiaalne; liikmestaatuse lõppemine sulgeb ligipääsu (K4 kestus).
- **AI roll ja piir:** kogukonnasisu kokkuvõtted ja otsing; erialase sisu märgistus (ideed 25.4: ESTA-ülevaadatud materjal teadmusbaasis); EI modereeri automaatselt, EI hinda liikmeid.
- **Seos teiste ruumidega:** supervisiooni mentorite andmebaas (6.4); metoodikaülevaatus → teadmusbaasi kvaliteedikiht (U8 laiendus); Meetodipeegli valideerimispartner (U7 selge keele kvaliteet — sobiv koostööteema, kuid ei sõltu sellest).
- **Ühised platvormikomponendid:** K3 (liikmesusvärav = uus liikmelisuse TÜÜP, mitte uus süsteem), K4 (tasemepõhine nähtavus), K5, K7 (postituste elutsükkel).
- **Privaatsus- ja turvariskid:** liikmestaatuse kontrolli värskus (lõppenud liikmelisus → ligipääs peab sulguma); konfidentsiaalse liikmeküsimuse kaitse; partneri haldusvaade EI tohi näha liikmete platvormitegevust väljaspool ESTA-alasid.
- **Tooteomaniku otsused:** KOGU partnerlus [DECISION] — enne lepet ei ehitata midagi; liikmekontrolli mehhanism (register/API/käsitsi); „ühe euro mudeli" tingimused (ideed 26.7 lepinguküsimused).
- **Väikseim kasulik prototüüp:** (alles pärast lepet) üks piirkonnaruum 6.5 püsiruumi + liikmesusvärava peal.
- **Võimalik esimene arenduspakett:** — (blokeeritud partnerlusotsusega).
- **Mida teadlikult MITTE ehitada:** mitte midagi enne partnerluslepet; ESTA-t kui uut kasutajarolli; avalikku foorumit; liikmete edetabeleid.

### 6.7. Meetodipeegel

- **Kasutaja tegelik vajadus:** professionaalse valiku refleksioon: millise lähenemise/meetodi valisin, miks, kuidas klient reageeris, mis töötas, kas vajan teistsugust lähenemist või tuge.
- **Praegune teostus [MAIN]:** mitte midagi eraldi; ideed 8 (refleksioonikirje mudel, meetodi valimise assistent, sekkumispäevik, kliendi tagasiside eristus, Kovisiooni ettevalmistus) + ideed 6–7 (nelja tasandi mudel + 36 meetodi kataloog) on põhjalik [DOC].
- **Vastus ülesande küsimusele:** Meetodipeegel EI OLE eraldi funktsioon — see on **professionaalse refleksiooni ÜHINE KIHT**, mida tarbivad juhtumitöö (6.9), Kovisioon (6.3), Supervisioon (6.4) ja Tööheaolu (6.2). Eraldi „Meetodipeegli leht" tekitaks viienda koha, kuhu spetsialist peab eraldi minema; kihina ilmub ta SEAL, kus töö toimub (tegevuse/kohtumise juurest „ava refleksioon").
- **Soovitud ruumiline kogemus [VISION]:** ruumidoc 7.3: meetod kui „lääts" — kliendi vajadus, valitud meetod, tehtud võte, reaktsioon ja alternatiivid asetatakse KÕRVUTI (vaba lõuendi muster); refleksioonikirje on püsiv objekt, mille saab (deidentifitseeritult, kinnitusel) viia Kovisiooni/Supervisiooni.
- **Põhifaasid:** tegevuse juurest avamine → fakti/tõlgenduse lahutamine → meetodi ja reaktsiooni kõrvutamine → järeldus/järgmine valik → (valikuline) toevajaduse märkimine.
- **Püsivad tööobjektid:** refleksioonikirje (PracticeReflection — ideed 12 andmemudelis juba visandatud), meetodikaart (teadmusbaasist), „mis töötas / ei töötanud" märge.
- **Osalejad ja rollid:** AINULT töötaja; visibility: PRIVATE on mudeli vaikeseis (ideed 12).
- **Privaatne/jagatud kiht:** täielikult privaatne; väljund ainult deidentifitseeritud mustandina Kovisiooni/Supervisiooni (kasutaja kinnitusel).
- **AI roll ja piir:** pakub kaalumiseks meetodeid+põhjuseid+riske+refleksiooniküsimusi (ideed 8.4); hüpotees EI muutu automaatselt kirjeks; EI määra „õiget" meetodit; praktika arenguvaade (8.8) EI tohi kunagi saada tööandja hindamisvahendiks.
- **Seos teiste ruumidega:** JTA tegevuse järelrefleksioon; Kovisiooni ettevalmistuse allikas; Supervisiooni teemade allikas; Tööheaolu (raske juhtumi refleksioon võib suunduda kumbagi).
- **Ühised platvormikomponendid:** K2 (päritolumärgistus on SELLE kihi tuum — fakti/tõlgenduse/AI eristus), K7 (kirje säilitusreegel).
- **Privaatsus- ja turvariskid:** kliendi andmed refleksioonis (deidentifitseerimise tugi vajalik); org-õppimise vs töötaja-jälgimise piir (ideed 17 k15) [DECISION].
- **Tooteomaniku otsused:** nimi (Meetodipeegel/Praktikapeegel); kas metoodikakataloog (ideed 7) siseneb teadmusbaasi eraldi kihina ja kes kinnitab (ideed 17 k13–14).
- **Väikseim kasulik prototüüp:** refleksioonikirje ÜHES kohas — kohtumise/tegevuse järel „ava refleksioon" (Kovisiooni-eelse mustandi generaator on loogiline algus, sest Kovisioon on olemas).
- **Võimalik esimene arenduspakett:** ideed Etapp 3 (Meetodipeegli seos) — alles pärast JTA õhukest tuuma (Etapp 2), sest refleksioon vajab tegevust, mille kohta reflekteerida.
- **Mida teadlikult MITTE ehitada:** eraldi Meetodipeegli „moodulit" navigatsioonis; meetodite automaatsoovitust ilma konteksti ja piirideta; töötajate meetodikasutuse võrdlusstatistikat.

### 6.8. Võrgustikutöö

- **Kasutaja tegelik vajadus:** inimese/juhtumi/teema ümber osalejate, organisatsioonide, rollide, vastutuse ja kokkulepete NÄHTAV kaart + koordineeritud tegevus, ilma et iga osaleja näeks kogu juhtumit.
- **Praegune teostus [MAIN]:** vestlusruumid + kutsed katavad kirjaliku koostöö; võrgustiku KAARTI, rolle, kokkuleppeid, nähtavustasemeid pole. Ideed 5 (töölaud, 3 infotaset, vertikaalne lõik, võrgustikukaart, teenuseosutaja/perearsti piirid) on põhjalik [DOC].
- **Soovitud ruumiline kogemus [VISION]:** ühine LÕUEND (ruumidoc 7.4): osapooled, suhted, rollid, kokkulepped, tähtajad ja infopiirid paigutatuna; osaleja lisamine = kaardile asetamine + nähtavuspiiri määramine SAMAS liigutuses. Kaugus/ühendus kannab tähendust (K2). Kutsumine EI anna ligipääsu juhtumile — ainult jagatud kokkuvõttele (ideed 5.2 kolm taset).
- **Põhifaasid:** kaardistus (kes on olemas) → puuduva rolli märkamine → kliendi kinnitatud jagatav kokkuvõte → piiratud kutsed → koordineeritud töö (kohtumised, ülesanded) → kokkulepete seire → lõpetamine (ligipääsude sulgemine).
- **Püsivad tööobjektid:** osalejakaart (roll, organisatsioon, kaasamise eesmärk, jagamispiir, algus/lõpp, viimane kontakt), kokkulepe, ülesanne vastutajaga, jagatud kokkuvõte (külmutatud).
- **Osalejad ja rollid:** koordinaator (juhtumitöötaja), kliendi kinnitusega kaasatud osapooled; perearst/kool/Töötukassa = piiratud VÄLISED liikmed (ideed 5.7: meditsiinimoodulit EI OLE).
- **Privaatne/jagatud kiht:** kolm taset (privaatne juhtumiinfo / võrgustikuga jagatud kokkuvõte / osalejaga seotud ülesanne) — see on K4 kõige rangem tarbija.
- **AI roll ja piir:** puuduva rolli/teenuse märkamine, kokkuvõtte mustand (kliendi kinnitusel), kokkuleppe mustand STAR2 jaoks; EI otsusta kaasamist, EI jaga midagi ise.
- **Seos teiste ruumidega:** JTA-st avatav (6.9); Teenusekaardilt osutaja valimine; genogramm/ökokaart = sama ruumi vaated (6.10); kohtumise ühisvaade (6.11) võrgustikukohtumisel.
- **Ühised platvormikomponendid:** K2 (kaart-objektid), K3+K4 TÄISMAHUS (see on põhjus, miks võrgustik EI TOHI tulla enne ühiskihti — vt 5.3 v2), K5 (kokkuleppe tähtajad), K6, K7 (ligipääsu lõpp).
- **Privaatsus- ja turvariskid:** SUURIM kolmandate isikute andmete pind platvormil (kliendi võrgustikus on inimesi, kes pole kasutajad); üleliigse info jagamine kutsega; ligipääsu mittelõppemine. GDPR-analüüs kohustuslik enne teostust.
- **Tooteotsused:** millal võrgustikuliikme ligipääs lõpeb (ideed 17 k9); mitteliikmete (kaardil olevate mittekasutajate) andmete reeglid; vertikaalse lõigu piiritlus.
- **Väikseim kasulik prototüüp:** ideed 5.3 vertikaalne lõik: kokkuvõte → ÜKS piiratud kutsutud osaleja → kirjalik ruum → kokkuleppe mustand. Ilma kaardi-UI-ta.
- **Võimalik esimene arenduspakett:** ideed Etapp 4 (võrgustiku piiratud MVP) — PÄRAST K3/K4 ühtlustust (horisont B).
- **Mida teadlikult MITTE ehitada:** STAR2 juhtumiplaani koopiat; piiramatut võrgustikuandmete jagamist; tervishoiuandmete kihti; automaatset osalejasoovitust.

### 6.9. Juhtumitöö assistent

- **Kasutaja tegelik vajadus:** kohtumise ettevalmistus, puuduva info märkamine, mustandite struktureerimine, STAR2-sisestuse ettevalmistus, järeltegevused — ILMA topeltdokumenteerimiseta.
- **Praegune teostus [MAIN]:** eelpöördumiste vastuvõtulaud + tööplaan (receiverChecklist) + artefaktid + dokumendianalüüs töötavad; JTA-d kui tervikut pole. Ideed 4 + 10–12 (töölaud, päritolumärgistus, STAR2-järjekord, andmemudel) on kõige põhjalikum tulevikudokument [DOC].
- **Soovitud ruumiline kogemus [VISION]:** MUUTUV STUUDIO (ruumidoc 4.2 + 7.2): juhtumit mõtestades ilmuvad ruumi olukorra pilt, ajajoon, võrgustik, eesmärgid, dokumendid, järgmised sammud — mida on vaja, see on esil. STAR2-sse kantav kokkuvõte on ÜKS ruumist saadav tulemus, mitte ruumi eesmärk.
- **Põhifaasid:** eelpöördumise vastuvõtt → kohtumise ettevalmistus (fookus, küsimused, puuduv info) → kohtumine (märkmed: fakt/väide/tõlgendus eristatud) → STAR2-mustandi kontroll väljade kaupa → „Kopeeri STAR2 jaoks" → ülekantuks märkimine → refleksioon (6.7).
- **Püsivad tööobjektid:** ettevalmistus, puuduva info loend, kohtumismärge (päritolumärgistusega), STAR2-mustand (olekutega: mustand → kontrollitud → valmis → kantud / ei kanta), STAR2-viitenumber, järgmine kontakt (K6).
- **Osalejad ja rollid:** AINULT töötaja (privaatne tööruum); jagamine käib võrgustiku (6.8) või ruumide kaudu.
- **Privaatne/jagatud kiht:** täielikult privaatne; „STAR2-sse kantud" märge + viitenumber on ainus püsiv ametlik seos; privaatne refleksioon EI lähe kunagi STAR2-sse.
- **AI roll ja piir:** struktureerib, märkab puuduvat, koostab STAR2-struktuurile vastava mustandi; töötaja kontrollib IGA välja; „Kopeeri STAR2 jaoks", MITTE „Saada STAR2-sse" (ametlik liidestus ainult SKA/TEHIK-u leppega, kauge tulevik).
- **Seos teiste ruumidega:** vastuvõtulaud (olemas) on JTA sissepääs; võrgustik (6.8) avaneb siit; Meetodipeegel (6.7) on järelkiht; kohtumise ühisvaade (6.11) on kliendiga jagatud osa; välitöö (ptk 7) on mobiilne erijuht.
- **Ühised platvormikomponendid:** K2 (päritolumärgistus on JTA TUUM), K1 (ettevalmistus-faasid), K6 (järgmine kontakt), K7 (ülekantud mustandi säilitusreegel — ideed 17 k11).
- **Privaatsus- ja turvariskid:** varju-registri teke (kui mustandid jäävad elama pärast ülekannet) — säilitusreegel kohustuslik; kliendi eriarvamuse käsitlus (ideed 17 k6).
- **Tooteomaniku otsused:** ideed Etapp 0 TERVIKUNA (eelpöördumise õiguslik staatus, vastutav töötleja, säilitusajad — ideed 17 k1–k11) — need on JTA-le blokeerivad [BLOCKED_DECISION].
- **Väikseim kasulik prototüüp:** ideed Etapp 2 õhuke tuum: kohtumise ettevalmistus + puuduv info + päritolumärgistus + STAR2-mustand + „Kopeeri".
- **Võimalik esimene arenduspakett:** pärast Etapp 0 otsuseid ja Etapp 1 (eelpöördumise tervikvoo viimistlus, sh U3/U10) — horisont C algus.
- **Mida teadlikult MITTE ehitada:** SotsiaalAI ametlikku kliendibaasi; CaseGoal/CasePlan koopiat; automaatset STAR2-saatmist; AI riskihinnangut/triaaži (mitte-ehitada nr 5); STAR2 menetluse peeglit pöördujale (nr 2).

### 6.10. Genogramm ja ökokaart

- **Kasutaja tegelik vajadus:** pere struktuuri ja põlvkondademustrite (genogramm) ning inimese elukeskkonna seoste (ökokaart) visuaalne mõtestamine.
- **Praegune teostus [MAIN]:** mitte midagi; ideed 7 (meetodid 7–8) + 9.1–9.3 kirjeldavad sisu [DOC].
- **Vastus ülesande küsimusele:** JAH — need on **võrgustikuruumi (6.8) kaks eri VAADET**, mitte eraldi funktsioonid. Samad osapooled+suhted, eri projektsioon: genogramm = perestruktuur põlvkondade kaupa; ökokaart = seosed keskkonnaga (toetav/pingeline/katkenud); professionaalne võrgustikukaart = koordineeritud koostöö. Ideed 9.3 hoiatus püsib: öko- ja koostöökaarti EI segata — aga andmekiht (inimesed, suhted) on ühine.
- **Soovitud ruumiline kogemus [VISION]:** vaba lõuend (ruumidoc 4.4): inimeste paigutamine, suhtetüübi määramine visuaalselt; vaadete vahetus (genogramm⇄ökokaart) sama andmestiku peal; lähedus = suhte tugevus (K2 tähenduslik paigutus).
- **Põhifaasid:** kaardistamine → suhete märgistamine → mustri märkamine (AI võib küsida, MITTE järeldada) → kasutamine (JTA/võrgustik/kovisioon) → uuendamine.
- **Püsivad tööobjektid:** isik (sh MITTEKASUTAJA — kolmas isik!), suhe (tüüp, tugevus, suund), põlvkonnamärge, keskkonnaseos.
- **Osalejad ja rollid:** koostaja (töötaja koos kliendiga VÕI klient ise oma Teekonnas — kaks eri omanikujuhtu, eri reeglitega).
- **Privaatne/jagatud kiht:** vaikimisi privaatne (koostaja oma); jagamine AINULT tervikvaate teadliku otsusena; kliendil õigus näha teda puudutavat kaarti [DECISION].
- **AI roll ja piir:** joonistamise abi tekstikirjeldusest; EI järelda suhete kvaliteeti, EI diagnoosi peremustreid.
- **Seos teiste ruumidega:** võrgustikuruumi vaated; JTA hindamistugi; Kovisiooni juhtumi illustratsioon (deidentifitseeritult!).
- **Ühised platvormikomponendid:** K2 (objektid+seosed), K4, K7 — ja 6.8 andmekiht.
- **Privaatsus- ja turvariskid:** SUURIM kolmandate isikute andmete kontsentratsioon (pereliikmed, kes pole kunagi nõusolekut andnud): GDPR õigustatud huvi vs nõusolek, kustutamisõigus, laste andmed — **eraldi õiguslik analüüs on eeltingimus** [BLOCKED_DECISION].
- **Tooteomaniku otsused:** kolmandate isikute andmete õiguslik alus; kliendi ligipääs teda puudutavale; säilitusaeg.
- **Väikseim kasulik prototüüp:** (pärast õigusanalüüsi) ökokaart kliendi OMA Teekonnas (inimene kaardistab ise oma võrgustikku — väikseim õiguslik risk, sest andmesubjekt on koostaja).
- **Võimalik esimene arenduspakett:** — (blokeeritud: 6.8 aluskiht + õigusanalüüs).
- **Mida teadlikult MITTE ehitada:** eraldi genogrammi-moodulit oma andmebaasiga; automaatset peremustri „diagnoosi"; jagamist ilma tervikvaate kinnituseta.

### 6.11. Kohtumise ühisvaade

- **Kasutaja tegelik vajadus:** pöörduja ja spetsialist vajavad ÜHIST pilti: mis on päevakorras, mis materjalid, mis küsimused, mis kokku lepiti, mis edasi — ja pärast kohtumist mäletamist.
- **Praegune teostus [MAIN]:** eelinfo liigub (kinnitatud eelpöördumine vastuvõtulauale); MEETING_SUMMARY artefakt on olemas, kuid jääb spetsialisti poolele; ühisvaadet pole. U10 [DOC] on täpne sild.
- **Soovitud ruumiline kogemus [VISION]:** kohtumine kui AJUTINE ÜHINE LAUD kahe inimese ruumide vahel: enne (päevakord+materjalid+küsimused mõlemalt poolt), ajal (ühine märkmete ala + spetsialisti PRIVAATNE pool kõrval — K8), järel (kinnitatud kokkuvõte „seinal": kokkulepped + järgmised sammud, mõlemale nähtav, pöörduja saab reageerida).
- **Põhifaasid:** ettevalmistus → kohtumine → kokkuvõtte kinnitamine → järeltegevused (K6 tähtaegadega).
- **Püsivad tööobjektid:** päevakord, küsimus, materjal (viide), kokkulepe, järgmine samm, „sain aru / mul on parandus" märge.
- **Osalejad ja rollid:** pöörduja + spetsialist (+ tugiisik U9 kaudu); teenuseosutaja oma kohtumistel sama mudel.
- **Privaatne/jagatud kiht:** ühine kiht (päevakord, kokkulepe) + KUMMAGI privaatne pool (spetsialisti märkmed EI OLE kunagi ühised; pöörduja omad samuti).
- **AI roll ja piir:** kokkuvõtte mustand (audience=client generaator on koodis OLEMAS), selge keele versioon (U7); spetsialist kinnitab enne jagamist; EI salvestata heli vaikimisi (mitte-ehitada nr 7).
- **Seos teiste ruumidega:** eelpöördumise loomulik jätk; JTA kohtumismärkmete ühine osa; võrgustikukohtumisel (6.8) sama mudel N osalejaga; U10 on selle v1.
- **Ühised platvormikomponendid:** K1 (enne/ajal/järel), K2 (kokkulepe kui objekt — „ühise ruumi seinale, nähtav ja kinnitatav"), K3 (olemasolev ruum!), K5 (U10 kättetoimetamine), K6.
- **Privaatsus- ja turvariskid:** kokkuvõte EI tohi muutuda ametlikuks protokolliks (STAR2 piir); eriarvamuse jälg peab säilima mõlemal pool.
- **Tooteomaniku otsused:** kas pöörduja kinnitus on kohustuslik (U10 soovitus: valikuline v1); täisvaate järjekord.
- **Väikseim kasulik prototüüp:** **U10 ise** — artefakt → ruumisõnum, 0 uut mudelit, kohe väärtus. Parim väike prototüüp kogu platvormil (avastamata-vajaduste hinnang).
- **Võimalik esimene arenduspakett:** U10 (P0-järgselt kohe teostatav); täisvaade horisont C-s ruumilepingu peal.
- **Mida teadlikult MITTE ehitada:** eraldi „kohtumiste moodulit" kalendriga (mitte-ehitada nr 1); automaatset transkriptsiooni; ametlikku protokolli.

### 6.12. Organisatsiooni analüütika

- **Kasutaja tegelik vajadus:** KOV-i/asutuse juht vajab pilti: teenusekatvus, pöördumiste maht ja ooteajad, teenusepuudujäägid, meeskonna heaolu TREND — ilma üksiktöötaja jälgimiseta.
- **Praegune teostus [MAIN]:** admin-analüütika (platvormi haldus, mitte org-vaade) + Admin P0.1 ohtlike toimingute väravad (värskelt merge'itud); Tööheaolu k-anonüümne agregaat; org-/üksusemudelit EI OLE [DECISION].
- **Soovitud ruumiline kogemus [VISION]:** organisatsiooni koondkiht on „VAATETORN, mitte valvekaamera": koondtrendid, katvuskaart, puudujäägid (U5), anonüümne heaolutrend (ideed 21) — kõik k-anonüümsuse lävega; ühtegi individuaalset rida ei eksisteeri üheski vaates.
- **Põhifaasid:** — (pidev koondvaade + kuurütm ideed 21.6 järgi).
- **Püsivad tööobjektid:** kuukoond, tegevusplaan (osakonna oma, ideed 21.3), puudujäägiraport (U5 koond).
- **Osalejad ja rollid:** org-juht/koordinaator = TIITEL + org-seos [DECISION: org-mudel]; töötajad näevad SAMA koondit (ideed 21.4 — läbipaistvus mõlemas suunas).
- **Privaatne/jagatud kiht:** koond on org-sisene; üksikandmed EI eksisteeri selles kihis üldse (arhitektuuriline, mitte õiguste piir).
- **AI roll ja piir:** trendide kirjeldus, tegevusplaani mustand; EI tuvasta „probleemseid töötajaid" — see on keelatud väljund.
- **Seos teiste ruumidega:** Tööheaolu agregaat (olemas, laieneb ettevaatlikult); U5 puudujäägikoond; teenusekaardi katvus.
- **Ühised platvormikomponendid:** K5 (koondid arvutatakse sündmustest), Tööheaolu summutusmuster (aggregate.js) kui k-anonüümsuse referents.
- **Privaatsus- ja turvariskid:** väikese KOV-i taasidentifitseerimine (ideed 21.5 kaitse: lävi + summutus); juhi surve „näita rohkem" — piir peab olema koodis, mitte poliitikas.
- **Tooteomaniku otsused:** org-mudel ise (SUUR otsus — enne seda kogu peatükk [BLOCKED_DECISION]); koondite avamise leping partneriga; M1/M2 (admini-analüüsi keskmised leiud) parandusjärjekord.
- **Väikseim kasulik prototüüp:** U5 puudujäägikoond adminile (org-mudelit EI vaja — admin on olemas).
- **Võimalik esimene arenduspakett:** U5 (pärast U4); org-kiht ise alles pärast org-otsust.
- **Mida teadlikult MITTE ehitada:** individuaalse tootlikkuse/riski/heaolu jälgimist (KUNAGI — mitte-ehitada nr 8); reaalajas „aktiivsuse" näidikuid; töötajapõhiseid drill-down'e.

### 6.13. Ühine osalejate, jagamise ja nõusoleku kiht

- **Roll:** see alapeatükk KOONDAB K3+K4 nõuded võrdluse kaudu — ta on ptk 5 osalejakihi tööleht.
- **Praeguste jagamisvoogude võrdlus [MAIN]:**

| Voog | Kutse/algatus | Nõusolek | Kestus | Tagasivõtt | Auditijälg | Kustutusjärgne kandja |
|---|---|---|---|---|---|---|
| Ruumikutse | e-kiri, aegumisega | liitumine = nõusolek | kuni lahkumiseni | revoke + resend OLEMAS | osaliselt (DataAuditLog) | ruumisõnumid jäävad ruumile |
| Saadetud pöördumine | kasutaja saadab kinnitusel | topeltkinnitus + privaatsuskontroll | tähtajatu | **PUUDUB (U3!)** | sentAt väli | adressaadi koopia jääb |
| Dokumendi jagamine | analüüsi/ruumi kaudu | üleslaadija otsus | tähtajatu | osaline | DocumentAudit | ? [UNKNOWN — FAILID-A0 pooleli] |
| Abivahenduse kuulutus | avaldamine | anonymityConfirmed | expiresAt OLEMAS | mahavõtmine olemas | osaline | avalik projektsioon (Help P0 puhastas) |
| Teekonna väljavõte | shareKeys eelpöördumisse | kasutaja valib väljad | külmutatud versioon | = pöördumise elutsükkel | — | külmutatud koopia |
| Kõne salvestus | — | salvestusnõusolek (väravad) | — | — | DataAuditLog | tootelubadus: ei salvestata |
| Raamistikukinnitus | registreerumisel | FrameworkAcceptance | konto eluiga | — | mudelis | — |

- **Järeldus:** mustrid on head, aga IGAÜKS oma teostuses; tagasivõtmine on kõige ebaühtlasem (kutsetel on, pöördumisel pole); kasutajal puudub koht, kus ta kõiki oma jagamisi näeks (U12).
- **Mida ühine kiht peab tulevikus haldama (ülesande 9 nõuet):** (1) osaleja kutsumine — Invite-mustri üldistus origin-tüübiga; (2) roll ja õigused — ruumipõhised rollid + „liige ≠ päritoluligipääs"; (3) jagatavad objektid — külmutatud versioon (SharedVersion-muster) vaikimisi, viide ainult teadliku valikuna; (4) eesmärgipõhine nõusolek — iga jagamine kannab eesmärki, mida adressaat näeb; (5) ligipääsu kestus — tähtaeg või sündmus (suhte lõpp), mitte „igavesti vaikimisi"; (6) tagasivõtmine — igal jagamisel enne avamist; pärast avamist „saada parandus" (U3 muster üldistatuna); (7) lahkumine — liige saab alati lahkuda, ruum näeb fakti; (8) auditijälg — üks sündmusvoog (K5), kaks esitust (kasutaja ajajoon + õiguslik logi); (9) konto kustutamise järel alles jääv kandja — ÜKS reegel: adressaadile jääb külmutatud koopia märkega „autor kustutatud", päritoluviited katkevad, ruumisisu jääb ruumile.
- **Esimene samm:** U12 („Minu jagamised" koondvaade — 0 uut mudelit) + U3 (pöördumise tagasivõtt) = „usalduse pakett", mis viib platvormi keskse lubaduse („sina kontrollid jagamist") lõpuni ENNE üldistuskihti.

## 7. Sotsiaaltöö välitöö ja mobiilne ruum

- **Kasutaja tegelik vajadus:** spetsialist, kes töötab kliendi kodus, tänaval, varjupaigas, koolis, haiglas või kogukonnas (outreach — ideed meetod 32), vajab: enne minekut õiget minimaalset infot, kohapeal ühe käega kasutatavat märkmevahendit, pärast kiiret järeltööd — ja et tema enda turvalisus oleks hoitud.
- **Praegune teostus [MAIN]:** välitöörežiimi EI OLE. Olemasolevad tükid, millele ehitada: PWA (sw.js + manifest) on olemas, kuid sisestusmustandi kaitset ega ühenduseoleku märki pole (avastamata-vajadused võimekus 12); dikteerimine töötab; dokumendianalüüs töötab; kohtumise ettevalmistuse muster on vastuvõtulaual.
- **Soovitud ruumiline kogemus [VISION]:** välitöö = SAMA tööruumileping (K1) MOBIILSE KESTAGA. Külastus on väike ruum kolme faasiga (ettevalmistus → kohal → järeltöö), mis avaneb telefonis ühe käega. Ruumigrammatikas: spetsialist võtab „kaasa" ainult LAUAL oleva (minimaalne külastuspakett), mitte kogu kapi.
- **Külastuse ettevalmistus:** eesmärk, aadress/juhis, võtmeküsimused, vajalikud dokumendid (viidetena), turvariskimärge (kui on), eelmise kontakti kokkuvõte. AI koostab paketi JTA andmetest (6.9); töötaja kinnitab, mida kaasa võtab.
- **Minimaalne vajalik info:** kaasavõetav pakett on TEADLIKULT väike — mitte kogu juhtum, vaid külastuse eesmärgiks vajalik. See on nii privaatsuspiir (telefon on kergemini kaotatav/vaadeldav kui kontoriarvuti) kui kognitiivne piir (üks ekraan, üks tegevus).
- **Kodukülastuse faasid:** saabumise kinnitus → vaatlus ja vestlus (märkmed) → vajaduse korral kiirviited (teenused, kriisikontaktid) → lahkumise kinnitus → järeltöö (märkmete korrastus, fakti/tõlgenduse lahutus, järgmine samm).
- **Mobiilne ühe käega kasutamine:** suured puutealad, alumine tegevusriba (dokk-muster registreerimislennult), dikteerimine esmase sisestusviisina, minimaalne tippimine; flight-faasid töötavad puutega sama hästi kui klõpsuga (flat-režiim mobiilis, kui 3D ei toimi — perspectiveWorks-proov on olemas).
- **Nõrk ühendus ja offline-mustand:** märkmed salvestuvad LOKAALSELT mustandina (PWA + IndexedDB) ja sünkroniseeruvad ühenduse taastumisel; ühenduseolek on nähtav; konflikti korral võidab töötaja seadme versioon küsimusega. Offline-mustand on väliötöö MIINIMUMNÕUE — ilma selleta on funktsioon maapiirkonnas kasutu.
- **Nähtud fakti ja tõlgenduse eristamine:** märkmete struktuur sunnib K2 päritolumärgistust juba sisestamisel („nägin" / „klient ütles" / „minu tõlgendus") — see on välitöö kvaliteedi tuum (ideed meetod 2: vaatlus) ja hilisema STAR2-mustandi õiguslik selgroog.
- **Häälsisestus:** dikteerimine on välitööl esmane sisestusviis (ptk 10); transkript kinnitatakse HILJEM järeltöö faasis — kohapeal piisab salvestatud mustandist; toorheli EI säilitata vaikimisi (K10 reegel).
- **Vabatahtlik asukohakasutus:** asukoht on rangelt kasutaja algatatud (nt „ava juhis aadressile", „märgi saabumine") — asukohta EI jälgita vaikimisi ega saadeta KUNAGI automaatselt tööandjale. See on sama arhitektuuriline keeld nagu Tööheaolu jälgimiskeeld.
- **Töötaja turvalisus:** saabumise/lahkumise TEADLIK kinnitamine võib (töötaja enda valikul, ette seadistatult) anda usalduskontaktile signaali „kui ma X ajaks ei kinnita lahkumist, helista"; riskimärkega külastuse ettevalmistus kuvab turvajuhise. See on töötaja tööriist, MITTE tööandja seire — vahe on selles, kes signaali saab ja kes selle seadistab.
- **Raske juhtumi järel:** järeltöö faas pakub (ei sunni) sisendi loomist Tööheaollu (6.2 kirje), Kovisiooni (6.3 deidentifitseeritud mustand) või Supervisiooni (6.4) — üks klõps, kasutaja kontrollib sisu. See on välitöö-Tööheaolu silla loomulik koht.
- **Töö üleandmine ja asendamine:** U11 muster laieneb külastustele (planeeritud külastus antakse üle koos ettevalmistuspaketiga); asendaja näeb ainult üleantud paketti.
- **STAR2 piir:** välitöö märkmed on ETTEVALMISTAV materjal (JTA reeglid, 6.9); ametlik kodukülastuse dokumenteerimine toimub STAR2-s; „Kopeeri STAR2 jaoks" töötab ka siin.
- **Ühised platvormikomponendid:** K1 (külastusfaasid), K2 (fakti/tõlgenduse päritolu), K5 (saabumise/lahkumise sündmused, tähtajad), K6 (järgmine kontakt), K8 (mobiilne = sama struktuuri kolmas esitus); PWA-taristu.
- **Privaatsus- ja turvariskid:** seadme kaotus (lokaalne mustand krüptitud/minimaalne; sessiooni lukustus); kolmandate isikute pealtvaatamine (ekraani minimalism); asukoha väärkasutus (arhitektuuriline keeld); offline-andmete sünkroonimiskonflikt.
- **Tooteomaniku otsused:** turvasignaali saaja (usalduskontakt vs asutuse valvenumber) [DECISION]; offline-mustandi krüpteerimisnõue; kas välitöörežiim on eraldi „režiim" või lihtsalt responsive-käitumine (soovitus: eraldi teadlik režiim minimaalse paketiga).
- **Väikseim kasulik prototüüp:** külastuse ettevalmistuspakett + mobiilne märkmete mustand offline-toega + järeltöö üleminek — ühe partner-KOV-i 2–3 töötajaga.
- **Võimalik esimene arenduspakett:** VÄLI-P0 alles horisont C-s (sõltub U1, K1 lepingust, JTA tuumast); enne seda võib PWA-mustandikaitse (võimekus 12) tulla iseseisva väikese paketina.
- **Mida teadlikult MITTE ehitada:** pidevat asukohajälgimist; tööandja välitöö-dashboard'i; täisjuhtumi kaasavõtmist; automaatset heli-salvestust külastusel.

## 8. Teenusekaart 3D — ruumiline tee abini

### 8.1. Kontrollitud lähteseis

- **Praegune kaart [MAIN]:** Leaflet (`ServiceMapLeaflet.jsx`), tile-URL keskkonnamuutujast (`NEXT_PUBLIC_SERVICE_MAP_TILE_URL`, vaikeväärtusega) — 2D rasterkaart; markerid, filtrid, avalik API; markerite CSS-parandus harus [BRANCH].
- **Maa- ja Ruumiameti 3D-rakendus** (`https://3d.maaruum.ee/kaart/`): kontrollisin 16.07 kaks korda — (a) ilma JS-ita kuvab ainult brauserinõuete lehe, st rakendus on JavaScript-raske; (b) brauseris runtime-kontroll kinnitas: **ArcGIS JS API 4.18 + Esri Web AppBuilder (jimu.js)**, „Powered by Esri"; Cesiumit ei ole. Rakenduse avadialoog ütleb ise: **„Tegemist on 3D prototüübiga. Detailsemate mudelite (Hooned LOD2 ja punktipilved) kuvamine võib olla aeganõudev."** — st ametlik rakendus sisaldab LOD2 hooneid ja punktipilvi, kuid nimetab END prototüübiks ja hoiatab jõudluse eest. URL-parameeter `?find=<aadress>` aktsepteeritakse (URL säilib laadimisel); Web AppBuilder toetab standardina `find/center/marker` parameetreid — automaatse otsingukäivituse lõplik visuaalne kinnitus jäi tervitusdialoogi taha [UNKNOWN — üks käsitsi test].
- **Geo3D andmed:** LOD1 (lame katus, hoone max kõrgus) ja LOD2 (detailne katusekuju) hooned — **üle 800 000 hoone kogu Eestis**, loodud aerolaserskaneerimise punktipilvedest + ETAK-i andmetest; allalaaditavad geoportaalist („Laadi 3D andmed alla"); lisaks liikluskorralduse rajatised ja üksikpuud tiheasustusaladel.
- **Kasutus- ja viitamistingimused:** Maa- ja Ruumiameti avaandmete litsents (01.01.2025) = **CC BY 4.0 ekvivalent** — vaba kasutus ärilisel ja mitteärilisel eesmärgil; kohustuslik on **viide Maa- ja Ruumiametile ja andmete vanusele** avalikul esitamisel. SotsiaalAI kasutusele õiguslikku takistust EI OLE, viitenõue tuleb UI-sse sisse ehitada.
- Allikad: [3D andmed](https://geoportaal.maaamet.ee/est/ruumiandmed/geo3d/3d-andmed-p822.html) · [3D allalaadimine](https://geoportaal.maaamet.ee/est/ruumiandmed/geo3d/laadi-3d-andmed-alla-p833.html) · [avaandmete litsents](https://geoportaal.maaamet.ee/avaandmete-litsents) · [kaarditeenuste kasutustingimused](https://geoportaal.maaamet.ee/est/Teenused/WMSWFS-teenused/Maa-ameti-kaarditeenuste-kasutustingimused-p24.html) · [LoD2 andmekogumi metaandmed](https://metadata.geoportaal.ee/geonetwork/srv/api/records/85d8aaab-e411-4445-b142-2c4b5d18eb8b)

### 8.2. Kolm varianti võrdluses

| Kriteerium | 1. Väline „Vaata 3D-kaardil" link | 2. Rakendusse põimitud ametlik 3D-stseen | 3. SotsiaalAI enda 3D-vaade (LOD-andmed + oma renderdaja) |
|---|---|---|---|
| Teostuskulu | tundides (URL koordinaatidega) | päevades-nädalates (rakendus on Web AppBuilder-põhine JA ise „prototüüp" — põimimine tähendaks ehitamist muutuva prototüübi peale) | kuudes (MapLibre/Cesium + LOD2 tile'imine + hooldus) |
| Kasutuskogemus | kontekstivahetus (uus sakk); valik/asukoht EI säili tagasi tulles | sama leht; sünk 2D⇄3D võimalik, kui rakendus toetab URL/API parameetreid [UNKNOWN] | täielik kontroll: teenusekihid, esiletõst, klaasesteetika ruumikeelega kooskõlas |
| Teenusekihi lisamine (SotsiaalAI markerid 3D-s) | EI (ametlik rakendus ei tunne meie kihte) | ainult kui rakendus toetab väliskihte [UNKNOWN] | JAH — see on variandi ainus päris eelis |
| Hooldus ja risk | ~0; ametlik rakendus areneb ise | keskmine (väline sõltuvus, muutuv API) | kõrge (3D-jõudlus, andmevärskendus, mobiil) |
| Ligipääsetavus | ametliku rakenduse oma (meie kontrolli alt väljas) | sama | meie vastutus (suur töö teha õigesti) |
| Litsents | — (link) | viitenõue | viitenõue + andmevanus |

**Soovitus [VISION][DECISION]:** alusta variandiga 1 — teenuse detailvaates ja kirjete juures link „Vaata hoonet 3D-kaardil" (koordinaat/aadress kaasa, kui ametlik rakendus URL-parameetreid toetab — see on esimene tehniline kontroll). Variant 2 uuritakse alles siis, kui variandi 1 KASUTUS tõendab vajadust (klikimõõdik). Variant 3 on põhjendatud alles siis, kui SotsiaalAI teenusekihtide 3D-esitus annab tõendatud lisaväärtust, mida 2D + väline 3D ei kata — mitte enne horisont C lõppu. See järjekord hoiab põhimõtet: 3D ei ole visuaalne efekt, vaid vastus küsimusele „kuhu ma päriselt lähen?".

### 8.3. Kasutusvoog (sihtolek, variandist sõltumatu)

1. teenuse otsimine — 2D kaart + filtrid (olemas) jääb esmaseks;
2. 2D⇄3D vahetus — sama asukoht, zoom ja valitud teenus SÄILIVAD (URL-olekuna — sama nõue, mis Teekonna-analüüsi „olek URL-is");
3. teenusega seotud hoone esiletõst — 3D-s hoone markeering (variant 1: koordinaadile tsentreerimine; variant 3: LOD2 highlight);
4. teenuse detaili avamine — klaaskaart AVANEB kaardi kohal, mitte eraldi lehel (ruumigrammatika „aken");
5. teenuseni jõudmise juhis — ptk 9 navigaator;
6. ligipääsetavus — 3D on ALATI paralleelesitus: sama info loendi- ja 2D-vaates, klaviatuuriga; 3D-d mittekasutav kasutaja ei kaota MIDAGI sisulist;
7. mobiilne fallback — nõrgal seadmel/ühendusel jääb 2D + loend; 3D laaditakse ainult soovil.

**Piirid:** 3D ei ole kunagi ainus teenuse leidmise viis; 3D-vaade ilma kättesaadavuse tõeta (U4) oleks ilus vale — U4 käib enne või koos.

## 9. Teenusele jõudmine ja kogukonna elav kaart

- **Teenusele jõudmise navigaator [VISION]:** teenusekaart vastab täna „MIS on olemas ja KUS"; navigaator lisab „KUIDAS ma sinna saan ja MIDA kaasa võtan": ligipääsetav sissepääs (ratastool, laps vankriga), lahtiolek ja vastuvõtutingimused, vajalikud dokumendid ENNE minekut, kontakt tee küsimiseks. Teostus = teenusekirje struktuuri laiendus + detailikaardi „enne minekut" plokk, MITTE GPS-rakendus (juhis avaneb välise kaardirakenduse lingina).
- **Elav kättesaadavus (U4) [DOC]:** kolmeväärtuseline signaal (võtab vastu / ootenimekiri ~kestus / ei võta praegu) + `availabilityCheckedAt` + perioodiline üheklõpsu-kinnituskiri osutajale; kaart ja pöördumisvorm kuvavad signaali koos VANUSEGA („kinnitatud 3 nädalat tagasi"). See on kihi „elavaks" muutumise tuum ja kõigi kolme rolli ühisväärtus.
- **Kaks eri seisundit, mida EI TOHI segada:** (a) **teenus on olemas, aga ajutiselt täis** → U4 signaal („ootenimekiri ~6 nädalat") — teenus JÄÄB kaardile, ootus muutub arusaadavaks; (b) **teenust EI OLE** (piirkonnas puudub) → U5 puudujäägimärge (kategooria + omavalitsus, ILMA kliendiviiteta) → k-anonüümne kuukoond. Esimene aitab pöördujat TÄNA; teine teeb süsteemse augu nähtavaks KUUDE lõikes. Andmemudelid on eraldi (U5 hoiatus: enne U4 signaali ehitamist andmed segunevad).
- **Kogukonna ressursid:** abisoovid/abipakkumised on kaardil (olemas); kogukondlik tugi (külaselts, toidupank, tugigrupp) on teenusekirje tüüp, mitte eraldi süsteem; mobiilsed ja ajutised teenused (nõustamisbuss, hooajaline varjupaik) vajavad kirjetüübina kehtivusaega + asukohagraafiku välja [VISION].
- **Anonüümseks koondatud vajadused:** U5 koond (algul ainult adminile; KOV-ile ainult pilootleppega ja k-anonüümsuse lävega) — SotsiaalAI unikaalne positsioon: kolm rolli samal platvormil → kättesaadavuse signaal ja puudujäägimärge tekivad TÖÖPROTSESSI kõrvalproduktina, mitte eraldi küsitlusena (avastamata-vajaduste pikaajaline eristaja U4+U5).
- **Ühised platvormikomponendid:** K5 (kinnitusmeeldetuletused, aegumise sündmused), U4/U5 andmekihid, K8 (kaart kui esituskiht).
- **Tooteomaniku otsused:** U4 kinnitusintervall; kas „ei võta vastu" peidab või ainult hoiatab (soovitus: hoiatab); U5 koondi nähtavus ja avaldamislävi [DECISION].
- **Esimene pakett:** U4 (väike, sõltumatu, kolme rolli väärtus) → U5 pärast seda; navigaatori „enne minekut" plokk on kirjestruktuuri laiendus, mis võib käia U4-ga koos.
- **Mida teadlikult MITTE ehitada:** broneerimist/ootenimekirja haldust (mitte-ehitada nr 1/6); reaalajas GPS-navigatsiooni; teenuseosutaja CRM-i.

## 10. Kaamera ja hääl ruumilise sisendina

Olemasolevat multimodaalsuse analüüsi (lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md — mudelitabel, kolm lokaalsuse taset, näpistusgrammatika, hääle 4 režiimi, prototüüpimisjärjekord) EI korrata — siin ainult seos uute ruumidega ja V1 piiritlus.

### 10.1. Olemasoleva lepingu seos uute ruumidega

| Sisend | Leping (lokaalsed-mudelid / ruumidoc) | Kus uutes ruumides |
|---|---|---|
| Näpistus (vali/lohista/suurenda) | MediaPipe käepunktid; kaamera ainult loal, lokaalne, žest EI kinnita tundlikku | Teemaseemned (olemas, katseala) → Kovisiooni lõuend, võrgustikukaart, genogramm/ökokaart — SAMA grammatika, uusi žeste ei leiutata |
| Kaardil/lõuendil liikumine | tühja ruumi näpistus+vedu | kõik lõuendiruumid (6.3, 6.8, 6.10) |
| Häälkäsklused | eesti keel esmakeelena, käänded/sünonüümid; transkript alati nähtav; ohutu tegevus rakendub, muu küsib kinnitust | ruuminavigatsioon („ava töölaud"), objektitoimingud AKTIIVSEL objektil („tee suuremaks") — V1-st VÄLJAS (vt 10.3) |
| Dikteerimine | kõne → sisestusväli → kasutaja kontrollib ja saadab ISE | töötab [MAIN]; välitöö esmane sisestus (ptk 7); säilib muutumatuna |
| AI-häälvestlus | eraldi teadlik režiim, MITTE mikrofoni varjatud uus käitumine | vestlusruum; hiljem välitöö ja Teenusekaardi küsimused |
| Inimestevaheline häälruum | nõusolek, ei salvestata | ruumikõned [MAIN]; supervisioon/võrgustik pärivad sama |
| Voice välitööl | dikteerimine + transkript hiljem kinnitatav | ptk 7 järeltöö faas |
| Voice Teenusekaart 3D juhtimiseks | — | [VISION, V2+]: „näita Pärnu teenuseid" = filtrikäsk; MITTE V1-s |

### 10.2. Vestluse voice — kuus eristust

1. **Praegu töötav dikteerimine [MAIN]** — kõne tekstiks sisestusväljale; kasutaja saadab ise. SÄILIB muutumatuna (kontrollitud režiim).
2. **Praegu töötav vastuse ettelugemine [MAIN]** — TTS kõlariikoonist. Säilib.
3. **Osalejate häälkõne [MAIN]** — ruumides, nõusolekuga, salvestamata. Eraldi rada, EI segune AI-häälvestlusega.
4. **Tulevane vajuta-ja-räägi AI-häälvestlus [VISION → V1]** — ahelaga: VAD → STT → OLEMASOLEV RAG-vestlus → TTS autostart. Vt 10.3.
5. **Tulevased piiratud häälkäsklused [VISION, V2]** — navigatsioon + aktiivse objekti ohutud toimingud; intent-klassifikaator; ALLES pärast häälvestluse õppetunde.
6. **Hilisem speech-to-speech katse [VISION, V3]** — WebRTC reaalajasessioon, RAG kohustusliku serveripoolse tööriistana; alles pärast V1 mõõtmisi (lokaalsed-mudelid 7.5 piirid kehtivad).

### 10.3. Voice V1 määratlus

- **Soovitatud mudel [VISION][DECISION-kinnitusega]:** ahelaga häälvestlus (chained) olemasoleva RAG-voo peal: **Silero VAD brauseris** (kõnevooru algus/lõpp) → **serveripoolne Whisper-klassi STT** (sama tee, mida dikteerimine juba kasutab — täpne mudel valitakse eesti WER-i mõõtmisega, mitte enne) → olemasolev `/api/chat` RAG → **olemasolev TTS** autostardiga. Uut AI-taristut EI lisata; lisandub sessiooniloogika (automaatne saatmine, autoplay, katkestus).
- **Vajalikud olekud:** `Kuulan → Transkribeerin → Otsin → Vastan → Peatatud` (+ veaseisund `Vajan täpsustust`, kui transkript/kavatsus jäi ebaselgeks — lokaalsete mudelite dok'i „Sain aru" sulandub „Transkribeerin" lõppu). Olek on ruumis ALATI nähtav; olekuvahetus on ka ekraanilugejale teatatud (aria-live).
- **Transkripti kontroll:** kasutaja NÄEB iga kõnevooru transkripti enne/koos saatmisega; vale termini saab parandada; transkript jääb vestlusajalukku nagu tekstisõnum.
- **Vahelerääkimine ja Stop:** kasutaja uus kõne (VAD) või Stop-nupp peatab TTS-i KOHE; tekstivastus ja allikakaardid JÄÄVAD ekraanile (heli katkestus ≠ vastuse kadumine). NB: VEST-A0 leidis praeguse Stop-illusiooni — see parandatakse enne V1.
- **ET/EN/RU piirid:** V1 = eesti keel (esmakeel, käänded, erialaterminid — lokaalsed-mudelid 4.1 sõnastik testkorpuses); EN/RU transkriptsioon võib tehniliselt töötada, aga TUGE lubatakse alles pärast keelepõhist WER-mõõtmist; UI-keeled jäävad ET/EN/RU (i18n olemas).
- **Kriisiohutus:** häälvestlus kasutab SAMA kriisirada mis tekstivestlus; kriisivastus loetakse ette JA kuvatakse alati nähtavalt (kontaktid ekraanil); **VEST-P0a (kriisiraja parandus, praegu CHANGES_REQUIRED) on voice V1 EELTINGIMUS** — häält ei ehitata katkisele kriisirajale.
- **Mikrofoni nähtav olek:** mikrofon vaikimisi väljas; aktiivsus kogu sessiooni vältel nähtav (indikaator + olekusõna); sessioon lõpeb ühe selge toiminguga.
- **Toorheli säilitamise keeld:** toorheli EI säilitata vaikimisi; transkript järgib tekstivestluse säilitusloogikat; ükski häältoiming ei kinnita tundlikku tegevust (saatmine/jagamine/kustutamine) ilma nähtava eelvaate ja tavapärase kinnituseta.
- **Esimene võimalik voice-arenduspakett:** VOICE-V1-P0 = sessiooniloogika (VAD + autosaatmine + autoplay + katkestus + olekud) olemasoleva STT/RAG/TTS-i peal, ainult vestlusaknas, ainult ET. Eeldused: VEST-P0a PASS + O-V-otsused (VEST-A0 tabelist). Mõõdikud enne laiendamist: esimese heli viivitus, RAG-otsingu kestus, eesti WER, katkestuse töökindlus.
- **V1-st VÄLJAS (kinnitatud piirid):** äratussõna, pidev taustal kuulamine, pilguga kinnitamine, emotsiooni-/seisunditurvastus, häälkäsklused (V2), speech-to-speech (V3), voice-juhitav 3D-kaart (V2+).

### 10.4. Kaamera-näpistus — eraldi hilisem prototüüp

Kaamerasisend (MediaPipe näpistusgrammatika) on VABATAHTLIK LISASISEND, mitte ühegi funktsiooni eeltingimus (ruumidoc 9.3). Esimene katse jääb Teemaseemnete lõuendile (ruumidoc ptk 12 kandidaat): võrrelda näpistus-valimist/lohistamist hiire-klaviatuuriga. Ei sõltu voice V1-st; ei blokeeri midagi; privaatsuspiirid (lokaalne töötlus, ei salvestata, ei tuvasta isikut/seisundit) on fikseeritud. Uutesse ruumidesse (Kovisioon, võrgustik) tuleb kaamera alles siis, kui Teemaseemnete katse tõendab kasu.

## 11. Tervikseoste maatriks

| Tulevikusuund | Kasutaja eesmärk | Praegune alus [MAIN kui pole märgitud] | Tulevane ruum | Ühised komponendid | Teenusekaart/3D seos | Voice/kaamera seos | Sõltuvused | Otsused | Esimene prototüüp |
|---|---|---|---|---|---|---|---|---|---|
| 6.1 Teekonna kompass | „kus ma oma loos olen, mis järgmiseks" | Journey + shareKeys + eelpöördumise voog | elusündmuse püsiruum + kompass-kiht | K1 K2 K4 K5 K6 K8 | teenuse valik saab Teekonna sammuks | dikteerimine; hiljem häälvestlus | U1; O-TK9 | O-TK9; mitu elusündmust | kompass-lugemisvaade olemasoleva peale |
| 6.2 Tööheaolu püsiruum | nädalane naasmine, muutus ajas, privaatsus | 10 vormi + agregaat; E0 [BRANCH] | privaatne tuba, olukorrast muutuv | K1(rütm) K5 K7 K8 | — | dikteerimine kirjetes | E0 merge; U1 | rütmi vaikeseade; KOV-koond | „minu nädal" vaade kirjete peale |
| 6.3 Kovisioon | juhtumi ühine mõtestamine | 8 etappi runtime-tõendatud | sama loogika, ruumiline lavastus + privaatne märkmik | ANNAB K1; K3 K5 K8 | — | häälkõne olemas; kaamera-lõuend hiljem | KOV-R P2 | fassilitaatori roll | privaatne märkmik lõuendi kõrvale |
| 6.4 Supervisioon | professionaalne tugi lepingus | SUP-P0 skeem [BRANCH, push'imata] | leping→töö→lõpetamine ruumina | K1(2. valideerija) K3 K4 K7 | — | häälkõne; kirjalik vahetöö | SUP-P0 push+audit; K1 leping | tasumudel; register | individuaalruum: leping+kirjalik+lõpp |
| 6.5 Koostöövariandid | ajutine ja püsiv ühistöö | ruumid (ajutine OK) | püsiruum elutsükliga | K1 K3 K5 K6 K7 | — | häälkõne olemas | U11; K7 leping | O-KO1; moderatsioon | „ei sulgu" profiil + omanikuvahetus |
| 6.6 ESTA | erialane kuuluvus ja kogukond | — | piirkonna-/teemaruumid liikmesusväravaga | K3(uus liikmelisustüüp) K4 K5 K7 | piirkonnaruum ↔ piirkonna kaart | — | 6.5 alus; PARTNERLUS | kogu partnerlus [BLOCKED_DECISION] | (pärast lepet) 1 piirkonnaruum |
| 6.7 Meetodipeegel | valiku refleksioon | — (ideed 8 põhjalik) | kiht töö sees, mitte moodul | K2(tuum) K7 | — | dikteerimine | JTA tuum (6.9) | nimi; kataloogi kinnitaja | Kovisiooni-eelse mustandi generaator |
| 6.8 Võrgustikutöö | osalejate+kokkulepete kaart piiridega | ruumid+kutsed (kirjalik osa) | jagatud lõuend, 3-taseme nähtavus | K2 K3+K4 TÄIS K5 K6 K7 | osutaja valik kaardilt | häälruum kohtumisel | K3/K4 ühiskiht; GDPR-analüüs | ligipääsu lõpp; mittekasutajate andmed | ideed 5.3 vertikaal ilma kaardi-UI-ta |
| 6.9 JTA | ettevalmistus ilma topeltdokumenteerimiseta | vastuvõtulaud+tööplaan+artefaktid | muutuv stuudio | K1 K2(tuum) K6 K7 | teenuse leidmine suunamisel | dikteerimine; välitöö sild | ideed Etapp 0 otsused | k1–k11 (ideed 17) [BLOCKED_DECISION] | Etapp 2 õhuke tuum |
| 6.10 Genogramm/ökokaart | pere+keskkonna seoste pilt | — | võrgustikuruumi 2 vaadet | 6.8 andmekiht; K2 K4 K7 | — | näpistus-lõuend hiljem | 6.8; õigusanalüüs | kolmandate isikute alus [BLOCKED_DECISION] | ökokaart kliendi OMA Teekonnas |
| 6.11 Kohtumise ühisvaade | ühine pilt enne/ajal/järel | eelinfo liigub; MEETING_SUMMARY olemas | ajutine ühine laud + privaatsed pooled | K1 K2 K3(olemas!) K5 K6 | — | dikteerimine märkmetes | U10: P0-ühendused | pöörduja kinnituse kohustuslikkus | **U10 — parim väike prototüüp platvormil** |
| 6.12 Org-analüütika | koondpilt ilma jälgimiseta | admin-analüütika; TH-agregaat | vaatetorn, mitte valvekaamera | K5; k-anonüümsuse muster | katvus + U5 puudujäägid | — | org-mudel [BLOCKED_DECISION] | org-mudel; koondi leping | U5 koond adminile (org-mudelita) |
| 7 Välitöö | külastus ühe käega, offline | PWA; dikteerimine; ettevalmistusmustrid | külastuse mini-ruum 3 faasiga | K1 K2 K5 K6 K8; PWA | juhis teenuseni; asukoht loal | dikteerimine ESMANE | U1; K1; JTA tuum | turvasignaali saaja; režiimi piir | ettevalmistuspakett + offline-mustand 2–3 töötajaga |
| 8 Teenusekaart 3D | „kuhu ma päriselt lähen" | Leaflet 2D + avalik API | 2D⇄3D seotud vaated | K8; URL-olek | ON ISE | hääl-filtrid V2+ | variant 1: ei midagi; variant 2+: kasutustõend | O-3D1 variandivalik | „Vaata 3D-kaardil" link koordinaadiga |
| 9 Elav kaart | kättesaadavuse tõde + augud | availability-väljad (staatilised) | kaart, mis ütleb ka „ei" ja „puudub" | K5; U4/U5 kihid | ON ISE | — | U4 enne U5-te | intervall; koondi lävi | U4 kolmeväärtuseline signaal |
| 10 Voice V1 | küsimine loomulikult, allikad alles | dikteerimine+TTS+RAG [MAIN] | häälvestlus vestlusruumis | olemasolev RAG-ahel; K5 | V2+: kaardikäsud | ON ISE | **VEST-P0a PASS**; O-V otsused | mudelivalik WER-iga | VOICE-V1-P0 sessioonikiht |

### 11.1. Konsolideerumine: viis põhikeskkonda + kaks kihti

Seitse ülesandes loetletud suunda koonduvad tegelikult VIIEKS põhikeskkonnaks ja KAHEKS läbivaks kihiks:

1. **Inimese elusündmuse ruum** (pöörduja maja) = 6.1 kompass + Teekond + eelpöördumine + U9 tugiisik + U10 pöörduja pool. Privaatsuse etalon.
2. **Spetsialisti professionaalne stuudio** = 6.9 JTA (tuum) + 6.8 võrgustik + 6.10 vaated + 6.7 refleksioonikiht + vastuvõtulaud. Välitöö (ptk 7) on SELLE SAMA stuudio mobiilne kest, mitte eraldi keskkond.
3. **Professionaalse toe ruumid** = 6.2 Tööheaolu (privaatne tuba) + 6.3 Kovisioon + 6.4 Supervisioon — kolm sama pere ruumi (privaatne → grupp → lepinguline), ühine K1 leping, ühine deidentifitseeritud-sisendi muster.
4. **Kohtumise ja koostöö ruumid** = 6.11 ühisvaade + 6.5 püsi-/ajutine koostöö + (leppe korral) 6.6 ESTA-alad — kõik Room-süsteemi evolutsioon.
5. **Teenusekaart ja geograafiline kiht** = ptk 8 (3D) + ptk 9 (elav kättesaadavus + puudujäägid) — „aken" välismaailma kõigist ruumidest.

Läbivad kihid: **organisatsiooni koondkiht** (6.12 — vaade, mitte ruum; rangelt k-anonüümne) ja **sisendikiht** (ptk 10 voice/kaamera — teenindab kõiki keskkondi, ei kuulu ühelegi).

Arhitektuurne tagajärg: viie keskkonna ühisosa ONGI K1–K8 (ptk 5). Kui ühiskihid ehitatakse, on iga keskkond „kest + sisu", mitte omaette platvorm.

## 12. Arendusjärjekord

Kolm horisonti. Iga paketi juures: miks / sõltuvused / otsused / suurus (S/M/L) / esimene testitav tulemus / mida avab / seis (KOHE teostatav vs TULEVIKUPAKETT). Ükski rida EI OLE arendusluba — paketid käivad koordinaatori arendusvalmiduse väravast läbi ükshaaval.

### Horisont A — praeguse platvormi stabiliseerimine (käib; koordinaatori laud on tõeallikas)

Need on parandused, mida EI lükata edasi ka tulevase ümberkujunduse tõttu (A-korv: turva/privaatsus/andmekadu/kriisiohutus):

| Pakett | Miks | Sõltuvused | Otsused | Suurus | Esimene testitav tulemus | Avab | Seis |
|---|---|---|---|---|---|---|---|
| VEST-P0a (kriisiraja fallback-parandus) | kriisiohutus on absoluutne piir; audit leidis kriisinumbriteta fallback'i | VEST-P0 haru | — | S | kriisistsenaariumi vastus kriisinumbritega kõigil radadel | A11Y-I18N-P0; voice V1 eelduse | KOHE (järgmine värav) |
| RAG-QM-P0a kordusaudit + sulgemine | vastuste kvaliteedi baasjoon enne otsinguparandusi | Opuse audit | — | S | PASS-verdikt | RAG-QM jätkupaketid | KOHE (auditi ootel) |
| Tööheaolu E0 merge | detektori valepositiiv on kasutajale nähtav viga | ristkontroll | — | S | 1238/1238 + merge | 6.2 püsiruumi | KOHE |
| SUP-P0 push + sõltumatu audit | skeem on K1 lepingu 2. valideerija — vajalik ka arhitektuuritööks | — | — | S | audit-verdikt | 6.4 + K1 valideerimise | KOHE |
| U6/U7 teadlik merge (i18n-konfliktikontrolliga) | auditeeritud, väärtus ootab | i18n kontroll | merge-luba | S | otsing + selge keel live | U7 → U10/voice selge keel | KOHE |
| KOV-R P2 (lõuendireegel) | ruumilise põhireegli (canvas, 0 kerimist) rikkumine referentsfunktsioonis | — | — | S | cvl-kest ilma overflow'ta | 6.3 ruumilise arengu | KOHE |
| ADMIN M1/M2 (bulk-email replay; 500-lagi) | keskmised turvaleiud auditist | — | — | S | replay blokitud; lagi nähtav | — | KOHE |
| FAILID-A0 lõpetamine | failide elutsükkel on K4/K7 sisend; praegu IN_PROGRESS | — | — | M (analüüs) | STATUS: COMPLETE | K4 kandjareeglid | KOHE |
| RV-P0 diff'i eraldamine + kontroll | lokaalne teostus määrdunud puus = integreerimata väärtus + risk | worktree-eraldus | TO-otsused hilisematele | S | puhas haru + audit | rollipõhised vaated | KOHE |
| Registreerimislennu commit + kontroll | flight-mootor on K1 UI-poole referents; commit'imata = kaotusrisk | kasutaja otsus | — | S | haru + toimiv lend | K1 UI-lepingu | KOHE (kasutaja laual) |

### Horisont B — ühine ruumialus

Järjekord on sõltuvusjärjekord; B1 ja B-U4 võivad käia paralleelselt.

| Pakett | Miks | Sõltuvused | Otsused | Suurus | Esimene testitav tulemus | Avab | Seis |
|---|---|---|---|---|---|---|---|
| **B1. U1 sündmuse-/teavituskiht** | kõige rohkem tarbijaid; ilma selleta jääb iga ruum „mine ja vaata ise" seisu | P0.5 (saabumise e-kiri) on esimene sündmus | O6 kanalieelistus | M | 5 sündmusetüüpi → e-kiri + badge-tootja töötab | U2 U3 U10 U11; kompassi „mis muutus"; TH-rütm | TULEVIKUPAKETT (esimene B-s) |
| **B2. Tööruumileping (K1) dokumendi + JSON-kontraktina** | viie põhikeskkonna ühisosa; ilma lepinguta ehitab iga moodul faasid uuesti | Kovisioon (doonor) + SUP-P0 (valideerija) olemas | faasi-sõnastik | S (dokument!) | leping katab Kovisiooni JA SUP-V0 ilma kummagi muutmiseta | 6.1 6.2 6.4 7; flight-UI üldistuse | TULEVIKUPAKETT (võib alata kohe pärast SUP-P0 auditit — see on ANALÜÜSITÖÖ, mitte kood) |
| **B3. Usalduspakett: U3 + U12 (+U11)** | „sina kontrollid jagamist" lubaduse lõpuleviimine; K4 selgroog | U1 (teavitused) | U3 avamisjärgne reegel | M | pöördumise tagasivõtt enne avamist + „Minu jagamised" vaade + üleandmine | K4 üldistuse; 6.13 | TULEVIKUPAKETT |
| **B4. U2 „Jätka siit" + järgmine kontakt (K6)** | mõlema rolli igapäevane sissepääs; laud-grammatika esimene teostus | U1 badge'id | — | S | „Pooleli" koond + kuupäevaväli tõuseb tähtajasündmuseks | kompass; JTA; välitöö | TULEVIKUPAKETT |
| **B-U4. Kättesaadavuse signaal + värskus** | kolme rolli ühisväärtus; sõltumatu kõigest muust | — | intervall; peitmisreegel | S | signaal + vanus kaardil ja pöördumisvormil | ptk 9; U5; RAG-vastuste värskus | TULEVIKUPAKETT (võib käia paralleelselt B1-ga) |

### Horisont C — tulevikuruumid

| Pakett | Miks | Sõltuvused | Otsused | Suurus | Esimene testitav tulemus | Avab | Seis |
|---|---|---|---|---|---|---|---|
| C1. U10 kohtumise kokkuvõte | pöörduja suurima augu („mis nüüd saab?") sulgemine ~0 arhitektuuriga | P0-ühendused; (U7 selge keel merge'itud) | kinnituse kohustuslikkus | S | artefakt→ruumisõnum→pöörduja reaktsioon | 6.11 täisvaate; JTA märkmete | TULEVIKUPAKETT (esimene C-s, võib tulla kohe B1 järel) |
| C2. TK-KOMPASS-P0 | pöörduja keskkonna süda; „mis on muutunud" muutub reaalseks | B1 B4; O-TK9 | O-TK9 [DECISION] | M | kompass-vaade: ajajoon+muutused+järgmine samm+jagamised | elusündmuse ruumi täiskuju | TULEVIKUPAKETT |
| C3. TH-RUUM-P0 | 10 vormi saavad terviku; rütm tekib | E0 merge; B1 | rütmi vaikeseade | M | nädalavaade + naasmispunkt + meeldetuletus | E1–E6 õigesse kesta | TULEVIKUPAKETT |
| C4. SUP-P1 individuaalne tuum | esimene K1-lepingu UUS tarbija (tõestab üldistust) | SUP-P0 audit; B2 | tasumudel | M | leping→kirjalik töö→lõpetamine töötab | grupi/org-supervisiooni | TULEVIKUPAKETT |
| C5. 3D variant 1 (väline link) | „kuhu ma lähen" väikseima kuluga; kasutustõendi kogumine | — (sõltumatu!) | O-3D1 | S | link koordinaadiga avab ametliku 3D õiges kohas + klikimõõdik | variandi 2/3 otsuse andmepõhiselt | TULEVIKUPAKETT (võib tulla varem, sõltumatu) |
| C6. U5 puudujäägikoond | unikaalne huvikaitse-andmekiht | B-U4 (enne signaal, siis augud) | koondi lävi ja nähtavus | M | märge kaardilt + k-anonüümne kuukoond adminile | org-koondkihi; KOV-partnerluse sisu | TULEVIKUPAKETT |
| C7. VOICE-V1-P0 | loomulik küsimine ilma RAG-i/allikaid kaotamata | **VEST-P0a PASS**; O-V otsused | mudelivalik WER-mõõtmisega | M | häälvestlussessioon olekutega + katkestus + allikad ekraanil | häälkäskude V2; välitöö voice | TULEVIKUPAKETT |
| C8. JTA Etapp 2 õhuke tuum | spetsialisti stuudio selgroog | ideed Etapp 0+1 otsused; B1 B4 | k1–k11 [BLOCKED_DECISION] | L | ettevalmistus+päritolumärgistus+„Kopeeri STAR2 jaoks" | 6.7 6.8 ptk 7 | TULEVIKUPAKETT (otsusteblokis) |
| C9. Välitöö P0 | outreach-töö reaalsus; offline-vajadus | C8 tuum; B1; PWA-mustand | turvasignaal | L | külastuspakett+offline-märkmed+järeltöö pilootgrupis | mobiilse kesta mustri kõigile | TULEVIKUPAKETT |
| C10. Võrgustiku MVP (vertikaal) | koordineeritud abi piiridega | B3 (K3/K4); GDPR-analüüs | ligipääsu lõpp jm | L | kokkuvõte→1 kutsutud osaleja→ruum→kokkuleppemustand | 6.10 vaated; kohtumise N-osalejaga | TULEVIKUPAKETT |
| C11. Kovisiooni ruumiline lavastus + märkmik | referentsfunktsiooni ruumiline täiskuju | KOV-R P2; B2 | fassilitaator | M | privaatne märkmik + üks etapp eraldi alana | K8 privaatse pinna mustri | TULEVIKUPAKETT |
| C12. Meetodipeegel / geno-öko / ESTA / org-analüütika | — | vastavalt 6.7/6.10/6.6/6.12 blokkidele | kõik [BLOCKED_DECISION] või partnerlus | M–L | — | — | TULEVIKUPAKETT (otsuste taga) |

**Horisontide loogika kokkuvõttes:** A teeb tänase platvormi usaldusväärseks (see käib juba koordinaatori laual); B ehitab neli väikest ühiskihti, mida VÄHEMALT KAKS kinnitatud voogu vajavad (mitte universaalplatvormi); C avab ruumid järjekorras, kus iga järgmine taaskasutab eelmise kihte. B2 on ainus „arhitektuuripakett" ja seegi on dokument, mitte koodilaine — see hoiab anti-lukustuse põhimõtet.

---

## Jätkamispunkt

- **Viimati lõpetatud peatükk:** kõik peatükid 1–13 on esimese täisversioonina kirjas (ühe töökorra süntees 16.07.2026).
- **Pooleliolev peatükk:** — (esimene ring täis; dokument jääb elavaks — iga järgmine töökord täpsustab, mitte ei alusta).
- **Kontrollitud kood ja dokumendid:** origin/main `fe4eb4fa` ajalugu; live-server SSH-ga (= `fe4eb4fa`); merge'imata harud (`git branch -r --no-merged`); SUP-P0/E0/VEST-P0/U6/U7 haruseisud; `useStationFlight.js` + `RegistreerimineBody.jsx` (lokaalne jaamalend); `ServiceMapLeaflet.jsx` (tile-kiht); /meist täistekst (et.json); ruumilise-kogemuse-lahtekoht.md (täies mahus); ideed.md (struktuur + ptk 14–18, 29); avastamata-vajadused (täies mahus); lokaalsed-mudelid (ptk 1–9); koordinaatori handoff (strateegia + korvid + kontrollitud lähtepunkt); veebist: 3d.maaruum.ee (JS-raske), Geo3D LOD1/LOD2 (800k+ hoonet), avaandmete litsents (CC BY 4.0 ekvivalent, viitenõue).
- **Kinnitatud järeldused:** (1) visioon on sisemiselt kooskõlas, 2 täpsustuskohta dokumenteeritud (ptk 3.2); (2) tulevik ei alusta nullist üheski funktsioonis (ptk 4); (3) kaheksa ühiskihti K1–K8, millest väikseim alus = U1 + K1-leping + Room/Invite ühtlustus + U3/U12 (ptk 5.4); (4) 16 suunda konsolideeruvad 5 põhikeskkonnaks + 2 kihiks (ptk 11.1); (5) 3D soovitus = variant 1 enne varianti 2/3 (ptk 8.2); (6) voice V1 = ahelaga häälvestlus VEST-P0a järel (ptk 10.3).
- **Lahtised küsimused:** 3d.maaruum.ee `?find=` automaatkäivituse visuaalne lõppkinnitus (tehnoloogia ja parameetri aktsepteerimine on kinnitatud; tervitusdialoog kattis tulemuse) [UNKNOWN — üks käsitsi test]; `docs/ruum-audit.md` viite päritolu [UNKNOWN, ei blokeeri]; dokumentide jagamise kustutusjärgne kandja [UNKNOWN — FAILID-A0 lõpetamine annab vastuse]; K1 lepingu faasisõnastiku detailsus (valideerimine SUP-V0 + Kovisiooni vastu on tegemata).
- **Täpne järgmine kontroll:** (1) 3d.maaruum.ee `?find=`/`?center=` käsitsi visuaaltest (sulge tervitusdialoog, kontrolli kaamera liikumist) → lukusta ptk 8.2 variandi 1 teostusretsept; (2) kui SUP-P0 saab push'i+auditi, valideeri K1 lepingu visand tema 13 mudeli vastu (ptk 5.4 samm 2); (3) kui FAILID-A0 lõpeb, täienda 6.13 tabeli dokumendirida; (4) kui VEST-P0a saab PASS-i, uuenda ptk 10 eeldusseisu.
- **Tooteomaniku otsust vajavad küsimused (koond):** O-TK9 (Teekonna SENT-säilitus) — blokeerib C2; ideed 17 k1–k11 (eelpöördumise õiguslik staatus, säilitusajad, JTA piirid) — blokeerib C8; org-mudel — blokeerib 6.12 ja org-supervisiooni; ESTA partnerlus — blokeerib 6.6 terves mahus; O-3D1 (3D variandivalik; soovitus: variant 1); voice V1 mudelivalik (WER-mõõtmise järel) + O-V otsused; U3 avamisjärgne tagasivõtureegel (soovitus: ainult parandus); U4 kinnitusintervall ja peitmisreegel (soovitus: ainult hoiatab); U5/6.12 koondi avaldamislävi ja nähtavus; O-KO1 püsiruumi omanikuvahetuse kinnitusreegel; genogrammi/ökokaardi kolmandate isikute õiguslik alus; Tööheaolu rütmi vaikeseade; kohtumise kokkuvõtte kinnituse kohustuslikkus (soovitus: valikuline v1); välitöö turvasignaali saaja.

## 13. Töökorra lõppvastus (16.07.2026)

1. **Millised peatükid täienesid:** kõik — dokument loodi ja kõik peatükid 1–13 said esimese täisversiooni (edenemistabel, tõeallikad, lähtekoht, piirimaatriks, ühine ruumiarhitektuur K1–K8, 13 tulevikusuunda, välitöö, Teenusekaart 3D, elav kaart, voice/kaamera V1, tervikmaatriks, kolm horisonti).
2. **Millised uued seosed leiti:** (a) Kovisioon on K1-lepingu DOONOR ja SUP-V0 selle valideerija — ühine tööruumileping saab sündida kahe olemasoleva vara võrdlusest, ilma uut koodi kirjutamata; (b) 16 tulevikusuunda konsolideeruvad 5 põhikeskkonnaks + 2 kihiks, mille ühisosa ONGI K1–K8; (c) välitöö ei ole eraldi keskkond, vaid spetsialisti stuudio mobiilne kest; (d) genogramm/ökokaart on võrgustikuruumi vaated, Meetodipeegel on kiht (mitte moodul) — kolm „uut funktsiooni" osutusid olemasolevate ruumide esitusteks; (e) U10 on kogu platvormi parim väike prototüüp ka ruumilise arhitektuuri vaatest (kokkulepe-seinal grammatika esimene teostus).
3. **Kõige olulisem ühine platvormikiht praegu:** **U1 sündmuse-/teavituskiht** — sellest sõltuvad kompassi „mis on muutunud", Tööheaolu rütm, U2/U3/U10/U11 ja kõigi ruumide teavitused; ilma selleta jääb iga uus ruum „mine ja vaata ise" seisu. (Dokumendi-tasandil on sama kaaluga B2 tööruumileping, aga see on analüüsitöö, mitte kood.)
4. **Milline teema on järgmine:** 3d.maaruum.ee brauseripõhine kontroll (URL-parameetrid → ptk 8 täpsustus) ja K1-lepingu valideerimine SUP-V0 vastu, kui SUP-P0 on push'itud — mõlemad on selle dokumendi järgmise töökorra esimesed sammud.
5. **Millised tooteomaniku otsused tekkisid:** koondloend Jätkamispunktis (14 otsust); uued selle dokumendi omad: O-3D1 (3D variandivalik), O-KO1 (püsiruumi omanikuvahetus), välitöö turvasignaali saaja, voice V1 mudelikinnitus WER-i järel.
6. **Kas rakenduskoodi muudeti:** **ei.** Loodi ainult see analüüsidokument; ühtegi koodi-, skeemi-, migratsiooni- ega testifaili ei puudutatud; commit'e ei tehtud.
