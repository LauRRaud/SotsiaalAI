# SotsiaalAI — visuaalse kihi ehitusbrief (v1)

## 1. Kontekst ja piirid

- Olemasolev Next.js (React) rakendus. Kõik lehed, marsruudid ja funktsionaalsus on VALMIS ja töötavad. CSS/Tailwind on teadlikult 0 rida.
- Sinu ülesanne on ehitada AINULT visuaalne kiht. Ära muuda äriloogikat, andmevooge ega marsruute. Küsimuste korral loe olemasolevat koodi ja kohandu sellega.
- Paneelide arv ja nimed EI OLE selles dokumendis fikseeritud — loe need olemasolevast rakendusest (marsruudid/vaated) ja mahuta kõik.
- VIDEO KASUTAMINE ON KEELATUD kõikjal. Kogu liikumine sünnib piltidest, transformidest ja sulandustest.
- Ära lisa funktsioone, mida selles dokumendis ei ole.

## 2. Kontseptsioon

Rakenduse kest on soe, luksuslik, rahustav ruum hämarikuvalguses — puitpaneelid, kardinad, loojang akna taga, pehme mööbel. MITTE steriilne, MITTE kontorilik, MITTE kliiniline.

Kasutaja saabub pimedusest, "kõnnib" kerimisega läbi ruumi tugitoolini, istub, ja tema ette hõljuvad mattklaasist paneelid — need on rakenduse peanavigatsioon. Paneeli avades avaneb vastav vaade (olemasolev leht); sulgedes ollakse tagasi ruumis.

Toon: väärikas, vaikne, hoolitsetud. Kõik liikumised aeglased ja pehmed. Luksus on vaikne — pigem alahinda liikumise ulatust kui üle.

## 3. Materjalid (7 kaadrit, tellijalt)

| Fail | Roll |
|---|---|
| `1 - vaade uksest.png` | Saabumise algus. Kaadris on PÄRIS ukseava tumedate piitadega — laadimisekraani pimedus sulandub otse sellesse. |
| `2 - vaade ruumile.png` | Ruum avaneb ukse tagant. |
| `3 - vaatan tugitooli.png` | Kõnd, tool läheneb. |
| `4 - liigun lähemale.png` | Kõnd, tool suurelt ees. |
| `5 - viimane kaader enne istumist.png` | Tooli juures, vahetult enne istumist. |
| `6 - istun ja vaatan seina.png` | Istuja vaade paremale seinale (maal, kummut, laualamp). Kohaloleku seisund — terav. |
| `7 - fookus õhus olevatele klaaskaartidele.png` | Sama vaade, tooliserv väljas, taust kergelt hägune. Liidese seisund — paneelide taust. |

- Hoia tellija originaalfailid puutumatuna; veebi jaoks konverteeri AVIF/WebP (fallback), responsive `srcset`.
- Järjestikuste kaadrite väikesed erinevused (mööbli kerge triiv) on teada ja aktsepteeritud — sulandus + suum peidavad need.

### Referentspildid (EI OLE ehitusmaterjal)

| Fail | Roll |
|---|---|
| `8 - tekivad kaardid ja tasust udunev.png` | VISUAALNE ETALON karussellivaatele: klaaside toon, hägu, ääre-kuma, kaartide suurus ja perspektiiv, teksti stiil, tausta fookusaste. |
| `9 - vestluse aken.png` | VISUAALNE ETALON avatud Vestluse paneelile: akna proportsioonid, mullide ja sisendiriba paigutus klaasil, ikoonide stiil. |
| `10 - töölaud.png` | VISUAALNE ETALON avatud Töölaua paneelile: kaheveeruline ruudustik, rea kõrgus ja klaasitoon, kontuurikoon + nimi vasakul, ülanurkades menüü- ja info-ikoon. Ruudustiku sisu (funktsioonide nimed ja arv) loe RAKENDUSEST, mitte pildilt. |
| `11 - ...` (karussell pärast sisselogimist) | VISUAALNE ETALON sisselogitud karussellivaatele: Vestlus fookuses keskel, teised kaardid (Profiil jt) külgedel. Sama kompositsioon ja klaasistiil mis pildil 8 — sisselogimisel vahetub kaartide SISU, mitte vorm. Kaartide nimed ja arv loe RAKENDUSEST, mitte pildilt. |

