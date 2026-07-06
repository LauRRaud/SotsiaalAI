# Teekonna leht ja funktsioon

## Eesmärk

Teekonna leht on pöörduja privaatne abiprotsessi vaade. See ei ole üldine vestlusaken ega tehniline vorm. Leht aitab inimesel kirjeldada oma olukorda, näha sellest korrastatud ülevaadet, jälgida võimalikke järgmisi samme ja liikuda edasi seotud töövoogudesse.

Põhireegel: Teekond on vaikimisi privaatne. Midagi ei jagata spetsialisti, teenuseosutaja, ruumi liikme ega muu osapoolega enne kasutaja eraldi kinnitust.

## Kasutajakogemus

Lehel on neli põhiolukorda.

1. Esmane tühi olek

Kui kasutajal ei ole salvestatud Teekonda, kuvatakse ainult keskne klaasjas algusikoon. Ikoon on päris nupp, klaviatuuriga kasutatav ja ekraanilugejale märgistatud. Hover ja focus olekus ilmub tekst "Alusta teekonda".

2. Teekonna loomise režiim

Algusikoon avaneb klaaspaneeliks. Kasutaja näeb tervitust, lühikest juhist, privaatsust kinnitavat teksti ja suurt tekstivälja olukorra kirjeldamiseks.

Peamine tegevus on "Koosta teekonna ülevaade".

3. Ülevaade enne salvestamist

Pärast kirjelduse sisestamist ei kuvata tavalist AI vastust, vaid struktureeritud ülevaade:

- olukorra kokkuvõte;
- seotud teemad;
- eluvaldkonnad;
- puuduolev info;
- võimalikud järgmised sammud;
- privaatsuse selgitus.

Kasutaja saab kokkuvõtet muuta, minna tagasi kirjelduse muutmise juurde, loobuda või salvestada Teekonna.

4. Salvestatud Teekonna vaade

Salvestatud vaade on interaktiivne teekonnakaart. Seal on nähtav:

- teekonna seis;
- teekonnarada;
- olukorra kokkuvõte;
- seotud teemad;
- eluvaldkonnad;
- puuduolev info;
- võimalikud järgmised sammud;
- tehtud sammud;
- seotud eelpöördumised, dokumendid, teenusekaardi kontaktid, abisoovid ja ruumid.

## Teekonnarada

Salvestatud vaates kuvatakse protsessina järgmised peatused:

1. Olukord kirjeldatud
2. Ülevaade salvestatud
3. Kontakt või teenus otsitud
4. Eelpöördumine koostatud
5. Vastus või jätkusuhtlus
6. Järgmine samm

Peatuste olekud on kasutajale nähtavad kui tehtud, pooleli, järgmine soovitatud samm või mitte alustatud.

## Seosed teiste töövoogudega

### Teenusekaart

Teekonnast saab avada Teenusekaardi teekonna signaalidega. Kui kirjelduses või kontekstis on piirkond ja teemad, antakse need Teenusekaardile päringuparameetritega kaasa. Kui piirkond puudub, kuvatakse kasutajale soovitus lisada KOV või piirkond.

Seotud fail: `lib/journey/serviceMapHandoff.js`

### Eelpöördumine

Teekonnast saab alustada eelpöördumist, aga kogu Teekonda ei jagata automaatselt. Kasutaja näeb vaheplokki, kus saab valida, millist infot eelpöördumise koostamisel kasutada:

- olukorra kokkuvõte;
- seotud teemad;
- puuduolev info;
- inimese soov;
- valitud teenusekaardi kontakt;
- seotud dokument.

Seotud failid:

- `lib/journey/preInquiryHandoff.js`
- `app/api/journeys/[id]/pre-inquiry-draft/route.js`

### Dokumendid

Teekonna detailvaates on dokumentide plokk ja tegevused dokumendi lisamiseks või analüüsimiseks olemasoleva dokumentide töövoo kaudu. Dokumente ei seota automaatselt, vaid seotud dokumentide ID-d on ette nähtud `context.linkedDocumentIds` väljas.

