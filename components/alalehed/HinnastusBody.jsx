"use client";

/**
 * HinnastusBody — paketid KLAASKAARTIDE KARUSSELLINA (omanik 24.07:
 * „kolm klaaskaarti nagu menüüs, neid kerid; kõike ei ole vaja kohe
 * näidata"). Varem elasid neli paketti × 23 funktsiooni ühes suures
 * tabelis; nüüd on iga pakett oma keritav kaart, mis näitab ainult
 * olulist (nimi, hind, tagline, kolm võtmeeelist, „Vali"). Täisvõrdlus
 * avaneb kaardil „Vaata kõiki võimalusi" all (Google'i muster).
 *
 * Kest = ruumimenüü DNA (täisekraan, nooled servades, alumine
 * otsetee-dokk). Karussell EI ole ringjas — neli paketti on hinna
 * järgi lineaarne rida, seega servas nool kaob (väike ring vajaks
 * warp-loogikat). Klaas + 3D positsioonid: app/styles/pricing.css.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import IconButton from "@/components/glass/IconButton";
import ChevronIcon from "@/components/brand/icons/ChevronIcon";
import { BackArrowIcon } from "@/components/brand/icons/CardIcons";
import { usePanelExit } from "@/components/room/PanelExit";
import { localizePath } from "@/lib/localizePath";
import { REGISTRATION_OPEN } from "@/lib/publicRegistration";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";

const planKeys = ["free", "client", "worker", "provider"];

/* Peidus kaardid pargivad serva taga selle sammu kaugusel — sisenev
   kaart libiseb ühe koha, mitte üle terve rea. */
const POS_LIMIT = 1.35;

const featureRows = [
  { key: "workspace", values: ["simple", "client_view", "worker_view", "provider_view"] },
  { key: "help", values: ["included", "included", "included", "included"] },
  { key: "service_card", values: ["included", "included", "included", "included"] },
  { key: "knowledge_base", values: ["dash", "included", "included", "included"] },
  { key: "assistants_agents", values: ["dash", "included", "included", "included"] },
  { key: "sources", values: ["dash", "included", "included", "included"] },
  { key: "rooms", values: ["listing_only", "included", "included", "included"] },
  { key: "drafting", values: ["dash", "limited", "extended", "extended"] },
  { key: "analysis", values: ["dash", "limited", "extended", "extended"] },
  { key: "research", values: ["dash", "limited", "extended", "extended"] },
  { key: "documents", values: ["dash", "limited", "extended", "extended"] },
  { key: "pre_inquiry", values: ["dash", "included", "dash", "dash"] },
  { key: "intake", values: ["dash", "dash", "by_agreement", "included"] },
  { key: "kovisioon", values: ["dash", "dash", "included", "included"] },
  { key: "supervision", values: ["dash", "dash", "included", "included"] },
  { key: "mentoring", values: ["dash", "dash", "included", "included"] },
  { key: "field_work", values: ["dash", "dash", "included", "included"] },
  { key: "wellbeing", values: ["dash", "dash", "included", "dash"] },
  { key: "reflection", values: ["dash", "dash", "included", "dash"] },
  { key: "personal_search", values: ["included", "included", "included", "included"] },
  { key: "materials_adding", values: ["dash", "dash", "included", "included"] },
  { key: "service_card_listing", values: ["dash", "dash", "dash", "included"] },
  { key: "service_profile", values: ["dash", "dash", "dash", "included"] }
];

function PlanValue({ value, t }) {
  if (value === "included") {
    return (
      <span className="pc-val pc-val--yes" aria-label={t("about.pricing.values.included")}>
        &#10003;
      </span>
    );
  }
  if (value === "dash") {
    return (
      <span className="pc-val pc-val--no" aria-label={t("about.pricing.values.not_included")}>
        &#8211;
      </span>
    );
  }
  return <span className="pc-val">{t(`about.pricing.values.${value}`)}</span>;
}

