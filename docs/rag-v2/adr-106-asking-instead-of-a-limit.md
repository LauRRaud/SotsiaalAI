# ADR-106: assistent küsib, mitte ei ütle „ei saa öelda“; mure läheb otsingusse

Kuupäev: 08.10.2026. Seis: juhised ja kood tehtud, ühiktestid läbi, serveris kohalugeja läbimäng mudelit kutsumata. **Mudeliga mõõtmata**: kas vastused päriselt muutuvad, näitab alles jooks mudeliga, mis ootab omaniku sõna.

## Probleem

Kahes 30 pöördega testvestluses ([ADR-105](adr-105-topic-holds-a-case.md)) oli 60 vastusest 34-s piirang „ma ei saa … öelda“. Omanik: „tihti assistent ütles ‚ma ei saa nende andmete põhjal öelda…‘ – kas tal siis on rohkem andmeid kasutajalt vaja või ta pigem siis suunab vestlust valele rajale, kui ei oska küsida kasutaja käest õigeid küsimusi.“

Pöörete kirjetest loetud põhjused (testis leitud vead 1, 2, 3, 5 ja 6):

1. **Küsimus jäi küsimata.** Kahes vastuses oli piiranguks kirjutatud asjaolu, mida kasutaja teab („ei saa öelda, kas pojale on puue ametlikult määratud“; „sõltub ema abikaasa olemasolust“). Esimesel juhul oli vestluse mälus sama asi lahtise küsimusena kirjas, aga vastus seda ei küsinud.
2. **Sama küsimus sõna-sõnalt uuesti.** Neljas vastuses kordas assistent küsimust, millele kasutaja ei olnud vastanud; kolm vastust järjest lõppesid lausega „Kas mees on praegu vahetus ohus või vajab kohe abi?“.
3. **Küsiti või kaheldi selles, mis oli öeldud.** Kasutaja kirjutas „kõike, mis tema kohta kirja on pandud“ ja vastus küsis, kas vanem tahab enda või lapse andmeid. Üldisele küsimusele („Mida vald eestkostjana tegema peab?“) lisati piirang, et ei ole teada, kas vald on eestkostjaks määratud.
4. **Mure ilma küsimuseta ei jõudnud otsingusse.** Sõnumile „Mul on veel üks mure, hoopis teine. Mu ema sai eelmisel nädalal insuldi ja on haiglas.“ ei kirjutanud otsinguplaan ühtegi päringut, sest sõnum ei küsi midagi (reegel: „kirjuta päringud ainult selle kohta, mida praegune sõnum küsib“). Ilma päringuteta otsitakse kogu teema teksti järgi: 36 kandidaadist 26 olid varasema teema (laps) kohta ja üks insuldi kohta, kuigi korpuses on insuldijärgse elu kohta 27 lehte. Vastus sai ühe lõigu.
5. **Asula vald.** Kolm vastust järjest algasid lausega, et Jüri kuulub Rae valda. Kui jutt oli läinud ema omavalitsusele ja kasutaja küsis, kumb vald aitab, kui ema koliks Jürisse, vastas assistent, et Jüri asukohta siinne teave ei kinnita. Server teadis (asula oli lubatud vestluse mälu tsitaadi järgi), aga andis asula mudelile ainult selle pöörde ulatusega, kus asulat nimetati (`named_place`, ADR-103).

## Otsus

**Vestluse juhised, versioon 34** (`m4-grounded-dialogue-34`), kaks lisa:

- `ASKING_INSTRUCTIONS`, vestluse laienduse lõpus. Mida vastus lahendada ei saa, on kahte liiki. Asjaolu, mida kasutaja teab ja saab paari sõnaga öelda, küsitakse (`clarification`) ega kirjutata piiranguks. Piirang on selle jaoks, mida ka kasutaja lahendada ei saa: spetsialisti, asutuse või kohtu hinnang ja otsus või siin puuduv allikas. Vastamata jäänud küsimust ei korrata sõna-sõnalt: vastatakse sellele, mida praegune sõnum küsib, ja küsitakse uuesti ainult siis, kui vastust ei saa ilma selleta anda. Seda, mis kasutaja sõnumis on öeldud, ei küsita ega nimetata teadmata olevaks. Üldist küsimust vastatakse üldiselt, ilma piiranguta kasutaja enda juhtumi kohta.
- `KNOWN_PLACES_INSTRUCTIONS`, omavalitsuse kirjete juhiste lõpus. `records.scope.known_places` loetleb vestluses nimetatud asulad koos omavalitsusega. See on geograafia, mitte kellegi elukoht; kasutada siis, kui küsimus sõltub sellest, kus asula asub. Seda, mis valda asula kuulub, öeldakse ainult pöördes, kus ulatusel on `named_place`, või kui küsimus sellest sõltub.

