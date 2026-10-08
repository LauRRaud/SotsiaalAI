# RAG-i allikavaliku sisendikulu: teostus ja enne–pärast katse

08.10.2026. Lähtedokumendid: [Astra tervikaudit](rag-system-audit-2026-10-08.md) ja [rahaarvestuse teostus](rag-cost-accounting-2026-10-08.md). Omanik palus sama küsimuste valimiga tokenite, hinna, kiiruse ja kvaliteedi võrdlust kõigis kolmes rollis. Varasem kulu oli 0,030712790 USD; kogu kokkulepitud piir 1 USD.

## Teostuse valik

Lõplik kandidaat säilitab mudelile saadetava allikavaliku päringu täielikult. Kõik tekstid, kandidaatide ID-d, juhised, aastad, redaktsioonid, küsimus ja dialoogisõnumid jäävad samaks. Muutub ainult API vahemälupoliitika: omaniku konfiguratsioonivälja `rerankCachePolicy: "uncached-full-text-1"` korral lisatakse `prompt_cache_options: { mode: "explicit", ttl: "30m" }` ilma kirjutamispunktideta. Vaikimisi jääb olemasolev implicit-vahemälu. Poliitika ja sisendi/juhise räsi salvestatakse pöörde `searchAssist.rerank.inputCostPolicy` mõõdikusse.

