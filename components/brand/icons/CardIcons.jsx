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

/* Konto seaded — hammasratas (hammastega ring, mitte kiirtega "päike") */
export const AccountGearIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="12" r="2.9" />
    <path
      {...P}
      d="M18.8 14.7a1.6 1.6 0 0 0 .32 1.77l.05.05a1.94 1.94 0 1 1-2.74 2.74l-.05-.05a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.14a1.94 1.94 0 1 1-3.88 0v-.08a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.05.05a1.94 1.94 0 1 1-2.74-2.74l.05-.05a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.14a1.94 1.94 0 1 1 0-3.88h.08A1.6 1.6 0 0 0 4.46 8.8a1.6 1.6 0 0 0-.32-1.77l-.05-.05a1.94 1.94 0 1 1 2.74-2.74l.05.05a1.6 1.6 0 0 0 1.77.32h.07a1.6 1.6 0 0 0 .97-1.47v-.14a1.94 1.94 0 1 1 3.88 0v.08a1.6 1.6 0 0 0 .97 1.46c.6.26 1.28.13 1.77-.31l.05-.05a1.94 1.94 0 1 1 2.74 2.74l-.05.05a1.6 1.6 0 0 0-.32 1.77v.07a1.6 1.6 0 0 0 1.47.97h.14a1.94 1.94 0 1 1 0 3.88h-.08a1.6 1.6 0 0 0-1.46.97Z"
    />
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

/* Ruumid — kaks inimest (tellija etalon; kuju ChatIcons.jsx RoomsIcon-ist) */
export const RoomsCardIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M6.41 13.79h5.4c2.1 0 3.7 1 4.3 2.6.5 1.3.4 2.5.2 3.4-.5 2-2.9 2.6-7.2 2.6s-6.7-.6-7.2-2.6c-.2-.9-.3-2.1.2-3.4.6-1.6 2.2-2.6 4.3-2.6Z" />
    <circle {...P} cx="9.11" cy="5.79" r="4" />
    <path {...P} d="M21.86 18.88V17c0-1.71-1.53-3.21-3.72-3.64" />
    <path {...P} d="M15.4 2.76c1.91.02 3.44 1.64 3.41 3.62s-1.59 3.56-3.5 3.53" />
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
    <path {...P} d="M12 4.2c-4.4 0-7.7 2.9-7.7 6.6 0 2.1 1.1 3.9 2.9 5.1l-.6 3.6 3.6-1.9c.6.1 1.2.2 1.8.2 4.4 0 7.7-2.9 7.7-6.6S16.4 4.2 12 4.2Z" />
    <path {...P} d="M12 13.4s-2.7-1.6-2.7-3.3c0-.9.7-1.6 1.5-1.6.5 0 .95.25 1.2.65.25-.4.7-.65 1.2-.65.8 0 1.5.7 1.5 1.6 0 1.7-2.7 3.3-2.7 3.3Z" />
  </Svg>
);

/* Abipakkumised — käsi hoiab südant (abi pakkumine) */
export const HelpOfferIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 10.6s-3.1-1.9-3.1-3.9c0-1.05.8-1.9 1.75-1.9.55 0 1.05.3 1.35.75.3-.45.8-.75 1.35-.75.95 0 1.75.85 1.75 1.9 0 2-3.1 3.9-3.1 3.9Z" />
    <path {...P} d="M4.4 14.6h2.9c.7 0 2.1.5 3 .9.9.4 2.4.4 3.2 0l3.2-1.5a1.4 1.4 0 0 1 1.9.6c.35.7.05 1.5-.65 1.85l-4.6 2.35c-1 .5-2.6.55-3.6.1l-5.3-2.3" />
    <path {...P} d="M4.4 13v6.5" />
  </Svg>
);

/* Dokumendid — kaks lehte virnas */
export const DocumentsIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M13.8 3.9H8.6a1.7 1.7 0 0 0-1.7 1.7v11a1.7 1.7 0 0 0 1.7 1.7h7a1.7 1.7 0 0 0 1.7-1.7V7.3l-3.5-3.4Z" />
    <path {...P} d="M13.6 4v3.5h3.6" />
    <path {...P} d="M9.6 20.4h6.1a2.6 2.6 0 0 0 2.6-2.6v-7" />
  </Svg>
);

/* Koosta dokument — leht pliiatsiga */
export const ComposeDocIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12.6 4H7.9a1.8 1.8 0 0 0-1.8 1.8v12.4A1.8 1.8 0 0 0 7.9 20h8.2a1.8 1.8 0 0 0 1.8-1.8v-5" />
    <path {...P} d="m14.3 11.2 5.1-5.1a1.35 1.35 0 0 0-1.9-1.9l-5.1 5.1-.5 2.4 2.4-.5Z" />
    <path {...P} d="M9.3 15.9h5.4" />
  </Svg>
);

/* Pöördumised — postkast saabuva noolega */
export const InquiryIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M3.9 13.2h4.3l1.3 2h5l1.3-2h4.3" />
    <path {...P} d="M5.7 6.8h12.6l1.8 6.4v4.9a1.7 1.7 0 0 1-1.7 1.7H5.6a1.7 1.7 0 0 1-1.7-1.7v-4.9l1.8-6.4Z" />
  </Svg>
);

