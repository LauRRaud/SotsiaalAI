# ADR-048 — Kuhu kulub aeg enne vastuse esimest teksti

29.09.2026. Mõõtmine ja ettepanek: Claude Opus 5.5 omaniku päevaplaani järgi („mõõda, kuhu 13–28 s enne esimest teksti kulub; kavanda lahendus koos Codexiga ja mõõda enne PR-i“). **Omaniku otsus 29.09: vastuse arutlus jääb `medium`-iks.** Muud kiirendused (allpool) vajavad Codexi ülevaatust.

## Mõõtmine

Kõik ajad on serveris salvestatud pööretest (`timings`, `events`) või samade päringute kordusest. Küsimuste ja vastuste teksti ei loetud.

### 1. Aknas tehtud pöörded 28.09 (10 voogesitatud pööret)

Codex mõõtis samad pöörded samal hommikul täpsemalt, sh pakkuja voo esimesed baidid ja esimese tekstidelta ([audit](../audits/rag-v2-first-text-timings-2026-09-29.md)). Tulemus on sama. Arutlustaseme mõju ja kvaliteet jäid seal tõendamata (NOT_PROVEN); neid mõõdavad allpool jaotised 3 ja 4.

Esimene nähtav tekst tuli **12,7–27,5 s** järel, mediaan 16,3 s. Aeg jaguneb nii (mediaan, vahemik):

| Samm | Aeg | Mis seal on |
|---|---:|---|
| Otsinguplaan | 2,5 s (2,0–3,0) | mudelikutse, arutlus `low` |
| Embedding | 1,0 s (0,3–1,9) | üks OpenAI kutse küsimusele ja plaani päringutele |
| Otsing | 4,4 s (4,0–5,3) | sellest rerank'i mudel 1,4 s (1,1–2,5), sõnaline otsing 1,2 s |
| Vastusemudel kuni esimese tekstini | 8,8 s (4,8–19,7) | arutlus `medium` enne esimest väljundit |

Esimesed kolm sammu võtavad kokku umbes 8 s ja on ühtlased. **Suurem osa erinevusest langeb vastusemudeli tekstieelsesse aega (arutlus).** (Täpsustus Codexi järelülevaate 29.09 järgi: mõõdetud on pakkuja tekstieelne viivitus ja tokenid; sisendi esitusviisi muutmise mõju pole katsena mõõdetud.)

### 2. Kõik 311 vastusekutset 28.09 (`medium`)

- Vastusekutse mediaan 11,1 s, P90 19,4 s.
- Arutlustokeneid mediaan 1091, P90 2159.
- Sobitus: **aeg ≈ 1,7 s + 6,7 ms × arutlustoken + 4,5 ms × nähtav väljundtoken.** Arutlus kulgeb umbes 150 tokenit sekundis ja kogu see aeg on enne esimest teksti.
- Sisendi suurus on arutlusega nõrgalt seotud (r = 0,22; üle 15k sisendtokeni mediaan 1175, alla selle 1030). See ei välista, et dubleerimise või keeruliste juhiste vähendamine lühendaks aega: seda pole katsena mõõdetud (Codexi järelülevaade 29.09).

### 3. Sama päringu kordus: teenustase ja arutluse tase

Kaheksa kataloogipöörde salvestatud vastusepäring (`requestAudit.body`) saadeti uuesti voona, igaüks kolmel kujul. Kulu umbes 0,04 USD plaani hinnatabeli järgi (hinnang, tegelik arve on mitu korda väiksem).

