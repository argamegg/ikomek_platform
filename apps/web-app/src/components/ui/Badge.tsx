import { classNames } from "../../utils/classNames";

type BadgeProps = {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning";
  className?: string;
};

export function Badge({ label, tone = "neutral", className }: BadgeProps) {
  return <span className={classNames("badge", `badge--${tone}`, className)}>{label}</span>;
}
