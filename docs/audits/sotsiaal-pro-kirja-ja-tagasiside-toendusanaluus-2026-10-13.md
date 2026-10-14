# Sotsiaal.pro tutvustuskirja, saadud tagasiside ja platvormi tõendusanaluus

13.10.2026. Analüüs omaniku palvel. Eesmärk on kontrollida mõlema kirja väiteid ja nende põhjendusi tegeliku teostuse vastu. Vastukirja autorit ega tema ametlikku esindusõigust ei ole tuvastatud; seda ei käsitleta SKA ametliku seisukohana.

**Täpsustus 14.10 omaniku kinnitusel:** platvorm ei ole produktsioonis. Tegemist on arendus- ja katsetusjärgus lahendusega; serveris töötav väljalase ei tähenda avatud päriskasutust. Allpool toodud serveri- ja konfiguratsioonileiud kirjeldavad 13.10 arenduskeskkonna vaatlust, mitte tõendatud intsidente päriskasutajatele. Avamiseelse kontrolli järgmine samm on [14.10 katsekavand](sotsiaal-pro-toenduskatsete-kavand-2026-10-14.md).

**Põhijäreldus:** tutvustuskiri kirjeldab sisulise teostusega arendatavat platvormi ning ütleb STAR-i liidestuse puudumise ja kokkuhoiu kontrollimise vajaduse välja. Vastukirja küsimused töökoormuse, vastutuse ja tehisaru kvaliteedi kohta on põhjendatud. Nende küsimuste põhjal ei saa siiski järeldada, et eelpöördumine on mõttetu, platvorm testimata või SKA-ga vestlemine kasutu. Ka platvormi olemasolev teostus ei tõenda veel igapäevase kasutuse töökindlust, kasutajate paremaid tulemusi ega netokokkuhoidu.

**1. Mida ja kuidas kontrolliti.**

Aluseks oli omaniku viimane tervikkiri manuses `253f6882-6a2d-4e11-b508-4c3988ab4e3c/Kleebitud tekst.txt`, vestluses esitatud vastukiri ning omaniku selgitus, et eelpöördumine tähendab eelkõige enda abivajadusest ette teatamist ja kohtumiseks valmistumist. Varasemate mustandite tugevamaid väiteid ei omistata lõplikule kirjale.

Kontroll hõlmas asjakohast lähtekoodi, olemasolevaid katsetulemusi, lepingumustandit, ametlikke avalikke allikaid ning serveri piiratud lugemispõhist olekukontrolli. Kohalik HEAD ja vaadatud `origin/main` olid `87003d0b3c85fe1b0867f0424fa9361348842732`; töötava frontendi väljalase oli `b7466af8d039c248e19693a32a3475f47205649b`. Serveri vaatlus tehti 13.10 kell 20.27–20.29 EEST. [Vaatluskirje](evidence/kirja-analuus-runtime-2026-10-13.json).

Tõendeid tuleb lugeda eri tugevusega:

| Tõendi liik | Mida see kinnitab | Mida see ei kinnita |
|---|---|---|
| Kirja täpne sõnastus | Mida autor tegelikult lubas, tingimuslikult pakkus või küsis | Lubaduse tehnilist teostatust |
| Praegune lähtekood | Mehhanism, kontroll, andmevoog või nähtav vastuolu on teostuses olemas | Kõigi harude toimimist serveris |
| Varasem käivitustulemus | Kirjeldatud versioon ja katserada läbisid konkreetse kontrolli | Praeguse versiooni kõiki kasutusjuhtumeid |
| Praegune serverivaatlus | Mõõdetud konfiguratsioon ja teenuse olek vaatlushetkel | Sisulist kvaliteeti või pikaajalist töökindlust |
| Kasutusmõju uuring | Võrdluses mõõdetud tööaeg, vead, kulud või abini jõudmine | Sellist uuringut käesolevas tõendikomplektis ei leitud |

Uusi tasulisi tehisarupäringuid ei tehtud. Päris inimeste juhtumiandmeid ei kasutatud. Rakenduse koodi ei muudetud. Tegemist pole täieliku turvaauditi, õigusliku kasutusloa ega sõltumatu mõju-uuringuga.

**2. Vastukirja põhjenduste kontroll.**

