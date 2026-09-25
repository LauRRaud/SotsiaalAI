/**
 * CardIcons — karusselli kaartide kontuurikoonid brändi õhukeses
 * joonestiilis (viewBox 24, stroke 1.5, ümarad otsad, currentColor).
 * Ainult siin defineeritud glüüfid; välised ikoonipakid on keelatud.
 */

const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/* Optiliselt vähendatud rühm (translate + scale). Scale kahandab ka joont,
   seega said need ikoonid naabritest peenema joone (omanik 25.09: „osad
   ikoonid teise paksusega"). Kompensatsioon kahes kohas:
   - atribuut 1.5 / s taastab vaikejoone;
   - `--icon-scale` laseb CSS-i ülekirjutustel (carousel.css .gc-icon ja
     .gc-shortcut-icon) jagada sama arvuga: calc(1.25 / var(--icon-scale)). */
const ScaledGroup = ({ s, transform, children }) => (
  <g transform={transform} style={{ "--icon-scale": s }}>
    {children}
  </g>
);
const Ps = (s) => ({ ...P, strokeWidth: Math.round((1.5 / s) * 1000) / 1000 });

const Svg = ({ children, ...props }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
    {children}
  </svg>
);

/* Juhend — avatud raamat */
export const GuideBookIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 6.2C10.6 4.9 8.6 4.2 6.2 4.2c-1 0-1.9.12-2.7.35V18.4c.8-.23 1.7-.35 2.7-.35 2.4 0 4.4.7 5.8 2 1.4-1.3 3.4-2 5.8-2 1 0 1.9.12 2.7.35V4.55a10.4 10.4 0 0 0-2.7-.35c-2.4 0-4.4.7-5.8 2Z" />
    <path {...P} d="M12 6.2v13.85" />
  </Svg>
);

/* Tingimused — dokument ridadega */
export const TermsDocIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M14.2 3.5H7.4A1.9 1.9 0 0 0 5.5 5.4v13.2c0 1.05.85 1.9 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V7.8l-4.3-4.3Z" />
    <path {...P} d="M14 3.7v4.2h4.2M9 12h6M9 15.4h6M9 8.7h2" />
  </Svg>
);

/* Privaatsus — kilp inimesega */
export const PrivacyShieldIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 3.4 5 6v5.2c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6l-7-2.6Z" />
    <circle {...P} cx="12" cy="10.2" r="2.1" />
    <path {...P} d="M8.6 16.1c.6-1.7 1.9-2.6 3.4-2.6s2.8.9 3.4 2.6" />
  </Svg>
);

/* Hinnastus — hinnasilt */
export const PricingTagIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="m12.9 3.6 7 7a1.9 1.9 0 0 1 0 2.7l-6.6 6.6a1.9 1.9 0 0 1-2.7 0l-7-7V5.5a1.9 1.9 0 0 1 1.9-1.9h7.4Z" />
    <circle {...P} cx="8.3" cy="8.3" r="1.15" />
  </Svg>
);

/* Paigalda — seade allanoolega */
export const InstallIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="4" y="4.5" width="16" height="11" rx="1.8" />
    <path {...P} d="M12 7v5m0 0 -2.2-2.2M12 12l2.2-2.2M8.4 19.5h7.2" />
  </Svg>
);

/* Kontakt — ümbrik */
export const ContactMailIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="3.5" y="5.5" width="17" height="13" rx="1.9" />
    <path {...P} d="m4.5 7 7.5 5.6L19.5 7" />
  </Svg>
);

/* Logi sisse — PIN-klahvistik (tellija 06.07 öö: kaasaegne, mitte võti;
   07.07: täidetud täpid, mitte tühjad rõngad) */
