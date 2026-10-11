# Eetikaruumi esimese töövoo kontroll — 11.10.2026

Ulatus: kohalik `/eetikaruum`, olemasoleva assistendi ühendamine ja omaniku privaatne
kovisioonimustand. Kohalik `main`; kasutaja varasemad muudatused säilitatud.
Eksperdikanalit ei avatud, ESTA metoodikat ei kopeeritud. GitHubi build ja
automaatne deploy läbisid; aktiivne väljalase 18.58 EEST:
`c389c0966afe86401c298d3d945e31074269d401`. Tootmises autentitud tervikrida:
**NOT_RUN**; kohalik autentitud rada ja tootmise anonüümne ligipääsupiir kontrollitud.

## Käitumine ja privaatsuspiir

Vabatahtlikud väljad: küsimus, faktid, tõlgendused, osapoolte vaated, õigused,
enda roll, valikud, puuduv info, järgmine samm/ülevaatamine. Salvestamine ei kasuta
AI-d. Omanikupõhine `EthicsReflection` tabel, viimase versiooni säilitus kuni
kustutamiseni; konto kustutus kaskaadiga. Rolli/tellimuse lõppedes säilivad enda
kirje lugemine, eksport ja kustutus. Organisatsiooni eksport välistab need kirjed.

Omanik koostab ja salvestab eraldi kuni 2800 märgise väljamineva teksti. Enne
valitud toimingut nõutakse identifikaatorikontrolli ja inimese kinnitust. AI saab
ainult selle teksti ning eetilist arutlemist paluva juhise. Olemasolevad
`/api/chat/pilot` ja `/api/chat` hoiavad vestluse, õigused, kvoodi ning allikaviited.
Korduskatsel kasutatakse sama vestluse- ja pöördevõtit kuni lehe sulgemiseni.
AI vastus ei täida refleksioonivälju automaatselt.

Kovisioon luuakse ühes tehingus omaniku privaatse sessioonina; ainus osaleja on
omanik. Koopia läheb 2. etapi privaatsesse `case_anchor`-isse, avalikud väljad on
tühjad ja pealkiri üldine. Kutseid ei saadeta. Algkirjel säilib kinnitatud koopia,
mida saab vaadata ka pärast uue väljamineva mustandi muutmist. Algkirje kustutus
ei kustuta eraldi kovisiooni ega vestlust; see piir on nähtav loomisel ja kustutamisel.

Versiooninumber ja realukk tõrjuvad aegunud salvestuse/kustutuse; muudatuste ajalugu
ei ole. Korduv loomine ja kovisioonile üleandmine on sama kavatsuse piires ühekordsed.
Tootelepingut muudeti: vana automaattestikeeld ja kogu privaatset arendust
takistanud partnerlusvärav ei sobinud kehtiva AGENTS.md ega omaniku arendussooviga.

## Tehtud kontrollid

- `prisma validate` ja `prisma generate`: PASS (Prisma 7.10.0).
- `tests/ethics.test.mjs`, `tests/ethics-api.test.mjs`,
  `tests/ethics.integration.test.mjs`: kuus sihttesti PASS, `TZ=UTC`.
  Eraldatud tühi kohalik `sotsiaal_ai_ethics_probe`, ainult `example.invalid`
  sünteetilised kontod. Võõra/admini lugemise ja muutmise tõrje; konkurentne
  salvestus; aegunud kustutuse tõrje; tehingu tagasipööre; korduv üleandmine;
  minimaalne koopia; ekspordi omaniku piir; konto kustutuskaskaad; CSRF,
  sisendisuurus, vigane sessioon, roll/tellimus, päringupiirang; tasulise assistendi
  raja testadapter ja sama pöördevõtmega kordus.
- Uue migratsiooni SQL proov tehingu sees eraldi skeemis: PASS. Veerud vastavad
  Prisma skeemile, kolm indeksit, olemasolevat User tabelit ei muudeta.
- `tests/chat-feedback-lifecycle.test.mjs`: seitse regressioonikontrolli PASS,
  sealhulgas isikuandmete pinnaregister ja privaatsusteksti olemasolev osa.