Alusreegel jääb samaks: korraga kuni kaks lühikest vajalikku küsimust (`m4-grounded-answer-12`, „CLARIFYING“).

**Server:** `namedPlace` (`lib/rag-v2/pilot/settlements.js`) paneb pöörde ulatusele kaasa ka teised samal pöördel lubatud asulad, millel on üks omavalitsus (`known_places: [{ name, municipality }]`).

**Otsinguplaan ja lõikude valik, versioon 10** (`rag-v2/search-assist-10`), kummaski üks rida:

- `PLAN_WORRY_INSTRUCTIONS` (plaani viimane rida): sõnum, mis räägib murest, sündmusest või muutunud olukorrast midagi küsimata, on küsimus selle kohta, mis abi selles olukorras on; selle kohta kirjutatakse päringud. Tühi loend on ainult sõnumile, mis ei küsi ega räägi olukorrast (tervitus, tänu).
- `RERANK_WORRY_INSTRUCTIONS` (valiku reegli järel varasemate sõnumite kohta): sellise sõnumi puhul jäetakse alles lõigud, mis ütlevad, mida saab teha, kes aitab ja mis järjekorras.

Reeglid on üldised: üheski ei ole testvestluste inimest, kohta, haigust ega teenust (test kontrollib).

## Mida see maksab

Vestluse juhised kasvavad umbes 230 tokeni võrra igas pöördes ja veel 100 võrra pöördes, kus on omavalitsuse kirjed; plaan 91 ja valik 47 tokenit. Juhised on puhverdatud sisend, seega umbes 0,00005 USD pöörde kohta.

## Kontrollitud

- Ühiktestid: 810, neist 788 läbi ja 22 vahele jäetud. Uus test loeb reeglite sõnastust, nende kohta juhistes ja seda, et varasemate versioonide tekst on sama (plaani ja valiku tekst ilma lisatud ridadeta annab search-assist-5 räsi).
- Serveris, tasuta: mõlemad testvestlused mängiti ühe teemana läbi nii, et kõik vestluse moodulid olid muudetud koodist (piir 30). Kohalugeja andis mõlemas 30 pöördes 30-s sama omavalitsuse mis päris jooksus. Alates 5. sõnumist on ulatusel `known_places: Jüri alevik → rae_vald`, 28. sõnumi juures (küsimus Jürisse kolimisest, ulatus Saaremaa vald) nii Jüri kui Kuressaare.

See läbimäng asendab ka ADR-105 serverikontrolli: seal olid muudetud koodist ainult muudetud failid ja neid importivad failid tulid väljalaskest; tulemus oli sama.

## Kontrollimata

Kõik, mis sõltub mudelist: kas assistent nüüd küsib, kas ta ei korda küsimust, kas insuldi sõnum saab päringud ja õiged lõigud, kas Jüri valda öeldakse ühe korra. Selleks on vaja mudeliga jooksu; kahe stsenaariumi kordus maksab umbes 0,32 USD ja ootab omaniku sõna.

## Mis jääb lahti

- Roll ei jõua mudelini (testi viga 4): spetsialistile vastatakse nagu abivajajale ja valla, kus ta töötab, korda ei kasutata. See on eraldi muudatus.
- Kui plaan ei kirjuta päringuid sõnumile, millel neid ei peagi olema (tänu, paljas parandus), otsitakse endiselt kogu teema teksti järgi; 30-sõnumilises teemas on see pikk tekst.
- PDF-juhendite veebiaadressid ja üks saatmata jäänud sõnum (testi vead 7 ja 8).
