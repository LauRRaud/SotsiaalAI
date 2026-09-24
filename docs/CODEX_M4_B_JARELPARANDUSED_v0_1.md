# Codex: M4-B järelparandused — keel, viited, tõendijälg ja taastamine

Versioon: 0.1 · 06.09.2026

## 1. Töö eesmärk ja alus

Jätka olemasolevat M4 teostust. Tee üks piiritletud parandusplokk, et vastuse keel, struktureeritud viited, allikatoe kasutamine ja ka ebaõnnestunud pöörde taastamine oleksid kontrollitavad. See ei ole uus RAG-arhitektuur, M2 kordushindamine ega üldine graafiprojekt.

Alus on omaniku lisatud `docs/audits/rag-v2-m4-b-pilot-2026-09-06.md` (edaspidi [A]) ja uusim `docs/platvormi arendus/SotsiaalAI.md` S1.0. Varasem `CODEX_M4_SISEPILOOT_v0_1.md` jääb üldlepinguks. Käesolev ülesanne täpsustab selle täitmist pärisjooksus leitud puuduste põhjal.

[A] kirjeldab kaheksat UI kaudu tehtud küsimuse/vastuse katset: seitse avaldatud vastust, üks `invalid_answer_reference` tõttu peatatud katse. Mõlemale ingliskeelsele küsimusele vastati eesti keeles; toored või dubleeritud tekstiviited esinesid viies avaldatud vastuses. Osas väidetes on vale ulatusega allikatugi. Neljanda katse algne tõenduspakett ja vigase viite täpne väärtus ei ole aruande järgi taastatavad. Pärast värskendamist kadus peatatud pööre kasutajavaatest, mitte andmebaasist. [A, read 30–59 ja 61–69]

Need on aruandest pärinevad leiud. Selle ülesande koostamine ei ole lähtekoodi, serveri ega privaatsete `real-results.json` ja `answer-review.json` sõltumatu audit.

## 2. Alusta olemasolevast seisust, mitte vanast plaanist

Loe tegelik tööpuu ja aktiivne S1.0. Audit nimetab serverisse paigaldatud SHA-d `fbd396b0393d09b4bff0cb318c9c7126042e83bd`, kuid see pole luba asendada praegust tööpuud selle commit'iga. Säilita omaniku muud tööd ning ajaloolised manifestid ja raportid.

Kasuta olemasolevaid `lib/rag-v2/pilot/`, platvormi adapteri, `/vestlus` ja kaitstud allikavaate ühendusi. Ära loo teist vestlusliidest, uut autentimist ega paralleelset kulupäevikut.

Enne parandamist koosta lühike tabel: aruande puudus → tegelik kooditee → olemasolev või uus regressioonikontroll. Ära korda lõppenud M0–M2 diagnoosi. Kui vajalik privaatne artefakt on puudu või aegunud, nimeta see ja kasuta mehaanikatestis selgelt sünteetilist sisendit; ära nimeta seda originaalse pärisvea taasesituseks.

## 3. Selle töö piirid

Selles töövoorus on lubatud kohalik teostus ja testid olemasolevate lubatud artefaktide või sünteetilise transpordiga. Välismudelikutseid: 0. Loo eraldatud testandmed, ära kopeeri ülejäänud tootmisvestlusi.

Säilita otsinguprofiil, kaheksa dokumendi versioonipilt, embedding-ruum, mudelivalik ja kontekstieelarve. Ära muuda fusiooni, dokumendikvoote, tükeldamist, M2 rubriiki ega seitset lahtist M2 juhtumit. Ära lisa tõlkeagenti, hindavat mudelit, automaatset paranduskutset, alternatiivmudelit ega autonoomset lisaotsingut.

Viitekontrolli ja ligipääsupiire ei nõrgendata. Kehtiv ID ei tähenda semantiliselt tõendatud väidet. Puuduvat viidet ei kustutata selleks, et väide näiks kontrollitud.

Push, deploy, teenuste restart, uued päriskutsed, loa pikendamine ja avaliku vastamise avamine ei kuulu selle ülesande automaatsesse käivitusõigusse. Eelmise jooksu vastuseid ega andmebaasi ajaloolisi tulemusolekuid ei kirjutata tagantjärele ümber.

## 4. Parandus A: tõendijälg ja ebaõnnestunud pöörde taastamine

### 4.1 Kontrollitav saatmiseelne ja vastuvõtujärgne seis

