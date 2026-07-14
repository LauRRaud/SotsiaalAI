# Flight-efekt: kerimisega juhitav 3D-lend läbi galerii

Juhend sama efekti ehitamiseks suvalisele veebilehele. Põhineb
BeyondFrames'i avalehe implementatsioonil
(`src/components/home/FlightScene.jsx` + `src/app/globals.css` sektsioon
"BFL"), kuid kirjeldab kõik raamistikuvabalt — lõpus on iseseisev
vanilla-JS näide.

---

## 1. Idee ühe lausega

Leht ise on nähtamatu pikk "rada"; ekraanil on **fikseeritud** 3D-vaateava,
milles seisavad tasapinnad (ruumid) erinevatel sügavustel, ja kerimine
liigutab **kaamerat** neist läbi.

```
ekraan (fixed, perspective)
   │
   ├─ plaan A  z = -2100   ← esimene ruum
   ├─ plaan B  z = -3600   ← teine ruum      kerimine kasvatab --cam,
   ├─ plaan C  z = -5100   ← kolmas ruum     iga plaan on translateZ(z + cam)
   └─ finaal   z = -6600   ← kontaktsein
```

Kui `cam == |z|`, on plaan täpselt kaamera ees (skaala 1). Kaugemal on ta
väiksem: **skaala = p / (p − rel)**, kus `p` on perspektiiv ja
`rel = z + cam` (negatiivne = eespool).

---

## 2. HTML-i skelett

```html
<section class="fl">
  <!-- Fikseeritud lava. NB! kõrgus 100lvh, mitte ainult inset:0 (vt §5) -->
  <div class="fl-viewport">
    <div class="fl-veil"></div>          <!-- taustaudu, radial-gradient -->
    <div class="fl-dolly">               <!-- SIIN on perspective -->
      <header class="fl-plane" data-z="-620"  style="--z:-620px">Bränd</header>
      <a      class="fl-plane" data-z="-2100" style="--z:-2100px">Ruum 1</a>
      <a      class="fl-plane" data-z="-3600" style="--z:-3600px">Ruum 2</a>
      <div    class="fl-plane" data-z="-5100" style="--z:-5100px">Finaal</div>
    </div>
    <a class="fl-cue" href="#stop-1">Keri sisse</a>
  </div>

  <!-- Nähtamatu rada annab dokumendile kõrguse = kerimisruumi -->
  <div class="fl-track" style="height: calc(100vh + 4652px)">
    <span id="stop-1" style="position:absolute; top:889px"></span>
  </div>
</section>
```

---

## 3. CSS-i tuum — ja MIKS just nii

```css
.fl-viewport {
  position: fixed;
  inset: 0;
  height: 100lvh;      /* §5.4 – iOS tööriistariba */
  overflow: hidden;
}

/* Perspektiiv on plaanide OTSESEL vanemal. */
.fl-dolly {
  --cam: 0px;
  position: absolute;
  inset: 0;
  perspective: 1100px;            /* mobiilis 950px */
  perspective-origin: 50% 46%;
}

/* Iga plaan arvutab oma sügavuse ise. */
.fl-plane {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translateZ(calc(var(--z) + var(--cam, 0px)));
  visibility: hidden;             /* JS lülitab sisse, kui plaan on aknas */
  opacity: var(--o, 0);           /* JS annab ümbriku väärtuse */
}

.fl-track {
  position: relative;
  pointer-events: none;
}
```

### Kriitiline arhitektuuriotsus (kõige tähtsam osa!)

**Ära ehita pesastatud `preserve-3d` ahelat** stiilis
`viewport(perspective) → wrapper(preserve-3d) → dolly(preserve-3d,
translateZ) → plaanid(translateZ)`. Chrome renderdab seda, aga **iOS
Safari lamendab pesastatud preserve-3d sisu** — translateZ kaob ära ja
kõik plaanid joonistuvad täissuuruses üksteise peale.

Töökindel muster on ÜHEtasandiline 3D:

- `perspective` plaanide **otsesel** vanemal;
- kaamera **CSS-muutujana** (`--cam`), mille JS igal kaadril uuendab;
- iga plaani transform: `translateZ(calc(var(--z) + var(--cam)))`.

