# ADR-105: teema mahutab terve juhtumi (30 sõnumit)

Kuupäev: 08.10.2026. Seis: kood tehtud; kontrollitud ühiktestide, kohaliku andmebaasitesti ja serveris kahe testvestluse läbimänguga (mudelit kutsumata). Mudeliga pärast muudatust mõõtmata.

## Mõõtmine: kaks 30 pöördega vestlust päris lehel (07.–08.10.2026)

Omanik: „Mõtle välja 2 stsenaariumi, üks abivajaja juhtum, teine sotsiaaltöötaja enda arupärimine. Mõlemal võiks olla 30 pööret … alguses jälgid, et teema püsiks sama 20 pöördega ja siis too sisse teine teema, mida arutled 10 pööret. … Testi mõte on näha, kas päris elus platvorm toimib teemaga, mida ei ole testitud, samuti lugeda tokeni kulu ja näha, kuidas toimib ajalugu ja päris juhtumi lahendus.“

- **A, roll Pöörduja:** lapsevanema tee (4-aastane ei räägi → kelle poole pöörduda → diagnoosini jõudmine → mis on autism → puude raskusaste, rehabilitatsioon, tugiisik, vanema tugi), siis teine teema (ema insult, hooldekodu, kes maksab).
- **B, roll Sotsiaaltöö spetsialist:** naabri teade segaduses mehest → kodukülastus → abivajaduse hindamine → rahaline ärakasutamine → eestkoste → pärast kohtumäärust, siis teine teema (lapse andmete jagamine kooli, perearsti, politsei ja võrgustikuga).

| | A | B |
|---|---|---|
| Vastatud pöördeid | 30/30 | 30/30 |
| Sisend- / väljundtokeneid | 1 250 753 / 27 324 | 1 049 497 / 29 349 |
| Pöörde kohta | 41 700 / 910 | 35 000 / 980 |
| Hinnanguline kulu (plaanihinnad) | 0,1703 USD | 0,1461 USD |
| Pöörde kohta | 0,0057 USD | 0,0049 USD |
| Aeg pöörde kohta | 10,0–18,9 s, mediaan 13,7 | 9,8–18,2 s, mediaan 14,0 |

Katkestatud esimene katse (6 pööret) 0,0335 USD; kokku 0,35 USD (nimetatud lagi 0,45).

**Tokenid ei kasva vestluse pikkusega.** Esimene pööre 0,0046 (A) ja 0,0038 (B), kolmekümnes 0,0055 ja 0,0046 USD. Vestluse osa vastuse sisendis kasvas 300 tokenilt umbes 2 000–2 500-ni ja jäi sinna, sest teema mahutas 8 sõnumit. Pöörde hinna määravad allikalõigud: omavalitsuse kirjetega pöördes on vastuse sisend 22–27 tuhat tokenit, ilma 11–16 tuhat.

**Ajalugu.** Mõlemad vestlused lõigati viieks teemaks (sõnumid 1–8, edasi iga 6 uue sõnumi järel; uus teema algab kahe kaasa võetud pöördega, ADR-070). Üle lõike läksid kasutaja laused, mille vestluse mälu oli tsiteerinud, viimane sõnum, viimane vastus ja mälu ise. A-s püsisid lapse vanus, tunnused, diagnoos ja elukoht (Jüri → Rae vald) ning 20. pöörde kokkuvõte oli õige. B-s ei olnud mälu kirja pannud lauseid „Käisin kohal“ ja „Ta ütleb, et saab ise hakkama ja abi ei taha“; pärast esimest lõiget neid enam ei olnud ja 20. pöörde kokkuvõte vastas, et kasutaja ei ole valla samme veel kirjeldanud.

**„Ei saa öelda“ ja küsimused.** 60 vastusest 34-s oli piirang („ma ei saa … öelda“), 14-s küsis assistent ise. 34 piirangu lugemine (üks hindaja): aus piir (diagnoos, kohtu otsus, valla hinnang) 12; materjali ei leitud või ei ole 8; küsis õigesti 4; kordas sõna-sõnalt vastamata jäänud küsimust 4; tarbetu küsimus või kahtlus selles, mis oli juba öeldud, 3; oleks pidanud küsima, aga ütles „ei saa öelda“ 2; ajalugu oli kadunud 1.

