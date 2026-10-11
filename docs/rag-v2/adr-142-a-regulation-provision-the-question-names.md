# ADR-142: küsimuses nimetatud valla määruse säte tuuakse otse kohale

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Lähtekoht: [ADR-135](adr-135-a-provision-the-question-names.md) piiride esimene rida („Omavalitsuse määrust nii ei tooda“). Omanik 11.10.2026 selles tööaknas: „sa võid teha tasulise kontrolli ka, kui vaja. mis ei maksa palju“. Seis: **kood ja testid tehtud; mõõdetud tasuta ja tasuliselt (0,0341 USD) serveris veel saatmata koodiga.**

## Probleem

ADR-135 toob küsimuses nimetatud sätte kohale akti struktuuri järgi, aga ainult seaduse või seadustiku oma: akti nimi loetakse pealkirja omastavast käändest (`actGenitive`), ja see tunneb ainult lõppe „seadus“, „seadustik“ ja „koodeks“. Küsimus „Mida ütleb Harku valla sotsiaalhoolekandelise abi andmise korra § 15 lg 3?“ jäi otsingu leida. Otsing leiab sellise lõigu juhuslikult: lõigu tekst algab sageli keset paragrahvi ega sisalda ei numbrit ega määruse nime.

Määrusel ei ole oma nime nagu seadusel. Indeksis on 512 omavalitsuse õigusakti 78 omavalitsuselt (kehtivaid 463; ühel omavalitsusel kuni 19, mediaan 5), ja sama pealkiri kordub omavalitsuseti („Sotsiaalhoolekandelise abi andmise kord“ on paljudel). Määrust nimetatakse selle järgi, kes selle andis ja mis on selle pealkiri.

## Otsus

**Küsimuse rada loeb ka valla või linna määruse sätet.** Kaks asja teevad selle võimalikuks ilma arvamiseta:

1. **Otsinguulatuses on ainult selle omavalitsuse aktid, millest pööre räägib** (kohalugemine, ADR-074). Nii ei pea nimi eristama 78 omavalitsust, vaid ühe omavalitsuse akte omavahel. Ühegi omavalitsuse kehtivate aktide seas ei kordu pealkiri (mõõdetud 11.10.2026, 463 akti).
2. **Akti ütleb pealkiri vahetult paragrahvimärgi ees**, kolmel kujul:
   - jutumärkides: „Harku Vallavolikogu määruse „Sotsiaalhoolekandelise abi andmise kord“ § 15 lg 3“;
   - nii nagu see on: „Sotsiaalhoolekandelise abi andmise kord § 15“;
   - omastavas, kui pealkirja viimane sõna on „kord“, „määrus“ või „eeskiri“ (ka „tingimused ja kord“ → „tingimuste ja korra“): „Harku valla sotsiaalhoolekandelise abi andmise korra § 15 lg 3“. Kehtivatest aktidest lõpeb nii 257 (55%); ülejäänuid („… kehtestamine“, „… piirmäärad“, „… vallas“) loetakse jutumärkides või nii, nagu pealkiri on.

Edasi käib kõik nagu seaduse puhul: paragrahv leitakse akti enda paragrahvide seast, nimetatud lõike lõik sama lugejaga (`provisionChunks`), lisandus kannab põhjust `question_reference` ja võtab ühe nimetatud aktide kahest kohast. Paragrahvimärki ei ole vaja („… korra 15 lg 3“, „… korra paragrahv 15 lõige 3“), nagu ADR-135 teises sammus.

**Teise omavalitsuse nimi peatab lugemise.** Kui sõnad märgi ees nimetavad omavalitsust („Saue valla“, „Maardu Linnavolikogu“), peab see olema akti enda oma. Nii ei too rada Harku korra sätet küsimusele, mis nimetab Saue valda, ka siis, kui ulatus mingil põhjusel Harku juurde jäi. Lause esimest sõna nimeks ei loeta („Kas valla korra § 5 …“).

