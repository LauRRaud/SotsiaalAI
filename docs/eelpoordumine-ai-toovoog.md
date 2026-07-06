# Eelpöördumise juhendatud AI-töövoog

## Roll

Eelpöördumine aitab kasutajal vastata küsimusele: kelle poole ma pöördun ja mida ma talle saadan?

See on kasutaja kinnitatud jagatav algkontakt. See ei ole ametlik abivajaduse hindamine ega teenuse määramise otsus.

## Lehe käitumine

Leht ei avane pika vormina. Esmane vaade kuvab kolm alustamise võimalust:

- Aita mul leida, kelle poole pöörduda
- Mul on kontakt juba olemas
- Jätkan Teekonnast

Pärast alustamist liigub kasutaja sammupõhises töövoos:

1. Täpsusta eelinfot
2. Eelinfo ülevaade
3. Adressaat
4. Pöördumise eelvaade
5. Minu eelpöördumised

Korraga on esiplaanil ainult aktiivne samm. Sammuriba lubab liikuda tagasi ja edasi, kuid kogu eelkaardistust, kontakte, eelvaadet ja salvestatud pöördumisi ei kuvata korraga.

## Eelinfo kogumine

Kasutaja valib ise eelkaardistuse viisi:

- Kirjeldan olukorda oma sõnadega
- Lühem eelkaardistus
- Põhjalikum eelkaardistus

Ühtegi rada ei valita kasutaja eest nähtavalt ette. Tehniline vaikeseis jääb helperites alles, kuid UI näitab küsimustikku alles pärast kasutaja valikut.

Taustal täitub olemasolev `assessmentState`, mida kasutatakse:

- olukorra kokkuvõtte koostamiseks;
- kontaktisoovituse konteksti andmiseks;
- pöördumise eelvaate koostamiseks;
- salvestamisel ja allalaadimisel eelinfo ekspordiks.

## Teekonna jagamine

Kui eelpöördumine alustatakse Teekonnast, näeb kasutaja vaadet "Vali, mida soovid eelpöördumises kasutada".

Kasutaja saab eraldi kinnitada:

- olukorra kokkuvõtte;
- seotud teemad;
- inimese soovi;
- puuduoleva info;
- seotud dokumendi või konteksti.

Salvestamisel filtreeritakse `sharedJourneyInfo` valikute järgi. Kogu Teekonda ei jagata automaatselt.

## Adressaadi valik

Adressaat saab tulla:

- Teenusekaardi URL-i parameetrist `recipientEntryId`, `serviceMapEntryId`, `entryId`, `recipientId` või `selectedRecipientId`;
- kasutaja otsingust;
- AI kontaktisoovitustest;
- Teekonna jätkust.

Kontaktikaardil kuvatakse kontakt, tüüp, piirkond, kanalid, sobivuse põhjendus ja vajadusel märkus KOV/SKA/spetsialisti otsuse või suunamise kohta.

## Pöördumise eelvaade

Eelvaade on muudetav tekstiväli. Kasutaja näeb enne tegevust:

- adressaati;
- saatmise viisi;
- pöördumise teksti;
- kaasa minevat eelinfot;
- kinnitust, et midagi ei saadeta automaatselt.

Võimalikud tegevused:

- Saada platvormis, kui adressaat toetab platvormisisest vastuvõttu;
- Ava e-kirjana;
- Kopeeri tekst;
- Laadi alla;
- Salvesta eelpöördumine.

## Vastuvõtt ja ruumid

Platvormisisene saatmine kasutab olemasolevat `pre-inquiries` salvestus- ja staatusevoogu. Vastuvõtja näeb pöördumist Pöördumiste vaates.

Ruum ei teki automaatselt. Ruum avatakse ainult siis, kui vastuvõtja või kasutaja teeb selleks eraldi tegevuse.

## Puutumata osad

Selle muudatusega ei tehtud suurt ümberarendust:

- Teekonna lehele;
- Teenusekaardile;
- Teenuseprofiilile;
- Pöördumiste vastuvõtu backendile;
- Ruumide süsteemile;
- ametliku hindamise moodulile.
