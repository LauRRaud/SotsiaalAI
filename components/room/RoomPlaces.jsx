"use client";

/**
 * Töölaud: tuba on töölaud (omanik 11.10.2026, kavand „Tuba on töölaud").
 *
 * Töölaua tööriistad ei seisa enam ridades laua peal, vaid toas kolmes kohas:
 * tugitooli ja lambi juures, valgustatud seinal ja riiuli juures. Suurelt on
 * ees ainult see, mis täna ootab; ülejäänud on väikesed märgid, nimi tuleb
 * hiire või fookusega. Vajutus kohale (või kerimine selle peal sisse) viib
 * kaamera sinna: kogu tuba suureneb ja nihkub, valgus süttib ja kõik selle
 * koha tööriistad tulevad loetavalt ette.
 *
 * MIDA SEE KOMPONENT EI OTSUSTA. Kaardiloend ja rollid tulevad RoomStage'ist
 * (workspaceItems), tsoonid failist lib/deskZones.js, kohad ja „suur või
 * väike" failist lib/roomPlaces.js, „ootab" arvud olemasolevast päringust
 * (useWorkspaceWaiting). Tööriista avamine käib sama `onSelect` kaudu mis
 * varem laual.
 *
 * KIIRMENÜÜ on sama mis mujal (carousel.css `gc-shortcut-*`, `gc-zone`):
 * tagasi ja kohtade nimed, kõik korraga näha (omanik 09.10: vajutuse taha
 * peidetud valikutest ei saanud aru). Kui oled kohal, viib „tagasi" kõigepealt
 * kogu tuppa.
 *
 * PUUTEEKRAAN. Väikesel märgil ei ole seal nime (hiirt ei ole), seepärast viib
 * puudutus märgile kõigepealt selle kohta, kus tööriistad on nimega.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RoleViewSwitcher from "@/components/workspace/RoleViewSwitcher";
import { isRoomInteractive } from "@/lib/roomInteractive";
import { buildPlaces, cameraFor, gridColumns, nearestPlace, splitTools, stepPlace } from "@/lib/roomPlaces";
import useWorkspaceWaiting from "./useWorkspaceWaiting";
import styles from "./RoomPlaces.module.css";

const NARROW_QUERY = "(max-width: 700px)";
const TOUCH_QUERY = "(hover: none), (pointer: coarse)";
/* Kaamera sõit kestab 950 ms (RoomPlaces.module.css): nii kaua pärast lahkumist
   hoiab toapilt veel oma üleminekut, et ta ei hüppaks tagasi. */
