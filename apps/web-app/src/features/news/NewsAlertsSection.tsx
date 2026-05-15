import { useDeferredValue, useState } from "react";
import type { Copy } from "../../App";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { NewsItem, NewsPriority } from "../../types/platform";
import { formatDate } from "../../utils/formatters";

type NewsAlertsSectionProps = {
  copy: Copy;
  items: NewsItem[];
};

const priorities: Array<"all" | NewsPriority> = [
  "all",
  "critical",
  "warning",
  "information",
];

export function NewsAlertsSection({ copy, items }: NewsAlertsSectionProps) {
  const [priority, setPriority] = useState<"all" | NewsPriority>("all");
  const deferredPriority = useDeferredValue(priority);
  const filtered = items.filter((item) =>
    deferredPriority === "all" ? true : item.priority === deferredPriority,
  );

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.news.kicker}
        title={copy.news.title}
        description={copy.news.description}
      />
      <div className="badge-row section-controls">
        {priorities.map((item) => (
          <Button
            key={item}
            label={item === "all" ? "All" : item}
            variant="chip"
            isActive={priority === item}
            onClick={() => setPriority(item)}
          />
        ))}
      </div>
      <div className="cards-grid cards-grid--three">
        {filtered.map((item) => (
          <Card key={item.id}>
            <p className="eyebrow">{item.category}</p>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <p>
              {item.location ?? "Astana"} • {formatDate(item.startAt)}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
