import { cn } from "@/components/ui/cn";

const DARK_THEME_COLOR = "#c57171";
const LIGHT_THEME_COLOR = "#7A3A38";

function resolveThemeColor(isLightTheme) {
  if (typeof isLightTheme !== "boolean") return "currentColor";
  return isLightTheme ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
}

export default function ChevronIcon({
  direction = "up",
  isLightTheme,
  strokeWidth = 1.2,
  className,
  ...props
}) {
  const stroke = resolveThemeColor(isLightTheme);
  const isHorizontal = direction === "right" || direction === "left";
  const viewBox = isHorizontal ? "0 0 4.8 8.6" : "0 0 8.6 4.8";
  const pathData =
    direction === "down"
      ? "M0.6 0.6l3.7 3.6L8 0.6"
      : direction === "right"
        ? "M0.6 0.6l3.6 3.7L0.6 8"
        : direction === "left"
          ? "M4.2 0.6L0.6 4.3 4.2 8"
          : "M0.6 4.2l3.7-3.6L8 4.2";

  return (
    <svg
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d={pathData}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
