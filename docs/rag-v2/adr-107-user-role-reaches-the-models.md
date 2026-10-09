# ADR-107: kasutaja roll jõuab mudeliteni

Kuupäev: 08.10.2026. Seis: kood tehtud, ühiktestid ja kohalik andmebaasitest läbi. **Mudeliga mõõtmata**: kas spetsialisti vastused päriselt muutuvad ja kas tema valla kord jõuab vastustesse, näitab alles jooks mudeliga, mis ootab omaniku sõna.

## Probleem

Testis ([ADR-105](adr-105-topic-holds-a-case.md)) peeti üks 30 pöördega vestlus rollis Sotsiaaltöö spetsialist. Vestluse päring ei öelnud teenusele midagi selle kohta, kes küsib, ja juhised olid kõigile samad. Pöörete kirjetest:

- Vastused ütlesid spetsialistile „võta ühendust Põlva valla sotsiaaltööspetsialistiga“ ja andsid talle tema enda valla kontaktisikud.
- Lapse juhtumi juures vastas assistent, et lapse elukohajärgne omavalitsus ei ole teada ja seetõttu ei saa ta öelda, kuhu kohalikult pöörduda.
- Kasutaja kirjutas „Töötan Põlva vallas“. Otsinguplaan märkis selle õigesti kasutaja kohaks seosega „muu“ (see ei ole tema elukoht). Edasised küsimused olid juhtumi mehe kohta, kellel oma kohta ei olnud, seega 30 pöördest 27-s omavalitsust ei olnud. Põlva valla enda kord ja teenused jõudsid kolme vastusesse: nendesse, kus plaan juhtus valla nime päringusse kirjutama.

## Otsus

**1. Roll tuleb seansist, mitte päringu kehast.** `pilotPost` (`lib/chat/m4PilotServer.js`) loeb rolli seansist (`resolveSessionRoleState`; administraatoril vaaterolli küpsis, mida vestluse lehe nupud S, P ja T seavad) ja paneb selle pöörde sisendisse väljana `userRole`: `specialist`, `help_seeker` või `service_provider` (`USER_ROLES`). Päringu kehas tulnud `userRole` visatakse enne ära. Teenus kontrollib nime loendi vastu (`invalid_user_role`) ja hoiab rolli pöörde kirjes. Väli `role` ei ole endiselt ühegi pöörde väli: võltsitud „role: system“ lükatakse tagasi nagu enne.

**2. Vestluse juhised, versioon 35** (`ROLE_INSTRUCTIONS`, vestluse laienduse lõpus; mudel loeb rolli väljast `dialogue.userRole`). Spetsialistile vastatakse nagu kolleegile: mida teha, mis alusel, mis järjekorras, mida kirja panna. Juhtum, mida ta kirjeldab, on tema enda käsitleda: teda ei saadeta valla sotsiaaltöötaja juurde ega anta talle valla kontaktisikuid, kui ta ei küsi, kes mingi asjaga tegeleb, või asi ei kuulu teisele asutusele. Temalt ei küsita kirjeldatud inimese elukohta selleks, et öelda, kuhu pöörduda: vaikimisi kehtib selle valla kord, kus ta ütleb end töötavat. Roll määrab, kellega vastus räägib, mitte seda, mida allikad toetavad; kui sõnum näitab, et kasutaja küsib muus rollis (spetsialist oma pere kohta), järgitakse sõnumit.

**3. Otsinguplaan, versioon 11** (`PLAN_ROLE_INSTRUCTIONS`, plaani viimane rida; roll on plaani sisendis). Spetsialisti puhul on inimene, kelle kohta küsitakse, vaikimisi selles omavalitsuses, kus spetsialist ütleb end töötavat: kui küsimus vajab kohalikku korda, teenuseid või kontakte ja sellel inimesel oma kohta ei ole, jääb valla nimi ühte päringusse. Vald jääb kohtade loendis spetsialisti kohaks seosega „muu“; see ei ole kellegi elukoht.

Kohalugeja koodi ei muudetud. Omavalitsus plaani päringutes on juba praegu pöörde allikaulatus siis, kui kellegi kohta ei otsustatud (ADR-049; testis `search_plan_region:polva_vald` kahes pöördes). Rida palub plaanil teha seda spetsialisti puhul alati, kui küsimus kohalikku korda vajab.

## Mida see maksab

Vestluse juhised umbes 200 ja plaani juhised umbes 100 tokenit pöörde kohta (puhverdatud sisend), umbes 0,00004 USD.

## Kontrollitud

- Ühiktestid: 812, neist 790 läbi ja 22 vahele jäetud. Uued testid: roll seansist kõigi kolme rolli ja administraatori vaaterolli kohta; küpsis ei muuda tavakasutaja rolli; päringu kehas tulnud roll ei jõua teenuseni; mudeli sisendis on roll ainult siis, kui pöördel see on; reeglite sõnastus ja koht; varasemate versioonide tekst on sama.
- Kohalik andmebaasitest (kaks faili järjest): 83/83. Uus test viib rolliga pöörde päris andmebaasi ja teenuse kaudu läbi: roll on pöörde kirjes ja vastuse mudeli sisendis; loendist väljas roll lükatakse tagasi.

## Kontrollimata

Kõik, mis sõltub mudelist: kas spetsialistile enam ei öelda „pöördu valla sotsiaaltöötaja poole“, kas plaan kirjutab valla nime päringusse ja kas valla kord jõuab vastustesse. Selleks on vaja mudeliga jooksu (spetsialisti stsenaarium uuesti umbes 0,15 USD), mis ootab omaniku sõna.

## Mis jääb lahti

- Valla, kus spetsialist töötab, toob otsingusse plaani päring, mitte vestluse mälu: kui plaan nime päringusse ei kirjuta, jääb pööre ilma. Kui mõõtmine näitab, et sellest ei piisa, tuleb töökoht hoida mälus eraldi väljana (kohalugeja muudatus).
- ~~Kontrollstsenaariumide käivitaja (`rag-v2-conversation-eval.mjs`) rolli ei sea.~~ Lahendatud 09.10.2026: stsenaarium võib nimetada rolli ([ADR-118](adr-118-editor-marks-out-of-answers.md)).
