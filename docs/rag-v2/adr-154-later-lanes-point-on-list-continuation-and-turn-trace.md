# ADR-154 — Hilisemate radade säte viitab edasi, loetelu järg ja admini vaade pöördele

21.10.2026. Teostus Claude Opus 5.5. Omanik 21.10: „need võiks korda saada“, ja: „admin peaks saama vajadusel
vaadata, kuidas toimus küsimuse koostamine AI poolt, kuidas see liikus läbi rag andmebaasi ja kuidas AI formuleeris
vastuse“, „ja mis on valikute põhjused“.

## 1. Hilisemate radade säte viitab edasi

**Leid (Soli test 20.10, G33).** Küsimus oli „Mu täiskasvanud pojal on alkoholisõltuvus. Kas ta saab riigi
rahastatud toetatud elamise teenust?“. Paketis oli SHS § 95, mille tekst ütleb „välja arvatud käesoleva seaduse § 72
lõikes 2 nimetatud isikul“, kuid § 72 lg 2 paketti ei tulnud. Paketis oli ainult viis lõiku, nii et ruumi oli.
Sama erand tuli § 88 (G04) ja § 98 (G34) juurde, sest need olid järjestatud lõigud.

**Põhjus (kood).** Sama seaduse viidete rada loeb järjestatud lõike ja teadmiskaartide lisatud lõike. G33 paketis
olid järjestatud artikkel ja kaks lehte, ning SHS § 94 ja § 95 tulid ADR-149 „sama asja ütleva sätte“ rajaga. See
rada jookseb pärast viidete rada, nii et § 95 viidet keegi ei lugenud. Sama kehtib küsimuses nimetatud sätte
(ADR-135) ja teise seaduse viite (ADR-063, ADR-145) kaudu tulnud sätete kohta.

**Otsus.** Pärast „sama asja ütleva sätte“ rada loetakse sama seaduse viited teist korda. Lugemine käib nende sätete
kohta, mille tõid küsimuses nimetatud sätte rada, teise seaduse viite rada või sama asja ütleva sätte rada. Kasutatakse
seda, mis esimesest lugemisest jäi üle: kuni neli viidet kokku ja sama 3000-tokenine lisaruum. Sama seaduse viite
lisatud lõik edasi ei viita, nagu varem. Mõõdik `cross_references.later_lanes` ütleb, mitu kandidaati ja lisandust
teine lugemine andis.

## 2. Kooloniga lõppeva lõigu järg

**Leid (21.10, E9).** Küsimus oli „Kas eakate päevakeskus on teenus, mida vald peab seaduse järgi kindlasti
pakkuma?“. Paketis olid sm.ee ja SKA lõigud „KOV on kohustatud osutama 13 sotsiaalteenust“, kuid teenuseid endid ei
olnud. SKA lehe lõik (208 märki) lõpeb lausega „Neist täiskasvanutele mõeldud teenused on:“. Teenused on lehel selle
all h3-alajaotistena (koduteenus, üldhooldusteenus, tugiisikuteenus …), igaüks oma lõigus.

**Otsus.** Kui valitud lõik lõpeb kooloniga, tulevad kaasa tema pealkirja all olevad lõigud dokumendi järjekorras.
Kui ühtki sellist ei ole, tuleb ainult järgmine lõik, sest siis lõikas loetelu pooleks lõigu piir. Piirid:
- kuni 10 lõiku pöörde kohta (`LIST_CONTINUATION`);
- sama lisaruum ja need kohad, mis lõpppiir jätab; midagi ei tõrjuta välja;
- ainult profiilides, kus on nimetatud aktide kohad (v4–v6), nagu ADR-149 rada.

Pealkirjatee loetakse lõigu otsitava teksti esimeselt realt („leht > jaotis > alajaotis“).

## Profiil, plaan ja indeks

Profiili (`hybrid-estnltk-chat-v6`), plaani ja indeksit ei muudeta. Kohtade ja ruumi arv on sama, muutub ainult see,
milliseid lõike loetakse, nagu ADR-145 ja ADR-149 puhul. Väljalase uuendab plaani koodi väljad ise.

