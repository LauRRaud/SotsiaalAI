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
const mountVerificationCommandSource = await readFile(
  new URL("../../deploy/bin/sotsiaalai-materials-storage-verify", import.meta.url),
  "utf8",
);
const frontendStorageDropInSource = await readFile(
  new URL("../../deploy/systemd/sotsiaalai-frontend.service.d/20-materials-storage.conf", import.meta.url),
  "utf8",
);
const provisionSource = await readFile(
  new URL("../../deploy/provision-materials-volume.sh", import.meta.url),
  "utf8",
);
const tmpfilesSource = await readFile(
  new URL("../../deploy/systemd/sotsiaalai-materials-tmpfiles.conf", import.meta.url),
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
  assert.match(mountVerificationSource, /ExecStart=\/usr\/local\/bin\/sotsiaalai-materials-storage-verify/u);
  assert.match(mountVerificationCommandSource, /for required in nodev nosuid noexec/);
  assert.match(mountVerificationCommandSource, /-o ubuntu -g ubuntu -m 0700/);
  assert.match(mountSource, /DirectoryMode=0500/u);
  assert.match(frontendStorageDropInSource, /BindsTo=var-lib-sotsiaalai-materials\.mount/u);
  assert.match(frontendStorageDropInSource, /Requires=var-lib-sotsiaalai-materials\.mount/u);
  assert.match(frontendStorageDropInSource, /After=[^\n]*var-lib-sotsiaalai-materials\.mount/u);
  assert.match(
    frontendStorageDropInSource,
    /ExecStartPre=\/usr\/local\/bin\/sotsiaalai-materials-storage-verify/u,
    "täpne köitekontroll peab jooksma iga frontendi käivituse ees"
  );
  assert.doesNotMatch(
    mountVerificationSource,
    /RemainAfterExit=yes/u,
    "kontroll peab igal frontendi käivitusel uuesti jooksma"
  );
  assert.match(
    provisionSource,
    /install -d -m 0500 -o root -g root "\$mount_point"/u,
    "köiteta mountpoint ei tohi olla frontendi kasutajale kirjutatav"
  );
  assert.doesNotMatch(
    tmpfilesSource,
    /^d\s+\/var\/lib\/sotsiaalai\/materials\S*\s+0?7[057]0\s+ubuntu\s+ubuntu/gmu,
    "tmpfiles ei tohi köiteta backing-kataloogi uuesti kirjutatavaks muuta"
  );
  assert.match(
    deploySource,
    /install -m 0755 .*sotsiaalai-materials-storage-verify/u,
    "deploy peab per-start kontrolli käivitatava faili paigaldama"
  );
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
