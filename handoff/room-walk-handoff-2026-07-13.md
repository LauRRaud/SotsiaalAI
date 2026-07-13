# Handoff: SotsiaalAI avalehe ruumikõnd ja uus pildiseeria

Kuupäev: 2026-07-13  
Töökaust: `C:\Users\rauds\Desktop\SotsiaalAI`

## Ülesande eesmärk

Avalehe laadimisloori järel juhib kerimine esimese isiku kaamerat läbi sama premium-klassi elutoa: ukseavast otse laua ja tugitooli vahele, seejärel paremale seinamaali poole ning lõpuks veidi madalamale ja kaugemale nagu tugitooli istudes. Kogu seeria peab olema üks füüsiliselt järjepidev ruum, mitte 12 eraldi tõlgendust.

## Kõige tähtsam järgmise akna alguses

1. Kasutaja uus alguspilt, kus ta on püsielemente veidi muutnud, on failis:
   `C:\Users\rauds\Desktop\SotsiaalAI\public\room\ruumi pildid\ruumi referents algus.png`
2. Ära genereeri kohe tervet seeriat. Kinnita esmalt uus alguskaader ja sellele vastav uus lõppkaader.
3. Kui alguspildi püsielemendid muutusid, peab ka lõppkaader neid muudatusi kandma. Lõppkaadri heakskiidetud kaamera ja kompositsioon tuleb säilitada, muutes ainult ruumi püsielemente.
4. Kasutaja kinnitas faili nime: `ruumi referents algus.png`. Lähtu sellest kui uuest alguse ruumireferentsist.

## Praegune rakenduse seis

- `lib/room-frames.js` sisaldab endiselt 12 loogilist kaadrit.
- Loogilised kaadrid 11–12 jagavad sama lukustatud lõppallikat.
- Manifest viitab failidele `/room/frame-1.webp` … `/room/frame-10.webp` ja `/room/frame-12.webp`.
- `public/room` WebP-kaadrid on praegu kustutatud/puuduvad. Neid ei tohi käsitleda toimiva aktiivse seeriana; lõpliku uue valiku järel tuleb need uuesti genereerida.
- Praegu on `public/room` all ainult alamkaust `ruumi pildid` ja seal ülal nimetatud PNG.
- `components/room/RoomStage.jsx` on varasemast muudetud 12 kaadri jaoks:
  - kaadripildi fookusblur eemaldatud;
  - tekstide fade-blur eemaldatud;
  - ristsulandus lühendatud;
  - kõik kaadrid laetakse ette;
  - lõpus on kaks stabiilset loogilist kaadrit.
- `app/styles/room.css` kasutab endiselt kaadripildil `object-fit: cover`. Kasutaja märkas õigesti, et laias brauseriaknas lõigatakse pildi üla- ja alaserv ära. See parandus on veel tegemata.
- Enne hilisemaid kasutajapoolseid failikustutusi läbisid lint ja `npm run build`. Pärast lõplike piltide ühendamist tuleb need uuesti käivitada.

## Aktiivne 12-kaadriline valik enne uut alguspilti

Algne v3 valik:

- v3 01 = vana v2 01
- v3 02 = vana v2 02
- v3 03 = vana v2 04
- v3 04 = vana v2 05
- v3 05 = vana v2 07
- v3 06 = vana v2 12
- v3 07 = vana v2 13
- v3 08 = vana v2 14
- v3 09 = vana v2 15
- v3 10 = vana v2 17
- v3 11 = vana v2 21
- v3 12 = vana v2 22

Eemaldatud olid vana rea kaadrid 3, 6, 8, 9, 10, 11, 16, 18, 19 ja 20.

Olulised kaustad:

- puhas v3 valik:  
  `C:\Users\rauds\Desktop\SotsiaalAI\output\imagegen\room-walk-final-selected-v3`
- kasutaja parandused ja tekstipaigutuse märked:  
  `C:\Users\rauds\Desktop\SotsiaalAI\output\imagegen\room-walk-final-selected-v3 – parandused`
- v3 kontaktleht:  
  `C:\Users\rauds\Desktop\SotsiaalAI\output\imagegen\room-walk-final-selected-v3\PILDIRIDA-FINAL-V3-12-KAADRIT.png`

## Kuidas kasutaja paranduste kausta tõlgendada

Parandatud pildid ei ole valmis lõppfailid. Kasutaja liigutas elemente ja värvis tühje alasid käsitsi, mistõttu on failides nähtavad lõikejooned, ristkülikukujulised plaastrid, ebaühtlane tekstuur ja pintslijäljed. Neid tuleb kasutada ainult kompositsiooni- ja paigutusjuhisena.

Tekstiga pildid on ainult HTML/CSS-teksti asukoha etalonid. Teksti ei tohi kunagi lõplikku ruumipilti sisse genereerida.

Failipõhised juhised:

- `frame-01.png`: alguse kompositsioonietalon.
- `frame-02-tekst ja alates siit kaadrist rohi ja loodus imelik.png`:
  - esimese teksti asukoha etalon;
  - alates sellest kaadrist oli rohi ja loodus kasutaja hinnangul vale.