**Midagi ei tooda**, kui pealkirja ei ole nimetatud (ainult „Harku valla määruse § 5“: omavalitsusel on mitu määrust), kui pealkiri sobib ulatuses kahele aktile (kahe omavalitsuse nimi on sama, näiteks Tartu linn ja Tartu vald, ja sõnad ei ütle, kumb), kui aktil sellist paragrahvi ei ole või kui laaditud allika enda pealkiri ei ole see, mida otsingu read ütlesid. Otsing käib siis nagu enne.

## Miks mitte vastuse kontrolli lugeja

`lib/rag-v2/pilot/provision-check.js` (`namedAct`) loeb, mis aktile vastus viitab, ja teeb seda meelega leebelt: „Harku valla … korra § 5“ sobib seal iga Harku akti lõiguga, sest kontroll ei tohi õiget vastust alusetuks pidada. Küsimuse rada peab valima **ühe** akti ja tooma selle lõigu, nii et sama lugemine oleks siin liiga lai. Ühine on põhimõte (andja ja pealkiri); lugeja on eraldi, failis `lib/rag-v2/search/legal-references.js` (`regulationReferences`, `regulationGenitive`), teiste viitelugejate kõrval. Vastuse kontrolli ei muudetud.

## Mida see ei tohi rikkuda

- Seaduse sätte lugemine (ADR-135) ja lõikude enda viidete rada (ADR-063) töötavad nagu enne; seadus ja määrus samas küsimuses saavad mõlemad koha, nimetamise järjekorras.
- Küsimus, mis sätet ei nimeta, ei muutu üldse: rada ei käivitu.
- Kohad on samad kaks; profiili ega plaani ei muudeta.

## Mõõdetud

Serveris, korpus v79 (indeks `2c886587`), väljalase `2d89443f`; muudetud kood kattekausta kaudu ([ADR-122](adr-122-free-search-gate.md)). Kattekaust erines väljalaskest täpselt kahe faili võrra (`search/retrieval.js`, `search/legal-references.js`).

### Tasuta: otsingukontroll ja tõendite vaatlus

- **Otsingukontroll, 56 küsimust** (33 kindlat kontrollküsimust, 12 vaidlustamise plaani, 11 määruse küsimust), lähteseis salvestatud samal tunnil töötava väljalaskega: **52 sama**, 0 viga, ükski otsustav lõik ei kadunud ega nihkunud. Neli muutunut on määruse küsimused, kus tõenditesse tuli üks lõik juurde ja ükski ei lahkunud. Otsingu aja mediaan 4472 → 4534 ms.
- **Üksteist määruse küsimust** (`tests/evaluation/graph/regulation-provision-1.json`; otsing ilma valiku mudelita, nii et tõendid on otsingu enda järjekorras):

| Mis | Küsimusi | Nimetatud säte tõendites |
|---|---:|---|
| Määruse säte, otsing leidis selle ise | 5 | 5 (rada ei pidanud midagi lisama) |
| Määruse säte, otsing ei leidnud | 4 | 4, toodud koha järgi (Harku § 20, § 44, § 58; Viljandi § 9); ilma muudatuseta 0 |
| Küsimus nimetab Saue valda, otsitakse Harku vallas | 1 | koha järgi ei toodud midagi (nii peabki) |
| Seaduse säte (ADR-135) | 1 | olemas nagu enne |

Kirjaviisid, mis päris andmetel koha järgi tõid: pealkiri omastavas koos vallaga, jutumärkides volikogu järel, ilma paragrahvimärgita („… korra 58 lg 1“), „tingimuste ja korra“.

### Tasuline: kuus küsimust päris vestluse rajal, enne ja pärast (12 pööret, 0,0341 USD)

Abiotsija roll, vaikimisi režiim, iga küsimus üks kord kummagi koodiga. Kõik 12 pööret lõppesid vastusega; ükski ei ebaõnnestunud. Kohalugemine seadis omavalitsuse igal pöördel õigesti.