- KRIITILINE: piltidel 8–11 kujutatud kaardid, tekstid, ruudustik ja vestlusaken tuleb ehitada PÄRIS HTML/CSS-ina (klikitavad, fookuseeritavad, ekraanilugejale loetavad, päris sisendiväljad). Neid pilte EI laeta kunagi lehele taustana ega elemendina — nad näitavad, MILLINE peab kood välja nägema.
- Ainus lehele laetav taust liidese-seisundis on kaader 7; klaasid selle ees on kood.
- Pilt 8 kalibreerib ühtlasi klaasi tooni/katvuse taseme, millega tekst maali ees loeb (WCAG AA kontroll ptk 7).
- Telgede reegel: karussell kerib paneelide vahel HORISONTAALSELT; avatud paneeli sisu (nt Töölaua ruudustik, vestluse ajalugu) kerib VERTIKAALSELT. Ära kasuta paneeli sees horisontaalset kerimist.
- Kaader 7 täisnimi tellija kaustas: `7 - enne fookust kaartidele - enne sisse logimist.png` (roll sama, mis tabelis eespool).

## 4. Laadimisekraan

- Tume taust, keskel SotsiaalAI logo, logo all üks rida: "Tegime sinu jaoks ruumi." (tellija võib sõnastust muuta). MITTE spinner, MITTE progressiriba, MITTE muud tekstid.
- Logo fail: `public/logo/sotsiaalai-h-valge.svg` (uus sõnamärk 07.07: Exo 2 kiri + originaal-AI märk; metallik-AI mask: `ai-mark.svg`, renderdatakse AI enda kastis).
- Logo elab AINULT siin — ruumis logo ei ole.
- Taustal eellaetakse kaader 1 (prioriteet) ja seejärel 2–7.
- Üleminek: logo ja rida hajuvad → tume ekraan sulandub kaadrisse 1 (mille servad on nagunii tumedad piidad) — pimedus ja pilt jätkavad teineteist.
- Ajapiirid: logo nähtaval min ~0,8 s; ruum avaneb hiljemalt ~2,5–3 s. Kui kaadrid pole valmis, ava blur-up eelvaatega (LQIP), mis teravneb taustal.
- Korduvkülastus (localStorage): laadimisekraan vilksatab hetkeks või jääb vahele; saabumiskõnd (ptk 5) jääb vahele ja maandutakse otse lõppseisu (ptk 6).
- prefers-reduced-motion: staatiline logo, lihtne üleminek.

## 5. Saabumiskõnd (scroll-linked)

### Mehaanika

- Stseen on pinnitud (fixed/sticky, `100lvh`); leht annab kerimisruumi ~4–6 ekraanikõrgust (häälestatav).
- Kerimine juhib: (a) aeglast suumi aktiivse kaadri SEES ja (b) ristsulandusi kaadrite VAHEL. Suum on pidev — see teeb jadast "kõnni", mitte slaidiseansi.
- KÕIK on seotud kerimispositsiooniga ja KAHESUUNALINE: tagasi kerides käib kõik tagurpidi; poolelioleval üleminekul peatudes jääb pilt pooleldi sulandunud seisu. MITTE ühtegi "käivitub üks kord" animatsiooni.
- Sujuvus: requestAnimationFrame + lerp (~0.1); silmus magab, kui kaamera on sihil; `visibilitychange` käsitletud.
- Kogu teekond on vahelejäetav (klahv/klikk viib lõppseisu).

### Kaadrite jada (orienteeruvad vahemikud, häälesta tunnetuse järgi)

| Kerimisvahemik | Sisu |
|---|---|
| 0–18% | Kaader 1: suum läbi ukseava. NB: suumi piisavalt, et tumedad piidad on servadest VÄLJAS, alles siis lase sulandus kaadrisse 2 haripunkti — üleminek peab lugema "astusin läbi ukse", mitte "pilt vahetus". |
| 18–36% | Kaader 2: suum ruumi. |
| 36–54% | Kaader 3. |
| 54–72% | Kaader 4. |
| 72–85% | Kaader 5. |
| 85–100% | Istumise pööre 5→6 (vt allpool), lõpus paneelid dokivad. |

### Istumise pööre (5→6)

Kaadrite 5 ja 6 vahel on ~90° vaatesuuna muutus (kõnd läheb akna poole, istuja vaatab paremale seinale). Lahendus on koreograafia, MITTE lisapilt:

- Ristsulandus, mille ajal kaader 5 nihkub hajudes VASAKULE ja kaader 6 siseneb kergelt PAREMALT (~1.05 → 1.0 settimisega) + õrn kaamera allavajumine (seisja kõrguselt istuja kõrgusele).
- Diivan/aken, mis on kaadris 5 keskel ja kaadris 6 vasakus servas, toetab järjepidevust — silm loeb selle "istusin ja pöörasin pilgu paremale".

### Tekstipeatused (külgedel, MITTE keskel)

- Tekstid EI OLE kunagi ekraani keskel ega üle stseeni plakatina. Kese jääb vabaks.
- Peatused: avarida VASAKUL (~20–30%; nt "Sotsiaalvaldkonna abikeskkond" — tellija lõplik sõnastus) → kellele-rida PAREMAL (~45–60%; "abi otsijale · sotsiaaltöö spetsialistile · teenuseosutajale", kolm osa võivad ilmuda järjest väikese nihkega) → mida-lause VASAKUL/ALL-VASAKUL (~65–80%; tellija sõnastab).
- Iga tekst on seotud oma kerimisvahemikuga (sisse-hajumine / püsimine / välja-hajumine), kahesuunaliselt; tekst nihkub õrnalt koos ruumiga (kerge kiirusevahe taustaga), et ta tunduks ruumis asuvat.
- Loetavus: hämara fototausta peal anna tekstile õrn toonitud klaasitaust/riba; kontrast WCAG AA. Pimeduse- ja uksefaasis (enne ~20%) tekste ei ole.
- Mobiilis samad tekstid alanurkades, väiksemana; vahemikud lühemad.
- "Alusta vestlust" on diskreetselt kättesaadav kogu teekonna vältel (nt ülanurgas) — kriisis inimene ei tohi kino lõppu oodata.

## 6. Lõppseis ja fookusvahetus

- Teekonna lõpus: samal ajal kui paneelid sisse hõljuvad ja dokivad, toimub aeglane ristsulandus kaadrist 6 kaadrisse 7 — ruum "astub sammu tagasi" (taust hägustub, tooliserv kaob), fookus läheb klaasidele.
- Paneelide sulgemisel (× või Esc) pöördsulandus 7→6 — ruum tuleb teravaks. Fookuse liikumine on osa navigatsioonitundest.
- Ruumi mikroelu lõppseisus: väga aeglane "hingav" suum (paar promilli) + õrn kalle kursori suunas (max mõni piksel). Ei midagi muud. prefers-reduced-motion: staatiline.

## 7. Paneelisüsteem

### Karussell (valikuvaade)

- Mattklaasist kaardid: fookuspaneel keskel suurem, kaks külgmist kitsamalt, kergelt sissepoole pööratud (perspektiiv). Ülejäänud on rea peidus.
- Pööramine: nooleklahvid ←/→, noolenupud vasakus ja paremas servas, hiirega lohistamine, puutesvaip. Klikk/Enter avab KESKMISE; klikk külgpaneelil pöörab selle enne keskele.
- Kui paneele on üle 5–6: diskreetne asukohaviide karusselli all (punktid või "4/9").
- ENNE sisselogimist: avalikud kaardid, keskel LOGI SISSE (nt Juhend, Tingimused jt — loe rakendusest).
- PÄRAST sisselogimist: töökaardid, keskel vaikimisi VESTLUS (Töölaud, Profiil jt — loe rakendusest). Eduka sisselogimise järel vahetub paneelikomplekt SAMAS ruumis, ilma lehe täislaadimise tundeta.

### Avatud paneel

- Avanemine: paneel liigub ette ja avaneb sujuvalt üle ekraani keskosa; sulgemisrist (×) paneeli ülanurgas + Esc sulgevad ja viivad tagasi karusselli SAMASSE kohta.
- Iga paneel on PÄRIS marsruut (olemasolev Next.js routing) — brauseri tagasi/edasi töötab, URL on jagatav.
- SEISU SÄILIMINE: sulgemine/avamine ei kaota paneeli seisu. Vestluses kirjutamata sõnum, kerimiskoht ja kontekst püsivad naasmisel muutumatult.
- Avatud paneeli sees on sisu selgus ja kiirus esikohal; atmosfäär on ainult raam. Ära disaini sisulehti ümber.

### Klaasistiil

- Toon, katvus, blur, tekstivärv ja ääre-kuma CSS-muutujatest — häälestatud hämarikutausta peale.
- Tekstikontrast vähemalt WCAG AA. Kaadris 7 on paneelide taga kontrastne maal: kui tekst selle ees ei loe, TUGEVDA KLAASI TOONI/KATVUST — ära puuduta pilte.
- Ikoonid: õhukesed kontuurikoonid klaasil "graveeringuna".

