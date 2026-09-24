# Codex: M4 tõendiga seotud vastamismustandi piiratud katse

Versioon: 0.1 · 06.09.2026
Staatus: uus kohaliku arenduse katseettepanek. Ei ole tootmispaigalduse ega välismudelikutsete luba.

## 1. Lähtepunkt ja lõpetatud töö

Loe tegeliku tööpuu juhiseid, aktiivset `SotsiaalAI.md` S1.0 kirjet ja auditi
`docs/audits/rag-v2-m4-b-pilot-2026-09-06.md` viimast jaotist
„väljundileping v3 — nelja juhtumi päriskontroll”.

Auditi järgi paigaldati v3 commit'ilt
`0a7a5f9a0218872935df471da27615d710248cb7`. Neli vastust avaldati,
sealhulgas kaks varem peatunud küsimust osavastustena. Kõigi nelja
otsingupaketi sisu vastas v2 paketile. Keele, viitekuju ja taastamise
tehnilised kontrollid läbisid. Need on esitatud auditi tulemused, mitte
käesoleva ülesande koostaja uus serverikontroll.

Konkreetne tühja viitega faktiploki avaldamisviga on selle regressiooni
ulatuses lõpetatud. Ära ava sama parandust uuesti ega kirjuta ajalugu ümber.
`m4-text-refs-3` jääb töötavaks baaslepinguks; kogu M4 ja avaliku teenuse
sisulist kvaliteeti pole vastu võetud.

Kolm allesjäänud leiuliiki on:
1. viidatud eesmärgi esitamine juba toimunud sündmusena;
2. artiklikatkendite põhjal eraldi tõendamata õigusliku ulatuse järeldus;
3. tegeliku allikaväite paigutamine viitamata piiranguvälja.

Kõik need piirid on v3 promptis juba sõnastatud. Ülesanne ei ole lisada
sama keeldu neljandat korda, nõrgendada kontrolli ega sundida nelja vastust
`grounded`-iks.

Teise akna quality-gate'i pooleliolevad muudatused säilita. Need ei kuulu
automaatselt selle katse diffi, commit'i ega tulevasse paigaldusse.

## 2. Eesmärk ja uurimishüpotees

Valmista ette üks minimaalne, vaikimisi väljalülitatud katsekandidaat:
**sama vastamiskutse väljund seob iga allikaploki konkreetse, talle ette
antud algtekstilõiguga enne selle nähtavat parafraasi või sünteesi.**

Hüpotees: tõendiosa ja selle põhjal sõnastatud väite eksplitsiitne paar
võib vähendada allika mõtte või ulatuse laiendamist võrreldes praeguse
plokiteksti ja ainult dokumendiviite kombinatsiooniga.

See pole tõendatud parandus. Tsitaadi leidumine ei tõenda, et parafraas
sellest järeldub. Ühe mudeli valitud tsitaat ega enesehinnang pole sõltumatu
semantiline kontroll. Kandidaat peab olema eemaldatav, kui katse ei näita
sisulist kasu või halvendab kasulikkust, latentsust või avaldamist.

Töötab sama mudel, sama otsing, samad allikad ja üks genereeriv kutse
ühe vastuse kohta. Uut kriitikut, tõlkijat, agenti, kohalikku mudelit,
veebitööriista ega automaatset paranduskutset ei lisata.

## 3. Kolm täpset regressiooninäidet olemasolevatest artefaktidest

Loe lubatud lokaalsest `tmp/rag-v2-m4-v3-real/` artefaktikogumist vastavad
muutmata väljundid, saatmiseelsed paketid ja sisulised hinnangud. Kontrolli
nende räsiseoseid; ära võta auditi lühikirjeldust täpse mudeliteksti asemele.

Koosta iga leiuliigi kohta väike testkirje:
- tegelik nähtav lause või plokk ja selle väljundiosa;
- selle tegelikud viited ning nendega seotud allikatekst;
- milline väite osa on toetatud ja milline osa ületab tõendit;
- üks lubatud, sisuliselt kitsam näide ja üks lähedane lubamatu näide;
- otsuse päritolu ning allesjääv ebakindlus.

Õigusliku ulatuse hinnang ei pea tõendama, et algne väide on päriselus
vale. Küsimus on selles, mida selle piloodi allikad vajalikus ulatuses
tõendavad. Artikli puudumist õigusallikate seast ei tohi muuta üldiseks
järelduseks, et ükski artikkel ei võiks õigusnormi refereerida.

Varem avaldatud nelja vastust, v3 skeemi ja M2/M2.3 kinnitusi ei muudeta.
Kolme näite dokumenteerimine ei ava kogu 84 rea rubriiki uuesti.

