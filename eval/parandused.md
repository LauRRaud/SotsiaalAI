Süvaanalüüs: runtime e1a8eea4 34 juhtumi kordustest
Lugesin läbi commit’is bf42f576 olevad kolm faili:
•	külmutatud 34 juhtumi manifesti;
•	tulemuste faili;
•	kõik 34 traces.jsonl rida koos planner’i, retrieval’i, dokumendiidentiteedi, valitud konteksti, generaatori, validaatori, atribuutika ja UI andmetega.
Kordustesti tulemus oli 3 PASS, 4 PARTIAL ja 27 FAIL; allikapaneel avanes 17 juhul 34-st. See kordus hõlmas ainult eelmise jooksu 34 mitte-PASS-juhtumit. Varasemaid 41 PASS-juhtumit runtime’il e1a8eea4 ei korratud, mistõttu selle versiooni täielik 75 küsimuse tulemus on endiselt NOT_PROVEN. 
Põhijäreldus
Paranduspakett ei jäänud lihtsalt vähese mõjuga. See:
1.	lahendas mõned varasemad vead, näiteks J03, J14 ja K01;
2.	jättis suure osa dokumendiidentiteedi ja küsimuse mõistmise probleemidest alles;
3.	lisas uue süsteemse regressiooni, mis blokeeris mitu sisuliselt õiget autorivastust;
4.	tegi auditi mõnes kohas eksitavaks, sest „esimese lahkneva kihi” märgend ei vasta trace’is nähtavale tegelikule esimesele veale.
Minu varasem soovitus kontrollida ka mudeli genereeritud „kõvasid fakte” oli põhimõtteliselt mõistlik, kuid selle rakendamine olemasoleva üldise exact_numeric_fact_v6 validaatori kaudu oli liiga lai. See oli selle parandusringi kõige selgem eksimus.
________________________________________
1. Suurim uus regressioon: iga genereeritud arv käivitab vale tüüpi validaatori
Commit e1a8eea4 lisas factContract.js-i funktsiooni answerContainsHardClaim(). See loeb kõvaks faktiks sisuliselt iga vastuses oleva arvu, protsendi, kuupäeva, telefoninumbri või paragrahvi. Seejärel kutsub mainResponseHandler.js pärast vastuse genereerimist uuesti shouldValidateExactFactAnswer() ning võib saata ka mittearvulise vastuse üldisesse arvufaktide validaatorisse. 
Runtime-tõend
Autoriküsimustes A03, A05, A07 ja A08 toimis autoriretrieval tegelikult:
•	A03 leidis Kadi Lubi neli artiklit ja author_corpus_complete=true;
•	A05 leidis Jane Langemetsa kaks artiklit ja täieliku inventuuri;
•	A07 leidis Kadri Kuulpaki autorikorpuse, mille kogumaht oli 18 dokumenti;
•	A08 leidis Merle Tombergi kaks artiklit ja täieliku inventuuri.
Kõik neli vastust blokeeriti aga põhjusel cross_source_numeric_mix, sest vastuses nimetati artiklite ilmumisaastaid. Näiteks A03 valideerija luges arvulisteks väideteks aastad 2025, 2020, 2025 ja 2022. Küsimus ei küsinud ühtegi arvulist fakti; ta küsis artiklite teemasid. 
See tähendab, et süsteem tegi järgmise järelduse:
Autor kirjutas artikleid aastatel 2020, 2022 ja 2025
→ vastuses on mitu arvu
→ arvud pärinevad eri allikatest
→ cross_source_numeric_mix
→ kogu autorivastus asendatakse keeldumisega
See pole arvude faktitäpsuse kontroll. See on eri dokumentide bibliograafiliste aastate ekslik käsitlemine ühe arvulise vastuseväitena.
Sama validaator annab ka valepositiivseid PASS-e
J09 puhul vastas mudel ainult täpsustava küsimusega, milliseid nelja protsenti kasutaja mõtleb. Validaator eraldas sõnast „nelja” väärtuse 4, leidis selle valitud artiklist ning andis passed=true. Kasutaja ei saanud ühtegi küsitud protsenti, kuid validator leidis tehniliselt „toetatud arvu“. 
J12 puhul valideeriti peamiselt aasta 2017, kuigi kasutaja küsis viit lepingus kavandatud kohtumist.
J13 puhul valideeriti vanusevahemiku ja muude kõrvalarvude olemasolu, kuid puudu jäi kasutaja põhiküsimuse vastus: tavaliselt 3–5 probleemi.
Seega praegune validator kontrollib sageli:
kas vastuses esinenud arv leidub kusagil tõendis?
Ta ei kontrolli piisavalt:
kas vastus täitis kasutaja küsitud arvulise või kategoorilise lepingu?
K02 näitab teist äärmust
K02 puhul leidis süsteem õige Narva koduteenuse allika, kuid mudel lisas toetamata arvud, sealhulgas 9.00, 12.00, 13.00 ja 16.00. Validaator tabas need õigesti. Seejärel asendati aga kogu vastus üldise keeldumisega ja kadus ka korrektne Narva koduteenuse taotlemisinfo. 
Siin ei ole õige lahendus validaatori eemaldamine. Õige lahendus on väitepõhine parandamine:
toetatud Narva taotlemisjuhis
+ toetamata kellaajad või muud arvud
→ eemaldada või regenereerida ainult toetamata väited
→ säilitada toetatud taotlemisjuhis
Parandus
answerContainsHardClaim() ei tohi üksi exact numeric validatorit aktiveerida.
Valideerija valik peab sõltuma küsimuse lepingust ja route’ist:
•	specific_research_fact + count/proportion/duration → range numeric validator;
•	current contact → contact validator;
•	legal exact → paragraph validator;
•	author works → author inventory validator;
•	synthesis → claim attribution, mitte cross-source numeric mixing;
•	KOV teenuse kirjeldus → kontrolli genereeritud kõrvalarve, kuid paranda väitepõhiselt.
Bibliograafilised aastad, ajakirjanumbrid ja leheküljenumbrid tuleb autoriloendi ja allikakirjelduse puhul eristada vastuse sisulistest arvuväidetest.
Staatus: RUNTIME-PROVEN ja CODE-PROVEN.
________________________________________
2. EstNLTK proper-name kasutamine rikub pärisnimesid
Autoriraja teine suur viga pole enam pelgalt käändevormi mitteäratundmine. Süsteem muudab osa täiesti õigeid nimesid vigaseks.
Trace’ides on näiteks:
•	Krister Tüllineni → Krister Tülline;
•	Maarja Krais-Leoski → Maarja Krai Leo;
•	Kadi Lubi → Kadi Lub;
•	Liina Lokko → Lii Lokko;
•	Judit Strömpli → Judi Strömpel.
Kõige suurema moonutusega A02, A06 ja A10 ei leidnud ühtegi dokumenti. Kadi Lubi ja Krister Tüllineni puhul suutis Pythonis olev sallivam autorivõrdlus olukorra osaliselt päästa. 
Täpne koodipõhjus
lemma_index.py teeb päringuanalüüsi disambiguate=False režiimis ja säilitab kuni kaheksa võimalikku analüüsi. See on retrieval’i jaoks mõistlik.
Kuid proper-name span’i canonical_text moodustamisel võetakse iga tokeni esimene lemma:
token_lemmas[0]
ning neist tehakse väidetavalt kanooniline nimi. Hyphenit _WORD_RE samuti tokeni osana ei säilita, mistõttu Krais-Leoski võib laguneda eraldi osadeks. 
Seejärel võtab canonicalMorphologyPersonCandidate() morphology pakutud nime vastu, kui kasutaja nime ja morphology nime sõnad algavad piisavalt sarnaselt. Kui tingimus sobib, asendatakse kasutaja tegelik nimi morphology canonical_text väärtusega. 
extractNamedPersonIntent() kasutab seda asendust otse person_name väärtuse määramiseks. 
Seega on ahel:
korrektne surface name
→ Vabamorfi mitu võimalikku analüüsi
→ esimene lemma kuulutatakse kanooniliseks
→ prefix-compatibility lubab asenduse
→ planner kasutab vigast nime retrieval-filtris
See on vastuolus analyze_query() enda lubadusega, et analüüs ei asenda surface-vormi.
Autorikanoonika pole ka serveris päriselt kanooniline
Python RAG paneb author_metadata_summary.canonical_author_name väljale praegu sisuliselt sama väärtuse, mis oli kasutaja päringus:
"canonical_author_name": requested_author_tokens[0]
See ei ole registri sobitatud autori tegelik metadata nimi. 
Samal ajal kasutab queryPlanner.js jätkuvalt kasutaja/planneri nimekujust loodud täpset filtrit:
authors: { $in: [personName] }
Python eemaldab autorifiltri enne registri sallivat nimevõrdlust, mis päästab osa juhtumeid. Kuid arhitektuuris elavad endiselt paralleelselt:
•	vigane morphology-kanoonika;
•	täpne JS autorifilter;
•	salliv Python registry resolver;
•	eraldi JS selection;
•	eraldi attribution’i autorivõrdlus.
Õige lahendus
Proper-name morphology peab tagastama:
surface_text
lemma_candidates
name_candidate = true
Ta ei tohiks ise tagastada autoriteetset canonical_text.
Autoriteetne kanoonika peab tulema registrist:
surface user name
→ bounded registry person match
→ registry canonical author name
→ canonical author key
→ active document IDs
Hyphenitud nimi tuleb säilitada ühe nimeosana või vähemalt taastada originaalspan’i järgi.
Kõik edasised kihid peavad kasutama sama:
•	canonical_author_key;
•	canonical_author_name;
•	author_document_ids.
Mitte enam kasutaja käändelise nime ja metadata stringi uut võrdlemist igas kihis.
Staatus: RUNTIME-PROVEN ja CODE-PROVEN.
________________________________________
3. Autorirada töötab tegelikult paremini, kui lõpptulemus näitab
A-ploki 1 PASS-i lähedane tulemus jätab mulje, nagu autoriretrieval üldiselt ei töötaks. Trace näitab täpsemat pilti.
Autoriretrieval töötas
•	A03: neli korrektset Kadi Lubi artiklit;
•	A05: kaks korrektset Jane Langemetsa artiklit;
•	A07: 18 dokumendiga Kadri Kuulpaki täielik autorikorpus;
•	A08: kaks korrektset Merle Tombergi artiklit.
Need ebaõnnestusid alles validaatoris.
Autorite täielik inventuur tuvastati, kuid generaator ei usaldanud seda
A01 ja A04 puhul oli author_corpus_complete=true ja dokumentide koguarv üks. Mudel vastas siiski, et autori täielikku artiklite nimekirja ei saa kinnitada. 
See tähendab, et retrieval/metadata ütles:
täielik aktiivsete autoridokumentide inventuur on olemas;
aga generaatorile jõudnud leping ütles või jättis mulje:
valitud katkendid ei pruugi olla täielik loend.
buildAuthorCorpusCountInstruction() on eeskätt artiklite arvu küsimuse jaoks. Tavalise authored_works teemaküsimuse puhul pole piisavalt tugevat käsku, et täielikku metadata inventuuri usaldada. 
A07 jääks ka pärast validatoriparandust osaliselt riskantseks
A07 inventuuris oli 18 artiklit, kuid mudelikonteksti valiti neist 10. See võib olla piisav näidete andmiseks, kuid mitte kõigi artiklite teemade ammendavaks ülevaateks.
Siin oleks vaja metadata-põhist autorikorpuse sünteesi:
18 täielikku pealkirja + aastad + sektsioonid
→ teemaklastrid kogu inventuurist
→ ainult vajaduse korral body-katkendid klastrite selgitamiseks
Ei ole mõistlik laadida kõikide artiklite täispikki katkendeid ainult selleks, et nimetada nende teemasid.
Vajalik autorivastuse leping
AUTHOR_INVENTORY:
canonical author
inventory_complete
document_count
all document IDs
all titles
all years
all sections
Kui inventory_complete=true, ei tohi mudel väita, et täielik loend on kinnitamata.
Staatus: retrieval’i võimekus PARTIAL; lõppvastus FAIL valideerimise/generatsiooni tõttu.
________________________________________
4. Paljud „retrieval”-vead on tegelikult dokumendiidentiteedi vead
results.md märgib esimese lahkneva kihina muu hulgas kaheksa retrieval-viga. Trace’ide põhjal on mitu neist valesti klassifitseeritud: õige dokument oli retrieval’i kandidaatide hulgas, kuid hilisem identity selector valis vale dokumendi või ei valinud ühtegi. 
J04: õiged Perepesa artiklid leiti, kuid valiti sotsiaalse ettevõtluse artikkel
Retrieval leidis muu hulgas:
•	„Perepesa toetab laste ja perede heaolu”;
•	„Kolmes omavalitsuses avati kogukondlikud ennetus- ja peretöökeskused”.
Selector valis hoopis:
„Millistel tingimustel kasutab heaolu arengukava sotsiaalse ettevõtluse potentsiaali?”
Põhjus on trace’is nähtav. Planner muutis dokumendi subject term’ideks ka:
•	millistes;
•	linnades;
•	neli;
•	ülesannet;
•	neil.
Vale artikkel sai vasteid sõnadele millistes, linnades, ülesannet ja neil, mille järel rakendus decisive_subject_lead. 
See pole retrieval recall’i viga. Õiged dokumendid olid juba olemas. See on identity feature’i viga.
J07: küsimuses oli täpne artikli pealkiri, kuid seda ei kasutatud hard anchor’ina
Küsimuses nimetati jutumärkides täpselt:
„Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust”.
See artikkel oli retrievitud ja identity kandidaatide hulgas. Sellegipoolest valiti 2017. aasta „Kohaliku omavalitsuse väljakutsed sotsiaalteenuste osutamisel”. 
Trace’i kandidaatide nähtavad score väärtused olid isegi:
•	Töötukassa koostööprojekt: 21;
•	õige „Seltsilised…” artikkel: 16;
•	valitud KOV väljakutsete artikkel: 13.
Esmapilgul tundub, et selector eiras oma skoori. Kood näitab, et see ongi nii üles ehitatud: sortimisel võrreldakse enne lõppskoori muu hulgas document anchor’ite arvu, requested metric shape’i täielikkust, title-subject vasteid ja subject-vastete arvu. score on comparatoris alles viimane tingimus. 
Seega trace’is kuvatav score ei ole tegelik valikufunktsioon. See on observability-viga ja kalibreerimisviga korraga.
Lisaks ei tarbi selectSpecificResearchFactGroups() küsimuse current_turn_document_identity.title_hint väärtust hard anchor’ina. Selector ehitab identiteedi uuesti üldistest subject term’idest ja retrieval channel’itest. J07 trace’is on current_turn_document_identity=null, kuigi küsimuses oli täpne jutumärkides pealkiri.
J08: sõna „neli” muutus dokumendi subject term’iks
Hoolduskoormuse küsimuses olid subject term’id:
•	hoolduskoormuse;
•	neli;
•	küsitud.
Mitu eri dokumenti sai seetõttu võrdselt tugeva hoolduskoormus + neli vaste ning identity jäi ambiguous. Õiged või vähemalt tõenäolised allikad olid retrieval’is olemas. 
neli kirjeldab siin oodatud vastuse kardinaalsust. See ei ole dokumendi teema.
J11: puudulik metric slot aitas vale dokumendi lukustada
Küsimus küsis:
•	intervjuude koguarvu;
•	individuaal- ja rühmavestluste jaotust;
•	kolmeetapilist analüüsimeetodit.
Planner/contract tegi sellest ainult ühe amount-slot’i. Vale Kovisiooni artikkel sisaldas väärtust 1, mille süsteem sidus selle ühe slot’iga. See andis requested_metric_shape_complete ja decisive_requested_metric_shape_lead, mille järel vale dokument sai high-confidence identity. 
See on ringne sõltuvus:
puudulik requested slot
→ leiab vales dokumendis suvalise sobiva arvu
→ metric shape loetakse täielikuks
→ metric shape kinnitab dokumendi identiteedi
→ sama vale dokument muutub ainsaks tõendiks
Koodipõhine põhjus
selectSpecificResearchFactGroups():
1.	kasutab subject term’ide hulgas liiga palju küsisõnu, asesõnu, tegusõnu ja kardinaalsust;
2.	hindab requested metric shape’i juba dokumendiidentiteedi otsustamisel;
3.	lubab decisiveSubjectLead ja muid heuristikaid muuta muidu sobimatu kandidaadi identityMatched=true;
4.	sorteerib kandidaatide eri omaduste leksikograafilise jadaga, mitte ühe läbipaistva kalibreeritud skooriga.
Parandus
Dokumendiidentiteedi signaalid peaksid olema järjekorras:
1.	täpne jutumärkides pealkiri;
2.	canonical author + publication year;
3.	dokumenti identifitseeriv akronüüm;
4.	registry title/description unikaalne vaste;
5.	organisatsioon + document kind;
6.	eristavad teematerminid;
7.	alles viimases faasis fact-shape disambiguation.
Dokumendi identiteeti ei tohiks kinnitada sõnad:
•	milline;
•	millistes;
•	neil;
•	selles;
•	küsitud;
•	mitu;
•	neli;
•	millist;
•	kasutati.
EstNLTK POS ja IDF/statistiline eristusvõime on siin kasulikumad kui aina pikem käsitsi stopword-loend.
Staatus: RUNTIME-PROVEN ja CODE-PROVEN.
________________________________________
5. RequestedFactSlot on lisatud, kuid production-consumer ei ole veel üldine
Commit lisas üldisemaid tüüpe:
•	count;
•	proportion;
•	amount;
•	duration;
•	date;
•	season;
•	location;
•	person role;
•	method;
•	entity list jne.
Kuid extractRequestedFactSlots() teeb juhul, kui vana numeric parser eraldi slotte ei leia, ühe globaalse slot’i kogu küsimuse kohta. 
J07: viis mõõdikut muutusid kolmeks slot’iks
Kasutaja küsis:
1.	inimesi;
2.	vabatahtlikke;
3.	töötunde;
4.	maakondi;
5.	omavalitsusi.
Contract registreeris kolm requested slot’i. Konstruktsiooni „mitmes maakonnas ja omavalitsuses” ei lahutatud kaheks count/location slot’iks. 
J11: neli eri nõuet muutusid üheks amount-slot’iks
Küsimuses oli kolm arvulist suhet ja üks kvalitatiivne meetod. Contract leidis ühe väärtusega 1 slot’i ning kuulutas selle täielikuks.
M01 vajaks kolme eri tüüpi slot’i
Milline oli meetod, millal uuring tehti ja kui palju osalejaid oli?
Vajalikud slotid on:
method
timepoint või period
participant_count
Üks kogu küsimuse requestedFactValueType() ei saa neid kõiki esindada.
J12 vajab modaalsust
J12 ei küsi ainult arvu 5. Ta küsib:
mitu kohtumist pidi lepingu järgi toimuma?
Vajalik leping:
value_type = count
relation = rühmasupervisiooni kohtumised maakonna kohta
modality = contracted
year = 2017
expected answer = 5
„Toimus viis” ja „lepingu järgi pidi toimuma viis” ei ole sama väide.
V04 vajab relation cluster’it, mitte ainult kardinaalsust
V04 sai õigest või vähemalt temaatiliselt sobivast eakate vägivalla artiklist kolm väärtust 22%, 41% ja 13%. Need arvud olid valitud allikas olemas ning validator andis PASS-i. Benchmark ootas 10%=640, 6%=227 ja 2%=100. 
Praegune contract oskab sisuliselt öelda:
anna kolm näitu
Ta ei oska öelda:
anna kolm selle konkreetse nähtuse näitu
ja seo iga protsent vastava inimeste arvuga
Samas on V04 sõnastus „mis olid kolm näitu?” ise tõenäoliselt ebapiisavalt täpne, kui artiklis esineb mitu kolmest arvust koosnevat rühma. Seda ei saa ainult trace’i põhjal lõplikult otsustada. Enne product-fixi tuleb kontrollida artiklist, kas 22/41/13 ja 10/6/2 on kaks eri sisulist klastrit.
Seega V04 juures on korraga:
•	CONFIRMED: validator ei kontrollinud oodatud relation cluster’it;
•	NOT_PROVEN: kas canonical küsimus võimaldab ilma lisavihjeta üheselt valida 10/6/2 klastri.
Parandus
RequestedFactSlot peab olema päriselt klauslipõhine:
slot:
  value_type
  subject
  relation
  category
  unit
  expected_cardinality
  explicit_values
  temporal_scope
  modality
  required
