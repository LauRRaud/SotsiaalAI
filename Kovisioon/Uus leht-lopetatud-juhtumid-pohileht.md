# Lõpetatud juhtumid — põhilehe funktsionaalne ja visuaalne spetsifikatsioon

**Dokumendi staatus:** detailne funktsionaalne ja visuaalne spetsifikatsioon  
**Versioon:** 1.0  
**Seotud funktsioonid:** Teemaseeme, kovisiooni 8. etapp, järelvaade, praktikakandidaat, Parimad praktikad  
**Järgmine eraldi dokument:** „Lõpetatud juhtumi detailvaade”

---

# 1. Dokumendi eesmärk

See dokument määratleb platvormi eraldi põhilehe:

# Lõpetatud juhtumid

Leht koondab kovisioonisessioonid, mille aktiivne 1–8-etapiline töö on lõpetatud.

„Lõpetatud juhtum” ei tähenda automaatselt, et:

- inimese või lapse olukord on täielikult lahendatud;
- valitud samm on edukalt rakendatud;
- teenusevajadus on lõppenud;
- professionaalne küsimus ei võiks tulevikus uuesti avaneda.

See tähendab:

> **Konkreetne kovisiooniprotsess on lõpetatud ning juhtum on liikunud järgmise sammu, järelvaate, jätkuotsuse või arhiivi faasi.**

Dokument kirjeldab:

- lehe rolli platvormi arhitektuuris;
- andmevoogu kovisiooni 8. etapist;
- lõpetatud juhtumi elutsüklit;
- põhilehe päist, navigatsiooni ja filtreid;
- kaardi- ja nimekirjavaadet;
- juhtumikaardi sisu;
- järelvaate tähelepanuvajadust;
- rollipõhist nähtavust;
- Kovisioonipaki privaatsust;
- jätkuteema ja praktikakandidaadi seoseid;
- järelvaate kalendrit;
- otsingut ja sortimist;
- tühje, laadimis- ja veaolekuid;
- andmete säilitamist;
- AI rolli ja piiranguid;
- ligipääsetavust;
- visuaalset ülesehitust;
- funktsionaalseid, metoodilisi, privaatsus- ja visuaalseid vastuvõtukriteeriume.

---

# 2. Lehe koht platvormi põhinavigatsioonis

Platvormi põhilehed on:

1. **Uus kovisioon**
2. **Teemaseemned**
3. **Lõpetatud juhtumid**
4. **Parimad praktikad**

## 2.1. Uus kovisioon

- avab aktiivse 1–8-etapilise kovisiooniruumi;
- sisaldab etappide rada;
- sisaldab sessiooni rolle, taimerit, Pausi ja Vajan tuge toimingut.

## 2.2. Teemaseemned

- sisaldab enne kovisiooni loodud teemasid;
- näitab ootel, valitud ja töös olevaid teemasid;
- on juhtumi sisendi ning planeerimise ruum.

## 2.3. Lõpetatud juhtumid

- sisaldab suletud kovisioonisessioone;
- jälgib järgmist sammu ja järelvaadet;
- võimaldab teha jätkuotsuse;
- ei ava vana kovisioonilõuendit muutmisrežiimis.

## 2.4. Parimad praktikad

- sisaldab juhtumitest eraldatud üldistatud professionaalseid tööviise;
- sisaldab praktikakandidaate ja kinnitatud praktikaid;
- ei säilita detailset lõpetatud juhtumit.

---

# 3. Oluline visuaalne ja funktsionaalne piir

„Lõpetatud juhtumite” põhilehel:

- **ei ole kovisiooni 1–8 etapi rada**;
- ei ole kohtumise taimerit;
- ei ole sessiooni juhi ajutist rolli;
- ei ole Pausi nuppu;
- ei ole „Vajan tuge” kovisiooniprotsessi nuppu;
- ei ole aktiivse juhtumi lõuendit;
- ei ole küsimuste, peegelduste ega võimaluste tööriistu.

Lehel on ainult platvormi põhine navigeerimine ja lõpetatud juhtumite haldus.

Põhilehe abi toiming on:

> **Abi**

mitte:

> Vajan tuge

---

# 4. Lehe põhieesmärk

Leht aitab kasutajal vastata küsimustele:

1. Millised kovisioonid on lõpetatud?
2. Milline järgmine samm valiti?
3. Millal toimub järelvaade?
4. Milline järelvaade vajab tähelepanu?
5. Kas samm päriselt tehti?
6. Mida juhtumi tooja sellest õppis?
7. Kas teema sulgub, jätkub või vajab uut kovisiooni?
8. Kas juhtumiga on seotud praktikakandidaat?
9. Milline materjal säilib ja kellele see on nähtav?

