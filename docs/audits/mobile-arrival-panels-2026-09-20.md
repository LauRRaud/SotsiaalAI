# Mobiili saabumine, kerimisvihjed ja paneelid — 20.09.2026

## Muudatus

- Ülapaneeli taustahägu 14 → 6 px. Kõrgkontrast ja vähendatud läbipaistvus
  jätavad filtri välja; muud klaaspinnad ei muutu.
- Avakuva SVG-logo ilmub pildi laadimisel, sõltumata metallikihi WebGL-ist.
  Metall ootab oma stabiilset kaadrit. Sisenen käsitleb mobiili lõpetatud
  koputust pointerup-is, sest esimene sünteetiline klõps võib kaduda.
  Kõrvale lohistamine ega pointercancel ei käivita seda rada. Animatsiooni
  varuootus lühenes 6 sekundilt 1,2 sekundile; kordussisendit tõkestab
  olemasolev enteringRef.
- Mobiili saabumise kerimisikooni skaala .84 → 1.1 ja silt .9 → 1.05 rem.
  Keelemodaali vihje skaala .85 → 1.1, silt 1 rem. Püstvaates keskel,
  rõhtvaates paremal; madala rõhtvaate valikute mahutamine säilib.
- Tavalise PanelFrame'i kest on fikseeritud vaateavasse; kerimine kuulub panel-body
  sisse. Dokumendi välimine kerimine on paneeli olemasolul suletud, mobiili
  raami lisamarginaal eemaldatud. Kompaktsed kaardid, sh Ruumid, ei peida
  kerimisel kiirmenüüd ega muuda selle kaudu kaardi asukohta.
  Vestluse ja lõuendite eraldi kõrguse/klaviatuuri käsitlus jääb puutumata.
- Tööheaolu kasutab põhimenüüga sama karusselli ka desktopis. Lai töölaua
  sügavuslaud rakendub ainult täpse osuti ja hoveriga seadmel. Puutevaated
  kasutavad kõikjal sama karusselli. Vana /tooheaolu menüütee säilitab
  senised ligipääsukontrollid ja suunab /toolaud/tooheaolu kaardimenüüsse.

## Tõend

Chromiumi mobiilivaade 390 × 700 ja WebKiti puutevaade:
metallitekstuuri päring blokeeritud, logo muutus nähtavaks enne puudutust;
metalli opacity oli 0. Tavaline click blokeeriti; üks päris tap viis
loori gone-olekusse vastavalt 2698 ja 2789 ms jooksul.

390 × 700 Ruumide katse 12 väljamõeldud ruumiga: sisemine scrollTop 180,
window.scrollY 0, kaart enne/pärast x=11,703125, y=87,0078125,
366,59375 × 469,984375 px; dockRecessed=0. Meist-lehe samas mõõdus
täisraam 390 × 700 püsis x=y=0 ja sisemine scrollTop oli 180.
1440 × 900 Meist-vaates sisemine scrollTop 200, väline 0;
ülaserva muutus ainult 0,015625 px, doki taandumisel kasvas raam allapoole.

390 × 700, 320 × 568 ja 844 × 390 keelemodaal: vihje keskjoon püstasendis
täpselt ekraani keskel, rõhtasendis paremal. Vihje ei kattunud viimase
keelevalikuga; ikooni/sildi ühiskast 66 × 89,75 px. Pildid visuaalselt
vaadatud: output/playwright/hints-followup-{390,320,844}.png.

Mobiili puutesvaip: põhimenüü Ruumid → Töölaud; töölaua komplekt
Pöördumised → Abisoovid; tööheaolu Kiirkontroll → Ülevaade. Kõik kasutasid
data-desk=0. Desktopi tööheaolu 1440 × 900: data-desk=0 ja hiirerullik
Kiirkontroll → Ülevaade. Pilt wellbeing-desktop-followup.png kontrollitud.
Katse kasutab ainult brauseris asendatud session-/API-vastuseid ning
history.pushState menüütee valimiseks; päris kasutajakontosid ega sisu ei
loetud. Tegelik autenditud serverimarsruutide läbimine on **not_run**.

/tooheaolu marsruudifunktsiooni eraldatud kontroll päris funktsioonikoodiga
ja sõltuvuste fikstuuridega: anonüümne 401 → sisenemine, vale roll →
vestlus, lubatud aktiivne ja aegunud 402 tellimus → ühine kaardimenüü.
Kõik neli läbisid; õiguskontrollide päris andmebaasiruntime ei olnud katses.

Ülapaneeli arvutatud filter blur(6px) saturate(1); kõrgkontrastis ja
vähendatud läbipaistvusega none. Sihttestid ja ajutised skriptid asuvad
output/playwright/*followup* ning panel-menu-check.cjs/log.

Päris iOS 27 seadme Safari/PWA komposiitor on **NOT_PROVEN**.
WebKiti emulatsioon ei ole installitud PWA. Kohaliku Cloudflare RUM-i
CORS-teated ei mõjutanud sihtkontrolle.

Lõpliku CSS-iga WebKiti Ruumide kontroll: kaart enne/pärast x=11,5,
y=87, 366,59375 × 469,984375 px; sisemine scrollTop=180, väline=0,
dokk nähtav. Esimene mõõtmine tehti enne fikstuurandmete valmimist;
12 ruumi renderdumise järel korratud kerimiskontroll läbis.

Muudetud JS/JSX-i sihitud eslint, täislint (kaks olemasolevat hoiatust
CurvedInput/TiltedCard), i18n ning lõpliku piiratud CSS-iga tootmisbuild
läbisid. git diff --check ja stage'itud diffi kontroll läbisid.
