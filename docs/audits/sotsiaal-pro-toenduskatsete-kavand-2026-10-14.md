# Sotsiaal.pro avamiseelse kontrolli ja kasutuskatsete kavand

14.10.2026. Omaniku tellitud kavand GPT 6.1 Solile; tulemuste põhjal kavandab ja teeb arenduse hiljem Astra või Fable. **Kavand on valmis ja selle täitmine on alanud. Platvorm on arendus- ja katsetusjärgus, mitte produktsioonis** — omaniku täpsustus 14.10. Serveris töötavat eksemplari ei nimetata selle põhjal päriskasutuses teenuseks.

**14.10 täitmise täpsustus omaniku juhisel:** põhilised töövootõendid kogutakse serveris töötavalt platvormilt ja selle tegelikust andmebaasist, ainult selle jooksu testandmetega. Kohalik eraldatud keskkond on täiendavate tõrke- ja hävitavate katsete jaoks. Kolm tavarolli serverikontot on loodud; [käimasoleva jooksu vahetulemus](sotsiaal-pro-toenduskatsete-tulemused-sol-proof-20261014-01.md). Alljärgnev kohaliku koopia ettevalmistus ei ole enam serveri töövootestide põhitee. Kataloogi algsed NOT_RUN väärtused tähistavad kavandi lähteseisu; tegelik edenemine on jooksu tõendites.

Lähtealus: [13.10 kirja ja vastukirja tõendusanaluus](sotsiaal-pro-kirja-ja-tagasiside-toendusanaluus-2026-10-13.md), kirja täpne sõnastus ning selle analüüsi koodi- ja katseviited. Käesoleva kavandi koostamisel kontrollitud kohalik HEAD: `87003d0b3c85fe1b0867f0424fa9361348842732`; tööpuus on teiste pooleliolevad dokumendimuudatused. 13.10 serverivaatlust kasutatakse ajaloolise lähteinfona, mitte 14.10 värske oleku kinnitusena.

Kavandiga kaasneb [52 katsega masinloetav kataloog](evidence/sotsiaal-pro-toenduskatsete-kataloog-2026-10-14.json). Igal katsel on ID, seotud väited, eeldused, sammud, oodatav tulemus, vajalik tõend ja järelduse piir. Kõigi esialgne seis on `NOT_RUN`. [Mõõtmistabel](evidence/sotsiaal-pro-toenduskatsete-mootmispohi-2026-10-14.csv) on tühi kogumispõhi, mitte näidisandmetega tulemus.

**1. Mida see töö peab lõpuks võimaldama öelda.**

Eesmärk on jõuda iga kirja väite kohta kontrollitava vastuseni: teostatud ja töötab; teostatud piirangutega; puudub; vajab parandamist; mõju mõõtmata; sõltub välisest kokkuleppest. Eesmärk ei ole vastukirja iga küsimust tingimata ümber lükata. Küsimus võib olla põhjendatud ka siis, kui platvormil on sellele juba hea vastus.

Näiteks „eelpöördumine annab spetsialistile enne kohtumist vajalikku infot“ on tehniliselt ja kasutuskatses kontrollitav. „Kõikide sotsiaaltöötajate töökoormus väheneb“ ei ole ühe läbiva katsega tõendatav. Samuti ei tähenda STAR-i liidestuseta tehniliselt toimiv töövoog automaatselt dubleerimise kadumist.

Sol peab koguma ka negatiivse tulemuse. Arendaja ei tohi hiljem teha programmi erandit konkreetse testküsimuse, allika-ID või oodatud vastuse äratundmiseks. Parandus peab lahendama üldise vea.

**2. Väidete, tõendite ja arenduse seos.**