| Vastukirja väide või küsimus | Hinnang kontrollitud tõendite põhjal |
|---|---|
| Uus keskkond võib lisada kontosid, sisestamist ja jälgimist. | Põhjendatud risk. Olemasolevate töövahendite arv ja uue töövoo haldamine mõjutavad netokasu. Risk ei tõenda, et lisatöö kindlasti ületab kasu. |
| STAR-i liidestuseta pole spetsialisti töökoormuse vähenemine selge. | Õige. Samuti on liiga lai eeldada, et liidestuseta ei saa ükski tööülesanne paraneda: infootsing ja kohtumise ettevalmistus võivad aidata ka siis. Mõju pole mõõdetud. |
| Autor ütleb, et platvorm vähendab dubleerimist. | Lõpliku kirja kohta ebatäpne. Seal on „võiksid vähendada“ ja „soovime hinnata praktilises kasutuses“. Käsitsi STAR-i kandmine on sõnaselgelt avaldatud. |
| KOV-id kasutavad või kaaluvad juba tasulist tehisaru. | Konkreetsete KOV-ide kohta pole vastuses kontrollitavat tõendit. Sisuline võrdlusvajadus on siiski õige: tasuline üldabiline on üks võimalik võrdlusalus. See ei asenda automaatselt platvormi andmeallikaid ja töövooge. |
| Tehisaru ladusus ei taga vastuse õigsust; vaja on kehtivaid allikaid ja KOV-i erisusi. | Õige. Platvormil on selleks konkreetseid mehhanisme, kuid nende olemasolu ei võrdu tõendatud sisulise veatusega. |
| Kirjas ei esitata vastuste kvaliteedi hindamise tulemusi. | Õige kirja kohta. Järeldus, et tulemusi või teste üldse pole, ei oleks õige. |
| Sotsiaalvaldkonna teemapiir pole kvaliteedigarantii. | Õige. Lõplik kiri nimetab seda seadistuseks, mitte kvaliteedigarantiiks. |
| Inimese enda eelinfo või enesehinnang on absurdne, sest spetsialist hindab teisiti. | Sellisel üldkujul põhjendamatu. Erinev vaade ei muuda inimese kirjeldust kasutuks. See ei asenda professionaalset hindamist; kood eristab neid. |
| Peab olema selge, kes pöördumise võtab ja millal tegutseb. | Õige ja oluline. Vastuvõtu ning määramise mehhanismid on olemas; kokkulepitud töökorraldus ja terviklik tähtaegade juhtimine pole nende olemasoluga tõendatud. |
| STAR2-s on juba menetlemine ja registriliidesed. | Üldpõhimõte on ametlike allikatega kooskõlas. Kõiki vastuses nimetatud andmeid ja tähtaegade erireegleid eraldi kinnitada ei saanud. |
| Kiire juhtum 7 päeva, lihtmenetlus 10 päeva, aeg algab vastuvõtmisest. | Sellise universaalse reeglina kontrollimata. Menetlusliik, töö- või kalendripäevad ning õiguslik algushetk vajavad eristamist. Tarkvara nupuvajutus ei tõenda tähtaja õiguslikku algust. |
| SKA on täidesaatev asutus, seega sinna minek ei anna midagi. | Järeldus ei pea paika. SKA on STAR-i vastutav töötleja ja sisulise arenduse osaline. See ei tähenda, et SKA üksinda otsustab kogu valdkonna poliitika, rahastuse või hanked. |
| Vaja on spetsialistide simulatsioone ja tulemuste aruannet. | Hea soovitus kasutusmõju ja töökorralduse tõendamiseks. Esmase tutvustava vestluse eeltingimusena oleks nõue põhjendamatult lai. |
| Tegemist on testimata süsteemiga. | Liiga kategooriline. Olemas on nii tehnilised tervikradade katsed kui ka päris mudelivastuste hindamised. Ulatuslik praktilise töö mõju hindamine on eraldi puuduv tõend. |

Vastukirja tugevus on praktilise töö küsimuste nähtavaks tegemine. Selle nõrkus on tõenditasemete segamine: kirjas puuduv selgitus ei tähenda automaatselt puuduvat funktsiooni, mõõtmata kasu ei tähenda tõendatud kasutust ning esmatutvustus ei võrdu tootmiskasutuse taotlusega. Hindamine keskendub peamiselt KOV-i menetleja vaatele ja käsitleb vähem pöörduja, teenuseosutaja ning professionaalse toe vajadusi. Nende vajaduste olemasolu omakorda ei tõenda veel selle konkreetse platvormi paremust.

**3. Lõplikus kirjas on olulised piirangud juba kirjas.**

Kirjas seisab:

> Ühised töövahendid võiksid vähendada dubleerimist ning säästa aega ja raha, mida soovime hinnata praktilises kasutuses.

Samuti:

> Platvorm ei asenda STAR-i: ametlik menetlus ja toimik jäävad sinna.

Ja:

> Kuni liidest ei ole, kannab spetsialist või teenuseosutaja vajaliku teabe STAR-i ise ning platvorm aitab selle ette valmistada.

Seetõttu tuleb parandada ka varasemat üldistavat hinnangut, justkui oleks omanik juba lubanud tõendatud kokkuhoidu või varjanud käsitsi ümberkandmist. Siin on esitatud kasuhüpotees ja liidestuse piirang. Hüpoteesi kontrollimise küsimus jääb asjakohaseks.

Kirja enda täpsustamist vajavad eelkõige järgmised kohad:

