# ADR-097: veebilehe aadress vastuse tekstis ja lingina sõnumimullis

Kuupäev: 06.10.2026. Seis: kood tehtud; päris lehe mõõtmine pärast juurutust on üleandmisfailis (S1.0).

## Probleem

Korpuses on veebilehed: ametlikud juhislehed (v60) ja abivahendite müüjate lehed (v62). Kui vastus neile toetus, nimetas ta ettevõtte ja lehe sisu, kuid lehe aadressi sõnumimullis ei olnud. Leheni jõudis kahe klõpsuga: viitemärk, „Ava allikas“ ja seal „Algallikas“.

Omanik 06.10.2026: „allikates on link, aga sõnumimullis linki ei olnud. Lingid peavad olema sõnumimullides ka“ ja „Luna võib ju kuidagi loomulikult märkida ära veebilehe aadressi“.

## Otsus

Luna nimetab veebilehe aadressi vastuse lauses ise; vestlus teeb selle aadressi mullis lingiks.

1. **Mudel näeb lehe aadressi.** Veebilehe allikakaardil (allika liigid `web_page` ja `vendor_page`) on väli `web_address`: aadress nii, nagu inimene selle kirjutaks (sait ja tee; ilma `https://`, ilma `www.` ja lõpukaldkriipsuta). See tuleb dokumendi deklareeritud aadressist, mitte mudelilt.
2. **Juhis ütleb, millal ja kuidas** (dialoogi juhise versioon 28): kui vastus toetub sellisele lehele ja lugejal on lehe avamisest abi (kust midagi saada, kuidas taotleda, kelle poole pöörduda), nimetab vastus aadressi lauses, täpselt kaardil antud kujul, üks leht üks kord. Aadressi, millele vastus ei toetu, ei nimetata; aadressi, mida ei anna ei `web_address` ega tõenditekst, ei kirjutata.
3. **Mull teeb aadressi lingiks.** Tekstis olev aadress muutub lingiks ainult siis, kui see on vastuse enda viidatud allika aadress. Link viib allika deklareeritud aadressile: mudel kirjutab sõnad, sihtkoha annab server. Sobib ka kuju `https://…`, `www.…` ja lõpukaldkriipsuga; ainult saidi nimi viib lehele siis, kui sellelt saidilt on viidatud üks leht.
4. **Lingiks ei muutu:** e-posti aadress, sama saidi teine leht, teine sait, aadress, mida vastuse allikate hulgas ei ole. Need jäävad tekstiks.

Aadress ja sihtkoht on pöörde vaates iga allika juures (`web`, `webUrl`) ja lähevad ka pöörde püsikirjesse (ADR-094), nii et kirjest näidatud vana pööre lingib samamoodi.

## Mida see ei tee

- Õigusaktide, PDF-ide ja omavalitsuse kirjete aadresse vastuse tekstis ei nimetata; nende link on endiselt allika vaates. Vormid antakse lingina vastuse all nagu seni.
- Müügipunktide lehed (allika liik `registry`) aadressi ei saa: nende „leht“ on kogu ameti kaardirakendus, mitte punkti oma leht.
- Server ei lükka vastust tagasi, kui mudel kirjutab aadressi, mida allikates ei ole. Selline aadress jääb tavaliseks tekstiks. Kui tihti seda juhtub, näitab mõõtmine.

## Kontroll

`tests/rag-v2-web-address.test.mjs` (4 testi): aadressi kuju ja millistel allikatel see on; mudel näeb aadressi, mitte sihtkohta; pöörde vaade, püsikirje ja vestluse allikaloend kannavad mõlemat; sihtkoht, mis ei ole deklareeritud `https`-aadress, linki ei anna; mulli tükeldaja teeb lingi ainult oma allika aadressist (e-post, teine leht, teine sait ja kahe lehega sait jäävad tekstiks).

Juhise test: versioon 28; varasem versioon on loetav; juhise ülejäänud tekst on bait-baidilt endine.

Kogu ühiktestide komplekt: 777 testi, 758 läbis, 19 vahele jäetud, 0 ebaõnnestus. Andmebaasitestid: 82/82.

## Kontrollimata

- Brauseris enne juurutust ei proovitud; mull kontrollitakse päris lehel kohe pärast juurutust.
- Kas Luna nimetab aadressi parajal määral (mitte igas vastuses, mitte kunagi valesti), näitab mõõtmine päris lehel.
