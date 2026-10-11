# ADR-128: palve, mis ei ole küsimus, küsib selle omavalitsuse kohta, mida ta nimetab

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (kavandas, ehitas ja vaatas üle viis agenti kahes ringis; serveri mõõtmised ja kontroll minult). Omanik 10.10.2026: „need on vist üsna olulised asjad?“. Seis: **kood ja testid tehtud; mõõdetud tasuta serveris päris keeleanalüüsiga; mudeliga mõõtmata.**

## Probleem

[ADR-074](adr-074-question-region-not-residence.md): omavalitsus, mille kohta küsimus küsib, on pöörde otsingupiirkond, mitte inimese elukoht. Server luges küsimuseks ainult lauseosa, kus nime ees seisab küsisõna või palve assistendile („kas“, „kuidas“, „räägi“), või ühe lauseosaga lause, mis lõpeb küsimärgiga. Palve ilma küsisõnata, „Soovin infot Maardu isikliku abistaja teenuse kohta.“, jäi elukoha valda. ADR-074 hoidis seda piirina.

## Otsus

Nime ees samas lauseosas seisev **soov koos sellega, mida soovitakse**, on küsimine (`requestedAt`, `lib/rag-v2/pilot/record-scope.js`): „soovin / sooviksin / tahan / tahaksin / vajan / mul on vaja / palun / otsin“ ja selle järel „infot / teavet / teada / ülevaadet / lisainfot“, või „mind huvitab“. Inglise ja vene keeles samamoodi. Loendid on suletud (kuus loendit, 120 sõna) ja iga sõna hoiab test.

Teine tingimus ei muutu: otsinguplaani päringud peavad sama omavalitsust nimetama. Server ei otsusta üksi.

Mis ei ole palve:

- teade („Sain infot Maardu linnavalitsusest, et teenust ei pakuta“), töökoht („Töötan Maardus“), teise inimese soov („Ema soovib elada Tartus“), kolimine („Soovin kolida Maardusse“);
- eitus vahetult soovi ees („ei soovi“, „pole vaja“);
- palve ja nime vahel on reavahetus või mõttekriips: siis on need kaks eri asja.

## Mõõdetud (tasuta, serveris, päris keeleanalüüs)

Samad 75 lauset vana ja uue koodiga: 14 palvelauset loetakse nüüd küsimuseks (eesti, inglise ja vene keeles), teated ja töökoha laused jäid nagu enne.

## Piirid, mida testid hoiavad piirina

- Ainult nimisõnafraas („Maardu isikliku abistaja teenus“) ei ole palve: keeleanalüüs sõnaliiki ei anna ja reegel ilma valehäireta puudub.
- Nimi enne palvet („Maardu koduteenus huvitab mind“) jääb lugemata.
- Kokku kirjutatud lause sidesõnaga „ja“, kõrvalmärkus sulgudes ja kaudne kõne loetakse palveks; neid hoiab ainult plaani päringute tingimus.
- Esimeses isikus lause („Ma soovin infot …“) vajab nagu ADR-074 järgi otsinguplaani seostust.

## Kontrollimata

- Kas päris otsinguplaan nimetab palve puhul küsitud omavalitsust oma päringutes (vajab tasulisi pöördeid).