Leht ei ole ainult arhiiv.

See on:

> **järelvaate, professionaalse õppimise ja jätkuotsuste töölaud.**

---

# 5. Andmevoog kovisioonist põhilehele

Kui 8. etapis vajutatakse:

> **Sulge juhtum**

või:

> **Sulge kohtumine**

luuakse lõpetatud juhtumi kirje.

```text
Teemaseeme
    ↓
Aktiivne kovisioon
    ↓
Etapp 8 — kokkuvõte ja õppimine
    ↓
Juhtum suletakse
    ↓
Lõpetatud juhtumid
    ↓
Olek: Järelvaates / Suletud / Ootel jätkuks
```

## 5.1. Põhilehele liigub

- juhtumi üldistatud pealkiri;
- lõpetatud sessiooni identifikaator;
- algse Teemaseemne seos;
- kovisiooni kuupäev;
- juhtumi tooja;
- grupp või meeskond vastavalt õigustele;
- juhtumiprofiil;
- professionaalne fookus;
- tööfookuse üldistus;
- valitud suuna üldistus;
- järgmise sammu üldistus;
- ajaraam;
- edenemise või õppimise märk;
- järelvaate kuupäev või sündmus;
- juhtumi olek;
- Kovisioonipaki tehniline olek;
- säilitamise olek;
- praktikakandidaadi olek;
- seotud jätkuteema olek.

## 5.2. Põhilehele ei liigu

- detailne juhtumilugu;
- täielik võrgustikukaart;
- kõik küsimused;
- kõik peegeldused;
- kõik võimalused;
- juhtumi tooja privaatne valikuprotsess;
- grupiliikmete privaatne õppimine;
- kogu transkriptsioon;
- salvestamata heli või video;
- AI sisemised mustandid.

---

# 6. Lehe päis

## 6.1. Pealkiri

# Lõpetatud juhtumid

## 6.2. Alapealkiri

> Siin on kovisioonisessioonid, mille aktiivne töö on lõpetatud. Juhtumi järgmine samm või järelvaade võib veel olla pooleli.

## 6.3. Päise toimingud

- otsing;
- filtrite avamine;
- kaardi- ja nimekirjavaate vahetamine;
- sortimine;
- Abi;
- kasutaja profiil.

## 6.4. Kasutaja profiil

Põhilehel kuvatakse kasutaja püsiv professionaalne roll või amet, näiteks:

> **Jaanika Kask**  
> Sotsiaalpedagoog

Ei kuvata:

> Sessiooni juht

sest see on ajutine roll ainult aktiivses kovisioonis.

---

# 7. Põhilehe vaated

## 7.1. Kaardivaade

Sobib:

- visuaalseks ülevaateks;
- väiksemale ja keskmisele juhtumite arvule;
- järelvaate ning järgmise sammu kiireks mõistmiseks.

## 7.2. Nimekirjavaade

Sobib:

- suurele juhtumite arvule;
- kuupäevade ja olekute haldamiseks;
- sortimiseks;
- administratiivseks ülevaateks.

## 7.3. Kalendrivaade

Ei ole põhivaade, vaid valikuline järelvaate kiht.

Näitab:

- tulevasi järelvaateid;
- tähelepanu vajavaid järelvaateid;
- samal päeval olevaid mitut järelvaadet;
- kasutajale nähtavaid juhtumeid.

---

# 8. Rollipõhised vaated

Põhilehel on kolm peamist nähtavusvaadet.

## 8.1. Minu juhtumid

Juhtumid, kus kasutaja oli:

- juhtumi tooja;
- või tal on jätkuva järelvaate otsene roll.

## 8.2. Minu grupi juhtumid

Juhtumid:

- mille grupis kasutaja osales;
- mille üldistatud tulemuse nägemine on grupis lubatud.

See ei anna automaatselt ligipääsu:

- isiklikule Kovisioonipakile;
- detailsele järelvaatele;
- privaatsetele õppimistele.

## 8.3. Kõik nähtavad

Kõik juhtumid, mille üldistatud andmete nägemiseks on kasutajal kehtiv õigus.

See ei tähenda:

- organisatsiooni kõigi juhtumite täielikku nähtavust;
- administraatori automaatset ligipääsu detailsele sisule.

---

# 9. Juhtumi olekud