export const LoginKeyIcon = (props) => {
  const dot = { fill: "currentColor", stroke: "none" };
  return (
    <Svg {...props}>
      <circle {...dot} cx="5.6" cy="5.6" r="1.9" />
      <circle {...dot} cx="12" cy="5.6" r="1.9" />
      <circle {...dot} cx="18.4" cy="5.6" r="1.9" />
      <circle {...dot} cx="5.6" cy="12" r="1.9" />
      <circle {...dot} cx="12" cy="12" r="1.9" />
      <circle {...dot} cx="18.4" cy="12" r="1.9" />
      <circle {...dot} cx="5.6" cy="18.4" r="1.9" />
      <circle {...dot} cx="12" cy="18.4" r="1.9" />
      <circle {...dot} cx="18.4" cy="18.4" r="1.9" />
    </Svg>
  );
};

/* Analüütika — tulpdiagramm */
export const AnalyticsIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M4.5 4.5v14.2c0 .44.36.8.8.8h14.2" />
    <path {...P} d="M9 16v-4.4M13 16V8.4M17 16v-2.6" />
  </Svg>
);

/* RAG — andmebaasisilindrid */
export const RagDbIcon = (props) => (
  <Svg {...props}>
    <ellipse {...P} cx="12" cy="6" rx="7" ry="2.6" />
    <path {...P} d="M5 6v6c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6V6" />
    <path {...P} d="M5 12v6c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6v-6" />
  </Svg>
);

/* Kinnitused — kilp linnukesega */
export const AcceptShieldIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 3.4 5 6v5.2c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6l-7-2.6Z" />
    <path {...P} d="m8.9 11.8 2.2 2.2 4-4.2" />
  </Svg>
);

/* Keel ja ligipääsetavus — gloobus */
export const LanguageGlobeIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="12" r="8.2" />
    <path {...P} d="M3.8 12h16.4M12 3.8c-2.3 2.3-3.4 5.1-3.4 8.2s1.1 5.9 3.4 8.2c2.3-2.3 3.4-5.1 3.4-8.2S14.3 6.1 12 3.8Z" />
  </Svg>
);

/* Keel ja ligipääsetavus — silm (varasem etalon): mandlikuju + pupill */
export const LanguageAccessIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M2.5 12s3.46-6.05 9.5-6.05 9.5 6.05 9.5 6.05-3.46 6.05-9.5 6.05S2.5 12 2.5 12Z" />
    <circle {...P} cx="12" cy="12" r="2.6" />
  </Svg>
);

/* Konto seaded — hammasratas (hammastega ring, mitte kiirtega "päike").
   Glüüf on veidi optiliselt vähendatud, kuid joon skaleerub koos SVG-ga
   nagu kõigil teistel selle faili ikoonidel. `non-scaling-stroke` jättis
   hammasratta suurel kaardil 1,5 px joonele, samal ajal kui naabrite joon
   kasvas koos ikooniga mitme piksli paksuseks. */
export const AccountGearIcon = (props) => (
  <Svg {...props}>
    <ScaledGroup s={0.9} transform="translate(12 12) scale(0.9) translate(-12 -12)">
    <circle {...Ps(0.9)} cx="12" cy="12" r="2.9" />
    <path
      {...Ps(0.9)}
      d="M18.8 14.7a1.6 1.6 0 0 0 .32 1.77l.05.05a1.94 1.94 0 1 1-2.74 2.74l-.05-.05a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.14a1.94 1.94 0 1 1-3.88 0v-.08a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.05.05a1.94 1.94 0 1 1-2.74-2.74l.05-.05a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.14a1.94 1.94 0 1 1 0-3.88h.08A1.6 1.6 0 0 0 4.46 8.8a1.6 1.6 0 0 0-.32-1.77l-.05-.05a1.94 1.94 0 1 1 2.74-2.74l.05.05a1.6 1.6 0 0 0 1.77.32h.07a1.6 1.6 0 0 0 .97-1.47v-.14a1.94 1.94 0 1 1 3.88 0v.08a1.6 1.6 0 0 0 .97 1.46c.6.26 1.28.13 1.77-.31l.05-.05a1.94 1.94 0 1 1 2.74 2.74l-.05.05a1.6 1.6 0 0 0-.32 1.77v.07a1.6 1.6 0 0 0 1.47.97h.14a1.94 1.94 0 1 1 0 3.88h-.08a1.6 1.6 0 0 0-1.46.97Z"
    />
    </ScaledGroup>
  </Svg>
);