### Klaviatuur ja ligipääs

- Paneelid on päris fookuseeritavad elemendid (nav + lingid), ekraanilugejale loetav loend.
- Tab-järjekord: keskmine paneel → külgmised. Nähtav fookus igas seisundis.
- Skip-link "Liigu sisu juurde" hüppab otse paneelidele.

## 8. Žestijuhtimine kaameraga (opt-in lisand, MITTE kunagi vaikimisi)

- Väike "Juhi kätega" lüliti (käe-ikoon) ruumi servas. Sisselülitamisel üherealine selgitus: "Töötlus toimub ainult sinu seadmes, videot ei salvestata ega saadeta." Alles seejärel küsitakse kaamera luba.
- Tehnika: MediaPipe Hands (või samaväärne) brauseris, WASM/WebGL, kogu töötlus lokaalne. Mudel laetakse ALLES lüliti sisselülitamisel. Leht on täisfunktsionaalne ilma selleta.
- Žestid: käe svaip vasakule/paremale = karusselli pööre ühe paneeli võrra; ~0,7 s jahtumisaeg; tuvastuslävi piisav, et juhuslik liigutus ei käivitaks.
- Aktiivne AINULT karussellivaates — avatud paneeli sees žestid ei tööta.
- Kaamera aktiivsuse indikaator nähtav; väljalülitus üks klikk; valik salvestatakse. Vihjerida "Viipa vasakule või paremale" ainult siis, kui režiim on sees.

## 9. Jõudlus ja ligipääsetavus (kõvad nõuded)

- prefers-reduced-motion: saabumiskõnd jääb ära; staatiline vaade (kaader 7 + paneelid + nimi/alarida/sihtrühmad loetavana); kõik funktsioonid töötavad; üleminekud hetkelised või lihtsad hajumised.
- Kogu navigatsioon klaviatuuriga läbitav.
- Efektid AINULT transform/opacity/filter peal (GPU); mitte kunagi layout-omadustel. Scroll-kuularid passiivsed.
- Pildid: AVIF/WebP + srcset; kaader 1 prioriteediga; kaadrid `eager` + `img.decode()` ette enne teekonda (lennu ajal saabuv pilt = tühi raam; esmadekodeerimine kerimise hetkel = hakkimine).
- iOS: pinnitud stseenil `height: 100lvh` (mitte ainult `inset: 0`); `html`-ile stseeniga sama taustavärv (kummipaela-ületõmme ei tohi valgena välkuda).
- Kui kasutad paneelide jaoks 3D-perspektiivi: MITTE pesastatud `preserve-3d` ahelat (iOS Safari lamendab). Ühetasandiline muster: `perspective` paneelide otsesel vanemal, kaamera CSS-muutujana, iga paneel `translateZ(calc(...))`. `will-change: transform` ainult leht-elementidel, mitte ümbriskihtidel. z-index staatiline, mitte iga kaader ümber arvutatud. Lisa käivitusaegne 3D-proov ja lame varuvariant.
- Mobiil: teekond töötab loomuliku puutekerimisega; kalle-efekt väljas või minimaalne; karussell svaibitav; tekstid alanurkades.

## 10. Mida MITTE teha

- MITTE videot ega video-scrubbing'ut (referentslehtede tunne saavutatakse kaadrijada + suumi + sulandusega).
- MITTE "galeriilendu": ruum ei ole kaart tühjuses ega hajut kunagi välja. Ruum on maailm, mitte element.
- MITTE tekste ekraani keskel ega plakatina üle stseeni.
- MITTE scroll-triggered ühekordseid animatsioone ("libiseb sisse ja jääb paigale").
- MITTE uusi funktsioone, seadeid ega režiime, mida selles dokumendis pole.
- MITTE sisulehtede (vestlus, töölaud jne) ümberdisainimist — need saavad ainult klaasi-raami ja tüpograafia.

## 11. Tellija täidab / lahtised sõnastused

- Laadimisekraani rida (vaikimisi "Tegime sinu jaoks ruumi.").
- Avarida, mida-lause ja kellele-rea lõplik sõnastus.
- Paneelide nimed ja arv tulevad rakendusest — kinnita komplekt tellijaga enne lõplikku ehitust.
