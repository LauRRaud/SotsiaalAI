# M4-C paranduste sihitud päriskatse plaan

07.09.2026. **OWNER-AUTHORIZED / EXECUTED: 12/12 pööret; baas taastatud.** Omanik andis selles vestluses selge loa nimetatud paranduste commit'iks, `main`-i push'iks, kaitstud serverisse juurutamiseks ning täpselt selleks 12-pöördeliseks päriskatseks kuni 0,24 USD piiriga. Parandus `98f80938…` juurutati, kõik küsimused tehti nähtava UI kaudu ning katse-eelne konfiguratsioon taastati. Sisuline vastuvõtt on osaline: [järelkatse hinnang ja tõendid](rag-v2-m4-c-real-analysis-2026-09-07.md#omaniku-loaga-12-pöördeline-järelkatse). Aktiivne tööseis on `SotsiaalAI.md` S1.0. Allpool säilib kinnitatud plaan koos ettevalmistusaegsete mõõtmistega; selle allkirjastamata kohalikud failid ei ole uue jooksu luba.

## Ulatus ja vastuvõtt

Korratakse varasema katse A-, B- ja D-dialoogi samade küsimuste ning värske otsinguga. Nende 12 pöörde ajalugu on vajalik A4, B2–B4 ja D3–D4 kontrollimiseks. C isikuvahetuse rada ei muudeta ega korrata selles plokis; selle varasem tulemus ei ole uue prompti venekeelse semantika tõend. See on parandatud juhtumite regressioonikatse, mitte puutumatu kontrollvalim ega üldise kvaliteedi mõõtmine.

| Leid / omadus | Nõutav tõend |
|---|---|
| F1, A4 | Projektide valimine, kavandatud tegevus, tegelik algus ja mõõdetud mõju jäävad lahku. Algust ei järeldata tulevikulisest kavatsusest. Puuduv tõend kuulub piirangusse. |
| F2, A1 | Iga rahastamisväide saab oma plokis rahastamist toetava katkendi viite. Hinnatakse uue paketi tegelikke katkendeid, mitte varasemaid S-numbreid. Kõigi viidete lisamine igale plokile ei ole lahendus. |
| F3, kõik vastused | Avaldatud kasulik tekst on ilma paljaste või dubleeritud viitetähisteta; nähtavad viited lisab rakendus. Ainult vastuse tagasilükkamist ei märgita sisuliseks paranemiseks. |
| F4, B1/B2/B4 ja D2 | Allika sõnaselge piir on allikaväide, vastaja teadmise piir on `limitations`. Katkendi põhjal ei väideta, mida terves artiklis pole. |
| O1, B3 | Tartu parandus säilib. Vajadusel küsitakse täpselt linna/valla või teenuseosutaja puuduvat eristust; uut hinda täpsustuse põhjal ei leiutata. |
| Tootmise UI | Režiimid ja D3 varasem teema/vastus/punkt valitakse nähtavate juhtelementidega; D2 refresh ning D3 allikavaade ja tagasitee on ekraanipiltidega tõendatud. HTTP-kutsed ei asenda seda rada. |

Hinnatakse iga vastuse kasulikkust ja kõiki selle väiteid vastava ploki viidatud katkendite suhtes. Avaldamine, skeemikontroll ega `kind` ei tõenda sisulist õigsust. Uue konservatiivse S-numbrite kontrolli tõttu võib sisulise samakujulise koodiga vastus peatuda; ka see märgitakse kasutatavuse piiranguks, mitte eduks. Automaatset paranduskutset ei tehta.

## Lukustatud küsimused ja nähtavad tegevused

Iga dialoog algab eraldi kaitstud pilootvestluses. Kasutatakse sama lubatud kontot ja kaheksat allikaversiooni; väljamõeldud juhtumeid ei täideta tootmiskasutajate andmetega.

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
| D1 | ET | new | Milliseid korralduslikke samme soovitab eetikanõukoja kommentaar töötaja ähvardamise või vägivalla järel? |
| D2 | ET | new | Uus teema: kas tehisintellekti artikli eri riikide näited on kõigile Eesti valdadele kohustuslikud? |
| D3 | ET | same | Naasen töötaja ohutuse teema juurde. Selgita selle vastuse teist punkti. |
| D4 | ET | same | Milline allikakatkend toetab seda korralduslikku sammu? |

D2 järel värskendatakse lehte ja kontrollitakse vestluse ning kontekstivalikute taastumist enne uut saatmist. D3 jaoks valitakse nähtavas UI-s selle jooksu D1 teema, avaldatud vastus ja punkt 2. Kui D1 ei avaldu või punkti 2 pole, jäävad D3–D4 `SKIP`; uut küsimust ega kunstlikku teist punkti ei looda. D3 järel avatakse kasutatud viite kanooniline allikavaade, kontrollitakse nähtavat katkendit ja naasetakse vestlusse; alles seejärel saadetakse D4. Salvestatakse valiku-, refresh'i-, allika- ja naasmisetapi ekraanipildid ning vastavad pöörde-ID-d. A4 võimalik puuduva punkti täpsustusküsimus hinnatakse allikasisust eraldi.

## Ettevalmistusaegne kohalik teostus ja konfiguratsioonid

Kohalik `main` HEAD ja `git ls-remote origin refs/heads/main` olid ettevalmistuses `3f8a1870c183826b520dd1ccf1b4b63a979efa00`. Parandus on selle peal commit'imata. Serverit selles kohalikus plokis ei kontrollitud ega muudetud.

Vastus: `m4-text-refs-4`; baasjuhis: `m4-grounded-answer-4`; dialoogijuhis: `m4-grounded-dialogue-2`. Otsinguprofiil, indeks, küsimuse ja dialoogikonteksti valik ei muutu. [Kohalik manifest](../../tmp/rag-v2-m4-c-fix/real-plan/implementation-manifest.json): `6147c1d4b7757b63da9b7155af08f69775cdc0b152c0b385a034f9a41c45a6e1`.

| Plaan | Uus ledger | Räsi enne approval'i | Kutsed / piir |
|---|---|---|---|
| [A](../../tmp/rag-v2-m4-c-fix/real-plan/dialogue-A.json) | `m4-c-fix-real-A-20260907-1` | `b97909edd838df479b513023b7d19a449fcbb2dfe486d0d37e60052cad2bb4a1` | 4 embedding'ut + 4 vastust / 0,08 USD |
| [B](../../tmp/rag-v2-m4-c-fix/real-plan/dialogue-B.json) | `m4-c-fix-real-B-20260907-1` | `44c53f229a1276dc628e328136f3394e0058034743ca599e306565104e25faa6` | 4 + 4 / 0,08 USD |
| [D](../../tmp/rag-v2-m4-c-fix/real-plan/dialogue-D.json) | `m4-c-fix-real-D-20260907-1` | `45130a30134550f18050a32fb386fa74ef17a0a5d379ff9020cb137df0cc43d1` | 4 + 4 / 0,08 USD |

[Masinloetav koond](../../tmp/rag-v2-m4-c-fix/real-plan/summary.json). Kõik kolm faili kontrolliti olemasoleva konfiguratsioonilugejaga: `pilot_approval_required`. Neis pole approval'i ja neid ei aktiveeritud. Konto/projekti andmed jäävad kohalikesse failidesse. Säilitus on vanade plaanidega sama: `expiresAt=null`, `retentionHours=null`; vanu ledgereid ei lähtestata.

## Kulu, väljasaatmine ja aktiveerimine

Kokku kuni **12 embedding'u- ja 12 vastamiskatset, 846 576 reserveeritud tokenit, 0,24 USD rahaline ülempiir**. Ühe pöörde piirid jäävad 4500 otsingutokenit, 64 000 vastamissisendi tokenit ja 2048 väljundtokenit. Varasema konfiguratsiooni määradega konservatiivne reserv on `(4500 × 130 + 64000 × 250 + 2048 × 1200) × 12 / 10^9 = 0,2285112 USD`. See pole värske tariif ega arvesumma. Tegelik usage, sellest arvutatud hinnang ja reserv raporteeritakse eraldi.

Saadetakse fikseeritud küsimused, serveri valitud sama teema/isiku kasutajasõnumid ja parandused, üks kontrollimata dialoogina märgistatud varasem assistendivastus ning värske kanooniline tõenduspakett. D3 selgelt valitud varasem punkt võib olla märgistatud otsinguvihje; ajalooline vastus ei muutu faktiallikaks. Üks peamine vastamiskatse pöörde kohta; retry, kriitikutsüklit, uut mäluagenti ega embedding'ute taaskasutuskatset ei lisata.

Omaniku koondluba peab hõlmama nimetatud kohalike paranduste commit'i, push'i ja juurutamist kaitstud serveripilooti ning täpselt seda 12-pöördelist katset 0,24 USD piiriga. Avalikku vastamist ei avata. `AGENTS.md` nõuab push'i ja deploy jaoks omaniku selget luba; varasema 15-pöördelise jooksu kõik katsed on kulutatud ja uus prompt vajab uut plaaniga seotud luba.

Pärast luba, enne esimest mudelikutset:

1. Kontrollida tegelikku kohalikku tööpuud, kaug-main'i ja serverit. Commit'i ja stage'i kuuluvad ainult selle ploki nimeliselt valitud failid; omaniku muud tööd säilivad. Tootmisbuild on kohaliku lõpliku koodipuu kohta tehtud; uue koodierinevuse korral tuleb kontrollida uut puudutatud pinda.
2. Kontrollida konto/projekti, tegelikku mudelit ja tariifi, aktiivset indeksit ning eraldi kõigi kaheksa lubatud allika versiooni ja ligipääsu; salvestada tulemus. Tariifi tõus ei anna õigust rahalimiiti tõsta.
3. Mõõta juurutatud manifest. Siduda uued plaanid tegeliku commit'i ja serveri baitidega; iga erinevus peab olema selgitatud. CRLF/LF erinevust võib aktsepteerida ainult failide sisu võrdluse tõendi alusel, mitte räsi pimesi asendades. Muutunud mudel, küsimused, korpus või loa ulatus peatab aktiveerimise.
4. Kontrollida uute ledgerite puudumist ja siduda kolm plaani sama tegeliku omaniku loa, aja ja plaaniräsiga. Kontrollida konfiguratsiooni loetavust frontend'i kasutajale. Kasutada olemasolevat lubatud sisselogimist; uut OTP-möödapääsu see plaan ei sisalda.
5. Salvestada algne baas-konfiguratsioon ja env muutmatult taastamiseks. Teha küsimused nähtava kasutajaliidesega; kontrollida katkendite tuge ning kõiki nõutud brauserisamme. HTTP-d võib kasutada eraldi tõendi lugemiseks, mitte UI-katse asendamiseks.
6. Teadmata saatmistulemuse korral kontrollida sama pöörde jälge; uut katset ei saadeta. Läbi kukkunud sõltuvus peatab selle dialoogiraja; ülejäänud sõltumatud rajad võivad jätkuda oma kvoodi sees. Kvoodijääki ei kasutata lisaküsimusteks.
7. Taastada baas-konfiguratsioon ja env ning tõendada taastamine. Hinnata uued vastused eraldi, säilitada vanad vastused ja räsid ning uuendada analüüsi ja S1.0.

Ka edukas tulemus ei sulge automaatselt varasemaid baasvastuste leide, vana assistendigarantii Luna-poolse tagasilükkamise puuduvat semantilist tõendit, kogu korpuse katvust, venekeelset uut järelkatset ega kogu M4/M6 vastuvõttu.

## Täitmise järelkanne

07.09.2026, 11:41–11:54 UTC: A4/B4/D4, kordusi 0, 12 embedding'u- ja 12 vastamiskatset. D2 refresh, D3 varasema teema/vastuse/punkti valik ja allikavaatelt samasse vestlusse naasmine läbisid. A4 küsis puuduva punkti kohta täpsustust, nii et algse ajalisusvea otsene kordus jäi katmata. Uue A1 rahastamisväite puudumine jätab F2 otsese korduse samuti osaliseks. F3 ja O1 vaadeldud puudused ei kordunud; F4 jäi A1-s ja D2-s alles. Kasutuspõhine konservatiivne hinnang oli 0,02191533 USD, rahaline reserv 0,10289033 USD, ülempiir 0,24 USD. Need pole arvesummad. Kõik katsevõimalused on kasutatud. Taastamine mõõdeti 11:57 UTC; üksikasjad ja püsitõendi viited on ülal lingitud analüüsis.
