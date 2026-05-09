import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Tabs } from "../components/ui/Tabs";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate, getPriorityTone, getStatusTone } from "../lib/format";
import {
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { platformApi, queryKeys } from "../services/platformApi";

type FilterMode = "all" | "pending" | "in_progress" | "closed";

export function RequestsPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterMode>("all");
  const deferredSearch = useDeferredValue(search);
  const requestsQuery = useQuery({
    queryKey: queryKeys.myRequests,
    queryFn: platformApi.getMyRequests,
  });

  const requests = useMemo(() => {
    return (requestsQuery.data ?? []).filter((request) => {
      const matchesStatus = status === "all" ? true : request.status === status;
      const haystack = `${request.title} ${request.address} ${request.id}`.toLowerCase();
      const matchesSearch = haystack.includes(deferredSearch.trim().toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [deferredSearch, requestsQuery.data, status]);

  return (
    <div className="page-stack">
      <PageHeader title={t("requests.title")} description={t("requests.description")} />
      <Card className="toolbar-card" hover={false}>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("common.searchPlaceholder")}
        />
        <Tabs
          value={status}
          onChange={(value) => setStatus(value as FilterMode)}
          options={[
            { key: "all", label: t("requests.filtersAll") },
            { key: "pending", label: t("requests.filtersPending") },
            { key: "in_progress", label: t("requests.filtersProgress") },
            { key: "closed", label: t("requests.filtersClosed") },
          ]}
        />
      </Card>

      <div className="request-card-grid">
        {requests.map((request) => (
          <Card key={request.id} className="request-card">
            <div className="request-card__top">
              <div>
                <Badge tone={getPriorityTone(request.priority)}>{localizeRequestPriority(request.priority, t)}</Badge>
                <h3>{localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t)}</h3>
              </div>
              <Badge tone={getStatusTone(request.status)}>{localizeRequestStatus(request.statusLabel || request.status, t)}</Badge>
            </div>
            <p>{localizeRequestDescription(request.description, request.categoryId, request.title, request.reasonId || request.reasonName, t)}</p>
            <div className="request-card__meta">
              <span>{request.address}</span>
              <span>{formatDate(request.updatedAt, i18n.language as "en" | "ru" | "kz")}</span>
            </div>
            <div className="request-card__actions">
              <Link to={`/requests/${request.id}`}>Details</Link>
              <Link to={`/requests/${request.id}/chat`}>Chat</Link>
            </div>
          </Card>
        ))}
      </div>

      {!requests.length ? (
        <EmptyState title={t("requests.empty")} description={t("emptyStates.genericDescription")} />
      ) : null}
    </div>
  );
}
