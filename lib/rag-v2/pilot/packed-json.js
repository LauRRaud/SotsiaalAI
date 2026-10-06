// A turn's audit packet says many things more than once: an excerpt's text stands in the evidence entry and in the
// model context made from it, and every record of a municipality carries the same provenance and review notes. On
// 06.10.2026 Tallinn's packet was 519 264 bytes (ADR-089, "Auditipaketi piir").
// packJson states each repeated part once: a table holds the repeated subtrees and long strings, and each place they
// stood holds a reference. Nothing is dropped and nothing is rewritten, so unpackJson gives back exactly the value that
// was packed. A reader that needs the packet unpacks it; a value that was never packed passes through unchanged.
export const PACKED_JSON = 'rag-v2/packed-json-1';
const REF = '~';
// A part shorter than this is not worth a reference (a reference is about ten bytes).
const MIN_BYTES = 64;

const isObject = value => value !== null && typeof value === 'object';
const isRef = value => isObject(value) && !Array.isArray(value) && Object.keys(value).length === 1 && Number.isInteger(value[REF]);
export const isPackedJson = value => isObject(value) && !Array.isArray(value) && value.packed === PACKED_JSON && Array.isArray(value.table) && Object.hasOwn(value, 'value');

/** The packed form of a JSON value, or the value itself when packing would not make it smaller or when it holds the
 *  reference key as an object key (then a reference could not be told from data). */
export function packJson(value) {
  const counts = new Map();
  let reserved = false;
  // One pass gives every subtree its JSON text: the text is the subtree's identity, and a parent's text is made of its
  // children's.
  const texts = new Map();
  const text = part => {
    if (!isObject(part)) return JSON.stringify(part) ?? 'null';
    let made;
    if (Array.isArray(part)) made = `[${part.map(text).join(',')}]`;
    else {
      const fields = [];
      for (const [key, child] of Object.entries(part)) {
        if (child === undefined || typeof child === 'function') continue;
        if (key === REF) reserved = true;
        fields.push(`${JSON.stringify(key)}:${text(child)}`);
      }
      made = `{${fields.join(',')}}`;
    }
    texts.set(part, made);
    return made;
  };
  const identify = part => {
    const identity = typeof part === 'string' ? `s${part}` : isObject(part) ? texts.get(part) : null;
    return identity && identity.length >= MIN_BYTES ? identity : null;
  };
  // How often each part would be written: a part met again is counted and not read again, so what stands inside a
  // repeated part counts once for it. Only a part that repeats on its own gets a place in the table.
  const count = part => {
    const identity = identify(part);
    if (identity) { const met = counts.get(identity) || 0; counts.set(identity, met + 1); if (met) return; }
    if (isObject(part)) for (const child of Array.isArray(part) ? part : Object.values(part)) count(child);
  };
  const whole = text(value);
  if (reserved) return value;
  count(value);
  const table = [], places = new Map();
  const inner = part => (Array.isArray(part) ? part.map(pack)
    : isObject(part) ? Object.fromEntries(Object.entries(part).filter(([, child]) => child !== undefined && typeof child !== 'function').map(([key, child]) => [key, pack(child)])) : part);
  const pack = part => {
    const identity = identify(part);
    if (!identity || !(counts.get(identity) > 1)) return inner(part);
    if (!places.has(identity)) { const at = table.length; places.set(identity, at); table.push(null); table[at] = inner(part); }
    return { [REF]: places.get(identity) };
  };
  const packed = { packed: PACKED_JSON, table, value: pack(value) };
  return table.length && JSON.stringify(packed).length < whole.length ? packed : value;
}

/** The value a packed form stands for; any other value as it is. A reference that points outside the table or back
 *  into the part being read cannot come from packJson: such a value is damaged, and reading it fails. */
export function unpackJson(packed) {
  if (!isPackedJson(packed)) return packed;
  const open = new Map(), opening = new Set();
  const broken = code => { throw Object.assign(new Error(code), { code }); };
  const read = part => {
    if (isRef(part)) {
      const at = part[REF];
      if (at < 0 || at >= packed.table.length) broken('packed_json_reference_out_of_range');
      if (!open.has(at)) {
        if (opening.has(at)) broken('packed_json_reference_loop');
        opening.add(at); open.set(at, read(packed.table[at])); opening.delete(at);
      }
      // Each place gets its own copy: what is shared in storage is not shared in memory.
      return structuredClone(open.get(at));
    }
    return Array.isArray(part) ? part.map(read) : isObject(part) ? Object.fromEntries(Object.entries(part).map(([key, child]) => [key, read(child)])) : part;
  };
  return read(packed.value);
}

/** The large parts of a turn's row, each in a column of its own (ADR-094, step 4): the audit packet, the request as
 *  sent and the query vector. A turn's row is written about eighteen times; inside the payload each of those writes
 *  wrote them again. In their own columns each is written once. */
export const TURN_PARTS = Object.freeze(['packet', 'requestAudit', 'vector']);

/** A turn's row as the turn made it: its large parts back in the payload, where every reader looks for them, and its
 *  audit packet unpacked (a packet is stored packed, each repeated part once; ADR-089). Every row that leaves the store,
 *  and every row read beside it, goes through this before its packet is read. A row written before 06.10.2026 holds its
 *  parts inside the payload already; such a row, a row whose packet was stored as it is, and a row without any pass as
 *  they are stored. */
export const openTurn = row => {
  if (!row) return row;
  const parts = Object.fromEntries(TURN_PARTS.filter(key => row[key] !== null && row[key] !== undefined).map(key => [key, row[key]]));
  const packet = parts.packet ?? row.payload?.packet;
  if (!Object.keys(parts).length && !isPackedJson(packet)) return row;
  const { packet: _packet, requestAudit: _request, vector: _vector, ...columns } = row;
  return { ...columns, payload: { ...row.payload, ...parts, ...(packet === undefined ? {} : { packet: unpackJson(packet) }) } };
};
