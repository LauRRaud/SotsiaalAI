/**
 * Loendiväli tekstina: üks rida on üks kirje.
 * Tühjad read ja ääretühikud jäetakse salvestamisel välja.
 */
export const cleanLines = (value) =>
  (Array.isArray(value) ? value : String(value || "").split("\n")).map((item) => String(item || "").trim()).filter(Boolean);