/* Kutsu osaleja — inimene + pluss */
export const InvitePersonIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="10" cy="8" r="3.1" />
    <path {...P} d="M4.6 19.4c.55-3 2.8-4.6 5.4-4.6 1.4 0 2.7.45 3.7 1.3" />
    <path {...P} d="M17.6 13.6v5.2M15 16.2h5.2" />
  </Svg>
);

/* Kovisioon — kolm inimest ringis (grupi ühine töö) */
export const KovisionIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="5.9" r="2" />
    <circle {...P} cx="6.1" cy="15.7" r="2" />
    <circle {...P} cx="17.9" cy="15.7" r="2" />
    <path {...P} d="M9.1 7.9a8.2 8.2 0 0 0-2.5 5.1M14.9 7.9a8.2 8.2 0 0 1 2.5 5.1M9 17.9a8.4 8.4 0 0 0 6 0" />
  </Svg>
);

/* Tööheaolu — süda pulsijoonega */
export const WellbeingIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 19.6s-7.6-4.6-7.6-9.5c0-2.5 1.9-4.4 4.2-4.4 1.4 0 2.7.7 3.4 1.9.7-1.2 2-1.9 3.4-1.9 2.3 0 4.2 1.9 4.2 4.4 0 4.9-7.6 9.5-7.6 9.5Z" />
    <path {...P} d="M7.4 12h2.4l1.2-2.4 1.9 4.2 1.3-1.8h2.4" />
  </Svg>
);

/* Materjalid — kihiline kogu (andmebaas) */
export const MaterialsIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="m12 4.2 8 3.7-8 3.7-8-3.7 8-3.7Z" />
    <path {...P} d="m5 11.6 7 3.2 7-3.2M5 15.5l7 3.2 7-3.2" />
  </Svg>
);

/* Teenusekaart — kaardinõel */
export const ServiceMapIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M12 20.6s6.4-6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 14.6 12 20.6 12 20.6Z" />
    <circle {...P} cx="12" cy="10" r="2.3" />
  </Svg>
);

/* Teekond — punktiirrada peatuspunktidega */
export const JourneyPathIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="5.6" cy="18.2" r="1.9" />
    <circle {...P} cx="18.4" cy="5.8" r="1.9" />
    <path {...P} strokeDasharray="0.1 3.1" d="M7.4 16.6C10.5 14 8 11.5 11 9.6c2.6-1.6 4.4-1.6 5.6-2.5" />
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
    <circle {...P} cx="10.5" cy="10.5" r="5.6" />
    <path {...P} d="m14.7 14.7 5 5" />
  </Svg>
);

/* Supervisioon — järelevalve/peegeldus: silm (ülevaade) */
export const SupervisionIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M3.4 12s3.5-5.2 8.6-5.2S20.6 12 20.6 12 17.1 17.2 12 17.2 3.4 12 3.4 12Z" />
    <circle {...P} cx="12" cy="12" r="2.3" />
  </Svg>
);

/* Mentorlus — mentor + mentee (suurem ja väiksem kuju) */
export const MentorIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="8.6" cy="9" r="2.6" />
    <circle {...P} cx="16.4" cy="10.4" r="2" />
    <path {...P} d="M4.6 19.2c.5-2.9 2-4.4 4-4.4 1.3 0 2.4.7 3.1 1.9" />
    <path {...P} d="M13.7 19.2c.3-2 1.4-3.1 2.7-3.1 1.5 0 2.7 1.5 3 3.9" />
  </Svg>
);

/* Välitöö — kodukülastus (maja avatud uksega) */
export const FieldIcon = (props) => (
  <Svg {...props}>
    <path {...P} d="M4 11.4 12 4.6l8 6.8" />
    <path {...P} d="M5.8 10v9.4h12.4V10" />
    <path {...P} d="M10.2 19.4v-4.9h3.6v4.9" />
  </Svg>
);

/* Refleksioon (Meetodipeegel) — käepeegel */
export const ReflectionIcon = (props) => (
  <Svg {...props}>
    <circle {...P} cx="12" cy="9.4" r="5.5" />
    <path {...P} d="M12 14.9v4.7" />
    <path {...P} d="M9.4 8.1a3.7 3.7 0 0 1 2.6-1.6" />
  </Svg>
);

/* Teenuseprofiil — teenuseosutaja kaart (ID-kaart) */
export const ServiceProfileIcon = (props) => (
  <Svg {...props}>
    <rect {...P} x="4" y="5.2" width="16" height="13.6" rx="2" />
    <circle {...P} cx="9.4" cy="10.6" r="2.1" />
    <path {...P} d="M6.4 16.4c.4-1.7 1.6-2.6 3-2.6s2.6.9 3 2.6" />
    <path {...P} d="M14.6 9.6h3.2M14.6 12.4h3.2M14.6 15.2h2.2" />
  </Svg>
);
