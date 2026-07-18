# Ruumilised lehe-faasid — leht 3D-ruumis, üks ekraan, null kerimist

Kuupäev: 15.07.2026
Staatus: **teoreetiline lähtealus + kolm töönäidet** (hüpoteesitasand; rakenduskoodi ei muudetud)
Ulatus: platvormiülene muster — Kovisiooni jaoks tuletatud reeglid (KOV-R) üldistatuna igale pikale lehele/vormile
Seotud: `fable-5-kovisiooni-tervikvoo-teadmistekaart.md` (R5.0 lõuendireegel, R5.7 lehed, R5.8 liikumishierarhia); `ruumilise-kogemuse-lahtekoht.md` **[RL]** (§4.2 muutuv stuudio, §4.3 lennuteekond, §10 ligipääsetavus)

---

## 1. Probleem: kerimisleht

Kasutaja kinnitatud põhihäiring (15.07): *elemendid ei mahu ühele ekraanile; tabeleid ja kaste tuleb alla kerida; lõuend on poolikult ekraanil.* Tõendid kolmest eri moodulist:

| Leht | Mis kerib | Tõend |
|---|---|---|
| Kovisiooni etapid 1–8 | kest ise on kerimiskonteiner; komposer/etapipaneelid ekraani all | KOV-R R1-P0 (covision-live.css:17, :614) |
| Dokumendi koostamine | üks pikk vorm: eesmärk → mall → väljundi tüüp (virnastatud suured valikunupud) → … → agendivestlus → mustand | kasutaja kuvatõend 15.07; UX-kaardistus 11.07 („valikuid on enne esimese juhise andmist liiga palju") |
| Tööheaolu / Tööprotsessid | paneel sisekerimisega: väljad jätkuvad allpool murdejoont; tulemuse tekst kuvatakse ENNE vastamist | kasutaja kuvatõend 15.07 (`docs/platvormi arendus/tööheaolu/`); UX-kaardistus („kiirkontroll mõjub pika küsimustikuna") |

Kerimine ei ole neutraalne: see peidab primaartegevused, lõhub „kus ma olen" tunde, kuvab kõik otsused korraga (koormus) ja teeb lehe mõõtmatuks. Reegel, mille poole liigume: **ekraan on lõuend, mitte aken lindile — info liigub, ekraan mitte.**

## 2. Teooria: leht kui ruum

Kuus väidet, millel muster seisab:

1. **Kerimine on 1D-virn.** Tavaleht paneb kõik sisuplokid üksteise alla Y-teljel ja laseb vaateaknal libiseda. Kõik eksisteerib korraga → kõik konkureerib tähelepanu pärast → midagi on alati „allpool".
2. **Ruumiline leht on faaside jada sügavuses.** Sisu lõigatakse **kavatsuse järgi faasideks** (üks otsus või otsuste rühm = üks faas) ja faasid paigutatakse Z-teljele (või vahetatavatele pindadele). Ekraanil on korraga ÜKS aktiivne tööpind + püsiraam. Järgnevus = sügavus; valik/võrdlus = külgnevus samal pinnal; privaatsus = sügavaim/eraldi kiht (KOV-R R5.7).
3. **Liikumine on tähenduslik, mitte dekoratiivne.** Liikumise suurus kannab struktuuri taset (R5.8 H4): suur tõuge = suur üleminek (etapp/samm), mikro-tõuge = faas sama asja sees, flip = vaatevahetus (olekut ei muuda), esiletõus = fookus pinna sees, voltimine = minevik kättesaadavaks ilma ruumi võtmata.
4. **Vastused voltuvad, vabastades pinna.** Tehtud otsus ei jää suure juhtelemendina ekraanile — ta kokkub kinnituskiibiks püsiribal (ankrurida). Nii saab järgmine faas ruumi ja senine seis on ühe pilguga loetav. See on kerimise otsene asendus: mitte „keri üles vaatama, mida valisid", vaid „valik on ankrus".
5. **Tulemus on teine leht, mitte lehe lõpp.** Kasvav väljund (mustand, kokkuvõte, pilt) elab paralleelsel lehel, kuhu saab IGAL hetkel flip'iga vaadata ja tagasi — mitte lehe põhjas, kuhu keritakse (R5.7 H1 üldistus: TÖÖPIND ↔ TULEMUS).
6. **Ruumimälu asendab kerimismälu.** Inimene mäletab „kus miski asub" paremini kui „kui sügaval lindis miski oli" [RL §4.1]. Fikseeritud tsoonid (ankur alati üleval, värav alati all, sahtel alati serval) teevad lehe õpitavaks ühe kasutuskorraga.

## 3. Pindade ja liikumise grammatika (platvormiülene)

| Võte | Millal | Näide |
|---|---|---|
| **Kate** (pinna sisu vahetus paigal) | faasist faasi SAMA töö sees | küsimusteplokk 2 → plokk 3 |
| **Mikro-tõuge** (~0,2 s sügavusnihe) | katte vahetuse rütmimärk | faasiriba samm edasi |
| **Suur tõuge** (~0,5 s) | suure üksuse vahetus | Kovisiooni etapivärav; „Koosta mustand" käivitus |
| **Flip** (leht ↔ leht) | töö ↔ tulemus / ühine ↔ minu; ainult vaade | mustandi piilumine keset tööd |
| **Esiletõus + hämardus** | üks objekt fookusesse pinna sees | aktiivne valik, ettelugemine |
| **Voltimine** | tehtu/minevik kättesaadavaks ilma pindala võtmata | vastuste kiibid ankruribal; eelmiste faaside kaustad |
| **Sahtel/kiht** | sekundaarne valija või privaatala pinna peale | dokumentide valik; privaatmärkmik |
| **Dokk** | kahe objekti seose loomine samal pinnal | ressurss ↔ võimalus (Kovisioon e6) |
| Keelatud | — | kerimine primaarsisu/-tegevuse kättesaamiseks; kolmas paralleelne täisleht; karussell/heliks ühistöö pinnal |

## 4. Muutumatud reeglid (iga ruumilise lehe leping)

1. **Lõuendireegel:** leht mahub tervikuna ekraanile referentsresolutsioonidel **1920×1080 ja 1536×864**; kest ei keri kunagi. Ainus lubatud sisekerimine on ühetaolise LOENDI turvaklapp oma konteineris (palju kaarte/ridu) — mitte kunagi väljade, juhiste ega nuppude kättesaamiseks.
2. **Fikseeritud tsoonid, alati nähtavad:** pealkiri/ankur (mis asi + kogunevad kinnitused), olekurida (faas/samm + kes-mida), primaartegevus/värav (CTA + ausad põhjused, miks lukus), väljapääs, info-ⓘ. Need EI liigu faasidega kaasa.
3. **Vaatamine ≠ tegutsemine:** flip, voltimise avamine, info-kiht ega ükski liikumine ei muuda olekut; olekut muudavad ainult nimelised nupud.
4. **Ausad algolekud:** ühtegi valikut ei eeltäideta „keskmisega"; vastamata = vastamata; tulemus/tõlgendus ilmub alles pärast sisendit (Tööheaolu õppetund).
5. **Värav põhjustega:** lukus CTA ütleb loendina, mis puudu; mitte kunagi paljas hall nupp.
6. **Ligipääsetavuspariteet:** iga faas/pind on `region` nimega; klaviatuuril tsoonitsükkel + faasiliikumine; `prefers-reduced-motion` → kõik liikumised hetkvahetuseks sama tähendusega; `view`-parameeter või samaväärne otselink taastab pinna; ekraanilugeja kuuleb ankruriba kiipe („valitud: …").
7. **Ekraanieelarve** (suunis, mitte piksliseadus): püsiraam kokku ≤ ~30% kõrgusest (ülaraam ~18%, värav ~8%, varu ~4%); aktiivne tööpind ≥ ~65%. Kui faasi sisu eelarvesse ei mahu → **jaga faas kaheks**, mitte ära vähenda kirja ega luba kerimist (R5.0 p 6).
8. **Jõudlus:** blur-pindadel ei animeerita transformi (kehtiv plaformireegel); ainult compositor-omadused; Galaxy-taust arvestatud.

## 5. Teisendusretsept: pikast vormist ruumilisteks faasideks

1. **Inventuur:** loetle lehe kõik üksused ja liigita: otsus / sisend / juhis / tulemus / tegevus.
2. **Faasilõikus kavatsuse järgi:** rühmita otsused nii, et üks faas vastab ühele küsimusele, mida kasutaja endalt küsib („mida ma teen?" → „millest lähtume?" → „kuidas vormistame?" → „tee ära" → „vaatan üle").
3. **Määra püsiraam:** mis on ankur (asja identiteet), mis olekurida, mis värav. Kõik juhised, mis praegu korduvad iga välja kohal, kolivad info-ⓘ kihti või faasi ühe-realiseks juhtlauseks.
4. **Voltimisplaan:** iga faasi kinnitatud väljund = kiip ankrureal (klõpsatav → viib faasi tagasi vaatama/muutma, kui lubatud).
5. **Tulemuse leht:** määra, mis on kasvav väljund, ja tee sellest flip-leht (mitte lehe lõpp).
6. **Väravad:** mis peab olema valitud enne käivitust; sõnasta põhjused kasutaja keeles.
7. **A11y + reduced-motion + mobiil:** kitsal ekraanil muutuvad faasid järjestikusteks lehtedeks-sammudeks SAMA olekumasinaga (mobiilierand kerimisele kehtib ainult seal).
8. **Mõõt:** kaks referentsresolutsiooni, 0 kesta-kerimist, primaartegevused nähtavad igas faasis.

---

## 6. Näide A — Kovisiooni etapp (referentsteostus)

Täiskirjeldus on KOV-R-is (R5.4–R5.8); siin ekraanikaart, mis näitab mustrit puhtal kujul (etapp 3 „Uurimine", faas „vaikne kirjutamine"):

```text
┌─ IDENTITEEDIRIBA: juhtum · kellad · roll · Vajan tuge · Paus ────────────┐  ~6%
├─ ANKRURIBA: „Kuidas hoida vastutust selgena?" + kinnitatud: [pilt ✓]────┤  ~5%
├─ STEPPER 1…8 + FAASIRIBA: ● ● ○ „Vaikne kirjutamine — sinu leht" ───────┤  ~7%
│                                                                          │
│  RING        ┌──────────── AKTIIVNE TÖÖPIND (kate) ─────────────┐  KOMPASS
│  osalejad    │   ÜHINE LEHT  ↔  [MINU LEHT ●]  (flip, 1 žest)   │  etapi   ~66%
│  + valmis-   │   Minu küsimuste mustandid (⌁ ainult sina)       │  juhis
│  olekutäpid  │   [+ kaart]  [mustand 1]  [mustand 2]            │  + ⓘ
│              └───⌃ ainus lubatud sisekerimine: kaartide loend───┘
├─ VÄRAV: „Liigu peegeldusringi" — lukus: ☐ ≥1 jagatud küsimus ☐ omanik… ─┤  ~8%
└──────────────────────────────────────────────────────────────────────────┘
```

Faasid vahetuvad katte + mikro-tõukega (juht); etapp suure tõukega (värav); Ühine↔Minu flip igal hetkel (ainult vaade; e4-s omanikul lukus Minu peale); eelmised etapid = kaustad laua serval; iga etapi ⓘ = etapikaart; kesta ⓘ = Kovisiooni teejuht.

## 7. Näide B — Dokumendi koostamine

**Praegu** (kuvatõend): üks kerilind — „Töö eesmärk" juhis, mall + hoiatus, „Väljundi tüüp" virnastatud täislaiusnuppudena (Kohtumise kokkuvõte / Juhtumikokkuvõte / Eelpöördumise kokkuvõte / …), edasi allpool sihtrühm, toon, dokumendid, agendivestlus, mustand; ülal kaks ⓘ-nuppu kõrvuti (infokiht dubleeritud — korrastada nagu R5.8: üks ⓘ = lehe teejuht). Varasem UX-leid: „Juhtumikokkuvõte kuvatakse tüüpides kaks korda; helifaili töövoog nähtav ka ilma helifailita; koostamist ei saa alustada ilma valitud failita, kuigi kirjeldus jätab teise mulje."

**Ruumiline ümberlõige — faasid:**

| Faas | Küsimus kasutajale | Pinnal | Voltub ankrusse |
|---|---|---|---|
| 1 Väljund | „Mida koostame?" | tüübid valikukaartidena ruudustikus (2×4), üks fookuses korraga; dubleerivad tüübid ühendatud | `[Kohtumise kokkuvõte]` |
| 2 Suund | „Kellele ja kuidas?" | sihtrühm + toon + keel + pikkus — 4 kompaktset kiipvalikurida ühel pinnal | `[kliendile · lihtne · et · lühike]` |
| 3 Lähtematerjal | „Millest lähtume?" | 3 allikaplokki: mall / dokumendid / heli — igaüks avab SAHTLI (kiht pinna peal), mitte uut lehte; heliplokk renderdub AINULT kui tüüp seda toetab | `[mall: –] [2 dokumenti] ` |
| 4 Koostamine | „Tee koos agendiga" | agendivestluse komposer + viimane vahetus; MUSTAND kasvab teisel lehel | — |
| 5 Ülevaatus | „Kas sobib?" | = TULEMUSE LEHT muutub aktiivseks: mustand + Salvesta / Muuda / Laadi alla | `[mustand v3 ✓]` |

**Kaks lehte:** `TÖÖPIND ↔ MUSTAND` — flip igal hetkel alates faasist 1 (enne genereerimist näitab MUSTAND ausalt struktuuri-eelvaadet „siia tekib …"). See asendab praeguse „mustand on kusagil all" kerimise.

**Püsiraam:** ankur = „Dokumendi koostamine → [kiibid]"; olekurida = faasid 1–5; värav = „Koosta mustand" põhjustega („vali väljundi tüüp; see tüüp vajab vähemalt ühte dokumenti"); üks ⓘ.

**Ekraanikaart (faas 3, dokumendisahtel avatud):**

```text
┌─ ANKUR: Dokumendi koostamine · [Kohtumise kokkuvõte] [kliendile·lihtne] ─┐
├─ FAASID: 1✓ 2✓ ③ Lähtematerjal 4 5      TÖÖPIND ↔ MUSTAND (flip) ───────┤
│  ┌───────────── AKTIIVNE PIND ─────────────┐                            │
│  │  Mall: [Ilma mallita ▾]                 │   ┌─ SAHTEL (kiht) ──────┐ │
│  │  Dokumendid: [vali ▸]  ── avab sahtli ──┼──▶│ ⌕ minu failid        │ │
│  │  (Heli: pole selle tüübi juures)        │   │ ☑ intervjuu.m4a …    │ │
│  └─────────────────────────────────────────┘   │ [Lisa valitud]  Esc  │ │
│                                                 └──────────────────────┘ │
├─ VÄRAV: „Koosta mustand" — lukus: ☐ vähemalt 1 dokument ─────────────────┤
└───────────────────────────────────────────────────────────────────────────┘
```

## 8. Näide C — Tööprotsessid (Tööheaolu tööriist)

**Praegu** (kuvatõend): modaalpaneel sisekerimisega; ülal tõlgendustekst „Vajab töökorralduslikku muutust" ENNE kui kasutaja on midagi vastanud; all fieldset „Töövoo üldpilt" dropdown'idega, mille väärtused paistavad eeltäidetuna („Kõrge") — varasem UX-leid: „vaikimisi keskmised väärtused annavad kohe kollase signaali; kasutaja näeb tulemust enne, kui on teadlikult vastanud."

**Ruumiline ümberlõige — faasid:**

| Faas | Pinnal | Voltub |
|---|---|---|
| 0 Lävi | privaatsuslubadus („Ainult sina näed; midagi ei saadeta") + fookuse valik („mida uurime: dokumenteerimine / katkestused / koosolekud / …") | `[fookus: dokumenteerimine]` |
| 1…n Plokid | **2–4 seotud küsimust korraga** kaartidena, KÕIK vastamata olekus (mitte „Kõrge" eeltäide); vastus = teadlik valik | iga plokk → kiip `[üldpilt ✓]` |
| n+1 Pilt | kirjeldav muster (mitte skoor): „Märkisid kõrge dubleerimise ja sagedased ümberlülitused" + ÜKS soovitatud järgmine samm | — |
| n+2 Otsus | Salvesta privaatselt / määra järelkontroll / koosta jagatav mustand (eraldi teadlik voog) | `[salvestatud ⌁]` |

**Kaks lehte:** `KÜSIMUSED ↔ MINU PILT` — pilt koguneb flip-lehel reaalajas vastatud plokkidest, aga TÕLGENDUS (faas n+1) avaneb alles siis, kui plokid on läbitud → tulemus ei jookse sisendist ette, kuid uudishimu („mis mul seni koos on") on ühe žestiga rahuldatav.

**Püsiraam:** ankur = tööriista nimi + ⌁ „Ainult sina näed" (privaatsuslubadus on PÜSIV, mitte kord loetav tekst); olekurida = plokikiibid; värav = „Vaata pilti" (lukus kuni plokid vastatud, põhjusega „2 plokki vastamata"); Esc/välju salvestab poolelioleva mustandina.

## 9. Hüpoteesid ja testimine

See fail on hüpoteesitasand. Testimisjärjekord:

1. **Kovisiooni prototüüp** (KOV-R R11) testib aluse: lõuendireegel, flip, faasikate, liikumishierarhia, väravanimekiri — kriteeriumid 12–14, sh blokeeriv 0-kerimine.
2. Kui alus peab, on **järgmised kandidaadid täpselt näited B ja C** — mõlemad on üksikkasutaja lehed (lihtsam kui mitmeosalejaga sessioon), mõlemal on olemasolev andme-/API-kiht, mida EI muudeta (ainult esituskiht), ja mõlema valu on kuvatõenditega kinnitatud.
3. Mõõdikud samad: 0 kesta-kerimist mõlemal referentsresolutsioonil; kasutaja vastab suvalisel hetkel „mis faasis oled / mida sinult oodatakse / kuhu su valikud said"; flip'i mõistetavus; reduced-motion/klaviatuuri pariteet; ülesande lõpetamise aeg mitte halvem kui kerilehel.

## 10. Millal kerimine ON õige

Ausalt: muster ei sõja kerimise kui sellisega, vaid kerimisega kui STRUKTUURI asendajaga. Kerimine jääb õigeks: pikk ühtlane LUGEMISTEKST (teejuht, praktika-artikkel raamatukogus, kasutustingimused); homogeenne LOEND oma konteineris (kaardid, otsingutulemused — turvaklapp); MOBIIL (kitsas ekraan: faasid = sammud, mille sees loomulik vertikaalvoog); vestluse ajalugu. Reegel: kerida tohib SISU, mitte STRUKTUURI — juhised, otsused, tegevused ja olek ei tohi kunagi olla „allpool".

---

*Fail loodud 15.07.2026 kasutaja suunisel; ainult dokument, rakenduskoodi ei muudetud. Kolm näidet kasutavad aktiivse main-i lehti ainult esituskihi ümberlõikena — ükski andme-, API- ega õiguste leping ei muutu. Kovisiooni näite täismudel ja teostuspaketid: fable-5-kovisiooni-tervikvoo-teadmistekaart.md (KOV-R).*

---

## Ruumilise töölaua alumine dokk, faasid ja võrdlusriiul

Kuupäev: 15.07.2026
Koostaja: Fable 5
Staatus: piiritletud jätkuanalüüs (ainult dokument; rakenduskoodi ei muudetud; kuvatõmmiseid ei korratud, KOV-R analüüsi ei korratud)
Küsimus: **kuidas ühendada SotsiaalAI olemasolev alumine ruumimenüü ja lehesisene ruumimudel „Fookus → Võrdlus → Ülevaade" ilma topeltnavigatsiooni tekitamata?**
Alused (loetud täies mahus): teadmistekaart ptk 1–11 + KOV-Q1/Q2 + KOV-R; selle faili ptk 1–10; `fable-pildid/kovisioon-tervikvoog/README.md` + kõik 15 PNG-d; [RL] §9.1 (ruumiülene juhtpaneel), §4.3 (flight-piirid).
Koodiseis, kontrollitud: **alumist dokki koodis veel EI OLE** — ruumi püsiv juhtpaneel on ÜLEMINE (`RoomQuickbar` → `.room-topbar`), ruumi navigatsioonikaardid elavad karusselli alumises servas (`carousel.css` bottom ≈5–7,5%), Kovisiooni kestad kasutavad kolme eri navigatsiooniparadigmat (pill-nav [PILT 01], HUD „Tagasi Kovisiooni valikusse" [PILT 02–09], külgmenüü [PILT 10, 010802]) — see ongi KOV-R R1-P1. Dokk on seega kasutaja lukustatud tooteotsus, mille **leping** fikseeritakse siin; teostus tuleb hiljem.

### FQ0. Vastus ühe lõiguna

Topeltnavigatsioon välditakse **kolme tasandi range sõnavaralahususega**: alumine dokk vastab ainult küsimusele „**kus ma platvormis olen** ja kuidas tagasi/kõrvale saan"; lehesisene faasiriba vastab ainult küsimusele „**kus ma tööprotsessis olen** ja mis viib edasi"; vaaterežiim (Fookus/Võrdlus/Ülevaade) vastab ainult küsimusele „**kuidas ma praegust sisu vaatan**" ega muuda kunagi ei asukohta ega tööolekut. Dokk **asendab** kolm senist paradigmat (pill-nav, külgmenüü, HUD-tagasi-nupud) — ta ei lisandu neile; faasiriba ei sisalda kunagi ruumilinke; vaaterežiim ei sisalda kunagi faasinuppe. Võrdlusriiul on doki kohal elav platvormikihi element, mille sisu on alati **viited** (mitte koopiad) ja mille render käib läbi samade serveri-õiguste — seega ei saa võrdlus kunagi näidata midagi, mida Fookus-vaade ei näitaks.

### FQ1. Navigatsiooni kolm tasandit (nõue 1)

| Tasand | Küsimus, millele vastab | Element | Sõnavara (näited) | Mida EI sisalda kunagi |
|---|---|---|---|---|
| **L1 — ruum** | kus ma platvormis olen; kuidas tagasi/otse | **alumine dokk** (platvormikiht) | alade nimed („Kovisioon · Esik", „Teekond"), „←" tagasi-tee (hierarhia, mitte ajalugu), otseteed | faasinuppe, väravaid, salvestamist, töö-CTA-sid |
| **L2 — töö** | kus ma tööprotsessis olen; mis viib edasi | **faasiriba** lehe ülaosas (Kovisioonis stepper+faasiriba [KOV-R R5.4]; teistel lehtedel selle faili §5 retsept) | etapi/faasi nimed, värav põhjustega, nimeline CTA | ruumilinke, „tagasi lehele X" linke |
| **L3 — vaade** | kuidas ma praegust sisu vaatan | **vaaterežiim**: Fookus (vaikimisi) · Võrdlus · Ülevaade | „Ülevaade", „Võrdle", „Sulge võrdlus" | olekumuutvaid tegevusi; midagi, mis liigutaks L1/L2 |

**Topeltnavigatsiooni välistusreeglid (asendused, mitte lisandused):**

1. Teemaseemnete pill-nav [PILT 01], järelkihi külgmenüü [PILT 10, 010802, 011446] ja sessiooni „Tagasi Kovisiooni valikusse" [PILT 02–09] **kaovad** — kõik kolm rolli võtab dokk. KOV-R P1 „majanavi" teostatakse **doki sees** (Kovisiooni toad = doki ala-kaart), mitte eraldi komponendina — see on P1 täpsustus, mitte uus pakett.
2. Ülemine `RoomQuickbar` jääb **süsteemipaneeliks** (heli, ligipääsetavus, seaded, ruumist väljumine — [RL] §9.1); dokk on **liikumispaneel**. Funktsioonid ei kattu kunagi: „Välju"/X jäävad üles, „←" tagasi-tee elab ainult dokis.
3. Brauseri back/forward liigub **vaadete ajaloos** (KOV-R R6: view-tasand), doki „←" liigub **struktuurihierarhias üles** (sessioon → esik → maja → ruum). Kaks eri asja, kaks eri silti; kumbki ei muuda kunagi tööolekut.
4. Dokil on **kaks olekut**: *täisdokk* ala-lehtedel (riiulid, loendid, raamatukogu) ja *dokisang* süvatöös (Kovisiooni sessioon, dokumendi koostamise faasid, Tööprotsesside plokid, Teekonna kirjutamine) — kinnises töös taandub dokk õhukeseks servasangaks (ala nimi + „←"), avaneb klõpsu/klahviga kihina ega võistle kunagi lehe enda väravariba/juhipuldiga. Alumise serva kihikord süvatöös: **lehe töökiht (värav/juhipult) ülal, platvormikiht (sang + riiulipill) kõige all, visuaalselt tumedam ja õhem**.
5. Ekraanieelarve (selle faili §4 p 7 jääb kehtima): ala-lehtedel dokk ≤8% + riiul ≤5% (ainult kui mitte-tühi); süvatöös värav ~8% + sang ≤3% → alumine serv kokku ≤11%, ülaraam ~18%, tööpind ≥65%. Kui riiul ja värav korraga ei mahu, kaob riiul kompaktpilliks sanga kõrvale, MITTE värav.

### FQ2. Faas vs vaaterežiim (nõue 2)

Need on **ortogonaalsed teljed**: faas on serveri/töö olek (muutub ainult nimeliste, väravatega tegevustega — Kovisioonis juhi värav [KOOD ptk 3], mujal kasutaja „Kinnita/Jätka"); vaaterežiim on kliendi esitusvalik (ei muuda kunagi olekut — Q2.0 p 1 „vaatamine ≠ tegutsemine"). Konkreetselt:

- **Fookus** = üks aktiivne tööpind + püsiraam (selle faili §2–4 vaikemudel).
- **Ülevaade** = lehe kõigi pindade/faaside kaart lugemisrežiimis: iga faas kaardina (läbitud ✓ / aktiivne / ees-lävi), klõps kaardil viib **Fookusesse sinna vaatama** (läbitud → kaust-lugemine; aktiivne → elav; tulevane → lävi „avaneb väravaga"). See on KOV-Q2 V3 „lugemiskaardi" lehesisene kehastus — ja ühtlasi **kohustuslik mitte-žestiline faasivahetustee**: ratas/svaip ei ole kunagi ainus viis liikuda (nõue: alati ka nupud faasiribal + Ülevaate klõps + klahvid `[`/`]`).
- **Võrdlus** = kaks pinda kõrvuti (FQ3–FQ4); avaneb ainult riiuli kaudu.
- Flight on **liikumiskeel, mitte navigatsioonimehhanism**: režiimivahetused võivad kasutada H4 liikumiskeelt (Fookus→Ülevaade = kerge zoom-välja tunne; riiulisse lisamine = kaardi lend riiulile; Võrdluse avanemine = pindade kõrvutumine), kõik ≤0,5 s ja reduced-motion puhul hetkelised; **kerimisega kaamerat ei juhita üheski režiimis**.
- Faasiriba näitab alati TÖÖ asukohta sõltumata vaaterežiimist (Võrdluses/Ülevaates jääb nähtavaks ja ütleb nt „Ring — räägib Mari; sina vaatad võrdlust").

### FQ3. Võrdlusriiuli täpne käitumine (nõue 3)

**Lisamine.** Iga pinna, tabeli, tulemuse ja versiooni päises on toiming **„Lisa võrdlusse"** (tavaline nupp; sama toiming Ülevaate kaartidel ja kontekstimenüüs; lohistamine pole kunagi ainuviis). Lisatav on **viide** `{ala, kontekst, pinnaliik, id, variant (faas|versioon|snapshot), pealkiri, nähtavussilt}` — mitte sisu koopia.

**Olekumasin.** `tühi → 1/2 → 2/2 → võrdlus avatud`:

1. Esimese valiku järel ilmub alumise doki kohale riba **„Võrdlusriiul 1/2"**: kiip (ikoon + pealkiri + variant + ×), „Tühjenda", vihje „Vali teine pind võrdlemiseks". Riiul on platvormikihi element (doki kohal, sama laius), süvatöös kompaktpill sanga kõrval.
2. Teise valiku järel riiul näitab „2/2" ja **avab poolitatud tööpinna automaatselt** (kasutaja otsus); riiul jääb võrdluse päiseribaks („Sulge võrdlus" alati nähtav).
3. Kolmas „Lisa võrdlusse" täis riiuli korral avab valiku „Asenda A / Asenda B / Tühista" — vaikset väljalükkamist ei ole.
4. Kiibi × eemaldab poole; kui võrdlus oli avatud, naaseb Fookus allesjäänud poolele; „Tühjenda" sulgeb ka riiuli.

**Kontekstipiir (MVP).** Mõlemad pesad peavad olema **sama tööobjekti kontekstist** (sama dokument, sama Kovisiooni juhtum, sama Teekond, sama tööriist) — piiriülene võrdlus (nt Teekonna kirje vs Kovisiooni kaust) on teadlikult väljas **[OTSUS? D-FQ2]**: eri kontekstide õigus- ja privaatsuspiirid ning paigutus vajaks eraldi otsust; riiul ütleb teise konteksti viite lisamisel ausalt „Võrdlus töötab ühe töö piires — asenda senine valik või tühista".

**Püsivus.** Riiul 1/2 (ilma avatud võrdluseta) elab sessionStorage'is (üle lehevahetuse sama konteksti piires; F5 säilitab); **avatud võrdlus** elab URL-is (FQ7). Riiul tühjeneb kontekstist lahkudes (dokiga teise alasse minnes kiibid jäävad, aga „Ava võrdlus" on lukus kuni naased — kiibi klõps viib tagasi allika juurde).

**Mida riiulisse EI saa** (FQ8 detailid): privaatpindu (Kovisiooni Minu leht / sahtel / kabinet), teise kasutaja privaatsisu, pindu mille vaatamine on parasjagu faasilukus (nt omaniku Ühine leht e4 ringi ajal), ehitamata pindu.

### FQ4. Poolitatud tööpinna redigeerimis- ja salvestusreeglid (nõue 4)

1. **Vaikimisi on muudetav ainult üks pool** (kasutaja otsus): aktiivne pool on valgustatud, teine kannab silti „Vaatad (kirjutuskaitstud)". Poole aktiveerimine = teadlik klõps tema päisel („Muuda seda poolt") — kunagi mitte automaatne fookuse-järgi vahetus; mõlemad pooled korraga muudetavad ei ole kunagi.
2. **Redigeeritavus ei laiene võrdlusega:** pool on muudetav ainult siis, kui ta oleks muudetav ka Fookuses (õigused + faasi olek + värav). Snapshotid, kaustad, versioonid ja teiste faaside pinnad on ALATI kirjutuskaitstud; võrdlus ei möödu ühestki väravast ega lukust — ta on vaatamisviis, millel juhtub olema üks elav pool.
3. **Salvestamine:** muudetav pool kasutab täpselt sama salvestus-/mustandiloogikat mis Fookuses (autosalvestus seal, kus see on; localStorage-mustandikaitse [KOV-R R6]; jagamis-/kinnitusläved samad). Võrdlus EI lisa uut salvestussemantikat ega „võrdlusest salvestamist"; „Sulge võrdlus" ei küsi kunagi salvestamist (sest midagi võrdluse-spetsiifilist pole salvestada).
4. **Jaotur:** töölaual lohistatav (min pool ~20rem; topeltklõps = 50/50; klaviatuuriga fokuseeritav `separator`, nooled ±5%, Home/End äärde); pooled võib „Vaheta pooled" nupuga peegeldada (A↔B jäävad kiipidena samaks).
5. **Kitsas ekraan (≤68rem) ja 200% tekst:** poolitust ei renderdata — sama olekumasin läheb **A/B vaheldusse**: segmentlüliti [A|B] riiulipillil + svaip lisavõimalusena (mitte ainuviisina); muudetav pool on sama reegli järgi üks.
6. **Konfliktid:** kui elava poole alusversioon muutub (409 / uus `version`), kehtib KOV-R R6 leping — vaikne refetch + riba „Seis liikus edasi — värskendasin"; kirjutuskaitstud pool ei uuene vaikselt kunagi ilma märketa („Vaatad seisu ‹aeg›; uuem olemas → Värskenda").

### FQ5. Sobivus neljale referentslehele (nõue 5)

| Referents | Tüüpilised võrdluspaarid (näited) | Muudetav pool | Erireeglid |
|---|---|---|---|
| **Kovisioon** (sessioon + järelkiht) | etapi kaust vs aktiivne faas (nt e5 võimaluste väli vs e6 sidumislaud); kaust vs kaust; järelkihis closure vs praktikakandidaadi mustand; praktika v1.1 vs v1.2 | ainult aktiivse etapi elav pind (rolliõigustega); kaustad/versioonid alati kirjutuskaitstud | Minu leht/sahtel/kabinet EI ole riiulisse lisatavad (flip jääb privaatpoole ainuteeks); e4 ringis on omaniku riiul+võrdlus lukus (tema vaade ongi lukus Minu lehele [KOV-R R5.7]); riiul sessioonis eeldab KOV-R P7 (kaustad + `view`-URL) |
| **Dokumendi koostamine** (§7 näide B) | mustand v2 vs v3; mustand vs lähtedokument; mall A vs mall B enne valikut (faas 1) | mustand (elav) või faasi pind; versioonid/lähtefailid kirjutuskaitstud | TÖÖPIND↔MUSTAND flip (§7) jääb kiireks vahelduseks; võrdlus on „kõrvuti" raskem juhtum — flip ei kao |
| **Tööprotsessid / Tööheaolu** (§8 näide C) | MINU PILT täna vs eelmine salvestatud pilt; plokkide vastused vs kokkuvõte | elav küsimusteplokk; salvestatud pildid kirjutuskaitstud | kogu sisu on kasutaja enda privaatne — võrdlus lubatud, sest nähtavus ei laiene kellelegi; ⌁ „Ainult sina näed" silt püsib mõlemal poolel; tõlgenduse-enne-vastamist keeld (§8) kehtib ka võrdluses |
| **Teekond** (uus, 4. referents) | periood vs periood (kevad vs suvi); sissekanne vs jagatav väljavõte (shareKeys-eelvaade!); plaan vs tegelik seis | elav sissekanne/väljavõtte mustand; ajalugu kirjutuskaitstud | Teekond on rangelt privaatne [ptk 5 teadmistekaart] — võrdlus ainult omaenda sisu piires; **jagamise ettevalmistus muutub võrdluse parimaks kasutuseks**: vasakul allikas (Teekond, kirjutuskaitstud), paremal jagatav väljavõte (muudetav) — olemasolev üleandmise-etalon (lähteobjekt → väljavõte → eelvaade → kinnitus) saab ruumilise kuju ilma uue lepinguta |
| *(taust)* Teekonna faasilõikus | — | — | Teekonna enda faasideks lõikamine (lävi → sissekanded → pilt → jagamine) vajab sama §5 retsepti inventuuri nagu B/C — **[HÜPOTEES, eraldi töö]**; võrdlusriiuli kasutusjuhud ülal EI sõltu sellest inventuurist |

### FQ6. Klaviatuur, ekraanilugeja, vähendatud liikumine, suurendatud tekst (nõue 6)

- **Klaviatuur:** dokk = `navigation`-landmark tsoonitsüklis (F6-ring: ankur → faasiriba → tööpind → sahtel/… → värav → **riiul → dokk**); „Lisa võrdlusse" on tavaline fookustatav nupp igal pinnal; riiul = `toolbar` (nooled kiipide vahel, Del eemaldab, Enter avab allika); jaotur = fokuseeritav `separator` (nooled/Home/End); A/B = `radiogroup`; režiimiklahvid: `O` Ülevaade, `Esc` sulgeb Võrdluse/Ülevaate (tagasi Fookusesse), `[`/`]` faasivaade edasi-tagasi (ainult vaade!). Ükski toiming pole ainult-žest ega ainult-ratas.
- **Ekraanilugeja:** riiulimuutused `aria-live=polite` („Lisatud võrdlusse: Etapi 3 kaust. Riiulil 1/2"); võrdluse avanedes fookus võrdluse päisesse; kumbki pool = `region` nimega („Võrdlus, vasak pool: Mustand v2, kirjutuskaitstud"); muudetavuse vahetus teatatakse; doki sang teatab avanedes ala ja tagasi-tee.
- **Reduced-motion:** riiuli ilmumine, kaardi „lend" riiulile, poolituse avanemine, Ülevaate zoom — kõik hetkvahetused sama tähendusega (tekstiline kinnitus asendab liikumise).
- **200% tekst:** poolitus → A/B vaheldus automaatselt; dokk ei kärbi kunagi faasiriba (orientatsioon enne otseteid: vajadusel peidab dokk otseteed, mitte ala nime/„←"); riiulikiibid murduvad kaherealiseks enne kärpimist.

### FQ7. URL, tagasi-nupp, värskendamine, mustand (nõue 7)

- **URL-i kolm kihti** peegeldavad kolme tasandit: asukoht = tee (`/kovisioon?case=…`, `/dokreziim/...`, `/teekond`); töö-VAADE = `view=` (KOV-R R6: `stage-N|live|flat`); vaaterežiim = `mode=overview` või `compare=refA,refB&active=A` (Fookus = parameetrita vaikeseis). Tööolekut URL ei kanna kunagi — see tuleb serverist.
- **Tagasi-nupp:** üks ajalookirje Ülevaate ja üks Võrdluse avamisel **[OTSUS? D-FQ3, soovitus: jah]** — back sulgeb pealmise režiimi (Võrdlus → Fookus → eelmine vaade); riiuli 1/2 seis EI lähe ajalukku (efemeerne). Back ei muuda kunagi faasi ega olekut.
- **Värskendamine (F5):** `mode`/`compare` taastuvad URL-ist; kumbki pool laetakse serverist õigustega (kadunud/keelatud viide → pool asendub selgitusega „Pole enam kättesaadav", teine pool jääb; riiulikiip saab veamärke); töö seis tuleb alati serverist (KOV-R R6).
- **Mustand:** poolelolev tekst muudetaval poolel = sama localStorage-kaitse mis Fookuses; võrdluse sulgemine/avamine ei puuduta mustandit; jagamata privaatmustand ei satu kunagi URL-i ega riiulikiipi (kiip kannab ainult viidet ja pealkirja).

### FQ8. Privaatsus- ja õiguste piirid (nõue 8)

1. **Viide, mitte koopia:** riiul ja võrdlus renderdavad iga poole läbi sama serveri-serializeri, mis kehtib Fookuses → IDOR-piirid (ka ADMIN ei möödu; teadmistekaart ptk 7) kehtivad automaatselt; „lisa võrdlusse" teise juhtumi/kasutaja pinnale pole võimalik, sest viidet ei saa luua pinnalt, mida sa ei näe.
2. **Privaatpindade välistus:** Kovisiooni Minu leht, sahtel, kabinet ja teiste osalejate privaatseisud **ei ole riiulisse lisatavad üheski rollis** — ka omaenda oma mitte (kasutaja otsus: võrdlus ei tohi paljastada Minu lehte; flip jääb ainuteeks, mis hoiab privaatpoole „käeulatuses, aga mitte kõrvutatavas" seisus ja välistab ekraanijagamise-õnnetused). Tööheaolu ja Teekonna puhul, kus KOGU leht on kasutaja privaatne ala, on omaenda sisu võrdlus lubatud ja ⌁-silt püsib mõlemal poolel.
3. **Faasilukud võidavad režiimi:** kui kasutaja vaade on faasi tõttu piiratud (e4 omaniku lukk; e7 „ruum ootab"), on riiul/võrdlus samale sisule lukus sama reegli järgi — võrdlus ei ole tagauks.
4. **Nähtavussilt mõlemal poolel:** iga poole päis kannab R8 sõnalist lepingut („Näevad kõik ruumi osalejad" / „Ainult sina") — võrdluses, kus kõrvuti võivad olla eri nähtavusega pinnad, on see kohustuslik, mitte valikuline.
5. **Jagatud compare-URL:** avaneb ainult sama õigusruumi kasutajal (server 404 võõrale — olemas); URL ei sisalda sisu, ainult viiteid.

### FQ9. Vähemalt kaks alternatiivi ja nende puudused (nõue 9)

| Alternatiiv | Kirjeldus | Miks mitte põhivariandiks |
|---|---|---|
| **A. Aknahaldur / vabad sakid** | iga pind avatav „aknana", kasutaja paigutab vabalt; võrdlus = kaks akent kõrvuti | topeltnavigatsioon sakiribaga (dokk + sakid = kaks „kus ma olen" süsteemi); kattuvused ja kerimine rikuvad lõuendireegli (R5.0); mobiilil kollabeerub; privaatsuspiirid hägustuvad (mitu konteksti korraga lahti); kognitiivne halduskoormus on just see, mida faasimudel kaotab |
| **B. Kummituskiht (overlay-diff)** | teine pind poolläbipaistva kihina praeguse peal, liuguriga „enne/pärast" | loetamatu klaas+Galaxy taustal (kaks pooltooni teksti üksteise peal); ei tööta tabelite/tekstiga (ainult visuaalsete kihtide jaoks); redigeeritavus defineerimatu; ekraanilugejale kaks sisu ühes ruumis = halvim juht; reduced-motion variant puudub loomulikult |
| **C. Kiirflipi laiendus (2-leheline Alt-Tab)** | riiuli asemel hoiab flip kahte lehte ja vaheldab neid ühe žestiga; kõrvuti-vaadet ei teki | ei täida põhinõuet „võrdle kõrvuti" (võrdlus jääb mälupõhiseks); **võetakse osaliselt üle**: see ONGI kitsa ekraani A/B-vaheldus (FQ4 p 5) — st C on põhilahenduse taandvorm, mitte konkurent |

### FQ10. Rakendusvalmis komponentide ja olekute mudel (nõue 10; koodi ei kirjutata)

**Komponendipuu (platvormikiht, ala-agnostiline):**

```text
RoomDock (L1)                          — landmark; olekud: täisdokk | sang | avatud-kiht
 ├─ DockAreaMap                        — alad + aktiivne ala (aria-current)
 ├─ DockBackPath                       — üks hierarhia-samm üles (nimeline: „← Esik")
 └─ DockShortcuts                      — otseteed (viimased/kinnitatud) [OTSUS? D-FQ1 ulatus]
CompareShelf (doki kohal; peidus kui tühi)
 ├─ ShelfSlot ×2                       — kiip: ikoon+pealkiri+variant+nähtavussilt+×
 └─ ShelfActions                       — „Ava võrdlus (2/2)" · „Tühjenda"
SplitWorkspace (mode=compare)
 ├─ PaneHeader ×2                      — pealkiri, nähtavusleping, „Muuda seda poolt", ×
 ├─ Pane ×2                            — renderdab viite SAMA pinnakomponendiga mis Fookus
 └─ SplitDivider                       — separator; lohistus+klahvid; 50/50 reset
PhaseRail (L2; lehe oma — Kovisioonis olemas, mujal §5 retsept)
ViewModeControl (L3)                   — Fookus·Ülevaade lülitid + võrdluse indikaator
OverviewBoard (mode=overview)          — pindade kaart; igal kaardil „Ava" + „Lisa võrdlusse"
```

**Olekud ja sündmused (masinad):**

```text
shelf:  tühi → üks → kaks ;  ADD_REF(ref) | REMOVE(slot) | REPLACE(slot,ref) | CLEAR
        guard ADD_REF: ref.privaatne? ❌ · kontekst ≠ olemasolev? → asendusdialoog
mode:   fookus ⇄ ülevaade ;  fookus → võrdlus (ainult shelf=kaks) → fookus
split:  {refs[A,B], aktiivnePool, suhe, kitsas: A|B}
        SET_ACTIVE(pool) | RESIZE | SWAP | CLOSE ; pooleRedigeeritavus = fookuse-reegel ∧ faasilukk ∧ õigus
ref:    {ala, kontekstId, pinnaliik, pinnaId, variant, pealkiri, nähtavussilt}
```

**Serverileping: uusi API-sid EI vajata** — pooled laetakse olemasolevate GET-serializeritega, salvestus käib olemasolevate tegevustega; riiul/režiimid on puhas esituskiht (sama põhimõte, mis selle faili näidetel B/C). Ainus võimalik hilisem lisa on viite-resolveri abifunktsioon kliendis (viide → õige komponent + laadija), mis on samuti esituskiht.

**Seos KOV-R pakettidega:** dokk = P1 täpsustatud teostaja (majanavi doki sees; pill-nav/külgmenüü/HUD-tagasi eemaldus kuulub P1-te); riiul+võrdlus+Ülevaade = **uus pakett FQ-P**, mis tuleb PÄRAST KOV-R prototüüpi (R11) ja P7-t (kaustad + `view`-URL on võrdluse eeldus Kovisioonis); Dokumendi koostamise ja Teekonna referentsid ei sõltu KOV-R pakettidest ja sobivad varasemaks katsetuseks.

**Avatud otsused:** D-FQ1 — doki kohalolu avastseenil ja `/vestlus` lehel (soovitus: mitte avastseenil; vestluses sang); D-FQ2 — kontekstiülene võrdlus (soovitus: MVP-s väljas); D-FQ3 — Võrdluse/Ülevaate ajalookirje (soovitus: üks kirje kummalegi); D-FQ4 — riiuli püsivus üle alade (soovitus: kiibid säilivad sessionStorage'is, „Ava" lukus kuni kontekstis tagasi); D-FQ5 — kas Ülevaade on MVP-s kõigil neljal referentsil või ainult kahel esimesel (soovitus: dokument + Tööprotsessid enne, Kovisioon pärast P7).

### FQ11. Täpne jätkamispunkt ühise interaktiivse prototüübi tegemiseks

**Olemasolev alusproov:** `docs/platvormi arendus/prototyybid/ruumilise-toolaua-fookuse-ja-vordluse-prototuup.html` tõendab mock-andmetega täisdoki/sanga, faasiriba, kolme vaaterežiimi, võrdlusriiuli ning kitsa ekraani A/B käitumist. Dokumendi koostamine (§7 faasid 1–5; mustand v2 vs v3; mall A vs B) on selles failis testandmestik, mitte prototüübi ulatus ega ainus tulevane sihtleht. Faasiliikumise ja lugemiskihi eraldi alusproovid ning ühine nimetuse leping on `docs/platvormi arendus/prototyybid/README.md`-s.

**Samm 1 — platvormiülene näitevalik (järgmine HTML-iteratsioon, ilma rakenduskoodita):** loo kanooniline `docs/platvormi arendus/prototyybid/ruumilise-toolaua-prototuup.html`, mis avaneb näitevalikusse ning sisaldab vähemalt Dokumendi koostamise, Tööheaolu, Teekonna, Kovisiooni, Registreerimise/sisenemise ja Kasutusjuhendi/lugemiskihi näiteid. Kõik näited kasutavad sama dokki, faasiriba, Fookuse/Ülevaate/Võrdluse režiime, URL-olekut, klaviatuuri- ja reduced-motion'i lepingut; näiteadapter muudab ainult faase, tööobjekte, väravaid, lubatud võrdluspaare ja nähtavussilte. `prototyybid/README.md` välised Carousel'i ja Animated Listi referentsid on valikulised sisupinna mustrid, mitte uued näited: katseta tööobjektide/versioonide sirvimist vähemalt kahes töövoos ning sündmuste/„mis muutus” loendit vähemalt kahes töövoos, ilma et tekiks teine globaalne navigatsioon. Testi 7 põhistsenaariumi vähemalt neljas töövoonäites: (1) „kus sa platvormis oled / kus töös oled / mis režiimis oled" — kolm eri vastust ilma abita; (2) lisa kaks pinda riiulisse ja ava võrdlus; (3) ütle, kumb pool on muudetav ja miks; (4) sulge võrdlus back-nupuga; (5) vaheta faasi ILMA ratast kasutamata (leia kaks teed); (6) sama klaviatuuriga; (7) sama reduced-motion + kitsas aknas. Läviväärtus: 0 topeltnavigatsiooni segadust; riiul 1/2 → 2/2 → split ilma juhendamiseta ≥8/10; näite vahetamine ei tekita uut navigatsioonisüsteemi.

**Samm 2 — päris töövoo piloot (alles pärast ühise sammu 1 läbimist):** vali testitulemuse põhjal üks väikseim päris tarbija; ära eelda automaatselt Dokumendi koostamist ainult seetõttu, et see oli esimese alusproovi mock-sisu. Teostus on ainult esituskiht, ühtegi API-/skeemimuudatust ei tehta; enne ehitust vaja kasutaja otsuseid **D-FQ1 ja D-FQ3** (teised ei blokeeri). Kovisiooni sessiooni riiul tuleb alles pärast KOV-R P7. Kuvatõendid lähevad ühise ruumilise töölaua prototüübi pildikausta, mitte lehespetsiifilise nimega alamkausta.

*Ruumilise töölaua doki, faaside ja võrdluse peatükk lisatud 15.07.2026; ainult dokument — rakenduskoodi, teste ega kuvatõmmiseid ei loodud. Ajaloolised D-FQ otsuse-ID-d säilivad stabiilsete viidetena. Tõendid: [PILT …] = `fable-pildid/kovisioon-tervikvoog/` failid; [KOOD] = aktiivne main (`RoomQuickbar.jsx`, `carousel.css`, KOV-R koodiviited); [OTSUS?] = tooteomaniku otsus. Varasemaid peatükke 1–10 ei muudetud.*
