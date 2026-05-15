import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  Paperclip,
  Route,
  Tag,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Locale } from "../../types/platform";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { IssueMap } from "../components/maps/IssueMap";
import { formatDate, getPriorityBadgeClass, getStatusTone } from "../lib/format";
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

function normalizeLocale(language: string): Locale {
  if (language.startsWith("ru")) return "ru";
  if (language.startsWith("kk") || language.startsWith("kz")) return "kz";
  return "en";
}

export function RequestDetailsPage() {
  const { requestId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const requestQuery = useQuery({
    queryKey: [...queryKeys.request(requestId), i18n.language, currentUserQuery.data?.id ?? "guest"],
    queryFn: () => platformApi.getRequestById(requestId),
    enabled: Boolean(requestId) && !currentUserQuery.isLoading,
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

  if (!request && !requestQuery.isLoading) {
    return (
      <div className="request-detail-page">
        <EmptyState title={t("requestDetails.notFoundTitle")} description={t("requestDetails.notFoundDescription")} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="request-detail-page">
        <div className="request-detail-skeleton" />
      </div>
    );
  }

  const title = localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t);
  const description = localizeRequestDescription(request.description, request.categoryId, request.title, request.reasonId || request.reasonName, t);
  const category = localizeRequestCategory(request.categoryId || request.categoryName, t) || "—";
  const reason = localizeRequestReason(request.categoryId || request.categoryName, request.reasonId || request.reasonName, t) || "—";
  const author = request.citizenName || t("requests.unknownAuthor");

  return (
    <div className="request-detail-page">
      <section className="request-detail-hero">
        <Link to="/requests" className="request-detail-back">
          <ArrowLeft size={18} />
          {t("requests.title")}
        </Link>
        <div className="request-detail-hero__content">
          <div>
            <div className="request-detail-badges">
              <Badge tone={getStatusTone(request.status)}>
                {localizeRequestStatus(request.statusLabel || request.status, t)}
              </Badge>
              <Badge className={getPriorityBadgeClass(request.priority)}>
                {localizeRequestPriority(request.priority, t)}
              </Badge>
            </div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {canUseChat ? (
            <Link to={`/requests/${request.id}/chat`} className="request-detail-chat">
              <MessageCircle size={18} />
              {t("requestDetails.openChat")}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="request-detail-layout">
        <article className="request-detail-card request-detail-card--overview">
          <div className="request-detail-card__head">
            <span>{t("requestDetails.overview")}</span>
            <strong>#{request.id.slice(0, 8)}</strong>
          </div>
          <h2>{request.address}</h2>
          <p>{description}</p>

          <div className="request-detail-facts">
            <div>
              <Clock3 size={18} />
              <span>{t("requestDetails.status")}</span>
              <strong>{localizeRequestStatus(request.statusLabel || request.status, t)}</strong>
            </div>
            <div>
              <CalendarClock size={18} />
              <span>{t("requestDetails.created")}</span>
              <strong>{formatDate(request.createdAt, locale)}</strong>
            </div>
            <div>
              <UserRound size={18} />
              <span>{t("requests.author")}</span>
              <strong>{author}</strong>
            </div>
            <div>
              <Tag size={18} />
              <span>{t("requestDetails.category")}</span>
              <strong>{category}</strong>
            </div>
            <div>
              <Route size={18} />
              <span>{t("requestDetails.reason")}</span>
              <strong>{reason}</strong>
            </div>
          </div>
        </article>

        <article className="request-detail-card request-detail-card--map">
          <div className="request-detail-card__head">
            <span>{t("requestDetails.location")}</span>
            <MapPin size={18} />
          </div>
          <IssueMap requests={[request]} mode="all" />
        </article>

        <article className="request-detail-card">
          <div className="request-detail-card__head">
            <span>{t("requests.timeline")}</span>
            <Clock3 size={18} />
          </div>
          <div className="request-detail-timeline">
            {request.statusHistory.length ? request.statusHistory.map((item) => (
              <div key={item.id} className="request-detail-timeline__item">
                <i />
                <div>
                  <strong>{localizeRequestStatus(item.label || item.status, t)}</strong>
                  <p>{localizeRequestStatus(item.note || item.status, t)}</p>
                  <small>{formatDate(item.timestamp, locale)}</small>
                </div>
              </div>
            )) : (
              <p className="request-detail-muted">{t("requestDetails.noTimeline")}</p>
            )}
          </div>
        </article>

        <article className="request-detail-card">
          <div className="request-detail-card__head">
            <span>{t("requests.attachments")}</span>
            <Paperclip size={18} />
          </div>
          {request.attachments.length ? (
            <div className="request-detail-attachments">
              {request.attachments.map((attachment) => (
                <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                  <FileText size={18} />
                  <div>
                    <strong>{attachment.label}</strong>
                    <span>{localizeAttachmentType(attachment.type, t)}</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="request-detail-muted">{t("requestDetails.noAttachments")}</p>
          )}

          {canUseChat ? (
            <div className="request-detail-messages">
              <div className="request-detail-messages__head">
                <span>{t("requestDetails.chatPreview")}</span>
                <Link to={`/requests/${request.id}/chat`}>{t("requestDetails.openChat")}</Link>
              </div>
              {(request.messages ?? []).slice(-3).length ? (request.messages ?? []).slice(-3).map((message) => (
                <div key={message.id} className="request-detail-message">
                  <strong>{message.senderName}</strong>
                  <p>{message.message}</p>
                </div>
              )) : (
                <p className="request-detail-muted">{t("requestDetails.noMessages")}</p>
              )}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
