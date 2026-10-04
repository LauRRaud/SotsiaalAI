# Ühekordne build ja ühe protsessi avaldamine — 04.10.2026

Omaniku otsus: AI valib muudatuse riski järgi kontrollid; kogu lint, testikomplekt,
i18n ja alternatiivne build ei käivitu automaatselt. GitHubis ehitatud rakendust
serveris uuesti ei ehitata. Serveris töötab korraga üks frontend.

## Mõõdetud eelnev kulu

`209337bc` avaldamine: [quality-gate 37181349300](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37181349300)
243 s; [deploy 37181555704](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37181555704)
131 s. Esimese workflow algusest teise lõpuni 376 s ehk 6 min 16 s.
Põhitöös oli täislint 89 s, ühiktestid 34 s ja Turbopack build 46 s.
Paralleelne webpack build võttis 106 s. Server ehitas sama rakenduse uuesti.
Systemd journal kinnitas frontendi peatamise 09:02:11 ning käivitamise 09:03:03
(Europe/Tallinn): 52 s peatatud teenust.

## Rakendatud lahendus

- Üks GitHubi Linuxi tootmisbuild koos lukustatud sõltuvuste ja genereeritud
  Prisma kliendiga. Artefakt sisaldab ka RAG-i tööks vajalikke lähtefaile.
- Avalikud `NEXT_PUBLIC_*` väärtused on kopeeritud tegelikust serveri
  konfiguratsioonist faili `config/production-public-env.json`; saladusi ei kopeerita.
- Deploy kasutab õnnestunud workflow täpset SHA-d ja sama käivituse artefakti.
  Kontrollitakse transpordiräsi, build'i identiteeti, Node'i põhiversiooni,
  avalikku konfiguratsiooni ja seda, et hilinenud deploy ei paigaldaks vanemat koodi.
- Server teeb failide ettevalmistuse töötavat teenust muutmata. Serveris pole
  `npm ci`, lint'i, testikomplekti, Prisma generate'i ega tootmisbuild'i.
- Üks `sotsiaalai-frontend.service`: stop → konfiguratsiooni vahetus → start.
  Käivituse või töövalmiduse vea korral taastatakse eelmine konfiguratsioon.
  Ühe protsessi taaskäivitus võib põhjustada lühikese katkestuse.
- Muutumatu skeem ja migratsioonid jätavad andmebaasi migratsioonikäsud vahele.
  Muutunud migratsioonidel tehakse serveri tegelike lukkude/mahu eelhindamine ja
  rakendamine piiratud lukuaegadega. AI peab enne avaldamist kontrollima
  ühilduvust eelmise koodiga. Andmebaasi automaatset tagasimigratsiooni ei tehta.
- RAG-i kinnitatud plaan valmistatakse ette sama koodi jaoks ilma mudelikutseta;
  eelarve ja andmete väljasaatmise load ei muutu.
- Eelmise build'i staatilised failid säilivad juba avatud brauserilehtede jaoks.
  Säilivad praegune ja eelmine väljalase; vanu aktiivse tööprotsessi kaustu ei kustutata.
- GitHubi deploy-järjekorda täiendab serveri `flock`, et käsitsi ja automaatne
  avaldamine ei saaks korraga sõltuvusi või protsessi vahetada.

## Kohalik tõend

- Avaldamise sihttestid 12/12: ettevalmistuse, migratsiooni ja plaani vead jätavad
  senise teenuse puutumata; stop/switch/start/health/commit vead pööravad tagasi;
  teist frontend-protsessi ei käivitata esimese töötamise ajal.
- Muudetud JS-i sihitud ESLint, workflow YAML-i parsimine ja diffi kontroll: PASS.
- Kogu testikomplekti, kohalikku tootmisbuild'i ega webpack build'i ei käivitatud.
- Logo kohalik brauserikontroll 1280 × 720: laius 384 px (enne 512 px), üks logo.
  Mõlemad CSS-i mõõduvahemikud on 25% väiksemad. Omanik kinnitas, et logo on juba väiksem;
  pärast seda mõõte rohkem ei muudetud.
- [Logo ekraanipilt](evidence/sotsiaal-pro-home-smaller-2026-10-04.jpg).

## Käituse asukoht

Avaldatud versiooni tõde on `/home/ubuntu/apps/sotsiaalai-releases/active.json`
ja systemd `WorkingDirectory`, mitte vana andmehoidlaid kandva checkout'i HEAD.
Keskkonna versioonipõhine koopia asub root'i õigustega
`/etc/sotsiaalai/releases/<SHA>.env` failis. Uus avaldamine loeb põhisätted
ikka `/etc/sotsiaalai/frontend.env` ja `/etc/sotsiaalai/rag.env` failidest.
Ajastuste järgmised käivitused kasutavad sama väljalaske lähtekoodi ja sõltuvusi;
taimereid deploy ei aktiveeri.

Käsitsi `npm run deploy:server` kohalikus ajakohases checkout'is käivitab GitHubi
sama ehitus- ja avaldamisraja. Olemasoleva õnnestunud build'i kordusavalduseks
kasutatakse `deploy` workflow'i `run_id` sisendit. Vana serveri checkout'i
deploy-skripti ei kasutata.

## Tootmises mõõdetud tulemus

Avaldatud commit: `a154e98daa34d8166f9c5f649a549d374b3b22b1`.
[Build 37183564135](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37183564135)
ja [deploy 37183716766](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37183716766)
läbisid. Build: 06:42:01–06:45:08 UTC; deploy: 06:45:09–06:46:55 UTC.
Kokku 294 s ehk 4 min 54 s (enne 376 s). GitHubi järjekord, checkout ja
artefakti pakkimine/transport kuuluvad sellesse aega; kogu aeg ei ole katkestus.

Deploy logis: artefakti räsi OK; migratsioonid `none`; vestlusplaan `current`.
Teenuse peatamine algas 06:46:46.250 UTC; uus versioon kinnitati aktiivseks
06:46:49.848 UTC. Systemd stop/start on mõlemad sekundi 09:46:46 sees.
Välise `/api/health` mõõtmise 180 päringust (ligikaudu kord sekundis
06:46:07–06:49:08 UTC) üks tagastas 502, teised 179 tagastasid 200.
[Toorandmed](evidence/release-health-2026-10-04.json).

Systemd `WorkingDirectory` ja `active.json` vastasid build'i SHA-le; porti 3000
kuulas üks next-server protsess, `NRestarts=0`. Eelmise lehe CSS
`/_next/static/chunks/0fqbblozrd9_r.css` vastas pärast avaldamist 200.
Tootmise brauseris laadis üks logo, 1280 px vaate laiusel 384 px lai.
Autenditud kasutaja töövood ja päris migratsiooni rakendamine on selle muudatuse
puhul `NOT_PROVEN`; päris kasutajaandmeid ei kasutatud testimiseks.

Esimeses jooksus kulus gzip'i vaiketasemega pakkimisele 50 s. Järgmiseks
avalduseks muudeti pakkimine `gzip -1` peale; sama tar/gzip käsu pakkimise ja
lahtipakkimise sihtkontroll ning ESLint läbisid. Kogu projekti uut pakkimisaega
pole veel mõõdetud. See CI tööriista ja dokumentatsiooni täpsustus ei vaja
juba avaldatud rakenduse uuesti ehitamist ega uut taaskäivitust.