| Väide / vastukirja küsimus | Vajalik tõend | Katsete ID-d | Kui tõend puudub või katse ebaõnnestub |
|---|---|---|---|
| C01. Eelinfo aitab kohtumiseks valmistuda | Õige saaja näeb kinnitatud infot enne kohtumist; päris spetsialist hindab selle kasulikkust | FLOW-01–03, OPS-01, FIELD-01–02 | Parandada edastamine/eeltäitmine; kasuväidet kitsendada mõõdetud olukorrale |
| C02. Inimese kirjeldus ei asenda ametlikku hindamist | Kliendi ja spetsialisti vaate, vastusevalikute ning ekspordi eristus | FLOW-02, DATA-02, RAG-07 | Säilitada päritolu ja roll; parandada eksitav sõnastus või automaatne järeldus |
| C03. Teekond aitab olukorda, samme ja muutust jälgida | Sammude, jagamisvalikute, hinnangute ja pöördumise tulemuse tervikrada | FLOW-03–04, FLOW-07, OPS-08 | Lõpetada konkreetne puuduv rada, mitte kirjutada kogu moodulit ümber |
| C04. Inimene jõuab teenuse või sobiva kontaktini | Leitavus, saaja sobivus, valitud infopakett ja järgmine samm | FLOW-05–06, TOOLS-02 | Parandada saaja kontrolli, teenuse nähtavust või menetlusse suunamist |
| C05. Töökoormus võib väheneda | Sama ülesande kogu tööaja ja kvaliteedi võrdlus | FIELD-01, FIELD-03–04, TOOLS-06 | Eemaldada mõõdetud tarbetud sammud; seni mitte väita tõendatud ajavõitu |
| C06. Vestlus põhineb erialastel allikatel | Otsingupakett, allika kehtivus/piirkond, väite sisuline tugi | RAG-02–10, RAG-12, DATA-05 | Parandada leitud otsingu- või vastamisviga; viite olemasolust üksi ei piisa |
| C07. Teadmusbaasi maht ja uuendamine on tegelikud | Versiooniga loendus ning muudetud allika jõudmine otsingusse | RAG-01, RAG-04 | Parandada uuendusrada/monitooringut või kitsendada automaatika väidet |
| C08. Vastus ei esita oletust kindla õigusena | Puuduliku info, arvude, erandite, vastuolu ja kriisi sisuline hindamine | RAG-02–12, OPS-07 | Parandada vealiigi põhjust; arvestada ka põhjendamatute keeldumistega |
| C09. Õigused, jagamine ja säilitus on piiritletud | Negatiivsed ligipääsukatsed, andmepakett, kustutus ja vastutusmaatriks | ENV-01–03, DATA-01–06, OPS-02, GOV-01/03 | Turbe-/andmevead enne vastavat pärisandmetega rada; õigusotsuse asemel pädeva osalise kinnitus |
| C10. Pöördumine ei jää nähtamatult ootele | Vastuvõtu, määramise, tähtaja, teavituse, tõrke ja asendamise rada | OPS-01–08, FLOW-06–08 | Selge vastutaja ja olekud; parandada jätkutöö või viia funktsioon lõpuni |
| C11. Töövahendid toimivad koos | Mooduli algusest tulemuse ja üleandmiseni ulatuvad rajad | TOOLS-01–06, DATA-06 | Parandada konkreetsed üleminekud; eraldi toote asendatavust hinnata FIELD-04-s |
| C12. Teenuseosutaja registrikontroll toimib | Kehtiv/puuduv/aegunud luba, registririke ja avaldamise muutus | TOOLS-02 | Registririke ei tohi saada positiivseks kontrolliks; katta päriselt kasutatav liitumisrada |
| C13. Raha võib kokku hoida | Mõõdetud aeg, välditavad kulud ja uue lahenduse kogukulu | FIELD-04–05 | Hinnastus või töövoog vajab muutust; puuduvat sisendit ei asendata oletatava säästuga |
| C14. STAR jääb ametlikuks süsteemiks | Aus käsitsi üleandmine ja liidestuse praeguse seisu kirjeldus | FLOW-05, TOOLS-06, GOV-02 | Puuduvat STAR-i liidest ei lavastata; väljund võib olla praegu ettevalmistus |
| C15. SKA-ga arutelu on asjakohane | Ametlikud rollikirjeldused ja selgelt piiratud koostööküsimus | GOV-02 | Vajadusel kaasata SoM/TEHIK/KOV; asutuse huvi ei tõendata tarkvaratestiga |
| C16. Kiri vastab platvormi tegelikule seisule | Iga väite juures versioon, tulemus ja lubatud sõnastus | ENV-01–03, RAG-12, GOV-03–04 | Muuta lubadust või teostust; eesmärki ja tulevikuplaani ei nimetata olemasolevaks võimeks |

**3. Soli töö piir ja korraldus.**

