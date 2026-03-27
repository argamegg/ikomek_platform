import { motion } from "framer-motion";
import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../lib/cn";

type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    hover?: boolean;
    glass?: boolean;
  }
>;

export function Card({ children, className, hover = true, glass = false, ...props }: CardProps) {
  return (
    <motion.div whileHover={hover ? { y: -4 } : undefined} transition={{ duration: 0.22 }}>
      <div
        className={cn("ui-card", hover && "ui-card--hover", glass && "ui-card--glass", className)}
        {...props}
      >
        {children}
      </div>
    </motion.div>
  );
}
