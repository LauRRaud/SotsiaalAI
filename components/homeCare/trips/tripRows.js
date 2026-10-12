/**
 * Sõidupäeviku reeglid ilma joonistamiseta: uue sõidu algseis, kilomeetrid
 * näitude vahest, mis seisab sõidu ja töötaja real ning mida inimene tühistada
 * tohib.
 *
 * Sõidupäevik (K6-a): töötaja paneb iga töösõidu kirja läbisõidumõõdiku alg- ja
 * lõppnäiduga; kilomeetrid tulevad näitude vahest. Kogu asutuse hooldusjuht näeb
 * kuu kokkuvõtet töötaja kaupa ja saab tabelifaili raamatupidamisele. Hüvitist siin
 * ei arvutata. Olek ja päringud on konksus ./useTrips.js, vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Trips.jsx.
 */

import { CARE_TRIP_VEHICLES } from "@/lib/homeCare/constants";

import { planDayLabel } from "../plan/planRows";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const TRIPS_PAGE = 4;

/** Uue sõidu algseis: täna; algnäidu ettepanek on eelmise sõidu lõppnäit (vahe nende vahel oleks erasõit). */
export function newTripForm(data) {
  const last = data.mine.last;
  return {
    day: data.today,
    vehicle: last?.vehicle || "OWN",
    plate: last?.plate || "",
    startOdometer: last ? String(last.endOdometer) : "",
    endOdometer: "",
    purpose: ""
  };
}

/** Kilomeetrid näitude vahest: `{ km, shown }`; `shown` on tõene, kui mõlemad näidud on ja vahe ei ole negatiivne. */
export function kmOf(form) {
  const km = Number(form.endOdometer) - Number(form.startOdometer);
  return { km, shown: form.startOdometer !== "" && form.endOdometer !== "" && Number.isFinite(km) && km >= 0 };
}

/**
 * Näidud ei sobi: salvestamise nupp on sel juhul kinni ja inimene peab aru saama, miks.
 * Öeldakse alles siis, kui lõppnäit on sama pikk kui algnäit, et see trükkimise ajal ei vilguks.
 */
export function oddReadings(form) {
  return !kmOf(form).shown && Boolean(form.startOdometer) && String(form.endOdometer || "").length >= String(form.startOdometer).length;
}

/** Esimene samm (päev ja sõiduk) on valmis, kui päev on valitud. */
export function tripStartReady(form) {
  return Boolean(form.day);
}

/** Sõit on salvestatav: kilomeetrid on teada ja eesmärk on kirjas. */
export function tripReady(form) {
  return kmOf(form).shown && Boolean(String(form.purpose || "").trim());
}

/** Tühistamine vajab põhjust. */
export function retractReady(form) {
  return Boolean(String(form.reason || "").trim());
}

/** Sõidukid valikuna: `[{ value, label }]`. */
export function vehicleChoices(t) {
  return CARE_TRIP_VEHICLES.map((value) => ({ value, label: t(`home_care.trips.vehicles.${value}`) }));
}

/** Sõidu rida: töötaja (kõigi töötajate loendis), näidud, sõiduk ja number ning eesmärk. */
export function tripLine(t, trip, withWorker) {
  return [
    withWorker ? trip.workerName || "—" : null,
    t("home_care.trips.odometer_line", { start: trip.startOdometer, end: trip.endOdometer }),
    t(`home_care.trips.vehicles.${trip.vehicle}`) + (trip.plate ? ` ${trip.plate}` : ""),
    trip.purpose
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Oma sõidu tühistab töötaja oma loendis; kõigi töötajate loendis tühistab hooldusjuht teiste sõite. */
export function canRetract(data, trip, withWorker) {
  return Boolean(data.canAdd) && (withWorker ? Boolean(data.isCoordinator) && !trip.isMine : Boolean(trip.isMine));
}

/** Sõidu pealkiri: päev ja kilomeetrid. */
export function tripTitle(t, trip) {
  return `${planDayLabel(trip.day)} · ${t("home_care.trips.km", { km: trip.km })}`;
}

/** Sõidud loendi ridadena: `[{ key, title, line, open }]`; avatav on rida, mida inimene tühistada tohib. */
export function tripRows(t, data, trips, { withWorker = false } = {}) {
  return trips.map((trip) => ({ key: trip.id, title: tripTitle(t, trip), line: tripLine(t, trip, withWorker), open: canRetract(data, trip, withWorker) }));
}

/** Kuu kokkuvõte töötaja kaupa ridadena: `[{ key, title, line, open }]`; loetav, mitte avatav. */
export function workerRows(t, workers) {
  return workers.map((row) => ({
    key: row.membershipId,
    title: row.name || "—",
    line: t("home_care.trips.worker_line", { trips: row.trips, km: row.km, ownKm: row.ownKm }),
    open: false
  }));
}

/** Kuu esimene vaade: oma sõidud ja (hooldusjuhile) töötajate kokkuvõte ning kõik sõidud. */
export function tripMonthRows(t, data) {
  return [
    { key: "mine", title: t("home_care.trips.mine_title"), line: data.mine.trips.length ? t("home_care.trips.km", { km: data.mine.km }) : t("home_care.trips.mine_empty") },
    data.all ? { key: "workers", title: t("home_care.trips.all_title"), line: data.all.workers.length ? "" : t("home_care.trips.all_empty") } : null,
    data.all?.workers.length ? { key: "all", title: t("home_care.trips.all_trips"), line: t("home_care.parts.count", { count: data.all.trips.length }) } : null
  ].filter(Boolean);
}
