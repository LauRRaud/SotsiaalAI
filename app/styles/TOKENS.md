# SotsiaalAI CSS tokenite omandimudel

See dokument määrab, kuidas SotsiaalAI CSS-is custom property ehk `--token` väärtuseid kasutada. Eesmärk on vältida olukorda, kus sama token tähendab eri failides eri asja ja hiljem tuleb erinevusi parandada `!important` või järjestuse override’idega.

## Tokenite kihid

### 1. Foundation tokenid

Foundation tokenid kirjeldavad kõige madalamat disainikeelt. Need ei tohi viidata konkreetsele komponendile ega route’ile.

Näited:

```css
:root {
  --base-rem: 16px;
  --ui-scale: 1;
  --brand-primary: #c57171;
  --brand-accent: var(--brand-primary);

  --radius-sm: 0.5rem;
  --radius-md: 0.9rem;
  --radius-lg: 1.2rem;
  --radius-xl: 1.5rem;

  --z-base: 0;
  --z-panel: 10;
  --z-sticky: 100;
  --z-dropdown: 300;
  --z-overlay: 500;
  --z-modal: 600;
  --z-toast: 700;
}
```

Omanik: `app/styles/tokens.css` või eraldi foundation-token failid.

Reegel: foundation tokenit ei defineerita feature-failis ümber. Feature võib sellele viidata, kuid ei tohi muuta selle tähendust.

---

### 2. Semantic tokenid

Semantic tokenid kirjeldavad UI tähendust, mitte konkreetset komponenti.

Näited:

```css
:root {
  --surface-page: ...;
  --surface-panel: ...;
  --surface-elevated: ...;
  --surface-glass: ...;

  --text-primary: ...;
  --text-secondary: ...;
  --text-muted: ...;

  --border-subtle: ...;
  --border-strong: ...;
  --focus-ring: ...;
}
```

Omanik: `tokens.css` ja `theme/*.css`.

Reegel: semantic tokeni väärtust võivad muuta ainult teemafailid või ligipääsetavuse globaalsed kihid. Feature-fail ei peaks defineerima üldist semantic tokenit nagu `--input-bg`, `--btn-primary-bg` või `--subpage-card-bg`, kui see muudatus mõjutab ainult üht vaadet.

---

### 3. Component tokenid

Component tokenid kuuluvad korduvkasutatavale komponendile või shared primitive’ile.

Näited:

```css
.mobile-glass-card {
  --mobile-glass-card-radius: var(--radius-xl);
  --mobile-glass-card-bg: var(--surface-glass);
}

.modal-shell {
  --modal-surface: var(--surface-elevated);
  --modal-radius: var(--radius-xl);
}
```

Omanik: komponendi või shared primitive’i CSS-fail.

Reegel: component token võib olla lokaliseeritud selektori sees. Kui mitu feature’it kasutab sama primitive’i, siis tokeni baasväärtus peab jääma primitive’i faili ja feature kasutab alias-tokenit.

---

### 4. Feature alias tokenid

Feature alias token seob feature’i konkreetse primitive’i või semantic tokeniga.

Näited:

```css
.service-map-shell {
  --service-map-panel-bg: var(--surface-panel);
  --service-map-toolbar-radius: var(--radius-lg);
}

.workspace-shell {
  --workspace-card-bg: var(--surface-glass);
}
```

Omanik: feature’i entrypoint või feature’i oma tokenifail.

Reegel: feature alias token ei tohi olla üldise nimega. Halb: `--card-bg`. Hea: `--service-map-card-bg` või `--workspace-card-bg`.

---

### 5. Theme override tokenid

Theme override muudab tokenite väärtust valitud teema või ligipääsetavuse režiimi alusel.

Näited:

```css
[data-theme="mono"] {
  --surface-panel: ...;
  --text-primary: ...;
}

[data-contrast="hc"] {
  --border-strong: ...;
  --focus-ring: ...;
}
```

Omanik: `app/styles/theme/*.css`.

Reegel: teemafail peaks eelistatult muutma tokeneid, mitte terveid komponentide selektoreid. Komponendi selektori override teemafailis on lubatud ainult siis, kui tokeniga ei saa sama tulemust saavutada.