Sol teeb esmalt muutmata funktsionaalsuse kontrolli. Ta võib valmistada kohaliku katsekeskkonna, sünteetilised andmed ja puuduvad väikesed kontrollskriptid, kuid ei paranda selle käigus toote vigu. Nii säilib eristus enne- ja pärast-arenduse tulemuse vahel. Vea leidmisel salvestab ta taasesituse ning jätkab sõltumatute katsetega.

Arendus tehakse hiljem Astra või Fable abil, lähtudes leitud põhjusest, mitte oletatavast parandusest. Pärast arendust käivitatakse mõjutatud katsed ja vajalikud naaberradade kontrollid uuesti. Muutmata läbitud rada ei korrata üksnes dokumentatsiooni või commit'ide jaotuse pärast.

Alamagente ei kasutata. Kavand ei loo uut vestlust ega saada ülesannet teise vestlusse. Kehtivad projekti main-haru, teiste muudatuste säilitamise ja nimelise stage'imise reeglid. Rakenduskoodi arendust käesoleva kavandi koostamisel ei tehtud.

**4. Katsekeskkond peab andma ausa tulemuse.**

Enne muutvat katset teeb Sol `ENV-01–03`:

- Loeb S1.0 ja vajaliku teemasektsiooni; fikseerib SHA, tööpuu muudatuste räsi, skeemi, funktsioonilipud, testibaasi ja rakenduse aadressi. RAG-i korral lisab korpuse, indeksi, juhise ja mudeli versiooni. Viimaseid kontrollib tegelikust kasutatavast seadistusest.
- Kasutab eraldatud kohalikke sünteetilisi andmeid. Ainult `localhost` kontrollist ei piisa: kohalik aadress võib olla tunnel või pärisandmete koopia. Päris kasutajate sisu ei loeta.
- Kasutab runId-ga testkontosid ja `.invalid` aadresse. Kõik väljuvad sõnumid lähevad kohalikku püüdurisse või on blokeeritud. Maksete, registrikirjutuste, telefonikõnede ega teiste asutuste süsteemidesse testandmete saatmist pole selles kavandis ette nähtud.
- Kontrollib algse suletud avamisvärava käitumist eraldi. Tavarollide katsed teeb eraldatud kohalikus testikoopias, kus avamisvärav on ajutiselt sobivaks seatud; tegelikud konto-, organisatsiooni- ja andmeõigused jäävad kehtima. Avalikku serverit ei avata ja tavarolle adminiks ei muudeta. Testikoopia erinevus salvestatakse ning ei lähe kogemata main-i.
- Kasutab olemasolevat töötavat dev-serverit ainult siis, kui selle andmebaas, seadistus ja omanikutööga sobivus on kontrollitud. Võõrast protsessi ei peatata ega samas kaustas duplikaati ei käivitata. Vajadusel valmistab eraldatud kohaliku koopia. Kui turvaline eeldus puudub, märgib ainult sellest sõltuva osa `BLOCKED`.

Praegune [kohaliku sessiooni abifail](evidence/functional-local-session.mjs) on lähtepunkt, mitte pimesi käivitatav universaalne testiraamistik: see kasutab kindlat pordi- ja fixturefaili eeldust, muudab sünteetilisi kontosid ning loob fixturesessiooni. Vanad skriptid võivad kirjutada kindla nimega tõendifaili üle. Sol peab nende sihtkohad enne kasutamist uue runId alla viima ja väljuvad kõrvalmõjud üle vaatama. Fixturesessiooniga töövootest ei tõenda PIN-i, OTP või sisselogimiskirja tervikrada.

Uut tasulist mudeli- või heliteenuse kasutust see kavand ei autoriseeri. Juba eraldi kokku lepitud kulupiiri võib kasutada ainult selle tegelikus ulatuses. Selle puudumine ei peata kohalikku otsingu-, õiguste-, sisend/väljundpaketi-, salvestatud vastuste ega töövoogude kontrolli. `dry-run` nime põhjal ei eeldata kõrvalmõjude puudumist: konkreetne rada tuleb üle vaadata.

**5. Soovitatud täitmise järjekord.**

