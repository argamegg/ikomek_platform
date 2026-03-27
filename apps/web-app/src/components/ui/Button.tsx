import { classNames } from "../../utils/classNames";

type ButtonProps = {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "chip" | "danger";
  isActive?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
};

export function Button({
  label,
  onClick,
  variant = "primary",
  isActive = false,
  disabled = false,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames("button", `button--${variant}`, isActive && "is-active")}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
