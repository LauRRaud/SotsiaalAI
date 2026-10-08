# ADR-110: koht loetakse sõnumist, kus tsitaat on, ka siis, kui otsinguplaan andis vale sõnuminumbri

Kuupäev: 08.10.2026. Seis: kood tehtud, ühiktestid läbi, serveris kontrollitud kordustesti enda plaanidega mudelit kutsumata. Mudeliga pärast parandust mõõdetud ainult väikese kordusega (vt lõpus).

## Probleem

Pika vestluse testi kordus ([ADR-105](adr-105-topic-holds-a-case.md), jaotis „Kordustest“) näitas viga, mida esimeses testis ei olnud. Lapsevanema vestluses oli omavalitsus 30 pöördest ainult neljas; esimeses testis 26-s.

Pöörete kirjetest:

- Neljas sõnum oli „Elame Jüris.“ Otsinguplaan nimetas koha õigesti kaks korda (kasutaja ja poja elukoht, tsitaat „Elame Jüris“), aga sõnumi numbriks pani mõlemal korral **1**.
- 22. sõnum oli „Ta elab üksi Kuressaares. …“. Plaan nimetas koha õigesti (ema elukoht), sõnumi numbriks jälle **1**.
- Server otsis tsitaati plaani nimetatud sõnumist. Sõnum 1 oli vestluse mälul juba loetud, seega jättis ta koha kõrvale (loetud sõnumi kohti uuesti ei loeta). Asulat ei lubatud, valda ei tekkinud, vastus küsis „Millist omavalitsust sa Jüri all mõtled?“ ja järgmised vastused jäid valla kirjeteta.

Spetsialisti vestluses pani plaan 23 kohast kõigile õige numbri. Kas numbrivea põhjustas mõni tänane juhisemuudatus või on see mudeli juhuslik libastus, sellest mõõtmisest ei selgu; esimeses testis samade sõnumitega seda ei juhtunud.

## Otsus

Koha sõnumi määrab tsitaat, mitte number (`placedTurns`, `lib/rag-v2/pilot/person-places.js`). Kui plaani nimetatud sõnum ei ole lugemata sõnum, milles see tsitaat on, ja tsitaat on täpselt ühes lugemata sõnumis, loetakse koht sellest sõnumist. Kui tsitaati ei ole üheski lugemata sõnumis või on see mitmes, jääb koht nii, nagu plaan selle andis, ja senised kontrollid otsustavad.

Parandus tehakse ühes kohas, enne kui asulate lubamine (ADR-103) ja kohtade kontroll (ADR-051, ADR-074) plaani kohti loevad, nii et mõlemad näevad sama numbrit. Pöörde kirjes jäävad plaani enda numbrid alles (`searchAssist.plannedPlaces`), kontrollitud kohtadel on õige sõnum.

Mis ei muutu: loetud sõnumi kohta uuesti ei loeta; tsitaat peab endiselt sõnumis olema; kelle koht see on ja kas ta seal elab, otsustavad samad kontrollid mis enne.

## Kontrollitud

- Ühiktestid: 826, neist 804 läbi ja 22 vahele jäetud. Uus test: kordustesti neljas sõnum plaaniga, nagu pöörde kirje selle hoiab (number 1 kaks korda), annab sama tulemuse mis õige numbriga plaan (Rae vald, asula Jüri alevik, kasutaja ja poja elukoht); reegel eraldi: üks lugemata sõnum, loetud sõnum, kaks sõnumit, õige number.
- Serveris, tasuta, kordustesti enda plaanidega ja serveri sõnavormide lugejaga: 4. sõnum annab nüüd Rae valla (enne valda ei olnud), 5. sõnum jätkab Rae vallaga ja ulatusel on „Jüri alevik → Rae vald“; 22. sõnum annab Saaremaa valla, 23. jätkab sellega.
- Kohalik andmebaasitest: 35/35.