| Etapp | Sisu | Soli väljund |
|---|---|---|
| A | ENV-01–03; varasemate tõendite versiooni ja kasutatavuse kontroll | Käivitusmanifest, ohutu testikeskkond, ligipääsupiiride alus |
| B | FLOW-01–08, OPS-01–08, DATA-01–06 | Kliendi ja asutuse päris UI/API rajad, õnnestumised ja taasesitatavad puudused |
| C | RAG-01–11 tehnilised variandid ja olemasolevate vastuste analüüs | Allikate/otsingu/viidete tõendid; eraldi märgitud sisulised hinnangud |
| D | TOOLS-01–06 ja GOV-01–03 dokumentide osa | Kirja ülejäänud funktsioonide seis ja välised eeldused |
| E | RAG-12 ja FIELD-01–05 koos inimeste ning vajadusel kululoaga | Sisuline eksperdihinnang, kasutuskogemus, netotööaeg ja kulumudel |
| F | GOV-04 | Vastukirja küsimustele vastav väidete lõppmaatriks ja arenduse prioriteedid |

Etapp E ei ole kogu tehnilise töö lõpetamise eeltingimus. Kui inimesed või tasuline jooks pole kättesaadavad, annab Sol A–D ja F tulemuse koos vastava `NOT_RUN`/`BLOCKED` piiranguga. Ta ei simuleeri eksperti või kasutajaid nii, nagu need oleksid sõltumatud päris osalejad.

Kataloogi juhtum sisaldab mõnikord mitu varianti, näiteks lühike ja pikk vorm või teksti- ja helivestlus. Iga variandi tulemus salvestatakse eraldi. Ühe variandi õnnestumine ei tee kogu juhtumit roheliseks.

**6. RAG-i hindamisel tuleb eristada mehhanismi ja vastuse õigsust.**

Soli esmane tehniline kontroll vaatab päris rakendusraja koostatud päringut, valitud allikaid, kuupäeva, piirkonda, tagastatud viiteid ning lõppvastuse avaldamist. Kohalik testasendus aitab kontrollida, mida rakendus teeb vale või puuduliku mudelivastusega. See ei mõõda pärismudeli tegelikku vastamistäpsust.

Salvestatud vastuseid saab uuesti sisuliselt hinnata ilma uue mudelikuluta. Tulemus seotakse nende vastuste algse versiooniga. Praeguse versiooni sisulise kvaliteedi tõendamiseks on vaja selle versiooni vastuseid; varasem 38/40 kontrollitulemus ei asenda neid.

Enne uut sisulist hindamist külmutatakse küsimused, allikate versioonid ja oodatavad olulised faktid. Soovituslik esmane töömaht on 24–36 eri juhtumit, mis katavad kataloogi RAG-02–10 teemasid, ning valitud mitmevoorulised jätkuküsimused. See on kavandi praktiline lähtevalik, mitte statistilise esinduslikkuse arvutus ega luba tasuliseks jooksuks. Kui olemasolev lubatud eelarve lubab vähem, vähendatakse ulatust ja sõnastatakse järeldus vastavalt.

Osa juhtumeid hoitakse parandajale vastuste mõttes varjatuna. Kui juhtumit kasutatakse paranduse tegemiseks, muutub see regressioonikontrolliks ning sõltumatu kontrollvalim vajab uusi juhtumeid. Ootusi ei muudeta tagantjärele pelgalt tulemuse roheliseks tegemiseks; põhjendatud allikavea parandus säilitab vana ja uue hinnangu.

Iga vastuse hindamisleht sisaldab:

| Väli | Hinnangu sisu |
|---|---|
| Küsimuse ja isiku mõistmine | Õige inimene, ajaperiood, omavalitsus ja tööülesanne |
| Faktide õigsus | Iga otsust mõjutava väite kontroll; eriti arvud, piirhinnad ja erandid |
| Täielikkus | Kas puudub tingimus, mille tõttu vastus muutub eksitavaks? |
| Viite sisuline tugi | Kas viidatud lõik toetab just seda väidet, mitte ainult üldist teemat? |
| Kindluse sobivus | Kas teadmatus, vastuolu ja individuaalse hindamise vajadus on õigesti väljendatud? |
| Kasutatav järgmine samm | Kas inimene või spetsialist saab põhjendatud edasise tegevuse? |
| Põhjendamatu keeldumine | Kas asjakohane ja allikatega vastatav küsimus jäeti vastamata? |
| Vea raskus | Kriitiline: võib viia abita jäämise, vale õiguse lubamise, olulise rahalise vea, kriisis viivitamise või andmelekkega; muu sisuline viga; kosmeetiline viga |

