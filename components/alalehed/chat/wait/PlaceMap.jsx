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
      <svg className="pilot-map__needle" viewBox="0 0 24 34" aria-hidden="true">
        <path d="M12 33c-.6 0-1-.4-1.3-1C8.3 26.7 2 20.6 2 12.5 2 6.7 6.5 2 12 2s10 4.7 10 10.5c0 8.1-6.3 14.2-8.7 19.5-.3.6-.7 1-1.3 1z" />
        <circle cx="12" cy="12.5" r="4" />
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
