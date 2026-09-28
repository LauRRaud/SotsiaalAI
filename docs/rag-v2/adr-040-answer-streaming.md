# ADR-040 — Vastus ilmub kirjutamise ajal, kinnitatakse samade kontrollidega

28.09.2026. Teostus Claude Opus 5.5. Omaniku ülesanne samal päeval:
- lisa vastuse järkjärguline kuvamine;
- säilita vastuse- ja viitekontrollid ning kuluarvestus;
- mõõda eraldi aega esimese nähtava tekstini ja lõpliku vastuseni;
- kontrolli kohalike testadapteritega katkestust, vigast vastust ja taasühendumist;
- ära lisa teist mudelikutset ega muuda mudelit.

## Probleem

- Soojas pöördes kulub mudelile suurem osa ajast. Vastuse mudelil on 6–16 s ning plaani ja rerank'i kutsetel kokku umbes 3–5 s ([ADR-039](adr-039-search-timings.md)). Otsing ise võtab 3,4–5 s.
- Vastus tuli ühe tükina: kasutaja nägi teksti alles pärast kogu vastuse valmimist ja kontrolli, umbes 20 s pärast küsimust.

## Otsus

- **Mudel ja leping ei muutu.** Vastust küsitakse sama mudeli, juhise ja väljundskeemiga. Päringu kehas on lisaks `stream: true`, ja auditeeritud keha (`requestAudit.body`) ütleb seda. Mudelikutse on ikka üks.
- **Pakkuja** (`lib/rag-v2/pilot/provider.js`) loeb voogesitatud vastuse Responses API sündmustena.
  - Tekstitükid (`response.output_text.delta`) lähevad lugejale kohe edasi.
  - Täielik vastus (`response.completed`, `.failed` või `.incomplete`) läbib **täpselt samad kontrollid** nagu seni: mudel, olek, väljundi kuju ja JSON. Ka kasutus arvestatakse samamoodi.
  - Kui voog lõpeb ilma täieliku vastuseta, on kasutus teadmata. Reserveering jääb alles (`provider_usage_unknown`) ja saadud tekst jääb piiritletud mustandiks.
  - Voo piir on 8 MB (mitte-voos 2 MB). Lugeja viga ei muuda vastust ega arvestust.
- **Nähtav tekst** (`lib/rag-v2/pilot/answer-stream.js`). Mudel kirjutab JSON-it. Sealt loetakse ainult see, mida lugeja lõpuks näeb: iga ploki tekst, piirangud ja täpsustav küsimus, samas järjekorras ja samade vahedega nagu `renderAnswer`.
  - Tekst on ajutine: viited tulevad alles kinnitatud vastusega.
  - Ootamatu JSON peatab ajutise teksti, aga ei viska viga.
- **Teenus** (`service.run(..., { onAnswerText })`):
  - `timings.phases.first_text` on aeg pöörde algusest esimese nähtava tekstini;
  - `answered` on aeg mudeli lõpuni ja `validatedDraftMs` aeg kontrollitud vastuseni;
  - kinnitamine, viitekontroll ja avaldamine on samad mis seni.
- **HTTP** (`lib/chat/m4PilotServer.js`): voog tuleb ainult kliendile, kes seda küsib (`Accept: text/event-stream`).
  - Autentimine, päringu kontroll ja sessioon on enne voogu ning nende vead on JSON koos olekukoodiga.
  - Voos on `delta` sündmused (ajutine tekst) ja üks `done` sündmus. `done` kannab sama vastust, mis JSON-rada saadaks: `{ status, body }` koos kinnitatud vastuse või vea- või kriisiteatega.
  - Vaikne ühendus saab iga 15 s kommentaarirea.
  - **Katkestus:** kui lugeja läheb ära, jookseb pööre lõpuni ja salvestatakse.
  - **Taasühendumine:** sama pöördevõti ootab käimasoleva pöörde salvestatud tulemust, 1 s sammuga kuni 120 s. Teist otsingut ega mudelikutset ei tehta. Kui pööre selleks ajaks ei valmi, on vastus „ootel“, nagu seni.
