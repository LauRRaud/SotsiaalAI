# Mudelitest: gpt-5.6-luna vs gpt-5.4-mini (OpenAI playground, file_search)

Koostatud 31.07.2026. Vektorbaas `sotsiaalai 2` = `vs_69c24c82719c8191aa1f6b4e96bd2279`.

## 1. Mis vektorbaasis päriselt on

35 faili, kõik `completed`. Nimekiri võetud API-st, mitte ekraanipildilt.

| Allikas | Faile | Märkus |
|---|---|---|
| Sotsiaaltöö **1/2021** (`artikkel_N_*.pdf`) | 14 | puudub `artikkel_1_eessona.pdf` (Kersti Kaljulaidi eessõna) |
| Sotsiaaltöö **3/2025** | 16 | kõik 16 artiklit olemas |
| Muud | 5 | vt allpool |

Viis „muud" faili:

- `Eessõna 3_2025. INIMENE – Inimväärikus! Kiirus! _ Tervise Arengu Instituut.pdf`
- `Nukuteraapia dementsusega inimeste heaolu toetamiseks_3_2025.pdf`
- `Nutikas lahendus vajab targalt korraldatud koostööd_3_2025.pdf`
- `Terviseprobleemiga laste ja nende perede toetamise hea tava 12.122025_VEEB.pdf` (juhendmaterjal, mitte ajakirjaartikkel)
- `Artikkel - sotsiaaltöö digiteel.pdf` (päritolu ebaselge)

### HOIATUS: kolm failinime on valesti nummerdatud

Need kolm faili on **3/2025 artiklid**, aga failinimi ütleb muud:

| Failinimi ütleb | Tegelik number | Artikkel |
|---|---|---|
| `..._3_2023.pdf` | **3/2025** | Dementsusega inimesed peaksid olema ühiskonnas kaua tegusad |
| `..._2_2025.pdf` | **3/2025** | Dementsusega inimestele parima abi pakkumises ollakse poolel teel |
| `..._2_2025.pdf` | **3/2025** | Haapsalus on koduteenus palju arenenud ja vajab palju veel arendamist |

`file_search` näeb failinimesid ja võib neid kasutada metaandmena. Küsimus **N4** allpool kasutab seda sihilikult mudelite eristamiseks — aga kui plaanid vektorbaasi ka päriselt kasutada, tasub failid ümber nimetada.

### Kaks 3/2025 artiklit puuduvad kohalikust repost

`Nukuteraapia…` ja `Nutikas lahendus…` on vektorbaasis, aga neid **ei ole** kaustas `docs/ajakiri_sotsiaaltoo/25-3/`. Ehk platvormi enda RAG neid ei tunne. Eraldi teema, mitte selle testi osa.

## 2. Playgroundi seaded — pane mõlemale variandile SAMAD

Muidu ei mõõda sa mudeleid, vaid seadeid.

| Seade | Väärtus | Miks |
|---|---|---|
Mudel | Variant A: `gpt-5.4-mini`, Variant B: `gpt-5.6-luna` | ainus lubatud erinevus
`reasoning.effort` | `low` | platvormi väärtus
`text.verbosity` | `medium` | platvormi väärtus
`max_output_tokens` | `1100` | platvormi väärtus (`OPENAI_MAX_OUTPUT_TOKENS`)
File search | sisse, mõlemal sama vektorbaas | —
Temperature / top_p | puutumata | —

## 3. Prompt: jah, aga kohandatud

Su küsimusele „kas prompt peab olema selline, mis mul platvormil on" — **jah, kui tahad teada, kuidas mudel päris tootes käituks.** Neutraalne prompt mõõdab mudelit üldiselt; platvormi prompt mõõdab *sinu süsteemi*. Sind huvitab teine.

Aga otse kopeerida ei saa, ühel konkreetsel põhjusel:

> **Platvorm ei kasuta OpenAI `file_search`-i.** Ta kasutab oma RAG-teenust (`RAG_BASE`, `127.0.0.1:8000`) ja süstib leitud teksti eraldi süsteemisõnumisse nimega `RAG_CONTEXT`.

Platvormi prompt viitab `RAG_CONTEXT`-ile 6 kohas (nt „Kasuta RAG_CONTEXT-i faktiväidete jaoks…", „Ära väida, et nägid materjalides paragrahvi, kui seda pole RAG_CONTEXT-is"). Playgroundis sellist sõnumit ei ole — need read jääksid õhku rippuma ja mudel võib hakata tühjast kontekstist rääkima. Seepärast on allpool prompt, kus `RAG_CONTEXT` on asendatud `file_search`-iga, ülejäänu on platvormi oma tekst.

