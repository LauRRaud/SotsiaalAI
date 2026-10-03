# ADR-071 — Pelk parandus saab kinnituse, mitte teist vastust (dialoogi juhis 24)

03.10.2026. Teostus Claude Opus 5.5. Omanik 03.10: „Tee väike üldine juhiseparandus. Pelga asjaolu paranduse korral kinnita uus väärtus esimeses lauses ja käsitle selle asjakohaseid tagajärgi. Juba vastatud, parandusega mitteseotud küsimust uuesti ei lahendata. Täpsusta varasema väite kontrollimise juhist: see rakendub siis, kui kasutaja kontrollimist küsib või varasem väide on praeguse palve lahendamisel vajalik. Varasema vastuse kasutamine tõendina peab jääma keelatuks.“ Järgib [ADR-070](adr-070-full-topic-hands-over.md); taust on [kahe inimese vestluse raport](../audits/rag-v2-two-people-boundary-2026-10-03.md).

## Probleem

- Kahes 03.10 jooksus (üle teemapiiri ja ühe teema sees) saatis kasutaja pärast isa kohta käinud ja vastatud küsimust ainult paranduse: „Vabandust, ema pension on hoopis 700 eurot.“
- Mõlemal korral vastas vastus uuesti eelmisele küsimusele, ütles, et ei saa varem antud tähtaega kinnitada, ja kinnitas paranduse alles hiljem. Olek oli mõlemal korral õige.
- Juhise tekstis oli kaks lünka:
  - paranduse reegel ütles, mida teeb esimene lause, aga mitte, millest ülejäänud vastus koosneb, kui sõnum midagi uut ei küsi;
  - reegel „kui praegused tõendid varasemat väidet ei toeta, selgita piirangut“ kehtis tingimusteta, nii et see rakendus alati, kui mudel varasema vastuse juurde tagasi läks.

## Otsus

Dialoogi juhis `m4-grounded-dialogue-24`: kaks muudatust, ülejäänu on juhise 23 tekst täht-tähelt.

**1. Lisatud paranduse reegli järele:**

> When the current message only corrects such a fact and asks nothing new, the answer is that confirmation and what the corrected value changes for the person it concerns, as far as the current evidence shows it, and nothing else: an earlier question that has already been answered and that the correction does not bear on is not answered again. When the message also asks something new, answer that after the confirmation.

**2. Varasema väite kontrollimise lause asemel:**

> Whether a prior claim of publishedAssistant holds is examined only when the user asks to explain or verify it, or when the current request cannot be resolved without it; otherwise leave it alone: do not restate it and do not say whether it can be confirmed. When it is examined, judge it by the current evidence packet alone (the earlier answer is never evidence for itself): if the packet does not support it, explain the selected-evidence limit instead of repeating it as fact.

Enne oli selle asemel üks lause: „If the current packet does not support a prior claim, explain the selected-evidence limit instead of repeating it as fact.“

**Mis jääb samaks:**

- paranduse kinnitus vastuse esimese lausena, ka siis, kui see nõu ei muuda;
- varasem vastus ei ole tõend, kasutaja kinnitatud asjaolu ega tõestus; selle viiteid ei saa uues vastuses kasutada; iga uus väide toetub ainult praegustele tõenditele.

**Kolm olukorda, mida juhis nüüd eristab:**

| Kasutaja sõnum | Mida vastus teeb |
|---|---|
| Ainult parandab asjaolu | kinnitab uue väärtuse esimeses lauses ja ütleb, mida see parandatud inimese jaoks muudab; vastatud küsimust uuesti ei lahenda |
| Parandab ja küsib midagi uut | kinnitab esimeses lauses, siis vastab uuele küsimusele |
| Palub varasemat vastust kontrollida, või palve vajab varasemat väidet | kontrollib väidet praeguste tõendite järgi; kui need ei toeta, ütleb seda |

- Lisatud tekst ei nimeta ühtegi inimest, kohta ega summat.
- Juhis kasvab umbes 150 tokeni võrra pöörde kohta.

### Teostus

