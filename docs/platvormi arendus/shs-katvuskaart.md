# SHS katvuskaart — sotsiaalhoolekande seadus vs SotsiaalAI platvorm

Koostatud 29.07.2026 (Claude). Allikas: `docs/sotsiaalhoolekandeseadus.txt` (täisstruktuur
läbi käidud, võtmeparagrahvid loetud). Küsimus: mida seadus reguleerib, mida platvorm veel
ei kata — uued ideed ja integreerimata teenused.

## 1. Mis on juba kaetud (kinnitus, et tuum istub seadusel)

| SHS | Platvormil |
|---|---|
| § 3 põhimõtted; § 9 juhtumikorraldus; § 15 hindamiskohustus | eelkaardistus (STAR2 juhendi 7 valdkonda), vastuvõtulaud, kandjapiir |
| § 8 vältimatu sotsiaalabi | kriisirada (fail-closed kontaktid) |
| § 11 statistika | s-veebi väljund (Teenuspäevik mall D) |
| § 16 tasu / omaosalus | Teenuspäeviku omaosalusväljad; taskukohasuse printsiip |
| § 17–29 koduteenus, tugiisik, isiklik abistaja | Teenuspäeviku tuumjuhud (tunnid, märked, aruanded) |
| § 141–145 STAR | STAR-strateegia analüüs; E9 valmidus. **§ 144 paneb andmete kandmise kohustuse ka TEENUSEOSUTAJALE** → E9 pole mugavus, vaid seadusekohustuse täitmise abi |
| § 146 vaidemenetlus | „selgitame, ei esinda" piir (D3) |
| § 157–159 järelevalve + kvaliteedipõhimõtted | kvaliteedijuhise kiht, Riigikontrolli vastavus |

## 2. AVASTUSED — uued ideed, mida üheski registris veel polnud

### A1. Erihoolekande profiil Teenuspäevikule (§ 70–107) — SUURIM LEID

§ 85 kohustab erihoolekande osutajat: personaalne TEGEVUSPLAAN **koos isikuga** 30 päeva
jooksul; teenuseosutaja hinnang tegevuste elluviimise kohta **vähemalt kord kvartalis**;
**kord aastas kirjalik hinnang** 12 kuu kohta. See on seadusega ette kirjutatud
aruanderütm, mille Teenuspäevik katab peaaegu muutmata (suunamisotsus §71 = meie Referral;
tegevusplaan = suunamise eesmärgid + tegevuskataloog; kvartalihinnang = mall C rütmiga).
Kasutajaskond: **tegevusjuhendajad** (ESTA küsitluse suurrühm!) viies teenuses (IET, TT,
toetatud elamine, kogukonnas elamine, ööpäevaringne). „Koos isikuga" on SEADUSES —
CLIENT_VIEW suund saab §-tugevuse. → TEENUSPÄEVIK OSA III kandidaat.

### A2. Toimetulekutoetuse eelkalkulaator (§ 131–134)

Arvestusvalem on seaduses deterministlik (toimetulekupiir + eluasemekulud − sissetulekud;
piirid ja erandid täpselt kirjas). Pöördujale: „kas mul VÕIB olla õigus ja umbes kui
palju" — informatiivne eelhinnang selges keeles, koos dokumentide checklistiga taotluse
jaoks. PIIR: see EI ole otsus (otsustab KOV § 134; AI-piir hoitud — kalkulaator on
aritmeetika + selgitus, mitte hinnang). Õiguskantsleri seisukohad (uudiskirjakorjest)
näitavad, et määramata jätmise vaidlusi on palju — eelselgus vähendab mõlema poole koormust.
→ pöörduja raja tapjafunktsioon; kontota avalik versioon = SEO-uks.

### A3. Abivahendi teekonna selgitaja (§ 46–55)

Riigi süsteem on samm-sammult seaduses: õigustatus (§47) → abivahendite LOETELU (määrus,
§48) → piirhind/omaosalus (§50) → taotlemine (§51) → müüja/üürija (§55 nõuded). Täielikult
struktureeritav rada: „mis abivahendit vajan → mis tõendit vaja → kui palju maksab → kust
saab". Eelkaardistus juba puudutab abivahendeid; sm.ee abivahendite juhend oli
uudiskirjakorjes. → pöörduja teekonna moodul + müüjad Teenusekaardile.

### A4. Tegevusloa/MTR-kontroll teenuseprofiilil (§ 147–155)

