# Teenuseprofiil, Teenusekaart ja Eelpöördumised

Seis: 2026-05-05  
Staatus: kontseptsiooni ja tehnilise vundamendi arendus on alanud.

## Eesmärk

Ehitada SotsiaalAI-s seotud süsteem, kus:

- teenuseosutaja haldab oma teenuseprofiili;
- avaldatud teenuseprofiil loob süsteemse kaardikirje;
- teenusekaart kuvab KOV kontaktide ja teenuseosutajate markereid;
- eelpöördumise töövoos saab valida adressaadiks KOV kontakti või teenuseosutaja;
- avaldatud teenuseprofiili info muutub AI assistendile leitavaks eraldi teenuseosutajate teadmuskihina.

## Mõisted

| Mõiste | Tähendus |
| --- | --- |
| Teenuseprofiil | Teenuseosutaja haldusvaade. Ei ole sama asi kui kasutaja konto profiil. |
| Teenusekaart | Päris kaardivaade markeritega. Ei ole andmesisestuse koht. |
| Eelpöördumine | Pöördumise/kirja koostamise töövoog koos adressaadi valikuga. |
| ServiceMapEntry | Sisemine struktureeritud kaardikirje, mida kaart ja eelpöördumised kasutavad. |
| AI teenuseosutajate kiht | Avaldatud teenuseprofiilidest loodud RAG/teadmuskirjed assistendi jaoks. |

## Rollireeglid

- `CLIENT`: näeb töölaual `Eelpöördumised` ja `Teenusekaart`.
- `SOCIAL_WORKER`: näeb töölaual `Eelpöördumised` ja `Teenusekaart`.
- `SERVICE_PROVIDER`: näeb töölaual `Eelpöördumised`, `Teenusekaart` ja `Teenuseprofiil`.
- `ADMIN`: peab esialgu saama töölaual kõiki kolme uut funktsiooni kasutada, sõltumata aktiivsest eelvaaterollist.

Oluline: `Teenuseprofiil` ei ole `CLIENT` ega `SOCIAL_WORKER` töölaual kuvatav funktsioon.

## Tehtud

### Töölaua ja navigatsiooni vundament

- Lisatud eraldi töölaud vestlusvaatesse.
- Lisatud rightraili `Töölaud` ikoon.
- Eemaldatud rightrailist `Materjalid` ikoon.
- Eemaldatud left railist `Abisoovid` ja `Abipakkumised`.
- Eemaldatud `+` menüüst töölauale kuuluvad korduvad tegevused.
- `Kuulutused ja vasted` kaart asendatud `Lisa inimene` kaardiga.
- `Lisa inimene` avab kutsevoo ja tagasi/sulge viib kasutaja tagasi töölauale.
- Töölaua paneel ei avane enam vestluse overlay-na, vaid asendab vestluse pinna.
- Töölaua avatud olekus left rail ja right rail on peidetud.
- Töölaua tagasi-nupp ja pealkirja stiil on viidud tellimuse lehega samasse loogikasse.
- Teistelt lehtedelt töölauale naastes taastatakse töölaud enne vaate värvimist, et paneel ei muutuks nähtavalt ümarast kandiliseks.

### Uued funktsioonilehed

Lisatud eraldi route'id:

- `/eelpoordumised`
- `/teenusekaart`
- `/teenuseprofiil`

Töölaua kaardid on suunatud uutele route'idele:

- `Eelpöördumised` -> `/eelpoordumised`
- `Teenusekaart` -> `/teenusekaart`
- `Teenuseprofiil` -> `/teenuseprofiil`

Lisatud ühine klientkomponent:

- `components/workspace/WorkspaceFeaturePage.jsx`

Selles on esialgne UI-vundament:

- eelpöördumise top-down töövoog koos assistendi vestluse, kontaktisoovituste, mustandi ja varasemate pöördumistega;
- teenusekaardi päris Leafleti kaardivaade koos otsingu, filtrite, markerite ja overlay-paneelidega;
- teenuseprofiili haldusvorm teenuse info, teeninduspiirkonna, kontaktide, eelpöördumiste vastuvõtu ja avaldamise seadistamiseks.

### Rollipõhine töölaua nähtavus

Muudetud töölaua rolliloogikat:

- `Eelpöördumised` ja `Teenusekaart` jäävad kõigile rollidele;
- `Teenuseprofiil` kuvatakse ainult `SERVICE_PROVIDER` rollile ja adminile;
- adminile antakse töölaual eraldi `isAdmin` signaal, et ta saaks funktsioone testida ka siis, kui admini eelvaateroll on `CLIENT` või `SOCIAL_WORKER`.

### Andmemudeli vundament

Lisatud Prisma skeemi uued enumid:

- `ServiceProviderProfileStatus`
- `ServiceProviderFeeType`
- `ServiceMapEntryType`
- `ServiceMapEntryStatus`
- `ServiceMapGeocodingStatus`

Lisatud Prisma mudelid:

- `ServiceProviderProfile`
- `ServiceMapEntry`

Põhiseosed:

- `User` -> `ServiceProviderProfile[]`
- `ServiceProviderProfile` -> `ServiceMapEntry?`
- `Municipality` -> `ServiceMapEntry[]`

Lisatud migratsioon:

- `prisma/migrations/20260505203000_add_service_provider_profile_and_map_entries/migration.sql`

### Serverikihi vundament

Lisatud helper:

- `lib/serviceProviderProfiles.js`

See sisaldab:

- teenuseprofiili sisendi normaliseerimist;
- teenuseprofiili serialiseerimist;
- `ServiceMapEntry` serialiseerimist;
- teenuseprofiili loomist/uuendamist kasutaja järgi;
- teenuseprofiilist teenuseosutaja tüüpi `ServiceMapEntry` upsert'i;
- avaldatud kaardikirjete listimist teenusekaardi jaoks.

Lisatud API route'id:

- `GET /api/service-provider/profile`
- `PUT /api/service-provider/profile`
- `GET /api/service-map/entries`

Teenuseprofiili API:

- lubab haldust `SERVICE_PROVIDER` rollile;
- lubab haldust adminile;
- seob profiili sisselogitud kasutajaga;
- loob või uuendab sama kasutaja `ServiceProviderProfile` kirje;
- loob või uuendab seotud `ServiceMapEntry` kirje.

Teenusekaardi API:

- tagastab ainult avaldatud ja kindla asukohaga kaardikirjed;
- ei kasuta runtime RAG search'i markerite leidmiseks.

### Teenuseprofiili UX ümberkujundus

Teenuseprofiili leht on ümber kujundatud teenuseosutaja haldusvaateks, mitte tehniliste väljundite ülevaateks.

Muudatused:

- eemaldatud kasutajale nähtav `Väljundid` sektsioon;
- eemaldatud töölaua vormist eraldi `Avalik profiil`, `Teenusekaardi marker` ja `AI teadmuskirje` kaardid/chipid;
- lehe sissejuhatus on muudetud praktiliseks: mida teenuseosutaja siin haldab;
- lisatud ülemine seisuriba profiili staatuse, hinna ja kaardil kuvamise valmisolekuga;
- jagatud vorm selgeteks sektsioonideks:
  - `Teenuse info`;
  - `Teeninduspiirkond ja asukoht`;
  - `Kontakt ja eelpöördumised`;
  - `Avaldamine`;
- kaardiseos on jäetud ainult inimloetavaks aadressi staatuseks;
- kasutajale ei kuvata koordinaate ega tehnilist RAG/teadmuskorje väljundit;
- eelpöördumiste vastuvõtu seaded on viidud kontaktide juurde, sest need määravad ühenduse võtmise kanali.

Funktsionaalne loogika:

- teenuseosutaja täidab organisatsiooni, teenuste, sihtrühmade, teeninduspiirkonna ja kontaktide info;
- teenuseosutaja otsustab, kas ta võtab vastu SotsiaalAI siseseid eelpöördumisi ja/või e-posti mustandeid;
- teenuseosutaja saab määrata, kas profiil on teenusekaardil nähtav;
- marker ilmub teenusekaardile ainult siis, kui profiil on avaldatud ja aadressil on usaldusväärne vaste;
- AI assistendi jaoks kasutatav teadmuskirje jääb süsteemseks taustaprotsessiks, mitte kasutajale eraldi väljundiks.

Viimane korrigeerimine:

- lehe nähtav juhttekst ei räägi enam avalikust profiilist, markerist ega AI teadmuskirjest kui eraldi kasutajale hallatavatest väljunditest;
- vormi ülaossa lisati kompaktne ülevaade: staatus, hind ja kaardil kuvamise valmisolek;
- `mapVisible` on esitatud teenusekaardi nähtavuse otsusena, mitte markerihalduse tehnilise seadistusena;
- aadressi vaste/geokodeerimise info on sõnastatud kasutajale arusaadava `Aadressi seis` plokina;
- eelpöördumiste vastuvõtu valikud on seotud kontaktiplokiga:
  - SotsiaalAI sisene eelpöördumine;
  - e-posti mustand;
- avaldamise plokk selgitab, et mustand ja ülevaatusel profiil ei ilmu teenusekaardile ning avaldatud profiil vajab usaldusväärset aadressivastet;
- koordinaate, RAG-i tehnilisi välju ja teenusekaardi markerit kasutaja vormis ei kuvata.

## Pooleli olevad kohad

