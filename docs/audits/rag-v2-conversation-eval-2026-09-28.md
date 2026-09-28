# Terviklike vestluste hindamine, 28.09.2026

Teostus Claude Opus 5.5 omaniku ülesandel. Codexi kava samm 1: kontrollida terviklikke vestlusi olemasoleva korpusega.

## Mida mõõdeti

- **Kataloog:** [`tests/evaluation/dialogue/scenarios-corpus-1.json`](../../tests/evaluation/dialogue/scenarios-corpus-1.json), 16 vestlust ja 40 pööret, kirjutatud enne käivitamist.
  - 6 vestlust on `scenarios-1.json`-ist muutmata.
  - 10 uut käsitlevad jätkuküsimust, parandust, omavalitsuse vahetust, eri kuupäevade õigust, puuduvat asjaolu, uut isikut ja 27.09 vastuvõtutesti nõrku kohti.
- **Käivitus:** `scripts/rag-v2-conversation-eval.mjs` kasutab päris vestlusteenust (otsing, mudel ja kontrollid nagu tootmises).
  - Plaan `…-1048-r15c5ddd34`, korpus v33, mudel `gpt-6-luna` (`medium`).
  - Iga stsenaarium on omaniku kontol eraldi vestlus „Hindamine …“.
  - Aeg 28.09 11:11–11:22 UTC, hinnanguline kulu 0,19 USD.
- **Iga pöörde kontrollid** on masinloetavad ja jagunevad kolmeks:
  - `search`: õige allikas jõudis tõendisse;
  - `answer`: viidatud allikas, kohustuslik või keelatud tekst, täpsustus ja kuupäeval kehtiv tekst;
  - `state`: omavalitsus, kataloogi teenus, kontakt, kriis ja uue isiku puhas algus.
- Kõik pöörded koos vastuste, allikate ja kontrollidega on [käivitusaruandes](rag-v2-conversation-eval-2026-09-28-run1.md).

## Toortulemus (automaatne, muutmata)

| Tulemus | Pöördeid |
|---|---:|
| passed | **31** |
| search | 1 |
| answer | 6 |
| state | 2 |

## Käsitsi ümberhinnang (eraldi, põhjendustega)

Codexi ülevaatuse järgi jääb toortulemus 31/40 kehtima. Ümberhinnang on eraldi hinnang: kontroll oli kataloogis liiga kitsas, aga vastus ise õige.

| Pööre | Automaatne | Vastus | Hinnang |
|---|---|---|---|
| `mother-kose-corrected-harku` 3 | answer (`must_not: Kose`) | „Selge, arvestan nüüd Harku vallaga, mitte Kose vallaga.“ | õige: parandust kinnitav mainimine on lubatud |
| `appeal-follow-up` 3 | answer (`must`) | „…päevast, mil said keeldumisotsusest teada või oleksid pidanud teada saama. Tähtaja arvestamine algab järgmisel päeval.“ | õige (B9 parandatud): muster ei arvestanud sõnajärge |
| `care-home-correction` 1 | answer (`must`) | Omavalitsus katab hooldustöötajate töö kulud; sissetulekust sõltuv hüvitis | õige (B4 parem): muster oli liiga kitsas |
| `law-on-dates` 4 | answer (`valid_on`) | „31. oktoobril 2026 kehtinud tasu ma selle teabe põhjal kinnitada ei saa …“ | aus puudujäägi tunnistamine, mitte vale kehtiva õiguse esitamine. Codex: `valid_on` ei saa seda automaatselt veaks lugeda |

Ümberhinnangu järgi on õigeid pöördeid **35/40**. Kataloogi järgmises versioonis need kontrollid parandatakse. Esimene versioon jääb muutmata, et toortulemust saaks korrata.

## Päris vead ja põhjused

1. **Kuupäev küsimuses** (`law-on-dates` 1 ja 3).
   - `dateCandidates` tundis ainult ISO-kuupäevi ja aastaid. Lausest „1. märtsil 2027“ jäi alles aasta 2027.
   - Kehtivusreegel lubas seetõttu SHS-ist tänase ja kõik 2027. aasta redaktsioonid, kokku neli peaaegu samasugust teksti.
   - Mudel sai tänase ja aprilli–detsembri 2027 redaktsiooni, aga mitte 1.3.2027 kehtivat.
   - Tuvastatud periood jõudis kohale alles järgmises pöördes mudeli olekust ja jäi kehtima ka küsimusele „Aga praegu?“.
   - **Parandus:** [ADR-041](../rag-v2/adr-041-exact-dates.md).