- **Klient** (`lib/chat/m4PilotStream.js`, `useChatStream`):
  - näitab ajutist teksti ja asendab selle `done` vastusega: kinnitatud vastus viidetega või veateade;
  - `done` läbib sama käsitluse nagu JSON-vastus (olekud, kriis, allikad);
  - kaotatud voo korral küsib klient sama päringu ja pöördevõtmega uuesti, kuni 2 korda. Kui uus katse hakkab ise teksti saatma, tühjendatakse enne vana ajutine tekst;
  - kasutaja katkestus jääb katkestuseks.

## Piirid

- Ajutine tekst on kinnitamata. Kui vastus kontrolli ei läbi, asendub see veateatega. Lugeja võib selle hetkeks näha.
- Tõendimustandi raja (`evidenceDraft`) skeem on teine: seal ajutist teksti ei tule ja vastus ilmub lõpus.
- Taasühendumine ootab vastust, aga ei näita selle kirjutamist. Ootamine eeldab, et sama pöörde tulemus salvestatakse. Kui algne protsess suri, jääb pööre `claimed` olekusse, kuni see aegub.

## Kontroll

- `tests/rag-v2-answer-stream.test.mjs`:
  - ajutine tekst on sama, mis täieliku vastuse nähtav tekst, ükskõik kuidas JSON tükkideks jaguneb (ka paoread, täpitähed, emoji ja dialoogioleku stringid);
  - surrogaatpaarid jõuavad terviklikult;
  - vigane JSON peatab teksti vaikselt.
- `tests/rag-v2-pilot-provider.test.mjs`:
  - voogesitatud vastus annab sama väärtuse, kasutuse ja päringu ID, ka baitide piiril jagatud sündmuste korral;
  - puuduv lõppvastus, `failed`, võõras mudel ja liiga suur voog ei ole kunagi edu;
  - lugeja viga ei muuda midagi.
- `tests/rag-v2-pilot-store.test.mjs` (päris andmebaas):
  - voogesitatud vastus näitab teksti enne avaldamist;
  - auditeeritud kehas on `stream: true`, `first_text` ≤ `answered`, kasutus on salvestatud ja mudelikutse on üks;
  - viitekontrolli mitte läbiv vastus jääb tervikuna avaldamata (`answer_rejected`), kuigi selle tekst oli juba nähtav;
  - lugeja viga ei peata pööret.
- `tests/rag-v2-pilot-stream-route.test.mjs` (päris POST-käsitleja, kohalikud testadapterid):
  - voog: `delta` ja `done` kinnitatud vastusega; ilma voota JSON nagu seni;
  - vigane vastus: `done` kannab vea, mitte mustandit;
  - katkestus: pööre jookseb lõpuni ja sama võti loeb vastuse tagasi;
  - taasühendumine käimasolevale pöördele ootab salvestatud tulemust, teist kutset ei tehta; aegumisel tuleb „ootel“;
  - vead enne voogu jäävad JSON-iks ja kriisilause saab oma teate.
- `tests/rag-v2-pilot-stream-client.test.mjs`: voog ja `done`, kaotatud voo uus küsimine (ootamine või uus kirjutamine), kõik katsed kaotsi, mitte-voog vastus ja kasutaja katkestus.
- `npm test`: 353 läbis, 0 ebaõnnestus, 17 vahele jäetud. Integratsioon: `rag-v2-pilot-store` 28/28, `rag-v2-dialogue-store` 16/16, `rag-v2-unified` 4/4.
- Pärast väljalaset mõõdetakse päris pöördes eraldi `first_text` ja lõpliku vastuse aeg: serveris `validatedDraftMs`, brauseris `done` saabumine.
