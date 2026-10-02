# Lühendiga seaduseviited („SHS § 25“) — mõõtmine 02.10.2026

Teostus Claude Opus 5.5. Omanik 02.10: „Alusta B tasuta mõõtmisest … Too konkreetsed näited ja soovitus, kas uut reeglit on vaja. Arenduse otsustame mõõtmise tulemuse järgi.“ Taust: [ADR-064](../rag-v2/adr-064-named-other-act.md) järgib teist seadust ainult siis, kui see on nimetatud täisnimega; lühend jäeti [ADR-063](../rag-v2/adr-063-checked-relations.md) järel mõõtmata.

**Lõplik soovitus (jaotis 9): lühendireeglit praegu mitte ehitada**, ei üldist ega kitsast. Neljas katses ei leidunud küsimust, kus päris vestlus jääks otsustava sätteta: ainsas juhtumis, kus mudelita otsing sätet lõppvalikusse ei toonud, võttis eelvaliku mudel selle riikliku õiguse varukohalt ja vastus viitas sellele (üksikvaatlus). Otsus on omanikul.

Seis pärast kolmandat mõõtmist (jaotis 7, ühendatud otsing): ühendatud otsing leiab kolmest otsustavast sättest kaks ise ja kolmas jõuab eelvaliku mudeli kandidaatidesse.

Teine mõõtmine (jaotis 6, ainult sõnaline otsing): kitsas reegel tooks kolmest küsimusest kahes puuduva sätte.

Esimene mõõtmine (jaotised 1–5): 30 raskes küsimuses ei toonud lühendi järgimine ühtegi puuduvat otsustavat sätet.

Mõõtmine oli tasuta ja ainult luges: serveris, korpus v47 (indeks `34fe1590`, 40 489 lõiku), ilma mudelikutseta. Skript: [rag-v2-abbreviation-references-2026-10-02-probes.mjs](rag-v2-abbreviation-references-2026-10-02-probes.mjs); tulemus: [evidence/abbreviation-references-2026-10-02.json](evidence/abbreviation-references-2026-10-02.json).

## 1. Kui sageli lühendiga viiteid esineb

Loetud on kuju „lühend vahetult paragrahvimärgi ees“ (SHS § 16, SHS-i §-s 105, LasteKS § 27 lg 1).

- **Kokku 800 viidet, 51 eri lühendit.**
- **364 neist (45,5%) nimetab seadust, mis on korpuses**: SHS 226, LasteKS 73, PKS 30, SÜS 21, HMS 14. Lisaks 20 kirjapildi varianti (SHSi, LasteKSi), mida ei loetud.
- **436 (54,5%) nimetab seadust, mida korpuses ei ole**: IKS 79, PGS 56, VÕS 30, AvTS 28, TTTS 23, TTKS 22, TLS 15, PISTS 14, PS 14 jt. Neid ei saa ükski otsingureegel järgida; see on korpuse ulatuse küsimus.

Kus korpuses olevate seaduste lühendiviited asuvad:

| Allika liik | Dokumente kokku | Dokumente, kus viide on | Viiteid |
|---|---:|---:|---:|
| Juhendid ja uuringud | 171 | 12 | 190 |
| Ajakirja artiklid | 892 | 33 | 120 |
| Valdade ja linnade määrused | 510 | 19 | 54 |
| Riiklikud seadused | 23 | 0 | 0 |
| Kataloogikirjed (teenused, toetused, vormid, kontaktid) | 4874 | 0 | 0 |
| **Kokku** | 6470 | **64** | **364** |

- Järgitav lühendiviide on 64 dokumendis, see on 4% teadmusallikatest (1596).
- **Määrused kasutavad täisnime.** SHS-ile viitab määrustes täisnimega 720 ja lühendiga 48 kohta. Täisnime järgib otsing juba (profiil v4).
- **Artiklid ja juhendid kasutavad lühendit.** SHS: artiklites 60 lühendiga ja 22 täisnimega, juhendites 118 ja 18.
- 47 dokumendist, mis viitavad SHS-ile lühendiga, selgitab lühendi lahti 15 („edaspidi SHS“).

## 2. Kas järgimine leiaks puuduva sätte

