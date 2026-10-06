# ADR-062 — Sätte kuupäevad: muutmismärked ja akti enda kuupäevad andmetena teksti kõrval

01.10.2026. Teostus Claude Opus 5.5. Lähtub 30.09 mõõtmise leiust ([audit](../audits/rag-v2-kov-live-check-2026-09-30.md)). Järgib [ADR-034](adr-034-riigi-teataja-xml-cleanup.md) (muutmismärked tekstist väljas), [ADR-056](adr-056-rt-xml-superscripts.md) (ülaindeksid) ja [ADR-059](adr-059-corpus-refresh-path.md) (värskendamise rada).

## Probleem

- **Mudel näeb redaktsiooni algust, mitte sätte enda kuupäeva.** Allikakaardi `valid_from` on päev, mil see terviktekst kehtima hakkas. Uus terviktekst tekib iga muudatusega, ka siis, kui muudeti ainult preambulit.
- **Märjamaa (30.09).** Vastus ütles, et sünnitoetus (500 + 300 €) kehtib „alates 4. septembrist 2026“, ega osanud öelda, kas see kehtib augustis sündinud lapsele.
  - 04.09.2026 on tervikteksti `401092026014` algus. Sel päeval muudeti ainult preambulit (`401092026001`).
  - § 1 p 1 summad tulid muudatusega `421022026007`: see jõustus 24.03.2026 märkega „rakendatakse alates 01.01.2026“.
- **Kuusalu (30.09).** Vastus nimetas eluasemekulude piirmäära alguseks 15. septembri 2026.
  - 15.09.2026 on tervikteksti `412092026022` algus. Ka siin muudeti ainult preambulit (`410092026016`).
  - Määrus jõustus 01.05.2026 ja § 5 lg 1 ütleb: „Määrust rakendatakse alates 01.05.2026.“
  - 30.09 auditi märkmetes seda lauset ei ole. Vastus tuleb enne 2. etapi mõõtmist serveri salvestatud pöörete seast üles leida.
- **Põhjus:**
  - Lugeja jätab iga muutmismärke (`muutmismarge`) tekstist välja (ADR-034). Märke kuupäevi ei ole kimbus ega Postgresis, ainult algses XML-is.
  - Juhis käsib võrrelda küsitud kuupäeva `valid_from`-iga ja öelda iga summa juures selle kehtivusaeg. Kaardil on kuupäevadest ainult `publication_date` ja `valid_from`.
- **Ulatus:** 519 indekseeritud aktist 278-l on kirjas muudatus, mis jõustus redaktsiooni alguspäeval. Nende `valid_from` ei ütle, millal ülejäänud sätted kehtima hakkasid.

## Otsus

Muutmismärked ja akti enda kuupäevad loetakse sisestamisel andmeteks teksti kõrvale ja näidatakse mudelile vastamise ajal. Tekst, lõigud ja vektorisisendid ei muutu.

- Ainult see lahendus annab mõlemal juhul õige kuupäeva: Märjamaal § 1 p 1 märkest, Kuusalus § 5 lg 1 tekstist.
- Iga hilisem akt saab andmed tavalise sisestusega, lisasammuta.
- Kõrvaltabelit ja ainult juhise parandust ei tehta.

### Andmed (lugeja `source-structure-v30`)

- **`source_units[i].amendments[]`** on paragrahvi teksti sees olevad märked:
  - `provision` (näiteks „§ 1 p 1“), `offset`, `path`;
  - `act_reference`, `rt`, `published`, `in_force`;
  - vajadusel `adopted`, `applies_from`, `note`, `repeal`.
- **Väljade tähendus:**
  - `provision` on säte, mille sees märge on. Märge paragrahvi pealkirjas kuulub paragrahvile.
  - `offset` on paragrahvi teksti pikkus enne märget, seega sätte teksti lõpp. Märge kuulub lõigule, mille allikavahemikus on `start < offset <= end`: lõpp loeb, algus mitte.
    - Nii on iga 11 290 märkest täpselt ühes lõigus.
    - 3423 märget on täpselt lõigu lõpus. Vastupidise reegliga (`start <= offset < end`) jääksid need lõiguta.
  - `rt` on Riigi Teataja viide: „RT IV, 21.03.2026, 7“. Enne 2010. aastat avaldatul on see aasta ja numbriga („RT I 2010, 22, 108“) ning `published` puudub.
  - `in_force` on muudatuse jõustumine selle sätte jaoks (`joustumine`). Avaldamispäevast varasem päev jääb välja (`null`), vt allpool.
  - `note` on märke enda sõnad ja jääb alati alles. Piir on 2000 tähemärki: nii palju loeb lugeja märke sõnu. Pikim registreeritud märge on umbes 600 tähemärki.
  - `applies_from` tekib ainult siis, kui märge on tervenisti lause „rakendatakse [tagasiulatuvalt] [alates] <kuupäev>“. Osa sätete kohta käiv märge („lõikeid 1–3 rakendatakse …“, „osaliselt …“) jääb ainult sõnadeks.
    - Tegusõna loetakse ka kujul „rakendatake“, „rakendatatakse“ ja „rakend.“. Registreeritud aktides on igaüht üks ja ükski teine sõnastus nii ei alga.
  - `repeal` on kehtetuks tunnistamise märge: „Kehtetu“, väikese tähega „kehtetu -“ või „välja jäetud“.
- **`document.fields.legal_text`** (`rag-v2/legal-text-1`) on akti enda kuupäevad:
  - `text_kind`, `adopted`, `original_reference`, `original_published`, `act_in_force_from`, `version_from`;
  - `history[]`: akti muutnud aktid;
  - `version_change { in_force, acts, provisions }`: mida redaktsiooni alguspäeval jõustunud muudatus muutis. `acts` on ajaloo aktid, mis jõustusid sel päeval või mida selle päeva märge nimetab (ajalugu ütleb osalise jõustumise ainult sõnadega: „osaliselt 01.01.2027“);
  - `structure[]`: märked väljaspool paragrahvi teksti (preambul, pealkiri, peatükk või jagu, lisa pealkiri, tervenisti kehtetu paragrahv);
  - `entry_into_force[]`: akti enda sätted, mis nimetavad rakendamise või jõustumise päeva, koos allikaüksuse ja teega.
- **`act_in_force_from`** on tervikteksti puhul `vastuvoetud/joustumine`, nii nagu allikas selle annab.
  - Muutmata algtekstil (`algtekst-terviktekst`, `algtekst`) on see kehtivuse algus. `joustumine` loetakse ainult siis, kui kehtivuse algust pole.
    - Põhjus: Otepää `405072022009` kirjel on `joustumine` 01.07.2022, akt avaldati 05.07.2022 ja kehtib 08.07.2022. 01.07 on rakendamise päev (§ 4: „Määrust rakendatakse alates 1. juulist 2022. a.“).
    - 262 registreeritud algtekstist on see ainus, kus need kaks päeva erinevad.
  - `original_published` on vastuvõtmise kirjes nimetatud avaldamispäev. Vana kujuga viitel (aasta ja number) ja algtekstil see puudub.
  - **Tervikteksti päev, mis on sellest avaldamispäevast varasem, jääb alles.** Aruandesse tuleb hoiatus `act_in_force_before_publication` mõlema päevaga.
    - Selliseid akte on seitse. Ühelgi ei viita miski valele päevale:
      - neli võeti vastu 2007–2012 ja avaldati Riigi Teatajas pärast jõustumist (3 päeva kuni 5,8 aastat hiljem): Viljandi `403052024057`, Tartu `411122015006`, Narva `405032016008`, Ruhnu `417032016009`;
      - kolmel pole kirjes algteksti avaldamismärge, vaid hilisem, mis avaldati pärast akti esimesi muudatusi: Saue `402092026040`, Harku `404072025017`, Setomaa `413022026022`;
      - kolmel ütleb akti enda säte sama päeva: Ruhnu § 5 lg 2 „Määrus jõustub 03.10.2012. a.“, Saue § 31 lg 2, Tartu § 5 lg 3.
    - Seepärast ei jäeta päeva välja nagu märke puhul. Lugejas kaotatut ei saa ilma uue sisestuseta tagasi; alles jäetut saab näitamisel välja jätta, sest avaldamispäev on kõrval.
    - See on teadaolev hoiatus samadel põhjustel kui märke oma: vastuolu on allikas, ülevaataja seda parandada ei saa ja see kordub akti igas redaktsioonis.
    - Võrdlusskript loetleb need aktid (`act_in_force_before_publication_acts`).
- **Lisaks plaanile:** kui akti vastuvõtmise kirjel on oma sõnad („Rakendatakse alates 01.01.2025“), jäävad need väljale `adoption_note` ja nende kuupäev väljale `act_applies_from`. Loetakse nagu märke sõnu. Nii ei ole selle pärast vaja akte hiljem uuesti sisestada.
- **Märge, mille kohta tekst ei kinnita,** jääb alles `offset: null`-iga ja aruandesse tuleb hoiatus `amendment_note_position_unresolved`. See pole teadaolev hoiatus, seega `refresh review` jätab akti inimesele otsustada ega katkesta värskendust.
- **Märge, mille jõustumispäev on varasem kui märke enda avaldamispäev,** jääb alles ilma selle päevata (`in_force: null`). Aruandesse tuleb hoiatus `amendment_note_in_force_before_publication` sätte ja mõlema päevaga. Päeva ei parandata ega arvata.
  - Selliseid on praegu üks 15 369 märkest: Haljala `429012022009` § 2 lg 1 p 4.
    - XML-is on `joustumine` 2020-02-01. Muutev akt `429012022005` avaldati 29.01.2022 ja akti ajalugu annab jõustumiseks 01.02.2022. Aastaarv on Riigi Teatajas valesti.
    - Märke sõnad („rakendatakse alates 1.01.2022“) ja `applies_from` jäävad alles.
  - Erand on Riigikohtu otsus (26 märget): see jõustub otsuse päeval ja avaldatakse hiljem. Selle päev jääb alles.
  - See on teadaolev hoiatus (`KNOWN_WARNINGS`, [ADR-059](adr-059-corpus-refresh-path.md)): `refresh review` võtab akti sisse ja kirjutab standardmärkuse. Põhjused:
    - viga on allikas ja ülevaataja seda parandada ei saa;
    - sama märge kordub akti igas järgmises redaktsioonis, nii et peatuks iga värskendus;
    - vale päev on andmetest juba väljas.
  - Võrdlusskript loetleb sellised aktid (`in_force_before_publication_acts`).
