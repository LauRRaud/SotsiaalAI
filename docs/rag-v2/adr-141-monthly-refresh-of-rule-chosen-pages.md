# ADR-141: reegliga valitud lehed igakuises uuenduses

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Omanik 11.10.2026: „Do this task here: Igakuine uuendus reegliga valitud lehtedele“. Seis: **kood ja testid valmis; proovilugemine 878 lehega tehtud (tasuta); päris seis on külvatud ja ajastatud töö loeb neid lehti alates 1. novembrist. Midagi ei ostetud ja korpust ei muudetud.**

## Miks

Korpuses on 878 veebilehte, mida ükski igakuine uuendus ei lugenud: asutuste juhislehed kahest katvuse nimekirjast (564, [ADR-137](adr-137-coverage-batch-and-the-law-of-obligations-act.md)) ja ühingute lehed (314, [ADR-140](adr-140-associations-own-pages.md)). Need valis reegel (`lib/rag-v2/web-select.js`), mis võtab lehest välja inimest nimetavad lõigud. Korpuses olev koopia ei ole seega see, mida lehtede lugeja loeb, ja ametlike lehtede uuendus ([ADR-116](adr-116-official-pages-monthly-refresh.md)), mis asendab repos oleva koopia lugeja omaga, neile ei sobi. Vastus ütleb lehe arvu selle päeva seisuga, mil lehte viimati kontrolliti ([ADR-117](adr-117-confirmed-reading-day.md)); ilma uuenduseta jääb see päev seisma ja muutunud leht vanaks.

Organisatsioonide lehtede jaoks (521, ADR-095) oli sama asi juba lahendatud abivahendite uuenduse sees ([ADR-098](adr-098-monthly-assistive-refresh.md)). See otsus laiendab sama raja kahele uuele rühmale ja lisab kaks kaitset.

## Neli otsust

**1. Kus koopiad elavad.** Samas kohas, kus organisatsioonide lehed: uuenduse seisus väljaspool repot, põhikausta `tmp/rag-v2-assistive-refresh/accepted/` all, iga rühm oma kaustas (`organisations`, `coverage`, `associations`). Repos on ainult nimekirjad (aadress, pealkiri, sisupiirkonna vihje). Seis on omaniku arvutis ega ole avalik; kui see kaob, saab selle uuesti külvata korpuse täienduse allikatest. Külvamiseks on käsk `scripts/rag-v2-chosen-seed.mjs`: see võtab täienduse allikatest nimekirjas olevate lehtede koopiad ja keeldub, kui mõnel nimekirja lehel koopiat ei ole või kui koopia baidid ei ole need, mis korpuses (võrdlus täienduse ülevaatuse failiga).

**2. Kuidas leht valitakse uuesti nii, et tulemus ei kõiguks.** Lehte, mis loeb nagu enne, ei hinnata uuesti üldse. Lugeja võrdleb tänast lugemist selle lugemisega, millest leht valiti (koopia metaandmetes `content_sha256`), mitte korpuses oleva kärbitud tekstiga. Reegel otsustab uuesti ainult lehe üle, mille lugemine erines kaks korda samamoodi. Reegli üks tunnus sõltub koos loetud lehtede sõnavarast; selleks on rühma kõik salvestatud koopiad ja muutunud lehed, nii et sõnavara on kuust kuusse sama.

Leht loetakse sama pealkirja ja sama sisupiirkonna vihjega, millega see koguti. Vihje tuleb nimekirjast lehe enda kirjest või sellest avalehest, mille alt leht leiti. Ilma vihjeta loetaks noorteinfo portaali ja alkoinfo lehti koos saidi menüüga ja kõik need näiksid muutununa.

**3. Mis juhtub, kui midagi on valesti.** Mitte midagi ei kustutata ega asendata iseenesest peale lehe, mille tekst päriselt muutus:

| Olukord | Mis juhtub |
|---|---|
| leht loeb nagu enne | koopia jääb, kontrolli päev liigub tänasele |
| leht erineb esimest korda | ettepanek, koopia jääb |
| leht erineb teist korda samamoodi, reegel valib selle | koopia asendatakse ja ootab korpuse täiendust |
| muutus on ainult selles, mille reegel välja võtab | korpuse koopia jääb samaks |
| reegel jätab lehe nüüd välja | leht jääb korpusesse nagu on; aruandes inimesele otsustamiseks |
| lehe sisupiirkond leitakse teisiti kui valimise ajal | **hoitakse inimesele** (uus kaitse) |
| valitud tekst on alla poole endisest | **hoitakse inimesele** (uus kaitse) |
| lehte ei saa lugeda | koopia jääb; aruandes aadress ja põhjus |

