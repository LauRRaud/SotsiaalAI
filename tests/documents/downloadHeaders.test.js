import assert from "node:assert/strict";
import test from "node:test";

import { toAsciiDownloadFileName } from "../../lib/documents/downloadHeaders.js";

test("download headers can use ASCII fallback with UTF-8 filename star", () => {
  const safeName = "Helikõne salvestus – 24.5.2026";
  const asciiName = toAsciiDownloadFileName(safeName);
  const disposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;

  assert.equal(asciiName, "Heliko_ne salvestus _ 24.5.2026");
  assert.match(disposition, /filename="Heliko_ne salvestus _ 24\.5\.2026"/);
  assert.match(disposition, /filename\*=UTF-8''Helik%C3%B5ne%20salvestus%20%E2%80%93%2024\.5\.2026/);
  assert.doesNotThrow(() => new Headers({ "Content-Disposition": disposition }));
});