Completeness tähendab seejärel:
kõik required slotid on vastuses olemas
+
iga slot on seotud õige source span’iga
+
vastuses pole kõrvalisi hard claim’e
Mitte lihtsalt seda, et kõik mudeli juhuslikult esitatud arvud leiduvad kusagil allikas.
________________________________________
6. Vestlusajalugu lekib endiselt iseseisvatesse küsimustesse
Manifestis kasutati viit vestlust, mitte värsket vestlust iga küsimuse kohta. J/V-ploki 18 küsimust saadeti ühte järjestikusesse vestlusse. 
See paljastas päris history-probleemi, kuid segas ka isolated-turn kvaliteedi mõõtmist.
J22: „selles” viitab sama lause e-kursusele, mitte eelmisele pöördele
Küsimus:
„Millal tehti e-kursuse järelhindamine ning kelle vaadet selles võrreldi?”
Sõna „selles” viitab lokaalselt e-kursuse järelhindamisele. Praegune isContextDependentRetrievalTurn() loeb aga iga selles esinemise context-dependent pöördeks ning shouldUseRecentTextForRetrieval() lisab varasemad kasutajapöörded otsingusse. 
Trace’is jõudsid valikusse eelmiste küsimuste dokumendid.
V01: „neid” viitab sama küsimuse MAPPA kohtumistele
„MAPPA kohtumised – kui tihti ja mitu neid kolmes Virumaa linnas oli?”
Sõna „neid” on lokaalne viide sõnale „kohtumised”. Süsteem käsitleb seda aga eelmise vestluse anaforina ning toob kaasa hiljutised allikad. Tulemusena valiti MAPPA asemel laste ja kohaliku sotsiaaltöö artikleid. 
V03 benchmark ise on vigane jätkuküsimus
V03 ootab, et:
„Palju neid supervisioone maakonna kohta tehti?”
kasutaks sama vestluse J12 konteksti.
Kuid manifestis ei tule V03 J12 järel. Vahele jäävad:
•	J13;
•	J14;
•	J18;
•	J20;
•	J22;
•	V01.
V03 on alles R-B01 pöörde 15 küsimus, J12 oli pööre 8. Seitsme pöörde kaugusel pole „neid supervisioone” enam usaldusväärselt J12 viide. 
V03 peaks olema üks järgmistest:
•	kõrvaldatud isolated-turn komplektist;
•	hinnatud korrektseks täpsustusküsimuseks;
•	tõstetud teadlikku kahe pöörde testi, kus supervisiooni küsimus on vahetult eelmine pööre.
Parandus
Ajalugu tohib kasutada siis, kui puudub kohalik antecedent.
Näiteks:
"e-kursuse järelhindamine ... selles"
→ local antecedent olemas
→ history=false

