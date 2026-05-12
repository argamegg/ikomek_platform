import { LoaderCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    fullWidth?: boolean;
  }
>;

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.span
      className={cn("ui-button-wrap", fullWidth && "ui-button-wrap--full")}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <button
        className={cn(
          "ui-button",
          `ui-button--${variant}`,
          `ui-button--${size}`,
          fullWidth && "ui-button--full",
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <LoaderCircle className="ui-button__spinner" size={16} /> : iconLeft}
        <span>{children}</span>
        {!isLoading ? iconRight : null}
      </button>
    </motion.span>
  );
}
