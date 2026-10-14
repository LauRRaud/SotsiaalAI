# Sotsiaal.pro tõenduskatsete tulemused — sol-proof-20261014-01

14.10.2026. **Vahetulemus: serveri lähtekontroll on käimas; kogu 52 juhtumiga kavand pole täidetud.** Omaniku juhisel kasutatakse põhiliseks kinnituseks serveris töötavat arendusplatvormi ja selle tegelikku andmebaasi. Platvorm ei ole produktsioonis. Kohalik eraldatud keskkond jääb tõrke- ja hävitavate katsete abivahendiks.

Käivituskavand: [14.10 kontrollikavand](sotsiaal-pro-toenduskatsete-kavand-2026-10-14.md). Täpne edenemine ja kõik variandid: [case-progress.json](evidence/sol-proof-20261014-01/case-progress.json).

**Praegune otsus:** eelpöördumise, Teekonna ja teenuseosutaja mustandi sisuline teostus toimib kontrollitud serveri teenusekihtides. Leiti vastuvõtujärgse võrgustikujagamise viga. Omanik lubas nüüd täpselt kolme tavarolli testkonto ligipääsu `/admin` sisselogimise kaudu. Selleks valmistati ajutine avamisvärava erand; enne serverisse paigaldamist läbisid 13 seansi- ja õigusekontrolli ning sihitud süntaksikontrolli. Algne 41 variandiga lähtekontroll tehti enne seda muudatust.

**Keskkond ja tõendi ulatus.**

Serveri aktiivne väljalase on `b7466af8d039c248e19693a32a3475f47205649b`; frontend töötab. Testid kasutavad sama väljalaske serverimooduleid ja frontendiga sama andmebaasi. Moodulite eraldi käivitus tehakse `/tmp/sol-proof-20261014-01` töökohast: protsess saab ainult vajaliku andmebaasiühenduse ja tegelikud funktsioonilipud, mitte mudeli-, SMTP- või makseteenuste võtmeid. Sellest töökohast ei laadita rakenduse dotenv-faile.

Kõik uued kirjed seotakse selles katses loodud kasutajate ja tegevusvõtmetega. Olemasolevate kasutajate juhtumisisu ei kasutata. Väliseid kirju, päris makseid ega uusi tasulisi mudelipäringuid ei tehta. Uute sünteetiliste testandmete loomine tegelikus serveribaasis on omaniku otsene juhis.

Serveri teenusemooduli otsene kutse tõendab selle mooduli ja andmebaasi käitumist. HTTP autentimine, avamisvärav, API rollikontroll ja brauseri tervikrada on sellest eraldi tõendid. Positiivne teenusekatse ei muutu automaatselt kogu UI-raja läbimiseks.

**Testkontod ja omaniku lubatud ettevõte.**

Serveris loodi kolm tavakontot:

| Konto | Roll | Administraator |
|---|---|---|
| sol-proof-20261014-01-client@example.invalid | CLIENT — eluküsimusega pöörduja | Ei |
| sol-proof-20261014-01-specialist@example.invalid | SOCIAL_WORKER — sotsiaaltöö spetsialist | Ei |
| sol-proof-20261014-01-provider@example.invalid | SERVICE_PROVIDER — teenuseosutaja | Ei |

Kontod on märgitud profiilis „SOL TEST“. E-posti teavitused on nende kontode seadistuses välja lülitatud. Katseseansid saadi ühekordse fixture-tokeniga tegeliku HTTPS autentimisraja kaudu. Selle tulemusena ei väideta tavalise PIN/OTP/e-kirja sisselogimise läbimist. Kontode loomine ei tekitanud päris makset ega andnud adminiõigusi. [Kontode kirje](evidence/sol-proof-20261014-01/server-accounts.json).