| Kirja koht | Tõend ja vajalik täpsus |
|---|---|
| Ligi 11 000 allikakirjet | Praeguses aktiivses plaanis 10 856 dokumendikirjet. Sõna „allikakirje“ on sobiv; need ei ole 10 856 sõltumatut väljaandjat ega kvaliteedikinnitust. |
| Ajakirja Sotsiaaltöö 892 artiklit | Arv on dokumenteeritud 8.10 korpuse ülevaates. Selle alamhulga uut sõltumatut loendust käesolevas töös ei tehtud. |
| Automaatsed jälgimise ja uuendamise mehhanismid | Koodis olemas. Kogu korpuse täielik ajakohasus ja kõigi ajastatud tööde edukus ei ole sellega tõendatud. Kirja sõna „aitavad“ on põhjendatum kui „tagavad“. |
| Teemavälisest vastamisest loobumine | Erialane eesmärk ja juhised on olemas. Kõigi teemaväliste sisendite kindlat tõrjumist ei saa vaadatud koodi põhjal garanteerida. |
| Inimene ei pea olukorda uuesti kirjeldama | Eeltäitmine ja info üleandmine on olemas. Ühes varasemas katses jäi teema eeltäitmata; saaja võib vajada lisaküsimusi. Parem väide on „vähendab sama info uuesti sisestamise vajadust“. |
| Kohtumisel jääb rohkem aega sisuliseks tööks | Põhjendatud eesmärk, kuid veel mõõtmata tagajärg. „Aitab valmistuda ja võib jätta rohkem aega“ eristab teostust mõjust. |
| Eelinfo saatmine e-posti või platvormi kaudu | Mõlemad rajad on olemas, kuid nende turvapiir on erinev. Tundliku täisinfo jaoks peab olema kokkulepitud sobiv kanal. |
| Inimese kontroll oma teabe üle | Kehtib enda algkirje ja jagamisvalikute kohta. Vastuvõtja tööks tekkinud koopia ei allu tingimata samale kustutamisotsusele. |
| Eraldi keskkondade asemel ühised töövahendid | Mitme töövahendi teostus on olemas. Kõigi seniste toodete asendatavust, litsentsidest loobumist või kulusäästu pole tõendatud. |
| Automaatne äriregistri- ja tegevusloakontroll liitumisel | Registrikontrolli teenused ja MTR-i värskendusloogika on olemas. Kõikide registreerumisvariantide otsast lõpuni garantiid selles analüüsis ei kontrollitud. |
| Riigi süsteemidega võrreldav või kõrgem turvatase | Kirjas sõnastatud eesmärgina. Võrdleva turvaauditi, sertifikaadi või süsteemidevahelise mõõtmisega kinnitamata; esmakirjas loob kõrge tõendamiskoormuse. |
| Oma mudeli abil odavam teenus | Viimases kirjas puudub üleminekul lause, mis seletaks alternatiivse mudeli kavatsust. Oma mudeli kogukulu vähenemine ei ole iseenesest tagatud. |

Korpuse mõõtmise taust: [12.10 arvuline kontroll](evidence/rag-corpus-size-2026-10-12.json), [8.10 katvuskaart](rag-v2-coverage-map-2026-10-08.md). 12.10 logis oli sama otsingupõlvkonna 96 115 otsinguühikut. Seda arvu ei tohi esitada 96 115 eraldi allikana.

**4. Eelpöördumine vastab omaniku kirjeldatud eesmärgile.**

Teostuses saab inimene valida vaba kirjelduse, lühema kaardistuse või põhjalikuma küsimustiku. Viimane kasutab STAR-i hindamisvahendi seitset eluvaldkonda ja 21 põhiküsimust. Samal ajal on inimese vastamisviis kohandatud enesekirjelduseks: ta ei täida kõiki spetsialisti hindamistoiminguid ega RFK skoorimist. RFK read lisatakse saaja materjali spetsialistile; pöörduja neid ei näe ega hinda. Eksport ütleb sõnaselgelt, et tegemist ei ole ametliku abivajaduse hindamise või teenuse määramise otsusega. [Küsimustik ja selgitus](../../lib/preInquiriesQuestionnaire.js), [STAR-i küsimuste seos](../../lib/preInquiryStarTool.js).

Seega on täpne öelda „kasutab STAR-i hindamisvahendi seitset eluvaldkonda ja 21 põhiküsimust“. Oleks liiga tugev öelda, et inimese täidetud vorm on juba valmis ametlik STAR-i hindamine või spetsialisti täidetud hindamisvahendi täielik vaste. Sama küsimuse kasutamine ei tähenda sama hindamisrolli.

Omaniku mõte on sisuliselt kaitstav: inimene saab panna enda sõnadega kirja, mis talle raskusi valmistab, ja anda sellest enne kohtumist teada. Kodus kirjutamine võib mõnele inimesele olla lihtsam kui esimene suuline selgitus kabinetis. Käesolev analüüs ei mõõtnud, kui paljudele see sobib või kas konkreetne vorm neile jõukohane on. Valik peab jääma vabatahtlikuks ning abi saamine ei tohiks eeldada pika küsimustiku iseseisvat läbimist.

Erinevus inimese ja spetsialisti hinnangu vahel on arutelu lähtekoht. Näiteks inimese lause „saan kodus hakkama“ võib kohtumisel täpsustuda nii, et tegelikult toob naaber iga päev süüa. Eelkirjeldus aitab spetsialistil märgata täpsustamist vajavat kohta; ta peab endiselt hindama tegelikku toimetulekut. Enesekirjelduse ebatäpsuse võimalus ei põhjenda selle kõrvalejätmist.

SKA ametlik TAH-i kirjeldus kinnitab professionaalse hindamise rolli ja eluvaldkondadepõhist struktuuri. Sellest ei tulene, et inimene ei võiks oma olukorda enne kohtumist kirjeldada. [SKA selgitus hindamise kohta](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/taisealise-inimese-abivajaduse-hindamine-uued-voimalused-star).