export default function HinnastusBody() {
  const router = useRouter();
  const { t, locale } = useI18n();
  /* Väljapääsu OMANIK on PanelFrame — tema teab, kas leht avati töölaualt,
     profiilist või ruumist. Väljaspool paneeli (manustatud kasutus) seda
     konteksti ei ole, siis on tagasi lihtsalt ajalugu. */
  const closePanel = usePanelExit();
  const stageRef = useRef(null);
  const cardRefs = useRef([]);

  const [active, setActive] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  /* Laiendus on AKTIIVSE kaardi oma; kaardivahetus sulgeb selle, et
     paigutus ei hüppaks külgmise pika kaardi tõttu. */
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const body = document.body;
    root?.classList.add("framework-page-scroll-lock");
    body?.classList.add("framework-page-scroll-lock");
    return () => {
      root?.classList.remove("framework-page-scroll-lock");
      body?.classList.remove("framework-page-scroll-lock");
    };
  }, []);

  /* Väljapääs = doki tagasi-nool + Esc. Nurga-risti siin EI OLE (omanik
     26.07: „tagasi peab saama kiirmenüüst") — kaks väljapääsu ühel lehel
     on halvem kui üks, ja kiirmenüü on igal pinnal samas kohas. */
  const handleBack = useCallback(() => {
    if (closePanel) {
      closePanel();
      return;
    }
    backWithTransition(router);
  }, [closePanel, router]);

  /* Samm-lukk: üks kaart korraga, animatsioon lõpetatakse enne järgmist
     (transition 460 ms, pricing.css). */
  const stepLockUntil = useRef(0);
  const step = useCallback((dir) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now < stepLockUntil.current) return;
    setActive((cur) => {
      const next = Math.max(0, Math.min(planKeys.length - 1, cur + (dir < 0 ? -1 : 1)));
      if (next === cur) return cur;
      stepLockUntil.current = now + 460;
      setExpanded(false);
      return next;
    });
  }, []);

  const goTo = useCallback((index) => {
    setActive((cur) => {
      const next = Math.max(0, Math.min(planKeys.length - 1, index));
      if (next !== cur) setExpanded(false);
      return next;
    });
  }, []);

  /* Keris ja svaip lava kohal = eelmine/järgmine pakett. Kui aktiivse
     kaardi laiendus on avatud ja seesmine sisu saab veel kerida, kerib
     see enne (sama žest mis ligipääsetavuse jaamalennus). */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const cooldown = { until: 0 };

    const fly = (dir, stamp) => {
      if (stamp < cooldown.until) return;
      step(dir);
      cooldown.until = stamp + 520;
    };

    /* TELGEDE REEGEL (omanik 24.07: „kaartide kerimine on vale loogikaga
       scrollides üles ja alla; nooltega saan vasakule ja paremale").
       Kaardid seisavad kõrvuti, seega:
         püsttelg  (üles-alla)     = KAARDI SISU kerimine (brauseri oma),
         rõhttelg  (vasak-parem)   = PAKETI vahetus.
       Vertikaalne rullik ei liiguta lava enam kunagi — pakett vahetub
       noole, doki, nooleklahvi või rõhtsa žestiga (puuteplaat/svaip). */
    const onWheel = (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      if (Math.abs(event.deltaX) < 12) return;
      event.preventDefault();
      fly(event.deltaX > 0 ? 1 : -1, event.timeStamp);
    };

    let startX = 0;
    let startY = 0;
    const onTouchStart = (event) => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };
    const onTouchEnd = (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = startX - touch.clientX;
      const dy = startY - touch.clientY;
      /* Ainult selgelt rõhtne svaip; püstine jääb sisu kerimiseks. */
      if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx)) return;
      fly(dx > 0 ? 1 : -1, event.timeStamp);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [step]);

  const onStageKeyDown = useCallback(
    (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    },
    [step]
  );

  const goRegister = useCallback(() => {
    if (!REGISTRATION_OPEN) return;
    pushWithTransition(router, localizePath("/registreerimine", locale));
  }, [router, locale]);

  const positionLine = useMemo(
    () =>
      t("about.pricing.card.position")
        .replace("{current}", String(active + 1))
        .replace("{total}", String(planKeys.length)),
    [t, active]
  );

  return (
    <section className="pc" lang={locale} aria-labelledby="hinnastus-title">
      {/* Ainult pealkiri. Sissejuhatav rida läks ära (omanik 26.07):
          kaardid ütlevad sama asja ise ja iga siit võidetud piksel läheb
          lavale. Võti about.pricing.intro jääb tõlkefailidesse kasutuseta
          — teda kannab ainult see koht, aga ühest keelest kustutamine
          lõhuks keelte pariteedi (i18n:check) ja tekst võib veel naasta. */}
      <header className="pc-head">
        <h1 id="hinnastus-title">{t("about.pricing.title")}</h1>
      </header>

      <p className="sr-only" aria-live="polite">
        {`${t(`about.pricing.columns.${planKeys[active]}`)} — ${positionLine}`}
      </p>

      {/* Lava: kaardid seisavad reas, aktiivne keskel; kõrvalkaardid
          pööratud ja väiksemad (3D vanem = .pc-stage). */}
      <div
        className="pc-stage"
        ref={stageRef}
        data-expanded={expanded ? "1" : "0"}
        onKeyDown={onStageKeyDown}
      >
        <IconButton
          layoutClassName="pc-arrow pc-arrow--left"
          onClick={() => step(-1)}
          disabled={active === 0}
          aria-label={t("room.prev_panel")}
        >
          <ChevronIcon direction="left" strokeWidth={1.05} />
        </IconButton>

        <ul className="pc-list">
          {planKeys.map((key, index) => {
            const rawPos = index - active;
            const pos = Math.max(-POS_LIMIT, Math.min(POS_LIMIT, rawPos));
            const abs = Math.abs(rawPos);
            const isCenter = index === active;
            const isOpen = isCenter && expanded;
            const rawHighlights = t(`about.pricing.highlights.${key}`);
            const highlights = Array.isArray(rawHighlights) ? rawHighlights : [];
            return (
              <li
                key={key}
                className="pc-item"
                style={{ "--pos": pos, "--abs": Math.min(abs, POS_LIMIT), zIndex: 40 - abs * 10 }}
                data-center={isCenter ? "1" : "0"}
                data-hidden={abs > 1 ? "1" : "0"}
                aria-hidden={isCenter ? undefined : "true"}
                inert={isCenter ? undefined : true}
              >
                <article
                  className="pc-card"
                  data-open={isOpen ? "1" : "0"}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                >
                  {/* Terve kaardi sisu ühes keritavas alas (omanik 24.07):
                      nimi–hind–eelised–nupp–kõik võimalused kerivad koos,
                      raam (klaas + serv) jääb .pc-card'ile paigale. */}
                  <div className="pc-scroll">
                  <p className="pc-name">{t(`about.pricing.columns.${key}`)}</p>
                  <p className="pc-price">{t(`about.pricing.prices.${key}`)}</p>
                  <p className="pc-tagline">{t(`about.pricing.taglines.${key}`)}</p>

                  <ul className="pc-highlights">
                    {highlights.map((line, i) => (
                      <li key={i}>
                        <span className="pc-hi-mark" aria-hidden="true">&#10003;</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="pc-cta"
                    tabIndex={isCenter ? 0 : -1}
                    aria-disabled={!REGISTRATION_OPEN}
                    onClick={goRegister}
                  >
                    {t(`about.pricing.actions.${key}`)}
                  </Button>

                  <button
                    type="button"
                    className="pc-toggle"
                    tabIndex={isCenter ? 0 : -1}
                    aria-expanded={isOpen ? "true" : "false"}
                    onClick={() => setExpanded((v) => !v)}
                  >
                    <span>{isOpen ? t("about.pricing.card.hide_all") : t("about.pricing.card.show_all")}</span>
                    <ChevronIcon direction={isOpen ? "up" : "down"} strokeWidth={1.1} />
                  </button>

                  {isOpen ? (
                    <div className="pc-all">
                      <dl>
                        {featureRows.map((row) => (
                          <div className="pc-all-row" key={row.key}>
                            <dt>{t(`about.pricing.features.${row.key}`)}</dt>
                            <dd>
                              <PlanValue value={row.values[index]} t={t} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        <IconButton
          layoutClassName="pc-arrow pc-arrow--right"
          onClick={() => step(1)}
          disabled={active === planKeys.length - 1}
          aria-label={t("room.next_panel")}
        >
          <ChevronIcon direction="right" strokeWidth={1.05} />
        </IconButton>
      </div>

      {/* Otsetee-dokk = ruumi kaardimenüü DNA (carousel.css .gc-shortcut-*). */}
      <nav className="pc-dock gc-shortcut-menu" aria-label={t("about.pricing.title")}>
        <button
          type="button"
          className="gc-shortcut gc-shortcut--back"
          data-on="0"
          onClick={handleBack}
          aria-label={t("buttons.back")}
        >
          <span className="gc-shortcut-icon" aria-hidden="true">
            <BackArrowIcon />
          </span>
          <span className="gc-shortcut-tooltip" aria-hidden="true">
            {t("buttons.back")}
          </span>
        </button>
        <span className="gc-shortcut-divider" aria-hidden="true" />
        <div className="gc-shortcut-track">
          {planKeys.map((key, index) => {
            const isActive = index === active;
            const label = t(`about.pricing.columns.${key}`);
            return (
              <button
                key={key}
                type="button"
                className="gc-shortcut"
                data-on={isActive ? "1" : "0"}
                data-state={isActive ? "active" : "open"}
                aria-current={isActive ? "step" : undefined}
                aria-label={label}
                onClick={() => goTo(index)}
              >
                <span className="gc-shortcut-icon" aria-hidden="true">
                  <span className="gc-shortcut-mark" />
                </span>
                <span className="gc-shortcut-text" aria-hidden="true">
                  {label}
                </span>
                <span className="gc-shortcut-tooltip" aria-hidden="true">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}