- Teenuseprofiili UI on API-ga ühendatud ja ümber kujundatud; vaja on käsitsi testida salvestamist admini ja teenuseosutaja rolliga serveri andmebaasi peal.
- Teenusekaart kasutab Leafleti päris kaarti; vaja on jätkata markerite kvaliteedi, geokodeerimise ja KOV andmete katvuse parandamist.
- Eelpöördumiste UI on top-down töövoona olemas; vaja on jätkata assistendi sisuloogika, adressaatide täpsema sobitamise, muutmise/arhiivimise ja hilisema saatmise töövooga.
- Geokodeerimine on mudelis ette valmistatud, aga adapter Maa- ja Ruumiameti/In-ADS/In-AKS teenuse jaoks on veel lisamata.
- KOV kontaktide sünk `ServiceMapEntry` tabelisse on olemas; vaja on laiendada andmekatvust ja geokodeerida rohkem aadresse.
- RAG/AI teenuseosutajate teadmuskihi loomine avaldatud teenuseprofiilist on veel lisamata.

## Tööplaan

### 1. Andmemudel ja migratsioon lõpuni

Eesmärk: panna paika püsiv andmekiht.

Teha:

- valideerida Prisma skeem;
- genereerida Prisma klient;
- rakendada migratsioon andmebaasis;
- lisada baastestid teenuseprofiili normaliseerimisele ja `ServiceMapEntry` olekute tuletamisele;
- kontrollida, et `CLIENT` ja `SOCIAL_WORKER` ei saa API kaudu teenuseprofiili muuta;
- kontrollida, et admin saab teenuseprofiili API-d kasutada.

Acceptance:

- `ServiceProviderProfile` ja `ServiceMapEntry` tabelid on andmebaasis olemas;
- Prisma klient tunneb uusi mudeleid;
- teenuseprofiili salvestamine loob seotud `ServiceMapEntry` kirje.

### 2. Teenuseprofiili MVP

Eesmärk: teenuseosutaja saab hallata teenuseprofiili.

Tehtud:

- `/teenuseprofiil` vorm on API-ga seotud;
- lisatud laadimise, salvestamise, veateate ja õnnestumise olekud;
- koordinaate kasutaja vormis ei kuvata;
- olemas on staatuse loogika: `DRAFT`, `REVIEW`, `PUBLISHED`, `HIDDEN`;
- olemas on `mapVisible` lüliti;
- kaardikirje/geokodeerimise seis kuvatakse kasutajasõbraliku aadressi seisuna;
- tehnilised väljundid `Avalik profiil`, `Teenusekaardi marker` ja `AI teadmuskirje` on vormist eemaldatud.

Teha edasi:

- täiendada serveripoolset valideerimist;
- testida salvestamist serveri andmebaasis teenuseosutaja ja admini rolliga;
- lisada hiljem avaldatud teenuseprofiilist AI/RAG teadmuskirje sünk;
- vajadusel lisada teenuseosutaja avaliku profiili eraldi vaatamise leht, kuid mitte kuvada seda haldusvormis tehnilise väljundina.

Acceptance:

- `SERVICE_PROVIDER` saab profiili salvestada;
- admin saab profiili testida;
- `CLIENT` ja `SOCIAL_WORKER` ei näe töölaual teenuseprofiili;
- avaldamata profiil ei ilmu teenusekaardile.

### 3. Geokodeerimise adapter

Eesmärk: aadressist tekib süsteemisisene markeriasukoht.

Teha:

- luua `lib/serviceMap/geocoding.js` adapter;
- ette valmistada Maa- ja Ruumiameti/In-ADS/In-AKS aadressiotsingu integratsioon;
- MVP-s võib adapter olla konfigureeritav stub, kuid API kuju peab jääma püsivaks;
- salvestada `normalizedAddress`, `latitude`, `longitude`, `adsObjectId`, `geocodingStatus`, `geocodingRaw`;
- kui vasteid on mitu, märkida `AMBIGUOUS`;
- kui vastet ei leita, märkida `FAILED`;
- mitte avaldada markerit enne kindlat või käsitsi kinnitatud asukohta.

Acceptance:

- aadressi muutmisel saab süsteem geokodeerimise tulemuse salvestada;
- ebakindel aadress ei ilmu kaardile vales kohas;
- teenuseosutaja ei sisesta koordinaate käsitsi.

### 4. Teenusekaart MVP

Eesmärk: päris kaart markeritega.

Teha:

- valida MVP kaarditeek: Leaflet või OpenLayers;
- lisada kaardialuse URL env/config kaudu;
- kuvada `ServiceMapEntry` markerid;
- popup teenuseosutaja markerile;
- popup KOV markerile;
- otsing märksõna järgi;
- filter piirkonna/KOV järgi;
- filter kirje tüübi järgi;
- hiljem kategooria ja sihtrühma filtrid.

