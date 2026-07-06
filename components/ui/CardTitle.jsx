export default function CardTitle({
  as: Component = "div",
  className,
  ...props
}) {
  return <Component className={className} {...props} />;
}