### Abisoovid

Kui olukord viitab praktilisele abivajadusele, saab Teekond pakkuda sammu "Loo abisoov". Abisoovi loomisel tohib kasutada ainult kasutaja kinnitatud infot.

### Ruumid

Ruum ei teki Teekonna loomisel automaatselt. Kui ruum tekib hiljem eelpöördumise, abisoovi või muu kinnitatud töövoo kaudu, saab seda näidata seotud ruumide plokis.

## Andmemudel

Teekond kasutab olemasolevat `Journey` mudelit. Uut migratsiooni selle töö jaoks ei lisatud.

Põhiväljad:

- `title`
- `summary`
- `primaryPath`
- `domains`
- `missingInfo`
- `riskSignals`
- `suggestedActions`
- `context`
- `status`
- `sharingStatus`

Täiendavad struktureeritud signaalid hoitakse `context` väljas.

Näited:

- `lifeDomains`
- `needTags`
- `municipalityText`
- `municipalityId`
- `county`
- `urgencyLevel`
- `activityLog`
- `linkedPreInquiryIds`
- `linkedDocumentIds`
- `linkedServiceMapEntryIds`
- `linkedHelpRequestIds`
- `linkedRoomIds`

Teekond ei määra teenust ega tee ametlikku hindamist. Ta hoiab olukorra signaale, mille põhjal saab kasutaja hiljem avada teenusekaardi, koostada eelpöördumise või liikuda teise töövoogu.

## Peamised failid

- `components/journey/JourneyDashboard.jsx`  
  Teekonna avaleht, tühi olek, loomise režiim ja ülevaade enne salvestamist.

- `components/journey/JourneyDetail.jsx`  
  Salvestatud Teekonna kaart, teekonnarada, seotud tegevused, seotud objektid ja eelpöördumise vahevalik.

- `lib/journey/draft.js`  
  Reeglipõhine teekonna ülevaate koostamine kasutaja kirjeldusest.

- `lib/journey/service.js`  
  Teekonna laadimine, loomine ja muutmine.

- `lib/journey/validation.js`  
  Teekonna sisendi normaliseerimine ja piirangud.

- `lib/journey/serializers.js`  
  Teekonna andmete serialiseerimine kliendile.

- `app/api/journeys/draft/route.js`  
  Olukorra kirjelduse põhjal ülevaate koostamise API.

- `app/api/journeys/route.js`  
  Teekondade nimekiri ja uue Teekonna salvestamine.

- `app/api/journeys/[id]/route.js`  
  Ühe Teekonna laadimine ja muutmine.

- `app/styles/components/journey.css`  
  Teekonna morfoosi ja reduced-motion alternatiivi stiilid.

## Sõnastuse reeglid

Kasutajale nähtavas Teekonna UI-s ei kasutata tehnilisi sõnu nagu:

- Journey;
- andmebaas;
- objekt;
- draft state;
- persisted;
- JSON;
- API;
- model.

Samuti välditakse sõna "mustand". Selle asemel kasutatakse sõnu nagu:

- teekonna ülevaade;
- koostatud ülevaade;
- ülevaade enne salvestamist;
- teekonna eelvaade;
- esialgne ülevaade.

## Ligipääsetavus ja liikumine

Algusikoon on nupuna kasutatav ja sisaldab `aria-label` väärtust. Focus olek on nähtav ning hover ja focus näitavad sama tegevusteksti.

Morfoosi animatsioon on CSS-is. Kui kasutajal on `prefers-reduced-motion: reduce`, kasutatakse lühikest fade üleminekut ilma suure liikumiseta.

## Kontrollid

Selle töö järel läbisid:

- `npx eslint components/journey/JourneyDashboard.jsx components/journey/JourneyDetail.jsx lib/journey/draft.js`
- `npm run i18n:check`
- `npm run build`

Lisaks kontrolliti brauseris, et `http://localhost:3000/teekond` renderdub sisselogimata olekus ilma konsoolivigadeta.
