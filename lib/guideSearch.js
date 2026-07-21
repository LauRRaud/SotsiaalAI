/* Kasutusjuhendi lokaalne otsing (T10 E5). Puhas funktsioon: otsib AINULT
   etteantud avalike juhendijaotiste pealkirjadest ja kehatekstist — T17
   isikliku otsinguga ei ristu. HTML-märgend eemaldatakse enne võrdlust. */

export function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterGuideSections(sections, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return sections;
  return sections.filter((section) => {
    const title = String(section.title || "").toLowerCase();
    const body = stripHtml(section.body).toLowerCase();
    return title.includes(q) || body.includes(q);
  });
}
