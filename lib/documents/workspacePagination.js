export function mergeOwnerPage(current, { items, total, offset = 0, extra = {} }) {
  const incoming = Array.isArray(items) ? items : [];
  if (!offset) return { ...current, ...extra, items: incoming, total: Number(total) || 0, error: "" };

  const known = new Set((current?.items || []).map((item) => item.id));
  return {
    ...current,
    ...extra,
    items: [...(current?.items || []), ...incoming.filter((item) => !known.has(item.id))],
    total: Number(total) || 0,
    error: ""
  };
}

export function familyHasNextPage(family) {
  return Number(family?.total) > (family?.items?.length || 0);
}
