# Töölaua mobiilisvaibi järelkontroll — 20.09.2026

## Ulatus ja leid

Omanik kinnitas, et viga puudutab menüükaartide vahetamist, mitte avatud
tööriista sisukerimist. Algseisu HEAD, origin/main ja server olid
`2d5bfea5b966a68f99ae28fd522c4bbff2283421`; serveri tööpuu puhas ja frontend aktiivne.

390 × 700 Chromiumi puutevaates läbisid Töölaud ja Tööheaolu kogu kaardiringi.
844 × 390 vaates 550 px sõrmevedu liigutas kolm kaarti. Enne parandust sai
iga saabuv kaart `data-warp=1`, arvutatud transitionProperty oli ainult
`opacity` ja kaart hüppas kohe lõppasendisse. Kontroll `abs(uus - vana) > 1`
ei eristanud mitme kaardi sammu ringi tagaküljel ümber tõstetavast kaardist.

GlassCarousel võrdleb uut asendit oodatud `vana - samm` asendiga: ainult
ringi teisele poole mähitud kaart jätab transformi ülemineku vahele.
Kaartide arv, navigeerimine, dokk ja töölaua hiirepaigutus ei muutu.

## Tõend

Chromiumi päris touchStart/touchMove/touchEnd sündmused CDP kaudu:

- 390 × 700: 190 px vedu, üks kaart mõlemas suunas, sh viimane ↔ esimene.
- 844 × 390: 550 px vedu, kolm kaarti mõlemas suunas, sh ringiõmbluse ületamine.
- SOCIAL_WORKER: 24 kontrolli Töölaua ja Tööheaolu menüüdes.
- ADMIN, effectiveRole SERVICE_PROVIDER: 12 kontrolli Töölaua menüüs.
- Kõigis õige keskkaardi indeks, keskkaardil data-warp=0 ja transitionProperty
  `transform, opacity`; URL ei muutunud ega avanenud soovimatu tööriist;
  window.scrollY jäi 0.

Enne/pärast tõendid ja käivitatavad ajutised sihtkontrollid on
`output/playwright/workspace-landscape-{before,after}.log`,
`workspace-gesture-check.cjs/log`, `workspace-admin-gesture-check.cjs/log`.
Fikstuurid asendavad brauseris API ja seansi vastused ning menüütee valitakse
history.pushState abil; tootmiskasutajate andmeid ei loeta.

See tõendab pika svaibi animatsioonivea parandust. Omaniku telefonis teatatud
täpse tõrke samasus selle veaga ning päris iOS 27 Safari/PWA runtime on
**NOT_PROVEN**. Autenditud serverimarsruutide läbimine on **not_run**.
Omanik palus edasise kontrollimise talle jätta; väljalaskejärgset brauseritesti
ei käivitata, tootmise mobiilne kasutajarada jääb **not_run**.

## Väljalase

Muudetud JSX-i eslint, täislint (kaks olemasolevat hoiatust), i18n ja
tootmisbuild läbisid. Esimese täislindi kaks viga olid varasema kontrolli
ajutise skripti puuduv process-globaal; parandatud skriptiga täislint läbis.
git diff --check ja stage’itud diffi kontroll läbisid. `npm run deploy:server` lõpetas edukalt ja avaldas `17ce8af9`.
Serveri build ja i18n läbisid, ootel migratsioone ei olnud; skripti
lõpus frontend active. Väljalaskejärgne brauseritest jäi omaniku soovil ära.

## Järelparandus: animatsioon tõksub ka pärast esimest väljalaset

Omaniku uus tagasiside: kaardid vahetuvad, kuid animatsioon tõksub ja on
imelik. Eelmine animatsioonilipu parandus ei lahendanud kogu tõrget.

Koodist leitud täiendavad üleminekukohad:

- endDrag nullis --drag ja eemaldas data-dragging, seejärel luges offsetWidth.
  See geomeetrialugemine võis arvutada vana kaardivaliku tagasiliikumise enne
  uue valiku renderdust. Mõõtmine toimub nüüd enne stiilimuutusi.
- Kaardipositsioonide olek uuendati useEffect-is, pärast võimalikku vahekaadrit.
  useLayoutEffect teeb asendiuuenduse enne brauseri järgmist joonistust.
- Pikk töölauakomplekt hoidis kõiki peidetud klaaskaarte transform-kihtidena.
  Nähtava rea kõrval jääb üks ettevalmistatud kaart kummalegi poole;
  kaugemad kasutavad visibility:hidden ja will-change:auto.

Need on koodi põhjal tehtud parandused. Omaniku soovil ei käivitata uusi
brauseriteste; iOS-i sujuvus ja selle muudatuse visuaalne runtime on
**NOT_PROVEN**. Varasema jaotise brauseritulemused ei tõenda seda järelparandust.

Järelparanduse sihitud eslint, täislint (samad kaks olemasolevat hoiatust),
i18n ja tootmisbuild läbisid. git diff --check läbis.
`npm run deploy:server` avaldas `cc96c9e1`, lõpus frontend active ja
serveri Git-staatus puhas. Uusi brauseriteste ei käivitatud omaniku soovil.
