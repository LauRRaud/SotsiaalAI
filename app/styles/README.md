# app/styles — hämarikuruumi visuaalne kiht

Ehitatud 2026-07 visuaalse briefi (Plaan/sotsiaalai-visuaalne-brief-v1_1.md)
ja kujundusreeglite (Plaan/sotsiaalai-kujundusreeglid.md) järgi, koos tellija
jooksvate korrektuuridega (vt allpool "Tellija otsused").

## Struktuur ja kihid

Kõik failid impordib `globals.css` FIKSEERITUD järjekorras; komponendifailid
on mähitud `@layer` kihtidesse, et Tailwind v4 utiliitidega ei tekiks
spetsiifisuskonflikte (kujundusreeglid §1):

| Fail | Kiht | Sisu |
|---|---|---|
| `tokens.css` | (kihita) | KÕIK muutujad: stseenipalett, klaas, tekst, liquid-nupud, tempod, fookus, mõõdud (`--gc-w` jne). Kõrgkontrast + läbipaistvuse vähendus. |
| `tailwind.css` | (v4 entry) | Tailwindi kihideklaratsioon. |
| `base.css` | `base` | Dokument, tüpograafia, fookus, sr-only, skip-link, peidetud kerimisribad, grain. |
| `glass.css` | `components` | PRIMITIIVID: liquid glass nupp (`.glass-btn` + `button[data-variant]` + klahvistik + ikoonnupud — ÜKS definitsioon), GlassSurface, GlassModal, GlassListRow. |
| `room.css` | `components` | Lavastus: kaadrid, loor (+Sisenen), kõnnitekstid, kerimisvihje, dokk, paneelirežiimi hägu. |
| `carousel.css` | `components` | Klaaskaartide karussell: geomeetria (`--gc-spacing`, 19° sissepoole kalle), kuma, punktid, nooled kaartide kõrval. |
| `panel.css` | `components` | Avatud paneeli raam (×, menüü), sisu tüpograafia, vormid, OptionCard. Tagasi-nool paneelis peidetakse. |
| `login.css` | `components` | Login = keskmine kaart klahvistikuga (pilt 12); ilma katteta. |
| `register-flight.css` | (kihita) | Registreerimise jaamalend: 3D-plaanid (`.rgf-*`), dokk, flat-fallback. Mootor `components/register/useStationFlight.js`. |
| `a11y-modal.css` | `components` | Keel ja ligipääsetavus modal (esmakülastus + profiil). |
| `chat.css` | `components` | Vestlusaken (pilt 9): mullid `[role="article"][data-role]`, komposer (+ pilli sees, liquid saada-nupp), tööriistamenüü. |
| `workspace.css` | `components` | Töölaud (pilt 10): 2-veeruline `.workspace-dashboard-card` ruudustik. |

React-primitiivid: `components/glass/` (GlassButton, IconButton, GlassCard,
GlassModal, GlassSurface, GlassListRow, JourneyText). Ikoonid AINULT
`components/brand/icons/` kaustast (õhuke joon, currentColor).

## Reeglid

1. **Primitiivid loevad ainult tokeneid.** Uus toon/tempo → tokens.css, mitte
   komponenti. Variandid on lukus: `default` | `primary` | (ikoonnupp).
2. **Ruumi-kihi dünaamika** (kaadrid, dokk, tekstid) kirjutab RoomStage
   imperatiivselt transform/opacity/filter peale — AINULT GPU-omadused.
   Diskreetsed seisundid käivad CSS-muutujate/data-atribuutide kaudu
   (`--dock`, `data-room-mode`, `data-login-open`).
3. **Kerimisribad on kõikjal peidetud** (base.css). Ära taasta.
4. **Ei toonivarjundeid**: kiri on `--text-warm` perekond, pinnad neutraalse
   alfa klaasid. Soojus tuleb ruumist klaasi tagant. Kõrgkontrast on ainus
   erand (tokens.css lõpus).

## Tellija otsused (ÄRA taasta briefi vaikeväärtusi)

Vt mälufail `room-design-decisions.md` + Plaan/ kaust. Lühidalt: kõnd IGAL
laadimisel ("Sisenen" värav, mitte taimer); login/modalid = kaardi kohal
avanev sama klaas, ilma tumenduse-blurita; parallaks kursori SUUNAS; üks
karussellisamm korraga (860 ms lukk); vestluspaneel ei täida ekraani;
tagasi-noolt paneelides ei ole; profiil on sektsioonide karussell.
