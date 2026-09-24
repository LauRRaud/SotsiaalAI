# SotsiaalAI – uute allikate lisakorje raport

**Kuupäev:** 2026-07-15  
**Alus:** master_sources_final.json (323 unikaalset allikat)  
**Väljund:** master_sources_lisakorje_candidates.json  
**Staatus:** VALMIS inimese ülevaatuseks. 38 kontrollitud kandidaati. Ingest'i pole käivitatud, master-listi (master_sources_final.json) pole muudetud.

> See raport genereeritakse automaatselt kandidaadifailist; narratiivsed osad on käsitsi koostatud.

## 1. Otsingu ulatus ja meetod

Eesmärk oli leida usaldusväärseid sotsiaalvaldkonna allikaid, mida 323-allikalises master-listis (`master_sources_final.json`) veel ei ole. Meetod samm-sammult:

1. **Aluse läbilugemine.** Loeti kogu olemasolev alus: README, agendireeglid, valideerimisraport, meta, andmekorje-selgitus ja organisatsiooni korjeülesanne.
2. **Dubleerimise indeks.** Master-listist ekstraheeriti kõik `normalized_url` variandid (396), domeenid (105), pealkirjad, `topic_tags` ja `publisher`-väljad. Nende põhjal kaardistati kaetud alad (puudespetsiifilised organisatsioonid, lapsed ja pered, abivahendid, Peaasi/vaimne tervis, ohvriabi/MARAC, SKA/SM/Terviseameti temaatilised juhendid, uuringud) ja tühimikud võrreldes ülesande 15 teemaga.
3. **Sihitud veebiotsing tühimike kaupa.** Tehti päris veebiotsingud eelistades esmaseid, ametlikke ja metoodiliselt autoriteetseid allikaid (kutseühendused, eetika, supervisioon, omastehooldus, sõltuvused/kahjude vähendamine, kodutus, võlanõustamine, KOV teenusejuhendid, tööheaolu, poliitikadokumendid).
4. **Iga kandidaadi kontroll.** Avati päris URL (`web_fetch`), kontrolliti et leht töötab, tuvastati kanooniline URL, pealkiri, väljaandja, dokumendiliik ja võimalusel avaldamise/uuendamise kuupäev. Eristati veebileht, PDF, juhend, register ja teemaportaal.
5. **Dubleerimise kontroll.** Iga kandidaati kontrolliti master-listi vastu nii domeeni/URL-i kui ka sisulise pealkirja järgi Python-päringutega `master_sources_final.json` peal.
6. **Ebakindlate märkimine.** Kandidaadid, mille sisu või kehtivust ei õnnestunud kindlalt kontrollida, on märgitud `needs_manual_review=true` ja notes-väljal `NEEDS_VERIFICATION`.

**Piirangud, mida järgiti:** ei muudetud rakenduskoodi, andmebaasi ega master-listi (`master_sources_final.json`). Ingest'i, migratsiooni ega deploy'd ei käivitatud. Master-listi PDF-i linke ei kopeeritud „uute allikatena". Üldist KOV-kontaktide korjet ei korratud – KOV-teemal lisati ainult laiemalt taaskasutatavaid riiklikke metoodilisi juhendeid.

**Tehnilised märkused kontrollist:** mõned suured lehed (tai.ee, SKA PDF-id) ületasid tööriista mahupiiri – nende puhul kontrolliti URL-i toimimist ja kanoonilisust, kuid PDF-i täisteksti eraldi läbi ei loetud (märgitud notes-väljal). SKA KOV-teenusejuhendid verifitseeriti SKA enda ametlikult koondlehelt „Kohalike omavalitsuste nõustamine", kus iga dokument on elav allalaadimislink koos faili suuruse ja kuupäevaga.

## 2. Kontrollitud organisatsioonid ja teemad

Kontrollitud organisatsioonid ja teemad (kõik allolevad on master-listist puudunud, kui pole märgitud teisiti):

