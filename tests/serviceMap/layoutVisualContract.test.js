import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspaceCss = fs.readFileSync(
  new URL("../../app/styles/workspace.css", import.meta.url),
  "utf8"
);
const featurePage = fs.readFileSync(
  new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url),
  "utf8"
);
const serviceMapPage = fs.readFileSync(
  new URL("../../app/teenusekaart/page.jsx", import.meta.url),
  "utf8"
);

test("standalone service map gives the map toolbar the primary visual position", () => {
  assert.match(
    serviceMapPage,
    /<WorkspaceFeaturePage feature="service_map" hideHeader\s*\/>/
  );
  assert.match(
    featurePage,
    /className=\{isServiceMap \? "workspace-feature-service-map-section" : undefined\}/
  );
  assert.match(
    workspaceCss,
    /\.workspace-feature-service-map-section\s*\{[^}]*height:\s*100%;/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-page\s*\{[^}]*display:\s*flex;[^}]*height:\s*100%;/s
  );
});

test("desktop service map uses one compact glass toolbar above a filling map", () => {
  assert.match(
    workspaceCss,
    /\.service-map-topbar\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*backdrop-filter:\s*blur\(18px\)/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-topbar-inner\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-fields\s*\{[^}]*grid-template-columns:\s*minmax\(13rem, 1\.2fr\) minmax\(11rem, 1fr\);/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-types\s*\{[^}]*flex-wrap:\s*nowrap;/s
  );
  assert.match(
    workspaceCss,
    /\.service-map-canvas\s*\{[^}]*flex:\s*1;[^}]*width:\s*100%;/s
  );
});

test("service map preserves the official basemap colors", () => {
  assert.match(
    workspaceCss,
    /\.service-map-canvas \.leaflet-tile-container\s*\{[^}]*filter:\s*none;/s
  );
  assert.doesNotMatch(
    workspaceCss,
    /\.service-map-canvas \.leaflet-tile-container\s*\{[^}]*brightness\(/s
  );
});

test("service map keeps a usable stacked toolbar on narrow screens", () => {
  assert.match(
    workspaceCss,
    /@media \(max-width: 768px\)[\s\S]*\.service-map-topbar-inner\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*stretch;/
  );
  assert.match(
    workspaceCss,
    /@media \(max-width: 768px\)[\s\S]*\.service-map-fields\s*\{[^}]*grid-template-columns:\s*1fr;/
  );
  assert.match(
    workspaceCss,
    /@media \(max-width: 768px\)[\s\S]*\.service-map-types\s*\{[^}]*overflow-x:\s*auto;/
  );
  assert.match(
    workspaceCss,
    /@media \(max-width: 768px\)[\s\S]*\.service-map-toggle\s*\{[^}]*display:\s*grid;/
  );
});