- Muudetud JS/JSX sihitud ESLint, ET/EN/RU kataloogide kontroll: PASS.
- Brauser 1280×900 ja 390×844: loomine, salvestamine, uuesti avamine, eraldi
  mustand, salvestuseta kinnituse keelamine, kinnitus, assistendi testadapteri
  vastus, kovisiooni loomine ja olemasoleva sessiooni avamine: PASS.
  Klaviatuuri PageUp-vahetus kontrollitud. Ekraanilugejaga läbimäng: NOT_RUN.
  Kohaliku Cloudflare telemeetria CORS-vead ei tulnud Eetikaruumi API-st.
- EN/RU lehe laadimine keeleküpsisega: PASS. Ajutine brauserikonto, selle koopiad
  ja sessioonifail kustutati proovibaasist; oma pordi 3001 dev-protsess peatati.
- [GitHubi tootmisbuild](https://github.com/LauRRaud/SotsiaalAI/actions/runs/38153189531)
  ja [automaatne deploy](https://github.com/LauRRaud/SotsiaalAI/actions/runs/38153350370):
  PASS, sama SHA artefakt. Serveris build'i, lint'i ega teste ei korratud.
- 18.58 EEST: aktiivne teenus `c389c096`; `EthicsReflection` olemas ja migratsiooni
  `20261015100000_ethics_reflection` `finished_at` täidetud, rollback puudub.
  `/api/health` 200/ok, `/api/ethics` anonüümselt 401/no-store. `/eetikaruum`
  annab voogvastuse sees sisselogimissuunamise (`NEXT_REDIRECT`, siht
  `/vestlus?login=1&next=%2Feetikaruum`); erasisu ei avata. Tootmiskasutajate sisu
  ei loetud ega kasutatud testimiseks.

## Olemasoleva RAG-i tõend

11.10 kell 18.39–18.46 EEST, ainult avaliku korpuse metaandmed ja tasuta
sõnaotsing; tasulisi mudeli- ega päringuembedding'u kutseid ei tehtud.
Plaan sisaldas 10 571 dokumenti, aktiivne põlvkond
`search_generation_ed2d72bdf06f24981866b2d2af9ecf4e13c7d09dfa077de4a1322c6f6a21196c` (v86).

Käitusprofiili `ts-rank-v1` sõnaotsing:

| Päring | Leitud 8 parima lõigu dokumendid | Aeg |
|---|---|---|
| sotsiaalvaldkonna töötaja eetikakoodeks enesemääramine konfidentsiaalsus | Sotsiaalvaldkonna töötaja eetikakoodeks; intervjuu eetikakomitee liikmetega | 3423 ms |
| eetikapõhimõtted sotsiaaltöös inimväärikus | IASSW 2018 „Eetikapõhimõtted sotsiaaltöös” | 2371 ms |

Esimene diagnostiline otsekutse kasutas ekslikult meetodi vaikimisi
`ts-rank-cd-v1` skoori ja katkestati 15 s SQL tähtajaga. Ülal on parandatud
kontroll tegeliku vestlusprofiili skooriga; runtime'i ei muudetud. See on
sõnaotsingu tõend, mitte kogu hübriidotsingu ega mudeli vastuse kvaliteedi tõend.

## Tõendamata ja järgmise ühiku piirid

### 11.10 täpsustus: ainult eetikaallikate otsing

Omanik: „kogu rag andmebaasi ei ole vaja eetikaruumi, ainult eetika oma”.
`/api/ethics/chat` kasutab senist assistenditeenust, kuid iga konfiguratsiooni
lugemine kitsendab lubatud dokumendid `config/ethics-sources.json` valikuga.
Valikus on 19 täpse versiooniga dokumenti: kuus eetikaartiklit/põhimõtete teksti,
sotsiaalvaldkonna ja noorsootöötaja koodeksid ning 11 sotsiaalvaldkonna
organisatsiooni/eriala eetikapõhimõtet. Valik põhineb aktiivse indeksi
metaandmetel ja tekstilõikude vaatlusel, mitte kõikide dokumentide täielikul
sisukvaliteedi ekspertiisil. Tutvustuslehed, korduvad üldised MTÜ koodeksid ja
valepositiivsed pealkirjavasted (kosmeetika, sünteetilised opioidid) jäid välja.

Piirang rakendub enne otsinguradade jaotust: sama lubatud dokumendiloend kehtib
PostgreSQL-i, vektorotsingu, graafiseoste ja viidete taastamise juures.
Tuumas pole eetika nime/ID järgi käitumiserandit; nimeline kogum on toote
konfiguratsioonis ning üldine adapter teeb õigustega ühisosa. Indeksi või
põhiplaani õiguse muutus ei lisa kogusse dokumenti; muutunud versioon vajab
valiku uuendamist. Tühi ühisosa peatab vastamise selge veateatega ega ava kogu
korpust. Valmis paketi või päringu taaskasutuse eriplanid tõrjutakse.

Eetikaruumi päring lubab ainult uut konteksti ilma varasema pöörde viiteta.
Seega ei saa üldassistendi varasem vastus ega dialoogiolek tuua laia korpuse
sisu vastusesse. Eraldi konfiguratsiooniräsi tõrjub eri ulatuste pöördevõtme
taaskasutuse. Kulupiir ja selle arvestus on ühised; uut eelarvet ei teki.
Tavalise assistendi allikavalik säilib. Muudatus lisati RAG-i teostusmanifesti.

19.21 EEST tasuta lugemiskontroll: sama v86 aktiivne indeks, 10 571 lubatud
dokumendist valiku kõik 19 täpset versiooni olemas. Senise profiili sõnaotsing:

| Päring | Piiratud kogust leitu | Aeg |
|---|---|---|
| eetikakoodeks enesemääramine konfidentsiaalsus | 8 lõiku neljast koodeksi/teemaintervjuu dokumendist | 1390 ms |
| eetikapõhimõtted inimväärikus | 8 lõiku IASSW põhimõtetest | 56 ms |
| kosmeetika | 0 lõiku | 9 ms |

Kohalikud kontrollid: 22 sihttesti PASS, sh konfiguratsiooni ühisosa,
versiooni/õiguse kadumine, otsingu ja viidete piir, HTTP kontekstipiir,
kriisiteate ja voogvastuse regressioonid. Eraldatud proovibaas tõendas sama
rahakulu arvestust mõlemas loomise järjekorras (enne eetikaruum või enne
üldassistent) ja eri ulatuste korduspäringu konflikti. Sihitud ESLint,
ET/EN/RU ning diffi kontroll PASS. Skeemi ei muudetud. Piirangu järel uus
brauseri tervikrada ja pärismudeli kvaliteediproov: NOT_RUN.

Avaldamine PASS: [tootmisbuild](https://github.com/LauRRaud/SotsiaalAI/actions/runs/38155574685)
ja [deploy](https://github.com/LauRRaud/SotsiaalAI/actions/runs/38155736672).
Algne `c69fd6d8` ehitus asendus põhiharu järgmise ühise väljalaskega; avaldatud
`811dcea0` sisaldab eetikaruumi commit'i `ff446490`.
19.32 EEST töötava väljalaske kontroll: `811dcea0`, käitusplaani piiratud valikus
19 dokumenti, põhiteenusega sama kululimiidi register, `/api/health` 200 ning
uus `/api/ethics/chat` anonüümselt 401/no-store. See ei ole autentitud
tootmisvestluse ega pärismudeli vastuse sisukvaliteedi tõend. Serveris ei
käivitatud build'i, lint'i, testikomplekti ega tasulist mudelikutset.

- 44 dokumendi eetikapaketi täpne kattuvus olemasolevaga, valik, import ja
  embedding: NOT_RUN; kõiki avalikke materjale ei saa pidada Eesti nõudeks.
- Mudeli eetilise arutelu sisuline kvaliteet ja juhise järgimine: NOT_PROVEN.
  Üldise assistendi prompt ei ole garantii, et iga vastus järgib soovitud stiili.
- Automaatne tuvastus on heuristiline, võib anda valehäireid ja jätta tunnuseid
  leidmata. Inimese ülevaatus säilib; täielikku anonüümsust ei lubata.
- Lehe taasavamisel ei säili kohalik assistendikatse võti; vestluse koopiat
  haldab assistendi ajalugu. Vana vastust ei taastata Eetikaruumi vormi.
- Eksperdikanal, eksperdivastuse tagasitee ning osalejatele avaldamise/kutsete
  terviktest ei kuulu selle privaatse mustandi ühikusse.
