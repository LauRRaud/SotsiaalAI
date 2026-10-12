/**
 * Kliendi käigumustri reeglid ilma joonistamiseta: vormi algseis ja päringu sisu,
 * töötaja valik, mis seisab käigu real ja mis takistab edasi minekut.
 *
 * Kliendi käigumuster hooldusjuhile: korduvad käigud nädalas. Uus käik lisatakse
 * korraga mitmele nädalapäevale. Muudatus kehtib tänasest: juba alanud käik
 * lõpetatakse eilse päevaga ja selle asemele tekib uus rida, nii et möödunud
 * päevade plaan jääb nii, nagu see oli. Olek ja päringud on konksus
 * ./useSlotEditor.js, vaated on ühised (../client/PartViews.jsx), kokku paneb
 * need ./SlotEditor.jsx.
 */

import { CARE_VISIT_PRIORITIES, CareVisitPriority } from "@/lib/homeCare/constants";

import { WEEKDAYS, slotLine } from "../slots/slotRows";

/** Mitu käiku on loendis vaates enne nuppu „Näita veel". */
export const SLOTS_PAGE = 4;

/* Plaanitud kestuse kiirvalikud minutites. */
export const MINUTE_CHOICES = Object.freeze([15, 30, 45, 60, 90]);

export const EMPTY_FORM = Object.freeze({
  weekdays: [],
  startTime: "09:00",
  plannedMinutes: "45",
  priority: CareVisitPriority.B,
  workerMembershipId: "",
  note: ""
});

/** Olemasoleva käigu vorm: üks nädalapäev, selle ajad ja töötaja. */
export function formFromSlot(slot) {
  return {
    weekdays: [slot.weekday],
    startTime: slot.startTime,
    plannedMinutes: String(slot.plannedMinutes),
    priority: slot.priority || CareVisitPriority.B,
    workerMembershipId: slot.worker?.membershipId || "",
    note: slot.note || ""
  };
}

/** Päringu väljad, mis on uuel ja muudetaval käigul ühised. */
export function slotFields(form) {
  return {
    startTime: form.startTime,
    plannedMinutes: form.plannedMinutes,
    priority: form.priority,
    workerMembershipId: form.workerMembershipId || null,
    note: form.note
  };
}

/** Nädalapäevad valikuna: lahtris lühike nimi, ekraanilugejale pikk. */
export function weekdayChoices(t) {
  return WEEKDAYS.map((weekday) => ({ value: weekday, label: t(`home_care.slots.weekdays.${weekday}`), aria: t(`home_care.slots.weekdays_long.${weekday}`) }));
}

/** Nädalapäeva lülitamine: valitud läheb ära, valimata lisatakse. */
export function toggleWeekday(weekdays, weekday) {
  return weekdays.includes(weekday) ? weekdays.filter((value) => value !== weekday) : [...weekdays, weekday];
}

/** Kestuse kiirvalikud: `[{ value, label }]`; väärtus on sõne, nagu väli. */
export function minuteChoices(t) {
  return MINUTE_CHOICES.map((value) => ({ value: String(value), label: t("home_care.visit.minutes", { minutes: value }) }));
}

/** Tähtsuse valik: `[{ value, label }]`. */
export function priorityChoices(t) {
  return CARE_VISIT_PRIORITIES.map((value) => ({ value, label: t(`home_care.priority.${value}`) }));
}

/**
 * Töötaja valik kliendi meeskonnast; valiku juures on näha, mitu käigu kirjet ta
 * selle kliendi juures viimase 28 päeva jooksul kirjutas. Muudetava käigu töötaja
 * võib olla meeskonnast lahkunud: valik peab teda siiski näitama.
 */
export function workerOptions(team, slots, form, { t }) {
  const options = [
    { value: "", label: t("home_care.slots.worker_none") },
    ...team.map((member) => ({
      value: member.membershipId,
      label: member.heavyRecent
        ? t("home_care.work_nature.worker_option", { name: member.name || "—", count: member.recentVisits, heavy: member.heavyRecent })
        : t("home_care.slots.worker_option", { name: member.name || "—", count: member.recentVisits })
    }))
  ];
  if (form.workerMembershipId && !options.some((option) => option.value === form.workerMembershipId)) {
    const current = slots.find((slot) => slot.worker?.membershipId === form.workerMembershipId);
    options.push({ value: form.workerMembershipId, label: current?.worker?.name || "—" });
  }
  return options;
}

/** Mida inimene käikudega teha tohib: lisab, muudab ja lõpetab hooldusjuht. */
export function slotRights({ canEdit }) {
  return { edit: Boolean(canEdit) };
}

/** Uue käigu esimene vaade on valmis, kui on valitud vähemalt üks nädalapäev (muudetaval käigul on päev ees). */
export function weekdaysReady(editing, form) {
  return editing?.mode === "edit" || form.weekdays.length > 0;
}

/** Käigud nädalapäevade järjekorras ridadena: `[{ key, title, chip, line }]`; töötaja, kes ei ole enam meeskonnas, on märgitud. */
export function slotRows(slots, today, { t }) {
  return WEEKDAYS.flatMap((weekday) =>
    slots
      .filter((slot) => slot.weekday === weekday)
      .map((slot) => ({
        key: slot.id,
        title: t(`home_care.slots.weekdays_long.${weekday}`),
        chip: slot.worker && !slot.worker.active ? { text: t("home_care.slots.worker_inactive"), tone: "wait" } : null,
        line: slotLine(t, slot, today)
      }))
  );
}
