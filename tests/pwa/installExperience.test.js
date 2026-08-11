import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  detectPwaEnvironment,
  isMeaningfulInstallPath,
  nextInstallSnoozeAt,
  PWA_INSTALL_SNOOZE_MS,
  shouldShowInstallPromotion,
  shouldUseNativeInstallPrompt,
} from "../../lib/pwa/installExperience.js";

test("PWA environment distinguishes iOS Safari from other iOS browsers", () => {
  const safari = detectPwaEnvironment({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    vendor: "Apple Computer, Inc.",
    platform: "iPhone",
    maxTouchPoints: 5,
  });
  const chrome = detectPwaEnvironment({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1",
    vendor: "Apple Computer, Inc.",
    platform: "iPhone",
    maxTouchPoints: 5,
  });

  assert.equal(safari.isIOS, true);
  assert.equal(safari.isIOSSafari, true);
  assert.equal(chrome.isIOS, true);
  assert.equal(chrome.isIOSSafari, false);
});

test("Android and desktop Chromium use the captured native install prompt", () => {
  const deferredPrompt = { prompt() {} };
  assert.equal(
    shouldUseNativeInstallPrompt({ deferredPrompt, isIOS: false }),
    true
  );
  assert.equal(
    shouldUseNativeInstallPrompt({ deferredPrompt, isIOS: true }),
    false
  );
  assert.equal(
    shouldUseNativeInstallPrompt({ deferredPrompt: null, isIOS: false }),
    false
  );
});

test("install promotion waits for a signed-in meaningful route and honors snooze", () => {
  const now = Date.UTC(2026, 7, 11);
  const base = {
    authenticated: true,
    available: true,
    pathname: "/vestlus",
    standalone: false,
    suppressed: false,
    snoozedUntil: 0,
    now,
  };

  assert.equal(shouldShowInstallPromotion(base), true);
  assert.equal(shouldShowInstallPromotion({ ...base, pathname: "/" }), false);
  assert.equal(shouldShowInstallPromotion({ ...base, pathname: "/hinnastus" }), false);
  assert.equal(shouldShowInstallPromotion({ ...base, authenticated: false }), false);
  assert.equal(shouldShowInstallPromotion({ ...base, standalone: true }), false);
  assert.equal(shouldShowInstallPromotion({ ...base, suppressed: true }), false);
  assert.equal(
    shouldShowInstallPromotion({ ...base, snoozedUntil: now + 1 }),
    false
  );
  assert.equal(isMeaningfulInstallPath("/valitoo/visit-1"), true);
  assert.equal(nextInstallSnoozeAt(now), now + PWA_INSTALL_SNOOZE_MS);
});

test("accessibility journey includes optional full-screen install before save", () => {
  const source = readFileSync(
    new URL("../../components/accessibility/AccessibilityModal.jsx", import.meta.url),
    "utf8"
  );
  const installIndex = source.indexOf('{ key: "install"');
  const saveIndex = source.indexOf('{ key: "save"');

  assert.ok(installIndex > 0, "install station exists");
  assert.ok(saveIndex > installIndex, "install station comes before save");
  assert.match(source, /<InstallAppLink[\s\S]*variant="station"/);
  assert.match(
    source,
    /onInstallChoice=\{\(outcome\) => \{[\s\S]*outcome === "accepted"[\s\S]*advanceAfterChoice\(\)/
  );

  const installLinkSource = readFileSync(
    new URL("../../components/pwa/InstallAppLink.jsx", import.meta.url),
    "utf8"
  );
  const stationBranch = installLinkSource.slice(
    installLinkSource.lastIndexOf('if (variant === "station")'),
    installLinkSource.indexOf('if (variant === "quickIcon")')
  );
  assert.doesNotMatch(
    stationBranch,
    /<div className="pwa-install-station"/,
    "install station must stay flat like the save station, without a scroll wrapper"
  );
});

test("public and profile navigation expose install near primary choices", () => {
  const source = readFileSync(
    new URL("../../components/room/RoomStage.jsx", import.meta.url),
    "utf8"
  );
  const publicBlock = source.slice(
    source.indexOf("const publicItems"),
    source.indexOf("const teaveItems")
  );
  const profileBlock = source.slice(
    source.indexOf("const profileItems"),
    source.indexOf("const isProfileContext")
  );

  assert.ok(publicBlock.indexOf('key: "paigalda"') > publicBlock.indexOf('key: "login"'));
  assert.ok(publicBlock.indexOf('key: "paigalda"') < publicBlock.indexOf('key: "tingimused"'));
  assert.ok(profileBlock.indexOf('key: "paigalda"') > profileBlock.indexOf('key: "keel"'));
  assert.ok(profileBlock.indexOf('key: "paigalda"') < profileBlock.indexOf('key: "epost"'));
});

test("web manifest describes the installed experience", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../public/site.webmanifest", import.meta.url), "utf8")
  );

  assert.equal(manifest.display, "standalone");
  assert.match(manifest.description, /täisekraaniliseks/);
  assert.ok(manifest.categories.includes("productivity"));
  assert.equal(manifest.prefer_related_applications, false);
});