---

## Tokenite nimekonventsioon

| Kiht | Muster | Näide |
|---|---|---|
| Foundation | `--brand-*`, `--radius-*`, `--space-*`, `--z-*` | `--radius-lg` |
| Semantic | `--surface-*`, `--text-*`, `--border-*`, `--focus-*` | `--surface-panel` |
| Component | `--<component>-*` | `--modal-radius` |
| Feature alias | `--<feature>-*` | `--service-map-panel-bg` |
| State | `--*-hover`, `--*-active`, `--*-focus`, `--*-disabled` | `--btn-primary-bg-hover` |
| Accessibility | `--a11y-*` või semantic override | `--focus-ring` |

## Reeglid uue tokeni lisamisel

1. Ära lisa uut üldise nimega tokenit feature-faili.
2. Kui token on kasutusel ainult ühes feature’is, kasuta feature-prefix’it.
3. Kui sama väärtus kordub mitmes feature’is, tõsta see semantic või component tokeniks.
4. Kui teemafail tahab muuta komponenti, proovi esmalt muuta semantic tokenit.
5. Ära defineeri sama tokenit uues failis teise tähendusega.
6. Kui token vajab mitut väärtust eri teemades, kirjuta override teemafaili, mitte feature’i sisse.
7. `!important` ei tohi olla tokeni omandiprobleemi lahendus.
8. Tokeni ümbernimetamisel tee seda väikese patch’ina ja kontrolli route’i kaupa.

## Praegu probleemsed tokenigrupid

Tokeniauditi järgi vajavad esimesena korrastamist need grupid:

| Grupp | Probleem |
|---|---|
| `--subpage-card-*` | liiga palju väärtusi ja kasutuskohti, segab shared subpage primitive’i ja feature-kaarte |
| `--btn-primary-*` | sama nimi kirjeldab eri nuputüüpe ja eri teemasid |
| `--input-*` | vormivälja shared tokenid ja feature-spetsiifilised toonid on segamini |
| `--glass-*` | glass primitive, modal ja feature-pinnad on sama nimevälja all |
| shadow tokenid | väga palju käsitsi kirjutatud varjuväärtusi |
| radius väärtused | liiga palju väikese erinevusega väärtusi |
| `z-index` | vajab ühist skaalat enne modali/overlay refaktorit |

## Soovitatud tööjärjekord

1. Lisa auditiskript ja kasuta seda baseline’i mõõtmiseks.
2. Fikseeri foundation-tokenite nimekiri dokumenteeritult.
3. Lisa radius- ja z-index-skaala ilma olemasolevat kasutust kohe ümber kirjutamata.
4. Võta üks väike grupp, näiteks `--subpage-card-*`, ja määra omanikud.
5. Alles seejärel vähenda `!important` kasutust, sest siis on põhjus, mitte sümptom, lahendatud.

## Auditikäsk

```bash
npm run css:tokens
```

See kirjutab väljundid `reports/css-token-audit.json` ja `reports/css-token-collisions.csv`.

---

## `--subpage-card-*` tokenipere omand

`--subpage-card-*` on ajalooliselt olnud kõige segasem tokenipere, sest sama nime all on korraga olnud kolm rolli:

1. **canonical default** — vaikimisi subpage/card surface väärtused;
2. **theme override** — light/mid/night/mono/HC väärtused;
3. **feature bridge** — konkreetse feature’i kaardi või vormipinna väärtus.

Edaspidi tuleb neid käsitleda nii.

### Canonical default

Omanik: `app/styles/tokens.css`.

Lubatud tokenid:

```css
--subpage-card-bg
--subpage-card-bg-hover
--subpage-card-border
--subpage-card-border-hover
--subpage-card-border-width
--subpage-card-shadow
--subpage-card-shadow-hover
--subpage-card-radius
--subpage-card-text
```

Need annavad fallback-väärtuse. Neid ei tohi feature-failis kasutada uue kujunduse loomise kohana.

### Theme override

