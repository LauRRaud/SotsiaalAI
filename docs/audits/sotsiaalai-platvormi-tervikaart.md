# SotsiaalAI platvormi tervikaart

**Staatus:** `BASELINE_CREATED`  
**Auditi liik:** read-only inventuur  
**Baaskuupäev:** 2026-08-08  
**Töökaust:** `C:\Users\rauds\Desktop\SotsiaalAI`  
**Haru:** `main`  
**Baasi HEAD:** `f57620204b52990dab207fa71e9744ab19f261ba`  
**Remote-seis:** kohalik `main` on `origin/main` harust 5 commit'i ees

## 1. Selle esimese sammu eesmärk

See dokument fikseerib platvormi inventuuri algse baastaseme. See ei ole veel funktsioonide, õiguste ega runtime-käitumise süvaaudit.

Esimese sammu tulemused:

- projekti juurkaust on määratud inventuuri piiriks;
- füüsiliselt leitud failid on loendatud;
- Git-is jälgitavad ja Git-ist väljas olevad failid on eristatud;
- genereeritud ja sõltuvuste kaustad on inventuuris eraldi käsitletavad;
- põhilised rakenduse kaustad on esialgselt tuvastatud;
- edasine route'i-, funktsiooni- ja andmevoo-kaardistus saab tugineda sellele baasile.

## 2. Inventuuri ulatus

Inventuuri juur on kogu projekti juurkaust. Esmane füüsiline skann hõlmas peidetud faile ja kõiki projekti sees olevaid faile, välja arvatud järgmised detailtasemel väljajätmised:

- `.git/`;
- `node_modules/`;
- `.next/`;
- `coverage/`;
- `dist/`;
- `build/`.

Väljajätmine tähendab siin, et neid kaustu ei kirjutata failipuusse fail-faili haaval. Nende olemasolu, roll ja kasutatud versioonid tuleb siiski järgmistes etappides registreerida.

`.env`- ja muude salajasi väärtusi sisaldavate failide sisu ei kuulu auditiartefakti. Registreerida võib faili olemasolu ja rolli, kuid mitte võtmeid, paroole, PIN-e ega ühendusstringe.

## 3. Baastaseme numbrid

| Mõõdik | Tulemus |
|---|---:|
| Füüsiliselt leitud failid auditi ulatuses | 4 881 |
| Git-is jälgitavad failid | 2 783 |
| Git-is jälgimata, mitteignoreeritud failid | 0 |
| Git-i ignoreeritud failid | 66 786 |
| Tööpuu muudatused auditi alguses | 0 |

Git-i ignoreeritud failide koguarv sisaldab muu hulgas sõltuvusi, buildi- ja lokaalseid tööfaile. Seda arvu ei tohi tõlgendada rakenduse lähtefailide arvuna.

## 4. Esmane platvormipuu

### Rakenduse põhipinnad

```text
app/                 Next.js lehed ja route'id
components/          kasutajaliidese komponendid
lib/                 domeeni-, auth-, andme- ja teenuseloogika
pages/               olemasolevad Pages Router pinnad
public/              avalikud varad
messages/             lokaliseerimissõnumid
prisma/              skeem, migratsioonid ja andmebaasi abimaterjalid
scripts/             hooldus-, kontroll- ja testiskriptid
tests/               testid
```

### Konfiguratsioon ja runtime

```text
package.json
package-lock.json
next.config.mjs
jsconfig.json
eslint.config.mjs
postcss.config.js
tailwind.config.js
prisma.config.mjs
proxy.js
auth.js
docker-compose.yml
deploy.ps1
```

### Platvormi- ja töövaldkonnad

```text
docs/                auditid, arendusdokumendid, juhendid ja allikad
reports/             raportid ja kontrollväljundid
ops/                 operatiivsed konfiguratsioonid ja materjalid
config/              rakenduse konfiguratsioonid
data/                lokaalsed andme- ja sisendfailid
rag-service/         RAG-teenuse kood
service-map-restored-layout.png  visuaalne varafail
```

Lisaks on juurkaustas lokaalse töö, agentide ja abivahendite kaustad nagu `.agents/`, `.claude/`, `.codex-logs/`, `.playwright-cli/`, `generated/`, `output/`, `tmp/` ja `logs/`. Need tuleb järgmises etapis klassifitseerida lähtekoodiks, genereeritud väljundiks, auditijäljeks või lokaalseks tööfailiks.

## 5. Esimese funktsionaalse kaardistuse tuum

Esimene süvakartograafia keskendub järgmistele rakenduse põhiosadele:

```text
app/             lehed, API-route'id ja server action'id
lib/             äriloogika, õigused ja andmetöötlus
rag-service/     eraldi RAG-runtime ja retrieval'i vood
prisma/          andmemudelid ja andmebaasi seosed
auth.js          autentimine ja sessiooniloogika
proxy.js         request'i-/route'i-eelsed piirid
components/      kasutajaliidese pinnad ja tegevused
pages/           aktiivne või pärandina säilinud Pages Router kiht
```

`tests/` ei kuulu sellesse põhikaarti. Seda kasutatakse järgmises etapis tõendikihina: millised kaardistatud funktsioonid on testidega või runtime'is kontrollitud.

Konfiguratsioonifailid nagu `package.json`, `next.config.mjs` ja `prisma.config.mjs` jäävad eraldi tehnilise aluse kihiks.

## 6. Mis ei ole veel tehtud

Järgmised kaardid vajavad eraldi inventuurietappi:

- täielik lehtede ja URL-route'ide register;
- API-route'ide, server action'ite ja worker'ite register;
- eksporditud ja kriitiliste funktsioonide register;
- importide ja moodulite sõltuvuskaart;
- funktsioon → andmemudel → väline teenus andmevood;
- rollide ja serveripoolsete õiguste maatriks;
- testide ja runtime-kontrollide maatriks;
- kasutamata, katkiste või kaardistamata viidetega failide nimekiri.

## 7. Järgmise uuenduse reegel

Iga järgmine kaardistuse uuendus peab fikseerima:

- skannimise kuupäeva;
- Git-i commit'i või haru;
- lisatud failid;
- muudetud failid;
- eemaldatud või ümbernimetatud failid;
- uued või muutunud route'id ja funktsioonid;
- kontrollimata või runtime'is käivitamata osad.

Seda dokumenti käsitletakse platvormi praeguse tervikkaardi inimloetava indeksina. Detailsemad masinloetavad registrid võib hiljem lisada eraldi CSV- või JSON-failidena `docs/audits/` alla.