/* Toitelüliti ⏻ — kaar + vertikaaljoon */
export const PowerIcon = (props) => (
  <Svg {...props}>
    {/* Glüüf tsentreeritud viewBox'i keskele (ring ulatub allapoole,
        joon üles) — translate hoiab sümboli optiliselt keskel. */}
    <g transform="translate(0 0.6)">
      <path {...P} d="M12 3.8v7.4" />
      <path {...P} d="M7.2 6.4a7.1 7.1 0 1 0 9.6 0" />
    </g>
  </Svg>
);

/* Uuenda PIN — lukk */
export const PinLockIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="5.5" y="10.2" width="13" height="9.3" rx="1.9" />
    <path {...P} d="M8.4 10V7.6a3.6 3.6 0 0 1 7.2 0V10M12 13.8v2.2" />
  </Svg>
);

/* Võimalused — sädemed */
export const SparkleIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M11 4.3c.5 3.7 2.4 5.6 6.1 6.1-3.7.5-5.6 2.4-6.1 6.1-.5-3.7-2.4-5.6-6.1-6.1 3.7-.5 5.6-2.4 6.1-6.1Z" />
    <path {...P} d="M17.9 15.3c.25 1.8 1.15 2.7 2.95 2.95-1.8.25-2.7 1.15-2.95 2.95-.25-1.8-1.15-2.7-2.95-2.95 1.8-.25 2.7-1.15 2.95-2.95Z" />
  </Svg>
);

/* Vestlus — kõnemull */
/* Vestlus — KANDILINE mull + kolm punkti (tellija etalon "kandilisem";
   ChatIcons.jsx ChatBubbleIcon kuju, joonistatud karusselli 24-ruudustikku
   → sama suurus ja joonekaal mis profiil/ruumid). */
export const ChatCardIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M5.5 4H18.5A3 3 0 0 1 21.5 7V12.5A3 3 0 0 1 18.5 15.5H10.5L6.5 20V15.5A3 3 0 0 1 2.5 12.5V7A3 3 0 0 1 5.5 4Z" />
    <circle cx="8" cy="9.75" r="1.05" fill="currentColor" />
    <circle cx="12" cy="9.75" r="1.05" fill="currentColor" />
    <circle cx="16" cy="9.75" r="1.05" fill="currentColor" />
  </Svg>
);

/* Ruumid — kaks inimest: kinnise kehaga esimene, teine kaarena taga.
   Joonistatud otse sisualasse 3–21 (omanik 25.09: kaardiikoonid ühtse
   ruudustiku järgi uuesti), seega ei vaja ta enam scale-normeerimist.
   Sama kuju kannab ka MentorIcon, seega mõõt tuleb ühest kohast. */
export const RoomsCardIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="9" cy="8" r="3.5" />
    <path {...P} d="M3.5 20v-1.25A4.25 4.25 0 0 1 7.75 14.5h2.5a4.25 4.25 0 0 1 4.25 4.25V20Z" />
    <path {...P} d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6" />
    <path {...P} d="M17.5 14.7a4.25 4.25 0 0 1 3 4.05V20" />
  </Svg>
);

/* Töölaud — töölaua ruudustik */
export const WorkspaceCardIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="4" y="4.4" width="7" height="7" rx="1.5" />
    <rect {...P} x="13.2" y="4.4" width="7" height="7" rx="1.5" />
    <rect {...P} x="4" y="13.6" width="7" height="7" rx="1.5" />
    <rect {...P} x="13.2" y="13.6" width="7" height="7" rx="1.5" />
  </Svg>
);

