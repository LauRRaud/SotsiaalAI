"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * TeemaseemnedPage — Teemaseemnete leht + uue seemne loomisvaade.
 * Spetsifikatsioon: Kovisioon/teemaseeme-professionaalne-funktsioon.md (v1.1).
 *
 * Teemaseeme on kovisioonist ERALDI funktsioon: siin pole sessioonikroomi
 * (Paus, sessiooniroll). Loodud seemned kanduvad kovisiooni ruumi alla
 * (1. etapi "Tänane juhtum" = valitud seemne üldistatud kaart).
 *
 * Nuppude loogika (tellija lukustatud reeglid): iga nupp loogikaga;
 * disabled nupp ütleb põhjuse; midagi pole jagatud enne omaniku
 * teadlikku tegevust (§5.6); olulisus/kontekst/liik algolekus valimata
 * (§33.5); kiire seemne saab luua ilma ettevalmistuseta (§8.1).
 */

const DEMO_USER = { name: "Jaanika Kask", title: "Lastekaitsetöötaja" };

/* Loomisvaate viis sammu (§8.1). Etapp 0 (sobivuskontroll) ei ole
   stepperi samm — see on värav enne sammu 1. */
const CREATE_STEPS = [
  "Kiire seeme",
  "Professionaalne ettevalmistus",
  "Võrgustik ja senine töö",
  "Fookus ja soovitud muutus",
  "Eelvaade, jagamine ja töövorm"
];

/* Juhtumi kontekst (§9.2 v1.1 — edukogemus EI ole kontekst) */
const CONTEXTS = [
  { key: "adult", label: "Täisealise inimese klienditöö" },
  { key: "child", label: "Lapse või noore klienditöö" },
  { key: "family", label: "Pere või leibkond" },
  { key: "couple", label: "Paari või lähisuhte kontekst" },
  { key: "network", label: "Võrgustiku või koostöö juhtum" },
  { key: "other", label: "Muu professionaalne olukord", sub: "roll, meetod, koostöö, eetiline pinge või juhtimine" }
];

/* Juhtumi liik (§9.3) */
const KINDS = [
  { key: "current", label: "Aktuaalne väljakutse" },
  { key: "success", label: "Edukogemus" },
  { key: "past", label: "Minevikus toimunud keeruline olukord" },
  { key: "future", label: "Tulevikueesmärk" }
];

/* Soovitud tugi (§9.5 kaanon) */
const SUPPORT_OPTIONS = [
  "Olukorra parem mõistmine",
  "Uued vaatenurgad",
  "Oma rolli mõtestamine",
  "Professionaalsete piiride selgitamine",
  "Võrgustikutöö analüüs",
  "Kasutatud meetodi refleksioon",
  "Eetilise dilemma uurimine",
  "Võimalike teede loomine",
  "Järgmise sammu leidmine",
  "Edukogemusest õppimine",
  "Muu"
];

/* Privaatse ettevalmistuse moodulid (§33.3 — valikuline, ainult omanikule) */
const PRIVATE_MODULES = [
  "Täielik juhtumikirjeldus",
  "Eluvaldkonnad ning inimese ja spetsialisti vaated",
  "Võrgustik ja osapooled",
  "Senised tegevused ja kasutatud meetodid",
  "Minu tunded ja tähelepanekud",
  "Võimalik tööfookus",
  "Riskid ja tundlikud andmed"
];

const STATUS_LABELS = {
  mustand: "Mustand",
  ootel: "Ootel",
  valitud: "Tänaseks valitud",
  toos: "Töös",
  jarelvaates: "Järelvaates",
  suletud: "Suletud"
};

/* Näidisseemned (§25 kaardivorming). Katkendlik kooliskäimine on sama
   juhtum, mis jookseb kovisiooni sessioonidemos. */