| Küsimus | Töötav väljalase | Muudetud kood |
|---|---|---|
| Harku korra § 44 lg 2 | õige (valik leidis lõigu ise) | õige |
| harku … korra 58 lg 1 (ilma märgita) | õige | õige |
| Harku Vallavolikogu määruse „…“ § 20 lg 1 | **„Selle sätte teksti pole siin esitatud.“** | **õige**, säte toodud koha järgi |
| Viljandi … tingimuste ja korra § 9 | õige | õige |
| „Elan Harku vallas. Mida ütleb Sotsiaalhoolekandelise abi andmise kord § 31 lg 1?“ | **vastas sotsiaalhoolekande seaduse § 31 lõikega 1** (varjupaigateenus) ja ütles, et korra kohta ei saa kinnitada | **õige** (võlanõustamisteenus), säte toodud koha järgi |
| SHS § 133 lg 5 (kontroll) | õige | õige |

Viiest määruse küsimusest vastas töötav väljalase õigesti kolmele, muudetud kood viiele. Sätete kontroll ([ADR-129](adr-129-luna-names-the-provision.md)) ei leidnud muudetud koodi vastustes ühtegi alusetut sätet.

Üks mudelijooks ei ole tõend vastuse sõnastuse kohta. Tõend on see osa, mida mudel ei otsusta: kas säte jõudis tõenditesse, ja seda näitavad nii tasuta vaatlus kui pöörete kirjed (`question_reference`).

### Ühiktestid

- `tests/rag-v2-legal-references.test.mjs`: seitse kirjaviisi loevad õige akti ja sätte; „tingimuste ja korra“; pealkiri, millel omastavat ei ole, loetakse jutumärkides; kahest pealkirjast pikem; kaheksa juhtu, kus midagi lugeda ei tohi; kaks sama pealkirjaga akti (Tartu linn ja Tartu vald) eristab sõnades nimetatud liik; Tallinn ja sidekriipsuga nimi.
- `tests/rag-v2-graph-experiment.test.mjs`: kuus kirjaviisi toovad lõigu, kus nimetatud lõige on, ka otsingukataloogi rajal; seadus ja määrus samas küsimuses saavad mõlemad koha; viis juhtu, kus midagi tuua ei tohi; profiil ilma nimetatud aktide kohtadeta ei loe.
- Kolm reeglit tehti ükshaaval katki (rada ei loe määrust; teise omavalitsuse nime kaitse on väljas; laaditud allika pealkirja ei kontrollita): iga kord kukkus õige test. Kogu komplekti arv on saadetise kirjelduses.

### Mõõtevahendid serveris

`/home/ubuntu/rag-v2-work/w5/`: `mention-diag.mjs` (tasuta: iga küsimuse kandidaadid, koha järgi toodud sätted ja kõik õiguslõigud tõendites), tasulise kontrolli küsimused ja pöörded kaustas `paid/` (lugeja `read-b.mjs`). Päringuvektorid: `eval-files/regulation-provision-1/vectors.json`.

## Piirid

- Omastavat käänet tehakse ainult kolmest lõpust. Pealkirja, mis lõpeb teisiti, peab kirjutama jutumärkides või täpselt nii, nagu see on.
- Kokku kirjutatud, lühendatud või umbkaudset pealkirja („Harku sotsiaalabi kord“) ei tunta.
- Väikese tähega kirjutatud teise omavalitsuse nime kaitse ei loe („saue valla … korra § 5“); selle juhu peab lahendama kohalugemine, mis sellise küsimuse ulatuse Saue valla peale seab.
- Kaksteist lisa-dokumenti (määruse lisad, JSON) on ilma paragrahvideta; neist ei tooda midagi.
- Määruse numbri järgi („määruse nr 12 § 5“) ei loeta: indeksis ei ole määruse numbrit, ainult Riigi Teataja tunnus.
