# Logo fondiga kuvamine — 13.10.2026

Omaniku hinnangul oli PNG-lähivaates uus variant „veidi parem“. See hinnang
kinnitab osalist visuaalset paranemist; täielikku teravusprobleemi lahendust
ei väideta. Metalliefekti tagasivõtmine säilib.

Avalehe SVG `<text>` kasutab lehe enda Exo 2 fonti otse lõplikus CSS-pikslite
suuruses. SVG-l pole skaleerivat `viewBox`-i. Tähtede alguskohad, kirjakaalud
200 ja 290,250335 ning nurgaruudu lõige on kaardistatud senisest logost.
Valmis logo kasutab halli täitevärvi, läbipaistvus on 1 ning püsivat
animatsioonikihti ja tsentreerivat transformatsiooni pole.

Kontrollid enne avaldamist:

- Muudetud JSX-failide ESLint ja `git diff --check`: PASS.
- Töölaua võrdluspilt, 1280 × 720 ja DPR 1,25: vana pilt üleval, uus SVG-tekst
  all. Vaadatud. Sama võrdlus oli omaniku hinnangu alus.
- 390 × 844 ja DPR 3: logo laius 257,66 px, tegelik põhisõna font 49,7578 px,
  kaal 200, 12 SVG-tekstielementi, opacity 1, will-change auto.
  Valmisoleku järel on „Peagi avame!“ nähtav ja keelatud; loor jääb ette.
  Mobiilipilt vaadatud, horisontaalset ülevoolu ega JavaScripti vigu ei olnud.
- OS-i reduced-motion: 1280 × 720, põhisõna font 74,1569 px,
  logo laius 384 px, opacity 1. Lehe vigu ei olnud.

Chromiumi emulatsioon ei tõenda kõigi füüsiliste ekraanide ega
Safari/Firefoxi kuvamist. Tootmiskontroll lisatakse pärast paigaldust.