Enne vastamisteenuse kutset püsista või seo juba püsistatud muutumatu kirjega päriselt saadetav kompaktne tõenduspakett, viitekaart, allikaversioonid/põlvkond, küsimuse ja sihtkeele identiteet ning prompti/profiili/väljundskeemi versioonid. Pelgast räsist ei piisa hilisema sisuülevaatuse jaoks: sisu peab olema lubatud säilitusaja jooksul turvaliselt taastatav. Ära salvesta kõiki otsingu kandidaate ega tervet korpust, kui need mudelile ei läinud.

Kui selle kirje püsistamine ebaõnnestub, ei alustata uut tasulist kutset. Säilita olemasolevad idempotentsus- ja reserveerimisreeglid; ära hoia andmebaasi tehingut välise mudelikutse ootel lahti.

Pärast teenuse vastust säilita kaitstud, piiratud ja aeguv kirje mudeli tagastatud lõppvastuse mustandist, request ID-st, teadaolevast kasutusest ning valideerimise tulemusest. Ära kogu varjatud arutluskäiku ega võtmeid. Struktuuri/viitevea korral säilita võimaluse piires välja asukoht, saadud viitetunnus, lubatud viidete hulk ja veakood. Mittevajalik toorsisu ei lähe üldlogisse, avalikku kataloogi ega Gitti. Vale või ülisuur vastus ei tohi põhjustada piiramatut logimist; diagnostika kärpimine peab olema märgitud.

Olemasolevad õiguste, kustutamise ja säilitustähtaja kontrollid laienevad ka vigastele mustanditele ning auditipakettidele. Käesolev ülesanne ei pikenda nende eluiga. Kustutatud/keelatud vestlust ei tohi hiline mustand uuesti luua.

### 4.2 Teadaolev valideerimisviga ei ole teadmata teenusekatse

Erista vähemalt järgmisi tähendusi, taaskasutades võimaluse korral olemasolevaid olekuid:

- teenuselt vastus saadud, avaldamise kontroll ebaõnnestus;
- teenuse tulemuse saabumine on teadmata;
- vastus kontrollitud ja avaldatud.

Teadaolev viitevalideerimise ebaõnnestumine on sama katse lõppolek, mitte käsk uuesti genereerida. Kasutus, katsete loendurid ja konservatiivsed reserveeringud ei lähtestu. Aktiivse töö luku vabastamist ei tohi segi ajada kulupiiri vabastamisega. Teadmata teenusetulemuse puhul säilib senine ettevaatlik taastamispoliitika.

### 4.3 Kasutajale taastub ka ebaõnnestumine

Vestluse lugemine peab tagastama kõigi talle lubatud pöörete nähtava oleku, mitte ainult avaldatud vastused. Värskendamine, allikavaatest tagasitulek või rakenduse restart taastab ebaõnnestunud küsimuse ja lokaliseeritud veateate samas järjekorras; vigast mustandit ei avaldata.

Näidissisu: „Vastust ei avaldatud, sest allikaviidete kontroll ebaõnnestus. Uut vastamiskatset ei tehtud.” Täpne sõnastus tuleb olemasolevatesse tõlkekataloogidesse. Kasutajale ei näidata tundmatu viite sisu ega privaatset diagnostikat.

Sama pöördevõtmega päring taastab sama lõppoleku, ilma embedding'u, genereerimise või uue otsinguga algset katset asendamata. Uut kasutaja algatatud katset ei lisata sellesse lõppenud kaheksa küsimuse plaani.

Algne neljas katse jääb ajalooliselt „peatatud, täpne viiteviga taastamatu”, kui täiendavat originaalartefakti ei leita. Hilisem lokaalne otsing on uus diagnostiline rekonstruktsioon, mitte algse paketi tõend.

## 5. Parandus B: üks viidete leping ja üks renderdaja

Loe esmalt tegelikku vastuse skeemi. Eelista olemasoleva ploki teksti ja struktureeritud viitevälja parandamist, mitte uue keerulise vahekihi loomist.

Mudel annab loetava teksti ning eraldi viidete loendi. Nähtava viitemärgi/linkide vormi teeb rakendus ainult valideeritud viidete põhjal. Mudelilt ei tellita samade viidete samaaegset kirjutamist vabateksti `cite`-märgendite ja struktureeritud viidete kujul.