- `frame-03-raamatud on imelikuks läinud ja jätkub.png`:
  - riiuli vasaku otsa esemed peavad jääma äratuntavateks raamatuteks ja väikeseks raamitud fotoks;
  - need ei tohi muutuda mustadeks vaasideks ega amorfseteks objektideks.
- `frame-04-tekst.png`: „Tere tulemast” teksti asukoha etalon, mitte pildisisene tekst.
- `frame-05-maali-liigutasin-enda-poole.png`:
  - kasutaja määratud maali paigutuse etalon;
  - kaadris toimub ainult väike kaamera edasisamm;
  - tugitool ei tohi pöörduda ega kuju muuta;
  - parempoolne seinamaal ja selle all olev pikk riiul peavad kaadri paremast servast loomulikult välja ulatuma;
  - maali ja riiulit ei tohi tervikuna kaadrisse mahutamiseks väiksemaks tõmmata.
- `frame-06-laud liigutatud ja maal.png`:
  - laua ja maali parandatud paigutuse etalon;
  - failis on käsitsi liigutamise tõttu suured nähtavad plaastrid, mida ei tohi lõppfaili kopeerida.
- `frame-06-tekst.png`: kolmanda tekstiploki asukoha etalon.
- `frame-07-parandatud ruumi nurk vasakul pool maali.png`:
  - maali vasakul asuva ruuminurga/geomeetria etalon;
  - käsitsi värvitud ala tuleb puhtalt taastada.
- `frame-08-toa nurga parandus maali kõrval.png`:
  - maali kõrval oleva toa nurga etalon;
  - nähtavad beežid plokid ja servad on vead, mitte disain.
- `frame-08-tekst.png`: neljanda tekstiploki asukoha etalon.
- `frame-09.png`: kasutaja parandatud puhas kompositsioonietalon.
- `frame-10.png`: viienda tekstiploki asukoha etalon; tekst ei kuulu pildile.
- `frame-11-zoom-out.png`: juhis, et kaamera peab lõpuks rohkem välja suumima; kiri `ZOOM OUT!` ei kuulu pildile.
- `frame-12-zoom-out.png`: sama zoom-out-juhis ning viimase teksti asukoha etalon; kumbki tekst ei kuulu pildile.

## Tekstide ligikaudne paigutus kasutaja etalonidel

Kasuta täpseks paigutuseks paranduste kausta pilte, mitte ainult allolevaid protsente.

- stop 1 / kaader 2: ülemine keskosa, umbes x 48%, y 34%.
- stop 2 / kaader 4: väiksem plokk ülal vasakul-keskosas, umbes x 37%, y 33%.
- stop 3 / kaader 6: lai plokk ülemises keskosas, umbes x 57%, y 38%.
- stop 4 / kaader 8: lai plokk keskosa kohal, umbes x 54%, y 37%.
- stop 5 / kaader 10: vasakpoolne keskosa, umbes x 36%, y 38%.
- stop 6 / kaader 12: keskosa, umbes x 50%, y 50%.

Praegune CSS asetab tekstid liiga üldistatult ühte keskossa; kasutaja märked tuleb eraldi stop-põhiselt rakendada.

## Lukustatud visuaalireeglid

Kõigis kaadrites peab olema sama füüsiline ruum:

- sama mööbel, arhitektuur, valgus, materjalid ja esemeidentiteet;
- kaamera liigub, esemed ise ei liigu;
- kohvilaud jääb punase diivani ette;
- punane diivan on sügav burgundia samet, mitte nahk;
- tugitool on sile tan/pruun nahk, mitte mustriline ega reljeefne;
- vaip on pehme ja peaaegu ühevärviline, mitte dekoratiivse kordusmustriga;
- riiul on naturaalne tume pähklipuit, mitte roomajanaha või nikerdatud mustriga;
- maal säilitab sama geomeetrilise kujunduse ja proportsioonid;
- diivanipadjal ei tohi olla valget täppi;
- riiuli vasakul pool on raamatud ja väike raamitud foto, paremal madal must kauss;
- mitte ühtegi teksti, noolt, juhist ega märget pildifaili sisse.

## Looduse absoluutne järjepidevus

See on kõige tähtsam tehniline nõue.

- Mets, järv ja kaldajoon ei tohi kaadrite vahel uuesti tekkida ega ümber kujuneda.
- Samaks peavad jääma päike, peegeldusrada, kaldajoone geograafia, samade puude siluetid ja pilliroogrupid.
- Muutuda tohib ainult kaamera vaatenurk, mõõtkava ja nähtav väljalõige.
- Mets peab olema realistlik Eesti segamets: erineva kõrgusega kuused, männid ja üksikud kased; mitte ühtlane puulatvade rivi.
- Kaldarohi peab olema ebakorrapärane ja loomulik, mitte kontuurse, helendava või korduva dekoratiivmustrina.

Ära genereeri igat täiskaadrit sõltumatult. Eelistatud töövoog:

1. kinnita üks uus alguskaader kui ruumi ja looduse master;
2. kinnita sellele vastav lõppkaader;
3. kasuta üht fikseeritud looduse taustaplaati või deterministlikku komposiitimist;
4. genereeri/paranda interjööri ainult seal, kus vaja;
5. valideeri iga kaader enne järgmise loomist.

## Kvaliteediprobleem

- Olemasolevad PNG-d on 1672 × 941.
- Varasem skript suurendas need Lanczos3 abil 2560 × 1441 WebP-deks, kuid see ei loonud päris QHD-detaili.
- Sisseehitatud pildigeneraatori kandidaadid tulid samuti 1672 × 941 mõõdus.
- Lihtsat pikslisuurendust ei tohi kasutajale nimetada QHD-kvaliteediks.
- Brauseri `cover`-lõikamine suurendas kvaliteediprobleemi, sest pilti suurendati ja üla-/alaserv lõigati ära.
- Kuvamise parandamisel eelista kogu kompositsiooni säilitavat lahendust (`contain` või muu aspect-safe lahendus) ja kujunda võimalikud külgservad teadlikult, mitte juhuslike mustade ribadena.

## Tagasilükatud katsed — ära ühenda rakendusse

### V4 kaust

`C:\Users\rauds\Desktop\SotsiaalAI\output\imagegen\room-walk-final-selected-v4-hd-clean`

See seeria lükati tagasi, sest igal eraldi genereeritud pildil muutus loodus. Kaadri 5 vead: tugitool pöördus ning maal ja riiul tõmbusid kaadrisse mahtumiseks kokku.

### Üksikud sisseehitatud generaatori kandidaadid

Kõik järgmised on ainult katsed, mitte kinnitatud varad:

- `C:\Users\rauds\.codex\generated_images\019f583d-e64a-74b3-8bb4-d2b422dddc8d\exec-cbd54cb6-65b3-4961-9091-165cb44ec39a.png`
  - kaader 2 looduse lukustamise katse; pole heaks kiidetud.
- `C:\Users\rauds\.codex\generated_images\019f583d-e64a-74b3-8bb4-d2b422dddc8d\exec-a5b01503-5be4-4360-8be2-151418846a9c.png`
  - uus alguse master-katse; kasutaja märkis rohu imelikuks.
- `C:\Users\rauds\.codex\generated_images\019f583d-e64a-74b3-8bb4-d2b422dddc8d\exec-f353502d-9355-4cb2-9e6a-a465c4dbf116.png`
  - rohu sihitud paranduse katse; pole heaks kiidetud ja paremale tekkis uus kivilaadne objekt.

Varem heaks kiidetud vana lõppkaader oli:

`C:\Users\rauds\.codex\generated_images\019f583d-e64a-74b3-8bb4-d2b422dddc8d\exec-2963427f-b080-4ce2-9ad1-e5cb26fb6818.png`

Kui uus alguspilt muudab püsielemente, tuleb see lõppkaader vastavalt uuendada. Säilita selle kaamera ja üldkompositsioon: suur maal otse ees, diivani ots vasakul ning laud osaliselt vasakus alumises osas; akent ega tugitooli lõppvaates näha ei ole.

## Soovitatud järgmised sammud uues aknas

1. Ava ja vaata kasutaja uus alguspilt.
2. Võrdle seda vana `frame-01.png` ja vana heaks kiidetud lõppkaadriga.
3. Kirjuta välja ainult püsielemendid, mis uuel pildil muutusid.
4. Loo üks uus puhas alguskaader ja näita kasutajale.
5. Pärast alguse kinnitamist loo kohe uus vastav lõppkaader ja näita kasutajale.
6. Alles pärast mõlema otsa kinnitamist koosta vahekaadrid ükshaaval.
7. Hoia looduse taust deterministlikult sama; ära lase pildimudelil metsa igas kaadris uuesti tõlgendada.
8. Tee lõplikud kaadrid ilma tekstita. Rakenda tekstikohad HTML/CSS-is kasutaja paranduste järgi.
9. Paranda brauseri aspect ratio / crop enne visuaalset lõppkontrolli.
10. Genereeri `public/room` WebP-d alles kinnitatud lõppvalikust.
11. Käivita lint, `npm run build` ja päris brauseri kerimiskontroll.

## Failid, mida on selles töövoos muudetud

- `components/room/RoomStage.jsx`
- `app/styles/room.css`
- `lib/room-frames.js`
- `scripts/generate-room-images.mjs`
- `output/imagegen/room-walk-final-selected-v3/`
- `output/imagegen/room-walk-final-selected-v3 – parandused/` on kasutaja töö; ära kirjuta seda üle.

## Tööpuu ettevaatus

Repo on väga must ja sisaldab palju kasutaja kustutusi ning muid muudatusi. Ära taasta ega kustuta neid oletuse põhjal. Eriti:

- vanad `output/imagegen/pov-chair-sequence/*` failid on kustutatud;
- `public/room` vanad kaadrid on kustutatud;
- kasutaja paranduste kaust tuleb säilitada muutmata;
- ära küsi kasutajalt API võtit ega paku talle teist töövoogu, kui ta seda ise ei soovi.
