# ADR-182: paketi seadusesäte toob kaasa teksti, mis seda sätet nimetab

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 pärast RAG/CAG/KAG võrdlust: „jah, see on hea mõte. lisataust oli ka üks minu soove“. Seis: **ehitatud; tasuta vaatlus serveris tehtud viie jooksuga (vt „Mõõdetud“); midagi ei ostetud.**

## Probleem

[ADR-145](adr-145-a-passage-points-at-the-provision-it-names.md) viib lõigult sättele: kui juhend kirjutab „SHS § 17 lg 2“, tuleb paketti see säte. Vastupidist suunda, sättelt tekstideni, mis seda selgitavad, ei ehitatud. Põhjused olid, et kasu polnud mõõdetud ja arvati, et see nõuab indeksi kuju muutmist.

Tõenduskatse G09 näitas, mida see maksab. Küsimus oli, kas emale makstud üür läheb toimetulekutoetuse arvestusse.

- Paketis oli SHS § 133 lg 5–8.
- Eelnõu seletuskiri ütleb lõike 8 kohta otse, kuidas seda loetakse. Korpuses on see alates v95.
- Seletuskirja lõik ei olnud aga 36 kandidaadi seas. Tema jaotisepealkiri on PDF-ist valesti loetud ja tekst kirjutab toimetulekutoetuse lühendina „TTT“.

Lisaks ilmnes viga, mis puudutab ka ADR-145 rada.

- Sotsiaalhoolekande seaduses on alates 01.10.2026 §-d 13¹–13⁴. PDF ja veebileht ei hoia ülaindeksit, nii et „§ 133“ võib seal olla § 133 või § 13³.
- ADR-145 jätab sellise viite kõrvale (`section_ambiguous`). Nii ei jõudnud ükski PDF ega veebileht toimetulekutoetuse sätetele §§ 131–134.
- Korpuses v95 oli selliseid kõrvale jäetud viiteid 91.

## Otsus

### 1. Lõige eristab kahte paragrahvi (ühine lugeja, mõlemas suunas)

Kui number sobib kahele paragrahvile ja viide nimetab lõikeid, valitakse paragrahv, millel on kõik need lõiked. Kui mõlemal on, jääb viide endiselt lugemata.

Näide: „SHS § 151 lg 2“ PDF-is on § 15¹, kui § 151-l lõiget 2 ei ole. „SHS § 133 lõiget 8“ jääb mitmetähenduslikuks, sest ka §-l 13³ on lõiked 1–10. Midagi ei arvata.

Muudatus on `sectionResolution` ja `relationSection` uues argumendis. Paragrahvi lõiked loeb `sectionSubsections` samamoodi nagu `provisionChunks`. ADR-145 rada ja korpuse loendus (`scripts/rag-v2-provision-relations.mjs`) loevad nüüd sama reegliga.

### 2. Säte toob selgitava lõigu (uus rada)

Rada käib viimasena, pärast valikut ja kõiki teisi lisaradu. Kui pöördes vaba kohta ei ole, jääb ta vahele.

1. Paketi kolmele esimesele seadusesättele, mille koht seaduses on teada ([ADR-123](adr-123-provision-label-for-legal-passages.md)), otsitakse kandidaate.
2. Sõnaindeksist otsitakse lõike tekstidest, mis ei ole õigusaktid: juhendid, seletuskirjad, ametite lehed, artiklid. Lõigus peab olema sätte number ja üks seaduse nimedest (pealkirja esimene sõna või lühend). Kuni 12 lõiku sätte kohta järjestatakse küsimuse ja otsinguvariantide sõnade järgi. Päring on `postgres.naming`; sätete päringud käivad korraga.
3. Iga kandidaadi lähedus küsimusele arvutatakse salvestatud vektoritest, kõik ühe päringuga. Lähedus on koosinus lõigu vektori ja küsimuse lähima vektori vahel, nagu ADR-149-s; midagi ei osteta. Edasi lähevad ainult kandidaadid, mille lähedus on vähemalt 0,55. Pikk seletuskiri nimetab paljusid sätteid ja räägib igaühest oma sõnadega, seetõttu on lävi vajalik.
4. Läbi läinud kandidaatide teksti loeb sama lugeja, mis ADR-145 rajal. Lõik sobib, kui ta nimetab sama seadust ja sätet.
5. Sobib ka number, mis sobib kahele paragrahvile, kui paketi säte on üks neist ja sellel on kõik lõiked, mida lõik nimetab.
6. Tekst, mis on vanem kui seadus, sätet ei nimeta (`dayRefusal`).
7. Ühele sättele tuleb üks lõik ja kokku kuni kaks. Eelistatakse lõiku, mis nimetab mõnda paketi lõigus olevat lõiget, seejärel lähedasemat. Vabu kohti jagatakse läheduse järjekorras. Lõik paigutatakse paketis kohe oma sätte järele.

