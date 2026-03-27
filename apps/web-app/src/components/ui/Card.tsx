import type { PropsWithChildren, ReactNode } from "react";
import { classNames } from "../../utils/classNames";

type CardProps = PropsWithChildren<{
  className?: string;
  header?: ReactNode;
}>;

export function Card({ className, header, children }: CardProps) {
  return (
    <article className={classNames("card", className)}>
      {header ? <div className="card__header">{header}</div> : null}
      {children}
    </article>
  );
}