"MAPPA kohtumised ... neid"
→ local antecedent olemas
→ history=false

"palju neid tehti?"
→ local antecedent puudub
→ history=true
Source-ID hard filterit tohib pärida ainult selge allikaanaphora korral:
•	„samas artiklis”;
•	„selle allika järgi”;
•	„eelmises uuringus”.
Üldised asesõnad üksi ei ole piisavad.
Staatus: RUNTIME-PROVEN ja CODE-PROVEN.
________________________________________
7. Numbrid klassifitseeritakse mõnikord nimelisteks entity’deks
J05 query plan sisaldas:
entity_names = ["30", "12", "60", "19"]
Küsimus läks grounded_question režiimi, mitte relation-bound specific fact rajale. 
entityExtraction.js lubab surface-entity regexis suurtähti või numbreid ning entityType() võib puhta numbrijada klassifitseerida akronüümiks. extractSemanticEntities() ei välista puhtaid numbreid. 
Seega muutusid küsitud faktiväärtused nimelisteks entity’deks.
Parandus on lihtne ja üldine:
pure number
percentage
year
range
paragraph number
→ fact/temporal/legal value
→ never named entity
J05 vajab nelja explicit-value slot’i koos kahe rühmaga, mitte nelja named entity’t.
________________________________________
8. Atribuutika peidab kasutatud allikaid ja kuvab mittekasutatud allikaid
S08: vastus kasutas kahte artiklit, paneeli jõudis üks
S08 valis kaks asjakohast Saaremaa kriisiartiklit. Vastus kirjeldas nii 2020. aasta praktilist kogemust kui ka 2021. aasta uuringut, kuid displayed_source_ids sisaldas ainult üht allikat. Teine peideti query-anchor-loogika tõttu. 
See on atribuutikaviga:
source on model context’is
+
vastus nimetab või kasutab selle eristatavaid väiteid
→ allikas peab saama claim mapping’u
Pelgalt query-tokenite kattuvus ei tohiks seda pärast vastuse loomist tühistada.
J04: vale allikas kuvati vastuse allikana
J04 vastas sisuliselt:
kasutatud materjal ei kinnita Perepesade infot.
Selle eitava meta-väite allikana kuvati vale sotsiaalse ettevõtluse artikkel, sest lexical claim support leidis sõnakattuvuse. 
See artikkel ei toeta Perepesade vastust. Ta oli lihtsalt valesti valitud kontekst.
M07: „ei leidnud” vastus sai teemavälise allikapaneeli
Tarkvanema vestlustöölehe asemel valiti teemavälised raportid. Süsteem võis käsitleda neid vastuse väite „praegused allikad ei kinnita” toetajatena.
„Vastuste allikad” ei tohi tähendada:
allikad, mida süsteem kontrollis enne seda, kui ta vastuse leidmata jättis.
Vajadusel peaks UI eristama:
Vastust toetavad allikad
ja
Otsingus kontrollitud allikad
Claim attribution peab olema sisuline
Praegune claim support kasutab suures osas:
•	tokenikattuvust;
•	bigramme;
•	arvude esinemist;
•	title/reply overlap’i.
See ei lahenda alati kategooria, suhte ega eitava meta-väite probleemi. 
Exact fact rajal peab prioriteet olema:
1.	validator-supported source IDs;
2.	relation-supported source IDs;
3.	claim-supported source IDs;
4.	lexical overlap ainult üldise proosa puhul.
________________________________________
9. K02 vajab claim-level recovery’t, mitte täielikku keeldumist
K02 on oluline, sest siin:
•	route oli õige;
•	KOV oli õige;
•	õige Narva koduteenuse source valiti;
•	generaator lisas toetamata arvud;
•	validator leidis need;
•	kogu vastus asendati keeldumisega.
See on üks vähestest juhtumitest, kus validator tegi oma esmase töö õigesti, kuid response recovery oli liiga jäme. 
Soovitatav recovery:
1. Tuvasta unsupported claim span’id.
2. Tee üks bounded rewrite:
   - säilita kõik toetatud väited;
   - eemalda nimetatud unsupported span’id;
   - ära lisa uusi fakte.
