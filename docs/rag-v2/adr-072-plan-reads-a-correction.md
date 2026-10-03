# ADR-072 — Otsinguplaan: parandus on selle inimese kohta, kelle asjaolu parandatakse (search-assist-6)

03.10.2026. Teostus Claude Opus 5.5. Omanik 03.10: „Juhise 24 jätame alles. Järgmisena paranda otsinguplaani parandussõnumi käsitlust: parandus peab seostuma nimetatud inimesega ning juba vastatud küsimus ei tohi automaatselt muutuda uueks ülesandeks. Kasuta mõlema salvestatud vigase plaani põhjal kohalikke regressioonikontrolle; kontroll peab püüdma ka õige vallaga, kuid vale teemaga otsingu. Lahendus olgu üldine, ilma nimede või valdade eranditeta. Tasulisi jookse ei tee.“ Järgib [ADR-071](adr-071-bare-correction-and-prior-claim.md).

**Mudeliga mõõtmata.** Selle muudatuse kohta ei ole tehtud ühtegi tasulist jooksu. Kohalikud testid näitavad, et uus rida on juhises ja et kontrollid püüavad salvestatud vigased plaanid; need ei näita, et mudel uut rida järgib.

## Probleem

- Iga pöörde alguses kirjutab mudel otsinguplaani: kuni kolm otsingupäringut ja inimese, kelle vajadusest sõnum räägib. Plaan saab kasutaja sõnumite tekstid järjest; viimane on praegune palve.
- Plaani juhis ei öelnud midagi sõnumi kohta, mis ainult parandab varem öeldud asjaolu, ega selle kohta, et varasemad küsimused on juba vastuse saanud.
- 03.10 neljas jooksus sai sama paranduspööre („Vabandust, ema pension on hoopis 700 eurot.“ pärast isa kohta käinud ja vastatud küsimust) neli plaani. Kolm neist olid vigased, kahte moodi:

| Jooks | Plaani inimene | Otsingu vald | Plaani päringud | Viga |
|---|---|---|---|---|
| Üle piiri, juhis 23 | ema | Kose | koduteenuse taotluse menetlemise tähtaeg; taotluse otsustamise tähtaeg; abivajaduse hindamise tähtaeg | õige vald, vale teema: vastatud küsimus otsiti uuesti, nüüd ema kohta |
| Üle piiri, juhis 24 | ema | Kose | sotsiaalteenuse taotluse otsustamise tähtaeg; otsuse tegemise tähtaeg | sama |
| Teema sees, juhis 24 | isa | Harku | toimetulekutoetus, pension, võlad; taotluse menetlemise tähtaeg | vale inimene: parandus loeti isa pöördeks |
| Teema sees, juhis 23 | ema | Kose | (päringuid ei ole) | viga ei ole |

- Tagajärg: tõendid tulevad vastatud küsimuse või teise inimese teema kohta. Juhisega 23 vastas vastus selle peale eelmisele küsimusele uuesti; juhisega 24 jättis vastus need tõendid kasutamata või kaldus paranduse tagajärgede lauses teise inimese teemale.

## Otsus

Otsinguplaani juhis `rag-v2/search-assist-6`: üks rida inimese reegli järel. Ülejäänud juhis ja plaani väljund on search-assist-5 omad täht-tähelt.

> When the current message only corrects or updates a fact the user gave earlier (an amount, a date, a circumstance) and asks nothing new, it is about the person that fact belongs to: person is that person, also when the message before it was about someone else. Such a message does not reopen an earlier question: earlier questions have had their answers, so write queries only for what the corrected fact changes for that person, or none when nothing needs looking up; never for an earlier question about another person or about a matter the fact does not change.

- **Kelle kohta:** parandus on selle inimese kohta, kelle asjaolu parandatakse, ka siis, kui eelmine sõnum käis kellegi teise kohta.
- **Mida otsida:** ainult seda, mida parandatud asjaolu selle inimese jaoks muudab, või mitte midagi. Varasem küsimus ei muutu parandusest uueks ülesandeks.
- **Üldine:** rida ei nimeta ühtegi inimest, sugulast, valda, summat ega teemat.
- **Kitsas:** reegel puudutab ainult sõnumit, mis parandab või uuendab varem öeldud asjaolu ja ei küsi midagi uut. Olukorda kirjeldav sõnum, küsimus ja parandus koos uue küsimusega käivad endiste reeglite järgi.
- Juhis kasvab 113 tokeni võrra pöörde kohta.

