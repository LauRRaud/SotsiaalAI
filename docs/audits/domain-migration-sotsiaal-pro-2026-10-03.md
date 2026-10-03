# Platvormi üleminek sotsiaal.pro domeenile — 03.10.2026

Põhiaadress on **https://sotsiaal.pro**. Omanik tellis platvormi viimise uuele
domeenile. Rakenduse muudatus `769cf4e408c01cf5c505823cb3998bbdbbdfcee1` läbis
[quality-gate'i](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37124447451)
ja [automaatse tootmispaigalduse](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37124638308).
Serveri Git HEAD ja aktiivne frontend mõõdeti pärast paigaldust; checkout oli puhas.

## Muudatus ja ühilduvus

- `NEXT_PUBLIC_SITE_URL`, `APP_URL`, `NEXTAUTH_URL` ning Maksekeskuse tagasiside-
  ja tagasipöördumisaadressid kasutavad serveris uut domeeni. Avalikud canonical-,
  Open Graph-, Organization-, sitemap- ja robots-viited kasutavad sama aadressi.
- Avalik kontakt on `info@sotsiaal.pro`; Porkbunis on olemas suunamine senisele
  `info@sotsiaal.ai` postkastile. SMTP saatja ja omaniku maksete teavitusaadress
  jäid seniseks; Message-ID-d ja kirjade idempotentsus ei muutunud.
- DNS-i juurdomeen osutab samale serverile; lisati `www` CNAME põhidomeenile.
  Let's Encrypt väljastas mõlema nimega sertifikaadi, kehtiv kuni 01.01.2027.
- `sotsiaal.ai`, mõlema domeeni `www` ja HTTP kasutavad tavapärastel lehtedel
  308 ümbersuunamist põhidomeenile. Tee ja päring säilivad.
- Vana domeeni API-d, `/valitoo`, teenusetööline, manifest, ikoonid ja Nexti
  varad jäävad sama origini kaudu kättesaadavaks. See säilitab makseteenuse
  POST-tagasiside ja vana brauseri Välitöö märkmete sünkroonimise võimaluse.
  Nginxi varasem 25 MB piir ja puhverserveri päised säilisid.
  **Seda erandit ei eemaldata enne kohalike saatmata märkmete ülemineku lahendamist.**
- Videoruumi ja TURN-i seniseid alamdomeene ei muudetud. Auth-saladused,
  kasutajakontod ja andmebaas ei muutunud. Uuel domeenil tuleb uuesti sisse logida;
  brauseri küpsised, eelistused ja kohalikud Välitöö märkmed on origini põhised.
- Visuaalne logo ja ettevõtte juriidiline nimi **SotsiaalAI OÜ** säilisid.
  Brändikavandite valik on eraldi pooleliolev töö.

## Kontrollid

`tests/site-url.test.mjs` tõendab uut vaikimisi origini, canonical'i ja Open Graphi
kooskõla, sitemap'i ja robots'i aadresse ning localhosti eelvaate säilimist.
Muudetud JS/JSX-i sihitud ESLint, tõlgete kontroll ning diffi kontroll läbisid.
CI-s läbisid kogu unit-komplekt, lint, i18n ning mõlemad production-build'id.

Tootmises läbisid:

- HTTPS, `/api/health`, avaleht, Organization JSON-LD, canonical, 10 sitemap'i
  aadressi ja robots. Ettevõtte nimi jäi samaks.
- Authi providerite URL-id kasutavad uut domeeni; CSRF-küpsis on Secure ja
  HttpOnly; küpsisteta sessioon on tühi. Testis ei logitud sisse päris kasutajana.
- Seitse HTTP/HTTPS ning vana/uue `www` ümbersuunamist koos tee ja päringuga.
- Vana domeeni vigane webhook annab 400 ilma ümbersuunamiseta; vigane callback
  annab 302 ja seejärel jõuab 308-ga uuele tellimuslehele. Makset ei algatatud.
- Vana Välitöö kest ja räsitud vara, teenusetööline, manifest ning auth/session
  jõuavad rakenduseni; küpsisteta Välitöö API vastab 401, mitte ümbersuunamisega.
- Nginxi konfiguratsiooni kontroll ning mõlema domeeni sertifikaatide uuendamise
  dry-run. Serveri saidifailid klapivad üle vaadatud Nginxi mallidega.

Masinloetav tõend: [domain-migration-sotsiaal-pro-2026-10-03.json](evidence/domain-migration-sotsiaal-pro-2026-10-03.json).

**NOT_PROVEN:** päris kontoga sisselogimise lõpuleviimine, e-posti tegelik
edastus, allkirjastatud päris makse või korduvmakse, kaamera/mikrofoniga videokõne
ning olemasolevate kohalike Välitöö märkmete tegelik sünkroonimine. Kontrollid ei
lugenud tootmiskasutajate sisu ega saatnud päris kirju.

## Maksekeskuse konto kooskõlastus — avatud omaniku tegevus

03.10 loeti olemasoleva poe Üldseadeid. Poe nimi ja URL kasutavad veel vana domeeni;
`Poe domeen` on kirjutuskaitstud ja sisaldab seniseid `.ai` nimesid.
[Maksekeskuse ametlik KKK](https://maksekeskus.ee/kkk/) nõuab domeenivahetusest
teatamist `support@maksekeskus.ee`-le ning lepingu lisa vormistamist. Uue domeeni
kooskõlastus ei ole tõendatud. Omanikule anti teavituskirja tekst ning uued
kasutajatoe, teenusetingimuste ja privaatsuspoliitika aadressid. Konto seadeid,
makseandmeid ega API-võtmeid ei muudetud ja kirja ei saadetud.

## Taastamine

Enne muudatust säilitati serveris piiratud õigustega kaustas
`/etc/sotsiaalai/domain-migration-2026-10-03/` senine frontend.env, rag.env ja
Nginxi saidifail. Taastamisel tuleb taastada URL-seaded ja vana Nginxi konfiguratsioon,
kontrollida `nginx -t` ning taastada nende URL-idega sobiv rakenduse build;
ainult protsessi restart ei asenda build'i sisse kirjutatud avalikku aadressi.
Kohalik varasem pooleliolev töö säilitati Git stash'is ja `.git` varukoopias.
Järgnev ainult Nginxi ja tõendite commit ei vaja rakenduse kordusbuild'i: Nginx
kontrolliti ja rakendati otse ning rakenduskood on eespool nimetatud rohelises reliisis.
