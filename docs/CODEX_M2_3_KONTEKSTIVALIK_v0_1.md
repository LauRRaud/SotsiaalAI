# Codex: M2.3 koondvastuvõtu salvestamine ja piiratud kontekstivaliku parandus

Versioon: 0.1
Koostatud: 05.09.2026
Staatus: järgmise töövooru ülesanne, mitte tehtud teostus ega käivitustulemus.

## 1. Eesmärk

Lõpeta käimasolev M2.3 hindamisplokk kokkulepitud ulatuses ning katseta ühte diagnoositud kontekstivaliku muudatust. Tulemuseks peab olema versioonitud, korratav otsinguprofiil ja selge ühenduskoht järgnevale M4 sisepiloodile. Ära alusta uut üldist auditit, uut hindamisraamistikku ega RAG-i ümberkirjutamist.

Selles voorus ei ühendata Lunat ega avata avalikku vestlust. M3 sisuline sõltuvusgraaf ja M5 ajaline ülevaaterada jäävad toote sihtidesse; neid ei asendata naaberlõikude lisamisega.

## 2. Omaniku tegelik koondkinnitus

Pärast koondpaketi ja assistendi järelkontrolli esitamist ütles omanik selles vestluses:

> kinnitan. aga mis arenduses edasi teha?

See kinnitab varem piiritletud koondi: 61 kontekstiotsust, 13 korpusekatvuse otsust ning vastuolu puudumise otsused ainult vastuvõetavates kontekstides. K13, K21, K24, K41, K42, K45 ja K67 jäävad muutmata ootele. Varasemad rubriigi, tööandja ning inimsuhete B–D kinnitused säilivad. Sama koondi jaoks uut kinnitust ei küsita.

Kinnituse alus on omaniku teadlik otsus assistentide koostatud ja üle vaadatud materjali põhjal, mitte väide iseseisvast pimedast inimhindamisest või iga tervikteksti isiklikust lugemisest. Ära kanna assistenti `owner` või `human_reviewer` rolli. Kasuta olemasoleva vastuvõturaja tegelikku omaniku identiteeti; ära mõtle puuduvat identiteeti või allkirja välja. Vastuvõtu salvestamise aeg ja vestluse kinnituse täpne aeg on eri asjad; teadmata aega ei tohi leiutada.

Kontrollitavad sidumised:

- Rubriik: `2.0-proposal-2`.
- Rubriigi normaliseeritud räsi: `266f2abc39662a4f580ca3407513231a1cf0d5d53189604039a8250c4fba3e35`.
- Koondettepaneku `batch-review-proposal.json` failiräsi: `10741380c31479cd1c02d537d120098ca5858fa01bcdabfa3b12fa5e7f863cdc`.
- Koondettepaneku aluseks olnud otsuste normaliseeritud räsi: `219ee76f6391f409ec4f6cc0e976210507e50f308e41201fd3b80b3bf59593ec`.
- V1 lähtepayload: `485f65a73b7ee12d3a466f30bdf3b32fab4c8ed89a534c76d9e97afe35004fce`.
- Korpuse snapshot: `a78ea0c39ccea0dd342ed0a40ca02e24485bf7ce8acffaf2a813e45ca30e4ccc`.

Need räsid täidavad eri rolle; ära võrdsusta failiräsi normaliseeritud objekti räsiga. Kasuta projektis olemasolevat serialiseerimist ja valideerimist.

Kui otsused on juba korrektselt salvestatud, kontrolli neid ja jätka idempotentselt. Kui kohalik alus on vahepeal muutunud, ära kirjuta uusi otsuseid vana koopiaga üle. Võrdle sihtkirjeid ja lahenda ainult tegelik konflikt.

Lisa lõppotsusesse K22/K47/K50 põhjendus: EKA rolli tugi on olemas, kuid küsimuses nõutud Tehnopoli elluviijate allikakoht puudub; EKA tekst ei asenda seda allikanõuet. Lisa K65 põhjendus: mõlema nõutud allika rollikirjeldus on olemas. Räsiga algpakett ja v1 jäävad muutmata.

Korpuse negatiivsete otsuste alus jääb piiratud salvestatud kaheksa dokumendi valimiks. Assistendi järelkontroll hõlmas 58 eksporditud unikaalset tekstiosa, mitte kõigi 69 kanoonilise üksuse uut sõltumatut auditit. Ära tugevda seda väidet vastuvõtukirjes.

