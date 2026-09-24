# M4-C: piiratud jätkuvestlus olemasoleva v3 baasraja peale

Versioon: 0.1 · 07.09.2026
Staatus: järgmise arendusploki ülesanne; ei ole käivitatud test ega avaliku kasutuse heakskiit.
Aktiivse töö omanik jääb repositooriumi `docs/platvormi arendus/SotsiaalAI.md` S1.0. Tähis M4-C nimetab selles ülesandes M4 jätkuvestluse plokki, mitte uut põhietappi M0–M6 kaardil.

## 1. Lähtekoht ja lõpetatud katse

Loe esmalt uusimat kohalikku S1.0 kirjet ja `docs/audits/rag-v2-evidence-draft-local-2026-09-07.md` lõppjäreldust. Kontrolli tegelikku tööpuud; ära asenda omaniku kohalikku tööd automaatselt GitHubi versiooniga.

07.09 auditi järgi tehti samadel fikseeritud pakettidel 7 v3 baas- ja 7 kandidaadikutset. Baas avaldas 7/7, kandidaat 0/7. Kõik kandidaadi vead olid `evidence_excerpt_not_found`. 22 tsitaadist 19 sobisid ainult diagnostilise tühimärkide ühtlustamise järel, kolm ei sobinud ka siis. Diagnostika ei muutnud käitusreeglit. Kandidaat ei lähe kasutusse; v3 baas on taastatud. Avaldamine ei ole sisulise õigsuse hinnang.

**Ära alusta selles plokis tsitaadikandidaadi parandusringi.** Ära lisa hägust sobitamist, automaatset tsitaadiparandust ega uut `evidenceDraftVersion` varianti. Katse kood ja tõendid võivad säilida väljalülitatud eksperimendina. Selle teostuse kasutuselevõtuotsus on negatiivne, semantilise paremuse hinnang tõendamata.

Omaniku tähtajamuudatus on uus lähteotsus: aruande järgi toetatakse eksplitsiitselt `expiresAt=null` ja `retentionHours=null`. Ära taasta vanu tähtaegu ega pikenda neid näiliselt uue nimega. Tähtajatus ei eemalda konto, organisatsiooni, vestluse, allika, tühistamise, arhiivi, kustutamise ega kasutuspiiride kontrolle. Puuduv konfiguratsioon ei tohi muutuda automaatselt tähtajatuks loaks. Nende testide ajaline alus peab vastama uuele lepingule, mitte vanale 07.09 kell 08.00 piirile.

## 2. Selle ploki eesmärk

Loo olemasolevas kaitstud vestluses vähemalt nelja kasutajapöörde pikkune kontrollitav jätk: sama teema säilib, kasutaja saab asjaolu parandada, uus inimene ei päri eelmise inimese andmeid ning teemavahetus ei saasta uut otsingut.

Tulemus peab kasutama tavalist uut otsingut, mitte ettevalitud vastusepakette. Programmi ülesanne on konteksti päritolu, ulatuse, õiguste ja versiooni haldamine. Vabateksti sisuline tõlgendamine jääb senisele vastajale; universaalset semantilist kontrolli ei väideta.

See on tehniline sisepiloot, mitte luba pärisklientide tundlikke juhtumikirjeldusi koguda või avalik vastamine avada. Esimesed testid kasutavad väljamõeldud olukordi ja olemasolevat lubatud korpust.

## 3. Konkreetne olemasolev piir, millest alustada

Ülesande koostamisel loetud commit'il `5b9d0a233`:

- `pilot/store.js` valib eelmiseks viimase `completed` pöörde ning salvestab sellest ainult `payload.question` väärtuse.
- `pilot/contracts.js` funktsioon `buildQuestion()` lisab selle ühe küsimuse uue ette ainult `contextMode=same` korral.
- `new`, `new_person` ja `correction` kasutavad praegu ainult uut küsimust. See on turvaliselt piiratud algversioon, mitte üldine parandusi säilitav vestlusmälu.
- `pilot/service.js` kasutab koostatud `query.text` väärtust embedding'u, otsingu ja vastamise jaoks. Fikseeritud paketi eksperiment võib otsingu täiesti vahele jätta; seda ei tohi kasutada jätkuvestluse leidmisvõime tõendina.

