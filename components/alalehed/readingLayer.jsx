"use client";

/* Avalike lugemislehtede jagatud lugemiskiht (T10 E5): nähtav sisukord,
   URL-hashiga avanevad peatükid ja aktiivse asukoha esiletõst. Ei ole vorm
   ega nõua sisselogimist; sama semantika juhendil, privaatsusel, tingimustel
   ja raamistikul. */

import { useEffect, useState } from "react";

export function useHashNavigation() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const applyHash = () => {
      const id = decodeURIComponent((window.location.hash || "").slice(1));
      setActiveId(id);
      if (!id) return;
      const el = document.getElementById(id);
      /* Sisu renderdub kliendis pärast esmast HTML-i — brauseri loomulik
         ankruhüpe võib mööduda, seega kerime ise, kerimist kaaperdamata. */
      if (el) el.scrollIntoView({ block: "start" });
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  return activeId;
}

export function ReadingToc({ title, items, activeId }) {
  if (!items?.length) return null;
  return (
    <nav className="reading-toc" aria-label={title}>
      <h2 className="reading-toc-title">{title}</h2>
      <ul className="reading-toc-list">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={activeId === id ? "location" : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
