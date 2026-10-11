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

- Selle 19 allikaga väljalaske ajal oli 44 dokumendi paketi import NOT_RUN;
  see oli mittetäielik teostus, mitte omaniku kokkuleppe täitmine. Järgnev
  parandus käsitleb kogu lubatud paketti.
- Mudeli eetilise arutelu sisuline kvaliteet ja juhise järgimine: NOT_PROVEN.
  Üldise assistendi prompt ei ole garantii, et iga vastus järgib soovitud stiili.
- Automaatne tuvastus on heuristiline, võib anda valehäireid ja jätta tunnuseid
  leidmata. Inimese ülevaatus säilib; täielikku anonüümsust ei lubata.
- Lehe taasavamisel ei säili kohalik assistendikatse võti; vestluse koopiat
  haldab assistendi ajalugu. Vana vastust ei taastata Eetikaruumi vormi.
- Eksperdikanal, eksperdivastuse tagasitee ning osalejatele avaldamise/kutsete
  terviktest ei kuulu selle privaatse mustandi ühikusse.

## 44 materjali taastamine kokkulepitud ulatusse

Omanik parandas ulatust: „19 valitud eetikaallikaga? pidi olema 44 ju”.
44 tähendab kogutud dokumendi- ja peatükikirjeid, sh ESTA keeleversioonid ning
NASW koodeksi eraldi peatükid; see ei tähenda 44 sõltumatut väljaannet.
Eelnev 19-ne valik oli koostatud teisest, juba indekseeritud allikaloendist.

19.36 EEST mõõdetud v86 indeksis oli paketi üheksale materjalile vaste:
neli sama originaalfaili SHA-256-ga ning viis sama veebiaadressiga.
Viie veebiteksti võrdlus: AKI töösuhete ja teavituse tekstid sõnaliselt samad;
võlanõustaja koodeksist on indeksis eemaldatud navigeerimine/botikontroll,
varjupaikade koodeksil on lisaks korduv pealkiri. AKI tervishoiu tekstis on
indeksist välja jäänud rikkumistabeli koondpealkiri; tabeli sisu on olemas.
Need üheksa versiooni kasutatakse uuesti. Ülejäänud 35 materjali valmistati
ette standardse `planIngestBatch` / `prepareIngest` / ülevaatuse rajaga, ilma
RAG-tuuma allika-ID järgi käitumiserandit lisamata.

Kohalik tööpakett: `tmp/ethics-corpus-import/`. Täpne allikate ja versioonide
seos on `prepared.json` ja rakenduse `config/ethics-sources.json`; rühma plaan
`plan.json`, ülevaatus `review-v86.json`, saatmispakett `ship-v87/`.
Rühm `ingest_batch_0def9660e9a20508d2dd7ea29c68ad80be016e40725853d7347fc90c40a5d4a1`:
35 lisatavat dokumenti, 1126 lõiku, 1125 erinevat vektorisisendit,
312 268 tokenit enne serveri vahemälu arvestamist; 0 ülevaatuse blokeerijat.
Eraldatud kohalik hoidla võttis serveri v86 lähtepea ja avaldas sellele ainult
need 35 materjali; põhikausta ühise hoidla pead ei muudetud.

Teksti ettevalmistuses parandati kolm tuvastatud probleemi:

- AKI nõusoleku voldiku kolm lehte: visuaalselt kontrollitud veerud ning
  tabelite küsimuse/selgituse paarid; tühje jah/ei kaste ei esitata vastustena.
- Euroopa inimõiguste konventsiooni 31 lehe küljendusülevaade ja PDF lk 5:
  algne PDF-lugeja põimis kõrvutiasuvate trükilehtede artikleid. Ettevalmistatud
  leheküljetekst säilitab artiklite järjekorra ja algse PDF-i lehelingid.
- IASSW tõlke PDF lk 2: pildiga võrreldud fondi-Unicode'i vead
  „Põimustumisele”, „deinitsioon”, „Ejective” ja puuduv T parandati sellel lehel.
  Kõigi ülejäänud lehtede täielikku korrektuuri ei tehtud.

Algfailid säilivad. Nende kolme materjali sisend on eraldi ettevalmistatud
HTML, mille sektsioon nimetab algse PDF-i lehe ja viitab sellele; seda ei
esitata algse PDF-i automaatselt tuvastatud tekstikohana. Täpsed teisendused
ja räsi on algpaketi `quality-checks/*layout.json` failides. IFSW 2020/2021
materjalide tekstitud viimased lehed kontrolliti pildina: need on dekoratiivsed
tagakaaned. ESTA käsiraamatu välja jäetud viiteloendid kontrolliti; sisulised
peatükid on lõikudes alles. Kõigi PDF-ide kõigi lehtede täielik visuaalne
korrektuur, allikate õiguslik ajakohasus ja eksperthinnang: NOT_PROVEN.

