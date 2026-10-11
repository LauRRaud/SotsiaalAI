/**
 * Hooldaja päeva (`Täna`) reeglid ilma joonistamiseta: mis käigud on vaates ees,
 * mis lähevad ühele reale, mis sõnad on käigu real ja millal on takistuse teade
 * lubatud.
 *
 * Vaated on failis ./DayViews.jsx, olek lehel (`../HomeCareHome.jsx`).
 */

/**
 * Mitu käiku on vaates „Täna" järgmise käigu järel ühe reana näha. Mõõdetud pika
 * päevaga (390 × 844 ja 1536 × 640): järgmine käik täies pikkuses, kolm rida,
 * „Kõik tänased käigud", „Minu käes" ja saadetud takistuse teade mahuvad ära.
 * Viis täispikka rida ei mahtunud (909/844 ja 634/522).
 */
export const FOLLOWING = 3;

/**
 * Tänased käigud vaate jaoks. `first` on järgmine käik, mis toimub: selle sõnad
 * (aadress, võtme asukoht, sõit) on täies pikkuses, sest need on vaja ukse taga.
 * `follow` on sellele järgnevad tegemata käigud ühe reana (ära jäetud käik jääb
 * nende hulka märgiga, sest hooldaja peab seda teadma). Tehtud käigud (`done`)
 * ja ülejäänud (`later`) on rea „Kõik tänased käigud" taga.
 */
export function splitToday(visits, following = FOLLOWING) {
  const list = Array.isArray(visits) ? visits : [];
  const done = list.filter((visit) => visit.done);
  const open = list.filter((visit) => !visit.done);
  const first = open.find((visit) => visit.state !== "CANCELLED") || null;
  const rest = open.filter((visit) => visit !== first);
  return { done, first, follow: rest.slice(0, following), later: rest.slice(following) };
}

/** Rea „Kõik tänased käigud" teine rida: mis on selle taga („tehtud 2 · hiljem veel 3"); tühi, kui ei midagi. */
export function allLine(split, { t }) {
  return [
    split.done.length ? t("home_care.today.done_part", { count: split.done.length }) : null,
    split.later.length ? t("home_care.today.later_part", { count: split.later.length }) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Käigu märgid: tehtud, ära jäetud, asendus, aeg muudetud. */
export function visitChips(visit, { t }) {
  return [
    visit.done ? { key: "done", text: t("home_care.slots.done_badge") } : null,
    visit.state === "CANCELLED" ? { key: "cancelled", text: t("home_care.day.states.CANCELLED"), wait: true } : null,
    visit.covering ? { key: "covering", text: t("home_care.day.covering") } : null,
    visit.change?.timeChanged ? { key: "time", text: t("home_care.day.changed_time") } : null
  ].filter(Boolean);
}

/**
 * Käigu rea teine rida: kestus, aadress, märkus, ärajätmise põhjus, muudatuse
 * märkus, kus on võti (kui see ei ole minu käes) ja korraldatud sõit.
 * `minutes`, `keyWhere` ja `ride` on lehe vormindajad (samad mis mujal).
 */
export function visitLine(visit, { t, minutes, keyWhere, ride }) {
  const cancelled = visit.state === "CANCELLED";
  return [
    minutes(visit.plannedMinutes),
    visit.client?.address,
    visit.note,
    cancelled && visit.change?.reason ? t(`home_care.day.cancel_reasons.${visit.change.reason}`) : null,
    visit.change?.note,
    visit.key && !visit.key.held && !cancelled ? keyWhere(visit.key) : null,
    visit.ride ? ride(visit.ride) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Käigu juurde kuuluvad teated: kojutulek ja esmakäik. `day` vormindab kuupäeva. */
export function visitNotes(visit, { t, day }) {
  return [
    visit.homecoming ? t("home_care.homecoming.my_line", { date: day(visit.homecoming.returnedOn) }) : null,
    visit.firstVisit
      ? `${t("home_care.first_visit.my_line")} ${visit.firstVisit.outcome ? t(`home_care.first_visit.my_outcomes.${visit.firstVisit.outcome}`) : t("home_care.first_visit.my_not_marked")}`
      : null
  ].filter(Boolean);
}

/**
 * Kas takistuse teade on vaates: mitte puudumise päeval, ja ainult siis, kui
 * teade on juba olemas või on veel tegemata käike.
 */
export function showObstacle(myDay) {
  if (!myDay || myDay.absent) return false;
  return Boolean(myDay.obstacle || (myDay.visits || []).some((visit) => !visit.done && visit.state !== "CANCELLED"));
}

/** Takistuse nupu sõna: uus teade, teate muutmine või uus teade pärast vaadatud teadet. */
export function obstacleButtonKey(obstacle) {
  if (!obstacle) return "home_care.obstacle.button";
  return obstacle.handled ? "home_care.obstacle.again" : "home_care.obstacle.change";
}