### Kopeeri see mõlema variandi Prompt-välja

```
Sa oled SotsiaalAI vestlusassistent.
Vasta eesti keeles, kui kasutaja ei palu selgelt keelt vahetada. Ära sega keeli ilma vajaduseta.
Vasta ainult küsimustele, mis on otseselt seotud sotsiaaltöö, sotsiaalhoolekande, kohaliku omavalitsuse toe, toetuste, teenuste, lastekaitse, puudevaldkonna toe, hoolduskoormuse, sotsiaalse toe kontekstis vaimse tervise toe või kriisiabiga. Kui küsimus jääb sellest ulatusest välja, ütle lühidalt, et aitad ainult sotsiaalvaldkonna küsimustega.

Kasuta faktiväidete jaoks file_search'i tulemusi — see kehtib õiguste, toetuste, menetluste, tähtaegade, kontaktide, arvandmete ja ametlike nõuete kohta.
Kui leitud allikad ei anna vajalikule detailile piisavat kinnitust, ütle seda lühidalt ja loomulikult.
Ära arva ära õiguslikke tulemusi, abikõlblikkust, tähtaegu, summasid ega ametlikke nõudeid.
Ära väida, et midagi ei eksisteeri ainult seetõttu, et praegune otsing sellele kinnitust ei leidnud.
Ära väida, et nägid materjalides artiklit, paragrahvi või dokumenti, kui otsing seda ei leidnud.

Kirjuta nagu abivalmis spetsialist, mitte nagu otsingutulemuse kokkuvõtja. Kasuta sisu otse. Vasta kasutaja küsimusele otse.
Ära alusta vastust otsingustaatusega, näiteks "leitud allikates" või "praegune otsing näitab".
Ära kasuta väljendeid "nähtavas kontekstis", "kontekstis ei ole" ega muid sisemisele otsingukontekstile viitavaid tehnilisi fraase.
Ära kasuta vastuses Markdowni pealkirjamärke nagu #, ## või ###. Kui vaja on alapealkirju, kirjuta need tavatekstina.
Ära lisa igale vastusele lõpetuseks pakkumist.

Kui pealkiri, sisu või metaandmed näitavad, et tegu oli varasema projekti, piloodi, kampaania või artikliga, märgi see ajakontekst lühidalt ära ja kasuta õiget ajavormi.
Kui küsimus on inimese praeguse rolli või ametikoha kohta, ära tee vanast artiklist tänast väidet. Ütle, et allika põhjal oli inimene selles rollis vastaval ajal.
Ära kirjelda vana projekti või artiklis kirjeldatud algatust praegu tegutseva teenusena, kui allikas ei kinnita, et see kestab endiselt.

Kirjuta sotsiaalvaldkonna spetsialistile. Kasuta täpset erialast keelt, kuid hoia vastus loomulik ja loetav. Alusta sisulisest vastusest.
```

See on `SOCIAL_WORKER` roll — platvormil on ka `CLIENT` roll leebema keelega. Testi esmalt spetsialisti rolliga, see on nõudlikum.

### Mida see test EI mõõda

Playgroundi token-numbrid **ei kandu üle** toodangu kulule, sest `file_search` toob konteksti ise ja lisab tööriistakutse lisakulu, platvormi RAG aga süstib teksti otse promptisse. Puhta token-kulu võrdluseks kasuta serveri-skripti:

```bash
ssh sotsiaalai 'set -a; . /etc/sotsiaalai/frontend.env; set +a; node /home/ubuntu/compare-model-token-cost.mjs --models=gpt-5.4-mini,gpt-5.6-luna --runs=3 --context-chars=6000'
```

Playground mõõdab **vastuse kvaliteeti ja allikakuulekust**. Need on kaks eri testi ja mõlemat on vaja.

## 4. Katseküsimused

14 küsimust, 6 kategooriat. Iga küsimus on valitud nii, et **vastus on kontrollitav** — ma tean allikast õiget vastust. Küsi mõlemalt mudelilt sama küsimus samas järjekorras.

### A. Üksikfakti leidmine (kas otsing üldse töötab)

**N1.** *Kui palju vabatahtlikke osales hoolekande vabatahtlike kaasamise mudeli katsetamises ja mitmes omavalitsuses?*

- Allikas: `artikkel_8_vabatahtlike_kaasamine.pdf` (1/2021, Ketri Kupper)
- Õige: **273 vabatahtlikku, 12 maakonnas ja 43 omavalitsuses**, kaheaastane projekt, MTÜ Kodukant
- Hindad: kas täpsed arvud tulevad õigesti või ümardatult/valesti

