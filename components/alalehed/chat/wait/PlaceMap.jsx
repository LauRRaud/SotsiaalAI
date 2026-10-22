"use client";

/* ADR-176: the place a question is about, on a see-through map of Estonia (owner 22.10: "selline läbipaistev kaart ...
   sinna nt marker või see nõel", "kui küsimuses on asukoht"). Two maps the owner chooses between: "icon", the small
   brand map drawn larger as lines (public/icons/eesti_kontuurkaart_logo.svg, its own pin left out), and "outline",
   the accurate outline (public/icons/eesti_kontuurkaart.svg) as a mask. Both take the text colour, so they read over
   any background. One pin for a municipality, two smaller ones for both municipalities a shared name may be. Shown
   only when the plan read a place. */
import { ICON_PATHS, ICON_VIEW } from "./estoniaIcon";
import { iconPoint, municipalityPoint } from "./municipalityPoints";
import { placeText } from "./waitView";

function Pin({ x, y, small, delay }) {
  return (
    <span className="pilot-map__pin" data-small={small ? "1" : undefined}
      style={{ left: `${(x * 100).toFixed(2)}%`, top: `${(y * 100).toFixed(2)}%`, "--pin-delay": `${delay}ms` }}>
      <span className="pilot-map__ring" aria-hidden="true" />
      {/* The pin of the brand map icon (eesti_kontuurkaart_logo.svg): a round head, a slim point, a dot inside. */}
      <svg className="pilot-map__needle" viewBox="13.5 5 12.6 15.3" aria-hidden="true">
        <path d="M19.8,19.68c-.66,0-1.34-.34-1.82-.91-2.32-2.75-3.84-5.6-3.84-7.58,0-3.13,2.54-5.66,5.66-5.66,3.12,0,5.66,2.53,5.66,5.66,0,1.98-1.52,4.83-3.84,7.58-.48.57-1.16.91-1.82.91Z" />
        <circle cx="19.8" cy="11.25" r="2.05" />
      </svg>
    </span>
  );
}

export default function PlaceMap({ t, places, look = "icon", className = "" }) {
  const icon = look !== "outline";
  const pins = [];
  places.forEach(entries => entries.forEach(entry => {
    const point = icon ? iconPoint(entry.region, ICON_VIEW) : municipalityPoint(entry.region);
    if (point && !pins.some(pin => pin.region === entry.region)) pins.push({ ...point, region: entry.region, small: entries.length > 1 });
  }));
  if (!pins.length) return null;
  const label = places.map(entries => placeText(t, entries)).join(" · ");
  return (
    <figure className={`pilot-map ${className}`.trim()} data-look={icon ? "icon" : "outline"} aria-label={label}>
      <div className="pilot-map__frame">
        {icon ? (
          <svg className="pilot-map__lines" viewBox={`${ICON_VIEW.x} ${ICON_VIEW.y} ${ICON_VIEW.width} ${ICON_VIEW.height}`} aria-hidden="true">
            {ICON_PATHS.map((d, index) => <path key={index} d={d} data-island={index ? "1" : undefined} />)}
          </svg>
        ) : <span className="pilot-map__land" aria-hidden="true" />}
        {pins.map((pin, index) => <Pin key={pin.region} x={pin.x} y={pin.y} small={pin.small} delay={350 + index * 160} />)}
      </div>
      <figcaption className="pilot-map__label">{label}</figcaption>
    </figure>
  );
}
