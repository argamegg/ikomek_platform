import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, MapPinned, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { formatDate, formatRelativeTime, getPriorityTone, getStatusTone } from "../lib/format";
import { platformApi, queryKeys } from "../services/platformApi";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const myRequestsQuery = useQuery({ queryKey: queryKeys.myRequests, queryFn: platformApi.getMyRequests });
  const savedLocationsQuery = useQuery({
    queryKey: queryKeys.savedLocations,
    queryFn: platformApi.getSavedLocations,
  });
  const alertsQuery = useQuery({ queryKey: queryKeys.alerts, queryFn: platformApi.getAlerts });
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: platformApi.getNotifications,
  });

  const metrics = useMemo(() => {
    const requests = myRequestsQuery.data ?? [];
    return {
      total: requests.length,
      active: requests.filter((item) => item.status === "in_progress").length,
      pending: requests.filter((item) => item.status === "pending").length,
      saved: savedLocationsQuery.data?.length ?? 0,
    };
  }, [myRequestsQuery.data, savedLocationsQuery.data?.length]);

  useEffect(() => {
    console.log("Dashboard loaded");
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={currentUserQuery.data?.name}
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        action={
          <Link to="/requests/new">
            <Button>{t("common.submitRequest")}</Button>
          </Link>
        }
      />

      <div className="stats-grid">
        {[
          { label: t("dashboard.cards.total"), value: metrics.total },
          { label: t("dashboard.cards.active"), value: metrics.active },
          { label: t("dashboard.cards.pending"), value: metrics.pending },
          { label: t("dashboard.cards.saved"), value: metrics.saved },
        ].map((item) => (
          <Card key={item.label}>
            <span className="stat-tile__label">{item.label}</span>
            <strong className="stat-tile__value">{item.value}</strong>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card className="section-card">
          <div className="section-card__header">
            <div>
              <span className="section-card__eyebrow">{t("common.requests")}</span>
              <h3>Recent activity</h3>
            </div>
            <WalletCards size={18} />
          </div>
          <div className="request-list">
            {(myRequestsQuery.data ?? []).slice(0, 4).map((request) => (
              <Link key={request.id} to={`/requests/${request.id}`} className="request-row">
                <div>
                  <strong>{request.title}</strong>
                  <p>{request.address}</p>
                </div>
                <div className="request-row__meta">
                  <Badge tone={getStatusTone(request.status)}>{request.statusLabel ?? request.status}</Badge>
                  <span>{formatRelativeTime(request.updatedAt, i18n.language as "en" | "ru" | "kz")}</span>
                </div>
              </Link>
            ))}
            {!myRequestsQuery.data?.length ? (
              <EmptyState
                title="No resident requests yet"
                description="Create your first issue to start tracking city response status here."
                action={
                  <Link to="/requests/new">
                    <Button>{t("common.submitRequest")}</Button>
                  </Link>
                }
              />
            ) : null}
          </div>
        </Card>

        <Card className="section-card">
          <div className="section-card__header">
            <div>
              <span className="section-card__eyebrow">{t("profile.title")}</span>
              <h3>Saved places</h3>
            </div>
            <MapPinned size={18} />
          </div>
          <div className="address-list">
            {(savedLocationsQuery.data ?? []).slice(0, 4).map((location) => (
              <div key={location.id} className="address-list__item">
                <strong>{location.label}</strong>
                <p>{location.address}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="section-card">
          <div className="section-card__header">
            <div>
              <span className="section-card__eyebrow">{t("common.news")}</span>
              <h3>Alerts and notifications</h3>
            </div>
            <Bell size={18} />
          </div>
          <div className="news-stack">
            {(alertsQuery.data ?? []).slice(0, 2).map((item) => (
              <article key={item.id} className="news-stack__item">
                <Badge tone={getPriorityTone(item.priority ?? "information")}>
                  {item.priority ?? "information"}
                </Badge>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <span>
                  {formatDate(
                    item.startAt || item.publishedAt || new Date().toISOString(),
                    i18n.language as "en" | "ru" | "kz",
                  )}
                </span>
              </article>
            ))}
            {(notificationsQuery.data ?? []).slice(0, 2).map((notification) => (
              <article key={notification.id} className="news-stack__item">
                <strong>{notification.title}</strong>
                <p>{notification.description}</p>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
