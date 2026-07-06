import Link from "next/link";
import { cn } from "@/components/ui/cn";

export default function AppLink({
  variant = "brand",
  className,
  prefetch = false,
  ...props
}) {
  return (
    <Link
      prefetch={prefetch}
      data-variant={variant}
      className={cn(className)}
      {...props}
    />
  );
}
