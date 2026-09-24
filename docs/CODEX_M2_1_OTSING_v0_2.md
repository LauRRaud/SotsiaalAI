# Codexi jätkuülesanne: M2.1 — kohalik otsingutaristu ja tõenduspakett

Versioon 0.2 · 05.09.2026 · SotsiaalAI / eraldatav RAG v2

## 1. Eesmärk ja tõendi piir

Jätka olemasolevat M0/M1 teostust. Ehita selle peale lokaalselt käivitatav PostgreSQL-i leksikaalse otsingu ja Qdranti vektorotsingu ühendus, mis tagastab päritoluga tõenduspaketi. Selles töövoorus ei tehta väliseid mudelikutseid ega koostata Luna vastuseid.

See dokument täpsustab algse lähteülesande M2 etappi, mitte ei asenda v0.1 tervikplaani. M2.1 on taristu ja tehniliste lepingute kontroll; M2.2 on hilisem tegeliku embedding-mudeli ning sisulise otsingukvaliteedi katse. M2 ei ole tervikuna vastu võetud ainult M2.1 testide läbimise põhjal.

Kasutaja/Codexi raport: näidis-PDF-i 13 lehelt saadi 16 tekstiosa, läbiti 22 sihttesti, lint, tõlkekontroll ja tootmisbuild; välismudelikutseid oli 0. Jätkuülesande koostamisel loeti `repository-audit.md`, `adr-001-local-ingestion.md` ja `README.md`. Teostuse lähtekoodi, tegelikku normaliseeritud väljundit ega testilogi siin sõltumatult ei kontrollitud. Dokumenteeritud kontrollide kirjeldus ei asenda nende uuesti käivitamist arenduskeskkonnas.

## 2. Loe ja säilita olemasolevad otsused

Loe tegeliku repositooriumi arendusjuhiseid, sh asjakohaseid `AGENTS.md` faile, aktiivset `SotsiaalAI.md` S1.0 kirjet, RAG masterit, v0.1 lähteülesannet ning M0/M1 dokumente. Tuvasta kehtiv lähtepuu ja töökaust; M0 auditi SHA on ajalooline lähtepunkt, mitte korraldus praegune töö tagasi kerida.

Säilita:

- Node/JavaScript ESM ja olemasolev paketihaldus; ära kirjuta tuuma teise keelde.
- M1 originaalid, väliste tunnuste vastendus, `legacy_metadata`, päritolu, allikakohad ja versioonid.
- Tuuma eraldatus Next.js-ist, kasutajaliidesest ja vana RAG-i helperitest. Andmebaasi- ning vektorikliendid asuvad adapteripiiril, mitte PDF-i normaliseerimisloogikas.
- ADR-001 lähtevalik: PostgreSQL-i `simple` täistekstiotsing + Qdranti vektorotsing + rakenduse rank-põhine RRF. Ära lisa kõrvale veel eraldi otsinguteenust või Qdranti hõrevektorite indeksit ilma mõõdetud vajaduseta.
- Senine chat API ja admini enesetesti `retired` olek. Selle plokiga ei avata HTTP-otsingut, vestlust ega avalikku failivaadet.
- Üks aktiivne tööseisufail. Lisa ADR ja käitusjuhis vajaduse järgi, aga ära loo mitut konkureerivat DONE-registrit.

## 3. Selle töövooru piirid

Lubatud on lokaalse arenduse migratsioonid, eraldatud PostgreSQL-i testandmebaas/skeem, lokaalne Qdrant, adapterid, CLI, testid ja privaatsed ülevaatefailid. Ühiktestid võivad kasutada adapterite testiasendajaid; integratsioonitõend peab kasutama päriselt töötavat PostgreSQL-i ja Qdranti.

Ei ole lubatud tootmismigratsioon, serveri tundmatute teenuste muutmine, tootmisandmete kopeerimine, kogu korpuse indekseerimine, tasuline API-kutse, üldine veebirobot, pilveparser, genereeriv planeerija/kriitik ega autonoomne agent. Ära kirjuta algmaterjale või kasutaja muid töid üle.

M1 `local_private/development_only` märgist ei saa järeldada välisele embedding-teenusele saatmise luba. API-võtme olemasolu ei ole käivitusluba. M2.1 töötab ilma vastaja API-võtmeta.

