# ADR-178 — Paragrahv lause sees, mitte lõigu taga (m4-grounded-answer-16, m4-grounded-dialogue-51)

22.10.2026. Teostus Claude Opus 5.5. Omaniku tähelepanek vastuse kohta: „viited vist ei peaks lõikude taga olema“.
Valikute peale vastas omanik: „variant on ka lõigu sees lühendatult, siduda teksti sisse. Või siis ainult eraldi
allikatesse, kust saab ka vaadata“.

## Leid

- Pöördujale antud vastuses lõppesid kaks plokki eraldi sulgudes viitega pärast viimast punkti:
  „… kõrvalabita teha. (Sotsiaalhoolekande seaduse § 17 lg 1–2)“. Laial ekraanil jäi viide omaette reale ja nägi välja
  nagu lõigu allkiri.
- ADR-129 (answer-13, omanik 10.10: „kasutajad tahavad teada paragrahve“) ütles: akt ja paragrahv käivad sulgudes lause
  lõppu. Pöörduja reas oli „in brackets after the sentence“ ja keeld seadust lühendada. Mudel luges „lause järel“ kui
  pärast punkti ja pani viite ploki viimase lause taha.
- Paneel „Allikad“ näitab paragrahvi akti nime kõrval niikuinii („Sotsiaalhoolekande seadus, § 17 lg 1–2“).

## Otsus

Omaniku kahest variandist on valitud esimene: paragrahv jääb vastusesse, aga lause sisse ja pärast esimest korda
lühendatult. Nii jääb alles ADR-129 eesmärk ja kaob eraldi rida.

- **answer-16, LEGAL PROVISIONS.** Akt ja paragrahv põimitakse lausesse, mida nad toetavad: lause algusse
  („<akt> § <N> järgi …“) või kohe reegli järele, aga lause sisse ja enne punkti. Mitte kunagi lause või ploki viimase
  punkti taha ega omaette reana või plokina. Muu jääb samaks: mida tohib nimetada, vormid (`PROVISION_FORM`) ja serveri
  kontroll (`provision-check.js`).
- **dialogue-51, rolli read.**
  - Spetsialist: „The provision stands in the sentence it supports, never after its full stop“ (varem „in the sentence
    or in brackets after it“).
  - Pöörduja: „woven into the sentence it supports“ (varem „in brackets after the sentence“). Ka pöörduja vastus võib
    pärast seaduse esimest täisnime koos lühendiga sulgudes kasutada lühendit (omanik: „lõigu sees lühendatult“).
    Varem oli lühend pöördujale keelatud.
  - Teenuseosutaja rida on sama.
- Versioonid: `m4-grounded-answer-16` ja `m4-grounded-dialogue-51`; vanad on loetavate versioonide loendis.

## Mõju

- Põhijuhise tekst muutus, seega katkeb muutmata eesliite puhver kõigil pööretel üks kord ja täitub siis uuesti.
- Juhis lühenes ühe lause võrra ja ühtegi uut reeglit ei lisandunud. Mõtlemise kasvu ei oota, aga ADR-165 näitas, et
  vastusejuhise muutus võib aega mõjutada. Seepärast tuleb vastuse aega serveris vaadata.

## Kontroll

- **Kohalikult:** moodulid laaditakse, versioonid ja loendid on õiged, eslint on puhas.
- **Serveris:** vaja on lühikest kontrolli kahes rollis (pöörduja ja spetsialist) küsimusega, mille vastus toetub
  seadusele, näiteks „Kas Harku vallas on koduteenus eakale?“. Vaadata, kas paragrahv on lause sees, kas lühend tuleb
  alles pärast täisnime ja kas esimese teksti aeg jääb samaks.