**Kutse- ja erialaorganisatsioonid ning eetika (topics 8–11):**
- Eesti Sotsiaaltöö Assotsiatsioon (ESTA, eswa.ee) – kutseandja ja eetikakomitee;
- Sotsiaalvaldkonna töötaja eetikakoodeks (2022) ja IASSW eetikapõhimõtted;
- Eesti Supervisiooni ja Coachingu Ühing (ESCÜ, supervisioon.ee);
- Kutseregister (kutseregister.ee) – võlanõustaja jt sotsiaalvaldkonna kutsestandardid.

**Eakad, hoolduskoormus, omastehooldus (topic 3):**
- omastehooldusest.ee (Omastehoolduse infopunkt), omastehooldus.eu (Eesti Koduabi Selts);
- SM elanikkonna hoolduskoormuse uuring 2022; SKA hoolduskoormuse hindamise juhis, täisealise isiku hoolduse juhend.

**Sõltuvused ja kahjude vähendamine (topic 7):**
- narko.ee (TAI uimastiportaal) ja selle sisulehed.

**Kodutus, võlanõustamine, toimetulek (topic 6):**
- Eesti Võlanõustajate Liit (evnl.ee); SKA võlanõustamisteenuse juhend, võlgade aegumise juhis, varjupaigateenuse ja eluruumi tagamise teenuse juhendid.

**KOV sotsiaalteenuste metoodika (topics 1, 11, 14):**
- SKA „Kohalike omavalitsuste nõustamine" teenusejuhendite seeria (üldjuhend, abivajaduse hindamine, koduteenus, üldhooldus, tugiisik, isiklik abistaja, sotsiaaltransport, haldusakti vormistamine jt).

**Tööheaolu ja läbipõlemine (topic 8):**
- tooelu.ee (Tööinspektsioon) – tööstress ja läbipõlemine, psühhosotsiaalsed ohutegurid, vaimse tervise esmaabikapp.

**Poliitika ja statistika (topic 15):**
- SM Heaolu arengukava 2023–2030 ja Sotsiaalhoolekande programm 2025–2028.

Master-listis juba tugevalt kaetud ja seetõttu täiendamata jäetud teemad: laste heaolu/lastekaitse (topic 2), abivahendid ja puudespetsiifilised organisatsioonid (topic 4), vaimse tervise ja ohvriabi põhitaristu (topic 5, Peaasi/MARAC/naiste tugikeskus), andmekaitse üldjuhend (AKI, topic 13).

## 3. Uute kandidaatide koguarv ja jaotus

- **Kandidaate kokku:** 38
- **Prioriteet:** HIGH = 12, MEDIUM = 25, LOW = 1
- **Autoriteet:** PRIMARY_OFFICIAL = 26, PROFESSIONAL_AUTHORITY = 9, TRUSTED_NGO = 3
- **Ingest-soovitus:** AUTO_CANDIDATE = 23, HUMAN_REVIEW_REQUIRED = 11, REFERENCE_ONLY = 4
- **Formaat:** pdf = 20, html = 18

## 4. Kõige väärtuslikumad uued allikad (prioriteedi järjekorras)

