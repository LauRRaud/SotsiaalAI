# ADR-070 — Täis teema annab asjaolud jätkule kaasa

02.10.2026. Teostus Claude Opus 5.5. Omanik 02.10: „tegutse“ (Codexi #302–#312 ülevaatuse piir: üheksas sõnum alustab tühja kontekstiga). Täiendab [ADR-066](adr-066-dialogue-decides-topic-and-person.md).

## Probleem

- Teemas on kuni kaheksa sõnumit. Alates [ADR-066](adr-066-dialogue-decides-topic-and-person.md)-st alustab üheksas sõnum uut teemat sama inimese kohta, aga **tühja kontekstiga**: varasemaid sõnumeid, viimast vastust ega olekut uus teema ei saanud.
- Kasutaja jaoks: kaheksa sõnumit ema hooldekodust, siis „Aga kui palju see maksab?“ ja assistent ei tea enam valda, vanust ega seda, millest jutt käis.
- **Lisaks viga:** kümnes sõnum ebaõnnestus (`dialogue_state_scope_mismatch`). Üheksas sõnum saadeti kui „jätka“ ja võeti vastu kui „uus teema“; selle olek salvestati vastuvõetud kujuga, aga järgmine sõnum luges rea saadetud kuju. Olek ei sobinud enam oma sõnumitega. See oli tootmises 02.10 alates #307-st; ADR-066 mõõtmine piiri ei ületanud.

## Otsus

Täis teema annab jätkule kaasa kolm asja. Vanemate sõnumite tekst jääb maha nagu enne.

1. **Kasutaja varasemad väited.** Täis teema salvestatud olekust võetakse kehtivad asjaolud ja iga inimese elukoha lause, kasutaja enda sõnadega, üks reale. Teise inimese kohta käiv rida algab tema sildiga („ema: …“). Need moodustavad uue teema esimese kasutajapöörde (`carried: 'statements'`), kuni 1800 tähemärki: kohad enne, siis asjaolud uuemast vanemani, kuni ruumi on.
2. **Viimane sõnum.** Täis teema viimane kasutajasõnum läheb kaasa muutmata (`carried: 'message'`). Otsinguplaan ja eelvalik näevad seega nii asjaolusid kui ka viimast küsimust.
3. **Olek ja viimane vastus.** Täis teema olek saab uue teema esimeseks olekuks: kehtivad asjaolud oma numbritega, inimesed koos valdadega, fookus, vajadused, lahtised küsimused ja perioodid. Iga tsitaat ankurdatakse kaasa võetud pöördesse, kus see sõna-sõnalt seisab, seega on see tavaline olek ja kõik senised kontrollid kehtivad muutmata. Asendatud ja tagasi võetud asjaolud kaasa ei tule. Viimane avaldatud vastus on uues teemas viiteks („teine punkt“), kuni uuel teemal on oma vastus.

- Kaasa võetud pöörded loevad teema kaheksa hulka: jätkuteemas on ruumi kuuele uuele sõnumile, siis antakse sama moodi edasi.
- Kui täis teema olek ei olnud viimast sõnumit lugenud (pööre jäi pooleli), läheb sõnum kaasa lugemata sõnumina ja otsinguplaan loeb selle kohad uuesti.
- Ilma salvestatud olekuta läheb kaasa ainult viimane sõnum.
- Selgesõnaline valik täis teemale lükatakse endiselt tagasi.
- **Viga parandatud:** pöörde režiim loetakse sellena, millena pööre vastu võeti (`context.mode`).
- Dialoogi juhis 23 ütleb mudelile, mis kaasa võetud pöörded on: varasemad kasutaja väited ja viimane sõnum; silt on serveri, ülejäänu kasutaja sõnad; nende kohta uuesti ei küsita ja ülekandmist ei mainita.
- **Pöörded on nummerdatud.** Mudelile antud kasutajapööretel on number kirjas (`turn`), et oleku tsitaat ei peaks seda loendama.
- **Tsitaat loetakse kasutaja oma sõnades.** Asjaolu tsitaat kehtib ka siis, kui see erineb sõnumist ainult suurtähe, tühikute või kirjavahemärkide poolest, või nimetab vale pöörde, aga täpselt üks pööre sisaldab neid sõnu. Olekusse läheb alati sõnumi enda tekst. Sama lugemine kehtib kohtade tsitaatidel juba varem. Põhjus: mõõtmisjooksudes jäi „Ema pension on 600 eurot.“ ja selle parandus kahel korral kirja panemata (`fact_not_quoted`), ühel juhul enne teemapiiri.

### Teostus

- `lib/rag-v2/pilot/dialogue-carry.js` (uus): `carriedStatements`, `carriedContext`, `carriedState`.
- `lib/rag-v2/pilot/dialogue.js`: `acceptDialogue` lisab jätkuteemale kaasa võetud pöörded ja kirjutab valikusse `carried`; juhis 23; pöörde režiim `context.mode` järgi.
- `lib/rag-v2/pilot/service.js`: jätkuteema esimene eelmine olek on `carriedState`.
- `lib/rag-v2/pilot/store.js`: `dialogueSource` lubab täis teema üleantud vastuse ja oleku rea.
- `lib/rag-v2/pilot/dialogue-state-4.js`: `quotedSupport` loeb tsitaadi kasutaja oma sõnades (`locateQuote`).

## Mõõtmine

Serveris, rakenduse ajutises koopias, profiil v6, aktiveerimata plaan; koopia ja plaan on eemaldatud. Hindaja saatis sõnumid nii, nagu vestlus saadab (`--auto-modes`). Kataloog `scenarios-long-topic-1.json` kirjutati enne esimest jooksu: 11 sõnumit ema hooldusest Kose vallas, parandus pärast piiri.

| Jooks | Pöördeid | Läbis | Kulu (plaani hinnad) |
|---|---:|---:|---:|
| Pikk vestlus, 1. jooks | 11 | 10 | 0,073 USD |
| Asjaolude kataloog `fact-lifecycle-1` (kontroll, piiri ei ületa) | 6 | 6 | 0,034 USD |
| Pikk vestlus, 2. jooks (pöörded nummerdatud) | 11 | 8 | 0,076 USD |

- **Üheksas sõnum** („Aga kui palju see talle endale maksma läheb?“), 1. jooks: otsing kasutas Kose valla kataloogi, olekus olid ema vanus ja pension, vastus ei küsinud valda. Vastus andis Kose valla hoolduskulu piiri, ütles, mis jääb ema tasuda ja et 600-eurosest pensionist üksi omaosaluse arvutamiseks ei piisa, ning nimetas Kose valla kontakti.
- **Kümnes ja üheteistkümnes sõnum** said mõlemas jooksus vastuse (enne see viga). Valla küsimus (11.) vastas mõlemal korral Kose valla kohta.
- **Mis ei läbinud, oli asjaolu kirjapanek, mitte ülekandmine:**
  - 1. jooks, 10. sõnum (parandus 700 eurot): vastus kasutas 700 eurot, aga mudeli tsitaat ei sobinud ja asjaolu jäi kirja panemata; järgmine pööre pani selle kirja ja asendas 600.
  - 2. jooks, 7. sõnum (enne piiri): „Ema pension on 600 eurot.“ jäi samal põhjusel kirja panemata. Seetõttu polnud seda olekus, mida üle kanda (9.), ega mida parandus asendaks (10.). Parandus ise pandi piiri taga kirja õige pöördenumbriga.
- Nende kahe libastuse vastu on tsitaadi lugemine kasutaja oma sõnades (vt Otsus). Seda kontrollivad ühiktestid; tasulist kordusjooksu selle järel ei tehtud.
- Kulu kokku 0,183 USD, kolm jooksu.

## Testid

- `tests/rag-v2-dialogue-carry.test.mjs` (uus, ilma andmebaasita): üheksas sõnum, oleku ankurdus ja sidumine, valla ankur, jätkuteema järgmised sõnumid, teine üleandmine, lugemata viimane sõnum, olekuta plaan, ruumipiir, võõra oleku tagasilükkamine, kümnenda sõnumi viga.
- `tests/rag-v2-dialogue-store.test.mjs` (päris kohalik andmebaas, 21 testi): uus test viib `PilotService`-i kaudu vestluse üle piiri ja kontrollib salvestatud pööret, mudelile antud olekut, taastamist ja kümnendat sõnumit.
- `tests/rag-v2-dialogue.test.mjs`, `tests/rag-v2-answer-prompt.test.mjs`: uuendatud.

## Piirid

- Kaasa läheb see, mis on olekus. Asjaolu, mida mudel kirja ei pannud, ja küsimused, mis polnud asjaolud, jäävad vanasse teemasse; viimane sõnum ja viimane vastus hoiavad teemat.
- Tsitaadi lugemise parandust ei ole tasulise jooksuga kinnitatud; mudeli tegelikku vigast tsitaati ei saanud näha (hindaja kustutab oma vestlused), suurtähe erinevus on järeldus.
- Väidete pööre on kuni 1800 tähemärki. Väga paljude või pikkade asjaolude korral jäävad vanemad välja ja nendega seotud vajadused samuti.
- Jätkuteemas on kuus uut sõnumit, siis antakse uuesti edasi; pikk vestlus teeb seda mitu korda ja iga kord sõltub oleku täpsusest.
- Vestluses on kokku kuni 64 sõnumit (`conversationTurns`), see piir on muutmata.
- Mõõdetud on üks stsenaarium kaks korda ühe inimesega; kahe inimesega vestlust üle piiri ei ole mõõdetud.