const DEMO_SEEDS = [
  {
    id: "s1",
    title: "Katkendlik kooliskäimine",
    owner: "Mari Mets",
    mine: false,
    context: "Lapse või noore klienditöö",
    kind: "Aktuaalne väljakutse",
    whyNow: "Puudumised on sagenenud ja koostöö vanemaga on nõrgenenud.",
    support: ["Olukorra parem mõistmine", "Uued vaatenurgad"],
    importance: 9,
    status: "valitud",
    meta: "Seotud tänase kovisiooniga"
  },
  {
    id: "s2",
    title: "Eluaseme säilimine ja vastutuse jagamine",
    owner: "Marko Suur",
    mine: false,
    context: "Täisealise inimese klienditöö",
    kind: "Aktuaalne väljakutse",
    whyNow: "Eluaseme kaotamise risk on suurenenud.",
    support: ["Võrgustikutöö analüüs", "Järgmise sammu leidmine"],
    importance: 9,
    status: "ootel",
    meta: "Ootab 11 päeva"
  },
  {
    id: "s3",
    title: "Toimiva töövõtte kordamise mõistmine",
    owner: "Aveli Kivi",
    mine: false,
    context: "Täisealise inimese klienditöö",
    kind: "Edukogemus",
    whyNow: "Soovin mõista, mis täpselt toimis, et seda teadlikult korrata.",
    support: ["Edukogemusest õppimine"],
    importance: 6,
    status: "ootel",
    meta: "Ootab 4 päeva"
  },
  {
    id: "s4",
    title: "Võrgustiku rollide ebaselgus",
    owner: "Liisa Laan",
    mine: false,
    context: "Võrgustiku või koostöö juhtum",
    kind: "Minevikus toimunud keeruline olukord",
    whyNow: "Kokkulepped jäid ellu viimata ja vastutus koondus ühele inimesele.",
    support: ["Oma rolli mõtestamine", "Võrgustikutöö analüüs"],
    importance: 7,
    status: "jarelvaates",
    meta: "Järelvaade 24.07"
  }
];

const FILTERS = [
  { key: "koik", label: "Kõik" },
  { key: "ootel", label: "Ootel" },
  { key: "valitud", label: "Tänaseks valitud" },
  { key: "jarelvaates", label: "Järelvaates" },
  { key: "minu", label: "Minu seemned" }
];

