import type { ReactNode } from "react";

type SectionHeadingProps = {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function SectionHeading({
  kicker,
  title,
  description,
  action,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div className="section-heading__topline">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      <p>{description}</p>
    </div>
  );
}
