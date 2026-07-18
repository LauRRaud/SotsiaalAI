# Tulevikufunktsioonide süvaanalüüside master-register

STATUS: ACTIVE REGISTER

Viimati uuendatud: 2026-07-17
Omanik: Fable (analüüsirada), koordinaator (järjekord)
Alusdokument: [`platvormi-arendusprogramm-2026-07-17.md`](./platvormi-arendusprogramm-2026-07-17.md) ptk 10

## 1. Registri eesmärk

See register on tulevikufunktsioonide analüüsiraja ainus koondseis. Iga rida vastab ühele piiritletud
süvaanalüüsile (toote-, metoodika-, UX-, privaatsus- ja arhitektuurianalüüs, mitte rakenduskood).
Üks töökord lõpetab ühe paketi; register uuendatakse iga töökorra lõpus.

Olekud: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `BLOCKED_DECISION`.

Analüüsirada ei muuda rakenduskoodi, Prisma skeemi, migratsioone ega testifaile; midagi ei commit'ita
ega deploy'ta. `STATUS: COMPLETE` tähendab valmis analüüsi, mitte valmis koodi.

## 2. Kontrollitud tõeallikas (2026-07-17)

| Kiht | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa` (Admin P0.1 + Help P0 + DOK-XTEN + RAG-P8.0 merge'itud) | `git fetch` + `git log origin/main` 2026-07-17 |
| Live-server | `fe4eb4fa` — kattub `origin/main`-iga | arendusprogrammi ptk 2 kontroll 2026-07-17 |
| Kohalik `main` | `0da4185b`, 1 ees / 22 taga, määrdunud tööpuu | ei kasutata arenduseks; analüüsirada loeb origin/main + harusid |
| K1-P0 | `codex/k1-p0-workspace-contract @ ef5973c9` — `CODE_READY`, ainult harul | registry + descriptor + Kovisiooni/Room read-adapterid |
| U1-P0 | `READY_AFTER_K1` — koodi pole | O-U1-1/O-U1-2 kinnitatud 17.07.2026 |
| SUP-P0 | `codex/supervision-v0-p0-schema @ 2fc826c4` — `CODE_READY_LOCAL_ONLY` | 13 mudelit, remote puudub |

## 3. Pakettide register

| # | Pakett | Väljundfail | Seis | Sõltuvused | Jätkamispunkt |
|---:|---|---|---|---|---|
| 1 | **COLLAB-A0** — professionaalne ühistegevus, võrgustikutöö ja kohtumise ühisvaade | `fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md` | `COMPLETE` (17.07.2026) | K1-U1-A0 (COMPLETE), RUUM-VIS-A0 (COMPLETE) | valmis: 3 kasutusjuhtude perekonda + kandjapiir; 10 otsust O-CO-1…10 (ükski ei blokeeri P0); esimene pakett COLLAB-P0 (migratsioonita osaleja-/jagamislepingu kiht, avaneb K1-P0 PASS+merge järel) — vt dokumendi ptk 11/12 |
| 2 | **CASEWORK-A0** — juhtumitöö assistent, Meetodipeegel, genogramm ja ökokaart | `fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` | `COMPLETE` (17.07.2026) | COLLAB-A0 (COMPLETE — ptk 1.3 kandjapiir, ptk 3 objektiklassid, ptk 6 võrgustikumudel on otsesed sisendid), K1-U1-A0 | valmis: proto-JTA inventuur (STAR_HELPER jt artefaktitüübid JUBA [MAIN]), kandja-/päritolusõnastikud, Meetodipeegli leping, genogramm/ökokaart = võrgustikumudeli vaated (kliendi-oma ökokaart enne töötaja kaarti); k1–k11 kaardistus (k5/k7/k10 koodis lahendatud); 10 otsust O-CW-1…10 (ükski ei blokeeri P0/P1); esimene pakett CASEWORK-P0 (sõnastiku-/adapterikiht, avaneb K1-P0 PASS+merge järel, COLLAB-P0-ga paralleelne) — vt dokumendi ptk 9/10/11 |
| 3 | **WELLBEING-V2-A0** — Tööheaolu iganädalane püsiruum | `fable-5-tooheaolu-v2-iganadalane-pusiruum.md` | `COMPLETE` (17.07.2026) | Tööheaolu tervikanalüüs (COMPLETE), E0 järelkontroll (ootel — samm 0), K1-U1-A0 | valmis: püsiruum = lugemiskiht+rütm olemasoleva peal (konteinertabelit EI looda); **toodangu DB-s 0 heaolukirjet** — TO-3/O-WB-1 otsuste aken lahti; W-INV-1…8 + agregaadi auguanalüüs A1–A5; `wellbeing_space` adapteri koondireeglid ([TECH-OPEN] vastatud) + `weekly_checkin_due` maskimisreegel; 5 otsust O-WB-1…5 (ükski ei blokeeri P0/P1); esimene pakett WB-V2-P0 (kirjete lugemisrada; eeldus AINULT E0 järelkontroll+merge); järgmine analüüs KOV-V2-A0 (SUP-V1-A0 sõltuvus täitmata) — vt dokumendi ptk 10/11 |
| 4 | **SUP-V1-A0** — Supervisiooni P1–P11 | `fable-5-supervisioon-p1-p11-suvaanaluus.md` | `NOT_STARTED` | SUP-P0 skeemialus (push + audit), SUP tootemudel Q1+Q2 (COMPLETE) | — |
| 5 | **KOV-V2-A0** — Kovisiooni uus ruumikogemus | `fable-5-kovisioon-uus-ruumikogemus.md` | `NOT_STARTED` | Kovisiooni teadmistekaart (COMPLETE), KOV-R pakettide seis | tooteomanik lükkas 17.07.2026 hilisemaks; ei ole aktiivne |
| 6 | **ESTA-MENTOR-A0** — ESTA ja mentorlus | `fable-5-esta-ja-mentorlus.md` | `COMPLETE` (17.07.2026) | COLLAB-A0 (võrgustikumudel), SUP tootemudel (ESTA = mentorite andmebaas) | valmis: mentorlus = perekond B oma konteineriga (8 mudelit EM1–EM8, uut rolli EI); ESTA V1 = AINULT väline viide + individuaalse nõusolekuga EXTERNAL_REFERENCE (partnerilepet EI vajata — partneri-neutraalsus tõendatud ptk 6.2); koodileiud: `CallContextType.MENTORING` reserv, `MENTORING_SUMMARY` kasutusel, Alustaja tugi tuvastab mentorivajaduse sihtkohata; 10 otsust O-EM-1…10, **0 blokeerivat**; T23 = ANALYSIS_READY — ÜKS terviklik pakett ESTA-MENTOR-V1 (E1–E9, kopeeritav ülesanne doc ptk 11); K1-P0/U1-P0 EI ole eeldused (E6 tingimuslik) |
| 7 | **FIELD-A0** — välitöö mobiilne kest | `fable-5-valitoo-mobiilne-kest.md` | `COMPLETE` (17.07.2026) | K1-U1-A0 (COMPLETE), FAILID-A0 (COMPLETE) | valmis: välitöö = olemasolevate tööruumide mobiilne kest (3 uut mudelit + 1 DocumentKind väärtus = kogu skeemijälg); koodileiud: sw.js on no-op (offline-kiht 0, aga ka 0 cache-riski), IndexedDB/OCR/foto-tugi puuduvad, PreInquiry.DOWNLOADED = ainus offline-koopia muster, STT serveripõhine (offline-transkriptsiooni ei ole); 9-olekuline sünkroonimismasin + külastuspaketi whitelist + serveripoolne turvasignaali kontrollaken; soovitus = installitav PWA (native'i EI); 10 otsust O-FD-1…10, **0 blokeerivat** — FIELD-D0 (17.07.2026) kinnitas retention-maatriksi, kohaliku salvestuse kaitsetaseme ja turvasignaali saaja; T24 = `READY_THEME_BUILD`; ÜKS terviklik pakett E1–E10 (kopeeritav ülesanne doc ptk 11 sisaldab kinnitatud väärtusi); K1-P0/CASEWORK-P0/U1-P0 EI ole eeldused (tingimuslikud adapterid) |
| 8 | **ORG-A0** — organisatsiooni analüütika | `fable-5-organisatsiooni-analuutika.md` | `COMPLETE` (17.07.2026) | WELLBEING-V2-A0 (COMPLETE), Admini analüütika analüüs (COMPLETE) | valmis: 5-tabeline õhuke liikmesuskiht + liikmesuse-põhised capability'd + fikseeritud vaadetega külmutatud koondimootor (`k≥5`); ORG-INV-1…12; O-ORG-1…5, neist kolm aktiveerimisväravat O-ORG-1/2/3, mis **ei blokeeri koodi**; T25 = `ANALYSIS_READY` — ÜKS terviklik ORG-V1 pakett E1–E10 (kopeeritav ülesanne doc ptk 18); partnerlepet vajab päris org-i aktiveerimine, mitte koodi kirjutamine |
| 9 | **PILOT-PARTNER-A0** — esimese KOV-partneri piloodi tervikmudel ja kasutuselevõtuleping | `fable-5-esimese-partnerpiloodi-ja-kasutuselevotu-mudel.md` | `COMPLETE` (17.07.2026) | ORG-A0, ESTA-MENTOR-A0, FIELD-A0, COLLAB-A0, WELLBEING-V2-A0 (kõik COMPLETE — kandidaadisisendid), lisavastused organisatsioon+piloot | valmis: 7 kandidaadi võrdlus → väikseim terviklik piloot = olemasolev eelpöördumise täisrada 1 KOV-osakonnaga (2–4 töötajat + 10–30 pöördujat; teenuseosutaja/salvestus/maksed/süvauuring/T20–T25 väljas); 12-etapiline piloodimudel väravatega G0–G5 + STOP-/rollback-rada; töötlejarollide soovitus „kaks iseseisvat vastutavat töötlejat + koostööleping"; PP-INV-1…8 privaatsusinvariandid; mõõdikud ainult sündmustest/loenduritest/vabatahtlikust tagasisidest (`k≥5`; selgroog = T04 U1-P0 sündmused); G3 tehniline checklist (T27 RC + TK-P0 + U1-P0 release'is + ohulülitid); 3 otsust O-PP-1/2/3 (ükski ei blokeeri ettevalmistust, kõik blokeerivad päris aktiveerimist); **koodi enne release candidate'i ei vajata** (PILOT-PARTNER-V1 = tingimuslik väike tagasisidevormide pakett ainult omaniku soovil, doc ptk 16); T26 = `ANALYSIS_READY` |

## 4. Otsuste register (analüüsiraja tasand)

| Otsus | Pakett | Seis |
|---|---|---|
| O-CO-1 flow-päritolu ruumide kustutusreegel (soovitus: arhiveeri+lahku) | COLLAB-A0 ptk 10 | LAHTINE — enne COLLAB-P3 ja help-match kasvu |
| O-CO-2 kokkuvõtte kinnitusringi kohustuslikkus (soovitus: valikuline v1, kohustuslik konverentsi profiilil) | COLLAB-A0 | LAHTINE — enne COLLAB-P2 |
| O-CO-3 omanikuvahetuse kinnitusreegel (= O-KO1; soovitus: uus omanik kinnitab + osalejad näevad) | COLLAB-A0 | LAHTINE — enne U11/COLLAB-P3 |
| O-CO-4 kutsutu identiteedi tase kliendisuhte/välise kutsel | COLLAB-A0 | LAHTINE — enne kliendi-osalusega pilooti |
| O-CO-5 kliendi positsioon kohtumise ühisvaates (soovitus: kinnitatud kiht sihina; U10-adressaat jääb v1) | COLLAB-A0 | LAHTINE — enne COLLAB-P2 UI-d |
| O-CO-6 võrgustiku mittekasutajate kirjete õiguslik alus | COLLAB-A0 | LAHTINE — GDPR-analüüs enne COLLAB-P5 |
| O-CO-7 WITHDRAWN-panuse saatus | COLLAB-A0 (= K1-U1 11.3 p6) | LAHTINE — moodulipõhine, SUP-i pretsedent ees |
| O-CO-8 moderatsioonifilosoofia ühtlustus (ADMIN kõned vs sõnumid) | COLLAB-A0 (= RUUM-A0 3 K6b) | LAHTINE |
| O-CO-9 org-esindaja ORG_META nähtavus | COLLAB-A0 → ORG-A0 | ORG-A0 vastus V1: **ei aktiveerita**; ORG_META on ORG-V1 skoobist väljas |
| O-CO-10 kinnitatud kokkuvõtte õiguslik staatus juhtumikonverentsil | COLLAB-A0 (seos ideed 17 → CASEWORK-A0) | LAHTINE — enne konverentsi profiili |
| O-CW-1 eelpöördumise/JTA õiguslik staatus + vastutav töötleja (ideed 17 k1+k2) | CASEWORK-A0 ptk 9 | LAHTINE — partner-KOV-iga enne pilooti; EI blokeeri P0/P1 |
| O-CW-2 ülekantud mustandi retention (k3+k8+k11) | CASEWORK-A0 | LAHTINE — enne CASEWORK-P2 |
| O-CW-3 refleksiooni/ametliku dokumentatsiooni piiri kinnitus (k4; ideed 13.4) | CASEWORK-A0 | LAHTINE — kinnitus enne CASEWORK-P3 |
| O-CW-4 JTA konteiner vs adapterid (soovitus: adapterid kuni tõendatud vajaduseni) | CASEWORK-A0 | LAHTINE — enne P2 skeemikuju |
| O-CW-5 meetodikataloogi kinnitaja (k13+k14; partner) | CASEWORK-A0 → P6 | LAHTINE — enne meetodi-assistenti |
| O-CW-6 Meetodipeegli org-õppimine (k15) | CASEWORK-A0 → ORG-A0 | ORG-A0 vastus V1: **ei aktiveerita**; vaikekeeld kehtib |
| O-CW-7 genogrammi/ökokaardi kolmandate isikute õiguslik alus (= O-CO-6 laiendus: pere, LAPSED, GDPR art 14) | CASEWORK-A0 | LAHTINE — õigusanalüüs enne CASEWORK-P4/P5 |
| O-CW-8 suhte-/notatsioonitaksonoomia (metoodikaotsus) | CASEWORK-A0 | LAHTINE — enne P5 UI-d; V1 = domeen+vabatekst |
| O-CW-9 kliendi ligipääs teda puudutavale kaardile | CASEWORK-A0 (seos O-CO-5) | LAHTINE — enne P5 |
| O-CW-10 „Kopeeri STAR2 jaoks" auditisügavus (soovitus: fakt+väljade loend, MITTE täissnapshot) | CASEWORK-A0 | LAHTINE — enne CASEWORK-P2 |
| O-WB-1 nädalakirje kuju (soovitus: Kiirkontrolli adaptiivne evolutsioon, MITTE uus workflowType) | WELLBEING-V2-A0 ptk 3.2 | LAHTINE — enne WB-V2-P2/P3 |
| O-WB-2 kasutusfakti kaitse kõrvalradadel: U1 admin-tõrkeloendi maskimine + koondpäringute auditilogi | WELLBEING-V2-A0 ptk 7.2 | LAHTINE — maskimine TH-U1 lepingusse; auditilogi enne pilootvaatajate lisamist |
| O-WB-3 heaoluandmete GDPR-klassifikatsioon (art 9?) + välise koondi anonüümsuslävi | WELLBEING-V2-A0 ptk 9.2 | LAHTINE — õigusanalüüs enne mistahes org-suunalist koondit; EI blokeeri P0–P4 |
| O-WB-4 KOV-kuukoondi (ideed 21) avamise tingimused (partnerlepe + A1–A5 sulgemine + „muutus ajas") | WELLBEING-V2-A0 → ORG-A0 | ORG-A0 ptk 9/10 arhitektuuritingimused valmis; aktiveerimine ootab endiselt O-WB-3/O-ORG-2 õigusotsust |
| O-WB-5 püsiruumi PAUSED = „rütm väljas" semantika | WELLBEING-V2-A0 ptk 7.1 | LAHTINE — koos TO-2-ga (TH) |
| O-FD-1 välitöökandjate retention-maatriks | FIELD-A0 ptk 10 | **KINNITATUD (FIELD-D0, 17.07.2026)** — ptk 4.5/4.8 vaikeväärtused: sünkroonitud kohalikud koopiad 7 p; saatmata sisu kuni 30 p + hoiatused, kustutus 37. päeval; serveris külastus+märkmed 90 p sulgemisest; toorheli 7 p või kustutus kohe pärast kinnitatud transkripti (O-FD-8 kinnitatud sama maatriksi osana) |
| O-FD-2 kohaliku salvestuse kaitsetase | FIELD-A0 ptk 10 | **KINNITATUD (FIELD-D0, 17.07.2026)** — V1 piloot: WebCrypto + seadme ekraanilukk + auto-purge; rakenduse PIN-lukk = laia kasutuselevõtu hilisem otsus |
| O-FD-3 turvasignaali saaja ja kohustuslikkus | FIELD-A0 ptk 10 | **KINNITATUD (FIELD-D0, 17.07.2026)** — vabatahtlik (opt-in); saaja = töötaja määratud usalduskontakt; asutuse keskne kontakt jääb T25 hilisemaks võimaluseks |
| O-ORG-1 org-i V1 üksus ja päris org-i kinnitamine | ORG-A0 ptk 17 | Vaikevalik: hierarhiata tööüksus; **ei blokeeri koodi**, blokeerib esimese päris org-i aktiveerimise |
| O-ORG-2 heaoluandmete klassifikatsioon ja org-koondi anonüümsusstandard | ORG-A0 ptk 17 | Vaikevalik: ptk 9 `k≥5` leping; **ei blokeeri koodi**, blokeerib päris heaolukoondi sisselülituse |
| O-ORG-3 koondvaataja capability ja partneri andmetöötluspiir | ORG-A0 ptk 17 | Vaikevalik: ANALYTICS_VIEWER ainult org-i liikmele, väline vaataja V1-st väljas; **ei blokeeri koodi**, blokeerib päris grandi |
| O-ORG-4 üleandmisel autori uus nõusolek | ORG-A0 ptk 17 | Vaikevalik: sama asutuse ja funktsiooni sees uut nõusolekut ei nõuta; tagasivõtuõigus säilib |
| O-ORG-5 org-i avalik nähtavus | ORG-A0 ptk 17 | Vaikevalik: avalikku kataloogi V1-s ei ole |
| O-PP-1 esimese piloodi partneriprofiil + funktsioonikomplekt (sh Tööheaolu kättesaadavuse alaotsus ja edukriteeriumid) | PILOT-PARTNER-A0 ptk 15 | LAHTINE — vaikevalik: 1 KOV sotsiaaltööosakond + eelpöördumise täisrada; **ei blokeeri ettevalmistust**, blokeerib lepingu koostamist (etapp 3) |
| O-PP-2 piloodi õiguslik pakett: töötlejarollide jaotus, eelpöördumise menetlusstaatus, DPIA, pilootleping, kasutajainfo | PILOT-PARTNER-A0 ptk 15 | LAHTINE — vaikevalik: „kaks iseseisvat vastutavat töötlejat + koostööleping"; blokeerib päris kasutajate kaasamise (G1) |
| O-PP-3 päris piloodi aktiveerimise värav (G3 checklisti PASS: T27 RC + TK-P0 + U1-P0 release'is + sünteetiline proov + koolitus) | PILOT-PARTNER-A0 ptk 12/15 | LAHTINE — go ainult kõigi checklisti-ridade PASS-iga; osalist aktiveerimist ei tehta |
| O-J1 (= O-TK9) SENT-eelpöördumise saatus autori konto kustutamisel | JOURNEY-D0 (T06) — `fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md` ptk 10/16 | **KINNITATUD 17.07: B** — anonüümitud faktikiht + adressaadi märkmed; E3 teeb ühe migratsiooni; §7.7 teksti täpne sõnastus kinnitatakse enne merge'i |
| O-J2 (= Teekonna UX-otsused T1+T3) Teekonna kest + raja sisene „← Eelmine samm" | JOURNEY-D0 (T06) — lepingu ptk 4/16 | **KINNITATUD 17.07:** iseseisev täisleht + nool ainult raja sees |
| O-J3 (= O-TK2) Teekonna jäädav kustutamine | JOURNEY-D0 (T06) — lepingu ptk 4/16 | **KINNITATUD 17.07:** 2-sammuline kinnitus; seotud pöördumised jäävad, side katkeb; enne kustutust eksport |

NB: Tööheaolu TO-1…TO-10 (tervikanalüüsi ptk 12) on KÕIK vastuseta — otsustusleht
`fable-5-tooheaolu-tooteotsuste-otsustusleht.md` on kirjutamata (kontrollitud 17.07.2026).

Ükski ülaltoodud lahtine otsus EI blokeeri COLLAB-P0, CASEWORK-P0/P1, WB-V2-P0/P1 ega ORG-V1 koodi. O-FD-1/2/3 on kinnitatud (FIELD-D0, 17.07.2026) — FIELD-V1 on `READY_THEME_BUILD` ega oota enam ühtegi otsust.

## 5. Muudatuslogi

| Kuupäev | Muudatus |
|---|---|
| 2026-07-17 | Register loodud; COLLAB-A0 märgitud `IN_PROGRESS` |
| 2026-07-17 | COLLAB-A0 `COMPLETE`: väljund `fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md` (12 ptk + edenemistabel + STATUS: COMPLETE); 10 otsust O-CO-1…10 registrisse; esimene rakendusvalmis pakett COLLAB-P0 (0 migratsiooni, 0 lahtist otsust, sõltuvus K1-P0 PASS+merge); järgmine analüüs CASEWORK-A0 (kopeeritav ülesanne väljunddoki ptk 12.6). Kontrollitud tõeallikas: origin/main `fe4eb4fa` = server (SSH); K1-P0 `ef5973c9` registry reserveerib juba `meeting`/`network_case` kind'id |
| 2026-07-17 | CASEWORK-A0 `COMPLETE`: väljund `fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` (11 ptk + edenemistabel + STATUS: COMPLETE); 10 otsust O-CW-1…10 registrisse; k1–k11 kaardistus (k5/k7/k10 koodis lahendatud [MAIN], k6/k9 katab COLLAB); koodileid: proto-JTA on toodangus (STAR_HELPER/CASE_* artefaktitüübid, vastuvõtulaud, 3 kinnitatud-üleandmise mustrit); K1-P0 registry EI reserveeri `case_work`/`practice_reflection` kind'e (lisandub CASEWORK-P0-s); esimene pakett CASEWORK-P0 (0 migratsiooni, 0 otsust, K1-P0 järel, COLLAB-P0-ga paralleelne); järgmine analüüs WELLBEING-V2-A0 (kopeeritav ülesanne väljunddoki ptk 11.6). Kontrollitud: origin/main `fe4eb4fa` = server (SSH; frontend/rag/livekit töötavad, notifications-timer OK) |
| 2026-07-17 | WELLBEING-V2-A0 on `COMPLETE`; KOV-V2-A0 lükati tooteomaniku otsusel hilisemaks. SUP-V1-A0 sõltuvus on endiselt täitmata, seega järgmine sõltuvusteta analüüs on ESTA-MENTOR-A0 |
| 2026-07-17 | ESTA-MENTOR-A0 `COMPLETE`: väljund `fable-5-esta-ja-mentorlus.md` (12 ptk + edenemistabel + STATUS: COMPLETE). Fikseeritud: mentorlus = COLLAB perekonna B kaitstud vorm oma konteineriga (EM1–EM8; uut globaalset rolli EI looda; CLIENT väljas); ESTA = väline avalik allikas + individuaalse nõusolekuga EXTERNAL_REFERENCE kirjed (seed-poliitika jõustub andmemudelis) — partnerilepet V1 EI vaja; mentoriks saamise värav = admini kataloogimoderatsioon, MITTE kvalifikatsioonigrant; kohtumine = faktikirje + valikuline Room-link (mentorluskõnet ei ehitata; `CallContextType.MENTORING` jääb reserviks); Tööheaolu sild `recipientType="mentor"` kuulub V1 skoopi; 0 arveldust. 10 otsust O-EM-1…10 vaikevalikutega, ükski ei blokeeri. Masterregistri T23 → `ANALYSIS_READY`; kopeeritav ESTA-MENTOR-V1 ülesanne (üks haru, etapid E1–E9, DoD + runtime-kontroll) doc ptk 11. Järgmine sõltumatu analüüs: FIELD-A0. Kontrollitud tõeallikas: origin/main `fe4eb4fa` muutumatu (`git ls-remote`); rakenduskoodi/skeemi/teste ei muudetud |
| 2026-07-17 | FIELD-A0 `COMPLETE`: väljund `fable-5-valitoo-mobiilne-kest.md` (559 rida, STATUS: COMPLETE); T24 = `ANALYSIS_READY`, FIELD-V1 = `BLOCKED_DECISION (kerge)` kuni O-FD-1/2/3 kinnitamiseni ühe FIELD-D0 ringina; üks terviklik pakett E1–E10 |
| 2026-07-17 | ORG-A0 `COMPLETE`: väljund `fable-5-organisatsiooni-analuutika.md` (643 rida, 22 peatükki, STATUS: COMPLETE); T25 = `ANALYSIS_READY`; 5-tabeline õhuke liikmesuskiht, ORG-INV-1…12 ja fikseeritud-vaadetega `k≥5` koondimootor; O-ORG-1/2/3 on aktiveerimisväravad, mitte koodiblokeerijad; üks terviklik ORG-V1 pakett E1–E10. Järgmine Fable'i töö: FIELD-D0 otsuste sulgemine; uut sõltumatut süvaanalüüsi ei avata enne SUP-V1-A0 sõltuvuse täitumist või KOV-V2-A0 omaniku taasavamist |
| 2026-07-17 | FIELD-D0 `COMPLETE` (ainult dokumentatsioon): tooteomanik kinnitas O-FD-1 (retention = FIELD-A0 ptk 4.5/4.8 vaikeväärtused: sünkroonitud kohalikud koopiad 7 p; saatmata sisu kuni 30 p + hoiatused, kustutus 37. päeval; serveris külastus+märkmed 90 p sulgemisest; toorheli 7 p või kohe pärast kinnitatud transkripti), O-FD-2 (V1 piloot = WebCrypto + seadme ekraanilukk + auto-purge; rakenduse PIN-lukk = laia kasutuselevõtu hilisem otsus) ja O-FD-3 (turvasignaal vabatahtlik; saaja = töötaja määratud usalduskontakt; asutuse keskne kontakt = T25); O-FD-8 kinnitatud O-FD-1 maatriksi osana. FIELD-V1 = `READY_THEME_BUILD`; uuendatud analüüsidoki ptk 10/11/12 + Edenemistabel + Jätkamispunkt, masterregistri T24 + ptk 8/10 ning käesoleva registri paketi-/otsuseread; rakenduskoodi/skeemi/teste/handoff'i/arendusprogrammi ei muudetud, commit'e ei tehtud |
| 2026-07-17 | JOURNEY-D0 `COMPLETE` (T06 otsuste sulgemine + arendusleping; ei ole tulevikuanalüüsi pakett, kirje siin ainult otsuste registri pärast): väljund `fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md` (17 osa: elutsükkel, fail-closed jagamisleping TK-P0, T04/T05 kasutus, O-TK9-B rakendusleping, etapid E1–E7, DONE, kopeeritav Sol/Terra ülesanne). O-TK1…O-TK8 said otsustevabad vaikevalikud; blokeerivaks jäid täpselt 3 otsust O-J1/O-J2/O-J3 (lisatud ptk 4 registrisse). Masterregistri T06 → `BLOCKED_DECISION (kerge)`; TK-P0 jagamisleping on otsustevaba ja arenduseks üheselt määratud. Rakenduskoodi/skeemi/migratsioone/teste/handoff'i/arendusprogrammi ei muudetud; commit'e ei tehtud |
| 2026-07-17 | JOURNEY-D1 vaikevalikud kinnitatud | O-J1=B (anonüümitud faktikiht + adressaadi märkmed, üks E3 migratsioon), O-J2=iseseisev Teekonna leht + rajasisene tagasi-nool ja O-J3=2-sammuline kustutamine + eksport. T06 on `READY_THEME_BUILD_STACK`; ainsaks tehniliseks eelduseks on T05 lõplik remote SHA. |
| 2026-07-17 | PILOT-PARTNER-A0 `COMPLETE` (tooteomaniku eritellimus; T26): väljund `fable-5-esimese-partnerpiloodi-ja-kasutuselevotu-mudel.md` (17 ptk + edenemistabel + STATUS: COMPLETE). Fikseeritud: 7 kandidaadi võrdlus → väikseim terviklik piloot = olemasolev eelpöördumise täisrada 1 KOV sotsiaaltööosakonnaga (2–4 töötajat + 10–30 pöördujat); T20–T25 teemad EI ole piloodi eeldused; 12-etapiline piloodimudel (hindamine→leping→sünteetiline proov→koolitus→piiratud päris piloot→seire→vahehindamine→lõpetamine→laienemisotsus) väravatega G0–G5 + STOP-/rollback-rada; töötlejarollid „kaks iseseisvat vastutavat töötlejat + koostööleping"; PP-INV-1…8 (sh mõõdikud ainult sündmustest/loenduritest/vabatahtlikust tagasisidest, `k≥5`, Tööheaolu kasutusfakti ei mõõdeta, tugi ei ava sisu, tootmisandmed pole testmaterjal, intsident peatab piloodi, rollout ei ole automaatne); G3 nimelised eeldused T27 RC + TK-P0 (T06) + U1-P0 (T04); 3 uut otsust O-PP-1/2/3; koodi enne release candidate'i ei vajata. Masterregistri T26 → `ANALYSIS_READY` + jätkamispunkt uuendatud. Rakenduskoodi/skeemi/migratsioone/teste/handoff'i/arendusprogrammi ei muudetud; päris partneriga ei kontakteerutud; kontosid ei loodud; tootmisandmeid ei loetud; commit'e ei tehtud |
