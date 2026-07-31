# Luna RAG pime testpakett — verbosity medium vs low

Koostatud 31.07.2026. Testitav mudel: `gpt-5.6-luna`, `reasoning.effort = medium` mõlemal variandil.
Erinevus on ainult `text.verbosity`: **A = medium**, **B = low**.

See fail on **testijale nähtav**. Vastusevõti on eraldi failis `luna-rag-blind-test-key.md` —
ära ava seda enne, kui kõik vastused on kogutud.

Kõik ülesanded on koostatud elava RAG-registri (5824 dokumenti) vastu ja kontrollitud
allikate sisu, mitte failinimede põhjal.

---

## 1. Isiklik abistaja kolmes vallas

**Kasutaja:** sotsiaaltöötaja, kes valmistab ette kolleegide ühist arutelu.

> Meil tuleb järgmisel nädalal maakonna sotsiaaltöötajate ümarlaud isikliku abistaja teenusest.
> Ma tahaks enne aru saada, kas Jõhvi, Põltsamaa ja Saku vallas on selle teenuse tingimused
> tegelikult erinevad või ainult sõnastuselt. Eriti huvitab, kes üldse tohib isiklik abistaja
> olla ja kui pikaks ajaks teenus määratakse. Kui midagi olulist erineb, siis ütle see välja —
> ma ei taha ümarlauas valet väidet esitada.

**Väljund:** vaba vorm, piisab lühikesest võrdlusest.

**Failivalik (kui platvorm nõuab käsitsi valikut):** kollektsioonid `kov_legal`, `kov_services`,
`national_regulations`.

---

## 2. Üldhooldusteenuse omaosalus ja hooldereform

**Kasutaja:** teenusejuht, kes valmistab ette vallavalitsuse istungit.

> Vallavalitsus tahab teada, mille eest me tohime üldhooldusteenuse puhul inimeselt või
> perekonnalt raha küsida ja mille eest mitte. Meil on laual ka üks vanem analüüs, mida keegi
> soovitas aluseks võtta. Palun selgita, mis on praegu kehtiv kord ja mis on juba möödas —
> ma pean istungil suutma vahet teha, mis on seadus, mis oli reformi kavatsus ja mis on
> lihtsalt varasem uuring.

**Väljund:** selgitus, mille põhjal saab istungil rääkida. Pikkus vaba.

**Failivalik:** kollektsioonid `national_regulations`, `kov_legal`, `national_guidelines`,
`sotsiaaltoo_articles`, `kov_services`.

---

## 3. Dementsushoolduse arengupilt

**Kasutaja:** hooldekodu juhataja, kes kirjutab arendusplaani sissejuhatust.

> Kirjutan meie hooldekodu järgmise aasta arendusplaani. Vajan ausat pilti, kuidas
> dementsusega inimeste toetamine Eestis on viimase kuue-seitsme aasta jooksul liikunud:
> mis on päriselt paranenud, mis on endiselt kitsaskoht ja mis on alles plaan või programm.
> Ma ei taha loosungeid, vaid seda, mida allikad tegelikult ütlevad, ja kust see teadmine pärineb.

**Väljund:** vaba vorm.

**Failivalik:** kollektsioonid `sotsiaaltoo_articles`, `national_guidelines`.

---

## 4. Kas liituda MARAC-võrgustikuga?

**Kasutaja:** KOV-i sotsiaalosakonna juhataja.

> Meie vallas on arutlusel, kas hakata MARAC-i võrgustikutöös osalema. Juhtkond küsib, kas
> sellel on tõendatud mõju ja mida see meilt praktikas nõuab — kes peab kohal olema, kui palju
> aega see võtab, mis juhtub juhtumiga, mis MARAC-i ei sobi. Kui mõju kohta on olemas päris
> hindamine, siis ma tahan teada ka selle piire, mitte ainult häid uudiseid.

**Väljund:** vaba vorm.

**Failivalik:** kollektsioonid `research_reports`, `national_guidelines`, `sotsiaaltoo_articles`.

---

## 5. Juhtum: teade lasteaiast

**Kasutaja:** lastekaitsetöötaja, kes planeerib järgmise päeva tegevusi.

> Eile tuli lasteaiaõpetajalt teade. Ta ütleb, et 5-aastane laps on kolmel hommikul järjest
> tulnud pesemata ja söömata, on väsinud ja jäi eile magama hommikuringis. Õpetaja lisas, et
> teised lapsevanemad on rääkinud, et emal olevat uus elukaaslane ja et kodus käivat öösiti
> vali muusika. Ema on kaks korda vestlusele mitte tulnud, aga on telefonis öelnud, et
> laps on lihtsalt haige olnud. Mul on homme hommikul aeg planeerida.
>
> Aita mul selgeks teha, mis on siin tegelikult teada, mis on kellegi jutt ja mis on minu enda
> oletus — ja mida ma pean kõigepealt tegema.

**Väljund:** järgmise päeva tegevusplaan, praktilises pikkuses.

