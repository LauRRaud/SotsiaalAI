# Kahe inimese vestlus üle kaheksa sõnumi piiri — üks jooks 03.10.2026

Teostus Claude Opus 5.5. Omanik 03.10: „tee üks kahe inimese vestluse kontroll üle kaheksa sõnumi piiri, kulupiiriga 0,06 USD. Pane stsenaarium ja oodatud asjaolud enne kirja … Kordusjookse ega uut arendust selles ülesandes ei tee.“ Taust: [ADR-070](../rag-v2/adr-070-full-topic-hands-over.md) mõõtis üleandmist ühe inimesega; Codex märkis #313 ja #314 ülevaatuses kahe inimese vestluse kontrollimata jäänuks.

**Tulemus:**

- **Inimesed ja nende asjaolud ei segunenud.** Pärast piiri on salvestatud olekus ema pension 700 eurot (600 asendatud) ja isa pension 450 eurot; kumbki on oma inimese ja oma valla juures.
- **Kõik kirja pandud kontrollid läbisid:** üheksa pööret, 62 kontrolli, 0 viga.
- **Leid, mida kontrollid ei püüdnud:** üheksas vastus vastas uuesti kaheksandale küsimusele, mis käis isa kohta, ja sidus selle emaga. Summad on vastuses õiged, aga vastus on segane (jaotis 4).
- **Kulu 0,0559 USD** plaani hindade järgi (piir 0,06). Üks jooks, kordust ei tehtud.

See on üks vaatlus. Kas leid kordub ja kas selle põhjus on teemapiir, ei ole mõõdetud.

## 1. Mis pandi enne kirja

