# ADR-149: seadusesäte tuleb kaasa lõiguga, mis ütleb sama ja paragrahvi ei nimeta

Kuupäev: 12.10.2026. Teostus Claude Opus 5.5. Seis: **mõõdetud, ehitatud, tasuta kontroll serveris tehtud: otsustav säte on tõendites 29 kontrollküsimusel 33-st (enne 26), ühtki kaotust ei ole. Mudelit ei kutsutud ja midagi ei ostetud. Vastuseid ei ole mõõdetud.**

## Miks

Omanik 12.10.2026: „nii saab ka teha, et graafi lisatakse vastusele üldjuhul juurde, nt kui tegu on seadusega, siis tuleks vastusesse nii artiklid kui seadus. […] Üks minu soovidest olid paremad seosed, ehk siis teenused, taustsüsteemid jms vastuses.“

Ajend oli korpuse v88 järgne otsinguvärav ([ADR-148](adr-148-the-parenting-site-and-substitute-care-guides.md)): Narva asendushoolduse küsimusel langes sotsiaalhoolekande seaduse § 45¹¹ kandidaatide seas 7. kohalt 21. kohale. Ette tulid uued lehed, mis ütlevad sama summa (240 eurot kuus) ja paragrahvi ei nimeta.

Seni tuli seadusesäte valitud lõiguga kaasa ainult siis, kui lõik sätet ise nimetab ([ADR-064](adr-064-named-other-act.md), [ADR-145](adr-145-a-passage-points-at-the-provision-it-names.md)). Leht, mis ütleb summa või tingimuse oma sõnadega, seadust kaasa ei toonud: säte jõudis tõenditesse ainult siis, kui otsing selle ise piisavalt ette järjestas. Mudeliga tehtud kaardid ja seosed on 41 dokumendil ja nende mõju on mõõtmata ([ADR-147](adr-147-knowledge-cards-on-rule-reviewed-sources.md)).

## Mõõtmine enne ehitamist (tasuta, töötav indeks v88)

Indeksis on iga lõigu vektor juba olemas. Lõigu enda vektoriga saab küsida, mis seadusesätted talle kõige lähemal seisavad, ilma ühegi uue vektorita. Valim: 734 lõiku tekstidest, mis ei ole õigusaktid (juhendid, lehed, artiklid, omavalitsuse kirjed); võrreldud 40 kehtiva riikliku akti 6846 lõiguga. Paarid loeti käsitsi.

| Sarnasus lähima sättega | Lõike valimis | Loetud paare | Säte on lõigu enda asjast |
|---|---:|---:|---|
| 0,65 ja üle | 87 | 27 | kõik 27 (paaril juhul naabersäte samast asjast) |
| 0,60–0,65 | 84 | 13 | 9; neli viisid teise akti sarnase sõnastusega sätteni |
| alla 0,60 | 563 | | ei loetud: siit sätet ei võeta |

Näited üle 0,65: lapsetoetuse leht ja perehüvitiste seaduse § 17; elusolekutõendi leht ja riikliku pensionikindlustuse seaduse § 42⁴; perelepituse leht ja riikliku perelepitusteenuse seaduse § 7. Eksimused vahemikus 0,60–0,65: Töötukassa teenuse leht ja sotsiaalhoolekande seaduse teise teenuse säte; elatisotsuse tunnustamise leht ja kriminaalmenetluse seadustik.

**Ühise summa märk ei kõlba reegliks.** Proovitud: kas lõik ja säte nimetavad sama arvu koos ühikuga. Selliseid paare on vähe ja madalama sarnasuse juures eksitavad need (omavalitsuse hoolduspere toetuse kirje ja perehüvitiste seaduse eestkostetava lapse toetus jagavad arvu 240).

## Otsus

**Valitud lõiguga, mis ei ole õigusakti lõik, tuleb kaasa talle lähim kehtiva riikliku akti säte, kui:**

1. sarnasus on vähemalt 0,65, või
2. sarnasus on vähemalt 0,60 ja küsimuse enda otsing leidis sama sätte samuti (säte on kandidaatide seas).