3. Valideeri parandatud vastus uuesti.
4. Alles teise ebaõnnestumise järel kasuta fail-closed vastust.
See on palju parem kui kogu toetatud vastuse kaotamine.
________________________________________
10. K05 sisaldab korraga benchmarki mitmetähenduslikkust ja päris selection-viga
K05 resolver leidis kaks omavalitsust:
•	Tartu linn;
•	Tartu vald.
See on kasutaja küsimuse „Tartu sotsiaaltransport” puhul päris mitmetähenduslikkus. 
Süsteemil oleks olnud põhjendatud küsida:
Kas mõtled Tartu linna või Tartu valda?
Kuid retrieval leidis tegelikult nii Tartu linna kui ka Tartu valla sotsiaaltranspordi allikaid ja valis seejärel konteksti:
•	ajutise hooldusteenuse;
•	toimetulekutoetuse paragrahvi;
•	sotsiaalse ettevõtluse artikli;
•	üldise KOV artikli.
Seega on siin kaks eraldi asja:
1.	benchmark peab lubama täpsustust, sest „Tartu” ei ole üheselt linn;
2.	selection on katki, sest isegi mitmetähendusliku Tartu puhul pidid valikusse jääma kahe omavalitsuse sotsiaaltranspordi allikad, mitte kõrvalteenused.
Ära hardcode’i Tartu → Tartu linn.
________________________________________
11. results.md esimese lahkneva kihi märgendid vajavad parandamist
Faili enda jaotus ütleb:
•	retrieval 8;
•	identity 9;
•	generation 5;
•	context 4;
•	validation 4;
•	attribution 1.
Trace’i järgi on vähemalt järgmised ümberklassifitseerimised vajalikud:
•	J04: retrieval leidis õiged Perepesa dokumendid → esimene viga on identity/selection;
•	J07: täpselt nimetatud artikkel oli retrievitud → identity/selection;
•	J08: sobivad hoolduskoormuse kandidaadid olid retrievitud → identity ambiguity;
•	J11: asjakohane töötamise toetamise materjal oli retrievitud → identity/slot selection;
•	J05: esimene viga oli number-as-entity ja vale planner mode, mitte retrieval;
•	V01: esimene viga oli local anaphora/history routing, mitte lihtsalt retrieval.
Manifest vajab iga juhtumi juurde vähemalt:
acceptable_source_ids
acceptable_document_ids
required_claim_slots
allowed_clarification
history_dependency
Siis saab esimese lahknevuse automaatselt määrata:
expected doc puudub retrieved set’ist → retrieval
expected doc olemas, kuid pole selected → identity/selection
expected doc selected, evidence span puudub → context assembly
evidence olemas, vastus vale → generation
vastus õige, validation vale → validation
vastus õige, source mapping vale → attribution
server õige, UI vale → UI
Praegune NOT_PROVEN=0 tähendab ainult, et kõigile 34 juhtumile anti auditis tulemus. See ei tähenda, et kõigi nende märgitud juurpõhjus oleks tõendatud.
________________________________________
12. 34 juhtumi parandatud juurpõhjakaart
Need rühmad kattuvad; üks juhtum võib kuuluda mitmesse.
Selge post-generation validation regressioon
•	A03
•	A05
•	A07
•	A08
Korrektne autorikorpus leiti, kuid artikliaastad põhjustasid cross_source_numeric_mix.
Destruktiivne isikunime normaliseerimine
•	A01: Krister Tüllineni → Krister Tülline
•	A02: Maarja Krais-Leoski → Maarja Krai Leo
•	A03: Kadi Lubi → Kadi Lub
•	A06: Liina Lokko → Lii Lokko
•	A10: Judit Strömpli → Judi Strömpel
Dokumendiidentiteet või selection
•	J04
•	J07
•	J08
•	J11
•	J18
•	J20
•	M01
Vale planner või intent
•	J05
•	J09
•	J12
•	J22
•	V01
•	V06
•	M02
•	M07
Puudulik requested-fact completeness või relation binding
•	J05
•	J07
•	J09
•	J11
•	J12
•	J13
•	V04
•	M01
Generaator ei kasuta olemasolevat struktureeritud tõendit
•	A01
•	A04
•	K02
•	osaliselt J13
Attribution
•	S08
•	V05
•	J04 ja M07 mittevastuste allikakuvamine
•	osaliselt K01, kus teenuseinfo jäi paneelist välja ja kuvati ainult määrus
Benchmarki või testi enda mitmetähenduslikkus
•	V03: J12 pole vahetult eelmine pööre;
•	V04: „kolm näitu” võib olla liiga üldine;
•	K05: Tartu linn või Tartu vald.
________________________________________
13. Mida säilitada
Kõiki e1a8eea4 muudatusi ei ole mõistlik tagasi võtta.
Säilitamist väärivad:
•	Python registry autorifiltri eemaldamine enne sallivat autorilahendust;
•	aktiivsete autoridokumentide täieliku inventuuri loomine;
•	KOV teenuse + kohaliku paragrahvi komposiitroute, mida K01 tõestas;
•	täpne arvufaktide validator specific fact juhtumites;
•	KOV allikate parandatud nähtavad sildid;
•	eristatud validator-supported ja displayed source ID-de trace.
J03 ja J14 näitavad, et õige dokument + õige faktileping + ühe allika tõend võib töötada väga hästi. K01 näitab, et teenuse ja kohaliku § 6 liitküsimus on põhimõtteliselt lahendatav. 
________________________________________
14. Soovitatav parandamise järjekord
P0. Piira dynamic validation
Kõigepealt eemalda üldreegel:
vastuses on mingi arv
→ exact_numeric_fact_v6
Asenda see route- ja claim-type-põhise dispatch’iga.
Kontrolli kohe:
•	A03;
•	A05;
•	A07;
•	A08;
•	K02;
•	J03;
•	J14.
J03 ja J14 on regressioonikaitse: range numeric validation peab nendes alles jääma.
P0. Keela morphology proper-name automaatne asendus
•	canonical_text ei tohi tulla esimesest lemmast;
•	surface name peab jääma põhiväärtuseks;
•	morphology võib anda kandidaate;
•	registry kinnitab kanoonilise autori;
•	säilita sidekriipsud.
Kontrolli:
•	A01;
•	A02;
•	A03;
•	A06;
•	A10.
P0. Paranda document identity
•	jutumärkides pealkiri hard anchor’iks;
•	acronym hard anchor’iks;
•	eemalda subject term’idest küsisõnad, asesõnad ja kardinaalsus;
•	ära kasuta incomplete requested metric shape’i dokumendi kinnitamiseks;
•	tee valikufunktsioon läbipaistvaks: trace’is kuvatav rank/score peab vastama tegelikule valikule.
Kontrolli:
•	J04;
•	J07;
•	J08;
•	J11;
•	J18;
•	M01.
P0. Paranda local anaphora
Kontrolli:
•	J22 värskes vestluses;
•	V01 värskes vestluses;
•	vahetu J12 → V03 kahe pöörde test;
•	V03 iseseisva küsimusena peab küsima täpsustust.
P1. Ehita päris mitmeslotiline fact contract
Kontrolli:
•	J07: viis slot’i;
•	J11: kolm count-relation slot’i + method;
•	J12: count + contracted modality;
•	J13: age range + problem count;
•	V04: kolm relation-bound proportion/count paari või kontrollitud ambiguity.
P1. Claim-level repair ja attribution
Kontrolli:
•	K02: vale arv eemaldatakse, Narva juhis säilib;
•	S08: kõik vastuses kasutatud artiklid paneelis;
•	J04/M07: mittevastuse korral ei kuvata suvalist valitud dokumenti „vastuse allikana”.
________________________________________
15. Testimise uus kord
Enne uut 34 küsimuse jooksu tee väike deterministlik värav.
Mikrovärav 1: validation
•	A03
•	A05
•	A07
•	A08
•	K02
•	J03
•	J14
Mikrovärav 2: nimed
•	A01
•	A02
•	A06
•	A10
Trace peab näitama korraga:
surface person name
registry canonical author
canonical author key
complete document inventory
Mikrovärav 3: identity
•	J04
•	J07
•	J08
•	J11
•	J18
•	M01
Trace peab näitama, miks kandidaat võitis, ning tegelik valikurank peab vastama kuvatud score/rank’ile.
Mikrovärav 4: history
•	J22 isolated;
•	V01 isolated;
•	J12 → V03 adjacent;
•	unrelated question → V03.
Mikrovärav 5: attribution
•	S08;
•	K02;
•	M07.
Pärast neid:
1.	34 küsimust igaüks värskes vestluses;
2.	eraldi deliberate multi-turn komplekt;
3.	kõik 75 küsimust runtime’il;
4.	varasemad 41 PASS-i ei tohi üle kanda ilma kordustestita.
________________________________________
16. Jõudlus
Õigsus on praegu esmane, kuid trace näitab, et valed rajad on ka kallid.
Näiteks:
•	J07 tegi kuus retrieval-query’t, retrieval wall oli umbes 10,6 sekundit ning lexical scan’i summa üle 248 000 kirje;
•	K05 tegi kaheksa päringut, retrieval wall oli umbes 13,3 sekundit ja alamotsingute summa ligikaudu 23,8 sekundit;
•	mitu identiteediviga käivitas pärast vale dokumendi valimist veel document-scoped fact search’i.
Parem planner ja varajane correct document lock vähendavad seega nii vigu kui ka latentsust. Top-k ja fusion’i häälestamine enne seda oleks endiselt vale prioriteet.
Lõpphinnang
Praegune olukord ei ole:
retrieval ei leia midagi.
Trace näitab sagedamini:
õige dokument leitakse
→ küsimuse semantika on osaliselt vale
→ identity selector lukustab vale dokumendi
→ puudulik fact contract kuulutatakse täielikuks
→ generaator vastab valest kontekstist
→ universaalne arvufaktide validator kas blokeerib õige vastuse
  või valideerib vale kõrvalarvu
