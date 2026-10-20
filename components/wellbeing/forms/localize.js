/**
 * Sammuvormi kirjeldus lehe keelde.
 *
 * Paljud vormid kirjeldavad küsimusi, valikuid ja signaale eestikeelsete
 * sõnedena (`forms/data/*.js`). Siin saab iga selline sõne STRUKTUURSE
 * tõlkevõtme kujul `wellbeing.forms.<töövoog>.<koht>`, näiteks
 * `wellbeing.forms.hard_case.fields.caseType.options.ethical_dilemma`, ja
 * eestikeelne tekst jääb varutekstiks (`[võti, varutekst]`). Olemasolev
 * `[võti, varutekst]` paar jääb puutumata.
 *
 * Võti tuleb kirjelduse struktuurist (sammu, välja, väärtuse, signaali ja
 * valmis teksti võtmest), mitte tekstist: teksti parandus ei muuda võtit ja
 * väärtuse ümbernimetamist leping niikuinii ei luba.
 *
 * Valmis tekstid ise (memod, plaanid) tulevad serverist ja jäävad eesti keelde.
 * Kataloogi võtmed genereeritakse samast funktsioonist (`formTextEntries`).
 */

const slug = (workflowType) => String(workflowType || "").replace(/[^a-z0-9]+/gi, "_");

function keyed(value, key) {
  if (typeof value === "string" && value.trim()) return [key, value];
  return value;
}

function localizeField(field, base) {
  const fieldBase = `${base}.fields.${field.key}`;
  return {
    ...field,
    label: keyed(field.label, `${fieldBase}.label`),
    ...(field.hint !== undefined ? { hint: keyed(field.hint, `${fieldBase}.hint`) } : {}),
    ...(Array.isArray(field.options)
      ? { options: field.options.map((option) => ({ ...option, label: keyed(option.label, `${fieldBase}.options.${option.value}`) })) }
      : {})
  };
}

function localizeNotice(notice, base, index) {
  if (!notice) return notice;
  const noticeBase = `${base}.notices.${notice.fieldKey || index}`;
  return { ...notice, title: keyed(notice.title, `${noticeBase}.title`), text: keyed(notice.text, `${noticeBase}.text`) };
}

/** Kirjeldus, kus iga eestikeelne sõne on `[võti, varutekst]`. */
export function localizeDefinition(definition) {
  if (!definition || definition.__localized) return definition;
  const base = `wellbeing.forms.${slug(definition.workflowType)}`;
  return {
    ...definition,
    __localized: true,
    steps: (definition.steps || []).map((step) => {
      const stepBase = `${base}.steps.${step.key}`;
      return {
        ...step,
        title: keyed(step.title, `${stepBase}.title`),
        ...(step.short !== undefined ? { short: keyed(step.short, `${stepBase}.short`) } : {}),
        ...(step.lead !== undefined ? { lead: keyed(step.lead, `${stepBase}.lead`) } : {}),
        fields: (step.fields || []).map((field) => localizeField(field, base))
      };
    }),
    ...(definition.signals
      ? {
          signals: Object.fromEntries(
            Object.entries(definition.signals).map(([level, copy]) => [
              level,
              { ...copy, title: keyed(copy.title, `${base}.signals.${level}.title`), text: keyed(copy.text, `${base}.signals.${level}.text`) }
            ])
          )
        }
      : {}),
    ...(definition.outputs
      ? { outputs: definition.outputs.map((output, index) => ({ ...output, title: keyed(output.title, `${base}.outputs.${output.key || index}`) })) }
      : {}),
    ...(definition.safetyNotice ? { safetyNotice: localizeNotice(definition.safetyNotice, base, "main") } : {}),
    ...(definition.safetyNotices ? { safetyNotices: definition.safetyNotices.map((notice, index) => localizeNotice(notice, base, index)) } : {}),
    ...(definition.links
      ? {
          links: definition.links.map((link, index) => ({
            ...link,
            title: keyed(link.title, `${base}.links.${index}.title`),
            ...(link.description !== undefined ? { description: keyed(link.description, `${base}.links.${index}.description`) } : {})
          }))
        }
      : {})
  };
}

/**
 * Kataloogi kirjed: `[[võti, eestikeelne tekst]]` kõigi sõnede kohta, mis said
 * siin võtme. Kasutab kataloogi genereerimise skript ja kontroll.
 */
export function formTextEntries(definition) {
  const localized = localizeDefinition(definition);
  const entries = new Map();
  const visit = (value) => {
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && value[0].startsWith("wellbeing.forms.") && typeof value[1] === "string") {
      if (entries.has(value[0]) && entries.get(value[0]) !== value[1]) {
        throw new Error(`sama võti, eri tekst: ${value[0]}`);
      }
      entries.set(value[0], value[1]);
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit({ steps: localized.steps, signals: localized.signals, outputs: localized.outputs, safetyNotice: localized.safetyNotice, safetyNotices: localized.safetyNotices, links: localized.links });
  return [...entries];
}