Simulatsioon kolmel raskel kataloogil (30 küsimust, igaühel teada otsustav lõik), profiili v6 valitud lõikudel (otsingukatse salvestatud read, ilma eelvaliku mudelita). Iga valitud lõigu lühendiviide lahendati korpuse kehtiva redaktsiooni paragrahviks samade funktsioonidega, mida täisnime reegel kasutab.

| | |
|---|---:|
| Küsimusi | 30 |
| Otsustav lõik leitud juba praegu | 28 |
| Küsimusi, mille valitud lõikudes on mõni lühendiviide | 6 |
| Lühendiviiteid neis | 18 |
| … seadus pole korpuses | 4 |
| … viidatud lõik on juba valitud | 3 |
| … reegel lisaks lõigu | 11 (viies küsimuses) |
| Lisanduvaid tokeneid kokku | 2647 |
| **Lisandusi, mis toovad puuduva otsustava lõigu** | **0** |

Kaks küsimust, kus otsustav lõik praegu puudub:

- `coach-reports-child`: valitud lõikudes on LasteKS § 27 lg 1 ja lg 5, mõlemad juba valitud. Puuduv säte on § 27¹; päris vestluses toob selle eelvaliku piir ([ADR-065](../rag-v2/adr-065-pool-limit-per-document.md)).
- `child-rehabilitation-need`: LasteKS § 26 lisanduks, aga puuduvat lõiku see ei sisalda.

## 3. Näited

Mida reegel lisaks (küsimus → viitav allikas → viide):

- `reclaim-limitation` → ajakirja artikkel pöördumisele vastamisest → HMS § 72, 78, 79, 83 lg 1, 84 lg 1, 87. Kuus lisandust ühest artiklist, 1118 tokenit; otsustav säte oli juba leitud.
- `involuntary-placement` → uuring psüühikahäirega inimeste teenustest → SHS § 3 ja § 15 (üldpõhimõtted), 1046 tokenit; otsustav säte oli juba leitud.
- `reclaim-enforcement` ja `special-care-decision-time` → kaks artiklit → SHS § 16 (abi andmise põhimõtted), 190 tokenit kumbki.

Viited korpuses, mida reegel järgida saaks:

