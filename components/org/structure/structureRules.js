/**
 * Struktuuri osa (`/org/<id>/struktuur`) reeglid ilma joonistamiseta: üksuste
 * puu järjekord, loendi rida, uue üksuse vorm ja mis lisamiseks puudu on.
 *
 * Sügavus tuleb serverist (`depth`), mitte siinsest arvutusest; siin pannakse
 * üksused ainult puu järjekorda (laps oma vanema alla). Leht
 * (`../OrgStructureClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./StructureViews.jsx`) joonistavad. Test: `tests/org-admin-views.test.mjs`.
 */

import { MAX_UNIT_DEPTH, ORGANIZATION_UNIT_TYPES } from "@/lib/org/constants";

/** Üksuse nime piir (server lõikab sama koha pealt). */
export const UNIT_NAME_LIMIT = 200;

/** Tühi uue üksuse vorm. Liik on vaikimisi „tiim", nagu vanal vormil. */
export const EMPTY_UNIT = Object.freeze({ name: "", type: "TEAM", parentUnitId: "" });

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Üksused puu järjekorras: iga üksuse järel tema alamüksused. Server annab
 * loendi tasandite kaupa (kõik esimese tasandi üksused, siis teise): nii seisis
 * alamüksus vanal lehel teiste osakondade järel, mitte oma osakonna all.
 * Üksus, mille vanemat loendis ei ole, jääb puu juurele (midagi ei kao).
 */
export function unitTree(units) {
  const list = Array.isArray(units) ? units.filter((unit) => unit?.id) : [];
  const ids = new Set(list.map((unit) => unit.id));
  const children = new Map();
  for (const unit of list) {
    const parent = unit.parentUnitId && ids.has(unit.parentUnitId) ? unit.parentUnitId : "";
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(unit);
  }
  const out = [];
  const seen = new Set();
  const walk = (parent) => {
    for (const unit of children.get(parent) || []) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);
      out.push(unit);
      walk(unit.id);
    }
  };
  walk("");
  /* Ringviide ei tohiks olla võimalik; kui on, jäävad need üksused lõppu. */
  for (const unit of list) if (!seen.has(unit.id)) out.push(unit);
  return out;
}

/** Loendi rida: nimi, liik ja tasand (taande jaoks, 1 kuni 3). */
export function unitRow(unit, { t }) {
  const depth = Math.min(MAX_UNIT_DEPTH, Math.max(1, Number(unit?.depth) || 1));
  return {
    id: String(unit?.id || ""),
    title: text(unit?.name),
    kind: unit?.type ? t(`org.unitType.${unit.type}`) : "",
    depth
  };
}

export function unitTypeOptions(t) {
  return ORGANIZATION_UNIT_TYPES.map((type) => ({ value: type, label: t(`org.unitType.${type}`) }));
}

/**
 * Kuhu uus üksus võib kuuluda: iseseisev või mõne üksuse alla, mis ei ole juba
 * kõige sügavamal tasandil (struktuur toetab kolme tasandit).
 */
export function parentOptions(units, t) {
  return [
    { value: "", label: t("org.structure.noParent") },
    ...unitTree(units)
      .filter((unit) => (Number(unit.depth) || 1) < MAX_UNIT_DEPTH)
      .map((unit) => ({ value: unit.id, label: unit.name }))
  ];
}

/** Kas vormi on midagi kirjutatud või vaikevalikut muudetud. */
export function unitDirty(form) {
  return Object.keys(EMPTY_UNIT).some((key) => text(form?.[key]) !== EMPTY_UNIT[key]);
}

/** Mis lisamiseks puudu on: võti või tühi sõne. Nimi on kohustuslik. */
export function unitProblemKey(form) {
  return text(form?.name) ? "" : "org.errors.unit_name_required";
}

/** Kas see inimene tohib struktuuri muuta: liikmete haldus ja muudetav organisatsioon. */
export function canEditStructure(context) {
  return context?.writable !== false && (context?.capabilities || []).some((grant) => grant?.capability === "MEMBER_ADMIN");
}