**Mitu pööret on juhtum.** Üks mure jõudis kasutatava vastuseni 3–5 pöördega (konkreetne küsimus 1 pöördega), terve juhtum oma etappidega 15–20 pöördega, teine teema samas vestluses veel 5–10. Serveris oli 08.10 seisuga 150 vestlust (peaaegu kõik proovid): 136 ühe sõnumiga, 145 kuni kolmega, üle kaheksa ainult need kaks.

## Probleem

Teema mahutas 8 kasutaja sõnumit (`DIALOGUE_LIMITS.scopeTurns`). Juhtum on 15–20 sõnumit, seega lõigati iga juhtum vähemalt kaks korda, ja lõikes läks kaduma see, mida mälu ei olnud kirja pannud. Omanik: „see 9 pööret ajalugu hirmutas mind ära. Tuleks arvutada, mitu pööret üks juhtum on, siis panna igaks juhuks ajalugu pikemalt.“

## Otsus

**1. Teema mahutab 30 sõnumit.** Omanik valis arvu ise („pane 30 pööret, nii säästlikum“; minu esimene pakkumine oli 40). Piir on üks arv, `SCOPE_TURN_LIMIT` (`lib/rag-v2/pilot/contracts.js`); seni oli 8 kirjutatud kuude kohta eraldi: teema piir, mälu kahe versiooni tsitaadi pöördenumber, otsinguplaani koha pöördenumber, kohalugeja ja otsinguplaani sisendi kontroll.

**2. Teema saab täis ka teksti järgi** (`scopeTokens: 3000`, teema kasutaja sõnumite tekst koos uue sõnumiga). 30 sõnumiga jõuab pikkade sõnumite tekst otsingu- ja vestluse eelarveni enne kui sõnumite arv. Seni lõppes see veateatega „Teema konteksti maht on täis … alusta uut teemat“, aga vestluses ei ole kohta, kust uut teemat alustada. Nüüd läheb teksti poolest täis teema edasi uues teemas samamoodi nagu arvu poolest täis teema (ADR-070 üleandmine). 3000 jätab vestluse eelarvesse (9000) ruumi 30 pöörde väljadele, ühele vastusele ja mälule.

**3. Vestlus mahutab 90 sõnumit** (`conversationTurns`, seni 64). 64 oli kaheksa kaheksasõnumilist teemat; 30-sõnumiliste teemadega oleks vestlus lõppenud kolmanda teema alguses. 90 on kolm täis teemat. Üle selle keeldub teenus nagu enne oma teatega („See vestlus on jõudnud küsimuste ülempiirini …“).

Juhiste tekst ei muutu, seega vestluse ja otsinguplaani versioon jäävad samaks (`m4-grounded-dialogue-33`, `rag-v2/search-assist-9`). Iga pöörde kirje hoiab piire, millega pööre vastu võeti (`contextAudit.limits`).

## Mida see maksab

- **Tokenid:** läbimängus oli 30. sõnumi juures kasutaja pöörete osa 1 665–1 717 tokenit (kaheksasõnumilises teemas umbes 750). See läheb kolme kutsesse (otsinguplaan, lõikude valik, vastus), seega 30. pöördes umbes 2 700–2 900 sisendtokenit rohkem ehk umbes 0,0003 USD (5%); vestluse keskmisena pool sellest. Lühike vestlus ei maksa midagi juurde.
- **Ketas (hinnang, mõõtmata):** pöörde püsikirje hoiab teema kasutaja pöördeid sellisena, nagu pööre vastu võeti. 30-sõnumilises teemas on see 465 sõnumikoopiat, kaheksasõnumiliste teemadega oli sama vestluse kohta umbes 170. Vahe on umbes 45 KB 30-sõnumilise vestluse kohta; kuni kolme sõnumiga vestluses vahet ei ole.