Server kontrollib, et iga viide kuulub just selle pöörde antud tõendusmaterjali hulka, lahendub õigesse versiooni/allikakohta ning on kasutajale endiselt lubatud. Pelgalt mustrile `S1` vastamine pole piisav. Tundmatu viide jääb veaks. Mitte ühtegi viidet ei asendata automaatselt esimeseks sobiva nimega allikaks.

Eemalda sama ploki struktureeritud loendist identsed kordused deterministlikult. Sama allika kasutamine eri väidete juures pole iseenesest vigane dubleerimine; iga väite tugi peab jääma jälgitavaks. Hoia leitud allikate üldloend ja konkreetses vastuses kasutatud viited eristatavana.

Varem salvestatud vastuste lugemine peab olema versiooniteadlik. Ajalooline mustand säilib; uus kuvakuju võib olla eraldi tuletatud esitus. Kui rakendad vanadele toormärkidele ühilduvusparserit, töötle ainult täpselt tuntud süntaksit ja üheselt sama ploki valideeritud viidet. Tundmatu/mitmetähendusliku märgi kustutamine ei ole lubatud „parandus”. Ära eemalda sõna `cite`, nurksulge ega allikateksti suvalise laia regulaaravaldisega.

Testi algne vastamine ja hilisem salvestatud vastuse renderdus sama lepinguga. Uus viitekuju ei nõrgenda HTML-i põgenemist, allikapaneeli ligipääsu ega versioonikontrolli.

## 6. Parandus C: serveri kinnitatud vastusekeel

Aruande EN-katsetes oli `query.language=en` juba olemas. Esimene töö on jälgida selle väärtuse liikumist küsimusest tegeliku vastamispäringu, prompti, salvestamise ja kuvamiseni, mitte muuta dokumentide otsingukeelt. [A, read 37, 40, 50 ja 63]

Üks serveris kontrollitud sihtkeel peab määrama kõigi kasutajale nähtavate vastuseosade keele: põhitekst, pealkirjad, piirangud ja täpsustusküsimused. Prompt seob selle eksplitsiitselt küsimuse keelega. Allika keel, kasutajaliidese vaikekeel või varasema pöörde keel ei tohi seda üle kirjutada.

Säilita allikatsitaatide, teoste pealkirjade ja pärisnimede vajaduspõhised erandid. Ära tõlgi või muuda kanoonilist allikateksti. Ära lisa teist mudelikutset valmis vale keele parandamiseks.

Test peab vaatama tegelikku nähtavat teksti ja prompti koostamist, mitte ainult mudeli enda `language=en` väljale lootma. Kohalik asendustransport tõendab keele käsu liikumist ja UI renderdust, mitte Luna keelekuulekust. Viimane vajab hilisemat lubatud päriskatset. Üldist veatut keeletuvastajat selles plokis ei lubata ega ole vaja lisada.

## 7. Parandus D: väite ulatus, allikatugi ja kasulik osavastus

Aruanne kirjeldab lisaks viitekujule sisulisi probleeme: Tamil Nadu konkreetne väide viitab üldpõhimõtetele, väide „vähenev” lisab allikata ajalise muutuse, artikliküsimusele lisanduvad ebapiisavalt tõendatud üldnõuded ning õppefaktilehe sammu esitatakse liiga üldisena. Need ei kao viitemärkide puhastamisega. [A, read 40–45]

Täpsusta olemasolevat üldist vastamisjuhist:

- Iga allikapõhine väide peab toetuma selle väite tegelikku sisu ja ulatust kandvale antud allikale. Üldpõhimõtte viide ei tõenda üksikjuhtumi fakti. Kui ploki eri mõtted nõuavad erinevat tuge, jaga plokk mõistlikult või seo kõik vajalikud viited täpselt; ära kinnita kõiki leitud allikaid kõigile plokkidele.
- Säilita allika autorlus/roll, aeg ja laad: „artikli järgi”, „koolitusnäites”, „selle allika avaldamise ajal”. Soovitus ei muutu kohustuseks, eesmärk mõõdetud mõjuks ega seisund tõendatud ajalooliseks muutuseks.
- Vastus ei laiene küsimata õiguslikele, menetluslikele või muudele faktiväidetele, millele antud materjal tuge ei paku. Sujuvad üleminekud ja täpsustusküsimus ei vaja väljamõeldud viidet, kuid faktilist nõu ei tohi peita üldise soovituse sildi taha.
- Piirang sõnastatakse ainult vastust mõjutava puuduva teadmise kohta. Teadaolevat inimesele suunamise võimalust ei muudeta teadmata kanaliks. Samuti ei järeldata ühes paketis puuduva detaili põhjal, et teavet pole kogu andmebaasis.
- Säilita kasulik toetatud vastuseosa. Väldi nii kindlas toonis lünkade täitmist kui ka kõigile küsimustele keeldumist. Vastuseta kohaliku hinna korral küsi vajalikku piirkonda; ära asenda seda õppematerjali või programmieelarve arvuga.

