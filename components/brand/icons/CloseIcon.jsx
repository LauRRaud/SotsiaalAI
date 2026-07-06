/**
 * CloseIcon — sulgemisrist brändi õhukeses joonestiilis
 * (sama käsi mis ChevronIcon: ümarad otsad, currentColor).
 */

import { cn } from "@/components/ui/cn";

export default function CloseIcon({ strokeWidth = 1.4, className, ...props }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(className)}
      {...props}
    >
      <path
        d="M1.2 1.2l7.6 7.6M8.8 1.2 1.2 8.8"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
