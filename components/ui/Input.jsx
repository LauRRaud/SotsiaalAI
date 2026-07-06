import { cn } from "@/components/ui/cn";
export default function Input({
  size = "md",
  variant = "default",
  className,
  disabled = false,
  ...props
}) {
  return <input data-size={size} data-variant={variant} className={cn(className)} disabled={disabled} aria-disabled={disabled ? "true" : undefined} {...props} />;
}
