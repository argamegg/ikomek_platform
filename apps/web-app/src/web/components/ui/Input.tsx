import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type BaseFieldProps = {
  label?: ReactNode;
  labelMeta?: ReactNode;
  labelMetaTone?: "required" | "optional";
  helper?: string;
  error?: string;
  icon?: ReactNode;
  className?: string;
};

type InputProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

function FieldLabel({
  label,
  labelMeta,
  labelMetaTone = "optional",
}: Pick<BaseFieldProps, "label" | "labelMeta" | "labelMetaTone">) {
  if (!label) {
    return null;
  }

  return (
    <span className="field__label-row">
      <span className="field__label">{label}</span>
      {labelMeta ? (
        <span className={`field__label-meta field__label-meta--${labelMetaTone}`}>{labelMeta}</span>
      ) : null}
    </span>
  );
}

export function Input({ label, labelMeta, labelMetaTone, helper, error, icon, className, ...props }: InputProps) {
  return (
    <label className="field">
      <FieldLabel label={label} labelMeta={labelMeta} labelMetaTone={labelMetaTone} />
      <span className={cn("field__control", error && "field__control--error", className)}>
        {icon ? <span className="field__icon">{icon}</span> : null}
        <input className="field__input" {...props} />
      </span>
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helper ? <span className="field__message">{helper}</span> : null}
    </label>
  );
}

export function Textarea({ label, labelMeta, labelMetaTone, helper, error, className, ...props }: TextareaProps) {
  return (
    <label className="field">
      <FieldLabel label={label} labelMeta={labelMeta} labelMetaTone={labelMetaTone} />
      <span className={cn("field__control", "field__control--textarea", error && "field__control--error", className)}>
        <textarea className="field__input field__textarea" {...props} />
      </span>
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helper ? <span className="field__message">{helper}</span> : null}
    </label>
  );
}

type SelectProps = BaseFieldProps & InputHTMLAttributes<HTMLSelectElement>;

export function Select({ label, labelMeta, labelMetaTone, helper, error, className, children, ...props }: SelectProps) {
  return (
    <label className="field">
      <FieldLabel label={label} labelMeta={labelMeta} labelMetaTone={labelMetaTone} />
      <span className={cn("field__control", error && "field__control--error", className)}>
        <select className="field__input field__select" {...props}>
          {children}
        </select>
      </span>
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helper ? <span className="field__message">{helper}</span> : null}
    </label>
  );
}
