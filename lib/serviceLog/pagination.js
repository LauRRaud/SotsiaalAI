/**
 * Täielik võtmekursoriga lugemine rahaliste ja narratiivsete koondite jaoks.
 * `take: 5000` üksi on vaikne andmekadu; id-kursor annab stabiilse järjekorra
 * ning loeb järgmise lehe seni, kuni andmebaas ise ütleb, et read lõppesid.
 */
export async function findAllById(model, { where, select = null, pageSize = 1000 } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || 1000, 1), 2000);
  const rows = [];
  let cursor = null;
  let previousLastId = null;

  while (true) {
    const page = await model.findMany({
      where,
      ...(select ? { select: { ...select, id: true } } : {}),
      orderBy: { id: "asc" },
      take: size,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    rows.push(...page);
    if (page.length < size) break;

    const lastId = page.at(-1)?.id;
    if (!lastId || lastId === previousLastId) {
      throw new Error("SERVICE_LOG_PAGINATION_STALLED");
    }
    previousLastId = lastId;
    cursor = lastId;
  }

  return rows;
}