Teenuste vahelised võrguühendused on lubatud ainult määratud lokaalses arenduskeskkonnas. Ühiktestid ei kasuta võrku; integratsioonitestid lubavad ainult nende PostgreSQL-i/Qdranti sihtkohad. Vajalikud paketid ja konteineripildid hangitakse projekti lubatud viisil eraldi seadistussammus; tarkvara allalaadimist ei segata mudeliteenuse egress'i lubamisega. Lukusta versioonid ning ära kasuta liikuvat `latest` silti.

Kui tegelikke kohalikke teenuseid ei saa käivitada, tee võimalik kooditöö ja ühiktestid, kuid märgi integratsioon `NOT_PROVEN`. Testiasendaja ei täida päristeenuse vastuvõtutingimust.

## 4. Alusta olemasoleva M1 väljundi kontrollist

Käivita M1 sihttestid päris sisendjuurega. Esita pass/fail/skip eraldi. Kontrolli, et puuduv PDF pole põhjustanud pärisandmete testide vahelejätmist.

Loe tegeliku jooksu `active.json`, `bundle.json`, `provenance.json`, `spans.json`, `chunks.json` ja `report.html`. Ära kasuta otsingu sisendina suvalist `versions/` kataloogiloendit. Kontrolli algfailide ja väljundite kontrollsummasid.

Kontrolli vähemalt alguse, peatükivahetuse, lehekülje piiri ja lõpu tekstiosi. Veendu, et allikatekst, leht ja lähteviide vastavad üksteisele ning pealkirjaprefiks pole märgitud algteksti tsitaadiks. Katvuses peavad säilima viited puhastamisel eemaldatud materjalile; ära nõua prindipäiste indekseerimist.

Arv 16 on selle sisendi ja konfiguratsiooni tulemus, mitte kõigi failide tükeldamise eesmärk. Paranda tõendatud M1 takistus väikese, testiga kaetud muudatusena; ära alusta ingest'i ümberkirjutamist. Ära nõua M2.1 alustamiseks kõigi tulevaste failitüüpide parsimisvõimekust.

## 5. PostgreSQL-i põhiregistri adapter

Salvesta M1 andmelepingule vastavad dokumendid, versioonid, allikakohad, tekstiosad, õiguste/kasutusulatuse andmed ning struktuursed seosed PostgreSQL-i. Säilita lähteidentiteedid ja päritolu; Qdrant on neist taastatav indeks, mitte ainus teadmise hoidla. Originaalid võivad jääda privaatsesse failihoidlasse, andmebaasis nende viited ja räsid.

Tee migratsioonid arenduskeskkonna eraldatud sihtkohta. Kasuta projekti sobivat olemasolevat migratsioonimeetodit; väldi konkureerivat tootmisskeemi haldust. Testi andmete võrdväärsust M1 failiadapteriga. M1 failiadapter võib jääda kohaliku ja regressioonitestide adapterina alles.

Olulised piirangud: tenant kuulub võtmetesse või kõigi kirjete sidumise kontrolli; viide ei tohi ristuda teise tenant'i/dokumendiversiooniga; korduv import ei dubleeri; vanu versioone ei kirjutata vaikselt üle. Rikutud või puuduva päritoluga aktiivkirje peab andma nähtava vea.

## 6. Embedding-adapter ja sisendipiir

M2.1 vaikeadapter on deterministlik, selgelt testiks märgitud vektorite tootja. See ei ole semantiline mudel. Selle vektorid asuvad eraldi testkollektsioonis/indeksinimeruumis ega tohi seguneda tulevaste pärisembedding'utega. `embedding_mode=mock` või samatähenduslik väli peab olema nähtav registris, päringu tulemuses ja aruandes.

Liides sisaldab vähemalt mudeli/providri identifikaatorit, mõõtmeid, kaugusfunktsiooni, tokeniseerija identifikaatorit/versiooni, sisendi koostamise versiooni ning sisendi räsi. Mõõtmete võrdsus üksi ei tähenda sama vektorruumi; erineva mudeli vektoreid ei ühendata.

M1 vaikimisi 2200 märgi piir ei ole tokenipiir. ADR lubab pika PDF-tekstirea tervikuna säilitada. Lisa indeksisse mineva täisteksti tokenipõhine eelkontroll koos pealkirja- ja peatükiprefiksiga. Kasuta valitud embedding-mudeli jaoks kohapeal kontrollitavat tokeniseerimist. Ära asenda seda kontrollimata `märgid / 4` hinnanguga. Dokumenteeri teegi versioon ja kooskõla testid; tokeniseerimiseks pole vaja tasulist kutset.