## 3. Loe tegelik tööseis, mitte ainult seda ülesannet

Loe repositooriumi juhiseid, `docs/platvormi arendus/SotsiaalAI.md` S1.0 kirjet, aktiivset RAG masterit, asjakohaseid ADR-e ning mitme allika auditi M2.3 jaotisi. Tuvasta tegelik HEAD ja tööpuu. Selle ülesande koostamisel ei kontrollitud uut GitHubi HEAD-i ega serveriseisu.

Kasuta olemasolevaid privaatseid koond-, rubriigi- ja otsusefaile. Dokumendi asukoht võib olla `tmp/rag-v2-m2-3/` all; ära eelda, et need failid kuuluvad Gitti. Säilita omaniku muud tööd ja aktiivne pärisindeks.

## 4. Kõigepealt salvesta vastuvõtt ja tee üks ametlik võrguta kordushindamine

Salvesta vastuvõetud kirjed olemasoleva otsustevormingu järgi koos põhjenduse, tegeliku kinnituse aluse ja muutumatu sisuseosega. Tee seniste 84 rea kordushindamine olemasoleva tööriistaga. Uut otsingut ega embedding'uid selleks ei tellita.

Manifesti prognoos pärast koondvastuvõttu ja varasemate otsuste säilitamist on `full=50`, `partial=14`, `absent=13`, `needs_review=7`. See on kontrollitav prognoos, mitte nõue tulemused selliseks kirjutada. Erinevuse korral näita põhjuseks konkreetne rida või sisuseos; ära muuda rubriiki prognoosi saavutamiseks.

Esita jaotus meetodi ja küsimuseperekonna järgi. Ära nimeta nelja meetodi peale kokku liidetud 50/84 arvu süsteemi täpsuseks. Erista bibliograafia, täielikult/osaselt vastatav küsimus, korpuses puuduv tugi ja lahendamata hinnang. Ära anna osatoele suvalist arvulist kaalu ega jäta ootel ridu varjatult nimetajast välja.

Need seitse lahtist juhtumit ei blokeeri eraldiseisvat tehnilist katset või M4 ettevalmistust. Neid ei kasutata kinnitatud võidu ega kaotusena. Sama küsimuse teise meetodi kinnitatud rida ei lahenda ootel konteksti automaatselt.

## 5. Üks valikumuudatus: põhileiud enne vabatahtlikke naabreid

### Kontrollitud lähteprobleem

Diagnoos näitab, et struktuurikatse valis kolm järjestatud seemet ja kaks naabrit. Intsidendi ning EN/RU rahastamise puhul jäi vajalik viies hübriidleiu üksus välja ka siis, kui tokenipiir ei olnud täis. See puudutab konkreetset valikupoliitikat; selle põhjal ei kuulutata graafe üldiselt kahjulikuks.

### Selle töövooru teostus

1. Struktuurne laiendus jääb edaspidise kasutusprofiili vaikeseades välja. Ajalooline `hybrid_structure` rada peab jääma reproduktsiooniks kasutatavaks; selle senist tähendust ära muuda.
2. Lisa eraldi versioonitud valikupoliitika, näiteks `ranked-first-nondisplacing-v1`. See valib kõigepealt samad lubatud järjestatud põhileiud, mille vastav struktuurita baasrada valiks.
3. Ainult eksplitsiitselt sisse lülitatud struktuurilaiendus tohib seejärel kasutada tegelikult üle jäänud üksuse-, dokumendi-, sammu- ja tokenimahtu. Naabrite jaoks ei reserveerita ette kahte kohta. Naaber ei tõrju juba valitud põhileidu välja.
4. Kui viie üksuse piir on põhileidudega täidetud, ei lisandu kuuendat üksust ka vaba tokenimahu korral. Kui alles on ruumi, kehtivad naabrile kõik olemasolevad õiguse-, versiooni-, struktuurse päritolu ja mahukontrollid. Piiride täitumist näita põhjusena; ära kärbi algteksti vaikselt.
5. Säilita võrdluses olemasolevad 40 kandidaati kanali kohta, 5 lõppüksust, 6000 tokenit ja piloodi sama dokumendipiir. Kontrolli tegelikke piloodiseadeid; ära kasuta märkamatult erinevaid tuuma vaikeseadeid. Tokenipiir kehtib tegelikule kompaktsele kontekstile koos selle allikaandmetega.
6. Kõik turva- ja ligipääsukontrollid jäävad alles. Valiku säilitamise invariant kehtib sama lubatud ulatuse ja fikseeritud põlvkonna piires; hilisem õiguse tühistamine on sellest tähtsam.

