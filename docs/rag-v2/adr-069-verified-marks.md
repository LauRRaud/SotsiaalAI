# ADR-069 — Kontrollimärgid püsivad taaskäivituse üle

02.10.2026. Teostus Claude Opus 5.5. Omanik 02.10: „tee kuni neljandani ära“ (punkt 2: vestlus on pärast deploy'd esimesed minutid aeglane). Järgib [ADR-033](adr-033-warm-up-at-server-start.md) (allikate soojendus käivitusel) ja [ADR-039](adr-039-search-timings.md) (Qdranti soojendus).

## Probleem

- Iga deploy ja iga vestlusplaani vahetus taaskäivitab `sotsiaalai-frontend`-i. Uus protsess kontrollib iga allika enne kasutamist täielikult: bundle'i räsi ja kataloogirida, allikaobjektide võrdlus, ühikute morfoloogia uus EstNLTK analüüs. Kontrollitud read on meeles ainult protsessi mälus.
- Taustasoojendus teeb selle 1596 teadmusallika kohta ette ära. 02.10 kestis see igal käivitusel 325–349 s, päeva jooksul üheksa korda.
- Selle 5,5 minuti sees esitatud küsimus kontrollib oma allikad ise, võistleb soojendusega sama EstNLTK protsessi pärast ja ootab külma Qdranti järel, sest vektorid loeti alles pärast allikaid. 02.10 võttis „tere“ 14 s pärast taaskäivitust 20,8 s (külm vektor 7 s, valija hulga laadimine 8 s).

### Kuhu aeg kulub (server, 100 allikat 1596-st, tasuta)

| Samm | Aeg | Osa |
|---|---:|---:|
| Morfoloogia uus analüüs (EstNLTK) | 15,0 s | 59% |
| Bundle'i räsi, kataloogirida, objektide võrdlus (protsessor) | 4,5 s | 18% |
| Bundle'ite ja objektide lugemine andmebaasist | 3,5 s | 14% |
| Ühikute lugemine ja võrdlus | 2,3 s | 9% |
| Sama lugemine juba kontrollitud protsessis | 2,7 s | |

## Otsus

Kontrolli tulemus ei kao koos protsessiga.

- **Märk.** Iga täielik kontroll jätab andmebaasi tabelisse `rag_v2_verified_read` märgi: räsi lugemise võtmest, ridade versioonidest, millel kontroll tehti (`xmin`, objektide arv), kontrolliskeemi nimest ja analüsaatori versioonist. Iga rea muutus annab uue versiooni, seega märk kehtib ainult täpselt nende ridade kohta.
- **Pärimine.** Käivitusel loeb protsess märgid (`inheritVerified`). Lugemist, mille märk on olemas, kasutab vestlus kohe: ilma morfoloogia analüüsi ja objektide võrdluseta. Bundle'i ehituse kontroll (`verifiedBundle`) jookseb endiselt igal lugemisel.
- **Protsess kontrollib endiselt kõik ise.** Taustasoojendus teeb iga allika täieliku kontrolli uuesti (`own`), päritud märk seda vahele ei jäta. Vahe varasemaga: kuni see kontroll kestab, usaldab protsess eelmise protsessi tulemust samade ridade kohta.
- **Viga lõpetab usalduse.** Kui soojendus ebaõnnestub (mis tahes veaga), tühjendab protsess päritud märgid mälus ja tabelis; tabelisse lähevad tagasi ainult need märgid, mille kontrolli see protsess ise tegi. Edasi kontrollib iga lugemine end ise nagu enne, ja rikutud allikas annab vea enne kasutamist.
- **Vestlus läheb ette.** Kui protsessil on päritud märke, ootab soojendus iga partii eel hetke, mil ükski vestluspööre pole 15 s kataloogi kasutanud. Kokku ootab ta kõige rohkem 10 min, seega lõpeb protsessi oma kontroll ka pideva kasutuse korral piiratud ajaga. Ilma päritud märkideta käib soojendus nagu enne.
- **Vektorid kohe.** Qdranti vektorid loetakse käivitusel kohe, allikate kõrval, ja veel kord pärast allikaid (teine kord on soe ja võtab alla sekundi).
- Märgid vanemad kui 30 päeva kustutatakse käivitusel. Uus analüsaatori versioon või kontrolliskeem annab teised märgid, vanad ei sobi enam.

### Mida see ei muuda

- Kontrollide sisu. Ridade muutus, uus korpuse versioon või uus dokument kontrollitakse enne kasutamist täielikult nagu enne.
- Skriptid ja hindamisjooksud: nende protsessid märke ei loe ega kirjuta (`inheritVerified` kutsub ainult serveri käivitus).
- Esimene käivitus pärast seda muudatust on külm nagu enne: tabel on tühi.

### Teostus

- `prisma/rag-v2/migrations/202610020001_verified_read`: tabel `rag_v2_verified_read (mark, verified_at)`. Deploy rakendab selle ise.
- `lib/rag-v2/search/postgres.js`: `known()`, `inheritVerified()`, `saveVerified()`, `disinherit()`, `foreground()`; `bundles()` ja `units()` said valiku `own`; `warm()` kontrollib `own`-iga ja ootab vaikset hetke.
- `lib/rag-v2/pilot/retrieval.js`: käivitus loeb märgid enne soojendust, vektorid loetakse kohe ja uuesti pärast allikaid, iga vestluse kataloogikasutus märgitakse (`foreground`).

## Mõõtmine (server, ajutine koopia, päris korpus v47, tasuta)

100 teadmusallikat, tabel loodi kontrolli ajaks ja kustutati pärast.

| Mida | Aeg |
|---|---:|
| Protsess ilma märkideta loeb allikad esimest korda (tänane külm tee) | 25,0 s |
| Sama protsess loeb uuesti (soe) | 1,0 s |
| Järgmine protsess loeb päritud märkidega esimest korda | 3,5 s |
| Märkide lugemine käivitusel (300 märki) | 0,01 s |
| Järgmise protsessi oma täielik kontroll taustal | 24,5 s |

- Päritud märkidega lugemine ei kutsunud analüsaatorit ega lugenud objekte (0 ja 0 kutset; külmal teel 102 ja 17).
- Vea katse: analüsaator, mis vastab teisiti. Soojendus andis `index_morphology_integrity_failed`, päritud märke jäi 0, tabelisse 0 rida, ja sama allika lugemine andis seejärel sama vea.
- Kõigi 6470 dokumendi kataloogiridade kontroll käivitusel: 0,4 s.

Testid: `tests/rag-v2-verified-marks.test.mjs` (märk, pärimine, salvestus, usalduse lõpp, vaikse hetke ootamine, käivituse järjekord), `tests/rag-v2-vector-warm-up.test.mjs` (vektorite korduskatse uue järjekorraga).

## Piirid

- Esimestel minutitel pärast käivitust kasutab vestlus allikaid, mille kontrollis eelmine protsess, mitte käimasolev. Kui deploy muudab kontrolli koodi nii, et salvestatud andmed enam ei sobi, selgub see selle protsessi taustakontrollis mõne minuti jooksul, mitte enne esimest kasutust.
- Märk tugineb rea versioonile (`xmin`). Kettal riknenud rida, mille versioon ei muutunud, leiab alles taustakontroll.
- Kui vestlusi tuleb vahetpidamata, venib taustakontroll kuni 10 min pikemaks; pärast seda võistleb see vestlusega nagu enne.
- Bundle'ite vahemälu on uues protsessis tühi: esimene lugemine toob bundle'i andmebaasist (mõõdetud 35 ms allika kohta, soojalt 10 ms).
- Mõju päris vestluse esimesele pöördele pärast deploy'd mõõdetakse pärast teist käivitust (esimene täidab tabeli).
