# Testide ülevaatus: mis on tarbetu või habras (11.10.2026)

Omaniku küsimus 11.10.2026: „ehk on test üldse liiga palju ja ebavajalikud“. See leht vastab arvudega. Loendamise ajal ei kustutatud midagi; mis pärast omaniku otsust kustutati, on jaotises „Tehtud“.

## Lühike vastus

- **Aega testid enam ei maksa.** Kogu komplekt jookseb GitHubis peaharu väravas 108 sekundiga (LauRRaud/SotsiaalAI#715); seansid jooksutavad oma harus ainult puudutatud testifaile.
- **Enamik teste on päris testid.** Kaustas `tests` on 317 faili ja 2714 testi. 79% neist (2131) kontrollib ainult käitumist: kutsub koodi ja võrdleb tulemust.
- **Üks rühm on habras:** 1576 kontrolli (8% kõigist) ei käivita koodi, vaid loevad lähtekoodi faili tekstina ja vaatavad, kas seal on kindel rida. 924 neist kinnitavad lehe või kujunduse praegust sõnastust. Need on ainus koht, kus tasub kärpida.

## Arvud

Iga testi sees on kontrollid (kokku umbes 20 350). Liigitus selle järgi, mida kontroll võrdleb:

| Mida kontroll võrdleb | Kontrolle | Osa |
| --- | ---: | ---: |
| Koodi arvutatud tulemus (reegel, värav, arvutus, õigus) | 17 636 | 87% |
| Lähtekoodi faili tekst | 1 576 | 8% |
| Tekstikataloog (kas võti on olemas ja on lause) | 808 | 4% |
| Hoidlas olev andmefail | 334 | 2% |

Testide kaupa: ainult käitumist kontrollib 2131, segatud on 390, ainult lähtekoodi teksti 115, ainult kataloogi 61, ülejäänud 17.

Valdkonniti: RAG-i 1017 testis on lähtekoodi teksti kinnitusi 14, koduteenuse 345 testis 145, organisatsiooni 164 testis 56 ja ülejäänud 1188 testis 1361. Need on koondunud lehtede testidesse: 34 faili nimega `*-views.test.mjs` kannavad 1071 kinnitust 1576-st.

## Lähtekoodi teksti kinnitused lähemalt

| Mida kinnitatakse | Jaatav („see rida on olemas“) | Keeld („seda ei ole“) |
| --- | ---: | ---: |
| Leht, komponent või kujundus | 924 | 217 |
| Serveri kood (värav, tee, teenus) | 195 | 38 |
| Andmebaasi skeem ja migratsioon | 126 | 7 |
| Muu ja segatud | 64 | 5 |

- **Näide jaatavast lehe kinnitusest:** test loeb lehe faili ja nõuab, et seal oleks täpselt rida `if (confirming !== opened.kind) {`. Kui keegi kirjutab sama asja teisiti, läheb test punaseks, kuigi leht töötab. Kui leht läheb katki muul moel, jääb test roheliseks.
- **Näide keelust:** „lehel ei ole brauseri kinnitusakent“, „kujunduses ei ole paljaid sildivalijaid“. Keeld hoiab kokkulepet ja läheb katki harva.
- **Näide serveri kinnitusest:** „salvestamine kutsub väravat samas tehingus“, „muutev tee kontrollib päritolu pärast õiguse kontrolli“. See hoiab päris reeglit, mida on käitumise testiga kallis kontrollida.
- **Pikkus:** jaatavatest lehe kinnitustest 461 nõuavad 40 või enama märgi pikkust täpset koodijuppi.
- **Vanus:** 1568 kinnitust 1576-st on failides, mis tehti 9. kuni 11. oktoobril, lehtede ümberehituse ajal.
- **Ajalugu:** kolme päevaga on selliseid ridu ümber kirjutatud 39 korda 24 commit'is. See on sama sagedus nagu tulemuse kontrollidel, seega ajalugu haprust veel ei tõenda; ajalugu on selleks liiga lühike.

**Miks need nüüd rohkem maksavad kui eile.** Seanss jooksutab enam ainult neid testifaile, mida ta ise puudutab. Sama lehe faili võib aga kinnitada mitu testifaili (üht suurt lehefaili kuuest, andmebaasi skeemi kaheksast). Kui muudatus lõhub kinnituse failis, mida seanss ei jooksutanud, läheb peaharu värav punaseks ja kõigi paigaldus seisab, kuni keegi testi teksti ära parandab. 11.10 juhtus see kahel korral veel enne liitmist.

## Kordused

- **Tekstikataloog.** Keelte võrdsust (iga võti on kolmes keeles) kontrollib `npm run i18n:check` juba ise ja see jookseb väravas. Kataloogitestid kontrollivad lisaks, et serveri vealause või eesliitega kokku pandud võti on olemas: seda `i18n:check` ei näe. Kordus on seega ainult „kolmes keeles“ osa; see on odav ja kärpimist ei vaja.
- **Sama fail mitmest testist.** 389 lähtekoodi faili on kinnitatud vähemalt ühest testist; enamik ühest, mõni kuni kaheksast.

## Ettepanek

1. **Kustutada jaatavad lehe ja kujunduse sõnastuse kinnitused (kuni 924).** 26 testi kaovad tervikuna, ülejäänud jäävad lühemaks. Enne kustutamist vaadatakse iga test nime järgi üle: kui nimi ütleb privaatsuse, kustutamise, nõusoleku või õiguse reegli, jääb test alles või asendatakse ühe käitumise testiga.
2. **Jätta alles** keelud (267), serveri koodi kinnitused (195), andmebaasi kinnitused (126), kõik kataloogi ja andmefaili kontrollid ning kõik käitumise testid.
3. **Reegel `AGENTS.md`-sse**, et hunnik uuesti ei kasvaks: uus test kontrollib käitumist; lähtekoodi teksti tohib kinnitada ainult keelu või turvareegli jaoks. (Omanik ütles sama 9. oktoobril.)

Mida see ei puuduta: ükski õiguse, privaatsuse, makse, andmete kustutamise ega kriisiabi test.

## Tehtud (11.10.2026 õhtul, omaniku otsus)

Omanik samal õhtul: „need võib ära kustutada: 267 on keeldude kontrollid ja ~924 on liiga konkreetsed lehe kinnitused, mis kontrollivad täpset koodirida, mitte tegelikku toimimist“ ning „kustuta jah kõik nii, et ma saan pärast lihtsalt keele ja süntaksi testi teha, ja vajadusel veel mõned“.

| | Enne | Pärast |
| --- | ---: | ---: |
| Testifaile | 318 | 317 |
| Teste | 2718 | 2626 |
| Kontrolle | 21 318 | 20 141 |

Arvud on kustutamise tööriista omad. See loeb kontrolliks ka kontrolliva abifunktsiooni kutse ja alamtesti sees oleva kontrolli, sellepärast on „enne“ suurem kui ülal.

**Kustutatud: 1177 kontrolli 71 failis (2880 rida).**

- 872 kinnitust, et lehe, komponendi või kujunduse failis on kindel rida.
- 274 keeldu lehe, komponendi või kujunduse faili kohta („seda rida ei ole“).
- 18 keeldu serveri koodi ja andmebaasi skeemi kohta.
- 13 jääki: kontrollid, et vana fail on kustutatud, ja read, mis jäid ilma oma võrdluseta.
- 92 testi kadus tervikuna, sest neis ei olnud muud. Üks fail kadus tervikuna (`cloudflare-web-analytics-layout.test.mjs`).
- 20 testi said nime, mis ütleb, mida nad veel kontrollivad.

Ülal loendatud 924 ja 267 asemel on arvud 872 ja 292, sest piir tõmmati rangemalt: iga kinnituse väärtus jälgiti muutujate, tsüklite ja abifunktsioonide kaudu tagasi failini ning kinnitus, milles osaleb ka päris kood, tekstikataloog või andmefail, vaadati ükshaaval üle (25 neist kustutati, ülejäänud jäid).

**Alles jäi meelega:**

- **167 kontrolli 39 testis, mille nimi ütleb privaatsuse, ligipääsu, nõusoleku, andmete kustutamise või makse reegli.** 78 neist loevad lehe faili. Näited: sisestatu ei lahku seadmest (toimetulekutoetuse kalkulaator), nõusolek enne mikrofoni, isikuandmete kontroll enne koostamist, teate leht suunab ainult saaja, teenus ei kustuta võtit ega üleandmise jälge, maksevalikut ei saa teha ühe eksinud vajutusega. Nendele reeglitele käitumise testi ei ole; kui kinnitus kustutada, ei valva reeglit miski. Failid: `answer-feedback`, `business-register-names`, `chat-feedback-lifecycle`, `deletion-completeness`, `deletion-with-retired-index`, `document-drafting-views` (2 testi), `home-care-door-steps`, `home-care-keys`, `home-care-money`, `home-care-obstacles` (2), `home-care-preconditions`, `home-care-supplies`, `home-care-visit-notice` (2), `home-care-work-nature`, `network-share-client-decision`, `notification-target-pages`, `org-inbox-manual-status` (2), `org-inbox-room`, `pre-inquiry-recipient-step`, `privacy-check`, `profile-own-name`, `rag-v2-service-providers`, `same-origin-request`, `service-provider-assistant-gate`, `service-provider-representation`, `sharing-view-trail` (2), `subsistence-calculator-views`, `supervision-entry-views`, `supervision-process-views` (3), `urgent-desk-queue`, `workspace-panels-views` (2).
- **128 kinnitust serveri koodi kohta ja 54 andmebaasi skeemi kohta** („see rida on olemas“). Omanik nimetas kustutamiseks keelud ja lehe kinnitused; need kaks rühma ei ole kumbki.
- **61 kontrolli, mis loevad lehe faili muul eesmärgil:** kas lehel kasutatud tekstivõti on kataloogis kolmes keeles (keele kontroll), kas väli, mida vaade loeb, on mudelis olemas, kas igal teavituse sihtkohal ja dokiga lehel on leht ja nimi, ning brauseris jooksva koodi käitumise testid (võrguta kest, vastuse ootamine).
- Kõik käitumise, tekstikataloogi ja andmefaili kontrollid.

**Kontrollitud:** 70 muudetud testifaili jooksid läbi: 705 testi, 0 punast. ESLint muudetud failidel puhas.

**Mis sellest muutub.** Lehe või kujunduse muudatus ei tee enam testi punaseks sõnastuse pärast. Lehe muudatuse kontroll on keel (`npm run i18n:check`, kolm sekundit) ja süntaks (`npx eslint <failid>`); testifaile jooksutatakse ainult siis, kui muutus loogika. Reegel on `AGENTS.md` jaotises „Kontrollid“. Kustutatud kontrollid ei jookse enam kusagil: teste käivitab ainult `npm test` (värava töö `unit`) ja see võtab failid kaustast `tests`.

**Mida see ei tõenda.** Kustutatud kinnitused ei kaitsnud käitumist, aga mõni keeld hoidis kujunduse kokkulepet (brauseri kinnitusakent ei ole, paljaid sildivalijaid ei ole, vana ühist kihti ei kasutata). Neid kokkuleppeid hoiab nüüd ainult ülevaatus ja `AGENTS.md`.

## Kuidas loendati

Iga testifail loeti süntaksipuuks ja iga `assert` liigitati selle järgi, kust tema võrreldav väärtus tuleb: failist loetud lähtekood, tekstikataloog, andmefail või arvutatud tulemus. Pisteline valim (28 rida) näitas, et liigitus eksib umbes ühel juhul kümnest, enamasti kataloogi ja lähtekoodi piiril; arvud on seega täpsed umbes kümnendiku piires. Ajalugu: iga faili `git log`, loetud read, mille commit eemaldas pärast faili loomist.