- **Tekst loetakse täpselt nagu `v29`.** `v30` on lisatud ülaindeksite loendisse (`SUPERSCRIPT_NORMALIZATIONS`, ADR-056).

### Järjekord: kaks etappi

1. **1. etapp: see PR ja korpus v47.** Lugeja ja kimbu andmed. 519 Riigi Teataja akti sisestatakse uuesti. Kimpude tekst ja lõigud jäävad samaks; sama tõenduse korral näeb mudel sama, mis enne. Võrdse skooriga lõikude järjekord otsingus võib muutuda (vt „Mida 1. etapp ei tõenda“).
2. **2. etapp: PR 2.**
   - Mudeli kontekst (`model-context-json-3`): kaardile `act_dates`, lõigule `amendments`. Need jäävad eelarvemõõtudest välja ja saavad oma piiri, 1500 tokenit.
   - Dialoogi juhis 22: `valid_from` valib redaktsiooni ega ütle, millal säte või summa kehtima hakkas.

Miks kahes osas:

- v47 mõju otsingule saab mõõta enne, kui mudeli sisend muutub.
- Juhis ei lähe välja mõõtmata. PR 2 mõõdetakse enne avamist ajutises koopias v47 peal kahe küsimusega (Märjamaa, Kuusalu).

Pärast 1. etappi võib vale „kehtib alates 4. septembrist“ veel esineda. Töö võib 1. etapi järel peatada.

## Mida 1. etapp tõendab

- **Tekst ei muutu.** `node scripts/rag-v2-reader-compare.mjs --store tmp/rag-v2-corpus-store-v25` loeb iga indekseeritud akti salvestatud XML-i uuesti ja võrdleb salvestatud versiooniga. Pealkiri, väljaandja ja omavalitsus tulevad registrist, nagu päris sisestusel. Kohalikul hoidlal 01.10.2026:
  - 519 aktist 519 on identsed: allikaüksused, tekstivahemikud, lõigud (tekst, otsingutekst, allikakohad, vektorisisendi räsi) ja XML-ist loetud dokumendiväljad;
  - väljad on pealkiri, väljaandja, akti viide, kehtivuse algus ja lõpp, lõputa kehtivuse märge (`valid_to.open_end`), avaldamispäev ja akti liik. Need on allikakaardil ja kehtivusfiltris; lõikude võrdlus neid ei näe;
  - registri metaandmed on igal aktil samad, millest salvestatud versioon tehti (põhjus `metadata`). Skript võtab registri enda kirje, nagu sisestuse plaan, ja võrdleb selle räsi versiooni `metadata_hash`-iga. Seega erineb uue versiooni ID vanast ainult lugeja sildi võrra. Lõikude võrdlus seda ei näe: sama nimega, aga teise ID-ga omavalitsus muudaks ainult akti piirkonda;
  - 13 669 vektorisisendit 13 669-st on juba olemas, seega server ei osta ühtegi vektorit;
  - register nimetab iga akti faili üks kord ja see on sama fail, mis hoidlas. Kui mõni erineb või puudub, lõpeb skript veaga;
  - ühelgi märkel ei puudu koht;
  - ühel märkel on jõustumispäev välja jäetud (Haljala `429012022009`);
  - seitsmel aktil on akti jõustumispäev varasem kui vastuvõtmise kirje avaldamispäev (`act_in_force_before_publication_acts`).
- **Märkeid on:**
  - 11 290 paragrahvi tekstis: 440 `applies_from`-iga, 526 oma sõnadega, 1014 kehtetuks tunnistamist;
  - 2168 väljaspool paragrahvi teksti ja 1911 kirjet aktide ajaloos;
  - 63 vana kujuga Riigi Teataja viidet kolmes aktis;
  - `version_change` 278 aktil (igaühel vähemalt üks akt), `entry_into_force` 332 aktil, `adoption_note` 47 aktil (32 annavad kuupäeva);
  - ühel aktil puudub `act_in_force_from` (Kambja `414032026010`: jõustumise päeva XML-is pole, on „Rakendatakse alates 01.01.2025“).
- **Kõrvutus commit'itud `v29` lugejaga** kõigil 564 registreeritud XML-il: 562 annavad uusi välju arvestamata sama tulemuse, kaks lükkavad mõlemad lugejad sama veaga tagasi. Aruande hoiatused erinevad kaheksal aktil: Haljala `429012022009` ja seitse akti, mille jõustumispäev on avaldamispäevast varasem, saavad uue hoiatuse.
- **`tests/rag-v2-legal-dates.test.mjs`** (päris XML-id `401092026014` ja `412092026022`):
  - Märjamaa § 1 p 1: `in_force` 2026-03-24, `applies_from` 2026-01-01, märge „rakendatakse alates 01.01.2026“, akt `421022026007`;
  - Märjamaa `version_change`: 2026-09-04, ainult preambul;
  - Kuusalu: §-des märkeid pole, `entry_into_force` on § 5 lg 1, `act_in_force_from` 2026-05-01;
  - lõikude tekst, otsingutekst ja vektorisisendi räsi on samad, mis `v29` lugejal (`tests/fixtures/rag-v2-legal-dates-v29.json`); räsid on samad, mis korpuse salvestatud versioonidel;
  - mudeli kontekst on sama, mis `v29` kimbul: uued andmed mudelini ei jõua;
  - võrdlusskript töötab ajutise hoidlaga. Selle lõpetavad veaga:
    - teise omavalitsusega register (põhjused `chunks` ja `metadata`);
    - sama nimega, aga teise ID-ga omavalitsus (ainult `metadata`: lõigud ja vektorisisendid on samad);
    - register, mis akti faili ei nimeta või kus faili pole;
    - salvestatud versioon, mille `valid_from` erineb loetust või mille kehtivuselt puudub lõputa kehtivuse märge (põhjus `fields`).
- **`tests/rag-v2-source-structure.test.mjs`:**
  - märgete nimed ja kohad, ka pealkirja sees oleval märkel ja kehtetu lisa pealkirjal;
  - `applies_from` kõigil 36 kujul, mis registreeritud aktide märgetes esinevad, iga kuu ja tegusõna kolm vigast või lühendatud kuju;
  - osa sätete kohta käiv märge jääb sõnadeks;
  - „välja jäetud“ on `repeal`; pikkusepiir ei lõika tähemärki pooleks;
  - `legal_text` tervikteksti ja algteksti puhul, vana kujuga viide, sõnadega antud osaline jõustumine, vastuvõtmise kirje sõnad;
  - algteksti `act_in_force_from` on kehtivuse algus ka siis, kui vastuvõtmise kirjel on teine päev (Otepää kuju); kehtivuse alguseta loetakse kirje päev;
  - tervikteksti avaldamispäevast varasem jõustumispäev jääb alles ja annab teadaoleva hoiatuse (Ruhnu kuju);
  - kohata märke hoiatus, mis peatab automaatse ülevaatuse;
  - märke avaldamispäevast varasem jõustumispäev jääb välja ja annab teadaoleva hoiatuse; Riigikohtu otsuse päev jääb alles;
  - päev, mida kalendris pole (30. veebruar), ei ole päev;
  - märke sõnu ja lauset loetakse kuni 2000 tähemärki.
- **`tests/rag-v2-search.test.mjs`:** generatsioonide erinevuse liigitus (`generationDifference`, vt „Edasi“).
- **`tests/rag-v2-legal-references.test.mjs`:** `v30` hoiab ülaindeksid.
- **Mudeli pool on puutumata:** `lib/rag-v2/pilot`, `search/model-context.js` ja `search/retrieval.js` ei muutunud.

## Mida 1. etapp ei tõenda

- **Otsingu järjekord võib võrdsete skooride korral muutuda.**
  - Üksuse ID tuleb versiooni ID-st. Uuesti sisestatud versioon saab uue ID, seega muutuvad kõik 13 669 üksuse ID-d.
  - Võrdse skooriga lõigud järjestatakse üksuse ID järgi (`ranking.js` `rrf`, `postgres.js` leksikaalne päring, `qdrant.js`, `dependencies.js`). ID on räsi, seega võib iga võrdse skooriga paari järjekord vahetuda.
  - Näide: kaks lõiku, kumbki oma päringuvariandi vektorkanalis esimene, saavad sama skoori. Kumb on ees, otsustab ID (`tests/rag-v2-search.test.mjs`).
  - Vahetus võib muuta, milline lõik jõuab ümberjärjestaja 30 kandidaadi või 9 tõenduslõigu hulka.
- **Kui sageli päris küsimustel skoorid võrdsed on, pole mõõdetud.** Seda näitab võrdlus serveris (allpool).
- **Viigilahendust see PR ei muuda.**

## Edasi

