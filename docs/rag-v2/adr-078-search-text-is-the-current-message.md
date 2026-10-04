# ADR-078 — Otsingutekst on praegune sõnum, kui plaan andis päringud (search-6)

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Lähtekoht: [ADR-077](adr-077-current-message-only-and-both-versions.md) mõõtmine ja „Järgmine samm“ (esimene võimalus) ning Codexi ülevaatus #354 ja #356 kohta.

**Mõõdetud pärast avaldamist** (jaotis „Mõõtmine“): 10 pööret, 0,0532 USD. Jätkuküsimus töötab (4/4), viie küsimuse vestluses läbis 3 pööret viiest (enne 2). **Oletus, et perekonnaseaduse valed kandidaadid tulid varasematest sõnumitest, ei leidnud kinnitust:** ka ainult praeguse sõnumiga otsides olid kandidaadid eestkoste sätted. Muudatus läks tootmisse kohalike testidega, sh andmebaasiga test, mis käivitab teenuse päris hoidlaga.

## Probleem

- Põhiotsingu päringutekst ühendas aktiivse vestluskonteksti kõik kasutajasõnumid (`buildDialogueQuery`). Sama tekst läheb sõnaotsingusse koos plaani päringutega ja vektorotsingusse omaette; samade tekstidega arvutatakse ka üleriigiliste seaduste kuus lisakohta eelvalikus.
- ADR-077 mõõtmises (viies pööre, „Kas hooldekodu kohatasu võib nõuda lastelt?“) läksid need kuus kohta varasemate küsimuste sätetele: perekonnaseaduse § 192 ja § 216 (eestkoste), riigilõivuseadus, sotsiaalhoolekande seaduse lapsehoiuteenus. Ülalpidamiskohustuse sätted ei olnud kandidaadid. Plaani päringud olid selles pöördes õiged.
- See sobib sellega, et varasemate küsimuste sõnavara osaleb järjestamises. Tõendatud see ei ole: sama pööret ilma varasemate sõnumiteta pole võrreldud. Mõõtmine pärast seda muudatust on see võrdlus.

## Otsus

**Kui plaan andis vähemalt ühe päringu, on otsingutekst praegune sõnum.** Mida varasemad sõnumid palvele lisavad, on plaani päringutes (ADR-077 mõõtmine: jätkuküsimus „Ja mis see maksab?“ sai päringu „Maardu isikliku abistaja teenuse hind“).

- **Mis jääb samaks:** vestluskonteksti sõnumid (`scopeTurns`), eelmine olek, inimene, kohad ja kuupäevad. Need otsustavad, kelle palve see on ja kus, mitte mida otsitakse. Eelvalik ja vastuse mudel näevad endiselt kõiki sõnumeid.
- **Valitud vastuseplokk** jääb otsinguteksti osaks nagu enne (kasutaja valis selle ise).
- **Ilma plaani päringuteta jääb vana tekst:** plaan ebaõnnestus; plaan ei kirjutanud ühtegi päringut (pelk parandus, ADR-072); tervitus (plaani ei tehta). Nii ei jää lühike sõnum ilma kontekstita, kui plaan seda ei kandnud.
- **Plaani päring, mis kordab praegust sõnumit sõna-sõnalt,** jäetakse välja (seda otsitaks kaks korda).
- Kirjes on näha, kumba teksti otsiti: `query.textBasis: "current_message"`; ilma selle väljata on tekst vestluskonteksti sõnumite ühend.
- Versioon `m4-user-scope-search-6`; reliis uuendab vestlusplaani ise. Vektori vahemälu võti arvutatakse kitsendatud tekstist samamoodi kui enne.

### Mida see ei lahenda

- **Plaan võib ise vastatud küsimusi uuesti otsida** (ADR-077 mõõtmine, kolmas pööre). Need päringud tulevad endiselt otsingusse; eelvalik neid lõike mõõtmises ei hoidnud.
- **Esimese sõnumi puhul ei muutu midagi.** Toimetulekupiiri summa puudumine esimeses pöördes (riigieelarve seaduse summaga lõik ei olnud kandidaat) on eraldi küsimus.
- **Plaani kvaliteedist sõltub nüüd rohkem.** Kui plaan annab päringud, aga jätab jätkuküsimuse konteksti välja, ei kanna seda enam ka põhitekst.