2. **Tartu vald, mitte Tartu linn** (`tartu-parish-not-city` 1).
   - Piirkonna tuvastus nägi mõlemat nime (`ambiguous_region`), seega kataloogi ei kasutatud.
   - Eitust „mitte Tartu linnas“ see ei arvesta. Vastuvõtutestis oli sama viga G8.
3. **Abivahendi määrus** (`hearing-aid-cap` 1).
   - Tänasel kuupäeval kehtiv „Abivahendite loetelu …“ (01.09.2025–30.09.2026) ei jõudnud tõendisse. Tõendis oli ainult kaks allikat: abivahendite teatmik 2025 ja SHS.
   - Vastuses puudub piirhind, nagu vastuvõtutesti C9-s.
   - Kaotuse koht, kas kandidaatide järjestus või rerank'i valik, on veel välja selgitamata.
4. **Kellele helistada** (`money-harku-contact` 3).
   - Eelmine vastus valis mõistlikult toidupanga. Toidupanga kirjel pole kataloogis kontaktisikut ja vastus ütles seda ausalt.
   - Parem oleks anda omavalitsuse sotsiaalvaldkonna üldkontakt.
   - Kataloogi ootus („Toimetulekutoetus“) oli liiga kitsas.

## Mis töötas

- Parandus Kose → Harku.
- Uus isik ilma eelmise isiku andmeteta.
- Kriisiteade.
- Kolimine Tallinnast Rae valda.
- Täpsustus ebamäärasele küsimusele.
- Lastekaitseseaduse teatamiskohustus.
- Esimene samm enne täpsustust inimesele, kel pole ööbimiskohta.
- Vaide tähtaeg ja selle algus.
- Hooldekodu omaosaluse põhimõte.

## Järgmised sammud

1. ADR-041 (kuupäevad) ja seejärel `law-on-dates` kordamine.
2. Tartu eitus.
3. Abivahendi määruse kaotuse koht kandidaatides või rerank'is.
4. Omavalitsuse üldkontakt.
5. Kataloogi 2. versioon ja kogu vestluste komplekti kordamine.

## Kordus pärast ADR-041 ja Tartu eitust (#236, #237), 28.09 õhtul

Tootmises oli plaan `…-1253-r84fa17edc`. Kordasin ainult kaht stsenaariumi, kulu 0,021 USD.

- **`tartu-parish-not-city`: passed.** Piirkond on `tartu_vald`; vastus annab Tartu valla sotsiaaltranspordi avalduse ja teenuseosutaja.
- **`law-on-dates`: otsing on nüüd õige, valik veel mitte.**
  - Kehtivusreegel lubas 1.3.2027 kohta SHS-i 01.02–31.03.2027 ja 2027. aasta jaanuari kohta RLS-i 01.01–30.06.2027. Kumbki pole enam välistatud.
  - Tõendisse jõudis ikkagi ainult tänane redaktsioon.
  - Jälgisin rerank'i kandidaate. Kandidaatide hulgas on sama pealkirjaga SHS-i redaktsioonid (34 lõigust 9), aga lõigul polnud kehtivusaega ja rerank ei teadnud tänast kuupäeva.
  - Otsingukontroll `evidence` ei märganud seda, sest võrdles ainult pealkirja.
  - **Parandus:** [ADR-042](../rag-v2/adr-042-rerank-law-versions.md). Rerank'i lõigul on `valid_from`/`valid_to`, sisendis on `today`, ja juhis ütleb, kumba redaktsiooni hoida. Hindamisse lisandus `found_valid_on`.
  - Enne PR-i mõõtsin eraldi aktiveerimata plaaniga: `law-on-dates` 4/4 (vt ADR-042).

## Kataloogi 2. versioon uue koodiga: toortulemus 37/40

- **Kataloog:** `scenarios-corpus-2.json` sisaldab samu 16 vestlust ja 40 pööret. Parandatud on ainult ümberhinnangus liiga kitsaks leitud kontrollid, ja seaduse pöördeid kontrollib nüüd `found_valid_on`.
  - `money-harku-contact` 3 lubab ka toidupanka;
  - Kose parandusest on `must_not` eemaldatud;
  - vaide tähtaja algus nõuab mustrit `teada`;
  - hooldekodu mustrisse lisandus `hooldustöötaja`;
  - `law-on-dates` 4 nõuab ausat puudujäägi tunnistamist;
  - kuuldeaparaadi puhul sobib abivahendi määrus või teatmik, piirhind on endiselt nõutud.
