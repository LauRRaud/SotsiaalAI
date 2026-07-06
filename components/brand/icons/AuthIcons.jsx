import { cn } from "@/components/ui/cn";

const DARK_THEME_COLOR = "#c57171";
const LIGHT_THEME_COLOR = "#7A3A38";
const SUCCESS_COLOR = "#16a34a";
const ERROR_COLOR = "#dc2626";

function resolveThemeColor(isLightTheme) {
  return isLightTheme ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
}

export function EmailEnvelopeStatusIcon({
  isLightTheme = false,
  status = "success",
  className,
  ...props
}) {
  const stroke = resolveThemeColor(isLightTheme);
  const isError = status === "error";
  const outerOpacity = isLightTheme ? 0.9 : 1;

  return (
    <svg
      viewBox={isError ? "0 0 21.32 14.01" : "0 0 22.03 14.08"}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d={
          isError
            ? "M15.1 13.51H2.7c-1.22 0-2.2-.98-2.2-2.2V2.71C.5 1.49 1.48.51 2.7.51h15.4c1.21-.11 2.28.78 2.39 1.99 0 .07 0 .14 0 .21v4.7"
            : "M15.1 13.58H2.7c-1.22 0-2.2-.98-2.2-2.2V2.78C.5 1.57 1.48.58 2.7.58h15c1.17-.33 2.39.35 2.72 1.51.06.22.09.45.08.69v5.7"
        }
        stroke={stroke}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={outerOpacity}
      />
      <path
        d="M4.5 3.88l6 2.7 6-2.7"
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {isError ? (
        <path
          d="M16.9 9.31l4 3.8M20.9 9.31l-4 3.8"
          stroke={ERROR_COLOR}
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M16.4 11.38l1.8 1.8 3.4-3.4"
          stroke={SUCCESS_COLOR}
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function SubmitArrowIcon({
  isLightTheme = false,
  useCurrentColor = false,
  className,
  ...props
}) {
  const stroke = useCurrentColor ? "currentColor" : resolveThemeColor(isLightTheme);
  const strokeOpacity = useCurrentColor ? 1 : isLightTheme ? 1 : 0.8;

  return (
    <svg
      viewBox="0 0 4.8 8.6"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M0.6 0.6l3.6 3.7L0.6 8"
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={strokeOpacity}
      />
    </svg>
  );
}

export function LockErrorIcon({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 8.42 8.47"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <g opacity="0.9">
        <path
          d="M2.28 3.27V1.29c0-.52.42-.93.93-.93h1.98c.52 0 .93.42.93.93v1.98"
          stroke={ERROR_COLOR}
          strokeWidth="0.71"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="0.36"
          y="3.27"
          width="7.7"
          height="4.84"
          rx="1.1"
          ry="1.1"
          stroke={ERROR_COLOR}
          strokeWidth="0.71"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4.21" cy="5.64" r="0.52" fill={ERROR_COLOR} />
        <path
          d="M4.21 6.08v0.47"
          stroke={ERROR_COLOR}
          strokeWidth="0.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function PowerExitIcon({
  isLightTheme = false,
  className,
  ...props
}) {
  const outerStroke = `var(--profile-logout-outer-stroke, ${isLightTheme ? DARK_THEME_COLOR : LIGHT_THEME_COLOR})`;
  const arrowStroke = `var(--profile-logout-arrow-stroke, ${isLightTheme ? LIGHT_THEME_COLOR : DARK_THEME_COLOR})`;
  const groupOpacity = isLightTheme ? 0.9 : 0.8;
  const outerOpacity = isLightTheme ? 0.9 : 1;

  return (
    <svg
      viewBox="0 -1.4 15.62 18.4"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <g opacity={groupOpacity}>
        <path
          d="M15.3 3.6C12.78-.09 7.75-1.05 4.06 1.46.37 3.98-.59 9.01 1.92 12.7c2.52 3.69 7.55 4.65 11.24 2.14.84-.57 1.57-1.3 2.14-2.14"
          stroke={outerStroke}
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={outerOpacity}
        />
        <path
          d="M7.62 4.8l3.6 3.7-3.6 3.7"
          stroke={arrowStroke}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