Omanik: `app/styles/theme/*.css`.

Teemafail võib muuta `--subpage-card-*` väärtusi ainult teema kontekstis. Kui muudatus kehtib ainult ühele feature’ile, tuleb kasutada feature-prefiksiga tokenit.

Lubatud näide:

```css
:root.theme-night {
  --subpage-card-bg: var(--input-flat-bg);
}
```

Vältida:

```css
:root.theme-night .specific-feature-panel {
  --subpage-card-bg: ...;
}
```

Selline väärtus peaks kuuluma feature’i enda tokenisse.

### Shared primitive override

Omanikud:

- `app/styles/shared/glass-subpage.css`
- `app/styles/mobile/foundations.css`
- `app/styles/mobile/modal-surfaces/form-theme.css`
- `app/styles/mobile/scroll-panels/glass-card.css`
- `app/styles/mobile/interaction-surfaces.css`
- `app/styles/shared/workspace-guide.css`

Need failid võivad `--subpage-card-*` väärtust muuta ainult shared primitive’i sees, näiteks `.glass-subpage-surface` või `.mobile-keep-desktop-glass-cards` scope’is.

### Feature bridge

Feature ei peaks üldjuhul defineerima `--subpage-card-*` otse. Soovitud muster on:

```css
.documents-workspace {
  --documents-card-bg: var(--documents-surface-panel-bg);
  --documents-card-border: var(--documents-surface-panel-border);

  --documents-subpage-card-bg: var(--documents-card-bg);
  --documents-subpage-card-border: var(--documents-card-border);

  --subpage-card-bg: var(--documents-subpage-card-bg);
  --subpage-card-border: var(--documents-subpage-card-border);
}
```

Eesmärk ei ole `--subpage-card-*` täielikult keelata, vaid muuta see **bridge-tokeniks**, mida feature seob oma prefiksiga tokeni kaudu. Feature’i päris väärtus peab olema feature-prefiksiga tokenis.

Näited aktsepteeritud feature-alias tokenitest:

- `--documents-subpage-card-*`
- `--chat-subpage-card-*`
- `--service-map-subpage-card-*`

Kui `features/` all olev `--subpage-card-*` definitsioon viitab `var(--<feature>-subpage-card-*)` alias-tokenile, märgib audit selle kategooriana `feature-bridge`. Kui väärtus on endiselt otse värv, shadow või muu mitte-feature alias, jääb see kategooriasse `feature-direct-definition`.

### Praegune migratsioonireegel

Auditiskript märgib `features/` all olevad otse `--subpage-card-*` definitsioonid kategooriana `feature-direct-definition`, kui need ei kasuta feature-prefiksiga bridge-alias tokenit. Need ei lõhu build’i, kuid on järgmised migratsioonikandidaadid.

Lubatud ajutine seis:

- `feature-direct-definition` võib eksisteerida, kuni vastava feature’i tokenid on eraldi korrastatud;
- `other` kategooriasse kuuluvad definitsioonid ei ole lubatud;
- uusi `--subpage-card-*` definitsioone ei lisata feature-faili ilma feature-prefiksiga alias-tokenita.

Kontroll:

```bash
npm run css:tokens
```

Väljund:

- `reports/css-token-audit.json`
- `reports/css-token-collisions.csv`
- `reports/css-token-family-subpage-card.csv`

---

## `--btn-primary-*` tokenipere omand

`--btn-primary-*` kirjeldab esmase tegevusnupu shared primitive'i vaikeolekuid. Sama nime ei tohi feature-failis kasutada konkreetse route'i nupu lõpliku kujunduse hoidmiseks.

### Canonical default

Omanik: `app/styles/tokens.css`.

Canonical default annab esmase nupu fallback-väärtused:

```css
--btn-primary-bg
--btn-primary-bg-hover
--btn-primary-bg-active
--btn-primary-border
--btn-primary-border-hover
--btn-primary-border-active
--btn-primary-text
--btn-primary-shadow
--btn-primary-shadow-hover
--btn-primary-shadow-active
--btn-primary-shadow-focus
```

### Theme override