- **Korpus v47** [runbook'i](runbook-corpus-increment.md) järgi: valikusse 519 akti `legal-acts-in-index.json`-ist, ingest, `refresh review`, avaldamine, `refresh package`.
  - Haljala `429012022009` ja seitse akti hoiatusega `act_in_force_before_publication` läbivad ülevaatuse teadaoleva hoiatuse standardmärkusega.
  - `refresh package` annab versioonikaustad `tar`-ile failis (`ship-files.txt`). Käsureal ei mahtunud 519 kausta Windowsi piiri sisse.
- **Server:** `rag-v2-corpus-run.sh 47 46 <plaanifail> 0.01 …`. Piir on meelega üks sent: plaan peab näitama `external_inputs: 0` ja ootamatu ost peatub kinnitusel.
- **Tõend:** `rag-v2-generation-compare.mjs` v46 ja v47 vahel, samade küsimuste, plaanide ja vektoritega.
  - Skript trükib iga küsimuse tõenduslõigud kujul `dokument#koht` ja konteksti tokenid ning võrdleb ka neid. Nii võrreldakse ka ankruta küsimusi.
  - Erineva küsimuse real on `class` (`generationDifference`, `lib/rag-v2/search/evaluator.js`):
    - `equal_score_order_only`: kõik kanalid andsid mõlemas generatsioonis samad lõigud samade skooridega (`same_scores: true`) ja tõenduses on samad lõigud teises järjekorras;
    - `different`: kõik muu. Ka siis, kui `same_scores` on `true`.
  - `same_scores` ütleb ainult, et kanalid andsid sama. Seda, et mudelini jõuab sama, see ei ütle:
    - sama tõendus suurema kontekstiga on `different`. Nii näeks välja uute andmete leke allikakaardile;
    - sama tõendus teise ankrutulemusega on `different`;
    - lisandunud või vahetunud lõik on `different`;
    - kaks viimast võib tuua ka võrdsete skooride vahetus (ankru koht kandidaatide seas, lõik piiril). Skript seda ei eelda: sellise rea vaatab inimene üle.
  - **Läbimise tingimus:** `compared.different` on 0. Iga `different` peatab töö. `compared.equal_score_order_only` küsimused loetle aruandes ja vaata nende `pool_all` ja `anchor_ranks`. Järjekord üksi muudab `context_tokens` kuni ühe tokeni võrra (salvestatud kimpude lõigud, 1200 juhuslikku ümberjärjestust: vahe 0 või ±1); suurema vahega ümberjärjestatud rea loeb skript ise `different`-iks.
  - Uut väljundit on proovitud ainult asendusteenustega, ilma Postgresi ja Qdrantita. Päris indeksil käib see esimest korda v47 võrdluses.
- Seejärel 2. etapp.

## 2. etapi jaoks

- **Paragrahvi enda märge** asub paragrahvi esimeses lõigus. Neid on 553, kehtetuks tunnistamisi arvestamata 546.
  - Selle tunneb ära `path` järgi: lõpeb `/paragrahv[n]/muutmismarge[k]`.
  - `provision` üksi ei eristu: „§ N“ on veel 898 märkel, mis on numbrita lõike või pealkirja sees.
  - 24 paragrahvi on jagatud mitmeks lõiguks: seal tuleb märge siduda paragrahvi kõigi lõikudega, muidu jääb 38 lõiku märketa.
  - **Parandus 2. etapi ülevaatusest:** see märge on pealkirja järel ja käib pealkirja kohta. Terve paragrahvi kohta käib ta ainult koos sama muudatuse märkega paragrahvi lõpus. Kehtiv reegel on allpool („Paragrahvi märked“).
- **Osa, peatüki või jao märge ei ütle, kas jagu lisati või muudeti ainult selle pealkirja.** Selliseid märkeid on 503, 42 aktis (kehtetuks tunnistamisi arvestamata).
  - Pealkirja muutus: riigilõivuseaduse `111072026166` 5. peatüki märge on 01.01.2025. Selle all olevatel §-del 72–75 märget pole ja seadus jõustus 01.01.2015. Kui peatüki märge seotakse iga alloleva lõiguga, saavad need vale päeva.
  - Lisatud jagu on ülaindeksiga numbriga („10¹. jagu“): 87 jagu, nende all 410 paragrahvi. Kümnel paragrahvil pole ühtegi oma märget ja päeva annab ainult jao märge:
    - `404072025017` §-d 34¹ ja 34² (10¹. jagu, 08.01.2021), §-d 34⁷–34⁹ ja 34¹¹–34¹³ (10³. ja 10⁴. jagu, 09.12.2024);
    - `429012026051` §-d 38¹ ja 38² (12¹. jagu, 01.09.2025).
  - Reegel: jao märge käib jao pealkirja kohta, välja arvatud ülaindeksiga numbriga jao puhul. Mõlemad juhud tuleb enne PR 2 mõõta.
  - Andmetest piisab: `structure[].path` on üksuse `locator.path` algus ja `target` algab jao numbriga.
- **`entry_into_force` on dokumendi järjekorras ja sisaldab ka üksiku sätte ülemineku- ja lõpptähtajaga reegleid** (412 kirjet 332 aktis, 11 aktil üle kolme). Sotsiaalhoolekande seaduses on akti enda jõustumislause alles kolmas. Enne kolme kirje piiri tuleb valida terve akti laused („Määrus jõustub …“, „Määrust rakendatakse …“). Tekst on sõna-sõnalt alles, uut sisestust pole selleks vaja.
  - Kolm kirjet nimetavad ainult teise akti vastuvõtmise päeva: „kohaldatakse Saaremaa Vallavolikogu 26.04.2019. a määruse nr 7 … sätteid“ (`408092021001`, `423122025040`, `426092026047`). Need tuleb näitamisel välja jätta.
  - Lugeja neid välja ei jäta. Sama kujuga lauses võib olla ka akti enda päev: Tallinna `423052026004` § 6 „Määrus jõustub … 15. detsembri 2022 määruse … jõustumisel, kuid kõige varem 1. jaanuaril 2023“. Proovitud filter kaotas selle lause, ja lugejas kaotatut ei saa ilma uue sisestuseta tagasi.
- **Tühi `version_change.provisions` tähendab „pole teada“, mitte „midagi ei muutunud“.** Praegu ühel aktil 278-st: Haljala `429012022009`. Muutev akt jõustus redaktsiooni alguspäeval, aga ainsa märke päev on allikas vale.
- **Allika vastuolud jäävad andmetesse.** Juhis ja esitus peavad ütlema, kumb kehtib.
  - Osal aktidel nimetab lause „Määrus jõustub <päev>“ teist päeva kui `act_in_force_from` (ülevaatuse loenduses 17).
  - Otepää `405072022009` (algtekst): kirje `joustumine` on 01.07.2022, akt avaldati 05.07.2022. `act_in_force_from` on kehtivuse algus 08.07.2022. 01.07 on alles § 4 lauses (`entry_into_force`).
  - Ruhnu `417032016009` (terviktekst): `act_in_force_from` on 03.10.2012, `original_published` 06.10.2012. Sama päeva ütleb § 5 lg 2.
  - Veel kuuel tervikteksti aktil on `act_in_force_from` varasem kui `original_published`: `402092026040`, `403052024057`, `404072025017`, `405032016008`, `411122015006`, `413022026022`. Vahe on 163 päevast 8,7 aastani.
  - Esitus saab need seitse ära tunda: `act_in_force_from < original_published`.

## 2. etapp: mida mudel näeb

PR 2. Kood: `lib/rag-v2/search/legal-dates.js`, `model-context.js`, `retrieval.js`, `unified.js`, `context-replay.js`, `pilot/retrieval-plan.js`, `pilot/dialogue.js`, `pilot/service.js`.

### Mis on kontekstis (`rag-v2/model-context-json-3`)

- **Allikakaardi lõpus `act_dates`:**
  - `act_in_force_from`: päev, mil akt esimest korda jõustus;
  - `changed_on_valid_from`: mida muutis muudatus, mis alustas seda redaktsiooni (kuni 12 sätet; rohkem on `changed_on_valid_from_count`). Nimed on samad, mis lõikudel;
  - `changed_on_valid_from_notes`: selle muudatuse märked osade kohta, millel lõiku ei ole (preambul, lisa, jagu, tervenisti kehtetu paragrahv), kui märkel on rakendamise päev või oma sõnad. Kirjed on samal kujul nagu lõigu `amendments`;
  - `entry_into_force[{ provision, text }]`: akti enda laused terve akti jõustumise või rakendamise kohta (kuni 3);
  - `scoped_rules[{ provision, text }]`: akti enda laused üksiku sätte, summa või ülemineku kohta (ainult siis, kui neid on kuni 3);
  - `entry_into_force_more`: näitamata lausete arv.
- **Lõigul `source_locations` ja `text` vahel `amendments`:** kirjed `{ provisions, in_force | repealed_from, applies_from?, note? }`.
  - Sama päeva ja samade sõnadega märked on ühes kirjes.
  - Muutva akti viidet ja Riigi Teataja viidet mudelile ei näidata. Need jäävad kimpu.
  - `provisions` nimetab, mille kohta märge käib:
    - säte: „§ 1 p 1“, „§ 71 lg 5“;
    - terve paragrahv või lisatud lõige: „§ 13²“, „§ 142⁴⁷ lg 3¹“;
    - paragrahvi pealkiri: „§ 5 pealkiri“;
    - lõike sissejuhatav lauseosa: „§ 2 sissejuhatav lauseosa“, „§ 70 lg 1 sissejuhatav lauseosa“;
    - viimane säte või terve paragrahv: „§ 9 lg 6 või kogu § 9“;
    - viimane punkt või terve lõige: „§ 91 lg 2 p 2 või kogu § 91 lg 2“;
    - lisatud jagu oma nimega: „10¹. jagu Varjupaigateenus“;
    - lähim märkega jagu, kui lisatud paragrahvil oma märget ei ole: „15. jagu Vaimse tervise teenus“.
- **Märjamaa `401092026014`, § 1 lõik:**
  - kaart: `"act_dates":{"act_in_force_from":"2018-07-01","changed_on_valid_from":["preambul"],"entry_into_force":[{"provision":"§ 4","text":"Määrus jõustub 1. juulil 2018."}]}`
  - lõik: `"amendments":[{"provisions":["§ 1 p 1","§ 1 p 2"],"in_force":"2026-03-24","applies_from":"2026-01-01","note":"rakendatakse alates 01.01.2026"},{"provisions":["§ 1 p 3"],"in_force":"2025-01-01"}]`
- **Kuusalu `412092026022`, § 3 lõik:**
  - kaart: `"act_dates":{"act_in_force_from":"2026-05-01","changed_on_valid_from":["preambul"],"entry_into_force":[{"provision":"§ 5 lg 1","text":"Määrust rakendatakse alates 01.05.2026."}]}`
  - lõigul `amendments` puudub, sest §-s 3 märget ei ole.
- **Andmeteta allikas** (varasema lugeja kimp, PDF, JSON-kirje, aktist tuletatud lisa) on sama mis `json-2`-s. Muutub ainult skeemi silt.
- **Tõendus kannab andmeid väljal `legal_dates`** (`sourceEntry`). Väärtus sõltub ainult kimbust ja lõigust, mitte päringust.

### Paragrahvi märked

Reeglid tulid 2. etapi ülevaatustest. Riigi Teataja paigutus on loetud 519 indekseeritud aktist ja redaktsioonipaaridest (sama akti kaks redaktsiooni registreeritud XML-ide seas).

- **Märge kohe pealkirja järel käib pealkirja kohta:** „§ N pealkiri“, ainult selles lõigus, kus pealkiri on.
  - Selliseid on 333, 58 aktis. Paragrahvi sätteid see ei dateeri.
  - Riigilõivuseadus `111072026166` § 53: pealkirja märge on 01.09.2025, „põhihariduse puhul 500 eurot“ selle all on märketa.
  - Tallinn `417062026033` § 5: pealkiri ja lg 1 muutusid 14.06.2026, lg 2 ja lg 3 ei muutunud.
  - 1707 lisatud paragrahvist 1516-l pealkirja märget ei ole: nii Riigi Teataja uut paragrahvi tavaliselt ei märgi.
  - **Erand: lisatud paragrahvi (ülaindeksiga number) varaseim märge on see, millega paragrahv lisati,** ka siis, kui see on pealkirja järel. Siis „§ N“, igas lõigus. 7 paragrahvi 5 aktis.
    - Tingimused: paragrahvis pole vanemat märget, sama muudatuse teist märget ega terve paragrahvi märget.
    - Rapla `405092026058` § 52¹ ja § 52²: algtekstis neid ei ole, ainus lisamise märge on pealkirja järel (12.09.2025). Enne jäid § 52¹ lg 1 ja lg 2 p 1, 2, 4, 5 kuupäevata.
    - Redaktsioonipaarides lisati kõik viis sellist paragrahvi just selle märkega (ülevaatuse mõõtmine).
    - Kui sama muudatus märkis ka sätteid, jääb märge pealkirja omaks: muudatus märkis muudetu ükshaaval (`411062026102` § 13¹, riigilõivuseadus § 142⁸⁴).
- **Paragrahvi lõpetav märge** (viimane asi paragrahvi tekstis) on XML-is viimase lõike või punkti sees. Neid on 3395.
  - **Paar:** sama muudatuse ainsad kaks märget on pealkirja järel ja paragrahvi lõpus ning ütlevad sama (samad sõnad ja sama `applies_from`). Paragrahv sõnastati tervenisti uuesti: „§ N“, igas lõigus. 204 paragrahvi (Kohtla-Järve `412122024021` § 31).
    - Kui pealkirja märkel on oma sõnad, mida lõpetav märge ei ütle, siis paari ei ole. Pealkirja märge jääb „§ N pealkiri“ koos oma sõnadega ja lõpetav märge loetakse tavareeglite järgi.
    - Lastekaitseseadus § 27² (`131122024023`, `111072026042`, `111072026043`): pealkirja märge ütleb „muudetud paragrahvi number 27¹ numbriks 27²“, teine märge on lõikel 4 ilma sõnadeta. Nüüd on kirjed „§ 27² pealkiri“ (sõnadega) ja „§ 27² lg 4“.
    - Enne jäi pealkirja märge varju ja terve paragrahv sai päeva 01.01.2025, kuigi paragrahv oli enne olemas numbriga 27¹. Kõigis registreeritud XML-ides on see ainus paragrahv, kus paari kaks märget ütlevad eri asja.
  - **Ülaindeksiga number** („§ 13²“): lõpetav märge on see, millega paragrahv lisati. „§ N“, igas lõigus. 853 paragrahvi 55 aktis.
    - Sotsiaalhoolekande seadus `130062026065`: §-d 13², 13³, 13⁴ ja 155¹ on uued ja § 13¹ sõnastati uuesti. Igaühel on üks märge, viimasel lõikel. § 13² lg 1–7 on lõigus, kuhu see märge koha järgi ei jõuaks.
  - **Tavaline number:** märge on kas viimase sätte või terve paragrahvi oma. Ühest redaktsioonist seda öelda ei saa, seega ütleb silt mõlemat: „§ 9 lg 6 või kogu § 9“, igas lõigus. 595 märget 137 aktis.
    - Redaktsioonipaarides oli viiest sellisest uuest märkest kaks terve paragrahvi omad: Tori `430092026027` § 9 (sünnitoetus) ja lastekaitseseadus `111072026043` § 29.
  - **Terve paragrahvi oma ei ole** lõpetav märge siis, kui paragrahvis on vanem märge (paragrahv oli enne olemas; 443) või sama muudatuse teine märge (muudatus märkis sätted ükshaaval; 486). Punktis olevat märget loetakse siis lõike tasemel (järgmine reegel).
  - Numbrita lõike lõpetav märge on paragrahvi oma: „§ N“ (888; nii nimetab seda juba lugeja).
- **Lõiget lõpetav märge on XML-is lõike viimase punkti sees.** Sama reegel üks tase allpool. Selliseid on 781; neist 91 lõpetavad ka paragrahvi ja on loetud eelmise reegli järgi terve paragrahvi omaks või sildiga „või kogu § N“.
  - Riigi Teataja enda sõnad: Rakvere `407052026045` § 10 lg 8, märge punktis 2 ütleb „§ 10 lg 8 rakendatakse alates 01.01.2027“.
  - **Ülaindeksiga lõige** („§ 142⁴⁷ lg 3¹“): märge on see, millega lõige lisati. „§ N lg K“, igas lõigus, kus on osa lõikest. 85 lõiget 22 aktis.
  - **Tavaline number:** märge on kas viimase punkti või terve lõike oma: „§ 91 lg 2 p 2 või kogu § 91 lg 2“, igas lõigus, kus on osa lõikest. 355 märget 94 aktis.
    - Türi `411062026105` § 91 (sünnitoetus): mõlemad osad tõusid 01.01.2027 350 eurolt 500-le, märge on punktis 2. Enne oli punkt 1 kuupäevata ja kaart näitas, nagu poleks see muutunud.
    - Redaktsioonipaarides oli 14 sellisest uuest märkest 5-l muutunud rohkem kui viimane punkt (ülevaatuse mõõtmine).
  - **Viimase punkti oma** on märge siis, kui lõikes on vanem märge (118) või sama muudatus märkis lõikes veel mõne punkti (132).
    - Sama muudatuse kehtetuks tunnistatud tühi punkt pärast märget loeb samuti (lastekaitseseadus `111072026043` § 15 lg 2: p 3 muudeti ja p 4 tunnistati kehtetuks).
    - Tühjaks jäänud punktide numbrid märke ja lõike lõpu vahel ei ole tekst: märge lõpetab lõike ikka.
- **Märge lõike sissejuhatava lauseosa järel, kui punktid järgnevad,** käib selle lauseosa kohta.
  - Numbrita lõige: „§ N sissejuhatav lauseosa“ (10).
  - Numbriga lõige: „§ 70 lg 1 sissejuhatav lauseosa“ (176 märget 53 aktis). Enne oli silt „§ 70 lg 1“, mida sai lugeda terve lõike kohta.
    - Redaktsioonipaarides oli üheksast üksi seisvast uuest märkest viiel punktid muutmata (`409052026032` § 70 lg 1: kuus punkti). Kahel muutus osa punkte ja kahel oli terve lõige uus.
    - Kui punktid on tühjaks jäetud, on lõikes ainult see lauseosa ja silt on „§ N lg K“ (`403032026033` § 74 lg 1).
  - Sissejuhatava lauseosa märge ei tee lõiget lõpetavat märget viimase punkti omaks. Neljast lõikest, kus sama muudatus märkis ainult lauseosa ja viimase punkti, oli kolmes muutunud rohkem (`419082025017` § 35 lg 1: kuus punkti seitsmest).
  - Enne nimetati pealkirja, sissejuhatava lauseosa ja teksti märget kõiki „§ N“. 29 lõigul oli „§ N“ kahe eri päevaga (Tallinn `423052026004` § 4¹). Nüüd ei ole ühelgi.
- **Sätte märge on igas lõigus, kus on osa sellest sättest.** 50 sätet on jagatud mitme lõigu vahel.
  - Sotsiaalhoolekande seadus § 71 lg 5 algab paragrahvi esimeses lõigus ja lõpeb teises. Märge 01.01.2026 on nüüd mõlemas.
  - Sätte algus leitakse paragrahvi tekstist sätte numbri järgi („(5)“, „3)“). Lõik, mis lõpeb sätte numbriga, sätet ei sisalda.
