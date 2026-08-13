function actionTitles(value) {
  return String(value || "")
    .split(/\r?\n/u)
    .map((title) => title.trim())
    .filter(Boolean);
}

function actionTitle(item) {
  return String(typeof item === "string" ? item : item?.title || "").trim();
}

function titleKey(value) {
  return String(value || "").toLocaleLowerCase("et");
}

function withTitle(item, title) {
  return item && typeof item === "object" && !Array.isArray(item)
    ? { ...item, title }
    : { title };
}

/**
 * Reconciles the line-based editor with the machine-readable action records.
 * Exact title matches survive inserts, removals and reordering. When the list
 * length is unchanged, an unmatched row is treated as a title edit and keeps
 * the record at the same index. New rows never inherit another action's type.
 */
export function reconcileSuggestedActionTitles(existingValue, editedValue) {
  const existing = Array.isArray(existingValue) ? existingValue : [];
  const titles = actionTitles(editedValue);
  const used = new Set();
  const matched = new Array(titles.length).fill(null);

  for (let titleIndex = 0; titleIndex < titles.length; titleIndex += 1) {
    const key = titleKey(titles[titleIndex]);
    const existingIndex = existing.findIndex((item, index) => (
      !used.has(index) && titleKey(actionTitle(item)) === key
    ));
    if (existingIndex < 0) continue;
    used.add(existingIndex);
    matched[titleIndex] = existingIndex;
  }

  if (titles.length === existing.length) {
    for (let index = 0; index < titles.length; index += 1) {
      if (matched[index] !== null || used.has(index) || !actionTitle(existing[index])) continue;
      used.add(index);
      matched[index] = index;
    }
  }

  return titles.map((title, index) => {
    const existingIndex = matched[index];
    return existingIndex === null
      ? { title }
      : withTitle(existing[existingIndex], title);
  });
}