Ülepika teksti korral loo vajaduse järgi eraldi, stabiilsete identifikaatoritega indeksiüksused, mis viitavad M1 tekstiosale ja selle allikakohtadele, või peata selle teksti indekseerimine selge veaga. Ära kärbi teksti vaikselt ega muuda juba väljastatud M1 allikavahemikke. Säilita UTF-16 indeksite tähendus ja testi mitme koodiühikuga sümboleid. Kui teksti ei saa ohutult jaotada, ei märgita põlvkonda täielikult valmis.

Vahemälu võti eristab tenant'i/lubatud kasutusulatust, providrit, mudelit, mõõtmeid, sisendi koostamise versiooni ja tegeliku embedding-sisendi räsi. Muutumatu teksti metaandmeuuendus võib olemasolevat vektorit taaskasutada, kuid peab uuendama seosed ja filtrid. Mudeli või sisendi muutus ei kasuta vanu vektoreid. Ära lisa vaikimisi klientidevahelist ühist sisupõhist vahemälu.

## 7. Kooskõlaline indeksi avaldamine

Loo otsingu jaoks eristatav indeksipõlvkond: millised dokumendiversioonid, töötlejad, leksikaalne konfiguratsioon, embedding-konfiguratsioon ja Qdranti siht sellesse kuuluvad.

M1 lokaalne `published` ei tähenda, et PostgreSQL-i ja Qdranti otsinguandmed on valmis. Teosta lihtne põlvkonnapõhine staging ja aktiveerimine; hajustransaktsiooni ega üldist orkestreerimisraamistikku pole vaja.

Soovitud järjestus:

1. Fikseeri allikaregistri lubatud dokumentide versioonipilt ja loo mitteaktiivne indeksipõlvkond.
2. Kirjuta PostgreSQL-i otsinguandmed ning Qdranti vajalikud punktid/filtriväljad.
3. Kontrolli eeldatud kirjete identiteete, arve, konfiguratsiooni ja proovipäringu teostatavust.
4. Aktiveeri otsingupõlvkonna viide PostgreSQL-is alles pärast mõlema poole valmimist. Konkureeriv vanem indekseerimistöö ei tohi uuemat aktiivset seisu üle kirjutada.
5. Päring fikseerib alguses ühe aktiivse põlvkonna ja kasutab seda mõlemas kanalis ning allikateksti lugemisel.

Katkestus enne aktiveerimist jätab vana põlvkonna kasutusse. Uuesti käivitamine on idempotentne. Ära kustuta kasutuses oleva põlvkonna andmeid uue ettevalmistamise käigus. Esimene lahendus võib hoida vana põlvkonna alles ja kasutada selget lokaalse hoolduse juhist.

Õiguste tühistamine ei tohi pärida vana põlvkonna aegunud luba. Enne tõenduspaketi tagastamist kontrolli hetkel lubatud juurdepääsu; seda testi saab teha kohaliku poliitikaadapteriga. See ei väida, et platvormi HTTP-autentimine või täielik kustutuste elutsükkel oleks M2.1-ga valmis.

## 8. Päring ja kanalite liitmine

Loo `retrieve()` või projekti tavadele vastav otsinguliides ning kohalik CLI. See ei kutsu `answer()`-it.

Päringule antakse operaatori/testi usaldatud ligipääsukontekst, tekst, keel, valikulised selgelt määratud aja/piirkonna filtrid ja eelarve. Puuduv või vigane tenant on viga, mitte luba otsida kõigi tenant'ide seast. CLI tenant jääb arenduse nimeruumiks, mitte veebikasutaja autentimistõendiks.

Käivita PostgreSQL-i leksikaalne otsing ja Qdranti vektorotsing võimaluse korral paralleelselt. Kliendi, lubatud dokumentide ja põlvkonna ulatus rakendub mõlemas kanalis enne tulemuste valikut; kontrolli seda päris integratsioonitestiga. Qdranti payload-filtrid ei asenda rakenduse õiguste allikat.