- **Kaardi `changed_on_valid_from` kasutab samu nimesid.** Lugeja nimetab lõpetava märke viimase sätte järgi („§ 13² lg 10“); kaardil on „§ 13²“. 257 kaardist 100-l on mõni nimi teine kui lugejal.
- **Kontroll kõigil 519 aktil:** 11 290 märkest 11 267 on näha lõigus, kus on märke koht. Ükski lõik ei nimeta üht silti kahe eri päevaga ega teise paragrahvi sätet.
  - 11 063 on oma sildiga kirjes ja 204 on paari pealkirjamärked, mida näitab terve paragrahvi kirje.
  - 23 jäävad piiride taha: 7 märget kirjete piiri taha (4 lõiku) ja 16 sätete piiri taha (11 lõiku). Iga selline lõik ütleb seda ise (`more`, `more_provisions`).
    - Kirjete piir: sotsiaalhoolekande seaduse § 144 lg 6 p 6 ja p 7 kolmes redaktsioonis ja `406062023034` § 1 p 19 (kehtetuks tunnistamine).
    - Sätete piir: riigilõivuseaduse § 142⁶⁰ lg 5 ja lg 6 ning § 287 lg 4 viies redaktsioonis ja `412042025007` § 13 lg 10 p 4.

**Mõõtmine redaktsioonipaaridel, sätete kaupa.** Säte on siin lõike tekst enne punkte või üks punkt. Loetud on, kas säte saab kuupäeva, mis jääb kahe redaktsiooni alguse vahele.

- 41 paari kahest järjestikusest terviktekstist (kõik 562 loetavat registreeritud XML-i): 19 854 sätet, neist 421 muutus või lisandus.
- Varasem tabel luges lõikeid, mitte punkte, ja 33 paari indekseeritud aktide seast. Lõike sees olevat viga see ei näinud.

| | Enne seda parandust | Nüüd |
|---|---:|---:|
| Muutunud säte, kuupäev olemas | 352 | 355 |
| Muutunud säte, silt „või kogu …“ | 44 | 52 |
| Muutunud säte, kuupäevata | 25 | 14 |
| Muutumata säte, kuupäev olemas | 3 | 3 |
| Muutumata säte, silt „või kogu …“ | 47 | 76 |

- Kuupäevata 14:
  - 7-l muutus tekst ilma ühegi märketa;
  - 5 said ainult numbri „(1)“, kui paragrahvile lisati lõiked (lastekaitseseadus `111072026043` § 40¹ lg 1 ja § 11 lg 1);
  - 2-l on märge ainult mõnel järgmisel sättel: `409052026032` § 71 lg 4 ja `426062026017` § 18 lg 3¹ (uus lõige ilma oma märketa).
