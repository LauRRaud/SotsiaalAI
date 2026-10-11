# ADR-144 — Teenuseosutaja profiil jõuab vestlusse

11.10.2026. Teostus Claude Opus 5.5. Omanik 11.10: kas teenuseosutaja (näiteks tugiteenuseid pakkuv väike ühing) jõuab profiili täites andmebaasi ja vestluses nähtavale; ta eelistab, et osutajad hoiavad oma andmeid ise, mitte et meie nende lehti kogume.

**Seis 11.10.2026 õhtul: ühendatud.** Omanik otsustas samal päeval: „Teenuseosutaja tuleb nimetada ka vestluses, kes on profiili täitnud ja paneb linnukese, et on leitav kaardil ja eraldi linnuke, on leitav vestluses.“ Vestlus loeb nüüd küsimuse hetkel nende osutajate profiile, kes on avaldanud profiili ja pannud linnukese „Leitav vestluses“ (jaotis „Ühendatud vestlusega“). **Mudeliga ei ole seda mõõdetud:** kontrollitud on koodi testidega; tasuline vastuste kontroll ootab omaniku luba.

Allpool on kavand nii, nagu see enne otsust kirja sai; mis sellest on nüüd ehitatud ja mis jäi ettepaneku tasemele, ütleb jaotis „Ühendatud vestlusega“.

## Lähteseis (kontrollitud koodist, `origin/main` 11.10)

- Profiili salvestamine kirjutab teenusekaardi kirje (`lib/serviceProviderProfiles.js`, `serviceMapEntry.upsert`). Assistendi jaoks pandi töö järjekorda ainult siis, kui vana otsing oli olemas ja profiil oli avaldatud ning osutaja oli andnud loa (`assistantRecommendationAllowed`).
- Vana otsing on kinni: `lib/rag/retired.js` ütleb `RAG_AVAILABLE = false` ja `lib/serviceProviderProfileRagJobs.js` ainult keeldub. Vana tee nõusolekuvärav (`lib/privacy/serviceProfileRetrievalGuard.js`) ja koopia eemaldus (`lib/privacy/serviceProfileRagRemoval.js`) on alles, aga neid ei kutsu enam miski.
- Praegune vestlus (`lib/rag-v2`) loeb teenusekaardi tabelist ainult omavalitsuste kontakte (`adapters/municipal-directory.js`, `adapters/verified-municipal-contact.js`). Teenuseprofiile ei loe ükski rada.
- **Järeldus:** osutaja, kes täitis profiili, andis loa ja avaldas, on teenusekaardil, aga vastusesse jõuda ei saa. Vormi tekst lubab seejuures, et „avaldatud teenusekirjed lisatakse AI teadmuskihile“.

## Loendus (server, 11.10, ainult lugemine, arvud ilma nimedeta)

| | |
|---|---|
| Profiile kokku | 1 |
| Avaldatud | 0 |
| Assistendi loaga | 0 |
| Teenuseid, teeninduskohti | 0 |
| Teenusekaardi kirjeid osutaja kohta | 1, peidetud |
| Omavalitsusi registris | 78 (15 maakonda) |

Ainus profiil oli omaniku enda augustikuine mustand. **Päris osutajate andmeid ei ole,** seega ei saa veel öelda, milliseid välju osutajad täidavad. Loendus on korratav (jaotis „Loendus“ allpool).

Pärast sama päeva proovi (järgmine jaotis) on samas profiilis ühe ühingu andmed: avaldatud, assistendi loaga, üks teenus ja üks teeninduskoht.

## Kontroll päris lehel (omaniku palvel, 11.10, tema kontoga)

Omanik andis ühe tegevusloaga ühingu avalikud registriandmed. Teenuseosutaja rollis:

- profiil, teeninduskoht ja üks teenus salvestusid; aadressiotsing andis ametliku vaste;
- tegevusloa kontroll toimis: liik kinnitatud, register vastas umbes poole minutiga „tegevusluba on registris olemas“;
- avaldamine peatus, nagu peab: registrikoodiga profiili ei avaldata enne, kui on kinnitatud, et konto esindab asutust (#666);
- **halduri kinnitus ei töötanud:** leht vastas „Sul puudub selle tegevuse jaoks õigus“. Päritolu kontroll võrdles brauseri aadressi serveri sisemise aadressiga ja keeldus päris serveris igast päringust; sama viga takistas veel kolme tegevust (kinnituslink, kättesaadavuse kinnitus, halduri kättesaadavuse leht). Parandatud samal päeval (#673).

Pärast parandust: omaniku valikul kinnitas haldur esindusõiguse (alus on kirjas halduri lehel), profiil avaldus koos teenusekaardi ja assistendi loaga, asutus on teenusekaardil näha (marker, maakond, teenus, märgis „tegevusluba kontrollitud“). Ühingule ei saadetud ühtki kirja: omaniku sõnul ei tohi seda praegu teha, seepärast kasutati halduri kinnitust, mitte kinnituslinki, ja profiili eelpöördumised on välja lülitatud.

Pöörduja rollis küsiti kaks korda „kes pakub selles vallas seda teenust“: enne avaldamist ja pärast seda. **Mõlemal korral ei nimetanud vestlus seda osutajat.** Esimene vastus ütles, et olemasoleva info põhjal ei saa kinnitada, kes teenust praegu osutab, ning viitas 2022. aasta projektikirjeldusele ja valla sotsiaaltöö spetsialistile. Avaldatud, loaga ja tegevusloaga profiil samas vallas vastust ei muutnud. See on auk, mille see ADR kirjeldab.

## Kaks teed

Taust, mis otsust mõjutab: vestluse iga lause allikas on praegu korpuses hoitav tekst. Vastuse viide (`S1`, `S2` …) seotakse dokumendi versiooni, lõigu ja teksti räsiga ning kontrollitakse korpuse vastu nii vastamisel kui vana vestluse avamisel (`search/model-context.js`). Omavalitsuse kontaktid on samuti korpuse dokumendid; register otsustab ainult selle, kas kontakti tohib praegu näidata.

| | (a) Lugemine andmebaasist küsimuse hetkel | (b) Profiil korpuse dokumendina |
|---|---|---|
| Uus profiil vestluses | kohe pärast avaldamist | pärast järgmist korpuse täiendust |
| Muudetud profiil | kohe | kuni täienduseni kas peidus (seos lõpeb) või vana tekstiga |
| Loa tagasivõtmine | kohe; koopiat ei ole | näitamine lõpeb kohe (värav), koopia jääb indeksisse täienduseni |
| Kulu muudatuse kohta | 0 | embedding'u ost (profiil umbes 0,0003 USD) |
| Töö muudatuse kohta | ei ole | eksport, sissevõtt, ülevaatus, avaldamine, pakk, ost, uus plaan, taaskäivitus: praegu käsitöö, iga ost omaniku loal |
| Küsimuse ja osutaja sobitus | teenuse liik ja piirkond; vektorit ei ole | vektor ja sõnaotsing nagu muul tekstil |
| Mida tuleb ehitada | uut liiki allikas vestluse tuumas (kontekst, viide, vastuse kontroll, ajalugu, allikavaade) | eksport ja elav värav teadmusrajale; tuum jääb samaks |
| Üleriigiline teenus | üks rida | kirjete rajal üks dokument iga omavalitsuse kohta (78) või eraldi lahendus teadmusrajal |

### Soovitus: (a)

Omaniku eesmärk on, et osutaja hoiab oma andmeid ise. Teel (b) ei oleks tema muudatus vestluses enne, kui keegi teeb korpuse täienduse, ja kirjavea parandus võtaks ta seniks vestlusest ära. Automaatset täiendust ei ole ning see tähendaks omaniku püsivat luba ostudeks. Tee (a) hind on ühekordne: vestluse tuum peab õppima allikat, mis ei ole korpuse tekst. See on suurem töö kui (b) eksport, aga pärast seda ei maksa ükski profiilimuudatus midagi ega oota kedagi.

Kui ühes omavalitsuses on kunagi kümneid osutajaid ja liigi järgi sobitusest ei piisa, saab teele (a) lisada vektori (ost teenuse salvestamisel, umbes 0,00002 USD). See on hilisem otsus.

## Kuidas (a) töötaks

1. **Kus.** Otsingus (`pilot/retrieval.js`, `unifiedSearch`) jooksevad kõrvuti teadmusrada ja omavalitsuse kirjete rada. Kolmas rada loeb rakenduse andmebaasist selle omavalitsuse osutajad, mille pööre juba välja selgitas. Lugeja on adapter nagu `municipalDirectoryAdapter`.
2. **Kes.** Ainult värava läbinud profiilid (jaotis „Ehitatud“): avaldatud, loaga, registrikoodi korral kinnitatud esindusõigusega, vähemalt ühe avaliku teenusega.
3. **Mida näidatakse.** Mitte midagi, mida avalik teenusekaart selle osutaja kohta ei näita. Täpne loend on omaniku otsus (1. otsus).
4. **Sobitus.** Piirkond: teenus katab pöörde omavalitsust (omavalitsus, selle maakond või üleriigiline; jaotis „Piirkonna lugemine“). Liik: esimeses versioonis antakse mudelile piiratud arv selle koha osutajate ridu (teenuse nimi, kategooria, piirkond), kitsama piirkonnaga ees; mudel valib nagu omavalitsuse teenuste pealkirjade seast. Otsinguplaani ei muudeta.
5. **Viide.** Osutaja kirje avalikul teenusekaardil: `/teenusekaart?entryId=<kirje>`. Avalikku profiililehte platvormil ei ole. Kaardil nähtamatu osutaja kohta linki anda ei saa (4. otsus).
6. **Kontroll kolmel hetkel**, nagu kontaktidel: lugemisel, enne vastuse näitamist ja vana vestluse avamisel. Luba tagasi võtnud osutajat allikana uuesti ei näidata.
7. **Vananenud info.** Teenuse kättesaadavust („võtab uusi pöördumisi vastu“) ütleb vastus ainult siis, kui osutaja on seda viimase 28 päeva jooksul kinnitanud (olemasolev reegel `lib/serviceAvailability.js`; meeldetuletuse saadab `lib/serviceAvailabilityReminders.js`). Muul juhul vastus kättesaadavusest ei räägi. Terve profiili kohta aegumist praegu ei ole (5. otsus).
8. **Sõnastus.** Assistent nimetab osutajat kui seda, kes oma sõnul seal seda teenust pakub. Ta ei soovita, ei võrdle ega hinda. Vastus ütleb, et info on osutaja enda antud.

Kulu: ostu ei ole. Vestluse kontekst kasvab iga näidatud osutaja võrra hinnanguliselt 60–100 tokenit (mõõtmata). Kontekstireegli ja vastuse juhise muutus vajab väikest tasulist kontrolli (mõni pööre, mõni sent) ja omaniku luba selleks.

## Värav, piirkonna lugemine ja loendus

### Värav: `lib/serviceProviderAssistantGate.js`

`assistantProfileGate(profile)` ütleb, kas profiili tohib assistendile näidata, ja nimetab kõik takistused:

- profiil ei ole avaldatud;
- luba puudub (loeb ainult täpne `true`);
- registrikoodiga profiilil ei ole selle koodi kohta kinnitatud esindusõigust (sama reegel mis avaldamisel, `representationState`);
- avalikku teenust ei ole (sama reegel mis teenusekaardil, `publicServiceProviderServices`).

Kahtluse korral on vastus „ei“. Midagi ei kopeerita, seega mõjub loa tagasivõtmine järgmisel lugemisel. Värava väljavalik (`ASSISTANT_GATE_SELECT`) ei loe kontakte, hindu ega kirjeldusi.

`assistantServices`, `assistantServicesForMunicipality` annavad lubatud profiili avalikud teenused koos piirkonna ja kättesaadavuse värskusega; `assistantMapLink` annab teenusekaardi lingi, kui kirje on kaardil avalik.

### Piirkonna lugemine: `lib/serviceProviderServiceArea.js`

Vorm küsib piirkonna tüüpi valikuna. Maakond ja omavalitsused valitakse alates 11.10.2026 omavalitsuste registrist (salvestub täisnimi „Elva vald“ ja maakond kujul „Tartumaa“); varasemad profiilid võivad kanda käsitsi kirjutatud sõnu. Moodul loeb mõlemad omavalitsuste registri vastu:

| Vormi tüüp | Loetakse |
|---|---|
| Üleriigiline, Veebiteenus | iga omavalitsus |
| Maakondlik | teenuse maakond; kui see on tühi, profiili maakond lugemise hetkel. „Harjumaa“, „Harju maakond“ ja „Harju“ on sama |
| KOV põhine | teenuse (või profiili) omavalitsused: täisnimi, tunnus või ühene lühinimi |
| Teeninduskoha põhine | teenuse avalike teeninduskohtade maakond, mille server loeb koha ametlikust aadressivastest; aadressivasteta koha puhul teenuse või profiili maakond |
| Täpsustamata | kitsaim märgitud: omavalitsused, muidu maakond |

Midagi ei oletata: kirjeldustest piirkonda ei loeta. Sõna, mida register ei tunne, ja nimi, mis sobib kahele omavalitsusele („Tartu“), ei kata ühtki kohta; sellised sõnad loetakse kokku. Teadmata piirkonnaga teenust ei pakuta ühegi koha küsimusele.

### Loendus: `scripts/service-profile-assistant-count.mjs`

Tasuta ja ainult lugev: mitu profiili värava läbib, mis teisi takistab, mis piirkonda teenused katavad, mitu piirkonnasõna jäi lugemata, mitu omavalitsust on kaetud ja millised väljad on lubatud profiilidel täidetud. Väljastab arvud, mitte nimesid. Serveris töötava väljalaske kaustas ja selle keskkonnafailiga:

```
node --env-file=<väljalaske env> --import ./scripts/register-node-source-loader.mjs scripts/service-profile-assistant-count.mjs
```

### Kontrollid

`tests/service-provider-assistant-gate.test.mjs` (18 testi, andmebaasita): värav on fail-closed; registrikoodi kinnitus; avaliku teenuseta profiil; piirkonna iga tüüp; kahemõtteline ja tundmatu nimi; omavalitsuse küsimusele ainult seda katvad teenused; link ainult avaliku kaardikirje korral; loendus ei sisalda nimesid; värav ei loe kontakte ning vestluse tuum loeb profiile ainult lugeja kaudu.

## Ühendatud vestlusega (11.10.2026)

### Omaniku otsus ja kuidas seda loeti

Omaniku sõnad: „Teenuseosutaja tuleb nimetada ka vestluses, kes on profiili täitnud ja paneb linnukese, et on leitav kaardil ja eraldi linnuke, on leitav vestluses.“ Sellest on otsustatud:

- **tee (a):** profiil loetakse andmebaasist küsimuse hetkel, korpusesse seda ei viida;
- **2. otsus:** vestlus *nimetab* osutajat, ei soovita;
- **4. otsus:** kaks linnukest on eraldi. Teostaja luges seda nii, et kumbki ei eelda teist: vestluses leitav osutaja ei pea olema teenusekaardil. Sellist osutajat nimetatakse ilma kaardilingita. Kui omanik mõtles teisiti (vestluses ainult see, kes on ka kaardil), on see ühe tingimuse lisamine väravasse.

Ülejäänud otsused (1, 3, 5, 6, 7) on tehtud nii, nagu see ADR ette pani; need on allpool kirjas ja omanik saab iga neist muuta. 8. otsus (tasuline kontroll) on tegemata.

### Vorm

Profiili vaates „Avaldamine“ on kaks linnukest uute nimedega: **„Leitav teenusekaardil“** (`mapVisible`) ja **„Leitav vestluses“** (`assistantRecommendationAllowed`). Vestluse linnukese selgitus ei luba enam „AI teadmuskihti“ ega soovitamist: „Vestluse assistent nimetab sinu asutust, teenuseid ja üldkontakti inimesele, kes küsib teenust sinu piirkonnas. Ta ei soovita ega võrdle osutajaid.“ Avaldamise kontrolli read ütlevad sama sõnaga („leitavaks märgitud“, „leitavus on välja lülitatud“). Tekstid on kolmes keeles. Andmebaasi välju ei muudetud.

### Mida osutaja kohta näidatakse (1. otsus, ettepaneku järgi)

Loend on ühes kohas, `lib/rag-v2/adapters/service-providers.js`, ja lugeja ei küsi andmebaasist muid välju:

- asutuse nimi;
- iga teenuse kohta, mis küsimuse omavalitsust katab: nimi, valdkond, piirkond (omavalitsuste nimed, maakond või „üleriigiline“), tasu liik ja osutaja enda hinnamärkus, teenusele saamine (otse pöördumine, omavalitsuse hindamine või otsus, Sotsiaalkindlustusameti või spetsialisti suunamine);
- kättesaadavus („võtab uusi pöördumisi vastu“ jms) ainult siis, kui osutaja kinnitas seda viimase 28 päeva jooksul, koos kinnitamise päevaga;
- asutuse üldtelefon, e-post ja veebiaadress;
- lause „Andmed on teenuseosutaja enda sisestatud Sotsiaal.pro teenuseprofiili.“

**Ei näidata:** kirjeldusi, kontaktisiku nime, tegevusloa märgist, teeninduskoha aadressi. Osutaja vabatekst (nimi, hinnamärkus) pannakse ühele reale ja lõigatakse pikkuse järgi.

### Kuidas see töötab

1. **Lugeja** (`lib/rag-v2/adapters/service-provider-directory.js`) küsib andmebaasist avaldatud ja linnukesega profiilid ning laseb igaühe läbi värava (`assistantServicesForMunicipality`). Midagi ei kopeerita ega hoita vahemälus: linnukese mahavõtmine mõjub järgmisel lugemisel.
2. **Rada otsingus** (`pilot/retrieval.js`, `unifiedSearch`): teadmusraja ja omavalitsuse kirjete raja kõrval loetakse selle omavalitsuse osutajad, mille pööre välja selgitas (ka siis, kui küsitakse teise omavalitsuse kohta, ADR-074). Ilma omavalitsuseta pöördes, tervituses ja tänus rada ei jookse. Lugemise viga ei peata vastust: sel juhul ei nimetata kedagi.
3. **Järjekord ja piir** (3. otsus, ettepaneku järgi): kitsama piirkonnaga osutaja ees, siis nimi tähestikus. Tasu ega miski, mille eest saaks maksta, järjekorda ei mõjuta (test vahetab tasud ära ja järjekord jääb samaks). Korraga kuni 8 osutajat, igaühelt kuni 3 teenust.
4. **Allikas ja viide.** Iga osutaja on pöördes üks allikas oma viitega (S-number) nagu iga teine. Tema „dokument“ on `service-provider:<profiil>/<omavalitsus>` ja versioon näidatud teksti räsi. Osutajate allikad seisavad paketis pärast kõiki korpuse allikaid, nii et korpuse viidete numbrid ja kontroll on samad mis ilma rajata (`splitProviderEvidence`); osutaja viiteid kontrollitakse värava, mitte korpuse vastu.
5. **Mudeli kontekst** (`search/model-context.js`, sama json-5): osutaja väljavõte (`ref`, `source`, `text`), allikakaart `source_type: service_provider_profile` ja plokk `providers` (millised viited, mis omavalitsus, „ainult need, kes profiili sisestasid“). Pöörde kontekst, kus osutajaid ei ole, on täht-tähelt sama mis enne.
6. **Juhis** (`pilot/dialogue.js`, juhise versioon 43): ainult pöördele, mille kontekstis on osutajad. Nimeta osutaja, kelle teenus küsimusega sobib, sellega, mida tema väljavõte annab, ja ütle üks kord, et andmed on osutaja enda omad; ära soovita, võrdle, järjesta ega kiida; ära ütle, et teisi osutajaid ei ole; kättesaadavust ütle ainult väljavõtte järgi; osutaja väljavõte ei tõenda ühtki reeglit ega õigust; kui ükski teenus ei sobi, ära osutajaid maini. Iga teise pöörde juhis on sama mis versioonis 42.
7. **Kontroll kolmel hetkel.** Lugemisel (värav), enne vastuse küsimist ja enne avaldamist (`canonicalPacket` küsib iga viidatud osutaja väravast uuesti; lahkunud osutaja peatab pöörde koodiga `service_provider_access_changed`) ning vana vestluse avamisel. Erand: varasem vastus, millelt vestlus jätkub, on vestlus, mitte tõend, ja lahkunud osutaja ei takista inimese järgmist küsimust.
8. **Vana vastus pärast lahkumist** (7. otsus, ettepaneku järgi): vastuse tekst jääb inimese vestlusse. Osutajat allikana enam ei näidata: allika nime asemel on „Teenuseosutaja profiil (ei ole enam vestluses leitav)“, teksti ega linki ei anta. Pöörde püsikirje (ADR-094) kaardilinki ei hoia.
9. **Vestluse aken.** Allikate loendis on osutaja allika juures „teenuseosutaja enda andmed“. Kui osutaja on ka teenusekaardil, on vastuse all link „<nimi> teenusekaardil“ (`/teenusekaart?entryId=…`), mis loetakse igal avamisel uuesti. Allikavaade näitab osutaja teksti ainult seni, kuni profiil sama omavalitsuse kohta sama ütleb; pärast muutust ütleb vaade, et allikas on muutunud, ja viib praeguse kaardikirje juurde.
10. **Lüliti.** `RAG_V2_SERVICE_PROVIDERS=0` võtab lugeja ära ilma väljalasketa: vestlus ei nimeta siis kedagi ja osutajat viidanud pööre näidatakse püsikirjest.

### Maht (loetud vestluse tokeniseerijaga väljamõeldud profiilidel)

| | tokenit |
|---|---|
| Juhis (ainult osutajatega pöördes) | 287 |
| Osutaja ühe teenusega, ainult nimed | 54 |
| Osutaja ühe teenusega, kõik väljad täidetud | 182 |
| Osutaja kolme täidetud teenusega | 416 |
| Rada suurimal kujul (8 osutajat, igaühel 3 teenust) | umbes 3300 |

Ostu ei ole. Kui kontekst on ilma rajata juba täis, saadetakse see ilma osutajateta.

### Kontrollitud ja kontrollimata

Kontrollitud testidega, mudelita (`tests/rag-v2-service-providers.test.mjs`, 16 testi; `tests/rag-v2-search-gate.test.mjs`, rada läbi vestluse päris otsingu mälus hoitava indeksi peal): näidatavate väljade loend; kättesaadavus ainult värskena; värav (avaldamata, linnukeseta, kinnitamata esindusõigusega, avaliku teenuseta profiili ei loeta); kaardil nähtamatu osutaja ilma lingita; piirkond; järjekord ei sõltu tasust; korpuse viidete numbrid ja kontroll ei muutu; muudetud osutajatekst lükatakse tagasi; lahkunud osutaja peatab pöörde, aga mitte järgmist küsimust; allikavaade ja püsikirje; juhis ainult osutajatega pöördes.

**Kontrollimata:** kuidas mudel juhist päriselt järgib (kas nimetab, kui sobib; kas jätab mainimata, kui ei sobi; kas hoidub soovitamast). See vajab tasulist kontrolli (8. otsus), mille teeb omaniku loal: mõni pööre ühe proovi-profiiliga, mõni sent.

### Mis jäi tegemata ja miks

- **5. otsus (vana profiil):** terve profiili aegumist ei ole; ainult kättesaadavus aegub 28 päevaga. Ettepanek (12 kuud kinnitamata profiil langeb vestlusest välja) vajab omaniku sõna ja meeldetuletuse kirja.
- **6. otsus (organisatsiooni profiil):** värav on muutmata: registrikoodiga profiil vajab kinnitatud esindusõigust.
- **Omavalitsuseta küsimus:** kui pöördes ei ole omavalitsust, ei nimetata ka üleriigilise piirkonnaga osutajat.
- **Liigi sobitus on mudeli teha:** talle antakse selle koha osutajad (kuni 8) ja ta valib teenuse nime ja valdkonna järgi. Kui ühes kohas on osutajaid rohkem, jäävad tähestikus tagumised välja; siis on vaja sobitust teenuse liigi järgi (kavandi „hilisem otsus“).
- **Üle 500 profiili** korraga rada ei loe (ütleb, et kedagi ei ole): selle arvuni jõudes tuleb piirkonna valik viia andmebaasipäringusse.
- **Mõõtetööriistad** (otsinguvärav, tasuline küsimuste kontroll) loovad vestluse otsingu ilma lugejata ega näe osutajaid enne, kui neile lugeja antakse.

## Piirid ja kõrvalleiud

- **Vorm küsis omavalitsusi vabatekstina; alates 11.10.2026 valitakse need registrist.** Profiili vaates „Tegevuspiirkond“ ja teenuse vaates „Teenuse piirkond“ valib osutaja maakonna ja omavalitsused loendist (`components/workspace/serviceProfile/ProfileFields.jsx`, `AreaFields`; reeglid `profileModel.js`). Varem käsitsi kirjutatud sõna, mida register ei loe, jääb vormis näha ja maha võetavaks ning vaade ütleb, et see ei ole loendist valitud. Avaldamise kontroll näitab mitteblokeeriva reana KOV põhist teenust, millel ei ole ühtki loetavat omavalitsust, ja maakondlikku teenust, millel ei ole maakonda. Loenduse väli `unreadAreaWords` jääb uute sisestuste puhul nulli.
- Teeninduskohal ei ole omavalitsust, ainult aadress ja maakond: teeninduskoha põhine teenus loetakse maakonna täpsusega. **Koha maakond tuleb alates 11.10.2026 ametlikust aadressivastest** (`countyFromOfficialAddress`: „Lossi tn 1, Põltsamaa linn, Põltsamaa vald, Jõgeva maakond“ → „Jõgevamaa“), mitte profiililt: kohal ei ole vormis maakonna välja ja profiililt päritud maakond jäi valeks, kui profiili maakonda hiljem muudeti. Olemasolev koht saab õige maakonna järgmisel salvestamisel; aadressivasteta kohal oma maakonda ei ole. Samast aadressist saaks lugeda ka omavalitsuse (teeninduskoha põhine teenus kataks siis ühe omavalitsuse, mitte maakonna): see on omaniku otsus ja tegemata.
- **Teenuse tühi maakond tähendab „sama mis profiilil“.** Server ei kopeeri enam profiili maakonda teenusele: koopia ei lasknud maakonda tühjaks jätta ja jäi valeks, kui profiili maakond muutus. Lugeja võtab profiili maakonna lugemise hetkel. Teenusekaardi vabasõnaotsing loeb seepärast ka profiili maakonda; maakonna filter teenuse maakonda ei kasutanud. Varem kopeeritud maakond jääb teenusele alles, kuni osutaja valib „Sama mis profiilil“.
- Vana tee jäänused (`serviceProfileRetrievalGuard`, `serviceProfileRagRemoval`, tabel `ServiceProviderProfileRagJob`, 0 rida) on puutumata.
- Esindusõiguse reeglit (#666, #668) ei muudetud.
