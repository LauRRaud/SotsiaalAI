# `AMET-TEEJUHT-V1` — Ametialase teejuhi arendusleping

Versioon: 1.0 · 28.08.2026
Lepingu liik: allikapõhine kutse-, pädevus- ja suunamisteabe vertikaal
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 „Ametialane teejuht ja Eetilise
juhtumiarutelu ruum"
Tõendipiir lepingu koostamisel: toote- ja allikaleping; kood ning aktiivse RAG-i katvus
kontrollimata; `runtime: not_run`

## 1. Lähtekoht ja kasutajalubadus

Lepingu lähtekoht on omaniku 28.08.2026 jagatud avalik arutelu, kus küsiti eri
sotsiaalvaldkonna ametite kvalifikatsiooni, traumateadlikkuse, lähisuhtevägivalla,
lapsega suhtlemise, eetikakoodeksi ning päriselt abi saamise kohta. Arutelu näitas, et
kasutaja küsimus võib olla väga täpne, kuid vastaja ei pea teadma kõigi ametite nõudeid
ega tohi oletust ametliku vastusena esitada.

**Kasutajalubadus:** inimene saab valida ameti või vaatenurga, küsida selle ameti nõuete,
pädevuspiiri või abi saamise kohta ning näha ühes vastuses, mis on ametlik nõue, mis on
soovitus või hea tava, mida avalikust allikast ei selgu ja kellelt saab siduva vastuse.

## 2. V1 kasutajatee

1. Kasutaja valib vaate „Küsi ametist" või esitab küsimuse tavalises vestluses.
2. Ta valib või süsteem pakub kinnitamiseks ameti/vaatenurga ja teema. Amet ei muuda konto
   ligipääsurolli.
3. Süsteem otsib ainult selle ameti, teema, Eesti õigusruumi ja kehtivusaja järgi sobivaid
   kontrollitud allikaid.
4. Vastus jaguneb alati kuueks osaks:
   **lühivastus · ametlik nõue · soovitus/hea tava · mida allikatest ei selgu · kellelt
   saab siduva vastuse · allikad ja viimase kontrolli aeg**.
5. Kasutaja saab avada vastust toetava algallika, teatada aegunud või sobimatust allikast
   ning vajadusel koostada küsimuse pädevale asutusele või spetsialistile.

Esimese katvuse ametid on vähemalt perelepitaja, kogemusnõustaja, sotsiaaltöötaja,
ohvriabitöötaja, võlanõustaja ja isiklik abistaja. Vaatena võivad lisanduda teenuse kasutaja,
lähedane, hooldaja, tööandja ja õppija, kuid need ei ole kutsetunnistused.

## 3. Vastuse- ja tõendileping

- Õigusakt, kutsestandard, ametlik juhend, õppekava ja teenuseosutaja praktika on eri
  autoriteetsustasemega ning neid ei esitata ühetaolise „nõudena".
- Tundide arv, koolitaja, metoodika, kvalifikatsioon või kehtivus kuvatakse ainult siis,
  kui vastust toetav kehtiv allikas selle ütleb.
- „Avalikust allikast ei leidnud" ja „allikad on vastuolus" on lubatud ning vajalikud
  vastused. Mudeli üldteadmine ei täida tõendilünka.
- Vastuses kuvatakse eraldi allika väljaandja, versioon, kehtivus ja kontrolliaeg.
- Siduv vastus seotakse pädeva asutuse või kutseandja ametliku kanaliga; SotsiaalAI ei
  anna ise kvalifikatsiooni ega tunnusta pädevust.
- Otsingu leid, vastuse valitud kontekst, vastuse väide, kuvatud allikas ja avatud
  algallikas on viis eri tõendiväravat.

Kui küsimus on mitmeti mõistetav, küsib süsteem enne vastamist ühe sisulise täpsustuse,
näiteks kas kasutaja küsib seadusest tulenevat miinimumnõuet või soovituslikku täiendõpet.
Ta ei peida ebakindlust pika üldise teksti sisse.

## 4. Allikapaketid ja metaandmed

V1 auditeerib aktiivse RAG-registri ja originaalid vähemalt järgmiste allikaperede kaupa:

- sotsiaalvaldkonna töötaja eetikakoodeks ja rahvusvahelised eetikapõhimõtted;
- kehtivad kutsestandardid, kvalifikatsiooninõuded ja nende versioonid;
- kutseandjate, riigiasutuste ja tunnustatud koolitajate ametlik väljaõppeinfo;
- traumateadliku töö, lähisuhtevägivalla, lapse osalemise ja lapsega professionaalse
  suhtlemise juhised;
- supervisiooni, kovisiooni, eetikakonsultatsiooni ja abi saamise ametlikud kanalid;
- teenuse kasutaja õigused, kaebe- ja vaidlustamisvõimalused ning kiire abi kanalid.

Iga allikakirje minimaalne meta on:

- `professionTags[]`, `topicTags[]`, `audience[]` ja `jurisdiction`;
- `authorityLevel` (`law`, `regulation`, `professionalStandard`, `officialGuidance`,
  `curriculum`, `practiceMaterial`);
- `publisher`, `version`, `validFrom`, `validUntil`, `verifiedAt` ja `reviewOwner`;
- stabiilne allika ID, algallika URL või faili päritolu, content hash ja ülevaatuse seis;
- asendava või aegunud dokumendi seos, kui versiooniahel on olemas.