function nextSeedId(seeds) {
  const highest = seeds.reduce((max, seed) => {
    const match = /^uus-(\d+)$/.exec(String(seed?.id || ""));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `uus-${highest + 1}`;
}

export default function TeemaseemnedPage() {
  const [view, setView] = useState("list"); // list | create | prep
  const [seeds, setSeeds] = useState(DEMO_SEEDS);
  const [filter, setFilter] = useState("koik");
  const [notice, setNotice] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailSeed, setDetailSeed] = useState(null); // grupiliikme vaade üldistusele
  const [shareSeed, setShareSeed] = useState(null); // omaniku jagamiskiht

  /* --- Loomisvaate olek (§33.5: ausad algolekud — kõik valimata) --- */
  const [gate, setGate] = useState(null); // etapp 0 vastus
  const [gateResolved, setGateResolved] = useState(false); // värav läbitud
  const [title, setTitle] = useState("");
  const [contextKey, setContextKey] = useState(null);
  const [kindKey, setKindKey] = useState(null);
  const [whyNow, setWhyNow] = useState("");
  const [support, setSupport] = useState([]);
  const [importance, setImportance] = useState(null);
  const [continuePrep, setContinuePrep] = useState(false);

  const contextLabel = CONTEXTS.find((c) => c.key === contextKey)?.label || null;
  const kindLabel = KINDS.find((k) => k.key === kindKey)?.label || null;

  /* Kohustuslikud väljad (§9) — mitteaktiivne nupp ütleb põhjuse */
  const missing = useMemo(() => {
    const out = [];
    if (!title.trim()) out.push("pealkiri");
    if (!contextKey) out.push("juhtumi kontekst");
    if (!kindKey) out.push("juhtumi liik");
    if (!whyNow.trim()) out.push("miks praegu");
    if (!support.length) out.push("vähemalt üks soovitud toe liik");
    if (importance == null) out.push("olulisus");
    return out;
  }, [title, contextKey, kindKey, whyNow, support, importance]);

  const gateBlocked = gate === "jah-ei-oota";
  const canCreate = gateResolved && !gateBlocked && missing.length === 0;

  function resetCreate() {
    setGate(null);
    setGateResolved(false);
    setTitle("");
    setContextKey(null);
    setKindKey(null);
    setWhyNow("");
    setSupport([]);
    setImportance(null);
    setContinuePrep(false);
  }

  function openCreate() {
    resetCreate();
    setNotice("");
    setView("create");
  }

  function buildSeed(status, id) {
    return {
      id,
      title: title.trim() || "(Pealkirjata mustand)",
      owner: DEMO_USER.name,
      mine: true,
      context: contextLabel || "—",
      kind: kindLabel || "—",
      whyNow: whyNow.trim() || "—",
      support: support.length ? support : ["—"],
      importance,
      status,
      meta: "Loodud täna"
    };
  }

  function saveDraft() {
    setSeeds((prev) => [buildSeed("mustand", nextSeedId(prev)), ...prev]);
    setNotice("Mustand salvestatud. See on nähtav ainult sulle.");
    setView("list");
    setFilter("minu");
  }

  function createSeed() {
    if (!canCreate) return;
    setSeeds((prev) => [buildSeed("mustand", nextSeedId(prev)), ...prev]);
    if (continuePrep) {
      setView("prep");
      setNotice("");
    } else {
      setNotice(
        "Teemaseeme on loodud ja praegu ainult sulle nähtav. Jagamiseks vali kaardil „Lisa kovisioonijärjekorda”."
      );
      setView("list");
      setFilter("minu");
    }
  }

  /* Omaniku teadlik jagamine (§33.3): kinnitus → mustand muutub ootel-olekuks */
  function confirmShare() {
    if (!shareSeed) return;
    setSeeds((prev) => prev.map((s) => (s.id === shareSeed.id ? { ...s, status: "ootel", meta: "Ootab valikut" } : s)));
    setShareSeed(null);
    setNotice("Üldistus on kinnitatud ja seeme on kovisioonijärjekorras. Grupp näeb ainult seemnekaarti.");
  }

  const visibleSeeds = useMemo(() => {
    if (filter === "minu") return seeds.filter((s) => s.mine);
    if (filter === "koik") return seeds;
    return seeds.filter((s) => s.status === filter);
  }, [seeds, filter]);

  const counts = useMemo(() => {
    const c = { koik: seeds.length, minu: seeds.filter((s) => s.mine).length };
    for (const f of ["ootel", "valitud", "jarelvaates"]) c[f] = seeds.filter((s) => s.status === f).length;
    return c;
  }, [seeds]);

  /* ---------- Ühised tükid ---------- */

  const topBar = (
    <header className="ts-top">
      <div className="ts-brand">
        <button type="button" className="ts-exit" title="Tagasi ruumi" onClick={() => window.history.back()}>
          ← Välju
        </button>
        <div>
          <p className="ts-brand-name">Teemaseemned</p>
          <p className="ts-brand-sub">Juhtumi märkamisest kovisioonini</p>
        </div>
      </div>
      <nav className="ts-nav" aria-label="Kovisiooni funktsioonid">
        <Link className="ts-nav-link" href="/kovisioon">
          Kovisiooni ruum
        </Link>
        <span className="ts-nav-link" aria-current="page" data-active="1">
          Teemaseemned
        </span>
        <span className="ts-nav-link" data-disabled="1" title="Parimate praktikate leht on ehitamisel">
          Parimad praktikad · ehitamisel
        </span>
      </nav>
      <div className="ts-tools">
        <button type="button" data-variant aria-expanded={helpOpen} onClick={() => setHelpOpen(true)}>
          Abi
        </button>
        <div className="ts-user">
          <span className="ts-user-name">{DEMO_USER.name}</span>
          <span className="ts-user-title">{DEMO_USER.title}</span>
        </div>
      </div>
    </header>
  );

  /* §3 piiriselgitus — nähtav loomisvaates ja abikihis */
  const boundaryNote = (
    <p className="ts-boundary">
      Teemaseemne kaardistus aitab professionaalset olukorda mõtestada. See ei asenda seadusest tulenevat
      hindamist, ametlikku juhtumiplaani ega riskihindamist.
    </p>
  );

  function seedCard(seed, { actions = true } = {}) {
    return (
      <article key={seed.id} className="ts-card" data-status={seed.status}>
        <header className="ts-card-head">
          <h3 className="ts-card-title">{seed.title}</h3>
          <span className="ts-status" data-status={seed.status}>
            {STATUS_LABELS[seed.status]}
          </span>
        </header>
        <p className="ts-card-meta">
          {seed.context} · {seed.kind}
        </p>
        <dl className="ts-card-rows">
          <div>
            <dt>Miks praegu</dt>
            <dd>{seed.whyNow}</dd>
          </div>
          <div>
            <dt>Soovin</dt>
            <dd>{seed.support.join(" · ")}</dd>
          </div>
          <div>
            <dt>Olulisus</dt>
            <dd>{seed.importance == null ? "Valimata" : `${seed.importance}/10`}</dd>
          </div>
        </dl>
        <footer className="ts-card-foot">
          <span className="ts-card-owner">
            {seed.owner}
            {seed.mine ? " (sina)" : ""}
          </span>
          <span className="ts-card-wait">{seed.meta}</span>
        </footer>
        {actions ? (
          <div className="ts-card-actions">
            {seed.mine && seed.status === "mustand" ? (
              <>
                <button type="button" data-variant className="ts-acc" onClick={() => setShareSeed(seed)}>
                  Lisa kovisioonijärjekorda
                </button>
                <button type="button" data-variant onClick={() => setView("prep")}>
                  Jätka ettevalmistust
                </button>
              </>
            ) : seed.status === "valitud" ? (
              <Link className="ts-link-btn" data-variant href="/kovisioon">
                Ava kovisioonis
              </Link>
            ) : (
              <button type="button" data-variant onClick={() => setDetailSeed(seed)}>
                Vaata üldistust
              </button>
            )}
          </div>
        ) : null}
      </article>
    );
  }

  /* ---------- Vaade: loend (§26) ---------- */

  const listView = (
    <section className="ts-shell" aria-label="Teemaseemnete leht">
      {topBar}
      <div className="ts-list-head">
        <div>
          <h1 className="ts-h1">Teemaseemned</h1>
          <p className="ts-intro">
            Professionaalsed tööseemned: märka teema, valmista privaatselt ette ja vii üldistatud kaart
            kovisiooni. Grupp näeb ainult seda, mida sa ise jagad.
          </p>
        </div>
        <button type="button" data-variant="primary" className="ts-acc" onClick={openCreate}>
          Uus teemaseeme
        </button>
      </div>

      {notice ? (
        <p className="ts-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="ts-filters" role="group" aria-label="Filtrid">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="ts-filter"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ts-filter-count">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {visibleSeeds.length ? (
        <div className="ts-grid">{visibleSeeds.map((s) => seedCard(s))}</div>
      ) : (
        <p className="ts-empty">
          {filter === "minu"
            ? "Sul ei ole veel ühtegi teemaseemet. Alusta nupuga „Uus teemaseeme”."
            : "Selle filtri all ei ole praegu ühtegi seemet."}
        </p>
      )}
    </section>
  );

  /* ---------- Vaade: loomine (etapp 0 + samm 1) ---------- */

  const gateChip =
    gateResolved && !gateBlocked ? (
      <div className="ts-gate-chip">
        <span>
          Sobivuskontroll:{" "}
          {gate === "ei"
            ? "vahetut ohtu ei ole"
            : gate === "teadmata"
              ? "oht ei ole teada — uuenda, kui olukord täpsustub"
              : "risk on hinnatud, refleksioon võib jätkuda"}
        </span>
        <button
          type="button"
          data-variant
          onClick={() => {
            setGate(null);
            setGateResolved(false);
          }}
        >
          Muuda
        </button>
      </div>
    ) : null;

  const gateBlock = !gateResolved ? (
    <section className="ts-gate" aria-label="Sobivuse ja turvalisuse kontroll">
      {gate !== "jah" && gate !== "voimalik" ? (
        <>
          <h2 className="ts-gate-q">Kas olukorras võib olla vahetu oht või kohese sekkumise vajadus?</h2>
          <div className="ts-gate-opts">
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("ei");
                setGateResolved(true);
              }}
            >
              Ei
            </button>
            <button type="button" data-variant onClick={() => setGate("voimalik")}>
              Võimalik, vajab kontrollimist
            </button>
            <button type="button" data-variant onClick={() => setGate("jah")}>
              Jah
            </button>
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("teadmata");
                setGateResolved(true);
              }}
            >
              Ei ole teada
            </button>
          </div>
        </>
      ) : (
        <div className="ts-gate-warn">
          <h2 className="ts-gate-q">Kovisioon ega Teemaseeme ei asenda kiireloomulist sekkumist.</h2>
          <p className="ts-gate-sub">Kinnita, kas vajalikud vahetud toimingud on tehtud.</p>
          <div className="ts-gate-opts">
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("sekkumine-kaivitatud");
                setGateResolved(true);
              }}
            >
              Vajalik sekkumine on käivitatud
            </button>
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("jah-ei-oota");
                setGateResolved(true);
              }}
            >
              Juhtum ei saa oodata
            </button>
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("risk-hinnatud");
                setGateResolved(true);
              }}
            >
              Risk on hinnatud ning professionaalne refleksioon võib jätkuda
            </button>
            <button type="button" data-variant onClick={() => setView("list")}>
              Salvestan mustandi ja väljun
            </button>
          </div>
        </div>
      )}
    </section>
  ) : gateBlocked ? (
    <section className="ts-gate ts-gate-stop" aria-label="Kiireloomulisuse piir">
      <h2 className="ts-gate-q">Tegele kõigepealt kohese sekkumisega.</h2>
      <p className="ts-gate-sub">
        See juhtum ei saa oodata — kovisioon ei ole kiireloomulise sekkumise töövorm. Teemaseemne saad luua
        hiljem, kui vahetu tegevus on käivitatud.
      </p>
      <div className="ts-gate-opts">
        <button
          type="button"
          data-variant
          onClick={() => {
            setGate(null);
            setGateResolved(false);
          }}
        >
          Muuda vastust
        </button>
        <button type="button" data-variant onClick={() => setView("list")}>
          Tagasi Teemaseemnete lehele
        </button>
      </div>
    </section>
  ) : null;

  const previewColumn = (
    <aside className="ts-side">
      <section className="ts-preview" aria-label="Grupile nähtava kaardi eelvaade">
        <header className="ts-side-head">
          <h2 className="ts-side-title">Mida grupp näeb pärast jagamist?</h2>
          <span className="ts-status" data-status="mustand">
            Pole veel jagatud
          </span>
        </header>
        <p className="ts-side-sub">
          Eelvaade on seemnekaart sellisena, nagu see ilmub Teemaseemnete lehel pärast sinu teadlikku
          jagamist. Praegu ei näe seda keegi peale sinu.
        </p>
        {seedCard(
          {
            id: "eelvaade",
            title: title.trim() || "—",
            owner: DEMO_USER.name,
            mine: true,
            context: contextLabel || "—",
            kind: kindLabel || "—",
            whyNow: whyNow.trim() || "—",
            support: support.length ? support : ["—"],
            importance,
            status: "mustand",
            meta: "Eelvaade"
          },
          { actions: false }
        )}
      </section>

      <section className="ts-private" aria-label="Valikuline privaatne ettevalmistus">
        <header className="ts-side-head">
          <h2 className="ts-side-title">
            <svg className="ts-lock" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            Valikuline privaatne ettevalmistus
          </h2>
        </header>
        <p className="ts-side-sub">
          Võid hiljem lisada ainult selle info, mis aitab sul juhtumit professionaalselt ette valmistada.
          Jääb ainult sulle, kuni ise otsustad teisiti.
        </p>
        <ul className="ts-private-list">
          {PRIVATE_MODULES.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
    </aside>
  );

  const createView = (
    <section className="ts-shell ts-create" aria-label="Uue teemaseemne loomine">
      {/* Loomisvaates EI OLE platvorminavi ega sessioonikroomi (§33.2 +
          lõuendireegel: kõik mahub ekraanile) — tagasi-nupp ja Abi on käes */}
      <div className="ts-create-head">
        <div className="ts-create-intro">
          <button type="button" className="ts-back" onClick={() => setView("list")}>
            ← Tagasi Teemaseemnete lehele
          </button>
          <h1 className="ts-h1">Uus teemaseeme</h1>
          <p className="ts-intro">
            Loo lühike ja üldistatud kirjeldus teemast — privaatne täiendamine on hiljem valikuline.
          </p>
        </div>
        <ol className="ts-rail" aria-label="Teemaseemne loomise sammud">
          {CREATE_STEPS.map((s, i) => (
            <li
              key={s}
              className="ts-step"
              data-state={i === 0 ? "active" : "todo"}
              aria-current={i === 0 ? "step" : undefined}
              title={i > 0 ? "Avaneb pärast kiire seemne loomist" : undefined}
            >
              <span className="ts-step-dot">{i + 1}</span>
              <span className="ts-step-label">{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" data-variant aria-expanded={helpOpen} onClick={() => setHelpOpen(true)}>
          Abi
        </button>
      </div>

      {gateChip}
      {gateBlock}

      <div className="ts-create-main">
        <form
          className="ts-form"
          onSubmit={(e) => {
            e.preventDefault();
            createSeed();
          }}
        >
          <fieldset className="ts-fieldset" disabled={!gateResolved || gateBlocked}>
            {!gateResolved ? (
              <p className="ts-fieldset-note">Vasta kõigepealt sobivuse ja turvalisuse kontrollile.</p>
            ) : null}

            <div className="ts-field">
              <label className="ts-label" htmlFor="ts-title">
                1. Pealkiri
              </label>
              <p className="ts-hint">Üldistatud, ilma nime või muu tuvastava detailita.</p>
              <input
                id="ts-title"
                className="ts-input"
                type="text"
                maxLength={80}
                value={title}
                placeholder="Lühike ja üldistatud pealkiri teemast"
                onChange={(e) => setTitle(e.target.value)}
              />
              <span className="ts-count">{title.length} / 80</span>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-ctx-label">
                2. Juhtumi kontekst
              </span>
              <p className="ts-hint">Millises professionaalses olukorras see teema asub?</p>
              <div className="ts-choice-grid" role="group" aria-labelledby="ts-ctx-label">
                {CONTEXTS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="ts-choice"
                    aria-pressed={contextKey === c.key}
                    onClick={() => setContextKey(c.key)}
                  >
                    <span>{c.label}</span>
                    {c.sub ? <span className="ts-choice-sub">{c.sub}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-kind-label">
                3. Juhtumi liik
              </span>
              <p className="ts-hint">Millise töölaadiga on tegemist?</p>
              <div className="ts-choice-grid" role="group" aria-labelledby="ts-kind-label">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    className="ts-choice"
                    aria-pressed={kindKey === k.key}
                    onClick={() => setKindKey(k.key)}
                  >
                    <span>{k.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <label className="ts-label" htmlFor="ts-why">
                4. Miks see on praegu oluline?
              </label>
              <p className="ts-hint">Üks kuni kolm üldistatud lauset.</p>
              <textarea
                id="ts-why"
                className="ts-input ts-textarea"
                maxLength={300}
                rows={3}
                value={whyNow}
                placeholder="Kirjuta 1–3 lauset…"
                onChange={(e) => setWhyNow(e.target.value)}
              />
              <span className="ts-count">{whyNow.length} / 300</span>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-sup-label">
                5. Millist tuge soovid kovisioonigrupilt?
              </span>
              <p className="ts-hint">Vali üks või mitu.</p>
              <div className="ts-chips" role="group" aria-labelledby="ts-sup-label">
                {SUPPORT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="ts-chip"
                    aria-pressed={support.includes(s)}
                    onClick={() =>
                      setSupport((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-imp-label">
                6. Kui oluline see teema sulle praegu on?
              </span>
              <p className="ts-hint">
                1 — mitte oluline · 10 — väga oluline. Praegu:{" "}
                <strong>{importance == null ? "Valimata" : `${importance}/10`}</strong>
              </p>
              <div className="ts-scale" role="group" aria-labelledby="ts-imp-label">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="ts-scale-btn"
                    aria-pressed={importance === n}
                    onClick={() => setImportance(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="ts-actions">
            <label className="ts-toggle">
              <input
                type="checkbox"
                checked={continuePrep}
                disabled={!gateResolved || gateBlocked}
                onChange={(e) => setContinuePrep(e.target.checked)}
              />
              <span>Pärast loomist jätkan privaatse ettevalmistusega</span>
            </label>
            <div className="ts-actions-btns">
              <button
                type="button"
                data-variant
                disabled={!gateResolved || gateBlocked}
                onClick={saveDraft}
              >
                Salvesta mustand
              </button>
              <button type="submit" data-variant="primary" className="ts-acc" disabled={!canCreate}>
                Loo Teemaseeme
              </button>
            </div>
            {gateResolved && !gateBlocked && missing.length ? (
              <p className="ts-reason">Enne loomist täida: {missing.join(", ")}.</p>
            ) : null}
          </div>
        </form>

        {previewColumn}
      </div>

      {boundaryNote}
    </section>
  );

  /* ---------- Vaade: privaatne ettevalmistus (järgmine ehitusjärk) ---------- */

  const prepView = (
    <section className="ts-shell ts-create" aria-label="Privaatne professionaalne ettevalmistus">
      {topBar}
      <div className="ts-create-head">
        <div className="ts-create-intro">
          <button type="button" className="ts-back" onClick={() => setView("list")}>
            ← Tagasi Teemaseemnete lehele
          </button>
          <h1 className="ts-h1">Privaatne professionaalne ettevalmistus</h1>
        </div>
        <ol className="ts-rail" aria-label="Teemaseemne loomise sammud">
          {CREATE_STEPS.map((s, i) => (
            <li key={s} className="ts-step" data-state={i === 0 ? "done" : i === 1 ? "active" : "todo"}>
              <span className="ts-step-dot">{i + 1}</span>
              <span className="ts-step-label">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="ts-intro">
        Kiire seeme on loodud ja nähtav ainult sulle. Ettevalmistuse moodulid (eluvaldkonnad, vaated,
        võrgustik, senine töö, fookus) on järgmises ehitusjärgus — praegu saad seemne jagada
        kovisioonijärjekorda Teemaseemnete lehelt.
      </p>
      <ul className="ts-private-list ts-prep-list">
        {PRIVATE_MODULES.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <div className="ts-actions-btns">
        <button
          type="button"
          data-variant="primary"
          className="ts-acc"
          onClick={() => {
            setNotice("Seeme ootab sind Teemaseemnete lehel filtri „Minu seemned” all.");
            setView("list");
            setFilter("minu");
          }}
        >
          Tagasi Teemaseemnete lehele
        </button>
      </div>
      {boundaryNote}
    </section>
  );

  /* ---------- Kihid ---------- */

  const helpLayer = helpOpen ? (
    <div className="ts-layer" role="dialog" aria-modal="true" aria-label="Abi">
      <div className="ts-layer-card">
        <header className="ts-layer-head">
          <h2 className="ts-side-title">Mis on Teemaseeme?</h2>
          <button type="button" data-variant onClick={() => setHelpOpen(false)}>
            Sulge
          </button>
        </header>
        <p className="ts-side-sub">
          Teemaseeme on privaatne professionaalne tööseeme: märkad teema, lood lühikese üldistatud kaardi
          ja soovi korral valmistad juhtumit privaatselt ette. Kovisiooni liigub ainult sinu teadlikult
          jagatud üldistus — mitte detailne juhtumilugu.
        </p>
        {boundaryNote}
      </div>
    </div>
  ) : null;

  const detailLayer = detailSeed ? (
    <div className="ts-layer" role="dialog" aria-modal="true" aria-label="Seemne üldistus">
      <div className="ts-layer-card">
        <header className="ts-layer-head">
          <h2 className="ts-side-title">Grupile nähtav üldistus</h2>
          <button type="button" data-variant onClick={() => setDetailSeed(null)}>
            Sulge
          </button>
        </header>
        <p className="ts-side-sub">
          Näed ainult omaniku kinnitatud seemnekaarti. Detailne ettevalmistus jääb omanikule.
        </p>
        {seedCard(detailSeed, { actions: false })}
      </div>
    </div>
  ) : null;

  const shareLayer = shareSeed ? (
    <div className="ts-layer" role="dialog" aria-modal="true" aria-label="Jagamise kinnitamine">
      <div className="ts-layer-card">
        <header className="ts-layer-head">
          <h2 className="ts-side-title">Kinnita grupile nähtav üldistus</h2>
          <button type="button" data-variant onClick={() => setShareSeed(null)}>
            Sulge
          </button>
        </header>
        <p className="ts-side-sub">
          Kovisioonijärjekorda lisamisel näeb grupp seda seemnekaarti. Privaatne ettevalmistus jääb
          jagamata. Saad seemne igal ajal järjekorrast tagasi võtta.
        </p>
        {seedCard(shareSeed, { actions: false })}
        <div className="ts-actions-btns">
          <button type="button" data-variant="primary" className="ts-acc" onClick={confirmShare}>
            Kinnitan üldistuse ja lisan ootejärjekorda
          </button>
          <button type="button" data-variant onClick={() => setShareSeed(null)}>
            Jäta praegu ainult endale
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="ts-page">
      {view === "list" ? listView : view === "create" ? createView : prepView}
      {helpLayer}
      {detailLayer}
      {shareLayer}
    </div>
  );
}
