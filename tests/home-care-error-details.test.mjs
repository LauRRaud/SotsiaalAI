// KODUTEENUS — veateate kohatäide saab alati väärtuse.
//
// Lause „Kliendil võib olla kuni {limit} lähedast." näitab arvu ainult siis, kui server
// paneb selle vea `details` väljale ja leht annab selle tõlkijale edasi. Leht teeb seda
// ühes kohas (`resolveApiMessage`); see test hoiab, et ükski koduteenuse teenus ei viskaks
// kohatäitega lauset ilma väärtuseta. Hooldaja nägi 11.10.2026 ekraanil toorest „{held}".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const errorsOf = (locale) => JSON.parse(read(`../messages/${locale}.json`)).home_care.errors;
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const serviceDir = new URL('../lib/homeCare/', import.meta.url);
const services = readdirSync(serviceDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, text: readFileSync(new URL(name, serviceDir), 'utf8') }));

/** Vea viskamise kohad: `badRequest("home_care.errors.x", { … })` koos oma teise argumendiga. */
function throwSites(key) {
  const sites = [];
  const pattern = new RegExp(`\\b(?:badRequest|conflict|forbidden|notFound)\\(\\s*"home_care\\.errors\\.${key}"([^;]*)`, 'g');
  for (const { name, text } of services) {
    for (const match of text.matchAll(pattern)) sites.push({ name, rest: match[1] });
  }
  return sites;
}

test('koduteenuse veateate kohatäited on kolmes keeles samad', () => {
  const et = errorsOf('et');
  for (const locale of ['en', 'ru']) {
    const other = errorsOf(locale);
    for (const [key, text] of Object.entries(et)) {
      assert.deepEqual(placeholders(other[key]), placeholders(text), `${locale} ${key}`);
    }
  }
});

test('kohatäitega veateade visatakse alati koos selle väärtusega', () => {
  const withPlaceholders = Object.entries(errorsOf('et')).filter(([, text]) => placeholders(text).length);
  assert.ok(withPlaceholders.length >= 20, 'kohatäitega veateateid peab olema');
  for (const [key, text] of withPlaceholders) {
    const sites = throwSites(key);
    assert.ok(sites.length > 0, `${key}: teenuses ei leitud ühtegi viskamise kohta`);
    for (const site of sites) {
      for (const name of placeholders(text)) {
        assert.match(site.rest, new RegExp(`[{,]\\s*${name}\\s*[:,}]`), `${site.name}: ${key} ilma väärtuseta „${name}"`);
      }
    }
  }
});
