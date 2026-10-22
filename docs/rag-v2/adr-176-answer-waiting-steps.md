# ADR-176 — Vastuse ootamise ajal näeb kasutaja päris samme. Neli kujundust ja kaart katsetamiseks

22.10.2026. Teostus Claude Opus 5.5. Omaniku soovid:
- „kas nii saab ka, et inimese ekraanile on kuvatud AI plaani koostamine kohe alguses“;
- „et ei oleks ainult S logo tiirlemas, vaid oleks selline haaravam vastuse ootamine“;
- „Otsin Sotsiaal.pro andmebaasist“;
- „selline läbipaistev kaart … sinna nõel“, „kui küsimuses on asukoht“;
- „Pane mulle sinna kuhugi 4 numbrit vestluse lehele“.

## Leid

- Esimene tekst tuleb mediaanis 21,7 s pärast saatmist (F2). Selle ajani näeb kasutaja ainult tiirlevat S-i ja teksti
  „Otsin ja kontrollin vastust…“.
- Server teab vahepeal palju:
  - plaani teemat ja kohta ~4,6 s juures;
  - mitu lõiku ja allikat otsing leidis ~8,5 s juures;
  - milliseid allikaid valik loeb ~14 s juures;
  - et vastust kirjutatakse.

## Otsus

- **Server (`service.js`, `m4PilotServer.js`).** Pöörde voos tulevad `step`-sündmused, mida näeb ainult küsija ise:
  - `plan`: teema, mis on plaani esimene päring või küsimus, ühel real ja kuni 90 märki, ning kohad;
  - `found`: lõikude ja allikate arv valiku kandidaatide seas;
  - `chosen`: valiku allikate pealkirjad, kuni 4, ja ülejäänute arv;
  - `writing`: vastuse kutse on teele saadetud.

  Kohad tulevad kontrollitud kohtadest (`placeLabels`): omavalitsuse nimi ja ID või sama nimega mõlemad omavalitsused.
  Koht, kus inimene ei ela, jääb välja.

  Sammud on ainult kuvamiseks. Midagi ei oota neid ja nende viga ei peata pööret. `plan` ei pea kohtade nimede
  lugemist ootama. Vanem klient jätab tundmatud sündmused vahele.
- **Klient (`m4PilotStream.js`, `useChatStream.js`).** Sammud jäävad ootava sõnumi juurde (`pilotSteps`) koos ajaga
  saatmisest. `waitView.js` teeb neist ühe vaate. Hilinev või puuduv samm ei jäta vaadet kinni, sest hilisem samm
  tähendab ka varasemaid.
- **Kujundused (`components/alalehed/chat/wait`).** Neli kujundust: märkmik, hingav S, kaardid ja tähtkuju. Need tegid
  ja vaatasid läbi kujundusagendid, lähtudes omaniku toast.
  - Kõik toimub vestluse enda kaardil ega sõltu taustast, tahvlist ega seinast. Omanik: „ei tohi olla seotud tausta
    efektiga“; tahvli kohale tuleb seinamaal.
  - Pärast vastuse algust jääb vastuse kohale üks vaikne rida, näiteks „Vaatasin 5 allikat · 21 s“, mis avab sammud
    koos aegadega.
- **Kaart (`PlaceMap.jsx`).** Kui plaan luges koha, ilmub läbipaistev Eesti kaart ja nõel kukub omavalitsuse kohale.
  Sama nimega linna ja valla korral tuleb kaks väikest nõela. Kaarte on kaks:
  - „ikoon“: platvormi väike Eesti kaart (`eesti_kontuurkaart_logo.svg`) suurelt ja ilma oma nõelata;
  - „kontuur“: täpne kontuurkaart (`eesti_kontuurkaart.svg`).

  Omavalitsuse keskuse koordinaadid on `municipalityPoints.js`-is (78 omavalitsust). Kontuuri kalibreerimiseks on
  kasutatud äärmuspunkte. Ikoonil kaardistatakse iga maismaa oma kastiga; mandri kaks mõõtkava erinevad 0,03 %.
- **Valija (`WaitVariantPicker.jsx`).** All vasakul on „Ootus 0 1 2 3 4 · Kaart ikoon / kontuur“. Seda näeb ainult
  administraator. 0 on praegune tiirlev S. Valik jääb sellesse brauserisse. Teised kasutajad näevad endist ootamist,
  kuni omanik valib.

## Kontroll

- **Kohalik (`adr176-check`).**
  - Teema lõikamine.
  - Voo `step`-sündmused: vigased jäävad vahele ja `onStep`-ita klient loeb vastuse edasi.
  - `pilotExchange` annab sammud edasi.
  - Vaade sammudest, mis tulevad hilja, vales järjekorras või puuduvad. Vigased kohad jäävad välja.
- **Kaart (`adr176-map-check`, `adr176-icon-map`).**
  - Kontuuril on kõik 76 maismaa omavalitsuse nõela kontuuri sees. Mõni ranna- või piirilinn on nihutatud veidi
    sisemaale.
  - Ikoonil on kõik mandri ja suurte saarte nõelad joonistatud maismaa sees.
  - Kihnu, Ruhnu, Muhu ja Vormsi saart kummalgi kaardil pole. Nende nõel jääb merre sinna, kus saar on.