Kui originaalartefakti kasutusluba on aegunud või fail puudub, märgi see.
Ära pikenda säilitusaega ega taasta erasisu varukoopiast omal algatusel.
Sel juhul tee tehniline prototüüp märgistatud sünteetiliste näidetega ja
jäta vastav pärisregressioon `not_run`-iks. Ära asenda tõendit oletusega.

## 4. Minimaalne katseadapter

Säilita kasutajaliidese ja püsistatud avaliku vastuse v3 kuju:
`kind`, `blocks`, `limitations`, `clarification`.

Katsekandidaadil võib olla eraldi, versioonitud privaatne mudeliväljundi
ümbris või plokipõhine tõendiosa. Konkreetse kodeeringu vali olemasoleva
koodi järgi, välditava dubleerimiseta. See pole vana väljundi vaikne
parandamine ega üldine neljanda kasutajaliidese lepingu migratsioon.

Iga allikaploki tõendiosa sisaldab vähemalt:
- sama pöörde lubatud viite-ID;
- selle viite etteantud algtekstist pärineva täpse väljavõtte;
- nähtava väite, mis peab jääma valitud tõendi tähenduse ja ulatuse sisse.

Mitme allika süntees võib vajada mitut tõendiosa. Üks plokk peab sisaldama
koos kontrollitavat mõttekogumit, mitte suurt lõiku, mille iga lause vajab
ise alust. Ära sunni iga lauset eraldi plokiks ega kärbi vajalikku tingimust,
erandit, vastutajat, aega või eitust lihtsalt lühiduse pärast.

Tõendiosa on kontrollitav andmeväljund, mitte varjatud arutluskäigu,
sisemonoloogi või sammhaaval mõtlemise väljastamise nõue.

### Serveri kontroll

Kontrolli enne kandidaadi projitseerimist nähtavaks v3-vastuseks:
1. viide kuulub selle päringu lubatud paketile ja lahendub kanooniliselt;
2. väljavõte esineb selle viite täpses algtekstis; ära otsi seda kogu korpusest;
3. viide, dokument, versioon, tekstiräsi ja tõendiosa on seotud sama
   päringu ning kasutusõigusega;
4. lõppploki viited vastavad tema tõendiosadele ja läbivad ka olemasoleva
   v3 kontrolli;
5. kogu uus väljund on mahu ja pikkuse poolest piiratud.

Kui võrreldakse normaliseeritud tühimärkidega, dokumenteeri lubatud
teisendus ja säilita side muutmata tekstiga. Sõnu, eitust, ajavormi ja
modaalsust ei tohi vastavuse saamiseks muuta. Mitmetähenduslik allikakoht
ei tohi saada väljamõeldud täpset asukohta.

Puuduvat või valet väljavõtet/viidet ei parandata automaatselt. Viga jääb
jälgitavaks, mustand kaitstuks ja kulukirje muutmata. Eraandmeid ei lisata
avalikku DOM-i ega logidesse. Kandidaadi andmed alluvad olemasolevale
õiguste-, aegumis-, kustutamis- ja mahulepingule.

**Need kontrollid tõendavad allika seost, mitte parafraasi semantilist
õigsust.** Väljundit ei märgistata nende põhjal sisuliselt verifitseerituks.

## 5. Piirangud ei ole viitamata faktide koht

Jäta v3 piirangu ja täpsustuse eristus alles. Mudel peab valima:
- küsitud vastust toetav allikaväide läheb tõendiga seotud allikaplokki;
- vastaja puudulik tõendus jääb kasutatud väljavõtetega piiritletud
  selgituseks;
- küsimusega mitteseotud kõrvalväidet pole vaja vastusele lisada.

Pelgalt klausli paigutamine `limitations` välja ei kinnita selle õigsust.
Ka tõene ja paketis leiduv kõrvalväide võib olla vales väljundiosas.
Ära lisa kõigile piirangutele suvalisi viiteid ega kasuta regex'i
üldise tähendusliku tõefiltrina. Säilita võimalus vajaduse korral anda
viiteta puhas täpsustusküsimus.

Kandidaadi juhis peab kirjeldama just uut tõendiosa kasutust, mitte
kasvatama lõputult olemasolevat keeluloendit. Küsimuste nimed, oodatud
vastused, viitenumbrid ja lehed ei tohi muutuda käitusaegseteks eranditeks.
Ära lisa hindamisrubriiki ega inimhinnanguid mudeli sisendisse.

## 6. Kohalik vastuvõtt

Kasuta olemasolevat testitaristut, testtransporti ning v3 allika- ja
brauserirada. Lisa ainult uue mehhanismi kontrollid.