Kontrolli neid teid praeguses koodis enne muutmist. Ühte varasemat küsimust lisav teostus võib kaotada esimese pöörde olulise asjaolu juba kolmandas või neljandas pöördes. Vastuse ebaõnnestumine ei tohi põhjustada ka tagasihüpet eelmise inimese või teema juurde.

## 4. Hoia muutumatu baas ja väike ulatus

Säilita v3 avaliku vastuse leping, kanoonilised viited, indeksid, korpus, mudel ja otsinguprofiil. Ära muuda sama töö käigus RRF-i, dokumendikvoote, tükeldamist, naabrilisa ega M2 hindamisrubriiki.

Dialoogisisendi uus esitus vajab oma versiooni ning selle kasutamiseks vajalik promptimuutus samuti jälgitavat versiooni. See ei ole luba hakata samaaegselt ühe pöörde semantilisi vastuseid häälestama. V3 ajaloolised vastused jäävad algversiooniga loetavaks.

Ära lisa eraldi mälu-, planeerimis-, tõlke- ega hindamisagenti. Eduka uue pöörde lähtepiir on kuni üks uus küsimuseembedding ja üks genereeriv vastamiskutse. Vahemälutaba võib embedding'u ära jätta; automaatset kordust või varumudelit ei lisata.

## 5. Minimaalne kontekstileping

### 5.1. Päritolu ja valik

Vestlusandmed tulevad serverist sama autentitud kasutaja lubatud vestlusest. Kliendi saadetud suvaline `history`, roll või isikutunnus ei anna õigusi.

Erista kontekstis vähemalt:

1. kasutaja enda varasemad sõnumid ja parandused koos pöördetunnustega;
2. avaldatud assistenditekst, mida kasutatakse ainult vestlusviite mõistmiseks;
3. vastamiseks kasutatavad kanoonilised allikaväljavõtted.

Assistendi varasem väide ei muutu kasutaja kinnitatud asjaoluks ega uue vastuse allikaks. Veamustandit ja avaldamata teksti ei lisata vestlusmällu. Allikast või dialoogist pärit käsk jääb andmeks, mitte süsteemijuhiseks.

Esimene teostus võib kasutada lühikest aktiivse teema ja isiku sõnumiakent; pikaajalist isikuprofiili ega automaatseid kokkuvõtteid ei ehitata. Akna ja tokenimahu piir määratakse eksplitsiitselt ning peab toetama vähemalt nelja pöörde testi. Eelarve täitumine peab olema nähtav: ei kärbita vaikselt määravat parandust ega õige isiku tunnust. Testida tuleb ka piiri ületavat jätku.

### 5.2. Parandused, inimesed ja teemad

Kasuta esmalt olemasolevaid `same/new/new_person/correction` režiime, kuid erista režiimi valikut vabateksti automaatsest mõistmisest. Katsetaja peab teadma, millise teema või inimese kontekst on aktiivne. Nupuga tehtud isikuvahetust ei nimetata automaatse keelemõistmise võimeks.

Parandus peab säilitama muutumata asjakohased asjaolud; kogu senise konteksti kustutamine pole paranduse üldlahendus. Vanal ja parandatud teabel peab olema eristatav päritolu. Esimeses versioonis pole vaja vabatekstist kõiki faktivälju välja eraldada: lubatud on lähtesõnumid koos selge parandusseosega. Ainult tõendatud või kasutaja selgelt valitud väärtust tohib kasutada range piirkonna- või muu filtrina; vastuolulist vana väärtust ei tohi vaikimisi filtriks võtta.

Uus inimene avab uue kontekstiulatuse. Eelmise inimese vanus, vald, tervis, pereolukord ja muud asjaolud ei kandu sinna. Teemavahetus ja vajaduse korral selgesõnaline naasmine seotakse õige ulatusega. Ebaselge viite korral on lubatud vajalik täpsustusküsimus, mitte vaikne oletus.

Vastu võetud kasutajapöörde teema-/isikumuutus peab säilima ka siis, kui sellele järgnev mudelikatse peatub. Ära vali uue pöörde jaoks lihtsalt viimast õnnestunud vastust, kui vahepeal võeti vastu kasutaja parandus või isikuvahetus. Idempotentsus peab hoidma nii kontekstiuuenduse kui mudelikatse ühekordsena.

