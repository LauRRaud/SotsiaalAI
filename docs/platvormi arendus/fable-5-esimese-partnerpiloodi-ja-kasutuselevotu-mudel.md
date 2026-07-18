# Fable 5: esimese partnerpiloodi ja kasutuselevõtu mudel (PILOT-PARTNER-A0)

Ülesanne: **T26 / PILOT-PARTNER-A0** (masterregistri teema T26 `PILOT-PARTNER-V1`)
Kuupäev: **2026-07-17**
Koostaja: Fable 5 (analüüsirada)

**ANALYSIS STATUS: COMPLETE**
**T26 READINESS: ANALYSIS_READY** — piloodimudel on valmis; päris aktiveerimine on kolme otsuse (O-PP-1/2/3) ja T27 release candidate'i värava taga. Uut rakenduskoodi enne release candidate'i ei vajata (ptk 16).

Kontrollitud lähteseis: analüüs tugineb koordinaatori handoff'i, arendusprogrammi ja masterregistri **17.07.2026 kontrollitud faktidele** (`origin/main = server @ fe4eb4fa`; kohalik määrdunud `main 0da4185b` ei ole ühegi väite alus). Ülesande reegli järgi **uut Git-, serveri- ega koodiauditit ei tehtud** — kõik koodiseisu väited kannavad viidet olemasolevale tõendile.

Kinnitus: rakenduskoodi, Prisma skeemi, migratsioone ega teste ei muudetud; ühtegi serverit, andmebaasi ega välist teenust ei käivitatud; tootmisandmeid ei loetud; päris partneriga ei kontakteerutud; päris kasutajakontosid ei loodud; ei commit'itud, merge'itud ega deploy'tud. Koordinaatori handoff'i ega arendusprogrammi ei muudetud; uuendati ainult masterregistri T26 kirjet + jätkamispunkti ja tulevikuanalüüside registrit.

## Edenemistabel

| # | Etapp | Seis | Tulemus |
|---|---|---|---|
| 1 | Kohustuslike sisendite lugemine (handoff, programm, masterregister, ORG/ESTA/FIELD/COLLAB/WELLBEING-V2 analüüsid, omanikuvaade, lisavastused) | TEHTUD | läbivalt viidatud |
| 2 | Juhtkokkuvõte | TEHTUD | ptk 1 |
| 3 | Piloodikandidaatide võrdlus | TEHTUD | ptk 2 |
| 4 | Soovitatud esimese piloodi ulatus + kestused | TEHTUD | ptk 3 |
| 5 | 12-etapiline kohustuslik piloodimudel | TEHTUD | ptk 4 |
| 6 | Partneri ja kasutajate teekond | TEHTUD | ptk 5 |
| 7 | Rollid, vastutused, kontod ja õigused | TEHTUD | ptk 6 |
| 8 | Andmekaitse- ja lepingumaatriks + privaatsusinvariandid | TEHTUD | ptk 7 |
| 9 | Sünteetilise prooviperioodi leping | TEHTUD | ptk 8 |
| 10 | Koolitus- ja kasutuselevõtukava | TEHTUD | ptk 9 |
| 11 | Tugimudel ja intsidendirada | TEHTUD | ptk 10 |
| 12 | Mõõdikud ilma privaatset sisu lugemata + tootearenduse tagasiside | TEHTUD | ptk 11 |
| 13 | Go/no-go, stop ja rollback-väravad | TEHTUD | ptk 12 |
| 14 | Lõpetamine, eksport, kustutamine, ligipääsu sulgemine | TEHTUD | ptk 13 |
| 15 | Laienemise tingimused | TEHTUD | ptk 14 |
| 16 | Blokeerivad tooteomaniku otsused (max 3) | TEHTUD | ptk 15 |
| 17 | PILOT-PARTNER-V1: koodivajaduse hinnang | TEHTUD | ptk 16 |
| 18 | Registritekstid + jätkamispunkt | TEHTUD | ptk 17 + Jätkamispunkt |

---

## 1. Juhtkokkuvõte

1. **Esimene piloot tehakse ühe KOV-i sotsiaaltööosakonnaga olemasoleva baasvoo peal** — mitte ühegi uue suure funktsiooniteema (T20–T25) peal. Soovitatud väikseim terviklik ulatus on **eelpöördumise täisrada**: vestlus → Teekond → kasutaja valitud jagamisega eelpöördumine → vastuvõtulaud → ühine ruum → kohtumise kokkuvõte → „Minu jagamised" ja tagasivõtt. See on ainus kasutusolukord, mille kogu ahel on serveris runtime-tõendatud (Teenusekaardi/abivahenduse ja Teekonna auditid; Help P0 / DOK-XTEN / ADMIN-P0.1 turvaparandused on `fe4eb4fa` release'is), mis ei sõltu ühestki suurest ehitamata teemast ja mida saab turvaliselt peatada.
2. **Piloot on juhitav 12-etapilise mudelina** (ptk 4): partnerihindamine → eesmärgi/funktsioonide valik → andmekaitse/leping → partneri administraatori määramine → sünteetiline proov → koolitus → piiratud päris aktiveerimine → iganädalane seire → vahehindamine → jätka/muuda/peata otsus → lõpetamine (eksport+kustutus+sulgemine) → teadlik laienemisotsus. Iga üleminek käib nimetatud värava (G0–G5) kaudu.
3. **Mõõtmine ei loe kunagi privaatset sisu.** Mõõdikud on ainult staatuse-ajatemplid, loendurid ja vabatahtlik tagasiside; pöördujapoolsed koondid kannavad `k≥5` summutust (ORG-A0 rangem klass; sisepiloodi lävi 3 ei sobi väliseks raporteerimiseks); töötajate Tööheaolu kasutusfakti ei mõõdeta üldse (W-INV-2). Mõõtmise selgroog on T04 `U1-P0` eelpöördumise staatusesündmused — sama vertikaal, mis on niikuinii järgmine Sol/Terra teema.
4. **Uut koodi enne release candidate'i ei vajata.** Kogu soovitatud skoop on kas live-serveris või juba külmutatud harudes, mis liiguvad T27 release candidate'i kaudu tootmisse. Kolm nimelist tehnilist eeltingimust on TK-P0 jagamispiir (T06 — täna on serveris lekkega rada just piloodi tuumvoos), VEST-P0/P0a kriisifail-safe (Wave A harus) ja U1-P0 mõõtesündmused (T04). PILOT-PARTNER-V1 eraldi koodipakett on ainult tingimuslik väike mõõtevormide lisa, kui tooteomanik seda soovib (ptk 16).
5. **Blokeerivaid tooteomaniku otsuseid on täpselt kolm** (ptk 15): O-PP-1 partneriprofiil + funktsioonikomplekt (vaikevalik: 1 KOV-osakond + eelpöördumise täisrada), O-PP-2 õiguslik pakett (töötlejarollid, eelpöördumise menetlusstaatus, DPIA, pilootleping) ja O-PP-3 päris aktiveerimise värav (eeltingimuste checklist PASS → omaniku go). Ükski ei blokeeri ettevalmistust; kõik kolm blokeerivad päris kasutajate kaasamist.
6. **Piloot ei anna automaatselt laia rollout'i luba** ja iga turva- või privaatsusintsident saab piloodi peatada (STOP-1 värav, ptk 12). ORG-V1, FIELD-V1, ESTA-MENTOR-V1 ja muud suured teemad EI ole piloodi eeldused — need on laienemise, mitte alustamise teemad.

---

## 2. Piloodikandidaatide võrdlus

Hindamiskriteeriumid: koodivalmidus (Git-tõendiga), privaatsus-/õigusrisk, sõltuvus ehitamata teemadest, päris kasutusväärtus väikesele rühmale, peatatavus ja mõõdetavus ilma sisu lugemata.

