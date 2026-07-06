// In-browser element inspector — "what renders / what wins / what's dead".
//
// WHY: headless Playwright does NOT faithfully render this app's JS/token/canvas
// driven components (GlassRing, BorderGlow, glass-field-hole mask), so a headless
// scan returns garbage (tokens "undefined", flat fallbacks). The REAL browser
// resolves everything. This routine runs in the page (inject via the Claude Chrome
// extension's javascript_tool, or paste into DevTools console) and reports, for
// each element matching the target selectors, the TRUTH as rendered.
//
// It answers three things the static tools cannot:
//   1. computed + resolved tokens — the actual winning design (the spec).
//   2. matched author rules — WHERE that design comes from (selector + source
//      stylesheet + which properties each rule sets). Provenance for consolidation.
//   3. dead classes (EMPIRICAL) — remove each semantic class, remeasure the key
//      computed props; if nothing changes, that class contributes nothing AT THIS
//      element+theme+state → a dead-at-this-element candidate. No cascade
//      reimplementation: the browser is the judge.
//
// Usage (in page context):
//   __inspect([".button[data-variant=\"primary\"]", ".update-pin-content .ui-glow-field"],
//             ["backgroundColor","backgroundImage","color","borderTopColor",
//              "borderTopWidth","boxShadow","borderTopLeftRadius"],
//             ["--btn-primary-bg","--btn-primary-text","--btn-primary-shadow"]);
// Returns a JSON-serialisable report. Walk pages/themes by navigating + reapplying
// theme (localStorage theme + a11y_prefs, then reload) between calls.

window.__inspect = function (selectors, keyProps, tokenNames) {
  keyProps = keyProps || ["backgroundColor", "backgroundImage", "color", "borderTopColor", "borderTopWidth", "boxShadow", "borderTopLeftRadius"];
  tokenNames = tokenNames || [];
  const trunc = (s, n = 46) => (s == null ? s : String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

  // Tailwind utilities and structural atoms we don't care about as "semantic" classes.
  const isSemantic = (c) =>
    /^[a-z][a-z0-9-]+$/.test(c) &&                       // plain kebab, no brackets/colons (Tailwind arbitrary)
    !/^(inline-flex|flex|grid|items-|justify-|gap-|border|border-solid|border-transparent|rounded|px-|py-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|text-|font-|tracking-|min-|max-|w-|h-|select-none|relative|absolute|fixed|overflow-|cursor-|appearance-|z-|backdrop-|transition|duration|ease|disabled|aria-|whitespace-|leading-)/.test(c) &&
    !/^[A-Z]/.test(c);                                   // module-hashed (BorderGlow-module__…) kept separate below

  // matched author rules for an element (same-origin sheets only). Includes
  // STATE rules (:hover/:focus/:active/…) by stripping the dynamic pseudo and
  // testing whether the base selector matches — so the hover/focus/active DESIGN
  // and its provenance are captured WITHOUT having to physically trigger the
  // state (physical hover via the extension is unreliable). Each rule is tagged
  // with `state`: "resting" when no dynamic pseudo, else the pseudo(s) present.
  const DYN = /:(hover|focus|focus-visible|focus-within|active|disabled|checked)(?![-\w])/g;
  const matchedRules = (el) => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      const src = (sheet.href || "inline").split("/").pop();
      const walk = (list, media) => {
        for (const r of list) {
          if (r.type === CSSRule.MEDIA_RULE) {
            let mm = true; try { mm = window.matchMedia(r.conditionText).matches; } catch {}
            if (mm) walk(r.cssRules, "@media " + r.conditionText);
            continue;
          }
          if (r.type !== CSSRule.STYLE_RULE) continue;
          // state = the dynamic pseudo(s) on the rule, or "resting"
          const states = (r.selectorText.match(DYN) || []).map((s) => s.slice(1));
          const state = states.length ? [...new Set(states)].join("+") : "resting";
          // test the base selector (dynamic pseudo + ::pseudo-elements stripped)
          const base = r.selectorText.replace(DYN, "").replace(/::[-a-z]+(\([^)]*\))?/g, "");
          let does = false; try { does = el.matches(base); } catch {}
          if (!does) continue;
          const props = [];
          for (let i = 0; i < r.style.length; i++) {
            const p = r.style[i];
            // keep visual + token props, drop layout noise
            if (/color|background|border|box-shadow|^--|opacity|filter|backdrop/.test(p)) {
              props.push(p + (r.style.getPropertyPriority(p) === "important" ? "!" : ""));
            }
          }
          if (props.length) out.push({ state, sel: trunc(r.selectorText, 80), src, media: media || undefined, props });
        }
      };
      walk(rules, null);
    }
    return out;
  };

  // empirical dead-class test: remove a class, remeasure keyProps, restore.
  const deadClasses = (el) => {
    const base = {}; const cs0 = getComputedStyle(el); for (const p of keyProps) base[p] = cs0[p];
    const dead = [];
    for (const c of [...el.classList].filter(isSemantic)) {
      el.classList.remove(c);
      const cs = getComputedStyle(el);
      let changed = false;
      for (const p of keyProps) { if (cs[p] !== base[p]) { changed = true; break; } }
      el.classList.add(c);
      if (!changed) dead.push(c);
    }
    return dead;
  };

  const report = { url: location.pathname, theme: (document.documentElement.className.match(/theme-\w+/) || ["default"])[0], contrast: document.documentElement.getAttribute("data-contrast") || "normal", targets: {} };
  for (const sel of selectors) {
    let els; try { els = [...document.querySelectorAll(sel)]; } catch { report.targets[sel] = { error: "bad selector" }; continue; }
    report.targets[sel] = { count: els.length, instances: els.slice(0, 4).map((el) => {
      const cs = getComputedStyle(el);
      // Full (untruncated) values — the markdown renderer shortens for display,
      // but the consistency diff fingerprints these and needs the real strings
      // (a box-shadow divergence lives past char 46). trunc() stays for matched
      // selector text only.
      const computed = {}; for (const p of keyProps) computed[p] = cs[p];
      const tokens = {}; for (const t of tokenNames) tokens[t] = cs.getPropertyValue(t).trim();
      const semantic = [...el.classList].filter(isSemantic);
      const modules = [...el.classList].filter((c) => /-module__/.test(c)).map((c) => c.split("__")[0]);
      // tailwind = everything that is neither a semantic kebab class nor a module hash
      const tailwind = [...el.classList].filter((c) => !isSemantic(c) && !/-module__/.test(c));
      const elCs = getComputedStyle(el);
      const visible = elCs.display !== "none" && elCs.visibility !== "hidden" && elCs.opacity !== "0" && el.offsetWidth > 0;
      const disabled = el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled") || el.getAttribute("data-state") === "disabled";
      const variant = el.getAttribute("data-variant") || null;
      return { tag: el.tagName.toLowerCase(), variant, semantic, modules, tailwind, computed, tokens, visible, disabled, deadAtThisState: deadClasses(el), matched: matchedRules(el) };
    }) };
  }
  return report;
};
"__inspect ready";
