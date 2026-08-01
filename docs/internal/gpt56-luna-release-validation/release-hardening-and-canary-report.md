# GPT-5.6 Luna release-hardening ja tootmiseelne canary

Kuupäev: 01.08.2026  
Olek: **tootmiseelne Luna canary aktiivne**  
Tootmine ei ole avalik; canary kasutab olemasolevat sünteetilist `SOCIAL_WORKER` testikontot.

## Otsus

`gpt-5.6-luna` on aktiveeritud kontrollitud tootmiseelse canary mudelina seadistusega:

- `reasoning=medium`;
- `verbosity=medium`;
- `max_output_tokens=3000` (global, client ja worker);
- `CHAT_PROMPT_TOKEN_AUDIT=0`;
- retrieval timeout **12000 ms**.

Rollback jääb `gpt-5.4-mini`, `reasoning=low`, `verbosity=medium`, `max_output_tokens=1100`. Varasem lukustatud pimehindamine jääb sisukvaliteedi otsuse aluseks: Mini 573/666 ja Luna 628/666. Käesolevad järeljooksud on automaatsed regressiooniväravad, mitte uus pime sisuhindamine.

## Release-blockerite parandus

### Teenuseankur ja kuvatud tõend

Harku sotsiaaltranspordi kriitilise vea juurpõhjus oli retrieval'ist allavoolu:

1. käändevormis teenusenimi ei ankurdanud SourcePackage'it;
2. fallback võis valida sama KOV-i teise teenuse rikka paketi;
3. atributsioon kuvas selle vale paketi allikaid;
4. õiged valitud konteksti allikad jäid kasutajale peitu.

Parandus normaliseerib tavapärased `...teenus` ja `...toetus` käändevormid, lubab ainult täpse teenuseankru või tugeva mitmesõnalise vaste ning lõpetab sobimatu teenuse valiku olekuga `insufficient_service_match`. Täpsed tasud, tähtajad, vormid ja kontaktid peavad pärinema sama KOV-i ja sama kanoonilise teenuse kinnitatud paketisektsioonist.

Live-kontrollis andis Harku juhtum:

- `package_selection_status=exact_service_match`;
- kuvatud allikas: **Sotsiaaltransporditeenus**;
- muud Harku teenusepaketid ei olnud kuvatud;
- kinnitamata eraldi vormi ja konkreetset teenuse kontaktisikut ei esitatud faktina;
- tasud ja tähtajad jäid teenuse enda ametliku allika toel vastusesse.

### Range no-corpus piir

Mitte-kriisipäringu korral ei tohi mudel anda faktivastusena üldteadmisi, kui RAG-kontekst puudub või käsitleb teist riiki, KOV-i, teenust või teemat. Lubatud on öelda, et kasutatud korpus ei kinnita vastust, ning nimetada vastamiseks vajalik lisainfo või ametlik allikas. Saksamaa korpusevälise juhtumi live-vastus oli lühike, kuvas null allikat ega esitanud allikateta hooldekodu hindu või hinnakomponente kinnitatud faktina.

### Kontaktide mitmekesisus — „iga sotsiaaltöötaja loeb”

Canary käsikontroll näitas, et üldine Harku teenuste vastus võis algselt tuua vaikimisi esile ainult kaks spetsialisti. Kontaktijuhis muudeti rolliteadlikuks:

- üldises KOV teenuste ülevaates öeldakse, et sobiv spetsialist sõltub teemast;
- tuuakse välja sotsiaalhoolekande, toetuste, hoolduse ja laste heaolu rollide mitmekesisus;
- üht-kaht inimest, telefoninumbrit või e-posti ei esitata vaikimisi kontaktina;
- kui kasutaja küsib kõiki kontakte, tuleb kuvada kõik olemasolevad kontaktid rollide kaupa;
- konkreetse teenuse vastuses tohib nimetada ainult selle teenuse jaoks kinnitatud kontakti.

Järelkontrollis jäi üldvastus rollipõhiseks ega tõstnud enam kahte inimest vaikimisi esile.

## Testitulemused

Küsimustik: `eval/golden-rag-v1.json`  
Tugevdatud küsimustiku SHA-256: `73f375f182274234c50f7462c9847b52786663f9475105a777c7b3e4e645428b`

