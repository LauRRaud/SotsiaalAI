import { wellbeingTools } from "@/lib/wellbeingTools";

/**
 * Tööheaolu marsruudi laadimis-skelett. Ilma selleta näitas Next.js juur-
 * loading.jsx-i (tühi 100dvh div) → paneel renderdus TÜHJALT ja SUURELT, kuni
 * serverikomponent (auth + tellimuse kontroll) valmis sai ("suur tühi kast",
 * tellija 07.07). Sama ruudustik samade nimedega → aken hoiab mõõtu ja sisu on
 * kohe näha; hüdreerudes muutuvad kaardid klikitavaks (ⓘ lisandub päisega).
 * Struktuur = WellbeingPage ülevaate DOM (div > section > div > grid), et
 * workspace.css paigutus/mõõt kehtiks 1:1.
 */
export default function Loading() {
  return (
    <div>
      <section aria-busy="true" aria-live="polite">
        <div>
          <div className="workspace-dashboard-grid">
            {wellbeingTools.map((tool) => (
              <div key={tool.id} className="workspace-dashboard-card" aria-hidden="true">
                <span>{tool.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