## Kontrollitud

- Ühiktestid: 809, neist 787 läbi ja 22 vahele jäetud. Uus test: tekstilt täis teema läheb edasi uues teemas, midagi ei keelduta ja iga vastu võetud teema jääb otsingu eelarvesse.
- Kohalik andmebaasitest (`rag-v2-dialogue-store`, `rag-v2-pilot-store`): 82/82. Kaks testi täidavad 30-sõnumilise teema päris andmebaasi ja teenuse kaudu (mudeli asemel kindel vastus): viimase sõnumi fakt ankurdatakse pöördesse 30, järgmine sõnum alustab uut teemat ja saab kaasa faktid, viimase sõnumi ja viimase vastuse.
- Serveris, tasuta (mudelit ja otsingut kutsumata): mõlema testvestluse 30 sõnumit mängiti läbi ühe teemana, serveri enda sõnavormide lugeja ja omavalitsuste loendiga ning pöörete kirjetes olevate otsinguplaanidega. Mõlemas andis kohalugeja 30 pöördes 30-s sama omavalitsuse mis päris jooksus (Rae vald alates 4. sõnumist, Saaremaa vald alates 22.; Põlva vald samades kolmes pöördes). Läbimäng tehti piiriga 40; piiriga 30 mahub sama 30 sõnumit ühte teemasse.

## Kontrollimata

- Vastuste sisu pärast muudatust: kas 20. pöörde kokkuvõte on nüüd täielik ja kas pikk ajalugu ei vii otsinguplaani varasemate teemade juurde, kui kasutaja alustab samas teemas uut muret. Selleks on vaja mudeliga jooksu (kaks stsenaariumi uuesti umbes 0,32 USD); see ootab omaniku sõna.
- Ketta hinnang on arvutus, mitte mõõtmine.

## Tagajärjed

- Kontrollkataloogid `scenarios-two-people-boundary-1.json` (9 sõnumit) ja `scenarios-long-topic-1.json` (11 sõnumit) ei ületa enam teema piiri: nad mõõdavad nüüd tavalist pikemat teemat. Üleandmist ennast katavad ühik- ja andmebaasitestid; mudeliga piiriületust mõõdaks 31 sõnumiga stsenaarium.
- Assistendi varasemaid vastuseid peale viimase mudel endiselt ei näe (varasem vastus ei ole allikas). Kokkuvõte „mis on tehtud“ saab toetuda kasutaja sõnumitele, mitte sellele, mida assistent varem soovitas.

## Testis leitud vead, mis on veel parandamata

1. Assistent paneb küsimuse mällu lahtiseks, aga ei küsi seda, vaid kirjutab piiranguks („ei saa öelda, kas pojale on puue määratud“).
2. Vastamata jäänud küsimust kordab ta järgmistes vastustes sõna-sõnalt (kolm korda järjest „Kas mees on praegu vahetus ohus või vajab kohe abi?“).
3. Ta küsib või kahtleb selles, mis on juba öeldud, ja lisab üldisele küsimusele piirangu kasutaja enda juhtumi kohta.
4. Roll ei jõua mudelini: spetsialistile öeldi „võta ühendust valla sotsiaaltööspetsialistiga“ ja „lapse elukohajärgne omavalitsus ei ole teada“; valla, kus ta töötab, korda kasutati 30 pöördest kolmes.
5. Kui kasutaja alustab murega, mitte küsimusega, jõuab vastuseni väga vähe lõike (insuldi esimene vastus sai ühe lõigu, kuigi korpuses on 27 lehte insuldi kohta).
6. Kolm vastust järjest algasid lausega, et Jüri kuulub Rae valda; kui jutt oli läinud Saaremaale, ei osanud vastus enam öelda, et Jüri on Rae vallas.
7. Vastus ütles „siin pole juhendite veebiaadresse“: PDF-juhenditel ei ole mudeli jaoks aadressi.
8. Esimesel katsel jäi üks sõnum pärast Enterit saatmata (nähtud ühe korra, põhjus uurimata).
