# ADR-077 — Plaan ja eelvalik töötavad praeguse sõnumi jaoks; „mis muutub“ saab mõlemad redaktsioonid (search-assist-7)

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10: „alusta“ küsimustiku kolme lahtise asjaga (plaan otsib juba vastatud küsimusi uuesti; „mis muutub“ küsimus ei saa kahe redaktsiooni lõike kõrvuti; perekonnaseaduse lõiguvalik). Lähtekoht: [päris vestluse küsimustik 04.10](../audits/rag-v2-live-questionnaire-2026-10-04.md), jaotised 3 ja 6, ning [ADR-075](adr-075-date-without-year-is-a-period.md) „Järgmine samm“.

**Mõõtmata.** Muudatus on kahe mudelijuhise tekstis ja serveri kehtivusreeglis; tõend on kohalikud testid. Need näitavad, et read on juhises ja et kontrollid tabavad salvestatud vigased plaanid ja valikud. **Kas mudel nende ridade järgi ka käitub, näitab ainult tasuline jooks**, mida pole tehtud (jaotis „Mõõtmine“).

## Mida kirjed näitasid

Loetud 04.10 pöördekirjetest (`docs/audits/evidence/live-questionnaire-2026-10-04.json`), mitte vastustest.

**1. Plaan otsis vastatud küsimusi uuesti.** Ühes vestluses küsiti järjest viis omavahel sidumata õigusküsimust (Q9–Q13).

| Pööre | Küsimus | Plaani päringud |
|---|---|---|
| Q10 | abivajavast lapsest teatamine | kolm päringut, kõik selle küsimuse kohta |
| Q11 | eestkoste ja toetatud otsustamine | toimetulekutoetuse arvestamine; abivajavast lapsest teatamine; eestkoste ja toetatud otsustamise erinevus |
| Q12 | täisealise puude raskusaste | toimetulekutoetuse arvutamine; abivajavast lapsest teatamine; puude raskusaste **koos** eestkoste ja toetatud otsustamisega |
| Q13 | hooldekodu kohatasu lastelt | toimetulekutoetuse arvutamine; abivajavast lapsest teatamine ja eestkoste; puude raskusaste **koos** hooldekodu kohatasu ja ülalpidamiskohustusega |

- Teistes küsimustiku vestlustes (omavalitsused, ajakiri, juhendid) plaan seda ei teinud. Miks just selles vestluses, kirjest ei selgu: plaan näeb ainult kasutaja sõnumeid ja iga plaan tehakse eraldi.
- Juhis ütles, et viimane sõnum on praegune palve ja varasemad on kontekst, ning „kui palvel on mitu osa, kata iga osa“. Seda, et varasemad küsimused on vastuse saanud, ütles ainult parandussõnumi rida ([ADR-072](adr-072-plan-reads-a-correction.md)).

**2. Eelvalik hoidis varasemate küsimuste lõike, ka puhta plaaniga.**

| Pööre | Küsimus | Eelvalik hoidis ka |
|---|---|---|
| Q10 | abivajavast lapsest teatamine | artikkel toimetulekutoetusest |
| Q11 | eestkoste | juhend abivajavast lapsest teatamise kohta, kaks toimetulekutoetuse allikat |
| Q13 | hooldekodu kohatasu | juhend abivajavast lapsest teatamise kohta, artikkel puude raskusastme tuvastamisest |
| Q22 | uuring puudega lastega peredest | MARAC-i juhend (kaks lõiku); plaan oli puhas |
| Q24 | hooldekodu tuleohutus | MARAC-i juhend; plaan oli puhas |

- Kandidaatide hulka tulevad varasemad teemad põhiotsingu kaudu: selle päringutekst sisaldab teadlikult ka varasemaid kasutajasõnumeid. Eelvaliku juhis ütles „kata palve iga osa“ ega öelnud, et varasemad küsimused on vastatud.

**3. „Mis muutub“ sai ainult uue redaktsiooni.** ADR-075 mõõdetud pöördes lubati otsingusse mõlemad Põhja-Sakala korra redaktsioonid, aga eelvalik hoidis kuus uue redaktsiooni lõiku ja mitte ühtki vanast. Eelvaliku juhis ütles: hoia küsitud päeval kehtivat redaktsiooni, teist lisa ainult võrdluse korral. Vastus kirjeldas muudetud sätteid ja ütles, et ei saa sõnastusi võrrelda.
- Lisaks: pärast muutuse päeva ei oleks vana redaktsioon enam üldse otsingus. Vana redaktsioon lõpeb 05.10; 6. oktoobrist alates on tänane õigus uus redaktsioon ja küsitud päev (06.10) samuti. Küsimus „mis muutus 6. oktoobril?“ ei saaks 10. oktoobril kunagi võrrelda.