Kaks uut kaitset on selle jaoks, mida teine sama lugemine ei taba: sait, mis sai uue kujunduse (vihje enam ei klapi ja loetakse kogu lehe keha koos menüüga), ja sait, mis vastab igale aadressile ühe lühikese lehega. Hoitud lehe võib inimene pärast vaatamist lubada (`--approve-chosen <id>`); ajastatud töö ise seda ei tee. Reegli enda „jääb välja“ otsust luba ei muuda.

**4. Raha ja PR.** Uuendus ise ei osta midagi ega tee ühtegi mudeli päringut. Asendatud leht läheb seisu kausta `increment/sources`, kust ajastatud töö teeb korpuse täienduse sama ühise lae all nagu seni (0,10 USD kuus, ADR-098 ja ADR-116). Kontrolli päevade tabel (`lib/rag-v2/search/web-page-checks.json`) on repo fail, seega lõpeb iga käik PR-iga nagu seni; tabelis on ainult räsid ja kuupäevad. Aruanne näitab arve ja aadresse, mitte kunagi lehe teksti.

## Mis on tehtud

- `lib/rag-v2/chosen-refresh.js`: lehe lugemiskirje koos vihjega, otsus kinnitatud muutuse kohta (asenda, sama, jääb välja, hoitud), seisu võrdlus nimekirjaga, külvamise kontroll. Testid `tests/rag-v2-chosen-refresh.test.mjs`.
- `scripts/rag-v2-assistive-refresh.mjs`: organisatsioonide lehtede osa on nüüd kolme rühma tsükkel. Uued valikud: `--coverage-lists`, `--associations-list`, `--only-chosen`, `--approve-chosen`. Rühma, millel seisus kausta ei ole, ei loeta. Aruandes on iga rühma kohta uus väli `changedAndHeldForAPerson` ning nimekirjaga võrdlus (`inStateNotInLists`, `inListsNotInState`).
- `scripts/rag-v2-chosen-seed.mjs`: rühma külvamine täienduse allikatest.
- Päris seis on külvatud: `accepted/coverage` 564 lehte (allikad `tmp/rag-v2-v76/sources3` ja `tmp/rag-v2-v76/v77/sources`) ja `accepted/associations` 314 lehte (`tmp/rag-v2-v78/sources-final`); kõik 878 koopiat on bait-baidilt need, mis korpuses.
- Ajastatud töö „abivahendite-info-uuendamine“ juhis nimetab uusi rühmi ja uut välja.

Pärast järgmist reegliga valitud lehtede täiendust: külva rühm uuesti (`--replace`), muidu võrdleb uuendus vana koopiaga.

## Proovilugemine (11.10.2026, tasuta)

Kaks eraldi katseseisu (`tmp/rag-v2-chosen-trial/`), külvatud korpuse koopiatega, loetud ilma midagi asendamata:

| Rühm | Lehti | Saite | Sama | Erines | Lugemata | Aeg |
|---|---:|---:|---:|---:|---:|---:|
| katvuse nimekirjad | 564 | 16 | 564 | 0 | 0 | 14 min |
| ühingud | 314 | 9 | 313 | 1 | 0 | 8 min |

Üks erinenud leht (Peaasi „Saatekirjad“) on leht, mille loetelu järjekord vahetub igal laadimisel: read on samad, järjekord teine. Selline leht ei kinnitu kunagi ja selle koopia jääb, aga ka kontrolli päev ei liigu.

**Vastukatse.** Viis noorteinfo portaali lehte, loetud kaks korda nimekirjaga, millest vihjed olid eemaldatud: esimesel korral kõik viis „erines“, teisel korral kõik viis „kinnitatud“ ja kõik viis hoiti inimesele põhjusega „sisupiirkond leitakse teisiti“. Ilma kaitseta oleks nende korpuse koopiad asendatud menüüga lehtedega.

## Mida see maksab

Käik pikeneb umbes 23 minutit (kaks korda kuus). Raha kulub ainult siis, kui leht päriselt muutub: lehel on keskmiselt kuus kuni üheksa lõiku ja 2000 kuni 3000 märki, mis on praeguse hinnaga alla 0,0005 USD lehe kohta. Sada muutunud lehte kuus oleks alla 0,05 USD, mis mahub ühise 0,10 USD lae alla.

## Lahtine

- Päris teist lugemist ja asendust on proovitud ainult koopiate peal (nagu ADR-098 ja ADR-116 puhul); esimene päris käik on 1. novembril.
- Leht, mille loetelu järjekord igal laadimisel vahetub, ei kinnitu. Võrdlus, mis järjekorda ei arvesta, oleks lugeja muudatus.
- Lugeja võtab alamlehe pealkirjaks lingi teksti, kui lehel pealkirja ei ole (ADR-140, Eluliini leht). See ei ole selle otsuse teema, aga uuesti lugemine hoiab sama pealkirja.
- Saidi uusi lehti uuendus ei otsi: see loeb täpselt neid lehti, mis korpuses on.