/* Profiil — inimene (tellija etalon; kuju ChatIcons.jsx ProfileIcon-ist:
   täidlasem korpus, currentColor). */
export const ProfileCardIcon = (props) => (
  <Svg {...props}>
    <g transform="translate(0 -1.3)">
      <path {...P} d="M9.3 15H14.7C16.8 15 18.4 16 19 17.6C19.5 18.9 19.4 20.1 19.2 21C18.7 23 16.3 23.6 12 23.6C7.7 23.6 5.3 23 4.8 21C4.6 20.1 4.5 18.9 5 17.6C5.6 16 7.2 15 9.3 15Z" />
      <circle {...P} cx="12" cy="7" r="4" />
    </g>
  </Svg>
);

/* Tellimus — euro kontuurina (mitte täidetud) */
export const SubscriptionEuroIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M16.6 6.1a6.9 6.9 0 1 0 0 11.8" />
    <path {...P} d="M4.6 10.4h8.2M4.6 13.6h7.2" />
  </Svg>
);

/* Tagasi — sabata chevron (varasem etalon): ainult teravik, ilma jooneta */
export const BackArrowIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M15 5l-7 7 7 7" />
  </Svg>
);

/* Meist / Teave — info-ring */
export const AboutInfoIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="12" r="8.2" />
    <path {...P} d="M12 11.2v5" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

/* Meist — brändi „S" (tellija 29.07). Ainus TÄIDETUD glüüf selles failis:
   logo on kirjamärk, mitte kontuurjoonis, ja tema oma joonepaksus ongi bränd.
   Rada tuleb muutmata kujul failist public/logo/sai-s-valge.svg (koordinaadid
   ümardatud 2 kohani) — kui logo muutub, tuleb see rada uuesti sealt võtta.
   Originaalkast on 24,19 × 39,77; transform mahutab ta 24-ruudu keskele
   kõrgusega 18, st kitsas kirjamärk tohib naabrite ringist pisut üle ulatuda,
   et jääda optiliselt sama suureks. */
const S_MARK =
  "M12.34 8.86Q14.99 8.92 17.71 9.1Q20.42 9.28 23.04 9.65L22.83 11.35Q20.34 11.2 17.69 11.08Q15.04 10.95 12.4 10.95Q9.88 10.95 8.07 11.11Q6.26 11.27 5.08 11.99Q3.9 12.7 3.36 14.32Q2.82 15.93 2.82 18.84Q2.82 22.81 4.15 24.56Q5.48 26.31 8.58 26.8L16.94 28.18Q21.24 28.82 22.97 31.18Q24.69 33.55 24.69 38.47Q24.69 41.86 23.92 43.9Q23.15 45.95 21.65 46.95Q20.14 47.96 17.9 48.29Q15.65 48.63 12.67 48.63Q10.48 48.63 7.65 48.5Q4.81 48.38 1.14 47.9L1.35 46.18Q3.78 46.33 5.6 46.41Q7.42 46.5 9.1 46.52Q10.78 46.54 12.76 46.54Q16.29 46.5 18.39 45.95Q20.49 45.4 21.43 43.66Q22.38 41.93 22.38 38.44Q22.38 35.58 21.79 33.94Q21.21 32.3 19.89 31.45Q18.57 30.6 16.4 30.29L8.01 28.91Q3.9 28.3 2.2 25.86Q0.5 23.43 0.5 18.81Q0.5 15.38 1.23 13.36Q1.97 11.35 3.42 10.36Q4.87 9.36 7.11 9.09Q9.35 8.82 12.34 8.86Z";

export const BrandSIcon = (props) => (
  <Svg {...props}>
    <g transform="translate(6.3 -1.01) scale(0.4526)">
      <path d={S_MARK} fill="currentColor" stroke="none" />
    </g>
  </Svg>
);

