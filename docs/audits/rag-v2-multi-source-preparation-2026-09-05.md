# RAG v2 M2 mitme allika järelkatse ettevalmistuse audit

Kontrollipäev: 05.09.2026. Aktiivset tööd juhib [SotsiaalAI.md S1.0](../platvormi%20arendus/SotsiaalAI.md). Hindamisotsused on [ADR-004-s](../rag-v2/adr-004-multi-source-evaluation.md).

## Seis

Mitme allika järelkatse tehniline ettevalmistus on kohalikult valmis, pärisembedding'u jooks on **käivitamata**. Uute sisendite väljasaatmiseks puudub selle ploki täpset manifesti ja kulupiiri kinnitav omaniku luba. Kuivjooks, päris-PDF-ide ingest, ankrute lahendamine ja mock-mehaanika tegid 0 välis- ning 0 genereerivat kutset.

Käituskood valmis commit'idel `51921fe98`, `8c3227ffc` ja `63fa0b731` ning jõudis GitHubi ja serverisse dokumentatsioonitipuga `86517b2ab`. Serveri kuivjooks andis kohaliku plaaniga sama egress-manifesti räsi. Pärisembedding'u käivitust ei tehtud.

## Korpus

Valim koosneb kaheksast omaniku tööruumis olnud päris-PDF-ist. Ühe artikli eri koopiaid ei loetud eri allikateks. Sotsiaaltöö 2/2025 sama numbri teist artiklit materjalijuures polnud; valim sisaldab identiteedi eristamiseks Sotsiaaltöö 2/2026 artiklit, kuid see ei tõenda sama numbri katvust.

| Allikas | Roll | Lehti | Tekstiosi | Paigutuse piir |
| --- | --- | ---: | ---: | --- |
| „Tehisintellekt sotsiaaltöös” | senine alusartikkel ja lähiteema | 13 | 16 | M2.2-s üle vaadatud; viidete loend pole algfailis nähtav |
| „AI sotsiaaltöös” osalejapakett | lähiteema siht ja eksitaja | 13 | 20 | märkeruudu glüüfid vajasid NUL-asendust |
| ESTA andmekaitse ja eetiliste valikute teemapäev | eetika/andmekaitse siht ja eksitaja | 3 | 3 | veebitrüki jaluse ning poolitatud linkide müra |
| „Kas oleme valmis … töötajate turvalisusest” | ajakirjaartikkel ja tööheaolu siht | 6 | 15 | artikkel, kommentaar ja ilmumisjalus on ühes failis |
| Hooldustöötajate eetika ja enesehoid | eetika/enesehoiu siht ja eksitaja | 2 | 2 | veebitrüki jaluse müra |
| Tehnopoli heaolutehnoloogia programm | konkureeriv programmiallikas, rahastustingimused | 5 | 6 | külgriba tekst võib lugemisjärjekorda seguneda |
| EKA heaolutehnoloogia programmi käivitus | konkureeriv programmiallikas, EKA roll | 9 | 4 | korduv kõrvalteema/jalus; neid spane ei kasutata ankrutena |
| Haigla sotsiaaltöö teemapäev | kõrvalteema ja patsienditee siht | 2 | 3 | veebitrüki jaluse müra |

Kanooniline privaatne [korpusemanifest](../../tmp/rag-v2-multi-source/final-63fa0b731/corpus-manifest.json) sisaldab iga algfaili ja metadata räsi, dokumendi/versiooni identiteeti, rolli, õigusi, parseri hoiatusi ja allikakohtade mahtu. Kõik dokumendid on ainult `local_private` / `development_only` kasutuses.

## Hindamisleping

Uus kogum sisaldab 15 sisuliselt erinevat küsimuseperekonda ja 21 küsimust. Kuus perekonda on arendusosas ja üheksa puutumatus kontrollosas; otsustuspiiri, töötajavägivalla määra ja rahastustingimuste perekondadel on ET/EN/RU variandid. Sama perekonna tõlked jäävad samale poolele. Eraldi säilib üheksa küsimusega M2.2 regressioon.

Juhtumid katavad täpse termini ja vaba sõnastuse, lähiteema vale allika, mitu vajalikku tekstikohta, kahte dokumenti vajava küsimuse, osalise toe, korpuses puuduva toe ning bibliograafia. Oodatud dokumendid, lehed, spanid ja vastatavuse sildid lahendatakse hindajas enne päringut; otsingule antakse ainult küsimuse tekst, keel, ühine poliitika ja meetodi samad eelarved.

Kõik neli rada kasutavad top-1/3/5 mõõtmist, viie ühiku lõpppiiri ja 6000-tokenist kompaktset konteksti. Raport näitab toorkandidaatide ning lõppkonteksti ankrurühmad, valitud allikad, top-5 eksitajad, struktuuri lisatud ja välja jäänud üksused, tegelikud kontekstitokenid ja etappide kestused. `required_evidence_absent_by_dataset` jääb hindaja teadmiseks, mitte runtime'i keeldumisvõimeks.

## Artefaktide päritolu järelkontroll

Serveri esialgne `pilot-report.html` säilis muutmata SHA-256 räsiga `3db25b679873801ea33e80a4cd526ac2ff56c577a4b508f5f781522c6f4aa616`. Sama räsi kontrolliti kohaliku ajaloolise koopia ja serverifaili vahel.