**4. Perekonnaseaduse lõiguvalik (Q13, R13): põhjus on teadmata.** Puhtas vestluses (R13) olid plaani päringud õiged ja kandidaatide hulgas oli kaks perekonnaseaduse lõiku; eelvalik ei valinud kumbagi (valis kolm lõiku 36-st). Kirjes on kandidaatide kohta ainult pealkiri, seega ei ole teada, kas need kaks olid ülalpidamiskohustuse sätted (§ 96–97) või midagi muud. Üleriigilistele seadustele on eelvalikus kuus kohta, ühest aktist kuni kaks (R13: sotsiaalhoolekande seadus 2, perekonnaseadus 2, riigilõivuseadus 2).

## Otsus

### 1. Plaan: päringud ainult praeguse sõnumi jaoks

Otsinguplaani juhisesse üks rida, päringute reegli järel (`PLAN_ANSWERED_INSTRUCTIONS`, 126 tokenit):

> Earlier messages are context, not requests: every earlier question has had its answer. Write queries only for what the current message asks. When the current message continues an earlier one, write the queries for that request as the current message completes it: it continues one when it refers to it (it, that service, there, that person) or is a short reply that only adds a detail to it. Facts about the person that still apply are kept. Do not write a query for an earlier question the current message neither asks again nor continues, and do not add the subject of such a question to a query for the current one.

- **Jätk jääb jätkuks.** „Ja mis see maksab?“ viitab eelmisele; lühike vastus assistendi täpsustavale küsimusele („Tööealine.“) lisab eelmisele palvele asjaolu. Mõlemal juhul kirjutatakse päringud selle palve kohta.
- **Üldine:** rida ei nimeta ühtegi teemat, akti, inimest ega kohta.

### 2. Eelvalik: lõigud ainult praeguse sõnumi jaoks

Eelvaliku juhisesse sama reegel lõikude kohta, tagastamise reegli järel (`RERANK_ANSWERED_INSTRUCTIONS`, 97 tokenit):

> Earlier messages are context, not requests: every earlier question has had its answer. Keep passages only for what the current message asks, or for the earlier request it continues: it continues one when it refers to it (it, that service, there, that person) or is a short reply that only adds a detail to it. Facts about the person that still apply are kept in mind. A passage that answers an earlier question the current message neither asks again nor continues is not useful.

### 3. Eelvalik: „mis muutub“ hoiab sama sätet mõlemas redaktsioonis

Eelvaliku juhisesse üks rida redaktsioonide reegli järel (`RERANK_CHANGE_INSTRUCTIONS`, 64 tokenit):

> When the request asks what changes, changed or will change in an act on or from a date, it compares the version in force before that date with the one in force from it: for the provisions that differ keep the passage of each of the two versions (the same provision in both), not only the newer one.

### 4. Kehtivus: küsitud päev võtab kaasa eelmise päeva (`legal-validity-2`)

Üksik küsitud päev lubab otsingusse ka redaktsiooni, mis kehtis päev varem. Kui see päev on muutuse päev, on see just see redaktsioon, mille uus asendas; muul juhul on eelmisel päeval sama redaktsioon ja midagi ei lisandu. Vahemikku ei laiendata.

- Periood kirjutatakse kehtivuse ulatusse nii, nagu teda kohaldatakse (05.10–06.10), et mudelile näidatav ulatus vastaks tõenditele.
- Tagajärg ka mujal: kahe päeva võrdlus toob kaasa kummagi päeva eelse redaktsiooni, kui redaktsioon vahetus täpselt sel päeval. See on kuni kaks lisaredaktsiooni kandidaatide hulgas; valib eelvalik.
- See on serveri reegel, mitte kavatsuse tuvastamine: sõnu „muutub“ ega „võrdle“ server ei loe.

### 5. Kirje ja hindaja

- **Pöördekirje hoiab iga kandidaadi kohta rohkem kui pealkirja:** redaktsiooni alguspäev (õigusaktil) ja loetud teksti esimesed 160 märki, kus on lõigu pealkirjatee (`searchAssist.rerank.candidates[].valid_from`, `.lead`). Mudelile saadetav ei muutu. Sellest on näha, millised perekonnaseaduse lõigud kandidaadid olid.
- **Hindaja uued kontrollid** (`lib/rag-v2/pilot/conversation-eval.js`):
  - `selected_must_not` (otsing): ükski eelvaliku hoitud lõik ei ole allikast, mille pealkiri mustrile vastab;
  - `found_versions_from` (otsing) ja `cited_versions_from` (vastus): akti nimetatud alguspäevaga redaktsioon on leitud allikate või viidatute hulgas. Loeb ka omavalitsuse akti kehtivust; pealkirja jagavaid redaktsioone eristab päev.
- Hindaja raport näitab kandidaatide juures uusi välju.

### Mida ei muudetud

Plaani ja eelvaliku väljund, kohtade lugemine, põhiotsing (päringutekst sisaldab endiselt varasemaid sõnumeid), üleriigiliste seaduste kohtade arv eelvalikus, dialoogi juhis 24 ja vastuse juhis 12. Perekonnaseaduse lõiguvaliku jaoks ei muudetud midagi peale kirje: põhjus tuleb enne teada saada.

### Teostus

