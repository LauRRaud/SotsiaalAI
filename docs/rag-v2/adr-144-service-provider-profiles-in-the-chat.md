# ADR-144 — Teenuseosutaja profiil jõuab vestlusse: kavand ja ettevalmistatud osad

11.10.2026. Teostus Claude Opus 5.5. Omanik 11.10: kas teenuseosutaja (näiteks tugiteenuseid pakkuv väike ühing) jõuab profiili täites andmebaasi ja vestluses nähtavale; ta eelistab, et osutajad hoiavad oma andmeid ise, mitte et meie nende lehti kogume.

**Kavand. Vestlus teenuseprofiile praegu ei loe.** Ehitatud on ainult osad, mis ei vaja omaniku otsust (värav, piirkonna lugemine, loendus); vestlusega need ühendatud ei ole. Mudeliga midagi mõõdetud ei ole, peale ühe päris küsimuse omaniku palvel (jaotis „Kontroll päris lehel“).

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

## Ehitatud (otsust ei vaja; vestlus ei kasuta)

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
| Maakondlik | teenuse (või profiili) maakond; „Harjumaa“, „Harju maakond“ ja „Harju“ on sama |
| KOV põhine | teenuse (või profiili) omavalitsused: täisnimi, tunnus või ühene lühinimi |
| Teeninduskoha põhine | teenuse avalike teeninduskohtade maakond (kohal on aadress ja maakond, omavalitsust ei ole) |
| Täpsustamata | kitsaim märgitud: omavalitsused, muidu maakond |

Midagi ei oletata: kirjeldustest piirkonda ei loeta. Sõna, mida register ei tunne, ja nimi, mis sobib kahele omavalitsusele („Tartu“), ei kata ühtki kohta; sellised sõnad loetakse kokku. Teadmata piirkonnaga teenust ei pakuta ühegi koha küsimusele.

### Loendus: `scripts/service-profile-assistant-count.mjs`

Tasuta ja ainult lugev: mitu profiili värava läbib, mis teisi takistab, mis piirkonda teenused katavad, mitu piirkonnasõna jäi lugemata, mitu omavalitsust on kaetud ja millised väljad on lubatud profiilidel täidetud. Väljastab arvud, mitte nimesid. Serveris töötava väljalaske kaustas ja selle keskkonnafailiga:

```
node --env-file=<väljalaske env> --import ./scripts/register-node-source-loader.mjs scripts/service-profile-assistant-count.mjs
```

### Kontrollid

`tests/service-provider-assistant-gate.test.mjs` (18 testi, andmebaasita): värav on fail-closed; registrikoodi kinnitus; avaliku teenuseta profiil; piirkonna iga tüüp; kahemõtteline ja tundmatu nimi; omavalitsuse küsimusele ainult seda katvad teenused; link ainult avaliku kaardikirje korral; loendus ei sisalda nimesid; värav ei loe kontakte ning vestluse otsing teda veel ei kutsu.

## Omaniku otsused (ehitamata)

1. **Mida osutaja kohta näidatakse.** Ettepanek: asutuse nimi, teenuse nimi ja kategooria, kus osutatakse, tasuta või tasuline ja hinna täpsustus, kuidas teenusele saab (KOV või SKA suunamine), asutuse üldkontakt, kättesaadavus ainult värskelt kinnitatuna. Küsimärgiga: kontaktisiku nimi, tegevusloa märgis.
2. **Sõnastus.** Ettepanek: „nimetab“, mitte „soovitab“, ja vastus ütleb, et info on osutaja enda antud. Siis tuleb muuta ka vormi loa tekst („Luba assistendil avaldatud teenuseid soovitada“, „lisatakse AI teadmuskihile“).
3. **Tasuline ja tasuta osutaja.** Ettepanek: koheldakse ühtmoodi ja järjekord ei sõltu kunagi maksmisest (kitsam piirkond ees, siis tähestik); muidu on vastus reklaam.
4. **Kaardil nähtamatu osutaja** (aadressivaste puudub või kaardi linnuke on maas, aga profiil on avaldatud ja luba antud): kas assistent teda nimetab. Linki talle anda ei saa.
5. **Vana profiil.** Mitu kuud kinnitamata profiil langeb assistendist välja (ettepanek 12 kuud, enne seda meeldetuletus).
6. **Organisatsiooni profiil.** Värav nõuab praegu esindusõiguse kinnitust igalt registrikoodiga profiililt, aga kinnitada saab ainult ühe inimese profiili. Kas organisatsiooni enda kontroll loeb kinnituseks.
7. **Vanad vastused pärast loa tagasivõtmist.** Ettepanek: tekst jääb inimese vestluse ajalukku, osutaja allikakaarti ja linki enam ei näidata.
8. **Tasuline kontroll** raja ühendamisel (mõni sent).

## Järgmised sammud pärast otsuseid

1. Lugeja-adapter ja kolmas rada otsingus; osutajate plokk mudeli kontekstis oma viidetega.
2. Vastuse kontroll, ajalugu ja allikavaade uue viiteliigi jaoks.
3. Vastuse juhis (sõnastus), plaani uus versioon, tasuline kontroll.
4. Vormi tekstid.

## Piirid ja kõrvalleiud

- **Vorm küsis omavalitsusi vabatekstina; alates 11.10.2026 valitakse need registrist.** Profiili vaates „Tegevuspiirkond“ ja teenuse vaates „Teenuse piirkond“ valib osutaja maakonna ja omavalitsused loendist (`components/workspace/serviceProfile/ProfileFields.jsx`, `AreaFields`; reeglid `profileModel.js`). Varem käsitsi kirjutatud sõna, mida register ei loe, jääb vormis näha ja maha võetavaks ning vaade ütleb, et see ei ole loendist valitud. Avaldamise kontroll näitab mitteblokeeriva reana KOV põhist teenust, millel ei ole ühtki loetavat omavalitsust, ja maakondlikku teenust, millel ei ole maakonda. Loenduse väli `unreadAreaWords` jääb uute sisestuste puhul nulli.
- Teeninduskohal ei ole omavalitsust, ainult aadress ja maakond: teeninduskoha põhine teenus loetakse maakonna täpsusega. Teeninduskohal ei ole vormis maakonna välja: koht pärib maakonna loomisel profiililt ja profiili maakonna hilisem muutmine kohta ei muuda.
- Vana tee jäänused (`serviceProfileRetrievalGuard`, `serviceProfileRagRemoval`, tabel `ServiceProviderProfileRagJob`, 0 rida) on puutumata.
- Esindusõiguse reeglit (#666, #668) ei muudetud.