See on tahtlikult konservatiivne parandus. Kui uus rada annab täidetud viie koha tõttu sama tulemuse kui olemasolev hübriid ilma struktuurita, märgi need võrdseks. Ära nimeta seda uueks graafivõimeks ega võiduks sama struktuurita hübriidi ees.

Ära muuda selles voorus RRF-i valemit, kaale, leksikaalset päringut, dokumendikvooti, parserit, tükeldamist ega embedding-mudelit. See parandus ei lahenda vektori 3. kohalt hübriidi 14. kohale langenud allika probleemi. See jääb eraldi diagnoositud fusioonitööks, mitte varjatult selle muudatuse osaks.

Kui tegelik kood sellise mitteväljatõrjuva käitumise juba toetab, kasuta olemasolevat võimekust eksplitsiitses profiilis ja lisa vajalik test. Ära loo dubleerivat komponenti.

## 6. Võrdle ausalt ja taaskasuta tehtud tööd

Katseta sama kandidaadisisendiga: puhas vektor, muutmata struktuurita hübriid, ajalooline 3+2 struktuurirada ja uus eksplitsiitne valikupoliitika. Täiendavate kaalude ega poliitikate ruudustikotsingut selles voorus ei tehta.

Kasuta salvestatud pärisvektoreid. Valikumehaanika võrdluse saab teha olemasolevate kandidaatide ja kanooniliste üksuste lokaalsest kordusesitusest. Kohalike PostgreSQL-i/Qdranti integratsioonitestide käivitamine on eraldi tehniline kontroll, mitte välismudelikutsumine. Uut indeksi aktiveerimist selleks pole vaja.

Hoia vana sisuline katse ja uus katse eraldi väljundites. Kõik vana kontrollosa tulemused on pärast diagnoosi retrospektiivne arendus-/regressioonitõend, mitte puutumatu valideerimine.

Võrdlus näitab nõude kaupa:

- milline tekst lisandus või eemaldus ja millise valikureegli tõttu;
- kas varem kinnitatud toetav tekstikomplekt säilis;
- kas puuduv vajalik tekst jõudis valikusse;
- konteksti tokenid, üksuste arv, päritolu ja valiku kestus;
- uued lahendamata või vastuoluka toe kandidaadid.

Vana konteksti sisuline kinnitus on seotud selle konkreetse sisuräsiga. Muudetud kontekstile seda automaatselt ei kopeerita. Juba kinnitatud tõendusvastendusi võib kasutada asukohakatvuse kontrolliks, kuid uue tervikkonteksti täielikku semantilist kinnitust sellest üksi ei teki. Muutumatu kontekst saab sama olemasoleva otsuse. Uutest kontekstidest koosta ainult muudatuspõhine, deduplitseeritud ülevaatus, mitte kogu vana 84 rea uus kinnitusring. Vastuolu puudumist ei tuletata lihtsalt sellest, et mõni vana õige lõik jäi alles.

Hindaja rubriik, õiged allikakohad, kontekstiotsused ja küsimuseperekonna vastatavuse sildid ei tohi jõuda käitusaegsesse valikufunktsiooni. Ei lisata küsimuse-ID, lehekülje, Tehnopoli nime või intsidendi märksõna põhiseid erandeid.

Näita eraldi ka võimalikku kaotust: vana naabrilisa võis mõnes olukorras tuua vajaliku teksti, mida viie põhileiu valik ei too. Seda ei peideta üldise paranemise taha. Kui uut poliitikat ei tasu kasutada, jäta see katsetulemuseks ja säilita lihtsam struktuurita baasprofiil.

## 7. Piiritletud vastuvõtukontrollid

Kasuta projekti olemasolevat testitaristut. Ära lisa uut hindamisteenust.

