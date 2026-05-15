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
import {
  localizeAttachmentType,
  localizeRequestCategory,
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestReason,
  localizeRequestStatus,
} from "../lib/requestMeta";
import { platformApi, queryKeys } from "../services/platformApi";

export function RequestDetailsPage() {
  const { requestId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const requestQuery = useQuery({
    queryKey: [...queryKeys.request(requestId), i18n.language],
    queryFn: () => platformApi.getRequestById(requestId),
    enabled: Boolean(requestId),
  });
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });

  const request = requestQuery.data;
  const currentUser = currentUserQuery.data ?? null;
  const canUseChat = Boolean(
    request &&
      currentUser &&
      (
        currentUser.roles.some((role) => role === "operator" || role === "admin") ||
        currentUser.id === request.citizenId
      ),
  );

  return (
    <div className="page-stack">
      <PageHeader
        title={request ? localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t) : t("requestDetails.overview")}
        description={request ? localizeRequestDescription(request.description, request.categoryId, request.title, request.reasonId || request.reasonName, t) : undefined}
        action={
          request && canUseChat ? (
            <Link to={`/requests/${request.id}/chat`} className="page-actions">
              <Badge tone={getStatusTone(request.status)}>{localizeRequestStatus(request.statusLabel || request.status, t)}</Badge>
            </Link>
          ) : request ? (
            <Badge tone={getStatusTone(request.status)}>{localizeRequestStatus(request.statusLabel || request.status, t)}</Badge>
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
                <Badge tone={getPriorityTone(request.priority)}>{localizeRequestPriority(request.priority, t)}</Badge>
              </div>
              <div className="details-grid">
                <div>
                  <span>Status</span>
                  <strong>{localizeRequestStatus(request.statusLabel || request.status, t)}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{formatDate(request.createdAt, i18n.language as "en" | "ru" | "kz")}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{localizeRequestCategory(request.categoryId || request.categoryName, t) || "—"}</strong>
                </div>
                <div>
                  <span>Reason</span>
                  <strong>{localizeRequestReason(request.categoryId || request.categoryName, request.reasonId || request.reasonName, t) || "—"}</strong>
                </div>
              </div>
              <p>{localizeRequestDescription(request.description, request.categoryId, request.title, request.reasonId || request.reasonName, t)}</p>
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
                      <strong>{localizeRequestStatus(item.label || item.status, t)}</strong>
                      <p>{localizeRequestStatus(item.note || item.status, t)}</p>
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
                    <span>{localizeAttachmentType(attachment.type, t)}</span>
                  </a>
                ))}
              </div>
              {canUseChat ? (
                <>
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
                </>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