Teine tingimus hoiab vahemikus 0,60–0,65 välja sätted, mis on lõigule sarnased, aga küsimusega seotud ei ole.

- **Kuni kaks sätet pöörde kohta**, loetud esimese üheksa valitud lõigu viiest lähimast, suurema sarnasusega enne.
- **Midagi ei tõrjuta välja.** Säte tuleb pärast kõiki seniseid lisandusi (küsimuses nimetatud säte, lõigus nimetatud säte, seaduse enda viited), võtab koha ainult siis, kui 15 kohast on mõni vaba, ja teksti ainult viidete 3000 tokeni ruumist.
- **Seos arvutatakse otsingu ajal ja kuhugi ei salvestata**, nagu ADR-145 seosed. See on olemas igal dokumendil kohe, ka järgmisel täiendusel, ja viib alati kehtiva redaktsioonini.
- Profiili (`hybrid-estnltk-chat-v6`), indeksit ega andmeid ei muudeta. Rada töötab ainult profiilis, kus nimetatud aktide kohad on olemas.
- Kui vektorihoidla ei vasta, jääb pööre selleks, mis ta oli: rada ainult lisab.

Tõendis on lisatud säte liigiga `companion_provision` koos sarnasuse ja märkega, kas küsimuse otsing ta leidis. Vastusele näeb see välja nagu iga teine seaduse lõik: sätte silt ja seaduse lühend on kaasas ([ADR-123](adr-123-provision-label-for-legal-passages.md), [ADR-129](adr-129-luna-names-the-provision.md)).

## Teostus

- `lib/rag-v2/search/qdrant.js`: `vectors` loeb üksuste salvestatud vektorid (samade ulatuse kontrollidega nagu päring).
- `lib/rag-v2/search/retrieval.js`: rada pärast nimetatud aktide rada; läved on konstandis `COMPANION_PROVISIONS`.

Ühikteste ei lisatud (omaniku otsus 12.10.2026: muudatust kontrollitakse lindi ja mõõtmisega).

## Mõõdetud pärast ehitamist (tasuta, serveris)

Muudetud kood kattekausta kaudu, mis erines töötavast väljalaskest täpselt kahe faili võrra. 33 kontrollküsimust, otsing ilma valiku mudelita, nii et tõendid on otsingu enda järjekorras. Sama vaatlus tehti väljalaske enda koodiga ja lõpliku koodiga uuesti (33 rida 33-st samad).

| | Töötav väljalase | Muudetud kood |
|---|---:|---:|
| Küsimusi, kus otsustav lõik on tõendites | 26 | **29** |
| Küsimusi, kus mõni otsustav lõik kadus | | 0 |
| Küsimusi, kus lisati kaasnev säte | | 31 |
| Kaasnevaid sätteid kokku | | 59 (50 sarnasusega üle 0,65; kõik 59 leidis ka küsimuse otsing) |
| Tõendeid küsimuse kohta | 20,1 | 21,9 |
| Konteksti suurus küsimuse kohta | 11 099 tokenit | 12 093 tokenit |
| Hoiatusi juurde | | 0 |

- **Juurde tulnud otsustavad lõigud:** treeneri teatamiskohustus (lastekaitseseaduse § 27¹ ja § 31), toimetulekutoetusest keeldumine ainsa eluruumi tõttu (sotsiaalhoolekande seaduse § 134) ja lapse rehabilitatsioonivajadus (lastekaitseseaduse § 28, sotsiaalhoolekande seaduse § 62).
- **Kõik muu jäi samaks:** iga küsimuse tõendid on endised pluss kaasnevad sätted; küsimuses ja lõigus nimetatud sätete lisandused on samad.
- **Loetud 59 lisandust:** valdavalt valitud lõigu enda asja säte (toimetulekutoetuse leht ja § 132–134; pensionäritoetuse leht ja § 139³ ning riigieelarve seaduse rida summaga). Mõnel juhul naaberteenuse säte (igapäevaelu toetamise lehele ka toetatud elamise § 95), ühel juhul üldine säte (sotsiaalseadustiku üldosa seaduse § 10).
- **Aeg:** rada võtab mediaanis 149 ms, 90. protsentiil 255 ms, suurim 650 ms.
- **Otsinguvärav** ([ADR-122](adr-122-free-search-gate.md)) samal koodil: vigu 0, ühtki otsustavat lõiku ei kadunud; kandidaadid ja nende järjekord ei muutunud (rada kandidaate ei järjesta), seega jäävad värava kaks „tahapoole nihkunud“ rida samaks.

