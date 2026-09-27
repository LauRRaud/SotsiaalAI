# ADR-031 — Allika tase ja vastuse terviklikkus

27.09.2026. Teostus Claude Opus 5.5. Järgib [vastuvõtutesti 27.09.2026](../audits/rag-v2-chat-acceptance-2026-09-27.md) parandusi 2, 4 ja 6.

Harud:
- `claude/rag-v2-answer-quality`: neli commit'i `main` `40ddeed4` peal (alus on sisult sama; kohalik #195 commit `baaaf18f2`). Sisaldab kõiki allpool kirjeldatud muudatusi, ka `search-assist-3` katset. Push'imata.
- `claude/rag-v2-answer-completeness`: PR #196, commit `0ca3376ff`. Sama ilma `search-assist-3`-ta: `m4-grounded-dialogue-9`, kriisiriba ja allikavaate lingid.
- `claude/rag-v2-national-laws` (`828e30770`): korpuse v26 kaks seadust registris. Ainult andmed.
- `claude/rag-v2-answer-voice`: PR #197, vastuse oma hääl (`m4-grounded-answer-11`, `m4-grounded-dialogue-10`), vt jaotist 6.

## Probleem

Vastuvõtutest (71 küsimust, 0 täiesti valet vastust) leidis kolm selle ADR-i puudutavat vealiiki.

1. **Vastus kaotab tingimuse (aruande 3.1, parandus 2).**
   - B4 jättis välja omavalitsuse hoolduskulu piirmäära võimaluse.
   - G11 jättis välja omavalitsuse kohustuse kaaluda maksevõimet. Täpsustusküsimus eeldas, et loeb hooldekodu asukoht.
   - B9 tegi kahest kohalikust 30-päevasest näitest väite „sõltub omavalitsusest“.
   - C9 andis riigi 95% osaluse ilma arvutusaluseta.
   - E1.2 piirangute lõigus oli viiteta elukohanõue.
2. **Vale allika tase (3.4, parandus 4).** Üldise õigusküsimuse juurde tuli 2023 audit (B1, F4) või juhuslike omavalitsuste korrad (B6, B8, B9). B10 ei saanud Lastekaitseseadust.
3. **Kriisiriba ja lingid (parandus 6).** Kriisiriba oli hele tekst poolläbipaistval taustal vestluse peal. Allikas sisaldas teenuse- või vormilehe aadressi, aga vastus palus lehte ise otsida.

Allika taseme veal oli kaks põhjust:
- Korpuses oli enne v26 ainult 5 riiklikku akti ja 54 omavalitsuse sotsiaalhoolekande korda. Sotsiaalhoolekande seadus oli ainult `Andmebaasi/taastatud_allikad` kaustas, importimata. Haldusmenetluse seadus puudus.
- Valiku (rerank) lõigul olid ainult `id`, pealkiri, aasta ja tekst. Valija ei näinud, kas tekst on riigi seadus, ühe omavalitsuse määrus või ajakirjaartikkel, ega seda, kas see kehtib.

## Otsus

### 1. Korpus v26: riiklikud seadused (tehtud, aktiivne)

See oli kõige suurem paranemine. Muudatus on serveris aktiivne:
- **Sotsiaalhoolekande seadus (SHS),** RT 130062026065, konsolideeritud tekst, kehtib 01.10.2026–30.11.2026. 12.06–30.09 tekst erineb ainult eriolukorra ja sõjaaja sätete ning ühe lapse juhtumiplaani lõike poolest. Üks versioon hoiab seaduse korpuses ühekordsena. 295 tükki.
- **Haldusmenetluse seadus (HMS),** RT 106072023031, kehtib 01.01.2024–31.12.2026. 113 tükki.
- 408 uut embedding-sisendit, 0,024 USD. Ülejäänud 29 145 sisendit võeti v25b ostust.
- Indeks `search_generation_10b4ff…` on aktiivne 27.09.2026 kell 09:41: 5998 dokumenti, 29 591 ühikut.