## 9.1. Järelvaates

Kovisioon on lõpetatud, kuid järgmise sammu mõju pole veel üle vaadatud.

Põhitoiming:

> **Ava järelvaade**

## 9.2. Järelvaade vajab tähelepanu

Kokkulepitud järelvaate aeg on saabunud või möödunud.

Sobiv tekst:

> **Kokkulepitud järelvaate aeg möödus 4 päeva tagasi.**

Toimingud:

- Tee järelvaade;
- Määra uus aeg;
- Loo jätkuteema;
- Sulge teema põhjendatud otsusega.

## 9.3. Järelvaade tehtud — ootab jätkuotsust

Järelvaate küsimustele on vastatud, kuid juhtumi elutsükli järgmine olek pole valitud.

Jätkuotsused:

- Sulge teema;
- Jätka iseseisvalt;
- Määra uus järelvaade;
- Loo seotud Teemaseeme;
- Loo praktikakandidaat;
- Vali teine professionaalne tugivorm.

## 9.4. Suletud

Selle kovisiooni tööfookus ei vaja praegu uut sessiooni.

See ei tähenda tingimata, et kogu inimese või lapse olukord on lahendatud.

## 9.5. Ootel jätkuks

Sama professionaalne teema vajab uut kovisiooni.

Vana sessiooni ei avata muutmiseks.

Luuakse:

> **uus eelmise juhtumiga seotud Teemaseeme**

## 9.6. Praktikakandidaat

Juhtumiga on seotud üldistatav praktikakandidaat.

Täpsed alamolekud võivad olla:

- privaatne praktikakandidaat;
- ootab rakendamist;
- ootab järelvaadet;
- ootab retsenseerimist;
- retsenseerimisel;
- vajab täiendamist;
- professionaalseks kinnitamiseks valmis.

## 9.7. Arhiveeritud

Juhtum on lõpetatud, vajalik järelvaade tehtud ning kirje on viidud arhiivivaatesse.

---

# 10. Olekute elutsükkel

```text
Järelvaates
    ↓
Järelvaade vajab tähelepanu
    ↓
Järelvaade tehtud — ootab jätkuotsust
    ├── Suletud
    ├── Ootel jätkuks
    ├── Uus Teemaseeme
    ├── Uus järelvaade
    └── Praktikakandidaat
```

Juhtumit ei märgita automaatselt „lahendatuks”.

AI ei otsusta, millal teema on suletud.

---

# 11. Juhtumikaardi struktuur

## 11.1. Päis

- üldistatud pealkiri;
- olekusilt;
- juhtumi tooja;
- kovisiooni kuupäev;
- grupp vastavalt õigustele;
- praktikakandidaadi olek, kui olemas.

## 11.2. Tööfookus

Üks lühike üldistus.

## 11.3. Valitud suund

Juhtumi tooja kinnitatud üldistus.

## 11.4. Järgmine samm

Üks konkreetne professionaalne samm või mõtlemisaja plaan.

## 11.5. Ajaraam

Kuupäev, ajavahemik või sündmus.

## 11.6. Edenemise või õppimise märk

Jälgitav, kuid mitte garanteeritud tulemus.

## 11.7. Järelvaade

- kuupäev;
- sündmus;
- olek;
- tähelepanuvajadus.

## 11.8. Kovisioonipaki olek

Teiste kasutajate puhul:

> **Mari Kovisioonipakk · kinnitatud**  
> Sisu nähtav ainult Marile

Juhtumi tooja enda vaates:

> **Ava minu Kovisioonipakk**

## 11.9. Säilitamise olek

Näiteks:

- detailne lõuend kustutatud;
- detailne lõuend säilib kuni järelvaateni;
- säilivad ainult valitud kaardid;
- auditmetaandmed säilivad.

---

# 12. Juhtumikaardi toimingud

## 12.1. Järelvaates juhtum

- Vaata lõpetatud juhtumit;
- Ava järelvaade;
- Ava minu Kovisioonipakk — ainult omanikule;
- Vaata säilitamise olekut;
- Rohkem.

## 12.2. Tähelepanu vajav juhtum

- Tee järelvaade;
- Määra uus aeg;
- Loo jätkuteema;
- Sulge teema;
- Rohkem.

## 12.3. Järelvaade tehtud — ootab jätkuotsust

- Vaata järelvaadet;
- Tee jätkuotsus;
- Loo seotud Teemaseeme;
- Loo praktikakandidaat;
- Määra uus järelvaade.

