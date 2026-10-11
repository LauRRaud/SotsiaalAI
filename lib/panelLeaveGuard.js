/**
 * Paneelist lahkumise värav.
 *
 * Avatud lehelt viivad ära teed, mida leht ise ei joonista: kiirmenüü tagasi-
 * nool (RoomStage), paneeli sulgemine ja Esc (PanelFrame). Leht, millel on
 * salvestamata tekst, ei saa neid vajutusi ise kinni pidada. Siin saab leht
 * öelda „mitte veel": ta registreerib värava ja need kaks kohta küsivad sellelt
 * enne lahkumist luba.
 *
 * Värav on funktsioon `(reason) => boolean`. `false` tähendab, et lahkumist ei
 * toimu JA leht ütleb ise ekraanil, miks (nt „vajuta uuesti, et lahkuda"); kui
 * inimene vajutab uuesti, vastab värav `true`. Korraga on üks värav: avatud on
 * üks leht.
 *
 * Brauseri tagasi-nuppu see ei kata (seda ei saa kinni pidada); akna sulgemise
 * ja uuesti laadimise katab lehe enda `beforeunload`.
 */
let guard = null;

/** Registreerib värava; tagastab vabastaja. */
export function setPanelLeaveGuard(next) {
  guard = typeof next === "function" ? next : null;
  return () => {
    if (guard === next) guard = null;
  };
}

/** Kas paneelist tohib praegu lahkuda? Vigane värav ei lukusta inimest lehele. */
export function panelLeaveAllowed(reason = "") {
  if (!guard) return true;
  try {
    return guard(reason) !== false;
  } catch {
    return true;
  }
}

/**
 * Kahe vajutusega värav: esimene lahkumine peetakse kinni ja `onAsk` näitab
 * lehel, miks; teine lahkumine lubatakse, kui see tuleb pärast topeltvajutuse
 * vahet (`gapMs`) ja enne, kui küsimus aegub (`holdMs`). Aegumisel ja lubamisel
 * kutsutakse `onClear`, et leht küsimuse ära võtaks. Tagastatud funktsioonil on
 * `clear()`: kutsu seda, kui värav maha võetakse.
 */
export function twoPressLeaveGuard({ onAsk, onClear, holdMs = 8000, gapMs = 400, now = Date.now } = {}) {
  let askedAt = 0;
  let timer = null;
  const clear = () => {
    askedAt = 0;
    if (timer) clearTimeout(timer);
    timer = null;
    onClear?.();
  };
  const leave = () => {
    const at = now();
    if (askedAt && at - askedAt < gapMs) return false;
    if (askedAt && at - askedAt <= holdMs) {
      clear();
      return true;
    }
    askedAt = at;
    if (timer) clearTimeout(timer);
    timer = setTimeout(clear, holdMs);
    onAsk?.();
    return false;
  };
  leave.clear = clear;
  return leave;
}
