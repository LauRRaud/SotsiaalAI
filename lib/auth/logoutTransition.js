"use client";

import { useSyncExternalStore } from "react";

// Presentation-only state: session revocation still happens on the server.
let leaving = false;
const listeners = new Set();
const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => leaving;
const getServerSnapshot = () => false;

export function beginLogoutTransition() {
  if (leaving) return false;
  leaving = true;
  listeners.forEach(listener => listener());
  return true;
}

export function endLogoutTransition() {
  if (!leaving) return;
  leaving = false;
  listeners.forEach(listener => listener());
}

export function useLogoutTransition() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