Sol teeb esmahinnangu. Olulised õigus- ja abivajadusväited hindavad sõltumatult kaks sobiva kogemusega valdkonnaspetsialisti; erimeelsused lahendatakse allika abil ja protokollitakse. Kui neid hinnanguid pole, on tulemus „AI esmahinnang“, mitte sõltumatu kvaliteedikinnitus. Hindaja näeb külmutatud algallikaid, kuid võimaluse korral mitte vastuse tootemärki.

Eraldi näidatakse veatute vastuste `n/N`, kriitilisi vigu, puuduvaid tingimusi, põhjendamatuid keeldumisi ja viidete tegelikku tuge. „Null kriitilist viga selles valimis“ ei tähenda nullriski kõigis tulevastes vestlustes. Üks koondhinne ei tohi kriitilist viga teiste õigete vastuste sisse peita.

Praegust `REFUSED_KINDS=[]` otsust ei muudeta automaatselt. Kui test näitab normikontrolli probleemi, võrreldakse ka selle kontrolli valesid häireid ja põhjendamatuid keeldumisi; arendaja valib mõõdetud vea põhjusele sobiva lahenduse.

**7. Kasutuskatsed vastavad küsimusele „mille jaoks avada ja kui palju aitab?“.**

Kavandi kolm põhimõõdikut on: **ülesande netotööaeg**, **inimese edukas ja arusaadav pöördumise ettevalmistus**, **netokulu**. Õigsus ja andmete kaitse on läbivad piirangud: kiirem ekslik vastus ega teise inimese info nägemine ei saa lugeda eduks.

Esimeseks kujundavaks kasutuskatseks sobib ettepanekuna 6–10 spetsialisti vähemalt kahest erineva töökorraldusega organisatsioonist, 2–3 teenuseosutaja esindajat ja 6–10 vabatahtlikku kasutajavaate hindajat. Need arvud ei ole statistiline võimsusarvutus ega universaalse tõestuse lävend. Ka väiksema kättesaadava rühmaga saab leida puudusi, kuid mõjujäreldus kitseneb. Osalemise korraldab omanik; Sol ei saada ise kutseid.

Kasutatakse sünteetilisi olukordi, mitte osalejate päris tervise- või juhtumiandmeid. Näiteks kodus toimetuleku raskus, abivahendi leidmine, omavalitsuse vahetumine või teenuse päring. Ekspert valmistab juhtumi täieliku taustainfo ning kontrollitava oodatava olulise tulemuse ette. Inimene võib enda hinnangus eksida; katse jälgib, kas spetsialist märkab ja täpsustab erinevust.

Võrdluses on sama ülesande **senine tegelik tööviis** ja platvormiga tööviis. Seniseks tööviisiks ei tohi valida meelega halba näidist. Üldassistendi võrdlus lisandub ainult siis, kui seda reaalselt samadel ülesannetel kasutatakse ja seadistus on dokumenteeritud. Veebiotsinguga platvormi võrdlus teadlikult veebita üldmudeliga ei anna üldise paremuse järeldust.

Osalejale antakse kaks raskuselt võrreldavat juhtumit; järjekord ja tööviisi omistamine vahelduvad. Täpselt sama juhtumi kordamine võib teises katses anda õppimise eelise. Enne mõõtmist antakse võrreldav juhendus ja harjutus. Puudulik oskus või katkenud ülesanne ei kao valimist: põhjus ja abi vajadus jäävad tulemusse.

| Mõõdik | Definitsioon ja andmeallikas | Tõlgendamise piir |
|---|---|---|
| Netotööaeg | Paaritatud ülesande senine aktiivne koguaeg miinus uus aktiivne koguaeg. Koond sisaldab lugemist, ettevalmistust, kohtumist, otsingut, allikakontrolli, parandusi ja ümberkannet | Ooteaeg ja õppimisaeg eraldi; kohtumise lühenemine üksi ei tõenda koguvõitu |
| Ettevalmistuse õnnestumine | Osaleja väljendab juhtumi olulise mure/soovi, jõuab õige järgmise sammuni ja mõistab saatmise/vastuvõtmise piiri; sõltumatu vaatleja eelmääratud kontrollleht | Soli enda läbimäng ei ole päris kasutaja tulemus; vabatahtlik vorm ei tohi saada varjatud kohustuseks |
| Netokulu | Tegelikult välditavad kulud miinus uus litsents, mudelikulu, tugi, juurutus, koolitus ja järeltöö | Tööaja väärtus, töövõimekus ja kassapõhine sääst eraldi; teadmata hind jääb puuduvaks |