/* Haldus — näidik (gauge): kaar + osuti + telg */
export const AdminSlidersIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M4.5 15A7.5 7.5 0 0 1 19.5 15" />
    <path {...P} d="M12 15 14.75 10.24" />
    <circle {...P} cx="12" cy="15" r="1.15" />
  </Svg>
);

/* ---------- Töölaua komplekti kaardiikoonid (tellija 10.07:
   Töölaud/Tööheaolu = keritavad kaardikomplektid ruumi karussellis) ---------- */

/* Abisoovid — kõnemull südamega (abi küsimine) */
export const HelpRequestIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 4a8 8 0 1 1-3.9 15L4 20l1.05-4A8 8 0 0 1 12 4Z" />
    <path {...P} d="M12 14.6s-2.8-1.7-2.8-3.7a1.55 1.55 0 0 1 2.8-.95 1.55 1.55 0 0 1 2.8.95c0 2-2.8 3.7-2.8 3.7Z" />
  </Svg>
);

/* Abipakkumised — käsi hoiab südant (abi pakkumine) */
export const HelpOfferIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 11s-2.8-1.7-2.8-3.7a1.55 1.55 0 0 1 2.8-.95 1.55 1.55 0 0 1 2.8.95C14.8 9.3 12 11 12 11Z" />
    <path {...P} d="M3.5 13.5v7" />
    <path {...P} d="M3.5 14.5h3.2c.8 0 1.6.15 2.35.45l2.75 1.1a1.35 1.35 0 0 1-.9 2.55L8.5 18" />
    <path {...P} d="M3.5 19.5h4.3c.5 0 1 .08 1.5.24l1.9.6c.95.3 2 .2 2.85-.3l5.2-3.05a1.4 1.4 0 0 0-1.4-2.42L14.5 16.3" />
  </Svg>
);

/* Dokumendid — leht ridade ja kirjaklambriga (omaniku valik 23.09).
   Klamber eristab teda Tingimuste lehest (TermsDocIcon); kaust ei sobi,
   see on juba Juhtumite (CaseWorkIcon) kuju. */
export const DocumentsIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="5" y="4" width="14" height="17" rx="2.5" />
    <path {...P} d="M8.5 12.5h7M8.5 16h4.5" />
    <path {...P} d="M13.5 2.5v5a1.5 1.5 0 0 0 3 0V4" />
  </Svg>
);

/* Koosta dokument — leht pliiatsiga */
export const ComposeDocIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12.5 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5" />
    <path {...P} d="M17.6 3.9a1.65 1.65 0 0 1 2.35 2.35L13.4 12.8l-3.15.85.85-3.15Z" />
    <path {...P} d="M9 16.5h6" />
  </Svg>
);

/* Pöördumised — postkast saabuva noolega */
export const InquiryIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path {...P} d="M3.5 13h4.5l1.5 2.5h5l1.5-2.5h4.5" />
  </Svg>
);

/* Kutsu osaleja — terviklik inimene (alt kinnine keha, omanik 25.07) +
   pluss üleval paremal. Joonistatud otse sisualasse (25.09), ilma
   scale-normeerimiseta. */
export const InvitePersonIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="9.5" cy="8" r="3.5" />
    <path {...P} d="M4 20v-1.25A4.25 4.25 0 0 1 8.25 14.5h2.5A4.25 4.25 0 0 1 15 18.75V20Z" />
    <path {...P} d="M19 6.5v5M16.5 9h5" />
  </Svg>
);

/* Kovisioon — kolm inimest ringis (grupi ühine töö) */
export const KovisionIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="5.5" r="2" />
    <circle {...P} cx="5.5" cy="17" r="2" />
    <circle {...P} cx="18.5" cy="17" r="2" />
    <path {...P} d="M9.8 6.2a7.5 7.5 0 0 0-4.9 8.4M14.2 6.2a7.5 7.5 0 0 1 4.9 8.4M7.9 18.6a7.5 7.5 0 0 0 8.2 0" />
  </Svg>
);