Loakohustusega teenused on seaduses loetletud (rehabilitatsioon §147; § 151 loetelu:
asendushooldus, turvakodu, lapsehoid, erihoolekanne, üldhooldus jt). Majandustegevuse
register on avalik → teenuseprofiil saab NÄIDATA (ja kontrollida) tegevusloa olemasolu.
See on usaldusmärgistuse OBJEKTIIVNE komponent — mitte meie hinnang, vaid riigi register.
→ Teenusekaardi/profiili arendusse (osutaja-paketi aste 1).

### A5. Võlanõustamise eelkaardistus (§ 44–45)

Heaolu arengukava nimetab võlaprobleemi kasvavana; SHS defineerib teenuse. Eelpöördumise
erikuju: võlgade-eelarve kaardistus + dokumentide kogumine ENNE nõustamist (nõustaja aeg
läheb sisule, mitte info korjamisele) — sama loogika mis eelpöördumisel. → eelkaardistuse
teine profiil.

### A6. Sotsiaaltransport Teenuspäeviku teenusetüübina (§ 38–40)

Ühik = kord/sõit + km (E12 sobib täiuslikult); tasu võtmine reguleeritud (§40). Osutaja
pool: sõidud kirjetena, kuuaruanne KOV-ile. Pöörduja pool: „kuidas tellida" info KOV-iti.
→ Teenuspäeviku teenusetüüp (peaaegu tasuta kaasa) + infokiht.

### A7. „Teata abivajajast" avalik juhis (§ 13)

§ 13 paneb IGAÜHELE kohustuse teatada abi vajavast isikust KOV-ile. Avalik kontota leht:
„märkasid naabrit/lähedast, kes vajab abi — mida teha" + Teenusekaardi õige KOV-kontakt.
Kodanikufunktsioon, mis on ühtaegu seadusekohustuse tugi ja SEO-uks. → avalik sisu-kiht.

### A8. Hooldekodu valiku rada (§ 20–22²)

Hooldereformi rahastusmudel (§ 22¹: hoolduskulud KOV, majutus-toitlustus inimene),
hooldusplaan (§ 21), nõuded (§ 22²) — pöördujate sagedasim eakate-küsimus („kuidas valida,
mis maksab, kes maksab") on seadusest selgitatav. → pöörduja teekonna moodul.

### A9. Kriisirežiimi seaduslik konks (§ 13¹)

Eriolukorra/sõjaseisukorra erisätted on SHS-is olemas (kvalifikatsioonileevendused,
tähtaegade peatumine, 95% kohatasu hüvitis). Meie kriisirežiimi idee (registris) saab
§-viite — mitte spekulatsioon, vaid seaduses ette nähtud olukorra tugi.

### A10. Väiksemad märked

- Rehabilitatsioon (§ 56–69): rehameeskonnad = tulevane osutajaskond; SKA-aruandluse
  profiil Teenuspäevikule hiljem; pöördujale rehab-teekonna selgitus.
- Perepõhise asendushoolduse tugiteenused (§ 130⁶–130¹¹): hooldusperede mentorlus/tugi —
  kaugem sahtel (lastekaitse-domeen).
- Viipekeele kaugtõlge + kirjutustõlge (§ 130¹²–130¹⁵): ligipääsetavuse info; kauge
  sugulus meie STT/subtiitrite kihiga.
- § 12 (isiku tahte arvestamine) + § 85 „koos isikuga" = kliendi kaasamise seaduslik
  selgroog — toetab CLIENT_VIEW ja U10 suunda.
- Täisealise isiku hooldus (§ 26): hooldaja määramine + toetus = omastehooldaja ruumi
  (registris) seaduslik kontekst.

## 3. Kolm järeldust

1. **Teenuspäevik kasvas seadusega:** erihoolekanne (A1) ja sotsiaaltransport (A6) on
   loomulikud profiilid; § 144 teeb E9-st seadusekohustuse abi; § 85 rütmid = mall C
   kvartali-/aastarežiim.
2. **Pöörduja rada sai kolm uut moodulikandidaati** (A2 kalkulaator, A3 abivahendid,
   A8 hooldekodu) + kaks avalikku sisu-ust (A7 teata-abivajajast, A2 avalik versioon).
3. **Usaldusmärgis sai objektiivse aluse** (A4 MTR-kontroll) — riigi register, mitte
   meie arvamus.
