/**
 * TÖÖHEAOLU — STABIILNE LEHEKÜLGITAMINE (SOL-WB-05, SOL-WB-10).
 *
 * MIS OLI. Kaks vaikset kärbet, mõlemad esitatud täieliku tulemusena:
 *   koond luges `take: 10000` **ilma `orderBy`-ta** — seega valim ei sõltunud
 *   ainult sellest, mida küsiti, vaid ka andmebaasi määramata reajärjestusest;
 *   isiklik ülevaade luges 100 uusimat kirjet ja nimetas perioodi „Kõik".
 * Kummalgi vastusel ei olnud välja, mis oleks öelnud „osa andmeid puudub".
 *
 * MIS SIIN ON. Üks lugeja, mida mõlemad kasutavad: **stabiilne kursor
 * `(createdAt, id)` järgi**. `createdAt` üksi ei ole unikaalne ja sama
 * millisekundiga read võiksid lehekülgede piiril korduda või kaduda; `id` teeb
 * järjestuse totaalseks. Kursor on `skip: 1` mustriga, mitte `offset`-iga —
 * offset triivib, kui vahepeal lisandub ridu.
 *
 * KATTEPIIR JÄÄB, AGA TA EI OLE ENAM VAIKNE. Piirini jõudmine annab
 * `truncated: true` ja kutsuja peab selle vastusesse tõstma. Juhtimisraport,
 * mis ei tea, et ta on poolik, on halvem kui raport, mida ei ole.
 */

const DEFAULT_PAGE_SIZE = 1000;

/* Determinism ENNE piiri: ilma selle järjestuseta ei tähenda „esimesed N"
   midagi korratavat. */
export const WELLBEING_STABLE_ORDER = Object.freeze([
  Object.freeze({ createdAt: "asc" }),
  Object.freeze({ id: "asc" })
]);

/**
 * Loeb kõik `where`-le vastavad kirjed lehekülgede kaupa.
 *
 * @returns `{ records, truncated }` — `truncated` on `true` ainult siis, kui
 *          `maxRecords` sai täis JA andmebaasis on veel ridu.
 */
export async function readWellbeingRecordsPaged(prisma, {
  where,
  select,
  maxRecords,
  pageSize = DEFAULT_PAGE_SIZE
}) {
  const limit = Math.max(1, Math.trunc(Number(maxRecords) || 0));
  const size = Math.max(1, Math.min(Math.trunc(Number(pageSize) || DEFAULT_PAGE_SIZE), limit));
  const records = [];
  let cursor = null;

  for (;;) {
    const remaining = limit - records.length;
    if (remaining <= 0) break;
    const page = await prisma.wellbeingRecord.findMany({
      where,
      /* `id` on kursori jaoks kohustuslik ka siis, kui kutsuja teda ei küsinud —
         muidu ei saaks järgmist lehekülge üldse võtta. */
      select: select ? { ...select, id: true, createdAt: true } : undefined,
      orderBy: WELLBEING_STABLE_ORDER,
      take: Math.min(size, remaining),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    records.push(...page);
    if (page.length < Math.min(size, remaining)) return { records, truncated: false };
    cursor = page.at(-1)?.id || null;
    if (!cursor) return { records, truncated: false };
  }

  /* Piir sai täis. Kas ta ka LÕIKAS, on eraldi küsimus: täpselt piiri peale
     jäänud valim on täielik ja teda ei tohi valetada poolikuks. Üks lisapäring
     ühe rea peale annab ausa vastuse. */
  const next = await prisma.wellbeingRecord.findMany({
    where,
    select: { id: true },
    orderBy: WELLBEING_STABLE_ORDER,
    take: 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });

  return { records, truncated: next.length > 0 };
}