Lisadiagnostikana loendatakse sama info uuesti sisestamised, kanalivahetused, puuduva info järelpäringud ja vaja läinud abi. Neid ei esitata lõpptulemuse asemel: vähem klikke ei pruugi tähendada paremat tööd.

Ajaandmed kogutakse [tühjale mõõtmispõhjale](evidence/sotsiaal-pro-toenduskatsete-mootmispohi-2026-10-14.csv), üks rida ühe osaleja ühe meetodiga tehtud ülesande kohta. `pair_id` seob võrreldavad variandid. Osaleja ID on pseudonüüm; vabateksti ei lisata päris tundlikku infot. Aktiivseid faase ei loeta topelt. Katkestatud ülesandele salvestatakse kulunud aeg ja `completed=false`, mitte nullminutit.

Esitatakse osalejate kaupa paarierinevused, mediaan, keskmine ning tulemuste hajuvus koos `N`-iga. Väikese kujundava katse positiivne mediaan on esmane signaal, mitte tõend kõigi KOV-ide kohta. Kui soovitakse hiljem üldistavat keskmise säästu väidet, tuleb kasutada piisavat sõltumatut valimit ja sobivat ebakindluse hinnangut. Sama inimese kümmet ülesannet ei käsitleta kümne sõltumatu spetsialistina.

Tasuvuse arvutuses olgu `Δt` mõõdetud minutite vahe, `N` ülesannete kuuarv ja `w` tööaja tunnikulu. Võimaliku vabanenud tööaja väärtus on `N × Δt / 60 × w`. See ei ole automaatselt rahaline kokkuhoid. Kassapõhine sääst tekib ainult tegelikult välditavatest kuludest, millest lahutatakse uued kulud. Esimese aasta juurutus ja püsikulu näidatakse eraldi. Oma mudeli majutamine või eraettevõttena tegutsemine ei muutu arvutuses vaikimisi odavamaks.

**8. Milline tulemus toetab millist väidet?**

| Tase | Millal saab kinnitada? | Mida võib selle põhjal öelda? |
|---|---|---|
| Mehhanism olemas | Asjakohane kood ja andmestruktuur leitud | „Teostuses on olemas …“; runtime veel tõendamata |
| Tehniline rada töötab | Kõik konkreetse juhtumi kohustuslikud variandid läbivad UI/API/andmevaatluse | „Kontrollitud versioonis läbis järgmine rada …“ |
| Sobib piiratud kasutuskatseks | Vastava raja kriitilised andme- ja ohutuskontrollid läbitud; kokkulepitud osalised, andmed ja vastuvõtt | „Saab läbi viia kirjeldatud ulatusega kasutuskatse“ |
| Esmane kasutuskasu | Päris osalejate võrdlus näitab kasu, kvaliteet ei halvene; piirangud avaldatud | „Selles katses / selle ülesande puhul …“ |
| Mõõdetud rahaline kasu | Kulude sisendid kontrollitud ja välditavad kulud eristatud | „Nende eelduste ja mahu juures …“ |
| Üldine paremuse või vastavuse väide | Vastava ulatusega sõltumatu võrdlus/hinnang | Käesolev väike katsekomplekt üksi ei luba „kõigile parem“, „veatu“ või „riigi süsteemidest turvalisem“ |

Avastatud kriitiline andmeleke, eksitav kriisikäitumine või valesti kinnitatud vastuvõtt peatab sellest sõltuva pärisandmetega kasutuskatse. Sõltumatuid sünteetilisi katseid jätkatakse. See on arendusjärgu piiratud kasutuse tingimus, mitte väide juba tekkinud teenuseintsidendist.

Kavand ei määra automaatselt seaduslikke 7/10 päeva tähtaegu. Töökorralduslikku funktsiooni katsetatakse selgelt sünteetilise tähtajaga; õigusliku reegli, algushetke ja vastutava asutuse kinnitab pädev osaline. Samuti ei võrdu kasutuslepingu mustand allkirjastatud kokkuleppega.

**9. Arenduse esialgne järjestus Astra või Fable jaoks.**

