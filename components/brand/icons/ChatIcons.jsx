import { cn } from "@/components/ui/cn";

const DARK_THEME_COLOR = "var(--chat-icon-dark, #c57171)";
const LIGHT_THEME_COLOR = "var(--chat-icon-light, #7A3A38)";

function resolveThemeColor(isLightTheme) {
  return isLightTheme ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
}

export function ChatBubbleIcon({
  isLightTheme = false,
  className,
  showDots = true,
  strokeWidth = 10,
  ...props
}) {
  const stroke = resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="-3 -3 132.15 119.8"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M24.36 5h77.43c10.69 0 19.36 9.29 19.36 20.76v34.6c0 11.46-8.67 20.76-19.36 20.76H69.53l-25.81 27.68V81.12H24.36C13.67 81.12 5 71.83 5 60.36V25.76C5 14.29 13.67 5 24.36 5Z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots ? (
        <>
          <circle cx="42" cy="42" r="5.6" fill={stroke} />
          <circle cx="63.5" cy="38.5" r="5.6" fill={stroke} />
          <circle cx="85" cy="42" r="5.6" fill={stroke} />
        </>
      ) : null}
    </svg>
  );
}

export function RoomsIcon({ isLightTheme = false, className, ...props }) {
  const stroke = resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M6.41 13.79h5.4c2.1 0 3.7 1 4.3 2.6.5 1.3.4 2.5.2 3.4-.5 2-2.9 2.6-7.2 2.6s-6.7-.6-7.2-2.6c-.2-.9-.3-2.1.2-3.4.6-1.6 2.2-2.6 4.3-2.6Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9.11"
        cy="5.79"
        r="4"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.86 18.88V17c0-1.71-1.53-3.21-3.72-3.64"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.4 2.76c1.91.02 3.44 1.64 3.41 3.62s-1.59 3.56-3.5 3.53"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AddPersonIcon({ isLightTheme = false, className, strokeColor, strokeWidth = 1.5, ...props }) {
  const stroke = strokeColor || resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <g transform="translate(0 -1.3)">
        <path
          d="M9.3 15H14.7C16.8 15 18.4 16 19 17.6C19.5 18.9 19.4 20.1 19.2 21C18.7 23 16.3 23.6 12 23.6C7.7 23.6 5.3 23 4.8 21C4.6 20.1 4.5 18.9 5 17.6C5.6 16 7.2 15 9.3 15Z"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="7"
          r="4"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.2 8.7V12.9"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.1 10.8H22.3"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function WorkspaceIcon({
  isLightTheme = false,
  className,
  outerStrokeWidth = 1.55,
  innerStrokeWidth = 1.45,
  nonScalingStroke = false,
  variant = "default",
  ...props
}) {
  const stroke = resolveThemeColor(isLightTheme);
  const vectorEffect = nonScalingStroke ? "non-scaling-stroke" : undefined;
  const isMobileNavShape = variant === "mobileNav";
  const outerFrame = isMobileNavShape
    ? { x: 3.18, y: 3.95, width: 17.64, height: 16.08, rx: 2.18 }
    : { x: 3.4, y: 4.15, width: 17.2, height: 15.7, rx: 2.25 };
  const cells = isMobileNavShape
    ? [
        { x: 7.0, y: 7.92, width: 3.9, height: 3.32 },
        { x: 13.1, y: 7.92, width: 3.9, height: 3.32 },
        { x: 7.0, y: 13.28, width: 3.9, height: 3.32 },
        { x: 13.1, y: 13.28, width: 3.9, height: 3.32 }
      ]
    : [
        { x: 7.15, y: 8.05, width: 3.65, height: 3.2 },
        { x: 13.2, y: 8.05, width: 3.65, height: 3.2 },
        { x: 7.15, y: 13.25, width: 3.65, height: 3.2 },
        { x: 13.2, y: 13.25, width: 3.65, height: 3.2 }
      ];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      shapeRendering={nonScalingStroke ? "geometricPrecision" : undefined}
      {...props}
    >
      <rect
        x={outerFrame.x}
        y={outerFrame.y}
        width={outerFrame.width}
        height={outerFrame.height}
        rx={outerFrame.rx}
        stroke={stroke}
        strokeWidth={outerStrokeWidth}
        vectorEffect={vectorEffect}
        strokeLinejoin="round"
      />
      {cells.map(cell => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          stroke={stroke}
          strokeWidth={innerStrokeWidth}
          vectorEffect={vectorEffect}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function ProfileIcon({ isLightTheme = false, className, ...props }) {
  const stroke = resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <g transform="translate(0 -1.3)">
        <path
          d="M9.3 15H14.7C16.8 15 18.4 16 19 17.6C19.5 18.9 19.4 20.1 19.2 21C18.7 23 16.3 23.6 12 23.6C7.7 23.6 5.3 23 4.8 21C4.6 20.1 4.5 18.9 5 17.6C5.6 16 7.2 15 9.3 15Z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="7"
          r="4"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function SourcesIcon({ isLightTheme = false, className, ...props }) {
  const stroke = resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="-2 -1 123.96 131.67"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <ellipse
        cx="59.98"
        cy="24.7"
        rx="54.98"
        ry="19.7"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 63.34c0 10.88 24.61 19.7 54.98 19.7s54.98-8.82 54.98-19.7"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 101.97c0 10.88 24.61 19.7 54.98 19.7s54.98-8.82 54.98-19.7"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HelpRequestIcon({ isLightTheme = false, className, strokeWidth = 1.5, ...props }) {
  const stroke = resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="0 0 24 25.2"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M12 23.45c-1.05 0-2.17-.56-2.92-1.45C5.4 17.63 3 13.13 3 10c0-4.96 4.04-9 9-9s9 4.04 9 9c0 3.13-2.4 7.63-6.08 12-.75.89-1.87 1.45-2.92 1.45Z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.25 8.55a2.25 2.25 0 1 1 3.3 1.98c-1.03.54-1.55 1.18-1.55 2.22v.48"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 16.45h.01" stroke={stroke} strokeWidth={Math.max(Number(strokeWidth) + 0.6, 2.1)} strokeLinecap="round" />
    </svg>
  );
}

export function HelpOfferIcon({ isLightTheme = false, className, strokeWidth = 1.5, ...props }) {
  const stroke = resolveThemeColor(isLightTheme);
  return (
    <svg
      viewBox="0 0 24 25.2"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M12 23.45c-1.05 0-2.17-.56-2.92-1.45C5.4 17.63 3 13.13 3 10c0-4.96 4.04-9 9-9s9 4.04 9 9c0 3.13-2.4 7.63-6.08 12-.75.89-1.87 1.45-2.92 1.45Z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.95v6.7"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M8.65 10.3h6.7"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MicrophoneIcon({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
      className={cn(className)}
      {...props}
    >
      <path
        d="M12 3.25a3.25 3.25 0 0 0-3.25 3.25v5.2a3.25 3.25 0 0 0 6.5 0V6.5A3.25 3.25 0 0 0 12 3.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 10.9v.72a6.25 6.25 0 0 0 12.5 0v-.72"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 17.87v2.88"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.65 20.75h6.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
