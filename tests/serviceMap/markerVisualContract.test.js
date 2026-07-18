import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspaceCss = fs.readFileSync(
  new URL("../../app/styles/workspace.css", import.meta.url),
  "utf8"
);
const mapComponent = fs.readFileSync(
  new URL("../../components/workspace/ServiceMapLeaflet.jsx", import.meta.url),
  "utf8"
);

test("service map restores the four semantic marker colors", () => {
  assert.match(
    workspaceCss,
    /\.service-map-leaflet__marker--kov\s*\{[^}]*--service-map-marker-fill:\s*#2f5f8f;/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-leaflet__marker--provider\s*\{[^}]*--service-map-marker-fill:\s*#168a72;/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-leaflet__marker--help-request\s*\{[^}]*--service-map-marker-fill:\s*#b45309;/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-leaflet__marker--help-offer\s*\{[^}]*--service-map-marker-fill:\s*#a23b72;/s
  );
});

test("service map markers remain understandable without color", () => {
  assert.match(mapComponent, /if \(allHelpRequests\) return "\?";/);
  assert.match(mapComponent, /if \(allHelpOffers\) return "\+";/);
  assert.match(mapComponent, /if \(allProviders\) return "T";/);
  assert.match(mapComponent, /if \(allKov\) return "K";/);

  for (const labelKey of [
    "marker_kov",
    "marker_provider",
    "marker_help_request",
    "marker_help_offer"
  ]) {
    assert.match(mapComponent, new RegExp(labelKey));
  }
});

test("custom marker shape is visible in the map and compact legend", () => {
  assert.match(
    workspaceCss,
    /\.service-map-canvas \.leaflet-div-icon\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s
  );
  assert.match(workspaceCss, /\.service-map-leaflet__marker-shape\s*\{/);
  assert.match(workspaceCss, /\.service-map-leaflet__marker-pin\s*\{[^}]*fill:\s*currentColor;/s);
  assert.match(workspaceCss, /\.service-map-leaflet__marker-hole\s*\{/);
  assert.match(workspaceCss, /\.service-map-leaflet__marker-label\s*\{/);
  assert.match(
    workspaceCss,
    /\.service-map-leaflet__legend-marker \.service-map-leaflet__marker\s*\{[^}]*width:\s*1\.72rem;[^}]*height:\s*2\.15rem;/s
  );
  assert.match(workspaceCss, /\.service-map-leaflet__marker--selected\s*\{/);
});