## 12.4. Suletud juhtum

- Vaata lõpetatud juhtumit;
- Vaata järelvaadet;
- Ava minu Kovisioonipakk — ainult omanikule;
- Arhiveeri;
- Rohkem.

## 12.5. Ootel jätkuks

- Ava seotud Teemaseeme;
- Loo uus jätkuteema;
- Vaata eelmist järelvaadet;
- Rohkem.

## 12.6. Praktikakandidaadiga juhtum

- Vaata lõpetatud juhtumit;
- Vaata praktikakandidaadi olekut;
- Ava kandidaadi mustand — ainult õigustega kasutajale;
- Rohkem.

---

# 13. Toimingu nimetamise reegel

Vältida:

> **Ava juhtum**

sest see võib tähendada vana sessiooni taasavamist muutmiseks.

Kasutada:

- **Vaata lõpetatud juhtumit**;
- **Vaata juhtumi kokkuvõtet**;
- **Vaata sessiooni ajalugu**.

Detailvaates kuvatakse:

> **Kovisioon on suletud · algne sessioon on lugemisrežiimis**

---

# 14. Juhtumikaardi näide

```text
KATKENDLIK KOOLISKÄIMINE
Järelvaates

Juhtumi tooja: Mari Mets
Kovisioon: 10.07.2026

Tööfookus
Lapse kogemuse nähtavus ja täiskasvanute vastutuse eristamine.

Valitud suund
Alustada lapse jõukohase osaluse nähtavaks tegemisest.

Järgmine samm
Küsida lapselt talle arusaadaval viisil, kas ja kuidas ta
soovib visuaalses vestluses osaleda.

Ajaraam
3 tööpäeva

Edenemise märk
Laps on saanud väljendada, kas ja kuidas ta soovib osaleda.

Järelvaade
24.07.2026 · järgmise kovisiooni alguses

[Vaata lõpetatud juhtumit]     [Ava järelvaade]
```

---

# 15. Lehe tähelepanuala

Lehe ülaosas võib olla kompaktne ala:

# Vajab tähelepanu

Kuvatakse ainult:

- täna saabuvad järelvaated;
- möödunud järelvaated;
- tehtud järelvaated, mis ootavad jätkuotsust;
- säilitamise või kustutamise vead;
- praktikakandidaadid, mille järelvaade on valmis.

See ei ole:

- töötaja tulemuslikkuse paneel;
- punane rikkumiste loend;
- hilinemiste edetabel.

Sobiv märge:

> **3 järelvaadet vajavad tähelepanu**

---

# 16. Järelvaate kalender

## 16.1. Eesmärk

Kalender aitab näha:

- millal järelvaated toimuvad;
- milline järelvaade on täna;
- milline vajab uut aega;
- millisel päeval on mitu järelvaadet.

## 16.2. Kalender näitab ainult

- kasutajale nähtavaid juhtumeid;
- üldistatud pealkirja või turvalist märksõna;
- kuupäeva;
- olekut;
- juhtumi toojat ainult õiguste olemasolul.

## 16.3. Kalender ei näita

- detailset järgmist sammu;
- klienti või last tuvastavaid andmeid;
- Kovisioonipaki sisu.

## 16.4. Eristus

Olek on näidatud:

- teksti;
- ikooni;
- kujundi;
- mitte ainult värviga.

---

# 17. Otsing

Otsing töötab ainult andmetes, mida kasutajal on õigus näha.

Otsida saab:

- üldistatud pealkirja;
- tööfookuse märksõna;
- juhtumi tooja;
- grupi;
- kovisiooni kuupäeva;
- järelvaate kuupäeva;
- professionaalse fookuse;
- praktikakandidaadi oleku järgi.

Otsingu kohatäide:

> **Otsi pealkirja, märksõna, juhtumi tooja või grupi järgi…**

Ei kasutata ebamäärast:

> juhi järgi

---

# 18. Filtrid

## 18.1. Põhifiltrid

- Kõik;
- Järelvaates;
- Järelvaade vajab tähelepanu;
- Järelvaade tehtud;
- Suletud;
- Ootel jätkuks;
- Praktikakandidaadiga;
- Arhiveeritud.

## 18.2. Rollifiltrid

- Minu juhtumid;
- Minu grupi juhtumid;
- Kõik nähtavad.

## 18.3. Sisufiltrid

- juhtumiprofiil;
- professionaalne fookus;
- kuupäevavahemik;
- grupp;
- järgmise sammu tüüp;
- järelvaate aeg;
- praktikakandidaadi olek.