Need on analüüsil põhinevad lähteülesanded. Soli uus tulemus võib prioriteeti muuta või oletatud puuduse ümber lükata. Esmalt tuleb eristada viga, lõpetamata funktsioon, konfiguratsioon, välise otsuse vajadus ja mõõtmata mõju.

| Järjekord | Praegune tõend / küsimus | Soovitud käitumine ja arenduse piir | Valmimise kontroll |
|---|---|---|---|
| D01 | SENT→READY järel võrgustikujagamise vastuolu | Lubatud vastuvõetud eelpöördumise jätkutöö toimib; õigused ja suletud oleku piir säilivad | FLOW-08 + DATA-01 |
| D02 | 13.10 teavitustöö tõrge; võimalik seos avamisväravaga | Esmalt kinnitada põhjus. Kui tehnilised tööd peavad suletud arendusrežiimis töötama, lubada ainult õigesti autenditud rada; mitte avada töö-API-sid üldiselt | OPS-04–06 + ENV-02 |
| D03 | Postkasti dueAt on olemas, määramise rada pole tõendatud | Teostada või lõpetada tegelik tähtaja määramine, päritolu ja üle tähtaja töö; mitte lisada põhjendamata õigusreeglit | OPS-03 + GOV-01 |
| D04 | Eeltäitmise ja staatuste terviklus vajab uut kontrolli | Valitud info liigub kadudeta; saatmine, vastuvõtt ja otsus on eristatavad; ebaõnnestumine ei kuva edu | FLOW-03/06–07, OPS-01/08 |
| D05 | RAG-i sisuliste vigade praegune ulatus mõõtmata | Parandada leitud üldised otsingu, kuupäeva, piirkonna, arvude või tingimuste vead; vältida testi või allika-ID erandeid ja mõõtmata blanketset keeldumist | RAG-02–12, mõjutatud varasemad kontrollid |
| D06 | Õigused ja koopiate piirid olemas, tervik vajab tõendit | Sulgeda ainult tõendatud lüngad; säilitada jagamise päritolu, töötaja vahetumine ja kokkulepitud säilitus | DATA-01–05, OPS-02 |
| D07 | Palju töövahendeid, asendatavus teadmata | Viia piloodi valitud üks teenuserada lõpuni, vähendada mõõdetud topeltsisestust ja parandusi | TOOLS-01/03–06, FIELD-04 |
| D08 | Registrikontrolli olemasolu ei tõenda kõiki liitumisi | Kontrollitud liitumisrajad, loaseis ja registritõrge peavad andma ausa tulemuse; avaldamise muutus jõuab otsingusse | TOOLS-02 |
| D09 | Aja- ja kulukasu pole mõõdetud | Lisada vaid vajalik mõõtmine ja kasutuskatse tulemuse järgi tarbetute sammude eemaldamine | FIELD-01–05 |
| D10 | STAR-i liides, õiguslikud kokkulepped ja riiklik heaolukoond on väliste eeldustega | Hoida ettevalmistus, tulevikuplaan ja olemasolev võime lahus; kasutusloa/koostööotsuse puudumist ei „parandata“ koodiga | GOV-01–04, DATA-06 |

Eraldi ei ole vaja arendada „kõigile üht platvormi“ tõestamiseks kõiki võimalikke funktsioone. Kõige tugevam tulemus on üks terviklik, õige ja mõõdetavalt kasulik tööülesanne koos ausate piiridega, millele saab järgmised ülesanded lisada. Ülejäänud kirjas loetletud olemasolevaid funktsioone kontrollitakse kataloogis, et tutvustus ei läheks teostusest ette.

**10. Soli tulemuse vorm ja korduskatse.**

Iga käivituse tõendid lähevad eraldi runId alla `docs/audits/evidence/`-s. Üks tehniline tulemuste aruanne on `docs/audits/sotsiaal-pro-toenduskatsete-tulemused-<runId>.md`. Aktiivne seis jääb ainult SotsiaalAI.md-sse; eraldi handoff- või seisufaili ei looda. Kataloogi tõendinimed võivad olla ühise JSON-i sektsioonid — kümneid tühje faile ei ole vaja luua.

Iga variandi tulemuse miinimumkuju:

```json
{
  "case_id": "FLOW-08",
  "variant_id": "after_acceptance",
  "run_id": "<tegelik-jooks>",
  "status": "NOT_RUN",
  "gap_kind": null,
  "evidence_mode": null,
  "tested_sha": null,
  "working_tree_diff_sha256": null,
  "environment_manifest": null,
  "steps_executed": [],
  "expected": "Lubatud jagamine toimib pärast vastuvõttu õiguste piires.",
  "actual": null,
  "evidence_refs": [],
  "impact": null,
  "root_cause_status": "NOT_PROVEN",
  "retest_of": null
}
```

`status` on `PASS`, `FAIL`, `BLOCKED` või `NOT_RUN`. Puuduva funktsiooni tulemus on `FAIL` ja `gap_kind=MISSING_FEATURE`; keskkonna või osalise puudumine on `BLOCKED`. `SOURCE_ONLY` ei muutu `CURRENT_RUNTIME`-ks. Paranduse järel säilitatakse vana tulemus ning uus seotakse `retest_of` väljaga.

Soli aruanne peab sisaldama väidete kaupa otsust, tähtsaimate vigade taasesitust, katsete tegelikku ulatust, kasutusmõju mõõdetud/tõendamata osa ning Astra/Fable arenduse järjekorda. Iga väite juures on üks otsus: kinnitatud selles ulatuses, piiratud ulatuses kinnitatud, ümberlükatud, tõendamata või tulevikuplaan. Roheliste testide koondprotsent üksi ei vasta vastukirjale.

Kohalikku täisbuild'i, täislint'i ega kõiki teste automaatselt ei käivitata. Uue testi vajadus on siin omaniku tellitud kontrolli ulatuses; 309 kustutatud testi ei taastata. Olemasolevatest testidest valitakse puudutatud riski kontroll, näiteks kriisiraja, privaatsuse, andmete kustutamise või kulupiiri test. Ühe testi käivituse olemasolev vorm on `node --import ./scripts/register-node-source-loader.mjs --test tests/<tegelik-fail>`; ajatundlikul katsel kasutatakse UTC-d. Käitumine kontrollitakse ka päris kohaliku API/UI kaudu. Arenduse hilisemad keele-, süntaksi- ja GitHubi kontrollid järgivad AGENTS.md-d.

**11. Valmis ülesanne GPT 6.1 Solile.**

> Täida Sotsiaal.pro avamiseelne kontrollikavand failist `docs/audits/sotsiaal-pro-toenduskatsete-kavand-2026-10-14.md` ning selle 52 katsega JSON-kataloog. Platvorm on arendusjärgus, mitte produktsioonis. Alusta ENV-01–03-st ja salvesta uus käivitusmanifest. Kontrolli kõigepealt muutmata funktsionaalsust, säilita teiste töö ning ära paranda tootekoodi. Kasuta eraldatud sünteetilisi andmeid ja õigeid tavarolle. Päris sõnumeid ega uut kokkuleppimata tasulist mudelijooksu ei tehta. Olemasolevatest skriptidest taaskasuta ainult ülevaadatud loogikat; ära kirjuta varasemaid tõendeid üle. Täida iseseisvalt tehnilised katsed ning märgi iga variant PASS/FAIL/BLOCKED/NOT_RUN koos tõendiga. Inimeste osalust ja välist kinnitust nõudvatele katsetele valmista materjalid, kuid ära esita simulatsiooni päris kasutajauuringuna. Koosta üks tulemuste aruanne koos iga kirja väite otsuse, taasesitatavate puuduste ja Astra/Fable arendusjärjekorraga. Uuenda SotsiaalAI.md aktiivset seisu. Alamagente, kõrvalharusid ega PR-i ei kasutata.

**12. Kavandi allikad ja kontroll.**

Kavand tugineb 13.10 analüüsi viidatud lähtekoodile ja tõendifailidele. 14.10 täpsustati muu hulgas avamisvärava piirangut, olemasoleva fixture-abifaili käitumist, tegelikke organisatsiooni API-radu ning teavitustöö autentimist. Vanade skriptide olemasolu ei ole nende tänase edukuse tõend.

Metoodikas eristatakse mehhanismi, käivitust, eksperdihinnangut ja kasutusmõju; mõõdikute valikul kasutati `data-analytics:design-kpis` juhist. Tegelikke katsetulemusi, osalejate arvu, ajavõitu ega kulusäästu selle kavandi koostamisel ei toodetud. Kavandi kontroll hõlmab JSON-i loetavust, ID-de ja väidete seoseid, kohalike viidete olemasolu ning diffi vormistusvigu.