/* Tööheaolu — süda pulsijoonega */
export const WellbeingIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 20s-8-4.7-8-10.2a4.3 4.3 0 0 1 8-2.2 4.3 4.3 0 0 1 8 2.2C20 15.3 12 20 12 20Z" />
    <path {...P} d="M6 12.5h2.6l1.4-2.3 2.4 4.6 1.4-2.3H18" />
  </Svg>
);

/* Materjalid — kihiline kogu (andmebaas) */
export const MaterialsIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 3.5 3.5 8 12 12.5 20.5 8Z" />
    <path {...P} d="M3.5 12 12 16.5 20.5 12" />
    <path {...P} d="M3.5 16 12 20.5 20.5 16" />
  </Svg>
);

/* Teenusekaart — kaardinõel */
export const ServiceMapIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 21s-6.5-5.55-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.45 12 21 12 21Z" />
    <circle {...P} cx="12" cy="10" r="2.4" />
  </Svg>
);

/* Teekond — punktiirrada peatuspunktidega */
export const JourneyPathIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="6" cy="18" r="2" />
    <circle {...P} cx="18" cy="6" r="2" />
    <path {...P} d="M8 18h5.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H16" />
  </Svg>
);

/* Kovisiooni ruum — grupp ringis (sama keel mis KovisionIcon, kuid raamitud) */
export const KovisionRoomIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="7.4" r="1.9" />
    <circle {...P} cx="6.4" cy="16.4" r="1.9" />
    <circle {...P} cx="17.6" cy="16.4" r="1.9" />
    <path {...P} d="M9.2 9.1a7.6 7.6 0 0 0-2.2 4.6M14.8 9.1a7.6 7.6 0 0 1 2.2 4.6M9.1 17.9a7.8 7.8 0 0 0 5.8 0" />
  </Svg>
);

/* Teemaseemned — idanev seeme (mõtte kasv) */
export const TopicSeedIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 20.5v-7" />
    <path {...P} d="M12 13.5c0-2.4 1.8-4.2 4.4-4.4-.2 2.6-2 4.4-4.4 4.4Z" />
    <path {...P} d="M12 15.4c0-2-1.5-3.5-3.7-3.7.2 2.2 1.7 3.7 3.7 3.7Z" />
    <circle {...P} cx="12" cy="6" r="2.1" />
  </Svg>
);

/* Parimad praktikad — kvaliteedimärk (kilp + linnuke) */
export const BestPracticeIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 3.6 5 6v5.2c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6l-7-2.4Z" />
    <path {...P} d="m9 11.6 2.1 2.1 4-4.2" />
  </Svg>
);

/* Isiklik otsing — luup */
export const SearchIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="10.5" cy="10.5" r="6.5" />
    <path {...P} d="m15.3 15.3 5.2 5.2" />
  </Svg>
);

/* Supervisioon — järelevalve/peegeldus: silm (ülevaade) */
export const SupervisionIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle {...P} cx="12" cy="12" r="3" />
  </Svg>
);

/* Mentorlus — sama kaks inimest mis Ruumidel (omanik 25.07). Mentorlus
   ON kahekesi olemine, seega kannab ta sama kuju; komplektid ei kattu,
   sest Ruumid elab peamenüüs ja Mentorlus töölaual. Kuju tuleb ühest
   kohast (RoomsCardIcon) — mitte koopiana, et nad ei saaks lahkneda. */
export const MentorIcon = (props) => <RoomsCardIcon {...props} />;

/* Välitöö — kodukülastus (maja avatud uksega) */
export const FieldIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M4 10.5 12 4l8 6.5" />
    <path {...P} d="M5.75 9.2V20h12.5V9.2" />
    <path {...P} d="M10 20v-5h4v5" />
  </Svg>
);

