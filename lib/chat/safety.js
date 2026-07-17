export function groundingStrength(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return "weak";
  const strongHit = groups.some(g => (g.bestScore || 0) >= 0.55);
  if (groups.length >= 4 && strongHit) return "strong";
  if (groups.length >= 2 && strongHit) return "ok";
  return "weak";
}
// Kriisituvastus on determinstlik fail-safe (VEST-P0/P0a). ET-komplekt jääb muutmata;
// T03 (E1) lisab RU/EN fail-closed regexid. NB: kirillitsa puhul EI tohi kasutada
// ASCII sõnapiiri \b (see ei matchi kirillitsat/õäöü — vt T17 RESTRICTED_SOURCE viga),
// seetõttu on vene mustrid ankurdatud tühikute ja sõnavormide kaudu.
export function detectCrisis(text = "") {
  const t = (text || "").toLowerCase();
  const hits = [
    // --- Eesti (VEST-P0/P0a, muutmata) ---
    /enesetapp|enese\s*vigastus|ennast\s+vigastada|tapan end|tapan\s+ennast|taha[kn]s? surra|ei (taha|jaksa|suuda|j[õo]ua|viitsi) enam elada/,
    /ei n[äa]e (enam )?(elul|elamisel|elamisest) m[õo]tet|ei n[äa]e (enam )?m[õo]tet elada|elul (ei ole|pole) (enam )?m[õo]tet/,
    /v[õo]tan (endalt|enda|oma) elu|l[õo]petan oma elu|teen (endale|enesele) l[õo]pu/,
    /vahetu oht|kohe oht|elu ohus|ei ole turvaline/,
    /veritseb|veri ei peatu|teadvuseta/,
    /v[äa]givald|l[äa]hisuhtev[äa]givald|[äa]hvardab/,
    /lapse\s*(v[äa]givald|ahistamine|ohus|kuritarvitamine|v[äa][äa]rkohtlemine)|alaealine.*(ohus|v[äa]givald|ahistamine)/,
    /appi!?(\s+appi!?)*$/,
    // --- English (E1, fail-closed) ---
    /suicid(e|al)|kill(ing)? myself|end(ing)? (my|my own|it all) life|take (my|my own) life|want(ing)? to die|wish i (was|were) dead|better off dead|nothing to live for|no reason to (live|go on)|can'?t go on (any\s?more|living)|do(n'?t| not) want to (live|be alive)/,
    /self[-\s]?harm|hurt(ing)? myself|harm(ing)? myself|cut(ting)? myself/,
    /(i'?m|i am|we'?re|we are)\s+in (immediate )?danger|in immediate danger|not safe (here|at home|right now)|(he|she|they)\s*(is|are|'?s|'?re)?\s*threaten(s|ing|ed)? (to kill|to hurt|me)|going to kill (me|us)|about to (hurt|kill)/,
    /child abuse|child (is )?(in danger|being (abused|hurt|beaten))|(abus(e|ing)|beating|hurting) (a |the |my |his |her )?child/,
    // --- Русский (E1, fail-closed; без ASCII \b — кириллица) ---
    /суицид|самоуб(ийство|ийца)|поконч(ить|у) (с собой|(с )?жизнью)|свести сч[её]ты с жизнью|уб(ить|ью|ьюсь) себя|не хочу (больше )?жить|не могу (больше )?(так )?жить|жить не (хочется|хочу)|нет смысла жить|надоело жить|устал(а)? жить/,
    /причинить себе вред|навредить себе|реж(у|ет) себя|порезать себя|резать себя/,
    /мне угрожает|угрожает (убить|расправ)|меня избива(ет|ют)|бь[её]т меня|в опасности прямо сейчас|мне (сейчас )?небезопасно|я в опасности/,
    /реб[её]нок в опасности|насилие над реб[её]нком|избива(ет|ют) реб[её]нка/
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
