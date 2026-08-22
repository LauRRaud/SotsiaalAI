/**
 * inertOutside — jätab ligipääsetavaks AINULT ühe elemendi haru.
 *
 * `role="dialog" aria-modal="true"` üksi EI kärbi ekraanilugeja puud.
 * Mõõdetud 07.08 avalehe laadimislooril (Chrome, 375 px): loori all oli
 * 22 sihitavat juhtelementi — „Liigu sisu juurde", „Jäta vahele",
 * „Lülita taustaheli välja", „Järgmine lugu", „Käivita", kogu kiirriba —
 * ja loori enda „Sisenen" alles kuues. TalkBack pühib täpselt seda
 * järjekorda, seega jõuab nägemispuudega kasutaja alles hiljem kuvatavate
 * nuppudeni enne kui läveni.
 *
 * `inert` kärbib nad päriselt: korraga kaob nii fookus, klõps kui ka
 * ekraanilugeja kirje. Käime elemendist <body>-ni ja märgime igal tasemel
 * ÕED inertseks. Puudutame ainult neid, kes ei olnud juba inertsed — nii
 * ei võta taastamine kelleltki ära tema enda inert-olekut (ruumi
 * karussell hoiab käivituse ajal ise inert'i, vt RoomStage
 * carouselWrapRef).
 *
 * @param {Element|null} element haru, mis jääb ligipääsetavaks
 * @param {{ except?: Array<Element|null|undefined> }} [options]
 *        elemendid, mida ei tohi inertseks teha (nt oma taustaloor)
 * @returns {() => void} taastaja, mis eemaldab AINULT siin lisatud inert'id
 */
const NEVER_INERT = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "TEMPLATE",
  "NOSCRIPT",
  /* Next'i marsruuditeavitaja on elav ala — inertsena ei kõneleks ta enam. */
  "NEXT-ROUTE-ANNOUNCER",
]);

export function inertOutside(element, options = {}) {
  const noop = () => {};
  const ownerDocument = element?.ownerDocument;
  const HTMLElementCtor = ownerDocument?.defaultView?.HTMLElement;
  if (!ownerDocument || element?.nodeType !== 1) return noop;

  const except = (options.except || []).filter(Boolean);
  const touched = [];
  let node = element;

  while (node && node !== ownerDocument.body) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sibling of parent.children) {
      if (sibling === node) continue;
      if (HTMLElementCtor && !(sibling instanceof HTMLElementCtor)) continue;
      if (!HTMLElementCtor && sibling?.nodeType !== 1) continue;
      if (NEVER_INERT.has(sibling.tagName)) continue;
      /* Elav ala (announce-riba) peab jääma kuuldavaks. */
      if (sibling.hasAttribute("aria-live")) continue;
      if (sibling.inert) continue;
      /* Kui hoitav element on selle õe SEES, ei tohi õde inertseks teha —
         inert pärandub kogu alampuule. */
      if (except.some((keep) => keep === sibling || sibling.contains(keep))) continue;
      sibling.inert = true;
      touched.push(sibling);
    }
    node = parent;
  }

  return () => {
    while (touched.length) {
      touched.pop().inert = false;
    }
  };
}

export default inertOutside;