Praegusest koodist genereeritud [versiooniline piloodiraport](../../tmp/rag-v2-m2-2/verifications/post-fix-63fa0b731/pilot-report.html) kasutab 25 varem salvestatud vektorit ning tegi 0 API-katset. Run ID on `evaluation_run_6f0cebf821594af4c875a2c86aecd1e83bd7c08c86439d1eea51bc9ea94a4307`; Git SHA on `63fa0b731bda134ad38244b7068bdc8253fcab95`. Üldine tracked-tööpuu oli omaniku muu kustutuse tõttu dirty, kuid RAG v2 scope oli clean. Kõigi 34 mittetühja meetodirea 102 kontrollitud `authority` / `historical` / `source_status` välja kandsid väärtust, päritolu ja `review_state` olekut; vigaseid välju oli 0.

## Mehaanikakontroll ja leitud viga

Esimene päris teenustega mock-jooks leidis enne hindamist PostgreSQL-i vea `22P05`: osalejapaketi märkeruudu glüüf sisaldas PDF-i tekstikihis NUL-koodipunkti. Parser asendab nüüd NUL-i enne püsistamist nähtava `U+FFFD` märgiga, märgib span'i transformatsiooni ja `pdf_nul_replaced` hoiatuse ning ei säilita kasutamata tooreid parseri item'e bundle'is. Metadata stringides on NUL keelatud.

Paranduse järel indekseeriti kaheksa dokumenti 69 üksusena. [Lõplik kohalik mock-mehaanikaraport](../../tmp/rag-v2-multi-source/final-63fa0b731/multi-source-v1-mechanics-report.html) sisaldab uue kogumi 84 meetodirida ja regressiooniraport 36 rida: kokku 120 rida, tehnilisi vigu 0. Sama 120-realine mehaanika läbis serveris commit'il `86517b2ab` samuti 0 tehnilise veaga ning andis sama manifesti räsi. `semantic_claim=NOT_PROVEN_test_mechanics_only`; mock-ridade sisulisi tabamusi ei kasutata pärisotsingu kvaliteediväitena. Mõlema jooksu mock-tenant ja Qdranti kollektsioon eemaldati pärast raportit, põhitenant jäi pärisvektori aktiivsele põlvkonnale.

## Täpne uus väljasaatmisplaan

| Näitaja | Kuivjooks |
| --- | ---: |
| Dokumendid | 8 |
| Uued perekonnad / küsimused | 15 / 21 |
| Eraldi regressiooniküsimused | 9 |
| Unikaalsed dokumendi- ja küsimusesisendid | 98 |
| Kontrollitud vanast ledger'ist taaskasutatavad sisendid | 25 / 12 420 tokenit |
| Uut embedding'ut vajavad sisendid | 73 / kuni 23 554 tokenit |
| Maksimaalne uus API-katsete arv | 73 |
| Genereerivad ja Luna kutsed | 0 |
| Arvestuslik uus kulu hinnaga 0,13 USD / miljon tokenit | 0,003062020 USD |

Muutumatu egress-manifesti SHA-256 on `9526a80539a84e497226e48575ef1828f979c24dd3fcc41876c4909025e40592`. Manifest ei sisalda algteksti, ankruid ega vastatavuse silte; ta seob kaheksa allika räsid, 73 uue sisendi räsid/tokenid ja 25 taaskasutuskviitungit varasema manifesti, ledger'i ning vektorikirjete räsidega. [Evaluation plan](../../tmp/rag-v2-multi-source/final-63fa0b731/evaluation-plan.json), [egress-manifest](../../tmp/rag-v2-multi-source/final-63fa0b731/egress-manifest.json) ja [loa eelvaade](../../tmp/rag-v2-multi-source/final-63fa0b731/approval.preview.json) on privaatsed.

0,003062020 USD on kontrollitud hinnakirjel põhinev ülempiiriarvutus, mitte arve. Pärisjooks peab käivituse hetkel kasutama kehtivat hinnakirjet ning omaniku allkirjastatud loakirjet, mis nimetab täpselt ülaltoodud manifesti, kuni 73 katset, kuni 23 554 uut sisendtokenit, sobiva USD kulupiiri, 0 korduskatset ja 0 genereerivat kutset. Muutunud allikas, küsimus, mudel, taaskasutuskviitung või limiit peatab käivituse enne saatmist.

## Kontrollid ja järgmine otsus

- RAG-i lõplik sihtkomplekt: 61 testi läbitud, 0 ebaõnnestunud, 0 skip'i.
- Muudetud koodi lint, `git diff --check`, i18n-kontroll ja lõpliku muutumatu koodipuu tootmisbuild läbisid.
- Päris PostgreSQL/Qdrant mehaanika kohalikult ja serveris: kummaski 120 meetodirida, 0 tehnilist viga, 0 väliskutset; testseis eemaldati.

Järgmine tegevus on ainult kinnitatud manifesti pärisembedding'u jooks ja juhtumipõhine tulemuste audit. Enne tulemust ei muudeta järjestajat ega kontrollosa. Luna, M3 runtime, HTTP-autentimine ja avalik API ei kuulu sellesse plokki.