Matemaatiliselt identne dolly liigutamisega (translatsioonid kommuteeruvad),
aga ei vaja üheski brauseris preserve-3d tuge.

Lisaks:

- **`will-change: transform` käib LEHT-plaanidel, MITTE ümbriskihtidel.**
  Kaks eri asja: (a) perspektiivikonteineril / preserve-3d ahela
  vahekihtidel on will-change teadaolev WebKiti lamendamise käivitaja —
  sinna EI tohi; (b) plaanidel endil on see aga VAJALIK: transform muutub
  igal kaadril ja ilma komposiitkihita joonistab brauser teksti igal
  kaadril muutuval projektsiooniskaalal uuesti → tekst võbeleb. Kihina
  skaleeritakse valmis tekstuuri (liikudes veidi pehmem, aga stabiilne).
  Hajuvatele lastele (`opacity: var(--o)`) anna `will-change: opacity`
  samal põhjusel.
- Plaani SEES võib kasutada ühe astme preserve-3d (nt portree väikese
  z-nihkega) — kui see mõnes brauseris lameneb, on degradatsioon sujuv.

### Maalimisjärjekord

Ilma ühise preserve-3d konteksita maalitakse plaanid **DOM-järjekorras**,
mitte sügavuse järgi. Kaugem ruum kataks lähema. z-index parandab selle —
aga määra see ÜKS kord plaani `z` järgi, MITTE iga kaader `rel`-ist:

```js
el.style.zIndex = String(Math.round(z / 4) + 4000);   // seadistuses, üks kord
```

Miks staatiline: kõik plaanid liiguvad sama `--cam` võrra, seega
`rel_A − rel_B = z_A − z_B` on konstantne — suurema z-ga plaan on ALATI
eespool. Sügavusjärjekord ei muutu kunagi, seega z-indexit pole vaja
ümber arvutada. **Kui seda igal kaadril `rel`-ist muuta, churn'ib z-index
ja sunnib teksti pidevalt ümber joonistama — tekst hakkab võbelema.**

---

## 4. JS-i tuum: tick-silmus

```js
const SPEED   = matchMedia("(max-width: 720px)").matches ? 1.35 : 1.2;
const MAX_CAM = 6280;          // |viimase plaani z| − puhkenihe (~320)
let cam = 0, running = false, frame = null;

function envelope(rel) {
  // iga ruum elab AINULT omas lõigus (vt §6 häälestus)
  const fadeIn  = clamp01((rel + 1500) / 600);   // -1500 → -900
  const fadeOut = 1 - clamp01((rel - 260) / 380); //  260 → 640
  return fadeIn * fadeOut;
}

function tick() {
  const target = clamp(window.scrollY * SPEED, 0, MAX_CAM);
  cam += (target - cam) * 0.11;                 // sujuvus (lerp)
  if (Math.abs(target - cam) < 0.2) cam = target;

  dolly.style.setProperty("--cam", cam.toFixed(2) + "px");

  for (const p of planes) {
    const rel = p.z + cam;
    // Aken järgib ümbrikke: nähtamatut plaani ei komposiitita edasi —
    // läbilennul kasvab plaan kuni ~6× ja peidetuna see raster säästub.
    if (rel < -1600 || rel > 680) {
      p.el.style.visibility = "hidden";
      continue;
    }
    p.el.style.visibility = "visible";
    // z-index on juba seadistuses staatiliselt paigas (vt Maalimisjärjekord).
    // Kirjuta --o AINULT muutumisel — iga-kaadri stiilikirjutus võbeleb.
    const o = envelope(rel);
    if (Math.abs(o - p.lastO) > 0.002) { p.lastO = o; p.el.style.setProperty("--o", o.toFixed(3)); }
  }

  if (cam === target) { running = false; return; }  // magama, kui paigal
  frame = requestAnimationFrame(tick);
}

function wake() {
  if (!running) { running = true; frame = requestAnimationFrame(tick); }
}

addEventListener("scroll", wake, { passive: true });
document.addEventListener("visibilitychange", () =>
  document.hidden ? cancelAnimationFrame(frame) : wake());
wake();
```