**Failivalik:** kollektsioonid `national_guidelines`, `organization_guidelines`,
`sotsiaaltoo_articles`, `national_regulations`.

---

## 6. Sama juhtum: uus info

**Kasutaja:** sama lastekaitsetöötaja, järgmisel päeval. **Esita see küsimus samas vestluses
kohe pärast ülesannet 5.**

> Käisin täna kodus. Ema oli kodus, laps oli puhas ja söönud. Ema rääkis rahulikult, aga elukaaslane
> tuli vahepeal tuppa ja ema jäi vait, vaatas tema poole ja ütles siis, et kõik on korras.
> Nägin köögis katkist ust. Ema ütles, et see on vana. Naaber, keda ma trepikojas kohtasin,
> ütles, et nädalavahetusel oli karjumist.
>
> Kas ja kuidas see minu hinnangut muudab? Ma ei taha kellelegi midagi omistada, mida ma
> tõendada ei saa, aga ma ei taha ka olulist märki maha magada.

**Väljund:** vaba vorm.

**Failivalik:** sama mis ülesandes 5, lisaks `research_reports`.

---

## 7. Otsustusmemo: erihoolekande kättesaadavus

**Kasutaja:** KOV-i sotsiaalosakonna spetsialist, kes peab kirjutama ametliku memo.

> Meil on vallas kasvav hulk psüühikahäirega täisealisi, kelle lähedased on hooldamisest väsinud,
> ja mitu inimest on erihoolekandeteenuse järjekorras. Vallavanem palus memo, mille põhjal
> saaks otsustada, kas me peaks midagi ise korraldama või on see riigi asi.
>
> Palun koosta memo, mille ma saan sellisena edasi saata: umbes lehekülg, ametlik toon,
> aga nii et vallavanem saab sellest ka päriselt aru. Peab olema selge, mis on meie kohustus,
> mis on riigi oma, ja millele otsus tugineb.

**Väljund:** ~1 lehekülg, memo vormis.

**Failivalik:** kollektsioonid `national_guidelines`, `research_reports`, `national_regulations`,
`kov_services`.

---

## 8. Kas töövõimereform tasus ära?

**Kasutaja:** valla arendusspetsialist.

> Meie vallavolikogu liige väitis komisjonis, et töövõimereform on tööhõivet parandanud ja
> et me võiksime seetõttu oma tööturumeetmete eelarvet vähendada. Ma pean järgmisel istungil
> ütlema, kas see väide peab paika. Kas materjalide põhjal saab öelda, et reform on tööhõivet
> suurendanud, ja kas sellest saab järeldada midagi meie valla kohta?

**Väljund:** vaba vorm.

**Failivalik:** kollektsioonid `research_reports`, `national_guidelines`, `sotsiaaltoo_articles`.

---

## Testimise kord

1. **Identne sisend.** Mõlemale seadistusele esitatakse täpselt samad küsimused, sama sõnastusega,
   sama failivaliku ja sama vestlusajalooga. Ülesanne 6 peab mõlemal juhul järgnema ülesandele 5
   samas vestluses.
2. **Järjekord.** Esmalt jooksutatakse kogu pakett seadistusega **A (effort medium, verbosity medium)**,
   seejärel kogu pakett seadistusega **B (effort medium, verbosity low)**.
3. **Kordused.** Iga ülesanne käivitatakse **vähemalt kaks korda kummagi seadistusega** (kokku ≥32 vastust).
   Kordused tehakse uues vestluses, et eelmine vastus konteksti ei jääks — v.a paar 5→6, mis
   käib alati koos.
4. **Pime hindamine.** Vastused nummerdatakse ja segatakse enne hindamist. Hindaja ei tohi teada,
   kumb seadistus vastuse andis.
5. **Logimine.** Iga vastuse kohta salvesta: vastamisaeg, sisend- ja väljundtokenid, valitud allikad
   (`selected`) ja kasutajale kuvatud allikad (`displayed`). Need tulevad `rag_trace`-st.
6. **Hindamine.** Kuus kategooriat skaalal 0–3 (vt vastusevõti). Alles pärast kõigi hinnete panekut
   avatakse seadistuste kaardistus.

## Enne testi: kontrolli seadistust

Testi eeldus on, et `reasoning.effort` ja `text.verbosity` on päriselt muudetavad. Kontrolli, et
kasutatavas keskkonnas on aktiivne see `lib/chat/settings.js` + `lib/chat/promptBuilder.js` versioon,
mis loeb `OPENAI_REASONING_EFFORT` ja `OPENAI_TEXT_VERBOSITY` keskkonnamuutujaid. Vanemas versioonis
on effort koodis kõvakodeeritud ja verbosity vaikeväärtus fikseeritud — siis annavad variandid A ja B
identse tulemuse ja test ei mõõda midagi.

Kontrolli ka, et mudel on tõesti `gpt-5.6-luna` (`OPENAI_MODEL`), mitte mõni muu.
