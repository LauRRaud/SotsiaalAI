export function groundingStrength(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return "weak";
  const strongHit = groups.some(g => (g.bestScore || 0) >= 0.55);
  if (groups.length >= 4 && strongHit) return "strong";
  if (groups.length >= 2 && strongHit) return "ok";
  return "weak";
}
export function detectCrisis(text = "") {
  const t = (text || "").toLowerCase();
  const hits = [
    /enesetapp|enese\s*vigastus|ennast\s+vigastada|tapan end|tapan\s+ennast|taha[kn]s? surra|ei (taha|jaksa|suuda|j[õo]ua|viitsi) enam elada/,
    /ei n[äa]e (enam )?(elul|elamisel|elamisest) m[õo]tet|ei n[äa]e (enam )?m[õo]tet elada|elul (ei ole|pole) (enam )?m[õo]tet/,
    /v[õo]tan (endalt|enda|oma) elu|l[õo]petan oma elu|teen (endale|enesele) l[õo]pu/,
    /vahetu oht|kohe oht|elu ohus|ei ole turvaline/,
    /veritseb|veri ei peatu|teadvuseta/,
    /v[äa]givald|l[äa]hisuhtev[äa]givald|[äa]hvardab/,
    /lapse\s*(v[äa]givald|ahistamine|ohus|kuritarvitamine|v[äa][äa]rkohtlemine)|alaealine.*(ohus|v[äa]givald|ahistamine)/,
    /appi!?(\s+appi!?)*$/
  ];
  return hits.some(re => re.test(t));
}
export function isGreeting(text = "") {
  const t = (text || "").toLowerCase().trim();
  if (!t) return false;
  if (detectCrisis(t)) return false;
  if (/^(tere|tsau|tsau|hei|hey|hello|hi|tere paevast|tere ohtust|hommikust|ohtust)[.!?]*$/.test(t)) {
    return true;
  }
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2 && /^(kysimus|palun abi|appi)$/.test(t)) return true;
  return false;
}
