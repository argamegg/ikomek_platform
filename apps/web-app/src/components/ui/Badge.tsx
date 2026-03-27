import { classNames } from "../../utils/classNames";

type BadgeProps = {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning";
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return <span className={classNames("badge", `badge--${tone}`)}>{label}</span>;
}