## 18.4. Aktiivse filtri nähtavus

Kõik aktiivsed filtrid on lehe ülaosas kiipidena nähtavad ja ühe toiminguga eemaldatavad.

---

# 19. Sortimine

Võimalikud sortimisviisid:

- lähim järelvaade;
- tähelepanu vajavad esimesena;
- uusim kovisioon;
- vanim kovisioon;
- pealkiri;
- juhtumi tooja;
- praktikakandidaadi olek.

Vaikimisi:

1. tähelepanu vajavad;
2. lähimad järelvaated;
3. ülejäänud uusimast vanimani.

Sortimine ei ole tulemuslikkuse järjestamine.

---

# 20. Põhilehe ja detail-alalehe suhe

## 20.1. Põhileht

Näitab:

- juhtumite ülevaadet;
- olekuid;
- järelvaateid;
- kiireid toiminguid;
- filtreid;
- kalendrit.

## 20.2. Detail-alaleht

Avaneb toiminguga:

> **Vaata lõpetatud juhtumit**

Detailvaates on:

- Kokkuvõte;
- Järelvaade;
- Seosed;
- Andmed ja säilitamine;
- Minu Kovisioonipakk — ainult omanikule.

## 20.3. Vana sessiooni ajalugu

Vajadusel saab detailvaatest avada:

> **Vaata sessiooni ajalugu**

See on lugemisrežiimis.

Seda ei kuvata põhilehel ega muudeta.

---

# 21. Järelvaate töövoo seos

Põhilehel toiming:

> **Ava järelvaade**

viib juhtumi detail-alalehe järelvaate sektsiooni.

Järelvaates kirjeldatakse:

- mida tegelikult tehti;
- milline osa sammust toimus;
- mis muutus või ei muutunud;
- mida juhtumi tooja õppis;
- milline ressurss osutus kasutatavaks;
- milline tingimus või takistus muutus;
- milline on jätkuotsus.

Põhilehe kaardi olek uueneb pärast järelvaate kinnitamist.

---

# 22. Jätkuteema loomine

Kui järelvaates selgub, et teema vajab uut kovisiooni:

1. vana juhtum jääb suletud ajalooks;
2. luuakse uus seotud Teemaseeme;
3. uude seemnesse liigub ainult minimaalne seos:
   - eelmine tööfookus;
   - eelmine järgmine samm;
   - järelvaates tekkinud uus küsimus;
   - miks uus kovisioon on vajalik.

Uus Teemaseeme ei kopeeri kogu vana juhtumilugu.

Põhilehel kuvatakse:

> **Ootel jätkuks · seotud Teemaseeme loodud**

Toiming:

> **Ava jätkuteema**

---

# 23. Praktikakandidaadi seos

Põhilehel võib juhtumikaardil olla:

> **Privaatne praktikakandidaat**  
> Ootab rakendamist ja järelvaadet

või:

> **Praktikakandidaat retsenseerimisel**

Põhileht ei võimalda:

- kandidaati parimaks praktikaks kinnitada;
- kogu juhtumit avaldada;
- retsensentide otsust asendada.

Toimingud sõltuvad õigustest:

- Vaata kandidaadi olekut;
- Ava kandidaadi mustand;
- Täienda järelvaate infot;
- Mine Parimate praktikate töövoogu.

---

# 24. Kovisioonipaki privaatsus

## 24.1. Juhtumi tooja vaates

Kuvatakse:

> **Ava minu Kovisioonipakk**

## 24.2. Teise grupiliikme või sessiooni juhi vaates

Kuvatakse ainult:

> **Mari Kovisioonipakk · kinnitatud**  
> Sisu nähtav ainult Marile

Avamisnupp puudub.

## 24.3. Administraatori vaates

Administraatori tehniline roll ei anna automaatselt sisulist ligipääsu Kovisioonipakile.

Administraator võib näha:

- paki olemasolu;
- tehnilist olekut;
- säilitustähtaega;
- veateadet.

Ta ei näe sisu ilma eraldi õiguse ja aluseta.

---

# 25. Säilitamise olek põhilehel

Kaardil või detailvaates saab kuvada:

- detailne lõuend kustutatud;
- detailne lõuend kustutatakse {{kuupäev}};
- detailne lõuend säilib järelvaateni;
- säilivad ainult valitud kaardid;
- grupi üldistus säilib;
- heli ja video ei salvestatud;
- auditmetaandmed säilivad.

Lehel ei tohi näidata:

> Kustutatud

enne tegelikku kustutamist.

Veaolek:

> **Kustutamine vajab tähelepanu**

ei avalda tehnilises veateates juhtumi sisu.

---

# 26. Tühja lehe olek

Kui lõpetatud juhtumeid pole:

# Siin pole veel lõpetatud juhtumeid

> Kui kovisioon jõuab 8. etapini ja suletakse, ilmub selle järgmine samm ja järelvaade siia.

Toimingud:

- Mine Teemaseemnetesse;
- Ava uus kovisioon.

---

# 27. Otsingu tühitulemus

# Sobivaid lõpetatud juhtumeid ei leitud

> Muuda otsingut või eemalda mõni filter.

Toimingud:

- Tühjenda otsing;
- Eemalda kõik filtrid.

---

# 28. Laadimisolek

- kuvatakse kaardistruktuuri neutraalsed luukered;
- ei kuvata väljamõeldud juhtumiandmeid;
- järelvaate kalender näitab laadimisolekut;
- toimingud pole aktiivsed.

---

# 29. Veaolekud

## 29.1. Juhtumite laadimine ebaõnnestus

> Lõpetatud juhtumeid ei õnnestunud laadida.

Toiming:

- Proovi uuesti.

## 29.2. Järelvaate olekut ei õnnestunud uuendada

- vana kinnitatud olek jääb nähtavaks;
- uut olekut ei näidata õnnestununa;
- kasutaja saab uuesti proovida.

## 29.3. Ligipääsu pole

> Sul ei ole õigust selle juhtumi detaili vaadata.

Põhilehe kaart võib jääda nähtavaks ainult minimaalses üldistatud ulatuses või kaduda täielikult vastavalt õigusele.

---

# 30. Teavitused

Leht võib saata või kuvada:

- järelvaade toimub täna;
- järelvaate aeg saabus;
- järelvaade vajab uut aega;
- järelvaade on tehtud ja ootab jätkuotsust;
- jätkuteema loodi;
- praktikakandidaat vajab täiendamist;
- ajutise lõuendi kustutamise tähtaeg saabub;
- säilitamise tehniline toiming ebaõnnestus.

Teavitused ei tohi sisaldada:

- tundlikku juhtumilugu;
- kliendi või lapse nime;
- detailset järgmist sammu lukustamata ekraanil.

---

# 31. AI roll ja piirid

## 31.1. AI võib

- aidata otsida kasutajale nähtavates üldistatud väljades;
- aidata järelvaate üldistust lühendada;
- aidata märgata, et järelvaate jätkuotsus puudub;
- aidata Teemaseemne jätkuteema pealkirja üldistada;
- aidata praktikakandidaadi mustandit isikustamata kujule viia;
- aidata selgitada olekute erinevust;
- kuvada tähelepanu vajavaid protsessiolekuid;
- aidata säilitamise olekut kasutajale arusaadavalt sõnastada.

## 31.2. AI ei või

- otsustada, et juhtum on lahendatud;
- sulgeda teemat juhtumi tooja eest;
- valida jätkuotsust;
- luua automaatselt uut Teemaseemet;
- avaldada praktikakandidaati;
- näidata kasutajale andmeid, milleks tal pole õigust;
- avada teise inimese Kovisioonipakki;
- muuta vana sessiooni hetktõmmist;
- hinnata töötaja tulemuslikkust juhtumite arvu või oleku järgi;
- koostada avalikku juhtumilugu.

---

# 32. Ligipääsetavus

- otsing ja filtrid on klaviatuuriga kasutatavad;
- kaardi- ja nimekirjavaade on ekraanilugejale arusaadavad;
- kaardi olek loetakse tekstina;
- tähendus ei sõltu ainult värvist;
- järelvaate kalender on kasutatav ka nimekirjana;
- toimingutel on täpsed ligipääsetavad nimetused;
- „Rohkem” menüü annab konteksti juhtumi pealkirjaga;
- kaardid ei nõua lohistamist;
- fookusjärjekord järgib visuaalset hierarhiat;
- animatsiooni saab vähendada;
- abitekstid on lihtsas ja arusaadavas keeles.

---

# 33. Visuaalne disain

## 33.1. Üldmulje

- tume soe keskkond;
- sama platvormi visuaalne keel;
- heledad läbipaistvad klaaskaardid;
- üks merevaigune aktiivne aktsent;
- tagasihoidlikud olekuvärvid;
- palju vaba ruumi;
- professionaalne, mitte administratiivselt külm.