Määratle PostgreSQL-i päringu koostamine, väljade kaalud, null/tühja päringu käitumine ja turvalised parameetrid. Kasuta algteksti ja eksplitsiitselt märgitud otsinguabi; vana kirjeldust ei tohi tagastada algteksti tõendina. Ära nimeta `simple` indeksit BM25-ks ega lemmatiseerijaks. Kontrolli tegelikke `ts_debug`/`tsvector`/päringuväljundeid ET/EN/RU näidetel. Selle plokiga ei lisata genereerivat tõlkijat ega suure kohaliku keeletöötlusmudeli teenust.

Ühenda tulemused rank-põhise RRF-ga; parameetrid ja võrdsete skooride järjekord on dokumenteeritud. Ära summeeri põhjendamata toorskoore. Eemalda sama üksuse kanalitevahelised duplikaadid. Piira ühe dokumendi korduvust seadistatavalt, kuid säilita üksuse kõik vajalikud allikaviited ja ära liida eri õigustega tekste üheks.

Puuduvat piirkonda ei asendata vaikimisi KOV-iga. Avaldamisaeg ja kehtivus ei vahetu omavahel. Inglise/vene päringu keel ei sunni välistama eestikeelseid allikaid. Määra, kuidas tundmatu kuupäev/piirkond käitub eri filtrites, ja testi kokkulepet.

Lisa struktuurse laienduse sisse/välja lülitatav rada, mis kasutab M1 `BELONGS_TO`, `PARENT_SECTION` ja `NEXT_SPAN` seoseid. Läbimine ja kontekstimaht on piiratud, lisamise põhjus jälgitav. Ära lisa M2.1-s semantilisi `REQUIRES`/`EXCEPTION_TO` seoseid ega üldist sõltuvussulundit: need kuuluvad M3-sse. Ükski suur naabripakett ei saa piiramata eelarvet.

Teenuse viga ei võrdu null leidu. Defineeri `ok`, `empty`, `degraded` ja `error` eristus või samaväärne leping. Lubatud leksikaalne varurada võib jätkata Qdranti tõrke korral, kuid peab olema nähtavalt `degraded`; ära laienda õigusi ega vaheta indeksipõlvkonda tõrke varjamiseks. Vektori-RRF skoor ei ole vastuse tõenäosus või tõend.

## 9. Tõenduspakett ja jälgitavus

Tagasta masinloetav pakett, mitte valmis loomuliku keele vastus. Kasuta olemasolevate tüüpidega sobivaid nimetusi. Vajalik on vähemalt:

| Osa | Vajalik sisu |
| --- | --- |
| Päringu identiteet | Päringu ID, keele ja valitud filtrite kirjeldus; vaikimisi ei logita täisvestlust |
| Versioon | Tenant, indeksipõlvkond, korpuse versioonipilt, otsingu-/embedding-konfiguratsiooni ID |
| Olek | Päris/mock-eristus, kasutatud kanalid, hoiatused ja tõrke/varuraja seis |
| Allikad | Dokumendi ja versiooni ID, tekstiosa/indeksiüksuse ID, SourceSpan ID-d, 1-põhised PDF-lehed |
| Tekst | Algtekst ja tuletatud otsinguabi eraldi; pealkiri/autor pärinevad põhiregistrist |
| Valik | Kanalite järgukohad, RRF panused, piiratud struktuurse laienduse põhjused |
| Piirangud | M1 hoiatused, katvuse piirid, semantiline kohaldatavus selles etapis hindamata |
| Mõõtmised | Kanalite, liitmise, laiendamise ja kogu otsingu aeg; kandidaatide ja konteksti maht; välismudelikutsete arv |

Allikate ID-d peavad lahenema täpselt selle põlvkonna lubatud allikakohtadeks. Tundmatu või lubamatu allikakoht ei teki näiliseks viiteks. Ära avalda lokaalse faili absoluutset rada avaliku URL-ina; tee ainult privaatne arendusvaade või eksport.

Koosta üks privaatselt vaadatav tegeliku päringu väljund, kus inimene näeb leitud teksti, lehte ja valiku põhjust. Kui genereerid HTML-i, põgeneeri ebausaldatud tekst; dokumendi sisu ei ole käivitatav HTML ega süsteemijuhis. Otsingumootor ei täida algallikas sisalduvaid käske.

## 10. Vastuvõtukontrollid

