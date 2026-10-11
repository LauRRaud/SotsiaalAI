// Testi laadur: laeb ühe lehe faili (.jsx) Node'is ilma brauseri ja ehituseta.
//
// MIKS. Lehe fail on JSX ja toob sisse ühised lavaklotsid, kujunduse ja seansi.
// Et lehe ÜHENDUSI (mis väli mis kohta kirjutab, mida vaade joonistab) saaks
// testida käitumisena, mitte lähteteksti järgi, teeb see laadur kolm asja:
//   1. tõlgib .jsx faili TypeScripti kompilaatoriga (projekti arendussõltuvus),
//   2. annab .css mooduli asemel objekti, mille iga klassi nimi on klassi enda nimi,
//   3. asendab testi nimetatud impordid: `real` otse teise failiga, `standIns`
//      testi asendusmooduli nimetatud osaga (vt `subsistence-standins.mjs`).
//
// Kasutus (testifailis, enne lehe importi):
//   register('./helpers/jsx-standin-loader.mjs', import.meta.url, { data: { real, standIns, standInsUrl } });
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const STAND_IN = "standin:";
let real = {};
let standIns = {};
let standInsUrl = "";

export function initialize(data = {}) {
  real = data.real || {};
  standIns = data.standIns || {};
  standInsUrl = data.standInsUrl || "";
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(real, specifier)) return { shortCircuit: true, url: real[specifier] };
  if (Object.hasOwn(standIns, specifier)) return { shortCircuit: true, url: `${STAND_IN}${encodeURIComponent(specifier)}` };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(STAND_IN)) {
    const entry = standIns[decodeURIComponent(url.slice(STAND_IN.length))];
    const from = JSON.stringify(standInsUrl);
    const source = entry.default
      ? `import { standIns } from ${from};\nexport default standIns[${JSON.stringify(entry.default)}];\n`
      : `export { ${entry.names.join(", ")} } from ${from};\n`;
    return { shortCircuit: true, format: "module", source };
  }
  const file = url.split("?")[0];
  if (file.startsWith("file:") && file.endsWith(".jsx")) {
    const { outputText, diagnostics = [] } = ts.transpileModule(fs.readFileSync(fileURLToPath(file), "utf8"), {
      fileName: "page.jsx",
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }
    });
    /* Kompilaator parandab katkise süntaksi vaikselt ära (puuduv sulg, lõpetamata märgend) ja annaks testile
       töötava faili, mida päris ehitus vastu ei võta: süntaksiviga on siin viga. */
    const broken = diagnostics.find((item) => item.category === ts.DiagnosticCategory.Error);
    if (broken) throw new SyntaxError(`${fileURLToPath(file)}: ${ts.flattenDiagnosticMessageText(broken.messageText, " ")}`);
    return { shortCircuit: true, format: "module", source: outputText };
  }
  if (file.startsWith("file:") && file.endsWith(".css")) {
    return { shortCircuit: true, format: "module", source: "export default new Proxy({}, { get: (_, name) => String(name) });\n" };
  }
  return nextLoad(url, context);
}