Kohtumiseks valmistumine on koodiga toetatud: adressaadi kontroll, info üleandmine, vastuvõtmine, saaja tööleht ja järgmise kontakti märkimine on olemas. See loob võimaluse eelinfo kasutamiseks. See ei tõenda, et konkreetne spetsialist saab teate õigel ajal, loeb teksti enne kohtumist või et kogu tööaeg väheneb. [Pöördumise teenus](../../lib/preInquiries.js), [saaja töövoog](../../lib/preInquiryReceiverWorkflow.js).

**5. SotsiaalAI tööpõhimõte on allikapõhine, kuid genereerimisvea võimalus säilib.**

Kontrollitud rada teeb küsimusest otsingu, valib teadmusbaasist asjakohased tekstiosad, arvestab teatud allikatel kehtivusaja ja piirkonnaga ning annab leitud materjali mudelile vastuse koostamiseks. Vastus läbib vormi- ja viitekontrolli. See on sisuliselt rohkem kui üldmudelile ühe sotsiaaltöö juhise lisamine.

| Kontrollitud mehhanism | Mida see aitab vältida | Piir |
|---|---|---|
| Sõnalise ja vektorotsingu ühendamine | Ainult mudeli varasemale treeningteadmisele toetumist | Otsing võib jätta vajaliku lõigu leidmata või tuua vale konteksti |
| KOV-i ja riiklike allikate eristamine | Ühe omavalitsuse reegli suvalist üldistamist | Piirkonna tuvastamine ja allika märgistus võivad eksida |
| Õigusallikate kehtivuse kontroll | Teadaolevalt vale ajavahemiku õigusakti kasutamist | Eeldab korrektseid metaandmeid; ei tõenda iga artikli või juhendi ajakohasust |
| Vastuse viidete kontroll leitud allikate vastu | Olematu või otsingupaketti mittekuuluva viite avaldamist kontrollitud väljal | Päris viide võib olla seotud vale järeldusega |
| Ebapiisava info, täpsustamise ja osalise vastuse vormid | Põhjendamatult kindla vastuse sundimist igal juhul | Mudel võib siiski valida vale vastamisviisi või jätta olulise tingimuse välja |
| Õigusnormi nimetamise järelkontroll | Võimaliku vea nähtavaks tegemist auditiks | Praegune vaikeseadistus registreerib leiud; see kontroll ise ei blokeeri vastust |

Tehnilised tõendid: [otsing](../../lib/rag-v2/search/retrieval.js), [piirkondlik valik](../../lib/rag-v2/search/unified.js), [kehtivus](../../lib/rag-v2/search/legal-validity.js), [vastuse leping](../../lib/rag-v2/pilot/contracts.js), [vestluse juhised](../../lib/rag-v2/pilot/dialogue.js), [õigusnormide järelkontroll](../../lib/rag-v2/pilot/provision-check.js), [rakendamine](../../lib/rag-v2/pilot/service.js).

Oluline konkreetne leid: `REFUSED_KINDS` on praegu tühi. Seetõttu ei saa õigusnormide järelkontrolli nimetada kõiki ekslikke paragrahviviiteid peatavaks kaitseks. See on teostuses teadlikult auditiks jäetud mehhanism, mitte tõend, et kõik muud vastuse kontrollid puuduvad.

Omanikul on õigus, et platvormi vastamisprotsessi ei kirjelda piisavalt väljend „tavaline tehisaru, mis mõtleb vastuse välja“. Samas ei ole põhjust omistada vastukirja autorile just ChatGPT rakenduse võrdlust: tema tekst seda ei ütle. Ka ChatGPT võib kasutada veebiotsingut ja viiteid. Võrdlus peab käima konkreetsete andmeallikate, kontrollide ja samade ülesannete tulemuste üle. [ChatGPT otsingu kirjeldus](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt).