**Miks rada tohib võtta mitmetähendusliku numbri, kuigi ADR-145 ei tohi.** ADR-145 lisab akti sätte, sest tekst sellele viitab. Kui viide on vale, väidab pakett sätte kohta midagi, mida tekst ei öelnud. See rada lisab teksti ennast, oma sõnadega ja oma allikakaardiga. Seost sättega ta ei väida: lõik tuleb, sest ta nimetab numbrit, mis võib olla see säte, ja vastab küsimuse sõnadele. Kas lõik vastust toetab, otsustab vastuse mudel teksti lugedes nagu iga teise lõigu puhul.

**Kohad ja ruum** on samad mis ADR-149 ja ADR-154 lisaradadel. Rada võtab koha ainult siis, kui lõpppiir jätab selle vabaks, ja tekst kasutab lisaradade tokeniruumi (`expansionContextTokens`). Midagi, mis pööre enne sai, välja ei tõrjuta. Profiili, plaani ja indeksit ei muudeta.

Jälg: valiku põhjus `explaining_passage` (`seed_evidence_id`, `section`, `explains`) ja mõõdik `explaining_passages` (`provisions`, `candidates`, `read`, `additions`, `sections`). Admini vaates on rada nimega „Sätet nimetavad selgitused“.

## Mõõdetud

### Tasuta, kohalik koopia korpusest v95 (enne ehitamist)

- 1843 lõiku tekstides, mis ei ole õigusaktid, nimetab seaduse sätet.
- Ilma täpsustuseta oli lahendamata viiteid nii: 260 numbrit, mida seaduses ei ole; 99 vanemat teksti; 91 mitmetähenduslikku; 55 vahemikku. Lõike järgi täpsustamine lahendas mitmetähenduslikest 35 (91 → 56).
- 21.10 testi 75 küsimusest 68 paketis oli seadusesäte. Neist 60 sättel oli vähemalt üks seda nimetav lõik, täpsustusega 63.

### Tasuta vaatlus serveris (viis jooksu)

Vaatlus käis töötava väljalaskega (`af2a2533`, korpus v95) ja kattekaustas oleva muudetud koodiga. Kattekaust erines väljalaskest ainult muudetud failide poolest. Kasutati graafikataloogide 33 küsimust (`hard-conditions-1…3`, `abbreviation-municipal-1`, G09 nende seas) ja nende salvestatud vektoreid. Valiku mudeli asemel oli konks, mis ei vali midagi. Mudelit ei kutsutud ja vektoreid ei ostetud. Vaatlusvahend ja jooksud on serveris kaustas `/home/ubuntu/rag-v2-work/x182/` (`explain-diag.mjs`, `run1`…`run4` ja viimane jooks kausta juurel).

| Jooks | Muudatus | Lisandusi | Mis selgus |
|---|---|---|---|
| 1 | rada enne ADR-154 hilisemat lugemist, läveta | 16 küsimuses 14 | Küsimusega sobis umbes 6. Seletuskiri tuli sageli seetõttu, et ta nimetab palju sätteid. Kaheksas pöördes tõrjus rada välja hilisema lugemise viite. |
| 2 | sama ja läheduse mõõt (lävi 0) | 16 küsimuses 14 | Sobivad selgitused olid läheduses 0,55–0,61. Teised peale ühe olid 0,35–0,52. |
| 3 | rada kõige lõpus, lävi 0,55, vabad kohad lähedasematele | 4 | Väljatõrjumist ei olnud. Otsing võttis keskmiselt 7,6 s (enne 4,6 s), sest iga kandidaat laaditi. |
| 4 | lähedus enne laadimist, sätted paralleelselt | 4 | Keskmine lisa 0,8 s, mediaanis 1,2 s. |
| 5 | vaba kohata pööre jätab raja vahele | 5 | Rada käis 10 pöördes 33-st, 23-l kohta polnud. Kui rada käis, võttis ta keskmiselt sõnapäring 61 ms, vektorid 21 ms ja lugemine 103 ms. Keskmine otsinguaeg oli 4,97 s → 5,15 s. |