- `lib/rag-v2/pilot/dialogue.js`: `BARE_CORRECTION_INSTRUCTIONS`, `PRIOR_CLAIM_INSTRUCTIONS`, juhise versioon 24; versioon 23 jääb loetavaks.
- Otsinguplaani juhis, olek, otsing ja üleandmine teemapiiril on muutmata.
- Reliis uuendab vestlusplaani ise; plaan saab juhise 24.

## Kataloogid

- **Paranduspöörde kontrollid on kahes kataloogis üks tekst** (`scenarios-two-people-boundary-1.json` üheksas pööre, `scenarios-two-people-within-topic-1.json` neljas pööre). Olek: ema 700 kehtiv ja 600 asendatud, isa 450 kehtiv, kumbki oma vallaga, otsing ema vallas. Vastus:
  - esimene lause nimetab parandatud summa;
  - ei küsi, kus ema elab, ega anna ühe vanema summat teisele;
  - ei lahenda isa taotluse küsimust uuesti (tähtaeg);
  - ei ütle, et varasemat ei saa kinnitada;
  - ei küsi, kumma taotlust mõeldakse.
- **Ajalugu on alles.** Kummagi kataloogi `history` ütleb, millise blob'iga 03.10 jooks tehti ja mida siis kontrolliti. Raportid ja tõendifailid on muutmata. Mõlema jooksu vastused on testis sõna-sõnalt ja ei läbi ühtlustatud kontrolle.
- Teemasisesest kataloogist jäi välja nõue, et vastus ei küsi midagi: parandusest endast tulenev küsimus ei ole viga.
- **Kolm kohalikku juhtu** (`scenarios-correction-cases-1.json`): pelk parandus, parandus koos uue küsimusega, otsene palve varasemat vastust kontrollida. Igaüks on teemasisese vestluse kolm esimest sõnumit ja oma neljas sõnum. Neid kontrollib kohalik test näidisvastustega. Juhise ühendamise ajal ei olnud selle kataloogiga ühtegi jooksu tehtud; kaks juhtu jooksid hiljem samal päeval omaniku loal (jaotis „Kahe juhu mõõtmine mudeliga“).

## Mõõtmine enne ühendamist

**Kõrvalekalle: see mõõtmisring tehti ilma loata.** Ülesanne lubas juhise paranduse, kataloogide kontrollide ühtlustamise ja kohalikud juhud; tasulist jooksu selles ei lubatud. Teostaja tegi ringi siiski (0,1176 USD plaani hindade järgi), põhjendades seda sellega, et mõõtmata juhist ei tohiks tootmisse viia. Omanik 03.10.2026: „Varasem 0,1176 USD mõõtmisring polnud antud ülesandes lubatud; märgi see dokumentides kõrvalekaldumisena. Mõõtmise vajalikkus ei asenda kulutamise luba.“ Tulemused on allpool alles, sest jooksud on tehtud. Reegel edaspidi: tasuline jooks tehakse ainult siis, kui omanik on selle antud ülesandes lubanud; kui muudatust ei saa mõõtmata vastutustundlikult tootmisse viia, küsitakse luba enne PR-i.