Kohalik kontroll PASS: 35 muutumatu versiooni faili- ja viiteterviklus,
44 erinevat paketi-/dokumendivastet, võõra dokumendi välistamine piiratud
konfiguratsioonist, ühine kuluregister, AKI tabelipaar ja konventsiooni
artiklite järjestus. Kolm Eetikaruumi allikapiiri sihttesti PASS (TZ=UTC),
sh kohustuslik 44 kirje kontroll. Pärismudeli vastuse kvaliteeti ei mõõdetud.

Omaniku kinnitus pärast kuni 0,05 USD piiri nimetamist: „minu poolt luba ja
raha antud”. Vektoritöö kavandatud kulu enne vahemälu on 0,040595 USD,
aluseks [OpenAI text-embedding-3-large hinnaleht](https://developers.openai.com/api/docs/models/text-embedding-3-large),
kontrollitud 11.10: 0,13 USD miljoni sisendtokeni kohta. Serveri v87 tööle on
seatud 0,05 USD rahapiir ja 1126 välissisendi piir; tasulist vastusehindamist
selle loaga ei käivitata.

19.58 EEST lõpetas serveri v87 import edukalt: 1125 edukat vektorikutset,
312 268 sisendtokenit, teadmata tulemusega kutseid 0. Valideeritud
kasutusandmetest arvutatud kulu **0,040594840 USD** (mitte teenuse arve).
Uues indeksis on 10 606 dokumenti ja 94 597 lõiku; varasema indeksi read
ja kontrollsummad jäid samaks. Aktiivne indeks:
`search_generation_7ee75d5087725f03b5a11932c53f62d0330cc52750cec53dbd9cb098fdcd836c`.
Teenuse uus ühine plaan on `/etc/sotsiaalai/m4-corpus-chat-20261011-ethics44.json`.

20.00 EEST tasuta käituskontroll (`verification-index.json`): kõik 44 täpset
dokumendi-/versioonipaari on aktiivses indeksis ja lubatud plaanis,
kokku 1399 lõiku. Piiratud otsing leidis „enesemääramine”, „confidentiality”
ja „artificial intelligence” puhul igaühel 8 lõiku üksnes lubatud valikust;
„kosmeetika” andis 0. Sama assistendi kuluregister säilib. Rakenduse
avaldatud konfiguratsioon oli selle kontrolli ajal veel 19-ne; 44 kontrolliti
ettevalmistatud konfiguratsiooniga. Uusi mudelikutseid selles kontrollis ei tehtud.

Pärast indeksi kontrolli sünkrooniti kohalik põhikorpuse hoidla sama
`generation_891047b68e1f2b2f20659e6cc278e2e76d65d0a4f777f95eac74f6fec95b9beb`
peaga: 10 649 talletatud dokumenti, sh 43 varem otsingupoliitikast väljas.
Lisati ainult 35 versiooni, kõik varasemad dokumendiversioonid jäid samaks;
vana aktiivpea koopia on tööpaketi `local-main-backup/active.json`-is.

Avaldamine PASS: [tootmisbuild](https://github.com/LauRRaud/SotsiaalAI/actions/runs/38158032959)
ja [deploy](https://github.com/LauRRaud/SotsiaalAI/actions/runs/38158227464).
Parandus `44f97612` avaldati põhiharu ühises väljalaskes `8df98324`;
vahepealne ehitus asendus uuema põhiharuga, Eetikaruumi konfiguratsioon säilis.
20.08 EEST töötava teenuse kontroll (`verification-live.json`) PASS:
paigaldatud konfiguratsioon on täpselt `ethics-44-2026-10-11`, käitusplaanis
kõik 44 dokumendi-/versioonipaari ja 1399 lõiku, sama aktiivne v87 indeks
ning üldassistendiga ühine kuluregister. Kolm teemakohast otsingut andsid
igaüks 8 lõiku ainult lubatud valikust (50–86 ms), „kosmeetika” 0 (50 ms).
`/api/health` vastas 200. Avaldamine uuendas plaani uue väljalaske
rakenduse räsidega ning säilitas v87 dokumendivaliku.

Sihitud ESLint ja diffi kontroll PASS. Käituse kontrollid ei kasutanud
tootmiskasutajate sisu ega teinud mudelikutseid. Autenditud kasutaja
vestluse tervikrada selle konfiguratsioonimuudatuse järel: NOT_RUN;
pärismudeli eetilise arutelu sisuline kvaliteet: NOT_PROVEN.