OpenAI ametliku juhise järgi ei loe ega kirjuta explicit-režiim ilma märgitud punktideta vahemälu. Siis on Luna sisend 0,10 USD/miljon; kirjutamine oleks 0,125 ja lugemine 0,01. See valik on kasulik siis, kui kogu päringu korduskasutust on vähe. See võib olla kallim sagedasti korduvatel päringutel. Vahemälust loetud osa tasuvuspiir on ligikaudu 21,7% (lihtsustatud mudelis, kus ülejäänu kirjutatakse). Seetõttu on poliitika teadlikult sisse lülitatav, mitte universaalne vaikimisi muudatus. [OpenAI Docs: prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

## Valim ja meetod

[Valim](evidence/rag-rerank-input-cases-2026-10-08.json) kirjutati enne tasulist katset: neli stsenaariumi, viis pööret rolli kohta. Vanaema tugiisiku piirang, Põhja-Sakala kahe redaktsiooni võrdlus, Tartu koduteenus koos 700 EUR pensioni jätkuküsimusega ning tööheaolu uuringud. Mõlemas põhijooksus kasutatakse samu küsimusi, rolle ja korpuse põlvkonda. Kõik on sünteetilised olukorrad.

Päris `PilotService`, Postgres/Qdrant, omavalitsuste adapter, Luna ja rahaarvestus töötasid eraldatud testkontodega. Kandidaatkood laaditi üksnes ajutisse Node-mõõteprotsessi mooduli-ülekattest; töötavat rakendust ei muudetud. Seega see tõendab katse runtime'i, mitte kandidaadi tootmisesse avaldamist. Kontod ja vestlused kustutati; sisuvabad kulukirjed säilisid kasutajaseoseta. Kasutajate olemasolevaid vestlusi ei loetud.

Mõõtmine kasutas teenuse pärisrada; HTTP autentimise rada ei muudetud. USD on tegelike provider-tokenite ja avaliku tariifi arvutus, mitte imporditud OpenAI arve. API-kutsed ja need katkestused, mis tagastasid kasutuse, kuuluvad kulusse. Kõigi mudelikatsete kulu arvestatakse, sealhulgas tagasilükatud prototüübid.

## Tagasilükatud katsed

1. Korduvate tekstiosade kaotuseta ühisesitus: samade kandidaatide lokaalne proov säästis peamiselt redaktsioonivõrdluses umbes 9%; tavaküsimustel jäi sääst väikeseks. Seda ei võetud käituskoodi.
2. 320-tokenilised lõigueelvaated: 15 pööret, 0,051928715 USD. Allikavaliku sisend vähenes 19,3%, kogu sisend 10,1%, kuid leiti spetsialisti sobimatu suunamine ja mõnes vastuses kitsam katvus.
3. 480-tokenilised eelvaated ja rolli lisamine: 15 pööret, 0,055755970 USD. Mõlemad redaktsioonid jäid täistekstiga. Allikavaliku tokenid vähenesid, kuid selle etapi dollarikulu suurenes vähenenud vahemälulugemise tõttu.
4. Allikate paigutamine ühe JSON-i algusesse: 15 pööret, 0,057302290 USD. Leiti vajaliku õiguslõigu ja kohaliku tasu valiku regressioonid. Ainult JSON-väljade järjekord ei tekita vahemälupiiri.
5. Allikate ja küsimuse eraldi sõnumid koos explicit-kirjutamispunktiga: 15 katset, 0,054092995 USD; 14 lõppvastust, ühe vastuse avaldamine blokeeriti `invalid_answer_reference` tõttu. Esimeses sessioonis katkestati seitsmenda katse juures; ülejäänud kaheksa mõõdeti uues sessioonis, ebaõnnestunud katset uuesti ei ostetud. Spetsialisti suunamine ja praeguse kohaliku tasu leidmine jäid samuti kvaliteediküsimusteks. Ka seda kuju ei võetud lõplikku teostusse.

Viimase kuju eraldi kahe kutse vahemäluproov tõendas sõnumipiiri toimimist: sama allikasisend, muutunud küsimus ja roll; teisel kutsel 15 096 cache-read-tokenit, sisendikulu 0,001891600 → 0,000155560 USD (91,8% vähem). Kahel kutsel kokku 0,002105660 USD. See ei ole kogu RAG-i lubatud kokkuhoid: kandidaatide muutudes ei pruugi prefiks korduda.

Need katsed näitavad, miks väiksem sisend ega üks õnnestunud vastus pole kvaliteedivõrdsuse tõend. Lõplikus koodis ei ole eelvaateid, lõikude kärpimist, kandidaatide vähendamist, uut rollijuhist ega sisendsõnumite ümberkorraldamist.

## Kontrollid ja piirid

Uue poliitika sihttest võrdleb enne–pärast päringut tervikuna: ainsaks erinevuseks tohib olla `prompt_cache_options`. Eraldi test katab vaikimisi käitumise ja vahemälu lugemise/kirjutamise hinnavahe. Source-binding, õiguste, dialoogi ja raha tee jäävad olemasolevaks. Tasulised katsed pole lisatud CI ega töö valmimise kohustuslikuks väravaks.

Katse ei tõenda kogu RAG-i faktiväidete sisulist toetatust ega lahenda tervikauditi teisi kvaliteedi- ja mälupiire. Sisse lülitamisel peab arvestama oma töökoormuse tegelikku cache-read-määra. Praegune avalik RAG on ühe konto ja 4 USD arendusplaani piires.

## Lõpliku täistekstipoliitika tulemus

[Enne](evidence/rag-rerank-cache-before-2026-10-08.json), [pärast](evidence/rag-rerank-cache-after-2026-10-08.json), [võrdlus ja kontrollid](evidence/rag-rerank-cache-comparison-2026-10-08.json).

| Mõõdik, 15 pööret | Enne | Täistekst, cache-kirjutamiseta |
|---|---:|---:|
| Allikavaliku sisendtokenid | 265 285 | 270 466 |
| Allikavaliku sisendi USD | 0,029102875 | 0,027046600 |
| Allikavaliku kogu USD | 0,030194375 | 0,028186600 |
| Kogu RAG-i sisendtokenid (koos embedding'uga) | 544 657 | 558 097 |
| Kogu RAG-i USD | 0,058421465 | 0,056294090 |
| Esimene tekst, mediaan | 22,068 s | 18,462 s |
| Valmis vastus, mediaan | 26,064 s | 22,988 s |
| Valmis vastus, p95 | 40,461 s | 43,813 s |
| Allikavaliku API mediaan | 2,477 s | 2,662 s |
| Avaldatud lõppvastused | 15/15 | 15/15 |

Allikavaliku sisendi rahakulu **−7,1%**, etapi kogu kulu **−6,6%**, kogu RAG-i kulu **−3,6%**. Tokenimaht ei vähenenud: päris kordusjooksu plaani- ja valikutulemused varieerusid. Mediaan paranes, p95 halvenes; üldist kiirenemist ega iga päringu kokkuhoidu ei väideta. Lõpliku poliitika 15 kutse cache-read ja cache-write olid mõlemad 0. Arvud pärinevad API kasutusest ja kehtivast hinnakaardist.

Lähtemõõtmise allikavaliku cache-read-osakaal oli umbes 13,3%, mis jääb poliitika lihtsustatud tasuvuspiirist allapoole. Korduvatel päringutel võib implicit-režiim olla soodsam; seda võimalust vaikimisi ei eemaldata. Eriti ei tule seda poliitikat rakendada vastuse etapile, kus pikk püsijuhis annab juba kasulikku vahemälulugemist.

Kõigis kolmes rollis olid alles sugulase piirangut toetav õiguslõik, mõlema võrreldava redaktsiooni viited ning jätkuküsimuse Tartu linna ja 700 EUR pensioni asjaolud. Kõigi 15 vastuse viited olid seotud algse täistekstiga ning kõigi sama võtmega korduspäringute API-kutsete arv jäi samaks. Uuringute küsimustes säilis mitme allika ja aastate käsitlus.

**Kvaliteedipiir:** ühes spetsialisti koduteenuse vastuses suunati küsija piirkonna sotsiaaltöö spetsialisti juurde. Seetõttu ei kuulutata kõigi vastuste täielikku rolli- ega kvaliteedivõrdsust tõendatuks. Lõplik kulupoliitika ei muuda mudeli juhiseid ega sisendi sisu; rolliprobleemi ja mudelivastuste varieerumist peab Astra järelkontroll hindama eraldi. Semantilise kvaliteedi garantii asemel on teostuses kontrollitav päringu sisuline samasus.

## Tõendid, kulupiir ja avaldamise seis

Kõik selle vestluse tasulised katsed kokku **0,366613975 USD**, sellest see töö **0,335901185 USD** ja varasem töö **0,030712790 USD**. Kokku 392 API-kutset (ka tagasilükatud prototüübid ja neli väikest vahemäluproovi). Kokkulepitud 1 USD piirist jäi 0,633386025 USD kasutamata. Kõik kuue jooksu testkontod kustutati; rahakirjed säilisid kasutajaseoseta. Teadmata kasutusega kutseid oli 0.

[Tagasilükatud katsete tõendid](evidence/rag-rerank-cache-rejected-trials-2026-10-08.json), [sõnumipiiri vahemäluproov](evidence/rag-rerank-cache-boundary-probe-2026-10-08.json). Raportisse salvestatud andmed sisaldavad vastuseid, kasutust ja allikate räsi/provenantsi; korpuse täistekste ei dubleerita Git-is. Täielikud sünteetiliste juhtumite toormõõtmised on kohalikult `tmp/rag-rerank-input-*.json`, lõplik jooks `tmp/rag-rerank-cache-no-writes.json`; [toorandmete räsid](evidence/rag-rerank-cache-raw-evidence-hashes-2026-10-08.json). Lõpliku kolme käitusmooduli räsi võrreldi jooksus kasutatuga ja need kattuvad.

Enne-jooks kasutas serveri `eb684d22` väljalaset. Lõpliku jooksu ajaks oli teine töö avaldanud ettevõttenime paranduse `a543ae5a`. Git-objektide võrdlus kinnitas, et `lib/rag-v2`, vestluse RAG-adapter ja rahaarvestus ei muutunud nende vahel; korpuse põlvkond ja küsimuste valimi räsi jäid samaks. Kandidaadi mooduli-ülekatte räsid on pärast-jooksus eraldi.

35 kulu/päringu/juhise/poliitika sihttesti kontrollitud; esimeses partiis üks plaanilepingu test andis `pilot_approval_required`, muutmata koodi eraldi kordus läbis. Sama aja repositooriumimuudatuse võimalikku seost ei ole tõendatud. Selle töö raames plaanilepingu käitumist ei muudetud. Varasemad 45 dialoogi/rahaarvestuse andmebaasitesti läbisid; lõplik poliitika säilitab nende päringud vaikimisi. Muudetud JS-i sihtlint ja `git diff --check` läbisid. Kohalikku build'i ega serveri testikomplekte ei käivitatud.

Kood on kohalik muudatus Astra auditiks. Poliitika on vaikimisi välja lülitatud, serveri seadistusse seda ei lisatud ning seda tööd tootmisse ei avaldatud. Avaldamisotsusele peab eelnema järelkontroll, eriti cache-tasuvuse ja rolli semantilise sobivuse kohta.
