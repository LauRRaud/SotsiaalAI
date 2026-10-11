# ADR-125: vestluse seisundi aruanne; ajalõpp ei lõpe enam palja veaga

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (ehitas agent, üle vaatas teine agent, parandused ja kontroll minult). Seis: **kood ja testid tehtud; käsku ei ole päris andmebaasil käivitatud.**

## Probleem

Agentide kaardistus (09.10.2026) leidis, et vestluse käitajal ei ole millestki näha, kuidas pöörded lõpevad:

- plaani kulupäevikut ei loe ükski vahend. Päevik on plaani eluaegne loendur (praegu lagi 4 USD ja 4000 kutset, umbes 1000 pööret; uus päevik tekib korpuse täiendusega, väljalase seda ei uuenda). Kui see täis saab, näeb kasutaja „liiga palju päringuid“ ja midagi ei logita;
- veakoodide, tagasi lükatud vastuste ega kiiruse kohta ei ole ühtki koondit.

Lisaks üks viga: teenusepakkuja ajalõpp on viga, mille kood on arv (23), mitte tekst. Koodi kontroll eeldas teksti ja viskas ise vea, nii et päring lõppes palja 500-ga vestluse enda veateate asemel.

## Otsus

1. **Aruanne** `scripts/rag-v2-chat-health.mjs --days 7` (`lib/rag-v2/pilot/health-report.js`): ainult arvud, mitte ühtki küsimust, vastust, lõiku, pealkirja ega kasutajat. Päevade kaupa ja kokku: pöörded oleku järgi, ebaõnnestunud veakoodi järgi, vastused liigi järgi, kontrolli tagasilükkamised, tervituse ja tänu tee, mida otsinguplaan ja valik tegid, iga etapi ja kogu pöörde mediaan ja 95. protsentiil. Eraldi plaani päevik: iga lagi, kulunud, alles ja osa; loend lagedest, mille alla järgmine kutse enam ei mahu.
2. Pöördeid loetakse ainult siis, kui rakenduses on üks konto (testkonto) või on antud hetk, milleni see nii oli (sama kaitse mis katvuskaardil). Päevik ja kutsete kviitungid sisu ei hoia ja loetakse alati.
3. **Veaparandus** (`lib/chat/m4PilotServer.js`): koodi kontroll vaatab enne, kas kood on tekst. Muud selles failis ei muudetud.

## Mida see ei tee (omaniku otsused)

Kaardistus pakkus rohkem: ootamine katkenud ühenduse järel igas olekus, selgemad veateated, uuesti proovimise nupp, `ready` kontroll, mis loeb päevikut. Ülekontroll näitas, et igaüks neist muudab seda, mida inimene loeb, või võib peatada kõik väljalasked, ja vajab otsust:

- mida näidata, kui teenuse eelarve on otsas, kui vestlus on hõivatud või kui kutse tulemus on teadmata;
- kas sama küsimust tohib pärast teadmata tulemust kohe uuesti saata (praegu ei tohi);
- teenuse eelarve suurus ja mis juhtub, kui see täis saab;
- üleminek avamisplaanile.

Tasuta loendus serveris (10.10.2026, viimase kümne päeva 236 testpööret): 234 lõpetatud, 1 peatatud (paketi suuruse piir, parandatud 06.10), 1 tagasi lükatud vastus; teenusepakkuja tõrkeid 0; valik jättis vastuse lõikudeta 1 korral. Need vead on praegu harvad.

## Kontrollitud

- Ühiktestid koos teiste öö muudatustega: 1337, neist 1315 läbi. Kuus uut testi aruande kohta (iga loend, protsentiilid, lahjad read, päevik lae lähedal, aruandes ei ole ühtki tehisküsimuse ega -vastuse sõna) ja üks ajalõpu kohta.
- Sõltumatu ülevaatus: kolm väikest leidu (taastatud pöörde kontrollikood, pika aruande kirjutamine torusse, säilitusaja märkus), kõik parandatud.

## Kontrollimata

- Käsk päris andmebaasil (esimene käivitus pärast väljalaset).
