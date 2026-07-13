# Fable 5 lisavastused: organisatsioonikiht ja esimene piloot

Kuupäev: 12.07.2026  
Staatus: Fable 5 analüüs ja soovitused; ei ole veel tooteomaniku kinnitatud otsus  
Seotud dokumendid: [platvormiloogika ülevaade](./fable-5-platvormiloogika-ulevaade.md), [MAX-täiendus](./fable-5-platvormiloogika-max-taiendus.md), [avastamata vajadused ja uued võimalused](./fable-5-avastamata-vajadused-ja-uued-voimalused.md)

See dokument säilitab kaks Fable 5-le esitatud jätkuküsimust ja nende vastused. Tekst on talletatud sisulise järjepidevuse jaoks. Soovitused vajavad enne arenduseks muutmist tooteomaniku kinnitust.

---

## 1. Organisatsiooni ja meeskonna kiht

### Küsimus

Kui SotsiaalAI-d hakkavad päriselt kasutama KOV-i sotsiaaltööosakonnad ja mitme töötajaga teenuseosutajad, kas platvorm vajab eraldi organisatsiooni ja meeskonna kihti, kuigi põhikasutajatüübid jäävad endiselt pöörduja, sotsiaaltöö spetsialist ja teenuseosutaja? Palun analüüsi aktiivse koodi ja varasemate raportite põhjal, milliseid tulevasi võimalusi selline kiht avaks — näiteks töö üleandmine kolleegile, asendamine, ühise teenuseprofiili haldamine, tööandja makstav tellimus ja KOV juhi koondvaade — ning milline oleks selle kõige väiksem mõistlik andmemudel ja õiguste loogika. Arvesta, et organisatsiooni kuulumine ei tohi anda automaatselt ligipääsu töötaja privaatsele Tööheaolule, Meetodipeeglile, Supervisioonile ega pöörduja Teekonnale. Anna lõpuks selge soovitus, kas seda kihti on vaja enne esimest päris pilooti, hiljem või üldse mitte.

### Fable 5 vastus

Lühivastus: jah, see kiht tuleb kunagi vajalikuks — aga mitte hierarhiana, vaid õhukese liikmesuskihina, ja mitte enne esimest pilooti. Soovitus on: piloot teha ilma (olemasolevad mustrid katavad), kihi andmemudel piloodi ajal valmis disainida ja ehitada see kohe siis, kui käivitub üks neljast allpool loetletud päästikust. Üks erand on mitme töötajaga teenuseosutaja, mis murrab juba täna.

1. Mida aktiivne kood täna ütleb

Koodis pole kasutaja-organisatsiooni, aga selle ootus on juba sees — kolm jälge:

Rippuvad väljad: RoomMember.sponsorOrgId ja Invite.sponsoredByOrgId (schema:2190, 2213) on olemas ilma ühegi Organization-tabelita, mida viidata. Keegi on org-arvelduse ette näinud.
Surnud väärtus: CovisionVisibility.ORGANIZATION (schema:345–348) ei ole jõustatav, sest kasutajal pole org-seost — fikseerisin selle max-täienduses vastuoluna C1.
Nimepettus: OrganizationAdmin ja MunicipalityKovAdmin mudelid EI ole kasutajaorganisatsioonid — need on teadmusbaasi sisuallikate haldus (RAG). Uue kihi nimetamisel tuleb see kokkupõrge teadlikult lahendada, muidu tekib arendussegadus.
Ja kolm asendusmustrit, mis praegu org-kihti asendavad:

KOV juhi koondvaade töötab juba täna vaatajate lubatud-nimekirjaga: WellbeingPilotScope-il on küll municipalityId/organizationId väljad (schema:1176–1177), aga ligipääs käib eksplitsiitse WellbeingPilotViewer nimekirja kaudu — ja WellbeingRecord-il ei ole org-välja. Ühe osakonna piloodis on see samaväärne; teise organisatsiooni liitumisel muutub koond ilma liikmesuskihita valeks (eri asutuste kirjed seguneksid samasse rollirühma-koondi). See on kõige teravam tehniline päästik.
Tööandja makstav tellimus on isiku-, mitte asutusepõhiselt olemas: sponsoreeritud kutse koos maksevooga (/api/invites/sponsored/init|callback, Subscription.sponsorUserId, billingSource: SPONSORED_BY_HOST) + admini UserEntitlementOverride. Piloodi saab arveldada nii; hanke-/arvepõhine org-arveldus mitte.
Teenuseprofiil on rangelt üks-kasutaja-üks-profiil: @@unique([ownerId]) (schema:1552). Viie töötajaga teenuseosutajal on täna kaks halba valikut: jagatud konto (lõhub isiklikud privaatruumid ja auditijälje) või viis dubleerivat profiili kaardil. See on ainus koht, kus vajadus pole tulevik, vaid tekib esimese mitmetöötajalise teenuseosutajaga.
2. Mida kiht avaks (varasemate raportite keeles): U11 töö üleandmine piiratud ringi sees (praegune disain lubab ainult käsitsi valitud kolleegi, sest ringi pole); asendamine puhkuse ajal ja lahkumise töövoog; ühine teenuseprofiil mitme toimetajaga ja profiili järjepidevus töötaja vahetumisel; kohapõhine org-arveldus (rippuvad väljad ärkavad ellu); õigesti piiritletud KOV-koond (ideed ptk 21); hiljem osakonna ühine vastuvõtukanal, ORGANIZATION-nähtavuse jõustamine Kovisioonis ning U4/U5 kättesaadavus- ja puudujäägikoondid asutuse lõikes.

3. Väikseim mõistlik andmemudel — kaks tabelit, null hierarhiat:

Organization        { id, name, type: KOV_DEPARTMENT | SERVICE_PROVIDER_ORG | OTHER,
                      municipalityId? (olemasolev register on seeditud), registryCode?, status }
OrganizationMember  { organizationId, userId, orgRole: MEMBER | MANAGER,
                      startedAt, endedAt?, addedByUserId }
Kolm liitekohta lisanduvad alles vastava päästiku käivitumisel, mitte ette: ServiceProviderProfile.organizationId? (nullable, ownerId jääb tagasiühilduvuseks); Subscription/Invite org-sponsorväljade FK-ks sidumine; Tööheaolu koond ilma kirjete märgistamiseta — liikmesus liidetakse agregeerimisel ownerUserId → OrganizationMember kaudu (startedAt/endedAt annab perioodi-täpsuse ja töökohavahetuse õigsuse; privaatne kirje ise jääb org-vabaks). Tehniline märkus max-täienduse 5.5 reeglist: aktiivse liikmesuse unikaalsus vajab osalist indeksit (endedAt IS NULL), mida Prisma skeemikeel ei toeta — raw-SQL migratsioon.

4. Õiguste loogika — üks lause ja keeld-loend. Liikmesus ei anna vaikimisi mitte midagi peale kahe asja: nähtavus kolleegide valikuloendis (üleandmiseks) ja loendatavus k-anonüümses koondis (ainult kui olemasolev aggregationEligible nõusolek kehtib). Kõik muu on eksplitsiitne: MANAGER org-roll avab ainult liikmete halduse ja arvelduse; koondvaade nõuab lisaks eraldi vaatajaõigust (kahe võtme põhimõte — praegune WellbeingPilotViewer eksplitsiitsus jääb, ideed 21.7 piirangud jäävad). Keeld-loend, mida org-kontroll ei tohi kunagi asendada: Tööheaolu kirjed ja mustandid, Meetodipeegel, Supervisiooni sisu, pöörduja Teekond, vestlused, dokumendid, kovisioonijuhtumid — kõik jäävad omaniku-/osalejapiirde taha, mille runtime-kontroll selles sessioonis just tõendas (isegi admin ei möödu). Org-kontrollid on lisanduvad org-objektidele (profiil, arveldus, koond), mitte asendavad isiklikele.