- `lib/rag-v2/pilot/search-assist.js`: versioon 7, kolm rida, `candidateRecord`; versioonid 4–6 jäävad loetavaks. Ilma nende kolme reata (ja ADR-072 reata) on mõlemad juhised täht-tähelt search-assist-5 omad (räsi test).
- `lib/rag-v2/search/legal-validity.js`: `legal-validity-2`.
- `lib/rag-v2/pilot/service.js`, `lib/rag-v2/pilot/conversation-eval.js`, `scripts/rag-v2-conversation-eval.mjs`.
- Reliis uuendab vestlusplaani ise; plaan saab otsinguplaani versiooni 7.

## Kontrollid

Kataloogid, kirjutatud enne ühtegi jooksu:

- `tests/evaluation/dialogue/scenarios-answered-questions-1.json`: sama viie küsimusega vestlus. Iga hilisem pööre kontrollib plaani päringuid ja eelvaliku hoitud lõike; viimane pööre nõuab lisaks, et perekonnaseadus on leitud ja viidatud.
- `tests/evaluation/dialogue/scenarios-version-change-1.json`: „Mis muutub Põhja-Sakala valla sotsiaalabi korras alates 6. oktoobrist?“; nõuab mõlemat redaktsiooni leitute ja viidatute hulgas.

Kohalikud testid:

| Test | Mida hoiab |
|---|---|
| `rag-v2-search-assist.test.mjs` | kolm rida on juhises õiges kohas ja üldised; plaani ja eelvaliku sisend on muutmata; kandidaadi kirje |
| sama, salvestatud plaanid | Q11, Q12 ja Q13 plaan kukuvad kataloogi kontrollis läbi (2, 3 ja 4 mustrit); Q10 ja R13 plaan läbivad |
| sama, salvestatud valikud | Q10, Q11, Q12 ja Q13 valik kukuvad läbi; Q22 ja Q24 valik (puhas plaan, MARAC-i juhend) samuti; R13 valik läbib |
| `rag-v2-legal-scope.test.mjs` | küsitud päev võtab eelmise päeva (kuu, aasta ja liigpäeva piiril); pärast muutuse päeva jääb asendatud redaktsioon otsingusse; vahemik ei laiene |
| sama, redaktsioonide kontroll | ADR-075 mõõdetud pööre (ainult uus redaktsioon) kukub läbi; mõlema redaktsiooniga pööre läbib; teine akt ei asenda küsitud akti redaktsiooni |
| `rag-v2-answer-prompt.test.mjs` | ilma uute ridadeta on juhised search-assist-5 omad |

Täiskomplekt: 650 testi, 631 läbis, 19 vahele jäetud, 0 ebaõnnestus.

## Piirid

- **Mudeli käitumine on mõõtmata.** Kohalik test ei näita, kas plaan ja eelvalik uusi ridu järgivad.
- **Jätku oht.** Reegel „ainult praegune sõnum“ võib kahjustada jätkuküsimust või vastust täpsustavale küsimusele, kui mudel loeb selle uueks palveks. Rida ütleb jätku kohta selgelt, aga see on just see, mida tuleb mõõta olemasoleva jätkukataloogiga.
- **Plaan ei näe assistendi vastuseid.** Kas lühike sõnum on vastus täpsustavale küsimusele, peab plaan järeldama kasutaja sõnumitest.
- **Põhiotsing toob varasemad teemad endiselt kandidaatide hulka.** Parandus on eelvalikus; kui eelvalik on kättesaamatu, jääb ühendatud järjestus.
- **Pealkirjamuster on jäme.** `selected_must_not` ei näe varasema teema lõiku aktis, mis teenib mitut teemat (sotsiaalhoolekande seadus).
- **„Mis muutub“ sõltub eelvaliku võrdlusest.** Eelvalik peab ise leidma, millised sätted kahes redaktsioonis erinevad; kandidaate on 36 ja valituid kuni üheksa, seega paare mahub kuni neli. Kui sellest ei piisa, on järgmine samm serveri reegel, mis lisab muudetud sätte vana redaktsiooni vaste ise.
- **Perekonnaseaduse lõiguvalik on parandamata.** Uus kirje näitab järgmisel jooksul, millised lõigud kandidaadid olid; alles siis saab otsustada, kas viga on otsingus (õiged sätted ei jõua kahe koha hulka) või eelvalikus.

## Mõõtmine

Tegemata; vajab omaniku luba. Ettepanek, kõik töötavalt väljalaskelt pärast avaldamist:

| Kataloog | Pöördeid | Hinnang | Mida näitab |
|---|---:|---:|---|
| `scenarios-answered-questions-1` | 5 | 0,03 USD | plaan ja eelvalik praeguse sõnumi jaoks; perekonnaseaduse kandidaadid |
| `scenarios-version-change-1` | 1 | 0,006 USD | mõlemad redaktsioonid |
| `scenarios-question-region-1`, vestlus `asks-another-municipality` | 4 | 0,022 USD | jätkuküsimus töötab endiselt |

Kokku 10 pööret, umbes 0,06 USD plaanihindades.
