# Sotsiaal.pro logo metalliefekt — 13.10.2026

Omanik soovis viimase SotsiaalAI logo vedela metalli efekti uue logo `pro`
osal. Võrdlusalus on `11be191852756af96a7194c261001f1de5efab9d`
(`24fc69a6^`): 03.10 eemaldatud vana avalehe logo vahetult eelnenud versioon.

## Teostus

- `MetallicPaint` shader kattub võrdlusalusega. Kõik 18 etteantud efekti-
  parameetrit ning `preserveDrawingBuffer` on üle võetud muutmata: sealhulgas
  kiirus 0,11, seed 7, scale 3, hõbeda toonid ja šampanjatooni pulseerimine.
- Uus mask kopeerib kinnitatud logo `pro` kontuurid, lõike ja nurgaruudu.
  Efekt arvutatakse selle osa kastis, nagu vana AI efekti puhul.
- Põhisõna ja staatiline varuvariant kasutavad SVG `<use>` kontuure.
  Kontuure ega joonepaksusi ei muudeta. Valmis logo ei jää `forwards`-
  animatsioonikihile ning tsentreerimine ei vaja transformatsiooni.
- Väikese metalliala joonistuspuhver kasutab kahekordset proovivõtutihedust.
  Teiste `MetallicPaint` kasutuste vaikimisi mõõtkava jääb samaks.
- Staatiline `pro` on nähtav, kuni metall on päriselt joonistanud neli
  kaadrit. Vähendatud liikumise või kõrge kontrasti korral jääb see staatiliseks.
  Peidetud brauseripaani ja lahkutud loori korral metallikomponent eemaldatakse.

## Kohalik kontroll

- Muudetud kolme JSX-faili ESLint ja `git diff --check`: PASS.
- 1536 × 690, DPR 1,25: logo 396 px, metallipuhver 198 × 108;
  kontuurid ja metall nähtavad, lehe JavaScripti vigu ei olnud.
- 390 × 844, DPR 3: logo 257,66 px, metallipuhver 206 × 113;
  1,1 sekundi vahega GPU kaadrites muutus 12 311 baiti. Metall liigub päriselt.
  Põhisõna ja metalliosa paiknevad koos; horisontaalset ülevoolu ei ole.
- Mõlema vaate ekraanipildid vaadati üle. `Peagi avame!` on nähtav ja
  sisenemine endiselt keelatud.
- OS-i reduced-motion, 1280 × 720: metallicanvast ei ole, staatiline
  `pro` on nähtav; ekraanipilt vaadati üle.
- Ainult logo WebGL2 toe puudumise simulatsioon: canvas jääb peidetuks,
  staatiline `pro` ja põhisõna kontuurid on olemas; lehe vigu ei olnud.
- Kogu lehe WebGL2 keelamise katses säilis logo varuvariant, kuid mujal
  lehel tekkis korduv `forEach` viga. Kogu platvormi WebGL-ita töökindlust
  see muudatus ei tõenda; seda katset ei loeta üldiseks PASS-iks.

Kontrollid on Chromiumi emulatsioonis. Kasutaja füüsilise ekraani lõplik
servateravus ja Safari/Firefoxi kuvamine ei ole tõendatud. Uue õhema `pro`
kujuga mustri nähtav pind erineb vana AI kujust, kuigi efektiseaded on samad.