Olulised omadused:

- **Silmus magab**, kui kaamera on sihil — protsessor puhkab paigalseisus.
- **`SPEED`** lahutab sõrmetee geomeetriast: rada = `100vh + MAX_CAM/SPEED`,
  kõik ankrud = `kaameraväärtus / SPEED`. Nii saab lendu "lühemaks" keerata
  ühte numbrit muutes.
- Kiirendusega peavad kaasas käima KÕIK kerimisteisendused: raja kõrgus,
  ankrute `top`, programmiline `scrollTo`.

---

## 5. Lõksud, mis on juba korra kätte maksnud

1. **Pesastatud preserve-3d + iOS** → lame kaadripilt, plaanid üksteise
   peal. Lahendus §3. Lisa ka *käivitusaegne proov*:

   ```js
   function perspectiveWorks(dolly) {
     const probe = document.createElement("div");
     probe.style.cssText = "position:absolute;width:100px;height:100px;" +
       "transform:translateZ(-1100px);visibility:hidden";
     dolly.appendChild(probe);
     const w = probe.getBoundingClientRect().width;
     probe.remove();
     return w < 80;      // 3D töötab → ~50px; lame → 100px
   }
   ```

   Kui `false` (või `prefers-reduced-motion`), näita tavalist lamedat
   vertikaalset lehte (meil klass `.bfl--flat`).

2. **SVG-teosed `<img>` sees**: `feTurbulence`/`feDisplacementMap` (ja muud
   filter-primitiivid) **ei renderdu iOS-is** — kast tuleb õige mõõduga,
   sisu jääb tühjaks. Ära kasuta SVG-filtreid; küpseta efektid joonte sisse.

3. **Pildid laadi `eager` JA dekodeeri ette** — lennus jõuab lazy-pilt
   kohale alles siis, kui raam on juba ekraanil (tühi raam). Ja isegi
   eager-pildi *dekodeerimine* juhtub alles esimesel komposiitimisel — see
   maandub täpselt esimese läbilennu hetkele ja hakib (teisel korral on
   puhvris ja sujuv). Ravi: intro ajal käi kõik lennu pildid läbi:

   ```js
   setTimeout(() => {
     dolly.querySelectorAll("img").forEach((img) => {
       img.decode?.().catch(() => {});
     });
   }, 700);
   ```

4. **`position: fixed; inset: 0` iOS-is** mõõdetakse *väikese* vaateava
   järgi: kui Safari tööriistariba kokku kerib, jääb ekraani alaserv katmata
   ja "alt kerib välja" dokumendi taust. Lahendus: `height: 100lvh` +
   sektsioonile stseeniga sama värvi taust.

5. **Kummipaela-ületõmme**: kui lehe taust on gradient (background-image),
   näitab iOS ületõmbel VALGET. Anna `html`-ile soe taustavärv
   (`background-color`).

6. **rAF ei käi peidetud tabis** — visibilitychange-käsitlus on kohustuslik,
   muidu ärkab leht segaduses.

7. **Klikid lennu ajal**: kaamera triivib pärast sõrme tõstmist → click võib
   kaduda. Kuula `pointerdown/-up` paari (liikumine < ~12px = klikk), leia
   sihtmärk `document.elementFromPoint`-iga ja kui tabamus ebaõnnestub, ava
   parasjagu "kohal" oleva ruumi link. Pärast programmilist navigeerimist
   suru järgnev click-sündmus alla (~400ms), muidu topeltnavigeerimine.

8. **Deps-massiivi pikkus** (React): kui lisad efektile sõltuvuse, tee kohe
   täislaadimine — HMR-plaastriga instants jääb muidu poolelusse seisu.