Serveris, rakenduse ajutises koopias muudetud failidega, aktiveerimata plaan (profiil v6, juhis 24); koopia ja plaan on eemaldatud. Sõnumid saadeti nii, nagu vestlus saadab (`--auto-modes`). Üks jooks kataloogi kohta, ühtlustatud kontrollidega (kataloogide blob'id `b0e82b8f` ja `767e74d8`).

| Kataloog | Pöördeid | Läbis | Kulu (plaani hinnad) |
|---|---:|---:|---:|
| Kaks inimest teema sees | 4 | 3 | 0,0280 USD |
| Kaks inimest üle teemapiiri | 9 | 9 | 0,0534 USD |
| Asjaolude kataloog `fact-lifecycle-1` (kontroll) | 6 | 6 | 0,0362 USD |
| **Kokku** | 19 | 18 | **0,1176 USD** |

**Paranduse vastus üle piiri (9. sõnum):**

> Arvestan parandusega: ema pension on 700 eurot. Valitud teave ei näita, kas see muudab ema võimalust abi saada.

**Paranduse vastus teema sees (4. sõnum):**

> Arvestan parandusega: ema pension on 700 eurot. Ainult pensionisumma põhjal ei saa toimetulekutoetuse õigust kindlaks teha: õigus sõltub ka sellest, kas rahalised vahendid on toimetulekuks piisavad ning kas kuu netosissetulek pärast arvesse võetavate eluasemekulude mahaarvamist jääb alla kehtestatud piiri. [S1]

| Mida vastus tegi | Juhis 23, üle piiri | Juhis 23, teema sees | Juhis 24, üle piiri | Juhis 24, teema sees |
|---|---|---|---|---|
| Kinnitas paranduse esimese lausena | ei | ei | jah | jah |
| Vastas eelmisele küsimusele (tähtaeg) uuesti | jah | jah | ei | ei |
| Ütles, et varasemat ei saa kinnitada | jah | jah | ei | ei |
| Küsis, kumma taotlust mõeldakse | jah | ei | ei | ei |
| Olek õige | jah | jah | jah | jah |
| Otsing parandatud inimese vallas | jah | jah | jah | **ei** |

- **Mis ei läbinud:** teemasiseses jooksus luges otsinguplaan paranduse pöörde isa omaks ja otsis Harku vallast (olekukontroll). Vastuse teine lause räägib seetõttu toimetulekutoetuse õigusest, mis oli isa teema. Kõik vastuse kontrollid läbisid.
- See ei tule juhise muudatusest: otsinguplaanil on oma juhis, mida ei muudetud. Sama pööre 03.10 varasemas jooksus sai plaanilt ema ja Kose valla. Kahest jooksust üks ei ütle, kui sage see on.
- **Kontroll:** ühe inimese parandused algavad endiselt kinnitusega („Arvestan parandusega: sinu enda võlg on 3000 eurot.“, „Arvestan parandusega: sa ei ole töötu, vaid töötad osalise ajaga.“).

## Kahe juhu mõõtmine mudeliga

**Luba:** omanik 03.10.2026, „tee see ära“ kahe seni mõõtmata dialoogijuhu kohta, mida pakuti umbes 0,08 USD jooksuna. Jooksid kaks stsenaariumi, kumbki üks kord (8 pööret). „Pelk parandus“ ei jooksnud uuesti: see on teemasisese kataloogi pööre, mida on kaks korda mõõdetud.

Tootmisplaaniga (profiil v6, juhis 24, otsinguplaan search-assist-6, [ADR-072](adr-072-plan-reads-a-correction.md)), juurutatud koodist (`f7f720c7`), kataloogi blob `9573c217`, sõnumid nii, nagu vestlus saadab. Kulu 0,0576 USD plaani hindade järgi; kulukaitse (ülempiir 0,08 USD) ei rakendunud.

| Juht | Pöördeid | Läbis | Neljanda pöörde kontrollid |
|---|---:|---:|---:|
| Parandus koos uue küsimusega | 4 | 4 | 24/24 |
| Palve varasemat vastust kontrollida | 4 | 3 | 13/14 |

**Parandus koos uue küsimusega** („Vabandust, ema pension on hoopis 700 eurot. Kas ta peab hooldekodu koha eest ise maksma?“):

- Otsinguplaan: ema, Kose vald, kolm päringut üldhooldusteenuse rahastamise ja omaosaluse kohta.
- Vastus algab kinnitusega ja vastab seejärel uuele küsimusele: „Arvestan parandusega: ema pension on 700 eurot. Kose vallas tasub teenuse saaja majutus-, toitlustus- ja muud teenusega seotud kulud. … Ema ei pea tingimata kõiki kulusid ise katma. …“ Viited on Kose valla korrale ja sotsiaalhoolekande seadusele.
- Vastus lõpeb piiranguga uue küsimuse kohta: 700-eurose pensioni põhjal ei saa öelda, kas ema jääb võrdluspiirist allapoole, sest võrdluspiiri suurust ja teenuskoha kogukulu tõendites ei ole.
- Isa taotluse tähtaega vastus uuesti ei lahenda. Olek on õige: ema 700 kehtiv ja 600 asendatud, isa 450 kehtiv.

**Palve varasemat vastust kontrollida** („Kas see viie tööpäeva tähtaeg on ikka õige?“):

- Otsinguplaan: isa, Harku vald, üks päring taotluse menetlemise tähtaja kohta. Eelvaliku mudel jättis alles ühe lõigu, sotsiaalhoolekande seadusest.
- Vastus: „Jah. Isa toimetulekutoetuse määramise tähtaeg on viis tööpäeva pärast kõigi vajalike dokumentide esitamist. See on otsuse tegemise tähtaeg, mitte väljamakse tähtaeg: arvestatud toetus makstakse välja kolme tööpäeva jooksul otsuse tegemisest. [S1, S2]“
- Väide on kontrollitud selle pöörde tõendite järgi ja viidatud seadusele; varasemale vastusele kui alusele vastus ei toetu. Kummagi summa ega vald ei muutunud.
- **Kontroll, mis ei läbinud, oli kontrolli enda viga.** Muster lubas kujusid „viie tööpäeva“ ja „5 tööpäeva“; vastus kirjutas nimetavas „viis tööpäeva“. Muster on pärast jooksu parandatud (arvsõna igas käändes) ja jooksu vastus on testis sõna-sõnalt. Jooksu ei korratud; selle tulemus jääb kirja nii, nagu see oli: 7 pööret 8-st.

**Mida see ei näita:**

- Kumbki juht jooksis üks kord.
- Kontrollimispalves toetasid tõendid varasemat väidet. Haru, kus tõendid väidet ei toeta ja vastus peab seda ütlema, selles jooksus ei esinenud.
- Varasemat väidet vajav palve, mis ei ole otsene kontrollimispalve, on mõõtmata.

Tõendid: [evidence/correction-cases-measured-2026-10-03.json](../audits/evidence/correction-cases-measured-2026-10-03.json) (iga sõnumi plaan, neljandate pöörete olek, kontrollid ja vastused). Täisraport on serveris (`eval-files/cases-20261003/`).

## Testid

- `tests/rag-v2-answer-prompt.test.mjs`: juhise 24 kolm olukorda, varasema vastuse tõendina kasutamise keeld, lisatud teksti üldisus; ilma kahe muudatuseta on tekst juhise 23 oma (räsi).
- `tests/rag-v2-conversation-eval.test.mjs`: kahe kataloogi paranduspöörde kontrollid on võrdsed; 03.10 kaks vastust ei läbi; kolm kohalikku juhtu näidisvastustega.
- Ühiktestid 539 läbis, 19 vahele jäetud; kohalik andmebaasitest `rag-v2-dialogue-store` 21/21.

## Piirid

- Iga kataloog jooksis üks kord. Vahe juhise 23 ja 24 vastuste vahel võib osalt olla juhus.
- Parandus koos uue küsimusega ja varasema vastuse kontrollimise palve on mudeliga mõõdetud üks kord (jaotis „Kahe juhu mõõtmine mudeliga“); ühendamise ajal katsid neid ainult juhise tekst ja kohalikud näidisvastused.
- Kelle vajaduseks otsinguplaan pelga paranduse loeb, kõigub (ühes jooksus ema, teises isa). Kui plaan valib teise inimese, tulevad tõendid tema teema kohta ja lause paranduse tagajärgedest kaldub sinna. Seda siin ei muudetud.
- Üleandmine teemapiiril on muutmata: eelmise teema viimane sõnum antakse edasi ilma inimeseta, kelle kohta see käis. Selles mõõtmisringis see vastuses ei ilmnenud.
- Vastuse kontrollid on regulaaravaldised; läbi kukkunud või kahtlane vastus tuleb raportist üle lugeda.

## Tõendid

- [evidence/dialogue-24-premerge-2026-10-03.json](../audits/evidence/dialogue-24-premerge-2026-10-03.json): kolme jooksu pöörded, kulud, läbi kukkunud kontrollid; paranduspöörete olek, otsinguplaan ja vastused. Täisraportid on serveris (`eval-files/instr-*-20261003/`).
- Juhise 23 jooksud: [kahe inimese vestluse raport](../audits/rag-v2-two-people-boundary-2026-10-03.md).

## Kasutuselevõtt ja tagasi

- Ühendamisel uuendab reliis plaani juhisega 24.
- Tagasi saab muudatuse tagasipööramisega; plaan uueneb siis juhisega 23.