→ attribution peidab õige või kuvab vale allika
Kõige kiirema reaalse kvaliteedihüppe annavad nüüd neli parandust:
1.	universaalse post-generation numeric validation’i piiramine;
2.	proper-name surface-vormi säilitamine ja registry-põhine kanoonika;
3.	dokumendiidentiteedi puhastamine küsisõnadest ning exact title/entity anchor’ite eelistamine;
4.	mitmeslotiline requested-fact completeness.
Riskipoliitika, embedding, Chroma, top-k ja lemma-FTS ranking ei ole selle 34-case trace’i põhjal järgmise parandusringi peamised sihtmärgid.


Teine eraldi kerge analüüs: Taseme vahetamine ei anna mulle ligipääsu mingi eraldi „mitte-Pro mudeli” vastusele. Selles vestluses olen endiselt GPT-5.6 Sol. Küll aga saan teha sama materjali põhjal teise, lihtsama ja konservatiivsema kontrolli, nagu vaataks seda värske pilguga ilma eelmist arhitektuurijuttu kaasa vedamata.
Selle värske kontrolli järgi on eelmine süvaanalüüs põhiosas õige. Kõige kindlamad järeldused oleksid järgmised.
1.	Kõige selgem uus regressioon on validaator. A03, A05, A07 ja A08 puhul leidis süsteem autorite õiged artiklid ning trace’is oli isegi author_corpus_complete=true, kuid vastus tapeti cross_source_numeric_mix tõttu, sest autorikokkuvõttes esinesid eri artiklite ilmumisaastad. See on väga tugev tõend, et answerContainsHardClaim() aktiveerib exact_numeric_fact_v6 liiga laialt. 
2.	Autorinimede morfoloogiline „parandamine” on päriselt katki. Trace’ides on näiteks Maarja Krais-Leoski → Maarja Krai Leo, Liina Lokko → Lii Lokko ja Judit Strömpli → Judi Strömpel. See ei ole lihtsalt retrieval’i ebatäpsus, vaid juba plannerisse jõuab vale nimi. Koodis võib morphology esimese lemma võtta canonical-kujuks ning planner võib selle surface-nime asemele panna. 
3.	Paljud „retrieval failure” sildid pole tegelikult retrieval failure’id. J04 puhul leiti õige Perepesa artikkel, J07 puhul leiti täpselt nimepidi küsitud „Seltsilised...” artikkel, J08 puhul leiti hoolduskoormuse allikad. Vale otsus tuli pärast retrieval’i, identity selectoris. Seega ma parandaksin auditi first-divergent-layer klassifikatsiooni enne järgmise parandusringi tegemist. 
4.	Identity selector kasutab liiga palju müra. J04 puhul aitasid vale dokumenti kinnitada sõnad nagu millistes, linnades, ülesannet, neil. J08 puhul oli isegi neli document subject term. Need pole dokumendi identiteediankrud. Kood lubab sellistel subject-match’idel koos title/ranking heuristikaga kandidaadi high-confidence dokumendiks tõsta. 
5.	J07 on eriti tugev tõend arhitektuuriveast. Küsimus sisaldas täpset artikli pealkirja jutumärkides, õige artikkel oli retrievitud, kuid süsteem valis teise dokumendi. Täpne title hint peaks sellises küsimuses olema peaaegu hard identity anchor, mitte lihtsalt üks paljudest retrieval-signaalidest.
6.	V04 ei tõesta ainult generation-viga. Süsteem leidis 22/41/13 samast eakate vägivalla artiklist ja validator andis sellele PASS-i. See tõestab, et validator kontrollib praegu peamiselt „kas arvud on allikas olemas?”, mitte „kas need on just kasutaja küsitud kolm näitajat?”. Samas kontrolliksin enne fixi ka benchmarki: kui artiklis on mitu eri kolmeprotsendilist rühma, võib küsimus „mis olid kolm näitu?” ise olla liiga ebamäärane. 
7.	Vestlusajaloo probleem on samuti päris. V01 „MAPPA kohtumised – kui tihti ja mitu neid...” sisaldab lokaalselt täiesti selget antecedenti: neid = MAPPA kohtumisi. Seda ei tohiks tõlgendada eelmise pöörde viitena. J22 selles on samamoodi lokaalne viide e-kursuse järelhindamisele. V03 on aga vastupidine näide: see päriselt vajab eelnevat konteksti, kuid testis on J12 ja V03 vahel seitse pööret. See benchmark-case tuleks ümber kujundada. 
8.	K02 puhul ei võtaks validaatorit maha. Seal leidis süsteem õige Narva koduteenuse allika ja mudel genereeris toetamata kellaaegu/arve. Validator tegi õigesti, et need blokeeris. Halb on see, et kogu korrektne taotlemisvastus visati koos nendega minema. Lahendus on claim-level repair, mitte numeric validation’i täielik eemaldamine.



