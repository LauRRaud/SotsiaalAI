# ADR-122: tasuta otsingukontroll enne väljalaset

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (ehitas agent, üle vaatas teine agent, serveri käivitused ja parandused minult). Seis: **käsk töötab päris indeksil; lähteseis on salvestatud; midagi ei ostetud.**

## Probleem

Otsingu muudatusi kontrolliti käsitsi käivitatud tasuliste vestlusjooksudega ja ühekordsete proovidega. Igaüks neist ehitas otsingu ise uuesti kokku, kindla profiili ja kuupäevaga, ning ükski ei käivitanud vestluse enda otsingut (`unifiedSearch`). Enne väljalaset ei olnud tasuta viisi küsida: kas otsing läks halvemaks?

## Otsus

Käsk `scripts/rag-v2-search-gate.mjs` kahe tegevusega (reeglid failis `scripts/lib/rag-v2-search-gate.mjs`):

- **`record`** käib läbi kindla küsimuste komplekti (graafikataloogid, `tests/evaluation/graph/*.json`) **salvestatud päringuvektoritega** vestluse enda otsingu kaudu: teadmusrada, kirjete rada, perioodirajad. Valiku mudeli asemel on konks, mis jätab kandidaadid meelde ja ei vali midagi. Tulemus on üks rida küsimuse kohta.
- **`compare`** teeb sama uuesti (tavaliselt kattekaustas oleva muudetud koodiga) ja annab iga küsimuse kohta otsuse: otsustav lõik kadus kandidaatide seast; selle koht läks halvemaks; mitu kandidaati tuli ja läks; mitu kohta võtab suurim dokument; kirjete vaade, omavalitsus või kokkuvõtete arv muutus. Väljumiskood 0 (sama või parem), 10 (erinevusi, mida lugeda), 20 (otsustav lõik kadus või viga), 2 (keeldus).

**Ei mudelit, ei vektoriostu, ei andmebaasi kirjutamist.** Kolm kaitset: käsk lubab võrgupäringu ainult vektoriandmebaasi aadressile; küsimus, mille mõne teksti vektor puudub, jäetakse vahele ega osteta; plaan loetakse ainult lugemiseks.

**Rida ei hoia teksti.** Küsimuse tunnus kataloogist, lõikude ja pealkirjade räsid, kohad, arvud ja ajad. Ei küsimuse teksti, lõigu teksti, pealkirja ega kirje tunnust.

**Võrdlus keeldub**, kui lähteseis ja praegune jooks erinevad selles, mis otsingut otsustab (indeksi põlvkond, dokumentide loend, profiil, kirjekanali ja otsinguabi versioon, vektorimudel, kuupäev), kui lipp seda ei luba. Plaani enda räsi ei võrrelda: iga väljalase uuendab plaani.

## Mida see näeb ja mida mitte

Näeb muutust ulatuses (kehtivus, omavalitsus), sõna- ja vektorikanalis, liitmises, kandidaatide koosseisus ja reservis, viidete järgimises, kirjete rajas.

**Ei näe midagi, mida otsustab mudel:** otsinguplaani päringuid, isikut ja kohti, valikut ega vastust. Kataloogi päringud on kindlad, mitte plaani omad. Mudeli osa jaoks jääb tasuline kontroll.

## Esimene käivitus päris indeksil (10.10.2026)

- Lähteseis töötaval väljalaskel: neli kataloogi, **33 küsimust, kõik läbi käidud**, 0 vahele jäetud, 0 viga; iga küsimus umbes 25 sekundit. Salvestatud vektorid 30.09–02.10 olid serveris alles.
- **Esimene võrdlus:** seadusesätte sildi kood (ADR-123, eraldi muudatus) kattekaustas lähteseisu vastu: **33 küsimust 33-st „sama“**, ükski otsustav lõik ei kadunud ega nihkunud, väljumiskood 0. Päis näitas, et otsingu moodulid laaditi kattekaustast, mitte väljalaskest. Silt on vastuse mudelile mõeldud märkus, mis otsingut muuta ei tohigi; kontroll kinnitas seda. Küsimus võttis teisel jooksul umbes 5 sekundit (esimesel 25: esimene jooks kontrollis allikad üle).
- Kattekausta reegel sai kinnitust juba varem samal ööl (ADR-121): muudetud moodul peab kattekaustas olema koos kõigi moodulitega, mis seda suhtelise teega impordivad, muidu laeb Node väljalaske oma faili. Käsk kirjutab nüüd jooksu päisesse, kust otsingu moodulid tegelikult laaditi (`search_roots`).

## Kontrollitud

- Ühiktestid koos teiste öö muudatustega: 1337, neist 1315 läbi; 11 testi kontrolli kohta (rida ei sisalda näidistekste ega pealkirju; iga otsuse tekitab see muutus, mis peab; muutmata jooks on „sama“; keeldumine teise põlvkonna või kuupäeva korral). Ehitaja murdis oma 23 reeglit ükshaaval ja iga murdmine kukutas vähemalt ühe testi.
- Sõltumatu ülevaatus: kolm leidu. Serveri käivitaja ei anna käsu väljumiskoodi edasi (otsus loetakse kokkuvõtte realt või aruandefailist; kirjas käsu päises); reservi alguskoht jääb serveris tühjaks (ühtki otsust see ei mõjuta); kattekausta lõks ei olnud näha (parandatud väljaga `search_roots`).

## Kontrollimata ja lahti

- **Müratase** sama koodi kahe jooksu vahel on eraldi mõõtmata; esimene võrdlus (muudetud kood, mis otsingut ei puuduta) andis 33/33 sama, mis näitab, et kordus on stabiilne.
- Viies kataloog (`maintenance-duty-1`) on komplektist väljas: selle vektorite asukoht serveris ei ole kirjas.
- Salvestatud testpöörete kirjete raja kordus (ADR-121 tööriist) ei ole veel selle käsu osa.
