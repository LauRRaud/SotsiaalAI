# SOL — U8-lite allikate usalduskiht: tööplaan ja progress

> **Tööharu:** `codex/u8-lite-trust-layer`
> **Eraldi tööpuu:** `C:\Users\rauds\Desktop\SotsiaalAI-u8-lite`
> **Baas:** värske `origin/main` (`df2f45c0`)
> **Staatus:** U8-LITE SOL VALMIS — ootab Opuse sõltumatut järelkontrolli; ei ole main-i ühendatud ega deploy'tud

## 1. Eesmärk ja piir

U8-lite lisab olemasolevale vestluse allikakihile kolm kontrollitavat usaldussignaali:

1. millal konkreetset kuvatud allikat viimati kontrolliti;
2. võimalus teatada konkreetse kuvatud allika veast ilma vestluse või vastuse sisu saatmata;
3. AI loodud tööteksti aus olek: `AI mustand`, `inimese muudetud`, `inimese kinnitatud` ainult seal, kus olemasolev andmemudel seda fakti päriselt tõendab.

Pakett ei muuda allikate valiku- ega attribuutikatugevust, ei peida tagantjärele vastuseid, ei loo üldist piletisüsteemi ja ei laienda teadmistebaasi haldust.

## 2. Enne koodi lukustatud kaardistus

### 2.1 Allika kuvamise vertikaal

- serveri attribuutika: `lib/chat/sourceAttribution.js`;
- allikate meta ja kuupäeva-aliaste sisend: `lib/rag/sourceMetadata.js` ning `lib/rag/sourceFreshness.js`;
- püsiv `displayed_sources`: `lib/chat/mainResponseHandler.js`, `lib/chat/responseFinalizer.js` ja vestlussõnumi `metadata`;
- kliendi koondamine: `components/chat/hooks/useConversationSources.js`, `components/chat/utils/sources.js`;
- kasutajaliides: `components/alalehed/chat/ChatSourcesPanel.jsx` ja `ChatMessageItem.jsx`.

### 2.2 Keskne kuupäevaleping

- lubatud kontrollkuupäeva aliased normaliseeritakse ühes serveripoolses abifunktsioonis;
- väljund on ainult valideeritud ISO-kuupäev ja masinloetav värskusolek;
- puuduva või vigase väärtuse olek on `unknown`; tänast kuupäeva ei leiutata;
- ajalooline, arhiveeritud või mitteaktiivne allikas saab eraldi hoiatuse;
- kuupäev ja värskus lisatakse alles pärast attribuutikaotsust, seega need ei muuda allika kuvamise tõenduslävendit;
- klient vormindab valideeritud kuupäeva aktiivse ET/EN/RU lokaadi järgi.

### 2.3 SourceFeedbacki turvaleping

- uus kitsas `SourceFeedback` kirje hoiab raporteerijat, serveris kinnitatud stabiilset allika ID-d ja tüüpi, kategooriat, lühikest märkust, olekut ning lahendamise auditandmeid;
- POST võtab vastu ainult `messageId`, `sourceId`, kategooria ja piiratud pikkusega märkuse;
- server leiab `messageId` kaudu raporteerijale kuuluva vestlussõnumi ning kontrollib `sourceId` olemasolu selle püsivas `displayed_sources` loendis;
- kliendi saadetud pealkiri, URL või allikatüüp ei ole identiteet ega sisend;
- täisvestluse, prompti, vastuseteksti või tundmatute väljadega päring lükatakse tagasi;
- duplikaat on idempotentne serveripoolse võtmega ja ei tekita teist avatud kirjet;
- raporteerijapõhine tunnikiiruse piirang rakendub andmebaasitehingus;
- kasutaja näeb ainult enda kirjeid, administraator kõiki; võõra ID päring annab ühesuguse `404` vastuse;
- lahendamine nõuab administraatorit ning kirjutab samas tehingus auditikirje;
- tagasiside ei muuda ega peida olemasolevat vastust või selle allikaid.

### 2.4 AI-mustandi olekuleping

- olek tuletatakse ainult olemasolevast `generatedText`, `editedText` ja `userConfirmed` lepingust;
- kinnitamata muutmata tekst on `ai_draft`;
- kinnitamata inimese muudetud tekst on `human_edited`;
- ainult andmemudelis tõendatud kinnitus on `human_confirmed`;
- iga sisumuutus tühistab kinnituse serveris ja kasutajaliideses;
- AI ei kinnita ega jaga mustandit automaatselt;
- märgis on tekstiline, semantiline ja ekraanilugejale arusaadav.