| # | Allikas | Tüüp | Prioriteet | Ingest-soovitus | Täidetud tühimik |
|---|---------|------|-----------|-----------------|------------------|
| 1 | [Eesti Sotsiaaltöö Assotsiatsioon (ESTA)](https://www.eswa.ee/) | organization_profile | HIGH | HUMAN_REVIEW_REQUIRED | Eesti keskne sotsiaaltöö kutseühendus ja kutseandja – täiesti puudus master-listist (topic |
| 2 | [Eesti Võlanõustajate Liit (EVNL)](https://evnl.ee/) | organization_profile | HIGH | HUMAN_REVIEW_REQUIRED | Võlanõustamine ja toimetulekuraskused (topic 6) – täiesti puudus master-listist |
| 3 | [Narko.ee – TAI uimasti- ja sõltuvusteemaline portaal](https://www.narko.ee/) | topic_hub | HIGH | HUMAN_REVIEW_REQUIRED | Sõltuvused ja kahjude vähendamine (topic 7) – täiesti puudus master-listist |
| 4 | [Omastehoolduse infopunkt (omastehooldusest.ee)](https://omastehooldusest.ee/) | topic_hub | HIGH | HUMAN_REVIEW_REQUIRED | Eakad, hoolduskoormus ja omastehooldus (topic 3) – suur tühimik master-listis |
| 5 | [Eluruumi tagamise teenuse juhend (15.04.2024)](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-04/Eluruumi%20tagamise%20teenuse%20juhend%2015.04.2024.pdf) | official_guideline | HIGH | AUTO_CANDIDATE | Eluaseme tagamine ja kodutuse ennetus (topic 6) |
| 6 | [Täisealise abi- ja toetusvajaduse hindamise juhend 2025](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-01/T%C3%A4isealise%20abi-%20ja%20toetusvajaduse%20hindamise%20juhend%202025.pdf) | official_guideline | HIGH | AUTO_CANDIDATE | Abivajaduse hindamine ja juhtumikorraldus (topic 11) – ajakohane 2025 juhend puudus |
| 7 | [Üldjuhend KOV sotsiaalteenuse korraldamiseks ametnikule](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-01/%C3%9Cldjuhend_31.01.pdf) | official_guideline | HIGH | AUTO_CANDIDATE | Sotsiaalhoolekanne ja KOV ülesanded (topics 1, 11) – SKA metoodiline üldjuhend puudus mast |
| 8 | [Varjupaigateenuse juhend (07.01.2026)](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-01/Varjupaigateenuse%20juhend_07.01.2026.pdf) | official_guideline | HIGH | AUTO_CANDIDATE | Kodutus ja varjupaigateenus (topic 6) – oluline tühimik master-listis |
| 9 | [Võlanõustamisteenuse juhend (2023)](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/V%C3%B5lan%C3%B5ustamisteenuse%20juhend_2023.pdf) | official_guideline | HIGH | AUTO_CANDIDATE | Võlanõustamisteenus KOV vaates (topic 6) |
| 10 | [Heaolu arengukava 2023–2030 (põhitekst)](https://www.sm.ee/heaolu-arengukava-2023-2030) | policy_analysis | HIGH | AUTO_CANDIDATE | Keskne sotsiaalvaldkonna poliitikadokument (topic 15) – puudus master-listist |
| 11 | [Sotsiaalvaldkonna töötaja eetikakoodeks (2022)](https://www.tai.ee/et/sotsiaaltoo/sotsiaalvaldkonna-tootaja-eetikakoodeks) | official_guideline | HIGH | AUTO_CANDIDATE | Sotsiaaltöö kutse-eetika alusdokument – eetika/hea praktika (topic 10), professionaalsed p |
| 12 | [Tööelu.ee – Tööstress ja läbipõlemine](https://www.tooelu.ee/et/68/toostress-ja-labipolemine) | information_material | HIGH | HUMAN_REVIEW_REQUIRED | Tööheaolu ja läbipõlemine (topic 8) – puudus master-listist |
| 13 | [Eesti Omastehooldus / MTÜ Eesti Koduabi Selts (omastehooldus.eu)](https://www.omastehooldus.eu/) | organization_profile | MEDIUM | HUMAN_REVIEW_REQUIRED | Omastehoolduse käsiraamatud ja juriidiline taust (topic 3) |
| 14 | [Eetikapõhimõtted sotsiaaltöös (IASSW 2018)](https://www.tai.ee/et/sotsiaaltoo/eetikapohimotted-sotsiaaltoos) | methodology_material | MEDIUM | AUTO_CANDIDATE | Rahvusvaheline sotsiaaltöö eetika alus, millele Eesti eetikakoodeks tugineb (topic 10) |
| 15 | [Eetikapõhimõtted sotsiaaltöös (IASSW 2018) – PDF](https://www.eswa.ee/wp-content/uploads/2020/02/Eetikapohimotted_sotsiaaltoos_IASSW_2018.pdf) | methodology_material | MEDIUM | AUTO_CANDIDATE | Sama, mis HTML-versioon; PDF sobib otse knowledge-doc chunk-ingestiks |
| 16 | [Supervisioonist – Eesti Supervisiooni ja Coachingu Ühing (ESCÜ)](https://supervisioon.ee/supervisioonist/) | information_material | MEDIUM | HUMAN_REVIEW_REQUIRED | Supervisioon/kovisioon ja professionaalne refleksioon – täiesti puudus (topic 9); toetab k |
| 17 | [ESTA eetikakäsiraamat](https://www.eswa.ee/eetikakasiraamat/) | methodology_material | MEDIUM | HUMAN_REVIEW_REQUIRED | Eetiliste dilemmade praktiline käsiraamat (topic 10) – kui valminud |
| 18 | [ESTA kutse andmine (sotsiaaltöötaja, sotsiaalhooldus, lapsehoid, võlanõustaja)](https://www.eswa.ee/kutse-andmine/) | web_page | MEDIUM | REFERENCE_ONLY | Kutseandmise ja kvalifikatsiooni info; ühtlasi ainus selge viide võlanõustaja kutsele (top |
| 19 | [Kutseregister – kutseala 'Sotsiaaltöö ja nõustamine' (kutsestandardite koondvaade)](https://www.kutseregister.ee/ctrl/et/Standardid_Klassifikaatorid/showAvatuna/10521659) | registry | MEDIUM | REFERENCE_ONLY | Ametlik koondallikas kõigile sotsiaalvaldkonna kutsestandarditele (topics 8, 10, 11) |
| 20 | [Kutsestandard: Võlanõustaja, tase 6 (kehtiv versioon)](https://www.kutseregister.ee/ctrl/et/Standardid/vaata/11025414) | official_guideline | MEDIUM | HUMAN_REVIEW_REQUIRED | Võlanõustaja kompetentsinõuded ja hea praktika (topics 6, 8, 11); sisaldab refleksiooni, k |

## 5. Võimalikud duplikaadid ja sisemised dublaadid

**Sisemine dublaat kandidaatide seas:**
- „Eetikapõhimõtted sotsiaaltöös (IASSW 2018)" on lisatud nii HTML- (tai.ee) kui ka PDF-versioonina (eswa.ee) – RAG-i võtta ainult üks.
- SKA võlanõustamise teemat katab kaks vaadet (EVNL erialaühing + SKA võlanõustamisteenuse juhend) – need täiendavad teineteist, ei ole dublaadid.

**Master-listi suhtes (kontrollitud URL-i domeeni ja pealkirja järgi):**
- eswa.ee, supervisioon.ee, narko.ee, evnl.ee, kutseregister.ee, omastehooldus(est).ee ja tooelu.ee domeene master-listis EI ESINE.
- Master-listis on TAI ajakirja Sotsiaaltöö numbreid ja üksikuid tai.ee/sotsiaaltoo artikleid, kuid eetikakoodeksi/eetikapõhimõtete dokumente EI OLE.
- SKA juhendite osas: master-listis on temaatilised juhendid (hoolekandeteenuste kvaliteet, sotsiaalne rehabilitatsioon, lapse heaolu, MARAC, naiste tugikeskus), kuid KOV teenuste metoodilised juhendid (koduteenus, tugiisik, isiklik abistaja, varjupaik, eluruum, võlanõustamisteenus, sotsiaaltransport, üldjuhend, abivajaduse hindamine) PUUDUVAD.
- Hoolduskoormuse osas on master-listis ainult 2009. a raport – 2022. a uuring on uus.
- Kontrollhoiatus: „üldjuhend" annab master-listis vaste, kuid see on AKI „Isikuandmete töötleja üldjuhend", MITTE SKA KOV üldjuhend; „toimepidevus" vaste on Terviseameti infektsioonikontrolli materjal, MITTE SKA sotsiaalteenuste toimepidevus. Seega mõlemad SKA allikad on tegelikult uued.

## 6. Katkised, kahtlased või tagasi lükatud allikad

| Allikas | URL | Põhjus |
|---------|-----|--------|
| Kutsestandard: Võlanõustaja, tase 6 (versioon 2) | https://www.kutseregister.ee/ctrl/et/Standardid/vaata/10665188 | KEHTIVUSE KAOTANUD (kehtis 03.11.2017–03.05.2022). Asendatud versiooniga 3 (vaata/11025414), mis on lisatud kandidaadiks. Ära ingesti aegunud versiooni. |
| ESTA eetikakäsiraamat | https://www.eswa.ee/eetikakasiraamat/ | NEEDS_VERIFICATION – leht indekseeritud, kuid web_fetch tagastas tühja sisu; 2023. a andmeil oli käsiraamat alles koostamisel. Hoitud kandidaadina, kuid enne ingesti kontrollida terviktekst. Ära märgi ingest_ready. |
| omastehooldus.eu käsiraamatud (2007–2012) | https://www.omastehooldus.eu/abiks-omastehooldajale | Osa PDF-käsiraamatuid on vanad (2007–2012) ja mõned välislingid (kuivaks.ee, vana sm.ee failitee) katkised/aegunud. Organisatsioon lisatud, kuid üksikmaterjalide kehtivus vajab inimese kontrolli enne ingesti. |
| Lihtne/selge keele autoriteetne juhend | (ei leitud kindlat allikat) | Topic 12 – ühte selget, kontrollitud eestikeelset lihtsa/selge keele juhendit (nt EKI selge keel) selle korje käigus lõplikult ei verifitseeritud. Vt raporti punkt 7. |

## 7. Teemad, kus usaldusväärseid Eesti allikaid oli raske leida

Teemad, kus usaldusväärset, kontrollitud eestikeelset allikat oli raske leida või kus katvus jäi õhukeseks:

1. **Lihtne/selge keel (topic 12).** Selge keele valdkond on Eestis olemas (Eesti Keele Instituut, Arusaamise Agentuur, EPIKoja lihtsa keele päev), kuid ühte selget, autoriteetset ja kontrollitud juhenddokumenti selle korje käigus lõplikult ei verifitseeritud. Soovitus: eraldi sihtotsing EKI selge/lihtsa keele materjalidele. Osaliselt katab teemat omastehooldusest.ee „suhtlemissoovitused" ja master-listi kompetentsikeskuse ligipääsetavuse lehed.
2. **Kovisioon eraldi riikliku metoodikana (topic 9).** Supervisioon/kovisioon tuleneb peamiselt ESCÜ-st (erialaühing) ja kutsestandardite nõuetest; eraldi riiklikku kovisiooni juhendit ei leitud. See on pigem erialaselt kaetud kui riiklikult dokumenteeritud.
3. **Omastehoolduse metoodika (topic 3)** on suures osas MTÜ-põhine (omastehooldusest.ee), mitte riiklik juhend – seetõttu soovitatav inimese sisuline ülevaatus enne ingesti.
4. **Andmekaitse sotsiaaltöö-spetsiifiliselt (topic 13)** on kaetud üldiselt (AKI üldjuhend master-listis + eetikakoodeksi konfidentsiaalsuse peatükk + SKA haldusakti vormistamise juhend), kuid eraldi „sotsiaalvaldkonna dokumenteerimise ja nõusoleku" käsiraamatut ei leitud.

## 8. Soovitus: esimene inimese kinnitatav korjepakk

Soovitatav ESIMENE inimese kinnitatav korjepakk (kõrgeim väärtus, hästi kontrollitud, esmased/professionaalsed allikad; katab õigused, teenused, professionaalse otsustamise ja poliitikaraami):

1. **Sotsiaalvaldkonna töötaja eetikakoodeks (2022)** – terviktekst avalik, professionaalne alusdokument (topics 8, 10, 13).
2. **Eesti Sotsiaaltöö Assotsiatsioon (ESTA)** – organisatsioonipakett (4 tuumfaili); keskne kutseühendus ja kutseandja.
3. **SKA „Üldjuhend KOV sotsiaalteenuse korraldamiseks"** + **Täisealise abi- ja toetusvajaduse hindamise juhend 2025** – juhtumikorralduse tuum (topics 1, 11).
4. **Eesti Võlanõustajate Liit** + **SKA võlanõustamisteenuse juhend** – võlanõustamine (topic 6).
5. **SKA varjupaigateenuse ja eluruumi tagamise teenuse juhendid** – kodutus ja eluase (topic 6).
6. **omastehooldusest.ee** (teemaportaal, alamlehed) – eakad ja omastehooldus (topic 3).
7. **narko.ee** (teemaportaal, alamlehed) – sõltuvused ja kahjude vähendamine (topic 7).
8. **SM Heaolu arengukava 2023–2030** – poliitikaraam (topic 15).
9. **SM elanikkonna hoolduskoormuse uuring 2022** – ajakohane seireandmestik (topics 3, 15).
10. **tooelu.ee „Tööstress ja läbipõlemine"** – sotsiaaltöötaja tööheaolu (topic 8).

Kõik ülejäänud SKA teenusejuhendid (koduteenus, üldhooldus, tugiisik, isiklik abistaja, sotsiaaltransport, turvakodu, haldusakti vormistamine, hoolduskoormuse hindamine) sobivad teise pakki – need on ühtne, hästi verifitseeritud PDF-komplekt, mille saab ingestida knowledge-doc konveieriga korraga.

## 9. Jätkamispunkt ja lahtised küsimused tooteomanikule

**Jätkamispunkt.** Valmis on 38 kontrollitud kandidaadist koosnev pakett (12 HIGH, 25 MEDIUM, 1 LOW), kirjas failis `master_sources_lisakorje_candidates.json`. Kõik on veebiotsinguga leitud, URL avatud, kanooniline URL tuvastatud ja master-listi suhtes dubleerimine kontrollitud. Ükski master-listi kirje pole muudetud; ingest'i ei ole käivitatud.

**Lahtised küsimused tooteomanikule enne ingest'i:**
1. **Eetikakoodeks** – ingestida üksik-HTML knowledge-docina või ESTA organisatsioonipaketi osana?
2. **IASSW „Eetikapõhimõtted sotsiaaltöös"** – kumb võtta kanooniliseks: HTML (tai.ee) või PDF (eswa.ee)? (Dubleerimise vältimiseks üks.)
3. **Ajakiri Sotsiaaltöö** kolis 2026 TAI alt Sotsiaalkindlustusameti alla – kas master-listi olemasolevad TAI ajakirja-URL-id vajavad ümbersuunamist SKA aadressile? (Mõjutab olemasolevat kihti, mitte käesolevat korjet.)
4. **Kutsestandardid** uuenevad perioodiliselt – kas ingestida konkreetne versioon (nt võlanõustaja tase 6 versioon 3) või viidata kutseregistri koondlehele? Versioon 2 on aegunud (vt tagasi lükatud).
5. **SKA teenusejuhendid** uuenevad sageli (2024–2026) – kas seada `ska_kov_noustamine_hub` regulaarsele seirele ja millise sagedusega, et kehtivad versioonid RAG-is püsiksid?
6. **omastehooldus.eu** vanad käsiraamatud (2007–2012) – ingestida valikuliselt või jätta ainult viitena?
7. **tooelu.ee** on Tööinspektsiooni portaal (tööõigus/-tervis) – kas piirduda sotsiaaltöötaja tööheaolu vaatega (tööstress, läbipõlemine, esmaabikapp) või mitte kaasata laiemat tööõiguse sisu?
8. **Lihtne/selge keel (topic 12)** – kas tellida eraldi sihtotsing EKI selge keele materjalidele, mida see korje ei jõudnud lõpuni verifitseerida?

**Soovitus:** alusta esimese pakiga (10 allikat ülal), mis on kõige selgemalt kontrollitud ja mõjutab otseselt inimeste õigusi, teenustele jõudmist ja professionaalset otsustamist. SKA teenusejuhendite komplekt liigub teise pakki koos versiooni-seire kokkuleppega.