## Teostus

- `lib/rag-v2/pilot/dialogue.js`: `currentMessageQuery(query, accepted, config, assistant)`; `buildDialogueQuery` on muutmata.
- `lib/rag-v2/pilot/service.js`: pärast plaani, enne vektori vahemälu ja otsingut.
- Plaani ja eelvaliku juhised, dialoogi juhis ja otsingu profiil on muutmata.

## Kontrollid

- `tests/rag-v2-dialogue.test.mjs`: kitsendatud tekst, räsi ja vahemälu võti; ülejäänud päring on sama; üks sõnum ei muutu; valitud plokk jääb.
- `tests/rag-v2-dialogue-store.test.mjs` (päris hoidla, mudelikutsed asendatud): esimene sõnum; hilisem sõnum plaani päringutega (praegune sõnum, elukoht ja kontekst alles); praegust sõnumit kordav päring jäetakse välja; päringuteta plaan ja ebaõnnestunud plaan (vana tekst). 24 testi läbis selles masinas.
- Täiskomplekt: 653 testi, 634 läbis, 19 vahele jäetud, 0 ebaõnnestus.
- Kaks integratsioonitesti (`rag-v2-unified.integration`, `rag-v2-dialogue-scenarios.integration`) ei käi selles masinas: sõnavormide teenust (EstNLTK) siin ei ole (`morphology_unavailable`).

## Mõõtmine (04.10.2026, pärast avaldamist)

Omanik 04.10 õhtul: „võid teha teste, raha pole probleem“. Samad kolm kataloogi kui ADR-077 mõõtmisel, töötavalt väljalaskelt `5b775d8f`. Kulu 0,0532 USD plaanihindades. [Tõendifail](../audits/evidence/search-6-measured-2026-10-04.json).

| Kataloog | Pöördeid | Läbis nüüd | Läbis enne (ADR-077) |
|---|---:|---:|---:|
| Jätkuküsimus (Maardu vestlus) | 4 | 4 | 4 |
| Mis muutub | 1 | 1 | 1 |
| Viis sidumata küsimust | 5 | 3 | 2 |

- **Otsingutekst pöördekirjetes:** kõik seitse hilisemat pööret otsisid praeguse sõnumiga (`textBasis: current_message`), kolm esimest sõnumit oma ühe sõnumiga.
- **Jätkuküsimus jäi terveks.** „Ja mis see maksab?“ sai päringud Maardu teenuse tasu kohta ja Maardu korra § 9.
- **Neljas pööre (puude raskusaste) läbis:** seadusest valiti § 2³ ja vastus viitab sellele. Eelmises jooksus valiti § 2⁴ ja vastus viitas ainult uuringule.
- **Viies pööre (hooldekodu kohatasu) ei läbinud: varasemate sõnumite eemaldamisest ei piisanud.** Otsingutekst oli ainult praegune sõnum ja plaani kolm päringut olid õiged, aga perekonnaseaduse kaks kandidaati olid § 191 ja § 192 (alaealise eestkoste kulud ja tasu). Ülalpidamiskohustuse sätted (§ 96–97) ei olnud kandidaadid. See näitab, et viga ei kadunud koos varasemate sõnumitega; see ei välista, et need varasemas jooksus kaasa mõjusid (võrdluses muutusid ka plaani päringud; Codexi ülevaatus #357–#364).
- **Kolmas pööre:** plaan kirjutas kolmandat jooksu järjest sama plaani: üks päring oma küsimuse ja kaks varasemate kohta. Pöörded, mis vajasid ise kaht või kolme päringut (2., 4., 5.), olid puhtad. See viitab, et plaan täidab loetelu, kui praegune küsimus vajab ainult ühte päringut.
- **Esimene pööre:** summat ei tulnud; riigieelarve seaduse kandidaat oli jälle § 2 esimene lõik.
- **Mis muutub:** eelvalik hoidis seekord §-d 1, 3 ja 6 mõlemas redaktsioonis; vastus nimetab §-de 3 ja 6 muutunud sõnastust ega esita muutumata reeglit uuena.

Üks jooks kataloogi kohta. Järgmine samm on [ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md).
