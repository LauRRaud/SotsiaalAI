# ADR-111: riigi tasandi abi esimene partii (korpused v70 ja v71)

Kuupäev: 08.10.2026. Teostus Claude Opus 5.5. Seis: **ostetud ja töös.** Serveris töötab korpus v71: indeks `b5a7a39b`, 8446 dokumenti, 72 198 lõiku, vestlusplaan `m4-corpus-chat-20261008b.json`. Kulu kokku 0,198 USD. **Mudeliga mõõtmata:** ühtegi küsimust uue sisu kohta ei ole küsitud.

## Probleem

[Katvuskaart](../audits/rag-v2-coverage-map-2026-10-08.md) näitas, et riigi tasandi abi on RAG-is nõrk: omavalitsuste kirjeid on palju, aga pensioni, peretoetuste, töötuse, ravikindlustuse, võlgade ja eestkoste kohta puudus nii seadus kui ka ametlik selgitus. 34 seadusest oli RAG-is 7; ametlikke juhislehti oli 30.

Omanik 08.10.2026: „Lisa RAG-i riigi tasandi abi: esimene partii“. Puuduvad 27 seadust laadis teine tööaken samal päeval Riigi Teatajast alla (#461). Omanik selle kohta: „laadis alla, sina otsusta, mida edasi teha“. Aruandes, millele ta vastas, oli kirjas, et RAG-i võtmine maksab ja on tema otsustada; ulatuse ja kulupiiri määras tegija ja ütles need enne ostu.

## Otsus

### Juhislehed: 83

Loend: `Andmebaasi/register/web_pages_state_help.json`. Lehed on võetud väljaandja saidikaardi järgi, iga leht oma aadressiga (alalehti korjaja ise ei otsinud); kalkulaatorid, uudised ja kontaktide loendid jäid välja.

| Väljaandja | Teema | Lehti |
|---|---|---:|
| Sotsiaalkindlustusamet | pension: liigid, suurus, taotlemine, pensioniks valmistumine, muud pensioniga seotud hüvitised, pension välismaal | 41 |
| Sotsiaalkindlustusamet | perehüvitised: ülevaade, peretoetused, perekondlikud olukorrad, elatisabi, välismaalt tulijad, Ukraina põgenikud | 33 |
| Sotsiaalkindlustusamet | perelepitus; väljamaksete praktiline teave | 2 |
| Sotsiaalministeerium | pension, sooduspensionid, perehüvitised ja vanemapuhkused, vanemahüvitis, elatisabi, töötus- ja ravikindlustushüvitised, õendus- ja ämmaemandusabi | 7 |

Lehed on kaustas `Andmebaasi/veebilehed/` ja registris nagu varasemad 31 ametlikku lehte ([ADR-095](adr-095-web-pages-as-sources.md)).

**Kahte saiti lugeda ei saanud; kummastki ei ole RAG-is midagi:**

- **Töötukassa** (`www.tootukassa.ee`). Leht tuleb kätte, aga selles ei ole teksti: sisu joonistab skript ja võtab selle aadressilt `/web/graphql`. Saidi `robots.txt` keelab kogujatele kogu `/web/` kausta (lubatud on ainult saidikaart). Korjaja reegel on seda keeldu austada ([ADR-095](adr-095-web-pages-as-sources.md)); ümber ei mindud.
- **Tervisekassa** (`tervisekassa.ee`). Sait vastas 08.10.2026 kolmel katsel korjajale ja ühel katsel tavalisele brauserile veaga 503. Põhjus on teadmata.

Seetõttu toetuvad töö kaotus, töövõime ja ravikindlustus praegu seadustele ja ministeeriumi ülevaatelehele, mitte asutuse enda juhistele.

### Seadused: 26

Iga seaduse 08.10.2026 kehtiv terviktekst.

**Tervikuna (19):** perehüvitiste seadus, riikliku perelepitusteenuse seadus, ohvriabi seadus, töötuskindlustuse seadus, tööturumeetmete seadus, töölepingu seadus, täitemenetluse seadustik, füüsilise isiku maksejõuetuse seadus, ravikindlustuse seadus, töövõimetoetuse seadus, psühhiaatrilise abi seadus, pärimisseadus, riikliku pensionikindlustuse seadus, kriminaalhooldusseadus, välismaalasele rahvusvahelise kaitse andmise seadus, isikuandmete kaitse seadus, avaliku teabe seadus, põhikooli- ja gümnaasiumiseadus ning tsiviilkohtumenetluse seadustik (vt „Täiendus v71“).

**Osadena (7)**, registrikirje väljaga `xml_sections` ([ADR-076](adr-076-act-sections-as-source.md)). Põhjus: need seadused on suured ja suurem osa neist ei räägi abist. Tervikuna oleks neis 2091 lõiku, sisse läks 332.

| Seadus | Mis osa | Paragrahve | Lõike |
|---|---|---:|---:|
| Tsiviilseadustiku üldosa seadus | füüsilised isikud ja teovõime (§ 7–23); tehingu kehtetus (§ 84–101); esindamine (§ 115–131); aegumine (§ 142–169) | 82 | 82 |
| Tervishoiuteenuste korraldamise seadus | üldsätted ja tervishoiuteenuste osutamise korraldus: vältimatu abi, perearstiabi, kiirabi, eriarstiabi, õendusabi, ämmaemandusabi (§ 1–26⁴) | 60 | 68 |
| Kriisiolukorra ja riigikaitse seadus | üldsätted, valmistumine, kriisiülesanded ja planeerimine (§ 1–24); elutähtsad teenused ja elanikkonnakaitse (§ 81–98) | 42 | 55 |
| Halduskohtumenetluse seadustik | menetluse mõiste (§ 1–2); kaebus (§ 37–49); menetluskulud, menetlusabi ja kaebuse menetlusse võtmine (§ 101–125); esialgne õiguskaitse (§ 249–254) | 45 | 50 |
| Karistusseadustik | ähvardamine, kehaline väärkohtlemine, ohtu asetamine ja abita jätmine; inimkaubandus; vabaduse võtmine; seksuaalsüüteod; seksuaalne ahistamine, identiteedi kasutamine ja ahistav jälitamine; süüteod perekonna ja alaealise vastu (§ 169–182¹); vargus, omastamine, kelmus, arvutikelmus, väljapressimine, usalduse kuritarvitamine | 41 | 42 |
| Vangistusseadus | kinnipeetava vanglaväline suhtlemine (§ 23–33); sotsiaalhoolekanne vanglas (§ 57–62); vabastamine (§ 73–76²) | 28 | 31 |
| Riigihangete seadus | sotsiaal- ja eriteenuste erimenetlus (§ 126–127) | 2 | 4 |

Sama seaduse järgmine redaktsioon pärib valiku värskendusrajal ise. Terve fail on kaustas `Andmebaasi/oigusaktid/` alles; valiku muutmiseks muudetakse registrikirjet ja loetakse seadus uuesti.

**Välja jäi välismaalaste seadus** (457 paragrahvi viisadest ja elamislubadest). Pagulase ja sõjapõgeniku abi kohta läks sisse välismaalasele rahvusvahelise kaitse andmise seadus tervikuna. Kui elamislubade osa on vaja, saab selle lisada valikuga.

**Järgmisi redaktsioone ei toodud.** Alla laaditud 27 seadusest 17-l on Riigi Teatajas juba avaldatud järgmine tekst (enamasti alates 01.01.2027). Korpuses on üks redaktsioon korraga: kaks annaksid otsingus peaaegu kattuvad lõigud. Õigusaktide nimekiri `legal-acts-in-index.json` on uuendatud (549 akti), nii et igakuine kehtivuse kontroll ([ADR-038](adr-038-law-validity-check.md)) näeb uusi seadusi ja toob järgmise redaktsiooni siis, kui see jõustub. Esimesed tähtajad: riigihangete seadus 01.11.2026 ja avaliku teabe seadus 01.12.2026.

### Täiendus v71: tsiviilkohtumenetluse seadustik tervikuna

Korpuses v70 oli seadustikust 112 paragrahvi (120 lõiku): riigi menetlusabi, maksekäsu kiirmenetlus, eestkostja määramine, kinnisesse asutusse paigutamine, lähenemiskeeld ja hagita perekonnaasjad. Omanik samal õhtul: „ma kardan, et tsiviilkohtu teema on nii oluline, et see peab tervenisti sees olema, see on Eestis väga levinud teema“. Valik võeti registrist maha ja seadustik loeti tervikuna: 821 paragrahvi, 863 lõiku (v71).

### Korjaja parandus

Ühel lehel (perelepitus) olid ametnike kontaktid tabelis, mille lahtrites on tekst lõikudena. Korjaja luges lahtri sisu eraldi lõikudeks ega näinud, et nimi ja telefon on samas reas; kontaktid oleksid jäänud salvestatud koopiasse. Nüüd vaadatakse tabeli rida tervikuna: rida, kus on inimese nimi kanali kõrval, jäetakse välja (`lib/rag-v2/web-page.js`, test väljamõeldud nimedega). Viga leiti enne, kui midagi salvestati.

## Arvud

| | v69 | v70 | v71 | Piir |
|---|---:|---:|---:|---:|
| Dokumente | 8337 | 8446 | 8446 | 10 000 |
| Lõike | 68 408 | 71 455 | 72 198 | 100 000 |
| Ostetud sisendeid | | 3047 | 743 | |
| Tokeneid | | 1 215 236 | 309 376 | |
| Kulu, USD | | 0,1580 | 0,0402 | |
| Kulupiir, USD | | 0,25 | 0,06 | |

- v70: lehed 797 lõiku (lehe kohta 1 kuni 43, mediaan 6), seadused 2250 lõiku.
- Kulu on arvestatud kinnitatud kasutusest (tokenid × 0,13 USD miljoni kohta), mitte arvelt. Hind kontrolliti samal päeval OpenAI lehelt.
- Ketas: enne 26 GB vaba, pärast 24 GB (70% kasutusel).
- Ühist märksõna ega kirjeldust partii dokumentidel ei ole.

## Kuidas tehti

1. Lehed loeti korjajaga (`scripts/rag-v2-web-pages.mjs`); kolm ülevaatuseks märgitud lehte vaadati üle ja lubati nimeliselt.
2. 27 seadust loeti esmalt tervikuna kohalikku hoidlasse, et saada lõikude arv (5210); siis kirjutati kaheksale valik ja loeti uuesti.
3. Üks sisestus 109 allikaga. Ülevaatus kahe olemasoleva reegliga, kumbki oma liigile: seadused `rag-v2-corpus-refresh.mjs review`, lehed `rag-v2-review-by-rule.mjs`.
4. Pakk serverisse, seal kaitstud jooks (`rag-v2-corpus-run-guarded.sh`): v70 kuni 3100 sisendit, v71 kuni 870.

Ühekordsed abiskriptid (lehtede registrisse kandmine, paragrahvide valik, kahe ülevaatuse ühendamine) on põhikausta `tmp/rag-v2-v70/tools` all, mitte koodihoidlas. Järgmine aluspoliitika: `tmp/rag-v2-v71/ship/policy.json`.

## Kontrollitud

- Salvestatud 83 lehte: failid on bait-baidilt need, mis korjaja luges (166 faili); neis on kolm üldaadressi ja mitte ühtegi nime telefoni või aadressi kõrval.
- Registri räsid: 3288 kirjet, kõik vastavad failidele.
- Serveris mõlema jooksu järel: ost `complete` (3047 ja 743 sisendit, tõrkeid 0); indeks `ready` (v71: 8446 dokumenti, 72 198 lõiku); vestlusplaani kontroll `ready` läbis; teenus töötab uue plaaniga.
- Päringuplaneerija statistika ([ADR-108](adr-108-index-capacity-100000-and-statistics.md)): aktiveerimine uuendas statistikat esimest korda päris andmebaasis. Planeerija ootab uuele põlvkonnale 8535 dokumenti (tegelikult 8446), mitte 1.
- Katvuskaart serveris uuesti, tasuta, pärast v70 ja pärast v71 (read on mõlemal korral samad): ruudustiku 34 seadusest on RAG-is 33 (puudub välismaalaste seadus; enne 7). Pensioni real on vastutaja juhislehti 29 (enne 0) ja avalause sõnaotsing leiab juhise esimesel kohal (enne ei leidnud); lapse sünni real 15 lehte (enne 0) ja teisel kohal (enne ei leidnud). Töö kaotuse ja ravikindlustuse real on seadused nüüd olemas, aga vastutaja juhislehti on endiselt 0 ja avalause sõnaotsing juhist ei leia. Võlgade real langes esimene juhis sõnaotsingus esimeselt kohalt üheksandale; põhjust ei uuritud (uued seaduselõigud samade sõnadega on tõenäoline, aga tõendamata). Sõnaotsing on ainult üks vestluse otsingu osa.
- Ühiktestid: 835, neist 813 läbi ja 22 vahele jäetud. Test, mis kinnitab, millistel registri aktidel on paragrahvide valik, loetleb nüüd seitse seadust.

## Kontrollimata

- Vastused mudeliga. Kas Luna kasutab uusi lehti ja seadusi õigesti, näitab alles küsimine; see on tasuline ja ootab omaniku sõna.
- Kas seitsme seaduse valitud osad on piisavad. Seda näitavad päris küsimused.
- Lehtede hilisem seis: lehe uuendamise kuupäev on metaandmetes, aga need 83 lehte ei ole veel igakuises värskenduses.

## Mis jääb lahti

- Töötukassa ja Tervisekassa juhised. Töötukassa puhul on vaja asutuse luba või andmeid muul kujul; Tervisekassat tasub proovida uuesti, kui sait vastab.
- Katvuskaardi lüngad, mida see partii ei puuduta: lapse arengumure ja Rajaleidja, lähedase surm (riigiportaal, notarid), volikiri, võlad inimese vaates (kohtutäiturid), ohvriabi lehed ohvrile, politsei, vaimse tervise abi leidmine.
- Leitavuse kontroll 49 avalausega mudeliga (umbes 0,25 USD) ootab omaniku sõna.
- Välismaalaste seadus ja 17 seaduse järgmised redaktsioonid.
