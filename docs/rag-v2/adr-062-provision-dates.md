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

## Piirid

- Märke puudumine tähendab „muudatust pole kirjas“, mitte „säte pole muutunud“.
- `applies_from` loetakse vabast tekstist. Tundmatu kuju jääb sõnadeks (`note`), mitte valeks kuupäevaks.
- PDF-id, JSON-kirjed ja aktist tuletatud lisad neid andmeid ei saa.
- Väikese tähega „kehtetu“ ja „välja jäetud“ märget tekst ei näita, nagu `v29`-s. Andmetes on see `repeal`.
- `repeal` puudub valesti kirjutatud märkel („Kehetu“, üks) ja sõnadeta märkel tühjal sättel (kolm).
- Mitme punkti ühine kehtetuks tunnistamise märge saab ainult esimese punkti nime. Selliseid on üks: `422032022006` § 21 lg 3, kus XML-is on üks punkt numbriga „1)“, tekstiga „- 10)“ ja märkega „kehtetud“. Andmetes on see `§ 21 lg 3 p 1`, `repeal`; punktidel 2–10 kirjet pole. Paragrahvi tekstis on „1)“ ja „- 10)“ näha.
- `joustumine` võetakse allikast nii, nagu see on. Kontrollitakse kaht asja: päev peab olema kalendris olemas (30. veebruar ei ole päev) ja märke päev ei tohi olla märke avaldamispäevast varasem. Vale, aga hilisem päev jääb andmetesse.
- Akti enda jõustumispäeva (`act_in_force_from`) avaldamispäeva vastu välja ei jäeta, ainult teatatakse (vt „Otsus“). Vale päev vastuvõtmise kirjel jääks andmetesse koos hoiatusega.
- Riigikohtu otsuse tunneb lugeja ära märke sõnadest („Riigikoh…“). Teisiti sõnastatud kohtuotsuse päev jääks välja ja läheks hoiatusse.
- Märke sõnu ja jõustumislauset loetakse kuni 2000 tähemärki. Pikim märge registreeritud aktides on umbes 600 ja pikim lause 1561 tähemärki. Piirita võttis 80 000 sidekriipsuga märge 4 s, piiriga 4 ms.
- Märke koha leidmiseks loetakse paragrahvi tekst iga märke kohta uuesti, seega kasvab kulu ühe paragrahvi märgete arvu ruuduga. Praegu on ühes paragrahvis kuni 41 märget ja aeglaseim akt võtab 0,25 s. 2000 märkega paragrahv võtaks umbes 9 s.
- `legal_text` on dokumendiväli, seega näha ka sissevõtu ülevaates ja aruandes.
- **Eeldus:** sätte `joustumine` on muudatuse jõustumine selle sätte jaoks. Riigi Teataja dokumentatsiooni vastu pole seda kontrollitud. Et 04.09 ja 15.09 muudatus puudutasid ainult preambulit, tugineb märgetele; muutvaid akte korpuses ei ole.
