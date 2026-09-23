# ADR-014 — EstNLTK päringu ja indeksi ühises otsingukihis

Kuupäev: 23.09.2026. Kohalik teostus ja kontroll, serverisse paigaldamata.

## Probleem ja otsus

Omanik valis RAG v2 koos EstNLTK ja allikaga seotud graafiga peamiseks edasiarendatavaks süsteemiks. Opuse ülevaatuse L5 osutas, et Snowballi senine kanal ei ühenda muu hulgas vorme „laps/lapse”, „vald/vallas” ja „toimetulek/toimetuleku”.

Vana RAG-i eemaldamisele eelnenud puus (`964e38c0e^`) sisaldas `rag-service/lemma_index.py` EstNLTK/Vabamorfi analüsaatorit. Vana vestluskood kutsus `/analyze-query` liidest, kuid eraldi SQLite lemmaindeks oli ainult võrdluskanal, mille tulemused ei mõjutanud tootmisotsingu järjestust. Taaskasutatud põhimõtted on algkuju säilitamine, mitme võimaliku lemma hoidmine ning liitsõnaosad. Vana teenus ja päringuheuristikad ei tule kaasa.

Uus leksikaalne leping on `pg-estnltk175-et-snowball311-en-ru-v1`. Päring ja indekseeritav pealkiri, sisu ning otsinguabiväljad läbivad sama analüsaatori. Eesti vormid saavad EstNLTK/Vabamorfi lemmad; inglise ja vene Snowballi tunnused säilivad. Täpne algtekst ja embedding'u sisend ei muutu. Lemmad jäävad tuletatud otsinguvälja, mitte allikatsitaati ega mudeli tõendisse.

`hybrid-estnltk-dependencies-v1` ühendab hübriidotsingu ja allikaga seotud sõltuvused. See on uute `retrievalProfile()` päringuplaanide vaikeprofiil; jätkatava `planIndexJob()` ning partii-CLI uued plaanid kasutavad vaikimisi EstNLTK lepingut. Vanad nimelised profiilid ja indeksid on loetavad. Ajalooliste `searchConfig()` ja `indexSnapshot()` vaikimisi leping jääb taasesituse ühilduvuseks vanaks; uue lepingu saab neile anda parameetrina. Olemasolevaid indekseid ega piloodi kinnitatud konfiguratsiooni automaatselt ei muudeta.

## Käitamine

EstNLTK 1.7.5 ja estnltk-core 1.7.5 on kinnitatud sõltuvused. Ametlik [paigaldusjuhis](https://pypi.org/project/estnltk/1.7.5/) katab Python 3.11–3.14; siin kontrolliti Windowsi Python 3.14.6 keskkonda.

Projekti juurkaustas, PowerShellis:

```powershell
python -m venv tmp/rag-v2-estnltk-env
& tmp/rag-v2-estnltk-env/Scripts/python.exe -m pip install -r lib/rag-v2/search/estnltk-requirements.txt
$env:RAG_V2_ESTNLTK_PYTHON = (Resolve-Path tmp/rag-v2-estnltk-env/Scripts/python.exe).Path
$env:TZ = 'UTC'
node --test tests/rag-v2-estnltk.test.mjs tests/rag-v2-estnltk.integration.test.mjs
```

Linuxis saab luua eraldatud `.venv` keskkonna `python3 -m venv .venv` abil ning määrata `RAG_V2_ESTNLTK_PYTHON` selle absoluutsele `bin/python` teele. Serveriprotsessile tuleb anda sama seadistus ning tarnesse peavad kuuluma Python-tööfail ja nõuete fail. Linuxi/serveri paigaldus on `not_run`.

Node kasutab taaskasutatavat kohalikku Python-protsessi ja piiritletud JSON-ridu stdin/stdout kaudu. Puudub uus HTTP-teenus, LLM-kutse või päringutekstide püsiv vahemälu. Ühes töös on kuni 96 teksti / 200 000 märki, ühes väljas kuni 50 000 märki. Suurem indeks jaotatakse töödeks; ülemäärast välja ei kärbita vaikselt. Säilitatakse kuni kaheksa analüüsivarianti ja piiratud hulk liitsõnaosi, kasutades `disambiguate=False`. Pärisnimede analüüs saab tõstutundliku sisendi.

Tööl on 30 sekundi tähtaeg ja vastuse suuruse piir. Rikutud protokoll, vale paketiversioon või puuduv analüsaator annavad vea; EstNLTK põlvkond ei lähe automaatselt üle Snowballile. Protsess lõpetatakse 60 sekundi jõudeoleku järel. Pakettide versioone kontrollitakse enne analüüsi ning Python-kood ja nõuete fail kuuluvad piloodi teostusmanifesti.

## Kontrollitud tõend

- 25 näitlikku käändepaari: EstNLTK ühine tunnus 25/25, senise kolme Snowballi keele mistahes ühine tunnus 11/25. See on sihitud regressioonivalim, mitte esinduslik korpuse recall-hinnang.
- „Puudega” säilitab nii „puu” kui „puue” võimaluse. Lemma ei tõenda lause tähendust ega inimese abivajadust.
- Päris kohalik PostgreSQL/Qdrant: vana põlvkond jääb jätkatava indekseerimise ajal aktiivseks; uus leiab seitse ET/EN/RU käändepäringut koos muutumatute algallikakohtadega. Õigusteta allikas jääb välja, tenant'id ei segune, analüsaatori puudumisel tagastatakse viga ning rikutud lemmaandmed tuvastatakse.
- Protsessi taaskasutus, paralleelsete vastuste sidumine, ajapiir, uuesti käivitumine, puuduv käivitatav fail, versioonierinevus, vigane vastus ja suurusepiirid on sihttestidega kaetud.
- Esimene käivitamine koos värske paigaldusega võttis ühes sõnapaari-katses ligikaudu 7,1 s; hilisem uue protsessi 50 sõna katse 1,9 s. Juba käivitatud protsessi üks lühilause 1 ms. Need on üksikmõõtmised, mitte tootmise latentsuslubadus.
- Läbisid 33 eri sihttesti: esimeses jooksus 22 (EstNLTK, vana morfoloogia ja jätkatav indeks), pärast vaikeprofiili täpsustamist 18 (neist seitse kordusid; lisaks järjestus- ja piloodi konfiguratsioonitestid). Jooksud olid `TZ=UTC`; tasulisi mudelikutseid 0.

## Allesjäävad piirid

EstNLTK parandab sõnavormide leidmist. See ei lahenda üksinda sõnalise kanali üldsõnamüra, KOV-i ulatuse määramist, teenuse-kontakti seoseid, eitust ega vestluse mõistmist. Vektorotsingu ja päris vastusemudeli kvaliteeti siin ei hinnatud. Opuse L1/L2/L4/L6 jäävad järgmisteks eraldi parandusteks. Uus põlvkond nõuab uuesti indekseerimist; varem salvestatud pärisvektoreid saab taaskasutada uute embedding'u kutseteta. Serveri indeks, piloodiseadistus ja vestlusrada on `not_run`.
