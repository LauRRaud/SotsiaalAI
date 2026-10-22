"use client";

/* ADR-176: the waiting view an administrator tries out (owner 22.10: "Pane mulle sinna kuhugi 4 numbrit vestluse
   lehele"). 0 is today's turning S; 1-4 are the four designs. The choice lives in this browser only, and only an
   administrator sees anything but 0 (useActiveWaitVariant). The place map is the small brand map ("icon") or the
   accurate outline ("outline"): the owner chooses between them as well ("jätame siis selle suure kaardi ka
   variandiks"). */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const KEY = "sotsiaal.pilotWait";
const EVENT = "sotsiaal:pilot-wait";
export const WAIT_VARIANTS = Object.freeze([0, 1, 2, 3, 4]);
const MAP_KEY = "sotsiaal.pilotWaitMap";
const MAP_EVENT = "sotsiaal:pilot-wait-map";
export const WAIT_MAPS = Object.freeze(["icon", "outline"]);

export function readWaitMap() {
  try {
    const value = window.localStorage.getItem(MAP_KEY);
    return WAIT_MAPS.includes(value) ? value : "icon";
  } catch {
    return "icon";
  }
}

export function chooseWaitMap(value) {
  if (!WAIT_MAPS.includes(value)) return;
  try { window.localStorage.setItem(MAP_KEY, value); } catch { /* private window: this page only */ }
  window.dispatchEvent(new CustomEvent(MAP_EVENT, { detail: value }));
}

export function useWaitMap() {
  const [map, setMap] = useState("icon");
  useEffect(() => {
    const sync = event => setMap(WAIT_MAPS.includes(event?.detail) ? event.detail : readWaitMap());
    setMap(readWaitMap());
    window.addEventListener(MAP_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MAP_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return map;
}

export function readWaitVariant() {
  try {
    const value = Number(window.localStorage.getItem(KEY));
    return WAIT_VARIANTS.includes(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function chooseWaitVariant(value) {
  if (!WAIT_VARIANTS.includes(value)) return;
  try { window.localStorage.setItem(KEY, String(value)); } catch { /* private window: this page only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/* Whether the signed-in user is an administrator, from the session alone (no request per message). */
export function useIsAdmin() {
  const { data: session } = useSession();
  return session?.user?.isAdmin === true || String(session?.user?.role || "").toUpperCase() === "ADMIN";
}

/* The design this browser shows while an answer is prepared: the chosen one for an administrator, else 0. */
export function useActiveWaitVariant() {
  const variant = useWaitVariant();
  return useIsAdmin() ? variant : 0;
}

export function useWaitVariant() {
  const [variant, setVariant] = useState(0);
  useEffect(() => {
    const sync = event => setVariant(WAIT_VARIANTS.includes(event?.detail) ? event.detail : readWaitVariant());
    setVariant(readWaitVariant());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return variant;
}
