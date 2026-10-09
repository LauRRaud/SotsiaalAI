/**
 * Administraatori vaaterolli vahetus: teade ja lehe oma lüliti arvestus.
 *
 * TEADE. Vaateroll elab küpsises; iga pind, mis hoiab rolli oma olekus
 * (`useEffectiveRole`, töölaua paneel), peab vahetusest teada saama ka siis,
 * kui lüliti ei ole tema enda oma. Lüliti ütleb vahetuse välja ühe akna-
 * sündmusega ja pinnad kuulavad seda, mitte ei oota tagasikutset.
 *
 * ARVESTUS. Dokiga lehtedel joonistab ruum (RoomStage) lüliti ise, et see
 * oleks igal lehel samas nurgas. Leht, millel on oma lüliti (seotud lehe enda
 * rolliolekuga), annab sellest siin märku ja ruumi varuvalik jääb siis ära:
 * kaks lülitit ühes nurgas kataksid teineteist.
 */
const EVENT = "sotsiaalai:view-role-changed";

export function announceViewRole(user) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: user || {} }));
}

export function onViewRoleChanged(handler) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

let pageSwitches = 0;
const watchers = new Set();

function tell() {
  watchers.forEach((watcher) => watcher());
}

/* Tagastab vabastaja: kutsu lehe lüliti lahkumisel. */
export function claimPageSwitch() {
  pageSwitches += 1;
  tell();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pageSwitches -= 1;
    tell();
  };
}

export function watchPageSwitch(watcher) {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

export function hasPageSwitch() {
  return pageSwitches > 0;
}