Acceptance:

- `/teenusekaart` on päris kaardileht;
- markerid tulevad struktureeritud API-st;
- RAG search'i ei kasutata kaardimarkerite leidmiseks;
- kindla asukohata kirjeid markerina ei kuvata.

### 5. KOV kontaktide sünk

Eesmärk: KOV kontaktid tulevad canonical/KOV andmekihist `ServiceMapEntry` kirjeteks.

Teha:

- kaardistada olemasolev KOV meta/canonical andmekiht;
- luua sünkroonimisskript;
- upsert `ServiceMapEntry` kirjed;
- eristada `KOV_SOCIAL_CONTACT` ja `KOV_GENERAL_CONTACT`;
- säilitada `sourceUrl`, `sourceDocId`, `checkedAt`;
- käivitada geokodeerimine KOV aadressidele.

Acceptance:

- KOV sotsiaalhoolekande kontaktid on teenusekaardil markeritena;
- üldkontakt ei ole ekslikult sotsiaalhoolekande kontakt;
- allika info säilib.

### 6. Eelpöördumised MVP

Eesmärk: kasutaja saab koostada pöördumise mustandi ja valida adressaadi.

Tehtud:

- lisatud `PreInquiry` andmemudel;
- lisatud API mustandite loomiseks ja listimiseks;
- adressaadid tulevad `ServiceMapEntry` kihist;
- kasutaja saab valida KOV kontakti või teenuseosutaja;
- mustandi salvestamine on olemas;
- kopeerimine ja allalaadimine on UI-s olemas;
- leht on top-down töövoog: vestlus assistendiga, sobivad kontaktid, pöördumise mustand, minu eelpöördumised;
- assistendi vestlus kasutab dokumendi koostamise lehega sama vestluse komponendimustrit;
- kontaktide sektsioon ei kuva tühje tulemusridu enne soovitusi või otsingut;
- rollipõhised vaated eristavad pöörduja, sotsiaaltöötaja, teenuseosutaja ja admini vajadusi;
- e-postiga saatmine jääb hilisemaks ja peab nõudma kasutaja kinnitust.

Teha edasi:

- lisada eelpöördumise muutmise/arhiivimise API;
- parandada adressaatide sobitamist KOV ja teenuseosutaja teenusekategooriate põhjal;
- täiendada saabunud eelpöördumiste töövoogu spetsialistile ja teenuseosutajale;
- lisada hilisem `EXTERNAL_EMAIL` saatmise töövoog koos eraldi kinnituse ja logimisega.

Acceptance:

- kõik rollid näevad eelpöördumisi töölaual;
- kasutaja näeb enda koostatud eelpöördumisi;
- teenuseosutaja/spetsialist saab kokkulepitud vaates näha talle suunatud pöördumisi;
- midagi ei saadeta automaatselt ilma kinnitamiseta.

Seis pärast viimast arenduslõiku:

- lisatud `PreInquiryRecipientType` ja `PreInquiryStatus` enumid;
- lisatud `PreInquiry` Prisma mudel ja migratsioon;
- lisatud `/api/pre-inquiries` GET/POST API;
- eelpöördumiste leht laeb kasutajale nähtavad pöördumised;
- eelpöördumise vorm koostab lokaalse kirjamustandi, laseb valida adressaadi `ServiceMapEntry` kihist, salvestab mustandi ja võimaldab teksti kopeerida;
- teenuseosutajale adresseeritud eelpöördumise puhul seotakse kirje võimalusel teenuseprofiili omanikuga (`recipientOwnerId`);
- kui adressaadi e-post kuulub olemasolevale kasutajakontole, seotakse eelpöördumine selle kontoga ja adressaat näeb seda oma eelpöördumiste vaates;
- lisatud eraldi saatmiskanali mõiste: `INTERNAL` tähendab SotsiaalAI sisemist eelpöördumist kasutajakontode vahel, `EXTERNAL_EMAIL` tähendab välisele KOV/canonical/RAG andmetest pärit e-postile saadetavat kirja;
- `EXTERNAL_EMAIL` kanal ei saada praegu kirja automaatselt; hilisem saatmine peab nõudma kasutaja eraldi kinnitust ja salvestama saatmise aja;
- admin näeb API kaudu kõiki eelpöördumisi, tavakasutaja näeb enda saadetud ja talle adresseeritud kirjeid.
- eelpöördumise lehel on ette valmistatud assistendiga koostamise tööruum, kus hiljem saab olukorra põhjal KOV kontakte ja teenuseprofiile otsida ning kirja koos assistendiga koostada;
- lisatud `/api/pre-inquiries/assist` MVP endpoint, mis otsib struktureeritud `ServiceMapEntry` kihist sobivaid KOV kontakte ja teenuseosutajaid, hindab sisemise/välise kanali võimalust ning tagastab kirjamustandi;
- eelpöördumise assistendi UI saab nüüd küsida adressaadisoovitusi ja täita kirjamustandi endpointi vastuse põhjal;
- lisatud KOV kontaktide `ServiceMapEntry` sünk: `lib/serviceMap/kovContactSync.js` ja `scripts/sync-kov-service-map-entries.mjs`;
- lisatud käsud `npm run service-map:sync:kov:dry` ja `npm run service-map:sync:kov`;
- dry-run leidis olemasolevatest KOV pakettidest 42 kontakti ja plaanis 41 `ServiceMapEntry` kirjet;
- KOV sünk ei kirjuta geokodeeritud kirjet tagasi `PENDING` olekusse, kui aadress ei ole muutunud ja geokodeering on juba kinnitatud;
- sotsiaaltöötaja kontol on `acceptsPreInquiries` vastuvõtu-eelistus; ainult selle lubamisel saab sama e-postiga kasutajakonto platvormisisese eelpöördumise adressaadiks;
- teenuseosutaja teenuseprofiilil on eraldi valikud `acceptsPlatformPreInquiries` ja `acceptsEmailPreInquiries`;
- admin saab eelpöördumise lehel valida töörolli: pöörduja, sotsiaaltöötaja või teenuseosutaja.

