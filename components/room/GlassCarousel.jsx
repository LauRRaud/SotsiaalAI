"use client";

/**
 * GlassCarousel — mattklaasist paneelide karussell (brief §7, pilt 8/11).
 *
 * Ringjas: fookuspaneel keskel, üks külgmine kummalgi pool nähtav,
 * ülejäänud rea peidus. Pööramine: nooleklahvid ja hiirerullik (terve
 * ekraani ulatuses, kui kaardid on avatud), servanupud, lohistus,
 * svaip. Klikk/Enter avab keskmise; klikk külgmisel pöörab keskele.
 * Üks 3D-tasand: perspective vanemal, kaardid otse selle all (iOS).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IconButton from "@/components/glass/IconButton";
import GlassCard from "@/components/glass/GlassCard";
import ChevronIcon from "@/components/brand/icons/ChevronIcon";

const wrapPos = (i, active, n) => {
  let pos = (((i - active) % n) + n) % n;
  if (pos > n / 2) pos -= n;
  return pos;
};

export default function GlassCarousel({
  items,
  initialKey,
  onSelect,
  t,
  setKey = null,
  forceInitial = false,
}) {
  const n = items.length;

  /* Viimase keskkaardi mälu komplekti kohta (sessionStorage), et elaks
     üle karusselli remountide (key={carouselSet}) ja route-vahetuste. */
  const storageId = setKey ? `gc:last:${setKey}` : null;
  const indexOfKey = useCallback(
    (key) => (key ? items.findIndex((it) => it.key === key) : -1),
    [items]
  );

  /* Algne keskkaart on DETERMINISTLIK (initialKey) — sama serveris ja
     kliendis. sessionStorage'i (viimane keskkaart) EI tohi lugeda siin, sest
     see on klient-ainult → SSR tsentreeriks initialKey, klient salvestatud
     kaardi ja tekiks HYDRATION-MISMATCH: React regenereerib karusselli puu,
     kaardid virnaks hetkeks üksteise peale + topeltvarjud (tellija 07.07).
     Salvestatud koht taastatakse allpool ALLES pärast hüdreerimist. */
  const [active, setActive] = useState(() => Math.max(0, indexOfKey(initialKey)));
  const activeRef = useRef(active);
  activeRef.current = active;

  /* Taasta viimane keskkaart (sessionStorage) — AINULT kliendis, pärast
     esimest renderit, nii et hüdreerimine kattub serveriga. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (forceInitial || !storageId || typeof window === "undefined") return;
    try {
      const saved = window.sessionStorage.getItem(storageId);
      const savedIdx = indexOfKey(saved);
      if (savedIdx >= 0 && savedIdx !== activeRef.current) setActive(savedIdx);
    } catch {}
  }, [forceInitial, storageId, indexOfKey]);

  /* Jäta iga vahetus meelde — tagasitulek samasse komplekti taastab koha. */
  useEffect(() => {
    if (!storageId || typeof window === "undefined") return;
    const key = items[active]?.key;
    if (!key) return;
    try {
      window.sessionStorage.setItem(storageId, key);
    } catch {}
  }, [active, items, storageId]);

  /* ---------- Positsioonid: pöördlaud, mitte lineaarne ringitõmme ----------
     Iga kaart liigub sammu kohta täpselt ÜHE koha võrra ja LÜHIMAT teed:
     lahkuv külgkaart taandub oma poolele (nt −1 → −2), mitte üle esiplaani
     vastasserva (+2). Ringi-õmblus (pos hüppab üle poole ringi) tehakse
     HETKEGA, ilma transform-üleminekuta (data-warp), sel hetkel kui kaart
     on nagunii peidus/hajumas — nii ei teki nähtavat ülelendu. Väiksemaid
     komplekte (nt haldus, n=4) parandab; suuremad ei muutu (seal oli õmblus
     juba nähtamatus tsoonis). */
  /* posRef hoiab kaartide praeguseid pidevaid positsioone (arvutus elab
     efekti kehas — puhas seisu-updater, StrictMode-kindel). */
  const posRef = useRef(null);
  if (posRef.current === null) {
    posRef.current = items.map((_, i) => wrapPos(i, active, n));
  }
  const [layout, setLayout] = useState(() => ({
    pos: posRef.current,
    warp: items.map(() => false),
  }));
  const prevActiveRef = useRef(active);

  useEffect(() => {
    const curPos = posRef.current;
    // Komplekt/pikkus vahetus (nt haldus↔töö) — algsea puhtalt.
    if (!curPos || curPos.length !== n) {
      const seeded = items.map((_, i) => wrapPos(i, activeRef.current, n));
      posRef.current = seeded;
      prevActiveRef.current = activeRef.current;
      setLayout({ pos: seeded, warp: items.map(() => false) });
      return;
    }
    const prev = prevActiveRef.current;
    if (prev === active) return;
    prevActiveRef.current = active;
    // Lühim ringisuund prev→active (sammud, −n/2..n/2)
    let d = (((active - prev) % n) + n) % n;
    if (d > n / 2) d -= n;
    const pos = curPos.map((p) => {
      let np = p - d;
      // Aken [-n/2, n/2]: mõlemad tagaosa esitused (±n/2) on lubatud
      // puhkekohad; wrap käivitub alles siis, kui kaart läheb neist
      // KAUGEMALE (siis on ta juba peidus → hüpe tehakse hetkega).
      while (np < -n / 2) np += n;
      while (np > n / 2) np -= n;
      return np;
    });
    const warp = pos.map((np, i) => Math.abs(np - curPos[i]) > 1.0001);
    posRef.current = pos;
    setLayout({ pos, warp });
  }, [active, n, items]);

  const listRef = useRef(null);
  const drag = useRef({ on: false, x0: 0, dx: 0, moved: false, pid: null });
  const itemRefs = useRef([]);

  /* Sammu lukk: iga pööre on ÜKS kaart ja animatsioon lõpetatakse
     enne järgmist sammu — kaarte ei saa läbi vuhistada. Kestus on
     seotud kaardi transitioniga (860 ms, carousel.css). */
  const stepLockUntil = useRef(0);
  const STEP_LOCK_MS = 840;
  const stepAllowed = () => {
    const now = performance.now();
    if (now < stepLockUntil.current) return false;
    stepLockUntil.current = now + STEP_LOCK_MS;
    return true;
  };

  /* Tellija otsus (07.07, täpsustus): iga komplekt AVANEB VIIMASELT
     keskkaardilt — asukoht jäetakse meelde (storageId, üleval), et
     komplektivahetus (work↔admin↔profile) ja tagasitulek ei viskaks
     vaikekaardile. Kaardilehel (forceInitial) tsentreeritakse siiski
     avatud kaart. Kerimine komplekti sees töötab React-seisu kaudu. */

  const step = useCallback(
    (delta, { focus = false } = {}) => {
      if (!stepAllowed()) return;
      const dir = delta < 0 ? -1 : 1; // alati üks kaart korraga
      setActive((cur) => {
        const next = (((cur + dir) % n) + n) % n;
        if (focus) {
          requestAnimationFrame(() => itemRefs.current[next]?.focus?.());
        }
        return next;
      });
    },
    [n]
  );

  /* Klaviatuur karussellil */
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1, { focus: true });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1, { focus: true });
      } else if (e.key === "Home") {
        e.preventDefault();
        if (stepAllowed()) {
          setActive(0);
        }
      } else if (e.key === "End") {
        e.preventDefault();
        if (stepAllowed()) {
          setActive(n - 1);
        }
      }
    },
    [step, n]
  );

  /* Lohistamine ja svaip. NB: pointer capture võetakse ALLES siis,
     kui lohistus päriselt algab — varajane capture suunaks pointerup'i
     UL-ile ja kaartide click-sündmus ei jõuaks kunagi kohale. */
  const onPointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    drag.current = { on: true, x0: e.clientX, dx: 0, moved: false, pid: e.pointerId };
  }, []);
  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d.on) return;
    d.dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(d.dx) > 8) {
      d.moved = true;
      listRef.current?.setPointerCapture?.(d.pid);
    }
    if (d.moved && listRef.current) {
      listRef.current.dataset.dragging = "1";
      listRef.current.style.setProperty("--drag", `${d.dx * 0.55}px`);
    }
  }, []);
  const endDrag = useCallback(
    (_e) => {
      const d = drag.current;
      if (!d.on) return;
      drag.current = { on: false, x0: 0, dx: 0, moved: d.moved, pid: null };
      const list = listRef.current;
      if (list) {
        delete list.dataset.dragging;
        list.style.setProperty("--drag", "0px");
        if (d.moved && d.pid != null) {
          try {
            list.releasePointerCapture?.(d.pid);
          } catch {}
        }
      }
      if (d.moved) {
        // Üks kaart lohistuse kohta — pööre jõuab alati rahulikult lõpuni.
        if (Math.abs(d.dx) > 48) step(d.dx < 0 ? 1 : -1);
        // Klikk pärast lohistust ei tohi avada
        window.setTimeout(() => {
          drag.current.moved = false;
        }, 0);
      }
    },
    [step]
  );

  /* Tellija 06.07: kaartide vaates kerivad kaarte KA klaviatuuri nooled
     ja hiirerullik ilma karusselli fookuseta — terve ekraani ulatuses.
     Aktiivne alles siis, kui käivitus on kaardid avanud (wrap pole inert)
     ja ükski modal/kaardi-leht ei kata; sammu lukk hoiab tempo. */
  const carouselInteractive = useCallback(() => {
    const list = listRef.current;
    if (!list) return false;
    const wrap = list.closest(".room-carousel-wrap");
    if (!wrap || wrap.inert) return false;
    const room = list.closest(".room");
    if (!room) return false;
    if (room.dataset.loginOpen === "1" || room.dataset.cardPage === "1") return false;
    // Ükski lahtiolev modal (ligipääsetavus, kontakt/paigalda) ei tohi
    // lasta rullikul/nooltel tagust karusselli pöörata (tellija 07.07).
    if (room.dataset.a11yOpen === "1" || room.dataset.infoOpen === "1") return false;
    if (document.documentElement.getAttribute("data-room-mode") === "panel") return false;
    // Ülariba (kiirnuppude paneel) lahti/hoveril/fookuses → rullik ja nooled
    // ei tohi tagust karusselli pöörata (tellija 07.07: "kaardid hakkasid
    // liikuma"). :hover/:focus-within töötavad matches()-is.
    const topbar = room.querySelector(".room-topbar");
    if (
      topbar &&
      (topbar.dataset.open === "1" ||
        topbar.matches?.(":hover") ||
        topbar.matches?.(":focus-within"))
    ) {
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) {
        return;
      }
      if (!carouselInteractive()) return;
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    const onWheel = (e) => {
      if (e.defaultPrevented) return;
      if (!carouselInteractive()) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 12) return;
      e.preventDefault();
      step(d > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [carouselInteractive, step]);

  const handleActivate = useCallback(
    (e, item, i) => {
      if (drag.current.moved) {
        e.preventDefault();
        return;
      }
      const pos = wrapPos(i, activeRef.current, n);
      if (pos !== 0 && e.detail > 0) {
        // Hiireklikk külgpaneelil pöörab selle enne keskele (brief §7)
        e.preventDefault();
        if (stepAllowed()) {
          setActive(i);
        }
        return;
      }
      e.preventDefault();
      onSelect?.(item);
    },
    [n, onSelect]
  );

  const showDots = n > 1;
  const posLabel = useMemo(() => {
    const template = t("room.position");
    return template
      .replace("{current}", String(active + 1))
      .replace("{total}", String(n));
  }, [t, active, n]);

  return (
    <nav className="gc" aria-label={t("room.menu_label")} id="room-menu">
      <IconButton
        layoutClassName="gc-arrow gc-arrow--left"
        aria-label={t("room.prev_panel")}
        onClick={() => step(-1)}
      >
        <ChevronIcon direction="left" strokeWidth={1.05} />
      </IconButton>

      <ul
        className="gc-list"
        ref={listRef}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {items.map((item, i) => {
          const pos = layout.pos[i] ?? wrapPos(i, active, n);
          const abs = Math.abs(pos);
          const isCenter = pos === 0;
          const isWarp = layout.warp[i] === true;
          /* Peidus kaardid PARGIVAD kohe serva taga (±1.4 sammu), mitte
             oma kaugel ringipositsioonil — sisenev kaart libiseb servast
             ühe sammu ega lenda üle rea; lahkuv libiseb serva taha ja
             hajub (tellija 06.07: "keritav karussell, mitte lennuk"). */
          const posVis = Math.max(-1.4, Math.min(1.4, pos));
          const absVis = Math.min(abs, 1.4);
          return (
            <li
              key={item.key}
              className="gc-item"
              style={{ "--pos": posVis, "--abs": absVis, zIndex: 40 - abs * 10 }}
              data-center={isCenter ? "1" : "0"}
              data-hidden={abs > 1 ? "1" : "0"}
              data-warp={isWarp ? "1" : "0"}
            >
              <GlassCard
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                href={item.href}
                label={item.label}
                icon={item.icon || null}
                longLabel={item.label.length > 13}
                tabIndex={isCenter ? 0 : -1}
                aria-current={isCenter ? "true" : undefined}
                onClick={(e) => handleActivate(e, item, i)}
              />
            </li>
          );
        })}
      </ul>

      <IconButton
        layoutClassName="gc-arrow gc-arrow--right"
        aria-label={t("room.next_panel")}
        onClick={() => step(1)}
      >
        <ChevronIcon direction="right" strokeWidth={1.05} />
      </IconButton>

      {showDots ? (
        <div className="gc-dots" aria-hidden="true">
          {items.map((item, i) => (
            <span key={item.key} className="gc-dot" data-on={i === active ? "1" : "0"} />
          ))}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {items[active]?.label} — {posLabel}
      </p>
    </nav>
  );
}