Kataloog `tests/evaluation/dialogue/scenarios-two-people-boundary-1.json` (blob `6340eaa5`) ühendati [#324](https://github.com/LauRRaud/SotsiaalAI/pull/324)-ga kell 13:46; jooks algas kell 13:54 samast juurutatud koodist (`038cb3d2`), sama blob'iga.

| # | Sõnum | Kelle kohta |
|---:|---|---|
| 1 | Tere | tervitus |
| 2 | Minu ema elab Kose vallas ja tema pension on 600 eurot. Ta ei saa enam üksi kodus hakkama. | ema |
| 3 | Milliseid teenuseid vald talle pakkuda saab? | ema |
| 4 | Minu isa elab Harku vallas ja tema pension on 450 eurot. Tal on võlad ja ta ei tule rahaga toime. | isa |
| 5 | Kuhu ta saab oma vallas pöörduda? | isa |
| 6 | Tagasi ema juurde: kas ta peab hooldekodu koha eest ise maksma? | ema |
| 7 | Ja kas isa võib taotleda toimetulekutoetust? | isa |
| 8 | Kui kiiresti vald tema taotluse üle otsustab? | isa |
| 9 | Vabandust, ema pension on hoopis 700 eurot. | ema, pärast piiri |

- Teema mahutab kaheksa sõnumit; üheksas saadetakse tavalise jätkuna ja alustab jätkuteemat.
- Esimene sõnum on tervitus, sest see on teema tavaline pööre ja maksab umbes 0,001 USD. Nii mahtus piiri ületamine kulupiiri sisse. Kümnendaks sõnumiks ruumi ei jäänud.

**Oodatud pärast piiri:**

- ema: 700 eurot kehtiv, 600 asendatud, Kose vald;
- isa: 450 eurot kehtiv ja tema oma, Harku vald;
- ühegi inimese asjaolu ei kanna teise summat; mudeli uus olek on vastu võetud; otsing kasutab ema valda;
- vastus nimetab 700 eurot, ei küsi uuesti, kus ema elab, ega anna 700 eurot isa pensioniks.

## 2. Mis juhtus

| # | Otsingu vald | Kelle vajadus (otsinguplaan) | Kontrollid | Kulu, USD | Aeg, s |
|---:|---|---|---|---:|---:|
| 1 | — | — (tervituse rada) | läbis | 0,0010 | 6 |
| 2 | Kose | ema | läbis | 0,0077 | 28 |
| 3 | Kose | ema | läbis | 0,0065 | 20 |
| 4 | Harku | isa | läbis | 0,0063 | 21 |
| 5 | Harku | isa | läbis | 0,0058 | 12 |
| 6 | Kose | ema | läbis | 0,0074 | 26 |
| 7 | Harku | isa | läbis | 0,0073 | 17 |
| 8 | Harku | isa | läbis | 0,0070 | 15 |
| 9 | Kose | ema | läbis | 0,0068 | 22 |

- **Fookus vahetus iga kord õigesti:** otsing kasutas selle inimese valda, kelle kohta sõnum käis, neli vahetust järjest.
- **Asjaolud püsisid inimeste küljes.** Neljandast sõnumist alates on olekus ema kolm asjaolu (Kose vald, 600 eurot, ei saa üksi hakkama) ja isa neli (Harku vald, 450 eurot, võlad, ei tule rahaga toime). Ükski asjaolu ei jäänud kirja panemata ja ühtegi mudeli olekut ei lükatud tagasi.
- Enne piiri ei nimetanud ükski vastus teise vanema valda ega teise pensioni summat (sõnumid 2–8, loetud hindaja täisraportist).

## 3. Piiri ületamine

Üheksas sõnum saadeti tavalise jätkuna ja võeti vastu uue teemana, sest eelmine oli täis. Uus teema sai kaasa:

1. **Varasemad väited**, iga rida oma inimese nimega:

   > isa: Minu isa elab Harku vallas ja tema pension on 450 eurot
   > ema: Minu ema elab Kose vallas ja tema pension on 600 eurot
   > ema: tema pension on 600 eurot.
   > ema: Ta ei saa enam üksi kodus hakkama.
   > isa: tema pension on 450 eurot.
   > isa: Tal on võlad
   > isa: ta ei tule rahaga toime.

2. **Eelmise teema viimase sõnumi:** „Kui kiiresti vald tema taotluse üle otsustab?“
3. Eelmise teema oleku ja viimase vastuse.

**Olek pärast üheksandat sõnumit:**

| Asjaolu | Inimene | Seis |
|---|---|---|
| Minu ema elab Kose vallas | ema | kehtiv |
| tema pension on 600 eurot. | ema | **asendatud** |
| Ta ei saa enam üksi kodus hakkama. | ema | kehtiv |
| Minu isa elab Harku vallas | isa | kehtiv |
| tema pension on 450 eurot. | isa | kehtiv |
| Tal on võlad | isa | kehtiv |
| ta ei tule rahaga toime. | isa | kehtiv |
| ema pension on hoopis 700 eurot. | ema | **kehtiv, uus** |

- Ema on Kose vallas, isa Harku vallas; fookus läks emale.
- Midagi ei jäetud välja; olek võeti vastu.
- Kõik üheksanda pöörde 18 kontrolli läbisid.

## 4. Üheksas vastus

> Kui mõtled ema Kose valla taotlust, teeb vald teenuse või toetuse määramise või määramata jätmise otsuse kümne tööpäeva jooksul alates vajaliku viimase dokumendi saamisest või dokumendi esitamise tähtpäevast. [S1]
>
> Isa Harku valla taotluse puhul ei saa ma siin kinnitada varem nimetatud viie tööpäeva tähtaega.
>
> Arvestan parandusega: ema pension on 700 eurot. Kas küsid ema Kose valla või isa Harku valla taotluse otsustamise aega?

**Mis on õige:**

- parandus on arvesse võetud ja summa on õige;
- vastus ei küsi, kus ema elab, ega anna kummalegi teise summat;
- isa ja ema on vastuses eraldi, kumbki oma vallaga.

**Mis on nõrk:**

- **Vastus vastab uuesti kaheksandale küsimusele ja seob selle emaga.** Kasutaja ainult parandas summat. Kaheksas küsimus („Kui kiiresti vald tema taotluse üle otsustab?“) käis isa toimetulekutoetuse kohta ja sai vastuse. Üheksandas pöördes kirjutas otsinguplaan päringud ema Kose valla koduteenuse taotluse tähtaja kohta ja vastus algab sellega.
- **Varem antud vastus isa kohta seatakse kahtluse alla.** Kaheksas vastus andis isa taotlusele viis tööpäeva, viitega seadusele. Üheksandas pöördes oli otsing ema vallas, kaheksanda vastuse allikat (sotsiaalhoolekande seadus) selle pöörde tõendites ei olnud, ja vastus ütleb, et ei saa seda tähtaega kinnitada.
- **Paranduse kinnitus on viimases lõigus.** Juhise järgi peab see olema vastuse esimene lause.
- **Vastus lõpeb täpsustava küsimusega**, kumma taotlust kasutaja mõtleb. Vastuse liik on „osaline“.

**Tõenäoline põhjus (koodi ja salvestatud pöörde lugemise järgi, mitte katsega kinnitatud):** eelmise teema viimane sõnum antakse jätkuteemale edasi sõna-sõnalt, kui „see, millele uus küsimus võib viidata“. Sõna „tema“ selles käis vanas teemas isa kohta, sest fookus oli isal. Uus sõnum on ema kohta, fookus läks emale, ja üle antud küsimus loeti ema omaks.

**Võrdlus:** ADR-070 elavas kontrollis 02.10 (üks inimene, parandus kümnenda sõnumina ehk teisena pärast piiri) algas vastus lausega „Arvestan parandusega: ema pension on 700 eurot.“ Siin on kaks erinevust korraga: kaks inimest ning parandus on kohe esimene sõnum pärast piiri, kusjuures üle antud viimane küsimus käib teise inimese kohta. Üks jooks ei ütle, kumb neist loeb.

**Miks kontrollid läbisid:** kataloog kontrollis summasid, inimesi, valdu ja seda, et vastus ei küsi valda uuesti. See ei kontrollinud, kas vastus vastab eelmisele küsimusele uuesti. Kataloogi pärast jooksu ei muudetud.

## 5. Mida see jooks ütleb ja mida mitte

**Ütleb (selle ühe vestluse kohta):**

- kahe inimese asjaolud ja summad jõuavad üle piiri õige inimese juurde;
- parandus pärast piiri asendab õige inimese õige asjaolu;
- teise inimese summa ja vald säilivad olekus.

**Ei ütle:**

- kas sama kordub; see on üks jooks;
- mida vastus isa summaga pärast piiri teeb; kümnendat sõnumit ei olnud, isa summa säilimine on loetud olekust;
- kas üheksanda vastuse segadus tuleb teemapiirist või tekiks ka teema sees, kui teise inimese kohta käivale küsimusele järgneb parandus; võrdlusjooksu ei tehtud;
- midagi kasutajate päris vestluste kohta; see on kirja pandud stsenaarium.

## 6. Kulu ja aeg

- Kokku 0,0559 USD plaani hindade järgi (hinnang; arvel olev kulu on varasema kogemuse järgi väiksem). Piir 0,06 USD.
- Kulukaitse: kui kaheksa esimest sõnumit oleksid maksnud üle 0,0519 USD, oleks jooks enne üheksandat peatatud. Pärast kaheksandat oli kulu 0,0491 USD; kaitse ei rakendunud.
- Jooks kestis 2 min 52 s; pööre 6–28 s.
- Plaan `m4-sotsiaalai-corpus-chat-20261002-190633-…-ra086d2744` (tootmisplaan), indeks `34fe1590`, sõnumid saadetud nii, nagu vestlus saadab (`--auto-modes`).

## 7. Võimalikud järgmised sammud

Selles ülesandes neid ei tehtud; otsus on omaniku.

- **Võrdlusjooks teema sees** (tasuline, umbes 0,03 USD): samad neli viimast sõnumit ühes teemas ilma piirita. Ütleks, kas segadus tuleb piirist.
- **Kontrolli lisamine kataloogi** järgmise jooksu jaoks: üheksas vastus algab paranduse kinnitusega ega küsi, kumma taotlust mõeldakse.
- **Muudatus üleandmises** (arendus), kui võrdlusjooks näitab piiri: näiteks anda viimane sõnum edasi koos inimesega, kelle kohta see käis, või märkida see vastatuks.

## Tõendid

- [evidence/two-people-boundary-2026-10-03.json](evidence/two-people-boundary-2026-10-03.json): iga sõnumi otsingu vald, otsinguplaani inimene, olek asjaolude kaupa, kõik kontrollid, kulu; sõnumite 1, 8 ja 9 vastused; mida üheksas sõnum kaasa sai.
- Hindaja täisraport on serveris (`eval-files/two-people-boundary-20261003/`). Siia seda ei pandud, sest sõnumite 4 ja 5 vastustes on valla ametniku kontaktandmed.
- Vestlus on omaniku kontol nähtav pealkirjaga „Hindamine mother-father-past-eight“.
