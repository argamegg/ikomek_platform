import { useQuery } from "@tanstack/react-query";
import { Clock3, MessagesSquare, Paperclip } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { IssueMap } from "../components/maps/IssueMap";
import { formatDate, getPriorityTone, getStatusTone } from "../lib/format";
import { platformApi, queryKeys } from "../services/platformApi";

export function RequestDetailsPage() {
  const { requestId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const requestQuery = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: () => platformApi.getRequestById(requestId),
    enabled: Boolean(requestId),
  });

  const request = requestQuery.data;

  return (
    <div className="page-stack">
      <PageHeader
        title={request?.title ?? t("requestDetails.overview")}
        description={request?.description}
        action={
          request ? (
            <Link to={`/requests/${request.id}/chat`} className="page-actions">
              <Badge tone={getStatusTone(request.status)}>{request.statusLabel ?? request.status}</Badge>
            </Link>
          ) : null
        }
      />

      {!request ? (
        <EmptyState title="Request not found" description="We could not load the request from the backend." />
      ) : (
        <>
          <div className="dashboard-grid dashboard-grid--wide">
            <Card className="section-card">
              <div className="section-card__header">
                <div>
                  <span className="section-card__eyebrow">{t("requestDetails.overview")}</span>
                  <h3>{request.address}</h3>
                </div>
                <Badge tone={getPriorityTone(request.priority)}>{request.priority}</Badge>
              </div>
              <div className="details-grid">
                <div>
                  <span>Status</span>
                  <strong>{request.statusLabel ?? request.status}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{formatDate(request.createdAt, i18n.language as "en" | "ru" | "kz")}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{request.categoryName || request.categoryId || "—"}</strong>
                </div>
                <div>
                  <span>Reason</span>
                  <strong>{request.reasonName || request.reasonId || "—"}</strong>
                </div>
              </div>
              <p>{request.description}</p>
            </Card>

            <Card className="section-card section-card--map" hover={false}>
              <IssueMap requests={[request]} mode="all" />
            </Card>
          </div>

          <div className="dashboard-grid dashboard-grid--wide">
            <Card className="section-card">
              <div className="section-card__header">
                <div>
                  <span className="section-card__eyebrow">{t("requests.timeline")}</span>
                  <h3>Status history</h3>
                </div>
                <Clock3 size={18} />
              </div>
              <div className="timeline">
                {request.statusHistory.map((item) => (
                  <div key={item.id} className="timeline__item">
                    <span className="timeline__dot" />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.note || item.status}</p>
                      <small>{formatDate(item.timestamp, i18n.language as "en" | "ru" | "kz")}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="section-card">
              <div className="section-card__header">
                <div>
                  <span className="section-card__eyebrow">{t("requests.attachments")}</span>
                  <h3>Media and chat snapshot</h3>
                </div>
                <Paperclip size={18} />
              </div>
              <div className="attachment-grid">
                {request.attachments.map((attachment) => (
                  <a key={attachment.id} href={attachment.url} className="attachment-tile" target="_blank" rel="noreferrer">
                    <strong>{attachment.label}</strong>
                    <span>{attachment.type}</span>
                  </a>
                ))}
              </div>
              <div className="message-preview">
                {(request.messages ?? []).slice(-3).map((message) => (
                  <div key={message.id} className="message-preview__item">
                    <strong>{message.senderName}</strong>
                    <p>{message.message}</p>
                  </div>
                ))}
              </div>
              <Link to={`/requests/${request.id}/chat`} className="inline-link">
                <MessagesSquare size={16} />
                Open full chat
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