## 3. Migratsiooniotsus

Lisatakse üks additiivne `SourceFeedback` mudel ning kaks nullable seost `User` mudelisse (raporteeritud ja lahendatud kirjed). Olemasolevaid veerge ei kustutata ega muudeta. Migratsioon peab olema rakendatav tühjale testandmebaasile ja olemasolevale skeemile ilma andmekaota.

## 4. Rakendusplaan

- [x] Värske `origin/main` põhine eraldi tööpuu ja haru
- [x] U8 serveri-, kliendi-, andmemudeli- ja adminipindade kaardistus
- [x] Turva-, kuupäeva-, duplikaadi- ja mustandiolekute leping
- [x] Keskne allika usaldusmeta normaliseerija ja `displayed_sources` serialiseerimine
- [x] `SourceFeedback` skeem, migratsioon, kasutaja API ja administraatori API
- [x] Allikapaneeli värskus, hoiatus ja veast teatamise voog
- [x] Administraatori avatud teadete loend ja auditeeritav lahendamine
- [x] Reaalset andmelepingut kasutav AI-mustandi olekumärgis
- [x] ET/EN/RU tõlked ja ligipääsetavus
- [x] Üksus-, integratsiooni-, regressiooni- ja brauseritestid
- [x] Lõplik diffi-, migratsiooni- ja turvakontroll ning üleandmine

## 5. Kohustuslik testimaatriks

1. kõik lubatud kontrollkuupäeva aliased annavad sama normaliseeritud tulemuse;
2. puuduv või vigane kuupäev jääb tundmatuks;
3. ajalooline ja mitteaktiivne allikas kuvab hoiatuse;
4. tagasiside endpoint lükkab tagasi täisvestluse ja võltsitud identiteediväljad;
5. duplikaat ja tunnikiiruse piirang on paralleelsete päringute korral ohutud;
6. kasutaja näeb ainult enda tagasisidet;
7. administraator näeb kõiki ning võõra ID kaudu infot ei leki;
8. lahendamine on auditeeritav;
9. AI loodud sisu ei ole vaikimisi inimese kinnitatud;
10. sisumuutus tühistab kinnituse;
11. ET/EN/RU tekstid, kuupäevavorming ja ligipääsetavad olekusildid;
12. olemasolev `displayed_sources` valik ja attribuutika ei regressi.

## 6. Üleandmislogi

### 6.1 Valminud vertikaal

- `displayed_sources` saab pärast attribuutikaotsust stabiilse `source_id`, normaliseeritud `source_checked_at`, `source_freshness` ja vajadusel `source_warning` välja;
- vanade püsivate vestlussõnumite allikad normaliseeritakse ka lugemise API-s, ilma püsivat kirjet tagantjärele muutmata;
- allikapaneel vormindab kuupäeva ET/EN/RU lokaadis, näitab tundmatut kuupäeva ausalt ning eristab aegunud, ajaloolist ja mitteaktiivset allikat;
- kasutaja saab saata ainult salvestatud assistendisõnumis serveri poolt kinnitatud allika kohta kitsast tagasisidet ja näeb enda teate viimast olekut;
- paralleelsed duplikaadid on idempotentsed, tunnikiiruse piirang on andmebaasiluku taga ning võõras sõnum või tagasiside ID annab infolekketa `404`;
- administraator näeb eraldi RAG admini vaates avatud teateid ning lahendamine kasutab oleku-CAS-i ja kirjutab samas tehingus `DataAuditLog` kirje;
- Tööheaolu tegeliku `WellbeingOutputDraft` lepingu juures kuvatakse semantiline olek `AI mustand`, `Inimese muudetud` või `Inimese kinnitatud`; muutmine viib oleku kohe tagasi inimese muudetud mustandiks ja serveri olemasolev salvestus tühistab kinnituse;
- lisati projekti algne CSS-i `!important` eelarvefail: 52 / 52.

### 6.2 Kontrollitulemused