Vajalikud näited:
- tegelik täpne väljavõte ja kehtivad sama pöörde viited;
- võltsitud väljavõte, vale viide, õige tekst valest allikast või versioonist;
- väljavõte, millest on jäetud välja tähendust muutev eitus/tingimus;
- mitu tõendiosa ühe põhjendatud sünteesi juures;
- kasulik osavastus, puhas täpsustus ja põhjendatud `unsupported`;
- tühi või üle mahupiiri väljund ning püsistuse tõrge;
- õiguste tühistamine, aegumine, veapöörde taastamine ja idempotentsus;
- v3 ning ajalooliste v1/v2 vastuste muutumatu lugemine.

Eraldi oluline negatiivne näide: väljavõte ütleb „eesmärk on”, väide
ütleb „toimus”. Mõlemal võib olla korrektne allikaviide ning tsitaat.
Kui tehniline kontroll selle läbi laseb, nimeta tulemus täpselt:
`source_binding=pass`, `semantic_support=fail` sisulise näidisotsuse järgi.
Ära kirjuta semantilist testi roheliseks pelgalt räside vastavuse tõttu.
Samamoodi tuleb eristada päris tsitaati ja sellest põhjendamatult tehtud
õigusjäreldust ning piiranguvälja paigutatud allikafakti.

Käsitsi parandatud näidis ei ole mudeli uus tulemus. Märgista näidiste
päritolu ja ära salvesta neid vana pöörde vastusena.

Fikseeri kaitstud auditis kandidaadi privaatne väljund, projektsioon,
versioonid ning tegelikult mudelile saadetav keha. Hoia täiendava tõendiosa
maht nähtavana; vaikset väljundtokenite lae tõstmist ei tehta.

## 7. Päriskatse plaan, mitte automaatne uus jooks

Kohalik teostus peab lõppema ühe arvuliselt piiritletud katseplaaniga.
Võrdle muutmata v3 baasvarianti ja üht kandidaati samade lubatud
otsingupakettidega. Katse kahe variandi võrdlus ei muuda tavakasutuse
ühe vastuse genereerimiskutse eesmärki.

Senised veaküsimused on arendusregressioon. Lisa väike, enne tulemuste
vaatamist fikseeritud erinevate juhtumite kontrollosa samade vealiikide
ning piisava toega tavalise vastuse kohta. Tuntud küsimuse parafraasi ei
nimetata puutumatuks üldistuskatseks. Tõlked ei ole sõltumatud perekonnad.
Kasuta võimalikult võrreldavat keelte ja sisuliste nõuete jaotust.

Näita plaanis eraldi:
- baasvariandi ja kandidaadi katsete arv ning mis läheb välisele teenusele;
- allikapakettide identiteet või põhjus, miks pakett tuleb uuesti leida;
- küsimusevektorite lubatud taaskasutus, mitte automaatne nullkulu eeldus;
- lisanduvad sisend- ja väljundtokenid, kõigi katsete kogulagi;
- tõesuse/ulatuse vead, määravad väljajätted, kasulik osavastus,
  põhjendamatud keeldumised, avaldamine, keel, viited, viivitus ja kulu;
- kes annab sisulise hinnangu ning mis osa on lahendamata.

Uusi päriskutseid, kvooti ega tähtaega ei anna see dokument. Seniseid
ledgereid ei lähtestata, vanu õigusi ei pikendata. Ära käivita kordusi
kuni soovitud vastuse saamiseni. Väike valim annab juhtumipõhise tõendi,
mitte üldist töökindlusprotsenti.

## 8. Lõpptulemus ja peatumiskoht

Esita ühe töövooru järel:
1. kolme tegeliku vealiigi kitsas tõendivõrdlus või nimetatud tõendilünk;
2. vaikimisi väljas kohalik katseadapter ja selle minimaalne diff;
3. tegelikud `pass/fail/skip` tulemused ning üks allikavaateni taastatav
   testnäide; semantilisi otsuseid ei nimetata tehnilisteks testideks;
4. mudelile saadetava kandidaatskeemi ja täiendava tokenimahu näide;
5. üks arvuliselt piiritletud, veel käivitamata võrdlusplaan.

Push'i, deploy'd, avaliku vastamise avamist ega uut massindekseerimist
selles töövoorus ei tehta. Otsing, korpus, mudel ja v3 põhirada säilivad.

Kui kohalik teostus osutub ebaproportsionaalseks, kuva konkreetne kulu ja
lihtsam alternatiiv; ära ehita uut teenust või raamistikku selle ületamiseks.
Kui hilisem päriskatse ei anna sisulist eelist, jääb v3 baasvariant alles
ja kandidaati ei viida automaatselt tootmisse.

Jätkuvestluse teostus on järgmine eraldi arendussuund. M3 tingimuste ja
erandite sõltuvusgraaf ning M5 ajaline süntees jäävad teekaardile; käesolev
väite–tõendi paar ei ole nende valmimine ega tõend oma leiutise uudsusest.
