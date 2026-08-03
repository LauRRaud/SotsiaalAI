# Golden-37 pimehindamise fikseeritud vorm

Staatus: fikseeritud enne esimest `gpt-5.4-mini` baasvastust.

Hindaja saab ainult anonüümse `run_id`, küsimuse ID, vastuse teksti ja kuvatud allikate kontrollitud metaandmed. Mudel, reasoning effort, verbosity ja tokenilagi on eraldi võtmefailis. Vastuseid loonud mudel ei anna oma vastustele lõplikku sisuhinnet.

## Hindeskaala 0–3

Olemasoleva `docs/internal/luna-rag-blind-test-key.md` rubriigi järgi hinnatakse kuut kategooriat:

1. faktiline ja õiguslik täpsus;
2. vajalike allikate mõtete katvus ning küsimusele vastamine;
3. fakti, hinnangu, praktika, uuringu ja ettepaneku eristamine;
4. ebakindluse, allikapiiride ja põhjendamata oletuste aus käsitlemine;
5. praktiline kasutatavus;
6. selgus, struktuur, terviklikkus ja proportsionaalne pikkus.

Skaala tähendus jääb muutmata: `0` = puudulik või kriitiliselt vale, `1` = oluline puudus, `2` = üldiselt kasutatav väikeste puudustega, `3` = täielikult nõuetekohane.

Kriitiline viga piirab faktitäpsuse maksimaalselt ühele punktile. Vastuvõetava puudumise eest hinnet ei vähendata. Ülesandespetsiifilised verbosity-tundlikud punktid märgitakse eraldi katvusena, kui need on võtmes olemas.

## Kohustuslik kontrollnimekiri

Kontrollnimekiri normaliseerib olemasoleva Golden-runner’i ootused, projektidokumendi §12.4 kriteeriumid ja ülaltoodud kuue kategooria rubriigi. See ei lisa uusi sisulisi hindamisreegleid.

| Kontroll | Tulemus | Märkus |
|---|---|---|
| Faktiline ja õiguslik täpsus | jah / osaliselt / ei | |
| Vastab esitatud küsimusele | jah / osaliselt / ei | |
| Allikad on asjakohased | jah / osaliselt / ei / pole kohaldatav | |
| Väited ja allikad vastavad | jah / osaliselt / ei / pole kohaldatav | |
| Praktika, uuring ja ettepanek on eristatud | jah / osaliselt / ei / pole kohaldatav | |
| Inimese õigused ja autonoomia on korrektselt käsitletud | jah / osaliselt / ei / pole kohaldatav | |
| Põhjendamata oletusi või erandeid välditakse | jah / osaliselt / ei | |
| Riskid on seotud maandamismeetmetega | jah / osaliselt / ei / pole kohaldatav | |
| Vastus on praktiliselt kasutatav | jah / osaliselt / ei | |
| Vastus on terviklik 1100-tokenise tootmislae piires | jah / osaliselt / ei | |
| Vastus on selge ja struktureeritud | jah / osaliselt / ei | |
| Allikad on jälgitavad kuvatud metaandmete kaudu | jah / osaliselt / ei / pole kohaldatav | |

## Hindamisrida

| run_id | question_id | täpsus 0–3 | katvus 0–3 | eristus 0–3 | piiride ausus 0–3 | kasutatavus 0–3 | selgus 0–3 | verbosity-punktid | kriitiline viga | kommentaar |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| | | | | | | | | | | |
