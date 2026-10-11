/**
 * KODUTEENUS K1-f — klientide nimekiri tabelist: lugemine ja kava.
 *
 * Asutus alustab nimekirjaga, mis tal juba on (tabel teises süsteemis või
 * arvutustabelis). Hooldusjuht kopeerib tabeli ja kleebib selle siia või laeb
 * CSV-faili; iga rida on üks klient.
 *
 * ESIMENE RIDA ON PÄISED. Veerud tuntakse ära nime järgi (eesti, inglise ja
 * vene keeles), mitte järjekorra järgi: tabeleid on erinevaid ja vales veerus
 * telefon aadressi kohal oleks hullem kui tundmatu veeru vahele jätmine.
 * Tundmatud veerud jäetakse kõrvale ja öeldakse, millised.
 *
 * KAVA ENNE TEGU. `planClientImport` ütleb iga rea kohta, mis sellest saab:
 * uus klient, juba olemas (sama tunnus), sama nimega klient on olemas
 * (võimalik kordus, tuuakse üle ainult hooldusjuhi kinnitusel) või viga.
 * Sama faili teine sissetoomine ei tekita ühtegi kordust.
 *
 * Puhtad funktsioonid: andmebaasi ei loe. Olemasolevad tunnused ja nimed
 * annab teenuskiht (`clientImport.js`).
 */

import { normalizeClientInput } from "./validation.js";

export const CLIENT_IMPORT_MAX_ROWS = 500;
export const CLIENT_IMPORT_MAX_CHARS = 400_000;

export const ClientImportStatus = Object.freeze({
  NEW: "new",
  /** Sama tunnusega klient on asutuses juba olemas. */
  EXISTS: "exists",
  /** Sama tunnus on selles tabelis varasemal real. */
  REPEATED: "repeated",
  /** Tunnust ei ole ja sama nimega klient on juba olemas (või tabelis varem): võimalik kordus. */
  SAME_NAME: "same_name",
  ERROR: "error"
});

/** Veerupäised, mille järgi väli ära tuntakse (väiketähtedes, tühikud korrastatud). */
const COLUMN_NAMES = Object.freeze({
  displayName: ["nimi", "klient", "kliendi nimi", "ees- ja perekonnanimi", "name", "client", "client name", "имя", "клиент", "фио"],
  internalCode: ["tunnus", "kood", "sisekood", "kliendi tunnus", "fleeti nimi", "fleet", "code", "id", "ref", "код"],
  address: ["aadress", "elukoht", "address", "адрес"],
  contactPhone: ["telefon", "tel", "telefoninumber", "phone", "телефон"],
  contactNote: ["märkus", "märkused", "kontakt", "kontaktisik", "lähedane", "note", "notes", "contact", "примечание", "контакт"]
});

function headerKey(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("et");
}

function nameKey(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("et");
}

/** Eraldaja päiserea järgi: tabulaator (arvutustabelist kopeeritud), semikoolon või koma, jutumärkidest väljas. */
export function detectDelimiter(line) {
  const counts = { "\t": 0, ";": 0, ",": 0 };
  let quoted = false;
  for (const char of String(line ?? "")) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char] += 1;
  }
  if (counts["\t"] > 0) return "\t";
  if (counts[";"] > 0 && counts[";"] >= counts[","]) return ";";
  if (counts[","] > 0) return ",";
  return "\t";
}

/**
 * Eraldajaga tekst ridadeks ja lahtriteks. Jutumärkides lahter võib sisaldada
 * eraldajat ja reavahetust; kahekordne jutumärk on jutumärk.
 */
export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const source = String(text ?? "").replace(/^﻿/, "");
  const pushRow = () => {
    row.push(cell);
    rows.push({ line: rowLine, cells: row });
    row = [];
    cell = "";
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      pushRow();
      line += 1;
      rowLine = line;
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}

/**
 * Loeb kleebitud tabeli: päised, veergude vastavus ja andmeread.
 * @returns `{ ok: true, columns, ignoredHeaders, rows }` või `{ ok: false, errorKey, values }`.
 */
