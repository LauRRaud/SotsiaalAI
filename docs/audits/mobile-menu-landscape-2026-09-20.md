# Mobiilimenüü, ligipääsetavuse vaade ja PWA ülaserv — 20.09.2026

Seis: avaldatud omaniku 20.09 loal, kood `4f78378b`.
Mobiiliparandusele lisandus sisestusväljade fookuse tausta ühtlustamine.
Varasemad ülesandega mitteseotud tööpuu muudatused säilitatud.

## Põhjused ja lahendus

- Karusselli nooled kadusid alla 768 px laiuses, kuigi telefon oli
  rõhtasendis. Rõhtvaate puutereegel näitab nüüd mõlemat 48 px noolt ning
  arvestab vasaku ja parema turvaalaga.
- Kaardi kõrgus ja keskpunkt ei arvestanud doki tegelikku kõrgust ega
  alumise turvaalaga. 844 × 390, alumine turvaala 21 px: varasema
  geomeetria ajutine taastamine brauseris andis **16,02 px kattumist**;
  parandatud geomeetria jätab **12,04 px vahet**.
- Mobiilidoki klaasi alumine polster võib ulatuda turvaalasse, nupud
  jäävad sellest ülespoole. Turvaalaga telefonis liigub doki alaserv
  rõhtvaates 12,32 px ja püstvaates 17,12 px madalamale. Rõhtvaate doki
  nuppude polster on mõlemal pool 768 px murdepunkti sama.
- Ligipääsetavuse vaate dokk kasutab sama alumist asukohta; lava ja
  keelevalikute kerimispiir lähtuvad nähtavast kõrgusest, turvaalast ning
  doki ruumist. Madalas rõhtvaates on valikute polster ja vahed väiksemad,
  puutesiht jääb vähemalt 44 px. „Keri” tekst ja sügavusraamide animatsioon
  asuvad mobiilis paremal; püstvaates doki kohal, rõhtvaates valikute kõrval.
- Peidetud ülariba oli nihutatud turvaala alla, kuid selle ülemine
  klaasi- ja backdrop-kiht ulatus tagasi olekuriba taha. Puutevaate
  ülariba lõigatakse nüüd turvaala alumiselt piirilt; avatud paneeli
  küljed, allserv ja nupud jäävad nähtavale. See eemaldab lehe enda
  joonistuse olekuriba alt; kasutaja kirjeldatud iOS-i musta udu täielik
  kadumine vajab päris seadme kinnitust.

## Kohalik tõend

Päris rakendus pordil 3000, anonüümne eraldatud brauserikontekst;
tootmiskasutajate andmeid ei kasutatud. Saabumise ja eelistuste küpsised
seati ainult kohalikus testbrauseris avastseeni vahelejätmiseks.

Chromiumi puutevaade, turvaalad CDP emulatsiooniga:

| Vaade | Mõõdud | Tulemus |
|---|---|---|
| Karussell | 844 × 390; 740 × 320; 667 × 280; 932 × 430 | Kaardi ja doki vahe 12,03–12,05 px; mõlemad 48 px nooled ekraanil; rõhtülevool puudub |
| Karusselli režiimivõrdlus | 844 × 390 ja 740 × 320 | `data-display-mode=browser/standalone` korral kaardi, noolte ja doki geomeetria identne |
| Karusselli püstvaade | 390 × 844, turvaalad 47/34 px | Kaart ning dokk mahuvad ekraanile |
| Keelevalikud | 844 × 390; 740 × 320; 667 × 280; 390 × 844; 320 × 568 | Kõik kolm valikut täielikult nähtaval; valikugrupil vertikaalne lõikamine puudub; puutesiht vähemalt 44 px |
| Keelevalikute rõhtvaade | 740 × 320 / 667 × 280 | Viimase valiku ja doki vahe vastavalt 29,34 / 15,83 px |
| Parempoolne kerimisvihje | Samad viis mõõtu | Vihje ei kattu valikutega; vihjelt alustatud päris puutesündmustega üleslibistus viis Keele jaamast Kontrasti jaama |
| Ülariba | 390 × 844, ülemine turvaala 47 px | Avamine töötas; avatud nelja juhtnupu tabamustest läbis; üleslibistus sulges |

WebKit 26.6, iPhone 13 emulatsioon, 740 × 320: karusselli mõlemad nooled
nähtaval, kaardi ja doki vahe 12,03 px. Parem nool viis „Logi sisse” →
„Meist”, vasak nool tagasi.
Sama WebKiti mõõduga ligipääsetavuse vaates olid kõik kolm keelenuppu
tervikuna nähtavad, dokini jäi 34,93 px ja kerimisvihje oli paremal;
turvaala emulatsiooni selles WebKiti kontrollis ei kasutatud.

Visuaalselt vaadatud Chromiumi menüü rõht- ja püstvaade ning
ligipääsetavuse 740 × 320 vaade. Ajutised mõõtmised/pildid:
`output/playwright/menu-metrics.log`, `a11y-metrics.log`,
`menu-*.png`, `a11y-*.png` ning `menu-webkit-740x320.png`.

Kontrollid: `npm run lint` läbis kahe olemasoleva hoiatusega
(`CurvedInput.jsx`, `TiltedCard.jsx`); `npm run build` sisaldav
`i18n:check` ja tootmisbuild läbisid. `git diff --check` läbis.
JS/JSX-i, tõlkeid, skeemi ega impordipiire ei muudetud.

## Tõendipiir

- Päris iOS PWA olekuriba, komposiitor ja musta udu kadumine: **NOT_PROVEN**.
  Standalone-atribuudi ning turvaalade emulatsioon ei ole installitud PWA.