- **Käivitus:** ADR-042 kood töötas eraldi koopias kahe aktiveerimata plaaniga, kulu 0,21 USD, [aruanne](rag-v2-conversation-eval-2026-09-28-run2.md).
  - Esimese plaani 0,5 USD piir täitus halvima juhu broneeringutega 22 pöörde järel, seega jooksutasin ülejäänud üheksa vestlust teise plaaniga.
- **Tulemus 37/40.** Kõik kuupäeva-, Tartu-, paranduse-, uue isiku-, kriisi- ja kolimispöörded läbisid.
- **Järele jäi kolm puudust:**
  1. **`money-harku-contact` 3 (`state`):** kontaktisikut pole. See on allpool kirjeldatud kataloogi puudus, mitte selle vestluse viga.
  2. **`vague-then-details` 2 (`provider_incomplete`):** vastust ei tulnud.
     - Viimsi kataloogiga oli sisendis 21 056 tokenit; mudel kasutas kõik 4096 väljunditokenit arutluseks.
     - 7 päeva jooksul on 194 vastusekutsest nii läinud 1. Väljundi 99. protsentiil on 3855, seega on 4096 lagi liiga lähedal.
     - Lagi on plaanis ja omaniku kinnitatud. Väljalaske plaaniuuendus (ADR-037) seda ei muuda: vaja on koodimuudatust ja uut plaani. Teen selle eraldi PR-iga.
  3. **`hearing-aid-cap` 1 (`answer`):** vastus annab õige esimese sammu ja SKA erandi tee, aga ei maini piirhinda.
     - Tõendis oli piirhinnast juttu kahes lõigus: teatmiku „Piirhinna suurendamiseks“ ja SHS-i „piirhinna ulatuses“.
     - Seega on see vastuse täielikkuse puudus. Seadme piirhinna tabel on määruse lisa, mida XML-tekst ei sisalda.

## Kordus tootmisplaaniga pärast #238 ja #239: toortulemus 38/40

- **Plaan `…20260928-1342`**, uus kinnitatud plaan väljundi laega 8192 ([ADR-043](../rag-v2/adr-043-answer-output-room.md)).
  - See tehti ja aktiveeriti pärast #239 väljalaset `rag-v2-chat-plan.mjs`-iga, sest väljalaske uuendus hoidis 4096.
  - Kulu 0,196 USD, [aruanne](rag-v2-conversation-eval-2026-09-28-run3.md).
- **Tulemus 38/40.**
  - `vague-then-details` 2 (Viimsi kataloog) läbis. Väljundit kulus 4177 tokenit, sellest arutlust 2924. Vana 4096 lae korral oleks see jälle katkenud.
  - Kõik kuupäevapöörded läbisid ka tootmisplaaniga.
- **Järele jäi kaks puudust:**
  - `money-harku-contact` 3: kontaktisik, vt allpool;
  - `hearing-aid-cap` 1: piirhinda ei mainita, kuigi kõik kolm allikat (SHS, abivahendi määrus ja teatmik) on viidatud.
- **Stiil:** hearing-aid vastus kasutas seekord teie-vormi („Alustage“, „pöörduge“), kuigi reegel on sina-vorm.
  - Kolmes käivituses on selliseid vastuseid 120-st 2, mõlemad kolmanda isiku (ema) kohta.
  - Kataloogis pole selle kohta veel kontrolli.

## Codexi järelkontroll (§14) ja parandused

Codex leidis kolm puudust ja kaks ebatäpsust. Kõik on parandatud [ADR-044-ga](../rag-v2/adr-044-date-ranges-and-place-negation.md) ja [ADR-043](../rag-v2/adr-043-answer-output-room.md) selgitusega.

- **Kuupäevavahemik** oli kaks üksikut päeva, nüüd on see üks periood.
- **Tegevuse eitus** eemaldas omavalitsuse. Nüüd eitab koht ainult partikli või eitatud elamise tegusõnaga ja mitte üle lause piiri.
- **Hindaja** lubas teisel seadusel kehtivust tõendada. Nüüd hinnatakse iga akti eraldi.
- **31.10 aususe muster** lubas väljamõeldud tasu. See on kataloogis v3 rangem; v2 jääb muutmata, sest seda on kaks korda jooksutatud.
- **Broneering:** ADR-043 väide, et broneering vabaneb, oli vale.