- Viies sobiv põhileid säilib ega kao ainult naabritele kohtade reserveerimise tõttu.
- Vaba tokenimaht ei tühista üksuste ülempiiri; täidetud üksusepiir annab nähtava põhjuse.
- Vaba üksuse- ja tokenimahu korral saab lubatud struktuurne naaber lisanduda ilma põhileiu väljatõrjumiseta.
- Puuduv/duplikaatne/vale versiooni või lubamatu naaber ei lisandu; õiguse tühistamise kaitsed säilivad.
- Sama sisend ja profiil annavad korratava valiku; ajalooline katseprofiil ja v1 säilivad.
- Puuduv cache-kirje ei käivita peidetud embedding-kutset. Tasulisi ja genereerivaid kutseid on selles voorus 0.
- Testid katavad rubriigi eraldatuse käituskoodist ning vana kinnituse mitteülekandmise muudetud kontekstile.

Käivita muudetud moodulite sihttestid, asjakohane RAG-regressioon, lint ja projekti build. Näita pass/fail/skip eraldi. PostgreSQL-i/Qdranti ühenduse kasutamisel rakenda olemasolevaid kohaliku võrgu piiranguid. Puuduva teenuse või sisendi korral ütle, mida ei käivitatud; ära asenda seda väidetava päristeenusetõendiga.

## 8. Lõpptulemus ja järgmine suund

Selle vooru väljundid on:

1. Tegelik koondvastuvõtukirje ja muutumatul sisendil põhinev ametlik kordushindamine.
2. Üks piiratud valikumuudatus või olemasoleva samaväärse võimekuse eksplitsiitne kasutus, koos testidega.
3. Võrdlusraport: võidud, kaotused, võrdsed ja lahendamata juhtumid; tulemust ei eeldata ette.
4. Versioonitud M4-s kasutatav otsinguprofiili kandidaat: kõik seaded on eksplitsiitsed ja struktuur vaikimisi väljas. Puhas vektor ning struktuurita hübriid jäävad kontrollitud alternatiivideks; uue ametliku meetodipõhise raportita ei kuulutata üht universaalseks võitjaks.
5. Lühike järgmise M4 töö kontrollnimekiri olemasolevas S1.0-s: uue küsimuse embedding, serverisessioonist õigused, kompaktne kontekst, ühe vastaja adapter, kanoonilised viited, salvestamine ja taastatavus. M4 teostust selles voorus ei alustata.

Tee ettepanek väikseks uueks kontrollkogumiks, milles on uued sisulised juhtumid, mitte üksnes juba nähtud küsimuste tõlked. Enne valideerimist fikseeri profiil, küsimused, nõuded ja edukriteeriumid; kontrollosa ei kasutata häälestamiseks. Siin kinnitatud koond ei anna uute tekstide ega päringute väljasaatmise luba. Uus embedding'u või Luna katse vajab ühe koondplaaniga selget materjali- ja kululuba. Tehnilise adapteri ettevalmistamine ei pea seda luba ootama.

M4 piiritletud sisepilooti ei ole vaja siduda kogu M3 graafi valmimisega. Praktiliste teenusetingimuste ja erandite usaldusväärset rakendamist katsetatakse eraldi M3 sisuliste sõltuvustega. Suure korpuse päringuaegse kordustöö vähendamine, M5 ajaline süntees ja tootestamine säilivad järgmistes töödes.

Peatu selle vooru lõpus tulemuste ülevaatuseks. Ei tehta automaatset push'i, deploy'd, avaliku chati avamist, andmete kustutamist ega uut tasulist katset. Koodimuudatused, privaatne tõendusmaterjal ja serveri seis on aruandes selgelt eristatud. Avaliku chati `generationAvailable=false` jääb muutmata.

## Allikad ja nende roll

- `batch-review.md`, `batch-review-proposal.json`, `batch-review-manifest.json`: vastuvõtu ulatus ja räsiseosed; failide enda ootel olek eelneb omaniku siinses vestluses antud kinnitusele.
- `KOOND_JARELHINNANG.md` ja `batch-review-assistant-check.json`: assistendi järelkontroll ning nelja puuduva põhjenduse ettepanek, mitte omaniku otsus.
- `rag-v2-multi-source-preparation-2026-09-05.md`, M2.3 kitsas diagnoos / Struktuurivaliku tegelik piir: tuvastatud 3+2 valiku puudujääk ja fusiooni eraldi probleemid.
- RAG master, M0 audit ja ADR-id: olemasolevad moodulipiirid ja veel ühendamata kasutajarajad. Nende vanema seisukirje asemel loe tööjärje jaoks uusimat S1.0.

Põhileidude eelisjärjekorraga poliitika on käesoleva ülesande arendusettepanek. Selle kasu, piisavust ja üldistumist pole veel katseliselt kinnitatud.
