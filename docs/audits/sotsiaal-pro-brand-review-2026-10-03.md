# Sotsiaal.pro nimeuuenduse audit — 03.10.2026

Ulatus: nimeuuendus `94665855` ja prompti räside parandus `ce6de75b`.
Kontrollitud HEAD: `ce6de75bfb05bba24dc5281078a3cbae0a14b1ec`.
Vahepealse merge'i sõltumatu RAG-muudatus #332 ei kuulu sellesse auditisse.
Tootekoodi ei muudetud; olemasolev pooleliolev töö säilitati.

## Kinnitatud leid

### P2 — raamlepingu tegelik sisu jäi nimeuuendusest välja

Muudetud `components/alalehed/TooalaseRaamistikuBody.jsx:34–38` kasutab
sissejuhatuses uut nime, kuid sama vaate täistekst tuleb endiselt
`lib/frameworkDocument.js:5–12` loetavatest `docs/legal` TXT/HTML-failidest.
Komponent kuvab HTML-i otse (`TooalaseRaamistikuBody.jsx:545–546`).

Tõend:

- `loadFrameworkDocument('et')`: pealkiri „SotsiaalAI tööalase kasutamise ja
  isikuandmete töötlemise raamleping”; HTML-is 70 vana brändinime ja 30
  „SotsiaalAI OÜ” mainimist.
- EN: 69 vana brändinime ja 30 vana ettevõttenime; RU: 70 ja 30.
- Avaliku tootmislehe `https://sotsiaal.pro/tooalase-kasutuse-raamistik`
  GET tagastas 200. Pärast script/style-elementide ning HTML-märgistuse
  eemaldamist jäi vastusesse 70 „SotsiaalAI” mainimist. See pole ainult
  Reacti serialiseeritud andmete otsingutulemus.
- `lib/frameworkAcceptances.js:14–19` suunab endiselt eraldi DOCX/ASiC-E
  dokumentidele. Nende sisu ega digitaalallkirju selles auditis ei valideeritud.

Mõju: kasutaja näeb samal lehel uut sissejuhatust ja vana nimega lepingut;
üleplatvormiline nimeuuendus pole täielik. Ettevõttenime vastuolu oli olemas
juba enne auditeeritud commit'i; see ei tekkinud sellest asendusest.

Paranduse suund: ajakohastada raamlepingu veebiversioon ja allalaaditava
dokumendi uus versioon kooskõlaliselt, eristades brändi Sotsiaal.pro ning
ettevõtet Küberloome OÜ. Varasemaid allkirjastatud dokumente ja kinnitusi
säilitada ajaloolise tõendina; ASiC-E faili ei tohi tekstiasendusega muuta.
Siin ei hinnata lepingu õiguslikku kehtivust.

## Läbitud kontrollid ja teadlikud piirid

- ET/EN/RU muudetud sõnesid vastavalt 143/144/145. Võrdlus vanemcommit'iga
  ei leidnud võtmete, interpolatsioonitunnuste ega HTML/rich-text märgendite
  erinevusi. Nimeasendusevälised tekstimuudatused vaadati üle.
- JS/JSX muudatused on valdavalt brändisõne asendused. Eraldi kontrolliti
  metaandmeid, ekspordi failinime, ikoonigeneraatorit ja manifesti.
- Manifesti nimi/lühinimi on Sotsiaal.pro; uutel paigaldusikoonidel ja
  manifestiviitel on uus versioon. Jagamispilt vaadati visuaalselt üle:
  sellel on „Sotsiaal”, mitte „SotsiaalAI”. Vana failinimi ise pole viga.
- Mõlema auditeeritud commit'i diff-check ning tööpuu diff-check läbisid.
- GitHubist kontrollitud: [quality-gate](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37146653973)
  ja [deploy](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37146895056)
  on lõpetatud edukalt täpselt `ce6de75b` jaoks. Sama muutumatu koodi kogu
  testi- ja buildikomplekti kohapeal uuesti ei käivitatud.
- Vanad küpsise-, localStorage-, sündmuse- ja skeemitunnused on teadlikult
  säilitatud. Nende automaatne ümbernimetamine põhjustaks ühilduvusriski.
- Täislogo ja logoekspordi kujunduse valik on varasemalt eraldi tööks jäetud;
  seda ei loeta uueks regressiooniks.
- `useConversationSources.js:48–65` sisaldab vana nimega identiteediheuristikat.
  Uue nimega vastus ei sobitu vana täpse sõnega, kuid auditis ei tõendatud
  päris vastuserada, mis lisaks selle tõttu valed allikad. NOT_PROVEN;
  ei ole kinnitatud funktsionaalne leid.
- Prompti sisu muutus brändinime võrra, versioonitähis jäi samaks.
  Võrdluskatsete täpseks eristamiseks tuleb kasutada commit'i või räsi;
  vastuste kvaliteediregressiooni ei tuvastatud ega tasulise mudelijooksuga
  hinnatud.
- Päris e-kirjade saatmist, makseid, juba paigaldatud rakenduse nimevahetust
  ning autentitud töövoogude täielikku läbimist ei tehtud (NOT_PROVEN).

Järeldus: üks kinnitatud P2 nimeuuenduse katvuse puudus. Kinnitatud uut
käitumisregressiooni kontrollitud ulatuses ei leitud.

## Parandus 03.10.2026

- Lisatud ET/EN/RU veebitekstid ja DOCX-id versiooniga `2026-10-03` ning
  suunatud aktiivne laadija/allalaadimine neile. Bränd on Sotsiaal.pro,
  ettevõte Küberloome OÜ. Varasemad failid säilivad muutmata.
- Uued kinnitused kasutavad uut versiooni; vana kinnitust ei loeta uueks.
  Brauseri tutvumise ja kinnituse võtmed on samuti versioonitud.
- Vana ASiC-E fail säilib ning link ja selgitus märgivad selle varasemaks
  versiooniks. Uue versiooni digiallkirja ei ole loodud.
- ESLint, i18n ja diff-check läbisid; neli sihttesti läbivad.
  Kohaliku serveri leht tagastas 200, sisaldas uut DOCX-viidet ja ajaloolise
  DigiDoci selgitust ning ei sisaldanud vana nime väljaspool skripte.
- Kõigi DOCX-ide ZIP-kirjete võrdlus kinnitas, et muutus ainult brändi- ja
  ettevõttenimi; muu sisu ning vormindus säilis. LibreOffice-renderdaja puudus;
  kasutati kohalikku Wordi PDF-eksporti ja pdf2image'i. Vaadati üle kõigi
  15/12/13 lehekülje eelvaated; nähtavaid kattumisi ega lõikumisi ei leitud.
- Andmebaasi ajaloolisi kinnitusi ei muudetud. Päris kasutaja uut kinnitust
  ega digitaalallkirja kehtivust ei testitud.