Ametimärgend parandab otsingut ja vastuse selgitust, mitte ligipääsuõigust. Sama inimene
võib kanda mitut ametit ning ametit ei tuletata vestluse sisust püsivaks profiilifaktiks ilma
kasutaja kinnitamiseta.

## 5. Kõrge riskiga piir

- Lapse, trauma või vägivalla küsimus ei anna väljaõppeta kasutajale iseseisvat küsitlemis-,
  hindamis- ega riskiprotokolli.
- Vastus nimetab pädevuspiiri, tegevuse peatamise või edasisuunamise koha ning kiire ohu
  korral ametliku abikanali.
- SotsiaalAI ei diagnoosi traumat, ei määra lähisuhtevägivalla olemasolu ega otsusta lapse
  parimat huvi.
- Ei looda töötaja eetilisuse, sobivuse, pädevuse ega organisatsiooni kvaliteedi skoori.
- Ei tehta automaatset kvalifikatsiooni tunnustamist ega otsust, kas konkreetne inimene
  tohib ametis töötada.

## 6. Sobivus olemasoleva platvormiga

**Taaskasutatav:** RAG-vestlus, allikapaneel, allikatagasiside, Materjalide esitamise ja
ülevaatuse rada, keelevalik ning olemasolev auditooriumi meta. Ametialane teejuht ei vaja
eraldi teadmiste andmebaasi, kui aktiivne register saab kontrollitud ameti-, teema-,
autoriteetsus- ja kehtivusmeta.

**Puudu:** ametite ja teemade kontrollitud sõnastik, allikapakettide katvusaudit, kehtivuse
omanik, kuueosalise vastuse leping, kõrge riskiga küsimuse pädevuspiir ning kasutajale nähtav
„teadmata / siduva vastuse kanal".

## 7. Teostusetapid

### E0 — aktiivse teadmuskihi lünkade audit

- Võrdle read-only režiimis aktiivset registrit, originaale ja master-listi; ära loe
  kõrvalkaustas olevat faili automaatselt aktiivseks RAG-allikaks.
- Kaardista kuue esimese ameti ja omaniku jagatud küsimuste katvus, versioonid, duplikaadid,
  aegunud allikad, õigused ning värskuse omanikud.
- Märgi iga küsimus `covered`, `partial`, `conflicting` või `not_found` koos tõendiga.

### E1 — taksonoomia ja kanoonilised allikapaketid

- Kinnita ameti-, teema- ja autoriteetsustaseme sõnastikud koos `unknown` väärtusega.
- Vali iga nõude jaoks kanooniline kehtiv allikas ning säilita versiooniahel.
- Partneri või toimetaja kinnitamata praktikamaterjal ei muutu ametlikuks nõudeks.

### E2 — allikapõhine vastuseleping

- Lisa kuueosalise vastuse koostamise leping ja fail-closed käitumine tõendilünga korral.
- Säilita planner'ist kuni kuvatud vastuseni amet, teema, autoriteetsustase ja kehtivusaeg.
- Vastuolu korral kuva mõlemad allikad, erinevuse laad ja pädeva kinnitaja kanal.

### E3 — ligipääsetav ET/EN/RU kasutajavaade

- Ehita „Küsi ametist" kui vestluse juhitud sisend, mitte uut rollihaldust.
- Kuva vastuse kategooriad semantilise teksti ja pealkirjadega; värv ei ole ainus kandja.
- Allikad, kontrolliaeg, teadmata osa ja abi-/vaidlustuskanal töötavad ka mobiilis,
  klaviatuuriga ning ekraanilugejaga.

### E4 — värskus, tagasiside ja uue materjali rada

- Aeguv või asendatud allikas läheb ülevaatuse ootele ega jää vaikimisi kehtivaks.
- Kasutaja allikatagasiside loob toimetatava signaali, mitte automaatse sisumuudatuse.
- Puuduva ametliku materjali saab esitada olemasoleva Materjalide ülevaatuse kaudu;
  aktiivseks muutmine vajab inimese kinnitust.

## 8. Vastuvõtukriteeriumid ja DoD

V1 on valmis, kui vähemalt kuue ameti kanoonilised allikapaketid on aktiivses RAG-is,
versioonitud ja värskuse omanikuga ning omaniku jagatud arutelu põhiküsimused annavad
ametliku nõude, soovituse, teadmata osa ja siduva vastuse kanali õigesse kategooriasse.

Iga ameti puhul kontrollitakse käsitsi vähemalt kahte sõnastust. Tõendatakse eraldi otsing,
valitud kontekst, vastus, kuvatud allikad ja avatud algallikas; ühe värava läbimine ei tõenda
teisi. Kõrge riskiga negatiivrada peab peatama sobimatu protokollinõu ja suunama õigesse
inimkanalisse. Kontrollimata rada jääb `NOT_PROVEN`.

Automatiseeritud testi-, contract-, probe-, smoke- ega E2E-kihti ei looda ega käivitata.
Koodimuudatuse plokk järgib `SotsiaalAI.md` S11 väikest väravat ja peatüki lõpu build'i.

## 9. Aktiveerimisväravad

- O-AT-1: kuue V1 ameti ja teemade kinnitatud sõnastik.
- O-AT-2: milline pädev asutus või kutseandja on iga siduva küsimuse adressaat.
- P-AT-1: allikapakettide toimetaja ja värskuse omanik.
- O-AT-3: lapse, trauma ja vägivalla küsimuste täpne peatamis- ning suunamistekst.
- Lai ametite ring lisatakse alles pärast esimese kuue ameti käsitsi tõendatud vertikaali.
