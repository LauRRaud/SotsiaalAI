# ADR-183: sätte erandite loetelu loetakse tervikuna

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 küsimusele „Kas võtan järgmisena ette need 9 osaliselt õiget vastust?“: „nii“, „jah“. Seis: **vastuse juhis `m4-grounded-answer-19`, vestluse juhis `m4-grounded-dialogue-54`.**

## Probleem

21.10 75 küsimuse hindamises ([vastuste õigsus](../audits/vastuste-oigsus-2026-10-21-75-kusimust.md)) olid kahel osalisel vastusel õige säte paketis ja vastus ütles siiski, et ei tea. Fokusjooks F3 (23.10, väljalase `65ab649d`) kordas mõlemat.

- **A02** „Kas linn saab talle koduteenust anda ja kui palju see maksab?“ Tartu linna sotsiaalhoolekandelise abi andmise korra § 11 lg 3 oli paketis: koduteenuse tasu on 1 euro koduskäigu eest ja sõltuvalt sissetulekust tasub isik *täiendavalt* 6,50 eurot tunnis (601–800 eurot kuus) või 13 eurot tunnis (üle 801 euro). Vastus: „Määrus ei ütle siin, kuidas kujuneb tasu muude sissetulekute või nende vahemike korral.“ Madalama sissetulekuga inimene maksab sätte järgi ainult koduskäigu tasu.
- **B02** „Kas mu laste lastetoetus läheb sissetulekuna arvesse?“ SHS § 133 lg 1 ja lg 2 olid paketis ja vastus viitas neile. Lg 1: aluseks on kõik eelmise kuu netosissetulekud. Lg 2 loetleb, mida ei arvata sissetulekute hulka; lastetoetust seal ei ole. Vastus: „Ma ei saa siin oleva teabe põhjal kindlalt öelda.“

Juhis ütleb mujal, et vastus ei järelda millegi puudumist („Do not infer that a law … does not exist“). Mudel luges loetelu puuduvat rida sellise järeldusena. Kehtetuks tunnistatud punktid (§ 133 lg 2 p 7 ja 8) on tekstis tühjad ning võisid kahtlust suurendada.

## Otsus

LEGAL PROVISIONS saab ühe üldise lugemisreegli (mitte A02 ega B02 erireegli):

> A provision that sets a rule for every case and lists the cases it treats otherwise (incomes not counted, income ranges that pay an extra fee, persons left out) is read whole: a case its list does not name stays under the rule, and you say so as what the provision says, citing it (…). A numbered point that has no text has been repealed and names nothing. This is reading the provision, not a claim that something does not exist. It does not hold when the list says it is not complete ("muu hulgas", "eelkõige", "näiteks") or when another provision or source given here adds to the list or lets an authority add to it: then say what that adds.

- Reegel kehtib ainult sättele, millel on üldreegel ja erandite loetelu.
- Mittetäielik loetelu ja muu allika täiendus jäävad alles. Näiteks SHS § 133 lg 3 lubab omavalitsusel lisaks arvestamata jätta stipendiume, hüvitisi ja kingitusi; vastus ütleb seda.

## Mis muutus

- `lib/rag-v2/pilot/contracts.js`: `PROMPT_VERSION` `m4-grounded-answer-19`, uus lause LEGAL PROVISIONS-is ADR-181 lause järel.
- `lib/rag-v2/pilot/dialogue.js`: `DIALOGUE_PROMPT_VERSION` `m4-grounded-dialogue-54`; muud read on v53 omad.
- Juhis on implementatsiooni manifestis, deploy uuendab vestlusplaani ise ([ADR-037](adr-037-release-chat-plan.md)).

## Kontroll

Fokusjooksud F4 (väljalase `8af74266`) ja F5 (`e092de45`) 23.10: samad 16 pööret kui F3-s ([ADR-185](adr-185-municipal-regulations-reserve.md) jaotis „Kontroll“).

- **B02, mõlemas jooksus `grounded`.**
  - F4: „Jah, laste peretoetused arvestatakse toimetulekutoetuse puhul sissetuleku hulka.“
  - F5: „Lastele makstav lastetoetus ehk peretoetus arvestatakse toimetulekutoetuse määramisel sissetuleku hulka.“
- **A02 osaliselt.**
  - Vastus ei ütle enam, et määrus ei ütle midagi madalama sissetuleku kohta. Ta annab tasu (1 euro käigu eest ja tunnitasu kahes vahemikus).
  - F4 märkis õigesti, et 801 eurot ei kuulu kumbagi vahemikku.
  - Kumbki jooks ei ütle otse, et kuni 600-eurose sissetulekuga inimene maksab ainult koduskäigu tasu. Lugeja saab selle tekstist ise kätte, aga vastus seda välja ei kirjuta.