**Narva küsimus.** Värava kordusmängus on § 45¹¹ tõendites nii enne kui pärast: Narva määruse lõik nimetab seda ja ADR-064 toob selle kaasa. Värava märge käis kandidaatide järjekorra kohta. Uus rada lisas sellel küsimusel järelhoolduse sätted (§ 45¹⁵ ja § 45¹⁶). Kas päris vestluses, kus tõendid valib mudel, on § 45¹¹ alles, näitab ainult tasuline pööre.

## Vastupidine suund ja teenused (kavand, ei ehitatud)

Mõõdetud samal viisil 240 seaduselõiguga.

- **Sättest selgitava tekstini.** 70 lõigul 240-st (29%) on juhend, leht või artikkel sarnasusega vähemalt 0,65; loetud 15 paarist 14 on samast asjast (elatisabi lõpetamise säte ja ameti leht; menetlusabi säte ja kohtute leht), üks viis tsiviilkohtumenetluse sättest kriminaalmenetluse leheni. See suund on ehitatav sama reegliga. Ehitamata, sest iga lisandus maksab konteksti ja kasu saab näidata ainult vastuste mõõtmisega.
- **Sättest omavalitsuse teenusekirjeni vektorid ei vii.** Kahe omavalitsuse (Narva, Tartu) kirjetel oli sarnasus üle 0,60 ühel paaril 480-st; lähimatest paaridest pooled olid vale teenus (ööpäevaringse erihoolduse säte ja üldhooldusteenuse kirje). Kirje on lühike ja omavalitsuse sõnastuses.
- **Teenuste jaoks sobib tabel.** Teenusekirjed kannavad teenuse liigi nime: 16 nime esineb vähemalt 20 omavalitsuses ja katavad 846 teenusekirjet 1253-st (koduteenus 74 omavalitsuses, isikliku abistaja teenus 68, sotsiaaltransport 66, varjupaik 66, tugiisik 65, võlanõustamine 65, turvakodu 64, täisealise hooldus 61, asendushooldus 57, järelhooldus 56, lapsehoid 50, eluruumi tagamine, üldhooldus, vältimatu sotsiaalabi). Igaüks neist on sotsiaalhoolekande seaduse üks jagu. Käsitsi kontrollitud tabel „teenuse liik ja seaduse paragrahvid“ (umbes 14 rida) seoks kirje ja sätte mõlemas suunas ilma arvamata. See on järgmine samm ja ootab omaniku otsust.

## Piirid

- **Vastuseid ei ole mõõdetud.** Tasuta kontroll näitab, et säte jõuab tõenditesse ja midagi ei kao. Kas vastus läheb paremaks, näitab ainult tasuline vastusekontroll.
- Kontekst kasvab keskmiselt umbes 1000 tokenit pöörde kohta (9%); see on vastuse mudeli sisendi hind.
- Kaasa tuleb ainult kehtiva riikliku akti säte. Omavalitsuse määruse säte teenusekirje juurde on mõõtmata ja ehitamata.
- Kui teksti enda akti kogus ei ole, võib lähim säte olla teise akti sarnase sõnastusega säte; läved ja teine tingimus vähendavad seda, ei välista.
- Mõõtmine on tehtud ilma valiku mudelita; päris pöördes valib tõendid mudel ja rada loeb tema valitud lõike.

## Tagasivõtmine

Muudatuse tagasipööramine taastab senise otsingu. Indeksit, plaani, profiili ega andmeid ei muudetud.

Mõõtevahendid ja tulemused: serveris `/home/ubuntu/rag-v2-work/w7/` (`near-law.mjs`, `near-text.mjs`, `companion-diag.mjs`; `near-law-2.json`, `near-text.json`, `diag-base.json`, `diag-ov.json`, `diag-final.json`, `gate-ov-report.json`).
