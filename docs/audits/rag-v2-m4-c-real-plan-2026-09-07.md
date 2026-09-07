# M4-C nelja jätkuvestluse päriskatse koondplaan

07.09.2026 · **PREPARED / NOT_APPROVED / NOT_RUN**. See fail kirjeldab üht tervikkatset, mitte uut töövolitust. [Kohalik teostus ja tõendid](rag-v2-m4-c-local-2026-09-07.md). Aktiivse töö seisu kannab `SotsiaalAI.md` S1.0.

## Ulatus ja muutumatu alus

Neli väljamõeldud vestlust A–D, kokku **15 kasutajapööret**. Iga uus pööre kasutab tavalist uut otsingurada ja kuni üht uut embedding'u- ning üht vastamiskutset. Vahemälu võib embedding'u ära jätta; uut vastust ei taaskasutata küsimuse võrdsuse alusel. Automaatset kordust, varumudelit, hindajat ega paranduskutset ei ole. C teise pöörde kohalikku sünteetilist viga päriskatses ei sunnita.

Muutumatu baas: `gpt-5.6-luna`, reasoning `low`, `text-embedding-3-large` / 3072, `vector-ranked-first-v1`, v3 väljund `m4-text-refs-3`, sama kaheksa dokumendi ja versiooni lubatud korpus ning indeksipõlvkond `search_generation_386d51771eff1ece99cc354144ea589736a4c36c18101847dc57d6e3665d4e6e`. RRF, kvoodid, tükeldamine ja naabrilisa ei muutu. `fixedPacketFile`, `queryReuse` ning tsitaadikandidaadi väljad puuduvad.

Uus sisendileping: `m4-active-dialogue-1`; prompt `m4-grounded-dialogue-1`; deterministlik otsingutekst `m4-user-scope-search-1`. Lähte-HEAD on `cd6bd044bb92a5be5aa44dedc18a6fedf611f552`, kuid teostus sisaldab kohaliku `main`-i commit'imata muudatusi. Tegeliku teostuse manifesti räsi on **`7958451ad7d705c22397ac56a7463eaa0471dd108e761ffa724a311d9819ac94`**. Seda puudutav kood on build'i läbinud; commit'i tegemine üksi ei muuda manifesti.

## Täpsed laused ja valikud

Pöörded esitatakse järjest; iga vestlus algab uues kaitstud M4 vestluses. Valikud tehakse nähtavas kasutajaliideses. Päris kliendi andmeid ei lisata.

| Pööre | Keel | Režiim | Küsimus |
|---|---|---|---|
| A1 | ET | new | Olen 67-aastane ja elan Harkus. Mida kirjeldab heaolutehnoloogiate programm kodus elamise toetamise kohta? |
| A2 | ET | same | Milliseid lahendusi see programm eeldas? |
| A3 | ET | same | Mida tuli kohandada? |
| A4 | ET | same | Selgita teist punkti ja erista eesmärk juba saavutatud tulemusest. |
| B1 | EN | new | This is a fictional case: I am 67, live in Harku and need help at home. What can the training fact sheet tell me about home support? |
| B2 | EN | correction | Correction: I live in Tartu. My age and need for help have not changed. |
| B3 | EN | same | What is the exact price for me? |
| B4 | EN | same | Which part is still unknown, given my corrected location? |
| C1 | RU | new | Учебная ситуация: первому человеку 67 лет, он живёт в Харку с супругой. Что факт-лист говорит о помощи на дому? |
| C2 | RU | new_person | Теперь речь о другом человеке: ему 30 лет, он живёт один, муниципалитет неизвестен. |
| C3 | RU | same | А точная цена и гарантированный срок? |
| D1 | ET | new | Milliseid korralduslikke samme soovitab eetikanõukoja kommentaar töötaja ähvardamise või vägivalla järel? |
| D2 | ET | new | Uus teema: kas tehisintellekti artikli eri riikide näited on kõigile Eesti valdadele kohustuslikud? |
| D3 | ET | same | Naasen töötaja ohutuse teema juurde. Selgita selle vastuse teist punkti. |
| D4 | ET | same | Milline allikakatkend toetab seda korralduslikku sammu? |

