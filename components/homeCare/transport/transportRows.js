/**
 * Kliendi transpordi reeglid ilma joonistamiseta: mis seisab sõidu real, mis
 * on sõidu seis sõnadega, kes mida teha tohib ja mitu rida on vaates korraga.
 *
 * Sõitu ennast platvorm ei telli: kirjas on soov ja hooldusjuhi vastus. Olek ja
 * päringud on konksus ./useClientTransport.js, vaated failis ./TransportViews.jsx,
 * kokku paneb need ./ClientTransport.jsx. Sõidu lauset käigu juures kasutavad ka
 * hooldaja päev ja päevaplaan.
 */

import { planDayLabel } from "../plan/planRows";

/**
 * Mitu sõitu on vaates enne nuppu „Näita veel". Neli rida mahub koos järgmise
 * sõidu lausega nii arvuti paneeli kui ka telefoni ekraanile; pikendatud loend
 * kerib tervet paneeli.
 */
export const TRANSPORT_PAGE = 4;

const REQUESTED = "REQUESTED";
const ARRANGED = "ARRANGED";
const DECLINED = "DECLINED";

/** Sõidu rida ühe lausena käigu juurde: „sõit kell 9.40: perearsti juurde". */
export function rideText(t, ride) {
  return ride.time ? t("home_care.transport.ride_today", { time: ride.time, destination: ride.destination }) : t("home_care.transport.ride_today_no_time", { destination: ride.destination });
}

/** Millal: päev ja, kui on kirjas, mis kellaks peab kohal olema. */
export function rideWhen(t, item) {
  return item.wantedTime ? t("home_care.transport.when_time", { date: planDayLabel(item.wantedOn), time: item.wantedTime }) : planDayLabel(item.wantedOn);
}

/** Sõidu seis ühe lausena: kes soovis, mis kell auto tuleb ja hooldusjuhi märkus, või miks ei saa. */
export function rideStateLine(t, item) {
  if (item.state === REQUESTED) return t("home_care.transport.state_requested", { name: item.requestedByName || "—" });
  if (item.state === DECLINED) return t("home_care.transport.state_declined", { reason: item.answerNote || "" });
  return [item.pickupTime ? t("home_care.transport.state_arranged_time", { time: item.pickupTime }) : t("home_care.transport.state_arranged"), item.answerNote].filter(Boolean).join(" · ");
}

/** Järgmise korraldatud sõidu lause vaate ülaservas (hooldaja paneb kliendi valmis); tühi, kui sõitu ees ei ole. */
export function nextRideLine(transport, { t }) {
  const next = transport?.next;
  return next ? `${t("home_care.transport.next", { date: planDayLabel(next.wantedOn) })} ${rideText(t, next)}` : "";
}

/**
 * Mida inimene sõiduga teha tohib. Vastab hooldusjuht (soov ootab vastust).
 * Tagasi võtab hooldusjuht (ootel soovi ja korraldatud sõidu) või soovi esitaja
 * ise, kuni vastust ei ole.
 */
export function rideRights(item, { canWrite, canRequest, isCoordinator }) {
  return {
    answer: Boolean(canWrite && isCoordinator && item.state === REQUESTED),
    withdraw: Boolean(canWrite && ((isCoordinator && (item.state === REQUESTED || item.state === ARRANGED)) || (item.isMine && canRequest && item.state === REQUESTED)))
  };
}

/** Sõidu seisu märk: `{ text, tone }`. Vastuseta soov on hooldusjuhi teha: temal on märk tugevam. */
export function rideChip(item, { isCoordinator }, { t }) {
  return {
    text: t(`home_care.transport.chips.${item.state}`),
    tone: item.state === ARRANGED ? "ok" : item.state === REQUESTED && isCoordinator ? "wait" : ""
  };
}

/**
 * Sõidud ja soovid loendi ridadena: `[{ key, title, line, chip }]`. Real on
 * millal, kuhu ja seis ühe sõnaga; kogu tekst ja vastus on sõidu enda vaates.
 */
export function transportRows(transport, who, { t }) {
  return (transport?.requests || []).map((item) => ({
    key: item.id,
    title: rideWhen(t, item),
    line: item.destination,
    chip: rideChip(item, who, { t })
  }));
}

/** Üks lehekülg ridu: `{ rows, more }`; `more` ütleb, kas ridu on veel. */
export function transportPage(rows, expanded) {
  return { rows: expanded ? rows : rows.slice(0, TRANSPORT_PAGE), more: !expanded && rows.length > TRANSPORT_PAGE };
}

/** Mis takistab soovi saatmist: päev ja sihtkoht on kohustuslikud. */
export function requestReady(form) {
  return Boolean(form.wantedOn && String(form.destination || "").trim());
}

/** Mis takistab vastuse salvestamist: „ei saa" vajab põhjust. */
export function answerReady(kind, form) {
  return kind !== "decline" || Boolean(String(form.answerNote || "").trim());
}