5. Soovitus: millal.

Enne esimest pilooti — EI. Üks osakond, käputäis kasutajaid: lubatud-nimekiri, käsitsi üleandmine ja isiku-sponsorlus katavad kõik; org-kihi liikmehaldus, offboarding ja arveldus võtaksid nädalaid, mis kuuluvad P0-ühendustele. Pealegi on piloot just see vaatlusinstrument, mis näitab, kuidas osakond päriselt üleandmist ja asendamist korraldab — enne vaatlust disainitud org-semantika oleks tõenäoliselt vale.
Piloodi ajal — disainida ja hoida uksed lahti: mitte ehitada midagi, mis eeldab „üks kasutaja = null organisatsiooni" jäädavalt; sponsorOrg-välju mitte väärkasutada; jääda capability-/allowlist-mustrite juurde (need ongi org-kihiga ühilduvad).
Ehitada kohe, kui käivitub esimene neljast päästikust: (1) liitub teine organisatsioon (koondite segunemise oht), (2) liitub mitme töötajaga teenuseosutaja (profiili unikaalsuspiirang murrab — vajadusel ehita ainult kitsas profiilimeeskonna viil, mitte kogu kiht), (3) hange nõuab asutusepõhist arveldust, (4) osakond vajab päris üleandmis-/asendusvoogu igapäevaselt, mitte erandina.
„Üldse mitte" ei ole realistlik valik: KOV-id ja asutused on selle platvormi loomulik ostja ja koondvaadete õigsus sõltub liikmesusest. Aga õige järjekord on sama, mis kõigis varasemates raportites — kõigepealt lõpetada olemasolevad ühendused, siis lasta piloodil näidata org-elu tegelikku kuju, ja alles siis valada see kahte väikesesse tabelisse.

---

## 2. Esimene päris piloot ja ESTA tutvustuspäev

### Küsimus

Kui peaksime praeguse SotsiaalAI põhjal valima ühe esimese päris kasutajapiloodi, siis milline peaks olema selle kõige väiksem, kuid kasutajale terviklik versioon? Palun vali konkreetne kasutusolukord ning kirjelda, kes piloodis osalevad, millise teekonna läbib pöörduja, millise teekonna sotsiaaltöötaja ja kas teenuseosutaja peab juba esimeses piloodis osalema. Vali aktiivse koodi ja raportite põhjal funktsioonid, mis peavad kindlasti pilooti kuuluma, ning nimeta funktsioonid, mis tuleks teadlikult välja jätta. Arvesta olemasolevate P0 paranduste, teavituste, kohtumise kokkuvõtte, „Minu jagamised” vaate ja ruumilise kasutuskogemusega. Lisa ka, mille järgi saame ilma privaatset sisu kogumata aru, kas piloot päriselt lihtsustas abi otsimist ja sotsiaaltöötaja tööd.
Kas platvormi sobiks tutvustada Eesti Sotsiaaltöö Assotsiatsioonile ja teha neile tutvustuse päeva? Millele fookus seal panna ja milline see oleks?

### Fable 5 vastus

Piloodi valik: „Eakas või hooldaja pöördub KOV-i poole" — üks omavalitsuse sotsiaaltööosakond, pöörduja täisrada Teekonnast ühise ruumini.

See on ainus kasutusolukord, mille kogu ahel on juba täna serveris otsast lõpuni tõendatud (vestlus → Teekond → shareKeys-eelvaade → eelpöördumine → vastuvõtulaud → ruum — kõik runtime-kontrollitud), mis ei sõltu ühestki lahtisest tooteotsusest (Kovisiooni sidumine, org-kiht) ja mille juhtumitüüp on suure mahuga, aga madala akuutsusega — pilooti ei tohi ehitada kriisijuhtumite peale.