### 5.3. Viide assistendi eelmisele vastusele

Toeta lühikeses aktiivses ulatuses jätku nagu „selgita teist punkti”. Selle mõistmiseks võib kasutada serveris salvestatud avaldatud vastust, selgelt märgistatuna dialoogina, mitte faktiallikana.

Uue vastuse faktitoe jaoks tehakse uus otsing või laaditakse uuesti lubatud kanoonilised allikakohad kehtiva eelarve sees. Varasema pöörde `S1` ei tähenda uue pöörde `S1`. Pöörete viitekaarte ei liideta tähise järgi. Muutunud õiguse, dokumendiversiooni või puuduliku toe korral säilib piirang; vanas vastuses leiduv kindel kõneviis ei ole piisav alus selle kordamiseks.

### 5.4. Otsing ja audit

Erista vajaduse korral otsinguks koostatav tekst vastajale antavast dialoogiesitusest; ära saada embedding'usse kogu assistendi teksti automaatselt. Koostamisreegel jääb deterministlikuks ja versioonituks. Uut päringut kirjutavat mudelikihti ei lisata.

Päringu vahemälu identiteet peab arvestama tegelikku koostatud otsinguteksti ning kehtivat mudeli- ja õiguste ulatust. Sama lühike lause „aga hind?” teise inimese või teema kohta ei õigusta sama vektori ega vastuse vaikset taaskasutust. Varasema ühe-pöörde küsimusevektori sobivust ei otsustata ainult uue sõnumi võrdsuse järgi.

Salvesta enne väliskutset juba olemasolevasse kaitstud auditisse valitud ja välja jäetud pöörete tunnused/põhjused, aktiivne kontekstiulatus, parandusversioon, tegelik otsingutekst, dialoogisisend, allikapakett ning keel. Kasutajaandmeid ei kanta avalikku logisse. Säilitus järgib omaniku kehtivat poliitikat, sh lubatud tähtajatu piloot; sisu kustutamine peab hõlmama ka lisandunud dialoogiesitusi.

## 6. Neli lühikest katsevestlust

Fikseeri täpsed laused ja vajalikud mõtted enne pärisjooksu. Allolev on kattekaart, mitte etteantud õige vastus.

| Vestlus | Katse põhisisu | Mida peab jälg näitama? |
|---|---|---|
| A — sama teema | Vähemalt neli pööret; esimeses vajalik asjaolu, hiljem kaudne jätk ja „teine punkt”. | Esimene vajalik asjaolu ei kao; assistendivastus aitab viidet mõista, kuid ei asenda tõendit. |
| B — parandus | Kasutaja muudab üht varem öeldud asjaolu, jättes teise asjakohase asjaolu samaks. | Uus väärtus ei lähe vana filtriga vastuollu; muutumata info säilib; paranduse päritolu on nähtav. |
| C — teine inimene | Esimese inimese kirjeldus, selgesõnaline uus inimene ja lühike jätk. Ühes kohalikus variandis peatub vahepealne vastus. | Andmeid ei kanta üle; järgmine pöördumine ei hüppa viimase õnnestunud vana inimese vastuse juurde. |
| D — teema, taastamine ja viited | Teemavahetus, refresh/allikavaatelt naasmine ning selgelt suunatud jätk; varasema allika õiguse muutmise test. | Õige ulatus taastub; vana viitenumber ei osuta uuele tekstile; õiguse tühistamine jõustub. |

Jaota päriskeeleproov ET/EN/RU vahel; kõiki vestlusi ei pea kolm korda tõlkima. Kohalikud lepingutestid katavad keele kõikides režiimides. Väljamõeldud vald või hind on kasutaja testolukord, mitte lisatav ametlik allikas. Kui korpus ei sisalda kohaliku hinna tõendit, peab see jääma teadmata ka pärast seda, kui kasutaja on valla nimetanud.

Loo lisaks sünteetiline regressioon, kus varasemas assistenditekstis on tõendamata garantii. Jätkuvastus ei tohi sellele toetudes uut faktiväidet kinnitada. Märgi see testandmeks; ära muuda ajaloolist pärisvastust.

