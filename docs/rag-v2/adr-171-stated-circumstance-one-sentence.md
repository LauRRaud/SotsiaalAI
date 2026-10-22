# ADR-171 — Kirjeldatud asjaolu saab vastuses ühe lause (search-assist-22, m4-grounded-dialogue-50)

22.10.2026. Teostus Claude Opus 5.5. Omaniku palve: „tee parandused“ (parandusnimekirja punkt 29).

## Leid

- Pöördumine: „Elan tabasalus, tervisekassat ei ole, toimetulek on raske. Kas saan pöörduda kohaliku omavalitsuse
  sotsiaaltöötaja poole?“
- Plaan ja valik leiavad ravikindlustuse lõigu üles (ADR-165, search-assist-18). Vastus seda alati ei kasuta, sest
  juhis „üks kuni kolm võimalust“ jätab ruumi ainult küsitud asjale.
- answer-14 püüdis seda parandada juhisega igale pöördele. Juhis pani spetsialisti pikkades vestlustes mudeli kaaluma iga
  kirjeldatud asjaolu ja kaks vastust ületas 60 s piiri. answer-14 võeti tagasi (ADR-165).

## Otsus

- **Valikumudel märgib asjaolu lõigud.** Valikumudel tagastab alles jäetud lõikude (`useful`) kõrval loendi
  `circumstance`: need alles jäetud lõigud, mis jäeti kasutaja kirjeldatud, aga küsimata asjaolu pärast. Kui selliseid
  pole, on loend tühi.
  - Server võtab sealt ainult alles jäetud lõigud (`rerankCircumstance`).
  - Lõigud seotakse ühiku kaudu vastuse viidetega (`circumstanceRefs`).
- **Vihje ainult nendel pööretel.** Ainult neil pööretel saab vastus pärast tõendeid ühe rea. See nimetab viited ja
  palub asjaolu kohta ühe lühikese lause: oma plokis või sobiva ploki lõpus. See ei ole küsimuse võimaluste hulgas ega
  muuda vastuses midagi muud.
- **Põhijuhis jääb samaks.** Teistel pööretel on põhijuhis sama mis enne ja vihjet pole, seega puhver ei katke. Lause
  tuleb arendaja sõnumina tõendite järel, nagu rolli tekst.

## Kontroll

- **Kohalik kontroll:**
  - valiku skeemis on `circumstance`;
  - alles jätmata tunnused jäävad välja;
  - viited tulevad ühiku järgi;
  - vihje on ainult viidetega pöördel;
  - mõlema pöörde juhis on sama.
- **Serveris:** lühike vigade test. Sinna kuulub omaniku Tabasalu küsimus uutes vestlustes: kas vastuses on ravikindlustuse
  lause, kas vastus jääb sama pikaks ja kui kaua see aega võtab.

## Kontrollid samal päeval

- **F1 (search-assist-22, kolm Tabasalu pööret).**
  - Vihje jõudis kõigisse kolme vastusesse.
  - Valik märkis asjaoluks toimetulekuraskuse lõigud. T1 ja T2 plaani päring („ravikindlustuseta inimesele kohaliku
    omavalitsuse abi“) ei toonud kandidaatide sekka ravikindlustuseta inimese tervishoiu lõiku.
  - Parandus: search-assist-23, asjaolu päring asjaolu enda kohta (ADR-173).
- **Kiirkontroll (search-assist-23, üks pööre).**
  - Plaan kirjutas „ravikindlustuseta inimese arstiabi ja tervishoiuteenused“ ja kandidaatide seas oli kaheksa sellist
    lõiku.
  - Valik ei võtnud ühtegi ega märkinud midagi. 21.10, enne asjaolu loendit, võttis valik selle lõigu 3 korda 3-st.
- **search-assist-24.** Kui sõnum kirjeldab mitut omaette vajadusega asjaolu, jätab valik igaühe kohta alles lõigu, mis
  ütleb, mis just selle asjaolu puhul kehtib (näiteks ravikindlustuseta inimese tervishoid raha abi kõrval). Seda tehakse
  ka siis, kui küsitud asja lõigud täidavad loendi.