Ja siin teine analüüs:
Kui ma peaksin kogu analüüsi „mitte-Pro” lihtsuses nelja kõige olulisema paranduse peale kokku tõmbama, oleks järjekord:
1. Paranda validaatori aktiveerimine. Autorikokkuvõtte aastad ei tohi käivitada exact numeric validatorit.
2. Keela proper-name’ide destruktiivne lemmatiseerimine. Surface name jääb alles; registrist tuleb tegelik canonical author.
3. Paranda document identity. Täpne pealkiri, autor, akronüüm ja organisatsioon peavad kaaluma rohkem kui küsisõnad, asesõnad ja neli.
4. Tee requested-fact contract päriselt mitmeslotiliseks. „meetod + aeg + osalejate arv” peab olema kolm eri nõuet; „kolm näitu” vajab lisaks relation binding’ut.
Ehk lihtsama teise pilguga ei muudaks ma põhijäreldust. Pigem muutub see isegi selgemaks: praegu ei ole põhihäda RAG-i otsingumootoris. Suurimad vead tekivad küsimuse semantilises tõlgendamises, dokumendi valikus ja pärast vastuse genereerimist rakendatavas validaatoris.
ehk siis tihti on ka küsimus selles, kas küsimused on järjest või eraldi aknates?
Jah. Praeguse auditi järgi mõjutab see tulemust päris palju.
Kõige olulisem on eristada kahte eri testi:
•	eraldi aknas / värskes vestluses testid, kas küsimus töötab iseseisvalt;
•	järjest samas vestluses testid lisaks ka history/anaphora loogikat.
Sinu 34 küsimuse kordustestis saadeti J/V-ploki küsimused samas vestluses järjest. See tähendab, et mõni viga ei olnud puhas retrieval-viga, vaid eelnev kontekst mõjutas järgmist küsimust. Näiteks V01 „MAPPA kohtumised – kui tihti ja mitu neid...” sisaldab küll lokaalselt selget viidet MAPPA kohtumistele, kuid süsteem võis neid tõttu hakata kasutama ka varasemat vestluskonteksti. J22 puhul on sama probleem sõnaga selles. 
V03 on vastupidine näide. „Palju neid supervisioone maakonna kohta tehti?” ongi kontekstist sõltuv küsimus. Aga testis ei tulnud see kohe J12 supervisiooniküsimuse järel — nende vahel oli mitu muud pööret. Seega pole väga õiglane oodata, et süsteem seoks neid supervisioone seitse pööret tagasi J12-ga. 
Seetõttu teeksin benchmarki kaheks:
1.	Isolated 75 — iga küsimus täiesti uues vestluses. See mõõdab plannerit, retrieval’i, identity’t, generation’it ja attribution’it ilma history-mürata.
2.	Multi-turn suite — eraldi teadlikud paarid või jadad, näiteks:
o	J12 → kohe V03;
o	„Leia see artikkel” → „mitu neid oli?”;
o	üks teema → täiesti uus teema, et kontrollida history leakage’it.
Siis saad palju puhtama pildi. Kui küsimus FAIL-ib eraldi aknas, on viga küsimuse enda RAG-rajas. Kui eraldi aknas PASS, aga samas vestluses FAIL, on viga history/context handling’us.
Praegu on 34-case jooksus need kaks asja segamini, nii et osa „retrieval” või „context” vigadest on tegelikult vestlusajaloo vead.