## 7. Olemasolev allikatoe puudujääk jääb eraldi nähtavaks

Kasuta olemasolevaid 7 baasvastust ja nende pakette, et lõpetada nende lühike sisuline hinnang seniste mõõtmete järgi. Ära loo uut 84-realise rubriigi kinnitusringi, uut mudelihindajat ega uusi baasvastuseid.

Registreeri eesmärgi/toimumise, õigusliku ulatuse, garantii ja piiranguvälja kõrvalväite juhtumid tegeliku teksti ning allikaga. Kui mõni neist on juba hinnatud, viita olemasolevale otsusele. Märgi päriskatse parandatud või endiselt avatud leid, mitte üksnes vastuse avaldamisolek.

See töö ei pea peatama jätkuvestluse kohaliku teostuse ehitamist. See ei luba olemasolevaid sisulisi puudusi avaliku kasutuse vastuvõtust välja arvata. Uue ploki hinnang eristab konteksti valikut, otsingu katvust, vastamise allikatäpsust, kasutaja parandust ja isikute segamist.

## 8. Vastuvõtt, kulu ja töö lõpp

Kohalik teostus peab läbima tegeliku andmebaasi/HTTP raja, õiguste, kontekstipiiride, taastamise ning paralleelse kordusvõtme kontrollid. Testtranspordi vastuseid ei nimetata päris Luna kvaliteeditõendiks. Olemasolev ühe-pöörde baasrežiim peab jääma regressioonis toimivaks.

Pärisjätkuvestluse katse kasutab uut otsingut. Selle plaani puhul ei ole 0 uut embedding'ut kohustuslik: uus kontekst võib vajada uut vektorit. Kuni üks uus embedding ja üks vastamiskutse pöörde kohta; kasutus, tekstid ja katsete ülempiir vormistatakse ühes koondplaanis. Null uut otsingut kasutav fikseeritud pakettide jooks ei tõenda jätkuvestluse päringukoostamist ega leidmisvõimet.

Ära kasuta täis 7+7 ledgereid uue töö kvoodina. Omaniku tähtajatu piloot jääb tähtajatuks, kuid see ei ole piiramatu katsete luba ega automaatne luba uue sisutüübi väljasaatmiseks. Kontrolli kehtivat projekti töövolitust, mitte ära küsi iga üksikpöörde kinnitust. Selle dokumendi olemasolu üksi ei anna uut push'i, deploy ega väliskutsete luba. Kohalik tehniline töö ja koondplaani ettevalmistus võivad jätkuda.

Esita lõpuks:

- muudetud failid, lähte-/lõppseis ja eristus teise akna omaniku muudatustest;
- tegelik PASS/FAIL/SKIP koos käivitatud käskude ja brauserinäitega;
- neli dialoogijälge, kus on näha konteksti päritolu, parandus, isikupiir, otsinguallikad ja taastamine;
- teadaolevad ühe-pöörde sisupiirid ning uued kontekstiprobleemid eraldi;
- üks pärisjätkuvestluse koondplaan või viide juba kehtivale sobivale loale.

**Lõppeesmärk selles plokis: toimiv lühike jätkuvestlus, mitte uus tsitaadi- või RAG-arhitektuur.** M3 tingimuste/erandite sõltuvused, M5 ajalised ülevaated ja M6 tootestamine jäävad järgneva teekaardi osaks.

## Allikabaas ja selle piir

- `docs/audits/rag-v2-evidence-draft-local-2026-09-07.md`: kohalik teostus, omaniku tähtajamuudatus ja 7+7 pärisvõrdluse lõppotsus. Siinse ülesande autor luges üleslaaditud aruannet, mitte privaatset 14 vastuse tulemuste JSON-i.
- Repositoorium `LauRRaud/SotsiaalAI`, aruandes nimetatud ref `5b9d0a233`: loetud `lib/rag-v2/pilot/contracts.js` algus, `service.js` read 1–135 ja `store.js` read 1–130. Need toetavad ühe eelmise kasutajaküsimuse piiri kirjeldust; see polnud täielik koodi- ega serveriaudit.
- Uus kontekstileping, nelja vestluse kattekaart ja vastuvõtunõuded on käesoleva ülesande arendusettepanekud, mitte kirjeldus juba valmis funktsioonidest.