### Teostus

- `lib/rag-v2/pilot/search-assist.js`: `PLAN_CORRECTION_INSTRUCTIONS`, versioon 6; versioonid 4 ja 5 jäävad loetavaks.
- Plaani väljundi skeem, kohtade lugemine, eelvalik, põhiotsing, olek ja dialoogi juhis 24 on muutmata.
- Reliis uuendab vestlusplaani ise; plaan saab versiooni 6.

## Kontrollid

- **Hindaja uus kontroll `plan_queries_must_not`** (`lib/rag-v2/pilot/conversation-eval.js`): ükski plaani päring ei tohi mustrile vastata. See on otsingu viga, mitte oleku viga, ja loeb plaani päringuid, mitte vastust. Plaani inimest kontrollib olemasolev `person`.
- **Kolme kataloogi paranduspööre** (üle piiri, teema sees, kohalik juht „pelk parandus“) kontrollib nüüd ühtemoodi:
  - plaani inimene on ema;
  - ükski päring ei küsi uuesti isa taotluse kohta käinud küsimust (tähtaeg, menetlemine, otsustamine);
  - ükski päring ei ole isa teema kohta (toimetulekutoetus, võlad).
- Teine ja kolmas kontroll kukuvad läbi ka siis, kui otsing tehti õiges vallas.
- Kohalik juht „parandus koos uue küsimusega“ kontrollib sama; „kontrollimispalve“ kontrollib, et plaani inimene on isa.

**Kohalik regressioonitest** (`tests/rag-v2-conversation-eval.test.mjs`) hoiab 03.10 nelja salvestatud plaani sõna-sõnalt. Olek ja vastus on testis kõigil juhtudel õiged, erineb ainult plaan:

| Salvestatud plaan | Tulemus | Mis ei läbi |
|---|---|---|
| Üle piiri, juhis 23 (ema, Kose, tähtaja päringud) | otsingu viga | ainult päringute kontroll; vald ja inimene läbivad |
| Üle piiri, juhis 24 (sama liiki) | otsingu viga | ainult päringute kontroll |
| Teema sees, juhis 24 (isa, Harku) | otsingu viga | vald, inimene, mõlemad päringute kontrollid |
| Teema sees, juhis 23 (ema, päringuteta) | läbib | — |

Lisaks kontrollib test, et läbib plaan, mis otsib seda, mida parandatud summa ema jaoks muudab, ja et õiges vallas tehtud otsing isa teemal ei läbi.

## Testid

- `tests/rag-v2-search-assist.test.mjs`: uue rea sisu, koht ja üldisus; plaani sisend ja väljundi skeem on samad.
- `tests/rag-v2-answer-prompt.test.mjs`: ilma uue reata on plaani ja eelvaliku juhis search-assist-5 tekst (räsi).
- `tests/rag-v2-conversation-eval.test.mjs`: uus kontroll, kataloogide võrdsus, salvestatud plaanid.
- Ühiktestid 542 läbis, 19 vahele jäetud; kohalik andmebaasitest `rag-v2-dialogue-store` 21/21.

## Mõõtmata ja piirid

- **Mudeli käitumine uue reaga on mõõtmata.** Kas plaan loeb paranduse nüüd õige inimese omaks ja jätab vastatud küsimuse otsimata, selgub alles jooksust.
- Mõõtmata on ka, kas uus rida muudab teiste sõnumite plaane. Rida on sõnastatud kitsalt, aga seda kitsust ei ole mudeliga kontrollitud.
- Mõõtmine oleks kaks kahe inimese kataloogi (13 pööret, umbes 0,08 USD plaani hindade järgi). Seda ei tehtud; see vajab omaniku luba.
- **Põhiotsing on muutmata.** Otsingutekst on endiselt teema kõik kasutaja sõnumid kokku ja eelvaliku mudel loeb samuti kõiki sõnumeid. Vastatud küsimuse sõnad osalevad seetõttu otsingus ka siis, kui plaan seda küsimust ei otsi.
- Kontrollide mustrid on selle stsenaariumi omad (tähtaeg, toimetulekutoetus, võlad); üldine on juhise reegel, mitte mustrid.
- Üleandmine teemapiiril on muutmata.

## Kasutuselevõtt ja tagasi

- Ühendamisel uuendab reliis plaani otsinguplaaniga search-assist-6.
- Tagasi saab muudatuse tagasipööramisega; plaan uueneb siis versiooniga 5.