### 7. AI/RAG teenuseosutajate kiht

Eesmärk: avaldatud teenuseprofiil muutub assistendile leitavaks.

Teha:

- koostada teenuseprofiilist struktureeritud JSON;
- koostada teenuseprofiilist lühike RAG markdown tekst;
- lisada eraldi `source_type=service_provider_profile`;
- lisada metadata: `municipality_id`, `county`, `service_categories`, `target_groups`, `service_area_municipality_ids`, `providerProfileId`, `serviceMapEntryId`;
- avaldamisel luua/uuendada teadmuskirje;
- peitmisel eemaldada või märkida mitteaktiivseks;
- assistendi vastuses eristada teenuseosutaja enda profiili KOV ametlikest allikatest.

Acceptance:

- assistent saab soovitada avaldatud teenuseosutajaid;
- mustandeid, peidetud ja ülevaatamisel profiile ei soovitata;
- allikaviide näitab, et info pärineb teenuseosutaja profiilist.

## Tehnilised piirangud ja otsused

- Teenusekaart ei tee runtime RAG search'i markerite leidmiseks.
- Teenuseosutaja ei täida koordinaate käsitsi.
- `ServiceMapEntry` tekib süsteemi poolt teenuseprofiili või KOV andmete põhjal.
- Teenuseprofiil on seotud `SERVICE_PROVIDER` kasutajaga, mitte tavalise konto profiiliga.
- Admin peab esialgu saama kõiki kolme uut funktsiooni testida.
- `CLIENT` ja `SOCIAL_WORKER` näevad eelpöördumisi ja teenusekaarti, aga mitte teenuseprofiili.
- Admin saab eelpöördumise ja teenusekaardi vaates valida, millise rolli töövaadet ta testib.

## Seotud failid

Uued või oluliselt muudetud failid:

- `components/chat/WorkspacePanel.jsx`
- `components/chat/WorkspacePanel.module.css`
- `components/workspace/WorkspaceFeaturePage.jsx`
- `components/workspace/ServiceMapLeaflet.jsx`
- `components/alalehed/ChatBody.jsx`
- `components/alalehed/chat/ChatBodyView.jsx`
- `app/eelpoordumised/page.jsx`
- `app/teenusekaart/page.jsx`
- `app/teenuseprofiil/page.jsx`
- `app/styles/components/service-map.css`
- `app/api/service-provider/profile/route.js`
- `app/api/service-map/entries/route.js`
- `app/api/pre-inquiries/route.js`
- `app/api/pre-inquiries/assist/route.js`
- `app/api/pre-inquiries/preferences/route.js`
- `lib/serviceProviderProfiles.js`
- `lib/preInquiries.js`
- `lib/serviceMap/kovContactSync.js`
- `lib/serviceMap/geocoding.js`
- `scripts/sync-kov-service-map-entries.mjs`
- `scripts/geocode-service-map-entries.mjs`
- `prisma/schema.prisma`
- `prisma/migrations/20260505203000_add_service_provider_profile_and_map_entries/migration.sql`
- `prisma/migrations/20260505212000_add_pre_inquiries/migration.sql`
- `messages/et.json`
- `messages/en.json`
- `messages/ru.json`

## Arenduslõik: ServiceMapEntry geokodeerimine

Lisatud ServiceMapEntry geokodeerimise MVP kiht:

- `lib/serviceMap/geocoding.js` sisaldab aadressi geokodeerimise adapterit ja tabelikirjete uuendamise teenust;
- `scripts/geocode-service-map-entries.mjs` käivitab geokodeerimise dry-run või rakendamise režiimis;
- lisatud käsud `npm run service-map:geocode:dry` ja `npm run service-map:geocode`;
- vaikimisi ei kutsuta välist geoteenust ja aadress jääb `PENDING` olekusse, kuni provider on seadistatud;
- toetatud on fixture-põhine MVP (`SERVICE_MAP_GEOCODER_PROVIDER=fixture` koos `SERVICE_MAP_GEOCODER_FIXTURES` või `SERVICE_MAP_GEOCODER_FIXTURE_FILE`);
- toetatud on Nominatim adapter (`SERVICE_MAP_GEOCODER_PROVIDER=nominatim`) ajutise MVP variandina, kuni Maa- ja Ruumiameti/In-ADS adapter on täpselt ühendatud;
- toetatud on Maa- ja Ruumiameti In-AKS Gazetteer adapter (`SERVICE_MAP_GEOCODER_PROVIDER=maaruum`, aliasena `maaamet`, `inaks` või `aks`), vaikimisi endpointiga `https://aks.geoportaal.ee/inaks/inaadress/gazetteer`;
- mitme vaste korral märgitakse kirje `AMBIGUOUS`, mitte ei valita juhuslikult esimest vastet;
- kindla vaste korral salvestatakse `normalizedAddress`, `latitude`, `longitude`, `adsObjectId`, `geocodingRaw` ja `checkedAt`;
- `NEEDS_REVIEW` või avaldatav KOV kirje tõstetakse kindla vaste korral `PUBLISHED` olekusse;
- `DRAFT` ja `HIDDEN` kirjeid ei avaldata geokodeerimise tõttu automaatselt;
- ilma seadistatud providerita ei luba rakendamise skript mitte-dry-run režiimi, et serveris ei tekiks näiliselt töödeldud, kuid geokodeerimata kirjeid.

Serveris kasutatav järjestus:

1. rakenda Prisma migratsioonid;
2. käivita `npm run service-map:sync:kov`, et KOV kontaktid kirjutada `ServiceMapEntry` tabelisse;
3. seadista geokooder või fixture;
4. kontrolli `npm run service-map:geocode:dry`;
5. rakenda `npm run service-map:geocode`.

Näidis fixture:

```json
{
  "suur-sepa 16 pärnu": {
    "normalizedAddress": "Suur-Sepa tn 16, Pärnu linn, Pärnu maakond",
    "latitude": 58.3857,
    "longitude": 24.4971,
    "adsObjectId": "ADS_TULEVANE_ID"
  }
}
```

Maa- ja Ruumiameti In-AKS näidisseadistus:

```env
SERVICE_MAP_GEOCODER_PROVIDER=maaruum
SERVICE_MAP_MAARUUM_GEOCODER_URL=https://aks.geoportaal.ee/inaks/inaadress/gazetteer
SERVICE_MAP_GEOCODER_USER_AGENT=SotsiaalAI/1.0 admin@sotsiaal.ai
```

Uued seotud failid:

- `lib/serviceMap/geocoding.js`
- `scripts/geocode-service-map-entries.mjs`

## Arenduslõik: Teenusekaardi päris kaardivaade

Lisatud Teenusekaardi esimene päris kaardivaade:

- lisatud Leafleti staatilised vendor-failid `public/vendor/leaflet`, et serveri deploy ei vajaks eraldi `npm install` sammu;
- lisatud `components/workspace/ServiceMapLeaflet.jsx`;
- lisatud `app/styles/components/service-map.css`;
- `/teenusekaart` kasutab nüüd vaikimisi Maa- ja Ruumiameti neutraalsemat halltoonides TMS aluskaarti `hallkaart@GMC`;
- tile URL on muudetav env kaudu: `NEXT_PUBLIC_SERVICE_MAP_TILE_URL`;
- Leafleti JS/CSS URL-id on muudetavad env kaudu: `NEXT_PUBLIC_LEAFLET_SCRIPT_URL` ja `NEXT_PUBLIC_LEAFLET_CSS_URL`;
- atribuut on muudetav env kaudu: `NEXT_PUBLIC_SERVICE_MAP_ATTRIBUTION`;
- kaart kasutab Eesti ulatust ja piirab kasutajat Eesti kaardiruumi ümber `maxBounds` ja `noWrap` seadistusega;
- raster-aluskaarti ei värvita MVP-s CSS-iga tugevalt ümber, sest Maa- ja Ruumiameti rasterpildis ei saa mugavalt eemaldada naaberriike, kohanimesid ega üksikuid kaardielemente;
- täielikult bränditud kaart jääb hilisemaks etapiks, kus saab kaaluda MapLibre ja vektorkaardi stiili;
- markerid tulevad ainult struktureeritud `/api/service-map/entries` andmest, mitte RAG runtime otsingust;
- markerid kuvatakse ainult kirjetel, millel on kindlad koordinaadid;
- KOV kontaktid ja teenuseosutajad on markeril visuaalselt eristatud;
- markerile vajutades avaneb kontaktinfo popup;
- vasakul on otsing, piirkonna filter, kirje tüübi filter ja tulemuste loend;
- tulemuste loendis kirjele vajutamine valib vastava markeri kaardil.
- kaardivaade on muudetud täiskõrguses tööalaks: Eesti kaart on põhikiht ning otsing, filtrid, tulemused ja admini rollivalik on kaardi peal overlay-paneelidena.

