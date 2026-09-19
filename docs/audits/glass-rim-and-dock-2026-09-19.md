# Klaasiserva ja doki kerimise kontroll — 19.09.2026

## Ulatus

Lähtekoht `bbdc96c36` / kood `68fbb0b7e`. Kohalik Chromium,
`http://localhost:3001`, eraldi brauserikontekst. Tootmisandmeid ega päris
kasutaja kontot ei kasutatud. Hilisem avaldamiskontroll on kirjas lõpus.

## Klaas

Viimane muudatus oli asendanud varasema materjali õhukese ühetoonilise joonega,
kuid säilitanud sama maski ja 3D-projektsiooni. See ei olnud serva vea parandus.

Fikseeritud `rotateX(3deg) rotateY(-3deg)` katse näitas astmelist serva ka
ilma liikumiseta. Võrdluses kontrolliti maski asendamist border'iga,
läbipaistvat outline'i, backface-visibility't, parent preserve-3d'd, overflow'd,
clip-path'i ja kihtide eraldi silumist. Ainult mask ei osutunud põhjuseks:
terava õhukese rasterserva astmed säilisid ka border'iga. Kihi geomeetria
muutmine ei kõrvaldanud neid. Subpiksliline eelfilter pehmendas astmeid.

Taastatud on `e7901143f` materjali 0.8px gradientserv, sisemised peegeldused
ja neli inset-helki. Täite `rgba(170,170,170,0.085)` toon/alfa ei muutunud.
Väliseid varje ja kahekordset alumist joont ei taastatud. Materjal asub
kaardi pseudokihtidel; neile rakendub 0.5px eelfilter enne pööramist.
Kaardi ja selle teksti computed filter on `none`. Kõrgkontrastis on eelfilter
väljas. Kaardi liikumisvalemid, kiirused ja tausta liikumine on säilinud.

Lõplikus päris karussellis kontrolliti hiire asendit kaardi üla- ja alanurgas
ning väljaspool. Transform muutus ja taastus identity'ks; tausta- ning
servagradientide computed väärtused püsisid täpselt samad.

Tõendipiir: kohalik katse toetab rasterserva aliasing'u diagnoosi ja silumise
leevendavat mõju. See ei tõenda kogu kasutaja seadmes nähtud ajalise väreluse
kadumist kõigil GPU-del, brauseritel ja suumidel. Päris iOS/GPU rada:
**NOT_PROVEN**. Pildivõrdlused: `output/playwright/rim-fixed-*.png`,
`rim-restored-*.png`, `rim-final-upper.png`, `rim-final-lower.png`.

## Paneeli laienemine

Põhjused:

- Kontopere kõrgus oli fikseeritud 33rem. Doki reservi vähenemine keskjoondas
  sama suure kasti allapoole. Nüüd lisandub vabanev reserv kasti kõrgusele.
- Manustatud töölehe kerimisomanik on `.workspace-dashboard-panel`, mitte
  `.panel-body`. Doki scroll-kuulaja kasutab nüüd capture't ja aktsepteerib
  ainult paneeli enda või nähtava manustatud tööpaneeli kerimist.
- Manustatud töölehe ja heaolu ülevaate fikseeritud kõrgus ei kasvanud
  dokireservi võrra. Kõrgus ja alumine polster sõltuvad nüüd samast arvust.
- Päris dokumentide komponendis andis wheel(65) kaks scroll-sammu: 65 ja
  130. Reacti passiivne wheel-kuulaja ei tühistanud brauseri vaikekerimist.
  Manustatud tööpaneeli käsitsi kerimine kasutab nüüd kohalikku
  `passive:false` kuulajat; sama sammu ei rakendata kaks korda.

1440 × 900, mõõdetud kogu 700ms reserviülemineku vältel:

| Pind | Algkõrgus | Laiendatud kõrgus | Ülaserva suurim nihe |
| --- | ---: | ---: | ---: |
| Kasutusjuhendi päris leht | 765px | 827.39px | 0.016px |
| Kontopere raami fixture | 528px | 590.39px | 0.016px |
| Manustatud tööpaneeli fixture | 702px | 764.39px | 0.016px |
| Minu kasutuse päris komponent, API näidisandmed | 528px | 590.39px | 0.016px |
| Dokumentide päris manustatud komponent, API näidisandmed | 702px | 764.39px | 0.016px |

Päris dokumentide komponendi `wheel(100)` keris pärast parandust täpselt
100px, dokk taandus ja paneel kasvas. Üles kerimine ja lõppu jõudmine tõid
doki tagasi. Sisemise textarea programmiliselt tekitatud scroll ei peitnud
dokki. 844 × 390 vaates kasvas manustatud paneel 246 → 302px; ülaserv püsis
40.797px. Mobiili täisekraanilt eemaldati pärandunud 47.5rem kõrguselagi:
390 × 844 vaates on paneel enne ja pärast kerimist 390 × 844px, ülaserv 0px.

API-vastused asendati ainult eraldi testikontekstis: näidissessioon
`ui-test@example.invalid`, kasutuse kuus näidismõõdikut ja tühjad dokumendiloendid.
See tõendab UI-komponente, mitte autentimise ega tootmise API rada.
Dokumentide otsemarsruudi serveri autentimisrada ja iga heaolutööriista eraldi
läbimine: **NOT_PROVEN**. Ühine raam ja tegelik manustatud kerimisrada kontrollitud.

## Kontrollid

- `npm run lint`: 0 viga, kaks varasemat hoiatust (`CurvedInput`, `TiltedCard`).
- Muudetud JSX-i sihtlint: läbis.
- Lõplik `npm run build` koos `i18n:check`-iga: läbis (`TZ=UTC`).
- `git diff --check`: läbis.

## Avaldamine

19.09 omaniku korraldusel avaldatud `3a458822d25ba5ca2e3f2b9517bdb441c077e8fa`
projekti `deploy:server` kaudu. Serveri tootmisbuild ja i18n-kontroll läbisid,
ootel andmebaasimigratsioone ei olnud. Frontend on `active`, avaleht vastab
HTTP 200-ga ja serveri tööpuu oli puhas. Build ID:
`548f285a-99c6-4594-a773-4d000c7ee290`.

Avaliku avalehe viiest CSS-failist kontrolliti uue `--room-dock-released`
arvutuse ja materjali 0.5px silumise olemasolu. Kasutaja GPU visuaalne kontroll
ning autentimist vajavate tootmislehtede läbimine jäävad NOT_PROVEN.
