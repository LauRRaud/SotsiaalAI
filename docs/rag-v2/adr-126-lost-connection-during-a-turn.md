# ADR-126: katkenud ühendus pöörde ajal ei jäta inimest vastuseta

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5. Omanik 09.10.2026 õhtul: kuue tunni töö RAG-i valmisoleku nimel. Viga leidsid agendid valmisoleku kaardistuses (kaks sõltumatut lugejat, kontrollija kinnitas); parandus, testid ja mõõtmine päris vestlusaknas minult.

## Probleem

Vastus tuleb vestlusaknasse voona ([ADR-040](adr-040-answer-streaming.md)). Kui ühendus pöörde ajal katkeb (telefon vahetab võrku, sülearvuti läheb hetkeks unne), pidi käima nii: klient küsib sama pöörde võtmega uuesti, server ootab käimasoleva pöörde ära ja annab selle salvestatud vastuse; teist otsingut ega mudelikutset ei tehta. Kaks kohta ei pidanud seda lubadust.

1. **Server ootas ainult seisundit `claimed`.** Pööre on selles seisundis oma esimesed hetked; iga mudelikutse ajal on seisund `plan_sent`, `embedding_sent`, `rerank_sent` või `answer_sent`. Uuesti küsija sai sel ajal kohe vastuse 409 „Pooleliolev katse“, kuigi päris vastus valmis mõne sekundi pärast, ja miski ei küsinud enam uuesti enne lehe uuesti laadimist.
2. **Brauser ei saanud pöörde esimesel poolel üldse vastust.** Vastuse päised lähevad teele koos esimeste baitidega, ja esimesed baidid olid vastuse esimene tekst või 15 sekundi elusolekumärk. Mõõdetud päris vestlusaknas: 17,7-sekundilise pöörde päised jõudsid brauserisse 15. sekundil. Kuni selleni oli katkenud ühendus brauseri jaoks ebaõnnestunud päring, mida klient uuesti ei küsi, mitte katkenud voog.

## Otsus

- **Ootamine kõigis töös olevates seisundites.** `settledTurn` (`lib/chat/m4PilotServer.js`) ootab, kuni pööre on mõnes seisundis loendist `RUNNING_STATES` (`lib/rag-v2/pilot/store.js`, sama loend, mille järgi hoidla loeb käimasolevaid pöördeid). Piirid jäävad: samm 1 sekund, kokku kuni 120 sekundit.
- **Surnud protsessi pööret ei oodata.** Kui pöörde rida ei ole 90 sekundit muutunud, on selle protsess kadunud (mudelikutse lõpeb 60 sekundiga ja iga etapp kirjutab rea) ja ootamine lõpeb kohe. Ajata rida loetakse värskeks.
- **Taastamist ootav pööre (`needs_recovery`) ei ole töös:** seda ei lõpeta miski, mida siin oodata, seega vastatakse kohe nagu enne.
- **Voog algab kommentaarireaga** (`: open`), nii et päised lähevad teele kohe. Katkestus plaani või otsingu ajal on nüüd katkenud voog, mille klient sama võtmega uuesti küsib.

Uut mudelikutset ega otsingut ei lisandu: sama võti loeb ainult salvestatud pööret.

## Mida see ei muuda

- Klient küsib uuesti kõige rohkem kaks korda, sekundilise vahega, ja brauseri kogupiir on 180 sekundit.
- Pärast tundmatu lõpuga pööret (`unknown`) annab sama tekst samas vestluses 24 tunni jooksul sama pöörde; see on omaniku otsus (vaata valmisoleku loendit).
- Stopp-nupp ei peata pööret serveris.

## Kontrollitud

- Ühiktestid päris POST-käsitlejaga (`tests/rag-v2-pilot-stream-route.test.mjs`): kuues töös olevas seisundis ootab uuesti küsija salvestatud vastuse ära (üks käivitus, rida loetud kolm korda); viis minutit muutmata rida vastatakse ühe lugemisega; lõppenud seisundeid (`unknown`, `needs_recovery`, `answer_rejected`, `stopped`) ei oodata; voo esimesed baidid on avakommentaar. Kumbki reegel murti kordamööda ja test kukkus.
- Kliendi vootestid (`tests/rag-v2-pilot-stream-client.test.mjs`) läbivad muutmata: kommentaaririda klient ei loe.

## Mõõtmine päris vestlusaknas

Täidetakse pärast väljalaset: sama katse (voog katkestatakse brauseris neli sekundit pärast päiseid), enne ja pärast.