- Autenditud rollide menüürada: **not_run**; kontroll kasutab sama jagatud
  karusselli anonüümses vaates.
- WebKiti konsoolis esinesid kohaliku päritolu Cloudflare RUM-i CORS-vead
  ja tundmatu `interactive-widget` viewport-võtme teade; need ei takistanud
  paigutuse ega noolte kontrolli.

## Sisestusväljade fookuse järelparandus

`--input-bg-focus` viitab nüüd `--input-bg-hover` väärtusele nii tavalises,
kõrgkontrasti kui ka vähendatud läbipaistvuse režiimis. Fookuseääris ning
servakuma säilivad; kirjutamisel täide heledamaks ei muutu.
Chromiumi päris rakenduse CSS-iga eraldatud stiilifiksuur kontrollib
`Input`-i väljastatava märgistusega PIN-välja ning tekstiala: hover →
klõps → sisestamine → kursori eemaldamine. Kõigis kolmes režiimis peavad
hoveri ja kirjutamise arvutatud taustavärvid kattuma. Kontopaneeli eksporti
ei käivitata. Lõpliku CSS-i kohalik build koos i18n-kontrolliga läbis;
JS-kood jäi eelneva läbitud lindi järel muutmata.

Kõik kuus stiilikontrolli läbisid nii kohalikult kui avalikul lehel.
Tavarežiimis jäi taustaks `rgba(0, 0, 0, 0.12)`, kõrgkontrastis
`rgba(0, 0, 0, 0.92)` ja vähendatud läbipaistvusega
`rgba(39, 39, 39, 0.96)`. Fookuseääris säilis.

## Avaldamine

`npm run deploy:server` lõpetas edukalt. Serveri build ja i18n läbisid;
migratsioone ei olnud rakendada. Serveri Git-puu oli puhas ja koodi HEAD
`4f78378bf499b315332821630a3dc79e618e7e20`, frontend aktiivne ning
`http://127.0.0.1:3000` ja `https://sotsiaal.ai` vastasid HTTP 200.
Avaliku lehe laaditud CSS-is kontrolliti fookusvärvi viidet, mõlema
mobiilimenüü uusi paigutusmuutujaid ning ülariba lõikereeglit.
Avalik brauserikontroll kasutas ainult anonüümset stiilifiksuuri;
tootmiskasutaja sisu ei loetud ega päris toiminguid saadetud.

## iOS 27 ja ülapaneeli järelparandus

Omaniku 20.09 uued pildid näitavad endiselt olekuriba alla ulatuvat udu;
omanik kinnitas iOS 27 kasutamist. Eelmine clip-path-katse ei lahendanud
seda probleemi. Git-ajalugu kinnitab, et enne `7f4365d50` kasutati tumedas
teemas `black-translucent` olekuriba. Hilisem `black` määrang lisati ainult
JavaScriptiga, serveri HTML-i PWA paigaldusmetaandmed puudusid.

`app/layout.js` väljastab nüüd `appleWebApp` metaandmed ja `black` olekuriba
juba serveri HTML-is. Eemaldatud on mõlemad olekuriba meta kirjutused
teemaalgatusest ja AccessibilityProviderist: installiseadistus on püsiv
ning ei teki dubleerivaid meta-elemente. Teema `theme-color` jätkab tööd.
Apple'i [metaandmete dokumentatsioon](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)
kirjeldab `black` olekuriba all paiknevat sisu, `black-translucent` aga
olekuriba taha ulatuvat sisu. Installitud vana PWA olek pole siin mõõdetav;
avakuvale uuesti lisamine võib olla vajalik. Päris iOS 27 hägu kadumine
on endiselt **NOT_PROVEN**, mitte brauseritestiga tõendatud.

Ülapaneeli vanema clip-path eemaldati: see tekitas backdrop root'i ja
takistas olemasoleval 14 px backdrop-filtril tagumiste kaartideni jõudmist.
Filtrikihi enda ümar piirang säilib. Chromiumi 844 × 390 puuterežiimis
avamine läbis; arvutatud hägu `blur(14px) saturate(1)`, vanema clip-path
`none`, kõigi nelja nupu filter `none`. Visuaalne triibulise tausta võrdlus
näitas uues variandis hajutatud tausta, vana lõikereegliga teravaid triipe.
Pildid: `output/playwright/quickbar-blur-{fixed,stripes,stripes-old}.png`.

Sisenen-nupu hover/focus-visible ei määra enam tähevahet ega teksti taanet:
mobiili `.26em` säilib, senine `.32em` ülekirjutus põhjustas laiusemuutuse.
Chromiumi 390 × 844 päris puutesündmustega enne vajutust, vajutuse ajal ja
vabastamisel: 207,796875 × 54,453125 px; font 28,08 px, tähevahe/taane
7,3008 px kõigis kolmes olekus. Sisenemine läbis. Kontroll kasutab
anonüümset seanssi eelmääratud keeleeelistusega; esimene ilma eelistuseta
katse aegus ligipääsetavuse esmakülastuse dialoogi tõttu.

HTML-vastuses enne JS-i üks `apple-mobile-web-app-status-bar-style=black`,
elavas DOM-is samuti üks. Muudetud JSX-i sihitud eslint läbis, täislint
läbis kahe olemasoleva hoiatusega (CurvedInput ja TiltedCard). Lõpliku CSS-i
`npm run build` koos i18n-kontrolliga läbis. `git diff --check` läbis.
Kohaliku Cloudflare RUM-i CORS-vead ei puuduta neid radu.