- Narva linna asendus- ja järelhooldusteenuse kord viitab kolmes kohas SHS § 45¹¹ lõigetele 3 ja 4 (isiklike kulude miinimum, hoolduspere vanema tasu). See on sama liiki juhtum nagu Harku tugiisiku küsimus, mille pärast täisnime reegel tehti.
- Ühe valla sotsiaaltoetuste kord viitab SHS § 141 lõikele 1.
- MARAC-i juhend viitab LasteKS § 4 ja § 29 lg 3¹-le; PDF-is on ülaindeksist saanud ülakoma („lg 3'“).

Viited, mida järgida ei saa: PS § 20 lg 2 (põhiseadus), IKS, PGS, VÕS — neid seadusi korpuses ei ole.

## 4. Miks reeglit praegu mitte teha

- **Kasu ei ole mõõdetav.** 11 lisandust, 0 neist tõi puuduva sätte. Alusotsing leiab seaduse sätte ise (28/30); kaks möödalasku ei ole lühendiga ulatutavad.
- **Lisandused on üldpõhimõtted.** Artiklid viitavad enamasti SHS § 3, § 15, § 16 ja HMS-i üldsätetele. Need pikendavad konteksti (keskmiselt 530 tokenit mõjutatud küsimuse kohta) ja võtavad teise seaduse kaks kohta, mida täisnime reegel kasutab.
- **Artiklite ja juhendite numbrid pole täpsed.** Need on PDF-id, kus ülaindeks kaob („SHS § 131“ võib olla § 13¹). Praegune reegel jätab sellise numbri järgimata, kui see pole ühene, seega osa viiteid jääks nagunii kõrvale.
- **Üle poole lühendiviidetest läheb seadustesse, mida korpuses pole.**

## 5. Mis otsust muudaks

- **Määruste kitsas juhtum.** 19 määrust viitavad SHS-ile või SÜS-ile lühendiga (54 kohta), numbrid on seal täpsed (XML). Kui mõni päris küsimus puudutab just sellist sätet (näiteks Narva asendushoolduse isiklike kulude miinimum) ja vastus jääb SHS-i tekstita, tasub teha kitsas reegel: ainult õigusakti XML-ist, ainult korpuses olev seadus. Seda saab enne mõõta kahe-kolme küsimusega otsingukatses (embedding'u kulu alla 0,001 USD).
- **Korpuse ulatus.** Kui kasutajate küsimused vajavad IKS-i, PGS-i, PISTS-i või VÕS-i sätteid, on see nende seaduste lisamise, mitte viidete järgimise küsimus.

## 6. Määruste juhtum (teine mõõtmine 02.10 õhtul)

Omanik 02.10: „Mõõda Narva-tüüpi määruste juhtum tasuta otsingukatsega, ilma mudelikutseteta. Vali 2–3 sisulist küsimust ning määra enne katset iga küsimuse otsustav säte.“

- **Kataloog** [`abbreviation-municipal-1.json`](../../tests/evaluation/graph/abbreviation-municipal-1.json): kolm küsimust, iga kohta määruse viitav lause ja seaduse otsustav lause. Fail pandi kirja 02.10 kell 19:33, enne esimest otsingut, ja seda pole pärast muudetud (git blob `15bc2bb1514feb75c9ed4fe4910ac18cf777c362`).
- **Katse** ([skript](rag-v2-abbreviation-municipal-2026-10-02-probes.mjs), [tulemus](evidence/abbreviation-municipal-2026-10-02.json)): profiil v6, valla määrused ja täna kehtivad seadused nagu vestluses. **Ainult sõnaline otsing**, sest vektorikanal vajab küsimuse embedding'ut ehk mudelikutset. Eelvaliku mudelit ei ole.
- **Järgimine** on simuleeritud valitud lõikudel samade funktsioonidega, mida täisnime reegel kasutab: nimetatud lõike lõik, kuni kaks lisandust lugemise järjekorras (praeguse reegli kohad).

| Küsimus | Määruse viitav lõik valitud | Otsustav säte täna valitud | Otsustava sätte koht sõnalises järjestuses | Järgimine toob otsustava sätte | Kõrvaline tekst |
|---|---|---|---:|---|---|
| Narva: asendushooldusel lapse isiklike kulude miinimum (SHS § 45¹¹ lg 3) | jah | **jah** | 7 | pole vaja | 1 lõik, 204 tokenit |
| Sillamäe: kellele ja kui kaua järelhooldus (SHS § 45¹⁶ lg 1) | jah | **ei** | 62 | **jah** (556 tokenit) | 1 lõik, 842 tokenit |
| Põlva: kas tugiisik võib olla vanaema (SHS § 25 lg 2) | jah | **ei** | 78 | **jah** (186 tokenit) | 1 lõik, 419 tokenit |

- **Otsing loeb 40 esimest kandidaati.** Sillamäe ja Põlva otsustav säte on kohal 62 ja 78, seega jääb välja. Määruse viitav lõik on kõigis kolmes kohal 1–2.
- **Kahes küsimuses kolmest toob järgimine puuduva sätte**, kummaski koos ühe kõrvalise lõiguga: Sillamäel SHS § 45⁹ (kes saab asendushooldust), Põlvas SHS § 45⁴ (lapsehoiuteenuse nõuded). Mõlemale viitab sama määruse lõik, seega on need sama teema naabersätted, mitte juhuslik tekst.
- **Sillamäel mahtus otsustav säte kahe koha sisse napilt:** viitavas lõigus on see teine viide. Ilma kohtade piirita lisanduks kolm lõiku (1731 tokenit).
- **Narvas pole reeglit vaja:** otsing leidis SHS § 45¹¹ ise. Ainus lisandus tuleks ajakirja artiklist, mille PDF-is on „SHS § 45 lõige 3“; ülaindeks on kadunud ja viide läheks valesse paragrahvi (§ 45, mitte § 45⁹ või § 45¹¹). Määruste XML-is on numbrid täpsed ja seda viga seal ei ole.
- **Kaksikküsimus kinnitab suunda.** Harku tugiisiku küsimuses (sama säte, määrus nimetab seadust täisnimega) ei leidnud sätet ka vektoriga otsing: profiilid v1 ja v3 ei leidnud, täisnime reegel (v4) leidis ([tõend](evidence/own-subsections-2026-10-02/graph-v6-hard-3.json)).

### Mida see ütleb reegli kohta

- **Üldine reegel** (ka artiklitest ja juhenditest): esimese mõõtmise järgi kasu ei ole ja PDF-ide kadunud ülaindeks viib valesse sättesse. Mitte teha.
- **Kitsas reegel**: järgida korpuses oleva seaduse lühendit ainult õigusakti XML-ist (määrused), samade kohtade ja ruumiga nagu täisnime reegel. Mõõdetud kolmest küsimusest kahes tooks see puuduva otsustava sätte, hinnaga üks kõrvaline lõik (419–842 tokenit). Ulatus: 19 määrust (17 kehtivat), 54 viidet.
- Lühendi tähendus peaks tulema kindlast allikast: korpuse seaduste ametlikud lühendid (SHS, LasteKS, PKS, HMS, SÜS, RLS) või määruse enda selgitus („edaspidi SHS“).

### Mis on selles mõõtmises kinnitamata

- **Vektorikanal ja eelvaliku mudel puuduvad.** Päris otsing liidab sõnalise ja vektorjärjestuse ning mudel valib 30 kandidaadi seast; otsustav säte võib sealt tulla ka ilma reeglita (Narvas tuli see juba sõnalisest otsingust). Kindluse annaks sama katse vektoritega (kolme küsimuse embedding, alla 0,001 USD) ja üks vestluse raja jooks.
- Kolm küsimust on minu valitud määruste seast, kus säte on sisuliselt seadusele delegeeritud; see ei ütle, kui sageli kasutajad selliseid küsimusi küsivad.
- Kõrvalise teksti hulk sõltub viitava lõigu viidete järjekorrast; kaks kohta võib otsustava viite ka välja jätta, kui see on lõigus kolmas.

## 7. Määruste juhtum ühendatud otsinguga (kolmas mõõtmine 02.10 õhtul)

Omanik 02.10: „Luba on antud ühele embedding’u päringule kolme senise küsimusega, kogukulu kuni 0,001 USD. Salvesta vektorid korduskasutuseks ja korda katset sama tootmisprofiili ühendatud otsinguga. … Eelvaliku- ja vastusemudeli kutseid ega reegli teostust see luba ei hõlma.“

- **Kulu:** üks embedding'u päring, 9 teksti (kolm küsimust ja kataloogi kuus päringut), 269 tokenit, **0,000035 USD** plaani hinnaga. Vektorid on serveris failis `eval-files/abbreviation-municipal-1/vectors.json`; kordusjooks ei saada midagi.
- **Katse** ([skript](rag-v2-abbreviation-municipal-hybrid-2026-10-02-probes.mjs), [tulemus](evidence/abbreviation-municipal-hybrid-2026-10-02.json)): sama kataloog, profiil v6, teadmiste rada nii, nagu vestlus selle ehitab: sõnaline ja vektorotsing liidetult, valla määrused ja täna kehtivad seadused, riikliku õiguse varukohad. Eelvaliku mudelit ei kutsutud: selle asemel salvestati kandidaadid, mida mudel loeks (30 liidetud, kuni 10 ühest dokumendist, ja 6 varukohta), ning lõppvalik jäi liidetud järjestuse järgi.

| Küsimus | Otsustav säte kandidaatides | Mudelita lõppvalikus | Mida lühendireegel lisaks (kaks kohta) | Ainult määrustest |
|---|---|---|---|---|
| Narva: isiklike kulude miinimum (SHS § 45¹¹ lg 3) | jah, koht 5 | **jah** | 1 lõik, 204 tokenit, vale säte (artikli PDF, kadunud ülaindeks) | ei midagi |
| Sillamäe: järelhooldus (SHS § 45¹⁶ lg 1) | jah, koht 5 | **jah** | 1 lõik, 333 tokenit (SHS § 45¹¹), otsustav on juba olemas | sama |
| Põlva: tugiisik ja vanaema (SHS § 25 lg 2) | jah, koht 32 (varukoht) | **ei** | **otsustav säte**, 186 tokenit, kõrvalist teksti ei ole | sama |

- **Kaks kolmest leiab otsing ise.** Vektorikanal tõi Sillamäe sätte, mida sõnaline otsing ei toonud (seal koht 62). Reeglit neis kahes vaja ei ole; see lisaks ainult kõrvalise lõigu.
- **Põlva säte on kandidaatides ainult varukohana** (36-st 32.) ja mudelita lõppvalikusse ei jõua. Kas eelvaliku mudel selle sealt võtab, on mõõtmata. Kaudne tõend, et ei pruugi: Harku kaksikküsimuses (sama säte, täisnimega viide) jäi SHS § 25 lg 2 tekst päris vestluses tõenditest välja, kuni täisnime reegel tehti ([ADR-063](../rag-v2/adr-063-checked-relations.md), [ADR-064](../rag-v2/adr-064-named-other-act.md)).
- **Kõrvaline tekst** on reegli korral väike: 0–333 tokenit küsimuse kohta, kui järgida ainult määrusi. Artiklist tulev lisandus (Narva) on vale säte ja kinnitab, et PDF-idest järgida ei tohi.

### Mida see ütleb

- Sõnalise katse tulemus (2 kolmest) oli liiga optimistlik: ühendatud otsinguga on reeglist kasu **ühes küsimuses kolmest**.
- See üks on sama kuju, mille pärast täisnime reegel tehti (määrus annab nõuded üle SHS-ile). Kitsas reegel paneks lühendi täisnimega samale pulgale: määrus, mis kirjutab „SHS § 25“, saaks sama, mis määrus, mis kirjutab „sotsiaalhoolekande seaduse § 25“.
- Kulu oleks väike (kuni kaks lõiku, mõõdetud 186–333 tokenit) ja risk väike, kui järgida ainult õigusakti XML-ist.
- Kindel vastus Põlva küsimusele tuleks ühest vestluse raja pöördest (eelvaliku ja vastuse mudel, umbes 0,005 USD); seda luba ei hõlmanud.

### Piirid

- Kolm küsimust, igaüks üks kord; kandidaatide ja lõppvaliku järjekord on mudelita.
- Lühendireegel on simuleeritud mudelita lõppvalikul. Päris vestluses rakenduks see mudeli valitud lõikudele, mis võivad erineda.
- Kataloogi päringud on käsitsi kirjutatud; vestluses kirjutab need otsinguplaani mudel.

## 8. Põlva küsimus päris vestluse rajal (üks pööre, 02.10 õhtul)

Omanik 02.10: „Luba on antud ühele Põlva küsimuse pöördele praeguse tootmisprofiiliga, eeldatava kuluga umbes 0,005 USD. Salvesta otsinguplaan, kandidaadid, eelvaliku tulemus ja vastuse viited … Ära käivita täiendavaid tasulisi kordusi ega ehita veel reeglit. Ühe pöörde tulemust käsitle üksikvaatlusena.“

- **Jooks** ([skript](rag-v2-abbreviation-polva-turn-2026-10-02-probes.mjs), [tulemus](evidence/abbreviation-polva-turn-2026-10-02.json)): üks pööre päris teenuse kaudu, tootmisplaan (profiil v6, dialoogi juhis 23), otsinguplaani, eelvaliku ja vastuse mudeliga. Eelvaliku konks ainult salvestas, mida mudel sai ja mida tagastas. Pööre `c1c3d6ed`, **0,0063 USD** plaani hindadega (plaan 0,0002, embedding 0,00001, eelvalik 0,0019, vastus 0,0042), 32 s. Kordust ei tehtud.
- Enne jooksu kinnitatud tasuta (salvestatud vektoritega): kandidaat kohal 32 on tõesti SHS § 25 (tugiisikuteenus), mitte sama sõnastusega § 29 (isiklik abistaja).

| Samm | Mis juhtus |
|---|---|
| Otsinguplaan | Kolm päringut: valla tugiisikuteenus ja vanaema; „Tugiisikuteenuse osutaja lähedasele isikule piirangud“; teenuse korraldamine omavalitsuses. Inimene „laps“, vald Põlva. |
| Kandidaadid | 36 (30 liidetud ja 6 varukohta). Määruse viitav lõik (§ 4) kohal 2. **SHS § 25 kohal 32, varukohana.** |
| Eelvalik | Mudel valis neli lõiku ja pani **SHS § 25 esimeseks**; järgnesid määruse § 4, § 5 ja § 2. |
| Tõendid vastuse mudelile | SHS § 25 (186 tokenit), määruse kolm lõiku, SHS § 24 teadmiskaardi kaudu ja valla kataloogikirjed. |
| Vastus | „Ei. Vanaema ei saa olla lapse tugiisikuteenuse vahetu osutaja …“ Esimene lõik viitab SHS § 25-le ja määruse § 4-le, teine määruse § 5-le ja § 2-le. Täpsustust ega piirangut vastuses ei ole. |

- **SHS § 25 lg 2 jõudis vastuse tõenditesse ja vastus viitas sellele**, ilma lühendireeglita. Tee: riikliku õiguse varukoht ([ADR-032](../rag-v2/adr-032-national-law-reserve-and-plan-restart.md)) → eelvaliku mudel.
- **See on üks vaatlus.** Kandidaatidesse jõudmine sõltub otsinguplaani päringutest, mida mudel iga kord ise kirjutab, ja valik eelvaliku mudelist. Harku kaksikküsimuses jäi sama säte 01.10 päris vestluses tõenditest välja, kuigi varukohad olid siis juba olemas; seal aitas täisnime reegel.

## 9. Lõplik soovitus kõigi katsete põhjal

| Katse | Kulu | Tulemus |
|---|---:|---|
| 1. Loendus ja 30 rasket küsimust | 0 | 364 järgitavat viidet 64 dokumendis; reegel lisaks 11 lõiku ja ükski ei too puuduvat sätet |
| 2. Kolm määruse küsimust, sõnaline otsing | 0 | 2 kolmest puudu; reegel tooks |
| 3. Samad kolm, ühendatud otsing mudelita | 0,000035 USD | 1 kolmest puudu lõppvalikust, aga kandidaatides olemas |
| 4. Põlva küsimus päris vestluse rajal | 0,0063 USD | säte jõudis tõenditesse ja vastus viitas sellele |

**Soovitus: lühendireeglit praegu mitte ehitada.**

- **Üldine reegel** (artiklitest ja juhenditest): kasu ei ole mõõdetud üheski katses, ja PDF-ide kadunud ülaindeks viib valesse sättesse.
- **Kitsas reegel** (ainult määrustest): ühtegi küsimust, kus päris vestlus jääks sätteta, ei leitud. Olemasolev tee (vektorotsing, varukohad, eelvaliku mudel) kattis kõik kolm määruse küsimust.
- **Mis jääb teadmata:** kui kindlalt see tee töötab. Tõendeid on mõlemas suunas: Põlvas töötas (üks vaatlus), Harkus 01.10 ei töötanud. Kitsas reegel teeks tulemuse mudelist sõltumatuks, väikese hinnaga (mõõdetud 0–333 tokenit küsimuse kohta, kuni kaks lõiku), nii et see on kindlustus, mitte parandus.
- **Mis otsust muudaks:** päris vestluse vastus, mis jätab määruse lühendiga viidatud seaduse sätte tõenditest välja. Kataloog `abbreviation-municipal-1.json` ja salvestatud vektorid lubavad seda edaspidi tasuta jälgida (otsing mudelita) ja ühe pöördega üle kontrollida.
- **Odavam samm, kui kindlust tahetakse:** lisada kolm küsimust vestluse hindamiskataloogi, et iga tulevane hindamisjooks neid mõõdaks; reeglit see ei eelda.

## Piirid

- Simulatsioon kasutas valikut ilma eelvaliku mudelita; päris vestluses valib mudel 30 kandidaadi seast ja lõigud võivad erineda.
- 30 rasket küsimust on koostatud tingimuste ja erandite leidmiseks; ükski neist ei küsi määruse sätet, mis viitab SHS-ile lühendiga.
- Loetud on ainult kuju „lühend § number“. Viiteid kujul „§ 25 (SHS)“ või lühendit ilma paragrahvita ei loetud.
- Lühendi all on loetud kuni 10-täheline sõna vähemalt kahe suurtähega; käändelõpuga kokku kirjutatud kujud (SHSi) läksid eraldi lühendiks.