Osalejad: üks KOV osakond — 2–4 sotsiaaltöötajat; 10–30 pöördujat, keda osakond ise oma tavakanalites kutsub (inimesed, kes nagunii pöörduvad); sina platvormi haldajana. Suletud registreerimine (REGISTRATION_OPEN lipp on olemas), tasuta ligipääs admini UserEntitlementOverride-idega, ainult INTERNAL-kanal (e-posti väljasaatmine piloodis välja — hoiab ringi mõõdetava ja turvalise). Teenuseosutajat ei ole esimeses piloodis vaja: tema tehniline ahel on küll tõendatud, aga kolmas osapool kolmekordistaks liitumis- ja õiguskoormuse; Teenusekaardi KOV-kontaktidest piisab suunamiseks. Teenuseosutaja on teise piloodi peategelane (koos kättesaadavuse signaaliga U4).

Pöörduja teekond: kutse → konto → vestlus allikatega vastustega → Teekond salvestub → „koosta eelpöördumine" Teekonnast (näeb ja valib, mida jagab) → saadab → saab teavituse, kui töötaja on vastu võtnud → vajadusel täpsustused ruumis → kohtumine päriselus → saab ruumi kohtumise kokkuvõtte selges keeles ja märgib „sain aru / mul on parandus" → näeb „Minu jagamised" alt, mida ta on jaganud.