/* Refleksioon (Meetodipeegel) — käepeegel */
export const ReflectionIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="9" r="5.5" />
    <path {...P} d="M12 14.5V21" />
    <path {...P} d="M9.3 7.4a3 3 0 0 1 2.2-1.9" />
  </Svg>
);

/* Teenuseprofiil — teenuseosutaja kaart (ID-kaart) */
export const ServiceProfileIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="3" y="5" width="18" height="14" rx="2.5" />
    <circle {...P} cx="8.5" cy="10.3" r="2" />
    <path {...P} d="M5.6 15.8a3.1 3.1 0 0 1 5.8 0" />
    <path {...P} d="M14.5 10h4M14.5 13.5h3" />
  </Svg>
);

/* Teenuspäevik — päevikuleht kirjeridade ja kinnitusmärgiga. Tahtlikult
   ERINEV TermsDocIcon-ist (dokument ridadega): teenuspäevik on kinnitatav
   arvestus, mitte loetav dokument, ja märk on just see kinnitus. */
export const ServiceLogIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="5" y="4.5" width="14" height="16" rx="2.5" />
    <rect {...P} x="9" y="3" width="6" height="3.2" rx="1.2" />
    <path {...P} d="m9 13.5 2 2 4-4" />
  </Svg>
);

/* Organisatsioonid — maja astmelise katusega ja sissepääsuga. Tahtlikult
   ERINEV RoomsCardIcon-ist (inimrühm) ja ServiceProfileIcon-ist (ID-kaart):
   organisatsioon on ASUTUS, mille tööruumi sa sisened, mitte inimeste kogum
   ega kellegi profiil. */
/* Juhtumid — kaustaklapp ja kaks rida: konteiner, mille ümber töö käib.
   Kaust, mitte inimene: juhtum on töötaja töökorraldus, mitte kliendikirje. */
export const CaseWorkIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M3.5 7.5a2 2 0 0 1 2-2h3.6c.6 0 1.15.27 1.53.73L11.8 7.8h6.7a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    <path {...P} d="M9 14h6" />
  </Svg>
);

export const OrgIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M3.5 20.5h17" />
    <path {...P} d="M5.5 20.5V9.5L12 4.5l6.5 5v11" />
    <path {...P} d="M10.25 20.5v-4.5h3.5v4.5" />
    <path {...P} d="M9.5 11.5h.01M14.5 11.5h.01" />
  </Svg>
);

/* Minu jagamised — üks sõlm, millest hargneb kaks joont teistele. Kaar
   ümber ei ole kaunistus: kaart on jagamise ÜLEVAADE ja tagasivõtt, seega
   glüüf peab näitama, et jagatu jääb minu ringi sisse. */
export const SharingsIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="17.5" cy="5.5" r="2.5" />
    <circle {...P} cx="6.5" cy="12" r="2.5" />
    <circle {...P} cx="17.5" cy="18.5" r="2.5" />
    <path {...P} d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9" />
  </Svg>
);

/* ---------- Tööheaolu tööriistad (lib/wellbeingTools.js, 11 tk) ----------
   WellbeingIcon (süda pulsijoonega) jääb tööheaolu KOGU teema märgiks
   (töölaua kaart, teavitused). Alltoodud glüüfid on tööriistade omad:
   varem kandsid kõik üksteist sama südant, mistõttu tööheaolu laud oli
   rida eristamatuid kaarte ja selle otseteeriba rida ühesuguseid täppe. */

/* Minu kirjed — kell tagasikeerava noolega (varasem kirje) */
export const WellbeingRecordsIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M4.3 9A8.5 8.5 0 1 1 3.5 12.8" />
    <path {...P} d="M3.8 4.5v4.8h4.8" />
    <path {...P} d="M12 7.5V12l3 2" />
  </Svg>
);

/* Kiirkontroll — lühike nimekiri linnukesega */
export const WellbeingCheckIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="6.5" y="5" width="11" height="16" rx="2.5" />
    <path {...P} d="M10 3h4" />
    <path {...P} d="m9.5 13 2 2 3.5-3.5" />
  </Svg>
);

