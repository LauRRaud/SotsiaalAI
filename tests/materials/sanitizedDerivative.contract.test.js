import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ragLifecycleSource = await readFile(
  new URL("../../lib/materials/ragLifecycle.js", import.meta.url),
  "utf8",
);
const adminPanelSource = await readFile(
  new URL(
    "../../components/materials/MaterialsAdminSubmissionsPanel.jsx",
    import.meta.url,
  ),
  "utf8",
);
const previewRouteSource = await readFile(
  new URL("../../app/api/materials/[id]/preview/route.js", import.meta.url),
  "utf8",
);
const mountSource = await readFile(
  new URL("../../deploy/systemd/var-lib-sotsiaalai-materials.mount", import.meta.url),
  "utf8",
);
const mountVerificationSource = await readFile(
  new URL("../../deploy/systemd/sotsiaalai-materials-storage-verify.service", import.meta.url),
  "utf8",
);
const cdrWrapperSource = await readFile(
  new URL("../../deploy/bin/sotsiaalai-material-cdr", import.meta.url),
  "utf8",
);
const deploySource = await readFile(
  new URL("../../scripts/deploy-server.mjs", import.meta.url),
  "utf8",
);

test("shared RAG reads only the sanitized derivative", () => {
  assert.doesNotMatch(
    ragLifecycleSource,
    /readMaterial\(submission\.storagePath\)/,
    "raw submission bytes must never enter shared RAG",
  );
  assert.match(ragLifecycleSource, /readSanitizedMaterial/);
});

test("admin review opens a sanitized preview instead of the raw download", () => {
  assert.doesNotMatch(
    adminPanelSource,
    /\/api\/materials\/\$\{encodeURIComponent\(item\.id\)\}\/download/,
  );
  assert.match(
    adminPanelSource,
    /\/api\/materials\/\$\{encodeURIComponent\(item\.id\)\}\/preview/,
  );
  assert.match(previewRouteSource, /assertAdmin\(session\)/);
  assert.match(previewRouteSource, /readSanitizedMaterial\(submission\.storagePath\)/);
  assert.doesNotMatch(previewRouteSource, /readStoredMaterial/);
});

test("materials storage mount is fail-closed and least-privilege", () => {
  assert.match(mountSource, /Options=rw,nodev,nosuid,noexec,noatime/);
  assert.match(mountSource, /What=\/dev\/mapper\/sotsiaalai_materials/);
  assert.match(mountVerificationSource, /for required in nodev nosuid noexec/);
  assert.match(mountVerificationSource, /-o ubuntu -g ubuntu -m 0700 .*uploads .*quarantine .*sanitized/);
});

test("production CDR is a pinned local Dangerzone-to-text pipeline", () => {
  assert.match(cdrWrapperSource, /dangerzone-cli --version/);
  assert.match(cdrWrapperSource, /0\.11\.\*/);
  assert.match(cdrWrapperSource, /--ocr-lang est/);
  assert.match(cdrWrapperSource, /--output-filename "\$safe_pdf"/);
  assert.match(cdrWrapperSource, /pdftotext -enc UTF-8 -nopgbrk/);
  assert.doesNotMatch(cdrWrapperSource, /curl|wget|https?:\/\//);
  assert.match(deploySource, /install -m 0755 .*sotsiaalai-material-cdr/);
});