Sotsiaaltöötaja teekond: e-kiri uuest pöördumisest → vastuvõtulaud (kinnitatud eelinfo + tööplaan/kontrollnimekiri + „järgmine kontakt" kuupäev) → vajadusel ruum täpsustuseks → aja pakkumine sõnumina (mitte broneerimissüsteem) → kohtumine → kokkuvõtte koostamine dokreziimis ja postitamine ruumi → ametlik töö jätkub STAR2-s käsitsi (piir püsib; STAR_HELPER mustand on töötajale saadaval, aga pole piloodi nõue).

Kindlasti sisse (järjekorras): P0 parandused A1–A3 (Teekonna-seose püsivus, ruumi dedup, eksitavate kaartide peitmine/märgistus); U1-lite sündmusekiht + e-kirjad — see pole ainult mugavus, vaid ka mõõtmise selgroog, sest praegu ei salvestu staatusemuutuste ajatemplid (ainult updatedAt), sündmusetabel annab need sisuvabalt; U10 kohtumise kokkuvõte (null uut andmemudelit); U12-lite „Minu jagamised"; U3-lite tagasivõtmine enne avamist (päris inimeste päris andmetega on see usalduse miinimum); eelpöördumise vaate 1536×864 paigutuse parandus (UX-kaardistuse probleem nr 1 — see ongi piloodi põhiekraan tavatööarvutil); kriisi-eskalatsiooni protseduur KOV-iga (koodis on isCrisis tuvastus olemas, vaja on inimprotsessi). Eeltingimused: partner-KOV-iga lukku eelpöördumise menetluslik staatus (ideed 11.8 — kas ja millal registreeritakse STAR2-s), andmekaitsehinnang, ning piloodikeskkonna eellend-kontroll just nende asjade peal, mida lokaalselt ei saanud kontrollida (AI-vastused võtmetega, SMTP, e-kirjad).

Teadlikult välja: Kovisioon ja Teemaseemned (demo-seis; peita piloodikasutajate eest), Tööheaolu mõõdetavast skoobist väljas (võib töötajatele vaikselt lahti olla — see on valmis ja privaatne, aga ärgu segagu piloodi fookust), abisoovid/-pakkumised (vajavad kriitilist massi), häälvestlus, kõned ja salvestused, materjalid, maksed, väline e-post, avalik registreerimine.

Kuidas mõõta ilma privaatset sisu lugemata: ainult staatuse-ajatemplid, loendurid ja vabatahtlikud standardvormid. Lehter (konto → vestlus → Teekond → mustand → saadetud → READY → ruum → kokkuvõte → „sain aru") sündmuste tasemel; vastuvõtu latentsus (saatmisest kinnituseni) võrrelduna osakonna senise ajaga telefonis/meilis; hüljatud mustandite määr; täpsustusruumi vajaduse osakaal (kui eelinfo on hea, see langeb); töötaja 1–5 hinnang „kui palju eelinfo aitas" iga juhtumi kohta (ilma sisuta); pöörduja kolme küsimusega järelvorm; „Minu jagamised" ja tagasivõtu kasutus usalduse indikaatorina; tehniline pool olemasolevast telemeetriast (ChatLog, retrieval-stats — allikakatvus ja veamäärad). Kõik raporteeritakse ainult koondina, väikese grupi summutamise reegliga — sama põhimõte, mis Tööheaolu koodis juba on.

ESTA tutvustuspäev — jah, ja pigem varem kui hiljem, aga õige raamiga: ESTA on võimalik partner, mitte kokkulepitud (briefi 2.1 piir kehtib ka esitluses). Päeva väärtus on kolmekordne: metoodiline tagasiside, usaldusväärsus piloot-KOV-i leidmisel ja hilisema superviisorite/mentorite suuna uks.

Fookus — kolm asja, mitte funktsioonikataloog:

Privaatsuspõhimõtted kõigepealt. See publik hindab sind selle, mitte funktsioonide järgi: privaatne vaikimisi, kasutaja kontrollitud jagamine, k-anonüümsus, STAR2 mittedubleerimine, ja sama oluliselt — mida me teadlikult EI ehita (riskiskoorid, töötajate seire, automaatne transkriptsioon, menetluspeegel). „Mitte ehitada" nimekiri on selle saali jaoks usaldusvara.
Elus demo töötavast selgroost sünteetiliste andmetega — pöörduja rada Teekonnast ruumini päris keskkonnas, mitte slaididelt. Ja Tööheaolu tööriistad, mis on täielikult valmis ja ESTA südameteema (töötajate kestlikkus); baromeetri idee mainida tulevikuvõimalusena, mis vajaks just ESTA valdkondlikku tõlgendust.
Kovisiooni lõuend ausalt prototüübina — ja pööra see nõrkus küsimiseks. 8-etapiline lõuend on ehitatud otse kovisiooni juhendmaterjalide peale; näita seda kui metoodika-truud katsetust ja palu ESTA ekspertide sisulist ülevaatust. See on ideed.md ptk 25.2 esimene koostöösuund: madal kohustus, null andmevahetust, kõrge väärtus mõlemale.
Formaat: pool päeva. ~20 min visioon ja piirid („Abi algab selgusest" + privaatsuslubadused), ~25 min elus demo, ~20 min Tööheaolu + kovisiooniprototüüp, ~45 min juhendatud proovimine testkontodega sünteetilistel andmetel (las praktikud klõpsivad ise — see veenab rohkem kui ükski slaid) ja lõpus arutelu kolme konkreetse palvega: (1) väike metoodikatöörühm kovisiooni ja selge keele juhiste ülevaatuseks, (2) tugi või soovitus piloot-KOV-i leidmisel, (3) põhimõtteline huvi superviisorite/mentorite suuna vastu, millest võiks kasvada hilisem kirjalik lepe. Ühe euro mudelit ja liikmeala ma avaettekandes ei paneks — need on kahepoolse läbirääkimise, mitte tutvustuspäeva teemad; kui küsitakse, vasta ausalt „idee, mis vajab lepet". Kaasa üks A4: põhimõtted, piirid ja kolm palvet — mitte funktsioonide loend.

Järjekorra soovitus: ESTA päev võib toimuda enne pilooti (see aitab pilooti leida), aga demo peab piirduma sellega, mis päriselt töötab — ja see on täpselt see selgroog, mille piloot valideerib.