| Kandidaat | Koodivalmidus (tõend) | Privaatsus-/õigusrisk piloodis | Sõltuvused | Väärtus väikesele rühmale | Verdikt |
|---|---|---|---|---|---|
| **Olemasolev baasvoog: eelpöördumise täisrada** (vestlus, Teekond, eelpöördumine, vastuvõtulaud, ruum, U10 kokkuvõte, U12/U3 jagamised) | **LIVE + runtime-tõendatud** (`fe4eb4fa`; Teenusekaardi/Teekonna auditid; U1-V0 teavitustimer töötab serveris) | madal-keskmine: privaatsus-P0-d (Help, DOK-XTEN, Admin) suletud; **TK-P0 jagamispiir veel lahti** (T06) | Wave A + TK-P0 + U1-P0 release'i kaudu; ühtegi ehitamata suurteemat ei vaja | kohene: pöörduja saab selgema pöördumise, töötaja saab eelinfo ja tööplaani | **SOOVITUS — esimene piloot** |
| **Tööheaolu (T14)** | kood live, aga **toodangus 0 kirjet**; E0 parandus harus `fe8c7df2` mergeta (V17 viga main-is); lugemisrada WB-V2-P0 ehitamata | madal individuaaltasandil (privaatne vaikimisi); **mõõtmine on vastuolus kasutusfakti kaitsega (W-INV-2)** — piloodi „eduandmeid" ei tohi koguda | E0 järelkontroll+merge; WB-V2-P0; TO-1/TO-2 otsused | töötajale isiklik, aga „ring ei sulgu" enne lugemisrada | **mitte eraldi piloodina**; võib olla töötajatele vaikselt kättesaadav mõõtmata lisa (O-PP-1 alaotsus) |
| **Professionaalne ühistegevus (T20 COLLAB)** | koodi pole (esimene pakett COLLAB-P0 on alles lepingukiht); kohtumise täisvaade vajab Room-elutsüklit ja U1 | keskmine (mitmepoolsed ruumid, kolmandad isikud O-CO-6 taga) | T04, T12, O-CO-1/2/5 | puudub enne ehitust | hilisem laine |
| **Juhtumitöö assistent (T21 CASEWORK)** | proto-JTA osaliselt live (STAR_HELPER jt artefaktid), tervik ehitamata | **kõrge**: kliendiandmed, STAR2-piir; O-CW-1 (õiguslik staatus + vastutav töötleja) nõuab partner-KOV-i otsust **enne pilooti** | T04, T20; O-CW-1…10 | suur, aga alles pärast tervikteostust | hilisem; loomulik **2. faasi kandidaat sama partneriga**, kui baaspiloot õnnestub |
| **ESTA mentorlus (T23)** | ANALYSIS_READY, 0 blokeerivat otsust, partneri-neutraalne; **koodi pole** (ESTA-MENTOR-V1 ehitamata) | madal: professionaalidevaheline, kliendiandmete keeld (I8), ESTA lepet ei vaja | ESTA-MENTOR-V1 teostus | olemas pärast ehitust; ESTA tutvustuspäev toetab | **hea 2. piloodi kandidaat** (professionaalide piloot ilma KOV-menetluseta) |
| **Mobiilne välitöö (T24 FIELD)** | READY_THEME_BUILD (O-FD-1/2/3 kinnitatud), **koodi pole**; offline-kiht/fototugi täna 0 | **kõrge**: seadmes hoitavad andmed, kodukülastuse kolmandad isikud, seadme-QA maatriks | FIELD-V1 teostus + seadmepargi kontroll | suur välitööd tegevale osakonnale | hilisem; vajab oma pilooti FIELD-V1 DoD osana, mitte esimest partnerpilooti |
| **Organisatsiooni anonüümitud analüütika (T25 ORG)** | ANALYSIS_READY, **koodi pole**; O-ORG-1/2/3 on aktiveerimisväravad | kõrge just piloodi kontekstis: heaolukoond nõuab O-WB-3/O-ORG-2 õigusanalüüsi ja A1–A5 aukude sulgemist | ORG-V1 teostus + õigusotsused + partnerlepe | juhile, mitte esmakasutajale | **ei ole esimese piloodi funktsioon**; org-kihti pole piloodiks vaja (lisavastuste järeldus, ORG-A0 kinnitatud) |

**Kokkuvõte:** ainus kandidaat, mis on korraga koodina olemas, madala riskiga, sõltuvustevaba ja päris väärtusega, on olemasolev baasvoog. Kõik T20–T25 teemad jäävad kas 2. faasi (CASEWORK sama partneriga; ESTA-mentorlus professionaalide piloodina) või laienemisjärgseks (FIELD, ORG, COLLAB täisvaade). See täidab ülesande nõude „väikseim terviklik piloot, mis annab päris kasutusväärtuse ja mida saab turvaliselt peatada" — mitte kõige suurem funktsioonikomplekt.

---

## 3. Soovitatud esimese piloodi ulatus

### 3.1. Partner ja kasutajarühm

- **Partner:** üks KOV-i sotsiaaltööosakond (tööüksus ORG-A0 mõistes, aga **organisatsioonikihti ORG-V1 piloodiks ei ehitata** — liikmehaldus käib käsitsi + allowlist-mustritega, nagu lisavastuste analüüs soovitas ja ORG-A0 kinnitas). Alternatiiv (mitme töötajaga teenuseosutaja) jääb O-PP-1 valikusse, kuid KOV-osakond on eelistatud: eelpöördumise voog on tema igapäevatöö ja juhtumitüüp „eakas või hooldaja pöördub KOV-i poole" on suure mahuga, madala akuutsusega.
- **Kasutajarühm:** **2–4 sotsiaaltöötajat + 10–30 pöördujat** (kokku ≤ ~35 kontot). Pöördujad kutsub partner ise oma tavakanalites — inimesed, kes nagunii pöörduvad; kriisijuhtumeid pilooti ei suunata. Teenuseosutajat esimeses piloodis EI OLE (kolmas osapool kolmekordistaks liitumis- ja õiguskoormust; Teenusekaardi KOV-kontaktidest piisab suunamiseks).
- **Registreerimine:** suletud (olemasolev `REGISTRATION_OPEN` lipp + kutsed); tasuta ligipääs admini `UserEntitlementOverride`-idega; makseid piloodis ei ole.

### 3.2. Funktsioonid sees / väljas (O-PP-1 vaikevalik)

| Sees | Väljas (teadlikult) |
|---|---|
| Vestlus RAG-allikatega (ilma süvauuringuta) | Süvauuring/research (worker-unit serveris puudub; TE1 lahtine) |
| Teekond + kasutaja valitud jagamisega eelpöördumine (TK-P0 järel) | Kovisioon ja Teemaseemned (grupivorm; pole piloodi fookus) |
| Vastuvõtulaud + tööplaan/kontrollnimekiri + „järgmine kontakt" | Abisoovid/-pakkumised (vajavad kriitilist massi) |
| Ühine ruum (kirjalik; kõne lubatud, **salvestus keelatud** — `RECORDING_ENABLED=false` püsib) | Kõnesalvestus/egress (FAILID-P0.1 eeltingimus täitmata) |
| U10 kohtumise kokkuvõte + „sain aru / parandus" | Häälvestlus STT/TTS mõõdetava skoobina |
| U12 „Minu jagamised" + U3 tagasivõtt enne avamist | Materjalid/RAG-i isiklik ingest, maksed, väline EXTERNAL_EMAIL jagamiskanal |
| Teavitused (U1-V0 + U1-P0 sündmused) + transaktsioonilised e-kirjad registreeritud kasutajatele | Tööheaolu **mõõdetavast skoobist väljas** (töötajatele võib jääda vaikselt kättesaadavaks; kasutusfakti ei mõõdeta) |
| Kasutusjuhend ja avalikud infopinnad | ORG-vaated, FIELD, mentorlus, supervisioon, JTA tervik |