Codex arvutas tulemuse uuesti esimese tekstidelta järgi, kõigil 24 real sama mõõdikuga ([analüüs, 7.2](../audits/rag-v2-system-analysis-2026-09-29.md#72-lõpetatud-24-kutse-võrdlus-täpsustab-esialgseid-numbreid)):

| Kuju | Esimene tekstidelta, mediaan | Vahemik | Kutse lõpuni, mediaan | Arutlustokeneid, mediaan |
|---|---:|---:|---:|---:|
| kinnitatud keha (`medium`) | 5,94 s | 2,65–14,78 s | 7,94 s | 810,5 |
| `service_tier: "priority"` | 5,91 s | 2,67–20,80 s | 8,22 s | 747,5 |
| `reasoning.effort: "low"` | 1,52 s | 0,65–3,41 s | 3,50 s | 69,5 |

- **Prioriteedi soov ei muutnud midagi.** API vastas igal kutsel `service_tier: "fast"`, ka ilma seadeta. See pole kahe teenustaseme võrdlus, vaid näitab, et see projekt saab juba sama taseme.
- Jooksja logis `effort` väljale algse keha taseme ka `low` variandil. Rühmitus käib variandi nime järgi.
- Sama päringu arutlus kõigub kordusel tugevalt: üks keha andis 2466 ja 3334 arutlustokenit. N = 8 ei anna usaldusväärset sabahinnangut.

### 4. Kataloog v4 terviklikult, 29.09

Mõlemad jooksud tehti `eval-full` koopiast, mille `lib` on sama mis tootmises (`f0cc994d3`). `low` plaan on aktiveerimata `/etc/sotsiaalai/m4-eval-full-20260929a.json`.

| | `medium` (tootmisplaan) | `low` |
|---|---:|---:|
| Läbinud | **39/40** | 37/40 |
| Otsingust vastuseni, mediaan / P90 | 11,2 / 17,9 s | 3,9 / 6,0 s |
| Kogu pööre kontrollitud vastuseni, mediaan / P90 | 18,6 / 32,0 s | 12,5 / 19,7 s |
| Vastuse pikkus, mediaan | 652 märki | 750 märki |
| Täpsustava küsimusega vastuseid | 23 | 16 |
| Kulu plaani hinnatabeli järgi (hinnang) | 0,198 USD | 0,177 USD |

- `medium` kukkus läbi ainult kuuldeaparaadi piirhinnas (ADR-046 allikalünk). **See on päeva baas:** eile oli 38/40, sest kontaktisik puudus enne v35.
- `low` lisaks:
  - `appeal-follow-up` 1: otsing ei toonud haldusmenetluse seadust. Otsingu kutsed on mõlemas jooksus `low`, nii et see on otsingu kõikumine, mitte vastuse arutluse mõju;
  - `care-home-correction` 3: kasutaja parandas pensioni 500 eurolt 700-le, aga vastus ei arvestanud uut summat (700 puudus).
- Hindaja kontrollib ainult piirkonda, allikaid, kontakte ja kohustuslikke sõnu. Sõnastuse kvaliteeti see ei mõõda. Omanik leidis 27.09, et `low` on 2,5 korda kiirem, aga vastused on nõrgemad (`chat-plan.js`).

### 5. Etapid pöörde kaupa, 30.09 (Codexi järelülevaade 7.8)

- **Hindaja salvestab nüüd iga pöörde etapid** (`observed.stages`):
  - teenuse etapimärgid: plaan, embedding, otsing, esimene tekst, vastus;
  - otsingu ja iga raja oma sammud;
  - iga mudelikutse ajad ja tokenid;
  - vastusepäringu osad tokenites (otsingu tokenisaatoriga hinnatud; kutse enda tokenid on täpsed).
- `--stream` küsib vastust voona nagu vestlus ja mõõdab esimest nähtavat teksti.
- `--warm` kontrollib enne esimest vestlust teadmusallikad serveri enda soojendusega (1163 allikat, 294 s). Uus protsess kontrollis muidu allikat alles pöörde sees.
- `scripts/rag-v2-stage-timings.mjs` annab iga etapi valimi suuruse, mediaani ja kvartiilid.
- **Mõõtmine:** kataloog v4 (40 pööret), korpus v39, profiil v3, prompt 19, aktiveerimata plaan, arutlus `medium`, vastus voona. Mediaan (p25–p75):

| Etapp | Külm protsess | Soe protsess |
|---|---:|---:|
| Otsinguplaan | 2,43 s (2,12–2,97) | 2,27 s (1,99–3,01) |
| Embedding | 0,44 s | 0,54 s |
| Otsing kokku | 4,26 s (3,51–5,32) | 3,90 s (3,45–4,65) |
| – sõnaline kanal | 1,31 s | 1,32 s |
| – rerank'i samm (sh mudelikutse) | 2,20 s (1,52–3,39) | 1,97 s (1,59–2,61) |
| – rerank'i mudelikutse | 1,59 s | 1,59 s |
| Vastusemudel esimese tekstini | 6,95 s (4,17–10,14) | 6,38 s (4,97–10,22) |
| **Esimene nähtav tekst** | **15,4 s** (11,8–19,9) | **14,2 s** (11,6–18,6) |
| Vastus valmis | 17,2 s | 15,6 s |

- **Tokenid** (soe jooks, mediaan):
  - vastus: sisend 14 158, sellest vahemälust 4865; arutlus 872; väljund 1294;
  - rerank: sisend 17 291, arutlus **0** (p75 164);
  - plaan: sisend 961, arutlus 105, väljund 184.
- **Vastusepäringu osad** (hinnang tokenites, mediaan): juhised 4187, skeem 1117, **oleku kontekst 1730**, otsingu kontekst 1082, tõendite tekst 4497 (p75 6686), allikakaardid 439, tõendite metaandmed 495, sõltuvused 327, eelmine vastus 246, kasutaja pöörded 99, kataloogi kirjed kuni 5629, kui omavalitsus on teada. Küsimus (17) on ka viimane kasutaja pööre.
- **Järeldused:**
  - Suurim osa on endiselt vastuse arutlus enne esimest teksti (~6,4 s, ~870 arutlustokenit `medium` tasemel).
  - **Rerank'i arutlus on juba `low` tasemel mediaanis 0 tokenit.** Taseme `none` (mudel toetab `none`, `low`, `medium`, `high`, `xhigh`, `max`; `minimal` mitte) võit oleks väike, seega seda katset ei tehtud. Rerank'i kutse aja teeb 17 000 tokeni sisend ja vastus.
  - Otsinguplaan (~2,2 s, 105 arutlustokenit) loeb, kelle koht on nimetatud; selle taset ei vähendata ilma kohtade kataloogideta mõõtmata.
  - **Mõõtmise ulatus** (Codexi järelülevaade 30.09): teenuse etapid algavad pärast pöörde hõivamist (`claim`). Hindaja enda kell (`caller.firstTextMs`) andis soojas jooksus mediaaniks 14,27 s, teenuse märk 14,24 s: enne `claim`-i kulus eval'is umbes 30 ms. Brauseri klõpsust kuvamiseni (HTTP, autentimine, võrk, kuvamine) seda ei mõõda; see tuleb päris vestlusest.
  - Soe protsess lühendas otsingut umbes 0,35 s. Tootmisserver on soe, seega kiiruse mõõtmine käib edaspidi `--warm`-iga.
  - **Kasutamata sisend:** oleku kontekstis oli kõigi 79 omavalitsuse loend (~1730 tokenit), mida olek v4/v5 enam ei kasuta. **Dialoogi prompt 20** saadab mudelile ainult kuupäeva (13 tokenit); loend jääb serveri kontrollideks alles.
    - Mõõtmine aktiveerimata plaanidega (tootmiskood / prompt 20), üks jooks kummalgi: mälu 7/8 / 8/8, piirkond 11/11 / 11/11, faktide elutsükkel 5/6 / 6/6.
    - Tootmiskoodi vead polnud prompt'i omad: üks oli #271 parandatud eelarveviga, teine juhuslik tekstisisene viide, mille tõttu vastus lükati tagasi.
    - Vastuse sisend vähenes pöörde kohta umbes 1700 tokenit (mälukataloogis mediaan 22 370 → 20 989). Aja mõju sellise valimiga ei eristu, sest vastuse arutluse kõikumine on suurem.

### 6. Embedding ja otsing samal ajal, 30.09

- **Päris vestluse pöördes** (Harku sünnitoetus, 30.09) kestis embeddingu kutse 1,6 s ja sõnaline otsing 1,4 s. Teenus ootas enne otsingut terve embeddingu ära: kutse, kulu salvestuse ja vektori kontrolli. Otsingutuum käivitab sõnalise ja vektorikanali juba paralleelselt (Codexi kontroll: [audit](../audits/rag-v2-first-text-timings-2026-09-29.md)).
- **Muudatus** (`pilot/service.js`, `pilot/retrieval.js`):
  - teenus alustab embeddingu partii ja otsingu korraga;
  - otsingu ulatus, kataloog ja sõnaline kanal ei vaja vektorit; vektorikanal ja teenusekataloog ootavad vektori ära;
  - partii jääb üheks (küsimus ja plaani päringud);
  - vektor antakse välja alles pärast kulu salvestamist ja rea kirjutamist, seega rerank'i kirjutused tulevad endiselt pärast embeddingu omi;
  - teenus ootab mõlemad lõpuni: otsingu varajane tõrge ootab embeddingu kulu salvestuse ära, ja embeddingu tõrge (ka õiguste tühistamine selle ajal) on pöörde viga ka siis, kui otsing kukkus selle tõttu.
- **Võit ei ole veel mõõdetud** (Codex: NOT_PROVEN). Ülempiir on embeddingu kutse kestus: selles pöördes ~1,6 s, tavaliselt ~0,5 s, vahemälutabamuse korral 0. Tulemus tuleb päris vestlusest. Etappide kokkuvõttes on `search` nüüd otsingu aeg pärast embeddingu lõppu, ja `plan_to_searched` embeddingu ja otsingu kogukestus.
- **Kontroll:** `tests/rag-v2-pilot-store.test.mjs` (andmebaas) näitab, et otsing algab enne embeddingu lõppu ja saab sama vektori ühest kutsest. Samuti kontrollib see vahemälu, varajast otsingutõrget, embeddingu tõrget ja õiguste tühistamist. Kolm uut testi kukuvad vana koodiga. Ühtse otsingu integratsioonitest päris Postgresi, Qdranti ja EstNLTK-ga: 4/4.

## Järeldus

- Esimese tekstini kulub umbes 8 s ühtlast eeltööd (plaan, embedding, otsing koos rerank'iga) ja 5–20 s vastusemudeli arutlust.
- Suurim hoob on vastuse arutluse tase: `low` lühendab esimese tekstini jõudmist mediaanis umbes 4–5 s ja sabas üle 10 s. Kogu vastus valmib mediaanis 6 s varem.
- `low` ei lahenda isiku ega otsingu ulatuse vigu (Codex). Ka väga kiire vastusemudeli korral jääb umbes 8 s eeltööd.
- Ülejäänud hoovad on väikesed või riskantsed (allpool).

## Ettepanek Codexile ja omanikule

1. **Vastuse arutluse tase: otsustatud, `medium` jääb** (omanik 29.09). Mõõdetud vahetus oli `low` 37/40 ja 6 s kiirem, `medium` 39/40.
   - Enne otsust tasub vastuseid kõrvuti lugeda: mõlema jooksu vastused on serveris `rag-v2-work/eval-files/corpus4-{base,low}-0929/conversation-eval.md`.
   - Vahevariant oleks `low` ainult lihtsamatele pööretele. Keerukuse hindamine enne vastust on aga uus otsus ja uus viga; selle kasuks praegu tõendit pole.
2. **Olekutekst ootamise ajal (ilma mudelimuutuseta). Omaniku otsus 29.09: jääb tegemata; ooteseis jääb vaikseks pöörlevaks S-iks ilma nähtava sildita** (`app/styles/chat.css`, tellija soov 12.07). Praegu näeb kasutaja 8–20 s ainult ooteanimatsiooni. Voos saab saata sammu teate: „Otsin allikaid…“ → „Valin sobivaid lõike…“ → „Koostan vastust…“.
   - Teenus teab juba samme (`reached('planned' | 'embedded' | 'searched')`), rerank'i algus on otsingu konksus.
   - See ei lühenda aega, aga kasutaja näeb, et töö käib. Vajab `delta`/`done` kõrvale uut sündmust ja kolme keele tõlkeid.
3. **Mida mitte teha:**
   - **Prioriteetne teenindus** — soov ei muutnud teenustaset (vt 3).
   - **Rerank'i vahelejätmine selge otsingu korral** säästaks 1–2,5 s. Rerank valib aga seaduse õige redaktsiooni (ADR-042) ja kulutingimused (ADR-046), nii et see oleks kvaliteedirisk.
   - **Plaani ja embeddingu rööbitamine** säästaks kuni umbes 1 s: küsimuse enda vektori saaks arvutada plaani ajal, aga plaani päringud vajavad ikka teist embeddingut. Sõnaline päring kasutab plaani päringuid, nii et otsingut ei saa enne plaani alustada.
4. **Hiljem, eraldi töö:** sõnaline otsing võtab 1,2–2,3 s ühe PostgreSQL-i päringuna. Selle kiirendamine ei muuda tulemusi, aga vajab andmebaasipoolset mõõtmist (ADR-039).

## Kontroll

- Mõõteskriptid lugesid ainult aegu, olekuid ja tokenite arve. Korduskatse saatis salvestatud hindamiskataloogi päringud, mitte kasutaja vestlusi.
- Kulu 29.09 hommikul plaani hinnatabeli järgi: korduskatse umbes 0,04 USD, kaks kataloogijooksu 0,375 USD. Need on hinnangud.
  - Tabel on eelarvelagede jaoks ettevaatlik: sisendi hinnas on vahemällu kirjutamise lisa ja vahemälust loetud sisendi soodustust pole.
  - Tegelik OpenAI kulu oli 27.–29.09 kokku 0,57 USD (API krediidisaldo 7,72 → 7,15 USD, omaniku platvormi vaade).