Jooksu 3 salvestatud vaatlused hinnati uue hindajaga uuesti ilma mudelikutseta: v2-ga ja v3-ga **38/40**. Kuupäevapööretes on viidatud küsitud päeval kehtivad SHS-i ja RLS-i redaktsioonid. See on endiselt hindaja tulemus, mitte iga vastuse sõltumatu sisuline kinnitus. Samuti on 31/40 → 38/40 muutunud ootustega võrdlus, nagu Codex märkis.

## Omavalitsuse kontaktid: kataloog ei anna ühtegi kontaktisikut

Leid 4 („Kellele helistada“) osutus laiemaks kui üks stsenaarium. Mõõtmine tehti serveris ainult lugemisega, kontaktandmeid aruandesse ei kopeeritud.

- **Kataloogi 808 paketikontaktist ei läbi `authorizeContact`-i ükski**, üheski 76 omavalitsusest. Registris on praegu kontrollitud kontakte 739 (avaldatud 1197).
- **Põhjus:** paketikontakti ja registrikirje vahel puudub seos.
  - Ilma sidumiseta (`registry_binding`) otsib `authorizeContact` registrist kirjet, mille `sourceDocId` on paketi ID.
  - Kontrollitud registrikirjetest 626-l 739-st on `sourceDocId` tühi, näiteks kõigil Harku omaniku volitatud taastamise kirjetel (`OFFICIAL_KOV_CONTACT`).
  - Ülejäänud 113 kirje `sourceDocId` ei vasta ühegi paketikontakti ID-le.
  - Pealegi erineb nimi või URL. Näiteks Harku paketis on `harku.ee/…/sotsiaal-ja-tervishoiuosakonna-kontaktid`, registris `www.harku.ee/…/kontakt/…`.
- **Paketikontaktidel pole telefoni ega e-posti** (0/808). Isegi lubatud paketikirje annaks ainult nime ja ametikoha. Kanalid on registris, mida iganädalane veebikontroll kinnitab.
- **ADR-017 sild (registrist eksport) oli mõeldud selleks, aga seda pole kordagi käivitatud.** Sellel on ka ajapiirang:
  - eksporditud `registry_binding` nõuab registri `checkedAt`-i täpset vastet;
  - iganädalane kontroll kirjutab kinnitatud kirjete `checkedAt` üle (`lib/admin/rag/contactRegistry/databaseService.js`);
  - seega aeguks eksport hiljemalt 7 päevaga ja iga nädal oleks vaja uut allikaversiooni, indeksit ja plaani.
- **Kandidaadid ülevaatuseks** on serveris `rag-v2-work/eval-files/contact-candidates-2026-09-28.json`. Neid pole repos, sest seal on nimed.
  - Kandidaadi reegel: sama omavalitsus, täpselt sama nimi ja registrikirje kontrollitud.
  - Üheselt sobib 384 kontakti 60 omavalitsuses. 20 on mitmetähenduslikud ja 404 jaoks kandidaati pole.
  - 164 kandidaadi allikaleht on sama, ülejäänutel erineb URL-i kuju.
- **Otsust vajab omanik/Codex.** Variandid:
  - **A. ADR-017 eksport nagu praegu:** igal nädalal uus eksport, allikaversioon, indeks ja plaan. Minu hinnangul liiga raske.
  - **B. Seo registrikirje ID ja revisjoniga, mitte kontrolliajaga.** Värskust kontrolliks siis ainult jooksev 90 päeva reegel, mida otsing, vastuse saatmine ja taastamine niikuinii kordavad. Eksport oleks vaja teha ainult uue revisjoni korral. See muudab ADR-017 lepingut: vaja on uut ADR-i, vastenduse ülevaatust (384 kandidaati) ja ühte uut indeksi generatsiooni.
  - **C. Otsene registrirada vestluses:** omavalitsuse kontrollitud kontaktid tuleksid päringu ajal registrist, ilma indeksita. See on uus allikaliik ja muudab viidete ning taastamise mudelit kõige rohkem.
  - Soovitan B-d, aga vastenduse sisuline ülevaatus on ADR-017 järgi operaatori otsus. Seepärast ei avaldanud ma kontaktide eksporti ise.
- **Kuni selle otsuseni** ütleb vestlus ausalt, et kontaktisikut ei saa anda, ja suunab omavalitsuse ametlikule lehele. Kataloogi v2 ootus `contacts` jääb alles, sest see on päris puudus, mitte liiga kitsas kontroll.