## 33.2. Taust

Leht võib kasutada sama abstraktset maali nagu platvormi teised põhilehed, kuid:

- taust on vaiksem kui aktiivses kovisiooniruumis;
- maal ei konkureeri kaartide tekstiga;
- sama visuaalne identiteet säilib.

## 33.3. Külgmenüü

Põhilehel on püsiv põhilehtede navigatsioon põhjendatud.

See sisaldab:

- Uus kovisioon;
- Teemaseemned;
- Lõpetatud juhtumid;
- Parimad praktikad.

Aktiivne leht on tekstiliselt ja visuaalselt eristatud.

## 33.4. Keskosa

- juhtumikaardid;
- kaardi- või nimekirjavaade;
- filtrid;
- lehekülgede vahetamine või lõputu laadimine vastavalt mahule.

## 33.5. Parempoolne valikuline ala

- järelvaate kalender;
- tähelepanu vajavad juhtumid;
- olekute selgitus.

Olekute selgitus on kokkupandav.

## 33.6. Värvikasutus

Olekutel võib olla tagasihoidlik aktsent, kuid alati koos:

- tekstisildiga;
- ikooniga;
- vajadusel servastiiliga.

Ei kasutata roheline–punane tulemusjuhtimise loogikat.

## 33.7. Mida lehel ei tohi olla?

- aktiivse kovisiooni 1–8 rada;
- kohtumise taimer;
- Paus;
- Vajan tuge;
- sessiooni juhi ajutine roll;
- juhtumite edukuse protsent;
- töötajate edetabel;
- „lahendatud juhtumite” võrdlus;
- hääled ja like’id;
- avalik kliendilugu;
- teise inimese Kovisioonipaki avamisnupp;
- vana kovisioonilõuendi muutmistööriistad;
- automaatne Parimate praktikate avaldamine.

---

# 34. Ekraanitekstid

## 34.1. Päis

**Lõpetatud juhtumid**

> Siin on kovisioonisessioonid, mille aktiivne töö on lõpetatud. Juhtumi järgmine samm või järelvaade võib veel olla pooleli.

## 34.2. Otsing

> Otsi pealkirja, märksõna, juhtumi tooja või grupi järgi…

## 34.3. Tähelepanuala

**Vajab tähelepanu**

> {{arv}} järelvaadet või jätkuotsust vajavad tähelepanu.

## 34.4. Olekud

- Järelvaates
- Järelvaade vajab tähelepanu
- Järelvaade tehtud · ootab jätkuotsust
- Suletud
- Ootel jätkuks
- Praktikakandidaat
- Arhiveeritud

## 34.5. Põhitoimingud

- Vaata lõpetatud juhtumit
- Ava järelvaade
- Tee järelvaade
- Määra uus aeg
- Tee jätkuotsus
- Sulge teema
- Loo seotud Teemaseeme
- Ava jätkuteema
- Vaata praktikakandidaadi olekut
- Ava minu Kovisioonipakk
- Vaata säilitamise olekut
- Arhiveeri

---

# 35. Funktsionaalsed vastuvõtukriteeriumid

1. Lõpetatud juhtumid on eraldi põhileht.
2. Lehel puudub aktiivse kovisiooni 1–8 etapi rada.
3. Lehel puudub kohtumise taimer.
4. Lehel puudub sessiooni juhi ajutine roll.
5. Lehel kuvatakse kasutaja püsiv professionaalne roll.
6. Lehel on otsing ja filtrid.
7. Otsing töötab ainult kasutajale nähtavates andmetes.
8. Lehel on Minu juhtumid, Minu grupi juhtumid ja Kõik nähtavad vaated.
9. Lehel on kaardi- ja nimekirjavaade.
10. Järelvaate kalender on valikuline ning ligipääsetav ka nimekirjana.
11. Igal juhtumikaardil on olek.
12. Järelvaates juhtumil on järelvaate toiming.
13. Möödunud järelvaade saab neutraalse tähelepanuoleku.
14. Järelvaate tegemise järel saab tekkida olek **Ootab jätkuotsust**.
15. Vana kovisioonisessiooni ei avata muutmisrežiimis.
16. Juhtumi detailvaade avaneb eraldi alalehena.
17. Teise inimese Kovisioonipaki sisu ei saa avada.
18. Juhtumi tooja saab avada enda Kovisioonipaki.
19. Praktikakandidaadi täpne olek on kaardil nähtav.
20. Uus jätkuteema loob uue Teemaseemne ega muuda vana sessiooni.
21. Järelvaate kalender ei näita liigset tundlikku infot.
22. Lehel puudub juhtumite või töötajate edetabel.
23. AI ei otsusta juhtumi sulgemist.
24. Säilitamise olek on aus ja jälgitav.
25. Lehel on tühja tulemuse ja veaolekud.
26. Kõik toimingud on rollipõhised.
27. Põhilehe kaart jääb nähtavaks ka pärast detail-alalehel tehtud olekumuutust.
28. Juhtumi olek uueneb pärast järelvaate või jätkuotsuse kinnitamist.
29. Arhiveerimine ei kustuta juhtumit automaatselt.
30. Igal nähtaval toimingul on selles dokumendis kirjeldatud funktsioon.

