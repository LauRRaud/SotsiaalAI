import { cn } from "@/components/ui/cn";
export default function Panel({
  as: Component = "div",
  variant = "glass",
  padding = "md",
  className,
  ...props
}) {
  return <Component data-variant={variant} data-padding={padding} className={cn(className)} {...props} />;
}