Ostu, indeksi ja vestlusplaani ümberehituse käik on [runbookis](runbook-corpus-increment.md). Vestluse otsingu alus on [ADR-030](adr-030-chat-retrieval-at-corpus-scale.md).

### 2. Otsinguabi `rag-v2/search-assist-3` (katse, tootmisse ei läinud)

**Lõigu päritolu.** `passageSource(fields, journal)` (`lib/rag-v2/search/retrieval.js`) lisab igale valikulõigule deklareeritud dokumendiväljadest:
- `area`: `regions` väärtused, alakriipsud tühikuks (nt `kohtla jarve linn`). Välja puudumine tähendab, et tekst pole ühe omavalitsuse oma.
- `valid`: `valid_from` ja `valid_to`; `to` on `'open'`, kui lõppu pole (`open_end`).
- `journal: true` ajakirjaartiklil (`source.journal` ühikurealt, muidu `journal_title` või `source_type` `journal_article`).

Välju ei tuletata dokumendi nimest ega mudelist.

**Valiku juhis** (`RERANK_INSTRUCTIONS`, `lib/rag-v2/pilot/search-assist.js`):
- Õiguste, tingimuste, summade, tähtaegade ja menetluse üldküsimuses jäävad riigi õigusaktid ja riiklik ametlik juhis.
- Omavalitsuse määrus jääb, kui kasutaja nimetas selle omavalitsuse või varasemad sõnumid paigutavad inimese sinna. Muidu ainult siis, kui riiklik tekst punkti ei kata.
- Nimetatud omavalitsuse korral jäävad selle enda tekstid koos riiklike reeglitega, mitte teiste omavalitsuste tekstid.
- Artiklid ja aruanded on praktika, kogemuse, tausta ja ajaloo jaoks. Reegliküsimuses ainult siis, kui õigus- või ametlikku teksti pole.
- Kehtiv tekst on eelistatud; sama sisu korral uuem.

**Päringuplaan** (`PLAN_INSTRUCTIONS`): õiguse, kohustuse, tingimuse, summa või menetluse küsimuses on üks päring seda reguleeriva seaduse sõnastuses (akti nimi ja terminid). Nimetatud omavalitsus jääb päringusse.

`planLanguage` tunneb keeleetappi nii -2 kui ka -3 plaanis (`LANGUAGE_VERSIONS`).

Muutmata: kandidaatide hulk 30 (`RERANK_POOL`), valikus kuni 9, plaanis kuni 3 päringut, mõlema kutse `reasoning: low`. Valik ei saa tänast kuupäeva: sisend on ainult `{ messages, passages }`.

### 3. Vastusjuhis `m4-grounded-dialogue-9`

`COMPLETENESS_INSTRUCTIONS` (`lib/rag-v2/pilot/dialogue.js`) lisatakse `dialogueRequest`-is vestlusjuhise lõppu.
- **Arv koos tingimustega.** Summa, protsendi, osa, määra, piiri, tähtaja või tingimuse juures on samas plokis ja samadest viidatud väljavõtetest:
  - millest see arvutatakse;
  - ülempiir;
  - periood või kuupäev;
  - kes otsustab;
  - erandid, alternatiivid või kohustus inimese olukorda kaaluda.

  Kui protsendi või osa alust väljavõtted ei anna, öeldakse see piirangutes.