Teosta v0.1 asjakohased M2 juhtumid päris testidena ning lisa allolevad invariandid olemasolevasse testikorraldusse. Tabel on nõuete nimekiri, mitte väide testide läbimise kohta. Testide arv ise ei ole kvaliteedieesmärk.

| ID | Kontroll |
| --- | --- |
| M2.1-01 | M1 regressioonid, päris PDF-i testide eristatav läbimine ning kõik skip-põhjused on nähtavad. |
| M2.1-02 | Failiregistrist PostgreSQL-i ülekandmisel säilivad identiteet, päritolu, allikakohad ja kordusimpordi idempotentsus. |
| M2.1-03 | Päris kohalikud PostgreSQL ja Qdrant võtavad andmed vastu ning tagastavad CLI-päringu tulemuse; teenuste puudumine ei ole roheline test. |
| M2.1-04 | Sama sisuga kahe tenant'i fixture ei anna ristuvat kirjet, skoori, teksti, naabrit ega allikaviidet. |
| M2.1-05 | Puuduv tenant, kehtetu põlvkond ja lubamatu dokument ei tekita ulatust laiendavat varurada. |
| M2.1-06 | Katkestus mõlema indeksi valmimise vahepeal säilitab vana aktiivse põlvkonna; kordus taastub duplikaadita. |
| M2.1-07 | Päringu ajal aktiveeritud uuem põlvkond ei sega vana ja uut dokumenti ühte paketti; vana indekseerimistöö ei kirjuta uuemat pointer'it üle. |
| M2.1-08 | Õiguse tühistamine välistab tulemuse tagastamise ka vana põlvkonna kaudu. Testitud poliitikaadapter eristub veel ühendamata veebiautentimisest. |
| M2.1-09 | Sama embedding-sisend taaskasutatakse; tekst, mudel, mõõtmed või sisendi koostamise versioon muudavad vahemälu valikut. |
| M2.1-10 | Vales mõõdus, vigane arvuline vektor ja mock/päris konfiguratsiooni segamine lükatakse tagasi. |
| M2.1-11 | Liiga pikk tekst, prefiksiga piiri ületamine ja mitme UTF-16 üksusega sümbol ei põhjusta vaikset kärpimist ega vigast SourceSpan'i. |
| M2.1-12 | RRF, duplikaadid, võrdsed skoorid ning tühi üks kanal on deterministlikult testitud. |
| M2.1-13 | Leheviide ja tsitaat laheneb algtekstiks; tuletatud pealkiri või legacy-kirjeldus ei muutu tõenditsitaadiks. |
| M2.1-14 | Struktuurne laiendus on piiratud, ei lähe teise versiooni/tenant'i ning graph-off võrdlusrada toimib. |
| M2.1-15 | Puuduv piirkond ei muutu KOV-iks; aegade tähendused ning ET/EN/RU tokenizer'i näited on eraldi kontrollitud. |
| M2.1-16 | Tühi leid, teenuse tõrge ja leksikaalne varurada on eristatavad; keskkonnas olev API-võti ei käivita mudelikutset. |
| M2.1-17 | Eraldatud sünteetiline teise valdkonna ja eksitavate dokumentide test ei vaja tuuma valdkonnaspetsiifilist muudatust. |
| M2.1-18 | Repositooriumi lint, tõlkekontroll ja build käivitatakse projekti olemasoleval viisil; salaväärtused ja privaatne allikatekst ei satu logidesse ega commit'i. |

Mock-vektorite test kontrollib mehaanikat, mitte seda, kas tähenduslikult õige lõik leitakse. Kontrollitud sünteetilised vektorid võivad tõendada järjestaja arvutust; testi jaoks sobitatud vektor ei ole pärisküsimuse semantilise otsingu tulemus.

## 11. Valmista ette M2.2, kuid ära käivita välisteenust

Koosta väike otsinguküsimuste fail, milles oodatavad allikakohad on märgitud algteksti põhjal, mitte valitud praeguse järjestaja vastusest. Erista päris artikli küsimused, selgelt sünteetilised mehaanika-/õigustestid ja korpuses vastuseta küsimused. ET/EN/RU sama olukorra sõnastused kuuluvad ühte olukorraperekonda.

