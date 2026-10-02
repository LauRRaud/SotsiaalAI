# ADR-067 — Ainult tervitus saab vastuse ilma otsinguta

02.10.2026. Teostus Claude Opus 5.5. Omanik 02.10: „ma kirjutasin "tere" ja ootasin vastust 10 sekundit“; „kui teretus on lühike, ilma muu tekstita. Osad kirjutavad Hei vms. muidugi peaks vastus tulema üsna kohe“.

## Probleem

- „tere“ läbis kogu töövoo: otsinguplaan, embedding, otsing kogu korpusest, mudeli eelvalik ja vastus.
- Mõõdetud 02.10 (pööre 14 s pärast taaskäivitust): 20,8 s. Plaan 2,2 s ja 0 päringut, külm vektorotsing 7 s, eelvaliku allikate laadimine 8 s, vastus 2,2 s. Eelvalik luges 12 500 ja vastus 7000 tokenit.
- Soojal serveril võttis tervitus umbes 10 s.
- Otsinguplaan ütles ise, et otsida pole midagi (tühi päringuloend), aga otsing tehti ikkagi.

## Otsus

Teema esimene sõnum, mis on **ainult tervitus**, vastatakse ilma otsinguplaani, embeddingu ja otsinguta.

- **Mis on tervitus** (`lib/rag-v2/pilot/greeting.js`): kogu sõnum on pärast kirjavahemärkide ja emotikonide eemaldamist üks loendi fraasidest.
  - Eesti: tere, tere tere, terekest, tere päevast, tere hommikust, tere õhtust, hommikust, päevast, õhtust, tervist, tervitus, tervitused, tsau, tšau, hei, hei hei, heipa.
  - Inglise: hello, hi, hey, good morning jt. Vene: привет, здравствуйте, добрый день jt.
  - Kõik muu on päring: „Tere! Mul on suured võlad“, „Tere Luna“, „aitäh“, „jah“.
- **Millal:** ainult teema esimese sõnumina, kui vestluses pole varasemat vastust. Keset vestlust võib lühike sõnum olla vastus täpsustavale küsimusele ja vajab tõendeid.
- **Mis juhtub** (`PilotService.run`, `unifiedSearch`):
  - Otsinguplaani, embeddingut ja eelvalikut ei kutsuta.
  - Teadmiste rada on tühi (`no_evidence`); kataloogi rada käib ilma vektorita ja valda ei vali.
  - Vastuse kirjutab sama mudel sama juhise ja lepinguga, voona. Keel tuleb tervitusest („Hello“ saab ingliskeelse vastuse).
  - Pööre salvestub nagu iga teine (olek, audit, `searchAssist.greeting: true`). Järgmine sõnum jätkab teemat tavalist rada.
- **Miks mitte brauseris:** kohalik vastus kaoks ekraanilt, kui server saadab vestluse loendi (`hydrateFromServer` asendab kohaliku loendi serveri omaga).
- **Miks mitte valmis lause ilma mudelita:** pööre peab andma ka vestluse oleku, mida järgmine pööre loeb; selle kirjutab vastuse mudel.

## Mõõtmine enne ühendamist

Serveris, rakenduse ajutises koopias, profiil v5, aktiveerimata plaan (koopia ja plaan eemaldatud). Kataloog `tests/evaluation/dialogue/scenarios-greeting-1.json`, vastus voona.

| Stsenaarium | Rada | Esimene tekst | Kokku | Tulemus |
|---|---|---:|---:|---|
| „tere“ (protsessi esimene pööre) | tervitus | 5,8 s | 6,5 s | „Tere! Kuidas saan sind aidata?“ |
| „Hei!“ | tervitus | 2,3 s | 2,8 s | „Tere! Kuidas saan sind aidata?“ |
| „Hello“ | tervitus | 2,4 s | 2,9 s | „Hello. What would you like help with?“ |
| „Tere hommikust“ | tervitus | 2,8 s | 3,3 s | „Tere hommikust. Millega saan sind aidata?“ |
| „Tere! Mul on suured võlad, kes mind aitab?“ | täisrada | 18,4 s | 21,0 s | võlanõustamine, viitega |
| „Kuidas ma saan taotleda toimetulekutoetust?“ pärast tervitust | täisrada | 23,5 s | 27,7 s | SHS viidatud, olek säilis |

- Kõik 6 pööret läbisid. Kulu 0,0135 USD plaani hindade järgi, üks jooks.
- Tervituse pöördes on üks mudelikutse (vastus, umbes 2,0–2,5 s, 7000 sisendtokenit: juhis ja leping). Otsingu osa on 0,35–0,45 s (ulatus ja kataloog).
- Esimene pööre oli aeglasem, sest hindaja on värske protsess. Täisraja ajad on samuti külma protsessi omad, mitte sooja serveri omad.

## Testid

- `tests/rag-v2-greeting.test.mjs`: tervitused kolmes keeles suur- ja väiketähtede, kirjavahemärkide ja emotikoniga; mis ei ole tervitus (päringuga tervitus, „aitäh“, „jah“, „Tere Luna“, liiga pikk tekst); kataloogi iga esimene sõnum loetakse nii, nagu selle ootus ütleb; hindaja kontroll `greeting`.
- Teenuse haru ennast katab serveri mõõtmine: andmebaasiga dialoogitestid ei käi CI komplektis ega selles masinas.

## Piirid

- Vastus ei tule päris kohe, vaid 2–3 sekundiga: mudelikutse jääb alles ja arutlus on `medium` nagu mujal. Madalama arutlusega tervitus oleks kiirem; see on omaniku otsus.
- Loendis puuduv tervitus („jou“, „tervitan“) või kirjaveaga tervitus läheb täisrada nagu enne.
- Keset vestlust öeldud tervitus läheb täisrada.
- Kohe pärast taaskäivitust on päris küsimused endiselt aeglased, kuni allikad on soojad; see on eraldi töö.