- **Ülevaatus.** Kolm sõltumatut ülevaatajat vaatasid muudatust: integratsioon, tavakasutaja ja andmed ning
  ligipääsetavus ja jõudlus. Igale leiule tehti ümberlükkamise katse. Kõik kaheksa leidu olid madala või keskmise
  raskusega ja on parandatud:
  - teema ei ole kunagi kogu teema tekst. See on plaani päring või praegune küsimus; ebaõnnestunud plaani korral teemat
    pole; inglise ja vene keeles on teemaks küsimus ise;
  - `plan`-sammu ja kohanimede päringut ei tehta, kui keegi ei kuula, näiteks voota päringus;
  - kujundus tuleb ainult sõnumile, mille voog samme saadab. Mujal jääb tiirlev S;
  - kaartide pealkiri „Sain küsimusest aru“ tuleb ainult pärast plaani;
  - valitud allikad jäävad ekraanilugejale alles ka kirjutamise ajal;
  - valija mahub telefonis ekraanile ega kata sisestusriba.
- **Muu.** eslint muudetud failidel, `i18n:check`, `rag-cost` ja `rag-v2-pilot-crisis-route` testid läbisid. Uued
  CSS-failid parsivad lightningcss-iga hoiatusteta.
- **Serveris.** Proovipöördes kirjutatakse sammude ajad ja järjekord voost üles.

## Omaniku valik (22.10 õhtul) ja selle järel tehtu

- **Valik: kujundus 2 („Hingav S“) koos ikoonikaardiga.** Omanik: „vist meeldis variant nr 2 ja kaardi ikoon“. Valija
  eemaldati („ja need ka ära võtta“). Ootevaade on nüüd kõigile kasutajatele, kelle voog samme saadab.
- **Eemaldatud.** Kujundused 1, 3 ja 4, kontuurkaart, valija ning kokkuvõtterida vastuse kohal. Kokkuvõtterida luges
  omanik häireks („allika glitch üleval servas“). Koos nendega eemaldati ka kasutuseta tekstid.
- **S.** S on algusest täidetud, ilma kontuuri joonistamise, täitumise ja kumata. Omanik: „hele kuma S ümber kahtlane“,
  „S on seest tühi alguses ja täitub“. Alguses teeb S kolm pööret nagu platvormi enda S ja hingab siis vaikselt.
- **Info üleval, kaart all.** Omanik: „liiga kaardikeskne“, hiljem „kaart kaob ära ja siis on mingi rida all ja mingi
  rida üleval“ ning „kaart ehk on kuvatud selle akna all pool, et üleval kuvatakse info“. Ootekaardi järjekord ülevalt:
  1. S, olek ja detailirida (teema ja koht);
  2. info, korraga üks asi: otsingu ajal luup üle hämarate lehtede, siis leitud allikad väikeste lehtedena koos tekstiga
     „16 sobivat allikat“, siis valitud materjali nimekiri. Ala pole kunagi madalam kui lehed, nii et otsingu järel
     midagi ei hüppa;
  3. faktide rida otse info all;
  4. kaart, kui küsimuses on koht. Kaart jääb kogu ootamise ajaks paika ega jäta enam tühja kohta. Kui allikad on
     leitud, muutub kaart tuhmimaks, et loetav oleks info.

  Kui teema juba nimetab kohta („Harku valla koduteenus“), ei korrata kohta detailireal. Kahe võimaliku omavalitsuse
  korral kirjutatakse mõlemad, sest see on uus info.
- **Nõel.** Platvormi kaardiikooni nõela kuju. Täpp on kaardi tooni ja suurem: omanik „see auk peaks markeris suurem
  olema“.
- **Mullid.** Assistendi ja kasutaja mullil pole helendavat serva ega ülemist helki, alles on ainult vari.
- **Vaaterolli lüliti.** Aktiivne nupp on jälle esile tõstetud, sest primary-nupp ei erinenud pinnast. Sildi tekst on
  „Küsin kui: …“, mitte „Vastan kui“, sest administraator küsib valitud rollina.
- **Koht ka jätkuküsimuses ja kohata küsimusel.** Omanik: „kui on küsimus, kus ei ole asukohta mainitud?“, „tee veidi
  paremaks“.
  - Otsing saadab sammu `scope` omavalitsusega, mida ta päriselt kasutab. Kui seda pole, saadab ta mõlemad omavalitsused,
    mida sama nimi võib tähendada.
  - Kaart näitab seda omavalitsust. Kui see tuli varasemast sõnumist, mitte praegusest, on detailireal märge
    „(varasemast)“.
  - Otsingu ajal liigub luup üle hämarate lehtede, nii kohaga kui kohata küsimusel. Arvu näidatakse alles siis, kui
    otsing selle annab.
- **Arv ilma eksitava 36-ta.** Omanik: „see on veidi eksitav … alati näitab „leitud 36 lõiku““.
  - 36 on valiku kandidaatide lühinimekirja suurus (30 + 6 reservkohta) ja on alati sama.
  - Lehtede all on ainult „19 sobivat allikat“ (sobivad allikad lühinimekirjas). 36 lõiku ei mainita kuskil, ka mitte
    faktide reas: omanik „seda 36 lõiku ei pea mainima“. Kui palju otsiti, ütleb faktide rida.
- **Faktide rida.** Omanik: „võimalikult palju huvitavat infot … allikakirjed, otsingulõigud, teadmusdokumendid,
  omavalitsuste kirjed“. Info all vahetub iga 3,2 s järel üks rida, faktid saabumise järjekorras. Esimene on alati
  andmebaasi allikakirjete ja otsingulõikude arv (omanik: „allikakirjeid ei mainitud“, sest varem hüppas rida kohe
  uusimale faktile). Kõik arvud on selle küsimuse omad:
  - andmebaasi allikakirjed ja otsingulõigud (kataloogi read ja nende üksused);
  - küsimuse ulatuses olevad teadmusdokumendid ja nende lõigud;
  - omavalitsuste kirjed kokku ja küsitud omavalitsuse kirjed;
  - asjakohased kirjed (`records`-samm pärast otsingut);
  - lugemiseks valitud allikad.