Hilisem hindamine võrdleb sama korpuse peal leksikaalset, tegelikku vektori- ja hübriidotsingut ning struktuurse laiendusega/ilma rada. Märgi oluline tõenduskoht, mitte ainult dokumendi ID. Kasuta väikese valimi korral näiteks top-1/top-3/top-5 mõõtmist ja kontekstieelarvet; kõigi 16 tekstiosa tagastamine ei ole sisukas top-k edu. Lisa eraldi eksitavad dokumendid, kui need on kättesaadavad ja lubatud. Puuduvat päriskorpust ei asendata fabritseeritud ajalooga.

Vastuseta päring ei pea toorel vektorotsingul andma null kandidaati. Hindamine peab näitama, et küsimusele vajalik tõend puudub; ära lisa meelevaldset skoorilävendit ainult testi roheliseks tegemiseks. Selles etapis ei tõendata vastamise või keeldumise semantilist kvaliteeti.

Valmista tokeniarvul põhinev proovikäivituse plaan: täpsed failid ja räsid, embedding-mudel, mõõtmed, maksimaalne sisendtokenite arv, maksimaalne katsete arv, korduskatsete poliitika ning konfiguratsiooniga seotud rahaline hinnang. Kui hind pole seadistatud, märgi rahaline kulu teadmata; ära näita väljamõeldud nullkulu.

M2.2 väliskäivituseks on vaja omaniku eraldi kinnitust nii konkreetse materjali välisele teenusele saatmisele kui ka kulupiirile. Ära lisa seda kinnitust ise. Kogu M2.1 vältel jäävad genereerivad mudelikutsed ja välised embedding-kutsed nulliks.

## 12. Lõpparuanne ja peatumine

Esita tehtud muudatused ja praegune commit/tööpuu seis, kasutatud teenuste versioonid, tegelikult käivitatud käsud, pass/fail/skip arvud, konkreetse ingest'i/otsinguväljundi privaatne asukoht ning üks tegelik tõenduspakett.

Erista tõenditulemused:

- kohaliku pärisandmebaasi integratsioon;
- deterministlik järjestus- ja õiguste mehaanika;
- tegeliku embedding-mudeli semantiline kvaliteet: M2.1 järel veel `NOT_PROVEN`;
- HTTP-autentimine, Luna vastamine, semantiline graaf ja kümne aasta korpus: selles plokis teostamata/testimata.

Salvesta otsinguetappide kestused koos keskkonna ja korduste arvuga. Üks päring pole p95 ega tootmiskoormuse katse. Ära anna õigsuse protsendilist müügilubadust.

Uuenda olemasolevat aktiivset seisufaili ja vajalikku README/ADR-i. Kui kõik M2.1 vastuvõtukontrollid ei käivitu, erista valmis kood tõendamata integratsioonist. Peatu enne tasulist M2.2 proovikäivitust, M3 semantilisi sõltuvusi ja M4 chat-raja avamist.

## Dokumentaalsed lähtekohad

Esitatud arendusdokumendid:

- `repository-audit.md`: M0 lähtepuu, integratsioonipinnad ja `NOT_PROVEN` piirangud.
- `adr-001-local-ingestion.md`: eraldatud tuum; M2 PostgreSQL + Qdrant; `simple` + RRF; 2200 märgi/tokenipiiri eristus; kohaliku avaldamise piirid.
- `README.md`: tegelik M1 CLI, väljundfailid, pärisfaili testide skip-leping ja seni tegemata kontrollid.
- `CODEX_RAG_GRAPH_LAHTEULESANNE.md` v0.1: M2/M3/M4 eristus, kulupiirid ja algsed vastuvõtunõuded.

Komponentide ametlikud viited, kontrollitud 05.09.2026; täpne teostus kontrollida lukustatud versiooni vastu:

```text
PostgreSQL dictionaries — simple dictionary ei ole morfoloogiline analüsaator:
https://www.postgresql.org/docs/current/textsearch-dictionaries.html

Qdrant filtering — payload/ID filtrid ja filtriväljade indeksid:
https://qdrant.tech/documentation/search/filtering/

OpenAI embeddings — sisendteksti tokeniseerimine ja embedding-konfiguratsioon:
https://developers.openai.com/api/docs/guides/embeddings
```

Need viited kirjeldavad komponentide võimalusi. Need ei tõenda SotsiaalAI otsingu kvaliteeti ega selle ülesande teostamise õnnestumist.