Viienda jooksu lisandused:

- Põlva tugiisiku küsimus: Tugiisikuteenuse juhend SHS § 23 juurde (0,584). Sobib otse.
- Emale makstud üür (G09): SKA KKK vastus kommunaalkulude kohta, mille on tasunud lähedane (0,582), SHS § 133 juurde. Sama sätte taust. Seletuskirja lõik jäi lävest alla (umbes 0,51).
- Üürivõlg ja kodulaen: SKA KKK vastus lapse isalt üüritud korteri kohta SHS § 131 juurde (0,554 ja 0,602). Sama teema taust, mitte küsimuse vastus.
- Hooldekodu omaosaluse puudujääk: komorbiidsuse analüüsi lõik SHS § 73 kohta (0,551).

Kõigis viies jooksus oli otsustav lõik tõendites sama paljudes küsimustes kui töötaval väljalaskel (21–22). Ükski otsustav lõik ei kadunud. Pöörete erinevused väljaspool rada tulid „sama asja ütleva sätte“ rajast (ADR-149), mille lähimate vektorite otsing annab jooksust jooksu veidi erineva tulemuse. Sama juhtus ka kahe töötava väljalaske jooksu vahel.

Lõike järgi täpsustamine muutis ühte küsimust („perekonna määratlus“). ADR-145 rada luges nüüd SHS § 134 ja see võttis teise seaduse koha, kus enne oli HMS § 6.

Mõõdik `explaining_passages` sisaldab: `provisions`, `free`, `candidates`, `near`, `read`, `additions`, `sections`, iga kandidaadi läheduse (`scores`) ja etappide aja (`ms`: `naming`, `vectors`, `read`).

### Päris pöörded pärast väljalaset (88ae8650, 23.10.2026)

Pöörduja vaates, uues vestluses:

- **„Elame Põlva vallas ja mu lapsel on raske puue. Kas tema tugiisikuks võib olla lapse vanaema?“** (jälg `9b56d2f2`)
  - Rada käis SHS § 25 juures. Kandidaate oli 12, lävest üle sai 1 (0,581), aga see lõik § 25 ei nimetanud ja lisandust ei tulnud.
  - Aeg: sõnapäring 40 ms, vektorid 11 ms, lugemine 48 ms.
  - Vastus oli õige: vanaema on teise astme sugulane ega tohi tugiisikuteenust osutada (SHS § 25).
- **„Mul on kahe eelmise kuu kommunaalmaksed maksmata. Kas toimetulekutoetuse arvestamisel võetakse see võlg eluasemekuluna arvesse?“** (jälg `4c514caa`)
  - Rada lisas SKA toimetulekutoetuse KKK lõigu SHS § 131 juurde (0,555).
  - Lugemine võttis 1011 ms, sest laaditi suur KKK leht (sõnapäring 50 ms, vektorid 17 ms).
  - Vastus oli õige ja lisatud lõigule ei viidanud.

## Piirid

- **Suure dokumendi lugemine:** kui läbi saanud kandidaat on pika lehe lõik, võtab lehe laadimine kuni umbes 1 s. Seda juhtub pöördes, kus rada leiab läbi saanud kandidaadi, ja sama leht oleks tulnud laadida ka lisamiseks.

- **Täpsus on mõõdukas.** Viiest lisandusest üks vastas küsimusele otse. Ülejäänud olid sama sätte taust, mille vastus võib jätta kasutamata.
- **G09 seletuskirja lõik ei jõua paketti ka selle rajaga.** Pikk lõik, mis räägib nii üürist kui ka laenumaksetest, jääb küsimusele lävest kaugemale (umbes 0,51). G09 vastus on õige [ADR-181](adr-181-a-reference-to-a-point-reads-the-point.md) lugemisreegli tõttu.
- **Sõnaindeks leiab lõigu ainult siis, kui number seisab tekstis sõnana:** „133“, „15¹“ või „151“. Kui PDF on numbri tükeldanud („13 3“), jääb lõik leidmata.
- **Seletuskirja vale jaotisepealkiri (PDF-lugeja) jääb alles.**
- **Kas vastus läheb paremaks, näitab ainult tasuline vastusekontroll.**

## Tagasivõtmine

Muudatuse tagasipööramine taastab senise lugemise ja eemaldab raja. Indeksit, plaani, profiili ega andmeid ei muudetud.