Need on üldised vastamisreeglid. Hesteri/Tamil Nadu nimed, õiged vastusetekstid, piloodiküsimuste räsid ja hindamismärgised ei lähe runtime'i eranditabelisse. Konkreetseid allikaviiteid, nagu `S1`, ei kõvakodeerita prompti või järelparandusse.

Semantilist tuge ei kuulutata programmikontrolliga garanteerituks. Muudatuse sisulist mõju hinnatakse hilisema pärisvastuse ja sellele päriselt antud paketi võrdluses. Uut hindajat-agentide ahelat ei lisata.

## 8. Vastuvõtukontrollid selles kohalikus töövoorus

Kasuta olemasolevat testikäivitajat. Lisa või täienda vähemalt järgmisi kontrollitavaid juhtumeid; nende arv ei ole veel läbinud testide arv.

| ID | Kontroll | Nõutud tulemus |
| --- | --- | --- |
| F01 | Tõenduspaketi püsistus ebaõnnestub enne answer-kutset | Uut välist answer-katset ei alustata; pole näilist edu. |
| F02 | Sünteetiline tundmatu viide struktureeritud väljas | Avaldamine peatub; mustand, antud viited, vea asukoht ja teadaolev usage on lubatud diagnostikas taastatavad. |
| F03 | Kehtiva kujuga võõra pöörde/keelatud allika viide | Tagasilükkamine ja kehtivate õiguste kontroll säilivad. |
| F04 | Protsessi restart pärast valideerimisviga | Taastub sama terminalne veaseis; uusi embedding-/answer-kutseid pole. |
| F05 | UI refresh ja allikavaatest tagasi pärast segamini edukaid/ebaõnnestunud pöördeid | Kõik lubatud küsimused ja olekud taastuvad järjekorras, ilma duplikaatide või lõputu ooteta. |
| F06 | Kehtiv usage koos avaldamise veaga | Katse loeb kulusse ja etapipiiri; piir ei lähtestu. |
| F07 | Teadmata teenusetulemus | Seda ei muudeta teadaolevaks valideerimisveaks ega saadeta automaatselt uuesti. |
| F08 | Loa tühistamine, kustutamine ja tähtaja möödumine | Ei avaldata/taastata keelatud sisu, ka auditist ega hilise vastusega. |
| F09 | Sama pöördevõtme paralleelne/pärast-refresh kordus | Üks teenusekatse; sama lõpptulemus või sama viga. |
| F10 | Ühe ploki korduvad kehtivad viited ja sama viide eri plokkides | Plokisisene duplikaat puudub, eri väidete seosed säilivad. |
| F11 | Tuntud toormärgistus, tundmatu viide ja sõna „cite” tavatekstis | Ühilduvus on kitsas; tundmatut viidet ei peideta ja tavateksti ei lõhuta. |
| F12 | Uus ning ajaloolise skeemiga salvestatud vastus | Versiooniteadlik esitus; algartefakt jääb muutmata. |
| F13 | EN küsimus + ET UI/allikad; ET ja RU regressioonid | Vastamiskeel liigub õigesti tegelikku model body’sse; kõik vastuseosad kasutavad üht sihtkeelt. |
| F14 | Võltsitud allikasisene keele-/rollikäsk | Allikatekst jääb andmeks; prompti usaldatud väljad ei muutu. See ei tõenda veel mudeli täielikku juhisesüstikindlust. |
| F15 | Päriskatse seitsme olemasoleva vastuse lubatud lokaalne taasesitus | Viitekuju ja taastamine võrreldavad; uusi genereerimisi ega ajaloo ümberkirjutust pole. Puuduvad/ aegunud artefaktid märgitakse. |
| F16 | Kaheksa lõppenud katsega vana plaan, ka uus raportikaust | Üheksas answer ega embedding ei ole lubatud; lugemine ei käivita teenusekutset. |