Omanik lubas teenuseosutaja ja organisatsiooni katsetes kasutada **OÜ Küberloomet, registrikood 14206225**. Värske e-äriregistri brauserivaade kinnitas nime, aadressi ja omaniku antud kontaktmeili. Veebitööriista vahemällu salvestatud väljavõte kandis veel varasemat nime SotsiaalAI OÜ; juhtivaks tõendiks valiti värske registrivaade. [E-äriregistri ettevõtte leht](https://ariregister.rik.ee/est/company/14206225/O%C3%9C-K%C3%BCberloome).

Teenuseosutaja testkontole salvestati ettevõtte andmetega privaatne teenuseprofiili mustand ja organisatsioon „OÜ Küberloome — SOL TEST“. Teenuseprofiili staatus on DRAFT, kaardil nähtavus false. Ettevõtte kontaktmeili kasutatakse andmeväljana; esindusõiguse kinnituskirja ei saadetud ja profiili ei avaldatud. [Profiili ning elutsükli tõendid](evidence/sol-proof-20261014-01/server-company-and-lifecycle.json).

**Kontrollvariandid, mida praegu saab kinnitada.**

Esialgses serveri teenusekontrollis oli 41 varianti: 40 läbis ja üks ebaõnnestus. Ligipääsu erandi esimene HTTPS-kontroll lisas 32 varianti: 30 läbis, kaks blokeerusid katseprogrammi vale küsimuseindeksi tõttu. Küsimustiku sihitud kordus lisas kuus läbitud varianti ja lahendas mõlemad rakisetakistused. Brauser lisas kaheksa läbitud varianti. Kokku on **87 salvestatud varianti: 84 PASS, üks FAIL ja kaks ajaloolist HARNESS_OR_PRECONDITION**. Need pole 87 eri kavandijuhtumit. Ükski kataloogijuhtum ei ole üksnes selle koondarvu tõttu tervikuna lõpetatuks märgitud. Kogu 52 juhtumi läbimise protsenti sellest arvust ei arvutata.

| Teema | Vaadeldud tulemus | Tõendi piir |
|---|---|---|
| Kolme konto roll ja seanss | Tegelik seanss annab õige rolli; isAdmin=false | Kasutati fixture-tokenit; PIN/OTP rada pole kontrollitud |
| Avalik avamisvärav | „Peagi avame!“ on nähtav ja keelatud; töö-API annab ka sisselogitud tavakontole 503 | Tavarollide töövaadete tervikradu pole veel läbitud |
| Teekonna loomine ja kordus | Sama tegevusvõti tagastab sama kirje | Serveri teenusekutse, mitte kogu brauserivorm |
| Sammud ja enda hinnangud | Samm/tähtaeg salvestuvad; kordus ei tekita teist sammu; kaks hinnangut säilivad | Ei mõõda heaolu või kasutuskasu |
| Võõra Teekonna ja pöördumise nägemine | Teise katses osaleva kasutaja kutsed ei tagasta sisu | Piiratud kasutajapaarid ja teenusekiht; täielik API/ekspordimaatriks on veel ees |
| Eelpöördumine oma sõnadega | Salvestub ilma küsimustikuta, liigub INTERNAL rajal spetsialistile ning on talle nähtav | Edastatud eelinfo kasutamise mõju pole inimesega hinnatud |
| Pöördumise vastuvõtt | Spetsialisti vastuvõtt salvestab openedAt ja muudab oleku READY-ks | Asutuse täielikku vastuvõtulauda ei kontrollita selle individuaalse raja põhjal |
| Küsimustiku struktuur ja eksport | Seitse eluvaldkonda, 21 küsimuse seost; väljundis on mitteametlikkuse selgitus | Vaadeldi tühjade vormivariantide eksporti; kõik vastamis- ja RFK-harud ning ametliku allika täielik tekstivõrdlus on veel ees |
| Saatmiskordus ja tagasikutsumine | Kaks samal ajal tehtud saatmist ei tekita uut kirjet; tagasikutsumise järel kaob saaja nähtavus | Üks kordus sai sent_cannot_be_edited vastuse; kasutaja veakogemust ja dedicated send-raja idempotentsust tuleb UI/API katses eraldi hinnata |
| Lõpetamine ja Teekonna seos | Vastuvõtja lõpetatud pöördumine on ARCHIVED ning seotud Teekonna kirjes nähtav | Tagastatud state oli OPENED; selle UI tõlgendus vajab kontrolli enne lõpetatud seisundi arusaadavuse kinnitamist |
| Äriregistri nimekontroll | OÜ Küberloome on live-allika järgi match; varasem nimi mismatch | Ei tõenda kõigi liitumisvariantide ega MTR-i lubade kontrolli |
| Teenuseprofiil ja organisatsioon | Omaniku ettevõttega mustandid salvestusid; organisatsiooni kordus tagastab sama kirje | Avaldamine, esindusõiguse kinnitamine ja asutuse aktiivne töövoog on eraldi |
| Organisatsiooni piirid | Võõras spetsialist ei pääse testorganisatsiooni; mustand pole kirjutatav; ainus omanik ei saa liikmesust lõpetada | Aktiivse asutuse töötaja vahetus ja poolelioleva töö üleandmine pole selle katsega tõendatud |
| Avaldamise esindusõiguse kontroll | Kinnitamata esindusõigusega profiil lükatakse avaldamise kontrollfunktsioonis tagasi | Avaldamise kirjutavat rada ei käivitatud |

Tõendid: [serveri esmane rada](evidence/sol-proof-20261014-01/server-baseline.json), [kordused ja ettevõte](evidence/sol-proof-20261014-01/server-company-and-lifecycle.json), [organisatsiooni piirid](evidence/sol-proof-20261014-01/server-org-boundaries.json).

**Kolme tavarolli HTTPS-kontroll pärast ligipääsu erandit.**

Väljalaskega `249fa157` läbisid kolme testkonto seanss ja Teekonna töö-API. `/admin` suunas need töölauale; admini teenuse-API keeldus kõigil kolmel. Anonüümne töö-API jäi 503-ga suletuks. Teenuseprofiili API lubas teenuseosutajat ning keeldus kliendi ja sotsiaaltöö spetsialisti rollist.

Kliendi Teekonnast kinnitatud kaks välja (`summary`, `title`) eeltäideti eelpöördumisse. Oma sõnadega mustand salvestati, teksti muudeti ja see saadeti INTERNAL kanalil spetsialistile. Spetsialist sai eelinfo enne fiktiivset kohtumist HTTPS detailivastuses lugeda. Teekonna jagamata privaatne kontrollfraas ei olnud eeltäitmises ega saaja vastuses. Võõras spetsialist ja teenuseosutaja ei saanud Teekonda lugeda, muuta, eksportida ega sellest uut eeltäitmist küsida. Teenuseosutaja ei saanud teisele spetsialistile saadetud pöördumist lugeda, muuta, vastu võtta ega lõpetada. Asutuse mustandile saatmine keelduti, mitte ei märgitud vastuvõetuks.

Lühema ja põhjalikuma küsimustiku täitmise katses eeldas katseprogramm ekslikult, et esimeses eluvaldkonnas on vähemalt kaks küsimust. Test ei jõudnud selle vea tõttu küsimustiku HTTP-kutseni. See on katserakise piir, mitte platvormi funktsiooniviga; mõjutatud kaks varianti korratakse eraldi. [32 HTTP-varianti ja loodud kirjed](evidence/sol-proof-20261014-01/server-http-flow.json). Brauseri vormi ja spetsialisti nähtava töövaate tõend lisatakse eraldi.

**Küsimustiku sihitud kordus: kõik kuus varianti läbisid.** Mõlemad täidetud rajad salvestusid tegeliku HTTPS API kaudu ning jõudsid spetsialistile sama rajatähisega. 21 küsimuse seas säilis vastus UNKNOWN tundmatuna. Lühivormi 19 vastamata küsimuse olek jäi tühjaks, mitte GREEN-iks. Täisvormis täideti kõik 21 põhiküsimust, kuid kõiki vabateksti- ja RFK-harusid see ei kata. Kliendi ja saaja eksportides püsis mitteametliku eelinfo selgitus ning „ei oska öelda” vastus. Eksport genereeriti serveri sama mooduliga, mitte brauseri allalaadimisnupu kaudu. Algsete rakisevigade tõendid säilivad ajaloona ega lähe lahendamata platvormipuuduste hulka. [Kuus korduskontrolli](evidence/sol-proof-20261014-01/server-http-questionnaires.json).

**Kinnitatud puudus: võrgustikujagamine pärast vastuvõttu.**

Sama spetsialist sai teha talle saadetud eelpöördumisest võrgustikujagamise mustandi enne vastuvõttu. Vastuvõtt viis pöördumise olekusse READY. Seejärel keeldus sama lubatud jagamise loomine veaga `network_share.source_inactive`. Viga kordus tegeliku serveri koodi ja andmebaasiga. [Taasesituse variant FLOW-08](evidence/sol-proof-20261014-01/server-baseline.json).

See toetab arendusülesannet D01: lubatud vastuvõtujärgne jätkutöö ei tohi katkeda sisemise olekunime tõttu. Tuleb säilitada saajaõigus, kliendi jagamiskinnitus ja sulgemise piir. Viga ei tõenda, et kogu jagamine või eelpöördumise idee oleks mittetoimiv. Parandust pole tehtud.

**Teavitustöö: avamisvärava seose kohta on uus serveritõend.**

14.10 serveri olekuvaatlus näitas teavitusteenuse failed-olekut. Piiratud journal-vaatlus leidis kolm teavitustöö HTTP 503 tõrget; muud logisisu ei toodud raportisse. Sama töö aadressi ohutu GET-päring tagastas 503 koos `platform_not_open` ja `room.opening_soon` vastusega. Päris teavitustööd ei käivitatud.

Koos allikakoodiga, milles töö-API on avamisvärava taga ning ajastatud töö ei kasuta inimese adminiseanssi, toetab see konkreetset järeldust: suletud avamisvärav takistab teavitustöö aadressi kasutamist. Kõigi taustatööde põhjust või saamata jäänud teadete arvu pole mõõdetud. Olemasolevat arenduskeskkonna failed-olekut ei käsitleta tõendatud kahjuna päriskasutajale. [API vaatlus](evidence/sol-proof-20261014-01/server-org-boundaries.json).

**RAG-i mehhanismide kontroll ja selle piir.**

Serveri kehtivusfunktsioon eristas sünteetiliste kuupäevadega kehtivat, tulevast, aegunud ja teadmata kehtivusega õigusversiooni. Viitekontroll võttis lubatud viite vastu ning lükkas puuduva ja paketti mittekuuluva viite tagasi. Puuduva info ja täpsustamise vastusevormid olid lubatud. [Üheksa komponendivarianti](evidence/sol-proof-20261014-01/server-rag-controls.json).

Kontroll kinnitas ka piiri: struktuuriliselt sobiv väljamõeldud valeväide päris viite-ID-ga läbib viite olemasolu kontrolli. See oli teadlikult koostatud fixture, mitte mudelilt saadud vastus. Sellest ei järeldu ühegi praeguse mudelivastuse hallutsinatsioon; sellest järeldub, et struktuurikontroll ei tõenda väite sisulist tuge. Normikontrolli vaikimisi refusedKinds on tühi, seega see osa on auditiks.

14.10 kell 12.07 EEST vaadeldud aktiivses RAG-plaanis oli 10 856 dokumendikirjet, juhis `m4-grounded-dialogue-43`, development_only kasutus ning üks lubatud kasutaja. Lubatud kasutaja identifikaatorit ei avaldatud. [Plaani vaatlus](evidence/sol-proof-20261014-01/rag-plan-observation.json). Uut mudelivastuste kvaliteedivooru selles etapis ei tehtud; praeguse versiooni sisuline õigsusmäär on endiselt NOT_PROVEN.

**Kohalikud täiendavad kontrollid.**

**Serveri brauseri töövaated.** Väljalase `d8776011` jõudis serverisse; selle GitHubi quality-gate ja deploy läbisid. `/admin` sisselogimisrajalt jõudsid kõik kolm fixture-seanssi tavarollis töölauale, mitte haldusvaatesse. Kliendi saadetud pöördumise vaade ütles selgelt „ootab vastuvõtmist”, mitte et abi oleks juba korraldatud. Spetsialisti tööjärjes ja detailis oli enne fiktiivset kohtumist nähtav inimese vabas vormis kirjeldus; küsimustiku puudumine ei takistanud lugemist. Teenuseosutaja salvestas nähtavas vormis OÜ Küberloome organisatsioonitüübi „Ettevõte”; järelpäring kinnitas DRAFT-staatuse ja kaardil mittenähtavuse. Anonüümne avaleht jäi suletud „Peagi avame!” nupuga. [Kaheksa brauserivarianti](evidence/sol-proof-20261014-01/server-browser.json).

Visuaalselt üle vaadatud tõendid: [kliendi seis](evidence/sol-proof-20261014-01/client-sent-before-meeting.png), [spetsialisti eelinfo](evidence/sol-proof-20261014-01/specialist-pre-meeting-info.png), [teenuseosutaja mustand](evidence/sol-proof-20261014-01/provider-private-draft.png). Need näitavad API kaudu koostatud pöördumise lugemisrada ning teenuseprofiili tegelikku vormisalvestust; kliendi kogu uue pöördumise brauserivormi täitmist ei väideta.

**Täpsustamist vajav saatja tuvastamine:** spetsialisti detaili päis kuvab „SOL TEST Spetsialist · saabus …”, kuigi pöörduja konto on teine. API annab saatja ID ja rolli, kuid jätab meili saaja projektsioonist teadlikult välja. UI fallback kasutab seejärel `selectedRecipientName`-i. Seetõttu pole nähtava saatjanime osa FLOW-01 ootusest tõendatud. Pöörduja tuvastamise või teadliku anonüümsuse tooteleping tuleb enne uue kirja tugevat lubadust täpsustada; automaatset isikuandmete avaldamist testija ei lisanud.

**Kohalike kontrollide tõendipiir.**

Enne omaniku serverieelistuse täpsustust valmistati tühi kohalik baas ja testikoopia. Täiskomplekti ei käivitatud. Kuues sihitud riski-testifailis oli 35 kontrolli: 34 läbisid, üks jäi katsekeskkonnas puuduva salvestatud kulu-fixture taha. Pärast selle tõendifaili lisamist korrati ainult mõjutatud rag-cost faili: kõik kaheksa kontrolli läbisid. Uut API-kulu ei tekkinud. See on kohaliku testikomplekti tulemus, mitte serveri rolliradade läbimise arv. [Algne väljund](evidence/sol-proof-20261014-01/risk-tests.tap), [sihitud kordus](evidence/sol-proof-20261014-01/rag-cost-retest.tap).

Kohaliku testikoopia käivitust takistasid esmalt webpacki kompileerimine ja seejärel Turbopacki nõue hoida sõltuvused failisüsteemi juure sees. Seadistuse lahendamine ei muutnud rakenduse tootekoodi. Need ettevalmistusvead ei lähe platvormi funktsioonivigade arvestusse. Kohalik enda loodud frontend peatati serveri kontrollide prioriseerimise järel.

**Mis jääb järgmisse etappi.**

Omaniku otsus: „jah, nende kolme kontoga saad sisse logida sotsiaal.pro/admin lehelt“. Valmistatud erand kasutab täpset konto-ID-d ja andmebaasist värskendatud tavarolli; ei anna administraatoriõigusi ega muuda API enda rolli- või juhtumipiire. Tühistatud/peatatud seanss ja andmebaasitõrge sulgevad ligipääsu. `/admin` suunab nende kontode eduka seansi töölauale. Avalik sissepääs ja teiste tavakontode värav jäävad suletuks.

Erand aegub automaatselt **16.10.2026 kell 03.00 EEST**. See on testiseadistuse ajutine eeldus, mitte platvormi avalik avamine. [13 sihitud riskikontrolli](evidence/sol-proof-20261014-01/prelaunch-access.tap) on fixture-tõend; tegeliku serveri tervikraja tõend kogutakse paigalduse järel. Omaniku lisajuhise järgi salvestatakse tulemused iga kontrollirühma järel, mitte alles kogu testimise lõpus.

Testiseadistuse commit'id: `249fa157` (värske seansi värav ja `/admin` suunamine) ning `d8776011` (ruumikesta sama erand). Ruumikest saab ainult parajasti lubatud testkonto ID ning nõuab sama konto autentitud kliendiseanssi. Muutumatule autoriseerijale ei korratud samu 13 kontrolle teise commit'i tõttu; mõlema muudatuse failidel tehti sihitud ESLint ja diff-kontroll. Kogu repo värav ja sama artefakti serveripaigaldus on GitHubi töö, nende lõplik seis lisatakse pärast vaatlust.

14.10 järelvaatlus kinnitas mõlema koodimuudatuse värava edu ning serveri töötava väljalaske `d8776011` (MainPID 3974166). Dokumentatsiooni vahecommit'id ei nõua uut ehitust; nende SHA-d ei nimetata serveris paigaldatud rakenduse SHA-ks.

Pärast seda otsust saab läbida tavarollide serveri API ja brauseri tervikrajad: täidetud küsimustikud, valikulise info üleandmine, ruum ja vastused, asutuse vastuvõtulaud, teenuse töökorraldus, katkestused ning täielikum ligipääsu- ja ekspordimaatriks. Mõned neist vajavad lisaks sobivaid sünteetilisi organisatsiooniseadistusi ja osalisi.

Inimeste osalust nõudvaid ajavõidu ja kasutuskogemuse katseid, sõltumatut sisulist vastusehindamist ning väliste asutuste/õigushindaja kinnitusi see vahetulemus ei asenda. Kirja mõjuhüpoteese ei kuulutata tehniliste kontrollide põhjal tõestatuks.
