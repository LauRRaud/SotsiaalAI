export const EFFECTIVE_PRACTICE_HISTORY_KEY = "__sotsiaalaiEffectivePracticeView";

function cleanId(value) {
  return String(value || "").trim();
}

export function parseEffectivePracticeView(search) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const id = cleanId(params.get("practice"));
  const editor = cleanId(params.get("editor"));

  if (editor === "new" && !id) return { kind: "editor", id: "" };
  if (editor === "edit" && id) return { kind: "editor", id };
  if (id) return { kind: "detail", id };
  return { kind: "list", id: "" };
}

export function effectivePracticeViewKey(view) {
  return `${view?.kind || "list"}:${cleanId(view?.id)}`;
}

export function applyEffectivePracticeView(urlLike, view) {
  const url = new URL(urlLike);
  url.searchParams.delete("practice");
  url.searchParams.delete("editor");

  if (view?.kind === "detail" && cleanId(view.id)) {
    url.searchParams.set("practice", cleanId(view.id));
  } else if (view?.kind === "editor") {
    if (cleanId(view.id)) {
      url.searchParams.set("practice", cleanId(view.id));
      url.searchParams.set("editor", "edit");
    } else {
      url.searchParams.set("editor", "new");
    }
  }

  return url;
}