9. **Teksti võbelemine** — kolm süüdlast, tähtsuse järjekorras:
   (a) PEAMINE: plaanid pole komposiitkihid → iga kaadri transform maalib
   teksti muutuval projektsiooniskaalal uuesti. Ravi: `will-change:
   transform` plaanidele + `will-change: opacity` hajuvatele lastele
   (vt §3 "Lisaks"). (b) z-index, mida arvutati `rel`-ist igal kaadril —
   määra staatiliselt (vt Maalimisjärjekord). (c) `--o` kirjutamine ka
   siis, kui väärtus ei muutunud — valvesta lävendiga. Kirjuta plaanile
   iga kaader AINULT `--cam` — kõik muu ainult tegeliku muutuse korral.

---

## 6. Häälestustabel (meie väärtused)

| Parameeter | Väärtus | Mida muudab |
|---|---|---|
| `perspective` | 1100px (mobiil 950px) | kui "lainurkne" sügavus on |
| `ROOM_DEPTH` | 1500px | ruumide vahe kaameraühikutes |
| esimese ruumi z | −2100px | kui kaugelt lend algab |
| `REST_OFFSET` | 320px | kui kaugele finaalsein "istuma" jääb |
| fadeIn | rel −1500 → −900 | ruum ilmub alles siis, kui eelmine on kohal; intro on tühi |
| fadeOut | rel 260 → 640 | mööduv ruum kaob kiiresti, ei kata järgmist |
| brändi fadeOut | rel −80 → 360 | pealkiri hajub esimese kerimisega |
| nähtavusaken | rel −1600 … 680 | väljaspool → `visibility: hidden`; hoia napilt ümbrikest laiem (fadeIn −1500, fadeOut 640), muidu komposiiditakse nähtamatuid plaane hiigelskaalas |
| lerp | 0.11 | kaamera sujuvus (suurem = napsakam) |
| `SPEED` | desktop 1.2, mobiil 1.35 | sõrmetee ↔ lennu pikkus |
| marker-aken | rel −1480 … 520 | millal "01/03 Nimi" indikaator vahetub |
| kliki-aken | opacity > 0.15 ja rel −2050 … 160 | millal ruum on klikitav |

Ankur "keri sisse" viib kaamerale `|z| − 900` (ruum just täisnähtav,
skaala ~0.55) — kui muudad fadeIn-akent, kontrolli, et ankrupunktis oleks
ümbrik 1.

---

## 7. Viimistlus, mis müüb efekti maha

- **Bränd laguneb kerimisel**: kaks sõna liiguvad eri suunas
  (`translateZ(calc(var(--split) * 560px))` ja −300px), `--split = cam/680`.
- **Menüü**: lennu ajal FIKSEERITUD ja hajutatud (`opacity`/`visibility`
  CSS-muutujatest), naaseb finaalis. Absoluutne päis rebeneks iOS-i
  kummipaelal stseenist lahti.
- **Kerimisvihje** hajub esimese 240px jooksul.
- **Menüü "Kontakt"** hüppab hashiga otse lõppu:
  `scrollTo(maxCam / SPEED)` + `cam = maxCam` (ilma kogu lendu mängimata).
- **Taustal elav värv** (WebGL-vedeliku sim) vahetab paletti aktiivse ruumi
  esindusteose järgi. NB! palett liigub **imperatiivse ref'i** kaudu otse
  simulatsiooni, MITTE React state'iga — üldreegel: kõik, mis muutub lennu
  ajal (kaamera, läbipaistvus, palett), käib ref'i/CSS-muutuja/otsese
  DOM-kirjutuse kaudu; `setState` keset lendu lepitab kogu stseeni ja
  viskab kaadreid maha.
- Klaviatuur: iga ruum on `<a>`, fookusel keritakse tema ankrusse
  (`data-cam` atribuut).

---

## 8. Failid selles repos

| Fail | Sisu |
|---|---|
| `src/components/home/FlightScene.jsx` | kogu loogika: tick, ümbrikud, proov, klikid, marker |
| `src/app/globals.css` (sektsioon "BFL") | lava, plaanid, nameplate'id, flat-fallback, mobiilireeglid |
| `src/app/page.js` | andmete ettevalmistus (ruumid = artistid + esindusteos) |

Kopeerimisel teise projekti: võta FlightScene + BFL-CSS blokk + selle faili
§5 kontrollnimekiri. React pole nõue — §2–§4 skelett töötab puhta JS-iga.
