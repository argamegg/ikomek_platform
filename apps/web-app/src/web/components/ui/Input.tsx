import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type BaseFieldProps = {
  label?: string;
  helper?: string;
  error?: string;
  icon?: ReactNode;
  className?: string;
};

type InputProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Input({ label, helper, error, icon, className, ...props }: InputProps) {
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      <span className={cn("field__control", error && "field__control--error", className)}>
        {icon ? <span className="field__icon">{icon}</span> : null}
        <input className="field__input" {...props} />
      </span>
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helper ? <span className="field__message">{helper}</span> : null}
    </label>
  );
}

export function Textarea({ label, helper, error, className, ...props }: TextareaProps) {
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      <span className={cn("field__control", "field__control--textarea", error && "field__control--error", className)}>
        <textarea className="field__input field__textarea" {...props} />
      </span>
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helper ? <span className="field__message">{helper}</span> : null}
    </label>
  );
}

type SelectProps = BaseFieldProps & InputHTMLAttributes<HTMLSelectElement>;

export function Select({ label, helper, error, className, children, ...props }: SelectProps) {
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
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
