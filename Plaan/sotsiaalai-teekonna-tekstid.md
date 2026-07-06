# SotsiaalAI — teekonna tekstid

Täiendus failile `sotsiaalai-visuaalne-brief-v1.md`. See dokument ASENDAB põhibrief'i ptk 5 tekstipeatuste sisu (avarida / kellele-rida / mida-lause kohatäited). Peatuste MEHAANIKA (külgedel, mitte keskel; toonitud riba; kerimisega seotud, kahesuunaline; kontrast WCAG AA; mobiilis alanurkades) kehtib põhibrief'ist muutumatuna.

## Laadimisekraan

Logo all üks rida (PEASÕNUM, keskel):

> Tegime ruumi, kus sotsiaalvaldkonna teadmine on ühes kohas.

(Asendab põhibrief'i rea "Tegime sinu jaoks ruumi." — see on sama lause täisversioon.)

Alaservas, väikselt, teises visuaalses kaalus (USALDUSRIDA — laadimisekraani "jalus"):

> SotsiaalAI-d arendatakse sotsiaalse ettevõttena.
> Peame oluliseks turvalist kasutust, andmekaitset ja selgeid kasutusreegleid.

Usaldusrea reeglid:
- Hierarhia: silm loeb esimesena keskse peasõnumi; alaserva read on väiksemad ja vaiksema kontrastiga (aga loetavad, WCAG AA piires).
- Neid ei PEA jõudma lugeda — kohalolek loeb; laadimisekraani ajastust (min ~0,8 s / max ~3 s) selle pärast EI pikendata.
- MITTE lisada kolmandat teksti ega paigutada usaldusrida peasõnumi lähedale.

## Mullid kaadrite kaupa

KÕIK sõnastused allpool on tellija KINNITATUD (06.07.2026). Muudatused ainult tellijalt.

| Kaader | Tekst | Paigutus |
|---|---|---|
| 1 — vaade uksest | Kui oled eluküsimusega pöörduja, sotsiaaltöö spetsialist või teenuseosutaja — astu sisse. | vasakul (või ukseava kõrval, kompositsiooni järgi) |
| 2 — vaade ruumile | Tere tulemast. → Kõik siin on seatud sinu järgi. | paremal; kaks peatust SAMAS positsioonis (muster 1: teine lause jätkab esimest, vahetus parallax-nihkega) |
| 3 — vaatan tugitooli | Küsi teenuste, toetuste, õiguste või tööpraktika kohta. → Saad koostada taotlusi ja dokumente — ning vestelda, kellega vaja. | esimene vasakul, teine paremal (muster 2: kaks teemat vastaskülgedel) |
| 4 — liigun lähemale | Saad teada teekonnal oma sammud. → Saad alustada pöördumist või jagada abisoovi. | esimene paremal, teine vasakul (muster 2) |
| 5 — viimane kaader enne istumist | Näed ise, kust info pärineb. → Ja sina otsustad, mida jagad. | esimene vasakul, teine paremal (muster 2: usalduse paar) |
| 6 — istun ja vaatan seina | Kõik vajalik on nüüd sinu ees. | KESKEL, otse ees (ainus keskpaigutuse erand — vt reeglid) |
| 7 — fookus kaartidele | — (teksti ei ole; kaartide nimed ON tekst) | — |

Märkus: "Kirjelda oma olukorda oma sõnadega" EI ole teekonnal — selle koht on vestlusakna sisendivälja kohatäites või tühivaates, kus inimene päriselt kirjutama hakkab.

## Teostuse parandused (tellija tagasiside esimesele eelvaatele)

### Kaadrivahetus — topeltpildi vältimine

- Ristsulanduse ülekate LÜHIKESEKS: ~10–15% segmendi kerimisvahemikust. Suurem osa kerimisest on ÜHE kaadri suum; vahetus ise on kiire. (Esimeses eelvaates oli ülekate liiga pikk — kaks kaadrit olid kaua korraga nähtavad ja mööbel paistis topelt.)
- Sulandus toimub AINULT liikumise sees: väljuv kaader jätkab suumi, sisenev alustab ~1.05 skaalalt ja settib 1.0 peale. MITTE KUNAGI staatilist ristsulandust (kaks seisvat pilti üksteise peal = kummituspilt).
- Sulanduse haripunktis mõlemale kihile õrn blur (4–8 px, sujuvalt sisse ja välja) — loeb kui "silm fokuseerib sammul uuesti" ja peidab kaadrite joondumise erinevused.
- Kui pärast neid kolme parandust häirib topeltpilt endiselt: varuvariant on hetkeline õrn hämardumine kaadrite vahel (nagu silmapilgutus sammu ajal) — aga proovi enne pehmet teed.

### Tekstimullid (JourneyText) — stiil

- Plaat LIIBUB tekstile: padding ~12–16 px vertikaalis / 20–24 px horisontaalis, laius sisu järgi (inline), MITTE fikseeritud kast. Nurgaraadius väike, toon vaikne. (Esimeses eelvaates olid plaadid teksti ümber liiga suured — kast, mitte riba.)
- EELISTATUD variant tumeda hämarikutausta peal: ILMA plaadita — peen kohalik toon/gradient või tekstivari otse teksti taga, nii et tekst istub ruumis, mitte sildil.
- Plaat ainult siis, kui tekst satub heleda ala (akna) ette ja kontrast seda nõuab. Kontrast WCAG AA säilib mõlemal juhul.

## Reeglid

- Iga mull on seotud oma kaadri kerimisvahemikuga (sisse-hajumine / püsimine / välja-hajumine), kahesuunaliselt — nagu põhibrief'i ptk 5.
- KAHE PEATUSE MUSTRID: peatused ei ole kaadritega üks-ühele seotud — ühe kaadri suumi-vahemikku mahub kaks järjestikust peatust. Muster 1: üks mõte kahes lauses — teine lause jätkab SAMAS positsioonis, vahetus parallax-nihkega. Muster 2: kaks eri teemat — teine lause tuleb TEISES positsioonis (vastasküljel). Korraga on nähtaval alati AINULT ÜKS tekst; vahetus käib alati läbi hajumise. Iga lisapeatus vajab tellija eraldi otsust — "mahub" ei ole põhjus lisada.
- Mullid on lühikesed laused, üks mõte lause kohta. MITTE lisada rohkem peatusi ega pikendada olemasolevaid.
- KESKPAIGUTUSE ERAND: kaadri 6 tekst on AINUS, mis tohib olla ekraani keskel (istuja vaatab seina, kese on vaba). Tingimus: see tekst peab olema TÄIELIKULT hajunud enne või samal ajal, kui kaardid dokivad — tekst ja kaardid ei ole hetkegi koos nähtavad. Kõik teised tekstid külgedel, nagu põhibrief nõuab.
- SÕNAVARA: mitte kunagi kasutada sõnu "abivajaja" ega "abi otsija" üheski liidese tekstis — need sildistavad inimest. Kasutada "eluküsimusega pöörduja" (kirjeldab olukorda) või sina-vormi ("kui otsid selgust elulises küsimuses"). Reegel kehtib kogu rakenduses, ka väljaspool teekonda, ja on ülimuslik põhibrief'i varasemate sõnastuste suhtes.
- Sõnastused on tellija kinnitatud; muudatused ainult tellijalt.
- Sisu, mis teekonnal EI kõla (AI piiride põhimõte, vestlusruumide ja teenusekaardi tutvustus, visioon), elab Meist-lehel ja mujal rakenduses — teekond ei pea kogu lugu rääkima.

## Käivitus ("seade pannakse tööle")

Kontseptsioon: liides on nagu seade/kuvarid, mille kasutaja ise käivitab. Kaardid ei hüppa ette — kasutaja lülitab nad sisse. See plokk asendab põhibrief'i ptk 6 rea "paneelid hõljuvad sisse ja dokivad" — kaardid ilmuvad KÄIVITUSEGA, mitte automaatselt.

### Seisundid ja voog

1. OOTEREŽIIM (esmakülastaja teekonna lõpus; väljalogitu; pärast OFF-i):
   - Taust: kaader 6 (terav ruum). Keskel, ILMA klaasikaardita, vabalt ruumi ees, ülalt alla: tekst "Ühenda SotsiaalAI platvormiga" → selle ALL toitenupp (⏻). MITTE definitsioonilauset ega muud teksti — lüliti ei vaja seletust (rollipõhisuse mõte on öeldud kaadril 2).
   - Loogika: toitelüliti on "seadme korpusel", mitte kuval — ükski klaas/ekraan EI ole enne käivitust nähtav. Esimene klaas, mida kasutaja näeb, ilmub käivitusega.
   - ⏻ on värvitu kontuurikoon, õrnalt "hingava" kumaga (kutse). Ikoonil aria-label. MITTE rohelist/punast värvi. Teksti loetavuseks vajadusel imepeen vari/toonimine teksti taga, aga MITTE kaarti.
   - Kaadri 6 keskne tekst ("Kõik vajalik on nüüd sinu ees.") peab olema täielikult hajunud enne ooterežiimi elementide ilmumist — keskpaigutuse erandi tingimus kehtib ka siin.

2. KÄIVITUS (⏻ vajutus) — KAHEFAASILINE, nagu ekraanid, mis viitega tööle lähevad:
   - Lühike süttimissähvatus nupul; nupp ja tekstid hajuvad välja; taust hägustub (ristsulandus kaader 6 → 7, nagu põhibrief'i fookusvahetus).
   - FAAS 1 — klaasid: KÕIK KOLM kaarti ilmuvad fade-in'iga OMAL KOHAL, TÜHJADENA (paljas klaas, ilma sisuta), järjestatud viitega (~150–250 ms vahedega, keskmine esimesena). MITTE libisemist, MITTE keskelt välja nihkumist.
   - FAAS 2 — sisu: klaaside PEALE laadivad tekstid ja ikoonid fade-in'iga (keskel LOGI SISSE, külgedel JUHEND, TINGIMUSED jt avalikud kaardid karussellireeglite järgi) — kuva süttib enne, sisu joonistub järele.
   - Kogu käivitus kokku kiire (~1 s suurusjärk) — rituaal, mitte ootamine.

3. SEES (fuajee või töökaardid):
   - Kaardivaate nurgas väike ⏻ ikoon (kontuur) + TILLUKE soe värvipunkt ikooni juures (tokenivärv; maitsedetail, MITTE seisundi ainus kandja). Hover/fookus: tekst "Lülita välja".
   - "Lülita välja" viib PUHKESEISUNDISSE, MITTE ei logi välja.

4. PUHKESEISUND (OFF):
   - Sisu hajub klaasidelt, seejärel klaasid ise (käivituse pöördjärjekord), taust teravneb (7 → 6).
   - Keskele naaseb ooterežiimi lüliti (tekstid + ⏻, ilma klaasita); kui kasutaja on sisse logitud, on selle all diskreetne tekstirida "Logi välja".
   - ⏻ uuesti vajutamine: sisselogitud kasutaja naaseb otse OMA kaartidele (töökomplekt, VESTLUS keskel) — OFF ei ole logout; väljalogitu käivitub fuajeesse.

5. PÜSIKASUTAJA (sisse logitud, naaseb lehele): maandub otse töökaartidele ilma ooterežiimita (kehtib põhibrief'i korduvkülastuse reegel). Ooterežiim on esmakogemuse ja väljalogitu/OFF-i vaade.

### Käivituse reeglid

- Sisselogimine ise: LOGI SISSE kaart → modaal (pilt 12); õnnestumisel kaardikomplekt vahetub samas ruumis töökomplektiks.
- Kõik tekstid ("Ühenda SotsiaalAI platvormiga", "Lülita välja", "Logi välja") on lõplikud; muudatused ainult tellijalt.
- prefers-reduced-motion: sähvatuse ja järjestatud viite asemel lihtne üheaegne ilmumine; kõik seisundid ja nupud töötavad samamoodi.