RAG ei kõrvalda genereerimisvigu: vale vastus võib tekkida nii halvast otsingutulemusest kui ka leitud õige teksti valest tõlgendusest. Seda eristust kirjeldab ka mudeliteenuse pakkuja. [OpenAI täpsuse parandamise juhend](https://developers.openai.com/api/docs/guides/optimizing-llm-accuracy).

API kaudu edastatud andmete vaikimisi treeningust väljajätmise kohta on kirja väide korrektne üldreegel. See ei tähenda automaatselt andmete säilitamata jätmist, ainult Eestis töötlemist ega eriliigiliste andmete sisestamise õiguslikku lubatavust. Konto eritingimusi ja nullsäilituse staatust siin ei kontrollitud. [OpenAI andmekasutuse tingimused](https://developers.openai.com/api/docs/guides/your-data).

**6. Teste on tehtud; nende tulemustest tuleb rääkida täpselt.**

| Olemasolev tõend | Tulemus | Tegelik järeldus |
|---|---|---|
| 9.10 Teekonna ja eelpöördumise kohalik HTTP- ja andmebaasirada | 15 kontrolli, 15 läbitud | Sünteetiline kasutaja lõi ja muutis Teekonda, saatis eelinfo, saaja võttis vastu ning vastus jõudis tagasi. See ei ole kõigi vormiharude, asutuse töökorralduse või tootmisteavituste tõend. |
| 9.10 kovisiooni tervikrada | 12 kontrolli, 12 läbitud | Etapid, lõpetamine ning järeltegevus toimisid kirjeldatud katses. Mõju spetsialisti tööle või heaolule ei mõõdetud. |
| 9.10 supervisiooni tervikrada | 7 kontrolli, 7 läbitud | Kutse, lepingu aktsepteerimine, tööheaolust üleandmine, kohtumised/kokkuvõtted ja lõpetamine läbisid kontrollid. |
| 9.10 tööheaolu üleandmised | Salvestatud väljad vastasid; kordus ei loonud dubleeritud kirjet | Tõendab konkreetsete üleandmiste tehnilist käitumist. Ei tõenda heaolu paranemist ega riikliku statistika sobivust. |
| 28.09 vestluste hindamine, 16 vestlust / 40 vooru | Hilisema korduse 38/40 kontrolli läbis | Kindla arendusaegse komplekti tulemus. See ei ole praeguse versiooni 95% sisuline õigsus ega sõltumatu esinduslik kvaliteedihinnang. |
| 8.10 RAG-i audit ja vastusekatsed | Kirjeldatud ka sisulisi puudujääke, sh arvulise tingimuse ebatäpsus | Näitab, et allikaviide ei välista vale vastust. Hiljem muutunud versioonile ei saa samu vigu ilma uue tõendita automaatselt üle kanda. |

Tulemused: [Teekond](evidence/funktsioonideaudit-journey-local-results.json), [kovisioon](evidence/funktsioonideaudit-covision-complete-local-results.json), [supervisioon](evidence/funktsioonideaudit-supervision-complete-local-results.json), [tööheaolu](evidence/funktsioonideaudit-wellbeing-local-results.json), [vestluste hindamine](rag-v2-conversation-eval-2026-09-28.md), [RAG-i paranduskatsete aruanne](rag-audit-fixes-2026-10-08.md), [RAG-i audit](rag-system-audit-2026-10-08.md).

13.10 aktiivse RAG-plaani vastamisjuhise versioon oli `m4-grounded-dialogue-43`. Kasutus oli `development_only` ja lubatud kasutajate arv üks. See tähendab piiratud RAG-arenduskasutust; see pole platvormi kõigi kasutajate loendus. Praeguse versiooni üldine sisuline õigsusmäär on **NOT_PROVEN**. Uusi tasulisi hindamisringe käesoleva analüüsi lõpetamise eeltingimuseks ei seata.

Vastukirja täpne ja õiglane sõnastus oleks seega: „Kirjast ei selgu olemasolevate katsete ulatus ega praktilise kasutuse tulemused.“ Väljend „testimata süsteem“ jätab reaalselt tehtud töö põhjendamatult arvestamata.

**7. Vastutus ja andmekaitse: osa küsimusi on lahendatud tehniliselt, osa vajab asutuse kokkulepet.**

Organisatsiooni tööalal kontrollitakse aktiivset liikmesust, organisatsiooni ja mooduli olekut ning tegevusõigusi. Liikmesuse peatamine ja lõpetamine on teostatud. Lõpetamisel kontrollitakse pooleliolevat määratud tööd ning nõutakse selle üleandmist või sulgemist; eemaldatakse seotud õigused. [Ligipääsukontekst](../../lib/org/accessContext.js), [liikmesuse teenus](../../lib/org/members.js).

Organisatsiooni postkastis on vastuvõtmise aeg, määramine, menetlusolekud ja audit. Koodis on ka teavitused ja sulgemisega seotud juurdepääsupiirid. Serveris olid organisatsiooni tööala, postkast, juhtumitöö ja teenusepäevik vaatlushetkel sisse lülitatud. Funktsioonilipp ei tõenda siiski, et mõne KOV-iga oleks sõlmitud kasutuskokkulepe või seal töötaks vastutav vastuvõtumeeskond. [Postkasti teenus](../../lib/org/inbox.js).

12.10 [raamlepingu mustand](../legal/sotsiaal-pro-organisatsioonikasutuse-raamleping-MUSTAND-2026-10-12.md) kirjeldab organisatsiooni vastutava ja platvormi volitatud töötleja rolli tööalases kasutuses, kasutatavate moodulite kokkuleppimist, töötajate õigusi ja säilitust. See on oluline ettevalmistus. Mustandi olemasolu ei tõenda allkirjastamist, juristi heakskiitu ega iga andmevoo õiguslikku alust. AKI eristab töötlemise õiguslikku alust, eriliigiliste andmete lisatingimusi ja poolte vastutust. [Õiguslikud alused](https://www.aki.ee/isikuandmed/andmetootlejale/tootlemise-oiguslikud-alused), [töötlejate rollid](https://www.aki.ee/vastutav-ja-volitatud-tootleja).

Inimese enda Teekond, spetsialistile saadetud koopia ja organisatsiooni ametlik töödokument võivad alluda erinevale säilitusele. Seetõttu ei saa inimese kontrolli lubadusest järeldada, et ta saab kõigi saajate kõik koopiad tagasiulatuvalt kustutada. Organisatsiooni liikmesuse lõpetamine ei tõenda ka eraldi alla laaditud või isiklikule vastuvõturajale saadetud koopiate kadumist.

E-posti puhul on oluline tegelik teostus: platvormisisese pöördumise automaatne e-kirjateavitus sisaldab üldist teadet ja sisselogimislinki, mitte juhtumi täisinfot. Välise e-kirja koostamisel on detailide lisamine vaikimisi välja lülitatud, kuid kasutaja saab neid lisada; kopeerimine ja allalaadimine on samuti võimalikud. `mailto` ise ei krüpteeri sisu. Kasutaja märge „saadetud“ ei tõenda välist kättetoimetamist ega ametlikku vastuvõtmist. [Saatmise UI ja vaikeseaded](../../components/workspace/WorkspaceFeaturePage.jsx), [saatmise ja vastuvõtu teenus](../../lib/preInquiries.js).

Järelikult ei ole täpne väita, et platvorm saadab tundliku täisküsimustiku automaatselt tavalise e-kirjaga. Samuti pole põhjendatud kuulutada iga e-posti kasutus iseenesest privaatsusrikkumiseks. Sobivus sõltub andmetest, saajast, kanalist ja rakendatud kaitsemeetmetest. Kirjas oleks täpsem „platvormis või kokkulepitud turvalise kanali kaudu“.

Kiireloomulisuse hoiatused ja kriisiabisse suunamine on koodis olemas. Need ei tähenda ööpäevaringset inimvalvet. Pöördumise staatuse kuvamine peab eristama edastamist, vastuvõtmist, sisulist tööd ja ametlikku otsust. Pelk nimetus „eelpöördumine“ ei määra üksinda selle õiguslikku tähendust; asutuse tegelik vastuvõtukorraldus vajab selget kokkulepet.

**8. Analüüs leidis ka konkreetseid tehnilisi piiranguid.**

1. **Vastuvõetud isikliku eelpöördumise võrgustikuga jagamine on vastuolus olekumuutusega.** Vastuvõtt muudab oleku `SENT` → `READY`, aga vastav võrgustikujagamise kontroll nõuab endiselt `SENT` olekut. 9.10 katses tekitas see pärast vastuvõttu keeldumise; sama vastuolu on praeguses koodis alles. See leid puudutab nimetatud rada, mitte kogu platvormi jagamist. [Jagamise kontroll](../../lib/network/share.js), [vastuvõtu olekumuutus](../../lib/preInquiries.js), [varasem funktsioonideaudit](funktsioonideaudit.md).

2. **Tähtaegade juhtimist ei saa olemasoleva andmevälja põhjal valmis funktsiooniks lugeda.** Organisatsiooni postkastil on `dueAt`, selle eksport ja üle tähtaja filter. Kontrollitud `lib/org`, `app/api/org` ja `components/org` radades ei leidunud selle tähtaja määramise või automaatse arvutamise teostust. Teekonna isiklik samm võib küll kanda tähtaega, kuid see on teine asi kui asutuse menetlustähtaja juhtimine. Varasem vahekokkuvõte „tähtajad on olemas“ oli liiga üldine.

3. **Serveri teavitustöö viimane käivitus oli ebaõnnestunud.** 13.10 kell 20.27 oli `sotsiaalai-notifications.service` olekus `failed`, väljumiskoodiga 1; viimane väljumine oli 20.23. Ka `sotsiaalai-practice-reviews.service` oli olekus `failed`, väljumiskoodiga 22. Frontend ise töötas. See ei tõenda ühegi konkreetse inimese saamata jäänud teadet ega kõigi teavitusviiside katkemist. [Vaatluskirje](evidence/kirja-analuus-runtime-2026-10-13.json).

4. **Suletud avaliku ligipääsu värav võib teavitustööd takistada.** Töö saadab päringu töövõtmega; praegune avaliku avamise värav nõuab kaitstud API-radadel administraatori seanssi ning teavitustöö rada pole erandite seas. See annab konkreetse koodist tuletatud võimaliku põhjuse. Tegelikku veavastust või serverilogi põhjal juurpõhjust selles analüüsis ei kinnitatud; päris teavitustööd prooviks ei käivitatud. [Töö](../../scripts/notification-job.mjs), [avalikud erandid](../../lib/publicPlatform.js), [värav](../../proxy.js).

Need leiud ei muuda eelpöördumise ideed valeks. Need piiravad väidet, et kogu vastuvõtu-, teavitus- ja jätkutöö rada on juba usaldusväärseks igapäevakasutuseks tõendatud. Avalik sissepääs on praegu omaniku otsusega suletud; selle hetke olekut ei tohi esitada avatud teenuse kasutajate tõendatud kahjustusena.

**9. STAR ja SKA: olemasoleva süsteemi rolli tuleb arvestada, kuid SKA ei ole vale vestluspartner.**

STAR on ametliku sotsiaaltöö ja menetlemise keskne register. Avalikus kirjelduses on mitmed riiklike andmekogude ühendused; seetõttu ei saa Sotsiaal.pro väärtust põhjendada oletusega, et STAR-is pole andmevahetust või spetsialisti taustainfot. Samal ajal ei tõenda registri ametniku töövaade automaatselt, et inimese enda ettevalmistus ja abini jõudmise kogemus on samal viisil lahendatud. STAR-i 2026–2030 arenguvaadet tuleb arvestada ka tulevase kattuvuse hindamisel. [STAR-i ametlik ülevaade](https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/star).

STAR2 ei ole üks tervikfunktsioon ühe avamiskuupäevaga. Täisealise inimese hindamise lahendus oli kasutatav juba 2024. aasta oktoobrist. 12.10.2026 avaldatud teade 3. novembri ülemineku kohta puudutab lastekaitsetöö muudatusi. Sellest ei saa järeldada, et kogu STAR2 oleks 13.10 alles tulevikus. [TAH-i selgitus](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/taisealise-inimese-abivajaduse-hindamine-uued-voimalused-star), [lastekaitsetöö ülemineku teade](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/star2-tuleb-mis-muutub-lastekaitsetootaja-igapaevatoos).

Vastukirja üldsõnaline „tervise andmed“ vajab ulatuse täpsustamist: ravikindlustuse, puude või töövõime andmed ei tähenda automaatselt ligipääsu kogu terviseloole. Kõigi nimetatud registripäringute praegust kasutajaõiguste ulatust siin ei kontrollitud.

Tähtaegade kohta viitab SKA avalik selgitus hoolekandeabi otsustamisel üldjuhul kümnele **tööpäevale**. See on varasem selgitus, mitte käesolevas töös kontrollitud kõigi 2026. aasta menetlusliikide reeglistik. Üldist „kiire juhtum seitse päeva“ reeglit ei leidnud kinnitust. Seda ei kuulutata automaatselt väljamõeldiseks: autor võib kirjeldada konkreetset asutuse või tarkvara tööreeglit. Enne sellele toetumist tuleb täpsustada reegli allikas, menetlusliik ja algushetk. [SKA pöördumiste selgitus](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/kuidas-vastata-inimese-poordumisele).

SKA enda ajakohane andmekaitseteave nimetab SKA-d STAR-i vastutavaks töötlejaks ning KOV-e, teenuseosutajaid ja TEHIK-ut volitatud töötlejateks. Seega on võimalikku andmevahetust puudutav tutvustus SKA-le sisuliselt asjakohane. SoM-i poliitika- ja rahastusvaade ning TEHIK-u tehniline roll täiendavad seda vestlust. [SKA roll STAR-is](https://www.sotsiaalkindlustusamet.ee/asutus-uudised-ja-kontakt/praktiline-teave/isikuandmete-tootlemine).

Ühesuunaline andmete edastamine STAR-i võib olla arutelus eraldi piiratud kasutusjuhtum. Lugemisõiguse puudumine ei tõenda ei kirjutamise võimalikkust ega võimatust. Vajalikud liides, vastuvõtuõigused, andmekoosseis ja töötlemisalus tuleb lahendada vastava osalisega; olemasolevat avalikku kirjutamisliidest see analüüs ei kinnitanud.

**10. Kas lisandub keskkond või väheneb töö? Vastus sõltub ülesandest.**

Platvormi ei saa hinnata üksnes süsteemide arvu järgi. Üks uus keskkond võib asendada mitu olemasolevat, aga võib jääda ka nende kõrvale. Praegu ei ole tõendatud kumbki lõpptulemus kõigi KOV-ide kohta.

| Kasutusjuhtum | Konkreetne olemasolev alus | Võimalik väärtus, mida tuleb mõõta | Mis võib kasu vähendada |
|---|---|---|---|
| Inimene valmistub pöördumiseks | Vaba kirjeldus, Teekond, valikuline küsimustik | Lihtsam alustada, vähem ununenud teemasid, selgem enda eesmärk | Digiraskus, pikk vorm, inimesele lisanduv töö |
| Spetsialist valmistub kohtumiseks | Saadetud eelinfo ja saaja tööleht | Vähem alginfo kogumist kohtumisel, täpsemad küsimused | Eelinfo läbivaatamine lisatööna, vigade parandamine, STAR-i kandmine |
| Spetsialist otsib juhist või kohalikke tingimusi | Erialane korpus, otsing, allikaviited | Lühem tee sobiva algallikani | Vastuse ja kehtivuse kontroll, ebaõnnestunud otsing |
| Teenuseosutaja korraldab teenust | Koduteenuse ja teenusepäeviku moodulid | Vähem eraldi tabeleid ja käsitsi aruandekoondust | Mõne senise töövahendi vajalik funktsioon ei ole asendatud |
| Spetsialist kasutab erialast tuge | Kovisioon, supervisioon, mentorlus, eetikaruum, tööheaolu | Ühes kohas järjepidev töö ja vähem info ümbertõstmist | Teenuse sisuline kvaliteet, osalejate leidmine, aja- ja hinnakulu |

Praegune Teekonna teostus sisaldab inimese samme, nende tegijat/tähtaega/olekut ning inimese enda hinnanguid muutusele. Need ei ole pelgalt kirjas kirjeldatud idee. Samas ei ole inimese enda muutushinnang automaatselt objektiivne sekkumise mõjuhinnang. [Sammud](../../lib/journey/steps.js), [enesehinnangud](../../lib/journey/assessments.js), [hindamise reeglid](../../lib/journey/assessmentRules.js).

Koduteenuse, teenusepäeviku ja teiste moodulite olemasolu ei tõenda kõigi eraldi toodete täielikku asendatavust. Eetikaruumi 11.10 audit kirjeldab konkreetset privaatset töövoogu; see ei tõenda kõikide erialaste vastuste õigsust või kõigi helivestluste töökindlust. [Funktsioonide ülevaade](funktsioonide-teostusseis-2026-10-08.md), [eetikaruumi kontroll](ethics-room-2026-10-11.md).

Kasulik mõõt on **netotööaeg**: senine ülesande koguaeg miinus uus koguaeg. Uus koguaeg peab sisaldama ka eelinfo lugemist, tehisaru vastuse kontrolli, andmete parandamist, STAR-i kandmist ja uue postkasti jälgimist. Kohtumise lühenemine üksi ei tõenda töötaja ajavõitu, kui sama töö liigub kohtumise ette.

Rahaline mõju sisaldab lisaks välditavaid vana tarkvara kulusid ning uue teenuse, juurutuse, koolituse, kasutajatoe ja andmehalduse kulu. Vabanenud tööaeg võib tähendada paremat teenust või rohkem teenindatud inimesi; eelarvest vabanevat raha ei teki sellest automaatselt. Eraettevõttena arendamise võimalus ei tõenda iseenesest väiksemat kogukulu või lihtsamat haldust.

Ka rohkem pöördumisi ei oleks tingimata läbikukkumine: kui varem abi küsimata jätnud inimesed jõuavad abini, võib ligipääs paraneda ja töötajate koormus samal ajal kasvada. Seetõttu tuleb eristada teenuse kättesaadavust, sisulist tulemust, töötaja koormust ja rahalist säästu.

Varasem mõte riigile tööheaolu ülevaate andmisest vajab eraldi käsitlust. Vabatahtlike platvormikasutajate andmed ei kirjelda automaatselt kogu valdkonda; vaja oleks sobivat koondamist, väikeste rühmade kaitset ja valimi kallutatuse arvestamist. Individuaalse tööheaolu töövahendi olemasolu ei tõenda, et selline riiklik andmevoog juba olemas või sobiv on.

**11. Milliseks järgmiseks sammuks on tõendeid piisavalt?**

Esmaseks tutvustuseks ja probleemi täpsustamiseks SKA-ga on alus olemas: tegelikud töövood, allikapõhine otsing, kirjalikud katsed ning ausalt välja öeldud liidestuse piirang. Ametnikuga vestlemiseks ei ole vaja enne tõendada kogu riigi kokkuhoidu. Vestluse eesmärk võibki olla täpsustada, millist probleemi, liidest ja koostöövormi on mõtet edasi uurida.

Kokkulepitud kasutuskatseks tuleb valida konkreetne töö ja vastutav osaline. Olemasolevate tõendite järgmine mõistlik täiendus oleks näiteks:

1. Vaadata spetsialistiga läbi üks tegelikku tööd jäljendav eelpöördumine, sealhulgas inimese ja spetsialisti hinnangu erinevus. Selgitada välja, kas saadetud info aitab kohtumist ette valmistada.
2. Võrrelda sama infootsingu ülesannet praeguse tööviisi ja platvormiga, arvestades ka algallika kontrollimise aega. Olemasolevad salvestatud mudelivastused sobivad sisulise hindamise alustamiseks; uus tasuline voor pole vältimatu eeldus.
3. Mõõta üks teenuse dokumenteerimise ja STAR-i kandmise ülesanne tervikuna, et ümberkandmise töö ei jääks ajavõidu arvutusest välja.
4. Kontrollida vastuvõtu puudumist, töötaja vahetumist, kiireloomulist kirjeldust ja ebaõnnestunud teavitust. Inimesele peab jääma arusaadavaks, mis on päriselt vastu võetud.
5. Määrata enne päris andmetega kasutust asutuse vastuvõtja, reageerimiskord, lubatud andmed, säilitus ja katkestuse asendusrada. Lepingumustand on selleks lähtepunkt.

Need on tõendamist vajavad järgmised küsimused, mitte selles analüüsis juba tehtud piloot ega tingimus, mis takistaks esmast arutelu.

**12. Mida saab omaniku seisukohast põhjendatult öelda.**

- Eelpöördumine annab inimesele võimaluse enda abivajadusest enne kohtumist teada anda ja spetsialistile ettevalmistuseks materjali. Professionaalne hindamine jääb spetsialistile.
- Tehisaru kasutab spetsiaalset teadmusbaasi, allikaotsingut ning piirkonna-, kehtivus- ja viitekontrolle. Need on tegelikud tehnilised erinevused, kuid ei taga iga vastuse õigsust.
- Platvormi on testitud. Olemasolevatest katsetest saab esitada konkreetsed näited koos piirangutega; praktilist netokasu ja praeguse versiooni üldist sisulist õigsusmäära ei ole tõendatud.
- STAR-i liidest pole ja ametlik töö jääb STAR-i. See oli lõplikus kirjas selgelt kirjas. Mõne platvormi töövahendi võimalik kasu ei sõltu liidestusest, dubleerimise vähendamine ametlikus menetluses sõltub sellest oluliselt.
- SKA-ga tutvustav vestlus on asjakohane. SoM-i, TEHIK-u, KOV-ide ja teenuseosutajate kaasamine võib anda eri küsimustele vastuse; üks osaline ei asenda kõiki teisi.
- Vastukirja praktilised küsimused tasub võtta hindamise aluseks. Kategooriliste hinnangutega eelpöördumise mõttetuse, testide puudumise või SKA-ga suhtlemise kasutuse kohta ei toeta tõendid nõustumist.

Analüüs kinnitab seega platvormi sisulist teostust ja omaniku eelpöördumise mõtte põhjendatust. See jätab lahtiseks mõõtmata kasutusmõju ning toob välja parandamist või kokkulepet vajavad konkreetsed piirid. Need kaks järeldust saavad korraga õiged olla.