- Muutumata sätte kuupäev 3: riigilõivuseadus § 298⁴ lg 2 ja 3 (tekst oli sama juba eelmises redaktsioonis) ja `419062026027` § 2 lg 2 p 3 (muutus ainult kirjavahemärk).
- Hind: 29 muutumata sätet rohkem kannab silti „või kogu …“. Enamasti on need lõiked, kus muutus ainult viimane punkt.
- Pealkirjad ja numbrita tekst samades paarides: 66 muutunust 50 kuupäevaga, 1 sildiga „või kogu …“, 15 kuupäevata. Muutumata 22 kannab silti „või kogu …“.
- Kõik 72 paari (ka algtekst ja praegune redaktsioon, kus vahele jääb mitu muudatust), 1326 muutunud sätet:
  - kuupäevata oli 176, nüüd 88;
  - kuupäevaga oli 943, nüüd 992; sildiga „või kogu …“ oli 207, nüüd 246;
  - muutumata sätteid sildiga „või kogu …“ oli 266, nüüd 343.
- Kolmanda ülevaatuse kolm parandust (paar ainult samade sõnadega, tühi säte, lähim jagu) neid arve ei muuda: mõõtmine andis enne ja pärast sama tabeli. Paarides ei ole ühtegi nendest juhtudest redaktsioonide vahelise päevaga.
  - Kõigil 562 loetaval XML-il muutsid need kolm parandust üheksa lõiku seitsmes failis (indekseeritud aktides kaheksa lõiku kuues aktis) ja mitte ühtegi kaarti.

### Muud reeglid

Need on plaanist uuemad. Kus plaan ütles teisiti, kehtib siinne.

- **Jao märge seotakse allolevate lõikudega ainult siis, kui jao number on ülaindeksiga** („10¹. jagu“). Muu jao märge käib pealkirja kohta ja lõikudel seda ei näidata.
  - Riigilõivuseadus `111072026166`: §-d 72, 74 ja 75 jäävad märketa, kuigi 5. peatüki märge on 01.01.2025.
  - Harku `404072025017`: §-d 34¹ ja 34² saavad 10¹. jao päeva (08.01.2021, „rakendatakse alates 1.01.2021“).
  - Lisatud jao märge on 436 lõigul.
- **Erand: lisatud paragrahv (ülaindeksiga number), millel oma märget ei ole, saab lähima märkega jao märke,** ka siis, kui jao number on tavaline. Kirje kannab jao nime, päeva, `applies_from` ja sõnu.
  - Põhjus: paragrahvi lisas muudatus, aga ainus märge, mille see muudatus jättis, on jao juures. Ilma selleta ütles paragrahvi kohta midagi ainult akti enda päev, mis on paragrahvist varasem.
  - Lähim on jagu, mille tee on pikim (jagu enne peatükki). Tavalise numbriga paragrahv ja oma märkega lisatud paragrahv jao märget ei saa.
  - Märjamaa `421032026022` §-d 88¹ ja 88²: `{"provisions":["15. jagu Vaimse tervise teenus"],"in_force":"2025-06-30","applies_from":"2025-01-01","note":"rakendatakse alates 01.01.2025"}`. Enne oli ainus päev kaardi 23.09.2024.
  - Harku `404072025017` §-d 22¹ ja 24¹: `{"provisions":["6. jagu Eluruumi tagamine"],"in_force":"2024-12-09"}`. Enne oli ainus päev kaardi lause „Määrust rakendatakse tagasiulatuvalt 1. aprillist 2016.“
  - **Kontroll kõigil 562 loetaval registreeritud XML-il:** reegel muudab neli lõiku, just need neli paragrahvi. Mujal ei rakendu.
    - 1970 lisatud paragrahvist 16-l ei ole oma märget: 10 on lisatud jao all (saavad selle märke nagu enne), 4 on need neli ja 2 on Võru § 49¹ kahes redaktsioonis, mille kohal ühtegi jao märget ei ole.
    - Mõlemas aktis on jao märge ja jao viimase paragrahvi lõpetav märge sama muudatuse omad (§ 88³ lg 3 p 3; § 24² lg 4). Märjamaa 15. jaos on ainult lisatud paragrahvid 88¹–88³. Harku sama muudatus (`406122024001`) märkis samamoodi jaod 10³ ja 10⁴: märge jao pealkirjal ja viimase paragrahvi lõpus, vahepealsetel mitte.
    - Redaktsioonipaari kummalgi aktil ei ole, nii et varasema teksti vastu seda kontrollida ei saa.
- **Kehtetuks tunnistamine on `repealed_from`,** ka siis, kui tekst seda ei näita (väikese tähega „kehtetu“, „välja jäetud“).
  - Sotsiaalhoolekande seaduse § 115 tekst on ainult „§ 115.“; lõik ütleb `repealed_from: 2017-01-01`.
  - Ühe tähe võrra valesti kirjutatud sõna („Kehetu“, üks märge) loetakse näitamisel kehtetuks tunnistamiseks.
  - **Muu märge tühjal sättel ei ole kehtetuks tunnistamine.** See jääb muudatuseks, nagu lugeja selle annab (`in_force`), sõnadega või ilma.
    - Tallinn `411062026102` § 13¹ lg 1–3 on tühjad ja kannavad selle akti märget, mis need 01.01.2022 lisas. Eelmises redaktsioonis (`410092025033`) on neil tekst sama märkega.
    - Nüüd: `{"provisions":["§ 13¹ pealkiri","§ 13¹ lg 1","§ 13¹ lg 2","§ 13¹ lg 3"],"in_force":"2022-01-01"}`.
    - Enne luges näitamine sõnadeta märke tühjal sättel kehtetuks tunnistamiseks: `repealed_from: 2022-01-01` oli vale, sest see on päev, mil lõiked jõustusid. Kõigis registreeritud XML-ides vastasid reeglile ainult need kolm märget.
- **Märke sõnu ja akti lauset ei lõigata.** Plaanis oli piir 160 tähemärki.
  - Riigikohtu otsuse märke sõnad ütlevad, mis osa sättest kehtetuks tunnistati. 160 tähemärgi juures lõigatuna jäi see osa välja ja märget sai lugeda terve sätte kehtetuks tunnistamisena.
  - Eelmine parandus jättis terveks märke, mille sõnades on „Riigikoh…“. Riigilõivuseaduse § 59 lg 1 ja lg 15 märge on otsuse resolutsioon ega nimeta kohut: see lõigati enne sõnu „… kehtetuks osas, milles tsiviilasja hinna puhul üle 500 000 euro tasutakse riigilõivu kuni 10 500 eurot“. Sõnastuse järgi otsust ära ei tunne.
  - Üksiku sätte lause kaotas lõigates oma päeva: `404032025051` § 24 lg 2 lõppes sõnadega „… või alat…“ (kadus „alates 1.01.2020“), `431122025034` § 67¹ sõnadega „kuni 31.…“.
  - Lugeja hoiab märkest kuni 2000 ja lausest kuni 400 tähemärki. Indekseeritud aktides on pikim märge 551 ja pikim lause 331 tähemärki.
  - Mõju: 10 lõiku (riigilõivuseaduse § 59 viies redaktsioonis) ja 8 kaardi lauset on nüüd terved. Pikkust piirab kogupiir (allpool).
- **Päevata märge** (Haljala `429012022009` § 2 lg 1 p 4) on kirje ilma `in_force`-ta. Sõnad ja `applies_from` jäävad.
- **Tühi `version_change.provisions`** ei anna kaardile midagi: `changed_on_valid_from` puudub.
- **`changed_on_valid_from_notes` näitab redaktsiooni alguspäeva märget väljaspool paragrahve,** kui sel on rakendamise päev või oma sõnad. Kirje on samal kujul nagu lõigu `amendments`.
  - Põhjus: preambulil, lisal ja jaol ei ole lõiku, mis märget kannaks. `changed_on_valid_from` nimetas muudetud lisa, aga tagasiulatuvat rakendamist ei näidanud miski.
  - Saku `429012026051` hoiab toetuste määrasid lisas. Lisa muutus 01.02.2026 märkega „rakendatakse alates 01.01.2026“. Kaardil on nüüd `{"provisions":["lisa Sotsiaaltoetuste määrade kehtestamine"],"in_force":"2026-02-01","applies_from":"2026-01-01","note":"rakendatakse alates 01.01.2026"}`.
  - Viiel kaardil: kaks lisa (Saku ja `411022020017`), preambul (`409092025010`), jagu (`407042026033`) ja kaks tervenisti kehtetuks tunnistatud paragrahvi, millel teksti ega lõiku ei ole (`404022026032` §-d 17 ja 31: `repealed_from` 07.02.2026, `applies_from` 01.01.2026).
  - Sõnadeta ja rakendamise päevata märge (Märjamaa ja Kuusalu preambul) jääb ainult nimeks `changed_on_valid_from`-is.
  - Varasema päeva märget väljaspool paragrahve kaart ei näita.
- **`entry_into_force` näitab ainult terve akti lauseid** („Määrus jõustub …“, „Määrust rakendatakse …“, „… käesolev seadus jõustuvad …“). 412 lausest 302.
- **`scoped_rules` näitab üksiku sätte, summa või ülemineku lauseid** („Määruse § 5 jõustub …“, „Piirmäärasid rakendatakse …“), kui aktil on neid kuni kolm. 49 lauset 34 kaardil.
  - Põhjus: 14 kaardil oli akti jõustumispäeva kõrval ainult näitamata lausete arv. Kahel praegu kehtival aktil dateerib just see lause kogu akti sisu:
    - Rae `430012026034`: „Piirmäärasid rakendatakse tagasiulatuvalt alates 01.01.2026.“ Akt jõustus 02.02.2026.
    - `412092026007`: „… hooldajatoetuse määrasid kohaldatakse tagasiulatuvalt alates 1. jaanuarist 2026.“ Akt jõustus 15.09.2026.
  - Omaette võtme all ei loeta neid terve akti jõustumiseks.
  - Üle kolme lausega aktil (sotsiaalhoolekande seadus: seitse üleminekusätet) näidatakse ainult arvu. Kolm seitsmest ei ütleks ülejäänute kohta midagi ja kaart kasvaks 220 tokeni võrra.
