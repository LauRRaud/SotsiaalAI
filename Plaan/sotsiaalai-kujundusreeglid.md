# SotsiaalAI — kujundussüsteemi reeglid

Iseseisev dokument visuaalse kihi ehitajale. Kehtib koos põhibrief'iga (`sotsiaalai-visuaalne-brief-v1.md`); vastuolu korral kehtib põhibrief.

## Põhimõte

Kuju võib erineda, idee mitte. Saatmisnupp on ring, sulgemisrist on ikoon, sisselogimisnupp on lai plaat — aga kõik on SAMA nupp: sama klaas, sama fookusring, sama käitumine, samad tokenid. Kogu liides peab tunduma ühe käe tehtud. Iga reegel allpool teenib seda.

## 1. CSS-arhitektuur

- MITTE ühte pikka globals.css faili. Kohandatud CSS elab Tailwindi CSS `@layer` süsteemis (theme / base / components / utilities), et utiliitidega ei tekiks spetsiifilisuskonflikte — mitte `!important`-e ega ülispetsiifilisi selektoreid.
- Disaini-tokenid (klaasi toonid, hägu, tempod, easing, ikoonimõõdud) CSS-muutujatena `theme`-kihis. Klaasikeele nimelised klassid `components`-kihis. Dünaamika (kõnd, karussell) JS-ist CSS-muutujate kaudu.
- Failid valdkonna kaupa (nt glass, journey, carousel, loading) või CSS Modules — globals.css jääb ainult importide, tokenite ja base-miinimumi jaoks.

## 2. Primitiivid

Klaasikeel ehitatakse väikese komplekti taaskasutatavate React-primitiividena. Iga leht KASUTAB primitiive; ükski leht ei defineeri oma klaasi kohapeal. Definitsioon ühes kohas, kasutus paljudes.

Orienteeruv komplekt (lõplik jaotus ehitaja otsustada):
- `GlassSurface` / `GlassPanel` — klaasi baaspind (toon, hägu, ääre-kuma).
- `GlassCard` — karusselli kaart (fookus- ja külgseisund).
- `GlassModal` — kompaktne modaal (sisselogimine; × ja Esc sisse ehitatud).
- `GlassButton`, `IconButton` — nupud.
- `GlassInput` / `GlassField` — vormiväljad.
- `GlassListRow` — Töölaua ruudustiku rida (ikoon + nimi).
- `JourneyText` — saabumiskõnni tekstipeatus.

Reeglid:
- Primitiivid loevad AINULT tokeneid. Mitte ühtegi kohapeal defineeritud värvi, hägu ega tempot — kalibreerimisel muutub üks koht.
- Ligipääsetavus sisse ehitatud: nähtav fookusring, klaviatuurikäitumine, aria-rollid primitiivi sees üks kord.
- Olemasolevate lehtede sisu MÄHITAKSE primitiividesse; loogikat ei kirjutata ümber.
- Asukoht: üks selge kaust (nt `components/glass/`).
- MITTE tuua sisse välist komponenditeeki/disainisüsteemi.

## 3. Suletud variandisüsteem

Variandid on väike, tsentraalselt defineeritud, LUKUS komplekt. Ükski leht ei loo uut varianti ega kohalikku erandit. Kui olemasolev ei sobi, kasutatakse vaikimisi varianti; uue variandi lisamine on AINULT tellija otsus.

Nupud (kogu rakenduse peale):
- `default` — kõik tavategevused, KAASA ARVATUD kustutamine ja tühistamine. Kustuta-nupp on tavaline nupp tekstiga "Kustuta" — mitte punane, mitte eristiiliga.
- `primary` — maksimaalselt üks nähtav peategevus vaate kohta (Saada, Logi sisse). Kui peategevust pole, pole ka primary-nuppu.
- `icon` — ikoonnupud (×, nooled, mikrofon), alati aria-label'iga.

Mitte ühtegi muud varianti. Ei ohu-varianti, ei suurusi lehe kaupa, ei ghost/outline/link perekonda.

Teised primitiivid: variandid ainult siis, kui põhibrief või referentspildid neid nõuavad (nt GlassCard fookus/külg). Vaikimisi on variante üks.

Jõustamine: variandid TypeScript unionina (vale nimi ei kompileeru); primitiivid EI võta vastu vaba `className`-i välimuse muutmiseks — lubatud ainult paigutusprops, kui vältimatult vaja.

## 4. Kerimisribad

Puhkeolekus EI OLE ühelgi vaatel nähtavat kerimisriba; süsteemi halli riba ei kuvata kusagil.

- Keritavad alad kerivad normaalselt edasi — ratas, puude, klaviatuur (PageUp/Down, nooled, Home/End) töötavad täielikult. MITTE `overflow: hidden` sisu peitmiseks, MITTE `scrollbar-width: none` ilma asendusvihjeta.
- Riba on OVERLAY: kerimise ajal ilmub õhuke klaasikeelne triip (poolläbipaistev, ümarad otsad, ilma taustarennita), hajub ~1–2 s pärast kerimise lõppu. Stiil tokenitest.
- Body-tasandil liidese-seisundis kerimist ei ole — kogu kerimine elab paneelide sees. Saabumiskõnni ajal on brauseri enda riba paratamatu ja lubatud.
- Kui keritava ala jätk pole ilmne, lisa serva õrn vihje (poolik sisu serv või hajuv gradient).
- Telgede reegel: karussell kerib paneelide vahel horisontaalselt; paneeli sisu kerib vertikaalselt. Paneeli sees horisontaalset kerimist ei ole.

## 5. Ikoonid

Allikas: `components/brand`. Kasutamine lubatud kõikjal, kus ikoon selgust lisab (referentspildid 8–12 näitavad stiili ja kohti).

- KUI ikooni kasutatakse, siis AINULT sellest kaustast. MITTE installida väliseid ikoonipakke (Lucide, Heroicons, Font Awesome jms).
- Kaartidel ja ridadel ikoon + nimi; ainult-ikoon nupud saavad aria-label'i.
- Ikoonid SVG-na, värv ja mõõt tokenitest (`currentColor` + suurusmuutuja) — järgivad klaasi teksti värvi ja seisundeid automaatselt.
- Ikoon on toetav: kui sobivat pole, on tekst ilma ikoonita parem kui vale stiiliga ikoon.
- Puuduva ikooni protseduur: (1) kontrolli olemasolevaid; (2) joonista puuduv SAMAS joonestiilis SVG-na ja lisa `components/brand` kausta; (3) kahtluse korral küsi tellijalt.

## Vastuvõtukontroll (tellija jaoks)

- Nuppude kasutuskohtades on `<GlassButton variant="...">`, mitte pikad korduvad utiliidiread ega kohalikud stiilid.
- Projekti sõltuvustes ei ole ikooniteeke ega komponenditeeke; kõik ikoonid pärinevad `components/brand` kaustast, joonestiil läbivalt ühtne.
- Pika sisuga vaadetel (vestlus, Töölaud) ei paista puhkeseisus riba; kerimisel ilmub õhuke triip ja kaob; klaviatuuriga saab kogu sisu läbi käia.
- Silmatest: iga klaasitükk tundub sama käe tehtud. Kui mõni element tundub "külalisena teisest rakendusest", on ravi primitiivis ja tokenites, mitte kohapealses paranduses.