export function readClientTable(rawText) {
  const text = typeof rawText === "string" ? rawText : "";
  if (!text.trim()) return { ok: false, errorKey: "home_care.errors.import_empty" };
  if (text.length > CLIENT_IMPORT_MAX_CHARS) return { ok: false, errorKey: "home_care.errors.import_too_large" };

  const firstBreak = text.search(/\r|\n/);
  const delimiter = detectDelimiter(firstBreak < 0 ? text : text.slice(0, firstBreak));
  const parsed = parseDelimited(text, delimiter).filter((row) => row.cells.some((cell) => cell.trim() !== ""));
  if (parsed.length === 0) return { ok: false, errorKey: "home_care.errors.import_empty" };

  const [header, ...dataRows] = parsed;
  const columns = {};
  const ignoredHeaders = [];
  header.cells.forEach((cellValue, index) => {
    const key = headerKey(cellValue);
    if (!key) return;
    const field = Object.keys(COLUMN_NAMES).find((name) => COLUMN_NAMES[name].includes(key));
    /* Sama väli kaks korda: esimene veerg kehtib, teine jääb kõrvale. */
    if (field && !(field in columns)) columns[field] = index;
    else ignoredHeaders.push(String(cellValue).trim().slice(0, 60));
  });

  if (!("displayName" in columns)) return { ok: false, errorKey: "home_care.errors.import_name_column_missing" };
  if (dataRows.length === 0) return { ok: false, errorKey: "home_care.errors.import_no_rows" };
  if (dataRows.length > CLIENT_IMPORT_MAX_ROWS) {
    return { ok: false, errorKey: "home_care.errors.import_too_many_rows", values: { limit: CLIENT_IMPORT_MAX_ROWS } };
  }
  return { ok: true, columns, ignoredHeaders: ignoredHeaders.slice(0, 20), rows: dataRows };
}

/**
 * Mis igast reast saab. `existingCodes` on asutuses juba kasutusel tunnused,
 * `existingNames` hooldusjuhile nähtavate klientide nimed (võrdlus väiketähtedes).
 */
export function planClientImport(table, { existingCodes = new Set(), existingNames = new Set() } = {}) {
  const seenCodes = new Set();
  const seenNames = new Set([...existingNames].map(nameKey));
  const rows = table.rows.map((row) => {
    const cell = (field) => (field in table.columns ? String(row.cells[table.columns[field]] ?? "") : "");
    const raw = {
      displayName: cell("displayName"),
      internalCode: cell("internalCode"),
      address: cell("address"),
      contactPhone: cell("contactPhone"),
      contactNote: cell("contactNote")
    };
    let data;
    try {
      data = normalizeClientInput(raw);
    } catch (error) {
      return {
        line: row.line,
        displayName: raw.displayName.replace(/\s+/g, " ").trim().slice(0, 200),
        internalCode: raw.internalCode.replace(/\s+/g, " ").trim().slice(0, 100) || null,
        status: ClientImportStatus.ERROR,
        errorKey: error?.messageKey || "home_care.errors.import_row_invalid",
        data: null
      };
    }
    const code = data.internalCode || null;
    const name = nameKey(data.displayName);
    let status = ClientImportStatus.NEW;
    if (code && existingCodes.has(code)) status = ClientImportStatus.EXISTS;
    else if (code && seenCodes.has(code)) status = ClientImportStatus.REPEATED;
    else if (!code && seenNames.has(name)) status = ClientImportStatus.SAME_NAME;
    if (code) seenCodes.add(code);
    /* Nimi läheb „nähtute" hulka ainult siis, kui rida päriselt kliendi tekitab
       või tekitada võib: juba olemas oleva tunnusega rida uut nime ei lisa. */
    if (status === ClientImportStatus.NEW || status === ClientImportStatus.SAME_NAME) seenNames.add(name);
    return { line: row.line, displayName: data.displayName, internalCode: code, status, errorKey: null, data };
  });

  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    rows,
    summary: {
      total: rows.length,
      new: count(ClientImportStatus.NEW),
      exists: count(ClientImportStatus.EXISTS),
      repeated: count(ClientImportStatus.REPEATED),
      sameName: count(ClientImportStatus.SAME_NAME),
      errors: count(ClientImportStatus.ERROR)
    }
  };
}

/** Read, mis sissetoomisel kliendiks saavad: uued ja kinnitatud samanimelised. */
export function rowsToCreate(plan, confirmedLines = []) {
  const confirmed = new Set((Array.isArray(confirmedLines) ? confirmedLines : []).map((value) => Number(value)));
  return plan.rows.filter(
    (row) =>
      row.status === ClientImportStatus.NEW || (row.status === ClientImportStatus.SAME_NAME && confirmed.has(row.line))
  );
}
