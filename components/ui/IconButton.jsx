import { forwardRef } from "react";
import CloseIcon from "@/components/brand/icons/CloseIcon";
const IconButton = forwardRef(function IconButton({
  variant: _variant,
  className,
  label = "Close",
  type = "button",
  ...props
}, ref) {
  return <button ref={ref} type={type} aria-label={label} className={className} {...props}>
      <span aria-hidden="true">
        <CloseIcon width={12} height={12} />
      </span>
    </button>;
});

export default IconButton;