---

# 36. Metoodilised vastuvõtukriteeriumid

1. „Lõpetatud” tähendab lõpetatud kovisiooniprotsessi, mitte garanteeritud lahendust.
2. Järelvaade seob kovisiooni päris töö ja õppimisega.
3. Samm võib olla tegemata professionaalselt põhjendatud viisil.
4. Järelvaade ei ole töötaja tulemuslikkuse hindamine.
5. Uus küsimus loob uue Teemaseemne.
6. Vana sessiooni hetktõmmist ei kirjutata tagantjärele ümber.
7. Praktikakandidaat ei ole automaatselt parim praktika.
8. Kovisioonipakk kuulub juhtumi toojale.
9. Grupiliikme nähtavus on piiratud üldistatud tulemustega.
10. AI ei määra juhtumi professionaalset tulemust.

---

# 37. Privaatsuse vastuvõtukriteeriumid

1. Juhtumikaart sisaldab ainult minimaalset üldistatud infot.
2. Detailne juhtumilugu ei ole põhilehel nähtav.
3. Teise inimese Kovisioonipaki sisu pole ligipääsetav.
4. Administraatori tehniline roll ei anna automaatselt sisulist ligipääsu.
5. Otsing ei leia andmeid, mida kasutajal pole õigust näha.
6. Järelvaate kalender ei sisalda kliendi või lapse nime.
7. Praktikakandidaadi olek ei avalda juhtumidetaile.
8. Teavitused ei sisalda tundlikku infot.
9. Säilitamise ja kustutamise olekud on täpsed.
10. Auditmetaandmed ei sisalda privaatset sisu.
11. Suletud sessiooni ei saa märkamatult muuta.
12. Jätkuteema ei kopeeri kogu vana juhtumilugu.

---

# 38. Visuaalse vastuvõtu kriteeriumid

1. Põhilehel pole 1–8 etapi rada.
2. Põhilehel on platvormi põhinavigatsioon.
3. Lõpetatud juhtumid on aktiivse lehena selgelt nähtav.
4. Juhtumikaartidel on selge infohierarhia.
5. Olek on nähtav teksti ja ikooniga.
6. Tähendus ei sõltu ainult värvist.
7. Järelvaate kalender ei domineeri lehte.
8. Parempoolne olekute selgitus on kokkupandav.
9. Puuduvad tulemuslikkuse skoorid ja edetabelid.
10. Klaaskaardid on loetavad ja taustast heledamad.
11. Sama visuaalne identiteet jätkub teistel põhilehtedel.
12. Pilt või prototüüp kujutab põhilehte, mitte Etapp 8 lõuendit.
13. Kasutaja profiilis on püsiv amet, mitte sessiooniroll.
14. Põhilehe abi nupp on **Abi**.
15. Teise inimese Kovisioonipaki juures puudub avamisnupp.

---

# 39. Seos järgmise eraldi dokumendiga

Käesolev dokument kirjeldab ainult:

> **Lõpetatud juhtumite põhilehte**

Eraldi dokumendis tuleb kirjeldada:

# Lõpetatud juhtumi detailvaade

Detailvaate osad:

- Kokkuvõte
- Järelvaade
- Seosed
- Andmed ja säilitamine
- Minu Kovisioonipakk
- Sessiooni ajalugu lugemisrežiimis

---

# 40. Lõplik lehe määratlus

> **Lõpetatud juhtumite põhileht ei ole vana kovisioonilõuendi arhiiv ega „lahendatud probleemide” edetabel. See on rollipõhine järelvaate ja professionaalse õppimise töölaud, mis näitab, mida kovisioonis otsustati, mida päriselt tehti, mida sellest õpiti ning kas teema suletakse, jätkub või üldistatakse praktikakandidaadiks.**
