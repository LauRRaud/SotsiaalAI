# Ajakirja allikafailide paranduse tõend — 07.09.2026

Parandatud kaust: `Andmebaasi/ajakiri_sotsiaaltoo/`.

| Tulemus | Arv |
| --- | ---: |
| Kontrollitud JSON → allikafaili seosed | 892 |
| Säilitatud olemasolevad artikli-PDF-id | 638 |
| Terviknumbrite PDF-idest eraldatud artiklid | 211 |
| Veebist HTML-ina säilitatud artiklid | 43 |
| Artiklite PDF-allikad kokku | 849 |
| Pärast asendusallika ja varukoopia kontrolli eemaldatud TXT-d | 890 |

Kümme kohalikku terviknumbrite PDF-i jäid muutmata alles. Kõik aktiivsed `source_path` väljad on sama kausta PDF- või HTML-faili suhtelised nimed. Vigase TXT-konversiooni oleku- ja sõnaarvuväljad eemaldati; vana allikatee säilib ainult paranduse päritoluandmetes ja taastatavas varukoopias. Kohaliku HTML-teemaregistri 870 olemasoleva kirje failiviited ja bibliograafia ning viie vana artikliloendi failiviited on uuendatud.

## Oluline parandus varasemasse kaardistusse

254 serveris lisaks olnud allikat olid tegelikult `text/plain` failid. Varasem olemasolu-/räsivõrdlus nimetas neid ekslikult PDF-ideks. PDF-parseri kontroll peatas selle vea enne kohalike algfailide muutmist. Need serveri TXT-d jäeti asendus-PDF-idena kasutamata.

211 trükiväljaande artiklit eraldati omaniku toodud terviknumbrite PDF-idest. Ülejäänud 43 on veebiallikad ning nende sisu säilitati avaldaja ametlikelt lehtedelt HTML-ina, koos URL-i, kogumisaja ja allikaräsiga. HTML-i ei nimetatud ümber PDF-iks. Üksikute veebilehtede sees eraldi kommentaaride ja alamjaotiste piiritlemine jääb struktureeritud ingesti ülesandeks; säilitatud leht on selleks algallikas.

## Artiklipiirid ja kujundus

Artikli lehekülgede alus oli serveri bibliograafia ning terviknumbrite füüsiline numeratsioon. Eraldatud artiklite puhul säilivad lähte-PDF-i räsi, füüsilised leheküljed, trükitud leheküljed ja lehesiseste alade koordinaadid `source_repair.extraction` all.

85 kõrvutiste artiklite kattuvat leheküljepiiri kontrolliti pealkirja ja paigutuse järgi. 68 juhul eemaldati eelmise artikli failist lehekülg, millelt algas juba järgmine artikkel. 17 juhul jagasid artiklid sama lehte: vastavad tekstialad eraldati, eemaldades teise artikli teksti PDF-i sisust ning säilitades oma osa kujunduse. Trükitud leheküljevahemiku korrigeerimisel säilitati serveri varasem väärtus päritoluandmetes. Originaalnumbrid jäid muutmata.

Visuaalselt kontrolliti sihitud näiteid, sealhulgas sama lehe eelmise artikli lõppu ja järgmise algust. Kõiki lehti visuaalselt läbi ei vaadatud. Kõigi PDF-artiklite lehekülgede arv ja kõigi 892 allikaseose räsi on kontrollitud.

See töö parandab sisendfaile. See **ei tõenda veel** RAG-i tekstieralduse õiget veergude lugemisjärjekorda ega lõikude terviklikkust. Järgmise ingesti vastuvõtt peab säilitama artikli ja alapealkirja struktuuri, ühendama üle veeru/lehe jätkuva lõigu ning vältima naaberartikli teksti kaasamist. Chunkimist selles töös ei käivitatud ega muudetud.

## Taastamine ja muutmise ulatus

Enne muutmist arhiveeriti JSON-id, TXT-d ja kohalikud registrifailid: `output/journal-repair-backup-20260907/originals.tar`. Arhiiv taastati eraldi kontrollkausta ja kõiki taastatud faile võrreldi algsete SHA-256 räsidega. Arhiivi räsi, algfailide nimekiri ning paranduse kviitung on samas varukoopiakaustas.

TXT-d eemaldati alles pärast kõigi asendusallikate kontrolli. Serveri registrit, sealset indeksit ega algfaile ei muudetud; tasulisi mudeli- või embedding-päringuid ei tehtud. [Masinloetav tulemus ja allikaseosed](journal-source-repair-2026-09-07.json).