- **`entry_into_force_more`** on näitamata lausete arv: üle piiri jäänud ja need, mille päeva kirje ümber lükkab (allpool). 22 kaardil.
  - Lause, mille ainus päev on teise akti vastuvõtmise päev, jääb välja ega lähe arvesse (kolm akti). Tallinna § 6 lause jääb alles, sest selles on ka akti enda päev.
- **Kui akti lause „jõustub <päev>“ nimetab teist päeva kui kirje (17 akti), näidatakse üht, mitte mõlemat.**
  - Lause päev on kirje päevast varasem (13 akti): akt avaldati hiljem ja jõustus kirje päeval. Näidatakse `act_in_force_from`; lause läheb ainult arvesse.
    - `417062026002`: avaldati 17.06.2026, kirje päev 20.06.2026, lause „jõustub 01.06.2026“.
    - Kuuel aktil on lause päev akti avaldamisest varasem.
  - Lause päev on hilisem ja akti ajaloos on muudatus, mis jõustus enne seda (Kiili kolm redaktsiooni): akt juba kehtis. Näidatakse `act_in_force_from`.
    - Kiili `430062026040`: kirje päev 25.10.2021, esimene muudatus 31.01.2022, lause „Määrus jõustub 01.07.2023“.
  - Lause päev on hilisem ja miski sellele vastu ei räägi (`425072025017`: kirje 31.12.2023, lause 01.01.2024): näidatakse lauset, kirje päeva mitte.
  - Enne näidati kõigil 17-l ainult lauset. 16-l neist ei olnud see päev, mil akt kehtima hakkas.
- **Kirje päev jääb näitamata, kui see on varasem kui `original_published`** (seitse akti). Akti enda laused näidatakse nii, nagu need on. Ühtegi päeva ei parandata.
- Otepää `405072022009`: kirje päev 08.07.2022 ja lause „Määrust rakendatakse alates 1. juulist 2022“ on mõlemad näha. Need on eri asjad.
- **Vastuvõtmise kirje sõnu** (`adoption_note`, `act_applies_from`) ei näidata.

### Piirid

- Lõigu kohta kuni 8 kirjet; ülejäänute arv on viimases kirjes `{ more }`.
- Kirjes kuni 12 sätet; ülejäänute arv on `more_provisions`.
- Märke sõnu ja akti lauset ei lõigata (vt „Muud reeglid“).
- **Kogupiir on 1500 tokenit** kogu konteksti kohta, tõenduse järjekorras: allika kaart, siis selle lõigud.
  - Esimesest väljast alates, mis ei mahu, saab kaart ainult märgi `act_dates_omitted` ja lõik märgi `amendments_omitted`.
  - Märgid mahuvad piiri sisse. Iga väli loetakse eraldi, sellena, mis ta JSON-ile lisab.
    - See tugineb sellele, et `finalLimit` on kuni 30 (`ranking.js`). Kuupäevi kannab ainult ühe otsingu tõendus: koondpäringu perioodiradadel on ajakirjad ja kirjete rajal kirjed.
    - 30 kirjet annavad kuni 60 välja (iga kirje märked ja kuni üks kaart). Märk on 9 tokenit, seega kuni 540 tokenit märke.
    - Alates 167 väljast ületaksid märgid üksi piiri. Kood seda ei kontrolli; põhjendus on koodi kommentaaris.
  - **Piir käib selle summa kohta, mitte konteksti tegeliku kasvu kohta.** Kontekstis võib välja esimene token eelmisega liituda, nii et tegelik kasv erineb summast mõne tokeni võrra.
    - Ülevaatuse mõõtmine kõigil aktidel (umbes 1600 projektsiooni): tegelik kasv oli loetud summast suurem kolmel korral, kuni 3 tokenit. Suurim kasv oli 1498.

### Eelarve ja valik

Uued väljad on väljaspool iga tokenieelarvet ja valikumõõtu. Tõendus valitakse täpselt nii nagu ilma nendeta.

- `modelProjection` lisab väljad ainult kontekstile, mis mudelile saadetakse (`measure: 'full'`). Mõõdud `budget` ja `none` neid ei lisa.
- Täismõõt annab kaks arvu: `model_context_tokens` (saadetav kontekst) ja `budget_context_tokens` (sama ilma kuupäevadeta).
- `measurements.context_tokens` on see, mida eelarve luges: ilma kuupäevadeta, nii kompaktses kui ka auditirežiimis. Nii ei ületa see piiri ega sõltu sellest, kas kimbus on kuupäevad.
- Ilma kuupäevadeta loevad:
  - lõigu lisamise eelarve (`retrieval.js` `add`), kompaktses ja auditirežiimis;
  - sõltuvuskonteksti mahtumise kontroll ja semantilise graafi piir (`dependency_context_budget_exceeded`);
  - koondpäringu piir 32 000 (`unified.js`);
  - kirjete kataloogi mahutamine (`structured-record-source.js`; kirjetel neid andmeid ei ole);
  - generatsioonide võrdlus (`rag-v2-generation-compare.mjs`).
- Saadetav kontekst võib mõõdetud piiri ületada umbes 1500 tokeni võrra (vt „Piirid“: mõne tokeni täpsusega).
- Viitekaart (`reference_map`) ei muutu.
- **Pilootteenuse kaks baidikontrolli** (`pilot/service.js`):
  - **Auditipaketi piir 512 000 baiti loeb paketti ilma kuupäevadeta** (`auditPacketBytes`). Pakett salvestatakse koos nendega. (Alates 06.10.2026 on piir 1 000 000 baiti, vt [ADR-089](adr-089-closest-contact-directory.md) jaotis „Auditipaketi piir“.)
    - Põhjus: iga tõenduskirje kannab oma akti kaarti ja oma märkeid (`legal_dates`). Seda osa 1500 tokeni piir ei kata.
    - Ülevaatuse mõõtmine päris aktidel: 12 kirjet +3130 baiti; riigilõivuseaduse 30 raskeimat lõiku +21 482 baiti (8,8%).
    - Kuupäevadega loetuna oleks vahetult piiri all olev pööre lõppenud veaga `audit_packet_too_large`.
  - **Vastuse sisendi piir** (päringu keha baidid + 1024, `maxInputTokens`) loeb kuupäevi ja juhist, sest need saadetakse mudelile. Lisa on umbes 1500 tokenit kuupäevi ja 589 tokenit juhist. Ülevaatuse mõõtmisel oli keha 22 800 kontekstitokeni juures 87 781 baiti; piir on 300 000.
- Päris koondpaketi suurus (koos kirjete rajaga) on mõõtmata. Konteksti kordus trükib selle iga pöörde kohta (`packet_bytes`).

### Juhis (dialoog 22)

- `UNIFIED_RETRIEVAL_INSTRUCTIONS`: võrdluslause („For a legal rule, compare the date the user asks about …“) on bait-baidilt sama.
  - Selle ette tuli määratlus: `valid_from`, `valid_to` ja `publication_date` valivad redaktsiooni ega ütle, millal reegel või summa kehtima hakkas.
  - Selle järele tuli reegel: sätte algus tuleb ainult akti enda kuupäevadest (`amendments`, `act_dates`). Märketa sätte kohta tohib öelda ainult seda, mida akt enda kohta ütleb. Puuduvast või lõigatud loendist ei järeldata midagi.
  - **Erinevus plaanist:** reegli punkt (2) nimetab kaht võtit, mida plaani tekstis ei olnud, ja punkt (1) lõpeb ühe lisalausega. Muu tekst on plaani oma.
    - `act_dates.scoped_rules`: „those that cover only a part of it (a provision, an amount, a transition)“.
    - `act_dates.changed_on_valid_from_notes`: „gives, as amendments entries, its notes on parts that have no excerpt (the preamble, an annex, a division, a wholly repealed section)“.
      - Enne oli „parts outside the sections (the preamble, an annex, a division)“. Võti kannab ka tervenisti kehtetuks tunnistatud paragrahve (`404022026032` §-d 17 ja 31).
    - Punkti (1) lõpp: „where several entries cover a provision, the one that names it most narrowly decides“.
      - Põhjus: 229 lõigul on terve paragrahvi kirje kõrval sama paragrahvi sätte või pealkirja kirje teise päevaga, 70 lõigul jao kirje kõrval paragrahvi oma. Riigilõivuseaduse § 142⁴⁷ lõigul on „§ 142⁴⁷“ (01.07.2023) ja „§ 142⁴⁷ lg 1“ (01.07.2024) kõrvuti; lõike 1 kohta kehtib teine.
      - 24 lõigul on kitsam kirje vanem kui laiem (Tallinn `423052026004`: „§ 4¹“ 01.01.2025 ja „§ 4¹ pealkiri“ 01.07.2023). Ka seal kehtib kitsam: pealkirja märge on jäänud alles, seega pealkirja hilisem muudatus ei puudutanud.
- `COMPLETENESS_INSTRUCTIONS`: üks lause. Summa periood või kuupäev on see, mida säte ise ütleb, mitte `valid_from`.
- Lisandus 592 tokenit osade kaupa (86 + 461 + 45); kahe juhiseteksti mõõdetud kasv on 589 (`UNIFIED_RETRIEVAL_INSTRUCTIONS` 446 → 991, `COMPLETENESS_INSTRUCTIONS` 286 → 330).
- Uus tekst ei nimeta ühtegi omavalitsust, aastat ega summat.
- `m4-grounded-answer-12` ja `search-assist-5` on muutmata. Ümberjärjestaja valib redaktsiooni endiselt `valid_from` järgi; see on õige.
- `m4-grounded-dialogue-21` on loetavate versioonide seas.
- **Kuupäevi loeb juhisega ainult koondpäringuga dialoogipööre.** Määratlus ja reegel on `UNIFIED_RETRIEVAL_INSTRUCTIONS`-is.
  - Vestlusplaan on koondpäringuga (`chat-plan.js`), seega saab päris vestlus need alati.
  - Tavaline vastus (`answerRequest`), tõendusmustand ja koondpäringuta dialoog saadaksid kuupäevad ilma selle juhiseta, sama juhiseversiooni all. Need rajad ei ole vestluses kasutusel.
- **Juhis ei seleta** silte „pealkiri“, „sissejuhatav lauseosa“, „või kogu § N“, „või kogu § N lg K“ ega jao nime `provisions`-is (lisatud jagu; lähim jagu oma märketa lisatud paragrahvil) ega lisandit „(kehtetu)“ `changed_on_valid_from`-is (66 nime 41 kaardil; Harku `404072025017`: „§ 34³ (kehtetu)“). Need jäävad järgmise juhiseversiooni jaoks.

