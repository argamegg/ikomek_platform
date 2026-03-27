import type { PropsWithChildren } from "react";
import { cn } from "../../lib/cn";

type BadgeProps = PropsWithChildren<{
  tone?: "neutral" | "warning" | "success" | "danger" | "info";
  className?: string;
}>;

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return <span className={cn("ui-badge", `ui-badge--${tone}`, className)}>{children}</span>;
}
