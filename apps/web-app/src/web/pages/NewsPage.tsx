import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Tabs } from "../components/ui/Tabs";
import { formatDate, getPriorityTone } from "../lib/format";
import { platformApi, queryKeys } from "../services/platformApi";

type NewsFilter = "all" | "critical" | "warning" | "information";

export function NewsPage() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<NewsFilter>("all");
  const alertsQuery = useQuery({ queryKey: queryKeys.alerts, queryFn: platformApi.getAlerts });
  const newsQuery = useQuery({ queryKey: queryKeys.news, queryFn: platformApi.getNews });

  const items = useMemo(() => {
    return [...(alertsQuery.data ?? []), ...(newsQuery.data ?? [])].filter((item) =>
      filter === "all" ? true : item.priority === filter,
    );
  }, [alertsQuery.data, filter, newsQuery.data]);

  return (
    <div className="page-stack">
      <PageHeader title={t("news.title")} description={t("news.description")} />
      <Card className="toolbar-card" hover={false}>
        <Tabs
          value={filter}
          onChange={(value) => setFilter(value as NewsFilter)}
          options={[
            { key: "all", label: "All" },
            { key: "critical", label: "Critical" },
            { key: "warning", label: "Warning" },
            { key: "information", label: "Info" },
          ]}
        />
      </Card>
      <div className="news-grid">
        {items.map((item) => (
          <Card key={item.id} className="news-card">
            <Badge tone={getPriorityTone(item.priority)}>{item.priority}</Badge>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <div className="news-card__footer">
              <span>{item.location || "Astana"}</span>
              <time>{formatDate(item.startAt, i18n.language as "en" | "ru" | "kz")}</time>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