Märkus: päris markerite ilmumiseks peab serveris olema:

1. Prisma migratsioonid rakendatud;
2. KOV kontaktide sünk tehtud;
3. aadressid geokodeeritud või käsitsi kinnitatud;
4. kirjed `PUBLISHED` ja `MATCHED`/`MANUALLY_CONFIRMED` olekus.

## Arenduslõik: Eelpöördumise top-down töövoog

Viimistletud `/eelpoordumised` lehe esimene päris töövoog:

- lehe põhimõte on nüüd üks keskne ülevalt-alla voog, mitte mitme paralleelse paneeliga töölaud;
- töölaua kaardi tekst on muudetud: `Eelpöördumine` ja `Pöördumise mustand`;
- lehe pealkiri on ainsuses `Eelpöördumine`;
- sissejuhatus selgitab, et kasutaja kirjeldab olukorda, assistent aitab sõnastada, leida kontaktid ning koostada kontrollitava mustandi;
- lehel on nähtav märkus, et eelpöördumine ei asenda ametlikku abivajaduse väljaselgitamist ega otsustamist;
- esimene põhiosa on `Vestlus assistendiga`;
- vestlus töötab lihtsa chat-tööruumina: kasutaja sisestab vabas vormis olukorra, assistent tagastab täpsustava sõnumi, põhjenduse, kontaktisoovitused ja mustandi;
- vestluse sisend lisatakse olukorra kirjelduse konteksti, et mustand ja soovitused kasutaksid kogu kogutud infot;
- `Sobivad kontaktid` on vestluse järel ja kasutab ainult `ServiceMapEntry` kihti;
- `SotsiaalAI nõustaja` ei ole kontaktide nimekirjas adressaat;
- kontaktikaardil kuvatakse KOV kontakt, KOV üldkontakt või teenuseosutaja selge tüübimärgisega;
- kontaktide nimekirjas kuvatakse alguses kuni kolm kontakti ja vajadusel `Vaata rohkem kontakte`;
- kasutaja saab endiselt otsida adressaati ja filtreerida KOV kontakti või teenuseosutaja tüübi järgi;
- `Pöördumise mustand` on pärast kontaktivalikut, tekst on redigeeritav;
- mustandi tegevused on `Salvesta`, `Kopeeri` ja `Laadi alla`;
- välise e-kirja automaatset saatmist selles töövoos ei kuvata;
- `EXTERNAL_EMAIL` kanal tähendab praegu salvestatavat/kopitavat/allalaaditavat kirja, mitte automaatset väljasaatmist;
- `INTERNAL` kanal jääb alles platvormisisese eelpöördumise jaoks, kui adressaat on seotud kasutajakontoga ja vastuvõtt on lubatud;
- `Minu eelpöördumised` on kõige all kompaktsete ridadena;
- sotsiaaltöötaja ja teenuseosutaja vaates ei kuvata assistendi koostamisplokki, sest nende põhifookus on saabunud eelpöördumiste vastuvõtt ja töötlemine;
- sotsiaaltöötaja vastuvõtu linnuke on vastuvõtu seadistusena eraldi plokis, mitte pöörduja vestlustöövoo osa;
- admin saab endiselt eelpöördumise vaates töörolli valida.

Viimased UI-korrigeerimised:

- `Vestlus assistendiga` kasutab sama visuaalset vestluse ja sisestusriba mustrit nagu dokumendi koostamise leht;
- eelpöördumise vestlus ei alga enam ankeetliku kaheveerulise vormina ega vaikimisi assistendi tervitustekstiga, vaid kasutaja kirjeldus käivitab assistendi töövoo;
- sõnumi sisestus kasutab dokumendi koostamise lehega sama kompaktset `ChatComposer` mustrit, sh nähtav placeholder ja katkise laiuse/paigutuse parandus;
- lehe alguse tekst on lühendatud üheks juhttekstiks, mis selgitab töövoogu ja ametliku hindamise/otsuse piiri ilma eraldi korduvate infokaartideta;
- tegevusnupud on muudetud kompaktsemaks, et `Uus`, `Salvesta`, `Kopeeri`, `Laadi alla` ja `Ava` ei võtaks ebaloomulikult laia ruumi;
- eelpöördumise vorm ei kasuta enam kogu lehte hõlmavat välist `<form>` elementi, et vältida vestluse sisestusribaga tekkivaid pesastatud vorme;
- kontaktide sektsioon ei kuva tühje või läbipaistvaid tulemuskaarte enne, kui assistent on soovitused leidnud või kasutaja on adressaati otsinud;
- kontaktikaardid on muudetud loetavaks: tekst on kontrastne, valitud kontakt on selgelt eristatud;
- rollipõhine sisu on korrigeeritud:
  - `CLIENT` põhifookus on olukorra kirjeldamine, kontakti valik, mustand ja enda eelpöördumised;
  - `SOCIAL_WORKER` põhivaade on saabunud platvormisiseste eelpöördumiste vastuvõtt, aksepteerimine, vestlusruumi avamine ja vajadusel e-kirjaga vastamine;
  - `SERVICE_PROVIDER` põhivaade on teenuseprofiiliga või kontoga seotud saabunud eelpöördumiste vastuvõtt, vestlusruumi avamine ja e-posti vastus; vastuvõtukanalid seotakse teenuseprofiili seadistusega;
  - `ADMIN` saab testimiseks valida töörolli ja näha laiemat eelpöördumiste vaadet;
- `Minu eelpöördumised` jääb lehe lõppu sekundaarseks haldusosaks;
- saabunud eelpöördumised kuvatakse ainult rollidel, kellel see on sisuliselt vajalik, mitte pöörduja põhivoos.

Viimane rolliloogika täpsustus:

- `CLIENT` vaates jääb alles assistendi top-down koostamisvoog;
- `SOCIAL_WORKER` ja `SERVICE_PROVIDER` vaated avanevad vastuvõtu tööruumina, kus saab näha saabunud pöördumisi, märkida pöördumise vastuvõetuks, avada inimesega vestlusruumi või koostada vastuse e-postiga;
- lisatud API suunad `POST /api/pre-inquiries/[id]/accept` ja `POST /api/pre-inquiries/[id]/room`, et vastuvõtja saaks pöördumise tööseisu muuta ja platvormisisese vestlusruumi avada.

Assistendi endpointi `/api/pre-inquiries/assist` laiendati nii, et see tagastab lisaks senisele `suggestions` ja `draft` väljundile ka:

- `situationSummary`;
- `selectedNeedAreas`;
- `urgencyLevel`;
- `suggestedNextSteps`: `KOV`, `SERVICE_PROVIDER` või `BOTH`;
- `reasoningText`;
- `recommendedRecipients`;
- `selectedRecipientSuggestion`;
- `draftType`;
- `draftSubject`;
- `draftBody`;
- `channelSuggestion`;
- `warnings`.

Assistendi sõnastus jääb ettevaatlikuks:

- ei väida, et kasutajal on kindel õigus teenusele;
- ei väida, et KOV peab teenuse määrama;
- kasutab sõnastust `võib olla mõistlik`, `võib vajada KOV-i hindamist` ja `teenuseosutajalt saab küsida infot`;
- kiire ohu tuvastamisel lisab neutraalse suunamise hädaabi või kriisiabi poole.

## Kontrollid

Viimati edukalt läbitud pärast eelpöördumise lehe viimaseid UI-korrigeerimisi ja teenuseprofiili ümberkujundust:

- `npx eslint components/workspace/WorkspaceFeaturePage.jsx lib/preInquiries.js`
- `npm run i18n:check`
- `npm run build`

Varasemalt edukalt läbitud pärast eelpöördumiste MVP lisamist:

- `npx prisma validate`
- `npx prisma generate`
- `npx eslint lib/serviceProviderProfiles.js lib/preInquiries.js app/api/service-map/entries/route.js app/api/pre-inquiries/route.js components/workspace/WorkspaceFeaturePage.jsx`

Veel vaja järgmistes lõikudes:

- migratsiooni rakendamise kontroll;
- teenuseprofiili API käsitsi kontroll admini ja teenuseosutaja rolliga.
- eelpöördumise muutmise/arhiivimise API;
- eelpöördumise adressaadiks sotsiaaltöötaja kasutajakonto valimine, kui KOV kontakt on süsteemis konkreetse kontoga seotud;
- välise e-kirja saatmise töövoog `EXTERNAL_EMAIL` kanalile koos selge kasutajakinnituse, saatmislogi ja veakäsitlusega;
- eelpöördumise allalaadimine;
- KOV kontaktide sünk;
- geokodeerimise adapter;
- AI/RAG teenuseosutajate teadmuskihi sidumine.