### Tokenikulu

| Mis | Enne | Pärast |
|---|---:|---:|
| Märjamaa kaart | 108 | 165 |
| Märjamaa § 1 lõik | 287 | 367 |
| Kuusalu kaart | 115 | 175 |
| Kuusalu § 3 lõik | 999 | 999 |
| Juhis pöörde kohta | | +589 |

- Kõigi 519 akti peal: kaardi `act_dates` keskmiselt 58 tokenit (mediaan 50, 95% kuni 143, suurim 304).
- 13 669 lõigust 4976-l on `amendments`: keskmiselt 48 tokenit (mediaan 31, 95% kuni 123, suurim 458).
  - Suurim on riigilõivuseaduse § 59 lõik: Riigikohtu otsuse märge on nüüd terve (551 tähemärki). Enne oli suurim 383.
- Mitmes lõigus korduvad 152 terve paragrahvi või jao kirjet, 9 kirjet sildiga „või kogu § N lg K“ ja 62 sätte või lisatud lõike kirjet.
- Piirid lõikavad harva: kirjete piir 4 lõigul, sätete piir 11 lõigul. 20 kaardil on muudetud sätete nimede asemel nende arv. Teksti ei lõigata kuskil.
- Arvud on ühekordsest mõõtmisest: lugeja `v30` ja `legal-dates.js` kõigil 519 registreeritud aktil, hoidlata.
- Lisakutset mudelile ega lisaotsingut ei ole.

### Tasuta kontrollid

- **`tests/rag-v2-legal-dates.test.mjs`** (päris XML-id, ajutine hoidla):
  - Märjamaa ja Kuusalu fragmendid täht-tähelt;
  - ilma kuupäevadeta on kontekst `v29` kimbu oma, ainult sildiga `json-3`; andmeteta kimp annab sama ka saadetavas kontekstis;
  - `retrieve()` valib sama tõenduse kuupäevadega ja ilma: kompaktne eelarve täpselt piiril ja ühe tokeni võrra alla, semantilise graafi piir, auditirežiim;
  - sama vestluse rajal, kolme aktiga (lisaks Harku `404072025017`): kandidaadid tulevad kataloogist (`retrievalDirectory`), ümberjärjestajal on reserveeritud kohad (`hooks.rerank`, `poolReserve`) ja ristviited lisavad lõike (`references: true`). Ümberjärjestaja loeb mõlemal juhul samu lõike ja neis kuupäevi ei ole. Sama kitsa eelarve, semantilise graafi ja struktuurilaiendusega;
  - `context_tokens` on kuupäevadega ja ilma sama; auditipaketi piir loeb sama baidiarvu, kuigi salvestatav pakett on suurem;
  - viitekaart on sama;
  - konteksti kordus (allpool).
- **`tests/rag-v2-legal-date-rendering.test.mjs`** (väljamõeldud aktid päris lugejaga, 25 registreeritud akti):
  - mitme lõigu vahel jagatud säte; pealkirja märge;
  - paragrahvi lõpetav märge: paar, lisatud paragrahv, tavaline number, vanem märge, sama muudatuse teine märge, märge punktis;
  - paar ainult siis, kui kaks märget ütlevad sama: teised sõnad või teine `applies_from` jätab pealkirja märke pealkirjale;
  - lõiget lõpetav märge viimases punktis: tavaline number (igas lõigus, kus on osa lõikest), lisatud lõige, vanem märge lõikes, sama muudatuse teine punkt, tühi punkt märke järel, paragrahvi viimane lõige;
  - numbriga lõike sissejuhatav lauseosa: üksi, koos lõiget lõpetava märkega, tühjaks jäetud punktidega;
  - lisatud paragrahvi pealkirja märge: paragrahvi lisanud märge, sama muudatuse teise märkega, vanema märkega, terve paragrahvi märke kõrval, tavalise numbri all;
  - numbrita lõike sissejuhatav lauseosa; jao märge: lisatud jagu, muu jagu, lähim jagu oma märketa lisatud paragrahvil (jagu enne peatükki; tavalise numbriga ja oma märkega paragrahv seda ei saa);
  - kehtetuks tunnistamise sõnastused; märge tühjal sättel ei ole kehtetuks tunnistamine, sõnadega ega ilma; päevata märge;
  - terve akti laused, `scoped_rules`, teise akti päev; lause ja kirje eri päevad kõigil neljal kujul;
  - kaardi `changed_on_valid_from_notes`: lisa, kehtetu lisa, sõnadeta preambul, varasema päeva lisa, üle 12 muudatuse;
  - ülevaatustes nimetatud aktid: Tori § 9, sotsiaalhoolekande seaduse §-d 13² ja 71, Kohtla-Järve § 31, Tallinna § 5 ja § 4¹, riigilõivuseaduse § 53, § 59, § 142⁴⁷ ja § 298⁴, Narva § 2 p 1, Türi § 91 ja kaart, Rakvere § 10 lg 8, Anija § 37, Rapla §-d 52¹ ja 52², Tallinna § 13¹, lastekaitseseaduse § 27², Märjamaa §-d 88¹–88³, Harku §-d 22¹ ja 24¹, Saku kaart, Kiili, Rae ja veel viie akti kaardid;
  - märke sõnad ja akti lause on terved (ka otsus, mis kohut ei nimeta); kirjete ja sätete piir ja kogupiir, ka suurima pöördega (30 kirjet, 60 välja); koondpäringu piir loeb ilma kuupäevadeta mõõtu.
- **Muteerimiskontroll** (ühekordne, töökaustas): 58 muudatust reeglites, eelarvemõõtudes ja juhises, iga ühe püüab mõni test kinni.
- **`tests/rag-v2-answer-prompt.test.mjs`:** juhis 22, võrdluslause sõna-sõnalt, lisatud tekstide räsid ja tokenid (86, 461, 45), ülejäänud tekst on juhise 21 oma, `answer-12` ja `search-assist` räsid.
- **`tests/rag-v2-conversation-eval.test.mjs`:** kataloogi mustrid püüavad 30.09 Märjamaa vastuse kinni ja lasevad õige vastuse läbi.
- **Kataloog:** `node scripts/rag-v2-conversation-eval.mjs --scenarios tests/evaluation/dialogue/scenarios-provision-dates-1.json --dry-run` (kaks stsenaariumi, kummaski üks pööre).
  - Märjamaa: 30.09 küsimus muutmata. Vastuses peab olema 500 ja 300; ei tohi olla 4. septembrit, kahtlust augustis sündinud lapse kohta ega aastat 2018 summa kõrval.
  - Kuusalu: 30.09 küsimus lisaga „mis ajast see piirmäär kehtib?“. Vastuses peab olema 480 ja 1. mai 2026; ei tohi olla 15. septembrit.
- **Konteksti kordus:** `scripts/rag-v2-context-replay.mjs --turn <id>` serveris, enne tasulist jooksu.
  - Loeb salvestatud pöörde paketi, ehitab iga tõenduskirje praeguse indeksi kimbust uuesti ja projitseerib selle.
  - Uus kontekst ilma kuupäevade ja sildita peab olema salvestatud kontekst. Muidu lõpeb skript veaga.
  - Trükib kaardid ja lõigud, millel on kuupäevad, nende tokenid, piiri ületused ja selle, millised paragrahvid tõenduses olid.
  - Trükib auditipaketi baidid (`packet_bytes`): salvestatud pakett, pakett nii, nagu see nüüd salvestataks, ja see, mida 512 000 piir loeb.
  - Mudelit ega vektoreid ei kutsu ja midagi ei kirjuta. Kohalikult: `--packet <fail> --store <hoidla>`.

### Tasuline mõõtmine

**Mõõdetud 01.10.2026 ajutises koopias korpusel v47** (`cp -al` koopia PR 2 failidega, mitteaktiivne plaan `m4-…-161834-f2ffae82`, dialoog 22, üks jooks).

- **Konteksti kordus (tasuta)** kolmel salvestatud pöördel:
  - Märjamaa 30.09 (`168125dc`): kontekst ilma kuupäevadeta on sama (`equal_without_legal_dates: true`). Kuupäevad 263 tokenit 1500-st, neli kirjet, piir ei täitunud. § 1 juures on märge 24.03.2026 ja „rakendatakse alates 01.01.2026“.
  - Kuusalu 30.09 kell 22:32 (`4f4cf1b5`, vastus lausega „kehtib 15. septembrist 2026“, leiti serveri pöörete seast): kontekst sama. Kaardil on § 5 lg 1 „Määrust rakendatakse alates 01.05.2026.“, 61 tokenit.
  - Abivahendite lisa pööre 01.10 (`ee432160`): kontekst sama, kuupäevi pole (tuletatud lisa).
  - Auditipakett: 271 292 ja 300 344 baiti 512 000 vastu; kuupäevad lisavad 1486 ja 374 baiti, mida piir ei loe.
- **Kaks tasulist küsimust** (`scenarios-provision-dates-1.json`), mõlemad `passed`, käsitsi üle loetud:
  - **Märjamaa:** 500 € sünni registreerimisel ja 300 € lapse aastaseks saamisel. „4. september“ puudub, kahtlus augusti sünni kohta puudub, 2018 summa kõrval puudub. Vastus ütleb nüüd ka, et teine osa makstakse eraldi taotluseta.
  - **Kuusalu:** arvesse läheb kuni 480 €; „Määrust rakendatakse alates 1. maist 2026.“ „15. september“ puudub.
- **Kulu** plaani hinnatabeli järgi 0,0114 USD kahe pöörde eest. Tegelik kulu on OpenAI töölaual.
- Koopia on kustutatud, plaanifail on kaustas `/etc/sotsiaalai/eval-archive-20261001/`.

### Korpus v47 serveris (1. etapi tõend, 01.10.2026)