Omanik: `app/styles/theme/*.css`.

Teemafail võib muuta `--btn-primary-*` väärtusi ainult globaalse teema või ligipääsetavuse režiimi tähenduses. Kui muudatus puudutab ainult üht feature'it, peab väärtus liikuma feature-prefiksiga alias-tokenisse.

### Shared primitive

Lubatud shared primitive'i omanikud:

- `app/styles/shared/ui-glow.css`
- `app/styles/mobile/interaction-surfaces.css`
- `components/ui/BorderGlow.module.css`

Ajutiselt on lubatud ka `app/styles/shared/register.css` kui legacy shared feature, kuni register-vormide pind on eraldi korrastatud.

### Feature bridge

Feature ei peaks defineerima `--btn-primary-*` otse lõpliku väärtusega. Soovitud muster:

```css
.documents-workspace {
  --documents-btn-primary-bg: ...;
  --documents-btn-primary-text: ...;

  --btn-primary-bg: var(--documents-btn-primary-bg);
  --btn-primary-text: var(--documents-btn-primary-text);
}
```

Aktsepteeritud feature-alias tokenid on näiteks:

- `--chat-btn-primary-*`
- `--documents-btn-primary-*`
- `--covision-btn-primary-*`
- `--wellbeing-btn-primary-*`

Kui `features/` või feature-komponendi CSS-is olev `--btn-primary-*` definitsioon viitab `var(--<feature>-btn-primary-*)` alias-tokenile, märgib audit selle kategooriana `feature-bridge`. Kui väärtus on endiselt otse värv, shadow, border või muu mitte-feature alias, jääb see kategooriasse `feature-direct-definition`.

`app/styles/features/chat/*` kasutab chat-spetsiifiliste nupu väärtuste jaoks `--chat-btn-primary-*` alias-tokeneid ja mapib need tagasi üldistele `--btn-primary-*` tokenitele.
`components/covision/CovisionPage.module.css` kasutab Covision-spetsiifiliste HC nupu väärtuste jaoks `--covision-btn-primary-*` alias-tokeneid ja mapib need samas selectoris tagasi üldistele `--btn-primary-*` tokenitele.
`app/styles/features/documents/ui.css` kasutab dokumentide HC nupu väärtuste jaoks `--documents-btn-primary-*` alias-tokeneid ja mapib need samas selectoris tagasi üldistele `--btn-primary-*` tokenitele.
`components/wellbeing/WellbeingPage.module.css` kasutab tööheaolu nupu teksti väärtuse jaoks `--wellbeing-btn-primary-*` alias-tokenit ja mapib selle samas feature-shell'is tagasi üldisele `--btn-primary-*` tokenile.

### Praegune migratsioonireegel

Lubatud ajutine seis:

- `feature-direct-definition` ei tohiks enam `btn-primary` peres kasvada;
- `feature-bridge` on feature-spetsiifilise kujunduse soovitud vaheetapp;
- `legacy-shared-feature` on ajutine register shared CSS-i kategooria;
- `other` kategooriasse kuuluvad definitsioonid ei ole lubatud;
- uusi `--btn-primary-*` definitsioone ei lisata feature-faili ilma feature-prefiksiga alias-tokenita.

Kontroll:

```bash
npm run css:tokens
npm run css:tokens:check
```

Täiendav väljund:

- `reports/css-token-family-btn-primary.csv`

---

## Vormiväljade tokenipere omand

Vormiväljade üldtokenid katavad praegu neli seotud nimevälja:

- `--input-*`
- `--field-*`
- `--textarea-*`
- `--select-*`

Need tokenid kirjeldavad tekstiväljade, valikuväljade ja seotud vormipindade tausta, teksti, border'i, placeholder'i, hover/focus olekut, caret'i, shadow't ja disabled olekut.

### Canonical default

Omanik: `app/styles/tokens.css`.

Canonical default annab vormiväljade üldise fallback'i. See ei ole koht ühe feature'i konkreetse kujunduse kirjeldamiseks.

Näited:

```css
--input-bg
--input-bg-hover
--input-bg-focus
--input-border
--input-text
--input-placeholder
--input-caret
--input-radius
--input-blur       /* liquid glass: tausta hägu (32px; hc/reduce-transparency: 0) */
--input-highlight  /* liquid glass: sisemine helk üleval + õrn peegeldus all */
--input-shadow     /* liquid glass: pehme kukkuv vari */
```

NB (2026-07-07): vormiväljade MATERJAL on liquid glass (etalon
`Plaan/input näide.png`) ja elab ÜHES kohas — `glass.css`
`:where()`-primitiiv + ülaltoodud tokenid. Feature-failid juhivad
ainult paigutust/mõõtu; materjali (bg/border/blur/highlight/shadow)
feature-failis ÜLE EI KIRJUTATA.

### Theme override

Omanik: `app/styles/theme/*.css`.

Teemafail võib muuta üldiseid `--input-*`, `--field-*`, `--textarea-*` ja `--select-*` väärtusi ainult teema ulatuses. Kui väärtus kehtib ainult ühes feature'is, peab see liikuma feature-prefiksiga alias-tokenisse.

Lubatud näide:

```css
:root.theme-night {
  --input-bg: var(--form-surface);
  --input-bg-hover: var(--form-surface-hover);
}
```

Vältida:

```css
:root.theme-night .documents-workspace {
  --input-bg: ...;
}
```

Selline väärtus peab kuuluma näiteks `--documents-input-bg` alias-tokenisse.

### Shared primitive

Lubatud shared primitive'i omanikud:

- `app/styles/shared/glass-subpage.css`
- `app/styles/mobile/scroll-panels/glass-card.css`
- `app/styles/mobile/modal-surfaces/form-theme.css`

Need failid võivad vormitokeneid defineerida ainult shared primitive'i ulatuses, näiteks glass-subpage või mobiili glass-card pinna jaoks. Need ei tohi sisaldada konkreetse feature'i vormiloogikat.

### Feature bridge

Feature ei peaks defineerima üldist vormitokenit otse lõpliku väärtusega. Soovitud muster:

```css
.documents-workspace {
  --documents-input-bg: ...;
  --documents-input-bg-hover: ...;
  --documents-input-border: ...;

  --input-bg: var(--documents-input-bg);
  --input-bg-hover: var(--documents-input-bg-hover);
  --input-border: var(--documents-input-border);
}
```

Feature'i päris väärtus peab olema feature-prefiksiga tokenis, näiteks:

- `--chat-input-*`
- `--documents-input-*`
- `--documents-field-*`
- `--documents-textarea-*`
- `--documents-select-*`
- `--service-map-input-*`
- `--invite-input-*`
- `--register-input-*`
- `--auth-input-*`
- `--profile-input-*`
- `--wellbeing-input-*`
- `--covision-input-*`

Chat'i drawer/sidebar vormiväljade HC väärtused kasutavad `--chat-input-*` alias-tokeneid ja mapivad need samas selectoris tagasi üldistele `--input-*` tokenitele.

Kui `features/` või feature-komponendi CSS-is olev üldine vormitoken viitab `var(--<feature>-input-*)`, `var(--<feature>-field-*)`, `var(--<feature>-textarea-*)` või `var(--<feature>-select-*)` alias-tokenile, märgib audit selle kategooriana `feature-bridge`. Kui väärtus on endiselt otse värv, shadow, border või muu mitte-feature alias, jääb see kategooriasse `feature-direct-definition`.

### Praegune migratsioonireegel

Lubatud ajutine seis:

- `feature-direct-definition` võib eksisteerida, kuni vastava feature'i vormiväljad on eraldi korrastatud;
- `feature-bridge` on soovitud vaheetapp;
- `other` kategooriasse kuuluvad definitsioonid ei ole lubatud;
- uusi `--input-*`, `--field-*`, `--textarea-*` või `--select-*` definitsioone ei lisata feature-faili ilma feature-prefiksiga alias-tokenita.

Kontroll:

```bash
npm run css:tokens
npm run css:tokens:check
```

Täiendav väljund:

- `reports/css-token-family-form-control.csv`