/* Ülevaade — trendijoon telgedel (nädala ja kuu muster) */
export const WellbeingOverviewIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M4 4v16h16" />
    <path {...P} d="m7.5 15 3.5-4 3 2.5 5-6" />
    <path {...P} d="M16 7.5h3v3" />
  </Svg>
);

/* Raske juhtum — kõnemull hüüumärgiga (koormav vestlus) */
export const WellbeingHardCaseIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M5.5 4.5h13a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-8L6 21v-3.5h-.5A2.5 2.5 0 0 1 3 15V7a2.5 2.5 0 0 1 2.5-2.5Z" />
    <path {...P} d="M12 8v3.8M12 14.5h.01" />
  </Svg>
);

/* Töövägivald — stoppmärk hüüumärgiga (oht, peatu) */
export const WellbeingViolenceIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z" />
    <path {...P} d="M12 8v4.3M12 15.5h.01" />
  </Svg>
);

/* Taastumine — päike tõusmas horisondi kohale (jõuvarude taastumine) */
export const WellbeingRecoveryIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M3.5 18.5h17" />
    <path {...P} d="M7.5 18.5a4.5 4.5 0 0 1 9 0" />
    <path {...P} d="M12 4.5V7M5.6 8.6l1.75 1.75M18.4 8.6l-1.75 1.75" />
  </Svg>
);

/* Tööpiirid — kalender kellaga (tööaeg ja kättesaadavus) */
export const WellbeingBoundariesIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="4" y="5.5" width="16" height="15" rx="2.5" />
    <path {...P} d="M4 10h16" />
    <path {...P} d="M8.5 3.5v4M15.5 3.5v4" />
    <path {...P} d="M12 13v2.6l1.9 1.2" />
  </Svg>
);

/* Katkestused — vaigistatud kell (töörahu katkeb) */
export const WellbeingInterruptionsIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M6 16.5c1-1.1 1.5-2.6 1.5-4.4v-1.6a4.5 4.5 0 0 1 9 0v1.6c0 1.8.5 3.3 1.5 4.4Z" />
    <path {...P} d="M10.3 19.5a2 2 0 0 0 3.4 0" />
    <path {...P} d="m4 4 16 16" />
  </Svg>
);

/* Tööprotsessid — kaks sammu ühte koondumas (mis võtab aja ära) */
export const WellbeingProcessIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="3.5" y="3.5" width="6.5" height="5" rx="1.5" />
    <rect {...P} x="14" y="3.5" width="6.5" height="5" rx="1.5" />
    <rect {...P} x="8.75" y="15.5" width="6.5" height="5" rx="1.5" />
    <path {...P} d="M6.75 8.5v2.75h10.5V8.5M12 11.25v4.25" />
  </Svg>
);

/* Rollipiirid — märk linnukesega (selge roll ja vastutus) */
export const WellbeingRoleIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 3.4 14.72 5.44 18.08 5.92 18.56 9.28 20.6 12 18.56 14.72 18.08 18.08 14.72 18.56 12 20.6 9.28 18.56 5.92 18.08 5.44 14.72 3.4 12 5.44 9.28 5.92 5.92 9.28 5.44Z" />
    <path {...P} d="m9 12 2 2 4-4" />
  </Svg>
);

/* Alustaja tugi — avatud raamat linnukesega (esimesed 100 päeva) */
export const WellbeingStarterIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 6.5C10.3 5.2 8 4.5 5.5 4.5h-2v13h2c2.5 0 4.8.7 6.5 2 1.7-1.3 4-2 6.5-2h2v-13h-2c-2.5 0-4.8.7-6.5 2Z" />
    <path {...P} d="M12 6.5v13" />
    <path {...P} d="m14.8 12.2 1.5 1.5 2.7-2.7" />
  </Svg>
);
