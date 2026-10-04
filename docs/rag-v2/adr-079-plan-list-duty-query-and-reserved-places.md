# ADR-079 — Plaan ei täida loetelu, kohustus saab oma päringu ja iga päringu parim seaduselõik saab koha (search-assist-8)

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Lähtekoht: [ADR-078](adr-078-search-text-is-the-current-message.md) mõõtmine.

**Mõõtmata selle kirjutamise hetkel.** Tõend on kohalikud testid. Mõõtmine tehakse pärast avaldamist ja tulemus lisatakse jaotisesse „Mõõtmine“.

## Mida mõõtmised näitasid

Kolm jooksu samade viie sidumata õigusküsimusega (hommikune küsimustik, ADR-077, ADR-078):

- **Kolmas pööre sai igas jooksus sama plaani:** üks päring oma küsimuse („eestkoste ja toetatud otsustamise erinevus“) ja kaks varasemate küsimuste kohta. Pöörded, mille küsimus vajas ise kaht või kolme päringut, olid kahes viimases jooksus puhtad. Juhis ütleb „kirjuta kuni kolm päringut“; plaan täitis loetelu.
- **Viies pööre („Kas hooldekodu kohatasu võib nõuda lastelt?“) ei saanud kordagi perekonnaseaduse ülalpidamise sätteid kandidaatideks.** ADR-078 järel oli otsingutekst ainult praegune sõnum ja plaani päringud õiged, aga seaduse kaks kohta läksid §-dele 191 ja 192 (alaealise eestkoste kulud ja tasu).
  - Plaani päringud sidusid kohustuse teenusega: „üldhooldusteenuse kohatasu täisealiste laste ülalpidamiskohustus“. Sõnad „tasu“, „kulud“, „lapsed“ sobivad eestkoste tasu sätetega; § 96 („Ülalpidamist on kohustatud andma täisealised esimese ja teise astme ülenejad ja alanejad sugulased“) ei nimeta hooldekodu, tasu ega lapsi.
  - Üleriigiliste seaduste kuus kohta arvutati kõigi otsingutekstide ühise järjestuse järgi, ühest aktist kuni kaks. Üks täpne päring jääb seal teiste sõnade varju.

## Otsus

### 1. Plaan ei täida loetelu

Plaani rea „varasemad küsimused on vastatud“ (ADR-077) lõppu üks lause:

> One query is enough when the current message asks one thing: never fill the list with queries for earlier questions.

### 2. Kohustus saab oma päringu

Plaani juhisesse üks rida kulude reegli järel (`PLAN_DUTY_INSTRUCTIONS`):

> When the request asks whether a person must do or pay something, or can be required to, make one query for that duty itself in the terms of the law that sets it (who owes what to whom, and on what conditions), without the name of the service or the place.

- Üldine: rida ei nimeta ühtegi kohustust, teenust, akti ega sugulast.
- Eeskuju on olemasolev kulude reegel (üks päring selle kohta, kuidas summa kujuneb).

### 3. Iga plaani päringu lähim seaduselõik saab koha

Üleriigiliste seaduste kuue koha hulka võetakse kõigepealt iga plaani päringu enda lähim seaduselõik (päringu vektori järgi, üks päringu kohta); ülejäänud kohad täidab senine ühine järjestus. Piirid jäävad: kokku kuus, ühest aktist kuni kaks.

- `NATIONAL_LAW_RESERVE` saab välja `perQuery: 1`; üldine otsing (`poolReserve.perQuery`) toetab väärtusi 1–3.
- Ilma plaani päringuteta ei muutu midagi.
- Koos teise punktiga: kohustuse päring on kirjutatud seaduse sõnadega ja tema lähim lõik saab koha ka siis, kui küsimuse teised sõnad seda ei toeta.

### Mida ei muudetud

Eelvaliku juhis, dialoogi ja vastuse juhis, otsinguprofiil, kohtade koguarv. Plaani väljund ja sisend on samad.

### Teostus

- `lib/rag-v2/pilot/search-assist.js`: versioon 8; versioonid 4–7 jäävad loetavaks. Ilma lisatud ridadeta on juhised täht-tähelt search-assist-5 omad (räsi test).
- `lib/rag-v2/search/retrieval.js`, `ranking.js`, `unified.js`: `perQuery`.
- Reliis uuendab vestlusplaani ise.

## Kontrollid

- `tests/rag-v2-search-assist.test.mjs`: uus lause ja uus rida on juhises õiges kohas ja üldised; plaani sisend ja väljund muutmata.
- `tests/rag-v2-pool-reserve.test.mjs`: päringu enda lähim lõik tuleb esimesena, ühine järjestus täidab ülejäänu; suurus ja ühe akti osa peavad; ilma päringuta nagu enne; väärtuse kontroll.
- `tests/rag-v2-answer-prompt.test.mjs`: ilma lisatud ridadeta on juhised search-assist-5 omad.
- Täiskomplekt: 655 testi, 636 läbis, 19 vahele jäetud, 0 ebaõnnestus.

## Piirid

- **Mudeli käitumine on mõõtmata.** Kas plaan kirjutab kohustuse päringu seaduse sõnadega ja kas selle lähim lõik on õige säte, näitab ainult jooks.
- **Koht ei ole valik.** Kui õige säte on kandidaat, peab eelvalik ta veel valima ja vastus talle viitama.
- **Kuue koha sisse mahub vähem ühise järjestuse lõike,** kui plaanil on kolm päringut (kuni kolm kohta lähevad päringute lähimatele).
- **Toimetulekupiiri summa** (esimene pööre) seda muudatust ei vaja ega saa: riigieelarve seaduse summaga lõik ei ole kandidaat, sest § 2 on lõigatud pikkuse järgi. See on eraldi korpuse muudatus.

## Mõõtmine

Tegemata selle kirjutamise hetkel; lisatakse pärast jooksu.