- **Kohalik reegel on kohalik.** Öeldakse, kelle reegel see on. Ühe või mõne omavalitsuse reegel ei tõenda riigi reeglit ega seda, et reegel omavalitsuseti erineb. Üldküsimuses eelistatakse tõendites olevaid riiklikke õigustekste ja juhiseid.
- **Piirangud ja täpsustus ei lisa fakte.** Neis ei nimetata nõuet, tingimust, tähtaega, summat, elukoha- või registreerimisreeglit, vastutavat asutust ega reegli kuupäeva, mida ükski viidatud plokk ei ütle. Allika kuupäeva võib nimetada ainult selle allika kuupäevana.
- **Täpsustusküsimus** küsib inimese asjaolu, mis on tõendite järgi otsustav. See ei eelda asutust, omavalitsust ega reeglit, mida tõendid ei nimeta.
- **`ESTONIAN_IMPERATIVE`** (ainult eesti keeles): „sina“ vorm kehtib ka käskivas kõneviisis (alusta, küsi, ära osta; mitte alustage, küsige, ärge ostke), kui inimene ise ei kirjuta „teie“ vormis. Hiljem (PR #197): dialoogilaiendusena reegel ei pidanud (C9 kordus andis ikka „Alustage“). Reegel on nüüd eesti keele põhijuhises (`VOICE.et`, `lib/rag-v2/pilot/contracts.js`) ja `ESTONIAN_IMPERATIVE` on eemaldatud.

Vastuse leping jääb samaks: piirangud ja täpsustus on endiselt viideteta väljad, reegel on ainult juhises. dialogue-8 plaanid jäävad loetavaks (`READABLE_DIALOGUE_PROMPT_VERSIONS`). Uusi vastuseid annab ainult dialogue-9 plaan.

### 4. Kriisiriba

- `.chat-crisis-notice` (`app/styles/chat.css`): läbipaistmatu, valge tekst `#7a1f1f` taustal (umbes 10:1), sama mõlemas teemas. Riba on oma real vestluse kohal (`order: -1`), mitte selle peal.
- `crisisTextWithLinks` (`components/alalehed/chat/view/ChatNotices.jsx`): 112 ja „11x xxx“ kujul numbrid (116 111, 116 006) on `tel:` lingid, klaviatuurifookus on nähtav. Tekst on rakenduse tõlge, mitte mudeli oma.

### 5. Allikavaate link algallikale

`sourceLinks(config, reference)` (`runtimeAdapters`, `lib/rag-v2/pilot/retrieval.js`) jookseb `pilotGet`-is (`lib/chat/m4PilotServer.js`) pärast kanoonilist viitekontrolli.
- Dokumendi versioon peab vastama plaanile, muidu `reference_access_denied`.
- Bundle loetakse Postgresist räsikontrolliga (`bundles`). Dokumendi ja versiooni ID peavad klappima, muidu tuleb tühi loend.
- Välja `source_urls` aadressidest jäävad ainult `https://` aadressid ilma tühikute, jutumärkide ja nurksulgudeta, kuni 2000 märki, kuni 3 tükki.
- Viga annab tühja loendi; vaade avaneb ikka.

`app/chat-source/page.jsx` näitab rida „Algallikas:“ (`m4Pilot.original`, et/en/ru). Link on hostinimi ja avaneb uues aknas (`noopener noreferrer`). Aadressid tulevad dokumendist, mitte mudelist. Mudeli kontekst ei muutu.

### 6. Vastuse oma hääl: `m4-grounded-answer-11` ja `m4-grounded-dialogue-10` (PR #197)

Omanik ei aktsepteerinud 27.09.2026 päris vestluses vastust „Kärt Mulleri artikli järgi peab omavalitsus …“: vastus peab olema Luna enda oma. Põhjus oli juhises endas: „Attribute an article position to its author“ ja „Refer to a source by its title or author in prose when useful“.

Uus põhijuhise jaotis ANSWER VOICE (`answerInstructions`):
- Luna ütleb tõenditega toetatu otse oma sõnadega; viited näitavad päritolu.
- Allikatest ei jutustata: ei „X artikli järgi“, „allikas ütleb“ ega „väljavõtted kirjeldavad“, tekstis ei nimetata autoreid ega dokumentide pealkirju.
- Selle asemel nimetatakse ulatus, kui lugeja seda vajab: kelle kohalik reegel („Tallinnas …“), dateeritud näide, soovitus reegli asemel või allikate vastuolu.
- Piirangud ja täpsustus kasutavad sama häält ega nimeta infot „väljavõteteks“ ega „allikateks“.
- SOURCE TYPES jääb sisult samaks: autori seisukoht jääb seisukohaks ja koolitusnäide näiteks, aga autorit tekstis ei nimetata.

Kordus kuuel salvestatud pöördumisel (27.09 päris B9 ning aruande B4, B9, C9, E1.2, G11; failid `voice-eval-v9.json`, `voice-eval-v10.json`, `voice-eval-v10-b.json` serveri kaustas `/home/ubuntu/rag-v2-work/eval-files`; kokku 0,028 USD):

| | v9 (dialogue-9) | v10 lõplik |
|---|---:|---:|
| Allikast jutustamine tekstis (plokid, piirangud, täpsustus) | 8 | 0 |
| Mitmuse käskiv kõneviis | 1 (C9) | 0 |

Faktid, arvutusalused ja tingimused jäid alles (G11 136 € = 636 − 500; omavalitsuse kaalumiskohustus). E1.2 Raasiku elukohareegel on viitega plokk (Raasiku kord), piirang tuleneb sellest. Esimene v10 jooks kasutas piirangutes veel kaks korda sõna „väljavõtted“; lõplik juhis keelab selle.

## Mõõtmine

Failid on kaustas `tmp/rag-v2-dev-2026-09-27/`. Iga variant jooksis üks kord.

### Allikavalik 12 küsimusel (`law-check.mjs`)

12 vastuvõtutesti küsimust (`law-questions.json`): 10 üldküsimust ning kaks nimelise omavalitsusega (F3 Narva, A9 Tartu). F3 ja F4 on vene keeles. Teadmusrada, profiil `hybrid-estnltk-chat-v1`, plaan ja valik gpt-6-luna-ga. Salvestati valitud tõendi dokumendid; kandidaatide hulka ja paragrahve mitte.

| Küsimus | v25, assist-2 | v26, assist-2 | v26, assist-3 |
|---|---|---|---|
| B1 toimetulekutoetuse tingimused | 2023 audit | SHS | SHS |
| B3 teade abivajavast lapsest | LasteKS, 2 juhendit | LasteKS, 2 juhendit | 2 juhendit |
| B4 omaosalus hooldekodus | artikkel | SHS, artikkel | artikkel |
| B6 isikliku abistaja teenus | Järva, Haapsalu kord | SHS, Järva kord | SHS |
| B8 vältimatu abi | 9 omavalitsuse korda | SHS | SHS |
| B9 keeldumise vaidlustamine | Tallinna, Häädemeeste kord, 2 artiklit | SÜS, Tallinna, Järva, Elva kord, artikkel | Elva kord, 4 artiklit või juhendit |
| B10 lapse arvamus | 3 juhendit või uuringut | 3 juhendit või uuringut | LasteKS, 2 juhendit |
| C9 kuuldeaparaat | teatmik, kogumik, Rõuge kord | teatmik, puude teabematerjal, Rõuge, Antsla kord | teatmik, puude teabematerjal |
| F3 Narva, eakas kodus | Narva-Jõesuu kord, Narva artikkel | Narva artikkel | Narva artikkel, „Koduteenuste korraldus“ (2023) |
| F4 toimetulekutoetus | 2023 audit, Tallinna kord | SHS, 2023 audit | SHS |
| G11 1600/600/500 | artikkel | artikkel | SHS, artikkel |
| A9 Tartu sotsiaaltransport | artikkel | artikkel | artikkel |

| Kokku | v25, assist-2 | v26, assist-2 | v26, assist-3 |
|---|---:|---:|---:|
| Küsimusi, kus valiti riiklik seadus | 1 | 7 | 6 |
| Teiste omavalitsuste kordi 10 üldküsimusel | 15 | 6 | 1 |
| Plaane, kus päring nimetab seadust | 2/12 | 2/12 | 12/12 |
| HMS B9 juures | korpuses polnud | ei | ei |
| Kulu | 0,0225 USD | 0,0228 USD | 0,0239 USD |

**Suurim paranemine tuli korpusest** (v25 → v26, sama otsinguabi):
- B1, B4, B6, B8 ja F4 said SHS-i;
- B8 üheksa juhuslikku korda asendus seadusega;
- teiste omavalitsuste kordi oli üldküsimustel 15 asemel 6;
- F3 ei saanud enam Narva-Jõesuu korda.

**search-assist-3 vs -2 oli siin segane:**
- parem: B6 (Järva kord välja), C9 (Rõuge ja Antsla välja), F4 (audit välja), G11 (SHS lisandus), B10 (LasteKS lisandus);
- halvem: B3 (LasteKS välja), B4 (SHS välja), B9 (SÜS ja kohalikud korrad asendusid artiklitega).

B3 ja B4 plaanis oli õige akt nimega olemas. Seadus kadus seega valikus või ei jõudnud 30 kandidaadi hulka; kumb, pole mõõdetud.

**HMS-i ei leidnud kumbki.** v3 B9 plaanis oli päring „Haldusmenetluse seadus vaie kohaliku omavalitsuse otsuse peale“, aga ükski HMS-i lõik tõendisse ei jõudnud.

**Hüpotees.** SHS lõikudel on `valid.from` 2026-10-01 ja valik ei tea tänast kuupäeva. Juhis „eelista kehtivat teksti“ võib SHS-i seetõttu alla suruda. Kontrollimata: v3 jättis SHS-i alles B1, B6, B8, F4 ja G11 juures.

### Otsinguabi 52 küsimusel (`assist-eval-v26.mjs`)

ADR-030 hindamiskomplekt (arendus- ja kontrollosa koos): 48 vastatavat ja 4 vastuseta küsimust. v26 indeks, teadmusrada, profiil `hybrid-estnltk-vector2-fast-lexical-dependencies-v1` (9 kohta, 10 000 tokenit), plaan ja valik. Ankur on õige lõigu tekst lõppkontekstis. Failid `assist-main-v26.json` (-2) ja `assist-quality-v26.json` (-3).

| 48 vastatavat | search-assist-2 | search-assist-3 |
|---|---:|---:|
| Kõik õiged lõigud | **34** | 32 |
| Vähemalt üks õige lõik | **44** | 43 |
| Õige dokument | 45 | **46** |
| Tõendilõike keskmiselt | 3,6 | 3,4 |
| Tõendeid 4 vastuseta küsimusel | 0, 0, 0, 0 | 0, 0, 1, 0 |
| Otsing koos valikuga, p50 / p95 | 3,6 s / 11,9 s | 3,8 s / 8,7 s |
| Kulu | 0,0998 USD | 0,1035 USD |

Erinevused küsimuste kaupa:
- -3 parem: `journal-b-02` (kõik ankrud, -2 mitte ühtegi), `journal-a-11` (kõik ankrud), `laws-07` (õige dokument).
- -3 halvem: `guides-02` (inglise keeles, kaotas õige dokumendi), `journal-b-12` (vene keeles, kaotas ankru), `journal-b-03`, `journal-b-08` ja `journal-a-06` (kaotasid osa ankruid).
- Vastuseta `journal-b-13`: -3 andis 1 tõendilõigu.

Kaotustest neli on ajakirjaküsimustel. Tõenäoline põhjus: -3 surub artikleid alla ka siis, kui küsitakse artikli enda sisu. Lõike pole selle kinnitamiseks üle vaadatud.

### Vastuse kordus (`replay.mjs`)

Viis salvestatud vastuvõtutesti pöördumist: B4, B9, C9, E1.2 ja G11. Sama küsimus, vestluse seis ja tõendipakett; uus on ainult vastusekutse (gpt-6-luna, medium). v8: `replay-eval-main.json`, 0,010 USD. v9: `replay-eval-quality.json`, 0,012 USD. Kordus ei käivitanud viitekontrolli ega avaldamist. v9 jooks oli enne `ESTONIAN_IMPERATIVE` reeglit (commit `a64de42d2`).

| Küsimus | v8 | v9 |
|---|---|---|
| B4 | Lisahüvitis kuni sissetuleku ja keskmise vanaduspensioni vaheni; näited 1200 ja 1600 € | Lisaks lävi (eelmise aasta II kvartali keskmine vanaduspension, 2023 umbes 636 €), arvesse minev tulu ning et omaosalus sõltub kohatasust ja omavalitsuse kaetavast hoolduskulust. Sõna „piirmäär“ ei kasutata. |
| B9 | Ainult artikli nõuanne (kirjalik, põhjendatud otsus); Tallinna ja Järva kord ainult piirangutes | Tallinna ja Järva vaide- ja kaebustee ning 30-päevased tähtajad, kumbki oma omavalitsuse nimel, koos tähtaja algusega. Üldist „sõltub omavalitsusest“ väidet pole. |
| C9 | Arst, soodustus pensioniealisele, SKA hüvitab, enne ostu küsi | Sama ilma pensioniealise lauseta. „Alustage“, „Ärge ostke“; sellest tuli imperatiivireegel. Võitu pole. |
| E1.2 | Elukohanõuet pole (elus vastuses oli) | Elukohanõuet pole. Lisaks: omaosaluse vähendamine otsustatakse juhtumipõhiselt; järgmine samm. |
| G11 | 136 € ja 364 €; omavalitsuse kaalumiskohustus; täpsustust pole | 136 € = 636 € − 500 €; kaalumiskohustus; järgmine samm. Täpsustus küsib omavalitsust, mitte hooldekodu asukohta. |

Esimene hinnang oli, et v9 on parem kõigil viiel. Failide järgi on selge võit B4, B9 ja G11 juures, väike E1.2 juures, C9 juures võitu pole. v8 kordus ise vältis kaht elus vastuse viga (E1.2 elukohanõue, G11 kaalumiskohustus). Ühe jooksu varieeruvus on seega suur. Imperatiivireegel on mõõtmata.

### Testid

- 27.09.2026 (HANDOFF): `npm test` roheline. RAG v2 integratsioonitestid on rohelised, v.a teadaolev dialoogistsenaariumi vektorilünk ([ADR-030](adr-030-chat-retrieval-at-corpus-scale.md)).
- 27.09.2026 uuesti harul `claude/rag-v2-answer-quality`: `tests/rag-v2-answer-prompt.test.mjs` ja `tests/rag-v2-search-assist.test.mjs` 11/11; `tests/rag-v2-source-structure.test.mjs` allikalinkide test 1/1.
- Uued kontrollid:
  - v9 viis juhisefraasi; imperatiivireegel ainult eesti keeles;
  - `passageSource` neli juhtu ja valikujuhise fraasid;
  - `sourceLinks` ainult https, kuni 3, vale versioon lükatakse tagasi.

Kriisiriba ja allikavaate brauserikontrolli tulemust pole talletatud.

## Seos vastuvõtuaruandega

| Aruande parandus | Tehtud | Jäi |
|---|---|---|
| 2 Tingimused ja faktid kõigis vastuse osades | dialogue-9 (PR #196). Kordusel selge võit B4, B9, G11 | Leping muutmata: piirangud ja täpsustus on viideteta väljad, reegel on ainult juhises. B4 v9 ei nimeta hoolduskulu piirmäära. C9 kordustes 95% osalust ei nimetatud, seega arvutusaluse reeglit sellel ei kontrollitud. S-hulkade võrdsust kordus ei mõõtnud. |
| 4 Riikliku õiguse, KOV-i ja aja valik | korpus v26 (aktiivne). search-assist-3 jäi katseks | Tootmise kombinatsioonil (v26 + -2) said B1 ja B8 SHS-i. B10 LasteKS-i ei saanud (-3-ga sai; §29 lg 5 pole kontrollitud). F3 kohalikku praktilist teed ei saanud. Teiste omavalitsuste kordi 10 üldküsimusel 6, mitte 0. HMS B9 juures puudub. |
| 6 Kriisiriba ja praktilised lingid | läbipaistmatu riba, `tel:` lingid, allikavaate algallika link (PR #196) | Mobiili- ja brauserikontroll talletamata. Riba ilmumise aeg ja säilimine adapteri vea korral on muutmata ja mõõtmata. Vastus ise linke ei renderda. E3.2 seos on tegemata. |

## Piirid ja lahtised küsimused

- 12 küsimuse ja 52 küsimuse mõõtmises oli üks jooks varianti kohta. Müra on suur.
- `law-check.mjs` salvestab ainult valitud dokumendid. Kas seadus oli 30 kandidaadi hulgas, pole teada.
- **B9 ja HMS.** Hüpotees: 54 omavalitsuse korra peaaegu samasugused vaidlustamise lõigud täidavad 30 kandidaadi hulga. Mõõtmata. Võimalik üldine parandus: väike riikliku õiguse rada, kus riiklikke õigustekste otsitakse eraldi ja neil on kandidaatide hulgas oma kvoot. Tegemata.
- Valik ei saa tänast kuupäeva. Võimalik parandus: kuupäev päringu sisendisse andmena, mitte juhise teksti. Tegemata.
- Mõõtmine katab ainult teadmusraja. Omavalitsuse kirjete kataloog (F3, A9) pole selles.
- Plaani ja valiku juhis ei sõltu plaani `searchAssist` väärtusest: -2 plaan saaks -3 koodil -3 juhise ja uued lõiguväljad. Praktikas vana plaan uue koodiga ei käivitu (`implementation_approval_mismatch`).
- Pole mõõdetud, kui paljudel dokumentidel on https `source_urls` aadress.
- SHS tekst kehtib 30.11.2026-ni, HMS tekst 31.12.2026-ni. Uus redaktsioon tuleb enne seda korpusesse tuua.
- Väljaspool seda ADR-i:
  - XML-i toores `<sup>` ja muutmismärked (aruande parandus 5);
  - Tallinna hooldajatoetuse kirje vastuolu (3.3);
  - E3.2 „tädi vajab sama“;
  - B7 reasisesed viited.

## Staatus

- **Serveris, PR #196** (`claude/rag-v2-answer-completeness`, liidetud 27.09.2026): `m4-grounded-dialogue-9`, kriisiriba ja allikavaate lingid. Esimene deploy aegus kaks korda (900 s), sest serveri rakenduse `tmp/` all oli hoidla koopia ja sümlinkidega hindamiskaustad, mida Next.js build loeb. Pärast nende tõstmist `/home/ubuntu/rag-v2-work/` alla õnnestus deploy 2 minutiga ([runbook](runbook-corpus-increment.md)). Vestlusplaan `m4-corpus-chat-20260927j`.
- **PR #197** (`claude/rag-v2-answer-voice`): vastuse oma hääl (jaotis 6). Pärast deploy'd uus vestlusplaan.
- **Pärast deploy'd:** muudatus puudutab `lib/rag-v2`-te, seega muutub implementatsiooni räsi. Vestlusplaan tuleb ehitada uuesti uue unikaalse `--out` nimega ([runbook](runbook-corpus-increment.md)). Skript kirjutab plaani koodi `SEARCH_ASSIST_VERSION`-i ja `DIALOGUE_PROMPT_VERSION`-i; PR #196 koodis on need `rag-v2/search-assist-2` ja `m4-grounded-dialogue-9`.
- **Tootmisse ei läinud:** `rag-v2/search-assist-3`. 52 küsimuse mõõtmine tehti enne otsust; -3 polnud parem (kõik õiged lõigud 32 vs 34). Jääb katseks harusse `claude/rag-v2-answer-quality`. Enne uut katset:
  - vaadata B3, B4, B9 ja HMS-i puudumine;
  - anda valikule tänane kuupäev;
  - mitte suruda artikleid alla, kui küsitakse artikli sisu;
  - kaaluda riikliku õiguse rada.
- **Korpus v26** on serveris aktiivne. Registriharu `claude/rag-v2-national-laws` on eraldi PR ega muuda implementatsiooni räsi.