| Jooks | Valmis (EEST) | Tulemus |
|---|---:|---:|
| Luna sihitud release-värav, 8 küsimust | 01.08.2026 16:12 | **8/8** |
| Luna Golden-37 | 01.08.2026 16:23 | **37/37** |
| Mini rollback Golden-37 | 01.08.2026 16:32 | **37/37** |

Sihitud värav kattis Harku sotsiaaltranspordi, Kuusalu koduteenuse ja vormid, Narva KOV-lekke, KOV vormide/kontaktide graph-juhtumi, no-corpus vastuse, kriisivastuse ja SHS § 17. Kõik jooksud olid järjestikused (`concurrency=1`); automaatseid retry'sid ei tehtud.

Lõplik kohalik kontroll:

- kogu testikomplekt **2029/2029**;
- lint läbitud;
- tootmise optimeeritud build läbitud;
- `git diff --check` läbitud.

Artefaktid:

- `luna-targeted.json` — ainult ID-d, automaatkontrollid ja kuvatud allikate tehniline meta;
- `luna-golden37.json` — Luna 37/37 tehniline regressioon;
- `mini-golden37.json` — Mini 37/37 rollback-regressioon.

Artefaktides ei ole küpsist, sessioonitokenit, kasutaja ID-d, e-posti, vestluse ID-d, küsimuse teksti ega vastuse teksti.

## Deploy ja tegelik providerikinnitus

Tootmise alg-HEAD: `13cfe8605e5ce705b8b4c973a39c389b09e5ac58`  
Deploy'tud koodi HEAD: `ae4d99d709d59947253cd4f1f2f7ed78d9e99c93`

Luna taastamise järel kinnitas `openai_usage` sünteetilise SHS § 17 smoke'i kohta:

- HTTP 200;
- `model=gpt-5.6-luna`;
- `max_output_tokens=3000`;
- provider status `completed`;
- `response_present=true`;
- üks kuvatud allikas.

Frontend restarditi deploy, Mini võrdlusjooksu ja Luna taastamise käigus omaniku selgesõnalisel loal. RAG-teenust ei restartitud: selle PID oli enne ja pärast **90400**.

Esimesel deploy-katsel päris serveriprotsess `NODE_ENV=production` tõttu dev-sõltuvuseta installi ja `cross-env` puudus. Systemd registreeris 15:55:51–15:56:33 üheksa ebaõnnestunud frontend-starti. Sõltuvused paigaldati seejärel koos buildiks vajalike dev-sõltuvustega, build korrati ja frontend käivitati edukalt. Alates 15:56:34 ei olnud frontend- ega RAG-teenuse warning/error/traceback kirjeid.

## Lõppseis

- production repo puhas;
- frontend `active`, PID kontrolli ajal **160881**, HTTP `/` = 200;
- RAG `active`, PID **90400**, `/health` = `ok`;
- frontend env SHA-256 pärast Luna taastamist: `7e786328f70c379c50d868c7e82d9499bec4d7cfd44029cb2997103ae54b726c`;
- RAG env SHA-256 muutumatu: `38d41cfb9f93f3daa974bbe59aa61ef4aef5b89e126b8e2e7fc8a6a5d39caaa1`;
- ajutine Mini-võrdluse env-koopia eemaldatud;
- B0 idle timerid ja unit'id puuduvad;
- 12000 ms retrieval timeout jäi muutmata;
- warm-up'i, readiness't ega retry'd ei lisatud.

## Jääkriskid ja järgmine värav

B0 idle-timeout'i esinemissageduse otsus on omaniku prioriteedimuutuse tõttu endiselt edasi lükatud; varasem katkestatud valim ei tõenda timeout'i tõstmise ega säilitamise lõppotsust. B0a/B0b aus veakäsitlus ja korrelatsioon jäävad tootmisse.

Luna võib jätkata tootmiseelses canary's. Enne avalikku avamist jälgida vähemalt:

- kinnitamata täpseid tasu-, tähtaja-, vormi- ja kontaktiväiteid;
- displayed source'i sama KOV-i ja sama teenuse vastavust;
- nullallikaga mitte-kriisipäringuid;
- vastuse pikkust ja incomplete olekut;
- latentsust ning tegelikku päringukulu;
- üldiste KOV-küsimuste rollipõhist kontaktide mitmekesisust.

Avaliku avamise värav on nende canary mõõdikute kontrollitud ülevaatus. Kiire rollback on Mini profiili taastamine ja ainult frontend-teenuse restart; RAG koodi, korpust ega teenust rollback ei puuduta.
