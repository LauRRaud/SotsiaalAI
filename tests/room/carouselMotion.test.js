import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentUrl = new URL("../../components/room/GlassCarousel.jsx", import.meta.url);
const cssUrl = new URL("../../app/styles/carousel.css", import.meta.url);

test("komplekti mälust taastamine ei käivita horisontaalset kaardisõitu", async () => {
  const [component, css] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(
    component,
    /data-restoring=\{restoringPosition \? "1" : "0"\}/,
    "karussell peab avaldama lühikese taastamisfaasi CSS-ile"
  );
  assert.match(
    component,
    /carouselPositionMemory\.get\(storageId\)/,
    "sama vaate jooksul peab õige keskkaart olema teada enne esimest renderit"
  );
  assert.match(
    component,
    /carouselPositionMemory\.set\(storageId, key\)/,
    "iga päris kaardisamm peab uuendama kiiret komplektimälu"
  );
  assert.match(
    component,
    /data-set-entry=\{isSetEntry \? "1" : "0"\}/,
    "komplektivahetus peab erinema ruumi pikast käivituslavastusest"
  );
  assert.match(
    css,
    /\.gc\[data-restoring="1"\] \.gc-item\s*\{\s*transition:\s*none;/,
    "taastamisfaasis ei tohi kaardi asukoht animeeruda"
  );
  assert.doesNotMatch(
    css,
    /\.gc\[data-restoring="1"\] \.gc-item\s*\{[^}]*animation:\s*none;/s,
    "opacity-põhine gc-ignite sisenemine peab alles jääma"
  );
  assert.match(
    css,
    /\.gc\[data-set-entry="1"\][^{]*\{[^}]*animation:\s*gc-set-enter 400ms linear[^}]*animation-delay:\s*0ms;/s,
    "menüütaseme vahetus peab hajuma ühtlaselt ja viiteta"
  );
});