Funktsioonineutraalsuse reegel: ptk 4–14 mudel (etapid, rollid, lepingud, väravad, mõõtmispõhimõtted) kehtib **iga** O-PP-1-s valitava funktsioonikomplekti kohta; ainult ptk 5 teekond, ptk 11 mõõdikute loend ja G3 tehniline checklist tuleb valitud komplektile üle kanda.

### 3.3. Kestused ja üleminek sünteetiliselt päris tööle

| Faas | Kestus (soovitus) | Märkus |
|---|---|---|
| Ettevalmistus (etapid 1–4): partnerihindamine, otsused, leping/DPIA, administraator | 3–6 nädalat | võib joosta **paralleelselt** platvormi Wave A / T27 arendusega; ei oota release candidate'i |
| Sünteetiline proov (etapp 5) | 2 nädalat | algab alles pärast release candidate'i deploy'd (G2 sissepääs); 1 nädal läbimäng + 1 nädal parandused/kordus |
| Koolitus ja valmisoleku kontroll (etapp 6) | 1–2 nädalat | võib osaliselt kattuda sünteetilise proovi teise nädalaga |
| Piiratud päris piloot (etapid 7–10) | 8–12 nädalat | vahehindamine nädalal 4–6 |
| Lõpetamine ja hindamine (etapid 11–12) | 2 nädalat | eksport, kustutused, koondraport, laienemisotsus |

**Sünteetiliselt päris tööle liigutakse ainult G3 värava kaudu** (ptk 12): release candidate deploy'tud ja smoke PASS + sünteetilise proovi checklist PASS + koolitus läbitud + O-PP-2 leping allkirjastatud + O-PP-3 omaniku go. Enne seda ei looda ühtegi päris kasutajakontot.

---

## 4. Kohustuslik piloodimudel — 12 etappi

| # | Etapp | Sisu | Vastutaja | Väljund / värav |
|---|---|---|---|---|
| 1 | **Partnerikandidaadi hindamine** | kriteeriumid: motivatsioon ja juhtkonna tugi; 2–4 töötajaga üksus; eelpöördumise-laadne igapäevavoog olemas; IT-baas (ajakohased brauserid, töö-e-post); andmekaitsekontakt olemas; valmisolek iganädalaseks seireks; kriisiprotseduur asutuses olemas; ei ole samal ajal konkureerivat IT-juurutust | tooteomanik (+ ESTA tutvustuspäev kanalina, ptk 9.3) | hindamismemo; G0: kandidaat sobib / ei sobi |
| 2 | **Piloodi eesmärgi ja funktsioonide valik** | O-PP-1 otsus: partneriprofiil + funktsioonikomplekt (vaikevalik ptk 3.2) + edukriteeriumid (ptk 11.4) + Tööheaolu kättesaadavuse alaotsus | tooteomanik | kinnitatud skoop; mõõdikuplaan lukus |
| 3 | **Andmekaitse ja lepinguline valmisolek** | O-PP-2 pakett: töötlejarollide jaotus (ptk 7.2), eelpöördumise menetluslik staatus partneri menetluses (STAR2-piir), DPIA/andmekaitsehinnang, pilootleping, kasutajate infolehed, kriisiprotseduuri lisa | tooteomanik + jurist + partneri andmekaitsekontakt | allkirjastatud leping + DPIA; G1 |
| 4 | **Partneri administraatori määramine** | partner nimetab piloodijuhi (organisatsiooniline roll, mitte platvormi admin — ptk 6.2); kokku lepitakse sidekanalid, seirerütm ja intsidentide edastus | partner | nimeline kontakt + asendaja; töökord kirjas |
| 5 | **Sünteetiliste kontode ja testandmete proov** | ptk 8 leping: release candidate'i keskkonnas sünteetiliste kontodega täisläbimäng + eellend (AI-võtmed, SMTP, e-kirjad) + koristus | tooteomanik + partneri piloodijuht (+1–2 töötajat vaatlejana) | proovi protokoll; G2: checklist PASS, 0 lahtist P0/P1 |
| 6 | **Koolitus ja kasutajate valmisoleku kontroll** | ptk 9 kava: töötajate pool päeva + juhendatud proovimine sünteetikas; pöördujate onboarding-materjalid; valmisoleku checklist iga töötaja kohta | tooteomanik + partneri piloodijuht | koolitusprotokoll; valmisoleku kinnitus |
| 7 | **Piiratud päris piloodi aktiveerimine** | O-PP-3 go; töötajakontod → esimesed 5–10 pöördujat → järk-järgult kuni 30; iga kasutaja saab infolehe (mida mõõdetakse, õigus lahkuda) | tooteomanik (lülitid) + partner (kutsed) | G3 läbitud; aktiveerimislogi |
| 8 | **Iganädalane operatiivne jälgimine** | 30-min nädalakõne (piloodijuht + tooteomanik): intsidendid, lehtriloendurid, avatud küsimused; piloodipäevik (sisuta); teenuse tervis (health/veamäärad) | tooteomanik + partneri piloodijuht | nädalamärge päevikus |
| 9 | **Vahehindamine** | nädalal 4–6: mõõdikud vs edukriteeriumid; kasutajate vabatahtlik tagasiside; intsidentide koond; skoobi peensused (nt kutsete tempo) | tooteomanik + partner | vahehindamise memo; G4 sisend |
| 10 | **Jätkamise, muutmise või peatamise otsus** | G4: jätka samas skoobis / muuda (nt rohkem pöördujaid, üks lisafunktsioon O-PP-1 uuendusega) / peata (STOP-rada ptk 12.3) | tooteomanik + partner (kummalgi vetoõigus oma poolele) | otsuse protokoll |
| 11 | **Piloodi lõpetamine: eksport, kustutamine, ligipääsu sulgemine** | ptk 13 kord: kasutajate valik (konto jääb / kustutatakse), artefaktide eksport, partneripoolse ligipääsu sulgemine, sünteetiliste jääkide nullkontroll, koondraport | tooteomanik + partneri piloodijuht | lõpetamisprotokoll + koondraport |
| 12 | **Teadlik laienemisotsus** | ptk 14 tingimused: kas sama partneriga 2. faas, uus partner, või paus; laienemine EI ole automaatne | tooteomanik | laienemisotsuse memo; G5 |

Etappide 1–4 järjekord on range; etapid 5–6 võivad osaliselt kattuda; etapid 8–10 korduvad kuni lõpetamiseni.

---

## 5. Partneri ja kasutajate teekond

### 5.1. Partneri teekond

Kandidaat (etapp 1) → skoobi ja edukriteeriumide kokkulepe (2) → leping + DPIA (3) → piloodijuhi määramine (4) → piloodijuht osaleb sünteetilises proovis (5) → töötajate koolitus (6) → pöördujate kutsumine oma kanalites (7) → nädalarütm ja vahehindamine (8–9) → jätka/muuda/peata (10) → lõpetamine ja koondraport (11) → laienemisarutelu (12). Partner ei saa üheski etapis ligipääsu kasutajate sisule — tema „vaade" on nädalakõne koondloendurid ja lõpu koondraport (`k≥5` reegliga).

### 5.2. Pöörduja teekond (soovitatud skoobis)

Partneri kutse → konto loomine (suletud registreerimine) + piloodi infoleht → vestlus allikaviidetega vastustega → Teekond salvestub privaatsena → „koosta eelpöördumine" Teekonnast: näeb ja **valib**, mida jagab (TK-P0 fail-closed piir) → saadab → teavitus, kui töötaja võttis vastu → vajadusel täpsustused ühises ruumis → kohtumine päriselus → saab ruumi kohtumise kokkuvõtte selges keeles ja märgib „sain aru / mul on parandus" → näeb „Minu jagamised" alt, mida ta on jaganud, ja saab enne avamist tagasi võtta → piloodi lõpus valib: konto jääb või kustutatakse.

### 5.3. Sotsiaaltöötaja teekond