- `rag-v2-corpus-run.sh 47 46 …`: `external_inputs: 0`, 519 dokumenti pitseeriti uuesti, 13 669 vektorit vahemälust, väliseid kutseid 0. Indeks `34fe1590`, 6470 dokumenti, 40 489 lõiku, aktiivne 14:33-st.
- **`rag-v2-generation-compare.mjs` v46 ja v47 vahel**, 52 salvestatud küsimust: 42 `same`, 5 `equal_score_order_only`, 5 `different`.
  - Kõik viis `different` rida vaadati üle. Ühel (`laws-03`) on tõendus ja tokenid samad, ankru koht kandidaatide seas nihkus 13-lt 15-le.
  - Neljal vahetus lõik teise vastu Sotsiaalhoolekande seaduse kuue redaktsiooni seast. Lõigu tekst on mõlemal pool räsi järgi sama (viis paari kontrollitud Postgresist).
  - Võrdlus ei filtreeri kehtivuse järgi, seega võistlevad kõik kuus redaktsiooni; vestluses on tõenduses ainult kehtiv. Tokenite vahe tuleb sellest, et teadmiskaardid on kahel redaktsioonil kuuest.
  - Ühtegi rida, kus sama tõendus annaks teise mahu (lekke tunnus), ei ole.
- Üks pööre päris vestluses v47 peal vastas õigesti (Jõelähtme hooldajatoetus 150 €, vormi link).

### Mida 2. etapp ei tõenda

- **Mudeli käitumist ei ole mõõdetud** enne kahte tasulist küsimust. Selle PR-i jaoks ei tehtud ühtegi mudelikutset.
- **„Milline redaktsioon kehtib päeval X“** ei ole kahe küsimuse seas. Võrdluslause on sama ja testitud, aga mudeli käitumist mõõdab alles M3 hindamine.
- **Silt „või kogu …“ ei ütle, kumb kehtib.** 595 märkel 137 aktis teab mudel ainult, et märge võib käia terve paragrahvi kohta, ja 355 märkel 94 aktis, et terve lõike kohta. Mida ta sellega vastuses teeb, on mõõtmata.
  - Redaktsioonipaarides kannab seda silti 52 muutunud ja 76 muutumata sätet. Kui lõikele lisati ainult viimane punkt, saavad ka muutmata punktid sildi.
- **Lisatud paragrahvi märketa sätted.** Kui ülaindeksiga paragrahvi lõpetav märge on viimase sätte oma (paragrahvis on vanem märge), ei ütle miski, millal paragrahv lisati. Selle märketa sätete kohta võib vastus nimetada akti enda päeva, mis on liiga varane.
  - Sama kehtib, kui paragrahvi lisanud muudatus märkis pealkirja ja veel mõne sätte: Harku `404072025017` § 21¹ (pealkiri ja lg 2 lõpp 08.01.2021, lg 1 märketa), riigilõivuseadus § 142⁸⁴ (lg 1 märketa).
- **Säte, millel märget ei ole, kuigi see muutus.** Redaktsioonipaarides 14 sätet 421-st (vt mõõtmine). Märge on mõnikord ainult järgmisel sättel või puudub üldse: `426062026017` § 18 lg 3¹ on uus lõige ilma märketa.
- **Pealkirja märge tavalise numbriga paragrahvil, kui pealkiri ei muutunud.** 39 sellisest uuest märkest redaktsioonipaarides oli pealkiri kahel sama mis enne (`426032026011` § 26, `403032026033` § 24: muutus paragrahvi tekst). Silt „§ N pealkiri“ on neil vale. Ülevaatuse mõõtmine.
- **Üksi seisev sissejuhatava lauseosa märge uuel lõikel.** Kahel üheksast oli terve lõige uus (`403072026037` § 17 lg 7, `426032026011` § 17 lg 5) ja kahel muutus ka osa punkte. Nende punktid jäävad kuupäevata.
- **Terve akti lause, mille kirjutas hilisem muudatus.** Järva vald `403032026029`: kaardil on `act_in_force_from` 09.02.2018 ja lause „Määrust rakendatakse 1. juulist 2022.“ (§ 5 lg 1, mille oma märge on 09.07.2022). Lause käib selle muudatuse kohta, mitte akti algse jõustumise kohta. Näidatud lausete seas on see ainus selline.
- **Üle kolme üksiku sätte lausega aktil ei jõua need kaardile** (sotsiaalhoolekande seadus). Mudel näeb neid ainult siis, kui see lõik on tõenduses.
- **Ümber lükatud lause võib tulla tõendusena.** 16 aktil näitab kaart kirje päeva ja lauset mitte. Kui lause lõik on tõenduses, näeb mudel mõlemat päeva.
- **Paari reegel tugineb ühele redaktsioonile.** Pealkirja ja viimase sätte eraldi muutmine sama muudatusega näeb välja nagu terve paragrahvi uus sõnastus, kui kaks märget ütlevad sama. Redaktsioonipaarides sellist ei olnud.
- **Lähima jao märge oma märketa lisatud paragrahvil tugineb samuti ühele redaktsioonile.** Kui jao pealkirja muutis üks muudatus ja paragrahvi lisas teine ilma märketa, näitab lõik pealkirja muudatuse päeva. Kirje kannab jao nime, mitte paragrahvi oma.
  - Registreeritud aktides rakendub reegel neljal paragrahvil (Märjamaa §-d 88¹ ja 88², Harku §-d 22¹ ja 24¹). Kummalgi aktil redaktsioonipaari ei ole.
  - Harku 6. jao tavalise numbriga paragrahvid (§-d 22, 23, 24) jäävad kuupäevata, kuigi jao märge võib käia ka nende kohta.
- **Lisatud paragrahv, mille kohal ei ole ühtegi märget.** Võru `401072025023` § 49¹ („Määruse muutmine“): oma märget ega jao märget ei ole. Indekseeritud aktide 1707 lisatud paragrahvist on see ainus, mille lõigul ei ole ühtegi kirjet.
- **Tühi säte muudatuse märkega.** Tallinn `411062026102` § 13¹ lg 1–3: `in_force` on päev, mil lõiked jõustusid. Et lõiked on nüüd tühjad, näitab ainult tekst; mis päevast, ei ütle allikas.
- **Kuusalu päev tuleb kaardilt** (§ 5 lg 1) ja seda viidatakse § 3 lõigu kaudu. Allikavaade § 5 ei näita. Selle teeb M3.
- **Märketa summa ja akti jõustumisaasta.** Märjamaa kaardil on „Määrus jõustub 1. juulil 2018“. Märketa summa kohta võib vastus öelda, et määrus kehtib 2018. aastast ja selle punkti muudatust kirjas ei ole. See on see, mida tekst näitab, mitte tõend.
- **Lisatud jao pealkirja hilisem muudatus.** Ülaindeksiga jao märge loetakse jao lisamise päevaks. Praegu on igal sellisel jaol (87) üks märge. Kui jao pealkirja hiljem muudetaks, oleks märkeid kaks ja mõlemad päevad jõuaksid lõikudele.
- **Integratsioonitestid** (Postgres, Qdrant) selles töös ei jooksnud.
- **v46 ja v47 võrdlus (`rag-v2-generation-compare.mjs`) loeb konteksti ilma kuupäevadeta** (`budget_context_tokens`), seega võib käia ka selle koodiga.
  - Kuupäevadega arv ei sobinud: v47 kontekst on nende võrra suurem, ja kui 1500 piir täitub, muudab ka sama tõenduse teine järjekord seda kuni 130 tokeni võrra (ülevaatuse mõõtmine, 400 ümberjärjestust). Kuupäevadeta arv muutub kuni ühe tokeni võrra.
  - Päris indeksil ei ole seda selle koodiga jooksutatud.
- **Täismõõt tokeniseerib konteksti ühe korra rohkem** (ilma kuupäevadeta arv). Sülearvutis on see umbes 80 ms 33 000 tokeni kohta.

## Piirid

- Märke puudumine tähendab „muudatust pole kirjas“, mitte „säte pole muutunud“.
- `applies_from` loetakse vabast tekstist. Tundmatu kuju jääb sõnadeks (`note`), mitte valeks kuupäevaks.
- PDF-id, JSON-kirjed ja aktist tuletatud lisad neid andmeid ei saa.
- Väikese tähega „kehtetu“ ja „välja jäetud“ märget tekst ei näita, nagu `v29`-s. Andmetes on see `repeal`.
- `repeal` puudub valesti kirjutatud märkel („Kehetu“, üks) ja sõnadeta märkel tühjal sättel (kolm). Näitamisel loetakse kehtetuks tunnistamiseks ainult esimene; teine jääb muudatuseks (2. etapp).
- Mitme punkti ühine kehtetuks tunnistamise märge saab ainult esimese punkti nime. Selliseid on üks: `422032022006` § 21 lg 3, kus XML-is on üks punkt numbriga „1)“, tekstiga „- 10)“ ja märkega „kehtetud“. Andmetes on see `§ 21 lg 3 p 1`, `repeal`; punktidel 2–10 kirjet pole. Paragrahvi tekstis on „1)“ ja „- 10)“ näha.
- `joustumine` võetakse allikast nii, nagu see on. Kontrollitakse kaht asja: päev peab olema kalendris olemas (30. veebruar ei ole päev) ja märke päev ei tohi olla märke avaldamispäevast varasem. Vale, aga hilisem päev jääb andmetesse.
- Akti enda jõustumispäeva (`act_in_force_from`) avaldamispäeva vastu välja ei jäeta, ainult teatatakse (vt „Otsus“). Vale päev vastuvõtmise kirjel jääks andmetesse koos hoiatusega.
- Riigikohtu otsuse tunneb lugeja ära märke sõnadest („Riigikoh…“). Teisiti sõnastatud kohtuotsuse päev jääks välja ja läheks hoiatusse.
- Märke sõnu ja jõustumislauset loetakse kuni 2000 tähemärki. Pikim märge registreeritud aktides on umbes 600 ja pikim lause 1561 tähemärki. Piirita võttis 80 000 sidekriipsuga märge 4 s, piiriga 4 ms.
- Märke koha leidmiseks loetakse paragrahvi tekst iga märke kohta uuesti, seega kasvab kulu ühe paragrahvi märgete arvu ruuduga. Praegu on ühes paragrahvis kuni 41 märget ja aeglaseim akt võtab 0,25 s. 2000 märkega paragrahv võtaks umbes 9 s.
- `legal_text` on dokumendiväli, seega näha ka sissevõtu ülevaates ja aruandes.
- **Eeldus:** sätte `joustumine` on muudatuse jõustumine selle sätte jaoks. Riigi Teataja dokumentatsiooni vastu pole seda kontrollitud. Et 04.09 ja 15.09 muudatus puudutasid ainult preambulit, tugineb märgetele; muutvaid akte korpuses ei ole.