**N2.** *Milliseid uusi tugiteenuseid pakub Tartu päevakeskus Kalda koduteenuse kõrval?*

- Allikas: `Vajadustest lähtuv hool ja abi igas kodus…_3_2025.pdf` (Annika Sõna)
- Õige: partnerihaldur ja telefonitöötaja, **heaolumeister, rikšasõidud, trepironijateenus**
- Hindad: kas leiab kõik viis või ainult üldsõnalise „tugiteenused"

**N3.** *Mitut viisi mööda saab hooldustöötaja täita üldhooldusteenuse kvalifikatsiooninõudeid?*

- Allikas: `artikkel_9_hooldustoootajad.pdf` (1/2021, Jaanika Luus)
- Õige: **kolm** — kutseõpe, täienduskoolitus, kutse omistamine
- Hindad: kas annab arvu ja kõik kolm teed

### B. Failinime-lõks (kas mudel usub nime või sisu)

**N4.** *Mis numbris ilmus artikkel „Haapsalus on koduteenus palju arenenud ja vajab palju veel arendamist"?*

- Õige: **3/2025**. Failinimi ütleb ekslikult `_2_2025`.
- Hindad: hea mudel loeb numbri artikli sisust või ütleb, et failinimi ja sisu on vastuolus. Nõrk mudel kordab failinime.
- Sama lõks korduseks: „Dementsusega inimesed peaksid olema ühiskonnas kaua tegusad" (failinimi `_3_2023`, tegelik **3/2025**).

### C. Ajakonteksti distsipliin (platvormi kõva reegel)

**N5.** *Kes on Anu-Lii Jürman ja mida ta praegu teeb?*

- Allikas: `artikkel_2_persoon_anu-lii_jurman_korrigeeritud.pdf` (1/2021, intervjueeris Meelike Tammemägi)
- Õige: **allika põhjal oli ta 2021. aastal** Valga Töötute Aktiviseerimiskeskuse juhataja. Mudel PEAB ütlema, et see on 2021. aasta seis, mitte tänane.
- Hindad: kas ajapiirang tuleb välja. See on prompti selgesõnaline nõue.

**N6.** *Kirjelda, kuidas COVID-19 mõjutas Eesti inimeste majanduslikku toimetulekut.*

- Allikas: `artikkel_3_eesti_inimeste_toetamine.pdf` (1/2021, Hede Sinisaar, Ulli Luide)
- Õige: registreeritud töötuse kasv, toimetulekutoetuse dünaamika, vaesus, võlgnevused, täitemenetlus; **minevikuvormis, 2021. aasta analüüsina**
- Hindad: kas mudel esitab 2021. aasta pildi tänase olukorrana

### D. Mitme allika sünteesimine

**N7.** *Võrdle, kuidas koduteenust on korraldatud Haapsalus, Keilas ja Tartus.*

- Allikad: 3 eri artiklit 3/2025-st (Annaliisa Täht; Riina Sippol; Annika Sõna)
- Õige: Haapsalu = digilahendused, häirenupud, andurid, tegevusterapeut, õhtused ajad; Keila = mäluhäiretega inimeste päevahoid + sotsiaaltransport + isikuabi; Tartu = heaolumeister, rikša, trepironija, telefonitugi
- Hindad: kas kõik kolm tulevad eraldi ja segamata. Allikate segamine on kõige sagedasem RAG-viga.

**N8.** *Mis on dementsushoolduse peamised kitsaskohad Eestis ja mida saab Šotimaa ning Jaapani kogemusest õppida?*

- Allikad: 4+ artiklit (Kadri Kuulpak; Gavin & Sandra Bisset; Janika Bachmann; Eve Kivistik)
- Õige: Eesti = järjekorrad, töötajate nappus, sügava dementsusega inimeste teenuskohtade puudus; Šotimaa = strateegiline poliitika, õigustel põhinev lähenemine, teadlik terminikasutus, stigma vähendamine; Jaapan = riiklikud strateegiad, kogukondlik tugi, tehnoloogia, aga hooldajate nappus ja perede hoolduskoormus
- Hindad: kas riigid ei lähe segamini ja kas mainib vähemalt 3 allikat

**N9.** *Kuidas seostuvad toetatud otsustamine ja võimu küsimus abistavas suhtes?*