Käivita mõjutatud tuuma-, provider'i lepingu-, püsistuse- ja HTTP/õiguste regressioonid ning nõutud lint/i18n/build. Ära esita vana läbimata regressioonisviiti selle vooru rohelise tulemusena. Näita pass/fail/skip ja katvuse piir. Tee tegelik lokaalne brauserikatse ka mobiilivaates, eriti taastatud veapöörde ja allikaavamise kohta.

## 9. Päriskontroll pärast kohalikke parandusi

Praegune ülesanne valmistab selle ette, kuid ei luba käivitada.

[A] järgi on mõlemad vana plaani etapiloendurid 8/8. Vaba rahaline jääk ei anna üheksandat katset ega ole luba uue nime all sama plaani lähtestada. Aruandes nimetatud vana loa lõppaeg on 07.09.2026 08:00 UTC; seda ei pikendata käesoleva ülesandega. [A, read 54 ja 73]

Valmista omaniku ülevaatuseks üks uus, eelmisele jooksule viitav parandustejärgne prooviplaan: soovituslikult samad kaheksa küsimust, kuni kaheksa uut vastamiskatset, kuni kaheksa uut embedding-katset ainult siis, kui olemasolevaid küsimusevektoreid ei saa lubatud ulatuses taaskasutada. Tegelik vajadus ja kulureserv arvutatakse plaanis; eelistus on olemasolevate vektorite taaskasutus. Uus plaan nõuab eraldi materjali-, mudeli-, katsetaja-, aja- ja kogukulupiiri heakskiitu ning ei kustuta vana ledgeri seisu.

Kus vana antud tõenduspakett on alles ja taaskasutus lubatud, saab hinnata vastamisparandust sama tõendusmaterjaliga. UI tervikproovis kontrolli lisaks tegeliku uue otsingu paketi võrdsust. Erinev pakett märgitakse, mitte ei peideta paarisvõrdlusse. Neljanda katse ajalooline pakett on aruande järgi puudu: uus pakett on uus tulemus, mitte algse vea taastatud tõend.

Sama kaheksa küsimuse uus jooks on regressioon, mitte puutumatu kontroll. Selle järel võib eraldi ulatuses kontrollida uusi küsimusi ja päris jätkuvestlust; neid ei lisata sellesse prooviplaani vaikimisi.

Hinda iga katse puhul: nähtav keel, toetatud põhivastus ja täielikkus, puuduv/vales ulatuses väide, tehniline viitekehtivus, viite semantiline sobivus, toormärkide puudumine, avaldamise/peatamise seis, refresh-taastus, usage ja aeg. Ära taanda tulemust ainult avaldatud vastuste osakaalule. Võimalik mudeli juhuslik varieeruvus jääb ühe kordusjooksu piiranguks.

## 10. Lõppväljund ja peatumiskoht

Esita üks kokkuvõte ja seotud artefaktid:

1. Millised aruande viis puudust said teostuse/paranduse ja millised jäid sisuliselt tõendamata.
2. Muutunud kood/prompt/skeem/renderdus koos versioonidega ja sõltumatud testitulemused.
3. Testtranspordiga tõend: viga → püsiv nähtav veapööre → refresh/restart → sama seis → 0 uut teenusekutset.
4. Viitekuju enne/pärast tuletatud lokaalses esituses; eraldi semantilised puudused, mida kuvaparandus ei lahenda.
5. Üks konkreetne uue päriskontrolli plaan ja veel vajalik omaniku luba.

Uuenda aktiivset S1.0 ja lisa olemasoleva M4-B auditi juurde kuupäevastatud järelparanduse osa. Vana pärisjooks, seitse vastust, neljanda katse tõendilünk ning algsed mõõtmised säilivad. Peatu enne päriskutseid ja serverimuudatusi.

## Viitealus

[A] `docs/audits/rag-v2-m4-b-pilot-2026-09-06.md`, kasutaja lisatud koopia 06.09.2026: ettevalmistus read 7–19; teostuse kontrollid 21–28; pärisjooks ja küsimusepõhised leiud 30–45; nimetajad/kulu/piirid 47–55; piirangulause ja viis puudust 57–69; loa lõpp ja räsiseosed 71–73.

Selles ülesandes esitatud parandused on arendusnõuded ja ettepanekud, mitte juba teostatud või mõõdetud tulemused. Teenuse avalikku hinnakirja ega konto saadavust selle ülesande koostamisel uuesti ei kontrollitud.

Sisendina loetud auditifaili SHA-256: `d4bb29c3f44998fbd51418d81ac96228b69e1ee255aa86b74060502897ee2c9f`.