D2 järel tehakse refresh. D3 valib selgesõnaliselt D1 teema, D1 avaldatud vastuse ja punkti 2; tegelikud pöörde-ID-d tulevad selle jooksu serverivastusest. Kui D1 ei avaldu või sellel pole teist punkti, märgitakse D3–D4 **SKIP / viite eeldus puudub**. Teist punkti ei tekitata kunstlikult ja lauset ei asendata uue küsimusega. D3 järel avatakse kanooniline allikas, naasetakse vestlusse ja esitatakse D4. A4 puhul puuduv või mitmeti mõistetav punkt võib nõuda täpsustusküsimust; seda hinnatakse sisuliselt, mitte automaatse ebaõnnestumisena.

## Saadetav sisu ja eelarve

Embedding'u sisend sisaldab valitud teema/isiku kasutajasõnumeid ja märgistatud parandusi. D3 lisab kasutaja selgelt valitud vana vastuse punkti **kontrollimata otsinguvihjena**. Kogu assistendivastus ei lähe embedding'usse. Vastajale lähevad serveris valitud kasutajasõnumid, üks selgelt kontrollimata dialoogina märgistatud avaldatud assistendivastus ja uue otsingu kanooniline allikapakett. Varasema `turnId/S1` viitekaart ei liitu uue `S1` kaardiga. Päriskatse tekstide kõrval on seega ette määratud ka saadetava dialoogi koostamise reegel; mudeli tulevase vastuse sõnastust ei saa ette fikseerida.

Piirid: 8 kasutajapööret aktiivses ulatuses, 64 vestluses, otsingutekst kuni 4500 tokenit, dialoog kuni 9000 tokenit, vastamiskutse konservatiivne sisendipiir 64000 ja väljundipiir 2048. Üle piiri jõudmisel peatatakse pööre nähtavalt; parandust ega isikupiiri ei kärbita.

| Vestlus / uus ledger | Embedding'uid kuni | Vastamiskutseid kuni | Reserveeritud tokeneid kuni | Kululimiit USD |
|---|---:|---:|---:|---:|
| A / m4-c-real-A-20260907-1 | 4 | 4 | 282192 | 0,08 |
| B / m4-c-real-B-20260907-1 | 4 | 4 | 282192 | 0,08 |
| C / m4-c-real-C-20260907-1 | 3 | 3 | 211644 | 0,06 |
| D / m4-c-real-D-20260907-1 | 4 | 4 | 282192 | 0,08 |
| **Kokku** | **15** | **15** | **1058220** | **0,30** |

Ühe pöörde konservatiivne arvutus on `(4500 × 130 + 64000 × 250 + 2048 × 1200) / 10^9 = 0,0190426 USD`, 15 pöörde kohta 0,285639 USD. Need on eelmise katse 06.09 hinnabaasist võetud reserveerimismäärad, mitte värskelt kontrollitud tariif. Konto tegelik tariif kontrollitakse enne aktiveerimist; 0,30 USD ülempiiri ei tõsteta vaikimisi. Tegelik provider usage ja hinnanguline maksumus talletatakse eraldi konservatiivsest reservist. Ka ebakindla tulemusega saadetud katse loeb kvooti.

Nelja ledgeri kasutamine säilitab olemasoleva kuni kaheksa kutse piirangu etapi ja konfiguratsiooni kohta. Vanu täis 7+7 ledgereid ei lähtestata. Kõigil neljal uuel plaanil on eksplitsiitselt `expiresAt=null` ja `retentionHours=null`; see ei anna lisakatsete ega muu sisutüübi luba.