- `npm test`: **1089/1089 korras**;
- U8 eraldi testid: **15/15 korras**;
- attribuutika, vestluse allikate ja tööheaolu regressioonivalik: **96/96 korras**;
- `npm run i18n:check`: ET/EN/RU võtmed korras;
- `npm run css:budget`: **52 / 52**;
- `npx prisma validate`: skeem korras;
- `db:migrate:check`: kõik **88 migratsiooni** rakendusid tühjale ajutisele PostgreSQL andmebaasile ja skeem jäi puhtaks;
- `npm run lint`: **0 viga**, baasis olemasolevad 359 hoiatust jäid;
- `npm run build`: Next.js tootmisbuild korras, uued kasutaja- ja admini API-d ning `/admin/rag/source-feedback` route on buildis;
- Playwrighti brauseris avanes `/vestlus`, ligipääsetav vestlusregioon ja klaviatuuriga avatav sisestus; autentimata brauseri 401-d ajaloo/ruumide API-le olid ootuspärased.

### 6.3 Auditipiir ja teadlikud piirangud

- tagasiside ei salvesta vastuse teksti, prompti, vestlust, allika pealkirja ega URL-i;
- tagasiside ei muuda ega peida vastust või allika attribuutikat;
- AI-mustandi märgist ei lisatud pindadele, kus inimese kinnituse fakti andmemudelis ei ole;
- autentitud, päris püsiva allikaga brauseri lõppvoog jääb sõltumatu järelkontrolli kontrollpunktiks; serveri omandi-, duplikaadi-, kiiruse-, no-leak- ja auditilepingud on regressioonitestidega kaetud;
- haru ei ole commit'itud ega push'itud, sest §5.7 värav nõuab enne seda sõltumatut järelkontrolli;
- `main`-i ei ole ühendatud ja deploy'd ei ole tehtud.

**Üleandmise olek:** `U8-LITE SOL VALMIS — ootab Opuse sõltumatut järelkontrolli`.

## 7. Opuse auditi parandusring — 2026-07-14

Olek: **U8-P1-1, U8-P2-2 ja U8-P2-3 parandatud; kasutaja aktsepteeris
parandused 2026-07-14 ilma uue kordusauditita.** See ei võrdu märgendiga
`OPUS HEAKS KIIDETUD`.

- Usaldusserialiseerija ei kirjuta enam identiteeti kandvat `source_type` välja
  üle. Normaliseeritud usaldustüüp asub eraldi `source_trust_type` väljal ning
  algse allika kuju säilib.
- Tagasiside server sobitab allika esmalt kinnistatud `source_id` järgi ja alles
  seejärel kasutab tagasiühilduvat attribuutika-ID arvutust. Värske vastuse voo
  `sourceId` töötab nüüd ilma lehe taaslaadimiseta.
- Kuue allikakuju invariant lukustab, et serialiseerimise eelne ja järgne
  attribuutika-ID on sama, sealhulgas `type`- ja `origin`-väljal oleva legaalse
  allika korral.
- Vigane JSON normaliseeritakse avalikuks `400 INVALID_BODY` veaks.
- Tühi sisu ei saa enam olekut `human_confirmed` isegi siis, kui vana
  `userConfirmed` lipp on `true`.
- Tunnikiiruse regressioonitest kasutab fikseeritud kontrollaega; tulemus ei
  sõltu enam sellest, millisel kellaajal test käivitatakse.

Kontrollid:

- `tests/u8/*.test.js`: **19/19 läbitud**;
- kogu `npm test`: **1093/1093 läbitud**;
- `npm run i18n:check`: ET/EN/RU korras;
- `npm run css:budget`: **52/52**;
- `npm run build`: tootmisbuild korras;
- muudetud failide ESLint: **0 viga**;
- `git diff --check`: puhas (ainult Windowsi reavahetuse hoiatused).

**Teadlik lahtine tooteotsus:** U8-P2-1 — kas vestluse kustutamisel kustutada
sellega seotud `SourceFeedback` koos kasutaja märkusega või säilitada see
teadlikult sõltumatu auditikirjena. Praeguses parandusringis seda semantikat ei
muudetud; see ei blokeeri U8 P1 kordusauditit.

Kõrvalisi ruumifaile ei puudutatud. Haru on endiselt commit'imata ja push'imata;
main-i ühendamist ega deploy'd ei tehtud. Järgmine samm on parandusringi
commit/push ning hilisem kontrollitud integratsioonirehearsal; main-i ühendamine
ja deploy jäävad eraldi otsuseks.
