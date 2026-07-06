/**
 * MenuIcon — vestluste menüü (☰) brändi õhukeses joonestiilis.
 */

import { cn } from "@/components/ui/cn";

export default function MenuIcon({ strokeWidth = 1.4, className, ...props }) {
  return (
    <svg
      viewBox="0 0 12 10"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M1 1.2h10M1 5h10M1 8.8h6.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