Koolitus + valmisoleku kinnitus → teavitus/e-kiri uuest pöördumisest → vastuvõtulaud (kinnitatud eelinfo + kontrollnimekiri + „järgmine kontakt" kuupäev) → vajadusel ruum täpsustuseks → aja pakkumine sõnumina (broneerimissüsteemi ei ole) → kohtumine → kokkuvõtte koostamine dokrežiimis ja postitamine ruumi (U10) → ametlik menetlus jätkub STAR2-s **käsitsi** (kandjapiir: platvorm ei ole menetlusregister; STAR_HELPER mustand on abiks, mitte nõue) → vabatahtlik hinnang „kui palju eelinfo aitas" (ptk 11) → nädalakõnel tähelepanekud.

### 5.4. ESTA tutvustuspäeva seos

ESTA tutvustuspäev (lisavastuste formaat: pool päeva — visioon ja piirid, elus demo sünteetiliste andmetega, juhendatud proovimine, kolm palvet) toetab pilooti kahel viisil: usaldusväärsus partner-KOV-i leidmisel ja metoodiline tagasiside. See EI ole piloodi eeldus ega õiguslik samm — demo piirdub töötava selgrooga ja ESTA suunas ei võeta ühtegi kohustust (partnerilepe on kinnitamata; ESTA-MENTOR-V1 on partneri-neutraalne ega vaja seda).

---

## 6. Rollid, vastutused, kontod ja õigused

### 6.1. Rollimaatriks

| Roll | Kes | Vastutab | EI tee / EI näe |
|---|---|---|---|
| **Piloodi operatiivne omanik** | SotsiaalAI tooteomanik | lülitid (registreerimine, entitlement'id), väravad G0–G5, seire, intsidentide teine tasand, koondraport | ei loe kasutajate sisu (admin-sisupiir on IDOR-audititega tõendatud; 404-norm) |
| **Platvormi admin** | sama isik (olemasolev `isAdmin`) | kontode entitlement-override'id, ohtlike toimingute väravad (ADMIN-P0.1), tervisevaated | ei ava privaatset sisu; iga ohtlik toiming käib reason+audit väravast |
| **Partneri piloodijuht („partneri administraator")** | partneri nimetatud töötaja | kasutajate valik ja kutsumine, esmatasandi tugi, nädalakõned, intsidentide edastus, koolituse korraldus partneri poolel | **ei saa platvormi admin-õigusi ega haldusvaadet** (ORG-V1 puudub — see on teadlik V1 piir, mitte auk); ei näe kasutajate sisu ega individuaalseid mõõdikuid |
| **Partneri töötaja** | 2–4 sotsiaaltöötajat | oma töö platvormil; tagasiside; kriisiprotseduuri järgimine | ei näe teiste töötajate privaatset sisu; näeb ainult talle saadetud pöördumisi |
| **Pöörduja** | 10–30 partneri kutsutud inimest | oma sisu ja jagamisotsused | — (kõik õigused on tavakasutaja omad) |
| **Jurist / andmekaitse** | mõlemal poolel | O-PP-2 pakett; intsidentide õiguslik hinnang | — |
| **Arenduskoordinaator** | olemasolev roll | T27 release candidate'i värav, tehnilise eeltingimuste checklisti kinnitus | piloodi sisulisi otsuseid ei tee |

### 6.2. Vastutav töötleja, volitatud töötleja ja operatiivne omanik (soovitus, kinnitab O-PP-2 jurist)

- **Platvorm (SotsiaalAI operaator) on iseseisev vastutav töötleja** platvormiteenuse osas: kontod, privaatne sisu (vestlused, Teekond, dokumendid, Tööheaolu), teavitused, sündmuspõhine mõõtmine. See on tänase privaatsuspoliitika seis ja piloot ei muuda seda.
- **Partner (KOV) on vastutav töötleja oma menetluspoole osas**: mida tema töötaja pöördumisest oma ametlikku menetlusse (STAR2) võtab, on partneri töötlus väljaspool platvormi. Platvorm ei ole menetlusregister ega selle volitatud töötleja (kandjapiir, COLLAB 1.3).
- **Soovituslik mudel on „kaks iseseisvat vastutavat töötlejat + koostööleping"**, mitte ühisvastutus ega volitatud töötleja suhe. Volitatud töötleja suhe tekiks ainult siis, kui platvorm hakkaks partneri **tellimusel** töötlema midagi partneri nimel (nt isikustatud aruandlus) — seda piloodis teadlikult EI tehta: partnerile antav raport on anonüümne koond. Kui jurist hindab mõne osa (nt töötajakontode korraldus tööandja suunisel) volitatud töötlemiseks, lisatakse standardne volitatud töötleja lisa — see on O-PP-2 sisu, mitte selle analüüsi vaikimisi otsus.
- **Piloodi operatiivne omanik on tooteomanik** (SotsiaalAI pool). Partneri piloodijuht on operatiivne kaasomanik oma asutuse protsesside osas. Kummalgi on STOP-õigus (ptk 12.3).

### 6.3. Kontod ja õigused (küsimus 8)

| Konto | Arv | Roll platvormil | Loomine | Õigused | Sulgemine |
|---|---|---|---|---|---|
| Platvormi admin | 1 (olemasolev) | ADMIN | olemas | olemasolevad admin-väravad | — |
| Töötajad | 2–4 | SOCIAL_WORKER | suletud registreerimine + kutse; tasuta entitlement | tavakasutaja; näevad oma pöördumisi | entitlement aegub piloodi lõpus; konto saatus kasutaja valik |
| Pöördujad | 10–30 | CLIENT | partneri kutse + suletud registreerimine; tasuta entitlement | tavakasutaja | sama |
| Sünteetilised proovikontod | 3–5 | rollide kaupa | luuakse etapiks 5, **kustutatakse pärast** (ptk 8) | ainult proovi ajal | kohustuslik koristus |
| Teenuseosutaja | 0 | — | esimeses piloodis ei looda | — | — |

Uut rolli, org-liikmesust ega capability-kihti piloodiks ei looda. Partneri piloodijuht kasutab tavalist töötajakontot; tema „adminlus" on organisatsiooniline.

---

## 7. Andmekaitse- ja lepingumaatriks

### 7.1. Privaatsusinvariandid (PP-INV; siduvad kogu piloodi vältel)

1. **PP-INV-1:** piloodi hindamiseks ei loeta kasutajate vestlusi, märkmeid, dokumente ega juhtumisisu — mitte ühelgi rollil, mitte ühelgi eesmärgil.
2. **PP-INV-2:** mõõdikud põhinevad ainult sündmustel, olekutel, loenduritel ja vabatahtlikul tagasisidel (ptk 11).
3. **PP-INV-3:** organisatsioon (partner) ei näe individuaalset Tööheaolu, juhtumisisu ega ühegi kasutaja privaatset sisu; heaoluandmete mistahes koond on väljaspool piloodi skoopi (O-WB-3/4 + O-ORG-2 taga).
4. **PP-INV-4:** tugi ei ava vaikimisi kasutaja sisu; silumine käib kasutaja nõusolekul, tema enda jagatud ekraanipiltide või sünteetilise reprodutseerimisega (ptk 10.3).
5. **PP-INV-5:** tootmisandmeid ei kasutata tehnilise auditi ega testimise materjalina; proovid käivad ainult sünteetiliste kontodega (ptk 8).
6. **PP-INV-6:** piloot ei anna automaatselt luba laiale rollout'ile (ptk 14).
7. **PP-INV-7:** turva- või privaatsusintsident saab piloodi peatada; STOP-rada on eelnevalt kokku lepitud (ptk 12.3).
8. **PP-INV-8:** Tööheaolu kasutusfakti (kas ja kui palju keegi kasutab) ei mõõdeta ega raporteerita kellelegi (W-INV-2 laieneb piloodile).

### 7.2. Andmekategooriad piloodis (küsimus 7)

| Andmekategooria | Kasutus piloodis | Töötleja | Kes näeb | Piloodi lõpus |
|---|---|---|---|---|
| Konto andmed (nimi, e-post, roll) | kontode loomine, teavitused | platvorm (vastutav) | kasutaja ise; admin haldusfaktidena | konto jääb või kustutatakse kasutaja valikul |
| Vestlused, Teekond, dokumendid | kasutaja enda töö | platvorm (vastutav) | ainult omanik (+tema jagamised) | omaniku kontrolli all; mõõtmisse ei lähe |
| Eelpöördumise jagatud kiht | pöördumise menetluseelne info | platvorm; partneri töötaja menetlusotsus on partneri töötlus | autor + valitud vastuvõtja | O-TK9 retention-reegli järgi; tagasivõtt U3 |
| Ruumi sisu + U10 kokkuvõte | täpsustused ja kohtumise kandja | platvorm | ruumi osalejad | ruumi elutsükli reeglid; kokkuvõte külmutatud kandjana |
| Tööheaolu kirjed | **mõõdetavast skoobist väljas** | platvorm | ainult omanik | omaniku kontrolli all |
| Sündmuste ajatemplid, loendurid (U1) | piloodi mõõtmine (sisuta payload; K1-U1 6.4 reegel) | platvorm | tooteomanik koondina; partner `k≥5` koondraportis | koond säilib platvormi arenduse tõendina; isikuvõtmeid ei sisalda |
| Vabatahtlik tagasiside (hinnangud, järelvorm) | piloodi hindamine | platvorm (või partneri protsess, ptk 16) | koondina | koondraportis |
| Auditijäljed (DataAuditLog) | turva- ja haldusfaktid | platvorm | admin protseduurirajalt | audit_long klass; ei kustu piloodi lõpuga |
| **Teadlikult EI kasutata:** salvestised (RECORDING_ENABLED=false), makseandmed, STAR2/registrite andmed, geolokatsioon, süvauuringu tööd, kasutusfakti-analüütika | — | — | — | — |

### 7.3. Lepingud ja dokumendid enne päris aktiveerimist (küsimus 14)

| Dokument | Sisu | Kes | Millal |
|---|---|---|---|
| **Pilootleping** (koostööleping) | eesmärk, skoop, kestus, rollid, STOP-õigused, koondraporti kuju, lõpetamise kord, kulude/tasuta kasutuse säte | tooteomanik + partner | etapp 3 (G1) |
| **Andmekaitsehinnang (DPIA)** | töötlejarollid (ptk 6.2), andmekategooriad (7.2), riskid ja maandused (PP-INV), rikkumisteavituse kord | jurist + mõlema poole andmekaitse | etapp 3 (G1) |
| **Eelpöördumise menetlusstaatuse kokkulepe** | kas ja millal partner registreerib pöördumise STAR2-s; platvormi kandjapiiri kinnitus (seos O-CW-1 perekonnaga — piloodi jaoks piisab kitsast eelpöördumise-kokkuleppest, JTA täisotsust ei tehta) | partner + jurist | etapp 3 |
| **Kasutajate infolehed** (töötaja + pöörduja) | mis on piloot; mida mõõdetakse (ainult sündmused/koondid); mida EI mõõdeta; õigus igal ajal lahkuda ja andmed kustutada; tugi- ja kriisikontaktid | tooteomanik, partner levitab | etapp 6 |
| **Kriisiprotseduuri lisa** | platvormi kriisirada (VEST-P0 fallback) + partneri enda eskalatsioonikord; kes reageerib, kui töötaja märkab ohtu | partner + tooteomanik | etapp 3–6 |
| **EI vajata:** ESTA lepet, org-partnerlepet (O-ORG-3 — alles ORG-V1 aktiveerimisel), makselepinguid, volitatud töötleja lepet (kui jurist teisiti ei otsusta) | — | — | — |

---

## 8. Sünteetilise prooviperioodi leping (etapp 5)

- **Eesmärk:** tõendada kogu piloodi kasutajateekond release candidate'i keskkonnas ENNE ühegi päris kasutaja kaasamist, sh asjad, mida lokaalselt kontrollida ei saa (AI-võtmed, SMTP/e-kirjad, teavitustimer).
- **Sissepääs (G2 algus):** T27 release candidate on deploy'tud ja deploy-järgne smoke PASS; tehniline eeltingimuste checklist (ptk 12.2) on täidetud.
- **Osalejad:** tooteomanik (juhib), partneri piloodijuht + 1–2 töötajat vaatleja/proovijana (see on ühtlasi koolituse eelvaade).
- **Kontod ja andmed:** ainult selleks loodud sünteetilised kontod (3–5) sünteetilise sisuga; **tootmisandmeid ega päris isikuid ei kasutata** (PP-INV-5). Lokaalsed püsivad testkontod (`tehis-testkontod.md`) jäävad lokaalseks — serveri proovi kontod luuakse eraldi ja kustutatakse.
- **Kohustuslik checklist (soovitatud skoobis):** kutse → konto → vestlus (allikaviidetega vastus) → Teekond → eelpöördumise koostamine valitud jagamisega (sh kontroll, et märkimata sisu EI liigu kaasa — TK-P0) → saatmine → töötaja teavitus + e-kiri → vastuvõtt → vastuvõtulaud → ruum + sõnumid → U10 kokkuvõte + „sain aru" → U12 „Minu jagamised" + U3 tagasivõtt enne avamist → kriisisõnumi kontroll stub-/testirajal (ET/EN/RU fallback ilma välise AI-kutseta) → vale kasutaja IDOR-kontroll (võõras 404) → kontode kustutus + jääkide nullkontroll.
- **Väljapääs (G2 lõpp):** kõik checklisti read PASS; 0 lahtist P0/P1 leidu; koristus dokumenteeritud nulljäägiga; proovi protokoll kirjas. P0/P1 leid → parandus release-protsessi kaudu → kordusproov muutunud osas.
- **Kestus:** 2 nädalat (1 läbimäng + 1 parandused/kordus).

---

## 9. Koolitus- ja kasutuselevõtukava (etapp 6)

### 9.1. Töötajate koolitus

- **Formaat:** pool päeva (ESTA tutvustuspäeva formaadi taaskasutus): ~20 min põhimõtted ja piirid (privaatsus eesotsas — „mida me teadlikult EI ehita" nimekiri on usaldusvara), ~25 min elus demo sünteetiliste andmetega, ~45 min juhendatud proovimine sünteetiliste kontodega (igaüks klõpsib ise), ülejäänu küsimused + kriisiprotseduuri läbimäng.
- **Materjalid:** kasutusjuhend (olemasolev pind), piloodi infoleht, „kuhu pöörduda" tugikaart (ptk 10), kriisiprotseduuri lisa.
- **Valmisoleku kontroll:** iga töötaja on enne aktiveerimist (a) läbinud koolituse, (b) iseseisvalt läbinud sünteetikas ühe täisraja (pöördumise vastuvõtt → ruum → kokkuvõte), (c) kinnitanud infolehe kättesaamise. Checklist täidetakse nimeliselt; puuduv rida lükkab selle töötaja aktiveerimise edasi.

### 9.2. Pöördujate juhendamine ja nõusolek

- Kutse tuleb partnerilt tema tavakanalis; kaasas lihtne infoleht (mis on piloot, mida mõõdetakse ja mida mitte, vabatahtlikkus, kustutamisõigus, tugikontakt).
- Nõusoleku kiht: platvormi kasutus- ja privaatsustingimused (olemasolev kinnitusrada) + piloodi infoleht. Eraldi „piloodi nõusolekuvormi" allkirjastamist ei nõuta, kui jurist O-PP-2-s teisiti ei määra — vabatahtlik liitumine kutse kaudu + selge teave on vaikemudel.
- Esimese sisselogimise tugi: partneri piloodijuht aitab vajadusel kohapeal; platvormipoolne tugi e-postiga.

### 9.3. ESTA tutvustuspäev kasutuselevõtu toetajana

Kui tutvustuspäev toimub enne pilooti, kasutatakse seda partneri leidmiseks ja koolitusformaadi prooviks; demo piirdub töötava selgrooga (ptk 5.4). Päev ei ole ühegi värava eeldus.

---

## 10. Tugimudel ja intsidendirada (etapp 8 tugisammas)

### 10.1. Kaks tugitasandit

| Tasand | Kes | Katab | Kanal | Sihtaeg |
|---|---|---|---|---|
| 1. tasand | partneri piloodijuht | kasutusküsimused, „kuidas teha X", pöördujate esmane abi | partneri tavakanalid | sama tööpäev |
| 2. tasand | tooteomanik (platvorm) | tehnilised vead, kontoprobleemid, kõik intsidendid | e-post + nädalakõne; P0 puhul telefon | P0: kohe / 24 h; P1: 3 tööpäeva; P2/P3: nädalakõnel |

### 10.2. Intsidentide liigitus

| Klass | Määratlus | Näide | Reaktsioon |
|---|---|---|---|
| **P0 — turva/privaatsus** | sisu leke, õiguste ületus, andmekao oht, autentimisviga | kasutaja näeb võõrast sisu | **STOP-rada kohe** (ptk 12.3); jurist kaasatakse; rikkumisteavituse hindamine GDPR tähtaegades |
| **P1 — funktsioon katki** | tuumvoo samm ei tööta, workaround puudub | eelpöördumist ei saa saata | parandus release-protsessi kaudu; vajadusel skoobi ajutine kitsendus |
| **P2 — häiriv puudus** | workaround olemas | kuvaviga, ebaselge tekst | nädalakõne nimekirja; parandus järgmises release'is |
| **P3 — soov/idee** | uus vajadus | „tahaks ka X" | tootearenduse tagasisidekorvi (ptk 11.5) |
| **Kriisijuhtum (inimene ohus)** | EI OLE tehniline intsident | pöörduja kriisisõnum | platvormi kriisirada (VEST-P0 fallback) + partneri kriisiprotseduur; dokumenteeritakse eraldi, sisu ei kopeerita piloodipäevikusse |

### 10.3. Tugi ja kasutaja sisu (PP-INV-4)

Tugi ei ava kasutaja sisu vaikimisi üheski tasandis. Silumise rada: (1) kasutaja kirjeldus + tema enda jagatud ekraanipilt; (2) reprodutseerimine sünteetilise kontoga; (3) tehnilised logid on sisuvabad (`safeError` muster; U1 payload-reegel). Kui viga nõuab erandkorras kasutaja andmete vaatamist, küsitakse kasutaja selgesõnaline nõusolek juhtumipõhiselt ja toiming auditeeritakse. Piloodipäevik (intsidentide logi) ei sisalda kunagi kasutajasisu — ainult klass, kirjeldus, ajad, lahendus.

---

## 11. Mõõdikud ilma privaatset sisu lugemata (etappide 8–9 sisend)

### 11.1. Põhimõtted

Ainult sündmused, olekud, loendurid ja vabatahtlik tagasiside (PP-INV-2). Mõõtmise selgroog on **T04 U1-P0 eelpöördumise staatusesündmused** (DomainEvent, sisuta payload) — täpselt see vertikaal, mis on masterregistris järgmine Sol/Terra teema. Kuni U1-P0 release'ini on ajatemplite allikas `updatedAt`-põhine ligikaudsus, mis märgitakse raporti `basis`-real ausalt (ORG-A0 basis-leping).

### 11.2. Raporteerimisläved

- **Pöördujapoolsed koondid:** `k≥5` eristuvat inimest; alla läve → „alla läve", mitte osalised arvud (ORG-A0 ptk 9 leping; sisepiloodi lävi 3 ei sobi väliseks raporteerimiseks — ideed 20.7).
- **Töötajapoolsed mõõdikud:** 2–4 töötajaga ei ole k-anonüümsus võimalik — seepärast (a) töötajad teavad ja kinnitavad koolitusel, et nende **töövoo sündmusi** (mitte sisu) mõõdetakse piloodi koondina; (b) partnerile raporteeritakse AINULT osakonna koond ilma isikujaotuseta; (c) töötajate pingerida, võrdlust või individuaalset „aktiivsust" ei arvutata ega näidata kellelegi (ORG-INV-8 vaimus).
- **Tööheaolu:** kasutusfakti ei mõõdeta üldse (PP-INV-8).

### 11.3. Mõõdikute kataloog (soovitatud skoobis)

| # | Mõõdik | Allikas | Näitab | Lävi/kuju |
|---|---|---|---|---|
| 1 | Lehter: konto → vestlus → Teekond → mustand → saadetud → vastu võetud → ruum → kokkuvõte → „sain aru" | U1 sündmused + loendurid | kus rada katkeb | etapiloendurid; pöörduja-etapid k≥5 |
| 2 | Vastuvõtu latentsus (SENT→ACCEPTED, mediaan) | U1 ajatemplid | kas eelinfo kiirendab | võrdlus partneri senise telefoni/meili-ajaga (partneri enda hinnang baastasemena) |
| 3 | Hüljatud mustandite määr | loendur | kas koostamine on liiga raske | koond |
| 4 | Täpsustusruumi vajaduse osakaal | loendur | kas eelinfo on piisav (hea eelinfo → langeb) | koond |
| 5 | Tagasivõttude ja „Minu jagamised" kasutus | loendur | usaldusfunktsioonide töö | koond; tõlgendus neutraalne (kasutus = usaldusmärk, mitte probleem) |
| 6 | Töötaja hinnang „kui palju eelinfo aitas" (1–5, juhtumi kohta, sisuta) | vabatahtlik vorm | tajutud väärtus töötajale | koond |
| 7 | Pöörduja kolme küsimuse järelvorm (arusaadavus, lihtsus, kas soovitaks) | vabatahtlik vorm | tajutud väärtus pöördujale | k≥5 |
| 8 | „Sain aru / parandus" märgete jaotus kokkuvõtetel | loendur | selge keele töö | koond |
| 9 | Tehniline tervis: veamäärad, kriisi-fallback'i käivitumised (arv, mitte sisu), health | olemasolev telemeetria | teenuse töökindlus | koond |
| 10 | Intsidentide arv klassiti | piloodipäevik | protsessi tervis | koond |

### 11.4. Edukriteeriumid (O-PP-1 juures lukustatav vaikeettepanek)

Piloot loetakse õnnestunuks, kui 8–12 nädala jooksul: (1) ≥10 pöördujat on läbinud raja vähemalt „saadetud" etapini; (2) vastuvõtu mediaanlatentsus on partneri enda hinnangul senisest rajast parem või sama; (3) töötajate hinnangu mediaan ≥3/5; (4) 0 lahtist P0 intsidenti; (5) partner on valmis jätkama. Kriteeriumid kinnitatakse etapis 2 koos partneriga; neid ei muudeta tagantjärele.

### 11.5. Tagasiside tootearendusse ilma privaatset sisu lugemata (küsimus 13)

Tootearendusse võib liikuda: (a) mõõdikute koondid ja lehtri katkekohad; (b) intsidendiraportid (sisuta); (c) koolitusel ja nädalakõnedel kogutud UX-tähelepanekud (töötajate endi sõnastuses, ilma juhtumiviideteta); (d) vabatahtliku tagasiside koondid; (e) partneri lõpphinnang. EI liigu: kasutajate sisu, üksikkasutaja käitumisprofiilid, Tööheaolu mistahes andmed. Tagasiside kirjendatakse T-teemade keeles (nt „lehter katkeb mustandi juures → T06 UX-parandus") — nii muutub piloot masterregistri sisendiks ilma privaatsuspiiri riivamata.

---

## 12. Go/no-go, stop ja rollback-väravad

### 12.1. Väravad

| Värav | Asukoht | Kriteeriumid | Otsustaja |
|---|---|---|---|
| **G0 — partner sobib** | etapp 1 → 2 | hindamiskriteeriumid (ptk 4 rida 1) täidetud | tooteomanik |
| **G1 — õiguslik valmisolek** | etapp 3 → 5 | pilootleping + DPIA + menetlusstaatuse kokkulepe allkirjastatud (O-PP-2) | tooteomanik + partner + jurist |
| **G2 — sünteetiline proov PASS** | etapp 5 → 6 | ptk 8 checklist PASS; 0 lahtist P0/P1; koristus nulljäägiga | tooteomanik |
| **G3 — päris aktiveerimine** | etapp 6 → 7 | ptk 12.2 tehniline checklist PASS + koolitus/valmisolek kinnitatud + O-PP-3 go | **tooteomanik** (O-PP-3) |
| **G4 — jätka/muuda/peata** | etapp 9 → 10 | vahehindamine vs edukriteeriumid; intsidentide seis | tooteomanik + partner |
| **G5 — laienemine** | etapp 12 | ptk 14 tingimused | tooteomanik |

### 12.2. G3 tehniline eeltingimuste checklist (nimelised sõltuvused, seis 17.07.2026)

1. **T27 release candidate koondkontroll PASS + deploy** — sisaldab Wave A pakette: VEST-P0/P0a kriisifail-safe (`043f0dce`), PROF-P1, TÖÖLAUD-P1, A11Y-I18N-P0, PERF-P0, AVALIK-P1S, EXPORT-P0 (kõik täna `CODE_READY` harudes, mitte serveris).
2. **TK-P0 Teekonna→eelpöördumise fail-closed jagamispiir teostatud ja release'is** (T06) — täna on serveris lekkega rada (shareKeys austab ainult osa võtmeid) **just soovitatud piloodi tuumvoos**; ilma selleta päris pöördujaid ei kaasata.
3. **T04 U1-P0 eelpöördumise staatusesündmused release'is** — mõõtmise selgroog; puudumisel lubatud fallback on `updatedAt`-ligikaudsus, mis märgitakse basis'es (mõõtmise kvaliteedirisk, mitte blokeerija).
4. **OPS-FINAL-A0 (T27) PASS** — backup/restore, rollback-ref, monitooring, timerid; piloot ei alga enne release-candidate'i lõppväravat (masterregistri T26 sõltuvus).
5. **Ohulülitid kontrollitud:** `RECORDING_ENABLED=false` püsib; maksed/recurring väljas; research-süvauuring väljas; `REGISTRATION_OPEN` suletud režiimis.
6. **Deploy-järgne smoke + piloodi eellend** sünteetiliste kontodega (AI-võtmed, SMTP, teavitustimer) — ptk 8.

### 12.3. STOP-rada ja rollback

- **STOP-päästikud:** P0 turva-/privaatsusintsident (PP-INV-7); kriisiraja tehniline tõrge; partneri põhjendatud nõue; tooteomaniku otsus; õigusliku aluse äralangemine. Kummalgi poolel on oma poole STOP-õigus; vaidlus ei lükka peatamist edasi (peata enne, vaidle pärast).
- **STOP-toiming (samal päeval):** uute kutsete sulgemine + (vajadusel) piloodikontode sisselogimise peatamine; kasutajate teavitamine ausa selgitusega; intsidendi käsitlus (ptk 10.2); jurist hindab rikkumisteavituse vajaduse.
- **Rollback'i tähendus piloodis:** soovitatud skoop ei lisa uut koodi ega skeemi, seega **piloodi rollback = ligipääsu sulgemine + (kasutajate valikul) andmete eksport ja kustutamine** (ptk 13), MITTE koodi tagasikeeramine. Platvormi koodi rollback on T27 release-protsessi vara (rollback-ref) ja käivitub ainult tehnilise regressiooni korral tavalise release-korra järgi.
- **Taastumine STOP-ist:** põhjuse kõrvaldamine → G2-laadne kitsas kordusproov muutunud osas → G3 kordusotsus. STOP ei tähenda automaatselt piloodi lõppu, aga kaks P0-STOP-i = piloot lõpetatakse ja tehakse erakorraline järelhindamine.

---

## 13. Lõpetamine, eksport, kustutamine ja ligipääsu sulgemine (etapp 11)

1. **Lõpetamisotsus ja teavitus:** kasutajad saavad vähemalt 2 nädalat ette teate: mis kuupäevani saab platvormi piloodirežiimis kasutada, millised valikud on, kuhu pöörduda.
2. **Kasutaja valik (vaikimisi konto SÄILIB):** piloodikasutajad on päris kasutajad — piloodi lõpp EI kustuta kedagi automaatselt. Valikud: (a) konto jääb alles (tasuta entitlement pikeneb kuni tooteomaniku järgmise otsuseni või avaliku hinnastuseni — kasutajale öeldakse see ausalt); (b) kasutaja kustutab konto (olemasolev kustutusrada; pöördumatu).
3. **Eksport:** kasutaja saab oma artefaktid/kokkuvõtted alla laadida (EXPORT-P0 rajad release'is; RU-kasutajale DOCX-rada kuni PDF Latin-1 piirang püsib). **Aus piirang:** GDPR-täisandmekoopia rada (E-1) on ehitamata kuni EXPORT-P1/O-E1 — kuni selleni täidetakse andmekoopia taotlus käsitsi abistatud protsessiga privaatsuspoliitika §8 lubaduse ulatuses; see piirang kirjutatakse pilootlepingusse ja kasutaja infolehele.
4. **Kustutamine:** kasutaja algatatud kustutus käib olemasoleva orkestreeritud kustutusrajaga; jagatud kandjatele kehtib „autor kustutatud" kandjareegel (O-TK9 valiku järgi). Auditijäljed (DataAuditLog) säilivad audit_long klassis — see öeldakse infolehes.
5. **Partneripoolse ligipääsu sulgemine:** piloodi entitlement-override'id aegevad; suletud registreerimise kutsed suletakse; partneri piloodijuhi „roll" lõpeb (tal polnud platvormiõigusi, seega sulgeda pole midagi peale kokkuleppe).
6. **Mõõtmisandmed:** anonüümsed koondid ja piloodipäevik (sisuta) säilivad platvormi arendustõendina; isikuvõtmetega töövoo-sündmused järgivad olemasolevaid retention-klasse (U1 leping); partnerile jääb ainult koondraport.
7. **Sünteetiliste jääkide nullkontroll:** korratakse proovi koristuskontroll — 0 sünteetilist kontot/sisu tootmises.
8. **Koondraport:** lehter, latentsus, tagasiside koondid, intsidendid, edukriteeriumite seis, õppetunnid T-teemade keeles (ptk 11.5) + soovitus etappi 12.

---

## 14. Laienemise tingimused (etapp 12)

Laienemine on **eraldi teadlik otsus** (PP-INV-6). Tingimused suunast sõltuvalt:

| Laienemissuund | Eeltingimused |
|---|---|
| Sama partner, rohkem kasutajaid / 2. funktsioonifaas (nt JTA-suund) | edukriteeriumid täidetud; P0-intsidente 0 või suletud; O-PP-1 uuendus; JTA-suunal O-CW-1 õigusotsused partneriga |
| **Teine organisatsioon liitub** | **ORG-V1 ehituspäästik** (lisavastuste päästik 1 — ilma liikmesuskihita seguneksid koondid); O-ORG-1 kinnitusprotsess; pilootlepingu mall → korduvkasutatav partnerileping |
| Heaolukoond partnerile (baromeeter) | O-WB-3 õigusanalüüs + O-ORG-2 + A1–A5 aukude sulgemine + ORG-V1 `ANALYTICS_VIEWER` + partneri andmetöötluslepe (O-ORG-3) — **mitte kunagi piloodi inertsist** |
| Mitme töötajaga teenuseosutaja piloot | ORG-V1 (profiili 1:1 piirang murrab ilma selleta) + U4 kättesaadavuse signaal |
| Professionaalide piloot (mentorlus) | ESTA-MENTOR-V1 teostus; ESTA tutvustuspäeva jätk; partnerilepet ei vaja |
| Välitöö piloot | FIELD-V1 teostus + seadmematrix + O-FD kinnitatud väärtuste QA |
| Avalik/lai rollout | eraldi otsus väljaspool T26 skoopi: hinnastus, õigustekstide lõppversioonid (T10), OPS-püsivõimekus, tugimudeli skaleerimine |

---

## 15. Blokeerivad tooteomaniku otsused (maksimaalselt kolm)

| ID | Otsus | Soovituslik vaikevalik | Blokeerib | Viimane hetk |
|---|---|---|---|---|
| **O-PP-1** | Esimese piloodi partneriprofiil ja funktsioonikomplekt (sh Tööheaolu kättesaadavuse alaotsus ja edukriteeriumid) | 1 KOV sotsiaaltööosakond; eelpöördumise täisrada ptk 3.2 tabeli järgi; Tööheaolu töötajatele kättesaadav, mõõtmata; edukriteeriumid ptk 11.4 | etapid 2+ (lepingu koostamine vajab skoopi) | enne etappi 3 |
| **O-PP-2** | Õiguslik pakett: töötlejarollide jaotus, eelpöördumise menetlusstaatus partneri menetluses, DPIA, pilootleping, kasutajainfo | „kaks iseseisvat vastutavat töötlejat + koostööleping" (ptk 6.2); kitsas eelpöördumise-kokkulepe (mitte JTA täisotsus); infolehepõhine kasutajate teavitus | päris kasutajate kaasamise (G1) | enne etappi 5 lõppu / hiljemalt enne etappi 6 |
| **O-PP-3** | Päris piloodi aktiveerimise värav: kinnitus, et G3 checklist (ptk 12.2) on PASS ja sünteetiline proov + koolitus läbitud | go ainult kõigi kuue checklisti-rea PASS-iga; osalist aktiveerimist ei tehta | etapi 7 (esimesed päris kontod) | G3 hetkel |
| — | Muud otsused (O-TK9 retention, O-CW-1 JTA-staatus, O-WB-3/4, O-ORG-1/2/3, TE1 jt) | jäävad oma teemade registritesse; **ükski neist ei ole piloodi blokeerija** peale selle, mida O-PP-2 kitsas ulatuses katab | — | — |

Ükski O-PP otsus ei blokeeri ettevalmistavat tööd (partnerikandidaatide kaardistus, lepingumallide ja infolehtede mustandid, mõõdikuplaani täpsustus) — need võivad alata kohe.

---

## 16. PILOT-PARTNER-V1: kas koodi on vaja enne release candidate'i?

**Vastus: EI — eraldi PILOT-PARTNER-V1 koodipaketti enne release candidate'i ei avata.** Põhjendus:

1. **Kogu soovitatud funktsiooniskoop on kas live või juba külmutatud harudes**, mis jõuavad tootmisse T27 release candidate'i kaudu (Wave A + TK-P0 + U1-P0 on olemasolevad T-teemad, mitte piloodi eritellimus). Piloot ei vaja ühtegi uut mudelit, migratsiooni ega route'i.
2. **Piloodi haldustööriistad on olemas:** suletud registreerimine (`REGISTRATION_OPEN`), tasuta ligipääs (`UserEntitlementOverride`), admin-väravad (ADMIN-P0.1), teavitustimer, sünteetiliste kontode kord.
3. **Mõõtmine ei vaja uut kihti:** U1-P0 sündmused + olemasolevad loendurid katavad ptk 11 kataloogi read 1–5 ja 8–10; kaks vabatahtlikku tagasisidevormi (read 6–7) kogutakse V1-s **partneri protsessis** (koolitusel kokku lepitud lihtvorm / nädalakõne), mitte rakenduses — see hoiab koodijälje nullis ja väldib enneaegset vormiehitust.
4. **Tingimuslik erand:** kui tooteomanik otsustab O-PP-1 juures, et tagasisidevormid peavad olema rakenduses, avatakse pärast release candidate'i **väike PILOT-PARTNER-V1 pakett** piiriga: 2 vormi (töötaja 1–5 hinnang juhtumi kohta ilma sisuta; pöörduja 3 küsimust), `k≥5` summutusega koondvaade tooteomanikule, vormivastuste retention 90 p, 0 muudatust olemasolevates mudelites peale uue vormikandja; ORG-A0 ptk 8 rida 11 leping (piloodi standardvormid) on selle disainialus. See on ainus koodistsenaarium ja seegi ei ole soovituslik vaikevalik.

---

## 17. Registritesse viidud tekstid (tehtud selle töökorraga)

1. `arendusteemade-masterregister.md`: T26 kirje → `ANALYSIS_READY` + viide käesolevale dokumendile + O-PP-1/2/3 + nimelised sõltuvused (T27, TK-P0, U1-P0); ptk 10 jätkamispunkti lisatud T26 seis. Muid teemasid ei muudetud.
2. `fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md`: lisatud rida 9 PILOT-PARTNER-A0 `COMPLETE` + otsused O-PP-1…3 otsuste registrisse + muudatuslogi rida.
3. Koordinaatori handoff'i ja arendusprogrammi EI muudetud (koordinaatori pärusmaa; uuendab pärast lõpparuande vastuvõttu).

## Jätkamispunkt

- **Seis:** kõik 18 etappi TEHTUD (Edenemistabel); esimene täisring COMPLETE; dokument jääb elavaks — uus töökord lisab uue kuupäevaga rea, ei muuda lukustatud lähteseisu.
- **Kontrollitud allikad (17.07.2026):** koordinaatori handoff (291 r), arendusprogramm (665 r), masterregister (560 r), omanikuvaade (193 r), ORG-A0 (643 r), ESTA-MENTOR-A0 (619 r), FIELD-A0 (576 r), COLLAB-A0 (478 r), WELLBEING-V2-A0 (619 r), tulevikuanalüüside register (99 r), lisavastused organisatsioon+piloot (90 r) — kõik täies mahus. Uut Git-, serveri- ega koodiauditit ei tehtud (ülesande keeld); koodiseisu väited kannavad viidet 17.07 kanoonilistele kontrollidele (`origin/main = server @ fe4eb4fa`).
- **Peamised tulemused:** 7 kandidaadi võrdlus → väikseim terviklik piloot on olemasolev eelpöördumise täisrada 1 KOV-osakonnaga (2–4 töötajat + 10–30 pöördujat); 12-etapiline piloodimudel väravatega G0–G5 + STOP-rada; töötlejarollide soovitus („kaks iseseisvat vastutavat töötlejat + koostööleping"); PP-INV-1…8 privaatsusinvariandid; mõõdikukataloog `k≥5` lävega ilma sisu lugemata (selgroog = T04 U1-P0); G3 tehniline checklist (T27 + TK-P0 + U1-P0 + ohulülitid); lõpetamise/ekspordi/kustutamise kord E-1 ausa piiranguga; laienemise päästikutabel (2. org → ORG-V1); 3 otsust O-PP-1/2/3; koodi enne release candidate'i ei vajata (tingimuslik väike vormipakett ainult omaniku soovil).
- **Järgmine töökord siin dokumendis:** (1) kui tooteomanik kinnitab O-PP-1 (soovitavalt koos O-PP-2 paketi tellimisega juristile), märgi otsuseread ja alusta etappi 1; (2) kui T27/Wave A/TK-P0/U1-P0 seis muutub, uuenda G3 checklisti rea seisu; (3) kui O-PP-1 valib teise funktsioonikomplekti, kanna ptk 5/8/11/12.2 loendid uuele skoobile (mudel ise ei muutu); (4) piloodi käivitumisel muutub see dokument piloodi käsiraamatu aluseks — etappide protokollid viidatakse siit.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; lähteseis on lukus 17.07 kanooniliste kontrollide seisuga — uus sessioon kontrollib registrite värskust ja lisab uue rea, vana ei muuda.

STATUS: COMPLETE
