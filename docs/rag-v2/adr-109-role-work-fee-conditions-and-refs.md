# ADR-109: rolli tööjuhis pärast allikaid, maksevõime tingimused hinna juures ja viited ainult oma paketist

Kuupäev: 08.10.2026. Seis: kood serveris; mõõdetud Codexi nelja vooruga enne avaldamist (kood oli siis kohalik), kordustest selle koodiga on eraldi kirjas ([ADR-105](adr-105-topic-holds-a-case.md) testi kordus).

## Taust

Codex parandas 08.10.2026 põhikaustas samu vigu, mille pika vestluse test leidis, ja mõõtis oma kandidaati nelja tasulise vooruga (15 pöördumist voorus, kolm rolli; kokku 0,262 USD). Kandidaat jäi kohalikuks, sest kolm viga jäi alles (hinnakirja leidmine, arvuline piir 801/800, redaktsioonivõrdlus). Omanik andis otsuse mulle: „sina oled boss, tegutse“.

Kandidaadis oli neli osa. Kolm on siin; neljas jäi välja.

## Otsus

**1. Rolli tööjuhis iga rolli jaoks eraldi, pärast allikaid** (vestluse juhised 37). Kui pöördel on roll (`dialogue.userRole`, [ADR-107](adr-107-user-role-reaches-the-models.md)), saab mudel selle rolli tööjuhise eraldi `developer`-sõnumina pärast küsimuse ja allikate JSON-i; üldine rollilõik jääb siis juhistest välja. Põhjus: avalik allikas lõpeb sageli elanikule mõeldud juhisega („pöördu sotsiaaltöö spetsialisti poole“) ja ilma selleta jäi viimane sõna allikale. Spetsialist saab oma hindamis- ja korraldustöö sammud, teenuseosutaja oma teenuse kavandamise ja osutamise sammud (otsustuspädevus jääb omavalitsusele), pöörduja selged valikud ja järgmise sammu. Roll tuleb seansist, mitte allikast ega päringu kehast.

**2. Hinna juures maksevõime tingimused** (`FEE_QUALIFICATION_INSTRUCTIONS`, `RERANK_SAFEGUARD_INSTRUCTIONS`). Kui küsitakse tasu või omaosalust, hoiab allikate valik kohaliku hinna kõrval alles kohaldatava maksevõime, soodustuse, vabastuse või individuaalse hindamise sätte ja vastus nimetab selle ka siis, kui kasutaja küsis ainult hinda. Pension ei ole tingimata kogu arvestatav sissetulek. Soodustust, summat ega õigust ei mõelda välja.

**3. Formaalse nõude päring** (otsinguplaan 12, `PLAN_ELIGIBILITY_INSTRUCTIONS`). Kui küsitakse, kas keegi tohib teenust osutada või saada või mis piirang kehtib, kirjutab plaan olemasoleva kolme päringu piires eraldi päringu teenuse formaalsete nõuete kohta, mitte ainult inimese loo sõnadega. Codexi kolmandas voorus ei olnud sugulase piirangut sätestav norm kahe rolli puhul isegi kandidaatide hulgas.

**4. Viited ainult selle pöörde paketist.** Vastuse skeem lubab iga viite kohale ainult käesoleva paketi viitenumbreid (`enum`). Ühes mõõdetud vastuses oli ühe viite kohal string nelja numbriga ja kontroll lükkas vastuse tagasi. Serveri kontroll jääb samaks; viiteid ei arvata ega parandata.

## Mis jäi välja ja miks

**Tagasilükatud asjaolu taastamine** (`state-recovery.js` ja muudatused mälus ja teemavahetuses). See käivitub ainult siis, kui mälu lükkab mudeli pakutud fakti vigase tsitaadi pärast tagasi või mäluseis puudub. Serveri 231 salvestatud pöördes ei juhtunud kumbagi kordagi (tagasi lükati 35 vajadust ja 7 lahtist küsimust, mida taastamine ei kata). Pika vestluse testis kadunud laused olid teist liiki: mudel ei pakkunud neid faktiks üldse, ja selle lahendas 30-sõnumiline teema (ADR-105). Lisaks jäi märge „mälu on puudulik“ pärast teemavahetust püsima, ilma et miski seda kustutaks.

**Allikate valiku puhvrilüliti** (`rerankCachePolicy`, Codexi varasem kohalik muudatus) ei ole siin. Omanik otsustas selle välja jätta: võit on 3–5% pöörde hinnast ja see muutub kahjuks, kui puhvrist loetav osa kasvab üle umbes 22%.

## Kontrollitud

- Ühiktestid: 825, neist 803 läbi ja 22 vahele jäetud. Codexi kandidaadis kukkus üks test (asulate test ootas otsinguplaani versiooni 11); see on parandatud.
- Kohalik andmebaasitest: 83/83 (Codex ei saanud seda käivitada).
- Viitepiirang: serveri 231 salvestatud pöörde peal (81 omavalitsuse kirjetega) on iga viide, mida server vastu võtab, ka mudelile näidatud allikate loendis; ükski avaldatud vastus ei kasutanud viidet väljastpoolt; viited on järjest S1…SN, kõige rohkem 104.
- Codexi mõõtmine (tema kirje järgi): rollikäsitlus ja kõrvalabi vajaduse säilimine paranesid, sugulase piirang leiti lõppvoorus kõigis kolmes rollis, hinnavastustes oli maksevõime tingimus.

## Teada puudused

Codexi lõppvoorust (tema kirje järgi; ei ole selle muudatuse tekitatud, mina neid üle ei kontrollinud):

1. Teenuseosutaja hinnakirja küsimuses jäi koht lahendamata (`attribution_unresolved`) ja kehtivat hinnakirja kandidaatide hulgas ei olnud.
2. Vastus kirjutas allika „suurem kui 801“ kujule „ületab 800“.
3. Redaktsioonivõrdluses väitis vastus muutust, mida kahe redaktsiooni vahel ei olnud.

Kulu: parandused lisavad umbes 5% sisendit pöörde kohta. Codexi voorude kogukulu erines rohkem (kuni +8,6%), aga see tuli sellest, kui tihti vastuse kutse puhvrist luges (2. ja 3. voorus 14 ja 11 kutset 15-st ilma puhvrita, lõppvoorus 3 nagu enne parandusi), mitte juhistest.