const CAMERA_MS = 1000;
let leaveTimer = 0;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function reducedMotion() {
  if (typeof window === "undefined") return true;
  if (document.documentElement.getAttribute("data-reduce-motion") === "1") return true;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function waitingText(waiting, t) {
  if (!waiting) return "";
  if (waiting.kind === "draft") return t("room.places.waiting_draft", "pooleli");
  return t("room.places.waiting_count", "{count} ootab").replace("{count}", waiting.label);
}

function Tool({ item, waiting, small, text, onOpen }) {
  const Tag = item.href ? "a" : "button";
  const tagProps = item.href ? { href: item.href } : { type: "button" };
  const soon = item.comingSoon
    ? { "data-coming-soon": "1", "aria-disabled": "true", title: item.comingSoonHint || undefined }
    : {};
  const label = text ? `${item.label}, ${text}` : item.label;
  if (small) {
    return (
      <Tag className={styles.mark} aria-label={label} {...tagProps} {...soon} onClick={(event) => onOpen(event, item, true)}>
        <span className={styles.markIcon} aria-hidden="true">
          {item.icon}
        </span>
        <span className={styles.markName} aria-hidden="true">
          {item.label}
        </span>
        {waiting ? <span className={styles.dot} aria-hidden="true" /> : null}
      </Tag>
    );
  }
  return (
    <Tag className={styles.card} aria-label={text ? label : undefined} {...tagProps} {...soon} onClick={(event) => onOpen(event, item, false)}>
      <span className={styles.cardIcon} aria-hidden="true">
        {item.icon}
      </span>
      <span className={styles.cardName}>{item.label}</span>
      {text ? <span className={styles.badge}>{text}</span> : null}
    </Tag>
  );
}

export default function RoomPlaces({ items, zones, backItem = null, role = "", onSelect, onRoleChanged, t }) {
  const navRef = useRef(null);
  const worldRef = useRef(null);
  const [focus, setFocus] = useState("");
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const narrow = useMediaQuery(NARROW_QUERY);
  const touch = useMediaQuery(TOUCH_QUERY);
  /* Arve küsitakse alles siis, kui vaate roll on teada: muidu läheks üks päring tühja. */
  const badges = useWorkspaceWaiting(Boolean(role), role);

  const places = useMemo(() => buildPlaces(zones, items), [zones, items]);
  const placesRef = useRef(places);
  placesRef.current = places;
  const focused = places.find((place) => place.id === focus) || null;

  /* Roll vahetus (halduri lüliti) või koht kadus: tagasi kogu tuppa. */
  useEffect(() => {
    if (focus && !places.some((place) => place.id === focus)) setFocus("");
  }, [focus, places]);

  const zoneName = useCallback((id) => t(`room.zones.${id}.name`, ""), [t]);

  const go = useCallback((id, { toggle = true, keyboard = false } = {}) => {
    const next = toggle && focusRef.current === id ? "" : id;
    setFocus(next);
    if (!next || !keyboard) return;
    /* Klaviatuuriga tulija jätkab kohe selle koha esimeselt tööriistalt. */
    window.requestAnimationFrame(() => {
      navRef.current?.querySelector(`[data-place="${CSS.escape(next)}"] [data-all] a, [data-place="${CSS.escape(next)}"] [data-all] button`)?.focus?.();
    });
  }, []);

  /* ---------- Kaamera: tuba ja tööriistad liiguvad koos ----------
     Muutujad elavad elemendil .room, sest toapilt (.room-view) on teises kihis
     kui see komponent. Lahkudes läheb kaamera tagasi ja märk `data-places`
     jääb sõidu ajaks alles, et pilt ei hüppaks. */
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    const room = navRef.current?.closest(".room");
    if (!room) return undefined;
    window.clearTimeout(leaveTimer);
    const camera = cameraFor(focused, { ...viewport, narrow });
    room.setAttribute("data-places", "1");
    room.style.setProperty("--places-s", String(camera.scale));
    room.style.setProperty("--places-tx", `${camera.tx}px`);
    room.style.setProperty("--places-ty", `${camera.ty}px`);
    return undefined;
  }, [focused, viewport, narrow]);
  useEffect(() => {
    const room = navRef.current?.closest(".room");
    if (!room) return undefined;
    return () => {
      room.style.setProperty("--places-s", "1");
      room.style.setProperty("--places-tx", "0px");
      room.style.setProperty("--places-ty", "0px");
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        room.removeAttribute("data-places");
        room.style.removeProperty("--places-s");
        room.style.removeProperty("--places-tx");
        room.style.removeProperty("--places-ty");
      }, CAMERA_MS);
    };
  }, []);

  /* Kogu toa vaates hõljuvad tööriistad veidi seina ees (ainult hiirega). */
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return undefined;
    const reset = () => {
      world.style.setProperty("--px", "0");
      world.style.setProperty("--py", "0");
    };
    if (focus || touch) {
      reset();
      return undefined;
    }
    const onMove = (event) => {
      if (event.pointerType !== "mouse" || reducedMotion()) return;
      world.style.setProperty("--px", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      world.style.setProperty("--py", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      reset();
    };
  }, [focus, touch]);

  /* Kerimine koha peal sisse viib sinna, välja toob kogu tuppa tagasi.
     Nooled liiguvad kohalt kohale, Esc toob tagasi. Värav on sama mis
     karussellil: aken, paneel või avatud ülariba lukustavad. */
  useEffect(() => {
    const root = navRef.current;
    if (!root) return undefined;
    let wheelAt = 0;
    const onWheel = (event) => {
      if (event.defaultPrevented || Math.abs(event.deltaY) < 8) return;
      if (!isRoomInteractive(root)) return;
      event.preventDefault();
      if (event.timeStamp - wheelAt < 800) return;
      wheelAt = event.timeStamp;
      if (event.deltaY < 0) {
        if (focusRef.current) setFocus("");
        return;
      }
      if (focusRef.current) return;
      const nearest = nearestPlace(placesRef.current, (event.clientX / window.innerWidth) * 100);
      if (nearest) go(nearest.id, { toggle: false });
    };
    const onKey = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const tag = (target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (event.key === "Escape") {
        if (!focusRef.current || !isRoomInteractive(root)) return;
        event.preventDefault();
        event.stopPropagation();
        setFocus("");
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!isRoomInteractive(root)) return;
      const next = stepPlace(placesRef.current, focusRef.current, event.key === "ArrowRight" ? 1 : -1);
      if (!next) return;
      event.preventDefault();
      go(next.id, { toggle: false, keyboard: true });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [go]);

  const open = useCallback(
    (event, item, small) => {
      event.preventDefault();
      /* Puutel ei ole väikesel märgil nime: enne kohale, kus tööriistad on nimega. */
      if (small && touch) {
        const place = placesRef.current.find((entry) => entry.items.some((tool) => tool.key === item.key));
        if (place) {
          go(place.id, { toggle: false });
          return;
        }
      }
      onSelect?.(item);
    },
    [go, onSelect, touch]
  );

  /* Vajutus tuhmile kohale viib sinna; vajutus tühjale toale toob kogu tuppa tagasi. */
  const onWorldClick = (event) => {
    if (!focus) return;
    if (event.target.closest?.("a, button")) return;
    const place = event.target.closest?.("[data-place]");
    if (!place) setFocus("");
    else if (place.getAttribute("data-place") !== focus) go(place.getAttribute("data-place"), { toggle: false });
  };

  const backLabel = focus ? t("room.places.back_room", "Tagasi kogu tuppa") : backItem?.label || "";

  return (
    <nav className={`gc ${styles.root}`} ref={navRef} data-desk="1" data-dock-only="0" data-places="1" aria-label={t("room.menu_label")} id="room-menu">
      <div className={styles.world} ref={worldRef} data-focus={focus || undefined} onClick={onWorldClick}>
        <div className={styles.shade} aria-hidden="true" />
        {places.map((place) => (
          <div
            key={place.id}
            className={styles.light}
            data-on={place.id === focus ? "1" : "0"}
            style={{ "--ax": `${place.ax}%`, "--ay": `${place.ay}%` }}
            aria-hidden="true"
          />
        ))}
        <div className={styles.places}>
          {places.map((place) => {
            const on = place.id === focus;
            const { large, small } = splitTools(place.items, badges, role);
            const waitingByKey = new Map([...large, ...small].map((entry) => [entry.item.key, entry.waiting]));
            const name = zoneName(place.id);
            const what = t(`room.zones.${place.id}.what`, "");
            return (
              <section
                key={place.id}
                className={styles.place}
                data-place={place.id}
                data-on={on ? "1" : "0"}
                style={{ "--ax": `${place.ax}%`, "--ay": `${place.ay}%`, "--cols": gridColumns(place.items.length, narrow) }}
                aria-label={name || undefined}
              >
                <button type="button" className={styles.placeName} aria-expanded={on} onClick={(event) => go(place.id, { keyboard: event.detail === 0 })}>
                  {name}
                </button>
                <div className={styles.near} inert={Boolean(focus)}>
                  {large.length ? (
                    <ul className={styles.waiting}>
                      {large.map(({ item, waiting }) => (
                        <li key={item.key}>
                          <Tool item={item} waiting={waiting} text={waitingText(waiting, t)} onOpen={open} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {small.length ? (
                    <ul className={styles.marks}>
                      {small.map(({ item, waiting }) => (
                        <li key={item.key}>
                          <Tool item={item} waiting={waiting} text={waitingText(waiting, t)} small onOpen={open} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {what ? <p className={styles.what}>{what}</p> : null}
                </div>
                <ul className={styles.all} data-all="1" inert={!on}>
                  {/* Avatud kohas on tööriistad kaardiloendi järjekorras: märk ei tõsta kaarti ümber. */}
                  {place.items.map((item) => (
                    <li key={item.key}>
                      <Tool item={item} waiting={waitingByKey.get(item.key)} text={waitingText(waitingByKey.get(item.key), t)} onOpen={open} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <div className="gc-shortcuts">
        <div className="gc-shortcut-menu" role="group" aria-label={t("room.menu_label")}>
          {backItem ? (
            <button type="button" className="gc-shortcut gc-shortcut--back" data-on="0" aria-label={backLabel} onClick={() => (focus ? setFocus("") : onSelect?.(backItem))}>
              <span className="gc-shortcut-icon" aria-hidden="true">
                {backItem.icon}
              </span>
              <span className="gc-shortcut-tooltip" aria-hidden="true">
                {backLabel}
              </span>
            </button>
          ) : null}
          {backItem ? <span className="gc-shortcut-divider" aria-hidden="true" /> : null}
          <div className="gc-zone-track">
            {places.map((place) => {
              const here = place.id === focus;
              return (
                <button
                  key={place.id}
                  type="button"
                  className="gc-zone"
                  data-on={here ? "1" : "0"}
                  aria-current={here ? "true" : undefined}
                  onClick={(event) => go(place.id, { keyboard: event.detail === 0 })}
                >
                  {zoneName(place.id)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rollilüliti on halduri tööriist ja elab dokist lahus, ekraani nurgas (omanik 25.07). */}
      <RoleViewSwitcher placement="cards" onRoleChanged={onRoleChanged} />
    </nav>
  );
}
