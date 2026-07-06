"use client";

export default function SotsiaalAILoader({
  size,
  color = "#b17c7c",
  pulse = 2.4,
  minScale = 0.5,
  maxScale = 1,
  redStops,
  showBottomBall = true,
  ariaLabel = "Assistent koostab vastust",
  animated = true,
  ariaHidden = false,
  className = "",
  style = {}
}) {
  const accessibilityProps = ariaHidden ? {
    "aria-hidden": true
  } : {
    role: "status",
    "aria-live": "polite",
    "aria-busy": true,
    "aria-label": ariaLabel
  };
  return (
    <div className={className} {...accessibilityProps} data-animated={animated ? "true" : "false"} style={style}>
      {ariaHidden ? null : <span className="sr-only">{ariaLabel}</span>}
    </div>
  );
}
