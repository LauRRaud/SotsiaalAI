---
source: uus plaan.docx
converted: 2026-05-25T22:22:08
format: markdown
---

Punkt 3: teekonnakaardile lisandub tervisekontakti võimalus, aga see ei muuda kaardi põhiloogikat.

Punkt 4: olekud ei muutu. Tervisekontakt on lihtsalt üks võimalik osapool/soovitatud kontakt.

Punkt 5: osapoolte loogikasse lisandub osapoole tüüp tervisekontakt, näiteks perearstikeskus või tervisekeskus. Ta on soovitatud kontakt, mitte automaatselt kaasatud osapool.

# 1. Uus keskne mõte

Praegune mõte:

SotsiaalAI ei peaks algama küsimusest “Millist funktsiooni soovid kasutada?”, vaid küsimusest “Mis olukorras sa oled ja kuhu sa tahad jõuda?”

Detailsemalt tähendab see, et SotsiaalAI esimene väärtus ei ole tööriista pakkumine, vaid olukorra mõistmine.

Kasutaja ei pruugi teada, kas tal on vaja:

- eelpöördumist;

- teenusekaarti;

- dokumenti;

- dokumendi analüüsi;

- abisoovi;

- teenuseosutajat;

- vestlusruumi;

- lihtsalt selgitust.

Seetõttu peaks platvormi algus olema:

privaatne vestlus assistendiga → olukorra kirjeldus → teekonnakaart → sobiv tööriist.

See on väga oluline muudatus, sest see muudab SotsiaalAI kasutaja jaoks vähem “funktsioonide kogumikuks” ja rohkem teekonna juhendajaks.

Kasutaja vaade

Pöörduja jaoks:

“Ma ei pea teadma, millist teenust või vormi mul vaja on. Ma kirjeldan oma olukorda ja SotsiaalAI aitab aru saada, mis võiks olla järgmine samm.”

Spetsialisti jaoks:

“Ma saan kasutada assistenti olukorra korrastamiseks, juhtumi teekonnakaardi loomiseks ja töömustandite ettevalmistamiseks.”

Teenuseosutaja jaoks:

“Minuni jõuavad paremini struktureeritud pöördumised ja inimesed, kelle vajadus haakub minu teenuseprofiiliga.”

Süsteemi loogika

Sisselogimisel avaneb privaatne assistendivestlus. Assistendi esimene roll ei ole kohe vastata lõplikult, vaid tuvastada:

- kasutaja roll;

- olukorra teema;

- võimalik valdkond;

- kas on kiire risk;

- kas on teenusekatkemise mure;

- kas on vaja kontakti;

- kas on vaja dokumenti;

- kas on vaja teenusekaarti;

- kas on vaja eelpöördumist;

- kas on vaja lihtsalt selgitust.

Seotud funktsioonid

See punkt seob:

- assistendid ja agendid;

- töölaud;

- teekonnakaart;

- teenusekaart;

- eelpöördumine;

- dokumendi koostamine;

- dokumendi analüüs;

- vestlusruumid;

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine.

Uus arendus

Vaja oleks lisada assistendile algusrežiim:

“olukorra kaardistamine”

See ei pea olema pikk vorm. Alguses piisab:

- vaba kirjeldus;

- 2–4 täpsustavat küsimust;

- esmane teekonnakaart;

- soovitatud järgmised sammud.

Piirid

SotsiaalAI ei tohi väita:

- “Sul on õigus sellele teenusele.”

- “Sind suunatakse teenusele.”

- “See on ametlik hindamine.”

- “See otsus kehtib KOV-i või teenuseosutaja jaoks.”

Õige piir:

SotsiaalAI aitab olukorda korrastada ja järgmisi samme ette valmistada. Ametliku hindamise, otsuse või teenusele suunamise teeb pädev spetsialist või asutus.

Platvormitekst

Alusta olukorra kirjeldamisest. SotsiaalAI aitab mõista, millised teemad võivad olla seotud, millist infot oleks vaja täpsustada ja millised järgmised sammud võiksid olla asjakohased. Vajadusel suunab platvorm sind teenusekaardi, eelpöördumise, dokumendi koostamise, dokumendi analüüsi või vestlusruumi juurde. SotsiaalAI ei tee ametlikku hindamist ega teenuseotsust, vaid aitab sul järgmise sammu paremini ette valmistada.

Järgmisena oleks loogiline võtta punkt 2: Platvormi uus arhitektuurne mudel ja kirjutada see sama detailselt lahti.

# 2. Platvormi uus arhitektuurne mudel

SotsiaalAI uus arhitektuurne mudel võiks põhineda neljal kihil:

1. privaatne assistendivestlus
2. teekonnakaart
3. nähtavad tööriistad
4. läbivad usaldus- ja kaitsekihid

See mudel aitab vältida seda, et SotsiaalAI tundub kasutajale lihtsalt tööriistade kogumina. Platvormi tuumaks saab olukorrast lähtuv teekond: inimene või spetsialist kirjeldab olukorda ning SotsiaalAI aitab valida sobiva järgmise sammu.

2.1. Eesmärk

Platvormi uus arhitektuur peab lahendama ühe keskse probleemi:

kasutaja ei pruugi teada, millist SotsiaalAI funktsiooni tal vaja on.

Ta ei tule platvormile mõttega:

- “mul on vaja eelpöördumist”;

- “mul on vaja dokumendi analüüsi”;

- “mul on vaja teenusekaarti”;

- “mul on vaja koostööruumi”.

Ta tuleb tavaliselt olukorraga:

- “ma ei tea, kuhu pöörduda”;

- “mul võib teenus katkeda”;

- “ma ei saa otsusest aru”;

- “mul on vaja abi, aga ma ei oska seda kirjeldada”;

- “olen spetsialist ja tahan juhtumit korrastada”;

- “olen teenuseosutaja ja tahan, et minuni jõuaksid sobivad pöördumised”.

Seega arhitektuurne eesmärk on:

SotsiaalAI peab kasutama olemasolevaid funktsioone mitte eraldi saartena, vaid ühe juhendatud teekonna osadena.

2.2. Neli põhikihti

Kiht 1: Privaatne assistendivestlus

See on kasutaja esimene kokkupuutepunkt.

Sinu platvormil see juba nii toimib: sisselogimisel avaneb privaatne vestlus assistendiga. Seda ei pea asendama. Pigem tuleb sellele anda uus selgem roll.

Privaatne assistendivestlus on:

- kasutaja alguspunkt;

- olukorra kirjeldamise koht;

- esimese selgituse koht;

- teekonnakaardi loomise käivitaja;

- tööriistade soovitamise koht.

Oluline eristus:

privaatne assistendivestlus ei ole sama mis vestlusruum.

Privaatne vestlus on kasutaja ja AI vahel.
Vestlusruum on hilisem jagatud ruum teiste osapooltega.

Privaatse assistendivestluse ülesanded

Assistent peaks vestluse alguses tegema neli asja:

1. selgitama, mida platvorm aitab teha;

1. andma kasutajale loa kirjeldada olukorda oma sõnadega;

1. märkima, et SotsiaalAI ei tee ametlikku hindamist ega otsust;

1. pakkuma, et vajadusel saab edasi liikuda teenusekaardi, eelpöördumise, dokumendi, analüüsi või vestlusruumi juurde.

Näiteks platvormi algustekst:

“Kirjelda oma olukorda oma sõnadega. Aitan sul aru saada, millised teemad võivad olla seotud, millist infot oleks vaja täpsustada ja millised järgmised sammud võivad olla asjakohased. Vajadusel saan aidata leida kontakte, koostada pöördumise mustandi, analüüsida dokumenti või valmistada ette suhtlust spetsialisti või teenuseosutajaga. SotsiaalAI ei tee ametlikku hindamist ega teenuseotsust.”

Kiht 2: Teekonnakaart

Teekonnakaart on uus keskne objekt.

See ei ole lihtsalt vastus vestluses. See on platvormi sisemine ja kasutajale nähtav struktuur, mis hoiab olukorra loogikat koos.

Teekonnakaart sisaldab:

- olukorra lühikokkuvõtet;

- seotud valdkondi;

- võimalikke teenuseid;

- võimalikke osapooli;

- puuduolevat infot;

- riskisignaale;

- soovitatud järgmisi samme;

- seotud platvormitööriistu;

- jagamise olekut.

Teekonnakaart tekib pärast esmast vestlust, mitte enne seda.

Teekonnakaardi roll

Teekonnakaart vastab küsimusele:

“Mis võiks olla kasutaja olukorras järgmine mõistlik samm?”

Ta ei vasta küsimusele:

“Millise teenuse inimene kindlasti saab?”

See vahe on väga oluline.

Teekonnakaart ei tee otsust.
Teekonnakaart aitab liikuda.

Näide

Kasutaja kirjutab:

“Mu lapsel lõpeb rehabilitatsiooniteenus, koolis on raskused ja transport on keeruline.”

Teekonnakaart võib kuvada:

Seotud teemad:

- lapse ja pere tugi;

- rehabilitatsiooniteenuse jätkumine;

- KOV sotsiaalvaldkond;

- kooli tugivõrgustik;

- transport või ligipääs.

Puuduv info:

- millises KOV-is inimene elab;

- millal teenus lõpeb;

- kes on praegune teenuseosutaja;

- kas KOV on juba kaasatud;

- kas varasem teenuseplaan või otsus on olemas.

Võimalikud järgmised sammud:

- ava teenusekaart eelfiltreeritud vaates;

- koosta teenuse jätkumise päring;

- laadi varasem dokument analüüsiks;

- koosta eelpöördumine KOV-ile;

- vali, kas soovid küsimustiku täita ise või koos spetsialistiga.

Kiht 3: Nähtavad tööriistad

Need on kasutaja jaoks konkreetsed funktsioonid.

Praegu on sul juba olemas või arendamisel:

- töölaud;

- assistendid ja agendid;

- eelpöördumine;

- teenusekaart;

- teenuseprofiil;

- pöördumiste vastuvõtt;

- vestlusruumid;

- dokumendi koostamine;

- dokumendi analüüs;

- dokumendid ja hoidla;

- süvauuring;

- abisoovid ja abipakkumised;

- kovisioon ja praktikanäited;

- tööheaolu;

- materjalide lisamine;

- SotsiaalAI teadmusbaas.

Uues arhitektuuris ei kao ükski neist ära. Muutub nende kasutusloogika.

Praegu võib kasutaja valida tööriista otse.
Uues mudelis võib kasutaja jõuda tööriistani ka teekonnakaardi kaudu.

Näiteks:

| Teekonnakaardi vajadus | Sobiv tööriist |
| --- | --- |
| Inimene ei tea, kuhu pöörduda | Teenusekaart |
| Inimene tahab endast märku anda | Eelpöördumine |
| Inimene ei saa dokumendist aru | Dokumendi analüüs |
| Vaja on koostada kiri või avaldus | Dokumendi koostamine |
| Vaja on suhelda valitud osapoolega | Vestlusruum |
| Teenuseosutaja soovib nähtavust | Teenuseprofiil |
| Spetsialist saab pöördumise | Pöördumiste vastuvõtt |
| Juhtum vajab kolleegidega arutelu | Kovisioon |
| Vajalik on põhjalikum allikapõhine ülevaade | Süvauuring |

Tööriistad ei ole enam menüüpunktid, vaid teekonna tegevused

See on arhitektuurne muutus.

Näiteks eelpöördumine ei ole lihtsalt eraldi vorm. See on teekonnakaardi võimalik väljund.

Teenusekaart ei ole lihtsalt kaart. See on teekonnakaardi osapoolte ja ligipääsuteede leidmise kiht.

Vestlusruum ei ole lihtsalt chat. See on teekonna jagatud koostööetapp.

Dokumendi koostamine ei ole lihtsalt tekstigeneraator. See on teekonna dokumenteerimise ja suhtluse ettevalmistamise kiht.

Kiht 4: Läbivad usaldus- ja kaitsekihid

Need on taustal töötavad mehhanismid, mitte kasutaja tavapärased tööriistad.

Siia kuuluvad:

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine;

- allikate kuvamine;

- allikate staatuse eristamine;

- rollipõhine ligipääs;

- nõusolekupõhine jagamine;

- anonümiseerimise tugi;

- heli ja transkriptsiooni nõusolekuloogika;

- jagatava eelinfo kinnitamine enne saatmist.

Neid ei peaks pakettide tabelis esitama samamoodi nagu “dokumendi koostamine” või “teenusekaart”. Need on platvormi usaldusraam.

Privaatsuse eelkiht

Privaatsuse eelkiht töötab eriti:

- eelpöördumises;

- dokumendi koostamisel;

- kovisioonis;

- vestlusruumis;

- materjalide lisamisel;

- jagatava eelinfo koostamisel.

Ta aitab märgata liigseid andmeid enne, kui tekst salvestatakse, saadetakse või jagatakse.

Näide:

“Selles tekstis võib olla isikukood või täpne aadress. Kas see info on selle pöördumise jaoks vajalik?”

Kriisi- ja ohusuunamine

Kriisi- ja ohusuunamine ei ole tavakasutaja valitav moodul. See käivitub siis, kui kasutaja kirjelduses ilmneb vahetu oht, vägivald, suitsiidirisk, lapse ohustatus või muu kriitiline olukord.

Sellisel juhul ei tohiks platvorm lihtsalt jätkata rahulikku dokumendimustandi koostamist. Ta peab kuvama kiire abi kanalid ja vajadusel suunama kasutajat kohese abi poole.

Allikate staatus

Allikate loogika muutub eriti oluliseks reformide ja teenuste puhul.

Allikas ei ole lihtsalt “kasutatud materjal”. Sellel peab olema staatus:

- kehtiv õigus;

- KOV info;

- SKA juhend;

- teenusepõhine juhend;

- teenuseosutaja profiil;

- eelnõuline info;

- muutuv info;

- artikkel või analüüs;

- kontrollimist vajav info.

See aitab assistendil mitte esitada eelnõulist infot kehtiva korrana.

2.3. Kasutaja vaade

Pöörduja

Pöörduja ei näe nelja kihi arhitektuuri. Tema näeb lihtsat kogemust:

1. avaneb privaatne vestlus;

1. ta kirjeldab olukorda;

1. SotsiaalAI teeb esmase teekonnakaardi;

1. kasutaja näeb soovitatud samme;

1. ta valib, kas avada teenusekaart, koostada pöördumine, analüüsida dokumenti või jätkata vestlust;

1. info liigub edasi ainult siis, kui ta selle kinnitab ja saadab.

Pöörduja jaoks on põhisõnum:

“Sa ei pea teadma, millise asutuse või teenuse poole kohe pöörduda. Kirjelda olukorda ja SotsiaalAI aitab sul järgmise sammu ette valmistada.”

Sotsiaaltöö spetsialist

Spetsialisti jaoks muutub platvorm töövoo korrastajaks.

Tema võib kasutada SotsiaalAI-d:

- juhtumi teekonnakaardi loomiseks;

- pöördumise eelinfo lugemiseks;

- inimesele lihtsas keeles selgituse koostamiseks;

- juhtumikokkuvõtte koostamiseks;

- teenuse või õigusliku aluse otsimiseks;

- kovisiooni või praktikanäite koostamiseks;

- dokumentide ja otsuste analüüsimiseks.

Spetsialisti jaoks on põhisõnum:

“SotsiaalAI aitab juhtumi infot korrastada, kontrollitavaid mustandeid koostada ja allikapõhist tausta leida, kuid lõppotsus ja professionaalne vastutus jäävad spetsialistile.”

Teenuseosutaja

Teenuseosutaja jaoks on platvorm nähtavuse ja pöördumiste haldamise keskkond.

Tema saab:

- hallata teenuseprofiili;

- kirjeldada teenuseid, sihtrühmi, piirkonda ja ligipääsetavust;

- märkida, kas võtab vastu eelpöördumisi;

- saada struktureeritud pöördumisi;

- avada vajadusel vestlusruumi;

- selgitada teenusele jõudmise tingimusi.

Teenuseosutaja jaoks on põhisõnum:

“SotsiaalAI aitab sobivatel inimestel ja spetsialistidel teenuse kohta selgemalt infot leida ning saata paremini ettevalmistatud pöördumisi.”

2.4. Süsteemi loogika

Süsteemis võiks uus teekonnaloogika liikuda nii:

LOGIN
↓
PRIVATE_ASSISTANT_CHAT
↓
INITIAL_SITUATION_CAPTURE
↓
JOURNEY_MAP_CREATED
↓
RECOMMENDED_ACTIONS
↓
USER_SELECTS_ACTION
↓
FEATURE_LAUNCH
↓
OPTIONAL_SHARE / SAVE / CONTINUE

Täpsustatud kujul:

Kasutaja logib sisse
→ avaneb privaatne assistendivestlus
→ kasutaja kirjeldab olukorda
→ assistent tuvastab teemad, riskid ja puuduva info
→ süsteem loob esmase teekonnakaardi
→ teekonnakaart pakub sobivaid tööriistu
→ kasutaja valib järgmise sammu
→ tööriist avaneb teekonna kontekstiga
→ kasutaja kinnitab, mida salvestada või jagada

2.5. Seotud olemasolevad funktsioonid

See arhitektuur mõjutab peaaegu kõiki olemasolevaid funktsioone, aga erineval määral.

Tugevalt mõjutatud

- assistendid ja agendid;

- teekonnakaart uue objektina;

- eelpöördumine;

- teenusekaart;

- teenuseprofiil;

- pöördumiste vastuvõtt;

- vestlusruumid;

- dokumendi koostamine;

- dokumendi analüüs;

- teadmusbaas;

- allikate kuvamine.

Mõõdukalt mõjutatud

- töölaud;

- dokumendid ja hoidla;

- süvauuring;

- materjalide lisamine;

- abisoovid ja abipakkumised.

Kaudselt seotud

- kovisioon;

- praktikanäited;

- tööheaolu.

2.6. Uued arendused

Selle arhitektuuri jaoks on vaja juurde luua või muuta vähemalt järgmised komponendid.

1. Teekonnakaardi andmemudel

Näiteks:

{
"id": "journey_123",
"ownerUserId": "user_123",
"roleContext": "CLIENT",
"status": "PRIVATE",
"summary": "Lapse rehabilitatsiooniteenuse jätkumisega seotud mure.",
"domains": ["CHILD_FAMILY", "KOV", "REHABILITATION", "TRANSPORT"],
"riskSignals": ["SERVICE_CONTINUITY_RISK"],
"missingInfo": ["municipality", "serviceEndDate", "currentProvider"],
"suggestedActions": [
{
"type": "OPEN_SERVICE_MAP",
"label": "Leia KOV kontakt või teenuseosutaja"
},
{
"type": "CREATE_PRE_CONTACT",
"label": "Koosta eelpöördumine"
},
{
"type": "ANALYZE_DOCUMENT",
"label": "Laadi varasem dokument analüüsiks"
}
],
"participants": [],
"createdAt": "2026-05-25T12:00:00Z",
"updatedAt": "2026-05-25T12:20:00Z"
}

2. Teekonnakaardi olekud

- privaatne;

- täpsustamisel;

- valmis järgmisteks sammudeks;

- kontaktid soovitatud;

- osapool valitud;

- eelpöördumine koostamisel;

- eelpöördumine saadetud;

- vestlusruum avatud;

- lõpetatud.

3. Tööriistade käivitamine teekonnakaardi kontekstist

Näiteks:

- teenusekaart avaneb juba filtritega;

- eelpöördumine avaneb juba olukorra kokkuvõttega;

- dokumendi koostamine saab teekonnast sisendi;

- dokumendi analüüs seotakse teekonnaga;

- vestlusruum saab jagatud eelinfo.

4. Jagamise kontroll

Enne jagamist peab kasutaja nägema:

- mida jagatakse;

- kellele jagatakse;

- miks see info vajalik on;

- kas mõni tundlik info võiks olla eemaldatav;

- kas ta kinnitab saatmise.

5. Allikastaatuse tugi

Teadmusbaas peab suutma eristada:

- kehtiv info;

- juhend;

- KOV info;

- teenuseosutaja info;

- eelnõuline info;

- muutuv info;

- kontrollimist vajav info.

2.7. Piirid ja ohukohad

1. Teekonnakaart ei ole ametlik hindamine

Seda peab platvormil selgelt ütlema.

Õige sõnastus:

“Teekonnakaart aitab olukorda korrastada ja järgmisi samme ette valmistada. See ei ole ametlik abivajaduse hindamine ega teenuseotsus.”

2. SotsiaalAI ei suuna teenusele

Õige sõnastus:

“See teenus võib olla asjakohane teema, kuid teenusele jõudmine võib eeldada KOV-i, arsti, teenuseosutaja või muu pädeva osapoole hindamist, otsust või suunamist.”

3. Soovitatud kontakt ei ole kaasatud osapool

Kui teenusekaart pakub kontakti, siis kontakt ei näe kasutaja infot.

Info liigub edasi alles siis, kui kasutaja:

- valib kontakti;

- koostab jagatava info;

- kinnitab saatmise;

- saadab pöördumise või kutsub osapoole ruumi.

4. Privaatne vestlus ei ole jagatud vestlusruum

See peab olema kasutajale selge.

Privaatne assistendivestlus jääb kasutajale.
Jagatud vestlusruum tekib ainult kasutaja teadliku tegevusega.

5. Reformiinfo ei tohi seguneda kehtiva õigusega

Allikate staatus peab vältima olukorda, kus eelnõuline info esitatakse kehtiva korrana.

2.8. Soovituslik tekst platvormile

Lühikirjeldus

SotsiaalAI algab privaatsest vestlusest assistendiga. Kasutaja saab kirjeldada oma olukorda oma sõnadega ning platvorm aitab selle põhjal koostada teekonnakaardi: millised teemad võivad olla seotud, millist infot oleks vaja täpsustada ja millised järgmised sammud võiksid olla asjakohased. Teekonnakaart võib suunata kasutaja teenusekaardi, eelpöördumise, dokumendi koostamise, dokumendi analüüsi või vestlusruumi juurde.

Pikem kirjeldus

SotsiaalAI ei eelda, et kasutaja teab kohe, millist tööriista valida. Platvormi keskmes on privaatne assistendivestlus, kus kasutaja saab oma olukorda kirjeldada. Selle põhjal loob SotsiaalAI esmase teekonnakaardi, mis aitab näha seotud valdkondi, võimalikke osapooli, puuduolevat infot ja järgmisi samme. Kasutaja otsustab ise, kas ta soovib avada teenusekaardi, koostada eelpöördumise, analüüsida dokumenti, luua mustandi või kutsuda hiljem osapooled vestlusruumi. Jagatud osapooled näevad ainult seda infot, mille kasutaja on kinnitanud ja neile edastanud.

Usalduskihtide kirjeldus

Kõiki töövooge toetavad läbivad usalduskihid: privaatsuse eelkontroll, kriisi- ja ohusignaalide märkamine, allikate kuvamine, rollipõhine ligipääs ja nõusolekupõhine jagamine. Need ei asenda spetsialisti otsust, kuid aitavad kasutada platvormi turvalisemalt ja läbipaistvamalt.

2.9. Kokkuvõte

Platvormi uus arhitektuurne mudel võiks olla:

Privaatne assistendivestlus → teekonnakaart → nähtavad tööriistad → läbivad usalduskihid.

See tähendab, et kasutaja ei pea alustades teadma, kas tal on vaja eelpöördumist, teenusekaarti, dokumenti või vestlusruumi. Ta kirjeldab olukorda ja SotsiaalAI aitab luua teekonna järgmise sammuni.

Kõige olulisem muutus on see:

SotsiaalAI ei ole enam ainult rollipõhine tööriistade platvorm, vaid olukorrapõhine juhendatud teenuseteekonna platvorm.

# 3. Teekonnakaart kui platvormi uus kese

Teekonnakaart on SotsiaalAI uue mudeli keskne objekt. See ei ole lihtsalt üks lisafunktsioon, vaid tööloogika, mis seob kasutaja olukorra, assistendivestluse, teadmuspõhja, teenusekaardi, eelpöördumise, dokumendid ja vestlusruumid üheks arusaadavaks teekonnaks.

Kõige lühemalt:

Teekonnakaart on olukorrapõhine juhtkiht, mis aitab kasutajal aru saada, mis tema olukorras võib olla seotud, milline info on puudu, millised kontaktid või tööriistad võivad olla asjakohased ja mis võiks olla järgmine praktiline samm.

3.1. Põhimõte

SotsiaalAI kasutaja ei peaks alustama sellest, et ta peab teadma õige teenuse, vormi või asutuse nime.

Ta võib alustada lihtsalt olukorra kirjeldamisest:

- “Ma ei tea, kuhu pöörduda.”

- “Mul on kodus raske hakkama saada.”

- “Mu teenus lõpeb ja ma ei tea, mis edasi saab.”

- “Mul on dokument, millest ma ei saa aru.”

- “Ma ei tea, kas see on KOV, teenuseosutaja või tervise küsimus.”

- “Ma tahaks spetsialistile kirjutada, aga ei oska.”

SotsiaalAI teeb selle põhjal esmase teekonnasõela ja loob teekonnakaardi.

Teekonnakaart ei anna lõplikku otsust. Ta aitab liikuda:

olukorra kirjeldus
→ seotud teemad
→ puuduolev info
→ võimalikud kontaktisuunad
→ sobivad tööriistad
→ järgmine samm

3.2. Mida teekonnakaart ei ole?

See piir peab olema väga selge.

Teekonnakaart ei ole:

- ametlik abivajaduse hindamine;

- STAR2 hindamine;

- KOV otsus;

- teenuse määramine;

- meditsiiniline hinnang;

- ametlik teenusele suunamine;

- spetsialisti töö asendaja.

Teekonnakaart on:

- olukorra korrastamise tööriist;

- esmase suuna andja;

- järgmise sammu valiku abivahend;

- eelpöördumise või eelinfo ettevalmistaja;

- teenusekaardi ja muude tööriistade käivitaja;

- kasutaja kontrollitav privaatne töökaart.

Kõige olulisem sõnastus:

Teekonnakaart aitab mõista võimalikke järgmisi samme, kuid ametliku hindamise, otsuse või teenusele suunamise teeb pädev spetsialist või asutus.

3.3. Tervisekontakti lisandumine teekonnakaardile

Teekonnakaardi põhiloogika jääb sotsiaalvaldkonna keskseks, kuid arvestab, et inimese olukord võib mõnikord vajada esmalt või paralleelselt tervisekontakti.

See tähendab, et teekonnakaart ei suuna iga muret automaatselt KOV sotsiaaltöötaja poole.

Mõnel juhul võib esmane järgmine samm olla:

- perearstikeskus;

- pereõde;

- tervisekeskus;

- ametlik tervisenõu;

- kiire ohu korral 112 või erakorraline abi.

Samas ei tähenda see, et SotsiaalAI muutuks terviseplatvormiks. Tervisekontakt on teekonnakaardil ainult üks võimalik kontaktisuund, kui inimese kirjeldus viitab tervisemurele, ravijärgsele küsimusele, arstliku hinnangu vajadusele või olukorrale, kus sotsiaalteenuse kõrval on tervisega seotud täpsustus vajalik.

Õige sõnastus:

Sinu kirjelduses võib olla tervisega seotud küsimus. Esmane järgmine samm võib olla perearstikeskus või tervisekeskus. SotsiaalAI ei anna meditsiinilist hinnangut, kuid saab aidata küsimused selgelt sõnastada ja eristada, milline osa olukorrast võib vajada KOV sotsiaalvaldkonna tuge.

3.4. Teekonnakaardi võimalikud põhisuunad

Teekonnakaart võiks tuvastada esmase suuna ehk primaryPath.

Võimalikud suunad:

| Suund | Millal sobib? | Võimalik järgmine samm |
| --- | --- | --- |
| Sotsiaalne teekond | igapäevane toimetulek, kodune abi, hoolduskoormus, sotsiaaltransport, tugiisik, KOV teenused | KOV kontakt, teenusekaart, eelpöördumine |
| Tervisekontakti teekond | tervisemure, ravijärgne küsimus, arstliku hinnangu vajadus, terviseinfo täpsustamine | perearstikeskus, tervisekeskus, küsimused tervisekontaktile |
| Kombineeritud teekond | tervise- ja sotsiaalne vajadus on põimunud | KOV kontakt + tervisekontakt + dokumentide analüüs |
| Teenuseosutaja teekond | inimene otsib konkreetset teenust või teenuse tingimusi | teenuseosutaja, teenuseprofiil, tingimuste küsimus |
| Teenusekatkemise teekond | olemasolev teenus võib lõppeda või katkeda | teenusekatkemise kontroll, dokument, KOV/teenuseosutaja pöördumine |
| Dokumendist lähtuv teekond | kasutajal on otsus, plaan, kiri või muu dokument | dokumendi analüüs, küsimused, pöördumise mustand |
| Kogukondliku abi teekond | vaja on praktilist või inimestevahelist abi, mitte ametlikku teenust | abisoov või abipakkumine |
| Kriisi või ohu teekond | vahetu oht, vägivald, enesevigastamise risk, lapse tõsine ohustatus | kriisi- ja ohusuunamine |

3.5. Pöörduja vaade

Pöörduja jaoks peab teekonnakaart olema lihtne ja praktiline.

Ta ei peaks nägema keerulist süsteemikaarti, vaid vastuseid küsimustele:

- mis minu olukorras võib olla seotud;

- mis info on veel puudu;

- kelle poole võiks pöörduda;

- mida ma saan praegu teha;

- mida ma jagan ja kellele;

- kas see on minu privaatne teekond või juba saadetud info.

Näide pöördujale:

Sinu olukorra põhjal võivad olla seotud:

- KOV sotsiaalvaldkonna kontakt;

- koduse toimetuleku või sotsiaalteenuse küsimus;

- võimalik tervisekontakt, kui mure on seotud tervise või ravijärgse olukorraga;

- varasem otsus või teenuseplaan;

- teenuse jätkumise küsimus.

Võimalikud järgmised sammud:

- ava teenusekaart;

- leia KOV kontakt;

- koosta lühike eelpöördumine;

- lisa dokument analüüsiks;

- koosta küsimused perearstikeskusele või tervisekeskusele;

- märgi, et soovid eelkaardistust täita koos spetsialistiga.

3.6. Spetsialisti vaade

Spetsialisti jaoks on teekonnakaart töövahend.

See aitab:

- näha inimese kinnitatud eelinfot;

- eristada, millised eluvaldkonnad võivad olla seotud;

- märgata puuduolevat infot;

- valmistada ette kohtumist või vestlust;

- näha teenusekatkemise riski;

- kasutada dokumendi analüüsi;

- koostada memo või vastuse mustand;

- koostada inimesele lihtsas keeles selgitus;

- otsustada, kas vaja on ametlikku hindamist või muud tööalast sammu.

Spetsialisti vaates võib teekonnakaart olla täpsem:

- seotud eluvaldkonnad;

- riskisignaalid;

- varasemad dokumendid;

- võimalik KOV teenus;

- võimalik teenuseosutaja;

- võimalik tervisekontakti vajadus;

- puuduolev info;

- allikad ja teenuseni jõudmise loogika.

Oluline piir:

Spetsialist näeb ainult kasutaja kinnitatud ja jagatud teekonna osa. Privaatset assistendivestlust ega sisemist teekonnasõela ei jagata automaatselt.

3.7. Teenuseosutaja vaade

Teenuseosutaja ei vaja kogu inimese laia teekonnakaarti. Tema jaoks peab teekonnakaart olema teenusega seotud ja piiratud.

Teenuseosutaja võib näha:

- millise teenuse kohta pöördutakse;

- milline on inimese peamine küsimus;

- kas inimene soovib teada teenuse tingimusi;

- kas teenus võib vajada KOV otsust või suunamist;

- milline info on puudu;

- kas inimene soovib vestlusruumi, eelvestlust või kohtumist.

Teenuseosutaja ei peaks automaatselt nägema kogu täisealise abivajaduse eelkaardistust, kui see ei ole tema teenuse jaoks vajalik.

Õige põhimõte:

Teenuseosutajale jagatakse teenusega seotud eelinfo, mitte kogu inimese privaatne teekond.

3.8. Teekonnakaardi põhiosad

Teekonnakaardil võiks olla järgmised osad.

1. Olukorra kokkuvõte

Lühike neutraalne kokkuvõte kasutaja kirjeldusest.

Näide:

Kasutaja kirjeldab, et pärast tervisemuutust on kodus toimetulek raskem ning ta ei tea, kas pöörduda KOV sotsiaalvaldkonna kontakti või tervisekontakti poole.

See kokkuvõte peab olema kasutaja poolt muudetav.

2. Seotud teemad

Teekonnakaart tuvastab, millised teemad võivad olla seotud.

Näiteks:

- igapäevane toimetulek;

- füüsiline tervis ja liikumine;

- kodune abi;

- KOV sotsiaalteenused;

- sotsiaaltransport;

- teenuseosutaja;

- tervisekontakt;

- dokumendid ja otsused;

- teenuse jätkumine;

- kogukondlik abi.

Need ei ole lõplikud hinnangud, vaid esialgsed teemad.

3. Puuduolev info

Teekonnakaart märgib, mida oleks vaja täpsustada.

Näiteks:

- millises KOV-is inimene elab;

- kas teenus on praegu olemas;

- kas teenus lõpeb;

- kas on olemas otsus või teenuseplaan;

- kas KOV on juba kaasatud;

- kas tervisemure on juba perearstile teada;

- kas inimene soovib kirjutada, helistada, kohtuda või täita küsimustiku koos spetsialistiga.

4. Võimalikud kontaktisuunad

Teekonnakaart võib pakkuda kontaktisuundi.

Näiteks:

- KOV sotsiaalvaldkonna kontakt;

- KOV teenuse kontakt;

- teenuseosutaja;

- perearstikeskus või tervisekeskus;

- abisoovi/abipakkumise haru;

- kriisiabi, kui on vahetu oht.

Oluline:

Kontaktisuund ei tähenda, et kontakt on kaasatud või näeb kasutaja infot.

5. Riskisignaalid

Teekonnakaart võib märkida tähelepanukohti.

Näiteks:

- võimalik teenusekatkemise risk;

- kiire täpsustamise vajadus;

- dokument vajab ülevaatamist;

- tervisekontakt võib olla esmane samm;

- kriisi- või ohusignaal;

- info on ebapiisav.

Riskisignaal ei ole ametlik hinnang. See on tähelepanumärge.

6. Soovitatud järgmised sammud

Teekonnakaart pakub kasutajale tööriistu, mitte ei sunni ühte rada.

Võimalikud nupud:

- Ava teenusekaart

- Leia KOV kontakt

- Koosta eelpöördumine

- Täida eelkaardistus

- Soovin täita koos spetsialistiga

- Lisa dokument analüüsiks

- Koosta küsimused tervisekontaktile

- Loo abisoov

- Paku vestlusruumi

- Salvesta teekond

3.9. Teekonnakaart kui tööriistade ühendaja

Teekonnakaart seob olemasolevad funktsioonid.

| Teekonnakaardi olukord | Sobiv SotsiaalAI tööriist |
| --- | --- |
| Kasutaja ei tea, kuhu pöörduda | Teenusekaart |
| Kasutaja tahab endast märku anda | Eelpöördumine |
| Kasutaja ei jaksa vormi üksi täita | Juhendatud eelkaardistus |
| Teenus võib katkeda | Teenusekatkemise kontroll |
| Inimesel on otsus või plaan | Dokumendi analüüs |
| Vaja on kirjutada kiri | Dokumendi koostamine |
| Vaja on suhelda spetsialistiga | Vestlusruum |
| Vaja on tervisemure esmalt täpsustada | Tervisekontakti küsimused |
| Vaja on praktilist abi | Abisoovid ja abipakkumised |
| Spetsialist sai pöördumise | Pöördumiste vastuvõtt |
| Teenuseosutaja peab olema leitav | Teenuseprofiil |
| Vaja on allikapõhist ülevaadet | Süvauuring |
| Juhtumit tuleb kolleegidega arutada | Kovisioon |

3.10. Teekonnakaardi olekud lühidalt

Teekonnakaart on alguses alati privaatne.

Võimalikud üldolekud:

- privaatne;

- täpsustamisel;

- valmis järgmisteks sammudeks;

- kontakt soovitatud;

- osapool valitud;

- jagamiseks ettevalmistamisel;

- eelpöördumine saadetud;

- vastuvõtja ülevaatamisel;

- vestlusruum avatud;

- lõpetatud;

- arhiveeritud.

Tervisekontakt ei vaja eraldi olekuloogikat. Ta on lihtsalt üks võimalik soovitatud kontaktisuund või osapool:

- soovitatud tervisekontakt;

- kasutaja poolt valitud;

- küsimuse mustand koostamisel;

- kasutaja avab kontakti või saadab küsimuse väljaspool platvormi;

- vajadusel märgitakse järgmine samm tehtuks.

3.11. Tervisekontakt kui osapool teekonnakaardil

Tervisekontakt võib teekonnakaardil olla osapool, kuid ta ei ole automaatselt kaasatud.

Näide:

{
"type": "HEALTH_CONTACT",
"subtype": "FAMILY_DOCTOR_CENTER",
"status": "SUGGESTED",
"visibility": "OWNER_ONLY",
"roleOnJourney": "Tervisemure, ravijärgse küsimuse või arstliku hinnangu esmaseks täpsustamiseks"
}

Kasutajale tuleb näidata:

See tervisekontakt on soovitatud sinu kirjelduse põhjal. Kontakt ei näe sinu infot enne, kui sa ise otsustad temaga ühendust võtta või koostatud küsimuse saata.

MVP-s võib tervisekontakti puhul piisata sellest, et SotsiaalAI koostab küsimuste mustandi, mitte ei loo platvormisisest pöördumiste vastuvõttu.

3.12. Teekonnakaardi andmemudel

Teekonnakaardi mudel võiks sisaldada nii sotsiaal-, teenuse-, tervise- kui ka dokumendisuundi.

{
"id": "journey_001",
"ownerUserId": "user_001",
"roleContext": "CLIENT",
"status": "PRIVATE",
"title": "Koduse toimetuleku ja tervisemuutuse mure",
"summary": "Kasutaja kirjeldab, et pärast tervisemuutust on kodus raskem toime tulla ja ta ei tea, kas pöörduda KOV-i või tervisekontakti poole.",
"primaryPath": "COMBINED",
"secondaryPaths": [
"KOV_SOCIAL_SERVICES",
"HEALTH_CONTACT"
],
"domains": [
"DAILY_LIVING",
"PHYSICAL_HEALTH",
"HOME_SUPPORT"
],
"riskSignals": [
{
"type": "SERVICE_CONTINUITY",
"level": "NEEDS_CHECK",
"description": "Kasutaja mainib varasema toe võimalikku lõppemist, kuid lõppkuupäev puudub."
}
],
"missingInfo": [
"municipality",
"existingDecisionOrPlan",
"whetherHealthContactAlreadyInvolved"
],
"suggestedParties": [
{
"type": "KOV_CONTACT",
"status": "SUGGESTED",
"roleOnJourney": "Võimalik esimene kontakt KOV sotsiaalteenuste ja abivajaduse täpsustamiseks"
},
{
"type": "HEALTH_CONTACT",
"subtype": "FAMILY_DOCTOR_CENTER",
"status": "SUGGESTED",
"roleOnJourney": "Võimalik kontakt tervisemure või arstliku hinnangu täpsustamiseks"
}
],
"suggestedActions": [
{
"type": "OPEN_SERVICE_MAP",
"label": "Leia KOV kontakt või teenuseosutaja"
},
{
"type": "CREATE_PRECONTACT",
"label": "Koosta eelpöördumine"
},
{
"type": "CREATE_HEALTH_CONTACT_QUESTIONS",
"label": "Koosta küsimused tervisekontaktile"
},
{
"type": "ANALYZE_DOCUMENT",
"label": "Lisa otsus või dokument analüüsiks"
}
],
"sharingStatus": "NOT_SHARED"
}

3.13. Teekonnakaardi loomise protsess

Teekonnakaart võiks tekkida kolmes etapis.

Etapp 1: Vaba kirjeldus

Kasutaja kirjutab oma olukorra assistendile.

Näide:

“Mul on pärast haigust raske kodus hakkama saada. Ei tea, kas peaks pöörduma sotsiaaltöötaja või perearsti poole.”

Etapp 2: Esmane teekonnasõel

Assistent tuvastab:

- sotsiaalne toimetulek;

- tervisega seotud küsimus;

- võimalik kombineeritud teekond;

- puuduolev info: KOV, kas perearst on kaasatud, kas on otsus või dokument.

Assistent ei tee ametlikku hindamist. Ta teeb esmase sõela.

Etapp 3: Teekonnakaart ja tööriistad

Kasutajale kuvatakse teekonnakaart.

Näiteks:

Sinu kirjelduses võivad olla seotud kaks suunda:

1. KOV sotsiaalvaldkond — koduse toimetuleku ja võimalike sotsiaalteenuste täpsustamiseks.

1. Tervisekontakt — tervisemure, ravijärgse olukorra või arstliku hinnangu täpsustamiseks.

Võimalikud järgmised sammud:

- leia KOV kontakt;

- koosta KOV-ile eelpöördumine;

- koosta küsimused perearstikeskusele;

- lisa dokument analüüsiks.

3.14. Jagamise loogika

Teekonnakaart on vaikimisi privaatne.

Sellel on mitu jagamise taset.

| Tase | Kes näeb? | Sisu |
| --- | --- | --- |
| Privaatne teekonnakaart | ainult kasutaja | olukorra esmane kokkuvõte, AI sõel, soovitused |
| Jagatav eelinfo | kasutaja kuni kinnitamiseni | puhastatud kokkuvõte |
| Saadetud eelpöördumine | valitud vastuvõtja | kasutaja kinnitatud info |
| Vestlusruumi info | ruumi liikmed | ainult ruumis jagatud sisu |
| Dokument | kasutaja või valitud osapooled | kinnitatud fail või kokkuvõte |

Tervisekontakti puhul võib MVP-s jagamine toimuda pigem nii:

- SotsiaalAI koostab küsimuste mustandi;

- kasutaja kopeerib selle või avab e-kirjana;

- tervisekontakt ei ole automaatselt SotsiaalAI platvormi osaline.

3.15. Piirid ja riskid

Teekonnakaart peab vältima viit viga.

1. Ametliku hindamise mulje

Vale:

“Sinu abivajadus on hinnatud.”

Õige:

“Teekonnakaart aitab sinu kirjeldatud olukorda korrastada. Ametliku abivajaduse hindamise teeb pädev spetsialist või asutus.”

2. Teenuse määramise mulje

Vale:

“Sul on vaja koduteenust.”

Õige:

“Koduteenus võib olla üks võimalik teema, mida KOV spetsialistiga arutada. KOV hindab abivajadust ja otsustab sobiva abi.”

3. Tervishoiunõu andmise mulje

Vale:

“Sul on vaja perearsti suunamist.”

Õige:

“Kirjeldus võib viidata tervisega seotud küsimusele. Selle täpsustamiseks võib esmane kontakt olla perearstikeskus või tervisekeskus.”

4. Automaatse jagamise mulje

Vale:

“Soovitatud kontakt näeb sinu teekonda.”

Õige:

“Soovitatud kontakt ei näe sinu infot enne, kui sa selle ise kinnitad ja jagad.”

5. Reformiinfo liiga kindel esitamine

Vale:

“Uue reformi järgi toimub see kindlasti nii.”

Õige:

“See võib puudutada muutuvat või kavandatavat korraldust ning vajab ajakohast kontrolli.”

3.16. Seos teadmuspõhjaga

Teekonnakaart vajab teadmuspõhjalt rohkem kui tavalist tekstivastust.

Teadmuspõhi peab toetama:

- teenuse kirjeldust;

- teenuseni jõudmise loogikat;

- kas vaja on KOV hindamist;

- kas vaja on KOV otsust;

- kas esmane samm võib olla tervisekontakt;

- milline kontakt on seotud;

- milline info on kehtiv või muutuv;

- millised allikad vastust toetavad.

Tervisekontakti puhul peab teadmuspõhi olema kitsas:

- perearstikeskused;

- tervisekeskused;

- ametlikud tervisenõu kontaktid;

- mitte eriarstid, ravijärjekorrad või haiglate üldkaart.

3.17. Kasutajatekstid

Pöördujale

Teekonnakaart aitab sinu kirjeldatud olukorra põhjal näha, millised teemad võivad olla seotud, milline info vajab täpsustamist ja millised järgmised sammud võiksid olla mõistlikud. See ei ole ametlik hindamine ega teenuseotsus. Sina otsustad, kas soovid avada teenusekaardi, koostada eelpöördumise, analüüsida dokumenti, koostada küsimused tervisekontaktile või jagada infot valitud osapoolega.

Tervisekontakti soovituse juures

Sinu kirjelduses võib olla tervisega seotud küsimus. Esmane järgmine samm võib olla perearstikeskus või tervisekeskus. SotsiaalAI ei anna meditsiinilist hinnangut, kuid saab aidata sul küsimused selgelt sõnastada.

Spetsialistile

Teekonnakaart aitab juhtumi eelinfot struktureerida, tuua välja seotud valdkonnad, puuduoleva info, võimalikud riskid ja järgmised sammud. Kaart toetab töömustandite, eelpöördumiste, lihtsas keeles selgituste ja koostöömemode koostamist, kuid ei asenda spetsialisti hindamist ega otsust.

Teenuseosutajale

Teekonnakaart aitab pöördumise sisu paremini mõista: millise teenusega pöördumine võib haakuda, milline info on puudu ja kas inimene soovib teenuse tingimuste selgitust, eelvestlust või vestlusruumi. Teenuseosutaja näeb ainult kasutaja kinnitatud ja saadetud infot.

3.18. MVP

Esimene teekonnakaardi versioon ei pea olema suur.

MVP võiks teha nii:

1. kasutaja kirjeldab olukorda privaatses vestluses;

1. assistent teeb esmase teekonnasõela;

1. tekib teekonnakaardi mustand;

1. kaart sisaldab:

  - olukorra kokkuvõtet;

  - seotud teemasid;

  - puuduolevat infot;

  - võimalikku põhisuunda;

  - soovitatud järgmisi samme;

1. kaart pakub nuppe:

  - ava teenusekaart;

  - koosta eelpöördumine;

  - lisa dokument analüüsiks;

  - loo abisoov;

  - koosta küsimused tervisekontaktile, kui asjakohane;

1. teekonnakaart on vaikimisi privaatne;

1. jagamine toimub ainult kasutaja kinnitusega.

MVP-s ei pea tervisekontakti kiht olema suur. Piisab sellest, et teekonnakaart oskab märkida:

“See võib vajada tervisekontakti täpsustust.”

ja pakkuda:

“Koosta küsimused perearstikeskusele või tervisekeskusele.”

3.19. Kokkuvõte

Teekonnakaart on SotsiaalAI uue platvormiloogika kese.

See muudab platvormi kasutaja jaoks selgemaks, sest inimene ei pea alustama funktsiooni valikust. Ta alustab oma olukorra kirjeldamisest.

Teekonnakaart aitab vastata neljale põhiküsimusele:

1. Mis minu olukorras võib olla seotud?

1. Mis info on veel puudu?

1. Kes või millised kontaktid võivad olla asjakohased?

1. Mis on järgmine mõistlik samm?

Tervisekontakti lisandumine ei muuda seda põhiloogikat. See lihtsalt aitab vältida valet suunamist olukorras, kus inimese esimene samm ei pruugi olla KOV sotsiaaltöötaja, vaid perearstikeskus, tervisekeskus või muu esmatasandi tervisekontakt.

Kõige lühem sõnastus:

Teekonnakaart aitab inimesel liikuda segasest olukorrakirjeldusest selgema järgmise sammuni, eristades vajadusel KOV sotsiaalvaldkonna, teenuseosutaja, esmase tervisekontakti, dokumendi, abisoovi ja koostööruumi võimalused.

# 4. Teekonnakaardi olekud

Teekonnakaardi olekud on vajalikud selleks, et kasutaja, spetsialist ja teenuseosutaja saaksid aru, mis seisus teekond parasjagu on: kas see on alles privaatne mõtlemine, kas infot täpsustatakse, kas kontakt on ainult soovitatud, kas pöördumine on saadetud või kas vestlusruum on juba avatud.

Uuendatud loogikas lisandub teekonnakaardile ka tervisekontakti võimalus, näiteks perearstikeskus või tervisekeskus. See ei muuda olekute põhiloogikat. Tervisekontakt on lihtsalt üks võimalik soovitatud osapool, samamoodi nagu KOV kontakt või teenuseosutaja. Ta ei näe kasutaja infot enne, kui kasutaja ise otsustab temaga ühendust võtta või koostatud küsimuse saata.

Kõige olulisem põhimõte jääb samaks:

teekonnakaart on alguses alati privaatne ja muutub jagatavaks ainult kasutaja teadliku kinnituse kaudu.

4.1. Eesmärk

Teekonnakaardi olekute eesmärk on teha nähtavaks, kus kasutaja oma abiteekonnas parasjagu asub.

Ilma olekuteta võib tekkida segadus:

- kas see on ainult minu privaatne vestlus;

- kas spetsialist näeb seda juba;

- kas soovitatud kontakt on kaasatud;

- kas tervisekontakt näeb minu infot;

- kas pöördumine on saadetud;

- kas teenuseosutaja on teekonnale lisatud;

- kas järgmine samm on minu või vastuvõtja käes;

- kas vestlusruum on avatud;

- kas teekond on lõppenud või pooleli.

Olekud annavad nendele küsimustele selge vastuse.

4.2. Kolm olekute tasandit

Teekonnakaardil ei tohiks olla ainult üks üldine staatus. Vaja on kolme tasandit:

1. teekonnakaardi üldolek

1. osapoolte olekud

1. tegevuste või sammude olekud

Need on erinevad asjad.

Näiteks:

- teekonnakaardi üldolek võib olla privaatne;

- KOV kontakt võib olla soovitatud;

- tervisekontakt võib olla soovitatud;

- eelpöördumine võib olla mustandis;

- dokumendi analüüs võib olla pooleli.

See hoiab ära olukorra, kus üks staatus peab kirjeldama liiga palju eri asju korraga.

4.3. Teekonnakaardi üldolekud

1. Privaatne

See on vaikimisi algolek.

Tekib siis, kui kasutaja kirjeldab olukorda privaatses assistendivestluses ja SotsiaalAI loob esmase teekonnakaardi.

Kes näeb?
Ainult kasutaja.

Mida see tähendab?

- teekonnakaart on kasutaja privaatne töökaart;

- spetsialistid ei näe seda;

- teenuseosutajad ei näe seda;

- soovitatud KOV kontaktid ei näe seda;

- soovitatud tervisekontaktid ei näe seda;

- soovitatud osapooled on ainult võimalikud suunad;

- kasutaja saab infot täiendada, muuta või kustutada;

- midagi ei ole veel jagatud.

Kasutajale sobiv tekst:

See teekonnakaart on praegu privaatne. Soovitatud kontaktid, spetsialistid, teenuseosutajad ja tervisekontaktid ei näe sinu infot enne, kui sa selle ise kinnitad ja jagad.

2. Täpsustamisel

See olek tähendab, et teekonnakaart vajab parema järgmise sammu pakkumiseks lisainfot.

Näiteks puudub:

- KOV või piirkond;

- kas inimene pöördub enda või kellegi teise eest;

- kas teenus on juba olemas;

- kas teenus on lõppemas;

- kas on olemas otsus, teenuseplaan või muu dokument;

- kas KOV on juba kaasatud;

- kas teenuseosutaja on juba kaasatud;

- kas tervisemure on juba perearstile või tervisekeskusele teada;

- kas inimene soovib pöördumist, eelkaardistust, dokumendi analüüsi või ainult infot.

Kasutajale sobiv tekst:

Teekonnakaart vajab veel täpsustamist. Vastates mõnele küsimusele saan pakkuda sobivamaid kontakte ja järgmisi samme.

Selles olekus ei tohiks süsteem liiga palju oletada. Kui info on ebapiisav, peab teekonnakaart pigem küsima täpsustusi kui tegema kindlaid järeldusi.

3. Valmis järgmisteks sammudeks

See olek tähendab, et piisav esmane info on olemas ja kasutajale saab pakkuda konkreetseid tööriistu või tegevusi.

Näiteks:

- ava teenusekaart;

- leia KOV kontakt;

- koosta eelpöördumine;

- täida eelkaardistus;

- märgi, et soovid eelkaardistust täita koos spetsialistiga;

- lisa dokument analüüsiks;

- koosta küsimused teenuseosutajale;

- koosta küsimused tervisekontaktile;

- loo abisoov;

- paku vestlusruumi.

Kasutajale sobiv tekst:

Teekonnakaart on valmis järgmisteks sammudeks. Vali, kuidas soovid edasi liikuda.

See ei tähenda, et olukord on lahendatud. See tähendab, et kasutaja saab valida sobiva järgmise tegevuse.

4. Kontaktid soovitatud

See olek tekib siis, kui teekonnakaart või teenusekaart pakub võimalikke kontakte või osapooli.

Näiteks:

- KOV sotsiaalvaldkonna kontakt;

- KOV teenuse kontakt;

- teenuseosutaja;

- perearstikeskus;

- tervisekeskus;

- abisoovi/abipakkumise haru;

- kriisiabi kontakt, kui olukord viitab ohule.

Oluline piir:

soovitatud kontakt ei ole kaasatud osapool.

Kasutajale sobiv tekst:

Need on võimalikud kontaktid sinu kirjelduse ja piirkonna põhjal. Nad ei näe sinu infot enne, kui sa valid kontakti ja otsustad, mida jagada.

Tervisekontakti puhul sobib täpsustus:

Tervisekontakt on soovitatud juhul, kui sinu kirjelduses võib olla tervisega seotud küsimus. SotsiaalAI ei anna meditsiinilist hinnangut, kuid saab aidata küsimused selgelt sõnastada.

5. Osapool valitud

See olek tekib siis, kui kasutaja valib ühe soovitatud kontakti või osapoole.

Näiteks kasutaja vajutab:

- Lisa teekonnale

- Valin selle kontakti

- Koosta pöördumine sellele osapoolele

- Koosta küsimused sellele kontaktile

Valitud osapool võib olla:

- KOV kontakt;

- teenuseosutaja;

- tervisekontakt;

- lähedane või abistaja;

- muu kutsutud osapool.

Oluline piir:

osapool on valitud, aga talle ei ole veel midagi saadetud.

Kasutajale sobiv tekst:

Kontakt on lisatud sinu teekonnale. Saad nüüd koostada pöördumise, küsimuse või kutse. Info ei ole veel saadetud.

Tervisekontakti puhul:

Tervisekontakt on lisatud teekonnale järgmise sammu täpsustamiseks. Kontakt ei näe sinu infot enne, kui sa ise otsustad temaga ühendust võtta või küsimuse saata.

6. Jagamiseks ettevalmistamisel

See olek tekib siis, kui kasutaja hakkab teekonnakaardist koostama jagatavat infot.

Näiteks:

- eelpöördumise mustand;

- eelinfo kaart;

- kiri KOV-ile;

- küsimus teenuseosutajale;

- küsimused perearstikeskusele või tervisekeskusele;

- teenuse jätkumise pöördumine;

- juhendatud eelkaardistuse soov;

- kohtumise või vestlusruumi kutse.

Selles olekus töötab eriti tugevalt privaatsuse eelkiht.

Kasutajale sobiv tekst:

Koostan jagatavat eelinfot. Enne saatmist saad üle vaadata, mida jagatakse ja kellele.

Oluline piir:

privaatset assistendivestlust ei jagata automaatselt. Jagatav sisu luuakse eraldi ja kasutaja kinnitab selle enne saatmist.

7. Saadetud / jagatud

See olek tekib ainult siis, kui kasutaja on jagatava info kinnitanud ja saatnud.

Näiteks:

- eelpöördumine saadeti KOV kontaktile;

- küsimus saadeti teenuseosutajale;

- kasutaja avas e-kirja tervisekontaktile saatmiseks;

- eelinfo saadeti SotsiaalAI-sisese vastuvõtu kaudu;

- kutse saadeti vestlusruumi liitumiseks.

Kasutajale sobiv tekst:

Pöördumine on saadetud. Vastuvõtja näeb ainult seda infot, mille sa kinnitasid ja saatsid.

Tervisekontakti puhul tuleb eristada, kas info liigub SotsiaalAI sees või väljaspool platvormi.

Kui tervisekontakti puhul avatakse e-kiri või kopeeritav tekst:

Küsimuse mustand on valmis. Kui saadad selle väljaspool SotsiaalAI-d, ei pruugi platvorm näidata vastuvõtmise või avamise staatust.

8. Vastuvõtja ülevaatamisel

See olek on asjakohane siis, kui pöördumine liigub SotsiaalAI-sisese vastuvõtu kaudu.

Näiteks:

- KOV spetsialist avas pöördumise;

- teenuseosutaja avas teenusega seotud päringu;

- vastuvõtja märkis pöördumise vastuvõetuks;

- vastuvõtja küsis lisainfot;

- vastuvõtja pakkus vestlusruumi;

- vastuvõtja märkis, et pöördumine ei kuulu tema rolli või teenuse alla.

Kasutajale sobiv tekst:

Pöördumine on vastuvõtjale saadetud. Kui vastuvõtja kasutab SotsiaalAI vastuvõtuvaadet, näed siin hiljem pöördumise seisu.

Oluline:

Kui pöördumine saadetakse välise e-kirjana, ei pruugi süsteem staatust jälgida.

9. Vestlusruum avatud

See olek tekib siis, kui teekond on seotud jagatud vestlusruumiga.

Vestlusruum võib tekkida:

- käsitsi kutse lehelt;

- eelpöördumise järel;

- pöördumiste vastuvõtust;

- juhendatud eelkaardistuse soovist;

- teekonnakaardilt valitud osapoolega;

- abisoovi ja abipakkumise matchist.

Vestlusruumis võivad olla:

- pöörduja;

- KOV spetsialist;

- teenuseosutaja;

- lähedane või esindaja;

- kutsutud osapool;

- abisoovi/abipakkumise teine osapool.

Kasutajale sobiv tekst:

Teekond on nüüd seotud vestlusruumiga. Ruumi liikmed näevad ainult ruumis jagatud infot ja kinnitatud eelinfot. Privaatset assistendivestlust ei jagata.

Vestlusruumis saab:

- jätkata tekstivestlust;

- jagada dokumente;

- täita eelkaardistust koos;

- teha kokkuleppeid;

- märkida järgmisi samme;

- pidada audio-only helivestlust;

- luua nõusolekupõhine transkriptsioon või kokkuvõte.

10. Ootel

See olek tähendab, et teekond ei ole lõppenud, kuid järgmine samm sõltub mõne osapoole tegevusest või puuduolevast infost.

Näiteks:

- oodatakse vastuvõtja vastust;

- oodatakse kasutajalt dokumenti;

- oodatakse teenuse lõppkuupäeva;

- oodatakse KOV kontakti vastust;

- oodatakse teenuseosutajalt tingimuste selgitust;

- oodatakse kohtumise kinnitamist;

- oodatakse, kas kasutaja saadab küsimused tervisekontaktile.

Kasutajale sobiv tekst:

Teekond on ootel. Järgmine samm sõltub vastusest või täpsustusest.

Süsteem peaks näitama, mis täpselt on ootel:

- “Ootab vastuvõtja vastust”

- “Ootab kasutajalt dokumenti”

- “Ootab teenuse lõppkuupäeva”

- “Ootab kohtumise kinnitamist”

- “Ootab, kas soovid küsimuse saata”

11. Peatatud

Peatatud olek tähendab, et teekond ei liigu praegu edasi, aga seda saab hiljem jätkata.

Näiteks:

- kasutaja otsustas oodata;

- info on ebapiisav;

- inimene ei soovi hetkel jagada;

- valitud osapool ei sobinud;

- teenuseosutaja ei võta vastu;

- KOV või teenuseosutaja ei ole vastanud;

- inimene soovib hiljem teise kontakti valida;

- tervisekontakti küsimus jäi saatmata.

Kasutajale sobiv tekst:

Teekond on peatatud. Saad seda hiljem jätkata, muuta kontakti või valida teise järgmise sammu.

12. Lõpetatud

Lõpetatud olek tähendab, et konkreetne teekond on jõudnud kasutaja või töövoo jaoks määratud vahetulemini.

Näiteks:

- kasutaja sai vajaliku kontakti;

- eelpöördumine saadeti ja edasine suhtlus toimub mujal;

- kohtumine lepiti kokku;

- dokument analüüsiti;

- küsimus tervisekontaktile koostati või saadeti;

- teenuse jätkumise pöördumine koostati;

- abisoov avaldati;

- vestlusruumis lepiti järgmised sammud kokku;

- kasutaja märkis teekonna lõpetatuks.

Oluline:

lõpetatud ei tähenda, et ametlik abi on saadud või teenus on määratud. See tähendab, et SotsiaalAI töövoog selles teekonnas on kasutaja valitud eesmärgini jõudnud.

Kasutajale sobiv tekst:

Teekond on lõpetatud. Saad kokkuvõtte salvestada, alla laadida või alustada uut teekonda.

13. Arhiveeritud

Arhiveeritud teekond on lõpetatud või kasutaja poolt kõrvale pandud teekond, mida ei kuvata enam aktiivsete teekondade seas.

Kasutajale sobiv tekst:

Teekond on arhiveeritud. Seda saab vajadusel hiljem avada või kustutada vastavalt sinu andmesätetele.

4.4. Tüüpilised olekujadad

Kõik teekonnad ei läbi kõiki olekuid. Olekud peavad toetama eri teekondi.

Tavaline KOV-i suunduv teekond

Privaatne
→ Täpsustamisel
→ Valmis järgmisteks sammudeks
→ Kontaktid soovitatud
→ Osapool valitud
→ Jagamiseks ettevalmistamisel
→ Saadetud
→ Vastuvõtja ülevaatamisel
→ Vestlusruum avatud
→ Lõpetatud

Ainult kontakti leidmise teekond

Privaatne
→ Valmis järgmisteks sammudeks
→ Kontaktid soovitatud
→ Lõpetatud

Dokumendist lähtuv teekond

Privaatne
→ Täpsustamisel
→ Dokument lisatud
→ Dokumendi analüüs pooleli
→ Kokkuvõte valmis
→ Eelpöördumise mustand
→ Lõpetatud

Teenusekatkemise teekond

Privaatne
→ Täpsustamisel
→ Teenuse jätkumine vajab kontrolli
→ Dokument või lõppkuupäev puudu
→ Eelpöördumine koostamisel
→ Saadetud
→ Ootel

Tervisekontakti teekond

Privaatne
→ Täpsustamisel
→ Valmis järgmisteks sammudeks
→ Tervisekontakt soovitatud
→ Küsimuse mustand koostamisel
→ Kasutaja saadab või salvestab küsimuse
→ Lõpetatud

Juhendatud eelkaardistuse teekond

Privaatne
→ Valmis järgmisteks sammudeks
→ Juhendatud eelkaardistuse soov
→ Eelpöördumine saadetud
→ Vastuvõtja ülevaatamisel
→ Vestlusruum avatud
→ Eelkaardistus pooleli
→ Kokkuvõte kinnitatud
→ Lõpetatud

4.5. Osapoolte olekud

Teekonnakaardi üldolek ei näita piisavalt täpselt, mis seisus on konkreetsed osapooled. Seetõttu peab igal osapoolel olema oma olek.

Võimalikud osapooled

- KOV kontakt;

- sotsiaaltöö spetsialist;

- teenuseosutaja;

- tervisekontakt;

- lähedane või esindaja;

- abisoovi/abipakkumise osapool;

- muu kutsutud inimene.

Osapoolte olekud

| Olek | Tähendus | Kas näeb infot? |
| --- | --- | --- |
| Soovitatud | SotsiaalAI või teenusekaart pakkus osapoole | Ei |
| Vaadatud | kasutaja avas kontakti või profiili | Ei |
| Valitud | kasutaja lisas osapoole teekonnale | Ei |
| Pöördumine/küsimus koostamisel | kasutaja koostab jagatavat infot | Ei |
| Saadetud | kasutaja kinnitas ja saatis info | Jah, ainult saadetud info |
| Avatud | osapool avas pöördumise, kui süsteem seda jälgib | Jah, saadetud info |
| Vastuvõetud | osapool märkis, et tegeleb pöördumisega | Jah, saadetud info |
| Täpsustamisel | osapool küsib lisainfot | Jah, jagatud suhtlus |
| Vestlusruumis | osapool on ruumis | Jah, ruumis jagatud info |
| Ei sobi / mitteasjakohane | osapool ei ole õige kontakt või teenus | Ainult saadetud info |
| Kõrvale jäetud | kasutaja eemaldas osapoole teekonnalt | Ei või enam mitteaktiivne |

Tervisekontakti puhul on oluline: MVP-s ei pruugi olla platvormisisest “avatud” või “vastuvõetud” staatust, kui küsimus saadetakse e-posti kaudu või kopeeritakse. Sel juhul võiks staatus olla:

- küsimuse mustand valmis;

- kasutaja märkis saadetuks;

- järgmine samm tehtud.

4.6. Tegevuste olekud

Lisaks teekonnale ja osapooltele peavad oma olekud olema ka konkreetsetel tegevustel.

Eelpöördumine

- soovitatud;

- mustand loodud;

- kasutaja muudab;

- privaatsuse kontroll tehtud;

- kinnitamist ootab;

- saadetud;

- vastuvõetud;

- lisainfo ootel;

- lõpetatud.

Teenusekaart

- soovitatud;

- filtrid loodud;

- kaart avatud;

- kontakt vaadatud;

- kontakt valitud;

- kontakt lisatud teekonnale.

Tervisekontakti küsimused

- soovitatud;

- mustand koostamisel;

- mustand valmis;

- kasutaja muudab;

- avatud e-kirjana;

- kopeeritud;

- kasutaja märkis saadetuks;

- salvestatud teekonnale.

Dokumendi analüüs

- soovitatud;

- fail lisamata;

- fail lisatud;

- analüüs pooleli;

- kokkuvõte valmis;

- tähtajad või järgmised sammud tuvastatud;

- kokkuvõte lisatud teekonnale.

Vestlusruum

- soovitatud;

- kutse koostamisel;

- kutse saadetud;

- ruum avatud;

- lisainfo ootel;

- eelkaardistus pooleli;

- helivestlus kasutatud;

- kokkuvõte koostatud;

- ruum suletud.

Abisoov / abipakkumine

- soovitatud;

- mustand;

- avaldamiseks kinnitamisel;

- avaldatud;

- sobivus leitud;

- match kinnitatud;

- vestlusruum avatud;

- lõpetatud.

4.7. Rollipõhine kuvamine

Pöörduja näeb lihtsaid olekuid

Pöörduja jaoks peaks keel olema lihtne:

- Privaatne

- Vajab täpsustamist

- Valmis edasi liikumiseks

- Kontaktid leitud

- Kontakt valitud

- Pöördumine koostamisel

- Pöördumine saadetud

- Vastus ootel

- Vestlusruum avatud

- Lõpetatud

Tervisekontakti puhul:

- Tervisekontakt soovitatud

- Küsimuse mustand valmis

- Küsimus saadetud või salvestatud

Vältida tuleks liiga ametlikku sõna “menetluses”, kui tegu ei ole päriselt ametliku menetlusega.

Spetsialist näeb tööolekuid

Spetsialisti vaates võib olla detailsem:

- saabunud pöördumine;

- eelinfo olemas;

- juhendatud eelkaardistuse soov;

- teenusekatkemise risk;

- lisainfo puudub;

- vastuvõetud;

- lisainfo ootel;

- vestlusruum avatud;

- memo koostatud;

- kasutajale selgitus koostatud.

Spetsialist ei näe privaatse teekonnakaardi varasemat osa, kui kasutaja pole seda jaganud.

Teenuseosutaja näeb teenusega seotud olekuid

Teenuseosutaja vaates võiks olla:

- pöördumine saabunud;

- teenus sobib / vajab kontrolli;

- sihtrühm vajab täpsustamist;

- ligipääsutingimused vajavad selgitamist;

- vastus koostamisel;

- vestlusruum pakutud;

- vestlusruum avatud;

- mitteasjakohane pöördumine;

- edasi suunamise soovitus.

Teenuseosutajale ei kuvata kogu laia teekonda, vaid teenusega seotud osa.

4.8. Olekud ja privaatsus

Olekud peavad toetama privaatsust.

Kõige olulisemad reeglid:

1. Privaatne tähendab päriselt privaatne

Privaatne teekonnakaart ei ole nähtav:

- KOV kontaktile;

- teenuseosutajale;

- tervisekontaktile;

- kutsutud spetsialistile;

- teisele kasutajale;

- juhuslikule platvormi kasutajale.

2. Soovitatud kontakt ei näe infot

Ükski soovitatud kontakt ei näe kasutaja infot.

See kehtib ka tervisekontakti kohta.

3. Valitud kontakt ei näe infot

Ka siis, kui kasutaja lisab kontakti teekonnale, ei näe kontakt veel midagi.

4. Saadetud olek tekib ainult kinnitusega

Enne saatmist peab kasutaja nägema, mida jagatakse ja kellele.

5. Vestlusruumi liikmed näevad ainult ruumis jagatud infot

Privaatne assistendivestlus ei muutu automaatselt ruumi sisuks.

4.9. Olekud ja teenusekatkemise risk

Teenusekatkemise kontroll võiks olla seotud teekonnakaardi olekutega.

Võimalikud riskiseisud:

- tuvastamata;

- vajab kontrolli;

- madal;

- keskmine;

- kõrge;

- kriitiline;

- järgmine samm tehtud;

- info puudub.

Näide:

{
"riskSignals": [
{
"type": "SERVICE_CONTINUITY",
"status": "NEEDS_CHECK",
"level": "MEDIUM",
"reason": "Kasutaja mainib teenuse lõppemist, kuid lõppemise kuupäev puudub."
}
]
}

Kasutajale sobiv tekst:

Teenuse jätkumine vajab kontrollimist. Lisa teenuse lõppemise aeg või koosta pöördumine, et seda täpsustada.

4.10. Olekud ja tervisekontakt

Tervisekontakt vajab eraldi täpsustust, sest see ei ole KOV sotsiaalteenus ega teenuseosutaja samas tähenduses.

Tervisekontakti olekud võivad olla lihtsad:

| Olek | Tähendus |
| --- | --- |
| Soovitatud tervisekontakt | kirjeldus võib vajada tervisemure või arstliku hinnangu täpsustamist |
| Küsimused koostamisel | SotsiaalAI aitab sõnastada küsimused perearstikeskusele või tervisekeskusele |
| Mustand valmis | kasutaja saab mustandi üle vaadata |
| Kasutaja saadab ise | e-kiri, telefon, e-perearstikeskus või muu kanal väljaspool SotsiaalAI-d |
| Järgmine samm märgitud tehtuks | kasutaja märgib, et võttis ühendust või salvestas küsimused |

SotsiaalAI ei peaks MVP-s tervisekontaktide puhul looma täielikku vastuvõtu- ja menetlusloogikat.

Kasutajatekst:

Tervisekontakt on kuvatud seetõttu, et sinu kirjelduses võib olla tervisega seotud küsimus. SotsiaalAI ei anna meditsiinilist hinnangut ega asenda arstiabi.

4.11. Olekud ja teenuseni jõudmine

Kui teekonnakaardil on teenus või teenusesuund, siis ka sellel võiks olla olek.

| Teenuse olek | Tähendus |
| --- | --- |
| Võimalik teenusesuund | teenus võib olla seotud kasutaja olukorraga |
| Ligipääs vajab kontrolli | pole selge, kas saab otse pöörduda |
| Vajab KOV hindamist | tõenäoliselt tuleb pöörduda KOV-i poole |
| Vajab KOV otsust | teenuse saamine eeldab KOV otsust |
| Vajab tervisekontakti täpsustust | vajalik võib olla perearstikeskuse/tervisekeskuse kontakt |
| Vajab suunamist | vaja on pädeva osapoole suunamist |
| Kontakt valitud | kasutaja valis kontakti |
| Pöördumine saadetud | kasutaja saatis kinnitatud eelinfo |
| Tingimused täpsustatud | vastuvõtja või allikas andis ligipääsutingimused |
| Ei sobi | teenus ei sobi selle olukorraga |

See aitab vältida vale muljet, et teenus on “määratud”.

4.12. Andmemudel

Teekonnakaardi olekuid võiks hoida mitmel tasandil.

{
"journey": {
"id": "journey_001",
"status": "PRIVATE",
"sharingStatus": "NOT_SHARED",
"progressStage": "NEEDS_CLARIFICATION"
},
"participants": [
{
"id": "party_001",
"type": "KOV_CONTACT",
"name": "KOV sotsiaalvaldkonna kontakt",
"status": "SUGGESTED",
"visibility": "OWNER_ONLY"
},
{
"id": "party_002",
"type": "HEALTH_CONTACT",
"subtype": "FAMILY_DOCTOR_CENTER",
"name": "Perearstikeskus või tervisekeskus",
"status": "SUGGESTED",
"visibility": "OWNER_ONLY",
"roleOnJourney": "Tervisemure, ravijärgse küsimuse või arstliku hinnangu esmaseks täpsustamiseks"
}
],
"actions": [
{
"id": "action_001",
"type": "CREATE_PRECONTACT",
"label": "Koosta eelpöördumine",
"status": "SUGGESTED"
},
{
"id": "action_002",
"type": "OPEN_SERVICE_MAP",
"label": "Ava teenusekaart",
"status": "AVAILABLE"
},
{
"id": "action_003",
"type": "CREATE_HEALTH_CONTACT_QUESTIONS",
"label": "Koosta küsimused tervisekontaktile",
"status": "AVAILABLE"
}
],
"risks": [
{
"type": "SERVICE_CONTINUITY",
"level": "MEDIUM",
"status": "NEEDS_CHECK"
}
]
}

4.13. Olekute auditeerimine

Kuna tegemist on tundliku valdkonnaga, peaks olulistel olekumuutustel olema logi.

Logida võiks:

- millal teekonnakaart loodi;

- millal kasutaja kinnitas jagamise;

- kellele info saadeti;

- milline eelinfo saadeti;

- millal vastuvõtja avas pöördumise;

- millal vestlusruum loodi;

- kes liitus ruumiga;

- millal fail jagati;

- kas helikõne transkriptsiooniks anti nõusolek;

- millal kokkuvõte kinnitati.

Tervisekontakti puhul, kui info saadetakse väljaspool SotsiaalAI-d, saab logida ainult seda, mida kasutaja platvormis teeb, näiteks:

- küsimuse mustand koostati;

- kasutaja avas e-kirja;

- kasutaja märkis, et küsimus saadeti.

4.14. Kasutajaliidese soovitus

Teekonnakaardi olek võiks kasutajale nähtav olla lihtsa sammureana.

Näiteks:

Privaatne → Kontakt valitud → Pöördumine koostamisel → Saadetud → Vastus ootel → Vestlusruum

Tervisekontakti teekonna puhul:

Privaatne → Tervisekontakt soovitatud → Küsimuse mustand valmis → Kasutaja saadab ise

Või kaartidena:

- Praegu: privaatne teekonnakaart

- Järgmine võimalik samm: vali kontakt või koosta pöördumine

- Jagamine: midagi ei ole veel saadetud

See viimane rida on usalduse jaoks väga tähtis.

4.15. Platvormitekstid

Privaatne olek

See teekonnakaart on privaatne. Soovitatud kontaktid, teenuseosutajad ja tervisekontaktid ei näe sinu infot enne, kui sa selle ise kinnitad ja jagad.

Täpsustamisel

Teekonnakaart vajab veel mõnda täpsustust, et pakkuda sobivamaid järgmisi samme.

Kontaktid soovitatud

Leidsin võimalikud kontaktid sinu kirjelduse ja piirkonna põhjal. Need on ainult soovitused ega tähenda, et kontaktid näevad sinu infot.

Tervisekontakt soovitatud

Sinu kirjelduses võib olla tervisega seotud küsimus. Esmane järgmine samm võib olla perearstikeskus või tervisekeskus. SotsiaalAI ei anna meditsiinilist hinnangut, kuid saab aidata küsimused selgelt sõnastada.

Osapool valitud

Valitud kontakt on lisatud sinu teekonnale. Info ei ole veel saadetud.

Jagamiseks ettevalmistamisel

Koostan jagatavat eelinfot. Enne saatmist saad teksti muuta ja kinnitada.

Saadetud

Pöördumine on saadetud. Vastuvõtja näeb ainult sinu kinnitatud infot.

Koostööruum avatud

Vestlusruum on avatud. Ruumi liikmed näevad ruumis jagatud infot ja kokkuleppeid. Privaatset assistendivestlust ei jagata.

Lõpetatud

Teekond on lõpetatud. Saad kokkuvõtte salvestada, alla laadida või alustada uut teekonda.

4.16. MVP soovitus

Esimeses versioonis ei pea olekusüsteem olema liiga keeruline.

MVP üldolekud:

1. Privaatne

1. Vajab täpsustamist

1. Valmis järgmisteks sammudeks

1. Kontaktid soovitatud

1. Kontakt valitud

1. Pöördumine/küsimus koostamisel

1. Saadetud või salvestatud

1. Vastus ootel

1. Vestlusruum avatud

1. Lõpetatud

Lisaks lihtne jagamise staatus:

- ei ole jagatud;

- jagamiseks valmis;

- saadetud;

- jagatud vestlusruumis.

Tervisekontakti puhul piisab MVP-s:

- tervisekontakt soovitatud;

- küsimuse mustand valmis;

- kasutaja saadab ise;

- järgmine samm märgitud tehtuks.

4.17. Kokkuvõte

Teekonnakaardi olekud teevad SotsiaalAI uue mudeli kasutajale arusaadavaks ja turvaliseks.

Need eristavad:

- privaatset mõtlemist;

- täpsustamisel olevat olukorda;

- soovitatud kontakte;

- valitud osapooli;

- jagamiseks ettevalmistatud infot;

- saadetud eelpöördumist;

- tervisekontaktile koostatud küsimust;

- jagatud vestlusruumi;

- lõpetatud teekonda.

Tervisekontakti lisandumine ei muuda olekusüsteemi põhiloogikat. See on lihtsalt üks võimalik soovitatud kontaktisuund, mis aitab vältida olukorda, kus tervisemurega inimene suunatakse automaatselt KOV-i poole.

Kõige olulisem põhimõte jääb samaks:

midagi ei liigu edasi enne, kui kasutaja on selle ise kinnitanud.

# 5. Osapoolte loogika teekonnakaardil

Teekonnakaardi osapooled on need inimesed, asutused, kontaktid või rollid, kes võivad inimese olukorra lahendamisel või järgmise sammu täpsustamisel kuidagi seotud olla.

Uues mudelis ei tähenda osapool seda, et inimene on automaatselt kaasatud või näeb kasutaja infot. Osapool võib olla ainult soovitatud kontaktisuund, kuni kasutaja otsustab, kas ta tahab selle osapoole valida, pöördumise koostada, küsimuse saata või vestlusruumi avada.

Kõige olulisem põhimõte:

Teekonnakaardil olev osapool ei näe kasutaja infot enne, kui kasutaja on ise kinnitanud, mida ja kellele jagatakse.

5.1. Põhimõte

Teekonnakaart aitab kasutajal aru saada, kelle poole võiks järgmise sammuna pöörduda.

Osapool võib olla näiteks:

- KOV sotsiaalvaldkonna kontakt;

- KOV teenuse kontakt;

- sotsiaaltöö spetsialist;

- teenuseosutaja;

- perearstikeskus või tervisekeskus;

- lähedane või esindaja;

- abisoovi või abipakkumise teine osapool;

- kriisiabi kontakt;

- muu kutsutud inimene.

Aga kõik need ei ole samasugused osapooled. Mõni on ametlik kontakt, mõni teenuseosutaja, mõni tervisekontakt, mõni lähedane, mõni kogukondliku abi osapool. Seetõttu peab teekonnakaart osapooli selgelt eristama.

5.2. Osapool ei ole automaatselt kaasatud

See on kõige tähtsam reegel.

Kui teekonnakaart näitab näiteks:

- “KOV sotsiaalvaldkonna kontakt”;

- “teenuseosutaja”;

- “perearstikeskus või tervisekeskus”;

siis see tähendab ainult, et need võivad olla asjakohased kontaktisuunad.

See ei tähenda, et:

- kontakt näeb kasutaja teekonda;

- kontakt sai kasutaja kirjelduse;

- spetsialist on kaasatud;

- teenuseosutaja on pöördumise kätte saanud;

- tervisekontakt näeb inimese tervisega seotud infot;

- teekond on ametlikult alustatud.

Kasutajale sobiv tekst:

Need on võimalikud osapooled sinu teekonnal. Nad ei näe sinu infot enne, kui sa valid kontakti ja kinnitad, mida soovid jagada.

5.3. Peamised osapoole tüübid

Teekonnakaardil võiks olla järgmised osapoole tüübid.

| Osapoole tüüp | Näide | Roll teekonnal |
| --- | --- | --- |
| KOV kontakt | sotsiaalosakond, sotsiaaltöötaja, lastekaitse kontakt | KOV teenuste, abivajaduse hindamise või kohaliku toe täpsustamine |
| KOV teenuse kontakt | koduteenus, sotsiaaltransport, tugiisikuteenus | konkreetse KOV teenuse kohta info leidmine |
| Teenuseosutaja | rehabilitatsiooniasutus, nõustamiskeskus, hooldusteenuse pakkuja | teenuse tingimuste, sobivuse ja kättesaadavuse täpsustamine |
| Tervisekontakt | perearstikeskus, tervisekeskus | tervisemure, ravijärgse küsimuse või arstliku hinnangu esmaseks täpsustamiseks |
| Lähedane / esindaja | pereliige, hooldaja, seaduslik esindaja | kasutaja toetamine, info täpsustamine või ruumis osalemine |
| Abisoovi/abipakkumise osapool | abipakkuja või abi vajaja | kogukondliku või praktilise abi kokkuleppimine |
| Kriisiabi kontakt | 112, Lasteabi, Ohvriabi | kiire ohu või kriisi korral |
| Kovisiooni osapool | kolleeg, spetsialistide grupp | anonümiseeritud juhtumiarutelu spetsialistide vahel |

5.4. KOV kontakt teekonnakaardil

KOV kontakt on osapool siis, kui inimese olukord puudutab tõenäoliselt:

- igapäevast toimetulekut;

- kodust abi;

- sotsiaaltransporti;

- hoolduskoormust;

- tugiisikut;

- isiklikku abistajat;

- toimetulekuga seotud kohalikke teenuseid;

- lapse või pere kohaliku toe küsimust;

- teenuse jätkumist või katkestust;

- kohaliku omavalitsuse hindamist või otsust.

KOV kontakt võib olla teekonnakaardil alguses olekus:

Soovitatud

See tähendab:

KOV kontakt võib olla sobiv järgmine kontakt, kuid talle ei ole veel midagi saadetud.

Kasutaja saab teha järgmisi tegevusi:

- avada KOV kontakti teenusekaardil;

- lisada kontakti teekonnale;

- koostada eelpöördumise;

- koostada lühikese küsimuse;

- täita eelkaardistuse;

- märkida, et soovib küsimustikku täita koos spetsialistiga;

- hiljem avada vestlusruumi, kui töövoog seda võimaldab.

5.5. Teenuseosutaja teekonnakaardil

Teenuseosutaja on osapool siis, kui inimese kirjeldus või teekonnakaart viitab konkreetsele teenusele või teenusepakkujale.

Näiteks:

- rehabilitatsiooniteenus;

- nõustamine;

- hooldusteenus;

- tugiisikuteenus;

- erateenus;

- MTÜ pakutav teenus;

- teenuse tingimuste täpsustamine.

Teenuseosutaja roll teekonnal ei ole alati “teenust anda”. Mõnikord on roll ainult:

- selgitada teenuse tingimusi;

- öelda, kas teenus sobib;

- öelda, kas vaja on KOV otsust või suunamist;

- täpsustada piirkonda, hinda või kättesaadavust;

- vastata, kas teenus võtab uusi pöördumisi vastu.

Oluline sõnastus:

Teenuseosutajalt saab küsida tingimusi, kuid teenuse saamine võib sõltuda KOV-i, arsti või muu pädeva osapoole hindamisest, otsusest või suunamisest.

Teenuseosutaja ei peaks automaatselt nägema inimese kogu eelkaardistust. Talle jagatakse ainult teenusega seotud eelinfo.

5.6. Tervisekontakt teekonnakaardil

Uuendatud mudelis võib teekonnakaardil olla ka tervisekontakt.

See tähendab kitsalt:

- perearstikeskus;

- pereõde;

- tervisekeskus;

- vajadusel ametlik tervisenõu kontakt.

See ei tähenda, et SotsiaalAI hakkab osutama tervishoiuteenust või andma meditsiinilist hinnangut.

Tervisekontakt lisandub teekonnakaardile siis, kui kasutaja kirjeldus viitab näiteks:

- tervisemurele;

- ravijärgsele küsimusele;

- arstliku hinnangu vajadusele;

- ravimite, sümptomite või tervisega seotud täpsustusele;

- olukorrale, kus sotsiaalne ja tervise vajadus on põimunud;

- sellele, et esimene samm ei pruugi olla KOV, vaid perearstikeskus või tervisekeskus.

Näide:

“Mul on pärast haigust raske kodus hakkama saada ja ma ei tea, kas peaksin pöörduma sotsiaaltöötaja või perearsti poole.”

Teekonnakaart võib sel juhul näidata kahte osapoolt:

1. KOV sotsiaalvaldkonna kontakt — koduse toimetuleku ja võimalike sotsiaalteenuste täpsustamiseks.

1. Tervisekontakt — tervisemure, ravijärgse olukorra või arstliku hinnangu täpsustamiseks.

Tervisekontakt on teekonnakaardil tavaliselt olekus:

Soovitatud

MVP-s ei pea tervisekontakt olema SotsiaalAI-sisese vastuvõtu osapool. Piisab, kui SotsiaalAI aitab koostada:

- küsimused perearstikeskusele;

- lühikese olukorra kokkuvõtte;

- teekonnal märgitava järgmise sammu.

Kasutajale sobiv tekst:

Tervisekontakt on soovitatud seetõttu, et sinu kirjelduses võib olla tervisega seotud küsimus. SotsiaalAI ei anna meditsiinilist hinnangut ega asenda arstiabi, kuid saab aidata küsimused selgelt sõnastada.

5.7. Lähedane või esindaja teekonnakaardil

Lähedane või esindaja võib olla teekonna osapool, kui kasutaja soovib kedagi kaasata.

Näiteks:

- pereliige;

- hooldaja;

- seaduslik esindaja;

- abistaja;

- usaldusisik.

Lähedane võib aidata:

- olukorda täpsustada;

- dokumente leida;

- eelpöördumist üle vaadata;

- vestlusruumis osaleda;

- praktilisi samme meeles pidada;

- kohtumiseks valmistuda.

Olemasolev kutse loogika sobib siia hästi.

Kutsuja võib teatud juhtudel tasuda kutsutu ühe kuu ligipääsu eest. See sobib eriti eraisikute, lähedaste ja abistajate kutsumisel.

Oluline privaatsusreegel:

Lähedane näeb ainult seda infot, mida kasutaja otsustab ruumis jagada või talle saata.

5.8. Abisoovi ja abipakkumise osapool

Abisoovid ja abipakkumised jäävad eraldi kogukondliku abi töövoogudeks.

Teekonnakaart võib suunata sinna siis, kui inimese vajadus on pigem praktiline või kogukondlik, mitte ametliku teenuse küsimus.

Näiteks:

- abi poeskäigul;

- seltsiline;

- väiksem praktiline abi;

- transpordiabi kokkuleppimine;

- vabatahtlik abi;

- abipakkumine.

Kui abisoov ja abipakkumine sobituvad, tekib osapoolte vahel match ja vajadusel vestlusruum.

Siin on osapooled:

- abi vajaja;

- abi pakkuja.

See ei ole sama, mis KOV teenus või teenuseosutaja. See on kogukondliku või inimestevahelise abi haru.

5.9. Kriisiabi kontakt osapoolena

Kriisiabi kontakt ei ole tavaline teekonna osapool.

Kui kasutaja kirjeldus viitab vahetule ohule, näiteks:

- enesevigastamise või suitsiidirisk;

- vahetu vägivald;

- lapse tõsine ohustatus;

- raske terviseoht;

- inimene on kohe abita või turvata;

siis ei tohiks teekonnakaart jääda ainult tavalise eelpöördumise või teenusekaardi juurde.

Käivitub kriisi- ja ohusuunamine.

Kriisikontaktid võivad olla:

- 112;

- Lasteabi 116 111;

- Ohvriabi 116 006;

- muu asjakohane ametlik kriisiabi kontakt.

Kasutajale sobiv tekst:

Kui on vahetu oht elule, tervisele või turvalisusele, tuleb pöörduda kohe hädaabi või kriisiabi poole. SotsiaalAI saab aidata infot korrastada, kuid ei asenda kiiret abi.

5.10. Osapoole olekud teekonnakaardil

Igal osapoolel peaks olema oma olek, sest osapool võib liikuda eri seisundites.

| Olek | Tähendus | Kas osapool näeb infot? |
| --- | --- | --- |
| Soovitatud | SotsiaalAI või teenusekaart pakkus osapoole | Ei |
| Vaadatud | kasutaja avas kontakti või profiili | Ei |
| Valitud | kasutaja lisas osapoole teekonnale | Ei |
| Pöördumine/küsimus koostamisel | kasutaja koostab jagatavat infot | Ei |
| Jagamiseks valmis | kasutaja saab info üle vaadata | Ei |
| Saadetud | kasutaja kinnitas ja saatis info | Jah, ainult saadetud info |
| Avatud | osapool avas pöördumise, kui süsteem seda jälgib | Jah, ainult saadetud info |
| Vastuvõetud | osapool märkis, et tegeleb pöördumisega | Jah, ainult saadetud info |
| Täpsustamisel | osapool küsib lisainfot või vastab | Jah, jagatud suhtlus |
| Vestlusruumis | osapool on ruumi liige | Jah, ruumis jagatud info |
| Mitteasjakohane | osapool ei ole õige kontakt või teenus | Ainult juba saadetud info |
| Kõrvale jäetud | kasutaja eemaldas osapoole teekonnalt | Ei või mitteaktiivne |

Tervisekontakti puhul võib MVP-s kasutada lihtsamat olekuteringi:

Soovitatud → Küsimuse mustand valmis → Kasutaja saadab ise → Märgitud tehtuks

5.11. Osapoolte nähtavus

Osapoolte nähtavus peab olema väga täpselt kontrollitud.

Soovitatud osapool

Näeb: mitte midagi.

Kasutaja näeb ainult soovitust.

Valitud osapool

Näeb: endiselt mitte midagi.

Kasutaja on lisanud kontakti teekonnale, aga ei ole veel midagi jaganud.

Saadetud osapool

Näeb ainult seda, mille kasutaja kinnitas ja saatis.

Näiteks:

- eelpöördumine;

- eelinfo kaart;

- teenuse tingimuste küsimus;

- valitud dokument;

- vestlusruumi kutse.

Vestlusruumi osapool

Näeb:

- ruumis jagatud sõnumeid;

- ruumis jagatud dokumente;

- ruumi kinnitatud eelinfot;

- ruumi kokkuleppeid.

Ei näe:

- kogu privaatset assistendivestlust;

- teekonnasõela sisemisi märkmeid;

- jagamata dokumente;

- teiste soovitatud kontaktide nimekirja;

- eelkaardistuse osi, mida kasutaja ei kinnitanud.

5.12. Osapoole lisamine teekonnale

Kui kasutaja vajutab “Lisa teekonnale”, ei tohiks see tähendada saatmist.

See tähendab ainult:

- kasutaja on valinud osapoole, kellega võib olla vaja järgmine samm teha;

- osapool lisatakse teekonnakaardile;

- kasutaja saab koostada pöördumise, küsimuse või kutse;

- info jääb endiselt privaatseks.

Kasutajale sobiv tekst:

Kontakt on lisatud sinu teekonnale. Info ei ole veel saadetud. Saad nüüd koostada pöördumise, küsimuse või kutse ja enne saatmist selle üle vaadata.

5.13. Osapool ja eelpöördumine

Eelpöördumine vajab adressaati.

Adressaat võib olla:

- KOV kontakt;

- teenuseosutaja;

- konkreetne spetsialist;

- teenuseprofiil;

- kasutaja enda jaoks salvestatud mustand;

- välise e-kirja adressaat.

Tervisekontakti puhul võiks MVP-s olla pigem:

- küsimuste mustand;

- e-kirjana avamine;

- kopeeritav tekst;

- märge “saatsin ise” või “võtan ühendust väljaspool platvormi”.

Eelpöördumise puhul peab süsteem kontrollima, kas osapool on õige tüübi jaoks sobiv.

Näiteks:

- KOV-ile sobib laiem eelinfo;

- teenuseosutajale sobib teenusega seotud eelinfo;

- tervisekontaktile sobivad terviseküsimused, mitte lai sotsiaalne eelkaardistus;

- lähedasele sobib ainult kasutaja teadlikult jagatud info.

5.14. Osapool ja vestlusruum

Vestlusruumi saab osapoolega avada mitmest kohast:

- eraldi kutse lehelt;

- eelpöördumise järel;

- pöördumiste vastuvõtust;

- teekonnakaardilt valitud osapoolega;

- juhendatud eelkaardistuse soovist;

- abisoovi ja abipakkumise matchist.

Aga ruumi loomine ei tohiks alati tähendada automaatset kaasamist.

Turvalisem loogika:

1. kasutaja valib osapoole;

1. koostab kutse või eelpöördumise;

1. kinnitab jagatava info;

1. osapool saab kutse või pöördumise;

1. ruum avaneb, kui osapool nõustub või töövoog seda lubab.

Kasutajale sobiv tekst:

Vestlusruumi liikmed näevad ainult ruumis jagatud infot ja kinnitatud eelinfot. Privaatset assistendivestlust ei jagata.

5.15. Osapool ja teenuseni jõudmise loogika

Osapoolte loogika peab olema seotud teenuseni jõudmise loogikaga.

Näiteks sama teenuse puhul võib olla mitu osapoolt:

- KOV kontakt — hindab abivajadust või selgitab kohaliku teenuse võimalust;

- teenuseosutaja — selgitab teenuse tingimusi või kättesaadavust;

- tervisekontakt — täpsustab tervisemure või arstliku hinnangu vajadust;

- lähedane — aitab infot koguda ja suhelda.

Seetõttu peab teekonnakaart näitama iga osapoole rolli.

Näiteks:

KOV kontakt
Roll: abivajaduse ja KOV teenuse võimaluste täpsustamine.

Teenuseosutaja
Roll: teenuse tingimuste, sobivuse ja kättesaadavuse täpsustamine.

Tervisekontakt
Roll: tervisemure, ravijärgse küsimuse või arstliku hinnangu täpsustamine.

Lähedane
Roll: kasutaja toetamine teekonna läbimisel.

5.16. Andmemudel

Osapool teekonnal võiks olla eraldi objekt.

{
"journeyParty": {
"id": "party_001",
"journeyId": "journey_001",
"type": "KOV_CONTACT",
"subtype": "SOCIAL_WORK_CONTACT",
"displayName": "KOV sotsiaalvaldkonna kontakt",
"status": "SUGGESTED",
"visibility": "OWNER_ONLY",
"roleOnJourney": "Võimalik esimene kontakt KOV sotsiaalteenuste ja abivajaduse täpsustamiseks",
"sourceId": "service_map_entry_001",
"canReceivePreContact": true,
"canJoinRoom": true,
"createdAt": "2026-05-25T12:00:00Z"
}
}

Tervisekontakti näide:

{
"journeyParty": {
"id": "party_002",
"journeyId": "journey_001",
"type": "HEALTH_CONTACT",
"subtype": "FAMILY_DOCTOR_CENTER",
"displayName": "Perearstikeskus või tervisekeskus",
"status": "SUGGESTED",
"visibility": "OWNER_ONLY",
"roleOnJourney": "Tervisemure, ravijärgse küsimuse või arstliku hinnangu esmaseks täpsustamiseks",
"canReceivePreContact": false,
"canJoinRoom": false,
"suggestedActions": [
"CREATE_HEALTH_CONTACT_QUESTIONS",
"OPEN_CONTACT_DETAILS",
"MARK_CONTACTED_OUTSIDE_PLATFORM"
]
}
}

Teenuseosutaja näide:

{
"journeyParty": {
"id": "party_003",
"journeyId": "journey_001",
"type": "SERVICE_PROVIDER",
"displayName": "Näidis teenuseosutaja",
"status": "SUGGESTED",
"visibility": "OWNER_ONLY",
"roleOnJourney": "Teenuse tingimuste ja sobivuse täpsustamine",
"canReceivePreContact": true,
"canJoinRoom": true,
"accessPathNote": "Teenusele jõudmine võib vajada KOV otsust või suunamist."
}
}

5.17. Kasutajatekstid

Osapooled soovitatud

Leidsin võimalikud osapooled sinu teekonnal. Need on ainult soovitused — nad ei näe sinu infot enne, kui sa ise otsustad, mida jagada.

KOV kontakt

KOV kontakt võib aidata kohalike sotsiaalteenuste, abivajaduse hindamise või järgmise sammu täpsustamisel. SotsiaalAI saab aidata koostada eelpöördumise.

Teenuseosutaja

Teenuseosutajalt saad küsida teenuse tingimusi, sobivust ja kättesaadavust. Teenusele jõudmine võib siiski eeldada KOV-i, arsti või muu pädeva osapoole otsust või suunamist.

Tervisekontakt

Tervisekontakt on soovitatud juhul, kui kirjelduses võib olla tervisega seotud küsimus. SotsiaalAI ei anna meditsiinilist hinnangut, kuid saab aidata koostada küsimused perearstikeskusele või tervisekeskusele.

Lähedase kutsumine

Saad kutsuda lähedase või abistaja vestlusruumi. Uus liige näeb ainult ruumis jagatud infot ja kinnitatud eelinfot.

Enne jagamist

Enne saatmist saad üle vaadata, mida valitud osapool näeb. Privaatset assistendivestlust ei jagata.

5.18. MVP

Esimeses versioonis piisab lihtsast osapoolte mudelist.

Osapoole tüübid MVP-s

- KOV kontakt;

- teenuseosutaja;

- tervisekontakt;

- lähedane/kutsutud osapool;

- abisoovi/abipakkumise osapool.

Osapoole olekud MVP-s

- soovitatud;

- valitud;

- pöördumine/küsimus koostamisel;

- saadetud;

- vestlusruumis;

- kõrvale jäetud.

Vajalikud tegevused

KOV kontakt:

- lisa teekonnale;

- koosta eelpöördumine;

- ava teenusekaart.

Teenuseosutaja:

- lisa teekonnale;

- küsi tingimusi;

- koosta pöördumine;

- paku vestlusruumi, kui lubatud.

Tervisekontakt:

- koosta küsimused;

- ava kontaktinfo;

- märgi, et võtan ühendust väljaspool platvormi.

Lähedane:

- kutsu ruumi;

- vajadusel sponsoreeri ühe kuu ligipääs.

5.19. Kokkuvõte

Osapoolte loogika teeb teekonnakaardi praktiliseks: kasutaja ei näe ainult abstraktseid soovitusi, vaid saab aru, kes võib tema järgmises sammus rolli mängida.

Samas peab iga osapoole puhul olema selge:

- mis roll tal teekonnal on;

- kas ta on ainult soovitatud või juba valitud;

- kas talle on midagi saadetud;

- kas ta näeb infot;

- kas temaga saab avada vestlusruumi;

- kas tema roll on ametlik, teenusepõhine, tervisekontakti-põhine või kogukondlik.

Tervisekontakti lisandumine ei muuda osapoolte põhiloogikat. See lisab lihtsalt ühe olulise suuna, et SotsiaalAI ei suunaks tervisega seotud murega inimest automaatselt ainult KOV sotsiaalvaldkonda.

Kõige lühem sõnastus:

Teekonnakaardi osapool on võimalik kontakt või kaasatav inimene, kelle roll on selgelt märgitud. Osapool ei näe kasutaja infot enne, kui kasutaja selle ise kinnitab ja jagab.

# 6. Teenusekaart uues loogikas

6.1. Põhimõte

Teenusekaart ei ole lihtsalt kaart, kus kuvatakse kontaktid ja teenused. Uues SotsiaalAI loogikas on teenusekaart teekonnakaardi praktiline kontaktide ja ligipääsuteede kiht.

Teekonnakaart aitab aru saada, millised valdkonnad võivad inimese olukorras seotud olla. Teenusekaart aitab seejärel leida:

- kelle poole pöörduda;

- kas pöörduda KOV-i, teenuseosutaja või esmase tervisekontakti poole;

- kas teenusele saab pöörduda otse või on vaja hindamist, otsust või suunamist;

- kas kasutaja saab koostada eelpöördumise, küsimuse või muu dokumendi.

Teenusekaart ei peaks muutuma kõigi võimalike teenuste ja asutuste kataloogiks. Selle fookus võiks jääda:

KOV sotsiaalvaldkond + sotsiaalvaldkonna teenuseosutajad + kitsas esmatasandi tervisekontaktide kiht.

6.2. Teenusekaardi põhikategooriad

Teenusekaardil võiks olla neli põhikategooriat.

| Kategooria | Sisu | Roll teekonnal |
| --- | --- | --- |
| KOV sotsiaalvaldkonna kontaktid | sotsiaaltöö, lastekaitse, toetused, sotsiaalteenuste kontaktid | esimene kontakt KOV teenuste ja abivajaduse hindamise jaoks |
| KOV teenused ja toetused | koduteenus, sotsiaaltransport, tugiisik, isiklik abistaja, hooldus, toetused jne | KOV korraldatavad abimeetmed |
| Sotsiaalvaldkonna teenuseosutajad | rehabilitatsiooniasutused, nõustamiskeskused, hooldusteenused, MTÜ-d, era- ja avalikud teenusepakkujad | konkreetse teenuse osutamine või tingimuste selgitamine |
| Tervisega seotud esmased kontaktid | perearstikeskused, tervisekeskused, vajadusel ametlikud tervisenõu kontaktid | olukordades, kus esimene samm võib olla tervisekontakt, mitte sotsiaaltöötaja |

Eraldi oluline piir: abisoovid ja abipakkumised ei pea olema teenusekaardi kategooria, sest need on sul juba eraldi kuulutuste ja matchimise funktsioonina olemas. Teekonnakaart võib sinna suunata, aga teenusekaardi põhiloogikasse seda ei segaks.

6.3. Mida teenusekaart ei peaks praegu katma?

Praegu jätaksin välja:

- haridusasutused ja koolide tugimeeskonnad;

- Töötukassa;

- haiglad üldise kategooriana;

- eriarstid ja eriarstiabi;

- ravijärjekorrad;

- diagnoosipõhised tervishoiuteenused;

- meditsiiniline otsustustugi.

Haiglate puhul võiks assistent teekonnakaardis vajadusel anda üldise soovituse, näiteks:

Kui inimene on haiglast koju tulemas, tasub küsida haiglast, kas seal on sotsiaaltöötaja või väljakirjutamisega seotud tugikontakt.

Aga haiglaid ennast ma teenusekaardi põhikihiks praegu ei paneks.

6.4. Miks tervisekontaktid siiski sisse võtta?

Tervise ja sotsiaalvaldkonna lõimimise kontekstis ei saa SotsiaalAI käituda nii, nagu iga mure esimene uks oleks KOV sotsiaaltöötaja.

Mõnikord on õige esmane samm hoopis:

- perearstikeskus;

- pereõde;

- tervisekeskus;

- tervisenõu kontakt;

- kiire ohu korral 112 või erakorraline abi.

Näiteks kui inimene kirjeldab tugevat tervisemuret, valu, ravijärgset küsimust või vajadust arstliku hinnangu järele, ei tohiks SotsiaalAI teda automaatselt KOV-i suunata.

Seega tervisekontaktide kiht ei tee SotsiaalAI-st terviseplatvormi. See aitab vältida valet suunamist.

Õige sõnastus:

SotsiaalAI keskendub sotsiaalvaldkonna teenuseteekondadele, kuid arvestab, et inimese olukorras võib esmane järgmine samm olla ka perearstikeskus või tervisekeskus.

6.5. Teenusekaardi ja teekonnakaardi suhe

Teenusekaart ei peaks avanema alati tühjana. Kui kasutaja on vestluses oma olukorda kirjeldanud, võiks teenusekaart avaneda teekonnakaardi põhjal eelfiltreeritult.

Näiteks kasutaja kirjutab:

“Mu emal on pärast haigust raske kodus hakkama saada, ta ei jaksa poes käia ja vajab abi pesemisel.”

Teekonnakaart tuvastab:

- kodune toimetulek;

- võimalik KOV teenuse vajadus;

- võimalik tervisega seotud järelküsimus;

- võimalik koduteenus;

- võimalik sotsiaaltransport;

- võimalik perearstikeskuse kontakt.

Teenusekaart avaneks filtritega:

- kasutaja KOV;

- KOV sotsiaalvaldkonna kontaktid;

- koduteenuse info;

- sotsiaaltranspordi info;

- teenuseosutajad, kui olemas;

- perearstikeskus või tervisekeskus tervisega seotud küsimuse täpsustamiseks.

6.6. “Kuidas teenuseni jõuda?” peab olema teenusekaardi keskne väli

Iga teenuse või teenuseosutaja kirje juures ei piisa enam kirjeldusest “mis teenus see on”.

Vaja on eraldi plokki:

Kuidas teenuseni jõuda?

See võiks sisaldada:

- kas saab pöörduda otse;

- kas vaja on KOV abivajaduse hindamist;

- kas vaja on KOV otsust;

- kas vaja on arsti või muu spetsialisti suunamist;

- kas teenuseosutajalt saab küsida tingimuste täpsustust;

- kes otsustab või korraldab;

- milline on esimene praktiline samm;

- millist infot või dokumente võib vaja minna;

- allikas ja viimati kontrollitud kuupäev.

Näide:

Ligipääs: vajab KOV hindamist
Esimene samm: võta ühendust oma KOV sotsiaalvaldkonna kontaktiga ja kirjelda olukorda
Kes otsustab: KOV
Teenuseosutajaga võib ühendust võtta: tingimuste täpsustamiseks
SotsiaalAI saab aidata: koostada eelpöördumise või küsimused

6.7. Ligipääsutee tüübid

Teenusekaardi igal teenusekirjel võiks olla ligipääsutee tüüp.

| Ligipääsutee | Tähendus |
| --- | --- |
| Otsekontakt | inimene saab ise ühendust võtta |
| KOV hindamine | teenuseni jõudmine eeldab KOV abivajaduse hindamist |
| KOV otsus | teenuse saamine eeldab KOV otsust või korraldust |
| Tervisekontakt | esmane samm on perearstikeskus, tervisekeskus või tervishoiukontakt |
| Vajab suunamist | teenuseni jõudmine eeldab pädeva osapoole suunamist |
| Teenuseosutaja eelkontakt | teenuseosutaja saab tingimusi täpsustada |
| Kontrolli tingimusi | info ei ole piisavalt kindel või võib olla muutunud |

See aitaks assistendil väga palju paremini vastata.

Näiteks:

See teenus võib olla seotud sinu kirjeldatud olukorraga, kuid sellele ei pruugi saada otse pöörduda. Teenuseni jõudmiseks võib olla vaja KOV hindamist. Soovi korral saan aidata koostada KOV-ile eelpöördumise.

6.8. Teenusekaardi tegevusnupud

Teenuse või kontakti juures võiksid olla tegevused sõltuvalt kirje tüübist.

KOV kontakt

- Lisa teekonnale

- Koosta eelpöördumine

- Koosta küsimus

- Vaata seotud KOV teenuseid

KOV teenus

- Vaata, kuidas teenuseni jõuda

- Leia KOV kontakt

- Koosta eelpöördumine

- Lisa teekonnale

Teenuseosutaja

- Vaata teenuseprofiili

- Lisa teekonnale

- Küsi teenuse tingimusi

- Koosta pöördumine

- Vaata, kas teenus vajab KOV või muud suunamist

Perearstikeskus / tervisekeskus

- Lisa teekonnale

- Koosta küsimused tervisekontaktile

- Vaata kontaktandmeid

- Märgi tervisega seotud järgmine samm

Siin peab olema selge, et SotsiaalAI ei anna meditsiinilist hinnangut, vaid aitab tuvastada, et tervisekontakt võib olla asjakohane.

6.9. Teenusekaart pöörduja vaates

Pöörduja jaoks peab kaart vastama lihtsatele küsimustele:

- kelle poole ma saan pöörduda;

- kas see on KOV, teenuseosutaja või tervisekontakt;

- kas ma saan otse kirjutada;

- kas enne on vaja KOV-i või arsti;

- mida ma peaksin pöördumises ütlema;

- kas SotsiaalAI saab mustandi koostada.

Pöörduja vaates võiks teenuse detailkaardil olla näiteks:

See on KOV teenus
Teenusele jõudmiseks pöördutakse tavaliselt KOV sotsiaalvaldkonna kontakti poole. KOV hindab abivajadust ja otsustab sobiva abi.

või:

See on tervisega seotud kontakt
Kui küsimus puudutab tervisemuret, ravijärgset seisundit või arstlikku hinnangut, võib esmane samm olla perearstikeskus või tervisekeskus. SotsiaalAI ei asenda arstiabi.

6.10. Teenusekaart spetsialisti vaates

Spetsialist võiks näha rohkem andmeid:

- teenuse allikas;

- KOV määrus või teenusekirjeldus;

- SKA juhendi seos;

- ligipääsutee;

- kes korraldab;

- kas teenus vajab hindamist;

- millal info kontrolliti;

- kas kontakt on usaldusväärne;

- kas info vajab uuendamist;

- kas teenust saab lisada juhtumi teekonnale.

Spetsialisti tegevused:

- Lisa juhtumi teekonnale

- Koosta inimesele lihtsas keeles selgitus

- Koosta pöördumise mustand

- Koosta memo

- Vaata allikaid

- Märgi info kontrollimist vajavaks

6.11. Teenusekaart teenuseosutaja vaates

Teenuseosutaja profiili kaudu saab teenuseosutaja oma nähtavust juhtida.

Ta saab määrata:

- milliseid teenuseid pakub;

- kellele teenus sobib;

- millises piirkonnas teenust osutab;

- kas võtab vastu eelpöördumisi;

- kas teenus vajab KOV otsust või suunamist;

- kas inimene võib küsida tingimusi otse;

- kas vestlusruumis täpsustamine on võimalik;

- kas juhendatud eelkaardistus on võimalik;

- kas helivestlus või kohapealne kohtumine on kokkuleppel võimalik.

Teenuseosutaja jaoks on teenusekaart mitte ainult kaart, vaid nähtavuse ja pöördumiste kvaliteedi tööriist.

6.12. Abisoovid ja abipakkumised jäävad eraldi

Kui teekonnakaart tuvastab, et inimene vajab pigem praktilist või kogukondlikku abi, siis ta ei peaks seda teenusekaardiga segama.

Näiteks:

See ei pruugi olla ametlik sotsiaalteenus. Võid koostada abisoovi ja vaadata, kas sobivaid abipakkumisi on olemas.

Seega:

- teenusekaart = ametlikumad/professionaalsed kontaktid ja teenused;

- abisoovid/abipakkumised = kogukondlik või kasutajatevaheline abi;

- teekonnakaart = otsustab, millisesse harusse kasutajat juhendada.

6.13. Haiglate käsitlemine

Haiglaid ma praegu teenusekaardi põhikategooriasse ei lisaks.

Aga assistent võiks osata teekonnakaardis teatud olukordades öelda:

Kui inimene on haiglast koju tulemas või haiglas viibimas, tasub küsida haiglast, kas on võimalik rääkida haigla sotsiaaltöötaja või väljakirjutamisega seotud tugikontaktiga. Koduse toimetuleku ja KOV teenuste osas on mõistlik pöörduda KOV sotsiaalvaldkonna kontakti poole.

See annab õige suuna, ilma et SotsiaalAI peaks hakkama haiglate kaarti pidama.

6.14. Tervisekontaktide kuvamise piirid

Tervisekontakte kuvatakse ainult piiratud eesmärgil.

Mitte:

- diagnoosimiseks;

- ravi soovitamiseks;

- eriarsti valimiseks;

- raviteekonna määramiseks.

Vaid:

- esmase tervisemure suunamiseks;

- arstliku hinnangu või suunamise vajaduse märkimiseks;

- ravijärgse küsimuse korral õige kontakti leidmiseks;

- olukordades, kus sotsiaalvaldkonda pöördumine ei ole esimene samm.

Kasutajale sobiv märge:

Tervisekontakt on kuvatud seetõttu, et sinu kirjelduses võib olla tervisega seotud küsimus. SotsiaalAI ei asenda arstiabi ega anna meditsiinilist hinnangut.

6.15. Andmemudel

Teenusekaardi kirje võiks olla sellise üldise struktuuriga:

{
"id": "entry_001",
"entryType": "KOV_SERVICE | KOV_CONTACT | SERVICE_PROVIDER | HEALTH_CONTACT",
"name": "Näidis kontakt või teenus",
"description": "Lühikirjeldus",
"municipality": "harku-vald",
"serviceArea": ["harku-vald", "harjumaa"],
"targetGroups": ["adult", "child", "family", "caregiver"],
"categories": ["social_support", "home_support", "transport"],
"contact": {
"email": "",
"phone": "",
"url": ""
},
"accessPath": {
"accessType": "DIRECT | KOV_ASSESSMENT | KOV_DECISION | HEALTH_CONTACT | REFERRAL_REQUIRED | PROVIDER_TRIAGE | UNKNOWN",
"firstStep": "Võta ühendust KOV sotsiaalvaldkonna kontaktiga.",
"decisionBy": ["KOV"],
"canContactForGuidance": true,
"documentsUsuallyNeeded": [
"olukorra kirjeldus",
"varasem otsus või plaan, kui olemas"
]
},
"journeyRole": "Võimalik esimene kontakt abivajaduse täpsustamiseks",
"canReceivePreContact": true,
"canJoinRoom": false,
"sourceType": "KOV_OFFICIAL_PAGE | SKA_GUIDE | PROVIDER_PROFILE | HEALTH_CONTACT_SOURCE",
"sourceStatus": "VALID | NEEDS_REVIEW | CHANGING",
"lastChecked": "2026-05-25"
}

Tervisekontakti puhul:

{
"entryType": "HEALTH_CONTACT",
"name": "Näidis perearstikeskus",
"accessPath": {
"accessType": "HEALTH_CONTACT",
"firstStep": "Võta tervisemure või arstliku hinnangu küsimuses ühendust perearstikeskusega.",
"decisionBy": ["healthcare_provider"],
"canContactForGuidance": true
},
"journeyRole": "Tervisemure või arstliku hinnangu esmaseks täpsustamiseks",
"canReceivePreContact": false,
"sourceStatus": "NEEDS_REVIEW"
}

6.16. MVP

Esimeses versioonis teeksin ainult selle:

1. Teenusekaart avaneb teekonnakaardilt eelfiltritega.

1. Teenusekaardil on eristatavad kirjetüübid:

  - KOV kontakt;

  - KOV teenus;

  - teenuseosutaja;

  - tervisekontakt.

1. Igal teenusel on väli Kuidas teenuseni jõuda?

1. Teenuse juures on ligipääsutüüp:

  - otsekontakt;

  - KOV hindamine;

  - KOV otsus;

  - tervisekontakt;

  - vajab suunamist;

  - tingimused kontrollida.

1. Kasutaja saab kontakti lisada teekonnale.

1. Kasutaja saab valitud kontakti põhjal koostada eelpöördumise või küsimuse.

1. Soovitatud kontakt ei näe kasutaja infot enne kinnitatud saatmist.

6.17. Hilisemad lisad

Hiljem saab lisada:

- teenuseosutaja enda uuendatav kättesaadavuse info;

- “võtab uusi pöördumisi vastu” märge;

- ooteaja info, kui teenuseosutaja soovib seda ise hallata;

- “info vajab kontrolli” kasutajate või spetsialistide tagasiside;

- teenusekaardi automaatkontroll KOV ja teenuseosutaja veebilehtedelt;

- teenuseosutaja profiili kvaliteedikontroll;

- tervisekontaktide ametlik allikapõhine uuendamine.

6.18. Platvormitekst

Teenusekaart aitab leida inimese teekonnaga seotud KOV sotsiaalvaldkonna kontakte, KOV teenuseid, sotsiaalvaldkonna teenuseosutajaid ja vajadusel esmaseid tervisekontakte. Teenusekaardil kuvatakse ka see, kas teenusele saab pöörduda otse või võib vaja olla KOV-i, arsti või muu pädeva osapoole hindamist, otsust või suunamist. SotsiaalAI ei määra teenust ega tee ametlikku suunamist, vaid aitab mõista, milline pöördumistee võib olla asjakohane ja milline võiks olla järgmine samm.

6.19. Kokkuvõte

Suurem punkt 6 oleks seega:

Teenusekaart uues loogikas on teekonnakaardi praktiline kontaktide, teenuste ja ligipääsuteede kiht. See jääb sotsiaalvaldkonna keskseks, kuid lisab piiratud tervisekontaktide kihi, et inimene ei liiguks automaatselt KOV-i poole olukorras, kus esmane samm peaks olema perearstikeskus või tervisekeskus.

Kõige tähtsam piir:

Teenusekaart ei määra teenust. Teenusekaart aitab kasutajal aru saada, kelle poole pöörduda ja kuidas teenuseni jõudmise tee võib alata.

# 7. Teenuseni jõudmise loogika

7.1. Põhimõte

SotsiaalAI ei peaks teenuseid kirjeldama ainult nii:

“Mis teenus see on?”

vaid lisama alati teise praktilise küsimuse:

“Kuidas inimene selle teenuseni jõuab?”

See on teekonnakaardi ja teenusekaardi üks olulisemaid sisulisi kihte.

Teenuse olemasolu ei tähenda, et inimene saab seda kohe kasutada. Mõne teenuse puhul saab inimene pöörduda otse. Mõne puhul peab KOV hindama abivajadust. Mõne puhul on vaja otsust, suunamist, arsti kontakti või teenuseosutaja eelset selgitust.

Seega peab SotsiaalAI teenuste puhul eristama:

- teenuse kirjeldust;

- teenuse korraldajat;

- ligipääsuteed;

- hindajat või otsustajat;

- esimest praktilist sammu;

- infot, mida inimene peaks enne pöördumist koguma;

- seda, mida SotsiaalAI saab aidata ette valmistada.

Kõige olulisem piir:

SotsiaalAI ei suuna inimest ametlikult teenusele, vaid selgitab teenuseni jõudmise võimalikku teed ja aitab järgmise sammu ette valmistada.

7.2. Miks see on vajalik?

Ilma teenuseni jõudmise loogikata võib platvorm jätta kasutajale vale mulje.

Näiteks kui inimene näeb teenusekaardil “koduteenus”, “tugiisikuteenus” või “sotsiaaltransport”, võib ta arvata, et saab selle lihtsalt valida või tellida.

Tegelikult on paljude KOV sotsiaalteenuste puhul loogika pigem:

1. inimene või lähedane kirjeldab abivajadust;

1. KOV hindab olukorda;

1. KOV otsustab, milline abi või teenus on sobiv;

1. vajadusel kaasatakse teenuseosutaja;

1. teenuse osutamise tingimused lepitakse täpsemalt kokku.

SotsiaalAI peab seda kasutajale arusaadavalt selgitama.

7.3. Teenuseni jõudmise põhiküsimused

Iga teenuse või kontakti puhul võiks teadmuspõhis ja teenusekaardil olla vastused järgmistele küsimustele:

1. Kas inimene saab pöörduda otse?

1. Kas vaja on KOV abivajaduse hindamist?

1. Kas vaja on KOV otsust või haldusakti?

1. Kas vaja on arsti, perearsti, raviarsti või muu tervisekontakti hinnangut/suunamist?

1. Kas teenuseosutajalt saab küsida tingimuste selgitust?

1. Kes teenuse korraldab või rahastab?

1. Kes otsustab teenuse saamise?

1. Mis on esimene praktiline samm?

1. Millist infot või dokumente võib vaja minna?

1. Kas info on kehtiv, muutuv või kontrollimist vajav?

7.4. Ligipääsutee tüübid

Teenusekaardi ja teekonnakaardi jaoks võiks teenustel olla ligipääsutee tüüp.

| Tüüp | Tähendus | Näide |
| --- | --- | --- |
| Otsekontakt | inimene saab teenuseosutajaga ise ühendust võtta | nõustamine, tasuline teenus, mõni MTÜ teenus |
| KOV hindamine | KOV peab hindama abivajadust | koduteenus, sotsiaaltransport, isiklik abistaja |
| KOV otsus | teenuse saamine eeldab KOV otsust | paljud KOV korraldatavad teenused |
| Tervisekontakt | esimene samm on perearstikeskus või tervisekeskus | tervisemure, arstlik hinnang, ravijärgne küsimus |
| Vajab suunamist | vaja on pädeva osapoole suunamist | tervise või rehabilitatsiooniga seotud teenused |
| Teenuseosutaja eelkontakt | teenuseosutaja saab selgitada tingimusi või sobivust | rehabilitatsiooniasutus, nõustamiskeskus |
| Tingimused vajavad kontrolli | andmed pole piisavad või võivad olla muutunud | muutuv reformiinfo, aegunud kontakt, ebaselge ligipääs |

7.5. KOV teenuste loogika

KOV teenuste puhul peaks SotsiaalAI põhivastus olema ettevaatlik ja erialaselt korrektne.

Näide:

Koduteenus võib olla asjakohane, kui inimesel on raskusi igapäevase toimetulekuga kodus. Teenuseni jõudmiseks tuleb tavaliselt pöörduda KOV sotsiaalvaldkonna kontakti poole. KOV hindab abivajadust ja otsustab, milline abi või teenus on sobiv. SotsiaalAI saab aidata koostada eelpöördumise või olukorra kokkuvõtte.

Selle loogika alla kuuluvad näiteks:

- koduteenus;

- sotsiaaltransport;

- tugiisikuteenus;

- isiklik abistaja;

- hooldus;

- eluruumi kohandamise või eluasemega seotud abi;

- täisealise isiku hooldus;

- KOV toetused, kui neid käsitletakse teenusekaardis.

7.6. Teenuseosutaja teenuste loogika

Teenuseosutaja puhul peab SotsiaalAI eristama kahte olukorda.

A. Teenuseosutajaga saab otse ühendust võtta

Näiteks inimene võib küsida:

- kas teenus sobib;

- kas teenust pakutakse tema piirkonnas;

- milline on hind;

- kas on vaba vastuvõtuaega;

- kas teenus eeldab suunamist.

Siis tegevus võib olla:

Koosta küsimus teenuseosutajale.

B. Teenus vajab ametlikku hindamist või suunamist

Sel juhul ei tohi SotsiaalAI jätta muljet, et teenuseosutaja saab inimese ise ametlikult teenusele võtta.

Õige vastus:

Teenuseosutajalt võib küsida tingimusi, kuid teenuseni jõudmine võib eeldada KOV-i, arsti, Tervisekassa, SKA või muu pädeva osapoole otsust või suunamist.

Teenuseosutaja profiilis võiks olla väli:

“Kas teenusele jõudmiseks on vaja suunamist või otsust?”

7.7. Tervisekontakti loogika

Tervisekontaktide lisamise mõte ei ole SotsiaalAI muutmine terviseplatvormiks.

Eesmärk on vältida olukorda, kus tervisemurega inimene suunatakse ekslikult ainult sotsiaaltöötaja poole.

Kui kasutaja kirjeldab tervisega seotud muret, ravijärgset küsimust, arstliku hinnangu vajadust või sümptomit, võib teekonnakaart pakkuda:

- perearstikeskus;

- tervisekeskus;

- pereõde;

- ametlik tervisenõu;

- kiire ohu korral 112 või erakorraline abi.

Näide:

Sinu kirjelduses on tervisega seotud küsimus. Esmane järgmine samm võib olla perearstikeskus või tervisekeskus. SotsiaalAI ei anna meditsiinilist hinnangut ega asenda arstiabi, kuid aitab koostada küsimused tervisekontaktile või eristada, milline osa murest võib vajada KOV sotsiaalvaldkonna tuge.

7.8. Kombineeritud tervise- ja sotsiaalne teekond

Paljud olukorrad ei ole ainult tervise või ainult sotsiaalvaldkonna küsimused.

Näide:

“Ema tuli haiglast koju, ei saa pesemisega hakkama, ei jaksa süüa teha ja ravimid ajavad segadusse.”

SotsiaalAI ei peaks suunama ainult ühte kanalisse.

Teekonnakaart võiks näidata:

Tervisega seotud järgmine samm

- perearstikeskus või ravi andnud asutus ravijärgsete küsimuste ja ravimitega seotud täpsustuste jaoks.

Sotsiaalvaldkonna järgmine samm

- KOV sotsiaalvaldkonna kontakt koduse toimetuleku, koduteenuse, hoolduskoormuse või sotsiaaltranspordi küsimustes.

SotsiaalAI tööriistad

- eelpöördumine KOV-ile;

- küsimused tervisekontaktile;

- dokumendi analüüs, kui olemas on haigla väljavõte või otsus;

- teekonnakaardi salvestamine.

7.9. “Esimene samm” peab olema nähtav

Iga teenuse juures peaks kasutaja nägema väga lihtsat rida:

Esimene samm: ...

Näited:

KOV teenus

Esimene samm: võta ühendust oma KOV sotsiaalvaldkonna kontaktiga ja kirjelda olukorda.

Teenuseosutaja

Esimene samm: küsi teenuseosutajalt, kas teenus sobib sinu olukorras ja kas teenusele jõudmiseks on vaja suunamist.

Tervisekontakt

Esimene samm: võta tervisemure või arstliku hinnangu küsimuses ühendust perearstikeskuse või tervisekeskusega.

Ebaselge info

Esimene samm: küsi tingimused üle ametlikult kontaktilt. SotsiaalAI saab aidata küsimuse mustandi koostada.

7.10. “SotsiaalAI saab aidata” plokk

Iga teenuse või kontakti juures võiks olla ka rida:

SotsiaalAI saab aidata:

Näiteks:

- koostada eelpöördumise;

- koostada küsimused KOV-ile;

- koostada küsimused teenuseosutajale;

- koostada küsimused perearstikeskusele;

- analüüsida varasemat otsust või teenuseplaani;

- teha olukorra kokkuvõtte;

- koostada inimesele lihtsas keeles selgituse;

- koostada spetsialistile juhtumikokkuvõtte.

See seob teenuseni jõudmise loogika olemasolevate tööriistadega.

7.11. Kasutajaliidese näide

Teenusekaardil võiks teenuse detailvaates olla selline struktuur:

Teenuse nimi
Koduteenus

Mis see on?
Lühike kirjeldus.

Kellele võib sobida?
Täisealine inimene, kellel on raskusi igapäevase toimetulekuga kodus.

Kuidas teenuseni jõuda?
See on KOV korraldatav teenus. Teenuseni jõudmiseks tuleb tavaliselt pöörduda KOV sotsiaalvaldkonna kontakti poole. KOV hindab abivajadust ja otsustab sobiva abi.

Esimene samm
Võta ühendust oma KOV sotsiaalvaldkonna kontaktiga ja kirjelda olukorda.

SotsiaalAI saab aidata

- koostada eelpöördumise;

- teha olukorra kokkuvõtte;

- lisada varasema dokumendi analüüsi;

- leida KOV kontakt teenusekaardilt.

Allikad ja kontroll
Info põhineb KOV teenusekirjeldusel / SKA juhendil / KOV määrusel. Viimati kontrollitud: kuupäev.

7.12. Teekonnakaardi näide

Kasutaja kirjeldab:

“Mul on vaja lapsele tugiisikut, aga ma ei tea, kust alustada.”

Teekonnakaart võiks öelda:

Võimalik teenusesuund: tugiisikuteenus
Ligipääsutee: tõenäoliselt KOV hindamine või KOV otsus
Esimene samm: pöördu KOV sotsiaalvaldkonna või lapse heaolu kontaktile ja kirjelda olukorda
Võimalik kontakt: teenusekaart pakub KOV kontakti
SotsiaalAI saab aidata: koostada lühikese eelpöördumise või põhjalikuma eelkaardistuse
Oluline piir: SotsiaalAI ei määra teenust; KOV hindab abivajadust ja otsustab sobiva toe

7.13. Andmemudel

Teenuse ligipääsutee võiks olla eraldi objekt.

{
"accessPath": {
"accessType": "KOV_ASSESSMENT",
"requiresAssessment": true,
"requiresDecision": true,
"requiresReferral": false,
"firstStep": "Võta ühendust KOV sotsiaalvaldkonna kontaktiga ja kirjelda olukorda.",
"decisionBy": ["KOV"],
"canContactProviderForGuidance": true,
"documentsUsuallyNeeded": [
"olukorra kirjeldus",
"varasem otsus või teenuseplaan, kui olemas",
"tervise- või muu hinnang, kui teenus seda eeldab"
],
"sotsiaalAiCanHelpWith": [
"PRE_CONTACT_DRAFT",
"SITUATION_SUMMARY",
"DOCUMENT_ANALYSIS",
"QUESTIONS_FOR_SPECIALIST"
],
"sourceRefs": ["source_001", "source_002"],
"sourceStatus": "VALID",
"lastChecked": "2026-05-25"
}
}

Tervisekontakti puhul:

{
"accessPath": {
"accessType": "HEALTH_CONTACT",
"requiresAssessment": false,
"requiresDecision": false,
"requiresReferral": false,
"firstStep": "Võta tervisemure või arstliku hinnangu küsimuses ühendust perearstikeskuse või tervisekeskusega.",
"decisionBy": ["healthcare_provider"],
"canContactProviderForGuidance": true,
"sotsiaalAiCanHelpWith": [
"QUESTIONS_FOR_HEALTH_CONTACT",
"SITUATION_SUMMARY"
],
"sourceStatus": "VALID_OR_NEEDS_REVIEW"
}
}

7.14. Assistendi vastusepoliitika

Kui kasutaja küsib teenuse kohta, peaks assistent vastama kindlas järjekorras:

1. Mis teenus või kontakt võib olla seotud?

1. Kas see on KOV, teenuseosutaja või tervisekontakti teema?

1. Kuidas selle teenuseni tavaliselt jõutakse?

1. Kes hindab või otsustab?

1. Mis on esimene praktiline samm?

1. Mida SotsiaalAI saab aidata koostada?

1. Mis vajab üle kontrollimist?

Näide:

Sotsiaaltransport võib olla asjakohane, kui inimesel on terviseseisundi, puude või muu takistuse tõttu keeruline vajalikele teenustele jõuda. Tegemist on KOV korraldatava sotsiaalteenusega. Teenuseni jõudmiseks tuleb tavaliselt pöörduda KOV sotsiaalvaldkonna kontakti poole, kes hindab abivajadust ja otsustab sobiva abi. SotsiaalAI saab aidata koostada eelpöördumise või olukorra kokkuvõtte.

7.15. Mida vältida?

SotsiaalAI ei tohiks öelda:

- “Sa saad selle teenuse.”

- “Sind suunatakse sellele teenusele.”

- “Vali teenus ja alusta.”

- “See teenus on sulle määratud.”

- “Perearst peab sulle suunamise andma.”

- “KOV peab selle teenuse andma.”

Õigemad sõnastused:

- “See teenus võib olla asjakohane.”

- “Teenuse saamine võib eeldada KOV hindamist.”

- “Esimene samm võib olla pöördumine KOV sotsiaalvaldkonna kontakti poole.”

- “Teenuseosutajalt saab küsida tingimuste täpsustust.”

- “Tervisemure korral võib esmane kontakt olla perearstikeskus või tervisekeskus.”

- “Ametliku otsuse teeb pädev osapool.”

7.16. Seos eelpöördumisega

Teenuseni jõudmise loogika annab eelpöördumisele sisu.

Kui teenus vajab KOV hindamist, siis eelpöördumine peaks olema suunatud KOV-ile ja sõnastatud näiteks nii:

“Soovin kirjeldada oma olukorda ja palun selgitada, kas minu abivajadust oleks võimalik hinnata ning milline abi või teenus võiks olla sobiv.”

Kui teenus vajab tingimuste täpsustamist teenuseosutajalt:

“Soovin küsida, kas teie teenus võiks minu olukorras sobida ja kas teenusele jõudmiseks on vaja KOV-i, arsti või muu osapoole suunamist.”

Kui teema on tervisekontakt:

“Soovin küsida, kas kirjeldatud tervisemure või ravijärgne olukord vajab perearsti/pereõe hinnangut või edasist suunamist.”

7.17. Seos dokumendi analüüsiga

Kui kasutajal on olemas:

- KOV otsus;

- rehabilitatsiooniplaan;

- teenuseplaan;

- arstlik dokument;

- haigla väljavõte;

- teenuseosutaja kiri;

- varasem hinnang;

siis teekonnakaart võib soovitada:

Laadi dokument analüüsiks.

Dokumendi analüüs saab välja tuua:

- mis teenus või otsus dokumendis on;

- tähtajad;

- kes on otsustaja;

- mis kohustused või järgmised sammud on kirjas;

- kas teenus lõpeb;

- kas on vaja küsida pikendust või täpsustust;

- milline pöördumine võiks olla vajalik.

7.18. Seos teenusekatkemise kontrolliga

Teenusekatkemise kontroll on erijuht teenuseni jõudmise loogikas.

Kui teenus on juba olemas, aga võib lõppeda, siis küsimus ei ole ainult “kuidas teenuseni jõuda”, vaid:

“Kuidas vältida teekonna katkemist?”

Kontroll peaks küsima:

- mis teenus praegu on;

- millal see lõpeb;

- kes teenust osutab;

- kas on olemas otsus või plaan;

- kas uus kontakt on teada;

- kas KOV või muu osapool on kaasatud;

- kas transport või ligipääs on probleem;

- kas on vaja kiiresti pöörduda.

Väljund:

- riskimärgis;

- esimene samm;

- sobiv kontakt;

- pöördumise mustand.

7.19. MVP

Esimeses versioonis piisab, kui iga teenusekaardi kirje juures on:

1. Ligipääsutee tüüp

  - otsekontakt;

  - KOV hindamine;

  - KOV otsus;

  - tervisekontakt;

  - vajab suunamist;

  - tingimused kontrollida.

1. Esimene samm

1. Kes otsustab või korraldab

1. Kas SotsiaalAI saab aidata eelpöördumise või küsimuse koostamisel

1. Allikas ja viimati kontrollitud kuupäev

See juba muudab teenusekaardi tavalisest kontaktikaardist teekonna tööriistaks.

7.20. Kokkuvõte

Teenusteni jõudmise loogika on SotsiaalAI uue mudeli üks olulisemaid sisulisi kihte.

Selle eesmärk on, et assistent ei ütleks lihtsalt:

“Selline teenus on olemas.”

vaid aitaks kasutajal mõista:

- kas see teenus võib olla seotud;

- kas teenusele saab pöörduda otse;

- kas vaja on KOV hindamist;

- kas vaja on otsust või suunamist;

- kas esmane samm on hoopis tervisekontakt;

- mida inimene saab täna teha;

- mida SotsiaalAI saab aidata ette valmistada.

Kõige olulisem sõnastus:

SotsiaalAI ei määra teenust ega tee ametlikku suunamist. SotsiaalAI aitab mõista teenuseni jõudmise võimalikku teed ja valmistada ette järgmise kontrollitava sammu.

# 8. Eelpöördumise ja eelkaardistuse uus koht

Eelpöördumine ei ole SotsiaalAI platvormi alguspunkt ega ametlik hindamine. Alguspunkt on privaatne assistendivestlus, kus inimene kirjeldab oma olukorda. Selle põhjal teeb SotsiaalAI esmase teekonnasõela: aitab aru saada, kas järgmine samm võiks olla KOV kontakt, teenuseosutaja, tervisekontakt, dokumendi analüüs, abisoov või muu tööriist.

Kui teekonnakaart näitab, et inimesel on mõistlik pöörduda spetsialisti poole, saab ta koostada eelpöördumise või täita eelkaardistuse. Selle eesmärk on esitada spetsialistile arusaadav, struktureeritud ja kasutaja poolt kinnitatud eelinfo.

Eelkaardistus võib tugineda SKA täisealise inimese abi- ja toetusvajaduse hindamise loogikale, sest juhendis kirjeldatakse STAR2 universaalset struktureeritud küsimustikku, mida kasutatakse sotsiaalvaldkonna spetsialistide poolt ühtsetel alustel KOV ja riiklike teenuste vajaduse hindamisel. Samas rõhutab juhend, et hindamine ise ei määra teenust ning spetsialist teeb hindamistulemuste põhjal kaalutletud otsuse.

8.1. Kolm tasandit

SotsiaalAI peaks selgelt eristama kolme tasandit.

| Tasand | Mis see on? | Kes kasutab? | Kas ametlik hindamine? |
| --- | --- | --- | --- |
| Esmane teekonnasõel | AI analüüsib kasutaja kirjeldust ja pakub järgmisi samme | kasutaja + AI | Ei |
| Eelkaardistus / eelpöördumine | kasutaja koostab spetsialistile jagatava eelinfo | kasutaja, hiljem spetsialist | Ei |
| Ametlik hindamine | spetsialist viib läbi hindamise oma töökorra järgi | KOV/SKA/spetsialist | Jah |

See on sinu platvormi jaoks väga hea piir.

8.2. Eelpöördumise eesmärk

Eelpöördumise ja eelkaardistuse eesmärk ei ole öelda:

“Inimese abivajadus on hinnatud.”

Eesmärk on öelda:

“Inimene on oma olukorra spetsialistile arusaadavalt ette kirjeldanud.”

See aitab spetsialistil:

- kiiremini aru saada, mis on põhimure;

- näha, millised eluvaldkonnad võivad olla seotud;

- märgata, milline info on puudu;

- valmistuda kohtumiseks;

- otsustada, mida ametlikus hindamises täpsustada;

- vajadusel kasutada infot STAR2/KOV tööprotsessis edasi.

8.3. Miks see on professionaalselt tugev?

SKA juhendi loogika toetab seda hästi. Juhendis on kirjas, et spetsialist viib inimese ja/või lähedasega läbi struktureeritud vestluse, aga küsimustiku täpset järjekorda ei pea jäigalt järgima; eesmärk ei ole inimest üle kuulata, vaid koondada toimetuleku tagamiseks oluline info. Samuti küsitakse inimeselt ja lähedastelt vaid neid andmeid, mida teistest ametlikest allikatest ei saa.

See sobib SotsiaalAI mudeliga väga hästi:

kasutaja võib alustada vaba kirjeldusega → AI aitab selle struktureerida → kasutaja valib, mida jagada → spetsialist saab eelinfo, mitte valmis otsuse.

8.4. Kuidas seda kasutajale nimetada?

Ma ei nimetaks seda põhivaates lihtsalt “hindamiseks”.

Parem nimetada:

- Eelkaardistus

- Eelinfo spetsialistile

- Eelpöördumise küsimustik

- Olukorra kirjeldus spetsialistile

Selgitavas tekstis võib öelda:

Küsimused lähtuvad täisealise abi- ja toetusvajaduse hindamise eluvaldkondade loogikast, kuid SotsiaalAI-s täidetud vastused on spetsialistile esitatav eelinfo, mitte ametlik hindamine.

8.5. Platvormitekst

Selle võiks panna eelpöördumise või küsimustiku algusesse:

Eelkaardistus aitab sul enne spetsialisti poole pöördumist oma olukorda eluvaldkondade kaupa kirjeldada. Küsimused lähtuvad täisealise inimese abi- ja toetusvajaduse hindamise loogikast, mida kasutavad sotsiaalvaldkonna spetsialistid. SotsiaalAI-s täidetud eelkaardistus ei ole ametlik hindamine ega teenuseotsus. See on spetsialistile esitatav eelinfo, mida saad enne saatmist üle vaadata ja muuta.

8.6. Vastuvõtja tekst

Spetsialistile võiks kuvada:

Kasutaja on täitnud eelinfo kaardi, mis järgib abi- ja toetusvajaduse hindamise eluvaldkondade loogikat. Tegemist ei ole ametliku hindamisega. Vastused on kasutaja enda kirjeldatud eelinfo, mida spetsialist saab kasutada vestluse ettevalmistamiseks ja vajadusel ametlikus hindamises täpsustada.

8.7. Kõige parem kokkuvõte punktile 8

Eelpöördumine on SotsiaalAI-s sillakiht inimese ja spetsialisti vahel. See aitab inimesel oma olukorra selgelt ja hindamisloogikaga ühilduvalt kirja panna, kuid ei asenda KOV/SKA/spetsialisti ametlikku hindamist, otsust ega teenusele suunamist.

Seega jah: punkt 8 tuleb uuesti sõnastada, aga punktid 1–7 vajavad ainult väikest täpsustust: lisame neisse termini esmane teekonnasõel ja eristame seda selgelt spetsialistile mõeldud eelkaardistusest.

Mõtles 27s

8. Eelpöördumise ja eelkaardistuse uus koht

Eelpöördumine jääb SotsiaalAI üks olulisemaid töövooge, kuid selle roll tuleb täpselt eristada kolmest asjast:

1. AI esmane teekonnasõel – assistent analüüsib kasutaja kirjeldust, et pakkuda järgmisi samme.

1. Eelpöördumine / eelkaardistus – kasutaja koostab spetsialistile või teenuseosutajale jagatava eelinfo.

1. Ametlik hindamine – selle teeb KOV, SKA või muu pädev spetsialist oma töökorra ja infosüsteemide järgi.

Seega eelpöördumine ei ole SotsiaalAI-s ametlik abivajaduse hindamine ega teenuseotsus. See on spetsialistile esitatav struktureeritud eelinfo, mis aitab inimesel oma olukorda arusaadavalt kirjeldada ja aitab spetsialistil hilisemat vestlust või ametlikku hindamist ette valmistada.

Selle tugevus on, et eelkaardistus saab tugineda samale eluvaldkondade loogikale, mida kasutatakse täisealise inimese abi- ja toetusvajaduse hindamisel: suhtlemine, vaimne tervis, füüsiline tervis, elukeskkond, hõivatus, vaba aeg ja huvitegevus ning igapäevaelu toimingud. SKA juhendis on need eluvaldkonnad kirjeldatud täisealise abivajaduse hindamise struktuuri osana.

8.1. Põhimõte

SotsiaalAI kasutaja ei pea alustama pika küsimustiku täitmisest. Ta alustab privaatses assistendivestluses oma olukorra kirjeldamisega.

Assistent teeb selle põhjal esmase teekonnasõela:

- kas teema on pigem sotsiaalvaldkonna, teenuseosutaja või tervisekontakti küsimus;

- kas vaja on KOV kontakti;

- kas võib olla teenusekatkemise risk;

- kas kasutaja vajab hoopis dokumendi analüüsi;

- kas olukord viitab kriisi- või ohusignaalile;

- kas eelpöördumine on sobiv järgmine samm.

Kui teekonnasõel näitab, et vaja on kellegi poole pöörduda, saab kasutaja liikuda eelpöördumisse või eelkaardistusse.

Seega järjestus on:

Privaatne assistendivestlus
→ esmane teekonnasõel
→ teekonnakaart
→ eelpöördumine / eelkaardistus, kui on vaja eelinfot jagada
→ kasutaja kinnitab jagatava sisu
→ spetsialist või teenuseosutaja saab eelinfo
→ vajadusel ametlik hindamine, vestlusruum või kohtumine

8.2. Mida SotsiaalAI võib “hinnata”?

SotsiaalAI peab kasutaja kirjelduse põhjal tegema mingit analüüsi, muidu ei saa ta soovitada järgmist sammu. Seda võib nimetada esmaseks teekonnasõelaks.

SotsiaalAI võib tuvastada:

- võimalikud seotud eluvaldkonnad;

- kas olukord puudutab igapäevast toimetulekut;

- kas kirjeldus viitab tervisega seotud esmasele kontaktile;

- kas mure on KOV teenuste, teenuseosutaja või muu kontakti küsimus;

- kas inimesel võib olla vaja eelinfot spetsialistile;

- kas on puudu olulist infot;

- kas on vaja ohusuunamist;

- kas sobib lühike pöördumine, lühem küsimustik või põhjalikum eelkaardistus.

SotsiaalAI ei tohi öelda:

- “abivajadus on hinnatud”;

- “teenus on määratud”;

- “inimene vajab kindlasti seda teenust”;

- “KOV peab selle teenuse andma”;

- “see on ametlik STAR2 hindamine”.

Õige sõnastus on:

SotsiaalAI teeb esmase teekonnasõela ja aitab ette valmistada spetsialistile jagatava eelinfo. Ametliku hindamise ja otsuse teeb pädev spetsialist või asutus.

8.3. Eelpöördumise eesmärk

Eelpöördumise eesmärk on aidata inimesel endast märku anda ja oma olukorda spetsialistile arusaadavalt kirjeldada.

Eelpöördumine aitab:

- koondada inimese enda kirjelduse;

- tuua välja peamise mure;

- siduda mure eluvaldkondadega;

- märkida, mis info on puudu;

- kirjeldada, mida inimene ise soovib;

- lisada varasemad dokumendid või otsused;

- valida sobiva adressaadi;

- koostada pöördumise mustandi;

- jagada ainult kasutaja kinnitatud eelinfo.

Eelpöördumine ei ole:

- ametlik hindamine;

- automaatne teenusetaotlus;

- teenuse määramine;

- KOV otsus;

- meditsiiniline hinnang;

- spetsialisti töö asendamine.

Kõige täpsem sõnastus:

Eelpöördumine on sillakiht inimese ja spetsialisti vahel.

8.4. Eelkaardistus kui spetsialistile mõeldud eelinfo

Kui kasutaja täidab eelpöördumise küsimustiku, siis seda ei tuleks esitleda kui “SotsiaalAI hindamist”, vaid kui eelkaardistust spetsialistile.

Eelkaardistus võib põhineda täisealise inimese abi- ja toetusvajaduse hindamise eluvaldkondadel. See loob ühilduvuse KOV spetsialisti tööloogikaga, sest SKA juhendi järgi on STAR2-s kasutatav täisealise inimese abi- ja toetusvajaduse hindamise küsimustik universaalne ja struktureeritud ning kasutatav sotsiaalvaldkonna spetsialistide poolt nii KOV kui ka riiklike teenuste vajaduse hindamiseks.

Samas tuleb igal pool rõhutada:

SotsiaalAI eelkaardistus ei ole ametlik hindamine. See on kasutaja koostatud eelinfo, mida spetsialist saab vajadusel vestlusel või ametlikus hindamises täpsustada.

8.5. Miks see loogika sobib SKA juhendiga?

SKA juhendi järgi dokumenteeritakse hindamise käigus inimese hetkeolukord ja spetsialist saab ülevaate valdkondadest, kus inimesel on tuge ja abi vaja. Juhendis rõhutatakse ka, et hindamine iseenesest ei määra teenust, vaid spetsialist teeb hindamistulemustele tuginedes kaalutletud otsuse.

See sobib SotsiaalAI-ga nii:

- SotsiaalAI aitab inimesel enne kontakti oma hetkeolukorda kirjeldada;

- SotsiaalAI aitab infot eluvaldkondade kaupa korrastada;

- inimene kinnitab, mida ta soovib spetsialistile jagada;

- spetsialist kasutab seda vestluse ettevalmistamiseks;

- ametlik hindamine ja otsus jäävad spetsialistile.

SKA juhend toetab ka paindlikku vestlusloogikat: spetsialist viib inimese ja/või lähedasega läbi struktureeritud vestluse, kuid küsimustiku täpset järjekorda ei ole kohustuslik järgida; eesmärk ei ole inimest üle kuulata, vaid koondada kokku oluline info inimese toimetuleku tagamiseks.

See tähendab, et SotsiaalAI-s võib inimene alustada vabast kirjeldusest, täita lühema küsimustiku, minna põhjalikuma eelkaardistuseni või soovida küsimustikku täita koos spetsialistiga.

8.6. Eelpöördumise tasemed

Eelpöördumisel võiks olla mitu taset.

1. Lühike märguanne

Sobib inimesele, kes ei oska või ei jaksa veel põhjalikku vormi täita.

Sisu:

- peamine mure;

- kelle poole soovib pöörduda;

- mida inimene soovib;

- kas soovib abi küsimustiku täitmisel;

- eelistatud suhtlusviis.

Näide:

“Soovin abi oma olukorra täpsustamisel. Ma ei oska kogu küsimustikku üksi täita ja soovin võimalusel spetsialistiga edasi rääkida.”

2. Lühike eelpöördumine

Sobib siis, kui kasutaja tahab kiiresti kontakti võtta.

Sisu:

- olukorra lühikirjeldus;

- peamine küsimus;

- piirkond;

- varasem abi, kui teada;

- soovitud järgmine samm;

- kas soovib kirjalikku vastust, vestlusruumi või kohtumist.

3. Lühem küsimustik

Sobib siis, kui on vaja rohkem infot, aga mitte kogu põhjalikku eelkaardistust.

Võimalikud küsimused:

- Mis on peamine mure?

- Kuidas see igapäevaelu mõjutab?

- Millist abi on varem saadud?

- Kas mõni teenus või tugi on lõppemas?

- Kas on olemas dokumente, otsuseid või plaane?

- Mida inimene ise soovib?

- Kas on kiireid riske?

4. Põhjalikum eelkaardistus

Sobib siis, kui inimene soovib spetsialistile põhjalikumat eelinfot anda.

See võib olla üles ehitatud eluvaldkondade kaupa:

- suhtlemine;

- vaimne tervis;

- füüsiline tervis;

- elukeskkond;

- hõivatus;

- vaba aeg ja huvitegevus;

- igapäevaelu toimingud;

- mitteametlik ja ametlik abi;

- abivahendid;

- inimese enda olulisemad vajadused.

Kasutajale peab olema selge, et see on eelinfo, mitte ametlik hindamistulemus.

5. Teenuse jätkumise eelpöördumine

Sobib siis, kui teenus võib katkeda.

Sisu:

- mis teenus on või oli;

- millal teenus lõpeb;

- kes teenust osutab;

- kas on olemas otsus, plaan või hinnang;

- kas KOV on kaasatud;

- kas uus kontakt on teada;

- kas transport või ligipääs on probleem;

- mida inimene soovib täpsustada.

Väljund:

- pöördumine KOV-ile või teenuseosutajale;

- küsimused teenuse jätkumise kohta;

- soovitus lisada varasem dokument.

6. Teenuseosutajale suunatud küsimus

Sobib siis, kui inimene ei küsi ametlikku KOV hindamist, vaid soovib teenuse tingimusi teada.

Sisu:

- kas teenus sobib tema olukorras;

- kas teenusele saab otse pöörduda;

- kas vaja on KOV-i, arsti või muu osapoole suunamist;

- milliseid dokumente on vaja;

- kas võimalik on vestlusruum, helivestlus või kohtumine.

7. Tervisekontaktile suunatud küsimus

Sobib siis, kui teekonnasõel näitab, et esmane samm võib olla perearstikeskus või tervisekeskus.

Sisu:

- tervisemure või ravijärgse küsimuse lühikirjeldus;

- küsimused perearstile või pereõele;

- kas vaja on tervishoiutöötaja hinnangut;

- kas sotsiaalteenuse poole pöördumiseks on vaja tervisega seotud infot täpsustada.

SotsiaalAI ei anna siin meditsiinilist hinnangut, vaid aitab küsimused selgelt sõnastada.

8.7. Täitmise viisid

Eelpöördumise puhul tuleb eristada kahte asja:

kui põhjalikult infot antakse ja kuidas infot kogutakse.

Täitmise viisid:

| Viis | Selgitus |
| --- | --- |
| Täidan ise kirjalikult | kasutaja täidab vormi või küsimustiku ise |
| Soovin täita koos spetsialistiga | kasutaja saadab lühikese märguande ja soovib juhendatud täitmist |
| Soovin esmalt vestlusruumis suhelda | kasutaja soovib enne vormi täitmist täpsustavat suhtlust |
| Soovin võimalusel helivestlust | kasutaja märgib, et heli sobiks talle paremini |
| Soovin kohtumist kohapeal | eelpöördumine toimib kohtumise ettevalmistava eelinfona |
| Soovin ainult kirjalikku vastust | kasutaja ei soovi ruumi ega kohtumist, vaid vastust või juhist |

See teeb eelpöördumise ligipääsetavaks ka inimesele, kes ei saa või ei taha põhjalikku küsimustikku üksi täita.

8.8. Eelpöördumise kasutajaliidese loogika

Eelpöördumine võiks kasutajale avaneda kahe sammuna.

Samm 1: Kui palju soovid praegu kirja panna?

- Saadan lühikese märguande.

- Koostan lühikese eelpöördumise.

- Vastan lühemale küsimustikule.

- Täidan põhjalikuma eelkaardistuse.

- Ma ei oska valida — aita valida.

Samm 2: Kuidas soovid edasi liikuda?

- Täidan ise.

- Soovin täita koos spetsialistiga.

- Soovin esmalt vestlusruumis suhelda.

- Soovin võimalusel helivestlust.

- Soovin kohtumist kohapeal.

- Soovin ainult kirjalikku vastust.

SotsiaalAI võib teekonnasõela põhjal soovitada sobivat varianti, aga kasutaja valib ise.

8.9. Jagatav eelinfo kaart

Eelpöördumine ei tohi jagada kogu privaatset assistendivestlust.

Jagatavaks sisuks luuakse eraldi eelinfo kaart.

See võib sisaldada:

- kasutaja kinnitatud olukorra kokkuvõtet;

- peamist muret;

- inimese enda soovi;

- valitud pöördumise tüüpi;

- täitmise viisi;

- seotud eluvaldkondi;

- teenusekatkemise riski märget, kui asjakohane;

- puuduolevat infot;

- lisatud dokumente;

- eelistatud suhtlusviisi;

- nõusolekut jagamiseks.

Kasutaja peab enne saatmist saama:

- lugeda;

- muuta;

- eemaldada infot;

- lisada infot;

- kinnitada, kellele info saadetakse.

8.10. Eelpöördumise adressaadid

Eelpöördumise adressaat võib olla:

- KOV sotsiaalvaldkonna kontakt;

- KOV lastekaitse või lapse heaolu kontakt, kui vastav lapse/pere loogika on eraldi olemas;

- teenuseosutaja;

- tervisekontakt, kitsalt küsimuste vormis;

- konkreetne platvormis olev spetsialist;

- teenuseprofiil;

- kasutaja enda jaoks salvestatud mustand;

- välise e-kirjana avatav kiri.

MVP-s piisab kolmest:

1. KOV kontakt;

1. teenuseosutaja;

1. kasutaja enda mustand / e-kiri.

Tervisekontakti küsimuste mustandi võib lisada siis, kui teenusekaardis on tervisekontaktide kiht.

8.11. Vastuvõtja vaade

Kui spetsialist või teenuseosutaja saab eelpöördumise, ei peaks ta nägema lihtsalt pikka vabateksti.

Ta võiks näha struktureeritud eelinfo kaarti:

- pöördumise tüüp;

- kaardistuse tase;

- täitmise viis;

- peamine mure;

- inimese enda soov;

- seotud eluvaldkonnad;

- võimalik teenusekatkemise risk;

- puuduolev info;

- lisatud dokumendid;

- eelistatud suhtlusviis;

- kas kasutaja soovib juhendatud eelkaardistust;

- kas kasutaja soovib vestlusruumi, helivestlust või kohtumist.

Vastuvõtja saab:

- võtta pöördumise vastu;

- küsida lisainfot;

- koostada vastuse mustandi;

- avada vestlusruumi;

- pakkuda kohtumist;

- märkida, et pöördumine ei kuulu tema pädevusse;

- soovitada teist kontakti.

Spetsialistile kuvatav selgitus võiks olla:

Kasutaja on täitnud eelinfo kaardi, mis järgib abi- ja toetusvajaduse hindamise eluvaldkondade loogikat. Tegemist ei ole ametliku hindamisega. Vastused on kasutaja enda kirjeldatud eelinfo, mida spetsialist saab kasutada vestluse ettevalmistamiseks ja vajadusel ametlikus hindamises täpsustada.

8.12. Seos teekonnakaardiga

Eelpöördumine võtab sisendi teekonnakaardilt.

Näiteks teekonnakaart võib anda:

- seotud valdkonnad;

- võimalikud teenused või teenusesuunad;

- soovitatud kontaktid;

- puuduoleva info;

- teenusekatkemise riski;

- soovitatud tööriista;

- dokumendi analüüsi tulemuse.

Eelpöördumine kasutab seda:

- eeltäidab olukorra kokkuvõtte;

- lisab sobiva adressaadi;

- soovitab õige pöördumise tüübi;

- märgib, mida võiks veel täpsustada;

- pakub lisada dokumente;

- valmistab ette jagatava eelinfo.

8.13. Seos teenusekaardiga

Teenusekaart annab eelpöördumisele:

- adressaadi;

- kontakti tüübi;

- teenuse või teenuseosutaja konteksti;

- ligipääsutee;

- kas teenus vajab KOV hindamist või otsust;

- kas teenuseosutaja võtab eelpöördumisi vastu;

- millist infot võib olla vaja.

Kui kasutaja valib teenuseosutaja, kelle teenus vajab KOV otsust, peab eelpöördumine näitama hoiatust:

See teenus võib vajada KOV-i hindamist või otsust. Teenuseosutajalt saab küsida tingimusi, kuid teenuse saamiseks võib olla vaja pöörduda ka KOV-i poole.

8.14. Seos dokumendi analüüsiga

Kui kasutajal on olemas dokument, saab eelpöördumine kasutada dokumendi analüüsi tulemust.

Näiteks:

- varasem KOV otsus;

- rehabilitatsiooniplaan;

- teenuseplaan;

- arstlik kokkuvõte;

- teenuseosutaja kiri;

- ametlik vastus;

- varasem hindamine.

Dokumendi analüüs võib anda eelpöördumisele:

- tähtajad;

- teenuse lõppemise info;

- otsustaja;

- varasema teenuse või abimeetme;

- küsimused, mida vastuvõtjalt küsida;

- kokkuvõtte, mida lisada eelinfo kaardile.

8.15. Seos vestlusruumiga

Eelpöördumise järel võib tekkida vestlusruum, aga mitte automaatselt.

Vestlusruum tekib siis, kui:

- kasutaja soovib täpsustavat suhtlust;

- vastuvõtja lubab või algatab ruumi;

- juhendatud eelkaardistus vajab koostööd;

- osapooled soovivad jätkata platvormis;

- kasutaja kinnitab ruumi loomise.

Eelpöördumises võiks olla valik:

“Soovin vajadusel jätkata vestlusruumis.”

Täpsemad valikud:

- kirjalik vestlusruum;

- helivestlus, kui vastuvõtja nõustub;

- küsimustiku täitmine koos spetsialistiga;

- kohapealne kohtumine.

8.16. Privaatsus ja kontroll

Eelpöördumises on privaatsus keskne.

Reeglid:

1. Privaatset assistendivestlust ei jagata.

1. Jagatav eelinfo luuakse eraldi.

1. Kasutaja näeb enne saatmist kogu jagatavat sisu.

1. Kasutaja saab teksti muuta ja eemaldada.

1. Privaatsuse eelkiht märgib liigsed isikuandmed.

1. Vastuvõtja näeb ainult saadetud infot.

1. Vestlusruum ei ava kogu teekonda automaatselt.

1. Helikõne ja transkriptsioon on eraldi nõusolekupõhised.

Kasutajale sobiv tekst:

Enne saatmist saad üle vaadata ja muuta kogu info, mida vastuvõtja näeb. Privaatset vestlust assistendiga ei jagata.

8.17. Andmemudel

Eelpöördumise mudel võiks olla seotud teekonnaga.

{
"preContact": {
"id": "pre_001",
"journeyId": "journey_001",
"ownerUserId": "user_001",
"recipientType": "KOV_CONTACT",
"recipientId": "party_001",
"status": "DRAFT",
"preContactType": "SERVICE_CONTINUITY",
"mappingDepth": "SHORT_FORM",
"completionMode": "SELF_COMPLETED",
"preferredCommunication": ["PLATFORM_MESSAGE", "ROOM_IF_NEEDED"],
"summary": "Kasutaja kirjeldab teenuse lõppemise muret ja soovib teada, kuidas jätkutuge korraldada.",
"mainQuestion": "Palun selgitada, kas abivajadust saab hinnata ja milline järgmine samm oleks sobiv.",
"relatedDomains": ["KOV_SOCIAL_SERVICES", "TRANSPORT", "SERVICE_CONTINUITY"],
"riskSignals": ["SERVICE_CONTINUITY_RISK"],
"missingInfo": ["serviceEndDate"],
"attachments": [],
"shareConfirmed": false,
"createdAt": "2026-05-25T12:00:00Z"
}
}

Kaardistuse ja täitmise valikud:

{
"mappingDepth": "BRIEF_NOTICE | SHORT_FORM | GUIDED_SHORT | EXTENDED_MAPPING",
"completionMode": "SELF_COMPLETED | WITH_SPECIALIST_IN_ROOM | AUDIO_SUPPORTED | IN_PERSON_REQUESTED | WRITTEN_REPLY_ONLY"
}

8.18. Kasutajatekstid

Eelpöördumise alguses

Eelpöördumine aitab sul oma olukorda arusaadavalt kirjeldada ja valitud kontaktile jagatava eelinfo ette valmistada. See ei ole ametlik abivajaduse hindamine ega teenuseotsus. Spetsialist või asutus saab vajadusel infot täpsustada ja teha ametliku hindamise või otsuse oma töökorra järgi.

Eelkaardistuse alguses

Eelkaardistus aitab sul enne spetsialisti poole pöördumist oma olukorda eluvaldkondade kaupa kirjeldada. Küsimused lähtuvad täisealise inimese abi- ja toetusvajaduse hindamise loogikast, mida kasutavad sotsiaalvaldkonna spetsialistid. SotsiaalAI-s täidetud eelkaardistus ei ole ametlik hindamine ega teenuseotsus. See on spetsialistile esitatav eelinfo, mida saad enne saatmist üle vaadata ja muuta.

Lühikese märguande juures

Sa ei pea kogu infot kohe üksi kirja panema. Võid saata lühikese märguande ja märkida, et soovid küsimustiku või olukorra täpsustamist koos spetsialistiga.

Enne saatmist

Palun vaata üle, mida vastuvõtja näeb. Saadetakse ainult sinu kinnitatud eelinfo, mitte kogu privaatne vestlus assistendiga.

8.19. Mida vältida?

Vältida tuleks nimetusi ja sõnastusi, mis jätavad ametliku hindamise mulje:

- “SotsiaalAI hindas sinu abivajadust”

- “Hindamistulemus”

- “Teenuse määramise soovitus”

- “Sulle määratud teenus”

- “SotsiaalAI otsustas”

- “Ametlik hinnang”

Paremad sõnad:

- esmane teekonnasõel;

- eelkaardistus;

- eelinfo spetsialistile;

- eelpöördumise küsimustik;

- olukorra kokkuvõte;

- jagatav eelinfo kaart;

- võimalik järgmine samm.

8.20. MVP

Esimeses versioonis piisab:

Tüübid:

- lühike märguanne;

- lühike eelpöördumine;

- lühem küsimustik;

- põhjalikum eelkaardistus;

- teenuse jätkumise eelpöördumine.

Täitmise viisid:

- täidan ise;

- soovin täita koos spetsialistiga;

- soovin vestlusruumis suhelda;

- soovin helivestlust võimalusel;

- soovin kohtumist kohapeal.

Väljundid:

- mustand;

- kasutaja kinnitatud jagatav eelinfo;

- saatmine valitud KOV kontaktile või teenuseosutajale;

- võimalus salvestada või alla laadida;

- vastuvõtja struktureeritud vaade.

8.21. Kokkuvõte

Eelpöördumise uus koht SotsiaalAI-s on järgmine:

Eelpöördumine ei ole platvormi alguspunkt ega ametlik hindamine. See on teekonnakaardist sündiv eelinfo töövoog, mis aitab inimesel oma olukorda spetsialistile arusaadavalt kirjeldada.

AI võib teha esmase teekonnasõela, et soovitada järgmist sammu. Põhjalikum eelkaardistus võib tugineda SKA/STAR2 eluvaldkondade loogikale, et luua KOV spetsialistile tööalaselt arusaadav sisend. Kuid ametlik hindamine, otsus ja teenuse määramine jäävad pädevale spetsialistile või asutusele.

Kõige lühem sõnastus:

SotsiaalAI aitab inimesel spetsialistile mõistetavalt ja hindamisloogikaga ühilduvalt endast märku anda, kuid ei asenda spetsialisti hindamist ega otsust.

# 9. Juhendatud eelkaardistus

Juhendatud eelkaardistus on töövoog inimesele, kes ei soovi või ei saa eelpöördumise küsimustikku üksi täita. Selle asemel saab ta anda endast märku ja paluda, et küsimustik või olukorra täpsustamine toimuks koos spetsialisti, teenuseosutaja või muu vastuvõtjaga.

See on SotsiaalAI-s väga oluline ligipääsetavuse funktsioon: inimene ei pea olema hea kirjutaja, digipädev ega suutma oma abivajadust kohe ametlikus keeles kirjeldada.

Kõige lühemalt:

Juhendatud eelkaardistus võimaldab inimesel öelda: “Ma soovin pöörduda, aga palun aidake mul olukord koos läbi rääkida ja kirja panna.”

9.1. Põhimõte

Juhendatud eelkaardistus ei ole eraldi ametlik hindamine. See on koostöös täidetav eelinfo, mida saab hiljem kasutada spetsialisti vestluse, kohtumise või ametliku hindamise ettevalmistamisel.

SKA juhendi loogika sobib sellega hästi, sest juhendis rõhutatakse, et spetsialist viib inimese ja/või lähedasega läbi struktureeritud vestluse, kuid küsimustiku täpset järjekorda ei pea jäigalt järgima; eesmärk ei ole inimest “üle kuulata”, vaid koondada inimese toimetuleku seisukohalt oluline info.

Seega SotsiaalAI ei pea juhendatud eelkaardistuses tegema “roboti vormi”. Pigem peab see toetama loomulikku vestlust, kus küsimustiku struktuur on taustal olemas.

9.2. Kus see töövoog algab?

Juhendatud eelkaardistus võib alata kolmest kohast.

1. Eelpöördumise valikust

Kasutaja valib:

“Soovin täita koos spetsialistiga.”

Siis ei pea ta kohe kogu vormi täitma. Ta saadab lühikese märguande, kus on kirjas:

- peamine mure;

- soov küsimustikku koos täita;

- eelistatud viis: vestlusruum, helivestlus või kohapealne kohtumine;

- kelle poole ta pöördub.

2. Assistendivestlusest

Kasutaja kirjutab näiteks:

“Ma ei oska seda kirja panna, tahaks kellegagi rääkida.”

Assistent võib pakkuda:

“Sa ei pea küsimustikku üksi täitma. Võid saata lühikese eelpöördumise ja märkida, et soovid eelkaardistust täita koos spetsialistiga.”

3. Vastuvõtja algatusel

Spetsialist või teenuseosutaja saab eelpöördumise ja märkab, et info on napp. Ta võib pakkuda:

“Täpsustame olukorda koos vestlusruumis / helikõnes / kohtumisel.”

9.3. Kasutaja vaade

Kasutaja jaoks võiks see olla väga lihtne valik.

Kuidas soovid küsimustikku või olukorra kirjeldust täita?

- Täidan ise kirjalikult.

- Soovin täita koos spetsialistiga vestlusruumis.

- Soovin võimalusel helivestlust.

- Soovin kohtumist kohapeal.

- Soovin esmalt lihtsalt selgitada, mis mure on.

Kui kasutaja valib koos täitmise, siis platvorm ei sunni teda kohe pikalt kirjutama. Piisab näiteks:

“Kirjelda ühe-kahe lausega, miks soovid kontakti.”

Näide:

“Mul on raske kodus toime tulla ja ma ei tea, millist abi küsida. Soovin küsimustiku täita koos spetsialistiga.”

9.4. Spetsialisti vaade

Spetsialistile ei peaks see tulema lihtsalt tavalise tekstina. Pöördumiste vastuvõtus võiks olla eraldi märge:

Pöördumise tüüp: juhendatud eelkaardistuse soov
Kasutaja soov: täita küsimustik koos spetsialistiga
Eelistatud viis: vestlusruum / helivestlus / kohapealne kohtumine
Peamine mure: lühikokkuvõte
Kaardistuse tase: lühem küsimustik / põhjalikum eelkaardistus / täpsustamisel
Lisainfo: dokumendid, teekonnakaart, teenusekatkemise risk, kui olemas

Spetsialist saab valida:

- võtan pöördumise vastu;

- küsin lisainfot;

- pakun vestlusruumi;

- pakun kohtumist;

- märgin, et pöördumine ei kuulu minu pädevusse;

- suunan teise kontakti poole.

9.5. Juhendatud eelkaardistuse kanalid

Juhendatud eelkaardistus ei pea toimuma ainult ühes vormis.

1. Kirjalik vestlusruum

Sobib inimesele, kes soovib rahulikult kirjutada.

Töövoog:

- spetsialist küsib;

- inimene vastab;

- SotsiaalAI aitab vastuse struktureerida;

- spetsialist saab märkida vastuse sobivasse eluvaldkonda;

- lõpus tekib ülevaadatav kokkuvõte.

2. Helivestlus vestlusruumis

Sobib inimesele, kellel on kirjutamine raske või kes eelistab rääkida.

Oluline piir:

Helikõne ei salvestu vaikimisi.
Kui soovitakse transkriptsiooni või kokkuvõtet, peab selleks olema eraldi nõusolek.

Töövoog:

- osapooled alustavad audio-only kõnet;

- spetsialist täidab küsimustikku vestluse põhjal;

- SotsiaalAI võib aidata koostada kokkuvõtte ainult siis, kui selleks on nõusolek ja kasutaja kinnitab tulemuse.

3. Kohapealne kohtumine

Kui inimene soovib minna KOV-i või teenuseosutaja juurde kohapeale, siis SotsiaalAI saab enne kohtumist koostada:

- lühikese olukorra kokkuvõtte;

- peamised küsimused;

- eelinfo kaardi;

- dokumendiloendi, mida kaasa võtta.

4. Hübriidne töövoog

Näiteks inimene alustab kirjalikult, siis jätkab helivestluses ja hiljem kinnitab kirjaliku kokkuvõtte.

9.6. Küsimustiku loogika juhendatud täitmisel

Küsimustik ei tohiks avaneda inimesel korraga 50 küsimusega. Juhendatud eelkaardistuses võiks see olla jagatud plokkideks.

Täisealise inimese puhul võib plokkide alus olla SKA juhendis toodud eluvaldkondade loogika:

- suhtlemine;

- vaimne tervis;

- füüsiline tervis;

- elukeskkond;

- hõivatus;

- vaba aeg ja huvitegevus;

- igapäevaelu toimingud;

- kõrvaline abi, abivahendid ja eluruumi kohandamine;

- inimese olulisemad vajadused.

Aga spetsialist ei pea neid läbima jäigas järjekorras. Platvorm võiks lubada valida:

- Alusta peamisest murest

- Täpsusta igapäevaelu toiminguid

- Täpsusta füüsilist tervist ja liikumist

- Täpsusta elukeskkonda

- Täpsusta olemasolevat abi

- Kirjelda inimese enda soovi

See sobib juhendi põhimõttega, et struktuur toetab vestlust, mitte ei muuda inimest küsitluse objektiks.

9.7. AI roll juhendatud eelkaardistuses

AI roll ei ole otsustada, mida inimene vajab. AI roll on toetada vestluse ja kirjaliku kokkuvõtte kvaliteeti.

AI võib aidata:

- sõnastada inimese vastuse neutraalselt;

- jagada vastuse õige eluvaldkonna alla;

- märgata, et mõni oluline info on puudu;

- pakkuda spetsialistile täpsustavaid küsimusi;

- koostada vestluse põhjal eelkokkuvõtte;

- muuta kokkuvõtte lihtsas keeles inimesele arusaadavaks;

- märkida, et info vajab spetsialisti kinnitust.

AI ei tohi:

- teha ametlikku hindamistulemust;

- määrata RFK raskusastmeid lõplikult;

- otsustada teenuse vajadust;

- asendada spetsialisti vestlust;

- saata kokkuvõtet ilma inimese või spetsialisti kinnitamiseta.

9.8. Inimese kinnitamine

Juhendatud eelkaardistuse lõpus peaks alati tekkima ülevaadatav kokkuvõte.

Kasutajale kuvatakse:

“Palun vaata üle, kas see kokkuvõte kirjeldab sinu olukorda õigesti.”

Kasutaja saab:

- kinnitada;

- parandada;

- lisada;

- eemaldada;

- märkida, et ei soovi seda osa jagada.

Kui kokkuvõtte koostas spetsialist vestluse põhjal, siis võiks olla ka spetsialisti kinnitus:

“Spetsialist kinnitab, et see on kohtumise/vestluse tööversiooni kokkuvõte.”

9.9. Privaatsus ja nõusolek

Juhendatud eelkaardistuses on privaatsus eriti oluline, sest suhtlus võib sisaldada tundlikku infot.

Põhireeglid:

1. Privaatset assistendivestlust ei jagata automaatselt.

1. Eelkaardistuse jagatav kokkuvõte luuakse eraldi.

1. Inimene näeb, mida jagatakse.

1. Vestlusruumis näevad infot ainult ruumi liikmed.

1. Helikõne ei salvestu vaikimisi.

1. Transkriptsioon ja AI kokkuvõte vajavad eraldi nõusolekut.

1. Spetsialist näeb ainult talle saadetud või ruumis jagatud infot.

1. Kovisiooni või praktikanäidete jaoks tuleb info anonümiseerida ja eraldi üle vaadata.

9.10. Seos eelpöördumisega

Juhendatud eelkaardistus on eelpöördumise üks vastusevariant.

Eelpöördumises saab inimene valida:

“Jah, soovin pöörduda, aga soovin küsimustiku täita koos spetsialistiga.”

Selle tulemusena saadetakse vastuvõtjale mitte pikk vorm, vaid lühike pöördumine:

- peamine mure;

- soov juhendatud eelkaardistuseks;

- eelistatud suhtlusviis;

- valitud kontakt;

- kasutaja kinnitatud eelinfo.

9.11. Seos vestlusruumiga

Vestlusruum muutub juhendatud eelkaardistuse tööruumiks.

Seal võiks olla eraldi paneel:

Koostäidetav eelkaardistus

Selles paneelis on:

- eluvaldkondade loend;

- vastamata plokid;

- täidetud plokid;

- kommentaarid;

- kokkuvõtte mustand;

- kokkulepped;

- järgmised sammud.

Vestlusruumi tekstivestlus ja küsimustik ei pea olema sama asi. Vestlus on suhtlus; eelkaardistus on struktureeritud töökaart.

9.12. Seos teenusekatkemise kontrolliga

Kui juhendatud eelkaardistuse põhjus on teenuse katkemine, peaks süsteem lisama eraldi ploki:

Teenuse jätkumine

Küsitakse:

- mis teenus on lõppemas;

- millal lõpeb;

- kes teenust osutab;

- kas otsus või teenuseplaan on olemas;

- kas KOV on kaasatud;

- kas inimene vajab kiiret kontakti;

- kas teenuseta jäämisel tekib oluline toimetulekurisk.

See võib olla juhendatud eelkaardistuse esimene plokk, mitte lõpus.

9.13. Seos teenuseosutajaga

Teenuseosutaja puhul on juhendatud eelkaardistus piiratum kui KOV spetsialisti puhul.

Teenuseosutaja võib aidata täpsustada:

- kas teenus sobib;

- kas teenusele jõudmiseks on vaja suunamist või otsust;

- millised dokumendid on vajalikud;

- kas saab pakkuda kohtumist või eelvestlust;

- kas teenus on praegu kättesaadav.

Teenuseosutaja ei tohiks saada kogu laia abivajaduse eelkaardistust, kui see pole vajalik. Teenuseosutajale jagatav eelinfo peaks olema kitsam ja teenusega seotud.

9.14. Andmemudel

Juhendatud eelkaardistus võiks olla eraldi objekt, mis seostub eelpöördumise, teekonnakaardi ja vestlusruumiga.

{
"guidedMapping": {
"id": "gm_001",
"journeyId": "journey_001",
"preContactId": "pre_001",
"roomId": "room_001",
"status": "REQUESTED",
"mode": "WITH_SPECIALIST_IN_ROOM",
"preferredChannels": ["TEXT", "AUDIO_IF_AGREED", "IN_PERSON"],
"mappingTemplate": "ADULT_SUPPORT_NEEDS_SKALOGIC",
"officialAssessment": false,
"sections": [
{
"id": "daily_living",
"title": "Igapäevaelu toimingud",
"status": "NOT_STARTED",
"answers": [],
"specialistNotes": []
},
{
"id": "physical_health",
"title": "Füüsiline tervis ja liikumine",
"status": "IN_PROGRESS",
"answers": [],
"specialistNotes": []
}
],
"summaryStatus": "NOT_CREATED",
"userConfirmedSummary": false,
"specialistConfirmedSummary": false
}
}

Võimalikud olekud:

{
"status": "REQUESTED | ACCEPTED | IN_PROGRESS | SUMMARY_DRAFT | USER_REVIEW | CONFIRMED | CLOSED | CANCELLED"
}

9.15. Kasutajatekstid

Valiku juures

Soovin täita koos spetsialistiga
Vali see, kui sa ei soovi või ei saa küsimustikku üksi täita. Saad saata lühikese pöördumise ja paluda, et olukorda täpsustataks koos spetsialistiga vestlusruumis, helivestluses või kohtumisel.

Vastuvõtjale

Kasutaja soovib juhendatud eelkaardistust.
Kasutaja ei ole täitnud kogu küsimustikku iseseisvalt, vaid soovib olukorra läbi rääkida koos spetsialistiga. Tegemist on eelinfoga, mitte ametliku hindamisega.

Kokkuvõtte kinnitamisel

See kokkuvõte on koostatud eelkaardistuse põhjal. Palun vaata üle, kas see kirjeldab sinu olukorda õigesti. Saad enne jagamist teksti muuta või infot eemaldada.

Helivestluse juures

Helivestlust ei salvestata vaikimisi. Kui soovid vestlusest kokkuvõtet või transkriptsiooni, küsitakse selleks eraldi nõusolekut.

9.16. MVP

Esimeses versioonis ei pea juhendatud eelkaardistus olema suur ja keeruline.

MVP võiks sisaldada:

1. Eelpöördumises valik “Soovin täita koos spetsialistiga”.

1. Valik suhtlusviisiks:

  - vestlusruum;

  - helivestlus võimalusel;

  - kohapealne kohtumine.

1. Vastuvõtja vaates märge:

  - juhendatud eelkaardistuse soov;

  - peamine mure;

  - eelistatud suhtlusviis.

1. Vastuvõtja saab avada vestlusruumi.

1. Vestlusruumis on lihtne koostäidetava eelinfo paneel.

1. Lõpus saab koostada kinnitatava kokkuvõtte.

1. Kokkuvõte märgitakse selgelt eelinfoks, mitte ametlikuks hindamiseks.

9.17. Kokkuvõte

Juhendatud eelkaardistus on SotsiaalAI-s väga tugev funktsioon, sest see teeb platvormi ligipääsetavamaks ja professionaalsemaks.

See annab inimesele võimaluse mitte jääda pika vormi taha kinni. Ta saab öelda:

“Ma vajan abi, aga palun aidake mul olukord koos lahti mõtestada.”

Spetsialistile annab see võimaluse alustada parema eelinfoga, kuid säilitada oma professionaalne roll. AI ei tee ametlikku hindamist, vaid aitab vestlust, struktuuri ja kokkuvõtet toetada.

Kõige lühem sõnastus:

Juhendatud eelkaardistus on koostöös täidetav eelinfo spetsialistile. See aitab inimesel oma olukorda kirjeldada ka siis, kui ta ei saa või ei taha küsimustikku üksi täita.

# 10. Pöördumiste vastuvõtt uues mudelis

Pöördumiste vastuvõtt on sotsiaaltöö spetsialisti ja teenuseosutaja töövaade, kuhu jõuab kasutaja poolt kinnitatud eelpöördumine, eelinfo kaart või juhendatud eelkaardistuse soov.

Uues SotsiaalAI mudelis ei ole pöördumiste vastuvõtt lihtsalt “saabunud kirjade kast”. See on struktureeritud töölaud, mis aitab vastuvõtjal kiiresti aru saada:

- kes pöördub;

- mis põhjusel;

- millist abi või selgitust inimene soovib;

- kas info on lühike märguanne või põhjalikum eelkaardistus;

- kas kasutaja soovib ise edasi kirjutada või täita küsimustikku koos spetsialistiga;

- kas on teenusekatkemise või muu kiire tähelepanu vajadus;

- kas pöördumine kuulub vastuvõtja pädevusse;

- milline võiks olla järgmine tegevus.

Kõige lühemalt:

Pöördumiste vastuvõtt muudab kasutaja kinnitatud eelinfo spetsialisti või teenuseosutaja jaoks tööks sobivaks ülevaateks, ilma et SotsiaalAI teeks ametlikku hindamist või otsust.

10.1. Põhimõte

Pöördumiste vastuvõtu põhimõte on:

vastuvõtja näeb ainult seda infot, mille kasutaja on kinnitanud ja saatnud.

Ta ei näe:

- kogu privaatset assistendivestlust;

- teekonnakaardi kõiki sisemisi märkmeid;

- AI varasemaid mõttekäike;

- soovitatud kontakte, mida kasutaja ei valinud;

- dokumente, mida kasutaja ei jaganud;

- küsimustiku vastuseid, mida kasutaja ei kinnitanud.

Vastuvõtja näeb jagatavat eelinfo kaarti, mis võib olla koostatud teekonnakaardi, eelpöördumise, eelkaardistuse, dokumendi analüüsi või kasutaja vaba kirjelduse põhjal.

10.2. Mida vastuvõtja näeb?

Pöördumiste vastuvõtus võiks iga pöördumine avaneda struktureeritud vaates, mitte ainult ühe pika tekstina.

Pöördumise põhikaart

Näiteks:

Pöördumise tüüp: lühike eelpöördumine / põhjalik eelkaardistus / juhendatud eelkaardistuse soov / teenuse jätkumise pöördumine
Adressaat: KOV kontakt / teenuseosutaja / konkreetne spetsialist
Pöörduja roll: inimene ise / lähedane / esindaja
Peamine mure: kasutaja kinnitatud lühikokkuvõte
Inimese enda soov: mida inimene soovib saavutada või küsida
Seotud teemad: KOV teenused, igapäevane toimetulek, transport, teenuse jätkumine, tervisekontakt vms
Kaardistuse ulatus: lühike / lühem küsimustik / põhjalikum eelkaardistus
Täitmise viis: täitis ise / soovib täita koos spetsialistiga / soovib helivestlust / soovib kohtumist
Lisad: dokumendid, otsused, plaanid, failid
Puuduolev info: mida oleks vaja täpsustada
Riskimärgid: näiteks teenusekatkemise risk või ohusignaal
Soovitatud järgmine samm: võta vastu, küsi täpsustust, ava vestlusruum, paku kohtumist, suuna teise kontakti poole

10.3. Vastuvõtja rollid

Pöördumiste vastuvõtt ei ole kõigi kasutajarollide jaoks sama.

KOV spetsialist

KOV spetsialisti puhul on fookus:

- inimese olukorra esmase mõistmise toetamine;

- kas pöördumine puudutab KOV pädevust;

- kas võiks olla vaja abivajaduse hindamist;

- kas inimene soovib juhendatud eelkaardistust;

- kas on vaja kohtumist või lisadokumente;

- kas pöördumine tuleks suunata konkreetsele KOV spetsialistile või töövoogu.

KOV vaates peab olema selge, et SotsiaalAI eelinfo ei ole ametlik hindamine. SKA juhendi järgi on abivajaduse hindamine spetsialisti tööprotsess, mille eesmärk on välja selgitada, millistes eluvaldkondades inimene tuge vajab; hindamine ise ei määra teenust, vaid spetsialist teeb hindamistulemuste põhjal kaalutletud otsuse.

Teenuseosutaja

Teenuseosutaja puhul on fookus kitsam:

- kas pöördumine puudutab tema teenust;

- kas inimene kuulub teenuse sihtrühma;

- kas teenusele jõudmiseks on vaja KOV otsust, arsti suunamist või muud eeltingimust;

- kas teenuseosutaja saab anda tingimuste kohta infot;

- kas saab pakkuda eelvestlust, kohtumist või vestlusruumi;

- kas pöördumine tuleb suunata tagasi KOV-i või teise osapoole poole.

Teenuseosutaja ei peaks automaatselt nägema kogu laia eluvaldkondade eelkaardistust, kui seda ei ole tema teenuse jaoks vaja. Tema vaates tuleks kuvada pigem teenusega seotud eelinfo.

Tervisekontakt

Kui tulevikus lisada tervisekontakti küsimuse mustand, siis vastuvõtt ei peaks seal olema sama tähendusega nagu KOV-is. Pigem on see:

- küsimuste koostamise ja e-kirja/mustandi loogika;

- mitte SotsiaalAI-sisene menetlus;

- mitte terviseportaali või ravitöövoo asendus.

10.4. Pöördumise tüübid vastuvõtus

Pöördumiste vastuvõtt peaks eristama pöördumise tüüpi, sest eri tüübid vajavad eri reaktsiooni.

| Tüüp | Mida see tähendab | Vastuvõtja võimalik tegevus |
| --- | --- | --- |
| Lühike märguanne | inimene annab endast märku, infot on vähe | küsi täpsustust, paku vestlusruumi või kohtumist |
| Lühike eelpöördumine | inimene kirjeldab põhimure ja soovi | vasta, küsi lisainfot, võta vastu |
| Lühem küsimustik | inimene on andnud rohkem eelinfot | vaata teemad üle, otsusta järgmine kontakt |
| Põhjalik eelkaardistus | info on eluvaldkondade kaupa struktureeritud | kasuta vestluse või hindamise ettevalmistuseks |
| Juhendatud eelkaardistuse soov | inimene ei soovi/ei saa üksi täita | paku koostäitmist vestlusruumis, helis või kohtumisel |
| Teenuse jätkumise pöördumine | teenus võib lõppeda või katkeda | kontrolli kiireloomulisust, küsi dokumente, paku järgmine samm |
| Teenuse tingimuste küsimus | pöördumine teenuseosutajale | selgita ligipääsutingimusi või suuna õigele otsustajale |
| Dokumendist lähtuv pöördumine | inimene lisas otsuse/plaani/kirja | vaata dokumendi kokkuvõtet ja täpsustusküsimusi |

10.5. Vastuvõtja tegevused

Vastuvõtjal võiks olla kindel tegevuste komplekt.

Põhitegevused

- Võta vastu

- Küsi lisainfot

- Ava vestlusruum

- Paku kohtumist

- Koosta vastuse mustand

- Märgi, et pöördumine ei kuulu minu pädevusse

- Soovita teist kontakti

- Sulge pöördumine

- Lisa märkus / sisemine töömemo

KOV spetsialisti lisategevused

- Märgi “vajab ametlikku hindamist”

- Märgi “vajab kohtumist”

- Märgi “vajab dokumendi lisamist”

- Koosta inimesele lihtsas keeles selgitus

- Koosta juhtumikokkuvõtte mustand

- Lisa KOV-sisene töökommentaar, kui selline funktsioon on hiljem vajalik

Teenuseosutaja lisategevused

- Selgita teenuse tingimusi

- Märgi “vajab KOV otsust/suunamist”

- Märgi “teenus ei sobi”

- Paku eelvestlust

- Paku teenuseprofiili linki

- Soovita pöörduda KOV-i poole

10.6. Olekud pöördumiste vastuvõtus

Pöördumisel peaks olema eraldi vastuvõtu olek.

| Olek | Tähendus |
| --- | --- |
| Saabunud | kasutaja on pöördumise saatnud |
| Avatud | vastuvõtja on pöördumise avanud |
| Vastuvõetud | vastuvõtja märgib, et tegeleb pöördumisega |
| Lisainfo ootel | vastuvõtja küsis täpsustust |
| Vestlusruum pakutud | vastuvõtja soovib jätkata ruumis |
| Vestlusruum avatud | kasutaja ja vastuvõtja suhtlevad ruumis |
| Kohtumine pakutud | vastuvõtja soovitab kohtumist |
| Mitteasjakohane | vastuvõtja märgib, et pöördumine ei kuulu tema rolli |
| Edasi suunatud | soovitatud on teine kontakt või kanal |
| Lõpetatud | töövoog on selles vastuvõtus lõppenud |

Kasutajale ei peaks tingimata näitama kõiki sisemisi staatuseid. Pöördujale piisab lihtsamatest:

- saadetud;

- avatud;

- vastus ootel;

- lisainfot küsitud;

- vestlusruum pakutud;

- lõpetatud.

10.7. Vastuvõtja ei “menetle” alati

Sõnaga tuleb olla ettevaatlik. Kui tegu ei ole ametliku KOV menetlusega, ei tohiks kasutajaliides öelda automaatselt “menetluses”.

Paremad üldised sõnad:

- vastuvõtus

- ülevaatamisel

- täpsustamisel

- vastus ootel

- järgmine samm kokku leppimisel

KOV-i puhul võib “menetlus” olla asjakohane ainult siis, kui see on päriselt KOV ametlik tööprotsessis nii käsitletud.

10.8. Juhendatud eelkaardistuse vastuvõtt

Kui kasutaja on valinud “soovin täita koos spetsialistiga”, siis vastuvõtja vaates võiks see olla kohe eraldi märgisega.

Näiteks:

Märge: kasutaja soovib juhendatud eelkaardistust
Soovitud viis: vestlusruum / helivestlus / kohapealne kohtumine
Küsimustiku ulatus: lühem küsimustik / põhjalik eelkaardistus / täpsustamisel
Peamine mure: kasutaja lühikirjeldus

Vastuvõtja tegevused:

- Paku vestlusruumi

- Paku kohtumisaega

- Küsi enne lisainfot

- Märgi, et see ei ole sobiv kanal

- Soovita teist kontakti

Kui vastuvõtja avab vestlusruumi, siis sinna võib tekkida koostäidetav eelinfo paneel.

10.9. Teenusekatkemise pöördumise vastuvõtt

Teenusekatkemise risk peaks vastuvõtus olema nähtav, sest see võib vajada kiiremat tähelepanu.

Näide kaart:

Riskimärge: võimalik teenusekatkemine
Mis teenus: kasutaja kirjeldatud teenus
Lõppemise aeg: teada / teadmata
Praegune teenuseosutaja: teada / teadmata
Varasem otsus/plaan: lisatud / lisamata
KOV kaasatus: teada / teadmata
Soovitatud tegevus: küsida teenuse lõppkuupäev, paluda dokumenti, avada vestlusruum või anda juhis

See ei tähenda, et AI otsustab kiireloomulisuse lõplikult. Aga ta aitab vastuvõtjal märgata, et pöördumine ei ole tavaline üldküsimus.

10.10. Vastuvõtja vaate andmejaotus

Vastuvõtja vaade võiks olla jaotatud kaartideks.

1. Kiirülevaade

- pöördumise tüüp;

- saatja roll;

- peamine mure;

- soovitud järgmine samm;

- eelistatud suhtlusviis;

- riskimärgid.

2. Eelinfo

- olukorra kokkuvõte;

- inimese enda soov;

- seotud eluvaldkonnad;

- puuduolev info;

- varasem abi;

- olemasolevad teenused/toed;

- olulised dokumendid.

3. Lisadokumendid

- failid;

- dokumendi analüüsi kokkuvõte;

- tähtajad;

- otsused või teenuseplaanid.

4. Tegevused

- võta vastu;

- küsi lisainfot;

- vasta;

- ava ruum;

- paku kohtumist;

- märgi mitteasjakohaseks.

5. Allikad ja selgitused

Kui pöördumine viitab teenusele, võiks vastuvõtja näha:

- teenusekaardi kirjet;

- teenuseni jõudmise loogikat;

- allikat;

- viimati kontrollitud infot.

10.11. AI roll vastuvõtja vaates

AI võib vastuvõtjat aidata, aga ei tohi tema eest otsustada.

AI võib pakkuda:

- pöördumise lühikokkuvõtet;

- puuduoleva info loendit;

- viisakat vastuse mustandit;

- küsimusi täpsustamiseks;

- inimesele lihtsas keeles selgitust;

- memo mustandit;

- teenuseni jõudmise üldloogika selgitust;

- allikate leidmist teadmuspõhjast.

AI ei tohi:

- märkida ametlikult, et teenus tuleb määrata;

- anda lõplikku hindamistulemust;

- otsustada, kas inimene vastab teenuse tingimustele;

- teha KOV või teenuseosutaja nimel otsust;

- saata vastust ilma spetsialisti kinnitamiseta.

Spetsialisti vaates võiks vastuse mustandi juures olla märge:

Tegemist on töömustandiga. Enne kasutamist kontrolli sisu, allikaid ja sobivust inimese olukorraga.

10.12. Pöördumise vastuvõtu ja ametliku hindamise piir

Väga oluline piir:

Pöördumiste vastuvõtt ei ole automaatselt ametlik abivajaduse hindamine.

See on eelinfo vastuvõtt.

KOV võib selle põhjal otsustada, et:

- on vaja ametlikku hindamist;

- tuleb võtta inimesega ühendust;

- tuleb paluda dokumente;

- pöördumine ei kuulu KOV pädevusse;

- inimene tuleb suunata teise kontakti poole;

- tuleb alustada KOV töökorra järgi menetlust või nõustamist.

Platvormi tekst spetsialistile:

See eelinfo ei asenda ametlikku hindamist. Kasuta seda vestluse ettevalmistamiseks ja otsusta edasine tegevus oma asutuse töökorra järgi.

10.13. Teenuseosutaja ja KOV erinev vastuvõtuloogika

Teenuseosutaja vaade peab olema kitsam kui KOV vaade.

KOV võib vajada laiemat pilti

KOV võib vajada infot:

- toimetulekust;

- elukeskkonnast;

- hoolduskoormusest;

- varasemast abist;

- sotsiaalsest võrgustikust;

- inimese enda soovidest;

- võimalikust teenuse vajadusest.

Teenuseosutaja vajab teenusega seotud infot

Teenuseosutaja ei pea nägema kogu taustalugu, kui see pole vajalik.

Näiteks teenuseosutajale piisab sageli:

- millise teenuse kohta küsitakse;

- piirkond;

- sihtrühm;

- kas on olemas otsus või suunamine;

- mida inimene soovib täpsustada;

- millist suhtlusviisi eelistab.

Seega süsteem peaks võimaldama adressaadipõhist eelinfo kärpimist.

10.14. Privaatsus ja audit

Pöördumiste vastuvõtt on tundlik töövoog.

Vajalikud reeglid:

1. Vastuvõtja näeb ainult talle saadetud infot.

1. Privaatset assistendivestlust ei kuvata.

1. Iga avamine ja staatuse muutmine võiks olla logitav.

1. Failide avamine võiks olla logitav.

1. Vestlusruumi loomine ja liikmete lisamine peab olema kontrollitud.

1. Sisemised märkmed ei pruugi olla kasutajale nähtavad, kui need on asutuse töökorra osa, aga see peab olema andmekaitseliselt läbi mõeldud.

1. Kustutamise ja säilitamise loogika peab olema selge.

10.15. Kasutajale nähtav seis

Kasutaja peaks nägema lihtsat staatust.

Näiteks:

Pöördumine saadetud
Vastuvõtja näeb sinu kinnitatud eelinfot.

Pöördumine avatud
Vastuvõtja on pöördumise avanud.

Lisainfo ootel
Vastuvõtja küsis täpsustust.

Vestlusruum pakutud
Vastuvõtja soovib jätkata vestlusruumis.

Lõpetatud
See pöördumine on selles töövoos lõpetatud.

Kui staatust ei saa jälgida, näiteks kiri avati kasutaja e-postis väliseks saatmiseks, tuleb öelda:

Kui saadad kirja väljaspool SotsiaalAI-d, ei pruugi platvorm näidata vastuvõtmise või avamise staatust.

10.16. Andmemudel

Pöördumise vastuvõtu objekt võiks seostuda eelpöördumise, adressaadi, kasutaja ja teekonnaga.

{
"intake": {
"id": "intake_001",
"preContactId": "pre_001",
"journeyId": "journey_001",
"senderUserId": "user_001",
"recipientType": "KOV_CONTACT",
"recipientId": "party_001",
"status": "RECEIVED",
"intakeType": "GUIDED_MAPPING_REQUEST",
"summary": "Kasutaja soovib olukorda täpsustada koos spetsialistiga.",
"userGoal": "Soovin aru saada, millist abi võiks küsida.",
"preferredCommunication": ["ROOM", "AUDIO_IF_AGREED"],
"riskSignals": ["SERVICE_CONTINUITY_RISK"],
"missingInfo": ["serviceEndDate", "existingDecisionOrPlan"],
"attachments": [],
"recipientActions": [
"ACCEPT",
"REQUEST_MORE_INFO",
"OPEN_ROOM",
"PROPOSE_MEETING",
"MARK_NOT_RELEVANT"
],
"createdAt": "2026-05-25T12:00:00Z",
"openedAt": null,
"closedAt": null
}
}

Vastuvõtja tegevuse mudel:

{
"intakeAction": {
"id": "action_001",
"intakeId": "intake_001",
"actorUserId": "specialist_001",
"type": "REQUEST_MORE_INFO",
"message": "Palun lisage, millal praegune teenus lõpeb.",
"createdAt": "2026-05-25T12:30:00Z"
}
}

10.17. Kasutajatekstid

Vastuvõtja vaate päises

See on kasutaja kinnitatud eelinfo. Tegemist ei ole ametliku hindamisega. Kasuta seda vestluse või edasise töö ettevalmistamiseks ning otsusta järgmine samm oma asutuse töökorra järgi.

Juhendatud eelkaardistuse soovi puhul

Kasutaja soovib küsimustiku või olukorra täpsustamist koos spetsialistiga. Ta ei ole kogu vormi iseseisvalt täitnud.

Teenuseosutaja vaates

See pöördumine puudutab teie teenust või teenuse tingimuste täpsustamist. Kui teenus vajab KOV-i, arsti või muu osapoole otsust või suunamist, palun selgitage seda kasutajale.

Kasutajale pärast saatmist

Pöördumine on saadetud. Vastuvõtja näeb ainult sinu kinnitatud eelinfot. Privaatset assistendivestlust ei jagatud.

10.18. MVP

Esimeses versioonis piisab järgmisest.

Vastuvõtja näeb

- pöördumise tüüpi;

- peamist muret;

- kasutaja soovi;

- kaardistuse taset;

- täitmise viisi;

- eelistatud suhtlusviisi;

- lisatud dokumente;

- riskimärget, kui olemas;

- puuduolevat infot.

Vastuvõtja saab teha

- võta vastu;

- küsi lisainfot;

- ava vestlusruum;

- paku kohtumist;

- märgi mitteasjakohaseks;

- sulge.

Süsteem tagab

- privaatset vestlust ei kuvata;

- saadetud eelinfo on kasutaja kinnitatud;

- staatuse muutused salvestuvad;

- vestlusruum tekib ainult kinnitatud tegevusega.

10.19. Kokkuvõte

Pöördumiste vastuvõtt uues SotsiaalAI mudelis ei ole lihtsalt saabunud sõnumite vaade.

See on struktureeritud eelinfo töölaud, kus KOV spetsialist või teenuseosutaja näeb kasutaja kinnitatud infot, saab aru pöördumise tüübist ja saab valida järgmise tööalase tegevuse.

Kõige olulisemad põhimõtted:

- vastuvõtja näeb ainult kinnitatud eelinfot;

- SotsiaalAI ei tee ametlikku hindamist ega otsust;

- KOV ja teenuseosutaja vaated peavad erinema;

- juhendatud eelkaardistus peab olema selgelt märgitud;

- teenusekatkemise risk peab olema nähtav;

- AI võib koostada töömustandeid, aga spetsialist kinnitab ja vastutab lõpliku sisu eest.

Kõige lühem sõnastus:

Pöördumiste vastuvõtt aitab spetsialistil või teenuseosutajal alustada mitte nullist, vaid kasutaja kinnitatud ja struktureeritud eelinfost.

# 11. Vestlusruum kui koostööruum

Vestlusruum ei peaks SotsiaalAI uues mudelis olema ainult eraldi “kutsu inimene vestlusesse” funktsioon ega lihtsalt chat. See peaks olema ühine koostööruum, mida saab avada mitmest töövoost siis, kui privaatne teekond vajab edasi liikumiseks jagatud suhtlust.

Kõige olulisem põhimõte:

Vestlusruum on üks ja sama ruumisüsteem, aga selle käivitaja võib olla erinev: käsitsi kutse, eelpöördumine, pöördumise vastuvõtt, teekonnakaart, juhendatud eelkaardistus või abisoovi ja abipakkumise match.

11.1. Põhimõte

SotsiaalAI-s on kaks eri vestlusloogikat.

Privaatne assistendivestlus
See on kasutaja ja AI vaheline privaatne ruum. Siin kirjeldab kasutaja olukorda, saab esmase teekonnasõela ja teekonnakaardi. Seda vestlust ei jagata automaatselt kellelegi.

Vestlusruum / koostööruum
See on jagatud ruum valitud osapooltega: pöörduja, spetsialist, teenuseosutaja, lähedane, abistaja või muu kutsutud inimene. Ruumis saab täpsustada olukorda, jagada dokumente, teha kokkuleppeid, täita eelkaardistust koos ja vajadusel teha helivestlust.

Põhireegel:

Vestlusruumi jõuab ainult see info, mille kasutaja on kinnitanud või mida ruumis hiljem teadlikult jagatakse. Privaatset assistendivestlust ei kopeerita ruumi automaatselt.

11.2. Milleks vestlusruum vajalik on?

Vestlusruum lahendab olukorrad, kus üksik eelpöördumine või vorm ei ole piisav.

Näiteks:

- inimene ei oska küsimustikku üksi täita;

- spetsialist vajab lisainfot;

- teenuseosutaja soovib teenuse tingimusi täpsustada;

- kasutaja soovib enne ametlikku kohtumist olukorda läbi rääkida;

- teenus võib katkeda ja vaja on kiiresti selgust;

- inimene soovib kaasata lähedase või abistaja;

- abisoov ja abipakkumine on sobitatud ning osapooled peavad edasi suhtlema;

- spetsialist soovib teha juhendatud eelkaardistust või koostada kokkuvõtte.

Seega vestlusruumi roll ei ole ainult “suhtlemine”, vaid:

jagatud töökoht olukorra täpsustamiseks ja järgmiste sammude kokkuleppimiseks.

11.3. Vestlusruumi käivitamise viisid

Vestlusruum peaks olema käivitatav viiest-kuuest kohast.

1. Eraldi kutse lehelt

See funktsioon jääb alles.

Kasutaja saab käsitsi kutsuda inimese vestlusruumi:

- lähedase;

- abistaja;

- spetsialisti;

- teenuseosutaja;

- kolleegi;

- muu inimese, kellega on vaja ühist ruumi.

See on üldine ja paindlik ruumi loomise tee.

Siin sobib alles hoida ka olemasolev võimalus:

kutsuja saab soovi korral tasuda kutsutu ühe kuu rollipõhise ligipääsu eest.

See on eriti sobiv eraisikute, lähedaste, abistajate või pöördujate kutsumisel.

2. Abisoovi ja abipakkumise matchist

Kui abisoov ja abipakkumine sobitatakse, võib tekkida ühine vestlusruum.

See ruum on eraldi tüüpi:

abisoovi / abipakkumise matchi ruum

Selle eesmärk on aidata osapooltel kokku leppida:

- abi täpsem sisu;

- aeg;

- koht;

- piirid;

- suhtlusviis;

- järgmised sammud.

See jääb eraldi kogukondliku abi loogikaks ega pea segunema KOV teenuse või eelpöördumise töövooga.

3. Teekonnakaardilt

Kui kasutaja on teekonnakaardil valinud osapoole, näiteks KOV kontakti või teenuseosutaja, võib süsteem pakkuda võimalust:

“Soovin selle osapoolega vestlusruumis edasi suhelda.”

Aga siin ei tohiks ruum alati kohe automaatselt avaneda. Turvalisem loogika on:

1. kasutaja valib osapoole;

1. kasutaja koostab eelpöördumise või lühikese kutse;

1. osapool saab kutse või pöördumise;

1. ruum avaneb siis, kui osapool nõustub või kui töövoog seda lubab;

1. kasutaja näeb, milline info ruumi jagatakse.

Seega teekonnakaardil võiks sõnastus olla pigem:

“Paku vestlusruumi”
või
“Soovin jätkata selle osapoolega ruumis”

mitte kohe:

“Ava ruum”, kui osapool pole veel kaasatud.

4. Eelpöördumise kaudu

See on üks olulisemaid käivitajaid.

Eelpöördumises võiks kasutaja valida:

- soovin kirjalikku vastust;

- soovin vajadusel vestlusruumi;

- soovin küsimustiku täita koos spetsialistiga;

- soovin võimalusel helivestlust;

- soovin kohtumist kohapeal.

Kui kasutaja valib:

“Soovin täita koos spetsialistiga”

siis vestlusruum on loomulik järgmine samm.

Sellisel juhul ei ole vestlusruum suvaline chat, vaid juhendatud eelkaardistuse tööruum.

5. Pöördumiste vastuvõtust

Kui spetsialist või teenuseosutaja saab eelpöördumise, võiks ta vastuvõtuvaates valida:

- Paku vestlusruumi

- Ava vestlusruum

- Küsi lisainfot ruumis

- Alusta juhendatud eelkaardistust

- Paku helivestlust

- Paku kohtumist

Siin tekib ruum vastuvõtja algatusel, kuid kasutaja peab nägema, et suhtlus liigub jagatud ruumi.

Kasutajale võiks tulla teade:

Spetsialist soovib jätkata vestlusruumis. Ruumi liikmed näevad ainult sinu kinnitatud eelinfot ja ruumis jagatud sõnumeid või faile.

6. Juhendatud eelkaardistuse soovist

Kui inimene märgib eelpöördumises:

“Ma ei soovi või ei saa küsimustikku üksi täita”

siis süsteem võib luua või pakkuda koostööruumi, kus spetsialist aitab olukorda täpsustada.

Selles ruumis võiks olla eraldi paneel:

Koostäidetav eelkaardistus

See ei ole ametlik hindamine, vaid spetsialistile ja kasutajale ühine eelinfo koostamise koht.

11.4. Üks ruumisüsteem, mitu käivitajat

Oluline arhitektuurne otsus:

ei tohiks teha mitut eraldi vestlusruumi süsteemi.

Parem on üks Room süsteem, millel on erinev päritolu või tüüp.

Näiteks:

{
"roomType": "MANUAL_INVITE | PRECONTACT | GUIDED_MAPPING | HELP_MATCH | SERVICE_INTAKE | COVISION",
"sourceId": "pre_001",
"createdFrom": "INTAKE",
"journeyId": "journey_001"
}

Tähendused:

- MANUAL_INVITE — loodud eraldi kutse lehelt;

- PRECONTACT — seotud eelpöördumisega;

- GUIDED_MAPPING — juhendatud eelkaardistuse ruum;

- HELP_MATCH — abisoovi ja abipakkumise matchi ruum;

- SERVICE_INTAKE — pöördumiste vastuvõtust algatatud ruum;

- COVISION — spetsialistide kovisiooniruum.

Nii saab olemasolevat ruumiloogikat laiendada ilma dubleerimiseta.

11.5. Kutse ja kuutasu loogika

Olemasolev kutse leht ja sponsoreeritud ligipääsu võimalus on väärtuslik ning seda ei peaks eemaldama.

Aga seda tuleb rolliti sõnastada ettevaatlikult.

Sobib hästi

Kutsuja saab tasuda kutsutu ühe kuu ligipääsu eest näiteks siis, kui kutsub:

- lähedase;

- abistaja;

- pereliikme;

- pöörduja;

- kogukondliku abipakkuja;

- muu eraisiku.

Näide:

Kutsu inimene ruumi ja soovi korral tasu tema esimese kuu ligipääsu eest.

Ettevaatlik spetsialistide ja teenuseosutajate puhul

KOV spetsialisti, ametliku spetsialisti või teenuseosutaja puhul võib kõlada sobimatult, kui inimene peab nende eest kuutasu maksma.

Nende puhul oleks parem loogika:

- spetsialistil on oma rollipõhine konto;

- teenuseosutajal on oma teenuseosutaja pakett;

- organisatsioon haldab ligipääsu;

- või kasutatakse piiratud vastuvõtuvaadet.

Seega:

Sponsoreeritud ligipääs jääb kutsemehhanismi osaks, aga ametlike spetsialistide ja teenuseosutajate puhul on põhiline ligipääs rollipõhine või organisatsioonipõhine.

11.6. Vestlusruumi põhifunktsioonid

Vestlusruumis võiks olla mitu osa.

1. Tekstivestlus

Tavaline sõnumivahetus osapoolte vahel.

Sobib:

- lisainfo küsimiseks;

- olukorra täpsustamiseks;

- vastuste andmiseks;

- kontaktide vahetamiseks;

- kokkulepete tegemiseks.

2. Eelinfo / eelpöördumise kaart

Kui ruum tekib eelpöördumisest, peaks ruumis olema nähtav:

- kasutaja kinnitatud eelinfo;

- peamine mure;

- kasutaja soov;

- eelistatud suhtlusviis;

- lisatud dokumendid;

- puuduolev info;

- teenusekatkemise risk, kui olemas.

Oluline: ruumi ei kuvata kogu privaatset assistendivestlust.

3. Koostäidetav eelkaardistus

Kui ruum on juhendatud eelkaardistuseks, võiks seal olla eraldi tööpaneel.

Paneelis saab täita või täpsustada:

- eluvaldkondi;

- kasutaja enda soovi;

- olemasolevat abi;

- puuduolevat infot;

- teenuse jätkumise infot;

- dokumente;

- järgmisi samme.

See on eelinfo, mitte ametlik hindamine.

4. Dokumendid

Ruumis saab jagada dokumente, näiteks:

- KOV otsus;

- teenuseplaan;

- rehabilitatsiooniplaan;

- teenuseosutaja kiri;

- arsti või haigla kokkuvõte;

- SotsiaalAI koostatud mustand.

Iga dokumendi juures peab olema selge:

- kes lisas;

- kellele nähtav;

- kas dokumenti analüüsiti;

- kas analüüsi kokkuvõte lisati ruumi;

- kas dokument on seotud eelpöördumise või teekonnaga.

5. Kokkulepped ja järgmised sammud

Vestlusruumis võiks olla eraldi plokk:

Järgmised sammud

Näiteks:

| Samm | Vastutaja | Tähtaeg | Olek |
| --- | --- | --- | --- |
| Lisada varasem otsus | kasutaja | 28.05 | ootel |
| Täpsustada teenuse lõppkuupäev | spetsialist | 29.05 | töös |
| Leppida kokku kohtumine | KOV kontakt | 30.05 | ootel |

See muudab ruumi töövahendiks, mitte lihtsalt vestluseks.

6. Kokkuvõte või memo

Ruumis võiks saada koostada:

- inimesele lihtsas keeles kokkuvõtte;

- spetsialisti töömemori;

- järgmiste sammude kokkuvõtte;

- täiendatud eelpöördumise;

- kohtumise ettevalmistuse;

- dokumendimustandi.

AI võib aidata kokkuvõtet koostada, aga kasutaja või spetsialist peab selle kinnitama.

11.7. Helivestlus vestlusruumis

Vestlusruumis võib olla audio-only helikõne.

See on oluline ligipääsetavuse seisukohalt, sest kõik inimesed ei jaksa või ei oska pikalt kirjutada.

Põhireegel:

Helikõne ei salvestu vaikimisi.

Kui soovitakse salvestust, transkriptsiooni või AI kokkuvõtet, peab selleks olema eraldi nõusolek.

Töövoog:

1. osapooled alustavad helivestlust;

1. salvestamine on vaikimisi väljas;

1. transkriptsiooni või kokkuvõtte jaoks küsitakse eraldi nõusolek;

1. AI koostab kokkuvõtte ainult lubatud sisust;

1. kokkuvõte läheb ülevaatamisele;

1. kasutaja ja/või spetsialist kinnitab, kas kokkuvõte salvestatakse või jagatakse.

Kasutajatekst:

Helivestlust ei salvestata vaikimisi. Kui soovid vestlusest transkriptsiooni või kokkuvõtet, küsitakse selleks eraldi nõusolekut.

11.8. Kes võib vestlusruumis olla?

MVP-s piisab neist rollidest:

- pöörduja;

- KOV spetsialist;

- teenuseosutaja;

- lähedane või esindaja;

- kutsutud osapool.

Hiljem võib lisada:

- teine spetsialist;

- teenuseosutaja teine töötaja;

- kovisiooni kolleeg;

- tugiisik;

- muu koostööpartner.

Iga liikme juures peaks olema roll ja õigused:

{
"userId": "user_001",
"role": "CLIENT | KOV_SPECIALIST | SERVICE_PROVIDER | RELATIVE | INVITED_PARTY",
"permissions": [
"SEND_MESSAGE",
"UPLOAD_FILE",
"VIEW_SHARED_SUMMARY",
"REVIEW_SUMMARY"
]
}

11.9. Nähtavuse ja privaatsuse reeglid

Vestlusruumi keskne usaldusreegel:

osapooled näevad ainult ruumis jagatud infot ja kasutaja kinnitatud eelinfot.

Vestlusruumi ei tohi automaatselt lisada:

- kogu privaatset AI vestlust;

- AI sisemist teekonnasõela;

- soovitatud kontakte, mida kasutaja ei valinud;

- dokumente, mida kasutaja ei jaganud;

- eelkaardistuse osi, mida kasutaja ei kinnitanud;

- teekonnakaardi sisemisi märkmeid.

Vestlusruumi võib lisada:

- kinnitatud eelpöördumise;

- kinnitatud eelinfo kaardi;

- kasutaja jagatud dokumendid;

- ruumis kirjutatud sõnumid;

- nõusolekupõhise helikõne kokkuvõtte;

- kokkulepped ja järgmised sammud.

Kasutajatekst ruumi avamisel:

Vestlusruumi liikmed näevad ainult siin jagatud infot ja kinnitatud eelinfot. Sinu privaatset vestlust assistendiga ei jagata.

11.10. Vestlusruum KOV spetsialisti vaates

KOV spetsialisti jaoks võib vestlusruum olla koht, kus:

- küsida lisainfot;

- täpsustada eelpöördumist;

- paluda dokumente;

- teha juhendatud eelkaardistust;

- valmistuda kohtumiseks;

- selgitada järgmist ametlikku sammu;

- koostada kokkuvõtte või töömustandi.

KOV vaates võiksid tegevused olla:

- Küsi lisainfot

- Alusta koostäidetavat eelkaardistust

- Lisa kokkulepe

- Koosta kokkuvõte

- Koosta vastuse mustand

- Paku kohtumist

- Märgi järgmine samm

Oluline tekst:

Vestlusruumis kogutud info võib toetada edasist tööd, kuid ametlik hindamine ja otsus tehakse spetsialisti töökorra järgi.

11.11. Vestlusruum teenuseosutaja vaates

Teenuseosutaja ruum peaks olema kitsam kui KOV spetsialisti ruum.

Teenuseosutaja saab:

- täpsustada, kas tema teenus sobib;

- selgitada teenuse tingimusi;

- öelda, kas vaja on KOV otsust või suunamist;

- küsida teenusega seotud lisainfot;

- pakkuda eelvestlust;

- anda järgmise kontakti või juhise;

- märkida, kui pöördumine ei kuulu tema teenuse alla.

Teenuseosutaja ei peaks automaatselt nägema kogu laia abivajaduse eelkaardistust, kui see ei ole teenuse jaoks vajalik.

11.12. AI roll vestlusruumis

AI võib vestlusruumis olla abikiht, aga mitte otsustaja.

AI võib aidata:

- teha vestluse kokkuvõtte;

- koostada küsimuste mustandi;

- sõnastada inimese vastused neutraalselt;

- märkida puuduva info;

- koostada lihtsas keeles selgituse;

- koostada spetsialistile memo mustandi;

- seostada info teenusekaardi või teadmuspõhja allikatega;

- aidata dokumendi sisu kokku võtta.

AI ei tohi:

- teha ametlikku hindamist;

- määrata teenust;

- otsustada inimese abivajaduse üle;

- rääkida spetsialisti nimel;

- saata vastust ilma kinnitamiseta;

- jagada privaatset assistendivestlust ruumi.

11.13. Vestlusruumi olekud

Vestlusruumil võiks olla oma olekud.

| Olek | Tähendus |
| --- | --- |
| Kutse saadetud | osapoolele on saadetud kutse |
| Avatud | ruum on loodud ja osapooled saavad suhelda |
| Eelkaardistus pooleli | ruumis täidetakse eelinfot |
| Lisainfo ootel | üks osapool peab infot lisama |
| Kokkuvõte koostamisel | AI või spetsialist koostab kokkuvõtte mustandit |
| Kokkuvõte kinnitamisel | kasutaja/spetsialist vaatab kokkuvõtet üle |
| Järgmised sammud kokku lepitud | tegevused on kirjas |
| Suletud | ruum lõpetati |
| Arhiveeritud | ruum ei ole enam aktiivne |

11.14. Andmemudel

Lihtsustatud ruumi mudel:

{
"room": {
"id": "room_001",
"journeyId": "journey_001",
"sourceId": "pre_001",
"roomType": "PRECONTACT",
"createdFrom": "INTAKE",
"status": "OPEN",
"createdBy": "user_001",
"participants": [
{
"userId": "user_001",
"role": "CLIENT",
"permissions": ["SEND_MESSAGE", "UPLOAD_FILE", "REVIEW_SUMMARY"]
},
{
"userId": "specialist_001",
"role": "KOV_SPECIALIST",
"permissions": ["SEND_MESSAGE", "REQUEST_INFO", "CREATE_SUMMARY"]
}
],
"sharedItems": [
{
"type": "PRE_CONTACT_SUMMARY",
"id": "pre_001",
"visibility": "ROOM_SHARED"
}
],
"audio": {
"enabled": true,
"recordingDefault": false,
"transcriptionRequiresConsent": true
},
"sponsorAccess": {
"offered": false,
"used": false,
"sponsoredUserId": null
}
}
}

Koostäidetava eelkaardistuse mudel:

{
"collaborativeMapping": {
"id": "cm_001",
"roomId": "room_001",
"template": "ADULT_SUPPORT_NEEDS_LOGIC",
"officialAssessment": false,
"sections": [
{
"id": "daily_living",
"title": "Igapäevaelu toimingud",
"status": "IN_PROGRESS",
"answers": [],
"notes": []
}
],
"summaryStatus": "DRAFT",
"userConfirmed": false,
"specialistConfirmed": false
}
}

11.15. Privaatsus ja audit

Vestlusruumis peavad olema tugevad kontrollid.

Reeglid:

1. Ruum tekib ainult kinnitatud tegevusega.

1. Osapool näeb ainult ruumis jagatud infot.

1. Uue liikme lisamisel tuleb näidata, mida ta nägema hakkab.

1. Failide jagamine peab olema teadlik tegevus.

1. Privaatset assistendivestlust ei jagata automaatselt.

1. Helikõne ei salvestu vaikimisi.

1. Transkriptsioon vajab eraldi nõusolekut.

1. Kokkuvõte tuleb enne salvestamist või jagamist kinnitada.

1. Olulised tegevused logitakse: ruumi loomine, liikme lisamine, faili jagamine, kokkuvõtte kinnitamine, transkriptsiooni lubamine.

11.16. Kasutajatekstid

Ruumi loomisel

Vestlusruum on jagatud suhtluskoht sinu ja valitud osapoolte vahel. Ruumi liikmed näevad ainult siin jagatud infot ja kinnitatud eelinfot. Privaatset assistendivestlust ei jagata.

Käsitsi kutse lehel

Kutsu inimene vestlusruumi. Soovi korral saad teatud juhtudel tasuda kutsutu ühe kuu ligipääsu eest.

Eelpöördumise järel

Kui vastuvõtja soovib lisainfot või juhendatud eelkaardistust, saate jätkata vestlusruumis.

Koostäidetava eelkaardistuse juures

Siin saab olukorda koos täpsustada. Tegemist on eelinfoga, mitte ametliku hindamisega. Ametliku hindamise või otsuse teeb pädev spetsialist või asutus.

Uue liikme lisamisel

Uus liige näeb ruumis jagatud sõnumeid, faile ja kinnitatud eelinfot. Lisa inimene ainult siis, kui see on vajalik ja sul on õigus seda infot jagada.

Helivestluse juures

Helivestlust ei salvestata vaikimisi. Transkriptsioon või kokkuvõte luuakse ainult eraldi nõusolekul.

11.17. MVP

Esimeses versioonis piisab sellest:

1. Olemasolev kutse leht jääb alles.

1. Olemasolevale ruumi mudelile lisatakse:

  - roomType;

  - sourceId;

  - journeyId, kui ruum on seotud teekonnaga.

1. Vestlusruumi saab käivitada:

  - käsitsi kutse lehelt;

  - eelpöördumisest;

  - pöördumiste vastuvõtust;

  - abisoovi/abipakkumise matchist.

1. Eelpöördumisest tekkinud ruumis kuvatakse kinnitatud eelinfo kaart.

1. Ruumis on tekstivestlus ja failide jagamine.

1. Ruumis saab märkida järgmised sammud.

1. Ruumis saab koostada lihtsa kokkuvõtte.

1. Audio-only kõne on võimalik.

1. Salvestus/transkriptsioon on ainult eraldi nõusolekul.

1. Sponsoreeritud ühe kuu ligipääsu võimalus jääb käsitsi kutse töövoogu ja vajadusel eraisikute kutsumisse.

11.18. Kokkuvõte

Vestlusruum uues SotsiaalAI mudelis on jagatud koostööruum, mitte lihtsalt chat ega ainult eraldi kutse funktsioon.

Selle saab käivitada mitmest kohast:

- käsitsi kutse lehelt;

- abisoovi ja abipakkumise matchist;

- teekonnakaardilt;

- eelpöördumisest;

- pöördumiste vastuvõtust;

- juhendatud eelkaardistuse soovist.

Olemasolevat kutse lehte ei pea asendama. See muutub üheks ruumi loomise viisiks. Sama ruumisüsteemi saab kasutada eri töövoogudes, kui ruumile lisada tüüp ja päritolu.

Kõige lühem sõnastus:

Vestlusruum on SotsiaalAI ühine koostöökoht, kuhu liigub ainult kasutaja kinnitatud info ja kus valitud osapooled saavad olukorda täpsustada, dokumente jagada, eelkaardistust koos täita, helivestlust pidada ja järgmised sammud kokku leppida.

# 12. Teenusekatkemise kontroll

Teenusekatkemise kontroll on teekonnakaardi alamvoog, mis käivitub siis, kui inimese kirjeldusest, dokumendist või eelpöördumisest ilmneb, et olemasolev teenus, tugi või kontakt võib lõppeda, katkeda või jääda uue korralduse tõttu ebaselgeks.

See on eriti oluline rehabilitatsioonireformi, KOV teenuste mahu kasvu ja teenuseosutajate ümberkorralduste kontekstis, aga seda ei pea siduma ainult rehabilitatsiooniga. Sama loogika sobib ka koduteenuse, tugiisikuteenuse, sotsiaaltranspordi, isikliku abistaja, hoolduse, nõustamise või muu toe puhul.

Kõige lühemalt:

Teenusekatkemise kontroll aitab märgata, kas inimesel võib tekkida auk senise toe ja järgmise sammu vahel.

12.1. Põhimõte

Teenusekatkemise kontroll ei ole ametlik riskihindamine ega teenuse jätkamise otsus.

See on SotsiaalAI töövoog, mis aitab:

- märgata katkestuse riski;

- küsida puuduolevat infot;

- selgitada, kelle poole pöörduda;

- koostada eelpöördumise või küsimuse;

- siduda teekonnaga vajalikud kontaktid;

- soovitada dokumendi analüüsi, kui inimesel on otsus, plaan või kiri olemas.

SotsiaalAI ei ütle:

“Teenust tuleb jätkata.”

Ta ütleb pigem:

“Sinu kirjelduses võib olla teenusekatkemise risk. Selle täpsustamiseks oleks vaja teada, millal teenus lõpeb, kes teenust osutab ja kas KOV või muu pädev osapool on juba kaasatud. Soovi korral saan aidata koostada pöördumise.”

12.2. Millal kontroll käivitub?

Teenusekatkemise kontroll võib käivituda mitmest kohast.

1. Privaatne assistendivestlus

Kasutaja kirjutab näiteks:

- “Mu teenus lõpeb varsti.”

- “Rehabilitatsioon lõppeb ja ma ei tea, kuhu edasi pöörduda.”

- “Teenuseosutaja ütles, et nad enam ei jätka.”

- “KOV ei ole veel vastanud.”

- “Lapsel on teenus lõppemas.”

- “Ma ei tea, kas uus süsteem tähendab, et jään abita.”

2. Teekonnakaart

Kui teekonnakaart tuvastab sõnad või tähendused nagu:

- lõpeb;

- katkeb;

- ei jätku;

- teenuseosutaja muutub;

- otsus lõpeb;

- suunamine lõpeb;

- uus kontakt puudub;

- järjekord;

- ooteaeg;

- transport takistab teenusele jõudmist.

Siis lisatakse teekonnale riskimärge:

Võimalik teenusekatkemise risk.

3. Dokumendi analüüs

Kui kasutaja laadib üles:

- KOV otsuse;

- rehabilitatsiooniplaani;

- teenuseplaani;

- SKA/Tervisekassa/KOV kirja;

- teenuseosutaja teate;

- varasema suunamise või lepingu;

siis dokumendi analüüs võib tuvastada:

- lõppkuupäeva;

- teenuse mahu;

- tingimused;

- järgmise sammu;

- otsustaja;

- vaidlustamise või täpsustamise tähtaja;

- vajaduse võtta ühendust KOV-i või teenuseosutajaga.

4. Eelpöördumine

Kui inimene valib eelpöördumises, et teenus on lõppemas või ta ei tea, kas tugi jätkub, saab eelpöördumise tüübiks:

Teenuse jätkumise eelpöördumine.

5. Pöördumiste vastuvõtt

Kui spetsialist või teenuseosutaja näeb saabunud pöördumises teenuse lõppemise riski, võiks vastuvõtus olla märge:

Võimalik teenusekatkemise risk — vajab täpsustamist.

12.3. Mida kontroll küsib?

Teenusekatkemise kontroll ei tohiks olla pikk üldvorm. See peaks küsima täpselt neid andmeid, mis aitavad aru saada, kas teekond võib katkeda.

Põhiküsimused:

1. Mis teenus või tugi on praegu olemas või lõppemas?

1. Millal see lõpeb või millal muutus toimub?

1. Kes teenust praegu osutab?

1. Kes teenuse määras, korraldas või rahastas?

1. Kas olemas on otsus, teenuseplaan, rehabilitatsiooniplaan või muu dokument?

1. Kas KOV on juba kaasatud?

1. Kas teenuseosutaja on öelnud, mida edasi teha?

1. Kas inimene teab, kelle poole järgmisena pöörduda?

1. Kas transport, terviseseisund või muu takistus mõjutab teenusele jõudmist?

1. Mis juhtub inimese igapäevaelus, kui teenus katkeb?

Kõik küsimused ei pea korraga avanema. Assistent võib küsida 2–3 kõige olulisemat asja ja seejärel koostada esialgse riskiülevaate.

12.4. Riskitasemed

Teenusekatkemise kontroll võiks kasutada lihtsat riskitaset.

| Tase | Tähendus |
| --- | --- |
| Info puudub | kasutaja mainib teenust, aga pole teada, kas see lõpeb |
| Vajab kontrolli | teenuse jätkumine on ebaselge |
| Keskmine risk | teenus lõpeb või muutub, aga järgmine kontakt/samm pole selge |
| Kõrge risk | teenus lõpeb varsti, inimene sõltub teenusest ja uut sammu pole |
| Kriitiline olukord | teenuse katkemine võib tekitada vahetu ohu või raske kriisi |

Kriitilise olukorra puhul ei tohiks platvorm jääda ainult tavalise eelpöördumise juurde. Siis rakendub ka kriisi- ja ohusuunamise loogika.

Näiteks:

Kui teenuse katkemine tähendab, et inimene jääb kohe ilma vältimatust abist, tuleb pöörduda kiire abi või pädeva asutuse poole. SotsiaalAI saab aidata infot korrastada, kuid ei asenda kiiret abi.

12.5. Teenusekatkemise väljundid

Kontrolli tulemuseks ei ole “otsus”, vaid praktilised väljundid.

Võimalikud väljundid:

- riskimärge teekonnakaardil;

- puuduoleva info loend;

- soovitus lisada dokument;

- KOV kontakti leidmine teenusekaardilt;

- teenuseosutaja kontakti lisamine teekonnale;

- eelpöördumise mustand KOV-ile;

- küsimuse mustand teenuseosutajale;

- küsimused tervisekontaktile, kui katkestus on seotud tervise või arstliku hinnanguga;

- kokkuvõte spetsialistile;

- vestlusruumi soovitus, kui vaja on koostöös täpsustada.

12.6. Teenusekatkemise kontroll KOV teenuse puhul

Kui tegu on KOV korraldatava teenusega, näiteks koduteenus, sotsiaaltransport, tugiisikuteenus või isiklik abistaja, siis järgmine samm on enamasti KOV kontakt.

SotsiaalAI võiks sõnastada:

Sinu kirjelduses võib olla KOV teenuse jätkumise küsimus. Teenuse jätkumise või sobiva abi täpsustamiseks on mõistlik pöörduda KOV sotsiaalvaldkonna kontakti poole. KOV hindab abivajadust ja otsustab sobiva abi või teenuse oma töökorra järgi.

Väljund:

- KOV kontakti leidmine teenusekaardilt;

- eelpöördumine KOV-ile;

- varasema otsuse lisamise soovitus;

- küsimused: “millal teenus lõpeb?”, “kas vaja on uut hindamist?”, “mis on järgmine samm?”.

12.7. Teenusekatkemise kontroll teenuseosutaja puhul

Kui teenuseosutaja lõpetab teenuse või ei võta enam uusi inimesi, ei tähenda see alati, et teenus ise on ametlikult lõppenud. Võib olla vaja täpsustada:

- kas teenuseosutaja lõpetab lepingu;

- kas inimene saab valida teise teenuseosutaja;

- kas KOV või muu osapool peab otsuse muutma;

- kas on vaja uut hindamist või suunamist;

- kas teenuse maht väheneb;

- kas transport või piirkond muutub probleemiks.

Teenuseosutajale saab koostada küsimuse:

“Palun selgitage, kas teenus minu/lapse puhul jätkub, kas teenuseosutaja muutub ning kas järgmise sammu jaoks on vaja pöörduda KOV-i, arsti või muu osapoole poole.”

Kui teenus vajab KOV otsust, peab SotsiaalAI näitama:

Teenuseosutaja saab tingimusi selgitada, kuid teenuse jätkumise otsus võib sõltuda KOV-ist või muust pädevast osapoolest.

12.8. Tervisega seotud teenusekatkemine

Tervisega seotud olukorras peab SotsiaalAI olema ettevaatlik.

Kui inimene kirjeldab ravijärgset olukorda, tervisemure süvenemist, arstliku hinnangu vajadust või küsimust, kas teenuse jätkumiseks on vaja terviseinfot, siis võib esimene või paralleelne samm olla tervisekontakt.

Näide:

Kui teenuse jätkumine sõltub tervisega seotud hinnangust või ravijärgsest olukorrast, võib olla vaja võtta ühendust perearstikeskuse, tervisekeskuse või ravi andnud asutusega. SotsiaalAI ei anna meditsiinilist hinnangut, kuid saab aidata küsimused selgelt sõnastada.

Haiglaid ei pea selleks teenusekaardile põhikihina lisama. Aga kui inimene on haiglast koju tulemas, võib assistent öelda:

Küsi haiglast, kas väljakirjutamisega seoses on võimalik rääkida sotsiaaltöötaja või tugikontaktiga. Koduse toimetuleku ja KOV teenuste küsimuses pöördu KOV sotsiaalvaldkonna kontakti poole.

12.9. Teenusekatkemise kontroll lapse või pere puhul

Kui teenusekatkemine puudutab last, peab süsteem olema eriti ettevaatlik.

Näiteks:

- lapse rehabilitatsiooniteenus lõpeb;

- tugiisikuteenus lõpeb;

- kooli või koduse toimetuleku probleemid süvenevad;

- vanem ei tea, kuhu pöörduda;

- KOV ei ole veel kaasatud;

- teenuseosutaja vahetub.

SotsiaalAI võib öelda:

Kui teenuse katkemine mõjutab lapse igapäevast toimetulekut, peret või turvalisust, tasub pöörduda KOV lapse ja pere või lastekaitse valdkonna kontakti poole. SotsiaalAI saab aidata koostada eelinfo, kuid KOV spetsialist hindab olukorda ja otsustab edasise tegevuse.

Kui on vahetu oht, peab rakenduma kriisisuunamine.

12.10. Teenusekatkemise kontroll ja eelpöördumine

Teenusekatkemise kontrolli kõige praktilisem väljund on sageli eelpöördumine.

Eelpöördumise tüüp:

Teenuse jätkumise eelpöördumine

Sisu:

- milline teenus on lõppemas või katkenud;

- millal muutus toimub;

- kes oli senine teenuseosutaja;

- mis dokument on olemas;

- kas KOV on kaasatud;

- mis on inimese peamine mure;

- mida inimene soovib täpsustada;

- kas soovitakse juhendatud eelkaardistust;

- kas soovitakse vestlusruumi või kohtumist.

Pöördumise lõpp võiks olla näiteks:

Palun selgitada, milline oleks järgmine samm, et minu/lapse abivajadus ja teenuse jätkumine saaks õigel ajal üle vaadatud.

12.11. Teenusekatkemise kontroll ja dokumendi analüüs

Kui inimesel on olemas otsus või plaan, peaks teenusekatkemise kontroll väga tugevalt soovitama dokumendi analüüsi.

SotsiaalAI võib küsida:

Kas sul on olemas otsus, teenuseplaan, rehabilitatsiooniplaan või teenuseosutaja kiri? Kui lisad dokumendi, saan aidata leida tähtaja, teenuse mahu, järgmise sammu ja küsimused, mida spetsialistilt küsida.

Dokumendi analüüs võib välja võtta:

- teenuse nimi;

- otsuse kehtivus;

- teenuse lõppkuupäev;

- teenuse maht;

- otsustaja;

- teenuseosutaja;

- vaidlustamise või täpsustamise info;

- järgmised kohustused;

- kontaktid või viited.

12.12. Teenusekatkemise kontroll ja vestlusruum

Kui teenusekatkemise risk vajab mitme osapoole täpsustamist, võib teekonnakaart soovitada vestlusruumi.

Näiteks:

- inimene;

- KOV spetsialist;

- teenuseosutaja;

- vajadusel lähedane.

Vestlusruumis saab:

- täpsustada lõppkuupäeva;

- jagada dokumente;

- koostada kokkulepete ploki;

- märkida järgmised sammud;

- vajadusel täita eelkaardistust koos;

- koostada kokkuvõtte.

Oluline: teenuseosutaja või KOV näeb ainult seda infot, mille kasutaja jagab.

12.13. Kasutajaliidese näide

Teekonnakaardil võiks olla eraldi kaart:

Võimalik teenusekatkemise risk

Mida teame praegu:

- Teenus: kasutaja kirjeldatud teenus

- Lõppemise aeg: teadmata

- Praegune teenuseosutaja: teadmata

- KOV kaasatus: teadmata

- Dokument: lisamata

Mida oleks vaja täpsustada:

- millal teenus lõpeb;

- kas olemas on otsus või plaan;

- kes teenust praegu osutab;

- kellelt inimene on seni infot saanud;

- kas teenuseta jäämine mõjutab igapäevast toimetulekut.

Soovitatud järgmised sammud:

- lisa otsus või teenuseplaan dokumendi analüüsiks;

- leia KOV kontakt teenusekaardilt;

- koosta teenuse jätkumise eelpöördumine;

- küsi teenuseosutajalt tingimusi;

- vajadusel paku vestlusruumi.

12.14. Vastuvõtja vaade

Pöördumiste vastuvõtus võiks teenusekatkemise risk olla nähtav juba nimekirjas.

Näiteks märgis:

Teenusekatkemise risk

Avamisel:

- mis teenus;

- millal lõpeb;

- kas lõppkuupäev on teada;

- kas dokument on lisatud;

- kas inimene vajab kiiret kontakti;

- kas soovib juhendatud eelkaardistust;

- kas soovib vestlusruumi;

- mis info on puudu.

Vastuvõtja tegevused:

- küsi lõppkuupäeva;

- palu lisada otsus või plaan;

- ava vestlusruum;

- paku kohtumist;

- selgita, kas pöördumine kuulub KOV/teenuseosutaja rolli;

- soovita teist kontakti.

12.15. Andmemudel

Teenusekatkemise kontroll võiks olla teekonnakaardi riskisignaalina.

{
"riskSignal": {
"type": "SERVICE_CONTINUITY_RISK",
"status": "NEEDS_CHECK",
"level": "MEDIUM",
"serviceName": "Tugiisikuteenus",
"serviceEndDate": null,
"currentProvider": null,
"decisionOrPlanAttached": false,
"kovInvolved": "UNKNOWN",
"impactIfInterrupted": "UNKNOWN",
"recommendedActions": [
"ADD_DOCUMENT_FOR_ANALYSIS",
"CREATE_SERVICE_CONTINUITY_PRECONTACT",
"OPEN_SERVICE_MAP_FOR_KOV_CONTACT"
],
"lastUpdated": "2026-05-25T12:00:00Z"
}
}

Eelpöördumise seos:

{
"preContactType": "SERVICE_CONTINUITY",
"linkedRiskSignal": "SERVICE_CONTINUITY_RISK",
"mainQuestion": "Palun selgitada, milline on järgmine samm teenuse jätkumise või abivajaduse ülevaatamiseks."
}

12.16. Kasutajatekstid

Vestluses

Sinu kirjelduses võib olla teenusekatkemise risk. Selleks, et järgmine samm täpsemalt valida, oleks vaja teada, mis teenus on lõppemas, millal see lõpeb ja kas sul on olemas otsus, teenuseplaan või muu dokument.

Teekonnakaardil

Teenuse jätkumine vajab kontrollimist. SotsiaalAI saab aidata leida sobiva kontakti, koostada eelpöördumise või analüüsida varasemat otsust.

Eelpöördumises

See pöördumine aitab kirjeldada teenuse jätkumise muret ja küsida, milline on järgmine samm. See ei ole ametlik hindamine ega teenuse jätkamise otsus.

Vastuvõtja vaates

Kasutaja kirjeldab teenuse lõppemise või katkemise muret. Tegemist on kasutaja kinnitatud eelinfoga. Palun täpsustage edasine tegevus oma asutuse või teenuse töökorra järgi.

12.17. Mida vältida?

SotsiaalAI ei tohiks öelda:

- “Teenust tuleb pikendada.”

- “Sul on õigus teenuse jätkumisele.”

- “KOV peab teenuse jätkama.”

- “Teenuseosutaja peab sind edasi teenindama.”

- “SotsiaalAI hindas, et katkestus on lubamatu.”

- “Teenuse katkemine on kindlasti õigusvastane.”

Õigemad sõnastused:

- “Teenuse jätkumine vajab kontrollimist.”

- “Kirjelduse põhjal võib olla katkestuse risk.”

- “Järgmine samm võib olla KOV-i või teenuseosutajaga tingimuste täpsustamine.”

- “Kui teenuseta jäämine mõjutab igapäevast toimetulekut, tasub pöörduda võimalikult varakult pädeva kontakti poole.”

- “SotsiaalAI saab aidata koostada eelinfo või küsimused.”

12.18. MVP

Esimeses versioonis piisab:

1. Assistendivestlus tuvastab teenusekatkemise märksõnad ja tähendused.

1. Teekonnakaardil tekib märge Teenuse jätkumine vajab kontrollimist.

1. Kasutajalt küsitakse 3 põhiasja:

  - mis teenus;

  - millal lõpeb;

  - kas on dokument.

1. Kasutaja saab:

  - lisada dokumendi analüüsiks;

  - koostada teenuse jätkumise eelpöördumise;

  - avada teenusekaardi KOV kontakti leidmiseks;

  - küsida teenuseosutajalt tingimusi.

1. Pöördumiste vastuvõtus kuvatakse märge Teenusekatkemise risk.

1. Vastuvõtja saab küsida lisainfot, avada vestlusruumi või pakkuda kohtumist.

12.19. Kokkuvõte

Teenusekatkemise kontroll on SotsiaalAI uues mudelis üks olulisemaid teekonnakaardi kaitsefunktsioone.

Selle eesmärk on märgata olukordi, kus inimene võib jääda teenuse, toe või järgmise kontaktita just üleminekuhetkel.

See ei tee ametlikku otsust ega anna õigushinnangut, vaid aitab vastata praktilistele küsimustele:

- mis teenus on lõppemas;

- millal see lõpeb;

- kes vastutab järgmise sammu eest;

- kas dokument on olemas;

- kas KOV või teenuseosutaja tuleb kaasata;

- mida inimene saab täna teha;

- millise pöördumise SotsiaalAI saab aidata koostada.

Kõige lühem sõnastus:

Teenusekatkemise kontroll aitab varakult märgata, kui inimese senine tugi võib katkeda, ning valmistada ette järgmise sammu enne, kui inimene jääb süsteemide vahele.

# 13. “Anna endast märku” loogika

“Anna endast märku” võiks olla SotsiaalAI üks kõige inimkesksemaid põhimõtteid. See ei ole lihtsalt üks nupp või vorm, vaid loogika, mille kaudu inimene ei pea ootama, kuni süsteem, spetsialist või teenuseosutaja teda märkab.

Kõige lühemalt:

SotsiaalAI aitab inimesel oma olukorrast arusaadavalt märku anda, leida sobiva esimese kontakti ja koostada kontrollitava eelinfo, mida ta saab ise otsustada jagada.

13.1. Põhimõte

Sotsiaalvaldkonnas räägitakse sageli sellest, et abivajajat tuleb märgata. SotsiaalAI saab sellele lisada teise poole:

inimene, lähedane või abistaja saab ise märku anda.

See on eriti oluline siis, kui inimene:

- ei tea, kuhu pöörduda;

- ei oska oma abivajadust ametlikult sõnastada;

- ei jaksa pikka vormi täita;

- kardab, et tema teenus katkeb;

- ei saa dokumendist aru;

- ei tea, kas pöörduda KOV-i, teenuseosutaja või tervisekontakti poole;

- vajab esmalt lihtsalt selgust ja järgmist sammu.

“Anna endast märku” ei tähenda, et SotsiaalAI teeb ametliku hindamise. See tähendab, et platvorm aitab inimesel enda olukorra nähtavaks, arusaadavaks ja jagatavaks teha.

13.2. Seos esmase teekonnasõelaga

Kui inimene alustab privaatses vestluses, võib ta kirjutada väga lihtsalt:

“Ma ei saa kodus enam hästi hakkama.”

või:

“Mu teenus lõpeb ja ma ei tea, mis edasi saab.”

või:

“Ma ei oska öelda, kelle poole pöörduda.”

Selle põhjal teeb SotsiaalAI esmase teekonnasõela:

- kas tegemist võib olla sotsiaalvaldkonna pöördumisega;

- kas esmane kontakt võiks olla KOV;

- kas teema puudutab teenuseosutajat;

- kas esmane samm peaks olema tervisekontakt;

- kas olukorras on teenusekatkemise risk;

- kas inimene võiks koostada eelpöördumise;

- kas inimene soovib pigem juhendatud eelkaardistust;

- kas sobib abisoovi/abipakkumise töövoog.

Ehk “anna endast märku” ei ole ainult vorm. See algab juba esimesest vestlusest.

13.3. Mida inimene saab teha?

“Anna endast märku” töövoos võiks inimesel olla mitu lihtsat valikut.

1. Kirjeldan olukorda oma sõnadega

Kõige madalama lävega algus.

Inimene ei pea teadma teenuse nime, seadust ega õiget asutust.

2. Soovin leida õige kontakti

SotsiaalAI kasutab teekonnakaarti ja teenusekaarti, et pakkuda võimalikku KOV kontakti, teenuseosutajat või esmase tervisekontakti suunda.

3. Soovin koostada lühikese eelpöördumise

Kui inimene tahab kellelegi kirjutada, aitab SotsiaalAI koostada kontrollitava mustandi.

4. Soovin täita eelkaardistuse

Kui inimene tahab anda põhjalikumat eelinfot, saab ta vastata lühemale või põhjalikumale küsimustikule.

5. Soovin täita koos spetsialistiga

Kui inimene ei taha või ei saa vormi üksi täita, saab ta saata märguande:

“Soovin olukorda täpsustada koos spetsialistiga.”

6. Soovin lihtsalt praktilist abi

Kui teema ei ole ametlik teenus, võib teekonnakaart suunata abisoovide ja abipakkumiste funktsiooni.

13.4. Kelle nimel saab märku anda?

Töövoog peab eristama, kes pöördub.

Võimalikud variandid:

- inimene ise;

- lähedane;

- hooldaja;

- seaduslik esindaja;

- spetsialist inimese nõusolekul;

- teenuseosutaja või koostööpartner, kui tal on õigustatud roll.

See on oluline, sest “annan endast märku” ja “annan kellegi teise eest märku” ei ole sama.

Kasutajaliideses võiks olla küsimus:

Kelle olukorrast soovid märku anda?

Valikud:

- enda olukorrast;

- lähedase olukorrast;

- lapse või esindatava olukorrast;

- tööalases rollis kliendi/juhtumi kohta.

Kui inimene annab märku kellegi teise eest, peaks platvorm kuvama ettevaatliku selgituse:

Jaga ainult seda infot, mille jagamiseks sul on õigus ja mis on järgmise sammu jaoks vajalik.

13.5. Seos SKA hindamisloogikaga

“Anna endast märku” ei pea kasutama ametliku hindamise keelt, kuid võib taustal tugineda samadele eluvaldkondadele, mida spetsialistid hiljem kasutavad.

SKA täisealise inimese abi- ja toetusvajaduse hindamise juhend kirjeldab eluvaldkondade põhist struktuuri ning rõhutab, et hindamise eesmärk on saada ülevaade, millistes valdkondades inimene tuge vajab; samas hindamine ise ei määra teenust, vaid spetsialist teeb kaalutletud otsuse.

SotsiaalAI jaoks tähendab see:

- AI võib aidata inimese kirjeldust eluvaldkondade kaupa korrastada;

- inimene võib täita eelkaardistuse;

- spetsialist saab parema eelinfo;

- ametlik hindamine ja otsus jäävad spetsialistile.

13.6. “Anna endast märku” väljundid

Töövoo tulemus võib olla eri kujul.

| Väljund | Millal sobib? |
| --- | --- |
| Teekonnakaart | inimene vajab selgust, mis teemad on seotud |
| Eelpöördumise mustand | inimene tahab KOV-i või teenuseosutaja poole pöörduda |
| Eelinfo kaart | inimene tahab jagada struktureeritud kokkuvõtet |
| Teenusekatkemise pöördumine | olemasolev teenus võib lõppeda |
| Küsimused teenuseosutajale | vaja on teada ligipääsutingimusi |
| Küsimused tervisekontaktile | esmane samm võib olla perearstikeskus või tervisekeskus |
| Abisoov | vaja on kogukondlikku või praktilist abi |
| Vestlusruumi soov | inimene soovib edasi suhelda või küsimustikku koos täita |

13.7. Kuidas see võiks kasutajale paista?

Vestluse alguses võiks olla üks lihtne CTA:

Anna endast märku

Selgitus:

Kirjelda oma olukorda oma sõnadega. SotsiaalAI aitab selle põhjal aru saada, milline järgmine samm võiks olla: sobiva kontakti leidmine, eelpöördumise koostamine, eelkaardistus, dokumendi analüüs või abisoovi loomine.

Selle kõrval võiksid olla kiirvalikud:

- Ma ei tea, kuhu pöörduda

- Mul võib teenus katkeda

- Soovin spetsialistile kirjutada

- Soovin küsimustikku koos täita

- Mul on dokument, millest ma ei saa aru

- Vajan praktilist abi

13.8. Vastuvõtja vaade

Kui inimene annab endast märku eelpöördumise kaudu, näeb vastuvõtja mitte lihtsalt “kirja”, vaid eelinfo kaarti.

Näiteks:

Pöördumise tüüp: inimene annab endast märku
Peamine mure: koduse toimetuleku raskus
Inimese soov: soovib aru saada, millist abi küsida
Täpsustamise soov: soovib küsimustikku täita koos spetsialistiga
Seotud teemad: igapäevaelu toimingud, füüsiline tervis, KOV teenused
Puuduolev info: teenuse varasem olemasolu, dokumendid
Soovitatud tegevus: paku vestlusruumi või kohtumist

See aitab spetsialistil alustada mitte nullist.

13.9. Seos privaatsusega

“Anna endast märku” peab olema turvaline ja kontrollitav.

Põhireeglid:

1. Privaatset assistendivestlust ei jagata.

1. Jagatav eelinfo koostatakse eraldi.

1. Kasutaja kinnitab enne saatmist kogu jagatava sisu.

1. Kasutaja saab infot muuta või eemaldada.

1. Vastuvõtja näeb ainult saadetud infot.

1. Kui inimene annab märku teise inimese kohta, peab platvorm rõhutama õigust ja minimaalsust.

1. Delikaatset infot ei küsita rohkem kui järgmise sammu jaoks vaja.

Kasutajatekst:

Sa saad enne saatmist üle vaadata, mida vastuvõtja näeb. Sinu privaatset vestlust assistendiga ei jagata.

13.10. Kriisi- ja ohusignaalid

Kui inimene annab endast märku olukorras, kus on vahetu oht, ei tohiks SotsiaalAI jääda ainult tavalise eelpöördumise juurde.

Näiteks:

- enesevigastamise või suitsiidioht;

- vahetu vägivald;

- lapse tõsine ohustatus;

- raske terviseoht;

- inimene on kohe abita või turvata.

Sellisel juhul peab käivituma kriisi- ja ohusuunamine.

Sõnastus:

Kui on vahetu oht elule, tervisele või turvalisusele, tuleb pöörduda kohe hädaabi või kriisiabi poole. SotsiaalAI saab aidata infot korrastada, kuid ei asenda kiiret abi.

13.11. Seos abisoovide ja abipakkumistega

Kui inimene annab endast märku praktilise või kogukondliku abi vajadusega, ei pea teda alati ametlikule teenusekaardile suunama.

Näiteks:

- vajan abi poeskäigul;

- vajan kedagi, kes aitaks väikese praktilise toiminguga;

- soovin seltsilist;

- tahan pakkuda abi.

Siis võib teekonnakaart suunata:

Abisoovid ja abipakkumised

Sõnastus:

See võib olla pigem praktilise või kogukondliku abi küsimus. Soovi korral saad koostada abisoovi ja vaadata sobivaid abipakkumisi.

13.12. Seos teenusekatkemisega

“Anna endast märku” on eriti oluline teenusekatkemise riskis.

Kui inimene kirjutab:

“Ma ei tea, kas mu teenus jätkub.”

Siis SotsiaalAI ei tohiks oodata, kuni inimene leiab õige vormi.

Ta peaks pakkuma:

- teenusekatkemise kontrolli;

- dokumendi lisamist;

- KOV kontakti leidmist;

- teenuse jätkumise eelpöördumist;

- vestlusruumi soovi.

Sõnastus:

Kui teenus võib katkeda, aitab SotsiaalAI sul varakult märku anda ja koostada küsimused, mida KOV-ilt või teenuseosutajalt küsida.

13.13. Kas see on eraldi funktsioon või läbiv loogika?

Mina teeksin selle läbivaks loogikaks, mitte ainult eraldi funktsiooniks.

See võib olla nähtav kolmes kohas:

1. Vestluse alguses
“Kirjelda olukorda / anna endast märku.”

1. Teekonnakaardil
“Selle teekonna põhjal saad endast märku anda valitud kontaktile.”

1. Eelpöördumises
“Saada lühike märguanne või täida eelkaardistus.”

Seega “Anna endast märku” on kasutajakeelne värav, mille all võivad käivituda erinevad tööriistad.

13.14. Andmemudel

“Anna endast märku” võib tehniliselt olla eelpöördumise üks tüüp või teekonnakaardi algne kavatsus.

{
"signalIntent": {
"id": "signal_001",
"journeyId": "journey_001",
"createdBy": "user_001",
"subjectType": "SELF | RELATIVE | REPRESENTED_PERSON | WORK_CLIENT",
"status": "DRAFT",
"mainConcern": "Kasutaja kirjeldab koduse toimetuleku raskust.",
"userGoal": "Soovin aru saada, kuhu pöörduda ja millist abi küsida.",
"preferredNextStep": "PRECONTACT | GUIDED_MAPPING | SERVICE_MAP | HELP_REQUEST | DOCUMENT_ANALYSIS",
"shareConfirmed": false
}
}

Eelpöördumiseks muutudes:

{
"preContactType": "SIGNAL_FOR_HELP",
"mappingDepth": "BRIEF_NOTICE",
"completionMode": "SELF_COMPLETED",
"recipientType": "KOV_CONTACT"
}

13.15. Kasutajatekstid

Avalehe või vestluse CTA

Anna endast märku
Kirjelda oma olukorda oma sõnadega. SotsiaalAI aitab mõista, milline järgmine samm võiks olla ja kelle poole võiks pöörduda.

Vestluses

Sa ei pea teadma õige teenuse või asutuse nime. Kirjelda, mis toimub, ja ma aitan sul järgmise sammu ette valmistada.

Enne saatmist

Saadetakse ainult see info, mille oled üle vaadanud ja kinnitanud. Privaatset vestlust assistendiga ei jagata.

Spetsialistile

Kasutaja annab endast märku ja soovib olukorra täpsustamist. Tegemist on eelinfoga, mitte ametliku hindamisega.

13.16. Mida vältida?

Vältida tuleks sõnastusi:

- “SotsiaalAI märkab abivajaja automaatselt”

- “SotsiaalAI hindab sinu abivajaduse”

- “SotsiaalAI suunab sind teenusele”

- “SotsiaalAI alustab menetluse”

- “SotsiaalAI tagab teenuse”

Paremad sõnastused:

- “aitab endast märku anda”;

- “aitab olukorda kirjeldada”;

- “aitab järgmise sammu ette valmistada”;

- “aitab leida võimaliku kontakti”;

- “koostab jagatava eelinfo”;

- “ametliku hindamise ja otsuse teeb pädev spetsialist või asutus”.

13.17. MVP

Esimeses versioonis piisab:

1. Vestluse alguses CTA “Anna endast märku”.

1. Assistendi esmane teekonnasõel.

1. Teekonnakaardil valik:

  - leia kontakt;

  - koosta eelpöördumine;

  - täida eelkaardistus;

  - soovin täita koos spetsialistiga;

  - loo abisoov.

1. Eelpöördumise tüüp “lühike märguanne”.

1. Kasutaja kinnitab jagatava info.

1. Vastuvõtja näeb märget “kasutaja annab endast märku”.

1. Privaatset vestlust ei jagata.

13.18. Kokkuvõte

“Anna endast märku” on SotsiaalAI uue mudeli üks kõige tugevamaid kasutajakeskseid ideid.

See tähendab, et inimene ei pea ootama, kuni süsteem teda märkab, ega teadma kohe õiget teenust või asutust. Ta saab kirjeldada olukorda oma sõnadega ning SotsiaalAI aitab selle põhjal luua teekonnakaardi, leida võimaliku kontakti ja koostada jagatava eelinfo.

Kõige lühem sõnastus:

SotsiaalAI aitab inimesel endast märku anda enne, kui probleem jääb nähtamatuks või teenus katkeb. Platvorm ei tee ametlikku hindamist ega otsust, vaid aitab olukorra arusaadavaks teha ja järgmise sammu ette valmistada.

# 15. Allikate kuvamise uus väärtus

Allikate kuvamine ei peaks SotsiaalAI-s olema lihtsalt vastuse lõpus olev lingiloend. Uues mudelis peab allikate kuvamine aitama kasutajal aru saada:

millele vastus toetub, mis tüüpi allikas see on, kui ajakohane see on ja millist osa vastusest see toetab.

Kõige lühemalt:

Allikate kuvamine peab muutuma usalduskihiks, mitte pelgalt tehniliseks viidete lisaks.

15.1. Põhimõte

Sotsiaalvaldkonna vastustes ei piisa sellest, et “allikad on olemas”. Kasutaja peab mõistma, kas vastus põhineb:

- seadusel;

- KOV määrusel;

- KOV teenusekirjeldusel;

- SKA juhendil;

- teenuseosutaja profiilil;

- reformi infol;

- artiklil või analüüsil;

- kasutaja enda dokumendil;

- SotsiaalAI sisemisel mallil.

Need ei ole sama kaaluga allikad.

Näiteks õigusakti põhjal saab öelda midagi normatiivset. Teenuseosutaja profiili põhjal saab öelda midagi teenuse tingimuste kohta. Artikli põhjal saab kirjeldada kriitikat või arutelu, aga mitte väita, et see on kehtiv õigus.

15.2. Mida allikate vaade peab näitama?

Iga allika juures võiks olla nähtav vähemalt:

| Väli | Miks vajalik? |
| --- | --- |
| Pealkiri | kasutaja saab aru, mis materjaliga on tegu |
| Allikatüüp | seadus, juhend, KOV info, teenuseosutaja info, artikkel jne |
| Allika roll vastuses | mida see vastuses toetas |
| Staatus | kehtiv, muutuv, eelnõuline, kontrollimist vajav |
| Viimati kontrollitud | eriti oluline KOV ja teenuseosutaja info puhul |
| Avaldamise või kehtivuse kuupäev | aitab hinnata ajakohasust |
| Allika päritolu | Riigi Teataja, KOV, SKA, teenuseosutaja, SotsiaalAI mall jne |
| Täpsusaste | kas allikas toetab üldist põhimõtet või konkreetset kohalikku sammu |

15.3. Allika roll vastuses

Allikate vaade võiks näidata mitte ainult “kasutatud allikaid”, vaid ka mida iga allikas toetas.

Näiteks:

Sotsiaalhoolekande seadus
Roll vastuses: KOV abivajaduse hindamise õiguslik alus.

SKA teenusejuhend
Roll vastuses: teenuse korraldamise üldine metoodiline selgitus.

Harku valla teenusekirjeldus
Roll vastuses: konkreetse KOV teenuse praktiline info ja kontakt.

Teenuseosutaja profiil
Roll vastuses: teenuseosutaja piirkond, sihtrühm ja pöördumisviis.

Rehabilitatsioonireformi leht
Roll vastuses: muutuv või kavandatav korraldus, mitte kehtiv otsus.

Selline vaade aitab vältida olukorda, kus kõik allikad tunduvad kasutajale võrdsed.

15.4. Allikate kuvamine rolliti

Pöörduja vaade

Pöörduja ei vaja väga tehnilist allikapaneeli. Tema jaoks võiks allikate vaade olla lihtne:

- Kust info pärineb?

- Kas see on ametlik info?

- Kas info võib olla muutumas?

- Millal seda kontrolliti?

- Kas see puudutab minu piirkonda?

Näide:

Allikas: Tallinna linna teenusekirjeldus
Tüüp: KOV ametlik info
Viimati kontrollitud: 25.05.2026
Toetas vastuses: kuhu pöörduda ja milline on esimene samm

Spetsialisti vaade

Spetsialist vajab rohkem detaile:

- allikatüüp;

- õigusakt või juhend;

- paragrahv või peatükk, kui olemas;

- KOV määruse või teenusekirjelduse seos;

- kas allikas on kehtiv või muutuv;

- kas vastus tugines allikale otseselt või üldise taustana;

- millised väited allikas kattis.

Spetsialisti jaoks võiks allikavaade olla kontrollitav töövahend, mitte lihtsalt usalduse märk.

Teenuseosutaja vaade

Teenuseosutaja jaoks on oluline:

- kas allikas on tema enda kinnitatud profiil;

- kas info pärineb SotsiaalAI andmekorjest;

- millal info kontrolliti;

- kas info vajab teenuseosutaja kinnitust;

- kas teenuse ligipääsutingimused on tema enda poolt kirjeldatud või üldistatud.

15.5. Allika staatuse märgised

Allikate juures peaksid olema selged märgised.

| Märgis | Tähendus |
| --- | --- |
| Kehtiv info | kasutatav praeguse vastuse aluseks |
| KOV ametlik info | pärineb kohaliku omavalitsuse ametlikust allikast |
| Õiguslik alus | seadus või määrus |
| Ametlik juhend | SKA/Sotsiaalministeerium vms metoodiline juhend |
| Teenuseosutaja kinnitatud | info pärineb teenuseosutaja profiilist |
| Kontrollimist vajav | info võib olla vananenud või puudulik |
| Muutuv info | seotud reformi või ümberkorraldusega |
| Eelnõuline | ei ole kehtiv kord |
| Artikkel/analüüs | taust või seisukoht, mitte õiguslik alus |

Eriti oluline on eristada:

kehtiv kord
ja
kavandatav või muutuv info.

15.6. Allikad ja reformiinfo

Rehabilitatsioonireformi ja tervise-sotsiaalvaldkonna lõimimise puhul peab allikavaade olema eriti ettevaatlik.

Kui vastus kasutab reformiinfot, peaks allikate paneelis olema märge:

See allikas kirjeldab kavandatavat või muutuvat korraldust. Seda ei tohi käsitleda lõpliku kehtiva korrana, kui allikas ise seda ei kinnita.

Näiteks allikate vaates:

Sotsiaalministeeriumi reformileht
Tüüp: reformiinfo
Staatus: muutuv info
Toetas vastuses: kavandatava muudatuse üldine suund
Märkus: ei asenda kehtiva õiguse või KOV otsuse kontrolli

15.7. Allikad ja teenuseni jõudmine

Teenusekaardil peaks allikate vaade näitama, kust pärineb info selle kohta:

- mis teenus on;

- kellele teenus on mõeldud;

- kes korraldab;

- kas vaja on KOV hindamist;

- kas vaja on otsust või suunamist;

- milline on esimene samm;

- milline kontakt on õige;

- millal info kontrolliti.

Näide:

Koduteenus

- Teenuse üldloogika: SKA teenusejuhend

- Kohalik korraldus: KOV teenusekirjeldus või määrus

- Kontakt: KOV ametlik kontaktileht

- Esimene samm: KOV teenusekirjeldus + üldjuhendi loogika

- Viimati kontrollitud: kuupäev

15.8. Allikad ja eelpöördumine

Eelpöördumise puhul ei ole allikad ainult vastuse lõpus. Need annavad usaldust küsimustiku ülesehitusele.

Näiteks eelkaardistuse juures võiks olla väike selgitus:

Küsimused lähtuvad täisealise inimese abi- ja toetusvajaduse hindamise eluvaldkondade loogikast. SotsiaalAI-s täidetud vastused on spetsialistile esitatav eelinfo, mitte ametlik hindamine.

Allikavaates võiks olla:

SKA täisealise abi- ja toetusvajaduse hindamise juhend
Tüüp: ametlik juhend
Roll: eelkaardistuse eluvaldkondade loogika
Staatus: kehtiv juhend / kontrollitud kuupäeval
Piir: SotsiaalAI ei tee ametlikku hindamist

15.9. Allikad ja dokumendi analüüs

Kui kasutaja laadib üles oma dokumendi, peab allikavaade eristama:

- kasutaja enda dokument;

- SotsiaalAI teadmuspõhja allikas;

- õigusakt või juhend;

- KOV info;

- teenuseosutaja info.

Näiteks:

Kasutaja üles laaditud KOV otsus
Roll: konkreetse juhtumi info, tähtajad ja otsuse sisu

Sotsiaalhoolekande seadus
Roll: üldine õiguslik raam

KOV teenusekirjeldus
Roll: kohaliku teenuse praktiline korraldus

See on oluline, sest kasutaja dokument võib olla juhtumipõhiselt kõige olulisem allikas, aga see ei ole üldine õigusallikas.

15.10. Allikate kuvamise tehniline loogika

SotsiaalAI RAG-loogikas peaks olema selge vahe:

1. Retrieved sources – kõik leitud kandidaadid

1. Selected context sources – vastuse koostamiseks valitud kontekst

1. Answer sources – allikad, millele vastuse konkreetsed väited tuginesid

1. Displayed sources – kasutajale kuvatavad allikad

Kasutajale ei tohiks näidata kõiki otsingus leitud või konteksti valitud allikaid.

Kasutajale peaks näitama ainult:

vastuse tegelikke allikaid, ehk neid, millele vastus sisuliselt tugines.

See on sinu platvormi usaldusväärsuse jaoks väga oluline.

15.11. Väitepõhine allikastamine

Ideaalis peaks allikavaade toetama väitepõhist kontrolli.

Näiteks vastuses on väide:

“Koduteenus on KOV korraldatav teenus ning teenuseni jõudmiseks tuleb tavaliselt pöörduda KOV sotsiaalvaldkonna kontakti poole.”

Allikavaates peaks olema näha:

- teenuse üldloogika tugineb SKA juhendile;

- konkreetne kontakt tugineb KOV kontaktilehele;

- konkreetse KOV teenuse tingimused tuginevad KOV teenusekirjeldusele.

See aitab kasutajal kontrollida, milline allikas mida toetab.

15.12. Allikate usaldustase

Allikatel võiks olla sisemine usaldustase või autoriteetsuse tase.

Näiteks:

| Tase | Allikas |
| --- | --- |
| Kõrge õiguslik autoriteet | Riigi Teataja seadused ja määrused |
| Kõrge ametlik praktiline autoriteet | KOV ametlik teenuseinfo, KOV kontaktileht |
| Ametlik metoodiline autoriteet | SKA/Sotsiaalministeeriumi juhendid |
| Teenuseosutaja enda info | teenuseosutaja profiil või veebileht |
| Taust/analüüs | artikkel, uuring, arvamus |
| Ülevaatusel info | kasutaja või spetsialisti lisatud materjal |

Seda ei pea kasutajale numbrina näitama, aga assistendi vastusepoliitikas peab see olema arvesse võetud.

15.13. UI soovitus

Allikate nupp võiks avada paneeli, kus allikad on rühmitatud.

Näiteks:

Kasutatud allikad

Õiguslik alus

- Sotsiaalhoolekande seadus

- KOV määrus

Ametlikud juhendid

- SKA teenusejuhend

- SKA hindamisjuhend

Kohalik info

- KOV teenusekirjeldus

- KOV kontaktileht

Teenuseosutaja info

- Teenuseosutaja profiil

Muutuv/reformiinfo

- Sotsiaalministeeriumi reformileht

Iga allika juures:

- allikatüüp;

- kuupäev;

- staatus;

- mida see vastuses toetas;

- link või avamisvõimalus.

15.14. Kasutajatekstid

Allikate paneeli alguses

Siin on allikad, millele vastus tugines. Allikate juures on näidatud, kas tegemist on õigusakti, ametliku juhendi, KOV info, teenuseosutaja info või muutliku reformiinfoga.

Kui info on muutuv

Osa vastusest tugineb muutuvat või kavandatavat korraldust kirjeldavale allikale. Kontrolli enne otsuse tegemist kehtivat infot ametlikust allikast või pädevalt spetsialistilt.

Kui allikas on KOV info

KOV info võib erineda omavalitsuseti. See allikas puudutab konkreetset piirkonda.

Kui allikas on teenuseosutaja profiil

See info pärineb teenuseosutaja profiilist või teenuseosutaja enda avalikust infost. Teenuse tingimused võivad vajada otsekontaktis täpsustamist.

Kui vastus tugineb kasutaja dokumendile

Osa vastusest tugineb sinu üles laaditud dokumendile. Seda dokumenti ei kuvata teistele osapooltele, kui sa seda ise ei jaga.

15.15. Andmemudel

Allika mudel võiks olla näiteks:

{
"source": {
"id": "source_001",
"title": "Koduteenuse juhend",
"sourceType": "SERVICE_GUIDE",
"authorityLevel": "OFFICIAL_GUIDANCE",
"publisher": "Sotsiaalkindlustusamet",
"status": "VALID",
"publishedAt": "2023-11-01",
"lastChecked": "2026-05-25",
"url": "https://...",
"supports": [
"SERVICE_DESCRIPTION",
"ACCESS_PATH",
"SPECIALIST_WORKFLOW"
],
"usedInAnswer": true,
"supportedClaims": [
{
"claimId": "claim_001",
"claimType": "GUIDANCE",
"summary": "Teenuse korraldamise üldine loogika"
}
]
}
}

Vastuse allikate mudel:

{
"answerSources": [
{
"sourceId": "source_001",
"displayGroup": "Ametlik juhend",
"sourceRole": "Toetas teenuse üldloogika selgitust",
"claimTypesSupported": ["GUIDANCE", "ACCESS_PATH"],
"displayToUser": true
}
]
}

15.16. Mida vältida?

Allikate kuvamisel tuleks vältida:

- kõigi leitud allikate kuvamist, kui vastus neile ei tuginenud;

- eelnõulise info kuvamist kehtiva infona;

- artikli või arvamuse kuvamist õigusliku alusena;

- KOV info üldistamist kogu Eestile;

- allikate kuupäeva peitmist;

- allikatüübi peitmist;

- “allikad olemas” tunnet ilma selgituseta, mida allikas toetas;

- kasutaja dokumendi ja üldise teadmuspõhja allika segiajamist.

15.17. MVP

Esimeses versioonis piisab, kui allikate paneel näitab:

1. allika pealkiri;

1. allikatüüp;

1. staatus;

1. viimati kontrollitud kuupäev;

1. lühike “toetas vastuses” selgitus;

1. link või avamisvõimalus;

1. erimärge, kui info on reformiinfo või kontrollimist vajav.

Kõige olulisem MVP reegel:

kuva ainult vastuses tegelikult kasutatud allikad.

15.18. Kokkuvõte

Allikate kuvamise uus väärtus on selles, et kasutaja ei näe lihtsalt viiteid, vaid mõistab vastuse usaldusloogikat.

Allikate paneel peaks vastama küsimustele:

- kust info pärineb;

- mis tüüpi allikas see on;

- kas allikas on kehtiv, muutuv või kontrollimist vajav;

- millist osa vastusest allikas toetas;

- kas info puudutab konkreetset KOV-i, üldist juhendit või reformi;

- millal seda kontrolliti.

Kõige lühem sõnastus:

SotsiaalAI allikate vaade ei ole lingiloend, vaid vastuse kontrollikiht: see näitab, millisele allikale iga oluline väide toetub ja kui kindlana seda infot käsitleda saab.

# 16. Rollipõhine uus kogemus

SotsiaalAI uus mudel peab olema rollipõhine, aga mitte nii, et igal rollil on lihtsalt oma tööriistade nimekiri. Uues loogikas on igal rollil oma teekond, vastutus, nähtav info ja järgmised tegevused.

Kõige lühemalt:

Pöörduja annab endast märku ja liigub järgmise sammuni. Spetsialist saab struktureeritud eelinfo ja töömustandid. Teenuseosutaja teeb oma teenused leitavaks ja saab paremini ettevalmistatud pöördumisi.

16.1. Põhimõte

Rollipõhisus peab lahendama kolm küsimust:

1. Mida inimene selles rollis teha tahab?

1. Millist infot ta tohib näha?

1. Milline järgmine samm on tema jaoks mõistlik?

See tähendab, et sama objekt võib eri rollile paista erinevalt.

Näiteks eelpöördumine:

- pöördujale on see viis endast märku anda;

- spetsialistile on see eelinfo töökaart;

- teenuseosutajale on see teenusega seotud päring;

- süsteemile on see kontrollitud jagatav andmeobjekt.

16.2. Pöörduja kogemus

Pöörduja jaoks peab SotsiaalAI olema võimalikult lihtne.

Tema ei pruugi teada:

- mis teenust tal vaja on;

- kas pöörduda KOV-i või teenuseosutaja poole;

- kas tervisemurega peaks alustama perearstist;

- kas tal on vaja dokumenti, eelpöördumist või abisoovi;

- kuidas ametlikult kirjutada;

- mida spetsialist vajab.

Seetõttu peab pöörduja kogemus algama küsimusest:

“Mis olukorras sa oled?”

mitte:

“Millist funktsiooni soovid kasutada?”

Pöörduja põhivoog

Sisselogimine
→ privaatne vestlus assistendiga
→ inimene kirjeldab olukorda
→ AI teeb esmase teekonnasõela
→ tekib teekonnakaart
→ kasutaja valib järgmise sammu
→ eelpöördumine / teenusekaart / dokument / abisoov / vestlusruum

Pöörduja peamised tegevused

Pöörduja saab:

- kirjeldada olukorda oma sõnadega;

- saada esmase teekonnakaardi;

- näha võimalikke järgmisi samme;

- avada teenusekaardi eelfiltreeritud vaates;

- koostada eelpöördumise;

- täita lühema või põhjalikuma eelkaardistuse;

- märkida, et soovib küsimustikku täita koos spetsialistiga;

- lisada dokumendi analüüsiks;

- koostada kirja või küsimuse;

- avada või vastu võtta vestlusruumi kutse;

- luua abisoovi või vaadata abipakkumisi;

- kinnitada, mida jagatakse;

- salvestada või alla laadida kokkuvõtte.

Pöörduja jaoks kõige tähtsam lubadus

Sa ei pea teadma õige teenuse, asutuse või vormi nime. Kirjelda olukorda ja SotsiaalAI aitab sul järgmise sammu ette valmistada.

Pöörduja vaate peamised moodulid

Pöörduja töölaual võiks olla esiplaanil:

1. Alusta teekonda / Anna endast märku

1. Minu teekonnad

1. Eelpöördumised

1. Teenusekaart

1. Dokumendi koostamine

1. Dokumendi analüüs

1. Vestlusruumid

1. Abisoovid ja abipakkumised

1. Minu dokumendid / mustandid

Pöördujale ei pea nähtavalt rõhutama keerulisi süsteemikihte nagu RAG, allikavaliku poliitika või sisemised riskiklassifikaatorid. Need peavad toetama tulemust taustal.

16.3. Sotsiaaltöö spetsialisti kogemus

Spetsialisti jaoks ei ole SotsiaalAI “otsustaja”, vaid töövahend.

Spetsialist vajab:

- paremat eelinfot;

- allikapõhist tausta;

- kontrollitavaid töömustandeid;

- dokumentide analüüsi;

- memo ja kokkuvõtte koostamist;

- lihtsas keeles selgitusi inimesele;

- kovisiooni ja praktikanäidete tuge;

- oma töökoormuse vähendamist, mitte professionaalse vastutuse asendamist.

Spetsialisti põhivoog

Spetsialist avab töölaua
→ näeb saabunud eelpöördumisi
→ avab struktureeritud eelinfo
→ otsustab järgmise tööalase sammu
→ küsib lisainfot / avab vestlusruumi / koostab vastuse / valmistab hindamist ette
→ kasutab teadmuspõhja, dokumente ja allikaid

Spetsialisti peamised tegevused

Spetsialist saab:

- vastu võtta eelpöördumisi;

- näha kasutaja kinnitatud eelinfot;

- näha, kas pöördumine on lühike märguanne, põhjalik eelkaardistus või juhendatud eelkaardistuse soov;

- näha teenusekatkemise riski märget;

- küsida lisainfot;

- avada vestlusruumi;

- teha juhendatud eelkaardistust;

- koostada memo;

- koostada vastuse mustandi;

- koostada inimesele lihtsas keeles selgituse;

- analüüsida dokumente;

- kasutada allikapõhist vastamist;

- algatada kovisiooni anonümiseeritud kujul;

- lisada või soovitada materjale teadmuspõhja.

Spetsialisti jaoks kõige tähtsam piir

SotsiaalAI aitab infot korrastada ja töömustandeid koostada, kuid spetsialist kontrollib, täiendab, kinnitab ja vastutab lõpliku kasutuse eest.

Spetsialisti vaate peamised moodulid

Spetsialisti töölaual võiks esiplaanil olla:

1. Pöördumiste vastuvõtt

1. Teekonnakaardid / juhtumite eelinfo

1. Vestlusruumid

1. Dokumendi koostamine

1. Dokumendi analüüs

1. Süvauuring

1. Teenusekaart

1. Kovisioon ja praktikanäited

1. Materjalide lisamine

1. Tööheaolu

Spetsialistile peaks allikate kuvamine olema palju detailsem kui pöördujale: allikatüüp, kuupäev, õiguslik/ametlik/metoodiline kaal, KOV seos ja vastuses toetatud väide.

16.4. Teenuseosutaja kogemus

Teenuseosutaja jaoks on SotsiaalAI peamine väärtus:

teenuse nähtavus + paremini ettevalmistatud pöördumised + võimalus tingimusi selgitada.

Teenuseosutaja ei ole alati otsustaja. Mõne teenuse puhul saab ta võtta inimesega otse ühendust, teise puhul saab ta ainult selgitada, et teenusele jõudmiseks on vaja KOV-i, arsti või muu pädeva osapoole otsust või suunamist.

Teenuseosutaja põhivoog

Teenuseosutaja haldab teenuseprofiili
→ kirjeldab teenuseid, sihtrühmi ja piirkonda
→ määrab, kas võtab eelpöördumisi vastu
→ saab teenusega seotud päringuid
→ vastab, küsib lisainfot või pakub vestlusruumi
→ vajadusel selgitab, kas vaja on KOV otsust/suunamist

Teenuseosutaja peamised tegevused

Teenuseosutaja saab:

- luua ja hallata teenuseprofiili;

- lisada teeninduskohti;

- kirjeldada teenuseid;

- määrata sihtrühmad ja piirkonnad;

- märkida ligipääsetavuse infot;

- määrata, kas võtab vastu eelpöördumisi;

- määrata, kas teenus vajab KOV otsust või suunamist;

- saada teenusega seotud pöördumisi;

- küsida lisainfot;

- selgitada teenuse tingimusi;

- avada või pakkuda vestlusruumi;

- märkida pöördumine mitteasjakohaseks;

- uuendada teenuse infot.

Teenuseosutaja jaoks kõige tähtsam piir

Teenuseosutaja ei tohiks saada rohkem sotsiaalset taustainfot kui teenuse tingimuste täpsustamiseks vajalik.

Kui inimene pöördub teenuseosutaja poole, ei pea teenuseosutaja automaatselt nägema kogu täisealise abivajaduse eelkaardistust. Talle võiks kuvada teenusega seotud eelinfo.

Teenuseosutaja vaate peamised moodulid

1. Teenuseprofiil ja haldus

1. Teenused ja teeninduskohad

1. Pöördumiste vastuvõtt

1. Vestlusruumid

1. Teenusekaart nähtavus

1. Dokumendid / lisamaterjalid

1. Materjalide lisamine teadmuspõhja ülevaatuseks

16.5. Administraatori / platvormi haldaja kogemus

Kuigi kasutajagruppe kirjeldades on põhirõhk pöördujal, spetsialistil ja teenuseosutajal, vajab platvorm ka haldusloogikat.

Administraator ei peaks tavapäraselt nägema inimeste privaatseid vestlusi või tundlikke teekondi. Admini roll peaks keskenduma süsteemi, sisu ja kvaliteedi haldamisele.

Administraator saab hallata

- teadmuspõhja allikaid;

- materjalide ülevaatust;

- KOV teenuse- ja kontaktinfo kontrolli;

- teenuseosutaja profiilide staatust;

- allikatüüpe ja staatusi;

- süsteemi logisid ja kvaliteedimõõdikuid;

- kustutus- ja säilitustöövooge;

- kasutajate ligipääsu rolle;

- väärkasutuse või tehniliste probleemide juhtumeid.

Administraatori piir

Administraator ei peaks saama tavapäraseks kasutamiseks avada privaatseid ruume, teekondi või vestlusi.

Kui süsteemi hoolduse või vaidluse tõttu on vaja midagi kontrollida, peab see olema eraldi, logitav ja põhjendatud töövoog.

16.6. Rollipõhine nähtavus

Sama info ei tohiks olla kõigile samamoodi nähtav.

| Info | Pöörduja | Spetsialist | Teenuseosutaja | Admin |
| --- | --- | --- | --- | --- |
| Privaatne assistendivestlus | näeb | ei näe | ei näe | ei näe tavakasutuses |
| Teekonnakaart | näeb enda oma | näeb ainult jagatud osa | näeb ainult teenusega seotud osa | ei näe tavakasutuses |
| Eelpöördumine | loob ja kinnitab | näeb saadetud eelinfot | näeb adresseeritud eelinfot | metaandmed/haldus |
| Eelkaardistus | täidab/kinnitab | näeb, kui jagatud | ainult vajalik osa | mitte tavakasutuses |
| Dokumendid | omanik näeb | näeb, kui jagatud | näeb, kui jagatud | mitte tavakasutuses |
| Vestlusruum | ruumiliikmena | ruumiliikmena | ruumiliikmena | mitte tavakasutuses |
| Teenuseprofiil | vaatab | vaatab/kasutab | haldab enda oma | kinnitab/haldab |
| Allikad | lihtsam vaade | detailne vaade | teenusega seotud vaade | haldusvaade |

16.7. Rollipõhised tööriistad

Pöörduja

Peamised tööriistad:

- privaatne assistent;

- teekonnakaart;

- eelpöördumine;

- eelkaardistus;

- teenusekaart;

- dokumendi koostamine;

- dokumendi analüüs;

- abisoovid ja abipakkumised;

- vestlusruumid.

Sotsiaaltöö spetsialist

Peamised tööriistad:

- assistent;

- pöördumiste vastuvõtt;

- teekonnakaart / eelinfo;

- dokumendi koostamine;

- dokumendi analüüs;

- süvauuring;

- teenusekaart;

- kovisioon;

- praktikanäited;

- tööheaolu;

- materjalide lisamine;

- vestlusruumid.

Teenuseosutaja

Peamised tööriistad:

- teenuseprofiil;

- teenuste ja teeninduskohtade haldus;

- pöördumiste vastuvõtt;

- vestlusruumid;

- teenusekaart nähtavus;

- dokumentide/materjalide lisamine;

- assistent teenusekirjelduse ja vastuste mustandite jaoks.

16.8. Rollipõhine teekonnakaart

Teekonnakaart ei pea kõigile samamoodi paistma.

Pöörduja teekonnakaart

Fookus:

- mis minu olukorras võib olla seotud;

- mis info on puudu;

- kelle poole võiks pöörduda;

- mida ma saan täna teha;

- mida ma jagan ja kellele.

Keel peab olema lihtne.

Näiteks:

Sinu järgmine võimalik samm: leia KOV kontakt ja koosta lühike eelpöördumine.

Spetsialisti teekonnakaart

Fookus:

- milline eelinfo on olemas;

- millised eluvaldkonnad on puudutatud;

- mis vajab täpsustamist;

- kas on teenusekatkemise risk;

- kas on dokumente;

- mis on võimalik tööalane järgmine samm;

- millised allikad võivad tausta anda.

Keel võib olla erialasem.

Näiteks:

Eelinfo viitab igapäevaelu toimingute ja füüsilise tervisega seotud toimetulekuraskustele. Vajab täpsustamist, kas olemas on varasem otsus või teenuseplaan.

Teenuseosutaja teekonnakaart

Fookus:

- millise teenusega pöördumine seostub;

- kas teenus võib sobida;

- kas teenusele jõudmine vajab otsust/suunamist;

- millist infot on vaja teenuse tingimuste selgitamiseks;

- kas avada ruum või anda juhis.

Näiteks:

Pöördumine puudutab teie teenuse tingimuste täpsustamist. Kasutaja soovib teada, kas teenusele jõudmiseks on vaja KOV otsust või muud suunamist.

16.9. Rollipõhised allikad

Allikate kuvamine peab rolliti erinema.

Pöördujale

Näita lihtsalt:

- ametlik info;

- KOV info;

- juhend;

- muutuv info;

- viimati kontrollitud.

Spetsialistile

Näita täpsemalt:

- allikatüüp;

- õiguslik/metoodiline kaal;

- paragrahv või dokumendiosa, kui võimalik;

- mida allikas toetas;

- kas info on kohalik või üldine;

- kas info on muutuv.

Teenuseosutajale

Näita:

- teenuseosutaja enda info;

- KOV või juhendi seos;

- kas teenus vajab otsust/suunamist;

- millist infot kasutati teenusekaardil.

16.10. Rollipõhine vastutus

SotsiaalAI peab igas rollis näitama vastutuse piiri.

Pöörduja

Pöörduja kinnitab:

- mida ta jagab;

- kellele ta saadab;

- kas lisab dokumendi;

- kas kutsub osapoole ruumi.

Spetsialist

Spetsialist kinnitab:

- kas kasutab AI mustandit;

- kas avab vestlusruumi;

- kas küsib lisainfot;

- kas info on piisav tööalaseks sammuks;

- kas alustab ametlikku hindamist või muud tööprotsessi.

Teenuseosutaja

Teenuseosutaja kinnitab:

- oma teenuseinfo;

- kas pöördumine kuulub tema teenuse alla;

- kas teenus vajab suunamist;

- kas ta saab pakkuda eelvestlust või lisainfot.

Administraator

Administraator vastutab:

- süsteemi, andmete ja allikate kvaliteediprotsessi eest;

- mitte konkreetse inimese abivajaduse otsustamise eest.

16.11. Rollipõhine töölaud

Praegune töölaud saab uues mudelis väga hästi jätkuda, aga selle loogika peaks muutuma teekonnakeskseks.

Pöörduja töölaud

Esiplaan:

- Alusta teekonda

- Minu pooleliolevad teekonnad

- Eelpöördumised

- Vestlusruumid

- Abisoovid ja abipakkumised

- Dokumendid

- Teenusekaart

Spetsialisti töölaud

Esiplaan:

- Saabunud pöördumised

- Vestlusruumid

- Dokumendi koostamine

- Dokumendi analüüs

- Teenusekaart

- Kovisioon

- Tööheaolu

- Materjalide lisamine

Teenuseosutaja töölaud

Esiplaan:

- Teenuseprofiil

- Teenused

- Saabunud pöördumised

- Vestlusruumid

- Teenusekaardi nähtavus

- Materjalid

16.12. Rollide üleminek ja mitmerollilisus

Ühel kasutajal võib olla mitu rolli.

Näiteks:

- sotsiaaltöötaja võib olla ka eraisikuna pöörduja;

- teenuseosutaja töötaja võib olla ka spetsialist;

- inimene võib olla pöörduja ja samal ajal lähedase abistaja;

- spetsialist võib osaleda kovisioonis kolleegina.

Seetõttu peab rollivahetus olema selge.

Platvorm peaks näitama:

“Sa kasutad praegu SotsiaalAI-d rollis: Pöörduja / Spetsialist / Teenuseosutaja.”

Oluline: rolli vahetamine ei tohiks automaatselt anda ligipääsu varasematele privaatsetele andmetele teises rollis, kui need ei ole seotud sama kasutaja õigustega.

16.13. Rollipõhine kutse ja vestlusruum

Sinu olemasolev kutse leht sobib siia hästi.

Vestlusruumi saab luua:

- käsitsi kutse lehelt;

- eelpöördumise järel;

- pöördumiste vastuvõtust;

- teekonnakaardilt;

- abisoovi ja abipakkumise matchist.

Kutsuja võib teatud juhtudel tasuda kutsutu ühe kuu ligipääsu eest.

Aga rolliti võiks eristada:

- lähedase või eraisiku kutsumisel on sponsorloogika loomulik;

- spetsialisti või teenuseosutaja puhul peaks põhiloogika olema nende rollipõhine konto või piiratud vastuvõtuvaade;

- KOV spetsialisti eest kuutasu maksmise sõnastus võib tunduda ebasobiv ja seda peaks vältima.

16.14. Rollipõhised ohukohad

Pöörduja puhul

Risk:

- kasutaja arvab, et AI on ametlik hindaja;

- kasutaja jagab liiga palju isikuandmeid;

- kasutaja saadab info valele osapoolele;

- kasutaja arvab, et soovitatud teenus on määratud.

Lahendus:

- selged piirid;

- privaatsuse eelkiht;

- kinnitusetapp enne saatmist;

- “võimalik järgmine samm” sõnastus.

Spetsialisti puhul

Risk:

- AI mustandit kasutatakse kontrollimata;

- allikaid ei kontrollita;

- eelinfot käsitletakse ametliku hindamisena;

- kliendiandmeid kasutatakse kovisioonis liiga tuvastatavalt.

Lahendus:

- mustandid märgitakse tööversiooniks;

- allikate paneel;

- anonümiseerimise tugi;

- ametliku hindamise piir.

Teenuseosutaja puhul

Risk:

- teenuseosutaja saab liiga laia taustainfot;

- kasutaja arvab, et teenuseosutaja saab teenuse määrata;

- teenuseinfo vananeb;

- teenuseosutaja profiil muutub reklaamiks, mitte kontrollitavaks infoks.

Lahendus:

- teenusega seotud eelinfo;

- ligipääsutee märgised;

- lastChecked;

- profiili ülevaatus ja selged andmeväljad.

16.15. MVP

Esimeses versioonis piisab rollipõhise kogemuse jaoks järgmisest.

Pöörduja

- privaatne vestlus;

- teekonnakaart;

- eelpöördumine;

- teenusekaart;

- dokumendid;

- vestlusruumid;

- abisoovid/abipakkumised.

Spetsialist

- pöördumiste vastuvõtt;

- eelinfo kaart;

- vastuse mustand;

- vestlusruum;

- dokumendi analüüs;

- teenusekaart;

- kovisioon;

- tööheaolu.

Teenuseosutaja

- teenuseprofiil;

- teenuste haldus;

- pöördumiste vastuvõtt;

- teenusega seotud eelinfo;

- vestlusruum;

- teenusekaardi nähtavus.

Läbivalt

- rolli kuvamine;

- jagamise kontroll;

- allikate kuvamine;

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine;

- audit olulistele tegevustele.

16.16. Platvormitekstid

Pöördujale

Kirjelda oma olukorda oma sõnadega. SotsiaalAI aitab sul mõista, millised järgmised sammud võivad olla asjakohased: kontaktide leidmine, eelpöördumine, dokumendi analüüs, abisoov või vestlusruum.

Spetsialistile

SotsiaalAI aitab struktureerida eelinfot, koostada kontrollitavaid töömustandeid ja leida allikapõhist tausta. Lõplik hindamine, otsus ja vastutus jäävad spetsialistile.

Teenuseosutajale

SotsiaalAI aitab muuta teenused leitavamaks ja võtta vastu paremini ettevalmistatud pöördumisi. Teenuseosutaja saab selgitada teenuse tingimusi, kättesaadavust ja vajadusel suunamise või otsuse nõuet.

16.17. Kokkuvõte

Rollipõhine uus kogemus tähendab, et SotsiaalAI ei näita kõigile sama platvormi.

Pöördujale on see:

teekond selguse ja järgmise sammuni.

Spetsialistile on see:

eelinfo, allikate ja töömustandite töövahend.

Teenuseosutajale on see:

teenuse nähtavuse ja struktureeritud pöördumiste kanal.

Kõige olulisem põhimõte:

sama teekond võib ühendada mitu rolli, aga iga roll näeb ainult seda infot, mida tal on vaja ja mida kasutaja on kinnitanud jagada.

# 17. Pakettide tabeli mõju

Uue teekonnakeskse loogika tõttu peaks SotsiaalAI pakettide tabel muutuma veidi teisiti üles ehitatuks. Praegu võib tabel jätta mulje, et platvorm koosneb eraldi funktsioonidest: teenusekaart, dokumendid, vestlusruumid, süvauuring jne.

Uues mudelis peaks tabel näitama, et SotsiaalAI põhiväärtus on:

olukorra kirjeldamine → teekonnakaart → sobiv järgmine samm → vajadusel eelpöördumine, teenusekaart, dokument, analüüs või koostööruum.

Ehk pakettide tabel ei peaks olema lihtsalt “kas funktsioon on olemas või ei ole”, vaid peaks näitama, kui sügavalt kasutaja saab teekonnaga töötada.

17.1. Põhimõte

Pakettide tabelis tuleb eristada kahte tüüpi asju:

1. Kasutajale nähtavad funktsioonid

Need sobivad tabeli ridadeks.

Näiteks:

- teekonnakaart;

- eelpöördumine;

- eelkaardistus;

- teenusekaart;

- abisoovid ja abipakkumised;

- vestlusruumid;

- dokumendi koostamine;

- dokumendi analüüs;

- süvauuring;

- pöördumiste vastuvõtt;

- teenuseprofiil;

- kovisioon;

- tööheaolu.

2. Läbivad usalduskihid

Need ei peaks olema tavalised paketiread, sest need ei ole “lisafunktsioonid”, mida mõnel kasutajal on ja mõnel mitte.

Need peaksid olema platvormi üldised kaitsekihid:

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine;

- allikate kuvamine;

- rollipõhine ligipääs;

- nõusolekupõhine jagamine;

- privaatse assistendivestluse ja jagatud ruumi eristus;

- kinnitusetapp enne info saatmist.

Need võiks panna tabeli alla eraldi plokina:

Kõiki pakette toetavad läbivad usalduskihid.

17.2. Tabeli uus peamine loogika

Tabeli keskne küsimus ei peaks olema:

“Millised tööriistad paketis on?”

vaid:

“Millise rolli teekonda see pakett toetab?”

Seega võiks paketid jääda rollipõhiseks:

1. Tasuta

1. Pöördujale

1. Spetsialistile

1. Teenuseosutajale

Aga read tuleks sõnastada teekonnaloogika järgi.

17.3. Soovitatavad paketiread

1. Teekonnakaart

See peaks olema uus nähtav rida.

Võimalik sõnastus:

Teekonnakaart
Aitab kasutaja olukorra põhjal näha seotud teemasid, puuduolevat infot, võimalikke kontakte ja järgmisi samme.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Piiratud / esmane teekonnakaart |
| Pöördujale | Täielikum isiklik teekonnakaart |
| Spetsialistile | Juhtumi/eelinfo teekonnakaart tööks |
| Teenuseosutajale | Teenusega seotud pöördumiste teekonnavaade |

Siin on oluline, et tasuta kasutaja saaks vähemalt aru, kuhu liikuda. Aga põhjalikum salvestamine, mitme teekonna haldus ja detailsem eelkaardistus võivad olla tasulises paketis.

2. Esmane teekonnasõel

Seda ei pruugi eraldi tabelireaks panna. Kui paned, siis väga lihtsalt.

Võimalik sõnastus:

Esmane teekonnasõel
Assistendi esmane analüüs, mis aitab mõista, kas järgmine samm võiks olla KOV kontakt, teenuseosutaja, tervisekontakt, eelpöördumine, dokument või abisoov.

Aga tabeli lihtsuse huvides võiks see olla teekonnakaardi kirjelduse sees, mitte eraldi rida.

3. Eelpöördumine

See peaks kindlasti jääma tabelisse.

Uus sõnastus:

Eelpöördumine
Aitab koostada valitud kontaktile jagatava eelinfo või pöördumise mustandi. Kasutaja kinnitab enne saatmist kogu jagatava sisu.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Lühike märguanne või piiratud eelpöördumine |
| Pöördujale | Lühike ja põhjalikum eelpöördumine |
| Spetsialistile | Pöördumiste koostamine, vastuvõtt ja töömustandid |
| Teenuseosutajale | Teenusega seotud eelpöördumiste vastuvõtt |

Tasuta paketis võiks eelpöördumine olla piiratud, sest see on sotsiaalse mõju mõttes oluline. Inimene peab saama endast vähemalt märku anda.

4. Eelkaardistus spetsialistile

See võiks olla eraldi rida või eelpöördumise alamkirjeldus.

Kui tabelis on ruumi, paneksin eraldi.

Sõnastus:

Eelkaardistus spetsialistile
Küsimustik või eelinfo kaart, mis aitab olukorda eluvaldkondade kaupa kirjeldada. Ei ole ametlik hindamine ega teenuseotsus.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Lühike eelinfo |
| Pöördujale | Lühem ja põhjalikum eelkaardistus |
| Spetsialistile | Eelinfo vastuvõtt ja kasutamine töömustandites |
| Teenuseosutajale | Teenusega seotud eelinfo, mitte kogu lai hindamisloogika |

Siin tuleb vältida muljet, et pöörduja “hindab ennast ametlikult ära”.

5. Juhendatud eelkaardistus

See võiks olla tabelis nähtav, sest see on tugev eristuv funktsioon.

Sõnastus:

Juhendatud eelkaardistus
Võimalus märkida, et kasutaja soovib küsimustikku või olukorda täpsustada koos spetsialisti või vastuvõtjaga.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Võimalus märkida soov |
| Pöördujale | Saab saata juhendatud eelkaardistuse soovi |
| Spetsialistile | Saab juhendatud eelkaardistust vastu võtta ja ruumis läbi viia |
| Teenuseosutajale | Saab teenusega seotud täpsustust vastu võtta |

See rida aitab näidata, et SotsiaalAI ei eelda, et inimene peab pikka vormi üksi täitma.

6. Teenusekaart

Teenusekaart peaks jääma üheks põhifunktsiooniks.

Uus sõnastus:

Teenusekaart
Aitab leida KOV sotsiaalvaldkonna kontakte, KOV teenuseid, sotsiaalvaldkonna teenuseosutajaid ja vajadusel esmaseid tervisekontakte. Kuvab ka teenuseni jõudmise esmase loogika.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Põhiotsing ja avalikud kontaktid |
| Pöördujale | Teekonnakaardiga seotud eelfiltrid ja salvestamine |
| Spetsialistile | Laiendatud allikad, KOV/teenuse loogika, tööseosed |
| Teenuseosutajale | Oma profiili ja teenuste nähtavus |

Oluline: tervisekontaktide kiht tuleb kirjeldada ettevaatlikult. Mitte “tervishoiuteenused”, vaid esmased tervisekontaktid teekonna toetamiseks.

7. Teenuseni jõudmise info

See võib olla eraldi rida, sest see on suur uus väärtus.

Sõnastus:

Teenuseni jõudmise info
Näitab, kas teenuse puhul on esimene samm otsekontakt, KOV hindamine, KOV otsus, tervisekontakt, suunamine või tingimuste täpsustamine.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Põhiinfo |
| Pöördujale | Teekonnaga seotud selgitus |
| Spetsialistile | Detailsem allikapõhine ligipääsuloogika |
| Teenuseosutajale | Teenuse ligipääsutingimuste haldus |

See on hea eristaja tavalisest kaardirakendusest.

8. Pöördumiste vastuvõtt

See on peamiselt spetsialisti ja teenuseosutaja funktsioon.

Sõnastus:

Pöördumiste vastuvõtt
Töövaade kasutaja kinnitatud eelpöördumiste, eelinfo kaartide ja juhendatud eelkaardistuse soovide vastuvõtmiseks.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Ei |
| Pöördujale | Saab saata pöördumisi |
| Spetsialistile | Saab vastu võtta ja töödelda |
| Teenuseosutajale | Saab vastu võtta teenusega seotud pöördumisi |

Pöörduja paketis ei ole “vastuvõtt”, vaid “saatmine”. Seda tuleks tabelis eristada.

9. Vestlus- ja koostööruumid

See peab jääma tabelisse, aga kirjeldus tuleks täpsustada.

Sõnastus:

Vestlus- ja koostööruumid
Jagatud ruumid valitud osapooltega suhtlemiseks, dokumentide jagamiseks, eelinfo täpsustamiseks ja järgmiste sammude kokkuleppimiseks.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Abisoovi/abipakkumise matchi ruumid või piiratud kutse |
| Pöördujale | Ruumid valitud osapooltega, kutse võimalus |
| Spetsialistile | Ruumid pöördumiste, juhendatud eelkaardistuse ja koostöö jaoks |
| Teenuseosutajale | Ruumid teenusega seotud suhtluseks |

Sinu olemasolev “kutsuja saab maksta kutsutu ühe kuu eest” võiks olla eraldi märkus, mitte tabeli põhirida.

Näiteks tabeli all:

Vestlusruumi kutse puhul võib kutsuja teatud juhtudel tasuda kutsutu ühe kuu ligipääsu eest. Ametlike spetsialistide ja teenuseosutajate puhul kasutatakse rollipõhist ligipääsu või piiratud vastuvõtuvaadet.

10. Dokumendi koostamine

See jääb selgelt tabelisse.

Uus sõnastus:

Dokumendi koostamine
Kirjade, taotluste, kokkuvõtete, pöördumiste, memode ja töömustandite koostamine kasutaja juhiste, mallide ja kinnitatud info põhjal.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Piiratud või mitte |
| Pöördujale | Kirjad, taotlused, pöördumised |
| Spetsialistile | Töömustandid, memod, vastused, juhtumikokkuvõtted |
| Teenuseosutajale | Teenusevastused, profiilitekstid, selgitused |

11. Dokumendi analüüs

See jääb samuti tabelisse.

Sõnastus:

Dokumendi analüüs
Aitab mõista otsuseid, plaane, juhendeid, kirju ja muid dokumente ning koostada nende põhjal küsimusi või kokkuvõtteid.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Piiratud või proovikasutus |
| Pöördujale | Oma dokumentide mõistmine |
| Spetsialistile | Tööfailide ja juhtumidokumentide analüüs |
| Teenuseosutajale | Teenuse- ja pöördumisdokumentide analüüs |

12. Süvauuring

Süvauuring võiks olla pigem spetsialisti ja võib-olla teenuseosutaja kõrgema väärtusega funktsioon.

Sõnastus:

Süvauuring
Põhjalikum allikapõhine ülevaade teenusest, seadusest, juhendist, praktikast või muutuvast valdkondlikust teemast.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Ei või väga piiratud |
| Pöördujale | Piiratud |
| Spetsialistile | Jah |
| Teenuseosutajale | Jah, teenuse ja valdkonna info jaoks |

13. Abisoovid ja abipakkumised

See peaks tabelis olema, aga mitte segada teenusekaardiga.

Sõnastus:

Abisoovid ja abipakkumised
Kuulutuste ja sobitamise töövoog praktilise või kogukondliku abi leidmiseks ja pakkumiseks.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Jah |
| Pöördujale | Jah |
| Spetsialistile | Võib näha või toetada, kui töövoog lubab |
| Teenuseosutajale | Pigem mitte põhifookus |

See võiks olla tasuta paketis tugev element, sest see toetab platvormi sotsiaalset eesmärki.

14. Teenuseprofiil ja haldus

See on teenuseosutaja põhirida.

Sõnastus:

Teenuseprofiil ja haldus
Teenuseosutaja saab kirjeldada organisatsiooni, teenuseid, sihtrühmi, piirkonda, teeninduskohti, ligipääsetavust ja eelpöördumise vastuvõttu.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Ei või avaliku info vaatamine |
| Pöördujale | Saab vaadata profiile |
| Spetsialistile | Saab kasutada teenusekaardil tööks |
| Teenuseosutajale | Saab hallata oma profiili |

15. Kovisioon ja praktikanäited

See on spetsialisti funktsioon.

Sõnastus:

Kovisioon ja praktikanäited
Anonümiseeritud juhtumiarutelud, kolleegide kaasamine ja üldistatud praktikanäidete loomine teadmuspõhja täiendamiseks.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Ei |
| Pöördujale | Ei |
| Spetsialistile | Jah |
| Teenuseosutajale | Võib-olla hiljem, kui roll sobib |

16. Tööheaolu

See jääb spetsialisti funktsiooniks.

Sõnastus:

Tööheaolu tööriistad
Kiirkontrollid, töökoormuse ja emotsionaalse koormuse märkamine, taastumise ja tööpiiride järgmised sammud.

Paketiti:

| Pakett | Soovitus |
| --- | --- |
| Tasuta | Ei |
| Pöördujale | Ei |
| Spetsialistile | Jah |
| Teenuseosutajale | Võib-olla organisatsioonilise lisana, aga mitte põhifookus |

17.4. Soovitatav tabeli struktuur

Ma ei paneks tabelisse 30 rida. See muutuks raskeks.

Tabel võiks olla jagatud plokkideks.

Plokk 1: Teekond ja pöördumine

- Teekonnakaart

- Eelpöördumine

- Eelkaardistus spetsialistile

- Juhendatud eelkaardistus

- Teenusekatkemise kontroll

Plokk 2: Kontaktid ja teenused

- Teenusekaart

- Teenuseni jõudmise info

- Teenuseprofiil ja haldus

- Pöördumiste vastuvõtt

Plokk 3: Suhtlus ja koostöö

- Vestlus- ja koostööruumid

- Kutse ja sponsoreeritud ligipääs

- Abisoovid ja abipakkumised

Plokk 4: Dokumendid ja teadmised

- Dokumendi koostamine

- Dokumendi analüüs

- Süvauuring

- Dokumendid: hoidla ja haldus

- Materjalide lisamine

Plokk 5: Spetsialisti tööriistad

- Kovisioon ja praktikanäited

- Tööheaolu

Tabeli all eraldi:

Läbivad usalduskihid

- privaatsuse eelkontroll;

- kriisi- ja ohusuunamine;

- allikate kuvamine;

- rollipõhine ligipääs;

- kasutaja kinnitus enne jagamist;

- helikõne ja transkriptsiooni nõusolek;

- privaatse vestluse ja jagatud ruumi eristus.

17.5. Võimalik lihtsustatud pakettide tabel

Umbes selline loogika:

| Võimalus | Tasuta | Pöördujale | Spetsialistile | Teenuseosutajale |
| --- | --- | --- | --- | --- |
| Teekonnakaart | Esmane | Jah | Töövaade | Teenusega seotud |
| Eelpöördumine | Lühike | Jah | Vastuvõtt + mustandid | Teenusega seotud vastuvõtt |
| Eelkaardistus | Piiratud | Jah | Eelinfo tööks | Piiratud teenuseinfo |
| Juhendatud eelkaardistus | Soovi märkimine | Jah | Saab läbi viia | Saab pakkuda teenuse piires |
| Teenusekatkemise kontroll | Esmane | Jah | Riskimärge vastuvõtus | Teenuseinfo täpsustus |
| Teenusekaart | Avalik vaade | Teekonnaga seotud | Laiendatud töövaade | Profiili nähtavus |
| Teenuseni jõudmise info | Põhiinfo | Jah | Allikapõhine | Oma teenuste haldus |
| Vestlusruumid | Piiratud / match | Jah | Jah | Jah |
| Abisoovid ja abipakkumised | Jah | Jah | Võib toetada | Ei / piiratud |
| Dokumendi koostamine | Piiratud | Jah | Laiendatud | Jah |
| Dokumendi analüüs | Piiratud | Jah | Laiendatud | Jah |
| Süvauuring | Ei / piiratud | Piiratud | Jah | Jah |
| Pöördumiste vastuvõtt | Ei | Ei | Jah | Jah |
| Teenuseprofiil | Ei | Vaata | Vaata | Halda |
| Kovisioon | Ei | Ei | Jah | Ei / hiljem |
| Tööheaolu | Ei | Ei | Jah | Võimalik hiljem |

Siin saab “Jah / Piiratud / Laiendatud / Halda / Vastuvõtt” süsteemi kasutada palju paremini kui lihtsalt linnukesi.

17.6. Mida mitte panna tabelisse tavareana?

Ma ei paneks tavareaks:

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine;

- allikate kuvamine;

- kasutaja kinnitused;

- rollipõhine ligipääs;

- nõusolekupõhine transkriptsioon;

- privaatse vestluse kaitse.

Need peavad olema kõigis asjakohastes pakettides, sest need on usalduse ja ohutuse miinimum, mitte lisatasu funktsioon.

Neid võib esitada tabeli all sellise plokina:

Kõiki töövooge toetavad privaatsuse eelkontroll, kriisi- ja ohusuunamine, allikate kuvamine, rollipõhine ligipääs ning kasutaja kinnitus enne info jagamist.

17.7. Tasuta paketi soovitus

Tasuta pakett võiks jääda sotsiaalse mõjuga, aga piiratud.

Tasuta võiks sisaldada:

- esmane vestlus assistendiga;

- esmane teekonnakaart;

- teenusekaardi avalik vaade;

- lühike märguanne / piiratud eelpöördumine;

- abisoovid ja abipakkumised;

- matchi põhine vestlusruum;

- piiratud dokumendi või kirjamustandi abi, kui soovid.

Tasuta paketi põhisõnum:

Saad kirjeldada olukorda, leida esmase suuna ja anda endast märku.

17.8. Pöörduja paketi soovitus

Pöörduja pakett peaks andma rohkem sügavust.

Sisaldab:

- salvestatavad teekonnad;

- põhjalikum eelpöördumine;

- lühem ja põhjalikum eelkaardistus;

- juhendatud eelkaardistuse soov;

- teenusekatkemise kontroll;

- teenusekaart teekonna kontekstis;

- dokumendi koostamine;

- dokumendi analüüs;

- vestlusruumid;

- dokumendid ja mustandid.

Põhisõnum:

Pöörduja pakett aitab sul oma olukorda selgemalt kirjeldada, leida sobiv kontakt ja koostada vajalikud pöördumised või dokumendid.

17.9. Spetsialisti paketi soovitus

Spetsialisti pakett on kõige tugevam töövahend.

Sisaldab:

- saabunud pöördumiste vastuvõtt;

- eelinfo töövaade;

- juhendatud eelkaardistus;

- vestlusruumid;

- dokumendi koostamine;

- dokumendi analüüs;

- süvauuring;

- allikapõhine teenusekaart;

- kovisioon;

- praktikanäited;

- tööheaolu;

- materjalide lisamine;

- juhtumikokkuvõtted ja memo mustandid.

Põhisõnum:

Spetsialisti pakett aitab leida usaldusväärset infot kiiremini, mõtestada juhtumeid ja koostada kontrollitavaid töömustandeid. Lõpliku otsuse ja vastutuse säilitab spetsialist.

See sobib hästi sinu uuringutulemusega: spetsialistid ei taha “täisautomaatset lõppdokumenti”, vaid kontrollitavat mustandit.

17.10. Teenuseosutaja paketi soovitus

Teenuseosutaja pakett peaks keskenduma nähtavusele ja struktureeritud pöördumistele.

Sisaldab:

- teenuseprofiil;

- teenuste ja teeninduskohtade haldus;

- teenusekaardi nähtavus;

- eelpöördumiste vastuvõtt;

- teenusega seotud eelinfo;

- teenuse ligipääsutingimuste kirjeldamine;

- vestlusruumid;

- vastusemustandid;

- materjalide lisamine ülevaatuseks.

Põhisõnum:

Teenuseosutaja pakett aitab muuta teenused leitavaks ja võtta vastu paremini ettevalmistatud pöördumisi.

17.11. Pakettide tabeli sõnastusriskid

Vältida tasub selliseid sõnu:

- “AI hindab abivajaduse”

- “teenusele suunamine”

- “teenuse määramine”

- “ametlik hindamine”

- “garanteeritud vastus”

- “KOV otsus AI abil”

- “tervishoiunõustamine”

Paremad sõnad:

- teekonnakaart;

- esmane teekonnasõel;

- eelpöördumine;

- eelinfo spetsialistile;

- eelkaardistus;

- teenuseni jõudmise info;

- töömustand;

- kontrollitav kokkuvõte;

- võimalik järgmine samm;

- allikapõhine selgitus.

17.12. Avalehe / hinnalehe lühisõnum

Pakettide tabeli juurde võiks panna sellise sissejuhatuse:

SotsiaalAI aitab liikuda olukorra kirjeldusest järgmise praktilise sammuni. Kasutaja saab alustada privaatsest vestlusest, luua teekonnakaardi, leida sobiva kontakti, koostada eelpöördumise või dokumendi ning vajadusel jätkata jagatud vestlusruumis. Spetsialistidele ja teenuseosutajatele lisanduvad töövaated pöördumiste vastuvõtuks, eelinfo kasutamiseks, teenuste haldamiseks ja kontrollitavate töömustandite koostamiseks.

17.13. Kokkuvõte

Pakettide tabeli uus loogika peaks näitama, et SotsiaalAI ei ole lihtsalt tööriistade kogum.

See on rollipõhine teekonnaplatvorm:

- Tasuta: esmane suund, teenusekaart, abisoovid ja lühike märguanne.

- Pöördujale: isiklik teekond, eelpöördumine, dokumendid, analüüs ja ruumid.

- Spetsialistile: pöördumiste vastuvõtt, töömustandid, allikad, kovisioon ja tööheaolu.

- Teenuseosutajale: teenuseprofiil, nähtavus, pöördumiste vastuvõtt ja teenusega seotud suhtlus.

Kõige olulisem põhimõte:

Tabelis tuleb müüa mitte üksikuid nuppe, vaid kasutajateekonda: inimene saab endast märku anda, spetsialist saab parema eelinfo ja teenuseosutaja saab paremini ettevalmistatud pöördumisi.

# 18. Arendusjärjekord

Arendusjärjekord peaks lähtuma ühest põhimõttest:

ära ehita kõike korraga uueks, vaid seo olemasolevad funktsioonid teekonnakaardi ümber ja lisa uus loogika järk-järgult.

SotsiaalAI-l on juba olemas mitu olulist tükki: privaatne vestlus, töölaud, eelpöördumine, teenusekaart, dokumendid, dokumendi analüüs, vestlusruumid, abisoovid/abipakkumised, pöördumiste vastuvõtt, teenuseprofiil, teadmuspõhi, privaatsuse eelkiht ja kriisisuunamine. Seega arendus ei peaks algama nullist, vaid uue teekonnakihi lisamisest olemasolevate funktsioonide kohale.

18.1. Arenduse üldine loogika

Arendus võiks liikuda nii:

1. Teekonnakaardi alusmudel
→ 2. Assistendi esmane teekonnasõel
→ 3. Teekonnakaardi UI
→ 4. Teenusekaardi sidumine teekonnaga
→ 5. Eelpöördumise sidumine teekonnaga
→ 6. Pöördumiste vastuvõtu täiendamine
→ 7. Vestlusruumi sidumine eelpöördumise ja vastuvõtuga
→ 8. Teenusekatkemise kontroll
→ 9. Allikate ja teadmuspõhja staatuste täpsustamine
→ 10. Pakettide/töölaua uus esitlus

Kõige tähtsam on mitte alustada kohe suure “kõik rollid, kõik teenused, kõik kontaktid” süsteemiga. Esimene töötav versioon võiks olla kitsas, aga terviklik:

kasutaja kirjeldab olukorda → tekib teekonnakaart → sealt saab avada teenusekaardi või eelpöördumise → vajadusel saata eelinfo → vastuvõtja näeb struktureeritud infot.

18.2. Etapp 0: kontseptsiooni lukustamine

Enne koodi võiks lukustada mõned nimetused ja piirid.

Otsustada nimetused

Soovitaksin kasutada neid termineid:

- Esmane teekonnasõel – AI analüüs kasutaja kirjelduse põhjal.

- Teekonnakaart – kasutajale nähtav struktureeritud ülevaade.

- Eelpöördumine – valitud kontaktile saadetav pöördumise töövoog.

- Eelkaardistus – spetsialistile esitatav struktureeritud eelinfo.

- Juhendatud eelkaardistus – soov täita küsimustik koos spetsialistiga.

- Teenusekatkemise kontroll – risk, et senine teenus/tugi katkeb.

- Teenusekaart – KOV, teenuseosutajate ja piiratud tervisekontaktide kaart.

- Koostööruum – vestlusruumi uus sisuline nimetus töövoos.

Otsustada põhipiirid

Need peaksid olema arenduse alusreeglid:

- SotsiaalAI ei tee ametlikku hindamist.

- Teekonnakaart ei ole teenuseotsus.

- Eelpöördumine on eelinfo, mitte ametlik menetlus.

- Privaatset assistendivestlust ei jagata automaatselt.

- Osapool näeb ainult kasutaja kinnitatud infot.

- Teenusekaart ei määra teenust, vaid näitab võimalikku pöördumisteed.

- Tervisekontaktid on ainult kitsas esmatasandi kiht, mitte terviseplatvorm.

18.3. Etapp 1: teekonnakaardi andmemudel

See on esimene päris tehniline alus.

Vaja on luua uus objekt: JourneyMap või Journey.

Esmane mudel

{
"id": "journey_001",
"ownerUserId": "user_001",
"roleContext": "CLIENT",
"status": "PRIVATE",
"title": "Koduse toimetuleku mure",
"summary": "Kasutaja kirjeldab raskusi igapäevase toimetulekuga kodus.",
"primaryPath": "SOCIAL",
"secondaryPaths": ["KOV_SOCIAL_SERVICES", "HEALTH_CONTACT"],
"domains": ["DAILY_LIVING", "PHYSICAL_HEALTH", "HOME_SUPPORT"],
"riskSignals": [],
"missingInfo": ["municipality", "existingDecisionOrPlan"],
"suggestedActions": [
"OPEN_SERVICE_MAP",
"CREATE_PRECONTACT",
"ANALYZE_DOCUMENT"
],
"sharingStatus": "NOT_SHARED",
"createdAt": "2026-05-25T12:00:00Z",
"updatedAt": "2026-05-25T12:00:00Z"
}

MVP väljad

Esimeses versioonis piisab:

- ownerUserId

- status

- title

- summary

- primaryPath

- domains

- riskSignals

- missingInfo

- suggestedActions

- sharingStatus

Hiljem saab lisada:

- osapooled;

- seosed dokumentidega;

- seosed eelpöördumisega;

- teenusekaardi kirjed;

- allikad;

- vestlusruumi seosed.

18.4. Etapp 2: assistendi esmane teekonnasõel

Järgmine samm on muuta privaatse assistendi algusloogikat.

Praegu kasutaja vestleb assistendiga. Uues mudelis peab assistent suutma kasutaja esimesest kirjeldusest luua esmase teekonnasõela.

Sõel peab tuvastama

- kas mure on sotsiaalvaldkonna küsimus;

- kas võib olla tervisekontakti teema;

- kas võib olla teenusekatkemise risk;

- kas vaja on KOV kontakti;

- kas vaja on teenuseosutajat;

- kas vaja on dokumendi analüüsi;

- kas sobib abisoov/abipakkumine;

- kas on kriisi- või ohusignaal;

- milline info on puudu.

Esmane väljund

Näiteks:

{
"primaryPath": "COMBINED",
"domains": ["DAILY_LIVING", "PHYSICAL_HEALTH", "KOV_SOCIAL_SERVICES"],
"riskSignals": ["SERVICE_CONTINUITY_NEEDS_CHECK"],
"missingInfo": ["municipality", "serviceEndDate"],
"suggestedActions": [
"OPEN_SERVICE_MAP",
"CREATE_SERVICE_CONTINUITY_PRECONTACT",
"ADD_DOCUMENT_FOR_ANALYSIS"
]
}

Oluline

See ei pea alguses olema täiuslik. Pigem piisab sellest, et AI suudab anda esimese struktureeritud kaardi, mida kasutaja saab muuta.

18.5. Etapp 3: teekonnakaardi kasutajaliides

Kui andmemudel ja sõel on olemas, tuleb teha lihtne UI.

Esimene versioon

Teekonnakaart võiks olla vestluse kõrval või vestluse sees kaartidena:

Olukorra kokkuvõte
Lühike kasutaja kinnitatav kokkuvõte.

Seotud teemad
Näiteks: kodune toimetulek, KOV teenused, tervisekontakt.

Puuduv info
Näiteks: KOV, teenuse lõppkuupäev, olemasolev otsus.

Võimalikud järgmised sammud
Nupud:

- Ava teenusekaart

- Koosta eelpöördumine

- Lisa dokument analüüsiks

- Loo abisoov

- Salvesta teekond

Privaatsuse tekst
“See teekonnakaart on privaatne. Seda ei jagata enne, kui sa ise kinnitad jagatava info.”

MVP eesmärk

Kasutaja peab aru saama:

- mida AI tema kirjeldusest mõistis;

- mida on veel vaja täpsustada;

- mida ta saab edasi teha;

- et midagi pole veel jagatud.

18.6. Etapp 4: teenusekaardi sidumine teekonnakaardiga

Kui teekonnakaart soovitab teenusekaarti, ei peaks kaart avanema tühjana.

Teekonnakaardilt teenusekaardile kaasa anda

- piirkond, kui teada;

- valdkond;

- sihtrühm;

- kas otsitakse KOV kontakti;

- kas otsitakse teenuseosutajat;

- kas võib vaja olla tervisekontakti;

- kas tegemist on teenusekatkemise riskiga.

Teenusekaardi MVP täiendused

Lisada igale kirjele:

- entryType: KOV kontakt / KOV teenus / teenuseosutaja / tervisekontakt;

- accessType: otsekontakt / KOV hindamine / KOV otsus / tervisekontakt / vajab suunamist / kontrolli tingimusi;

- firstStep;

- lastChecked;

- sourceType;

- nupp Lisa teekonnale;

- nupp Koosta eelpöördumine või Küsi tingimusi.

Mitte teha esimeses versioonis

- ära lisa haiglate üldkaarti;

- ära lisa hariduse ja Töötukassa kihti;

- ära tee terviseplatvormi;

- ära tee liiga laia teenuseklassifikaatorit.

18.7. Etapp 5: eelpöördumise sidumine teekonnakaardiga

Eelpöördumine peab saama sisendi teekonnakaardilt.

Eelpöördumise MVP

Tüübid:

- lühike märguanne;

- lühike eelpöördumine;

- lühem küsimustik;

- põhjalikum eelkaardistus;

- teenuse jätkumise pöördumine;

- juhendatud eelkaardistuse soov.

Täitmise viisid:

- täidan ise;

- soovin täita koos spetsialistiga;

- soovin vestlusruumis suhelda;

- soovin helivestlust võimalusel;

- soovin kohtumist kohapeal.

Eelpöördumise sisend

Võtta teekonnakaardilt:

- olukorra kokkuvõte;

- seotud teemad;

- puuduolev info;

- valitud kontakt;

- teenusekatkemise risk;

- kasutaja soovitud järgmine samm.

Oluline UI

Enne saatmist peab olema eelvaade:

“Seda näeb vastuvõtja.”

Kasutaja saab muuta, eemaldada ja kinnitada.

18.8. Etapp 6: pöördumiste vastuvõtu täiendamine

Kui eelpöördumine on saadetud, peab vastuvõtja nägema struktureeritud kaarti, mitte lihtsalt teksti.

Vastuvõtja näeb

- pöördumise tüüpi;

- kaardistuse taset;

- täitmise viisi;

- peamist muret;

- kasutaja soovi;

- seotud eluvaldkondi;

- teenusekatkemise riski;

- puuduolevat infot;

- lisatud dokumente;

- eelistatud suhtlusviisi.

Vastuvõtja tegevused

- võta vastu;

- küsi lisainfot;

- ava või paku vestlusruumi;

- paku kohtumist;

- märgi mitteasjakohaseks;

- sulge.

KOV ja teenuseosutaja vaate erinevus

KOV spetsialist võib näha laiemat eelinfot.
Teenuseosutaja peaks nägema pigem teenusega seotud eelinfot.

See tuleb andmemudelis ja UI-s kohe arvesse võtta, muidu tekib privaatsusrisk.

18.9. Etapp 7: vestlusruumide ühendamine uue loogikaga

Vestlusruumide süsteem on juba olemas. Seda ei peaks dubleerima.

Säilitada olemasolev

- eraldi kutse leht;

- võimalus kutsuda inimene ruumi;

- võimalus teatud juhtudel tasuda kutsutu ühe kuu ligipääsu eest;

- abisoovi/abipakkumise matchist tekkiv ruum.

Lisada uued käivitajad

Vestlusruum peab saama tekkida ka:

- eelpöördumise järel;

- pöördumiste vastuvõtust;

- teekonnakaardilt valitud osapoolega;

- juhendatud eelkaardistuse soovist.

Üks ruumi süsteem

Tehniliselt peaks olema üks Room, aga erineva roomType väärtusega:

{
"roomType": "MANUAL_INVITE | PRECONTACT | GUIDED_MAPPING | HELP_MATCH | SERVICE_INTAKE | COVISION",
"sourceId": "pre_001",
"createdFrom": "INTAKE"
}

Tasumise loogika

Sponsoreeritud ühe kuu ligipääs sobib:

- lähedasele;

- eraisikule;

- abistajale;

- kutsutud pöördujale.

Ametliku spetsialisti või teenuseosutaja puhul peaks põhiloogika olema:

- rollipõhine konto;

- organisatsiooni ligipääs;

- piiratud vastuvõtuvaade.

18.10. Etapp 8: teenusekatkemise kontroll

Teenusekatkemise kontroll võiks tulla pärast põhiteekonda, sest see kasutab juba teekonnakaarti, eelpöördumist, teenusekaarti ja dokumente.

MVP

Kui kasutaja kirjeldab teenuse lõppemist või katkestust, tekib teekonnakaardile märge:

Teenuse jätkumine vajab kontrollimist.

Küsida kolm asja:

1. Mis teenus on lõppemas?

1. Millal lõpeb?

1. Kas on olemas otsus, plaan või kiri?

Seejärel pakkuda:

- lisa dokument analüüsiks;

- koosta teenuse jätkumise eelpöördumine;

- leia KOV kontakt;

- küsi teenuseosutajalt tingimusi.

Vastuvõtja vaates

Pöördumiste vastuvõtus kuvatakse märgis:

Teenusekatkemise risk

See ei ole lõplik hinnang, vaid tähelepanumärge.

18.11. Etapp 9: teadmuspõhja ja allikate täiendamine

See võib alata paralleelselt, aga mitte plahvatuslikult.

Esimene teadmuskihi täiendus

Lisada allikatele:

- sourceType;

- sourceStatus;

- lastChecked;

- authorityLevel;

- supports.

Teenusekirjetele:

- serviceType;

- organizer;

- accessType;

- firstStep;

- decisionBy;

- requiresAssessment;

- requiresDecision.

Prioriteetsed allikad

Alustada nendest:

- SKA KOV üldjuhend;

- täisealise abi- ja toetusvajaduse hindamise juhend;

- koduteenuse juhend;

- sotsiaaltranspordi juhend;

- isikliku abistaja ja tugiisikuteenuse juhendid;

- KOV teenusekirjeldused;

- KOV kontaktid;

- rehabilitatsioonireformi ametlik info eraldi staatusega.

Allikate kuvamise MVP

Allikapaneel näitab:

- pealkiri;

- allikatüüp;

- staatus;

- viimati kontrollitud;

- mida vastuses toetas.

Kõige tähtsam:

kuvatakse ainult vastuses tegelikult kasutatud allikad.

18.12. Etapp 10: töölaua ja pakettide uuendamine

Kui teekonnakaart töötab, saab muuta töölaua ja pakettide sõnastust.

Pöörduja töölaud

Esiplaan:

- Alusta teekonda

- Minu teekonnad

- Eelpöördumised

- Teenusekaart

- Dokumendid

- Vestlusruumid

- Abisoovid ja abipakkumised

Spetsialisti töölaud

Esiplaan:

- Pöördumiste vastuvõtt

- Vestlusruumid

- Dokumendi koostamine

- Dokumendi analüüs

- Teenusekaart

- Kovisioon

- Tööheaolu

- Materjalide lisamine

Teenuseosutaja töölaud

Esiplaan:

- Teenuseprofiil

- Teenused

- Saabunud pöördumised

- Vestlusruumid

- Teenusekaardi nähtavus

- Materjalid

Pakettide tabelit ei pea kohe ümber ehitama, aga uued read peaksid olema:

- Teekonnakaart

- Eelpöördumine

- Eelkaardistus

- Juhendatud eelkaardistus

- Teenusekaart

- Teenuseni jõudmise info

- Pöördumiste vastuvõtt

- Vestlus- ja koostööruumid

18.13. Mis on täiesti uus arendus?

Täiesti uued või suuremad uued osad:

1. Teekonnakaart

1. Esmane teekonnasõel

1. Teekonnakaardi olekud

1. Osapoolte staatused teekonnal

1. Teenusekatkemise kontroll

1. Teenuseni jõudmise struktureeritud loogika

1. Juhendatud eelkaardistuse koostäidetav paneel

1. Allikate staatuse ja rolli kuvamine

1. Teekonnast käivitatavad tööriistad

18.14. Mis on olemasoleva funktsiooni täiendamine?

Olemasolevaid funktsioone ei pea nullist ümber tegema.

Täiendamist vajavad

Privaatne assistent
Lisada teekonnasõel ja teekonnakaardi loomine.

Eelpöördumine
Siduda teekonnaga, lisada täitmise viisid ja eelinfo kaart.

Teenusekaart
Lisada ligipääsutee, eelfiltrid ja “lisa teekonnale”.

Pöördumiste vastuvõtt
Lisada struktureeritud eelinfo kaart ja tegevused.

Vestlusruumid
Lisada uued käivitajad ja roomType.

Dokumendi analüüs
Siduda teekonnaga ja teenusekatkemise kontrolliga.

Dokumendi koostamine
Lubada kasutada teekonna kokkuvõtet ja eelpöördumise sisu.

Abisoovid ja abipakkumised
Siduda teekonnakaardiga kui eraldi kogukondliku abi haru.

Teadmusbaas
Lisada allikatüübid, staatused ja ligipääsutee väljad.

18.15. Esimene Codexi ülesannete järjekord

Ma annaks Codexile järjest sellised ülesanded.

Ülesanne 1: Teekonnakaardi andmemudel ja salvestamine

Eesmärk:

- luua Journey mudel;

- siduda kasutajaga;

- salvestada staatus, kokkuvõte, teemad, riskid, puuduv info ja soovitatud tegevused;

- kuvada kasutaja töölaual “Minu teekonnad”.

Ülesanne 2: Assistendi teekonnasõela JSON-väljund

Eesmärk:

- lisada assistendi töövoogu struktureeritud väljund;

- kasutaja kirjelduse põhjal luua teekonnakaardi mustand;

- lubada kasutajal see kinnitada või muuta.

Ülesanne 3: Teekonnakaardi UI

Eesmärk:

- luua kaart vestluse kõrvale või vestlusesse;

- kuvada kokkuvõte, teemad, puuduv info, järgmised sammud;

- lisada nupud: teenusekaart, eelpöördumine, dokumendi analüüs.

Ülesanne 4: Teenusekaart teekonna kontekstist

Eesmärk:

- teenusekaart avaneb teekonnast filtritega;

- teenusekirjel on accessType ja firstStep;

- saab lisada kontakti teekonnale.

Ülesanne 5: Eelpöördumine teekonnast

Eesmärk:

- eelpöördumine saab sisendi teekonnakaardilt;

- kasutaja valib tüübi ja täitmise viisi;

- enne saatmist kuvatakse eelinfo kaart.

Ülesanne 6: Pöördumiste vastuvõtu uus kaart

Eesmärk:

- vastuvõtja näeb struktureeritud eelinfot;

- saab võtta vastu, küsida lisainfot, pakkuda ruumi või kohtumist;

- teenusekatkemise risk kuvatakse märgisena.

Ülesanne 7: Vestlusruumi käivitajad

Eesmärk:

- vestlusruumi saab luua ka eelpöördumisest ja vastuvõtust;

- olemasolev kutse leht jääb alles;

- lisada roomType ja sourceId.

Ülesanne 8: Teenusekatkemise kontroll

Eesmärk:

- tuvastada teenusekatkemise signaal;

- küsida kolm põhiküsimust;

- luua eelpöördumise tüüp SERVICE_CONTINUITY;

- kuvada risk vastuvõtja vaates.

18.16. Riskid, mida enne vältida

Risk 1: süsteem tundub ametliku hindajana

Lahendus:

- termin “eelkaardistus”, mitte “AI hindamine”;

- igas väljundis piir: ametliku hindamise teeb spetsialist;

- teekonnakaart = võimalik järgmine samm, mitte otsus.

Risk 2: privaatne info liigub kogemata edasi

Lahendus:

- privaatset vestlust ei jagata;

- jagatav eelinfo kaart luuakse eraldi;

- kasutaja kinnitab enne saatmist;

- logida jagamise sündmus.

Risk 3: teenusekaart lubab liiga palju

Lahendus:

- “võimalik teenusesuund”;

- accessType;

- “teenuseni jõudmine võib eeldada hindamist/otsust/suunamist”.

Risk 4: teenuseosutaja saab liiga laia infot

Lahendus:

- adressaadipõhine eelinfo;

- teenuseosutajale ainult teenusega seotud vaade;

- KOV vaade ja teenuseosutaja vaade erinevad.

Risk 5: tervisekontaktide kiht paisub liiga suureks

Lahendus:

- ainult perearstikeskused/tervisekeskused;

- mitte eriarstid, haiglad, ravijärjekorrad;

- ei anta meditsiinilist hinnangut.

Risk 6: liiga suur MVP

Lahendus:

- esimene versioon ainult ühe selge vooga:
vestlus → teekonnakaart → teenusekaart/eelpöördumine → vastuvõtt.

18.17. Kõige mõistlikum MVP

Kui peaks valima ühe päriselt arendatava MVP, siis see oleks:

MVP voog

1. Kasutaja logib sisse.

1. Avaneb privaatne assistendivestlus.

1. Kasutaja kirjeldab olukorda.

1. AI loob esmase teekonnakaardi.

1. Teekonnakaart näitab:

  - kokkuvõte;

  - seotud teemad;

  - puuduv info;

  - järgmised sammud.

1. Kasutaja avab teenusekaardi või eelpöördumise.

1. Teenusekaardilt saab valida KOV kontakti või teenuseosutaja.

1. Kasutaja koostab eelpöördumise.

1. Enne saatmist kinnitab jagatava eelinfo.

1. Vastuvõtja näeb struktureeritud eelinfo kaarti.

1. Vastuvõtja saab küsida lisainfot või pakkuda vestlusruumi.

See oleks juba uus SotsiaalAI.

18.18. Mida mitte teha esimesena?

Esimesena ei teeks:

- täielikku tervisekontaktide andmebaasi;

- haigla sotsiaaltöötajate kaardistust;

- kõiki SKA juhendeid korraga;

- kõiki KOV teenuseid uue mudeli järgi korraga;

- keerulist automaatset teenusesoovitust;

- AI-põhist ametliku hindamise imitatsiooni;

- liiga detailset rollipõhist õiguste süsteemi enne põhivoogu.

Need tulevad hiljem.

18.19. Kokkuvõte

Arendusjärjekord peaks olema:

1. Teekonnakaardi andmemudel

1. Assistendi esmane teekonnasõel

1. Teekonnakaardi UI

1. Teenusekaardi sidumine teekonnaga

1. Eelpöördumise sidumine teekonnaga

1. Pöördumiste vastuvõtu täiendamine

1. Vestlusruumi uued käivitajad

1. Teenusekatkemise kontroll

1. Teadmuspõhja ja allikate staatuste täiendamine

1. Töölaua ja pakettide uus esitlus

Kõige olulisem praktiline fookus:

ära ehita uut platvormi kõrvale, vaid lisa olemasolevale SotsiaalAI-le teekonnakiht, mis seob vestluse, teenusekaardi, eelpöördumise, dokumendid, vastuvõtu ja vestlusruumid üheks juhendatud kasutajateekonnaks.

# 19. Kõige lühem uus visioon

SotsiaalAI uus keskne visioon võiks olla:

SotsiaalAI on juhendatud teenuseteekonna platvorm, kus inimene alustab privaatsest vestlusest, saab oma olukorra põhjal teekonnakaardi ning liigub sealt sobiva järgmise sammuni: teenusekaart, eelpöördumine, dokumendi analüüs, dokumendi koostamine, abisoov või koostööruum. Spetsialistidele ja teenuseosutajatele pakub SotsiaalAI struktureeritud eelinfot, allikapõhiseid töömustandeid ja turvalist koostööd.

See on kogu pika mudeli kõige lühem kokkuvõte.

19.1. Ühelauseline visioon

Kui on vaja väga lühidalt:

SotsiaalAI aitab inimesel, spetsialistil ja teenuseosutajal liikuda segasest olukorrast selgema järgmise sammuni — privaatsest vestlusest teekonnakaardi, eelpöördumise, teenusekaardi, dokumentide ja koostööruumini.

Veel lühem:

SotsiaalAI muudab sotsiaalvaldkonna abi- ja teenuseteekonnad arusaadavamaks, kontrollitavamaks ja paremini ettevalmistatuks.

19.2. Avalehe jaoks

Avalehele sobiks sõnastus, mis ei lähe liiga tehniliseks:

SotsiaalAI aitab sul alustada olukorra kirjeldamisest, mitte õige teenuse või asutuse äraarvamisest. Kirjelda oma muret oma sõnadega — SotsiaalAI aitab mõista, millised teemad võivad olla seotud, milline info vajab täpsustamist ja milline võiks olla järgmine samm. Vajadusel saad liikuda edasi teenusekaardi, eelpöördumise, dokumendi analüüsi, dokumendi koostamise, abisoovi või jagatud koostööruumi juurde.

19.3. Pöördujale suunatud lühitekst

Sa ei pea teadma õige teenuse, vormi või asutuse nime. Kirjelda oma olukorda ja SotsiaalAI aitab sul luua teekonnakaardi, leida võimaliku kontakti, koostada eelpöördumise või küsimuse ning otsustada, mida ja kellele jagada. Ametliku hindamise või otsuse teeb pädev spetsialist või asutus.

19.4. Spetsialistile suunatud lühitekst

SotsiaalAI aitab sotsiaalvaldkonna spetsialistil saada paremini struktureeritud eelinfot, leida allikapõhist tausta, koostada kontrollitavaid töömustandeid ning toetada suhtlust inimese või teenuseosutajaga. Platvorm ei asenda spetsialisti hindamist ega otsust, vaid aitab infot korrastada ja tööks ette valmistada.

19.5. Teenuseosutajale suunatud lühitekst

SotsiaalAI aitab teenuseosutajal teha oma teenused paremini leitavaks, selgitada teenuseni jõudmise tingimusi ja võtta vastu paremini ettevalmistatud pöördumisi. Teenuseosutaja saab hallata teenuseprofiili, vastata teenusega seotud küsimustele ja vajadusel jätkata suhtlust koostööruumis.

19.6. Partnerile või KOV-ile selgitamiseks

SotsiaalAI ei püüa asendada KOV-i, spetsialisti ega ametlikku hindamist. Platvorm aitab inimesel enne kontakti oma olukorda selgemalt kirjeldada ja spetsialistile jagatava eelinfo ette valmistada. See võib vähendada ebaselgeid pöördumisi, aidata märgata teenusekatkemise riski ning toetada seda, et spetsialist ei alustaks iga kord nullist.

19.7. Mida SotsiaalAI uues visioonis teeb?

SotsiaalAI:

- aitab inimesel oma olukorda kirjeldada;

- teeb esmase teekonnasõela;

- loob teekonnakaardi;

- aitab leida sobiva kontaktisuuna;

- seob teenusekaardi, eelpöördumise ja dokumendid üheks teekonnaks;

- aitab koostada spetsialistile jagatava eelinfo;

- võimaldab juhendatud eelkaardistust;

- aitab märgata teenusekatkemise riski;

- toetab koostööd vestlusruumis;

- kuvab allikaid kontrollitavalt;

- aitab spetsialistil ja teenuseosutajal koostada töömustandeid.

19.8. Mida SotsiaalAI ei tee?

Selle peab visioonis samuti ausalt hoidma.

SotsiaalAI ei tee:

- ametlikku abivajaduse hindamist;

- KOV teenuseotsust;

- meditsiinilist diagnoosi;

- ametlikku teenusele suunamist;

- spetsialisti professionaalse otsuse asendamist;

- kasutaja privaatse vestluse automaatset jagamist;

- eelnõulise või muutliku info esitamist kehtiva korrana.

Lühike piiritekst:

SotsiaalAI aitab järgmise sammu ette valmistada, kuid ametliku hindamise, otsuse ja teenusele suunamise teeb pädev spetsialist või asutus.

19.9. Kõige täpsem uus positsioneerimine

Minu arvates võiks SotsiaalAI uus positsioon olla:

SotsiaalAI ei ole lihtsalt vestlusrobot ega teenusekataloog. See on sotsiaalvaldkonna juhendatud teekonnaplatvorm, mis ühendab privaatse assistendivestluse, teekonnakaardi, teenusekaardi, eelpöördumise, dokumenditöö, allikapõhise teadmuse ja koostööruumid.

See eristab sind tavalisest AI vestlusest ja tavalisest kaardirakendusest.

19.10. Kõige lühem lõplik versioon

Kui peaksin ühe lõigu jätma, siis see oleks:

SotsiaalAI on juhendatud teenuseteekonna platvorm, mis aitab inimesel alustada oma olukorra kirjeldamisest ja liikuda selgema järgmise sammuni. Platvorm loob esmase teekonnakaardi, aitab leida sobiva kontakti, koostada eelpöördumise või eelinfo spetsialistile, analüüsida dokumente ning vajadusel jätkata suhtlust jagatud koostööruumis. Spetsialistidele ja teenuseosutajatele pakub SotsiaalAI struktureeritud eelinfot, allikapõhiseid töömustandeid ja teenuste paremat nähtavust, säilitades selge piiri: ametliku hindamise, otsuse ja teenusele suunamise teeb pädev inimene või asutus.

# 20. Kogu mudeli lõplik koond

See punkt paneb kogu senise loogika kokku üheks tervikuks: mis SotsiaalAI uues vaates on, kuidas kasutaja liigub, millised olemasolevad funktsioonid seotakse ümber ja mis tuleb juurde arendada.

Kõige olulisem muutus on see:

SotsiaalAI ei ole enam lihtsalt rollipõhine tööriistade kogum, vaid juhendatud teenuseteekonna platvorm.

20.1. Uus põhiloogika

SotsiaalAI kasutaja ei pea alustama küsimusest:

“Millist funktsiooni ma tahan kasutada?”

Ta saab alustada küsimusest:

“Mis olukorras ma olen?”

Selle põhjal liigub platvorm nii:

Privaatne assistendivestlus
→ esmane teekonnasõel
→ teekonnakaart
→ sobiv järgmine samm
→ teenusekaart / eelpöördumine / dokument / abisoov / koostööruum

See tähendab, et vestlus ei ole lihtsalt küsimus-vastus koht. Vestlus on teekonna alguspunkt.

20.2. Platvormi neli põhikihti

Uus SotsiaalAI mudel koosneb neljast kihist.

1. Privaatne assistendivestlus

Kasutaja kirjeldab olukorda oma sõnadega.
Assistent teeb esmase teekonnasõela, mitte ametlikku hindamist.

Tuvastatakse näiteks:

- kas teema on sotsiaalvaldkonna küsimus;

- kas esmane samm võib olla KOV;

- kas sobib teenuseosutaja;

- kas esmane samm võib olla tervisekontakt;

- kas on teenusekatkemise risk;

- kas on kriisi- või ohusignaal;

- kas vaja on eelpöördumist, dokumenti, teenusekaarti või abisoovi.

2. Teekonnakaart

Teekonnakaart on platvormi uus keskne objekt.

See näitab:

- olukorra kokkuvõtet;

- seotud teemasid;

- puuduolevat infot;

- võimalikke osapooli;

- võimalikke teenusesuundi;

- teenusekatkemise riski;

- järgmisi samme;

- millised tööriistad sobivad edasi liikumiseks.

Teekonnakaart ei ole ametlik hindamine ega otsus.

3. Nähtavad tööriistad

Teekonnakaardilt saab liikuda olemasolevatesse ja uutesse tööriistadesse:

- teenusekaart;

- eelpöördumine;

- eelkaardistus;

- dokumendi koostamine;

- dokumendi analüüs;

- abisoovid ja abipakkumised;

- vestlus- ja koostööruumid;

- pöördumiste vastuvõtt;

- teenuseprofiil;

- kovisioon;

- tööheaolu;

- süvauuring.

4. Läbivad usalduskihid

Need ei ole eraldi “lisafunktsioonid”, vaid kogu platvormi turvaraam:

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine;

- allikate kuvamine;

- rollipõhine ligipääs;

- kasutaja kinnitus enne jagamist;

- nõusolekupõhine helikõne/transkriptsioon;

- privaatse vestluse ja jagatud ruumi eristus;

- allikate tüübi ja staatuse eristamine.

20.3. Kasutajateekond pöördujale

Pöörduja vaates võiks põhiline teekond olla:

1. Kasutaja logib sisse.
2. Avaneb privaatne assistendivestlus.
3. Kasutaja kirjeldab olukorda.
4. SotsiaalAI koostab esmase teekonnakaardi.
5. Kasutaja näeb seotud teemasid ja järgmisi samme.
6. Kasutaja valib:
- leia kontakt teenusekaardilt;
- koosta eelpöördumine;
- täida eelkaardistus;
- lisa dokument analüüsiks;
- loo abisoov;
- ava või küsi koostööruumi.
7. Enne jagamist kinnitab kasutaja kogu jagatava info.

Pöörduja jaoks on peamine lubadus:

Sa ei pea teadma õige teenuse, vormi või asutuse nime. Kirjelda olukorda ja SotsiaalAI aitab järgmise sammu ette valmistada.

20.4. Spetsialisti teekond

Spetsialisti jaoks on põhiline väärtus see, et ta ei alusta nullist.

Spetsialist näeb:

- saabunud eelpöördumisi;

- kasutaja kinnitatud eelinfot;

- kas tegu on lühikese märguande, põhjaliku eelkaardistuse või juhendatud eelkaardistuse sooviga;

- teenusekatkemise riski;

- lisatud dokumente;

- puuduolevat infot;

- soovitud suhtlusviisi;

- võimalust avada vestlusruum või küsida lisainfot.

Spetsialist saab:

- võtta pöördumise vastu;

- küsida täpsustust;

- pakkuda vestlusruumi;

- koostada vastuse mustandi;

- koostada memo;

- koostada inimesele lihtsas keeles selgituse;

- kasutada dokumendi analüüsi;

- kasutada allikapõhist süvauuringut;

- alustada kovisiooni anonümiseeritud kujul.

Spetsialisti jaoks on põhipiir:

SotsiaalAI koostab kontrollitavaid töömustandeid ja aitab infot korrastada, kuid lõpliku hindamise, otsuse ja vastutuse säilitab spetsialist.

20.5. Teenuseosutaja teekond

Teenuseosutaja jaoks on SotsiaalAI väärtus:

- teenuste nähtavus;

- parem teenusekirjeldus;

- paremini ettevalmistatud pöördumised;

- teenuseni jõudmise tingimuste selgitamine;

- võimalus jätkata suhtlust koostööruumis.

Teenuseosutaja saab hallata:

- organisatsiooni profiili;

- teenuseid;

- sihtrühmi;

- piirkondi;

- teeninduskohti;

- ligipääsetavust;

- eelpöördumise vastuvõttu;

- infot, kas teenus vajab KOV otsust, arsti suunamist või muud tingimust.

Teenuseosutaja vaade peab olema kitsam kui KOV spetsialisti vaade. Teenuseosutaja ei pea nägema kogu laia eelkaardistust, kui talle piisab teenusega seotud eelinfost.

20.6. Funktsioonide lõplik seos

Praegused ja uued funktsioonid seotakse nii:

| Funktsioon | Uus roll platvormis |
| --- | --- |
| Privaatne assistent | teekonna algus ja esmane teekonnasõel |
| Teekonnakaart | keskne juhtkiht ja järgmiste sammude valik |
| Teenusekaart | kontaktide, teenuste ja ligipääsuteede kiht |
| Eelpöördumine | jagatava eelinfo loomine valitud kontaktile |
| Eelkaardistus | spetsialistile esitatav struktureeritud eelinfo |
| Juhendatud eelkaardistus | võimalus täita küsimustik koos spetsialistiga |
| Pöördumiste vastuvõtt | spetsialisti/teenuseosutaja töölaud saabunud eelinfo jaoks |
| Vestlusruumid | jagatud koostööruumid, mitte lihtsalt chat |
| Dokumendi analüüs | otsuste, plaanide ja kirjade mõistmine ning teekonnaga sidumine |
| Dokumendi koostamine | pöördumiste, kirjade, memode ja kokkuvõtete mustandid |
| Abisoovid/abipakkumised | kogukondliku abi eraldi haru |
| Teenuseprofiil | teenuseosutaja nähtavus ja pöördumiste kvaliteet |
| Teadmusbaas | teekonnaloogika ja allikapõhiste vastuste alus |
| Allikate kuvamine | vastuse kontrollikiht |
| Kovisioon | spetsialisti anonümiseeritud arutelu ja praktikanäited |
| Tööheaolu | spetsialisti töökoormuse ja taastumise tugi |

20.7. Uued keskobjektid andmemudelis

Uue mudeli jaoks on vaja vähemalt neid põhiobjekte:

1. Journey / Teekonnakaart

Hoiab olukorra kokkuvõtet, teemasid, riske, puuduolevat infot ja järgmisi samme.

2. JourneyParty / Osapool teekonnal

Kirjeldab, kas KOV kontakt, teenuseosutaja, tervisekontakt või muu osapool on soovitatud, valitud, kaasatud või ruumis.

3. PreContact / Eelpöördumine

Hoiab kasutaja kinnitatud pöördumise või eelinfo mustandit.

4. GuidedMapping / Juhendatud eelkaardistus

Hoiab infot, kui kasutaja soovib küsimustikku täita koos spetsialistiga.

5. Intake / Pöördumise vastuvõtt

Vastuvõtja tööobjekt: saabunud pöördumine, staatused, tegevused, riskimärgid.

6. Room / Koostööruum

Olemasolev vestlusruum, aga uue roomType ja sourceId loogikaga.

7. AccessPath / Teenuseni jõudmise tee

Näitab, kas teenusele saab pöörduda otse, vaja on KOV hindamist, KOV otsust, tervisekontakti või suunamist.

8. Source / Allikas

Hoiab allikatüüpi, staatust, kuupäeva, autoriteetsust ja seda, millist vastuse osa allikas toetab.

20.8. Kõige tähtsamad piirid

Need piirid peavad olema läbivalt tekstides, UI-s ja süsteemiloogikas.

SotsiaalAI ei tee:

- ametlikku abivajaduse hindamist;

- KOV otsust;

- teenuse määramist;

- meditsiinilist hinnangut;

- ametlikku suunamist;

- automaatset andmejagamist;

- spetsialisti professionaalse vastutuse asendamist.

SotsiaalAI teeb:

- esmase teekonnasõela;

- olukorra korrastamise;

- teekonnakaardi;

- võimalike järgmiste sammude pakkumise;

- kontaktide ja teenuseni jõudmise tee selgitamise;

- eelpöördumise ja eelinfo mustandi;

- dokumendi analüüsi;

- töömustandeid;

- allikapõhiseid selgitusi;

- koostööruumide kaudu suhtluse toetamist.

Kõige lühem piiritekst:

SotsiaalAI aitab järgmise sammu ette valmistada, kuid ametliku hindamise, otsuse ja teenusele suunamise teeb pädev spetsialist või asutus.

20.9. MVP lõplik kuju

Kõige mõistlikum esimene päris MVP oleks:

Privaatne vestlus
→ AI esmane teekonnasõel
→ teekonnakaart
→ teenusekaart või eelpöördumine
→ kasutaja kinnitatud eelinfo
→ pöördumiste vastuvõtt
→ vajadusel koostööruum

MVP peab sisaldama:

1. teekonnakaardi andmemudelit;

1. assistendi teekonnasõela;

1. teekonnakaardi UI-d;

1. teenusekaardi sidumist teekonnaga;

1. eelpöördumist teekonnast;

1. eelinfo kinnitamise vaadet;

1. pöördumiste vastuvõtu struktureeritud vaadet;

1. vestlusruumi käivitamist eelpöördumisest/vastuvõtust;

1. teenusekatkemise lihtsat märget;

1. allikate tüübi ja staatuse kuvamise algversiooni.

20.10. Codexile antava suure ülesande pealkiri

Selle kogu mudeli võiks arendusülesandeks koondada nii:

Lisa SotsiaalAI platvormile teekonnakeskne töövoog: privaatne assistendivestlus → teekonnakaart → teenusekaart/eelpöördumine → vastuvõtt → koostööruum.

Codexi töö peaks jagunema etappideks:

1. Journey mudel ja UI.

1. Assistendi teekonnasõela väljund.

1. Teenusekaardi kontekstuaalne avamine.

1. Eelpöördumise sidumine teekonnaga.

1. Vastuvõtja struktureeritud vaade.

1. Vestlusruumi uued käivitajad.

1. Teenusekatkemise kontroll.

1. Allikate staatuse ja rolli kuvamine.

20.11. Avalik sõnum

Avalehe või “Meist” lehe jaoks võiks kogu mudeli kokku võtta nii:

SotsiaalAI aitab liikuda olukorra kirjeldusest järgmise praktilise sammuni. Kasutaja saab alustada privaatsest vestlusest, mille põhjal tekib teekonnakaart: millised teemad võivad olla seotud, milline info vajab täpsustamist ja milline võiks olla järgmine samm. Vajadusel saab liikuda edasi teenusekaardi, eelpöördumise, dokumendi analüüsi, dokumendi koostamise, abisoovi või jagatud koostööruumi juurde. Spetsialistidele ja teenuseosutajatele pakub SotsiaalAI struktureeritud eelinfot, allikapõhiseid töömustandeid ja paremini ettevalmistatud suhtlust.

20.12. Kõige lühem lõplik kokkuvõte

SotsiaalAI uus mudel on teekonnakeskne: inimene kirjeldab olukorda, AI aitab selle põhjal luua teekonnakaardi ning sealt liigub kasutaja sobiva järgmise sammuni — kontakt, eelpöördumine, eelkaardistus, dokument, abisoov või koostööruum. Spetsialist ja teenuseosutaja saavad ainult kasutaja kinnitatud eelinfot ning kasutavad SotsiaalAI-d töömustandite, allikate ja koostöö toetajana, mitte ametliku hindamise või otsuse asendajana.

21

Mõtles 7s

21. Codexile antav arendusülesanne

See punkt muudab kogu senise mudeli arendajale kasutatavaks ülesandeks. Eesmärk ei ole Codexile anda korraga “ehita kõik valmis”, vaid jagada uus teekonnakeskne loogika selgeteks tööpakettideks.

Kõige lühem ülesande pealkiri võiks olla:

Lisa SotsiaalAI platvormile teekonnakeskne töövoog: privaatne assistendivestlus → teekonnakaart → teenusekaart/eelpöördumine → vastuvõtt → koostööruum.

21.1. Arenduse eesmärk

SotsiaalAI praegused funktsioonid tuleb siduda uue keskse objektiga: teekonnakaart.

Kasutaja ei peaks alustama funktsiooni valikust, vaid olukorra kirjeldamisest. Assistendi vestlus peab looma esmase teekonnasõela ja selle põhjal teekonnakaardi, kust kasutaja saab liikuda edasi sobiva tööriistani.

Põhivoog:

Privaatne assistendivestlus
→ esmane teekonnasõel
→ teekonnakaart
→ soovitatud järgmised sammud
→ teenusekaart / eelpöördumine / dokumendi analüüs / abisoov / koostööruum

21.2. Esimene tööpakett: Journey ehk teekonnakaardi andmemudel

Codexi esimene ülesanne võiks olla luua uus andmemudel.

Vajalik objekt

Journey või JourneyMap

Põhiväljad:

{
"id": "journey_001",
"ownerUserId": "user_001",
"roleContext": "CLIENT",
"status": "PRIVATE",
"title": "Koduse toimetuleku mure",
"summary": "Kasutaja kirjeldab raskusi igapäevase toimetulekuga kodus.",
"primaryPath": "SOCIAL",
"secondaryPaths": ["KOV_SOCIAL_SERVICES", "HEALTH_CONTACT"],
"domains": ["DAILY_LIVING", "PHYSICAL_HEALTH", "HOME_SUPPORT"],
"riskSignals": [],
"missingInfo": ["municipality", "existingDecisionOrPlan"],
"suggestedActions": [
"OPEN_SERVICE_MAP",
"CREATE_PRECONTACT",
"ANALYZE_DOCUMENT"
],
"sharingStatus": "NOT_SHARED"
}

Nõuded

- Teekonnakaart kuulub alati konkreetsele kasutajale.

- Algolek on alati privaatne.

- Teekonnakaarti ei jagata automaatselt ühelegi osapoolele.

- Teekonnakaart peab olema hiljem seotav eelpöördumise, teenusekaardi kirje, dokumendi ja vestlusruumiga.

21.3. Teine tööpakett: assistendi esmane teekonnasõel

Privaatne assistent peab suutma kasutaja olukorra kirjelduse põhjal luua struktureeritud väljundi.

Teekonnasõela väljund

{
"summary": "Kasutaja kirjeldab raskusi kodus toimetulekuga.",
"primaryPath": "SOCIAL",
"secondaryPaths": ["HEALTH_CONTACT"],
"domains": ["DAILY_LIVING", "PHYSICAL_HEALTH"],
"riskSignals": [],
"missingInfo": ["municipality"],
"suggestedActions": [
"OPEN_SERVICE_MAP",
"CREATE_PRECONTACT"
]
}

Sõel peab tuvastama

- kas teema on sotsiaalvaldkonna küsimus;

- kas võimalik esimene kontakt on KOV;

- kas võimalik esimene kontakt on teenuseosutaja;

- kas võimalik esimene kontakt võib olla perearstikeskus/tervisekeskus;

- kas on teenusekatkemise risk;

- kas on kriisi- või ohusignaal;

- kas sobib dokumendi analüüs;

- kas sobib abisoovi/abipakkumise töövoog;

- milline oluline info on puudu.

Piir

Teekonnasõel ei ole ametlik hindamine. UI-s tuleb vältida sõnastust “SotsiaalAI hindas abivajadust”.

21.4. Kolmas tööpakett: teekonnakaardi UI

Teekonnakaart tuleb kuvada kasutajale lihtsa kaardina.

Kaardi plokid

- Olukorra kokkuvõte

- Seotud teemad

- Puuduolev info

- Võimalikud järgmised sammud

- Riskimärgid, kui olemas

- Privaatsuse märge

Nupud

- Ava teenusekaart

- Koosta eelpöördumine

- Lisa dokument analüüsiks

- Loo abisoov

- Salvesta teekond

Kohustuslik tekst

See teekonnakaart on privaatne. Seda ei jagata enne, kui sa ise kinnitad jagatava info.

21.5. Neljas tööpakett: teenusekaart teekonna kontekstis

Teenusekaart peab avanema teekonnakaardi sisendi põhjal.

Teekonnast teenusekaardile kaasa anda

- piirkond, kui teada;

- seotud valdkonnad;

- sihtrühm;

- kas otsitakse KOV kontakti;

- kas otsitakse teenuseosutajat;

- kas võib olla vaja tervisekontakti;

- kas on teenusekatkemise risk.

Teenusekaardi kirjel peab olema

- entryType: KOV_CONTACT | KOV_SERVICE | SERVICE_PROVIDER | HEALTH_CONTACT

- accessType: DIRECT | KOV_ASSESSMENT | KOV_DECISION | HEALTH_CONTACT | REFERRAL_REQUIRED | PROVIDER_TRIAGE | UNKNOWN

- firstStep

- decisionBy

- sourceType

- sourceStatus

- lastChecked

Tegevused kirje juures

- Lisa teekonnale

- Koosta eelpöördumine

- Küsi tingimusi

- Vaata, kuidas teenuseni jõuda

21.6. Viies tööpakett: eelpöördumine teekonnakaardist

Eelpöördumine peab saama sisendi teekonnakaardilt ja valitud osapoolelt.

Eelpöördumise tüübid

- BRIEF_NOTICE

- SHORT_PRECONTACT

- SHORT_FORM

- EXTENDED_MAPPING

- GUIDED_MAPPING_REQUEST

- SERVICE_CONTINUITY

Täitmise viisid

- SELF_COMPLETED

- WITH_SPECIALIST_IN_ROOM

- AUDIO_SUPPORTED

- IN_PERSON_REQUESTED

- WRITTEN_REPLY_ONLY

Enne saatmist

Kasutajale tuleb näidata eelvaadet:

Seda näeb vastuvõtja.

Kasutaja peab saama:

- muuta teksti;

- eemaldada infot;

- lisada infot;

- kinnitada adressaadi;

- kinnitada jagamise.

21.7. Kuues tööpakett: pöördumiste vastuvõtu uus kaart

Spetsialistile ja teenuseosutajale ei tohi kuvada lihtsalt pikka teksti. Tuleb kuvada struktureeritud eelinfo kaart.

Vastuvõtja näeb

- pöördumise tüüp;

- peamine mure;

- inimese enda soov;

- seotud valdkonnad;

- täitmise viis;

- kaardistuse tase;

- teenusekatkemise risk, kui olemas;

- puuduolev info;

- lisatud dokumendid;

- eelistatud suhtlusviis.

Vastuvõtja tegevused

- Võta vastu

- Küsi lisainfot

- Paku vestlusruumi

- Paku kohtumist

- Märgi mitteasjakohaseks

- Sulge

Vastuvõtja päisetekst

See on kasutaja kinnitatud eelinfo. Tegemist ei ole ametliku hindamisega. Kasuta seda vestluse või edasise töö ettevalmistamiseks ning otsusta järgmine samm oma töökorra järgi.

21.8. Seitsmes tööpakett: vestlusruumi uued käivitajad

Olemasolev kutse leht jääb alles. Seda ei tohi eemaldada.

Lisada tuleb uued käivitajad:

- eelpöördumisest;

- pöördumiste vastuvõtust;

- teekonnakaardilt;

- juhendatud eelkaardistuse soovist;

- abisoovi/abipakkumise matchist.

Üks ruumi süsteem

Ei tohi luua eraldi vestlusruumide süsteeme. Kasutada sama ruumi objekti, aga lisada roomType.

{
"roomType": "MANUAL_INVITE | PRECONTACT | GUIDED_MAPPING | HELP_MATCH | SERVICE_INTAKE | COVISION",
"sourceId": "pre_001",
"createdFrom": "INTAKE"
}

Sponsoreeritud ligipääs

Olemasolev võimalus, kus kutsuja saab tasuda kutsutu ühe kuu eest, jääb alles. Seda kasutada eelkõige eraisiku, lähedase või abistaja kutsumisel.

Ametliku spetsialisti või teenuseosutaja puhul eelistada rollipõhist ligipääsu või piiratud vastuvõtuvaadet.

21.9. Kaheksas tööpakett: teenusekatkemise kontroll

Teenusekatkemise kontroll käivitub, kui kasutaja kirjeldab, et teenus lõpeb, katkeb, teenuseosutaja muutub või järgmine samm on ebaselge.

MVP loogika

Kui tuvastatakse teenusekatkemise signaal, lisada teekonnakaardile märge:

Teenuse jätkumine vajab kontrollimist.

Küsida kolm asja:

1. Mis teenus on lõppemas?

1. Millal see lõpeb?

1. Kas sul on olemas otsus, teenuseplaan või kiri?

Pakkuda tegevused

- Lisa dokument analüüsiks.

- Koosta teenuse jätkumise eelpöördumine.

- Leia KOV kontakt.

- Küsi teenuseosutajalt tingimusi.

21.10. Üheksas tööpakett: teadmuspõhja ja allikate staatused

Allikad ja teenused vajavad uusi välju.

Allikal

- sourceType

- sourceStatus

- lastChecked

- authorityLevel

- supports

Teenusel

- serviceType

- organizer

- accessType

- firstStep

- decisionBy

- requiresAssessment

- requiresDecision

Allikate paneel

Allikate paneel peab kuvama ainult vastuses tegelikult kasutatud allikad.

Iga allika juures kuvada:

- pealkiri;

- allikatüüp;

- staatus;

- viimati kontrollitud;

- mida see vastuses toetas.

21.11. Vastuvõtukriteeriumid

Arendus on esimeses etapis õnnestunud, kui saab läbi teha selle voolu:

Kasutaja kirjeldab olukorda
→ AI loob teekonnakaardi
→ kasutaja avab teenusekaardi
→ valib KOV kontakti või teenuseosutaja
→ koostab eelpöördumise
→ kinnitab jagatava eelinfo
→ vastuvõtja näeb struktureeritud pöördumist
→ vastuvõtja saab pakkuda vestlusruumi

Lisaks peab olema täidetud:

- privaatset assistendivestlust ei jagata;

- kasutaja kinnitab kogu jagatava info;

- teekonnakaart on vaikimisi privaatne;

- eelpöördumist ei nimetata ametlikuks hindamiseks;

- teenusekaart ei luba teenust ega suunamist;

- tervisekontaktid on piiratud esmatasandi kontaktide loogikaga;

- teenusekatkemise risk on märgis, mitte ametlik otsus;

- allikatel on tüüp ja staatus.

21.12. Esimene Codexi prompt

Selle võiks Codexile anda nii:

Lisa SotsiaalAI platvormile teekonnakeskse töövoo esimene versioon.
Eesmärk:
Kasutaja peab saama alustada privaatses assistendivestluses olukorra kirjeldamisest. Assistendi vastuse põhjal tuleb luua privaatne teekonnakaart, mis kuvab olukorra kokkuvõtte, seotud teemad, puuduoleva info, võimalikud riskid ja järgmised sammud. Teekonnakaardilt peab saama avada teenusekaardi, koostada eelpöördumise või lisada dokumendi analüüsiks.
Oluline piir:
Teekonnakaart ei ole ametlik hindamine ega teenuseotsus. Privaatset assistendivestlust ei jagata. Vastuvõtja näeb ainult kasutaja kinnitatud eelinfot.
Tööde järjekord:
1. Loo Journey/JourneyMap andmemudel.
2. Lisa assistendi teekonnasõela struktureeritud JSON-väljund.
3. Loo teekonnakaardi UI.
4. Seo teekonnakaart teenusekaardiga.
5. Seo teekonnakaart eelpöördumisega.
6. Lisa eelpöördumise eelvaade enne saatmist.
7. Täienda pöördumiste vastuvõttu struktureeritud eelinfo kaardiga.
8. Lisa vestlusruumi käivitamine eelpöördumisest või vastuvõtust.
9. Lisa teenusekatkemise riskimärge.
10. Lisa allikatele tüübi ja staatuse kuvamise alus.
Ära eemalda olemasolevat kutse lehte ega olemasolevaid vestlusruume. Lisa ruumidele vajadusel roomType ja sourceId, et sama ruumisüsteemi saaks käivitada mitmest töövoost.

21.13. Kokkuvõte

Punkt 21 on praktiline sillakoht visiooni ja arenduse vahel.

Kõige tähtsam arendusotsus:

ära ehita uut paralleelset platvormi, vaid lisa olemasolevatele funktsioonidele teekonnakiht.

Tehniline tuum:

Journey → PreContact → Intake → Room

Kasutajakogemuse tuum:

Kirjelda olukorda → saa teekonnakaart → vali järgmine samm → kinnita jagatav info → jätka vajadusel koostööruumis.

20. Kogu mudeli lõplik koond

See punkt paneb kogu senise loogika kokku üheks tervikuks: mis SotsiaalAI uues vaates on, kuidas kasutaja liigub, millised olemasolevad funktsioonid seotakse ümber ja mis tuleb juurde arendada.

Kõige olulisem muutus on see:

SotsiaalAI ei ole enam lihtsalt rollipõhine tööriistade kogum, vaid juhendatud teenuseteekonna platvorm.

20.1. Uus põhiloogika

SotsiaalAI kasutaja ei pea alustama küsimusest:

“Millist funktsiooni ma tahan kasutada?”

Ta saab alustada küsimusest:

“Mis olukorras ma olen?”

Selle põhjal liigub platvorm nii:

Privaatne assistendivestlus
→ esmane teekonnasõel
→ teekonnakaart
→ sobiv järgmine samm
→ teenusekaart / eelpöördumine / dokument / abisoov / koostööruum

See tähendab, et vestlus ei ole lihtsalt küsimus-vastus koht. Vestlus on teekonna alguspunkt.

20.2. Platvormi neli põhikihti

Uus SotsiaalAI mudel koosneb neljast kihist.

1. Privaatne assistendivestlus

Kasutaja kirjeldab olukorda oma sõnadega.
Assistent teeb esmase teekonnasõela, mitte ametlikku hindamist.

Tuvastatakse näiteks:

- kas teema on sotsiaalvaldkonna küsimus;

- kas esmane samm võib olla KOV;

- kas sobib teenuseosutaja;

- kas esmane samm võib olla tervisekontakt;

- kas on teenusekatkemise risk;

- kas on kriisi- või ohusignaal;

- kas vaja on eelpöördumist, dokumenti, teenusekaarti või abisoovi.

2. Teekonnakaart

Teekonnakaart on platvormi uus keskne objekt.

See näitab:

- olukorra kokkuvõtet;

- seotud teemasid;

- puuduolevat infot;

- võimalikke osapooli;

- võimalikke teenusesuundi;

- teenusekatkemise riski;

- järgmisi samme;

- millised tööriistad sobivad edasi liikumiseks.

Teekonnakaart ei ole ametlik hindamine ega otsus.

3. Nähtavad tööriistad

Teekonnakaardilt saab liikuda olemasolevatesse ja uutesse tööriistadesse:

- teenusekaart;

- eelpöördumine;

- eelkaardistus;

- dokumendi koostamine;

- dokumendi analüüs;

- abisoovid ja abipakkumised;

- vestlus- ja koostööruumid;

- pöördumiste vastuvõtt;

- teenuseprofiil;

- kovisioon;

- tööheaolu;

- süvauuring.

4. Läbivad usalduskihid

Need ei ole eraldi “lisafunktsioonid”, vaid kogu platvormi turvaraam:

- privaatsuse eelkiht;

- kriisi- ja ohusuunamine;

- allikate kuvamine;

- rollipõhine ligipääs;

- kasutaja kinnitus enne jagamist;

- nõusolekupõhine helikõne/transkriptsioon;

- privaatse vestluse ja jagatud ruumi eristus;

- allikate tüübi ja staatuse eristamine.

20.3. Kasutajateekond pöördujale

Pöörduja vaates võiks põhiline teekond olla:

1. Kasutaja logib sisse.
2. Avaneb privaatne assistendivestlus.
3. Kasutaja kirjeldab olukorda.
4. SotsiaalAI koostab esmase teekonnakaardi.
5. Kasutaja näeb seotud teemasid ja järgmisi samme.
6. Kasutaja valib:
- leia kontakt teenusekaardilt;
- koosta eelpöördumine;
- täida eelkaardistus;
- lisa dokument analüüsiks;
- loo abisoov;
- ava või küsi koostööruumi.
7. Enne jagamist kinnitab kasutaja kogu jagatava info.

Pöörduja jaoks on peamine lubadus:

Sa ei pea teadma õige teenuse, vormi või asutuse nime. Kirjelda olukorda ja SotsiaalAI aitab järgmise sammu ette valmistada.

20.4. Spetsialisti teekond

Spetsialisti jaoks on põhiline väärtus see, et ta ei alusta nullist.

Spetsialist näeb:

- saabunud eelpöördumisi;

- kasutaja kinnitatud eelinfot;

- kas tegu on lühikese märguande, põhjaliku eelkaardistuse või juhendatud eelkaardistuse sooviga;

- teenusekatkemise riski;

- lisatud dokumente;

- puuduolevat infot;

- soovitud suhtlusviisi;

- võimalust avada vestlusruum või küsida lisainfot.

Spetsialist saab:

- võtta pöördumise vastu;

- küsida täpsustust;

- pakkuda vestlusruumi;

- koostada vastuse mustandi;

- koostada memo;

- koostada inimesele lihtsas keeles selgituse;

- kasutada dokumendi analüüsi;

- kasutada allikapõhist süvauuringut;

- alustada kovisiooni anonümiseeritud kujul.

Spetsialisti jaoks on põhipiir:

SotsiaalAI koostab kontrollitavaid töömustandeid ja aitab infot korrastada, kuid lõpliku hindamise, otsuse ja vastutuse säilitab spetsialist.

20.5. Teenuseosutaja teekond

Teenuseosutaja jaoks on SotsiaalAI väärtus:

- teenuste nähtavus;

- parem teenusekirjeldus;

- paremini ettevalmistatud pöördumised;

- teenuseni jõudmise tingimuste selgitamine;

- võimalus jätkata suhtlust koostööruumis.

Teenuseosutaja saab hallata:

- organisatsiooni profiili;

- teenuseid;

- sihtrühmi;

- piirkondi;

- teeninduskohti;

- ligipääsetavust;

- eelpöördumise vastuvõttu;

- infot, kas teenus vajab KOV otsust, arsti suunamist või muud tingimust.

Teenuseosutaja vaade peab olema kitsam kui KOV spetsialisti vaade. Teenuseosutaja ei pea nägema kogu laia eelkaardistust, kui talle piisab teenusega seotud eelinfost.

20.6. Funktsioonide lõplik seos

Praegused ja uued funktsioonid seotakse nii:

| Funktsioon | Uus roll platvormis |
| --- | --- |
| Privaatne assistent | teekonna algus ja esmane teekonnasõel |
| Teekonnakaart | keskne juhtkiht ja järgmiste sammude valik |
| Teenusekaart | kontaktide, teenuste ja ligipääsuteede kiht |
| Eelpöördumine | jagatava eelinfo loomine valitud kontaktile |
| Eelkaardistus | spetsialistile esitatav struktureeritud eelinfo |
| Juhendatud eelkaardistus | võimalus täita küsimustik koos spetsialistiga |
| Pöördumiste vastuvõtt | spetsialisti/teenuseosutaja töölaud saabunud eelinfo jaoks |
| Vestlusruumid | jagatud koostööruumid, mitte lihtsalt chat |
| Dokumendi analüüs | otsuste, plaanide ja kirjade mõistmine ning teekonnaga sidumine |
| Dokumendi koostamine | pöördumiste, kirjade, memode ja kokkuvõtete mustandid |
| Abisoovid/abipakkumised | kogukondliku abi eraldi haru |
| Teenuseprofiil | teenuseosutaja nähtavus ja pöördumiste kvaliteet |
| Teadmusbaas | teekonnaloogika ja allikapõhiste vastuste alus |
| Allikate kuvamine | vastuse kontrollikiht |
| Kovisioon | spetsialisti anonümiseeritud arutelu ja praktikanäited |
| Tööheaolu | spetsialisti töökoormuse ja taastumise tugi |

20.7. Uued keskobjektid andmemudelis

Uue mudeli jaoks on vaja vähemalt neid põhiobjekte:

1. Journey / Teekonnakaart

Hoiab olukorra kokkuvõtet, teemasid, riske, puuduolevat infot ja järgmisi samme.

2. JourneyParty / Osapool teekonnal

Kirjeldab, kas KOV kontakt, teenuseosutaja, tervisekontakt või muu osapool on soovitatud, valitud, kaasatud või ruumis.

3. PreContact / Eelpöördumine

Hoiab kasutaja kinnitatud pöördumise või eelinfo mustandit.

4. GuidedMapping / Juhendatud eelkaardistus

Hoiab infot, kui kasutaja soovib küsimustikku täita koos spetsialistiga.

5. Intake / Pöördumise vastuvõtt

Vastuvõtja tööobjekt: saabunud pöördumine, staatused, tegevused, riskimärgid.

6. Room / Koostööruum

Olemasolev vestlusruum, aga uue roomType ja sourceId loogikaga.

7. AccessPath / Teenuseni jõudmise tee

Näitab, kas teenusele saab pöörduda otse, vaja on KOV hindamist, KOV otsust, tervisekontakti või suunamist.

8. Source / Allikas

Hoiab allikatüüpi, staatust, kuupäeva, autoriteetsust ja seda, millist vastuse osa allikas toetab.

20.8. Kõige tähtsamad piirid

Need piirid peavad olema läbivalt tekstides, UI-s ja süsteemiloogikas.

SotsiaalAI ei tee:

- ametlikku abivajaduse hindamist;

- KOV otsust;

- teenuse määramist;

- meditsiinilist hinnangut;

- ametlikku suunamist;

- automaatset andmejagamist;

- spetsialisti professionaalse vastutuse asendamist.

SotsiaalAI teeb:

- esmase teekonnasõela;

- olukorra korrastamise;

- teekonnakaardi;

- võimalike järgmiste sammude pakkumise;

- kontaktide ja teenuseni jõudmise tee selgitamise;

- eelpöördumise ja eelinfo mustandi;

- dokumendi analüüsi;

- töömustandeid;

- allikapõhiseid selgitusi;

- koostööruumide kaudu suhtluse toetamist.

Kõige lühem piiritekst:

SotsiaalAI aitab järgmise sammu ette valmistada, kuid ametliku hindamise, otsuse ja teenusele suunamise teeb pädev spetsialist või asutus.

20.9. MVP lõplik kuju

Kõige mõistlikum esimene päris MVP oleks:

Privaatne vestlus
→ AI esmane teekonnasõel
→ teekonnakaart
→ teenusekaart või eelpöördumine
→ kasutaja kinnitatud eelinfo
→ pöördumiste vastuvõtt
→ vajadusel koostööruum

MVP peab sisaldama:

1. teekonnakaardi andmemudelit;

1. assistendi teekonnasõela;

1. teekonnakaardi UI-d;

1. teenusekaardi sidumist teekonnaga;

1. eelpöördumist teekonnast;

1. eelinfo kinnitamise vaadet;

1. pöördumiste vastuvõtu struktureeritud vaadet;

1. vestlusruumi käivitamist eelpöördumisest/vastuvõtust;

1. teenusekatkemise lihtsat märget;

1. allikate tüübi ja staatuse kuvamise algversiooni.

20.10. Codexile antava suure ülesande pealkiri

Selle kogu mudeli võiks arendusülesandeks koondada nii:

Lisa SotsiaalAI platvormile teekonnakeskne töövoog: privaatne assistendivestlus → teekonnakaart → teenusekaart/eelpöördumine → vastuvõtt → koostööruum.

Codexi töö peaks jagunema etappideks:

1. Journey mudel ja UI.

1. Assistendi teekonnasõela väljund.

1. Teenusekaardi kontekstuaalne avamine.

1. Eelpöördumise sidumine teekonnaga.

1. Vastuvõtja struktureeritud vaade.

1. Vestlusruumi uued käivitajad.

1. Teenusekatkemise kontroll.

1. Allikate staatuse ja rolli kuvamine.

20.11. Avalik sõnum

Avalehe või “Meist” lehe jaoks võiks kogu mudeli kokku võtta nii:

SotsiaalAI aitab liikuda olukorra kirjeldusest järgmise praktilise sammuni. Kasutaja saab alustada privaatsest vestlusest, mille põhjal tekib teekonnakaart: millised teemad võivad olla seotud, milline info vajab täpsustamist ja milline võiks olla järgmine samm. Vajadusel saab liikuda edasi teenusekaardi, eelpöördumise, dokumendi analüüsi, dokumendi koostamise, abisoovi või jagatud koostööruumi juurde. Spetsialistidele ja teenuseosutajatele pakub SotsiaalAI struktureeritud eelinfot, allikapõhiseid töömustandeid ja paremini ettevalmistatud suhtlust.

20.12. Kõige lühem lõplik kokkuvõte

SotsiaalAI uus mudel on teekonnakeskne: inimene kirjeldab olukorda, AI aitab selle põhjal luua teekonnakaardi ning sealt liigub kasutaja sobiva järgmise sammuni — kontakt, eelpöördumine, eelkaardistus, dokument, abisoov või koostööruum. Spetsialist ja teenuseosutaja saavad ainult kasutaja kinnitatud eelinfot ning kasutavad SotsiaalAI-d töömustandite, allikate ja koostöö toetajana, mitte ametliku hindamise või otsuse asendajana.

# 21. Codexile antav arendusülesanne

See punkt muudab kogu senise mudeli arendajale kasutatavaks ülesandeks. Eesmärk ei ole Codexile anda korraga “ehita kõik valmis”, vaid jagada uus teekonnakeskne loogika selgeteks tööpakettideks.

Kõige lühem ülesande pealkiri võiks olla:

Lisa SotsiaalAI platvormile teekonnakeskne töövoog: privaatne assistendivestlus → teekonnakaart → teenusekaart/eelpöördumine → vastuvõtt → koostööruum.

21.1. Arenduse eesmärk

SotsiaalAI praegused funktsioonid tuleb siduda uue keskse objektiga: teekonnakaart.

Kasutaja ei peaks alustama funktsiooni valikust, vaid olukorra kirjeldamisest. Assistendi vestlus peab looma esmase teekonnasõela ja selle põhjal teekonnakaardi, kust kasutaja saab liikuda edasi sobiva tööriistani.

Põhivoog:

Privaatne assistendivestlus
→ esmane teekonnasõel
→ teekonnakaart
→ soovitatud järgmised sammud
→ teenusekaart / eelpöördumine / dokumendi analüüs / abisoov / koostööruum

21.2. Esimene tööpakett: Journey ehk teekonnakaardi andmemudel

Codexi esimene ülesanne võiks olla luua uus andmemudel.

Vajalik objekt

Journey või JourneyMap

Põhiväljad:

{
"id": "journey_001",
"ownerUserId": "user_001",
"roleContext": "CLIENT",
"status": "PRIVATE",
"title": "Koduse toimetuleku mure",
"summary": "Kasutaja kirjeldab raskusi igapäevase toimetulekuga kodus.",
"primaryPath": "SOCIAL",
"secondaryPaths": ["KOV_SOCIAL_SERVICES", "HEALTH_CONTACT"],
"domains": ["DAILY_LIVING", "PHYSICAL_HEALTH", "HOME_SUPPORT"],
"riskSignals": [],
"missingInfo": ["municipality", "existingDecisionOrPlan"],
"suggestedActions": [
"OPEN_SERVICE_MAP",
"CREATE_PRECONTACT",
"ANALYZE_DOCUMENT"
],
"sharingStatus": "NOT_SHARED"
}

Nõuded

- Teekonnakaart kuulub alati konkreetsele kasutajale.

- Algolek on alati privaatne.

- Teekonnakaarti ei jagata automaatselt ühelegi osapoolele.

- Teekonnakaart peab olema hiljem seotav eelpöördumise, teenusekaardi kirje, dokumendi ja vestlusruumiga.

21.3. Teine tööpakett: assistendi esmane teekonnasõel

Privaatne assistent peab suutma kasutaja olukorra kirjelduse põhjal luua struktureeritud väljundi.

Teekonnasõela väljund

{
"summary": "Kasutaja kirjeldab raskusi kodus toimetulekuga.",
"primaryPath": "SOCIAL",
"secondaryPaths": ["HEALTH_CONTACT"],
"domains": ["DAILY_LIVING", "PHYSICAL_HEALTH"],
"riskSignals": [],
"missingInfo": ["municipality"],
"suggestedActions": [
"OPEN_SERVICE_MAP",
"CREATE_PRECONTACT"
]
}

Sõel peab tuvastama

- kas teema on sotsiaalvaldkonna küsimus;

- kas võimalik esimene kontakt on KOV;

- kas võimalik esimene kontakt on teenuseosutaja;

- kas võimalik esimene kontakt võib olla perearstikeskus/tervisekeskus;

- kas on teenusekatkemise risk;

- kas on kriisi- või ohusignaal;

- kas sobib dokumendi analüüs;

- kas sobib abisoovi/abipakkumise töövoog;

- milline oluline info on puudu.

Piir

Teekonnasõel ei ole ametlik hindamine. UI-s tuleb vältida sõnastust “SotsiaalAI hindas abivajadust”.

21.4. Kolmas tööpakett: teekonnakaardi UI

Teekonnakaart tuleb kuvada kasutajale lihtsa kaardina.

Kaardi plokid

- Olukorra kokkuvõte

- Seotud teemad

- Puuduolev info

- Võimalikud järgmised sammud

- Riskimärgid, kui olemas

- Privaatsuse märge

Nupud

- Ava teenusekaart

- Koosta eelpöördumine

- Lisa dokument analüüsiks

- Loo abisoov

- Salvesta teekond

Kohustuslik tekst

See teekonnakaart on privaatne. Seda ei jagata enne, kui sa ise kinnitad jagatava info.

21.5. Neljas tööpakett: teenusekaart teekonna kontekstis

Teenusekaart peab avanema teekonnakaardi sisendi põhjal.

Teekonnast teenusekaardile kaasa anda

- piirkond, kui teada;

- seotud valdkonnad;

- sihtrühm;

- kas otsitakse KOV kontakti;

- kas otsitakse teenuseosutajat;

- kas võib olla vaja tervisekontakti;

- kas on teenusekatkemise risk.

Teenusekaardi kirjel peab olema

- entryType: KOV_CONTACT | KOV_SERVICE | SERVICE_PROVIDER | HEALTH_CONTACT

- accessType: DIRECT | KOV_ASSESSMENT | KOV_DECISION | HEALTH_CONTACT | REFERRAL_REQUIRED | PROVIDER_TRIAGE | UNKNOWN

- firstStep

- decisionBy

- sourceType

- sourceStatus

- lastChecked

Tegevused kirje juures

- Lisa teekonnale

- Koosta eelpöördumine

- Küsi tingimusi

- Vaata, kuidas teenuseni jõuda

21.6. Viies tööpakett: eelpöördumine teekonnakaardist

Eelpöördumine peab saama sisendi teekonnakaardilt ja valitud osapoolelt.

Eelpöördumise tüübid

- BRIEF_NOTICE

- SHORT_PRECONTACT

- SHORT_FORM

- EXTENDED_MAPPING

- GUIDED_MAPPING_REQUEST

- SERVICE_CONTINUITY

Täitmise viisid

- SELF_COMPLETED

- WITH_SPECIALIST_IN_ROOM

- AUDIO_SUPPORTED

- IN_PERSON_REQUESTED

- WRITTEN_REPLY_ONLY

Enne saatmist

Kasutajale tuleb näidata eelvaadet:

Seda näeb vastuvõtja.

Kasutaja peab saama:

- muuta teksti;

- eemaldada infot;

- lisada infot;

- kinnitada adressaadi;

- kinnitada jagamise.

21.7. Kuues tööpakett: pöördumiste vastuvõtu uus kaart

Spetsialistile ja teenuseosutajale ei tohi kuvada lihtsalt pikka teksti. Tuleb kuvada struktureeritud eelinfo kaart.

Vastuvõtja näeb

- pöördumise tüüp;

- peamine mure;

- inimese enda soov;

- seotud valdkonnad;

- täitmise viis;

- kaardistuse tase;

- teenusekatkemise risk, kui olemas;

- puuduolev info;

- lisatud dokumendid;

- eelistatud suhtlusviis.

Vastuvõtja tegevused

- Võta vastu

- Küsi lisainfot

- Paku vestlusruumi

- Paku kohtumist

- Märgi mitteasjakohaseks

- Sulge

Vastuvõtja päisetekst

See on kasutaja kinnitatud eelinfo. Tegemist ei ole ametliku hindamisega. Kasuta seda vestluse või edasise töö ettevalmistamiseks ning otsusta järgmine samm oma töökorra järgi.

21.8. Seitsmes tööpakett: vestlusruumi uued käivitajad

Olemasolev kutse leht jääb alles. Seda ei tohi eemaldada.

Lisada tuleb uued käivitajad:

- eelpöördumisest;

- pöördumiste vastuvõtust;

- teekonnakaardilt;

- juhendatud eelkaardistuse soovist;

- abisoovi/abipakkumise matchist.

Üks ruumi süsteem

Ei tohi luua eraldi vestlusruumide süsteeme. Kasutada sama ruumi objekti, aga lisada roomType.

{
"roomType": "MANUAL_INVITE | PRECONTACT | GUIDED_MAPPING | HELP_MATCH | SERVICE_INTAKE | COVISION",
"sourceId": "pre_001",
"createdFrom": "INTAKE"
}

Sponsoreeritud ligipääs

Olemasolev võimalus, kus kutsuja saab tasuda kutsutu ühe kuu eest, jääb alles. Seda kasutada eelkõige eraisiku, lähedase või abistaja kutsumisel.

Ametliku spetsialisti või teenuseosutaja puhul eelistada rollipõhist ligipääsu või piiratud vastuvõtuvaadet.

21.9. Kaheksas tööpakett: teenusekatkemise kontroll

Teenusekatkemise kontroll käivitub, kui kasutaja kirjeldab, et teenus lõpeb, katkeb, teenuseosutaja muutub või järgmine samm on ebaselge.

MVP loogika

Kui tuvastatakse teenusekatkemise signaal, lisada teekonnakaardile märge:

Teenuse jätkumine vajab kontrollimist.

Küsida kolm asja:

1. Mis teenus on lõppemas?

1. Millal see lõpeb?

1. Kas sul on olemas otsus, teenuseplaan või kiri?

Pakkuda tegevused

- Lisa dokument analüüsiks.

- Koosta teenuse jätkumise eelpöördumine.

- Leia KOV kontakt.

- Küsi teenuseosutajalt tingimusi.

21.10. Üheksas tööpakett: teadmuspõhja ja allikate staatused

Allikad ja teenused vajavad uusi välju.

Allikal

- sourceType

- sourceStatus

- lastChecked

- authorityLevel

- supports

Teenusel

- serviceType

- organizer

- accessType

- firstStep

- decisionBy

- requiresAssessment

- requiresDecision

Allikate paneel

Allikate paneel peab kuvama ainult vastuses tegelikult kasutatud allikad.

Iga allika juures kuvada:

- pealkiri;

- allikatüüp;

- staatus;

- viimati kontrollitud;

- mida see vastuses toetas.

21.11. Vastuvõtukriteeriumid

Arendus on esimeses etapis õnnestunud, kui saab läbi teha selle voolu:

Kasutaja kirjeldab olukorda
→ AI loob teekonnakaardi
→ kasutaja avab teenusekaardi
→ valib KOV kontakti või teenuseosutaja
→ koostab eelpöördumise
→ kinnitab jagatava eelinfo
→ vastuvõtja näeb struktureeritud pöördumist
→ vastuvõtja saab pakkuda vestlusruumi

Lisaks peab olema täidetud:

- privaatset assistendivestlust ei jagata;

- kasutaja kinnitab kogu jagatava info;

- teekonnakaart on vaikimisi privaatne;

- eelpöördumist ei nimetata ametlikuks hindamiseks;

- teenusekaart ei luba teenust ega suunamist;

- tervisekontaktid on piiratud esmatasandi kontaktide loogikaga;

- teenusekatkemise risk on märgis, mitte ametlik otsus;

- allikatel on tüüp ja staatus.

21.12. Esimene Codexi prompt

Selle võiks Codexile anda nii:

Lisa SotsiaalAI platvormile teekonnakeskse töövoo esimene versioon.
Eesmärk:
Kasutaja peab saama alustada privaatses assistendivestluses olukorra kirjeldamisest. Assistendi vastuse põhjal tuleb luua privaatne teekonnakaart, mis kuvab olukorra kokkuvõtte, seotud teemad, puuduoleva info, võimalikud riskid ja järgmised sammud. Teekonnakaardilt peab saama avada teenusekaardi, koostada eelpöördumise või lisada dokumendi analüüsiks.
Oluline piir:
Teekonnakaart ei ole ametlik hindamine ega teenuseotsus. Privaatset assistendivestlust ei jagata. Vastuvõtja näeb ainult kasutaja kinnitatud eelinfot.
Tööde järjekord:
1. Loo Journey/JourneyMap andmemudel.
2. Lisa assistendi teekonnasõela struktureeritud JSON-väljund.
3. Loo teekonnakaardi UI.
4. Seo teekonnakaart teenusekaardiga.
5. Seo teekonnakaart eelpöördumisega.
6. Lisa eelpöördumise eelvaade enne saatmist.
7. Täienda pöördumiste vastuvõttu struktureeritud eelinfo kaardiga.
8. Lisa vestlusruumi käivitamine eelpöördumisest või vastuvõtust.
9. Lisa teenusekatkemise riskimärge.
10. Lisa allikatele tüübi ja staatuse kuvamise alus.
Ära eemalda olemasolevat kutse lehte ega olemasolevaid vestlusruume. Lisa ruumidele vajadusel roomType ja sourceId, et sama ruumisüsteemi saaks käivitada mitmest töövoost.

21.13. Kokkuvõte

Punkt 21 on praktiline sillakoht visiooni ja arenduse vahel.

Kõige tähtsam arendusotsus:

ära ehita uut paralleelset platvormi, vaid lisa olemasolevatele funktsioonidele teekonnakiht.

Tehniline tuum:

Journey → PreContact → Intake → Room

Kasutajakogemuse tuum:

Kirjelda olukorda → saa teekonnakaart → vali järgmine samm → kinnita jagatav info → jätka vajadusel koostööruumis.