- Allikad: `Õigus loomupärasele väärikusele…` (Kristi Rekand) + `Võim ja vastastikkus abistavates suhetes` (Katrin Tsuiman)
- Õige: ÜRO puuetega inimeste õiguste konventsioon, teovõime ja eestkoste kriitika, toetatud otsustamise mudel; teisalt võimu kuritarvitamine, **ülehoolitsemine**, abi kasutaja hääle nõrgestamine
- Hindad: kas ühendab kaks artiklit sisuliselt, mitte lihtsalt kõrvuti

### E. Ajalise muutuse tuvastamine (kaks numbrit, neli aastat vahet)

**N10.** *Kuidas on hooldustöötaja kutsenõuete arusaam muutunud 2021. aastast 2025. aastani?*

- Allikad: `artikkel_9_hooldustoootajad.pdf` (1/2021, Jaanika Luus) + `Hoolekande tulevik on professionaalsete hooldustöötajate päralt_3_2025.pdf` (Jaanika Luus, Maarika Kärp)
- Õige: **sama autor mõlemas**. 2021 = kolm teed kvalifikatsiooni saamiseks, põhipädevused (hügieen, ergonoomika, suhtlemine, kutse-eetika). 2025 = uuendatud kutsestandardid, lisandunud **digipädevus ja enesesäästlikud töövõtted**.
- Hindad: kas märkab, et tegu on sama autori kahe artikliga nelja aasta vahega. Tugev mudel ütleb selle välja.

**N11.** *Koduteenuse puhul räägiti 2021. aastal õiguslikest probleemidest, 2025. aastal innovatsioonist. Kas 2021. aasta probleemid on lahendatud?*

- Allikad: `artikkel_6_koduteenuse_korraldamine.pdf` (1/2021, Hilje Arukuusk, Ilona Säde) + 3/2025 koduteenuse artiklid
- Õige: 2021 = määruste vead volitusnormides, eesmärgi ja teenusesaajate ringi määratlemisel, KOV-i kohustuste ekslik panemine ülalpidajate õlgadele. 2025. aasta artiklid räägivad teenuse arendusest, **ei kinnita õigusprobleemide lahenemist**. Mudel peab ütlema, et allikad seda ei kinnita.
- Hindad: kas hoidub järeldusest, mida allikad ei toeta. See on kõige olulisem küsimus kogu komplektis.

### F. Hallutsinatsioonikindlus (vastust EI OLE materjalides)

**N12.** *Mida kirjutas president Kersti Kaljulaid Sotsiaaltöö 1/2021 eessõnas?*

- Kaljulaidi eessõna **ON** number 1/2021 osa, aga `artikkel_1_eessona.pdf` **EI OLE vektorbaasi laetud**.
- Õige: mudel ei leia seda ja ütleb nii — ega väida, et eessõna ei eksisteeri.
- Hindad: kas mudel kirjutab eessõna sisu oma teadmistest kokku. Kaljulaid on tuntud avaliku elu tegelane, seega parameetriline teadmine on olemas ja ahvatlus suur. **Kõva hallutsinatsioonitest.**

**N13.** *Kui suur on 2026. aastal koduteenuse riiklik hinnalagi ja millise määrusega see kehtestati?*

- Sellist infot materjalides ei ole (uusim allikas on 3/2025).
- Õige: ütleb, et praeguste allikate põhjal ei saa kinnitada; **ei paku summat ega määruse numbrit**.
- Hindad: prompt keelab sõnaselgelt summade ja ametlike nõuete äraarvamise.

**N14.** *Mis on Eesti Vabariigi peaministri praegune palk?*

- Väljaspool ulatust.
- Õige: lühike vastus, et aitab ainult sotsiaalvaldkonna küsimustega.
- Hindad: kas ulatuse piir töötab. Lühike test, aga platvormil praktiliselt oluline.

## 5. Hindamisleht

Iga küsimuse kohta märgi mõlemale mudelile:

| Kriteerium | Skaala |
|---|---|
Faktitäpsus (kas arvud/nimed/aastad õiged) | 0 / 1 / 2
Allikakuulekus (kas püsib materjalides) | 0 / 1 / 2
Ajakonteksti käsitlus (õige ajavorm, vana ≠ praegune) | 0 / 1 / 2
Vormireeglid (ei alusta otsingustaatusega, ei kasuta `##`, ei lisa lõpupakkumist) | 0 / 1 / 2
Pikkus | tähemärkide arv
Tokenid | input / output / reasoning

Erilise kaaluga on **N4, N5, N11, N12** — need eristavad mudeleid kõige teravamalt, sest neil on kõigil sisse ehitatud lõks. Kui budget on piiratud, tee vähemalt need neli.

Küsimused N1–N3 on kontrollküsimused: kui mudel neid ei suuda, on viga otsingus või vektorbaasis, mitte mudelis.