## Valmis konfiguratsioonid ja aktiveerimise viimane samm

Kontoga seotud kasutaja-/projektiandmed jäävad lokaalsetesse plaanifailidesse:

| Plaan | Räsi ilma approval-väljata |
|---|---|
| [A](../../tmp/rag-v2-m4-c/real-plan/dialogue-A.json) | `8a57898b7e064d943d693f5fabaae51dd3660d252d668921aae6876cfc1be054` |
| [B](../../tmp/rag-v2-m4-c/real-plan/dialogue-B.json) | `f8d9de0a66640adb9b2aaeae17b3105589bdb2d80c46748f77cb0a650f243df2` |
| [C](../../tmp/rag-v2-m4-c/real-plan/dialogue-C.json) | `c56acdc09ad390ff91a65b50ef550c4414773dced0fd305ae05862be3aee136b` |
| [D](../../tmp/rag-v2-m4-c/real-plan/dialogue-D.json) | `4207d846e4da0958b265115ccb3acba6f1fe94d6db621a6fdec3aa6fffe4fa80` |

[Manifest](../../tmp/rag-v2-m4-c/real-plan/implementation-manifest.json) ja [koond](../../tmp/rag-v2-m4-c/real-plan/summary.json) on samuti valmis. Kõik neli konfiguratsiooni tagastasid olemasoleva lugeja kaudu `pilot_approval_required`; approval puudub. Ühtegi neist ei aktiveeritud ega laaditud serverisse.

Ülesande §8 ning `AGENTS.md` järgi vajab uus dialoogisisu väljasaatmine uut sobivat töövolitust; push ja deploy vajavad omaniku selget luba. Koondloa järel seotakse kõik neli täpset plaani ühe loa kirjega (`approvedBy`, tegelik `approvedAt`, `planHash`, `queryAndSourceEgress=true`, `dialogueEgress=true`, `dynamicQuestions=false`). Iga pöörde eraldi kinnitust ei küsita. Kui katse tehakse senises kaitstud serveripiloodis, peab sama luba hõlmama ka selle kontrollitud koodi push'i/deploy'd. Ettevalmistus ei muuda serveri aktiivset baasvarianti.

Enne esimest saadetavat päringut mõõdetakse teostuse manifest, lubatud konto/projekt, uute ledgerite puudumine, aktiivne indeks ja kõigi kaheksa allika versioonid. Muutunud teostust või õiguse ulatust ei loeta selleks samaks plaaniks. Puuduv API-seadistus, muutunud indeks, võistlus, vastuse teadmata olek või kvoodipiir peatab vastava raja; uut varuplaani ei aktiveerita.

## Tulemuse hindamine

Iga pöörde kohta salvestatakse valitud/välja jäetud pöörded ja põhjused, ulatus/isik, parandusversioon, tegelik otsingutekst, dialoogisisend, pärisotsingu allikapakett, keel, request/usage ja avaldamisolek. Hinnatakse eraldi konteksti valikut, otsingu katvust, väite allikatäpsust, paranduse rakendamist ning isikute segamist. A eristab eesmärki ja saavutatud tulemust; B ei tohi võtta vana Harkut filtriks ega nimetada teadmata hinda; C ei tohi pärida esimest inimest; D peab siduma tagasipöördumise ja viited õige pöördega.

Olemasolevate baasvastuste viis sisulist leidu jäävad avatuks kuni vastava uue tulemuse allikapõhise hinnanguni; avaldamine üksi ei sulge leidu. Sünteetilise vana assistendigarantii kohalik test tõendab ainult sisendi ja päritolu lepingut. Selle garantii semantiline tagasilükkamine Luna poolt jääb **NOT_PROVEN**; siinne nelja vestluse plaan ei sisalda peidetud viiendat ega sünteetiliselt ümber kirjutatud pärisvastust. Avaliku kasutuse heakskiitu see katse ei anna.