Lisaruumi arvestus (`expanded`, lõpu kontekstipiir) arvestab nüüd ka ADR-149 sätet ja loetelu järge. Varem arvestas
see ainult naaberlõiku ja viidet, kuigi `add()` lasi ka ADR-149 sätte lisaruumi.

## 3. Admini vaade pöördele: `/admin/rag/chat-trace`

Iga pöörde täisaudit hoidis juba AI otsinguplaani (`searchAssist`: variandid, kohad, isik, valikumudeli kandidaadid ja
valik), paketi tõendeid koos valikupõhjuse, kanalikohtade ja RRF-i osadega ning vastuse päringut. Ühendatud pakett aga
kaotas radade oma jälje:
- kandidaatide skoorid;
- väljajäetute põhjused;
- viidete, sätete ja loetelu radade mõõdikud.

Nüüd:
- otsingu `rerank` hoiab iga kandidaadi kanalikohad, RRF-i osad ja skoori (`fused`, kandidaatide järjekorras);
- vestluse otsing annab `lane_audit` (`rag-v2/lane-audit-1`): iga raja kandidaatide valik, väljajäetute põhjuste arv ja
  valikumudeli lugemisest väljajäetud koos põhjusega, ning radade mõõdikud;
- see salvestatakse pöörde päringuauditi (`requestAudit.laneAudit`) juurde, mitte paketti, sest paketi suuruse piir
  jääb samaks. Kirjutatakse üks kord;
- säilitusreegel (ADR-093) laseb selle lahti koos päringu kehaga.

**Vaade** (`lib/rag-v2/pilot/turn-trace.js`, `components/admin/rag/ChatTurnTrace.jsx`) näitab admini enda vestluste
pöördeid, uuemad eespool. Sisu:
1. küsimus, roll, juhise versioon, profiil ja plaan;
2. AI otsinguvariandid ja kohad;
3. rajad ja kandidaatide arv kanalites;
4. kandidaadid, mille valikumudel luges, koos skooride, valiku ja lõpliku viitega;
5. iga tõend koos põhjusega (järjestatud, viide lõigust S2, sama asja ütlev säte, loetelu järg …), allikakaardi,
   pealkirjatee ja tekstiga;
6. lisarajad ja väljajäetud;
7. vastus;
8. juhis, rolli tekst ja tõendid nii, nagu AI need sai;
9. selgitus, kuidas otsing valib, selle pöörde profiili numbritega.

Teiste kasutajate vestlusi vaade ei näita. See on isikuandmete küsimus ja vajab omaniku eraldi otsust.

## Kontroll

Kohalik kontroll tehti päris `retrieve()` koodiga mälus olevate väljamõeldud dokumentide peal, võrguühendusteta
(kustutatud `tests/rag-v2-graph-experiment.test.mjs` rakis):
- Korra lõik nimetab „sotsiaalhoolekande seaduse § 25 lõikes 2“. Seaduse rada lisab selle lõigu. Lõigu tekst ütleb
  „välja arvatud käesoleva seaduse § 24“, ja teine lugemine lisab § 24 (`later_lanes` 1/1). v3 ei lisa midagi.
- Kooloniga lõppev lõik toob kaks alajaotist, kuid mitte naaberteemat.
  - Ilma kooloniga ei tule midagi.
  - Kui alajaotisi ei ole, tuleb ainult järgmine lõik.
  - v3-s ei tule midagi.
- `fused` on iga kandidaadi kohta olemas.
- Jälje koostaja annab pöörde reast rolli, juhise versiooni, valikumudeli valiku, tõendite põhjused („lõigust S1“),
  pealkirjateed ja profiili numbrid.
- Säilitusreegli järgi lahti lastud pöördes ei ole radade auditit.
- Vaade renderdub serveris nii täis kui ka lahti lastud pöördega.

Testid: `rag-v2-pilot-crisis-route`, `deploy-plan-release`, `rag-cost`, `rag-v2-capacity`, `rag-v2-corpus-run`,
kaks kustutamise testi ja `server-message-keys` läbisid.

**Kontrollimata:** mõju päris indeksil. Kordustest serveris samade küsimustega (G33, E9 jt) on eelregistreeritud
(`docs/audits/vestlustest-2026-10-21-juhis46-eelregistreering.json`), ja selle jälg loetakse uuest vaatest.
